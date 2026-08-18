const path = require('path');
const { spawnSync } = require('child_process');

module.exports = {
  id: 'v171-dashboard-persistence-timing',
  name: 'V1.7.1 dashboard persistence, version refresh, and timing contract',
  layer: 'SYSTEM',
  linkedTask: 'V1.7.1',
  severity: 'CRITICAL',
  scope: 'RELEASE',
  evidenceType: 'TEST',
  executionProfile: 'RESTRICTED',
  blocksRelease: true,
  confidence: 1,
  diagnosticNecessity: 5,
  necessityReason: 'A stale or restarted dashboard can silently hide real failures unless restoration and version refresh are verified before every release.',
  tags: ['dashboard', 'persistence', 'timing', 'compatibility', 'release'],
  dependencies: ['v170-diagnostic-necessity-policy'],
  files: [
    'src/dashboard.js',
    'src/dashboard.html',
    'src/dashboard-control.js',
    'src/dashboard-contract.js',
    'src/report-store.js',
    'src/runner.js',
    'src/diagnostic-executor.js',
    'src/selector.js',
    'bin/vibe-diag.js',
    'mcp-server/index.js',
    'vscode-extension/src/dashboard-client.js',
    'test/dashboard.test.cjs',
    'test/dashboard-refresh.test.cjs',
    'test/timing.test.cjs',
    'README.md',
    'README.ko.md',
    'mcp-server/README.md',
  ],
  cache: false,
  timeoutMs: 60000,

  async run({ projectDir }) {
    const tests = [
      path.join(projectDir, 'test', 'dashboard.test.cjs'),
      path.join(projectDir, 'test', 'dashboard-refresh.test.cjs'),
      path.join(projectDir, 'test', 'timing.test.cjs'),
    ];
    const result = spawnSync(process.execPath, ['--test', ...tests], {
      cwd: projectDir,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 55000,
    });
    if (result.status !== 0 || result.error) {
      return {
        status: 'ERROR',
        classification: result.error?.code === 'ETIMEDOUT' ? 'TIMEOUT' : 'TEST_FAILURE',
        details: result.error?.message || result.stderr || result.stdout || 'V1.7.1 dashboard persistence and timing tests failed.',
      };
    }
    return {
      status: 'OK',
      details: 'Dashboard report restoration, structured API errors, authenticated version refresh, and wall-clock timing tests passed.',
      evidence: [{
        type: 'TEST',
        summary: 'Executable refresh, restart, legacy report, version mismatch, timing, skip-state, and HTTP contracts passed.',
        verifiedAt: new Date().toISOString(),
      }],
    };
  },
};
