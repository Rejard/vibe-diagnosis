const path = require('path');

module.exports = {
  id: 'regression-guard',
  name: 'Healthy behavior guard',
  layer: 'FUNCTION',
  severity: 'CRITICAL',
  scope: 'TEST',
  evidenceType: 'TEST',
  blocksRelease: true,
  files: ['src/regression-guard.js'],
  async run({ projectDir }) {
    delete require.cache[require.resolve(path.join(projectDir, 'src', 'regression-guard'))];
    const guard = require(path.join(projectDir, 'src', 'regression-guard'));
    return guard.state === 'healthy' ? { status: 'OK', details: 'Regression guard is healthy.' } : { status: 'ERROR', details: 'Regression guard changed.' };
  },
};
