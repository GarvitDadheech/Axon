import { Pool } from "pg";

/**
 * Supabase Session pooler caps ~15 clients. Next/Vercel can spawn many
 * isolates, each with its own Pool — keep max tiny and reuse via globalThis.
 * Prefer Transaction pooler (port 6543) in DATABASE_URL for serverless.
 */
const globalForPg = globalThis as typeof globalThis & {
  __axonPgPool?: Pool;
};

function isSupabase(url: string | undefined): boolean {
  return /supabase\.co|pooler\.supabase\.com/.test(url ?? "");
}

function isServerless(): boolean {
  return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
}

export function getPool(): Pool {
  if (globalForPg.__axonPgPool) return globalForPg.__axonPgPool;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Missing DATABASE_URL");
  }

  const pool = new Pool({
    connectionString,
    // Session mode: many small pools exhaust Supabase fast. Cap hard.
    max: isServerless() || isSupabase(connectionString) ? 1 : 5,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 15_000,
    allowExitOnIdle: true,
    ssl: isSupabase(connectionString) || process.env.PGSSLMODE === "require"
      ? { rejectUnauthorized: false }
      : undefined,
  });

  globalForPg.__axonPgPool = pool;
  return pool;
}

export async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const client = getPool();
  const res = await client.query(text, params);
  return res.rows as T[];
}

export async function queryOne<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}
