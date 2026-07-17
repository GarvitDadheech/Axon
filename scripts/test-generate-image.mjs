/**
 * Standalone Azure image smoke test (no x402).
 *
 *   node scripts/test-generate-image.mjs
 *   node scripts/test-generate-image.mjs "a red cube on a table"
 *
 * Reads AZURE_* from repo root .env via dotenv if present, else process.env.
 * Writes scripts/out/test-image.png
 */

import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function loadDotEnv(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

loadDotEnv(join(root, ".env"));
loadDotEnv(join(root, ".env.local"));

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
const apiVersion = process.env.AZURE_IMAGE_API_VERSION || "2024-02-01";
const prompt = process.argv.slice(2).join(" ") || "a simple red apple on a white table";

if (!endpoint || !apiKey) {
  console.error("Missing AZURE_SORA_ENDPOINT/AZURE_API_KEY (or AZURE_OPENAI_*)");
  process.exit(1);
}

const url = `${endpoint}/openai/deployments/${deployment}/images/generations?api-version=${apiVersion}`;
console.log("POST", url);
console.log("prompt:", prompt);

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

const text = await res.text();
if (!res.ok) {
  console.error("FAILED", res.status);
  console.error(text.slice(0, 2000));
  process.exit(1);
}

const data = JSON.parse(text);
const b64 = data?.data?.[0]?.b64_json;
if (!b64) {
  console.error("No b64_json in response:");
  console.error(JSON.stringify(data, null, 2).slice(0, 2000));
  process.exit(1);
}

const outDir = join(__dirname, "out");
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, "test-image.png");
writeFileSync(outPath, Buffer.from(b64, "base64"));
console.log("OK →", outPath);
console.log("bytes", Buffer.from(b64, "base64").byteLength);
