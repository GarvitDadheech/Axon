import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";

export function DocsBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 bg-[#080808]">
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)
          `,
          backgroundSize: "48px 48px",
        }}
      />
    </div>
  );
}

export function DocsHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#080808]/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 opacity-80 hover:opacity-100 transition-opacity">
            <Image src="/logo.png" width={22} height={22} alt="" className="rounded" />
            <span className="font-display text-sm font-semibold text-[#f0eeea]">Axon</span>
          </Link>
          <span className="hidden sm:inline font-mono text-[10px] uppercase tracking-wider text-white/25">
            Docs
          </span>
        </div>
        <nav className="flex items-center gap-5">
          <Link
            href="/"
            className="font-mono text-[10px] uppercase tracking-wider text-white/35 hover:text-white/70 transition-colors"
          >
            Home
          </Link>
          <Link
            href="/dashboard"
            className="font-mono text-[10px] uppercase tracking-wider text-emerald-400/70 hover:text-emerald-400 transition-colors"
          >
            Dashboard
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function DocsPage({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen text-[#e8e6e0]">
      <DocsBackground />
      <DocsHeader />
      <main className="mx-auto max-w-3xl px-6 py-10 pb-16">{children}</main>
    </div>
  );
}

export function DocsH2({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2
      id={id}
      className="scroll-mt-20 font-display text-xl font-semibold tracking-tight text-[#f0eeea] border-b border-white/[0.06] pb-3"
    >
      {children}
    </h2>
  );
}

export function DocsCodeBlock({
  code,
  title,
  lang = "json",
}: {
  code: string;
  title?: string;
  lang?: string;
}) {
  return (
    <div className="overflow-hidden border border-white/[0.08] bg-[#050505]">
      <div className="flex items-center justify-between border-b border-white/[0.06] bg-white/[0.02] px-4 py-2.5">
        <span className="font-mono text-[10px] text-white/40">{title ?? lang}</span>
        <span className="font-mono text-[9px] uppercase tracking-wider text-emerald-400/40">
          {lang}
        </span>
      </div>
      <pre className="overflow-x-auto p-5 sm:p-6 font-mono text-[13px] leading-[1.75] text-white/75">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function DocsTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: string[][];
}) {
  return (
    <div className="overflow-x-auto border border-white/[0.07]">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-white/[0.06] bg-white/[0.02]">
            {headers.map((h) => (
              <th key={h} className="px-4 py-2.5 font-mono text-[10px] uppercase tracking-wider text-white/35 font-normal">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.05]">
          {rows.map((row) => (
            <tr key={row[0]}>
              <td className="px-4 py-3 font-mono text-[12px] text-emerald-400/75 align-top whitespace-nowrap">
                {row[0]}
              </td>
              {row.slice(1).map((cell, i) => (
                <td key={i} className="px-4 py-3 text-[13px] text-white/45 leading-relaxed">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
