import { type NextRequest } from "next/server";
import { getAuthUser, serverError } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const auth = await getAuthUser(request);
  if (auth instanceof Response) return auth;

  try {
    // getAuthUser already upserted the user with server_signing_enabled = TRUE.
    // Return the db user id so the client knows init succeeded.
    return Response.json(
      { user: { id: auth.dbUserId, server_signing_enabled: true } },
      { status: 200 }
    );
  } catch (err) {
    return serverError(err);
  }
}
