---
name: firestore-security-testgen
description: 'Generate or update Firestore Security Rules tests using Firebase Emulator Suite for guest/user/admin role matrix, ownership checks, deny assertions, and field-protection constraints in Movie-streaming.'
argument-hint: 'Provide changed rules/policies, target runtime (vitest|jest|other), and scope (movies|users|devices|all)'
user-invocable: true
---

# Firestore Security Rules Test Generator

## When To Use
- Firestore rules changed and you need regression tests.
- Role behavior changed for guest, user, or admin.
- You need explicit allow/deny coverage before merge.
- You want emulator-based tests for ownership and field protections.

## Required Inputs
- Changed rule or policy summary.
- Test runtime/framework target.
- Scope: movies, users, devices, or all.
- Existing test folder/path preference if any.

## Procedure
1. Parse changed policy expectations from rules and related instructions.
2. Build test matrix for allow and deny paths by role.
3. Add ownership tests for users/{uid} and users/{uid}/devices/{deviceId}.
4. Add field-protection tests (role, uid, created_at immutable for non-admin).
5. Add data validation tests (for example current_position_seconds >= 0 where enforced).
6. Generate deterministic emulator fixtures and auth contexts.
7. Return runnable test files and execution commands.

## Coverage Checklist
- guest read/write behavior for each scoped collection.
- user own-document access and cross-user denial.
- admin full management behavior where allowed.
- explicit permission-denied assertions on blocked paths.
- at least one negative test per allow rule.

## Output Contract
When invoked, return:
1. test matrix summary;
2. test file content;
3. fixture/setup helpers;
4. local and CI run commands;
5. assumptions if any policy detail is ambiguous.

## Related Policies
- Keep coverage aligned with firestore-security and firestore-rules-testing instructions.
- Keep entity field expectations aligned with project-data-contract instruction.
