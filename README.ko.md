# 🩺 vibe-diagnosis

AI 코딩 프로젝트를 위한 자가진단 및 자가치유 프레임워크입니다. 프로젝트 옆에 가벼운 검사 파일(`.diag.js`)을 두고, 검사를 실행한 뒤 로컬 웹 대시보드에서 결과를 봅니다.

[English README](./README.md)

> 현재 버전: CLI, MCP 서버, VS Code 확장 모두 **1.2.7** (대대적 고도화 패키지)

---

## 🎯 왜 vibe-diagnosis(자가진단)가 필요할까요?

**"바이브 코딩(Vibe Coding)에 날카로운 안전망과 객관성을 불어넣으세요."**

AI 에이전트(Cursor, Windsurf, Gemini 등)는 매우 빠른 속도로 코드를 쏟아내지만, 한편으로는 **오버클레임(말만 번지르르하게 완벽하다고 뻥치는 현상)**과 **환각(Hallucination)**에 취약합니다. 

`vibe-diagnosis`는 에이전트가 코드를 짜기 전에 **"네가 구현할 기능이 진짜로 작동하는지 기계적인 진단 스크립트(`.diag.js`)를 먼저 짜서 스스로 증명해라"**라고 통제하는 강력한 TDD(테스트 주도 개발) 규격입니다. 이를 통해 바이브 코딩의 폭발적인 속도는 그대로 유지하면서, 예기치 못한 전체 빌드 붕괴와 회귀 버그를 완벽하게 방어할 수 있습니다.

---

## 📋 에이전트 협업 시나리오별 지시 템플릿 (복사 전용)

AI 에이전트와 대화를 시작할 때, 상황에 맞는 프롬프트를 복사하여 보내기만 하면 에이전트가 알아서 철저하게 자가진단 파이프라인 안에서 움직입니다.

### 시나리오 A. 🆕 새로운 프로젝트/기능을 처음 설계하여 제작할 때 (TDD 방식)
> "새로운 [기능/게임 이름]을 구현해줘. 단, 코드를 짜기 전에 Vibe Diagnosis(자가진단)를 초기화하고, 이 기능의 핵심 성공 여부를 검증할 수 있는 `.diag.js` 검사를 먼저 만들어서 실패(FAIL)하는 것을 보여줘. 그 다음 실제 코드를 한 조각씩 완성해가며 수시로 진단을 실행해줘."

### 시나리오 B. 🔄 기존 프로젝트에 중간 합류하거나 작업을 이어서 할 때
> "이 프로젝트에 자가진단을 먼저 실행(`run_diagnostics`)해줘. 기존에 만들어져 있는 기능들이 현재 무결하게 정상 작동(OK)하는지 먼저 베이스라인을 검증한 뒤, 다음 작업을 시작해줘."

### 시나리오 C. 💥 예상치 못한 버그를 발견하여 수리가 필요할 때
> "현재 실패(FAIL)하는 진단을 자가치유(`heal_all` 또는 `repair_diagnostic`) 도구를 사용해 스스로 해결해줘. 수리가 완료되면 다시 전체 진단을 실행해서 대시보드를 열어줘."

---

## 🔒 3대 AI 코딩 에이전트 전역 규칙 자동 연동

프로젝트를 새로 시작할 때, 루트에 아래 중 본인이 사용하는 AI 도구에 맞는 규칙 파일을 생성하고 다음 내용을 채워두세요. 에이전트에게 매번 "자가진단을 돌려라"라고 잔소리할 필요 없이, **AI 에이전트가 스스로 프로젝트를 분석할 때 이 룰을 읽고 자동으로 선제 실행**하게 됩니다.

* **Gemini / Antigravity**: `.agents/AGENTS.md`
* **Cursor**: `.cursorrules`
* **Windsurf**: `.windsurfrules`

### 📝 규칙 파일에 복사해 넣을 내용:
```markdown
## Vibe Diagnosis 규칙 (자가진단 가이드라인)
- 새로운 기능 구현이나 수정이 필요할 때는, 코드를 짜기 전에 해당 기능을 검증할 수 있는 `.diag.js` 진단 파일을 `.vibe-diagnosis/diagnostics/` 폴더에 항상 먼저 생성하거나 수정할 것 (TDD 방식).
- 작업 중간 혹은 완료 단계에서 run_diagnostics를 실행하여 기능이 완벽히 정상 작동하는지 스스로 검증할 것.
- 진단 과정에서 실패(FAIL)하는 검사가 발생하면 repair_diagnostic 또는 heal_all 도구로 자가 수리를 시도하여 문제를 해결할 것.
- 모든 작업이 마무리되면 반드시 open_dashboard를 호출하고 모든 검사가 통과(OK)했음을 확인한 뒤, 검증 결과 리포트를 사용자에게 제출할 것.
```

---

## 🚀 3단계로 빠르게 시작하기

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

---

## 📊 대시보드 실행 가이드

대시보드는 로컬 컴퓨터에서 구동되는 프라이빗 웹 서버입니다. MCP가 대시보드를 구동하지 못하는 상황이라면, 프로젝트 폴더에서 아래 명령을 통해 직접 실행할 수도 있습니다.

```bash
npx -y vibe-diagnosis dashboard --cwd <프로젝트 경로>
```

프로젝트 상태를 간편히 확인하고 싶을 때는 아래 문장을 복사해서 에이전트에게 요청하세요.

```bash
자가진단을 실행해줘. 먼저 open_dashboard를 호출해 대시보드 서버를 실행하고, 내가 열 수 있는지 확인한 뒤 로컬 주소를 알려줘.
```

---

## 🛠️ CLI 명령어 모음

터미널이나 CI/CD 파이프라인 환경에서는 아래 명령어를 사용합니다.

```bash
npx -y vibe-diagnosis init                  # .vibe-diagnosis/ 환경 생성
npx -y vibe-diagnosis run                   # 모든 검사 실행 및 대시보드 자동 가동
npx -y vibe-diagnosis run --json            # CI용 정형화된 JSON 출력
npx -y vibe-diagnosis dashboard             # 대시보드 전용 서버 가동
npx -y vibe-diagnosis repair <diagnosticId> # 실패한 검사 하나 수리
npx -y vibe-diagnosis repair --all          # 실패한 검사 전체 수리
npx -y vibe-diagnosis heal                  # 가능한 치유 단계 전체 자동 실행
```

---

## 📁 진단 파일(`.diag.js`) 규격

`init`을 실행하면 `.vibe-diagnosis/diagnostics/`에 예제 검사 파일이 만들어집니다. 검증하려는 비즈니스 요구사항에 맞춰 자유롭게 작성하세요.

```js
module.exports = {
  id: 'homepage-loads',
  name: '홈페이지 열림 확인',
  layer: 'TASK', // TASK, FUNCTION, SYSTEM 중 하나

  async run() {
    const homepageLoads = true; // 실제 검증 코드로 대체하세요 (예: axios 호출 등)

    return homepageLoads
      ? { status: 'OK', details: '홈페이지가 열립니다' }
      : { status: 'ERROR', details: '홈페이지가 열리지 않습니다' };
  },
};
```

* **필수 조건**: 모든 진단 모듈은 `id`, `name`, `layer`, `run` 속성이 필요합니다.
* **반환 상태**: `run()` 함수는 반드시 `{ status: 'OK' | 'WARNING' | 'ERROR', details: string }` 구조를 반환해야 합니다.

---

## 🤖 AI 자가치유 (BYOK) 설정

대시보드를 연 뒤 환경설정에서 API 제공자, API 키, 모델을 안전하게 입력해 두시면 AI 수리 기능(BYOK)을 가동할 수 있습니다.
키는 로컬 파일 `.vibe-diagnosis/config.json`에 암호화 보관되며, `init` 호출 시 자동으로 `.gitignore`에 등록되므로 유출 우려가 없습니다.

환경변수로 직접 주입하여 우선권을 지정할 수도 있습니다:

```bash
VIBE_DIAG_PROVIDER=openai
VIBE_DIAG_API_KEY=your-key
VIBE_DIAG_MODEL=gpt-4o
```

---

## 📦 MCP 도구 일람

| 도구 이름 | 상세 용도 |
|---|---|
| `init_diagnostics` | 진단 폴더 구조 및 예제 템플릿 생성 (프로젝트 시작 시 최우선 필수 실행) |
| `list_diagnostics` | 프로젝트에 작성된 모든 .diag.js 목록 조회 (작업 개시 전 필수 실행) |
| `run_diagnostics` | 전체 진단 실행 및 대시보드 자동 연동 (작업 완료 시 필수 실행) |
| `open_dashboard` | 로컬 대시보드 서버 기동 및 브라우저 열기 |
| `repair_diagnostic` | 실패한 검사 한 개를 분석 및 AI 자동 수리 시도 |
| `heal_all` | 실패한 모든 진단을 순차적으로 일괄 수리 및 치료 |
| `read_error_pattern` | 자주 발생하는 에러 패턴 지식 정보 조회 |
| `write_error_pattern` | 신규 또는 반복 오류에 대한 대응 패턴 마크다운 저장 |

---

## 🤝 라이선스

[Apache License 2.0](./LICENSE)
