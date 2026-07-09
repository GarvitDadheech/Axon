"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers";
import { ArrowRight } from "lucide-react";

export function LandingNavbar() {
  const { ready, authenticated, login } = useAuth();
  const router = useRouter();

  const handleAuthClick = () => {
    if (authenticated) {
      router.push("/dashboard");
    } else {
      login();
    }
  };

  return (
    <header className="fixed top-0 inset-x-0 z-50">
      <div className="flex items-center justify-between px-[clamp(1.25rem,4vw,3.5rem)] pt-7">
        <Link
          href="/"
          className="opacity-70 transition-opacity hover:opacity-100"
          aria-label="Axon home"
        >
          <Image src="/logo.png" width={26} height={26} alt="" className="rounded-md" />
        </Link>

        <nav className="flex items-center gap-10">
          <Link
            href="/docs/mcp"
            className="hidden sm:block font-mono text-[11px] uppercase tracking-[0.14em] text-white/40 hover:text-white/75 transition-colors"
          >
            Docs
          </Link>
          <button
            onClick={handleAuthClick}
            disabled={!ready}
            className="group flex items-center gap-2 border border-emerald-500/40 bg-emerald-500/[0.08] px-4 py-2 font-mono text-[11px] uppercase tracking-[0.12em] text-emerald-400 transition-colors hover:bg-emerald-500/15 hover:border-emerald-400/60 disabled:opacity-40"
          >
            {authenticated ? "Dashboard" : "Sign in"}
            <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
          </button>
        </nav>
      </div>
    </header>
  );
}
