"use client";

import { useEffect, useState } from "react";
import { Copy, Check, Zap, Code2, FileJson, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { shortenAddress, formatAmount } from "@/lib/utils";

interface ApiListing {
  id: number;
  name: string;
  description: string | null;
  endpoint_url: string;
  price_per_call: string;
  chain: string;
  owner_wallet: string;
  sample_request: Record<string, unknown> | null;
  sample_response: Record<string, unknown> | null;
  created_at: string;
}

// ─── Copy Button ─────────────────────────────────────────────────────────────

function CopyButton({ text, label, className = "" }: { text: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      onClick={handleCopy}
      className={`flex items-center gap-1.5 text-xs transition-colors ${
        copied ? "text-primary" : "text-muted-foreground hover:text-foreground"
      } ${className}`}
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {label ?? (copied ? "Copied!" : "Copy")}
    </button>
  );
}

// ─── JSON Block ───────────────────────────────────────────────────────────────

function JsonBlock({ label, data, icon: Icon }: {
  label: string;
  data: Record<string, unknown>;
  icon: React.ElementType;
}) {
  const text = JSON.stringify(data, null, 2);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5 text-primary/60" />
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
        </div>
        <CopyButton text={text} />
      </div>
      <pre className="text-xs font-mono text-muted-foreground/80 bg-background/60 border border-border/60 rounded-lg p-4 overflow-x-auto max-h-52 whitespace-pre leading-relaxed">
        {text}
      </pre>
    </div>
  );
}

// ─── API Detail Modal ─────────────────────────────────────────────────────────

function ApiDetailModal({ api, onClose }: { api: ApiListing; onClose: () => void }) {
  const mcpSnippet = JSON.stringify(
    { tool: "execute_api_call", params: { apiId: api.id, name: api.name } },
    null, 2
  );
  const hasSchema = api.sample_request || api.sample_response;

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden border-border bg-card gap-0 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border shrink-0">
          <DialogHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-lg font-semibold leading-tight">{api.name}</DialogTitle>
                <p className="text-xs font-mono text-muted-foreground mt-1">{shortenAddress(api.owner_wallet, 8)}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-2xl font-bold text-primary tabular-nums">{formatAmount(api.price_per_call)}</p>
                <p className="text-xs text-muted-foreground">USDC / call</p>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/[0.08] px-2 py-0.5 text-[11px] font-medium text-primary">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                {api.chain}
              </span>
            </div>
          </DialogHeader>
        </div>

        {/* Scrollable body */}
        <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1">
          {api.description && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-widest">Description</p>
              <p className="text-sm text-foreground/80 leading-relaxed">{api.description}</p>
            </div>
          )}

          {/* MCP snippet */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">MCP Integration</p>
              <CopyButton text={mcpSnippet} label="Copy snippet" />
            </div>
            <pre className="text-xs font-mono text-muted-foreground/80 bg-background/60 border border-border/60 rounded-lg p-4 leading-relaxed">
              {mcpSnippet}
            </pre>
          </div>

          {/* Schema */}
          {hasSchema && (
            <div className="space-y-4 border-t border-border/50 pt-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Schema</p>
              {api.sample_request && (
                <JsonBlock label="Request body" data={api.sample_request} icon={Code2} />
              )}
              {api.sample_response && (
                <JsonBlock label="Response" data={api.sample_response} icon={FileJson} />
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── API Card ─────────────────────────────────────────────────────────────────

function ApiCard({ api, index, onDetails }: { api: ApiListing; index: number; onDetails: () => void }) {
  const mcpSnippet = JSON.stringify(
    { tool: "execute_api_call", params: { apiId: api.id, name: api.name } },
    null, 2
  );
  const hasSchema = api.sample_request || api.sample_response;

  return (
    <div
      className="group relative rounded-2xl border border-border/70 bg-gradient-to-br from-card via-card to-card/50
                 p-6 flex flex-col gap-4 cursor-pointer
                 hover:border-primary/25 hover:shadow-[0_0_32px_rgba(52,211,153,0.06)]
                 transition-all duration-300 animate-fade-up"
      style={{ animationDelay: `${index * 55}ms`, animationFillMode: "both" }}
      onClick={onDetails}
    >
      {/* Gradient shine on hover */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/[0.04] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

      {/* Name + Price */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground text-base leading-tight group-hover:text-primary/90 transition-colors duration-200">
            {api.name}
          </h3>
          <p className="text-[11px] font-mono text-muted-foreground/50 mt-1">
            {shortenAddress(api.owner_wallet, 6)}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xl font-bold text-primary tabular-nums leading-tight">
            {formatAmount(api.price_per_call)}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">USDC / call</p>
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2 flex-1 min-h-[2.5rem]">
        {api.description || <span className="italic opacity-50">No description provided.</span>}
      </p>

      {/* Footer */}
      <div
        className="flex items-center justify-between pt-3 border-t border-border/40"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-primary/50" />
          <span className="text-[11px] text-muted-foreground/70">{api.chain}</span>
        </div>
        <div className="flex items-center gap-3">
          <CopyButton text={mcpSnippet} label="Copy MCP" />
          {hasSchema && (
            <button
              onClick={(e) => { e.stopPropagation(); onDetails(); }}
              className="text-xs text-primary/70 hover:text-primary transition-colors font-medium"
            >
              Schema →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Skeleton Card ────────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-6 flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-3 w-24" />
        </div>
        <div className="text-right space-y-1.5">
          <Skeleton className="h-7 w-16 ml-auto" />
          <Skeleton className="h-3 w-20 ml-auto" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
      </div>
      <div className="flex items-center justify-between pt-3 border-t border-border/40">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MarketplacePage() {
  const [apis, setApis] = useState<ApiListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalApi, setModalApi] = useState<ApiListing | null>(null);

  useEffect(() => {
    fetch("/api/apis")
      .then((r) => r.json())
      .then(({ apis }) => setApis(apis ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = apis.filter(
    (a) =>
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      (a.description ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Marketplace</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {loading ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin" />
                Loading APIs…
              </span>
            ) : (
              `${apis.length} API${apis.length !== 1 ? "s" : ""} available for agents`
            )}
          </p>
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/[0.08] px-3 py-1 text-xs font-medium text-primary">
          <Zap className="h-3 w-3" />
          Arbitrum Sepolia
        </div>
      </div>

      {/* Search */}
      <Input
        placeholder="Search APIs…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : !filtered.length ? (
        <div className="py-24 text-center text-muted-foreground text-sm">
          {search ? `No APIs matching "${search}"` : "No APIs published yet."}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {filtered.map((api, i) => (
            <ApiCard
              key={api.id}
              api={api}
              index={i}
              onDetails={() => setModalApi(api)}
            />
          ))}
        </div>
      )}

      {/* Detail modal */}
      {modalApi && (
        <ApiDetailModal api={modalApi} onClose={() => setModalApi(null)} />
      )}
    </div>
  );
}
