# Safe Repair Lab

This fixture begins with one real test failure and one healthy regression guard. `verify-rollback.cjs` applies an explicitly approved synthetic plan that fixes the target while breaking the guard. Vibe Diagnosis must detect the regression, roll back both files, and report `ROLLED_BACK`.
