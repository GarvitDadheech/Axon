import { Pool } from "pg";

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 15_000,
      // Supabase (and many managed Postgres hosts) use certs that fail default Node verify
      ssl:
        /supabase\.co|pooler\.supabase\.com/.test(
          process.env.DATABASE_URL ?? ""
        ) || process.env.PGSSLMODE === "require"
          ? { rejectUnauthorized: false }
          : undefined,
    });
  }
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
