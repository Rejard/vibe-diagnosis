const fs = require('fs');
const path = require('path');
const http = require('http');
const { projectKey } = require('./diagnostics-lock');
const { dashboardCompatibility, DASHBOARD_SERVICE } = require('./dashboard-contract');

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

function requestDashboard(lock, pathname, method, timeoutMs) {
  return new Promise((resolve, reject) => {
    const request = http.request({
      hostname: '127.0.0.1',
      port: lock.port,
      path: pathname,
      method,
      headers: lock.token ? { 'x-vibe-dashboard-token': lock.token } : {},
      timeout: timeoutMs,
    }, response => {
      let body = '';
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => resolve({ statusCode: response.statusCode, contentType: response.headers['content-type'] || '', body }));
    });
    request.on('timeout', () => request.destroy(new Error(`Dashboard ${pathname} request timed out.`)));
    request.on('error', reject);
    request.end();
  });
}

async function requestHealth(lock, timeoutMs) {
  const response = await requestDashboard(lock, '/api/health', 'GET', timeoutMs);
  if (response.statusCode !== 200 || !response.contentType.toLowerCase().includes('application/json')) return null;
  try { return JSON.parse(response.body); } catch { return null; }
}

function verifiedIdentity(projectDir, lock, health) {
  return Boolean(
    health?.service === DASHBOARD_SERVICE &&
    health.projectKey === projectKey(projectDir) &&
    health.pid === lock.pid &&
    (!lock.service || lock.service === health.service) &&
    (!lock.projectKey || lock.projectKey === health.projectKey)
  );
}

async function probeDashboard(projectDir, options = {}) {
  let lock;
  try { lock = readDashboardLock(projectDir); } catch (error) { return { running: false, lock: null, error: error.message }; }
  if (!lock?.token || !lock.projectDir) return { running: false, compatible: false, lock };
  try {
    const health = await requestHealth(lock, options.timeoutMs || 1000);
    const running = verifiedIdentity(projectDir, lock, health);
    const compatibility = running ? dashboardCompatibility(health) : { compatible: false, reason: 'SERVER_IDENTITY_MISMATCH' };
    return { running, compatible: running && compatibility.compatible, compatibility, lock, health: running ? health : null };
  } catch (error) {
    return { running: false, compatible: false, lock, error: error.message, errorCode: error.code || null };
  }
}

async function stopDashboard(projectDir, options = {}) {
  const lock = readDashboardLock(projectDir);
  if (!lock) return { stopped: false, status: 'NOT_RUNNING', projectDir: path.resolve(projectDir) };

  const probe = await probeDashboard(projectDir, { timeoutMs: options.timeoutMs || 3000 });
  if (!probe.running) {
    if (options.removeStaleLock !== false && ['ECONNREFUSED', 'ECONNRESET'].includes(probe.errorCode)) {
      if (fs.existsSync(lock.lockPath)) fs.unlinkSync(lock.lockPath);
      return { stopped: false, status: 'STALE_LOCK_REMOVED', projectDir: path.resolve(projectDir), port: lock.port, details: probe.error };
    }
    const error = new Error('Dashboard identity could not be verified; refusing to stop the recorded process.');
    error.code = 'DASHBOARD_IDENTITY_MISMATCH';
    throw error;
  }

  const response = await requestDashboard(lock, '/api/shutdown', 'POST', options.timeoutMs || 3000);
  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(`Dashboard refused shutdown (${response.statusCode}): ${response.body}`);
  }
  if (fs.existsSync(lock.lockPath)) fs.unlinkSync(lock.lockPath);
  return {
    stopped: true,
    status: 'STOPPED',
    reason: options.reason || null,
    projectDir: path.resolve(projectDir),
    port: lock.port,
    pid: lock.pid || null,
    authenticated: true,
    previousVersion: probe.health?.version || null,
  };
}

async function refreshIncompatibleDashboard(projectDir, options = {}) {
  const probe = await probeDashboard(projectDir, options);
  if (!probe.running || probe.compatible) return { action: probe.running ? 'REUSE' : 'START', probe };
  const stopped = await stopDashboard(projectDir, {
    ...options,
    reason: probe.compatibility.reason,
    removeStaleLock: false,
  });
  return { action: 'RESTART', probe, stopped };
}

module.exports = { stopDashboard, readDashboardLock, probeDashboard, refreshIncompatibleDashboard, verifiedIdentity };
