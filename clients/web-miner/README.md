# Equium browser miner

WASM Equihash solver + React UI. Connects via Solana Wallet Adapter
(Phantom, Solflare), solves blocks in a Web Worker so the page stays
responsive, submits the `mine` ix through the user's wallet.

## Layout

```
clients/web-miner/
├── wasm/      cdylib crate that wraps equihash_core::solver
└── app/       Vite + React + TS frontend
```

## Build the WASM bundle

The frontend depends on `equium-wasm` from `wasm/pkg/`, produced by
`wasm-pack`. Rebuild whenever `equihash-core` or the wrapper changes:

```bash
cd clients/web-miner/wasm
wasm-pack build --target web --release
```

Output lands in `clients/web-miner/wasm/pkg/` (gitignored — you build it
locally).

## Run the dev server

```bash
cd clients/web-miner/app
cp .env.example .env.local        # set VITE_RPC_URL / VITE_CLUSTER
npm install                       # or yarn / pnpm
npm run dev
# open http://localhost:5173
```

The app expects the Anchor IDL at `app/src/idl.json`. Re-copy it after every
program rebuild:

```bash
cp ../../../target/idl/equium.json app/src/idl.json
```

## How it works

1. On wallet connect, the app fetches the `EquiumConfig` PDA every 5 s
   (block height, current challenge, target, epoch reward, `mining_open`).
2. **Start mining** spawns a `solver.worker.ts` Web Worker that loads the
   WASM module and runs `solve_block(...)` against the current challenge.
3. When a candidate solution comes back, the main thread hashes it locally
   (`SHA256(soln_indices || I)`) and compares to the on-chain target. If
   above-target, retry without the RPC roundtrip.
4. Otherwise build a `mine` tx, hand it to the wallet adapter for signing,
   and broadcast.

The solver is single-threaded WASM. Solve time on a modern machine:
~1–3 s per nonce attempt for (96, 5). Multi-threaded WASM (Rayon +
SharedArrayBuffer) is a future optimization.
