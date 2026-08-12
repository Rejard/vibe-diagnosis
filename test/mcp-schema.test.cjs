const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

test('MCP exposes V1.6 report filters and approval-first repair tools', async () => {
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-mcp-completion-'));
  fs.mkdirSync(path.join(projectDir, '.vibe-diagnosis', 'diagnostics'), { recursive: true });
  fs.writeFileSync(path.join(projectDir, '.vibe-diagnosis', 'diagnostics', 'ok.diag.js'), `module.exports={id:'ok',name:'ok',layer:'TASK',async run(){return {status:'OK',details:'verified'}}}`, 'utf8');
  const marker = path.join(projectDir, 'module-loaded.txt').replace(/\\/g, '\\\\');
  fs.writeFileSync(path.join(projectDir, '.vibe-diagnosis', 'diagnostics', 'metadata.diag.js'), `require('fs').writeFileSync('${marker}','loaded');module.exports={id:'metadata',name:'metadata',layer:'TASK',async run(){return {status:'OK'}}}`, 'utf8');
  const child = spawn(process.execPath, ['index.js'], { cwd: path.join(__dirname, '..', 'mcp-server'), stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  let buffer = '';
  const pending = new Map();
  child.stdout.on('data', chunk => {
    buffer += chunk.toString('utf8');
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines.filter(Boolean)) {
      const message = JSON.parse(line);
      if (message.id !== undefined && pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id); }
    }
  });
  let nextId = 1;
  function request(method, params) {
    const id = nextId++;
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`MCP timeout: ${method}`)), 5000);
      pending.set(id, message => { clearTimeout(timer); resolve(message); });
    });
  }
  try {
    await request('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'schema-test', version: '1.0.0' } });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
    const listed = await request('tools/list', {});
    const tools = new Map(listed.result.tools.map(tool => [tool.name, tool]));
    for (const name of ['run_diagnostics', 'complete_task_diagnostics', 'verify_completion_receipt', 'open_dashboard', 'stop_dashboard', 'plan_repair', 'apply_repair_plan', 'list_repair_incidents', 'audit_diagnostics']) assert.ok(tools.has(name), `missing ${name}`);
    const runProperties = tools.get('run_diagnostics').inputSchema.properties;
    for (const name of ['ids', 'tags', 'scope', 'severity', 'useCache', 'baselineId']) assert.ok(runProperties[name], `run_diagnostics missing ${name}`);
    assert.equal(runProperties.autoLaunchDashboard.default, false);
    const applyProperties = tools.get('apply_repair_plan').inputSchema.properties;
    assert.ok(applyProperties.approved);
    assert.ok(applyProperties.approvedChecksum);
    assert.ok(applyProperties.approvedHighRisk);
    assert.equal(tools.get('list_diagnostics').annotations.readOnlyHint, true);
    assert.equal(tools.get('verify_completion_receipt').annotations.readOnlyHint, true);
    assert.equal(tools.get('apply_repair_plan').annotations.destructiveHint, true);
    assert.equal(tools.get('plan_repair').annotations.openWorldHint, true);
    const metadata = await request('tools/call', { name: 'list_diagnostics', arguments: { projectDir } });
    assert.equal(metadata.result.isError, undefined);
    assert.equal(fs.existsSync(path.join(projectDir, 'module-loaded.txt')), false);
    fs.writeFileSync(path.join(projectDir, '.vibe-diagnosis', 'diagnostics', 'metadata.diag.js'), `module.exports={id:'metadata',name:'metadata',layer:'TASK',async run(){return {status:'OK'}}}`, 'utf8');
    const rulesBefore = fs.existsSync(path.join(projectDir, 'AGENTS.md')) ? fs.readFileSync(path.join(projectDir, 'AGENTS.md'), 'utf8') : null;
    const completed = await request('tools/call', { name: 'complete_task_diagnostics', arguments: { projectDir } });
    const report = JSON.parse(completed.result.content[0].text);
    assert.equal(report.completion.eligible, true);
    assert.equal(report.completion.dashboardRequired, false);
    const receipt = await request('tools/call', { name: 'verify_completion_receipt', arguments: { projectDir } });
    assert.equal(JSON.parse(receipt.result.content[0].text).valid, true);
    assert.equal(fs.existsSync(path.join(projectDir, '.vibe-diagnosis', 'active_port.json')), false);
    const rulesAfter = fs.existsSync(path.join(projectDir, 'AGENTS.md')) ? fs.readFileSync(path.join(projectDir, 'AGENTS.md'), 'utf8') : null;
    assert.equal(rulesAfter, rulesBefore);
  } finally {
    child.kill();
    fs.rmSync(projectDir, { recursive: true, force: true });
  }
});
