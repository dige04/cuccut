//! Qwen3-TTS 12 Hz (mlx-rs implementation, ported from v2 `ccut-tts::qwen3_tts`).
//!
//! Partly ported from speech-swift (https://github.com/soniqo/speech-swift , Apache License 2.0,
//! Copyright 2025 Ivan Digital), with modifications: rewritten in Rust / mlx-rs and wired in according to this repo's model-package and error conventions.
//! SPDX-License-Identifier: Apache-2.0
//! Full original license: `crates/model-runtime/licenses/speech-swift.txt`; for the scope of sources, see `THIRD_PARTY_NOTICES.md` at the repo root.
//!
//! Components: Talker (28-layer Qwen3, `talker.rs`) → Code Predictor (5 layers, 15
//! lm heads, `code_predictor.rs`) → Speech Tokenizer decoder (RVQ → transformer
//! → SEANet upsampling, 24 kHz, `codec_decoder.rs`). The cloning path also needs the Speaker
//! Encoder (ECAPA-TDNN x-vector, `speaker_encoder.rs`) and the Speech Tokenizer
//! encoder (in ICL mode it encodes the reference audio into codec tokens, `codec_encoder.rs`).
//! The Speech Tokenizer (`Qwen/Qwen3-TTS-Tokenizer-12Hz`) is a companion component shared by all sizes and variants.
//!
//! Pure-logic submodules (`config` / `tokens` / `prompt` / `sampling` / `mel`) have no cfg gate, compile on all platforms, and have unit tests. The model graph and [`Qwen3Tts`] compile through the `synthesize::tensor` facade: on Apple Silicon that is MLX, and on other platforms with `backend-candle` enabled it is candle CPU/CUDA.

pub mod config;
pub mod mel;
pub mod prompt;
pub mod sampling;
pub mod tokens;

#[cfg(any(
    feature = "backend-candle",
    all(feature = "backend-mlx", target_os = "macos", target_arch = "aarch64")
))]
mod code_predictor;
#[cfg(any(
    feature = "backend-candle",
    all(feature = "backend-mlx", target_os = "macos", target_arch = "aarch64")
))]
mod codec_decoder;
#[cfg(any(
    feature = "backend-candle",
    all(feature = "backend-mlx", target_os = "macos", target_arch = "aarch64")
))]
mod codec_encoder;
#[cfg(any(
    feature = "backend-candle",
    all(feature = "backend-mlx", target_os = "macos", target_arch = "aarch64")
))]
mod engine;
#[cfg(any(
    feature = "backend-candle",
    all(feature = "backend-mlx", target_os = "macos", target_arch = "aarch64")
))]
pub(crate) mod layers;
#[cfg(any(
    feature = "backend-candle",
    all(feature = "backend-mlx", target_os = "macos", target_arch = "aarch64")
))]
mod speaker_encoder;
#[cfg(any(
    feature = "backend-candle",
    all(feature = "backend-mlx", target_os = "macos", target_arch = "aarch64")
))]
mod talker;
#[cfg(any(
    feature = "backend-candle",
    all(feature = "backend-mlx", target_os = "macos", target_arch = "aarch64")
))]
pub(crate) mod weights;

#[cfg(any(
    feature = "backend-candle",
    all(feature = "backend-mlx", target_os = "macos", target_arch = "aarch64")
))]
pub use engine::Qwen3Tts;
