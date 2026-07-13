import { NextResponse, type NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { openfortPayer } from "@/lib/openfort";

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (auth instanceof Response) return auth;

    const body = await req.json();
    const quote = body.quote;

    if (!quote) {
      return NextResponse.json({ error: "Missing quote in request body" }, { status: 400 });
    }

    if (!quote.reference || !quote.tokenAddress || !quote.receiver) {
      return NextResponse.json({ error: "Invalid quote: missing required fields" }, { status: 400 });
    }

    const txSig = await openfortPayer(auth.dbUser)(quote);
    return NextResponse.json({ txSig });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[/api/pay]", msg);
    return NextResponse.json({ error: msg, code: "PAYMENT_ERROR" }, { status: 500 });
  }
}
