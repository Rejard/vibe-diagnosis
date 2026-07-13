# Vibe Diagnosis for VS Code

Run project self-diagnosis from VS Code and view the result in a local dashboard.

## Quick start

1. Open your project folder in VS Code.
2. Open the Command Palette with `Ctrl+Shift+P`.
3. Run `Vibe Diagnosis: Init` once.
4. Add or edit `.diag.js` files in `.vibe-diagnosis/diagnostics/`.
5. Run `Vibe Diagnosis: Run` to check the project.

## Open the dashboard

Run `Vibe Diagnosis: Open Dashboard` from the Command Palette. It starts the local dashboard server and opens it in your browser.

The normal address is `http://localhost:7700`. If it is already in use, Vibe Diagnosis uses the next free local port.

Do not assume a localhost URL is ready just because it was shown. Wait for the browser to open, or run the command again if the server did not start.

## Commands

| Command | What it does |
|---|---|
| `Vibe Diagnosis: Init` | Creates `.vibe-diagnosis/` and an example diagnostic |
| `Vibe Diagnosis: Run` | Runs all diagnostics and shows the result |
| `Vibe Diagnosis: Run (JSON)` | Prints diagnostic results as JSON |
| `Vibe Diagnosis: Open Dashboard` | Starts and opens the local dashboard |
| `Vibe Diagnosis: Auto Repair` | Repairs a selected failed diagnostic when BYOK is configured |

## AI repair is optional

The dashboard can use your own API key for repair. Supported providers are OpenAI, Anthropic, Google Gemini, and OpenRouter. Review any repair before keeping it.

## Links

- [GitHub documentation](https://github.com/Rejard/vibe-diagnosis)
- [CLI package](https://www.npmjs.com/package/vibe-diagnosis)
- [MCP server package](https://www.npmjs.com/package/vibe-diagnosis-mcp)
