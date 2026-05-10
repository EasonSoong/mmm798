"use client";

import { WalletProviders } from "./WalletProvider";
import { MineDashboard } from "./MineDashboard";

export default function MineClient() {
  return (
    <WalletProviders>
      <MineDashboard />
    </WalletProviders>
  );
}
