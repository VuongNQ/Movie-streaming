---
description: "Use when building or refactoring android-app-tv in its Jetpack Compose for TV architecture. Defines package structure, feature boundaries, navigation, and legacy Leanback cleanup guidance."
applyTo: "android-app-tv/**"
---

# Android TV Compose Structure Instructions

## Purpose
Use this instruction when implementing new Android TV features in the existing **Compose-first TV app** or when cleaning up remaining Leanback artifacts.

Current active app flow in `android-app-tv/app`:
- `MainActivity` -> `app/TvAppRoot.kt` -> `navigation/TvNavGraph.kt`
- `feature/home/HomeScreen.kt`, `feature/details/DetailsScreen.kt`, `feature/player/PlayerScreen.kt`
- Firestore-backed movies via `data/repository/FirestoreMovieRepository.kt`
- Local tracking/watched state via `data/repository/LocalTrackingRepository.kt`

## Target Module And Package Layout
Keep a single `:app` module unless there is a clear need for modularization.

Use this package layout under `app/src/main/java/com/example/movieapptv/`:

```text
app/                    # Application entry, activity, DI wiring
core/
  designsystem/         # Theme, colors, typography, reusable TV UI components
  common/               # Constants, shared utils
data/
  model/                # Firestore DTO + mapper input/output models
  remote/               # Firestore data sources
  repository/           # Repository implementations
domain/
  model/                # Stable app-facing models
  repository/           # Repository interfaces
  usecase/              # Feature use cases
feature/
  home/                 # Browse screen (rows/sections)
  details/              # Movie details screen
  player/               # Playback screen
navigation/             # Nav graph routes and typed arguments
```

## Compose-First UI Rules
- Prefer Compose for all new UI in `feature/*`.
- Use Compose APIs already present in the app (`material3`, `navigation-compose`, `lifecycle-compose`) and keep focus/D-pad behavior explicit.
- Keep one activity entry point (`MainActivity`) with `setContent { ... }`; avoid new fragment-based screens.
- Use Compose Navigation for screen flow: home -> details -> player.
- Keep screen state in `ViewModel`; composables should be mostly stateless and parameter-driven.

## Data And Contract Rules
- Firestore schema must follow `.github/instructions/project-data-contract.instructions.md` exactly.
- Role behavior (`guest`, `user`, `admin`) must remain aligned with `.github/instructions/firestore-security.instructions.md`.
- Do not access Firestore directly from composables. Access through:
  `feature ViewModel -> domain use case -> repository -> data source`.
- Preserve snake_case Firestore field names at data boundary and map to Kotlin domain models explicitly.

## Feature And Data Mapping
- Home: `feature/home/HomeScreen.kt` + `HomeViewModel.kt`.
- Details: `feature/details/DetailsScreen.kt` + `DetailsViewModel.kt`.
- Player: `feature/player/PlayerScreen.kt` + `PlayerViewModel.kt`.
- Domain models: `domain/model/Movie.kt`.
- Repositories:
  - `domain/repository/MovieRepository.kt` -> `data/repository/FirestoreMovieRepository.kt`
  - `domain/repository/TrackingRepository.kt` -> `data/repository/LocalTrackingRepository.kt`
- Watch-state workflow:
  - watched IDs are stored locally using `watched_movie_ids`.
  - player marks watched near completion and home supports `ALL/WATCHED/UNWATCHED` filter states.

## Navigation And State Guidance
- Define routes in `navigation/TvNavGraph.kt` with stable argument keys (movie id, stream id).
- Pass IDs through navigation; fetch full objects from repository in destination ViewModel.
- Use `SavedStateHandle` in ViewModel for nav args.
- Handle loading/error/empty states explicitly on each screen.

## Legacy Cleanup Approach (Leanback -> Compose)
1. Treat Compose flow as canonical for new work.
2. Only touch Leanback fragments/activities for bug fixes or compatibility hotfixes.
3. When removing legacy artifacts, preserve route parity (home -> details -> player) and remote navigation behavior.
4. Remove old fragment/layout artifacts only after confirming no active code paths depend on them.
5. Keep cleanup incremental and build-verified after each slice.

## Dependency Direction
- `feature` may depend on `domain` and `core`.
- `data` may depend on `domain` and `core`.
- `domain` must not depend on `feature` or Android UI toolkit.
- Avoid circular dependencies between feature packages.

## Testing Expectations
- Unit test ViewModels and use cases.
- Add navigation argument tests for critical paths (home -> details -> player).
- Validate remote behavior for filter actions and focus restoration on home rows.
- When Firestore query patterns change, update indexes and related instructions together.
