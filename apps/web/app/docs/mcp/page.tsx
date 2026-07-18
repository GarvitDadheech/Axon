import type { Metadata } from "next";
import {
  DocsPage,
  DocsH2,
  DocsCodeBlock,
  DocsTable,
} from "@/components/docs/docs-shell";

export const metadata: Metadata = {
  title: "MCP Integration — Axon Docs",
  description:
    "Connect Axon to any MCP-compatible host and give agents access to paid APIs, settled in USDC on Arbitrum.",
};

const CONFIG_SNIPPET = `{
  "mcpServers": {
    "axon": {
      "url": "https://your-app.vercel.app/api/mcp",
      "headers": {
        "Authorization": "Bearer <particle-uuid:token-from-/mcp/login>"
      }
    }
  }
}`;

const CONFIG_SNIPPET_AUTHED = CONFIG_SNIPPET;

const RUN_SNIPPET = `# Restart your MCP host, then prompt your agent:

"What APIs are available on Axon?"

# The agent calls x402_list_apis and returns marketplace listings with USDC prices.`;

const MIDDLEWARE_SNIPPET = `import express from "express";
import { usdcPaywall } from "@x402/payment-middleware";

const app = express();
app.use(express.json());

// Wrap any route — agents pay 0.01 USDC per call, settled directly to you
app.use(
  usdcPaywall(
    { "/api/my-endpoint": 0.01 },
    process.env.RECEIVER_ADDRESS,   // your wallet address
    process.env.ARBITRUM_RPC_URL
  )
);

app.post("/api/my-endpoint", (req, res) => {
  res.json({ result: "your response" });
  // x402Tnx: { tnxHash, amount, token } is auto-appended to every paid response
});`;

const FLOW_SNIPPET = `1. Agent calls x402_call_api("your endpoint", body)

2. MCP client → POST /api/endpoint (no payment headers)
   ← HTTP 402  www-authenticate: x402 token=..., price="0.01"
               body: { reference, receiver, price, expiresAt, ... }

3. Axon pays the quote in USDC on Arbitrum from **your Openfort agent wallet**
   (Particle Bearer token required — no shared admin payer):
   data: transfer(receiver, amount) + "x402:<reference>" appended to calldata


4. Axon retries:
   POST /api/endpoint
   x-payment-tx: 0xabc...          ← on-chain tx hash
   x-payment-reference: <uuid>     ← ties tx to this quote

5. Middleware verifies on-chain:
   ✓ ERC-20 Transfer log exists, to=receiver, amount ≥ price
   ✓ "x402:<reference>" found in tx calldata
   ✓ Quote not expired, no replay

6. Handler runs → response + { x402Tnx: { tnxHash, amount, token } }`;

const QUICK_STEPS = [
  {
    step: "01",
    title: "Get the URL",
    body: "The MCP server is built into the Axon web app — no separate install.",
    code: "https://your-app.vercel.app/api/mcp",
  },
  {
    step: "02",
    title: "Configure",
    body: "Add a single url field to your MCP host config. Add a Bearer token to attribute spend to your own agent wallet.",
    code: "~/.claude/claude_desktop_config.json",
  },
  {
    step: "03",
    title: "Run",
    body: "Restart the host. Agents discover and pay for APIs automatically.",
    code: "x402_list_apis → x402_call_api",
  },
] as const;

export default function McpDocsPage() {
  return (
    <DocsPage>
      {/* Page header */}
      <header className="mb-12">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-400/60 mb-3">
          Integration
        </p>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-[#f0eeea]">
          MCP Integration
        </h1>
        <p className="mt-3 text-[15px] text-white/45 leading-relaxed max-w-[52ch]">
          Connect Axon to any MCP-compatible host and give agents access to
          pay-per-use APIs settled in USDC on Arbitrum via the x402 protocol.
        </p>
      </header>

      {/* Quick start */}
      <section className="mb-14 space-y-6">
        <DocsH2 id="quick-start">Quick start</DocsH2>
        <div className="grid gap-3 sm:grid-cols-3">
          {QUICK_STEPS.map((s) => (
            <div
              key={s.step}
              className="border border-white/[0.07] bg-white/[0.015] p-4"
            >
              <p className="font-mono text-[10px] text-white/25">{s.step}</p>
              <p className="mt-2 font-display text-[15px] font-semibold text-[#e8e6e0]">
                {s.title}
              </p>
              <p className="mt-2 text-[13px] text-white/38 leading-relaxed">
                {s.body}
              </p>
              <p className="mt-3 font-mono text-[11px] text-emerald-400/60 break-all">
                {s.code}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Configuration */}
      <section className="mb-14 space-y-5">
        <DocsH2 id="configuration">Configuration</DocsH2>
        <p className="text-[14px] text-white/40 leading-relaxed">
          The MCP server is deployed alongside the Axon web app at{" "}
          <code className="font-mono text-[12px] text-emerald-400/70">
            /api/mcp
          </code>
          . Point your MCP host at the deployed URL — no local process, no
          private key on the client side.
        </p>
        <DocsCodeBlock
          code={CONFIG_SNIPPET}
          title="claude_desktop_config.json — anonymous (shared wallet)"
          lang="json"
        />
        <p className="text-[13px] text-white/35 border-l border-white/[0.08] pl-4">
          <span className="text-white/50">Per-user spend:</span> sign in at{" "}
          <code className="font-mono text-[12px] text-emerald-400/70">/mcp/login</code>{" "}
          to get a Particle Auth token (`uuid:token`). Pass it as a Bearer token so calls are
          paid from your own Openfort agent wallet and respect your spending
          policy, instead of the shared platform wallet.
        </p>
        <DocsCodeBlock
          code={CONFIG_SNIPPET_AUTHED}
          title="claude_desktop_config.json — authenticated (your agent wallet)"
          lang="json"
        />
      </section>

      {/* Run */}
      <section className="mb-14 space-y-5">
        <DocsH2 id="run">Run</DocsH2>
        <DocsCodeBlock code={RUN_SNIPPET} title="Agent prompt" lang="shell" />
      </section>

      {/* How the middleware works */}
      <section className="mb-14 space-y-5">
        <DocsH2 id="middleware">How the middleware works</DocsH2>
        <p className="text-[14px] text-white/40 leading-relaxed max-w-[56ch]">
          Axon uses the{" "}
          <span className="text-white/60">x402 payment protocol</span> — an
          extension of HTTP 402 Payment Required. The SDK middleware
          (<code className="font-mono text-[12px] text-emerald-400/70">
            usdcPaywall
          </code>
          ) wraps any Express route. On the first unauthenticated request it
          issues a payment quote; Axon pays on-chain and retries with proof.
          The middleware verifies the Arbitrum transaction before forwarding
          to your handler.
        </p>
        <DocsCodeBlock
          code={FLOW_SNIPPET}
          title="x402 payment flow"
          lang="shell"
        />
        <p className="text-[13px] text-white/35 border-l border-white/[0.08] pl-4">
          <span className="text-white/50">Reference binding:</span> the quote
          UUID is appended to the ERC-20 transfer calldata as{" "}
          <code className="font-mono text-[12px] text-emerald-400/60">
            x402:&lt;reference&gt;
          </code>
          . ERC-20 contracts ignore trailing bytes, but the verifier reads
          them back to tie the payment to exactly this quote — preventing
          payment reuse across requests.
        </p>
      </section>

      {/* Add a paywall to your API */}
      <section className="mb-14 space-y-5">
        <DocsH2 id="publish">Add a paywall to your API</DocsH2>
        <p className="text-[14px] text-white/40 leading-relaxed max-w-[56ch]">
          Install the SDK and wrap your Express route. USDC is transferred
          directly to your wallet on every successful call — no custodian.
        </p>
        <DocsCodeBlock
          code={`npm install @x402/payment-middleware`}
          title="Install"
          lang="shell"
        />
        <DocsCodeBlock
          code={MIDDLEWARE_SNIPPET}
          title="server.ts"
          lang="typescript"
        />
      </section>

      {/* Reference */}
      <section className="space-y-8">
        <DocsH2 id="reference">Reference</DocsH2>

        <div className="space-y-3">
          <h3 className="font-mono text-[11px] uppercase tracking-wider text-white/30">
            Deployment env vars (set in Vercel / your host)
          </h3>
          <DocsTable
            headers={["Variable", "Required", "Description"]}
            rows={[
              [
                "PAYER_PRIVATE_KEY",
                "yes",
                "Private key of the shared platform wallet. Must hold USDC on Arbitrum to pay for unauthenticated /api/mcp calls.",
              ],
              [
                "ARBITRUM_RPC_URL",
                "yes",
                "Arbitrum RPC endpoint. E.g. https://sepolia-rollup.arbitrum.io/rpc",
              ],
              [
                "OPENFORT_SECRET_KEY",
                "no",
                "Enables per-user Openfort agent wallets for authenticated calls. Without it, authenticated calls simulate a payment instead.",
              ],
            ]}
          />
        </div>

        <div className="space-y-3">
          <h3 className="font-mono text-[11px] uppercase tracking-wider text-white/30">
            MCP tools
          </h3>
          <DocsTable
            headers={["Tool", "Description"]}
            rows={[
              [
                "x402_list_apis",
                "Returns all marketplace APIs with name, endpoint, and USDC price. Call this first.",
              ],
              [
                "x402_call_api",
                "Calls a paid API endpoint. Handles the 402 → pay → retry cycle automatically. Every response includes x402Tnx with the on-chain tx hash.",
              ],
            ]}
          />
        </div>

        <div className="space-y-3">
          <h3 className="font-mono text-[11px] uppercase tracking-wider text-white/30">
            SDK middleware options
          </h3>
          <DocsTable
            headers={["Option", "Type", "Description"]}
            rows={[
              ["routes", "Record<path, price>", "Route → USDC price map. Price can be a number or a PriceConfig object."],
              ["receiverAddress", "string", "Your wallet address. USDC lands here directly on each verified call."],
              ["rpcUrl", "string", "Arbitrum RPC URL for on-chain verification."],
              ["quoteTtlSeconds", "number?", "How long a payment quote stays valid. Defaults to 5 minutes."],
              ["onPaid", "function?", "Callback fired after each verified payment with endpoint, price, txSig, and timestamp."],
            ]}
          />
        </div>

        <div className="space-y-3">
          <h3 className="font-mono text-[11px] uppercase tracking-wider text-white/30">
            Response shape
          </h3>
          <p className="text-[14px] text-white/40 leading-relaxed">
            Every paid response has{" "}
            <code className="font-mono text-[12px] text-emerald-400/70">
              x402Tnx
            </code>{" "}
            merged in automatically by the middleware.
          </p>
          <DocsCodeBlock
            lang="json"
            title="Response body (paid)"
            code={`{
  ...yourHandlerResponse,
  "x402Tnx": {
    "tnxHash": "0xabc...",
    "amount": 0.01,
    "token": "USDC"
  }
}`}
          />
        </div>

        <div className="space-y-3">
          <h3 className="font-mono text-[11px] uppercase tracking-wider text-white/30">
            402 quote shape
          </h3>
          <p className="text-[14px] text-white/40 leading-relaxed">
            Returned when a request arrives without payment headers.
          </p>
          <DocsCodeBlock
            lang="json"
            title="HTTP 402 body"
            code={`{
  "reference": "<uuid>",
  "endpoint": "/api/my-endpoint",
  "method": "POST",
  "price": "0.01",
  "token": "USDC",
  "tokenAddress": "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
  "receiver": "0x...",
  "expiresAt": "2025-01-01T00:05:00.000Z"
}`}
          />
        </div>
      </section>

      <footer className="mt-14 border-t border-white/[0.06] pt-8">
        <p className="text-[13px] text-white/30">
          Questions?{" "}
          <a
            href="https://github.com/GarvitDadheech/Axon"
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-400/70 hover:text-emerald-400 transition-colors"
          >
            GitHub
          </a>
        </p>
      </footer>
    </DocsPage>
  );
}
