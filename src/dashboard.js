const http = require('http');
const fs = require('fs');
const path = require('path');
const { runDiagnostics, discoverDiagnostics } = require('./runner');
const { validateDiagnosticModule } = require('./schema');
const { getByokConfig, saveByokConfig } = require('./config-manager');
const { repairDiagnostic, createRepairPlan, applyRepairPlan, readAudit } = require('./repairer');
const { listProviders } = require('./ai-provider');
const { runHeuristicMetrics } = require('./analyzer');

const HTML_PATH = path.join(__dirname, 'dashboard.html');

function logSessionHistory(projectDir, passRate, status, cardResults) {
  const historyDir = path.join(projectDir, '.vibe-diagnosis');
  if (!fs.existsSync(historyDir)) {
    fs.mkdirSync(historyDir, { recursive: true });
  }
  const historyFile = path.join(historyDir, 'history.json');
  let history = [];
  if (fs.existsSync(historyFile)) {
    try {
      history = JSON.parse(fs.readFileSync(historyFile, 'utf-8'));
    } catch (err) {
      history = [];
    }
  }
  if (history.length >= 100) {
    history.shift();
  }
  history.push({
    timestamp: new Date().toISOString(),
    passRate: Math.round(passRate * 100),
    status: status,
    cardResults: cardResults || []
  });
  fs.writeFileSync(historyFile, JSON.stringify(history, null, 2), 'utf-8');
}


function listDiagnosticMeta(projectDir) {
  const files = discoverDiagnostics(projectDir);
  const result = [];

  for (const filePath of files) {
    try {
      delete require.cache[require.resolve(filePath)];
      const mod = require(filePath);
      const validation = validateDiagnosticModule(mod, filePath);
      result.push({
        file: path.basename(filePath),
        id: mod.id || path.basename(filePath, '.diag.js'),
        name: mod.name || 'Unknown',
        layer: mod.layer || 'UNKNOWN',
        linkedTask: mod.linkedTask || null,
        valid: validation.valid,
      });
    } catch (err) {
      result.push({
        file: path.basename(filePath),
        id: path.basename(filePath, '.diag.js'),
        name: 'Failed to load',
        layer: 'UNKNOWN',
        valid: false,
      });
    }
  }

  return result;
}

function listErrorPatterns(projectDir) {
  const patternsDir = path.join(projectDir, '.vibe-diagnosis', 'error-patterns');
  if (!fs.existsSync(patternsDir)) return [];
  return fs.readdirSync(patternsDir).filter(f => f.endsWith('.md'));
}

function readErrorPattern(projectDir, filename) {
  const filePath = path.join(projectDir, '.vibe-diagnosis', 'error-patterns', filename);
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, 'utf-8');
}

function sendJson(res, data, status = 200) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(data));
}

function sendText(res, text, status = 200) {
  res.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(text);
}

function sendHtml(res, html) {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(data)); }
      catch { reject(new Error('Invalid JSON body')); }
    });
    req.on('error', reject);
  });
}

function startDashboard(projectDir, port = 7700) {
  let lastRunResults = [];

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === 'OPTIONS') {
      sendJson(res, {});
      return;
    }

    if (req.method === 'GET' && url.pathname === '/') {
      const html = fs.readFileSync(HTML_PATH, 'utf-8');
      sendHtml(res, html);
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/list') {
      const diagnostics = listDiagnosticMeta(projectDir);
      sendJson(res, diagnostics);
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/errors') {
      const errors = listErrorPatterns(projectDir);
      sendJson(res, errors);
      return;
    }

    if (req.method === 'GET' && url.pathname.startsWith('/api/errors/')) {
      const filename = decodeURIComponent(url.pathname.slice('/api/errors/'.length));
      const content = readErrorPattern(projectDir, filename);
      if (content === null) {
        sendText(res, 'Not found', 404);
      } else {
        sendText(res, content);
      }
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/run') {
      try {
        const results = await runDiagnostics(projectDir);
        lastRunResults = results;
        const summary = {
          total: results.length,
          ok: results.filter(r => r.status === 'OK').length,
          warning: results.filter(r => r.status === 'WARNING').length,
          error: results.filter(r => r.status === 'ERROR').length,
        };
        const overallStatus = summary.error > 0 ? 'ERROR' : summary.warning > 0 ? 'WARNING' : 'OK';
        const healthPercent = summary.total > 0 ? Math.round((summary.ok / summary.total) * 100) : 100;
        
        // Log to session history
        const passRate = summary.total > 0 ? summary.ok / summary.total : 1.0;
        const cardResults = results.map(r => ({ id: r.id, status: r.status }));
        logSessionHistory(projectDir, passRate, overallStatus, cardResults);

        sendJson(res, { results, summary, overallStatus, healthPercent });
      } catch (err) {
        sendJson(res, { error: err.message }, 500);
      }
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/history') {
      const historyFile = path.join(projectDir, '.vibe-diagnosis', 'history.json');
      let history = [];
      if (fs.existsSync(historyFile)) {
        try {
          history = JSON.parse(fs.readFileSync(historyFile, 'utf-8'));
        } catch (err) {
          history = [];
        }
      }
      sendJson(res, history);
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/milestones') {
      const dbPath = path.join(projectDir, '.vibe-diagnosis', 'milestones.json');
      let milestones = [];
      if (fs.existsSync(dbPath)) {
        try {
          milestones = JSON.parse(fs.readFileSync(dbPath, 'utf8') || '[]');
        } catch (e) {
          milestones = [];
        }
      }
      sendJson(res, milestones);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/milestones') {
      try {
        const body = await readBody(req);
        const dbPath = path.join(projectDir, '.vibe-diagnosis', 'milestones.json');
        let milestones = [];
        if (fs.existsSync(dbPath)) {
          try {
            milestones = JSON.parse(fs.readFileSync(dbPath, 'utf8') || '[]');
          } catch (e) {
            milestones = [];
          }
        }
        
        const newMilestone = {
          id: 'ms-' + Date.now(),
          timestamp: new Date().toISOString(),
          title: body.title || 'New Milestone',
          redErrors: parseInt(body.redErrors, 10) || 0,
          partialPassRate: parseInt(body.partialPassRate, 10) || 0,
          finalStatus: body.finalStatus || 'OK',
          notes: body.notes || ''
        };

        milestones.unshift(newMilestone);
        fs.writeFileSync(dbPath, JSON.stringify(milestones, null, 2), 'utf8');
        sendJson(res, { success: true, milestone: newMilestone });
      } catch (err) {
        sendJson(res, { error: err.message }, 500);
      }
      return;
    }

    if (req.method === 'DELETE' && url.pathname === '/api/milestones') {
      try {
        const id = url.searchParams.get('id');
        if (!id) {
          sendJson(res, { error: 'id parameter is required' }, 400);
          return;
        }

        const dbPath = path.join(projectDir, '.vibe-diagnosis', 'milestones.json');
        let milestones = [];
        if (fs.existsSync(dbPath)) {
          try {
            milestones = JSON.parse(fs.readFileSync(dbPath, 'utf8') || '[]');
          } catch (e) {
            milestones = [];
          }
        }

        const filtered = milestones.filter(m => m.id !== id);
        fs.writeFileSync(dbPath, JSON.stringify(filtered, null, 2), 'utf8');
        sendJson(res, { success: true });
      } catch (err) {
        sendJson(res, { error: err.message }, 500);
      }
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/metrics') {
      try {
        const list = listDiagnosticMeta(projectDir);
        const total = list.length;
        const passed = lastRunResults.length > 0
          ? lastRunResults.filter(r => r.status === 'OK').length
          : list.filter(d => d.valid).length;

        const metrics = runHeuristicMetrics(projectDir, total, passed);
        sendJson(res, metrics);
      } catch (err) {
        sendJson(res, { error: err.message }, 500);
      }
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/byok/config') {
      const byok = getByokConfig(projectDir, { maskKey: true });
      const providers = listProviders();
      sendJson(res, { byok, providers });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/byok/save') {
      try {
        const body = await readBody(req);
        const { provider, apiKey, model } = body;
        saveByokConfig(projectDir, { provider: provider || '', apiKey: apiKey || '', model: model || '' });
        const byok = getByokConfig(projectDir, { maskKey: true });
        sendJson(res, { success: true, byok });
      } catch (err) {
        sendJson(res, { error: err.message }, 400);
      }
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/repair') {
      try {
        const body = await readBody(req);
        const { diagId } = body;
        if (!diagId) {
          sendJson(res, { error: 'diagId is required' }, 400);
          return;
        }

        const diagResult = lastRunResults.find(r => r.id === diagId);
        if (!diagResult) {
          sendJson(res, { error: `No recent result found for "${diagId}". Run diagnostics first.` }, 404);
          return;
        }

        if (diagResult.status === 'OK') {
          sendJson(res, { error: `Diagnostic "${diagId}" is already OK.` }, 400);
          return;
        }

        const result = await repairDiagnostic(projectDir, diagResult);

        if (result.rerunResult) {
          const idx = lastRunResults.findIndex(r => r.id === diagId);
          if (idx !== -1) lastRunResults[idx] = result.rerunResult;
        }

        sendJson(res, result);
      } catch (err) {
        sendJson(res, { error: err.message }, 500);
      }
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/repair/plan') {
      try {
        const body = await readBody(req);
        const diagId = body.diagId;
        if (!diagId) {
          sendJson(res, { error: 'diagId is required' }, 400);
          return;
        }
        const diagResult = lastRunResults.find(result => result.id === diagId);
        if (!diagResult) {
          sendJson(res, { error: `No recent result found for "${diagId}". Run diagnostics first.` }, 404);
          return;
        }
        if (diagResult.status === 'OK') {
          sendJson(res, { error: `Diagnostic "${diagId}" is already OK.` }, 400);
          return;
        }
        const plan = await createRepairPlan(projectDir, diagResult, lastRunResults);
        sendJson(res, { success: true, plan });
      } catch (err) {
        sendJson(res, { error: err.message }, 500);
      }
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/repair/apply') {
      try {
        const body = await readBody(req);
        if (!body.planId) {
          sendJson(res, { error: 'planId is required' }, 400);
          return;
        }
        const result = await applyRepairPlan(projectDir, body.planId, { approved: body.approved === true });
        if (result.result && result.result.rerunResults) lastRunResults = result.result.rerunResults;
        sendJson(res, { success: result.result.success, repair: result });
      } catch (err) {
        sendJson(res, { error: err.message }, 400);
      }
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/incidents') {
      const incidents = readAudit(projectDir);
      sendJson(res, incidents);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/shutdown') {
      try {
        sendJson(res, { success: true, message: 'Dashboard is shutting down...' });

        const lockFile = path.join(projectDir, '.vibe-diagnosis', 'active_port.json');
        if (fs.existsSync(lockFile)) {
          try {
            fs.unlinkSync(lockFile);
          } catch (e) {
            // Safe ignore
          }
        }

        setTimeout(() => {
          process.exit(0);
        }, 500);
      } catch (err) {
        sendJson(res, { error: err.message }, 500);
      }
      return;
    }

    res.writeHead(404);
    res.end('Not found');
  });

  server.listen(port, () => {
    // 기동 시 포트 락 파일(.vibe-diagnosis/active_port.json) 생성 및 저장
    try {
      const fs = require('fs');
      const lockDir = path.join(projectDir, '.vibe-diagnosis');
      if (fs.existsSync(lockDir)) {
        fs.writeFileSync(path.join(lockDir, 'active_port.json'), JSON.stringify({
          port,
          pid: process.pid,
          timestamp: new Date().toISOString()
        }, null, 2), 'utf8');
      }
    } catch (e) {
      // Safe skip if lock file write fails
    }

    const url = `http://localhost:${port}`;
    console.log(`\n  \x1b[36m🩺 Vibe Diagnosis Dashboard\x1b[0m`);
    console.log(`  \x1b[90m${'─'.repeat(40)}\x1b[0m`);
    console.log(`  Running at: \x1b[32m${url}\x1b[0m`);
    console.log(`  Project:    ${projectDir}`);
    console.log(`  \x1b[90m${'─'.repeat(40)}\x1b[0m`);
    console.log(`  Press \x1b[33mCtrl+C\x1b[0m to stop\n`);

    openBrowser(url);
  });

  return server;
}

function openBrowser(url) {
  const { exec } = require('child_process');
  const cmd = process.platform === 'win32' ? `start "" "${url}"`
    : process.platform === 'darwin' ? `open "${url}"`
    : `xdg-open "${url}"`;
  exec(cmd, { windowsHide: true });
}

module.exports = { startDashboard };
