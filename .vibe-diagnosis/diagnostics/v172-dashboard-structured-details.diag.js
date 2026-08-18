const { spawnSync } = require('child_process');
const path = require('path');

module.exports = {
  id: 'v172-dashboard-structured-details',
  name: 'V1.7.2 structured diagnostic details dashboard contract',
  layer: 'SYSTEM',
  linkedTask: 'V1.7.2',
  severity: 'CRITICAL',
  scope: 'RELEASE',
  evidenceType: 'TEST',
  blocksRelease: true,
  diagnosticNecessity: 5,
  necessityReason: 'A single structured diagnostic result must never prevent the dashboard from restoring the rest of a project report.',
  dependencies: ['v171-dashboard-persistence-timing'],
  files: [
    'src/dashboard.html',
    'src/dashboard.js',
    'src/report-store.js',
    'test/dashboard-render.test.cjs',
    'test/dashboard-refresh.test.cjs',
    'test/dashboard.test.cjs',
    'test/universal-compat.test.cjs',
    'package.json',
    'package-lock.json',
    'mcp-server/index.js',
    'mcp-server/package.json',
    'mcp-server/package-lock.json',
    'README.md',
    'README.ko.md',
    'mcp-server/README.md',
    'vscode-extension/package.json',
    'vscode-extension/package-lock.json',
    'vscode-extension/README.md',
    'vscode-extension/CHANGELOG.md',
  ],
  cache: false,
  timeoutMs: 60000,
  executionProfile: 'RESTRICTED',
  allowedEnv: [],
  async run() {
    const root = path.resolve(__dirname, '..', '..');
    const result = spawnSync(process.execPath, [
      '--test',
      'test/dashboard-render.test.cjs',
      'test/dashboard-refresh.test.cjs',
      'test/dashboard.test.cjs',
    ], { cwd: root, encoding: 'utf8', timeout: 55000 });
    if (result.status !== 0) {
      return { status: 'ERROR', details: (result.stderr || result.stdout || 'Dashboard structured-details tests failed.').slice(-4000) };
    }
    return {
      status: 'OK',
      details: 'Structured details, per-card isolation, persisted report restoration, timing, slow sorting, legacy API handling, and server version contracts passed.',
      evidence: [{ type: 'TEST', summary: 'Executable V1.7.2 structured dashboard restoration contract passed.' }],
    };
  },
};
