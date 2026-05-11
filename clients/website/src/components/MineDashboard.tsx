"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Connection, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getAccount, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { useWallet } from "@/lib/wallet-context";
import { detectTokenProgram, fetchConfig, getProgramAnchorlike, type EquiumConfig } from "@/lib/program";
import { startMiner, type MinerHandle } from "@/lib/miner-engine";
import { RPC_URL } from "@/lib/rpc";
import { ShareCardModal } from "./ShareCardModal";
import { WalletMenu } from "./wallet/WalletMenu";
import { SendModal } from "./wallet/SendModal";

interface LogLine {
  ts: number;
  level: "info" | "ok" | "err";
  msg: string;
}

interface SessionStats {
  blocks: number;
  earnedBase: bigint;
  cumulativeNonces: number;
  startedAt: number | null;
  tryInRound: number;
  hashrate: number;
}

const INITIAL_STATS: SessionStats = {
  blocks: 0,
  earnedBase: 0n,
  cumulativeNonces: 0,
  startedAt: null,
  tryInRound: 0,
  hashrate: 0,
};

export function MineDashboard() {
  const wallet = useWallet();
  const pubkey = wallet.loaded?.keypair.publicKey ?? null;

  // Build a Connection + Program from the wallet, but only after unlock
  const connection = useMemo(
    () => new Connection(RPC_URL, "confirmed"),
    []
  );
  const program = useMemo(
    () => (pubkey ? getProgramAnchorlike(connection, pubkey, wallet.signTransaction) : null),
    [connection, pubkey?.toBase58()]
  );

  const [config, setConfig] = useState<EquiumConfig | null>(null);
  const [solBalance, setSolBalance] = useState<number | null>(null);
  const cpuCount = useCpuCount();
  const [workerCount, setWorkerCount] = useWorkerCount(cpuCount);
  const [eqmBalance, setEqmBalance] = useState<bigint>(0n);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<
    "idle" | "solving" | "submitting" | "stopped" | "error"
  >("idle");
  const [stats, setStats] = useState<SessionStats>(INITIAL_STATS);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [shareOpen, setShareOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);

  const minerHandle = useRef<MinerHandle | null>(null);
  const logsRef = useRef<HTMLDivElement>(null);

  const log = useCallback((level: LogLine["level"], msg: string) => {
    setLogs((prev) => [...prev.slice(-200), { ts: Date.now(), level, msg }]);
  }, []);

  useEffect(() => {
    if (logsRef.current) logsRef.current.scrollTop = logsRef.current.scrollHeight;
  }, [logs.length]);

  // Fetch balances + config periodically
  useEffect(() => {
    if (!program || !pubkey) return;
    let cancelled = false;
    const refresh = async () => {
      const cfg = await fetchConfig(program);
      if (cancelled) return;
      setConfig(cfg);
      if (cfg) {
        try {
          const tokenProgram = await detectTokenProgram(connection, cfg.mint);
          const ata = getAssociatedTokenAddressSync(
            cfg.mint,
            pubkey,
            false,
            tokenProgram
          );
          const acct = await getAccount(connection, ata, "confirmed", tokenProgram);
          if (!cancelled) setEqmBalance(acct.amount);
        } catch {
          if (!cancelled) setEqmBalance(0n);
        }
      }
      try {
        const lamports = await connection.getBalance(pubkey);
        if (!cancelled) setSolBalance(lamports / LAMPORTS_PER_SOL);
      } catch {}
    };
    refresh();
    const id = setInterval(refresh, 8000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [program, pubkey?.toBase58(), connection]);

  // Recompute hashrate tick
  useEffect(() => {
    if (!running || !stats.startedAt) return;
    const id = setInterval(() => {
      setStats((s) => {
        if (!s.startedAt) return s;
        const elapsed = Math.max(0.001, (Date.now() - s.startedAt) / 1000);
        return { ...s, hashrate: s.cumulativeNonces / elapsed };
      });
    }, 500);
    return () => clearInterval(id);
  }, [running, stats.startedAt]);

  const start = () => {
    if (!program || !pubkey) {
      log("err", "Wallet not unlocked yet.");
      return;
    }
    if (solBalance !== null && solBalance < 0.01) {
      log("err", "Wallet needs SOL for tx fees. Send some SOL to this wallet first.");
      return;
    }
    setLogs([]);
    setStats({ ...INITIAL_STATS, startedAt: Date.now() });
    setRunning(true);
    setStatus("solving");
    log("info", `mining as ${shortPk(pubkey.toBase58())}`);
    minerHandle.current = startMiner({
      connection,
      program,
      miner: pubkey,
      signTransaction: wallet.signTransaction,
      workerCount,
      cb: {
        log,
        onConfig: setConfig,
        onStatus: setStatus,
        onAttempt: ({ cumulativeNonces, elapsedSec, tryNum }) => {
          setStats((s) => ({
            ...s,
            cumulativeNonces,
            hashrate: cumulativeNonces / Math.max(0.001, elapsedSec),
            tryInRound: tryNum,
          }));
        },
        onBlockMined: ({ rewardBase }) => {
          setStats((s) => ({
            ...s,
            blocks: s.blocks + 1,
            earnedBase: s.earnedBase + rewardBase,
            tryInRound: 0,
          }));
        },
      },
    });
  };

  const stop = () => {
    minerHandle.current?.stop();
    minerHandle.current = null;
    setRunning(false);
    setStatus("stopped");
    log("info", "mining stopped");
  };

  useEffect(() => () => minerHandle.current?.stop(), []);

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-[var(--color-rose)] mb-2 font-semibold flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${running ? "bg-[var(--color-mint)] live-dot" : "bg-[var(--color-fg-faint)]"}`} />
            Browser miner · Mainnet
          </div>
          <h1 className="text-[44px] md:text-[60px] font-black tracking-[-0.03em] leading-[1]">
            Mine $EQM
          </h1>
          <p className="mt-2 text-[15px] text-[var(--color-fg-dim)] max-w-xl">
            Press start. Your machine solves Equihash and earns block rewards.
            Your keys never leave this device.
          </p>
        </div>
        <WalletMenu onSendClick={() => setSendOpen(true)} />
      </div>

      <WalletPanel
        pubkey={pubkey?.toBase58() ?? null}
        solBalance={solBalance}
        eqmBalance={eqmBalance}
      />

      {/* Insufficient SOL warning */}
      {solBalance !== null && solBalance < 0.01 && (
        <FundingPanel pubkey={pubkey?.toBase58() ?? ""} />
      )}

      <LiveStats
        stats={stats}
        running={running}
        status={status}
        config={config}
      />

      <CoresPicker
        value={workerCount}
        onChange={setWorkerCount}
        max={cpuCount}
        disabled={running}
      />

      <div className="flex items-center gap-3 flex-wrap">
        {!running ? (
          <button
            onClick={start}
            disabled={!config?.miningOpen || (solBalance !== null && solBalance < 0.01)}
            className="group inline-flex items-center gap-2.5 px-7 py-4 rounded-full bg-[var(--color-rose)] text-[var(--color-bg)] text-[16px] font-bold hover:bg-[var(--color-rose-bright)] transition-all glow-rose hover:scale-[1.01] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[var(--color-rose)] disabled:hover:scale-100"
          >
            <PlayIcon />
            Start mining
          </button>
        ) : (
          <button
            onClick={stop}
            className="inline-flex items-center gap-2.5 px-7 py-4 rounded-full border-2 border-[var(--color-rose)] text-[var(--color-rose)] text-[16px] font-bold hover:bg-[var(--color-rose)] hover:text-[var(--color-bg)] transition-all"
          >
            <StopIcon />
            Stop
          </button>
        )}
        <button
          onClick={() => setShareOpen(true)}
          disabled={stats.blocks === 0 && stats.cumulativeNonces === 0}
          className="inline-flex items-center gap-2 px-5 py-4 rounded-full border border-[var(--color-border-bright)] text-[14px] font-medium text-[var(--color-fg-soft)] hover:bg-white/[0.03] hover:text-[var(--color-fg)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ShareIcon />
          Share my stats
        </button>
      </div>

      <ActivityLog logs={logs} logsRef={logsRef} />

      {shareOpen && pubkey && (
        <ShareCardModal
          onClose={() => setShareOpen(false)}
          pubkey={pubkey.toBase58()}
          stats={stats}
        />
      )}

      {pubkey && (
        <SendModal
          open={sendOpen}
          onClose={() => setSendOpen(false)}
          connection={connection}
          fromPubkey={pubkey}
          signTransaction={wallet.signTransaction}
          mint={config?.mint ?? null}
          solLamports={solBalance !== null ? solBalance * LAMPORTS_PER_SOL : null}
          eqmBase={eqmBalance}
          onSent={() => {
            // Refresh balances after a successful send.
            (async () => {
              try {
                const lamports = await connection.getBalance(pubkey);
                setSolBalance(lamports / LAMPORTS_PER_SOL);
              } catch {}
              if (config) {
                try {
                  const tokenProgram = await detectTokenProgram(
                    connection,
                    config.mint
                  );
                  const ata = getAssociatedTokenAddressSync(
                    config.mint,
                    pubkey,
                    false,
                    tokenProgram
                  );
                  const acct = await getAccount(
                    connection,
                    ata,
                    "confirmed",
                    tokenProgram
                  );
                  setEqmBalance(acct.amount);
                } catch {}
              }
            })();
          }}
        />
      )}
    </div>
  );
}

function WalletPanel({
  pubkey,
  solBalance,
  eqmBalance,
}: {
  pubkey: string | null;
  solBalance: number | null;
  eqmBalance: bigint;
}) {
  return (
    <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-bg-elev)] p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--color-fg-dim)] mb-1.5 font-semibold">
            Mining wallet
          </div>
          <div className="font-mono text-[14px] md:text-[16px] font-semibold text-[var(--color-teal)] break-all">
            {pubkey ?? "—"}
          </div>
          <div className="text-[12px] text-[var(--color-fg-dim)] mt-1">
            Block rewards land directly here. Backed by your encrypted local key.
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 md:gap-6 md:flex-shrink-0">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--color-fg-dim)] mb-0.5 font-semibold">
              SOL
            </div>
            <div className="text-[24px] font-bold text-[var(--color-fg)]">
              {solBalance !== null ? solBalance.toFixed(3) : "—"}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--color-rose)] mb-0.5 font-semibold">
              EQM
            </div>
            <div className="text-[24px] font-bold text-[var(--color-rose)]">
              {formatEqm(eqmBalance)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FundingPanel({ pubkey }: { pubkey: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (!pubkey) return;
    try {
      await navigator.clipboard.writeText(pubkey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {}
  };
  return (
    <div className="rounded-3xl border border-[var(--color-gold)]/30 bg-[var(--color-gold)]/5 p-6">
      <div className="flex items-start gap-4">
        <span className="text-[24px]">⚡</span>
        <div className="flex-1 min-w-0">
          <h3 className="text-[18px] font-bold text-[var(--color-gold)] mb-1">
            Fund your mining wallet to start
          </h3>
          <p className="text-[13px] text-[var(--color-fg-soft)] mb-3">
            Mining each block costs a fraction of a cent in SOL transaction
            fees. Send <span className="font-mono font-bold">~0.05 SOL</span>{" "}
            to the address below to mine for hours.
          </p>
          <div className="flex items-center gap-2 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border-bright)] px-3 py-2 font-mono text-[12px]">
            <span className="break-all flex-1 text-[var(--color-teal)]">
              {pubkey || "—"}
            </span>
            <button
              onClick={copy}
              className="flex-shrink-0 px-3 py-1 rounded text-[11px] font-bold bg-[var(--color-rose)] text-[var(--color-bg)] hover:bg-[var(--color-rose-bright)]"
            >
              {copied ? "✓" : "Copy"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function LiveStats({
  stats,
  running,
  status,
  config,
}: {
  stats: SessionStats;
  running: boolean;
  status: string;
  config: EquiumConfig | null;
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <BigStat
        label="Hashrate"
        value={formatHashrate(stats.hashrate)}
        accent="gold"
        live={running}
      />
      <BigStat
        label="Blocks (session)"
        value={stats.blocks.toString()}
        accent="rose"
      />
      <BigStat
        label="Earned"
        value={`${formatEqm(stats.earnedBase)} EQM`}
        accent="mint"
      />
      <BigStat
        label="Status"
        value={
          !running
            ? "IDLE"
            : status === "solving"
              ? "SOLVING"
              : status === "submitting"
                ? "SUBMITTING"
                : status.toUpperCase()
        }
        accent={running ? "teal" : "fg-dim"}
      />
      <div className="col-span-2 md:col-span-4 mt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)] px-5 py-3.5">
        <div className="flex items-center gap-4">
          <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-[var(--color-fg-dim)]">
            Round
          </div>
          <div className="font-mono font-bold text-[16px]">
            #{config ? config.blockHeight.toString() : "—"}
          </div>
          <div className="hidden sm:block w-px h-5 bg-[var(--color-border)]" />
          <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-[var(--color-fg-dim)]">
            Target
          </div>
          <div className="font-mono text-[13px]">
            {config ? `0x${toHex(config.currentTarget.slice(0, 3))}…` : "—"}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-[var(--color-fg-dim)]">
            Try
          </div>
          <div className="font-mono font-bold text-[16px]">
            #{stats.tryInRound}
          </div>
          <div className="hidden sm:block w-px h-5 bg-[var(--color-border)]" />
          <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-[var(--color-fg-dim)]">
            Nonces
          </div>
          <div className="font-mono font-bold text-[16px]">
            {stats.cumulativeNonces.toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
}

function BigStat({
  label,
  value,
  accent,
  live = false,
}: {
  label: string;
  value: string;
  accent: "rose" | "gold" | "mint" | "teal" | "fg-dim";
  live?: boolean;
}) {
  const color = {
    rose: "var(--color-rose)",
    gold: "var(--color-gold)",
    mint: "var(--color-mint)",
    teal: "var(--color-teal)",
    "fg-dim": "var(--color-fg-dim)",
  }[accent];
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)] p-5 relative overflow-hidden">
      {live && (
        <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-[var(--color-mint)] live-dot" />
      )}
      <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--color-fg-dim)] mb-2 font-semibold">
        {label}
      </div>
      <div
        className="text-[24px] md:text-[30px] font-bold tracking-[-0.02em] leading-none"
        style={{ color }}
      >
        {value}
      </div>
    </div>
  );
}

function ActivityLog({
  logs,
  logsRef,
}: {
  logs: LogLine[];
  logsRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-bg)] overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-3 border-b border-[var(--color-border)] bg-[var(--color-bg-elev)]">
        <span className="w-2 h-2 rounded-full bg-[var(--color-mint)]" />
        <span className="text-[11px] font-mono uppercase tracking-[0.18em] text-[var(--color-fg-dim)] font-semibold">
          Activity log
        </span>
      </div>
      <div
        ref={logsRef}
        className="font-mono text-[12px] leading-[1.7] p-5 h-[260px] overflow-y-auto"
      >
        {logs.length === 0 && (
          <div className="text-[var(--color-fg-faint)]">
            Press Start mining to begin.
          </div>
        )}
        {logs.map((l, i) => (
          <div
            key={i}
            className={
              l.level === "ok"
                ? "text-[var(--color-mint)]"
                : l.level === "err"
                  ? "text-[var(--color-rose)]"
                  : "text-[var(--color-fg-soft)]"
            }
          >
            <span className="text-[var(--color-fg-faint)] mr-3">
              {new Date(l.ts).toLocaleTimeString()}
            </span>
            {l.msg}
          </div>
        ))}
      </div>
    </div>
  );
}

function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}
function StopIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="6" width="12" height="12" rx="1.5" />
    </svg>
  );
}
function ShareIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" x2="12" y1="2" y2="15" />
    </svg>
  );
}

function shortPk(s: string): string {
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
}
function toHex(b: Uint8Array): string {
  return Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");
}
function formatEqm(base: bigint): string {
  const whole = base / 1_000_000n;
  const frac = base % 1_000_000n;
  if (frac === 0n) return whole.toString();
  const fracStr = frac.toString().padStart(6, "0").replace(/0+$/, "");
  return `${whole}.${fracStr.slice(0, 4)}`;
}
function formatHashrate(h: number): string {
  if (h >= 1000) return `${(h / 1000).toFixed(2)} kH/s`;
  return `${h.toFixed(2)} H/s`;
}

const WORKER_COUNT_KEY = "equium:browser-workers";

/** Reports the number of logical CPUs the browser exposes. Returns 0 until
 * mount finishes (SSR has no `navigator`). */
function useCpuCount(): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    const hw =
      typeof navigator !== "undefined" && navigator.hardwareConcurrency
        ? navigator.hardwareConcurrency
        : 4;
    setN(hw);
  }, []);
  return n;
}

/** Persisted worker-count selection. Defaults to `max - 1` (leave one core
 * for the OS / UI). Clamps to [1, max]. */
function useWorkerCount(max: number): [number, (n: number) => void] {
  const [n, setN] = useState(1);
  // Initialize from localStorage once we know max
  useEffect(() => {
    if (max === 0) return;
    try {
      const raw = localStorage.getItem(WORKER_COUNT_KEY);
      const stored = raw ? Number.parseInt(raw, 10) : NaN;
      const initial =
        Number.isFinite(stored) && stored >= 1
          ? Math.min(stored, max)
          : Math.max(1, max - 1);
      setN(initial);
    } catch {
      setN(Math.max(1, max - 1));
    }
  }, [max]);
  const set = useCallback(
    (next: number) => {
      const clamped = Math.max(1, Math.min(max || next, next));
      setN(clamped);
      try {
        localStorage.setItem(WORKER_COUNT_KEY, String(clamped));
      } catch {}
    },
    [max]
  );
  return [n, set];
}

function CoresPicker({
  value,
  onChange,
  max,
  disabled,
}: {
  value: number;
  onChange: (n: number) => void;
  max: number;
  disabled: boolean;
}) {
  if (max === 0) return null;
  const pct = max > 1 ? ((value - 1) / (max - 1)) * 100 : 100;
  return (
    <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-bg-elev)] p-5 md:p-6">
      <div className="flex items-start md:items-center justify-between gap-4 flex-col md:flex-row">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--color-fg-dim)] mb-1 font-semibold">
            CPU cores
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-[28px] font-bold leading-none">{value}</span>
            <span className="text-[14px] text-[var(--color-fg-dim)]">
              of {max} available
            </span>
          </div>
          <div className="text-[12px] text-[var(--color-fg-dim)] mt-1.5 max-w-md">
            More cores = faster mining, but your machine will get warmer and other
            apps may feel sluggish. Default leaves one core free for the OS.
            {disabled && (
              <span className="block text-[var(--color-gold)] mt-1">
                Stop mining to change this.
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto md:flex-shrink-0">
          <button
            onClick={() => onChange(value - 1)}
            disabled={disabled || value <= 1}
            className="w-10 h-10 rounded-full border border-[var(--color-border-bright)] flex items-center justify-center text-[20px] font-bold hover:bg-white/[0.04] disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Use fewer cores"
          >
            −
          </button>
          <div className="flex-1 md:w-48 h-2 rounded-full bg-[var(--color-bg)] border border-[var(--color-border)] overflow-hidden">
            <div
              className="h-full bg-[var(--color-rose)] transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <button
            onClick={() => onChange(value + 1)}
            disabled={disabled || value >= max}
            className="w-10 h-10 rounded-full border border-[var(--color-border-bright)] flex items-center justify-center text-[20px] font-bold hover:bg-white/[0.04] disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Use more cores"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}
