# PATTERN_UI_BLOCK_OMISSION: 거대 단일 파일 UI/기능 누락 및 덮어쓰기

## 패턴 ID
`PATTERN_UI_BLOCK_OMISSION`

## 패턴 설명
AI 코드 교체(`replace_file_content`) 중 거대 단일 파일 내 기존 UI 카드/블록/기능 수식이 삭제되거나 덮어씌워지는 현상.
500줄이 넘어가는 monolithic UI 컴포넌트는 LLM 컨텍스트 환각이나 부분 교체 실수로 기존 UI 카드를 쉽게 누락시킵니다.

## 증상 (Symptoms)
- 코드 수정 후 기존 UI 카드, 모달, 탭 섹션, 수식 블록이 화면에서 일방적으로 상실됨.
- `replace_file_content` 실행 시 TargetContent 주변의 기존 코드 조각이 덮어씌워지거나 상실됨.

## 권장 복구/수리 방안 (Repair Recommendation)
1. **소형 카트리지 컴포넌트 분리 (Modularization)**:
   - 500줄 이상의 거대 UI 컴포넌트는 `components/cartridges/` 디렉터리의 소형 카트리지 컴포넌트(`*Card.jsx`, `*Section.jsx` 등)로 즉시 분리하고, 메인 컴포넌트는 조립(Assembly) 레이어로 리팩토링합니다.
2. **Line / Symbol Diff 검증**:
   - 코드 수정 전/후 `git diff`를 통해 의도하지 않은 라인/블록 상실 대조 검증을 수행합니다.
3. **자가진단 체크리스트 탑재**:
   - `vibe-diagnosis`의 `.diag.js` 진단 스크립트에 필수 UI 심볼 및 카트리지 무결성 체크리스트를 탑재하여 `run_diagnostics`로 지속 검증합니다.
