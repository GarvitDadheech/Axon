import { type NextRequest } from "next/server";
import { getAuthUser, serverError } from "@/lib/auth";
import { findUserById } from "@/lib/queries/users";
import { getOrCreateAgentWallet } from "@/lib/openfort";
import { getSpentToday } from "@/lib/queries/api-calls";
import { openfortConfigured } from "@/lib/env";

/** Provision (or return) the user's Openfort agent wallet + spending policy. */
export async function GET(request: NextRequest) {
  const auth = await getAuthUser(request);
  if (auth instanceof Response) return auth;

  try {
    if (!openfortConfigured()) {
      return Response.json(
        {
          error: "Openfort is not configured",
          hint: "Set OPENFORT_SECRET_KEY (and ideally OPENFORT_WALLET_SECRET + OPENFORT_POLICY_ID) in your env.",
        },
        { status: 503 }
      );
    }

    const wallet = await getOrCreateAgentWallet(auth.dbUser);
    const user = (await findUserById(auth.dbUserId))!;
    const spentToday = await getSpentToday(auth.dbUserId);

    return Response.json({
      agent: {
        openfortWalletId: wallet.id,
        address: wallet.address,
        chain: "arbitrum-sepolia",
        chainId: 421614,
      },
      policy: {
        enabled: user.server_signing_enabled,
        maxPerCall: user.max_per_call,
        maxPerDay: user.max_per_day,
        spentToday: spentToday.toFixed(4),
      },
      magicWallet: auth.wallet, // Particle Auth EOA
    });
  } catch (err) {
    return serverError(err);
  }
}
