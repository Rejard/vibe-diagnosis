const fs = require('fs');
const path = require('path');
const { ensureGitignore } = require('./config-manager');

const TEMPLATE_DIR = path.join(__dirname, '..', 'templates');

const MCP_CONFIG = {
  command: 'npx',
  args: ['-y', 'vibe-diagnosis-mcp'],
};

function setupGeminiMcp(targetDir) {
  const geminiDir = path.join(targetDir, '.gemini');
  const settingsPath = path.join(geminiDir, 'settings.json');

  fs.mkdirSync(geminiDir, { recursive: true });

  let settings = {};
  if (fs.existsSync(settingsPath)) {
    try {
      settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    } catch {
      settings = {};
    }
  }

  if (!settings.mcpServers) {
    settings.mcpServers = {};
  }

  if (settings.mcpServers['vibe-diagnosis']) {
    return false;
  }

  settings.mcpServers['vibe-diagnosis'] = MCP_CONFIG;
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf-8');
  return true;
}

function initialize(targetDir) {
  const diagRoot = path.join(targetDir, '.vibe-diagnosis');
  const diagnosticsDir = path.join(diagRoot, 'diagnostics');
  const errorPatternsDir = path.join(diagRoot, 'error-patterns');
  const alreadyInitialized = fs.existsSync(diagRoot);

  if (!alreadyInitialized) {
    fs.mkdirSync(diagnosticsDir, { recursive: true });
    fs.mkdirSync(errorPatternsDir, { recursive: true });

    const configSrc = path.join(TEMPLATE_DIR, 'config.json');
    const configDest = path.join(diagRoot, 'config.json');
    fs.copyFileSync(configSrc, configDest);

    const exampleSrc = path.join(TEMPLATE_DIR, 'example.diag.js');
    const exampleDest = path.join(diagnosticsDir, 'example.diag.js');
    fs.copyFileSync(exampleSrc, exampleDest);

    const monoUiScannerSrc = path.join(TEMPLATE_DIR, 'monolithic_ui_scanner.diag.js');
    if (fs.existsSync(monoUiScannerSrc)) fs.copyFileSync(monoUiScannerSrc, path.join(diagnosticsDir, 'monolithic_ui_scanner.diag.js'));

    const cartridgeIntegritySrc = path.join(TEMPLATE_DIR, 'cartridge_integrity_template.diag.js');
    if (fs.existsSync(cartridgeIntegritySrc)) fs.copyFileSync(cartridgeIntegritySrc, path.join(diagnosticsDir, 'cartridge_integrity_template.diag.js'));

    const errorPatternSrc = path.join(TEMPLATE_DIR, 'error-pattern.md');
    const errorPatternDest = path.join(errorPatternsDir, 'ERR_000_template.md');
    fs.copyFileSync(errorPatternSrc, errorPatternDest);

    const omissionPatternSrc = path.join(TEMPLATE_DIR, 'PATTERN_UI_BLOCK_OMISSION.md');
    if (fs.existsSync(omissionPatternSrc)) fs.copyFileSync(omissionPatternSrc, path.join(errorPatternsDir, 'PATTERN_UI_BLOCK_OMISSION.md'));
  }

  ensureGitignore(targetDir);

  let rulesResult = { updatedFiles: [], count: 0 };
  try {
    const { ensureAgentRules } = require('./rules-injector');
    rulesResult = ensureAgentRules(targetDir);
  } catch (e) {
    // Safe skip if module load fails
  }

  if (!alreadyInitialized) try {
    const { saveAiContext } = require('./context-manager');
    saveAiContext(targetDir, {
      currentGoal: 'Project Initialized with Vibe Diagnosis MCP',
      lastTask: 'init_diagnostics'
    });
  } catch (e) {
    // Safe skip
  }

  const mcpAdded = setupGeminiMcp(targetDir);

  if (alreadyInitialized) {
    console.log(`\n  \x1b[32m✅ Refreshed Vibe Diagnosis agent integration in ${targetDir}\x1b[0m`);
    console.log(`  Agent rules updated: ${rulesResult.count}`);
    console.log(`  Gemini MCP configured: ${mcpAdded ? 'yes' : 'already configured'}`);
    return { initialized: false, refreshed: true, rules: rulesResult, mcpAdded };
  }

  console.log(`\n  \x1b[32m✅ Initialized .vibe-diagnosis/ in ${targetDir}\x1b[0m`);
  console.log('');
  console.log('  Created:');
  console.log('    .vibe-diagnosis/');
  console.log('    ├── config.json');
  console.log('    ├── active_context.json');
  console.log('    ├── diagnostics/');
  console.log('    │   ├── example.diag.js');
  console.log('    │   ├── monolithic_ui_scanner.diag.js');
  console.log('    │   └── cartridge_integrity_template.diag.js');
  console.log('    └── error-patterns/');
  console.log('        ├── ERR_000_template.md');
  console.log('        └── PATTERN_UI_BLOCK_OMISSION.md');

  if (mcpAdded) {
    console.log('');
    console.log('    .gemini/');
    console.log('    └── settings.json  ← \x1b[36mMCP auto-configured\x1b[0m');
  }

  console.log('');
  console.log('  Next steps:');
  console.log('    1. Edit diagnostics/example.diag.js or create new .diag.js files');
  console.log('    2. Run: npx vibe-diag run');
  console.log('    3. Configure BYOK in dashboard: npx vibe-diag dashboard');
  console.log('');
  return { initialized: true, refreshed: false, rules: rulesResult, mcpAdded };
}


module.exports = { initialize };
