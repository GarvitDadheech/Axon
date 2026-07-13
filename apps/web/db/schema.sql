-- Axon Dashboard Schema (Particle Auth + Openfort agent wallets)

CREATE TABLE IF NOT EXISTS users (
  id               SERIAL PRIMARY KEY,
  particle_user_id TEXT NOT NULL UNIQUE,
  email            TEXT,
  wallet_address   TEXT NOT NULL,
  ua_address       TEXT,
  openfort_wallet_id TEXT,
  openfort_wallet_address TEXT,
  server_signing_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  max_per_call     NUMERIC(36, 18),
  max_per_day      NUMERIC(36, 18),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS apis (
  id               SERIAL PRIMARY KEY,
  owner_user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  description      TEXT,
  endpoint_url     TEXT NOT NULL,
  price_per_call   NUMERIC(36, 18) NOT NULL DEFAULT 0,
  chain            TEXT NOT NULL DEFAULT 'arbitrum-sepolia',
  is_public        BOOLEAN NOT NULL DEFAULT TRUE,
  sample_request   JSONB,
  sample_response  JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS api_calls (
  id                  SERIAL PRIMARY KEY,
  user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  api_id              INTEGER NOT NULL REFERENCES apis(id) ON DELETE CASCADE,
  tx_hash             TEXT,
  amount_spent        NUMERIC(36, 18) NOT NULL DEFAULT 0,
  platform_fee        NUMERIC(36, 18) NOT NULL DEFAULT 0,
  status              TEXT NOT NULL DEFAULT 'pending',
  request_payload     JSONB,
  response_metadata   JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_calls_user_id  ON api_calls(user_id);
CREATE INDEX IF NOT EXISTS idx_api_calls_api_id   ON api_calls(api_id);
CREATE INDEX IF NOT EXISTS idx_api_calls_status   ON api_calls(status);
CREATE INDEX IF NOT EXISTS idx_apis_owner_user_id ON apis(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_apis_is_public     ON apis(is_public);
