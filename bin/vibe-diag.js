#!/usr/bin/env node

const path = require('path');
const net = require('net');
const { spawn, exec } = require('child_process');

const args = process.argv.slice(2);
const command = args[0];

const flags = {
  json: args.includes('--json'),
  all: args.includes('--all'),
  cwd: null,
  port: 7700,
  useCache: args.includes('--cache'),
  baselineId: null,
  ids: [],
  tags: [],
  scope: null,
  severity: null,
};

function flagValue(name) {
  const index = args.indexOf(name);
  return index !== -1 ? args[index + 1] : null;
}

flags.baselineId = flagValue('--baseline');
flags.ids = (flagValue('--ids') || '').split(',').filter(Boolean);
flags.tags = (flagValue('--tags') || '').split(',').filter(Boolean);
flags.scope = flagValue('--scope');
flags.severity = flagValue('--severity');

const cwdIndex = args.indexOf('--cwd');
if (cwdIndex !== -1 && args[cwdIndex + 1]) {
  flags.cwd = path.resolve(args[cwdIndex + 1]);
}

const portIndex = args.indexOf('--port');
if (portIndex !== -1 && args[portIndex + 1]) {
  flags.port = parseInt(args[portIndex + 1], 10) || 7700;
}

const targetDir = flags.cwd || process.cwd();

function isPortInUse(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(true);
      } else {
        resolve(false);
      }
    });
    server.once('listening', () => {
      server.close();
      resolve(false);
    });
    server.listen(port);
  });
}

async function findFreePort(startPort) {
  let port = startPort;
  while (await isPortInUse(port)) {
    port++;
  }
  return port;
}

function startDashboardBackground(targetDir, port) {
  const binPath = path.join(__dirname, 'vibe-diag.js');
  const child = spawn(process.execPath, [binPath, 'dashboard', '--port', port.toString(), '--cwd', targetDir], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  child.unref();
}

function openBrowser(url) {
  const cmd = process.platform === 'win32' ? `start "" "${url}"`
    : process.platform === 'darwin' ? `open "${url}"`
    : `xdg-open "${url}"`;
  exec(cmd, { windowsHide: true });
}

async function autoStartDashboardIfNeeded() {
  const fs = require('fs');
  const lockPath = path.join(targetDir, '.vibe-diagnosis', 'active_port.json');
  let port = flags.port;
  let shouldSpawn = true;

  if (!args.includes('--port') && fs.existsSync(lockPath)) {
    try {
      const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
      if (lock && lock.port) {
        const inUse = await isPortInUse(lock.port);
        if (inUse) {
          port = lock.port;
          shouldSpawn = false;
        }
      }
    } catch (e) {
      // Safe skip
    }
  }

  if (shouldSpawn) {
    const hasExplicitPort = args.includes('--port');
    port = hasExplicitPort ? flags.port : await findFreePort(flags.port);
    startDashboardBackground(targetDir, port);
    await new Promise((resolve) => setTimeout(resolve, 800));
  }

  const url = `http://localhost:${port}`;
  openBrowser(url);
}

async function main() {
  switch (command) {
    case 'init': {
      const { initialize } = require('../src/init');
      await initialize(targetDir);
      break;
    }
    case 'run': {
      const { runDiagnosticsReport } = require('../src/runner');
      const { formatResults, formatResultsJson } = require('../src/reporter');

      if (!flags.json) {
        autoStartDashboardIfNeeded().catch(() => {});
      }

      const report = await runDiagnosticsReport(targetDir, {
        persist: true,
        useCache: flags.useCache,
        baselineId: flags.baselineId,
        filters: { ids: flags.ids, tags: flags.tags, scope: flags.scope, severity: flags.severity },
      });

      if (flags.json) {
        process.stdout.write(formatResultsJson(report));
      } else {
        process.stdout.write(formatResults(report, targetDir));
      }

      if (report.summary.error > 0 || report.gates.releaseStatus === 'RELEASE_BLOCKED') process.exitCode = 1;
      break;
    }
    case 'dashboard': {
      const { startDashboard } = require('../src/dashboard');
      const hasExplicitPort = args.includes('--port');
      const port = hasExplicitPort ? flags.port : await findFreePort(flags.port);
      startDashboard(targetDir, port);
      break;
    }
    case 'config': {
      await handleConfig();
      break;
    }
    case 'repair': {
      await handleRepair();
      break;
    }
    case 'heal': {
      flags.all = true;
      autoStartDashboardIfNeeded().catch(() => {});
      await handleRepair();
      break;
    }
    case 'complete': {
      const { runCompletionDiagnostics } = require('../src/runner');
      const { formatResults, formatResultsJson } = require('../src/reporter');
      const report = await runCompletionDiagnostics(targetDir, { persist: true });
      process.stdout.write(flags.json ? formatResultsJson(report) : formatResults(report, targetDir));
      if (!report.completion.eligible) process.exitCode = 1;
      break;
    }
    case 'apply-repair': {
      await handleApplyRepair();
      break;
    }
    case 'audit': {
      const { discoverDiagnostics } = require('../src/runner');
      const { auditDiagnostics } = require('../src/diagnostic-audit');
      process.stdout.write(JSON.stringify(auditDiagnostics(targetDir, discoverDiagnostics(targetDir)), null, 2) + '\n');
      break;
    }
    case 'stop': {
      await handleStop();
      break;
    }
    default: {
      const pkg = require('../package.json');
      console.log(`\n  Vibe Diagnosis v${pkg.version}\n`);
      console.log('  Usage:');
      console.log('    vibe-diag init                Initialize .vibe-diagnosis/ in current project');
      console.log('    vibe-diag run                 Run all diagnostics');
      console.log('    vibe-diag run --json           Output results as JSON');
      console.log('    vibe-diag run --ids a,b --tags security --scope AUTH  Select diagnostics');
      console.log('    vibe-diag run --cache          Use safe opt-in STATIC/TEST cache');
      console.log('    vibe-diag complete             Run the mandatory full uncached completion check');
      console.log('    vibe-diag dashboard            Open web dashboard (default port 7700)');
      console.log('    vibe-diag dashboard --port 8080  Use custom port');
      console.log('    vibe-diag config get           Show current BYOK configuration');
      console.log('    vibe-diag config set <key> <value>  Set BYOK config (provider, apiKey, model)');
      console.log('    vibe-diag repair <diagId>      Create a reviewable repair plan');
      console.log('    vibe-diag repair --all         Create plans for all failing diagnostics');
      console.log('    vibe-diag apply-repair <planId> --approve --checksum <sha256> [--approve-high-risk]');
      console.log('    vibe-diag audit                Audit duplicate and fragile diagnostics');
      console.log('    vibe-diag stop                 Stop the running web dashboard');
      console.log('    vibe-diag --cwd <path>        Run in specified directory\n');
    }
  }
}

async function handleConfig() {
  const subCmd = args[1];
  const { getByokConfig, saveByokConfig, getResolvedByok } = require('../src/config-manager');

  if (subCmd === 'get') {
    const byok = getByokConfig(targetDir, { maskKey: true });
    const resolved = getResolvedByok(targetDir);
    const envOverrides = [];
    if (process.env.VIBE_DIAG_PROVIDER) envOverrides.push('provider');
    if (process.env.VIBE_DIAG_API_KEY) envOverrides.push('apiKey');
    if (process.env.VIBE_DIAG_MODEL) envOverrides.push('model');

    console.log(`\n  \x1b[36m🤖 BYOK Configuration\x1b[0m`);
    console.log(`  \x1b[90m${'─'.repeat(40)}\x1b[0m`);
    console.log(`  Provider:  \x1b[37m${byok.provider || '(not set)'}\x1b[0m`);
    console.log(`  API Key:   \x1b[37m${byok.apiKey || '(not set)'}\x1b[0m`);
    console.log(`  Model:     \x1b[37m${byok.model || '(not set)'}\x1b[0m`);
    if (envOverrides.length > 0) {
      console.log(`  \x1b[90m${'─'.repeat(40)}\x1b[0m`);
      console.log(`  \x1b[33m⚡ Env override:\x1b[0m ${envOverrides.join(', ')}`);
    }
    console.log('');
    return;
  }

  if (subCmd === 'set') {
    const key = args[2];
    const value = args[3];

    const validKeys = ['provider', 'apiKey', 'model'];
    if (!key || !validKeys.includes(key)) {
      console.log(`\n  \x1b[31m❌ Invalid key.\x1b[0m Valid keys: ${validKeys.join(', ')}\n`);
      process.exitCode = 1;
      return;
    }
    if (!value) {
      console.log(`\n  \x1b[31m❌ Value is required.\x1b[0m Usage: vibe-diag config set ${key} <value>\n`);
      process.exitCode = 1;
      return;
    }

    saveByokConfig(targetDir, { [key]: value });
    const display = key === 'apiKey' && value.length > 8
      ? value.slice(0, 4) + '****' + value.slice(-4)
      : value;
    console.log(`\n  \x1b[32m✅ Set ${key} = ${display}\x1b[0m\n`);
    return;
  }

  console.log('\n  Usage:');
  console.log('    vibe-diag config get               Show BYOK configuration');
  console.log('    vibe-diag config set provider <name>  Set provider (openai|anthropic|gemini|openrouter)');
  console.log('    vibe-diag config set apiKey <key>     Set API key');
  console.log('    vibe-diag config set model <name>     Set model name\n');
}

async function handleRepair() {
  const { runDiagnosticsReport } = require('../src/runner');
  const { createRepairPlan } = require('../src/repairer');
  const diagId = flags.all ? null : args[1];

  if (!diagId && !flags.all) {
    console.log('\n  Usage:');
    console.log('    vibe-diag repair <diagId>    Repair a specific diagnostic');
    console.log('    vibe-diag repair --all       Repair all failing diagnostics\n');
    return;
  }

  console.log(`\n  \x1b[36m🔧 Running diagnostics...\x1b[0m`);
  const report = await runDiagnosticsReport(targetDir, { persist: false });
  const results = report.results;
  const failing = results.filter(r => r.status === 'ERROR' || r.status === 'WARNING');

  if (failing.length === 0) {
    console.log(`  \x1b[32m✅ All diagnostics passed! Nothing to repair.\x1b[0m\n`);
    return;
  }

  let targets;
  if (flags.all) {
    targets = failing;
  } else {
    const target = failing.find(r => r.id === diagId);
    if (!target) {
      const match = results.find(r => r.id === diagId);
      if (match && match.status === 'OK') {
        console.log(`  \x1b[32m✅ "${diagId}" is already OK.\x1b[0m\n`);
      } else {
        console.log(`  \x1b[31m❌ Diagnostic "${diagId}" not found.\x1b[0m`);
        console.log(`  Available: ${results.map(r => r.id).join(', ')}\n`);
        process.exitCode = 1;
      }
      return;
    }
    targets = [target];
  }

  console.log(`  Found ${failing.length} failing, planning ${targets.length}...\n`);

  let successCount = 0;
  for (const target of targets) {
    const icon = target.status === 'ERROR' ? '🔴' : '🟡';
    process.stdout.write(`  ${icon} ${target.id.padEnd(30)} `);

    try {
      const plan = await createRepairPlan(targetDir, target, results);
      console.log(`\x1b[32mPLAN\x1b[0m ${plan.id} (${plan.risk.level}) ${plan.summary}`);
      for (const file of plan.files) console.log(`    ${file.path}\n${file.diffPreview}`);
      successCount++;
    } catch (error) { console.log(`\x1b[31mFAILED\x1b[0m ${error.message}`); }
  }

  console.log(`\n  \x1b[90m${'─'.repeat(40)}\x1b[0m`);
  console.log(`  Plans created: ${successCount}/${targets.length}`);
  if (successCount < targets.length) process.exitCode = 1;
  console.log('');
}

async function handleApplyRepair() {
  const planId = args[1];
  const approvedChecksum = flagValue('--checksum');
  if (!planId || !args.includes('--approve') || !approvedChecksum) {
    console.log('\n  Usage: vibe-diag apply-repair <planId> --approve --checksum <sha256> [--approve-high-risk]\n');
    process.exitCode = 1;
    return;
  }
  const { applyRepairPlan } = require('../src/repairer');
  const result = await applyRepairPlan(targetDir, planId, { approved: true, approvedChecksum, approvedHighRisk: args.includes('--approve-high-risk') });
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  if (!result.result?.success) process.exitCode = 1;
}

async function handleStop() {
  try {
    const { stopDashboard } = require('../src/dashboard-control');
    const result = await stopDashboard(targetDir);
    console.log(`\n  ${result.stopped ? '\x1b[32m✅' : '\x1b[33m⚠️'} ${result.status}\x1b[0m${result.port ? ` (port ${result.port})` : ''}\n`);
  } catch (e) {
    console.error('\n  \x1b[31m❌ Error stopping dashboard:\x1b[0m', e.message);
    process.exitCode = 1;
  }
}

main().catch(err => {
  console.error('\n  Fatal:', err.message);
  process.exitCode = 1;
});
