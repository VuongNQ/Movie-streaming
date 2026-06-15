CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('guest', 'user', 'admin');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'account_status') THEN
    CREATE TYPE account_status AS ENUM ('active', 'disabled');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'movie_type') THEN
    CREATE TYPE movie_type AS ENUM ('single_movie', 'tv_series', 'franchise');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'audio_type') THEN
    CREATE TYPE audio_type AS ENUM ('dubbing', 'subtitle');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'stream_status') THEN
    CREATE TYPE stream_status AS ENUM ('live', 'dead');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_type') THEN
    CREATE TYPE report_type AS ENUM ('broken_image', 'broken_stream');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_issue_field') THEN
    CREATE TYPE report_issue_field AS ENUM ('thumbnail_link', 'background_link', 'stream_link');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_status') THEN
    CREATE TYPE report_status AS ENUM ('open', 'in_progress', 'resolved');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS users (
  uid TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL,
  role user_role NOT NULL,
  account_status account_status NOT NULL DEFAULT 'active',
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS users_role_idx ON users (role);

CREATE TABLE IF NOT EXISTS movies (
  id TEXT PRIMARY KEY,
  title TEXT,
  title_raw TEXT NOT NULL,
  title_vietnamese TEXT,
  title_search_keywords TEXT[] NOT NULL DEFAULT '{}',
  title_vietnamese_search_keywords TEXT[] NOT NULL DEFAULT '{}',
  description TEXT NOT NULL,
  thumbnail_link TEXT NOT NULL,
  background_link TEXT NOT NULL,
  type movie_type NOT NULL,
  year INTEGER NOT NULL,
  episode_count INTEGER NOT NULL,
  actors TEXT[] NOT NULL DEFAULT '{}',
  audio_types audio_type[] NOT NULL DEFAULT '{}',
  genres TEXT[] NOT NULL DEFAULT '{}',
  franchise_movie_ids TEXT[] NOT NULL DEFAULT '{}',
  stream_connections JSONB NOT NULL DEFAULT '[]'::jsonb,
  youtube_trailer_link TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS movies_year_idx ON movies (year);
CREATE INDEX IF NOT EXISTS movies_type_idx ON movies (type);
CREATE INDEX IF NOT EXISTS movies_keywords_gin_idx ON movies USING gin (title_search_keywords);
CREATE INDEX IF NOT EXISTS movies_vn_keywords_gin_idx ON movies USING gin (title_vietnamese_search_keywords);
CREATE INDEX IF NOT EXISTS movies_genres_gin_idx ON movies USING gin (genres);

CREATE TABLE IF NOT EXISTS devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uid TEXT NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
  device_name TEXT NOT NULL,
  playlist TEXT[] NOT NULL DEFAULT '{}',
  tracking_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS devices_uid_idx ON devices (uid);

CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  movie_id TEXT NOT NULL,
  movie_title_raw TEXT NOT NULL,
  report_type report_type NOT NULL,
  issue_field report_issue_field NOT NULL,
  issue_link TEXT NOT NULL,
  status report_status NOT NULL DEFAULT 'open',
  reported_by_uid TEXT NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
  note TEXT,
  admin_note TEXT,
  preview_status stream_status,
  preview_error_message TEXT,
  preview_metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS reports_movie_id_created_at_idx ON reports (movie_id, created_at DESC);
CREATE INDEX IF NOT EXISTS reports_status_created_at_idx ON reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS reports_type_created_at_idx ON reports (report_type, created_at DESC);
CREATE INDEX IF NOT EXISTS reports_reported_by_uid_idx ON reports (reported_by_uid);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uid TEXT NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS password_reset_tokens_uid_idx ON password_reset_tokens (uid);
CREATE INDEX IF NOT EXISTS password_reset_tokens_expires_at_idx ON password_reset_tokens (expires_at);
