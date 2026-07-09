# Axon — The Execution Layer for Autonomous AI

Axon is the execution and payment layer for AI agents. Agents discover, pay for, and call APIs autonomously using a **Magic embedded wallet upgraded into a Particle Universal Account (EIP-7702)** — no API keys, no subscriptions, no human approval required.

Payments are settled in **USDC on Arbitrum** (Arbitrum Sepolia, chain ID 421614) via **Openfort agent wallets** and the **x402** protocol. See `docs/axon-hackathon-integration.md` for the full sponsor integration writeup.

---

## Architecture

```
plugix-monad/
├── apps/
│   └── web/                        # Next.js 15 dashboard (App Router)
│       ├── app/
│       │   ├── (marketing)/        # Public landing page (/)
│       │   ├── (app)/              # Auth-gated app shell w/ sidebar
│       │   │   ├── dashboard/      # Agent balance, execution timeline, published APIs
│       │   │   ├── publish/        # Publish & manage APIs
│       │   │   └── marketplace/    # Browse public API listings
│       │   ├── docs/mcp/           # MCP integration docs (public)
│       │   ├── mcp/login/          # Fetch a Magic DID token for MCP clients
│       │   └── api/                # Next.js API routes
│       │       ├── user/init/           # POST — upsert user
│       │       ├── user/enable-server-signing/  # POST — spending policy
│       │       ├── apis/                # GET list / POST create
│       │       ├── stats/               # GET per-user analytics
│       │       ├── balance/             # GET on-chain ETH/USDC balance
│       │       ├── ua/simulate-deposit/ # POST — demo cross-chain UA deposit
│       │       ├── pay/                 # POST — pay an x402 quote directly
│       │       └── mcp/                 # MCP server (streamable HTTP)
│       ├── components/
│       │   ├── ui/                 # shadcn/ui components
│       │   ├── providers.tsx       # Magic-based AuthProvider + useAuth()
│       │   ├── auth-gate.tsx       # Client-side auth redirect
│       │   ├── sidebar.tsx
│       │   └── topbar.tsx
│       ├── lib/
│       │   ├── db.ts               # pg Pool
│       │   ├── magic.ts            # Magic client SDK singleton
│       │   ├── magic-admin.ts      # Magic server SDK — DID token verification
│       │   ├── auth.ts             # getAuthUser — verifies token + auto-upserts user
│       │   ├── particle-ua.ts      # Particle Universal Account balance/config
│       │   ├── openfort.ts         # Openfort agent wallet + x402 payer
│       │   ├── arbitrum.ts         # Arbitrum chain/USDC constants
│       │   ├── utils.ts
│       │   └── queries/            # Typed DB helpers (users, apis, api-calls)
│       └── db/
│           └── schema.sql          # CREATE TABLE statements
│
├── packages/
│   ├── sdk/                        # x402 USDC payment middleware (Express)
│   └── client/                     # x402 client library (UsdcClient, serverWalletPayer)
│
└── docs/
    └── axon-hackathon-integration.md  # Sponsor integration doc (Magic/Particle/Openfort/Arbitrum/ZeroDev)
```

---

## Tech Stack

| Layer       | Tech                                          |
|-------------|------------------------------------------------|
| Frontend    | Next.js 15 (App Router), React 19              |
| Styling     | Tailwind CSS v3 + shadcn/ui                    |
| Auth        | Magic embedded wallets (`magic-sdk`, Google OAuth) |
| Chain abstraction | Particle Universal Accounts (EIP-7702)   |
| Agent wallet | Openfort backend wallets (EIP-7702 delegated, gasless) |
| Database    | Postgres (node-postgres `pg`)                  |
| Blockchain  | **Arbitrum Sepolia** (chain ID 421614)         |
| Payments    | USDC via x402 + Openfort / shared platform wallet |

---

## Quick Start

### 1. Install

```bash
npm install
```

### 2. Setup environment

```bash
cp apps/web/.env.example apps/web/.env.local
```

Required variables (see `apps/web/.env.example` for the full list, including optional Particle/Openfort keys):

```env
NEXT_PUBLIC_MAGIC_PUBLISHABLE_KEY=pk_live_your-magic-publishable-key
MAGIC_SECRET_KEY=sk_live_your-magic-secret-key
DATABASE_URL=postgresql://plugix:plugix@localhost:5433/plugix
ARBITRUM_RPC_URL=https://sepolia-rollup.arbitrum.io/rpc
ARBITRUM_USDC_ADDRESS=0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d
PAYER_PRIVATE_KEY=0xYOUR_PAYER_PRIVATE_KEY_HERE
```

Particle Universal Account and Openfort agent-wallet integration run in **demo/stub mode** (fixed mock balances, simulated tx hashes) until you add `NEXT_PUBLIC_PARTICLE_*` and `OPENFORT_SECRET_KEY` — the rest of the app works end to end without them.

### 3. Start Postgres via Docker

```bash
docker compose up -d
```

Starts Postgres 16 on port **5433**, auto-runs `apps/web/db/schema.sql` on first boot, and persists data in a named volume.

```bash
# Stop
docker compose down

# Reset (wipe all data)
docker compose down -v

# Inspect DB
docker exec -it plugix-db psql -U plugix -d plugix
```

### 4. Run

```bash
npm run dev:web   # Web → http://localhost:3000
```

---

## Key Flows

### Auth + Onboarding
1. User visits `/` → clicks "Sign in" → Google login via Magic
2. Magic creates an **embedded EVM wallet** (non-custodial, key in secure enclave)
3. First authenticated request auto-creates the user in Postgres (`lib/auth.ts::getAuthUser`)
4. The dashboard reads the wallet's unified balance via Particle Universal Accounts (`lib/particle-ua.ts`)

### Agent Payments (Openfort)
- Each user gets an Openfort backend (agent) wallet, provisioned on first payment (`lib/openfort.ts::getOrCreateAgentWallet`)
- Axon signs and submits gasless, EIP-7702 delegated USDC transfers on Arbitrum on the user's behalf — no popup
- A per-call spending cap (`users.max_per_call`) is enforced before every payment

### MCP → Payment Flow
```
Agent (Claude)
  → MCP tool: x402_call_api { apiId, body }
  → Axon calls the target API endpoint
  → API responds 402 Payment Required with a quote
  → Axon pays the quote in USDC on Arbitrum:
      - authenticated call → user's Openfort agent wallet
      - unauthenticated call → shared platform wallet (PAYER_PRIVATE_KEY)
  → Axon retries with proof, records the api_call row directly
  → Response + tx hash returned to the agent
```

### API Publisher Flow
1. Developer wraps their Express endpoint with `paymentMiddleware` from `packages/sdk`
2. Publishes the endpoint URL + USDC price to the Axon marketplace
3. AI agents discover it via MCP, pay per call in USDC — zero billing setup

---

## API Reference

| Method | Route                          | Auth          | Description                             |
|--------|---------------------------------|---------------|------------------------------------------|
| POST   | `/api/user/init`                | Magic Bearer  | Upsert user                               |
| POST   | `/api/user/enable-server-signing` | Magic Bearer | Set spending policy (max per call/day)  |
| GET    | `/api/apis`                     | Public        | List all public APIs                      |
| POST   | `/api/apis`                     | Magic Bearer  | Publish a new API                         |
| GET    | `/api/stats`                    | Magic Bearer  | Per-user spend analytics                  |
| GET    | `/api/balance`                  | Public        | On-chain ETH/USDC balance for an address  |
| POST   | `/api/ua/simulate-deposit`      | Magic Bearer  | Demo cross-chain deposit into UA balance  |
| POST   | `/api/pay`                      | Optional      | Pay an x402 quote directly                |
| *      | `/api/mcp`                      | Optional      | MCP server (streamable HTTP)              |

---

## Chain

All payments use **USDC on Arbitrum Sepolia**.

- Chain ID: `421614`
- CAIP-2: `eip155:421614`
- Explorer: `sepolia.arbiscan.io`
- USDC contract: `0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d`

---

## Team

**Shubh Kesharwani** · **Garvit Dadheech**

---

**Axon — The execution layer for autonomous AI.**
