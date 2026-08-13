const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { AsyncLocalStorage } = require('async_hooks');

const ERROR_CODE = 'DIAGNOSTICS_ALREADY_RUNNING';
const LOCK_ROOT = path.join(os.tmpdir(), 'vibe-diagnosis', 'diagnostic-locks');
const INVALID_LOCK_GRACE_MS = 5000;
const executionStorage = new AsyncLocalStorage();

class DiagnosticsAlreadyRunningError extends Error {
  constructor(lock = {}) {
    super('Diagnostics are already running for this project.');
    this.name = 'DiagnosticsAlreadyRunningError';
    this.code = ERROR_CODE;
    this.startedAt = validDate(lock.startedAt) ? lock.startedAt : null;
    this.executionKind = safeKind(lock.executionKind);
  }

  toJSON() {
    return {
      error: this.message,
      code: this.code,
      ...(this.startedAt ? { startedAt: this.startedAt } : {}),
      ...(this.executionKind ? { executionKind: this.executionKind } : {}),
    };
  }
}

function validDate(value) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function safeKind(value) {
  return typeof value === 'string' && /^[a-z0-9_-]{1,40}$/i.test(value) ? value : null;
}

function normalizeProjectDir(projectDir) {
  let resolved = path.resolve(projectDir);
  try { resolved = fs.realpathSync.native(resolved); } catch {}
  resolved = path.normalize(resolved);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function projectKey(projectDir) {
  return crypto.createHash('sha256').update(normalizeProjectDir(projectDir)).digest('hex');
}

function lockPathForProject(projectDir) {
  return path.join(LOCK_ROOT, `${projectKey(projectDir)}.json`);
}

function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
}

function readExistingLock(lockPath) {
  try {
    const stat = fs.statSync(lockPath);
    const raw = fs.readFileSync(lockPath, 'utf8');
    let lock = null;
    try { lock = JSON.parse(raw); } catch {}
    return { lock, raw, stat };
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

function validLock(lock, normalizedProjectDir) {
  return Boolean(
    lock &&
    lock.projectKey === crypto.createHash('sha256').update(normalizedProjectDir).digest('hex') &&
    Number.isInteger(lock.pid) && lock.pid > 0 &&
    validDate(lock.startedAt) &&
    typeof lock.ownerToken === 'string' && lock.ownerToken.length >= 16
  );
}

function sameLockSnapshot(current, expected) {
  if (!current || !expected) return false;
  if (expected.lock?.ownerToken) {
    return current.lock?.ownerToken === expected.lock.ownerToken;
  }
  return current.raw === expected.raw &&
    current.stat.size === expected.stat.size &&
    current.stat.mtimeMs === expected.stat.mtimeMs;
}

function reclaimLock(lockPath, expected) {
  const existing = readExistingLock(lockPath);
  if (!existing) return true;
  if (!sameLockSnapshot(existing, expected)) return false;
  const reclaimedPath = `${lockPath}.reclaimed-${process.pid}-${crypto.randomBytes(6).toString('hex')}`;
  try {
    fs.renameSync(lockPath, reclaimedPath);
  } catch (error) {
    if (error.code === 'ENOENT') return true;
    return false;
  }
  try { fs.unlinkSync(reclaimedPath); } catch {}
  return true;
}

function acquireDiagnosticsLock(projectDir, options = {}) {
  const normalizedProjectDir = normalizeProjectDir(projectDir);
  const key = projectKey(normalizedProjectDir);
  const lockPath = lockPathForProject(normalizedProjectDir);
  const startedAt = new Date().toISOString();
  const ownerToken = crypto.randomBytes(18).toString('hex');
  const lock = {
    projectDir: normalizedProjectDir,
    projectKey: key,
    pid: process.pid,
    startedAt,
    executionKind: safeKind(options.executionKind) || 'diagnostics',
    ownerToken,
  };
  fs.mkdirSync(LOCK_ROOT, { recursive: true });

  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      fs.writeFileSync(lockPath, JSON.stringify(lock), { encoding: 'utf8', flag: 'wx', mode: 0o600 });
      let released = false;
      return {
        lockPath,
        startedAt,
        release() {
          if (released) return;
          const current = readExistingLock(lockPath);
          if (current?.lock?.ownerToken === ownerToken) {
            try { fs.unlinkSync(lockPath); } catch (error) { if (error.code !== 'ENOENT') throw error; }
          }
          released = true;
        },
      };
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      const existing = readExistingLock(lockPath);
      if (!existing) continue;
      const isValid = validLock(existing.lock, normalizedProjectDir);
      if (isValid && isProcessAlive(existing.lock.pid)) {
        throw new DiagnosticsAlreadyRunningError(existing.lock);
      }
      if (!isValid && Date.now() - existing.stat.mtimeMs < INVALID_LOCK_GRACE_MS) {
        throw new DiagnosticsAlreadyRunningError(existing.lock || {});
      }
      if (!reclaimLock(lockPath, existing)) continue;
    }
  }
  throw new DiagnosticsAlreadyRunningError(readExistingLock(lockPath)?.lock || {});
}

async function withDiagnosticsLock(projectDir, options, operation) {
  const key = projectKey(projectDir);
  const active = executionStorage.getStore();
  if (active?.active && active.projectKey === key) {
    return operation({ startedAt: active.startedAt, reentrant: true });
  }
  const lock = acquireDiagnosticsLock(projectDir, options);
  const context = { active: true, projectKey: key, startedAt: lock.startedAt };
  try {
    return await executionStorage.run(context, () => operation({ startedAt: lock.startedAt, reentrant: false }));
  } finally {
    context.active = false;
    lock.release();
  }
}

function conflictPayload(error) {
  if (error?.code !== ERROR_CODE) return null;
  return error instanceof DiagnosticsAlreadyRunningError
    ? error.toJSON()
    : new DiagnosticsAlreadyRunningError(error).toJSON();
}

module.exports = {
  ERROR_CODE,
  LOCK_ROOT,
  DiagnosticsAlreadyRunningError,
  normalizeProjectDir,
  projectKey,
  lockPathForProject,
  isProcessAlive,
  acquireDiagnosticsLock,
  withDiagnosticsLock,
  conflictPayload,
};
