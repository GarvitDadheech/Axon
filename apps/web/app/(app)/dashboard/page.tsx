"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/components/providers";
import { ExternalLink, RefreshCw, Search } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { shortenAddress, formatAmount } from "@/lib/utils";
import { useAgentWallet } from "@/hooks/use-agent-wallet";
import { AgentWalletPanel } from "@/components/agent-wallet-panel";
import { TransferModal } from "@/components/wallet-modal";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Stats {
  total_calls: string;
  total_spent: string;
  successful_calls: string;
  failed_calls: string;
}

interface IncomingStats {
  incoming_calls: string;
  total_earned: string;
}

interface RecentCall {
  id: number;
  api_name: string;
  amount_spent: string;
  status: string;
  tx_hash: string | null;
  created_at: string;
}

interface PublishedApi {
  id: number;
  name: string;
  price_per_call: string;
  total_calls?: number;
}

interface MarketplaceApi {
  id: number;
  name: string;
  description: string | null;
  price_per_call: string;
  chain: string;
}

interface DashboardData {
  stats: Stats | null;
  incomingStats: IncomingStats | null;
  recentCalls: RecentCall[];
  publishedApis: PublishedApi[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRelativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function settlementLabel(status: string) {
  if (status === "success") return "Settled";
  if (status === "pending") return "Pending";
  return "Failed";
}

function statusStyles(status: string) {
  if (status === "success")
    return "text-emerald-400/90 border-emerald-500/25 bg-emerald-500/[0.06]";
  if (status === "pending")
    return "text-amber-400/90 border-amber-500/25 bg-amber-500/[0.06]";
  return "text-red-400/80 border-red-500/20 bg-red-500/[0.05]";
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

function Panel({
  title,
  meta,
  children,
  className = "",
}: {
  title: string;
  meta?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`border border-white/[0.07] bg-card/40 ${className}`}>
      <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-white/45">
          {title}
        </h2>
        {meta && (
          <span className="font-mono text-[10px] text-white/25">{meta}</span>
        )}
      </div>
      {children}
    </section>
  );
}

function ExecutionRow({ call }: { call: RecentCall }) {
  return (
    <div className="group border-b border-white/[0.05] px-5 py-4 last:border-b-0 hover:bg-white/[0.02] transition-colors">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${statusStyles(call.status)}`}
            >
              {call.status === "success" && (
                <span className="h-1 w-1 bg-emerald-400" />
              )}
              {settlementLabel(call.status)}
            </span>
            <code className="font-mono text-[13px] text-foreground/90 truncate">
              {call.api_name}
            </code>
          </div>
          <p className="mt-2 font-mono text-[11px] text-white/30">
            {formatRelativeTime(call.created_at)}
            <span className="mx-2 text-white/15">·</span>
            execute_api_call
            <span className="mx-2 text-white/15">·</span>
            id {call.id}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="font-mono text-[13px] text-emerald-400/80 tabular-nums">
            {Number(call.amount_spent).toFixed(4)} USDC
          </p>
          {call.tx_hash ? (
            <a
              href={`https://sepolia.arbiscan.io/tx/${call.tx_hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1 font-mono text-[10px] text-white/35 hover:text-emerald-400/70 transition-colors"
            >
              {shortenAddress(call.tx_hash, 6)}
              <ExternalLink className="h-3 w-3" />
            </a>
          ) : (
            <p className="mt-1 font-mono text-[10px] text-white/20">pending tx</p>
          )}
        </div>
      </div>
    </div>
  );
}

function ActivityPulse({ calls }: { calls: RecentCall[] }) {
  if (calls.length === 0) {
    return (
      <p className="px-5 py-6 text-[13px] text-white/35">
        No agent executions yet. Connect MCP to start calling APIs.
      </p>
    );
  }

  return (
    <div className="divide-y divide-white/[0.05]">
      {calls.slice(0, 5).map((call) => (
        <div
          key={call.id}
          className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-white/[0.015] transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0">
            <span
              className={`h-1.5 w-1.5 shrink-0 ${
                call.status === "success"
                  ? "bg-emerald-400"
                  : call.status === "pending"
                    ? "bg-amber-400"
                    : "bg-red-400/70"
              }`}
            />
            <code className="font-mono text-[12px] text-white/55 truncate">
              {call.api_name}
            </code>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <span className="font-mono text-[11px] text-white/30 hidden sm:inline">
              {settlementLabel(call.status)}
            </span>
            <span className="font-mono text-[11px] text-white/25">
              {formatRelativeTime(call.created_at)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function MarketplaceRow({ api }: { api: MarketplaceApi }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/[0.05] px-5 py-3.5 last:border-b-0 hover:bg-white/[0.02] transition-colors">
      <div className="min-w-0">
        <p className="font-mono text-[13px] text-foreground/85 truncate">{api.name}</p>
        <p className="mt-0.5 text-[12px] text-white/30 truncate max-w-[280px]">
          {api.description ?? "No description"}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="font-mono text-[12px] text-emerald-400/75 tabular-nums">
          {formatAmount(api.price_per_call)} USDC
        </p>
        <p className="font-mono text-[10px] text-white/25 mt-0.5">{api.chain}</p>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { getIdToken, user } = useAuth();
  const address = user?.wallet ?? undefined;
  const {
    info: agentWallet,
    loading: balanceLoading,
    refetch: refetchBalance,
  } = useAgentWallet();
  const agentBalanceUsdc = agentWallet?.usdc ?? "0.00";

  const [data, setData] = useState<DashboardData>({
    stats: null,
    incomingStats: null,
    recentCalls: [],
    publishedApis: [],
  });
  const [marketplace, setMarketplace] = useState<MarketplaceApi[]>([]);
  const [search, setSearch] = useState("");
  const [loadingData, setLoadingData] = useState(true);
  const [loadingMarket, setLoadingMarket] = useState(true);
  const [fundModalOpen, setFundModalOpen] = useState(false);
  const [fundRecipient, setFundRecipient] = useState("");

  const fetchDashboard = useCallback(async () => {
    setLoadingData(true);
    try {
      const token = await getIdToken();
      const res = await fetch("/api/stats", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setData({
          stats: json.stats ?? null,
          incomingStats: json.incomingStats ?? null,
          recentCalls: json.recentCalls ?? [],
          publishedApis: json.publishedApis ?? [],
        });
      }
    } catch {
      // silent
    } finally {
      setLoadingData(false);
    }
  }, [getIdToken]);

  const fetchMarketplace = useCallback(async () => {
    setLoadingMarket(true);
    try {
      const res = await fetch("/api/apis");
      if (res.ok) {
        const json = await res.json();
        setMarketplace(json.apis ?? []);
      }
    } catch {
      // silent
    } finally {
      setLoadingMarket(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
    fetchMarketplace();
  }, [fetchDashboard, fetchMarketplace]);

  const handleRefresh = () => {
    fetchDashboard();
    fetchMarketplace();
    refetchBalance();
  };

  const settledTotal = Number(data.stats?.total_spent ?? 0);
  const filteredApis = marketplace.filter(
    (a) =>
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      (a.description ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-400/60 mb-2">
            Mission control
          </p>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
            Agent operations
          </h1>
          <p className="mt-1 font-mono text-[11px] text-white/35">
            {user?.email ?? shortenAddress(address ?? "")}
            <span className="mx-2 text-white/15">·</span>
            Arbitrum
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={loadingData}
          className="flex items-center gap-2 border border-white/[0.08] px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-white/40 hover:text-white/70 hover:border-white/[0.14] transition-colors disabled:opacity-40"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loadingData ? "animate-spin" : ""}`} />
          Sync
        </button>
      </div>

      {/* Balance — concise strip */}
      <div className="grid grid-cols-3 gap-px border border-white/[0.07] bg-white/[0.07]">
        {[
          {
            label: "Agent USDC (Sepolia)",
            value: balanceLoading ? "…" : `${agentBalanceUsdc} USDC`,
          },
          {
            label: "Spent",
            value: `${settledTotal.toFixed(4)} USDC`,
          },
          {
            label: "Earned",
            value: `${Number(data.incomingStats?.total_earned ?? 0).toFixed(4)} USDC`,
          },
        ].map((item) => (
          <div key={item.label} className="bg-card/60 px-4 py-3.5">
            <p className="font-mono text-[10px] uppercase tracking-wider text-white/30">
              {item.label}
            </p>
            <div className="mt-1.5 font-mono text-[14px] text-foreground/90 tabular-nums">
              {loadingData && item.label !== "Agent USDC (Sepolia)" ? (
                <Skeleton className="h-4 w-20" />
              ) : (
                item.value
              )}
            </div>
          </div>
        ))}
      </div>

      <Panel title="Agent wallet & policy" meta="Openfort">
        <AgentWalletPanel
          onFundSepolia={(addr) => {
            setFundRecipient(addr);
            setFundModalOpen(true);
          }}
        />
      </Panel>

      <TransferModal
        open={fundModalOpen}
        onClose={() => setFundModalOpen(false)}
        defaultRecipient={fundRecipient}
        defaultAmount="5"
      />

      {/* Agent activity — first thing users see */}
      <Panel title="Agent activity" meta="live feed">
        {loadingData ? (
          <div className="space-y-2 p-5">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <ActivityPulse calls={data.recentCalls} />
        )}
      </Panel>

      <div className="grid gap-5 lg:grid-cols-12">
        {/* Execution history — dominant */}
        <Panel
          title="Execution history"
          meta={loadingData ? "…" : `${data.recentCalls.length} records`}
          className="lg:col-span-7"
        >
          {loadingData ? (
            <div className="space-y-2 p-5">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : data.recentCalls.length === 0 ? (
            <p className="px-5 py-10 text-[13px] text-white/35">
              Executions appear here like commits — status, tool, settlement, and tx
              proof.
            </p>
          ) : (
            <div>
              {data.recentCalls.map((call) => (
                <ExecutionRow key={call.id} call={call} />
              ))}
            </div>
          )}
        </Panel>

        {/* Marketplace discover */}
        <Panel
          title="Discover APIs"
          meta={loadingMarket ? "…" : `${marketplace.length} listed`}
          className="lg:col-span-5 flex flex-col"
        >
          <div className="border-b border-white/[0.06] px-4 py-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/25" />
              <Input
                placeholder="Search registry…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 border-white/[0.08] bg-background/50 pl-9 font-mono text-[12px] placeholder:text-white/25"
              />
            </div>
          </div>
          <div className="flex-1 max-h-[420px] overflow-y-auto">
            {loadingMarket ? (
              <div className="space-y-2 p-4">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : filteredApis.length === 0 ? (
              <p className="px-5 py-8 text-[13px] text-white/35">
                {search ? `No APIs matching "${search}"` : "Registry empty."}
              </p>
            ) : (
              filteredApis.slice(0, 8).map((api) => (
                <MarketplaceRow key={api.id} api={api} />
              ))
            )}
          </div>
          <div className="border-t border-white/[0.06] px-5 py-3 mt-auto">
            <Link
              href="/marketplace"
              className="font-mono text-[10px] uppercase tracking-wider text-white/35 hover:text-emerald-400/70 transition-colors"
            >
              Open full marketplace →
            </Link>
          </div>
        </Panel>
      </div>

      {/* Published APIs — supporting panel */}
      {data.publishedApis.length > 0 && (
        <Panel title="Your listings" meta={`${data.publishedApis.length} published`}>
          <div className="divide-y divide-white/[0.05]">
            {data.publishedApis.map((api) => (
              <div
                key={api.id}
                className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-white/[0.02]"
              >
                <code className="font-mono text-[12px] text-white/55">{api.name}</code>
                <div className="flex items-center gap-4">
                  {api.total_calls !== undefined && (
                    <span className="font-mono text-[10px] text-white/25">
                      {api.total_calls} calls
                    </span>
                  )}
                  <span className="font-mono text-[11px] text-emerald-400/70">
                    {api.price_per_call} USDC
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-white/[0.06] px-5 py-3">
            <Link
              href="/publish"
              className="font-mono text-[10px] uppercase tracking-wider text-white/35 hover:text-emerald-400/70 transition-colors"
            >
              Manage listings →
            </Link>
          </div>
        </Panel>
      )}
    </div>
  );
}
