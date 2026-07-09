/**
 * Auth helpers for Next.js Route Handlers.
 *
 * requireMagic       — verify the Bearer DID token, return the Magic user or a Response
 * getAuthUser        — requireMagic + DB lookup, for routes that need dbUserId
 * getOptionalAuthUser — like getAuthUser but returns null instead of 401 when no/invalid
 *                       token is present — used by /api/mcp so it keeps working for
 *                       unauthenticated MCP clients while attributing calls when possible
 * serverError        — standard JSON error envelope for caught errors
 *
 * Usage:
 *
 *   export async function POST(req: NextRequest) {
 *     const auth = await getAuthUser(req);
 *     if (auth instanceof Response) return auth;   // 401
 *     // auth.magicIssuer, auth.wallet, auth.dbUserId
 *   }
 */

import type { NextRequest } from "next/server";
import { verifyDidToken } from "@/lib/magic-admin";
import { upsertUser, type DBUser } from "@/lib/queries/users";

// ─── Types ────────────────────────────────────────────────────────────────

export interface AuthedUser {
  magicIssuer: string;
  wallet: `0x${string}`;
  email: string | null;
}

export interface AuthUserWithDb extends AuthedUser {
  dbUserId: number;
  dbUser: DBUser;
}

// ─── requireMagic ─────────────────────────────────────────────────────────

function extractToken(req: NextRequest | Request): string | null {
  const header =
    req.headers.get("authorization") ?? req.headers.get("Authorization");
  return header?.startsWith("Bearer ") ? header.slice(7) : header ?? null;
}

export async function requireMagic(
  req: NextRequest | Request
): Promise<AuthedUser | Response> {
  const token = extractToken(req);
  if (!token) {
    return Response.json({ error: "Missing Bearer token" }, { status: 401 });
  }

  try {
    const verified = await verifyDidToken(token);

    if (!verified.walletAddress) {
      return Response.json(
        { error: "No embedded wallet on this Magic account" },
        { status: 401 }
      );
    }

    return {
      magicIssuer: verified.issuer,
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

// ─── getAuthUser (requireMagic + DB lookup) ───────────────────────────────

export async function getAuthUser(
  req: NextRequest | Request
): Promise<AuthUserWithDb | Response> {
  const authed = await requireMagic(req);
  if (authed instanceof Response) return authed;

  // Auto-create (or update) the user on every request — no separate /init needed.
  const dbUser = await upsertUser(authed.magicIssuer, authed.wallet, authed.email);
  return { ...authed, dbUserId: dbUser.id, dbUser };
}

/** Same as getAuthUser, but returns null instead of a 401 Response when no
 *  valid token is present — for routes (like /api/mcp) that must keep
 *  working for unauthenticated callers. */
export async function getOptionalAuthUser(
  req: NextRequest | Request
): Promise<AuthUserWithDb | null> {
  if (!extractToken(req)) return null;
  const result = await getAuthUser(req);
  return result instanceof Response ? null : result;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

export function unauthorized(): Response {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

export function serverError(err: unknown, status = 500): Response {
  const message = err instanceof Error ? err.message : "Internal server error";
  console.error("[axon] route error:", err);
  return Response.json({ error: message }, { status });
}
