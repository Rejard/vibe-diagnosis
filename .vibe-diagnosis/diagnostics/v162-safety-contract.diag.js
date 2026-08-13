const path = require('path');
const { spawnSync } = require('child_process');

module.exports = {
  id: 'v162-safety-contract',
  name: 'V1.6.2 safety and approval contract',
  layer: 'SYSTEM',
  linkedTask: 'V1.6.2',
  severity: 'CRITICAL',
  scope: 'RELEASE',
  evidenceType: 'TEST',
  blocksRelease: true,
  confidence: 1,
  tags: ['repair', 'byok', 'completion', 'evidence', 'rules'],
  dependencies: ['v161-project-run-lock'],
  files: [
    'src/repairer.js',
    'src/diagnostics-lock.js',
    'src/config-manager.js',
    'src/environment.js',
    'src/run-summary.js',
    'src/evidence.js',
    'src/rules-injector.js',
    'src/baseline.js',
    'src/completion-receipt.js',
    'src/dashboard-control.js',
    'src/dashboard.js',
    'src/diagnostic-executor.js',
    'src/ai-provider.js',
    'src/build-verifier.js',
    'src/diagnostic-audit.js',
    'bin/vibe-diag.js',
    'mcp-server/index.js',
    'test/core.test.cjs',
    'test/dashboard.test.cjs',
    'test/mcp-schema.test.cjs',
    'test/security-regressions.test.cjs',
  ],
  cache: false,
  timeoutMs: 60000,

  async run({ projectDir }) {
    const result = spawnSync(process.execPath, ['--test', path.join(projectDir, 'test', 'security-regressions.test.cjs')], {
      cwd: projectDir,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 45000,
    });
    if (result.status !== 0 || result.error) {
      return {
        status: 'ERROR',
        classification: result.error?.code === 'ETIMEDOUT' ? 'TIMEOUT' : 'TEST_FAILURE',
        details: result.error?.message || result.stderr || result.stdout || 'V1.6.2 safety contract tests failed.',
      };
    }
    return {
      status: 'OK',
      details: 'Approval integrity, BYOK ignore migration, protected mutation detection, gates, evidence, rules, receipts, repair locking, diagnostic auditing, and CLI isolation passed.',
      evidence: [{
        type: 'TEST',
        summary: 'Executable V1.6.2 safety regression suite passed.',
        verifiedAt: new Date().toISOString(),
      }],
    };
  },
};
