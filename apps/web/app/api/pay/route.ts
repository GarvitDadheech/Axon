import { NextResponse, type NextRequest } from "next/server";
import { serverWalletPayer } from "@x402/client/server";
import { getOptionalAuthUser } from "@/lib/auth";
import { openfortPayer } from "@/lib/openfort";
import { arbitrumRpcUrl } from "@/lib/arbitrum";
import { env } from "@/lib/env";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const quote = body.quote;

    if (!quote) {
      return NextResponse.json({ error: "Missing quote in request body" }, { status: 400 });
    }

    if (!quote.reference || !quote.tokenAddress || !quote.receiver) {
      return NextResponse.json({ error: "Invalid quote: missing required fields" }, { status: 400 });
    }

    const auth = await getOptionalAuthUser(req);

    if (auth) {
      const txSig = await openfortPayer(auth.dbUser)(quote);
      return NextResponse.json({ txSig });
    }

    const privateKey = env().PAYER_PRIVATE_KEY;
    if (!privateKey) {
      return NextResponse.json({ error: "PAYER_PRIVATE_KEY not configured" }, { status: 500 });
    }

    const pay = serverWalletPayer({ privateKey, rpcUrl: arbitrumRpcUrl() });
    const txSig = await pay(quote);
    return NextResponse.json({ txSig });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[/api/pay]", msg);
    return NextResponse.json({ error: msg, code: "PAYMENT_ERROR" }, { status: 500 });
  }
}
