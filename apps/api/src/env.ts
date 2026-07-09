import { z } from "zod";

const EnvSchema = z.object({
  PORT: z.string().optional().default("4000"),
  ARBITRUM_RPC_URL: z.string().min(1),
  RECEIVER_ADDRESS: z.string().min(1),
  TOKEN_ADDRESS: z.string().optional(),
  AZURE_OPENAI_ENDPOINT: z.string().optional(),
  AZURE_OPENAI_API_KEY: z.string().optional(),
  AZURE_OPENAI_DEPLOYMENT: z.string().optional(),
  AZURE_OPENAI_DEPLOYMENT_NAME: z.string().optional(),
  AZURE_OPENAI_API_VERSION: z.string().optional()
});

export type Env = z.infer<typeof EnvSchema>;

export function getEnv(env: NodeJS.ProcessEnv = process.env): Env {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment:\n${msg}`);
  }
  return parsed.data;
}

