import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import MineClientLoader from "@/components/MineClientLoader";

export const metadata = {
  title: "Mine $EQM",
  description:
    "Mine $EQM in your browser. Generate a wallet, press start, your machine earns block rewards. No install. Mobile-friendly. Fair-launched on Solana.",
  openGraph: {
    title: "Mine $EQM in your browser",
    description:
      "Generate a wallet. Press start. Your machine solves Equihash and earns block rewards. Mobile-friendly.",
    url: "/mine",
    siteName: "Equium",
    type: "website" as const,
    images: [
      {
        url: "/mine/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Mine $EQM in your browser",
      },
    ],
  },
  twitter: {
    card: "summary_large_image" as const,
    site: "@EquiumEQM",
    creator: "@EquiumEQM",
    title: "Mine $EQM in your browser",
    description:
      "Generate a wallet. Press start. Your machine solves Equihash and earns block rewards.",
    images: ["/mine/opengraph-image"],
  },
  alternates: { canonical: "/mine" },
};

export default function MinePage() {
  return (
    <main>
      <Navbar />
      <div className="pt-32 pb-16 px-6">
        <div className="max-w-5xl mx-auto">
          <MineClientLoader />
        </div>
      </div>
      <Footer />
    </main>
  );
}
