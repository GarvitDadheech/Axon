"use client";

import { ArrowRight } from "lucide-react";
import { MarketplaceNetwork } from "./marketplace-network";

interface HeroSceneProps {
  onLogin: () => void;
  ready: boolean;
}

export function HeroScene({ onLogin, ready }: HeroSceneProps) {
  return (
    <section className="relative h-[100svh] min-h-[640px] overflow-hidden">
      <div className="absolute inset-0" aria-hidden>
        <MarketplaceNetwork />
      </div>

      <div className="absolute inset-0 z-10">
        {/* Brand row */}
        <div className="absolute inset-x-[clamp(1.25rem,4.5vw,3.5rem)] top-[clamp(5.5rem,14vh,7.5rem)] flex items-center justify-between gap-6">
          <p
            className="font-display text-[clamp(2.25rem,5vw,4rem)] font-bold tracking-[-0.055em] leading-none text-[#f5f4f0]"
            style={{ textShadow: "0 0 40px rgba(8,8,8,0.9)" }}
          >
            Axon
          </p>
          <p className="shrink-0 font-mono text-[9px] sm:text-[20px] uppercase tracking-[0.18em] sm:tracking-[0.2em] text-white/22 text-right max-w-[14ch] sm:max-w-none">
            The execution layer for autonomous AI
          </p>
        </div>

        {/* Arbitrum — credibility over category */}
        <div className="absolute left-[clamp(1.25rem,4.5vw,3.5rem)] top-[clamp(11.5rem,24vh,13.5rem)] flex items-center gap-2 border-l border-emerald-500/45 pl-3">
          <span className="h-1.5 w-1.5 bg-emerald-400" />
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-emerald-400/90">
            Powered by Arbitrum
          </span>
        </div>

        {/* Single message */}
        <h1
          className="absolute left-[clamp(1.25rem,4.5vw,3.5rem)] top-[clamp(14.5rem,31vh,17.5rem)] max-w-[min(88vw,22rem)] sm:max-w-[26rem] lg:max-w-[28rem] font-display text-[clamp(1.85rem,4vw,3.5rem)] font-semibold tracking-[-0.04em] leading-[1.05] text-[#f0eeea]"
          style={{ textShadow: "0 2px 24px rgba(8,8,8,0.85)" }}
        >
          Where agents run workflows and pay automatically.
        </h1>

        <button
          onClick={onLogin}
          disabled={!ready}
          className="absolute left-[clamp(1.25rem,4.5vw,3.5rem)] bottom-[clamp(2.5rem,7vh,3.5rem)] group inline-flex items-center gap-3 bg-[#f5f4f0] px-7 py-3.5 font-mono text-[11px] uppercase tracking-[0.14em] text-[#0a0a0a] transition-colors hover:bg-white disabled:opacity-40"
        >
          Open Dashboard
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
        </button>
      </div>
    </section>
  );
}
