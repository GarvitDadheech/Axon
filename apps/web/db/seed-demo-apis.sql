-- Seed Axon marketplace with the two paid demo tools hosted by apps/api.
-- Safe to re-run: deletes prior rows with the same endpoint_url first.

INSERT INTO users (particle_user_id, email, wallet_address)
VALUES ('axon-demo-publisher', 'demo@axon.local', '0xb52fab71025f12f990fcd215626562891c27d7c1')
ON CONFLICT (particle_user_id) DO UPDATE
SET wallet_address = EXCLUDED.wallet_address,
    updated_at = NOW();

DELETE FROM apis
WHERE endpoint_url IN (
  'http://localhost:4000/api/generate-image',
  'http://localhost:4000/api/generate-video'
);

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
      'Generate a PNG image from a text prompt via Azure (gpt-image-2). Paid with USDC on Arbitrum Sepolia.',
      'http://localhost:4000/api/generate-image',
      0.10,
      '{"prompt":"a robot dancing on a blockchain"}',
      '{"image":"data:image/png;base64,...","x402Tnx":{"tnxHash":"0x...","amount":0.1,"token":"USDC"}}'
    ),
    (
      'AI Video Generation',
      'Generate a short video clip from a text prompt via Azure Sora. Paid with USDC on Arbitrum Sepolia.',
      'http://localhost:4000/api/generate-video',
      0.50,
      '{"prompt":"a robot dancing on a blockchain"}',
      '{"video":{"type":"url","value":"https://..."},"x402Tnx":{"tnxHash":"0x...","amount":0.5,"token":"USDC"}}'
    )
) AS v(name, description, endpoint_url, price_per_call, sample_request, sample_response)
WHERE u.particle_user_id = 'axon-demo-publisher';
