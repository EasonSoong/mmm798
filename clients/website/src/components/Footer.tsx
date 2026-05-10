import Image from "next/image";
import Link from "next/link";

export function Footer() {
  return (
    <footer className="relative border-t border-[var(--color-border)] mt-20">
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid md:grid-cols-12 gap-10">
          <div className="md:col-span-5">
            <Link href="/" className="inline-flex items-center gap-3 group">
              <Image
                src="/logo.png"
                alt=""
                width={40}
                height={40}
                className="rounded-lg"
              />
              <div>
                <div className="text-[20px] font-bold tracking-tight">
                  Equium
                </div>
                <div className="text-[11px] font-mono text-[var(--color-rose)] tracking-wider font-semibold">
                  $EQM · Solana
                </div>
              </div>
            </Link>
            <p className="mt-5 text-[14px] leading-[1.6] text-[var(--color-fg-dim)] max-w-sm">
              CPU-mineable token on Solana. Bitcoin-style economics — 21M cap,
              halvings, fair launch. Mine it, or trade what others mined.
            </p>
          </div>

          <FooterCol
            title="Protocol"
            items={[
              { label: "How it works", href: "/#how" },
              { label: "Tokenomics", href: "/#tokenomics" },
              { label: "Explorer", href: "/explorer" },
              { label: "Mine", href: "/mine" },
            ]}
          />
          <FooterCol
            title="Build"
            items={[
              { label: "GitHub", href: "https://github.com/HannaPrints/equium" },
              {
                label: "CLI miner",
                href: "https://github.com/HannaPrints/equium#run-the-cli-miner",
              },
              {
                label: "Contributing",
                href: "https://github.com/HannaPrints/equium/blob/master/CONTRIBUTING.md",
              },
              { label: "License", href: "https://github.com/HannaPrints/equium/blob/master/LICENSE" },
            ]}
          />
          <FooterCol
            title="Network"
            items={[
              { label: "X / Twitter", href: "https://x.com/EquiumEQM" },
              {
                label: "Solana Explorer",
                href: "https://explorer.solana.com/address/ZKGMUfxiRCXFPnqz9zgqAnuqJy15jk7fKbR4o6FuEQM?cluster=devnet",
              },
            ]}
          />
        </div>

        <div className="mt-14 pt-6 border-t border-[var(--color-border)] flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <p className="text-[12px] font-mono text-[var(--color-fg-dim)]">
            <span className="text-[var(--color-fg-faint)]">program</span>{" "}
            ZKGMUfxiRCXFPnqz9zgqAnuqJy15jk7fKbR4o6FuEQM
          </p>
          <p className="text-[11px] text-[var(--color-fg-faint)]">
            Equium isn't an investment. It's a fair-launched experiment in
            CPU-mineable money on a fast chain.
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  items,
}: {
  title: string;
  items: { label: string; href: string }[];
}) {
  return (
    <div className="md:col-span-2">
      <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--color-fg-dim)] mb-4 font-semibold">
        {title}
      </div>
      <ul className="space-y-2.5">
        {items.map((item) => (
          <li key={item.label}>
            <a
              href={item.href}
              target={item.href.startsWith("http") ? "_blank" : undefined}
              rel={item.href.startsWith("http") ? "noreferrer noopener" : undefined}
              className="text-[14px] text-[var(--color-fg-soft)] hover:text-[var(--color-rose)] transition-colors"
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
