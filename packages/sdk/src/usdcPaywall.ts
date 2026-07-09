import type { RequestHandler } from "express";
import { paymentMiddleware } from "./expressMiddleware.js";
import { USDC_ADDRESS, USDC_TOKEN_NAME } from "./constants.js";
import type { UsdcPaywallOptions, UsdcRouteConfig, PriceConfig } from "./types.js";

export function priceInUsdc(amount: number): PriceConfig {
  if (!Number.isFinite(amount) || amount <= 0)
    throw new Error(`priceInUsdc: must be positive finite number, got ${amount}`);
  return { price: String(amount), token: USDC_TOKEN_NAME };
}

export function usdcPaywall(
  routes: Record<string, UsdcRouteConfig>,
  receiverAddress: string,
  rpcUrl: string,
  opts?: UsdcPaywallOptions
): RequestHandler {
  const priceConfigs: Record<string, PriceConfig> = {};
  for (const [path, config] of Object.entries(routes)) {
    if (typeof config === "number") {
      priceConfigs[path] = priceInUsdc(config);
    } else {
      const { price, ...meta } = config;
      priceConfigs[path] = { ...priceInUsdc(price), ...meta };
    }
  }
  const { tokenAddress, ...rest } = opts ?? {};
  return paymentMiddleware({
    routes: priceConfigs,
    receiverAddress,
    rpcUrl,
    tokenAddress: tokenAddress || USDC_ADDRESS,
    ...rest
  });
}
