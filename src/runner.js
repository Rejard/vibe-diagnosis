const fs = require('fs');
const path = require('path');
const { validateDiagnosticModule, validateResult } = require('./schema');

const DIAG_DIR = '.vibe-diagnosis/diagnostics';
const DIAG_PATTERN = /\.diag\.js$/;

function clearProjectRequireCache(projectDir) {
  const projectRoot = path.resolve(projectDir) + path.sep;
  for (const modulePath of Object.keys(require.cache)) {
    if (modulePath.startsWith(projectRoot)) {
      delete require.cache[modulePath];
    }
  }
}

function discoverDiagnostics(projectDir) {
  const diagPath = path.join(projectDir, DIAG_DIR);

  if (!fs.existsSync(diagPath)) {
    return [];
  }

  return fs.readdirSync(diagPath)
    .filter(f => DIAG_PATTERN.test(f))
    .sort()
    .map(f => path.join(diagPath, f));
}

async function runDiagnostics(projectDir) {
  const files = discoverDiagnostics(projectDir);
  const results = [];

  if (files.length === 0) {
    return [{
      id: '_no_diagnostics',
      name: 'No Diagnostics Found',
      layer: 'SYSTEM',
      status: 'WARNING',
      details: `No .diag.js files found in ${DIAG_DIR}/`,
      duration: 0,
    }];
  }

  let db = null;
  try {
    const { PrismaClient } = require('@prisma/client');
    db = new PrismaClient();
  } catch (err) {
    // Prisma client is not available in the target project, which is fine
  }

  try {
    for (const filePath of files) {
      const startTime = Date.now();
      let mod;

      try {
        clearProjectRequireCache(projectDir);
        delete require.cache[require.resolve(filePath)];
        mod = require(filePath);
      } catch (err) {
        try {
          const fileUrl = require('url').pathToFileURL(filePath).href;
          const esmMod = await import(fileUrl);
          mod = esmMod.default || esmMod;
        } catch (esmErr) {
          results.push({
            id: path.basename(filePath, '.diag.js'),
            name: path.basename(filePath),
            layer: 'UNKNOWN',
            status: 'ERROR',
            details: `Failed to load: ${err.message}`,
            duration: Date.now() - startTime,
          });
          continue;
        }
      }

      const validation = validateDiagnosticModule(mod, filePath);
      if (!validation.valid) {
        results.push({
          id: mod.id || path.basename(filePath, '.diag.js'),
          name: mod.name || path.basename(filePath),
          layer: mod.layer || 'UNKNOWN',
          status: 'ERROR',
          details: `Schema violation: ${validation.errors.join('; ')}`,
          duration: Date.now() - startTime,
        });
        continue;
      }

      try {
        const result = await mod.run({ projectDir, db });
        const resultError = validateResult(result, mod.id);

        if (resultError) {
          results.push({
            id: mod.id,
            name: mod.name,
            layer: mod.layer,
            ...resultError,
            duration: Date.now() - startTime,
          });
        } else {
          results.push({
            id: mod.id,
            name: mod.name,
            layer: mod.layer,
            linkedTask: mod.linkedTask || null,
            status: result.status,
            details: result.details || '',
            duration: Date.now() - startTime,
          });
        }
      } catch (err) {
        results.push({
          id: mod.id,
          name: mod.name,
          layer: mod.layer,
          status: 'ERROR',
          details: `Runtime error: ${err.message}`,
          duration: Date.now() - startTime,
        });
      }
    }
  } finally {
    if (db && typeof db.$disconnect === 'function') {
      try {
        await db.$disconnect();
      } catch (err) {
        // Safe disconnection handling
      }
    }
  }

  return results;
}

module.exports = { runDiagnostics, discoverDiagnostics, clearProjectRequireCache };
