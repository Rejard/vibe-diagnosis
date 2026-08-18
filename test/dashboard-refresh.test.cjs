const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { startDashboard } = require('../src/dashboard');
const { refreshIncompatibleDashboard, probeDashboard } = require('../src/dashboard-control');
const { projectKey } = require('../src/diagnostics-lock');
const { loadLatestRunReport, normalizeRunReport } = require('../src/report-store');

function makeProject(prefix = 'vibe-refresh-') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.mkdirSync(path.join(root, '.vibe-diagnosis', 'diagnostics'), { recursive: true });
  return root;
}

async function listenDashboard(root) {
  const server = startDashboard(root, 0, { openBrowser: false });
  await new Promise(resolve => server.once('listening', resolve));
  const lock = JSON.parse(fs.readFileSync(path.join(root, '.vibe-diagnosis', 'active_port.json'), 'utf8'));
  const request = async (pathname, options = {}) => {
    const response = await fetch(`http://127.0.0.1:${lock.port}${pathname}`, {
      ...options,
      headers: { ...(options.headers || {}), 'X-Vibe-Dashboard-Token': lock.token },
    });
    return { response, body: await response.text() };
  };
  return { server, lock, request };
}

test('dashboard restores the latest persisted report after a server restart', async t => {
  const root = makeProject();
  fs.writeFileSync(path.join(root, '.vibe-diagnosis', 'diagnostics', 'ok.diag.js'), "module.exports={id:'ok',name:'OK',layer:'TASK',async run(){return {status:'OK',details:{ready:true}}}};\n");
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  let dashboard = await listenDashboard(root);
  const run = await dashboard.request('/api/run', { method: 'POST' });
  const original = JSON.parse(run.body);
  assert.equal(original.results.length, 1);
  await new Promise(resolve => dashboard.server.close(resolve));

  dashboard = await listenDashboard(root);
  t.after(() => { if (dashboard.server.listening) dashboard.server.close(); });
  const restored = JSON.parse((await dashboard.request('/api/report')).body);
  assert.equal(restored.runId, original.runId);
  assert.deepEqual(restored.results[0].details, { ready: true });
  assert.ok(Number.isFinite(restored.results[0].durationMs));
  assert.ok(Number.isFinite(restored.durationMs));
});

test('report loading rejects another project and tolerates corrupt or legacy timing data', () => {
  const root = makeProject('vibe-report-store-');
  const other = makeProject('vibe-report-other-');
  try {
    const legacy = {
      schemaVersion: 2,
      runId: 'legacy',
      projectDir: root,
      startedAt: '2026-08-19T00:00:00.000Z',
      finishedAt: '2026-08-19T00:00:01.250Z',
      results: [{ id: 'legacy', status: 'OK' }],
    };
    const normalized = normalizeRunReport(root, legacy);
    assert.equal(normalized.durationMs, 1250);
    assert.equal(normalized.results[0].durationMs, null);
    assert.equal(normalized.results[0].startedAt, null);
    assert.equal(normalizeRunReport(other, legacy), null);

    const runs = path.join(root, '.vibe-diagnosis', 'runs');
    fs.mkdirSync(runs, { recursive: true });
    fs.writeFileSync(path.join(runs, 'latest.json'), '{broken');
    assert.equal(loadLatestRunReport(root), null);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(other, { recursive: true, force: true });
  }
});

test('unknown dashboard APIs return structured JSON instead of plain Not found', async t => {
  const root = makeProject('vibe-json-error-');
  const dashboard = await listenDashboard(root);
  t.after(() => { if (dashboard.server.listening) dashboard.server.close(); fs.rmSync(root, { recursive: true, force: true }); });
  const missing = await dashboard.request('/api/not-supported');
  assert.equal(missing.response.status, 404);
  assert.match(missing.response.headers.get('content-type'), /application\/json/);
  assert.equal(JSON.parse(missing.body).code, 'DASHBOARD_API_NOT_FOUND');

  const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'dashboard.html'), 'utf8');
  assert.match(html, /contentType\.includes\('application\/json'\)/);
  assert.match(html, /현재 실행 중인 대시보드 서버가 구버전일 수 있습니다/);
  assert.doesNotMatch(html, /await\s+res\.json\(\)/);
});

test('frontend converts a legacy plain-text Not found response into a readable update error', async () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'dashboard.html'), 'utf8');
  const source = html.match(/async function readApiResponse[\s\S]*?\n}\n\nasync function getDashboardJson/)?.[0]
    .replace(/\n\nasync function getDashboardJson[\s\S]*$/, '');
  assert.ok(source, 'readApiResponse source should be present');
  const readApiResponse = Function(`return (${source})`)();
  const response = new Response('Not found', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  await assert.rejects(
    () => readApiResponse(response),
    error => {
      assert.equal(error.status, 404);
      assert.doesNotMatch(error.message, /Unexpected token|valid JSON/);
      assert.match(error.message, /구버전|재시작/);
      return true;
    }
  );
});

test('legacy dashboard identity is detected and only that authenticated project server is stopped', async t => {
  const root = makeProject('vibe-version-refresh-');
  const token = 'legacy-dashboard-token';
  let shutdownRequests = 0;
  const legacy = http.createServer((req, res) => {
    if (req.headers['x-vibe-dashboard-token'] !== token) { res.writeHead(403); res.end(); return; }
    res.setHeader('content-type', 'application/json');
    if (req.url === '/api/health') {
      res.end(JSON.stringify({ service: 'vibe-diagnosis-dashboard', version: '1.6.3', projectKey: projectKey(root), pid: process.pid }));
      return;
    }
    if (req.url === '/api/shutdown' && req.method === 'POST') {
      shutdownRequests += 1;
      res.end('{"success":true}');
      setImmediate(() => legacy.close());
      return;
    }
    res.writeHead(404); res.end('Not found');
  });
  t.after(() => { if (legacy.listening) legacy.close(); fs.rmSync(root, { recursive: true, force: true }); });
  await new Promise(resolve => legacy.listen(0, '127.0.0.1', resolve));
  const port = legacy.address().port;
  fs.writeFileSync(path.join(root, '.vibe-diagnosis', 'active_port.json'), JSON.stringify({ port, pid: process.pid, projectDir: root, projectKey: projectKey(root), token }));

  const before = await probeDashboard(root);
  assert.equal(before.running, true);
  assert.equal(before.compatible, false);
  assert.equal(before.compatibility.reason, 'SERVER_VERSION_MISMATCH');
  assert.equal(before.compatibility.actualVersion, '1.6.3');
  const refreshed = await refreshIncompatibleDashboard(root);
  assert.equal(refreshed.action, 'RESTART');
  assert.equal(refreshed.stopped.authenticated, true);
  assert.equal(shutdownRequests, 1);
  assert.equal(fs.existsSync(path.join(root, '.vibe-diagnosis', 'active_port.json')), false);
});
