---
description: "Use when changing admin user auth lifecycle behavior across dashboard and Cloud Functions. Defines manual Firebase Auth provisioning + UID profile create flow, callable endpoint boundaries, and verification expectations."
applyTo: "{admin-dashboard/**,functions/**,firebase/**,firebase.json,README.md}"
---

# Admin Auth Lifecycle Guidelines

## Purpose
Keep admin user-management behavior aligned between dashboard UI, Firestore profile data, and Cloud Functions auth lifecycle endpoints.

## Current Product Decision
- Firebase Auth accounts are provisioned manually in Firebase Authentication.
- Admin dashboard user create form writes Firestore profile only and requires UID from existing Auth account.
- Dashboard must not collect or store password for user creation.

## Firestore Profile Contract
- Create under users/{uid} with fields:
  - uid
  - username
  - role (guest | user | admin)
  - created_at (ISO-8601 UTC string)
  - account_status (active | disabled, optional on legacy docs)

## Callable Endpoint Boundaries
- Keep auth lifecycle operations in Cloud Functions only.
- Supported callables:
  - adminSetUserDisabled
  - adminGeneratePasswordResetLink
  - adminDeleteAuthUser
- Do not reintroduce adminCreateAuthUser unless product explicitly changes back to dashboard-driven auth creation.

## Security Requirements
- Every callable must verify caller auth and admin role via users/{request.auth.uid}.role.
- Keep role checks server-side even when UI already hides controls.
- Treat missing Auth user as handled control flow where appropriate (for example delete behavior).

## Client Integration Rules
- Use Firebase Functions SDK httpsCallable from admin-dashboard.
- Do not use raw fetch to cloudfunctions.net callable endpoints from browser UI.
- Surface actionable errors for:
  - permission-denied
  - unauthenticated
  - failed-precondition
  - not-found or equivalent mapped errors

## Verification Checklist
- admin-dashboard typecheck and lint pass.
- Emulator smoke path validates disable/reset/delete callable flow.
- Manual UI check confirms:
  - create profile with manual UID
  - disable/enable toggles account status
  - reset password returns usable reset link
  - delete removes profile and device subcollection and attempts auth deletion
