#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createRequire } from "module";
import fs from "fs";
import path from "path";
import net from "net";
import { exec, spawn } from "child_process";

const require = createRequire(import.meta.url);

function loadCore() {
  try {
    return {
      runner: require("vibe-diagnosis/src/runner"),
      schema: require("vibe-diagnosis/src/schema"),
      init: require("vibe-diagnosis/src/init"),
      repairer: require("vibe-diagnosis/src/repairer"),
      dashboard: require("vibe-diagnosis/src/dashboard"),
    };
  } catch {
    return {
      runner: require("../src/runner"),
      schema: require("../src/schema"),
      init: require("../src/init"),
      repairer: require("../src/repairer"),
      dashboard: require("../src/dashboard"),
    };
  }
}

const core = loadCore();
const { runDiagnostics, discoverDiagnostics } = core.runner;
const { validateDiagnosticModule } = core.schema;
const { initialize } = core.init;
const { repairDiagnostic, createRepairPlan, applyRepairPlan, readAudit } = core.repairer;

const server = new McpServer({
  name: "vibe-diagnosis",
  version: "1.4.1",
});

function isPortInUse(port) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once("error", (err) => {
      resolve(err.code === "EADDRINUSE");
    });
    srv.once("listening", () => {
      srv.close();
      resolve(false);
    });
    srv.listen(port);
  });
}

async function findFreePort(startPort) {
  let port = startPort;
  while (await isPortInUse(port)) {
    port++;
  }
  return port;
}

function openBrowser(url) {
  const cmd = process.platform === "win32" ? `start "" "${url}"`
    : process.platform === "darwin" ? `open "${url}"`
    : `xdg-open "${url}"`;
  exec(cmd, { windowsHide: true });
}

async function autoStartDashboardIfNeeded(projectDir, defaultPort = 7700, isExplicitPort = false) {
  const lockPath = path.join(projectDir, ".vibe-diagnosis", "active_port.json");
  let port = defaultPort;
  let shouldSpawn = true;

  if (!isExplicitPort && fs.existsSync(lockPath)) {
    try {
      const lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
      if (lock && lock.port) {
        const inUse = await isPortInUse(lock.port);
        if (inUse) {
          port = lock.port;
          shouldSpawn = false;
        }
      }
    } catch (e) {
      // Safe skip
    }
  }

  if (shouldSpawn) {
    const baseInUse = await isPortInUse(defaultPort);
    port = defaultPort;
    if (baseInUse) {
      port = isExplicitPort ? defaultPort : await findFreePort(defaultPort);
    }

    try {
      const candidates = [
        "C:\\Users\\lemai\\AppData\\Roaming\\npm\\node_modules\\vibe-diagnosis\\bin\\vibe-diag.js",
        "c:\\home\\vibe-diagnosis\\bin\\vibe-diag.js"
      ];

      let vibeDiagBin = null;
      for (const cand of candidates) {
        if (fs.existsSync(cand)) {
          vibeDiagBin = cand;
          break;
        }
      }

      if (!vibeDiagBin) {
        vibeDiagBin = "vibe-diag";
      }

      const isJsFile = vibeDiagBin.endsWith(".js");
      const spawnCmd = isJsFile ? process.execPath : vibeDiagBin;
      const spawnArgs = isJsFile
        ? [vibeDiagBin, "dashboard", "--cwd", projectDir, "--port", String(port)]
        : ["dashboard", "--cwd", projectDir, "--port", String(port)];

      const child = spawn(spawnCmd, spawnArgs, {
        windowsHide: true,
        detached: true,
        stdio: "ignore",
      });
      child.unref();
    } catch (e) {
      // Safe skip if background spawn fails
    }
    // 서버가 기동 완료되어 바인딩될 때까지 최소 안전 시간 대기
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  const url = `http://localhost:${port}`;
  openBrowser(url);
  return port;
}

server.tool(
  "run_diagnostics",
  "Run all .diag.js diagnostics in the project, boot up the dashboard server, and open user's browser. MANDATORY: Run this tool at the end of every development task to verify that everything works properly and all diagnostics pass (OK). Trigger: 자가진단 실행, 진단 돌려줘, run diagnostics",
  {
    projectDir: z.string().describe("Absolute path to the project root directory containing .vibe-diagnosis/"),
    autoLaunchDashboard: z.boolean().optional().default(true).describe("Whether to automatically start the dashboard server and launch browser"),
  },
  async ({ projectDir, autoLaunchDashboard }) => {
    try {
      const results = await runDiagnostics(projectDir);

      const summary = {
        total: results.length,
        ok: results.filter((r) => r.status === "OK").length,
        warning: results.filter((r) => r.status === "WARNING").length,
        error: results.filter((r) => r.status === "ERROR").length,
      };

      const overallStatus =
        summary.error > 0 ? "ERROR" : summary.warning > 0 ? "WARNING" : "OK";

      const healthPercent =
        summary.total > 0 ? Math.round((summary.ok / summary.total) * 100) : 100;

      if (autoLaunchDashboard) {
        autoStartDashboardIfNeeded(projectDir, 7700, false).catch(() => {});
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { results, summary, overallStatus, healthPercent },
              null,
              2
            ),
          },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error running diagnostics: ${err.message}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "repair_diagnostic",
  "Auto-repair a specific failed diagnostic using either local fix/heal business methods or AI BYOK reasoning. Trigger: 자가치유 실행, repair diagnostic",
  {
    projectDir: z.string().describe("Absolute path to the project root directory"),
    diagId: z.string().describe("Diagnostic ID to repair (e.g. wallet-transaction-integrity)"),
  },
  async ({ projectDir, diagId }) => {
    try {
      const results = await runDiagnostics(projectDir);
      const target = results.find((r) => r.id === diagId);

      if (!target) {
        return {
          content: [{ type: "text", text: `Diagnostic "${diagId}" not found in current project.` }],
          isError: true,
        };
      }

      if (target.status === "OK") {
        return {
          content: [{ type: "text", text: `Diagnostic "${diagId}" is already healthy and OK.` }],
        };
      }

      const repairResult = await repairDiagnostic(projectDir, target);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(repairResult, null, 2),
          },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error repairing diagnostic "${diagId}": ${err.message}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "heal_all",
  "Auto-repair and self-heal all failing diagnostics in the project automatically in sequence. Trigger: 자가치유 전수 실행, heal all failing diagnostics",
  {
    projectDir: z.string().describe("Absolute path to the project root directory"),
  },
  async ({ projectDir }) => {
    try {
      const results = await runDiagnostics(projectDir);
      const failing = results.filter((r) => r.status === "ERROR" || r.status === "WARNING");

      if (failing.length === 0) {
        return {
          content: [{ type: "text", text: "All diagnostics are healthy. Nothing to heal." }],
        };
      }

      const repairResults = [];
      for (const target of failing) {
        const repairResult = await repairDiagnostic(projectDir, target);
        repairResults.push({
          id: target.id,
          success: repairResult.success,
          summary: repairResult.summary,
          error: repairResult.error,
          rerunResult: repairResult.rerunResult,
        });
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ healedCount: repairResults.filter(r => r.success).length, details: repairResults }, null, 2),
          },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error healing all diagnostics: ${err.message}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "plan_repair",
  "Create a reviewable repair plan for one failed diagnostic. Returns root-cause context, risk level, changed files, and diff previews without modifying project files.",
  {
    projectDir: z.string().describe("Absolute path to the project root directory"),
    diagId: z.string().describe("Failed diagnostic ID to analyze"),
  },
  async ({ projectDir, diagId }) => {
    try {
      const results = await runDiagnostics(projectDir);
      const target = results.find(result => result.id === diagId);
      if (!target) throw new Error(`Diagnostic "${diagId}" not found.`);
      if (target.status === "OK") throw new Error(`Diagnostic "${diagId}" is already healthy.`);
      const plan = await createRepairPlan(projectDir, target, results);
      return { content: [{ type: "text", text: JSON.stringify(plan, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Error creating repair plan: ${err.message}` }], isError: true };
    }
  }
);

server.tool(
  "apply_repair_plan",
  "Apply an explicitly reviewed repair plan, rerun all diagnostics, detect regressions, and roll back AI file changes when validation fails.",
  {
    projectDir: z.string().describe("Absolute path to the project root directory"),
    planId: z.string().describe("Repair plan ID returned by plan_repair"),
    approved: z.boolean().describe("Set true only after reviewing the risk and diff"),
  },
  async ({ projectDir, planId, approved }) => {
    try {
      const result = await applyRepairPlan(projectDir, planId, { approved });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Error applying repair plan: ${err.message}` }], isError: true };
    }
  }
);

server.tool(
  "list_incidents",
  "Read the local repair incident history, including plans, approvals, validation results, regressions, and rollbacks.",
  { projectDir: z.string().describe("Absolute path to the project root directory") },
  async ({ projectDir }) => ({ content: [{ type: "text", text: JSON.stringify(readAudit(projectDir), null, 2) }] })
);

server.tool(
  "init_diagnostics",
  "Initialize .vibe-diagnosis/ directory structure in a project. CRITICAL: This tool MUST be called at the very beginning of any development task, before modifying any source code, to establish a quality baseline and create test templates. Trigger: 자가진단 초기화, vibe-diagnosis init",
  {
    projectDir: z.string().describe("Absolute path to the project root directory"),
  },
  async ({ projectDir }) => {
    try {
      const diagRoot = path.join(projectDir, ".vibe-diagnosis");

      if (fs.existsSync(diagRoot)) {
        return {
          content: [{ type: "text", text: `.vibe-diagnosis/ already exists in ${projectDir}` }],
        };
      }

      const origLog = console.log;
      console.log = () => {};
      try { initialize(projectDir); } finally { console.log = origLog; }

      return {
        content: [
          {
            type: "text",
            text: `Initialized .vibe-diagnosis/ in ${projectDir}`,
          },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error initializing: ${err.message}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "list_diagnostics",
  "List all diagnostic files (.diag.js) in the project with their metadata. CRITICAL: Call this tool at the start of any development task to understand the existing validations and what needs to be checked.",
  {
    projectDir: z.string().describe("Absolute path to the project root directory"),
  },
  async ({ projectDir }) => {
    try {
      const files = discoverDiagnostics(projectDir);

      if (files.length === 0) {
        return {
          content: [{ type: "text", text: "No .diag.js files found in .vibe-diagnosis/diagnostics/" }],
        };
      }

      const diagnostics = [];
      for (const filePath of files) {
        try {
          let mod;
          try {
            delete require.cache[require.resolve(filePath)];
            mod = require(filePath);
          } catch (err) {
            const fileUrl = require("url").pathToFileURL(filePath).href;
            const esmMod = await import(fileUrl);
            mod = esmMod.default || esmMod;
          }
          const validation = validateDiagnosticModule(mod, filePath);
          diagnostics.push({
            file: path.basename(filePath),
            id: mod.id || path.basename(filePath, ".diag.js"),
            name: mod.name || "Unknown",
            layer: mod.layer || "UNKNOWN",
            linkedTask: mod.linkedTask || null,
            valid: validation.valid,
            errors: validation.errors,
          });
        } catch (err) {
          diagnostics.push({
            file: path.basename(filePath),
            id: path.basename(filePath, ".diag.js"),
            name: "Failed to load",
            layer: "UNKNOWN",
            valid: false,
            errors: [err.message],
          });
        }
      }

      return {
        content: [{ type: "text", text: JSON.stringify(diagnostics, null, 2) }],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error listing diagnostics: ${err.message}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "read_error_pattern",
  "Read an error pattern log file from .vibe-diagnosis/error-patterns/",
  {
    projectDir: z.string().describe("Absolute path to the project root directory"),
    filename: z
      .string()
      .optional()
      .describe("Specific error pattern filename. If omitted, lists all available patterns"),
  },
  async ({ projectDir, filename }) => {
    try {
      const patternsDir = path.join(projectDir, ".vibe-diagnosis", "error-patterns");

      if (!fs.existsSync(patternsDir)) {
        return {
          content: [{ type: "text", text: "No error-patterns/ directory found" }],
        };
      }

      if (!filename) {
        const files = fs.readdirSync(patternsDir).filter((f) => f.endsWith(".md"));
        return {
          content: [
            {
              type: "text",
              text:
                files.length > 0
                  ? `Available error patterns:\n${files.map((f) => `- ${f}`).join("\n")}`
                  : "No error pattern files found",
            },
          ],
        };
      }

      const filePath = path.join(patternsDir, filename);
      if (!fs.existsSync(filePath)) {
        return {
          content: [{ type: "text", text: `Error pattern not found: ${filename}` }],
          isError: true,
        };
      }

      const content = fs.readFileSync(filePath, "utf-8");
      return { content: [{ type: "text", text: content }] };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error reading pattern: ${err.message}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "write_error_pattern",
  "Create or update an error pattern log in .vibe-diagnosis/error-patterns/",
  {
    projectDir: z.string().describe("Absolute path to the project root directory"),
    filename: z.string().describe("Error pattern filename (e.g. ERR_002_null_reference.md)"),
    content: z.string().describe("Markdown content for the error pattern log"),
  },
  async ({ projectDir, filename, content }) => {
    try {
      const patternsDir = path.join(projectDir, ".vibe-diagnosis", "error-patterns");
      fs.mkdirSync(patternsDir, { recursive: true });

      const filePath = path.join(patternsDir, filename);
      const existed = fs.existsSync(filePath);
      fs.writeFileSync(filePath, content, "utf-8");

      return {
        content: [{ type: "text", text: `${existed ? "Updated" : "Created"} error pattern: ${filename}` }],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error writing pattern: ${err.message}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "open_dashboard",
  "Open the Vibe Diagnosis web dashboard in the browser. Trigger: 대시보드 열어줘, dashboard",
  {
    projectDir: z.string().describe("Absolute path to the project root directory"),
    port: z.number().optional().describe("Port number (default: 7700)"),
  },
  async ({ projectDir, port }) => {
    try {
      const isExplicit = typeof port === "number";
      const defaultPort = port || 7700;
      const actualPort = await autoStartDashboardIfNeeded(projectDir, defaultPort, isExplicit);

      return {
        content: [
          {
            type: "text",
            text: `Dashboard opened at http://localhost:${actualPort}\nProject: ${projectDir}`,
          },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error opening dashboard: ${err.message}` }],
        isError: true,
      };
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
