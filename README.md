# Vibe Diagnosis

Evidence-first diagnostics and approval-gated repair for AI-assisted coding.

[한국어 문서](./README.ko.md)

Vibe Diagnosis gives coding agents a mechanical way to prove that a task works before they report completion. Projects define lightweight `.diag.js` checks; the runner executes them in isolation, records structured evidence, evaluates release or live-operation gates, and issues a completion receipt bound to the current workspace.

Version: **1.6.0**

## What 1.6.0 provides

- Isolated diagnostic workers with independent working directory, environment view, and module cache.
- Structured execution evidence: exit code, signal, timeout, stdout, stderr, duration, and retry attempts.
- Failure classification: `CONTRACT_ERROR`, `TEST_FAILURE`, `RUNNER_ERROR`, `TIMEOUT`, and `FLAKY`.
- Diagnostic metadata for severity, scope, evidence type, confidence, dependencies, changed files, and release/live blockers.
- Separate health, evidence coverage, `RELEASE_BLOCKED`, and `LIVE_BLOCKED` decisions. A high pass rate never overrides a declared critical blocker.
- Evidence types for `STATIC`, `TEST`, `RUNTIME`, `DATA`, `PROVIDER`, `AUTHORITY`, `UI`, and `LIVE_EVIDENCE`.
- Git and environment fingerprints, saved baselines, change comparison, and root-cause grouping.
- Selection by ID, tag, scope, or severity, plus opt-in cache for explicitly cacheable static or test diagnostics.
- Semantic source assertions for exports, routes, APIs, state transitions, and rendered structures, with warnings for fragile string checks.
- A mandatory dashboard-independent completion gate and a verifiable completion receipt.
- Repair plans with risk classification, diff preview, checksum approval, post-change validation, and rollback on regression.
- BYOK repair planning with OpenAI, Anthropic, Google Gemini, or OpenRouter. API keys are supplied by the user and are not bundled with the package.
- An optional local dashboard bound to `127.0.0.1` with project-specific port and token authentication.

Legacy `.diag.js` files that return `OK`, `WARNING`, or `ERROR` continue to run without migration. Undeclared evidence and gate coverage are reported as not evaluated instead of being inferred.

## Packages

| Package | Purpose | Requirement |
|---|---|---|
| `vibe-diagnosis` | CLI, diagnostic runner, dashboard, and repair engine | Node.js 18+ |
| `vibe-diagnosis-mcp` | MCP server used by coding agents | Node.js 20+ |
| `vibe-diagnosis-vscode` | VS Code commands, status, Problems integration, and reviewed repair UI | VS Code 1.80+ and Node.js 18+ |

## Quick start with the CLI

```bash
npx -y vibe-diagnosis@1.6.0 init
npx -y vibe-diagnosis@1.6.0 run --json
npx -y vibe-diagnosis@1.6.0 complete
```

Initialization creates `.vibe-diagnosis/`, a sample diagnostic, and the Vibe Diagnosis rule block for supported agent rule files. The directory contains local diagnostics, run evidence, repair plans, and optional BYOK data; it is added to `.gitignore` by default.

The dashboard is optional and starts only when requested:

```bash
npx -y vibe-diagnosis@1.6.0 dashboard
npx -y vibe-diagnosis@1.6.0 stop
```

## MCP setup

Add the server to the MCP configuration used by your coding agent:

```json
{
  "mcpServers": {
    "vibe-diagnosis": {
      "command": "npx",
      "args": ["-y", "vibe-diagnosis-mcp@1.6.0"]
    }
  }
}
```

Claude Code on macOS, Linux, or WSL:

```bash
claude mcp add vibe-diagnosis --scope local -- npx -y vibe-diagnosis-mcp@1.6.0
```

Claude Code on native Windows:

```powershell
claude mcp add vibe-diagnosis --scope local -- cmd /c npx -y vibe-diagnosis-mcp@1.6.0
```

Common configuration locations:

| Client | Location |
|---|---|
| Claude Code | Local registration with `claude mcp add`; shared project configuration uses `.mcp.json` |
| Claude Desktop | `%APPDATA%/Claude/claude_desktop_config.json` |
| Cursor | `.cursor/mcp.json` |
| Windsurf | `~/.codeium/windsurf/mcp_config.json` |
| Gemini / Antigravity | Project `.gemini/settings.json` or the client MCP configuration |

## Agent workflow

Give the agent one clear instruction:

```bash
Use Vibe Diagnosis for this task. Inspect or initialize the project diagnostics before implementation, keep the relevant checks current while working, and call complete_task_diagnostics immediately before reporting completion. Require completion.eligible=true and verify the current completion receipt. Do not open the dashboard unless I request it. If a check fails, show a repair plan and diff first; never apply it without my explicit approval and separate high-risk approval when required.
```

Expected sequence:

1. `init_diagnostics` for a new project, or `list_diagnostics` for an initialized project.
2. Add or update diagnostics that represent the task's actual success criteria.
3. Use `run_diagnostics` for focused feedback during implementation.
4. Use `complete_task_diagnostics` immediately before declaring the task complete.
5. Accept completion only when `completion.eligible` is `true`; use `verify_completion_receipt` when the workspace may have changed.

`run_diagnostics` does not launch the dashboard by default. Use `open_dashboard` explicitly when visual inspection is wanted.

## Writing a diagnostic

Create `.vibe-diagnosis/diagnostics/example.diag.js`:

```js
module.exports = {
  id: 'example-behavior',
  name: 'Example behavior',
  layer: 'TASK',
  severity: 'HIGH',
  scope: 'RELEASE',
  evidenceType: 'TEST',
  blocksRelease: true,
  blocksLiveTrading: false,
  confidence: 1,
  tags: ['example'],
  dependencies: [],
  files: ['src/example.js'],
  cache: false,

  async run(ctx) {
    const verified = true; // Replace with an executable assertion.
    return verified
      ? {
          status: 'OK',
          details: 'Example behavior executed successfully.',
          evidence: [{
            type: 'TEST',
            summary: 'Executable behavior check passed.',
            verifiedAt: new Date().toISOString(),
          }],
        }
      : { status: 'ERROR', classification: 'TEST_FAILURE', details: 'Example behavior failed.' };
  },
};
```

Prefer executable behavior, AST, route, API, state-transition, UI, provider, or authenticated runtime evidence over exact source-text matching.

## CLI reference

```bash
vibe-diag init
vibe-diag run [--json] [--ids a,b] [--tags security] [--scope RELEASE] [--severity HIGH] [--cache]
vibe-diag complete
vibe-diag dashboard [--port 8080]
vibe-diag stop
vibe-diag audit
vibe-diag repair <diagId>
vibe-diag repair --all
vibe-diag apply-repair <planId> --approve --checksum <sha256> [--approve-high-risk]
vibe-diag config get
vibe-diag config set <provider|model|apiKey> <value>
```

Use `--cwd <path>` to target another project.

## MCP tool groups

- Diagnosis: `init_diagnostics`, `list_diagnostics`, `run_diagnostics`, `audit_diagnostics`
- Completion: `complete_task_diagnostics`, `verify_completion_receipt`
- Repair: `repair_diagnostic`, `heal_all`, `plan_repair`, `apply_repair_plan`, `list_repair_incidents`, `repair_omission`
- Project checks: `check_symbol_diff`, `recommend_cartridge_split`, `verify_build_safety`
- Agent context: `sync_ai_context`, `sync_agent_rules`
- Knowledge: `read_error_pattern`, `write_error_pattern`
- Dashboard: `open_dashboard`, `stop_dashboard`

Planning tools do not change project files. `apply_repair_plan` requires the reviewed plan checksum and a separate approval for high-risk targets such as authentication, data, credentials, dependencies, runtime settings, or trading logic.

## BYOK and local security

Use environment variables when possible:

```bash
export VIBE_DIAG_PROVIDER=anthropic
export VIBE_DIAG_MODEL=your-model-name
export VIBE_DIAG_API_KEY=your-api-key
```

On PowerShell:

```powershell
$env:VIBE_DIAG_PROVIDER='anthropic'
$env:VIBE_DIAG_MODEL='your-model-name'
$env:VIBE_DIAG_API_KEY='your-api-key'
```

Keys entered through local configuration are stored in ignored `.vibe-diagnosis/byok.local.json`, not in the shareable configuration. Avoid putting keys directly in shell command arguments on shared machines because shell history may retain them.

The runner and repair logs redact common bearer tokens, JWTs, credential-bearing database URLs, private keys, and sensitive object fields. Repair targets are restricted to the project and protected secret files are rejected.

## Development verification

```bash
npm test
npm run test:rollback
npm run test:packed
```

## License

[Apache License 2.0](./LICENSE)
