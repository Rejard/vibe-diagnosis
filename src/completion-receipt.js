const crypto = require('crypto');
const { captureEnvironment } = require('./environment');
const { diagnosticPolicyFingerprint } = require('./diagnostic-policy');

function receiptPayload(report) {
  const environment = report.completionEnvironment || report.environment;
  return {
    schemaVersion: 2,
    runId: report.runId,
    issuedAt: report.finishedAt,
    gitSha: environment.git.sha,
    branch: environment.git.branch,
    workspaceFingerprint: environment.git.workspaceFingerprint,
    environmentFingerprint: environment.fingerprint,
    diagnosticPolicyFingerprint: report.policy?.fingerprint || diagnosticPolicyFingerprint(report.projectDir),
  };
}

function checksum(payload) {
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function createCompletionReceipt(report) {
  const payload = receiptPayload(report);
  return { ...payload, checksum: checksum(payload) };
}

function verifyCompletionReceipt(projectDir, receipt) {
  if (!receipt || typeof receipt !== 'object') return { valid: false, current: false, reasons: ['MISSING_RECEIPT'] };
  const { checksum: suppliedChecksum, ...payload } = receipt;
  const reasons = [];
  if (suppliedChecksum !== checksum(payload)) reasons.push('INVALID_CHECKSUM');
  const current = captureEnvironment(projectDir);
  if (receipt.environmentFingerprint !== current.fingerprint) reasons.push('STALE_WORKSPACE');
  if (receipt.diagnosticPolicyFingerprint !== diagnosticPolicyFingerprint(projectDir)) reasons.push('STALE_DIAGNOSTIC_POLICY');
  return { valid: reasons.length === 0, current: !reasons.includes('STALE_WORKSPACE'), reasons, currentFingerprint: current.fingerprint };
}

module.exports = { createCompletionReceipt, verifyCompletionReceipt };
