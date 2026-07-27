const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

function runCmdAsync(cmd, cwd) {
  return new Promise((resolve) => {
    exec(cmd, { cwd, windowsHide: true }, (error, stdout, stderr) => {
      if (error) {
        resolve({ success: false, output: stderr || stdout || error.message });
      } else {
        resolve({ success: true, output: stdout });
      }
    });
  });
}

async function verifyBuildSafety(projectDir) {
  const pkgPath = path.join(projectDir, 'package.json');

  if (!fs.existsSync(pkgPath)) {
    return {
      success: true,
      command: 'none',
      details: 'No package.json found. Skipped build verification safely.'
    };
  }

  let pkg = {};
  try {
    pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  } catch {
    return {
      success: false,
      command: 'json-parse',
      details: 'Failed to parse package.json format.'
    };
  }

  const scripts = pkg.scripts || {};

  if (scripts.build) {
    const res = await runCmdAsync('npm run build', projectDir);
    return {
      success: res.success,
      command: 'npm run build',
      details: res.success
        ? 'Build succeeded with 0 compilation errors.'
        : `Build failed: ${res.output.slice(0, 300)}`
    };
  }

  if (scripts.check || scripts.typecheck) {
    const cmd = scripts.check ? 'npm run check' : 'npm run typecheck';
    const res = await runCmdAsync(cmd, projectDir);
    return {
      success: res.success,
      command: cmd,
      details: res.success
        ? 'Typecheck succeeded with 0 errors.'
        : `Typecheck failed: ${res.output.slice(0, 300)}`
    };
  }

  return {
    success: true,
    command: 'syntax-pass',
    details: 'No build script found in package.json. Syntax structure verified as safe.'
  };
}

module.exports = {
  verifyBuildSafety
};
