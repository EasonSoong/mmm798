import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://equium.xyz"
  ),
  title: {
    default: "Equium — CPU-mineable Solana token",
    template: "%s · Equium",
  },
  description:
    "Bitcoin-style economics on Solana. 21M hard cap, halving forever, fair-launched via Equihash CPU mining. Mine $EQM in your browser — no install, no bridge, no custody.",
  applicationName: "Equium",
  keywords: [
    "Equium",
    "$EQM",
    "Solana",
    "CPU mining",
    "Equihash",
    "Bitcoin",
    "fair launch",
    "proof of work",
  ],
  authors: [{ name: "Equium contributors" }],
  creator: "Equium",
  publisher: "Equium",
  icons: {
    icon: [{ url: "/logo.png", type: "image/png" }],
    apple: [{ url: "/logo.png", type: "image/png" }],
  },
  openGraph: {
    title: "Equium — CPU-mineable Solana token",
    description:
      "Bitcoin-style economics on Solana. Mine $EQM from any machine. No presale, no airdrop, no VC.",
    url: "/",
    siteName: "Equium",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Equium — CPU-mineable Solana token",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@EquiumEQM",
    creator: "@EquiumEQM",
    title: "Equium — CPU-mineable Solana token",
    description:
      "Bitcoin-style economics on Solana. Mine $EQM from any machine. No presale, no airdrop, no VC.",
    images: ["/opengraph-image"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: "/",
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
