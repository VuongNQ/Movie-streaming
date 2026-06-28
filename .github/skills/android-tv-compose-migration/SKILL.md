---
name: android-tv-compose-migration
description: 'Generate or update Compose-first Android TV work in android-app-tv, including legacy Leanback cleanup, screen parity, ViewModel state boundaries, Compose navigation arguments, and Android 10 TV-box compatibility.'
argument-hint: 'Provide target Compose screen/flow, any legacy files in scope, migration or cleanup scope, and acceptance criteria'
user-invocable: true
---

# Android TV Compose Migration Workflow

## When To Use
- Evolve existing Compose screens in `android-app-tv` and migrate/remove remaining Leanback legacy code.
- Refactor navigation and screen boundaries while preserving Compose Navigation behavior.
- Preserve home/details/player behavior while migrating or cleaning up incrementally.
- Keep Android 10 set-top box compatibility during migration.

## Required Inputs
- Target screen or flow segment (home, details, player, or shared UI component).
- Any legacy Leanback files still in scope.
- Desired phase: parity hardening or cleanup.
- Constraints for focus behavior, navigation, and rollout safety.

## Procedure
1. Identify active Compose surface and any legacy code that still affects it.
2. Keep migration/cleanup incremental: one screen or behavior slice at a time with parity checks.
3. Move screen state into ViewModel and keep composables parameter-driven.
4. Define stable navigation routes and pass IDs, not full model payloads.
5. Resolve data in destination ViewModel via repository/use case boundaries.
6. Keep focus behavior explicit for first focus, directional traversal, and focus restore after back navigation.
7. Preserve equivalent loading, empty, and error states before removing legacy artifacts.
8. Remove old fragment/layout artifacts only after parity is confirmed for the migrated screen/flow.
9. Keep watched/unwatched local tracking and filter behavior intact when touching home/player paths.

## Migration Rules
- Follow `.github/instructions/android-tv-compose.instructions.md` for package structure and dependency direction.
- Keep Firestore schema and role behavior aligned with:
  - `.github/instructions/project-data-contract.instructions.md`
  - `.github/instructions/firestore-security.instructions.md`
- Do not access Firestore directly from composables.
- Prefer additive changes and feature parity before cleanup/refactor passes.

## Quality Checklist
- Migration is scoped to one screen or coherent flow slice.
- D-pad focus behavior is deterministic and parity-checked.
- Compose navigation arguments are stable and testable.
- ViewModel and repository boundaries remain intact.
- Android 10 TV-box behavior is validated for the migrated path.

## Output Contract
When invoked, return:
1. migration plan for the target screen;
2. file-by-file migration edits;
3. parity verification checklist (focus, navigation, state);
4. build/test commands and remaining migration risks.
