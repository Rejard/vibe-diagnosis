const { state } = require('../../src/regression-guard');

module.exports = {
  id: 'regression-guard',
  name: 'Repair Lab Regression Guard',
  layer: 'SYSTEM',
  linkedTask: 'safe-repair-lab-rollback-path',
  async run() {
    return state === 'safe'
      ? { status: 'OK', details: 'Regression guard is healthy.' }
      : { status: 'ERROR', details: 'Regression guard changed unexpectedly.' };
  },
};
