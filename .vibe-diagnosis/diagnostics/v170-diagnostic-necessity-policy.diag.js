const path = require('path');
const { spawnSync } = require('child_process');

module.exports = {
  id: 'v170-diagnostic-necessity-policy',
  name: 'V1.7 diagnostic necessity and user policy contract',
  layer: 'SYSTEM',
  linkedTask: 'V1.7.0',
  severity: 'CRITICAL',
  scope: 'RELEASE',
  evidenceType: 'TEST',
  executionProfile: 'RESTRICTED',
  blocksRelease: true,
  confidence: 1,
  diagnosticNecessity: 5,
  necessityReason: 'The diagnostic scheduler and explicit user exclusions must be verified before every release.',
  tags: ['priority', 'policy', 'dashboard', 'mcp', 'completion'],
  dependencies: ['v163-universal-agent-contract'],
  files: [
    'src/diagnostic-policy.js',
    'src/schema.js',
    'src/selector.js',
    'src/runner.js',
    'src/completion-receipt.js',
    'src/diagnostic-audit.js',
    'src/dashboard.js',
    'src/dashboard.html',
    'src/reporter.js',
    'bin/vibe-diag.js',
    'mcp-server/index.js',
    'test/diagnostic-policy.test.cjs',
    'test/dashboard.test.cjs',
    'test/mcp-schema.test.cjs',
    'README.md',
    'README.ko.md',
    'mcp-server/README.md',
  ],
  cache: false,
  timeoutMs: 60000,

  async run({ projectDir }) {
    const tests = [
      path.join(projectDir, 'test', 'diagnostic-policy.test.cjs'),
      path.join(projectDir, 'test', 'dashboard.test.cjs'),
      path.join(projectDir, 'test', 'mcp-schema.test.cjs'),
    ];
    const result = spawnSync(process.execPath, ['--test', ...tests], {
      cwd: projectDir,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 50000,
    });
    if (result.status !== 0 || result.error) {
      return {
        status: 'ERROR',
        classification: result.error?.code === 'ETIMEDOUT' ? 'TIMEOUT' : 'TEST_FAILURE',
        details: result.error?.message || result.stderr || result.stdout || 'V1.7 diagnostic policy tests failed.',
      };
    }
    return {
      status: 'OK',
      details: 'Necessity scheduling, user exclusions, recoverable removal, dashboard HTTP, MCP, and completion receipt policy tests passed.',
      evidence: [{
        type: 'TEST',
        summary: 'Executable V1.7 priority and diagnostic policy contract passed.',
        verifiedAt: new Date().toISOString(),
      }],
    };
  },
};
