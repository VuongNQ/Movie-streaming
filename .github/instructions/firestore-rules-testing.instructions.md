---
description: "Use when writing or updating Firestore Security Rules tests. Enforces emulator-based test coverage for role matrix, ownership checks, denied operations, and schema-sensitive guardrails for Movie-streaming."
applyTo: "{firestore.rules,firestore.rules.*,firebase/**,admin-dashboard/**,android-app-tv/**,app-extension/**,extension/**,extensions/**,**/*rules*test*,**/*security*test*}"
---

# Firestore Rules Testing Standards

## Purpose
Use this instruction whenever Firestore rules, auth logic, or access behavior changes. Tests must prove the intended guest/user/admin policy from security instructions.

## Required Test Environment
- Use Firebase Emulator Suite for all security tests.
- Never run security tests against production or shared staging Firestore.
- Seed deterministic fixture data before each test set.
- Isolate test data per test case to avoid cross-test contamination.

## Minimum Scenario Coverage
### Movies: movies/{movieId}
- guest can read.
- authenticated user can read.
- non-admin cannot create/update/delete.
- admin can create/update/delete.

### Users: users/{uid}
- guest cannot read/write.
- user can read own doc only.
- user cannot read another user doc.
- user can create own doc only when uid equals auth uid.
- user cannot modify protected fields role, uid, created_at.
- admin has full access.

### Devices: users/{uid}/devices/{deviceId}
- guest cannot read/write.
- user can read/write own devices.
- user cannot read/write other users devices.
- admin has full access.

## Denial Assertions
- For every denied path, assert permission-denied explicitly.
- Do not treat any failure as sufficient; verify error code/type matches security denial.
- Include at least one negative test for each allow rule to prove non-overreach.

## Data Validation Cases In Rules Tests
When rules include field validation, include tests for:
- invalid movie enum values such as type or audio_types members;
- movie create/update rejected when request.resource.data.id does not match movieId;
- missing required fields in protected writes;
- non-admin attempts to modify protected user fields;
- device writes rejected when playlist or tracking_history violates the current list-type checks.

Do not assume tracking_history entry-level validation unless the rules under test actually add it.

## Test Quality Expectations
- Use clear arrange-act-assert test structure.
- Keep test names policy-driven (for example: user_cannot_update_role_field).
- Avoid broad snapshot assertions for permission logic.
- One policy behavior per test where practical.

## Regression Requirements
When changing rules, update tests in the same change set:
- add tests for new allow conditions;
- add denial tests for potential bypass paths;
- remove or rewrite outdated tests if policy changed intentionally.

## CI Gate
- Security test suite must run in CI for pull requests touching rules, auth, or role logic.
- A PR is not ready if policy changes are untested.

## Sync With Other Instructions
If policy changed, also update:
- firestore-security instruction for role matrix;
- project-data-contract instruction when field constraints change.
