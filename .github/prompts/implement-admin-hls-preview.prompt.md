---
description: "Implement or refactor admin-dashboard HLS stream preview using official hls.js API patterns and repo conventions."
mode: ask
---

# Implement Admin HLS Preview

Implement or refactor HLS preview behavior for admin-dashboard movie stream connections.

## Inputs
- Target files: ${input:targetFiles:admin-dashboard/src/components/ui/hls-preview-dialog.tsx,admin-dashboard/src/components/forms/MovieDetailsForm.tsx}
- Preview trigger: ${input:trigger:manual-preview-button|auto-validate-on-link-change}
- Browser fallback policy: ${input:fallbackPolicy:native-hls-when-available|strict-hlsjs-only}
- Retry policy: ${input:retryPolicy:single-fatal-recovery|no-retry}
- Metadata keys: ${input:metadataKeys:manifest_url,bandwidth_estimate,level_bitrate,is_live,error_type,error_details}

## Required hls.js API Behavior
Source: https://hlsjs.video-dev.org/api-docs/hls.js.hls

- Gate playback setup with `Hls.isSupported()`.
- If unsupported, fallback to native HLS only when `video.canPlayType('application/vnd.apple.mpegurl')` returns support.
- Use deterministic lifecycle:
  1. create `new Hls(config)`
  2. `attachMedia(video)`
  3. on `Hls.Events.MEDIA_ATTACHED`, call `loadSource(url)`
- Listen to:
  - `Hls.Events.MANIFEST_PARSED`
  - `Hls.Events.LEVEL_LOADED`
  - `Hls.Events.ERROR`
- In `ERROR` handler, inspect `ErrorData` fields (`type`, `details`, `fatal`, `error`).
- For fatal errors only:
  - `NETWORK_ERROR` -> `startLoad()` (bounded)
  - `MEDIA_ERROR` -> `recoverMediaError()` (bounded)
  - other fatal -> fail preview and destroy instance
- Always cleanup with `detachMedia()` and `destroy()` on close/unmount.

## Admin Dashboard Constraints
- Keep Firestore writes in service layer and keep form updates typed.
- Preserve `stream_connections` schema and merge metadata into `metadata_json` without dropping existing keys.
- Keep preview states explicit (`idle`, `loading`, `live`, `dead`) and errors user-readable.
- Preserve keyboard accessibility for the dialog.

## Output Format
Return in this order:
1. implementation plan;
2. file-by-file edits;
3. hls.js event/error strategy summary;
4. validation commands (`npm run lint`, `npm run typecheck`) and manual preview test checklist.

## Guardrails
- Do not add unbounded retry loops.
- Do not leak request headers/cookies into stored metadata.
- Do not bypass existing role and Firestore data-contract constraints.
