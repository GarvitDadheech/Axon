import { query, queryOne } from "@/lib/db";

export interface DBApiCall {
  id: number;
  user_id: number;
  api_id: number;
  tx_hash: string | null;
  amount_spent: string;
  platform_fee: string;
  status: "pending" | "success" | "failed";
  request_payload: Record<string, unknown> | null;
  response_metadata: Record<string, unknown> | null;
  created_at: Date;
  api_name?: string;
}

export async function insertApiCall(params: {
  userId: number;
  apiId: number;
  txHash?: string;
  amountSpent: string;
  platformFee: string;
  status: "pending" | "success" | "failed";
  requestPayload?: Record<string, unknown>;
  responseMetadata?: Record<string, unknown>;
}): Promise<DBApiCall> {
  const row = await queryOne<DBApiCall>(
    `INSERT INTO api_calls
       (user_id, api_id, tx_hash, amount_spent, platform_fee, status, request_payload, response_metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      params.userId,
      params.apiId,
      params.txHash ?? null,
      params.amountSpent,
      params.platformFee,
      params.status,
      params.requestPayload ? JSON.stringify(params.requestPayload) : null,
      params.responseMetadata ? JSON.stringify(params.responseMetadata) : null,
    ]
  );
  return row!;
}

export async function listCallsForUser(userId: number, limit = 50): Promise<DBApiCall[]> {
  return query<DBApiCall>(
    `SELECT ac.*, a.name AS api_name
     FROM api_calls ac
     JOIN apis a ON a.id = ac.api_id
     WHERE ac.user_id = $1
     ORDER BY ac.created_at DESC
     LIMIT $2`,
    [userId, limit]
  );
}

export interface UserStats {
  total_spent: string;
  total_calls: string;
  successful_calls: string;
  failed_calls: string;
  total_fees: string;
}

export async function getUserStats(userId: number): Promise<UserStats> {
  const row = await queryOne<UserStats>(
    `SELECT
       COALESCE(SUM(CASE WHEN status = 'success' THEN amount_spent ELSE 0 END), 0)::TEXT AS total_spent,
       COUNT(*)::TEXT AS total_calls,
       COUNT(CASE WHEN status = 'success' THEN 1 END)::TEXT AS successful_calls,
       COUNT(CASE WHEN status = 'failed' THEN 1 END)::TEXT AS failed_calls,
       COALESCE(SUM(CASE WHEN status = 'success' THEN platform_fee ELSE 0 END), 0)::TEXT AS total_fees
     FROM api_calls
     WHERE user_id = $1`,
    [userId]
  );
  return row ?? { total_spent: "0", total_calls: "0", successful_calls: "0", failed_calls: "0", total_fees: "0" };
}

export interface IncomingStats {
  incoming_calls: string;
  total_earned: string;
}

export async function getIncomingStats(userId: number): Promise<IncomingStats> {
  const row = await queryOne<IncomingStats>(
    `SELECT
       COUNT(*)::TEXT AS incoming_calls,
       COALESCE(SUM(ac.amount_spent), 0)::TEXT AS total_earned
     FROM api_calls ac
     JOIN apis a ON a.id = ac.api_id
     WHERE a.owner_user_id = $1 AND ac.status = 'success'`,
    [userId]
  );
  return row ?? { incoming_calls: "0", total_earned: "0" };
}

export interface ApiBreakdown {
  api_id: number;
  api_name: string;
  call_count: string;
  total_spent: string;
}

export async function getApiBreakdown(userId: number): Promise<ApiBreakdown[]> {
  return query<ApiBreakdown>(
    `SELECT
       ac.api_id,
       a.name AS api_name,
       COUNT(*)::TEXT         AS call_count,
       SUM(ac.amount_spent)::TEXT AS total_spent
     FROM api_calls ac
     JOIN apis a ON a.id = ac.api_id
     WHERE ac.user_id = $1 AND ac.status = 'success'
     GROUP BY ac.api_id, a.name
     ORDER BY SUM(ac.amount_spent) DESC`,
    [userId]
  );
}
