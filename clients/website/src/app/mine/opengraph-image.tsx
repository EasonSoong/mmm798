import { ImageResponse } from "next/og";
import { fetchState } from "@/lib/rpc";

export const runtime = "nodejs";
export const alt = "Mine $EQM in your browser";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraph() {
  const state = await fetchState().catch(() => null);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#08090c",
          color: "#f1ede6",
          display: "flex",
          flexDirection: "column",
          padding: 64,
          fontFamily: "Inter",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -240,
            right: -200,
            width: 800,
            height: 800,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(232,90,141,0.5) 0%, transparent 60%)",
            display: "flex",
          }}
        />

        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            position: "relative",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: 14,
                background: "#13171f",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 30,
                fontWeight: 900,
              }}
            >
              E
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 28, fontWeight: 900 }}>Equium</div>
              <div
                style={{
                  fontSize: 13,
                  color: "#e85a8d",
                  letterSpacing: "0.18em",
                  fontWeight: 700,
                  marginTop: 2,
                }}
              >
                $EQM · SOLANA
              </div>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 18px",
              borderRadius: 999,
              border: "1px solid #232a36",
              background: "rgba(17,20,26,0.6)",
              fontSize: 13,
              color: "#8b8478",
              letterSpacing: "0.18em",
              fontWeight: 700,
              textTransform: "uppercase",
            }}
          >
            <div
              style={{
                width: 9,
                height: 9,
                borderRadius: "50%",
                background: "#6ee7b7",
              }}
            />
            <span>Devnet</span>
          </div>
        </div>

        {/* Main */}
        <div style={{ marginTop: 56, display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 13,
              color: "#e85a8d",
              letterSpacing: "0.24em",
              fontWeight: 700,
              textTransform: "uppercase",
            }}
          >
            — Browser miner —
          </div>
          <div
            style={{
              fontSize: 120,
              fontWeight: 900,
              letterSpacing: "-0.04em",
              lineHeight: 1,
              marginTop: 16,
              display: "flex",
            }}
          >
            Mine $EQM.
          </div>
          <div
            style={{
              fontSize: 30,
              color: "#8b8478",
              fontWeight: 500,
              marginTop: 22,
              maxWidth: 760,
              display: "flex",
            }}
          >
            Generate a wallet. Press start. Your machine earns block rewards. No install. Mobile-friendly.
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            marginTop: "auto",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", gap: 32 }}>
            <Stat
              label="Current block"
              value={state ? `#${state.blockHeight}` : "—"}
              color="#facc15"
            />
            <Stat label="Reward" value="25 EQM" color="#6ee7b7" />
            <Stat label="Block time" value="~1 min" color="#7dd3fc" />
          </div>
          <div
            style={{
              fontSize: 18,
              color: "#e85a8d",
              fontWeight: 700,
            }}
          >
            equium.xyz/mine
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div
        style={{
          fontSize: 11,
          letterSpacing: "0.2em",
          color: "#8b8478",
          textTransform: "uppercase",
          fontWeight: 700,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 28,
          fontWeight: 800,
          letterSpacing: "-0.02em",
          color,
        }}
      >
        {value}
      </div>
    </div>
  );
}
