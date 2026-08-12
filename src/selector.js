const fs = require('fs');
const path = require('path');

function extractLiteral(source, key) {
  const match = source.match(new RegExp(`(?:^|[,{])\\s*${key}\\s*:\\s*['\"]([^'\"]+)['\"]`));
  return match ? match[1] : null;
}

function extractArray(source, key) {
  const match = source.match(new RegExp(`(?:^|[,{])\\s*${key}\\s*:\\s*\\[([^\\]]*)\\]`));
  return match ? [...match[1].matchAll(/['\"]([^'\"]+)['\"]/g)].map(item => item[1]) : [];
}

function inspectDiagnosticSource(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const declaredId = extractLiteral(source, 'id');
  const declaredName = extractLiteral(source, 'name');
  const declaredLayer = extractLiteral(source, 'layer');
  const id = declaredId || path.basename(filePath, '.diag.js');
  const name = declaredName || path.basename(filePath);
  const layer = declaredLayer || 'UNKNOWN';
  const errors = [];
  if (!declaredId) errors.push('Static metadata inspection could not find a literal id.');
  if (!declaredName) errors.push('Static metadata inspection could not find a literal name.');
  if (!['TASK', 'FUNCTION', 'SYSTEM'].includes(layer)) errors.push(`Invalid or missing layer: ${layer}`);
  if (!/(?:async\s+)?run\s*(?:\(|:)/.test(source)) errors.push('Static metadata inspection could not find run().');
  return {
    filePath,
    id,
    name,
    layer,
    linkedTask: extractLiteral(source, 'linkedTask'),
    severity: extractLiteral(source, 'severity') || 'UNSPECIFIED',
    scope: extractLiteral(source, 'scope') || 'GENERAL',
    evidenceType: extractLiteral(source, 'evidenceType') || 'UNSPECIFIED',
    tags: extractArray(source, 'tags'),
    dependencies: extractArray(source, 'dependencies'),
    files: extractArray(source, 'files'),
    cache: /(?:^|[,{])\s*cache\s*:\s*true\b/.test(source),
    valid: errors.length === 0,
    errors,
    source,
  };
}

function selectDiagnostics(files, filters = {}) {
  const descriptors = files.map(inspectDiagnosticSource);
  const ids = new Set(filters.ids || []);
  const tags = new Set(filters.tags || []);
  let selected = descriptors.filter(item => {
    if (ids.size && !ids.has(item.id)) return false;
    if (tags.size && !item.tags.some(tag => tags.has(tag))) return false;
    if (filters.scope && item.scope !== filters.scope) return false;
    if (filters.severity && item.severity !== filters.severity) return false;
    return true;
  });
  if (filters.includeDependencies !== false) {
    const byId = new Map(descriptors.map(item => [item.id, item]));
    const included = new Map(selected.map(item => [item.id, item]));
    const queue = [...selected];
    while (queue.length) {
      for (const dependency of queue.shift().dependencies) {
        const item = byId.get(dependency);
        if (item && !included.has(item.id)) { included.set(item.id, item); queue.push(item); }
      }
    }
    selected = [...included.values()];
  }
  return selected.sort((a, b) => a.filePath.localeCompare(b.filePath));
}

module.exports = { inspectDiagnosticSource, selectDiagnostics };
