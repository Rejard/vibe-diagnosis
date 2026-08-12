const path = require('path');
const { pathToFileURL } = require('url');
const { validateDiagnosticModule, validateResult, normalizeMetadata } = require('./schema');

function serializeError(error) {
  return {
    name: error?.name || 'Error',
    message: error?.message || String(error),
    code: error?.code || null,
    stack: error?.stack || null,
    exitCode: Number.isInteger(error?.status) ? error.status : null,
    signal: error?.signal || null,
    stdout: error?.stdout ? String(error.stdout) : '',
    stderr: error?.stderr ? String(error.stderr) : '',
  };
}

async function loadDiagnostic(filePath) {
  try {
    delete require.cache[require.resolve(filePath)];
    return require(filePath);
  } catch (cjsError) {
    try {
      const esm = await import(`${pathToFileURL(filePath).href}?run=${Date.now()}`);
      return esm.default || esm;
    } catch (esmError) {
      const error = new Error(`Failed to load diagnostic: ${cjsError.message}; ESM fallback: ${esmError.message}`);
      error.code = 'DIAGNOSTIC_LOAD_FAILED';
      throw error;
    }
  }
}

async function main() {
  const projectDir = path.resolve(process.argv[2]);
  const filePath = path.resolve(process.argv[3]);
  process.chdir(projectDir);
  console.log = (...args) => process.stderr.write(args.map(value => typeof value === 'object' ? JSON.stringify(value) : String(value)).join(' ') + '\n');
  console.info = console.log;
  let db = null;
  let mod;
  try {
    mod = await loadDiagnostic(filePath);
    const validation = validateDiagnosticModule(mod, filePath);
    if (!validation.valid) {
      process.send?.({ type: 'result', kind: 'contract_error', module: { id: mod?.id, name: mod?.name, layer: mod?.layer, ...normalizeMetadata(mod) }, error: { message: validation.errors.join('; ') } });
      return;
    }
    process.send?.({ type: 'metadata', module: { id: mod.id, name: mod.name, layer: mod.layer, ...normalizeMetadata(mod) } });
    try {
      const { PrismaClient } = require(path.join(projectDir, 'node_modules', '@prisma', 'client'));
      db = new PrismaClient();
    } catch {}
    const result = await mod.run({ projectDir, db });
    const resultError = validateResult(result, mod.id);
    if (resultError) {
      process.send?.({ type: 'result', kind: 'contract_error', module: { id: mod.id, name: mod.name, layer: mod.layer, ...normalizeMetadata(mod) }, error: { message: resultError.details } });
      return;
    }
    process.send?.({ type: 'result', kind: 'diagnostic_result', module: { id: mod.id, name: mod.name, layer: mod.layer, ...normalizeMetadata(mod) }, result });
  } catch (error) {
    process.send?.({ type: 'result', kind: error?.name === 'AssertionError' ? 'test_failure' : 'runner_error', module: mod ? { id: mod.id, name: mod.name, layer: mod.layer, ...normalizeMetadata(mod) } : null, error: serializeError(error) });
  } finally {
    if (db && typeof db.$disconnect === 'function') {
      try { await db.$disconnect(); } catch {}
    }
  }
}

const keepAlive = setInterval(() => {}, 1000);
main().then(() => {
  clearInterval(keepAlive);
  if (process.connected) process.disconnect();
  setImmediate(() => process.exit(0));
}).catch(error => {
  clearInterval(keepAlive);
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exit(1);
});
