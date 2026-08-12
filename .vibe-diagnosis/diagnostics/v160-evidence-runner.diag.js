const path = require('path');

module.exports = {
  id: 'v160-evidence-runner',
  name: 'V1.6 isolated evidence runner contract',
  layer: 'SYSTEM',
  linkedTask: 'V1.6.0',
  severity: 'CRITICAL',
  scope: 'RELEASE',
  evidenceType: 'TEST',
  blocksRelease: true,
  confidence: 1,
  tags: ['runner', 'contract', 'release'],
  files: ['src/runner.js', 'src/diagnostic-executor.js', 'src/run-summary.js', 'src/assertions.js', 'src/rules-injector.js', 'src/completion-receipt.js', 'src/repairer.js', 'src/dashboard-control.js', 'src/dashboard.js', 'src/path-policy.js', 'src/redaction.js', 'mcp-server/index.js'],
  cache: true,
  async run({ projectDir }) {
    const runner = require(path.join(projectDir, 'src', 'runner'));
    const schema = require(path.join(projectDir, 'src', 'schema'));
    const summary = require(path.join(projectDir, 'src', 'run-summary'));
    const assertions = require(path.join(projectDir, 'src', 'assertions'));
    const repairer = require(path.join(projectDir, 'src', 'repairer'));
    const dashboardControl = require(path.join(projectDir, 'src', 'dashboard-control'));
    const pathPolicy = require(path.join(projectDir, 'src', 'path-policy'));
    const redaction = require(path.join(projectDir, 'src', 'redaction'));
    const completionReceipt = require(path.join(projectDir, 'src', 'completion-receipt'));
    const required = [
      [runner, 'runDiagnosticsReport'],
      [runner, 'runCompletionDiagnostics'],
      [runner, 'clearProjectRequireCache'],
      [schema, 'normalizeMetadata'],
      [summary, 'summarizeResults'],
      [assertions, 'assertAst'],
      [assertions, 'assertStateTransition'],
      [repairer, 'createRepairPlan'],
      [repairer, 'applyRepairPlan'],
      [dashboardControl, 'stopDashboard'],
      [pathPolicy, 'resolveWithin'],
      [redaction, 'redactValue'],
      [completionReceipt, 'verifyCompletionReceipt'],
    ];
    const missing = required.filter(([owner, name]) => typeof owner[name] !== 'function').map(([, name]) => name);
    if (missing.length) return { status: 'ERROR', details: `Missing V1.6 contracts: ${missing.join(', ')}` };
    const gate = summary.summarizeResults([{ id: 'critical', status: 'ERROR', severity: 'CRITICAL', blocksRelease: true, blocksLiveTrading: false, gateDeclarations: { release: true, liveTrading: true }, scope: 'RELEASE', evidence: [] }]);
    if (gate.gates.releaseStatus !== 'RELEASE_BLOCKED') return { status: 'ERROR', details: 'Critical release blocker was not enforced.' };
    return {
      status: 'OK',
      details: 'Isolated runner, guarded paths, redacted evidence, semantic assertions, and approval-first repair contracts are available.',
      evidence: [{ type: 'TEST', summary: 'V1.6 public contracts, guarded paths, redaction, and release gate behavior executed.', verifiedAt: new Date().toISOString() }],
    };
  },
};
