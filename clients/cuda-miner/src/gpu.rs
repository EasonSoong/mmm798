//! GPU dispatch layer for the Equium (96,5) CUDA solver.
//!
//! Owns device buffers, compiles the kernel via NVRTC at startup, and exposes
//! `solve_nonce` — one round of Wagner's algorithm on a single (input, nonce)
//! pair. The host loop in `main.rs` drives nonce selection, randomization,
//! and on-chain submission; this module is purely the GPU half.
//!
//! Lifecycle:
//!   1. `GpuSolver::new(device_ordinal)` — picks GPU, compiles PTX, allocs.
//!   2. `solver.set_nonce_base(input, nonce)` — uploads per-nonce 113-byte
//!      prefix (I || nonce). Cheap; just one small htod copy.
//!   3. `solver.solve()` — runs 1 leaf-gen + 5 collision rounds + 1 filter,
//!      returns raw uncompressed 32-index solutions found.
//!
//! Verification (`equihash::is_valid_solution`) happens on the host before
//! we trust a solution enough to submit. The kernel is correctness-first,
//! not adversarial-input-safe.

use std::sync::Arc;

use anyhow::{anyhow, Context, Result};
use cudarc::driver::{CudaDevice, CudaSlice, LaunchAsync, LaunchConfig};
use cudarc::nvrtc::compile_ptx;

// ─── Tunables. Must match constants in kernel.cu. ─────────────────────
pub const MAX_HASH_BYTES: usize = 12;
pub const MAX_INDICES: usize = 32;
pub const NUM_BUCKETS: usize = 65536;
pub const MAX_BUCKET: usize = 16;

/// Initial leaf count per nonce for (96, 5): 2^(cbits+1) = 2^17.
pub const N_INIT: u32 = 1u32 << 17;

/// 2× headroom over `N_INIT` for table growth between rounds. With the
/// expected per-bucket load of 2, table size is approximately conserved
/// across rounds, but variance is non-trivial. Overflow truncates and is
/// logged; we just lose some candidate solutions.
pub const MAX_ROWS: u32 = N_INIT * 2;

/// Max distinct solutions we'll return per nonce. Equihash typically yields
/// O(1) solutions per nonce; 64 is overkill for safety.
pub const MAX_SOLUTIONS: u32 = 64;

const MODULE: &str = "equium";
const KERNEL_SRC: &str = include_str!("kernel.cu");

/// 8 BLAKE2b initial words for n=96 personalization with digest length 60.
/// Precomputed here so we don't ship a BLAKE2b parameter block to the GPU.
fn blake2b_init_h(n: u32, k: u32) -> [u64; 8] {
    const IV: [u64; 8] = [
        0x6a09e667f3bcc908, 0xbb67ae8584caa73b,
        0x3c6ef372fe94f82b, 0xa54ff53a5f1d36f1,
        0x510e527fade682d1, 0x9b05688c2b3e6c1f,
        0x1f83d9abfb41bd6b, 0x5be0cd19137e2179,
    ];
    let indices_per = (512 / n) as u64;
    let digest_len = indices_per * (n as u64) / 8; // 60 for n=96

    let mut h = IV;
    // Word 0 = digest_len | (key=0)<<8 | (fanout=1)<<16 | (depth=1)<<24 | (leaf_len=0)<<32
    h[0] ^= digest_len | (1u64 << 16) | (1u64 << 24);
    // Words 4, 5: salt = 0 (no XOR).
    // Word 6: personalization[0..8] = "ZcashPoW".
    h[6] ^= u64::from_le_bytes(*b"ZcashPoW");
    // Word 7: personalization[8..16] = n.to_le_bytes() || k.to_le_bytes().
    let mut buf = [0u8; 8];
    buf[0..4].copy_from_slice(&n.to_le_bytes());
    buf[4..8].copy_from_slice(&k.to_le_bytes());
    h[7] ^= u64::from_le_bytes(buf);
    h
}

/// Build the 113-byte prefix (I || nonce) that every BLAKE2b call for this
/// nonce starts from. `I` is the 81-byte input block built by `build_input`.
fn build_prefix(input: &[u8; 81], nonce: &[u8; 32]) -> [u8; 113] {
    let mut buf = [0u8; 113];
    buf[..81].copy_from_slice(input);
    buf[81..].copy_from_slice(nonce);
    buf
}

pub struct GpuSolver {
    dev: Arc<CudaDevice>,
    // Per-nonce uploads.
    d_h_init: CudaSlice<u64>,
    d_prefix: CudaSlice<u8>,
    // Ping-pong tables.
    d_hashes_a: CudaSlice<u8>,
    d_hashes_b: CudaSlice<u8>,
    d_indices_a: CudaSlice<u32>,
    d_indices_b: CudaSlice<u32>,
    d_count_a: CudaSlice<u32>,
    d_count_b: CudaSlice<u32>,
    // Bucket scratch.
    d_bucket_count: CudaSlice<u32>,
    d_bucket_slots: CudaSlice<u32>,
    // Solutions output.
    d_solutions: CudaSlice<u32>,
    d_solution_count: CudaSlice<u32>,
}

impl GpuSolver {
    pub fn new(device_ordinal: usize) -> Result<Self> {
        let dev = CudaDevice::new(device_ordinal)
            .with_context(|| format!("CudaDevice::new({})", device_ordinal))?;

        let ptx = compile_ptx(KERNEL_SRC).context("NVRTC compile kernel.cu")?;
        dev.load_ptx(
            ptx,
            MODULE,
            &[
                "blake2b_leaves",
                "clear_buckets",
                "reset_counter",
                "fill_buckets",
                "collide",
                "filter_zero",
            ],
        )
        .context("load_ptx")?;

        let hash_buf_len = (MAX_ROWS as usize) * MAX_HASH_BYTES;
        let idx_buf_len = (MAX_ROWS as usize) * MAX_INDICES;
        let bucket_slots_len = NUM_BUCKETS * MAX_BUCKET;
        let solutions_len = (MAX_SOLUTIONS as usize) * MAX_INDICES;

        Ok(Self {
            d_h_init: dev.alloc_zeros::<u64>(8)?,
            d_prefix: dev.alloc_zeros::<u8>(113)?,
            d_hashes_a: dev.alloc_zeros::<u8>(hash_buf_len)?,
            d_hashes_b: dev.alloc_zeros::<u8>(hash_buf_len)?,
            d_indices_a: dev.alloc_zeros::<u32>(idx_buf_len)?,
            d_indices_b: dev.alloc_zeros::<u32>(idx_buf_len)?,
            d_count_a: dev.alloc_zeros::<u32>(1)?,
            d_count_b: dev.alloc_zeros::<u32>(1)?,
            d_bucket_count: dev.alloc_zeros::<u32>(NUM_BUCKETS)?,
            d_bucket_slots: dev.alloc_zeros::<u32>(bucket_slots_len)?,
            d_solutions: dev.alloc_zeros::<u32>(solutions_len)?,
            d_solution_count: dev.alloc_zeros::<u32>(1)?,
            dev,
        })
    }

    pub fn device_name(&self) -> String {
        self.dev.name().unwrap_or_else(|_| "unknown".to_string())
    }

    /// Try a single nonce. Returns 0..N candidate solutions (uncompressed
    /// 32-index vectors). Each candidate still needs host-side validation
    /// before it can be submitted.
    pub fn solve_nonce(
        &mut self,
        n: u32,
        k: u32,
        input: &[u8; 81],
        nonce: &[u8; 32],
    ) -> Result<Vec<[u32; MAX_INDICES]>> {
        if n != 96 || k != 5 {
            return Err(anyhow!(
                "GPU solver currently locked to (96, 5); got ({}, {})",
                n,
                k
            ));
        }

        // 1. Upload per-nonce inputs (H state + prefix).
        let h_init = blake2b_init_h(n, k);
        self.dev.htod_sync_copy_into(&h_init, &mut self.d_h_init)?;
        let prefix = build_prefix(input, nonce);
        self.dev.htod_sync_copy_into(&prefix, &mut self.d_prefix)?;

        // 2. Zero the solution counter (the leaf-gen kernel will overwrite count_a).
        dev_zero_one(&self.dev, &mut self.d_solution_count)?;

        // 3. Leaf generation → table A.
        let n_counters = (N_INIT + 4) / 5;
        let cfg = launch_cfg_1d(n_counters, 128);
        let f = self
            .dev
            .get_func(MODULE, "blake2b_leaves")
            .ok_or_else(|| anyhow!("missing kernel blake2b_leaves"))?;
        unsafe {
            f.launch(
                cfg,
                (
                    &self.d_h_init,
                    &self.d_prefix,
                    N_INIT,
                    &mut self.d_hashes_a,
                    &mut self.d_indices_a,
                    &mut self.d_count_a,
                ),
            )?;
        }

        // 4. Five Wagner rounds. Each round bucket-sorts the current table
        //    and produces the next one in the other slot.
        //    Hash byte schedule for (96,5): 12 → 10 → 8 → 6 → 4 → 2.
        //    Indices-per schedule:           1 → 2  → 4 → 8 → 16 → 32.
        let hash_bytes_schedule = [12u32, 10, 8, 6, 4, 2];
        let indices_schedule = [1u32, 2, 4, 8, 16, 32];

        for round in 0..5 {
            let hash_in = hash_bytes_schedule[round];
            let indices_in = indices_schedule[round];

            // a/b swap: rounds 0,2,4 read A, write B. Rounds 1,3 read B, write A.
            let read_from_a = round % 2 == 0;

            self.run_round(round, hash_in, indices_in, read_from_a)?;
        }

        // 5. After 5 rounds, the "live" table is in A (round 4 wrote into B
        //    when read_from_a was true... wait, let's trace: round 0 reads A
        //    writes B; round 1 reads B writes A; round 2 reads A writes B;
        //    round 3 reads B writes A; round 4 reads A writes B. So the
        //    final post-round-4 table lives in B.
        let final_in_b = true;
        dev_zero_one(&self.dev, &mut self.d_solution_count)?;
        let final_count = dev_read_count(
            &self.dev,
            if final_in_b { &self.d_count_b } else { &self.d_count_a },
        )?;
        if final_count > 0 {
            let cfg = launch_cfg_1d(final_count, 128);
            let f = self
                .dev
                .get_func(MODULE, "filter_zero")
                .ok_or_else(|| anyhow!("missing kernel filter_zero"))?;
            let (hashes, indices) = if final_in_b {
                (&self.d_hashes_b, &self.d_indices_b)
            } else {
                (&self.d_hashes_a, &self.d_indices_a)
            };
            unsafe {
                f.launch(
                    cfg,
                    (
                        hashes,
                        indices,
                        final_count,
                        &mut self.d_solutions,
                        &mut self.d_solution_count,
                        MAX_SOLUTIONS,
                    ),
                )?;
            }
        }

        // 6. Copy solutions back. Bound by MAX_SOLUTIONS regardless of how
        //    many overflowed.
        let sol_count = dev_read_count(&self.dev, &self.d_solution_count)?.min(MAX_SOLUTIONS);
        if sol_count == 0 {
            return Ok(Vec::new());
        }
        let mut host_sols: Vec<u32> = vec![0u32; (sol_count as usize) * MAX_INDICES];
        // dtoh_sync_copy reads the whole buffer; slice afterward.
        let all = self.dev.dtoh_sync_copy(&self.d_solutions)?;
        host_sols.copy_from_slice(&all[..host_sols.len()]);

        let mut out = Vec::with_capacity(sol_count as usize);
        for i in 0..(sol_count as usize) {
            let mut arr = [0u32; MAX_INDICES];
            arr.copy_from_slice(&host_sols[i * MAX_INDICES..(i + 1) * MAX_INDICES]);
            out.push(arr);
        }
        Ok(out)
    }

    fn run_round(
        &mut self,
        round: usize,
        hash_bytes_in: u32,
        indices_per_in: u32,
        read_from_a: bool,
    ) -> Result<()> {
        // Read which table we're collapsing, write into the other slot.
        let count_in = dev_read_count(
            &self.dev,
            if read_from_a { &self.d_count_a } else { &self.d_count_b },
        )?;
        if count_in == 0 {
            // Nothing to do; later rounds will see count_out = 0.
            dev_zero_one(
                &self.dev,
                if read_from_a { &mut self.d_count_b } else { &mut self.d_count_a },
            )?;
            return Ok(());
        }

        // Clear buckets.
        let cfg = launch_cfg_1d(NUM_BUCKETS as u32, 256);
        let f = self
            .dev
            .get_func(MODULE, "clear_buckets")
            .ok_or_else(|| anyhow!("missing kernel clear_buckets"))?;
        unsafe { f.launch(cfg, (&mut self.d_bucket_count,))?; }

        // Fill buckets from the input table.
        let cfg = launch_cfg_1d(count_in, 256);
        let f = self
            .dev
            .get_func(MODULE, "fill_buckets")
            .ok_or_else(|| anyhow!("missing kernel fill_buckets"))?;
        let hashes_in_ref = if read_from_a { &self.d_hashes_a } else { &self.d_hashes_b };
        unsafe {
            f.launch(
                cfg,
                (
                    hashes_in_ref,
                    count_in,
                    hash_bytes_in,
                    &mut self.d_bucket_count,
                    &mut self.d_bucket_slots,
                ),
            )?;
        }

        // Reset the output count.
        dev_zero_one(
            &self.dev,
            if read_from_a { &mut self.d_count_b } else { &mut self.d_count_a },
        )?;

        // Collide: 1 block per bucket, fixed block size for pair enumeration.
        // With MAX_BUCKET=16 → ≤120 pairs per bucket; 32 threads is plenty.
        let cfg = LaunchConfig {
            grid_dim: (NUM_BUCKETS as u32, 1, 1),
            block_dim: (32, 1, 1),
            shared_mem_bytes: 0,
        };
        let f = self
            .dev
            .get_func(MODULE, "collide")
            .ok_or_else(|| anyhow!("missing kernel collide"))?;

        // The borrow checker dislikes simultaneous &/&mut on `self` fields,
        // so we split with explicit non-overlapping refs.
        let _ = round; // not used; kept for future per-round tuning hooks
        if read_from_a {
            let (hashes_in, indices_in, hashes_out, indices_out, count_out) = (
                &self.d_hashes_a,
                &self.d_indices_a,
                &mut self.d_hashes_b,
                &mut self.d_indices_b,
                &mut self.d_count_b,
            );
            unsafe {
                f.launch(
                    cfg,
                    (
                        hashes_in,
                        indices_in,
                        &self.d_bucket_count,
                        &self.d_bucket_slots,
                        hash_bytes_in,
                        indices_per_in,
                        hashes_out,
                        indices_out,
                        count_out,
                        MAX_ROWS,
                    ),
                )?;
            }
        } else {
            let (hashes_in, indices_in, hashes_out, indices_out, count_out) = (
                &self.d_hashes_b,
                &self.d_indices_b,
                &mut self.d_hashes_a,
                &mut self.d_indices_a,
                &mut self.d_count_a,
            );
            unsafe {
                f.launch(
                    cfg,
                    (
                        hashes_in,
                        indices_in,
                        &self.d_bucket_count,
                        &self.d_bucket_slots,
                        hash_bytes_in,
                        indices_per_in,
                        hashes_out,
                        indices_out,
                        count_out,
                        MAX_ROWS,
                    ),
                )?;
            }
        }
        Ok(())
    }

}

// Free functions (not methods on GpuSolver) so callers can split-borrow self's
// fields. `self.zero_one(&mut self.d_x)` would desugar to a `&self` borrow
// covering the whole struct, which collides with the `&mut self.d_x` argument.
// cudarc's device methods are defined on Arc<CudaDevice> so we take that here.
fn dev_read_count(dev: &Arc<CudaDevice>, buf: &CudaSlice<u32>) -> Result<u32> {
    let v = dev.dtoh_sync_copy(buf)?;
    Ok(v[0].min(MAX_ROWS))
}

fn dev_zero_one(dev: &Arc<CudaDevice>, buf: &mut CudaSlice<u32>) -> Result<()> {
    dev.htod_sync_copy_into(&[0u32], buf)?;
    Ok(())
}

fn launch_cfg_1d(total_threads: u32, block: u32) -> LaunchConfig {
    let grid = (total_threads + block - 1) / block;
    LaunchConfig {
        grid_dim: (grid.max(1), 1, 1),
        block_dim: (block, 1, 1),
        shared_mem_bytes: 0,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn init_h_sanity() {
        // Our precomputed BLAKE2b init state is the only thing that has to
        // stay in lockstep with the upstream personalization rules. If this
        // breaks, the leaf-gen kernel produces wrong hashes silently. The
        // real cross-check is `--oracle-check` against the CPU solver; here
        // we just guard against obvious typos (e.g., wrong IV, wrong word).
        let h = blake2b_init_h(96, 5);
        assert_ne!(h, [0u64; 8]);
        // Word 0 should differ from IV[0] (we XOR'd in digest_len etc.).
        assert_ne!(h[0], 0x6a09e667f3bcc908);
        // Words 1..5 should equal IV (no XOR target).
        assert_eq!(h[1], 0xbb67ae8584caa73b);
        assert_eq!(h[2], 0x3c6ef372fe94f82b);
        assert_eq!(h[3], 0xa54ff53a5f1d36f1);
        assert_eq!(h[4], 0x510e527fade682d1);
        assert_eq!(h[5], 0x9b05688c2b3e6c1f);
        // Words 6, 7 should differ from IV (personalization XOR'd in).
        assert_ne!(h[6], 0x1f83d9abfb41bd6b);
        assert_ne!(h[7], 0x5be0cd19137e2179);
    }
}
