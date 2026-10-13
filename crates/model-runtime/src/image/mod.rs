//! Local text-to-image: request and result types, the engine trait, PNG encoding, and the orchestration of `job.run` (capability `image`).
//!
//! Ported from v2's `ccut-image-local` (the MLX and candle backends for Qwen-Image-2.1) and the pure half of `ccut-image::local` (task, stages, raw pixels). The only difference from v2 is the boundary: v2 finds files by “model directory + relative path” and runs in the caller's process. Here files are fetched by manifest via [`crate::bundle::VerifiedFiles`] (a missing file gives `MODEL_NOT_INSTALLED`), it runs inside the Model Worker, and the result is written as `image.png` in staging (`cuccut.image-png/v1`).
//!
//! - [`qwen_image`]: Qwen-Image-2.1. The scheduler and RoPE table are pure logic and compile on all platforms. The MLX model graph compiles only with `backend-mlx` on macOS Apple Silicon; the candle one compiles with `backend-candle` (it is loaded by the candle backend, not via [`load`]).
//! - [`job`]: the stages, progress, cancellation and writing of one `job.run`.
//! - [`png`]: RGBA → PNG.
//!
//! An engine instance holds a device handle and is not `Send`: it generates on the thread where it was loaded.

pub mod job;
pub mod png;
pub mod qwen_image;

use anyhow::Result;
use serde_json::json;

use crate::bundle::{FAMILY_QWEN_IMAGE, VerifiedFiles};
use crate::protocol::{ErrorBody, codes};

/// One generation: prompt, pixel width and height, number of denoising steps, and random seed (the same seed on the same machine gives the same image).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ImageRequest {
    pub prompt: String,
    pub width: u32,
    pub height: u32,
    pub steps: u32,
    pub seed: u64,
}

/// Generation progress: encoding the prompt → denoising (`done/total` steps; reports `0/total` at the start) → decoding.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ImageProgress {
    EncodingPrompt,
    Denoising { done: u32, total: u32 },
    Decoding,
}

/// 8-bit RGBA, row-major, `pixels.len() == width * height * 4`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RawImage {
    pub width: u32,
    pub height: u32,
    pub pixels: Vec<u8>,
}

/// Error returned by the engine after it sees the cancel flag between steps.
#[derive(Debug)]
pub struct Cancelled;

impl std::fmt::Display for Cancelled {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("cancelled")
    }
}

impl std::error::Error for Cancelled {}

/// A loaded local text-to-image model.
pub trait ImageEngine {
    /// Model family (`components.image.family`).
    fn family(&self) -> &'static str;

    /// Number of steps used when the request gives none.
    fn default_steps(&self) -> u32;

    /// Whether this model can produce this size. If not, `MODEL_UNSUPPORTED` (`details.reason: 'unsupported-size'`). Does not touch the device.
    fn check_size(&self, width: u32, height: u32) -> Result<(), ErrorBody>;

    /// Generates one image. `cancel` is checked between steps; when it returns true, the implementation returns [`Cancelled`].
    fn generate(&mut self, request: &ImageRequest, progress: &mut dyn FnMut(ImageProgress), cancel: &dyn Fn() -> bool) -> Result<RawImage>;
}

/// Whether this build can load Qwen-Image: it can if MLX (Apple Silicon) or candle (any platform) is compiled in.
pub const fn qwen_image_available() -> bool {
    cfg!(any(
        all(feature = "backend-mlx", target_os = "macos", target_arch = "aarch64"),
        feature = "backend-candle"
    ))
}

/// Text-to-image families this build recognizes (`components.image.family`).
pub const IMAGE_FAMILIES: [&str; 1] = [FAMILY_QWEN_IMAGE];

/// Whether this family can be loaded in this build.
pub fn family_available(family: &str) -> bool {
    match family {
        FAMILY_QWEN_IMAGE => qwen_image_available(),
        _ => false,
    }
}

/// Text-to-image families this build can load. This is `imageFamilies` in `worker.hello`; the `image` capability is declared only when it is non-empty (protocol spec §2.1).
pub fn available_families() -> Vec<&'static str> {
    IMAGE_FAMILIES.into_iter().filter(|family| family_available(family)).collect()
}

/// Loads an MLX engine. (The candle backend uses `qwen_image::candle::QwenImage::load` instead, with the device.) No need to confirm Metal before calling: the implementation first checks the manifest (a missing file is `MODEL_NOT_INSTALLED`), then confirms the device.
///
/// An [`ErrorBody`] in the error can be recovered with `downcast_ref` and reported as is; anything else is a load failure.
pub fn load(files: &VerifiedFiles) -> Result<Box<dyn ImageEngine>> {
    if !family_available(&files.family) {
        return Err(crate::protocol::image_not_wired(Some(&files.family)).into());
    }
    load_available(files)
}

#[cfg(all(feature = "backend-mlx", target_os = "macos", target_arch = "aarch64"))]
fn load_available(files: &VerifiedFiles) -> Result<Box<dyn ImageEngine>> {
    Ok(Box::new(qwen_image::QwenImage::load(files)?))
}

#[cfg(not(all(feature = "backend-mlx", target_os = "macos", target_arch = "aarch64")))]
fn load_available(files: &VerifiedFiles) -> Result<Box<dyn ImageEngine>> {
    Err(crate::protocol::image_not_wired(Some(&files.family)).into())
}

/// Size not possible: `MODEL_UNSUPPORTED`, with the requested width and height and the model's rules.
pub fn unsupported_size(family: &str, width: u32, height: u32, rule: &str) -> ErrorBody {
    ErrorBody::new(
        codes::MODEL_UNSUPPORTED,
        format!("{family} cannot generate {width}x{height} ({rule})"),
    )
    .with_details(json!({ "family": family, "reason": "unsupported-size", "width": width, "height": height, "rule": rule }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::bundle::{FileEntry, ModelFiles};

    #[test]
    fn only_wired_families_are_reported() {
        let families = available_families();
        if qwen_image_available() {
            assert_eq!(families, [FAMILY_QWEN_IMAGE]);
        } else {
            assert!(families.is_empty());
        }
        assert!(!family_available("stable-diffusion"));
    }

    #[test]
    fn unknown_families_are_not_wired() {
        let dir = tempfile::tempdir().unwrap();
        let files = ModelFiles {
            family: "stable-diffusion".into(),
            revision: "r".into(),
            dir: dir.path().to_string_lossy().into_owned(),
            files: Vec::<FileEntry>::new(),
        }
        .verify("image")
        .unwrap();
        let error = match load(&files) {
            Ok(_) => panic!("should not load successfully"),
            Err(error) => error.downcast_ref::<ErrorBody>().expect("ErrorBody").clone(),
        };
        assert_eq!(error.code, codes::MODEL_UNSUPPORTED);
        assert_eq!(error.details.unwrap()["reason"], "not-wired");
    }
}
