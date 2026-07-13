# 🩺 vibe-diagnosis

Self-diagnosis for AI-assisted coding projects. It keeps small checks next to your project, runs them, and shows the result in a local dashboard.

[한국어 README](./README.ko.md)

> Current version: **1.2.5** for the CLI, MCP server, and VS Code extension.

## Start in three steps

MCP is the recommended way to use Vibe Diagnosis with an AI coding tool.

1. Add this to your AI tool's MCP configuration.

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

2. Restart or reload the AI tool.

3. Copy this and send it to the AI agent:

   ```bash
   Set up Vibe Diagnosis for this project. Initialize diagnostics, add checks for the work, and run self-diagnosis when the work is complete.
   ```

`npx` installs and runs the MCP package when needed. A global installation is not required.

### MCP configuration paths

| AI tool | Configuration file |
|---|---|
| Gemini / Antigravity | `.gemini/settings.json` in the project, or `~/.gemini/config/mcp_config.json` |
| Claude Desktop | `%APPDATA%/Claude/claude_desktop_config.json` on Windows |
| Cursor | `.cursor/mcp.json` |
| Windsurf | `~/.codeium/windsurf/mcp_config.json` |

## Open the dashboard correctly

The dashboard is a local web server. Connecting the MCP server does **not** open the dashboard by itself.

Copy this when you want to check the project:

```bash
Run self-diagnosis. First call open_dashboard, start the dashboard server, and confirm that I can open it before you give me the local URL.
```

The agent must:

1. Call `open_dashboard`.
2. Confirm that `http://localhost:7700` responds. If 7700 is busy, it uses the next free local port.
3. Run `run_diagnostics`.

If the MCP server cannot start the dashboard, run this in the project folder:

```bash
npx -y vibe-diagnosis dashboard --cwd <project-path>
```

For dashboard work, copy this request:

```bash
Before dashboard work, start and check the Vibe Diagnosis dashboard server. After the work, run self-diagnosis and fix any failures.
```

## CLI

Use these commands when you prefer a terminal or CI:

```bash
npx -y vibe-diagnosis init                  # Create .vibe-diagnosis/
npx -y vibe-diagnosis run                   # Run all checks and open the dashboard
npx -y vibe-diagnosis run --json            # Print JSON for CI
npx -y vibe-diagnosis dashboard             # Start the dashboard server
npx -y vibe-diagnosis repair <diagnosticId> # Repair one failed check
npx -y vibe-diagnosis repair --all          # Repair all failed checks
npx -y vibe-diagnosis heal                  # Run all available healing steps
```

## Diagnostics

`init` creates `.vibe-diagnosis/diagnostics/` with an example check. Add a `.diag.js` file whenever a task needs a new verification.

```js
module.exports = {
  id: 'homepage-loads',
  name: 'Homepage loads',
  layer: 'TASK', // TASK, FUNCTION, or SYSTEM

  async run() {
    const homepageLoads = true; // Replace with a real check.

    return homepageLoads
      ? { status: 'OK', details: 'Homepage is available' }
      : { status: 'ERROR', details: 'Homepage did not load' };
  },
};
```

Every diagnostic needs `id`, `name`, `layer`, and `run`. `run` must return `OK`, `WARNING`, or `ERROR`.

Use `list_diagnostics` before a task. If no existing check proves the task works, ask the agent to add one.

## What the dashboard shows

The local dashboard shows diagnostic results, error patterns, and optional AI repair settings. It is only available on your computer through its localhost address.

## Optional AI repair (BYOK)

AI repair is optional. In the dashboard, choose a provider, enter your API key and model, then save. Supported providers are OpenAI, Anthropic, Google Gemini, and OpenRouter.

The key is stored in `.vibe-diagnosis/config.json`. `init` adds that file to `.gitignore`. You can also use these environment variables:

```bash
VIBE_DIAG_PROVIDER=openai
VIBE_DIAG_API_KEY=your-key
VIBE_DIAG_MODEL=your-model
```

Environment variables override the saved dashboard settings. Review AI repair changes before keeping them.

## MCP tools

| Tool | Use it for |
|---|---|
| `init_diagnostics` | Create the diagnostic folders and example check |
| `run_diagnostics` | Run every diagnostic |
| `open_dashboard` | Start and open the local dashboard |
| `list_diagnostics` | See existing checks |
| `repair_diagnostic` | Repair one failed diagnostic |
| `heal_all` | Repair or heal all failed diagnostics |
| `read_error_pattern` | Read a saved error pattern |
| `write_error_pattern` | Save a recurring error pattern |

## VS Code extension

If the Vibe Diagnosis extension is installed, open the Command Palette and use:

- `Vibe Diagnosis: Init`
- `Vibe Diagnosis: Run`
- `Vibe Diagnosis: Open Dashboard`
- `Vibe Diagnosis: Auto Repair`

## Keep the agent consistent

Add this to your AI tool's project instruction file when you want the same behavior on every task:

```markdown
## Vibe Diagnosis rules

- Add or update a .diag.js check when a task needs new verification.
- Run run_diagnostics after completing a task.
- Before giving a dashboard URL, call open_dashboard and confirm that the local server responds.
```

## License

[Apache License 2.0](./LICENSE)
