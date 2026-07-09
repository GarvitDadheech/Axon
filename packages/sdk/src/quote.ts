import { DEFAULT_QUOTE_TTL_SECONDS } from "./constants.js";
import type { PaymentQuote, PriceConfig } from "./types.js";

export function createQuote(params: {
  endpoint: string;
  method: string;
  pricing: PriceConfig;
  receiverAddress: string;
  tokenAddress: string;
  ttlSeconds?: number;
  now?: Date;
}): PaymentQuote {
  const now = params.now ?? new Date();
  const ttl = params.ttlSeconds ?? DEFAULT_QUOTE_TTL_SECONDS;
  const expiresAt = new Date(now.getTime() + ttl * 1000);

  return {
    endpoint: params.endpoint,
    method: params.method,
    price: params.pricing.price,
    token: params.pricing.token,
    tokenAddress: params.tokenAddress,
    receiver: params.receiverAddress,
    reference: crypto.randomUUID().replace(/-/g, "").slice(0, 16),
    expiresAt: expiresAt.toISOString(),
    name: params.pricing.name,
    description: params.pricing.description,
    category: params.pricing.category
  };
}

export function isQuoteExpired(quote: PaymentQuote, now: Date): boolean {
  const exp = Date.parse(quote.expiresAt);
  return Number.isFinite(exp) ? now.getTime() > exp : true;
}

