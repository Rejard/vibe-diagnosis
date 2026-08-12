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

const rawStdoutWrite = process.stdout.write.bind(process.stdout);
process.stdout.write = (chunk, encoding, cb) => {
  const str = typeof chunk === "string" ? chunk : chunk?.toString("utf8") || "";
  if (!str.includes('"jsonrpc"')) {
    return process.stderr.write(chunk, encoding, cb);
  }
  return rawStdoutWrite(chunk, encoding, cb);
};
console.log = (...args) => {
  process.stderr.write(args.map(a => typeof a === "object" ? JSON.stringify(a) : String(a)).join(" ") + "\n");
};
console.info = console.log;
console.warn = (...args) => {
  process.stderr.write("[WARN] " + args.map(a => typeof a === "object" ? JSON.stringify(a) : String(a)).join(" ") + "\n");
};

function loadCore() {
  try {
    return {
      runner: require("vibe-diagnosis/src/runner"),
      schema: require("vibe-diagnosis/src/schema"),
      init: require("vibe-diagnosis/src/init"),
      repairer: require("vibe-diagnosis/src/repairer"),
      dashboard: require("vibe-diagnosis/src/dashboard"),
      dashboardControl: require("vibe-diagnosis/src/dashboard-control"),
      symbolGuard: require("vibe-diagnosis/src/symbol-guard"),
      cartridgeSplitter: require("vibe-diagnosis/src/cartridge-splitter"),
      contextManager: require("vibe-diagnosis/src/context-manager"),
      buildVerifier: require("vibe-diagnosis/src/build-verifier"),
      rulesInjector: require("vibe-diagnosis/src/rules-injector"),
      diagnosticAudit: require("vibe-diagnosis/src/diagnostic-audit"),
      selector: require("vibe-diagnosis/src/selector"),
      pathPolicy: require("vibe-diagnosis/src/path-policy"),
      completionReceipt: require("vibe-diagnosis/src/completion-receipt"),
    };
  } catch {
    return {
      runner: require("../src/runner"),
      schema: require("../src/schema"),
      init: require("../src/init"),
      repairer: require("../src/repairer"),
      dashboard: require("../src/dashboard"),
      dashboardControl: require("../src/dashboard-control"),
      symbolGuard: require("../src/symbol-guard"),
      cartridgeSplitter: require("../src/cartridge-splitter"),
      contextManager: require("../src/context-manager"),
      buildVerifier: require("../src/build-verifier"),
      rulesInjector: require("../src/rules-injector"),
      diagnosticAudit: require("../src/diagnostic-audit"),
      selector: require("../src/selector"),
      pathPolicy: require("../src/path-policy"),
      completionReceipt: require("../src/completion-receipt"),
    };
  }
}

const core = loadCore();
const { runDiagnostics, runDiagnosticsReport, runCompletionDiagnostics, discoverDiagnostics } = core.runner;
const { initialize } = core.init;
const { repairDiagnostic, createRepairPlan, applyRepairPlan, readAudit, autoRevertOrRepairOmission } = core.repairer;

const server = new McpServer({
  name: "vibe-diagnosis",
  version: "1.6.0",
});

const READ_ONLY_TOOLS = new Set(["list_repair_incidents", "audit_diagnostics", "list_diagnostics", "read_error_pattern", "check_symbol_diff", "recommend_cartridge_split", "verify_completion_receipt"]);
const DESTRUCTIVE_TOOLS = new Set(["apply_repair_plan", "init_diagnostics", "write_error_pattern", "stop_dashboard", "sync_ai_context", "sync_agent_rules"]);
const OPEN_WORLD_TOOLS = new Set(["repair_diagnostic", "heal_all", "plan_repair"]);
const registerLegacyTool = server.tool.bind(server);
server.tool = (name, description, schema, handler) => registerLegacyTool(name, description, schema, {
  readOnlyHint: READ_ONLY_TOOLS.has(name),
  destructiveHint: DESTRUCTIVE_TOOLS.has(name),
  idempotentHint: READ_ONLY_TOOLS.has(name),
  openWorldHint: OPEN_WORLD_TOOLS.has(name),
}, handler);

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
      let vibeDiagBin = "vibe-diag";
      try { vibeDiagBin = require.resolve("vibe-diagnosis/bin/vibe-diag.js"); }
      catch {
        try { vibeDiagBin = require.resolve("../bin/vibe-diag.js"); } catch {}
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
  "Run project .diag.js diagnostics. The dashboard is optional and disabled by default. Use complete_task_diagnostics for the mandatory final full-suite check.",
  {
    projectDir: z.string().describe("Absolute path to the project root directory containing .vibe-diagnosis/"),
    autoLaunchDashboard: z.boolean().optional().default(false).describe("Explicitly start and open the optional dashboard"),
    ids: z.array(z.string()).optional().describe("Run only these diagnostic IDs"),
    tags: z.array(z.string()).optional().describe("Run diagnostics matching any tag"),
    scope: z.string().optional().describe("Run diagnostics in one scope"),
    severity: z.string().optional().describe("Run diagnostics at one severity"),
    useCache: z.boolean().optional().default(false).describe("Use opt-in cache only for STATIC/TEST diagnostics"),
    baselineId: z.string().optional().describe("Compare against a specific saved run ID"),
  },
  async ({ projectDir, autoLaunchDashboard, ids, tags, scope, severity, useCache, baselineId }) => {
    try {
      const report = await runDiagnosticsReport(projectDir, { persist: true, useCache, baselineId, filters: { ids, tags, scope, severity } });

      if (autoLaunchDashboard) {
        autoStartDashboardIfNeeded(projectDir, 7700, false).catch(() => {});
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              report,
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
  "Create a reviewable repair plan for a failed diagnostic. This tool never changes project files.",
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
  "Create reviewable repair plans for all failing diagnostics without applying changes.",
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
            text: JSON.stringify({ appliedCount: 0, plannedCount: repairResults.filter(r => r.planId).length, requiresApproval: true, details: repairResults }, null, 2),
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
  "complete_task_diagnostics",
  "MANDATORY final step for development tasks. Run the complete diagnostic suite without cache or dashboard and return a completion eligibility decision.",
  {
    projectDir: z.string().describe("Absolute path to the project root directory containing .vibe-diagnosis/"),
  },
  async ({ projectDir }) => {
    try {
      const report = await runCompletionDiagnostics(projectDir, { persist: true });
      report.agentIntegration = { modified: false, instruction: "Use init_diagnostics or sync_agent_rules to update agent rule files explicitly." };
      return {
        content: [{ type: "text", text: JSON.stringify(report, null, 2) }],
        isError: !report.completion.eligible,
      };
    } catch (err) {
      return { content: [{ type: "text", text: `Completion diagnostics failed: ${err.message}` }], isError: true };
    }
  }
);

server.tool(
  "verify_completion_receipt",
  "Verify that the latest completion receipt is intact and still matches the current workspace state.",
  {
    projectDir: z.string().describe("Absolute path to the project root directory containing .vibe-diagnosis/"),
  },
  async ({ projectDir }) => {
    try {
      const latestPath = path.join(projectDir, ".vibe-diagnosis", "runs", "latest.json");
      if (!fs.existsSync(latestPath)) throw new Error("No saved diagnostic run was found.");
      const latest = JSON.parse(fs.readFileSync(latestPath, "utf8"));
      const verification = core.completionReceipt.verifyCompletionReceipt(projectDir, latest.completion?.receipt);
      return {
        content: [{ type: "text", text: JSON.stringify({ runId: latest.runId, eligible: latest.completion?.eligible === true, ...verification }, null, 2) }],
        isError: !verification.valid || latest.completion?.eligible !== true,
      };
    } catch (err) {
      return { content: [{ type: "text", text: `Completion receipt verification failed: ${err.message}` }], isError: true };
    }
  }
);

server.tool(
  "plan_repair",
  "Create a repair plan with risk classification and diff previews without changing files.",
  {
    projectDir: z.string(),
    diagId: z.string(),
  },
  async ({ projectDir, diagId }) => {
    try {
      const report = await runDiagnosticsReport(projectDir, { persist: false });
      const target = report.results.find(result => result.id === diagId);
      if (!target || target.status === "OK") throw new Error("A failing diagnostic result is required.");
      const plan = await createRepairPlan(projectDir, target, report.results);
      return { content: [{ type: "text", text: JSON.stringify(plan, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: err.message }], isError: true };
    }
  }
);

server.tool(
  "apply_repair_plan",
  "Apply a reviewed repair plan. Explicit approval and separate high-risk approval are enforced.",
  {
    projectDir: z.string(),
    planId: z.string(),
    approved: z.boolean().describe("True only after reviewing the complete plan and diff"),
    approvedChecksum: z.string().length(64).describe("Checksum copied from the reviewed repair plan"),
    approvedHighRisk: z.boolean().optional().default(false).describe("Separate approval for trading, auth, DB, credential, dependency, or runtime changes"),
  },
  async ({ projectDir, planId, approved, approvedChecksum, approvedHighRisk }) => {
    try {
      const result = await applyRepairPlan(projectDir, planId, { approved, approvedChecksum, approvedHighRisk });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: err.message }], isError: true };
    }
  }
);

server.tool(
  "list_repair_incidents",
  "Read local repair plan, approval, validation, regression, and rollback history.",
  { projectDir: z.string() },
  async ({ projectDir }) => ({ content: [{ type: "text", text: JSON.stringify(readAudit(projectDir), null, 2) }] })
);

server.tool(
  "audit_diagnostics",
  "Analyze duplicate IDs/sources, fragile string checks, and missing references without running repairs.",
  { projectDir: z.string() },
  async ({ projectDir }) => {
    try {
      const audit = core.diagnosticAudit.auditDiagnostics(projectDir, discoverDiagnostics(projectDir));
      return { content: [{ type: "text", text: JSON.stringify(audit, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: err.message }], isError: true };
    }
  }
);

server.tool(
  "init_diagnostics",
  "Initialize .vibe-diagnosis/ directory structure in a project. CRITICAL: This tool MUST be called at the very beginning of any development task, before modifying any source code, to establish a quality baseline and create test templates. Trigger: 자가진단 초기화, vibe-diagnosis init",
  {
    projectDir: z.string().describe("Absolute path to the project root directory"),
  },
  async ({ projectDir }) => {
    try {
      const origLog = console.log;
      console.log = () => {};
      let result;
      try { result = initialize(projectDir); } finally { console.log = origLog; }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ projectDir, ...result }, null, 2),
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

      const diagnostics = files.map(filePath => {
        const descriptor = core.selector.inspectDiagnosticSource(filePath);
        return { file: path.basename(filePath), id: descriptor.id, name: descriptor.name, layer: descriptor.layer, linkedTask: descriptor.linkedTask, valid: descriptor.valid, errors: descriptor.errors };
      });

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

      const filePath = core.pathPolicy.resolveWithin(patternsDir, filename, { extension: ".md" });
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

      const filePath = core.pathPolicy.resolveWithin(patternsDir, filename, { extension: ".md" });
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

server.tool(
  "stop_dashboard",
  "Gracefully stop the dashboard associated with this project and release its port lock.",
  { projectDir: z.string().describe("Absolute path to the project root directory") },
  async ({ projectDir }) => {
    try {
      const result = await core.dashboardControl.stopDashboard(projectDir);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Error stopping dashboard: ${err.message}` }], isError: true };
    }
  }
);

server.tool(
  "check_symbol_diff",
  "Analyze loss of JSX UI card tags, export symbols, and formula functions after code modification. Trigger: 심볼 차이 검사, check symbol diff",
  {
    projectDir: z.string().describe("Absolute path to project root"),
    relativeFilePath: z.string().describe("Relative path to target file"),
  },
  async ({ projectDir, relativeFilePath }) => {
    try {
      const result = core.symbolGuard.analyzeSymbolDiff(projectDir, relativeFilePath);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Error checking symbol diff: ${err.message}` }], isError: true };
    }
  }
);

server.tool(
  "recommend_cartridge_split",
  "Generate a modular cartridge splitting blueprint for a monolithic UI component. Trigger: 카트리지 분리 추천, recommend cartridge split",
  {
    projectDir: z.string().describe("Absolute path to project root"),
    relativeFilePath: z.string().describe("Relative path to monolithic UI file"),
  },
  async ({ projectDir, relativeFilePath }) => {
    try {
      const blueprint = core.cartridgeSplitter.generateCartridgeBlueprint(projectDir, relativeFilePath);
      return { content: [{ type: "text", text: JSON.stringify(blueprint, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Error generating blueprint: ${err.message}` }], isError: true };
    }
  }
);

server.tool(
  "repair_omission",
  "Auto-revert or repair lost UI symbols from local backups (.bak) or git snapshot. Trigger: 누락 복구, repair omission",
  {
    projectDir: z.string().describe("Absolute path to project root"),
    relativeFilePath: z.string().describe("Relative path to file with lost symbols"),
  },
  async ({ projectDir, relativeFilePath }) => {
    try {
      const result = await core.repairer.autoRevertOrRepairOmission(projectDir, relativeFilePath);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Error repairing omission: ${err.message}` }], isError: true };
    }
  }
);

server.tool(
  "sync_ai_context",
  "Save or read AI session context and active diagnostic state for seamless agent session handover. Trigger: 컨텍스트 동기화, sync ai context",
  {
    projectDir: z.string().describe("Absolute path to project root"),
    action: z.enum(["read", "save"]).describe("Action to perform: 'read' or 'save'"),
    currentGoal: z.string().optional().describe("Current task goal when saving context"),
    lastTask: z.string().optional().describe("Last completed task name when saving context"),
  },
  async ({ projectDir, action, currentGoal, lastTask }) => {
    try {
      if (action === "read") {
        const ctx = core.contextManager.readAiContext(projectDir);
        return { content: [{ type: "text", text: JSON.stringify(ctx, null, 2) }] };
      } else {
        const saved = core.contextManager.saveAiContext(projectDir, { currentGoal, lastTask });
        return { content: [{ type: "text", text: JSON.stringify(saved, null, 2) }] };
      }
    } catch (err) {
      return { content: [{ type: "text", text: `Error managing context: ${err.message}` }], isError: true };
    }
  }
);

server.tool(
  "verify_build_safety",
  "Run background build and compilation verification to ensure 0 syntax or bundle errors. Trigger: 빌드 자가검증, verify build safety",
  {
    projectDir: z.string().describe("Absolute path to project root"),
  },
  async ({ projectDir }) => {
    try {
      const res = await core.buildVerifier.verifyBuildSafety(projectDir);
      return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Error verifying build: ${err.message}` }], isError: true };
    }
  }
);

server.tool(
  "sync_agent_rules",
  "Inject Vibe Diagnosis self-testing guidelines automatically into AI rule files (.cursorrules, AGENTS.md, etc.). Trigger: 에이전트 규칙 동기화, sync agent rules",
  {
    projectDir: z.string().describe("Absolute path to project root"),
  },
  async ({ projectDir }) => {
    try {
      const res = core.rulesInjector.ensureAgentRules(projectDir);
      return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Error injecting rules: ${err.message}` }], isError: true };
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
