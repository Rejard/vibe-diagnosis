# 🩺 vibe-diagnosis

**바이브코딩 프로젝트를 위한 자가 진단 프레임워크**

AI 에이전트와 함께 코딩할 때, "지금 이 프로젝트가 정상인가?"를 코드로 증명합니다.

[English README](./README.md)

---

## 🚀 여기서 시작하세요

아래 세 가지 중 하나를 선택하면 됩니다. AI 코딩 도구를 사용한다면 **MCP 방식**을 권장합니다.

| 사용 환경 | 시작 방법 |
|---|---|
| Cursor, Claude Desktop, Gemini, Windsurf 등 MCP 지원 AI 도구 | [MCP 설정](#mcp-설정-권장) |
| 터미널 또는 CI | [CLI](#cli) |
| MCP를 쓰지 않는 VS Code | [VS Code 확장](#vs-code-확장) |

> **버전 안내:** VS Code 확장, `vibe-diagnosis`(CLI), `vibe-diagnosis-mcp`는 현재 모두 **1.2.4**입니다.

### MCP 설정 (권장)

1. AI 도구의 MCP 설정 파일에 아래 내용을 추가하세요. `npx`가 MCP 패키지를 자동으로 내려받아 실행하므로 전역 설치는 필요하지 않습니다.

| AI 도구 | 설정 파일 경로 |
|---|---|
| **Gemini** (Antigravity 2.0) | `.gemini/settings.json` (프로젝트) 또는 `~/.gemini/config/mcp_config.json` (글로벌) |
| **Claude Desktop** | `%APPDATA%/Claude/claude_desktop_config.json` (Win) · `~/Library/Application Support/Claude/claude_desktop_config.json` (Mac) |
| **Cursor** | `.cursor/mcp.json` |
| **Windsurf** | `~/.codeium/windsurf/mcp_config.json` |

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

2. AI 도구를 재시작하거나 MCP 설정을 다시 불러와 `vibe-diagnosis` 서버를 인식시킵니다.

3. 아래 한 문장을 복사해 AI 에이전트에게 보내세요.

> `이 프로젝트에 Vibe Diagnosis를 설정해줘. 진단을 초기화하고, 작업에 필요한 진단을 추가한 뒤, 작업 완료 시 전체 자가진단을 실행해줘.`

일반 작업은 이것으로 충분합니다. 에이전트는 최초 한 번 `init_diagnostics`를 실행하고, 필요한 `.diag.js` 진단을 만들거나 확장한 후 `run_diagnostics`로 결과를 검증합니다.

### 대시보드·자가진단 작업: 이 문장을 복사하세요

> `이번 대시보드 작업을 시작하거나 자가진단 결과를 보고하기 전에 open_dashboard를 호출해 Vibe Diagnosis 웹 서버를 실행해줘. 로컬 URL이 실제로 응답하는지 확인한 뒤에만 열라고 안내해줘. 진단 목록을 확인하고 이번 작업용 진단이 없으면 .diag.js를 추가해줘. 작업을 완료한 뒤 전체 진단을 실행하고, 실패를 해결한 후 완료를 보고해줘.`

`open_dashboard`는 `http://localhost:7700`(이미 사용 중이면 다음 빈 포트)에 웹 대시보드를 실행합니다. **MCP를 설치하거나 연결한 것만으로는 웹 대시보드 서버가 실행되지 않습니다.** localhost 주소만 안내하지 말고 반드시 `open_dashboard`를 호출한 뒤 서버 응답을 확인해야 합니다. MCP 호출로 서버를 실행하지 못하면 `npx -y vibe-diagnosis dashboard --cwd <프로젝트 경로>`를 대신 실행하세요.

### 필요한 트리거는 네 가지입니다

| AI 에이전트에게 말하기 | 예상 MCP 동작 |
|---|---|
| `이 프로젝트에 Vibe Diagnosis를 설정해줘.` | `init_diagnostics` |
| `자가진단을 실행하고 먼저 자가진단 대시보드 서버를 열어줘.` | `open_dashboard` → `run_diagnostics` |
| `자가진단 대시보드를 열어줘.` | `open_dashboard` |
| `현재 진단 목록을 보여줘.` | `list_diagnostics` |

## CLI

```bash
npx -y vibe-diagnosis init                        # .vibe-diagnosis/ 초기화
npx -y vibe-diagnosis run                         # 모든 진단 실행
npx -y vibe-diagnosis run --json                  # JSON 출력 (CI/CD용)
npx -y vibe-diagnosis dashboard                   # 웹 대시보드 열기
npx -y vibe-diagnosis config get                  # BYOK 설정 확인
npx -y vibe-diagnosis config set provider openai  # AI 프로바이더 설정
npx -y vibe-diagnosis config set apiKey sk-...    # API 키 설정
npx -y vibe-diagnosis config set model gpt-4o     # 모델명 설정
npx -y vibe-diagnosis repair <diagId>             # 특정 진단 AI 자동 수리
npx -y vibe-diagnosis repair --all                # 실패한 모든 진단 자동 수리
```

### 진단 파일 작성

`.vibe-diagnosis/diagnostics/`에 `.diag.js` 파일을 생성합니다:

```js
module.exports = {
  id: 'task-001-user-login',
  name: 'User Login Flow',
  layer: 'TASK',              // TASK | FUNCTION | SYSTEM
  linkedTask: 'TASK-001',

  async run(ctx) {
    const auth = require('../src/auth');
    const result = auth.login('test@test.com', 'password123');

    if (!result.token) {
      return { status: 'ERROR', details: 'Login did not return token' };
    }
    return { status: 'OK', details: 'Login flow verified' };
  }
};
```

### 출력 예시

```
  Vibe Diagnosis v1.2.4 — my-project
  ─────────────────────────────────────────

  TASK │ task-001-user-login       │ ✅ OK      │ Login flow verified
  FUNC │ func-auth-token           │ ✅ OK      │ JWT validation passed
  SYS  │ sys-database              │ ⚠️ WARNING │ Connection pool at 80%

  ─────────────────────────────────────────
  Total: 3 nodes │ OK: 2 │ WARN: 1 │ ERR: 0
  Overall: ⚠️ WARNING — Health 67%
```

---

## 🖥️ 웹 대시보드

```bash
npx -y vibe-diagnosis dashboard            # http://localhost:7700
npx -y vibe-diagnosis dashboard --port 8080
```

기능:
- Health 링 게이지 (건강도 퍼센트)
- 진단 카드 그리드 (레이어별 색상 구분)
- "Run Diagnostics" 원클릭 진단 버튼
- 에러 패턴 모달 뷰어
- 다크모드 프리미엄 UI
- BYOK 설정 바 (Provider / API Key / Model)
- ERROR/WARNING 카드의 Auto Repair 버튼
- AI 연결 상태 인디케이터

---

## 🤖 BYOK 자동 수리

**Bring Your Own Key** — 자신의 AI API 키를 연결하여 실패한 진단을 자동으로 분석하고 수리합니다.

벤더 종속 없음. API 키는 로컬에만 저장되며, 선택한 프로바이더 외에는 어디에도 전송되지 않습니다.

### 지원 프로바이더

| 프로바이더 | 모델 예시 |
|---|---|
| **OpenAI** | `gpt-4o`, `gpt-4o-mini` |
| **Anthropic** | `claude-sonnet-4-20250514`, `claude-3-5-haiku-20241022` |
| **Google Gemini** | `gemini-2.5-flash`, `gemini-2.5-pro` |
| **OpenRouter** | OpenRouter에서 제공하는 모든 모델 |

### 대시보드 설정

대시보드를 열고 상단의 BYOK 설정 바를 사용합니다:

1. 드롭다운에서 **Provider** 선택
2. **API Key** 입력
3. **Model** 이름 입력 (예: `gpt-4o-mini`)
4. **Save** 클릭 — 설정이 `.vibe-diagnosis/config.json`에 로컬 저장됩니다

설정 완료 후, ERROR/WARNING 진단 카드에 **Auto Repair** 버튼이 표시됩니다. 클릭하면 AI가 자동으로 문제를 분석하고 수리합니다.

### 환경변수 오버라이드

CI/CD나 팀 공유 환경에서는 환경변수로 설정할 수도 있습니다:

```bash
export VIBE_DIAG_PROVIDER=openai      # openai | anthropic | gemini | openrouter
export VIBE_DIAG_API_KEY=sk-...
export VIBE_DIAG_MODEL=gpt-4o          # 선택사항
```

환경변수는 `config.json` 설정보다 우선합니다.

### 보안

- API 키는 `.vibe-diagnosis/config.json`에 로컬 저장
- `config.json`은 `init` 시 자동으로 `.gitignore`에 추가
- 키는 로그에 기록되거나 제3자에게 전송되거나 진단 출력에 포함되지 않음

---

## 🧩 VS Code 확장

VS Code 확장 마켓플레이스에서 `vibe-diagnosis` 검색, 또는 `.vsix`로 설치:

1. `Ctrl+Shift+P` → "Install from VSIX..."
2. 내려받은 `vibe-diagnosis-vscode-1.2.4.vsix` 파일 선택

**커맨드:**
- `Vibe Diagnosis: Run` — 진단 실행
- `Vibe Diagnosis: Init` — 프로젝트 초기화
- `Vibe Diagnosis: Open Dashboard` — 대시보드 열기
- `Vibe Diagnosis: Auto Repair` — AI 자동 수리 (실패한 진단 선택 → 수리)
- Status Bar에 건강도 퍼센트 표시

---

## 🤖 MCP 도구 목록

| 도구 | 설명 |
|---|---|
| `run_diagnostics` | 프로젝트 진단 실행 → JSON 결과 반환 |
| `init_diagnostics` | .vibe-diagnosis/ 초기화 |
| `list_diagnostics` | 진단 파일 목록 + 메타데이터 조회 |
| `read_error_pattern` | 과거 에러 패턴 로그 읽기 |
| `write_error_pattern` | 새 에러 패턴 기록 |
| `open_dashboard` | 웹 대시보드 열기 |

---

## 🔄 에이전트 자동화

프로젝트의 `.agents/AGENTS.md` 또는 `CLAUDE.md`에 추가:

```markdown
## Vibe Diagnosis Rules
- Task 완료 후 반드시 `run_diagnostics` MCP 도구로 검증할 것
- 에러 패턴 발견 시 `write_error_pattern`으로 기록할 것
- 새 Task에 대응하는 .diag.js 파일을 함께 생성할 것
```

---

## 3단계 진단 레이어

| 레이어 | 검증 대상 |
|---|---|
| **TASK** | 작업의 의도가 달성되었는가? |
| **FUNCTION** | 핵심 함수가 엣지 케이스 포함 올바른 출력을 생성하는가? |
| **SYSTEM** | 외부 서비스 연결, 데이터 무결성, 인프라 상태 |

---

## 에러 패턴 기록

에이전트가 반복되는 에러를 발견하면 `.vibe-diagnosis/error-patterns/`에 기록합니다:

```
.vibe-diagnosis/error-patterns/
└── ERR_001_division_nan.md
```

이 로그는 이후 세션에서 같은 실수를 반복하지 않도록 참조됩니다.

---

## 릴리즈 모드

프로덕션 배포 시 `.gitignore`에 추가:

```gitignore
.vibe-diagnosis/
```

---

## License

Apache License 2.0 — Open, Royalty-Free (오픈, 로열티 프리)

자세한 내용은 [LICENSE](./LICENSE)를 참조하세요.
