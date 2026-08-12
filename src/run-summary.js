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
  const healthPercent = summary.total ? Math.round((summary.ok / summary.total) * 100) : 100;
  const releaseBlockedBy = results.filter(r => r.status === 'ERROR' && r.severity === 'CRITICAL' && r.blocksRelease).map(r => r.id);
  const liveBlockedBy = results.filter(r => r.status === 'ERROR' && r.severity === 'CRITICAL' && r.blocksLiveTrading).map(r => r.id);
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
      releaseStatus: releaseBlockedBy.length ? 'RELEASE_BLOCKED' : 'RELEASE_ALLOWED',
      liveTradingStatus: liveBlockedBy.length ? 'LIVE_BLOCKED' : 'LIVE_ALLOWED',
      releaseBlockedBy,
      liveBlockedBy,
    },
    evidenceSummary: summarizeEvidence(results),
    domains,
    rootCauseGroups: groupRootCauses(results),
  };
}

module.exports = { summarizeResults };
