const path = require('path');
const { summarizeResults } = require('./run-summary');

const LAYERS = { TASK: 'TASK', FUNCTION: 'FUNC', SYSTEM: 'SYS ', UNKNOWN: '??? ' };
const ICONS = { OK: '\x1b[32mOK     \x1b[0m', WARNING: '\x1b[33mWARNING\x1b[0m', ERROR: '\x1b[31mERROR  \x1b[0m' };

function asReport(value) {
  if (!Array.isArray(value)) return value;
  return { results: value, ...summarizeResults(value), schemaVersion: 2, timestamp: new Date().toISOString() };
}

function formatResults(value, projectDir) {
  const report = asReport(value);
  let pkg;
  try { pkg = require(path.join(projectDir, 'package.json')); } catch { pkg = { name: path.basename(projectDir), version: '0.0.0' }; }
  const lines = ['', `  Vibe Diagnosis v${pkg.version} - ${pkg.name}`, '  -----------------------------------------------------------------'];
  for (const result of report.results) {
    const layer = LAYERS[result.layer] || LAYERS.UNKNOWN;
    const classification = result.classification ? `/${result.classification}` : '';
    lines.push(`  ${layer} | ${result.id.padEnd(28)} | ${ICONS[result.status] || ICONS.ERROR} | ${result.details}${classification}`);
    if (result.execution?.stderr) lines.push(`       stderr: ${result.execution.stderr.trim().slice(0, 500)}`);
  }
  lines.push('  -----------------------------------------------------------------');
  lines.push(`  Total: ${report.summary.total} | OK: ${report.summary.ok} | WARN: ${report.summary.warning} | ERR: ${report.summary.error} | FLAKY: ${report.summary.flaky || 0}`);
  lines.push(`  Overall: ${report.overallStatus} - Health ${report.healthPercent}%`);
  lines.push(`  Release: ${report.gates.releaseStatus} | Live: ${report.gates.liveTradingStatus} | Live evidence: ${report.evidenceSummary.liveEvidenceStatus}`, '');
  return lines.join('\n');
}

function formatResultsJson(value) {
  return JSON.stringify(asReport(value), null, 2) + '\n';
}

module.exports = { formatResults, formatResultsJson };
