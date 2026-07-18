-- ============================================================
-- Axon — Supabase init.sql
-- Paste this entire file into the Supabase SQL editor and run.
-- Safe to re-run: all statements use IF NOT EXISTS / OR REPLACE.
-- ============================================================


-- ------------------------------------------------------------
-- Tables
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
  id                     SERIAL PRIMARY KEY,
  particle_user_id       TEXT    NOT NULL UNIQUE,
  email                  TEXT,
  wallet_address         TEXT    NOT NULL,
  ua_address             TEXT,
  openfort_wallet_id     TEXT,
  openfort_wallet_address TEXT,
  server_signing_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  max_per_call           NUMERIC(36, 18),
  max_per_day            NUMERIC(36, 18),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS apis (
  id             SERIAL PRIMARY KEY,
  owner_user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name           TEXT    NOT NULL,
  description    TEXT,
  endpoint_url   TEXT    NOT NULL,
  price_per_call NUMERIC(36, 18) NOT NULL DEFAULT 0,
  chain          TEXT    NOT NULL DEFAULT 'arbitrum-sepolia',
  is_public      BOOLEAN NOT NULL DEFAULT TRUE,
  sample_request  JSONB,
  sample_response JSONB,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS api_calls (
  id                SERIAL PRIMARY KEY,
  user_id           INTEGER NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  api_id            INTEGER NOT NULL REFERENCES apis(id)   ON DELETE CASCADE,
  tx_hash           TEXT,
  amount_spent      NUMERIC(36, 18) NOT NULL DEFAULT 0,
  platform_fee      NUMERIC(36, 18) NOT NULL DEFAULT 0,
  status            TEXT    NOT NULL DEFAULT 'pending',
  request_payload   JSONB,
  response_metadata JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ------------------------------------------------------------
-- Indexes
-- ------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_apis_owner_user_id  ON apis(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_apis_is_public      ON apis(is_public);
CREATE INDEX IF NOT EXISTS idx_api_calls_user_id   ON api_calls(user_id);
CREATE INDEX IF NOT EXISTS idx_api_calls_api_id    ON api_calls(api_id);
CREATE INDEX IF NOT EXISTS idx_api_calls_status    ON api_calls(status);


-- ------------------------------------------------------------
-- Auto-update updated_at trigger
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_apis_updated_at ON apis;
CREATE TRIGGER trg_apis_updated_at
  BEFORE UPDATE ON apis
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ------------------------------------------------------------
-- Row Level Security
-- Supabase exposes tables via the public schema by default.
-- Enable RLS so rows are not accessible without a policy.
-- Your server connects via the service_role key (bypasses RLS),
-- so these policies only matter for direct client/anon access.
-- ------------------------------------------------------------

ALTER TABLE users     ENABLE ROW LEVEL SECURITY;
ALTER TABLE apis      ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_calls ENABLE ROW LEVEL SECURITY;

-- Public read for apis (marketplace listing)
DROP POLICY IF EXISTS "public apis are readable by anyone" ON apis;
CREATE POLICY "public apis are readable by anyone"
  ON apis FOR SELECT
  USING (is_public = TRUE);

-- No direct anon writes — all mutations go through the server (service_role)
-- Add more granular policies here if you ever expose the Supabase client directly.
