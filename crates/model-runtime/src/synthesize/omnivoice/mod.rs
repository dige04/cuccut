//! k2-fsa OmniVoice: masked discrete diffusion on a Qwen3 base, plus the Higgs audio tokenizer, 24 kHz (mlx-rs implementation, ported from v2 `ccut-tts::omnivoice`).
//! Weights `aufklarer/OmniVoice-MLX-int8`; the audio tokenizer is under `audio_tokenizer/` in the same repository.
//!
//! Parts are ported from speech-swift (https://github.com/soniqo/speech-swift , Apache License 2.0,
//! Copyright 2025 Ivan Digital), with modifications: rewritten in Rust / mlx-rs, and wired in following this repository's model package and error conventions.
//! SPDX-License-Identifier: Apache-2.0
//! Full original license text: `crates/model-runtime/licenses/speech-swift.txt`; scope of the sources is in the root `THIRD_PARTY_NOTICES.md`.
//!
//! Pure-logic submodules (config parsing, tokenization, text and audio pre/post-processing, instruct vocabulary) have no cfg gate and compile on all platforms with unit tests;
//! the model graph and [`OmniVoice`] compile through the `synthesize::tensor` facade: MLX on Apple Silicon, and candle CPU/CUDA on other platforms when `backend-candle` is enabled.

/// Official default guidance strength for classifier-free guidance (`guidance_scale`).
pub const DEFAULT_CFG: f32 = 2.0;
/// Official default number of iterative decoding steps (`num_step`).
pub const DEFAULT_STEPS: usize = 32;
/// Upper limit of the target duration for a single segment (seconds).
pub const MAX_TARGET_SECONDS: f64 = 60.0;
/// Speed range `(min, max, step)` for the UI and parameter table, inclusive of both ends, taken from the sliders of the official Gradio demo (k2-fsa/OmniVoice
/// `omnivoice/cli/demo.py`). The model itself only requires `speed > 0`, `cfg ≥ 0` (0 = no guidance), and `steps ≥ 1`; the engine validates against that lower bound, and the range is not part of the engine.
pub const SPEED_RANGE: (f32, f32, f32) = (0.5, 1.5, 0.05);
/// CFG `(min, max, step)`, same source as [`SPEED_RANGE`].
pub const CFG_RANGE: (f32, f32, f32) = (0.0, 4.0, 0.1);
/// Steps `(min, max, step)`, same source as [`SPEED_RANGE`].
pub const STEPS_RANGE: (usize, usize, usize) = (4, 64, 1);

pub mod audio;
pub mod config;
pub mod instruct;
mod lang_table;
pub mod text;
pub mod tokenizer;

#[cfg(any(
    feature = "backend-candle",
    all(feature = "backend-mlx", target_os = "macos", target_arch = "aarch64")
))]
mod backbone;
#[cfg(any(
    feature = "backend-candle",
    all(feature = "backend-mlx", target_os = "macos", target_arch = "aarch64")
))]
mod codec;
#[cfg(any(
    feature = "backend-candle",
    all(feature = "backend-mlx", target_os = "macos", target_arch = "aarch64")
))]
mod engine;
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
pub use engine::{ENGINE_NAME, OmniVoice, SAMPLE_RATE};
