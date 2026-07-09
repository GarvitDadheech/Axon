/**
 * Magic server SDK wrapper.
 *
 * Verifies Magic DID tokens (`Authorization: Bearer <didToken>`) issued by
 * the client SDK after a Google/OAuth login and resolves them to the
 * user's embedded wallet address — the same role `lib/privy.ts` used to
 * play for Privy.
 *
 * Setup: create a Magic app at https://dashboard.magic.link, add
 * MAGIC_SECRET_KEY (server) and NEXT_PUBLIC_MAGIC_PUBLISHABLE_KEY (client)
 * to .env.local.
 */

import { Magic } from "@magic-sdk/admin";
import { env } from "@/lib/env";

let _client: Magic | null = null;

export function magicAdmin(): Magic {
  if (_client) return _client;
  _client = new Magic(env().MAGIC_SECRET_KEY);
  return _client;
}

export interface VerifiedMagicUser {
  issuer: string;
  walletAddress: `0x${string}` | null;
  email: string | null;
}

/** Verify a DID token and resolve the issuer's embedded wallet + email. */
export async function verifyDidToken(didToken: string): Promise<VerifiedMagicUser> {
  const admin = magicAdmin();
  admin.token.validate(didToken); // throws SDKError if expired/malformed/replayed
  const metadata = await admin.users.getMetadataByToken(didToken);
  return {
    issuer: metadata.issuer ?? admin.token.getIssuer(didToken),
    walletAddress: (metadata.publicAddress as `0x${string}` | null) ?? null,
    email: metadata.email,
  };
}
