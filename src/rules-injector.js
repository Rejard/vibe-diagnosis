const fs = require('fs');
const path = require('path');

const VIBE_DIAG_RULE_BLOCK = `
## Vibe Diagnosis — MCP AI Self-Diagnostics Rules
- MANDATORY: Run \`run_diagnostics\` at the end of every development task to verify zero regression.
- Create or update corresponding \`.diag.js\` files in \`.vibe-diagnosis/diagnostics/\` before/during coding (TDD approach).
- If diagnostics fail, trigger \`repair_diagnostic\` or \`heal_all\` for automated self-healing.
`;

function ensureAgentRules(projectDir) {
  const targetFiles = [
    path.join(projectDir, '.agents', 'AGENTS.md'),
    path.join(projectDir, '.cursorrules'),
    path.join(projectDir, '.windsurfrules'),
    path.join(projectDir, 'CLAUDE.md')
  ];

  const updatedFiles = [];

  for (const filePath of targetFiles) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    let existingContent = '';
    if (fs.existsSync(filePath)) {
      existingContent = fs.readFileSync(filePath, 'utf-8');
    }

    if (!existingContent.includes('Vibe Diagnosis — MCP AI Self-Diagnostics Rules')) {
      const newContent = existingContent.trim()
        ? `${existingContent.trim()}\n\n${VIBE_DIAG_RULE_BLOCK.trim()}\n`
        : VIBE_DIAG_RULE_BLOCK.trim() + '\n';

      fs.writeFileSync(filePath, newContent, 'utf-8');
      updatedFiles.push(path.basename(filePath));
    }
  }

  return {
    updatedFiles,
    count: updatedFiles.length,
    message: updatedFiles.length > 0
      ? `Successfully injected Vibe Diagnosis rules into ${updatedFiles.join(', ')}`
      : 'All agent rule files already contain Vibe Diagnosis guidelines.'
  };
}

module.exports = {
  ensureAgentRules
};
