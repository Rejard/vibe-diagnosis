# Vibe Diagnosis (vibe-diagnosis)

[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/Rejard.vibe-diagnosis-vscode?style=flat-square&color=blue)](https://marketplace.visualstudio.com/items?itemName=Rejard.vibe-diagnosis-vscode)
[![Open VSX](https://img.shields.io/open-vsx/v/Rejard/vibe-diagnosis-vscode?style=flat-square&color=purple)](https://open-vsx.org/extension/Rejard/vibe-diagnosis-vscode)
[![License](https://img.shields.io/github/license/Rejard/vibe-diagnosis?style=flat-square&color=lightgray)](./LICENSE)

> **"Never write code without a safety net."**
> Bring the discipline of Test-Driven Development (TDD) directly into your AI-assisted "vibe coding" sessions. Keep your agent grounded, prevent regressions, and automatically self-heal bugs before you even notice them.

---

## 🚀 Key Features

* **AI Agent Self-Diagnosis & Validation**: Enforces AI coding assistants (Cursor, Windsurf, Gemini/Antigravity) to prove their code works through mechanical `.diag.js` scripts.
* **Vibrant Local Dashboard**: Visualize your project's diagnostics, error patterns, and health status in a beautiful browser dashboard (hosted on `http://localhost:7700`).
* **AI-Powered Self-Healing (BYOK)**: Supports OpenAI, Anthropic, Gemini, and OpenRouter. Let the AI diagnose failures and auto-repair them on the fly!
* **Command Palette Integration**: Easily initialize, run, and launch the dashboard directly from VS Code (`Ctrl+Shift+P`).
* **Active Status Bar Indicators**: Monitor your workspace's health at a glance.

---

## 🛠️ Step 1: Tell Your AI Agent to Start

When you open a project in VS Code, simply copy and paste the following prompt to your AI coding assistant (Cursor, Windsurf, Antigravity, etc.):

```text
Set up Vibe Diagnosis for this project. Initialize the folder, write relevant `.diag.js` validations for our features, run the diagnostics, and start the local dashboard.
```

If you are developing a specific feature (e.g., a Tetris game), keep the agent focused by mandating a quality baseline first:

```text
We are building a React-based Tetris game. First, initialize Vibe Diagnosis and write `.diag.js` tests to verify game board generation, block collision, and line clears. Make sure they fail first, then implement the game code step-by-step.
```

---

## ⚙️ Step 2: VS Code Command Palette

If your agent does not have terminal permissions, or if you want to operate Vibe Diagnosis manually, open the Command Palette (`Ctrl+Shift+P`) and use:

* 🩺 **Vibe Diagnosis: Init** — Creates `.vibe-diagnosis/` folder and a sample check.
* ▶️ **Vibe Diagnosis: Run** — Runs all project diagnostics and opens the problems panel.
* 📊 **Vibe Diagnosis: Open Dashboard** — Starts the local dashboard server and opens it in your default browser.
* ⚡ **Vibe Diagnosis: Auto Repair** — Triggers AI-assisted self-healing for any failing diagnostics.

---

## 🔒 Automated Workspace Quality Rules

For the ultimate seamless integration, Vibe Diagnosis now automatically creates rules configuration files for major AI tools inside your project. This guarantees that **any AI agent you use** will automatically know to run diagnostics before modifying any code.

Simply create one of these files in your workspace root, or let the extension handle it:
* **Antigravity / Gemini**: `.agents/AGENTS.md`
* **Cursor**: `.cursorrules`
* **Windsurf**: `.windsurfrules`

---

## 🌐 공식 한국어 가이드 (Official Korean Guide)

> **"안전망 없는 코딩은 이제 그만."**
> AI 에이전트와 협업하는 "바이브 코딩" 환경에 TDD(테스트 주도 개발)의 엄격함을 불어넣으세요. 에이전트의 호언장담(허풍)을 객관적으로 검증하고, 사용자가 버그를 발견하기도 전에 AI 스스로 오류를 진단하고 자동 치유(Self-Healing)합니다.

### 🌟 핵심 기능
1. **AI 에이전트 자가진단**: 코딩 에이전트가 코드를 작성하기 전에 기계적인 성공 기준(`.diag.js`)을 먼저 작성하도록 강제합니다.
2. **로컬 웹 대시보드**: 브라우저(`http://localhost:7700`)에서 프로젝트의 건강 상태와 에러 패턴을 한눈에 시각적으로 파악합니다.
3. **AI 자가치유 (BYOK)**: API 키(Gemini, OpenAI, Claude 등)를 연동하여 진단 실패 시 AI가 스스로 원인을 분석하고 코드를 수리하도록 합니다.
4. **VS Code 명령어 내장**: 명령 팔레트(`Ctrl+Shift+P`)에서 마우스 클릭 한 번으로 모든 진단을 제어합니다.

### 📋 에이전트 지시 프롬프트 템플릿 (복사해서 사용하세요)

#### 1. 일반적인 기능 추가 시 (TDD 스타일 강제)
```text
새로운 [기능 이름]을 구현해줘. 단, 코드를 짜기 전에 Vibe Diagnosis(자가진단)를 초기화하고, 이 기능의 성공 여부를 검증할 수 있는 `.diag.js` 검사를 먼저 만들어서 실패(FAIL)하는 것을 보여줘. 그 다음 실제 코드를 한 조각씩 완성해가며 수시로 진단을 실행해줘.
```

#### 2. 프로젝트 중간에 합류하거나 이어받을 때
```text
이 프로젝트에 자가진단을 먼저 실행(`run_diagnostics`)해줘. 기존에 뚫려 있는 기능들이 모두 정상 작동(OK)하는지 먼저 베이스라인을 검증한 뒤, 다음 작업을 이어서 시작해줘.
```

### ⚙️ VS Code 명령어 목록 (`Ctrl+Shift+P`)
* `Vibe Diagnosis: Init` — `.vibe-diagnosis/` 설정 폴더 및 샘플 진단서 생성
* `Vibe Diagnosis: Run` — 모든 자가진단 실행 및 에러 패널 연동
* `Vibe Diagnosis: Open Dashboard` — 로컬 대시보드 서버 실행 및 웹 브라우저 자동 오픈
* `Vibe Diagnosis: Auto Repair` — 실패한 검사를 AI가 스스로 분석하여 자가치유 실행

---

## 🤝 Contributing & Support

* **GitHub Repository**: [Rejard/vibe-diagnosis](https://github.com/Rejard/vibe-diagnosis)
* **NPM Packages**:
  * [CLI: vibe-diagnosis](https://www.npmjs.com/package/vibe-diagnosis)
  * [MCP: vibe-diagnosis-mcp](https://www.npmjs.com/package/vibe-diagnosis-mcp)

Developed with 💖 by **Rejard** to bring absolute trust to AI-assisted software development.
