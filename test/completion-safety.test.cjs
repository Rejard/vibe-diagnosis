const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { withDiagnosticsLock, acquireDiagnosticsLock } = require('../src/diagnostics-lock');
const { runCompletionDiagnostics } = require('../src/runner');
const { verifyCompletionReceipt } = require('../src/completion-receipt');
const { summarizeResults } = require('../src/run-summary');
const { shapeReport } = require('../src/report-view');
const { captureEnvironment } = require('../src/environment');
const { compareEnvironments } = require('../src/workspace-changes');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-completion-safety-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, '.vibe-diagnosis/diagnostics'), { recursive: true });
  fs.writeFileSync(path.join(root, '.gitignore'), '.vibe-diagnosis/\n');
  execFileSync('git', ['init', '-q'], { cwd: root, windowsHide: true });
  execFileSync('git', ['add', '.gitignore'], { cwd: root, windowsHide: true });
  execFileSync('git', ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'fixture'], { cwd: root, windowsHide: true });
  return root;
}

function diagnostic(root, body = '') {
  fs.writeFileSync(path.join(root, '.vibe-diagnosis/diagnostics/ok.diag.js'), `module.exports={id:'ok',name:'ok',layer:'TASK',async run(){${body};return {status:'OK'}}}`);
}

test('waiting completions run fresh suites with distinct receipts after the owner releases', async t => {
  const root = fixture(t);
  diagnostic(root);
  const owner = acquireDiagnosticsLock(root);
  t.after(() => owner.release());
  const first = runCompletionDiagnostics(root, { waitTimeoutMs: 5000, persist: false });
  const second = runCompletionDiagnostics(root, { waitTimeoutMs: 5000, persist: false });
  owner.release();
  const [a, b] = await Promise.all([first, second]);
  assert.equal(a.completion.eligible, true);
  assert.equal(b.completion.eligible, true);
  assert.notEqual(a.runId, b.runId);
  assert.ok(Date.parse(b.startedAt) >= Date.parse(a.finishedAt));
  assert.equal(verifyCompletionReceipt(root, b.completion.receipt, { expectedRunId: a.runId }).valid, false);
  assert.equal(verifyCompletionReceipt(root, b.completion.receipt, { expectedRunId: b.runId }).valid, true);
});

test('wait timeout and cancellation never execute the waiter or release the owner', async t => {
  const root = fixture(t);
  const owner = acquireDiagnosticsLock(root);
  t.after(() => owner.release());
  let executions = 0;
  const operation = () => { executions++; };
  await assert.rejects(withDiagnosticsLock(root, { waitTimeoutMs: 30 }, operation), { code: 'DIAGNOSTICS_WAIT_TIMEOUT' });
  const controller = new AbortController();
  const pending = withDiagnosticsLock(root, { waitTimeoutMs: 1000, signal: controller.signal }, operation);
  controller.abort();
  await assert.rejects(pending, { code: 'DIAGNOSTICS_WAIT_CANCELLED' });
  await assert.rejects(withDiagnosticsLock(root, { signal: controller.signal }, operation), { code: 'DIAGNOSTICS_WAIT_CANCELLED' });
  assert.throws(() => acquireDiagnosticsLock(root), { code: 'DIAGNOSTICS_ALREADY_RUNNING' });
  assert.equal(executions, 0);
  owner.release();
  await withDiagnosticsLock(root, {}, operation);
  assert.equal(executions, 1);
});

for (const file of ['source.js', 'unrelated-notes.md', 'package-lock.json', '.vibe-diagnosis/config.json', '.vibe-diagnosis/diagnostics/helper.js']) {
  test(`completion blocks and identifies changes to ${file}`, async t => {
    const root = fixture(t);
    fs.writeFileSync(path.join(root, file), 'original');
    const target = JSON.stringify(path.join(root, file));
    diagnostic(root, `require('fs').writeFileSync(${target},'changed')`);
    const report = await runCompletionDiagnostics(root, { persist: false });
    assert.equal(report.summary.error, 0);
    assert.equal(report.completion.eligible, false);
    assert.ok(report.completion.reasons.includes('WORKSPACE_CHANGED_DURING_DIAGNOSTICS'));
    const changes = shapeReport(report, 'summary').completion.workspaceChanges;
    assert.ok(changes.changedFiles.some(item => item.file === file && item.change === 'MODIFIED'));
    assert.equal(changes.action, 'RERUN_AFTER_WORKSPACE_STABILIZES');
    assert.ok(verifyCompletionReceipt(root, report.completion.receipt).reasons.includes('INELIGIBLE_COMPLETION'));
    assert.equal(JSON.stringify(report).includes('fileState'), false);
  });
}

test('ignored diagnostic code changes invalidate a previously eligible receipt', async t => {
  const root = fixture(t);
  diagnostic(root);
  const report = await runCompletionDiagnostics(root, { persist: false });
  assert.equal(report.completion.eligible, true);
  diagnostic(root, 'await Promise.resolve()');
  assert.ok(verifyCompletionReceipt(root, report.completion.receipt).reasons.includes('STALE_WORKSPACE'));
});

test('policy changes during diagnostics block completion even when ignored by Git', async t => {
  const root = fixture(t);
  const target = JSON.stringify(path.join(root, '.vibe-diagnosis/diagnostic-policy.local.json'));
  diagnostic(root, `require('fs').writeFileSync(${target},JSON.stringify({schemaVersion:1,diagnostics:{ok:{state:'DISABLED',reason:'changed'}}}))`);
  const report = await runCompletionDiagnostics(root, { persist: false });
  assert.equal(report.completion.eligible, false);
  assert.ok(report.completion.reasons.includes('DIAGNOSTIC_POLICY_CHANGED_DURING_DIAGNOSTICS'));
});

test('file inventory changes are fingerprint-bound and distinguish additions and deletions', t => {
  const root = fixture(t);
  const original = captureEnvironment(root);
  fs.writeFileSync(path.join(root, '한글 파일.js'), 'new');
  const added = captureEnvironment(root);
  assert.notEqual(original.fingerprint, added.fingerprint);
  assert.deepEqual(compareEnvironments(original, added).changedFiles.map(item => [item.file, item.change]), [['한글 파일.js', 'ADDED']]);
  fs.unlinkSync(path.join(root, '.gitignore'));
  const deleted = captureEnvironment(root);
  assert.ok(compareEnvironments(added, deleted).changedFiles.some(item => item.file === '.gitignore' && item.change === 'DELETED'));
});

test('static passing gates do not become live evidence; live observations retain limited scope', () => {
  const result = { id: 'check', status: 'OK', gateDeclarations: { liveTrading: true }, evidence: [{ type: 'TEST', freshness: 'FRESH', live: false }] };
  const staticReport = summarizeResults([result]);
  assert.equal(staticReport.gates.liveTradingStatus, 'LIVE_ALLOWED');
  assert.equal(staticReport.gates.liveDiagnosticGateStatus, 'PASSED');
  assert.equal(staticReport.evidenceSummary.liveEvidenceStatus, 'UNVERIFIED');
  const liveReport = summarizeResults([{ ...result, evidence: [{ type: 'RUNTIME', freshness: 'FRESH', live: true }] }]);
  assert.equal(liveReport.evidenceSummary.liveEvidenceStatus, 'VERIFIED');
  assert.match(liveReport.evidenceSummary.interpretation, /not overall operational readiness/);
});
