const path = require('path');
const pkg = require('../package.json');

const DASHBOARD_SERVICE = 'vibe-diagnosis-dashboard';
const DASHBOARD_API_VERSION = 2;
const DASHBOARD_CAPABILITIES = Object.freeze([
  'persistent-report-v1',
  'diagnostic-timing-v1',
  'structured-api-errors-v1',
  'safe-version-refresh-v1',
]);

function dashboardIdentity(projectDir) {
  return {
    service: DASHBOARD_SERVICE,
    version: pkg.version,
    apiVersion: DASHBOARD_API_VERSION,
    compatibleApiVersions: [DASHBOARD_API_VERSION],
    capabilities: [...DASHBOARD_CAPABILITIES],
    projectDir: path.resolve(projectDir),
  };
}

function dashboardCompatibility(health) {
  if (!health || health.service !== DASHBOARD_SERVICE) {
    return { compatible: false, reason: 'SERVER_IDENTITY_MISMATCH' };
  }
  if (health.version !== pkg.version) {
    return {
      compatible: false,
      reason: 'SERVER_VERSION_MISMATCH',
      expectedVersion: pkg.version,
      actualVersion: health.version || null,
    };
  }
  if (health.apiVersion !== DASHBOARD_API_VERSION) {
    return {
      compatible: false,
      reason: 'DASHBOARD_API_MISMATCH',
      expectedApiVersion: DASHBOARD_API_VERSION,
      actualApiVersion: health.apiVersion || null,
    };
  }
  return { compatible: true, reason: null };
}

module.exports = {
  DASHBOARD_SERVICE,
  DASHBOARD_API_VERSION,
  DASHBOARD_CAPABILITIES,
  dashboardIdentity,
  dashboardCompatibility,
};
