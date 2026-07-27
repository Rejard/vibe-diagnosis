const fs = require('fs');
const path = require('path');

module.exports = {
  id: 'omission-protection-feature',
  name: 'Omission Protection & Monolithic File Scanner Verification',
  layer: 'SYSTEM',
  linkedTask: 'Omission Protection',

  async run({ projectDir }) {
    const analyzerPath = path.join(projectDir, 'src', 'analyzer.js');
    if (!fs.existsSync(analyzerPath)) {
      return { status: 'ERROR', details: 'src/analyzer.js not found' };
    }

    delete require.cache[require.resolve(analyzerPath)];
    const analyzer = require(analyzerPath);

    if (typeof analyzer.analyzeMonolithicUiFiles !== 'function') {
      return { status: 'ERROR', details: 'analyzeMonolithicUiFiles function is missing in src/analyzer.js' };
    }

    if (typeof analyzer.analyzeCartridgeIntegrity !== 'function') {
      return { status: 'ERROR', details: 'analyzeCartridgeIntegrity function is missing in src/analyzer.js' };
    }

    const requiredTemplates = [
      'PATTERN_UI_BLOCK_OMISSION.md',
      'monolithic_ui_scanner.diag.js',
      'cartridge_integrity_template.diag.js'
    ];

    for (const tmpl of requiredTemplates) {
      const tmplPath = path.join(projectDir, 'templates', tmpl);
      if (!fs.existsSync(tmplPath)) {
        return { status: 'ERROR', details: `Template file missing: templates/${tmpl}` };
      }
    }

    const testDir = path.join(projectDir, '.vibe-diagnosis', 'scratch_test_omission');
    try {
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
      }
      fs.mkdirSync(testDir, { recursive: true });

      const lines = [];
      for (let i = 1; i <= 350; i++) {
        lines.push(`// line ${i}`);
      }
      lines.push('<Card title="Card 1" />');
      lines.push('<Card title="Card 2" />');
      lines.push('<Card title="Card 3" />');
      lines.push('<Card title="Card 4" />');
      fs.writeFileSync(path.join(testDir, 'BigTestComponent.jsx'), lines.join('\n'), 'utf-8');

      const monoScan = analyzer.analyzeMonolithicUiFiles(testDir);
      if (!monoScan.warnings || monoScan.warnings.length === 0) {
        return { status: 'ERROR', details: 'analyzeMonolithicUiFiles failed to detect 350-line UI file (threshold 300)' };
      }

      if (!monoScan.warnings[0].includes('BigTestComponent.jsx')) {
        return { status: 'ERROR', details: 'Warning message does not contain file name' };
      }
    } finally {
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
      }
    }

    return {
      status: 'OK',
      details: 'All Omission Protection functions, templates, and scanner heuristics verified successfully.'
    };
  }
};
