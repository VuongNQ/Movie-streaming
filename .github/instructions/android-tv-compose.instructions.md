---
description: "Use when building or refactoring android-app-tv toward a Jetpack Compose for TV architecture. Defines package structure, feature boundaries, navigation, and migration mapping from current Leanback fragments."
applyTo: "android-app-tv/**"
---

# Android TV Compose Structure Instructions

## Purpose
Use this instruction when implementing new Android TV features or migrating existing Leanback screens to **Jetpack Compose for TV**.

Base this structure on the current `android-app-tv/app` module, which is currently activity + fragment + Leanback based:
- `MainActivity` + `MainFragment` (browse/home)
- `DetailsActivity` + `VideoDetailsFragment` (details)
- `PlaybackActivity` + `PlaybackVideoFragment` (player)
- `Movie` + `MovieList` (domain sample data)

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
- Use TV-focused Compose APIs (`androidx.tv.material3`, `androidx.tv.foundation`) for focus, scaling, and D-pad behavior.
- Keep one activity entry point (`MainActivity`) with `setContent { ... }`; avoid new fragment-based screens.
- Use Compose Navigation for screen flow: home -> details -> player.
- Keep screen state in `ViewModel`; composables should be mostly stateless and parameter-driven.

## Data And Contract Rules
- Firestore schema must follow `.github/instructions/project-data-contract.instructions.md` exactly.
- Role behavior (`guest`, `user`, `admin`) must remain aligned with `.github/instructions/firestore-security.instructions.md`.
- Do not access Firestore directly from composables. Access through:
  `feature ViewModel -> domain use case -> repository -> data source`.
- Preserve snake_case Firestore field names at data boundary and map to Kotlin domain models explicitly.

## Suggested File Mapping From Current App
- `MainFragment` -> `feature/home/HomeScreen.kt` + `HomeViewModel.kt`
- `VideoDetailsFragment` -> `feature/details/DetailsScreen.kt` + `DetailsViewModel.kt`
- `PlaybackVideoFragment` -> `feature/player/PlayerScreen.kt` + `PlayerViewModel.kt`
- `Movie.kt` -> split into `data/model` and `domain/model` models with mapper functions
- `MovieList.kt` -> temporary fake repository in `data/repository/FakeMovieRepository.kt` (for staged migration only)

## Navigation And State Guidance
- Define routes in `navigation/TvNavGraph.kt` with stable argument keys (movie id, stream id).
- Pass IDs through navigation; fetch full objects from repository in destination ViewModel.
- Use `SavedStateHandle` in ViewModel for nav args.
- Handle loading/error/empty states explicitly on each screen.

## Migration Approach (Leanback -> Compose)
1. Introduce Compose dependencies and theme while keeping existing Leanback flow running.
2. Migrate **Home** to Compose first behind one activity entry.
3. Migrate **Details** and **Player** to Compose Navigation.
4. Remove fragment/layout artifacts only after parity is reached.
5. Keep behavior equivalent during migration (focus behavior, browse -> details -> playback flow).

## Dependency Direction
- `feature` may depend on `domain` and `core`.
- `data` may depend on `domain` and `core`.
- `domain` must not depend on `feature` or Android UI toolkit.
- Avoid circular dependencies between feature packages.

## Testing Expectations
- Unit test ViewModels and use cases.
- Add navigation argument tests for critical paths (home -> details -> player).
- When Firestore query patterns change, update indexes and related instructions together.
