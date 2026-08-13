const LIVE_TYPES = new Set(['RUNTIME', 'DATA', 'PROVIDER', 'AUTHORITY', 'UI', 'LIVE_EVIDENCE']);

function normalizeEvidence(result, metadata, finishedAt) {
  const items = Array.isArray(result.evidence) ? result.evidence.map(item => ({ ...item })) : [];
  if (items.length === 0 && metadata.evidenceType !== 'UNSPECIFIED') {
    items.push({ type: metadata.evidenceType, summary: result.details || 'Diagnostic result', verifiedAt: result.lastVerifiedAt || metadata.lastVerifiedAt || finishedAt });
  }
  return items.map(item => {
    const verifiedAt = item.verifiedAt || result.lastVerifiedAt || metadata.lastVerifiedAt || finishedAt;
    const maxAgeMs = Number.isFinite(item.maxAgeMs) ? item.maxAgeMs : null;
    const ageMs = verifiedAt && !Number.isNaN(Date.parse(verifiedAt)) ? Math.max(0, Date.now() - Date.parse(verifiedAt)) : null;
    return { ...item, verifiedAt, maxAgeMs, freshness: ageMs === null ? 'UNKNOWN' : maxAgeMs !== null && ageMs > maxAgeMs ? 'STALE' : 'FRESH', live: LIVE_TYPES.has(item.type) };
  });
}

function summarizeEvidence(results) {
  const byType = {};
  const liveItems = [];
  for (const result of results) {
    for (const item of result.evidence || []) {
      if (!byType[item.type]) byType[item.type] = { total: 0, fresh: 0, stale: 0, unknown: 0 };
      const bucket = byType[item.type];
      bucket.total++;
      if (item.freshness === 'FRESH') bucket.fresh++;
      else if (item.freshness === 'STALE') bucket.stale++;
      else bucket.unknown++;
      if (item.live) liveItems.push({ status: result.status, freshness: item.freshness });
    }
  }
  let liveEvidenceStatus = 'UNVERIFIED';
  if (liveItems.some(item => item.status === 'ERROR')) liveEvidenceStatus = 'FAILED';
  else if (liveItems.some(item => item.freshness === 'STALE')) liveEvidenceStatus = 'STALE';
  else if (liveItems.some(item => item.status === 'WARNING' || item.freshness !== 'FRESH')) liveEvidenceStatus = 'PARTIAL';
  else if (liveItems.length > 0) liveEvidenceStatus = 'VERIFIED';
  const diagnosticsWithEvidence = results.filter(result => (result.evidence || []).length > 0).length;
  return {
    byType,
    liveEvidenceStatus,
    coverage: {
      diagnosticsWithEvidence,
      totalDiagnostics: results.length,
      percent: results.length ? Number(((diagnosticsWithEvidence / results.length) * 100).toFixed(2)) : 0,
      status: diagnosticsWithEvidence === results.length && results.length ? 'COMPLETE' : 'INCOMPLETE',
    },
  };
}

module.exports = { normalizeEvidence, summarizeEvidence, LIVE_TYPES };
