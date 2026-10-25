const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { acquireDiagnosticsLock } = require('../src/diagnostics-lock');

test('MCP bounded waiting, cancellation, fresh execution and run-bound verification', async t => {
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-mcp-wait-'));
  t.after(() => fs.rmSync(projectDir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(projectDir, '.vibe-diagnosis/diagnostics'), { recursive: true });
  fs.writeFileSync(path.join(projectDir, '.vibe-diagnosis/diagnostics/ok.diag.js'), "module.exports={id:'ok',name:'ok',layer:'TASK',async run(){return {status:'OK'}}}");
  const child = spawn(process.execPath, [path.join(__dirname, '../mcp-server/index.js')], { cwd: path.join(__dirname, '..'), windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  t.after(() => child.kill());
  child.stderr.resume();
  let nextId = 1;
  let buffer = '';
  const pending = new Map();
  child.stdout.on('data', chunk => {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines.filter(Boolean)) {
      const message = JSON.parse(line);
      pending.get(message.id)?.(message);
    }
  });
  function send(message) { child.stdin.write(JSON.stringify({ jsonrpc: '2.0', ...message }) + '\n'); }
  function request(method, params) {
    const id = nextId++;
    const promise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('MCP request timeout')), 10000);
      pending.set(id, message => { clearTimeout(timer); pending.delete(id); resolve(message.result); });
    });
    send({ id, method, params });
    return promise;
  }
  await request('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'wait-test', version: '1' } });
  send({ method: 'notifications/initialized' });
  const listed = await request('tools/list', {});
  assert.equal(listed.tools.find(tool => tool.name === 'complete_task_diagnostics').inputSchema.properties.waitTimeoutMs.maximum, 120000);
  const owner = acquireDiagnosticsLock(projectDir);
  t.after(() => owner.release());
  const timeout = await request('tools/call', { name: 'complete_task_diagnostics', arguments: { projectDir, waitTimeoutMs: 30 } });
  assert.equal(JSON.parse(timeout.content[0].text).code, 'DIAGNOSTICS_WAIT_TIMEOUT');
  const cancelId = nextId++;
  send({ id: cancelId, method: 'tools/call', params: { name: 'complete_task_diagnostics', arguments: { projectDir, waitTimeoutMs: 5000 } } });
  await request('tools/list', {});
  send({ method: 'notifications/cancelled', params: { requestId: cancelId, reason: 'test cancellation' } });
  await request('tools/list', {});
  assert.throws(() => acquireDiagnosticsLock(projectDir), { code: 'DIAGNOSTICS_ALREADY_RUNNING' });
  owner.release();
  await new Promise(resolve => setTimeout(resolve, 250));
  assert.equal(fs.existsSync(path.join(projectDir, '.vibe-diagnosis/runs/latest-completion.json')), false);
  const secondOwner = acquireDiagnosticsLock(projectDir);
  t.after(() => secondOwner.release());
  const completion = request('tools/call', { name: 'complete_task_diagnostics', arguments: { projectDir, waitTimeoutMs: 5000 } });
  setTimeout(() => secondOwner.release(), 100);
  const completed = await completion;
  assert.equal(completed.isError, false);
  const report = JSON.parse(completed.content[0].text);
  assert.equal(report.completion.receipt.schemaVersion, 3);
  assert.equal(report.evidenceSummary.liveEvidenceStatus, 'UNVERIFIED');
  const wrong = await request('tools/call', { name: 'verify_completion_receipt', arguments: { projectDir, expectedRunId: 'another-run' } });
  assert.ok(JSON.parse(wrong.content[0].text).reasons.includes('RUN_ID_MISMATCH'));
  const own = await request('tools/call', { name: 'verify_completion_receipt', arguments: { projectDir, expectedRunId: report.runId } });
  assert.equal(JSON.parse(own.content[0].text).valid, true);
});
