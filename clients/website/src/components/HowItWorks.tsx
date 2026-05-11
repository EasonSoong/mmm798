export function HowItWorks() {
  return (
    <section id="how" className="relative py-28 px-6">
      <div className="max-w-5xl mx-auto">
        <SectionHeader
          kicker="How it works"
          title="Proof-of-work, returned to the people."
          sub="Equihash is memory-bound, not compute-bound. A $40k GPU farm doesn't beat your CPU. Anyone with a machine can compete — exactly how Bitcoin felt in 2010."
        />

        <div className="mt-16 grid md:grid-cols-3 gap-4">
          <StepCard
            num="01"
            title="Generate"
            body="Your computer hashes random nonces against the current network challenge. Each nonce + the current block target is a fresh shot at the lottery."
          />
          <StepCard
            num="02"
            title="Solve"
            body="When a nonce produces a hash under the difficulty target, you've found an Equihash solution. The puzzle includes your wallet, so nobody can front-run it."
            highlight
          />
          <StepCard
            num="03"
            title="Earn"
            body="Submit the solution as a Solana transaction. The on-chain program verifies it and transfers 25 EQM directly into your wallet. ~1 minute block time."
          />
        </div>

        {/* Difficulty + halving callout */}
        <div className="mt-6 grid md:grid-cols-2 gap-4">
          <InfoCallout
            kicker="Difficulty"
            title="Auto-retargets every hour."
            body="Every 60 blocks, the network measures actual elapsed time vs target (~60 min) and tightens or loosens difficulty within a [0.5×, 2×] clamp. Identical convention to Bitcoin — sharper damping for the smaller window."
          />
          <InfoCallout
            kicker="Halving"
            title="Block reward halves every ~8.6 months."
            body="Starting at 25 EQM per block, the reward drops to 12.5 → 6.25 → … forever. Same emission curve as Bitcoin, mapped to ~1-minute blocks. 99% of supply is mined in the first decade."
          />
        </div>
      </div>
    </section>
  );
}

function StepCard({
  num,
  title,
  body,
  highlight = false,
}: {
  num: string;
  title: string;
  body: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`relative rounded-3xl p-7 border transition-colors ${
        highlight
          ? "bg-[var(--color-panel-2)] border-[var(--color-rose-soft)]"
          : "bg-[var(--color-panel)] border-[var(--color-border)] hover:border-[var(--color-border-bright)]"
      }`}
    >
      {highlight && (
        <div
          className="absolute inset-0 rounded-3xl pointer-events-none opacity-30"
          style={{
            background:
              "radial-gradient(circle at top right, rgba(232,90,141,0.18), transparent 50%)",
          }}
        />
      )}
      <div className="relative">
        <div className="flex items-center justify-between mb-5">
          <span className="text-[10px] font-mono font-bold tracking-[0.2em] text-[var(--color-fg-dim)]">
            {num}
          </span>
          {highlight && (
            <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--color-rose)] px-2 py-0.5 rounded-full border border-[var(--color-rose-soft)] bg-[var(--color-rose-soft)]/40">
              the work
            </span>
          )}
        </div>
        <h3 className="text-[26px] font-bold tracking-[-0.02em] mb-2.5">
          {title}
        </h3>
        <p className="text-[15px] leading-[1.6] text-[var(--color-fg-dim)]">
          {body}
        </p>
      </div>
    </div>
  );
}

function InfoCallout({
  kicker,
  title,
  body,
}: {
  kicker: string;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-3xl p-7 border border-[var(--color-border)] bg-[var(--color-bg-elev)]">
      <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--color-rose)] mb-3 font-semibold">
        {kicker}
      </div>
      <h4 className="text-[22px] font-bold tracking-[-0.02em] mb-2.5">
        {title}
      </h4>
      <p className="text-[14px] leading-[1.65] text-[var(--color-fg-dim)]">
        {body}
      </p>
    </div>
  );
}

export function SectionHeader({
  kicker,
  title,
  sub,
}: {
  kicker: string;
  title: string;
  sub?: string;
}) {
  return (
    <div className="max-w-3xl">
      <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-[var(--color-rose)] mb-5 font-semibold">
        — {kicker} —
      </div>
      <h2 className="text-[44px] md:text-[60px] font-black tracking-[-0.03em] leading-[1.02] text-balance mb-5">
        {title}
      </h2>
      {sub && (
        <p className="text-[17px] md:text-[19px] leading-[1.55] text-[var(--color-fg-dim)] text-balance">
          {sub}
        </p>
      )}
    </div>
  );
}
