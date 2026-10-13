//! Qwen-Image-2.1 (`mlx-community/Qwen-Image-2.1-MLX-4bit`), ported from v2 `ccut-image-local::qwen`.
//!
//! The three models run in sequence and never reside together: text encoder → release → DiT → release → VAE. The text encoder and DiT layer weights are streamed in layer by layer (the next layer is prefetched and dropped after use), so only two adjacent layers are resident. The cache limit is set per stage and restored on exit (`engine::CacheLimit`).
//!
//! Pure logic (size rules, prompt template and tokenization, scheduler, RoPE table) compiles on all platforms. The MLX model graph compiles only with `backend-mlx` on macOS Apple Silicon; the candle one ([`candle`], CPU and CUDA) compiles with `backend-candle`. Both paths read the same model package repository.

/// When `CCUT_IMAGE_TIMING=1`, each stage's time, each step's time and memory snapshots are printed to stderr (for development self-checks; off by default in the Worker, since stdout is the protocol channel).
#[allow(unused_macros)]
macro_rules! trace {
    ($($arg:tt)*) => {
        if $crate::image::qwen_image::timing() {
            eprintln!($($arg)*);
        }
    };
}

#[cfg(feature = "backend-candle")]
pub mod candle;
pub mod prompt;
pub mod rope;
pub mod scheduler;

#[cfg(all(feature = "backend-mlx", target_os = "macos", target_arch = "aarch64"))]
mod dit;
#[cfg(all(feature = "backend-mlx", target_os = "macos", target_arch = "aarch64"))]
mod engine;
#[cfg(all(feature = "backend-mlx", target_os = "macos", target_arch = "aarch64"))]
mod text_encoder;
#[cfg(all(feature = "backend-mlx", target_os = "macos", target_arch = "aarch64"))]
mod vae;
#[cfg(all(feature = "backend-mlx", target_os = "macos", target_arch = "aarch64"))]
mod weights;

#[cfg(all(feature = "backend-mlx", target_os = "macos", target_arch = "aarch64"))]
pub use engine::QwenImage;

use crate::bundle::FAMILY_QWEN_IMAGE;
use crate::protocol::ErrorBody;

/// The number of denoising steps when the request gives none (same value as v2).
pub const DEFAULT_STEPS: u32 = 20;
/// Both width and height must be integer multiples of this (VAE downsampling 8 × DiT patch 2, with one more step kept for 2×2 packing).
pub const SIZE_MULTIPLE: u32 = 32;
/// Upper limit on the long edge (v2 capability table `max_edge`).
pub const MAX_EDGE: u32 = 1536;
/// Upper limit on the long-to-short edge ratio (v2 capability table `max_ratio`).
pub const MAX_RATIO: u32 = 3;

#[doc(hidden)]
pub fn timing() -> bool {
    static ON: std::sync::OnceLock<bool> = std::sync::OnceLock::new();
    *ON.get_or_init(|| std::env::var_os("CCUT_IMAGE_TIMING").is_some_and(|v| v == "1"))
}

/// Whether this model can produce this size. Does not touch the device.
pub fn check_size(width: u32, height: u32) -> Result<(), ErrorBody> {
    let fail = |rule: &str| Err(super::unsupported_size(FAMILY_QWEN_IMAGE, width, height, rule));
    if width == 0 || height == 0 || !width.is_multiple_of(SIZE_MULTIPLE) || !height.is_multiple_of(SIZE_MULTIPLE) {
        return fail("multiple-of-32");
    }
    if width.max(height) > MAX_EDGE {
        return fail("max-edge-1536");
    }
    if width.max(height) > width.min(height) * MAX_RATIO {
        return fail("max-ratio-3");
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::protocol::codes;

    #[test]
    fn sizes_follow_the_multiple_edge_and_ratio_rules() {
        for (w, h) in [
            (1024, 1024),
            (1024, 576),
            (576, 1024),
            (1024, 768),
            (768, 1024),
            (1024, 448),
            (256, 256),
            (1536, 512),
        ] {
            assert!(check_size(w, h).is_ok(), "{w}x{h}");
        }
        for (w, h, rule) in [
            (500, 512, "multiple-of-32"),
            (0, 512, "multiple-of-32"),
            (1568, 1024, "max-edge-1536"),
            (1536, 480, "max-ratio-3"),
        ] {
            let error = check_size(w, h).unwrap_err();
            assert_eq!(error.code, codes::MODEL_UNSUPPORTED);
            let details = error.details.unwrap();
            assert_eq!(details["reason"], "unsupported-size");
            assert_eq!(details["rule"], rule, "{w}x{h}");
        }
    }
}
