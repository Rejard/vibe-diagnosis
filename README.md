# 🩺 vibe-diagnosis

Self-diagnosis and self-healing framework for AI-assisted coding projects. Place lightweight diagnostic scripts (`.diag.js`) alongside your code, run the engine, and visualize qualitative/quantitative QC metrics and TDD timeline graphs in real-time.

[한국어 README](./README.ko.md)

> 🚀 **Latest Version: 1.3.2** (Featuring Interactive Diagnostic Card-Linked Charts with Smooth SVG Transitions)

---

## 🎯 Why Vibe Diagnosis?

**"Equip your Vibe Coding with a razor-sharp safety net and robust telemetry."**

AI agents (Antigravity, Cursor, Windsurf, Claude, etc.) generate code at breakneck speeds, but they are highly susceptible to **overclaiming success** and suffering from **hallucinations** that silently break your builds.

`vibe-diagnosis` enforces a strict TDD (Test-Driven Development) loop: **"Prove that your feature works mechanically by writing a lightweight `.diag.js` script first."** This keeps the speed of vibe coding intact while bulletproofing your codebase against regressions. 

Starting from version 1.3.0, the framework goes beyond pass/fail states to calculate **TDD Bug Resolution Timelines**, **Responsive UI Layout Grades (A+ to F)**, **Asset Offline Independence (GOLD/SILVER Badges)**, and **Unreferenced Code Debt Indices**—visualized as stunning widgets in your local dashboard to validate your engineering achievements.

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
- If a diagnostic check fails, attempt auto-repairing using repair_diagnostic or heal_all tools.
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

## 📊 1.3.2 Next-Gen Telemetry Dashboard

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
   - Prevents backend process duplicate spawning by binding your current repo to an allocated port recorded at `.vibe-diagnosis/active_port.json`. Perfect for working with multiple vibe-coding workspaces simultaneously!

---

## 🛠️ CLI Cheatsheet (One-Line Copy)

```bash
npx -y vibe-diagnosis init                  # 1. Initialize diagnostic workspace & create boilerplate
npx -y vibe-diagnosis run                   # 2. Run all diagnostics and spin up the private web server
npx -y vibe-diagnosis dashboard             # 3. Fire up the dashboard GUI server stand-alone
npx -y vibe-diagnosis heal                  # 4. Trigger bulk AI self-healing repairs for failed tests
```

---

## 📦 Discovered MCP Tools

| Tool Name | Purpose |
|---|---|
| `init_diagnostics` | Sets up directory structure & copies default boilerplate template |
| `list_diagnostics` | Discovers and validates all written `.diag.js` files |
| `run_diagnostics` | Runs all diagnostic checks and records data history |
| `open_dashboard` | Launches the local dashboard web interface |
| `repair_diagnostic` | Runs autonomous AI debugging on a specific failing test |
| `heal_all` | Runs sequential bulk AI self-healing routines across all failed tests |
| `read_error_pattern` | Loads known common error resolution knowledge |
| `write_error_pattern` | Documents new recursive error patterns in markdown |

---

## 🤝 License

[Apache License 2.0](./LICENSE)
