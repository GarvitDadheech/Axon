"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/providers";

export interface AgentWalletInfo {
  address: string;
  openfortWalletId: string;
  usdc: string;
  chain: string;
}

/**
 * Openfort agent wallet + Arbitrum Sepolia USDC (what MCP actually spends).
 * Not Particle UA mainnet balance.
 */
export function useAgentWallet() {
  const { getIdToken, authenticated, ready } = useAuth();
  const [info, setInfo] = useState<AgentWalletInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!authenticated) {
      setInfo(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const token = await getIdToken();
      const res = await fetch("/api/user/agent", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load agent wallet");
      setInfo({
        address: json.agent.address,
        openfortWalletId: json.agent.openfortWalletId,
        usdc: json.balances?.usdc ?? "0.00",
        chain: json.agent.chain ?? "arbitrum-sepolia",
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setInfo(null);
    } finally {
      setLoading(false);
    }
  }, [authenticated, getIdToken]);

  useEffect(() => {
    if (!ready || !authenticated) return;
    void refetch();
  }, [ready, authenticated, refetch]);

  return { info, loading, error, refetch };
}
