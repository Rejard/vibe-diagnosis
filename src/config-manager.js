const fs = require('fs');
const path = require('path');

const CONFIG_FILE = 'config.json';
const BYOK_LOCAL_FILE = 'byok.local.json';
const DIAG_ROOT = '.vibe-diagnosis';

const DEFAULT_CONFIG = {
  projectName: '',
  diagnosticsDir: 'diagnostics',
  errorPatternsDir: 'error-patterns',
  layers: ['TASK', 'FUNCTION', 'SYSTEM'],
  byok: {
    provider: '',
    apiKey: '',
    model: '',
  },
};

function configPath(projectDir) {
  return path.join(projectDir, DIAG_ROOT, CONFIG_FILE);
}

function byokLocalPath(projectDir) {
  return path.join(projectDir, DIAG_ROOT, BYOK_LOCAL_FILE);
}

function loadLocalByok(projectDir) {
  try { return JSON.parse(fs.readFileSync(byokLocalPath(projectDir), 'utf8')); } catch { return {}; }
}

function saveLocalByok(projectDir, byok) {
  const target = byokLocalPath(projectDir);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify({ apiKey: byok.apiKey || '' }, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 });
}

function loadByokSources(projectDir) {
  const config = loadConfig(projectDir);
  const local = loadLocalByok(projectDir);
  if (config.byok.apiKey) {
    ensureGitignore(projectDir);
    if (!local.apiKey) {
      local.apiKey = config.byok.apiKey;
      saveLocalByok(projectDir, local);
    }
    config.byok.apiKey = '';
    saveConfig(projectDir, config);
  }
  return { config, local };
}

function loadConfig(projectDir) {
  const filePath = configPath(projectDir);
  if (!fs.existsSync(filePath)) return { ...DEFAULT_CONFIG };

  try {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return { ...DEFAULT_CONFIG, ...raw, byok: { ...DEFAULT_CONFIG.byok, ...raw.byok } };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

function saveConfig(projectDir, config) {
  const filePath = configPath(projectDir);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
}

function saveByokConfig(projectDir, byok) {
  const config = loadConfig(projectDir);
  const local = loadLocalByok(projectDir);
  const suppliedKey = typeof byok.apiKey === 'string' && !byok.apiKey.includes('****')
    ? byok.apiKey
    : local.apiKey || config.byok.apiKey;
  ensureGitignore(projectDir);
  config.byok = { ...config.byok, ...byok, apiKey: '' };
  saveLocalByok(projectDir, { apiKey: suppliedKey || '' });
  saveConfig(projectDir, config);
  return config;
}

function getByokConfig(projectDir, { maskKey = false } = {}) {
  const { config, local } = loadByokSources(projectDir);
  const byok = resolveByokWithEnv({ ...config.byok, apiKey: local.apiKey || config.byok.apiKey || '' });

  if (maskKey && byok.apiKey) {
    byok.apiKey = '****';
  }

  return byok;
}

function resolveByokWithEnv(byok) {
  return {
    provider: process.env.VIBE_DIAG_PROVIDER || byok.provider || '',
    apiKey: process.env.VIBE_DIAG_API_KEY || byok.apiKey || '',
    model: process.env.VIBE_DIAG_MODEL || byok.model || '',
  };
}

function getResolvedByok(projectDir) {
  const { config, local } = loadByokSources(projectDir);
  return resolveByokWithEnv({ ...config.byok, apiKey: local.apiKey || config.byok.apiKey || '' });
}

function ensureGitignore(projectDir) {
  const gitignorePath = path.join(projectDir, '.gitignore');
  const entry = '.vibe-diagnosis/';

  let content = '';
  if (fs.existsSync(gitignorePath)) {
    content = fs.readFileSync(gitignorePath, 'utf-8');
  }

  const alreadyIgnored = content.split('\n').some(line => {
    const trimmed = line.trim();
    return trimmed === entry || trimmed === '.vibe-diagnosis' || trimmed === '.vibe-diagnosis/config.json';
  });

  if (alreadyIgnored) return;

  const newline = content.length > 0 && !content.endsWith('\n') ? '\n' : '';
  fs.writeFileSync(gitignorePath, content + newline + entry + '\n', 'utf-8');
}

module.exports = {
  loadConfig,
  saveConfig,
  saveByokConfig,
  getByokConfig,
  getResolvedByok,
  ensureGitignore,
};
