const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { dashboardIdentity, dashboardCompatibility } = require('../src/dashboard-contract');

const root = path.resolve(__dirname, '..');
const rootPackage = require('../package.json');
const mcpPackage = require('../mcp-server/package.json');
const extensionPackage = require('../vscode-extension/package.json');

test('the published packages carry the same version', () => {
  assert.equal(
    mcpPackage.version,
    rootPackage.version,
    `mcp-server/package.json is ${mcpPackage.version} while package.json is ${rootPackage.version}. ` +
    'dashboardCompatibility requires an exact match, so a dashboard started by one would refuse the other.'
  );
});

test('the VS Code extension ships the same version as the core package', () => {
  assert.equal(
    extensionPackage.version,
    rootPackage.version,
    `vscode-extension is ${extensionPackage.version} while this release is ${rootPackage.version}. ` +
    'The extension refuses a dashboard whose version differs, so a user with both installed sees "Dashboard update required".'
  );
});

test('the MCP package depends on the core package at the version being released', () => {
  assert.equal(
    mcpPackage.dependencies['vibe-diagnosis'],
    rootPackage.version,
    `mcp-server depends on vibe-diagnosis ${mcpPackage.dependencies['vibe-diagnosis']} while this release is ${rootPackage.version}. ` +
    'Publishing that pair ships a dashboard and an MCP server that refuse each other on every user machine.'
  );
});

test('no source file hardcodes a version string', () => {
  const files = ['mcp-server/index.js', 'src/dashboard-contract.js', 'src/dashboard.js', 'src/dashboard.html', 'bin/vibe-diag.js', 'vscode-extension/src/dashboard-client.js'];
  const pattern = /["'`]\d+\.\d+\.\d+["'`]/u;
  for (const file of files) {
    const absolute = path.join(root, file);
    if (!fs.existsSync(absolute)) continue;
    const offenders = fs.readFileSync(absolute, 'utf8')
      .split('\n')
      .map((line, index) => ({ line: line.trim(), number: index + 1 }))
      .filter(entry => pattern.test(entry.line) && !/protocolVersion|apiVersion|engines|node\s*[:>]/u.test(entry.line));
    assert.deepEqual(
      offenders,
      [],
      `${file} hardcodes a version. Read it from package.json so a release cannot bump one place and miss another.`
    );
  }
});

test('the MCP server reports the packaged version over stdio', () => {
  const request = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'parity', version: '1.0' } }
  });
  const result = spawnSync(process.execPath, [path.join(root, 'mcp-server', 'index.js')], {
    input: `${request}\n`,
    encoding: 'utf8',
    timeout: 30000,
    windowsHide: true
  });
  const line = String(result.stdout || '').split('\n').find(entry => entry.includes('serverInfo'));
  assert.ok(line, `MCP server produced no initialize response. stderr: ${String(result.stderr || '').slice(0, 300)}`);
  assert.equal(JSON.parse(line).result.serverInfo.version, mcpPackage.version);
});

test('a dashboard started by this build accepts this build', () => {
  const identity = dashboardIdentity(root);
  assert.equal(identity.version, rootPackage.version);
  assert.deepEqual(dashboardCompatibility(identity), { compatible: true, reason: null });
});

test('a dashboard left running by an older build is refused, not silently trusted', () => {
  const stale = { ...dashboardIdentity(root), version: '0.0.1' };
  const verdict = dashboardCompatibility(stale);
  assert.equal(verdict.compatible, false);
  assert.equal(verdict.reason, 'SERVER_VERSION_MISMATCH');
  assert.equal(verdict.expectedVersion, rootPackage.version);
});
