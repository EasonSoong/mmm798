"use client";

import { useEffect, useRef, useState } from "react";
import * as htmlToImage from "html-to-image";

interface Stats {
  blocks: number;
  earnedBase: bigint;
  cumulativeNonces: number;
  startedAt: number | null;
  hashrate: number;
}

interface Props {
  onClose: () => void;
  pubkey: string;
  stats: Stats;
}

export function ShareCardModal({ onClose, pubkey, stats }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const render = async (): Promise<string | null> => {
    if (!cardRef.current) return null;
    try {
      // Wait for fonts + images
      await document.fonts.ready;
      // Two passes — htmlToImage occasionally misses fonts on first pass
      await htmlToImage.toPng(cardRef.current, {
        pixelRatio: 2,
        cacheBust: true,
      });
      const dataUrl = await htmlToImage.toPng(cardRef.current, {
        pixelRatio: 2,
        cacheBust: true,
      });
      return dataUrl;
    } catch (e) {
      console.error("share render failed", e);
      return null;
    }
  };

  const download = async () => {
    setDownloading(true);
    try {
      const dataUrl = await render();
      if (!dataUrl) return;
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `equium-mining-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } finally {
      setDownloading(false);
    }
  };

  const copyToClipboard = async () => {
    try {
      const dataUrl = await render();
      if (!dataUrl) return;
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const Item = (window as any).ClipboardItem;
      await (navigator.clipboard as any).write([
        new Item({ "image/png": blob }),
      ]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch (e) {
      console.error("clipboard write failed", e);
    }
  };

  const tweet = () => {
    const text = encodeURIComponent(
      `Mining $EQM on @EquiumEQM 🚀\n\n` +
        `⛏ Hashrate: ${formatHashrate(stats.hashrate)}\n` +
        `📦 Blocks: ${stats.blocks}\n` +
        `💰 Earned: ${formatEqm(stats.earnedBase)} EQM\n\n` +
        `Mine in your browser — fair-launched, CPU-only, on Solana.`
    );
    window.open(
      `https://twitter.com/intent/tweet?text=${text}&url=https://equium.xyz/mine`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
        onClick={onClose}
      />
      <div className="relative w-full max-w-3xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[20px] md:text-[26px] font-bold">
            Share your mining stats
          </h3>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full border border-[var(--color-border-bright)] flex items-center justify-center hover:bg-white/[0.05] transition-colors"
            aria-label="Close"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        {/* Share card preview */}
        <div className="rounded-3xl overflow-hidden border border-[var(--color-border-bright)] bg-[var(--color-bg)] mb-5">
          <ShareCard ref={cardRef} pubkey={pubkey} stats={stats} />
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-2.5">
          <button
            onClick={tweet}
            className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-full bg-[var(--color-rose)] text-[var(--color-bg)] text-[14px] font-bold hover:bg-[var(--color-rose-bright)] transition-colors"
          >
            <XIcon /> Post to X
          </button>
          <button
            onClick={copyToClipboard}
            className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-full border border-[var(--color-border-bright)] text-[14px] font-medium text-[var(--color-fg-soft)] hover:bg-white/[0.04] transition-colors"
          >
            {copied ? "✓ Copied!" : "Copy image"}
          </button>
          <button
            onClick={download}
            disabled={downloading}
            className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-full border border-[var(--color-border-bright)] text-[14px] font-medium text-[var(--color-fg-soft)] hover:bg-white/[0.04] transition-colors disabled:opacity-50"
          >
            {downloading ? "Saving…" : "Download PNG"}
          </button>
        </div>

        <p className="text-[11px] text-[var(--color-fg-dim)] mt-3 text-center">
          Note: clipboard image copy needs Chrome / Edge / Safari 16+. On X, the image is auto-included when you allow clipboard paste.
        </p>
      </div>
    </div>
  );
}

const ShareCard = ({
  pubkey,
  stats,
  ref,
}: {
  pubkey: string;
  stats: Stats;
  ref: React.RefObject<HTMLDivElement | null>;
}) => {
  const uptime = stats.startedAt
    ? Math.max(0, Math.floor((Date.now() - stats.startedAt) / 1000))
    : 0;
  return (
    <div
      ref={ref as any}
      style={{
        width: 1200,
        height: 675,
        backgroundColor: "#08090c",
        color: "#f1ede6",
        fontFamily: "Inter, system-ui, sans-serif",
        position: "relative",
        overflow: "hidden",
        transform: "scale(0.5)",
        transformOrigin: "top left",
        marginBottom: -337,
      }}
    >
      {/* Glow */}
      <div
        style={{
          position: "absolute",
          top: -200,
          left: -200,
          width: 800,
          height: 800,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(232,90,141,0.35) 0%, transparent 60%)",
          filter: "blur(40px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: -200,
          right: -200,
          width: 700,
          height: 700,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(250,204,21,0.18) 0%, transparent 60%)",
          filter: "blur(40px)",
        }}
      />

      {/* Content */}
      <div
        style={{
          position: "relative",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: 64,
          zIndex: 2,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <img
              src="/logo.png"
              width="64"
              height="64"
              style={{ borderRadius: 14 }}
              alt=""
            />
            <div>
              <div
                style={{
                  fontSize: 30,
                  fontWeight: 800,
                  letterSpacing: "-0.02em",
                }}
              >
                Equium
              </div>
              <div
                style={{
                  fontFamily: "JetBrains Mono, monospace",
                  fontSize: 14,
                  color: "#e85a8d",
                  letterSpacing: "0.15em",
                  fontWeight: 600,
                }}
              >
                $EQM · SOLANA
              </div>
            </div>
          </div>
          <div
            style={{
              fontFamily: "JetBrains Mono, monospace",
              fontSize: 12,
              color: "#8b8478",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#6ee7b7",
              }}
            />
            Live · Devnet
          </div>
        </div>

        {/* Big tagline */}
        <div style={{ marginTop: 60 }}>
          <div
            style={{
              fontFamily: "JetBrains Mono, monospace",
              fontSize: 14,
              color: "#e85a8d",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              fontWeight: 600,
              marginBottom: 12,
            }}
          >
            — I'm mining $EQM —
          </div>
          <div
            style={{
              fontSize: 76,
              fontWeight: 900,
              letterSpacing: "-0.035em",
              lineHeight: 1.05,
              maxWidth: 900,
            }}
          >
            CPU mining is back.{" "}
            <span style={{ color: "#e85a8d" }}>And I'm in.</span>
          </div>
        </div>

        {/* Stats grid */}
        <div
          style={{
            marginTop: "auto",
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 16,
          }}
        >
          <StatBlock
            label="Hashrate"
            value={formatHashrate(stats.hashrate)}
            accent="#facc15"
          />
          <StatBlock
            label="Blocks"
            value={stats.blocks.toString()}
            accent="#e85a8d"
          />
          <StatBlock
            label="Earned"
            value={`${formatEqm(stats.earnedBase)} EQM`}
            accent="#6ee7b7"
          />
          <StatBlock
            label="Uptime"
            value={formatUptime(uptime)}
            accent="#7dd3fc"
          />
        </div>

        {/* Footer */}
        <div
          style={{
            marginTop: 24,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontFamily: "JetBrains Mono, monospace",
            fontSize: 13,
            color: "#8b8478",
            paddingTop: 18,
            borderTop: "1px solid #232a36",
          }}
        >
          <span>{shortPk(pubkey)}</span>
          <span>equium.xyz/mine</span>
        </div>
      </div>
    </div>
  );
};

function StatBlock({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div
      style={{
        background: "#13171f",
        border: "1px solid #232a36",
        borderRadius: 16,
        padding: "18px 22px",
      }}
    >
      <div
        style={{
          fontFamily: "JetBrains Mono, monospace",
          fontSize: 11,
          color: "#8b8478",
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          fontWeight: 600,
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 36,
          fontWeight: 800,
          letterSpacing: "-0.02em",
          color: accent,
          lineHeight: 1,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function shortPk(s: string): string {
  if (!s) return "—";
  return `${s.slice(0, 6)}…${s.slice(-6)}`;
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
function formatUptime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
