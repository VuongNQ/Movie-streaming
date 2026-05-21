---
description: "Generate or update Firestore Security Rules tests for Movie-streaming with required role matrix and denial coverage."
mode: ask
---

# Create Firestore Rules Tests

Generate a Firestore rules test suite for this repository using Firebase Emulator Suite.

## Inputs
- Changed policy or rule sections: ${input:policyChanges:Describe policy deltas or leave empty to infer from rules}
- Target test runtime: ${input:testRuntime:vitest|jest|kotlin|other}
- Scope: ${input:scope:movies|users|devices|all}

## Requirements
- Enforce guest, user, admin coverage for the selected scope.
- Include positive allow tests and negative deny tests.
- Assert permission-denied explicitly for denied operations.
- Cover ownership checks for users and devices paths.
- Include field-protection tests:
  - user cannot change role, uid, created_at
  - current_position_seconds must be >= 0
- Use deterministic test data and isolated fixtures.

## Expected Output
1. Test plan summary mapped to policy matrix.
2. Test file content ready to paste into repository.
3. Any helper setup files needed for emulator auth/data seeding.
4. A short command list to run tests locally and in CI.

## Guardrails
- Do not suggest production database tests.
- Keep test names policy-driven and explicit.
- If a policy is ambiguous, state assumptions clearly before generating code.
