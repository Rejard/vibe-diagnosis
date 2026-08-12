const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { chat } = require('./ai-provider');
const { getResolvedByok } = require('./config-manager');
const { runDiagnosticsReport, discoverDiagnostics, clearProjectRequireCache } = require('./runner');
const { captureEnvironment } = require('./environment');
const { redactString, redactValue } = require('./redaction');

const SYSTEM_PROMPT = `You are a code repair specialist. Return only JSON with a summary and complete proposed file contents. Fix the functional root cause. Never weaken, delete, or bypass diagnostics and never insert text solely to satisfy a source-string check. Do not modify live trading, authentication, database schema/data, credentials, deployment, or runtime settings unless the plan explicitly marks those files high risk.`;
const HIGH_RISK = /(^|\/)(\.env|auth|credentials?|secrets?|database|db|schema|migrations?|deploy|runtime|trading|orders?|wallet|payments?)(\/|\.|$)|(?:package-lock|pnpm-lock|yarn\.lock)/i;

function safePath(projectDir, relativePath) {
  const root = path.resolve(projectDir);
  const absolute = path.resolve(root, relativePath);
  const relative = path.relative(root, absolute);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error(`Unsafe repair path: ${relativePath}`);
  return absolute;
}

function planDir(projectDir) {
  const dir = path.join(projectDir, '.vibe-diagnosis', 'repair-plans');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
function auditPath(projectDir) { return path.join(projectDir, '.vibe-diagnosis', 'repair-history.json'); }
function readAudit(projectDir) { try { return JSON.parse(fs.readFileSync(auditPath(projectDir), 'utf8')); } catch { return []; } }
function appendAudit(projectDir, entry) {
  const entries = readAudit(projectDir);
  entries.unshift(entry);
  fs.writeFileSync(auditPath(projectDir), JSON.stringify(entries.slice(0, 500), null, 2), 'utf8');
}
function persistPlan(projectDir, plan) { fs.writeFileSync(path.join(planDir(projectDir), `${plan.id}.json`), JSON.stringify(plan, null, 2), 'utf8'); }
function loadPlan(projectDir, id) {
  const target = path.join(planDir(projectDir), `${path.basename(id)}.json`);
  if (!fs.existsSync(target)) throw new Error('Repair plan not found.');
  return JSON.parse(fs.readFileSync(target, 'utf8'));
}

function parseAiResponse(raw) {
  let text = String(raw).trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) text = fenced[1].trim();
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed.files) || typeof parsed.summary !== 'string') throw new Error('AI response must include files and summary');
  for (const file of parsed.files) if (!file.path || typeof file.content !== 'string') throw new Error('AI response contains an invalid file change');
  return parsed;
}

function makeDiff(before, after) {
  const oldLines = before === null ? [] : before.split(/\r?\n/);
  const newLines = after.split(/\r?\n/);
  const preview = [`--- before (${before === null ? 'new file' : `${oldLines.length} lines`})`, `+++ after (${newLines.length} lines)`];
  let changedLines = 0;
  for (let i = 0; i < Math.max(oldLines.length, newLines.length); i++) {
    if (oldLines[i] === newLines[i]) continue;
    changedLines++;
    if (preview.length < 82) {
      if (oldLines[i] !== undefined) preview.push(`- ${oldLines[i]}`);
      if (newLines[i] !== undefined) preview.push(`+ ${newLines[i]}`);
    }
  }
  if (changedLines * 2 + 2 > preview.length) preview.push(`... ${changedLines} changed line positions total`);
  return { diffPreview: preview.join('\n'), changedLines };
}

function classifyRisk(files, source) {
  const reasons = [];
  let level = 'LOW';
  if (source === 'LOCAL_FIX') { level = 'HIGH'; reasons.push('Custom fix/heal code cannot provide a deterministic diff preview.'); }
  if (files.some(file => HIGH_RISK.test(file.path))) { level = 'HIGH'; reasons.push('Trading, authority, data, credential, dependency, or runtime files are included.'); }
  if (level !== 'HIGH' && (files.length > 3 || files.some(file => file.changedLines > 250))) { level = 'MEDIUM'; reasons.push('The plan changes multiple or large files.'); }
  if (!reasons.length) reasons.push('All repairs require explicit review and approval.');
  return { level, requiresApproval: true, requiresHighRiskApproval: level === 'HIGH', reasons };
}

function detectGaming(plan) {
  const sourceFiles = plan.files.filter(file => !/(^|\/)\.vibe-diagnosis\/diagnostics\/|README|CHANGELOG|\.md$/i.test(file.path));
  if (plan.diagnostic?.classification === 'TEST_FAILURE' && plan.files.length && sourceFiles.length === 0) {
    return ['A functional test failure cannot be repaired only by changing diagnostics or documentation.'];
  }
  const weakened = plan.files.filter(file => /status\s*:\s*['"]OK['"]/.test(file.content) && /\.diag\.js$/i.test(file.path));
  return weakened.length ? [`Diagnostic pass literals were added or retained in proposed diagnostic changes: ${weakened.map(file => file.path).join(', ')}`] : [];
}

function collectContext(projectDir, diagnostic) {
  const files = discoverDiagnostics(projectDir);
  const diagFile = files.find(file => path.basename(file, '.diag.js') === diagnostic.id);
  const pkgFile = path.join(projectDir, 'package.json');
  return {
    diagnostic,
    diagnosticSource: diagFile ? fs.readFileSync(diagFile, 'utf8') : null,
    packageJson: fs.existsSync(pkgFile) ? JSON.parse(fs.readFileSync(pkgFile, 'utf8')) : null,
  };
}

function promptFor(context) {
  return `DIAGNOSTIC FAILURE\n${JSON.stringify(redactValue(context.diagnostic), null, 2)}\n\nDIAGNOSTIC SOURCE\n${redactString(context.diagnosticSource || 'unavailable')}\n\nPACKAGE\n${JSON.stringify(redactValue(context.packageJson), null, 2)}\n\nReturn {"summary":"...","files":[{"path":"...","content":"complete file"}]}.`;
}

function prepareFiles(projectDir, proposed) {
  return proposed.map(file => {
    const absolute = safePath(projectDir, file.path);
    const before = fs.existsSync(absolute) ? fs.readFileSync(absolute, 'utf8') : null;
    return { path: file.path.replace(/\\/g, '/'), content: file.content, before, ...makeDiff(before, file.content) };
  });
}

function publicPlan(plan) {
  return { ...plan, files: plan.files.map(({ content, before, ...file }) => file) };
}

async function createRepairPlan(projectDir, diagnostic, baselineResults) {
  const baselineReport = baselineResults ? { results: baselineResults } : await runDiagnosticsReport(projectDir, { persist: false, compareBaseline: false });
  const byok = getResolvedByok(projectDir);
  if (!byok.provider || !byok.apiKey || !byok.model) throw new Error('BYOK not configured. A repair plan was not generated and no files were changed.');
  const response = parseAiResponse(await chat(byok.provider, byok.apiKey, byok.model, [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: promptFor(collectContext(projectDir, diagnostic)) },
  ]));
  const files = prepareFiles(projectDir, response.files);
  const plan = {
    id: `repair-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
    createdAt: new Date().toISOString(),
    diagId: diagnostic.id,
    diagnostic,
    summary: response.summary,
    source: 'AI',
    files,
    risk: classifyRisk(files, 'AI'),
    gamingWarnings: [],
    baselineResults: baselineReport.results,
    environmentBefore: captureEnvironment(projectDir),
    status: 'PENDING_APPROVAL',
  };
  plan.gamingWarnings = detectGaming(plan);
  if (plan.gamingWarnings.length) plan.status = 'REJECTED_DIAGNOSTIC_GAMING';
  persistPlan(projectDir, plan);
  appendAudit(projectDir, { type: plan.status === 'PENDING_APPROVAL' ? 'PLAN_CREATED' : 'PLAN_REJECTED', planId: plan.id, diagId: plan.diagId, timestamp: plan.createdAt, risk: plan.risk.level, summary: plan.summary, gamingWarnings: plan.gamingWarnings, files: files.map(file => file.path) });
  return publicPlan(plan);
}

function snapshotAndApply(projectDir, files) {
  const snapshots = [];
  try {
    for (const file of files) {
      const absolute = safePath(projectDir, file.path);
      snapshots.push({ path: file.path, existed: fs.existsSync(absolute), content: fs.existsSync(absolute) ? fs.readFileSync(absolute, 'utf8') : null });
      fs.mkdirSync(path.dirname(absolute), { recursive: true });
      fs.writeFileSync(absolute, file.content, 'utf8');
    }
  } catch (error) {
    rollback(projectDir, snapshots);
    throw error;
  }
  return snapshots;
}

function rollback(projectDir, snapshots) {
  for (const snapshot of snapshots) {
    const absolute = safePath(projectDir, snapshot.path);
    if (snapshot.existed) fs.writeFileSync(absolute, snapshot.content, 'utf8');
    else if (fs.existsSync(absolute)) fs.unlinkSync(absolute);
  }
  clearProjectRequireCache(projectDir);
}

async function applyRepairPlan(projectDir, planId, approval = {}) {
  if (approval.approved !== true) throw new Error('Explicit approval is required before applying a repair plan.');
  const plan = loadPlan(projectDir, planId);
  if (plan.status !== 'PENDING_APPROVAL') throw new Error(`Repair plan is ${plan.status}.`);
  if (plan.risk.requiresHighRiskApproval && approval.approvedHighRisk !== true) throw new Error('Separate high-risk approval is required for this repair plan.');
  if (plan.gamingWarnings?.length) throw new Error('Repair plan was rejected as diagnostic gaming.');
  let snapshots = [];
  try {
    snapshots = snapshotAndApply(projectDir, plan.files);
    plan.backupState = snapshots.map(snapshot => ({ path: snapshot.path, existed: snapshot.existed, captured: true }));
    persistPlan(projectDir, plan);
    clearProjectRequireCache(projectDir);
    const report = await runDiagnosticsReport(projectDir, { persist: false, compareBaseline: false });
    const target = report.results.find(result => result.id === plan.diagId);
    const regressions = plan.baselineResults.filter(before => before.status === 'OK').map(before => {
      const after = report.results.find(result => result.id === before.id);
      return after && after.status !== 'OK' ? { id: before.id, before: before.status, after: after.status, details: after.details } : null;
    }).filter(Boolean);
    const restorationVerified = plan.verification === 'FILE_CONTENT'
      ? plan.files.every(file => fs.existsSync(safePath(projectDir, file.path)) && fs.readFileSync(safePath(projectDir, file.path), 'utf8') === file.content)
      : target?.status === 'OK';
    const success = restorationVerified && regressions.length === 0;
    if (!success) rollback(projectDir, snapshots);
    plan.status = success ? 'APPLIED' : 'ROLLED_BACK';
    plan.appliedAt = new Date().toISOString();
    plan.result = { success, target, regressions, rolledBack: !success, report };
    plan.environmentAfter = captureEnvironment(projectDir);
    persistPlan(projectDir, plan);
    appendAudit(projectDir, { type: success ? 'REPAIR_APPLIED' : 'REPAIR_ROLLED_BACK', planId: plan.id, diagId: plan.diagId, timestamp: plan.appliedAt, risk: plan.risk.level, summary: plan.summary, regressions, files: plan.files.map(file => file.path) });
    return publicPlan(plan);
  } catch (error) {
    rollback(projectDir, snapshots);
    plan.status = 'ROLLED_BACK';
    plan.error = error.message;
    persistPlan(projectDir, plan);
    appendAudit(projectDir, { type: 'REPAIR_ROLLED_BACK', planId: plan.id, diagId: plan.diagId, timestamp: new Date().toISOString(), risk: plan.risk.level, summary: error.message, files: plan.files.map(file => file.path) });
    throw error;
  }
}

async function repairDiagnostic(projectDir, diagnostic) {
  const plan = await createRepairPlan(projectDir, diagnostic);
  return { success: false, requiresApproval: true, planId: plan.id, plan, filesModified: [], backupFiles: [], summary: 'Repair plan created. Review the risk and diff before applying.', rerunResult: null, error: null };
}

async function autoRevertOrRepairOmission(projectDir, relativeFilePath) {
  const absolute = safePath(projectDir, relativeFilePath);
  if (!fs.existsSync(absolute)) throw new Error(`Target file not found: ${relativeFilePath}`);
  const backup = `${absolute}.bak`;
  let content;
  let source;
  if (fs.existsSync(backup)) { content = fs.readFileSync(backup, 'utf8'); source = 'BACKUP'; }
  else { content = execFileSync('git', ['show', `HEAD:${relativeFilePath.replace(/\\/g, '/')}`], { cwd: projectDir, encoding: 'utf8', windowsHide: true }); source = 'GIT_HEAD'; }
  const files = prepareFiles(projectDir, [{ path: relativeFilePath, content }]);
  const baseline = await runDiagnosticsReport(projectDir, { persist: false, compareBaseline: false });
  const plan = { id: `omission-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`, createdAt: new Date().toISOString(), diagId: 'repair-omission', diagnostic: { id: 'repair-omission', classification: 'TEST_FAILURE' }, summary: `Restore ${relativeFilePath} from ${source}`, source, verification: 'FILE_CONTENT', files, risk: classifyRisk(files, source), gamingWarnings: [], baselineResults: baseline.results, environmentBefore: captureEnvironment(projectDir), status: 'PENDING_APPROVAL' };
  persistPlan(projectDir, plan);
  appendAudit(projectDir, { type: 'PLAN_CREATED', planId: plan.id, diagId: plan.diagId, timestamp: plan.createdAt, risk: plan.risk.level, summary: plan.summary, files: [relativeFilePath] });
  return { restored: false, requiresApproval: true, plan: publicPlan(plan), details: 'Restore plan created. No files were changed.' };
}

module.exports = { repairDiagnostic, createRepairPlan, applyRepairPlan, readAudit, publicPlan, autoRevertOrRepairOmission };
