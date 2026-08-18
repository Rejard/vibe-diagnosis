const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { runDiagnosticsReport } = require('../src/runner');
const { executeDiagnostic } = require('../src/diagnostic-executor');
const { setDiagnosticState } = require('../src/diagnostic-policy');

function project() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-timing-'));
  fs.mkdirSync(path.join(root, '.vibe-diagnosis', 'diagnostics'), { recursive: true });
  return root;
}

function writeDiagnostic(root, filename, source) {
  const target = path.join(root, '.vibe-diagnosis', 'diagnostics', filename);
  fs.writeFileSync(target, source, 'utf8');
  return target;
}

test('OK, WARNING, ERROR, exception, and timeout results persist wall-clock timing', async t => {
  const root = project();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  writeDiagnostic(root, 'ok.diag.js', "module.exports={id:'ok',name:'OK',layer:'TASK',async run(){await new Promise(r=>setTimeout(r,25));return {status:'OK'}}};");
  writeDiagnostic(root, 'warning.diag.js', "module.exports={id:'warning',name:'Warning',layer:'TASK',async run(){return {status:'WARNING',details:'warn'}}};");
  writeDiagnostic(root, 'error.diag.js', "module.exports={id:'error',name:'Error',layer:'TASK',async run(){return {status:'ERROR',details:'failed'}}};");
  writeDiagnostic(root, 'exception.diag.js', "module.exports={id:'exception',name:'Exception',layer:'TASK',async run(){throw new Error('boom')}};");
  writeDiagnostic(root, 'timeout.diag.js', "module.exports={id:'timeout',name:'Timeout',layer:'TASK',timeoutMs:100,async run(){await new Promise(r=>setTimeout(r,2000));return {status:'OK'}}};");

  const report = await runDiagnosticsReport(root, { persist: true, compareBaseline: false, retryInfrastructure: false });
  assert.equal(report.schemaVersion, 4);
  assert.ok(Number.isFinite(report.durationMs));
  assert.equal(report.totalDurationMs, report.durationMs);
  assert.ok(report.durationMs >= Math.max(...report.results.map(item => item.durationMs)));
  for (const result of report.results) {
    assert.equal(result.executionState, 'EXECUTED');
    assert.ok(Number.isFinite(Date.parse(result.startedAt)), result.id);
    assert.ok(Number.isFinite(Date.parse(result.finishedAt)), result.id);
    assert.ok(Number.isFinite(result.durationMs) && result.durationMs >= 0, result.id);
  }
  const timeout = report.results.find(item => item.id === 'timeout');
  assert.equal(timeout.classification, 'TIMEOUT');
  assert.equal(timeout.execution.timeoutMs, 100);
  assert.ok(timeout.durationMs >= 100);
  assert.equal(report.results.find(item => item.id === 'warning').status, 'WARNING');
  assert.equal(report.results.find(item => item.id === 'error').status, 'ERROR');
  assert.equal(report.results.find(item => item.id === 'exception').classification, 'RUNNER_ERROR');

  const persisted = JSON.parse(fs.readFileSync(path.join(root, '.vibe-diagnosis', 'runs', 'latest.json'), 'utf8'));
  assert.equal(persisted.durationMs, report.durationMs);
  assert.ok(persisted.results.every(item => Number.isFinite(item.durationMs)));
});

test('parallel diagnostic timing remains per-item wall clock instead of shared elapsed time', async t => {
  const root = project();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const first = writeDiagnostic(root, 'first.diag.js', "module.exports={id:'first',name:'First',layer:'TASK',async run(){await new Promise(r=>setTimeout(r,180));return {status:'OK'}}};");
  const second = writeDiagnostic(root, 'second.diag.js', "module.exports={id:'second',name:'Second',layer:'TASK',async run(){await new Promise(r=>setTimeout(r,180));return {status:'OK'}}};");
  const started = Date.now();
  const results = await Promise.all([executeDiagnostic(root, first), executeDiagnostic(root, second)]);
  const wallMs = Date.now() - started;
  assert.ok(results.every(item => item.durationMs >= 180));
  assert.ok(wallMs < results[0].durationMs + results[1].durationMs);
  assert.notEqual(results[0].startedAt, null);
  assert.notEqual(results[1].finishedAt, null);
});

test('DISABLED and SKIP_ONCE entries are persisted as not executed without a misleading 0ms', async t => {
  const root = project();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  writeDiagnostic(root, 'disabled.diag.js', "module.exports={id:'disabled',name:'Disabled',layer:'TASK',async run(){return {status:'OK'}}};");
  writeDiagnostic(root, 'skip.diag.js', "module.exports={id:'skip',name:'Skip',layer:'TASK',async run(){return {status:'OK'}}};");
  writeDiagnostic(root, 'run.diag.js', "module.exports={id:'run',name:'Run',layer:'TASK',async run(){return {status:'OK'}}};");
  setDiagnosticState(root, 'disabled', 'DISABLED', { reason: 'intentional hold' });
  setDiagnosticState(root, 'skip', 'SKIP_ONCE', { reason: 'temporary hold' });
  const report = await runDiagnosticsReport(root, { persist: true, compareBaseline: false });
  assert.equal(report.results.length, 1);
  const disabled = report.skippedDiagnostics.find(item => item.id === 'disabled');
  const skipped = report.skippedDiagnostics.find(item => item.id === 'skip');
  assert.equal(disabled.state, 'DISABLED');
  assert.equal(skipped.state, 'SKIP_ONCE');
  for (const item of [disabled, skipped]) {
    assert.equal(item.executionState, 'NOT_EXECUTED');
    assert.equal(item.durationMs, null);
    assert.equal(item.startedAt, null);
    assert.equal(item.finishedAt, null);
  }
});
