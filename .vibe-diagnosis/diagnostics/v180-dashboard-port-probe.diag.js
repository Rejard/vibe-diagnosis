const { spawnSync } = require('child_process');
const path = require('path');

module.exports = {
  id: 'v180-dashboard-port-probe',
  name: 'V1.8.0 dashboard port availability probe',
  layer: 'SYSTEM',
  linkedTask: 'V1.8.0',
  severity: 'HIGH',
  scope: 'RELEASE',
  evidenceType: 'TEST',
  blocksRelease: true,
  diagnosticNecessity: 4,
  necessityReason: 'The dashboard binds loopback, so a port probe that binds the wildcard address calls an occupied port free and the replacement server dies with EADDRINUSE.',
  dependencies: [],
  files: [
    'src/port-probe.js',
    'test/port-probe.test.cjs',
    'mcp-server/index.js',
  ],
  cache: false,
  timeoutMs: 30000,
  executionProfile: 'RESTRICTED',
  allowedEnv: [],
  async run() {
    const root = path.resolve(__dirname, '..', '..');
    const result = spawnSync(process.execPath, ['--test', 'test/port-probe.test.cjs'], { cwd: root, encoding: 'utf8', timeout: 25000 });
    if (result.status !== 0) {
      return { status: 'ERROR', details: (result.stderr || result.stdout || 'Port probe tests failed.').slice(-4000) };
    }
    return {
      status: 'OK',
      details: 'Loopback port occupancy detection, free-port selection, and port release waiting passed.',
      evidence: [{ type: 'TEST', summary: 'Executable V1.8.0 loopback port probe contract passed.' }],
    };
  },
};
