import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import MineClientLoader from "@/components/MineClientLoader";

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
