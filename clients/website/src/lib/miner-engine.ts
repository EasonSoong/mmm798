// Mining engine: orchestrates a Web Worker (Equihash solver) + RPC reads +
// transaction signing/submitting. Designed for the browser miner UI; the
// CLI miner in Rust does the same work via solana-client.

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

export function startMiner(opts: MinerOptions): MinerHandle {
  const { connection, program, miner, signTransaction, cb } = opts;
  let stopped = false;
  let worker: Worker | null = null;
  let nextJobId = 1;
  let tokenProgramCache: PublicKey | null = null;
  let cumulativeNonces = 0;
  const startedAt = Date.now();

  const stop = () => {
    stopped = true;
    if (worker) {
      worker.terminate();
      worker = null;
    }
    cb.onStatus("stopped");
  };

  const askSolver = (
    req: Omit<SolveResponse, "type" | "jobId"> & {
      n: number;
      k: number;
      challenge: Uint8Array;
      miner: Uint8Array;
      height: bigint;
      maxAttempts: number;
      seed: Uint8Array;
    }
  ) =>
    new Promise<SolveResponse>((resolve, reject) => {
      if (!worker) {
        worker = new Worker("/wasm/miner.worker.js", { type: "module" });
      }
      const w = worker;
      const jobId = nextJobId++;
      const onMessage = (e: MessageEvent<SolveResponse>) => {
        if (e.data.jobId !== jobId) return;
        w.removeEventListener("message", onMessage);
        resolve(e.data);
      };
      const onError = (e: ErrorEvent) => {
        w.removeEventListener("error", onError);
        reject(new Error(e.message));
      };
      w.addEventListener("message", onMessage);
      w.addEventListener("error", onError, { once: true });
      w.postMessage({ type: "solve", jobId, ...req });
    });

  (async () => {
    let tryInRound = 0;
    let currentHeight = -1n;

    while (!stopped) {
      try {
        const cfg = await fetchConfig(program);
        if (!cfg) {
          cb.log("err", "Couldn't read on-chain config — retrying");
          await sleep(2500);
          continue;
        }
        cb.onConfig(cfg);

        if (!cfg.miningOpen) {
          cb.log("err", "Mining is not open yet (admin hasn't funded the vault)");
          await sleep(5000);
          continue;
        }

        if (cfg.blockHeight !== currentHeight) {
          currentHeight = cfg.blockHeight;
          tryInRound = 0;
          cb.log(
            "info",
            `round #${cfg.blockHeight.toString()} opened — reward ${formatBase(cfg.currentEpochReward)} EQM`
          );
        }

        cb.onStatus("solving");

        const seed = new Uint8Array(32);
        crypto.getRandomValues(seed);
        const t0 = performance.now();

        const resp = await askSolver({
          n: cfg.equihashN,
          k: cfg.equihashK,
          challenge: cfg.currentChallenge,
          miner: miner.toBytes(),
          height: cfg.blockHeight,
          maxAttempts: 4096,
          seed,
        });

        if (resp.type === "error") {
          cb.log("err", `solver error: ${resp.message}`);
          await sleep(1000);
          continue;
        }
        if (resp.type === "no-solution") {
          cb.log(
            "info",
            `solver exhausted nonces (${resp.attempts}); refreshing state`
          );
          continue;
        }

        tryInRound += 1;
        cumulativeNonces += resp.attempts ?? 1;
        const elapsedSec = (Date.now() - startedAt) / 1000;

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

        cb.onAttempt({
          tryNum: tryInRound,
          aboveTarget,
          solveMs: resp.solveMs ?? 0,
          cumulativeNonces,
          elapsedSec,
        });

        if (aboveTarget) {
          cb.log(
            "info",
            `try #${tryInRound} · above target · ${(resp.solveMs ?? 0).toFixed(0)}ms`
          );
          continue;
        }

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
        }
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
