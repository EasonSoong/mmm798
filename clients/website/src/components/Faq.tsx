"use client";

import { useState } from "react";
import { SectionHeader } from "./HowItWorks";

const ITEMS = [
  {
    q: "Will I make money mining EQM?",
    a: "Maybe. Maybe not. Don't quit your job. Treat this like distributed sudoku that occasionally gives you internet money. Equium is an experiment in fair-launch distribution, not a yield product.",
  },
  {
    q: "What if my computer is slow?",
    a: "It mines slower. The network adjusts difficulty so blocks come at the same rate regardless of total hashrate, but your share of those blocks scales with your CPU. A modest machine will still earn — just less than a workstation.",
  },
  {
    q: "Can someone steal my solution?",
    a: "No. Solutions are cryptographically bound to the wallet that signs the transaction. If you broadcast a winning solution and someone copies the bytes, the chain rejects their tx because the puzzle includes their wallet address, not yours.",
  },
  {
    q: "Why Solana?",
    a: "Cheap fees. A mine transaction costs a fraction of a cent. The same protocol on Ethereum mainnet would cost more in gas than the block reward is worth. Solana also gives sub-second block finality, so winners get confirmed instantly.",
  },
  {
    q: "Is the supply really capped at 21M?",
    a: "Yes. Before the public launch, the mint authority is revoked at the SPL Token level. After that, no more EQM can ever be created — by anyone, including the team. The cap is structural, not a promise.",
  },
  {
    q: "What's the GitHub repo?",
    a: "Open source under Apache-2.0 at github.com/HannaPrints/equium. The entire protocol is ~1000 lines of Rust. Fork it, audit it, run your own miner.",
  },
  {
    q: "When does mainnet launch?",
    a: "After an external security audit. Devnet is live now for testing. Follow @EquiumEQM on X for launch updates.",
  },
];

export function Faq() {
  return (
    <section className="relative py-28 px-6">
      <div className="max-w-3xl mx-auto">
        <SectionHeader
          kicker="FAQ"
          title="Common questions."
        />

        <div className="mt-12 space-y-2">
          {ITEMS.map((item, i) => (
            <FaqItem key={i} q={item.q} a={item.a} defaultOpen={i === 0} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FaqItem({
  q,
  a,
  defaultOpen = false,
}: {
  q: string;
  a: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)] overflow-hidden transition-colors hover:border-[var(--color-border-bright)]">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left"
      >
        <span className="text-[16px] font-semibold tracking-[-0.005em]">
          {q}
        </span>
        <span
          className={`flex-shrink-0 w-7 h-7 rounded-full border border-[var(--color-border-bright)] flex items-center justify-center transition-transform duration-300 ${
            open ? "rotate-180 bg-[var(--color-rose)] border-[var(--color-rose)]" : ""
          }`}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </button>
      <div
        className="grid transition-all duration-300"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <p className="px-6 pb-6 text-[15px] leading-[1.65] text-[var(--color-fg-dim)]">
            {a}
          </p>
        </div>
      </div>
    </div>
  );
}
