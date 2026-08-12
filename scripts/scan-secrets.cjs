const { execFileSync, spawnSync } = require('child_process');

const PATTERNS = [
  ['google-api-key', /(?:AQ\.[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,})/],
  ['openai-api-key', /sk-(?:proj-)?[A-Za-z0-9_-]{20,}/],
  ['anthropic-api-key', /sk-ant-[A-Za-z0-9_-]{20,}/],
  ['github-token', /gh[pousr]_[A-Za-z0-9]{20,}/],
  ['aws-access-key', /AKIA[0-9A-Z]{16}/],
];
const HISTORY_PATTERN = '(AQ\\.[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sk-(proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16})';

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
}

function classifications(content) {
  return PATTERNS.filter(([, pattern]) => pattern.test(content)).map(([name]) => name);
}

function scanIndex() {
  const findings = [];
  const files = git(['ls-files', '-z']).split('\0').filter(Boolean);
  for (const file of files) {
    const types = classifications(git(['show', `:${file}`]));
    if (types.length) findings.push({ location: 'index', path: file, types });
  }
  return findings;
}

function scanHistory() {
  const findings = [];
  const commits = git(['rev-list', '--all']).split(/\r?\n/).filter(Boolean);
  for (const commit of commits) {
    const result = spawnSync('git', ['grep', '-I', '-l', '-E', HISTORY_PATTERN, commit, '--'], { encoding: 'utf8', windowsHide: true });
    if (result.status !== 0 && result.status !== 1) throw result.error || new Error(result.stderr || `git grep failed for ${commit}`);
    for (const reference of result.stdout.split(/\r?\n/).filter(Boolean)) {
      const objectPath = reference.startsWith(`${commit}:`) ? reference.slice(commit.length + 1) : reference;
      const types = classifications(git(['show', `${commit}:${objectPath}`]));
      findings.push({ location: 'history', commit, path: objectPath, types });
    }
  }
  return findings;
}

const findings = [...scanIndex(), ...scanHistory()];
if (findings.length) {
  process.stderr.write(`${JSON.stringify({ verified: false, findings }, null, 2)}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`${JSON.stringify({ verified: true, scopes: ['index', 'history'], patterns: PATTERNS.map(([name]) => name) }, null, 2)}\n`);
}
