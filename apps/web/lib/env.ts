/**
 * Single-source env accessor for all server-side code.
 * Throws early (at first use) if a required variable is missing so the
 * error surfaces clearly in logs rather than as a cryptic downstream failure.
 *
 * Magic and DATABASE_URL are required — the app can't boot without auth/DB.
 * Particle, Openfort and the shared payer key are optional: when absent,
 * lib/particle-ua.ts / lib/openfort.ts fall back to stub mode so the demo
 * still runs end-to-end without live sponsor credentials.
 */

interface ServerEnv {
  MAGIC_SECRET_KEY: string;
  DATABASE_URL: string;

  ARBITRUM_RPC_URL: string;
  ARBITRUM_USDC_ADDRESS: string;

  PARTICLE_PROJECT_ID: string;
  PARTICLE_CLIENT_KEY: string;
  PARTICLE_APP_ID: string;

  OPENFORT_SECRET_KEY: string;

  /** Fallback shared operator wallet, used when a call isn't attributable
   *  to an authenticated user's Openfort agent wallet. */
  PAYER_PRIVATE_KEY: string;
}

let _cached: ServerEnv | null = null;

function require(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required environment variable: ${key}`);
  return val;
}

function optional(key: string, fallback = ""): string {
  return process.env[key] ?? fallback;
}

export function env(): ServerEnv {
  if (_cached) return _cached;
  _cached = {
    MAGIC_SECRET_KEY: require("MAGIC_SECRET_KEY"),
    DATABASE_URL: require("DATABASE_URL"),

    ARBITRUM_RPC_URL: optional(
      "ARBITRUM_RPC_URL",
      "https://sepolia-rollup.arbitrum.io/rpc"
    ),
    // Native USDC on Arbitrum Sepolia testnet.
    ARBITRUM_USDC_ADDRESS: optional(
      "ARBITRUM_USDC_ADDRESS",
      "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d"
    ),

    PARTICLE_PROJECT_ID: optional("PARTICLE_PROJECT_ID"),
    PARTICLE_CLIENT_KEY: optional("PARTICLE_CLIENT_KEY"),
    PARTICLE_APP_ID: optional("PARTICLE_APP_ID"),

    OPENFORT_SECRET_KEY: optional("OPENFORT_SECRET_KEY"),

    PAYER_PRIVATE_KEY: optional("PAYER_PRIVATE_KEY"),
  };
  return _cached;
}

/** True once real (non-stub) Particle Universal Account credentials are configured. */
export function particleConfigured(): boolean {
  const e = env();
  return Boolean(e.PARTICLE_PROJECT_ID && e.PARTICLE_CLIENT_KEY && e.PARTICLE_APP_ID);
}

/** True once a real Openfort secret key is configured. */
export function openfortConfigured(): boolean {
  return Boolean(env().OPENFORT_SECRET_KEY);
}
