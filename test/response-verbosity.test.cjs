const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { shapeReport, normalizeVerbosity, VERBOSITY_LEVELS, DEFAULT_VERBOSITY } = require('../src/report-view');

function passingResult(index) {
  return {
    id: `pass-${index}`,
    name: `Passing diagnostic ${index}`,
    layer: 'SYSTEM',
    status: 'OK',
    classification: null,
    details: 'x'.repeat(400),
    executionState: 'EXECUTED',
    startedAt: '2026-08-19T00:00:00.000Z',
    finishedAt: '2026-08-19T00:00:01.000Z',
    durationMs: 1000,
    duration: 1000,
    severity: 'LOW',
    scope: 'GENERAL',
    evidenceType: 'TEST',
    blocksRelease: false,
    blocksLiveTrading: false,
    tags: [],
    dependencies: [],
    files: [],
    evidence: [{ type: 'TEST', summary: 'y'.repeat(200), freshness: 'FRESH', live: false }],
    execution: { exitCode: 0, signal: null, timedOut: false, stdout: 'z'.repeat(1000), stderr: '' },
  };
}

function failingResult(index) {
  return {
    ...passingResult(index),
    id: `fail-${index}`,
    name: `Failing diagnostic ${index}`,
    status: 'ERROR',
    classification: 'TEST_FAILURE',
    details: 'assertion failed: expected 3 to equal 4',
    blocksRelease: true,
    execution: { exitCode: 1, signal: null, timedOut: false, stdout: '', stderr: 'E'.repeat(50000) },
    error: { message: 'expected 3 to equal 4', stack: 'S'.repeat(20000) },
  };
}

function skippedEntry(index) {
  return {
    id: `skip-${index}`,
    name: `Skipped diagnostic ${index}`,
    diagnosticNecessity: 2,
    necessityReason: 'w'.repeat(200),
    state: 'ENABLED',
    reason: null,
    until: null,
    skipReason: 'PRIORITY_NOT_DUE',
    executionState: 'NOT_EXECUTED',
    startedAt: null,
    finishedAt: null,
    durationMs: null,
  };
}

function syntheticReport({ passing = 0, failing = 0, skipped = 0 } = {}) {
  const results = [
    ...Array.from({ length: failing }, (unused, index) => failingResult(index)),
    ...Array.from({ length: passing }, (unused, index) => passingResult(index)),
  ];
  return {
    schemaVersion: 4,
    runId: '2026-08-19T00-00-00-000Z-abcdef',
    startedAt: '2026-08-19T00:00:00.000Z',
    finishedAt: '2026-08-19T00:01:00.000Z',
    durationMs: 60000,
    totalDurationMs: 60000,
    projectDir: '/tmp/project',
    selected: results.length,
    discovered: results.length + skipped,
    filteredOut: 0,
    selectionMode: 'AUTO',
    filters: {},
    environment: {
      git: {
        sha: 'abc123',
        branch: 'main',
        dirty: true,
        changedFiles: Array.from({ length: 120 }, (unused, index) => `src/changed-${index}.js`),
        workspaceFingerprint: 'w1',
        protectedWorkspaceFingerprint: 'p1',
        protectedFiles: Array.from({ length: 30 }, (unused, index) => `.env.${index}`),
      },
      environment: { node: 'v20.0.0', platform: 'win32', arch: 'x64', cwd: '/tmp/project' },
      fingerprint: 'f1',
    },
    policy: { fingerprint: 'pf1', defaultNecessity: 4, skipped, removed: 0, skipReasons: skipped ? { PRIORITY_NOT_DUE: skipped } : {} },
    skippedDiagnostics: Array.from({ length: skipped }, (unused, index) => skippedEntry(index)),
    removedDiagnostics: [],
    results,
    summary: { total: results.length, ok: passing, warning: 0, error: failing, flaky: 0 },
    overallStatus: failing ? 'RELEASE_BLOCKED' : 'OK',
    healthPercent: results.length ? Number(((passing / results.length) * 100).toFixed(2)) : 100,
    gates: {
      releaseStatus: failing ? 'RELEASE_BLOCKED' : 'RELEASE_ALLOWED',
      liveTradingStatus: 'NOT_EVALUATED',
      releaseBlockedBy: Array.from({ length: failing }, (unused, index) => `fail-${index}`),
      liveBlockedBy: [],
      coverage: { release: true, liveTrading: false },
    },
    evidenceSummary: { byType: { TEST: { total: results.length, fresh: results.length, stale: 0, unknown: 0 } }, liveEvidenceStatus: 'UNVERIFIED', coverage: { diagnosticsWithEvidence: results.length, totalDiagnostics: results.length, percent: 100, status: 'COMPLETE' } },
    domains: { GENERAL: { total: results.length, ok: passing, warning: 0, error: failing } },
    rootCauseGroups: Array.from({ length: failing }, (unused, index) => ({ id: `root-${index}`, classification: 'TEST_FAILURE', diagnostics: [`fail-${index}`], summary: 'E'.repeat(200) })),
    runFile: '/tmp/project/.vibe-diagnosis/runs/run.json',
  };
}

test('the default verbosity is summary and unknown values fall back to it', () => {
  assert.deepEqual(VERBOSITY_LEVELS, ['summary', 'list', 'full']);
  assert.equal(DEFAULT_VERBOSITY, 'summary');
  assert.equal(normalizeVerbosity(undefined), 'summary');
  assert.equal(normalizeVerbosity('verbose'), 'summary');
  assert.equal(normalizeVerbosity('full'), 'full');
  const report = syntheticReport({ passing: 5, failing: 1 });
  assert.deepEqual(shapeReport(report, 'verbose'), shapeReport(report, 'summary'));
});

test('summary keeps every decision field and drops passing diagnostics', () => {
  const report = syntheticReport({ passing: 40, failing: 2, skipped: 7 });
  const shaped = shapeReport(report, 'summary');
  for (const key of ['schemaVersion', 'runId', 'startedAt', 'finishedAt', 'durationMs', 'totalDurationMs', 'projectDir', 'selected', 'discovered', 'filteredOut', 'selectionMode', 'filters', 'policy', 'removedDiagnostics', 'summary', 'overallStatus', 'healthPercent', 'gates', 'evidenceSummary', 'domains', 'rootCauseGroups', 'runFile']) {
    assert.deepEqual(shaped[key], report[key], `summary must keep ${key}`);
  }
  assert.equal(shaped.results.length, 2);
  assert.ok(shaped.results.every(result => result.status !== 'OK'));
  assert.equal('skippedDiagnostics' in shaped, false);
  assert.equal(shaped.response.verbosity, 'summary');
  assert.deepEqual(shaped.response.results, { failing: 2, passing: 40, failingDetail: 'FULL', passingDetail: 'OMITTED' });
  assert.deepEqual(shaped.response.skippedDiagnostics, { total: 7, detail: 'OMITTED' });
  assert.equal(shaped.environment.git.changedFileCount, 120);
  assert.equal(shaped.environment.git.protectedFileCount, 30);
  assert.equal(shaped.environment.git.changedFiles, undefined);
  assert.equal(shaped.environment.fingerprint, report.environment.fingerprint);
  assert.equal(shaped.environment.git.workspaceFingerprint, report.environment.git.workspaceFingerprint);
});

test('summary carries every failing diagnostic without reducing any of it', () => {
  const report = syntheticReport({ passing: 300, failing: 9 });
  const shaped = shapeReport(report, 'summary');
  const expected = report.results.filter(result => result.status !== 'OK');
  assert.equal(shaped.results.length, 9);
  assert.deepEqual(shaped.results, expected);
  for (const result of shaped.results) {
    assert.equal(result.execution.stderr.length, 50000);
    assert.equal(result.error.stack.length, 20000);
  }
});

test('a WARNING result is a failure for shaping purposes and stays in summary', () => {
  const report = syntheticReport({ passing: 3, failing: 0 });
  report.results.push({ ...passingResult(99), id: 'warn-1', status: 'WARNING', classification: 'FLAKY', details: 'passed on isolated retry' });
  report.summary = { total: 4, ok: 3, warning: 1, error: 0, flaky: 1 };
  const shaped = shapeReport(report, 'summary');
  assert.deepEqual(shaped.results.map(result => result.id), ['warn-1']);
  assert.equal(shaped.results[0].details, 'passed on isolated retry');
});

test('summary response size does not grow with the number of passing diagnostics', () => {
  const small = JSON.stringify(shapeReport(syntheticReport({ passing: 10 }), 'summary'));
  const large = JSON.stringify(shapeReport(syntheticReport({ passing: 1000 }), 'summary'));
  assert.ok(Math.abs(large.length - small.length) < 100, `summary grew by ${large.length - small.length} characters for 990 extra passing diagnostics`);
  const full = JSON.stringify(syntheticReport({ passing: 1000 }));
  assert.ok(large.length < full.length / 50, `summary is ${large.length} characters against a full report of ${full.length}`);
  const list = JSON.stringify(shapeReport(syntheticReport({ passing: 1000 }), 'list'));
  assert.ok(list.length > large.length * 5, 'list must actually carry the passing rows the summary omits');
  assert.ok(list.length < full.length / 5, 'list must stay far below the full report');
});

test('summary grows only when failures grow', () => {
  const clean = JSON.stringify(shapeReport(syntheticReport({ passing: 1000 }), 'summary')).length;
  const oneFailure = JSON.stringify(shapeReport(syntheticReport({ passing: 1000, failing: 1 }), 'summary')).length;
  const threeFailures = JSON.stringify(shapeReport(syntheticReport({ passing: 1000, failing: 3 }), 'summary')).length;
  assert.ok(oneFailure > clean, 'a failure must be visible in the summary');
  assert.ok(threeFailures > oneFailure * 2, 'every failure must be carried, not sampled');
});

test('list adds passing and skipped rows limited to identity, state, and duration', () => {
  const report = syntheticReport({ passing: 4, failing: 1, skipped: 2 });
  const shaped = shapeReport(report, 'list');
  assert.equal(shaped.results.length, 5);
  assert.deepEqual(shaped.results[0], report.results[0]);
  const rows = shaped.results.slice(1);
  assert.deepEqual(rows.map(row => row.id), ['pass-0', 'pass-1', 'pass-2', 'pass-3']);
  for (const row of rows) {
    assert.deepEqual(Object.keys(row).sort(), ['durationMs', 'executionState', 'id', 'name', 'status']);
    assert.equal(row.status, 'OK');
    assert.equal(row.durationMs, 1000);
  }
  assert.equal(shaped.skippedDiagnostics.length, 2);
  assert.deepEqual(Object.keys(shaped.skippedDiagnostics[0]).sort(), ['executionState', 'id', 'name', 'skipReason', 'state']);
  assert.deepEqual(shaped.response.results, { failing: 1, passing: 4, failingDetail: 'FULL', passingDetail: 'ID_NAME_DURATION' });
  assert.deepEqual(shaped.response.skippedDiagnostics, { total: 2, detail: 'ID_NAME_REASON' });
  assert.equal(shaped.environment.git.changedFiles, undefined);
});

test('full returns the report unchanged and adds no shaping metadata', () => {
  const report = syntheticReport({ passing: 6, failing: 2, skipped: 3 });
  const before = JSON.parse(JSON.stringify(report));
  const shaped = shapeReport(report, 'full');
  assert.deepEqual(shaped, before);
  assert.equal(shaped.response, undefined);
  assert.equal(shaped.results.length, 8);
  assert.equal(shaped.skippedDiagnostics.length, 3);
  assert.equal(shaped.environment.git.changedFiles.length, 120);
});

test('shaping never mutates the report that was persisted to disk', () => {
  const report = syntheticReport({ passing: 5, failing: 1, skipped: 2 });
  const before = JSON.parse(JSON.stringify(report));
  shapeReport(report, 'summary');
  shapeReport(report, 'list');
  assert.deepEqual(report, before);
});

function project() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-verbosity-'));
  const diagnostics = path.join(root, '.vibe-diagnosis', 'diagnostics');
  fs.mkdirSync(diagnostics, { recursive: true });
  const longDetails = 'd'.repeat(500);
  fs.writeFileSync(path.join(diagnostics, 'good.diag.js'), `module.exports={id:'good',name:'good',layer:'TASK',async run(){return {status:'OK',details:'${longDetails}'}}}`, 'utf8');
  fs.writeFileSync(path.join(diagnostics, 'bad.diag.js'), `module.exports={id:'bad',name:'bad',layer:'TASK',blocksRelease:true,async run(){return {status:'ERROR',details:'the balance check failed'}}}`, 'utf8');
  fs.writeFileSync(path.join(diagnostics, 'later.diag.js'), `module.exports={id:'later',name:'later',layer:'TASK',diagnosticNecessity:2,necessityReason:'optional',files:['src/untouched.js'],async run(){return {status:'OK'}}}`, 'utf8');
  return root;
}

function callMcpTool(tool, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(__dirname, '..', 'mcp-server', 'index.js')], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    let buffer = '';
    let stderr = '';
    const timer = setTimeout(() => { child.kill(); reject(new Error(`MCP timeout: ${stderr}`)); }, 30000);
    child.stderr.on('data', data => { stderr += data; });
    child.stdout.on('data', data => {
      buffer += data;
      let newline;
      while ((newline = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        if (!line.trim()) continue;
        const message = JSON.parse(line);
        if (message.id === 1) {
          child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
          child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: tool, arguments: args } }) + '\n');
        } else if (message.id === 2) {
          clearTimeout(timer);
          child.kill();
          resolve(message.result);
        }
      }
    });
    child.on('error', reject);
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'verbosity-test', version: '1.0.0' } } }) + '\n');
  });
}

test('run_diagnostics answers with the failure and omits the pass by default', async t => {
  const root = project();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const shaped = JSON.parse((await callMcpTool('run_diagnostics', { projectDir: root })).content[0].text);
  assert.equal(shaped.response.verbosity, 'summary');
  assert.deepEqual(shaped.results.map(result => result.id), ['bad']);
  assert.equal(shaped.results[0].details, 'the balance check failed');
  assert.equal(shaped.summary.ok, 1);
  assert.equal(shaped.summary.error, 1);
  assert.equal(shaped.gates.releaseStatus, 'RELEASE_BLOCKED');
  assert.ok(shaped.runFile);
  assert.equal('skippedDiagnostics' in shaped, false);
  assert.equal(shaped.response.results.passing, 1);
  assert.equal(shaped.response.skippedDiagnostics.total, 1);

  const listed = JSON.parse((await callMcpTool('run_diagnostics', { projectDir: root, verbosity: 'list' })).content[0].text);
  assert.deepEqual(listed.results.map(result => result.id).sort(), ['bad', 'good']);
  const passRow = listed.results.find(result => result.id === 'good');
  assert.deepEqual(Object.keys(passRow).sort(), ['durationMs', 'executionState', 'id', 'name', 'status']);
  assert.ok(Number.isFinite(passRow.durationMs));
  assert.deepEqual(listed.skippedDiagnostics.map(item => item.id), ['later']);

  const full = JSON.parse((await callMcpTool('run_diagnostics', { projectDir: root, verbosity: 'full' })).content[0].text);
  assert.equal(full.response, undefined);
  assert.deepEqual(full.results.map(result => result.id).sort(), ['bad', 'good']);
  assert.ok(full.results.find(result => result.id === 'good').details.length >= 500);
  assert.ok(Array.isArray(full.environment.git.changedFiles));

  const fullLength = JSON.stringify(full).length;
  const summaryLength = JSON.stringify(shaped).length;
  assert.ok(summaryLength < fullLength, `summary ${summaryLength} must be smaller than full ${fullLength}`);
});

test('complete_task_diagnostics keeps the completion decision and receipt at summary verbosity', async t => {
  const root = project();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const shaped = JSON.parse((await callMcpTool('complete_task_diagnostics', { projectDir: root })).content[0].text);
  assert.equal(shaped.response.verbosity, 'summary');
  assert.equal(shaped.completion.eligible, false);
  assert.deepEqual(shaped.completion.reasons, ['DIAGNOSTIC_FAILURES', 'RELEASE_BLOCKED']);
  assert.ok(shaped.completion.receipt.checksum);
  assert.deepEqual(shaped.results.map(result => result.id), ['bad']);
  assert.equal(shaped.completionEnvironment.git.changedFiles, undefined);
  assert.ok(shaped.completionEnvironment.fingerprint);
  assert.ok(shaped.agentIntegration);

  const full = JSON.parse((await callMcpTool('complete_task_diagnostics', { projectDir: root, verbosity: 'full' })).content[0].text);
  assert.equal(full.response, undefined);
  assert.equal(full.completion.eligible, false);
  assert.deepEqual(full.results.map(result => result.id).sort(), ['bad', 'good']);
});
