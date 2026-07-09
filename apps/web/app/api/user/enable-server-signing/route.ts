import { type NextRequest } from "next/server";
import { getAuthUser, serverError } from "@/lib/auth";
import { enableServerSigning } from "@/lib/queries/users";

interface EnableSigningBody {
  maxPerCall?: string;
  maxPerDay?: string;
}

export async function POST(request: NextRequest) {
  const auth = await getAuthUser(request);
  if (auth instanceof Response) return auth;

  let body: EnableSigningBody = {};
  try {
    body = await request.json();
  } catch {
    // body is optional
  }

  try {
    const user = await enableServerSigning(
      auth.dbUserId,
      true,
      body.maxPerCall,
      body.maxPerDay
    );
    return Response.json({ user }, { status: 200 });
  } catch (err) {
    return serverError(err);
  }
}
