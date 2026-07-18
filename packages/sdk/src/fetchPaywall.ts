/**
 * Framework-agnostic x402 paywall for Fetch API Request/Response
 * (Next.js App Router, Cloudflare Workers, etc.).
 */

import {
  DEFAULT_QUOTE_TTL_SECONDS,
  PAYMENT_REFERENCE_HEADER,
  PAYMENT_TX_HEADER,
  USDC_ADDRESS,
  USDC_TOKEN_NAME
} from "./constants.js";
import { createQuote, isQuoteExpired } from "./quote.js";
import { createInMemoryReplayStore } from "./replayStore.js";
import { verifyPayment } from "./verifyPayment.js";
import type {
  PaidEvent,
  PaymentQuote,
  PriceConfig,
  ReplayStore,
  UsdcPaywallOptions,
  UsdcRouteConfig
} from "./types.js";
import { priceInUsdc } from "./usdcPaywall.js";

type QuoteStore = {
  get(reference: string): PaymentQuote | undefined;
  set(reference: string, quote: PaymentQuote): void;
  delete(reference: string): void;
};

function createInMemoryQuoteStore(): QuoteStore {
  const m = new Map<string, PaymentQuote>();
  return {
    get(reference) {
      return m.get(reference);
    },
    set(reference, quote) {
      m.set(reference, quote);
    },
    delete(reference) {
      m.delete(reference);
    }
  };
}

/** Survive Next.js HMR / warm serverless isolates when possible. */
function globalQuoteStore(): QuoteStore {
  const g = globalThis as typeof globalThis & {
    __x402QuoteStore?: QuoteStore;
  };
  if (!g.__x402QuoteStore) g.__x402QuoteStore = createInMemoryQuoteStore();
  return g.__x402QuoteStore;
}

function globalReplayStore(): ReplayStore {
  const g = globalThis as typeof globalThis & {
    __x402ReplayStore?: ReplayStore;
  };
  if (!g.__x402ReplayStore) g.__x402ReplayStore = createInMemoryReplayStore();
  return g.__x402ReplayStore;
}

function normalizePath(path: string): string {
  if (!path) return "/";
  const bare = path.split("?")[0] || "/";
  return bare.startsWith("/") ? bare : `/${bare}`;
}

export type FetchPaywallConfig = {
  /** Absolute path this handler serves, e.g. `/api/generate-image` */
  endpoint: string;
  pricing: UsdcRouteConfig;
  receiverAddress: string;
  rpcUrl: string;
  tokenAddress?: string;
  quoteTtlSeconds?: number;
  getNow?: () => Date;
  replayStore?: ReplayStore;
  quoteStore?: QuoteStore;
  onPaid?: (event: PaidEvent) => void;
};

export type FetchPaywallOk = {
  ok: true;
  x402Tnx: { tnxHash: string; amount: number; token: string };
};

export type FetchPaywallBlocked = {
  ok: false;
  response: Response;
};

export type FetchPaywallResult = FetchPaywallOk | FetchPaywallBlocked;

function toPriceConfig(config: UsdcRouteConfig): PriceConfig {
  if (typeof config === "number") return priceInUsdc(config);
  const { price, ...meta } = config;
  return { ...priceInUsdc(price), ...meta };
}

/**
 * Verify x402 payment for a Fetch Request.
 * Returns `{ ok: true, x402Tnx }` when paid, or `{ ok: false, response }` to return as-is.
 */
export async function enforceUsdcPayment(
  req: Request,
  config: FetchPaywallConfig
): Promise<FetchPaywallResult> {
  const quoteTtlSeconds = config.quoteTtlSeconds ?? DEFAULT_QUOTE_TTL_SECONDS;
  const getNow = config.getNow ?? (() => new Date());
  const tokenAddress = config.tokenAddress || USDC_ADDRESS;
  const quoteStore = config.quoteStore ?? globalQuoteStore();
  const replayStore = config.replayStore ?? globalReplayStore();
  const pricing = toPriceConfig(config.pricing);

  const keyEndpoint = normalizePath(config.endpoint);
  const keyMethod = (req.method || "GET").toUpperCase();

  const paymentTx = req.headers.get(PAYMENT_TX_HEADER);
  const paymentRef = req.headers.get(PAYMENT_REFERENCE_HEADER);

  try {
    if (!paymentTx || !paymentRef) {
      const quote = createQuote({
        endpoint: keyEndpoint,
        method: keyMethod,
        pricing,
        receiverAddress: config.receiverAddress,
        tokenAddress,
        ttlSeconds: quoteTtlSeconds,
        now: getNow()
      });
      quoteStore.set(quote.reference, quote);

      return {
        ok: false,
        response: new Response(JSON.stringify(quote), {
          status: 402,
          headers: {
            "content-type": "application/json",
            "www-authenticate": `x402 token="${quote.token}", price="${quote.price}"`
          }
        })
      };
    }

    const storedQuote = quoteStore.get(paymentRef);
    if (!storedQuote) {
      return {
        ok: false,
        response: Response.json({ reason: "Unknown payment reference" }, { status: 402 })
      };
    }

    const now = getNow();
    if (isQuoteExpired(storedQuote, now)) {
      quoteStore.delete(paymentRef);
      return {
        ok: false,
        response: Response.json({ reason: "Quote expired" }, { status: 402 })
      };
    }

    if (storedQuote.endpoint !== keyEndpoint || storedQuote.method !== keyMethod) {
      return {
        ok: false,
        response: Response.json({ reason: "Quote mismatch" }, { status: 402 })
      };
    }

    if (replayStore.has(paymentTx)) {
      return {
        ok: false,
        response: Response.json({ reason: "Replay detected" }, { status: 409 })
      };
    }

    const result = await verifyPayment({
      rpcUrl: config.rpcUrl,
      receiverAddress: config.receiverAddress,
      tokenAddress,
      input: { quote: storedQuote, txSig: paymentTx },
      requireMemoReference: true
    });

    if (!result.ok) {
      return {
        ok: false,
        response: Response.json({ reason: result.reason }, { status: 402 })
      };
    }

    replayStore.add(paymentTx);
    quoteStore.delete(paymentRef);

    const paidEvent: PaidEvent = {
      endpoint: storedQuote.endpoint,
      method: storedQuote.method,
      price: storedQuote.price,
      token: storedQuote.token,
      receiver: storedQuote.receiver,
      tokenAddress: storedQuote.tokenAddress,
      reference: storedQuote.reference,
      txSig: paymentTx,
      paidAt: now.toISOString()
    };
    config.onPaid?.(paidEvent);

    return {
      ok: true,
      x402Tnx: {
        tnxHash: paymentTx,
        amount: Number(storedQuote.price),
        token: storedQuote.token || USDC_TOKEN_NAME
      }
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      response: Response.json({ error: msg }, { status: 500 })
    };
  }
}

/** Convenience: build paywall options from UsdcPaywallOptions-style args. */
export function createUsdcFetchPaywall(
  endpoint: string,
  pricing: UsdcRouteConfig,
  receiverAddress: string,
  rpcUrl: string,
  opts?: UsdcPaywallOptions
): (req: Request) => Promise<FetchPaywallResult> {
  return (req: Request) =>
    enforceUsdcPayment(req, {
      endpoint,
      pricing,
      receiverAddress,
      rpcUrl,
      tokenAddress: opts?.tokenAddress,
      quoteTtlSeconds: opts?.quoteTtlSeconds,
      getNow: opts?.getNow,
      replayStore: opts?.replayStore,
      onPaid: opts?.onPaid
    });
}
