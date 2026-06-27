---
name: android-tv-compose-migration
description: 'Generate or update staged Leanback-to-Compose for TV migration work in android-app-tv, including screen parity, ViewModel state boundaries, Compose navigation arguments, and Android 10 TV-box compatibility.'
argument-hint: 'Provide target screen, current Leanback files, migration scope, and acceptance criteria'
user-invocable: true
---

# Android TV Compose Migration Workflow

## When To Use
- Migrate existing Leanback screens to Jetpack Compose for TV in `android-app-tv`.
- Refactor navigation from fragment-based flow toward Compose Navigation.
- Preserve browse/details/playback behavior while migrating screen-by-screen.
- Keep Android 10 set-top box compatibility during migration.

## Required Inputs
- Target screen or flow segment (home, details, player, or shared UI component).
- Current Leanback files to migrate.
- Desired migration phase: scaffold, parity, or cleanup.
- Constraints for focus behavior, navigation, and rollout safety.

## Procedure
1. Identify source Leanback surface and map to target Compose screen(s).
2. Keep migration incremental: one screen at a time with parity checks.
3. Move screen state into ViewModel and keep composables parameter-driven.
4. Define stable navigation routes and pass IDs, not full model payloads.
5. Resolve data in destination ViewModel via repository/use case boundaries.
6. Keep focus behavior explicit for first focus, directional traversal, and focus restore after back navigation.
7. Preserve equivalent loading, empty, and error states before removing Leanback artifacts.
8. Remove old fragment/layout artifacts only after parity is confirmed for the migrated screen.

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
