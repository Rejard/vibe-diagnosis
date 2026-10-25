const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createMetricsReader } = require('../src/dashboard-metrics');
const { startDashboard } = require('../src/dashboard');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-metrics-'));
  fs.mkdirSync(path.join(root, '.vibe-diagnosis'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

test('CPU-bound metrics do not block authenticated health requests', async t => {
  const root = fixture(t);
  const workerPath = path.join(root, 'busy.cjs');
  fs.writeFileSync(workerPath, "const {parentPort}=require('worker_threads');const until=Date.now()+900;while(Date.now()<until){}parentPort.postMessage({done:true});");
  const server = startDashboard(root, 0, { openBrowser: false, metrics: { workerPath } });
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => server.close());
  const lock = JSON.parse(fs.readFileSync(path.join(root, '.vibe-diagnosis', 'active_port.json')));
  const headers = { 'X-Vibe-Dashboard-Token': lock.token };
  const base = `http://127.0.0.1:${lock.port}`;
  const pending = fetch(base + '/api/metrics', { headers });
  await new Promise(resolve => setTimeout(resolve, 150));
  const start = Date.now();
  const health = await fetch(base + '/api/health', { headers });
  assert.equal(health.status, 200);
  assert.ok(Date.now() - start < 600);
  assert.equal((await (await pending).json()).done, true);
});

test('metrics merge simultaneous requests and cache completed results', async t => {
  const root = fixture(t);
  const read = createMetricsReader(root);
  t.after(() => read.close());
  const first = read(1, 1);
  assert.equal(read(1, 1), first);
  const value = await first;
  assert.equal(await read(1, 1), value);
  assert.notEqual(await read(1, 0), value);
});

test('a stalled worker times out, releases its slot, and closes safely', async t => {
  const root = fixture(t);
  const workerPath = path.join(root, 'stalled.cjs');
  fs.writeFileSync(workerPath, 'while(true){}');
  const read = createMetricsReader(root, { workerPath, timeoutMs: 200 });
  await assert.rejects(read(0, 0), /timed out/);
  await assert.rejects(read(0, 0), /timed out/);
  read.close();
  await assert.rejects(read(0, 0), /closed/);
});

test('runtime artifacts and quarantined research do not affect source metrics', async t => {
  const root = fixture(t);
  fs.writeFileSync(path.join(root, '.alobtc-aidl-research.quarantine'), 'test boundary');
  for (const dir of ['backups', 'scratch', 'reports', 'research', 'uploads']) {
    fs.mkdirSync(path.join(root, dir));
    fs.writeFileSync(path.join(root, dir, 'ignored.css'), 'width:100px;');
  }
  fs.writeFileSync(path.join(root, 'source.css'), 'display:flex;');
  const read = createMetricsReader(root);
  t.after(() => read.close());
  const result = await read(1, 1);
  assert.equal(result.uiIntegrity.dynamicFlexRatio, 100);
});
