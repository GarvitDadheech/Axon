/**
 * Single-source env accessor for server-side code.
 *
 * Required: Particle Auth (project + server key) + DATABASE_URL.
 * Openfort required for real agent payments.
 */

interface ServerEnv {
  DATABASE_URL: string;

  PARTICLE_PROJECT_ID: string;
  PARTICLE_CLIENT_KEY: string;
  PARTICLE_APP_ID: string;
  PARTICLE_SERVER_KEY: string;

  ARBITRUM_RPC_URL: string;
  ARBITRUM_USDC_ADDRESS: string;

  OPENFORT_SECRET_KEY: string;
  OPENFORT_WALLET_SECRET: string;
  OPENFORT_POLICY_ID: string;
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

/**
 * Openfort expects a base64-encoded EC P-256 private key in DER format —
 * NOT a PEM block. Dashboard copy often includes PEM headers or escaped `\n`.
 * @see https://www.openfort.io/docs
 */
export function normalizeOpenfortWalletSecret(raw: string): string {
  if (!raw) return raw;
  let s = raw.trim();
  // Quoted values sometimes retain literal \n sequences
  if (s.includes("\\n")) s = s.replace(/\\n/g, "\n");
  s = s.replace(/\\r/g, "").replace(/\r/g, "");
  if (s.includes("BEGIN") && s.includes("PRIVATE KEY")) {
    s = s
      .replace(/-----BEGIN [^-]+-----/g, "")
      .replace(/-----END [^-]+-----/g, "");
  }
  return s.replace(/\s+/g, "");
}

export function env(): ServerEnv {
  if (_cached) return _cached;
  _cached = {
    DATABASE_URL: require("DATABASE_URL"),

    PARTICLE_PROJECT_ID: optional(
      "PARTICLE_PROJECT_ID",
      process.env.NEXT_PUBLIC_PARTICLE_PROJECT_ID ?? ""
    ),
    PARTICLE_CLIENT_KEY: optional(
      "PARTICLE_CLIENT_KEY",
      process.env.NEXT_PUBLIC_PARTICLE_CLIENT_KEY ?? ""
    ),
    PARTICLE_APP_ID: optional(
      "PARTICLE_APP_ID",
      process.env.NEXT_PUBLIC_PARTICLE_APP_ID ?? ""
    ),
    PARTICLE_SERVER_KEY: require("PARTICLE_SERVER_KEY"),

    ARBITRUM_RPC_URL: optional(
      "ARBITRUM_RPC_URL",
      "https://sepolia-rollup.arbitrum.io/rpc"
    ),
    ARBITRUM_USDC_ADDRESS: optional(
      "ARBITRUM_USDC_ADDRESS",
      "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d"
    ),

    OPENFORT_SECRET_KEY: optional("OPENFORT_SECRET_KEY"),
    OPENFORT_WALLET_SECRET: normalizeOpenfortWalletSecret(
      optional("OPENFORT_WALLET_SECRET")
    ),
    OPENFORT_POLICY_ID: optional("OPENFORT_POLICY_ID"),
  };

  if (!_cached.PARTICLE_PROJECT_ID) {
    throw new Error("Missing PARTICLE_PROJECT_ID / NEXT_PUBLIC_PARTICLE_PROJECT_ID");
  }
  if (!_cached.PARTICLE_CLIENT_KEY) {
    throw new Error("Missing PARTICLE_CLIENT_KEY / NEXT_PUBLIC_PARTICLE_CLIENT_KEY");
  }
  if (!_cached.PARTICLE_APP_ID) {
    throw new Error("Missing PARTICLE_APP_ID / NEXT_PUBLIC_PARTICLE_APP_ID");
  }

  return _cached;
}

export function particleConfigured(): boolean {
  try {
    const e = env();
    return Boolean(e.PARTICLE_PROJECT_ID && e.PARTICLE_CLIENT_KEY && e.PARTICLE_APP_ID);
  } catch {
    return false;
  }
}

export function openfortConfigured(): boolean {
  try {
    const e = env();
    return Boolean(e.OPENFORT_SECRET_KEY && e.OPENFORT_WALLET_SECRET);
  } catch {
    return false;
  }
}
