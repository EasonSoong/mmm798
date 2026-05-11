//! Equium reference CUDA GPU miner.
//!
//! Same on-chain protocol as `cli-miner`, but the solver lives on the GPU.
//! See `src/gpu.rs` for the dispatch layer and `src/kernel.cu` for the
//! actual Equihash (96,5) implementation.
//!
//! Usage:
//!   equium-cuda-miner --rpc-url http://127.0.0.1:8899 \
//!                     --keypair ~/.config/solana/id.json \
//!                     --device 0
//!
//! Build requirements:
//!   - CUDA toolkit installed (libcuda + libnvrtc reachable at runtime)
//!   - NVIDIA GPU with compute capability ≥ 6.0 (Pascal+) recommended
//!
//! This is a **correctness-first reference miner**. It compiles and runs,
//! but the kernel has obvious headroom: single-nonce launches, no streams,
//! brute-force disjoint check. Once you confirm the GPU solver agrees with
//! the CPU solver bit-for-bit (run with `--oracle-check`), the next wins
//! are: CUDA streams for overlapping launches, multi-nonce batching, and
//! shared-memory bucket staging.

mod gpu;

use std::path::PathBuf;
use std::str::FromStr;
use std::time::{Duration, Instant};

use anchor_lang::prelude::AccountMeta;
use anchor_lang::{AccountDeserialize, InstructionData, ToAccountMetas};
use anchor_spl::associated_token::get_associated_token_address_with_program_id;
use anyhow::{anyhow, Context, Result};
use clap::Parser;
use equihash_core::challenge::{build_input, solution_hash};
use equihash_core::target::hash_under_target;
use equium::state::{EquiumConfig, CONFIG_SEED, VAULT_SEED};
use rand::RngCore;
use solana_client::rpc_client::RpcClient;
use solana_sdk::commitment_config::CommitmentConfig;
use solana_sdk::compute_budget::ComputeBudgetInstruction;
use solana_sdk::instruction::Instruction;
use solana_sdk::pubkey::Pubkey;
use solana_sdk::signature::{read_keypair_file, Keypair, Signer};
use solana_sdk::system_program;
use solana_sdk::sysvar;
use solana_sdk::transaction::Transaction;

use crate::gpu::{GpuSolver, MAX_INDICES};

#[derive(Parser, Debug)]
#[command(version, about = "Equium reference CUDA GPU miner")]
struct Args {
    /// RPC endpoint URL.
    #[arg(long, default_value = "https://api.mainnet-beta.solana.com")]
    rpc_url: String,

    /// Path to a keypair JSON for the miner wallet.
    #[arg(long)]
    keypair: PathBuf,

    /// Override the program ID.
    #[arg(long)]
    program_id: Option<String>,

    /// Stop after N successful blocks (0 = run forever).
    #[arg(long, default_value_t = 0u64)]
    max_blocks: u64,

    /// Compute-unit limit per `mine` tx.
    #[arg(long, default_value_t = 1_400_000u32)]
    cu_limit: u32,

    /// Max nonces to try per round before refetching state.
    #[arg(long, default_value_t = 8192u64)]
    max_nonces_per_round: u64,

    /// CUDA device ordinal (0 = primary GPU).
    #[arg(long, default_value_t = 0usize)]
    device: usize,

    /// Run a single nonce, cross-check against the CPU solver, and exit.
    /// Use this BEFORE pointing at a real RPC — it confirms the kernel is
    /// producing correct outputs on your hardware.
    #[arg(long)]
    oracle_check: bool,
}

const C_RESET: &str = "\x1b[0m";
const C_DIM: &str = "\x1b[2m";
const C_BOLD: &str = "\x1b[1m";
const C_ROSE_B: &str = "\x1b[1;35m";
const C_GOLD: &str = "\x1b[33m";
const C_GOLD_B: &str = "\x1b[1;33m";
const C_SAGE: &str = "\x1b[32m";
const C_SAGE_B: &str = "\x1b[1;32m";
const C_TEAL: &str = "\x1b[36m";
const C_GRAY: &str = "\x1b[90m";

const LOGO: &str = r#"
   ███████╗ ██████╗ ██╗   ██╗██╗██╗   ██╗███╗   ███╗
   ██╔════╝██╔═══██╗██║   ██║██║██║   ██║████╗ ████║
   █████╗  ██║   ██║██║   ██║██║██║   ██║██╔████╔██║
   ██╔══╝  ██║▄▄ ██║██║   ██║██║██║   ██║██║╚██╔╝██║
   ███████╗╚██████╔╝╚██████╔╝██║╚██████╔╝██║ ╚═╝ ██║
   ╚══════╝ ╚══▀▀═╝  ╚═════╝ ╚═╝ ╚═════╝ ╚═╝     ╚═╝"#;

const RULE: &str = "   ────────────────────────────────────────────────────";

fn main() -> Result<()> {
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("warn")).init();

    let args = Args::parse();

    if args.oracle_check {
        return run_oracle_check(args.device);
    }

    let program_id: Pubkey = match &args.program_id {
        Some(s) => Pubkey::from_str(s).context("invalid --program-id")?,
        None => equium::ID,
    };
    let miner_kp = read_keypair_file(&args.keypair)
        .map_err(|e| anyhow!("read keypair {}: {}", args.keypair.display(), e))?;
    let miner = miner_kp.pubkey();

    let rpc = RpcClient::new_with_commitment(args.rpc_url.clone(), CommitmentConfig::confirmed());
    let (config_pda, _) = Pubkey::find_program_address(&[CONFIG_SEED], &program_id);
    let (vault_pda, _) = Pubkey::find_program_address(&[VAULT_SEED], &program_id);
    let network_label = network_label_from_url(&args.rpc_url);

    let mut solver = GpuSolver::new(args.device)
        .with_context(|| format!("initialize CUDA device {}", args.device))?;

    print_boot(&miner, &program_id, network_label, &solver);

    let mut blocks_mined = 0u64;
    let started_at = Instant::now();
    let token_program_id = {
        let cfg = fetch_config(&rpc, &config_pda)
            .with_context(|| format!("fetch config at {}", config_pda))?;
        let mint_acct = rpc.get_account(&cfg.mint).with_context(|| {
            format!("fetch mint {} for token program detection", cfg.mint)
        })?;
        mint_acct.owner
    };
    let mut current_height: u64 = u64::MAX;
    let mut try_in_round: u32 = 0;
    let mut total_nonces: u64 = 0;
    let mut total_reward_base: u64 = 0;

    const ROUND_STALL_SECS: u64 = 75;
    const ADVANCE_COOLDOWN_SECS: u64 = 30;
    let mut last_height_change_at = Instant::now();
    let mut last_advance_attempt_at: Option<Instant> = None;

    loop {
        let cfg = fetch_config(&rpc, &config_pda)
            .with_context(|| format!("fetch config at {}", config_pda))?;
        let miner_ata = derive_ata(&miner, &cfg.mint, &token_program_id);

        if cfg.block_height != current_height {
            current_height = cfg.block_height;
            try_in_round = 0;
            last_height_change_at = Instant::now();
            last_advance_attempt_at = None;
            println!();
            println!(
                "   {}round #{}{}   {}reward {} EQM{}   {}target 0x{}…{}",
                C_BOLD, cfg.block_height, C_RESET,
                C_DIM, format_reward(cfg.current_epoch_reward), C_RESET,
                C_DIM, hex::encode(&cfg.current_target[..4]), C_RESET,
            );
            println!("{}{}{}", C_GRAY, RULE, C_RESET);
        }

        let stall_for = last_height_change_at.elapsed();
        let cooled_down = last_advance_attempt_at
            .map(|t| t.elapsed() >= Duration::from_secs(ADVANCE_COOLDOWN_SECS))
            .unwrap_or(true);
        if stall_for >= Duration::from_secs(ROUND_STALL_SECS) && cooled_down {
            println!(
                "   {}round stalled {}s — calling advance_empty_round{}",
                C_GRAY,
                stall_for.as_secs(),
                C_RESET
            );
            last_advance_attempt_at = Some(Instant::now());
            match submit_advance_empty_round(&rpc, &miner_kp, &program_id, &config_pda) {
                Ok(sig) => println!(
                    "     {}↳ advanced empty round{}   {}sig {}{}",
                    C_SAGE, C_RESET, C_GRAY, short_sig(&sig), C_RESET
                ),
                Err(e) => {
                    let reason = if e.to_string().contains("RoundStillActive") {
                        "another miner beat us to it"
                    } else {
                        "couldn't advance"
                    };
                    println!("     {}↳ {}{}", C_GRAY, reason, C_RESET);
                }
            }
            continue;
        }

        let solve_started = Instant::now();
        let input = build_input(
            &cfg.current_challenge,
            &miner.to_bytes(),
            cfg.block_height,
        );

        // GPU drives the nonce loop directly: one kernel launch per nonce,
        // host-side verification on every candidate, early exit on win.
        let outcome = mine_one_round(
            &mut solver,
            cfg.equihash_n,
            cfg.equihash_k,
            &input,
            &cfg.current_target,
            args.max_nonces_per_round,
        )?;
        total_nonces = total_nonces.saturating_add(outcome.nonces_tried);

        let solve_ms = solve_started.elapsed().as_millis() as u64;
        try_in_round += 1;
        let session_secs = started_at.elapsed().as_secs_f64().max(0.001);
        let hashrate = total_nonces as f64 / session_secs;

        let winner = match outcome.winner {
            Some(w) => w,
            None => {
                println!(
                    "     {}· try #{}{}   {}exhausted{}        {}{}ms{}   {}{}{}",
                    C_GRAY, try_in_round, C_RESET,
                    C_DIM, C_RESET,
                    C_DIM, solve_ms, C_RESET,
                    C_GOLD, fmt_hashrate(hashrate), C_RESET,
                );
                continue;
            }
        };

        let cand_hash = solution_hash(&winner.soln_indices, &input);
        debug_assert!(hash_under_target(&cand_hash, &cfg.current_target));
        let _ = cand_hash;

        match submit_mine(
            &rpc,
            &miner_kp,
            &program_id,
            &config_pda,
            &cfg,
            &vault_pda,
            &miner_ata,
            &token_program_id,
            &winner.nonce,
            winner.soln_indices.clone(),
            args.cu_limit,
        ) {
            Ok(sig) => {
                blocks_mined += 1;
                total_reward_base = total_reward_base.saturating_add(cfg.current_epoch_reward);
                println!(
                    "     {}✓ MINED!{}   {}+{} EQM{}     {}try #{}{}   {}{}ms{}   {}{}{}",
                    C_SAGE_B, C_RESET,
                    C_BOLD, format_reward(cfg.current_epoch_reward), C_RESET,
                    C_DIM, try_in_round, C_RESET,
                    C_DIM, solve_ms, C_RESET,
                    C_GOLD_B, fmt_hashrate(hashrate), C_RESET,
                );
                println!("       {}sig {}{}", C_GRAY, short_sig(&sig), C_RESET);
                println!();
                println!(
                    "   {}total mined{}  {}{} EQM{}   {}·{}   {}blocks{}  {}{}{}   {}·{}   {}uptime{}  {}{}{}",
                    C_DIM, C_RESET,
                    C_BOLD, format_reward(total_reward_base), C_RESET,
                    C_GRAY, C_RESET,
                    C_DIM, C_RESET, C_BOLD, blocks_mined, C_RESET,
                    C_GRAY, C_RESET,
                    C_DIM, C_RESET, C_BOLD, fmt_uptime(session_secs), C_RESET,
                );
            }
            Err(e) => {
                let reason = classify_submit_err(&e.to_string());
                println!(
                    "     {}· try #{}{}   {}{}{}        {}{}ms{}   {}{}{}",
                    C_GRAY, try_in_round, C_RESET,
                    C_DIM, reason, C_RESET,
                    C_DIM, solve_ms, C_RESET,
                    C_GOLD, fmt_hashrate(hashrate), C_RESET,
                );
                std::thread::sleep(Duration::from_millis(200));
                continue;
            }
        }

        if args.max_blocks > 0 && blocks_mined >= args.max_blocks {
            let elapsed = started_at.elapsed().as_secs_f64();
            println!();
            println!(
                "   {}session complete{}  ·  {} blocks  ·  avg latency {:.1}s  ·  {}",
                C_ROSE_B, C_RESET,
                args.max_blocks,
                elapsed / blocks_mined as f64,
                fmt_hashrate(hashrate),
            );
            return Ok(());
        }
    }
}

struct RoundOutcome {
    winner: Option<RaceWinner>,
    nonces_tried: u64,
}

struct RaceWinner {
    nonce: [u8; 32],
    soln_indices: Vec<u8>,
}

/// Drive the GPU through up to `max_nonces` random nonces, returning the
/// first solution that lands under target. Host-side verification gates
/// every candidate before we trust it for submission.
fn mine_one_round(
    solver: &mut GpuSolver,
    n: u32,
    k: u32,
    input: &[u8; equihash_core::challenge::I_LEN],
    target: &[u8; 32],
    max_nonces: u64,
) -> Result<RoundOutcome> {
    let mut rng = rand::thread_rng();
    let mut tried: u64 = 0;
    while tried < max_nonces {
        let mut nonce = [0u8; 32];
        rng.fill_bytes(&mut nonce);
        tried += 1;

        let candidates = solver.solve_nonce(n, k, input, &nonce)?;
        for indices in candidates {
            // Compress to wire format and re-verify on host. is_valid_solution
            // catches kernel bugs that produce indices in the wrong order or
            // miss the disjointness check.
            let compressed = compress_indices(n, k, &indices);
            if equihash::is_valid_solution(n, k, input, &nonce, &compressed).is_err() {
                continue;
            }
            let h = solution_hash(&compressed, input);
            if hash_under_target(&h, target) {
                return Ok(RoundOutcome {
                    winner: Some(RaceWinner {
                        nonce,
                        soln_indices: compressed,
                    }),
                    nonces_tried: tried,
                });
            }
        }
    }
    Ok(RoundOutcome {
        winner: None,
        nonces_tried: tried,
    })
}

/// Pack `2^k` indices into the wire-format byte string: each index gets
/// `cbits_of(n,k) + 1` bits, big-endian within the byte stream. Mirrors the
/// reference `compress_indices` in `equihash-core::solver` — kept here so
/// we don't have to widen that crate's public surface.
fn compress_indices(n: u32, k: u32, indices: &[u32; MAX_INDICES]) -> Vec<u8> {
    let cbits = (n / (k + 1)) as usize;
    let bits_per = cbits + 1;
    let total_bits = bits_per * indices.len();
    let total_bytes = (total_bits + 7) / 8;
    let mut out = vec![0u8; total_bytes];
    let mut pos = 0usize;
    for &idx in indices.iter() {
        for b in (0..bits_per).rev() {
            let bit = (idx >> b) & 1;
            let byte = pos / 8;
            let shift = 7 - (pos % 8);
            out[byte] |= (bit as u8) << shift;
            pos += 1;
        }
    }
    out
}

/// CPU-oracle self-test: pick a random nonce, run both the CPU solver and
/// the GPU solver, ensure they agree on at least one valid solution.
fn run_oracle_check(device: usize) -> Result<()> {
    use equihash_core::solver::{try_nonce, BaseState};

    println!("{}{}{}", C_ROSE_B, LOGO, C_RESET);
    println!("   {}CUDA oracle check{}\n", C_GOLD_B, C_RESET);

    let mut solver = GpuSolver::new(device).context("init CUDA")?;
    println!("   gpu          {}", solver.device_name());

    let n = 96u32;
    let k = 5u32;
    let challenge = [7u8; 32];
    let pubkey = [11u8; 32];
    let height = 42u64;
    let input = build_input(&challenge, &pubkey, height);

    let base = BaseState::new(n, k, &input).map_err(|e| anyhow!("base state: {:?}", e))?;
    let mut rng = rand::thread_rng();
    let mut tried = 0usize;
    const BUDGET: usize = 256;

    while tried < BUDGET {
        let mut nonce = [0u8; 32];
        rng.fill_bytes(&mut nonce);
        tried += 1;

        let cpu = try_nonce(&base, &input, &nonce);
        let gpu = solver.solve_nonce(n, k, &input, &nonce)?;

        match (cpu, gpu.first()) {
            (Some(cpu_soln), Some(gpu_indices)) => {
                let gpu_compressed = compress_indices(n, k, gpu_indices);
                let cpu_ok = equihash::is_valid_solution(n, k, &input, &nonce, &cpu_soln).is_ok();
                let gpu_ok = equihash::is_valid_solution(n, k, &input, &nonce, &gpu_compressed).is_ok();
                println!(
                    "   nonce #{tried:<3}  cpu {} gpu_candidates={}  gpu_valid={}",
                    if cpu_ok { "✓" } else { "✗" },
                    gpu.len(),
                    gpu_ok,
                );
                if cpu_ok && gpu_ok {
                    println!("\n   {}oracle check passed{} — kernel produces valid Equihash solutions",
                        C_SAGE_B, C_RESET);
                    return Ok(());
                }
                if !gpu_ok {
                    return Err(anyhow!(
                        "GPU produced a candidate that failed is_valid_solution; kernel is buggy"
                    ));
                }
            }
            (None, None) => {
                // Neither found a solution for this nonce; common, keep trying.
            }
            (Some(_), None) => {
                println!("   nonce #{tried:<3}  cpu found, gpu didn't (acceptable if rare)");
            }
            (None, Some(gpu_indices)) => {
                // GPU found one but CPU didn't — sanity-check it on host.
                let gpu_compressed = compress_indices(n, k, gpu_indices);
                let gpu_ok = equihash::is_valid_solution(n, k, &input, &nonce, &gpu_compressed).is_ok();
                if !gpu_ok {
                    return Err(anyhow!(
                        "GPU found {} candidate(s) but none are valid Equihash solutions",
                        gpu.len()
                    ));
                }
                println!("   nonce #{tried:<3}  gpu found valid solution; cpu didn't (kernel may be finding more)");
                println!("\n   {}oracle check passed{} — kernel produces valid Equihash solutions",
                    C_SAGE_B, C_RESET);
                return Ok(());
            }
        }
    }

    Err(anyhow!(
        "no solutions found across {} nonces — increase the budget or check kernel",
        BUDGET
    ))
}

fn print_boot(miner: &Pubkey, program: &Pubkey, network: &str, solver: &GpuSolver) {
    println!("{}{}{}", C_ROSE_B, LOGO, C_RESET);
    println!(
        "   {}gpu-mineable on solana{}                            {}$EQM ⛏{}",
        C_DIM, C_RESET, C_GOLD_B, C_RESET
    );
    println!();
    println!("{}{}{}", C_GRAY, RULE, C_RESET);
    println!("   {}miner{}     {}{}{}", C_DIM, C_RESET, C_TEAL, short_pk(miner), C_RESET);
    println!("   {}program{}   {}{}{}", C_DIM, C_RESET, C_TEAL, short_pk(program), C_RESET);
    println!("   {}network{}   {}{}{}", C_DIM, C_RESET, C_TEAL, network, C_RESET);
    println!("   {}gpu{}       {}{}{}", C_DIM, C_RESET, C_TEAL, solver.device_name(), C_RESET);
    println!("{}{}{}", C_GRAY, RULE, C_RESET);
}

fn network_label_from_url(url: &str) -> &'static str {
    if url.contains("mainnet") {
        "solana mainnet"
    } else if url.contains("devnet") {
        "solana devnet"
    } else if url.contains("testnet") {
        "solana testnet"
    } else if url.contains("127.0.0.1") || url.contains("localhost") {
        "solana localnet"
    } else {
        "solana custom"
    }
}

fn fmt_hashrate(hashes_per_sec: f64) -> String {
    if hashes_per_sec >= 1000.0 {
        format!("{:.1} kH/s", hashes_per_sec / 1000.0)
    } else {
        format!("{:.1} H/s", hashes_per_sec)
    }
}

fn fmt_uptime(seconds: f64) -> String {
    let total = seconds as u64;
    let h = total / 3600;
    let m = (total % 3600) / 60;
    let s = total % 60;
    if h > 0 {
        format!("{}:{:02}:{:02}", h, m, s)
    } else {
        format!("{}:{:02}", m, s)
    }
}

fn short_pk(pk: &Pubkey) -> String {
    let s = pk.to_string();
    format!("{}…{}", &s[..4], &s[s.len() - 4..])
}

fn short_sig(s: &str) -> String {
    if s.len() <= 12 {
        return s.to_string();
    }
    format!("{}…{}", &s[..6], &s[s.len() - 6..])
}

fn format_reward(base_units: u64) -> String {
    let whole = base_units / 1_000_000;
    let frac = base_units % 1_000_000;
    if frac == 0 {
        format!("{}", whole)
    } else {
        format!("{}.{:06}", whole, frac).trim_end_matches('0').to_string()
    }
}

fn classify_submit_err(s: &str) -> &'static str {
    if s.contains("custom program error: 0x1773") || s.contains("AboveTarget") {
        "above target"
    } else if s.contains("custom program error: 0x1772") || s.contains("InvalidEquihash") {
        "stale challenge"
    } else if s.contains("blockhash not found") || s.contains("BlockhashNotFound") {
        "blockhash expired"
    } else {
        "submit error"
    }
}

fn derive_ata(owner: &Pubkey, mint: &Pubkey, token_program_id: &Pubkey) -> Pubkey {
    get_associated_token_address_with_program_id(owner, mint, token_program_id)
}

fn fetch_config(rpc: &RpcClient, config_pda: &Pubkey) -> Result<EquiumConfig> {
    let acct = rpc.get_account(config_pda)?;
    let mut data = acct.data.as_slice();
    let cfg = EquiumConfig::try_deserialize(&mut data)?;
    Ok(cfg)
}

#[allow(clippy::too_many_arguments)]
fn submit_mine(
    rpc: &RpcClient,
    miner_kp: &Keypair,
    program_id: &Pubkey,
    config_pda: &Pubkey,
    cfg: &EquiumConfig,
    vault_pda: &Pubkey,
    miner_ata: &Pubkey,
    token_program_id: &Pubkey,
    nonce: &[u8; 32],
    soln_indices: Vec<u8>,
    cu_limit: u32,
) -> Result<String> {
    let miner = miner_kp.pubkey();
    let accounts = equium::accounts::Mine {
        miner,
        config: *config_pda,
        mint: cfg.mint,
        mineable_vault: *vault_pda,
        miner_ata: *miner_ata,
        token_program: *token_program_id,
        associated_token_program: anchor_spl::associated_token::ID,
        system_program: system_program::ID,
        slot_hashes: sysvar::slot_hashes::ID,
    }
    .to_account_metas(None);
    let accounts: Vec<AccountMeta> = accounts
        .into_iter()
        .map(|m| AccountMeta {
            pubkey: m.pubkey,
            is_signer: m.is_signer,
            is_writable: m.is_writable,
        })
        .collect();
    let data = equium::instruction::Mine {
        nonce: *nonce,
        soln_indices,
    }
    .data();
    let ix = Instruction {
        program_id: *program_id,
        accounts,
        data,
    };
    let cu_ix = ComputeBudgetInstruction::set_compute_unit_limit(cu_limit);

    let recent = rpc.get_latest_blockhash()?;
    let tx = Transaction::new_signed_with_payer(
        &[cu_ix, ix],
        Some(&miner),
        &[miner_kp],
        recent,
    );
    let sig = rpc.send_and_confirm_transaction(&tx)?;
    Ok(sig.to_string())
}

fn submit_advance_empty_round(
    rpc: &RpcClient,
    caller_kp: &Keypair,
    program_id: &Pubkey,
    config_pda: &Pubkey,
) -> Result<String> {
    let caller = caller_kp.pubkey();
    let accounts = equium::accounts::AdvanceEmptyRound {
        caller,
        config: *config_pda,
        slot_hashes: sysvar::slot_hashes::ID,
    }
    .to_account_metas(None);
    let accounts: Vec<AccountMeta> = accounts
        .into_iter()
        .map(|m| AccountMeta {
            pubkey: m.pubkey,
            is_signer: m.is_signer,
            is_writable: m.is_writable,
        })
        .collect();
    let data = equium::instruction::AdvanceEmptyRound {}.data();
    let ix = Instruction {
        program_id: *program_id,
        accounts,
        data,
    };

    let recent = rpc.get_latest_blockhash()?;
    let tx = Transaction::new_signed_with_payer(&[ix], Some(&caller), &[caller_kp], recent);
    let sig = rpc.send_and_confirm_transaction(&tx)?;
    Ok(sig.to_string())
}
