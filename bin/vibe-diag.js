#!/usr/bin/env node

const path = require('path');

const args = process.argv.slice(2);
const command = args[0];

const flags = {
  json: args.includes('--json'),
  cwd: null,
};

const cwdIndex = args.indexOf('--cwd');
if (cwdIndex !== -1 && args[cwdIndex + 1]) {
  flags.cwd = path.resolve(args[cwdIndex + 1]);
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
    default: {
      const pkg = require('../package.json');
      console.log(`\n  Vibe Diagnosis v${pkg.version}\n`);
      console.log('  Usage:');
      console.log('    vibe-diag init          Initialize .vibe-diagnosis/ in current project');
      console.log('    vibe-diag run           Run all diagnostics');
      console.log('    vibe-diag run --json    Output results as JSON');
      console.log('    vibe-diag run --cwd <path>  Run diagnostics in specified directory\n');
    }
  }
}

main().catch(err => {
  console.error('\n  Fatal:', err.message);
  process.exitCode = 1;
});
