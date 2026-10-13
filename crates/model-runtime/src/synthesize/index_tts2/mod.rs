//! IndexTTS2 and IndexTTS 2.5 (mlx-rs implementation, ported from v2 `ccut-tts::index_tts2`).
//!
//! Parts are ported from speech-swift (https://github.com/soniqo/speech-swift, Apache License 2.0,
//! Copyright 2025 Ivan Digital) with modifications: rewritten in Rust / mlx-rs, the inference flow is corrected against the official `indextts/infer_v2.py` /
//! `infer_v2_5.py`, and it is wired up according to this repository's model-package and error conventions.
//! SPDX-License-Identifier: Apache-2.0
//! Full original license: `crates/model-runtime/licenses/speech-swift.txt`; for the scope of sources, see `THIRD_PARTY_NOTICES.md` in the repository root.
//!
//! Pipeline: reference audio → w2v-BERT 2.0 (layer 17) → MaskGCT semantic codebook quantization →
//! CAMPPlus 192-dim speaker embedding → GPT semantic token generation → S2Mel (DiT flow matching) → BigVGAN
//! (22.05 kHz). Emotion is controlled by the feat1/feat2 matrices or by reference audio; the `qwen0.6bemo4-merge`
//! text-emotion model is out of scope.
//!
//! IndexTTS 2.5 ([`IndexTts25`]) reuses the same model graph: the tiktoken multilingual frontend lives in `v25`,
//! the GPT conditioning is changed to a CAM++-style projection, semantic codes go through the 2.5 codebook decoder to get S2Mel content features,
//! and w2v-BERT / CAM++ / BigVGAN are the same as in 2.0.
//!
//! The w2v-BERT / CAM++ / BigVGAN weights and statistics live in the IndexTTS2 repository: for 2.0 the main model components are in this repository; for 2.5 the main model components
//! are in the 2.5 repository, with an extra `aux` component pointing to the IndexTTS2 repository. The engine reads only the files listed in the manifest.
//!
//! Pure-logic modules (config, SentencePiece, text normalization, tokenization, segmentation, emotion vectors, CPU
//! DSP) have no cfg gate, compile on all platforms and carry unit tests. The model graph (`mlx`, the directory name is inherited from the MLX origin)
//! is compiled through the `synthesize::tensor` facade: MLX on Apple Silicon, and candle CPU/CUDA on other platforms when `backend-candle` is enabled.

pub mod config;
pub mod dsp;
pub mod emotion;
pub mod normalizer;
pub mod sampling;
pub mod segmenter;
pub mod sentencepiece;
pub mod tokenizer;
pub mod v25;

/// Valid range `[0.5, 1.5]` for the IndexTTS 2.5 speed multiplier (`TtsRequest::speed`).
pub const SPEAKING_RATE_RANGE: (f32, f32) = (0.5, 1.5);

#[cfg(any(
    feature = "backend-candle",
    all(feature = "backend-mlx", target_os = "macos", target_arch = "aarch64")
))]
pub(crate) mod mlx;

#[cfg(any(
    feature = "backend-candle",
    all(feature = "backend-mlx", target_os = "macos", target_arch = "aarch64")
))]
pub use mlx::engine_impl::IndexTts2;

#[cfg(any(
    feature = "backend-candle",
    all(feature = "backend-mlx", target_os = "macos", target_arch = "aarch64")
))]
pub use mlx::engine_v25::IndexTts25;
