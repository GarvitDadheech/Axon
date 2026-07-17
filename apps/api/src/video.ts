function azureConfig() {
  const endpoint = (
    process.env.AZURE_SORA_ENDPOINT ||
    process.env.AZURE_OPENAI_ENDPOINT ||
    ""
  ).replace(/\/$/, "");
  const apiKey =
    process.env.AZURE_API_KEY || process.env.AZURE_OPENAI_API_KEY || "";
  const model = process.env.AZURE_VIDEO_MODEL || "sora-2";

  if (!endpoint || !apiKey) {
    throw new Error(
      "Missing Azure video credentials. Set AZURE_SORA_ENDPOINT + AZURE_API_KEY (or AZURE_OPENAI_ENDPOINT + AZURE_OPENAI_API_KEY)."
    );
  }

  return { endpoint, apiKey, model };
}

export async function generateVideo(
  prompt: string
): Promise<{ type: "url"; value: string }> {
  const { endpoint, apiKey, model } = azureConfig();
  const baseUrl = `${endpoint}/openai/v1`;
  const headers = {
    "Api-key": apiKey,
    "api-key": apiKey,
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  try {
    console.log("Creating video generation job with prompt:", prompt);

    const createRes = await fetch(`${baseUrl}/videos`, {
      method: "POST",
      headers,
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

    console.log(`Video job created: ${videoId}`);

    const maxPolls = 60;
    let pollCount = 0;

    while (pollCount < maxPolls) {
      await new Promise((r) => setTimeout(r, 10_000));
      pollCount++;

      let status: Record<string, unknown>;
      try {
        const pollRes = await fetch(`${baseUrl}/videos/${videoId}`, { headers });
        if (!pollRes.ok) {
          console.warn(`Poll ${pollCount} returned ${pollRes.status}, retrying...`);
          continue;
        }
        status = (await pollRes.json()) as Record<string, unknown>;
      } catch (e) {
        console.warn(
          `Poll ${pollCount} fetch failed (${e instanceof Error ? e.message : e}), retrying...`
        );
        continue;
      }

      console.log(`Video status (poll ${pollCount}): ${status.status}`);

      if (status.status === "completed") {
        const generations = status.generations as
          | Array<Record<string, unknown>>
          | undefined;
        const directUrl =
          (generations?.[0]?.url as string | undefined) ??
          (status.url as string | undefined);

        if (directUrl) {
          return { type: "url", value: directUrl };
        }

        const downloadRes = await fetch(`${baseUrl}/videos/${videoId}/content`, {
          headers,
        });
        if (!downloadRes.ok) {
          throw new Error(`Download failed: ${downloadRes.status}`);
        }

        const buffer = await downloadRes.arrayBuffer();
        const base64 = Buffer.from(buffer).toString("base64");
        return { type: "url", value: `data:video/mp4;base64,${base64}` };
      }

      if (status.status === "failed") {
        const error = status.error as Record<string, unknown> | undefined;
        throw new Error(
          `Video generation failed: ${error?.message ?? "unknown error"}`
        );
      }
    }

    throw new Error("Video generation timed out after 10 minutes");
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Video generation error:", msg);
    throw new Error(`Video generation failed: ${msg}`);
  }
}
