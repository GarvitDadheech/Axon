"use client";

/**
 * Magic client SDK singleton (browser-only). Wraps embedded-wallet auth +
 * Google OAuth — the replacement for Privy's `usePrivy()`/`useWallets()`.
 */

import { Magic } from "magic-sdk";
import { OAuthExtension } from "@magic-ext/oauth2";

export type MagicInstance = InstanceType<typeof Magic> & {
  oauth2: OAuthExtension;
};

// Embedded wallets are pinned to Arbitrum Sepolia at the SDK level — Magic
// wallets don't support runtime `wallet_switchEthereumChain` like an
// injected/Privy wallet does, so the network is fixed here instead.
const ARBITRUM_SEPOLIA_RPC =
  process.env.NEXT_PUBLIC_ARBITRUM_RPC_URL ?? "https://sepolia-rollup.arbitrum.io/rpc";
const ARBITRUM_SEPOLIA_CHAIN_ID = 421614;

let _magic: MagicInstance | null = null;

/** Returns null on the server, or when NEXT_PUBLIC_MAGIC_PUBLISHABLE_KEY is unset. */
export function getMagic(): MagicInstance | null {
  if (typeof window === "undefined") return null;
  if (_magic) return _magic;

  const key = process.env.NEXT_PUBLIC_MAGIC_PUBLISHABLE_KEY;
  if (!key) return null;

  _magic = new Magic(key, {
    network: { rpcUrl: ARBITRUM_SEPOLIA_RPC, chainId: ARBITRUM_SEPOLIA_CHAIN_ID },
    extensions: [new OAuthExtension()],
  }) as MagicInstance;
  return _magic;
}
