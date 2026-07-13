# 🩺 vibe-diagnosis

**Self-diagnosis framework for vibe coding projects**

When coding with AI agents, prove that your project works — with code.

> **Core Principle — Task ↔ Diagnostic 1:1 Mapping**: Every completed task must have a corresponding diagnostic that verifies it works correctly.

[한국어 README](./README.ko.md)

---

## 🚀 Start here

Use one of these three paths. Most AI coding users should choose **MCP**.

| What you use | Start with |
|---|---|
| Cursor, Claude Desktop, Gemini, Windsurf, or another MCP client | [MCP setup](#mcp-setup-recommended) |
| Terminal or CI | [CLI](#cli) |
| VS Code without an MCP client | [VS Code extension](#vs-code-extension) |

> **Version note:** the VS Code extension, `vibe-diagnosis` (CLI), and `vibe-diagnosis-mcp` are currently **1.2.4**.

### MCP setup (recommended)

1. Add this configuration to your AI tool's MCP settings. `npx` downloads and runs the MCP package automatically; a global install is not required.

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

2. Restart or reload your AI tool so it discovers the `vibe-diagnosis` MCP server.

3. Copy and send this one request to the AI agent:

> `Set up Vibe Diagnosis for this project. Initialize diagnostics, create any diagnostics needed for the work, and run the full self-diagnosis when the work is complete.`

That is enough for normal work. The agent should use `init_diagnostics` once, create or extend `.diag.js` checks when needed, then use `run_diagnostics` to verify the result.

### Dashboard work: copy this request

> `Before starting this dashboard task, call open_dashboard. Review the diagnostic list, add a relevant .diag.js check if this task is not covered, complete the work, then run diagnostics and fix failures before reporting completion.`

`open_dashboard` starts the web dashboard at `http://localhost:7700` (or the next available local port). **Installing or connecting MCP alone does not start the web dashboard.**

### The only phrases you need

| Say to the agent | Expected MCP action |
|---|---|
| `Set up Vibe Diagnosis for this project.` | `init_diagnostics` |
| `Run self-diagnosis.` | `run_diagnostics` |
| `Open the diagnosis dashboard.` | `open_dashboard` |
| `Show the diagnostic list.` | `list_diagnostics` |

---

## CLI

Install globally or use via npx:

```bash
npx -y vibe-diagnosis init                        # Initialize .vibe-diagnosis/
npx -y vibe-diagnosis run                         # Run all diagnostics
npx -y vibe-diagnosis run --json                  # JSON output (for CI/CD)
npx -y vibe-diagnosis dashboard                   # Open web dashboard
npx -y vibe-diagnosis config get                  # Show BYOK configuration
npx -y vibe-diagnosis config set provider openai  # Set AI provider
npx -y vibe-diagnosis config set apiKey sk-...    # Set API key
npx -y vibe-diagnosis config set model gpt-4o     # Set model name
npx -y vibe-diagnosis repair <diagId>             # Auto-repair a specific diagnostic
npx -y vibe-diagnosis repair --all                # Auto-repair all failing diagnostics
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
  Vibe Diagnosis v1.2.4 — my-project
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
npx -y vibe-diagnosis dashboard            # http://localhost:7700
npx -y vibe-diagnosis dashboard --port 8080
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
2. Select the downloaded `vibe-diagnosis-vscode-1.2.4.vsix` file.

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
