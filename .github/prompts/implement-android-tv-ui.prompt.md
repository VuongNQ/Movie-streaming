---
description: "Design or update Android TV UI in android-app-tv with D-pad focus, remote-first navigation, and Android 10 TV-box compatibility."
mode: ask
---

# Implement Android TV UI

Implement or refine Android TV UI behavior for `android-app-tv`.

## Inputs
- Target screen or component: ${input:target:home|details|player|shared-ui}
- Target files: ${input:targetFiles:android-app-tv/app/src/main/java/com/example/movieapptv/...}
- UI stack: ${input:uiStack:leanback|compose|mixed}
- Primary issue: ${input:issue:focus-order|layout-readability|remote-navigation|loading-empty-error-states|accessibility}
- Android 10 device notes: ${input:deviceNotes:optional box/vendor constraints}

## Requirements
- Keep interaction remote-first and D-pad complete.
- Make focus behavior explicit (initial focus, directional traversal, restore on back).
- Improve large-screen readability and avoid overcrowded layouts.
- Ensure loading, empty, and error states are navigable with remote only.
- Keep architecture and migration alignment with `.github/instructions/android-tv-compose.instructions.md`.
- Apply UI behavior guidance from `.github/instructions/android-tv-ui-patterns.instructions.md`.

## Expected Output
1. implementation plan;
2. file-by-file changes;
3. focus/navigation decisions and Android 10 compatibility notes;
4. validation commands and manual test checklist.

## Guardrails
- Do not introduce touch-first interaction dependencies.
- Do not bypass repository/data-source boundaries for Firestore access.
- Avoid unrelated refactors outside the selected UI scope.
