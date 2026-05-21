---
description: "Run firestore-security-testgen with a pre-filled workflow for rules changes in Movie-streaming."
mode: ask
---

# Run Firestore Security Testgen (Preset)

Use the `firestore-security-testgen` skill with these defaults.

## Preset Inputs
- Changed rules/policies: ownership checks in `users/{uid}` and `users/{uid}/devices/{deviceId}`, plus non-admin field protection (`role`, `uid`, `created_at`).
- Target runtime: `vitest`
- Scope: `all`

## Task
Generate or update Firestore Security Rules tests that include:
- guest/user/admin allow and deny matrix;
- explicit `permission-denied` assertions for blocked operations;
- cross-user access denial for user and device paths;
- protected field immutability tests for non-admin;
- validation checks such as `current_position_seconds >= 0` when enforced.

## Expected Output
1. Test matrix summary.
2. Test file content ready for this repository.
3. Emulator fixture/setup helpers.
4. Commands to run locally and in CI.
5. Clear assumptions if any policy detail is ambiguous.
