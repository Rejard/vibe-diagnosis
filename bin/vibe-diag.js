#!/usr/bin/env node

const path = require('path');

const args = process.argv.slice(2);
const command = args[0];

const flags = {
  json: args.includes('--json'),
  cwd: null,
  port: 7700,
};

const cwdIndex = args.indexOf('--cwd');
if (cwdIndex !== -1 && args[cwdIndex + 1]) {
  flags.cwd = path.resolve(args[cwdIndex + 1]);
}

const portIndex = args.indexOf('--port');
if (portIndex !== -1 && args[portIndex + 1]) {
  flags.port = parseInt(args[portIndex + 1], 10) || 7700;
}

const targetDir = flags.cwd || process.cwd();

async function main() {
  switch (command) {
    case 'init': {
      const { initialize } = require('../src/init');
      await initialize(targetDir);
      break;
    }
    case 'run': {
      const { runDiagnostics } = require('../src/runner');
      const { formatResults, formatResultsJson } = require('../src/reporter');

      const results = await runDiagnostics(targetDir);

      if (flags.json) {
        process.stdout.write(formatResultsJson(results));
      } else {
        process.stdout.write(formatResults(results, targetDir));
      }

      const hasError = results.some(r => r.status === 'ERROR');
      if (hasError) process.exitCode = 1;
      break;
    }
    case 'dashboard': {
      const { startDashboard } = require('../src/dashboard');
      startDashboard(targetDir, flags.port);
      break;
    }
    default: {
      const pkg = require('../package.json');
      console.log(`\n  Vibe Diagnosis v${pkg.version}\n`);
      console.log('  Usage:');
      console.log('    vibe-diag init                Initialize .vibe-diagnosis/ in current project');
      console.log('    vibe-diag run                 Run all diagnostics');
      console.log('    vibe-diag run --json           Output results as JSON');
      console.log('    vibe-diag dashboard            Open web dashboard (default port 7700)');
      console.log('    vibe-diag dashboard --port 8080  Use custom port');
      console.log('    vibe-diag --cwd <path>        Run in specified directory\n');
    }
  }
}

main().catch(err => {
  console.error('\n  Fatal:', err.message);
  process.exitCode = 1;
});
