const path = require('path');

module.exports = {
  id: 'repair-addition',
  name: 'Addition behavior',
  layer: 'FUNCTION',
  severity: 'HIGH',
  scope: 'TEST',
  evidenceType: 'TEST',
  files: ['src/calculator.js'],
  async run({ projectDir }) {
    delete require.cache[require.resolve(path.join(projectDir, 'src', 'calculator'))];
    const { add } = require(path.join(projectDir, 'src', 'calculator'));
    return add(2, 3) === 5 ? { status: 'OK', details: 'Addition works.' } : { status: 'ERROR', details: 'add(2, 3) must equal 5.' };
  },
};
