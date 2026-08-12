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
  return {
    filePath,
    id: extractLiteral(source, 'id') || path.basename(filePath, '.diag.js'),
    severity: extractLiteral(source, 'severity') || 'UNSPECIFIED',
    scope: extractLiteral(source, 'scope') || 'GENERAL',
    evidenceType: extractLiteral(source, 'evidenceType') || 'UNSPECIFIED',
    tags: extractArray(source, 'tags'),
    dependencies: extractArray(source, 'dependencies'),
    files: extractArray(source, 'files'),
    cache: /(?:^|[,{])\s*cache\s*:\s*true\b/.test(source),
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
