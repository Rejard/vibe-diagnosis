const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { runDiagnosticsReport, runCompletionDiagnostics } = require('../src/runner');
const { summarizeResults } = require('../src/run-summary');
const { assertAst, detectFragileStringChecks } = require('../src/assertions');
const { selectDiagnostics } = require('../src/selector');
const { applyRepairPlan, autoRevertOrRepairOmission } = require('../src/repairer');
const { upsertRules } = require('../src/rules-injector');
const { initialize } = require('../src/init');
const { saveByokConfig, getByokConfig, getResolvedByok } = require('../src/config-manager');

function project() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-diag-'));
  fs.mkdirSync(path.join(root, '.vibe-diagnosis', 'diagnostics'), { recursive: true });
  return root;
}
function diagnostic(root, name, source) {
  const target = path.join(root, '.vibe-diagnosis', 'diagnostics', `${name}.diag.js`);
  fs.writeFileSync(target, source, 'utf8');
  return target;
}

test('isolates env and cwd that fail in a legacy same-process run', async t => {
  const root = project();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const mutator = diagnostic(root, 'a-mutator', `module.exports={id:'mutator',name:'mutator',layer:'SYSTEM',async run(){process.env.VIBE_LEAK='yes';process.chdir(require('path').dirname(process.cwd()));return {status:'OK',details:'mutated'}}}`);
  const checker = diagnostic(root, 'b-checker', `module.exports={id:'checker',name:'checker',layer:'SYSTEM',async run({projectDir}){return process.env.VIBE_LEAK||process.cwd()!==projectDir?{status:'ERROR',details:'shared state leaked'}:{status:'OK',details:'isolated'}}}`);
  const before = process.cwd();
  await require(mutator).run();
  const legacy = await require(checker).run({ projectDir: root });
  process.chdir(before);
  delete process.env.VIBE_LEAK;
  assert.equal(legacy.status, 'ERROR');
  const report = await runDiagnosticsReport(root, { persist: false, compareBaseline: false });
  assert.deepEqual(report.results.map(result => result.status), ['OK', 'OK']);
});

test('captures timeout attempts and marks retry recovery as flaky', async t => {
  const root = project();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  diagnostic(root, 'a-timeout', `module.exports={id:'timeout',name:'timeout',layer:'SYSTEM',async run(){await new Promise(()=>{})}}`);
  const marker = path.join(root, 'flaky.marker').replace(/\\/g, '\\\\');
  diagnostic(root, 'b-flaky', `const fs=require('fs');module.exports={id:'flaky',name:'flaky',layer:'SYSTEM',async run(){if(!fs.existsSync('${marker}')){fs.writeFileSync('${marker}','1');throw new Error('first attempt')}return {status:'OK',details:'recovered'}}}`);
  const report = await runDiagnosticsReport(root, { timeoutMs: 120, persist: false, compareBaseline: false });
  const timeout = report.results.find(result => result.id === 'timeout');
  const flaky = report.results.find(result => result.id === 'flaky');
  assert.equal(timeout.classification, 'TIMEOUT');
  assert.equal(timeout.attempts.length, 2);
  assert.equal(timeout.execution.timedOut, true);
  assert.equal(flaky.status, 'WARNING');
  assert.equal(flaky.classification, 'FLAKY');
  assert.equal(flaky.attempts.length, 2);
});

test('does not retry a real test failure and preserves legacy result shape', async t => {
  const root = project();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  diagnostic(root, 'failure', `module.exports={id:'failure',name:'failure',layer:'TASK',async run(){return {status:'ERROR',details:'expected 2 received 3'}}}`);
  diagnostic(root, 'legacy', `module.exports={id:'legacy',name:'legacy',layer:'TASK',async run(){return {status:'OK',details:'old format'}}}`);
  const report = await runDiagnosticsReport(root, { persist: false, compareBaseline: false });
  const failure = report.results.find(result => result.id === 'failure');
  assert.equal(failure.classification, 'TEST_FAILURE');
  assert.equal(failure.attempts.length, 1);
  assert.equal(report.results.find(result => result.id === 'legacy').status, 'OK');
});

test('preserves child process exit evidence', async t => {
  const root = project();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  diagnostic(root, 'child', `const {execFileSync}=require('child_process');module.exports={id:'child',name:'child',layer:'SYSTEM',async run(){execFileSync(process.execPath,['-e',\"process.stderr.write('fixture stderr');process.exit(7)\"],{stdio:'pipe'});return {status:'OK'}}}`);
  const report = await runDiagnosticsReport(root, { persist: false, compareBaseline: false });
  const result = report.results[0];
  assert.equal(result.classification, 'RUNNER_ERROR');
  assert.equal(result.execution.childExitCode, 7);
  assert.match(result.execution.childStderr, /fixture stderr/);
});

test('critical blockers override a high pass percentage and evidence remains separate', () => {
  const ok = Array.from({ length: 99 }, (_, id) => ({ id: `ok-${id}`, status: 'OK', scope: 'STATIC', evidence: [{ type: 'STATIC', summary: 'source', freshness: 'FRESH', live: false }] }));
  const blocked = { id: 'authority', status: 'ERROR', severity: 'CRITICAL', blocksRelease: true, blocksLiveTrading: true, scope: 'AUTHORITY', evidence: [] };
  const summary = summarizeResults([...ok, blocked]);
  assert.equal(summary.healthPercent, 99);
  assert.equal(summary.overallStatus, 'RELEASE_BLOCKED');
  assert.equal(summary.gates.liveTradingStatus, 'LIVE_BLOCKED');
  assert.equal(summary.evidenceSummary.liveEvidenceStatus, 'UNVERIFIED');
});

test('provides AST assertions and fragile string warnings', () => {
  assert.doesNotThrow(() => assertAst('module.exports = { run() {} }', ({ nodes }) => nodes.some(node => node.type === 'FunctionExpression')));
  assert.equal(detectFragileStringChecks(`const source='x'; source.includes('한국어 문구')`).length, 1);
});

test('selects by metadata and includes declared dependencies', t => {
  const root = project();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const base = diagnostic(root, 'base', `module.exports={id:'base',name:'base',layer:'TASK',tags:['base'],async run(){return {status:'OK'}}}`);
  const selected = diagnostic(root, 'selected', `module.exports={id:'selected',name:'selected',layer:'TASK',scope:'AUTHORITY',severity:'CRITICAL',tags:['security'],dependencies:['base'],async run(){return {status:'OK'}}}`);
  assert.deepEqual(selectDiagnostics([base, selected], { tags: ['security'] }).map(item => item.id).sort(), ['base', 'selected']);
});

test('refuses repair application without explicit approval', async t => {
  const root = project();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, '.vibe-diagnosis', 'repair-plans'), { recursive: true });
  fs.writeFileSync(path.join(root, '.vibe-diagnosis', 'repair-plans', 'approval.json'), JSON.stringify({ id: 'approval', status: 'PENDING_APPROVAL', risk: { requiresHighRiskApproval: false }, files: [], baselineResults: [] }), 'utf8');
  await assert.rejects(() => applyRepairPlan(root, 'approval', { approved: false }), /Explicit approval/);
});

test('completion diagnostics run the full suite without cache or dashboard', async t => {
  const root = project();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  diagnostic(root, 'ok', `module.exports={id:'ok',name:'ok',layer:'TASK',async run(){return {status:'OK',details:'verified'}}}`);
  const report = await runCompletionDiagnostics(root, { persist: false, filters: { ids: ['missing'] }, useCache: true });
  assert.equal(report.discovered, 1);
  assert.equal(report.selected, 1);
  assert.equal(report.completion.eligible, true);
  assert.equal(report.completion.fullSuite, true);
  assert.equal(report.completion.cacheUsed, false);
  assert.equal(report.completion.dashboardRequired, false);
});

test('completion diagnostics reject projects without diagnostics', async t => {
  const root = project();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const report = await runCompletionDiagnostics(root, { persist: false });
  assert.equal(report.completion.eligible, false);
  assert.ok(report.completion.reasons.includes('NO_DIAGNOSTICS'));
});

test('agent rules preserve project instructions and upgrade legacy blocks', () => {
  const existing = `# Project rules\n\nKeep this instruction.\n\n## Vibe Diagnosis — MCP AI Self-Diagnostics Rules\n- MANDATORY: Run \`run_diagnostics\` at the end.\n\n## Next section\nKeep this too.\n`;
  const updated = upsertRules(existing);
  assert.match(updated, /Keep this instruction/);
  assert.match(updated, /complete_task_diagnostics/);
  assert.match(updated, /## Next section/);
  assert.equal(upsertRules(updated), updated);
});

test('initialization refreshes agent rules for an existing diagnostic project', t => {
  const root = project();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'AGENTS.md'), '# Existing\n\nPreserve me.\n', 'utf8');
  const originalLog = console.log;
  console.log = () => {};
  let result;
  try { result = initialize(root); } finally { console.log = originalLog; }
  assert.equal(result.refreshed, true);
  assert.match(fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8'), /Preserve me/);
  assert.match(fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8'), /complete_task_diagnostics/);
  assert.match(fs.readFileSync(path.join(root, 'GEMINI.md'), 'utf8'), /complete_task_diagnostics/);
  assert.ok(fs.existsSync(path.join(root, '.gemini', 'settings.json')));
});

test('BYOK secrets stay in an ignored local file instead of shareable config', t => {
  const root = project();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  saveByokConfig(root, { provider: 'openai', apiKey: 'local-test-key-123456', model: 'test-model' });
  const config = JSON.parse(fs.readFileSync(path.join(root, '.vibe-diagnosis', 'config.json'), 'utf8'));
  const local = JSON.parse(fs.readFileSync(path.join(root, '.vibe-diagnosis', 'byok.local.json'), 'utf8'));
  assert.equal(config.byok.apiKey, '');
  assert.equal(local.apiKey, 'local-test-key-123456');
  assert.equal(getResolvedByok(root).apiKey, 'local-test-key-123456');
  assert.match(getByokConfig(root, { maskKey: true }).apiKey, /\*\*\*\*/);
  assert.match(fs.readFileSync(path.join(root, '.gitignore'), 'utf8'), /^\.vibe-diagnosis\/$/m);
});

test('legacy BYOK secrets migrate out of config on first read', t => {
  const root = project();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const configPath = path.join(root, '.vibe-diagnosis', 'config.json');
  fs.writeFileSync(configPath, JSON.stringify({ byok: { provider: 'gemini', apiKey: 'legacy-local-test-key', model: 'test-model' } }), 'utf8');
  assert.equal(getResolvedByok(root).apiKey, 'legacy-local-test-key');
  assert.equal(JSON.parse(fs.readFileSync(configPath, 'utf8')).byok.apiKey, '');
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, '.vibe-diagnosis', 'byok.local.json'), 'utf8')).apiKey, 'legacy-local-test-key');
});

test('omission repair creates a plan without changing the file', async t => {
  const root = project();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src', 'view.js'), 'current', 'utf8');
  fs.writeFileSync(path.join(root, 'src', 'view.js.bak'), 'restored', 'utf8');
  const result = await autoRevertOrRepairOmission(root, 'src/view.js');
  assert.equal(result.requiresApproval, true);
  assert.equal(result.restored, false);
  assert.equal(fs.readFileSync(path.join(root, 'src', 'view.js'), 'utf8'), 'current');
  assert.match(result.plan.files[0].diffPreview, /restored/);
});
