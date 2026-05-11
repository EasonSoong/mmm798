// Mining engine: orchestrates a pool of Web Worker Equihash solvers + RPC
// reads + transaction signing/submitting. Designed for the browser miner UI;
// the CLI miner in Rust does the same work via solana-client.
//
// Parallelism: spawns N workers (N = hardware concurrency - 1, capped). Each
// worker runs an independent solve loop with its own random seed; whenever one
// finds a below-target solution, the main loop submits it. This gives a near-
// linear speedup vs a single worker on multi-core machines.

import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import { Program } from "@coral-xyz/anchor";
import {
  buildMineTx,
  detectTokenProgram,
  fetchConfig,
  hashUnderTarget,
  type EquiumConfig,
} from "./program";

export interface MinerCallbacks {
  log: (level: "info" | "ok" | "err", msg: string) => void;
  onConfig: (cfg: EquiumConfig) => void;
  onAttempt: (info: {
    tryNum: number;
    aboveTarget: boolean;
    solveMs: number;
    cumulativeNonces: number;
    elapsedSec: number;
  }) => void;
  onBlockMined: (info: {
    height: bigint;
    sig: string;
    rewardBase: bigint;
  }) => void;
  onStatus: (
    s: "idle" | "solving" | "submitting" | "stopped" | "error"
  ) => void;
}

export interface MinerOptions {
  connection: Connection;
  program: Program<any>;
  miner: PublicKey;
  signTransaction: (tx: Transaction) => Promise<Transaction>;
  cb: MinerCallbacks;
  /** Override worker count. Defaults to hardwareConcurrency - 1, capped to 8. */
  workerCount?: number;
}

export interface MinerHandle {
  stop: () => void;
}

interface SolveResponse {
  type: "solved" | "no-solution" | "error";
  jobId: number;
  nonce?: Uint8Array;
  solnIndices?: Uint8Array;
  attempts?: number;
  solveMs?: number;
  message?: string;
}

interface SolverSlot {
  worker: Worker;
  busy: boolean;
}

const DEFAULT_MAX_WORKERS = 8;

function pickWorkerCount(override?: number): number {
  if (override && override > 0) return Math.min(override, 16);
  const hw =
    typeof navigator !== "undefined" && navigator.hardwareConcurrency
      ? navigator.hardwareConcurrency
      : 4;
  return Math.max(1, Math.min(hw - 1, DEFAULT_MAX_WORKERS));
}

export function startMiner(opts: MinerOptions): MinerHandle {
  const { connection, program, miner, signTransaction, cb } = opts;
  const workerCount = pickWorkerCount(opts.workerCount);
  let stopped = false;
  let nextJobId = 1;
  let tokenProgramCache: PublicKey | null = null;
  let cumulativeNonces = 0;
  let tryInRound = 0;
  let currentConfig: EquiumConfig | null = null;
  let submitting = false;
  const startedAt = Date.now();

  const slots: SolverSlot[] = Array.from({ length: workerCount }, () => ({
    worker: new Worker("/wasm/miner.worker.js", { type: "module" }),
    busy: false,
  }));

  cb.log(
    "info",
    `solver pool: ${workerCount} worker${workerCount === 1 ? "" : "s"}`
  );

  const stop = () => {
    stopped = true;
    for (const slot of slots) {
      slot.worker.terminate();
    }
    cb.onStatus("stopped");
  };

  /** Dispatch a single solve job to a specific worker. The handler runs the
   * full lifecycle: receive → target-check → maybe submit → re-dispatch.  */
  const dispatchTo = (slot: SolverSlot, cfg: EquiumConfig) => {
    if (stopped) return;
    slot.busy = true;

    const seed = new Uint8Array(32);
    crypto.getRandomValues(seed);
    const jobId = nextJobId++;

    const onMessage = async (e: MessageEvent<SolveResponse>) => {
      if (e.data.jobId !== jobId) return;
      slot.worker.removeEventListener("message", onMessage);
      slot.busy = false;
      if (stopped) return;

      const resp = e.data;

      if (resp.type === "error") {
        cb.log("err", `solver error: ${resp.message}`);
        // Re-dispatch after a brief pause to avoid a tight error loop.
        setTimeout(() => {
          if (!stopped && currentConfig) dispatchTo(slot, currentConfig);
        }, 1000);
        return;
      }

      const attempts = resp.attempts ?? 1;
      cumulativeNonces += attempts;
      const elapsedSec = (Date.now() - startedAt) / 1000;

      if (resp.type === "no-solution") {
        cb.onAttempt({
          tryNum: tryInRound,
          aboveTarget: true,
          solveMs: resp.solveMs ?? 0,
          cumulativeNonces,
          elapsedSec,
        });
        if (!stopped && currentConfig) dispatchTo(slot, currentConfig);
        return;
      }

      // Off-chain target check
      const inputBlock = buildInputBlock(
        cfg.currentChallenge,
        miner.toBytes(),
        cfg.blockHeight
      );
      const candHash = await sha256(
        concatBytes(resp.solnIndices!, inputBlock)
      );
      const aboveTarget = !hashUnderTarget(candHash, cfg.currentTarget);

      tryInRound += 1;
      cb.onAttempt({
        tryNum: tryInRound,
        aboveTarget,
        solveMs: resp.solveMs ?? 0,
        cumulativeNonces,
        elapsedSec,
      });

      if (aboveTarget) {
        if (!stopped && currentConfig) dispatchTo(slot, currentConfig);
        return;
      }

      // Below target — submit if no other worker is mid-submit for this round.
      if (submitting) {
        // Another worker already won this round; re-dispatch for the next.
        if (!stopped && currentConfig) dispatchTo(slot, currentConfig);
        return;
      }
      submitting = true;
      cb.onStatus("submitting");
      try {
        if (!tokenProgramCache) {
          tokenProgramCache = await detectTokenProgram(connection, cfg.mint);
        }
        const tx = await buildMineTx({
          program,
          miner,
          mint: cfg.mint,
          tokenProgram: tokenProgramCache,
          nonce: resp.nonce!,
          solnIndices: resp.solnIndices!,
        });
        const recent = await connection.getLatestBlockhash("confirmed");
        tx.recentBlockhash = recent.blockhash;
        tx.feePayer = miner;
        const signed = await signTransaction(tx);
        const sig = await connection.sendRawTransaction(signed.serialize(), {
          skipPreflight: true,
        });
        await connection.confirmTransaction(
          { signature: sig, ...recent },
          "confirmed"
        );
        cb.onBlockMined({
          height: cfg.blockHeight,
          sig,
          rewardBase: cfg.currentEpochReward,
        });
        cb.log(
          "ok",
          `mined block ${cfg.blockHeight.toString()} (+${formatBase(cfg.currentEpochReward)} EQM)`
        );
      } catch (e: any) {
        const msg = String(e?.message ?? e);
        cb.log("err", `submit failed: ${truncate(msg, 110)}`);
        await sleep(600);
      } finally {
        submitting = false;
        cb.onStatus("solving");
        if (!stopped && currentConfig) dispatchTo(slot, currentConfig);
      }
    };

    slot.worker.addEventListener("message", onMessage);
    slot.worker.postMessage({
      type: "solve",
      jobId,
      n: cfg.equihashN,
      k: cfg.equihashK,
      challenge: cfg.currentChallenge,
      miner: miner.toBytes(),
      height: cfg.blockHeight,
      maxAttempts: 4096,
      seed,
    });
  };

  // Top-level supervisor: keep config fresh, kick idle workers, handle network
  // failures. Workers self-redispatch after each result so this loop only
  // intervenes when config changes or things go wrong.
  (async () => {
    let lastHeight = -1n;

    while (!stopped) {
      try {
        const cfg = await fetchConfig(program);
        if (!cfg) {
          cb.log("err", "Couldn't read on-chain config — retrying");
          await sleep(2500);
          continue;
        }
        cb.onConfig(cfg);
        currentConfig = cfg;

        if (!cfg.miningOpen) {
          cb.log(
            "err",
            "Mining is not open yet (admin hasn't funded the vault)"
          );
          await sleep(5000);
          continue;
        }

        if (cfg.blockHeight !== lastHeight) {
          lastHeight = cfg.blockHeight;
          tryInRound = 0;
          cb.log(
            "info",
            `round #${cfg.blockHeight.toString()} opened — reward ${formatBase(cfg.currentEpochReward)} EQM`
          );
        }

        cb.onStatus("solving");

        // Kick any idle workers onto the current config.
        for (const slot of slots) {
          if (!slot.busy && !submitting) {
            dispatchTo(slot, cfg);
          }
        }

        // Poll the chain for round changes every few seconds — workers will
        // pick up the new config on their next dispatch automatically.
        await sleep(4000);
      } catch (e: any) {
        if (stopped) break;
        cb.log("err", `loop error: ${truncate(String(e?.message ?? e), 110)}`);
        await sleep(2000);
      }
    }
  })();

  return { stop };
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + "…" : s;
}

function buildInputBlock(
  challenge: Uint8Array,
  miner: Uint8Array,
  height: bigint
): Uint8Array {
  const out = new Uint8Array(81);
  out.set(new TextEncoder().encode("Equium-v1"), 0);
  out.set(challenge, 9);
  out.set(miner, 41);
  const heightLe = new Uint8Array(8);
  const dv = new DataView(heightLe.buffer);
  dv.setBigUint64(0, height, true);
  out.set(heightLe, 73);
  return out;
}

function concatBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

async function sha256(input: Uint8Array): Promise<Uint8Array> {
  const buf = await crypto.subtle.digest("SHA-256", input as any);
  return new Uint8Array(buf);
}

function formatBase(base: bigint): string {
  const whole = base / 1_000_000n;
  const frac = base % 1_000_000n;
  if (frac === 0n) return whole.toString();
  const fracStr = frac.toString().padStart(6, "0").replace(/0+$/, "");
  return `${whole}.${fracStr}`;
}
