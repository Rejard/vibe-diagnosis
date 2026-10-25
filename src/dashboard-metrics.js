const path = require('path');
const { Worker } = require('worker_threads');

function createMetricsReader(projectDir, options = {}) {
  const jobs = new Map();
  let cached = null;
  let closed = false;
  function read(total, passed) {
    if (closed) return Promise.reject(new Error('Dashboard metrics closed'));
    const key = `${total}:${passed}`;
    if (cached?.key === key && Date.now() < cached.expires) return Promise.resolve(cached.value);
    if (jobs.has(key)) return jobs.get(key).promise;
    if (jobs.size) return Promise.reject(new Error('Dashboard metrics busy; retry shortly'));
    const worker = new Worker(options.workerPath || path.join(__dirname, 'dashboard-metrics-worker.js'), {
      workerData: { projectDir: path.resolve(projectDir), total, passed },
      resourceLimits: { maxOldGenerationSizeMb: 128 },
    });
    let finish;
    const promise = new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => finish(new Error('Dashboard metrics timed out')), options.timeoutMs ?? 10000);
      finish = (error, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        worker.terminate().finally(() => {
          jobs.delete(key);
          if (error) reject(error);
          else {
            cached = { key, value, expires: Date.now() + (options.cacheMs ?? 30000) };
            resolve(value);
          }
        });
      };
      worker.once('message', value => finish(null, value));
      worker.once('error', error => finish(error));
      worker.once('exit', code => { if (!settled) finish(new Error(`Dashboard metrics worker exited (${code})`)); });
    });
    jobs.set(key, { promise, finish });
    return promise;
  }
  read.close = () => {
    closed = true;
    for (const job of jobs.values()) job.finish(new Error('Dashboard metrics closed'));
  };
  return read;
}

module.exports = { createMetricsReader };
