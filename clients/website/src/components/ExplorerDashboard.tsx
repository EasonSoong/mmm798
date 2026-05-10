"use client";

import { useEffect, useState } from "react";
import type {
  EquiumState,
  MinedBlock,
  LeaderboardEntry,
  HashrateSeries,
} from "@/lib/rpc";
import { HashrateChart } from "./HashrateChart";

interface Props {
  initialState: EquiumState | null;
  initialBlocks: MinedBlock[];
  initialLeaderboard: LeaderboardEntry[];
  initialSeries: HashrateSeries;
}

type Tab = "blocks" | "leaderboard";

export function ExplorerDashboard({
  initialState,
  initialBlocks,
  initialLeaderboard,
  initialSeries,
}: Props) {
  const [state, setState] = useState<EquiumState | null>(initialState);
  const [blocks, setBlocks] = useState<MinedBlock[]>(initialBlocks);
  const [leaderboard, setLeaderboard] =
    useState<LeaderboardEntry[]>(initialLeaderboard);
  const [series, setSeries] = useState<HashrateSeries>(initialSeries);
  const [tab, setTab] = useState<Tab>("blocks");
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now());

  // Poll for fresh data every 10 seconds
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch("/api/state");
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        if (data.state) setState(data.state);
        if (data.blocks) setBlocks(data.blocks);
        if (data.leaderboard) setLeaderboard(data.leaderboard);
        if (data.series) setSeries(data.series);
        setLastUpdated(Date.now());
      } catch {}
    };
    const id = setInterval(tick, 10_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (!state) {
    return (
      <div className="text-center py-32">
        <p className="text-[var(--color-fg-dim)]">
          Couldn't reach the network. Try again in a few seconds.
        </p>
      </div>
    );
  }

  const MINEABLE = 18_900_000 * 1_000_000;
  const minedPct = (state.cumulativeMined / MINEABLE) * 100;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-[var(--color-rose)] mb-2 font-semibold flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-mint)] live-dot" />
            — Live · Devnet —
          </div>
          <h1 className="text-[44px] md:text-[60px] font-black tracking-[-0.03em] leading-[1]">
            Explorer
          </h1>
          <p className="mt-2 text-[15px] text-[var(--color-fg-dim)]">
            Real-time state of the Equium protocol.
          </p>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-mono text-[var(--color-fg-dim)]">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-mint)]" />
          Updated {formatRelative(lastUpdated)}
        </div>
      </div>

      {/* Top stat grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Block height"
          value={state.blockHeight.toLocaleString()}
          accent="rose"
        />
        <StatCard
          label="Epoch reward"
          value={`${formatEqm(state.epochReward)} EQM`}
          accent="gold"
        />
        <StatCard
          label="Empty rounds"
          value={state.emptyRounds.toLocaleString()}
          accent="teal"
        />
        <StatCard
          label="Status"
          value={state.miningOpen ? "OPEN" : "CLOSED"}
          accent={state.miningOpen ? "mint" : "fg-dim"}
        />
      </div>

      {/* Hashrate chart */}
      <HashrateChart series={series} />

      {/* Two-column: difficulty + supply */}
      <div className="grid md:grid-cols-2 gap-3">
        {/* Difficulty */}
        <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-panel)] p-7">
          <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--color-fg-dim)] mb-3 font-semibold">
            Current target
          </div>
          <div className="text-[18px] font-mono break-all leading-snug text-[var(--color-fg)]">
            <span className="text-[var(--color-rose)] font-bold">0x</span>
            {state.currentTargetHex}
          </div>
          <div className="mt-5 flex items-end justify-between">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--color-fg-dim)] mb-1">
                Next retarget
              </div>
              <div className="text-[26px] font-bold tracking-[-0.02em]">
                block #{state.nextRetargetBlock.toLocaleString()}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--color-fg-dim)] mb-1">
                Equihash params
              </div>
              <div className="text-[18px] font-mono font-semibold">
                ({state.equihashN}, {state.equihashK})
              </div>
            </div>
          </div>
        </div>

        {/* Supply */}
        <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-panel)] p-7">
          <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--color-fg-dim)] mb-3 font-semibold">
            Mined so far
          </div>
          <div className="text-[36px] md:text-[40px] font-black tracking-[-0.03em] leading-none mb-1">
            {formatEqm(state.cumulativeMined)}
            <span className="text-[18px] text-[var(--color-fg-dim)] ml-2 font-normal">
              / 18.9M EQM
            </span>
          </div>
          <div className="text-[12px] font-mono text-[var(--color-fg-dim)] mt-1">
            {minedPct.toFixed(4)}% of mineable supply
          </div>

          <div className="mt-5 h-2.5 rounded-full bg-[var(--color-bg)] overflow-hidden">
            <div
              className="h-full bg-[var(--color-rose)] transition-all duration-700"
              style={{ width: `${Math.max(minedPct, 0.5)}%` }}
            />
          </div>

          <div className="mt-5 flex items-end justify-between">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--color-fg-dim)] mb-1">
                Next halving
              </div>
              <div className="text-[26px] font-bold tracking-[-0.02em]">
                block #{state.nextHalvingBlock.toLocaleString()}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--color-fg-dim)] mb-1">
                Then reward
              </div>
              <div className="text-[18px] font-mono font-semibold">
                {formatEqm(state.epochReward / 2)} EQM
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabbed section: Recent blocks / Leaderboard */}
      <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-panel)] overflow-hidden">
        <div className="flex items-center justify-between px-7 py-5 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-1 rounded-full bg-[var(--color-bg)] border border-[var(--color-border)] p-1">
            <button
              onClick={() => setTab("blocks")}
              className={`px-4 py-1.5 rounded-full text-[13px] font-semibold transition-colors ${
                tab === "blocks"
                  ? "bg-[var(--color-rose)] text-[var(--color-bg)]"
                  : "text-[var(--color-fg-dim)] hover:text-[var(--color-fg)]"
              }`}
            >
              Recent blocks
            </button>
            <button
              onClick={() => setTab("leaderboard")}
              className={`px-4 py-1.5 rounded-full text-[13px] font-semibold transition-colors ${
                tab === "leaderboard"
                  ? "bg-[var(--color-rose)] text-[var(--color-bg)]"
                  : "text-[var(--color-fg-dim)] hover:text-[var(--color-fg)]"
              }`}
            >
              Top miners
            </button>
          </div>
          <span className="text-[11px] font-mono text-[var(--color-fg-dim)]">
            {tab === "blocks"
              ? `showing ${blocks.length}`
              : `${leaderboard.length} miners`}
          </span>
        </div>

        {tab === "leaderboard" ? (
          <LeaderboardList rows={leaderboard} />
        ) : blocks.length === 0 ? (
          <div className="text-center py-16 text-[var(--color-fg-dim)]">
            No blocks mined yet — be the first.
          </div>
        ) : (
          <div className="divide-y divide-[var(--color-border)]">
            {blocks.map((b) => (
              <div
                key={b.sig}
                className="px-7 py-5 grid grid-cols-12 gap-4 items-center hover:bg-[var(--color-bg-elev)]/50 transition-colors"
              >
                <div className="col-span-2 md:col-span-1">
                  <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--color-fg-dim)] mb-0.5">
                    Block
                  </div>
                  <div className="text-[18px] font-mono font-bold text-[var(--color-rose)]">
                    #{b.height}
                  </div>
                </div>
                <div className="col-span-4 md:col-span-4">
                  <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--color-fg-dim)] mb-0.5">
                    Miner
                  </div>
                  <a
                    href={`https://explorer.solana.com/address/${b.winner}?cluster=devnet`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[13px] font-mono text-[var(--color-teal)] hover:text-[var(--color-rose)] transition-colors"
                  >
                    {shortPk(b.winner)}
                  </a>
                </div>
                <div className="col-span-3 md:col-span-2">
                  <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--color-fg-dim)] mb-0.5">
                    Reward
                  </div>
                  <div className="text-[14px] font-mono font-bold text-[var(--color-gold)]">
                    +{formatEqm(b.reward)} EQM
                  </div>
                </div>
                <div className="col-span-3 md:col-span-2">
                  <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--color-fg-dim)] mb-0.5">
                    Mined
                  </div>
                  <div className="text-[13px] text-[var(--color-fg-soft)]">
                    {formatRelative(b.ts * 1000)}
                  </div>
                </div>
                <div className="col-span-12 md:col-span-3 text-left md:text-right">
                  <a
                    href={`https://explorer.solana.com/tx/${b.sig}?cluster=devnet`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-[11px] font-mono text-[var(--color-fg-dim)] hover:text-[var(--color-rose)] transition-colors"
                  >
                    {shortSig(b.sig)}
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M7 17 17 7" />
                      <path d="M7 7h10v10" />
                    </svg>
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Protocol addresses */}
      <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-bg-elev)] p-7">
        <h3 className="text-[14px] font-bold mb-4">Protocol addresses</h3>
        <div className="grid md:grid-cols-2 gap-x-8 gap-y-2.5 font-mono text-[12px]">
          <AddrRow label="Program" value="ZKGMUfxiRCXFPnqz9zgqAnuqJy15jk7fKbR4o6FuEQM" />
          <AddrRow label="Mint" value={state.mint} />
          <AddrRow label="Cluster" value="devnet" />
          <AddrRow label="PoW" value={`Equihash (${state.equihashN}, ${state.equihashK})`} />
        </div>
      </div>
    </div>
  );
}

function AddrRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="text-[var(--color-fg-dim)] w-16 flex-shrink-0">
        {label}
      </span>
      <span className="text-[var(--color-fg-soft)] break-all">{value}</span>
    </div>
  );
}

function LeaderboardList({ rows }: { rows: LeaderboardEntry[] }) {
  if (rows.length === 0) {
    return (
      <div className="text-center py-16 text-[var(--color-fg-dim)]">
        No miners yet — be the first.
      </div>
    );
  }

  const maxBlocks = Math.max(...rows.map((r) => r.blocks));
  const medalFor = (i: number) =>
    i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null;

  return (
    <div className="divide-y divide-[var(--color-border)]">
      {rows.map((row, i) => {
        const medal = medalFor(i);
        const widthPct = (row.blocks / maxBlocks) * 100;
        return (
          <div
            key={row.miner}
            className="px-7 py-5 grid grid-cols-12 gap-4 items-center hover:bg-[var(--color-bg-elev)]/50 transition-colors"
          >
            {/* Rank */}
            <div className="col-span-2 md:col-span-1 flex items-center gap-2">
              <span
                className={`text-[18px] font-mono font-bold ${
                  i === 0
                    ? "text-[var(--color-gold)]"
                    : i === 1
                      ? "text-[var(--color-fg-soft)]"
                      : i === 2
                        ? "text-[var(--color-rose)]"
                        : "text-[var(--color-fg-dim)]"
                }`}
              >
                #{i + 1}
              </span>
              {medal && <span className="text-[18px]">{medal}</span>}
            </div>

            {/* Miner */}
            <div className="col-span-10 md:col-span-4">
              <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--color-fg-dim)] mb-0.5">
                Miner
              </div>
              <a
                href={`https://explorer.solana.com/address/${row.miner}?cluster=devnet`}
                target="_blank"
                rel="noreferrer"
                className="text-[13px] font-mono text-[var(--color-teal)] hover:text-[var(--color-rose)] transition-colors break-all"
              >
                {shortPk(row.miner)}
              </a>
            </div>

            {/* Blocks bar */}
            <div className="col-span-6 md:col-span-3">
              <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--color-fg-dim)] mb-0.5">
                Blocks
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[18px] font-mono font-bold text-[var(--color-rose)]">
                  {row.blocks}
                </span>
                <div className="flex-1 h-1.5 rounded-full bg-[var(--color-bg)] overflow-hidden ml-2">
                  <div
                    className="h-full rounded-full bg-[var(--color-rose)] transition-all"
                    style={{ width: `${Math.max(widthPct, 4)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* EQM total */}
            <div className="col-span-3 md:col-span-2">
              <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--color-fg-dim)] mb-0.5">
                Earned
              </div>
              <div className="text-[14px] font-mono font-bold text-[var(--color-gold)]">
                {formatEqm(row.totalRewardBase)} EQM
              </div>
            </div>

            {/* Last seen */}
            <div className="col-span-3 md:col-span-2 text-right">
              <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--color-fg-dim)] mb-0.5">
                Last block
              </div>
              <div className="text-[13px] text-[var(--color-fg-soft)]">
                #{row.lastHeight}
              </div>
              <div className="text-[11px] text-[var(--color-fg-dim)]">
                {formatRelative(row.lastSeen * 1000)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: "rose" | "gold" | "mint" | "teal" | "fg-dim";
}) {
  const color = {
    rose: "var(--color-rose)",
    gold: "var(--color-gold)",
    mint: "var(--color-mint)",
    teal: "var(--color-teal)",
    "fg-dim": "var(--color-fg-dim)",
  }[accent];
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)] p-5">
      <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--color-fg-dim)] mb-2 font-semibold">
        {label}
      </div>
      <div
        className="text-[28px] md:text-[32px] font-bold tracking-[-0.02em] leading-none"
        style={{ color }}
      >
        {value}
      </div>
    </div>
  );
}

function formatEqm(baseUnits: number): string {
  const eqm = baseUnits / 1_000_000;
  if (eqm < 1000) return eqm.toFixed(2).replace(/\.?0+$/, "");
  return eqm.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function shortPk(pk: string): string {
  if (!pk || pk === "11111111111111111111111111111111") return "—";
  return `${pk.slice(0, 4)}…${pk.slice(-4)}`;
}

function shortSig(s: string): string {
  return `${s.slice(0, 6)}…${s.slice(-6)}`;
}

function formatRelative(ms: number): string {
  const diff = Math.max(0, Date.now() - ms);
  const sec = Math.floor(diff / 1000);
  if (sec < 5) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
}
