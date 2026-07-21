const fs = require('fs');
const path = require('path');

module.exports = {
  id: 'v140-safe-repair-workflow',
  name: '1.4.0 Safe Repair Workflow',
  layer: 'SYSTEM',
  linkedTask: 'v1.4.0 safe repair, incident history, and dashboard UX',
  async run({ projectDir }) {
    const repairer = fs.readFileSync(path.join(projectDir, 'src', 'repairer.js'), 'utf8');
    const runner = fs.readFileSync(path.join(projectDir, 'src', 'runner.js'), 'utf8');
    const dashboard = fs.readFileSync(path.join(projectDir, 'src', 'dashboard.js'), 'utf8');
    const html = fs.readFileSync(path.join(projectDir, 'src', 'dashboard.html'), 'utf8');
    const mcp = fs.readFileSync(path.join(projectDir, 'mcp-server', 'index.js'), 'utf8');
    const readme = fs.readFileSync(path.join(projectDir, 'README.md'), 'utf8');
    const koreanReadme = fs.readFileSync(path.join(projectDir, 'README.ko.md'), 'utf8');
    const vscodeReadme = fs.readFileSync(path.join(projectDir, 'vscode-extension', 'README.md'), 'utf8');
    const required = [
      ['repair plan creation', repairer.includes('createRepairPlan')],
      ['approved plan application', repairer.includes('applyRepairPlan')],
      ['repair audit history', repairer.includes('repair-history.json')],
      ['fresh module validation', runner.includes('clearProjectRequireCache')],
      ['repair plan API', dashboard.includes("'/api/repair/plan'")],
      ['repair apply API', dashboard.includes("'/api/repair/apply'")],
      ['incident API', dashboard.includes("'/api/incidents'")],
      ['safe repair dashboard', html.includes('Safe Repair Center')],
      ['incident dashboard', html.includes('Incident History')],
      ['MCP repair planning', mcp.includes('"plan_repair"')],
      ['MCP approved apply', mcp.includes('"apply_repair_plan"')],
      ['English 1.4.0 documentation', readme.includes('1.4.0 Safe Repair Workflow')],
      ['Korean 1.4.0 documentation', koreanReadme.includes('1.4.0 안전 치료 워크플로우')],
      ['VS Code 1.4.0 documentation', vscodeReadme.includes('1.4.0 Safe Repair Workflow')],
    ];
    const missing = required.filter(([, present]) => !present).map(([name]) => name);
    return missing.length
      ? { status: 'ERROR', details: `Missing 1.4.0 capabilities: ${missing.join(', ')}` }
      : { status: 'OK', details: 'Safe repair plans, incident history, and dashboard controls are available.' };
  },
};
