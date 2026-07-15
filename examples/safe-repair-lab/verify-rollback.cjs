const fs = require('fs');
const path = require('path');
const { runDiagnostics } = require('../../src/runner');
const { applyRepairPlan } = require('../../src/repairer');

const projectDir = __dirname;
const planId = 'rollback-fixture';
const plansDir = path.join(projectDir, '.vibe-diagnosis', 'repair-plans');

async function main() {
  const baselineResults = await runDiagnostics(projectDir);
  const target = baselineResults.find(result => result.id === 'repair-addition');
  if (!target || target.status !== 'ERROR') throw new Error('Fixture must begin with the planned addition failure.');

  fs.mkdirSync(plansDir, { recursive: true });
  fs.writeFileSync(path.join(plansDir, `${planId}.json`), JSON.stringify({
    id: planId,
    createdAt: new Date().toISOString(),
    diagId: target.id,
    diagnostic: target,
    summary: 'Intentional fixture plan: fix addition but introduce a regression.',
    source: 'AI',
    files: [
      { path: 'src/calculator.js', content: "function add(left, right) {\n  return left + right;\n}\n\nmodule.exports = { add };\n", preview: '', changedLines: 1 },
      { path: 'src/regression-guard.js', content: "module.exports = { state: 'broken' };\n", preview: '', changedLines: 1 }
    ],
    risk: { level: 'LOW', requiresApproval: true, reasons: ['Intentional test fixture.'] },
    baselineResults,
    status: 'PENDING_APPROVAL'
  }, null, 2), 'utf8');

  const result = await applyRepairPlan(projectDir, planId, { approved: true });
  const afterRollback = await runDiagnostics(projectDir);
  const guard = afterRollback.find(item => item.id === 'regression-guard');
  const addition = afterRollback.find(item => item.id === 'repair-addition');
  const verified = result.status === 'ROLLED_BACK' && result.result.rolledBack && result.result.regressions.length === 1 && result.result.regressions[0].id === 'regression-guard' && guard?.status === 'OK' && addition?.status === 'ERROR';
  console.log(JSON.stringify({ verified, status: result.status, regressions: result.result.regressions, afterRollback }, null, 2));
  if (!verified) process.exitCode = 1;
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
