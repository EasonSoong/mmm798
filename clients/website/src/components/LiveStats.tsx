"use client";

// Compact marquee strip showing live-ish stats. Real values would come from
// an RPC poll in production; for now these render with placeholder data and
// can be wired up via the explorer's data layer later.

const STATS = [
  { label: "Block height", value: "9" },
  { label: "Current target", value: "0x40FF…" },
  { label: "Epoch reward", value: "25 EQM" },
  { label: "Mineable left", value: "18,899,775" },
  { label: "Network status", value: "OPEN" },
  { label: "Empty rounds", value: "0" },
];

export function LiveStats() {
  return (
    <section className="relative border-y border-[var(--color-border)] bg-[var(--color-bg-elev)] overflow-hidden py-4">
      <div className="absolute left-0 top-0 bottom-0 w-24 pointer-events-none z-10 bg-gradient-to-r from-[var(--color-bg-elev)] to-transparent" />
      <div className="absolute right-0 top-0 bottom-0 w-24 pointer-events-none z-10 bg-gradient-to-l from-[var(--color-bg-elev)] to-transparent" />

      <div className="flex marquee whitespace-nowrap">
        {[...STATS, ...STATS, ...STATS].map((s, i) => (
          <span key={i} className="inline-flex items-center gap-3 px-7">
            <span className="w-1 h-1 rounded-full bg-[var(--color-rose)]" />
            <span className="text-[11px] font-mono uppercase tracking-[0.18em] text-[var(--color-fg-dim)]">
              {s.label}
            </span>
            <span className="text-[13px] font-mono font-semibold text-[var(--color-fg)]">
              {s.value}
            </span>
          </span>
        ))}
      </div>
    </section>
  );
}
