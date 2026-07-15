const fs = require('fs');
const path = require('path');

module.exports = {
  id: 'v132-interactive-chart-diagnostic',
  name: 'v1.3.2 Interactive Chart Validation',
  layer: 'SYSTEM',
  linkedTask: 'v1.3.2 Diagnostic Card Click-Linked Chart Functionality & Version Sync Verification',
  
  async run({ projectDir }) {
    const errors = [];

    // 1. 버전 일치성 (package.json 싱크) 검증
    try {
      const rootPkg = JSON.parse(fs.readFileSync(path.join(projectDir, 'package.json'), 'utf-8'));
      const mcpPkg = JSON.parse(fs.readFileSync(path.join(projectDir, 'mcp-server/package.json'), 'utf-8'));
      const vsPkg = JSON.parse(fs.readFileSync(path.join(projectDir, 'vscode-extension/package.json'), 'utf-8'));

      if (rootPkg.version !== '1.3.3') {
        errors.push(`Root package.json version is ${rootPkg.version}, expected 1.3.3`);
      }
      if (mcpPkg.version !== '1.3.3') {
        errors.push(`MCP package.json version is ${mcpPkg.version}, expected 1.3.3`);
      }
      if (mcpPkg.dependencies['vibe-diagnosis'] !== '^1.3.3') {
        errors.push(`MCP package.json dependency 'vibe-diagnosis' version is ${mcpPkg.dependencies['vibe-diagnosis']}, expected ^1.3.3`);
      }
      if (vsPkg.version !== '1.3.3') {
        errors.push(`VSCode package.json version is ${vsPkg.version}, expected 1.3.3`);
      }
    } catch (err) {
      errors.push(`Failed to read package.json files: ${err.message}`);
    }

    // 2. 백엔드 dashboard.js 에 cardResults 이력 누적 로직 탑재 검증
    try {
      const dbJsPath = path.join(projectDir, 'src/dashboard.js');
      const content = fs.readFileSync(dbJsPath, 'utf-8');

      if (!content.includes('logSessionHistory(projectDir, passRate, overallStatus, cardResults)')) {
        errors.push('dashboard.js: logSessionHistory is missing cardResults parameter in api/run call');
      }
      if (!content.includes('cardResults: cardResults || []')) {
        errors.push('dashboard.js: logSessionHistory is missing cardResults serialization logic');
      }
    } catch (err) {
      errors.push(`Failed to read dashboard.js: ${err.message}`);
    }

    // 3. 프론트엔드 dashboard.html 마크업 및 JS 렌더러 검증
    try {
      const dbHtmlPath = path.join(projectDir, 'src/dashboard.html');
      const content = fs.readFileSync(dbHtmlPath, 'utf-8');

      if (!content.includes('id="chartTitleCaption"')) {
        errors.push('dashboard.html is missing id="chartTitleCaption" element');
      }
      if (!content.includes('let selectedCardId = null;')) {
        errors.push('dashboard.html is missing selectedCardId state declaration');
      }
      if (!content.includes('function selectDiagnosticCard(')) {
        errors.push('dashboard.html is missing selectDiagnosticCard handler function');
      }
      if (!content.includes('function updateCardsSelection(')) {
        errors.push('dashboard.html is missing updateCardsSelection helper function');
      }
      if (!content.includes('card.selected')) {
        errors.push('dashboard.html is missing .card.selected CSS styling rule');
      }
    } catch (err) {
      errors.push(`Failed to read dashboard.html: ${err.message}`);
    }

    if (errors.length > 0) {
      return {
        status: 'ERROR',
        details: errors.join('; ')
      };
    }

    return {
      status: 'OK',
      details: 'All v1.3.2 Interactive Chart and Version Sync validations passed successfully!'
    };
  }
};
