# SQL API (PostgreSQL + Express)

Initial implementation of the SQL backend foundation for Movie-streaming.

## Scope in this slice

- PostgreSQL migration runner and initial schema.
- SQL-backed authentication login endpoint with JWT issuance.
- Admin lifecycle endpoints for disable user, generate password reset link, and delete user profile/devices.
- Health endpoint and runtime config validation.

## Quick start

1. Copy `.env.example` to `.env` and update values.
2. Install dependencies:

```bash
npm install
```

3. Run migrations:

```bash
npm run db:create
npm run migrate
```

If migration fails with `28P01` (password authentication failed), update `DB_USER` and `DB_PASSWORD` in `.env` to match your local PostgreSQL credentials.

4. Start service:

```bash
npm run dev
```

## Endpoints

- `GET /healthz`
- `POST /auth/login`
- `GET /auth/me`
- `PATCH /admin/users/:uid/disabled`
- `POST /admin/users/:uid/reset-link`
- `DELETE /admin/users/:uid`

## Notes

- Admin endpoints require `Authorization: Bearer <token>` and `role=admin` in JWT claims.
- Password reset currently returns a generated reset URL and stores only hashed token material.
- This service is not wired to admin-dashboard yet; existing Firestore paths remain unchanged.
