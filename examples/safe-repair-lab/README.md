# Safe Repair Lab

Disposable validation fixture for Vibe Diagnosis 1.4.0. It begins with one deliberate failure (`repair-addition`) and one healthy regression guard.

## Dashboard success path

1. Start the dashboard for this fixture: `node ../../bin/vibe-diag.js dashboard --cwd .`
2. Configure BYOK in the dashboard.
3. Run diagnostics. `repair-addition` must be ERROR and `regression-guard` must remain OK.
4. Select **Plan Repair**, inspect the risk and Diff, then approve the plan.
5. Confirm the target becomes OK and Incident History records `PLAN_CREATED` and `REPAIR_APPLIED`.

## Deterministic rollback path

Run `node verify-rollback.cjs`. The fixture injects a deliberately bad AI plan that fixes the target but breaks the healthy guard. Expected result: `ROLLED_BACK`, a regression record, and the original files restored.
