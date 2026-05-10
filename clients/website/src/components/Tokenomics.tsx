import { SectionHeader } from "./HowItWorks";

export function Tokenomics() {
  return (
    <section id="tokenomics" className="relative py-28 px-6">
      <div className="max-w-5xl mx-auto">
        <SectionHeader
          kicker="Tokenomics"
          title="No presale. No allocation. No farm."
          sub="The 21M supply splits into a 10% premine for DEX liquidity and a 90% pool that's mined block-by-block, just like Bitcoin. Mint authority is revoked at launch — the cap is structural, not a promise."
        />

        <div className="mt-16 grid md:grid-cols-12 gap-4">
          {/* Big card: supply breakdown */}
          <div className="md:col-span-7 rounded-3xl border border-[var(--color-border)] bg-[var(--color-panel)] p-8 relative overflow-hidden">
            <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full opacity-20 blur-3xl pointer-events-none"
              style={{ background: "radial-gradient(circle, rgba(232,90,141,0.5), transparent 60%)" }} />
            <div className="relative">
              <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-[var(--color-fg-dim)] mb-3 font-semibold">
                Supply split
              </div>
              <div className="text-[78px] md:text-[96px] font-black tracking-[-0.04em] leading-none mb-5">
                21,000,000
                <span className="text-[28px] text-[var(--color-fg-dim)] ml-3 font-normal">
                  EQM
                </span>
              </div>

              {/* Visual bar */}
              <div className="h-3 rounded-full bg-[var(--color-bg)] overflow-hidden flex mb-3">
                <div className="bg-[var(--color-fg-faint)] h-full" style={{ width: "10%" }} />
                <div className="bg-[var(--color-rose)] h-full" style={{ width: "90%" }} />
              </div>
              <div className="grid grid-cols-2 gap-x-6 text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[var(--color-fg-faint)]" />
                  <span className="text-[var(--color-fg-dim)]">Premine</span>
                  <span className="font-mono text-[var(--color-fg)] ml-auto font-semibold">
                    2.1M
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[var(--color-rose)]" />
                  <span className="text-[var(--color-fg-dim)]">Mineable</span>
                  <span className="font-mono text-[var(--color-fg)] ml-auto font-semibold">
                    18.9M
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Halving curve */}
          <div className="md:col-span-5 rounded-3xl border border-[var(--color-border)] bg-[var(--color-panel)] p-8">
            <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-[var(--color-gold)] mb-3 font-semibold">
              Emission curve
            </div>
            <div className="text-[36px] font-black tracking-[-0.02em] mb-1">
              Halving forever
            </div>
            <p className="text-[13px] text-[var(--color-fg-dim)] mb-6">
              Same curve as Bitcoin, ~8.6 months between halvings at 1-min blocks.
            </p>

            {/* Mini halving table */}
            <div className="space-y-2 font-mono text-[13px]">
              {[
                { era: "Era 1", reward: "25 EQM", year: "Year 0" },
                { era: "Era 2", reward: "12.5 EQM", year: "Year ~0.7" },
                { era: "Era 3", reward: "6.25 EQM", year: "Year ~1.4" },
                { era: "Era 4", reward: "3.125 EQM", year: "Year ~2.1" },
                { era: "…", reward: "→ 0", year: "asymptotic", dim: true },
              ].map((row) => (
                <div
                  key={row.era}
                  className={`flex items-center justify-between py-1.5 ${
                    row.dim ? "text-[var(--color-fg-faint)]" : ""
                  }`}
                >
                  <span className="text-[var(--color-fg-dim)]">{row.era}</span>
                  <span className={row.dim ? "" : "text-[var(--color-fg)]"}>
                    {row.reward}
                  </span>
                  <span className="text-[11px] text-[var(--color-fg-dim)]">
                    {row.year}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Small property cards */}
          <Prop
            title="Hard cap is structural."
            body="Mint authority is revoked at launch. No future inflation is possible — enforced at the SPL Token level, not just program logic."
          />
          <Prop
            title="No team allocation."
            body="The 10% premine is reserved for DEX liquidity and operational costs. No founder tokens. No team vesting."
          />
          <Prop
            title="Empty rounds, real burn."
            body="If a round closes without a winner, the unminted reward stays in the program vault permanently. No IOUs against future blocks."
          />
        </div>
      </div>
    </section>
  );
}

function Prop({ title, body }: { title: string; body: string }) {
  return (
    <div className="md:col-span-4 rounded-3xl border border-[var(--color-border)] bg-[var(--color-bg-elev)] p-6">
      <h4 className="text-[18px] font-bold tracking-[-0.01em] mb-2">{title}</h4>
      <p className="text-[14px] leading-[1.55] text-[var(--color-fg-dim)]">
        {body}
      </p>
    </div>
  );
}
