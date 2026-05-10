"use client";

import type { HashrateSeries } from "@/lib/rpc";

interface Props {
  series: HashrateSeries;
}

export function HashrateChart({ series }: Props) {
  const { blocksPerMinute, currentBpm, averageBpm, trendPct } = series;

  const trendUp = trendPct >= 0;
  const trendColor = trendUp
    ? "var(--color-mint)"
    : "var(--color-rose)";
  const trendArrow = trendUp ? "↑" : "↓";

  return (
    <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-panel)] p-7 relative overflow-hidden">
      {/* Subtle glow */}
      <div
        className="absolute -top-32 -right-32 w-96 h-96 rounded-full pointer-events-none opacity-30 blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgba(110,231,183,0.4) 0%, transparent 65%)",
        }}
      />

      <div className="relative">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--color-fg-dim)] mb-1.5 font-semibold flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-mint)] live-dot" />
              Network hashrate
            </div>
            <div className="flex items-baseline gap-3">
              <div className="text-[44px] md:text-[56px] font-black tracking-[-0.03em] leading-none text-[var(--color-mint)]">
                {currentBpm.toFixed(1)}
              </div>
              <div className="text-[14px] md:text-[16px] font-mono text-[var(--color-fg-dim)]">
                blocks / min
              </div>
              <div
                className="text-[14px] md:text-[16px] font-mono font-bold ml-2"
                style={{ color: trendColor }}
              >
                {trendArrow} {Math.abs(trendPct).toFixed(0)}%
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--color-fg-dim)] mb-1 font-semibold">
              30-min avg
            </div>
            <div className="text-[22px] font-mono font-bold">
              {averageBpm.toFixed(2)}
            </div>
            <div className="text-[10px] font-mono text-[var(--color-fg-faint)] mt-1">
              window: 30 min
            </div>
          </div>
        </div>

        {/* Sparkline */}
        <Sparkline values={blocksPerMinute} />

        {/* Axis ticks */}
        <div className="flex justify-between mt-2 text-[10px] font-mono text-[var(--color-fg-faint)] tracking-wider">
          <span>30m ago</span>
          <span>15m</span>
          <span>now</span>
        </div>
      </div>
    </div>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const W = 1000;
  const H = 120;
  const PAD = 4;

  if (values.length === 0) {
    return <div className="text-[var(--color-fg-dim)]">no data</div>;
  }

  const max = Math.max(1, ...values);
  const min = 0;
  const range = max - min || 1;

  // Build smooth cubic-bezier path
  const points = values.map((v, i) => {
    const x = PAD + (i / Math.max(1, values.length - 1)) * (W - 2 * PAD);
    const y = H - PAD - ((v - min) / range) * (H - 2 * PAD);
    return { x, y };
  });

  const linePath = points
    .map((p, i) => {
      if (i === 0) return `M ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
      const prev = points[i - 1];
      const cpx = (prev.x + p.x) / 2;
      return `Q ${prev.x.toFixed(1)} ${prev.y.toFixed(1)} ${cpx.toFixed(1)} ${(
        (prev.y + p.y) /
        2
      ).toFixed(1)} T ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
    })
    .join(" ");

  // Smoother version using monotone-ish quadratic
  let smoothPath = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    const prev = points[i - 1];
    const cx = (prev.x + p.x) / 2;
    smoothPath += ` Q ${prev.x.toFixed(1)} ${prev.y.toFixed(1)} ${cx.toFixed(
      1
    )} ${((prev.y + p.y) / 2).toFixed(1)}`;
  }
  smoothPath += ` T ${points[points.length - 1].x.toFixed(1)} ${points[
    points.length - 1
  ].y.toFixed(1)}`;

  const areaPath = `${smoothPath} L ${points[points.length - 1].x.toFixed(
    1
  )} ${H - PAD} L ${points[0].x.toFixed(1)} ${H - PAD} Z`;

  // Discard unused var
  void linePath;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="w-full h-[140px] block"
    >
      <defs>
        <linearGradient id="hr-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-mint)" stopOpacity="0.45" />
          <stop offset="100%" stopColor="var(--color-mint)" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="hr-line" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--color-mint)" />
          <stop offset="100%" stopColor="var(--color-rose)" />
        </linearGradient>
      </defs>
      {/* Grid lines */}
      {[0.25, 0.5, 0.75].map((p) => (
        <line
          key={p}
          x1={PAD}
          x2={W - PAD}
          y1={H * p}
          y2={H * p}
          stroke="var(--color-border)"
          strokeOpacity="0.5"
          strokeDasharray="2 6"
        />
      ))}
      {/* Filled area */}
      <path d={areaPath} fill="url(#hr-grad)" />
      {/* Line */}
      <path
        d={smoothPath}
        stroke="url(#hr-line)"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* End-point dot */}
      <circle
        cx={points[points.length - 1].x}
        cy={points[points.length - 1].y}
        r="5"
        fill="var(--color-mint)"
        stroke="var(--color-bg)"
        strokeWidth="2"
      />
      <circle
        cx={points[points.length - 1].x}
        cy={points[points.length - 1].y}
        r="9"
        fill="none"
        stroke="var(--color-mint)"
        strokeOpacity="0.3"
        className="live-dot"
      />
    </svg>
  );
}
