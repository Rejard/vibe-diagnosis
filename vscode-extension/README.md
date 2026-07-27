# Vibe Diagnosis (vibe-diagnosis)

[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/Rejard.vibe-diagnosis-vscode?style=flat-square&color=blue)](https://marketplace.visualstudio.com/items?itemName=Rejard.vibe-diagnosis-vscode)
[![Open VSX](https://img.shields.io/open-vsx/v/Rejard/vibe-diagnosis-vscode?style=flat-square&color=purple)](https://open-vsx.org/extension/Rejard/vibe-diagnosis-vscode)
[![License](https://img.shields.io/github/license/Rejard/vibe-diagnosis?style=flat-square&color=lightgray)](./LICENSE)

> **"Never write code without a safety net."**
> Bring the discipline of Test-Driven Development (TDD) directly into your AI-assisted "vibe coding" sessions. Keep your agent grounded, prevent regressions, and automatically self-heal bugs before you even notice them.

---

## 🚀 Key Features (Version 1.5.1 Upgraded)

* **🚨 Adaptive Monolithic Component Omission Protection (v1.5.1 NEW)**: Scans UI files (`*.jsx`, `*.tsx`, `*.vue`) at 300+ lines and Backend files (`*.js`, `*.ts`, `*.py`) at 600+ lines to issue WARNINGs before AI rewrites. Includes Symbol Diff Tracking (`check_symbol_diff`), Cartridge Splitter Blueprints (`recommend_cartridge_split`), and Auto-Revert Repairs (`repair_omission`).
* **🧠 AI-Native Completeness & Session Handover (v1.5.0 NEW)**: Synchronizes AI task context and diagnostic state via `.vibe-diagnosis/active_context.json` for seamless handover between AI sessions (`sync_ai_context`). Includes background compilation verification (`verify_build_safety`) and automatic rule injection (`sync_agent_rules`).
* **AI Agent Self-Diagnosis**: Enforces AI coding assistants (Cursor, Windsurf, Gemini/Antigravity) to prove their code works through mechanical `.diag.js` scripts.
* **📈 TDD Timeline Tracker & Shutdown Controls**: Renders dynamic SVG charts showing the path from failure (RED) to success (GREEN). Includes interactive card-linking to filter SVG charts with smooth transitions, plus server shutdown controls.
* **🛡️ QC & Prevention Scoreboard & Isolation**: Renders overall Build Success Predictor, Responsive UI CSS viewport grades, Asset Independence, and Dead-Code Debt metrics with automated `.gitignore` isolation.
* **AI-Powered Self-Healing (BYOK)**: Supports OpenAI, Anthropic, Gemini, and OpenRouter. Let the AI diagnose failures and auto-repair them on the fly!
* **Command Palette Integration**: Easily initialize, run, and launch the dashboard directly from VS Code (`Ctrl+Shift+P`).
* **Active Status Bar Indicators**: Monitor your workspace's health at a glance.

---

## 🛠️ Step 1: Tell Your AI Agent to Start (Choose ONE)

> 💡 **Pick One**: Do not copy all prompts. Choose the **single template** below that matches your current goal.

### 🆕 [Scenario A] Initialize & Setup Diagnostics (First-time)
```text
Set up Vibe-Diagnosis for this project. Initialize the folder, write relevant `.diag.js` validations for our features, run the diagnostics, and start the local dashboard.
```

### 📈 [Scenario B] React / Web Feature Development (Strict TDD)
```text
We are building a React-based feature. First, initialize Vibe-Diagnosis and write `.diag.js` tests to verify core requirements. Make sure they fail first, then implement the code step-by-step.
```

---

## ⚙️ Step 2: VS Code Command Palette (`Ctrl+Shift+P`)

Use the following commands to control the framework directly:

* 🩺 **Vibe Diagnosis: Init** — Creates `.vibe-diagnosis/` folder and sample checks.
* ▶️ **Vibe Diagnosis: Run** — Runs all diagnostics and updates the active SVG timeline.
* 📊 **Vibe Diagnosis: Open Dashboard** — Launches the private browser dashboard.
* ⚡ **Vibe Diagnosis: Auto Repair** — Triggers AI self-healing repairs for failing tests.

---

## 🔒 Automated Workspace Quality Rules

The extension automatically creates workspace quality rules for major AI assistants inside your root folder.

* **Antigravity / Gemini**: `.agents/AGENTS.md`
* **Cursor**: `.cursorrules`
* **Windsurf**: `.windsurfrules`

---

## 🌐 공식 한국어 가이드 (Official Korean Guide)

> **"안전망 없는 코딩은 이제 그만."**
> AI 에이전트와 협업하는 "바이브 코딩" 환경에 TDD(테스트 주도 개발)의 엄격함을 불어넣으세요.
>
> 🚀 **v1.5.1 핵심 고도화**:
> 1. **거대 파일 가변 임계값 누락 방지(Adaptive Omission Protection)**: UI 파일 300줄 이상, 백엔드/로직 파일 600줄 이상 시 AI 수정 중 코드 상실 방지 경고(WARNING) 스캐너 탑재.
> 2. **심볼 Diff 감시기 (`check_symbol_diff`)**: AI 코드 변경 시 지워진 JSX UI 태그, Export 심볼, 수식 함수 정밀 추적.
> 3. **카트리지 모듈화 청사진 (`recommend_cartridge_split`)**: 거대 컴포넌트의 소형 카트리지 자동 분리 가이드 제공.
> 4. **AI 소스 코드 자동 원복 (`repair_omission`)**: 필수 UI 태그 상실 시 로컬 백업(.bak) 또는 git 스냅샷을 활용한 자동 원복.
> 5. **AI 세션 메모리 승계 (`sync_ai_context`)**: AI 목표 및 진단 메모리를 저장하여 대화 세션 교체 시 완벽 승계.
> 6. **백그라운드 빌드 자가검증 (`verify_build_safety`)**: AI 작업 종료 전 백그라운드 컴파일 실행으로 오류 0개 검증.

### 📋 에이전트 지시 프롬프트 템플릿 (상황별 택1 복사)

> 💡 **주의**: 두 템플릿을 동시에 복사하는 것이 아닙니다! 상황에 맞춰 **단 1개만 선택해서** 사용하세요.

#### 🆕 [상황 A] 처음부터 폴더를 세팅하고 TDD 진단을 켜고 싶을 때
```text
{새로운 프로젝트 내용} 구현해줘. 단, 코드를 짜기 전에 Vibe-Diagnosis(자가진단) 도구를 초기화(init_diagnostics)하고, 해당 기능의 핵심 성공 여부를 기계적으로 검증할 수 있는 `.diag.js` 검사 스크립트를 먼저 만들어서 실패(FAIL)하는 상태를 보여줘. 그 다음 실제 코드를 구현해가며 자가진단을 수시로 구동하고, 최종 통과(OK)하면 대시보드(open_dashboard)를 띄워줘.
```

#### 🔍 [상황 B] 이미 구성된 검사를 가볍게 돌리고 상태만 보고 싶을 때
```text
이 프로젝트에 자가진단을 먼저 실행(run_diagnostics)해줘. 기존에 구현되어 있는 기능들이 현재 무결하게 정상 작동하는지 베이스라인을 검증한 뒤, 대시보드 주소를 안내하고 다음 작업을 이어서 시작해줘.
```

### ⚙️ VS Code 명령어 목록 (`Ctrl+Shift+P`)
* `Vibe Diagnosis: Init` — `.vibe-diagnosis/` 설정 폴더 및 샘플 진단서 생성
* `Vibe Diagnosis: Run` — 모든 자가진단 실행 및 SVG 그래프 타임라인 갱신
* `Vibe Diagnosis: Open Dashboard` — 로컬 대시보드 서버 실행 및 웹 브라우저 자동 오픈
* `Vibe Diagnosis: Auto Repair` — 실패한 검사를 AI가 스스로 분석하여 자가치유 실행

---

## 🤝 Contributing & Support

* **GitHub Repository**: [Rejard/vibe-diagnosis](https://github.com/Rejard/vibe-diagnosis)
* **NPM Packages**:
  * [CLI: vibe-diagnosis](https://www.npmjs.com/package/vibe-diagnosis)
  * [MCP: vibe-diagnosis-mcp](https://www.npmjs.com/package/vibe-diagnosis-mcp)

Developed with 💖 by **Rejard** to bring absolute trust to AI-assisted software development.
