const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { hashFiles } = require('./environment');

function cachePath(projectDir) { return path.join(projectDir, '.vibe-diagnosis', 'cache.json'); }
function readCache(projectDir) {
  try { return JSON.parse(fs.readFileSync(cachePath(projectDir), 'utf8')); } catch { return {}; }
}
function writeCache(projectDir, cache) {
  const target = cachePath(projectDir);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(cache, null, 2), 'utf8');
}
function cacheKey(projectDir, descriptor, environmentFingerprint) {
  const diagHash = crypto.createHash('sha256').update(descriptor.source).digest('hex');
  const filesHash = hashFiles(projectDir, descriptor.files || []);
  return crypto.createHash('sha256').update([diagHash, filesHash, environmentFingerprint].join('|')).digest('hex');
}
function isCacheEligible(descriptor) { return descriptor.cache === true && ['STATIC', 'TEST'].includes(descriptor.evidenceType); }

module.exports = { readCache, writeCache, cacheKey, isCacheEligible };
