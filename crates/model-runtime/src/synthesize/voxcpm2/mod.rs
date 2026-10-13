//! OpenBMB VoxCPM2: MiniCPM4 backbone + local diffusion (CFM) + AudioVAE, 48 kHz (mlx-rs implementation, ported from v2 `ccut-tts::voxcpm2`).
//! Weights: `aufklarer/VoxCPM2-MLX-int8`.
//!
//! Parts are ported from speech-swift (https://github.com/soniqo/speech-swift , Apache License 2.0,
//! Copyright 2025 Ivan Digital), with modifications: rewritten in Rust / mlx-rs and wired in to follow this repository's model-package and error conventions.
//! SPDX-License-Identifier: Apache-2.0
//! Full original license: `crates/model-runtime/licenses/speech-swift.txt`; for the scope of the source, see `THIRD_PARTY_NOTICES.md` in the repository root.
//!
//! The pure-logic submodules (`config` / `tokenizer`) have no cfg gate, compile on all platforms and come with unit tests. The model graph and [`VoxCpm2`]
//! are compiled through the `synthesize::tensor` facade: MLX on Apple Silicon, and candle CPU/CUDA on other platforms when `backend-candle` is enabled.

/// Official default for the classifier-free guidance strength (`cfg_value`).
pub const DEFAULT_CFG: f32 = 2.0;
/// Official default for the number of local diffusion steps (`inference_timesteps`).
pub const DEFAULT_STEPS: usize = 10;
/// CFG `(min, max, step)` for the UI and parameter table (both ends inclusive), taken from the sliders in the official Gradio demo (OpenBMB/VoxCPM `app.py`).
/// The engine only validates `cfg > 0`; the range does not go into the engine.
pub const CFG_RANGE: (f32, f32, f32) = (1.0, 3.0, 0.1);
/// `(min, max, step)` for the inference step count (`inference_timesteps`), same source as above; the engine only validates `steps ≥ 1`.
pub const STEPS_RANGE: (usize, usize, usize) = (1, 50, 1);

pub mod config;
pub mod tokenizer;

#[cfg(any(
    feature = "backend-candle",
    all(feature = "backend-mlx", target_os = "macos", target_arch = "aarch64")
))]
mod audio_vae;
#[cfg(any(
    feature = "backend-candle",
    all(feature = "backend-mlx", target_os = "macos", target_arch = "aarch64")
))]
mod engine;
#[cfg(any(
    feature = "backend-candle",
    all(feature = "backend-mlx", target_os = "macos", target_arch = "aarch64")
))]
mod minicpm;
#[cfg(all(
    test,
    any(
        feature = "backend-candle",
        all(feature = "backend-mlx", target_os = "macos", target_arch = "aarch64")
    )
))]
mod tests;

#[cfg(any(
    feature = "backend-candle",
    all(feature = "backend-mlx", target_os = "macos", target_arch = "aarch64")
))]
pub use engine::{ENGINE_NAME, SAMPLE_RATE, VoxCpm2};
