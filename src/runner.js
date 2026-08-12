const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { executeDiagnostic } = require('./diagnostic-executor');
const { selectDiagnostics } = require('./selector');
const { readCache, writeCache, cacheKey, isCacheEligible } = require('./cache');
const { captureEnvironment } = require('./environment');
const { loadBaseline, compareToBaseline, linkChangedFiles, saveRunReport } = require('./baseline');
const { summarizeResults } = require('./run-summary');
const { detectFragileStringChecks } = require('./assertions');

const DIAG_DIR = '.vibe-diagnosis/diagnostics';
const DIAG_PATTERN = /\.diag\.js$/;

function discoverDiagnostics(projectDir) {
  const diagPath = path.join(projectDir, DIAG_DIR);
  if (!fs.existsSync(diagPath)) return [];
  return fs.readdirSync(diagPath).filter(file => DIAG_PATTERN.test(file)).sort().map(file => path.join(diagPath, file));
}

function clearProjectRequireCache(projectDir) {
  const root = path.resolve(projectDir) + path.sep;
  for (const cached of Object.keys(require.cache)) {
    if (path.resolve(cached).startsWith(root)) delete require.cache[cached];
  }
}

async function runDiagnosticsReport(projectDir, options = {}) {
  const resolvedProjectDir = path.resolve(projectDir);
  const allFiles = discoverDiagnostics(resolvedProjectDir);
  const environment = captureEnvironment(resolvedProjectDir);
  const selected = selectDiagnostics(allFiles, options.filters || {});
  const startedAt = new Date().toISOString();
  const runId = options.runId || `${startedAt.replace(/[:.]/g, '-')}-${crypto.randomBytes(3).toString('hex')}`;
  let results = [];
  const cache = options.useCache ? readCache(resolvedProjectDir) : {};
  let cacheChanged = false;

  if (allFiles.length === 0) {
    results = [{ id: '_no_diagnostics', name: 'No Diagnostics Found', layer: 'SYSTEM', status: 'WARNING', classification: null, details: `No .diag.js files found in ${DIAG_DIR}/`, duration: 0, severity: 'LOW', scope: 'GENERAL', evidenceType: 'STATIC', blocksRelease: false, blocksLiveTrading: false, confidence: 1, tags: [], dependencies: [], files: [], evidence: [] }];
  } else {
    for (const descriptor of selected) {
      const key = cacheKey(resolvedProjectDir, descriptor, environment.fingerprint);
      if (options.useCache && isCacheEligible(descriptor) && cache[key]) {
        results.push({ ...cache[key], cached: true });
        continue;
      }
      const result = await executeDiagnostic(resolvedProjectDir, descriptor.filePath, options);
      const fragileWarnings = detectFragileStringChecks(descriptor.source);
      result.warnings = [...(result.warnings || []), ...fragileWarnings];
      results.push(result);
      if (options.useCache && isCacheEligible(descriptor) && result.status === 'OK') {
        cache[key] = result;
        cacheChanged = true;
      }
    }
  }
  if (cacheChanged) writeCache(resolvedProjectDir, cache);
  const baseline = options.compareBaseline === false ? null : loadBaseline(resolvedProjectDir, options.baselineId);
  results = linkChangedFiles(compareToBaseline(results, baseline), environment.git.changedFiles);
  const summary = summarizeResults(results);
  const report = { schemaVersion: 2, runId, startedAt, finishedAt: new Date().toISOString(), projectDir: resolvedProjectDir, selected: selected.length, discovered: allFiles.length, filters: options.filters || {}, environment, results, ...summary };
  if (options.persist === true) report.runFile = saveRunReport(resolvedProjectDir, report);
  return report;
}

async function runDiagnostics(projectDir, options = {}) {
  const report = await runDiagnosticsReport(projectDir, { ...options, persist: options.persist === true });
  return report.results;
}

async function runCompletionDiagnostics(projectDir, options = {}) {
  const report = await runDiagnosticsReport(projectDir, {
    ...options,
    persist: false,
    useCache: false,
    filters: {},
  });
  const reasons = [];
  if (report.discovered === 0) reasons.push('NO_DIAGNOSTICS');
  if (report.selected !== report.discovered) reasons.push('INCOMPLETE_SELECTION');
  if (report.summary.error > 0) reasons.push('DIAGNOSTIC_FAILURES');
  if (report.gates.releaseStatus === 'RELEASE_BLOCKED') reasons.push('RELEASE_BLOCKED');
  report.completion = {
    eligible: reasons.length === 0,
    reasons,
    fullSuite: report.selected === report.discovered,
    cacheUsed: false,
    dashboardRequired: false,
    warnings: report.summary.warning,
    verifiedFingerprint: report.environment.fingerprint,
    instruction: reasons.length
      ? 'Do not report the development task complete. Resolve or accurately report the blocking diagnostics.'
      : 'The full uncached diagnostic suite completed. Report any warnings and evidence limitations with the result.',
  };
  if (options.persist !== false) report.runFile = saveRunReport(path.resolve(projectDir), report);
  return report;
}

module.exports = { runDiagnostics, runDiagnosticsReport, runCompletionDiagnostics, discoverDiagnostics, clearProjectRequireCache };
