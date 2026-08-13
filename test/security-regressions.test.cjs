const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const { autoRevertOrRepairOmission, applyRepairPlan } = require('../src/repairer');
const { saveByokConfig } = require('../src/config-manager');
const { runCompletionDiagnostics, runDiagnosticsReport } = require('../src/runner');
const { acquireDiagnosticsLock, ERROR_CODE } = require('../src/diagnostics-lock');
const { summarizeResults } = require('../src/run-summary');
const { summarizeEvidence } = require('../src/evidence');
const { upsertRules } = require('../src/rules-injector');
const { verifyCompletionReceipt } = require('../src/completion-receipt');
const { verifyBuildSafety } = require('../src/build-verifier');
const { PROVIDERS } = require('../src/ai-provider');
const { auditDiagnostics } = require('../src/diagnostic-audit');

function project(prefix = 'vibe-security-') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.mkdirSync(path.join(root, '.vibe-diagnosis', 'diagnostics'), { recursive: true });
  return root;
}

function git(root, args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
}

function initializeGit(root) {
  git(root, ['init', '-q']);
  git(root, ['config', 'user.email', 'test@example.com']);
  git(root, ['config', 'user.name', 'Vibe Test']);
}

function okDiagnostic(root, extra = '') {
  fs.writeFileSync(path.join(root, '.vibe-diagnosis', 'diagnostics', 'ok.diag.js'), `module.exports={id:'ok',name:'ok',layer:'SYSTEM',severity:'CRITICAL',blocksRelease:true,${extra}async run(){return {status:'OK',details:'ok'}}}`);
}

test('repair integrity seals high-risk approval and verification fields', async t => {
  const root = project('vibe-plan-integrity-');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const dir = path.join(root, 'src', 'auth');
  fs.mkdirSync(dir, { recursive: true });
  const target = path.join(dir, 'service.js');
  fs.writeFileSync(target, 'current');
  fs.writeFileSync(`${target}.bak`, 'restored');
  const created = await autoRevertOrRepairOmission(root, 'src/auth/service.js');
  assert.equal(created.plan.risk.requiresHighRiskApproval, true);
  const planPath = path.join(root, '.vibe-diagnosis', 'repair-plans', `${created.plan.id}.json`);
  const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
  plan.risk = { level: 'LOW', requiresApproval: true, requiresHighRiskApproval: false, reasons: [] };
  fs.writeFileSync(planPath, JSON.stringify(plan));
  await assert.rejects(
    applyRepairPlan(root, plan.id, { approved: true, approvedChecksum: plan.integrity.checksum }),
    /integrity verification failed/,
  );
  assert.equal(fs.readFileSync(target, 'utf8'), 'current');
});

test('legacy config-only ignore migrates BYOK local secrets to an ignored path', t => {
  const root = project('vibe-byok-ignore-');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  initializeGit(root);
  fs.writeFileSync(path.join(root, '.gitignore'), '.vibe-diagnosis/config.json\n');
  saveByokConfig(root, { provider: 'openai', apiKey: 'fake-local-key', model: 'test' });
  const ignored = spawnSync('git', ['check-ignore', '-q', '.vibe-diagnosis/byok.local.json'], { cwd: root, windowsHide: true });
  assert.equal(ignored.status, 0);
});

test('completion rejects ignored protected-file mutation', async t => {
  const root = project('vibe-protected-mutation-');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  initializeGit(root);
  fs.writeFileSync(path.join(root, '.gitignore'), '.env\n.vibe-diagnosis/runs/\n');
  fs.writeFileSync(path.join(root, '.env'), 'before');
  fs.writeFileSync(path.join(root, '.vibe-diagnosis', 'diagnostics', 'mutate.diag.js'), `const fs=require('fs'),path=require('path');module.exports={id:'mutate',name:'mutate',layer:'SYSTEM',severity:'CRITICAL',blocksRelease:true,async run({projectDir}){fs.writeFileSync(path.join(projectDir,'.env'),'after');return {status:'OK',details:'done'}}}`);
  git(root, ['add', '.gitignore', '.vibe-diagnosis/diagnostics/mutate.diag.js']);
  git(root, ['commit', '-qm', 'fixture']);
  const report = await runCompletionDiagnostics(root, { persist: false });
  assert.equal(report.completion.eligible, false);
  assert.ok(report.completion.reasons.includes('WORKSPACE_CHANGED_DURING_DIAGNOSTICS'));
});

test('explicit blockers and mixed live evidence cannot report safe states', () => {
  const report = summarizeResults([{ id: 'high-release', status: 'ERROR', severity: 'HIGH', blocksRelease: true, blocksLiveTrading: false, gateDeclarations: { release: true, liveTrading: false }, scope: 'RELEASE', evidence: [] }]);
  assert.equal(report.gates.releaseStatus, 'RELEASE_BLOCKED');
  const failed = summarizeEvidence([{ status: 'ERROR', evidence: [{ type: 'RUNTIME', freshness: 'FRESH', live: true }] }]);
  assert.equal(failed.liveEvidenceStatus, 'FAILED');
  const mixed = summarizeEvidence([
    { status: 'OK', evidence: [{ type: 'RUNTIME', freshness: 'FRESH', live: true }] },
    { status: 'OK', evidence: [{ type: 'DATA', freshness: 'STALE', live: true }] },
  ]);
  assert.notEqual(mixed.liveEvidenceStatus, 'VERIFIED');
});

test('Korean legacy agent rules are replaced instead of retained', () => {
  const legacy = `## Vibe Diagnosis 규칙 (자가진단 가이드라인)\n\n- 실패하면 heal_all로 자동수리\n- 완료 시 open_dashboard 필수\n`;
  const updated = upsertRules(legacy);
  assert.match(updated, /vibe-diagnosis-rules:start/);
  assert.doesNotMatch(updated, /heal_all|open_dashboard 필수/);
  assert.equal((updated.match(/^## Vibe Diagnosis/gm) || []).length, 1);
});

test('normal diagnostic runs do not replace the latest completion receipt', async t => {
  const root = project('vibe-completion-receipt-');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  okDiagnostic(root);
  const completed = await runCompletionDiagnostics(root, { persist: true });
  await runDiagnosticsReport(root, { persist: true });
  const saved = JSON.parse(fs.readFileSync(path.join(root, '.vibe-diagnosis', 'runs', 'latest-completion.json'), 'utf8'));
  assert.equal(saved.runId, completed.runId);
  assert.equal(verifyCompletionReceipt(root, saved.completion.receipt).valid, true);
});

test('repair application conflicts before changing files when diagnostics own the project lock', async t => {
  const root = project('vibe-repair-lock-');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const target = path.join(root, 'view.js');
  fs.writeFileSync(target, 'current');
  fs.writeFileSync(`${target}.bak`, 'restored');
  const created = await autoRevertOrRepairOmission(root, 'view.js');
  const owner = acquireDiagnosticsLock(root, { executionKind: 'diagnostics' });
  t.after(() => owner.release());
  await assert.rejects(
    applyRepairPlan(root, created.plan.id, { approved: true, approvedChecksum: created.plan.integrity.checksum }),
    error => error.code === ERROR_CODE,
  );
  assert.equal(fs.readFileSync(target, 'utf8'), 'current');
  const saved = JSON.parse(fs.readFileSync(path.join(root, '.vibe-diagnosis', 'repair-plans', `${created.plan.id}.json`), 'utf8'));
  assert.equal(saved.status, 'PENDING_APPROVAL');
});

test('plain CLI run remains dashboard-independent', t => {
  const root = project('vibe-cli-no-dashboard-');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  okDiagnostic(root);
  const result = spawnSync(process.execPath, [path.join(__dirname, '..', 'bin', 'vibe-diag.js'), 'run', '--cwd', root], { encoding: 'utf8', windowsHide: true, timeout: 10000 });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.existsSync(path.join(root, '.vibe-diagnosis', 'active_port.json')), false);
});

test('build safety and Gemini BYOK do not make false or URL-secret claims', async t => {
  const root = project('vibe-build-not-evaluated-');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'package.json'), '{"scripts":{}}');
  const result = await verifyBuildSafety(root);
  assert.equal(result.success, null);
  assert.equal(result.status, 'NOT_EVALUATED');
  assert.equal(PROVIDERS.gemini.buildChatUrl('gemini-test', 'secret-key').includes('secret-key'), false);
  assert.equal(PROVIDERS.gemini.buildHeaders('secret-key')['x-goog-api-key'], 'secret-key');
});

test('diagnostic audit reports missing declared files and dependencies', t => {
  const root = project('vibe-audit-contract-');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const diagnostic = path.join(root, '.vibe-diagnosis', 'diagnostics', 'audit.diag.js');
  fs.writeFileSync(diagnostic, "module.exports={id:'audit',name:'audit',files:['missing.js'],dependencies:['missing-diagnostic'],async run(){return {status:'OK'}}};\n");
  const report = auditDiagnostics(root, [diagnostic]);
  assert.deepEqual(report.diagnostics[0].missingReferences, ['missing.js']);
  assert.deepEqual(report.diagnostics[0].missingDependencies, ['missing-diagnostic']);
  assert.equal(report.totals.missingReferences, 1);
  assert.equal(report.totals.missingDependencies, 1);
});
