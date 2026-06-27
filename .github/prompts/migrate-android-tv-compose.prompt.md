---
description: "Plan and implement staged Leanback-to-Compose for TV migration in android-app-tv with parity checks and Android 10 compatibility."
mode: ask
---

# Migrate Android TV to Compose

Migrate a selected Android TV screen or flow from Leanback to Jetpack Compose for TV.

## Inputs
- Migration target: ${input:target:home|details|player|shared-flow}
- Current Leanback files: ${input:sourceFiles:android-app-tv/app/src/main/java/com/example/movieapptv/...}
- Migration phase: ${input:phase:scaffold|parity|cleanup}
- Navigation scope: ${input:navigationScope:single-screen|home-to-details|details-to-player|full-flow}
- Acceptance criteria: ${input:acceptance:focus parity, state parity, back navigation parity}

## Requirements
- Migrate incrementally with one coherent surface at a time.
- Preserve behavior parity for focus, navigation, loading/empty/error states.
- Use ViewModel-driven state and stable navigation arguments.
- Keep repository/data boundaries intact and avoid direct Firestore access from composables.
- Follow `.github/instructions/android-tv-compose.instructions.md` and `.github/skills/android-tv-compose-migration/SKILL.md`.

## Expected Output
1. staged migration plan;
2. file-by-file edits;
3. parity verification checklist;
4. build/test commands and rollback-safe next step.

## Guardrails
- Do not perform big-bang rewrites.
- Do not remove Leanback artifacts before parity is verified.
- Avoid unrelated architecture refactors outside migration scope.
