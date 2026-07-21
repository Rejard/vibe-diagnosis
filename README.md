# 🩺 vibe-diagnosis

Self-diagnosis and self-healing framework for AI-assisted coding projects. Place lightweight diagnostic scripts (`.diag.js`) alongside your code, run the engine, and visualize qualitative/quantitative QC metrics and TDD timeline graphs in real-time.

## 1.4.0 Safe Repair Workflow

### 1.4.1 patch

Repair validation now clears target-project module cache before each diagnostic, ensuring post-repair checks evaluate changed code rather than stale Node.js imports. The repository also includes a deterministic safe-repair lab that proves regression detection and rollback.

Failed diagnostics can now produce a reviewable repair plan before files are changed. In the dashboard or through MCP, inspect the proposed file changes and diff preview, review the risk level, then explicitly approve application. The repair reruns the full diagnostic suite; AI file changes are rolled back when the target remains unhealthy or a previously healthy diagnostic regresses. Plan creation, approval, validation, regression, and rollback events are retained locally in `.vibe-diagnosis/repair-history.json`.

Use `plan_repair` and `apply_repair_plan` for this approval-based workflow. `repair_diagnostic` and `heal_all` remain available for backwards-compatible automated repair.

### Verify it safely

The repository includes [`examples/safe-repair-lab`](./examples/safe-repair-lab), a disposable project with one deliberate failure and one regression guard. Use it to validate a review-and-approve repair without touching an application project:

```bash
node bin/vibe-diag.js dashboard --cwd examples/safe-repair-lab --port 7721
```

Configure BYOK, run the diagnostics, review **Plan Repair**, and approve it. For a deterministic rollback check, run `node examples/safe-repair-lab/verify-rollback.cjs`.

[한국어 README](./README.ko.md)

> 🚀 **Latest Version: 1.3.3** (Featuring Dashboard Server Shutdown Controls, Automated Full-Folder .gitignore Isolation, and Interactive SVG Telemetry Charts)

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
If there are any failing (FAIL) diagnostics, invoke the AI self-healing (heal_all) tool to analyze and fix the implementation automatically. Once resolved, run the suite again to update the TDD Timeline and Build Success Predictor.
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
- Run run_diagnostics during implementation and at completion phases to mechanically prove that everything operates flawlessly.
- If a diagnostic check fails, prefer `plan_repair` to inspect the proposed change, then use `apply_repair_plan` only after review. `repair_diagnostic` and `heal_all` remain backwards-compatible automated repair options.
- Upon completion, always invoke open_dashboard to verify health status, ensure all tests are green (OK), and present the telemetry summary to the user.
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
| `open_dashboard` | Launches the local dashboard web interface |
| `stop_dashboard` | Shuts down the active dashboard server and frees up port resources |
| `repair_diagnostic` | Runs autonomous AI debugging on a specific failing test |
| `heal_all` | Runs sequential bulk AI self-healing routines across all failed tests |
| `plan_repair` | Creates a reviewable repair plan with risk and diff previews without changing files |
| `apply_repair_plan` | Applies an approved plan, validates all diagnostics, and rolls back failed AI changes |
| `list_incidents` | Reads the local repair plan, validation, regression, and rollback history |
| `read_error_pattern` | Loads known common error resolution knowledge |
| `write_error_pattern` | Documents new recursive error patterns in markdown |

---

## 🤝 License

[Apache License 2.0](./LICENSE)
