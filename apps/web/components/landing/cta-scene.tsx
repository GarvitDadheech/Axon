"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

interface CtaSceneProps {
  onLogin: () => void;
  ready: boolean;
}

export function CtaScene({ onLogin, ready }: CtaSceneProps) {
  return (
    <section className="border-t border-white/[0.04] py-24 lg:py-32">
      <div className="px-[clamp(1.25rem,4vw,3.5rem)]">
        <div className="grid gap-10 lg:grid-cols-12 lg:items-end lg:gap-8">
          <div className="lg:col-span-7">
            <h2 className="font-display text-[clamp(1.75rem,3.5vw,2.5rem)] font-semibold tracking-[-0.04em] text-[#f0eeea] max-w-[18ch]">
              Experience agents that spend for you.
            </h2>
            <p className="mt-4 text-[15px] text-white/38 max-w-[36ch]">
              Particle Auth in. Universal Account balance. Openfort spend. Arbitrum
              settlement. Open the dashboard and run the loop.
            </p>
            <button
              onClick={onLogin}
              disabled={!ready}
              className="mt-8 group inline-flex items-center gap-3 bg-[#f5f4f0] px-7 py-3.5 font-mono text-[11px] uppercase tracking-[0.14em] text-[#0a0a0a] transition-colors hover:bg-white disabled:opacity-40"
            >
              Open Dashboard
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
            </button>
          </div>

          <div className="lg:col-span-5 border border-white/[0.06] bg-white/[0.015] px-5 py-5">
            <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/25">
              Axon
            </p>
            <p className="mt-3 text-[13px] text-white/35 leading-relaxed max-w-[32ch]">
              Chain-agnostic UX for AI agents. Powered by Particle Universal Accounts
              and settled on Arbitrum.
            </p>
            <Link
              href="/docs/mcp"
              className="mt-5 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-white/30 hover:text-emerald-400/70 transition-colors"
            >
              Documentation
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        <footer className="mt-16 flex flex-col gap-4 border-t border-white/[0.06] pt-8 sm:flex-row sm:items-center sm:justify-between">
          <span className="font-display text-sm font-semibold text-white/35">Axon</span>
          <div className="flex flex-wrap items-center gap-6">
            <Link
              href="/docs/mcp"
              className="font-mono text-[10px] uppercase tracking-wider text-white/25 hover:text-white/50 transition-colors"
            >
              Docs
            </Link>
            <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/20">
              © 2026 · Particle · Openfort · Arbitrum
            </span>
          </div>
        </footer>
      </div>
    </section>
  );
}
