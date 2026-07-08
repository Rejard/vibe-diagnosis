module.exports = {
  id: 'example-diagnostic',
  name: 'Example Diagnostic',
  layer: 'TASK',
  linkedTask: 'TASK-000',

  async run(ctx) {
    const isWorking = true;

    if (!isWorking) {
      return { status: 'ERROR', details: 'Something is broken' };
    }

    return { status: 'OK', details: 'Everything is working correctly' };
  }
};
