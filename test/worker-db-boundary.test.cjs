const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { fork } = require('node:child_process');
for (const profile of ['RESTRICTED', '', 'STANDARD']) {
  test('automatic database boundary: ' + (profile || 'unset'), { timeout: 10000 }, async t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-db-boundary-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const prisma = path.join(root, 'node_modules/@prisma/client');
    fs.mkdirSync(prisma, { recursive: true });
    fs.writeFileSync(path.join(prisma, 'index.js'), "require('fs').writeFileSync(require('path').join(process.cwd(),'loaded'),'yes');exports.PrismaClient=class{async $disconnect(){}}");
    const diagnostic = path.join(root, 'boundary.diag.js');
    fs.writeFileSync(diagnostic, "module.exports={id:'boundary',name:'boundary',layer:'TASK',run({db}){return {status:'OK',details:db?'database':'no database'}}}");
    const child = fork(path.resolve(__dirname, '../src/diagnostic-worker.js'), [root, diagnostic], { env: { SystemRoot: process.env.SystemRoot, TEMP: os.tmpdir(), VIBE_DIAG_EXECUTION_PROFILE: profile }, stdio: ['ignore','ignore','pipe','ipc'] });
    t.after(() => { if (child.exitCode === null) child.kill(); });
    const messages = [];
    child.on('message', message => messages.push(message));
    await new Promise((resolve, reject) => { child.on('error', reject); child.on('close', code => code === 0 ? resolve() : reject(Error('worker exit '+code))); });
    const result = messages.find(message => message.type === 'result');
    assert.equal(result.kind, 'diagnostic_result');
    assert.equal(result.result.details, profile === 'STANDARD' ? 'database' : 'no database');
    assert.equal(fs.existsSync(path.join(root, 'loaded')), profile === 'STANDARD');
  });
}
