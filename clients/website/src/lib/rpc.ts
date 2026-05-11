import { Connection, PublicKey } from "@solana/web3.js";
import {
  AnchorProvider,
  Program,
  setProvider,
} from "@coral-xyz/anchor";
import idl from "../idl.json";
import { CONFIG_PDA } from "./program";

// Server-side RPC URL (full upstream URL with API key). Never sent to the
// browser; only used by server components, /api/state, /api/rpc, and OG
// image generators.
const SERVER_RPC_URL =
  process.env.SOLANA_RPC_URL ||
  process.env.HELIUS_RPC_URL ||
  process.env.NEXT_PUBLIC_RPC_URL ||
  "https://api.devnet.solana.com";

/** Client-facing RPC URL. Returns the user's override if one is stored,
 * otherwise the same-origin proxy as an absolute URL (Solana web3.js v2
 * rejects relative paths). Server-side returns the upstream URL. */
export function clientRpcUrl(): string {
  if (typeof window === "undefined") return SERVER_RPC_URL;
  try {
    const override = localStorage.getItem("equium:rpc-override");
    if (override && /^https?:\/\//.test(override)) return override;
  } catch {}
  return `${window.location.origin}/api/rpc`;
}

export const RPC_URL =
  typeof window !== "undefined" ? clientRpcUrl() : SERVER_RPC_URL;

export const CLUSTER = process.env.NEXT_PUBLIC_CLUSTER || "devnet";

export function readConnection(): Connection {
  return new Connection(SERVER_RPC_URL, "confirmed");
}

// Read-only program client. For server-side and read-only client use.
export function readProgram(connection: Connection): Program<any> {
  const dummyWallet = {
    publicKey: new PublicKey("11111111111111111111111111111112"),
    signTransaction: async (t: any) => t,
    signAllTransactions: async (t: any) => t,
  };
  const provider = new AnchorProvider(connection, dummyWallet as any, {
    commitment: "confirmed",
  });
  setProvider(provider);
  return new Program(idl as any, provider) as Program<any>;
}

export interface EquiumState {
  blockHeight: number;
  miningOpen: boolean;
  currentTargetHex: string;
  currentChallenge: string;
  epochReward: number;
  cumulativeMined: number;
  emptyRounds: number;
  equihashN: number;
  equihashK: number;
  mint: string;
  lastWinner: string;
  currentRoundOpenSlot: number;
  currentRoundOpenUnixTs: number;
  lastRetargetUnixTs: number;
  nextHalvingBlock: number;
  nextRetargetBlock: number;
}

const hex = (bytes: number[] | Uint8Array): string =>
  Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

export async function fetchState(): Promise<EquiumState | null> {
  try {
    const conn = readConnection();
    const program = readProgram(conn);
    const cfg: any = await (program.account as any).equiumConfig.fetch(CONFIG_PDA);
    return {
      blockHeight: Number(cfg.blockHeight.toString()),
      miningOpen: cfg.miningOpen,
      currentTargetHex: hex(cfg.currentTarget),
      currentChallenge: hex(cfg.currentChallenge),
      epochReward: Number(cfg.currentEpochReward.toString()),
      cumulativeMined: Number(cfg.cumulativeMined.toString()),
      emptyRounds: Number(cfg.emptyRounds.toString()),
      equihashN: cfg.equihashN,
      equihashK: cfg.equihashK,
      mint: cfg.mint.toBase58(),
      lastWinner: cfg.lastWinner.toBase58(),
      currentRoundOpenSlot: Number(cfg.currentRoundOpenSlot.toString()),
      currentRoundOpenUnixTs: Number(cfg.currentRoundOpenUnixTs.toString()),
      lastRetargetUnixTs: Number(cfg.lastRetargetUnixTs.toString()),
      nextHalvingBlock: Number(cfg.nextHalvingBlock.toString()),
      nextRetargetBlock: Number(cfg.nextRetargetBlock.toString()),
    };
  } catch (e) {
    console.error("fetchState failed", e);
    return null;
  }
}

export interface MinedBlock {
  sig: string;
  height: number;
  winner: string;
  reward: number;
  ts: number;
  newChallenge: string;
}

/**
 * Fetch recent BlockMined events by scanning the program's recent signatures.
 * Returns up to `limit` mined blocks ordered newest-first.
 */
export async function fetchRecentBlocks(limit = 12): Promise<MinedBlock[]> {
  try {
    const conn = readConnection();
    const PROGRAM_ID = new PublicKey(idl.address);
    const sigs = await conn.getSignaturesForAddress(PROGRAM_ID, {
      limit: 60,
    });
    const out: MinedBlock[] = [];
    for (const s of sigs) {
      if (s.err) continue;
      const tx = await conn.getTransaction(s.signature, {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
      });
      if (!tx) continue;
      const logs = tx.meta?.logMessages ?? [];
      const isMined = logs.some((l) => l.includes("equium: mined block"));
      if (!isMined) continue;

      // Parse height + winner from log
      const mineLog = logs.find((l) => l.includes("equium: mined block"));
      const m = mineLog?.match(/mined block (\d+) by ([\w]+) for (\d+)/);
      const height = m ? Number(m[1]) : -1;
      const winner = m ? m[2] : "";
      const reward = m ? Number(m[3]) : 0;
      out.push({
        sig: s.signature,
        height,
        winner,
        reward,
        ts: s.blockTime ?? 0,
        newChallenge: "",
      });
      if (out.length >= limit) break;
    }
    return out;
  } catch (e) {
    console.error("fetchRecentBlocks failed", e);
    return [];
  }
}

export interface LeaderboardEntry {
  miner: string;
  blocks: number;
  totalRewardBase: number;
  lastSeen: number;
  lastHeight: number;
}

/**
 * Aggregate the last N program signatures into a top-miners leaderboard.
 * Sorts by block count desc, returns up to `take` rows.
 */
export async function fetchLeaderboard(
  scan = 200,
  take = 20
): Promise<LeaderboardEntry[]> {
  const blocks = await fetchAllMinedInRange(scan);
  const map = new Map<string, LeaderboardEntry>();
  for (const b of blocks) {
    const existing = map.get(b.winner);
    if (existing) {
      existing.blocks += 1;
      existing.totalRewardBase += b.reward;
      if (b.ts > existing.lastSeen) existing.lastSeen = b.ts;
      if (b.height > existing.lastHeight) existing.lastHeight = b.height;
    } else {
      map.set(b.winner, {
        miner: b.winner,
        blocks: 1,
        totalRewardBase: b.reward,
        lastSeen: b.ts,
        lastHeight: b.height,
      });
    }
  }
  return Array.from(map.values())
    .sort((a, b) => b.blocks - a.blocks)
    .slice(0, take);
}

/** Scan up to `scan` recent program signatures and parse every mined block. */
async function fetchAllMinedInRange(scan: number): Promise<MinedBlock[]> {
  try {
    const conn = readConnection();
    const PROGRAM_ID = new PublicKey(idl.address);
    const sigs = await conn.getSignaturesForAddress(PROGRAM_ID, { limit: scan });
    const out: MinedBlock[] = [];
    const BATCH = 10;
    for (let i = 0; i < sigs.length; i += BATCH) {
      const batch = sigs.slice(i, i + BATCH).filter((s) => !s.err);
      const txs = await Promise.all(
        batch.map((s) =>
          conn.getTransaction(s.signature, {
            commitment: "confirmed",
            maxSupportedTransactionVersion: 0,
          })
        )
      );
      for (let j = 0; j < txs.length; j++) {
        const tx = txs[j];
        if (!tx) continue;
        const sig = batch[j];
        const logs = tx.meta?.logMessages ?? [];
        const mineLog = logs.find((l) => l.includes("equium: mined block"));
        if (!mineLog) continue;
        const m = mineLog.match(/mined block (\d+) by ([\w]+) for (\d+)/);
        if (!m) continue;
        out.push({
          sig: sig.signature,
          height: Number(m[1]),
          winner: m[2],
          reward: Number(m[3]),
          ts: sig.blockTime ?? 0,
          newChallenge: "",
        });
      }
    }
    return out;
  } catch (e) {
    console.error("fetchAllMinedInRange failed", e);
    return [];
  }
}

export interface HashrateSeries {
  /** Blocks mined in each 1-minute bucket, oldest → newest. */
  blocksPerMinute: number[];
  /** Bucket start timestamps (unix seconds), oldest → newest. */
  bucketTimestamps: number[];
  /** EWMA-current rate (blocks/min). */
  currentBpm: number;
  /** Window-average rate (blocks/min). */
  averageBpm: number;
  /** % change of second half vs first half of the window. */
  trendPct: number;
}

/**
 * Bucket recent mined-block timestamps into per-minute counts for charting.
 * Returns `bucketCount` minutes of data ending at "now".
 */
export async function fetchHashrateSeries(
  scan = 200,
  bucketCount = 30
): Promise<HashrateSeries> {
  const blocks = await fetchAllMinedInRange(scan);
  const nowSec = Math.floor(Date.now() / 1000);
  const lastBucketStart = Math.floor(nowSec / 60) * 60;
  const buckets: number[] = new Array(bucketCount).fill(0);
  const stamps: number[] = new Array(bucketCount).fill(0);
  for (let i = 0; i < bucketCount; i++) {
    stamps[i] = lastBucketStart - (bucketCount - 1 - i) * 60;
  }
  for (const b of blocks) {
    if (!b.ts) continue;
    const offsetMin = Math.floor((lastBucketStart - b.ts) / 60);
    if (offsetMin < 0 || offsetMin >= bucketCount) continue;
    buckets[bucketCount - 1 - offsetMin] += 1;
  }

  const sum = buckets.reduce((a, b) => a + b, 0);
  const averageBpm = sum / bucketCount;

  let weight = 0;
  let weighted = 0;
  for (let i = 0; i < buckets.length; i++) {
    const w = Math.pow(0.85, buckets.length - 1 - i);
    weighted += buckets[i] * w;
    weight += w;
  }
  const currentBpm = weight > 0 ? weighted / weight : 0;

  const half = Math.floor(bucketCount / 2);
  const firstHalf =
    buckets.slice(0, half).reduce((a, b) => a + b, 0) / Math.max(1, half);
  const secondHalf =
    buckets.slice(half).reduce((a, b) => a + b, 0) /
    Math.max(1, bucketCount - half);
  const trendPct =
    firstHalf > 0 ? ((secondHalf - firstHalf) / firstHalf) * 100 : 0;

  return {
    blocksPerMinute: buckets,
    bucketTimestamps: stamps,
    currentBpm,
    averageBpm,
    trendPct,
  };
}
