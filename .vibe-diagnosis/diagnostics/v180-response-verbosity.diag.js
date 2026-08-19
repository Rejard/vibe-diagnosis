const { spawnSync } = require('child_process');
const path = require('path');

module.exports = {
  id: 'v180-response-verbosity',
  name: 'V1.8.0 diagnostic response verbosity contract',
  layer: 'SYSTEM',
  linkedTask: 'V1.8.0',
  severity: 'CRITICAL',
  scope: 'RELEASE',
  evidenceType: 'TEST',
  blocksRelease: true,
  diagnosticNecessity: 5,
  necessityReason: 'A shaped response must never drop a failing diagnostic, and the default response must stay constant as the diagnostic count grows.',
  dependencies: ['v172-dashboard-structured-details'],
  files: [
    'src/report-view.js',
    'test/response-verbosity.test.cjs',
    'test/mcp-schema.test.cjs',
    'mcp-server/index.js',
    'mcp-server/package.json',
    'mcp-server/package-lock.json',
    'package.json',
    'package-lock.json',
    'README.md',
    'README.ko.md',
    'mcp-server/README.md',
    'vscode-extension/package.json',
    'vscode-extension/package-lock.json',
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
      'test/response-verbosity.test.cjs',
      'test/mcp-schema.test.cjs',
    ], { cwd: root, encoding: 'utf8', timeout: 55000 });
    if (result.status !== 0) {
      return { status: 'ERROR', details: (result.stderr || result.stdout || 'Response verbosity tests failed.').slice(-4000) };
    }
    return {
      status: 'OK',
      details: 'Summary, list, and full verbosity shaping, complete failure retention, constant summary size, and MCP tool schema exposure passed.',
      evidence: [{ type: 'TEST', summary: 'Executable V1.8.0 run_diagnostics and complete_task_diagnostics response shaping contract passed.' }],
    };
  },
};
