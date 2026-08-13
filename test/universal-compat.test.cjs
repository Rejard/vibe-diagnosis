const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

async function handshake(clientName) {
  const child = spawn(process.execPath, ['index.js'], { cwd: path.join(__dirname, '..', 'mcp-server'), stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  let buffer = '';
  const pending = new Map();
  const invalid = [];
  child.stdout.on('data', chunk => {
    buffer += chunk.toString('utf8');
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines.filter(Boolean)) {
      try {
        const message = JSON.parse(line);
        if (message.jsonrpc !== '2.0') invalid.push(line);
        if (message.id !== undefined && pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id); }
      } catch { invalid.push(line); }
    }
  });
  let id = 0;
  const request = (method, params) => new Promise((resolve, reject) => {
    id += 1;
    const timer = setTimeout(() => reject(new Error(`${clientName} timed out during ${method}`)), 5000);
    pending.set(id, message => { clearTimeout(timer); resolve(message); });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  });
  try {
    const initialized = await request('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: clientName, version: 'test' } });
    assert.equal(initialized.result.serverInfo.version, '1.6.3');
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
    const tools = await request('tools/list', {});
    assert.ok(tools.result.tools.some(tool => tool.name === 'complete_task_diagnostics'));
    assert.deepEqual(invalid, []);
  } finally {
    child.kill();
  }
}

for (const client of ['Codex', 'Claude Code', 'Gemini CLI']) {
  test(`MCP stdio remains compatible with ${client}`, () => handshake(client));
}

test('synthetic diagnostic catalog scales to 1000 entries without project coupling', () => {
  const result = spawnSync(process.execPath, [path.join(__dirname, '..', 'scripts', 'benchmark-scale.cjs')], { encoding: 'utf8', windowsHide: true, timeout: 30000 });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.valid, true);
  assert.deepEqual(report.results.map(item => item.count), [100, 500, 1000]);
  assert.equal(report.fixture, 'synthetic-temporary');
});
