const { parentPort, workerData } = require('worker_threads');
const { runHeuristicMetrics } = require('./analyzer');

parentPort.postMessage(runHeuristicMetrics(workerData.projectDir, workerData.total, workerData.passed));
