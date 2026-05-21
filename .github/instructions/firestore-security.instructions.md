---
description: "Use when creating or changing Firestore security rules, authorization logic, role checks, and access control behavior for Movie-streaming. Defines the role-based access matrix for guest/user/admin across movies, users, and devices data."
applyTo: "{admin-dashboard/**,android-app-tv/**,extension/**,extensions/**,firestore.rules,firestore.rules.*,firebase/**}"
---

# Firestore Security And Role Access Matrix

## Purpose
Use this instruction for all authorization decisions. Keep Firestore Security Rules and application-level role checks aligned.

## Identity And Role Source
- Require Firebase Authentication for all write operations.
- Resolve role from users/{request.auth.uid}.role for rule decisions.
- Treat role as one of guest, user, admin only.
- Deny if role is missing or not in the allowed enum.

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
- Require tracking_history entries to include movie_id, last_watched_at, current_position_seconds.
- Require current_position_seconds >= 0.

For movies/{movieId} writes:
- Admin only.
- Enforce enum values for type, stream_connections[].status, stream_connections[].type where feasible.

## Rules Implementation Expectations
- Add helper functions in Firestore rules, for example: isSignedIn(), userRole(), isAdmin(), isOwner(uid).
- Keep predicates small and composable; reuse shared checks.
- Avoid duplicated inline role logic across multiple match blocks.
- Prefer explicit allow statements per operation (get/list/create/update/delete).

## App-Layer Requirements
- Do not rely on UI-only hiding of admin features.
- Mirror rule constraints in app validation for faster feedback.
- Treat Firestore permission-denied responses as expected control flow and handle gracefully.

## Testing And Verification
When rules or auth logic change, verify at minimum:
- guest/user/admin access for each collection path above;
- user cannot read/write another user's devices;
- user cannot modify role or uid in users/{uid};
- admin can perform full management operations;
- denied operations fail with permission-denied.

## Change Management
- Any schema or role behavior change must update both:
  - Firestore rules policy.
  - This instruction and the project data-contract instruction if field constraints changed.
