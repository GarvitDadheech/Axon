import { query, queryOne } from "@/lib/db";

export interface DBApi {
  id: number;
  owner_user_id: number;
  name: string;
  description: string | null;
  endpoint_url: string;
  price_per_call: string;
  chain: string;
  is_public: boolean;
  sample_request: Record<string, unknown> | null;
  sample_response: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
  owner_wallet?: string;
}

export async function listPublicApis(): Promise<DBApi[]> {
  return query<DBApi>(
    `SELECT a.*, u.wallet_address AS owner_wallet
     FROM apis a
     JOIN users u ON u.id = a.owner_user_id
     WHERE a.is_public = TRUE
     ORDER BY a.created_at DESC`
  );
}

export async function listUserApis(userId: number): Promise<DBApi[]> {
  return query<DBApi>(
    "SELECT * FROM apis WHERE owner_user_id = $1 ORDER BY created_at DESC",
    [userId]
  );
}

export async function createApi(params: {
  ownerUserId: number;
  name: string;
  description?: string;
  endpointUrl: string;
  pricePerCall: string;
  chain: string;
  sampleRequest?: Record<string, unknown> | null;
  sampleResponse?: Record<string, unknown> | null;
}): Promise<DBApi> {
  const row = await queryOne<DBApi>(
    `INSERT INTO apis (owner_user_id, name, description, endpoint_url, price_per_call, chain, sample_request, sample_response)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      params.ownerUserId,
      params.name,
      params.description ?? null,
      params.endpointUrl,
      params.pricePerCall,
      params.chain,
      params.sampleRequest ? JSON.stringify(params.sampleRequest) : null,
      params.sampleResponse ? JSON.stringify(params.sampleResponse) : null,
    ]
  );
  return row!;
}

export async function findApiById(apiId: number): Promise<DBApi | null> {
  return queryOne<DBApi>("SELECT * FROM apis WHERE id = $1", [apiId]);
}
