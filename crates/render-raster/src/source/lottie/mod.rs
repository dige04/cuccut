//! `Lottie`: a pure-Rust [`VisualSource`] for the bodymovin subset (design §7 / ADR-M11).
//!
//! **The main path is not rasterization but emitting DrawOps**: shapes / strokes / gradients / masks / precomps all
//! lower to primitives such as `FillPathPaint`, `StrokePathPaint`, `ClipPath` and `PushMatte`,
//! sharing the same instruction stream, frame fingerprint and still-frame cache as BCF's own elements; vector
//! content scales with the element box instead of being baked into a bitmap at the asset's native size and then stretched.
//!
//! The subset boundary was set by a survey of 100 assets on 2026-08-20 (`core/fixtures/lottie/README.md`
//! and design §14 open question #1). **Parsing is the gatekeeper**:
//!
//! | | First-release handling |
//! | --- | --- |
//! | shapes / gradients / trimPaths / masks(add) / mattes / precomps (incl. tm) / solids / images / markers / roundedCorners / blendModes / mergePaths `mm=1` / keyframe animation | Supported |
//! | Expression-controller groups `ef ty ∈ 0..=7` without expressions | Ignored + [`LOTTIE_RULE`] warn |
//! | text layers, expressions, boolean merge, raster effects, repeater, 3D, autoOrient, non-add masks, mask feathering | [`LOTTIE_RULE`] fail-fast |
//!
//! No silent degradation: anything uncertain is reported as an error rather than drawing a "close enough" picture.
//!
//! The bytes may be expanded bodymovin JSON or a `.lottie` archive ([`archive`]): one animation is taken from the archive,
//! and image sub-assets are filled in from the archive as embedded bytes. Image sub-assets may be bitmaps (PNG / JPEG / first GIF frame / WebP) or SVG (`svg` feature,
//! rasterized at the asset's declared `w`×`h`).

pub mod archive;
pub mod geometry;
pub mod lower;
pub mod schema;
pub mod value;

use super::{
    ContentHash, MediaTime, PrepareCtx, SourceFrame, SourceKind, SourceLoop, SourceMetadata,
    VisualSource,
};
use crate::drawop::FrameBuilder;
use crate::plan::PreflightDiagnostic;
use anyhow::{Result, anyhow, bail};
use geometry::Affine;
use schema::{Animation, Diagnostics};
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;
use std::sync::Arc;
use tiny_skia::Pixmap;

/// Diagnostic code from spec §16. Warnings (expression controllers) and failures (outside the subset) share one code,
/// told apart by severity, the way the `ccut lint` table is organized.
pub const LOTTIE_RULE: &str = "lottie-unsupported-feature";

/// Renderer identity inside the fingerprint. Any change to lowering semantics (path generation, trim sample count, gradient stop merging)
/// must change the fingerprint, or old caches would serve stale pixels.
const RENDERER_TAG: &[u8] = b"ccut.source.lottie/v1\0";

/// An image sub-asset referenced by the Lottie document.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ImageRequirement {
    /// bodymovin `assets[].id`
    pub id: String,
    /// Asset name in the DrawOp string side table (globally unique, of the form `lottie:<owner>/<id>`)
    pub asset_name: String,
    /// Path relative to the **directory containing the Lottie document**; `None` for embedded assets
    pub path: Option<String>,
    /// Embedded bytes: a data URI (`e: 1`), or a file found by path in a `.lottie` archive
    pub embedded: Option<Vec<u8>>,
    /// Width and height declared by the asset (`w` / `h`, rounded; 0 if absent). SVG sub-assets are rasterized to this size.
    pub width: u32,
    pub height: u32,
}

impl ImageRequirement {
    /// Sub-asset bytes → premultiplied pixels. SVG (`svg` feature) is rasterized at the declared width and height (or the SVG's own size if none is declared),
    /// bitmaps are decoded at their native size. Failure to decode is a `lottie-asset-missing` error. All read paths (embedded, archive, disk) share this one.
    pub fn decode(&self, bytes: &[u8]) -> Result<Pixmap> {
        let missing =
            |what: String| anyhow!("lottie-asset-missing: 图片子资源 \"{}\" {what}", self.id);
        if looks_like_svg(bytes) {
            return decode_svg(bytes, self.width, self.height)
                .map_err(|e| missing(format!("是 SVG，{e}")));
        }
        let image = image::load_from_memory(bytes)
            .map_err(|e| missing(format!("解不开：{e}")))?
            .to_rgba8();
        let (w, h) = (image.width(), image.height());
        let mut raw = image.into_raw();
        for px in raw.chunks_exact_mut(4) {
            let pm = tiny_skia::ColorU8::from_rgba(px[0], px[1], px[2], px[3]).premultiply();
            px.copy_from_slice(&[pm.red(), pm.green(), pm.blue(), pm.alpha()]);
        }
        tiny_skia::IntSize::from_wh(w, h)
            .and_then(|size| Pixmap::from_vec(raw, size))
            .ok_or_else(|| missing("是零尺寸".into()))
    }
}

/// Whether the bytes look like SVG (after skipping any BOM and leading whitespace, they start with `<svg` / `<?xml`).
fn looks_like_svg(bytes: &[u8]) -> bool {
    let bytes = bytes.strip_prefix(&[0xEF, 0xBB, 0xBF]).unwrap_or(bytes);
    let start = bytes
        .iter()
        .position(|b| !b.is_ascii_whitespace())
        .unwrap_or(bytes.len());
    let head = &bytes[start..];
    head.starts_with(b"<svg") || head.starts_with(b"<?xml")
}

/// Rasterizes an SVG sub-asset to `width`×`height` (each side scaled independently, same convention as bitmap sub-assets filling the declared box); uses the SVG's own size when none is declared.
#[cfg(feature = "svg")]
fn decode_svg(bytes: &[u8], width: u32, height: u32) -> Result<Pixmap> {
    use resvg::usvg::Tree;
    let tree = Tree::from_data(bytes, &crate::svg::svg_options())?;
    let size = tree.size();
    let (sw, sh) = (size.width(), size.height());
    if sw <= 0.0 || sh <= 0.0 {
        bail!("尺寸为零");
    }
    let (w, h) = if width > 0 && height > 0 {
        (width, height)
    } else {
        (sw.ceil() as u32, sh.ceil() as u32)
    };
    let mut pixmap = Pixmap::new(w.max(1), h.max(1)).ok_or_else(|| anyhow!("尺寸为零"))?;
    let transform = tiny_skia::Transform::from_scale(w.max(1) as f32 / sw, h.max(1) as f32 / sh);
    resvg::render(&tree, transform, &mut pixmap.as_mut());
    Ok(pixmap)
}

#[cfg(not(feature = "svg"))]
fn decode_svg(_bytes: &[u8], _width: u32, _height: u32) -> Result<Pixmap> {
    bail!("这份构建不带 SVG 光栅（render-raster 的 `svg` feature）")
}

pub struct Lottie {
    doc: Animation,
    meta: SourceMetadata,
    /// Digest of the document bytes; sub-asset digests are folded in by [`Lottie::attach_images`]
    doc_digest: [u8; 32],
    hash: ContentHash,
    diagnostics: Vec<PreflightDiagnostic>,
    requirements: Vec<ImageRequirement>,
    /// bodymovin asset id → DrawOp asset name
    image_names: BTreeMap<String, String>,
    /// Pixels used for standalone sampling ([`VisualSource::sample`]); the element path goes through `MediaStore`
    images: BTreeMap<String, Arc<Pixmap>>,
    /// `(asset name, byte digest)` of attached sub-assets, sorted by name — recoloring and attaching images in either order yield
    /// the same fingerprint ([`Lottie::rehash`]).
    image_digests: Vec<(String, [u8; 32])>,
}

impl Lottie {
    /// Bytes → validated Lottie source.
    ///
    /// `owner` is the BCF asset id (used to name sub-assets), `src` is used only for error location.
    /// Features outside the subset are `Err` here; warn-level items go into [`Lottie::diagnostics`].
    ///
    /// A `.lottie` archive yields one animation following the rules of [`archive`]; image sub-assets that have only a path are looked up in the archive first, and any found are
    /// turned into [`ImageRequirement::embedded`]; those not found keep their path (and remain `lottie-asset-missing` later).
    pub fn parse(owner: &str, src: &str, bytes: &[u8]) -> Result<Lottie> {
        let zip = if archive::looks_like_zip(bytes) {
            let opened = archive::Archive::open(bytes)
                .map_err(|e| anyhow!("{src}：`.lottie` 压缩包读不开（{e}）"))?;
            let (name, json) = opened.animation().map_err(|e| anyhow!("{src}：{e}"))?;
            Some((opened, name, json))
        } else {
            None
        };
        let (json, label) = match &zip {
            Some((_, name, json)) => (json.as_slice(), format!("{src}#{name}")),
            None => (bytes, src.to_owned()),
        };
        let src = label.as_str();
        let value: serde_json::Value =
            serde_json::from_slice(json).map_err(|e| anyhow!("{src}：不是合法 JSON（{e}）"))?;
        let mut diagnostics = Diagnostics::default();
        let doc = schema::parse(src, &value, &mut diagnostics)?;
        if doc.width <= 0.0 || doc.height <= 0.0 {
            bail!("{src}：合成尺寸非法 {}×{}", doc.width, doc.height);
        }

        let mut requirements = Vec::new();
        let mut image_names = BTreeMap::new();
        for asset in doc.images.values() {
            let asset_name = format!("lottie:{owner}/{}", asset.id);
            image_names.insert(asset.id.clone(), asset_name.clone());
            let embedded = match (&asset.embedded, &asset.path, &zip) {
                (Some(inline), _, _) => Some(inline.clone()),
                (None, Some(path), Some((opened, _, _))) => opened
                    .resolve(path)
                    .map_err(|e| anyhow!("{src}：图片子资源 \"{}\"：{e}", asset.id))?,
                _ => None,
            };
            let side = |v: f64| {
                if v.is_finite() && v > 0.0 {
                    v.round().min(16384.0) as u32
                } else {
                    0
                }
            };
            requirements.push(ImageRequirement {
                id: asset.id.clone(),
                asset_name,
                path: asset.path.clone(),
                embedded,
                width: side(asset.width),
                height: side(asset.height),
            });
        }
        requirements.sort_by(|a, b| a.id.cmp(&b.id));

        let doc_digest: [u8; 32] = {
            let mut hasher = Sha256::new();
            hasher.update(RENDERER_TAG);
            hasher.update(bytes);
            hasher.finalize().into()
        };

        let meta = SourceMetadata {
            kind: SourceKind::Lottie,
            width: doc.width.round().max(1.0) as u32,
            height: doc.height.round().max(1.0) as u32,
            frame_starts_ms: frame_table(doc.ip, doc.op, doc.fr),
            // The Lottie container carries no play count: players always loop, so whether the document writes `loop` is the criterion
            loops: SourceLoop::Infinite,
        };
        Ok(Lottie {
            doc,
            meta,
            doc_digest,
            hash: ContentHash::new(doc_digest),
            diagnostics: diagnostics.into_inner(),
            requirements,
            image_names,
            images: BTreeMap::new(),
            image_digests: Vec::new(),
        })
    }

    /// Decodes and attaches **embedded** image sub-assets (data URIs or files in a `.lottie` archive; bitmaps and SVG see [`ImageRequirement::decode`]),
    /// without touching disk or depending on `media`; the preview WASM and native builds share this code. Sub-assets that have only a path and no embedded bytes, or in an undecodable format, are
    /// `lottie-asset-missing` errors. Returns the number attached.
    pub fn attach_embedded_images(&mut self) -> Result<usize> {
        let mut loaded = Vec::new();
        for requirement in &self.requirements {
            let Some(bytes) = &requirement.embedded else {
                bail!(
                    "lottie-asset-missing: 图片子资源 \"{}\"（{}）不是内嵌的",
                    requirement.id,
                    requirement.path.as_deref().unwrap_or("<无路径>")
                );
            };
            let pixmap = requirement.decode(bytes)?;
            loaded.push((
                requirement.asset_name.clone(),
                bytes.clone(),
                Arc::new(pixmap),
            ));
        }
        let count = loaded.len();
        self.attach_images(loaded);
        Ok(count)
    }

    /// Lottie landing point for the product-level `sticker.fillOverrides`: replaces, in the document, every **solid-color** fill /
    /// stroke (`fl` / `st`, including the first and last keyframe values of animated ones) and solid layers (solid) whose color equals
    /// an override key, with the corresponding value. Keys and values are `#RRGGBB` (case-insensitive; a value with `AA`
    /// contributes only its RGB — Lottie opacity is a separate property and is not part of recoloring).
    ///
    /// Gradients are not replaced: the SVG-side `svg_fill::apply_overrides` likewise only recognizes solid colors, so both sides use the same convention,
    /// and the property page only samples editable colors from solid fills.
    ///
    /// Returns the number of properties hit. The override table is folded into the content fingerprint, so two Lottie
    /// files from the same source with different override tables must have different fingerprints (still-frame caches and asset sharing both key on the fingerprint).
    pub fn apply_fill_overrides(&mut self, overrides: &BTreeMap<String, String>) -> usize {
        let table: Vec<([f64; 3], [f64; 3])> = overrides
            .iter()
            .filter_map(|(from, to)| Some((parse_hex_rgb(from)?, parse_hex_rgb(to)?)))
            .collect();
        if table.is_empty() {
            return 0;
        }
        let mut hits = 0;
        for layer in self
            .doc
            .layers
            .iter_mut()
            .chain(self.doc.precomps.values_mut().flatten())
        {
            match &mut layer.kind {
                schema::LayerKind::Solid { color, .. } => {
                    if let Some(to) = lookup_color(&table, *color) {
                        *color = to;
                        hits += 1;
                    }
                }
                schema::LayerKind::Shape(items) => hits += recolor_shapes(items, &table),
                _ => {}
            }
        }
        if hits > 0 {
            let mut hasher = Sha256::new();
            hasher.update(RENDERER_TAG);
            hasher.update(self.doc_digest);
            hasher.update(b"fill-overrides\0");
            for (from, to) in overrides {
                hasher.update((from.len() as u32).to_le_bytes());
                hasher.update(from.to_ascii_lowercase().as_bytes());
                hasher.update((to.len() as u32).to_le_bytes());
                hasher.update(to.to_ascii_lowercase().as_bytes());
            }
            self.doc_digest = hasher.finalize().into();
            self.rehash();
        }
        hits
    }

    /// Warning-level diagnostics (expression controllers, etc.). Failure-level ones are `Err` already in [`Lottie::parse`].
    pub fn diagnostics(&self) -> &[PreflightDiagnostic] {
        &self.diagnostics
    }

    /// Image sub-assets the host must preload (sorted by asset id, deterministic).
    pub fn image_requirements(&self) -> &[ImageRequirement] {
        &self.requirements
    }

    /// Attaches decoded sub-assets and folds their byte digests into the content fingerprint.
    ///
    /// `loaded` is `(asset name, raw bytes, decoded pixels)`; order does not matter — the function sorts by asset name
    /// before feeding the hash chain, so the host gets the same fingerprint whatever order it reads files in.
    pub fn attach_images(&mut self, loaded: Vec<(String, Vec<u8>, Arc<Pixmap>)>) {
        for (name, bytes, pixmap) in loaded {
            let digest: [u8; 32] = Sha256::digest(&bytes).into();
            self.image_digests.retain(|(existing, _)| *existing != name);
            self.image_digests.push((name.clone(), digest));
            self.images.insert(name, pixmap);
        }
        self.image_digests.sort_by(|a, b| a.0.cmp(&b.0));
        self.rehash();
    }

    /// Content fingerprint = renderer identity ∘ document digest (including the recolor table) ∘ sub-asset digest chain.
    fn rehash(&mut self) {
        let mut hasher = Sha256::new();
        hasher.update(RENDERER_TAG);
        hasher.update(self.doc_digest);
        for (name, digest) in &self.image_digests {
            hasher.update((name.len() as u32).to_le_bytes());
            hasher.update(name.as_bytes());
            hasher.update(digest);
        }
        self.hash = ContentHash::new(hasher.finalize().into());
    }

    pub fn metadata(&self) -> &SourceMetadata {
        &self.meta
    }

    /// Composition frame rate.
    pub fn frame_rate(&self) -> f64 {
        self.doc.fr
    }

    /// Per-frame start time table in milliseconds (N+1 entries) — `HostInputs` backfills it to core; during recording it quantizes source
    /// time to the frame start, so every time within the same frame window emits byte-identical instructions.
    pub fn frame_starts_ms(&self) -> &[i64] {
        &self.meta.frame_starts_ms
    }

    /// bodymovin `markers` (name → frame number / duration).
    pub fn markers(&self) -> Vec<(String, f64, f64)> {
        self.doc
            .markers
            .iter()
            .map(|m| (m.name.clone(), m.time, m.duration))
            .collect()
    }

    /// Source time → composition frame number (quantized to the frame start first, then converted to an integer frame).
    fn frame_at(&self, time: MediaTime) -> f64 {
        self.doc.ip + self.meta.frame_at(time) as f64
    }

    /// **Official entry point for the element path**: records the frame at `time` directly into the instruction stream.
    ///
    /// `tf` places Lottie's composition coordinate system (top-left origin, `w × h`) onto the canvas; it is usually
    /// “element box transform ∘ fit scaling”.
    pub fn record(
        &self,
        time: MediaTime,
        tf: tiny_skia::Transform,
        b: &mut FrameBuilder,
    ) -> Result<()> {
        let affine = Affine {
            sx: f64::from(tf.sx),
            ky: f64::from(tf.ky),
            kx: f64::from(tf.kx),
            sy: f64::from(tf.sy),
            tx: f64::from(tf.tx),
            ty: f64::from(tf.ty),
        };
        lower::Lowering::new(&self.doc, &self.image_names).record(self.frame_at(time), affine, b)
    }
}

/// Per-frame start-time table in milliseconds for `[ip, op)`. Integer arithmetic: `round(k * 1000 / fr)`.
fn frame_table(ip: f64, op: f64, fr: f64) -> Vec<i64> {
    let count = (op - ip).max(0.0).round() as i64;
    let count = count.max(1);
    (0..=count)
        .map(|k| ((k as f64) * 1000.0 / fr).round() as i64)
        .collect()
}

/// `#RRGGBB` / `#RRGGBBAA` → RGB in 0..1; any other form is always `None` (same convention as SVG recoloring).
fn parse_hex_rgb(text: &str) -> Option<[f64; 3]> {
    let hex = text.trim().strip_prefix('#')?;
    if hex.len() != 6 && hex.len() != 8 {
        return None;
    }
    let channel = |at: usize| u8::from_str_radix(hex.get(at..at + 2)?, 16).ok();
    Some([
        f64::from(channel(0)?) / 255.0,
        f64::from(channel(2)?) / 255.0,
        f64::from(channel(4)?) / 255.0,
    ])
}

/// Property value (3 or 4 components, in either the 0..1 or 0..255 dialect) → 8-bit quantized RGB triple.
fn quantised_rgb(value: &[f64]) -> Option<[u8; 3]> {
    if value.len() < 3 {
        return None;
    }
    let mut rgb = [value[0], value[1], value[2]];
    if rgb.iter().any(|c| *c > 1.0) {
        for c in rgb.iter_mut() {
            *c /= 255.0;
        }
    }
    Some(rgb.map(|c| (c.clamp(0.0, 1.0) * 255.0).round() as u8))
}

fn lookup_color(table: &[([f64; 3], [f64; 3])], value: [f64; 3]) -> Option<[f64; 3]> {
    let wanted = quantised_rgb(&value)?;
    table
        .iter()
        .find(|(from, _)| quantised_rgb(from) == Some(wanted))
        .map(|(_, to)| *to)
}

/// Replaces all solid color values in one `Animated` color (static value, keyframe segment starts, and segment ends).
fn recolor_animated(color: &mut value::Animated, table: &[([f64; 3], [f64; 3])]) -> usize {
    let mut hits = 0;
    let mut swap = |slot: &mut Vec<f64>| {
        if slot.len() < 3 {
            return;
        }
        if let Some(to) = lookup_color(table, [slot[0], slot[1], slot[2]]) {
            slot[0] = to[0];
            slot[1] = to[1];
            slot[2] = to[2];
            hits += 1;
        }
    };
    match color {
        value::Animated::Static(values) => swap(values),
        value::Animated::Keyframed(frames) => {
            for frame in frames {
                swap(&mut frame.start);
                if let Some(end) = frame.end.as_mut() {
                    swap(end);
                }
            }
        }
    }
    hits
}

fn recolor_shapes(items: &mut [schema::ShapeItem], table: &[([f64; 3], [f64; 3])]) -> usize {
    let mut hits = 0;
    for item in items {
        match item {
            schema::ShapeItem::Group { items } => hits += recolor_shapes(items, table),
            schema::ShapeItem::Fill { color, .. } | schema::ShapeItem::Stroke { color, .. } => {
                hits += recolor_animated(color, table);
            }
            _ => {}
        }
    }
    hits
}

impl Lottie {
    /// Rasterizes one frame at the **specified pixel size**: the composition coordinate system is scaled uniformly to `width × height`.
    ///
    /// [`VisualSource::sample`] always uses the asset's native size, but in the GPU scene this texture is drawn into the element
    /// box — a 1024² original drawn into a 461² sticker box would make the surplus four-times pixels allocated, composited and uploaded layer by layer on the CPU,
    /// and finally shrunk by the GPU. Scaling is pinned **before rasterization** (on the affine of `record`), so vector geometry, stroke widths and masks are evaluated at the target size, not by first producing a large image
    /// and resampling it.
    pub fn sample_scaled(&self, time: MediaTime, width: u32, height: u32) -> Result<SourceFrame> {
        let width = width.max(1);
        let height = height.max(1);
        let index = self.meta.frame_at(time);
        let mut builder = FrameBuilder::default();
        let tf = tiny_skia::Transform::from_scale(
            width as f32 / self.meta.width.max(1) as f32,
            height as f32 / self.meta.height.max(1) as f32,
        );
        self.record(time, tf, &mut builder)?;
        let ops = builder.finish();
        let pixmap =
            crate::raster::rasterize_with_media(&ops, width, height, &mut OwnImages(&self.images))?;
        Ok(SourceFrame {
            index,
            start: MediaTime::from_millis(self.meta.frame_starts_ms[index]),
            pixmap: Arc::new(pixmap),
        })
    }
}

/// Media entry point for [`VisualSource::sample`]: Lottie's own sub-assets.
struct OwnImages<'a>(&'a BTreeMap<String, Arc<Pixmap>>);

impl crate::raster::FrameMedia for OwnImages<'_> {
    fn frame(&mut self, id: &str, _media_ms: i64) -> Result<Arc<Pixmap>> {
        self.0
            .get(id)
            .cloned()
            .ok_or_else(|| anyhow!("Lottie 子资源 \"{id}\" 未加载"))
    }
}

impl VisualSource for Lottie {
    fn kind(&self) -> SourceKind {
        SourceKind::Lottie
    }

    fn probe(&self) -> Result<SourceMetadata> {
        Ok(self.meta.clone())
    }

    /// Sub-assets are collected on the host side and attached via [`Lottie::attach_images`]; here we only re-check that they are complete.
    fn prepare(&self, _ctx: &PrepareCtx) -> Result<()> {
        for requirement in &self.requirements {
            if !self.images.contains_key(&requirement.asset_name) {
                bail!(
                    "lottie-asset-missing: 图片子资源 \"{}\"（{}）没有被加载",
                    requirement.id,
                    requirement.path.as_deref().unwrap_or("<内嵌>")
                );
            }
        }
        Ok(())
    }

    /// General sampling entry point: rasterizes one frame at the **asset's native size**.
    ///
    /// Element rendering **does not go through here** (that path is [`Lottie::record`], which emits DrawOps directly and scales with
    /// the element box); this function is kept for source conformance, the thumbnails of `ccut probe`, and any future caller that treats Lottie as a plain image source.
    ///
    /// The GPU scene needs a texture rather than an instruction stream, so it too must take pixels from this path — but it must
    /// go through [`Lottie::sample_scaled`] and request the element box's actual pixel size, not the original asset size.
    fn sample(&self, time: MediaTime) -> Result<SourceFrame> {
        self.sample_scaled(time, self.meta.width, self.meta.height)
    }

    fn fingerprint(&self) -> ContentHash {
        self.hash
    }
}

impl std::fmt::Debug for Lottie {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Lottie")
            .field("version", &self.doc.version)
            .field("size", &(self.meta.width, self.meta.height))
            .field("fps", &self.doc.fr)
            .field("frames", &self.meta.frame_count())
            .field("images", &self.requirements.len())
            .field("diagnostics", &self.diagnostics.len())
            .finish()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn doc(extra: serde_json::Value) -> Vec<u8> {
        let mut base = serde_json::json!({
            "v": "5.7.0", "fr": 25, "ip": 0, "op": 50, "w": 64, "h": 48, "layers": []
        });
        for (k, v) in extra.as_object().unwrap() {
            base[k] = v.clone();
        }
        serde_json::to_vec(&base).unwrap()
    }

    #[test]
    fn metadata_comes_from_the_composition_header() {
        let lottie = Lottie::parse("logo", "logo.json", &doc(serde_json::json!({}))).unwrap();
        let meta = lottie.probe().unwrap();
        assert_eq!(meta.kind, SourceKind::Lottie);
        assert_eq!((meta.width, meta.height), (64, 48));
        assert_eq!(meta.frame_count(), 50);
        assert_eq!(meta.total_ms(), 2000, "50 帧 @25fps = 2s");
        assert_eq!(meta.loops, SourceLoop::Infinite);
    }

    #[test]
    fn the_frame_table_quantises_time_to_whole_composition_frames() {
        let lottie = Lottie::parse("l", "l.json", &doc(serde_json::json!({}))).unwrap();
        // 25 fps ⇒ 40 ms per frame
        assert_eq!(lottie.frame_starts_ms()[..3], [0, 40, 80]);
        assert_eq!(lottie.frame_at(MediaTime::from_millis(0)), 0.0);
        assert_eq!(lottie.frame_at(MediaTime::from_millis(39)), 0.0);
        assert_eq!(lottie.frame_at(MediaTime::from_millis(40)), 1.0);
        assert_eq!(lottie.frame_at(MediaTime::from_millis(79)), 1.0);
    }

    /// Product-level recoloring: matched solid colors are replaced and the fingerprint changes with them; nothing is touched when nothing matches.
    #[test]
    fn fill_overrides_recolour_flat_fills_and_change_the_fingerprint() {
        let bytes = std::fs::read(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/tests/fixtures/lottie/samples/shapes-only.json"
        ))
        .unwrap();
        let plain = Lottie::parse("s", "shapes-only.json", &bytes).unwrap();
        let mut recoloured = Lottie::parse("s", "shapes-only.json", &bytes).unwrap();
        let mut miss = Lottie::parse("s", "shapes-only.json", &bytes).unwrap();

        let mut overrides = BTreeMap::new();
        // The fixture's fill is [0.13, 0.44, 0.9] ⇒ #2170e6 (compared after 8-bit quantization, case-insensitive).
        overrides.insert("#2170E6".to_owned(), "#00C853".to_owned());
        assert_eq!(recoloured.apply_fill_overrides(&overrides), 1);
        assert_ne!(plain.fingerprint(), recoloured.fingerprint());

        let mut unrelated = BTreeMap::new();
        unrelated.insert("#ff0000".to_owned(), "#00C853".to_owned());
        assert_eq!(miss.apply_fill_overrides(&unrelated), 0);
        assert_eq!(plain.fingerprint(), miss.fingerprint());

        let before = plain.sample(MediaTime::from_millis(0)).unwrap().pixmap;
        let after = recoloured.sample(MediaTime::from_millis(0)).unwrap().pixmap;
        let centre = |pixmap: &Pixmap| pixmap.pixel(100, 100).unwrap();
        assert!(centre(&before).blue() > centre(&before).green());
        assert!(centre(&after).green() > centre(&after).blue());
    }

    /// A 4×4 solid-color PNG.
    fn png(rgba: [u8; 4]) -> Vec<u8> {
        let image = image::RgbaImage::from_pixel(4, 4, image::Rgba(rgba));
        let mut out = std::io::Cursor::new(Vec::new());
        image.write_to(&mut out, image::ImageFormat::Png).unwrap();
        out.into_inner()
    }

    /// The composition has only one image layer, referencing `img_0`.
    fn image_doc(asset: serde_json::Value) -> serde_json::Value {
        let mut asset = asset;
        asset["id"] = serde_json::json!("img_0");
        serde_json::json!({
            "v": "5.7.0", "fr": 25, "ip": 0, "op": 25, "w": 8, "h": 8, "assets": [asset],
            "layers": [{"ty": 2, "ind": 1, "refId": "img_0", "ip": 0, "op": 25, "st": 0, "ks": {}}]
        })
    }

    fn centre(lottie: &Lottie) -> [u8; 4] {
        let frame = lottie.sample(MediaTime::from_millis(0)).unwrap().pixmap;
        let px = frame.pixel(1, 1).unwrap();
        [px.red(), px.green(), px.blue(), px.alpha()]
    }

    #[test]
    fn a_dotlottie_archive_draws_its_animation_with_images_from_the_archive() {
        let json = serde_json::to_vec(&image_doc(
            serde_json::json!({"w": 4, "h": 4, "u": "/images/", "p": "img_0.png"}),
        ))
        .unwrap();
        let bytes = archive::tests::zip(&[
            (
                "manifest.json",
                br#"{"version":"1","activeAnimationId":"hero","animations":[{"id":"hero"}]}"#,
                true,
            ),
            ("animations/hero.json", &json, true),
            ("images/img_0.png", &png([255, 0, 0, 255]), false),
        ]);
        let mut lottie = Lottie::parse("l", "hero.lottie", &bytes).unwrap();
        assert_eq!(lottie.probe().unwrap().width, 8);
        assert!(
            lottie.image_requirements()[0].embedded.is_some(),
            "包里的图片补成内嵌字节"
        );
        assert_eq!(lottie.attach_embedded_images().unwrap(), 1);
        assert_eq!(centre(&lottie), [255, 0, 0, 255]);

        // The archive lacks this image: it is still `lottie-asset-missing`.
        let bytes = archive::tests::zip(&[("animations/hero.json", &json, true)]);
        let mut lottie = Lottie::parse("l", "hero.lottie", &bytes).unwrap();
        let error = lottie.attach_embedded_images().unwrap_err().to_string();
        assert!(error.starts_with("lottie-asset-missing"), "{error}");

        // An archive that cannot be opened and an archive with no animation are parse errors.
        assert!(
            Lottie::parse("l", "l.lottie", b"PK\x03\x04rest")
                .unwrap_err()
                .to_string()
                .contains("压缩包读不开")
        );
        let empty = archive::tests::zip(&[("images/img_0.png", b"x", false)]);
        assert!(
            Lottie::parse("l", "l.lottie", &empty)
                .unwrap_err()
                .to_string()
                .contains("没有动画")
        );
    }

    #[cfg(feature = "svg")]
    #[test]
    fn svg_images_are_rasterised_at_their_declared_size() {
        // A 2×2 SVG declared as 4×4: fills the declared box.
        let svg = r#"<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"><rect width="2" height="2" fill="%2300ff00"/></svg>"#;
        let doc = image_doc(
            serde_json::json!({"w": 4, "h": 4, "e": 1, "p": format!("data:image/svg+xml;utf8,{svg}")}),
        );
        let mut lottie = Lottie::parse("l", "l.json", &serde_json::to_vec(&doc).unwrap()).unwrap();
        lottie.attach_embedded_images().unwrap();
        assert_eq!(centre(&lottie), [0, 255, 0, 255]);
        let frame = lottie.sample(MediaTime::from_millis(0)).unwrap().pixmap;
        assert_eq!(frame.pixel(3, 3).unwrap().alpha(), 255, "铺满 4×4");
        assert_eq!(frame.pixel(5, 5).unwrap().alpha(), 0, "框外是空的");

        // The same applies to SVG files in the archive.
        let json = serde_json::to_vec(&image_doc(
            serde_json::json!({"w": 4, "h": 4, "u": "images/", "p": "a.svg"}),
        ))
        .unwrap();
        let bytes = archive::tests::zip(&[
            ("animations/a.json", &json, true),
            ("images/a.svg", svg.replace("%23", "#").as_bytes(), true),
        ]);
        let mut lottie = Lottie::parse("l", "a.lottie", &bytes).unwrap();
        lottie.attach_embedded_images().unwrap();
        assert_eq!(centre(&lottie), [0, 255, 0, 255]);

        // Broken SVG: `lottie-asset-missing`.
        let doc = image_doc(
            serde_json::json!({"w": 4, "h": 4, "e": 1, "p": "data:image/svg+xml;utf8,<svg"}),
        );
        let mut lottie = Lottie::parse("l", "l.json", &serde_json::to_vec(&doc).unwrap()).unwrap();
        let error = lottie.attach_embedded_images().unwrap_err().to_string();
        assert!(error.starts_with("lottie-asset-missing"), "{error}");
    }

    #[test]
    fn sub_assets_change_the_fingerprint_and_prepare_refuses_missing_ones() {
        let bytes = doc(serde_json::json!({
            "assets": [{"id": "img_0", "w": 4, "h": 4, "u": "images/", "p": "a.png"}]
        }));
        let mut lottie = Lottie::parse("hero", "hero.json", &bytes).unwrap();
        assert_eq!(lottie.image_requirements().len(), 1);
        assert_eq!(
            lottie.image_requirements()[0].asset_name,
            "lottie:hero/img_0"
        );
        assert_eq!(
            lottie.image_requirements()[0].path.as_deref(),
            Some("images/a.png")
        );
        let bare = lottie.fingerprint();
        assert!(lottie.prepare(&PrepareCtx::default()).is_err());

        let pixmap = Arc::new(Pixmap::new(4, 4).unwrap());
        lottie.attach_images(vec![(
            "lottie:hero/img_0".into(),
            b"one".to_vec(),
            pixmap.clone(),
        )]);
        let with_a = lottie.fingerprint();
        assert_ne!(bare, with_a, "子资源必须进内容指纹");
        assert!(lottie.prepare(&PrepareCtx::default()).is_ok());

        let mut other = Lottie::parse("hero", "hero.json", &bytes).unwrap();
        other.attach_images(vec![("lottie:hero/img_0".into(), b"two".to_vec(), pixmap)]);
        assert_ne!(with_a, other.fingerprint(), "换一张子资源就换指纹");
    }

    #[test]
    fn sampling_is_random_access_and_frame_stable() {
        let bytes = doc(serde_json::json!({
            "layers": [{"ty": 4, "ind": 1, "ip": 0, "op": 50, "st": 0,
                "ks": {"p": {"a": 1, "k": [
                    {"t": 0, "s": [0, 0], "o": {"x": [0], "y": [0]}, "i": {"x": [1], "y": [1]}},
                    {"t": 50, "s": [40, 0]}]}},
                "shapes": [{"ty": "gr", "it": [
                    {"ty": "rc", "p": {"a": 0, "k": [10, 10]}, "s": {"a": 0, "k": [16, 16]},
                     "r": {"a": 0, "k": 0}},
                    {"ty": "fl", "c": {"a": 0, "k": [1, 0, 0]}, "o": {"a": 0, "k": 100}},
                    {"ty": "tr", "p": {"a": 0, "k": [0, 0]}, "a": {"a": 0, "k": [0, 0]},
                     "s": {"a": 0, "k": [100, 100]}, "r": {"a": 0, "k": 0},
                     "o": {"a": 0, "k": 100}}]}]}]
        }));
        let lottie = Lottie::parse("l", "l.json", &bytes).unwrap();
        let times: Vec<i64> = vec![0, 200, 400, 800, 1200, 1960];
        let forward: Vec<Vec<u8>> = times
            .iter()
            .map(|ms| {
                lottie
                    .sample(MediaTime::from_millis(*ms))
                    .unwrap()
                    .pixmap
                    .data()
                    .to_vec()
            })
            .collect();
        let shuffled: Vec<Vec<u8>> = times
            .iter()
            .rev()
            .map(|ms| {
                lottie
                    .sample(MediaTime::from_millis(*ms))
                    .unwrap()
                    .pixmap
                    .data()
                    .to_vec()
            })
            .collect();
        assert_eq!(
            forward,
            shuffled.into_iter().rev().collect::<Vec<_>>(),
            "乱序采样必须逐字节等于顺序采样"
        );
        // Two times within the same frame window get the same picture
        let a = lottie.sample(MediaTime::from_millis(200)).unwrap();
        let b = lottie.sample(MediaTime::from_millis(239)).unwrap();
        assert_eq!(a.index, b.index);
        assert_eq!(a.pixmap.data(), b.pixmap.data());
        // Must change across a frame boundary (position is moving)
        let c = lottie.sample(MediaTime::from_millis(240)).unwrap();
        assert_ne!(a.pixmap.data(), c.pixmap.data());
    }
}
