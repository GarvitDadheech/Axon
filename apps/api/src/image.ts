export async function generateImage(prompt: string): Promise<string> {
  const endpoint = process.env.AZURE_SORA_ENDPOINT;
  const apiKey = process.env.AZURE_API_KEY;

  if (!endpoint || !apiKey) {
    throw new Error("AZURE_SORA_ENDPOINT or AZURE_API_KEY not configured");
  }

  const url = `${endpoint}/openai/deployments/gpt-image-2/images/generations?api-version=2024-02-01`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      prompt,
      size: "1024x1024",
      quality: "low",
      output_format: "png",
      output_compression: 100,
      n: 1
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Image generation failed: ${res.status} - ${err}`);
  }

  const data = await res.json() as Record<string, unknown>;
  const b64 = (data?.data as Array<Record<string, unknown>>)?.[0]?.b64_json as string | undefined;

  if (!b64) {
    throw new Error("No image data returned from API");
  }

  return `data:image/png;base64,${b64}`;
}
