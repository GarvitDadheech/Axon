"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchAgentBalance, type AgentBalance } from "@/lib/particle-ua";

export function useUniversalAccount(address?: string) {
  const [balance, setBalance] = useState<AgentBalance | null>(null);
  const [loading, setLoading] = useState(false);

  const refetch = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    try {
      setBalance(await fetchAgentBalance(address));
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { balance, loading, refetch };
}
