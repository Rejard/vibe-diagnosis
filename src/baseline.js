const fs = require('fs');
const path = require('path');

function runsDir(projectDir) { return path.join(projectDir, '.vibe-diagnosis', 'runs'); }

function saveRunReport(projectDir, report) {
  const dir = runsDir(projectDir);
  fs.mkdirSync(dir, { recursive: true });
  const target = path.join(dir, `${report.runId}.json`);
  fs.writeFileSync(target, JSON.stringify(report, null, 2), 'utf8');
  fs.writeFileSync(path.join(dir, 'latest.json'), JSON.stringify(report, null, 2), 'utf8');
  return target;
}

function loadBaseline(projectDir, baselineId) {
  const target = path.join(runsDir(projectDir), baselineId ? `${baselineId}.json` : 'latest.json');
  try { return JSON.parse(fs.readFileSync(target, 'utf8')); } catch { return null; }
}

function stableResult(result) {
  return JSON.stringify({ status: result.status, classification: result.classification || null, details: result.details || '', severity: result.severity, scope: result.scope });
}

function compareToBaseline(results, baseline) {
  if (!baseline?.results) return results.map(result => ({ ...result, comparison: 'NO_BASELINE' }));
  const previous = new Map(baseline.results.map(result => [result.id, result]));
  return results.map(result => {
    const before = previous.get(result.id);
    let comparison;
    if (!before) comparison = result.status === 'ERROR' ? 'NEW_FAILURE' : 'CHANGED';
    else if (before.status !== 'ERROR' && result.status === 'ERROR') comparison = 'NEW_FAILURE';
    else if (before.status === 'ERROR' && result.status === 'ERROR') comparison = 'EXISTING_FAILURE';
    else if (before.status === 'ERROR' && result.status !== 'ERROR') comparison = 'RESOLVED';
    else comparison = stableResult(before) === stableResult(result) ? 'UNCHANGED' : 'CHANGED';
    return { ...result, comparison };
  });
}

function linkChangedFiles(results, changedFiles) {
  return results.map(result => {
    const declared = new Set(result.files || []);
    const linked = changedFiles.filter(file => declared.has(file) || [...declared].some(dep => file.startsWith(`${dep}/`)));
    return { ...result, changedFileLinks: linked.map(file => ({ file, relation: 'DECLARED' })) };
  });
}

module.exports = { saveRunReport, loadBaseline, compareToBaseline, linkChangedFiles };
