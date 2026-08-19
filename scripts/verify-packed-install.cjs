const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawn } = require('child_process');

const root = path.resolve(__dirname, '..');
const expectedVersion = require(path.join(root, 'package.json')).version;
const npmCli = process.platform === 'win32'
  ? path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js')
  : null;
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-packed-install-'));
const packageDir = path.join(temporary, 'packages');
const consumerDir = path.join(temporary, 'consumer');
const projectDir = path.join(temporary, 'project');

function run(command, args, cwd) {
  return execFileSync(command, args, { cwd, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
}

function runNpm(args, cwd) {
  return process.platform === 'win32'
    ? run(process.execPath, [npmCli, ...args], cwd)
    : run('npm', args, cwd);
}

function requestClient(entry) {
  const child = spawn(process.execPath, [entry], { cwd: consumerDir, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  let buffer = '';
  let nextId = 1;
  const pending = new Map();
  child.stdout.on('data', chunk => {
    buffer += chunk.toString('utf8');
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines.filter(Boolean)) {
      const message = JSON.parse(line);
      if (message.id !== undefined && pending.has(message.id)) {
        pending.get(message.id)(message);
        pending.delete(message.id);
      }
    }
  });
  function request(method, params) {
    const id = nextId++;
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Packed MCP timeout: ${method}`)), 10000);
      pending.set(id, message => { clearTimeout(timer); resolve(message); });
    });
  }
  return { child, request };
}

async function main() {
  fs.mkdirSync(packageDir, { recursive: true });
  fs.mkdirSync(consumerDir, { recursive: true });
  fs.mkdirSync(path.join(projectDir, '.vibe-diagnosis', 'diagnostics'), { recursive: true });
  fs.writeFileSync(path.join(projectDir, '.vibe-diagnosis', 'diagnostics', 'ok.diag.js'), `module.exports={id:'packed-ok',name:'packed ok',layer:'TASK',async run(){return {status:'OK',details:'installed package verified'}}}`, 'utf8');

  const rootPack = JSON.parse(runNpm(['pack', '--json', '--pack-destination', packageDir], root))[0];
  const mcpPack = JSON.parse(runNpm(['pack', '--json', '--pack-destination', packageDir], path.join(root, 'mcp-server')))[0];
  const rootTarball = path.join(packageDir, rootPack.filename);
  const mcpTarball = path.join(packageDir, mcpPack.filename);
  const rootFiles = rootPack.files.map(file => file.path.replace(/\\/g, '/'));
  assert.equal(rootFiles.some(file => file.startsWith('.vibe-diagnosis/')), false);
  assert.equal(rootFiles.some(file => file.startsWith('test/') || file.startsWith('examples/')), false);
  assert.ok(rootFiles.includes('src/dashboard-control.js'));
  assert.ok(rootFiles.includes('src/completion-receipt.js'));
  assert.ok(rootFiles.includes('src/diagnostics-lock.js'));
  assert.ok(rootFiles.includes('src/dashboard-contract.js'));
  assert.ok(rootFiles.includes('src/report-store.js'));
  assert.ok(rootFiles.includes('src/report-view.js'));
  assert.ok(rootFiles.includes('src/port-probe.js'));
  assert.deepEqual(mcpPack.files.map(file => file.path).sort(), ['LICENSE', 'README.md', 'index.js', 'package.json']);
  runNpm(['init', '-y'], consumerDir);
  runNpm(['install', '--ignore-scripts', rootTarball], consumerDir);
  runNpm(['install', '--ignore-scripts', mcpTarball], consumerDir);

  const installedPackage = require(path.join(consumerDir, 'node_modules', 'vibe-diagnosis', 'package.json'));
  const installedMcpPackage = require(path.join(consumerDir, 'node_modules', 'vibe-diagnosis-mcp', 'package.json'));
  assert.equal(installedPackage.version, expectedVersion);
  assert.equal(installedMcpPackage.version, expectedVersion);
  assert.ok(fs.existsSync(path.join(consumerDir, 'node_modules', 'vibe-diagnosis', 'src', 'dashboard-control.js')));

  const entry = path.join(consumerDir, 'node_modules', 'vibe-diagnosis-mcp', 'index.js');
  const client = requestClient(entry);
  try {
    await client.request('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'packed-smoke', version: '1.0.0' } });
    client.child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`);
    const listed = await client.request('tools/list', {});
    const tools = new Map(listed.result.tools.map(tool => [tool.name, tool]));
    for (const name of ['run_diagnostics', 'complete_task_diagnostics', 'verify_completion_receipt', 'open_dashboard', 'stop_dashboard', 'plan_repair', 'apply_repair_plan', 'set_diagnostic_state', 'remove_diagnostic', 'restore_diagnostic']) assert.ok(tools.has(name), `Packed MCP missing ${name}`);
    assert.equal(tools.get('run_diagnostics').inputSchema.properties.autoLaunchDashboard.default, false);
    assert.equal(tools.get('run_diagnostics').inputSchema.properties.verbosity.default, 'summary');
    const completed = await client.request('tools/call', { name: 'complete_task_diagnostics', arguments: { projectDir } });
    assert.notEqual(completed.result.isError, true);
    const report = JSON.parse(completed.result.content[0].text);
    assert.equal(report.completion.eligible, true);
    assert.equal(report.completion.dashboardRequired, false);
    assert.equal(report.response.verbosity, 'summary');
    const receipt = await client.request('tools/call', { name: 'verify_completion_receipt', arguments: { projectDir } });
    assert.equal(JSON.parse(receipt.result.content[0].text).valid, true);
    assert.equal(fs.existsSync(path.join(projectDir, '.vibe-diagnosis', 'active_port.json')), false);
    process.stdout.write(`${JSON.stringify({ verified: true, rootTarball: rootPack.filename, mcpTarball: mcpPack.filename, tools: tools.size, completion: report.completion }, null, 2)}\n`);
  } finally {
    client.child.kill();
  }
}

main().finally(() => fs.rmSync(temporary, { recursive: true, force: true }));
