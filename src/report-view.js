const VERBOSITY_LEVELS = ['summary', 'list', 'full'];
const DEFAULT_VERBOSITY = 'summary';

function normalizeVerbosity(value) {
  return VERBOSITY_LEVELS.includes(value) ? value : DEFAULT_VERBOSITY;
}

function isPassing(result) {
  return Boolean(result) && result.status === 'OK';
}

function passingRow(result) {
  return {
    id: result.id,
    name: result.name,
    status: result.status,
    executionState: result.executionState ?? null,
    durationMs: result.durationMs ?? null,
  };
}

function skippedRow(item) {
  return {
    id: item.id,
    name: item.name,
    state: item.state,
    skipReason: item.skipReason,
    executionState: item.executionState ?? 'NOT_EXECUTED',
  };
}

function compactEnvironment(environment) {
  if (!environment || typeof environment !== 'object') return environment;
  const git = environment.git && typeof environment.git === 'object' ? environment.git : {};
  const { changedFiles, protectedFiles, ...rest } = git;
  return {
    ...environment,
    git: {
      ...rest,
      changedFileCount: Array.isArray(changedFiles) ? changedFiles.length : 0,
      protectedFileCount: Array.isArray(protectedFiles) ? protectedFiles.length : 0,
    },
  };
}

const HINT = 'Every failing diagnostic is here in full. verbosity:"list" adds passing rows, verbosity:"full" returns the unshaped report, runFile holds the complete report.';

function shapeReport(report, verbosity) {
  const mode = normalizeVerbosity(verbosity);
  if (mode === 'full' || !report || typeof report !== 'object' || Array.isArray(report)) return report;
  const results = Array.isArray(report.results) ? report.results : [];
  const failing = results.filter(result => !isPassing(result));
  const passing = results.filter(isPassing);
  const skipped = Array.isArray(report.skippedDiagnostics) ? report.skippedDiagnostics : [];
  const shaped = { ...report };
  shaped.results = mode === 'list' ? [...failing, ...passing.map(passingRow)] : failing;
  if (mode === 'list') shaped.skippedDiagnostics = skipped.map(skippedRow);
  else delete shaped.skippedDiagnostics;
  if (report.environment) shaped.environment = compactEnvironment(report.environment);
  if (report.completionEnvironment) shaped.completionEnvironment = compactEnvironment(report.completionEnvironment);
  shaped.response = {
    verbosity: mode,
    results: {
      failing: failing.length,
      passing: passing.length,
      failingDetail: 'FULL',
      passingDetail: mode === 'list' ? 'ID_NAME_DURATION' : 'OMITTED',
    },
    skippedDiagnostics: {
      total: skipped.length,
      detail: mode === 'list' ? 'ID_NAME_REASON' : 'OMITTED',
    },
    environmentFileLists: 'OMITTED',
    hint: HINT,
  };
  return shaped;
}

module.exports = { shapeReport, normalizeVerbosity, VERBOSITY_LEVELS, DEFAULT_VERBOSITY };
