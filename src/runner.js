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
const { createCompletionReceipt } = require('./completion-receipt');
const { withDiagnosticsLock } = require('./diagnostics-lock');
const {
  describePolicy,
  consumeSkipOnce,
  diagnosticPolicyFingerprint,
  normalizeNecessity,
} = require('./diagnostic-policy');

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

async function runDiagnosticsReportUnlocked(projectDir, options = {}) {
  const resolvedProjectDir = path.resolve(projectDir);
  const allFiles = discoverDiagnostics(resolvedProjectDir);
  const environment = captureEnvironment(resolvedProjectDir);
  const candidates = selectDiagnostics(allFiles, options.filters || {});
  const policyInfo = describePolicy(candidates, resolvedProjectDir, {
    selectionMode: options.selectionMode || 'FULL',
    changedFiles: environment.git.changedFiles,
    force: options.force === true,
  });
  const decisions = new Map(policyInfo.decisions.map(item => [item.descriptor.id, item]));
  const runnableIds = new Set(policyInfo.decisions.filter(item => item.decision.run).map(item => item.descriptor.id));
  const byId = new Map(candidates.map(item => [item.id, item]));
  const dependencyQueue = [...runnableIds];
  while (dependencyQueue.length) {
    const current = byId.get(dependencyQueue.shift());
    for (const dependency of current?.dependencies || []) {
      const item = decisions.get(dependency);
      if (item?.entry.state === 'ENABLED' && !runnableIds.has(dependency)) {
        runnableIds.add(dependency);
        dependencyQueue.push(dependency);
        item.decision = { ...item.decision, run: true, reason: 'SELECTED_DEPENDENCY' };
      }
    }
  }
  const selected = candidates.filter(item => runnableIds.has(item.id));
  const skippedDiagnostics = policyInfo.decisions.filter(item => !runnableIds.has(item.descriptor.id)).map(item => ({
    id: item.descriptor.id,
    name: item.descriptor.name,
    diagnosticNecessity: normalizeNecessity(item.descriptor.diagnosticNecessity),
    necessityReason: item.descriptor.necessityReason || null,
    state: item.entry.state,
    reason: item.entry.reason,
    until: item.entry.until,
    skipReason: item.decision.reason,
  }));
  consumeSkipOnce(resolvedProjectDir, skippedDiagnostics.filter(item => item.state === 'SKIP_ONCE').map(item => item.id), policyInfo.policy);
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
      const result = await executeDiagnostic(resolvedProjectDir, descriptor.filePath, {
        ...options,
        evidenceType: descriptor.evidenceType,
        executionProfile: descriptor.executionProfile,
        allowedEnv: descriptor.allowedEnv,
      });
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
  const policyStates = skippedDiagnostics.reduce((counts, item) => {
    counts[item.skipReason] = (counts[item.skipReason] || 0) + 1;
    return counts;
  }, {});
  const report = {
    schemaVersion: 3,
    runId,
    startedAt,
    finishedAt: new Date().toISOString(),
    projectDir: resolvedProjectDir,
    selected: selected.length,
    discovered: allFiles.length,
    filteredOut: Math.max(0, allFiles.length - candidates.length),
    selectionMode: options.selectionMode || 'FULL',
    filters: options.filters || {},
    environment,
    policy: {
      fingerprint: diagnosticPolicyFingerprint(resolvedProjectDir),
      defaultNecessity: 4,
      skipped: skippedDiagnostics.length,
      removed: policyInfo.removed.length,
      skipReasons: policyStates,
    },
    skippedDiagnostics,
    removedDiagnostics: policyInfo.removed,
    results,
    ...summary,
  };
  if (options.persist === true) report.runFile = saveRunReport(resolvedProjectDir, report);
  return report;
}

async function runDiagnosticsReport(projectDir, options = {}) {
  return withDiagnosticsLock(projectDir, {
    executionKind: options.executionKind || 'diagnostics',
  }, () => runDiagnosticsReportUnlocked(projectDir, options));
}

async function runDiagnostics(projectDir, options = {}) {
  const report = await runDiagnosticsReport(projectDir, { ...options, persist: options.persist === true });
  return report.results;
}

async function runCompletionDiagnostics(projectDir, options = {}) {
  return withDiagnosticsLock(projectDir, { executionKind: options.executionKind || 'completion' }, async () => {
    const report = await runDiagnosticsReportUnlocked(projectDir, {
      ...options,
      persist: false,
      useCache: false,
      filters: {},
      selectionMode: 'AUTO',
    });
    const reasons = [];
    report.completionEnvironment = captureEnvironment(path.resolve(projectDir));
    if (report.discovered === 0) reasons.push('NO_DIAGNOSTICS');
    const requiredSkipped = report.skippedDiagnostics.filter(item => item.diagnosticNecessity === 5 && item.skipReason !== 'PRIORITY_NOT_DUE');
    if (requiredSkipped.length) reasons.push('REQUIRED_DIAGNOSTICS_SKIPPED');
    if (report.summary.error > 0) reasons.push('DIAGNOSTIC_FAILURES');
    if (report.gates.releaseStatus === 'RELEASE_BLOCKED') reasons.push('RELEASE_BLOCKED');
    if (report.environment.fingerprint !== report.completionEnvironment.fingerprint) reasons.push('WORKSPACE_CHANGED_DURING_DIAGNOSTICS');
    report.completion = {
      eligible: reasons.length === 0,
      reasons,
      fullSuite: report.selected === report.discovered,
      scheduledSuiteComplete: report.selected + report.skippedDiagnostics.length === report.discovered,
      requiredSkipped: requiredSkipped.map(item => item.id),
      exceptions: report.skippedDiagnostics.filter(item => item.skipReason !== 'PRIORITY_NOT_DUE').map(item => ({ id: item.id, state: item.state, reason: item.reason, until: item.until })),
      cacheUsed: false,
      dashboardRequired: false,
      warnings: report.summary.warning,
      verifiedFingerprint: report.completionEnvironment.fingerprint,
      instruction: reasons.length
        ? 'Do not report the development task complete. Resolve or accurately report failed or skipped required diagnostics.'
        : 'The uncached priority-aware completion suite completed. Report warnings, policy exceptions, and evidence limitations.',
    };
    report.completion.receipt = createCompletionReceipt(report);
    if (options.persist !== false) report.runFile = saveRunReport(path.resolve(projectDir), report);
    return report;
  });
}

module.exports = { runDiagnostics, runDiagnosticsReport, runCompletionDiagnostics, discoverDiagnostics, clearProjectRequireCache };
