"use client";

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  AuthCoreContextProvider,
  useConnect,
  useAuthCore,
  useEthereum,
} from "@particle-network/authkit";
import { arbitrumSepolia } from "@particle-network/authkit/chains";
import { Buffer } from "buffer";
import {
  encodeParticleBearer,
  particleAuthConfigured,
  particleAuthOptions,
  peekParticleOAuthCallback,
} from "@/lib/particle-auth";

// Particle Auth expects Buffer in the browser (see official web SDK docs).
if (typeof window !== "undefined") {
  (window as unknown as { Buffer: typeof Buffer }).Buffer = Buffer;
}

// Avoid importing @particle-network/auth-core entry (pulls AWS Node SDK).
const AUTH_TYPES = ["email", "google", "apple", "twitter"] as const;

export interface AuthUser {
  email: string | null;
  wallet: `0x${string}` | null;
  particleUserId: string | null;
}

export interface AuthContextValue {
  ready: boolean;
  authenticated: boolean;
  user: AuthUser | null;
  login: () => void;
  logout: () => Promise<void>;
  /** Particle session as `uuid:token` for Authorization: Bearer … */
  getIdToken: () => Promise<string>;
  /** EIP-1193 provider from Particle Auth embedded wallet */
  ethereumProvider: unknown | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be within <Providers>");
  return ctx;
}

function ParticleAuthBridge({ children }: { children: ReactNode }) {
  const { connect, disconnect, connected, connectionStatus, setSocialConnectCallback } =
    useConnect();
  const { userInfo } = useAuthCore();
  const { provider, address, switchChain, enable } = useEthereum();
  const [ready, setReady] = useState(false);
  const oauthFallbackStarted = useRef(false);

  useEffect(() => {
    setSocialConnectCallback({
      onError: (err) => {
        console.error("[axon] Particle social connect failed:", err);
      },
    });
    return () => setSocialConnectCallback(undefined);
  }, [setSocialConnectCallback]);

  // AuthKit Index normally finishes Google OAuth. If params remain after 2s
  // (Index didn't mount), fall back once — without racing Index on first paint.
  useEffect(() => {
    if (typeof window === "undefined" || oauthFallbackStarted.current) return;
    if (!window.location.search.includes("particleThirdpartyParams")) return;

    const timer = window.setTimeout(() => {
      if (oauthFallbackStarted.current || connected) return;
      const cb = peekParticleOAuthCallback();
      if (!cb) return;
      oauthFallbackStarted.current = true;
      void connect({
        socialType: cb.socialType,
        code: cb.code,
        nonce: cb.nonce,
      }).catch((err) => {
        console.error("[axon] Particle OAuth fallback failed:", err);
      });
    }, 2000);

    return () => window.clearTimeout(timer);
  }, [connect, connected]);

  useEffect(() => {
    const oauthReturning =
      typeof window !== "undefined" &&
      window.location.search.includes("particleThirdpartyParams");

    if (
      oauthReturning ||
      connectionStatus === "loading" ||
      connectionStatus === "connecting"
    ) {
      setReady(false);
      return;
    }
    setReady(true);
  }, [connectionStatus]);

  useEffect(() => {
    if (!connected || !address) return;
    switchChain?.(arbitrumSepolia.id).catch(() => {});
  }, [connected, address, switchChain]);

  useEffect(() => {
    if (!connected || address) return;
    void enable().catch(() => {});
  }, [connected, address, enable]);

  const user = useMemo<AuthUser | null>(() => {
    if (!userInfo?.uuid) return null;
    const wallet =
      (address as `0x${string}` | undefined) ??
      (userInfo.wallets?.find((w) => w.chain_name === "evm_chain")
        ?.public_address as `0x${string}` | undefined) ??
      null;
    const email =
      userInfo.email ??
      userInfo.google_email ??
      userInfo.thirdparty_user_info?.user_info?.email ??
      null;
    return {
      email,
      wallet: wallet ?? null,
      particleUserId: userInfo.uuid,
    };
  }, [userInfo, address]);

  const login = useCallback(() => {
    void connect({}).catch((err) => {
      console.error("[axon] Particle login failed:", err);
    });
  }, [connect]);

  const logout = useCallback(async () => {
    await disconnect();
  }, [disconnect]);

  const getIdToken = useCallback(async () => {
    if (!userInfo?.uuid || !userInfo?.token) {
      throw new Error("Not authenticated with Particle Auth");
    }
    return encodeParticleBearer(userInfo.uuid, userInfo.token);
  }, [userInfo]);

  const authenticated = connected || !!user?.particleUserId;

  const value = useMemo<AuthContextValue>(
    () => ({
      ready: ready || authenticated,
      authenticated,
      user,
      login,
      logout,
      getIdToken,
      ethereumProvider: provider ?? null,
    }),
    [ready, authenticated, user, login, logout, getIdToken, provider]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function Providers({ children }: { children: ReactNode }) {
  if (!particleAuthConfigured()) {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground text-sm px-6 text-center">
        Missing Particle Auth env: set NEXT_PUBLIC_PARTICLE_PROJECT_ID,
        NEXT_PUBLIC_PARTICLE_CLIENT_KEY, and NEXT_PUBLIC_PARTICLE_APP_ID
        (create a Web app in dashboard.particle.network).
      </div>
    );
  }

  const opts = particleAuthOptions();

  return (
    <AuthCoreContextProvider
      options={{
        projectId: opts.projectId,
        clientKey: opts.clientKey,
        appId: opts.appId,
        chains: [arbitrumSepolia],
        authTypes: [...AUTH_TYPES] as never[],
        themeType: "dark",
        fiatCoin: "USD",
        language: "en",
        // Don't block OAuth completion on password setup prompts
        promptSettingConfig: {
          promptMasterPasswordSettingWhenLogin: false,
          promptPaymentPasswordSettingWhenSign: false,
        },
        wallet: {
          visible: true,
          themeType: "dark",
        },
      }}
    >
      <ParticleAuthBridge>{children}</ParticleAuthBridge>
    </AuthCoreContextProvider>
  );
}
