"use client";

import { useCallback, useRef, useState } from "react";
import { createUsdcClient } from "@x402/client";

type WorkflowStage = "idle" | "running" | "done" | "error";

type StepData = {
  name: string;
  stage: "pending" | "running" | "done" | "error";
  result?: unknown;
  error?: string;
  price: string;
};

export default function WorkflowPage() {
  const [workflowStage, setWorkflowStage] = useState<WorkflowStage>("idle");
  const [steps, setSteps] = useState<StepData[]>([
    { name: "Generate Image", stage: "pending", price: "0.10" },
    { name: "Generate Video (async job)", stage: "pending", price: "0.50" }
  ]);
  const [totalSpent, setTotalSpent] = useState<string | null>(null);

  const clientRef = useRef(
    createUsdcClient({
      payer: async (quote) => {
        const payRes = await fetch("/api/pay", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ quote })
        });

        const body = await payRes.json().catch(() => ({ error: "Failed to parse response" }));

        if (!payRes.ok || body?.error) {
          const errorMsg = body?.error || `Payment failed (${payRes.status})`;
          throw new Error(String(errorMsg));
        }

        if (!body?.txSig) {
          throw new Error("Missing transaction signature");
        }

        return body.txSig;
      }
    })
  );

  const runWorkflow = useCallback(async () => {
    const base =
      process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
      window.location.origin;

    setWorkflowStage("running");
    setSteps((s) => s.map((step) => ({ ...step, stage: "pending" as const })));

    const prompt = "a robot dancing on a blockchain";

    try {
      // Step 1: Generate image
      setSteps((s) => {
        const newSteps = [...s];
        newSteps[0] = Object.assign({}, newSteps[0], { stage: "running" as const });
        return newSteps;
      });

      const imageRes = await clientRef.current.fetch(`${base}/api/generate-image`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt })
      });

      if (!imageRes.ok) {
        throw new Error("Image generation failed");
      }

      const imageData = await imageRes.json();

      setSteps((s) => {
        const newSteps = [...s];
        newSteps[0] = Object.assign({}, newSteps[0], { stage: "done" as const, result: imageData });
        return newSteps;
      });

      // Step 2: Start video job (async — returns jobId; poll GET /api/generate-video/{jobId})
      setSteps((s) => {
        const newSteps = [...s];
        newSteps[1] = Object.assign({}, newSteps[1], { stage: "running" as const });
        return newSteps;
      });

      const videoRes = await clientRef.current.fetch(`${base}/api/generate-video`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt })
      });

      if (!videoRes.ok) {
        throw new Error("Video job create failed");
      }

      const videoData = await videoRes.json();

      setSteps((s) => {
        const newSteps = [...s];
        newSteps[1] = Object.assign({}, newSteps[1], { stage: "done" as const, result: videoData });
        return newSteps;
      });

      setTotalSpent("0.60");
      setWorkflowStage("done");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setSteps((s) =>
        s.map((step) => ({
          ...step,
          stage: "error" as const,
          error: msg
        }))
      );
      setWorkflowStage("error");
    }
  }, []);

  return (
    <main style={{ display: "flex", flexDirection: "column", gap: 32, maxWidth: 800, margin: "0 auto", padding: "32px 16px" }}>
      <div>
        <h1 style={{ margin: "0 0 8px 0", fontSize: 32 }}>Multi-API Workflow</h1>
        <p style={{ margin: 0, color: "#666", fontSize: 16, lineHeight: 1.6 }}>
          Demonstrates sequential API calls with automatic payments. Each step pays exactly what it costs.
        </p>
      </div>

      <div>
        <button
          onClick={runWorkflow}
          disabled={workflowStage === "running"}
          style={{
            padding: "12px 24px",
            fontSize: 16,
            fontWeight: 600,
            borderRadius: 6,
            border: "none",
            background: workflowStage === "running" ? "#ccc" : "#0070f3",
            color: "#fff",
            cursor: workflowStage === "running" ? "not-allowed" : "pointer"
          }}
        >
          {workflowStage === "running" ? "Running Workflow..." : "Run Workflow"}
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {steps.map((step, i) => (
          <div
            key={i}
            style={{
              padding: 16,
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              background:
                step.stage === "done"
                  ? "#f0fdf4"
                  : step.stage === "error"
                  ? "#fef2f2"
                  : step.stage === "running"
                  ? "#f0f9ff"
                  : "#fafafa"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{step.name}</h3>
                <p style={{ margin: "4px 0 0 0", fontSize: 14, color: "#666" }}>
                  Cost: {step.price} USDC
                </p>
              </div>
              <div style={{ textAlign: "right" }}>
                {step.stage === "pending" && (
                  <div style={{ fontSize: 14, color: "#999" }}>Waiting...</div>
                )}
                {step.stage === "running" && (
                  <div style={{ fontSize: 14, color: "#0070f3", fontWeight: 600 }}>Running...</div>
                )}
                {step.stage === "done" && (
                  <div style={{ fontSize: 14, color: "#10b981", fontWeight: 600 }}>✓ Done</div>
                )}
                {step.stage === "error" && (
                  <div style={{ fontSize: 14, color: "#991b1b", fontWeight: 600 }}>✗ Error</div>
                )}
              </div>
            </div>

            {step.result ? (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #e5e7eb" }}>
                {(() => {
                  const result = step.result as unknown;
                  if (typeof result === "object" && result !== null) {
                    const obj = result as Record<string, unknown>;
                    if ("video" in obj && typeof obj.video === "object" && obj.video !== null) {
                      const video = obj.video as Record<string, unknown>;
                      if (video.type === "url" && typeof video.value === "string") {
                        return (
                          <video
                            controls
                            src={video.value}
                            style={{ maxWidth: "100%", borderRadius: 6 }}
                          />
                        );
                      }
                      if (video.type === "svg" && typeof video.value === "string") {
                        return (
                          <img
                            src={video.value}
                            alt="Generated video"
                            style={{ maxWidth: "100%", borderRadius: 6 }}
                          />
                        );
                      }
                    }
                    if ("image" in obj) {
                      return (
                        <img
                          src={String(obj.image)}
                          alt="Generated"
                          style={{ maxWidth: "100%", borderRadius: 6 }}
                        />
                      );
                    }
                    if ("text" in obj) {
                      return (
                        <pre
                          style={{
                            background: "#f5f5f5",
                            padding: 12,
                            borderRadius: 6,
                            fontSize: 12,
                            margin: 0,
                            whiteSpace: "pre-wrap"
                          }}
                        >
                          {String(obj.text)}
                        </pre>
                      );
                    }
                    if ("summary" in obj) {
                      return (
                        <pre
                          style={{
                            background: "#f5f5f5",
                            padding: 12,
                            borderRadius: 6,
                            fontSize: 12,
                            margin: 0,
                            whiteSpace: "pre-wrap"
                          }}
                        >
                          {String(obj.summary)}
                        </pre>
                      );
                    }
                  }
                  return <div style={{ fontSize: 12, color: "#666" }}>Result received</div>;
                })()}
              </div>
            ) : null}

            {step.error && (
              <div
                style={{
                  marginTop: 12,
                  padding: 12,
                  background: "#fca5a5",
                  borderRadius: 6,
                  fontSize: 12,
                  color: "#991b1b"
                }}
              >
                {step.error}
              </div>
            )}
          </div>
        ))}
      </div>

      {workflowStage === "done" && totalSpent && (
        <div
          style={{
            padding: 16,
            background: "#f0fdf4",
            borderRadius: 8,
            border: "1px solid #86efac"
          }}
        >
          <h3 style={{ margin: "0 0 8px 0", fontSize: 16, fontWeight: 600, color: "#166534" }}>
            Workflow Complete
          </h3>
          <p style={{ margin: "0 0 4px 0", fontSize: 14, color: "#166534" }}>
            Total paid: <strong>{totalSpent} USDC</strong>
          </p>
          <p style={{ margin: "0 0 4px 0", fontSize: 14, color: "#166534" }}>
            2 API calls executed and settled instantly on Arbitrum
          </p>
        </div>
      )}

      {workflowStage === "error" && (
        <div
          style={{
            padding: 16,
            background: "#fef2f2",
            borderRadius: 8,
            border: "1px solid #fca5a5"
          }}
        >
          <h3 style={{ margin: "0 0 8px 0", fontSize: 16, fontWeight: 600, color: "#991b1b" }}>
            Workflow Failed
          </h3>
          <p style={{ margin: 0, fontSize: 14, color: "#991b1b" }}>
            One or more steps encountered an error. Check the step details above.
          </p>
        </div>
      )}
    </main>
  );
}
