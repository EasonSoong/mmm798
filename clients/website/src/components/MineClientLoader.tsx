"use client";

import dynamic from "next/dynamic";

// Wallet adapter + miner engine pull in browser-only APIs (Worker, crypto.subtle,
// localStorage). Skip SSR so they only run in the browser.
const MineClient = dynamic(() => import("./MineClient"), {
  ssr: false,
  loading: () => (
    <div className="text-center py-32 text-[var(--color-fg-dim)]">
      Loading miner…
    </div>
  ),
});

export default function MineClientLoader() {
  return <MineClient />;
}
