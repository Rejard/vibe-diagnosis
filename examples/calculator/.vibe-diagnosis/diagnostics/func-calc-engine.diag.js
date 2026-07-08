module.exports = {
  id: 'func-calc-engine',
  name: 'Calculator Engine Precision',
  layer: 'FUNCTION',

  async run(ctx) {
    const calc = require('../../calculator');
    const TOLERANCE = 0.0001;

    const precisionTests = [
      { fn: 'add',      args: [0.1, 0.2],    expected: 0.3    },
      { fn: 'multiply', args: [0.1, 0.1],    expected: 0.01   },
      { fn: 'divide',   args: [1, 3],         expected: 1 / 3  },
      { fn: 'subtract', args: [1.0, 0.9],     expected: 0.1    },
    ];

    for (const t of precisionTests) {
      const result = calc[t.fn](...t.args);
      const diff = Math.abs(result - t.expected);
      if (diff > TOLERANCE) {
        return {
          status: 'WARNING',
          details: `${t.fn}(${t.args}) = ${result}, expected ~${t.expected} (diff: ${diff})`,
        };
      }
    }

    return { status: 'OK', details: `Float precision within ±${TOLERANCE}` };
  }
};
