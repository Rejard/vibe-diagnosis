const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'dashboard.html'), 'utf8');

class FakeElement {
  constructor() {
    this.textContent = '';
    this.innerHTML = '';
    this.value = '';
    this.style = {};
    this.className = '';
    this.disabled = false;
    this.classList = { add() {}, remove() {} };
  }
  addEventListener() {}
  appendChild() {}
  setAttribute() {}
  focus() {}
  scrollIntoView() {}
  querySelector() { return null; }
  querySelectorAll() { return []; }
}

function makeDashboardContext({ diagnostics = [], report = null } = {}) {
  const elements = new Map();
  const getElement = id => {
    if (!elements.has(id)) elements.set(id, new FakeElement());
    return elements.get(id);
  };
  const packageVersion = require('../package.json').version;
  const responses = {
    '/api/list': diagnostics,
    '/api/report': report || { results: [], skippedDiagnostics: [] },
    '/api/health': { service: 'vibe-diagnosis-dashboard', version: packageVersion, apiVersion: 2 },
  };
  const context = {
    Response,
    URL,
    URLSearchParams,
    console,
    encodeURIComponent,
    decodeURIComponent,
    setTimeout,
    clearTimeout,
    document: {
      getElementById: getElement,
      querySelectorAll: () => [],
      createElementNS: () => new FakeElement(),
    },
    window: {
      location: { host: '127.0.0.1:7700' },
      confirm: () => false,
      prompt: () => null,
      close() {},
    },
    fetch: async input => {
      const pathname = new URL(String(input), 'http://127.0.0.1:7700').pathname;
      const body = Object.hasOwn(responses, pathname) ? responses[pathname] : {};
      return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
    },
  };
  vm.createContext(context);
  const servedHtml = html.replace('__VIBE_DASHBOARD_TOKEN__', JSON.stringify('test-token'));
  const script = servedHtml.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script, 'dashboard inline script should exist');
  new vm.Script(script.replace(/\ninit\(\);\n/, '\n')).runInContext(context);
  return { context, getElement };
}

test('dashboard has one escapeHtml implementation and safely renders every details value type', () => {
  assert.equal((html.match(/function escapeHtml\s*\(/g) || []).length, 1);
  const { context } = makeDashboardContext();
  const rendered = vm.runInContext(`[
    escapeHtml('plain <text>'),
    escapeHtml(42),
    escapeHtml(true),
    escapeHtml(null),
    escapeHtml([1, 'two']),
    escapeHtml({ ready: true })
  ]`, context);
  assert.equal(rendered[0], 'plain &lt;text&gt;');
  assert.equal(rendered[1], '42');
  assert.equal(rendered[2], 'true');
  assert.equal(rendered[3], 'null');
  assert.match(rendered[4], /\[\s*1,/);
  assert.match(rendered[5], /&quot;ready&quot;: true/);

  vm.runInContext('const circularDetails = {}; circularDetails.self = circularDetails;', context);
  assert.match(vm.runInContext('escapeHtml(circularDetails)', context), /\[Circular\]/);
  context.unreadableDetails = new Proxy({}, { ownKeys() { throw new Error('unreadable'); }, get() { throw new Error('unreadable'); } });
  assert.doesNotThrow(() => vm.runInContext('escapeHtml(unreadableDetails)', context));
});

test('object details restore all 238 executed cards, one disabled card, timing, and slow sorting', async () => {
  const diagnostics = [];
  const results = [];
  const values = ['plain', { ready: true }, 42, false, null, [1, 'two']];
  for (let index = 0; index < 238; index += 1) {
    const id = `diag-${String(index).padStart(3, '0')}`;
    diagnostics.push({ id, name: id, layer: 'TASK', diagnosticState: 'ENABLED', diagnosticNecessity: 4 });
    results.push({ id, status: index < 223 ? 'OK' : index === 223 ? 'WARNING' : 'ERROR', details: values[index % values.length], durationMs: index + 10 });
  }
  diagnostics.push({ id: 'disabled-one', name: 'Disabled', layer: 'TASK', diagnosticState: 'DISABLED', stateReason: 'intentional hold', diagnosticNecessity: 2 });
  const report = {
    discovered: 239,
    durationMs: 36700,
    results,
    skippedDiagnostics: [{ id: 'disabled-one', state: 'DISABLED', skipReason: 'DISABLED', reason: 'intentional hold', executionState: 'NOT_EXECUTED', durationMs: null }],
    summary: { total: 238, ok: 223, warning: 1, error: 14 },
    healthPercent: 93.7,
    gates: { releaseStatus: 'BLOCKED', liveTradingStatus: 'NOT_EVALUATED' },
  };
  const { context, getElement } = makeDashboardContext({ diagnostics, report });
  await vm.runInContext('loadDashboardState()', context);
  const cards = getElement('cardsContainer').innerHTML;
  assert.equal((cards.match(/<div class="card status-/g) || []).length, 239);
  assert.doesNotMatch(cards, /Not yet tested/);
  assert.match(cards, /&quot;ready&quot;: true/);
  assert.match(cards, /DISABLED: 실행하지 않음/);
  assert.match(cards, /실행 안 함/);
  assert.match(cards, /card-duration">10ms/);
  assert.equal(getElement('statTotal').textContent, '238 / 239');
  assert.equal(getElement('totalDuration').textContent, '37초');
  assert.doesNotThrow(() => vm.runInContext("setDiagnosticSort('slowest')", context));
});

test('one unreadable card cannot abort the remaining executed result cards', () => {
  const { context } = makeDashboardContext();
  context.badDiagnostic = new Proxy({}, { get() { throw new Error('bad diagnostic'); } });
  context.recordedResult = { id: 'recorded', status: 'ERROR', details: { ready: false }, durationMs: 842 };
  const card = vm.runInContext('renderDiagnosticCard(badDiagnostic, recordedResult)', context);
  assert.match(card, /card-render-fallback/);
  assert.match(card, /842ms/);
  assert.doesNotMatch(card, /Not yet tested/);
});

test('legacy timing gaps and every policy exclusion stay distinct from untested checks', async () => {
  const diagnostics = [
    { id: 'legacy-result', name: 'Legacy', layer: 'TASK', diagnosticState: 'ENABLED' },
    { id: 'skip-once', name: 'Skip', layer: 'TASK', diagnosticState: 'ENABLED' },
    { id: 'snoozed', name: 'Snoozed', layer: 'TASK', diagnosticState: 'SNOOZED', stateReason: 'maintenance' },
    { id: 'optional', name: 'Optional', layer: 'TASK', diagnosticState: 'ENABLED' },
    { id: 'never-run', name: 'Never', layer: 'TASK', diagnosticState: 'ENABLED' },
  ];
  const report = {
    discovered: 5,
    results: [{ id: 'legacy-result', status: 'OK', details: { legacy: true } }],
    skippedDiagnostics: [
      { id: 'skip-once', state: 'SKIP_ONCE', skipReason: 'SKIP_ONCE', reason: 'one run only' },
      { id: 'snoozed', state: 'SNOOZED', skipReason: 'SNOOZED', reason: 'maintenance' },
      { id: 'optional', state: 'ENABLED', skipReason: 'OPTIONAL_NOT_SCHEDULED', reason: 'policy excluded' },
    ],
    summary: { total: 1, ok: 1, warning: 0, error: 0 },
  };
  const { context, getElement } = makeDashboardContext({ diagnostics, report });
  await vm.runInContext('loadDashboardState()', context);
  const cards = getElement('cardsContainer').innerHTML;
  assert.match(cards, /legacy-result[\s\S]*시간 정보 없음/);
  assert.match(cards, /SKIP_ONCE: 실행하지 않음/);
  assert.match(cards, /SNOOZED: 실행하지 않음/);
  assert.match(cards, /ENABLED: 실행하지 않음 \(OPTIONAL_NOT_SCHEDULED\) - policy excluded/);
  assert.equal((cards.match(/Not yet tested/g) || []).length, 1);
});
