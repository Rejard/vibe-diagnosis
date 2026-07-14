# Change Log

## 1.2.7 (Current)
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
