const fs = require('fs');
const path = require('path');
const { runDiagnostics } = require('../../src/runner');
const { applyRepairPlan } = require('../../src/repairer');

const projectDir = __dirname;
const planId = 'rollback-fixture-v160';
const planFile = path.join(projectDir, '.vibe-diagnosis', 'repair-plans', `${planId}.json`);

async function main() {
  const baselineResults = await runDiagnostics(projectDir, { compareBaseline: false });
  const target = baselineResults.find(result => result.id === 'repair-addition');
  if (target?.status !== 'ERROR') throw new Error('Fixture must begin with the addition failure.');
  fs.mkdirSync(path.dirname(planFile), { recursive: true });
  fs.writeFileSync(planFile, JSON.stringify({
    id: planId,
    createdAt: new Date().toISOString(),
    diagId: target.id,
    diagnostic: target,
    summary: 'Fix addition while intentionally breaking the regression guard.',
    source: 'FIXTURE',
    files: [
      { path: 'src/calculator.js', content: "function add(left, right) {\n  return left + right;\n}\n\nmodule.exports = { add };\n", diffPreview: '', changedLines: 1 },
      { path: 'src/regression-guard.js', content: "module.exports = { state: 'broken' };\n", diffPreview: '', changedLines: 1 },
    ],
    risk: { level: 'LOW', requiresApproval: true, requiresHighRiskApproval: false, reasons: ['Deterministic fixture'] },
    gamingWarnings: [],
    baselineResults,
    status: 'PENDING_APPROVAL',
  }, null, 2), 'utf8');
  const result = await applyRepairPlan(projectDir, planId, { approved: true });
  const after = await runDiagnostics(projectDir, { compareBaseline: false });
  const guard = after.find(item => item.id === 'regression-guard');
  const addition = after.find(item => item.id === 'repair-addition');
  const verified = result.status === 'ROLLED_BACK' && result.result.rolledBack && result.result.regressions.some(item => item.id === 'regression-guard') && guard?.status === 'OK' && addition?.status === 'ERROR';
  process.stdout.write(JSON.stringify({ verified, status: result.status, regressions: result.result.regressions }, null, 2) + '\n');
  if (!verified) process.exitCode = 1;
}

main().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
