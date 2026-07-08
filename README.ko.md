# 🩺 vibe-diagnosis

**바이브코딩 프로젝트를 위한 자가 진단 프레임워크**

AI 에이전트와 함께 코딩할 때, "지금 이 프로젝트가 정상인가?"를 코드로 증명합니다.

> **핵심 원칙 — Task ↔ Diagnostic 1:1 매핑**: 작업(Task)이 완료되면, 그 작업이 정상 동작함을 검증하는 진단(Diagnostic)이 반드시 함께 생성되어야 합니다.

[English README](./README.md)

---

## 🚀 빠른 시작 (MCP — 가장 쉬움)

AI 도구의 설정 파일에 아래 JSON을 추가하면 끝입니다.

### 1. MCP 설정 추가

아래 JSON을 AI 도구의 설정 파일에 추가하세요:

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

### 2. AI에게 말하기

> "자가진단 MCP 적용해줘"

끝. AI가 알아서 초기화하고, 진단 파일을 생성하고, 대시보드를 열어줍니다.

---

## 💬 빠른 트리거

MCP가 설치된 상태에서 AI에게 짧게 말하면 자동으로 실행됩니다:

| 말하기 | 실행 결과 |
|---|---|
| "자가진단 MCP 적용해줘" | `init_diagnostics` → 초기화 + 진단 생성 + 대시보드 |
| "자가진단 실행해줘" | `run_diagnostics` → 전체 진단 실행 |
| "자가진단 대시보드 열어줘" | `open_dashboard` → 브라우저에서 대시보드 |
| "진단 돌려줘" | `run_diagnostics` → 결과 요약 |

### 사용 흐름 예시

```
사용자: "자가진단 MCP 적용해줘"
   AI: → init_diagnostics          ← .vibe-diagnosis/ 생성
   AI: → .diag.js 파일 자동 생성    ← 기존 코드 분석
   AI: → open_dashboard            ← 브라우저에서 http://localhost:7700 열림
   AI: → run_diagnostics           ← Health 100% ✅
```

---

## 📦 CLI

```bash
npx vibe-diag init          # .vibe-diagnosis/ 초기화 + MCP 자동 설정
npx vibe-diag run           # 모든 진단 실행
npx vibe-diag run --json    # JSON 출력 (CI/CD용)
npx vibe-diag dashboard     # 웹 대시보드 열기
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
  Vibe Diagnosis v1.0.4 — my-project
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
npx vibe-diag dashboard            # http://localhost:7700
npx vibe-diag dashboard --port 8080
```

기능:
- Health 링 게이지 (건강도 퍼센트)
- 진단 카드 그리드 (레이어별 색상 구분)
- "Run Diagnostics" 원클릭 진단 버튼
- 에러 패턴 모달 뷰어
- 다크모드 프리미엄 UI

---

## 🧩 VS Code 확장

VS Code 확장 마켓플레이스에서 `vibe-diagnosis` 검색, 또는 `.vsix`로 설치:

1. `Ctrl+Shift+P` → "Install from VSIX..."
2. `vibe-diagnosis-vscode-1.0.1.vsix` 선택

**커맨드:**
- `Vibe Diagnosis: Run` — 진단 실행
- `Vibe Diagnosis: Init` — 프로젝트 초기화
- `Vibe Diagnosis: Open Dashboard` — 대시보드 열기
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

