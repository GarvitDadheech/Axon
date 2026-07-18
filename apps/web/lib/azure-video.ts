/**
 * Azure Sora video generation — async create + status poll
 * (sync polling exceeds Vercel serverless limits).
 */

function azureConfig() {
  const endpoint = (
    process.env.AZURE_SORA_ENDPOINT ||
    process.env.AZURE_OPENAI_ENDPOINT ||
    ""
  ).replace(/\/$/, "");
  const apiKey =
    process.env.AZURE_API_KEY || process.env.AZURE_OPENAI_API_KEY || "";
  const model = process.env.AZURE_VIDEO_MODEL || "sora2";

  if (!endpoint || !apiKey) {
    throw new Error(
      "Missing Azure video credentials. Set AZURE_SORA_ENDPOINT + AZURE_API_KEY (or AZURE_OPENAI_ENDPOINT + AZURE_OPENAI_API_KEY)."
    );
  }

  return { endpoint, apiKey, model };
}

function videoHeaders(apiKey: string): Record<string, string> {
  return {
    "Api-key": apiKey,
    "api-key": apiKey,
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

/** Create a video job; returns Azure job id (does not wait for completion). */
export async function createVideoJob(prompt: string): Promise<{ jobId: string }> {
  const { endpoint, apiKey, model } = azureConfig();
  const baseUrl = `${endpoint}/openai/v1`;

  const createRes = await fetch(`${baseUrl}/videos`, {
    method: "POST",
    headers: videoHeaders(apiKey),
    body: JSON.stringify({
      model,
      prompt,
      size: "720x1280",
      seconds: "4",
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`Failed to create job: ${createRes.status} - ${err}`);
  }

  const job = (await createRes.json()) as Record<string, unknown>;
  const videoId = job.id as string | undefined;
  if (!videoId) throw new Error("No video ID returned from job creation");

  return { jobId: videoId };
}

export type VideoJobStatus =
  | { status: "queued" | "in_progress" | "processing"; jobId: string }
  | { status: "completed"; jobId: string; video: { type: "url"; value: string } }
  | { status: "failed"; jobId: string; error: string };

/** Poll Azure for a single status check (no long sleep). */
export async function getVideoJobStatus(jobId: string): Promise<VideoJobStatus> {
  const { endpoint, apiKey } = azureConfig();
  const baseUrl = `${endpoint}/openai/v1`;
  const headers = videoHeaders(apiKey);

  const pollRes = await fetch(`${baseUrl}/videos/${jobId}`, { headers });
  if (!pollRes.ok) {
    throw new Error(`Status check failed: ${pollRes.status}`);
  }

  const status = (await pollRes.json()) as Record<string, unknown>;
  const raw = String(status.status ?? "processing");

  if (raw === "completed") {
    const generations = status.generations as
      | Array<Record<string, unknown>>
      | undefined;
    const directUrl =
      (generations?.[0]?.url as string | undefined) ??
      (status.url as string | undefined);

    if (directUrl) {
      return {
        status: "completed",
        jobId,
        video: { type: "url", value: directUrl },
      };
    }

    const downloadRes = await fetch(`${baseUrl}/videos/${jobId}/content`, {
      headers,
    });
    if (!downloadRes.ok) {
      throw new Error(`Download failed: ${downloadRes.status}`);
    }

    const buffer = await downloadRes.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    return {
      status: "completed",
      jobId,
      video: { type: "url", value: `data:video/mp4;base64,${base64}` },
    };
  }

  if (raw === "failed") {
    const error = status.error as Record<string, unknown> | undefined;
    return {
      status: "failed",
      jobId,
      error: String(error?.message ?? "unknown error"),
    };
  }

  const normalized =
    raw === "queued" || raw === "in_progress" ? raw : "processing";
  return { status: normalized, jobId };
}
