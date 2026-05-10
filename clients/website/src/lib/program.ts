import { AnchorProvider, Program } from "@coral-xyz/anchor";
import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  ComputeBudgetProgram,
  SYSVAR_SLOT_HASHES_PUBKEY,
  SystemProgram,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import idl from "../idl.json";

export const PROGRAM_ID = new PublicKey(idl.address);
export const CONFIG_SEED = new TextEncoder().encode("equium-config");
export const VAULT_SEED = new TextEncoder().encode("equium-vault");

export const [CONFIG_PDA] = PublicKey.findProgramAddressSync(
  [CONFIG_SEED],
  PROGRAM_ID
);
export const [VAULT_PDA] = PublicKey.findProgramAddressSync(
  [VAULT_SEED],
  PROGRAM_ID
);

export interface EquiumConfig {
  mint: PublicKey;
  mineableVault: PublicKey;
  configBump: number;
  mineableVaultBump: number;
  blockHeight: bigint;
  currentChallenge: Uint8Array;
  currentTarget: Uint8Array;
  equihashN: number;
  equihashK: number;
  currentEpochReward: bigint;
  cumulativeMined: bigint;
  miningOpen: boolean;
}

export function getProgram(connection: Connection, wallet: any): Program<any> {
  // The Anchor Provider needs a wallet adapter. We use a thin shim that
  // delegates `signTransaction` to the connected wallet adapter.
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  return new Program(idl as any, provider) as Program<any>;
}

export async function fetchConfig(
  program: Program<any>
): Promise<EquiumConfig | null> {
  try {
    const raw: any = await (program.account as any).equiumConfig.fetch(CONFIG_PDA);
    return {
      mint: raw.mint,
      mineableVault: raw.mineableVault,
      configBump: raw.configBump,
      mineableVaultBump: raw.mineableVaultBump,
      blockHeight: BigInt(raw.blockHeight.toString()),
      currentChallenge: new Uint8Array(raw.currentChallenge),
      currentTarget: new Uint8Array(raw.currentTarget),
      equihashN: raw.equihashN,
      equihashK: raw.equihashK,
      currentEpochReward: BigInt(raw.currentEpochReward.toString()),
      cumulativeMined: BigInt(raw.cumulativeMined.toString()),
      miningOpen: raw.miningOpen,
    };
  } catch {
    return null;
  }
}

/** Look up which token program owns the mint (classic SPL or Token-2022). */
export async function detectTokenProgram(
  connection: Connection,
  mint: PublicKey
): Promise<PublicKey> {
  const acct = await connection.getAccountInfo(mint, "confirmed");
  if (!acct) throw new Error(`mint ${mint.toBase58()} not found`);
  return acct.owner;
}

export function buildMineTx(opts: {
  program: Program<any>;
  miner: PublicKey;
  mint: PublicKey;
  tokenProgram: PublicKey;
  nonce: Uint8Array;
  solnIndices: Uint8Array;
  cuLimit?: number;
}): Promise<Transaction> {
  const { program, miner, mint, tokenProgram, nonce, solnIndices, cuLimit = 1_400_000 } = opts;
  const minerAta = getAssociatedTokenAddressSync(
    mint,
    miner,
    false,
    tokenProgram
  );
  const cuIx = ComputeBudgetProgram.setComputeUnitLimit({ units: cuLimit });

  return (program.methods as any)
    .mine(Array.from(nonce), Buffer.from(solnIndices))
    .accounts({
      miner,
      config: CONFIG_PDA,
      mint,
      mineableVault: VAULT_PDA,
      minerAta,
      tokenProgram,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      slotHashes: SYSVAR_SLOT_HASHES_PUBKEY,
    })
    .preInstructions([cuIx])
    .transaction();
}

/** Lex-compare two 32-byte big-endian uints. Returns true iff hash < target. */
export function hashUnderTarget(hash: Uint8Array, target: Uint8Array): boolean {
  for (let i = 0; i < 32; i++) {
    if (hash[i] < target[i]) return true;
    if (hash[i] > target[i]) return false;
  }
  return false;
}
