/**
 * Shared x402 paywall config for paid Next.js API routes.
 */

import { enforceUsdcPayment, type FetchPaywallResult } from "@x402/payment-middleware";
import type { UsdcRouteConfig } from "@x402/payment-middleware";
import { env } from "@/lib/env";
import { arbitrumRpcUrl, usdcAddress } from "@/lib/arbitrum";

export function receiverAddress(): `0x${string}` {
  const addr =
    process.env.RECEIVER_ADDRESS ||
    process.env.NEXT_PUBLIC_RECEIVER_ADDRESS ||
    "";
  if (!addr) {
    throw new Error(
      "Missing RECEIVER_ADDRESS (Openfort agent / treasury that receives USDC)."
    );
  }
  return addr as `0x${string}`;
}

export async function requireUsdcPayment(
  req: Request,
  endpoint: string,
  pricing: UsdcRouteConfig
): Promise<FetchPaywallResult> {
  const e = env();
  return enforceUsdcPayment(req, {
    endpoint,
    pricing,
    receiverAddress: receiverAddress(),
    rpcUrl: arbitrumRpcUrl(),
    tokenAddress: e.ARBITRUM_USDC_ADDRESS || usdcAddress(),
  });
}

export function withX402Tnx<T extends Record<string, unknown>>(
  body: T,
  x402Tnx: { tnxHash: string; amount: number; token: string }
): T & { x402Tnx: typeof x402Tnx } {
  return { ...body, x402Tnx };
}
