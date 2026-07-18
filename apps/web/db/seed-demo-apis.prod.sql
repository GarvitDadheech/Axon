-- Production-oriented seed: replace __PUBLIC_APP_URL__ before running, e.g.:
--   sed "s|__PUBLIC_APP_URL__|https://your-app.vercel.app|g" seed-demo-apis.prod.sql | psql "$DATABASE_URL"

TRUNCATE api_calls RESTART IDENTITY CASCADE;
TRUNCATE apis RESTART IDENTITY CASCADE;

INSERT INTO users (particle_user_id, email, wallet_address)
VALUES ('axon-demo-publisher', 'demo@axon.local', '0xb52fab71025f12f990fcd215626562891c27d7c1')
ON CONFLICT (particle_user_id) DO UPDATE
SET wallet_address = EXCLUDED.wallet_address,
    updated_at = NOW();

INSERT INTO apis (
  owner_user_id,
  name,
  description,
  endpoint_url,
  price_per_call,
  chain,
  is_public,
  sample_request,
  sample_response
)
SELECT
  u.id,
  v.name,
  v.description,
  v.endpoint_url,
  v.price_per_call,
  'arbitrum-sepolia',
  TRUE,
  v.sample_request::jsonb,
  v.sample_response::jsonb
FROM users u
CROSS JOIN (
  VALUES
    (
      'AI Image Generation',
      'Generate a PNG from a text prompt (Azure gpt-image-2). Pays USDC on Arbitrum Sepolia via x402.',
      '__PUBLIC_APP_URL__/api/generate-image',
      0.10,
      '{"prompt":"a robot dancing on a blockchain"}',
      '{"image":"data:image/png;base64,...","x402Tnx":{"tnxHash":"0x...","amount":0.1,"token":"USDC"}}'
    ),
    (
      'AI Video Generation',
      'Start an Azure Sora video job (async). Pays on POST; poll GET /api/generate-video/{jobId} until completed.',
      '__PUBLIC_APP_URL__/api/generate-video',
      0.50,
      '{"prompt":"a robot dancing on a blockchain"}',
      '{"jobId":"...","status":"queued","pollUrl":"/api/generate-video/...","x402Tnx":{"tnxHash":"0x...","amount":0.5,"token":"USDC"}}'
    )
) AS v(name, description, endpoint_url, price_per_call, sample_request, sample_response)
WHERE u.particle_user_id = 'axon-demo-publisher';
