const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const POLICY_FILE = 'diagnostic-policy.local.json';
const POLICY_SCHEMA_VERSION = 1;
const DEFAULT_NECESSITY = 4;
const VALID_STATES = ['ENABLED', 'SKIP_ONCE', 'SNOOZED', 'DISABLED'];

function policyPath(projectDir) {
  return path.join(path.resolve(projectDir), '.vibe-diagnosis', POLICY_FILE);
}

function emptyPolicy() {
  return { schemaVersion: POLICY_SCHEMA_VERSION, diagnostics: {}, removed: [] };
}

function normalizeNecessity(value) {
  return Number.isInteger(value) && value >= 1 && value <= 5 ? value : DEFAULT_NECESSITY;
}

function normalizePolicy(raw) {
  if (!raw || typeof raw !== 'object') return emptyPolicy();
  return {
    schemaVersion: POLICY_SCHEMA_VERSION,
    diagnostics: raw.diagnostics && typeof raw.diagnostics === 'object' ? raw.diagnostics : {},
    removed: Array.isArray(raw.removed) ? raw.removed : [],
  };
}

function loadDiagnosticPolicy(projectDir) {
  try {
    return normalizePolicy(JSON.parse(fs.readFileSync(policyPath(projectDir), 'utf8')));
  } catch {
    return emptyPolicy();
  }
}

function stablePolicy(policy) {
  const diagnostics = Object.fromEntries(Object.entries(policy.diagnostics || {}).sort(([a], [b]) => a.localeCompare(b)));
  const removed = [...(policy.removed || [])].sort((a, b) => String(a.id).localeCompare(String(b.id)) || String(a.removedAt).localeCompare(String(b.removedAt)));
  return { schemaVersion: POLICY_SCHEMA_VERSION, diagnostics, removed };
}

function diagnosticPolicyFingerprint(projectDir, policy = loadDiagnosticPolicy(projectDir)) {
  return crypto.createHash('sha256').update(JSON.stringify(stablePolicy(policy))).digest('hex');
}

function saveDiagnosticPolicy(projectDir, policy) {
  const target = policyPath(projectDir);
  const dir = path.dirname(target);
  fs.mkdirSync(dir, { recursive: true });
  const normalized = stablePolicy(normalizePolicy(policy));
  const temporary = `${target}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(normalized, null, 2) + '\n', { encoding: 'utf8', mode: 0o600, flag: 'wx' });
  fs.renameSync(temporary, target);
  return normalized;
}

function effectiveState(entry, now = Date.now()) {
  if (!entry || !VALID_STATES.includes(entry.state)) return 'ENABLED';
  if (entry.state === 'SNOOZED' && entry.until && Date.parse(entry.until) <= now) return 'ENABLED';
  return entry.state;
}

function policyEntry(policy, diagnosticId, now = Date.now()) {
  const entry = policy.diagnostics?.[diagnosticId] || null;
  return {
    state: effectiveState(entry, now),
    reason: entry?.reason || null,
    changedAt: entry?.changedAt || null,
    until: entry?.until || null,
  };
}

function setDiagnosticState(projectDir, diagnosticId, state, options = {}) {
  if (typeof diagnosticId !== 'string' || !diagnosticId.trim()) throw new Error('diagnosticId is required.');
  if (!VALID_STATES.includes(state)) throw new Error(`state must be one of: ${VALID_STATES.join(', ')}`);
  if (state !== 'ENABLED' && (typeof options.reason !== 'string' || !options.reason.trim())) {
    throw new Error('A non-empty reason is required when a diagnostic is not enabled.');
  }
  if (state === 'SNOOZED') {
    if (!options.until || Number.isNaN(Date.parse(options.until)) || Date.parse(options.until) <= Date.now()) {
      throw new Error('SNOOZED requires a future ISO date in until.');
    }
  }
  const policy = loadDiagnosticPolicy(projectDir);
  if (state === 'ENABLED') {
    delete policy.diagnostics[diagnosticId];
  } else {
    policy.diagnostics[diagnosticId] = {
      state,
      reason: options.reason.trim(),
      changedAt: new Date().toISOString(),
      until: state === 'SNOOZED' ? new Date(options.until).toISOString() : null,
    };
  }
  const saved = saveDiagnosticPolicy(projectDir, policy);
  return { diagnosticId, ...policyEntry(saved, diagnosticId), policyFingerprint: diagnosticPolicyFingerprint(projectDir, saved) };
}

function consumeSkipOnce(projectDir, diagnosticIds, policy = loadDiagnosticPolicy(projectDir)) {
  let changed = false;
  for (const diagnosticId of diagnosticIds) {
    if (policy.diagnostics?.[diagnosticId]?.state === 'SKIP_ONCE') {
      delete policy.diagnostics[diagnosticId];
      changed = true;
    }
  }
  return changed ? saveDiagnosticPolicy(projectDir, policy) : policy;
}

function trashDirectory(projectDir) {
  return path.join(path.resolve(projectDir), '.vibe-diagnosis', 'trash', 'diagnostics');
}

function removeDiagnostic(projectDir, descriptor, options = {}) {
  if (options.confirmed !== true) throw new Error('Explicit confirmation is required to remove a diagnostic.');
  if (!descriptor?.id || !descriptor?.filePath) throw new Error('A discovered diagnostic is required.');
  if (typeof options.reason !== 'string' || !options.reason.trim()) throw new Error('A non-empty removal reason is required.');
  const root = path.resolve(projectDir);
  const diagnosticsRoot = path.join(root, '.vibe-diagnosis', 'diagnostics') + path.sep;
  const source = path.resolve(descriptor.filePath);
  if (!source.startsWith(diagnosticsRoot) || !source.endsWith('.diag.js')) throw new Error('Only project .diag.js files can be removed.');
  if (!fs.existsSync(source)) throw new Error(`Diagnostic "${descriptor.id}" no longer exists.`);
  const trash = trashDirectory(root);
  fs.mkdirSync(trash, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const target = path.join(trash, `${stamp}-${path.basename(source)}`);
  fs.renameSync(source, target);
  const policy = loadDiagnosticPolicy(root);
  delete policy.diagnostics[descriptor.id];
  const record = {
    id: descriptor.id,
    name: descriptor.name,
    diagnosticNecessity: normalizeNecessity(descriptor.diagnosticNecessity),
    necessityReason: descriptor.necessityReason || null,
    originalFile: path.relative(root, source).replace(/\\/g, '/'),
    trashFile: path.relative(root, target).replace(/\\/g, '/'),
    removedAt: new Date().toISOString(),
    reason: options.reason.trim(),
  };
  policy.removed.push(record);
  saveDiagnosticPolicy(root, policy);
  return record;
}

function restoreDiagnostic(projectDir, diagnosticId) {
  const root = path.resolve(projectDir);
  const policy = loadDiagnosticPolicy(root);
  const index = policy.removed.map(item => item.id).lastIndexOf(diagnosticId);
  if (index === -1) throw new Error(`Removed diagnostic "${diagnosticId}" was not found.`);
  const record = policy.removed[index];
  const source = path.resolve(root, record.trashFile);
  const target = path.resolve(root, record.originalFile);
  const allowedTrash = trashDirectory(root) + path.sep;
  const allowedDiagnostics = path.join(root, '.vibe-diagnosis', 'diagnostics') + path.sep;
  if (!source.startsWith(allowedTrash) || !target.startsWith(allowedDiagnostics)) throw new Error('Stored diagnostic paths are invalid.');
  if (!fs.existsSync(source)) throw new Error('The recoverable diagnostic file is missing.');
  if (fs.existsSync(target)) throw new Error('The original diagnostic path is already occupied.');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.renameSync(source, target);
  policy.removed.splice(index, 1);
  saveDiagnosticPolicy(root, policy);
  return { ...record, restoredAt: new Date().toISOString() };
}

function changedFileMatches(descriptor, changedFiles) {
  if (!descriptor.files?.length) return true;
  const normalized = changedFiles.map(file => file.replace(/\\/g, '/'));
  return normalized.some(file => descriptor.files.some(declared => file === declared || file.startsWith(`${declared}/`) || declared.startsWith(`${file}/`)));
}

function selectionDecision(descriptor, entry, options = {}) {
  const necessity = normalizeNecessity(descriptor.diagnosticNecessity);
  if (options.force === true) return { run: true, reason: 'EXPLICIT_FORCE', diagnosticNecessity: necessity };
  if (entry.state !== 'ENABLED') return { run: false, reason: entry.state, diagnosticNecessity: necessity };
  if (options.selectionMode !== 'AUTO') return { run: true, reason: 'FULL_SELECTION', diagnosticNecessity: necessity };
  if (necessity >= 4) return { run: true, reason: 'ROUTINE_PRIORITY', diagnosticNecessity: necessity };
  if (necessity === 3 && changedFileMatches(descriptor, options.changedFiles || [])) {
    return { run: true, reason: 'CHANGE_SCOPED_PRIORITY', diagnosticNecessity: necessity };
  }
  return { run: false, reason: 'PRIORITY_NOT_DUE', diagnosticNecessity: necessity };
}

function describePolicy(descriptors, projectDir, options = {}) {
  const policy = loadDiagnosticPolicy(projectDir);
  const decisions = descriptors.map(descriptor => {
    const entry = policyEntry(policy, descriptor.id);
    return { descriptor, entry, decision: selectionDecision(descriptor, entry, options) };
  });
  return { policy, decisions, removed: policy.removed, fingerprint: diagnosticPolicyFingerprint(projectDir, policy) };
}

module.exports = {
  POLICY_FILE,
  DEFAULT_NECESSITY,
  VALID_STATES,
  normalizeNecessity,
  loadDiagnosticPolicy,
  saveDiagnosticPolicy,
  diagnosticPolicyFingerprint,
  policyEntry,
  setDiagnosticState,
  consumeSkipOnce,
  removeDiagnostic,
  restoreDiagnostic,
  selectionDecision,
  describePolicy,
};
