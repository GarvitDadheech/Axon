"use client";

const CONVICTIONS = [
  {
    num: "01",
    title: "Agents should spend without asking permission.",
    desc: "Autonomous systems need money that moves at machine speed — not checkout flows.",
    dominant: true,
  },
  {
    num: "02",
    title: "A marketplace beats a dozen integrations.",
    desc: "Discover, price, and pay in one place. No custom billing per API.",
    dominant: false,
  },
  {
    num: "03",
    title: "Settlement is part of the product.",
    desc: "If confirmation is slow, the agent is slow. Arbitrum keeps the loop tight.",
    dominant: false,
  },
] as const;

export function BenefitsScene() {
  const [lead, ...support] = CONVICTIONS;

  return (
    <section className="border-t border-white/[0.04] py-24 lg:py-32">
      <div className="px-[clamp(1.25rem,4vw,3.5rem)]">
        <div className="max-w-xl mb-14">
          <h2 className="font-display text-[clamp(1.75rem,3.5vw,2.5rem)] font-semibold tracking-[-0.04em] text-[#f0eeea]">
            Why Axon
          </h2>
          <p className="mt-4 text-[15px] text-white/38 max-w-[36ch]">
            Three beliefs behind how agents pay for the open web.
          </p>
        </div>

        <div className="grid gap-3 lg:grid-cols-12 lg:gap-4">
          <article className="border border-emerald-500/12 bg-emerald-500/[0.03] p-8 sm:p-10 lg:col-span-7 lg:row-span-2 lg:flex lg:flex-col lg:justify-between">
            <p className="font-mono text-[10px] uppercase tracking-wider text-emerald-400/55">
              {lead.num}
            </p>
            <div className="mt-6 lg:mt-0">
              <h3 className="font-display text-[clamp(1.35rem,2.5vw,2rem)] font-semibold tracking-[-0.03em] text-[#f0eeea] leading-[1.12] max-w-[22ch]">
                {lead.title}
              </h3>
              <p className="mt-5 text-[15px] text-white/40 leading-relaxed max-w-[34ch]">
                {lead.desc}
              </p>
            </div>
          </article>

          {support.map((item) => (
            <article
              key={item.num}
              className="border border-white/[0.07] bg-white/[0.015] p-6 sm:p-7 lg:col-span-5"
            >
              <p className="font-mono text-[10px] uppercase tracking-wider text-white/22">
                {item.num}
              </p>
              <h3 className="mt-4 font-display text-[17px] sm:text-lg font-semibold tracking-tight text-[#e8e6e0] leading-snug max-w-[28ch]">
                {item.title}
              </h3>
              <p className="mt-3 text-[13px] sm:text-[14px] text-white/35 leading-relaxed max-w-[32ch]">
                {item.desc}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
