const fs = require('fs');
const path = require('path');
const { parseAst, walk } = require('./assertions');
const { normalizeNecessity } = require('./diagnostic-policy');

function extractLiteral(source, key) {
  const match = source.match(new RegExp(`(?:^|[,{])\\s*${key}\\s*:\\s*['\"]([^'\"]+)['\"]`));
  return match ? match[1] : null;
}

function extractArray(source, key) {
  const match = source.match(new RegExp(`(?:^|[,{])\\s*${key}\\s*:\\s*\\[([^\\]]*)\\]`));
  return match ? [...match[1].matchAll(/['\"]([^'\"]+)['\"]/g)].map(item => item[1]) : [];
}

function propertyName(property) {
  if (!property?.computed && property?.key?.name) return property.key.name;
  if (property?.key?.type === 'Literal') return property.key.value;
  return null;
}

function moduleExportObject(source) {
  const ast = parseAst(source);
  let exported = null;
  walk(ast, node => {
    if (exported || node.type !== 'AssignmentExpression' || node.right?.type !== 'ObjectExpression') return;
    const left = node.left;
    if (left?.type === 'MemberExpression' && left.object?.name === 'module' && propertyName({ key: left.property, computed: left.computed }) === 'exports') exported = node.right;
  });
  return exported;
}

function staticValue(object, key) {
  const property = object?.properties?.find(item => propertyName(item) === key);
  if (!property) return undefined;
  if (property.value?.type === 'Literal') return property.value.value;
  if (property.value?.type === 'ArrayExpression') {
    const values = property.value.elements.map(item => item?.type === 'Literal' ? item.value : undefined);
    return values.every(value => typeof value === 'string') ? values : undefined;
  }
  return undefined;
}

function hasRunFunction(object) {
  return Boolean(object?.properties?.some(property => propertyName(property) === 'run' && (
    property.method || ['FunctionExpression', 'ArrowFunctionExpression'].includes(property.value?.type)
  )));
}

function inspectDiagnosticSource(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  let object = null;
  let astError = null;
  try { object = moduleExportObject(source); } catch (error) { astError = error; }
  const value = key => object ? staticValue(object, key) : extractLiteral(source, key);
  const array = key => object ? (staticValue(object, key) || []) : extractArray(source, key);
  const declaredId = value('id');
  const declaredName = value('name');
  const declaredLayer = value('layer');
  const declaredNecessity = object ? staticValue(object, 'diagnosticNecessity') : null;
  const necessityReason = value('necessityReason') || null;
  const id = declaredId || path.basename(filePath, '.diag.js');
  const name = declaredName || path.basename(filePath);
  const layer = declaredLayer || 'UNKNOWN';
  const errors = [];
  if (!declaredId) errors.push('Static metadata inspection could not find a literal id.');
  if (!declaredName) errors.push('Static metadata inspection could not find a literal name.');
  if (!['TASK', 'FUNCTION', 'SYSTEM'].includes(layer)) errors.push(`Invalid or missing layer: ${layer}`);
  if (astError) errors.push(`AST metadata inspection failed: ${astError.message}`);
  if (object ? !hasRunFunction(object) : !/(?:async\s+)?run\s*(?:\(|:)/.test(source)) errors.push('Static metadata inspection could not find run().');
  if (declaredNecessity !== undefined && declaredNecessity !== null && (!Number.isInteger(declaredNecessity) || declaredNecessity < 1 || declaredNecessity > 5)) errors.push('diagnosticNecessity must be an integer from 1 to 5.');
  if (declaredNecessity !== undefined && declaredNecessity !== null && !necessityReason) errors.push('necessityReason is required when diagnosticNecessity is declared.');
  return {
    filePath,
    id,
    name,
    layer,
    linkedTask: value('linkedTask') || null,
    severity: value('severity') || 'UNSPECIFIED',
    scope: value('scope') || 'GENERAL',
    evidenceType: value('evidenceType') || 'UNSPECIFIED',
    executionProfile: value('executionProfile') || null,
    allowedEnv: array('allowedEnv'),
    tags: array('tags'),
    dependencies: array('dependencies'),
    files: array('files'),
    cache: object ? staticValue(object, 'cache') === true : /(?:^|[,{])\s*cache\s*:\s*true\b/.test(source),
    blocksRelease: object ? staticValue(object, 'blocksRelease') === true : /(?:^|[,{])\s*blocksRelease\s*:\s*true\b/.test(source),
    blocksLiveTrading: object ? staticValue(object, 'blocksLiveTrading') === true : /(?:^|[,{])\s*blocksLiveTrading\s*:\s*true\b/.test(source),
    diagnosticNecessity: normalizeNecessity(declaredNecessity),
    necessityReason: necessityReason || (declaredNecessity === undefined || declaredNecessity === null ? 'Legacy diagnostic default (4/5)' : null),
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
