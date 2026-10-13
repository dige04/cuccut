//! Frame rasterizer (architecture design §9.3, §13.1): given the frame plan (`render-graph`), it hands each layer to the ported CPU rendering kernel and draws one RGBA frame.
//!
//! This is the single implementation of pixels: native export links it directly, and the editor preview uses the same one through `bindings/preview-wasm`. The plan gives the layers, their order, timing and transitions;
//! each layer's pixels are drawn from the instance's own fields: geometry, keyframes, element animation, masks, tiling, text styles and graphics, and generated elements are all drawn by the element pipeline of `subtitle-render` ([`element`] converts v3 instances into its elements). The color grading and blur of `fx` are applied first to the source picture, while stroke and shadow are applied to the finished layer ([`effects`], the fixed order of format spec §3.9); transitions are drawn on the layers within the instance's own box ([`transition`]);
//! captions are laid out by the same kernel according to the style document ([`captions`]); template layers are drawn from the template document in `timeline` ([`template`]).
//!
//! The caller supplies the picture sources through [`LayerMedia`] (on export, the `media-core` decoders; in preview, frames decoded by the UI), and the caller injects fonts ([`bundled_fonts`] is the set shipped with the kernel). Anything that cannot be drawn is judged uniformly by [`support`]: preflight lists it, and composition either reports an error or skips it depending on options, and never draws a blank.

pub mod caption_words;
pub mod captions;
pub mod census;
pub mod documents;
pub mod effects;
pub mod element;
pub mod renderer;
pub mod spectrum;
pub mod support;
pub mod template;
pub mod text_measure;
pub mod transition;

pub use census::{FALLBACK_FAMILY, FontUsage, font_census, font_usage};
pub use documents::{Documents, FrozenDocument};
pub use render_raster::fonts::FaceUse;
pub use renderer::{FrameRenderer, GIF_MEDIA_TYPE, LayerMedia, RenderError, RenderOptions, RenderWarning, SVG_MEDIA_TYPE};
pub use spectrum::SpeakerActivity;
pub use support::UnsupportedItem;
pub use text_measure::TextBox;

use tiny_skia::{IntSize, Pixmap};

/// Converts non-premultiplied RGBA bytes to a premultiplied picture (opaque pixels unchanged).
pub fn premultiplied(width: u32, height: u32, mut data: Vec<u8>) -> Option<Pixmap> {
    for px in data.chunks_exact_mut(4) {
        let a = px[3] as u32;
        if a < 255 {
            for c in &mut px[..3] {
                *c = ((*c as u32 * a + 127) / 255) as u8;
            }
        }
    }
    Pixmap::from_vec(data, IntSize::from_wh(width, height)?)
}

/// Restores premultiplied RGBA to non-premultiplied (the UI's ImageData needs non-premultiplied data).
pub fn demultiplied(data: &[u8]) -> Vec<u8> {
    let mut out = data.to_vec();
    for px in out.chunks_exact_mut(4) {
        let a = px[3] as u32;
        if a > 0 && a < 255 {
            for c in &mut px[..3] {
                *c = ((*c as u32 * 255 + a / 2) / a).min(255) as u8;
            }
        }
    }
    out
}

/// File names for [`bundled_fonts`] (under `crates/render-raster/assets/fonts`), in the same order. The preview build uses them to copy the fonts to the UI, and the UI reads them in this order and injects them (the first is the fallback font); byte-for-byte checked against the list in the kernel (this crate's tests).
pub const BUNDLED_FONT_FILES: &[&str] = &[
    "NotoSansSC-Variable.ttf",
    "Montserrat.ttf",
    "Arimo.ttf",
    "Poppins-Regular.ttf",
    "Poppins-Medium.ttf",
    "Poppins-SemiBold.ttf",
    "Poppins-ExtraBold.ttf",
    "Anton-Regular.ttf",
    "SquadaOne-Regular.ttf",
    "Shrikhand-Regular.ttf",
    "Rubik.ttf",
    "BebasNeue-Regular.ttf",
    "LexendDeca.ttf",
    "SourceSerif4.ttf",
    "Alata-Regular.ttf",
    "ArchivoBlack-Regular.ttf",
    "Bangers-Regular.ttf",
    "CarterOne-Regular.ttf",
    "DancingScript.ttf",
    "FredokaOne-Regular.ttf",
    "PaytoneOne-Regular.ttf",
    "PermanentMarker-Regular.ttf",
    "PressStart2P-Regular.ttf",
    "VKSans-400.ttf",
    "VKSans-500.ttf",
    "VKSans-600.ttf",
    "VKSans-700.ttf",
    "VKSans-800.ttf",
    "VKCode-400.ttf",
    "VKCode-500.ttf",
    "VKCode-600.ttf",
    "VKCode-700.ttf",
    "Inter-Medium.ttf",
    "Poppins-Black.ttf",
    "RobotoMono-Medium.ttf",
    "PlayfairDisplay-Italic.ttf",
    "Oswald-Bold.ttf",
    "PlayfairDisplay-Regular.ttf",
];

/// Fonts shipped with the kernel: Source Han Sans (the fallback for missing glyphs, listed first) plus the display fonts used by Studio captions and text styles, all in `render-raster/assets/fonts`; licenses are in `LICENSES` in the same directory. Export and preview inject the same set; the preview's WASM does not embed the fonts: the build copies the same files to the UI, which reads them and injects them.
#[cfg(feature = "host")]
pub fn bundled_fonts() -> Vec<Vec<u8>> {
    subtitle_render::bundled_studio_fonts()
}

/// Rasterizes an SVG image into a premultiplied picture at `long_edge` on its long side. For image layers, [`FrameRenderer`] rasterizes the SVG from the asset bytes at the output's long edge (the same for preview and export); the export preflight also uses it to check whether it can be decoded. `<text>` in SVG is not drawn (resvg on both sides has no fonts).
pub fn decode_svg(bytes: &[u8], long_edge: u32) -> anyhow::Result<Pixmap> {
    render_raster::svg::decode_svg_at_long_edge(bytes, long_edge)
}

/// Limit for GIF decoding: animated GIFs keep all frames resident (`render_raster::source::AnimatedImage`), and anything over the limit draws only its first frame. Preview and export use the same limit, so the same asset draws the same frame on both sides.
pub const GIF_BUDGET: render_raster::source::PrepareCtx = render_raster::source::PrepareCtx {
    max_frames: 2048,
    max_bytes: 128 << 20,
};

/// For a GIF that is read: one with more than one frame and a total duration greater than 0 is drawn as animation; the rest (single frame, every frame with zero dwell, or over [`GIF_BUDGET`]) draw the first frame.
pub enum Gif {
    Animated(render_raster::source::AnimatedImage),
    Still(std::sync::Arc<Pixmap>),
}

impl Gif {
    /// The size of the picture.
    pub fn size(&self) -> (u32, u32) {
        match self {
            Gif::Animated(animated) => (animated.metadata().width, animated.metadata().height),
            Gif::Still(still) => (still.width(), still.height()),
        }
    }

    /// The picture when `elapsed` seconds have passed in the instance (premultiplied RGBA). `mode` is the sticker's `loop` (format spec §3.7): `loop` takes the animation's total duration modulo, `once` stops at the last frame, and `hold` stops at the first frame; image instances use `loop`. The time is mapped to the GIF frame table in whole milliseconds.
    pub fn frame_at(&self, elapsed: f64, mode: &str) -> anyhow::Result<std::sync::Arc<Pixmap>> {
        use render_raster::source::{MediaTime, VisualSource};
        let animated = match self {
            Gif::Still(still) => return Ok(still.clone()),
            Gif::Animated(animated) => animated,
        };
        let total = animated.metadata().total_ms().max(1);
        let ms = if elapsed.is_finite() {
            (elapsed.max(0.0) * 1000.0).round() as i64
        } else {
            0
        };
        let at = match mode {
            timeline::schema::STICKER_LOOP_HOLD => 0,
            timeline::schema::STICKER_LOOP_ONCE => ms.min(total - 1),
            _ => ms.rem_euclid(total),
        };
        Ok(animated.sample(MediaTime::from_millis(at))?.pixmap)
    }
}

/// Reads a GIF asset (the same for preview and export; the export preflight also uses it to check whether it can be decoded). If the animation cannot be decoded, it falls back to decoding the first frame; the second return value is a notice for the user (when over [`GIF_BUDGET`]); it fails only if the first frame also cannot be decoded.
pub fn load_gif(label: &str, bytes: &[u8]) -> anyhow::Result<(Gif, Option<String>)> {
    match render_raster::source::AnimatedImage::decode(label, bytes, &GIF_BUDGET) {
        Ok(animated) if animated.frame_count() > 1 => Ok((Gif::Animated(animated), None)),
        Ok(animated) => {
            let first = animated.frame(0).ok_or_else(|| anyhow::anyhow!("{label}: GIF has no frames"))?;
            Ok((Gif::Still(first), None))
        }
        Err(error) => {
            let still = render_raster::source::animated_image::decode_first_frame(label, bytes)?;
            let note = error
                .is::<render_raster::source::animated_image::AnimatedImageBudgetExceeded>()
                .then(|| format!("GIF is too large; drawing only the first frame: {error:#}"));
            Ok((Gif::Still(std::sync::Arc::new(still)), note))
        }
    }
}

/// Reads a Lottie asset: parses it (JSON or a `.lottie` archive) and attaches the embedded or packaged image sub-assets (bitmaps and SVG). When `overrides` (the sticker's `fillOverrides`) is not empty, colors are replaced. External images that are referenced only by path and are not in the archive cannot be read. On failure, gives the skip reason (`lottie-asset-missing` or `lottie-unreadable`) and an explanation.
pub fn load_lottie(
    label: &str,
    bytes: &[u8],
    overrides: Option<&std::collections::BTreeMap<String, String>>,
) -> Result<render_raster::source::Lottie, (&'static str, String)> {
    let reason = |error: anyhow::Error| {
        let message = format!("{error:#}");
        let code = if message.contains("lottie-asset-missing") {
            "lottie-asset-missing"
        } else {
            "lottie-unreadable"
        };
        (code, message)
    };
    let mut lottie = render_raster::source::Lottie::parse(label, label, bytes).map_err(reason)?;
    lottie.attach_embedded_images().map_err(reason)?;
    if let Some(overrides) = overrides.filter(|o| !o.is_empty()) {
        lottie.apply_fill_overrides(overrides);
    }
    Ok(lottie)
}

/// Whether the bytes of a Lottie asset can be read: when not, gives the reason (used by preflight; read the same way as at composition).
pub fn lottie_problem(bytes: &[u8]) -> Option<(&'static str, String)> {
    load_lottie("lottie", bytes, None).err()
}

#[cfg(all(test, feature = "host"))]
mod tests {
    #[test]
    fn the_font_file_list_matches_the_bundled_fonts() {
        let dir = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../render-raster/assets/fonts");
        let files: Vec<Vec<u8>> = super::BUNDLED_FONT_FILES
            .iter()
            .map(|name| std::fs::read(dir.join(name)).unwrap())
            .collect();
        assert!(
            files == super::bundled_fonts(),
            "BUNDLED_FONT_FILES does not match the kernel's built-in font order or contents"
        );
    }
}
