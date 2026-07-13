# 🩺 vibe-diagnosis

AI 코딩 프로젝트를 위한 자가진단 도구입니다. 프로젝트 옆에 작은 검사 파일을 두고, 검사를 실행한 뒤 로컬 대시보드에서 결과를 봅니다.

[English README](./README.md)

> 현재 버전: CLI, MCP 서버, VS Code 확장 모두 **1.2.4**

## 3단계로 시작하기

AI 코딩 도구를 쓴다면 MCP 방식이 가장 쉽습니다.

1. AI 도구의 MCP 설정 파일에 아래 내용을 추가하세요.

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

2. AI 도구를 재시작하거나 MCP 설정을 다시 불러오세요.

3. 아래 문장을 복사해 AI 에이전트에게 보내세요.

   ```bash
   이 프로젝트에 Vibe Diagnosis를 설정해줘. 진단을 초기화하고, 작업에 맞는 검사를 추가한 뒤, 작업이 끝나면 자가진단을 실행해줘.
   ```

`npx`가 필요할 때 MCP 패키지를 내려받아 실행하므로 전역 설치는 필요 없습니다.

### MCP 설정 파일 위치

| AI 도구 | 설정 파일 |
|---|---|
| Gemini / Antigravity | 프로젝트의 `.gemini/settings.json` 또는 `~/.gemini/config/mcp_config.json` |
| Claude Desktop | Windows: `%APPDATA%/Claude/claude_desktop_config.json` |
| Cursor | `.cursor/mcp.json` |
| Windsurf | `~/.codeium/windsurf/mcp_config.json` |

## 대시보드를 제대로 열기

대시보드는 내 컴퓨터에서 실행되는 웹 서버입니다. MCP를 연결했다고 자동으로 대시보드가 열리지는 않습니다.

프로젝트 상태를 확인할 때는 아래 문장을 복사하세요.

```bash
자가진단을 실행해줘. 먼저 open_dashboard를 호출해 대시보드 서버를 실행하고, 내가 열 수 있는지 확인한 뒤 로컬 주소를 알려줘.
```

에이전트는 반드시 다음을 합니다.

1. `open_dashboard` 호출
2. `http://localhost:7700` 응답 확인. 7700을 이미 쓰고 있으면 다음 빈 로컬 포트 사용
3. `run_diagnostics` 실행

MCP가 대시보드를 실행하지 못하면 프로젝트 폴더에서 아래 명령을 실행하세요.

```bash
npx -y vibe-diagnosis dashboard --cwd <프로젝트 경로>
```

대시보드 작업 전에는 아래 문장을 복사하세요.

```bash
대시보드 작업 전에 Vibe Diagnosis 대시보드 서버를 실행하고 열리는지 확인해줘. 작업 후 자가진단을 실행하고 실패 항목을 해결해줘.
```

## CLI

터미널이나 CI에서는 아래 명령을 사용합니다.

```bash
npx -y vibe-diagnosis init                  # .vibe-diagnosis/ 생성
npx -y vibe-diagnosis run                   # 모든 검사 실행 및 대시보드 열기
npx -y vibe-diagnosis run --json            # CI용 JSON 출력
npx -y vibe-diagnosis dashboard             # 대시보드 서버 실행
npx -y vibe-diagnosis repair <diagnosticId> # 실패한 검사 하나 수리
npx -y vibe-diagnosis repair --all          # 실패한 검사 전체 수리
npx -y vibe-diagnosis heal                  # 가능한 치유 단계 전체 실행
```

## 진단 파일

`init`을 실행하면 `.vibe-diagnosis/diagnostics/`에 예제 검사 파일이 만들어집니다. 새 작업을 검증해야 하면 `.diag.js` 파일을 추가하세요.

```js
module.exports = {
  id: 'homepage-loads',
  name: '홈페이지 열림 확인',
  layer: 'TASK', // TASK, FUNCTION, SYSTEM 중 하나

  async run() {
    const homepageLoads = true; // 실제 검사 코드로 바꾸세요.

    return homepageLoads
      ? { status: 'OK', details: '홈페이지가 열립니다' }
      : { status: 'ERROR', details: '홈페이지가 열리지 않습니다' };
  },
};
```

모든 진단에는 `id`, `name`, `layer`, `run`이 필요합니다. `run`은 `OK`, `WARNING`, `ERROR` 중 하나를 반환해야 합니다.

작업 전에는 `list_diagnostics`로 기존 검사를 확인하세요. 작업이 정상인지 증명할 검사가 없다면 에이전트에게 새 검사를 추가하도록 요청하면 됩니다.

## 대시보드에서 보는 것

로컬 대시보드에는 진단 결과, 에러 패턴, 선택 사항인 AI 수리 설정이 표시됩니다. 대시보드는 localhost에서만 내 컴퓨터에 열립니다.

## 선택 사항: AI 수리(BYOK)

AI 수리는 선택 기능입니다. 대시보드에서 제공자, API 키, 모델을 입력하고 저장하세요. OpenAI, Anthropic, Google Gemini, OpenRouter를 지원합니다.

키는 `.vibe-diagnosis/config.json`에 저장됩니다. `init`이 이 파일을 `.gitignore`에 추가합니다. 아래 환경변수로도 설정할 수 있습니다.

```bash
VIBE_DIAG_PROVIDER=openai
VIBE_DIAG_API_KEY=your-key
VIBE_DIAG_MODEL=your-model
```

환경변수는 대시보드에 저장한 설정보다 우선합니다. AI 수리 결과는 보관하기 전에 검토하세요.

## MCP 도구

| 도구 | 용도 |
|---|---|
| `init_diagnostics` | 진단 폴더와 예제 검사 생성 |
| `run_diagnostics` | 모든 진단 실행 |
| `open_dashboard` | 로컬 대시보드 실행 및 열기 |
| `list_diagnostics` | 기존 검사 목록 확인 |
| `repair_diagnostic` | 실패한 검사 하나 수리 |
| `heal_all` | 실패한 검사 전체 수리 또는 치유 |
| `read_error_pattern` | 저장된 에러 패턴 읽기 |
| `write_error_pattern` | 반복되는 에러 패턴 저장 |

## VS Code 확장

Vibe Diagnosis 확장이 설치돼 있다면 명령 팔레트에서 아래 명령을 사용하세요.

- `Vibe Diagnosis: Init`
- `Vibe Diagnosis: Run`
- `Vibe Diagnosis: Open Dashboard`
- `Vibe Diagnosis: Auto Repair`

## 에이전트 규칙 고정하기

매 작업에서 같은 흐름을 쓰려면 AI 도구의 프로젝트 지침 파일에 아래 내용을 추가하세요.

```markdown
## Vibe Diagnosis 규칙

- 새 검증이 필요하면 .diag.js 검사를 추가하거나 수정할 것.
- 작업이 끝나면 run_diagnostics를 실행할 것.
- 대시보드 주소를 알려주기 전 open_dashboard를 호출하고 로컬 서버 응답을 확인할 것.
```

## 라이선스

[Apache License 2.0](./LICENSE)
