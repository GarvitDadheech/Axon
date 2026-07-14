"use client";

/**
 * Particle Auth client helpers + env checks.
 * Provider wiring lives in components/providers.tsx (AuthCoreContextProvider).
 *
 * @see https://developers.particle.network/social-logins/auth/desktop-sdks/web
 */

export function particleAuthConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_PARTICLE_PROJECT_ID &&
      process.env.NEXT_PUBLIC_PARTICLE_CLIENT_KEY &&
      process.env.NEXT_PUBLIC_PARTICLE_APP_ID
  );
}

export function particleAuthOptions() {
  return {
    projectId: process.env.NEXT_PUBLIC_PARTICLE_PROJECT_ID!,
    clientKey: process.env.NEXT_PUBLIC_PARTICLE_CLIENT_KEY!,
    appId: process.env.NEXT_PUBLIC_PARTICLE_APP_ID!,
  };
}

/** Encode Particle session for Authorization: Bearer <uuid>:<token> */
export function encodeParticleBearer(uuid: string, token: string): string {
  return `${uuid}:${token}`;
}

function decodeBase64UrlJson<T>(value: string): T {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad =
    padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  return JSON.parse(atob(padded + pad)) as T;
}

/** Peek OAuth redirect params without stripping (AuthKit Index owns that). */
export function peekParticleOAuthCallback(): {
  socialType: "google" | "apple" | "twitter" | "github" | "discord";
  code: string;
  nonce: string;
} | null {
  if (typeof window === "undefined") return null;
  const raw = new URLSearchParams(window.location.search).get(
    "particleThirdpartyParams"
  );
  if (!raw) return null;
  try {
    const decoded = decodeBase64UrlJson<{
      code?: string;
      nonce?: string;
      error?: string;
    }>(raw);
    if (decoded.error || !decoded.code || !decoded.nonce) return null;
    const socialType = decoded.nonce.split("@")[0] as
      | "google"
      | "apple"
      | "twitter"
      | "github"
      | "discord";
    return { socialType, code: decoded.code, nonce: decoded.nonce };
  } catch {
    return null;
  }
}
