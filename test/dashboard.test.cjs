const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawnSync } = require('child_process');
const { startDashboard } = require('../src/dashboard');
const { stopDashboard, probeDashboard } = require('../src/dashboard-control');
const { readDashboardConnection, postJson, buildRepairApproval } = require('../vscode-extension/src/dashboard-client');

test('dashboard API returns the centralized V1.7 report', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-dashboard-'));
  fs.mkdirSync(path.join(root, '.vibe-diagnosis', 'diagnostics'), { recursive: true });
  fs.writeFileSync(path.join(root, '.vibe-diagnosis', 'diagnostics', 'ok.diag.js'), `module.exports={id:'ok',name:'ok',layer:'TASK',evidenceType:'STATIC',async run(){return {status:'OK',details:'ok'}}}`, 'utf8');
  const server = startDashboard(root, 0, { openBrowser: false });
  t.after(() => { server.close(); fs.rmSync(root, { recursive: true, force: true }); });
  await new Promise(resolve => server.once('listening', resolve));
  const port = server.address().port;
  const lock = JSON.parse(fs.readFileSync(path.join(root, '.vibe-diagnosis', 'active_port.json'), 'utf8'));
  const unauthorized = await fetch(`http://127.0.0.1:${port}/api/run`, { method: 'POST' });
  assert.equal(unauthorized.status, 403);
  const metricsBeforeRun = await fetch(`http://127.0.0.1:${port}/api/metrics`, { headers: { 'X-Vibe-Dashboard-Token': lock.token } });
  assert.equal((await metricsBeforeRun.json()).diagnosticsEvaluated, false);
  const response = await fetch(`http://127.0.0.1:${port}/api/run`, { method: 'POST', headers: { 'X-Vibe-Dashboard-Token': lock.token } });
  const report = await response.json();
  assert.equal(report.schemaVersion, 4);
  assert.ok(Number.isFinite(report.durationMs));
  assert.ok(Number.isFinite(report.results[0].durationMs));
  assert.equal(report.summary.ok, 1);
  assert.equal(report.gates.releaseStatus, 'NOT_EVALUATED');
  assert.equal(report.evidenceSummary.liveEvidenceStatus, 'UNVERIFIED');
  const metricsAfterRun = await fetch(`http://127.0.0.1:${port}/api/metrics`, { headers: { 'X-Vibe-Dashboard-Token': lock.token } });
  assert.equal((await metricsAfterRun.json()).diagnosticsEvaluated, true);
  const health = await fetch(`http://127.0.0.1:${port}/api/health`, { headers: { 'X-Vibe-Dashboard-Token': lock.token } });
  assert.equal(health.status, 200);
  const healthBody = await health.json();
  assert.equal(healthBody.service, 'vibe-diagnosis-dashboard');
  assert.equal(healthBody.version, require('../package.json').version);
  assert.equal(healthBody.apiVersion, 2);
  assert.ok(healthBody.capabilities.includes('persistent-report-v1'));
});

test('dashboard returns HTTP 409 and CLI conflict while one project run is active', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-dashboard-concurrency-'));
  const diagnosticsDir = path.join(root, '.vibe-diagnosis', 'diagnostics');
  const marker = path.join(root, 'started.marker');
  fs.mkdirSync(diagnosticsDir, { recursive: true });
  fs.writeFileSync(path.join(diagnosticsDir, 'slow.diag.js'), `const fs=require('fs');module.exports={id:'slow',name:'slow',layer:'SYSTEM',async run(){fs.writeFileSync(${JSON.stringify(marker)},'1');await new Promise(resolve=>setTimeout(resolve,700));return {status:'OK',details:'done'}}}`);
  const server = startDashboard(root, 0, { openBrowser: false });
  t.after(() => { if (server.listening) server.close(); fs.rmSync(root, { recursive: true, force: true }); });
  await new Promise(resolve => server.once('listening', resolve));
  const lock = JSON.parse(fs.readFileSync(path.join(root, '.vibe-diagnosis', 'active_port.json'), 'utf8'));
  const request = () => fetch(`http://127.0.0.1:${lock.port}/api/run`, { method: 'POST', headers: { 'X-Vibe-Dashboard-Token': lock.token } });
  const first = request();
  for (let attempt = 0; attempt < 100 && !fs.existsSync(marker); attempt += 1) await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(fs.existsSync(marker), true);

  const conflictStarted = Date.now();
  const second = await request();
  const conflict = await second.json();
  assert.equal(second.status, 409);
  assert.equal(conflict.code, 'DIAGNOSTICS_ALREADY_RUNNING');
  assert.ok(conflict.startedAt);
  assert.ok(Date.now() - conflictStarted < 300);
  assert.equal(conflict.projectDir, undefined);

  const cli = spawnSync(process.execPath, [path.join(__dirname, '..', 'bin', 'vibe-diag.js'), 'run', '--json', '--cwd', root], { encoding: 'utf8', windowsHide: true });
  assert.equal(cli.status, 2);
  assert.equal(JSON.parse(cli.stdout).code, 'DIAGNOSTICS_ALREADY_RUNNING');

  const completed = await first;
  assert.equal(completed.status, 200);
  assert.equal((await completed.json()).overallStatus, 'OK');
});

test('dashboard client handles conflict responses before reading results and always clears running state', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'dashboard.html'), 'utf8');
  const packageVersion = require('../package.json').version;
  assert.match(html, /if \(!response\.ok\)/);
  assert.match(html, /content-type/);
  assert.match(html, /error\.status === 409/);
  assert.match(html, /DIAGNOSTICS_ALREADY_RUNNING/);
  assert.match(html, /Array\.isArray\(data\.results\)/);
  assert.match(html, /finally\s*\{\s*btn\.classList\.remove\('running'\)/);
  assert.match(html, /getDashboardJson\('\/api\/report'\)/);
  assert.match(html, /Promise\.all\(\[\s*fetchList\(\),\s*getDashboardJson\('\/api\/report'\)/);
  assert.match(html, /formatDuration/);
  assert.match(html, /slowest/);
  assert.match(html, /DASHBOARD_EXPECTED = __VIBE_DASHBOARD_EXPECTED__;/);
  const server = fs.readFileSync(path.join(__dirname, '..', 'src', 'dashboard.js'), 'utf8');
  assert.match(server, /__VIBE_DASHBOARD_EXPECTED__[\s\S]{0,120}identity\.version/);
  assert.ok(packageVersion);
  assert.match(html, /necessityStars/);
  assert.match(html, /setDiagnosticStateUi/);
  assert.match(html, /removeDiagnosticUi/);
});

test('dashboard manages diagnostic state and recoverable removal through authenticated HTTP', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-dashboard-policy-'));
  const diagnosticsDir = path.join(root, '.vibe-diagnosis', 'diagnostics');
  fs.mkdirSync(diagnosticsDir, { recursive: true });
  fs.writeFileSync(path.join(diagnosticsDir, 'policy.diag.js'), `module.exports={id:'policy',name:'policy',layer:'TASK',diagnosticNecessity:5,necessityReason:'silent regression',async run(){return {status:'OK'}}}`);
  const server = startDashboard(root, 0, { openBrowser: false });
  t.after(() => { if (server.listening) server.close(); fs.rmSync(root, { recursive: true, force: true }); });
  await new Promise(resolve => server.once('listening', resolve));
  const lock = JSON.parse(fs.readFileSync(path.join(root, '.vibe-diagnosis', 'active_port.json'), 'utf8'));
  const post = (route, body) => fetch(`http://127.0.0.1:${lock.port}${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Vibe-Dashboard-Token': lock.token }, body: JSON.stringify(body) });
  const disabled = await post('/api/diagnostics/state', { diagnosticId: 'policy', state: 'DISABLED', reason: 'intentional hold' });
  assert.equal(disabled.status, 200);
  const list = await fetch(`http://127.0.0.1:${lock.port}/api/list`, { headers: { 'X-Vibe-Dashboard-Token': lock.token } });
  const listed = await list.json();
  assert.equal(listed[0].diagnosticNecessity, 5);
  assert.equal(listed[0].diagnosticState, 'DISABLED');
  const removed = await post('/api/diagnostics/remove', { diagnosticId: 'policy', confirmed: true, reason: 'not applicable' });
  assert.equal(removed.status, 200);
  const removedList = await fetch(`http://127.0.0.1:${lock.port}/api/list`, { headers: { 'X-Vibe-Dashboard-Token': lock.token } });
  assert.equal((await removedList.json())[0].diagnosticState, 'REMOVED');
  const restored = await post('/api/diagnostics/restore', { diagnosticId: 'policy' });
  assert.equal(restored.status, 200);
  assert.equal(fs.existsSync(path.join(diagnosticsDir, 'policy.diag.js')), true);
});

test('VS Code dashboard client uses the project lock port and authentication token', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-dashboard-client-'));
  fs.mkdirSync(path.join(root, '.vibe-diagnosis', 'diagnostics'), { recursive: true });
  fs.writeFileSync(path.join(root, '.vibe-diagnosis', 'diagnostics', 'ok.diag.js'), "module.exports={id:'ok',name:'OK',layer:'TASK',async run(){return {status:'OK',details:'ok'}}};\n");
  const server = startDashboard(root, 0, { openBrowser: false });
  t.after(() => { if (server.listening) server.close(); fs.rmSync(root, { recursive: true, force: true }); });
  await new Promise(resolve => server.once('listening', resolve));

  const connection = readDashboardConnection(root);
  assert.equal(connection.port, server.address().port);
  assert.ok(connection.token);
  const report = await postJson(root, '/api/run');
  assert.equal(report.overallStatus, 'OK');
});

test('VS Code repair approval carries the reviewed plan checksum', () => {
  const checksum = 'a'.repeat(64);
  assert.deepEqual(buildRepairApproval({ id: 'repair-1', integrity: { checksum } }, true), {
    planId: 'repair-1',
    approved: true,
    approvedChecksum: checksum,
    approvedHighRisk: true,
  });
  assert.throws(() => buildRepairApproval({ id: 'repair-1' }), /integrity checksum/);
});

test('VS Code dashboard client rejects a legacy server lock before sending API requests', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-dashboard-client-legacy-'));
  try {
    fs.mkdirSync(path.join(root, '.vibe-diagnosis'), { recursive: true });
    fs.writeFileSync(path.join(root, '.vibe-diagnosis', 'active_port.json'), JSON.stringify({
      port: 7700,
      pid: process.pid,
      projectDir: root,
      token: 'legacy-token',
      version: '1.6.3',
    }));
    assert.throws(() => readDashboardConnection(root), /Dashboard update required.*1\.6\.3/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('dashboard rejects cross-origin and traversal requests', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-dashboard-security-'));
  fs.mkdirSync(path.join(root, '.vibe-diagnosis', 'error-patterns'), { recursive: true });
  const server = startDashboard(root, 0, { openBrowser: false });
  t.after(() => { if (server.listening) server.close(); fs.rmSync(root, { recursive: true, force: true }); });
  await new Promise(resolve => server.once('listening', resolve));
  assert.equal(server.address().address, '127.0.0.1');
  const lock = JSON.parse(fs.readFileSync(path.join(root, '.vibe-diagnosis', 'active_port.json'), 'utf8'));
  const response = await fetch(`http://127.0.0.1:${lock.port}/api/errors/%2e%2e%2fconfig.json`, { headers: { Origin: 'https://example.com', 'X-Vibe-Dashboard-Token': lock.token } });
  assert.equal(response.status, 403);
  const traversal = await fetch(`http://127.0.0.1:${lock.port}/api/errors/%2e%2e%2fconfig.json`, { headers: { 'X-Vibe-Dashboard-Token': lock.token } });
  assert.equal(traversal.status, 400);
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

test('dashboard probe rejects an unrelated listener recorded in a stale lock', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-dashboard-probe-'));
  fs.mkdirSync(path.join(root, '.vibe-diagnosis'), { recursive: true });
  const unrelated = http.createServer((req, res) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end('{"service":"other"}'); });
  t.after(() => { unrelated.close(); fs.rmSync(root, { recursive: true, force: true }); });
  await new Promise(resolve => unrelated.listen(0, '127.0.0.1', resolve));
  fs.writeFileSync(path.join(root, '.vibe-diagnosis', 'active_port.json'), JSON.stringify({
    port: unrelated.address().port,
    pid: process.pid,
    projectDir: root,
    token: 'not-a-dashboard-token',
  }));
  assert.equal((await probeDashboard(root, { timeoutMs: 500 })).running, false);
});
