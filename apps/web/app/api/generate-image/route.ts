import { generateImage } from "@/lib/azure-image";
import { requireUsdcPayment, withX402Tnx } from "@/lib/x402-paywall";

export const maxDuration = 60;

const ENDPOINT = "/api/generate-image";
const PRICING = {
  price: 0.1,
  name: "AI Image Generation",
  category: "AI",
  description: "Generate an image from a text prompt",
} as const;

export async function POST(req: Request) {
  const gate = await requireUsdcPayment(req, ENDPOINT, PRICING);
  if (!gate.ok) return gate.response;

  try {
    const body = (await req.json()) as { prompt?: unknown };
    const prompt = body?.prompt;
    if (!prompt || typeof prompt !== "string") {
      return Response.json({ error: "Missing prompt" }, { status: 400 });
    }

    const image = await generateImage(prompt);
    return Response.json(withX402Tnx({ image }, gate.x402Tnx));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Image generation error:", msg);
    return Response.json({ error: "Image service unavailable" }, { status: 502 });
  }
}
