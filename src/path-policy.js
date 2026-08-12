const fs = require('fs');
const path = require('path');

function isOutside(relative) {
  return relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative);
}

function resolveWithin(baseDir, requestedPath, options = {}) {
  if (typeof requestedPath !== 'string' || !requestedPath.trim() || requestedPath.includes('\0')) {
    throw new Error('A non-empty relative path is required.');
  }
  if (path.isAbsolute(requestedPath)) throw new Error(`Absolute paths are not allowed: ${requestedPath}`);
  const root = path.resolve(baseDir);
  const target = path.resolve(root, requestedPath);
  const relative = path.relative(root, target);
  if ((!relative && options.allowRoot !== true) || isOutside(relative)) throw new Error(`Path escapes the allowed directory: ${requestedPath}`);
  const rootReal = fs.existsSync(root) ? fs.realpathSync(root) : root;
  const existing = fs.existsSync(target) ? target : path.dirname(target);
  if (fs.existsSync(existing)) {
    const existingReal = fs.realpathSync(existing);
    if (isOutside(path.relative(rootReal, existingReal))) throw new Error(`Path resolves outside the allowed directory: ${requestedPath}`);
  }
  if (options.extension && path.extname(target).toLowerCase() !== options.extension.toLowerCase()) {
    throw new Error(`Only ${options.extension} files are allowed.`);
  }
  if (options.mustExist && !fs.existsSync(target)) throw new Error(`File not found: ${requestedPath}`);
  return target;
}

module.exports = { resolveWithin };
