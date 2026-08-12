const path = require('path');
const { spawnSync } = require('child_process');

module.exports = {
  id: 'v132-interactive-chart-diagnostic',
  name: 'Dashboard report integration',
  layer: 'SYSTEM',
  linkedTask: 'v1.3.2 dashboard compatibility',
  severity: 'HIGH',
  scope: 'RELEASE',
  evidenceType: 'TEST',
  blocksRelease: true,
  confidence: 1,
  tags: ['dashboard', 'compatibility'],
  files: ['src/dashboard.js', 'src/dashboard.html', 'test/dashboard.test.cjs'],

  async run({ projectDir }) {
    const result = spawnSync(process.execPath, ['--test', '--test-name-pattern=dashboard API returns', path.join(projectDir, 'test', 'dashboard.test.cjs')], {
      cwd: projectDir,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 30000,
    });
    if (result.status !== 0 || result.error) {
      return { status: 'ERROR', details: result.error?.message || result.stderr || result.stdout || 'Dashboard integration test failed.' };
    }
    return {
      status: 'OK',
      details: 'Dashboard report integration passed through the executable HTTP test.',
      evidence: [{ type: 'TEST', summary: 'Dashboard API report test passed.', verifiedAt: new Date().toISOString() }],
    };
  },
};
