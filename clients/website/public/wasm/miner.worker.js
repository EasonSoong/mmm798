// Module worker that hosts the Equihash WASM solver.
// The main thread posts SolveRequest messages; the worker posts SolveResponse
// messages back. Worker decoupling keeps the UI 60fps while the solver grinds.

import init, { solve_block } from "/wasm/equium_wasm.js";

let ready = null;

self.onmessage = async (event) => {
  const req = event.data;
  if (!req || req.type !== "solve") return;

  if (!ready) {
    ready = init();
  }
  try {
    await ready;
    const t0 = performance.now();
    const result = solve_block(
      req.n,
      req.k,
      req.challenge,
      req.miner,
      BigInt(req.height),
      req.maxAttempts,
      req.seed
    );
    const solveMs = performance.now() - t0;

    if (!result) {
      self.postMessage({
        type: "no-solution",
        jobId: req.jobId,
        attempts: req.maxAttempts,
        solveMs,
      });
      return;
    }

    self.postMessage({
      type: "solved",
      jobId: req.jobId,
      nonce: result.nonce,
      solnIndices: result.soln_indices,
      attempts: result.attempts,
      solveMs,
    });
  } catch (e) {
    self.postMessage({
      type: "error",
      jobId: req.jobId,
      message: String(e && e.message ? e.message : e),
    });
  }
};
