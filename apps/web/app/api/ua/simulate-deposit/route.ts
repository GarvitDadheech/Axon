import { type NextRequest } from "next/server";
import { getAuthUser, serverError } from "@/lib/auth";

/**
 * Demo-only endpoint for the "at least one cross-chain value move" deliverable:
 * simulates a deposit from another chain landing in the user's Universal
 * Account balance, without requiring a real funded UA/testnet bridge for
 * the hackathon demo. See docs/axon-hackathon-integration.md for how this
 * maps to a real Particle UA `createTransferTransaction` flow.
 */

const DEMO_SOURCE_CHAINS = ["Base", "Ethereum", "Solana"] as const;

export async function POST(request: NextRequest) {
  const auth = await getAuthUser(request);
  if (auth instanceof Response) return auth;

  try {
    const body = await request.json().catch(() => ({}));
    const amountUsd = Number(body.amountUsd ?? 25);
    const fromChain =
      DEMO_SOURCE_CHAINS[Math.abs(auth.dbUserId + amountUsd) % DEMO_SOURCE_CHAINS.length];

    if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
      return Response.json({ error: "amountUsd must be a positive number" }, { status: 400 });
    }

    const sourceTxHash = `0x${Buffer.from(`ua-deposit:${auth.dbUserId}:${Date.now()}`)
      .toString("hex")
      .padEnd(64, "0")
      .slice(0, 64)}`;

    return Response.json({
      amountUsd,
      fromChain,
      toChain: "Arbitrum",
      sourceTxHash,
      settledAt: new Date().toISOString(),
    });
  } catch (err) {
    return serverError(err);
  }
}
