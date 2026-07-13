"use client";

/**
 * Particle Universal Accounts (EIP-7702) owned by the Particle Auth EOA.
 */

import {
  UniversalAccount,
  CHAIN_ID,
  SUPPORTED_TOKEN_TYPE,
} from "@particle-network/universal-account-sdk";
import { hexToBytes, toHex } from "viem";
import { particleAuthConfigured } from "@/lib/particle-auth";

export function particleConfigured(): boolean {
  return particleAuthConfigured();
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
    tradeConfig: {
      slippageBps: 100,
    },
  });
  _uaOwner = ownerAddress;
  return _ua;
}

export interface AgentBalance {
  unifiedUsd: string;
  arbitrumUsdc: string;
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

export interface UaTransferResult {
  transactionId: string;
  explorerUrl: string;
}

type Eip1193 = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

/**
 * Cross-chain value move via UA → deliver USDC to `receiver` on Arbitrum.
 * Signs with Particle Auth's EIP-1193 provider.
 */
export async function transferViaUniversalAccount(params: {
  ownerAddress: string;
  receiver: string;
  amountUsdc: string;
  provider: Eip1193;
}): Promise<UaTransferResult> {
  const ua = getUniversalAccount(params.ownerAddress);
  if (!ua) {
    throw new Error(
      "Particle Universal Account is not configured. Set NEXT_PUBLIC_PARTICLE_* env vars."
    );
  }

  const USDC_ARB = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";

  const transaction = await ua.createTransferTransaction({
    token: {
      chainId: CHAIN_ID.ARBITRUM_MAINNET_ONE,
      address: USDC_ARB,
    },
    amount: params.amountUsdc,
    receiver: params.receiver,
  });

  const authorizations: { userOpHash: string; signature: string }[] = [];
  const userOps =
    (
      transaction as {
        userOps?: Array<{
          userOpHash: string;
          eip7702Auth?: { address: string; chainId: number; nonce: number };
          eip7702Delegated?: boolean;
        }>;
      }
    ).userOps ?? [];

  for (const userOp of userOps) {
    if (userOp.eip7702Auth && !userOp.eip7702Delegated) {
      try {
        const auth = userOp.eip7702Auth;
        const raw = await params.provider.request({
          method: "eth_signAuthorization",
          params: [{ address: auth.address, chainId: auth.chainId, nonce: auth.nonce }],
        });
        const signature =
          typeof raw === "string"
            ? raw
            : (raw as { signature?: string; serialized?: string })?.signature ??
              (raw as { serialized?: string })?.serialized;
        if (signature) {
          authorizations.push({ userOpHash: userOp.userOpHash, signature });
        }
      } catch (e) {
        console.warn("[axon] EIP-7702 auth sign skipped/failed:", e);
      }
    }
  }

  const rootHash = (transaction as { rootHash: string }).rootHash;
  const rootSig = (await params.provider.request({
    method: "personal_sign",
    params: [toHexMessage(rootHash), params.ownerAddress],
  })) as string;

  const result = await ua.sendTransaction(
    transaction,
    rootSig,
    authorizations.length ? authorizations : undefined
  );

  const transactionId =
    (result as { transactionId?: string })?.transactionId ?? String(result);

  return {
    transactionId,
    explorerUrl: `https://universalx.app/activity/details?id=${transactionId}`,
  };
}

function toHexMessage(rootHash: string): string {
  try {
    const normalized = rootHash.startsWith("0x") ? rootHash : `0x${rootHash}`;
    return toHex(hexToBytes(normalized as `0x${string}`));
  } catch {
    return rootHash.startsWith("0x") ? rootHash : `0x${rootHash}`;
  }
}

export function simulateDeposit(current: AgentBalance, amountUsd: number): AgentBalance {
  const unified = (parseFloat(current.unifiedUsd) + amountUsd).toFixed(2);
  const arbitrum = (parseFloat(current.arbitrumUsdc) + amountUsd).toFixed(2);
  return { unifiedUsd: unified, arbitrumUsdc: arbitrum, stub: current.stub };
}
