---
description: "Use when creating or changing Firestore security rules, authorization logic, role checks, and access control behavior for Movie-streaming. Defines the role-based access matrix for guest/user/admin across movies, users, devices, and reports data."
applyTo: "{admin-dashboard/**,android-app-tv/**,app-extension/**,extension/**,extensions/**,firestore.rules,firestore.rules.*,firebase/**}"
---

# Firestore Security And Role Access Matrix

## Purpose
Use this instruction for all authorization decisions. Keep Firestore Security Rules and application-level role checks aligned.

## Identity And Role Source
- Require Firebase Authentication for all write operations.
- Resolve role from users/{request.auth.uid}.role for rule decisions.
- Treat role as one of guest, user, admin only.
- Deny if role is missing or not in the allowed enum.
- When debugging admin-dashboard permission issues, verify the deployed rules in the Firestore database targeted by VITE_FIREBASE_DATABASE_ID. The current app defaults to database id moviestreaming.

## Core Security Principles
- Default deny: if no allow condition matches, deny.
- Least privilege: grant only the minimum access needed per role.
- Ownership checks: non-admin users can only access their own user/device documents.
- Prevent privilege escalation: clients must never self-assign or update role.
- Validate schema-critical fields on create/update where rules can enforce them.

## Role-Based Access Matrix
Collection path: movies/{movieId}
- guest: read allowed, write denied.
- user: read allowed, write denied.
- admin: read/write/delete allowed.

Collection path: reports/{reportId}
- guest: no read, no write.
- user: create allowed when reported_by_uid == request.auth.uid, get allowed for own report only, list/update/delete denied.
- admin: create/get/list/update/delete allowed by rules.

Collection path: users/{uid}
- guest: no read, no write.
- user: read own doc only, create own doc when uid == request.auth.uid, update own non-privileged fields only, cannot delete or change role.
- admin: read/write/delete allowed.

Collection path: users/{uid}/devices/{deviceId}
- guest: no read, no write.
- user: read/write own devices only.
- admin: read/write/delete allowed.

## Field-Level Restrictions
For users/{uid} writes by non-admin:
- Forbid changes to: role, uid, created_at.
- Allow profile-safe fields only (for example username) according to product needs.

For users/{uid}/devices/{deviceId} writes by non-admin:
- Require playlist items to be movie ids (string array).
- Current rules require device_name as string, playlist as string array, and tracking_history as a list.
- Tracking entry field validation and current_position_seconds bounds are not currently enforced in firestore.rules; if that policy changes, update rules and tests together.

For movies/{movieId} writes:
- Admin only.
- Current rules enforce document id alignment (request.resource.data.id == movieId), title_raw presence, optional title_vietnamese string, optional generated title keyword arrays, optional franchise_movie_ids list, movie type enum, and audio_types values.
- Current rules validate stream_connections only at the list level, not each nested object field. Treat stronger validation as future policy work until the rules are updated.

For reports/{reportId} writes:
- Create requires authenticated user and reported_by_uid == request.auth.uid.
- report_type is constrained to broken_image or broken_stream.
- issue_field must match report_type (thumbnail_link/background_link for broken_image, stream_link for broken_stream).
- Immutable after create: movie_id, movie_title_raw, report_type, issue_field, issue_link, reported_by_uid, created_at.
- Current rules allow admin-only status/admin_note/resolved_at updates; admin-dashboard UI may intentionally keep reports read-only and hide action controls.

## Rules Implementation Expectations
- Add helper functions in Firestore rules, for example: isSignedIn(), userRole(), isAdmin(), isOwner(uid).
- Keep predicates small and composable; reuse shared checks.
- Avoid duplicated inline role logic across multiple match blocks.
- Prefer explicit allow statements per operation (get/list/create/update/delete).

## App-Layer Requirements
- Do not rely on UI-only hiding of admin features.
- Mirror rule constraints in app validation for faster feedback.
- In admin-dashboard, keep route guards, Zustand role state, and the Firestore service layer aligned. The auth preflight helper in admin-dashboard/src/lib/firestore.ts is diagnostic only and does not replace rules enforcement.
- Treat Firestore permission-denied responses as expected control flow and handle gracefully.

## Testing And Verification
When rules or auth logic change, verify at minimum:
- guest/user/admin access for each collection path above;
- user cannot read/write another user's devices;
- user cannot modify role or uid in users/{uid};
- user cannot update/delete reports and cannot create reports for another uid;
- admin reports list access remains limited to admin role;
- admin can perform full management operations;
- denied operations fail with permission-denied.
- movie create/update continues to require stored id alignment with the document id.

## Change Management
- Any schema or role behavior change must update both:
  - Firestore rules policy.
  - This instruction and the project data-contract instruction if field constraints changed.
