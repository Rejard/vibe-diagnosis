const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startDashboard } = require('../src/dashboard');
const { stopDashboard } = require('../src/dashboard-control');

test('dashboard API returns the centralized V1.6 report', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-dashboard-'));
  fs.mkdirSync(path.join(root, '.vibe-diagnosis', 'diagnostics'), { recursive: true });
  fs.writeFileSync(path.join(root, '.vibe-diagnosis', 'diagnostics', 'ok.diag.js'), `module.exports={id:'ok',name:'ok',layer:'TASK',evidenceType:'STATIC',async run(){return {status:'OK',details:'ok'}}}`, 'utf8');
  const server = startDashboard(root, 0, { openBrowser: false });
  t.after(() => { server.close(); fs.rmSync(root, { recursive: true, force: true }); });
  await new Promise(resolve => server.once('listening', resolve));
  const port = server.address().port;
  const response = await fetch(`http://localhost:${port}/api/run`, { method: 'POST' });
  const report = await response.json();
  assert.equal(report.schemaVersion, 2);
  assert.equal(report.summary.ok, 1);
  assert.equal(report.gates.releaseStatus, 'RELEASE_ALLOWED');
  assert.equal(report.evidenceSummary.liveEvidenceStatus, 'UNVERIFIED');
});

test('dashboard control stops only the project dashboard and removes its lock', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-dashboard-stop-'));
  fs.mkdirSync(path.join(root, '.vibe-diagnosis'), { recursive: true });
  const server = startDashboard(root, 0, { openBrowser: false });
  t.after(() => { if (server.listening) server.close(); fs.rmSync(root, { recursive: true, force: true }); });
  await new Promise(resolve => server.once('listening', resolve));
  const lockFile = path.join(root, '.vibe-diagnosis', 'active_port.json');
  const lock = JSON.parse(fs.readFileSync(lockFile, 'utf8'));
  assert.equal(lock.projectDir, path.resolve(root));
  assert.ok(lock.token);
  const result = await stopDashboard(root);
  assert.equal(result.stopped, true);
  assert.equal(result.authenticated, true);
  await new Promise(resolve => setTimeout(resolve, 600));
  assert.equal(fs.existsSync(lockFile), false);
});
