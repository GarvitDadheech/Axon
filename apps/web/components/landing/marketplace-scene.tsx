"use client";

const CATALOG = [
  { name: "weather.current", price: "0.002", provider: "openmeteo", wide: true },
  { name: "prices.fetch", price: "0.005", provider: "coinbase", wide: false },
  { name: "search.query", price: "0.008", provider: "brave", wide: false },
  { name: "vision.analyze", price: "0.020", provider: "replicate", wide: false },
  { name: "embed.text", price: "0.003", provider: "openai", wide: true },
  { name: "translate", price: "0.004", provider: "deepl", wide: false },
] as const;

export function MarketplaceScene() {
  return (
    <section className="border-t border-white/[0.04] py-24 lg:py-32">
      <div className="px-[clamp(1.25rem,4vw,3.5rem)]">
        <div className="max-w-xl mb-14">
          <h2 className="font-display text-[clamp(1.75rem,3.5vw,2.5rem)] font-semibold tracking-[-0.04em] text-[#f0eeea]">
            A marketplace agents can actually use.
          </h2>
          <p className="mt-4 text-[15px] text-white/38 max-w-[36ch]">
            Discover priced APIs, pay per call in USDC, get the result back in the same
            tool turn. Publishers list once. Agents compose freely.
          </p>
        </div>

        {/* Modular catalog layout with flow diagram */}
        <div className="grid lg:grid-cols-[140px_1fr_140px] gap-6 lg:gap-10 items-stretch">
          {/* Agent column */}
          <div className="hidden lg:flex flex-col items-center justify-center">
            <div className="border border-emerald-500/30 bg-emerald-500/[0.06] px-4 py-3 w-full text-center">
              <p className="font-mono text-[9px] uppercase tracking-wider text-emerald-400/80">
                Agent
              </p>
            </div>
            <div className="w-px flex-1 min-h-[40px] bg-emerald-500/25 my-2" />
            <div className="w-3 h-3 border border-emerald-400 bg-emerald-500/30" />
            <div className="w-px flex-1 min-h-[40px] bg-white/[0.08]" />
          </div>

          {/* Catalog grid */}
          <div className="relative">
            <div className="mb-3 flex items-center justify-between border-b border-white/[0.06] pb-2">
              <span className="font-mono text-[10px] uppercase tracking-wider text-white/30">
                API Marketplace
              </span>
              <span className="font-mono text-[10px] text-white/20">
                {CATALOG.length} listings
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
              {CATALOG.map((item) => (
                <div
                  key={item.name}
                  className={`border border-white/[0.07] bg-white/[0.02] p-3 sm:p-4 ${
                    item.wide ? "sm:col-span-2" : ""
                  }`}
                >
                  <p className="font-mono text-[11px] sm:text-xs text-white/55 truncate">
                    {item.name}()
                  </p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="font-mono text-[10px] text-emerald-400/70">
                      {item.price} USDC
                    </span>
                    <span className="font-mono text-[9px] text-white/25 truncate">
                      {item.provider}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Mobile flow indicator */}
            <div className="lg:hidden mt-6 flex items-center justify-center gap-3 font-mono text-[9px] uppercase tracking-wider text-white/25">
              <span className="text-emerald-400/60">Agent</span>
              <span>→</span>
              <span>Marketplace</span>
              <span>→</span>
              <span className="text-emerald-400/60">Providers</span>
            </div>
          </div>

          {/* Providers column */}
          <div className="hidden lg:flex flex-col items-center justify-center gap-3">
            <div className="w-px flex-1 min-h-[24px] bg-white/[0.08]" />
            <div className="w-3 h-3 border border-white/20 bg-white/[0.04]" />
            <div className="w-px flex-1 min-h-[24px] bg-emerald-500/25" />
            <div className="border border-white/[0.1] bg-white/[0.02] px-4 py-3 w-full text-center">
              <p className="font-mono text-[9px] uppercase tracking-wider text-white/40">
                Providers
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
