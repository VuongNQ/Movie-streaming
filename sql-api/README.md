# SQL API (PostgreSQL + MySQL + Express)

Initial implementation of the SQL backend foundation for Movie-streaming with support for both PostgreSQL and MySQL drivers.

## Scope in this slice

- Dual-driver database support (PostgreSQL or MySQL via `DB_TYPE` env var).
- SQL migration runner and initial schema (compatible with both databases).
- SQL-backed authentication login endpoint with JWT issuance.
- Admin lifecycle endpoints for disable user, generate password reset link, and delete user profile/devices.
- Health endpoint and runtime config validation.

## Quick start

### PostgreSQL (default)

1. Copy `.env.example` to `.env` and update values:

```bash
DB_TYPE=pg
DB_PORT=5432
DB_HOST=localhost
DB_NAME=movie_streaming
DB_USER=postgres
DB_PASSWORD=your-postgres-password
```

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

### MySQL

1. Copy `.env.example` to `.env` and update values:

```bash
DB_TYPE=mysql
DB_PORT=3306
DB_HOST=localhost
DB_NAME=movie_streaming
DB_USER=root
DB_PASSWORD=root
```

2. Install dependencies:

```bash
npm install
```

3. Run migrations:

```bash
npm run db:create
npm run migrate
```

If migration fails with connection errors, verify your MySQL server is running and credentials match your local MySQL setup.

4. Start service:

```bash
npm run dev
```

## Database Driver Selection

Use the `DB_TYPE` environment variable to select between drivers:

- `DB_TYPE=pg` (default): Uses PostgreSQL driver
- `DB_TYPE=mysql`: Uses MySQL driver

Both drivers use the same schema and endpoints. Only one driver can be active at a time. The application requires the selected database type to be running before startup.

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

## Schema Design & Dual-Database Compatibility

The initial schema (`src/migrations/001_initial_schema.sql`) is designed to work with both PostgreSQL and MySQL using a single SQL file. Key conversion strategies:

### ENUM Types
- **Conversion:** PostgreSQL `CREATE TYPE` → MySQL `VARCHAR(n)` with `CHECK` constraints
- **Example:** `role VARCHAR(20) CHECK (role IN ('guest', 'user', 'admin'))`
- **Benefit:** Both databases enforce the domain rules, application can still use TypeScript enums

### Array Types
- **Conversion:** PostgreSQL `TEXT[]` → JSON
- **Default:** Empty arrays stored as `[]` (JSON literal)
- **Queries:** Use JSON functions (`JSON_CONTAINS`, `JSON_EXTRACT`, etc.) across both databases
- **Example:** `actors JSON NOT NULL DEFAULT '[]'`

### Timestamps
- **Conversion:** `TIMESTAMPTZ` → `TIMESTAMP(6)`
- **Important:** Both databases store in local/UTC context; application must normalize to UTC layer
- **Default:** `CURRENT_TIMESTAMP` works identically on both databases

### UUID Generation
- **Strategy:** Delegated to application layer (Node.js `uuid` package)
- **Reason:** Avoids database-specific functions (`gen_random_uuid` vs `UUID()`)
- **Schema:** UUIDs stored as `CHAR(36)` PRIMARY KEY (text format for portability)

### Indexes
- **GIN Indexes:** PostgreSQL full-text indexes converted to regular indexes
- **Reason:** MySQL does not support GIN; uses B-tree indexes on JSON casts
- **Query Strategy:** Use application-level filtering for complex array/JSON searches
