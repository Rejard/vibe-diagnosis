# 🩺 vibe-diagnosis

AI 코딩 프로젝트를 위한 자가진단 및 자가치유 프레임워크입니다. 프로젝트 옆에 가벼운 검사 파일(`.diag.js`)을 두고, 검사를 실행한 뒤 로컬 웹 대시보드에서 정성/정량 성과지표와 에러 해결 타임라인을 실시간으로 확인합니다.

[English README](./README.md)

## 1.4.0 안전 치료 워크플로우

실패한 진단은 파일을 변경하기 전에 치료 계획으로 먼저 생성됩니다. 대시보드 또는 MCP에서 위험도, 변경 파일, Diff 미리보기를 검토한 뒤 명시적으로 승인해야 적용됩니다. 적용 후에는 전체 진단을 다시 실행하며, 목표 진단이 여전히 실패하거나 기존 OK 진단이 회귀하면 AI가 변경한 파일을 자동 롤백합니다. 계획 생성, 승인, 검증, 회귀, 롤백 이력은 로컬 `.vibe-diagnosis/repair-history.json`에 기록됩니다.

승인형 워크플로우는 `plan_repair` → `apply_repair_plan`을 사용합니다. 기존 `repair_diagnostic`, `heal_all`은 하위 호환용 자동 치료 도구로 유지됩니다.

| MCP 도구 | 용도 |
|---|---|
| `plan_repair` | 위험도와 Diff를 검토할 수 있는 치료 계획을 생성하며 파일은 변경하지 않음 |
| `apply_repair_plan` | 승인된 계획을 적용하고 전체 진단 검증 및 실패한 AI 변경 롤백 수행 |
| `list_incidents` | 치료 계획, 검증, 회귀, 롤백 로컬 이력 조회 |

> 🚀 **최신 버전: 1.3.3** (대시보드 서버 수동 종료 제어, .gitignore 전역 폴더 자동 격리 및 인터랙티브 SVG 차트 탑재)

---

## 🎯 왜 vibe-diagnosis(자가진단)가 필요할까요?

**"바이브 코딩(Vibe Coding)에 날카로운 안전망과 정량적 성과 지표를 부여하세요."**

AI 에이전트(Antigravity, Cursor, Windsurf 등)는 매우 빠른 속도로 코드를 작성하지만, 한편으로는 **오버클레임(말만 번지르르하게 하고 실제 빌드는 무너뜨리는 현상)**과 **환각(Hallucination)**에 취약합니다. 

`vibe-diagnosis`는 에이전트가 코드를 짜기 전에 **"기계적 진단 스크립트(`.diag.js`)를 먼저 생성하여 TDD 방식으로 요구사항을 스스로 증명해라"**라고 통제하는 강력한 안전 장치입니다. 1.3.0부터는 단순히 테스트 통과 여부를 넘어, **TDD 극복 시간 추적**, **반응형 UI 품질 등급(A~F)**, **에셋 오프라인 독립성 등급(GOLD 배지)**, **미사용 코드 부채 지수** 등을 대시보드 한복판에 미려한 SVG 그래프와 계기판으로 시각화하여, 개발 주기 단축 및 예방 효과를 화려한 실적으로 증명해 줍니다.

---

## 🧮 실시간 자가진단 예제 체험 (Live Example)

이 저장소에는 자가진단을 쉽고 간편하게 체험해 볼 수 있도록 사전 세팅된 `examples/calculator` 예제 프로젝트가 동봉되어 있습니다. 아래 명령어로 작동하는 진단 계기판의 실물을 즉각 경험해 보세요!

```bash
# 1. 저장소를 클론받고 의존성을 설치합니다.
git clone https://github.com/Rejard/vibe-diagnosis.git
cd vibe-diagnosis
npm install

# 2. 사전 정의된 계산기 단위 테스트 자가진단을 즉시 구동합니다!
npm run test:example
```

---

## 📋 에이전트 협업 시나리오별 지시 템플릿 (상황별 택1 복사)

> 💡 **주의**: 아래의 3가지 템플릿은 동시에 전부 복사하는 것이 아닙니다! 현재 개발 흐름상 본인에게 딱 맞는 **단 1개의 템플릿만 마우스로 편하게 긁어서** AI 에이전트 채팅창에 던지세요.

### 🆕 [시나리오 A] 새로운 기능 구현을 처음 시작할 때 (TDD 안전 가동)
```text
{새로운 프로젝트 내용} 구현해줘. 단, 코드를 짜기 전에 Vibe-Diagnosis(자가진단) 도구를 초기화(init_diagnostics)하고, 해당 기능의 핵심 성공 여부를 기계적으로 검증할 수 있는 `.diag.js` 검사 스크립트를 먼저 만들어서 실패(FAIL)하는 상태를 보여줘. 그 다음 실제 코드를 구현해가며 자가진단을 수시로 구동하고, 최종 통과(OK)하면 대시보드(open_dashboard)를 띄워줘.
```

### 🔍 [시나리오 B] 기존 코드가 망가지지 않았는지 미리 확인하고 싶을 때 (사전 상태 점검)
```text
이 프로젝트에 자가진단을 먼저 실행(run_diagnostics)해줘. 기존에 구현되어 있는 기능들이 현재 무결하게 정상 작동하는지 베이스라인을 검증한 뒤, 대시보드 주소를 안내하고 다음 작업을 이어서 시작해줘.
```

### 🔧 [시나리오 C] 실패(FAIL) 에러가 발생해 AI가 스스로 고쳐놓게 만들고 싶을 때 (자가 치유 수리)
```text
현재 실패(FAIL)하는 진단이 있다면, AI 자가치유(heal_all) 도구를 사용해 스스로 코드를 수정하고 완전 통과 상태로 치료해줘. 통과가 완료되면 대시보드 타임라인 그래프와 빌드 신뢰 지수(Predictor Score)를 갱신해줘.
```

---

## 🔒 AI 코딩 에이전트 전역 규칙 가이드

루트에 본인이 사용하는 AI 코더에 맞는 규칙 파일을 생성하고 다음 코드 블록의 내용을 통째로 복사해서 넣으세요. 에이전트가 매번 잔소리를 듣지 않고도 자동으로 자가진단을 우선 실행하게 만드는 장치입니다.

* **Antigravity / Gemini**: `.agents/AGENTS.md`
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

## 🚀 3단계로 빠르게 시작하기 (MCP 방식)

AI 코딩 에이전트의 MCP 설정 파일에 아래 JSON 코드를 마우스로 긁어 추가한 후 재시작하세요.

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

### 📍 MCP 설정 파일 경로

| AI 에이전트 | 설정 파일 위치 |
|---|---|
| Gemini / Antigravity | 프로젝트 루트 `.gemini/settings.json` 또는 `~/.gemini/config/mcp_config.json` |
| Claude Desktop | `%APPDATA%/Claude/claude_desktop_config.json` |
| Cursor | `.cursor/mcp.json` |
| Windsurf | `~/.codeium/windsurf/mcp_config.json` |

---

## 📊 1.3.3 차세대 성과 대시보드 위젯 안내

대시보드(`http://localhost:7700`) 상단에는 AI 에이전트와 이룩한 개발 품질에 대한 '종합 신뢰 계기판'이 입체적으로 표시됩니다.

1. **📈 TDD Timeline Tracker**:
   - 최초 오류 시점(RED)부터 성공(GREEN)에 이르기까지 점진적으로 올라가는 자가진단 통과율 추이를 실시간 SVG 꺾은선 차트로 가시화합니다.
   - 버그를 몇 분 만에 완벽히 격파했는지 소요 시간(TDD Cycle)을 자동 요약해 줍니다.
   - **진단 블록 카드 클릭 연동 (v1.3.2 신규)**: 사용자가 대시보드에 전시된 특정 진단 카드(예: `task-001-runner` 등)를 마우스로 클릭하면, 차트(SVG)가 해당 카드 고유의 개별 이력만 정밀 필터링하여 '해당 테스트 룰만의 단독 성장 꺾은선(0% ➔ 50% ➔ 100%)'으로 우아하게 실시간 트랜지션(전환) 드로잉됩니다. 차트 타이틀바의 배지를 눌러 실시간 필터 해제도 가능합니다.
2. **🛡️ QC & Prevention Scoreboard (정적 코드 정밀 수치)**:
   - **Build Success Predictor**: 진단 통과율과 설정 파일 정교함을 측정해 **컴파일 안전도(%)**를 과학적으로 연산합니다.
   - **UI Layer Integrity (반응형 UI 등급)**: CSS 반응형 그리드 속성 비중을 분석하여 **A+ ~ F 등급**으로 판정합니다.
   - **Asset Independence**: 이미지/사운드의 로컬 패키징 및 Web Audio API 가동 감지 후 오프라인 완전 독립성 시 **GOLD 배지**를 수여합니다.
   - **Dead-Code Debt Index**: 선언만 되고 참조되지 않는 미사용 코드 부채 지수를 측정해 클린 코드 점수를 실시간 도출합니다.
3. **✍️ TDD Milestone Archive (v1.3.1 신규)**:
   - 대시보드 하단에 배치된 미려한 폼을 통해, 사용자가 직접 해당 TDD 사이클의 오류 비율과 소성 회고록을 영구 보관할 수 있습니다.
   - 프로젝트 루트의 `.vibe-diagnosis/milestones.json` 로컬 파일에 안전하게 세이브되어 새로고침 후에도 유지됩니다.
4. **🔒 Port Lock Cache (v1.3.1 신규)**:
   - 각 프로젝트 루트의 `.vibe-diagnosis/active_port.json` 파일을 포트 락으로 사용하여, 백그라운드 노드 프로세스가 중복 기동되는 리소스 누수를 원천 봉쇄합니다. 여러 프로젝트 창을 동시에 열고 바이브 코딩을 해도 상호 격리된 주소를 평화롭게 유지합니다.
5. **🛑 대시보드 서버 종료 제어 (v1.3.3 신규)**:
   - 더 이상 대시보드가 불필요하거나 메모리/포트 점유를 해제하고 싶을 때, 웹 대시보드 화면 내에서 한 번의 클릭 또는 터미널 명령어를 통해 백그라운드 서버 프로세스를 깔끔히 수동 정지시킬 수 있습니다.
   - **.gitignore 전역 폴더 자동 격리 (v1.3.3 신규)**: 자가진단 MCP 초기화(`init`) 실행 시, `.gitignore`에 자동으로 `.vibe-diagnosis/` 폴더 전체를 무시하도록 추가하여 나만의 테스트 소스나 로컬 임시 환경 정보가 깃허브에 우발적으로 공유되는 사고를 차단합니다.

---

## 🛠️ CLI 명령어 모음 (복사 전용)

한 줄씩 또는 통째로 긁어 터미널에 붙여넣고 즉시 구동하세요.

```bash
npx -y vibe-diagnosis init                  # 1. 자가진단 환경 초기화 (.diag.js 예제 생성)
npx -y vibe-diagnosis run                   # 2. 모든 검증 가동 및 대시보드 서버 실행
npx -y vibe-diagnosis dashboard             # 3. 대시보드 전용 웹뷰 서버 실행
npx -y vibe-diagnosis stop                  # 4. 백그라운드 대시보드 서버 정상 프로세스 종료
npx -y vibe-diagnosis heal                  # 5. 실패한 테스트 전체 AI 자동 자가치유 기동
```

---

## 📦 MCP 도구 일람

| 도구 이름 | 상세 용도 |
|---|---|
| `init_diagnostics` | 진단 폴더 구조 및 예제 템플릿 생성 (프로젝트 시작 시 최우선 필수 실행) |
| `list_diagnostics` | 프로젝트에 작성된 모든 .diag.js 목록 조회 (작업 개시 전 필수 실행) |
| `run_diagnostics` | 전체 진단 실행 및 대시보드 자동 연동 (작업 완료 시 필수 실행) |
| `open_dashboard` | 로컬 대시보드 서버 기동 및 브라우저 열기 |
| `stop_dashboard` | 실행 중인 대시보드 서버 프로세스를 강제 종료하고 포트 자원 반환 |
| `repair_diagnostic` | 실패한 검사 한 개를 분석 및 AI 자동 수리 시도 |
| `heal_all` | 실패한 모든 진단을 순차적으로 일괄 수리 및 치료 |
| `read_error_pattern` | 자주 발생하는 에러 패턴 지식 정보 조회 |
| `write_error_pattern` | 신규 또는 반복 오류에 대한 대응 패턴 마크다운 저장 |

---

## 🤝 라이선스

[Apache License 2.0](./LICENSE)
