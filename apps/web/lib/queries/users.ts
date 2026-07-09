import { query, queryOne } from "@/lib/db";

export interface DBUser {
  id: number;
  magic_issuer: string;
  email: string | null;
  wallet_address: string;
  ua_address: string | null;
  openfort_wallet_id: string | null;
  server_signing_enabled: boolean;
  max_per_call: string | null;
  max_per_day: string | null;
  created_at: Date;
  updated_at: Date;
}

export async function findUserByMagicIssuer(magicIssuer: string): Promise<DBUser | null> {
  return queryOne<DBUser>(
    "SELECT * FROM users WHERE magic_issuer = $1",
    [magicIssuer]
  );
}

export async function upsertUser(
  magicIssuer: string,
  walletAddress: string,
  email?: string | null
): Promise<DBUser> {
  const row = await queryOne<DBUser>(
    `INSERT INTO users (magic_issuer, wallet_address, ua_address, email, server_signing_enabled)
     VALUES ($1, $2, $2, $3, TRUE)
     ON CONFLICT (magic_issuer)
     DO UPDATE SET
       wallet_address = EXCLUDED.wallet_address,
       ua_address = COALESCE(users.ua_address, EXCLUDED.ua_address),
       email = COALESCE(EXCLUDED.email, users.email),
       updated_at = NOW()
     RETURNING *`,
    [magicIssuer, walletAddress, email ?? null]
  );
  return row!;
}

export async function setOpenfortWallet(userId: number, openfortWalletId: string): Promise<DBUser> {
  const row = await queryOne<DBUser>(
    `UPDATE users SET openfort_wallet_id = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
    [userId, openfortWalletId]
  );
  return row!;
}

export async function enableServerSigning(
  userId: number,
  enabled: boolean,
  maxPerCall?: string,
  maxPerDay?: string
): Promise<DBUser> {
  const row = await queryOne<DBUser>(
    `UPDATE users
     SET server_signing_enabled = $2,
         max_per_call = $3,
         max_per_day = $4,
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [userId, enabled, maxPerCall ?? null, maxPerDay ?? null]
  );
  return row!;
}

export async function findUserById(id: number): Promise<DBUser | null> {
  return queryOne<DBUser>("SELECT * FROM users WHERE id = $1", [id]);
}
