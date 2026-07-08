const vscode = require('vscode');
const { exec } = require('child_process');
const path = require('path');

let statusBarItem;
let outputChannel;
let diagnosticCollection;

function activate(context) {
  outputChannel = vscode.window.createOutputChannel('Vibe Diagnosis');
  diagnosticCollection = vscode.languages.createDiagnosticCollection('vibe-diagnosis');
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBarItem.command = 'vibeDiagnosis.run';
  statusBarItem.text = '$(heart) Vibe Diag';
  statusBarItem.tooltip = 'Run Vibe Diagnosis';
  statusBarItem.show();

  const runCmd = vscode.commands.registerCommand('vibeDiagnosis.run', () => runDiagnostics(false));
  const runJsonCmd = vscode.commands.registerCommand('vibeDiagnosis.runJson', () => runDiagnostics(true));
  const initCmd = vscode.commands.registerCommand('vibeDiagnosis.init', initDiagnostics);
  const dashCmd = vscode.commands.registerCommand('vibeDiagnosis.dashboard', openDashboard);

  context.subscriptions.push(runCmd, runJsonCmd, initCmd, dashCmd, outputChannel, diagnosticCollection, statusBarItem);

  const workspaceRoot = getWorkspaceRoot();
  if (workspaceRoot) {
    const fs = require('fs');
    const diagDir = path.join(workspaceRoot, '.vibe-diagnosis');
    if (fs.existsSync(diagDir)) {
      runDiagnostics(false);
    }
  }
}

function deactivate() {
  if (statusBarItem) statusBarItem.dispose();
  if (outputChannel) outputChannel.dispose();
  if (diagnosticCollection) diagnosticCollection.dispose();
}

function getWorkspaceRoot() {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) return null;
  return folders[0].uri.fsPath;
}

function findVibeDiagBin() {
  try {
    const mainPkg = require('../../package.json');
    if (mainPkg && mainPkg.name === 'vibe-diagnosis') {
      return path.resolve(__dirname, '..', '..', 'bin', 'vibe-diag.js');
    }
  } catch {}
  return 'npx vibe-diag';
}

function runDiagnostics(jsonMode) {
  const workspaceRoot = getWorkspaceRoot();
  if (!workspaceRoot) {
    vscode.window.showWarningMessage('Vibe Diagnosis: No workspace folder open.');
    return;
  }

  const bin = findVibeDiagBin();
  const isLocalBin = bin.endsWith('.js');
  const cmd = isLocalBin
    ? `node "${bin}" run --json --cwd "${workspaceRoot}"`
    : `npx vibe-diag run --json --cwd "${workspaceRoot}"`;

  statusBarItem.text = '$(sync~spin) Diagnosing...';

  exec(cmd, { windowsHide: true, timeout: 30000 }, (error, stdout, stderr) => {
    let parsed;
    try {
      parsed = JSON.parse(stdout);
    } catch {
      outputChannel.clear();
      outputChannel.appendLine('Failed to parse diagnostic output:');
      outputChannel.appendLine(stdout || '(empty)');
      if (stderr) outputChannel.appendLine(stderr);
      outputChannel.show();
      statusBarItem.text = '$(error) Vibe Diag';
      return;
    }

    diagnosticCollection.clear();
    outputChannel.clear();

    if (jsonMode) {
      outputChannel.appendLine(JSON.stringify(parsed, null, 2));
      outputChannel.show();
    }

    renderResults(parsed, workspaceRoot);
  });
}

function renderResults(parsed, workspaceRoot) {
  const { results, summary, overallStatus, healthPercent } = parsed;

  const statusIcons = { OK: '\u2705', WARNING: '\u26a0\ufe0f', ERROR: '\u274c' };
  const layerLabels = { TASK: 'TASK', FUNCTION: 'FUNC', SYSTEM: 'SYS ' };

  outputChannel.appendLine('');
  outputChannel.appendLine('  Vibe Diagnosis Results');
  outputChannel.appendLine('  ' + '\u2500'.repeat(55));
  outputChannel.appendLine('');

  const vsDiagnostics = [];

  for (const r of results) {
    const layer = layerLabels[r.layer] || '??? ';
    const icon = statusIcons[r.status] || '\u274c';
    const id = r.id.padEnd(28);
    outputChannel.appendLine(`  ${layer} \u2502 ${id} \u2502 ${icon} ${r.status.padEnd(7)} \u2502 ${r.details}`);

    if (r.status === 'ERROR' || r.status === 'WARNING') {
      const severity = r.status === 'ERROR'
        ? vscode.DiagnosticSeverity.Error
        : vscode.DiagnosticSeverity.Warning;

      const diag = new vscode.Diagnostic(
        new vscode.Range(0, 0, 0, 0),
        `[${r.layer}] ${r.name}: ${r.details}`,
        severity
      );
      diag.source = 'Vibe Diagnosis';
      diag.code = r.id;
      vsDiagnostics.push(diag);
    }
  }

  outputChannel.appendLine('');
  outputChannel.appendLine('  ' + '\u2500'.repeat(55));
  outputChannel.appendLine(`  Total: ${summary.total} \u2502 OK: ${summary.ok} \u2502 WARN: ${summary.warning} \u2502 ERR: ${summary.error}`);
  outputChannel.appendLine(`  Overall: ${statusIcons[overallStatus]} ${overallStatus} \u2014 Health ${healthPercent}%`);
  outputChannel.appendLine('');
  outputChannel.show();

  if (vsDiagnostics.length > 0) {
    const configUri = vscode.Uri.file(path.join(workspaceRoot, '.vibe-diagnosis', 'config.json'));
    diagnosticCollection.set(configUri, vsDiagnostics);
  }

  if (overallStatus === 'OK') {
    statusBarItem.text = `$(check) Health ${healthPercent}%`;
    statusBarItem.backgroundColor = undefined;
  } else if (overallStatus === 'WARNING') {
    statusBarItem.text = `$(warning) Health ${healthPercent}%`;
    statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
  } else {
    statusBarItem.text = `$(error) Health ${healthPercent}%`;
    statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
  }
}

function initDiagnostics() {
  const workspaceRoot = getWorkspaceRoot();
  if (!workspaceRoot) {
    vscode.window.showWarningMessage('Vibe Diagnosis: No workspace folder open.');
    return;
  }

  const bin = findVibeDiagBin();
  const isLocalBin = bin.endsWith('.js');
  const cmd = isLocalBin
    ? `node "${bin}" init`
    : `npx vibe-diag init`;

  exec(cmd, { cwd: workspaceRoot, windowsHide: true, timeout: 15000 }, (error, stdout, stderr) => {
    outputChannel.clear();
    outputChannel.appendLine(stdout || '');
    if (stderr) outputChannel.appendLine(stderr);
    outputChannel.show();

    if (!error) {
      vscode.window.showInformationMessage('Vibe Diagnosis: Initialized .vibe-diagnosis/ successfully!');
    } else {
      vscode.window.showErrorMessage('Vibe Diagnosis: Init failed. Check output for details.');
    }
  });
}

function openDashboard() {
  const workspaceRoot = getWorkspaceRoot();
  if (!workspaceRoot) {
    vscode.window.showWarningMessage('Vibe Diagnosis: No workspace folder open.');
    return;
  }

  const bin = findVibeDiagBin();
  const isLocalBin = bin.endsWith('.js');
  const cmd = isLocalBin
    ? `node "${bin}" dashboard --cwd "${workspaceRoot}"`
    : `npx vibe-diag dashboard --cwd "${workspaceRoot}"`;

  exec(cmd, { windowsHide: true, timeout: 5000 }, () => {});
  vscode.window.showInformationMessage('Vibe Diagnosis: Dashboard opened at http://localhost:7700');
}

module.exports = { activate, deactivate };
