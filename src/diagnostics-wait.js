const { performance } = require('perf_hooks');
const { acquireDiagnosticsLock, ERROR_CODE } = require('./diagnostics-lock');

function waitError(code, conflict) {
  const error = new Error(code === 'DIAGNOSTICS_WAIT_CANCELLED'
    ? 'Cancelled while waiting. The existing diagnostic execution was not interrupted.'
    : 'Timed out waiting. The existing diagnostic execution was not interrupted.');
  error.code = code;
  error.conflict = conflict?.toJSON();
  return error;
}

function pause(ms, signal) {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
    };
    const finish = () => {
      cleanup();
      resolve();
    };
    const abort = () => {
      cleanup();
      reject(waitError('DIAGNOSTICS_WAIT_CANCELLED'));
    };
    const timer = setTimeout(finish, ms);
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
  });
}

async function acquireWithWait(projectDir, options = {}) {
  const waitTimeoutMs = options.waitTimeoutMs ?? 0;
  if (!Number.isInteger(waitTimeoutMs) || waitTimeoutMs < 0 || waitTimeoutMs > 120000) {
    throw new Error('waitTimeoutMs must be an integer between 0 and 120000.');
  }
  const deadline = performance.now() + waitTimeoutMs;
  let conflict;
  for (;;) {
    if (options.signal?.aborted) throw waitError('DIAGNOSTICS_WAIT_CANCELLED', conflict);
    if (conflict && performance.now() >= deadline) throw waitError('DIAGNOSTICS_WAIT_TIMEOUT', conflict);
    try {
      return acquireDiagnosticsLock(projectDir, options);
    } catch (error) {
      if (error.code !== ERROR_CODE || waitTimeoutMs === 0) throw error;
      conflict = error;
    }
    await pause(Math.min(100, Math.max(1, deadline - performance.now())), options.signal);
  }
}

module.exports = { acquireWithWait };
