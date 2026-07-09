"use client";

import { useCallback, useMemo, useState } from "react";
import { createUsdcClient } from "@x402/client";
import type { Quote } from "@x402/client";

type Stage =
  | "idle"
  | "request_sent"
  | "payment_required"
  | "paying"
  | "verifying"
  | "done";

type DemoState =
  | { stage: "idle" }
  | { stage: "request_sent" }
  | { stage: "payment_required"; quote: Quote }
  | { stage: "paying"; quote: Quote }
  | { stage: "verifying"; quote: Quote; txSig: string }
  | { stage: "done"; result: unknown; txSig?: string; quote?: Quote }
  | { stage: "error"; message: string };

function getApiBaseUrl(): string {
  const v = process.env.NEXT_PUBLIC_API_BASE_URL;
  return v ?? "";
}

function getStageLabel(stage: Stage): string {
  switch (stage) {
    case "idle":
      return "Ready";
    case "request_sent":
      return "Request sent";
    case "payment_required":
      return "402 received (payment required)";
    case "paying":
      return "Payment submitted";
    case "verifying":
      return "Verifying payment";
    case "done":
      return "Response received";
  }
}

export default function DemoPage() {
  const apiBaseUrl = useMemo(() => getApiBaseUrl(), []);
  const [state, setState] = useState<DemoState>({ stage: "idle" });
  const [prompt, setPrompt] = useState("");

  const client = useMemo(
    () =>
      createUsdcClient({
        payer: async (quote) => {
          setState((prev) => {
            if (prev.stage !== "payment_required") return prev;
            return { ...prev, stage: "paying", quote };
          });

          const payRes = await fetch("/api/pay", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ quote })
          });

          const body = await payRes.json().catch(() => ({ error: "Failed to parse response" }));

          if (!payRes.ok || body?.error) {
            const errorMsg = body?.error || `Payment failed (${payRes.status})`;
            setState({
              stage: "error",
              message: String(errorMsg)
            });
            throw new Error(String(errorMsg));
          }

          if (!body?.txSig) {
            setState({
              stage: "error",
              message: "No transaction signature in payment response"
            });
            throw new Error("Missing txSig");
          }

          setState((prev) => {
            if (prev.stage !== "paying") return prev;
            return { ...prev, stage: "verifying", txSig: body.txSig };
          });

          return body.txSig;
        }
      }),
    []
  );

  const callAIGenerate = useCallback(async () => {
    if (!prompt.trim()) {
      setState({ stage: "error", message: "Please enter a prompt" });
      return;
    }
    if (!apiBaseUrl) {
      setState({ stage: "error", message: "Missing NEXT_PUBLIC_API_BASE_URL" });
      return;
    }

    setState({ stage: "request_sent" });

    try {
      const res = await client.fetch(`${apiBaseUrl}/api/ai/generate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt })
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setState({
          stage: "error",
          message: body?.reason ? String(body.reason) : `Request failed (${res.status})`
        });
        return;
      }

      const result = await res.json();
      setState((prev) => {
        return {
          stage: "done",
          result,
          txSig: "txSig" in prev ? prev.txSig : undefined,
          quote: "quote" in prev ? prev.quote : undefined
        };
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setState({ stage: "error", message: msg });
    }
  }, [apiBaseUrl, prompt, client]);

  const currentStage: Stage = state.stage === "error" ? "idle" : state.stage;
  const quote = "quote" in state ? state.quote : undefined;
  const txSig = "txSig" in state ? state.txSig : undefined;

  return (
    <main style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 800 }}>
      <div>
        <h1 style={{ margin: 0, marginBottom: 8, fontSize: 28 }}>
          Pay-per-use AI API with USDC
        </h1>
        <p style={{ margin: 0, color: "#555", lineHeight: 1.6 }}>
          Each request costs 0.02 USDC. No subscriptions. No API keys.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <label style={{ fontWeight: 600, fontSize: 14 }}>Enter your prompt:</label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g., Write a haiku about blockchain payments"
          style={{
            padding: 12,
            fontSize: 14,
            borderRadius: 6,
            border: "1px solid #ddd",
            minHeight: 80,
            fontFamily: "inherit",
            resize: "vertical"
          }}
        />
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={callAIGenerate}
            disabled={state.stage !== "idle"}
            style={{
              padding: "10px 20px",
              fontSize: 14,
              fontWeight: 600,
              borderRadius: 6,
              border: "none",
              background: state.stage === "idle" ? "#0070f3" : "#ccc",
              color: "#fff",
              cursor: state.stage === "idle" ? "pointer" : "not-allowed"
            }}
          >
            Generate
          </button>
          {state.stage === "payment_required" && quote && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
              <span style={{ color: "#666" }}>
                Pay <strong>{quote.price}</strong> {quote.token}
              </span>
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          padding: 16,
          background: "#f9fafb",
          borderRadius: 8,
          border: "1px solid #e5e7eb"
        }}
      >
        <h3 style={{ margin: "0 0 12px 0", fontSize: 16 }}>Payment Flow</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {(["idle", "request_sent", "payment_required", "paying", "verifying", "done"] as Stage[]).map(
            (s) => {
              const isActive = s === currentStage;
              const isPast =
                (["request_sent", "payment_required", "paying", "verifying", "done"].indexOf(currentStage) >
                  ["request_sent", "payment_required", "paying", "verifying", "done"].indexOf(s));
              return (
                <div
                  key={s}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    opacity: isActive || isPast ? 1 : 0.4
                  }}
                >
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: "50%",
                      background: isActive ? "#0070f3" : isPast ? "#10b981" : "#ddd",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#fff",
                      fontSize: 12,
                      fontWeight: 600
                    }}
                  >
                    {isPast ? "✓" : ""}
                  </div>
                  <span style={{ fontSize: 14 }}>{getStageLabel(s)}</span>
                </div>
              );
            }
          )}
        </div>

        {quote && (
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #e5e7eb" }}>
            <div style={{ fontSize: 13, color: "#666" }}>
              <div style={{ marginBottom: 4 }}>
                <strong>Endpoint:</strong> {quote.endpoint}
              </div>
              {quote.name && (
                <div style={{ marginBottom: 4 }}>
                  <strong>Name:</strong> {quote.name}
                </div>
              )}
              {quote.description && (
                <div style={{ marginBottom: 4 }}>
                  <strong>Description:</strong> {quote.description}
                </div>
              )}
              <div style={{ marginBottom: 4 }}>
                <strong>Price:</strong> {quote.price} {quote.token}
              </div>
              <div style={{ marginBottom: 4 }}>
                <strong>Reference:</strong> {quote.reference}
              </div>
              {txSig && (
                <div style={{ wordBreak: "break-all" }}>
                  <strong>Transaction:</strong> {txSig}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {state.stage === "error" && (
        <div
          style={{
            padding: 16,
            background: "#fef2f2",
            borderRadius: 8,
            border: "1px solid #fca5a5",
            color: "#991b1b"
          }}
        >
          <strong>Error:</strong> {state.message}
        </div>
      )}

      {state.stage === "done" && (
        <div
          style={{
            padding: 16,
            background: "#f0fdf4",
            borderRadius: 8,
            border: "1px solid #86efac"
          }}
        >
          <h3 style={{ margin: "0 0 12px 0", fontSize: 16, color: "#166534" }}>AI Response</h3>
          <div style={{ whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.6 }}>
            {state.result && typeof state.result === "object" && "text" in state.result
              ? String((state.result as any).text)
              : state.result
              ? JSON.stringify(state.result, null, 2)
              : "No result"}
          </div>
        </div>
      )}
    </main>
  );
}
