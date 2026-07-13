import { type NextRequest } from "next/server";
import { getAuthUser, serverError } from "@/lib/auth";
import { getOrCreateAgentWallet } from "@/lib/openfort";
import { openfortConfigured } from "@/lib/env";

export async function POST(request: NextRequest) {
  const auth = await getAuthUser(request);
  if (auth instanceof Response) return auth;

  try {
    let agent: { id: string; address: string } | null = null;
    if (openfortConfigured()) {
      const wallet = await getOrCreateAgentWallet(auth.dbUser);
      agent = { id: wallet.id, address: wallet.address };
    }

    return Response.json(
      {
        user: {
          id: auth.dbUserId,
          server_signing_enabled: auth.dbUser.server_signing_enabled,
          max_per_call: auth.dbUser.max_per_call,
          max_per_day: auth.dbUser.max_per_day,
        },
        agent,
      },
      { status: 200 }
    );
  } catch (err) {
    return serverError(err);
  }
}
