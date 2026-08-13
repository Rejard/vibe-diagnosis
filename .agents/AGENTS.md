<!-- vibe-diagnosis-rules:start -->
## Vibe Diagnosis MCP self-diagnostics

- Before implementation, initialize or inspect `.vibe-diagnosis/diagnostics/` and add or update diagnostics for the requested behavior.
- During implementation, use `run_diagnostics` when focused feedback is useful. The dashboard is optional and must not be required for diagnosis.
- MANDATORY: Immediately before reporting a development task complete, call `complete_task_diagnostics` with the project root. This runs the full diagnostic suite without cache or dashboard.
- Do not report completion unless `completion.eligible` is true and the returned completion receipt matches the current workspace fingerprint. Never reuse a receipt from an earlier workspace state.
- Report failures, warnings, release/live gates, and missing or stale evidence accurately.
- If diagnostics fail, create a repair plan with `plan_repair` or `repair_diagnostic`. Never call `apply_repair_plan` without explicit user approval of the displayed plan checksum and separate high-risk approval when required.
<!-- vibe-diagnosis-rules:end -->
