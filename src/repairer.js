const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { chat } = require('./ai-provider');
const { getResolvedByok } = require('./config-manager');
const { runDiagnostics, discoverDiagnostics } = require('./runner');

const SYSTEM_PROMPT = `You are a code repair specialist for a Node.js project.
You receive a diagnostic failure with context and must fix the root cause.

RULES:
- Return ONLY a valid JSON object, no markdown fences, no explanation outside JSON.
- Each file change must include the COMPLETE file content, not patches or diffs.
- Only modify files that directly fix the diagnostic failure.
- Do NOT add comments to the source code.
- File paths must be relative to the project root.
- If the issue cannot be fixed by modifying files, set "files" to an empty array and explain in "summary".

Response format:
{
  "files": [{ "path": "relative/path/to/file", "content": "complete file content here" }],
  "summary": "Brief explanation of what was fixed and why"
}`;

function collectContext(projectDir, diagResult) {
  const ctx = { diagnostic: diagResult, projectFiles: [], diagSource: null, errorPattern: null };
  try {
    const pkgPath = path.join(projectDir, 'package.json');
    if (fs.existsSync(pkgPath)) ctx.packageJson = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  } catch {}
  const diagFiles = discoverDiagnostics(projectDir);
  const matchingDiag = diagFiles.find(f => path.basename(f, '.diag.js') === diagResult.id);
  if (matchingDiag && fs.existsSync(matchingDiag)) ctx.diagSource = fs.readFileSync(matchingDiag, 'utf8');
  const patternsDir = path.join(projectDir, '.vibe-diagnosis', 'error-patterns');
  if (fs.existsSync(patternsDir)) {
    const match = fs.readdirSync(patternsDir).find(f => f.endsWith('.md') && f.toLowerCase().includes(diagResult.id.toLowerCase()));
    if (match) ctx.errorPattern = fs.readFileSync(path.join(patternsDir, match), 'utf8');
  }
  try { ctx.projectFiles = listProjectFiles(projectDir, '', 2); } catch {}
  return ctx;
}

function listProjectFiles(dir, prefix, depth) {
  if (depth <= 0) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    if (entry.name.startsWith('.') || ['node_modules', 'dist', 'build'].includes(entry.name)) return [];
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    return entry.isDirectory() ? [rel + '/', ...listProjectFiles(path.join(dir, entry.name), rel, depth - 1)] : [rel];
  });
}

function buildPrompt(ctx) {
  let prompt = `DIAGNOSTIC FAILURE:\n- ID: ${ctx.diagnostic.id}\n- Name: ${ctx.diagnostic.name}\n- Layer: ${ctx.diagnostic.layer}\n- Status: ${ctx.diagnostic.status}\n- Details: ${ctx.diagnostic.details}\n\n`;
  if (ctx.diagSource) prompt += `DIAGNOSTIC SOURCE CODE:\n\`\`\`javascript\n${ctx.diagSource}\n\`\`\`\n\n`;
  if (ctx.errorPattern) prompt += `ERROR PATTERN DOCUMENTATION:\n${ctx.errorPattern}\n\n`;
  if (ctx.packageJson) prompt += `PACKAGE.JSON:\n\`\`\`json\n${JSON.stringify(ctx.packageJson, null, 2)}\n\`\`\`\n\n`;
  if (ctx.projectFiles.length) prompt += `PROJECT STRUCTURE:\n${ctx.projectFiles.join('\n')}\n\n`;
  return prompt + 'Fix this diagnostic failure. Return ONLY the JSON response.';
}

function parseAiResponse(raw) {
  let text = raw.trim();
  const match = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (match) text = match[1].trim();
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed.files) || typeof parsed.summary !== 'string') throw new Error('AI response must contain files and summary');
  for (const file of parsed.files) if (!file.path || typeof file.content !== 'string') throw new Error('Invalid file entry in AI response');
  return parsed;
}

function safePath(projectDir, relativePath) {
  const root = path.resolve(projectDir);
  const absolute = path.resolve(root, relativePath);
  if (absolute !== root && !absolute.startsWith(root + path.sep)) throw new Error(`Path traversal detected: ${relativePath}`);
  return absolute;
}

function makeDiff(before, after) {
  const beforeLines = before === null ? [] : before.split('\n');
  const afterLines = after.split('\n');
  const changed = Math.max(beforeLines.length, afterLines.length);
  const preview = [`--- before (${before === null ? 'new file' : beforeLines.length + ' lines'})`, `+++ after (${afterLines.length} lines)`];
  const limit = 40;
  for (let i = 0; i < Math.min(changed, limit); i++) {
    if (beforeLines[i] === afterLines[i]) continue;
    if (beforeLines[i] !== undefined) preview.push(`- ${beforeLines[i]}`);
    if (afterLines[i] !== undefined) preview.push(`+ ${afterLines[i]}`);
  }
  if (changed > limit) preview.push(`... ${changed - limit} additional lines omitted`);
  return { preview: preview.join('\n'), changedLines: changed };
}

function classifyRisk(files, localFix) {
  const paths = files.map(file => file.path.toLowerCase());
  const sensitive = /(package-lock|yarn\.lock|pnpm-lock|\.env|secret|auth|payment|wallet|migration|schema|database|db\.|deploy|docker|ci\/)/;
  if (localFix || paths.some(file => sensitive.test(file))) return { level: 'HIGH', requiresApproval: true, reasons: ['Sensitive system, data, credential, or custom repair action detected.'] };
  if (files.length > 3 || files.some(file => file.changedLines > 250)) return { level: 'MEDIUM', requiresApproval: true, reasons: ['Repair changes multiple or large files.'] };
  return { level: 'LOW', requiresApproval: true, reasons: ['All AI-proposed changes still require explicit approval.'] };
}

function repairDir(projectDir) {
  const dir = path.join(projectDir, '.vibe-diagnosis', 'repair-plans');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function auditPath(projectDir) { return path.join(projectDir, '.vibe-diagnosis', 'repair-history.json'); }
function readAudit(projectDir) { try { return JSON.parse(fs.readFileSync(auditPath(projectDir), 'utf8')); } catch { return []; } }
function appendAudit(projectDir, entry) {
  const entries = readAudit(projectDir);
  entries.unshift(entry);
  fs.writeFileSync(auditPath(projectDir), JSON.stringify(entries.slice(0, 200), null, 2), 'utf8');
}

function persistPlan(projectDir, plan) {
  fs.writeFileSync(path.join(repairDir(projectDir), `${plan.id}.json`), JSON.stringify(plan, null, 2), 'utf8');
}
function loadPlan(projectDir, planId) {
  const file = path.join(repairDir(projectDir), `${path.basename(planId)}.json`);
  if (!fs.existsSync(file)) throw new Error('Repair plan not found or expired.');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function findLocalFix(projectDir, diagId) {
  const matching = discoverDiagnostics(projectDir).find(f => path.basename(f, '.diag.js') === diagId);
  if (!matching) return null;
  delete require.cache[require.resolve(matching)];
  const mod = require(matching);
  const method = mod.fix || mod.heal;
  return typeof method === 'function' ? method : null;
}

async function createRepairPlan(projectDir, diagResult, baselineResults = []) {
  const localFix = findLocalFix(projectDir, diagResult.id);
  let files = [];
  let summary = '';
  let source = 'AI';
  if (localFix) {
    source = 'LOCAL_FIX';
    summary = 'This diagnostic exposes a custom fix/heal method. Its effects require explicit approval.';
  } else {
    const byok = getResolvedByok(projectDir);
    if (!byok.provider || !byok.apiKey || !byok.model) throw new Error('BYOK not configured. Set provider, apiKey, and model.');
    const response = parseAiResponse(await chat(byok.provider, byok.apiKey, byok.model, [
      { role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: buildPrompt(collectContext(projectDir, diagResult)) },
    ]));
    summary = response.summary;
    files = response.files.map(file => {
      const absolute = safePath(projectDir, file.path);
      const before = fs.existsSync(absolute) ? fs.readFileSync(absolute, 'utf8') : null;
      const diff = makeDiff(before, file.content);
      return { path: file.path.replace(/\\/g, '/'), content: file.content, before, ...diff };
    });
  }
  const risk = classifyRisk(files, Boolean(localFix));
  const plan = {
    id: `repair-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
    createdAt: new Date().toISOString(), diagId: diagResult.id, diagnostic: diagResult,
    summary, source, files, risk, baselineResults, status: 'PENDING_APPROVAL',
  };
  persistPlan(projectDir, plan);
  appendAudit(projectDir, { type: 'PLAN_CREATED', planId: plan.id, diagId: plan.diagId, timestamp: plan.createdAt, summary, risk: risk.level, files: files.map(f => f.path) });
  return publicPlan(plan);
}

function publicPlan(plan) {
  return { ...plan, files: plan.files.map(({ content, before, ...file }) => file) };
}

function applyFiles(projectDir, files) {
  const snapshots = [];
  for (const file of files) {
    const absolute = safePath(projectDir, file.path);
    snapshots.push({ path: file.path, existed: fs.existsSync(absolute), content: fs.existsSync(absolute) ? fs.readFileSync(absolute, 'utf8') : null });
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, file.content, 'utf8');
  }
  return snapshots;
}

function rollbackFiles(projectDir, snapshots) {
  for (const snapshot of snapshots) {
    const absolute = safePath(projectDir, snapshot.path);
    if (snapshot.existed) fs.writeFileSync(absolute, snapshot.content, 'utf8');
    else if (fs.existsSync(absolute)) fs.unlinkSync(absolute);
  }
}

async function applyRepairPlan(projectDir, planId, { approved = false } = {}) {
  if (!approved) throw new Error('Explicit approval is required before applying a repair plan.');
  const plan = loadPlan(projectDir, planId);
  if (plan.status !== 'PENDING_APPROVAL') throw new Error(`Repair plan is ${plan.status.toLowerCase()}.`);
  let snapshots = [];
  try {
    if (plan.source === 'LOCAL_FIX') {
      const fix = findLocalFix(projectDir, plan.diagId);
      if (!fix) throw new Error('Local fix is no longer available.');
      await fix({ projectDir, db: null });
    } else {
      snapshots = applyFiles(projectDir, plan.files);
    }
    const rerunResults = await runDiagnostics(projectDir);
    const target = rerunResults.find(result => result.id === plan.diagId);
    const regressions = (plan.baselineResults || []).filter(before => before.status === 'OK').map(before => {
      const after = rerunResults.find(result => result.id === before.id);
      return after && after.status !== 'OK' ? { id: before.id, before: before.status, after: after.status, details: after.details } : null;
    }).filter(Boolean);
    const success = target?.status === 'OK' && regressions.length === 0;
    if (!success && plan.source !== 'LOCAL_FIX') rollbackFiles(projectDir, snapshots);
    plan.status = success ? 'APPLIED' : (plan.source === 'LOCAL_FIX' ? 'FAILED_REVIEW' : 'ROLLED_BACK');
    plan.appliedAt = new Date().toISOString();
    plan.result = { success, target, regressions, rolledBack: !success && plan.source !== 'LOCAL_FIX', rerunResults };
    persistPlan(projectDir, plan);
    appendAudit(projectDir, { type: success ? 'REPAIR_APPLIED' : 'REPAIR_ROLLED_BACK', planId: plan.id, diagId: plan.diagId, timestamp: plan.appliedAt, summary: plan.summary, risk: plan.risk.level, files: plan.files.map(f => f.path), regressions, targetStatus: target?.status || 'MISSING' });
    return { ...publicPlan(plan), result: plan.result };
  } catch (err) {
    if (snapshots.length) rollbackFiles(projectDir, snapshots);
    plan.status = 'FAILED'; plan.appliedAt = new Date().toISOString(); plan.error = err.message;
    persistPlan(projectDir, plan);
    appendAudit(projectDir, { type: 'REPAIR_FAILED', planId: plan.id, diagId: plan.diagId, timestamp: plan.appliedAt, summary: err.message, risk: plan.risk.level, files: plan.files.map(f => f.path) });
    throw err;
  }
}

async function repairDiagnostic(projectDir, diagResult) {
  const baseline = await runDiagnostics(projectDir);
  const plan = await createRepairPlan(projectDir, diagResult, baseline);
  const result = await applyRepairPlan(projectDir, plan.id, { approved: true });
  return { success: result.result.success, diagId: diagResult.id, filesModified: result.files.map(file => file.path), backupFiles: [], summary: result.summary, rerunResult: result.result.target, error: result.result.success ? null : 'Repair failed validation and was rolled back.', planId: result.id, regressions: result.result.regressions };
}

module.exports = { repairDiagnostic, createRepairPlan, applyRepairPlan, readAudit, publicPlan };
