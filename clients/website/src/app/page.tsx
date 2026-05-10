import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/Hero";
import { LiveStats } from "@/components/LiveStats";
import { HowItWorks } from "@/components/HowItWorks";
import { Tokenomics } from "@/components/Tokenomics";
import { MiningPreview } from "@/components/MiningPreview";
import { Faq } from "@/components/Faq";
import { Footer } from "@/components/Footer";

export default function Home() {
  return (
    <main>
      <Navbar />
      <Hero />
      <LiveStats />
      <HowItWorks />
      <MiningPreview />
      <Tokenomics />
      <Faq />
      <Footer />
    </main>
  );
}
