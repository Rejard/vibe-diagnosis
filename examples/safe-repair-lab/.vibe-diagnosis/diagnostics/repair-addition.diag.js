const { add } = require('../../src/calculator');

module.exports = {
  id: 'repair-addition',
  name: 'Repair Lab Addition Failure',
  layer: 'TASK',
  linkedTask: 'safe-repair-lab-success-path',
  async run() {
    return add(2, 3) === 5
      ? { status: 'OK', details: 'Addition behavior is correct.' }
      : { status: 'ERROR', details: 'Addition must return 5 for add(2, 3). Fix src/calculator.js without changing diagnostic files.' };
  },
};
