/**
 * Particle Auth server verification.
 *
 * Client sends Authorization: Bearer <uuid>:<token> (Particle Auth session).
 * Server calls Particle getUserInfo with project Basic auth to validate and
 * resolve the EVM wallet address.
 *
 * @see https://developers.particle.network/social-logins/api/server/getuserinfo
 */

import { env } from "@/lib/env";

export interface VerifiedParticleUser {
  particleUserId: string;
  walletAddress: `0x${string}` | null;
  email: string | null;
}

function basicAuthHeader(projectId: string, serverKey: string): string {
  const raw = Buffer.from(`${projectId}:${serverKey}`).toString("base64");
  return `Basic ${raw}`;
}

/** Parse `uuid:token` bearer payload from Particle Auth userInfo. */
export function parseParticleBearer(bearer: string): { uuid: string; token: string } | null {
  const trimmed = bearer.trim();
  const idx = trimmed.indexOf(":");
  if (idx <= 0 || idx === trimmed.length - 1) return null;
  return { uuid: trimmed.slice(0, idx), token: trimmed.slice(idx + 1) };
}

export async function verifyParticleToken(bearer: string): Promise<VerifiedParticleUser> {
  const parsed = parseParticleBearer(bearer);
  if (!parsed) {
    throw new Error("Invalid Particle auth token format (expected uuid:token)");
  }

  const e = env();
  const res = await fetch("https://api.particle.network/server/rpc", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: basicAuthHeader(e.PARTICLE_PROJECT_ID, e.PARTICLE_SERVER_KEY),
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getUserInfo",
      params: [parsed.uuid, parsed.token],
    }),
  });

  if (!res.ok) {
    throw new Error(`Particle getUserInfo HTTP ${res.status}`);
  }

  const body = (await res.json()) as {
    result?: {
      uuid?: string;
      email?: string | null;
      google_email?: string | null;
      wallets?: Array<{ chain?: string; chain_name?: string; publicAddress?: string; public_address?: string }>;
    };
    error?: { message?: string };
  };

  if (body.error || !body.result?.uuid) {
    throw new Error(body.error?.message ?? "Particle token verification failed");
  }

  const wallets = body.result.wallets ?? [];
  const evm = wallets.find(
    (w) => (w.chain ?? w.chain_name) === "evm_chain" || (w.publicAddress ?? w.public_address)?.startsWith("0x")
  );
  const address = (evm?.publicAddress ?? evm?.public_address ?? null) as `0x${string}` | null;

  return {
    particleUserId: body.result.uuid,
    walletAddress: address,
    email: body.result.email ?? body.result.google_email ?? null,
  };
}
