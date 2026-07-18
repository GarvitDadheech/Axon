# Axon

Axon is a marketplace where AI agents can discover pay-per-use APIs, pay in USDC, and call them without asking a human to approve every request.

Users sign in with Particle Auth. Each user gets an Openfort agent wallet on Arbitrum Sepolia. When an agent (Claude, Cursor, etc.) calls a paid tool through MCP, Axon settles the x402 payment from that agent wallet and returns the API result plus the transaction hash.

The whole product runs as one Next.js app. Dashboard, MCP server, and the demo image/video APIs all live under `apps/web`. You can deploy that single app to Vercel and use Supabase for Postgres.

For a deeper sponsor integration writeup, see `docs/axon-hackathon-integration.md`.

## What you get

1. A web dashboard to fund the agent wallet, set spending limits, publish APIs, and browse the marketplace.
2. An MCP endpoint at `/api/mcp` so Claude or Cursor can list and call paid APIs.
3. Built-in demo tools: image generation and async video generation, both behind x402 USDC paywalls.
4. Shared packages for the x402 client and payment middleware so other APIs can plug into the same flow.

## Repo layout

```
Axon/
├── apps/web/                 Next.js app (dashboard + APIs + MCP)
│   ├── app/(app)/            Auth-gated UI (dashboard, marketplace, publish, MCP setup)
│   ├── app/api/              Route handlers
│   │   ├── mcp/              MCP server (Particle Bearer required)
│   │   ├── generate-image/   Paid Azure image (sync)
│   │   ├── generate-video/   Paid Azure video job create + GET [jobId] status
│   │   ├── pay/              Pay an x402 quote from the agent wallet
│   │   └── ...               User, APIs, stats, balance helpers
│   ├── lib/                  Auth, Openfort, Azure, x402 paywall, DB
│   └── db/                   schema.sql and seed scripts
├── apps/api/                 Legacy Express demo on :4000 (optional, not used for Vercel)
├── packages/sdk/             @x402/payment-middleware (Express + Fetch/Next helpers)
├── packages/client/          @x402/client (UsdcClient that handles 402 → pay → retry)
└── docs/                     Longer integration notes
```

`npm run dev` starts only the Next app on port 3000. That is enough for local work.

## Stack

| Layer | Choice |
| --- | --- |
| App | Next.js 15 (App Router), React 19 |
| UI | Tailwind CSS + shadcn/ui |
| Auth | Particle Auth |
| Agent spend wallet | Openfort backend wallets (gas sponsorship via `pol_…` policy) |
| Settlement | USDC on Arbitrum Sepolia (chain ID 421614) |
| Payments protocol | x402 |
| Database | Postgres (Supabase Session pooler recommended) |
| Hosting | Vercel (Root Directory `apps/web`) |
| Image / video | Azure Cognitive Services (gpt-image-2 / sora2) |

## Local setup

### 1. Install

```bash
npm install
```

This builds `packages/sdk` and `packages/client` via postinstall.

### 2. Environment

```bash
cp .env.example .env
cp apps/web/.env.example apps/web/.env.local
```

Fill both files with the same secrets in practice. Next loads `.env.local`; `npm run dev:web` also loads the root `.env` through dotenv-cli.

Minimum you need:

```env
DATABASE_URL=postgresql://postgres.YOUR_PROJECT:YOUR_PASSWORD@aws-1-REGION.pooler.supabase.com:5432/postgres

NEXT_PUBLIC_PARTICLE_PROJECT_ID=...
NEXT_PUBLIC_PARTICLE_CLIENT_KEY=...
NEXT_PUBLIC_PARTICLE_APP_ID=...
PARTICLE_PROJECT_ID=...
PARTICLE_CLIENT_KEY=...
PARTICLE_APP_ID=...
PARTICLE_SERVER_KEY=...

OPENFORT_SECRET_KEY=sk_test_...
OPENFORT_WALLET_SECRET=...          # base64 DER EC P-256, not PEM
OPENFORT_POLICY_ID=pol_...          # gas sponsorship policy

RECEIVER_ADDRESS=0x...              # wallet that receives USDC for paid routes
ARBITRUM_RPC_URL=https://sepolia-rollup.arbitrum.io/rpc
ARBITRUM_USDC_ADDRESS=0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d

AZURE_SORA_ENDPOINT=https://....cognitiveservices.azure.com
AZURE_API_KEY=...
AZURE_IMAGE_DEPLOYMENT=gpt-image-2
AZURE_VIDEO_MODEL=sora2
```

Notes:

1. Prefer Supabase **Session pooler** (`*.pooler.supabase.com:5432`). The direct `db.*.supabase.co` host is often IPv6-only and can time out from many networks.
2. Do not put PEM headers in `OPENFORT_WALLET_SECRET`. Paste the base64 DER secret Openfort shows in the dashboard.
3. Leave `NEXT_PUBLIC_API_BASE_URL` unset (or point it at the same Next origin). The old `:4000` Express URL is obsolete.

### 3. Database

Apply schema and seed marketplace listings that point at localhost:3000:

```bash
# using your DATABASE_URL (pooler string)
psql "$DATABASE_URL" -f apps/web/db/schema.sql
psql "$DATABASE_URL" -f apps/web/db/seed-demo-apis.sql
```

If you still want a local Docker Postgres instead of Supabase:

```bash
docker compose up -d
```

That starts Postgres on port 5433 and runs `schema.sql` on first boot. Point `DATABASE_URL` at it, then run the seed script.

After seeding you should see two public APIs:

1. AI Image Generation → `http://localhost:3000/api/generate-image` (0.10 USDC)
2. AI Video Generation → `http://localhost:3000/api/generate-video` (0.50 USDC)

### 4. Run

```bash
npm run dev
```

Open http://localhost:3000

Paid routes to smoke-test without MCP:

```bash
curl -sS -X POST http://localhost:3000/api/generate-image \
  -H 'content-type: application/json' \
  -d '{"prompt":"a red apple"}'
```

You should get HTTP 402 and a JSON quote. That means the x402 paywall is live.

Optional legacy Express server (not required):

```bash
npm run dev:api   # http://localhost:4000
```

## How payments work

### For marketplace callers (MCP)

1. Sign in on the site, open `/mcp`, copy your Particle Bearer token (`uuid:token`).
2. On the dashboard, fund the Openfort agent wallet with Sepolia USDC and enable a spending policy.
3. Point your MCP host at `http://localhost:3000/api/mcp` (or your Vercel URL) with that Bearer header.
4. Call `x402_list_apis`, then `x402_call_api` with an `apiId` and JSON body string.
5. Axon hits the target URL, gets a 402 quote, pays from the agent wallet (with `x402:<reference>` in calldata), retries, and returns the result including `x402Tnx`.

Unauthenticated MCP requests get 401. There is no shared admin payer.

### For publishers

Wrap your own API with `@x402/payment-middleware` (Express or the Fetch helper used by Next), then publish the public URL and price on the Axon marketplace. Agents discover it through MCP and pay per call.

### Demo video is async

Image generation waits for Azure and returns a data URL in one request (up to 60s on Vercel).

Video create is paid once on `POST /api/generate-video` and returns a `jobId`. Poll `GET /api/generate-video/{jobId}` until status is `completed`. That design fits serverless time limits; a sync ten-minute poll would not.

## Deploy to Vercel

You only deploy `apps/web`. Keep the monorepo. Do not host Express separately.

1. Push the repo and import it in Vercel.
2. Set **Root Directory** to `apps/web`.
3. Use the install/build commands in `apps/web/vercel.json` (installs from the monorepo root, builds sdk + client + Next).
4. Add the same env vars as local (Supabase pooler `DATABASE_URL`, Particle, Openfort, Azure, `RECEIVER_ADDRESS`, Arbitrum RPC).
5. After the first successful deploy, re-seed marketplace URLs for production:

```bash
sed "s|__PUBLIC_APP_URL__|https://YOUR_APP.vercel.app|g" \
  apps/web/db/seed-demo-apis.prod.sql | psql "$DATABASE_URL"
```

6. Add your Vercel domain to Particle (and Openfort if needed) allowlists.
7. Point MCP hosts at `https://YOUR_APP.vercel.app/api/mcp`.

## Important API routes

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/api/mcp` | Particle Bearer | MCP tools (`x402_list_apis`, `x402_call_api`) |
| POST | `/api/generate-image` | x402 payment | Paid image generation |
| POST | `/api/generate-video` | x402 payment | Start paid video job |
| GET | `/api/generate-video/[jobId]` | none | Poll video job status |
| POST | `/api/pay` | Particle Bearer | Pay a quote from the agent wallet |
| GET | `/api/user/agent` | Particle Bearer | Agent address, Sepolia USDC, policy |
| POST | `/api/user/enable-server-signing` | Particle Bearer | Turn spending policy on/off |
| GET / POST | `/api/apis` | public / Particle | List or publish marketplace APIs |
| GET | `/api/health` | none | Liveness |

## Chain reference

All Axon settlement uses **USDC on Arbitrum Sepolia**.

1. Chain ID: `421614`
2. CAIP-2: `eip155:421614`
3. Explorer: https://sepolia.arbiscan.io
4. USDC: `0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d`

MCP spends from the Openfort agent balance on that chain, not from Particle Universal Account mainnet balances.

## Openfort tips that bite in practice

1. Signing policies (`ply_…`) are evaluated automatically. Do not pass them as `OPENFORT_POLICY_ID` into `sendTransaction`.
2. `OPENFORT_POLICY_ID` should be a gas sponsorship id (`pol_…`).
3. After creating a signing policy, allow `signEvmHash` / `signEvmMessage` as well as USDC `sendEvmTransaction`, or Openfort returns a generic Forbidden on agent payments.
4. Rotate a mismatched wallet secret in the Openfort dashboard and update both `.env` and `.env.local`, then restart Next.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Next only on :3000 |
| `npm run dev:web` | Same as above |
| `npm run dev:api` | Legacy Express on :4000 |
| `npm run build` | Build sdk, client, and web |
| `npm run typecheck` | Typecheck all workspaces |

## About `apps/api`

That folder is the old Express host for the demo image/video tools. The same capabilities now live in Next route handlers. Keep it only if you want a long-running Node process for experiments. You do not need it for local demos or Vercel.
