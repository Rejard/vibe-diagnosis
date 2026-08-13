const fs = require('fs');
const path = require('path');
const http = require('http');
const { projectKey } = require('./diagnostics-lock');

function lockPath(projectDir) {
  return path.join(path.resolve(projectDir), '.vibe-diagnosis', 'active_port.json');
}

function readDashboardLock(projectDir) {
  const target = lockPath(projectDir);
  if (!fs.existsSync(target)) return null;
  const lock = JSON.parse(fs.readFileSync(target, 'utf8'));
  if (!Number.isInteger(lock.port) || lock.port < 1 || lock.port > 65535) throw new Error('Dashboard lock contains an invalid port.');
  if (lock.projectDir && path.resolve(lock.projectDir) !== path.resolve(projectDir)) throw new Error('Dashboard lock belongs to a different project.');
  return { ...lock, lockPath: target };
}

function requestShutdown(lock, timeoutMs) {
  return new Promise((resolve, reject) => {
    const request = http.request({
      hostname: '127.0.0.1',
      port: lock.port,
      path: '/api/shutdown',
      method: 'POST',
      headers: lock.token ? { 'x-vibe-dashboard-token': lock.token } : {},
      timeout: timeoutMs,
    }, response => {
      let body = '';
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`Dashboard refused shutdown (${response.statusCode}): ${body}`));
          return;
        }
        resolve({ statusCode: response.statusCode, body });
      });
    });
    request.on('timeout', () => request.destroy(new Error('Dashboard shutdown request timed out.')));
    request.on('error', reject);
    request.end();
  });
}

function requestHealth(lock, timeoutMs) {
  return new Promise((resolve, reject) => {
    const request = http.request({
      hostname: '127.0.0.1',
      port: lock.port,
      path: '/api/health',
      method: 'GET',
      headers: lock.token ? { 'x-vibe-dashboard-token': lock.token } : {},
      timeout: timeoutMs,
    }, response => {
      let body = '';
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => {
        if (response.statusCode !== 200) { resolve(null); return; }
        try { resolve(JSON.parse(body)); } catch { resolve(null); }
      });
    });
    request.on('timeout', () => request.destroy(new Error('Dashboard health request timed out.')));
    request.on('error', reject);
    request.end();
  });
}

async function probeDashboard(projectDir, options = {}) {
  let lock;
  try { lock = readDashboardLock(projectDir); } catch { return { running: false, lock: null }; }
  if (!lock?.token || !lock.projectDir) return { running: false, lock };
  try {
    const health = await requestHealth(lock, options.timeoutMs || 1000);
    const running = Boolean(
      health?.service === 'vibe-diagnosis-dashboard' &&
      health.projectKey === projectKey(projectDir) &&
      health.pid === lock.pid
    );
    return { running, lock, health: running ? health : null };
  } catch {
    return { running: false, lock };
  }
}

async function stopDashboard(projectDir, options = {}) {
  const lock = readDashboardLock(projectDir);
  if (!lock) return { stopped: false, status: 'NOT_RUNNING', projectDir: path.resolve(projectDir) };
  try {
    await requestShutdown(lock, options.timeoutMs || 3000);
  } catch (error) {
    if (options.removeStaleLock !== false && (error.code === 'ECONNREFUSED' || error.code === 'ECONNRESET')) {
      if (fs.existsSync(lock.lockPath)) fs.unlinkSync(lock.lockPath);
      return { stopped: false, status: 'STALE_LOCK_REMOVED', projectDir: path.resolve(projectDir), port: lock.port, details: error.message };
    }
    throw error;
  }
  if (fs.existsSync(lock.lockPath)) fs.unlinkSync(lock.lockPath);
  return { stopped: true, status: 'STOPPED', projectDir: path.resolve(projectDir), port: lock.port, pid: lock.pid || null, authenticated: Boolean(lock.token) };
}

module.exports = { stopDashboard, readDashboardLock, probeDashboard };
