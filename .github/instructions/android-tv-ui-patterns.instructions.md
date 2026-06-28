---
description: "Use when designing or updating Android TV UI behavior in android-app-tv, including D-pad focus, large-screen readability, and remote-first navigation for Android 10 set-top boxes."
applyTo: "android-app-tv/**"
---

# Android TV UI Patterns Instructions

## Purpose
Use this instruction when implementing or refactoring Android TV UI behavior that is not primarily a data-layer task.

Current active UI surfaces are Compose-based in:
- `feature/home/*`
- `feature/details/*`
- `feature/player/*`

## Core UX Rules
- Prioritize remote-first interaction: every interactive element must be reachable and operable by D-pad.
- Use visible, stable focus states with sufficient contrast and scale so focused targets are obvious from TV viewing distance.
- Keep navigation predictable: directional movement should follow on-screen geometry and avoid focus traps.
- Preserve clear hierarchy on large screens: primary action, content row, metadata panel, and secondary actions should remain visually distinct.

## Layout and Readability Rules
- Favor TV-safe spacing and avoid placing critical controls near extreme screen edges.
- Keep text readable from distance by using consistent heading/body sizes and avoiding dense paragraph blocks.
- Limit per-screen cognitive load: prefer grouped sections and progressive disclosure over overcrowded layouts.
- Maintain clear empty, loading, and error states suitable for remote-only recovery.

## Input and Focus Behavior
- Do not rely on touch gestures or phone-centric interaction patterns.
- Ensure initial focus is deterministic when a screen opens or a dialog appears.
- Preserve focus restoration when returning from details or playback screens.
- Avoid hidden focusable elements and ensure off-screen items are not accidentally focusable.
- For multi-action controls (such as filter chips), prefer explicit selectable actions over hidden cycle toggles.
- Avoid stacking extra `.focusable()` modifiers on controls that are already natively focusable unless there is a proven focus bug.

## Accessibility and Robustness
- Ensure interactive elements have meaningful labels and accessible roles.
- Keep animation subtle and functional; motion must not obscure focus transitions.
- Handle long titles, metadata overflow, and low-bandwidth states without breaking navigation.
- Design fail-safe fallback actions (retry, back, cancel) that are always reachable via remote.

## Integration Boundaries
- Follow `.github/instructions/android-tv-compose.instructions.md` for architecture and migration structure.
- Keep Firestore model and role behavior aligned with:
  - `.github/instructions/project-data-contract.instructions.md`
  - `.github/instructions/firestore-security.instructions.md`
- Do not bypass repository/data-source boundaries from UI code.

## Validation Expectations
- Verify D-pad traversal across critical paths: browse -> details -> playback -> back.
- Verify Home filter traversal and activation for `ALL`, `WATCHED`, and `UNWATCHED` actions.
- Validate focus behavior for loading, empty, and error states.
- Confirm Android 10 TV-box compatibility for navigation and rendering behavior.
- Add targeted tests when focus or navigation logic is changed.
