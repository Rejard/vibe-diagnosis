const path = require('path');
const { spawnSync } = require('child_process');

module.exports = {
  id: 'v161-project-run-lock',
  name: 'Project-scoped single diagnostic execution',
  layer: 'SYSTEM',
  linkedTask: 'V1.6.1',
  severity: 'CRITICAL',
  scope: 'RELEASE',
  evidenceType: 'TEST',
  blocksRelease: true,
  confidence: 1,
  tags: ['runner', 'concurrency', 'dashboard', 'mcp', 'cli'],
  dependencies: [],
  files: [
    'src/diagnostics-lock.js',
    'src/runner.js',
    'src/dashboard.js',
    'src/dashboard.html',
    'bin/vibe-diag.js',
    'mcp-server/index.js',
    'test/concurrency.test.cjs',
    'test/dashboard.test.cjs',
  ],
  cache: false,
  timeoutMs: 60000,

  async run({ projectDir }) {
    const result = spawnSync(process.execPath, [
      '--test',
      path.join(projectDir, 'test', 'concurrency.test.cjs'),
      path.join(projectDir, 'test', 'dashboard.test.cjs'),
    ], {
      cwd: projectDir,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 45000,
    });
    if (result.status !== 0 || result.error) {
      return {
        status: 'ERROR',
        classification: result.error?.code === 'ETIMEDOUT' ? 'TIMEOUT' : 'TEST_FAILURE',
        details: result.error?.message || result.stderr || result.stdout || 'Project execution lock tests failed.',
      };
    }
    return {
      status: 'OK',
      details: 'Single-run locking, immediate conflicts, stale recovery, dashboard 409, MCP, and CLI behavior passed.',
      evidence: [{
        type: 'TEST',
        summary: 'Same-process, cross-process, multi-project, stale/live lock, dashboard HTTP, MCP, and CLI concurrency tests passed.',
        verifiedAt: new Date().toISOString(),
      }],
    };
  },
};
