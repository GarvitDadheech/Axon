/**
 * Auth helpers for Next.js Route Handlers (Particle Auth).
 *
 * Bearer format: `<particleUuid>:<particleToken>` from Particle userInfo.
 * requireParticle / getAuthUser verify via Particle getUserInfo RPC.
 */

import type { NextRequest } from "next/server";
import { verifyParticleToken } from "@/lib/particle-auth-server";
import { upsertUser, type DBUser } from "@/lib/queries/users";

export interface AuthedUser {
  particleUserId: string;
  wallet: `0x${string}`;
  email: string | null;
}

export interface AuthUserWithDb extends AuthedUser {
  dbUserId: number;
  dbUser: DBUser;
}

function extractToken(req: NextRequest | Request): string | null {
  const header =
    req.headers.get("authorization") ?? req.headers.get("Authorization");
  return header?.startsWith("Bearer ") ? header.slice(7) : header ?? null;
}

export async function requireParticle(
  req: NextRequest | Request
): Promise<AuthedUser | Response> {
  const token = extractToken(req);
  if (!token) {
    return Response.json({ error: "Missing Bearer token" }, { status: 401 });
  }

  try {
    const verified = await verifyParticleToken(token);

    if (!verified.walletAddress) {
      return Response.json(
        { error: "No EVM wallet on this Particle account" },
        { status: 401 }
      );
    }

    return {
      particleUserId: verified.particleUserId,
      wallet: verified.walletAddress,
      email: verified.email,
    };
  } catch (e) {
    return Response.json(
      { error: "Invalid token", details: (e as Error).message },
      { status: 401 }
    );
  }
}

/** @deprecated use requireParticle */
export const requireMagic = requireParticle;

export async function getAuthUser(
  req: NextRequest | Request
): Promise<AuthUserWithDb | Response> {
  const authed = await requireParticle(req);
  if (authed instanceof Response) return authed;

  const dbUser = await upsertUser(authed.particleUserId, authed.wallet, authed.email);
  return { ...authed, dbUserId: dbUser.id, dbUser };
}

export async function getOptionalAuthUser(
  req: NextRequest | Request
): Promise<AuthUserWithDb | null> {
  if (!extractToken(req)) return null;
  const result = await getAuthUser(req);
  return result instanceof Response ? null : result;
}

export function unauthorized(): Response {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

export function serverError(err: unknown, status = 500): Response {
  const message = err instanceof Error ? err.message : "Internal server error";
  console.error("[axon] route error:", err);
  return Response.json({ error: message }, { status });
}
