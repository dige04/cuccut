//! Native port of GPT-SoVITS v2 (`gsv-v2final-pretrained` from `lj1995/GPT-SoVITS`, with safetensors re-saved at
//! `PJMixers-Dev/lj1995_GPT-SoVITS-safetensors`), ported from v2 `ccut-tts::gpt_sovits`.
//!
//! The model graph and text front end are ported layer by layer against the upstream `RVC-Boss/GPT-SoVITS` (MIT). The source and license of each text front-end data set are listed in
//! `text/mod.rs` and `text/data/README.md`.
//!
//! Pipeline: text → front end (sentence splitting, normalization, G2P → phoneme ids + `word2ph`) → chinese-roberta
//! layer-22 per-character features (Chinese segments only, the rest zero-padded) → T2S (24-layer AR Transformer) generates 25 Hz
//! semantic tokens → SoVITS (codebook decoding + text encoder + inverse flow + HiFi-GAN) → 32 kHz waveform.
//! Reference audio: 16 kHz → chinese-hubert-base → `ssl_proj` + VQ gives the prompt semantic tokens;
//! 32 kHz linear spectrogram → MelStyleEncoder gives the 512-dimensional timbre vector.
//!
//! The pure-logic modules (text front end, STFT, sampling) have no cfg gate, compile on all platforms and carry unit tests. The model graph and [`GptSovits`]
//! are compiled through the `synthesize::tensor` facade: on Apple Silicon it is MLX, and on other platforms with `backend-candle` enabled it is candle CPU/CUDA.

pub mod sampling;
pub mod spec;
pub mod text;

/// When reference text is given, the official implementation accepts only reference audio within this duration window (seconds); when only reference audio is given, there is no limit.
pub const REFERENCE_SECONDS_WITH_TEXT: [f32; 2] = [3.0, 10.0];

/// Error message after the caller returns `false` from the progress callback.
pub const ABORT_MESSAGE: &str = "GPT-SoVITS synthesis was cancelled by the caller";

#[cfg(any(
    feature = "backend-candle",
    all(feature = "backend-mlx", target_os = "macos", target_arch = "aarch64")
))]
mod bert;
#[cfg(any(
    feature = "backend-candle",
    all(feature = "backend-mlx", target_os = "macos", target_arch = "aarch64")
))]
mod engine;
#[cfg(any(
    feature = "backend-candle",
    all(feature = "backend-mlx", target_os = "macos", target_arch = "aarch64")
))]
mod hubert;
#[cfg(any(
    feature = "backend-candle",
    all(feature = "backend-mlx", target_os = "macos", target_arch = "aarch64")
))]
mod layers;
#[cfg(any(
    feature = "backend-candle",
    all(feature = "backend-mlx", target_os = "macos", target_arch = "aarch64")
))]
mod sovits;
#[cfg(any(
    feature = "backend-candle",
    all(feature = "backend-mlx", target_os = "macos", target_arch = "aarch64")
))]
mod t2s;
#[cfg(any(
    feature = "backend-candle",
    all(feature = "backend-mlx", target_os = "macos", target_arch = "aarch64")
))]
mod weights;

#[cfg(any(
    feature = "backend-candle",
    all(feature = "backend-mlx", target_os = "macos", target_arch = "aarch64")
))]
pub use engine::GptSovits;
