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

- The repository currently has two active applications:
  - `admin-dashboard`: React 19 + TypeScript + Vite SPA for admin operations.
  - `android-app-tv`: Kotlin + Android Leanback TV client.
- Both apps are built around the same Firestore backend contract from `README.md` and `.github/instructions/*`:
  - `movies`
  - `users`
  - `users/{uid}/devices`
- Role model is shared across layers: `guest`, `user`, `admin`.
  - Admin dashboard enforces admin-only access in routing (`src/App.tsx`) and auth store role lookup (`src/lib/store.ts`).
  - Firestore security expectations in `.github/instructions/firestore-security.instructions.md` must stay aligned with UI/service behavior.
- Admin dashboard runtime flow:
  - `main.tsx` wires React Query + Router.
  - `lib/store.ts` owns Firebase Auth session + role resolution from `users/{uid}`.
  - `lib/firestore.ts` is the Firestore service layer for CRUD/query calls.
  - `lib/queries.ts` wraps service calls with React Query hooks.
  - `pages/*` consume hooks and render management UIs (movies, users, nested devices).
- Android app currently uses Leanback sample-style browsing/playback (`MainFragment` -> `DetailsActivity`/`VideoDetailsFragment` -> `PlaybackActivity`/`PlaybackVideoFragment`) and local `MovieList` data, while Firestore dependency is present for future/ongoing integration.

## Key conventions specific to this repo

- **Treat Firestore schema in `.github/instructions/project-data-contract.instructions.md` as canonical.** Keep names and enum values exact (snake_case fields like `thumbnail_link`, `created_at`, `tracking_history`).
- **Do not bypass the service layer in admin-dashboard.** UI pages should use `lib/queries.ts` hooks, and hooks call `lib/firestore.ts`; avoid direct Firestore calls from page/components.
- **Keep auth and role checks layered, not UI-only.** Follow current pattern: route guard + Zustand auth role state + backend/rules alignment.
- **React Query key strategy is centralized in `queryKeys` (`lib/queries.ts`).** Reuse these keys and invalidate by key family instead of ad-hoc strings.
- **Type contracts in `admin-dashboard/src/types/index.ts` must stay in sync with Firestore docs and any Android model changes.**
- **When changing access behavior or Firestore schema**, update the paired instruction sources together:
  - `.github/instructions/project-data-contract.instructions.md`
  - `.github/instructions/firestore-security.instructions.md`
  - `.github/instructions/firestore-rules-testing.instructions.md` (if rules/auth behavior changes)
