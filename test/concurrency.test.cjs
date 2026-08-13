const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { runDiagnosticsReport } = require('../src/runner');
const {
  ERROR_CODE,
  acquireDiagnosticsLock,
  withDiagnosticsLock,
  lockPathForProject,
  projectKey,
  normalizeProjectDir,
} = require('../src/diagnostics-lock');

function project(name = 'vibe-concurrency-') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), name));
  fs.mkdirSync(path.join(root, '.vibe-diagnosis', 'diagnostics'), { recursive: true });
  return root;
}

function delayedDiagnostic(root, delayMs = 500) {
  const marker = path.join(root, 'started.marker').replace(/\\/g, '\\\\');
  fs.writeFileSync(path.join(root, '.vibe-diagnosis', 'diagnostics', 'slow.diag.js'), `
const fs=require('fs');
module.exports={id:'slow',name:'slow',layer:'SYSTEM',async run(){
  fs.appendFileSync('${marker}','started\\n');
  await new Promise(resolve=>setTimeout(resolve,${delayMs}));
  return {status:'OK',details:'single execution'};
}};`, 'utf8');
  return marker.replace(/\\\\/g, '\\');
}

test('expired async execution context cannot bypass a later project lock', async t => {
  const root = project('vibe-expired-context-');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  let resolveAttempt;
  const delayedAttempt = new Promise(resolve => { resolveAttempt = resolve; });
  await withDiagnosticsLock(root, { executionKind: 'outer' }, async () => {
    setTimeout(async () => {
      try {
        await withDiagnosticsLock(root, { executionKind: 'delayed' }, async () => 'unexpected');
        resolveAttempt('BYPASSED');
      } catch (error) {
        resolveAttempt(error.code);
      }
    }, 30);
  });
  const owner = acquireDiagnosticsLock(root, { executionKind: 'new-owner' });
  t.after(() => owner.release());
  assert.equal(await delayedAttempt, ERROR_CODE);
});

async function waitForFile(file, timeoutMs = 5000) {
  const started = Date.now();
  while (!fs.existsSync(file)) {
    if (Date.now() - started > timeoutMs) throw new Error(`Timed out waiting for ${path.basename(file)}`);
    await new Promise(resolve => setTimeout(resolve, 20));
  }
}

function runInChild(root, executionKind = 'child') {
  const runnerPath = path.join(__dirname, '..', 'src', 'runner.js');
  const code = `const {runDiagnosticsReport}=require(${JSON.stringify(runnerPath)});runDiagnosticsReport(process.argv[1],{persist:false,compareBaseline:false,executionKind:process.argv[2]}).then(r=>{process.stdout.write(JSON.stringify({ok:true,status:r.overallStatus}))}).catch(e=>{process.stdout.write(JSON.stringify({ok:false,code:e.code,startedAt:e.startedAt}));process.exitCode=e.code==='${ERROR_CODE}'?2:1})`;
  return spawn(process.execPath, ['-e', code, root, executionKind], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
}

function collect(child) {
  return new Promise(resolve => {
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', data => { stdout += data; });
    child.stderr.on('data', data => { stderr += data; });
    child.on('close', code => resolve({ code, stdout, stderr }));
  });
}

function callMcpTool(tool, projectDir) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(__dirname, '..', 'mcp-server', 'index.js')], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    let buffer = '';
    let stderr = '';
    const timer = setTimeout(() => { child.kill(); reject(new Error(`MCP timeout: ${stderr}`)); }, 10000);
    child.stderr.on('data', data => { stderr += data; });
    child.stdout.on('data', data => {
      buffer += data;
      let newline;
      while ((newline = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        if (!line.trim()) continue;
        const message = JSON.parse(line);
        if (message.id === 1) {
          child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
          child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: tool, arguments: { projectDir } } }) + '\n');
        } else if (message.id === 2) {
          clearTimeout(timer);
          child.kill();
          resolve(message.result);
        }
      }
    });
    child.on('error', reject);
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'concurrency-test', version: '1.0.0' } } }) + '\n');
  });
}

test('same-process duplicate fails immediately and executes the diagnostic once', async t => {
  const root = project();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const marker = delayedDiagnostic(root, 450);
  const first = runDiagnosticsReport(root, { persist: false, compareBaseline: false, executionKind: 'first' });
  await waitForFile(marker);
  const conflictStarted = Date.now();
  await assert.rejects(
    runDiagnosticsReport(root, { persist: false, compareBaseline: false, executionKind: 'second' }),
    error => error.code === ERROR_CODE && Boolean(error.startedAt),
  );
  assert.ok(Date.now() - conflictStarted < 250);
  assert.equal((await first).overallStatus, 'OK');
  assert.equal(fs.readFileSync(marker, 'utf8').trim().split(/\r?\n/).length, 1);
});

test('cross-process duplicate is rejected without starting another diagnostic', async t => {
  const root = project();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const marker = delayedDiagnostic(root, 650);
  const first = runInChild(root, 'process-one');
  const firstResult = collect(first);
  await waitForFile(marker);
  const second = runInChild(root, 'process-two');
  const secondResult = await collect(second);
  assert.equal(secondResult.code, 2);
  assert.equal(JSON.parse(secondResult.stdout).code, ERROR_CODE);
  assert.equal((await firstResult).code, 0);
  assert.equal(fs.readFileSync(marker, 'utf8').trim().split(/\r?\n/).length, 1);
});

test('different projects can run diagnostics concurrently', async t => {
  const firstRoot = project('vibe-concurrency-a-');
  const secondRoot = project('vibe-concurrency-b-');
  t.after(() => {
    fs.rmSync(firstRoot, { recursive: true, force: true });
    fs.rmSync(secondRoot, { recursive: true, force: true });
  });
  delayedDiagnostic(firstRoot, 250);
  delayedDiagnostic(secondRoot, 250);
  const [first, second] = await Promise.all([
    runDiagnosticsReport(firstRoot, { persist: false, compareBaseline: false }),
    runDiagnosticsReport(secondRoot, { persist: false, compareBaseline: false }),
  ]);
  assert.equal(first.overallStatus, 'OK');
  assert.equal(second.overallStatus, 'OK');
});

test('lock releases after an exception', async t => {
  const root = project();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  await assert.rejects(withDiagnosticsLock(root, { executionKind: 'throwing' }, async () => { throw new Error('fixture failure'); }), /fixture failure/);
  const next = acquireDiagnosticsLock(root, { executionKind: 'after-error' });
  next.release();
});

test('dead PID and old invalid locks are reclaimed, while a live PID lock is preserved', t => {
  const deadRoot = project('vibe-dead-lock-');
  const invalidRoot = project('vibe-invalid-lock-');
  const liveRoot = project('vibe-live-lock-');
  t.after(() => {
    for (const root of [deadRoot, invalidRoot, liveRoot]) fs.rmSync(root, { recursive: true, force: true });
  });

  const deadPath = lockPathForProject(deadRoot);
  fs.mkdirSync(path.dirname(deadPath), { recursive: true });
  fs.writeFileSync(deadPath, JSON.stringify({
    projectDir: normalizeProjectDir(deadRoot),
    projectKey: projectKey(deadRoot),
    pid: 2147483647,
    startedAt: new Date(Date.now() - 60000).toISOString(),
    executionKind: 'dead',
    ownerToken: 'dead-owner-token-123456',
  }), { flag: 'wx' });
  const recoveredDead = acquireDiagnosticsLock(deadRoot);
  recoveredDead.release();

  const invalidPath = lockPathForProject(invalidRoot);
  fs.writeFileSync(invalidPath, '{invalid', { flag: 'wx' });
  const old = new Date(Date.now() - 10000);
  fs.utimesSync(invalidPath, old, old);
  const recoveredInvalid = acquireDiagnosticsLock(invalidRoot);
  assert.throws(() => acquireDiagnosticsLock(invalidRoot), error => error.code === ERROR_CODE);
  recoveredInvalid.release();

  const live = acquireDiagnosticsLock(liveRoot, { executionKind: 'live' });
  assert.throws(() => acquireDiagnosticsLock(liveRoot), error => error.code === ERROR_CODE && error.executionKind === 'live');
  assert.equal(fs.existsSync(live.lockPath), true);
  live.release();
});

test('CLI returns a structured conflict while another process owns the project lock', async t => {
  const root = project();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const owner = acquireDiagnosticsLock(root, { executionKind: 'test-owner' });
  t.after(() => owner.release());
  const result = spawnSync(process.execPath, [path.join(__dirname, '..', 'bin', 'vibe-diag.js'), 'run', '--json', '--cwd', root], { encoding: 'utf8', windowsHide: true });
  assert.equal(result.status, 2);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.code, ERROR_CODE);
  assert.ok(payload.startedAt);
  assert.equal(payload.projectDir, undefined);
});

test('MCP run and completion tools return structured conflicts without retrying', async t => {
  const root = project();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const owner = acquireDiagnosticsLock(root, { executionKind: 'dashboard' });
  t.after(() => owner.release());
  for (const tool of ['run_diagnostics', 'complete_task_diagnostics']) {
    const result = await callMcpTool(tool, root);
    assert.equal(result.isError, true);
    const payload = JSON.parse(result.content[0].text);
    assert.equal(payload.code, ERROR_CODE);
    assert.equal(payload.executionKind, 'dashboard');
    assert.ok(payload.startedAt);
    assert.equal(payload.projectDir, undefined);
  }
});
