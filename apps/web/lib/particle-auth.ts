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
