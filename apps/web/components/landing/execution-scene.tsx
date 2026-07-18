"use client";

const RECEIPT = {
  id: "exec_8f2a91c",
  api: "prices.fetch(ETH)",
  provider: "coinbase",
  amount: "0.005",
  agent: "agent_0x4e2…9f1",
  status: "settled",
  response: "200 OK",
  verifiedAt: "14:32:01 UTC",
  tx: "0x7c3a…abf91",
  block: "8,412,903",
} as const;

const LEDGER = [
  { id: "exec_7d1e", api: "weather.current", amount: "0.002", status: "settled" },
  { id: "exec_6c0b", api: "embed.text", amount: "0.003", status: "settled" },
  { id: "exec_5a9f", api: "search.query", amount: "0.008", status: "failed" },
] as const;

const GUARANTEES = [
  {
    label: "x402",
    value: "API returns a quote. Agent pays USDC, then retries with proof.",
  },
  {
    label: "Verification",
    value: "Paywall checks the on-chain transfer and reference before serving.",
  },
  {
    label: "Settlement",
    value: "Receipt confirmed on Arbitrum. Immutable execution record.",
  },
] as const;

function StatusBadge({ children, variant }: { children: string; variant: "ok" | "muted" }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 border px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider ${
        variant === "ok"
          ? "border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-400/90"
          : "border-white/[0.08] bg-white/[0.02] text-white/35"
      }`}
    >
      {variant === "ok" && <span className="h-1 w-1 bg-emerald-400" />}
      {children}
    </span>
  );
}

export function ExecutionScene() {
  return (
    <section className="border-t border-white/[0.04] py-24 lg:py-32">
      <div className="px-[clamp(1.25rem,4vw,3.5rem)]">
        <div className="max-w-xl mb-14">
          <h2 className="font-display text-[clamp(1.75rem,3.5vw,2.5rem)] font-semibold tracking-[-0.04em] text-[#f0eeea]">
            Every execution leaves a receipt.
          </h2>
          <p className="mt-4 text-[15px] text-white/38 max-w-[36ch]">
            Each paid call settles on Arbitrum with a transaction hash. Proof lives
            on-chain, not in a billing spreadsheet.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-12 lg:gap-5">
          {/* Primary execution record */}
          <div className="border border-white/[0.08] bg-[#050505] lg:col-span-8">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-3.5 sm:px-6">
              <div>
                <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/25">
                  Execution record
                </p>
                <p className="mt-1 font-mono text-[11px] text-white/50">{RECEIPT.id}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <StatusBadge variant="ok">Verified</StatusBadge>
                <StatusBadge variant="ok">Settled</StatusBadge>
              </div>
            </div>

            <div className="divide-y divide-white/[0.05]">
              {[
                { k: "API", v: RECEIPT.api },
                { k: "Provider", v: RECEIPT.provider },
                { k: "Agent", v: RECEIPT.agent },
                { k: "Amount", v: `${RECEIPT.amount} USDC`, accent: true },
                { k: "Response", v: RECEIPT.response },
                { k: "Verified", v: RECEIPT.verifiedAt },
              ].map(({ k, v, accent }) => (
                <div
                  key={k}
                  className="flex items-center justify-between gap-4 px-5 py-3 sm:px-6"
                >
                  <span className="font-mono text-[10px] uppercase tracking-wider text-white/25">
                    {k}
                  </span>
                  <span
                    className={`font-mono text-[11px] sm:text-xs text-right ${
                      accent ? "text-emerald-400/85" : "text-white/55"
                    }`}
                  >
                    {v}
                  </span>
                </div>
              ))}
            </div>

            <div className="border-t border-emerald-500/15 bg-emerald-500/[0.04] px-5 py-4 sm:px-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-wider text-emerald-400/60">
                    Arbitrum settlement
                  </p>
                  <p className="mt-1 font-mono text-[11px] text-white/45">{RECEIPT.tx}</p>
                </div>
                <p className="font-mono text-[10px] text-white/30">
                  Block {RECEIPT.block}
                </p>
              </div>
            </div>
          </div>

          {/* Settlement ledger */}
          <div className="border border-white/[0.07] bg-white/[0.015] lg:col-span-4 flex flex-col">
            <div className="border-b border-white/[0.06] px-5 py-3.5">
              <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/25">
                Settlement ledger
              </p>
              <p className="mt-1 text-[13px] text-white/40">Recent executions</p>
            </div>

            <div className="flex-1 divide-y divide-white/[0.05]">
              {LEDGER.map((row) => (
                <div key={row.id} className="px-5 py-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[10px] text-white/35">{row.id}</span>
                    <StatusBadge variant={row.status === "settled" ? "ok" : "muted"}>
                      {row.status}
                    </StatusBadge>
                  </div>
                  <p className="mt-1.5 font-mono text-[11px] text-white/50 truncate">
                    {row.api}
                  </p>
                  <p className="mt-1 font-mono text-[10px] text-emerald-400/65">
                    {row.amount} USDC
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-auto border-t border-white/[0.05] px-5 py-3">
              <p className="font-mono text-[9px] text-white/22 uppercase tracking-wider">
                All records · on-chain
              </p>
            </div>
          </div>
        </div>

        {/* Trust guarantees */}
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {GUARANTEES.map((g) => (
            <div
              key={g.label}
              className="border border-white/[0.06] bg-white/[0.01] px-5 py-4"
            >
              <p className="font-mono text-[10px] uppercase tracking-wider text-white/30">
                {g.label}
              </p>
              <p className="mt-2 text-[13px] text-white/38 leading-relaxed">{g.value}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
