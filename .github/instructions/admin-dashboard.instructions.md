---
description: "Use when developing the admin-dashboard. Covers React + TypeScript + Vite SPA architecture, movie/user/device/report management features, React Hook Form, React Query, Zustand auth, Firestore integration, shadcn/UI components, and hls.js preview behavior."
applyTo: "admin-dashboard/**"
---

# Admin Dashboard Development Guidelines

## Purpose
Use this file when implementing or refactoring admin-dashboard code. Keep architecture, Firestore contracts, and hls.js playback-preview behavior aligned with current repository patterns.

## Current Stack And Boundaries
- React + TypeScript + Vite SPA.
- Auth and role state in Zustand (`src/lib/store.ts`).
- Server state in React Query (`src/lib/queries.ts`).
- Firestore operations only in service layer (`src/lib/firestore.ts`).
- Form validation with React Hook Form + zod (`src/lib/movieForm.ts`).
- UI built with local shadcn-style components in `src/components/ui`.

## Architecture Rules
- Do not call Firestore directly from pages/components.
- Preserve canonical Firestore field names from project data contract (snake_case where defined).
- Keep route guards, role checks, and error handling layered; UI hiding is not authorization.
- Reuse centralized query keys and invalidation patterns in `src/lib/queries.ts`.
- Keep movie stream editing logic in form components and use typed value transformers.
- Reports management UI is currently read-only in admin-dashboard (filters + listing only, no report action/status mutation controls).

## User Auth Lifecycle Rules
- User creation in admin-dashboard is Firestore profile creation only and requires UID from a manually provisioned Firebase Auth account.
- Do not collect or persist password values in the dashboard for user creation.
- Auth lifecycle actions in dashboard must call Cloud Functions through `httpsCallable` wrappers (disable/enable, password reset link, delete).
- Avoid raw browser `fetch` calls directly to callable endpoint URLs.
- Keep `account_status` presentation aligned with server-side auth disable state updates.

## hls.js Integration Rules (Official API Aligned)
Source: https://hlsjs.video-dev.org/api-docs/hls.js.hls

### Capability Detection
- Use `Hls.isSupported()` before creating an hls.js instance.
- If `Hls.isSupported()` is false, fallback to native playback only when the video element can play `application/vnd.apple.mpegurl`.
- If neither path is available, fail preview with an explicit unsupported message.

### Instance Lifecycle
- Create one Hls instance per preview session/media element.
- Attach and load in deterministic order:
  1. `const hls = new Hls(config)`
  2. `hls.attachMedia(videoElement)`
  3. On `Hls.Events.MEDIA_ATTACHED`, call `hls.loadSource(url)`
- On close/unmount/error terminal state:
  - `hls.detachMedia()` (when attached)
  - `hls.destroy()`
- Never reuse a destroyed instance.

### Required Events For Admin Preview
- `Hls.Events.MANIFEST_PARSED`: mark stream as playable candidate.
- `Hls.Events.LEVEL_LOADED`: extract bitrate/live-level details for metadata.
- `Hls.Events.ERROR`: inspect structured `ErrorData` fields (`type`, `details`, `fatal`, `error`, optional `response`).

### Fatal Error Recovery Policy
- For `fatal` + `Hls.ErrorTypes.NETWORK_ERROR`: try `hls.startLoad()` once.
- For `fatal` + `Hls.ErrorTypes.MEDIA_ERROR`: try `hls.recoverMediaError()` once.
- For other fatal errors: destroy instance and mark preview failed.
- Avoid unbounded retry loops.

### Metadata Capture For Stream Connections
- Keep metadata small and JSON-serializable.
- Safe keys include:
  - `manifest_url`
  - `bandwidth_estimate`
  - `level_bitrate`
  - `is_live`
  - `target_duration`
  - `error_type` and `error_details` when failed
- Merge detected metadata with existing `metadata_json` instead of overwriting unrelated keys.

### UX Expectations For Preview Dialog
- Show explicit preview states: idle, loading, live, dead.
- Auto-mark stream status from preview result (`live`/`dead`) in the form state.
- Provide actionable error messages for network timeout, manifest parse/load, CORS, and unsupported codec/device cases.
- Keep dialog keyboard-accessible and closable with Escape.

## Coding Standards
- Prefer relative imports unless project config is intentionally changed.
- Keep components focused; extract helper functions for parsing and normalization.
- Avoid `any`; use concrete interfaces for preview result and metadata.
- Preserve lint rules such as `react-hooks/set-state-in-effect` by scheduling effect-driven state updates safely.

## Verification Checklist
- Run `npm run lint` and `npm run typecheck` in `admin-dashboard` after meaningful edits.
- Manually verify HLS preview against:
  - valid manifest URL;
  - dead URL;
  - malformed URL;
  - unsupported browser path (native fallback or clear failure).
- Confirm no direct Firestore calls were introduced in page/component files.
