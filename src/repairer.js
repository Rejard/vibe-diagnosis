const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { chat } = require('./ai-provider');
const { getResolvedByok } = require('./config-manager');
const { runDiagnosticsReport, discoverDiagnostics, clearProjectRequireCache } = require('./runner');
const { captureEnvironment } = require('./environment');
const { redactString, redactValue } = require('./redaction');
const { resolveWithin } = require('./path-policy');
const { withDiagnosticsLock } = require('./diagnostics-lock');

const SYSTEM_PROMPT = `You are a code repair specialist. Return only JSON with a summary and complete proposed file contents. Fix the functional root cause. Never weaken, delete, or bypass diagnostics and never insert text solely to satisfy a source-string check. Do not modify live trading, authentication, database schema/data, credentials, deployment, or runtime settings unless the plan explicitly marks those files high risk.`;
const HIGH_RISK = /(^|\/)(\.env|auth|credentials?|secrets?|database|db|schema|migrations?|deploy|runtime|trading|orders?|wallet|payments?)(\/|\.|$)|(?:package-lock|pnpm-lock|yarn\.lock)/i;
const PROHIBITED_PATH = /(^|\/)(?:\.git|node_modules)(?:\/|$)|(^|\/)\.vibe-diagnosis\/(?:byok\.local\.json|repair-plans)(?:\/|$)|(^|\/)(?:\.env(?:\..*)?|[^/]*\.(?:pem|key|p12|pfx))$/i;
const MAX_FILES = 20;
const MAX_FILE_BYTES = 1024 * 1024;
const MAX_TOTAL_BYTES = 2 * 1024 * 1024;
const MAX_CHANGED_LINES = 5000;
const MAX_CONTEXT_FILE_BYTES = 256 * 1024;
const MAX_CONTEXT_TOTAL_BYTES = 512 * 1024;

function safePath(projectDir, relativePath) {
  return resolveWithin(projectDir, relativePath);
}

function contentHash(content) {
  return crypto.createHash('sha256').update(content === null ? '<MISSING>' : content).digest('hex');
}

function planIntegrityPayload(plan) {
  return {
    id: plan.id,
    createdAt: plan.createdAt,
    diagId: plan.diagId,
    summary: plan.summary,
    source: plan.source,
    diagnostic: plan.diagnostic,
    verification: plan.verification || null,
    files: plan.files.map(file => ({ path: file.path, beforeHash: file.beforeHash, afterHash: file.afterHash, changedLines: file.changedLines })),
    risk: plan.risk,
    gamingWarnings: plan.gamingWarnings || [],
    baselineResults: plan.baselineResults,
    environmentBefore: plan.environmentBefore,
    status: plan.status,
  };
}

function sealPlan(plan) {
  plan.integrity = {
    algorithm: 'sha256',
    checksum: crypto.createHash('sha256').update(JSON.stringify(planIntegrityPayload(plan))).digest('hex'),
  };
  return plan;
}

function verifyPlanIntegrity(plan) {
  const expected = crypto.createHash('sha256').update(JSON.stringify(planIntegrityPayload(plan))).digest('hex');
  if (plan.integrity?.algorithm !== 'sha256' || plan.integrity.checksum !== expected) {
    throw new Error('Repair plan integrity verification failed. Create and approve a new plan.');
  }
}

function validateProposedFiles(proposed) {
  if (!Array.isArray(proposed) || proposed.length === 0) throw new Error('Repair plan must contain at least one file.');
  if (proposed.length > MAX_FILES) throw new Error(`Repair plan exceeds the ${MAX_FILES}-file limit.`);
  const seen = new Set();
  let totalBytes = 0;
  for (const file of proposed) {
    const normalized = file.path.replace(/\\/g, '/');
    if (seen.has(normalized)) throw new Error(`Repair plan contains duplicate path: ${normalized}`);
    if (PROHIBITED_PATH.test(normalized)) throw new Error(`Repair path is prohibited: ${normalized}`);
    seen.add(normalized);
    const bytes = Buffer.byteLength(file.content, 'utf8');
    if (bytes > MAX_FILE_BYTES) throw new Error(`Repair file exceeds the ${MAX_FILE_BYTES}-byte limit: ${normalized}`);
    totalBytes += bytes;
  }
  if (totalBytes > MAX_TOTAL_BYTES) throw new Error(`Repair plan exceeds the ${MAX_TOTAL_BYTES}-byte total limit.`);
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
  entries.unshift(redactValue(entry));
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
  const sourceFiles = [];
  let contextBytes = 0;
  for (const relativePath of diagnostic.files || []) {
    const normalized = relativePath.replace(/\\/g, '/');
    if (PROHIBITED_PATH.test(normalized)) continue;
    try {
      const absolute = safePath(projectDir, normalized);
      if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) continue;
      const bytes = fs.statSync(absolute).size;
      if (bytes > MAX_CONTEXT_FILE_BYTES || contextBytes + bytes > MAX_CONTEXT_TOTAL_BYTES) continue;
      sourceFiles.push({ path: normalized, content: redactString(fs.readFileSync(absolute, 'utf8')) });
      contextBytes += bytes;
    } catch {}
  }
  return {
    diagnostic,
    diagnosticSource: diagFile ? fs.readFileSync(diagFile, 'utf8') : null,
    packageJson: fs.existsSync(pkgFile) ? JSON.parse(fs.readFileSync(pkgFile, 'utf8')) : null,
    sourceFiles,
  };
}

function promptFor(context) {
  return `DIAGNOSTIC FAILURE\n${JSON.stringify(redactValue(context.diagnostic), null, 2)}\n\nDIAGNOSTIC SOURCE\n${redactString(context.diagnosticSource || 'unavailable')}\n\nDECLARED SOURCE FILES\n${JSON.stringify(context.sourceFiles, null, 2)}\n\nPACKAGE\n${JSON.stringify(redactValue(context.packageJson), null, 2)}\n\nReturn {"summary":"...","files":[{"path":"...","content":"complete file"}]}.`;
}

function prepareFiles(projectDir, proposed) {
  validateProposedFiles(proposed);
  const files = proposed.map(file => {
    const absolute = safePath(projectDir, file.path);
    if (fs.existsSync(absolute) && fs.lstatSync(absolute).isSymbolicLink()) throw new Error(`Repair target cannot be a symbolic link: ${file.path}`);
    const before = fs.existsSync(absolute) ? fs.readFileSync(absolute, 'utf8') : null;
    return { path: file.path.replace(/\\/g, '/'), content: file.content, before, beforeHash: contentHash(before), afterHash: contentHash(file.content), ...makeDiff(before, file.content) };
  });
  if (files.reduce((sum, file) => sum + file.changedLines, 0) > MAX_CHANGED_LINES) throw new Error(`Repair plan exceeds the ${MAX_CHANGED_LINES}-changed-line limit.`);
  return files;
}

function publicPlan(plan) {
  return redactValue({ ...plan, files: plan.files.map(({ content, before, ...file }) => file) });
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
  sealPlan(plan);
  persistPlan(projectDir, plan);
  appendAudit(projectDir, { type: plan.status === 'PENDING_APPROVAL' ? 'PLAN_CREATED' : 'PLAN_REJECTED', planId: plan.id, diagId: plan.diagId, timestamp: plan.createdAt, risk: plan.risk.level, summary: plan.summary, gamingWarnings: plan.gamingWarnings, files: files.map(file => file.path) });
  return publicPlan(plan);
}

function snapshotAndApply(projectDir, files) {
  const snapshots = [];
  try {
    for (const file of files) {
      const absolute = safePath(projectDir, file.path);
      if (fs.existsSync(absolute) && fs.lstatSync(absolute).isSymbolicLink()) throw new Error(`Repair target cannot be a symbolic link: ${file.path}`);
      const current = fs.existsSync(absolute) ? fs.readFileSync(absolute, 'utf8') : null;
      if (contentHash(current) !== file.beforeHash) throw new Error(`Repair target changed after planning: ${file.path}`);
      if (contentHash(file.content) !== file.afterHash) throw new Error(`Approved repair content changed after planning: ${file.path}`);
      snapshots.push({ path: file.path, existed: current !== null, content: current });
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

async function applyRepairPlanLocked(projectDir, planId, approval = {}) {
  if (approval.approved !== true) throw new Error('Explicit approval is required before applying a repair plan.');
  const plan = loadPlan(projectDir, planId);
  if (plan.status !== 'PENDING_APPROVAL') throw new Error(`Repair plan is ${plan.status}.`);
  verifyPlanIntegrity(plan);
  if (approval.approvedChecksum !== plan.integrity.checksum) throw new Error('The approved plan checksum is required and must match the reviewed plan.');
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

async function applyRepairPlan(projectDir, planId, approval = {}) {
  return withDiagnosticsLock(projectDir, { executionKind: 'repair-apply' }, () => applyRepairPlanLocked(projectDir, planId, approval));
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
  sealPlan(plan);
  persistPlan(projectDir, plan);
  appendAudit(projectDir, { type: 'PLAN_CREATED', planId: plan.id, diagId: plan.diagId, timestamp: plan.createdAt, risk: plan.risk.level, summary: plan.summary, files: [relativeFilePath] });
  return { restored: false, requiresApproval: true, plan: publicPlan(plan), details: 'Restore plan created. No files were changed.' };
}

module.exports = { repairDiagnostic, createRepairPlan, applyRepairPlan, readAudit, publicPlan, autoRevertOrRepairOmission };
