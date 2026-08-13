const fs = require('fs');
const os = require('os');
const path = require('path');
const { discoverDiagnostics } = require('../src/runner');
const { selectDiagnostics } = require('../src/selector');
const { auditDiagnostics } = require('../src/diagnostic-audit');

function measure(operation) {
  const started = process.hrtime.bigint();
  const value = operation();
  return { value, durationMs: Number(process.hrtime.bigint() - started) / 1e6 };
}

function fixture(count) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `vibe-scale-${count}-`));
  const dir = path.join(root, '.vibe-diagnosis', 'diagnostics');
  fs.mkdirSync(dir, { recursive: true });
  for (let index = 0; index < count; index += 1) {
    const id = `synthetic-${String(index).padStart(4, '0')}`;
    const dependency = index > 0 && index % 50 === 0 ? `,dependencies:['synthetic-${String(index - 1).padStart(4, '0')}']` : '';
    fs.writeFileSync(path.join(dir, `${id}.diag.js`), `module.exports={id:'${id}',name:'Synthetic ${index}',layer:'TASK',severity:'LOW',scope:'GENERAL',evidenceType:'STATIC',tags:['synthetic']${dependency},async run(){return {status:'OK'}}};\n`);
  }
  return root;
}

const results = [];
for (const count of [100, 500, 1000]) {
  const root = fixture(count);
  try {
    const discovered = measure(() => discoverDiagnostics(root));
    const selected = measure(() => selectDiagnostics(discovered.value, { tags: ['synthetic'] }));
    const audited = measure(() => auditDiagnostics(root, discovered.value));
    results.push({
      count,
      discovered: discovered.value.length,
      selected: selected.value.length,
      auditTotals: audited.value.totals,
      durationMs: {
        discover: Number(discovered.durationMs.toFixed(2)),
        select: Number(selected.durationMs.toFixed(2)),
        audit: Number(audited.durationMs.toFixed(2)),
      },
    });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

const valid = results.every(item => item.discovered === item.count && item.selected === item.count && item.auditTotals.missingReferences === 0 && item.auditTotals.missingDependencies === 0);
process.stdout.write(JSON.stringify({ valid, fixture: 'synthetic-temporary', results }, null, 2) + '\n');
if (!valid) process.exitCode = 1;
