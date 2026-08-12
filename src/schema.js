const VALID_STATUSES = ['OK', 'WARNING', 'ERROR'];
const VALID_LAYERS = ['TASK', 'FUNCTION', 'SYSTEM'];
const VALID_CLASSIFICATIONS = ['CONTRACT_ERROR', 'TEST_FAILURE', 'RUNNER_ERROR', 'TIMEOUT', 'FLAKY'];
const VALID_SEVERITIES = ['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const VALID_EVIDENCE_TYPES = ['STATIC', 'TEST', 'RUNTIME', 'DATA', 'PROVIDER', 'AUTHORITY', 'UI', 'LIVE_EVIDENCE', 'UNSPECIFIED'];

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateDiagnosticModule(mod, filePath) {
  const errors = [];
  if (!mod || typeof mod !== 'object') {
    return { valid: false, errors: [`${filePath}: module.exports must be an object`] };
  }
  if (!isNonEmptyString(mod.id)) errors.push('missing or invalid "id" (must be a non-empty string)');
  if (!isNonEmptyString(mod.name)) errors.push('missing or invalid "name" (must be a non-empty string)');
  if (!mod.layer || !VALID_LAYERS.includes(mod.layer)) {
    errors.push(`invalid "layer" (must be one of: ${VALID_LAYERS.join(', ')})`);
  }
  if (typeof mod.run !== 'function') errors.push('missing "run" function');
  if (mod.severity !== undefined && !VALID_SEVERITIES.includes(mod.severity)) {
    errors.push(`invalid "severity" (must be one of: ${VALID_SEVERITIES.join(', ')})`);
  }
  if (mod.evidenceType !== undefined && !VALID_EVIDENCE_TYPES.includes(mod.evidenceType)) {
    errors.push(`invalid "evidenceType" (must be one of: ${VALID_EVIDENCE_TYPES.join(', ')})`);
  }
  if (mod.scope !== undefined && !isNonEmptyString(mod.scope)) errors.push('invalid "scope" (must be a non-empty string)');
  if (mod.lastVerifiedAt !== undefined && Number.isNaN(Date.parse(mod.lastVerifiedAt))) errors.push('invalid "lastVerifiedAt" (must be an ISO date)');
  if (mod.confidence !== undefined && (typeof mod.confidence !== 'number' || mod.confidence < 0 || mod.confidence > 1)) {
    errors.push('invalid "confidence" (must be a number between 0 and 1)');
  }
  for (const field of ['blocksRelease', 'blocksLiveTrading']) {
    if (mod[field] !== undefined && typeof mod[field] !== 'boolean') errors.push(`invalid "${field}" (must be boolean)`);
  }
  for (const field of ['tags', 'dependencies', 'files']) {
    if (mod[field] !== undefined && (!Array.isArray(mod[field]) || mod[field].some(v => !isNonEmptyString(v)))) {
      errors.push(`invalid "${field}" (must be an array of non-empty strings)`);
    }
  }
  return { valid: errors.length === 0, errors: errors.map(e => `${filePath}: ${e}`) };
}

function validateEvidence(evidence, diagId) {
  if (!Array.isArray(evidence)) return [`Diagnostic "${diagId}" evidence must be an array`];
  const errors = [];
  evidence.forEach((item, index) => {
    if (!item || typeof item !== 'object') {
      errors.push(`evidence[${index}] must be an object`);
      return;
    }
    if (!VALID_EVIDENCE_TYPES.includes(item.type)) errors.push(`evidence[${index}] has invalid type "${item.type}"`);
    if (!isNonEmptyString(item.summary)) errors.push(`evidence[${index}] requires summary`);
    if (item.verifiedAt !== undefined && Number.isNaN(Date.parse(item.verifiedAt))) {
      errors.push(`evidence[${index}] has invalid verifiedAt`);
    }
  });
  return errors;
}

function validateResult(result, diagId) {
  if (!result || typeof result !== 'object') {
    return { status: 'ERROR', classification: 'CONTRACT_ERROR', details: `Diagnostic "${diagId}" returned invalid result (expected object)` };
  }
  if (!VALID_STATUSES.includes(result.status)) {
    return { status: 'ERROR', classification: 'CONTRACT_ERROR', details: `Diagnostic "${diagId}" returned invalid status "${result.status}" (must be OK, WARNING, or ERROR)` };
  }
  if (result.classification !== undefined && !VALID_CLASSIFICATIONS.includes(result.classification)) {
    return { status: 'ERROR', classification: 'CONTRACT_ERROR', details: `Diagnostic "${diagId}" returned invalid classification "${result.classification}"` };
  }
  if (result.evidence !== undefined) {
    const evidenceErrors = validateEvidence(result.evidence, diagId);
    if (evidenceErrors.length) {
      return { status: 'ERROR', classification: 'CONTRACT_ERROR', details: evidenceErrors.join('; ') };
    }
  }
  return null;
}

function normalizeMetadata(mod = {}) {
  return {
    linkedTask: mod.linkedTask || null,
    severity: mod.severity || 'UNSPECIFIED',
    scope: mod.scope || 'GENERAL',
    evidenceType: mod.evidenceType || 'UNSPECIFIED',
    blocksRelease: mod.blocksRelease === true,
    blocksLiveTrading: mod.blocksLiveTrading === true,
    confidence: typeof mod.confidence === 'number' ? mod.confidence : null,
    lastVerifiedAt: mod.lastVerifiedAt || null,
    tags: Array.isArray(mod.tags) ? mod.tags : [],
    dependencies: Array.isArray(mod.dependencies) ? mod.dependencies : [],
    files: Array.isArray(mod.files) ? mod.files : [],
    cache: mod.cache === true,
    timeoutMs: Number.isFinite(mod.timeoutMs) ? Math.max(100, mod.timeoutMs) : null,
  };
}

module.exports = {
  validateDiagnosticModule,
  validateResult,
  validateEvidence,
  normalizeMetadata,
  VALID_STATUSES,
  VALID_LAYERS,
  VALID_CLASSIFICATIONS,
  VALID_SEVERITIES,
  VALID_EVIDENCE_TYPES,
};
