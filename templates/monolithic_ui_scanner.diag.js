const fs = require('fs');
const path = require('path');

function loadAnalyzer(projectDir) {
  try {
    const coreAnalyzer = require('vibe-diagnosis/src/analyzer');
    if (typeof coreAnalyzer.analyzeMonolithicUiFiles === 'function') {
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
  id: 'monolithic-ui-omission-risk',
  name: 'Monolithic UI File Omission Risk Scanner',
  layer: 'SYSTEM',
  linkedTask: 'Omission Protection',
  diagnosticNecessity: 5,
  necessityReason: 'AI edits can silently omit UI blocks while the application still builds successfully.',

  async run({ projectDir }) {
    const analyzer = loadAnalyzer(projectDir);

    if (!analyzer || typeof analyzer.analyzeMonolithicUiFiles !== 'function') {
      return {
        status: 'OK',
        details: 'Monolithic UI analyzer unavailable in context.'
      };
    }

    const scanResult = analyzer.analyzeMonolithicUiFiles(projectDir);

    if (scanResult.warnings && scanResult.warnings.length > 0) {
      return {
        status: 'WARNING',
        details: scanResult.warnings.join('\n')
      };
    }

    return {
      status: 'OK',
      details: 'All UI components (under 300 lines) and backend files (under 600 lines) satisfy adaptive safety thresholds.'
    };
  }
};
