const fs = require('fs');
const path = require('path');

module.exports = {
  id: 'v133-dashboard-shutdown-diagnostic',
  name: 'Vibe Diagnosis Dashboard Shutdown Verification',
  layer: 'SYSTEM',
  linkedTask: 'v133-dashboard-shutdown',
  
  async run(ctx) {
    const projectDir = ctx.projectDir;
    const binFile = path.join(projectDir, 'bin', 'vibe-diag.js');
    if (!fs.existsSync(binFile)) {
      return {
        status: 'ERROR',
        message: 'vibe-diag.js bin file is missing'
      };
    }
    const binContent = fs.readFileSync(binFile, 'utf8');
    if (!binContent.includes("case 'stop':") || !binContent.includes("vibe-diag stop")) {
      return {
        status: 'ERROR',
        message: 'vibe-diag.js does not support "stop" command or help is missing'
      };
    }

    const dbFile = path.join(projectDir, 'src', 'dashboard.js');
    if (!fs.existsSync(dbFile)) {
      return {
        status: 'ERROR',
        message: 'dashboard.js src file is missing'
      };
    }
    const dbContent = fs.readFileSync(dbFile, 'utf8');
    if (!dbContent.includes('/api/shutdown')) {
      return {
        status: 'ERROR',
        message: 'dashboard.js does not have /api/shutdown endpoint definition'
      };
    }

    const htmlFile = path.join(projectDir, 'src', 'dashboard.html');
    if (!fs.existsSync(htmlFile)) {
      return {
        status: 'ERROR',
        message: 'dashboard.html is missing'
      };
    }
    const htmlContent = fs.readFileSync(htmlFile, 'utf8');
    if (!htmlContent.includes('btn-shutdown') || !htmlContent.includes('shutdown-overlay')) {
      return {
        status: 'ERROR',
        message: 'dashboard.html is missing either the btn-shutdown button or shutdown-overlay element'
      };
    }

    return {
      status: 'OK',
      message: 'All v1.3.3 Dashboard Shutdown feature validations passed successfully!'
    };
  }
};
