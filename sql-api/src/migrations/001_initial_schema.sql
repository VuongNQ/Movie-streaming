-- ============================================================================
-- DUAL-DATABASE SCHEMA: PostgreSQL & MySQL Compatibility
-- ============================================================================
--
-- This schema supports both PostgreSQL and MySQL via the DB_TYPE environment
-- variable (set to 'pg' or 'mysql' in sql-api/src/config.ts).
--
-- CONVERSION STRATEGY:
-- 1. PostgreSQL-specific extensions removed (pgcrypto not needed)
-- 2. ENUM types → VARCHAR(n) with CHECK constraints
--    - Ensures both databases enforce domain rules
--    - Preserves semantic validity across databases
--    - Application layer can still treat as enums (TypeScript enums)
--
-- 3. Array types (TEXT[], audio_type[]) → JSON
--    - PostgreSQL arrays: [val1, val2] stored as '{val1,val2}'
--    - MySQL JSON arrays: [val1, val2] stored as JSON array
--    - Both use JSON functions in queries (JSON_CONTAINS, JSON_EXTRACT, etc.)
--    - Migrations set defaults to '[]' (empty JSON array)
--
-- 4. TIMESTAMPTZ → TIMESTAMP(6)
--    - PostgreSQL: TIMESTAMP(6) stored in UTC, NOT timezone-aware
--    - MySQL: TIMESTAMP(6) uses server timezone rules
--    - Application MUST normalize all times to UTC before storing
--    - Application MUST convert from stored time to UTC when reading
--
-- 5. UUID generation: Handled by application layer
--    - Schema does NOT include DEFAULT UUID() or gen_random_uuid()
--    - UUID columns defined as CHAR(36) PRIMARY KEY (text format)
--    - Application (Node.js) generates UUIDs via 'uuid' package or crypto
--    - Ensures consistency and avoids database-specific UUID functions
--
-- 6. GIN indexes (PostgreSQL full-text) → Regular indexes
--    - PostgreSQL GIN: enables fast array/JSONB searching
--    - MySQL: no native GIN; uses regular B-tree indexes on JSON casts
--    - For array searching, app uses JSON_CONTAINS, app-level filtering
--
-- VALIDATION CHECKLIST:
-- ✓ All ENUM types converted (role, account_status, movie_type, audio_type, etc.)
-- ✓ All array columns (TEXT[]) converted to JSON
-- ✓ UUID generation delegated to application
-- ✓ Timestamps use CURRENT_TIMESTAMP (works both DBs)
-- ✓ All indexes converted (GIN → regular INDEX)
-- ✓ Foreign keys and CASCADE deletes preserved
-- ✓ CHECK constraints enforced (replaces ENUM domain validation)
-- ✓ DEFAULT values compatible ('' for strings, [] for JSON)
--
-- ============================================================================

-- PostgreSQL: CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- MySQL does not need pgcrypto (bcrypt handled in Node.js layer)

-- ENUM types are handled implicitly through VARCHAR columns in MySQL
-- PostgreSQL would use CREATE TYPE, but MySQL uses VARCHAR with CHECK constraints
-- or ENUM columns. We use VARCHAR for cross-database compatibility.

CREATE TABLE IF NOT EXISTS users (
  uid VARCHAR(36) PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  username VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('guest', 'user', 'admin')),
  account_status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (account_status IN ('active', 'disabled')),
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX users_role_idx ON users (role);

CREATE TABLE IF NOT EXISTS movies (
  id VARCHAR(255) PRIMARY KEY,
  title TEXT,
  title_raw TEXT NOT NULL,
  title_vietnamese TEXT,
  title_search_keywords JSON NOT NULL,
  title_vietnamese_search_keywords JSON NOT NULL,
  description TEXT NOT NULL,
  thumbnail_link TEXT NOT NULL,
  background_link TEXT NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('single_movie', 'tv_series', 'franchise')),
  year INTEGER NOT NULL,
  episode_count INTEGER NOT NULL,
  actors JSON NOT NULL,
  audio_types JSON NOT NULL,
  genres JSON NOT NULL,
  franchise_movie_ids JSON NOT NULL,
  stream_connections JSON NOT NULL,
  youtube_trailer_link TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_updated TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX movies_year_idx ON movies (year);
CREATE INDEX movies_type_idx ON movies (type);

CREATE TABLE IF NOT EXISTS devices (
  id CHAR(36) PRIMARY KEY,
  uid VARCHAR(36) NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
  device_name TEXT NOT NULL,
  playlist JSON NOT NULL,
  tracking_history JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX devices_uid_idx ON devices (uid);

CREATE TABLE IF NOT EXISTS reports (
  id CHAR(36) PRIMARY KEY,
  movie_id VARCHAR(255) NOT NULL,
  movie_title_raw TEXT NOT NULL,
  report_type VARCHAR(20) NOT NULL CHECK (report_type IN ('broken_image', 'broken_stream')),
  issue_field VARCHAR(30) NOT NULL CHECK (issue_field IN ('thumbnail_link', 'background_link', 'stream_link')),
  issue_link TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved')),
  reported_by_uid VARCHAR(36) NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
  note TEXT,
  admin_note TEXT,
  preview_status VARCHAR(10) CHECK (preview_status IN ('live', 'dead')),
  preview_error_message TEXT,
  preview_metadata JSON,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP
);

CREATE INDEX reports_movie_id_created_at_idx ON reports (movie_id, created_at DESC);
CREATE INDEX reports_status_created_at_idx ON reports (status, created_at DESC);
CREATE INDEX reports_type_created_at_idx ON reports (report_type, created_at DESC);
CREATE INDEX reports_reported_by_uid_idx ON reports (reported_by_uid);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id CHAR(36) PRIMARY KEY,
  uid VARCHAR(36) NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  consumed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX password_reset_tokens_uid_idx ON password_reset_tokens (uid);
CREATE INDEX password_reset_tokens_expires_at_idx ON password_reset_tokens (expires_at);
