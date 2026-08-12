const fs = require('fs');
const path = require('path');

module.exports = {
  id: 'ai-native-completeness-feature',
  name: 'AI-Native Completeness & Session Handover Verification',
  layer: 'SYSTEM',
  linkedTask: 'AI-Native Completeness',
  severity: 'HIGH',
  scope: 'RELEASE',
  evidenceType: 'TEST',
  blocksRelease: true,
  confidence: 1,
  tags: ['agent', 'completion'],
  files: ['src/context-manager.js', 'src/build-verifier.js', 'src/rules-injector.js', 'src/completion-receipt.js'],

  async run({ projectDir }) {
    const ctxPath = path.join(projectDir, 'src', 'context-manager.js');
    if (!fs.existsSync(ctxPath)) {
      return { status: 'ERROR', details: 'src/context-manager.js missing' };
    }
    delete require.cache[require.resolve(ctxPath)];
    const ctxManager = require(ctxPath);
    if (typeof ctxManager.saveAiContext !== 'function' || typeof ctxManager.readAiContext !== 'function') {
      return { status: 'ERROR', details: 'saveAiContext or readAiContext missing in src/context-manager.js' };
    }

    const buildPath = path.join(projectDir, 'src', 'build-verifier.js');
    if (!fs.existsSync(buildPath)) {
      return { status: 'ERROR', details: 'src/build-verifier.js missing' };
    }
    delete require.cache[require.resolve(buildPath)];
    const buildVerifier = require(buildPath);
    if (typeof buildVerifier.verifyBuildSafety !== 'function') {
      return { status: 'ERROR', details: 'verifyBuildSafety missing in src/build-verifier.js' };
    }

    const rulesPath = path.join(projectDir, 'src', 'rules-injector.js');
    if (!fs.existsSync(rulesPath)) {
      return { status: 'ERROR', details: 'src/rules-injector.js missing' };
    }
    delete require.cache[require.resolve(rulesPath)];
    const rulesInjector = require(rulesPath);
    if (typeof rulesInjector.ensureAgentRules !== 'function') {
      return { status: 'ERROR', details: 'ensureAgentRules missing in src/rules-injector.js' };
    }

    const testDir = path.join(projectDir, '.vibe-diagnosis', 'scratch_test_ainative');
    try {
      if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true });
      fs.mkdirSync(testDir, { recursive: true });

      const saved = ctxManager.saveAiContext(testDir, { currentGoal: 'Test Session Handover', lastTask: 'TDD' });
      if (!saved || !saved.saved) {
        return { status: 'ERROR', details: 'saveAiContext failed to save active_context.json' };
      }

      const read = ctxManager.readAiContext(testDir);
      if (!read || read.currentGoal !== 'Test Session Handover') {
        return { status: 'ERROR', details: 'readAiContext failed to read correct active_context.json' };
      }

      const injected = rulesInjector.ensureAgentRules(testDir);
      if (!injected || !injected.updatedFiles || injected.updatedFiles.length === 0) {
        return { status: 'ERROR', details: 'ensureAgentRules failed to inject agent rules' };
      }

      const buildRes = await buildVerifier.verifyBuildSafety(testDir);
      if (typeof buildRes.success !== 'boolean') {
        return { status: 'ERROR', details: 'verifyBuildSafety return format invalid' };
      }
    } finally {
      if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true });
    }

    return {
      status: 'OK',
      details: 'All 3 AI-Native completeness & session handover modules verified successfully.',
      evidence: [{ type: 'TEST', summary: 'Context, build verifier, and agent rule fixtures passed.', verifiedAt: new Date().toISOString() }]
    };
  }
};
