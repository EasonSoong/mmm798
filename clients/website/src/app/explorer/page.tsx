import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ExplorerDashboard } from "@/components/ExplorerDashboard";
import { fetchState, fetchRecentBlocks } from "@/lib/rpc";

export const revalidate = 0; // Always fetch fresh

export default async function ExplorerPage() {
  const [state, blocks] = await Promise.all([
    fetchState(),
    fetchRecentBlocks(12),
  ]);

  return (
    <main>
      <Navbar />
      <div className="pt-32 pb-16 px-6">
        <div className="max-w-6xl mx-auto">
          <ExplorerDashboard initialState={state} initialBlocks={blocks} />
        </div>
      </div>
      <Footer />
    </main>
  );
}
