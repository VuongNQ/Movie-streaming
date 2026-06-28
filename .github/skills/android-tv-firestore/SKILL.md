---
name: android-tv-firestore
description: 'Generate or update Android TV app features for Movie-streaming using the current Compose-first app structure, Firestore movie/user/device/report contract, and explicit data mapping from Firestore to Kotlin models. Use for home/details/player screens, Firestore repositories, model mappers, and role-aware TV behavior.'
argument-hint: 'Provide the screen or feature, target Firestore collection or document shape, and whether you are adding new code or refactoring existing code'
user-invocable: true
---

# Android TV Firestore Workflow

## When To Use
- Add or refactor Android TV screens in `android-app-tv`.
- Map Firestore `movies`, `users`, `users/{uid}/devices`, or `reports` data into Kotlin models.
- Replace sample/local movie data with Firestore-backed data.
- Update browse, details, playback, or device-tracking behavior to match the canonical data contract.
- Keep Compose UI behavior aligned with the current app while wiring Firestore reads and writes.

## Required Inputs
- Target screen or feature.
- Firestore collection or document path.
- Existing Kotlin files to update, if known.
- Whether the change is read-only, write-enabled, or both.
- Any role behavior constraints for guest, user, or admin.

## Procedure
1. Identify the current app surface being changed:
    - `feature/home/*` for browse/home;
    - `feature/details/*` for details;
    - `feature/player/*` for playback.
2. Use repository boundaries:
    - `MovieRepository` -> `FirestoreMovieRepository` for movie reads.
    - `TrackingRepository` -> `LocalTrackingRepository` for local device tracking/watched state.
3. Map Firestore data using the canonical schema from `.github/instructions/project-data-contract.instructions.md`.
4. Keep Firestore field names exactly as stored:
   - `title_raw`, `description`, `thumbnail_link`, `background_link`, `type`, `year`, `episode_count`, `actors`, `audio_types`, `genres`, `stream_connections`, `created_at`, `last_updated`.
5. Use explicit Kotlin models and mappers instead of ad-hoc parsing.
6. For home screens, load movie lists in ViewModel and keep filter state deterministic.
7. For details screens, handle optional fields defensively and preserve unknown stream metadata.
8. For playback, resolve the active stream from `stream_connections` and use the selected live `link`.
9. For local watched/tracking behavior, preserve current device-local flow unless a Firestore write task is explicitly requested.
10. For device tracking writes, write only under `users/{uid}/devices/{deviceId}` and scope updates to the current user.
11. Apply role-aware behavior consistently:
    - guest: browse only, no persistence;
    - user: per-device playlist and tracking;
    - admin: full movie/user management if the screen is admin-facing.
12. Keep Firestore access behind a repository/data-source boundary; do not access Firestore directly from composables.
13. Treat timestamps carefully:
    - convert Firestore `Timestamp` values at the boundary;
    - keep app-facing values consistent within Kotlin models.
14. Preserve Compose navigation flow:
    - home -> details -> player.
15. Add try/catch/finally around Firestore or playback flows where needed so one failed item does not break the whole screen.

## Data Mapping Rules
- Use a stable app model that can represent Firestore movies without losing fields.
- Keep `stream_connections` as a list of stream objects with:
  - `server_name`
  - `link`
  - `type`
  - `status`
  - `metadata`
- When mapping Firestore to the TV UI, derive card/background/poster URLs from the canonical movie fields, not ad-hoc aliases.
- If a field is missing, prefer safe defaults over overwriting persisted data.

## Quality Checklist
- Firestore field names match the project contract exactly.
- Role behavior matches the repository security rules.
- Sample movie data is not mixed with Firestore data in the same model path.
- UI code does not bypass the data/repository boundary.
- Optional Firestore fields are parsed defensively.
- Playback uses the selected stream link from `stream_connections`.
- Home filter state and watched markers remain consistent when data loads or focus changes.

## Output Contract
When invoked, return:
1. implementation plan;
2. Kotlin file edits or new file layout;
3. Firestore mapping details;
4. validation or Gradle commands to run.

## Related Policies
- Follow `.github/instructions/project-data-contract.instructions.md`.
- Follow `.github/instructions/android-tv-compose.instructions.md` when migrating or structuring TV UI code.
- Follow `.github/instructions/firestore-security.instructions.md` for role and access behavior.
