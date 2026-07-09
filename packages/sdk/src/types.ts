export type PriceConfig = {
  price: string;
  token: string;
  name?: string;
  description?: string;
  category?: string;
};

export type RoutePricingConfig = Record<string, PriceConfig>;

export type PaymentQuote = {
  endpoint: string;
  method: string;
  price: string;
  token: string;
  tokenAddress: string;
  receiver: string;
  reference: string;
  expiresAt: string;
  name?: string;
  description?: string;
  category?: string;
  fiatEquivalent?: string;
  tokenName?: string;
};

export type PaymentVerificationResult =
  | { ok: true; txSig: string }
  | { ok: false; reason: string; txSig?: string };

export type VerifyPaymentInput = {
  quote: PaymentQuote;
  txSig: string;
};

export type PaymentMiddlewareOptions = {
  routes: RoutePricingConfig;
  receiverAddress: string;
  rpcUrl: string;
  tokenAddress: string;
  quoteTtlSeconds?: number;
  getNow?: () => Date;
  replayStore?: ReplayStore;
  onPaid?: (event: PaidEvent) => void;
};

export type PaidEvent = {
  endpoint: string;
  method: string;
  price: string;
  token: string;
  receiver: string;
  tokenAddress: string;
  reference: string;
  txSig: string;
  paidAt: string;
};

export type ReplayStore = {
  has(key: string): boolean;
  add(key: string): void;
};

export type UsdcRouteConfig = number | {
  price: number;
  name?: string;
  description?: string;
  category?: string;
};

export type UsdcPaywallOptions = {
  tokenAddress?: string;
  quoteTtlSeconds?: number;
  getNow?: () => Date;
  replayStore?: ReplayStore;
  onPaid?: (event: PaidEvent) => void;
};
