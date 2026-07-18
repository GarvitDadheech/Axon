"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, Copy, Loader2, RefreshCw } from "lucide-react";
import { useAuth } from "@/components/providers";
import { Button } from "@/components/ui/button";

function CopyBlock({
  label,
  text,
  mono = true,
}: {
  label: string;
  text: string;
  mono?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-[10px] uppercase tracking-wider text-white/35">
          {label}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 font-mono text-[11px]"
          disabled={!text}
          onClick={onCopy}
        >
          {copied ? (
            <>
              <Check className="mr-1.5 h-3 w-3" /> Copied
            </>
          ) : (
            <>
              <Copy className="mr-1.5 h-3 w-3" /> Copy
            </>
          )}
        </Button>
      </div>
      <pre
        className={`overflow-x-auto border border-white/[0.08] bg-black/30 px-3 py-3 text-[12px] leading-relaxed text-emerald-400/90 ${
          mono ? "font-mono" : ""
        } whitespace-pre-wrap break-all`}
      >
        {text || "—"}
      </pre>
    </div>
  );
}

export default function McpIntegrationPage() {
  const { ready, authenticated, getIdToken } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const origin =
    typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
  const mcpUrl = `${origin}/api/mcp`;

  const refreshToken = useCallback(async () => {
    if (!authenticated) return;
    setLoading(true);
    setError(null);
    try {
      setToken(await getIdToken());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setToken(null);
    } finally {
      setLoading(false);
    }
  }, [authenticated, getIdToken]);

  useEffect(() => {
    if (!ready || !authenticated) return;
    void refreshToken();
  }, [ready, authenticated, refreshToken]);

  const cursorConfig = useMemo(() => {
    if (!token) return "";
    return JSON.stringify(
      {
        mcpServers: {
          axon: {
            url: mcpUrl,
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        },
      },
      null,
      2
    );
  }, [token, mcpUrl]);

  const claudeCli = useMemo(() => {
    if (!token) return "";
    return `claude mcp add --transport http axon ${mcpUrl} \\
  --header "Authorization: Bearer ${token}"`;
  }, [token, mcpUrl]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          MCP integration
        </h1>
        <p className="mt-1 text-[13px] text-white/40">
          Copy your Particle token and paste the config into Cursor or Claude. Tool
          calls pay from your Openfort agent wallet.
        </p>
      </div>

      {error && (
        <p className="border border-red-500/20 bg-red-500/[0.06] px-3 py-2 text-[12px] text-red-300/90">
          {error}
        </p>
      )}

      <div className="space-y-4 border border-white/[0.06] p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[13px] text-white/50">
            {loading ? "Fetching Particle session…" : "Your credentials"}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 font-mono text-[11px] text-white/45"
            disabled={loading || !authenticated}
            onClick={() => void refreshToken()}
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <>
                <RefreshCw className="mr-1.5 h-3 w-3" /> Refresh token
              </>
            )}
          </Button>
        </div>

        <CopyBlock label="MCP endpoint" text={mcpUrl} />
        <CopyBlock label="Cursor / Claude Desktop — mcp.json" text={cursorConfig} />
        <CopyBlock label="Claude Code — CLI" text={claudeCli} />
      </div>

      <ol className="space-y-2 border border-white/[0.06] px-4 py-3 text-[12px] text-white/45">
        <li>
          1. Fund the agent with USDC and enable a spending policy on the{" "}
          <Link href="/dashboard" className="text-emerald-400/80 hover:underline">
            dashboard
          </Link>
          .
        </li>
        <li>2. Paste the config above into your MCP host and restart it.</li>
        <li>3. If calls return 401, hit Refresh token and paste again.</li>
      </ol>

      <p className="text-[11px] text-white/30">
        Full reference stays at{" "}
        <Link href="/docs/mcp" className="text-white/50 hover:underline">
          /docs/mcp
        </Link>
        .
      </p>
    </div>
  );
}
