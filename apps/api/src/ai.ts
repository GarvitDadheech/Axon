import { z } from "zod";

const AzureEnvSchema = z.object({
  AZURE_OPENAI_ENDPOINT: z.string().url(),
  AZURE_OPENAI_API_KEY: z.string().min(1),
  AZURE_OPENAI_DEPLOYMENT: z.string().min(1).optional(),
  AZURE_OPENAI_DEPLOYMENT_NAME: z.string().min(1).optional(),
  AZURE_OPENAI_API_VERSION: z.string().optional().default("2024-02-15-preview")
}).refine(
  (data) => data.AZURE_OPENAI_DEPLOYMENT || data.AZURE_OPENAI_DEPLOYMENT_NAME,
  { message: "Either AZURE_OPENAI_DEPLOYMENT or AZURE_OPENAI_DEPLOYMENT_NAME is required" }
);

type AzureEnv = z.infer<typeof AzureEnvSchema>;

function getAzureEnv(env: NodeJS.ProcessEnv = process.env): AzureEnv {
  const parsed = AzureEnvSchema.safeParse(env);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid Azure OpenAI environment:\n${msg}`);
  }
  return parsed.data;
}

export async function generateText(prompt: string): Promise<string> {
  const env = getAzureEnv();

  const deployment = env.AZURE_OPENAI_DEPLOYMENT || env.AZURE_OPENAI_DEPLOYMENT_NAME;
  const url = `${env.AZURE_OPENAI_ENDPOINT}/openai/deployments/${deployment}/chat/completions?api-version=${env.AZURE_OPENAI_API_VERSION}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": env.AZURE_OPENAI_API_KEY
    },
    body: JSON.stringify({
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 500
    })
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Azure OpenAI request failed (${response.status}): ${text.substring(0, 200)}`);
  }

  const data = await response.json();
  const message = data?.choices?.[0]?.message?.content;
  
  if (typeof message !== "string") {
    throw new Error("Invalid response from Azure OpenAI: missing content");
  }

  return message;
}
