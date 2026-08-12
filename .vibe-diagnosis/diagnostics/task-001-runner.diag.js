module.exports = {
  id: 'task-001-runner',
  name: 'Runner Engine Smoke Test',
  layer: 'TASK',
  linkedTask: 'TASK-001',
  severity: 'CRITICAL',
  scope: 'RELEASE',
  evidenceType: 'TEST',
  blocksRelease: true,
  confidence: 1,
  tags: ['runner', 'schema'],
  files: ['src/runner.js', 'src/schema.js', 'examples/calculator/.vibe-diagnosis/diagnostics/func-calc-engine.diag.js', 'examples/calculator/.vibe-diagnosis/diagnostics/task-001-arithmetic.diag.js', 'examples/calculator/.vibe-diagnosis/diagnostics/task-002-division-zero.diag.js'],

  async run(ctx) {
    const { discoverDiagnostics, runDiagnostics } = require('../../src/runner');
    const { validateDiagnosticModule, validateResult } = require('../../src/schema');
    const path = require('path');

    const exampleDir = path.join(ctx.projectDir, 'examples', 'calculator');
    const files = discoverDiagnostics(exampleDir);

    if (files.length === 0) {
      return { status: 'ERROR', details: 'No diagnostic files discovered in examples/calculator' };
    }

    if (files.length !== 3) {
      return {
        status: 'WARNING',
        details: `Expected 3 diagnostic files, found ${files.length}`,
      };
    }

    for (const f of files) {
      const mod = require(f);
      const validation = validateDiagnosticModule(mod, f);
      if (!validation.valid) {
        return {
          status: 'ERROR',
          details: `Schema validation failed for ${path.basename(f)}: ${validation.errors.join('; ')}`,
        };
      }
    }

    const goodResult = { status: 'OK', details: 'test' };
    const badResult = { status: 'INVALID', details: 'test' };
    const nullResult = null;

    if (validateResult(goodResult, 'test') !== null) {
      return { status: 'ERROR', details: 'validateResult incorrectly rejected valid result' };
    }

    if (validateResult(badResult, 'test') === null) {
      return { status: 'ERROR', details: 'validateResult incorrectly accepted invalid status' };
    }

    if (validateResult(nullResult, 'test') === null) {
      return { status: 'ERROR', details: 'validateResult incorrectly accepted null result' };
    }

    return {
      status: 'OK',
      details: `Discovered ${files.length} files, schema validation working`,
      evidence: [{ type: 'TEST', summary: 'Example discovery and schema contracts passed.', verifiedAt: new Date().toISOString() }],
    };
  }
};
