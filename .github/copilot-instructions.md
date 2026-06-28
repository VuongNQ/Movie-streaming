# Copilot Instructions for Movie-streaming

## Build, test, and lint commands

### Admin dashboard (`admin-dashboard`)

```bash
cd admin-dashboard
npm install
npm run dev
npm run lint
npm run typecheck
npm run build
```

- There is currently no test script in `admin-dashboard/package.json`.

### Android TV app (`android-app-tv`)

```bash
cd android-app-tv
.\gradlew.bat assembleDebug
.\gradlew.bat lint
.\gradlew.bat testDebugUnitTest
```

Run a single Android unit test:

```bash
cd android-app-tv
.\gradlew.bat testDebugUnitTest --tests "com.example.movieapptv.YourTestClass.yourTestMethod"
```

## High-level architecture

- Product architecture in README is a **3-component system**:
  - `android-app-tv`: TV playback app (Kotlin/Compose + Navigation), consumer-facing playback.
  - `admin-dashboard`: React SPA for admin movie/user control.
  - `extension`/`extensions` (when present): Chromium extension (vanilla JS) to capture stream links and send/update data for admin workflows.
- Current repository code is active in `admin-dashboard` and `android-app-tv`; data contract and security instructions already cover extension flows and should be followed when extension code is added/updated.
- All components are designed around one Firestore contract:
  - `movies`
  - `users`
  - `users/{uid}/devices`
  - `reports`
- Role model is shared across layers: `guest`, `user`, `admin`.
  - Admin dashboard enforces admin-only access in routing (`src/App.tsx`) and auth store role lookup (`src/lib/store.ts`).
  - Firestore security expectations in `.github/instructions/firestore-security.instructions.md` must stay aligned with UI/service behavior.
- Admin dashboard runtime flow:
  - `main.tsx` wires React Query + Router.
  - `lib/store.ts` owns Firebase Auth session + role resolution from `users/{uid}`.
  - `lib/firestore.ts` is the Firestore service layer for CRUD/query calls.
  - `lib/queries.ts` wraps service calls with React Query hooks.
  - `pages/*` consume hooks and render management UIs (movies, users, nested devices).
- Android app runtime is Compose-first:
  - `MainActivity` mounts `TvAppRoot` and `navigation/TvNavGraph`.
  - Feature screens live under `feature/home`, `feature/details`, and `feature/player`.
  - Firestore movie reads are served by `data/repository/FirestoreMovieRepository`.
  - Local device tracking is served by `data/repository/LocalTrackingRepository`.
  - Home supports local watched/unwatched filtering (`ALL`, `WATCHED`, `UNWATCHED`) and continues to show Continue Watching.

## Key conventions specific to this repo

- **Treat Firestore schema in `.github/instructions/project-data-contract.instructions.md` as canonical.** Keep names and enum values exact (snake_case fields like `thumbnail_link`, `created_at`, `tracking_history`).
- **Keep README movie model semantics intact across all apps**:
  - Movie identity: stable `id` derived from title + UUID pattern.
  - Movie fields include: title, description, thumbnail/background links, optional YouTube trailer link.
  - Movie taxonomy: `type` in `single_movie | tv_series | franchise`; genre tags; actor tags; audio tags (`dubbing`/`subtitle`).
  - Stream entries contain `server_name`, stream `link`, stream `type`, stream `status` (`live`/`dead`), and metadata (e.g., m3u8/HLS details).
- **Role behavior must match README and security rules**:
  - `guest`: can browse but must not persist playlist/tracking.
  - `user`: has per-device playlist and watch tracking under `users/{uid}/devices`.
  - `admin`: full management for movies and users.
  - `reports`: authenticated users/admins can create issue logs; admin-dashboard currently uses read-only report listing/filter UI (no action controls).
- **Do not bypass the service layer in admin-dashboard.** UI pages should use `lib/queries.ts` hooks, and hooks call `lib/firestore.ts`; avoid direct Firestore calls from page/components.
- **Keep auth and role checks layered, not UI-only.** Follow current pattern: route guard + Zustand auth role state + backend/rules alignment.
- **React Query key strategy is centralized in `queryKeys` (`lib/queries.ts`).** Reuse these keys and invalidate by key family instead of ad-hoc strings.
- **Type contracts in `admin-dashboard/src/types/index.ts` must stay in sync with Firestore docs and any Android model changes.**
- **HLS preview code in admin-dashboard must follow official hls.js API lifecycle.** Prefer `Hls.isSupported()` gating, `attachMedia` then `loadSource`, `Hls.Events.ERROR` handling via `ErrorData` (`type`, `details`, `fatal`), bounded fatal recovery (`startLoad` or `recoverMediaError`), and guaranteed `destroy` cleanup.
- **When changing access behavior or Firestore schema**, update the paired instruction sources together:
  - `.github/instructions/project-data-contract.instructions.md`
  - `.github/instructions/firestore-security.instructions.md`
  - `.github/instructions/firestore-rules-testing.instructions.md` (if rules/auth behavior changes)

## Android TV customization routing

- For Android TV UI-only improvements (focus behavior, remote navigation, readability, states), use:
  - Agent: `.github/agents/android-tv-ui.agent.md`
  - Prompt: `.github/prompts/implement-android-tv-ui.prompt.md`
  - Instruction: `.github/instructions/android-tv-ui-patterns.instructions.md`
- For remaining legacy Leanback cleanup or migration hardening, use:
  - Agent: `.github/agents/android-tv-compose-migration.agent.md`
  - Prompt: `.github/prompts/migrate-android-tv-compose.prompt.md`
  - Skill: `.github/skills/android-tv-compose-migration/SKILL.md`
- Continue using `.github/skills/android-tv-firestore/SKILL.md` for Firestore mapping/repository-focused Android TV tasks in the Compose feature stack.
- Keep Android TV work aligned with `.github/instructions/android-tv-compose.instructions.md`, `.github/instructions/project-data-contract.instructions.md`, and `.github/instructions/firestore-security.instructions.md`.
