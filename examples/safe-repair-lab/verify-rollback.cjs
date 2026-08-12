const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { runDiagnostics } = require('../../src/runner');
const { applyRepairPlan } = require('../../src/repairer');

const projectDir = __dirname;
const planId = 'rollback-fixture-v160';
const planFile = path.join(projectDir, '.vibe-diagnosis', 'repair-plans', `${planId}.json`);

function hash(content) {
  return crypto.createHash('sha256').update(content === null ? '<MISSING>' : content).digest('hex');
}

function fileChange(relativePath, content) {
  const target = path.join(projectDir, relativePath);
  const before = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : null;
  return { path: relativePath, content, before, beforeHash: hash(before), afterHash: hash(content), diffPreview: 'deterministic rollback fixture', changedLines: 1 };
}

function seal(plan) {
  const payload = { id: plan.id, createdAt: plan.createdAt, diagId: plan.diagId, summary: plan.summary, source: plan.source, files: plan.files.map(file => ({ path: file.path, beforeHash: file.beforeHash, afterHash: file.afterHash })) };
  plan.integrity = { algorithm: 'sha256', checksum: crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex') };
  return plan;
}

async function main() {
  const baselineResults = await runDiagnostics(projectDir, { compareBaseline: false });
  const target = baselineResults.find(result => result.id === 'repair-addition');
  if (target?.status !== 'ERROR') throw new Error('Fixture must begin with the addition failure.');
  fs.mkdirSync(path.dirname(planFile), { recursive: true });
  const plan = seal({
    id: planId,
    createdAt: new Date().toISOString(),
    diagId: target.id,
    diagnostic: target,
    summary: 'Fix addition while intentionally breaking the regression guard.',
    source: 'FIXTURE',
    files: [
      fileChange('src/calculator.js', "function add(left, right) {\n  return left + right;\n}\n\nmodule.exports = { add };\n"),
      fileChange('src/regression-guard.js', "module.exports = { state: 'broken' };\n"),
    ],
    risk: { level: 'LOW', requiresApproval: true, requiresHighRiskApproval: false, reasons: ['Deterministic fixture'] },
    gamingWarnings: [],
    baselineResults,
    status: 'PENDING_APPROVAL',
  });
  fs.writeFileSync(planFile, JSON.stringify(plan, null, 2), 'utf8');
  const result = await applyRepairPlan(projectDir, planId, { approved: true, approvedChecksum: plan.integrity.checksum });
  const after = await runDiagnostics(projectDir, { compareBaseline: false });
  const guard = after.find(item => item.id === 'regression-guard');
  const addition = after.find(item => item.id === 'repair-addition');
  const verified = result.status === 'ROLLED_BACK' && result.result.rolledBack && result.result.regressions.some(item => item.id === 'regression-guard') && guard?.status === 'OK' && addition?.status === 'ERROR';
  process.stdout.write(JSON.stringify({ verified, status: result.status, regressions: result.result.regressions }, null, 2) + '\n');
  if (!verified) process.exitCode = 1;
}

main().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
