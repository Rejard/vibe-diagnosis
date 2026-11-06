const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { captureEnvironment } = require('../src/environment');
const { fileDigest } = require('../src/workspace-changes');
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-boundary-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, '.vibe-diagnosis/diagnostics'), { recursive: true });
  return root;
}
test('fingerprints never open synthetic secrets, databases or quarantined research', t => {
  const root = fixture(t);
  fs.writeFileSync(path.join(root, '.alobtc-aidl-research.quarantine'), 'ACTIVE');
  const protectedFiles = ['.env', 'config.json', 'backend/platform.db', 'research/evidence.json', '.pm2/dump.pm2', '.codex/config.toml'];
  for (const relative of protectedFiles) { fs.mkdirSync(path.dirname(path.join(root, relative)), { recursive: true }); fs.writeFileSync(path.join(root, relative), 'SYNTHETIC_PRIVATE'); }
  fs.writeFileSync(path.join(root, 'source.js'), 'module.exports = 1;');
  const read = fs.readFileSync;
  const enumerate = fs.readdirSync;
  fs.readFileSync = function(file, ...args) { if (protectedFiles.some(p => path.resolve(String(file)) === path.join(root, p))) throw Error('PRIVATE_CONTENT_OPENED'); return read.call(this, file, ...args); };
  fs.readdirSync = function(file, ...args) { if (String(file) === path.join(root, 'research')) throw Error('QUARANTINED_DIRECTORY_ENUMERATED'); return enumerate.call(this, file, ...args); };
  try {
    const before = captureEnvironment(root);
    assert.ok(!JSON.stringify(before).includes('SYNTHETIC_PRIVATE'));
    for (const relative of protectedFiles) assert.match(fileDigest(root, relative), /^METADATA_ONLY:/);
    fs.writeFileSync(path.join(root, 'source.js'), 'module.exports = 2;');
    assert.notEqual(captureEnvironment(root).fingerprint, before.fingerprint);
  } finally { fs.readFileSync = read; fs.readdirSync = enumerate; }
});
test('protected file metadata changes invalidate the snapshot without hashing contents', t => {
  const root = fixture(t); const file = path.join(root, '.env');
  fs.writeFileSync(file, 'SYNTHETIC_A');
  const before = captureEnvironment(root);
  fs.writeFileSync(file, 'SYNTHETIC_LONGER_B');
  assert.notEqual(captureEnvironment(root).fingerprint, before.fingerprint);
});
test('ordinary source files retain content-based fingerprints', t => {
  const root = fixture(t); const file = path.join(root, 'source.js');
  fs.writeFileSync(file, 'one'); const before = fileDigest(root, 'source.js');
  fs.writeFileSync(file, 'two'); assert.notEqual(fileDigest(root, 'source.js'), before);
  assert.doesNotMatch(before, /METADATA_ONLY/);
});
