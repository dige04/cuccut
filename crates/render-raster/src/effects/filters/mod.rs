//! Strict CPU reference filters (ADR-M05).
//!
//! The parts moved line by line from `core/crates/ccut-kernel/src/cmd/studio_export/raster.rs` are **bit-exact**: blur, color adjustment, SDF mask, horizontal reveal, and premultiplied compositing. The newly added parts (contrast, saturation, sepia, hueRotate, chroma key, alpha threshold, image mask) follow the same conventions. They use premultiplied sRGB / u8, un-premultiply into f64 arithmetic, then clamp, multiply back by alpha, and `round()`.

pub mod alpha_threshold;
pub mod bloom;
pub mod blur;
pub mod chroma_key;
pub mod color_adjust;
pub mod composite_premul;
pub mod drop_shadow;
pub mod god_rays;
pub mod grade;
pub mod mask_image;
pub mod mask_shape;
pub mod radial_blur;
pub mod reveal;
pub mod stylize;

pub mod studio;
