import { Connection, PublicKey } from "@solana/web3.js";
import {
  AnchorProvider,
  Program,
  setProvider,
} from "@coral-xyz/anchor";
import idl from "../idl.json";
import { CONFIG_PDA } from "./program";

export const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL || "https://api.devnet.solana.com";
export const CLUSTER =
  process.env.NEXT_PUBLIC_CLUSTER || "devnet";

export function readConnection(): Connection {
  return new Connection(RPC_URL, "confirmed");
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
