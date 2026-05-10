"use client";

import Link from "next/link";
import Image from "next/image";

export function Hero() {
  return (
    <section className="relative pt-40 md:pt-48 pb-24 md:pb-32 px-6">
      {/* Ambient glow */}
      <div className="absolute top-32 left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full pointer-events-none opacity-40 blur-3xl"
           style={{ background: "radial-gradient(circle, rgba(232,90,141,0.35) 0%, transparent 65%)" }} />

      <div className="relative max-w-5xl mx-auto text-center">
        {/* Eyebrow chip */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[var(--color-border-bright)] bg-[var(--color-panel)] mb-8 fade-up">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-mint)] live-dot" />
          <span className="text-[11px] font-mono uppercase tracking-[0.18em] text-[var(--color-fg-dim)]">
            Live on Solana Devnet
          </span>
        </div>

        {/* Headline */}
        <h1 className="text-[64px] md:text-[112px] leading-[0.95] font-black tracking-[-0.04em] text-balance fade-up" style={{ animationDelay: "60ms" }}>
          A token you
          <br />
          <span className="text-[var(--color-rose)]">actually mine.</span>
        </h1>

        {/* Sub */}
        <p className="mt-8 max-w-2xl mx-auto text-[18px] md:text-[20px] leading-[1.55] text-[var(--color-fg-dim)] text-balance fade-up" style={{ animationDelay: "120ms" }}>
          Equium ($EQM) is a CPU-mineable token on Solana. Bitcoin-style economics —{" "}
          <span className="text-[var(--color-fg)]">21M hard cap, halving forever</span>.
          No presale, no airdrop, no VC. Mine it from your laptop. Even from your phone.
        </p>

        {/* CTAs */}
        <div className="mt-10 flex items-center justify-center gap-3 fade-up" style={{ animationDelay: "180ms" }}>
          <Link
            href="/mine"
            className="group inline-flex items-center gap-2.5 px-6 py-3.5 rounded-full bg-[var(--color-rose)] text-[var(--color-bg)] text-[15px] font-bold hover:bg-[var(--color-rose-bright)] transition-all glow-rose hover:scale-[1.02]"
          >
            <PickaxeIcon />
            Start mining
            <ArrowIcon className="opacity-70 group-hover:translate-x-0.5 transition-transform" />
          </Link>
          <Link
            href="/explorer"
            className="inline-flex items-center gap-2 px-5 py-3.5 rounded-full border border-[var(--color-border-bright)] text-[15px] font-medium text-[var(--color-fg-soft)] hover:bg-white/[0.03] hover:text-[var(--color-fg)] transition-colors"
          >
            View explorer
          </Link>
        </div>

        {/* Trust strip — quick visual specs */}
        <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-px bg-[var(--color-border)] rounded-2xl overflow-hidden border border-[var(--color-border)] fade-up" style={{ animationDelay: "260ms" }}>
          <SpecCell label="Total supply" value="21M" accent="rose" />
          <SpecCell label="Block reward" value="25 EQM" accent="gold" />
          <SpecCell label="Block time" value="~1 min" accent="mint" />
          <SpecCell label="Halving" value="378k blocks" accent="teal" />
        </div>
      </div>
    </section>
  );
}

function SpecCell({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: "rose" | "gold" | "mint" | "teal";
}) {
  const color = {
    rose: "var(--color-rose)",
    gold: "var(--color-gold)",
    mint: "var(--color-mint)",
    teal: "var(--color-teal)",
  }[accent];
  return (
    <div className="bg-[var(--color-bg)] px-5 py-6 text-left">
      <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--color-fg-dim)] mb-1.5">
        {label}
      </div>
      <div
        className="text-[28px] md:text-[32px] font-bold tracking-[-0.02em]"
        style={{ color }}
      >
        {value}
      </div>
    </div>
  );
}

function PickaxeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 4l6 6" />
      <path d="M17 7l-5.5 5.5" />
      <path d="M11.5 12.5L3 21" />
      <path d="M11.5 12.5l3 3" />
      <path d="M9.5 14.5l3 3" />
    </svg>
  );
}

function ArrowIcon({ className = "" }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}
