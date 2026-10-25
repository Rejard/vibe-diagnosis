const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function fileDigest(root, relative) {
  const absolute = path.join(root, relative);
  try {
    const stat = fs.lstatSync(absolute);
    if (stat.isSymbolicLink()) return `SYMLINK:${fs.readlinkSync(absolute)}`;
    if (!stat.isFile()) return 'NON_FILE';
    return crypto.createHash('sha256').update(fs.readFileSync(absolute)).digest('hex');
  } catch (error) {
    if (error.code === 'ENOENT') return 'MISSING';
    throw error;
  }
}

function diagnosticFiles(root) {
  const files = [];
  function visit(relative) {
    const absolute = path.join(root, relative);
    if (!fs.existsSync(absolute)) return;
    for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
      const file = `${relative}/${entry.name}`;
      if (entry.isDirectory()) visit(file);
      else files.push(file);
    }
  }
  visit('.vibe-diagnosis/diagnostics');
  return files.sort();
}

function compareEnvironments(before, after) {
  const initial = before.fileState || {};
  const final = after.fileState || {};
  const changedFiles = [...new Set([...Object.keys(initial), ...Object.keys(final)])]
    .filter(file => initial[file] !== final[file]).sort()
    .map(file => ({
      file,
      change: !(file in initial) || initial[file] === 'MISSING' ? 'ADDED' : !(file in final) || final[file] === 'MISSING' ? 'DELETED' : 'MODIFIED',
      impact: file.startsWith('.vibe-diagnosis/diagnostics/') ? 'DIAGNOSTIC_CODE_CHANGED' : 'DEPENDENCY_SCOPE_UNPROVEN',
    }));
  return {
    changed: before.fingerprint !== after.fingerprint,
    changedFiles,
    gitHeadChanged: before.git.sha !== after.git.sha,
    gitBranchChanged: before.git.branch !== after.git.branch,
    dependencyScope: 'UNPROVEN',
    action: before.fingerprint !== after.fingerprint
      ? 'RERUN_AFTER_WORKSPACE_STABILIZES'
      : 'NONE',
    reason: 'No complete dependency graph is available. All detected workspace changes block completion, including apparently unrelated files. File lists describe snapshot differences, not atomic filesystem history.',
  };
}

module.exports = { fileDigest, diagnosticFiles, compareEnvironments };
