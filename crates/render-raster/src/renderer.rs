//! Frame recording driven by sample(t) (DrawOp IR): function-for-function counterpart of swift-renderer Renderer.swift,
//! visual clip (including the transition wrap channel) → camera → media nodes → captions,
//! but producing a backend-independent instruction stream; rasterization is in raster::rasterize.
//! record is a pure function of (ir, t) ⇒ identical bytes for the same frame (the premise for fingerprint caching and cross-platform comparison).

#[cfg(feature = "media")]
use crate::assets::LoadedAssets;
use crate::drawop::{
    BitmapData, DrawOp, FrameBuilder, FrameOps, Mat6, MatteMode, PathData, path_from_skia,
};
use crate::fonts::{ShapedLine, TextEngine, fmt_count};
#[cfg(feature = "media")]
use crate::media::MediaStore;
use crate::source::{Lottie, MediaTime};
use anyhow::{Result, bail};
use motion::effect::BlendMode;
use scene_primitives::Rgba;
use scene_primitives::json::{JsonExt, clamp};
use scene_primitives::layout;
use scene_primitives::pathstyle::{self, Cadence, LineCap, LineJoin};
use scene_primitives::resolve::{
    BgGradient, BoxBorder, CapItem, CaptionClip, ClipPoly, ClipShape, Ir, PartMotion, RNode,
    ResolvedEffect, VisualClip,
};
use scene_primitives::sample::{Channel, sample_channels, sample_frames};
use serde_json::{Map, Value};
use std::collections::BTreeSet;
use std::sync::Arc;
#[cfg(feature = "media")]
use tiny_skia::Pixmap;
use tiny_skia::{PathBuilder, Transform};

/// Compose two affine transforms: apply inner first, then outer (the call-order semantics of CG's translateBy/scaleBy).
fn compose(o: Transform, i: Transform) -> Transform {
    Transform::from_row(
        o.sx * i.sx + o.kx * i.ky,
        o.ky * i.sx + o.sy * i.ky,
        o.sx * i.kx + o.kx * i.sy,
        o.ky * i.kx + o.sy * i.sy,
        o.sx * i.tx + o.kx * i.ty + o.tx,
        o.ky * i.tx + o.sy * i.ty + o.ty,
    )
}

fn translate(x: f64, y: f64) -> Transform {
    Transform::from_translate(x as f32, y as f32)
}

fn scale_xy(sx: f64, sy: f64) -> Transform {
    Transform::from_scale(sx as f32, sy as f32)
}

fn mat(tf: Transform) -> Mat6 {
    [tf.sx, tf.ky, tf.kx, tf.sy, tf.tx, tf.ty]
}

/// Supersampling factor for color glyph bitmaps: takes the larger axis scale of the transform, rounds up to a power of 2, clamped to ¼–4×.
///
/// Power-of-two steps let continuous scale animations re-rasterize only at a few font sizes (the glyph cache and the bitmap side table can both be reused); rounding up guarantees the bitmap is only ever shrunk on screen (by at most 2×), never enlarged and softened. Tolerance 0.01 (log2 domain) suppresses floating-point jitter near 1.0 so static text does not flip to 2×.
fn bitmap_oversample(tf: Transform) -> f32 {
    let scale = f64::from(tf.sx.hypot(tf.ky)).max(f64::from(tf.kx.hypot(tf.sy)));
    if !scale.is_finite() || scale <= 0.0 {
        return 1.0;
    }
    let exp = (scale.log2() - 0.01).ceil().clamp(-2.0, 2.0);
    2f64.powi(exp as i32) as f32
}

/// Color glyph (emoji etc., `sbix` / `CBDT` / `COLR`) → one `DrawBitmap`.
///
/// `gt` is the transform from the glyph origin (left end of the baseline) to the surface. Returns `false` = this is not a color glyph; the caller proceeds with the outline as usual. Monochrome faces never trigger any rasterization (see [`TextEngine::color_glyph`]). The bitmap ignores the text color and uses only its alpha.
fn record_color_glyph(
    key: cosmic_text::CacheKey,
    gt: Transform,
    opacity: f32,
    b: &mut FrameBuilder,
    engine: &mut TextEngine,
) -> bool {
    let oversample = bitmap_oversample(gt);
    let Some(image) = engine.color_glyph(key, oversample) else {
        return false;
    };
    // Bitmap pixel → glyph-local: first translate by placement (`top` is positive with y up),
    // then scale back to the layout font size.
    let inv = 1.0 / f64::from(oversample);
    let place = compose(
        scale_xy(inv, inv),
        translate(f64::from(image.left), -f64::from(image.top)),
    );
    let bitmap = b.bitmap_id(BitmapData {
        width: image.width,
        height: image.height,
        rgba: image.rgba,
    });
    b.push(DrawOp::DrawBitmap {
        bitmap,
        opacity,
        tf: mat(compose(gt, place)),
    });
    true
}

fn col(c: &Rgba, alpha: f64) -> [f32; 4] {
    [
        (c.r / 255.0).clamp(0.0, 1.0) as f32,
        (c.g / 255.0).clamp(0.0, 1.0) as f32,
        (c.b / 255.0).clamp(0.0, 1.0) as f32,
        (c.a * alpha).clamp(0.0, 1.0) as f32,
    ]
}

/// Node sampling clock (spec §7.10). `real` is the project's real time; `t` is this node's time quantized by its `cadence` sampling domain; when there is no domain the two are equal.
#[derive(Clone, Copy)]
struct Clock {
    real: f64,
    t: f64,
    /// Draw frequency of the current domain; `None` = not in any domain.
    fps: Option<f64>,
    /// Start of the host clip: quantization must not pull the time before the clip start (for a clip whose start is not on the grid, the first drawn frame samples at the clip start).
    floor: f64,
}

impl Clock {
    fn new(real: f64, floor: f64) -> Clock {
        Clock {
            real,
            t: real,
            fps: None,
            floor,
        }
    }

    /// Enter a `cadence` declaration. When inheriting the same domain, return as-is — parent and child do not quantize twice.
    fn enter(self, cadence: Cadence) -> Clock {
        match cadence {
            Cadence::Inherit => self,
            Cadence::Off => Clock {
                t: self.real,
                fps: None,
                ..self
            },
            Cadence::Fps(fps) => Clock {
                t: pathstyle::hold(self.real, fps).max(self.floor.min(self.real)),
                fps: Some(fps),
                ..self
            },
        }
    }
}

/// **Layered** recording result for one frame (design §6.3).
///
/// A document with no effects yields only one [`FrameLayer::Ops`] — the planner folds it into a single Draw pass, byte-identical to rasterizing right after [`FrameRenderer::record`].
#[derive(Debug)]
pub enum FrameLayer {
    /// Instruction stream drawn directly into the accumulated picture.
    Ops(FrameOps),
    /// Elements that need an independent offscreen surface: `ops` are drawn onto a transparent canvas, each `Filter` pass runs in turn, then it is composited back into the accumulated picture per `blend` / `opacity` (spec §6.6).
    Effect {
        ops: FrameOps,
        effects: Vec<ResolvedEffect>,
        blend: BlendMode,
        opacity: f32,
    },
    /// The subtree is composited first, then clipped/masked, filtered, and finally group opacity and blend are applied.
    Group {
        layers: Vec<FrameLayer>,
        masks: Vec<(Vec<FrameLayer>, MatteMode)>,
        effects: Vec<ResolvedEffect>,
        blend: BlendMode,
        opacity: f32,
    },
    Temporal {
        samples: Vec<(Vec<FrameLayer>, f64)>,
        mode: scene_primitives::temporal::EchoMode,
    },
    /// Independent raster canvas, transformed into the parent after its own effects.
    LocalCanvas {
        layers: Vec<FrameLayer>,
        width: u32,
        height: u32,
        tf: Mat6,
    },
    /// Samples completed lower siblings in the nearest isolated group.
    Backdrop {
        masks: Vec<(Vec<FrameLayer>, MatteMode)>,
        effects: Vec<ResolvedEffect>,
        opacity: f32,
    },
    /// Surface Transition (spec §9): each side is drawn into its own transparent offscreen surface, then composited by a two-input effect driven by `progress`; the result is pasted back as a whole into the accumulated picture.
    ///
    /// `from_static` / `to_static` mean "this side's picture does not change across frames" — so both sides can declare [`crate::plan::SurfaceLifetime::Static`]. The criterion is conservative: no channel anywhere in the subtree, and no video (see `clip_is_static`).
    Transition {
        from: Vec<FrameLayer>,
        to: Vec<FrameLayer>,
        effect: motion::effect::EffectRef,
        /// Closed interval `[0, 1]`.
        progress: f32,
        uniforms: motion::effect::UniformMap,
        from_static: bool,
        to_static: bool,
    },
}

/// Product of [`FrameRenderer::record_layered`].
#[derive(Debug, Default)]
pub struct RecordedFrame {
    pub layers: Vec<FrameLayer>,
}

impl RecordedFrame {
    /// Exactly one layer of ordinary instruction stream ⇒ can be folded into a single Draw pass.
    pub fn is_folded(&self) -> bool {
        matches!(self.layers.as_slice(), [FrameLayer::Ops(_)])
    }
}

/// Recording mode. The flat path cannot draw a `Transition` pass, so on that path Surface Transitions always degrade to their Motion fallback (spec §9).
#[derive(Clone, Copy)]
enum RecordMode<'a> {
    Flat,
    /// Layered recording + the degradation list given by the planner (by the id of `from_clip`).
    Layered(&'a BTreeSet<String>),
}

/// Three states of [`FrameRenderer::wrap_clip_path`]: no clip / clipped to empty (nothing drawn at this tick) / path.
enum WrapClip {
    None,
    Empty,
    Path(PathData),
}

/// Layer/clip stack of a single Draw stream; offscreen groups are only created at complete scope boundaries.
enum Open {
    Layer,
    Clip,
}

/// Layered recorder. With `split = false` its behaviour is exactly the same as the single `FrameBuilder` of 4A (effect nodes are inlined as-is, producing no second layer) — this is the path `record()` takes.
struct Recorder {
    split: bool,
    layers: Vec<FrameLayer>,
    b: FrameBuilder,
    stack: Vec<Open>,
}

impl Recorder {
    fn new(split: bool) -> Self {
        Recorder {
            split,
            layers: Vec::new(),
            b: FrameBuilder::default(),
            stack: Vec::new(),
        }
    }

    fn push_layer(&mut self, opacity: f32, blend: BlendMode) {
        self.b.push(DrawOp::PushLayer { opacity, blend });
        self.stack.push(Open::Layer);
    }

    fn pop_layer(&mut self) {
        self.b.push(DrawOp::PopLayer);
        debug_assert!(matches!(self.stack.last(), Some(Open::Layer)));
        self.stack.pop();
    }

    fn push_clip(&mut self, path: PathData, tf: Mat6) {
        let id = self.b.path_id(path.clone());
        self.b.push(DrawOp::ClipPath { path: id, tf });
        self.stack.push(Open::Clip);
    }

    fn pop_clip(&mut self) {
        self.b.push(DrawOp::PopClip);
        debug_assert!(matches!(self.stack.last(), Some(Open::Clip)));
        self.stack.pop();
    }

    fn push_group(&mut self, layer: FrameLayer) {
        debug_assert!(self.stack.is_empty(), "an offscreen group cannot split an ancestor's opacity or clip");
        let ops = std::mem::take(&mut self.b).finish();
        if !ops.ops.is_empty() {
            self.layers.push(FrameLayer::Ops(ops));
        }
        self.layers.push(layer);
    }

    /// Accepts the next Surface Transition layer. The call site is at the **top level** of the clip loop; at this point the layer / clip stack is necessarily empty (each clip opens and closes its own), so no ancestor scope needs to be split apart.
    #[allow(clippy::too_many_arguments)]
    fn push_transition(
        &mut self,
        from: Vec<FrameLayer>,
        to: Vec<FrameLayer>,
        effect: motion::effect::EffectRef,
        progress: f32,
        uniforms: motion::effect::UniformMap,
        from_static: bool,
        to_static: bool,
    ) {
        debug_assert!(self.stack.is_empty(), "transition layers only open at the top level of the clip loop");
        let ops = std::mem::take(&mut self.b).finish();
        if !ops.ops.is_empty() {
            self.layers.push(FrameLayer::Ops(ops));
        }
        self.layers.push(FrameLayer::Transition {
            from,
            to,
            effect,
            progress,
            uniforms,
            from_static,
            to_static,
        });
        self.b = FrameBuilder::default();
    }

    fn finish(mut self) -> RecordedFrame {
        let ops = std::mem::take(&mut self.b).finish();
        if !ops.ops.is_empty() || self.layers.is_empty() {
            self.layers.push(FrameLayer::Ops(ops));
        }
        RecordedFrame {
            layers: self.layers,
        }
    }
}

/// Recording context for one clip: clip root, clock and transform at the root. Computing the mask source of `style.mask` requires recomputing transforms from the root along the ancestor chain, so every node carries it down (`Copy`, just three borrows / values).
#[derive(Clone, Copy)]
struct ClipCtx<'a> {
    root: &'a RNode,
    clock: Clock,
    tf: Transform,
    skip_root: bool,
    end: f64,
}

/// Product of [`FrameRenderer::node_pose`]: this tick's clock, the local→canvas transform, and the sampling result.
struct NodePose {
    clock: Clock,
    tf: Transform,
    opacity: f64,
    blur: f64,
    pose: scene_primitives::sample::SampledPose,
}

/// Path from `root` to the node with id `id` (both ends included). Returns true if found.
fn find_node_chain<'a>(root: &'a RNode, id: &str, chain: &mut Vec<&'a RNode>) -> bool {
    chain.push(root);
    if root.id == id {
        return true;
    }
    if chain.len() > 1 && root.composition.is_some() {
        chain.pop();
        return false;
    }
    for child in &root.children {
        if find_node_chain(child, id, chain) {
            return true;
        }
    }
    chain.pop();
    false
}

/// Per-part precomputed result for [`FrameRenderer::record_text_parts`]: all glyphs of the same part share one delta and one horizontal anchor, sampled once and reused.
/// [`PartPose::IDENTITY`] is the neutral value for "no part override", bitwise identical to the per-glyph version's `(1, 0, 0, 1)` (here `scale == 1.0`, and `anchor` does not take part in the computation).
#[derive(Clone, Copy)]
struct PartPose {
    opacity: f64,
    dx: f64,
    dy: f64,
    scale: f64,
    anchor: f64,
    color: Option<Rgba>,
    reveal_end: usize,
    /// The `blur` channel of a part (px, ≥ 0). Parts with > 0 are drawn into offscreen layers bucketed by radius, and [`FrameRenderer::flush_part_blur`] applies `filter.blur` once to each.
    blur: f64,
}

impl PartPose {
    const IDENTITY: PartPose = PartPose {
        opacity: 1.0,
        dx: 0.0,
        dy: 0.0,
        scale: 1.0,
        anchor: 0.0,
        color: None,
        reveal_end: usize::MAX,
        blur: 0.0,
    };
}

/// Buckets for word blur: parts with the same radius share one offscreen layer (parts not yet started have the same radius and naturally fall into the same bucket). The key is the bit pattern of the radius — only bitwise-identical radii are merged, no quantization.
type PartBlurBuckets = Vec<(u64, FrameBuilder)>;

fn part_blur_bucket(buckets: &mut PartBlurBuckets, blur: f64) -> &mut FrameBuilder {
    let key = blur.to_bits();
    let index = match buckets.iter().position(|(bits, _)| *bits == key) {
        Some(index) => index,
        None => {
            buckets.push((key, FrameBuilder::default()));
            buckets.len() - 1
        }
    };
    &mut buckets[index].1
}

fn text_reveal_end(
    text: &str,
    unit: Option<motion::PartUnit>,
    progress: f64,
    block: Option<&scene_primitives::text_layout::TextBlock>,
) -> usize {
    if progress >= 1.0 {
        return usize::MAX;
    }
    if progress <= 0.0 {
        return 0;
    }
    let unit = unit.unwrap_or(motion::PartUnit::Char);
    let ranges = if unit == motion::PartUnit::Line {
        block
            .map(|block| block.lines.iter().map(|line| line.bytes.clone()).collect())
            .unwrap_or_else(|| motion::split_animation_parts(text, unit))
    } else {
        motion::split_animation_parts(text, unit)
    };
    let count = (progress * ranges.len() as f64 + 1e-9).floor() as usize;
    if count == 0 {
        0
    } else {
        ranges.get(count - 1).map_or(text.len(), |range| range.end)
    }
}

#[derive(Default)]
struct GridGeometryCache(
    std::sync::Mutex<(
        usize,
        std::collections::VecDeque<(u64, Arc<PathData>, usize)>,
    )>,
);
impl GridGeometryCache {
    fn get(&self, key: u64) -> Option<Arc<PathData>> {
        self.0
            .lock()
            .ok()?
            .1
            .iter()
            .find(|(k, _, _)| *k == key)
            .map(|(_, path, _)| path.clone())
    }
    fn put(&self, key: u64, path: Arc<PathData>) {
        let bytes = path.0.capacity() * std::mem::size_of::<crate::drawop::PathSeg>();
        const MAX_BYTES: usize = 16 * 1024 * 1024;
        if bytes > MAX_BYTES {
            return;
        }
        if let Ok(mut cache) = self.0.lock() {
            if cache.1.iter().any(|(k, _, _)| *k == key) {
                return;
            }
            while cache.0 + bytes > MAX_BYTES || cache.1.len() >= 32 {
                if let Some((_, _, size)) = cache.1.pop_front() {
                    cache.0 -= size;
                } else {
                    break;
                }
            }
            cache.0 += bytes;
            cache.1.push_back((key, path, bytes));
        }
    }
}

pub struct FrameRenderer {
    pub width: u32,
    pub height: u32,
    /// Lottie source (asset id → parsed document).
    ///
    /// Bitmap media enters only at the rasterization stage (`MediaStore`), but Lottie does not — it **must become DrawOps at recording time**, so the recorder must hold it. Installed by [`FrameRenderer::new_with_lotties`]; a missing asset is a hard error at that step, leaving no silent gap where "part of the picture is missing."
    lotties: std::collections::HashMap<String, Arc<Lottie>>,
    /// Geometry cache for texture fills (`source::texture`). Hit or miss does not affect output.
    textures: Arc<crate::source::texture::TextureCache>,
    /// Geometry cache for `brush.kind: "paint"` stroke brushes (`source::paint`). Hit or miss does not affect output.
    paints: Arc<crate::source::paint::PaintCache>,
    grid_cache: Arc<GridGeometryCache>,
}

impl FrameRenderer {
    /// The order is a **contract**: layout → `build_channels_after_layout` (evaluating relative lengths) → recording. Bases such as `selfWidth` / `parentWidth` only have values once a static layout box exists (design §5.5).
    ///
    /// A document containing a `lottie` element must use [`FrameRenderer::new_with_lotties`].
    pub fn new(ir: &mut Ir, engine: &mut TextEngine) -> Result<Self> {
        Self::new_with_lotties(ir, engine, &Default::default())
    }

    /// [`FrameRenderer::new`] plus the vector sources already loaded by the host.
    ///
    /// This checks that every `lottie` element's asset is present in `assets.lotties` — such missing assets cannot be detected at recording time (`record` is a pure function with nowhere to return an error), so they must fail fast at assembly time.
    #[cfg(feature = "media")]
    pub fn new_with_assets(
        ir: &mut Ir,
        engine: &mut TextEngine,
        assets: &LoadedAssets,
    ) -> Result<Self> {
        Self::new_with_lotties(ir, engine, &assets.lotties)
    }

    /// Prepare the recorder with vector sources resolved by the host. Independent of resource loading, filesystem and media decoding; native and WASM use the same layout and animation compilation path.
    pub fn new_with_lotties(
        ir: &mut Ir,
        engine: &mut TextEngine,
        lotties: &std::collections::HashMap<String, Arc<Lottie>>,
    ) -> Result<Self> {
        let (w, h) = (ir.w, ir.h);
        for clip in &mut ir.visual_clips {
            layout::layout_tree(&mut clip.tree, w, h, engine);
        }
        layout::layout_captions(ir, engine);
        scene_primitives::resolve::build_channels_after_layout(ir)?;
        for clip in &ir.visual_clips {
            check_lottie_sources(&clip.tree, lotties)?;
        }
        Ok(FrameRenderer {
            width: ir.w as u32,
            height: ir.h as u32,
            lotties: lotties.clone(),
            textures: Default::default(),
            paints: Default::default(),
            grid_cache: Default::default(),
        })
    }

    /// Full frame instructions for time t (pure function; does not touch media bytes).
    ///
    /// **Flat form**: the effect stack does not take effect here (effects are `Filter` passes, not DrawOp primitives, spec §14.5); `clipPath` and `blendMode` have single-surface semantics and go into the instruction stream as usual. What `ccut ops` prints is this stream.
    pub fn record(&self, ir: &Ir, engine: &mut TextEngine, t: f64) -> FrameOps {
        let mut frame = self.record_into(ir, engine, t, RecordMode::Flat);
        match frame.layers.pop() {
            Some(FrameLayer::Ops(ops)) => ops,
            _ => unreachable!("flat recording only ever produces a single plain op stream"),
        }
    }

    /// Layered recording: elements with an effect stack each form a layer; the rest remains one instruction stream (design §6.3). A document with no effects gets `layers` exactly equal to `[Ops(record(t))]`.
    pub fn record_layered(&self, ir: &Ir, engine: &mut TextEngine, t: f64) -> RecordedFrame {
        self.record_layered_with(ir, engine, t, &BTreeSet::new())
    }

    /// [`FrameRenderer::record_layered`] plus a **degradation list**: a Surface Transition named in the list (by the id of `from_clip`) uses its Motion fallback channel instead and starts no `Transition` layer. The list is given by the planner's preflight — whether a backend can run an effect is a capability matter, which the recorder itself does not know.
    pub fn record_layered_with(
        &self,
        ir: &Ir,
        engine: &mut TextEngine,
        t: f64,
        fallbacks: &BTreeSet<String>,
    ) -> RecordedFrame {
        self.record_into(ir, engine, t, RecordMode::Layered(fallbacks))
    }

    fn record_into(
        &self,
        ir: &Ir,
        engine: &mut TextEngine,
        t: f64,
        mode: RecordMode<'_>,
    ) -> RecordedFrame {
        let split = matches!(mode, RecordMode::Layered(_));
        let mut r = Recorder::new(split);
        let b = &mut r.b;
        b.push(DrawOp::Clear {
            color: col(&ir.bg, 1.0),
        });
        // `meta.background.texture`: fills the canvas, outside the camera (the paper does not follow the lens).
        if let Some(texture) = &ir.bg_texture {
            self.record_texture(
                (0.0, 0.0, ir.w, ir.h),
                texture,
                Some(ir.bg),
                1.0,
                &box_path(ir.w, ir.h),
                Transform::identity(),
                b,
            );
            // The background paper is time-independent: its pixels are determined only by (texture parameters, base color, canvas size), so the rasterizer caches the whole prefix (`Clear` + texture) by that key, instead of redrawing tens of thousands of grains each frame.
            let key = crate::drawop::fnv1a64(
                format!("bg-texture/1 {texture:?} {:?} {} {}", ir.bg, ir.w, ir.h).as_bytes(),
            );
            b.frame.static_prefix = Some(crate::drawop::StaticPrefix {
                key,
                ops: b.frame.ops.len(),
            });
        }

        // camera (applies to all visual clips; captions are outside the camera)
        let cam_t = self.camera_transform(ir, t);

        // Surface Transition (spec §9): the cut points active at this tick. Those in the list take the Motion degradation; the flat path (`record`) always degrades — a single-surface instruction stream cannot express two-input compositing, and silently dropping it would be wrong.
        let mut consumed: Vec<&str> = Vec::new();
        for clip in &ir.visual_clips {
            if consumed.contains(&clip.id.as_str()) {
                continue;
            }
            if t < clip.render_start || t > clip.render_end {
                continue;
            }
            if let RecordMode::Layered(fallbacks) = mode
                && let Some((entry, progress)) = ir
                    .surface_transitions
                    .iter()
                    .filter(|entry| entry.from_clip == clip.id)
                    .find_map(|entry| entry.progress_at(t).map(|p| (entry, p)))
                && !fallbacks.contains(&entry.from_clip)
                && let Some(to_clip) = ir
                    .visual_clips
                    .iter()
                    .find(|other| other.id == entry.to_clip)
            {
                let from = self.record_clip_isolated(ir, clip, t, cam_t, engine);
                let to = self.record_clip_isolated(ir, to_clip, t, cam_t, engine);
                r.push_transition(
                    from,
                    to,
                    entry.effect.clone(),
                    progress as f32,
                    entry.uniforms.clone(),
                    Self::clip_is_static(clip),
                    Self::clip_is_static(to_clip),
                );
                consumed.push(entry.to_clip.as_str());
                continue;
            }
            let fallback = Self::fallback_channels(ir, clip, t, mode);
            self.record_visual_clip(ir, clip, t, cam_t, fallback, &mut r, engine);
        }

        self.record_captions(ir, engine, t, &mut r.b);
        r.finish()
    }

    /// Flat single-frame entry point for recording + rasterization.
    ///
    /// Draws only DrawOp primitives: the effect stack is `Filter` passes (spec §14.5), not in the instruction stream, so this path **does not apply `effects[]` or `blur`**. For the product path use [`crate::plan::FramePlanner::render`]; this is kept for tests and cross-checks that only care about the instruction stream.
    #[cfg(feature = "media")]
    pub fn draw(
        &self,
        ir: &Ir,
        engine: &mut TextEngine,
        media: &mut MediaStore,
        t: f64,
    ) -> Result<Pixmap> {
        let frame = self.record(ir, engine, t);
        crate::raster::rasterize(&frame, self.width, self.height, media)
    }

    /// Which **degraded** transition channels to fill in for this clip at this tick.
    ///
    /// The flat path always fills them (it cannot draw a `Transition` pass); the layered path fills them only when the planner has listed this cut point in the degradation list. Returns a borrow, not a copy of the channels.
    fn fallback_channels<'a>(
        ir: &'a Ir,
        clip: &VisualClip,
        t: f64,
        mode: RecordMode<'_>,
    ) -> Vec<&'a Channel> {
        let mut out = Vec::new();
        for entry in &ir.surface_transitions {
            let side = if entry.from_clip == clip.id {
                &entry.fallback_out
            } else if entry.to_clip == clip.id {
                &entry.fallback_in
            } else {
                continue;
            };
            let degraded = match mode {
                RecordMode::Flat => true,
                RecordMode::Layered(fallbacks) => fallbacks.contains(&entry.from_clip),
            };
            // Must also fill outside the window: the transition channel takes endpoint values outside the window (the extended-visibility segment relies on it to settle).
            let _ = t;
            if degraded {
                out.extend(side.iter());
            }
        }
        out
    }

    /// Is this clip's picture **unchanged across frames** — so both sides of a transition can declare `Static`.
    ///
    /// The criterion is deliberately conservative: no channel anywhere in the subtree, no text part animation, no video / animated image node, and the clip itself has no wrap channel. A wrong judgment in this direction only costs a cache reuse; it never draws incorrectly.
    fn clip_is_static(clip: &VisualClip) -> bool {
        fn node_is_static(node: &RNode) -> bool {
            node.channels.is_empty()
                && node.echo.is_none()
                && node.follow.is_none()
                && node.char_grid.is_none()
                && node.proc.is_none()
                && node.local_camera.is_empty()
                && node.time_map.is_none()
                && node.part_motion.is_none()
                && node.wobble.is_none_or(|wobble| wobble.every == 0)
                && !matches!(
                    node.ntype.as_str(),
                    "video" | "animatedImage" | "lottie" | "program"
                )
                && node.children.iter().all(node_is_static)
        }
        clip.wrap_channels.is_empty() && node_is_static(&clip.tree)
    }

    /// Records one clip alone onto a **transparent** instruction stream (one side of a transition).
    ///
    /// No `Clear`: outside the two pictures the surface is transparent; the canvas background is handled by the accumulation layer. Each side recursively records its own filters, masks and blends.
    fn record_clip_isolated(
        &self,
        ir: &Ir,
        clip: &VisualClip,
        t: f64,
        cam_t: Transform,
        engine: &mut TextEngine,
    ) -> Vec<FrameLayer> {
        let mut side = Recorder::new(true);
        self.record_visual_clip(ir, clip, t, cam_t, Vec::new(), &mut side, engine);
        side.finish().layers
    }

    /// Recording of one visual clip: transition wrap channel → group opacity / wipe clip → subtree.
    #[allow(clippy::too_many_arguments)]
    fn record_visual_clip(
        &self,
        ir: &Ir,
        clip: &VisualClip,
        t: f64,
        cam_t: Transform,
        extra_channels: Vec<&Channel>,
        r: &mut Recorder,
        engine: &mut TextEngine,
    ) {
        let mut tf = if clip.screen_space {
            Transform::identity()
        } else {
            cam_t
        };
        // The transition wrap channel **does not go through §7.7's folding**: one clip may carry both an "in" on its left edge and an "out" on its right edge, and their offsets here are **accumulated one by one** (each taking endpoint value 0 outside its window). Changing it to replace folding would let the "out" endpoint 0 override the "in" animation. The transition recipes are a closed built-in set and do not accept author composites.
        //
        // Accumulation rule per channel (the identity element is the "endpoint value outside the window"):
        // `x`/`y` are added one by one, `scale` is multiplied one by one (identity 1), `clipInset*` take the max one by one (identity 0, so the wipes at both ends take the intersection). `opacity` is still **replace** — that is the semantics since stage 1; changing it to multiplication would alter pixels of already-published documents.
        let mut wrap_alpha = 1.0f64;
        let mut wrap_scale = 1.0f64;
        // Order: left, top, right, bottom (proportions of canvas size).
        let mut wrap_inset = [0.0f64; 4];
        for ch in clip.wrap_channels.iter().chain(extra_channels) {
            let v = sample_frames(&ch.frames, t);
            match ch.prop.as_str() {
                "x" => tf = compose(tf, translate(v.as_f64().unwrap_or(0.0), 0.0)),
                "y" => tf = compose(tf, translate(0.0, v.as_f64().unwrap_or(0.0))),
                "opacity" => wrap_alpha = v.as_f64().unwrap_or(1.0),
                "scale" => wrap_scale *= v.as_f64().unwrap_or(1.0),
                "clipInsetLeft" => wrap_inset[0] = wrap_inset[0].max(v.as_f64().unwrap_or(0.0)),
                "clipInsetTop" => wrap_inset[1] = wrap_inset[1].max(v.as_f64().unwrap_or(0.0)),
                "clipInsetRight" => wrap_inset[2] = wrap_inset[2].max(v.as_f64().unwrap_or(0.0)),
                "clipInsetBottom" => wrap_inset[3] = wrap_inset[3].max(v.as_f64().unwrap_or(0.0)),
                _ => {}
            }
        }
        if wrap_alpha <= 0.001 {
            return;
        }
        // Scaling is anchored at the **canvas center**: a transition is a matter for the whole picture, not for an element box.
        if wrap_scale != 1.0 {
            if wrap_scale.abs() < 0.0005 {
                return;
            }
            let (cx, cy) = (ir.w / 2.0, ir.h / 2.0);
            tf = compose(tf, translate(cx, cy));
            tf = compose(tf, scale_xy(wrap_scale, wrap_scale));
            tf = compose(tf, translate(-cx, -cy));
        }
        let wrap_clip = Self::wrap_clip_path(ir, wrap_inset);
        if matches!(wrap_clip, WrapClip::Empty) {
            return;
        }
        // The outer clip/opacity wraps the whole clip and is not split at child effects.
        let isolate = r.split
            && Self::subtree_has_effect(&clip.tree)
            && (wrap_alpha < 0.999 || matches!(wrap_clip, WrapClip::Path(_)));
        let mut isolated = Recorder::new(true);
        let target = if isolate { &mut isolated } else { &mut *r };
        let clipped = !isolate && matches!(&wrap_clip, WrapClip::Path(_));
        if clipped && let WrapClip::Path(path) = &wrap_clip {
            target.push_clip(path.clone(), mat(Transform::identity()));
        }
        let layered = !isolate && wrap_alpha < 0.999;
        if layered {
            target.push_layer(wrap_alpha as f32, BlendMode::Normal);
        }
        // `cadence` (spec §7.10) quantizes only the node sampling clock: clip activation, transition windows, camera and captions all use real time. Document-level default → clip-level → node-level, each overriding in turn.
        let mut clock = Clock::new(t, clip.render_start);
        if let Some(fps) = ir.cadence_fps {
            clock = clock.enter(Cadence::Fps(fps));
        }
        clock = clock.enter(clip.cadence);
        let ctx = ClipCtx {
            root: &clip.tree,
            clock,
            tf,
            skip_root: false,
            end: clip.render_end,
        };
        self.record_node(&clip.tree, clock, tf, ctx, target, engine);
        if layered {
            target.pop_layer();
        }
        if clipped {
            target.pop_clip();
        }
        if isolate {
            let masks = match wrap_clip {
                WrapClip::Path(path) => vec![(
                    Self::path_mask(path, Transform::identity()),
                    MatteMode::Alpha,
                )],
                _ => Vec::new(),
            };
            r.push_group(FrameLayer::Group {
                layers: isolated.finish().layers,
                masks,
                effects: Vec::new(),
                blend: BlendMode::Normal,
                opacity: wrap_alpha as f32,
            });
        }
    }

    /// Transition wipe channel (`clipInset*`, proportions of canvas size) → canvas-space rectangle path.
    fn wrap_clip_path(ir: &Ir, inset: [f64; 4]) -> WrapClip {
        if inset.iter().all(|value| *value <= 0.0) {
            return WrapClip::None;
        }
        let x0 = inset[0].clamp(0.0, 1.0) * ir.w;
        let y0 = inset[1].clamp(0.0, 1.0) * ir.h;
        let x1 = ir.w - inset[2].clamp(0.0, 1.0) * ir.w;
        let y1 = ir.h - inset[3].clamp(0.0, 1.0) * ir.h;
        if x1 <= x0 || y1 <= y0 {
            return WrapClip::Empty;
        }
        let Some(rect) = tiny_skia::Rect::from_ltrb(x0 as f32, y0 as f32, x1 as f32, y1 as f32)
        else {
            return WrapClip::Empty;
        };
        let mut pb = PathBuilder::new();
        pb.push_rect(rect);
        match pb.finish() {
            Some(path) => WrapClip::Path(path_from_skia(&path)),
            None => WrapClip::Empty,
        }
    }

    fn camera_transform(&self, ir: &Ir, t: f64) -> Transform {
        let mut cam = (0.0f64, 0.0f64, 1.0f64);
        for c in &ir.camera_clips {
            if t >= c.start && t <= c.end {
                let v = sample_frames(&c.frames, t);
                cam = (
                    v.gf64("x").unwrap_or(0.0),
                    v.gf64("y").unwrap_or(0.0),
                    v.gf64("zoom").unwrap_or(1.0),
                );
                break;
            }
        }
        if cam.2 == 1.0 && cam.0 == 0.0 && cam.1 == 0.0 {
            return Transform::identity();
        }
        let cx = ir.w / 2.0;
        let cy = ir.h / 2.0;
        let mut tf = Transform::identity();
        tf = compose(tf, translate(cx, cy));
        tf = compose(tf, translate(-cam.0 * cam.2, -cam.1 * cam.2));
        tf = compose(tf, scale_xy(cam.2, cam.2));
        tf = compose(tf, translate(-cx, -cy));
        tf
    }

    // ── Elements ──
    fn record_node(
        &self,
        node: &RNode,
        clock: Clock,
        parent: Transform,
        ctx: ClipCtx<'_>,
        r: &mut Recorder,
        engine: &mut TextEngine,
    ) {
        // An element named by `style.mask.source` is a mask definition and does not appear in the normal flow (spec §6.3); only `record_mask_source` draws it into the mask layer.
        if node.mask_source {
            return;
        }
        self.record_node_inner(node, clock, parent, ctx, r, engine);
    }

    /// Element's sampling clock and local→canvas transform at this tick. `None` = not drawn at this tick (opacity or scale is zero).
    ///
    /// Shared with [`Self::record_node_inner`]: the mask source's ancestor chain only needs the transform, not drawing.
    fn node_pose(&self, node: &RNode, clock: Clock, parent: Transform) -> Option<NodePose> {
        let clock = clock.enter(node.cadence);
        let t = clock.t;
        // Fixed order of spec §7.7: base → replace (larger order wins) → add summed → multiply product → attribute normalization. When neither add nor multiply participates, `scalar()` returns the replace value unchanged ⇒ the legacy four slots are bitwise unchanged ("the last channel wins").
        let pose = sample_channels(&node.channels, t);
        let tx = pose.scalar("x", 0.0);
        let ty = pose.scalar("y", 0.0);
        let s_base = pose.scalar("scale", node.base_scale);
        let sx = pose.scalar("scaleX", node.base_scale_x.unwrap_or(1.0)) * s_base;
        let sy = pose.scalar("scaleY", node.base_scale_y.unwrap_or(1.0)) * s_base;
        let rot = pose.scalar("rotation", node.base_rotation);
        // `skewX` / `skewY` (§6.4): CSS-convention angles, x' = x + tan(skewX)·y.
        let skx = pose.scalar("skewX", 0.0);
        let sky = pose.scalar("skewY", 0.0);
        let opacity = pose.scalar("opacity", node.base_opacity);

        if opacity <= 0.001 || sx.abs() < 0.0005 || sy.abs() < 0.0005 {
            return None;
        }

        let a = self.anchor_point(node);
        let inherited_anchor = (
            parent.sx as f64 * (node.frame.x + tx + a.0)
                + parent.kx as f64 * (node.frame.y + ty + a.1)
                + parent.tx as f64,
            parent.ky as f64 * (node.frame.x + tx + a.0)
                + parent.sy as f64 * (node.frame.y + ty + a.1)
                + parent.ty as f64,
        );
        let parent = if node.screen_size {
            let x = (parent.sx as f64).hypot(parent.ky as f64).max(1e-9) as f32;
            let y = (parent.kx as f64).hypot(parent.sy as f64).max(1e-9) as f32;
            Transform::from_row(
                parent.sx / x,
                parent.ky / x,
                parent.kx / y,
                parent.sy / y,
                parent.tx,
                parent.ty,
            )
        } else {
            parent
        };
        let mut tf = compose(parent, translate(node.frame.x + tx, node.frame.y + ty));
        if rot != 0.0 || sx != 1.0 || sy != 1.0 || skx != 0.0 || sky != 0.0 {
            let a = self.anchor_point(node);
            tf = compose(tf, translate(a.0, a.1));
            if rot != 0.0 {
                tf = compose(tf, Transform::from_rotate(rot as f32));
            }
            if skx != 0.0 || sky != 0.0 {
                tf = compose(
                    tf,
                    Transform::from_skew(
                        skx.to_radians().tan() as f32,
                        sky.to_radians().tan() as f32,
                    ),
                );
            }
            tf = compose(tf, scale_xy(sx, sy));
            tf = compose(tf, translate(-a.0, -a.1));
        }
        if node.screen_size {
            tf.tx = (inherited_anchor.0 - tf.sx as f64 * a.0 - tf.kx as f64 * a.1) as f32;
            tf.ty = (inherited_anchor.1 - tf.ky as f64 * a.0 - tf.sy as f64 * a.1) as f32;
        }
        Some(NodePose {
            clock,
            tf,
            opacity,
            blur: pose.scalar("blur", 0.0),
            pose,
        })
    }

    /// Follow sources are constrained to paths with no following ancestor, so
    /// computing their transform cannot recurse through another follow dependency.
    fn node_pose_in_context(
        &self,
        node: &RNode,
        clock: Clock,
        parent: Transform,
        ctx: ClipCtx<'_>,
    ) -> Option<NodePose> {
        let mut own = self.node_pose(node, clock, parent)?;
        let Some(follow) = &node.follow else {
            return Some(own);
        };
        let mut chain = Vec::new();
        if !find_node_chain(ctx.root, &follow.source, &mut chain) {
            return None;
        }
        let source = *chain.last()?;
        let (mut source_clock, mut source_tf) = (ctx.clock, ctx.tf);
        let mut source_pose = None;
        for target in chain.iter().skip(usize::from(ctx.skip_root)) {
            let pose = self.node_pose(target, source_clock, source_tf)?;
            source_clock = pose.clock;
            source_tf = pose.tf;
            source_pose = Some(pose);
        }
        let source_pose = source_pose?;
        let values = &source_pose.pose.values;
        let morph = values
            .get("pathMorph")
            .and_then(Value::as_f64)
            .unwrap_or(0.0);
        let morphed = morph_subpaths(source, morph);
        let base = morphed.as_ref().unwrap_or(&source.subpaths);
        let total = if morphed.is_some() {
            polyline_len(base)
        } else {
            source.total_len
        };
        let wobbled = wobble_paths(source, base, source_clock);
        let paths = wobbled.as_ref().unwrap_or(base);
        let interval = path_interval(source, values);
        let fraction = own
            .pose
            .get("pathProgress")
            .and_then(Value::as_f64)
            .unwrap_or_else(|| match follow.position {
                pathstyle::FollowPosition::Start => interval.0,
                pathstyle::FollowPosition::End => interval.1,
                pathstyle::FollowPosition::Progress(p) => p,
            })
            .clamp(0.0, 1.0);
        let (point, tangent) = scene_primitives::svgpath::point_at(paths, total * fraction)?;
        let map = |tf: Transform, p: (f64, f64)| {
            (
                tf.sx as f64 * p.0 + tf.kx as f64 * p.1 + tf.tx as f64,
                tf.ky as f64 * p.0 + tf.sy as f64 * p.1 + tf.ty as f64,
            )
        };
        let mut goal = map(source_tf, point);
        let offset = (
            follow.offset[0] + node.frame.x + own.pose.scalar("x", 0.0),
            follow.offset[1] + node.frame.y + own.pose.scalar("y", 0.0),
        );
        goal.0 += parent.sx as f64 * offset.0 + parent.kx as f64 * offset.1;
        goal.1 += parent.ky as f64 * offset.0 + parent.sy as f64 * offset.1;
        if follow.rotate {
            let direction = (
                source_tf.sx as f64 * tangent.0 + source_tf.kx as f64 * tangent.1,
                source_tf.ky as f64 * tangent.0 + source_tf.sy as f64 * tangent.1,
            );
            let desired = direction.1.atan2(direction.0).to_degrees()
                + own.pose.scalar("rotation", node.base_rotation);
            let current = (own.tf.ky as f64).atan2(own.tf.sx as f64).to_degrees();
            own.tf = compose(Transform::from_rotate((desired - current) as f32), own.tf);
        }
        let anchor = self.anchor_point(node);
        own.tf.tx = (goal.0 - own.tf.sx as f64 * anchor.0 - own.tf.kx as f64 * anchor.1) as f32;
        own.tf.ty = (goal.1 - own.tf.ky as f64 * anchor.0 - own.tf.sy as f64 * anchor.1) as f32;
        Some(own)
    }

    fn record_node_inner(
        &self,
        node: &RNode,
        clock: Clock,
        parent: Transform,
        ctx: ClipCtx<'_>,
        r: &mut Recorder,
        engine: &mut TextEngine,
    ) {
        if r.split
            && let Some(echo) = &node.echo
        {
            let shift = |clock: Clock, offset: f64| {
                let real = (clock.real + offset).clamp(clock.floor.min(ctx.end), ctx.end);
                let shifted = Clock::new(real, clock.floor);
                clock
                    .fps
                    .map_or(shifted, |fps| shifted.enter(Cadence::Fps(fps)))
            };
            let mut samples = Vec::new();
            for &(offset, weight) in &echo.samples {
                if weight == 0.0 {
                    continue;
                }
                let mut sample = Recorder::new(true);
                let shifted = shift(clock, offset);
                let shifted_ctx = ClipCtx {
                    clock: shift(ctx.clock, offset),
                    ..ctx
                };
                self.record_node_without_echo(
                    node,
                    shifted,
                    parent,
                    shifted_ctx,
                    &mut sample,
                    engine,
                );
                samples.push((sample.finish().layers, weight));
            }
            r.push_group(FrameLayer::Group {
                layers: vec![FrameLayer::Temporal {
                    samples,
                    mode: echo.mode,
                }],
                masks: Vec::new(),
                effects: Vec::new(),
                blend: node.blend,
                opacity: 1.0,
            });
        } else {
            self.record_node_without_echo(node, clock, parent, ctx, r, engine);
        }
    }

    fn record_node_without_echo(
        &self,
        node: &RNode,
        clock: Clock,
        parent: Transform,
        ctx: ClipCtx<'_>,
        r: &mut Recorder,
        engine: &mut TextEngine,
    ) {
        let Some(NodePose {
            clock,
            tf,
            opacity,
            blur,
            pose,
        }) = self.node_pose_in_context(node, clock, parent, ctx)
        else {
            return;
        };
        if node.composition.is_some() && (node.frame.w <= 0.0 || node.frame.h <= 0.0) {
            return;
        }
        // Read-only projection: borrowing is enough; do not deep-copy a map per node per frame.
        let count_meta = pose.count_meta.as_ref();
        let mut text_values = None;
        if node.ntype == "text"
            && pose.has_composition()
            && node.channels.iter().any(|c| {
                matches!(
                    c.prop.as_str(),
                    "fontWeight" | "letterSpacing" | "textReveal"
                )
            })
        {
            let mut values = pose.values.clone();
            let spacing = if node.text_wrap.is_some() {
                node.style
                    .get("letterSpacing")
                    .and_then(Value::as_f64)
                    .unwrap_or(0.0)
            } else {
                0.0
            };
            for (prop, base) in [
                ("fontWeight", node.font_weight as f64),
                ("letterSpacing", spacing),
                ("textReveal", 1.0),
            ] {
                values.insert(prop.into(), Value::from(pose.scalar(prop, base)));
            }
            text_values = Some(values);
        }
        let p = text_values.as_ref().unwrap_or(&pose.values);

        if r.split && !node.backdrop_effects.is_empty() {
            let mut masks = vec![(
                Self::path_mask(box_path(node.frame.w, node.frame.h), tf),
                MatteMode::Alpha,
            )];
            let clip_path = self.node_clip_path(node, p);
            if let Some(path) = clip_path {
                masks.push((Self::path_mask(path, tf), MatteMode::Alpha));
            }
            if let Some(mask) = &node.mask {
                let mut source = Recorder::new(true);
                self.record_mask_source(&mask.source, ctx, &mut source, engine);
                masks.push((source.finish().layers, Self::matte_mode(mask)));
            }
            r.push_group(FrameLayer::Backdrop {
                masks,
                effects: node.backdrop_effects.clone(),
                opacity: opacity as f32,
            });
        }

        // ── Effect stack (spec §6.6): this element and its subtree are first drawn into an offscreen surface ──
        //
        // The `blur` channel is equivalent to implicitly appending a `filter.blur` at the end of the effect stack; when it coexists with explicit entries they add (the `add` composition of §6.6). The radius is converted to a ratio against the canvas short edge, in the same convention as the manifest's `basis: canvasShortEdge`.
        let effects = self.effect_stack(node, blur, &pose);
        // This element's own word blur likewise requires recording inside an offscreen group (layer / clip stack empty).
        let descendants_fx =
            node.children.iter().any(Self::subtree_has_effect) || Self::has_part_blur(node);
        let mask_fx = node.mask.as_ref().is_some_and(|mask| {
            let mut chain = Vec::new();
            find_node_chain(ctx.root, &mask.source, &mut chain)
                && chain
                    .last()
                    .is_some_and(|source| Self::subtree_has_effect(source))
        });
        let has_clip = node.clip_poly.is_some() || Self::clip_shape_at(node, p).is_some();
        if r.split
            && (!effects.is_empty()
                || node.composition.is_some()
                || mask_fx
                || (descendants_fx
                    && (opacity < 0.999
                        || node.blend != BlendMode::Normal
                        || node.mask.is_some()
                        || has_clip)))
        {
            let mut sub = Recorder::new(true);
            self.record_node_content(node, clock, tf, p, count_meta, ctx, &mut sub, engine);
            let mut masks = Vec::new();
            if node.composition.is_some() {
                masks.push((
                    Self::path_mask(box_path(node.frame.w, node.frame.h), tf),
                    MatteMode::Alpha,
                ));
            }
            let clip_path = self.node_clip_path(node, p);
            if let Some(path) = clip_path {
                masks.push((Self::path_mask(path, tf), MatteMode::Alpha));
            }
            if let Some(mask) = &node.mask {
                let mut source = Recorder::new(true);
                self.record_mask_source(&mask.source, ctx, &mut source, engine);
                masks.push((source.finish().layers, Self::matte_mode(mask)));
            }
            r.push_group(FrameLayer::Group {
                layers: sub.finish().layers,
                masks,
                effects,
                blend: node.blend,
                opacity: opacity as f32,
            });
            return;
        }

        // Group opacity / blend mode: layer compositing. `blendMode ≠ normal` requires a layer even when fully opaque — blending is the semantics of "how this layer composites back onto the parent picture." `style.mask` also requires a layer: the mask folds in the alpha of "this layer."
        let layered = opacity < 0.999 || node.blend != BlendMode::Normal || node.mask.is_some();
        if layered {
            r.push_layer(opacity as f32, node.blend);
        }
        self.record_body(node, clock, tf, p, count_meta, ctx, r, engine);
        if layered {
            r.pop_layer();
        }
    }

    /// The element itself: clip → content and subtree → (`style.mask`) mask layer. The caller guarantees it is already inside a `PushLayer` (when masked).
    #[allow(clippy::too_many_arguments)]
    fn record_body(
        &self,
        node: &RNode,
        clock: Clock,
        tf: Transform,
        p: &Map<String, Value>,
        count_meta: Option<&Map<String, Value>>,
        ctx: ClipCtx<'_>,
        r: &mut Recorder,
        engine: &mut TextEngine,
    ) {
        if node.composition.is_some() {
            r.push_clip(box_path(node.frame.w, node.frame.h), mat(tf));
        }
        let clipped = self.record_clip(node, p, tf, r);
        self.record_node_content(node, clock, tf, p, count_meta, ctx, r, engine);
        if clipped {
            r.pop_clip();
        }
        if node.composition.is_some() {
            r.pop_clip();
        }
        if let Some(mask) = &node.mask {
            // Spec §6.3: `PushMatte` → mask source subtree → `PopMatte{mode}`, folded into this layer's alpha. The clip has already been paired and closed above and does not cross the layer boundary.
            r.b.push(DrawOp::PushMatte);
            self.record_mask_source(&mask.source, ctx, r, engine);
            let mode = match (mask.luma, mask.invert) {
                (false, false) => MatteMode::Alpha,
                (false, true) => MatteMode::AlphaInverted,
                (true, false) => MatteMode::Luma,
                (true, true) => MatteMode::LumaInverted,
            };
            r.b.push(DrawOp::PopMatte { mode: mode.code() });
        }
    }

    /// Draws the element pointed to by `style.mask.source` into the current (mask) layer.
    ///
    /// The mask source is rendered with **its own layout position and ancestor transforms**: from the clip root along the ancestor chain, compute each level's transform and clock at this tick; ancestors' opacity, clip and blend do not participate (the mask takes only alpha / luminance). If any level in the ancestor chain draws nothing at this tick, the mask is empty. The source subtree uses the same layered approach as the caller, allowing filters.
    fn record_mask_source(
        &self,
        source: &str,
        ctx: ClipCtx<'_>,
        r: &mut Recorder,
        engine: &mut TextEngine,
    ) {
        let mut chain: Vec<&RNode> = Vec::new();
        if !find_node_chain(ctx.root, source, &mut chain) {
            return;
        }
        let Some((target, ancestors)) = chain.split_last() else {
            return;
        };
        let mut clock = ctx.clock;
        let mut tf = ctx.tf;
        for ancestor in ancestors.iter().skip(usize::from(ctx.skip_root)) {
            let Some(pose) = self.node_pose_in_context(ancestor, clock, tf, ctx) else {
                return;
            };
            clock = pose.clock;
            tf = pose.tf;
        }
        self.record_node_inner(target, clock, tf, ctx, r, engine);
    }

    fn node_clip_path(&self, node: &RNode, p: &Map<String, Value>) -> Option<PathData> {
        if !p.get("clipPath").is_some_and(|value| !value.is_null())
            && let Some(poly) = &node.clip_poly
        {
            return Self::clip_poly_data(node, poly);
        }
        Self::clip_shape_at(node, p).and_then(|shape| Self::clip_path_data(node, shape))
    }

    fn subtree_has_effect(node: &RNode) -> bool {
        node.mask.is_some()
            || node.echo.is_some()
            || node.composition.is_some()
            || !node.backdrop_effects.is_empty()
            || !node.effects.is_empty()
            || node.channels.iter().any(|c| c.prop == "blur")
            || Self::has_part_blur(node)
            || node.children.iter().any(Self::subtree_has_effect)
    }

    /// `animate.parts` has a `blur` channel (§6.4 word blur).
    fn has_part_blur(node: &RNode) -> bool {
        node.part_motion.as_ref().is_some_and(|parts| {
            parts
                .channels
                .iter()
                .flatten()
                .any(|channel| channel.prop == "blur")
        })
    }

    /// Collapses the word-blur buckets into offscreen layers: one `filter.blur` layer per bucket (radius converted to a ratio against the canvas short edge, the same convention as the element-level `blur` channel), stacked over element content in order of first appearance.
    fn flush_part_blur(&self, buckets: PartBlurBuckets, r: &mut Recorder) {
        use motion::effect::{EffectRef, UniformMap, UniformValue};
        let short_edge = f64::from(self.width.min(self.height)).max(1.0);
        for (bits, builder) in buckets {
            let ops = builder.finish();
            if ops.ops.is_empty() {
                continue;
            }
            r.push_group(FrameLayer::Effect {
                ops,
                effects: vec![ResolvedEffect {
                    effect: EffectRef::new("filter.blur", 1),
                    uniforms: UniformMap::new().with(
                        "radius",
                        UniformValue::Scalar(f64::from_bits(bits) / short_edge),
                    ),
                }],
                blend: BlendMode::Normal,
                opacity: 1.0,
            });
        }
    }

    fn path_mask(path: PathData, tf: Transform) -> Vec<FrameLayer> {
        let mut b = FrameBuilder::default();
        let path = b.path_id(path);
        b.push(DrawOp::FillPath {
            path,
            color: [1.0; 4],
            tf: mat(tf),
        });
        vec![FrameLayer::Ops(b.finish())]
    }

    fn matte_mode(mask: &scene_primitives::resolve::ElementMask) -> MatteMode {
        match (mask.luma, mask.invert) {
            (false, false) => MatteMode::Alpha,
            (false, true) => MatteMode::AlphaInverted,
            (true, false) => MatteMode::Luma,
            (true, true) => MatteMode::LumaInverted,
        }
    }

    /// Effect stack effective at this tick. Empty ⇒ no offscreen surface needed.
    fn effect_stack(
        &self,
        node: &RNode,
        blur_px: f64,
        pose: &scene_primitives::sample::SampledPose,
    ) -> Vec<ResolvedEffect> {
        use motion::effect::{EffectRef, UniformValue};
        let short_edge = f64::from(self.width.min(self.height)).max(1.0);
        let extra = if blur_px > 0.0 {
            blur_px / short_edge
        } else {
            0.0
        };
        if node.effects.is_empty() && extra <= 0.0 {
            return Vec::new();
        }
        let mut stack = node.effects.clone();
        // Effect parameter channel `effects[N].<param>` (§6.6): the sampled value at this tick overrides the static parameter, then is clamped by the manifest's min/max. The overridden uniform enters the Filter pass and therefore also enters the frame fingerprint — animated frames are not deduplicated by FrameCache as the same frame.
        for channel in &node.channels {
            let Some((index, param)) = motion::value::effect_param_channel(&channel.prop) else {
                continue;
            };
            let Some(item) = stack.get_mut(index) else {
                continue;
            };
            let Ok(manifest) = motion::effect::lookup(&item.effect.id, item.effect.version) else {
                continue;
            };
            let Some(spec) = manifest.params.get(param) else {
                continue;
            };
            if !matches!(
                spec.kind,
                motion::effect::ParamKind::Number | motion::effect::ParamKind::Length
            ) {
                continue;
            }
            let base = item.uniforms.scalar(param).unwrap_or(0.0);
            let mut value = pose.scalar(&channel.prop, base);
            if !value.is_finite() {
                continue;
            }
            if let Some(min) = spec.min {
                value = value.max(min);
            }
            if let Some(max) = spec.max {
                value = value.min(max);
            }
            item.uniforms.insert(param, UniformValue::Scalar(value));
        }
        if extra > 0.0 {
            match stack
                .iter_mut()
                .find(|item| item.effect.id == "filter.blur")
            {
                // When they coexist ⇒ add (§6.6).
                Some(existing) => {
                    let base = existing.uniforms.scalar("radius").unwrap_or(0.0);
                    existing
                        .uniforms
                        .insert("radius", UniformValue::Scalar(base + extra));
                }
                None => stack.push(ResolvedEffect {
                    effect: EffectRef::new("filter.blur", 1),
                    uniforms: motion::effect::UniformMap::new()
                        .with("radius", UniformValue::Scalar(extra)),
                }),
            }
        }
        stack
    }

    /// `clipPath` (spec §6.3): the static `style.clipPath` is overridden by this tick's `clipPath` channel. Returns true when it emits `ClipPath`; the caller is responsible for the paired `PopClip`.
    fn record_clip(
        &self,
        node: &RNode,
        p: &Map<String, Value>,
        tf: Transform,
        r: &mut Recorder,
    ) -> bool {
        // Channel takes precedence: if the `clipPath` channel has a value at this tick, use it; otherwise the static `path` shape; otherwise the static parameterized shape.
        let channel_live = p.get("clipPath").is_some_and(|value| !value.is_null());
        if !channel_live
            && let Some(poly) = &node.clip_poly
            && let Some(path) = Self::clip_poly_data(node, poly)
        {
            r.push_clip(path, mat(tf));
            return true;
        }
        let Some(shape) = Self::clip_shape_at(node, p) else {
            return false;
        };
        let Some(path) = Self::clip_path_data(node, shape) else {
            return false;
        };
        r.push_clip(path, mat(tf));
        true
    }

    /// `path` shape (polyline in proportion to the element box) → local-coordinate path.
    ///
    /// `DrawOp::ClipPath` only has nonzero semantics; even-odd cannot be expressed here. The key is accepted at parse time to match the shape of `fillRule`; at recording time it is treated as nonzero, and lint warns.
    fn clip_poly_data(node: &RNode, poly: &ClipPoly) -> Option<PathData> {
        let (w, h) = (node.frame.w, node.frame.h);
        if w <= 0.0 || h <= 0.0 {
            return None;
        }
        let mut pb = PathBuilder::new();
        for sub in &poly.subpaths {
            pb.move_to((sub[0].0 * w) as f32, (sub[0].1 * h) as f32);
            for point in &sub[1..] {
                pb.line_to((point.0 * w) as f32, (point.1 * h) as f32);
            }
            pb.close();
        }
        Some(path_from_skia(&pb.finish()?))
    }

    fn clip_shape_at(node: &RNode, p: &Map<String, Value>) -> Option<ClipShape> {
        match p.get("clipPath") {
            // An invalid channel value is already an error at lint time (`schema` / `effect-capability-unsupported`); recording has no Result, so it falls back to the static shape rather than drawing incorrectly.
            Some(value) if !value.is_null() => {
                ClipShape::parse(value).ok().flatten().or(node.clip_shape)
            }
            _ => node.clip_shape,
        }
    }

    /// Shape (proportional to element box) → local-coordinate path. An identity clip returns `None`.
    fn clip_path_data(node: &RNode, shape: ClipShape) -> Option<PathData> {
        if shape.is_identity() {
            return None;
        }
        let (w, h) = (node.frame.w, node.frame.h);
        if w <= 0.0 || h <= 0.0 {
            return None;
        }
        let short = w.min(h);
        let mut pb = PathBuilder::new();
        match shape {
            ClipShape::Inset {
                top,
                right,
                bottom,
                left,
                radius,
            } => {
                let x0 = (left * w).max(0.0);
                let y0 = (top * h).max(0.0);
                let x1 = (w - right * w).min(w);
                let y1 = (h - bottom * h).min(h);
                if x1 <= x0 || y1 <= y0 {
                    // Fully clipped away: give a zero-area path; the element draws nothing at this tick.
                    pb.push_rect(tiny_skia::Rect::from_xywh(0.0, 0.0, 0.0, 0.0)?);
                    return Some(path_from_skia(&pb.finish()?));
                }
                let r = radius * short;
                if r > 0.0 {
                    // The rounded rectangle shares the same path construction as `FillRect{radius}`, so the clip edge and the background edge do not differ by half a pixel.
                    let path = crate::raster::rounded_rect_path(x0, y0, x1 - x0, y1 - y0, r)?;
                    return Some(path_from_skia(&path));
                }
                pb.push_rect(tiny_skia::Rect::from_ltrb(
                    x0 as f32, y0 as f32, x1 as f32, y1 as f32,
                )?);
            }
            ClipShape::Circle { cx, cy, r } => {
                let radius = (r * short) as f32;
                if radius <= 0.0 {
                    return None;
                }
                pb.push_circle((cx * w) as f32, (cy * h) as f32, radius);
            }
            ClipShape::Ellipse { cx, cy, rx, ry } => {
                let (a, bb) = ((rx * w) as f32, (ry * h) as f32);
                if a <= 0.0 || bb <= 0.0 {
                    return None;
                }
                let rect = tiny_skia::Rect::from_ltrb(
                    (cx * w) as f32 - a,
                    (cy * h) as f32 - bb,
                    (cx * w) as f32 + a,
                    (cy * h) as f32 + bb,
                )?;
                pb.push_oval(rect);
            }
        }
        Some(path_from_skia(&pb.finish()?))
    }

    fn record_node_background(
        node: &RNode,
        p: &Map<String, Value>,
        tf: Transform,
        b: &mut FrameBuilder,
    ) {
        let bg = Rgba::parse_value(p.get("backgroundColor")).or(node.bg_color);
        let radius = p
            .get("borderRadius")
            .and_then(Value::as_f64)
            .unwrap_or(node.border_radius);
        if let Some(bg) = bg {
            b.push(DrawOp::FillRect {
                x: 0.0,
                y: 0.0,
                w: node.frame.w as f32,
                h: node.frame.h as f32,
                radius: radius as f32,
                color: col(&bg, 1.0),
                tf: mat(tf),
            });
        } else if let Some(gradient) = &node.bg_gradient {
            // Gradient background (spec §6.3): rounded-rectangle path + paint side table, sharing the same path construction as `FillRect`, so the rounded edge does not differ from a solid background by half a pixel. When the `backgroundColor` channel has a value at this tick, the branch above has already drawn a solid color — the channel overrides the static gradient.
            Self::record_gradient_background(node, gradient, radius, tf, b);
        }
        if let Some(border) = &node.border {
            Self::record_border(node, border, radius, tf, b);
        }
    }

    /// `style.border` (§6.3): the outer ring is the element box's rounded rectangle, the inner ring is inset by `width`, and even-odd fills a ring; inner radius = outer radius (after capping at half the box's short edge) − width. When the stroke width exceeds half the box, the whole block is filled.
    fn record_border(
        node: &RNode,
        border: &BoxBorder,
        radius: f64,
        tf: Transform,
        b: &mut FrameBuilder,
    ) {
        let (w, h) = (node.frame.w, node.frame.h);
        if w <= 0.0 || h <= 0.0 {
            return;
        }
        let Some(outer) = crate::raster::rounded_rect_path(0.0, 0.0, w, h, radius) else {
            return;
        };
        let bw = border.width.min(w / 2.0).min(h / 2.0);
        let outer_r = radius.min(w.min(h) / 2.0).max(0.0);
        let mut pb = PathBuilder::new();
        pb.push_path(&outer);
        if let Some(inner) = crate::raster::rounded_rect_path(
            bw,
            bw,
            w - 2.0 * bw,
            h - 2.0 * bw,
            (outer_r - bw).max(0.0),
        ) {
            pb.push_path(&inner);
        }
        let Some(ring) = pb.finish() else {
            return;
        };
        let path = b.path_id(path_from_skia(&ring));
        let paint = b.paint_id(crate::drawop::PaintData::Solid(col(&border.color, 1.0)));
        b.push(DrawOp::FillPathPaint {
            path,
            paint,
            even_odd: true,
            tf: mat(tf),
        });
    }

    #[allow(clippy::too_many_arguments)]
    fn record_node_content(
        &self,
        node: &RNode,
        clock: Clock,
        tf: Transform,
        p: &Map<String, Value>,
        count_meta: Option<&Map<String, Value>>,
        ctx: ClipCtx<'_>,
        r: &mut Recorder,
        engine: &mut TextEngine,
    ) {
        if r.split
            && let Some(canvas) = &node.composition
        {
            let local_renderer = FrameRenderer {
                width: canvas.width as u32,
                height: canvas.height as u32,
                lotties: self.lotties.clone(),
                textures: self.textures.clone(),
                paints: self.paints.clone(),
                grid_cache: self.grid_cache.clone(),
            };
            let mut local_recorder = Recorder::new(true);
            Self::record_node_background(
                node,
                p,
                scale_xy(canvas.width / node.frame.w, canvas.height / node.frame.h),
                &mut local_recorder.b,
            );
            let elapsed = clock.real - node.media_win_start;
            let local = node
                .time_map
                .as_ref()
                .map_or(elapsed, |map| map.sample(elapsed))
                .clamp(0.0, canvas.duration);
            let mut local_clock = Clock::new(local, 0.0);
            if let Some(fps) = clock.fps {
                local_clock = local_clock.enter(Cadence::Fps(fps));
            }
            let camera = sample_frames(&node.local_camera, local);
            let (x, y, zoom) = (
                camera.gf64("x").unwrap_or(0.0),
                camera.gf64("y").unwrap_or(0.0),
                camera.gf64("zoom").unwrap_or(1.0),
            );
            let camera_tf = compose(
                compose(
                    translate(
                        canvas.width / 2.0 - x * zoom,
                        canvas.height / 2.0 - y * zoom,
                    ),
                    scale_xy(zoom, zoom),
                ),
                translate(-canvas.width / 2.0, -canvas.height / 2.0),
            );
            let local_ctx = ClipCtx {
                root: node,
                clock: local_clock,
                tf: camera_tf,
                skip_root: true,
                end: canvas.duration,
            };
            for child in &node.children {
                local_renderer.record_node(
                    child,
                    local_clock,
                    camera_tf,
                    local_ctx,
                    &mut local_recorder,
                    engine,
                );
            }
            r.push_group(FrameLayer::LocalCanvas {
                layers: local_recorder.finish().layers,
                width: canvas.width as u32,
                height: canvas.height as u32,
                tf: mat(compose(
                    tf,
                    scale_xy(node.frame.w / canvas.width, node.frame.h / canvas.height),
                )),
            });
            return;
        }
        // Word blur (§6.4): an offscreen group can only be started when recording is layered and there are no unclosed ancestor layers / clips; the caller (the Group criterion of `record_node_without_echo`) guarantees that an element with part blur and its ancestors have already switched to offscreen groups where needed, so the stack here is empty.
        let mut part_blur =
            (r.split && r.stack.is_empty() && Self::has_part_blur(node)).then(PartBlurBuckets::new);
        let b = &mut r.b;
        let t = clock.t;
        Self::record_node_background(node, p, tf, b);

        match node.ntype.as_str() {
            "text" => self.record_text(node, t, p, count_meta, tf, b, part_blur.as_mut(), engine),
            "charGrid" => {
                self.record_char_grid(node, (t - node.media_win_start).max(0.0), tf, b, engine)
            }
            // Procedural source (§6.12): closed-form evaluation in local seconds, quantized by `cadence` (same as charGrid).
            "proc" => {
                if let Some(proc) = &node.proc {
                    crate::source::proc::record_proc(
                        proc,
                        node.frame.w,
                        node.frame.h,
                        (t - node.media_win_start).max(0.0),
                        tf,
                        b,
                    );
                }
            }
            "path" => self.record_path(node, p, clock, tf, b),
            // Media with its own timeline: not quantized by `cadence` (spec §7.10).
            "image" | "animatedImage" | "program" | "video" => {
                self.record_media(node, clock.real, p, tf, b)
            }
            "lottie" => self.record_lottie(node, clock.real, tf, b),
            _ => {}
        }
        if let Some(buckets) = part_blur {
            self.flush_part_blur(buckets, r);
        }
        if let Some(canvas) = &node.composition {
            let elapsed = clock.real - node.media_win_start;
            let local = node
                .time_map
                .as_ref()
                .map_or(elapsed, |map| map.sample(elapsed))
                .clamp(0.0, canvas.duration);
            let mut local_clock = Clock::new(local, 0.0);
            if let Some(fps) = clock.fps {
                local_clock = local_clock.enter(Cadence::Fps(fps));
            }
            let camera = sample_frames(&node.local_camera, local);
            let (x, y, zoom) = (
                camera.gf64("x").unwrap_or(0.0),
                camera.gf64("y").unwrap_or(0.0),
                camera.gf64("zoom").unwrap_or(1.0),
            );
            let mut child_tf = compose(
                tf,
                scale_xy(node.frame.w / canvas.width, node.frame.h / canvas.height),
            );
            child_tf = compose(
                child_tf,
                translate(
                    canvas.width / 2.0 - x * zoom,
                    canvas.height / 2.0 - y * zoom,
                ),
            );
            child_tf = compose(child_tf, scale_xy(zoom, zoom));
            child_tf = compose(
                child_tf,
                translate(-canvas.width / 2.0, -canvas.height / 2.0),
            );
            let local_ctx = ClipCtx {
                root: node,
                clock: local_clock,
                tf: child_tf,
                skip_root: true,
                end: canvas.duration,
            };
            for child in &node.children {
                self.record_node(child, local_clock, child_tf, local_ctx, r, engine);
            }
        } else {
            for child in &node.children {
                self.record_node(child, clock, tf, ctx, r, engine);
            }
        }
    }

    fn record_char_grid(
        &self,
        node: &RNode,
        time: f64,
        tf: Transform,
        b: &mut FrameBuilder,
        engine: &mut TextEngine,
    ) {
        let Some(grid) = &node.char_grid else {
            return;
        };
        struct Glyph {
            path: Option<tiny_skia::Path>,
            width: f64,
            ascent: f64,
            descent: f64,
        }
        let mut glyphs = std::collections::HashMap::<&str, Glyph>::new();
        for layer in &grid.layers {
            let cells = grid.sample_layer(layer, time);
            let mut key = Vec::new();
            key.extend(node.font_family.as_bytes());
            key.push(0);
            for n in [
                node.font_size,
                grid.cell_width,
                grid.cell_height,
                grid.cols as f64,
            ] {
                key.extend(n.to_le_bytes());
            }
            key.extend(node.font_weight.to_le_bytes());
            key.push(u8::from(node.font_italic));
            for cell in &cells {
                if let Some(text) = cell {
                    key.push(1);
                    key.extend(text.as_bytes());
                } else {
                    key.push(0);
                }
                key.push(0);
            }
            let key = crate::drawop::fnv1a64(&key);
            if let Some(path) = self.grid_cache.get(key) {
                let path = b.path_id(path.as_ref().clone());
                b.push(DrawOp::FillPath {
                    path,
                    color: col(&layer.color, 1.0),
                    tf: mat(tf),
                });
                continue;
            }
            let mut batch = PathBuilder::new();
            for (index, text) in cells
                .into_iter()
                .enumerate()
                .filter_map(|(i, c)| c.map(|s| (i, s)))
            {
                if text.chars().all(char::is_whitespace) {
                    continue;
                }
                let glyph = glyphs.entry(text).or_insert_with(|| {
                    if let Some(path) =
                        cell_symbol(text, grid.cell_width, grid.cell_height, node.font_size)
                    {
                        return Glyph {
                            path: Some(path),
                            width: grid.cell_width,
                            ascent: grid.cell_height,
                            descent: 0.0,
                        };
                    }
                    let shaped = engine.shape_styled(
                        text,
                        &node.font_family,
                        node.font_size,
                        node.font_weight,
                        node.font_italic,
                    );
                    let mut path = PathBuilder::new();
                    for glyph in &shaped.glyphs {
                        if let Some(outline) = engine
                            .glyph_path(glyph.cache_key)
                            .and_then(|path| path.transform(translate(glyph.x, glyph.y)))
                        {
                            path.push_path(&outline);
                        }
                    }
                    Glyph {
                        path: path.finish(),
                        width: shaped.width,
                        ascent: shaped.ascent,
                        descent: shaped.descent,
                    }
                });
                let Some(path) = &glyph.path else {
                    continue;
                };
                let scale = (grid.cell_width / glyph.width.max(1.0))
                    .min(grid.cell_height / (glyph.ascent + glyph.descent).max(1.0))
                    .min(1.0);
                let x = (index % grid.cols) as f64 * grid.cell_width
                    + (grid.cell_width - glyph.width * scale) / 2.0;
                let baseline = (index / grid.cols) as f64 * grid.cell_height
                    + (grid.cell_height - (glyph.ascent + glyph.descent) * scale) / 2.0
                    + glyph.ascent * scale;
                if let Some(outline) = path
                    .clone()
                    .transform(compose(translate(x, baseline), scale_xy(scale, scale)))
                {
                    batch.push_path(&outline);
                }
            }
            if let Some(path) = batch.finish() {
                let path = Arc::new(path_from_skia(&path));
                self.grid_cache.put(key, path.clone());
                let path = b.path_id(path.as_ref().clone());
                b.push(DrawOp::FillPath {
                    path,
                    color: col(&layer.color, 1.0),
                    tf: mat(tf),
                });
            }
        }
    }

    fn anchor_point(&self, node: &RNode) -> (f64, f64) {
        let (w, h) = (node.frame.w, node.frame.h);
        if let Some((x, y)) = node.anchor_xy {
            return (x * w, y * h);
        }
        match node.anchor.as_str() {
            "bottom" => (w / 2.0, h),
            "top" => (w / 2.0, 0.0),
            _ => (w / 2.0, h / 2.0),
        }
    }

    // ── Media nodes (image / video): only the reference is recorded; the bytes enter at the rasterization stage ──
    fn record_media(
        &self,
        node: &RNode,
        t: f64,
        p: &Map<String, Value>,
        tf: Transform,
        b: &mut FrameBuilder,
    ) {
        let Some(id) = &node.asset_id else { return };
        if node.nat_w <= 0.0 || node.nat_h <= 0.0 {
            return; // Metadata not injected (already reported at lint/load stage; defensive here)
        }
        let mut bounds = [
            f64::INFINITY,
            f64::INFINITY,
            f64::NEG_INFINITY,
            f64::NEG_INFINITY,
        ];
        for (x, y) in [
            (0.0, 0.0),
            (node.frame.w, 0.0),
            (0.0, node.frame.h),
            (node.frame.w, node.frame.h),
        ] {
            let (x, y) = (
                tf.sx as f64 * x + tf.kx as f64 * y + tf.tx as f64,
                tf.ky as f64 * x + tf.sy as f64 * y + tf.ty as f64,
            );
            bounds[0] = bounds[0].min(x);
            bounds[1] = bounds[1].min(y);
            bounds[2] = bounds[2].max(x);
            bounds[3] = bounds[3].max(y);
        }
        if bounds[2] < 0.0
            || bounds[3] < 0.0
            || bounds[0] > self.width as f64
            || bounds[1] > self.height as f64
        {
            return;
        }
        let media_ms: i64 = match node.ntype.as_str() {
            "video" => (Self::video_src_time(node, t) * 1000.0).round() as i64,
            // `program` (§6.5.3) shares the same frame-table semantics as animated images: frame start ms generated from the declared fps.
            "animatedImage" | "program" => Self::animated_src_ms(node, t),
            _ => -1,
        };
        // Natural size → layout box (§6.5 fit; image keeps its existing stretch semantics = fill)
        let framing = node.media_crop.is_some()
            || node.media_focal.is_some()
            || ["crop", "focalX", "focalY"]
                .iter()
                .any(|key| p.contains_key(*key));
        let (s, src) = if framing {
            Self::framed_media_transform(node, p)
        } else if node.ntype == "image" {
            (
                scale_xy(node.frame.w / node.nat_w, node.frame.h / node.nat_h),
                [0.0f32; 4],
            )
        } else {
            Self::fit_transform(node)
        };
        let asset = b.string_id(id);
        b.push(DrawOp::DrawMedia {
            asset,
            media_ms,
            src,
            tf: mat(compose(tf, s)),
        });
    }

    /// §6.5 frame-accurate sampling: srcTime = mediaStart + (t − clip.start) × rate, after segment/loop folding quantized to the frame start at the source frame rate; out-of-range clamped to the last frame (frozen).
    fn video_src_time(node: &RNode, t: f64) -> f64 {
        let mut src = node.time_map.as_ref().map_or_else(
            || node.media_start + (t - node.media_win_start) * node.playback_rate,
            |map| map.sample(t - node.media_win_start),
        );
        if let Some((s0, s1)) = node.segment {
            if node.loop_media && s1 > s0 {
                src = s0 + (src - s0).rem_euclid(s1 - s0);
            } else {
                src = src.min(s1); // Freezes at the end of the segment
            }
        } else if node.loop_media && node.media_duration > 0.0 {
            src = src.rem_euclid(node.media_duration);
        }
        src = src.max(0.0);
        if node.media_fps > 0.0 {
            // frameIndex = clamp(floor(srcTime × fps + ε), 0, N−1); no upper bound when N is unknown
            let mut idx = (src * node.media_fps + 1e-9).floor();
            if node.media_duration > 0.0 {
                let n = (node.media_duration * node.media_fps).round().max(1.0);
                idx = idx.clamp(0.0, n - 1.0);
            } else {
                idx = idx.max(0.0);
            }
            src = idx / node.media_fps;
        } else if node.media_duration > 0.0 {
            src = src.min(node.media_duration);
        }
        src
    }

    /// §6.5.1 animated image sampling: the source time formula is isomorphic to video (`srcTime = mediaStart + (t − clip.start) × rate`), except that "quantize by source frame rate" becomes "quantize by per-frame duration table," and looping folds by **number of playback passes**.
    ///
    /// Returns the **frame start ms** of that frame: all moments within the same frame window therefore emit byte-identical `DrawMedia`, so the still-frame cache and frame fingerprint can hit.
    fn animated_src_ms(node: &RNode, t: f64) -> i64 {
        let table = &node.frame_starts_ms;
        let n = table.len().saturating_sub(1);
        if n == 0 {
            return 0; // Metadata not injected (already reported at load stage; defensive here)
        }
        let total = table[n] as f64 / 1000.0;
        let (s0, s1) = match node.segment {
            Some((a, b)) => (a.min(total), b.min(total)),
            None => (0.0, total),
        };
        let mut src = node.time_map.as_ref().map_or_else(
            || node.media_start + (t - node.media_win_start) * node.playback_rate,
            |map| map.sample(t - node.media_win_start),
        );
        let span = s1 - s0;
        let elapsed = src - s0;
        if node.time_map.is_none() && span > 0.0 && elapsed >= 0.0 {
            // plays = 0 → infinite loop; otherwise after playing `plays` passes, freeze at the end of the segment
            if node.media_plays == 0 || elapsed < span * f64::from(node.media_plays) {
                src = s0 + elapsed.rem_euclid(span);
            } else {
                src = s1;
            }
        }
        // The frame table is built as `round(k·1000/fps)`, so starts may land exactly on half-milliseconds (frame 15 at 29.97 fps is 500.5 ms, frame 3 at 48 fps is 62.5 ms); when the clip does not start at 0, floating-point error in `t - start` can put it at 500.4999… and round down to the previous frame. A tolerance of 1 ns absorbs this kind of error.
        let ms = (src.clamp(0.0, total) * 1000.0 + 1e-6).round() as i64;
        crate::source::frame_start_ms(table, ms)
    }

    /// Vector source (`lottie`, §6.5.2): does not emit `DrawMedia`; instead **inlines** the subset renderer's instructions into this frame's instruction stream. Vector content therefore scales with the element box, rather than being baked into a bitmap at the asset's native size and then stretched.
    ///
    /// Source time semantics are identical to animated images (`animated_src_ms`): after `loop` / `segment` / `playbackRate` folding, quantized to the frame start on the composition frame table; within the same frame window identical byte instructions are emitted, so the still-frame cache hits as usual.
    fn record_lottie(&self, node: &RNode, t: f64, tf: Transform, b: &mut FrameBuilder) {
        let Some(id) = &node.asset_id else { return };
        let Some(lottie) = self.lotties.get(id) else {
            return; // `new_with_assets` already fails fast; this is only defensive
        };
        if node.nat_w <= 0.0 || node.nat_h <= 0.0 {
            return;
        }
        let ms = Self::animated_src_ms(node, t);
        let (fit, clip_to_box) = Self::vector_fit(node);
        let inner = compose(tf, fit);
        if clip_to_box {
            // For cover, the picture is larger than the box: a vector has no "source crop rectangle" to use, so crop the box itself instead
            let path = b.path_id(box_path(node.frame.w, node.frame.h));
            b.push(DrawOp::ClipPath { path, tf: mat(tf) });
        }
        // `record` only fails when a child resource is missing, and `load_assets` has already caught that
        let _ = lottie.record(MediaTime::from_millis(ms), inner, b);
        if clip_to_box {
            b.push(DrawOp::PopClip);
        }
    }

    /// Fit (§6.5) for vector sources. Returns (transform, whether the picture must be cropped back to the element box).
    ///
    /// Differs from [`FrameRenderer::fit_transform`] only in `cover`: the bitmap path crops the overflow from the **source pixels**; a vector has no source pixels, so it can only center and then crop the box.
    fn vector_fit(node: &RNode) -> (Transform, bool) {
        let (nw, nh) = (node.nat_w, node.nat_h);
        let (bw, bh) = (node.frame.w, node.frame.h);
        match node.fit {
            scene_primitives::Fit::Fill => (scale_xy(bw / nw, bh / nh), false),
            scene_primitives::Fit::Contain | scene_primitives::Fit::Cover => {
                let cover = matches!(node.fit, scene_primitives::Fit::Cover);
                let s = if cover {
                    (bw / nw).max(bh / nh)
                } else {
                    (bw / nw).min(bh / nh)
                };
                let tf = compose(
                    translate((bw - nw * s) / 2.0, (bh - nh * s) / 2.0),
                    scale_xy(s, s),
                );
                (tf, cover)
            }
        }
    }

    fn framed_media_transform(node: &RNode, p: &Map<String, Value>) -> (Transform, [f32; 4]) {
        let mut crop = node.media_crop.unwrap_or([0.0, 0.0, 1.0, 1.0]);
        if let Some(animated) = p.get("crop") {
            for (i, key) in ["x", "y", "width", "height"].iter().enumerate() {
                crop[i] = animated
                    .get(*key)
                    .and_then(Value::as_f64)
                    .unwrap_or(crop[i]);
            }
        }
        crop[2] = crop[2].clamp(1e-6, 1.0);
        crop[3] = crop[3].clamp(1e-6, 1.0);
        crop[0] = crop[0].clamp(0.0, 1.0 - crop[2]);
        crop[1] = crop[1].clamp(0.0, 1.0 - crop[3]);
        let base = node.media_focal.unwrap_or([0.5, 0.5]);
        let fx = p
            .get("focalX")
            .and_then(Value::as_f64)
            .unwrap_or(base[0])
            .clamp(0.0, 1.0);
        let fy = p
            .get("focalY")
            .and_then(Value::as_f64)
            .unwrap_or(base[1])
            .clamp(0.0, 1.0);
        let (x, y, w, h) = (
            crop[0] * node.nat_w,
            crop[1] * node.nat_h,
            crop[2] * node.nat_w,
            crop[3] * node.nat_h,
        );
        let (bw, bh) = (node.frame.w, node.frame.h);
        let rect = |x, y, w, h| [x as f32, y as f32, w as f32, h as f32];
        match node.fit {
            scene_primitives::Fit::Fill => (scale_xy(bw / w, bh / h), rect(x, y, w, h)),
            scene_primitives::Fit::Contain => {
                let scale = (bw / w).min(bh / h);
                (
                    compose(
                        translate((bw - w * scale) * fx, (bh - h * scale) * fy),
                        scale_xy(scale, scale),
                    ),
                    rect(x, y, w, h),
                )
            }
            scene_primitives::Fit::Cover => {
                let scale = (bw / w).max(bh / h);
                let (vw, vh) = (bw / scale, bh / scale);
                (
                    scale_xy(scale, scale),
                    rect(x + (w - vw) * fx, y + (h - vh) * fy, vw, vh),
                )
            }
        }
    }

    /// §6.5 fit: transform from natural size to layout box + the source crop rectangle for cover.
    fn fit_transform(node: &RNode) -> (Transform, [f32; 4]) {
        let (nw, nh) = (node.nat_w, node.nat_h);
        let (bw, bh) = (node.frame.w, node.frame.h);
        match node.fit {
            scene_primitives::Fit::Fill => (scale_xy(bw / nw, bh / nh), [0.0; 4]),
            scene_primitives::Fit::Contain => {
                let s = (bw / nw).min(bh / nh);
                let tf = compose(
                    translate((bw - nw * s) / 2.0, (bh - nh * s) / 2.0),
                    scale_xy(s, s),
                );
                (tf, [0.0; 4])
            }
            scene_primitives::Fit::Cover => {
                let s = (bw / nw).max(bh / nh);
                // Crop the out-of-box area on the source side: visible source area = box size / s, centered
                let (vw, vh) = (bw / s, bh / s);
                let (sx, sy) = ((nw - vw) / 2.0, (nh - vh) / 2.0);
                let src = [sx as f32, sy as f32, vw as f32, vh as f32];
                (scale_xy(s, s), src)
            }
        }
    }

    // ── Text (including countUp number rolling, text part animation) ──
    #[allow(clippy::too_many_arguments)]
    fn record_text(
        &self,
        node: &RNode,
        t: f64,
        p: &Map<String, Value>,
        count_meta: Option<&Map<String, Value>>,
        tf: Transform,
        b: &mut FrameBuilder,
        mut blurred: Option<&mut PartBlurBuckets>,
        engine: &mut TextEngine,
    ) {
        let mut string = p
            .get("text")
            .and_then(Value::as_str)
            .map(str::to_owned)
            .unwrap_or_else(|| node.text.clone().unwrap_or_default());
        let weight = p
            .get("fontWeight")
            .and_then(Value::as_f64)
            .map(|weight| weight.round().clamp(1.0, 1000.0) as u16)
            .unwrap_or(node.font_weight);
        let reveal = p
            .get("textReveal")
            .and_then(Value::as_f64)
            .unwrap_or(1.0)
            .clamp(0.0, 1.0);
        if let Some(count) = p.get("textCount").and_then(Value::as_f64) {
            string = fmt_count(count, count_meta);
        }
        let mut color = node.text_color;
        if let Some(cs) = p.get("color").and_then(Value::as_str) {
            if let Some(c) = Rgba::parse(cs) {
                color = c;
            }
        }
        if let Some(base_block) = &node.text_block {
            let base_spacing = node
                .style
                .get("letterSpacing")
                .and_then(Value::as_f64)
                .unwrap_or(0.0);
            let spacing = p
                .get("letterSpacing")
                .or_else(|| node.style.get("letterSpacing"))
                .and_then(Value::as_f64)
                .unwrap_or(0.0);
            let base = scene_primitives::text_layout::FontStyle {
                family: &node.font_family,
                size: node.font_size,
                weight,
                italic: node.font_italic,
                spacing,
            };
            let changed_block;
            let block = if node.text.as_deref() == Some(string.as_str()) {
                base_block
            } else {
                changed_block = scene_primitives::text_layout::layout(
                    &string,
                    node.text_wrap.unwrap(),
                    node.style.get("width").and_then(Value::as_f64),
                    base_block.line_height,
                    |range| {
                        let shaped = engine.shape_spaced(
                            &string[range],
                            &node.font_family,
                            node.font_size,
                            node.font_weight,
                            node.font_italic,
                            base_spacing,
                        );
                        scene_primitives::layout::TextMetricsLine {
                            width: shaped.width,
                            ascent: shaped.ascent,
                            descent: shaped.descent,
                        }
                    },
                );
                &changed_block
            };
            let reveal_end = text_reveal_end(&string, node.split, reveal, Some(block));
            let top = (node.frame.h - block.height) / 2.0;
            for line in &block.lines {
                let runs = if node.text.as_deref() == Some(string.as_str()) {
                    node.text_runs.as_slice()
                } else {
                    &[]
                };
                let shaped =
                    engine.shape_rich(&string, line.bytes.start..line.paint_end, base, runs);
                let x = match node
                    .style
                    .get("textAlign")
                    .and_then(Value::as_str)
                    .unwrap_or("center")
                {
                    "left" => 0.0,
                    "right" => node.frame.w - shaped.width,
                    _ => (node.frame.w - shaped.width) / 2.0,
                };
                let baseline = top
                    + line.offset
                    + (line.line_height - line.metrics.ascent - line.metrics.descent) / 2.0
                    + line.metrics.ascent;
                let parts = node
                    .part_motion
                    .as_ref()
                    .filter(|_| node.text.as_deref() == Some(string.as_str()));
                self.record_text_parts(
                    parts,
                    runs,
                    node,
                    reveal_end,
                    &shaped,
                    x,
                    baseline,
                    &color,
                    t,
                    tf,
                    b,
                    blurred.as_deref_mut(),
                    engine,
                );
            }
            return;
        }
        let mut shaped = engine.shape_spaced(
            &string,
            &node.font_family,
            node.font_size,
            weight,
            node.font_italic,
            p.get("letterSpacing")
                .and_then(Value::as_f64)
                .unwrap_or(0.0),
        );
        let reveal_end = text_reveal_end(&string, node.split, reveal, None);
        // Horizontally centered on the layout box (stays centered when a countUp text widens, consistent with DOM behaviour)
        let x = (node.frame.w - shaped.width) / 2.0;
        let box_h = node.frame.h;
        let baseline = (box_h - (shaped.ascent + shaped.descent)) / 2.0 + shaped.ascent;
        // The part map for part animation is cut by `node.text`; when `countUp` replaces the entire string that map no longer holds, so it falls back to drawing the whole string.
        match &node.part_motion {
            Some(part_motion) if node.text.as_deref() == Some(string.as_str()) => self
                .record_text_parts(
                    Some(part_motion),
                    &[],
                    node,
                    reveal_end,
                    &shaped,
                    x,
                    baseline,
                    &color,
                    t,
                    tf,
                    b,
                    blurred,
                    engine,
                ),
            _ if node.text_stroke.is_some() => self.record_text_parts(
                None,
                &[],
                node,
                reveal_end,
                &shaped,
                x,
                baseline,
                &color,
                t,
                tf,
                b,
                None,
                engine,
            ),
            _ => {
                shaped
                    .glyphs
                    .retain(|glyph| glyph.cluster.start < reveal_end);
                self.record_shaped(&shaped, x, baseline, &color, 1.0, tf, b, engine)
            }
        }
    }

    /// Per-part sampling and drawing (spec §7.9, design §5.6).
    ///
    /// **Same semantics** as `studio_export/raster.rs::chunk_part_delta`: part `opacity` is clamped to `[0,1]`, `x`/`y` are offsets, and absent parts take `(1, 0, 0)`.
    /// The differences between the two are only two, both written in design §15 stage 3: ① studio_export applies the delta per chunk, here per glyph (glyphs of the same part take the same delta, so it is equivalent); ② studio_export shapes each piece separately, here the whole string is shaped once ⇒ cross-part kerning and ligatures are preserved.
    ///
    /// **Does not change layout**: it only adds translate / scale / alpha; `node.frame` does not participate.
    #[allow(clippy::too_many_arguments)]
    fn record_text_parts(
        &self,
        part_motion: Option<&PartMotion>,
        runs: &[scene_primitives::text_layout::Run],
        node: &RNode,
        reveal_end: usize,
        shaped: &ShapedLine,
        x0: f64,
        baseline: f64,
        color: &Rgba,
        t: f64,
        tf: Transform,
        b: &mut FrameBuilder,
        mut blurred: Option<&mut PartBlurBuckets>,
        engine: &mut TextEngine,
    ) {
        let count = part_motion.map_or(0, |parts| parts.map.len());
        // The part's horizontal anchor: the midpoint between the x of this part's first glyph and the x of the next part's first glyph. `ShapedGlyph` carries no advance, so using "the start of the next part" needs no new metrics and is visually correct for scale (the last part uses the full line width).
        let mut left: Vec<Option<f64>> = vec![None; count];
        for glyph in &shaped.glyphs {
            if let Some(part) = part_motion.and_then(|parts| parts.map.part_of(glyph.cluster.start))
            {
                let entry = &mut left[part];
                if entry.is_none_or(|seen| glyph.x < seen) {
                    *entry = Some(glyph.x);
                }
            }
        }
        // All glyphs of the same part share one delta and one anchor ⇒ precomputed once per part; the glyph loop only does table lookups. This saves both one `sample_channels` per glyph and the linear right-scan of `anchor`. Sampling happens only for parts where glyphs of this line actually fall (`left[i].is_some()` corresponds one-to-one with the set hit by `part_of` in the glyph loop), so the sampled set is identical to the per-glyph version.
        //
        // `end` = the first `Some` in `left[i + 1..]`, otherwise the full line width ⇒ a single right-to-left pass recurrence.
        let mut table: Vec<Option<PartPose>> = vec![None; count];
        let mut next_left = shaped.width;
        for index in (0..count).rev() {
            let Some(start) = left[index] else { continue };
            let pose = sample_channels(&part_motion.expect("part table exists").channels[index], t);
            let range = &part_motion.unwrap().map.ranges[index];
            let part_reveal = pose.scalar("textReveal", 1.0).clamp(0.0, 1.0);
            let part_reveal_end = if part_reveal >= 1.0 {
                usize::MAX
            } else {
                range.start
                    + text_reveal_end(
                        &node.text.as_deref().unwrap_or("")[range.clone()],
                        None,
                        part_reveal,
                        None,
                    )
            };
            table[index] = Some(PartPose {
                opacity: clamp(pose.scalar("opacity", 1.0), 0.0, 1.0),
                dx: pose.scalar("x", 0.0),
                dy: pose.scalar("y", 0.0),
                scale: pose.scalar("scale", 1.0),
                anchor: x0 + (start + next_left) / 2.0,
                color: Rgba::parse_value(pose.get("color")),
                reveal_end: part_reveal_end,
                blur: pose.scalar("blur", 0.0).max(0.0),
            });
            next_left = start;
        }

        let paint_passes = if node.text_stroke.is_some() { 2 } else { 1 };
        for paint_pass in 0..paint_passes {
            for glyph in &shaped.glyphs {
                if glyph.cluster.start >= reveal_end {
                    continue;
                }
                let part = part_motion
                    .and_then(|parts| parts.map.part_of(glyph.cluster.start))
                    .and_then(|index| table[index]);
                let PartPose {
                    opacity,
                    dx,
                    dy,
                    scale,
                    anchor,
                    color: part_color,
                    reveal_end: part_reveal_end,
                    blur,
                } = part.unwrap_or(PartPose::IDENTITY);
                if glyph.cluster.start >= part_reveal_end {
                    continue;
                }
                if opacity <= 0.001 || scale.abs() < 0.0005 {
                    continue;
                }
                // A blurring part is drawn into the bucket of its own radius; with no bucket (flat recording, or ancestor scope not yet collapsed) it is inlined as-is, degrading to no blur.
                let b: &mut FrameBuilder = match blurred.as_deref_mut() {
                    Some(buckets) if blur > 0.0 => part_blur_bucket(buckets, blur),
                    _ => &mut *b,
                };
                let mut gt = compose(tf, translate(dx, dy));
                if scale != 1.0 {
                    let ax = anchor;
                    gt = compose(gt, translate(ax, baseline));
                    gt = compose(gt, scale_xy(scale, scale));
                    gt = compose(gt, translate(-ax, -baseline));
                }
                if paint_passes == 2 && paint_pass == 0 {
                    // Stroke only the outline: color glyphs (emoji bitmaps) have no outline, so this pass is skipped.
                    if let Some(stroke) = node
                        .text_stroke
                        .as_ref()
                        .filter(|stroke| stroke.width > 0.0)
                    {
                        if let Some(path) = engine.glyph_path(glyph.cache_key).and_then(|path| {
                            path.transform(translate(x0 + glyph.x, baseline + glyph.y))
                        }) {
                            let path = b.path_id(path_from_skia(&path));
                            let paint = if let Some(gradient) = &stroke.gradient {
                                Self::gradient_paint(
                                    gradient,
                                    node.frame.w.max(1.0),
                                    node.frame.h.max(1.0),
                                    opacity,
                                )
                            } else {
                                crate::drawop::PaintData::Solid(col(
                                    &stroke.color.unwrap_or(*color),
                                    opacity,
                                ))
                            };
                            let paint = b.paint_id(paint);
                            b.push(DrawOp::StrokePathPaint {
                                path,
                                paint,
                                width: stroke.width as f32,
                                cap: LineCap::Round.code(),
                                join: LineJoin::Round.code(),
                                miter: 4.0,
                                tf: mat(gt),
                            });
                        }
                    }
                    continue;
                }
                gt = compose(gt, translate(x0 + glyph.x, baseline + glyph.y));
                let run =
                    runs.get(runs.partition_point(|run| run.bytes.end <= glyph.cluster.start));
                let color = part_color
                    .or_else(|| run.and_then(|run| Rgba::parse_value(run.style.get("color"))))
                    .unwrap_or(*color);
                let c = col(&color, opacity);
                if record_color_glyph(glyph.cache_key, gt, c[3], b, engine) {
                    continue;
                }
                let Some(path) = engine.glyph_path(glyph.cache_key) else {
                    continue;
                };
                let id = b.path_id(path_from_skia(&path));
                b.push(DrawOp::FillPath {
                    path: id,
                    color: c,
                    tf: mat(gt),
                });
            }
        }
    }

    #[allow(clippy::too_many_arguments)]
    fn record_shaped(
        &self,
        shaped: &ShapedLine,
        x0: f64,
        baseline: f64,
        color: &Rgba,
        alpha: f64,
        tf: Transform,
        b: &mut FrameBuilder,
        engine: &mut TextEngine,
    ) {
        let c = col(color, alpha);
        for g in &shaped.glyphs {
            let gt = compose(tf, translate(x0 + g.x, baseline + g.y));
            if record_color_glyph(g.cache_key, gt, c[3], b, engine) {
                continue;
            }
            if let Some(path) = engine.glyph_path(g.cache_key) {
                let id = b.path_id(path_from_skia(&path));
                b.push(DrawOp::FillPath {
                    path: id,
                    color: c,
                    tf: mat(gt),
                });
            }
        }
    }

    // ── path: fill → texture → stroke (spec §6.2.1) ──
    fn record_path(
        &self,
        node: &RNode,
        p: &Map<String, Value>,
        clock: Clock,
        tf: Transform,
        b: &mut FrameBuilder,
    ) {
        let progress = p.get("pathDraw").and_then(Value::as_f64).unwrap_or(1.0);
        let morph = p.get("pathMorph").and_then(Value::as_f64).unwrap_or(0.0);
        // `pathMorph` (spec §6.2.1): fill, texture, stroke, and the length basis of `pathDraw` all follow the interpolated shape.
        let morphed = morph_subpaths(node, morph);
        let base: &Vec<Vec<(f64, f64)>> = morphed.as_ref().unwrap_or(&node.subpaths);
        let total_len = if morphed.is_some() {
            polyline_len(base)
        } else {
            node.total_len
        };
        // Fill and texture are drawn over the complete closed geometry; `pathDraw` only governs stroke progress and does not implicitly change the fill.
        self.record_path_fill(node, base, tf, b);
        let Some(stroke_color) = node.stroke else {
            return;
        };
        if total_len <= 0.0 {
            return;
        }
        // Stroke wobble: per-vertex offset taken by (seed, vertex index); fill does not wobble, otherwise fill and outline would misalign. The boil re-seeding is counted in draw frames of the cadence domain it belongs to.
        let wobbled = wobble_paths(node, base, clock);
        let subpaths: &Vec<Vec<(f64, f64)>> = wobbled.as_ref().unwrap_or(base);
        let prog = clamp(progress, 0.0, 1.0);
        if prog <= 0.0 {
            return;
        }
        // 1. Truncate by progress (the length basis uses the un-wobbled `total_len`, same as the existing golden)
        let mut remain = total_len * prog;
        let mut drawn: Vec<Vec<(f64, f64)>> = Vec::new();
        'outer: for poly in subpaths {
            if poly.len() < 2 {
                continue;
            }
            let mut out = vec![poly[0]];
            for i in 1..poly.len() {
                let (a, bp) = (poly[i - 1], poly[i]);
                let seg = ((bp.0 - a.0).powi(2) + (bp.1 - a.1).powi(2)).sqrt();
                if seg <= remain {
                    out.push(bp);
                    remain -= seg;
                } else {
                    let u = if seg > 0.0 { remain / seg } else { 0.0 };
                    out.push((a.0 + (bp.0 - a.0) * u, a.1 + (bp.1 - a.1) * u));
                    drawn.push(out);
                    break 'outer;
                }
            }
            drawn.push(out);
        }
        if node.path_trim.is_some() || p.contains_key("pathStart") || p.contains_key("pathEnd") {
            let (start, end) = path_interval(node, p);
            drawn = scene_primitives::svgpath::slice(subpaths, total_len * start, total_len * end);
        }
        // 2. Dashed: each subpath is cut starting from phase 0 (SVG semantics)
        if !node.dash.is_empty() {
            let pattern: Vec<f64> = node.dash.iter().map(|v| v * node.svg_scale).collect();
            drawn = drawn
                .iter()
                .flat_map(|poly| {
                    dash_polyline(
                        poly,
                        &pattern,
                        p.get("dashOffset")
                            .and_then(Value::as_f64)
                            .unwrap_or(node.dash_offset)
                            * node.svg_scale,
                    )
                })
                .collect();
        }
        if let Some(brush) = node.stroke_brush
            && brush.kind == pathstyle::BrushKind::Paint
        {
            // Whole stroke + visible interval: the width curve is computed over the whole stroke, so the leading edge of a half-drawn stroke is a row of round-capped bristles. Dashed lines compute one whole stroke per segment.
            let (strokes, vis) = if node.dash.is_empty() {
                let vis = if node.path_trim.is_some()
                    || p.contains_key("pathStart")
                    || p.contains_key("pathEnd")
                {
                    path_interval(node, p)
                } else {
                    (0.0, prog)
                };
                (subpaths, vis)
            } else {
                (&drawn, (0.0, 1.0))
            };
            self.record_paint_stroke(node, strokes, vis, &stroke_color, brush, tf, b);
            return;
        }
        let mut pb = PathBuilder::new();
        for poly in &drawn {
            pb.move_to(poly[0].0 as f32, poly[0].1 as f32);
            for point in &poly[1..] {
                pb.line_to(point.0 as f32, point.1 as f32);
            }
        }
        let Some(path) = pb.finish() else { return };
        let path = if node.screen_stroke {
            match path.transform(tf) {
                Some(path) => path,
                None => return,
            }
        } else {
            path
        };
        let id = b.path_id(path_from_skia(&path));
        let tf = if node.screen_stroke {
            Transform::identity()
        } else {
            tf
        };
        let width = (node.stroke_width
            * if node.screen_stroke {
                1.0
            } else {
                node.svg_scale
            }) as f32;
        let passes: &[(f32, f64)] = match node.stroke_brush.map(|b| b.kind) {
            Some(pathstyle::BrushKind::Pencil) => &[(1.0, 0.85), (0.7, 0.3), (0.55, 0.22)],
            Some(pathstyle::BrushKind::Ink) => &[(1.05, 0.92), (0.5, 0.12)],
            _ => &[(1.0, 1.0)],
        };
        for (index, (width_factor, alpha)) in passes.iter().copied().enumerate() {
            let brush_tf = if index == 0 {
                tf
            } else {
                let brush = node.stroke_brush.unwrap();
                let amp = brush.roughness
                    * if node.screen_stroke {
                        1.0
                    } else {
                        node.svg_scale
                    };
                let dx = motion::rng::splitmix64_signed(brush.seed, index as i64 * 2) * amp;
                let dy = motion::rng::splitmix64_signed(brush.seed, index as i64 * 2 + 1) * amp;
                compose(tf, translate(dx, dy))
            };
            if node.line_cap == LineCap::Round && node.line_join == LineJoin::Round {
                // Default line caps / joins go through v3's `StrokePath` (always Round/Round): existing documents stay byte-identical.
                b.push(DrawOp::StrokePath {
                    path: id,
                    color: col(&stroke_color, alpha),
                    width: width * width_factor,
                    tf: mat(brush_tf),
                });
            } else {
                let paint = b.paint_id(crate::drawop::PaintData::Solid(col(&stroke_color, alpha)));
                b.push(DrawOp::StrokePathPaint {
                    path: id,
                    paint,
                    width: width * width_factor,
                    cap: node.line_cap.code(),
                    join: node.line_join.code(),
                    miter: 4.0,
                    tf: mat(brush_tf),
                });
            }
        }
    }

    /// `brush.kind: "paint"` stroke (spec §6.9): bucketed by lightness / color content, one fill per bucket. When the stroke color has alpha, the whole stroke goes into one offscreen layer, so overlaps between bristle bands do not darken.
    #[allow(clippy::too_many_arguments)]
    fn record_paint_stroke(
        &self,
        node: &RNode,
        strokes: &[Vec<(f64, f64)>],
        vis: (f64, f64),
        color: &Rgba,
        brush: pathstyle::StrokeBrush,
        tf: Transform,
        b: &mut FrameBuilder,
    ) {
        let mapped;
        let (strokes, tf, width) = if node.screen_stroke {
            let map = |x: f64, y: f64| {
                (
                    tf.sx as f64 * x + tf.kx as f64 * y + tf.tx as f64,
                    tf.ky as f64 * x + tf.sy as f64 * y + tf.ty as f64,
                )
            };
            mapped = strokes
                .iter()
                .map(|poly| poly.iter().map(|&(x, y)| map(x, y)).collect())
                .collect::<Vec<Vec<(f64, f64)>>>();
            (&mapped[..], Transform::identity(), node.stroke_width)
        } else {
            (strokes, tf, node.stroke_width * node.svg_scale)
        };
        let params = crate::source::paint::PaintParams {
            seed: brush.seed,
            rough: brush.roughness,
            dry: brush.dry,
            load: brush.load.is_some(),
        };
        let geom = self.paints.brush(strokes, width, &params, vis);
        if geom.is_empty() {
            return;
        }
        let layered = color.a < 0.999;
        if layered {
            b.push(DrawOp::PushLayer {
                opacity: color.a.clamp(0.0, 1.0) as f32,
                blend: motion::effect::BlendMode::Normal,
            });
        }
        for (load, tone, path) in &geom.buckets {
            let mut c = crate::source::paint::tone_color(color, brush.load.as_ref(), *load, *tone);
            if layered {
                c.a = 1.0;
            }
            let id = b.path_id(path.clone());
            b.push(DrawOp::FillPath {
                path: id,
                color: col(&c, 1.0),
                tf: mat(tf),
            });
        }
        if layered {
            b.push(DrawOp::PopLayer);
        }
    }

    /// Path fill + render-time texture. Local coordinates; no time dependence when the shape is not morphed.
    fn record_path_fill(
        &self,
        node: &RNode,
        subpaths: &[Vec<(f64, f64)>],
        tf: Transform,
        b: &mut FrameBuilder,
    ) {
        if node.fill.is_none() && node.texture.is_none() {
            return;
        }
        let mut pb = PathBuilder::new();
        let (mut x0, mut y0, mut x1, mut y1) = (f64::MAX, f64::MAX, f64::MIN, f64::MIN);
        for poly in subpaths {
            if poly.len() < 3 {
                continue;
            }
            pb.move_to(poly[0].0 as f32, poly[0].1 as f32);
            for p in &poly[1..] {
                pb.line_to(p.0 as f32, p.1 as f32);
            }
            pb.close();
            for p in poly {
                x0 = x0.min(p.0);
                y0 = y0.min(p.1);
                x1 = x1.max(p.0);
                y1 = y1.max(p.1);
            }
        }
        let Some(shape) = pb.finish() else { return };
        let shape = path_from_skia(&shape);
        if let Some(fill) = node.fill {
            let id = b.path_id(shape.clone());
            if node.fill_even_odd {
                let paint = b.paint_id(crate::drawop::PaintData::Solid(col(&fill, 1.0)));
                b.push(DrawOp::FillPathPaint {
                    path: id,
                    paint,
                    even_odd: true,
                    tf: mat(tf),
                });
            } else {
                b.push(DrawOp::FillPath {
                    path: id,
                    color: col(&fill, 1.0),
                    tf: mat(tf),
                });
            }
        }
        if let Some(texture) = &node.texture {
            self.record_texture(
                (x0, y0, x1, y1),
                texture,
                node.fill,
                node.svg_scale,
                &shape,
                tf,
                b,
            );
        }
    }

    /// Gradient form of `style.background` (spec §6.3) → `FillPathPaint`.
    ///
    /// Geometry is in element-local coordinates: a linear gradient takes the box's two endpoints per the CSS angle convention (0° bottom to top, 90° left to right), with length equal to the box's projection in that direction, using the same formula as browsers; a radial gradient's center is in box proportions, and its radius is based on the box short edge.
    fn record_gradient_background(
        node: &RNode,
        gradient: &BgGradient,
        radius: f64,
        tf: Transform,
        b: &mut FrameBuilder,
    ) {
        let (w, h) = (node.frame.w, node.frame.h);
        if w <= 0.0 || h <= 0.0 {
            return;
        }
        let Some(path) = crate::raster::rounded_rect_path(0.0, 0.0, w, h, radius) else {
            return;
        };
        let paint = Self::gradient_paint(gradient, w, h, 1.0);
        let path = b.path_id(path_from_skia(&path));
        let paint = b.paint_id(paint);
        b.push(DrawOp::FillPathPaint {
            path,
            paint,
            even_odd: false,
            tf: mat(tf),
        });
    }

    fn gradient_paint(
        gradient: &BgGradient,
        w: f64,
        h: f64,
        alpha: f64,
    ) -> crate::drawop::PaintData {
        use crate::drawop::{GradientStop, PaintData};
        let stops = |stops: &[(f64, Rgba)]| -> Vec<GradientStop> {
            stops
                .iter()
                .map(|(at, color)| GradientStop {
                    offset: *at as f32,
                    color: col(color, alpha),
                })
                .collect()
        };
        match gradient {
            BgGradient::Linear { angle, stops: st } => {
                let theta = angle.to_radians();
                let (dx, dy) = (theta.sin(), -theta.cos());
                // CSS: gradient line length = |w·sinθ| + |h·cosθ|, passing through the box center.
                let len = (w * dx).abs() + (h * dy).abs();
                let (cx, cy) = (w / 2.0, h / 2.0);
                PaintData::Linear {
                    p0: [(cx - dx * len / 2.0) as f32, (cy - dy * len / 2.0) as f32],
                    p1: [(cx + dx * len / 2.0) as f32, (cy + dy * len / 2.0) as f32],
                    stops: stops(st),
                }
            }
            BgGradient::Radial {
                cx,
                cy,
                r,
                stops: st,
            } => {
                let center = [(cx * w) as f32, (cy * h) as f32];
                PaintData::Radial {
                    center,
                    radius: (r * w.min(h)) as f32,
                    focus: center,
                    stops: stops(st),
                }
            }
        }
    }

    /// Draws a texture clipped into `shape`. `bbox` and `shape` are both in local coordinates.
    /// `fill` is the base color for the `paint` finish (when absent, the texture `color` is used).
    #[allow(clippy::too_many_arguments)]
    fn record_texture(
        &self,
        bbox: (f64, f64, f64, f64),
        texture: &pathstyle::PathTexture,
        fill: Option<Rgba>,
        scale: f64,
        shape: &PathData,
        tf: Transform,
        b: &mut FrameBuilder,
    ) {
        let geom = self.textures.get(bbox, texture, scale);
        if geom.is_empty() {
            return;
        }
        let clip_id = b.path_id(shape.clone());
        b.push(DrawOp::ClipPath {
            path: clip_id,
            tf: mat(tf),
        });
        let base = fill.unwrap_or(texture.color);
        for (load, tone, path) in &geom.paint.buckets {
            let color =
                crate::source::paint::tone_color(&base, texture.load.as_ref(), *load, *tone);
            let id = b.path_id(path.clone());
            b.push(DrawOp::FillPath {
                path: id,
                color: col(&color, texture.alpha),
                tf: mat(tf),
            });
        }
        if let Some((hatch, width)) = &geom.hatch {
            let id = b.path_id(hatch.clone());
            b.push(DrawOp::StrokePath {
                path: id,
                color: col(&texture.color, texture.alpha),
                width: *width,
                tf: mat(tf),
            });
        }
        if let Some(dots) = &geom.dots {
            let id = b.path_id(dots.clone());
            b.push(DrawOp::FillPath {
                path: id,
                color: col(&texture.color, texture.alpha),
                tf: mat(tf),
            });
        }
        for (patch, opacity, radial) in &geom.wash {
            let path = b.path_id(patch.clone());
            let alpha = texture.alpha * opacity;
            let stops = [(0.0, 1.0), (0.5, 0.5), (0.85, 0.08), (1.0, 0.0)]
                .into_iter()
                .map(|(offset, falloff)| crate::drawop::GradientStop {
                    offset,
                    color: col(&texture.color, alpha * falloff),
                })
                .collect();
            let paint = b.paint_id(crate::drawop::PaintData::Radial {
                center: [radial[0], radial[1]],
                focus: [radial[0], radial[1]],
                radius: radial[2],
                stops,
            });
            b.push(DrawOp::FillPathPaint {
                path,
                paint,
                even_odd: false,
                tf: mat(tf),
            });
        }
        if let Some(grain) = &geom.grain {
            let id = b.path_id(grain.clone());
            let color = texture.grain_color.unwrap_or(texture.color);
            b.push(DrawOp::FillPath {
                path: id,
                color: col(&color, texture.grain_alpha),
                tf: mat(tf),
            });
        }
        b.push(DrawOp::PopClip);
    }

    // ── Captions (streaming / bilingual lane / word highlight / background behind text) ──
    fn record_captions(&self, ir: &Ir, engine: &mut TextEngine, t: f64, b: &mut FrameBuilder) {
        let mut active: Option<(&CaptionClip, &CapItem)> = None;
        for c in &ir.caption_clips {
            if t < c.start || t > c.end {
                continue;
            }
            for it in &c.items {
                if t >= it.at_abs && t < it.until_abs {
                    active = Some((c, it));
                    break;
                }
            }
        }
        let Some((cap, item)) = active else { return };
        // A lane with no declared exit fades out as a whole per the clip's fade; one that declares its own uses its own exit channel (§8.4)
        let block_alpha = clamp((item.until_abs - t) / cap.fade, 0.0, 1.0);

        // Line boxes are laid out by core (layout::layout_captions); the render side only draws (§8.4)
        let rel = t - item.at_abs;
        for lane in &cap.lanes {
            let Some(line) = item.lines.get(&lane.id) else {
                continue;
            };
            let Some(boxes) = &line.boxes else { continue };
            // Lane entry channel (anchored to this entry's at_abs)
            let mut lane_alpha = 1.0f64;
            let mut y_off = 0.0f64;
            let chs: Vec<Channel> = scene_primitives::resolve::lay_static(
                &lane.enter_kfs,
                item.at_abs + lane.enter_delay,
                lane.enter_dur,
            );
            for ch in &chs {
                let v = sample_frames(&ch.frames, t);
                if ch.prop == "opacity" {
                    lane_alpha = v.as_f64().unwrap_or(1.0);
                }
                if ch.prop == "y" {
                    y_off = v.as_f64().unwrap_or(0.0);
                }
            }
            // Lane exit channel (anchored to this entry's until_abs)
            let mut exit_alpha = block_alpha;
            if !lane.exit_kfs.is_empty() {
                exit_alpha = 1.0;
                let chs: Vec<Channel> = scene_primitives::resolve::lay_static(
                    &lane.exit_kfs,
                    item.until_abs - lane.exit_dur,
                    lane.exit_dur,
                );
                for ch in &chs {
                    let v = sample_frames(&ch.frames, t);
                    if ch.prop == "opacity" {
                        exit_alpha = v.as_f64().unwrap_or(1.0);
                    }
                    if ch.prop == "y" {
                        y_off += v.as_f64().unwrap_or(0.0);
                    }
                }
            }
            let alpha = exit_alpha * lane_alpha;
            if alpha <= 0.001 {
                continue;
            }
            let layered = alpha < 0.999;
            if layered {
                b.push(DrawOp::PushLayer {
                    opacity: alpha as f32,
                    blend: BlendMode::Normal,
                });
            }
            for lb in boxes {
                let content_top = lb.y + y_off;
                if lane.bg_mode.is_some() {
                    b.push(DrawOp::FillRect {
                        x: (lb.x - lane.bg_pad_h) as f32,
                        y: (content_top - lane.bg_pad_v) as f32,
                        w: (lb.w + lane.bg_pad_h * 2.0) as f32,
                        h: (lb.h + lane.bg_pad_v * 2.0) as f32,
                        radius: lane.bg_radius as f32,
                        color: col(&lane.bg_color, 1.0),
                        tf: mat(Transform::identity()),
                    });
                }
                let baseline = content_top + (lb.h - (lb.ascent + lb.descent)) / 2.0 + lb.ascent;
                if lb.words.is_empty() {
                    let shaped = engine.shape(
                        &lb.text,
                        &lane.font_family,
                        lane.font_size,
                        lane.font_weight,
                    );
                    self.record_shaped(
                        &shaped,
                        lb.x,
                        baseline,
                        &lane.color,
                        1.0,
                        Transform::identity(),
                        b,
                        engine,
                    );
                } else {
                    let words = line.words.as_deref().unwrap_or(&[]);
                    let hi = lane.hi_color.unwrap_or(lane.color);
                    for wb in &lb.words {
                        let h = match words.get(wb.index) {
                            Some(w) => {
                                clamp((rel - w.t) / lane.hi_transition, 0.0, 1.0)
                                    - clamp((rel - w.end) / lane.hi_transition, 0.0, 1.0)
                            }
                            None => 0.0,
                        };
                        let color = lane.color.mixed(&hi, h);
                        let shaped = engine.shape(
                            &wb.text,
                            &lane.font_family,
                            lane.font_size,
                            lane.font_weight,
                        );
                        self.record_shaped(
                            &shaped,
                            lb.x + wb.dx,
                            baseline,
                            &color,
                            1.0,
                            Transform::identity(),
                            b,
                            engine,
                        );
                    }
                }
            }
            if layered {
                b.push(DrawOp::PopLayer);
            }
        }
    }
}

/// Rectangle path of the element box (the clip box for a vector source's `cover`).
/// Cuts a polyline into several "draw" segments per `pattern` ([on, off, …], even count, total length positive).
fn wobble_paths(
    node: &RNode,
    base: &[Vec<(f64, f64)>],
    clock: Clock,
) -> Option<Vec<Vec<(f64, f64)>>> {
    node.wobble.as_ref().map(|w| {
        let epoch = if w.every > 0 {
            let fps = clock.fps.unwrap_or(pathstyle::DEFAULT_DRAW_FPS);
            pathstyle::draw_frame(clock.real, fps) / u64::from(w.every)
        } else {
            0
        };
        let seed = w.seed ^ epoch.wrapping_mul(0xA24B_AED4_963E_E407);
        let amp = w.amp * node.svg_scale;
        let mut index = 0i64;
        base.iter()
            .map(|poly| {
                let closed = poly.len() > 2 && poly.first() == poly.last();
                let mut out: Vec<(f64, f64)> = poly
                    .iter()
                    .map(|(x, y)| {
                        let dx = motion::rng::splitmix64_signed(seed, index) * 0.5 * amp;
                        let dy = motion::rng::splitmix64_signed(seed, index + 1) * 0.5 * amp;
                        index += 2;
                        (x + dx, y + dy)
                    })
                    .collect();
                if closed && let Some(first) = out.first().copied() {
                    let last = out.len() - 1;
                    out[last] = first;
                }
                out
            })
            .collect()
    })
}

fn path_interval(node: &RNode, p: &Map<String, Value>) -> (f64, f64) {
    let defaults = node.path_trim.unwrap_or((0.0, 1.0));
    let start = p
        .get("pathStart")
        .and_then(Value::as_f64)
        .unwrap_or(defaults.0)
        .clamp(0.0, 1.0);
    let end = p
        .get("pathEnd")
        .and_then(Value::as_f64)
        .unwrap_or(defaults.1)
        .clamp(0.0, 1.0)
        .max(start);
    let progress = p
        .get("pathDraw")
        .and_then(Value::as_f64)
        .unwrap_or(1.0)
        .clamp(0.0, 1.0);
    (start, start + (end - start) * progress)
}

fn dash_polyline(poly: &[(f64, f64)], pattern: &[f64], offset: f64) -> Vec<Vec<(f64, f64)>> {
    let mut out: Vec<Vec<(f64, f64)>> = Vec::new();
    if poly.len() < 2 || pattern.is_empty() {
        return vec![poly.to_vec()];
    }
    let mut slot = 0usize;
    let mut phase = offset.rem_euclid(pattern.iter().sum());
    while phase > 0.0 && phase >= pattern[slot] {
        phase -= pattern[slot];
        slot = (slot + 1) % pattern.len();
    }
    let mut left = pattern[slot] - phase;
    let mut current: Vec<(f64, f64)> = vec![poly[0]];
    for pair in poly.windows(2) {
        let (a, b) = (pair[0], pair[1]);
        let seg = ((b.0 - a.0).powi(2) + (b.1 - a.1).powi(2)).sqrt();
        let mut at = 0.0;
        while seg - at > left {
            at += left;
            let u = if seg > 0.0 { at / seg } else { 0.0 };
            let point = (a.0 + (b.0 - a.0) * u, a.1 + (b.1 - a.1) * u);
            if slot % 2 == 0 {
                current.push(point);
                if current.len() > 1 {
                    out.push(std::mem::take(&mut current));
                }
            } else {
                current = vec![point];
            }
            slot = (slot + 1) % pattern.len();
            left = pattern[slot];
        }
        left -= seg - at;
        if slot % 2 == 0 {
            current.push(b);
        }
    }
    if slot % 2 == 0 && current.len() > 1 {
        out.push(current);
    }
    out
}

/// Terminal line/block characters occupy complete cells even when a fallback font
/// gives them a double-width advance. This keeps adjoining border segments connected.
fn cell_symbol(text: &str, w: f64, h: f64, font_size: f64) -> Option<tiny_skia::Path> {
    let mut pb = PathBuilder::new();
    let mut rect = |x: f64, y: f64, width: f64, height: f64| {
        if let Some(r) =
            tiny_skia::Rect::from_xywh(x as f32, (y - h) as f32, width as f32, height as f32)
        {
            pb.push_rect(r);
        }
    };
    match text {
        "█" => rect(0.0, 0.0, w, h),
        "▀" => rect(0.0, 0.0, w, h / 2.0),
        "▄" => rect(0.0, h / 2.0, w, h / 2.0),
        "▌" => rect(0.0, 0.0, w / 2.0, h),
        "▐" => rect(w / 2.0, 0.0, w / 2.0, h),
        "░" | "▒" | "▓" => {
            let level = match text {
                "░" => 1,
                "▒" => 2,
                _ => 3,
            };
            for row in 0..4 {
                for col in 0..4 {
                    if (row * 3 + col) % 4 < level {
                        rect(col as f64 * w / 4.0, row as f64 * h / 4.0, w / 4.0, h / 4.0);
                    }
                }
            }
        }
        "─" | "│" | "┌" | "┐" | "└" | "┘" | "├" | "┤" | "┬" | "┴" | "┼" => {
            let stroke = (font_size / 12.0).clamp(1.0, 2.0).min(w).min(h);
            if matches!(text, "─" | "┐" | "┘" | "┤" | "┬" | "┴" | "┼") {
                rect(0.0, (h - stroke) / 2.0, (w + stroke) / 2.0, stroke);
            }
            if matches!(text, "─" | "┌" | "└" | "├" | "┬" | "┴" | "┼") {
                rect(
                    (w - stroke) / 2.0,
                    (h - stroke) / 2.0,
                    (w + stroke) / 2.0,
                    stroke,
                );
            }
            if matches!(text, "│" | "└" | "┘" | "├" | "┤" | "┴" | "┼") {
                rect((w - stroke) / 2.0, 0.0, stroke, (h + stroke) / 2.0);
            }
            if matches!(text, "│" | "┌" | "┐" | "├" | "┤" | "┬" | "┼") {
                rect(
                    (w - stroke) / 2.0,
                    (h - stroke) / 2.0,
                    stroke,
                    (h + stroke) / 2.0,
                );
            }
        }
        _ => return None,
    }
    pb.finish()
}

fn box_path(w: f64, h: f64) -> PathData {
    let mut pb = PathBuilder::new();
    match tiny_skia::Rect::from_xywh(0.0, 0.0, w.max(0.0) as f32, h.max(0.0) as f32) {
        Some(rect) => pb.push_rect(rect),
        None => return PathData::default(),
    }
    match pb.finish() {
        Some(path) => path_from_skia(&path),
        None => PathData::default(),
    }
}

/// Whether every `lottie` element's asset has been installed (assembly-time fail-fast, see [`FrameRenderer::new_with_lotties`]).
fn check_lottie_sources(
    node: &RNode,
    lotties: &std::collections::HashMap<String, Arc<Lottie>>,
) -> Result<()> {
    if node.ntype == "lottie" {
        match &node.asset_id {
            Some(id) if lotties.contains_key(id) => {}
            Some(id) => bail!(
                "lottie-source-missing: element \"{}\" references Lottie asset \"{id}\", which was not loaded; \
                 the renderer must be given the resolved Lottie source",
                node.id
            ),
            None => bail!("lottie-source-missing: element \"{}\" has no src", node.id),
        }
    }
    for child in &node.children {
        check_lottie_sources(child, lotties)?;
    }
    Ok(())
}

fn polyline_len(subpaths: &[Vec<(f64, f64)>]) -> f64 {
    let mut len = 0.0;
    for poly in subpaths {
        for w in poly.windows(2) {
            len += ((w[1].0 - w[0].0).powi(2) + (w[1].1 - w[0].1).powi(2)).sqrt();
        }
    }
    len
}

/// `pathMorph` channel value `v ∈ [0, N]` (`N` = number of `morphTo`): piecewise-linear interpolation over the shape sequence `[d, morphTo…]`, lerp per vertex. Returns `None` when there is no target or `v <= 0` (uses the original `d` geometry; existing documents stay byte-identical).
fn morph_subpaths(node: &RNode, v: f64) -> Option<Vec<Vec<(f64, f64)>>> {
    let n = node.morph_shapes.len();
    if n == 0 || !(v > 0.0) {
        return None;
    }
    let v = v.min(n as f64);
    let i = (v.floor() as usize).min(n - 1);
    let u = v - i as f64;
    let from = if i == 0 {
        &node.subpaths
    } else {
        &node.morph_shapes[i - 1]
    };
    let to = &node.morph_shapes[i];
    Some(
        from.iter()
            .zip(to)
            .map(|(a, b)| {
                a.iter()
                    .zip(b)
                    .map(|(p, q)| (p.0 + (q.0 - p.0) * u, p.1 + (q.1 - p.1) * u))
                    .collect()
            })
            .collect(),
    )
}
