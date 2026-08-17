const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { validateDiagnosticModule } = require('../src/schema');
const { inspectDiagnosticSource } = require('../src/selector');
const { runDiagnosticsReport, runCompletionDiagnostics, discoverDiagnostics } = require('../src/runner');
const { verifyCompletionReceipt } = require('../src/completion-receipt');
const {
  loadDiagnosticPolicy,
  setDiagnosticState,
  removeDiagnostic,
  restoreDiagnostic,
} = require('../src/diagnostic-policy');

function project() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-policy-'));
  fs.mkdirSync(path.join(root, '.vibe-diagnosis', 'diagnostics'), { recursive: true });
  return root;
}

function diagnostic(root, filename, { id = filename, stars, files = [] } = {}) {
  const necessity = stars === undefined ? '' : `diagnosticNecessity:${stars},necessityReason:'fixture policy',`;
  const source = `module.exports={id:'${id}',name:'${id}',layer:'TASK',${necessity}files:${JSON.stringify(files)},async run(){return {status:'OK',details:'checked'}}};\n`;
  const target = path.join(root, '.vibe-diagnosis', 'diagnostics', `${filename}.diag.js`);
  fs.writeFileSync(target, source, 'utf8');
  return target;
}

test('diagnostic necessity is validated and legacy diagnostics default to four stars', t => {
  const root = project();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const legacy = diagnostic(root, 'legacy');
  assert.equal(inspectDiagnosticSource(legacy).diagnosticNecessity, 4);
  assert.equal(validateDiagnosticModule({ id: 'x', name: 'x', layer: 'TASK', diagnosticNecessity: 5, necessityReason: 'silent UI regression', run() {} }, 'x').valid, true);
  const missingReason = validateDiagnosticModule({ id: 'x', name: 'x', layer: 'TASK', diagnosticNecessity: 5, run() {} }, 'x');
  assert.equal(missingReason.valid, false);
  assert.match(missingReason.errors.join(' '), /necessityReason/);
  assert.equal(validateDiagnosticModule({ id: 'x', name: 'x', layer: 'TASK', diagnosticNecessity: 6, necessityReason: 'invalid', run() {} }, 'x').valid, false);
});

test('automatic runs execute routine checks and transparently skip optional checks', async t => {
  const root = project();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  diagnostic(root, 'required', { stars: 5 });
  diagnostic(root, 'optional', { stars: 1 });
  const automatic = await runDiagnosticsReport(root, { persist: false, compareBaseline: false, selectionMode: 'AUTO' });
  assert.deepEqual(automatic.results.map(item => item.id), ['required']);
  assert.equal(automatic.skippedDiagnostics[0].id, 'optional');
  assert.equal(automatic.skippedDiagnostics[0].skipReason, 'PRIORITY_NOT_DUE');
  const full = await runDiagnosticsReport(root, { persist: false, compareBaseline: false, selectionMode: 'FULL' });
  assert.deepEqual(full.results.map(item => item.id).sort(), ['optional', 'required']);
});

test('skip once is consumed and a disabled five-star check blocks completion', async t => {
  const root = project();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  diagnostic(root, 'required', { stars: 5 });
  setDiagnosticState(root, 'required', 'SKIP_ONCE', { reason: 'known temporary outage' });
  const skipped = await runDiagnosticsReport(root, { persist: false, compareBaseline: false, selectionMode: 'AUTO' });
  assert.equal(skipped.results.length, 0);
  assert.equal(skipped.skippedDiagnostics[0].skipReason, 'SKIP_ONCE');
  assert.equal(loadDiagnosticPolicy(root).diagnostics.required, undefined);
  const next = await runDiagnosticsReport(root, { persist: false, compareBaseline: false, selectionMode: 'AUTO' });
  assert.equal(next.results[0].id, 'required');
  setDiagnosticState(root, 'required', 'DISABLED', { reason: 'explicitly deferred' });
  const completion = await runCompletionDiagnostics(root, { persist: false });
  assert.equal(completion.completion.eligible, false);
  assert.ok(completion.completion.reasons.includes('REQUIRED_DIAGNOSTICS_SKIPPED'));
  assert.deepEqual(completion.completion.requiredSkipped, ['required']);
});

test('completion receipts are bound to the current diagnostic policy', async t => {
  const root = project();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  diagnostic(root, 'routine', { stars: 4 });
  const completion = await runCompletionDiagnostics(root, { persist: false });
  assert.equal(verifyCompletionReceipt(root, completion.completion.receipt).valid, true);
  setDiagnosticState(root, 'routine', 'DISABLED', { reason: 'fixture change' });
  const stale = verifyCompletionReceipt(root, completion.completion.receipt);
  assert.equal(stale.valid, false);
  assert.ok(stale.reasons.includes('STALE_DIAGNOSTIC_POLICY'));
});

test('diagnostics are removed recoverably and restored to the original path', t => {
  const root = project();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const file = diagnostic(root, 'recoverable', { stars: 2 });
  const descriptor = inspectDiagnosticSource(file);
  const removed = removeDiagnostic(root, descriptor, { confirmed: true, reason: 'not applicable to this project' });
  assert.equal(fs.existsSync(file), false);
  assert.equal(discoverDiagnostics(root).length, 0);
  assert.equal(fs.existsSync(path.join(root, removed.trashFile)), true);
  assert.equal(loadDiagnosticPolicy(root).removed.length, 1);
  const restored = restoreDiagnostic(root, 'recoverable');
  assert.ok(restored.restoredAt);
  assert.equal(fs.existsSync(file), true);
  assert.equal(loadDiagnosticPolicy(root).removed.length, 0);
});

test('snoozing requires a future date and all exclusions require a reason', t => {
  const root = project();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  diagnostic(root, 'policy');
  assert.throws(() => setDiagnosticState(root, 'policy', 'DISABLED'), /reason/);
  assert.throws(() => setDiagnosticState(root, 'policy', 'SNOOZED', { reason: 'later', until: '2020-01-01T00:00:00.000Z' }), /future ISO date/);
  assert.throws(() => removeDiagnostic(root, inspectDiagnosticSource(discoverDiagnostics(root)[0]), { confirmed: false, reason: 'later' }), /confirmation/);
});
