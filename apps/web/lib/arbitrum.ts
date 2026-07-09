/**
 * Arbitrum settlement constants — the chain every agent payment lands on.
 * Replaces the old Monad devnet constants from lib/payments.ts.
 */

import { env } from "@/lib/env";

export const ARBITRUM_CHAIN_ID = 421614; // Arbitrum Sepolia
export const ARBITRUM_CAIP2 = `eip155:${ARBITRUM_CHAIN_ID}`;
export const USDC_DECIMALS = 6;

export function arbitrumRpcUrl(): string {
  return env().ARBITRUM_RPC_URL;
}

export function usdcAddress(): `0x${string}` {
  return env().ARBITRUM_USDC_ADDRESS as `0x${string}`;
}
