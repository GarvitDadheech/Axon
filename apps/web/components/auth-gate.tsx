"use client";

import { useAuth } from "@/components/providers";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

interface AuthGateProps {
  children: React.ReactNode;
}

export function AuthGate({ children }: AuthGateProps) {
  const { ready, authenticated } = useAuth();
  const router = useRouter();
  // Keep SSR + first client paint identical to avoid hydration mismatch
  // (server always sees ready=false; client may already be authenticated).
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !ready) return;
    if (!authenticated) router.replace("/");
  }, [mounted, ready, authenticated, router]);

  if (!mounted || !ready) {
    return (
      <div className="flex flex-col gap-4 p-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!authenticated) return null;

  return <>{children}</>;
}
