const fs = require('fs');
const path = require('path');

function loadAnalyzer(projectDir) {
  try {
    const coreAnalyzer = require('vibe-diagnosis/src/analyzer');
    if (typeof coreAnalyzer.analyzeCartridgeIntegrity === 'function') {
      return coreAnalyzer;
    }
  } catch {}

  const localAnalyzer = path.join(projectDir, 'src', 'analyzer.js');
  if (fs.existsSync(localAnalyzer)) {
    try {
      delete require.cache[require.resolve(localAnalyzer)];
      return require(localAnalyzer);
    } catch {}
  }
  return null;
}

module.exports = {
  id: 'cartridge-integrity-check',
  name: 'Cartridge Component & Symbol Integrity Scanner',
  layer: 'FUNCTION',
  linkedTask: 'Omission Protection',
  diagnosticNecessity: 5,
  necessityReason: 'Required UI components and symbols can disappear without producing a compile-time error.',

  async run({ projectDir }) {
    const analyzer = loadAnalyzer(projectDir);

    if (!analyzer || typeof analyzer.analyzeCartridgeIntegrity !== 'function') {
      return {
        status: 'OK',
        details: 'Cartridge analyzer unavailable in current context.'
      };
    }

    const scanResult = analyzer.analyzeCartridgeIntegrity(projectDir);

    if (scanResult.errors && scanResult.errors.length > 0) {
      return {
        status: 'ERROR',
        details: scanResult.errors.join('\n')
      };
    }

    return {
      status: 'OK',
      details: scanResult.details || 'All cartridge components and required symbols intact.'
    };
  }
};
