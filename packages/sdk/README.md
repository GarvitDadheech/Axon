# `@x402/payment-middleware`

**USDC Pay-per-Use Gateway SDK**

Express middleware + Arbitrum (EVM) verification to monetize HTTP endpoints using USDC through an x402-style payment flow:

1. Client calls an endpoint
2. Server responds `402 Payment Required` with a quote (price, receiver, reference)
3. Client pays (USDC ERC-20 transfer) and retries with headers
4. Server verifies the on-chain payment and serves the response

## Why x402?

- **HTTP-native payments**: Payment challenge embedded in HTTP flow (402 → pay → retry)
- **No API keys / accounts**: No signup or billing required
- **Agent-compatible**: AI agents can pay autonomously using standard HTTP
- **Micropayments viable**: Per-request pricing for small calls

## Why USDC?

- **Stable pricing**: Predictable costs and accounting denominated in USD
- **Widely adopted**: The most liquid stablecoin across EVM chains
- **Removes volatility**: No exposure to crypto price swings

## Install / use (workspace)

This repo uses npm workspaces. The SDK is consumed by `apps/api` as `@x402/payment-middleware`.

## API

### `paymentMiddleware(options)`

Wrap your Express app and configure pricing per route path.

```ts
import express from "express";
import { paymentMiddleware } from "@x402/payment-middleware";

const app = express();

app.use(
  paymentMiddleware({
    routes: {
      "/api/weather": { price: "0.01", token: "USDC" }
    },
    receiverAddress: process.env.RECEIVER_ADDRESS!,
    rpcUrl: process.env.ARBITRUM_RPC_URL!,
    tokenAddress: process.env.TOKEN_ADDRESS!,
    onPaid: (evt) => {
      console.log("paid", evt);
    }
  })
);

app.get("/api/weather", (_req, res) => res.json({ data: "Sunny 25°C" }));
```

There is also a convenience helper, `usdcPaywall(routes, receiverAddress, rpcUrl, opts?)`,
which fills in the USDC token address for you.

#### `options.routes`

Route pricing is keyed by **exact path** (`req.path`), e.g. `"/api/weather"`.

```ts
{
  "/api/weather": { price: "0.01", token: "USDC" },
  "/api/crypto-price": { price: "0.02", token: "USDC" }
}
```

## Protocol contract

### Unpaid request → `402`

If the request is missing payment headers, the middleware returns:

- **Status**: `402 Payment Required`
- **Header**: `WWW-Authenticate: x402 token="USDC", price="<price>"`
- **Body**: a `PaymentQuote` JSON object:

```json
{
  "endpoint": "/api/weather",
  "method": "GET",
  "price": "0.01",
  "token": "USDC",
  "tokenAddress": "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
  "receiver": "0x<receiver_address>",
  "reference": "<unique_reference>",
  "expiresAt": "2026-04-22T12:34:56.000Z"
}
```

### Paid retry → headers

Client retries with:

- `x-payment-tx`: `<arbitrum_transaction_hash>`
- `x-payment-reference`: `<reference_from_quote>`

If verification succeeds, the request continues to the route handler.

## Verification rules (Arbitrum / EVM)

The SDK verifies payments by fetching the transaction receipt via RPC and checking:

- **Transaction status**: found + `status === "success"`
- **Quote validity**: quote not expired (`expiresAt`)
- **ERC-20 transfer**: a `Transfer` event log from the USDC token contract where:
  - the token contract matches `tokenAddress` (defaults to the configured USDC address)
  - `to` is the receiver address
  - transferred amount ≥ quote price (decimals read from the token's `decimals()`)
- **Reference binding (required)**: the transaction input must contain `x402:<reference>`,
  appended to the ERC-20 `transfer` calldata by the payer
- **Replay protection**: middleware tracks tx hashes and rejects reuse with `409`

Source implementation:
- `packages/sdk/src/verifyPayment.ts`
- `packages/sdk/src/expressMiddleware.ts`

## Configuration notes

### USDC token address

Default token is the USDC address on Arbitrum Sepolia:

- `0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d`

You can override with `tokenAddress` (or env `TOKEN_ADDRESS`) for testing. The
address must be a standard ERC-20 token exposing `decimals()` and emitting the
standard `Transfer(address,address,uint256)` event.

### Required env (typical)

- `ARBITRUM_RPC_URL`
- `RECEIVER_ADDRESS`

## Example Use Case

A developer building a pay-per-use AI API:

1. User sends `POST /api/ai/generate` with a prompt
2. Server returns `402 Payment Required` with price in USDC
3. User pays and retries
4. Server verifies payment and returns AI response

No signup. No billing. No API keys.

## What makes this different?

- No subscription model
- No API key management
- Payments happen inside HTTP
- Works for humans and AI agents

## Exports

- `paymentMiddleware`, `usdcPaywall`, `priceInUsdc`
- `verifyPayment`
- constants: `USDC_ADDRESS`, `USDC_TOKEN_NAME`, `ARBITRUM_CHAIN_ID`, `PAYMENT_TX_HEADER`, `PAYMENT_REFERENCE_HEADER`
- types: `PaymentQuote`, `PaidEvent`, `PaymentMiddlewareOptions`, etc.
