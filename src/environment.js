const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

function git(projectDir, args) {
  try {
    return execFileSync('git', args, { cwd: projectDir, windowsHide: true, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trimEnd();
  } catch {
    return null;
  }
}

function captureEnvironment(projectDir) {
  const sha = git(projectDir, ['rev-parse', 'HEAD']);
  const branch = git(projectDir, ['branch', '--show-current']);
  const status = git(projectDir, ['status', '--porcelain']);
  const changedFiles = status ? status.split(/\r?\n/).filter(Boolean).map(line => line.slice(3).trim()) : [];
  const diff = git(projectDir, ['diff', '--binary', 'HEAD']) || '';
  const untrackedOutput = git(projectDir, ['ls-files', '--others', '--exclude-standard']);
  const untracked = untrackedOutput ? untrackedOutput.split(/\r?\n/).filter(Boolean).sort() : [];
  const workspaceHash = crypto.createHash('sha256');
  workspaceHash.update(diff);
  for (const relative of untracked) {
    workspaceHash.update(relative);
    const absolute = path.join(projectDir, relative);
    if (fs.existsSync(absolute) && fs.statSync(absolute).isFile()) workspaceHash.update(fs.readFileSync(absolute));
  }
  const workspaceFingerprint = workspaceHash.digest('hex');
  const environment = {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    cwd: path.resolve(projectDir),
  };
  const fingerprint = crypto.createHash('sha256').update(JSON.stringify({ environment, sha, branch, workspaceFingerprint })).digest('hex');
  return { git: { sha, branch, dirty: changedFiles.length > 0, changedFiles, workspaceFingerprint }, environment, fingerprint };
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
