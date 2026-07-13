"use client";

import { useAuth } from "@/components/providers";
import { LogOut, Copy, ChevronDown, ArrowUpRight, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { shortenAddress } from "@/lib/utils";
import { useState, useCallback } from "react";
import { TransferModal } from "@/components/wallet-modal";
import { useUniversalAccount } from "@/hooks/use-universal-account";

export function Topbar() {
  const { user, logout } = useAuth();
  const [copied, setCopied] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);

  const address = user?.wallet ?? "";

  const { balance: agentBalance, loading: balanceLoading, refetch: refetchBalance } = useUniversalAccount(address || undefined);

  const copyAddress = useCallback(async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [address]);

  const initials = user?.email
    ? user.email.slice(0, 2).toUpperCase()
    : address.slice(2, 4).toUpperCase();

  return (
    <>
      <header className="fixed top-0 left-60 right-0 h-16 z-20 border-b border-border flex items-center justify-between px-6 bg-background/80 backdrop-blur-sm">
        <div />

        <div className="flex items-center gap-3">
          {address && (
            <button
              onClick={copyAddress}
              className="flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-3 py-1.5 text-xs font-mono text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <span>{shortenAddress(address)}</span>
              <Copy className="h-3 w-3" />
              {copied && <span className="text-primary">Copied!</span>}
            </button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2 h-9 px-2">
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="text-xs bg-primary/15 text-primary">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              {/* Identity */}
              <DropdownMenuLabel className="font-normal pb-2">
                <div className="flex flex-col gap-0.5">
                  {user?.email && (
                    <p className="text-sm font-medium leading-none text-foreground">
                      {user.email}
                    </p>
                  )}
                  {address && (
                    <p className="text-xs leading-none text-muted-foreground font-mono mt-1">
                      {shortenAddress(address)}
                    </p>
                  )}
                </div>
              </DropdownMenuLabel>

              {/* Balances */}
              <div className="mx-1 mb-1 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/60">
                    Agent balance{agentBalance?.stub ? " (demo)" : ""}
                  </span>
                  <button
                    onClick={(e) => { e.preventDefault(); refetchBalance(); }}
                    disabled={balanceLoading}
                    className="text-muted-foreground/50 hover:text-muted-foreground transition-colors disabled:opacity-40"
                  >
                    <RefreshCw className={`h-3 w-3 ${balanceLoading ? "animate-spin" : ""}`} />
                  </button>
                </div>
                {balanceLoading && !agentBalance ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Loading…
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Unified (all chains)</span>
                      <span className="text-xs font-mono font-medium text-foreground tabular-nums">
                        ${agentBalance?.unifiedUsd ?? "0.00"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">USDC on Arbitrum</span>
                      <span className="text-xs font-mono font-medium text-primary tabular-nums">
                        ${agentBalance?.arbitrumUsdc ?? "0.00"}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                className="cursor-pointer gap-2 text-sm"
                onClick={() => setTransferOpen(true)}
              >
                <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                Transfer funds
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                className="text-destructive focus:text-destructive cursor-pointer gap-2 text-sm"
                onClick={logout}
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <TransferModal open={transferOpen} onClose={() => setTransferOpen(false)} />
    </>
  );
}
