//! DrawOp replay → tiny-skia Pixmap. The layer stack implements PushLayer/PopLayer (group opacity + blend mode), the clip stack implements ClipPath/PopClip, DrawMedia fetches pixels through MediaStore (images directly, videos decoded sequentially), and DrawBitmap takes the bitmap side table within the frame directly.

use crate::drawop::{DrawOp, FrameOps, MatteMode, PaintData, PathData, StaticPrefix};
#[cfg(feature = "media")]
use crate::media::MediaStore;
use crate::plan::blend_to_skia;
use anyhow::{Result, anyhow};
use std::cell::OnceCell;
use std::sync::{Arc, Mutex};

/// Raster cache for [`StaticPrefix`]: key `(key, width, height)` → the whole image after the prefix is painted. It is process-wide (shared by the export workers and the preview's frames), holds at most [`STATIC_PREFIX_ENTRIES`] images, and the most recently used one sits at the end. One 1080p image is 8.3 MB.
static STATIC_PREFIXES: Mutex<Vec<((u64, u32, u32), Arc<Pixmap>)>> = Mutex::new(Vec::new());
const STATIC_PREFIX_ENTRIES: usize = 2;

fn static_prefix_get(key: (u64, u32, u32)) -> Option<Arc<Pixmap>> {
    let mut entries = STATIC_PREFIXES
        .lock()
        .unwrap_or_else(|poison| poison.into_inner());
    let index = entries.iter().position(|(k, _)| *k == key)?;
    let entry = entries.remove(index);
    let hit = entry.1.clone();
    entries.push(entry);
    Some(hit)
}

fn static_prefix_put(key: (u64, u32, u32), pixmap: &Pixmap) {
    let mut entries = STATIC_PREFIXES
        .lock()
        .unwrap_or_else(|poison| poison.into_inner());
    if entries.iter().any(|(k, _)| *k == key) {
        return;
    }
    if entries.len() >= STATIC_PREFIX_ENTRIES {
        entries.remove(0);
    }
    entries.push((key, Arc::new(pixmap.clone())));
}

/// The path side table is materialized on demand. On a background-cache hit, the texture geometry inside the prefix (tens of thousands of grains) is never converted at all. `get` has the same shape as `Vec::get`, so call sites do not change.
struct LazyPaths<'a> {
    data: &'a [PathData],
    cells: Vec<OnceCell<Option<tiny_skia::Path>>>,
}

impl<'a> LazyPaths<'a> {
    fn new(data: &'a [PathData]) -> Self {
        LazyPaths {
            data,
            cells: (0..data.len()).map(|_| OnceCell::new()).collect(),
        }
    }

    fn get(&self, index: usize) -> Option<&Option<tiny_skia::Path>> {
        let data = self.data.get(index)?;
        Some(self.cells[index].get_or_init(|| to_skia_path(data)))
    }
}
use tiny_skia::{
    Color, FillRule, FilterQuality, GradientStop, LineCap, LineJoin, Mask, Paint, PathBuilder,
    Pixmap, PixmapPaint, PixmapRef, Point, RadialGradient, SpreadMode, Stroke, Transform,
};

/// One cell of the clip stack. `layer_depth` is the layer depth at push time. `PopClip` must complete within the same layer (spec §14.5); otherwise a clip set up inside a layer would leak onto draws outside it.
struct ClipEntry {
    mask: Mask,
    layer_depth: usize,
}

fn to_paint(c: &[f32; 4]) -> Paint<'static> {
    let mut p = Paint::default();
    p.set_color(to_color(c));
    p.anti_alias = true;
    p
}

/// Converts the source crop box, given in natural-size units, to the actual frame size. After rounding it still falls inside the frame (all zeros = the whole source).
fn scale_crop(src: &[f32; 4], fx: f32, fy: f32, width: u32, height: u32) -> [f32; 4] {
    if src[2] <= 0.0 || src[3] <= 0.0 {
        return *src;
    }
    let x = (src[0] * fx).round().clamp(0.0, width as f32 - 1.0);
    let y = (src[1] * fy).round().clamp(0.0, height as f32 - 1.0);
    let right = ((src[0] + src[2]) * fx)
        .round()
        .clamp(x + 1.0, width as f32);
    let bottom = ((src[1] + src[3]) * fy)
        .round()
        .clamp(y + 1.0, height as f32);
    [x, y, right - x, bottom - y]
}

fn to_tf(m: &[f32; 6]) -> Transform {
    Transform::from_row(m[0], m[1], m[2], m[3], m[4], m[5])
}

/// Shortcut for `out.draw_pixmap(0, 0, src, &PixmapPaint::default(), transform, None)` (opacity 1, src-over, no clip; for translations, tiny-skia uses nearest-neighbour sampling whatever filter is requested). It applies when `transform` is an integer translation (including identity) and the source pixels it covers are only opaque or fully zero. In that case src-over just copies the opaque pixels across and leaves the zero pixels alone. Scan first, then copy: if there is any semi-transparent pixel, nothing is changed and false is returned, and the caller proceeds with `draw_pixmap`. The two paths are byte-for-byte identical (`copy_over_tests` cross-checks against `draw_pixmap`).
///
/// A video frame is fully opaque, so a whole-frame video layer (in both preview and export) skips the per-pixel floating-point pipeline (the Pattern shader only has a highp implementation).
/// Fully zero rows are compared as whole rows against zero, so large transparent areas take almost no time.
pub fn copy_over(out: &mut Pixmap, src: PixmapRef, transform: Transform) -> bool {
    let Transform {
        sx,
        kx,
        ky,
        sy,
        tx,
        ty,
    } = transform;
    // The fract of NaN and infinity is NaN, which is not equal to 0.
    if sx != 1.0 || sy != 1.0 || kx != 0.0 || ky != 0.0 || tx.fract() != 0.0 || ty.fract() != 0.0 {
        return false;
    }
    let (dx, dy) = (tx as i64, ty as i64);
    let (src_w, src_h) = (i64::from(src.width()), i64::from(src.height()));
    let (out_w, out_h) = (i64::from(out.width()), i64::from(out.height()));
    let (x0, x1) = (dx.max(0), (dx + src_w).min(out_w));
    let (y0, y1) = (dy.max(0), (dy + src_h).min(out_h));
    if x0 >= x1 || y0 >= y1 {
        return false;
    }
    let src_data = src.data();
    let row_of = |y: i64| {
        let start = (((y - dy) * src_w + (x0 - dx)) * 4) as usize;
        &src_data[start..start + ((x1 - x0) * 4) as usize]
    };
    #[derive(Clone, Copy, PartialEq)]
    enum Row {
        Clear,
        Opaque,
        Mixed,
    }
    static ZEROS: [u8; 4096] = [0; 4096];
    let mut rows = Vec::with_capacity((y1 - y0) as usize);
    for y in y0..y1 {
        let row = row_of(y);
        if row
            .chunks(ZEROS.len())
            .all(|chunk| chunk == &ZEROS[..chunk.len()])
        {
            rows.push(Row::Clear);
            continue;
        }
        let mut opaque = true;
        for pixel in row.chunks_exact(4) {
            match pixel[3] {
                255 => {}
                // Only fully zero counts as transparent. An invalid premultiplied (r,g,b,0) would add onto whatever is underneath in src-over, so it is left to the pipeline.
                0 if pixel == [0, 0, 0, 0] => opaque = false,
                _ => return false,
            }
        }
        rows.push(if opaque { Row::Opaque } else { Row::Mixed });
    }
    let out_row_bytes = (out_w * 4) as usize;
    let out_data = out.data_mut();
    for (y, kind) in (y0..y1).zip(rows) {
        let row = row_of(y);
        let start = y as usize * out_row_bytes + (x0 * 4) as usize;
        let target = &mut out_data[start..start + row.len()];
        match kind {
            Row::Clear => {}
            Row::Opaque => target.copy_from_slice(row),
            Row::Mixed => {
                for (to, from) in target.chunks_exact_mut(4).zip(row.chunks_exact(4)) {
                    if from[3] == 255 {
                        to.copy_from_slice(from);
                    }
                }
            }
        }
    }
    true
}

fn to_color(c: &[f32; 4]) -> Color {
    Color::from_rgba(
        c[0].clamp(0.0, 1.0),
        c[1].clamp(0.0, 1.0),
        c[2].clamp(0.0, 1.0),
        c[3].clamp(0.0, 1.0),
    )
    .expect("color")
}

/// Converts a paint side-table entry to a tiny-skia `Paint`.
///
/// Gradient geometry lives **in the path's local coordinate system** (the same system as the op's `tf`), so the shader's `transform` is always identity. `fill_path` applies `tf` on top of it. Degenerate geometry (coincident start and end points, radius ≤ 0, or only one color stop) is folded into a solid color of the last stop. tiny-skia refuses to construct such shaders, and silently drawing nothing is harder to debug than drawing something wrong.
fn paint_from(data: &PaintData) -> Paint<'static> {
    let mut paint = Paint::default();
    paint.anti_alias = true;
    let stops = |src: &[crate::drawop::GradientStop]| -> Vec<GradientStop> {
        src.iter()
            .map(|s| GradientStop::new(s.offset.clamp(0.0, 1.0), to_color(&s.color)))
            .collect()
    };
    let fallback = |src: &[crate::drawop::GradientStop]| -> Color {
        src.last()
            .map(|s| to_color(&s.color))
            .unwrap_or(Color::TRANSPARENT)
    };
    match data {
        PaintData::Solid(color) => paint.set_color(to_color(color)),
        PaintData::Linear { p0, p1, stops: st } => {
            let shader = tiny_skia::LinearGradient::new(
                Point::from_xy(p0[0], p0[1]),
                Point::from_xy(p1[0], p1[1]),
                stops(st),
                SpreadMode::Pad,
                Transform::identity(),
            );
            match shader {
                Some(shader) => paint.shader = shader,
                None => paint.set_color(fallback(st)),
            }
        }
        PaintData::Radial {
            center,
            radius,
            focus,
            stops: st,
        } => {
            let shader = RadialGradient::new(
                Point::from_xy(focus[0], focus[1]),
                Point::from_xy(center[0], center[1]),
                radius.max(f32::MIN_POSITIVE),
                stops(st),
                SpreadMode::Pad,
                Transform::identity(),
            );
            match shader {
                Some(shader) => paint.shader = shader,
                None => paint.set_color(fallback(st)),
            }
        }
    }
    paint
}

fn to_cap(code: u8) -> LineCap {
    match code {
        0 => LineCap::Butt,
        2 => LineCap::Square,
        _ => LineCap::Round,
    }
}

fn to_join(code: u8) -> LineJoin {
    match code {
        0 => LineJoin::Miter,
        2 => LineJoin::Bevel,
        _ => LineJoin::Round,
    }
}

/// Folds a mask source layer into the alpha of the target layer (`PopMatte`).
///
/// Both images are **premultiplied** RGBA of the same size, so multiplying each pixel by a 0..1 factor is enough. In a premultiplied format, "multiply by alpha" means multiplying all four components together, with no need to un-premultiply and re-premultiply. The factor is computed in integers (0..=255 fixed point), to avoid floating-point rounding diverging across platforms.
pub(crate) fn apply_matte(target: &mut Pixmap, matte: &Pixmap, mode: MatteMode) {
    let src = matte.data();
    let dst = target.data_mut();
    for (t, m) in dst.chunks_exact_mut(4).zip(src.chunks_exact(4)) {
        let alpha = u32::from(m[3]);
        let factor = match mode {
            MatteMode::Alpha => alpha,
            MatteMode::AlphaInverted => 255 - alpha,
            // The luminance of a premultiplied pixel already includes its alpha weight (Rec.709 integer weights, summing to 65536)
            MatteMode::Luma | MatteMode::LumaInverted => {
                let luma =
                    (13933 * u32::from(m[0]) + 46871 * u32::from(m[1]) + 4732 * u32::from(m[2]))
                        >> 16;
                let luma = luma.min(255);
                if mode == MatteMode::Luma {
                    luma
                } else {
                    255 - luma
                }
            }
        };
        for channel in t.iter_mut() {
            *channel = ((u32::from(*channel) * factor + 127) / 255) as u8;
        }
    }
}

fn to_skia_path(p: &PathData) -> Option<tiny_skia::Path> {
    let mut pb = PathBuilder::new();
    for seg in &p.0 {
        let q = seg.pts;
        match seg.verb {
            0 => pb.move_to(q[0], q[1]),
            1 => pb.line_to(q[0], q[1]),
            2 => pb.quad_to(q[0], q[1], q[2], q[3]),
            3 => pb.cubic_to(q[0], q[1], q[2], q[3], q[4], q[5]),
            _ => pb.close(),
        }
    }
    pb.finish()
}

pub fn rounded_rect_path(x: f64, y: f64, w: f64, h: f64, radius: f64) -> Option<tiny_skia::Path> {
    let r = radius.min(w.min(h) / 2.0).max(0.0);
    let mut pb = PathBuilder::new();
    if r <= 0.0 {
        pb.push_rect(tiny_skia::Rect::from_xywh(
            x as f32, y as f32, w as f32, h as f32,
        )?);
        return pb.finish();
    }
    const K: f64 = 0.5522847498307936; // Rounded-corner cubic Bézier approximation
    let k = K * r;
    pb.move_to((x + r) as f32, y as f32);
    pb.line_to((x + w - r) as f32, y as f32);
    pb.cubic_to(
        (x + w - r + k) as f32,
        y as f32,
        (x + w) as f32,
        (y + r - k) as f32,
        (x + w) as f32,
        (y + r) as f32,
    );
    pb.line_to((x + w) as f32, (y + h - r) as f32);
    pb.cubic_to(
        (x + w) as f32,
        (y + h - r + k) as f32,
        (x + w - r + k) as f32,
        (y + h) as f32,
        (x + w - r) as f32,
        (y + h) as f32,
    );
    pb.line_to((x + r) as f32, (y + h) as f32);
    pb.cubic_to(
        (x + r - k) as f32,
        (y + h) as f32,
        x as f32,
        (y + h - r + k) as f32,
        x as f32,
        (y + h - r) as f32,
    );
    pb.line_to(x as f32, (y + r) as f32);
    pb.cubic_to(
        x as f32,
        (y + r - k) as f32,
        (x + r - k) as f32,
        y as f32,
        (x + r) as f32,
        y as f32,
    );
    pb.close();
    pb.finish()
}

/// DrawOp media lookup boundary. BCF rendering uses [`MediaStore`]; product
/// overlay rendering can add deterministic in-memory subtitle/text layers while
/// still replaying the exact same DrawOp stream.
pub trait FrameMedia {
    fn frame(&mut self, id: &str, media_ms: i64) -> Result<Arc<Pixmap>>;

    /// The natural size of a vector animated image that can be rasterized at any size (program, Lottie, animated SVG). Bitmaps, videos and unsupported implementations return `None` (the default).
    fn vector_natural_size(&self, _id: &str) -> Option<(u32, u32)> {
        None
    }

    /// Same as [`Self::frame`], but vector animated images are rasterized at the `target` device pixel size. Implementations that cannot do this keep the natural size (the default). The caller converts using the actual size returned, and does not assume it equals `target`.
    fn frame_for_target(
        &mut self,
        id: &str,
        media_ms: i64,
        _target: Option<(u32, u32)>,
    ) -> Result<Arc<Pixmap>> {
        self.frame(id, media_ms)
    }
}

#[cfg(feature = "media")]
impl FrameMedia for MediaStore {
    fn frame(&mut self, id: &str, media_ms: i64) -> Result<Arc<Pixmap>> {
        self.frame_for_target(id, media_ms, None)
    }

    fn vector_natural_size(&self, id: &str) -> Option<(u32, u32)> {
        MediaStore::vector_natural_size(self, id)
    }

    fn frame_for_target(
        &mut self,
        id: &str,
        media_ms: i64,
        target: Option<(u32, u32)>,
    ) -> Result<Arc<Pixmap>> {
        // media_ms < 0 is the marker convention for static images. When ≥ 0, the animated image is asked first (it is already fully resident as frames), and then it falls through to the video's sequential decoder.
        if media_ms < 0 {
            return self.image_frame(id);
        }
        match self.animated_frame_for_target(id, media_ms, target) {
            Some(frame) => frame,
            None => self.video_frame(id, media_ms as f64 / 1000.0),
        }
    }
}

/// Upper limits on a vector source's side length and area, so that however large the source is, allocation is never unbounded (the area of an 8K banner).
const MEDIA_TARGET_MAX_SIDE: f64 = 8192.0;
const MEDIA_TARGET_MAX_AREA: f64 = 7680.0 * 4320.0;

/// The device pixels a vector source of natural size `natural` actually occupies under `tf`. Returns `None` when this is less than one pixel different from the natural size: it is rasterized at natural size, and the result is byte-for-byte identical to before.
fn media_target(tf: &[f32; 6], (width, height): (u32, u32)) -> Option<(u32, u32)> {
    let w = f64::from(width) * f64::from(tf[0]).hypot(f64::from(tf[1]));
    let h = f64::from(height) * f64::from(tf[2]).hypot(f64::from(tf[3]));
    if !(w.is_finite() && h.is_finite()) || w < 0.5 || h < 0.5 {
        return None;
    }
    let (w, h) = (w.ceil(), h.ceil());
    if (w - f64::from(width)).abs() <= 1.0 && (h - f64::from(height)).abs() <= 1.0 {
        return None;
    }
    let fit = (MEDIA_TARGET_MAX_SIDE / w.max(h))
        .min((MEDIA_TARGET_MAX_AREA / (w * h)).sqrt())
        .min(1.0);
    Some((
        (w * fit).round().max(1.0) as u32,
        (h * fit).round().max(1.0) as u32,
    ))
}

#[cfg(feature = "media")]
pub fn rasterize(
    frame: &FrameOps,
    width: u32,
    height: u32,
    media: &mut MediaStore,
) -> Result<Pixmap> {
    rasterize_with_media(frame, width, height, media)
}

/// `?Sized`: `PassExecutor` is an object-safe trait, and the media entry point receives `&mut dyn FrameMedia`. That must be passed straight in here (otherwise the folded path would need an extra wrapper layer).
pub fn rasterize_with_media(
    frame: &FrameOps,
    width: u32,
    height: u32,
    media: &mut (impl FrameMedia + ?Sized),
) -> Result<Pixmap> {
    // The path side table is materialized on demand (see [`LazyPaths`])
    let paths = LazyPaths::new(&frame.paths);

    let paints: Vec<Paint<'static>> = frame.paints.iter().map(paint_from).collect();

    let mut base = Pixmap::new(width, height).ok_or_else(|| anyhow!("pixmap"))?;
    // Static prefix (the background paper): on a hit, continue painting from after the prefix. On a miss, paint through to the end of the prefix and store one image.
    let prefix = frame
        .static_prefix
        .filter(|prefix| prefix.ops > 0 && prefix.ops <= frame.ops.len())
        .map(|StaticPrefix { key, ops }| ((key, width, height), ops));
    let mut start = 0;
    let mut store_at = None;
    if let Some((key, ops)) = prefix {
        match static_prefix_get(key) {
            Some(hit) => {
                base.data_mut().copy_from_slice(hit.data());
                start = ops;
            }
            None => store_at = Some((key, ops)),
        }
    }
    // Layer stack: (offscreen layer, composite opacity, blend mode). A mask source layer is marked by a blend mode of `None`. It is not composited back onto the image, and is only folded into the alpha of the layer below at `PopMatte`.
    let mut layers: Vec<(Pixmap, f32, tiny_skia::BlendMode)> = Vec::new();
    // Index of the mask source layer in `layers` (pushed by `PushMatte`, popped by `PopMatte`).
    let mut mattes: Vec<usize> = Vec::new();
    // Clip stack: the top is the currently effective accumulated mask (intersected layer by layer)
    let mut clips: Vec<ClipEntry> = Vec::new();

    macro_rules! target {
        () => {
            match layers.last_mut() {
                Some((l, _, _)) => l,
                None => &mut base,
            }
        };
    }

    for (index, op) in frame.ops.iter().enumerate().skip(start) {
        if let Some((key, ops)) = store_at
            && index == ops
        {
            // Cache only when the prefix really flattens (guaranteed by the recorder; a defensive check: no caching if it does not flatten).
            if layers.is_empty() && clips.is_empty() && mattes.is_empty() {
                static_prefix_put(key, &base);
            }
            store_at = None;
        }
        let clip = clips.last().map(|entry| &entry.mask);
        match op {
            DrawOp::Clear { color } => {
                target!().fill(
                    Color::from_rgba(
                        color[0].clamp(0.0, 1.0),
                        color[1].clamp(0.0, 1.0),
                        color[2].clamp(0.0, 1.0),
                        color[3].clamp(0.0, 1.0),
                    )
                    .expect("bg"),
                );
            }
            DrawOp::FillRect {
                x,
                y,
                w,
                h,
                radius,
                color,
                tf,
            } => {
                if let Some(path) =
                    rounded_rect_path(*x as f64, *y as f64, *w as f64, *h as f64, *radius as f64)
                {
                    target!().fill_path(
                        &path,
                        &to_paint(color),
                        FillRule::Winding,
                        to_tf(tf),
                        clip,
                    );
                }
            }
            DrawOp::FillPath { path, color, tf } => {
                if let Some(Some(p)) = paths.get(*path as usize) {
                    target!().fill_path(p, &to_paint(color), FillRule::Winding, to_tf(tf), clip);
                }
            }
            DrawOp::StrokePath {
                path,
                color,
                width: sw,
                tf,
            } => {
                if let Some(Some(p)) = paths.get(*path as usize) {
                    let stroke = Stroke {
                        width: *sw,
                        line_cap: LineCap::Round,
                        line_join: LineJoin::Round,
                        ..Default::default()
                    };
                    target!().stroke_path(p, &to_paint(color), &stroke, to_tf(tf), clip);
                }
            }
            DrawOp::DrawMedia {
                asset,
                media_ms,
                src,
                tf,
            } => {
                let id = frame
                    .strings
                    .get(*asset as usize)
                    .ok_or_else(|| anyhow!("DrawMedia 引用未知 string {asset}"))?;
                // Vector animated images are rasterized at the pixel size they actually occupy in the image (a shrunken preview saves rasterization work, and a magnified export stays sharp). `tf` and `src` are still in natural-size units and are converted using the size returned.
                let natural = (*media_ms >= 0)
                    .then(|| media.vector_natural_size(id))
                    .flatten();
                let wanted = natural.and_then(|natural| media_target(tf, natural));
                let pm = media.frame_for_target(id, *media_ms, wanted)?;
                let (tf, src) = match natural {
                    Some((width, height)) if (pm.width(), pm.height()) != (width, height) => {
                        let fx = pm.width() as f32 / width as f32;
                        let fy = pm.height() as f32 / height as f32;
                        (
                            to_tf(tf).pre_scale(1.0 / fx, 1.0 / fy),
                            scale_crop(src, fx, fy, pm.width(), pm.height()),
                        )
                    }
                    _ => (to_tf(tf), *src),
                };
                let paint = PixmapPaint {
                    quality: FilterQuality::Bilinear,
                    ..Default::default()
                };
                // Source crop (fit: cover): all zeros = whole source
                if src[2] > 0.0 && src[3] > 0.0 {
                    let rect = tiny_skia::IntRect::from_xywh(
                        src[0].round() as i32,
                        src[1].round() as i32,
                        (src[2].round() as u32).max(1),
                        (src[3].round() as u32).max(1),
                    )
                    .ok_or_else(|| anyhow!("DrawMedia 裁剪矩形非法 {src:?}"))?;
                    let cropped = pm
                        .as_ref()
                        .clone_rect(rect)
                        .ok_or_else(|| anyhow!("DrawMedia 裁剪越界 {src:?}"))?;
                    if clip.is_some() || !copy_over(target!(), cropped.as_ref(), tf) {
                        target!().draw_pixmap(0, 0, cropped.as_ref(), &paint, tf, clip);
                    }
                } else if clip.is_some() || !copy_over(target!(), pm.as_ref().as_ref(), tf) {
                    target!().draw_pixmap(0, 0, pm.as_ref().as_ref(), &paint, tf, clip);
                }
            }
            DrawOp::DrawBitmap {
                bitmap,
                opacity,
                tf,
            } => {
                let data = frame
                    .bitmaps
                    .get(*bitmap as usize)
                    .ok_or_else(|| anyhow!("DrawBitmap 引用未知 bitmap {bitmap}"))?;
                let pixels = PixmapRef::from_bytes(&data.rgba, data.width, data.height)
                    .ok_or_else(|| {
                        anyhow!(
                            "DrawBitmap 位图 {bitmap} 尺寸与字节不符（{}x{}，{} 字节）",
                            data.width,
                            data.height,
                            data.rgba.len()
                        )
                    })?;
                target!().draw_pixmap(
                    0,
                    0,
                    pixels,
                    &PixmapPaint {
                        opacity: opacity.clamp(0.0, 1.0),
                        quality: FilterQuality::Bilinear,
                        ..Default::default()
                    },
                    to_tf(tf),
                    clip,
                );
            }
            DrawOp::FillPathPaint {
                path,
                paint,
                even_odd,
                tf,
            } => {
                let Some(Some(p)) = paths.get(*path as usize) else {
                    return Err(anyhow!("FillPathPaint 引用未知 path {path}"));
                };
                let Some(paint) = paints.get(*paint as usize) else {
                    return Err(anyhow!("FillPathPaint 引用未知 paint {paint}"));
                };
                let rule = if *even_odd {
                    FillRule::EvenOdd
                } else {
                    FillRule::Winding
                };
                target!().fill_path(p, paint, rule, to_tf(tf), clip);
            }
            DrawOp::StrokePathPaint {
                path,
                paint,
                width: sw,
                cap,
                join,
                miter,
                tf,
            } => {
                let Some(Some(p)) = paths.get(*path as usize) else {
                    return Err(anyhow!("StrokePathPaint 引用未知 path {path}"));
                };
                let Some(paint) = paints.get(*paint as usize) else {
                    return Err(anyhow!("StrokePathPaint 引用未知 paint {paint}"));
                };
                let stroke = Stroke {
                    width: *sw,
                    line_cap: to_cap(*cap),
                    line_join: to_join(*join),
                    miter_limit: miter.max(1.0),
                    ..Default::default()
                };
                target!().stroke_path(p, paint, &stroke, to_tf(tf), clip);
            }
            DrawOp::PushMatte => {
                if layers.is_empty() {
                    return Err(anyhow!("PushMatte 必须处在某个 PushLayer 之内"));
                }
                mattes.push(layers.len());
                layers.push((
                    Pixmap::new(width, height).ok_or_else(|| anyhow!("matte layer"))?,
                    1.0,
                    tiny_skia::BlendMode::SourceOver,
                ));
            }
            DrawOp::PopMatte { mode } => {
                let mode = MatteMode::from_code(*mode)
                    .ok_or_else(|| anyhow!("PopMatte 未知模式 {mode}"))?;
                if mattes.last() != Some(&(layers.len().saturating_sub(1))) {
                    return Err(anyhow!("PopMatte 无匹配 PushMatte"));
                }
                if clips
                    .last()
                    .is_some_and(|entry| entry.layer_depth == layers.len())
                {
                    return Err(anyhow!(
                        "PopMatte 时裁剪栈仍有遮罩层压入的 ClipPath：PopClip 不得跨越层边界"
                    ));
                }
                mattes.pop();
                let (matte, _, _) = layers.pop().expect("matte layer");
                let (content, _, _) = layers.last_mut().expect("PushMatte 已保证下面有层");
                apply_matte(content, &matte, mode);
            }
            DrawOp::PushLayer { opacity, blend } => {
                layers.push((
                    Pixmap::new(width, height).ok_or_else(|| anyhow!("layer"))?,
                    *opacity,
                    blend_to_skia(*blend),
                ));
            }
            DrawOp::PopLayer => {
                if mattes.last() == Some(&layers.len().saturating_sub(1)) {
                    return Err(anyhow!("PopLayer 时遮罩源层未 PopMatte"));
                }
                if clips
                    .last()
                    .is_some_and(|entry| entry.layer_depth == layers.len())
                {
                    return Err(anyhow!(
                        "PopLayer 时裁剪栈仍有本层压入的 ClipPath：PopClip 不得跨越层边界"
                    ));
                }
                let (layer, opacity, blend_mode) = layers
                    .pop()
                    .ok_or_else(|| anyhow!("PopLayer 无匹配 PushLayer"))?;
                // Compositing the layer back is unaffected by the clip, since the clip has already applied to each draw inside the layer.
                target!().draw_pixmap(
                    0,
                    0,
                    layer.as_ref(),
                    &PixmapPaint {
                        opacity,
                        blend_mode,
                        ..Default::default()
                    },
                    Transform::identity(),
                    None,
                );
            }
            DrawOp::ClipPath { path, tf } => {
                let Some(Some(p)) = paths.get(*path as usize) else {
                    return Err(anyhow!("ClipPath 引用未知 path {path}"));
                };
                let mut mask = match clips.last() {
                    Some(entry) => entry.mask.clone(),
                    None => Mask::new(width, height).ok_or_else(|| anyhow!("clip mask"))?,
                };
                if clips.is_empty() {
                    mask.fill_path(p, FillRule::Winding, true, to_tf(tf));
                } else {
                    mask.intersect_path(p, FillRule::Winding, true, to_tf(tf));
                }
                clips.push(ClipEntry {
                    mask,
                    layer_depth: layers.len(),
                });
            }
            DrawOp::PopClip => {
                let entry = clips
                    .pop()
                    .ok_or_else(|| anyhow!("PopClip 无匹配 ClipPath"))?;
                if entry.layer_depth != layers.len() {
                    return Err(anyhow!(
                        "PopClip 跨越了 PushLayer/PopLayer 边界（压入时层深 {}，弹出时 {}）",
                        entry.layer_depth,
                        layers.len()
                    ));
                }
            }
        }
    }
    // If the whole frame is only the prefix (nothing above the background paper), the loop never reaches the end of the prefix, so store it here.
    if let Some((key, _)) = store_at
        && layers.is_empty()
        && clips.is_empty()
        && mattes.is_empty()
    {
        static_prefix_put(key, &base);
    }
    if !layers.is_empty() {
        return Err(anyhow!("帧结束时层栈非空（{} 层未 Pop）", layers.len()));
    }
    if !mattes.is_empty() {
        return Err(anyhow!(
            "帧结束时遮罩栈非空（{} 层未 PopMatte）",
            mattes.len()
        ));
    }
    if !clips.is_empty() {
        return Err(anyhow!(
            "帧结束时裁剪栈非空（{} 层未 PopClip）",
            clips.len()
        ));
    }
    Ok(base)
}

#[cfg(test)]
mod media_target_tests {
    use super::*;
    use crate::drawop::{DrawOp, FrameBuilder};

    /// A 100×50 vector source (left half red, right half blue) that rasterizes
    /// at whatever size it is asked for and records each request.
    #[derive(Default)]
    struct Vector {
        asked: Vec<Option<(u32, u32)>>,
    }

    impl FrameMedia for Vector {
        fn frame(&mut self, id: &str, media_ms: i64) -> Result<Arc<Pixmap>> {
            self.frame_for_target(id, media_ms, None)
        }

        fn vector_natural_size(&self, _id: &str) -> Option<(u32, u32)> {
            Some((100, 50))
        }

        fn frame_for_target(
            &mut self,
            _id: &str,
            _media_ms: i64,
            target: Option<(u32, u32)>,
        ) -> Result<Arc<Pixmap>> {
            self.asked.push(target);
            let (width, height) = target.unwrap_or((100, 50));
            let mut pixmap = Pixmap::new(width, height).unwrap();
            pixmap.fill(Color::from_rgba8(0, 0, 255, 255));
            let left = tiny_skia::Rect::from_xywh(0.0, 0.0, width as f32 / 2.0, height as f32);
            let mut red = Paint::default();
            red.set_color_rgba8(255, 0, 0, 255);
            pixmap.fill_rect(left.unwrap(), &red, Transform::identity(), None);
            Ok(Arc::new(pixmap))
        }
    }

    fn draw(scale: f32, src: [f32; 4]) -> (Vec<Option<(u32, u32)>>, Pixmap) {
        let mut builder = FrameBuilder::default();
        let asset = builder.string_id("vector");
        builder.push(DrawOp::DrawMedia {
            asset,
            media_ms: 0,
            src,
            tf: [scale, 0.0, 0.0, scale, 10.0, 10.0],
        });
        let mut media = Vector::default();
        let out = rasterize_with_media(&builder.finish(), 400, 200, &mut media).unwrap();
        (media.asked, out)
    }

    fn rgba(pixmap: &Pixmap, x: u32, y: u32) -> [u8; 4] {
        let pixel = pixmap.pixel(x, y).unwrap();
        [pixel.red(), pixel.green(), pixel.blue(), pixel.alpha()]
    }

    const RED: [u8; 4] = [255, 0, 0, 255];
    const BLUE: [u8; 4] = [0, 0, 255, 255];
    const NONE: [u8; 4] = [0, 0, 0, 0];

    #[test]
    fn vector_media_rasterizes_at_the_device_size_it_covers() {
        let (asked, out) = draw(1.0, [0.0; 4]);
        assert_eq!(asked, [None], "natural size keeps the old raster");
        assert_eq!(
            (rgba(&out, 11, 11), rgba(&out, 108, 58), rgba(&out, 111, 30)),
            (RED, BLUE, NONE)
        );
        let (asked, out) = draw(0.5, [0.0; 4]);
        assert_eq!(asked, [Some((50, 25))]);
        assert_eq!(
            (rgba(&out, 11, 11), rgba(&out, 58, 33)),
            (RED, BLUE),
            "the smaller frame still fills the 50×25 box"
        );
        assert_eq!((rgba(&out, 61, 20), rgba(&out, 30, 36)), (NONE, NONE));
        let (asked, out) = draw(2.5, [0.0; 4]);
        assert_eq!(asked, [Some((250, 125))]);
        assert_eq!((rgba(&out, 12, 12), rgba(&out, 258, 133)), (RED, BLUE));
        assert_eq!(rgba(&out, 262, 60), NONE);
    }

    #[test]
    fn crops_are_mapped_into_the_target_sized_frame() {
        // fit: cover keeping the right (blue) half, drawn at 2×: 100×100 device px.
        let (asked, out) = draw(2.0, [50.0, 0.0, 50.0, 50.0]);
        assert_eq!(asked, [Some((200, 100))]);
        for (x, y) in [(11, 11), (108, 108), (60, 60)] {
            assert_eq!(rgba(&out, x, y), BLUE, "{x},{y}");
        }
        assert_eq!((rgba(&out, 112, 60), rgba(&out, 60, 112)), (NONE, NONE));
    }

    #[test]
    fn subpixel_changes_keep_natural_size_and_huge_zooms_are_capped() {
        assert_eq!(
            media_target(&[1.005, 0.0, 0.0, 1.005, 0.0, 0.0], (100, 50)),
            None
        );
        assert_eq!(
            media_target(&[0.0, 1.0, -1.0, 0.0, 9.0, 0.0], (100, 50)),
            None
        );
        assert_eq!(
            media_target(&[0.5, 0.0, 0.0, 0.5, 0.0, 0.0], (1920, 1080)),
            Some((960, 540))
        );
        // A 16:9 zoom hits the area cap; a tall strip hits the side cap.
        assert_eq!(
            media_target(&[100.0, 0.0, 0.0, 100.0, 0.0, 0.0], (1920, 1080)),
            Some((7680, 4320))
        );
        assert_eq!(
            media_target(&[100.0, 0.0, 0.0, 100.0, 0.0, 0.0], (100, 1000)),
            Some((819, 8192))
        );
        assert_eq!(
            media_target(&[5.0, 0.0, 0.0, 5.0, 0.0, 0.0], (1920, 1080)),
            Some((7680, 4320))
        );
        assert_eq!(media_target(&[0.0; 6], (100, 50)), None);
    }
}

#[cfg(test)]
mod copy_over_tests {
    use super::*;

    /// Reproducible pseudo-random bytes (xorshift).
    struct Bytes(u64);

    impl Bytes {
        fn next(&mut self) -> u8 {
            self.0 ^= self.0 << 13;
            self.0 ^= self.0 >> 7;
            self.0 ^= self.0 << 17;
            (self.0 >> 24) as u8
        }
    }

    /// A valid premultiplied pixel: `alpha` is given, and the color does not exceed it.
    fn pixel(bytes: &mut Bytes, alpha: u8) -> [u8; 4] {
        let channel = |bytes: &mut Bytes| {
            if alpha == 0 {
                0
            } else {
                (u16::from(bytes.next()) % (u16::from(alpha) + 1)) as u8
            }
        };
        [channel(bytes), channel(bytes), channel(bytes), alpha]
    }

    fn pixmap(width: u32, height: u32, mut fill: impl FnMut(u32, u32) -> [u8; 4]) -> Pixmap {
        let mut pixmap = Pixmap::new(width, height).unwrap();
        for (index, chunk) in pixmap.data_mut().chunks_exact_mut(4).enumerate() {
            chunk.copy_from_slice(&fill(index as u32 % width, index as u32 / width));
        }
        pixmap
    }

    /// The underlying image is random and semi-transparent. When the shortcut holds, the result is byte-for-byte identical to `draw_pixmap`; when it does not hold, `out` is left entirely untouched.
    fn check(src: &Pixmap, transform: Transform, expect_fast: bool) {
        let mut bytes = Bytes(0x9e37_79b9_7f4a_7c15);
        let base = pixmap(37, 23, |_, _| {
            let alpha = bytes.next();
            pixel(&mut bytes, alpha)
        });
        let mut slow = base.clone();
        slow.draw_pixmap(
            0,
            0,
            src.as_ref(),
            &PixmapPaint {
                quality: FilterQuality::Bilinear,
                ..Default::default()
            },
            transform,
            None,
        );
        let mut fast = base.clone();
        let took = copy_over(&mut fast, src.as_ref(), transform);
        assert_eq!(took, expect_fast, "{transform:?}");
        if took {
            assert!(fast.data() == slow.data(), "{transform:?}");
        } else {
            assert!(fast.data() == base.data(), "{transform:?}");
        }
    }

    #[test]
    fn copy_over_matches_draw_pixmap() {
        let mut bytes = Bytes(42);
        // Every channel value is walked through: the colors of opaque pixels take all values 0..=255.
        let mut value = 0u32;
        let opaque = pixmap(16, 16, |_, _| {
            let v = (value % 256) as u8;
            value += 1;
            [v, v.wrapping_mul(7), v.wrapping_add(91), 255]
        });
        // An opaque block on a transparent background (like a centered video), mixed with fully zero rows and opaque rows.
        let block = pixmap(20, 12, |x, y| {
            if (4..15).contains(&x) && (2..10).contains(&y) {
                pixel(&mut bytes, 255)
            } else {
                [0; 4]
            }
        });
        let speckled = pixmap(20, 12, |x, y| {
            if (x * 3 + y) % 4 == 0 {
                pixel(&mut bytes, 255)
            } else {
                [0; 4]
            }
        });
        for src in [&opaque, &block, &speckled] {
            for (tx, ty) in [
                (0.0, 0.0),
                (5.0, 3.0),
                (-4.0, -2.0),
                (30.0, 18.0),
                (-10.0, 15.0),
                (21.0, -5.0),
            ] {
                check(src, Transform::from_translate(tx, ty), true);
            }
            // Not an integer translation: left to the pipeline.
            for transform in [
                Transform::from_translate(0.5, 0.0),
                Transform::from_scale(2.0, 2.0),
                Transform::from_row(1.0, 0.1, 0.0, 1.0, 0.0, 0.0),
            ] {
                check(src, transform, false);
            }
            // Entirely outside the image.
            check(src, Transform::from_translate(100.0, 0.0), false);
        }
        // Has semi-transparent pixels, or an invalid premultiplied (r,g,b,0): the shortcut is not taken and nothing is touched.
        let soft = pixmap(8, 8, |x, y| {
            if (x, y) == (5, 6) {
                pixel(&mut bytes, 128)
            } else {
                pixel(&mut bytes, 255)
            }
        });
        check(&soft, Transform::identity(), false);
        let invalid = pixmap(8, 8, |x, _| if x == 3 { [9, 0, 0, 0] } else { [0; 4] });
        check(&invalid, Transform::identity(), false);
    }
}
