//! DrawOp frame instruction IR (the ccut version of opencat's draw_op/draw_encoding pattern):
//! record(t) produces a backend-independent instruction stream plus path/string side tables (deduplicated).
//! Binary encoding is byte-deterministic ⇒ fingerprints can be used for still-frame caching and cross-platform byte-level consistency tests.
//! Media appears only as references (asset id, media time); the bytes stay with the host (FrameMediaPlan semantics).
//! Color glyph bitmaps (v5) are not media: like glyph outlines, they are geometry/pixels extracted from the font at recording time, so like paths they are **embedded** in the bitmap side table, and the fingerprint covers their pixels.

use anyhow::{Result, bail};
use motion::effect::BlendMode;
use std::collections::HashMap;
use std::sync::Arc;

/// Path segments: verb 0=Move(2) 1=Line(2) 2=Quad(4) 3=Cubic(6) 4=Close(0)
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct PathSeg {
    pub verb: u8,
    pub pts: [f32; 6],
}

#[derive(Debug, Clone, Default, PartialEq)]
pub struct PathData(pub Vec<PathSeg>);

pub type Color4 = [f32; 4]; // RGBA, not premultiplied, 0..1
pub type Mat6 = [f32; 6]; // Affine [sx ky kx sy tx ty] (tiny-skia from_row order)

#[derive(Debug, Clone, PartialEq)]
pub enum DrawOp {
    Clear {
        color: Color4,
    },
    /// Rounded-rectangle fill (box background / subtitle background)
    FillRect {
        x: f32,
        y: f32,
        w: f32,
        h: f32,
        radius: f32,
        color: Color4,
        tf: Mat6,
    },
    FillPath {
        path: u32,
        color: Color4,
        tf: Mat6,
    },
    StrokePath {
        path: u32,
        color: Color4,
        width: f32,
        tf: Mat6,
    },
    /// Media reference: media_ms < 0 = static image; ≥0 = video frame at that media millisecond.
    /// src = source pixel crop rectangle [x, y, w, h] (used for fit: cover); all zeros = the whole source.
    DrawMedia {
        asset: u32,
        media_ms: i64,
        src: [f32; 4],
        tf: Mat6,
    },
    /// Offscreen layer: group opacity + blend mode (since v3 it carries `blend`; in v2, `PushLayer{opacity}` decodes with blend treated as `Normal`).
    PushLayer {
        opacity: f32,
        blend: BlendMode,
    },
    PopLayer,
    /// Clip: intersects `path` (transformed by `tf`) with the current clip, then pushes the result.
    ClipPath {
        path: u32,
        tf: Mat6,
    },
    /// Pops one clip layer. **Must not cross `PushLayer`/`PopLayer` boundaries** (spec §14.5).
    PopClip,
    /// Fill with a paint side table (v4): gradients and the even-odd fill rule, which `FillPath` cannot express.
    FillPathPaint {
        path: u32,
        paint: u32,
        /// `true` = even-odd, `false` = nonzero (`FillPath` is always nonzero).
        even_odd: bool,
        tf: Mat6,
    },
    /// Stroke with a paint side table (v4): gradient stroke plus line cap/join (`StrokePath` is always Round/Round).
    StrokePathPaint {
        path: u32,
        paint: u32,
        width: f32,
        /// 0=butt 1=round 2=square
        cap: u8,
        /// 0=miter 1=round 2=bevel
        join: u8,
        miter: f32,
        tf: Mat6,
    },
    /// Opens an offscreen layer for a **matte source** (v4). Drawing inside this layer does not enter the picture; on [`DrawOp::PopMatte`] it is folded by `mode` into the alpha of the **layer below**. Must be inside a `PushLayer`.
    PushMatte,
    /// Pops the matte source and applies it to the current layer; `mode` see [`MatteMode`].
    PopMatte {
        mode: u8,
    },
    /// Draws a bitmap side-table entry (v5): color glyphs (`sbix` / `CBDT` / `COLR`). `tf` maps **bitmap pixel coordinates** to the surface; the glyph placement and supersampling factor are already folded in at recording time. `opacity` is a separate field, so per-part fade-in does not break deduplication of the same bitmap. Pixels are not tinted by the text color (consistent with browsers and the subtitle channel).
    DrawBitmap {
        bitmap: u32,
        opacity: f32,
        tf: Mat6,
    },
}

/// Track matte mode (Lottie's `tt`).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MatteMode {
    /// Target alpha ×= matte alpha
    Alpha,
    /// Target alpha ×= 1 − matte alpha
    AlphaInverted,
    /// Target alpha ×= matte luminance (already weighted by matte alpha)
    Luma,
    /// Target alpha ×= 1 − matte luminance
    LumaInverted,
}

impl MatteMode {
    pub fn code(self) -> u8 {
        match self {
            MatteMode::Alpha => 0,
            MatteMode::AlphaInverted => 1,
            MatteMode::Luma => 2,
            MatteMode::LumaInverted => 3,
        }
    }

    pub fn from_code(code: u8) -> Option<MatteMode> {
        match code {
            0 => Some(MatteMode::Alpha),
            1 => Some(MatteMode::AlphaInverted),
            2 => Some(MatteMode::Luma),
            3 => Some(MatteMode::LumaInverted),
            _ => None,
        }
    }
}

/// Gradient color stop. `offset` ∈ [0,1]; `color` is non-premultiplied RGBA.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct GradientStop {
    pub offset: f32,
    pub color: Color4,
}

/// Paint side-table entry (v4). All geometric quantities are in the **path-local coordinate system**, the same coordinate system as the op's `tf`, so the paint transforms along with the path and needs no second matrix.
#[derive(Debug, Clone, PartialEq)]
pub enum PaintData {
    Solid(Color4),
    Linear {
        p0: [f32; 2],
        p1: [f32; 2],
        stops: Vec<GradientStop>,
    },
    /// `focus` is the highlight point (Lottie's `h`/`a`); when it equals `center`, the gradient is a true circle.
    Radial {
        center: [f32; 2],
        radius: f32,
        focus: [f32; 2],
        stops: Vec<GradientStop>,
    },
}

/// Bitmap side-table entry (v5): **premultiplied** RGBA8, stored tightly row by row, `rgba.len() == width × height × 4`.
#[derive(Clone, PartialEq)]
pub struct BitmapData {
    pub width: u32,
    pub height: u32,
    pub rgba: Arc<[u8]>,
}

impl std::fmt::Debug for BitmapData {
    /// Only prints the size and pixel fingerprint: printing an emoji byte by byte would be tens of thousands of numbers.
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("BitmapData")
            .field("width", &self.width)
            .field("height", &self.height)
            .field("rgba", &format_args!("fnv:{:016x}", fnv1a64(&self.rgba)))
            .finish()
    }
}

/// Raster hint: `ops[..ops]` is a prefix whose pixels are **determined solely by `key`** (for the document background: `Clear` + `meta.background.texture`). The layer stack and clip stack are both flattened at the end of the prefix. The CPU rasterizer caches, keyed by `(key, width, height)`, the full picture after the prefix is drawn. On a hit it copies that picture and continues drawing from op number `ops`, which is byte-for-byte equivalent to replaying from the start (rasterization is deterministic).
///
/// **Not part of the encoding and not in the fingerprint**: the instruction stream itself is unchanged, and executors that do not recognize it (GPU, `ccut ops`) still execute each op one by one; a decoded frame does not carry it.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct StaticPrefix {
    pub key: u64,
    pub ops: usize,
}

#[derive(Debug, Default)]
pub struct FrameOps {
    pub ops: Vec<DrawOp>,
    /// See [`StaticPrefix`]; only set by the recorder when it writes the background texture at the start of a frame.
    pub static_prefix: Option<StaticPrefix>,
    pub paths: Vec<PathData>,
    pub strings: Vec<String>,
    /// v4 paint side table. Empty ⇒ the whole frame is still encoded as v3 (existing goldens stay byte-identical).
    pub paints: Vec<PaintData>,
    /// v5 bitmap side table (color glyphs). Empty ⇒ do not bump to v5.
    pub bitmaps: Vec<BitmapData>,
}

/// Side-table deduplication at recording time (numbered by order of first appearance ⇒ deterministic output)
#[derive(Default)]
pub struct FrameBuilder {
    pub frame: FrameOps,
    path_ids: HashMap<u64, u32>,
    string_ids: HashMap<String, u32>,
    paint_ids: HashMap<u64, u32>,
    bitmap_ids: HashMap<u64, u32>,
}

impl FrameBuilder {
    pub fn push(&mut self, op: DrawOp) {
        self.frame.ops.push(op);
    }

    pub fn path_id(&mut self, data: PathData) -> u32 {
        let mut bytes = Vec::with_capacity(data.0.len() * 25);
        encode_path(&data, &mut bytes);
        let key = fnv1a64(&bytes);
        if let Some(&id) = self.path_ids.get(&key) {
            return id;
        }
        let id = self.frame.paths.len() as u32;
        self.frame.paths.push(data);
        self.path_ids.insert(key, id);
        id
    }

    pub fn string_id(&mut self, s: &str) -> u32 {
        if let Some(&id) = self.string_ids.get(s) {
            return id;
        }
        let id = self.frame.strings.len() as u32;
        self.frame.strings.push(s.to_string());
        self.string_ids.insert(s.to_string(), id);
        id
    }

    /// Paint side-table deduplication (same convention as `path_id`: keyed by the FNV of the encoded bytes).
    pub fn paint_id(&mut self, paint: PaintData) -> u32 {
        let mut bytes = Vec::with_capacity(64);
        encode_paint(&paint, &mut bytes);
        let key = fnv1a64(&bytes);
        if let Some(&id) = self.paint_ids.get(&key) {
            return id;
        }
        let id = self.frame.paints.len() as u32;
        self.frame.paints.push(paint);
        self.paint_ids.insert(key, id);
        id
    }

    /// Bitmap side-table deduplication: the key is the FNV of the **pixel content** (size + bytes), not the `Arc` pointer. After glyph-cache eviction and re-rasterization, a new `Arc` would be produced, and pointer-based deduplication would let the side table's entry count drift with cache state within the same frame, so encoding would no longer be a pure function of `(ir, t)`.
    pub fn bitmap_id(&mut self, bitmap: BitmapData) -> u32 {
        let mut head = Vec::with_capacity(8);
        put_u32(&mut head, bitmap.width);
        put_u32(&mut head, bitmap.height);
        let key = fnv1a64_continue(fnv1a64(&head), &bitmap.rgba);
        if let Some(&id) = self.bitmap_ids.get(&key) {
            return id;
        }
        let id = self.frame.bitmaps.len() as u32;
        self.frame.bitmaps.push(bitmap);
        self.bitmap_ids.insert(key, id);
        id
    }

    pub fn finish(self) -> FrameOps {
        self.frame
    }
}

/// tiny-skia Path → PathData (the only bridge on the recording side)
pub fn path_from_skia(p: &tiny_skia::Path) -> PathData {
    use tiny_skia::PathSegment as S;
    let mut out = Vec::new();
    for seg in p.segments() {
        out.push(match seg {
            S::MoveTo(p) => PathSeg {
                verb: 0,
                pts: [p.x, p.y, 0.0, 0.0, 0.0, 0.0],
            },
            S::LineTo(p) => PathSeg {
                verb: 1,
                pts: [p.x, p.y, 0.0, 0.0, 0.0, 0.0],
            },
            S::QuadTo(c, p) => PathSeg {
                verb: 2,
                pts: [c.x, c.y, p.x, p.y, 0.0, 0.0],
            },
            S::CubicTo(c1, c2, p) => PathSeg {
                verb: 3,
                pts: [c1.x, c1.y, c2.x, c2.y, p.x, p.y],
            },
            S::Close => PathSeg {
                verb: 4,
                pts: [0.0; 6],
            },
        });
    }
    PathData(out)
}

const VERB_PTS: [usize; 5] = [1, 1, 2, 3, 0];

// ── Binary envelope (LE; section order strings → paths → ops) ──────────────────

const MAGIC: u32 = 0x42_43_4F_50; // "BCOP"
/// **Baseline** envelope version: frames that contain no v4 primitives are always encoded with it.
///
/// * v2: `DrawMedia` adds the source crop rectangle (fit: cover, §6.5)
/// * v3: `PushLayer` adds `blend`; adds `ClipPath` / `PopClip` (ADR-M04)
/// * v4: paint side table (gradient / even-odd fill) and `PushMatte` / `PopMatte` (ADR-M11)
/// * v5: bitmap side table and `DrawBitmap` (color glyphs for BCF text)
///
/// `encode` writes the version that **this frame actually needs** ([`required_version`]): a frame with no v4 primitive still produces v3 bytes. This is not a shortcut but a commitment: the `core/fixtures/motion/` fingerprints recorded in stage 0 must not all change value just because "the renderer learned to draw gradients."
pub const VERSION: u32 = 3;
/// The version that introduced the paint side table and mattes.
const PAINT_VERSION: u32 = 4;
/// The version that introduced the bitmap side table.
const BITMAP_VERSION: u32 = 5;
/// Highest version that `encode` may produce and `decode` must recognize.
pub const MAX_VERSION: u32 = BITMAP_VERSION;
/// Lowest version that `decode` accepts.
pub const MIN_DECODABLE_VERSION: u32 = 2;

/// The minimum envelope version this frame requires.
pub fn required_version(frame: &FrameOps) -> u32 {
    let needs_v5 = !frame.bitmaps.is_empty()
        || frame
            .ops
            .iter()
            .any(|op| matches!(op, DrawOp::DrawBitmap { .. }));
    if needs_v5 {
        return BITMAP_VERSION;
    }
    let needs_v4 = !frame.paints.is_empty()
        || frame.ops.iter().any(|op| {
            matches!(
                op,
                DrawOp::FillPathPaint { .. }
                    | DrawOp::StrokePathPaint { .. }
                    | DrawOp::PushMatte
                    | DrawOp::PopMatte { .. }
            )
        });
    if needs_v4 { PAINT_VERSION } else { VERSION }
}

fn put_u32(out: &mut Vec<u8>, v: u32) {
    out.extend_from_slice(&v.to_le_bytes());
}
fn put_f32(out: &mut Vec<u8>, v: f32) {
    // -0.0 is normalized to +0.0: numerically equivalent frames must be byte-identical
    let v = if v == 0.0 { 0.0f32 } else { v };
    out.extend_from_slice(&v.to_le_bytes());
}
fn put_mat(out: &mut Vec<u8>, m: &Mat6) {
    for v in m {
        put_f32(out, *v);
    }
}
fn put_color(out: &mut Vec<u8>, c: &Color4) {
    for v in c {
        put_f32(out, *v);
    }
}

fn encode_path(p: &PathData, out: &mut Vec<u8>) {
    put_u32(out, p.0.len() as u32);
    for seg in &p.0 {
        out.push(seg.verb);
        for i in 0..VERB_PTS[seg.verb as usize] * 2 {
            put_f32(out, seg.pts[i]);
        }
    }
}

fn encode_stops(stops: &[GradientStop], out: &mut Vec<u8>) {
    put_u32(out, stops.len() as u32);
    for stop in stops {
        put_f32(out, stop.offset);
        put_color(out, &stop.color);
    }
}

fn encode_paint(paint: &PaintData, out: &mut Vec<u8>) {
    match paint {
        PaintData::Solid(color) => {
            out.push(0);
            put_color(out, color);
        }
        PaintData::Linear { p0, p1, stops } => {
            out.push(1);
            for v in p0.iter().chain(p1.iter()) {
                put_f32(out, *v);
            }
            encode_stops(stops, out);
        }
        PaintData::Radial {
            center,
            radius,
            focus,
            stops,
        } => {
            out.push(2);
            for v in center.iter().chain(std::iter::once(radius)).chain(focus) {
                put_f32(out, *v);
            }
            encode_stops(stops, out);
        }
    }
}

pub fn encode(frame: &FrameOps) -> Vec<u8> {
    let version = required_version(frame);
    let mut out = Vec::with_capacity(4096);
    put_u32(&mut out, MAGIC);
    put_u32(&mut out, version);
    put_u32(&mut out, frame.strings.len() as u32);
    for s in &frame.strings {
        put_u32(&mut out, s.len() as u32);
        out.extend_from_slice(s.as_bytes());
    }
    put_u32(&mut out, frame.paths.len() as u32);
    for p in &frame.paths {
        encode_path(p, &mut out);
    }
    if version >= PAINT_VERSION {
        put_u32(&mut out, frame.paints.len() as u32);
        for paint in &frame.paints {
            encode_paint(paint, &mut out);
        }
    }
    if version >= BITMAP_VERSION {
        put_u32(&mut out, frame.bitmaps.len() as u32);
        for bitmap in &frame.bitmaps {
            put_u32(&mut out, bitmap.width);
            put_u32(&mut out, bitmap.height);
            out.extend_from_slice(&bitmap.rgba);
        }
    }
    put_u32(&mut out, frame.ops.len() as u32);
    for op in &frame.ops {
        match op {
            DrawOp::Clear { color } => {
                out.push(0);
                put_color(&mut out, color);
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
                out.push(1);
                for v in [x, y, w, h, radius] {
                    put_f32(&mut out, *v);
                }
                put_color(&mut out, color);
                put_mat(&mut out, tf);
            }
            DrawOp::FillPath { path, color, tf } => {
                out.push(2);
                put_u32(&mut out, *path);
                put_color(&mut out, color);
                put_mat(&mut out, tf);
            }
            DrawOp::StrokePath {
                path,
                color,
                width,
                tf,
            } => {
                out.push(3);
                put_u32(&mut out, *path);
                put_color(&mut out, color);
                put_f32(&mut out, *width);
                put_mat(&mut out, tf);
            }
            DrawOp::DrawMedia {
                asset,
                media_ms,
                src,
                tf,
            } => {
                out.push(4);
                put_u32(&mut out, *asset);
                out.extend_from_slice(&media_ms.to_le_bytes());
                for v in src {
                    put_f32(&mut out, *v);
                }
                put_mat(&mut out, tf);
            }
            DrawOp::PushLayer { opacity, blend } => {
                out.push(5);
                put_f32(&mut out, *opacity);
                out.push(blend.code());
            }
            DrawOp::PopLayer => out.push(6),
            DrawOp::ClipPath { path, tf } => {
                out.push(7);
                put_u32(&mut out, *path);
                put_mat(&mut out, tf);
            }
            DrawOp::PopClip => out.push(8),
            DrawOp::FillPathPaint {
                path,
                paint,
                even_odd,
                tf,
            } => {
                out.push(9);
                put_u32(&mut out, *path);
                put_u32(&mut out, *paint);
                out.push(u8::from(*even_odd));
                put_mat(&mut out, tf);
            }
            DrawOp::StrokePathPaint {
                path,
                paint,
                width,
                cap,
                join,
                miter,
                tf,
            } => {
                out.push(10);
                put_u32(&mut out, *path);
                put_u32(&mut out, *paint);
                put_f32(&mut out, *width);
                out.push(*cap);
                out.push(*join);
                put_f32(&mut out, *miter);
                put_mat(&mut out, tf);
            }
            DrawOp::PushMatte => out.push(11),
            DrawOp::PopMatte { mode } => {
                out.push(12);
                out.push(*mode);
            }
            DrawOp::DrawBitmap {
                bitmap,
                opacity,
                tf,
            } => {
                out.push(13);
                put_u32(&mut out, *bitmap);
                put_f32(&mut out, *opacity);
                put_mat(&mut out, tf);
            }
        }
    }
    out
}

/// FNV-1a 64: encoded bytes → frame fingerprint (scene snapshot cache key / cross-platform consistency comparison)
pub fn fnv1a64(bytes: &[u8]) -> u64 {
    fnv1a64_continue(0xcbf2_9ce4_8422_2325, bytes)
}

/// Continues FNV-1a 64 from existing state `h` (feeding in segments gives the same result as feeding everything at once).
fn fnv1a64_continue(mut h: u64, bytes: &[u8]) -> u64 {
    for &b in bytes {
        h ^= b as u64;
        h = h.wrapping_mul(0x0000_0100_0000_01b3);
    }
    h
}

pub fn fingerprint(frame: &FrameOps) -> u64 {
    fnv1a64(&encode(frame))
}

// ── Decoder (v2 – v5) ────────────────────────────────────────────────

/// Cursor: all reads are bounds-checked; truncated input reports `bcop-truncated` rather than panicking.
struct Reader<'a> {
    bytes: &'a [u8],
    at: usize,
}

impl<'a> Reader<'a> {
    fn new(bytes: &'a [u8]) -> Self {
        Reader { bytes, at: 0 }
    }

    fn take(&mut self, n: usize) -> Result<&'a [u8]> {
        let end = self
            .at
            .checked_add(n)
            .ok_or_else(|| anyhow::anyhow!("bcop-truncated"))?;
        if end > self.bytes.len() {
            bail!(
                "bcop-truncated: needs {n} bytes, {} remaining",
                self.bytes.len() - self.at
            );
        }
        let slice = &self.bytes[self.at..end];
        self.at = end;
        Ok(slice)
    }

    fn u8(&mut self) -> Result<u8> {
        Ok(self.take(1)?[0])
    }

    fn u32(&mut self) -> Result<u32> {
        Ok(u32::from_le_bytes(self.take(4)?.try_into().unwrap()))
    }

    fn i64(&mut self) -> Result<i64> {
        Ok(i64::from_le_bytes(self.take(8)?.try_into().unwrap()))
    }

    fn f32(&mut self) -> Result<f32> {
        Ok(f32::from_le_bytes(self.take(4)?.try_into().unwrap()))
    }

    fn color(&mut self) -> Result<Color4> {
        Ok([self.f32()?, self.f32()?, self.f32()?, self.f32()?])
    }

    fn mat(&mut self) -> Result<Mat6> {
        Ok([
            self.f32()?,
            self.f32()?,
            self.f32()?,
            self.f32()?,
            self.f32()?,
            self.f32()?,
        ])
    }

    fn stops(&mut self) -> Result<Vec<GradientStop>> {
        let count = self.u32()? as usize;
        let mut out = Vec::with_capacity(count.min(4096));
        for _ in 0..count {
            out.push(GradientStop {
                offset: self.f32()?,
                color: self.color()?,
            });
        }
        Ok(out)
    }

    fn paint(&mut self) -> Result<PaintData> {
        match self.u8()? {
            0 => Ok(PaintData::Solid(self.color()?)),
            1 => Ok(PaintData::Linear {
                p0: [self.f32()?, self.f32()?],
                p1: [self.f32()?, self.f32()?],
                stops: self.stops()?,
            }),
            2 => Ok(PaintData::Radial {
                center: [self.f32()?, self.f32()?],
                radius: self.f32()?,
                focus: [self.f32()?, self.f32()?],
                stops: self.stops()?,
            }),
            other => bail!("bcop-paint-kind-unknown: {other}"),
        }
    }

    fn string(&mut self) -> Result<String> {
        let len = self.u32()? as usize;
        let bytes = self.take(len)?;
        String::from_utf8(bytes.to_vec()).map_err(|_| anyhow::anyhow!("bcop-string-utf8"))
    }
}

/// Parses a BCOP envelope. Returns `(source version, frame)`; the caller uses this to tell whether it read v2 or v3.
///
/// v2's `PushLayer` has only opacity, and blend is filled with `Normal`. Therefore `encode(decode(v2).1)` yields a **semantically equivalent v3**, not the original bytes.
pub fn decode(bytes: &[u8]) -> Result<(u32, FrameOps)> {
    let mut r = Reader::new(bytes);
    if r.u32()? != MAGIC {
        bail!("bcop-magic-mismatch");
    }
    let version = r.u32()?;
    if !(MIN_DECODABLE_VERSION..=MAX_VERSION).contains(&version) {
        bail!(
            "bcop-version-unsupported: {version} (readable {MIN_DECODABLE_VERSION}..={MAX_VERSION})"
        );
    }
    let string_count = r.u32()? as usize;
    let mut strings = Vec::with_capacity(string_count.min(4096));
    for _ in 0..string_count {
        strings.push(r.string()?);
    }
    let path_count = r.u32()? as usize;
    let mut paths = Vec::with_capacity(path_count.min(4096));
    for _ in 0..path_count {
        let seg_count = r.u32()? as usize;
        let mut segs = Vec::with_capacity(seg_count.min(65536));
        for _ in 0..seg_count {
            let verb = r.u8()?;
            let points = *VERB_PTS
                .get(verb as usize)
                .ok_or_else(|| anyhow::anyhow!("bcop-path-verb-unknown: {verb}"))?;
            let mut pts = [0.0f32; 6];
            for slot in pts.iter_mut().take(points * 2) {
                *slot = r.f32()?;
            }
            segs.push(PathSeg { verb, pts });
        }
        paths.push(PathData(segs));
    }
    let mut paints = Vec::new();
    if version >= PAINT_VERSION {
        let paint_count = r.u32()? as usize;
        paints.reserve(paint_count.min(4096));
        for _ in 0..paint_count {
            paints.push(r.paint()?);
        }
    }
    let mut bitmaps = Vec::new();
    if version >= BITMAP_VERSION {
        let bitmap_count = r.u32()? as usize;
        bitmaps.reserve(bitmap_count.min(4096));
        for _ in 0..bitmap_count {
            let width = r.u32()?;
            let height = r.u32()?;
            // The size product is checked for overflow first; out-of-bounds is reported as `bcop-truncated` by `take`.
            let len = (width as usize)
                .checked_mul(height as usize)
                .and_then(|pixels| pixels.checked_mul(4))
                .ok_or_else(|| anyhow::anyhow!("bcop-bitmap-size-invalid: {width}x{height}"))?;
            if len == 0 {
                bail!("bcop-bitmap-size-invalid: {width}x{height}");
            }
            bitmaps.push(BitmapData {
                width,
                height,
                rgba: r.take(len)?.into(),
            });
        }
    }
    let op_count = r.u32()? as usize;
    let mut ops = Vec::with_capacity(op_count.min(1 << 20));
    for _ in 0..op_count {
        let code = r.u8()?;
        ops.push(match code {
            0 => DrawOp::Clear { color: r.color()? },
            1 => DrawOp::FillRect {
                x: r.f32()?,
                y: r.f32()?,
                w: r.f32()?,
                h: r.f32()?,
                radius: r.f32()?,
                color: r.color()?,
                tf: r.mat()?,
            },
            2 => DrawOp::FillPath {
                path: r.u32()?,
                color: r.color()?,
                tf: r.mat()?,
            },
            3 => DrawOp::StrokePath {
                path: r.u32()?,
                color: r.color()?,
                width: r.f32()?,
                tf: r.mat()?,
            },
            4 => DrawOp::DrawMedia {
                asset: r.u32()?,
                media_ms: r.i64()?,
                src: [r.f32()?, r.f32()?, r.f32()?, r.f32()?],
                tf: r.mat()?,
            },
            5 => {
                let opacity = r.f32()?;
                // v2 has no blend byte: the whole layer stack has only group opacity.
                let blend = if version >= 3 {
                    let code = r.u8()?;
                    BlendMode::from_code(code)
                        .ok_or_else(|| anyhow::anyhow!("bcop-blend-unknown: {code}"))?
                } else {
                    BlendMode::Normal
                };
                DrawOp::PushLayer { opacity, blend }
            }
            6 => DrawOp::PopLayer,
            7 if version >= 3 => DrawOp::ClipPath {
                path: r.u32()?,
                tf: r.mat()?,
            },
            8 if version >= 3 => DrawOp::PopClip,
            9 if version >= 4 => DrawOp::FillPathPaint {
                path: r.u32()?,
                paint: r.u32()?,
                even_odd: r.u8()? != 0,
                tf: r.mat()?,
            },
            10 if version >= 4 => DrawOp::StrokePathPaint {
                path: r.u32()?,
                paint: r.u32()?,
                width: r.f32()?,
                cap: r.u8()?,
                join: r.u8()?,
                miter: r.f32()?,
                tf: r.mat()?,
            },
            11 if version >= 4 => DrawOp::PushMatte,
            12 if version >= 4 => {
                let mode = r.u8()?;
                if MatteMode::from_code(mode).is_none() {
                    bail!("bcop-matte-mode-unknown: {mode}");
                }
                DrawOp::PopMatte { mode }
            }
            13 if version >= 5 => DrawOp::DrawBitmap {
                bitmap: r.u32()?,
                opacity: r.f32()?,
                tf: r.mat()?,
            },
            other => bail!("bcop-op-unknown: {other} (version {version})"),
        });
    }
    if r.at != bytes.len() {
        bail!(
            "bcop-trailing-bytes: {} bytes left after parsing",
            bytes.len() - r.at
        );
    }
    Ok((
        version,
        FrameOps {
            static_prefix: None,
            ops,
            paths,
            strings,
            paints,
            bitmaps,
        },
    ))
}
