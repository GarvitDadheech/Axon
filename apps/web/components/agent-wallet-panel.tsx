"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/providers";
import { Copy, Check, Loader2, Shield, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { shortenAddress } from "@/lib/utils";
import {
  particleConfigured,
  transferViaUniversalAccount,
} from "@/lib/particle-ua";

interface AgentInfo {
  agent: {
    openfortWalletId: string;
    address: string;
    chain: string;
    chainId: number;
  };
  policy: {
    enabled: boolean;
    maxPerCall: string | null;
    maxPerDay: string | null;
    spentToday: string;
  };
  magicWallet: string; // Particle Auth EOA (legacy field name in API response)
}

export function AgentWalletPanel({ onFundSepolia }: { onFundSepolia?: (address: string) => void }) {
  const { getIdToken, user, ethereumProvider } = useAuth();
  const [info, setInfo] = useState<AgentInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [maxPerCall, setMaxPerCall] = useState("1.00");
  const [maxPerDay, setMaxPerDay] = useState("10.00");
  const [savingPolicy, setSavingPolicy] = useState(false);

  const [fundAmount, setFundAmount] = useState("1");
  const [funding, setFunding] = useState(false);
  const [fundMsg, setFundMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getIdToken();
      const res = await fetch("/api/user/agent", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? json.hint ?? "Failed to load agent wallet");
      setInfo(json);
      if (json.policy?.maxPerCall) setMaxPerCall(json.policy.maxPerCall);
      if (json.policy?.maxPerDay) setMaxPerDay(json.policy.maxPerDay);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setInfo(null);
    } finally {
      setLoading(false);
    }
  }, [getIdToken]);

  useEffect(() => {
    load();
  }, [load]);

  const copyAddress = async () => {
    if (!info?.agent.address) return;
    await navigator.clipboard.writeText(info.agent.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const enablePolicy = async () => {
    setSavingPolicy(true);
    setError(null);
    try {
      const token = await getIdToken();
      const res = await fetch("/api/user/enable-server-signing", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ maxPerCall, maxPerDay }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to enable policy");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSavingPolicy(false);
    }
  };

  const fundFromUa = async () => {
    if (!info?.agent.address || !user?.wallet) return;
    setFunding(true);
    setFundMsg(null);
    setError(null);
    try {
      if (!particleConfigured()) {
        throw new Error(
          "Particle keys missing — use “Fund on Sepolia” to send testnet USDC to the agent address instead."
        );
      }
      if (!ethereumProvider) throw new Error("Particle wallet provider not ready");
      const result = await transferViaUniversalAccount({
        ownerAddress: user.wallet,
        receiver: info.agent.address,
        amountUsdc: fundAmount,
        provider: ethereumProvider as {
          request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
        },
      });
      setFundMsg(`UA transfer submitted: ${result.explorerUrl}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setFunding(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-5 py-8 text-[13px] text-white/40">
        <Loader2 className="h-4 w-4 animate-spin" /> Provisioning agent wallet…
      </div>
    );
  }

  return (
    <div className="space-y-5 px-5 py-5">
      {error && (
        <p className="border border-red-500/20 bg-red-500/[0.06] px-3 py-2 text-[12px] text-red-300/90">
          {error}
        </p>
      )}

      {info && (
        <>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-wider text-white/30 mb-1.5">
              Openfort agent wallet (pays for MCP tools)
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate font-mono text-[12px] text-foreground/90">
                {info.agent.address}
              </code>
              <button
                type="button"
                onClick={copyAddress}
                className="border border-white/[0.08] p-1.5 text-white/40 hover:text-white/70"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
            <p className="mt-1 font-mono text-[10px] text-white/25">
              {shortenAddress(info.agent.openfortWalletId, 6)} · Arbitrum Sepolia · spend from this address only
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2 border border-white/[0.06] p-3">
              <div className="flex items-center gap-1.5 text-[11px] text-white/45">
                <Wallet className="h-3.5 w-3.5" /> Fund agent (Sepolia USDC)
              </div>
              <p className="text-[11px] text-white/35 leading-relaxed">
                Send Arbitrum Sepolia USDC to the address above so Openfort can pay x402 quotes.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full font-mono text-[11px]"
                onClick={() => onFundSepolia?.(info.agent.address)}
              >
                Open transfer → agent
              </Button>
            </div>

            <div className="space-y-2 border border-white/[0.06] p-3">
              <div className="flex items-center gap-1.5 text-[11px] text-white/45">
                <Wallet className="h-3.5 w-3.5" /> Fund via Particle UA (cross-chain)
              </div>
              <Label className="text-[10px] text-white/30">USDC amount</Label>
              <Input
                value={fundAmount}
                onChange={(e) => setFundAmount(e.target.value)}
                className="h-8 font-mono text-[12px]"
              />
              <Button
                type="button"
                size="sm"
                className="w-full font-mono text-[11px]"
                disabled={funding}
                onClick={fundFromUa}
              >
                {funding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "UA → agent wallet"}
              </Button>
              {fundMsg && (
                <p className="text-[10px] text-emerald-400/80 break-all">{fundMsg}</p>
              )}
            </div>
          </div>

          <div className="border border-white/[0.06] p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[11px] text-white/45">
                <Shield className="h-3.5 w-3.5" /> Spending policy
              </div>
              <span
                className={`font-mono text-[10px] uppercase tracking-wider ${
                  info.policy.enabled ? "text-emerald-400/80" : "text-amber-400/80"
                }`}
              >
                {info.policy.enabled ? "Enabled" : "Disabled — required for MCP"}
              </span>
            </div>
            <p className="text-[11px] text-white/35 leading-relaxed">
              Approve once. Axon then signs tool payments from your agent wallet within these caps — no popup per call.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[10px] text-white/30">Max / call (USDC)</Label>
                <Input
                  value={maxPerCall}
                  onChange={(e) => setMaxPerCall(e.target.value)}
                  className="h-8 font-mono text-[12px]"
                />
              </div>
              <div>
                <Label className="text-[10px] text-white/30">Max / day (USDC)</Label>
                <Input
                  value={maxPerDay}
                  onChange={(e) => setMaxPerDay(e.target.value)}
                  className="h-8 font-mono text-[12px]"
                />
              </div>
            </div>
            <p className="font-mono text-[10px] text-white/25">
              Spent today: {info.policy.spentToday} USDC
            </p>
            <Button
              type="button"
              size="sm"
              className="w-full font-mono text-[11px]"
              disabled={savingPolicy}
              onClick={enablePolicy}
            >
              {savingPolicy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : info.policy.enabled ? (
                "Update policy"
              ) : (
                "Allow Axon to spend within limits"
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
