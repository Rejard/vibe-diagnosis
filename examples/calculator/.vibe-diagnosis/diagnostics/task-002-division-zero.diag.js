module.exports = {
  id: 'task-002-division-zero',
  name: 'Division by Zero Handling',
  layer: 'TASK',
  linkedTask: 'TASK-002',

  async run(ctx) {
    const calc = require('../../calculator');

    const edgeCases = [
      { args: [10, 0],  label: 'positive / zero'  },
      { args: [-5, 0],  label: 'negative / zero'  },
      { args: [0, 0],   label: 'zero / zero'      },
    ];

    let passed = 0;

    for (const tc of edgeCases) {
      try {
        calc.divide(...tc.args);
        return { status: 'ERROR', details: `${tc.label}: expected throw but got result` };
      } catch (err) {
        if (err.message === 'Division by zero') {
          passed++;
        } else {
          return { status: 'ERROR', details: `${tc.label}: unexpected error "${err.message}"` };
        }
      }
    }

    return { status: 'OK', details: `${passed} edge cases passed` };
  }
};
