const net = require('net');

const LOOPBACK_HOST = '127.0.0.1';

function isPortInUse(port, host = LOOPBACK_HOST) {
  return new Promise(resolve => {
    const probe = net.createServer();
    probe.once('error', error => resolve(error.code === 'EADDRINUSE'));
    probe.once('listening', () => {
      probe.close();
      resolve(false);
    });
    probe.listen(port, host);
  });
}

async function findFreePort(startPort, host = LOOPBACK_HOST) {
  let port = startPort;
  while (await isPortInUse(port, host)) port += 1;
  return port;
}

async function waitForPortFree(port, timeoutMs = 3000, host = LOOPBACK_HOST) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!(await isPortInUse(port, host))) return true;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  return !(await isPortInUse(port, host));
}

module.exports = { isPortInUse, findFreePort, waitForPortFree, LOOPBACK_HOST };
