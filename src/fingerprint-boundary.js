const fs = require('fs');
const path = require('path');
const SECRET = /^(?:\.env(?:\..+)?|\.npmrc|\.pypirc|byok\.local\.json|config\.json|dump\.pm2(?:\.bak)?|.*(?:credential|secret|private[-_]?key|api[-_]?key).*(?:\.json|\.ya?ml|\.toml|\.ini)?|.*\.(?:pem|key|p12|pfx))$/i;
const PRIVATE_DIRS = new Set(['.aws', '.ssh', '.codex', '.pm2', 'backups', 'uploads', 'temp_uploads']);
const DATABASE = /\.(?:db|sqlite|sqlite3)(?:-(?:wal|shm|journal))?$/i;
function metadataOnly(root, relative) {
  const parts = relative.replace(/\\/g, '/').split('/');
  if (parts.some(part => PRIVATE_DIRS.has(part.toLowerCase()))) return true;
  if (SECRET.test(parts.at(-1)) || DATABASE.test(parts.at(-1))) return true;
  if (fs.existsSync(path.join(root, '.alobtc-aidl-research.quarantine'))) {
    return parts[0] === 'research' || parts.some(part => /aidl|evolution|sampler|promotion/i.test(part));
  }
  return false;
}
function metadataDigest(stat) {
  return 'METADATA_ONLY:' + JSON.stringify({ size: stat.size, mtimeMs: stat.mtimeMs, ctimeMs: stat.ctimeMs, mode: stat.mode, directory: stat.isDirectory() });
}
module.exports = { metadataOnly, metadataDigest };
