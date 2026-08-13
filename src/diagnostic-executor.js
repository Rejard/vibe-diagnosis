const path = require('path');
const { fork, spawnSync } = require('child_process');
const { normalizeEvidence } = require('./evidence');
const { redactValue } = require('./redaction');

const DEFAULT_TIMEOUT_MS = 120000;
const MAX_OUTPUT_BYTES = 1024 * 1024;

function appendLimited(current, chunk) {
  const next = current + chunk.toString('utf8');
  return next.length > MAX_OUTPUT_BYTES ? next.slice(next.length - MAX_OUTPUT_BYTES) : next;
}

function terminateTree(child) {
  if (!child || child.killed) return;
  if (process.platform === 'win32' && child.pid) {
    try { spawnSync('taskkill', ['/pid', String(child.pid), '/t', '/f'], { windowsHide: true, stdio: 'ignore', timeout: 5000 }); } catch {}
  } else if (child.pid) {
    try { process.kill(-child.pid, 'SIGKILL'); } catch {}
  }
  try { child.kill('SIGKILL'); } catch {}
}

function runAttempt(projectDir, filePath, options = {}) {
  const workerPath = path.join(__dirname, 'diagnostic-worker.js');
  const timeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : DEFAULT_TIMEOUT_MS;
  const startedAt = new Date().toISOString();
  const started = Date.now();
  return new Promise(resolve => {
    let stdout = '';
    let stderr = '';
    let packet = null;
    let metadata = null;
    let timedOut = false;
    let settled = false;
    const child = fork(workerPath, [projectDir, filePath], {
      cwd: projectDir,
      env: { ...process.env, VIBE_DIAG_ISOLATED: '1' },
      silent: true,
      windowsHide: true,
      detached: process.platform !== 'win32',
      execArgv: [],
    });
    child.stdout?.on('data', chunk => { stdout = appendLimited(stdout, chunk); });
    child.stderr?.on('data', chunk => { stderr = appendLimited(stderr, chunk); });
    child.on('message', message => {
      if (message?.type === 'metadata') metadata = message.module;
      if (message?.type === 'result') packet = message;
    });
    const timer = setTimeout(() => {
      timedOut = true;
      terminateTree(child);
    }, timeoutMs);
    child.on('error', error => {
      stderr = appendLimited(stderr, Buffer.from(error.stack || error.message));
    });
    child.on('close', (exitCode, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ packet, metadata, execution: { exitCode, signal, timedOut, timeoutMs, stdout, stderr, startedAt, finishedAt: new Date().toISOString(), duration: Date.now() - started } });
    });
  });
}

function fallbackModule(filePath, packet) {
  const base = path.basename(filePath, '.diag.js');
  return packet?.module || { id: base, name: path.basename(filePath), layer: 'UNKNOWN', linkedTask: null, severity: 'UNSPECIFIED', scope: 'GENERAL', evidenceType: 'UNSPECIFIED', blocksRelease: false, blocksLiveTrading: false, confidence: null, lastVerifiedAt: null, tags: [], dependencies: [], files: [], cache: false, timeoutMs: null };
}

function attemptToResult(filePath, attempt) {
  const mod = attempt.metadata || fallbackModule(filePath, attempt.packet);
  const execution = attempt.execution;
  const base = { ...mod, file: filePath, duration: execution.duration, execution };
  if (execution.timedOut) return { ...base, status: 'ERROR', classification: 'TIMEOUT', details: `Diagnostic timed out after ${execution.timeoutMs}ms`, evidence: [] };
  if (!attempt.packet) return { ...base, status: 'ERROR', classification: 'RUNNER_ERROR', details: `Diagnostic worker exited without a result${execution.exitCode === null ? '' : ` (exit ${execution.exitCode})`}`, evidence: [] };
  if (attempt.packet.kind === 'contract_error') return { ...base, status: 'ERROR', classification: 'CONTRACT_ERROR', details: attempt.packet.error.message, evidence: [] };
  const errorExecution = attempt.packet.error ? { ...execution, childExitCode: attempt.packet.error.exitCode, childSignal: attempt.packet.error.signal, childStdout: attempt.packet.error.stdout, childStderr: attempt.packet.error.stderr } : execution;
  if (attempt.packet.kind === 'runner_error') return { ...base, execution: errorExecution, status: 'ERROR', classification: 'RUNNER_ERROR', details: attempt.packet.error.message, error: attempt.packet.error, evidence: [] };
  if (attempt.packet.kind === 'test_failure') return { ...base, execution: errorExecution, status: 'ERROR', classification: 'TEST_FAILURE', details: attempt.packet.error.message, error: attempt.packet.error, evidence: [] };
  const raw = attempt.packet.result;
  const classification = raw.classification || (raw.status === 'ERROR' ? 'TEST_FAILURE' : null);
  const finishedAt = execution.finishedAt;
  return { ...base, status: raw.status, classification, details: raw.details || '', evidence: normalizeEvidence(raw, mod, finishedAt), data: raw.data || null, lastVerifiedAt: raw.lastVerifiedAt || mod.lastVerifiedAt || finishedAt };
}

async function executeDiagnostic(projectDir, filePath, options = {}) {
  const first = await runAttempt(projectDir, filePath, options);
  const firstResult = attemptToResult(filePath, first);
  const attempts = [{ ...first.execution, classification: firstResult.classification, status: firstResult.status }];
  if (!['RUNNER_ERROR', 'TIMEOUT'].includes(firstResult.classification) || options.retryInfrastructure === false) {
    return redactValue({ ...firstResult, attempts });
  }
  const second = await runAttempt(projectDir, filePath, options);
  const secondResult = attemptToResult(filePath, second);
  attempts.push({ ...second.execution, classification: secondResult.classification, status: secondResult.status });
  if (secondResult.status === 'OK') {
    return redactValue({ ...secondResult, status: 'WARNING', classification: 'FLAKY', details: `Passed on isolated retry after ${firstResult.classification}: ${firstResult.details}`, attempts, firstFailure: firstResult });
  }
  return redactValue({ ...secondResult, attempts, firstFailure: firstResult });
}

module.exports = { executeDiagnostic, runAttempt, DEFAULT_TIMEOUT_MS };
