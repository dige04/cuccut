//! Vocal and accompaniment separation (local `separate`): the mlx-rs and candle ports of HTDemucs-FT (Demucs v4 hybrid transformer).
//!
//! Ported from v2's `ccut-separate`. Purpose: before dubbing, split the original vocals from the background (drums, bass, other); after dubbing, keep only the background and overlay the synthesized vocals. The only differences from v2 are at the boundary: v2 finds files by "model directory + file name", whereas here files are fetched from the manifest via
//! [`crate::bundle::VerifiedFiles`] (a missing file gives `MODEL_NOT_INSTALLED`); the MLX device and cache go through [`crate::backend::mlx::runtime`], and the candle device is set by the candle backend according to the bundle's `device`; the orchestration of one `job.run` is in [`job`].
//!
//! Types and pure logic ([`config`], [`segment`], [`stft`], [`resample`], [`wav`], [`types`]) compile on all platforms and have unit tests;
//! the model graph (`htdemucs`) is compiled once as MLX on `backend-mlx` + macOS Apple Silicon, and once more as candle when `backend-candle` is enabled
//! (all platforms; CPU, or an NVIDIA GPU when `cuda` is enabled).

pub mod config;
pub mod job;
pub mod resample;
pub mod segment;
pub mod stft;
pub mod types;
pub mod wav;

#[cfg(any(
    feature = "backend-candle",
    all(feature = "backend-mlx", target_os = "macos", target_arch = "aarch64")
))]
pub mod htdemucs;

pub use config::HtDemucsConfig;
pub use types::{SeparatedStems, SeparationProgress, StereoAudio};

use crate::bundle::VerifiedFiles;
use anyhow::Result;

/// Separation progress callback; returning `false` requests cancellation.
pub type ProgressSink<'a> = &'a mut dyn FnMut(SeparationProgress) -> bool;

/// Whether a local separation backend is available in this build.
pub const fn local_separation_available() -> bool {
    cfg!(any(
        feature = "backend-candle",
        all(feature = "backend-mlx", target_os = "macos", target_arch = "aarch64")
    ))
}

/// The separation model families this build can load (`components.separator.family`). `separateFamilies` in `worker.hello` is exactly this.
pub fn available_families() -> Vec<&'static str> {
    if local_separation_available() {
        vec![crate::bundle::FAMILY_HTDEMUCS_FT]
    } else {
        Vec::new()
    }
}

/// A loaded separation model. Holds the weights and is not `Send`: separation happens on the same thread where it was loaded.
pub trait Separator {
    /// The model's working sample rate (44 100 Hz for HTDemucs).
    fn sample_rate(&self) -> u32;

    /// Splits a stereo mix into four stems (at the model's sample rate, same length).
    fn separate(&mut self, mix: &StereoAudio, progress: ProgressSink<'_>) -> Result<SeparatedStems>;
}

/// Loads HTDemucs-FT with MLX (`htdemucs_ft.safetensors` + `htdemucs_ft_config.json`). The caller does not need to check for Metal beforehand.
///
/// The [`crate::protocol::ErrorBody`] inside the error (a missing file) can be recovered with `downcast_ref` and reported as is; anything else is a loading failure.
#[cfg(all(feature = "backend-mlx", target_os = "macos", target_arch = "aarch64"))]
pub fn load_separator(files: &VerifiedFiles) -> Result<Box<dyn Separator>> {
    Ok(Box::new(htdemucs::mlx::HtDemucs::load(files)?))
}

/// Builds without MLX: the MLX backend itself is unavailable and this is never reached; candle uses [`load_candle_separator`].
#[cfg(not(all(feature = "backend-mlx", target_os = "macos", target_arch = "aarch64")))]
pub fn load_separator(files: &VerifiedFiles) -> Result<Box<dyn Separator>> {
    let _ = files;
    Err(crate::protocol::ErrorBody::new(
        crate::protocol::codes::MODEL_UNSUPPORTED,
        "local audio separation is not available in this build",
    )
    .with_details(serde_json::json!({ "capability": "separate", "reason": "not-compiled" }))
    .into())
}

/// Loads HTDemucs-FT with candle on `device` (reads the same repository as MLX: fp16 weights are upcast to f32 at load time, and both CPU and CUDA compute in f32,
/// same as v2). Error conventions are the same as [`load_separator`].
#[cfg(feature = "backend-candle")]
pub fn load_candle_separator(files: &VerifiedFiles, device: candle_core::Device) -> Result<Box<dyn Separator>> {
    htdemucs::candle::use_device(device);
    Ok(Box::new(htdemucs::candle::HtDemucs::load(files)?))
}
