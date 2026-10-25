const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { fileDigest, diagnosticFiles } = require('./workspace-changes');

function git(projectDir, args) {
  try {
    return execFileSync('git', args, { cwd: projectDir, windowsHide: true, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trimEnd();
  } catch {
    return null;
  }
}

const FINGERPRINT_IGNORES = new Set(['.git', 'node_modules']);
const VIBE_RUNTIME_DIRS = new Set(['runs', 'repair-plans', 'scratch_test_guard', 'scratch_test_ainative', 'scratch_test_omission']);
const PROTECTED_SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', '.next', 'coverage', 'runs', 'repair-plans']);
const PROTECTED_FILE = /^(?:\.env(?:\..+)?|\.npmrc|\.pypirc|byok\.local\.json|config\.json|.*(?:credential|secret|private[-_]?key|api[-_]?key).*(?:\.json|\.ya?ml|\.toml|\.ini)?|.*\.(?:pem|key|p12|pfx))$/i;
const MAX_PROTECTED_HASH_BYTES = 2 * 1024 * 1024;

function hashDirectory(hash, root, current = root, fileState = {}) {
  for (const entry of fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const absolute = path.join(current, entry.name);
    const relative = path.relative(root, absolute).replace(/\\/g, '/');
    if (FINGERPRINT_IGNORES.has(entry.name) || (relative.startsWith('.vibe-diagnosis/') && VIBE_RUNTIME_DIRS.has(entry.name))) continue;
    if (entry.isSymbolicLink()) {
      hash.update(`${relative}:SYMLINK`);
      fileState[relative] = fileDigest(root, relative);
    } else if (entry.isDirectory()) {
      hashDirectory(hash, root, absolute, fileState);
    } else if (entry.isFile()) {
      hash.update(relative);
      hash.update(fs.readFileSync(absolute));
      fileState[relative] = fileDigest(root, relative);
    }
  }
}

function protectedState(projectDir) {
  const root = path.resolve(projectDir);
  const files = [];
  function visit(current, depth) {
    if (depth > 8) return;
    let entries = [];
    try { entries = fs.readdirSync(current, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const absolute = path.join(current, entry.name);
      const relative = path.relative(root, absolute).replace(/\\/g, '/');
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if (!PROTECTED_SKIP_DIRS.has(entry.name)) visit(absolute, depth + 1);
        continue;
      }
      if (!entry.isFile() || !PROTECTED_FILE.test(entry.name)) continue;
      const stat = fs.statSync(absolute);
      const hash = crypto.createHash('sha256');
      hash.update(relative);
      hash.update(String(stat.size));
      if (stat.size <= MAX_PROTECTED_HASH_BYTES) hash.update(fs.readFileSync(absolute));
      else hash.update(String(stat.mtimeMs));
      files.push({ file: relative, fingerprint: hash.digest('hex') });
    }
  }
  visit(root, 0);
  files.sort((a, b) => a.file.localeCompare(b.file));
  return {
    files: files.map(item => item.file),
    fingerprint: crypto.createHash('sha256').update(JSON.stringify(files)).digest('hex'),
  };
}

function captureEnvironment(projectDir) {
  const sha = git(projectDir, ['rev-parse', 'HEAD']);
  const branch = git(projectDir, ['branch', '--show-current']);
  const status = git(projectDir, ['status', '--porcelain']);
  const changedFiles = status ? status.split(/\r?\n/).filter(Boolean).map(line => line.slice(3).trim()) : [];
  const diff = git(projectDir, ['diff', '--binary', 'HEAD']) || '';
  const untrackedOutput = git(projectDir, ['ls-files', '--others', '--exclude-standard', '-z']);
  const untracked = untrackedOutput ? untrackedOutput.split('\0').filter(Boolean).sort() : [];
  const workspaceHash = crypto.createHash('sha256');
  const fileState = {};
  if (sha === null) {
    workspaceHash.update('NO_GIT');
    hashDirectory(workspaceHash, path.resolve(projectDir), path.resolve(projectDir), fileState);
  } else {
    workspaceHash.update(diff);
    for (const relative of untracked) {
      workspaceHash.update(relative);
      const absolute = path.join(projectDir, relative);
      if (fs.existsSync(absolute) && fs.statSync(absolute).isFile()) workspaceHash.update(fs.readFileSync(absolute));
    }
  }
  const workspaceFingerprint = workspaceHash.digest('hex');
  const protectedWorkspace = protectedState(projectDir);
  const tracked = sha === null ? [] : (git(projectDir, ['ls-files', '-z']) || '').split('\0').filter(Boolean);
  const diagnostics = diagnosticFiles(projectDir);
  for (const relative of new Set([...tracked, ...untracked, ...protectedWorkspace.files, ...diagnostics])) {
    fileState[relative] = fileDigest(projectDir, relative);
  }
  const diagnosticFingerprint = crypto.createHash('sha256')
    .update(JSON.stringify(diagnostics.map(file => [file, fileState[file]]))).digest('hex');
  const fileStateFingerprint = crypto.createHash('sha256')
    .update(JSON.stringify(Object.keys(fileState).sort().map(file => [file, fileState[file]]))).digest('hex');
  const environment = {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    cwd: path.resolve(projectDir),
  };
  const fingerprint = crypto.createHash('sha256').update(JSON.stringify({ environment, sha, branch, workspaceFingerprint, diagnosticFingerprint, fileStateFingerprint, protectedWorkspaceFingerprint: protectedWorkspace.fingerprint })).digest('hex');
  const captured = { git: { sha, branch, dirty: changedFiles.length > 0, changedFiles, workspaceFingerprint, protectedWorkspaceFingerprint: protectedWorkspace.fingerprint, protectedFiles: protectedWorkspace.files }, environment, fingerprint, diagnosticFingerprint };
  Object.defineProperty(captured, 'fileState', { value: fileState });
  return captured;
}

function hashFiles(projectDir, relativeFiles) {
  const hash = crypto.createHash('sha256');
  for (const relative of [...new Set(relativeFiles)].sort()) {
    const absolute = path.resolve(projectDir, relative);
    const rel = path.relative(projectDir, absolute);
    hash.update(relative);
    if (rel.startsWith('..') || path.isAbsolute(rel) || !fs.existsSync(absolute)) hash.update('MISSING');
    else hash.update(fs.readFileSync(absolute));
  }
  return hash.digest('hex');
}

module.exports = { captureEnvironment, hashFiles };
