const { summarizeEvidence } = require('./evidence');
const { groupRootCauses } = require('./root-cause');

function summarizeResults(results) {
  const summary = {
    total: results.length,
    ok: results.filter(r => r.status === 'OK').length,
    warning: results.filter(r => r.status === 'WARNING').length,
    error: results.filter(r => r.status === 'ERROR').length,
    flaky: results.filter(r => r.classification === 'FLAKY').length,
  };
  const healthPercentExact = summary.total ? (summary.ok / summary.total) * 100 : 100;
  const healthPercent = Number(healthPercentExact.toFixed(2));
  const releaseBlockedBy = results.filter(r => r.status === 'ERROR' && r.blocksRelease).map(r => r.id);
  const liveBlockedBy = results.filter(r => r.status === 'ERROR' && r.blocksLiveTrading).map(r => r.id);
  const releaseEvaluated = results.some(r => r.gateDeclarations?.release);
  const liveEvaluated = results.some(r => r.gateDeclarations?.liveTrading);
  const evidenceSummary = summarizeEvidence(results);
  const overallStatus = releaseBlockedBy.length ? 'RELEASE_BLOCKED'
    : liveBlockedBy.length ? 'LIVE_BLOCKED'
      : summary.error ? 'ERROR' : summary.warning ? 'WARNING' : 'OK';
  const domains = {};
  for (const result of results) {
    const scope = result.scope || 'GENERAL';
    if (!domains[scope]) domains[scope] = { total: 0, ok: 0, warning: 0, error: 0 };
    domains[scope].total++;
    domains[scope][result.status.toLowerCase()]++;
  }
  return {
    summary,
    overallStatus,
    healthPercent,
    gates: {
      releaseStatus: releaseBlockedBy.length ? 'RELEASE_BLOCKED' : releaseEvaluated ? 'RELEASE_ALLOWED' : 'NOT_EVALUATED',
      liveTradingStatus: liveBlockedBy.length ? 'LIVE_BLOCKED' : liveEvaluated ? 'LIVE_ALLOWED' : 'NOT_EVALUATED',
      liveDiagnosticGateStatus: liveBlockedBy.length ? 'BLOCKED' : liveEvaluated ? 'PASSED' : 'NOT_EVALUATED',
      interpretation: 'Diagnostic policy gates only. LIVE_ALLOWED is a legacy gate value, not trading authorization or proof of service recovery or exchange fills.',
      releaseBlockedBy,
      liveBlockedBy,
      coverage: { release: releaseEvaluated, liveTrading: liveEvaluated },
    },
    evidenceSummary,
    domains,
    rootCauseGroups: groupRootCauses(results),
  };
}

module.exports = { summarizeResults };
