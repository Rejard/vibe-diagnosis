const fs = require('fs');
const path = require('path');

function finiteDuration(...values) {
  const value = values.find(item => Number.isFinite(item) && item >= 0);
  return value === undefined ? null : value;
}

function validTimestamp(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : null;
}

function canonicalProjectPath(value) {
  const resolved = path.resolve(value);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function normalizeResultTiming(result) {
  const execution = result?.execution && typeof result.execution === 'object' ? result.execution : {};
  const executionState = result?.executionState || (result?.cached ? 'CACHED' : 'EXECUTED');
  const wasExecuted = executionState === 'EXECUTED';
  const durationMs = wasExecuted ? finiteDuration(result?.durationMs, execution.durationMs, result?.duration, execution.duration) : null;
  const startedAt = wasExecuted ? validTimestamp(result?.startedAt) || validTimestamp(execution.startedAt) : null;
  const finishedAt = wasExecuted ? validTimestamp(result?.finishedAt) || validTimestamp(execution.finishedAt) : null;
  return {
    ...result,
    executionState,
    startedAt,
    finishedAt,
    durationMs,
    duration: durationMs,
    execution: {
      ...execution,
      startedAt,
      finishedAt,
      durationMs,
      duration: durationMs,
    },
  };
}

function normalizeSkippedTiming(item) {
  return {
    ...item,
    executionState: 'NOT_EXECUTED',
    startedAt: null,
    finishedAt: null,
    durationMs: null,
  };
}

function reportDuration(report) {
  const stored = finiteDuration(report?.durationMs, report?.totalDurationMs);
  if (stored !== null) return stored;
  const started = Date.parse(report?.startedAt);
  const finished = Date.parse(report?.finishedAt);
  return Number.isFinite(started) && Number.isFinite(finished) && finished >= started ? finished - started : null;
}

function normalizeRunReport(projectDir, report) {
  if (!report || typeof report !== 'object' || !Array.isArray(report.results)) return null;
  const resolvedProjectDir = path.resolve(projectDir);
  if (report.projectDir && (typeof report.projectDir !== 'string' || canonicalProjectPath(report.projectDir) !== canonicalProjectPath(resolvedProjectDir))) return null;
  const durationMs = reportDuration(report);
  return {
    ...report,
    projectDir: resolvedProjectDir,
    durationMs,
    totalDurationMs: durationMs,
    results: report.results.map(normalizeResultTiming),
    skippedDiagnostics: Array.isArray(report.skippedDiagnostics)
      ? report.skippedDiagnostics.map(normalizeSkippedTiming)
      : [],
  };
}

function latestRunPath(projectDir) {
  return path.join(path.resolve(projectDir), '.vibe-diagnosis', 'runs', 'latest.json');
}

function loadLatestRunReport(projectDir) {
  try {
    const report = JSON.parse(fs.readFileSync(latestRunPath(projectDir), 'utf8'));
    return normalizeRunReport(projectDir, report);
  } catch {
    return null;
  }
}

module.exports = {
  latestRunPath,
  loadLatestRunReport,
  normalizeRunReport,
  normalizeResultTiming,
};
