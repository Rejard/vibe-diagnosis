# Vibe Diagnosis

AI 보조 코딩을 위한 증거 우선 자가진단 및 승인 기반 자가수리 도구입니다.

[English README](./README.md)

Vibe Diagnosis는 코딩 에이전트가 작업 완료를 보고하기 전에 실제 동작을 기계적으로 증명하게 합니다. 프로젝트에 가벼운 `.diag.js` 진단을 작성하면 각 진단을 격리 실행하고, 구조화된 증거를 보존하며, 배포·운영 차단 여부를 판정하고, 현재 작업공간에 결합된 완료 영수증을 발급합니다.

버전: **1.6.2**

## 1.6.2 추가 기능

- 수리 계획 체크섬이 위험 등급, 고위험 승인 조건, 회귀 기준, 검증 방식, 진단 조작 판정까지 봉인하며 수리 적용과 검증은 프로젝트 실행 잠금을 함께 사용합니다.
- 구버전 프로젝트에도 `byok.local.json`과 런타임 파일의 Git 제외 규칙을 빠짐없이 추가합니다. Gemini 키는 헤더로 전달하고 공급자 요청에 제한시간과 응답 크기 제한을 적용합니다.
- 완료 지문이 `.env`, 자격증명, 개인키, BYOK 설정 등 Git ignored 보호 파일 변경도 감지합니다. 집중 진단은 마지막 완료 영수증을 덮어쓰지 않습니다.
- 명시적인 배포·라이브 차단 플래그를 권위 있게 적용하고 실패·경고·오래된 라이브 증거가 `VERIFIED`로 표시되지 않게 합니다.
- 한국어·영문 구버전 에이전트 규칙을 승인 우선·대시보드 선택형 최신 계약으로 교체합니다.
- CLI 진단은 대시보드와 독립적으로 실행되며, 대시보드 재사용 전 인증된 프로젝트 health 응답을 확인합니다.

## 1.6.1 프로젝트 실행 잠금

- 정규화된 프로젝트 경로마다 진단을 한 번만 실행하며 대시보드, MCP, CLI, 별도 Node 프로세스가 같은 잠금을 사용합니다.
- 중복 요청은 기존 실행을 기다리거나 합류하지 않고 `DIAGNOSTICS_ALREADY_RUNNING` 코드로 즉시 충돌 응답을 반환합니다.
- 대시보드 중복 요청은 HTTP `409`를 반환하며 가능한 경우 현재 실행의 안전한 `startedAt`도 제공합니다.
- 잠금 파일은 프로젝트 내부가 아닌 운영체제 임시 디렉터리에 저장되므로 대상 Git 작업공간을 dirty 상태로 만들지 않습니다.
- 원자적 잠금 생성으로 경쟁 조건을 막습니다. 살아 있는 PID의 잠금은 절대 덮어쓰지 않고, 종료된 PID의 잠금과 충분히 오래된 잘못된 잠금만 별도 이름으로 원자 이동한 뒤 회수합니다.
- 소유 토큰을 확인하므로 각 실행은 정상 완료, 진단 실패, 예외 발생 후 `finally`에서 자신의 잠금만 해제합니다.
- 서로 다른 프로젝트는 SHA-256 잠금 키가 달라 동시에 실행할 수 있습니다.

## 1.6 진단 기반 기능

- 진단별 독립 작업 디렉터리·환경·모듈 캐시를 사용하는 격리 실행기
- 종료 코드, 시그널, 제한 시간, stdout, stderr, 실행 시간, 재시도 기록을 포함한 구조화된 실행 증거
- `CONTRACT_ERROR`, `TEST_FAILURE`, `RUNNER_ERROR`, `TIMEOUT`, `FLAKY` 실패 분류
- 심각도, 범위, 증거 유형, 신뢰도, 의존성, 변경 파일, 배포·실운영 차단 여부 메타데이터
- 단순 통과율과 분리된 증거 커버리지, `RELEASE_BLOCKED`, `LIVE_BLOCKED` 판정
- `STATIC`, `TEST`, `RUNTIME`, `DATA`, `PROVIDER`, `AUTHORITY`, `UI`, `LIVE_EVIDENCE` 증거 구분
- Git·환경 지문, 기준선 비교, 변경 연계, 근본 원인 그룹화
- ID, 태그, 범위, 심각도별 선택 실행과 명시적으로 허용된 정적·테스트 진단 캐시
- export, route, API, 상태 전이, 렌더링 구조를 검사하는 의미 기반 assertion과 취약한 문자열 검사 경고
- 대시보드 없이 실행되는 필수 작업 완료 게이트와 재검증 가능한 완료 영수증
- 위험도, diff, 체크섬 승인, 적용 후 전체 검증, 회귀 시 롤백을 포함한 안전수리
- OpenAI, Anthropic, Google Gemini, OpenRouter를 사용자가 직접 연결하는 BYOK 수리 계획
- `127.0.0.1`에만 바인딩되고 프로젝트별 포트·토큰을 사용하는 선택형 로컬 대시보드

기존 `OK`, `WARNING`, `ERROR` 형식의 `.diag.js`는 마이그레이션 없이 계속 실행됩니다. 선언하지 않은 증거나 게이트는 추측하지 않고 `NOT_EVALUATED`로 보고합니다.

## 패키지 구성

| 패키지 | 역할 | 요구 사항 |
|---|---|---|
| `vibe-diagnosis` | CLI, 진단 실행기, 대시보드, 수리 엔진 | Node.js 18 이상 |
| `vibe-diagnosis-mcp` | 코딩 에이전트가 사용하는 MCP 서버 | Node.js 20 이상 |
| `vibe-diagnosis-vscode` | VS Code 명령, 상태 표시, Problems 연동, 검토형 수리 UI | VS Code 1.80 이상, Node.js 18 이상 |

## CLI 빠른 시작

```bash
npx -y vibe-diagnosis@1.6.2 init
npx -y vibe-diagnosis@1.6.2 run --json
npx -y vibe-diagnosis@1.6.2 complete
```

초기화하면 `.vibe-diagnosis/`, 예제 진단, 지원되는 에이전트 규칙 파일의 Vibe Diagnosis 규칙 블록이 생성됩니다. 이 디렉터리에는 프로젝트 진단과 로컬 실행 증거, 수리 계획, 선택적 BYOK 정보가 저장됩니다. 진단은 추적할 수 있게 유지하고 런타임·비밀정보 경로만 `.gitignore`에 추가합니다.

진단 파일은 실행 프로세스의 권한으로 동작하는 신뢰 대상 프로젝트 코드입니다. 외부에서 받은 진단은 실행 전에 검토해야 합니다. 1.6.2에서 수리 계획 무결성 범위가 강화되었으므로 이전 버전에서 생성된 승인 대기 계획은 다시 생성해야 합니다.

대시보드는 필수가 아니며 요청할 때만 실행됩니다.

```bash
npx -y vibe-diagnosis@1.6.2 dashboard
npx -y vibe-diagnosis@1.6.2 stop
```

## MCP 설정

사용 중인 코딩 에이전트의 MCP 설정에 다음 서버를 추가합니다.

```json
{
  "mcpServers": {
    "vibe-diagnosis": {
      "command": "npx",
      "args": ["-y", "vibe-diagnosis-mcp@1.6.2"]
    }
  }
}
```

macOS, Linux, WSL의 Claude Code:

```bash
claude mcp add vibe-diagnosis --scope local -- npx -y vibe-diagnosis-mcp@1.6.2
```

Windows의 Claude Code:

```powershell
claude mcp add vibe-diagnosis --scope local -- cmd /c npx -y vibe-diagnosis-mcp@1.6.2
```

주요 설정 위치:

| 클라이언트 | 위치 |
|---|---|
| Claude Code | `claude mcp add`로 로컬 등록, 프로젝트 공유 설정은 `.mcp.json` |
| Claude Desktop | `%APPDATA%/Claude/claude_desktop_config.json` |
| Cursor | `.cursor/mcp.json` |
| Windsurf | `~/.codeium/windsurf/mcp_config.json` |
| Gemini / Antigravity | 프로젝트 `.gemini/settings.json` 또는 해당 클라이언트의 MCP 설정 |

## 에이전트 작업 흐름

에이전트에는 다음처럼 한 번만 지시하면 됩니다.

```bash
이 작업에 Vibe Diagnosis를 사용해. 구현 전에 프로젝트 진단을 확인하거나 초기화하고, 작업 중 핵심 요구사항 진단을 최신 상태로 유지해. 완료를 보고하기 직전에 complete_task_diagnostics를 호출하고 completion.eligible=true와 현재 작업공간의 완료 영수증을 확인해. 내가 요청하지 않으면 대시보드는 열지 마. 실패하면 먼저 수리 계획과 diff를 보여주고, 내 명시적 승인과 필요한 고위험 승인을 받기 전에는 적용하지 마.
```

권장 순서:

1. 새 프로젝트는 `init_diagnostics`, 초기화된 프로젝트는 `list_diagnostics`로 시작합니다.
2. 작업의 실제 성공 조건을 표현하는 진단을 추가하거나 갱신합니다.
3. 구현 중에는 `run_diagnostics`로 필요한 범위를 반복 검사합니다.
4. 완료 보고 직전에 `complete_task_diagnostics`로 전체 진단을 캐시와 대시보드 없이 실행합니다.
5. `completion.eligible`이 `true`일 때만 완료로 판단하고, 작업공간이 바뀌었을 수 있으면 `verify_completion_receipt`로 다시 확인합니다.

`run_diagnostics`는 기본적으로 대시보드를 실행하지 않습니다. 화면 확인이 필요할 때만 `open_dashboard`를 명시적으로 사용합니다.

## 진단 작성 예제

`.vibe-diagnosis/diagnostics/example.diag.js`:

```js
module.exports = {
  id: 'example-behavior',
  name: 'Example behavior',
  layer: 'TASK',
  severity: 'HIGH',
  scope: 'RELEASE',
  evidenceType: 'TEST',
  blocksRelease: true,
  blocksLiveTrading: false,
  confidence: 1,
  tags: ['example'],
  dependencies: [],
  files: ['src/example.js'],
  cache: false,

  async run(ctx) {
    const verified = true; // 실제 실행 가능한 검증으로 교체합니다.
    return verified
      ? {
          status: 'OK',
          details: '예제 동작을 실행해 확인했습니다.',
          evidence: [{
            type: 'TEST',
            summary: '실행 가능한 동작 검사가 통과했습니다.',
            verifiedAt: new Date().toISOString(),
          }],
        }
      : { status: 'ERROR', classification: 'TEST_FAILURE', details: '예제 동작이 실패했습니다.' };
  },
};
```

정확한 문구 포함 여부보다 실제 동작, AST, route, API, 상태 전이, UI, 공급자 응답, 인증된 운영 증거를 우선합니다.

## CLI 명령

```bash
vibe-diag init
vibe-diag run [--json] [--ids a,b] [--tags security] [--scope RELEASE] [--severity HIGH] [--cache]
vibe-diag complete
vibe-diag dashboard [--port 8080]
vibe-diag stop
vibe-diag audit
vibe-diag repair <diagId>
vibe-diag repair --all
vibe-diag apply-repair <planId> --approve --checksum <sha256> [--approve-high-risk]
vibe-diag config get
vibe-diag config set <provider|model|apiKey> <value>
```

다른 프로젝트를 대상으로 할 때는 `--cwd <경로>`를 사용합니다.

## MCP 도구 묶음

- 진단: `init_diagnostics`, `list_diagnostics`, `run_diagnostics`, `audit_diagnostics`
- 완료 검증: `complete_task_diagnostics`, `verify_completion_receipt`
- 수리: `repair_diagnostic`, `heal_all`, `plan_repair`, `apply_repair_plan`, `list_repair_incidents`, `repair_omission`
- 프로젝트 검사: `check_symbol_diff`, `recommend_cartridge_split`, `verify_build_safety`
- 에이전트 컨텍스트: `sync_ai_context`, `sync_agent_rules`
- 오류 지식: `read_error_pattern`, `write_error_pattern`
- 대시보드: `open_dashboard`, `stop_dashboard`

계획 도구는 프로젝트 파일을 변경하지 않습니다. `apply_repair_plan`은 검토한 계획의 체크섬이 필요하며 인증, 데이터, 자격증명, 의존성, 런타임 설정, 거래 로직과 같은 고위험 대상은 별도 승인을 요구합니다.

## BYOK와 로컬 보안

가능하면 환경 변수를 사용합니다.

```powershell
$env:VIBE_DIAG_PROVIDER='anthropic'
$env:VIBE_DIAG_MODEL='사용할-모델명'
$env:VIBE_DIAG_API_KEY='사용자-API-키'
```

로컬 설정으로 입력한 키는 공유 설정이 아니라 Git에서 제외되는 `.vibe-diagnosis/byok.local.json`에 저장됩니다. 공용 PC에서는 셸 기록에 남을 수 있으므로 API 키를 명령 인수에 직접 넣지 마세요.

진단·수리 출력은 일반적인 Bearer 토큰, JWT, 자격증명이 포함된 데이터베이스 URL, 개인키, 민감한 객체 필드를 마스킹합니다. 수리 대상은 프로젝트 내부로 제한되며 보호된 비밀 파일은 거부됩니다.

## 개발 검증

```bash
npm test
npm run test:rollback
npm run test:packed
```

## 라이선스

[Apache License 2.0](./LICENSE)
