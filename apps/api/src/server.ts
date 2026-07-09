import "dotenv/config";
import cors from "cors";
import express from "express";
import { usdcPaywall, type PaidEvent } from "@x402/payment-middleware";
import { getEnv } from "./env.js";
import { createMetricsStore } from "./metrics.js";
import { generateImage } from "./image.js";
import { generateVideo } from "./video.js";

const env = getEnv();
const app = express();

app.use(cors({ origin: true, credentials: false }));
app.use(express.json());

const metrics = createMetricsStore();

const MARKETPLACE_APIS = [
  {
    endpoint: "/api/generate-image",
    method: "POST",
    name: "AI Image Generation",
    description: "Generate an image from a text prompt",
    category: "AI",
    price: "0.10",
    token: "USDC",
    apiType: "image-generation",
    source: "internal",
    owner: "x402-demo"
  },
  {
    endpoint: "/api/generate-video",
    method: "POST",
    name: "AI Video Generation",
    description: "Generate a short video clip using Azure Sora",
    category: "AI",
    price: "0.50",
    token: "USDC",
    apiType: "video-generation",
    source: "internal",
    owner: "x402-demo"
  }
] as const;

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use((req, _res, next) => {
  const key = `${req.method} ${req.path}`;
  metrics.recordRequest(key);
  next();
});

app.get("/api/marketplace", (_req, res) => {
  res.json(MARKETPLACE_APIS);
});

app.use(
  usdcPaywall(
    {
      "/api/generate-image": { price: 0.1, name: "AI Image Generation", category: "AI", description: "Generate an image from a text prompt" },
      "/api/generate-video": { price: 0.5, name: "AI Video Generation", category: "AI", description: "Generate a short video clip using Azure Sora" }
    },
    env.RECEIVER_ADDRESS,
    env.ARBITRUM_RPC_URL,
    {
      tokenAddress: env.TOKEN_ADDRESS,
      onPaid: (evt: PaidEvent) => {
        const key = `${evt.method} ${evt.endpoint}`;
        metrics.recordPaid(key, evt.price);
      }
    }
  )
);

app.post("/api/generate-image", async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "Missing prompt" });
    }
    const image = await generateImage(prompt);
    res.json({ image });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Image generation error:", msg);
    res.status(502).json({ error: "Image service unavailable" });
  }
});

app.post("/api/generate-video", async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "Missing prompt" });
    }
    const video = await generateVideo(prompt);
    res.json({ video });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Video generation error:", msg);
    res.status(502).json({ error: "Video service unavailable" });
  }
});

app.get("/dashboard/metrics", (_req, res) => {
  res.json(metrics.snapshot());
});

const port = Number(env.PORT);
app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});

