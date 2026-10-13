//! Strict CPU reference effect implementations (ADR-M05 / design §6.3).
//!
//! Division of labor: **the manifests live in `ccut-motion`**. It is the pure function layer, and `ccut-core::lint` and `ccut-timeline` both need to read the effect version table without depending on the host layer. `ccut-render` holds only the pixel implementations. The two sides are connected by the manifest's **named kernel** `kernel`. [`kernel_is_implemented`] guarantees that every strict manifest has a CPU reference. `tests/effects_conformance.rs` checks this invariant entry by entry.

pub mod composite;
pub mod filters;
pub mod pixel_format;
pub mod transitions;

pub use composite::blend::blend_to_skia;
pub use filters::blur::{
    ContentBox, MAX_BLUR_RADIUS, alpha_bbox, alpha_bbox_within, box_blur_bounded, box_blur_content,
    box_blur_premul_u8, clear_content_box,
};
pub use filters::composite_premul::composite_premultiplied_rgba;
pub use filters::mask_image::MaskChannel;
pub use filters::mask_shape::{multiply_pixel_coverage, multiply_premultiplied_alpha};
pub use pixel_format::{
    premultiplied_rgba_to_straight_bgra, visible_premultiplied_rgba_to_straight_bgra,
};
pub use transitions::Direction;

/// Re-export point for the effect vocabulary. The host side (`apps/cli`) depends only on `ccut-render`, so it does not need an edge to `ccut-motion` just for two value types.
pub use motion::effect::{EffectRef, UniformMap, UniformValue};

use anyhow::{Result, anyhow, bail};
use motion::effect::lookup;
use tiny_skia::Pixmap;

/// Names of implemented kernels. Adding a strict manifest requires adding an implementation entry here.
pub const IMPLEMENTED_KERNELS: &[&str] = &[
    "box-1pass-integer",
    "brightness-unpremul-f64",
    "contrast-unpremul-f64",
    "saturation-rec709-f64",
    "grayscale-rec709-f64",
    "sepia-matrix-f64",
    "hue-rotate-matrix-f64",
    "color-adjust-grayscale-brightness-f64",
    "invert-unpremul-f64",
    "sharpen-cross-premul-u8",
    "rgb-split-premul-u8",
    "directional-17tap-premul-u8",
    "alpha-outline-square-premul-u8",
    "noise-coordinate-hash-premul-u8",
    "vignette-radial-premul-u8",
    "shadow-blur-composite-premul",
    "chroma-key-euclidean-f64",
    "alpha-threshold-smoothstep",
    "bloom-pyramid-premul-f32",
    "grade-lgg-unpremul-f64",
    "radial-zoom-3pass-premul-f32",
    "god-rays-halfres-zoom-premul-f32",
    "sdf-rounded-rect-ellipse",
    "linear-reveal-coverage",
    "alpha-mask-from-pixmap",
    "luma-mask-from-pixmap",
    "porter-duff-separable",
    "crossfade-lerp-premul-u8",
    "slide-shift-copy",
    "wipe-linear-coverage",
    "circle-crop-sdf-coverage",
    "ink-blot-noise-coverage",
    "shatter-logpolar-voronoi-premul-u8",
    "glitch-band-shift-premul-u8",
];

pub fn kernel_is_implemented(kernel: &str) -> bool {
    IMPLEMENTED_KERNELS.contains(&kernel)
}

/// Runs a single-input filter. `uniforms` must already have passed through [`motion::effect::EffectManifest::resolve_uniforms`] (defaults filled in, ranges clamped).
///
/// The dual-input `mask.image` / `mask.luma` do not go through here. They need a second surface, which the mask input of the `Composite` pass provides (stage 4B).
pub fn apply_filter(
    effect: &EffectRef,
    uniforms: &UniformMap,
    input: &Pixmap,
    canvas_short_edge: f64,
) -> Result<Pixmap> {
    let mut out = input.clone();
    apply_filter_in_place(effect, uniforms, &mut out, canvas_short_edge)?;
    Ok(out)
}

/// The in-place form of [`apply_filter`]. A filter stack is a chain of in-place transforms, so chaining them should not copy a 4K buffer at every step.
pub fn apply_filter_in_place(
    effect: &EffectRef,
    uniforms: &UniformMap,
    pixmap: &mut Pixmap,
    canvas_short_edge: f64,
) -> Result<()> {
    let manifest = lookup(&effect.id, effect.version).map_err(|error| anyhow!("{error}"))?;
    if manifest.inputs != 1 {
        bail!(
            "effect-input-mismatch: {} 需要 {} 个输入，Filter pass 只提供 1 个",
            manifest.qualified(),
            manifest.inputs
        );
    }
    let uniforms = manifest
        .resolve_uniforms(uniforms)
        .map_err(|error| anyhow!("{error}"))?;
    let width = pixmap.width();
    let height = pixmap.height();
    let data = pixmap.data_mut();
    // `length` is converted relative to the canvas short side. `quantize: round-to-int` then rounds it.
    let length = |key: &str| -> f64 {
        let raw = uniforms.scalar(key).unwrap_or(0.0);
        match manifest
            .params
            .get(key)
            .and_then(|spec| spec.basis.as_deref())
        {
            Some("canvasShortEdge") => raw * canvas_short_edge,
            _ => raw,
        }
    };
    let rounded = |key: &str| -> f64 {
        let value = length(key);
        match manifest
            .params
            .get(key)
            .and_then(|spec| spec.quantize.as_deref())
        {
            Some("round-to-int") => value.round(),
            _ => value,
        }
    };
    let color = |key: &str| -> [f64; 4] {
        match uniforms.get(key) {
            Some(UniformValue::Color(rgba)) => *rgba,
            _ => [0.0, 0.0, 0.0, 1.0],
        }
    };

    match manifest.kernel.as_str() {
        "rgb-split-premul-u8" => filters::studio::rgb_split(
            data,
            width as usize,
            height as usize,
            rounded("distance"),
            uniforms.scalar("angle").unwrap_or(0.0),
        ),
        "directional-17tap-premul-u8" => filters::studio::directional_blur(
            data,
            width as usize,
            height as usize,
            rounded("distance"),
            uniforms.scalar("angle").unwrap_or(0.0),
        ),
        "alpha-outline-square-premul-u8" => filters::studio::outline(
            data,
            width as usize,
            height as usize,
            rounded("radius") as usize,
            color("color"),
        ),
        "box-1pass-integer" => {
            // Uses the **bounding-box** version. It is byte-for-byte identical to the full-frame version (the proof is in the comment in `blur.rs`), but on overlay frames with large transparent areas it skips two full-frame scans.
            filters::blur::box_blur_content(
                data,
                width,
                height,
                rounded("radius").max(0.0) as usize,
            );
        }
        "brightness-unpremul-f64" => {
            filters::color_adjust::brightness_only(data, uniforms.scalar("amount").unwrap_or(0.0));
        }
        "contrast-unpremul-f64" => {
            filters::color_adjust::contrast(data, uniforms.scalar("amount").unwrap_or(0.0));
        }
        "saturation-rec709-f64" => {
            filters::color_adjust::saturation(data, uniforms.scalar("amount").unwrap_or(1.0));
        }
        "grayscale-rec709-f64" => {
            filters::color_adjust::grayscale(data, uniforms.scalar("amount").unwrap_or(1.0));
        }
        "sepia-matrix-f64" => {
            filters::color_adjust::sepia(data, uniforms.scalar("amount").unwrap_or(1.0));
        }
        "hue-rotate-matrix-f64" => {
            filters::color_adjust::hue_rotate(data, uniforms.scalar("degrees").unwrap_or(0.0));
        }
        "color-adjust-grayscale-brightness-f64" => {
            filters::color_adjust::color_adjust(
                data,
                uniforms.scalar("grayscale").unwrap_or(0.0),
                uniforms.scalar("brightness").unwrap_or(0.0),
            );
        }
        "invert-unpremul-f64" => {
            filters::color_adjust::invert(data, uniforms.scalar("amount").unwrap_or(0.0));
        }
        "sharpen-cross-premul-u8" => {
            filters::stylize::sharpen(
                data,
                width,
                height,
                uniforms.scalar("amount").unwrap_or(0.0),
            );
        }
        "noise-coordinate-hash-premul-u8" => {
            filters::stylize::noise(
                data,
                width,
                height,
                uniforms.scalar("amount").unwrap_or(0.0),
            );
        }
        "vignette-radial-premul-u8" => {
            filters::stylize::vignette(
                data,
                width,
                height,
                uniforms.scalar("amount").unwrap_or(0.0),
            );
        }
        "shadow-blur-composite-premul" => {
            filters::drop_shadow::drop_shadow(
                data,
                width,
                height,
                rounded("radius").max(0.0) as usize,
                rounded("dx") as i32,
                rounded("dy") as i32,
                color("color"),
            );
        }
        "chroma-key-euclidean-f64" => {
            filters::chroma_key::chroma_key(
                data,
                color("color"),
                uniforms.scalar("similarity").unwrap_or(0.4),
                uniforms.scalar("smoothness").unwrap_or(0.1),
            );
        }
        "alpha-threshold-smoothstep" => {
            filters::alpha_threshold::alpha_threshold(
                data,
                uniforms.scalar("threshold").unwrap_or(0.5),
                uniforms.scalar("softness").unwrap_or(0.0),
            );
        }
        "bloom-pyramid-premul-f32" => {
            filters::bloom::bloom(
                data,
                width as usize,
                height as usize,
                uniforms.scalar("threshold").unwrap_or(0.8),
                uniforms.scalar("knee").unwrap_or(0.25),
                length("radius").max(0.0),
                uniforms.scalar("intensity").unwrap_or(1.0),
            );
        }
        "grade-lgg-unpremul-f64" => {
            filters::grade::grade(
                data,
                filters::grade::Grade {
                    lift: uniforms.scalar("lift").unwrap_or(0.0),
                    gamma: uniforms.scalar("gamma").unwrap_or(1.0),
                    gain: uniforms.scalar("gain").unwrap_or(1.0),
                    saturation: uniforms.scalar("saturation").unwrap_or(1.0),
                    tint: uniforms.scalar("tint").unwrap_or(0.0),
                    shoulder: uniforms.scalar("shoulder").unwrap_or(0.0),
                },
            );
        }
        "radial-zoom-3pass-premul-f32" => {
            filters::radial_blur::radial_blur(
                data,
                width as usize,
                height as usize,
                uniforms.scalar("cx").unwrap_or(0.5),
                uniforms.scalar("cy").unwrap_or(0.5),
                uniforms.scalar("strength").unwrap_or(0.0),
                uniforms.scalar("samples").unwrap_or(8.0),
            );
        }
        "god-rays-halfres-zoom-premul-f32" => {
            let tint = match uniforms.get("tint") {
                Some(UniformValue::Color(rgba)) => *rgba,
                _ => [1.0; 4],
            };
            filters::god_rays::god_rays(
                data,
                width as usize,
                height as usize,
                &filters::god_rays::GodRays {
                    cx: uniforms.scalar("cx").unwrap_or(0.5),
                    cy: uniforms.scalar("cy").unwrap_or(0.0),
                    threshold: uniforms.scalar("threshold").unwrap_or(0.6),
                    length: uniforms.scalar("length").unwrap_or(0.0),
                    intensity: uniforms.scalar("intensity").unwrap_or(0.0),
                    decay: uniforms.scalar("decay").unwrap_or(0.0),
                    tint,
                },
            );
        }
        "sdf-rounded-rect-ellipse" => {
            let mut radii = [
                length("radiusTopLeft").max(0.0),
                length("radiusTopRight").max(0.0),
                length("radiusBottomRight").max(0.0),
                length("radiusBottomLeft").max(0.0),
            ];
            if radii.iter().all(|radius| *radius <= f64::EPSILON) {
                radii = [length("radius").max(0.0); 4];
            }
            filters::mask_shape::mask_shape_corners(
                data,
                width,
                height,
                radii,
                uniforms.text("shape") == Some("ellipse"),
                length("feather").max(0.0),
            );
        }
        "linear-reveal-coverage" => {
            let progress = uniforms.scalar("progress").unwrap_or(1.0);
            if uniforms.bool("invert").unwrap_or(false) {
                filters::reveal::horizontal_reveal_inverted(data, width, height, progress);
            } else {
                filters::reveal::horizontal_reveal(data, width, height, progress);
            }
        }
        other => bail!(
            "effect-capability-unsupported: 内核 {other}（{}）没有 CPU reference 实现",
            manifest.qualified()
        ),
    }
    Ok(())
}

/// Runs a **dual-picture transition** (`transition.*@1`, spec §9).
///
/// `progress` is the closed interval `[0, 1]`. The output at `0` is byte-for-byte equal to `from`, and at `1` it is byte-for-byte equal to `to`. This is exact, not approximate. `tests/effects_conformance.rs` compares the bytes.
///
/// The two inputs must have the same size (the manifest's `resizeMode: same-as-input`).
pub fn apply_transition(
    effect: &EffectRef,
    uniforms: &UniformMap,
    from: &Pixmap,
    to: &Pixmap,
    progress: f32,
    canvas_short_edge: f64,
) -> Result<Pixmap> {
    let manifest = lookup(&effect.id, effect.version).map_err(|error| anyhow!("{error}"))?;
    if manifest.domain != motion::effect::EffectDomain::Transition || manifest.inputs != 2 {
        bail!(
            "effect-input-mismatch: {} 不是双画面转场",
            manifest.qualified()
        );
    }
    if from.width() != to.width() || from.height() != to.height() {
        bail!(
            "effect-capability-unsupported: {} 的两张输入尺寸不同（{}×{} vs {}×{}），             manifest 声明 resizeMode: {}",
            manifest.qualified(),
            from.width(),
            from.height(),
            to.width(),
            to.height(),
            manifest.resize_mode
        );
    }
    let progress = f64::from(progress);
    if !(0.0..=1.0).contains(&progress) {
        bail!(
            "preset-param-invalid: {} 的 progress = {progress} 不在闭区间 [0, 1]",
            manifest.qualified()
        );
    }
    let uniforms = manifest
        .resolve_uniforms(uniforms)
        .map_err(|error| anyhow!("{error}"))?;
    let length = |key: &str| -> f64 {
        let raw = uniforms.scalar(key).unwrap_or(0.0);
        match manifest
            .params
            .get(key)
            .and_then(|spec| spec.basis.as_deref())
        {
            Some("canvasShortEdge") => raw * canvas_short_edge,
            _ => raw,
        }
    };
    let direction = || -> Result<Direction> {
        let text = uniforms.text("direction").unwrap_or("left");
        Direction::parse(text)
            .ok_or_else(|| anyhow!("preset-param-invalid: 未知 direction \"{text}\""))
    };

    let (width, height) = (from.width(), from.height());
    let mut out = Pixmap::new(width, height)
        .ok_or_else(|| anyhow!("transition 输出尺寸非法：{width}×{height}"))?;
    match manifest.kernel.as_str() {
        "crossfade-lerp-premul-u8" => {
            transitions::crossfade::crossfade(from.data(), to.data(), out.data_mut(), progress);
        }
        "slide-shift-copy" => {
            transitions::slide::slide(
                from.data(),
                to.data(),
                out.data_mut(),
                width,
                height,
                direction()?,
                progress,
            );
        }
        "wipe-linear-coverage" => {
            transitions::wipe::wipe(
                from.data(),
                to.data(),
                out.data_mut(),
                width,
                height,
                direction()?,
                length("softness"),
                progress,
            );
        }
        "circle-crop-sdf-coverage" => {
            transitions::circle_crop::circle_crop(
                from.data(),
                to.data(),
                out.data_mut(),
                width,
                height,
                uniforms.scalar("cx").unwrap_or(0.5),
                uniforms.scalar("cy").unwrap_or(0.5),
                length("softness"),
                uniforms.bool("invert").unwrap_or(false),
                progress,
            );
        }
        "ink-blot-noise-coverage" => {
            transitions::ink_blot::ink_blot(
                from.data(),
                to.data(),
                out.data_mut(),
                width,
                height,
                uniforms.scalar("cx").unwrap_or(0.5),
                uniforms.scalar("cy").unwrap_or(0.5),
                length("softness"),
                uniforms.scalar("roughness").unwrap_or(0.18),
                uniforms.scalar("seed").unwrap_or(0.0).max(0.0) as u64,
                uniforms.bool("invert").unwrap_or(false),
                progress,
            );
        }
        "shatter-logpolar-voronoi-premul-u8" => {
            transitions::shatter::shatter(
                from.data(),
                to.data(),
                out.data_mut(),
                width,
                height,
                &transitions::shatter::Shatter {
                    pieces: uniforms.scalar("pieces").unwrap_or(48.0),
                    seed: uniforms.scalar("seed").unwrap_or(0.0).max(0.0) as u64,
                    cx: uniforms.scalar("cx").unwrap_or(0.5),
                    cy: uniforms.scalar("cy").unwrap_or(0.5),
                    force: length("force"),
                    rotation: uniforms.scalar("rotation").unwrap_or(0.0),
                    gravity: length("gravity"),
                    crack: uniforms.scalar("crack").unwrap_or(0.0),
                },
                progress,
            );
        }
        "glitch-band-shift-premul-u8" => {
            transitions::glitch::glitch(
                from.data(),
                to.data(),
                out.data_mut(),
                width,
                height,
                &transitions::glitch::Glitch {
                    vertical: uniforms.text("direction").unwrap_or("vertical") != "horizontal",
                    slices: uniforms.scalar("slices").unwrap_or(24.0),
                    amount: length("amount"),
                    rgb: length("rgb"),
                    steps: uniforms.scalar("steps").unwrap_or(10.0),
                    flicker: uniforms.scalar("flicker").unwrap_or(0.0),
                    seed: uniforms.scalar("seed").unwrap_or(0.0).max(0.0) as u64,
                },
                progress,
            );
        }
        other => bail!(
            "effect-capability-unsupported: 内核 {other}（{}）没有 CPU reference 实现",
            manifest.qualified()
        ),
    }
    Ok(out)
}

/// Dual-input mask (`mask.image@1` / `mask.luma@1`).
pub fn apply_image_mask(
    effect: &EffectRef,
    uniforms: &UniformMap,
    input: &Pixmap,
    mask: &Pixmap,
) -> Result<Pixmap> {
    let manifest = lookup(&effect.id, effect.version).map_err(|error| anyhow!("{error}"))?;
    let uniforms = manifest
        .resolve_uniforms(uniforms)
        .map_err(|error| anyhow!("{error}"))?;
    let channel = match manifest.kernel.as_str() {
        "alpha-mask-from-pixmap" => MaskChannel::Alpha,
        "luma-mask-from-pixmap" => MaskChannel::Luminance,
        other => bail!("effect-capability-unsupported: 内核 {other} 不是图像遮罩"),
    };
    let mut out = input.clone();
    // The mask is read-only. `out` and `mask` are two different Pixmaps, so the borrows do not conflict. There is no reason to copy the whole mask just to get past the borrow checker.
    filters::mask_image::image_mask(
        out.data_mut(),
        mask.data(),
        channel,
        uniforms.bool("invert").unwrap_or(false),
    )?;
    Ok(out)
}
