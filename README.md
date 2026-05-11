<div align="center">

<img src="assets/logo.png" alt="Equium" width="140" />

# Equium

### A CPU-mineable token on Solana

**Bitcoin-style economics. Mine from any machine.**

[Mine in your browser](https://equium.xyz/mine) · [Desktop app](https://equium.xyz/download) · [CLI miner](#-cli-miner) · [Docs](https://equium.xyz/docs) · [Follow on X](https://x.com/EquiumEQM)

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

## ✦ Three ways to mine

All three reference miners are first-class. They submit the same `mine` transactions to the same on-chain program, so the on-chain output is identical. Pick the one that fits your setup.

| | What | Best for |
|---|---|---|
| **Browser** | [equium.xyz/mine](https://equium.xyz/mine) | No install, no RPC setup. Casual mining and trying things out. Built-in encrypted wallet stored in your browser. |
| **Desktop app** | [equium.xyz/download](https://equium.xyz/download) | Native macOS / Windows / Linux. Encrypted local wallet (Argon2id + AES-256-GCM). Bring your own RPC. |
| **CLI miner** | `clients/cli-miner` (see below) | Headless, server-friendly, single binary. Reads an existing Solana keypair file. |

The browser miner is the easiest to try; the desktop app is the recommended steady-state setup; the CLI is what you want on a VPS or alongside other services.

## ✦ CLI miner

The reference Rust implementation. Single binary, no dependencies beyond what `cargo` produces.

```bash
git clone https://github.com/HannaPrints/equium.git
cd equium
cargo build -p equium-cli-miner --release

./target/release/equium-miner \
  --rpc-url https://mainnet.helius-rpc.com/?api-key=YOUR_KEY \
  --keypair ~/.config/solana/id.json
```

The CLI uses an existing Solana keypair file. Generate one with `solana-keygen new` or export from any wallet. It needs a small amount of SOL for transaction fees (under 0.001 SOL per block); mined EQM lands in the wallet's associated token account automatically.

Pass `--max-blocks N` to stop after N successful mines, or omit it to run indefinitely. Run with `--help` for the full flag set.

```
$ equium-miner --rpc-url https://api.devnet.solana.com --keypair my-wallet.json
   round #42   reward 25 EQM   target 0x10ffff…
     · try #1   above target        587ms   1.7 H/s
     · try #2   above target        612ms   1.6 H/s
     ✓ MINED!   +25 EQM     try #3   601ms   1.6 H/s
       sig 4xZ9Ks…2pH8Yt
```

A free Helius key (see [docs/rpc](https://equium.xyz/docs/rpc)) is recommended for sustained mining; the default public Solana endpoints rate-limit aggressively under load.

## ✦ Where to find us

- Website: [equium.xyz](https://equium.xyz)
- Docs: [equium.xyz/docs](https://equium.xyz/docs)
- X: [**@EquiumEQM**](https://x.com/EquiumEQM)
- GitHub: [HannaPrints/equium](https://github.com/HannaPrints/equium)
- Solana program: [`ZKGMUfxiRCXFPnqz9zgqAnuqJy15jk7fKbR4o6FuEQM`](https://explorer.solana.com/address/ZKGMUfxiRCXFPnqz9zgqAnuqJy15jk7fKbR4o6FuEQM?cluster=devnet) (devnet)
- $EQM mint (mainnet): [`1MhvZzEe8gQ8Rb9CrT3Dn26Gkn9QRErzLMGkkTwveqm`](https://solscan.io/token/1MhvZzEe8gQ8Rb9CrT3Dn26Gkn9QRErzLMGkkTwveqm)

The mainnet mint is created and reserved; the on-chain program is currently active on devnet for testing. Always verify the mint address before buying on a DEX.

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
