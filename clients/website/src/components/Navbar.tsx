"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

const LINKS = [
  { href: "/#how", label: "How" },
  { href: "/#tokenomics", label: "Tokenomics" },
  { href: "/explorer", label: "Explorer" },
  { href: "/mine", label: "Mine", primary: true },
];

const SOCIAL = [
  { href: "https://x.com/EquiumEQM", label: "X" },
  { href: "https://github.com/HannaPrints/equium", label: "GitHub" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <div className="fixed top-0 left-0 right-0 z-50 flex justify-center px-4 pt-5 pointer-events-none">
        <nav
          className={`pointer-events-auto flex items-center gap-1 rounded-full border border-[var(--color-border)] glass px-2 py-2 transition-all duration-300 ${
            scrolled
              ? "shadow-[0_8px_28px_-4px_rgba(0,0,0,0.5)] border-[var(--color-border-bright)]"
              : ""
          }`}
        >
          <Link
            href="/"
            className="flex items-center gap-2.5 pl-3 pr-4 py-1 rounded-full hover:bg-white/[0.03] transition-colors group"
            aria-label="Equium home"
          >
            <Image
              src="/logo.png"
              alt=""
              width={28}
              height={28}
              className="rounded-md transition-transform group-hover:scale-105"
              priority
            />
            <span className="text-[15px] font-bold tracking-tight">
              Equium
            </span>
            <span className="hidden sm:inline text-[11px] font-mono text-[var(--color-rose)] tracking-wider font-semibold pl-1">
              $EQM
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-0.5 pl-2 border-l border-[var(--color-border)] ml-1">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={
                  link.primary
                    ? "flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[var(--color-rose)] text-[var(--color-bg)] text-[13px] font-bold hover:bg-[var(--color-rose-bright)] transition-colors ml-1"
                    : "px-3.5 py-1.5 rounded-full text-[13px] font-medium text-[var(--color-fg-soft)] hover:text-[var(--color-fg)] hover:bg-white/[0.04] transition-colors"
                }
              >
                {link.primary && (
                  <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
                )}
                {link.label}
              </Link>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-0.5 pl-2 ml-1 border-l border-[var(--color-border)]">
            {SOCIAL.map((s) => (
              <a
                key={s.href}
                href={s.href}
                target="_blank"
                rel="noreferrer noopener"
                className="px-3 py-1.5 rounded-full text-[12px] font-mono font-medium text-[var(--color-fg-dim)] hover:text-[var(--color-fg)] hover:bg-white/[0.04] transition-colors"
              >
                {s.label}
              </a>
            ))}
          </div>

          {/* Mobile toggle */}
          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="md:hidden p-2 rounded-full hover:bg-white/[0.04] transition-colors"
            aria-label="Toggle menu"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              className="text-[var(--color-fg-soft)]"
            >
              {mobileOpen ? (
                <>
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </>
              ) : (
                <>
                  <line x1="4" x2="20" y1="8" y2="8" />
                  <line x1="4" x2="20" y1="16" y2="16" />
                </>
              )}
            </svg>
          </button>
        </nav>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 top-[76px] z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute top-2 left-4 right-4 rounded-3xl border border-[var(--color-border-bright)] glass p-3 fade-up">
            <div className="flex flex-col gap-1">
              {LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={
                    link.primary
                      ? "flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-[var(--color-rose)] text-[var(--color-bg)] text-[14px] font-bold mt-1"
                      : "px-4 py-3 rounded-2xl text-[14px] font-medium text-[var(--color-fg-soft)] hover:bg-white/[0.04]"
                  }
                >
                  {link.label}
                </Link>
              ))}
              <div className="grid grid-cols-2 gap-1 mt-2 pt-2 border-t border-[var(--color-border)]">
                {SOCIAL.map((s) => (
                  <a
                    key={s.href}
                    href={s.href}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="px-3 py-2 rounded-2xl text-center text-[12px] font-mono text-[var(--color-fg-dim)] hover:bg-white/[0.04]"
                  >
                    {s.label}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
