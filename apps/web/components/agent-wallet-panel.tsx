"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/providers";
import {
  Copy,
  Check,
  Loader2,
  Shield,
  Wallet,
  ArrowRight,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { shortenAddress } from "@/lib/utils";

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
  magicWallet: string;
}

function formatUsdc(value: string | null | undefined, digits = 2): string {
  if (value == null || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  return n.toFixed(digits);
}

function normalizeUsdcInput(raw: string): string {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  const n = parseFloat(cleaned);
  if (!Number.isFinite(n) || n < 0) return "0.00";
  return n.toFixed(2);
}

export function AgentWalletPanel({
  onFundSepolia,
}: {
  onFundSepolia?: (address: string) => void;
}) {
  const { getIdToken } = useAuth();
  const [info, setInfo] = useState<AgentInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [editingPolicy, setEditingPolicy] = useState(false);
  const [maxPerCall, setMaxPerCall] = useState("1.00");
  const [maxPerDay, setMaxPerDay] = useState("10.00");
  const [savingPolicy, setSavingPolicy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getIdToken();
      const res = await fetch("/api/user/agent", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? json.hint ?? "Failed to load agent wallet");
      }
      setInfo(json);
      setMaxPerCall(formatUsdc(json.policy?.maxPerCall ?? "1", 2));
      setMaxPerDay(formatUsdc(json.policy?.maxPerDay ?? "10", 2));
      if (!json.policy?.enabled) setEditingPolicy(true);
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

  const savePolicy = async () => {
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
        body: JSON.stringify({
          maxPerCall: normalizeUsdcInput(maxPerCall),
          maxPerDay: normalizeUsdcInput(maxPerDay),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to save policy");
      setEditingPolicy(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSavingPolicy(false);
    }
  };

  const startEdit = () => {
    if (!info) return;
    setMaxPerCall(formatUsdc(info.policy.maxPerCall ?? "1", 2));
    setMaxPerDay(formatUsdc(info.policy.maxPerDay ?? "10", 2));
    setEditingPolicy(true);
  };

  const cancelEdit = () => {
    if (!info) return;
    setMaxPerCall(formatUsdc(info.policy.maxPerCall ?? "1", 2));
    setMaxPerDay(formatUsdc(info.policy.maxPerDay ?? "10", 2));
    if (info.policy.enabled) setEditingPolicy(false);
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
          {/* Agent address */}
          <div>
            <p className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-white/30">
              Openfort agent wallet
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate font-mono text-[12px] text-foreground/90">
                {info.agent.address}
              </code>
              <button
                type="button"
                onClick={copyAddress}
                className="border border-white/[0.08] p-1.5 text-white/40 hover:text-white/70"
                aria-label="Copy address"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
            <p className="mt-1 font-mono text-[10px] text-white/25">
              Arbitrum Sepolia · Axon pays MCP tools from this address
            </p>
          </div>

          {/* Fund — Sepolia only (UA can't target Sepolia) */}
          <div className="space-y-2 border border-white/[0.06] p-3">
            <div className="flex items-center gap-1.5 text-[11px] text-white/45">
              <Wallet className="h-3.5 w-3.5" /> Fund with Sepolia USDC
            </div>
            <p className="text-[11px] leading-relaxed text-white/35">
              Transfer Arbitrum Sepolia USDC to the agent address above. MCP tools
              settle on Sepolia — Particle Universal Account moves mainnet assets
              only, so it can&apos;t fund this wallet.
            </p>
            <Button
              type="button"
              size="sm"
              className="w-full font-mono text-[11px]"
              onClick={() => onFundSepolia?.(info.agent.address)}
            >
              Transfer USDC to agent
              <ArrowRight className="ml-1.5 h-3 w-3" />
            </Button>
          </div>

          {/* Spending policy */}
          <div className="space-y-3 border border-white/[0.06] p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-[11px] text-white/45">
                <Shield className="h-3.5 w-3.5" /> Spending policy
              </div>
              <span
                className={`font-mono text-[10px] uppercase tracking-wider ${
                  info.policy.enabled
                    ? "text-emerald-400/80"
                    : "text-amber-400/80"
                }`}
              >
                {info.policy.enabled ? "Enabled" : "Not set — required for MCP"}
              </span>
            </div>

            {!editingPolicy ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/[0.02] px-3 py-2.5">
                    <p className="font-mono text-[10px] uppercase tracking-wider text-white/30">
                      Max / call
                    </p>
                    <p className="mt-1 font-mono text-[15px] tabular-nums text-foreground/90">
                      {formatUsdc(info.policy.maxPerCall)}{" "}
                      <span className="text-[11px] text-white/35">USDC</span>
                    </p>
                  </div>
                  <div className="bg-white/[0.02] px-3 py-2.5">
                    <p className="font-mono text-[10px] uppercase tracking-wider text-white/30">
                      Max / day
                    </p>
                    <p className="mt-1 font-mono text-[15px] tabular-nums text-foreground/90">
                      {formatUsdc(info.policy.maxPerDay)}{" "}
                      <span className="text-[11px] text-white/35">USDC</span>
                    </p>
                  </div>
                </div>
                <p className="font-mono text-[10px] text-white/25">
                  Spent today: {formatUsdc(info.policy.spentToday, 4)} USDC
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full font-mono text-[11px]"
                  onClick={startEdit}
                >
                  <Pencil className="mr-1.5 h-3 w-3" />
                  Update policy
                </Button>
              </>
            ) : (
              <>
                <p className="text-[11px] leading-relaxed text-white/35">
                  Caps for automatic MCP payments from your agent wallet. No
                  popup per call once enabled.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[10px] text-white/30">
                      Max / call (USDC)
                    </Label>
                    <Input
                      inputMode="decimal"
                      value={maxPerCall}
                      onChange={(e) => setMaxPerCall(e.target.value)}
                      onBlur={() =>
                        setMaxPerCall(normalizeUsdcInput(maxPerCall))
                      }
                      className="h-8 font-mono text-[12px]"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-white/30">
                      Max / day (USDC)
                    </Label>
                    <Input
                      inputMode="decimal"
                      value={maxPerDay}
                      onChange={(e) => setMaxPerDay(e.target.value)}
                      onBlur={() => setMaxPerDay(normalizeUsdcInput(maxPerDay))}
                      className="h-8 font-mono text-[12px]"
                    />
                  </div>
                </div>
                <p className="font-mono text-[10px] text-white/25">
                  Spent today: {formatUsdc(info.policy.spentToday, 4)} USDC
                </p>
                <div className="flex gap-2">
                  {info.policy.enabled && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="flex-1 font-mono text-[11px]"
                      disabled={savingPolicy}
                      onClick={cancelEdit}
                    >
                      Cancel
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    className="flex-1 font-mono text-[11px]"
                    disabled={savingPolicy}
                    onClick={savePolicy}
                  >
                    {savingPolicy ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : info.policy.enabled ? (
                      "Save limits"
                    ) : (
                      "Enable spending"
                    )}
                  </Button>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
