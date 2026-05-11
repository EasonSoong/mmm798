import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { DownloadButtons } from "@/components/DownloadButtons";

export const metadata = {
  title: "Download Equium Miner",
  description:
    "Three ways to mine Equium ($EQM): native desktop installers for macOS/Windows/Linux, a browser miner, and a Rust CLI reference miner. Same protocol, same on-chain output.",
};

export default function DownloadPage() {
  return (
    <main>
      <Navbar />
      <div className="pt-32 pb-20 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-[var(--color-rose)] mb-3 font-semibold">
            Mine Equium
          </div>
          <h1 className="text-[40px] md:text-[52px] font-black tracking-[-0.025em] leading-[1.05] mb-5">
            Pick a miner.
          </h1>
          <p className="text-[17px] leading-[1.6] text-[var(--color-fg-dim)] max-w-2xl mb-10">
            Three reference miners. All three produce identical on-chain
            transactions and use the same Equihash 96,5 puzzle. Pick whichever
            fits how you want to run things.
          </p>

          {/* Three-way chooser */}
          <div className="grid sm:grid-cols-3 gap-3 mb-12">
            <Chooser
              kicker="Browser"
              title="No install"
              body="One click on equium.xyz/mine. Built-in wallet, our RPC proxy. Best for casual mining and trying things out."
              href="/mine"
              cta="Open in browser →"
            />
            <Chooser
              kicker="Desktop"
              title="Recommended"
              body="Native app for macOS, Windows, Linux. Encrypted local wallet. Bring your own RPC. Best for sustained mining."
              href="#desktop-install"
              cta="See installers ↓"
              highlight
            />
            <Chooser
              kicker="CLI"
              title="Headless"
              body="Reference Rust miner. Point it at any keypair file and an RPC URL. Best for servers and pinning to a specific version."
              href="#cli-miner"
              cta="Build from source ↓"
            />
          </div>

          {/* Desktop install */}
          <section id="desktop-install" className="scroll-mt-32">
            <h2 className="text-[24px] font-bold tracking-[-0.015em] mb-2">
              Desktop installers
            </h2>
            <p className="text-[14px] text-[var(--color-fg-dim)] mb-6">
              Auto-detected for your platform. All builds are reproducible from
              the source in <code className="font-mono text-[12.5px] text-[var(--color-teal)]">clients/desktop-miner</code>.
            </p>
            <DownloadButtons />

            <div className="mt-10 space-y-6">
              <Note title="What you need">
                <ul className="list-disc pl-6 space-y-2 text-[14.5px] leading-[1.6] text-[var(--color-fg-dim)]">
                  <li>
                    macOS 11+ (Apple Silicon or Intel), Windows 10/11, or
                    x86_64 Linux.
                  </li>
                  <li>
                    ~0.005 SOL in your generated wallet for transaction fees.
                    Each mining attempt is a Solana transaction; that's about
                    30 attempts per dollar.
                  </li>
                  <li>
                    A Solana RPC endpoint. The default public endpoint works
                    for testing;{" "}
                    <Link
                      href="/docs/rpc"
                      className="text-[var(--color-rose)] hover:underline"
                    >
                      grab a free Helius key
                    </Link>{" "}
                    for sustained mining.
                  </li>
                </ul>
              </Note>

              <Note title="How it works">
                <ol className="list-decimal pl-6 space-y-2 text-[14.5px] leading-[1.6] text-[var(--color-fg-dim)]">
                  <li>Open the app, create a wallet, back up the secret key.</li>
                  <li>
                    Send a small amount of SOL to the address shown. Any Solana
                    wallet will work since it is a regular address.
                  </li>
                  <li>
                    Click <span className="font-mono font-semibold">Start mining</span>.
                    The app runs Equihash on your CPU and submits valid solutions
                    directly to Solana. Each block credits 25 EQM to your wallet.
                  </li>
                </ol>
              </Note>

              <Note title="Security">
                <p className="text-[14.5px] leading-[1.6] text-[var(--color-fg-dim)]">
                  Secret keys are encrypted with{" "}
                  <span className="font-mono font-semibold">Argon2id + AES-256-GCM</span>{" "}
                  under your password and stored in the app's local data folder.
                  The plaintext only exists in memory while the wallet is unlocked.
                  Nothing leaves your machine except RPC traffic.
                </p>
              </Note>
            </div>
          </section>

          {/* CLI miner */}
          <section id="cli-miner" className="mt-16 scroll-mt-32">
            <h2 className="text-[24px] font-bold tracking-[-0.015em] mb-2">
              CLI miner
            </h2>
            <p className="text-[14px] text-[var(--color-fg-dim)] mb-6">
              The reference implementation. Pure Rust, single binary, runs
              anywhere you can compile it. Use it when you want a headless
              setup on a server or when you'd rather pin to a specific commit
              than auto-update.
            </p>

            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elev)] p-6 space-y-4">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--color-fg-dim)] mb-2 font-semibold">
                  Build from source
                </div>
                <pre className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4 overflow-x-auto font-mono text-[12.5px] leading-[1.7] text-[var(--color-fg-soft)]">{`git clone https://github.com/HannaPrints/equium
cd equium/clients/cli-miner
cargo build --release`}</pre>
              </div>

              <div>
                <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--color-fg-dim)] mb-2 font-semibold">
                  Run it
                </div>
                <pre className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4 overflow-x-auto font-mono text-[12.5px] leading-[1.7] text-[var(--color-fg-soft)]">{`./target/release/equium-miner \\
  --rpc-url https://mainnet.helius-rpc.com/?api-key=YOUR_KEY \\
  --keypair ~/.config/solana/id.json`}</pre>
              </div>

              <p className="text-[13px] text-[var(--color-fg-dim)] leading-[1.6]">
                The CLI miner uses an existing Solana keypair file. Generate one
                with <code className="font-mono text-[12px] text-[var(--color-teal)]">solana-keygen new</code>{" "}
                or export from any wallet. Pass <code className="font-mono text-[12px] text-[var(--color-teal)]">--max-blocks N</code>{" "}
                to stop after N successful mines, or omit it to run indefinitely.
              </p>

              <div className="pt-2 border-t border-[var(--color-border)]">
                <a
                  href="https://github.com/HannaPrints/equium/tree/master/clients/cli-miner"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--color-rose)] hover:underline"
                >
                  Source on GitHub →
                </a>
              </div>
            </div>
          </section>

          {/* All paths */}
          <section className="mt-16">
            <h2 className="text-[20px] font-bold tracking-[-0.015em] mb-3">
              Which one should I use?
            </h2>
            <p className="text-[14.5px] leading-[1.6] text-[var(--color-fg-dim)] mb-3">
              All three submit the same <code className="font-mono text-[12.5px] text-[var(--color-teal)]">mine</code>{" "}
              transactions to the same on-chain program. Pick on operational
              taste:
            </p>
            <ul className="list-disc pl-6 space-y-1.5 text-[14.5px] leading-[1.6] text-[var(--color-fg-dim)]">
              <li>
                Want to try things out without committing? Browser miner.
              </li>
              <li>
                Want a persistent local app with the highest single-CPU
                throughput? Desktop miner.
              </li>
              <li>
                Want to run on a VPS, in a Docker container, or alongside other
                services? CLI miner.
              </li>
            </ul>
          </section>
        </div>
      </div>
      <Footer />
    </main>
  );
}

function Chooser({
  kicker,
  title,
  body,
  href,
  cta,
  highlight,
}: {
  kicker: string;
  title: string;
  body: string;
  href: string;
  cta: string;
  highlight?: boolean;
}) {
  const Tag = href.startsWith("#") || href.startsWith("/") ? Link : "a";
  const linkProps = href.startsWith("#") || href.startsWith("/")
    ? { href }
    : { href, target: "_blank", rel: "noreferrer noopener" };
  return (
    <Tag
      {...(linkProps as any)}
      className={`rounded-2xl border p-5 flex flex-col gap-2 transition-colors group ${
        highlight
          ? "border-[var(--color-rose-soft)] bg-[var(--color-rose-soft)]/[0.08] hover:border-[var(--color-rose)]"
          : "border-[var(--color-border)] bg-[var(--color-bg-elev)] hover:border-[var(--color-border-bright)]"
      }`}
    >
      <div
        className={`text-[10px] font-mono uppercase tracking-[0.2em] font-semibold ${
          highlight
            ? "text-[var(--color-rose)]"
            : "text-[var(--color-fg-dim)]"
        }`}
      >
        {kicker}
      </div>
      <div className="text-[17px] font-bold tracking-[-0.01em]">{title}</div>
      <p className="text-[13.5px] leading-[1.55] text-[var(--color-fg-dim)] flex-1">
        {body}
      </p>
      <div
        className={`text-[12.5px] font-semibold mt-2 ${
          highlight
            ? "text-[var(--color-rose)]"
            : "text-[var(--color-fg-soft)] group-hover:text-[var(--color-fg)]"
        }`}
      >
        {cta}
      </div>
    </Tag>
  );
}

function Note({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elev)] p-5 md:p-6">
      <h3 className="text-[16px] font-bold tracking-[-0.01em] mb-2.5">
        {title}
      </h3>
      {children}
    </section>
  );
}
