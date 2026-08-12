# 🩺 vibe-diagnosis

Self-diagnosis and self-healing framework for AI-assisted coding projects. Place lightweight diagnostic scripts (`.diag.js`) alongside your code, run the engine, and visualize qualitative/quantitative QC metrics and TDD timeline graphs in real-time.

[한국어 README](./README.ko.md)

> 🚀 **Latest Version: 1.6.0** (Isolated diagnostics, structured failure evidence, release/live gates, semantic assertions, baselines, safe selection/cache, root-cause grouping, and approval-first repair)

## V1.6 evidence-first diagnostics

- Every diagnostic runs in an isolated Node worker with its own cwd, environment view, module cache, and optional Prisma connection. Runner/timeouts are retried once in a fresh worker and recovery is reported as `FLAKY`.
- Legacy `status: OK | WARNING | ERROR` remains compatible. `classification` adds `CONTRACT_ERROR`, `TEST_FAILURE`, `RUNNER_ERROR`, `TIMEOUT`, and `FLAKY`, while execution records preserve exit code, signal, timeout, stdout, stderr, and all attempts.
- Optional diagnostic metadata supports `severity`, `scope`, `evidenceType`, `blocksRelease`, `blocksLiveTrading`, `confidence`, `lastVerifiedAt`, `tags`, `dependencies`, and input `files`.
- `RELEASE_BLOCKED` and `LIVE_BLOCKED` are independent of health percentage. Static success and missing/stale live evidence can be shown at the same time.
- `run_diagnostics` can select by ID, tag, scope, or severity and can use opt-in cache only for explicitly cacheable `STATIC`/`TEST` checks. Each saved run includes Git and environment fingerprints plus baseline comparisons.
- Repairs always begin with a reviewable plan. Inspect the risk and complete diff preview, then call `apply_repair_plan` with explicit approval. High-risk areas require a separate approval and failed validation or regressions are rolled back.
- Agent integration now requires `complete_task_diagnostics` immediately before a development task is reported complete. It runs the full suite without filters, cache, or dashboard and never edits agent rule files; use `init_diagnostics` or `sync_agent_rules` for explicit rule updates.
- `stop_dashboard` is available through MCP and CLI and uses the project dashboard's local shutdown token instead of terminating an arbitrary recorded PID.
- BYOK API keys are sent only to the selected provider for repair planning. Prefer `VIBE_DIAG_API_KEY`; dashboard-entered keys are stored only in ignored `.vibe-diagnosis/byok.local.json`, never in the shareable config or package.
- Avoid `vibe-diag config set apiKey ...` on shared machines because command arguments can remain in shell history. Use the environment variable or the local dashboard instead.
- The dashboard binds only to `127.0.0.1`. Its API requires the per-process token embedded in the local page and rejects cross-origin requests; error-pattern and project file inputs cannot escape their allowed directories.
- Legacy diagnostics remain runnable, but undeclared release/live gates are reported as `NOT_EVALUATED` and evidence coverage is reported separately from the pass rate.
- The CLI supports Node.js 18 or newer. The MCP package requires Node.js 20 or newer so its patched transport dependencies can be used without known advisory exposure.

---

## 🎯 Why Vibe Diagnosis?

**"Equip your Vibe Coding with a razor-sharp safety net and robust telemetry."**

AI agents (Antigravity, Cursor, Windsurf, Claude, etc.) generate code at breakneck speeds, but they are highly susceptible to **overclaiming success** and suffering from **hallucinations** that silently break your builds.

`vibe-diagnosis` enforces a strict TDD (Test-Driven Development) loop: **"Prove that your feature works mechanically by writing a lightweight `.diag.js` script first."** This keeps the speed of vibe coding intact while bulletproofing your codebase against regressions. 

Starting from version 1.3.0, the framework goes beyond pass/fail states to calculate **TDD Bug Resolution Timelines**, **Responsive UI Layout Grades (A+ to F)**, **Asset Offline Independence (GOLD/SILVER Badges)**, and **Unreferenced Code Debt Indices**—visualized as stunning widgets in your local dashboard to validate your engineering achievements.

---

## 🧮 Live Example (Experience Immediately)

This repository includes a pre-configured calculator project under `examples/calculator` so you can instantly experience Vibe-Diagnosis and visual telemetry. Clone this project and run the command below to see it in action!

```bash
# 1. Clone the repository and install dependencies
git clone https://github.com/Rejard/vibe-diagnosis.git
cd vibe-diagnosis
npm install

# 2. Run the pre-configured calculator example instantly!
npm run test:example
```

---

## 📋 Ready-to-Copy Agent Prompts (Choose ONE Scenario)

> 💡 **Important**: Do not copy all three prompts at once! Select and copy only the **single prompt** below that matches your current development phase.

### 🆕 [Scenario A] Starting a New Feature / Game from Scratch (Enforce TDD)
```text
Initialize Vibe-Diagnosis (init_diagnostics) and write a lightweight `.diag.js` script to mechanically verify the core success criteria for [Feature/Game Name] BEFORE writing any implementation code. Show me the failing (FAIL) test first, then implement the code piece-by-piece, running diagnostics continuously until everything is green. Finally, launch the dashboard (open_dashboard).
```

### 🔍 [Scenario B] Checking if Existing Features still Work (Pre-development Diagnostic)
```text
Run diagnostics (run_diagnostics) first on this project to verify that the existing base-line features are completely green and intact. Show me the dashboard local URL, and then let's proceed to the next development task.
```

### 🔧 [Scenario C] Fixing Failing Diagnostics via MCP (Autonomous AI Healing)
```text
If diagnostics fail, use `plan_repair` or the compatibility `repair_diagnostic` tool to create a plan. Review its risk and diff before separately invoking `apply_repair_plan`; no repair tool applies changes during planning.
```

---

## 🔒 Global Rules Integration for AI Agents

Create a rules config file in your project root corresponding to your AI workspace to force agents to run self-diagnostics autonomously.

* **Antigravity / Gemini**: `.agents/AGENTS.md`
* **Cursor**: `.cursorrules`
* **Windsurf**: `.windsurfrules`

### 📝 Content to copy into your rules file:
```markdown
## Vibe Diagnosis Rules (Self-Diagnosis Guidelines)
- Before writing any feature or fixing a bug, always create/modify a corresponding `.diag.js` file under `.vibe-diagnosis/diagnostics/` to verify requirements (TDD methodology).
- Use `run_diagnostics` during implementation. Immediately before reporting completion, call `complete_task_diagnostics` and require `completion.eligible: true`.
- If a diagnostic fails, create and review a repair plan. Never apply it without explicit approval and separate high-risk approval when required.
- Open the dashboard only when the user requests visual inspection; completion eligibility does not depend on it.
```

---

## 🚀 Get Started in 3 Steps (MCP Setup)

Add this JSON block into your AI agent's MCP configuration panel and restart the application.

```json
{
  "mcpServers": {
    "vibe-diagnosis": {
      "command": "npx",
      "args": ["-y", "vibe-diagnosis-mcp"]
    }
  }
}
```

### 📍 Configuration File Locations

| AI Agent | MCP Settings Path |
|---|---|
| Gemini / Antigravity | Project-level `.gemini/settings.json` or global `~/.gemini/config/mcp_config.json` |
| Claude Desktop | `%APPDATA%/Claude/claude_desktop_config.json` |
| Cursor | `.cursor/mcp.json` |
| Windsurf | `~/.codeium/windsurf/mcp_config.json` |

---

## 📊 1.3.3 Next-Gen Telemetry Dashboard

Open `http://localhost:7700` to find a premium Glassmorphism cockpit summarizing your code health:

1. **📈 TDD Timeline Tracker**:
   - Renders a lightweight, high-fidelity SVG line chart showing pass rate progression from initial RED failures to the final GREEN success.
   - Summarizes the active **TDD Cycle** (total minutes elapsed in fixing the bugs).
   - **Card-Linked Interactive Filter (NEW in v1.3.2)**: Click on any diagnostic card (e.g., `task-001-runner`) to isolate and filter the SVG line chart. It dynamically transitions to draw only that card's specific timeline progression (0% ➔ 50% ➔ 100%), with a beautiful filled gradient. Clicking the active filter badge in the header instantly resets the view to global average metrics.
2. **🛡️ QC & Prevention Scoreboard (Static Code Analysis)**:
   - **Build Success Predictor**: Gauges test coverage and system configuration to predict overall compile safety (%).
   - **UI Layer Integrity**: Parses CSS layouts to compute flex/grid viewport adaptability, awarding grades from **A+ to F**.
   - **Asset Independence**: Scans for hardcoded external URLs and Web Audio synthesis hookups, awarding a **GOLD Badge** for pure offline execution.
   - **Dead-Code Debt Index**: Detects unreferenced local bindings to display code cleanliness metrics.
3. **✍️ TDD Milestone Archive (NEW in v1.3.1)**:
   - Input retrospective notes and initial error/success ratios manually inside a dedicated Glassmorphism input form.
   - Saves records inside your repo at `.vibe-diagnosis/milestones.json` for a beautiful, scrollable engineering chronology!
4. **🔒 Port Lock Cache (NEW in v1.3.1)**:
   - Prevents duplicate backend process spawns by binding your current repo to an allocated port recorded at `.vibe-diagnosis/active_port.json`. Perfect for working with multiple vibe-coding workspaces simultaneously!
5. **🛑 Server Shutdown Controls (NEW in v1.3.3)**:
   - Close the background dashboard server with a single click inside the web interface or via the CLI to instantly free up port 7700 and memory resources.
   - **Automated .gitignore Isolation (NEW in v1.3.3)**: Initializing vibe-diagnosis automatically ignores the entire `.vibe-diagnosis/` folder, ensuring no local tests or temp configs are accidentally uploaded to GitHub.
6. **🚨 Monolithic Component Omission Protection (v1.5.1 Enhanced)**:
   - **Monolithic Adaptive Scanner**: Scans UI files (`*.jsx`, `*.tsx`, `*.vue`) exceeding **300 lines** and Logic/Backend files (`*.js`, `*.ts`, `*.py`) exceeding **600 lines** to emit WARNINGs against accidental block omission during AI rewrites.
   - **Cartridge Integrity Check**: Guarantees required sub-components are not overwritten or dropped.
   - **Symbol Diff Guard (`check_symbol_diff`)**: Tracks lost JSX UI card tags, export symbols, and formula functions before and after AI modifications.
   - **Cartridge Splitter Blueprint (`recommend_cartridge_split`)**: Parses monolithic files to generate modular sub-cartridge component blueprints.
   - **Approval-First Omission Repair (`repair_omission`)**: Creates a restoration plan and diff from `.bak` or Git; it does not alter the target before approval.
7. **🧠 AI-Native Completeness & Session Handover (NEW in v1.5.0)**:
   - **AI Context Sync (`sync_ai_context`)**: Persists current goals and diagnostic state to `.vibe-diagnosis/active_context.json` for seamless handover between AI sessions.
   - **Build Safety Verifier (`verify_build_safety`)**: Runs background compilation (`npm run build`, etc.) to confirm 0 build or syntax errors before finishing tasks.
   - **Agent Rules Injector (`sync_agent_rules`)**: Auto-injects self-testing rules into `.cursorrules`, `AGENTS.md`, and `CLAUDE.md`.

---

## 🛠️ CLI Cheatsheet (One-Line Copy)

```bash
npx -y vibe-diagnosis init                  # 1. Initialize diagnostic workspace & create boilerplate
npx -y vibe-diagnosis run                   # 2. Run all diagnostics and spin up the private web server
npx -y vibe-diagnosis dashboard             # 3. Fire up the dashboard GUI server stand-alone
npx -y vibe-diagnosis stop                  # 4. Stop the active background dashboard server cleanly
npx -y vibe-diagnosis heal                  # 5. Trigger bulk AI self-healing repairs for failed tests
```

---

## 📦 Discovered MCP Tools

| Tool Name | Purpose |
|---|---|
| `init_diagnostics` | Sets up directory structure & copies default boilerplate template |
| `list_diagnostics` | Discovers and validates all written `.diag.js` files |
| `run_diagnostics` | Runs all diagnostic checks and records data history |
| `complete_task_diagnostics` | Mandatory final full-suite, uncached, dashboard-free completion gate |
| `open_dashboard` | Launches the local dashboard web interface |
| `stop_dashboard` | Shuts down the active dashboard server and frees up port resources |
| `repair_diagnostic` | Compatibility tool that creates a reviewable repair plan without applying it |
| `heal_all` | Creates plans for failing diagnostics without applying changes |
| `plan_repair` | Creates a risk-rated plan with file-level diff previews |
| `apply_repair_plan` | Applies an explicitly approved plan, validates the full suite, and rolls back regressions |
| `list_repair_incidents` | Reads local plan, validation, regression, and rollback history |
| `audit_diagnostics` | Reports duplicates, fragile source-string checks, and missing references |
| `read_error_pattern` | Loads known common error resolution knowledge |
| `write_error_pattern` | Documents new recursive error patterns in markdown |
| `check_symbol_diff` | **(v1.5.0)** Tracks lost JSX UI card tags, export symbols, and formula functions after code edits |
| `recommend_cartridge_split` | **(v1.5.0)** Generates modular sub-cartridge splitting blueprints for monolithic UI files |
| `repair_omission` | Creates an approval-required restoration plan from a backup or Git snapshot |
| `sync_ai_context` | **(v1.5.0)** Persists and syncs AI goals and diagnostic state for seamless session handover |
| `verify_build_safety` | **(v1.5.0)** Runs background build/syntax checks to confirm 0 compilation errors |
| `sync_agent_rules` | **(v1.5.0)** Auto-injects self-diagnosis guidelines into AI agent rules files |

---

## 🤝 License

[Apache License 2.0](./LICENSE)

