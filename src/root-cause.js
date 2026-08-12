const crypto = require('crypto');

function signature(result) {
  const execution = result.execution || {};
  const material = [result.classification, execution.exitCode, execution.signal, execution.timedOut, execution.stderr || '', result.details || '']
    .join('|').replace(/\d{4}-\d\d-\d\dT\S+/g, '<time>').replace(/\b\d+ms\b/g, '<duration>');
  return crypto.createHash('sha1').update(material).digest('hex').slice(0, 12);
}

function groupRootCauses(results) {
  const groups = new Map();
  for (const result of results.filter(item => item.status !== 'OK')) {
    const key = signature(result);
    if (!groups.has(key)) groups.set(key, { id: `root-${key}`, classification: result.classification || 'TEST_FAILURE', diagnostics: [], summary: result.execution?.stderr || result.details || '' });
    groups.get(key).diagnostics.push(result.id);
  }
  return [...groups.values()];
}

module.exports = { groupRootCauses };
