# Vibe Diagnosis

Vibe Diagnosis helps you and your coding agent check a project, find problems, and open a local results dashboard.

## The easy way: ask your coding agent

Open your project in VS Code, then copy this message to your coding agent:

```text
Set up Vibe Diagnosis for this project. Add the diagnostics this project needs, run the self-diagnosis, and start the local dashboard so I can review the results in my browser.
```

If the project needs checks that are not in the example diagnostics, ask the agent to add them:

```text
Add useful Vibe Diagnosis checks for this project. Create diagnostics for the important parts of the app, then run them and explain any failures.
```

Your agent needs permission to run terminal commands in the project. If it cannot run commands, use the VS Code commands below.

## Open the dashboard

Run **Vibe Diagnosis: Open Dashboard** from the Command Palette (`Ctrl+Shift+P`). It starts the local dashboard server and opens the result in your browser.

The usual address is `http://localhost:7700`. Do not open the address until the command has started the server. If port 7700 is busy, Vibe Diagnosis uses another free local port.

## VS Code commands

| Command | What it does |
|---|---|
| `Vibe Diagnosis: Init` | Creates `.vibe-diagnosis/` and an example check |
| `Vibe Diagnosis: Run` | Runs all project checks |
| `Vibe Diagnosis: Run (JSON)` | Shows the results as JSON |
| `Vibe Diagnosis: Open Dashboard` | Starts and opens the local dashboard |
| `Vibe Diagnosis: Auto Repair` | Lets you review an AI repair when BYOK is configured |

## Optional AI repair

You can connect your own OpenAI, Anthropic, Google Gemini, or OpenRouter API key for repair suggestions. Always review a repair before keeping it.

## More help

- [Full GitHub guide](https://github.com/Rejard/vibe-diagnosis)
- [CLI package](https://www.npmjs.com/package/vibe-diagnosis)
- [MCP server package](https://www.npmjs.com/package/vibe-diagnosis-mcp)
