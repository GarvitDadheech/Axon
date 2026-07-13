"use client";

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useMemo,
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
import {
  encodeParticleBearer,
  particleAuthConfigured,
  particleAuthOptions,
} from "@/lib/particle-auth";

// Avoid importing @particle-network/auth-core directly (pulls AWS Node SDK).
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
  const { connect, disconnect, connected, connectionStatus } = useConnect();
  const { userInfo } = useAuthCore();
  const { provider, address, switchChain } = useEthereum();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // AuthKit finishes hydrating once connectionStatus leaves "loading"
    if (connectionStatus !== "loading") setReady(true);
  }, [connectionStatus]);

  // Prefer Arbitrum Sepolia for settlement transfers once connected
  useEffect(() => {
    if (!connected || !address) return;
    switchChain?.(arbitrumSepolia.id).catch(() => {
      /* chain may already be set */
    });
  }, [connected, address, switchChain]);

  const user = useMemo<AuthUser | null>(() => {
    if (!connected || !userInfo) return null;
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
      particleUserId: userInfo.uuid ?? null,
    };
  }, [connected, userInfo, address]);

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

  const value = useMemo<AuthContextValue>(
    () => ({
      ready,
      authenticated: !!user?.wallet,
      user,
      login,
      logout,
      getIdToken,
      ethereumProvider: provider ?? null,
    }),
    [ready, user, login, logout, getIdToken, provider]
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
