const fs = require('fs');
const path = require('path');

const START_MARKER = '<!-- vibe-diagnosis-rules:start -->';
const END_MARKER = '<!-- vibe-diagnosis-rules:end -->';
const LEGACY_HEADING = '## Vibe Diagnosis — MCP AI Self-Diagnostics Rules';
const VIBE_DIAG_RULE_BLOCK = `${START_MARKER}
## Vibe Diagnosis MCP self-diagnostics

- Before implementation, initialize or inspect \`.vibe-diagnosis/diagnostics/\` and add or update diagnostics for the requested behavior.
- During implementation, use \`run_diagnostics\` when focused feedback is useful. The dashboard is optional and must not be required for diagnosis.
- MANDATORY: Immediately before reporting a development task complete, call \`complete_task_diagnostics\` with the project root. This runs the full diagnostic suite without cache or dashboard.
- Do not report completion unless \`completion.eligible\` is true and the returned completion receipt matches the current workspace fingerprint. Never reuse a receipt from an earlier workspace state.
- Report failures, warnings, release/live gates, and missing or stale evidence accurately.
- If diagnostics fail, create a repair plan with \`plan_repair\` or \`repair_diagnostic\`. Never call \`apply_repair_plan\` without explicit user approval of the displayed plan checksum and separate high-risk approval when required.
${END_MARKER}`;

function replaceLegacyBlock(content) {
  const index = content.indexOf(LEGACY_HEADING);
  if (index === -1) return null;
  const nextHeading = content.indexOf('\n## ', index + LEGACY_HEADING.length);
  const end = nextHeading === -1 ? content.length : nextHeading + 1;
  return `${content.slice(0, index)}${VIBE_DIAG_RULE_BLOCK}\n${content.slice(end)}`;
}

function upsertRules(content) {
  const start = content.indexOf(START_MARKER);
  const end = content.indexOf(END_MARKER);
  if (start !== -1 && end !== -1 && end >= start) {
    return `${content.slice(0, start)}${VIBE_DIAG_RULE_BLOCK}${content.slice(end + END_MARKER.length)}`;
  }
  const replaced = replaceLegacyBlock(content);
  if (replaced !== null) return replaced;
  const prefix = content.trimEnd();
  return `${prefix}${prefix ? '\n\n' : ''}${VIBE_DIAG_RULE_BLOCK}\n`;
}

function ensureAgentRules(projectDir) {
  const targetFiles = [
    path.join(projectDir, 'AGENTS.md'),
    path.join(projectDir, '.agents', 'AGENTS.md'),
    path.join(projectDir, '.cursorrules'),
    path.join(projectDir, '.windsurfrules'),
    path.join(projectDir, 'CLAUDE.md'),
    path.join(projectDir, 'GEMINI.md'),
  ];
  const updatedFiles = [];

  for (const filePath of targetFiles) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
    const next = upsertRules(existing);
    if (next !== existing) {
      fs.writeFileSync(filePath, next, 'utf8');
      updatedFiles.push(path.relative(projectDir, filePath).replace(/\\/g, '/'));
    }
  }

  return {
    updatedFiles,
    count: updatedFiles.length,
    message: updatedFiles.length
      ? `Synchronized Vibe Diagnosis completion rules in ${updatedFiles.join(', ')}`
      : 'All supported agent rule files already contain current Vibe Diagnosis rules.',
  };
}

module.exports = { ensureAgentRules, upsertRules, VIBE_DIAG_RULE_BLOCK };
