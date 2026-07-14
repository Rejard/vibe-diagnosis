# 🩺 vibe-diagnosis

A lightweight, agent-driven self-diagnosis and self-healing framework for AI-assisted development (Vibe Coding). Establish quality constraints, prevent regressions, and visualize failures via a beautiful local dashboard.

[한국어 README](./README.ko.md)

> Current Version: **1.2.7** (Major Quality Overhaul Release)

---

## 🎯 Why vibe-diagnosis?

**"Never code with your AI agent without a safety net."**

While AI coding assistants (Cursor, Windsurf, Gemini/Antigravity, etc.) generate code at lightning speed, they are structurally prone to **overclaiming** ("Everything works flawlessly!") and **hallucinations**.

`vibe-diagnosis` brings the absolute rigor of **Test-Driven Development (TDD)** to your AI-assisted sessions. It forces the coding agent to **"prove that your code works through a mechanical `.diag.js` script first, before declaring success."** This guarantees absolute codebase integrity, prevents regressions, and maintains high-speed developer momentum safely.

---

## 📋 Copy-Paste Prompt Templates for AI Agents

Keep your coding agent on a tight quality leash. Copy and paste one of these instructions to set up the ideal TDD-style workflow.

### Scenario A. 🆕 Initiating a New Project or Feature (Strict TDD)
> "We are implementing a new [feature/app name]. Before writing any feature code, initialize Vibe Diagnosis (`init_diagnostics`), write relevant `.diag.js` validation scripts verifying our core requirements, and run them to confirm they fail (FAIL) first. Only then, implement the feature code step-by-step and run diagnostics frequently to guide your development."

### Scenario B. 🔄 Joining or Continuing an Existing Project
> "Please run the self-diagnostics tool (`run_diagnostics`) first. We need to verify the existing baseline and ensure all previously implemented features are healthy and green (OK) before we write any new code."

### Scenario C. 💥 Resolving Code Failures & Self-Healing
> "Use the self-healing tools (`heal_all` or `repair_diagnostic`) to automatically analyze and fix the currently failing diagnostics. Once repaired, rerun the diagnostics suite and open the dashboard."

---

## 🔒 Auto-Enforcing Rules for Top 3 AI Tools

To make this completely hands-off, you can create a rule configuration file inside your project root. When major AI agents scan your workspace, they will automatically read this guidelines file and obey the TDD self-diagnosis workflow without you having to repeat yourself.

Simply create one of these files in your workspace root:
* **Antigravity / Gemini**: `.agents/AGENTS.md`
* **Cursor**: `.cursorrules`
* **Windsurf**: `.windsurfrules`

### 📝 Content to Copy into Rules:
```markdown
## Vibe Diagnosis Rules (Self-Diagnosis Guidelines)
- Whenever implementing or modifying features, you MUST create or update relevant `.diag.js` validation files in the `.vibe-diagnosis/diagnostics/` folder BEFORE writing any production code (TDD-style).
- Run `run_diagnostics` frequently during mid-steps and final steps to verify overall codebase integrity.
- If a diagnostic fails (FAIL), use `repair_diagnostic` or `heal_all` to automatically self-heal and resolve issues.
- When done, call `open_dashboard` to boot up the browser dashboard and verify everything is 100% healthy (OK) before submitting the final walkthrough.
```

---

## 🚀 Get Started in 3 Steps

If you are using an AI agent with MCP support, this is the easiest route:

1. Add the following to your AI tool's MCP configuration settings:

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

2. Restart your AI tool or reload the MCP servers.

3. Copy and send the following message to your coding agent:

   ```bash
   Set up Vibe Diagnosis for this project. Initialize the folder, add relevant checks for our tasks, and run the self-diagnosis once done.
   ```

No global installation is required; `npx` will fetch and run the MCP packages on-demand.

### MCP Configuration Locations

| AI Tool | Configuration File |
|---|---|
| Gemini / Antigravity | `.gemini/settings.json` (Project) or `~/.gemini/config/mcp_config.json` (Global) |
| Claude Desktop | Windows: `%APPDATA%/Claude/claude_desktop_config.json` |
| Cursor | `.cursor/mcp.json` |
| Windsurf | `~/.codeium/windsurf/mcp_config.json` |

---

## 📊 Dashboard Guide

The dashboard is a local, private web server running on your machine. If the MCP client fails to start the dashboard automatically, you can always run it directly from your terminal inside the project root:

```bash
npx -y vibe-diagnosis dashboard --cwd <project-path>
```

If you want the agent to handle the dashboard initialization, ask:

```bash
Please run the self-diagnostics. Call `open_dashboard` to start the local dashboard, confirm it's healthy, and give me the localhost address.
```

---

## 🛠️ CLI Reference

Use these commands inside your local shell or CI/CD pipelines:

```bash
npx -y vibe-diagnosis init                  # Creates .vibe-diagnosis/ workspace
npx -y vibe-diagnosis run                   # Runs all checks & boots up dashboard
npx -y vibe-diagnosis run --json            # Formatted JSON output for CI pipelines
npx -y vibe-diagnosis dashboard             # Runs standalone dashboard server
npx -y vibe-diagnosis repair <diagnosticId> # Repairs a single failed check
npx -y vibe-diagnosis repair --all          # Repairs all failed checks
npx -y vibe-diagnosis heal                  # Triggers entire automatic self-healing routines
```

---

## 📁 Diagnostic File(`.diag.js`) Format

Executing `init` generates sample validation scripts inside `.vibe-diagnosis/diagnostics/`. Customize them to fit your business requirements:

```js
module.exports = {
  id: 'homepage-loads',
  name: 'Verify Homepage Load Status',
  layer: 'TASK', // Choose from: TASK, FUNCTION, SYSTEM

  async run() {
    const homepageLoads = true; // Replace with actual test logic (e.g. fetch/axios calls)

    return homepageLoads
      ? { status: 'OK', details: 'Homepage loads successfully.' }
      : { status: 'ERROR', details: 'Homepage is unresponsive.' };
  },
};
```

* **Attributes**: Every diagnostic module must have unique `id`, human-readable `name`, execution `layer`, and an async `run()` function.
* **Return Values**: `run()` must return `{ status: 'OK' | 'WARNING' | 'ERROR', details: string }`.

---

## 🤖 AI Self-Healing (BYOK)

Launch the local dashboard, navigate to settings, and securely register your AI Provider, API Key, and Model parameters to activate automatic repair routines (BYOK). 

Keys are stored locally and encrypted inside `.vibe-diagnosis/config.json` (auto-appended to `.gitignore` during `init`).

Alternatively, pass them directly via environment variables:

```bash
VIBE_DIAG_PROVIDER=openai
VIBE_DIAG_API_KEY=your-key
VIBE_DIAG_MODEL=gpt-4o
```

---

## 📦 MCP Tools Directory

| Tool | Purpose |
|---|---|
| `init_diagnostics` | Creates the workspace folder and sample templates (MUST execute at task startup). |
| `list_diagnostics` | Lists all active `.diag.js` files with their statuses (MUST execute before coding). |
| `run_diagnostics` | Executes all checks and automatically integrates the dashboard (MUST execute before final delivery). |
| `open_dashboard` | Spawns the local dashboard background server and launches the default browser. |
| `repair_diagnostic` | Runs targeted AI BYOK repair reasoning for a specific failing diagnostic. |
| `heal_all` | Sequentially attempts to self-heal and repair all failing diagnostics in the workspace. |
| `read_error_pattern` | Reads specific recurring error pattern knowledge. |
| `write_error_pattern` | Creates or saves a newly discovered error pattern log. |

---

## 🤝 License

[Apache License 2.0](./LICENSE)
