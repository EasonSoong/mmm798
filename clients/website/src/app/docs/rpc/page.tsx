import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

export const metadata = {
  title: "Set up an RPC for the desktop miner",
  description:
    "How to grab a free Helius RPC endpoint and plug it into the Equium desktop miner.",
};

export default function RpcDocsPage() {
  return (
    <main>
      <Navbar />
      <div className="pt-32 pb-16 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-[var(--color-rose)] mb-3 font-semibold">
            — Desktop miner setup —
          </div>
          <h1 className="text-[44px] md:text-[60px] font-black tracking-[-0.03em] leading-[1] mb-5">
            Plug in your RPC.
          </h1>
          <p className="text-[17px] leading-[1.6] text-[var(--color-fg-dim)] max-w-2xl mb-6">
            The Equium desktop miner needs a Solana RPC endpoint to read
            on-chain state and submit mining transactions. The public Solana
            endpoint works but is heavily rate-limited; a free Helius key takes
            5 minutes and gives you 100k requests/day — more than enough for a
            single miner running around the clock.
          </p>
          <p className="text-[15px] leading-[1.6] text-[var(--color-fg-dim)] max-w-2xl mb-12">
            <span className="font-semibold text-[var(--color-fg)]">
              Mining in the browser instead?
            </span>{" "}
            You don't need to do any of this — equium.xyz proxies RPC for you.
            This guide is only for the native desktop app.
          </p>

          <Step
            n={1}
            title="Make a free Helius account"
            body={
              <>
                Go to{" "}
                <a
                  href="https://www.helius.dev/"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-[var(--color-rose)] font-semibold hover:underline"
                >
                  helius.dev
                </a>{" "}
                and sign up. The free tier gives you{" "}
                <span className="font-mono font-bold">100,000 requests/day</span>{" "}
                — comfortable for a single CPU mining 24/7.
              </>
            }
          />

          <Step
            n={2}
            title="Create an API key"
            body={
              <>
                In the Helius dashboard, hit <Kbd>Endpoints</Kbd> → <Kbd>Create new</Kbd>{" "}
                or use the default project key. Select{" "}
                <span className="font-mono font-bold">Mainnet</span> (or{" "}
                <span className="font-mono font-bold">Devnet</span> while we're
                still pre-launch) and copy the full URL. It looks like:
              </>
            }
            code="https://mainnet.helius-rpc.com/?api-key=YOUR-KEY-HERE"
          />

          <Step
            n={3}
            title="Paste it into the desktop app"
            body={
              <>
                Open Equium Miner, click <Kbd>Settings</Kbd> in the top-right,
                drop the URL into <span className="font-semibold">Custom RPC URL</span>,
                and save. It's stored locally in the app's data folder — never
                transmitted anywhere except to Helius itself.
              </>
            }
          />

          <Callout title="Don't have the desktop app yet?">
            <a
              href="/download"
              className="text-[var(--color-rose)] font-semibold hover:underline"
            >
              Grab the installer →
            </a>{" "}
            macOS, Windows, and Linux builds. Built-in encrypted wallet, no
            extension required.
          </Callout>

          <Callout title="Why does the browser miner not need this?" tone="dim">
            equium.xyz fronts a server-side RPC proxy with per-IP rate limits.
            That's affordable for the small amount of traffic a casual browser
            miner generates. The desktop miner mines harder and more
            consistently — that level of throughput costs real money in RPC
            fees, so it's on the user to bring their own key.
          </Callout>
        </div>
      </div>
      <Footer />
    </main>
  );
}

function Step({
  n,
  title,
  body,
  code,
}: {
  n: number;
  title: string;
  body: React.ReactNode;
  code?: string;
}) {
  return (
    <div className="flex gap-6 mb-9">
      <div className="flex-shrink-0">
        <div className="w-12 h-12 rounded-2xl border-2 border-[var(--color-rose)] bg-[var(--color-rose)]/10 flex items-center justify-center font-black text-[20px] text-[var(--color-rose)]">
          {n}
        </div>
      </div>
      <div className="flex-1 pt-1">
        <h3 className="text-[22px] font-bold tracking-[-0.01em] mb-2">
          {title}
        </h3>
        <div className="text-[15px] leading-[1.65] text-[var(--color-fg-soft)]">
          {body}
        </div>
        {code && (
          <pre className="mt-3 rounded-xl border border-[var(--color-border-bright)] bg-[var(--color-bg)] p-3 font-mono text-[12px] text-[var(--color-teal)] overflow-x-auto">
            {code}
          </pre>
        )}
      </div>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block px-2 py-0.5 rounded font-mono text-[12px] bg-[var(--color-bg-elev)] border border-[var(--color-border)] text-[var(--color-fg)]">
      {children}
    </span>
  );
}

function Callout({
  title,
  children,
  tone = "default",
}: {
  title: string;
  children: React.ReactNode;
  tone?: "default" | "dim";
}) {
  return (
    <div
      className={`rounded-3xl p-6 mb-3 ${
        tone === "dim"
          ? "border border-[var(--color-border)] bg-[var(--color-bg-elev)]"
          : "border border-[var(--color-rose-soft)] bg-[var(--color-rose-soft)]/30"
      }`}
    >
      <h4
        className={`text-[16px] font-bold mb-2 ${
          tone === "dim" ? "text-[var(--color-fg-soft)]" : "text-[var(--color-rose-bright)]"
        }`}
      >
        {title}
      </h4>
      <div className="text-[14px] leading-[1.6] text-[var(--color-fg-dim)]">
        {children}
      </div>
    </div>
  );
}
