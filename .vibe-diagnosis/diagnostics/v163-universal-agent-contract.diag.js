const path = require('path');
const { spawnSync } = require('child_process');

module.exports = {
  id: 'v163-universal-agent-contract',
  name: 'V1.6.3 universal agent and scale contract',
  layer: 'SYSTEM',
  linkedTask: 'V1.6.3',
  severity: 'CRITICAL',
  scope: 'RELEASE',
  evidenceType: 'TEST',
  executionProfile: 'RESTRICTED',
  blocksRelease: true,
  confidence: 1,
  tags: ['mcp', 'agent', 'scale', 'isolation', 'ast'],
  dependencies: ['v162-safety-contract'],
  files: [
    'src/diagnostic-executor.js',
    'src/schema.js',
    'src/selector.js',
    'src/analyzer.js',
    'src/runner.js',
    'mcp-server/index.js',
    'scripts/benchmark-scale.cjs',
    'test/core.test.cjs',
    'test/universal-compat.test.cjs',
    'README.md',
    'README.ko.md',
    'mcp-server/README.md',
  ],
  cache: false,
  timeoutMs: 60000,

  async run({ projectDir }) {
    const result = spawnSync(process.execPath, ['--test', path.join(projectDir, 'test', 'universal-compat.test.cjs')], {
      cwd: projectDir,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 45000,
    });
    if (result.status !== 0 || result.error) {
      return {
        status: 'ERROR',
        classification: result.error?.code === 'ETIMEDOUT' ? 'TIMEOUT' : 'TEST_FAILURE',
        details: result.error?.message || result.stderr || result.stdout || 'Universal MCP contract tests failed.',
      };
    }
    return {
      status: 'OK',
      details: 'Neutral scale fixtures and Codex, Claude Code, and Gemini CLI stdio contracts passed.',
      evidence: [{
        type: 'TEST',
        summary: 'Synthetic 100/500/1,000 catalog and generic MCP client handshakes passed.',
        verifiedAt: new Date().toISOString(),
      }],
    };
  },
};
