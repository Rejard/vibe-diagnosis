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
  files: ['src/runner.js', 'src/diagnostic-executor.js', 'src/run-summary.js', 'src/assertions.js', 'src/rules-injector.js', 'src/dashboard-control.js', 'mcp-server/index.js'],
  cache: true,
  async run({ projectDir }) {
    const runner = require(path.join(projectDir, 'src', 'runner'));
    const schema = require(path.join(projectDir, 'src', 'schema'));
    const summary = require(path.join(projectDir, 'src', 'run-summary'));
    const assertions = require(path.join(projectDir, 'src', 'assertions'));
    const repairer = require(path.join(projectDir, 'src', 'repairer'));
    const dashboardControl = require(path.join(projectDir, 'src', 'dashboard-control'));
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
    ];
    const missing = required.filter(([owner, name]) => typeof owner[name] !== 'function').map(([, name]) => name);
    if (missing.length) return { status: 'ERROR', details: `Missing V1.6 contracts: ${missing.join(', ')}` };
    const gate = summary.summarizeResults([{ id: 'critical', status: 'ERROR', severity: 'CRITICAL', blocksRelease: true, blocksLiveTrading: false, scope: 'RELEASE', evidence: [] }]);
    if (gate.gates.releaseStatus !== 'RELEASE_BLOCKED') return { status: 'ERROR', details: 'Critical release blocker was not enforced.' };
    return {
      status: 'OK',
      details: 'Isolated runner, evidence summary, semantic assertions, and approval-first repair contracts are available.',
      evidence: [{ type: 'TEST', summary: 'V1.6 public contracts loaded and release gate behavior executed.', verifiedAt: new Date().toISOString() }],
    };
  },
};
