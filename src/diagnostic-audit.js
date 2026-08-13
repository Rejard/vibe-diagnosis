const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { inspectDiagnosticSource } = require('./selector');
const { detectFragileStringChecks } = require('./assertions');

function normalizedHash(source) {
  return crypto.createHash('sha256').update(source.replace(/\s+/g, ' ').trim()).digest('hex');
}

function existsModule(target) {
  return fs.existsSync(target) || fs.existsSync(`${target}.js`) || fs.existsSync(path.join(target, 'index.js'));
}

function referencedFiles(projectDir, diagnosticFile, source) {
  const refs = [];
  for (const match of source.matchAll(/path\.join\(\s*projectDir\s*,\s*['"]([^'"]+)['"]/g)) {
    refs.push({ file: match[1], target: path.resolve(projectDir, match[1]) });
  }
  for (const match of source.matchAll(/require\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g)) {
    refs.push({ file: match[1], target: path.resolve(path.dirname(diagnosticFile), match[1]) });
  }
  const unique = new Map(refs.map(ref => [`${ref.file}|${ref.target}`, ref]));
  return [...unique.values()].map(ref => ({ file: ref.file, exists: existsModule(ref.target) }));
}

function auditDiagnostics(projectDir, files) {
  const descriptors = files.map(inspectDiagnosticSource);
  const knownIds = new Set(descriptors.map(item => item.id));
  const ids = new Map();
  const hashes = new Map();
  const diagnostics = descriptors.map(item => {
    if (!ids.has(item.id)) ids.set(item.id, []);
    ids.get(item.id).push(item.filePath);
    const hash = normalizedHash(item.source);
    if (!hashes.has(hash)) hashes.set(hash, []);
    hashes.get(hash).push(item.filePath);
    const refs = referencedFiles(projectDir, item.filePath, item.source);
    const declaredMissingFiles = item.files.filter(file => !existsModule(path.resolve(projectDir, file)));
    return {
      id: item.id,
      file: path.relative(projectDir, item.filePath),
      fragileStringChecks: detectFragileStringChecks(item.source),
      missingReferences: [...new Set([...refs.filter(ref => !ref.exists).map(ref => ref.file), ...declaredMissingFiles])],
      dependencies: item.dependencies,
      missingDependencies: item.dependencies.filter(dependency => !knownIds.has(dependency)),
    };
  });
  return {
    diagnostics,
    duplicateIds: [...ids].filter(([, values]) => values.length > 1).map(([id, values]) => ({ id, files: values.map(file => path.relative(projectDir, file)) })),
    duplicateSources: [...hashes].filter(([, values]) => values.length > 1).map(([hash, values]) => ({ hash, files: values.map(file => path.relative(projectDir, file)) })),
    totals: {
      diagnostics: diagnostics.length,
      fragileStringChecks: diagnostics.reduce((sum, item) => sum + item.fragileStringChecks.length, 0),
      missingReferences: diagnostics.reduce((sum, item) => sum + item.missingReferences.length, 0),
      missingDependencies: diagnostics.reduce((sum, item) => sum + item.missingDependencies.length, 0),
    },
  };
}

module.exports = { auditDiagnostics };
