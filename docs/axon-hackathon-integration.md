# Axon — Hackathon Sponsor Integration Guide

**Axon** is the execution layer for autonomous AI: a user logs in with **Particle Auth**, gets a chain-abstracted "Agent balance" via **Particle Universal Accounts (EIP-7702)**, and every paid tool call an AI agent makes (via MCP) is settled automatically by an **Openfort** agent wallet on **Arbitrum** — no wallet popups, no bridges, no gas UX, no manual approvals.

This doc is the file-and-code-level reference for how each sponsor technology is wired. It supersedes earlier Plugix (Privy/Monad) and Magic-auth designs — see `README.md` for quick start and `docs/magic-to-particle-auth.md` for the Magic → Particle Auth map.

---

## 1. High-level architecture overview

```
                          ┌─────────────────────────────────────────┐
                          │              apps/web (Next.js)           │
                          │                                            │
  User (email/Google/…) ▶ │  Particle Auth embedded wallet            │
                          │  (AuthKit — components/providers.tsx)     │
                          │        │                                   │
                          │        ▼                                   │
                          │  Particle Universal Account (EIP-7702)     │
                          │  (lib/particle-ua.ts) — unified balance    │
                          │        │                                   │
                          │        ▼                                   │
                          │  Axon backend (Next.js API routes)         │
                          │        │                                   │
                          │        ▼                                   │
                          │  Openfort agent wallet (lib/openfort.ts)   │
                          │  — signs gasless, EIP-7702 delegated txs   │
                          │        │                                   │
                          │        ▼                                   │
                          │  Tools / marketplace APIs (x402 402→pay)   │
                          │        │                                   │
                          │        ▼                                   │
                          │  Arbitrum Sepolia — USDC settlement        │
                          └─────────────────────────────────────────┘
                                       ▲
                                       │  required Bearer <uuid:token>
                          ┌────────────┴────────────┐
                          │   Claude / Cursor (MCP)   │
                          │   /api/mcp                │
                          └───────────────────────────┘

Optional funding path (documented, not implemented):
  Any chain deposit ──▶ ZeroDev Smart Routing Address ──▶ Axon UA / Arbitrum balance
```

Two wallet objects exist per user, but the UI only ever shows **one "Agent balance"**:

1. **Particle Auth EOA → Particle Universal Account** — the user's treasury/identity. Same address via EIP-7702; unified balance in the dashboard/topbar.
2. **Openfort backend (agent) wallet** — Axon-controlled spend engine. Pays tool calls under a per-call / per-day spending policy, without a popup.

---

## 2. Particle Universal Accounts (EIP-7702, chain abstraction)

**Package:** `@particle-network/universal-account-sdk@^2.0.3`

**File:** `apps/web/lib/particle-ua.ts`

### Configuration (EIP-7702 mode)

```ts
_ua = new UniversalAccount({
  projectId: process.env.NEXT_PUBLIC_PARTICLE_PROJECT_ID!,
  projectClientKey: process.env.NEXT_PUBLIC_PARTICLE_CLIENT_KEY!,
  projectAppUuid: process.env.NEXT_PUBLIC_PARTICLE_APP_ID!,
  smartAccountOptions: {
    name: "Axon",
    version: "2.0.0",
    ownerAddress,       // Particle Auth embedded EOA address
    useEIP7702: true,   // upgrade the EOA in place — same address, no migration
  },
});
```

`ownerAddress` is the Particle Auth wallet address from `useAuth().user.wallet` (§3). The Universal Account is built on that EOA via EIP-7702 — **same address**, no second wallet.

### Fetching the unified balance

```ts
// apps/web/lib/particle-ua.ts
export async function fetchAgentBalance(ownerAddress: string): Promise<AgentBalance> {
  const ua = getUniversalAccount(ownerAddress);
  if (!ua) return MOCK_BALANCE;

  const assets = await ua.getPrimaryAssets();
  const usdc = assets.assets.find((a) => a.tokenType === SUPPORTED_TOKEN_TYPE.USDC);
  const arbitrumUsdc = usdc?.chainAggregation.find(
    (c) => c.token.chainId === CHAIN_ID.ARBITRUM_MAINNET_ONE
  );
  return {
    unifiedUsd: assets.totalAmountInUSD.toFixed(2),
    arbitrumUsdc: (arbitrumUsdc?.amountInUSD ?? 0).toFixed(2),
    stub: false,
  };
}
```

UI consumers:
- `apps/web/components/topbar.tsx` — "Agent balance" dropdown
- `apps/web/app/(app)/dashboard/page.tsx` — balance strip + agent wallet panel

### Cross-chain value move

Dashboard **UA → agent wallet** uses `transferViaUniversalAccount()` in `lib/particle-ua.ts`:

1. `ua.createTransferTransaction({ token: Arbitrum USDC, amount, receiver: openfortAgentAddress })`
2. User signs `rootHash` (+ optional EIP-7702 auths) via Particle Auth's EIP-1193 provider
3. `ua.sendTransaction(...)` routes liquidity across chains into Arbitrum USDC for the agent wallet

That is the Universal Accounts track deliverable (real cross-chain value move when Particle keys + UA liquidity are present).

`POST /api/ua/simulate-deposit` remains a lightweight demo endpoint that returns synthetic deposit metadata for curl / timeline demos without mainnet funds.

### Known limitation

The UA SDK `CHAIN_ID` enum lists **mainnets** only. Openfort + x402 settlement for the hackathon runs on **Arbitrum Sepolia**; UA balances/transfers use mainnet liquidity concepts. Boundary is `lib/particle-ua.ts`.

### Demo / stub balance

If Particle public keys are unset (auth itself requires them), `fetchAgentBalance` can still return a fixed mock `{ unifiedUsd: "128.40", arbitrumUsdc: "84.00", stub: true }` labeled "Agent balance (demo)".

---

## 3. Particle Auth (login + embedded wallet)

**Packages:** `@particle-network/authkit@^2.1.1`, `@particle-network/auth-core@^2.1.1`

**Docs:** [Particle Auth Web SDK](https://developers.particle.network/social-logins/auth/desktop-sdks/web)

### Client: `apps/web/components/providers.tsx`

Wraps the app in `AuthCoreContextProvider` with project credentials and `arbitrumSepolia` as the configured chain:

```ts
<AuthCoreContextProvider
  options={{
    projectId, clientKey, appId,
    chains: [arbitrumSepolia],
    authTypes: ["email", "google", "apple", "twitter"],
    themeType: "dark",
    wallet: { visible: true, themeType: "dark" },
  }}
>
  <ParticleAuthBridge>{children}</ParticleAuthBridge>
</AuthCoreContextProvider>
```

`ParticleAuthBridge` uses:

- `useConnect()` → `connect({})` / `disconnect()` for login modal + logout
- `useAuthCore()` → `userInfo` (`uuid`, `token`, email, wallets)
- `useEthereum()` → EIP-1193 `provider`, `address`, `switchChain`

`useAuth()` exposes the same app shape as before:

```ts
{ ready, authenticated, user: { email, wallet, particleUserId }, login, logout, getIdToken, ethereumProvider }
```

`getIdToken()` returns **`uuid:token`** (Particle session), sent as `Authorization: Bearer <uuid:token>` on every authenticated API call.

Helpers: `apps/web/lib/particle-auth.ts` (`particleAuthConfigured`, `encodeParticleBearer`).

### Server: `apps/web/lib/particle-auth-server.ts`

Verifies the Bearer payload via Particle's `getUserInfo` RPC ([docs](https://developers.particle.network/social-logins/api/server/getuserinfo)):

```ts
// Basic auth: projectId / PARTICLE_SERVER_KEY
POST https://api.particle.network/server/rpc
{ method: "getUserInfo", params: [uuid, token] }
→ { uuid, email, wallets: [{ chain: "evm_chain", publicAddress }] }
```

`apps/web/lib/auth.ts`:

- `requireParticle(req)` → `{ particleUserId, wallet, email }` or 401
- `getAuthUser(req)` → `requireParticle` + `upsertUser()` on `users.particle_user_id`
- MCP and all protected routes use `getAuthUser` (auth **required**)

### Mapping to the Universal Account

`user.wallet` (Particle Auth EOA) is passed as `ownerAddress` to `UniversalAccount` (§2). EIP-7702 upgrades that same address in place.

### Wallet UI

`apps/web/components/wallet-modal.tsx` sends txs via `useAuth().ethereumProvider.request({ method: "eth_sendTransaction", ... })` on Arbitrum Sepolia (manual fund of the Openfort agent address).

---

## 4. Arbitrum settlement

**File:** `apps/web/lib/arbitrum.ts`

```ts
export const ARBITRUM_CHAIN_ID = 421614; // Arbitrum Sepolia
export const ARBITRUM_CAIP2 = `eip155:${ARBITRUM_CHAIN_ID}`;
export const USDC_DECIMALS = 6;
```

- **RPC**: `ARBITRUM_RPC_URL` (default public Sepolia rollup RPC)
- **USDC**: `ARBITRUM_USDC_ADDRESS` = `0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d`

### Where transfers happen

- `apps/web/app/api/balance/route.ts` — raw on-chain ETH/USDC for an address
- `apps/web/lib/openfort.ts::payWithAgentWallet` — agent USDC `transfer` + `x402:<reference>` calldata via Openfort (gas policy optional)
- `packages/sdk` — x402 receiving side (`usdcPaywall`) verifies Transfer logs + reference binding on Arbitrum
- `wallet-modal.tsx` — user-initiated Particle Auth transfers to fund the agent wallet

All USDC amounts use 6 decimals.

---

## 5. Openfort + x402

**Package:** `@openfort/openfort-node@^0.10.7`

**File:** `apps/web/lib/openfort.ts`

**Openfort product:** [Backend wallets](https://www.openfort.io/docs/products/server) (not Embedded / Shield).

### Provisioning

```ts
const account = await openfort().accounts.evm.backend.create({});
await setOpenfortWallet(user.id, account.id, account.address);
```

Persisted as `users.openfort_wallet_id` + `users.openfort_wallet_address`. Provisioned on `/api/user/init`, `/api/user/agent`, and before MCP tool use.

Requires `OPENFORT_SECRET_KEY` (+ recommended `OPENFORT_WALLET_SECRET`, `OPENFORT_POLICY_ID` for gas sponsorship). **No fake stub hashes** — missing keys fail closed.

### Paying (gasless, EIP-7702 delegated)

```ts
const transferData = encodeFunctionData({ /* transfer(to, amount) */ });
const data = concatHex([transferData, toHex(`x402:${reference}`)]);

await openfort().accounts.evm.backend.sendTransaction({
  account,
  chainId: ARBITRUM_CHAIN_ID,
  interactions: [{ to: tokenAddress, data }],
  policy: OPENFORT_POLICY_ID, // gas sponsorship (ply_...)
  rpcUrl: arbitrumRpcUrl(),
});
// wait for receipt before returning hash
```

### Spending policy

Dashboard **Agent wallet & policy** panel → `POST /api/user/enable-server-signing`.

`openfortPayer` enforces:

- `server_signing_enabled` must be true
- `max_per_call`
- `max_per_day` (via `getSpentToday`)

### 402 → pay → retry

```
1. MCP x402_call_api (Particle Bearer required)
2. POST target endpoint_url → 402 quote
3. openfortPayer(user) pays from that user's agent wallet
4. Retry with x-payment-tx / x-payment-reference
5. usdcPaywall verifies on-chain Transfer + x402:<reference> in calldata
6. Insert api_calls row; return tool response + tx hash
```

There is **no** shared admin `PAYER_PRIVATE_KEY` path for MCP.

---

## 6. ZeroDev Smart Routing Address (planned, not implemented)

Doc-only sketch for a future deposit UX.

**Goal:** one deposit address per user that routes any-chain funds into the UA / Arbitrum balance.

**Sketch:**
1. On first login, create an SRA for the Particle Auth EOA; store `users.sra_address`.
2. Show a "Deposit address" card next to Agent balance.
3. ZeroDev delivers funds; `useUniversalAccount` polling picks up the new balance.
4. Optional `POST /api/webhooks/zerodev` for timeline entries (same shape as simulate-deposit).

---

## 7. MCP + Claude / Cursor integration

**File:** `apps/web/app/api/mcp/route.ts`

Tools:

- `x402_list_apis` — marketplace listing from Postgres
- `x402_call_api({ apiId, body })` — 402 → Openfort pay → retry

### Auth (required)

```ts
async function handler(req: NextRequest): Promise<Response> {
  const auth = await getAuthUser(req); // Particle Bearer required
  if (auth instanceof Response) {
    return Response.json({ error: "Unauthorized", hint: "..." }, { status: 401 });
  }
  await getOrCreateAgentWallet(auth.dbUser);
  // ... streamable HTTP MCP transport
}
```

Bearer format: **`Authorization: Bearer <particleUuid>:<particleToken>`**

Get it from `/mcp/login` after Particle Auth sign-in; paste into MCP host config:

```json
{
  "mcpServers": {
    "axon": {
      "url": "http://localhost:3000/api/mcp",
      "headers": {
        "Authorization": "Bearer <uuid:token>"
      }
    }
  }
}
```

See `apps/web/app/docs/mcp/page.tsx` for the user-facing docs.

---

## 8. Setup and .env instructions

### Where each file goes

| File | Who loads it | Put what here |
|---|---|---|
| **`<repo>/.env`** | `dev:web` + `dev:api` (dotenv-cli) | Canonical shared env; **required for `apps/api`** |
| **`apps/web/.env.local`** | Next.js | Particle `NEXT_PUBLIC_*`, `PARTICLE_SERVER_KEY`, Openfort, `DATABASE_URL` |
| **`<repo>/.env.local`** | Avoid empty overrides | If present, keep Particle `NEXT_PUBLIC_*` filled (empty values override `.env`) |
| **`apps/api/.env.example`** | docs only | Runtime reads root `.env` |
| **`packages/*`** | nothing | Pass config as function args |

```bash
cp .env.example .env
cp apps/web/.env.example apps/web/.env.local
# fill Particle + Openfort + RECEIVER_ADDRESS
```

### Variable reference

| Variable | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_PARTICLE_PROJECT_ID` | **yes** | [dashboard.particle.network](https://dashboard.particle.network) Project ID |
| `NEXT_PUBLIC_PARTICLE_CLIENT_KEY` | **yes** | Client Key |
| `NEXT_PUBLIC_PARTICLE_APP_ID` | **yes** | Web app App ID (create a **Web** app; set redirect `http://localhost:3000`) |
| `PARTICLE_PROJECT_ID` / `CLIENT_KEY` / `APP_ID` | **yes** | Same values (server mirror) |
| `PARTICLE_SERVER_KEY` | **yes** | Server Key — `getUserInfo` Basic auth |
| `DATABASE_URL` | **yes** | `postgresql://plugix:plugix@localhost:5433/plugix` |
| `OPENFORT_SECRET_KEY` | **yes for MCP pay** | [dashboard.openfort.io](https://dashboard.openfort.io) Backend wallets |
| `OPENFORT_WALLET_SECRET` | recommended | Backend wallet secret (PEM private key) |
| `OPENFORT_POLICY_ID` | recommended | Gas sponsorship policy id (`ply_...`) |
| `ARBITRUM_RPC_URL` / `NEXT_PUBLIC_ARBITRUM_RPC_URL` | no | defaults to public Sepolia RPC |
| `ARBITRUM_USDC_ADDRESS` | no | Sepolia native USDC default |
| `RECEIVER_ADDRESS` | **yes for api** | USDC receiver for x402 paywall |
| `TOKEN_ADDRESS` | no | same USDC for `apps/api` |
| `PORT` | no | default `4000` |
| `NEXT_PUBLIC_API_BASE_URL` | for `/demo` | e.g. `http://localhost:4000` |
| `AZURE_SORA_ENDPOINT` / `AZURE_API_KEY` | for real media | image/video routes |

**Removed (do not set):** `MAGIC_*`, `PRIVY_*`, `MONAD_*`, `PAYER_PRIVATE_KEY`, `MCP_CALLBACK_SECRET`.

### Run locally

```bash
npm install
cp .env.example .env
cp apps/web/.env.example apps/web/.env.local   # fill Particle + Openfort
docker compose down -v && docker compose up -d # fresh schema (particle_user_id)
npm run dev                                    # web :3000 + api :4000
```

### Demo script

1. Visit `/` → Sign in with Particle Auth (email / Google / …).
2. `/dashboard` → enable spending policy; copy Openfort agent address; fund with Sepolia USDC (or UA → agent).
3. Publish `http://localhost:4000/api/generate-image` on `/publish`.
4. `/mcp/login` → copy MCP config with Particle Bearer into Claude/Cursor; restart host.
5. `x402_list_apis` → `x402_call_api` → execution timeline shows the agent wallet's Arbitrum tx.

### Local schema reset

`users.particle_user_id` replaced `magic_issuer` / `privy_user_id`. Reset Docker volumes after schema changes:

```bash
docker rm -f plugix-db   # if name conflict
docker compose down -v
docker compose up -d
```
