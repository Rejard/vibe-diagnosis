const fs = require('fs');
const path = require('path');

const TEMPLATE_DIR = path.join(__dirname, '..', 'templates');

function initialize(targetDir) {
  const diagRoot = path.join(targetDir, '.vibe-diagnosis');
  const diagnosticsDir = path.join(diagRoot, 'diagnostics');
  const errorPatternsDir = path.join(diagRoot, 'error-patterns');

  if (fs.existsSync(diagRoot)) {
    console.log(`\n  \x1b[33m⚠️  .vibe-diagnosis/ already exists in ${targetDir}\x1b[0m\n`);
    return;
  }

  fs.mkdirSync(diagnosticsDir, { recursive: true });
  fs.mkdirSync(errorPatternsDir, { recursive: true });

  const configSrc = path.join(TEMPLATE_DIR, 'config.json');
  const configDest = path.join(diagRoot, 'config.json');
  fs.copyFileSync(configSrc, configDest);

  const exampleSrc = path.join(TEMPLATE_DIR, 'example.diag.js');
  const exampleDest = path.join(diagnosticsDir, 'example.diag.js');
  fs.copyFileSync(exampleSrc, exampleDest);

  const errorPatternSrc = path.join(TEMPLATE_DIR, 'error-pattern.md');
  const errorPatternDest = path.join(errorPatternsDir, 'ERR_000_template.md');
  fs.copyFileSync(errorPatternSrc, errorPatternDest);

  console.log(`\n  \x1b[32m✅ Initialized .vibe-diagnosis/ in ${targetDir}\x1b[0m`);
  console.log('');
  console.log('  Created:');
  console.log('    .vibe-diagnosis/');
  console.log('    ├── config.json');
  console.log('    ├── diagnostics/');
  console.log('    │   └── example.diag.js');
  console.log('    └── error-patterns/');
  console.log('        └── ERR_000_template.md');
  console.log('');
  console.log('  Next steps:');
  console.log('    1. Edit diagnostics/example.diag.js or create new .diag.js files');
  console.log('    2. Run: npx vibe-diag run');
  console.log('');
}

module.exports = { initialize };
