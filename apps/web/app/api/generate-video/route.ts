import { createVideoJob } from "@/lib/azure-video";
import { requireUsdcPayment, withX402Tnx } from "@/lib/x402-paywall";

export const maxDuration = 60;

const ENDPOINT = "/api/generate-video";
const PRICING = {
  price: 0.5,
  name: "AI Video Generation",
  category: "AI",
  description: "Generate a short video clip using Azure Sora",
} as const;

/**
 * Paid create — returns jobId immediately.
 * Poll GET /api/generate-video/[jobId] until status is completed.
 */
export async function POST(req: Request) {
  const gate = await requireUsdcPayment(req, ENDPOINT, PRICING);
  if (!gate.ok) return gate.response;

  try {
    const body = (await req.json()) as { prompt?: unknown };
    const prompt = body?.prompt;
    if (!prompt || typeof prompt !== "string") {
      return Response.json({ error: "Missing prompt" }, { status: 400 });
    }

    const { jobId } = await createVideoJob(prompt);
    return Response.json(
      withX402Tnx(
        {
          jobId,
          status: "queued",
          pollUrl: `/api/generate-video/${jobId}`,
          hint: "Poll GET pollUrl until status is completed, then use video.url",
        },
        gate.x402Tnx
      )
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Video job create error:", msg);
    return Response.json({ error: "Video service unavailable" }, { status: 502 });
  }
}
