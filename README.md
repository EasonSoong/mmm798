<div align="center">

<img src="assets/logo.png" alt="Equium" width="140" />

# Equium

### A CPU-mineable token on Solana

**Bitcoin-style economics. Mine from any machine.**

[Mine in your browser](#-mine-in-your-browser) · [Run the CLI miner](#-run-the-cli-miner) · [What is EQM?](#-what-is-eqm) · [Follow on X](https://x.com/EquiumEQM)

</div>

---

## ✦ What is EQM?

Equium ($EQM) is a fair-launched token on Solana that you mine — like Bitcoin, but with a CPU and a wallet.

| | |
|---|---|
| **Total supply** | 21,000,000 EQM (forever capped) |
| **Mineable** | 18,900,000 EQM (90%) |
| **Block reward** | 25 EQM, halving every ~8.6 months |
| **Block time** | ~1 minute |
| **PoW** | Equihash (96, 5) — runs on any CPU |
| **Network** | Solana (devnet today, mainnet soon) |

No VC allocation. No insider tokens. Every coin in circulation either came from the 10% premine (DEX liquidity + project treasury) or was mined block-by-block by someone running this code.

## ✦ How does mining work?

Your computer guesses random numbers (`nonce`s) until it finds one that, combined with the current network challenge, hashes to a number small enough to win the block. The first valid solution submitted to the chain in each ~1-minute round earns 25 EQM.

The puzzle is **memory-bound, not compute-bound** — that's the point. Equihash is designed so a $40,000 GPU rig isn't meaningfully faster than your CPU. CPUs win.

A few things worth knowing:

- **Solutions are bound to your wallet.** The puzzle includes your public key, so a copyist who tries to front-run your broadcast solution must re-solve from scratch under their own wallet. You don't get sniped.
- **Difficulty auto-adjusts.** Every 60 blocks the network retargets so blocks keep landing roughly every minute, regardless of how many people are mining.
- **Rewards halve over time.** Initial 25 EQM/block → 12.5 → 6.25 → … forever. Mirrors Bitcoin's emission curve.
- **Empty rounds are possible.** If nobody mines a given round, the reward stays in the program-owned vault permanently. Real fixed supply, no IOUs.

## ✦ Mine in your browser

The easiest way to start: open [the web miner](#) in any modern browser, connect Phantom or Solflare, click **Start Mining**. Everything happens client-side in a Web Worker — your wallet never leaves your device.

> _Hosted miner link goes here once we deploy the frontend._

If you want to run the web miner locally:

```bash
git clone https://github.com/HannaPrints/equium.git
cd equium/clients/web-miner/app
npm install
npm run dev
# open http://localhost:5173
```

The browser miner works on phones too — Equihash (96, 5) only needs ~50 MB of RAM, well within mobile WASM limits.

## ✦ Run the CLI miner

For dedicated mining (longer sessions, multiple cores eventually), use the Rust binary. It's faster than the browser solver and prints live stats.

```bash
git clone https://github.com/HannaPrints/equium.git
cd equium
cargo build -p equium-cli-miner --release

./target/release/equium-miner \
  --rpc-url https://api.devnet.solana.com \
  --keypair ~/.config/solana/id.json
```

Your wallet needs a small amount of SOL for transaction fees (under 0.001 SOL per block). Mined EQM lands in your wallet's associated token account automatically.

```
$ equium-miner --rpc-url https://api.devnet.solana.com --keypair my-wallet.json
[INFO] equium-miner starting:
[INFO]   miner: 8x9k…RyW
[INFO] round opened: height=42 target=10ffff…ffff epoch_reward=25000000 (n=96, k=5)
[INFO]   solved in 6312ms after 14 nonce attempt(s); soln=68B
[INFO]   ✓ block 42 confirmed in 933ms (sig: 4xZ9…Ks2)
```

## ✦ Where to find us

- 🐦 X: [**@EquiumEQM**](https://x.com/EquiumEQM)
- 💻 GitHub: [HannaPrints/equium](https://github.com/HannaPrints/equium)
- 🔗 Solana program: [`ZKGMUfxiRCXFPnqz9zgqAnuqJy15jk7fKbR4o6FuEQM`](https://explorer.solana.com/address/ZKGMUfxiRCXFPnqz9zgqAnuqJy15jk7fKbR4o6FuEQM?cluster=devnet) (devnet)

The mint address is intentionally not listed here pre-mainnet. The miner reads it from the on-chain program config when you connect, so you don't need to know it yourself.

## ✦ FAQ

**Will I make money mining EQM?** Maybe. Maybe not. Don't quit your job. Treat this like distributed sudoku that occasionally gives you internet money.

**What if my computer is slow?** It mines slower. The network adjusts difficulty so blocks come at the same rate regardless of total hashrate, but your *share* of those blocks scales with your CPU. A modest machine will still earn — just less than a workstation.

**Can someone steal my work?** No. Solutions are cryptographically bound to the wallet that signs the transaction. If you broadcast a winning solution and someone copies the bytes, the chain rejects their tx because the puzzle includes their wallet address, not yours.

**Why Solana?** Cheap fees. A `mine` transaction costs a fraction of a cent. The same protocol on Ethereum mainnet would cost more in gas than the block reward is worth.

**Is the supply really capped at 21M?** Yes. The mint authority will be revoked before mainnet — at the SPL Token level, no more EQM can ever be created.

**Where do I get help?** [Open a GitHub issue](https://github.com/HannaPrints/equium/issues) or hit us up on [X](https://x.com/EquiumEQM).

## ✦ License

[Apache-2.0](LICENSE). The protocol is open-source — fork it, audit it, run your own miner.

<div align="center">

<sub>Equium isn't an investment. It's a fair-launched experiment in CPU-mineable money on a fast chain.</sub>

</div>
