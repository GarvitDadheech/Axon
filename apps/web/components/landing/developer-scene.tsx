"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

const MCP_CONFIG = `{
  "mcpServers": {
    "axon": {
      "url": "https://your-app.vercel.app/api/mcp"
    }
  }
}`;

function CodeLine({ line }: { line: string }) {
  const colonIdx = line.indexOf('":', line.indexOf('"') + 1);
  if (colonIdx !== -1 && line.trimStart().startsWith('"')) {
    const key = line.slice(0, colonIdx + 1);
    const rest = line.slice(colonIdx + 1);
    return (
      <div>
        <span className="text-emerald-500/55">{key}</span>
        <span className="text-white/15">:</span>
        <span className="text-[#c8c6c0]/70">{rest}</span>
      </div>
    );
  }
  if (/^\s*[{}\[\]],?\s*$/.test(line)) {
    return (
      <div>
        <span className="text-white/20">{line}</span>
      </div>
    );
  }
  return (
    <div>
      <span className="text-white/35">{line}</span>
    </div>
  );
}

export function DeveloperScene() {
  const lines = MCP_CONFIG.split("\n");

  return (
    <section className="border-t border-white/[0.04] py-24 lg:py-32">
      <div className="px-[clamp(1.25rem,4vw,3.5rem)]">
        <div className="max-w-xl mb-14">
          <h2 className="font-display text-[clamp(1.75rem,3.5vw,2.5rem)] font-semibold tracking-[-0.04em] text-[#f0eeea]">
            Integrate in minutes.
          </h2>
          <p className="mt-4 text-[15px] text-white/38 max-w-[36ch]">
            One MCP config block. Your agent connects to the marketplace.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,0.34fr)_minmax(0,0.66fr)] lg:gap-10 lg:items-stretch">
          <div className="flex flex-col justify-between gap-8 lg:py-1">
            <div className="space-y-4 border-l border-white/[0.06] pl-5">
              <p className="font-mono text-[10px] uppercase tracking-wider text-white/25">
                Setup
              </p>
              <p className="text-[14px] text-white/38 leading-relaxed max-w-[28ch]">
                Add Axon to your agent config. Payments and discovery work out of
                the box.
              </p>
            </div>
            <Link
              href="/docs/mcp"
              className="inline-flex w-fit items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-white/30 hover:text-emerald-400/70 transition-colors"
            >
              Full docs
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="relative min-w-0">
            <svg
              className="pointer-events-none absolute -left-2 -top-2 h-8 w-8 text-white/12"
              viewBox="0 0 32 32"
              aria-hidden
            >
              <path d="M 4 4 L 4 14 M 4 4 L 14 4" fill="none" stroke="currentColor" strokeWidth="1" />
            </svg>
            <svg
              className="pointer-events-none absolute -right-2 -bottom-2 h-8 w-8 text-white/12"
              viewBox="0 0 32 32"
              aria-hidden
            >
              <path
                d={`M 28 28 L 28 18 M 28 28 L 18 28`}
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
              />
            </svg>
            <span className="pointer-events-none absolute -top-3 right-4 font-mono text-[8px] uppercase tracking-[0.22em] text-white/20">
              mcp.layer · 443
            </span>

            <div className="relative border border-emerald-500/15 bg-[#050505]">
              <div
                className="pointer-events-none absolute inset-0 opacity-[0.35]"
                style={{
                  backgroundImage: `
                    linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)
                  `,
                  backgroundSize: "24px 24px",
                }}
              />
              <div className="relative flex items-center justify-between border-b border-white/[0.06] px-5 py-3">
                <span className="font-mono text-[10px] text-white/35">
                  claude_desktop_config.json
                </span>
                <span className="font-mono text-[9px] uppercase tracking-wider text-emerald-400/45">
                  ready
                </span>
              </div>
              <div className="relative overflow-x-auto px-5 py-6 sm:px-7 sm:py-8">
                <pre className="font-mono text-[13px] sm:text-[14px] leading-[1.9]">
                  {lines.map((line, i) => (
                    <CodeLine key={i} line={line} />
                  ))}
                </pre>
              </div>
              <div className="relative flex items-center gap-3 border-t border-white/[0.05] px-5 py-2.5">
                <div className="h-px flex-1 bg-white/[0.06]" />
                <span className="font-mono text-[8px] text-white/18">axon · mcp</span>
                <div className="h-px w-12 bg-emerald-500/25" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
