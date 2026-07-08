# 🩺 vibe-diagnosis

**바이브코딩 프로젝트를 위한 자가 진단 프레임워크**

AI 에이전트와 함께 코딩할 때, "지금 이 프로젝트가 정상인가?"를 코드로 증명합니다.

---

## 핵심 원칙

> **Task ↔ Diagnostic 1:1 매핑**: 작업(Task)이 완료되면, 그 작업이 정상 동작함을 검증하는 진단(Diagnostic)이 반드시 함께 생성되어야 합니다.

| 진단 레이어 | 검증 대상 |
|---|---|
| **TASK** | 작업의 의도가 달성되었는가? |
| **FUNCTION** | 핵심 함수가 엣지 케이스 포함 올바른 출력을 생성하는가? |
| **SYSTEM** | 외부 서비스 연결, 데이터 무결성, 인프라 상태 |

---

## 빠른 시작

### 1. 설치

```bash
npm install -g vibe-diagnosis
```

또는 npx로 바로 사용:

```bash
npx vibe-diag --help
```

### 2. 프로젝트에 적용

```bash
cd your-project
npx vibe-diag init
```

이 명령어는 프로젝트에 `.vibe-diagnosis/` 디렉토리를 생성합니다:

```
.vibe-diagnosis/
├── config.json
├── diagnostics/
│   └── example.diag.js      ← 여기에 진단 코드 작성
└── error-patterns/
    └── ERR_000_template.md   ← 에러 패턴 기록용
```

### 3. 진단 작성

`diagnostics/` 폴더에 `.diag.js` 파일을 생성합니다:

```js
module.exports = {
  id: 'task-001-user-login',
  name: 'User Login Flow',
  layer: 'TASK',
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

### 4. 실행

```bash
npx vibe-diag run
```

출력 예시:

```
  Vibe Diagnosis v1.0.0 — my-project
  ─────────────────────────────────────────

  TASK │ task-001-user-login       │ ✅ OK      │ Login flow verified
  FUNC │ func-auth-token           │ ✅ OK      │ JWT validation passed
  SYS  │ sys-database              │ ⚠️ WARNING │ Connection pool at 80%

  ─────────────────────────────────────────
  Total: 3 nodes │ OK: 2 │ WARN: 1 │ ERR: 0
  Overall: ⚠️ WARNING — Health 67%
```

---

## CLI 명령어

| 명령어 | 설명 |
|---|---|
| `vibe-diag init` | 현재 프로젝트에 `.vibe-diagnosis/` 초기화 |
| `vibe-diag run` | 모든 진단 실행 + 터미널 컬러 출력 |
| `vibe-diag run --json` | JSON 포맷 출력 (CI/CD 연동) |
| `vibe-diag run --cwd <path>` | 지정 경로에서 진단 실행 |

---

## 진단 파일 스펙 (`.diag.js`)

```js
module.exports = {
  id: 'unique-diagnostic-id',     // 고유 식별자 (필수)
  name: 'Human Readable Name',    // 표시 이름 (필수)
  layer: 'TASK',                  // TASK | FUNCTION | SYSTEM (필수)
  linkedTask: 'TASK-001',         // 연결된 작업 ID (선택)

  async run(ctx) {                // 진단 실행 함수 (필수)
    // ctx.projectDir — 프로젝트 루트 경로

    return {
      status: 'OK',               // OK | WARNING | ERROR
      details: 'Description',     // 사람이 읽을 수 있는 설명
    };
  }
};
```

---

## 에러 패턴 기록

에이전트가 작업 중 반복되는 에러를 발견하면, `.vibe-diagnosis/error-patterns/`에 기록합니다:

```
.vibe-diagnosis/error-patterns/
└── ERR_001_division_nan.md
```

이 로그는 이후 세션에서 같은 실수를 반복하지 않도록 참조됩니다.

---

## 예제: Calculator

`examples/calculator/` 디렉토리에서 즉시 동작하는 예제를 확인할 수 있습니다:

```bash
npx vibe-diag run --cwd examples/calculator
```

---

## 릴리즈 모드

프로젝트를 릴리즈할 때는 `.vibe-diagnosis/` 디렉토리를 제거하거나 `.gitignore`에 추가합니다.
진단 코드는 개발/디버그 단계의 도구이며, 프로덕션 빌드에 포함되어서는 안 됩니다.

```gitignore
.vibe-diagnosis/
```

---

## 🤖 MCP 서버 — AI 에이전트 연동

AI 에이전트가 코딩 중 **자동으로** 진단을 실행하고, 에러 패턴을 참조할 수 있습니다.

```bash
npm install -g vibe-diagnosis-mcp
```

### MCP 도구 목록

| 도구 | 설명 |
|---|---|
| `run_diagnostics` | 프로젝트 진단 실행 → JSON 결과 반환 |
| `init_diagnostics` | .vibe-diagnosis/ 초기화 |
| `list_diagnostics` | 진단 파일 목록 + 메타데이터 조회 |
| `read_error_pattern` | 과거 에러 패턴 로그 읽기 |
| `write_error_pattern` | 새 에러 패턴 기록 |

### Gemini (Antigravity 2.0)

`.gemini/settings.json`:
```json
{
  "mcpServers": {
    "vibe-diagnosis": {
      "command": "npx",
      "args": ["vibe-diagnosis-mcp"]
    }
  }
}
```

### Claude Desktop

`claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "vibe-diagnosis": {
      "command": "npx",
      "args": ["vibe-diagnosis-mcp"]
    }
  }
}
```

### Cursor

`.cursor/mcp.json`:
```json
{
  "mcpServers": {
    "vibe-diagnosis": {
      "command": "npx",
      "args": ["vibe-diagnosis-mcp"]
    }
  }
}
```

### Windsurf

`~/.codeium/windsurf/mcp_config.json`:
```json
{
  "mcpServers": {
    "vibe-diagnosis": {
      "command": "npx",
      "args": ["vibe-diagnosis-mcp"]
    }
  }
}
```

---

## 🧩 VS Code 확장

GitHub Releases에서 `.vsix` 파일을 다운로드하여 설치:

1. VS Code에서 `Ctrl+Shift+P` → "Install from VSIX..."
2. `vibe-diagnosis-vscode-1.0.0.vsix` 선택

**기능:**
- Status Bar에 건강도 퍼센트 표시
- `Ctrl+Shift+P` → "Vibe Diagnosis: Run" 으로 진단 실행
- Problems Panel에 ERROR/WARNING 연동

---

## 🔄 에이전트 자동화

AI 에이전트가 **알아서** 진단을 실행하게 하려면, 프로젝트의 `.agents/AGENTS.md` 또는 `CLAUDE.md`에 추가:

```markdown
## Vibe Diagnosis Rules
- Task 완료 후 반드시 `run_diagnostics` MCP 도구로 검증할 것
- 에러 패턴 발견 시 `write_error_pattern`으로 기록할 것
- 새 Task에 대응하는 .diag.js 파일을 함께 생성할 것
```

이렇게 하면 **MCP 등록 → init → 바이브 코딩** — 에이전트가 자동으로 진단 루프를 돕니다.

---

## 💬 Quick Triggers — 한국어 / English

MCP가 설치된 상태에서 AI에게 짧게 말하면 자동으로 실행됩니다:

### 🇰🇷 한국어

| 말하기 | 실행되는 MCP 도구 |
|---|---|
| "자가진단 MCP 적용해줘" | `init_diagnostics` → 초기화 + 진단 생성 + 대시보드 |
| "자가진단 실행해줘" | `run_diagnostics` → 전체 진단 실행 |
| "자가진단 대시보드 열어줘" | `open_dashboard` → 브라우저에서 대시보드 |
| "진단 돌려줘" | `run_diagnostics` → 결과 요약 |

### 🇺🇸 English

| Say this | MCP Tool |
|---|---|
| "Apply vibe-diagnosis to this project" | `init_diagnostics` → init + generate diagnostics + dashboard |
| "Run diagnostics" | `run_diagnostics` → run all checks |
| "Open diagnosis dashboard" | `open_dashboard` → browser dashboard |
| "Write error pattern" | `write_error_pattern` → log error pattern |

### Example Workflow

```
You: "자가진단 MCP 적용해줘"     (or: "Apply vibe-diagnosis to this project")
 AI: → init_diagnostics          ← .vibe-diagnosis/ created
 AI: → generates .diag.js files  ← diagnostics for existing code
 AI: → open_dashboard            ← browser opens http://localhost:7700
 AI: → run_diagnostics           ← Health 100% ✅
```

---

## License

MIT
