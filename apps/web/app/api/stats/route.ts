import { type NextRequest } from "next/server";
import { getAuthUser, serverError } from "@/lib/auth";
import { getUserStats, getIncomingStats, listCallsForUser } from "@/lib/queries/api-calls";
import { listUserApis } from "@/lib/queries/apis";

export async function GET(request: NextRequest) {
  const auth = await getAuthUser(request);
  if (auth instanceof Response) return auth;

  try {
    const [stats, incomingStats, recentCalls, publishedApis] = await Promise.all([
      getUserStats(auth.dbUserId),
      getIncomingStats(auth.dbUserId),
      listCallsForUser(auth.dbUserId, 20),
      listUserApis(auth.dbUserId),
    ]);

    return Response.json({ stats, incomingStats, recentCalls, publishedApis }, { status: 200 });
  } catch (err) {
    return serverError(err);
  }
}
