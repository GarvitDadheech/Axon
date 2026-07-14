import { query, queryOne } from "@/lib/db";

export interface DBUser {
  id: number;
  particle_user_id: string;
  email: string | null;
  wallet_address: string;
  ua_address: string | null;
  openfort_wallet_id: string | null;
  openfort_wallet_address: string | null;
  server_signing_enabled: boolean;
  max_per_call: string | null;
  max_per_day: string | null;
  created_at: Date;
  updated_at: Date;
}

export async function findUserByParticleId(particleUserId: string): Promise<DBUser | null> {
  return queryOne<DBUser>(
    "SELECT * FROM users WHERE particle_user_id = $1",
    [particleUserId]
  );
}

export async function upsertUser(
  particleUserId: string,
  walletAddress: string,
  email?: string | null
): Promise<DBUser> {
  const row = await queryOne<DBUser>(
    `INSERT INTO users (particle_user_id, wallet_address, ua_address, email, server_signing_enabled)
     VALUES ($1, $2, $2, $3, FALSE)
     ON CONFLICT (particle_user_id)
     DO UPDATE SET
       wallet_address = EXCLUDED.wallet_address,
       ua_address = COALESCE(users.ua_address, EXCLUDED.ua_address),
       email = COALESCE(EXCLUDED.email, users.email),
       updated_at = NOW()
     RETURNING *`,
    [particleUserId, walletAddress, email ?? null]
  );
  return row!;
}

export async function setOpenfortWallet(
  userId: number,
  openfortWalletId: string,
  openfortWalletAddress: string
): Promise<DBUser> {
  const row = await queryOne<DBUser>(
    `UPDATE users
     SET openfort_wallet_id = $2,
         openfort_wallet_address = $3,
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [userId, openfortWalletId, openfortWalletAddress]
  );
  return row!;
}

export async function enableServerSigning(
  userId: number,
  enabled: boolean,
  maxPerCall?: string,
  maxPerDay?: string
): Promise<DBUser> {
  const toUsdc = (v?: string) => {
    if (v == null || v === "") return null;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) return null;
    return n.toFixed(2);
  };

  const row = await queryOne<DBUser>(
    `UPDATE users
     SET server_signing_enabled = $2,
         max_per_call = $3,
         max_per_day = $4,
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [userId, enabled, toUsdc(maxPerCall), toUsdc(maxPerDay)]
  );
  return row!;
}

export async function findUserById(id: number): Promise<DBUser | null> {
  return queryOne<DBUser>("SELECT * FROM users WHERE id = $1", [id]);
}
