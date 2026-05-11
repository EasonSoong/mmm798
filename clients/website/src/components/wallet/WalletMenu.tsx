"use client";

import { useState } from "react";
import { useWallet } from "@/lib/wallet-context";

/** Wallet status pill that appears in the mine dashboard header. */
export function WalletMenu({ onSendClick }: { onSendClick?: () => void }) {
  const wallet = useWallet();
  const [open, setOpen] = useState(false);
  const [showKey, setShowKey] = useState(false);

  if (wallet.status !== "unlocked" || !wallet.loaded) return null;

  const pubkey = wallet.loaded.pubkey;
  const secret = wallet.exportSecret();

  const copy = (s: string) => {
    navigator.clipboard.writeText(s).catch(() => {});
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-3 px-4 py-2.5 rounded-full border border-[var(--color-border-bright)] bg-[var(--color-panel)] hover:bg-[var(--color-panel-2)] transition-colors"
      >
        <span className="w-2 h-2 rounded-full bg-[var(--color-mint)] live-dot" />
        <span className="font-mono text-[13px] text-[var(--color-teal)] font-semibold">
          {short(pubkey)}
        </span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className={`transition-transform ${open ? "rotate-180" : ""}`}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => {
              setOpen(false);
              setShowKey(false);
            }}
          />
          <div className="absolute right-0 top-full mt-2 w-[340px] rounded-2xl border border-[var(--color-border-bright)] bg-[var(--color-panel)] shadow-2xl z-50 p-4 fade-up">
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--color-fg-dim)] mb-1.5 font-semibold">
              Pubkey
            </div>
            <div className="flex items-center gap-2 mb-3">
              <span className="font-mono text-[12px] text-[var(--color-teal)] break-all flex-1">
                {pubkey}
              </span>
              <button
                onClick={() => copy(pubkey)}
                className="flex-shrink-0 px-2 py-1 rounded text-[10px] font-mono border border-[var(--color-border-bright)] hover:bg-white/[0.04]"
              >
                Copy
              </button>
            </div>

            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--color-rose-bright)] mb-1.5 font-semibold">
              Secret key
            </div>
            <div className="relative mb-3">
              <div
                className={`font-mono text-[11px] break-all p-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] ${
                  showKey
                    ? "text-[var(--color-fg)]"
                    : "text-transparent select-none"
                }`}
              >
                {secret || "—"}
              </div>
              {!showKey && (
                <button
                  onClick={() => setShowKey(true)}
                  className="absolute inset-0 flex items-center justify-center text-[11px] font-mono bg-black/40 backdrop-blur-sm rounded-lg hover:bg-black/30"
                >
                  👁  Reveal secret
                </button>
              )}
            </div>
            {showKey && (
              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => secret && copy(secret)}
                  className="flex-1 px-3 py-1.5 rounded-full text-[11px] font-mono border border-[var(--color-border-bright)] hover:bg-white/[0.04]"
                >
                  Copy
                </button>
                <button
                  onClick={() => setShowKey(false)}
                  className="px-3 py-1.5 rounded-full text-[11px] font-mono border border-[var(--color-border-bright)] hover:bg-white/[0.04]"
                >
                  Hide
                </button>
              </div>
            )}

            <div className="text-[11px] text-[var(--color-fg-faint)] mb-3 leading-relaxed">
              Treat this key like cash. Anyone with it controls your $EQM.
            </div>

            <div className="pt-3 border-t border-[var(--color-border)] flex gap-2">
              {onSendClick && (
                <button
                  onClick={() => {
                    onSendClick();
                    setOpen(false);
                    setShowKey(false);
                  }}
                  className="flex-1 px-3 py-2 rounded-full text-[12px] font-semibold bg-[var(--color-rose)] text-[var(--color-bg)] hover:bg-[var(--color-rose-bright)]"
                >
                  ↗ Send
                </button>
              )}
              <button
                onClick={() => {
                  wallet.lock();
                  setOpen(false);
                  setShowKey(false);
                }}
                className="flex-1 px-3 py-2 rounded-full text-[12px] font-semibold border border-[var(--color-border-bright)] hover:bg-white/[0.04]"
              >
                🔒 Lock
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function short(s: string): string {
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
}
