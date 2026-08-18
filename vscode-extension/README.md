# Vibe Diagnosis for VS Code

[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/Rejard.vibe-diagnosis-vscode?style=flat-square&color=blue)](https://marketplace.visualstudio.com/items?itemName=Rejard.vibe-diagnosis-vscode)
[![Open VSX](https://img.shields.io/open-vsx/v/Rejard/vibe-diagnosis-vscode?style=flat-square&color=purple)](https://open-vsx.org/extension/Rejard/vibe-diagnosis-vscode)

VS Code integration for Vibe Diagnosis 1.7.2. Run project diagnostics, inspect failures in the Problems panel, open the optional authenticated local dashboard, and review a fully sealed repair plan before approving any file change.

Version 1.7.2 keeps the 1.7 priority and policy controls, persistent dashboard result restoration, per-diagnostic timing, structured API errors, and identity-verified replacement of an older same-project dashboard server. It also renders structured diagnostic details safely without allowing one malformed card to hide the report.

## Requirements

- VS Code 1.80 or newer
- Node.js 18 or newer
- An opened workspace folder

The extension invokes the `vibe-diagnosis` CLI through `npx` unless it is running from the source repository. MCP agent integration is installed separately with `vibe-diagnosis-mcp`.

## Commands

Open the Command Palette with `Ctrl+Shift+P` or `Cmd+Shift+P`:

| Command | Behavior |
|---|---|
| `Vibe Diagnosis: Init` | Creates `.vibe-diagnosis/`, a sample diagnostic, and supported agent rule blocks |
| `Vibe Diagnosis: Run` | Runs diagnostics and shows health, gates, and failures |
| `Vibe Diagnosis: Run (JSON)` | Runs diagnostics and prints the complete version 1.7 report |
| `Vibe Diagnosis: Open Dashboard` | Starts the optional project dashboard on its allocated local port |
| `Vibe Diagnosis: Plan Safe Repair` | Runs current diagnostics, shows a risk-rated plan and diff, then asks separately before application |

When an initialized workspace opens, the extension runs its diagnostics and updates the status bar. Errors and warnings are also shown in the Problems panel.

## Safe repair behavior

The repair command starts or connects to the dashboard registered for the current project. It reads the project-specific port and authentication token from `.vibe-diagnosis/active_port.json`; it does not assume that port 7700 belongs to the workspace.

The extension then:

1. Runs current diagnostics through the authenticated local dashboard.
2. Lets you choose a failing diagnostic.
3. Displays the proposed files, diff preview, risk, and plan identifier.
4. Requires explicit confirmation before applying the reviewed plan.
5. Requires a second confirmation for high-risk targets.
6. Sends the approved plan checksum and reports whether validation succeeded or changes were rolled back.

Planning never changes project files. BYOK provider access is used only when a repair plan needs AI reasoning and only with credentials configured by the user.

## Agent completion gate

The VS Code extension is a manual development interface. Automatic agent completion checks come from the MCP package and synchronized agent rules:

```bash
Use Vibe Diagnosis for this task. Before reporting completion, call complete_task_diagnostics for the project, require completion.eligible=true, and verify that its receipt still matches the current workspace. Do not open the dashboard unless visual inspection is requested. Never apply a repair plan without explicit approval.
```

Install the MCP server separately:

```json
{
  "mcpServers": {
    "vibe-diagnosis": {
      "command": "npx",
      "args": ["-y", "vibe-diagnosis-mcp@1.7.2"]
    }
  }
}
```

## 한국어 안내

Vibe Diagnosis 1.7.2 확장은 별 1~5개의 점검 필요도와 정책 기능에 더해 대시보드 최신 결과 복원, 구조화 진단 상세 정보의 안전한 표시, 항목별 소요 시간, 구조화된 API 오류, 같은 프로젝트의 구버전 서버 안전 갱신을 제공합니다.

명령 팔레트에서 다음 명령을 사용할 수 있습니다.

- `Vibe Diagnosis: Init`: 진단 폴더, 예제 진단, 지원되는 에이전트 규칙 블록 생성
- `Vibe Diagnosis: Run`: 진단 실행 및 건강도·게이트·실패 표시
- `Vibe Diagnosis: Run (JSON)`: 전체 1.7 JSON 보고서 출력
- `Vibe Diagnosis: Open Dashboard`: 현재 프로젝트의 로컬 대시보드 실행
- `Vibe Diagnosis: Plan Safe Repair`: 실패 진단의 수리 계획과 diff를 검토하고 별도 승인 후 적용

안전수리는 현재 프로젝트의 포트와 인증 토큰을 확인합니다. 계획 단계에서는 파일을 바꾸지 않으며, 적용 시 검토한 체크섬과 명시적 승인이 필요합니다. 인증·데이터·자격증명·의존성·런타임 설정·거래 로직 같은 고위험 대상은 두 번째 승인을 요구합니다. 적용 후 진단이 실패하거나 회귀가 생기면 변경을 롤백합니다.

에이전트가 작업 완료 때 자동으로 진단하게 하려면 확장만 설치하는 것이 아니라 `vibe-diagnosis-mcp`를 연결하고 `init_diagnostics` 또는 `sync_agent_rules`로 규칙을 명시적으로 동기화해야 합니다. 완료 판정은 대시보드 실행 여부와 무관합니다.

## Links

- [Project documentation](https://github.com/Rejard/vibe-diagnosis)
- [CLI package](https://www.npmjs.com/package/vibe-diagnosis)
- [MCP package](https://www.npmjs.com/package/vibe-diagnosis-mcp)

## License

[Apache License 2.0](./LICENSE)
