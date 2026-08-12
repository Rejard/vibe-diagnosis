# vibe-diagnosis-mcp

MCP server for Vibe Diagnosis 1.6.0. It lets coding agents initialize and run project diagnostics, enforce a final completion gate, inspect evidence, and prepare approval-gated repairs.

## Requirements

- Node.js 20 or newer
- A project workspace writable by the MCP client

## Configuration

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

## Required agent workflow

```bash
Inspect or initialize Vibe Diagnosis before implementation. Keep diagnostics aligned with the task. Immediately before reporting completion, call complete_task_diagnostics, require completion.eligible=true, and verify the current receipt. Do not open the dashboard unless requested. Show every repair plan and diff before asking for approval; never apply a plan without explicit approval and separate high-risk approval when required.
```

`run_diagnostics` does not start the dashboard unless `autoLaunchDashboard` is explicitly enabled. `complete_task_diagnostics` always runs the full suite without filters, cache, or dashboard.

Repair planning does not modify project files. `apply_repair_plan` requires the reviewed checksum, explicit approval, and an additional approval for protected high-risk areas. Validation failures and regressions are rolled back.

## Tool groups

- Diagnosis: `init_diagnostics`, `list_diagnostics`, `run_diagnostics`, `audit_diagnostics`
- Completion: `complete_task_diagnostics`, `verify_completion_receipt`
- Repair: `repair_diagnostic`, `heal_all`, `plan_repair`, `apply_repair_plan`, `list_repair_incidents`, `repair_omission`
- Project checks: `check_symbol_diff`, `recommend_cartridge_split`, `verify_build_safety`
- Context and rules: `sync_ai_context`, `sync_agent_rules`
- Error knowledge: `read_error_pattern`, `write_error_pattern`
- Optional dashboard: `open_dashboard`, `stop_dashboard`

See the [full project documentation](https://github.com/Rejard/vibe-diagnosis) for diagnostic schema, evidence types, BYOK configuration, CLI commands, and security behavior.

## License

[Apache License 2.0](./LICENSE)
