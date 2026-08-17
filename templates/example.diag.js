module.exports = {
  id: 'example-diagnostic',
  name: 'Example Diagnostic',
  layer: 'TASK',
  linkedTask: 'TASK-000',
  severity: 'MEDIUM',
  scope: 'GENERAL',
  evidenceType: 'TEST',
  blocksRelease: false,
  blocksLiveTrading: false,
  confidence: 1,
  tags: ['example'],
  dependencies: [],
  files: ['src/example.js'],
  cache: false,
  diagnosticNecessity: 3,
  necessityReason: 'Run when the declared files change; this example is not a mandatory routine check.',

  async run(ctx) {
    const isWorking = true;

    if (!isWorking) {
      return { status: 'ERROR', details: 'Something is broken' };
    }

    return {
      status: 'OK',
      details: 'Everything is working correctly',
      evidence: [{ type: 'TEST', summary: 'Behavior executed successfully', verifiedAt: new Date().toISOString() }],
    };
  }
};
