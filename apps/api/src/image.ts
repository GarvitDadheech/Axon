function azureConfig() {
  const endpoint = (
    process.env.AZURE_SORA_ENDPOINT ||
    process.env.AZURE_OPENAI_ENDPOINT ||
    ""
  ).replace(/\/$/, "");
  const apiKey =
    process.env.AZURE_API_KEY || process.env.AZURE_OPENAI_API_KEY || "";
  const deployment =
    process.env.AZURE_IMAGE_DEPLOYMENT ||
    process.env.AZURE_OPENAI_IMAGE_DEPLOYMENT ||
    "gpt-image-2";
  const apiVersion =
    process.env.AZURE_IMAGE_API_VERSION || "2024-02-01";

  if (!endpoint || !apiKey) {
    throw new Error(
      "Missing Azure image credentials. Set AZURE_SORA_ENDPOINT + AZURE_API_KEY (or AZURE_OPENAI_ENDPOINT + AZURE_OPENAI_API_KEY)."
    );
  }

  return { endpoint, apiKey, deployment, apiVersion };
}

export async function generateImage(prompt: string): Promise<string> {
  const { endpoint, apiKey, deployment, apiVersion } = azureConfig();
  const url = `${endpoint}/openai/deployments/${deployment}/images/generations?api-version=${apiVersion}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "api-key": apiKey,
    },
    body: JSON.stringify({
      prompt,
      size: "1024x1024",
      quality: "low",
      output_format: "png",
      output_compression: 100,
      n: 1,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Image generation failed: ${res.status} - ${err}`);
  }

  const data = (await res.json()) as Record<string, unknown>;
  const b64 = (data?.data as Array<Record<string, unknown>>)?.[0]
    ?.b64_json as string | undefined;

  if (!b64) {
    throw new Error("No image data returned from API");
  }

  return `data:image/png;base64,${b64}`;
}
