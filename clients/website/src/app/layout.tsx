import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Equium — CPU-mineable Solana token",
  description:
    "Bitcoin-style economics on Solana. 21M hard cap, halving forever, fair-launched via Equihash CPU mining. Mine in your browser.",
  metadataBase: new URL("https://equium.xyz"),
  openGraph: {
    title: "Equium — CPU-mineable Solana token",
    description:
      "Bitcoin-style economics on Solana. Mine $EQM from your laptop or phone.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    site: "@EquiumEQM",
    creator: "@EquiumEQM",
    title: "Equium — CPU-mineable Solana token",
    description:
      "Bitcoin-style economics on Solana. Mine $EQM from your laptop or phone.",
  },
};

export const viewport: Viewport = {
  themeColor: "#08090c",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <link rel="icon" href="/logo.png" type="image/png" />
      </head>
      <body className="relative min-h-screen overflow-x-hidden">
        <div className="relative z-10">{children}</div>
      </body>
    </html>
  );
}
