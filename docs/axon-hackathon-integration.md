# Axon — Hackathon Sponsor Integration Guide

**Axon** is the execution layer for autonomous AI: a user logs in with Google, gets a chain-abstracted "Agent balance," and every paid tool call an AI agent makes (via MCP) is executed and settled automatically — no wallet popups, no bridges, no gas UX, no manual approvals.

This doc is the concrete, file-and-code-level reference for how each sponsor technology is wired into the repo. It supersedes the previous "Plugix on Monad with Privy" design — see `README.md` for the high-level architecture and quick start.

---

## 1. High-level architecture overview

```
                          ┌─────────────────────────────────────────┐
                          │              apps/web (Next.js)           │
                          │                                            │
  User (Google) ───────▶  │  Magic embedded wallet (lib/magic.ts)     │
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
                                       │  optional Bearer <Magic DID token>
                          ┌────────────┴────────────┐
                          │   Claude (via MCP)        │
                          │   /api/mcp                │
                          └───────────────────────────┘

Optional funding path (documented, not implemented):
  Any chain deposit ──▶ ZeroDev Smart Routing Address ──▶ Axon UA / Arbitrum balance
```

Two wallet objects exist per user, but the UI only ever shows **one "Agent balance"**:

1. **Magic embedded wallet → Particle Universal Account** — the user's own treasury/identity. Holds the top-up funds; unified balance shown in the dashboard/topbar.
2. **Openfort backend (agent) wallet** — Axon-controlled, server-side "spend engine." Signs and pays for tool calls on the user's behalf under a per-call spending cap, without a popup.

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
    ownerAddress,       // the Magic embedded wallet's address
    useEIP7702: true,   // upgrade the EOA in place — same address, no migration
  },
});
```

`ownerAddress` is the Magic wallet's EVM address (see §3) — the Universal Account is built directly on top of it via EIP-7702, so **the user keeps the same address** and never sees a second wallet.

### Fetching the unified balance

```ts
// apps/web/lib/particle-ua.ts
export async function fetchAgentBalance(ownerAddress: string): Promise<AgentBalance> {
  const ua = getUniversalAccount(ownerAddress);
  if (!ua) return MOCK_BALANCE; // demo mode — see below

  const assets = await ua.getPrimaryAssets();       // unified balance across all chains
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

Exposed to the UI via `apps/web/hooks/use-universal-account.ts` (`useUniversalAccount(address)`), consumed by:
- `apps/web/components/topbar.tsx` — the "Agent balance" dropdown card
- `apps/web/app/(app)/dashboard/page.tsx` — the "Agent balance" strip

### Cross-chain value move (demo)

`POST /api/ua/simulate-deposit` (`apps/web/app/api/ua/simulate-deposit/route.ts`) simulates a deposit from another chain (Base/Ethereum/Solana) landing in the UA balance, returning a source-chain tx hash and settlement metadata. This satisfies the "at least one cross-chain value move" deliverable without requiring a funded multi-chain testnet wallet for the demo — the same code path (`ua.createTransferTransaction` / `ua.getPrimaryAssets`) is what a production integration would call for a real deposit.

### Known limitation (be upfront about this in the demo)

The installed SDK's `CHAIN_ID` enum only lists **mainnets** (`ARBITRUM_MAINNET_ONE`, `ETHEREUM_MAINNET`, `BASE_MAINNET`, `BSC_MAINNET`, `XLAYER_MAINNET`, `SOLANA_MAINNET`) — Universal Accounts aggregate real cross-chain liquidity, so there's no Arbitrum Sepolia entry. The rest of Axon's settlement (Openfort + x402, §5) runs on Arbitrum Sepolia for the hackathon demo; UA balance reads are the part of the stack that would run on mainnet in production. This is a one-file boundary (`lib/particle-ua.ts`) — swapping to mainnet chain IDs when real funds are involved is a one-line change.

### Demo mode

When `NEXT_PUBLIC_PARTICLE_PROJECT_ID` / `NEXT_PUBLIC_PARTICLE_CLIENT_KEY` / `NEXT_PUBLIC_PARTICLE_APP_ID` are unset, `getUniversalAccount()` returns `null` and `fetchAgentBalance()` returns a fixed demo balance (`{ unifiedUsd: "128.40", arbitrumUsdc: "84.00", stub: true }`), surfaced in the UI as "Agent balance (demo)". This lets the whole dashboard flow demo cleanly before real Particle credentials are added.

---

## 3. Magic Embedded Wallets

**Packages:** `magic-sdk@^33.9.0`, `@magic-ext/oauth2@^15.10.0` (client), `@magic-sdk/admin@^2.8.2` (server)

### Client: `apps/web/lib/magic.ts`

```ts
_magic = new Magic(key, {
  network: { rpcUrl: ARBITRUM_SEPOLIA_RPC, chainId: ARBITRUM_SEPOLIA_CHAIN_ID },
  extensions: [new OAuthExtension()],
});
```

The wallet is pinned to Arbitrum Sepolia at construction time — Magic embedded wallets don't support runtime `wallet_switchEthereumChain` the way an injected/Privy wallet does, so the network is fixed here instead of negotiated at send-time.

### Auth flow (frontend): `apps/web/components/providers.tsx`

- `login()` calls `magic.oauth2.loginWithRedirect({ provider: "google", redirectURI: window.location.origin + "/" })`.
- On return, the same `AuthProvider` effect detects the OAuth redirect (`window.location.search.includes("provider=")`) and calls `magic.oauth2.getRedirectResult()`, which resolves `{ magic: { idToken, userMetadata } }`.
- `useAuth()` (exported from the same file) exposes `{ ready, authenticated, user: { email, wallet }, login, logout, getIdToken }` — a drop-in replacement for the old `usePrivy()` shape used throughout the app (`auth-gate.tsx`, `topbar.tsx`, `wallet-modal.tsx`, `dashboard/page.tsx`, `publish/page.tsx`).
- `getIdToken()` returns a fresh Magic DID token, sent as `Authorization: Bearer <token>` on every authenticated API call (see `dashboard/page.tsx::fetchDashboard`).

### Server: `apps/web/lib/magic-admin.ts`

```ts
export async function verifyDidToken(didToken: string): Promise<VerifiedMagicUser> {
  const admin = magicAdmin();               // new Magic(MAGIC_SECRET_KEY) from @magic-sdk/admin
  admin.token.validate(didToken);           // throws if expired/malformed/replayed
  const metadata = await admin.users.getMetadataByToken(didToken);
  return {
    issuer: metadata.issuer ?? admin.token.getIssuer(didToken),
    walletAddress: metadata.publicAddress,
    email: metadata.email,
  };
}
```

`apps/web/lib/auth.ts` wraps this in the same route-handler helper shape the app already used for Privy:

- `requireMagic(req)` → verifies the Bearer token, returns `{ magicIssuer, wallet, email }` or a 401 `Response`.
- `getAuthUser(req)` → `requireMagic` + `upsertUser()` (auto-creates/updates the Postgres `users` row on every authenticated request).
- `getOptionalAuthUser(req)` → returns `null` instead of a 401 when no token is present — used by `/api/mcp` so unauthenticated MCP clients keep working (§7).

Every route that used to call `getAuthUser`/`requirePrivy` (`/api/apis`, `/api/stats`, `/api/user/init`, `/api/user/enable-server-signing`) needed only a one-line import swap — the bearer-token contract didn't change.

### Mapping to the Universal Account

The Magic wallet's address (`user.wallet`, resolved from `metadata.wallets.ethereum.publicAddress`) is passed directly as `ownerAddress` to `new UniversalAccount(...)` (§2) — Particle upgrades that exact EOA via EIP-7702, so there's no separate "UA address" to manage.

---

## 4. Arbitrum settlement

**File:** `apps/web/lib/arbitrum.ts`

```ts
export const ARBITRUM_CHAIN_ID = 421614; // Arbitrum Sepolia
export const ARBITRUM_CAIP2 = `eip155:${ARBITRUM_CHAIN_ID}`;
export const USDC_DECIMALS = 6;
export function arbitrumRpcUrl(): string { return env().ARBITRUM_RPC_URL; }
export function usdcAddress(): `0x${string}` { return env().ARBITRUM_USDC_ADDRESS as `0x${string}`; }
```

- **RPC**: `ARBITRUM_RPC_URL`, defaults to `https://sepolia-rollup.arbitrum.io/rpc`.
- **USDC**: `ARBITRUM_USDC_ADDRESS`, defaults to `0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d` (native USDC, Arbitrum Sepolia).

### Where transfers happen

- `apps/web/app/api/balance/route.ts` — raw JSON-RPC `eth_getBalance` / `eth_call(balanceOf)` against Arbitrum, used for the low-level on-chain balance check (separate from the Particle UA aggregate figure).
- `packages/client/src/serverWalletPayer.ts` — the shared-platform-wallet payer (viem `sendTransaction`), used as the fallback payer when a call isn't attributable to a specific user (§7). Defaults updated from Monad → `DEFAULT_CHAIN_ID = 421614` (`packages/client/src/constants.ts`), chain metadata now `"Arbitrum Sepolia"` / native currency `ETH`.
- `apps/web/lib/openfort.ts::payWithAgentWallet` — the per-user path; builds the same ERC-20 `transfer` calldata but submits it via Openfort's gasless relayer instead of a raw private key (§5).
- `packages/sdk/src/constants.ts` — the x402 *receiving* side's defaults (`USDC_ADDRESS`, `USDC_NETWORK = "arbitrum-sepolia"`, `ARBITRUM_CHAIN_ID`), used by any Express endpoint wrapped in `usdcPaywall`.
- `apps/web/components/wallet-modal.tsx` — the user-facing "Transfer funds" modal, signs directly via `getMagic()?.rpcProvider` (`eth_sendTransaction`) against Arbitrum Sepolia for manual sends.

Every USDC amount is 6-decimal (`USDC_DECIMALS`), consistent across the Openfort payer, the shared payer, and the x402 verifier.

---

## 5. Openfort + x402

**Package:** `@openfort/openfort-node@^0.10.7`

**File:** `apps/web/lib/openfort.ts`

### Provisioning a per-user agent wallet

```ts
export async function getOrCreateAgentWallet(user: DBUser): Promise<AgentWallet> {
  if (!openfortConfigured()) { /* stub mode — see below */ }

  if (user.openfort_wallet_id) {
    const account = await openfort().accounts.evm.backend.get({ id: user.openfort_wallet_id });
    return { id: account.id, address: account.address, stub: false };
  }

  const account = await openfort().accounts.evm.backend.create({});
  await setOpenfortWallet(user.id, account.id);   // persist acc_... on users.openfort_wallet_id
  return { id: account.id, address: account.address, stub: false };
}
```

One Openfort **EVM backend wallet** (Developer-custody) is created per user, lazily on first payment, and its id is persisted on `users.openfort_wallet_id` (`apps/web/db/schema.sql`).

### Paying (gasless, EIP-7702 delegated)

```ts
const account = await openfort().accounts.evm.backend.get({ id: wallet.id });
const data = encodeFunctionData({ abi: ERC20_TRANSFER_ABI, functionName: "transfer", args: [to, amountBaseUnits] });

const result = await openfort().accounts.evm.backend.sendTransaction({
  account,
  chainId: ARBITRUM_CHAIN_ID,
  interactions: [{ to: usdcAddress(), data }],
});
const txHash = result.response?.transactionHash;
```

`sendTransaction` internally: ensures the wallet has a delegated-account record → checks on-chain EIP-7702 delegation via `eth_getCode` → signs the authorization if needed → creates and submits the transaction intent. No gas token is needed in the user's own wallet — this is the "invisible gas" part of the demo.

### x402 payer + spending policy

```ts
export function openfortPayer(user: DBUser): Payer {
  return async (quote: Quote) => {
    if (user.max_per_call != null && parseFloat(quote.price) > parseFloat(user.max_per_call)) {
      throw new Error(`Payment of ${quote.price} USDC exceeds your per-call spending policy of ${user.max_per_call} USDC.`);
    }
    const result = await payWithAgentWallet({ user, to: quote.receiver, amountUsdc: quote.price, reference: quote.reference });
    return result.txHash;
  };
}
```

`openfortPayer(user)` implements the `Payer` type from `@x402/client` (`(quote) => Promise<txHash>`), so it drops straight into `createUsdcClient({ payer })` alongside the existing shared-wallet payer. This is where the spec's "optional spending policy / kill switch" is enforced — `users.max_per_call` (set via `POST /api/user/enable-server-signing`) is checked before every signature.

### The 402 → pay → retry flow, end to end

```
1. Agent calls x402_call_api(apiId, body)          [apps/web/app/api/mcp/route.ts]
2. Axon POSTs to the target API's endpoint_url
3. API responds 402 with a PaymentQuote (price, receiver, reference, tokenAddress)
4. createUsdcClient's UsdcClient.fetch() catches the 402, calls payer(quote):
     - authenticated  → openfortPayer(user)   → Openfort agent wallet, Arbitrum
     - unauthenticated → serverWalletPayer(...) → shared PAYER_PRIVATE_KEY wallet
5. Retries the request with x-payment-tx / x-payment-reference headers
6. Target API's usdcPaywall middleware (packages/sdk) verifies the on-chain
   Transfer log + calldata reference, then serves the real response
7. Axon inserts an api_calls row directly (apps/web/lib/queries/api-calls.ts)
```

### Stub mode

Without `OPENFORT_SECRET_KEY`, `getOrCreateAgentWallet` persists a `stub_acc_<userId>` id and `payWithAgentWallet` returns a deterministic fake tx hash instead of calling Openfort — the timeline, spend caps, and MCP flow all work identically, just without a real on-chain settlement. Flip the env var and the exact same code path goes live.

---

## 6. ZeroDev Smart Routing Address (planned, not implemented)

Out of scope for the hackathon build (per the doc-only decision — this section is a concrete integration sketch, not shipped code).

**Goal:** one universal deposit address per user that routes funds from *any* chain into their Axon Universal Account / Arbitrum balance, so funding "Agent balance" doesn't require the user to already be on Arbitrum.

**Sketch:**
1. On first login, call ZeroDev's SRA API to generate a Smart Routing Address for the user's Magic wallet address, store it as `users.sra_address` (new column, same pattern as `ua_address`/`openfort_wallet_id`).
2. Add a "Deposit address" card next to the "Agent balance" card in `apps/web/components/topbar.tsx` / the dashboard, showing the SRA and instructions ("send USDC on any supported chain here").
3. ZeroDev relays/aggregates the deposit and delivers funds to the UA/Arbitrum balance; Axon's existing `useUniversalAccount` polling (`apps/web/hooks/use-universal-account.ts`) picks up the new balance with no additional client-side work.
4. Bind a `POST /api/webhooks/zerodev` endpoint (new) to receive deposit-confirmation callbacks and write a timeline entry, mirroring how `POST /api/ua/simulate-deposit` already models a cross-chain deposit event (§2).

---

## 7. MCP + Claude integration

**File:** `apps/web/app/api/mcp/route.ts`

The MCP server is a stateless streamable-HTTP transport (`@modelcontextprotocol/sdk`), unchanged in shape from the previous Plugix implementation — Claude still calls exactly two tools:

- `x402_list_apis` — no params, returns the marketplace listing.
- `x402_call_api({ apiId, body })` — calls the API, handles 402→pay→retry, returns the response.

**What changed:**

```ts
async function handler(req: NextRequest): Promise<Response> {
  const auth = await getOptionalAuthUser(req);   // NEW — optional Magic auth
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  const server = buildServer(auth);
  await server.connect(transport);
  return transport.handleRequest(req);
}
```

`/api/mcp` now **optionally** accepts `Authorization: Bearer <magic-did-token>`:

- **No token** (old behavior, unchanged): pays via the shared `PAYER_PRIVATE_KEY` wallet, no per-user attribution. The MCP contract Claude already speaks is untouched.
- **With a token**: `x402_call_api` pays via `openfortPayer(auth.dbUser)` (§5), enforcing that user's spending policy, and writes the `api_calls` row **directly** inside the route handler's `finally` block — the old separate `POST /api/mcp/callback` endpoint (shared-secret auth, mismatched contract with the legacy stdio MCP package) has been deleted entirely; recording now happens exactly where the payment result is already known.

Users get a token by visiting `/mcp/login` (`apps/web/app/mcp/login/page.tsx`), which calls `useAuth().getIdToken()` client-side and displays it to paste into `claude_desktop_config.json`'s `headers.Authorization` field — no separate token-minting endpoint (the old `/api/mcp/token`, which had been returning `410 Gone`) is needed, since the Magic DID token itself is the bearer credential.

**Also removed as dead code:** `packages/mcp` (a second, incompatible stdio MCP server implementation whose `x402_login` flow depended on the dead `/api/mcp/token` route) and `apps/web/lib/payments.ts` (an unused, mid-debug Privy-signing payment path that nothing called).

See `apps/web/app/docs/mcp/page.tsx` for the user-facing version of this same flow.

---

## 8. Setup and .env instructions

Copy `apps/web/.env.example` → `apps/web/.env.local` and fill in:

| Variable | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_MAGIC_PUBLISHABLE_KEY` | **yes** | [dashboard.magic.link](https://dashboard.magic.link) → API Keys |
| `MAGIC_SECRET_KEY` | **yes** | Same page, server secret |
| `DATABASE_URL` | **yes** | `postgresql://plugix:plugix@localhost:5433/plugix` for local Docker |
| `ARBITRUM_RPC_URL` | no (defaults to public Arbitrum Sepolia RPC) | |
| `NEXT_PUBLIC_ARBITRUM_RPC_URL` | no | client-side copy, used to pin the Magic wallet's network |
| `ARBITRUM_USDC_ADDRESS` | no (defaults to Arbitrum Sepolia native USDC) | |
| `PAYER_PRIVATE_KEY` | recommended | shared fallback wallet for unauthenticated `/api/mcp` calls; needs Arbitrum Sepolia ETH + USDC |
| `NEXT_PUBLIC_PARTICLE_PROJECT_ID` / `NEXT_PUBLIC_PARTICLE_CLIENT_KEY` / `NEXT_PUBLIC_PARTICLE_APP_ID` | no | [dashboard.particle.network](https://dashboard.particle.network) — omit for demo-mode balances |
| `OPENFORT_SECRET_KEY` | no | [dashboard.openfort.io](https://dashboard.openfort.io) — omit for simulated agent-wallet payments |

### Run locally

```bash
npm install
cp apps/web/.env.example apps/web/.env.local   # fill in the table above
docker compose up -d                            # Postgres on :5433, applies apps/web/db/schema.sql
npm run dev:web                                 # http://localhost:3000
```

### Demo script

1. Visit `/` → "Sign in" → Google login via Magic.
2. Land on `/dashboard` — "Agent balance" card renders (demo figures if Particle keys are unset).
3. Demo a cross-chain deposit into the UA balance (requires a Magic Bearer token from step 4, or sign in first and grab it from `/mcp/login`):

   ```bash
   curl -X POST http://localhost:3000/api/ua/simulate-deposit \
     -H "Authorization: Bearer <magic-did-token>" \
     -H "Content-Type: application/json" \
     -d '{"amountUsd": 25}'
   ```

   Returns `{ amountUsd, fromChain, toChain, sourceTxHash, settledAt }` — a simulated Base/Ethereum/Solana → Arbitrum value move. Client-side, `simulateDeposit()` in `apps/web/lib/particle-ua.ts` can bump the displayed balance for the same demo without a page reload.
4. Visit `/mcp/login`, copy the Magic DID token into Claude's MCP config (`apps/web/app/docs/mcp/page.tsx` has the exact JSON).
5. From Claude, call `x402_list_apis` then `x402_call_api` — watch a new row appear in the dashboard's execution timeline with a real (or simulated, in stub mode) Arbitrum tx hash.

### Local schema reset

Since the `users` table schema changed (`privy_user_id` → `magic_issuer`, new `email`/`ua_address`/`openfort_wallet_id` columns, dropped `signer_id`), existing local Docker volumes need a reset:

```bash
docker compose down -v
docker compose up -d
```
