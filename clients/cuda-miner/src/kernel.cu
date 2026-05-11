// Equium (96, 5) Equihash GPU solver — correctness-first reference kernel.
//
// One CUDA module, six entry points:
//   - blake2b_leaves      : generate 2^17 initial 12-byte hashes from (init H, prefix).
//   - clear_buckets       : zero the per-round bucket count array.
//   - fill_buckets        : bucket the current table by first 16 bits of hash.
//   - collide             : pairwise XOR within each bucket, write next table.
//   - filter_zero         : scan final table, emit entries whose remaining hash is all zero.
//   - reset_counter       : zero a single u32 counter (used for out_count, solution_count).
//
// Parameters that vary per round (hash_bytes_in, hash_bytes_out, indices_per_in,
// indices_per_out) are passed as kernel args, NOT compile-time constants —
// this keeps it to a single binary and lets the host drive the round schedule.
//
// Memory model:
//   - hashes_x[]   : laid out as rows of MAX_HASH_BYTES (=12). Unused leading
//                    bytes per round live at the TAIL (zero-padded), so reading
//                    the first `hash_bytes_in` bytes always lands on the live
//                    portion. Bucket key = bytes [0..2] of the live portion.
//   - indices_x[]  : laid out as rows of MAX_INDICES (=32). Unused tail
//                    entries are undefined (we never read past indices_per).
//   - bucket_slots : row indices (u32) into the current table, one slot list
//                    per 2^16 bucket. Buckets that overflow MAX_BUCKET are
//                    truncated. With expected load 2 and Poisson dispersion
//                    this is rare; we accept losing those candidates.
//
// Known limitations of this first cut:
//   - One nonce per kernel launch — no batching. Launch overhead dominates
//     until host wires up streams.
//   - Brute O(n^2) disjoint-indices check. Fine while indices_per ≤ 32.
//   - No shared-memory bucket staging. The collide kernel hits global memory
//     for every read. Good enough for correctness; leaves ~3-5x on the table.

#include <stdint.h>

extern "C" {

// ─────────────────────────── tunables ─────────────────────────────────
// (Must match the host-side constants in gpu.rs.)
#define MAX_HASH_BYTES   12      // = 96/8 (Equihash n=96)
#define MAX_INDICES      32      // = 2^k  (Equihash k=5)
#define NUM_BUCKETS      65536   // = 2^cbits = 2^16
#define MAX_BUCKET       16      // bucket overflow ceiling; expected load ≈ 2

// ─────────────────────────── BLAKE2b ──────────────────────────────────
__constant__ uint64_t IV[8] = {
    0x6a09e667f3bcc908ULL, 0xbb67ae8584caa73bULL,
    0x3c6ef372fe94f82bULL, 0xa54ff53a5f1d36f1ULL,
    0x510e527fade682d1ULL, 0x9b05688c2b3e6c1fULL,
    0x1f83d9abfb41bd6bULL, 0x5be0cd19137e2179ULL
};

__constant__ uint8_t SIGMA[12][16] = {
    { 0,  1,  2,  3,  4,  5,  6,  7,  8,  9, 10, 11, 12, 13, 14, 15},
    {14, 10,  4,  8,  9, 15, 13,  6,  1, 12,  0,  2, 11,  7,  5,  3},
    {11,  8, 12,  0,  5,  2, 15, 13, 10, 14,  3,  6,  7,  1,  9,  4},
    { 7,  9,  3,  1, 13, 12, 11, 14,  2,  6,  5, 10,  4,  0, 15,  8},
    { 9,  0,  5,  7,  2,  4, 10, 15, 14,  1, 11, 12,  6,  8,  3, 13},
    { 2, 12,  6, 10,  0, 11,  8,  3,  4, 13,  7,  5, 15, 14,  1,  9},
    {12,  5,  1, 15, 14, 13,  4, 10,  0,  7,  6,  3,  9,  2,  8, 11},
    {13, 11,  7, 14, 12,  1,  3,  9,  5,  0, 15,  4,  8,  6,  2, 10},
    { 6, 15, 14,  9, 11,  3,  0,  8, 12,  2, 13,  7,  1,  4, 10,  5},
    {10,  2,  8,  4,  7,  6,  1,  5, 15, 11,  9, 14,  3, 12, 13,  0},
    { 0,  1,  2,  3,  4,  5,  6,  7,  8,  9, 10, 11, 12, 13, 14, 15},
    {14, 10,  4,  8,  9, 15, 13,  6,  1, 12,  0,  2, 11,  7,  5,  3}
};

__device__ static inline uint64_t rotr64(uint64_t x, int n) {
    return (x >> n) | (x << (64 - n));
}

__device__ static inline void G(
    uint64_t* v, int a, int b, int c, int d, uint64_t x, uint64_t y
) {
    v[a] = v[a] + v[b] + x;
    v[d] = rotr64(v[d] ^ v[a], 32);
    v[c] = v[c] + v[d];
    v[b] = rotr64(v[b] ^ v[c], 24);
    v[a] = v[a] + v[b] + y;
    v[d] = rotr64(v[d] ^ v[a], 16);
    v[c] = v[c] + v[d];
    v[b] = rotr64(v[b] ^ v[c], 63);
}

// One BLAKE2b compression on a 128-byte block. Mutates `h` in place.
// `t_low` is the byte counter (low 64 bits; high bits assumed 0 for our use).
__device__ static void blake2b_compress(
    uint64_t* h, const uint8_t* block, uint64_t t_low, bool is_final
) {
    uint64_t m[16];
    #pragma unroll
    for (int i = 0; i < 16; i++) {
        uint64_t w = 0;
        #pragma unroll
        for (int j = 0; j < 8; j++) {
            w |= ((uint64_t)block[i * 8 + j]) << (j * 8);
        }
        m[i] = w;
    }

    uint64_t v[16];
    #pragma unroll
    for (int i = 0; i < 8; i++) v[i] = h[i];
    #pragma unroll
    for (int i = 0; i < 8; i++) v[i + 8] = IV[i];
    v[12] ^= t_low;
    if (is_final) v[14] = ~v[14];

    for (int r = 0; r < 12; r++) {
        const uint8_t* s = SIGMA[r];
        G(v, 0, 4,  8, 12, m[s[ 0]], m[s[ 1]]);
        G(v, 1, 5,  9, 13, m[s[ 2]], m[s[ 3]]);
        G(v, 2, 6, 10, 14, m[s[ 4]], m[s[ 5]]);
        G(v, 3, 7, 11, 15, m[s[ 6]], m[s[ 7]]);
        G(v, 0, 5, 10, 15, m[s[ 8]], m[s[ 9]]);
        G(v, 1, 6, 11, 12, m[s[10]], m[s[11]]);
        G(v, 2, 7,  8, 13, m[s[12]], m[s[13]]);
        G(v, 3, 4,  9, 14, m[s[14]], m[s[15]]);
    }

    #pragma unroll
    for (int i = 0; i < 8; i++) h[i] ^= v[i] ^ v[i + 8];
}

// ────────────────── kernel: blake2b_leaves ────────────────────────────
//
// Generates `n_init` initial 12-byte hashes for Equihash (96,5).
//
// Inputs:
//   h_init[8]      : the BLAKE2b state after personalized init (h0..h7 with
//                    parameter block XOR'd in). Host computes this.
//   prefix[113]    : input bytes consumed so far = I (81 bytes) || nonce (32).
//                    All leaves share this prefix.
//   n_init         : number of leaves to produce.
//
// Outputs:
//   hashes[n_init * MAX_HASH_BYTES]    : tightly packed 12-byte leaves.
//   indices[n_init * MAX_INDICES]      : indices[i*32 + 0] = i; rest unused.
//   count                              : set to n_init by host (or thread 0).
//
// Each thread produces 5 leaves (since digest_len 60 / leaf_len 12 = 5).
// Thread tid handles counter c = tid, leaves i = 5*tid + j for j in 0..5.
__global__ void blake2b_leaves(
    const uint64_t* __restrict__ h_init,
    const uint8_t*  __restrict__ prefix,   // 113 bytes
    uint32_t n_init,
    uint8_t*  __restrict__ hashes_out,     // [n_init * MAX_HASH_BYTES]
    uint32_t* __restrict__ indices_out,    // [n_init * MAX_INDICES]
    uint32_t* __restrict__ count_out
) {
    uint32_t tid = blockIdx.x * blockDim.x + threadIdx.x;
    uint32_t n_counters = (n_init + 4) / 5;  // ceil(n_init / 5)
    if (tid >= n_counters) return;

    // Build the 128-byte block: prefix(113) || counter(4) || zeros(11).
    uint8_t block[128];
    #pragma unroll
    for (int i = 0; i < 113; i++) block[i] = prefix[i];
    uint32_t c = tid;
    block[113] = (uint8_t)(c        & 0xFF);
    block[114] = (uint8_t)((c >>  8) & 0xFF);
    block[115] = (uint8_t)((c >> 16) & 0xFF);
    block[116] = (uint8_t)((c >> 24) & 0xFF);
    #pragma unroll
    for (int i = 117; i < 128; i++) block[i] = 0;

    // Load init state from constant input.
    uint64_t h[8];
    #pragma unroll
    for (int i = 0; i < 8; i++) h[i] = h_init[i];

    // Single compression: t = 117 bytes consumed, is_final = true.
    blake2b_compress(h, block, 117ULL, true);

    // Serialize the first 60 bytes of h as little-endian and slice into 5 leaves.
    uint8_t out60[60];
    #pragma unroll
    for (int w = 0; w < 8; w++) {
        uint64_t hw = h[w];
        int base = w * 8;
        #pragma unroll
        for (int b = 0; b < 8; b++) {
            int p = base + b;
            if (p < 60) out60[p] = (uint8_t)((hw >> (b * 8)) & 0xFF);
        }
    }

    // Write up to 5 leaves.
    uint32_t base_i = tid * 5;
    #pragma unroll
    for (int j = 0; j < 5; j++) {
        uint32_t i = base_i + j;
        if (i >= n_init) break;
        // Hash: leaf bytes [j*12 .. j*12+12].
        uint8_t* dst = &hashes_out[i * MAX_HASH_BYTES];
        #pragma unroll
        for (int b = 0; b < MAX_HASH_BYTES; b++) {
            dst[b] = out60[j * MAX_HASH_BYTES + b];
        }
        // Indices: just `i` at slot 0; rest are dont-care (read with indices_per=1).
        indices_out[i * MAX_INDICES + 0] = i;
    }

    if (tid == 0) *count_out = n_init;
}

// ────────────────── kernel: clear_buckets ─────────────────────────────
__global__ void clear_buckets(uint32_t* bucket_count) {
    uint32_t id = blockIdx.x * blockDim.x + threadIdx.x;
    if (id < NUM_BUCKETS) bucket_count[id] = 0;
}

// ────────────────── kernel: reset_counter ─────────────────────────────
__global__ void reset_counter(uint32_t* counter) {
    if (threadIdx.x == 0 && blockIdx.x == 0) *counter = 0;
}

// ────────────────── kernel: fill_buckets ──────────────────────────────
//
// For each row in the current table, compute bucket = first 16 bits of hash,
// atomically claim a slot in that bucket, store the row index.
__global__ void fill_buckets(
    const uint8_t*  __restrict__ hashes_in,
    uint32_t count_in,
    uint32_t hash_bytes_in,
    uint32_t* __restrict__ bucket_count,
    uint32_t* __restrict__ bucket_slots
) {
    // Stride is always MAX_HASH_BYTES; `hash_bytes_in` is reserved for
    // future use (e.g., variable-stride packed tables) and ignored here.
    (void)hash_bytes_in;
    uint32_t row = blockIdx.x * blockDim.x + threadIdx.x;
    if (row >= count_in) return;

    const uint8_t* h = &hashes_in[row * MAX_HASH_BYTES];
    uint32_t bucket = ((uint32_t)h[0] << 8) | (uint32_t)h[1];

    uint32_t slot = atomicAdd(&bucket_count[bucket], 1u);
    if (slot < MAX_BUCKET) {
        bucket_slots[bucket * MAX_BUCKET + slot] = row;
    }
    // overflow: silently dropped (rare; expected per-bucket load is ~2).
}

// ────────────────── kernel: collide ───────────────────────────────────
//
// One block per bucket. Block enumerates all (i, j) pairs with i < j within
// the bucket. For each pair:
//   - check the index lists are disjoint (Equihash distinctness rule)
//   - XOR the hashes; strip the leading 2 bytes (which are zero after match)
//   - write a new row to the output table, with indices concatenated in
//     canonical tree order (subtree with smaller first index goes first).
//
// `is_final_round` is unused — the final round produces 2-byte residual
// hashes which the host scans separately via filter_zero.
__global__ void collide(
    const uint8_t*  __restrict__ hashes_in,
    const uint32_t* __restrict__ indices_in,
    const uint32_t* __restrict__ bucket_count,
    const uint32_t* __restrict__ bucket_slots,
    uint32_t hash_bytes_in,
    uint32_t indices_per_in,
    uint8_t*  __restrict__ hashes_out,
    uint32_t* __restrict__ indices_out,
    uint32_t* __restrict__ count_out,
    uint32_t out_capacity
) {
    uint32_t bucket = blockIdx.x;
    uint32_t n_in_bucket = bucket_count[bucket];
    if (n_in_bucket > MAX_BUCKET) n_in_bucket = MAX_BUCKET;
    if (n_in_bucket < 2) return;

    uint32_t total_pairs = (n_in_bucket * (n_in_bucket - 1u)) / 2u;
    uint32_t hash_bytes_out = (hash_bytes_in > 2u) ? (hash_bytes_in - 2u) : 0u;
    uint32_t indices_per_out = indices_per_in * 2u;

    for (uint32_t pair_idx = threadIdx.x; pair_idx < total_pairs; pair_idx += blockDim.x) {
        // Decode pair_idx → (i, j) with 0 <= i < j < n_in_bucket.
        // Linear scan is fine since n_in_bucket <= MAX_BUCKET (16) → ≤120 pairs.
        uint32_t i = 0;
        uint32_t remaining = pair_idx;
        while (remaining >= (n_in_bucket - 1u - i)) {
            remaining -= (n_in_bucket - 1u - i);
            i++;
        }
        uint32_t j = i + 1u + remaining;

        uint32_t row_a = bucket_slots[bucket * MAX_BUCKET + i];
        uint32_t row_b = bucket_slots[bucket * MAX_BUCKET + j];

        const uint32_t* idx_a = &indices_in[row_a * MAX_INDICES];
        const uint32_t* idx_b = &indices_in[row_b * MAX_INDICES];

        // Disjoint indices check (Equihash distinctness rule).
        bool disjoint = true;
        for (uint32_t x = 0; x < indices_per_in && disjoint; x++) {
            uint32_t va = idx_a[x];
            for (uint32_t y = 0; y < indices_per_in; y++) {
                if (va == idx_b[y]) { disjoint = false; break; }
            }
        }
        if (!disjoint) continue;

        // Reserve output slot.
        uint32_t out_idx = atomicAdd(count_out, 1u);
        if (out_idx >= out_capacity) continue;

        // XOR hashes, drop first 2 bytes (which match by bucket invariant).
        const uint8_t* h_a = &hashes_in[row_a * MAX_HASH_BYTES];
        const uint8_t* h_b = &hashes_in[row_b * MAX_HASH_BYTES];
        uint8_t* h_out = &hashes_out[out_idx * MAX_HASH_BYTES];
        for (uint32_t b = 0; b < hash_bytes_out; b++) {
            h_out[b] = h_a[b + 2u] ^ h_b[b + 2u];
        }
        // Zero the unused tail (defensive; bucketing only reads bytes [0..2]).
        for (uint32_t b = hash_bytes_out; b < MAX_HASH_BYTES; b++) {
            h_out[b] = 0;
        }

        // Canonical concat order: subtree whose first index is smaller goes first.
        // Inductively, "first index" == "min index" for any subtree built canonically.
        bool a_first = idx_a[0] < idx_b[0];
        uint32_t* dst = &indices_out[out_idx * MAX_INDICES];
        if (a_first) {
            for (uint32_t x = 0; x < indices_per_in; x++) dst[x] = idx_a[x];
            for (uint32_t x = 0; x < indices_per_in; x++) dst[indices_per_in + x] = idx_b[x];
        } else {
            for (uint32_t x = 0; x < indices_per_in; x++) dst[x] = idx_b[x];
            for (uint32_t x = 0; x < indices_per_in; x++) dst[indices_per_in + x] = idx_a[x];
        }
        // Zero unused tail.
        for (uint32_t x = indices_per_out; x < MAX_INDICES; x++) dst[x] = 0;
    }
}

// ────────────────── kernel: filter_zero ───────────────────────────────
//
// Scan the post-final-round table. Each row has a 2-byte residual hash;
// rows where both bytes are zero represent valid Equihash solutions (modulo
// host-side verification). Copies the 32 indices to a tight solutions buffer.
__global__ void filter_zero(
    const uint8_t*  __restrict__ hashes_in,
    const uint32_t* __restrict__ indices_in,
    uint32_t count_in,
    uint32_t* __restrict__ solutions_out,    // [max_solutions * MAX_INDICES]
    uint32_t* __restrict__ solution_count,
    uint32_t max_solutions
) {
    uint32_t row = blockIdx.x * blockDim.x + threadIdx.x;
    if (row >= count_in) return;

    const uint8_t* h = &hashes_in[row * MAX_HASH_BYTES];
    if (h[0] != 0 || h[1] != 0) return;

    uint32_t slot = atomicAdd(solution_count, 1u);
    if (slot >= max_solutions) return;

    const uint32_t* src = &indices_in[row * MAX_INDICES];
    uint32_t* dst = &solutions_out[slot * MAX_INDICES];
    #pragma unroll
    for (int x = 0; x < MAX_INDICES; x++) dst[x] = src[x];
}

} // extern "C"
