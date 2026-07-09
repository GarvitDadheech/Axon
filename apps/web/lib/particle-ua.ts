"use client";

/**
 * Particle Universal Accounts (EIP-7702 mode) — the chain-abstracted "Agent
 * balance" shown in the dashboard/topbar. Real balance reads when
 * NEXT_PUBLIC_PARTICLE_* env vars are set; otherwise falls back to a fixed
 * demo balance so the UI works without live sponsor credentials.
 *
 * Note: this SDK version's CHAIN_ID enum only lists mainnets (no Arbitrum
 * Sepolia) — Universal Accounts aggregate real liquidity, so UA balances
 * are inherently a mainnet concept. The rest of Axon's settlement path
 * (Openfort + x402, see lib/openfort.ts) runs on Arbitrum Sepolia for the
 * demo; this module only drives the balance display.
 */

import {
  UniversalAccount,
  CHAIN_ID,
  SUPPORTED_TOKEN_TYPE,
} from "@particle-network/universal-account-sdk";

export function particleConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_PARTICLE_PROJECT_ID &&
      process.env.NEXT_PUBLIC_PARTICLE_CLIENT_KEY &&
      process.env.NEXT_PUBLIC_PARTICLE_APP_ID
  );
}

let _ua: UniversalAccount | null = null;
let _uaOwner: string | null = null;

export function getUniversalAccount(ownerAddress: string): UniversalAccount | null {
  if (!particleConfigured()) return null;
  if (_ua && _uaOwner === ownerAddress) return _ua;

  _ua = new UniversalAccount({
    projectId: process.env.NEXT_PUBLIC_PARTICLE_PROJECT_ID!,
    projectClientKey: process.env.NEXT_PUBLIC_PARTICLE_CLIENT_KEY!,
    projectAppUuid: process.env.NEXT_PUBLIC_PARTICLE_APP_ID!,
    smartAccountOptions: {
      name: "Axon",
      version: "2.0.0",
      ownerAddress,
      useEIP7702: true,
    },
  });
  _uaOwner = ownerAddress;
  return _ua;
}

export interface AgentBalance {
  unifiedUsd: string;
  arbitrumUsdc: string;
  /** true when this is demo data because Particle credentials aren't configured. */
  stub: boolean;
}

const MOCK_BALANCE: AgentBalance = { unifiedUsd: "128.40", arbitrumUsdc: "84.00", stub: true };

export async function fetchAgentBalance(ownerAddress: string): Promise<AgentBalance> {
  const ua = getUniversalAccount(ownerAddress);
  if (!ua) return MOCK_BALANCE;

  try {
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
  } catch (e) {
    console.error("[axon] Particle UA balance fetch failed, using demo balance:", e);
    return MOCK_BALANCE;
  }
}

/** Simulates a cross-chain deposit landing in the UA balance (see
 *  /api/ua/simulate-deposit for the server-side counterpart used by the
 *  dashboard's "Simulate deposit" demo action). */
export function simulateDeposit(current: AgentBalance, amountUsd: number): AgentBalance {
  const unified = (parseFloat(current.unifiedUsd) + amountUsd).toFixed(2);
  const arbitrum = (parseFloat(current.arbitrumUsdc) + amountUsd).toFixed(2);
  return { unifiedUsd: unified, arbitrumUsdc: arbitrum, stub: current.stub };
}
