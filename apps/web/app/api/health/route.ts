import { NextResponse } from "next/server";

/** Lightweight health for the consolidated Next app (replaces apps/api /health). */
export async function GET() {
  return NextResponse.json({ ok: true });
}
