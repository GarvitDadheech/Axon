import type { NextRequest } from "next/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { createUsdcClient } from "@x402/client";
import { listPublicApis, findApiById } from "@/lib/queries/apis";
import { insertApiCall } from "@/lib/queries/api-calls";
import { getAuthUser, type AuthUserWithDb } from "@/lib/auth";
import { getOrCreateAgentWallet, openfortPayer } from "@/lib/openfort";

// Allow up to 60 seconds — blockchain tx confirmation takes time
export const maxDuration = 60;

function buildServer(auth: AuthUserWithDb): McpServer {
  const server = new McpServer({ name: "axon-marketplace", version: "0.1.0" });

  server.tool(
    "x402_list_apis",
    "List all pay-per-use APIs on the Axon marketplace. Returns each API's id, name, description, endpoint_url, price_per_call (USDC), chain, and JSON schema for request/response bodies. Always call this first to discover available APIs before calling x402_call_api.",
    {},
    async () => {
      const apis = await listPublicApis();
      const listing = apis.map(({ id, name, description, endpoint_url, price_per_call, chain, sample_request, sample_response }) => ({
        id,
        name,
        description,
        endpoint_url,
        price_per_call,
        chain,
        sample_request,
        sample_response,
      }));
      return {
        content: [{ type: "text" as const, text: JSON.stringify(listing, null, 2) }],
      };
    }
  );

  server.tool(
    "x402_call_api",
    "Call a pay-per-use API by its marketplace ID. Automatically handles the HTTP 402 payment flow: pays USDC from YOUR Openfort agent wallet on Arbitrum and retries with proof. Every successful response includes x402Tnx: { tnxHash, amount, token } — always show the user: '💳 Paid [amount] [token] — tx: [tnxHash]'.",
    {
      apiId: z.number().describe("The numeric API id from x402_list_apis"),
      body: z.string().describe("Request body as a JSON string, matching the API's sample_request schema"),
    },
    async ({ apiId, body }) => {
      const api = await findApiById(apiId);
      if (!api) throw new Error(`No API with id ${apiId} found in the marketplace.`);

      // Always the caller's Openfort agent wallet — never a shared admin key.
      const payer = openfortPayer(auth.dbUser);
      const client = createUsdcClient({ payer });

      let status: "success" | "failed" = "success";
      let txHash: string | undefined;
      let result: unknown;

      try {
        const res = await client.fetch(api.endpoint_url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body,
        });

        if (!res.ok) {
          status = "failed";
          const text = await res.text();
          throw new Error(`API call failed (${res.status}): ${text}`);
        }

        result = await res.json();
        txHash = (result as { x402Tnx?: { tnxHash?: string } })?.x402Tnx?.tnxHash;
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        status = "failed";
        throw err;
      } finally {
        await insertApiCall({
          userId: auth.dbUserId,
          apiId: api.id,
          txHash,
          amountSpent: status === "success" ? api.price_per_call : "0",
          platformFee: "0",
          status,
          requestPayload: (() => {
            try {
              return JSON.parse(body);
            } catch {
              return undefined;
            }
          })(),
        }).catch((e) => console.error("[axon] failed to record MCP api_call:", e));
      }
    }
  );

  return server;
}

/**
 * MCP requires Particle Auth. Put `uuid:token` from /mcp/login into the MCP host
 * config as: Authorization: Bearer <uuid>:<token>
 */
async function handler(req: NextRequest): Promise<Response> {
  const auth = await getAuthUser(req);
  if (auth instanceof Response) {
    return Response.json(
      {
        error: "Unauthorized",
        hint: "Visit /mcp/login, copy your Particle Bearer token (uuid:token), and set headers.Authorization in your MCP host config.",
      },
      { status: 401 }
    );
  }

  // Ensure the agent wallet exists before any tool call.
  try {
    await getOrCreateAgentWallet(auth.dbUser);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return Response.json({ error: message }, { status: 503 });
  }

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  const server = buildServer(auth);
  await server.connect(transport);
  return transport.handleRequest(req);
}

export { handler as GET, handler as POST, handler as DELETE };
