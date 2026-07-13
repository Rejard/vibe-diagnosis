# 🩺 vibe-diagnosis

**Self-diagnosis framework for vibe coding projects**

When coding with AI agents, prove that your project works — with code.

> **Core Principle — Task ↔ Diagnostic 1:1 Mapping**: Every completed task must have a corresponding diagnostic that verifies it works correctly.

[한국어 README](./README.ko.md)

---

## 🚀 Quick Start (MCP — Easiest)

The fastest way to use vibe-diagnosis is through **MCP** (Model Context Protocol). Just add the config to your AI tool and start coding.

> [!IMPORTANT]
> **Required agent workflow for dashboard work**
>
> Before starting any dashboard UI, dashboard API, dashboard data, or dashboard bug-fix task, the agent **must call `open_dashboard` first**. This starts the Vibe Diagnosis web dashboard server on `http://localhost:7700` (or the next available local port) and opens it in the browser. Installing the MCP server alone does **not** start this web server.
>
> First inspect the available checks with `list_diagnostics`. If the current diagnostic list does not cover the dashboard task, the agent **must add a relevant `.diag.js` diagnostic** under `.vibe-diagnosis/diagnostics/` and use it to verify the work. After every completed task, the agent must run `run_diagnostics` and address failures before declaring the work complete.

### Copy-and-paste dashboard workflow

Use these requests in order when asking an AI agent to work on a dashboard:

1. `Open the Vibe Diagnosis dashboard for this project before starting dashboard work.`
   - Expected tool: `open_dashboard` → starts the local dashboard server at `http://localhost:7700` (or the next free port).
2. `List the current diagnostics and identify which checks cover this dashboard task.`
   - Expected tool: `list_diagnostics`.
3. `If no diagnostic covers this task, add a relevant .diag.js diagnostic and use it to verify the dashboard change.`
   - Expected result: a new check in `.vibe-diagnosis/diagnostics/`.
4. `Complete the dashboard task, run the full self-diagnosis, and fix any failed diagnostics before reporting completion.`
   - Expected tool: `run_diagnostics` → verifies the project and keeps the dashboard available.

### 🤖 AI Agent Quick Installation & Update

If you are using AI coding assistants (such as Cursor, Windsurf, or Claude Desktop), you can ask your AI agent to automatically configure or update the MCP server for you.

#### For New Users (First-time setup)
Just say this to your AI agent:
> "Install the `vibe-diagnosis-mcp` package globally, register it as an MCP server, and strictly follow these rules for this project: 1) Before starting any dashboard UI, dashboard API, dashboard data, or dashboard bug-fix task, always call `open_dashboard` to start the Vibe Diagnosis web dashboard server and open it in the browser. 2) Before work, inspect checks with `list_diagnostics`; if the task is not covered, create a relevant `.diag.js` file in `.vibe-diagnosis/diagnostics/` and use it for verification. 3) Run `run_diagnostics` after every completed task to verify correctness. 4) If any diagnostics fail, immediately use the repair tool or local `fix/heal` methods to restore the health score to 100%."

#### For Existing Users (Update to latest v1.2.1)
If you already have `vibe-diagnosis-mcp` installed and want to update to the latest version to enjoy offline hybrid repairs and automated background dashboards, just say this to your AI agent:
> "Force-update the `vibe-diagnosis-mcp` package to the latest version (v1.2.1) and reload the MCP settings."

### 1. Add MCP config

Add the following JSON block to your AI tool's config file:

| AI Tool | Config File Path |
|---|---|
| **Gemini** (Antigravity 2.0) | `.gemini/settings.json` (project) or `~/.gemini/config/mcp_config.json` (global) |
| **Claude Desktop** | `%APPDATA%/Claude/claude_desktop_config.json` (Win) · `~/Library/Application Support/Claude/claude_desktop_config.json` (Mac) |
| **Cursor** | `.cursor/mcp.json` |
| **Windsurf** | `~/.codeium/windsurf/mcp_config.json` |

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

### 2. Tell your AI agent

> "Apply vibe-diagnosis to this project"

Done. The AI will initialize diagnostics, generate `.diag.js` files, and open the dashboard automatically.

---

## 💬 Quick Triggers

Once MCP is installed, just talk to your AI:

### English

| Say this | What happens |
|---|---|
| "Apply vibe-diagnosis to this project" | `init_diagnostics` → setup + generate diagnostics + dashboard |
| "Run diagnostics" | `run_diagnostics` → run all checks |
| "Open diagnosis dashboard" | `open_dashboard` → browser dashboard |
| "Write error pattern" | `write_error_pattern` → log error pattern |

### 한국어

| 말하기 | 실행 결과 |
|---|---|
| "자가진단 MCP 적용해줘" | `init_diagnostics` → 초기화 + 진단 생성 + 대시보드 |
| "자가진단 실행해줘" | `run_diagnostics` → 전체 진단 실행 |
| "대시보드 열어줘" | `open_dashboard` → 브라우저 대시보드 |
| "진단 돌려줘" | `run_diagnostics` → 결과 요약 |

### Example Workflow

```
You: "Apply vibe-diagnosis to this project"
 AI: → init_diagnostics          ← .vibe-diagnosis/ created
 AI: → generates .diag.js files  ← diagnostics for existing code
 AI: → open_dashboard            ← browser opens http://localhost:7700
 AI: → run_diagnostics           ← Health 100% ✅
```

---

## 📦 CLI

Install globally or use via npx:

```bash
npx vibe-diag init                        # Initialize .vibe-diagnosis/ + auto-configure MCP
npx vibe-diag run                         # Run all diagnostics
npx vibe-diag run --json                  # JSON output (for CI/CD)
npx vibe-diag dashboard                   # Open web dashboard
npx vibe-diag config get                  # Show BYOK configuration
npx vibe-diag config set provider openai  # Set AI provider
npx vibe-diag config set apiKey sk-...    # Set API key
npx vibe-diag config set model gpt-4o     # Set model name
npx vibe-diag repair <diagId>             # Auto-repair a specific diagnostic
npx vibe-diag repair --all                # Auto-repair all failing diagnostics
```

### Writing a diagnostic

Create `.diag.js` files in `.vibe-diagnosis/diagnostics/`:

```js
module.exports = {
  id: 'task-001-user-login',
  name: 'User Login Flow',
  layer: 'TASK',              // TASK | FUNCTION | SYSTEM
  linkedTask: 'TASK-001',

  async run(ctx) {
    const auth = require('../src/auth');
    const result = auth.login('test@test.com', 'password123');

    if (!result.token) {
      return { status: 'ERROR', details: 'Login did not return token' };
    }
    return { status: 'OK', details: 'Login flow verified' };
  }
};
```

### Output example

```
  Vibe Diagnosis v1.2.1 — my-project
  ─────────────────────────────────────────

  TASK │ task-001-user-login       │ ✅ OK      │ Login flow verified
  FUNC │ func-auth-token           │ ✅ OK      │ JWT validation passed
  SYS  │ sys-database              │ ⚠️ WARNING │ Connection pool at 80%

  ─────────────────────────────────────────
  Total: 3 nodes │ OK: 2 │ WARN: 1 │ ERR: 0
  Overall: ⚠️ WARNING — Health 67%
```

---

## 🖥️ Web Dashboard

```bash
npx vibe-diag dashboard            # http://localhost:7700
npx vibe-diag dashboard --port 8080
```

Features:
- Health ring gauge with percentage
- Diagnostic cards grid (color-coded by layer)
- One-click "Run Diagnostics" button
- Error pattern viewer with modal
- Dark mode premium UI
- BYOK configuration bar (Provider / API Key / Model)
- Auto Repair button on ERROR and WARNING cards
- AI status indicator (connected / disconnected)

---

## 🤖 BYOK Auto Repair

**Bring Your Own Key** — connect your own AI provider to automatically analyze and fix failing diagnostics, right from the dashboard.

No vendor lock-in. Your API key stays on your machine and is never sent anywhere except the provider you choose.

### Supported Providers

| Provider | Model examples |
|---|---|
| **OpenAI** | `gpt-4o`, `gpt-4o-mini` |
| **Anthropic** | `claude-sonnet-4-20250514`, `claude-3-5-haiku-20241022` |
| **Google Gemini** | `gemini-2.5-flash`, `gemini-2.5-pro` |
| **OpenRouter** | Any model available on OpenRouter |

### Dashboard Configuration

Open the dashboard and use the BYOK configuration bar at the top:

1. Select a **Provider** from the dropdown
2. Enter your **API Key**
3. Optionally set a **Model** (defaults are provided per provider)
4. Click **Save** — settings are stored locally in `.vibe-diagnosis/config.json`

Once configured, ERROR and WARNING diagnostic cards will show an **Auto Repair** button. Click it to automatically fix the issue using your AI provider.

### Environment Variable Override

You can also configure BYOK via environment variables (useful for CI/CD or team-shared setups):

```bash
export VIBE_DIAG_PROVIDER=openai      # openai | anthropic | gemini | openrouter
export VIBE_DIAG_API_KEY=sk-...
export VIBE_DIAG_MODEL=gpt-4o          # optional, uses provider default
```

Environment variables take precedence over `config.json` settings.

### Security

- API keys are stored locally in `.vibe-diagnosis/config.json`
- `config.json` is automatically added to `.gitignore` during `init`
- Keys are never logged, transmitted to third parties, or included in diagnostics output

---

## 🧩 VS Code Extension

Search `vibe-diagnosis` in VS Code Extensions Marketplace, or install from `.vsix`:

1. `Ctrl+Shift+P` → "Install from VSIX..."
2. Select `vibe-diagnosis-vscode-1.1.0.vsix`

**Commands:**
- `Vibe Diagnosis: Run` — Run all diagnostics
- `Vibe Diagnosis: Init` — Initialize project
- `Vibe Diagnosis: Open Dashboard` — Open web dashboard
- `Vibe Diagnosis: Auto Repair` — AI-powered auto-repair for failing diagnostics
- Status bar shows health percentage

---

## 🤖 MCP Tools Reference

| Tool | Description |
|---|---|
| `run_diagnostics` | Run all diagnostics → JSON results |
| `init_diagnostics` | Initialize .vibe-diagnosis/ |
| `list_diagnostics` | List diagnostic files + metadata |
| `read_error_pattern` | Read past error pattern logs |
| `write_error_pattern` | Record new error patterns |
| `open_dashboard` | Open web dashboard in browser |

---

## 🔄 Agent Automation

Add to your project's `.agents/AGENTS.md` or `CLAUDE.md`:

```markdown
## Vibe Diagnosis Rules
- Run `run_diagnostics` after every completed task
- Record error patterns with `write_error_pattern`
- Create a matching .diag.js file for each new task
```

---

## Three-Layer Diagnostics

| Layer | Verifies |
|---|---|
| **TASK** | Was the task's intent achieved? |
| **FUNCTION** | Do critical functions produce correct outputs including edge cases? |
| **SYSTEM** | External service connectivity, data integrity, infrastructure health |

---

## Error Patterns

When the agent encounters recurring errors, they are recorded in `.vibe-diagnosis/error-patterns/`:

```
.vibe-diagnosis/error-patterns/
└── ERR_001_division_nan.md
```

These logs are referenced in future sessions to avoid repeating the same mistakes.

---

## Release Mode

For production, remove or gitignore the diagnostics directory:

```gitignore
.vibe-diagnosis/
```

---

## License

Apache License 2.0 — Open, Royalty-Free

See [LICENSE](./LICENSE) for details.
