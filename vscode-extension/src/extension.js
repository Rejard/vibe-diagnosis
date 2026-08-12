const vscode = require('vscode');
const { exec } = require('child_process');
const path = require('path');
const http = require('http');

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
  const repairCmd = vscode.commands.registerCommand('vibeDiagnosis.repair', autoRepair);

  context.subscriptions.push(runCmd, runJsonCmd, initCmd, dashCmd, repairCmd, outputChannel, diagnosticCollection, statusBarItem);

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

function runDiagnosticsAsync(workspaceRoot) {
  return new Promise((resolve, reject) => {
    const bin = findVibeDiagBin();
    const isLocalBin = bin.endsWith('.js');
    const cmd = isLocalBin
      ? `node "${bin}" run --json --cwd "${workspaceRoot}"`
      : `npx vibe-diag run --json --cwd "${workspaceRoot}"`;

    exec(cmd, { windowsHide: true, timeout: 30000 }, (error, stdout, stderr) => {
      try {
        resolve(JSON.parse(stdout));
      } catch {
        reject(new Error(stderr || stdout || 'Failed to parse diagnostic output'));
      }
    });
  });
}

function postJson(pathname, bodyValue) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(bodyValue);
    const options = {
      hostname: 'localhost',
      port: 7700,
      path: pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve({ message: data });
          }
        } else {
          reject(new Error(`Repair API returned ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.write(body);
    req.end();
  });
}

function postRepairRequest(diagId) { return postJson('/api/repair/plan', { diagId }); }
function applyRepairRequest(planId, approvedHighRisk) { return postJson('/api/repair/apply', { planId, approved: true, approvedHighRisk }); }

async function autoRepair() {
  const workspaceRoot = getWorkspaceRoot();
  if (!workspaceRoot) {
    vscode.window.showWarningMessage('Vibe Diagnosis: No workspace folder open.');
    return;
  }

  let parsed;
  try {
    parsed = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: 'Vibe Diagnosis: Running diagnostics...' },
      () => runDiagnosticsAsync(workspaceRoot)
    );
  } catch (err) {
    vscode.window.showErrorMessage(`Vibe Diagnosis: Diagnostics failed — ${err.message}`);
    return;
  }

  const failedItems = (parsed.results || []).filter(
    (r) => r.status === 'ERROR' || r.status === 'WARNING'
  );

  if (failedItems.length === 0) {
    vscode.window.showInformationMessage('Vibe Diagnosis: All diagnostics passed. Nothing to repair.');
    renderResults(parsed, workspaceRoot);
    return;
  }

  const statusIcons = { ERROR: '\u274c', WARNING: '\u26a0\ufe0f' };
  const picks = failedItems.map((r) => ({
    label: `${statusIcons[r.status] || ''} ${r.id}`,
    description: r.status,
    detail: r.details,
    diagId: r.id
  }));

  const selected = await vscode.window.showQuickPick(picks, {
    placeHolder: 'Select a diagnostic to auto-repair',
    matchOnDescription: true,
    matchOnDetail: true
  });

  if (!selected) return;

  try {
    const result = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: `Vibe Diagnosis: Planning repair for ${selected.diagId}...`, cancellable: false },
      () => postRepairRequest(selected.diagId)
    );

    if (!result.plan) throw new Error(result.error || 'Dashboard did not return a repair plan.');
    const plan = result.plan;
    const preview = plan.files.map(file => `${file.path}\n${file.diffPreview}`).join('\n\n');
    outputChannel.clear();
    outputChannel.appendLine(`Repair Plan — ${selected.diagId} — ${plan.risk.level} RISK`);
    outputChannel.appendLine('\u2500'.repeat(55));
    outputChannel.appendLine(plan.summary);
    outputChannel.appendLine(preview || '(No file changes proposed)');
    outputChannel.show();
    const choice = await vscode.window.showWarningMessage(`Review the Vibe Diagnosis output. Apply plan ${plan.id}?`, { modal: true }, 'Apply reviewed plan');
    if (choice !== 'Apply reviewed plan') return;
    let approvedHighRisk = false;
    if (plan.risk.requiresHighRiskApproval) {
      const highRiskChoice = await vscode.window.showErrorMessage('HIGH RISK repair: trading, authority, data, credentials, dependencies, or runtime settings may change.', { modal: true }, 'Approve high risk');
      if (highRiskChoice !== 'Approve high risk') return;
      approvedHighRisk = true;
    }
    const applied = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: `Vibe Diagnosis: Applying ${plan.id}...`, cancellable: false },
      () => applyRepairRequest(plan.id, approvedHighRisk)
    );

    outputChannel.clear();
    outputChannel.appendLine(`Auto Repair Result — ${selected.diagId}`);
    outputChannel.appendLine('\u2500'.repeat(55));
    outputChannel.appendLine(JSON.stringify(applied, null, 2));
    outputChannel.show();

    vscode.window.showInformationMessage(applied.success ? `Vibe Diagnosis: Repair validated for ${selected.diagId}` : `Vibe Diagnosis: Repair rolled back for ${selected.diagId}`);
  } catch (err) {
    outputChannel.clear();
    outputChannel.appendLine(`Auto Repair Failed — ${selected.diagId}`);
    outputChannel.appendLine('\u2500'.repeat(55));
    outputChannel.appendLine(err.message || String(err));
    outputChannel.show();

    vscode.window.showErrorMessage(`Vibe Diagnosis: Repair failed — ${err.message}`);
  }
}

function renderResults(parsed, workspaceRoot) {
  const { results, summary, overallStatus, healthPercent } = parsed;

  const statusIcons = { OK: '\u2705', WARNING: '\u26a0\ufe0f', ERROR: '\u274c', RELEASE_BLOCKED: '\u26d4', LIVE_BLOCKED: '\u26d4' };
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
    outputChannel.appendLine(`  ${layer} \u2502 ${id} \u2502 ${icon} ${r.status.padEnd(7)} \u2502 ${r.classification || 'RESULT'} \u2502 ${r.details}`);

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
  if (parsed.gates) outputChannel.appendLine(`  Release: ${parsed.gates.releaseStatus} \u2502 Live: ${parsed.gates.liveTradingStatus} \u2502 Evidence: ${parsed.evidenceSummary?.liveEvidenceStatus || 'UNVERIFIED'}`);
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
