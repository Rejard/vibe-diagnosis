const fs = require('fs');

function loadParser() {
  try { return require('acorn'); } catch { return null; }
}

function parseAst(source, options = {}) {
  const acorn = loadParser();
  if (!acorn) throw new Error('AST assertions require the "acorn" dependency');
  if (options.sourceType) return acorn.parse(source, { ecmaVersion: 'latest', sourceType: options.sourceType, allowHashBang: true });
  try { return acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'module', allowHashBang: true }); }
  catch { return acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'script', allowHashBang: true }); }
}

function walk(node, visitor) {
  if (!node || typeof node !== 'object') return;
  visitor(node);
  for (const [key, value] of Object.entries(node)) {
    if (key === 'start' || key === 'end' || key === 'loc') continue;
    if (Array.isArray(value)) value.forEach(child => walk(child, visitor));
    else if (value && typeof value.type === 'string') walk(value, visitor);
  }
}

function assertAst(source, predicate, message = 'AST assertion failed') {
  const ast = parseAst(source);
  const nodes = [];
  walk(ast, node => nodes.push(node));
  if (!predicate({ ast, nodes })) throw new Error(message);
  return { ok: true, nodes: nodes.length };
}

function assertExport(target, exportName) {
  const mod = typeof target === 'string' ? require(target) : target;
  if (!mod || !(exportName in mod)) throw new Error(`Expected export "${exportName}" was not found`);
  return mod[exportName];
}

function assertRoute(router, method, routePath) {
  const expectedMethod = method.toLowerCase();
  const layers = router?.stack || router?._router?.stack || [];
  const match = layers.find(layer => layer.route?.path === routePath && layer.route?.methods?.[expectedMethod]);
  if (!match) throw new Error(`Expected ${method.toUpperCase()} route "${routePath}" was not registered`);
  return match;
}

async function assertApi({ request, status, validate }) {
  const response = await request();
  if (status !== undefined && response.status !== status && response.statusCode !== status) {
    throw new Error(`Expected HTTP ${status}, received ${response.status ?? response.statusCode}`);
  }
  if (validate) await validate(response);
  return response;
}

async function assertStateTransition({ arrange, act, read, validate }) {
  const initial = arrange ? await arrange() : undefined;
  const action = await act(initial);
  const finalState = await read(initial, action);
  const valid = await validate({ initial, action, finalState });
  if (valid === false) throw new Error('State transition assertion failed');
  return { initial, action, finalState };
}

async function assertRender({ render, query, validate }) {
  const output = await render();
  const selected = await query(output);
  const valid = validate ? await validate(selected, output) : Boolean(selected);
  if (valid === false) throw new Error('Rendered behavior assertion failed');
  return selected;
}

function detectFragileStringChecks(sourceOrPath) {
  const source = fs.existsSync(sourceOrPath) ? fs.readFileSync(sourceOrPath, 'utf8') : sourceOrPath;
  const warnings = [];
  try {
    const ast = parseAst(source);
    walk(ast, node => {
      if (node.type !== 'CallExpression' || node.callee?.type !== 'MemberExpression') return;
      const property = node.callee.property;
      const isIncludes = (!node.callee.computed && property?.name === 'includes') || (node.callee.computed && property?.value === 'includes');
      const arg = node.arguments?.[0];
      const objectName = node.callee.object?.name || '';
      if (isIncludes && arg?.type === 'Literal' && typeof arg.value === 'string' && /source|content|code|html|jsx|file/i.test(objectName)) {
        warnings.push({ code: 'fragile-string-check', message: `Literal string check on ${objectName || 'source'}: ${JSON.stringify(arg.value)}`, start: node.start, end: node.end });
      }
    });
  } catch {
    if (/\b(?:source|content|code|html|jsx)\.includes\(\s*['"]/i.test(source)) {
      warnings.push({ code: 'fragile-string-check', message: 'String-based source check detected; AST parsing was unavailable.' });
    }
  }
  return warnings;
}

module.exports = { parseAst, walk, assertAst, assertExport, assertRoute, assertApi, assertStateTransition, assertRender, detectFragileStringChecks };
