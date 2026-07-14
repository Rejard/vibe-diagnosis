## Vibe Diagnosis 규칙 (자가진단 가이드라인)

- 새로운 기능 구현이나 수정이 필요할 때는, 코드를 짜기 전에 해당 기능을 검증할 수 있는 `.diag.js` 진단 파일을 `.vibe-diagnosis/diagnostics/` 폴더에 항상 먼저 생성하거나 수정할 것 (TDD 방식).
- 작업 중간 혹은 완료 단계에서 `run_diagnostics`를 실행하여 기능이 완벽히 정상 작동하는지 스스로 진증할 것.
- 진단 과정에서 실패(FAIL)하는 검사가 발생하면 `repair_diagnostic` 또는 `heal_all` 도구로 자가 수리를 시도하여 문제를 해결할 것.
- 모든 작업이 마무리되면 반드시 `open_dashboard`를 호출하고 모든 검사가 통과(OK)했음을 확인한 뒤, 검증 결과 리포트를 사용자에게 제출할 것.
