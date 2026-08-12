const path = require('path');
const { spawnSync } = require('child_process');

module.exports = {
  id: 'v133-dashboard-shutdown-diagnostic',
  name: 'Dashboard shutdown isolation',
  layer: 'SYSTEM',
  linkedTask: 'v1.3.3 dashboard shutdown compatibility',
  severity: 'HIGH',
  scope: 'RELEASE',
  evidenceType: 'TEST',
  blocksRelease: true,
  confidence: 1,
  tags: ['dashboard', 'shutdown', 'compatibility'],
  files: ['src/dashboard-control.js', 'src/dashboard.js', 'test/dashboard.test.cjs'],

  async run({ projectDir }) {
    const result = spawnSync(process.execPath, ['--test', '--test-name-pattern=dashboard control stops', path.join(projectDir, 'test', 'dashboard.test.cjs')], {
      cwd: projectDir,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 30000,
    });
    if (result.status !== 0 || result.error) {
      return { status: 'ERROR', details: result.error?.message || result.stderr || result.stdout || 'Dashboard shutdown test failed.' };
    }
    return {
      status: 'OK',
      details: 'Dashboard shutdown isolation passed through the executable control test.',
      evidence: [{ type: 'TEST', summary: 'Project-scoped dashboard shutdown test passed.', verifiedAt: new Date().toISOString() }],
    };
  },
};
