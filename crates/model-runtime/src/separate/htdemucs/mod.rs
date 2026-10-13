//! HTDemucs-FT (Demucs v4 hybrid transformer, four sub-models, each specialized for one stem): the MLX and candle backends share one model graph.
//!
//! Parts are ported from speech-swift (https://github.com/soniqo/speech-swift , Apache License 2.0,
//! Copyright 2025 Ivan Digital), with modifications: rewritten in Rust / mlx-rs and wired up to this repository's model-bundle and error conventions.
//! SPDX-License-Identifier: Apache-2.0
//! Full original license: `crates/model-runtime/licenses/speech-swift.txt`; for the scope of the sources, see `THIRD_PARTY_NOTICES.md` in the repository root.
//!
//! Cross-reference with speech-swift `Sources/SourceSeparation/HTDemucs/`: `layers.rs` ↔ `HTDemucsLayers.swift` and
//! `DemucsPrimitives.swift`, `transformer.rs` ↔ `HTDemucsTransformer.swift`, `model.rs` ↔
//! `HTDemucs.swift`, `separator.rs` ↔ `HTDemucsSeparator.swift` (bag loading, window splitting, per-stem inference).
//! The STFT is in `super::stft` (CPU realfft), and window scheduling is in `super::segment`.
//!
//! The model graph uses only a small set of tensor operations (`tensor`). As in v2, the same graph is compiled against two vocabularies: [`mlx`] uses mlx-rs, and [`candle`] uses v2's candle adapter layer (`tensor/candle.rs`, which only changes layout at the convolution boundary). In v2 one or the other was chosen; here both backends can be built into the same build (with `backend-candle` enabled on macOS), so each is compiled separately and they do not affect each other.

#[cfg(all(feature = "backend-mlx", target_os = "macos", target_arch = "aarch64"))]
pub mod mlx;

#[cfg(feature = "backend-candle")]
pub mod candle;
