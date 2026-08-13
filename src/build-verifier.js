const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { redactString } = require('./redaction');

function runNpmAsync(args, cwd) {
  return new Promise((resolve) => {
    const command = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    execFile(command, args, { cwd, windowsHide: true, timeout: 120000, maxBuffer: 2 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        resolve({ success: false, output: redactString(stderr || stdout || error.message), timedOut: error.killed === true || error.code === 'ETIMEDOUT' });
      } else {
        resolve({ success: true, output: redactString(stdout), timedOut: false });
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
    const res = await runNpmAsync(['run', 'build'], projectDir);
    return {
      success: res.success,
      command: 'npm run build',
      details: res.success
        ? 'Build succeeded with 0 compilation errors.'
        : `Build failed${res.timedOut ? ' or timed out' : ''}: ${res.output.slice(0, 300)}`
    };
  }

  if (scripts.check || scripts.typecheck) {
    const script = scripts.check ? 'check' : 'typecheck';
    const cmd = `npm run ${script}`;
    const res = await runNpmAsync(['run', script], projectDir);
    return {
      success: res.success,
      command: cmd,
      details: res.success
        ? 'Typecheck succeeded with 0 errors.'
        : `Typecheck failed: ${res.output.slice(0, 300)}`
    };
  }

  return {
    success: null,
    skipped: true,
    command: 'none',
    status: 'NOT_EVALUATED',
    details: 'No build, check, or typecheck script was found. Build safety was not evaluated.'
  };
}

module.exports = {
  verifyBuildSafety
};
