"use client";

import Link from "next/link";

export function MinePlaceholder() {
  return (
    <div>
      <div className="text-center max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[var(--color-border-bright)] bg-[var(--color-panel)] mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-gold)]" />
          <span className="text-[11px] font-mono uppercase tracking-[0.18em] text-[var(--color-fg-dim)]">
            Coming soon
          </span>
        </div>

        <h1 className="text-[56px] md:text-[80px] font-black tracking-[-0.03em] leading-[0.98] text-balance">
          Browser miner
          <br />
          <span className="text-[var(--color-rose)]">arriving shortly.</span>
        </h1>

        <p className="mt-8 text-[18px] leading-[1.55] text-[var(--color-fg-dim)] text-balance">
          We're wiring the WASM Equihash solver into the site so you can mine
          $EQM with one click. Connect Phantom, click Start, earn — no install.
          Works on phones too.
        </p>

        <p className="mt-6 text-[15px] leading-[1.6] text-[var(--color-fg-dim)] max-w-xl mx-auto">
          In the meantime, the CLI miner is fully working. Clone the repo,
          build it, point it at devnet, and mine real $EQM.
        </p>

        <div className="mt-9 flex flex-col sm:flex-row gap-3 justify-center">
          <a
            href="https://github.com/HannaPrints/equium#run-the-cli-miner"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-[var(--color-rose)] text-[var(--color-bg)] text-[15px] font-bold hover:bg-[var(--color-rose-bright)] transition-all glow-rose-soft"
          >
            CLI miner setup →
          </a>
          <Link
            href="/explorer"
            className="inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-full border border-[var(--color-border-bright)] text-[15px] font-medium text-[var(--color-fg-soft)] hover:bg-white/[0.03]"
          >
            Watch the chain
          </Link>
        </div>
      </div>

      {/* Specs preview */}
      <div className="mt-20 grid md:grid-cols-3 gap-3 max-w-3xl mx-auto">
        <PreviewCard
          step="1"
          title="Connect"
          body="Phantom, Solflare, or any Solana wallet adapter. Your keys stay local."
        />
        <PreviewCard
          step="2"
          title="Start"
          body="WASM solver runs in a Web Worker — the page stays responsive while mining."
          highlight
        />
        <PreviewCard
          step="3"
          title="Earn"
          body="Block rewards confirm to your wallet's ATA in under a second."
        />
      </div>
    </div>
  );
}

function PreviewCard({
  step,
  title,
  body,
  highlight = false,
}: {
  step: string;
  title: string;
  body: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-3xl p-6 border ${
        highlight
          ? "bg-[var(--color-panel-2)] border-[var(--color-rose-soft)]"
          : "bg-[var(--color-panel)] border-[var(--color-border)]"
      }`}
    >
      <div className="text-[10px] font-mono font-bold tracking-[0.2em] text-[var(--color-fg-dim)] mb-4">
        STEP {step}
      </div>
      <h4 className="text-[20px] font-bold tracking-[-0.01em] mb-2">{title}</h4>
      <p className="text-[14px] leading-[1.6] text-[var(--color-fg-dim)]">
        {body}
      </p>
    </div>
  );
}
