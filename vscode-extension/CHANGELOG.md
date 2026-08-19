# Change Log

## 1.8.0 (Current)

- `run_diagnostics` and `complete_task_diagnostics` answer with a summary, gates, and every failing diagnostic by default, so the response no longer grows with the number of passing diagnostics.
- Added `verbosity` with `summary`, `list`, and `full`. The previous response is `verbosity: "full"`.
- The dashboard is unchanged. It still shows every diagnostic, and the complete report is still saved to the run file.

## 1.7.3

- Reads the version from the packaged manifest instead of hardcoding it, so a release cannot bump one file and miss another.
- Filters the diagnostic list by status. The total, OK, WARN, and ERR cards are buttons, and keys 1 to 4 switch between them.

## 1.7.2

- Safely renders string, scalar, array, and structured-object diagnostic details without aborting dashboard restoration.
- Isolates malformed card fields so one diagnostic cannot hide the rest of the latest persisted report.
- Preserves policy exclusion and timing displays across initial load, refresh, and server restart.

## 1.7.1

- Restored the latest persisted diagnostic report after dashboard page and server restarts.
- Added per-diagnostic and total elapsed time plus slowest-first dashboard inspection.
- Added structured response handling and server/API version mismatch detection.
- Replaced only identity-verified older same-project dashboard servers through authenticated graceful shutdown.

## 1.7.0

- Added 1-5 star diagnostic check necessity for priority-aware routine and completion runs.
- Added dashboard controls for run-now, skip-once, snooze, disable, recoverable remove, and restore.
- Bound completion receipts to the local diagnostic policy so exclusions cannot become invisible after completion.

## 1.6.3

- Added restricted STATIC/TEST diagnostic environments with explicit environment allowlists.
- Replaced heuristic MCP stdout filtering with transport-owned protocol output.
- Added AST metadata and symbol inspection plus neutral 100/500/1,000 diagnostic scale fixtures.
- Added generic Codex, Claude Code, and Gemini CLI stdio compatibility contracts.

## 1.6.2

- Sealed all safety-relevant repair fields and made repair application share the project execution lock.
- Added legacy BYOK ignore migration and protected ignored-file mutation detection.
- Made blocker and live-evidence states conservative and preserved completion receipts separately.
- Replaced conflicting legacy agent rules and authenticated dashboard identity before reuse.
- Kept CLI diagnostics dashboard-independent and added provider timeout/response limits.

## 1.6.1

- Prevented overlapping diagnostics for the same project across dashboard, MCP, CLI, and separate Node processes.
- Added immediate dashboard HTTP 409 handling with a clear running-state message and reliable button reset.
- Added safe recovery for dead-process locks stored outside the project workspace.
- Pinned patched packaging dependencies so the release audit reports no known vulnerabilities.

## 1.6.0

- Rewrote the extension documentation around the current 1.6 diagnostic, completion, dashboard, and approval-gated repair behavior.
- Fixed safe repair to use the current project's allocated dashboard port and authentication token.
- Added the reviewed repair-plan checksum to dashboard application requests.
- Included the Apache-2.0 license in the packaged extension.
- Added a dashboard-independent `complete_task_diagnostics` gate that runs the full suite without cache before an agent reports completion.
- Agent rule synchronization now covers root `AGENTS.md`, `.agents/AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, Cursor, and Windsurf rule files, including already initialized projects.
- Changed MCP `run_diagnostics` so dashboard launch is explicit and disabled by default.
- Restored the documented `stop_dashboard` MCP tool with project-scoped authenticated shutdown and stale-lock handling.
- Added isolated per-diagnostic workers with structured exit, signal, timeout, stdout, stderr, and retry evidence.
- Added failure classifications, evidence freshness, Git/environment baselines, release/live blockers, safe selection/cache, diagnostic auditing, and root-cause grouping.
- Replaced immediate repair UI behavior with reviewable plans, explicit approval, separate high-risk approval, full-suite validation, and rollback.

## 1.5.1
- **Enhanced**: Adaptive Monolithic Component Omission Protection (UI files: 300+ lines warning, Backend/Logic files: 600+ lines warning).

## 1.5.0
- **Added**: Monolithic UI Component Omission Protection (scanner detects files over 500/800 lines to emit WARNINGs before AI rewrites).
- **Added**: Symbol Diff Guard (`check_symbol_diff`) to track lost JSX UI card tags, export symbols, and formula functions before and after code modifications.
- **Added**: Cartridge Splitter Blueprint (`recommend_cartridge_split`) to generate modular sub-cartridge splitting guides for monolithic UI files.
- **Added**: Auto-Revert Repair (`repair_omission`) to restore lost UI blocks automatically from `.bak` backups or git snapshots.
- **Added**: AI Context Sync (`sync_ai_context`) to persist goals and diagnostic state to `.vibe-diagnosis/active_context.json` for seamless handover between AI sessions.
- **Added**: Background Build Verifier (`verify_build_safety`) to confirm 0 compilation errors before task completion.
- **Added**: Agent Rules Injector (`sync_agent_rules`) to auto-inject self-diagnosis guidelines into `.cursorrules`, `AGENTS.md`, and `CLAUDE.md`.

## 1.3.3
- **Added**: One-click Dashboard Server Shutdown Control (safely close the background server and release port 7700 resources from both the web interface and CLI).
- **Added**: Stop command (`stop_dashboard` MCP tool & `vibe-diag stop` CLI) integration for seamless developer-led resource management.
- **Added**: Automated full-folder `.gitignore` isolation to guarantee local tests and runtime temp configs are kept entirely separate from public Git repositories.

## 1.3.2
- **Added**: Interactive Diagnostic Card Click Integration (specific rules or test cards can now be clicked in the dashboard to dynamically isolate and transition the SVG TDD timeline chart to that rule's specific growth curve, with full backward compatibility).
- **Added**: Dashboard chart filter reset trigger badge integrated into the live title bar.

## 1.3.1
- **Added**: TDD Milestone Chronology Board (saves qualitative retrospect summaries and notes inside a local glassmorphic DB).
- **Added**: Port Lock Safety Control (avoids node background server duplicate spawning by pinning repos to cached port locks in `.vibe-diagnosis/active_port.json`).

## 1.3.0
- **Added**: Next-Gen Analytics Telemetry Dashboard featuring pass rate SVG charts, Responsive UI Layout CSS Grade (A+ to F), Asset Independence GOLD badge checks, and Dead-code Debt indices.

## 1.2.7
- **Added**: Agent-driven workflow rules (auto-registers `.agents/AGENTS.md`, `.cursorrules`, and `.windsurfrules` with pre-defined TDD guidelines to enforce quality constraints across multiple AI coding assistants).
- **Enhanced**: Strict self-diagnosis constraints embedded directly within the MCP tool descriptions (enforcing AI agents to run `init_diagnostics` and `list_diagnostics` as the non-negotiable 1st step of any feature implementation).
- **Improved**: Deep documentation rewrite for the VS Code Marketplace and Open VSX (added beautiful bilingual Korean & English user guides for seamless onboarding).

## 1.2.6
- **Improved**: Extension configuration bindings and minor metadata syncing across publishing environments (Open VSX and VS Code Marketplace).

## 1.2.5
- **Fixed**: Resolved edge case port binding conflicts and race conditions.
- **Improved**: Reliable background dashboard server spawning mechanism for Windows, macOS, and Linux environments.
- **Updated**: Upgraded MCP client-server standard schema mapping protocol.

## 1.2.0
- **Added**: Full integration with AI-assisted self-healing (BYOK API reasoning engine supports OpenAI, Anthropic, Google Gemini, and OpenRouter).
- **Added**: Visual problems panel integration and workspace diagnostic-to-folder auto-detection.

## 1.1.0
- **Added**: Auto Repair command (BYOK AI-powered auto-repair).
- **Added**: QuickPick UI for selecting which diagnostic to repair.
- **Added**: Dashboard API integration for repair workflow.

## 1.0.1
- **Added**: Open Dashboard command.
- **Added**: Marketplace icon.
- **Improved**: Extension metadata.

## 1.0.0
- **Initial release**:
  - Run diagnostics from VS Code Command Palette.
  - Live status bar health indicators.
  - Active Problems panel integration.
