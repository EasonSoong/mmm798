"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { detectTokenProgram } from "@/lib/program";

const EQM_DECIMALS = 6;
const SOL_FEE_BUFFER_LAMPORTS = 5_000; // typical signature fee
const EQM_RENT_BUFFER_LAMPORTS = 0.0021 * LAMPORTS_PER_SOL; // ATA creation if recipient is new

type Token = "SOL" | "EQM";
type Status =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "lost" }
  | { kind: "failed"; reason: string }
  | { kind: "sent"; sig: string };

interface Props {
  open: boolean;
  onClose: () => void;
  connection: Connection;
  fromPubkey: PublicKey;
  signTransaction: (tx: Transaction) => Promise<Transaction>;
  mint: PublicKey | null;
  solLamports: number | null;
  eqmBase: bigint;
  onSent?: () => void;
}

export function SendModal({
  open,
  onClose,
  connection,
  fromPubkey,
  signTransaction,
  mint,
  solLamports,
  eqmBase,
  onSent,
}: Props) {
  const [token, setToken] = useState<Token>("SOL");
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  useEffect(() => {
    if (open) {
      setStatus({ kind: "idle" });
      setRecipient("");
      setAmount("");
      setToken("SOL");
    }
  }, [open]);

  const recipientPk = useMemo(() => {
    try {
      return recipient.trim() ? new PublicKey(recipient.trim()) : null;
    } catch {
      return null;
    }
  }, [recipient]);

  const max =
    token === "SOL"
      ? Math.max(0, ((solLamports ?? 0) - SOL_FEE_BUFFER_LAMPORTS) / LAMPORTS_PER_SOL)
      : Number(eqmBase) / 10 ** EQM_DECIMALS;

  const amountNum = Number.parseFloat(amount);
  const amountValid = Number.isFinite(amountNum) && amountNum > 0 && amountNum <= max;
  const recipientValid =
    recipientPk !== null && recipientPk.toBase58() !== fromPubkey.toBase58();
  const canSend =
    open &&
    status.kind !== "sending" &&
    amountValid &&
    recipientValid &&
    (token !== "EQM" || mint !== null);

  const setMax = () => {
    if (token === "SOL") setAmount(max.toFixed(6));
    else setAmount(max.toFixed(EQM_DECIMALS));
  };

  const send = async () => {
    if (!canSend || !recipientPk) return;
    setStatus({ kind: "sending" });
    try {
      const tx = new Transaction();

      if (token === "SOL") {
        const lamports = Math.round(amountNum * LAMPORTS_PER_SOL);
        tx.add(
          SystemProgram.transfer({
            fromPubkey,
            toPubkey: recipientPk,
            lamports,
          })
        );
      } else {
        if (!mint) throw new Error("token mint not loaded yet");
        const tokenProgram = await detectTokenProgram(connection, mint);
        const sourceAta = getAssociatedTokenAddressSync(
          mint,
          fromPubkey,
          false,
          tokenProgram
        );
        const destAta = getAssociatedTokenAddressSync(
          mint,
          recipientPk,
          false,
          tokenProgram
        );

        // If the recipient doesn't have an ATA yet, create one. We pay the
        // ~0.002 SOL rent for it — there's no way around that on Solana.
        try {
          await getAccount(connection, destAta, "confirmed", tokenProgram);
        } catch {
          tx.add(
            createAssociatedTokenAccountInstruction(
              fromPubkey,
              destAta,
              recipientPk,
              mint,
              tokenProgram,
              ASSOCIATED_TOKEN_PROGRAM_ID
            )
          );
        }

        const baseUnits = BigInt(
          Math.round(amountNum * 10 ** EQM_DECIMALS)
        );
        tx.add(
          createTransferCheckedInstruction(
            sourceAta,
            mint,
            destAta,
            fromPubkey,
            baseUnits,
            EQM_DECIMALS,
            [],
            tokenProgram
          )
        );
      }

      const recent = await connection.getLatestBlockhash("confirmed");
      tx.recentBlockhash = recent.blockhash;
      tx.feePayer = fromPubkey;
      const signed = await signTransaction(tx);
      const sig = await connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: false,
      });

      // Poll status instead of confirmTransaction — same reason as miner.
      const deadline = Date.now() + 60_000;
      while (Date.now() < deadline) {
        try {
          const res = await connection.getSignatureStatuses([sig], {
            searchTransactionHistory: true,
          });
          const s = res.value[0];
          if (s) {
            if (s.err) {
              setStatus({
                kind: "failed",
                reason: JSON.stringify(s.err).slice(0, 100),
              });
              return;
            }
            if (
              s.confirmationStatus === "confirmed" ||
              s.confirmationStatus === "finalized"
            ) {
              setStatus({ kind: "sent", sig });
              onSent?.();
              return;
            }
          }
        } catch {}
        await new Promise((r) => setTimeout(r, 1500));
      }
      setStatus({ kind: "lost" });
    } catch (e: any) {
      setStatus({
        kind: "failed",
        reason: String(e?.message ?? e).slice(0, 200),
      });
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-3xl border border-[var(--color-border-bright)] bg-[var(--color-panel)] p-6 shadow-2xl fade-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[20px] font-black tracking-[-0.02em]">
            Send tokens
          </h2>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full hover:bg-white/[0.06] flex items-center justify-center text-[18px] text-[var(--color-fg-soft)]"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Token toggle */}
        <div className="grid grid-cols-2 gap-2 mb-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-1">
          {(["SOL", "EQM"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setToken(t)}
              className={`px-4 py-2 rounded-xl text-[14px] font-bold transition-colors ${
                token === t
                  ? "bg-[var(--color-rose)] text-[var(--color-bg)]"
                  : "text-[var(--color-fg-soft)] hover:bg-white/[0.04]"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="text-[11px] font-mono text-[var(--color-fg-dim)] mb-4 flex items-center justify-between">
          <span>
            Available:{" "}
            <span className="font-bold text-[var(--color-fg)]">
              {token === "SOL"
                ? `${((solLamports ?? 0) / LAMPORTS_PER_SOL).toFixed(4)} SOL`
                : `${(Number(eqmBase) / 10 ** EQM_DECIMALS).toFixed(EQM_DECIMALS)} EQM`}
            </span>
          </span>
          <button
            onClick={setMax}
            disabled={max <= 0}
            className="px-2 py-0.5 rounded text-[10px] font-bold border border-[var(--color-border-bright)] hover:bg-white/[0.04] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            MAX
          </button>
        </div>

        {/* Recipient */}
        <label className="block text-[11px] font-mono uppercase tracking-[0.18em] text-[var(--color-fg-dim)] mb-1.5 font-semibold">
          Recipient address
        </label>
        <input
          type="text"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          placeholder="Paste Solana address…"
          spellCheck={false}
          className={`w-full rounded-2xl bg-[var(--color-bg)] border px-4 py-3 font-mono text-[13px] text-[var(--color-fg)] outline-none mb-1 ${
            recipient.length > 0 && !recipientPk
              ? "border-[var(--color-rose)]"
              : recipientPk && recipientPk.toBase58() === fromPubkey.toBase58()
                ? "border-[var(--color-gold)]"
                : "border-[var(--color-border-bright)] focus:border-[var(--color-rose)]"
          }`}
        />
        {recipient.length > 0 && !recipientPk && (
          <p className="text-[12px] text-[var(--color-rose)] mb-3">
            Not a valid Solana address.
          </p>
        )}
        {recipientPk && recipientPk.toBase58() === fromPubkey.toBase58() && (
          <p className="text-[12px] text-[var(--color-gold)] mb-3">
            That's your own address.
          </p>
        )}

        {/* Amount */}
        <label className="block text-[11px] font-mono uppercase tracking-[0.18em] text-[var(--color-fg-dim)] mb-1.5 mt-3 font-semibold">
          Amount
        </label>
        <div className="relative mb-1">
          <input
            type="text"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
            placeholder="0.0"
            inputMode="decimal"
            className={`w-full rounded-2xl bg-[var(--color-bg)] border px-4 py-3 pr-16 text-[16px] font-bold text-[var(--color-fg)] outline-none ${
              amount && !amountValid
                ? "border-[var(--color-rose)]"
                : "border-[var(--color-border-bright)] focus:border-[var(--color-rose)]"
            }`}
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[14px] font-mono font-bold text-[var(--color-fg-dim)]">
            {token}
          </span>
        </div>
        {amount && Number(amount) > max && (
          <p className="text-[12px] text-[var(--color-rose)] mb-3">
            More than your available balance.
          </p>
        )}

        {token === "EQM" && (
          <p className="text-[11px] text-[var(--color-fg-dim)] mt-3">
            If the recipient has never held this token, a small SOL fee
            (~0.002 SOL) will be paid from this wallet to create their account.
          </p>
        )}

        {/* Status panel */}
        {status.kind === "sent" && (
          <div className="mt-4 rounded-2xl border border-[var(--color-mint)]/40 bg-[var(--color-mint)]/10 p-4">
            <div className="text-[13px] font-bold text-[var(--color-mint)] mb-1">
              ✓ Sent
            </div>
            <a
              href={`https://solscan.io/tx/${status.sig}?cluster=devnet`}
              target="_blank"
              rel="noreferrer noopener"
              className="font-mono text-[11px] text-[var(--color-teal)] hover:underline break-all"
            >
              {status.sig}
            </a>
          </div>
        )}
        {status.kind === "failed" && (
          <div className="mt-4 rounded-2xl border border-[var(--color-rose)]/40 bg-[var(--color-rose)]/10 p-4">
            <div className="text-[13px] font-bold text-[var(--color-rose)] mb-1">
              Send failed
            </div>
            <div className="text-[12px] text-[var(--color-fg-soft)]">
              {status.reason}
            </div>
          </div>
        )}
        {status.kind === "lost" && (
          <div className="mt-4 rounded-2xl border border-[var(--color-gold)]/40 bg-[var(--color-gold)]/10 p-4">
            <div className="text-[13px] font-bold text-[var(--color-gold)] mb-1">
              Status unknown
            </div>
            <div className="text-[12px] text-[var(--color-fg-soft)]">
              The tx was submitted but didn't confirm within 60s. Check your
              wallet balance — it may still land.
            </div>
          </div>
        )}

        <div className="flex gap-2 mt-5">
          <button
            onClick={onClose}
            className="px-5 py-3 rounded-full border border-[var(--color-border-bright)] text-[14px] font-medium text-[var(--color-fg-soft)] hover:bg-white/[0.04]"
          >
            {status.kind === "sent" ? "Close" : "Cancel"}
          </button>
          <button
            onClick={send}
            disabled={!canSend}
            className="flex-1 px-5 py-3 rounded-full bg-[var(--color-rose)] text-[var(--color-bg)] text-[14px] font-bold hover:bg-[var(--color-rose-bright)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[var(--color-rose)]"
          >
            {status.kind === "sending"
              ? "Sending…"
              : `Send ${amount || "0"} ${token}`}
          </button>
        </div>
      </div>
    </div>
  );
}
