---
description: "Use when implementing or modifying Firestore models, API/data mapping, validation, and feature logic for Movie-streaming across admin-dashboard, android-app-tv, and extension code. Enforces movie/users schema, role permissions, and device playlist/tracking behavior from the active codebase and README."
applyTo: "{admin-dashboard/**,android-app-tv/**,app-extension/**,extension/**,extensions/**,README.md}"
---

# Movie Streaming Data Contract Instructions

## Purpose
Use these rules to keep Firestore data consistent between Admin Dashboard (React), Android TV app (Kotlin), and browser-extension ingestion flows such as app-extension.

## Canonical Firestore Collections
- movies: one document per movie/series/franchise entry.
- users: one document per authenticated account.
- users/{uid}/devices: subcollection keyed by stable device id.

Do not create alternate collection names for the same domain unless explicitly requested.

## Movie Document Contract
Required fields:
- id: string, unique slug-like id derived from title + UUID suffix.
- title: string, non-empty.
- description: string.
- thumbnail_link: string URL.
- background_link: string URL.
- type: one of single_movie, tv_series, franchise.
- year: integer.
- episode_count: integer, 1 for single_movie.
- actors: string array.
- audio_types: array containing dubbing and/or subtitle.
- genres: string array.
- stream_connections: array of stream objects.
- created_at: ISO-8601 UTC string in the current admin-dashboard write path.
- last_updated: ISO-8601 UTC string in the current admin-dashboard write path.

Optional fields:
- youtube_trailer_link: string URL (optional).

Stream object shape:
- server_name: string.
- link: string URL to m3u8/HLS.
- type: one of dubbing, subtitle.
- status: one of live, dead.
- metadata: object with provider-specific details (for example resolution, codec).

## User and Device Contract
User document fields:
- uid: string, required (same identity value used by app auth mapping).
- username: string, unique login name.
- role: one of guest, user, admin.
- created_at: ISO-8601 UTC string in the current admin-dashboard read/write path; Firestore Timestamp may still appear in storage and must be converted at boundaries.

Device document fields (users/{uid}/devices/{deviceId}):
- device_name: string.
- playlist: string array of movie ids.
- tracking_history: array of watch progress objects.

Tracking object shape:
- movie_id: string.
- last_watched_at: ISO-8601 UTC string in API contracts; Firestore Timestamp allowed in storage with boundary conversion.
- current_position_seconds: non-negative integer.

Current rules note:
- firestore.rules currently validates tracking_history only as a list, not the inner tracking object shape. If code starts depending on stronger guarantees, tighten rules and rules tests in the same change.

## Role and Behavior Rules
- guest: no playlist, no tracking persistence.
- user: can maintain per-device playlist and tracking history.
- admin: full movie/user management in admin-dashboard.
- Enforce role checks in UI and service layer, not only in views.

## Cross-App Consistency Rules
- Keep field names exactly as defined above (snake_case where shown).
- Do not silently rename fields between React/Kotlin models and Firestore documents.
- Preserve enum values exactly; avoid alias values.
- Keep movie document ids aligned with the stored id field. The current admin-dashboard service generates the document id and writes the same value into payload.id.
- Validate URLs, enum values, and required arrays before write operations.
- Prefer additive schema changes with backward compatibility.

## Write-Safety and Validation
- Use typed models/interfaces/data classes for movie, user, device, and tracking records.
- Add explicit mapping/serializer helpers instead of ad-hoc inline parsing.
- Reject malformed stream_connections entries (missing link, invalid status/type).
- Keep timestamps in UTC. Firestore Timestamp is allowed in storage, but convert consistently to ISO-8601 strings at API/UI boundaries.

## Implementation Guidance by App
Admin Dashboard:
- Treat this schema as source of truth for form validation and CRUD payloads.
- Use admin-dashboard/src/lib/firestore.ts as the write boundary and admin-dashboard/src/lib/queries.ts for React Query integration; do not bypass the service layer from pages/components.
- Preserve the current create/update behavior: create writes id, created_at, and last_updated; update preserves created_at and refreshes last_updated.
- When editing movies, preserve unknown metadata keys inside stream_connections.metadata.
- Keep reads compatible with Firestore Timestamp values via boundary conversion helpers.

Android TV app:
- Parse optional fields defensively (for example youtube_trailer_link).
- Default safely when optional arrays are missing, but do not overwrite data with empty values during partial updates.

Browser extension:
- Normalize captured stream links into the stream_connections schema before sending to admin/backend.
- Always include server_name, link, type, and status; place parser-specific facts inside metadata.
- If the extension writes to Firestore directly in future work, keep it aligned with the named database configuration used by admin-dashboard.

## Testing Expectations
When changing data models or Firestore writes, include tests or checks that cover:
- accepted and rejected enum values;
- role-based behavior differences (guest vs user/admin);
- stream_connections validation;
- playlist/tracking behavior under users/{uid}/devices.
