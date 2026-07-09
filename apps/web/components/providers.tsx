"use client";

import { createContext, useContext, useCallback, useEffect, useState, useMemo } from "react";
import { getMagic } from "@/lib/magic";

export interface AuthUser {
  email: string | null;
  wallet: `0x${string}` | null;
}

export interface AuthContextValue {
  ready: boolean;
  authenticated: boolean;
  user: AuthUser | null;
  login: () => void;
  logout: () => Promise<void>;
  /** Fresh Magic DID token — send as `Authorization: Bearer <token>` to Axon APIs. */
  getIdToken: () => Promise<string>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <Providers>");
  return ctx;
}

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const magic = getMagic();
      if (!magic) {
        setReady(true);
        return;
      }

      let resolvedUser: AuthUser | null = null;

      // Finish an in-flight Google OAuth redirect, if any.
      if (window.location.search.includes("provider=")) {
        try {
          const result = await magic.oauth2.getRedirectResult();
          resolvedUser = {
            email: result.magic.userMetadata.email,
            wallet: (result.magic.userMetadata.wallets?.ethereum?.publicAddress ??
              null) as `0x${string}` | null,
          };
        } catch {
          // Not actually a pending OAuth redirect — ignore.
        } finally {
          window.history.replaceState({}, "", window.location.pathname);
        }
      }

      if (!resolvedUser) {
        const loggedIn = await magic.user.isLoggedIn().catch(() => false);
        if (loggedIn) {
          const info = await magic.user.getInfo();
          resolvedUser = {
            email: info.email,
            wallet: (info.wallets?.ethereum?.publicAddress ?? null) as `0x${string}` | null,
          };
        }
      }

      if (!cancelled) {
        setUser(resolvedUser);
        setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(() => {
    const magic = getMagic();
    if (!magic) return;
    magic.oauth2.loginWithRedirect({
      provider: "google",
      redirectURI: `${window.location.origin}/`,
    });
  }, []);

  const logout = useCallback(async () => {
    const magic = getMagic();
    if (!magic) return;
    await magic.user.logout();
    setUser(null);
  }, []);

  const getIdToken = useCallback(async () => {
    const magic = getMagic();
    if (!magic) throw new Error("Magic is not configured");
    return magic.user.getIdToken();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ ready, authenticated: !!user, user, login, logout, getIdToken }),
    [ready, user, login, logout, getIdToken]
  );

  if (!process.env.NEXT_PUBLIC_MAGIC_PUBLISHABLE_KEY) {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground text-sm">
        Missing NEXT_PUBLIC_MAGIC_PUBLISHABLE_KEY environment variable.
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
