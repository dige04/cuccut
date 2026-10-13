//! CPU reference executor for `PassExecutor` built on tiny-skia (design §6.5).
//!
//! **Folding guarantee**: when `FramePlan::is_folded()` is true, [`execute_plan`] calls
//! `raster::rasterize_with_media` directly. It is the same function call as rasterizing as-is after `record(t)`, with no extra allocation or copy, so the output is byte-identical.

use super::cache::SurfaceCache;
use super::capability::CapabilityProfile;
use super::frame_plan::FramePlan;
use super::pass::RenderPass;
use super::surface::{CompositeInput, SurfaceId, SurfacePlan};
use crate::drawop::FrameOps;
use crate::raster::{FrameMedia, rasterize_with_media};
use anyhow::{Result, anyhow, bail};
use motion::effect::{BlendMode, EffectRef, UniformMap};
use std::collections::BTreeMap;
use std::sync::Arc;
use tiny_skia::Pixmap;

/// The four things a backend must provide to execute a FramePlan. The CPU reference is the canonical implementation;
/// a future GPU executor is only an accelerator and must pass the same conformance fixtures.
pub trait PassExecutor {
    fn profile(&self) -> &CapabilityProfile;

    fn draw(
        &mut self,
        surface: &SurfacePlan,
        ops: &FrameOps,
        media: &mut dyn FrameMedia,
    ) -> Result<Pixmap>;

    fn filter(
        &mut self,
        surface: &SurfacePlan,
        input: &Pixmap,
        effect: &EffectRef,
        uniforms: &UniformMap,
    ) -> Result<Pixmap>;

    fn transition(
        &mut self,
        surface: &SurfacePlan,
        from: &Pixmap,
        to: &Pixmap,
        effect: &EffectRef,
        progress: f32,
        uniforms: &UniformMap,
    ) -> Result<Pixmap>;

    fn accumulate(
        &mut self,
        surface: &SurfacePlan,
        inputs: &[(Arc<Pixmap>, f64)],
    ) -> Result<Pixmap> {
        let mut out = Pixmap::new(surface.width, surface.height)
            .ok_or_else(|| anyhow!("surface size is invalid"))?;
        if inputs
            .iter()
            .any(|(p, _)| p.width() != surface.width || p.height() != surface.height)
        {
            bail!("effect-input-mismatch: accumulate size differs");
        }
        let total: f64 = inputs.iter().map(|(_, w)| *w).sum();
        if !total.is_finite()
            || total <= 0.0
            || inputs.iter().any(|(_, w)| !w.is_finite() || *w < 0.0)
        {
            bail!("frameplan-weights-invalid");
        }
        for (i, pixel) in out.data_mut().chunks_exact_mut(4).enumerate() {
            let mut sum = [0.0; 4];
            for (input, weight) in inputs {
                for c in 0..4 {
                    sum[c] += input.data()[i * 4 + c] as f64 * weight;
                }
            }
            for c in 0..4 {
                pixel[c] = (sum[c] / total).round().clamp(0.0, 255.0) as u8;
            }
        }
        Ok(out)
    }

    fn transform(
        &mut self,
        surface: &SurfacePlan,
        input: &Pixmap,
        tf: &crate::drawop::Mat6,
    ) -> Result<Pixmap> {
        let mut out = Pixmap::new(surface.width, surface.height)
            .ok_or_else(|| anyhow!("surface size is invalid"))?;
        out.draw_pixmap(
            0,
            0,
            input.as_ref(),
            &tiny_skia::PixmapPaint {
                quality: tiny_skia::FilterQuality::Bilinear,
                ..Default::default()
            },
            tiny_skia::Transform::from_row(tf[0], tf[1], tf[2], tf[3], tf[4], tf[5]),
            None,
        );
        Ok(out)
    }

    fn mask(
        &mut self,
        input: &Pixmap,
        mask: &Pixmap,
        mode: crate::drawop::MatteMode,
    ) -> Result<Pixmap> {
        if input.width() != mask.width() || input.height() != mask.height() {
            bail!("effect-input-mismatch: mask size differs from input");
        }
        let mut out = input.clone();
        crate::raster::apply_matte(&mut out, mask, mode);
        Ok(out)
    }

    fn backdrop(
        &mut self,
        base: &Pixmap,
        filtered: &Pixmap,
        mask: &Pixmap,
        opacity: f32,
    ) -> Result<Pixmap> {
        if base.width() != filtered.width()
            || base.height() != filtered.height()
            || base.width() != mask.width()
            || base.height() != mask.height()
        {
            bail!("effect-input-mismatch: backdrop size mismatch");
        }
        let mut out = base.clone();
        let opacity = opacity.clamp(0.0, 1.0);
        for ((pixel, filtered), mask) in out
            .data_mut()
            .chunks_exact_mut(4)
            .zip(filtered.data().chunks_exact(4))
            .zip(mask.data().chunks_exact(4))
        {
            let coverage = mask[3] as f32 / 255.0 * opacity;
            for (dst, src) in pixel.iter_mut().zip(filtered) {
                *dst = (*dst as f32 + (*src as f32 - *dst as f32) * coverage).round() as u8;
            }
        }
        Ok(out)
    }

    fn composite(
        &mut self,
        surface: &SurfacePlan,
        inputs: &[(CompositeInput, Arc<Pixmap>, Option<Arc<Pixmap>>)],
    ) -> Result<Pixmap>;
}

pub struct CpuExecutor {
    caps: CapabilityProfile,
}

impl CpuExecutor {
    pub fn new(caps: CapabilityProfile) -> Self {
        CpuExecutor { caps }
    }
}

impl Default for CpuExecutor {
    fn default() -> Self {
        CpuExecutor::new(CapabilityProfile::cpu_reference())
    }
}

impl PassExecutor for CpuExecutor {
    fn profile(&self) -> &CapabilityProfile {
        &self.caps
    }

    fn draw(
        &mut self,
        surface: &SurfacePlan,
        ops: &FrameOps,
        media: &mut dyn FrameMedia,
    ) -> Result<Pixmap> {
        let mut pixmap = rasterize_with_media(ops, surface.width, surface.height, media)?;
        if let Some(clear) = surface.clear {
            // The clear color takes effect before DrawOps; a `Clear` instruction overrides it, so the two do not conflict.
            let mut base = Pixmap::new(surface.width, surface.height)
                .ok_or_else(|| anyhow!("surface {:?} has an invalid size", surface.id))?;
    base.fill(
                tiny_skia::Color::from_rgba(
                    clear[0].clamp(0.0, 1.0),
                    clear[1].clamp(0.0, 1.0),
                    clear[2].clamp(0.0, 1.0),
                    clear[3].clamp(0.0, 1.0),
                )
                .ok_or_else(|| anyhow!("surface {:?} has an invalid clear color", surface.id))?,
            );
            base.draw_pixmap(
                0,
                0,
                pixmap.as_ref(),
                &tiny_skia::PixmapPaint::default(),
                tiny_skia::Transform::identity(),
                None,
            );
            pixmap = base;
        }
        Ok(pixmap)
    }

    fn filter(
        &mut self,
        surface: &SurfacePlan,
        input: &Pixmap,
        effect: &EffectRef,
        uniforms: &UniformMap,
    ) -> Result<Pixmap> {
        // Relative lengths are measured against the **short edge of the output surface**, so the same recipe yields
        // radii and feathers that scale with the frame size (`canvasShortEdge` in design §5.5).
        let short_edge = f64::from(surface.width.min(surface.height));
        crate::effects::apply_filter(effect, uniforms, input, short_edge)
    }

    fn transition(
        &mut self,
        surface: &SurfacePlan,
        from: &Pixmap,
        to: &Pixmap,
        effect: &EffectRef,
        progress: f32,
        uniforms: &UniformMap,
    ) -> Result<Pixmap> {
        // Same basis as `filter`: relative lengths are measured against the short edge of the output surface.
        let short_edge = f64::from(surface.width.min(surface.height));
        crate::effects::apply_transition(effect, uniforms, from, to, progress, short_edge)
    }

    fn composite(
        &mut self,
        surface: &SurfacePlan,
        inputs: &[(CompositeInput, Arc<Pixmap>, Option<Arc<Pixmap>>)],
    ) -> Result<Pixmap> {
        if inputs.iter().any(|(input, _, _)| input.mask.is_some()) {
            bail!("effect-capability-unsupported: composite mask needs mask.* effects (stage 4B)");
        }
        let mut out = Pixmap::new(surface.width, surface.height)
            .ok_or_else(|| anyhow!("surface {:?} has an invalid size", surface.id))?;
let mut blank = true;
        for (input, pixmap, _) in inputs {
            if composite_layer(&mut out, pixmap, input.opacity, input.blend, blank) {
                blank = false;
            }
        }
        Ok(out)
    }
}

/// Composites one layer into `out`, byte-identical to drawing the whole `out.draw_pixmap(0, 0, layer, …)`.
///
/// Most layers hold only a small patch of content (one sticker, one line of text); the rest is premultiplied all-zero transparent pixels. But `draw_pixmap`'s Pattern shader only has a highp implementation, so a full-frame pass is a per-pixel float pipeline. In the release export profile of animation projects, this accounts for about half of the BCF render CPU. For all nine [`BlendMode`]s, src = (0,0,0,0) leaves dst unchanged, so the same pipeline runs only inside [`content_rect`], which covers all non-zero pixels. Also, when nothing has been drawn yet (`out_blank`) and the mode is Normal with opacity 1, src-over onto zeros is just src itself, so it is copied as one block without scanning. Both shortcuts are checked byte-for-byte against the full `draw_pixmap` by `tests::bounded_composite_matches_full_draw_pixmap`.
///
/// Returns whether this layer may have changed `out`.
fn composite_layer(
    out: &mut Pixmap,
    layer: &Pixmap,
    opacity: f32,
    blend: BlendMode,
    out_blank: bool,
) -> bool {
    let opacity = opacity.clamp(0.0, 1.0);
    if opacity <= 0.0 {
        return false;
    }
    if out_blank
        && blend == BlendMode::Normal
        && opacity >= 1.0
        && (layer.width(), layer.height()) == (out.width(), out.height())
    {
        out.data_mut().copy_from_slice(layer.data());
        return true;
    }
    bounded(out, layer, opacity, super::blend_to_skia(blend))
}

/// The narrowed part of [`composite_layer`], for other callers: byte-identical to a full `out.draw_pixmap(0, 0, layer, …)`
/// (nearest-neighbour, identity transform, no clipping), but runs the pipeline only within the bounding rectangle of the layer's
/// non-zero pixels. `blend` accepts only the nine [`BlendMode`]s that fit (with src all zero, they leave dst unchanged); for other
/// blend modes it returns `None` and the caller draws the full frame. Returns `Some(whether this layer may have changed out)`.
pub fn composite_bounded(
    out: &mut Pixmap,
    layer: &Pixmap,
    opacity: f32,
    blend: tiny_skia::BlendMode,
) -> Option<bool> {
    BlendMode::ALL
        .iter()
        .any(|&mode| super::blend_to_skia(mode) == blend)
        .then(|| bounded(out, layer, opacity.clamp(0.0, 1.0), blend))
}

/// Same as [`composite_bounded`], but the caller supplies the content box (`(left, top, right, bottom)`, pixels, right/bottom exclusive),
/// so the layer is not scanned. The box must cover all non-zero pixels of the layer; any such superset is byte-identical to the full
/// draw (with src all zero, the nine blend modes leave dst unchanged). Parts outside the layer are clipped to the layer size.
pub fn composite_bounded_rect(
    out: &mut Pixmap,
    layer: tiny_skia::PixmapRef<'_>,
    rect: (usize, usize, usize, usize),
    opacity: f32,
    blend: tiny_skia::BlendMode,
) -> Option<bool> {
    BlendMode::ALL
        .iter()
        .any(|&mode| super::blend_to_skia(mode) == blend)
        .then(|| {
            let (left, top, right, bottom) = rect;
            let right = right.min(layer.width() as usize);
            let bottom = bottom.min(layer.height() as usize);
            fill_content(
                out,
                layer,
                (left, top, right, bottom),
                opacity.clamp(0.0, 1.0),
                blend,
            )
        })
}

fn bounded(out: &mut Pixmap, layer: &Pixmap, opacity: f32, blend: tiny_skia::BlendMode) -> bool {
    if opacity <= 0.0 {
        return false;
    }
    let Some(rect) = content_rect(layer.data(), layer.width() as usize) else {
        return false;
    };
    fill_content(out, layer.as_ref(), rect, opacity, blend)
}

/// Composites `layer` only within `(left, top, right, bottom)`, drawn the same way as the full `draw_pixmap`.
fn fill_content(
    out: &mut Pixmap,
    layer: tiny_skia::PixmapRef<'_>,
    (left, top, right, bottom): (usize, usize, usize, usize),
    opacity: f32,
    blend: tiny_skia::BlendMode,
) -> bool {
    if opacity <= 0.0 {
        return false;
    }
    let Some(rect) =
        tiny_skia::Rect::from_ltrb(left as f32, top as f32, right as f32, bottom as f32)
    else {
        return false;
    };
    // Same Paint as the one `draw_pixmap` builds internally (Nearest, Pad, no anti-aliasing); only the fill rectangle
    // is narrowed from the full frame to the content box.
    let paint = tiny_skia::Paint {
        shader: tiny_skia::Pattern::new(
            layer,
            tiny_skia::SpreadMode::Pad,
            tiny_skia::FilterQuality::Nearest,
            opacity,
            tiny_skia::Transform::identity(),
        ),
        blend_mode: blend,
        anti_alias: false,
        force_hq_pipeline: false,
    };
    out.fill_rect(rect, &paint, tiny_skia::Transform::identity(), None);
    true
}

/// Bounding rectangle `(left, top, right, bottom)` of the non-zero bytes in RGBA rows of `width`, in pixels, right/bottom exclusive;
/// returns `None` if all zero. Rows are exact, while columns are rounded outward in 16-pixel blocks, so the caller only gets a
/// superset of the non-zero pixels.
///
/// Whole rows and blocks are compared against an all-zero slice (which falls through to `memcmp`) rather than iterated byte by byte.
/// The dev profile only optimizes third-party dependencies, and this crate is O0 in debug builds, so a byte-by-byte scan of a 1080p
/// frame takes tens of milliseconds, which costs more than the tiny-skia drawing it saves (`effects::alpha_bbox` scans that way).
/// Columns only check the stretch beyond the current bounds; once the content box is settled, each row needs just two whole-row comparisons.
fn content_rect(data: &[u8], width: usize) -> Option<(usize, usize, usize, usize)> {
    const COL_BLOCK: usize = 16 * 4;
    static ZEROS: [u8; 4096] = [0; 4096];
    let is_zero = |bytes: &[u8]| {
        bytes
            .chunks(ZEROS.len())
            .all(|chunk| chunk == &ZEROS[..chunk.len()])
    };
    let row_bytes = width * 4;
    if row_bytes == 0 {
        return None;
    }
    let (mut top, mut bottom) = (None, 0);
    let (mut left, mut right) = (row_bytes, 0);
    for (y, row) in data.chunks_exact(row_bytes).enumerate() {
        if is_zero(row) {
            continue;
        }
        top.get_or_insert(y);
        bottom = y + 1;
        // Block boundaries are cut every 64 bytes from the start of the row, and `rchunks` cuts from the end. Row length is a
        // multiple of 4, so the boundaries from both ends fall on pixel boundaries.
        if let Some(block) = row[..left].chunks(COL_BLOCK).position(|c| !is_zero(c)) {
            left = block * COL_BLOCK;
        }
        if let Some(block) = row[right..].rchunks(COL_BLOCK).position(|c| !is_zero(c)) {
            right = row_bytes - block * COL_BLOCK;
        }
    }
    Some((left / 4, top?, right / 4, bottom))
}

/// Executes a FramePlan and returns the pixels of the output surface.
///
/// `cache` holds **intermediate** surfaces (key = surface content fingerprint). The whole-frame cache is handled by the caller
/// (`video.rs`) outside the plan, so the two layers do not double-count.
pub fn execute_plan<E: PassExecutor, M: FrameMedia>(
    plan: &FramePlan,
    executor: &mut E,
    media: &mut M,
    cache: Option<&SurfaceCache>,
) -> Result<Pixmap> {
    execute(plan, executor, media, cache, &BTreeMap::new(), None)
}

/// Same as [`execute_plan`], but reuses the surface fingerprint table that the caller has **already computed**
/// ([`FramePlan::frame_fingerprints`]).
///
/// Building the fingerprint table requires a full `drawop::encode` for each Draw pass, and the executor also needs the same table
/// as the cache keys for intermediate surfaces. The compositing path first looks up the whole-frame cache by frame fingerprint and
/// only executes on a miss, so the same table would be computed twice. Passing the table in computes it only once; `surface_fingerprints`
/// has already run `validate` internally, so `validate` is not repeated on this path either.
///
/// **Calling constraint**: `fingerprints` must come from **this same plan, unmodified since**.
/// The fields of `FramePlan` are `pub`; if the plan is changed and the old table is reused, stale cache keys will be obtained.
pub fn execute_plan_with_fingerprints<E: PassExecutor, M: FrameMedia>(
    plan: &FramePlan,
    executor: &mut E,
    media: &mut M,
    cache: Option<&SurfaceCache>,
    fingerprints: &BTreeMap<u32, u64>,
) -> Result<Pixmap> {
    execute(
        plan,
        executor,
        media,
        cache,
        &BTreeMap::new(),
        Some(fingerprints),
    )
}

/// Execution entry point with an **external input surface** ([`super::SurfaceLifetime::External`]).
///
/// Used for "there is already a drawn pixmap, and an effect chain should run on it": it is taken directly as the input,
/// rather than first blitted into a surface, since blit goes through `draw_pixmap` and may alter bytes.
///
/// **The content of an external surface is not in the plan**, so the surface fingerprint cannot describe it: this path
/// does not accept `cache` (an error is raised if one is passed), and its `frame_fingerprint()` must not be used as frame identity.
pub fn execute_plan_with_inputs<E: PassExecutor, M: FrameMedia>(
    plan: &FramePlan,
    executor: &mut E,
    media: &mut M,
    cache: Option<&SurfaceCache>,
    external: &BTreeMap<u32, Arc<Pixmap>>,
) -> Result<Pixmap> {
    execute(plan, executor, media, cache, external, None)
}

/// The shared implementation of the three public entry points. When `fingerprints` is `Some`, the caller has already computed
/// the surface fingerprint table (so `validate` has also already passed), and both steps are skipped here.
fn execute<E: PassExecutor, M: FrameMedia>(
    plan: &FramePlan,
    executor: &mut E,
    media: &mut M,
    cache: Option<&SurfaceCache>,
    external: &BTreeMap<u32, Arc<Pixmap>>,
    fingerprints: Option<&BTreeMap<u32, u64>>,
) -> Result<Pixmap> {
    if fingerprints.is_none() {
        plan.validate()?;
    }
    let has_external = plan
        .surfaces
        .iter()
        .any(|surface| surface.lifetime == super::SurfaceLifetime::External);
    if has_external && cache.is_some() {
        bail!(
            "frameplan-external-uncacheable: the contents of an external input surface are not in the plan, so they cannot enter the surface cache"
        );
    }
    for surface in &plan.surfaces {
        if surface.lifetime == super::SurfaceLifetime::External
            && !external.contains_key(&surface.id.0)
        {
            bail!(
                "frameplan-external-missing: the plan declares {:?} as supplied by the caller, but none was provided",
                surface.id
            );
        }
    }
    if plan.capability != executor.profile().fingerprint() {
        bail!(
            "frameplan-capability-mismatch: plan was compiled for {:016x}, but the executor is {:016x}",
            plan.capability,
            executor.profile().fingerprint()
        );
    }
    let output_surface = plan
        .output_surface()
        .ok_or_else(|| anyhow!("frameplan-output-unknown: {:?}", plan.output))?;

    // Folded shape: exactly the same path as record + rasterize.
    if plan.is_folded() {
        let RenderPass::Draw { ops, .. } = &plan.passes[0] else {
            unreachable!("is_folded already classified it as Draw");
        };
        return executor.draw(output_surface, ops, media);
    }

    let computed;
    let fingerprints = match fingerprints {
        Some(table) => table,
        None => {
            computed = plan.surface_fingerprints()?;
            &computed
        }
    };
    let mut live: BTreeMap<u32, Arc<Pixmap>> = external.clone();
    let take = |live: &BTreeMap<u32, Arc<Pixmap>>, id: SurfaceId| -> Result<Arc<Pixmap>> {
        live.get(&id.0)
            .cloned()
            .ok_or_else(|| anyhow!("frameplan-surface-missing: {id:?} has not been produced yet"))
    };

    let mut uses = BTreeMap::<u32, usize>::new();
    for pass in &plan.passes {
        for input in pass.inputs() {
            *uses.entry(input.0).or_default() += 1;
        }
    }
    for pass in &plan.passes {
        let target = pass.output();
        let surface = plan
            .surface(target)
            .ok_or_else(|| anyhow!("frameplan-pass-output-unknown: {target:?}"))?;
        // A table computed internally is guaranteed by `validate` to cover all surfaces. An externally passed table that does not
        // match the plan is reported as an error here rather than panicking.
        let key = *fingerprints
            .get(&target.0)
            .ok_or_else(|| anyhow!("frameplan-fingerprint-missing: {target:?}"))?;
        if let Some(cache) = cache
            && let Some(hit) = cache.get(key)
        {
            live.insert(target.0, hit);
            release_inputs(pass, &mut uses, &mut live, plan.output);
            continue;
        }
        let produced = match pass {
            RenderPass::Draw { ops, .. } => executor.draw(surface, ops, media)?,
            RenderPass::Filter {
                input,
                effect,
                uniforms,
                ..
            } => {
                let source = take(&live, *input)?;
                executor.filter(surface, source.as_ref(), effect, uniforms)?
            }
            RenderPass::Transition {
                from,
                to,
                effect,
                progress,
                uniforms,
                ..
            } => {
                let a = take(&live, *from)?;
                let b = take(&live, *to)?;
                executor.transition(surface, a.as_ref(), b.as_ref(), effect, *progress, uniforms)?
            }
            RenderPass::Accumulate { inputs, .. } => {
                let resolved = inputs
                    .iter()
                    .map(|(id, w)| Ok((take(&live, *id)?, *w)))
                    .collect::<Result<Vec<_>>>()?;
                executor.accumulate(surface, &resolved)?
            }
            RenderPass::Transform { input, tf, .. } => {
                executor.transform(surface, take(&live, *input)?.as_ref(), tf)?
            }
            RenderPass::Backdrop {
                base,
                filtered,
                mask,
                opacity,
                ..
            } => executor.backdrop(
                take(&live, *base)?.as_ref(),
                take(&live, *filtered)?.as_ref(),
                take(&live, *mask)?.as_ref(),
                *opacity,
            )?,
            RenderPass::Mask {
                input, mask, mode, ..
            } => executor.mask(
                take(&live, *input)?.as_ref(),
                take(&live, *mask)?.as_ref(),
                *mode,
            )?,
            RenderPass::Composite { inputs, .. } => {
                let mut resolved = Vec::with_capacity(inputs.len());
                for input in inputs {
                    let pixmap = take(&live, input.surface)?;
                    let mask = match input.mask {
                        Some(mask) => Some(take(&live, mask)?),
                        None => None,
                    };
                    resolved.push((input.clone(), pixmap, mask));
                }
                executor.composite(surface, &resolved)?
            }
        };
        let produced = Arc::new(produced);
        if let Some(cache) = cache {
            cache.put(key, produced.clone());
        }
        live.insert(target.0, produced);
        release_inputs(pass, &mut uses, &mut live, plan.output);
    }

    let output = take(&live, plan.output)?;
    Ok(Arc::try_unwrap(output).unwrap_or_else(|shared| shared.as_ref().clone()))
}

fn release_inputs(
    pass: &RenderPass,
    uses: &mut BTreeMap<u32, usize>,
    live: &mut BTreeMap<u32, Arc<Pixmap>>,
    output: SurfaceId,
) {
    for input in pass.inputs() {
        if let Some(n) = uses.get_mut(&input.0) {
            *n -= 1;
            if *n == 0 && input != output {
                live.remove(&input.0);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Fixed-seed xorshift: the fixtures must be reproducible, so `rand` is not pulled in.
    struct Rng(u64);

    impl Rng {
        fn next(&mut self) -> u64 {
            self.0 ^= self.0 << 13;
            self.0 ^= self.0 >> 7;
            self.0 ^= self.0 << 17;
            self.0
        }

        fn below(&mut self, n: u64) -> u64 {
            self.next() % n
        }

        /// A valid premultiplied pixel: colour channels do not exceed alpha.
        fn premul(&mut self) -> [u8; 4] {
            let alpha = self.below(256) as u8;
            let channel = |rng: &mut Self| rng.below(u64::from(alpha) + 1) as u8;
            [channel(self), channel(self), channel(self), alpha]
        }
    }

    fn filled(
        width: u32,
        height: u32,
        rng: &mut Rng,
        keep: impl Fn(usize, usize) -> bool,
    ) -> Pixmap {
        let mut pixmap = Pixmap::new(width, height).unwrap();
        let data = pixmap.data_mut();
        for y in 0..height as usize {
            for x in 0..width as usize {
                if keep(x, y) {
                    let at = (y * width as usize + x) * 4;
                    data[at..at + 4].copy_from_slice(&rng.premul());
                }
            }
        }
        pixmap
    }

    /// Layers of various shapes: fully transparent, fully opaque, a block in the middle, corner pixels touching all four edges, and sparse scattered points.
    fn layers(width: u32, height: u32, rng: &mut Rng) -> Vec<Pixmap> {
        let (w, h) = (width as usize, height as usize);
        let (left, top) = (rng.below(w as u64) as usize, rng.below(h as u64) as usize);
        let (right, bottom) = (
            left + 1 + rng.below((w - left) as u64) as usize,
            top + 1 + rng.below((h - top) as u64) as usize,
        );
        let sparse: Vec<bool> = (0..w * h).map(|_| rng.below(9) == 0).collect();
        vec![
            Pixmap::new(width, height).unwrap(),
            filled(width, height, rng, |_, _| true),
            filled(width, height, rng, |x, y| {
                (left..right).contains(&x) && (top..bottom).contains(&y)
            }),
            filled(width, height, rng, |x, y| {
                (x == 0 || x == w - 1) && (y == 0 || y == h - 1)
            }),
            filled(width, height, rng, |x, y| sparse[y * w + x]),
        ]
    }

    fn full_draw(dst: &mut Pixmap, layer: &Pixmap, opacity: f32, blend: BlendMode) {
        dst.draw_pixmap(
            0,
            0,
            layer.as_ref(),
            &tiny_skia::PixmapPaint {
                opacity: opacity.clamp(0.0, 1.0),
                blend_mode: super::super::blend_to_skia(blend),
                ..Default::default()
            },
            tiny_skia::Transform::identity(),
            None,
        );
    }

    #[test]
    fn bounded_composite_matches_full_draw_pixmap() {
        let mut rng = Rng(0x9e37_79b9_7f4a_7c15);
        // 1100 px per row is 4400 bytes, which spans the 4096-byte zero block; 16 / 64 / 65 px sit right on the 16-pixel column block boundaries.
        for (width, height) in [
            (37, 23),
            (16, 5),
            (1, 1),
            (61, 2),
            (64, 3),
            (65, 2),
            (1100, 3),
        ] {
            for _ in 0..4 {
                let backdrops = [
                    Pixmap::new(width, height).unwrap(),
                    filled(width, height, &mut rng, |_, _| true),
                ];
                for layer in layers(width, height, &mut rng) {
                    for (index, backdrop) in backdrops.iter().enumerate() {
                        let blank = index == 0;
                        for blend in BlendMode::ALL {
                            for opacity in [1.0, 0.5, 0.0] {
                                let mut expected = backdrop.clone();
                                full_draw(&mut expected, &layer, opacity, blend);
                                let mut actual = backdrop.clone();
                                composite_layer(&mut actual, &layer, opacity, blend, blank);
                                assert!(
                                    expected.data() == actual.data(),
                                    "{width}x{height} {blend:?} opacity {opacity} blank {blank}"
                                );
                                let mut public = backdrop.clone();
                                let skia = super::super::blend_to_skia(blend);
                                assert!(
                                    composite_bounded(&mut public, &layer, opacity, skia).is_some()
                                );
                                assert!(
                                    expected.data() == public.data(),
                                    "public entry {width}x{height} {blend:?} opacity {opacity}"
                                );
                            }
                        }
                    }
                }
            }
        }
    }

    /// Blend modes that change dst even when src is all zero (clear it, keep only the intersection, ...) cannot be drawn only within the bounding rectangle: the public entry point does not accept them, and `out` is left unchanged.
    #[test]
    fn bounded_composite_refuses_modes_that_touch_the_backdrop() {
        let mut rng = Rng(7);
        let backdrop = filled(9, 7, &mut rng, |_, _| true);
        let layer = filled(9, 7, &mut rng, |x, y| (x, y) == (4, 3));
        for blend in [
            tiny_skia::BlendMode::Clear,
            tiny_skia::BlendMode::Source,
            tiny_skia::BlendMode::DestinationIn,
            tiny_skia::BlendMode::SourceIn,
        ] {
            let mut out = backdrop.clone();
            assert_eq!(
                composite_bounded(&mut out, &layer, 1.0, blend),
                None,
                "{blend:?}"
            );
            assert!(out.data() == backdrop.data(), "{blend:?}");
        }
    }

    /// For the whole `composite`: transparent layers and layers with opacity 0 do not count as drawn; after a blank base is copied as one block, later layers are composited as usual.
    #[test]
    fn composite_pass_matches_sequential_full_draws() {
        let mut rng = Rng(0x2545_f491_4f6c_dd1d);
        let (width, height) = (29, 17);
        let surface = SurfacePlan::canvas(SurfaceId(0), width, height);
        for blend in BlendMode::ALL {
            let stack = layers(width, height, &mut rng);
            let order = [0, 2, 3, 1, 4, 0, 2];
            let inputs: Vec<_> = order
                .iter()
                .enumerate()
                .map(|(slot, &which)| {
                    let input = CompositeInput {
                        surface: SurfaceId(slot as u32 + 1),
                        blend: if slot % 2 == 0 {
                            BlendMode::Normal
                        } else {
                            blend
                        },
                        opacity: [1.0, 0.7, 1.0, 0.0][slot % 4],
                        mask: None,
                    };
                    (input, Arc::new(stack[which].clone()), None)
                })
                .collect();
            let mut expected = Pixmap::new(width, height).unwrap();
            for (input, layer, _) in &inputs {
                full_draw(&mut expected, layer, input.opacity, input.blend);
            }
            let actual = CpuExecutor::default().composite(&surface, &inputs).unwrap();
            assert!(expected.data() == actual.data(), "{blend:?}");
        }
    }
}
