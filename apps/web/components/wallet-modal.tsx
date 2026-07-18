"use client";

import { useState, useCallback, useEffect } from "react";
import { useAuth } from "@/components/providers";
// Particle Auth EIP-1193 provider via useAuth().ethereumProvider
import {
  ArrowUpRight,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
  Copy,
  Check,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { shortenAddress } from "@/lib/utils";

// ─── Constants ────────────────────────────────────────────────────────────────

const ARBITRUM_SEPOLIA_CHAIN_ID = 421614;
const ARBITRUM_SEPOLIA_HEX = `0x${ARBITRUM_SEPOLIA_CHAIN_ID.toString(16)}`;

const USDC_ADDRESS = "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d";
const USDC_DECIMALS = 6;

type Token = "USDC";
type ModalState = "idle" | "sending" | "success" | "error";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function encodeERC20Transfer(to: string, amount: bigint): string {
  const selector = "a9059cbb";
  const paddedTo = to.replace("0x", "").toLowerCase().padStart(64, "0");
  const paddedAmount = amount.toString(16).padStart(64, "0");
  return `0x${selector}${paddedTo}${paddedAmount}`;
}

function isValidAddress(addr: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(addr);
}

// ─── Transfer Modal ───────────────────────────────────────────────────────────

interface TransferModalProps {
  open: boolean;
  onClose: () => void;
  /** Prefill recipient (e.g. Openfort agent wallet address). */
  defaultRecipient?: string;
  defaultAmount?: string;
}

export function TransferModal({
  open,
  onClose,
  defaultRecipient = "",
  defaultAmount = "",
}: TransferModalProps) {
  const { user, ethereumProvider } = useAuth();

  const fromAddress = user?.wallet ?? "";

  const [recipient, setRecipient] = useState(defaultRecipient);
  const [amount, setAmount] = useState(defaultAmount);
  const [token] = useState<Token>("USDC");
  const [state, setState] = useState<ModalState>("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [copiedHash, setCopiedHash] = useState(false);

  // Sync prefills when modal opens with new defaults
  useEffect(() => {
    if (open) {
      if (defaultRecipient) setRecipient(defaultRecipient);
      if (defaultAmount) setAmount(defaultAmount);
    }
  }, [open, defaultRecipient, defaultAmount]);

  const recipientValid = recipient === "" || isValidAddress(recipient);
  const formValid =
    isValidAddress(recipient) &&
    parseFloat(amount) > 0 &&
    !!fromAddress;

  const canSend = state === "idle" && formValid;

  const reset = useCallback(() => {
    setRecipient(defaultRecipient);
    setAmount(defaultAmount);
    setState("idle");
    setTxHash(null);
    setErrorMsg("");
  }, [defaultRecipient, defaultAmount]);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const handleSend = useCallback(async () => {
    if (!fromAddress || !canSend) return;
    setState("sending");
    setErrorMsg("");

    try {
      const provider = ethereumProvider as {
        request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      } | null;
      if (!provider) throw new Error("Particle wallet not available");

      let hash: string;

      const amountWei = BigInt(Math.round(parseFloat(amount) * 10 ** USDC_DECIMALS));
      const data = encodeERC20Transfer(recipient, amountWei);
      hash = await provider.request({
        method: "eth_sendTransaction",
        params: [{
          from: fromAddress,
          to: USDC_ADDRESS,
          data,
          chainId: ARBITRUM_SEPOLIA_HEX,
        }],
      }) as string;

      setTxHash(hash);
      setState("success");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Transaction failed";
      setErrorMsg(msg.length > 120 ? msg.slice(0, 120) + "…" : msg);
      setState("error");
    }
  }, [fromAddress, canSend, amount, recipient, ethereumProvider]);

  const copyHash = useCallback(async () => {
    if (!txHash) return;
    await navigator.clipboard.writeText(txHash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 1500);
  }, [txHash]);

  const initials = user?.email
    ? user.email.slice(0, 2).toUpperCase()
    : fromAddress.slice(2, 4).toUpperCase();

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden border-border bg-card">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border">
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
                <ArrowUpRight className="h-4 w-4 text-primary" />
              </div>
              <DialogTitle className="text-base font-semibold">Transfer USDC</DialogTitle>
            </div>
          </DialogHeader>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {/* ── Success state ── */}
          {state === "success" && txHash ? (
            <div className="py-4 space-y-5">
              <div className="flex flex-col items-center text-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-400/10 border border-emerald-400/20">
                  <CheckCircle2 className="h-7 w-7 text-emerald-400" />
                </div>
                <div>
                  <p className="text-base font-semibold text-foreground">Transfer sent</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {amount} {token} → {shortenAddress(recipient)}
                  </p>
                </div>
              </div>

              {/* Tx hash */}
              <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5">
                <p className="text-xs text-muted-foreground">Transaction hash</p>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-mono text-foreground truncate">{shortenAddress(txHash, 12)}</p>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={copyHash} className="text-muted-foreground hover:text-foreground transition-colors">
                      {copiedHash ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                    <a
                      href={`https://sepolia.arbiscan.io/tx/${txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-primary transition-colors"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <Button variant="outline" className="flex-1" onClick={reset}>
                  Send another
                </Button>
                <Button className="flex-1" onClick={handleClose}>
                  Done
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* ── From ── */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">From</Label>
                <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
                  <Avatar className="h-7 w-7 shrink-0">
                    <AvatarFallback className="text-xs bg-primary/20 text-primary">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    {user?.email && (
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    )}
                    <p className="text-xs font-mono text-foreground">{shortenAddress(fromAddress)}</p>
                  </div>
                </div>
              </div>

              {/* ── To ── */}
              <div className="space-y-1.5">
                <Label htmlFor="recipient" className="text-xs text-muted-foreground">To</Label>
                <Input
                  id="recipient"
                  placeholder="0x..."
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  className={`font-mono text-sm ${recipient && !recipientValid ? "border-destructive focus-visible:ring-destructive" : ""}`}
                  disabled={state === "sending"}
                />
                {recipient && !recipientValid && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" /> Invalid address
                  </p>
                )}
              </div>

              {/* ── Amount ── */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Amount (USDC)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.000001"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="text-sm"
                  disabled={state === "sending"}
                />
                <p className="text-xs text-muted-foreground/60">
                  USDC on Arbitrum Sepolia
                </p>
              </div>

              {/* ── Error ── */}
              {state === "error" && errorMsg && (
                <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5 flex gap-2">
                  <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <p className="text-xs text-destructive leading-relaxed">{errorMsg}</p>
                </div>
              )}

              {/* ── Send button ── */}
              <Button
                className="w-full gap-2"
                onClick={handleSend}
                disabled={!formValid || state === "sending"}
              >
                {state === "sending" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending…
                  </>
                ) : (
                  <>
                    <ArrowUpRight className="h-4 w-4" />
                    Send {amount && parseFloat(amount) > 0 ? `${amount} USDC` : "USDC"}
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
