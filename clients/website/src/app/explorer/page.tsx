import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ExplorerDashboard } from "@/components/ExplorerDashboard";
import {
  fetchState,
  fetchRecentBlocks,
  fetchLeaderboard,
  fetchHashrateSeries,
} from "@/lib/rpc";

export const revalidate = 0;

export const metadata = {
  title: "Explorer",
  description:
    "Live state of the Equium protocol on Solana — block height, network hashrate, recent blocks, and the top-miners leaderboard.",
  openGraph: {
    title: "Equium Explorer — live blocks, miners, hashrate",
    description:
      "Live state of the Equium protocol on Solana. Block height, top miners, recent blocks.",
    url: "/explorer",
    siteName: "Equium",
    type: "website" as const,
    images: [
      {
        url: "/explorer/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Equium Explorer",
      },
    ],
  },
  twitter: {
    card: "summary_large_image" as const,
    site: "@EquiumEQM",
    creator: "@EquiumEQM",
    title: "Equium Explorer — live blocks, miners, hashrate",
    description:
      "Live state of the Equium protocol on Solana. Block height, top miners, recent blocks.",
    images: ["/explorer/opengraph-image"],
  },
  alternates: { canonical: "/explorer" },
};

export default async function ExplorerPage() {
  const [state, blocks, leaderboard, series] = await Promise.all([
    fetchState(),
    fetchRecentBlocks(12),
    fetchLeaderboard(200, 20),
    fetchHashrateSeries(200, 30),
  ]);

  return (
    <main>
      <Navbar />
      <div className="pt-32 pb-16 px-6">
        <div className="max-w-6xl mx-auto">
          <ExplorerDashboard
            initialState={state}
            initialBlocks={blocks}
            initialLeaderboard={leaderboard}
            initialSeries={series}
          />
        </div>
      </div>
      <Footer />
    </main>
  );
}
