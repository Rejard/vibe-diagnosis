const fs = require('fs');
const path = require('path');
const http = require('http');

function readDashboardConnection(workspaceRoot) {
  const projectDir = path.resolve(workspaceRoot);
  const lockPath = path.join(projectDir, '.vibe-diagnosis', 'active_port.json');
  const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));

  if (path.resolve(lock.projectDir || '') !== projectDir) {
    throw new Error('Dashboard lock belongs to another project.');
  }
  if (!Number.isInteger(lock.port) || lock.port < 1 || lock.port > 65535 || typeof lock.token !== 'string' || !lock.token) {
    throw new Error('Dashboard lock is missing a valid port or token.');
  }

  return { host: '127.0.0.1', port: lock.port, token: lock.token };
}

function postJson(workspaceRoot, pathname, bodyValue = {}) {
  const connection = readDashboardConnection(workspaceRoot);
  const body = JSON.stringify(bodyValue);

  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: connection.host,
      port: connection.port,
      path: pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'X-Vibe-Dashboard-Token': connection.token,
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve({ message: data });
          }
          return;
        }
        reject(new Error(`Dashboard API returned ${res.statusCode}: ${data}`));
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function buildRepairApproval(plan, approvedHighRisk = false) {
  if (!plan?.id || !plan?.integrity?.checksum) {
    throw new Error('A reviewed repair plan with an integrity checksum is required.');
  }
  return {
    planId: plan.id,
    approved: true,
    approvedChecksum: plan.integrity.checksum,
    approvedHighRisk: approvedHighRisk === true,
  };
}

module.exports = { readDashboardConnection, postJson, buildRepairApproval };
