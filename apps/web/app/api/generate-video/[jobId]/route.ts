import { getVideoJobStatus } from "@/lib/azure-video";

export const maxDuration = 60;

/** Free status poll for an async video job (payment already collected on POST). */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await ctx.params;
  if (!jobId || !/^[a-zA-Z0-9_-]+$/.test(jobId)) {
    return Response.json({ error: "Invalid jobId" }, { status: 400 });
  }

  try {
    const status = await getVideoJobStatus(jobId);
    return Response.json(status);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Video status error:", msg);
    return Response.json({ error: "Status check failed" }, { status: 502 });
  }
}
