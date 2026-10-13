//! Frame-by-frame direct drawing of the template-layer document (the top-level `template` of `timeline.json`, design prototype round 112 §14.5).
//!
//! One document is used in three places: the template chrome on the stage, the foreground layer for export, and the thumbnails in the catalogue, brand library and wizard. All three draw through this same function ([`raster`]). Thumbnails do not paint a separate "colour-block sketch"; this follows the discipline of the prototype `template-render.jsx` word for word.
//!
//! There is **no I/O** here. The chapter table, the project title and the logo images are all loaded by the host into a [`TemplateScene`] and passed in, so the `wasm-safe` and `host` features share one implementation and no stubs remain.
//!
//! All geometry is converted to percentages of the frame. A box `box{x,y,w,h}` is a percentage of the frame, and the font size `size` is a percentage of the **frame height** (minimum 7px). Colours come only from the document (the content colours drawn into the video frame).
//!
//! The `opacity` of a logo layer (0.05–1) is the opacity of the whole layer. When `tile` is true, the same logo is tiled 24 times inside the box and the whole tiling is tilted diagonally about the box centre and enlarged (prototype `.tpllogo--tile`). Once a watermark is merged into the template, these two parameters are the only difference between a "watermark" and a "logo" (ledger 2026-09-14-230340).

use std::collections::BTreeMap;
use std::sync::Arc;

use anyhow::{Context, Result};
use render_raster::TextEngine;
use render_raster::fonts::{GlyphRender, ShapedGlyph};
use timeline::template::{
    self as tpl, ChapterFill, ChapterSpan, LayerKind, LogoShape, LogoSrc, SegmentState,
    TemplateDoc, TextAlign,
};
use tiny_skia::{
    FillRule, FilterQuality, Paint, PathBuilder, Pixmap, PixmapPaint, PixmapRef, Rect, Transform,
};

use crate::{
    SubtitleColor, draw_fit_pixmap_at, fill_round_rect, parse_css_color, rounded_rect_path,
};

/// The monospace family fixed for the `mono` text layer (the `VKCode-*.ttf` embedded in Studio). It ignores the template's `font`.
pub const MONO_FAMILY: &str = "VK Code";

/// A renderable template scene: the layer document plus the project-side facts it references.
///
/// `fingerprint` covers the document, the chapters, the title and the logo pixels. If any of them changes, the frame identity of the render plan changes too, and the App's thumbnail cache also keys on it.
#[derive(Clone)]
pub struct TemplateScene {
    pub doc: TemplateDoc,
    /// Chapters on the output timeline clock (chapters that were cut entirely are no longer in it).
    pub chapters: Vec<ChapterSpan>,
    /// The `{title}` variable: the `title` in project.json.
    pub title: String,
    /// Decoded logo images. The key is described at [`TemplateScene::logo_key`].
    pub logos: BTreeMap<String, Arc<Pixmap>>,
    pub fingerprint: u64,
}

impl TemplateScene {
    /// Assembles the scene and computes the content fingerprint. Logos are passed in as `(key, decoded Pixmap)`. Decoding needs `image`/`resvg`, which is the host's job; the rendering layer does not touch the byte-to-pixel conversion.
    pub fn new(
        doc: TemplateDoc,
        chapters: Vec<ChapterSpan>,
        title: impl Into<String>,
        logos: Vec<(String, Pixmap)>,
    ) -> Self {
        let title = title.into();
        let mut identity = serde_json::to_vec(&doc).unwrap_or_default();
        for chapter in &chapters {
            identity.extend_from_slice(chapter.id.as_bytes());
            identity.push(0);
            identity.extend_from_slice(chapter.title.as_bytes());
            identity.push(0);
            identity.extend_from_slice(&chapter.start.to_le_bytes());
            identity.extend_from_slice(&chapter.end.to_le_bytes());
        }
        identity.push(0);
        identity.extend_from_slice(title.as_bytes());
        let mut map = BTreeMap::new();
        for (key, pixmap) in logos {
            identity.push(0);
            identity.extend_from_slice(key.as_bytes());
            identity
                .extend_from_slice(&render_raster::drawop::fnv1a64(pixmap.data()).to_le_bytes());
            map.insert(key, Arc::new(pixmap));
        }
        let fingerprint = render_raster::drawop::fnv1a64(&identity);
        Self {
            doc,
            chapters,
            title,
            logos: map,
            fingerprint,
        }
    }

    /// The key of an image logo in [`Self::logos`]: a project-internal file uses its relative path, and a brand logo uses its id. Text logos have no key.
    pub fn logo_key(src: &LogoSrc) -> Option<&str> {
        match src {
            LogoSrc::Text(_) => None,
            LogoSrc::BrandLogo { brand_logo } => Some(brand_logo),
            LogoSrc::File { file } => Some(file),
        }
    }
}

/// Drawing parameters for one frame.
#[derive(Debug, Clone, Copy)]
pub struct FrameParams<'a> {
    /// The playhead (on the output timeline clock).
    pub time: f64,
    /// The total output length.
    pub duration: f64,
    pub width: u32,
    pub height: u32,
    /// The family used when the template gives no `font`, or the named family is not in the font engine (usually the subtitle style's font).
    pub fallback_family: &'a str,
}

/// Draws the whole template onto a transparent, premultiplied RGBA Pixmap of the same size as the canvas.
///
/// Layers are drawn in array order (later ones on top), and layers that are off are not drawn. When `editing_dim` is true, layers that are off are drawn at 0.35 opacity (the layout editor's "click to restore"). The stage and export always pass `false`.
pub fn raster(
    scene: &TemplateScene,
    params: FrameParams<'_>,
    text: &mut TextEngine,
    editing_dim: bool,
) -> Result<Pixmap> {
    let mut pixmap =
        Pixmap::new(params.width.max(1), params.height.max(1)).context("failed to allocate canvas for template layer")?;
    let family = resolve_family(&scene.doc, params.fallback_family, text);
    let fw = f64::from(params.width);
    let fh = f64::from(params.height);
    let segs = tpl::segments(&scene.chapters, params.time, params.duration);
    let vars = tpl::vars(
        &scene.chapters,
        params.time,
        params.duration,
        &[("title", scene.title.as_str())],
    );
    let pct = tpl::progress(params.time, params.duration);
    for layer in &scene.doc.layers {
        // Layers that are on use their own whole-layer opacity (the logo layer's `opacity`, all others always 1). Layers that are off are drawn at 0.35 only in editing mode (prototype `opacity: !l.on ? 0.35 : layerOpacity(l)`; the two are not multiplied).
        let opacity = if layer.on {
            layer.kind.opacity()
        } else if editing_dim {
            0.35
        } else {
            continue;
        };
        let rect = LayerRect {
            x: fw * layer.rect.x / 100.0,
            y: fh * layer.rect.y / 100.0,
            w: (fw * layer.rect.w / 100.0).max(1.0),
            h: (fh * layer.rect.h / 100.0).max(1.0),
        };
        let ctx = PaintCtx {
            fh,
            family: &family,
            segs: &segs,
            vars: &vars,
            pct,
            logos: &scene.logos,
        };
        if layer.kind.tiled() {
            // Tiling, enlarging and tilting diagonally routinely spills out of the box, and only the frame crops it. So the offscreen buffer is frame-sized.
            let mut local =
                Pixmap::new(pixmap.width(), pixmap.height()).context("failed to allocate buffer for template layer")?;
            paint_tile(&mut local, &rect, &layer.kind, &ctx, text);
            pixmap.draw_pixmap(
                0,
                0,
                local.as_ref(),
                &PixmapPaint {
                    opacity: opacity as f32,
                    quality: FilterQuality::Nearest,
                    ..Default::default()
                },
                Transform::identity(),
                None,
            );
            continue;
        }
        // Each layer is first drawn into its own offscreen box and then composited back. `overflow: hidden` and the whole-layer opacity are both realised in this step.
        let mut local = Pixmap::new(rect.w.ceil() as u32, rect.h.ceil() as u32)
            .context("failed to allocate buffer for template layer")?;
        paint_layer(&mut local, &layer.kind, &ctx, text);
        pixmap.draw_pixmap(
            0,
            0,
            local.as_ref(),
            &PixmapPaint {
                opacity: opacity as f32,
                quality: FilterQuality::Nearest,
                ..Default::default()
            },
            Transform::from_translate(rect.x as f32, rect.y as f32),
            None,
        );
    }
    Ok(pixmap)
}

/// The family for template text: if `doc.font` exists and the engine recognises it, it is used; otherwise the family supplied by the caller is used.
///
/// A missing family neither reports an error nor panics. The template may have come from another machine or brand library, and a font missing locally is normal. Falling back to the subtitle font is better than the whole layer disappearing.
pub fn resolve_family(doc: &TemplateDoc, fallback: &str, text: &TextEngine) -> String {
    doc.font
        .as_deref()
        .map(str::trim)
        .filter(|family| !family.is_empty() && text.has_family(family))
        .unwrap_or(fallback)
        .to_owned()
}

struct LayerRect {
    x: f64,
    y: f64,
    w: f64,
    h: f64,
}

struct PaintCtx<'a> {
    fh: f64,
    family: &'a str,
    segs: &'a [tpl::Segment],
    vars: &'a BTreeMap<String, String>,
    pct: f64,
    logos: &'a BTreeMap<String, Arc<Pixmap>>,
}

/// Font size: a percentage of the frame height, minimum 7px (prototype `px()`).
fn font_px(size: f64, fh: f64) -> f64 {
    (size / 100.0 * fh).max(7.0)
}

/// Left and right text padding: if the layer sets `pad` (a percentage of the frame height, without the 7px floor that the font size has), it is used. Otherwise it is the em count derived from this layer's font size (prototype `.tpltxt` 0.5em, `.tpllogo--badge` 0.6em).
fn pad_px(pad: Option<f64>, fh: f64, fallback: f64) -> f64 {
    pad.map_or(fallback, |p| p / 100.0 * fh)
}

fn color(raw: &str) -> SubtitleColor {
    parse_css_color(raw).unwrap_or(SubtitleColor::WHITE)
}

fn fill_rect(pixmap: &mut Pixmap, x: f64, y: f64, w: f64, h: f64, color: SubtitleColor) {
    fill_round_rect(pixmap, x, y, w, h, 0.0, color, 1.0, Transform::identity());
}

fn paint_layer(pixmap: &mut Pixmap, kind: &LayerKind, ctx: &PaintCtx<'_>, text: &mut TextEngine) {
    let w = f64::from(pixmap.width());
    let h = f64::from(pixmap.height());
    match kind {
        LayerKind::Chapters {
            fill,
            bg,
            color: fg,
            accent,
            color_done,
            divider,
            size,
        } => {
            fill_rect(pixmap, 0.0, 0.0, w, h, color(bg));
            let px = font_px(*size, ctx.fh);
            let bar_h = (h * 0.14).max(2.0);
            let total: f64 = ctx.segs.iter().map(|s| s.span).sum::<f64>().max(0.001);
            let accent = color(accent);
            let fg = color(fg);
            let done_color = color_done.as_deref().map_or(fg, color);
            let mut cursor = 0.0;
            for (index, seg) in ctx.segs.iter().enumerate() {
                let seg_w = w * seg.span / total;
                // dim: segments already played are filled entirely with the accent; the segment currently playing fills from the left according to its own progress.
                if *fill == ChapterFill::Dim {
                    let filled = match seg.state {
                        SegmentState::Done => seg_w,
                        SegmentState::On => seg_w * seg.done,
                        SegmentState::Todo => 0.0,
                    };
                    if filled > 0.0 {
                        fill_rect(pixmap, cursor, 0.0, filled, h, accent);
                    }
                }
                if *divider && index > 0 {
                    fill_rect(pixmap, cursor, 0.0, 1.0, h, fg);
                }
                let (title_color, weight) = match seg.state {
                    SegmentState::Todo => (fg, 700),
                    SegmentState::On => (done_color, 800),
                    SegmentState::Done => (done_color, 700),
                };
                let pad = px * 0.6;
                draw_text_in_box(
                    pixmap,
                    text,
                    &seg.title,
                    ctx.family,
                    px,
                    weight,
                    title_color,
                    (cursor + pad, 0.0, (seg_w - pad * 2.0).max(0.0), h),
                    TextAlign::Left,
                );
                if *fill == ChapterFill::Bar && seg.done > 0.0 {
                    fill_rect(pixmap, cursor, h - bar_h, seg_w * seg.done, bar_h, accent);
                }
                cursor += seg_w;
            }
        }
        LayerKind::Progress { accent, track } => {
            let radius = h / 2.0;
            fill_round_rect(
                pixmap,
                0.0,
                0.0,
                w,
                h,
                radius,
                color(track),
                1.0,
                Transform::identity(),
            );
            let filled = w * ctx.pct;
            if filled > 0.0 {
                // Consistent with the prototype: the outer `border-radius: 999px` clips both ends of the fill bar.
                let mut mask = Pixmap::new(pixmap.width(), pixmap.height());
                if let Some(mask) = mask.as_mut() {
                    fill_rect(mask, 0.0, 0.0, filled, h, color(accent));
                    clip_round(mask, radius);
                    pixmap.draw_pixmap(
                        0,
                        0,
                        mask.as_ref(),
                        &PixmapPaint::default(),
                        Transform::identity(),
                        None,
                    );
                }
            }
        }
        LayerKind::Logo {
            src,
            text: label,
            bg,
            color: fg,
            shape,
            size,
            align,
            pad,
            ..
        } => {
            if let Some(key) = TemplateScene::logo_key(src) {
                match ctx.logos.get(key) {
                    Some(image) => {
                        let mut local = Pixmap::new(pixmap.width(), pixmap.height());
                        if let Some(local) = local.as_mut() {
                            // Fit proportionally into the box. The horizontal slack is split by `align`: left-aligned sticks to the left edge, right-aligned sticks to the right edge.
                            let anchor = match align {
                                TextAlign::Left => 0.0,
                                TextAlign::Center => 0.5,
                                TextAlign::Right => 1.0,
                            };
                            draw_fit_pixmap_at(
                                local,
                                image,
                                timeline::schema::Fit::Contain,
                                1.0,
                                anchor,
                            );
                            pixmap.draw_pixmap(
                                0,
                                0,
                                local.as_ref(),
                                &PixmapPaint::default(),
                                Transform::identity(),
                                None,
                            );
                        }
                    }
                    // Image not found: draw a background-colour placeholder (prototype `background: l.bg`), so the layer does not disappear entirely.
                    None => {
                        if let Some(bg) = bg {
                            fill_round_rect(
                                pixmap,
                                0.0,
                                0.0,
                                w,
                                h,
                                6.0,
                                color(bg),
                                1.0,
                                Transform::identity(),
                            );
                        }
                    }
                }
                return;
            }
            let px = font_px(*size, ctx.fh);
            let badge = *shape == LogoShape::Badge;
            if let Some(bg) = bg {
                let radius = if badge { px * 0.3 } else { 0.0 };
                fill_round_rect(
                    pixmap,
                    0.0,
                    0.0,
                    w,
                    h,
                    radius,
                    color(bg),
                    1.0,
                    Transform::identity(),
                );
            }
            let pad = pad_px(*pad, ctx.fh, if badge { px * 0.6 } else { 0.0 });
            draw_text_in_box(
                pixmap,
                text,
                label,
                ctx.family,
                px,
                800,
                color(fg),
                (pad, 0.0, (w - pad * 2.0).max(0.0), h),
                *align,
            );
        }
        LayerKind::Text {
            text: template,
            color: fg,
            bg,
            align,
            size,
            pad,
            mono,
            weight,
        } => {
            if let Some(bg) = bg {
                fill_rect(pixmap, 0.0, 0.0, w, h, color(bg));
            }
            let px = font_px(*size, ctx.fh);
            let family = if *mono { MONO_FAMILY } else { ctx.family };
            let pad = pad_px(*pad, ctx.fh, px * 0.5);
            draw_text_in_box(
                pixmap,
                text,
                &tpl::fill(template, ctx.vars),
                family,
                px,
                *weight,
                color(fg),
                (pad, 0.0, (w - pad * 2.0).max(0.0), h),
                *align,
            );
        }
    }
}

/// The number of tiles laid out for a tiled logo is fixed and unrelated to the box size. The smaller the box, the more crowded it is (prototype `Array.from({length: 24})`).
pub(crate) const TILE_UNITS: usize = 24;
/// The rotation of the whole tiling about the box centre (degrees; negative = counter-clockwise) and the magnification (`rotate(-16deg) scale(1.35)`).
const TILE_ROTATE_DEG: f32 = -16.0;
const TILE_SCALE: f32 = 1.35;

/// Tiled logo (watermark): the same logo is tiled into the box in CSS flex-wrap fashion, clipped inside the box, and then the whole thing is tilted diagonally about the box centre and enlarged.
///
/// Text cell: weight 800, letter spacing 0.04em. Image cell: 3.2em × 1.6em, and the image fits into the cell with `contain`. If the brand library does not have this image, a background-colour placeholder with 0.3em rounded corners is drawn (the same convention as the non-tiled case).
fn paint_tile(
    frame: &mut Pixmap,
    rect: &LayerRect,
    kind: &LayerKind,
    ctx: &PaintCtx<'_>,
    text: &mut TextEngine,
) {
    let LayerKind::Logo {
        src,
        text: label,
        bg,
        color: fg,
        size,
        ..
    } = kind
    else {
        return;
    };
    let em = font_px(*size, ctx.fh);
    // Box-local pixels → frame: first enlarge about the box centre, then rotate (`transform-origin: 50% 50%`).
    let transform = Transform::from_translate(-(rect.w / 2.0) as f32, -(rect.h / 2.0) as f32)
        .post_scale(TILE_SCALE, TILE_SCALE)
        .post_rotate(TILE_ROTATE_DEG)
        .post_translate(
            (rect.x + rect.w / 2.0) as f32,
            (rect.y + rect.h / 2.0) as f32,
        );
    if let Some(key) = TemplateScene::logo_key(src) {
        let (unit_w, unit_h) = (3.2 * em, 1.6 * em);
        let image = ctx.logos.get(key);
        for (x, y) in tile_positions(rect.w, rect.h, em, unit_w, unit_h, TILE_UNITS) {
            match image {
                Some(image) => {
                    let iw = f64::from(image.width().max(1));
                    let ih = f64::from(image.height().max(1));
                    let scale = (unit_w / iw).min(unit_h / ih);
                    let placement = Transform::from_scale(scale as f32, scale as f32)
                        .post_translate(
                            (x + (unit_w - iw * scale) / 2.0) as f32,
                            (y + (unit_h - ih * scale) / 2.0) as f32,
                        )
                        .post_concat(transform);
                    frame.draw_pixmap(
                        0,
                        0,
                        (**image).as_ref(),
                        &PixmapPaint {
                            quality: FilterQuality::Bilinear,
                            ..Default::default()
                        },
                        placement,
                        None,
                    );
                }
                None => {
                    if let Some(bg) = bg {
                        fill_round_rect(
                            frame,
                            x,
                            y,
                            unit_w,
                            unit_h,
                            em * 0.3,
                            color(bg),
                            1.0,
                            transform,
                        );
                    }
                }
            }
        }
    } else {
        if label.trim().is_empty() {
            return;
        }
        let shaped = text.shape(label, ctx.family, em, 800);
        // CSS `letter-spacing` is added after every character, including the last one, so the cell width grows accordingly.
        let spacing = em * 0.04;
        let unit_w = shaped.width + label.chars().count() as f64 * spacing;
        let unit_h = shaped.ascent + shaped.descent;
        let offsets: Vec<f64> = shaped
            .glyphs
            .iter()
            .map(|glyph| {
                label
                    .get(..glyph.cluster.start)
                    .map_or(0, |head| head.chars().count()) as f64
                    * spacing
            })
            .collect();
        let fill = color(fg);
        let paint = glyph_paint(fill);
        for (x, y) in tile_positions(rect.w, rect.h, em, unit_w, unit_h, TILE_UNITS) {
            for (glyph, offset) in shaped.glyphs.iter().zip(&offsets) {
                let origin = Transform::from_translate(
                    (x + glyph.x + offset) as f32,
                    (y + shaped.ascent + glyph.y) as f32,
                )
                .post_concat(transform);
                paint_glyph(frame, text, glyph, origin, &paint, fill);
            }
        }
    }
    // `.tpllogo { overflow: hidden }` clips against the box before the transform. The clipping region is the box that tilts and enlarges together with the layer.
    let Some(bounds) = Rect::from_xywh(0.0, 0.0, rect.w as f32, rect.h as f32) else {
        return;
    };
    let Some(mut mask) = tiny_skia::Mask::new(frame.width(), frame.height()) else {
        return;
    };
    mask.fill_path(
        &PathBuilder::from_rect(bounds),
        FillRule::Winding,
        true,
        transform,
    );
    frame.apply_mask(&mask);
}

/// The top-left corner of a tile cell inside the box (box-local pixels), arranged per the prototype's flex wrapping: `padding: 1em`, `gap: 1.6em 2.4em`, with both the in-line `justify-content` and the between-line `align-content` set to `space-around`. When the remaining space is negative, both fall back to `safe center`, meaning the overflow runs from the start edge onward. This is CSS Box Alignment's fallback value. Chromium measurements show that when the tile box holds 24 rows, or when a thumbnail cell is narrower than the content area with a single tile, the first tile lands at `padding`, not centred.
pub(crate) fn tile_positions(
    box_w: f64,
    box_h: f64,
    em: f64,
    unit_w: f64,
    unit_h: f64,
    count: usize,
) -> Vec<(f64, f64)> {
    if count == 0 {
        return Vec::new();
    }
    let pad = em;
    let (row_gap, col_gap) = (em * 1.6, em * 2.4);
    let content_w = (box_w - pad * 2.0).max(0.0);
    let content_h = (box_h - pad * 2.0).max(0.0);
    // Greedy wrapping of equal-width cells: n cells fit on one line ⇔ n·w + (n−1)·gap ≤ content width. At least one cell per line.
    let per_line = ((content_w + col_gap) / (unit_w + col_gap) + 1e-9).floor();
    let per_line = (per_line.max(1.0) as usize).min(count);
    let lines = count.div_ceil(per_line);
    let (top, row_step) = space_around(content_h, lines, unit_h, row_gap);
    let mut out = Vec::with_capacity(count);
    for line in 0..lines {
        let n = per_line.min(count - line * per_line);
        let (left, col_step) = space_around(content_w, n, unit_w, col_gap);
        let y = pad + top + line as f64 * row_step;
        out.extend((0..n).map(|i| (pad + left + i as f64 * col_step, y)));
    }
    out
}

/// `space-around` arranges `n` equal-length items along one axis, with a fixed `gap` between items as well. Returns the first item's offset and the step. When they do not fit, they stick to the start per `safe center`, and the overflow runs only onward.
fn space_around(avail: f64, n: usize, size: f64, gap: f64) -> (f64, f64) {
    let n_f = n.max(1) as f64;
    let free = avail - n_f * size - (n_f - 1.0) * gap;
    if free > 0.0 {
        (free / (2.0 * n_f), size + gap + free / n_f)
    } else {
        (0.0, size + gap)
    }
}

/// Keeps only the pixels inside the rounded-capsule range (the progress line's `overflow: hidden; border-radius: 999px`).
fn clip_round(pixmap: &mut Pixmap, radius: f64) {
    let w = pixmap.width() as f32;
    let h = pixmap.height() as f32;
    let Some(rect) = Rect::from_xywh(0.0, 0.0, w, h) else {
        return;
    };
    let Some(mut mask) = tiny_skia::Mask::new(pixmap.width(), pixmap.height()) else {
        return;
    };
    let path = rounded_rect_path(0.0, 0.0, f64::from(w), f64::from(h), radius)
        .unwrap_or_else(|| PathBuilder::from_rect(rect));
    mask.fill_path(&path, FillRule::Winding, true, Transform::identity());
    pixmap.apply_mask(&mask);
}

/// A single line of text fitted into the box: vertically centred, horizontally aligned per `align`, and truncated by glyph at the right edge on overflow (prototype `white-space: nowrap; overflow: hidden`).
#[allow(clippy::too_many_arguments)]
fn draw_text_in_box(
    pixmap: &mut Pixmap,
    text: &mut TextEngine,
    content: &str,
    family: &str,
    size: f64,
    weight: u16,
    fill: SubtitleColor,
    (bx, by, bw, bh): (f64, f64, f64, f64),
    align: TextAlign,
) {
    if content.trim().is_empty() || bw <= 0.0 {
        return;
    }
    let shaped = text.shape(content, family, size, weight);
    let x0 = match align {
        TextAlign::Left => bx,
        TextAlign::Center => bx + (bw - shaped.width) / 2.0,
        TextAlign::Right => bx + bw - shaped.width,
    }
    .max(bx);
    let baseline = by + (bh - (shaped.ascent + shaped.descent)) / 2.0 + shaped.ascent;
    let limit = bx + bw;
    let paint = glyph_paint(fill);
    for glyph in &shaped.glyphs {
        // Glyphs that extend past the right edge of the box are not drawn at all (text truncation).
        if x0 + glyph.x >= limit {
            break;
        }
        let origin = Transform::from_translate((x0 + glyph.x) as f32, (baseline + glyph.y) as f32);
        paint_glyph(pixmap, text, glyph, origin, &paint, fill);
    }
}

fn glyph_paint(fill: SubtitleColor) -> Paint<'static> {
    let mut paint = Paint::default();
    paint.set_color_rgba8(fill.r, fill.g, fill.b, 255 - fill.a);
    paint.anti_alias = true;
    paint
}

/// Draws one glyph at `origin` (the glyph origin is the baseline start point, already including the caller's overall transform).
fn paint_glyph(
    pixmap: &mut Pixmap,
    text: &mut TextEngine,
    glyph: &ShapedGlyph,
    origin: Transform,
    paint: &Paint<'_>,
    fill: SubtitleColor,
) {
    match text.glyph_render(glyph.cache_key) {
        GlyphRender::Outline(path) => {
            pixmap.fill_path(&path, paint, FillRule::Winding, origin, None);
        }
        GlyphRender::ColorBitmap {
            width,
            height,
            rgba,
            left,
            top,
        } => {
            let Some(bitmap) = PixmapRef::from_bytes(&rgba, width, height) else {
                return;
            };
            let placement = Transform::from_translate(left as f32, -top as f32).post_concat(origin);
            pixmap.draw_pixmap(
                0,
                0,
                bitmap,
                &PixmapPaint {
                    opacity: f32::from(255 - fill.a) / 255.0,
                    quality: FilterQuality::Bilinear,
                    ..Default::default()
                },
                placement,
                None,
            );
        }
        GlyphRender::Empty => {}
    }
}

/// The template input held by a host with no filesystem (a browser wasm): the layer document plus chapters, title and logo pixels.
///
/// The host takes the chapters and title from the document it already holds. It fetches the logo image bytes per [`Self::logo_keys`], decodes them with the platform decoder into straight-alpha RGBA, and passes them in one by one. This function only does premultiplication and assembly. The scene rules are still the single set in [`TemplateScene::new`], the same structure that `ccut-workspace::template_scene_for` feeds to export.
#[derive(Clone)]
pub struct TemplateSource {
    doc: TemplateDoc,
    chapters: Vec<ChapterSpan>,
    title: String,
    logos: BTreeMap<String, Pixmap>,
}

impl TemplateSource {
    /// `doc` is the `template` of `timeline.json`. `chapters` are `[{id, title, start, end}]` on the output clock; a chapter missing its time or with zero length is dropped directly, consistent with the chapter projection's convention.
    pub fn from_json(doc: &str, chapters: &str, title: &str) -> Result<Self> {
        let doc: TemplateDoc = serde_json::from_str(doc).context("parse template document")?;
        let list: serde_json::Value = serde_json::from_str(chapters).context("parse chapter table")?;
        let text = |item: &serde_json::Value, key: &str| {
            item.get(key)
                .and_then(serde_json::Value::as_str)
                .unwrap_or_default()
                .to_owned()
        };
        let chapters = list
            .as_array()
            .map(|items| {
                items
                    .iter()
                    .filter_map(|item| {
                        let start = item.get("start")?.as_f64()?;
                        let end = item.get("end")?.as_f64()?;
                        (end > start).then(|| ChapterSpan {
                            id: text(item, "id"),
                            title: text(item, "title"),
                            start,
                            end,
                        })
                    })
                    .collect()
            })
            .unwrap_or_default();
        Ok(Self {
            doc,
            chapters,
            title: title.to_owned(),
            logos: BTreeMap::new(),
        })
    }

    /// The keys of the image logos in the document (de-duplicated, in layer order). The host uses these to fetch the images.
    pub fn logo_keys(&self) -> Vec<String> {
        let mut keys: Vec<String> = Vec::new();
        for layer in &self.doc.layers {
            let LayerKind::Logo { src, .. } = &layer.kind else {
                continue;
            };
            if let Some(key) = TemplateScene::logo_key(src)
                && !keys.iter().any(|known| known == key)
            {
                keys.push(key.to_owned());
            }
        }
        keys
    }

    /// Installs one logo. `rgba` is straight-alpha (the form returned by the browser's `getImageData`), and it is premultiplied here.
    pub fn set_logo_rgba(
        &mut self,
        key: &str,
        width: u32,
        height: u32,
        rgba: Vec<u8>,
    ) -> Result<()> {
        let size = tiny_skia::IntSize::from_wh(width, height).context("logo size must be greater than zero")?;
        if rgba.len() != width as usize * height as usize * 4 {
            anyhow::bail!("logo {key}: RGBA length does not match {width}×{height}");
        }
        let mut rgba = rgba;
        for pixel in rgba.chunks_exact_mut(4) {
            let alpha = u16::from(pixel[3]);
            if alpha < 255 {
                for channel in &mut pixel[..3] {
                    *channel = ((u16::from(*channel) * alpha + 127) / 255) as u8;
                }
            }
        }
        let pixmap = Pixmap::from_vec(rgba, size).context("logo RGBA buffer is invalid")?;
        self.logos.insert(key.to_owned(), pixmap);
        Ok(())
    }

    /// Assembles the current scene. Any logo cells that are missing are drawn as text logos, the same fallback used when export cannot read the brand logo.
    pub fn scene(&self) -> TemplateScene {
        TemplateScene::new(
            self.doc.clone(),
            self.chapters.clone(),
            self.title.clone(),
            self.logos
                .iter()
                .map(|(key, pixmap)| (key.clone(), pixmap.clone()))
                .collect(),
        )
    }
}
