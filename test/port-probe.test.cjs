const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('net');
const { isPortInUse, findFreePort, waitForPortFree } = require('../src/port-probe');

function listenLoopback() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function bindable(port) {
  return new Promise(resolve => {
    const probe = net.createServer();
    probe.once('error', () => resolve(false));
    probe.listen(port, '127.0.0.1', () => probe.close(() => resolve(true)));
  });
}

test('a server bound only to loopback is reported as occupying its port', async t => {
  const server = await listenLoopback();
  t.after(() => new Promise(resolve => server.close(resolve)));
  const port = server.address().port;
  assert.equal(
    await isPortInUse(port),
    true,
    'the dashboard binds 127.0.0.1, so probing 0.0.0.0 would call an occupied port free and spawn a replacement that dies with EADDRINUSE'
  );
});

test('findFreePort returns a port that can actually be bound on loopback', async t => {
  const server = await listenLoopback();
  t.after(() => new Promise(resolve => server.close(resolve)));
  const port = server.address().port;
  const free = await findFreePort(port);
  assert.notEqual(free, port);
  assert.equal(await bindable(free), true);
});

test('waitForPortFree reports the port busy while it is held and free once it closes', async t => {
  const server = await listenLoopback();
  const port = server.address().port;
  assert.equal(await waitForPortFree(port, 200), false);
  await new Promise(resolve => server.close(resolve));
  assert.equal(await waitForPortFree(port, 3000), true);
});
