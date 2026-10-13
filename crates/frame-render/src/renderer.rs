//! Draws one frame from the frame plan (architecture design §9.3).
//!
//! - The output is RGBA of `width`×`height`; an instance's geometry is in percentages of the canvas, and the kernel lays it out at the output size, so the output has the same aspect ratio as the sequence canvas;
//! - First a black background is laid down (the final render has no alpha channel), then the canvas background color is laid down per `backgroundAlpha`;
//! - Layers are drawn bottom to top: each layer is drawn by the kernel as a transparent layer the same size as the output (geometry, keyframes, element animation, masks, tiling and opacity all happen inside it); stroke and shadow are applied; and during transitions it is combined with the other side per [`crate::transition`] before being composited below;
//! - Picture sources for video and bitmaps come from [`LayerMedia`]. SVG images (asset version `mediaType` is `image/svg+xml`) are rasterized here from the asset bytes at the output's long edge; for stickers, colors are first replaced per `fillOverrides` (`timeline::svg_fill`). GIF images (`image/gif`) are decoded here from the asset bytes into an animation, and the frame is picked by how long since the instance started ([`crate::Gif::frame_at`]). Preview and export share one implementation for both. After cropping, `fx` 1–10 is applied before injecting into the kernel; kinds with no source picture (template stickers, empty placeholder boxes) have 1–10 applied to the finished layer;
//! - Captions are grouped by style document and drawn once at the position of the first layer in the group; template layers are drawn by the kernel's template rasterizer;
//! - Things that cannot be drawn are reported as errors, judged per [`crate::support`], or in skip mode are not drawn and are recorded;
//! - Blending is done on sRGB-encoded values, consistent with Canvas 2D.

use std::collections::{BTreeMap, BTreeSet, HashMap, HashSet};
use std::sync::Arc;

use render_graph::audio_plan::AudioSegment;
use render_graph::{FramePlan, LayerContent, LayerKind, TransitionRole, VideoView, VisualLayer};
use render_raster::TextEngine;
use render_raster::fonts::{FaceLog, FaceUse};
use render_raster::source::{Lottie, MediaTime, VizParams, VizSource, VizTrack};
use serde::Serialize;
use serde_json::{Value, json};
use subtitle_render::{DynamicAssetNames, OverlayIncludes, OverlayRenderPlan, TimelineVisualElement};
use tiny_skia::{BlendMode, Color, FilterQuality, IntSize, Pixmap, PixmapPaint, PixmapRef, Rect, Transform};
use video_model::{AssetRecord, Fx, Id, Sequence, TimelineItem, VersionRef};

use crate::caption_words::{SpeechWords, place};
use crate::captions::{CaptionHit, CaptionPlan, CaptionStyle, is_translation, read_captions};
use crate::documents::Documents;
use crate::effects::{apply_to_layer, apply_to_source, hex_rgba, needs_layer_pass};
use crate::element::{source_id, visual_element};
use crate::spectrum::{self, Route, SpeakerActivity};
use crate::support::{CaptionProblem, UnsupportedItem, caption_problem, check_layer, check_layer_with, check_transition, kind_name};
use crate::template::TemplateScenes;
use crate::text_measure::{TextBox, measure_text_element};
use crate::transition::{BoxGeom, compose, effective_progress};

/// Composition failed. `items` are the things that could not be drawn and were encountered when not skipping (error code `EXPORT_UNSUPPORTED_CONTENT`).
#[derive(Clone, Debug, PartialEq)]
pub struct RenderError {
    pub code: String,
    pub message: String,
    pub items: Vec<UnsupportedItem>,
}

impl RenderError {
    pub fn new(code: &str, message: impl Into<String>) -> RenderError {
        RenderError {
            code: code.into(),
            message: message.into(),
            items: Vec::new(),
        }
    }

    fn render(error: anyhow::Error) -> RenderError {
        RenderError::new("EXPORT_RENDER_FAILED", format!("frame render failed: {error:#}"))
    }
}

impl std::fmt::Display for RenderError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}: {}", self.code, self.message)
    }
}

impl std::error::Error for RenderError {}

/// Warnings reported during composition (they do not affect whether the picture can be drawn).
#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct RenderWarning {
    pub code: &'static str,
    pub detail: String,
}

/// Notices from the rendering kernel (font substitution, missing glyphs, audio waveforms with no spectrum, and so on).
pub const RENDER_NOTE: &str = "EXPORT_RENDER_NOTE";

/// Where the layer's assets come from (on export, decoders and asset files; in preview, frames the host supplies).
pub trait LayerMedia {
    /// The picture of a video or image layer at this moment (at the source's display size, premultiplied RGBA). `None`: this layer's asset is in the skipped list, so it is not drawn.
    fn picture(&mut self, layer: &VisualLayer) -> Result<Option<&Pixmap>, RenderError>;

    /// Raw bytes of the asset (Lottie stickers read them). None by default.
    fn asset_bytes(&mut self, _asset: &VersionRef) -> Option<Vec<u8>> {
        None
    }

    /// A ready-made full-track spectrum for an audio waveform instance (BCS1; frame k is sequence time `k / 60`): used directly if present (the UI's thumbnails supply an illustrative spectrum). None by default; otherwise it is assembled from the asset's spectrum according to the sound plan ([`crate::spectrum`]).
    fn spectrum(&mut self, _item_id: &str) -> Option<Vec<u8>> {
        None
    }

    /// The asset's spectrum (BCS1, ordered by the asset's source time). None by default: an audio waveform that uses it is drawn in a static form, and a notice is reported.
    fn audio_spectrum(&mut self, _asset: &VersionRef) -> Option<Vec<u8>> {
        None
    }
}

#[derive(Clone, Debug)]
pub struct RenderOptions {
    pub width: u32,
    pub height: u32,
    /// Things that cannot be drawn are skipped (the layer is not drawn, the effect is skipped, the transition becomes a hard cut) and recorded; otherwise an error is reported.
    pub skip_unsupported: bool,
    /// Draw the caption layer (`burnCaptions`). When off, the caption layer is not drawn, and this does not count as undrawable.
    pub captions: bool,
}

/// A finished layer: a transparent layer the same size as the output, along with its box (transitions are drawn by box; template layers have no box).
struct DrawnLayer {
    pixmap: Pixmap,
    geom: Option<BoxGeom>,
}

pub struct FrameRenderer {
    options: RenderOptions,
    documents: Documents,
    /// Font bytes handed to the kernel (shared: several layout engines take up only one copy in memory).
    fonts: Vec<Arc<Vec<u8>>>,
    frame: Pixmap,
    /// The kernel plan used to draw instances: compiled once, with each layer swapping `elements` for that instance.
    elements: Option<OverlayRenderPlan>,
    captions: HashMap<String, CaptionPlan>,
    /// Whether each `(caption document, style document)` pair can be drawn ([`caption_problem`]): changes only with the documents, and is cleared when documents are swapped.
    caption_checks: HashMap<(String, Option<String>), Option<CaptionProblem>>,
    /// The edit signature of each `(sequence, caption group)` ([`Self::caption_signature`]): cleared when the documents or the sequence change ([`Self::sequence_changed`]).
    caption_signatures: HashMap<(String, String), String>,
    collect_caption_hits: bool,
    caption_hits: Vec<CaptionHit>,
    templates: TemplateScenes,
    lotties: HashMap<String, Option<Arc<Lottie>>>,
    /// Pictures of SVG images rasterized at the output long edge (key is `asset ID@version`; a recolored one uses its variant ID); `None` if they cannot be read. Invalidated when the size changes.
    svgs: HashMap<String, Option<Arc<Pixmap>>>,
    /// Decoded GIFs (key is `asset ID@version`); `None` if they cannot be read. Independent of output size, so kept when the size changes.
    gifs: HashMap<String, Option<Arc<crate::Gif>>>,
    /// Audio waveform instance → its spectrum track (reassembled when the key changes).
    viz: HashMap<String, VizEntry>,
    /// The intervals in which each speaker talks on the sequence (used by the waveform's `speaker`); `None` means the video has no transcript.
    speakers: Option<Arc<SpeakerActivity>>,
    /// Asset spectra that this frame uses but that are not yet available (instance and asset).
    missing_spectra: Vec<(String, VersionRef)>,
    warnings: Vec<RenderWarning>,
    skipped: Vec<UnsupportedItem>,
    skipped_keys: HashSet<String>,
    /// No background is laid down (the UI's thumbnails need a transparent background): the frame is premultiplied RGBA.
    transparent: bool,
    /// Layout engine taken apart when the size or documents change: the next kernel plan reuses it, so fonts are not parsed again.
    engines: Vec<TextEngine>,
    /// Families named when laying out each text instance that are not in the font library (persistent: the kernel caches laid-out glyphs, and later frames do not lay out again, so these must still be reported). Cleared when fonts change.
    item_fonts: HashMap<String, BTreeSet<String>>,
    /// Families used by the layers drawn so far that are not in the font library (cleared by `clear_reports`).
    missing_fonts: BTreeSet<String>,
    /// Faces named during layout (shared by several layout engines, persistent): the host uses them to look for faces in local fonts ([`Self::used_faces`]).
    face_log: FaceLog,
}

/// Keeps a few layout engines in reserve (each has all the fonts installed).
const SPARE_ENGINES: usize = 2;

impl FrameRenderer {
    /// `fonts` are the font bytes handed to the kernel; the first is the fallback font (native export uses [`crate::bundled_fonts`]; the preview has the host inject the same set).
    pub fn new(options: RenderOptions, documents: Documents, fonts: Vec<Vec<u8>>) -> Result<FrameRenderer, RenderError> {
        Self::with_shared_fonts(options, documents, fonts.into_iter().map(Arc::new).collect())
    }

    /// [`Self::new`], with font bytes shared with the caller (the preview keeps one copy of the fonts, and rebuilding the renderer does not copy them again).
    pub fn with_shared_fonts(options: RenderOptions, documents: Documents, fonts: Vec<Arc<Vec<u8>>>) -> Result<FrameRenderer, RenderError> {
        let frame = Pixmap::new(options.width, options.height)
            .ok_or_else(|| RenderError::new("INVALID_PARAMS", format!("output size {}×{} is unavailable", options.width, options.height)))?;
        if fonts.is_empty() || fonts.iter().any(|bytes| bytes.is_empty()) {
            return Err(RenderError::new("INVALID_PARAMS", "rendering needs at least one fallback font"));
        }
        Ok(FrameRenderer {
            options,
            documents,
            fonts,
            frame,
            elements: None,
            captions: HashMap::new(),
            caption_checks: HashMap::new(),
            caption_signatures: HashMap::new(),
            collect_caption_hits: false,
            caption_hits: Vec::new(),
            templates: TemplateScenes::default(),
            lotties: HashMap::new(),
            svgs: HashMap::new(),
            gifs: HashMap::new(),
            viz: HashMap::new(),
            speakers: None,
            missing_spectra: Vec::new(),
            warnings: Vec::new(),
            skipped: Vec::new(),
            skipped_keys: HashSet::new(),
            transparent: false,
            engines: Vec::new(),
            item_fonts: HashMap::new(),
            missing_fonts: BTreeSet::new(),
            face_log: FaceLog::default(),
        })
    }

    /// Replaces the speaker intervals (computed from the video's transcript by `render_graph::audio_plan::speaker_activity`; `None` means the video has no transcript).
    /// Left alone if identical to the previous set; if different, the waveform tracks are invalidated and reassembled on the next frame.
    pub fn set_speakers(&mut self, speakers: Option<Arc<SpeakerActivity>>) {
        let same = match (&self.speakers, &speakers) {
            (None, None) => true,
            (Some(a), Some(b)) => Arc::ptr_eq(a, b) || a == b,
            _ => false,
        };
        if !same {
            self.speakers = speakers;
            self.viz.clear();
        }
    }

    /// Replaces a batch of frozen documents (documents change in the preview). Caption compile results are invalidated along with them.
    pub fn set_documents(&mut self, documents: Documents) {
        self.documents = documents;
        self.caption_checks.clear();
        self.caption_signatures.clear();
        self.drop_captions();
    }

    /// The sequence's content changed (the preview supplies a new video snapshot). Captions are invalidated by their recorded edit signature and recomputed on the next frame; caption plans whose signature has not changed are still used.
    /// Export's inputs do not change, so it does not need to call this.
    pub fn sequence_changed(&mut self) {
        self.caption_signatures.clear();
    }

    /// A layout engine with fonts installed: uses a spare one if available.
    fn take_engine(&mut self) -> TextEngine {
        let mut engine = self
            .engines
            .pop()
            .unwrap_or_else(|| TextEngine::with_shared_document_fonts(&self.fonts));
        // Missing fonts recorded by the previous plan are not carried over to the next one.
        engine.take_missing_families();
        engine.set_face_log(Some(self.face_log.clone()));
        engine
    }

    /// Appends fonts (font files the host found per [`Self::missing_fonts`]). The layout engine and the kernel plans compiled per font are invalidated along with it, and the next frame is laid out again with the new font library; families already reported missing that are now available have their reports withdrawn (export redraws this frame after getting the font, so no missing-font notice remains). Empty bytes are not accepted.
    pub fn add_fonts(&mut self, fonts: Vec<Arc<Vec<u8>>>) {
        let before = self.fonts.len();
        self.fonts.extend(fonts.into_iter().filter(|bytes| !bytes.is_empty()));
        if self.fonts.len() == before {
            return;
        }
        self.engines.clear();
        self.elements = None;
        self.captions.clear();
        self.templates = TemplateScenes::default();
        self.item_fonts.clear();
        let engine = self.take_engine();
        let arrived: Vec<String> = self.missing_fonts.iter().filter(|f| engine.has_family(f)).cloned().collect();
        self.spare_engine(engine);
        for family in arrived {
            self.missing_fonts.remove(&family);
            let note = format!(": {}", missing_font_note(&family));
            self.warnings.retain(|w| !(w.code == RENDER_NOTE && w.detail.ends_with(&note)));
        }
    }

    /// Font families named by the layers drawn so far that are not in the font library (sorted by name; cleared by `clear_reports`). The host uses this to look for font files; those it finds are supplied with [`Self::add_fonts`] and drawn again; those it cannot find are drawn with the fallback font, and a [`RENDER_NOTE`] notice is reported.
    pub fn missing_fonts(&self) -> Vec<String> {
        self.missing_fonts.iter().cloned().collect()
    }

    /// Faces named during layout so far (family name, weight, italic; persistent, sorted by name; includes captions and template layers). The host compares these with the families reported missing, and looks for that specific face in local fonts (using the same matching as layout); those it finds are supplied with [`Self::add_fonts`].
    pub fn used_faces(&self) -> Vec<FaceUse> {
        let mut faces = self.face_log.lock().unwrap_or_else(|poisoned| poisoned.into_inner()).clone();
        faces.sort();
        faces
    }

    /// Records the families missing when laying out a layer (persistent), and reports all the families this layer is missing.
    fn note_missing_fonts(&mut self, item_id: &str, fresh: Vec<String>) {
        let families = self.item_fonts.entry(item_id.to_string()).or_default();
        families.extend(fresh);
        if families.is_empty() {
            return;
        }
        let families: Vec<String> = families.iter().cloned().collect();
        for family in families {
            self.warn(RENDER_NOTE, format!("{item_id}: {}", missing_font_note(&family)));
            self.missing_fonts.insert(family);
        }
    }

    fn spare_engine(&mut self, engine: TextEngine) {
        if self.engines.len() < SPARE_ENGINES {
            self.engines.push(engine);
        }
    }

    /// Measures how large a box a piece of text needs as a text element on `canvas` (the sequence canvas) ([`measure_text_element`]), using the same fonts used to draw text.
    pub fn measure_text(&mut self, text: &str, style: &Value, wrap_width: Option<f64>, canvas: (u32, u32)) -> TextBox {
        let mut engine = self.take_engine();
        let measured = measure_text_element(&mut engine, text, style, wrap_width, canvas);
        self.spare_engine(engine);
        measured
    }

    fn drop_captions(&mut self) {
        for (_, plan) in std::mem::take(&mut self.captions) {
            self.spare_engine(plan.into_text_engine());
        }
    }

    /// Changes the output size (the preview canvas changes with the window): kernel plans compiled for the size and SVGs rasterized at the long edge are invalidated along with it; Lottie and spectra are kept.
    pub fn resize(&mut self, width: u32, height: u32) -> Result<(), RenderError> {
        if (width, height) == (self.options.width, self.options.height) {
            return Ok(());
        }
        self.frame =
            Pixmap::new(width, height).ok_or_else(|| RenderError::new("INVALID_PARAMS", format!("output size {width}×{height} is unavailable")))?;
        self.options.width = width;
        self.options.height = height;
        if let Some(plan) = self.elements.take() {
            self.spare_engine(plan.into_text_engine());
        }
        self.drop_captions();
        self.templates = TemplateScenes::default();
        self.svgs.clear();
        Ok(())
    }

    /// Whether to draw the caption layer (in the preview, it changes with the “burn captions” toggle).
    pub fn set_captions(&mut self, on: bool) {
        self.options.captions = on;
    }

    /// No background is laid down: the frame keeps a transparent base (for the UI's element and caption style thumbnails). Not used for export.
    pub fn set_transparent(&mut self, on: bool) {
        self.transparent = on;
    }

    /// Clears the recorded warnings and skipped items (the preview reports only those of the current frame).
    pub fn clear_reports(&mut self) {
        self.missing_spectra.clear();
        self.missing_fonts.clear();
        self.warnings.clear();
        self.skipped.clear();
        self.skipped_keys.clear();
    }

    /// Warnings so far (de-duplicated).
    pub fn warnings(&self) -> &[RenderWarning] {
        &self.warnings
    }

    /// Items skipped so far in skip mode (de-duplicated).
    pub fn skipped(&self) -> &[UnsupportedItem] {
        &self.skipped
    }

    /// Asset spectra that waveforms have used so far and the caller has not yet supplied (instance ID and asset, de-duplicated). The preview computes them from this and supplies them back before drawing.
    pub fn missing_spectra(&self) -> &[(String, VersionRef)] {
        &self.missing_spectra
    }

    /// The preview needs caption picking; export does not compute interactive geometry by default.
    pub fn set_collect_caption_hits(&mut self, on: bool) {
        self.collect_caption_hits = on;
    }

    pub fn caption_hits(&self) -> &[CaptionHit] {
        &self.caption_hits
    }

    pub fn frame(&self) -> &Pixmap {
        &self.frame
    }

    /// Draws one frame and returns RGBA bytes (opaque; premultiplied or not makes no difference; premultiplied when [`Self::set_transparent`] is set). `seconds` is this frame's sequence time.
    pub fn render(&mut self, video: VideoView, plan: &FramePlan, seconds: f64, media: &mut dyn LayerMedia) -> Result<&[u8], RenderError> {
        let sequence = video
            .sequences
            .get(&plan.sequence_id)
            .ok_or_else(|| RenderError::new("INVALID_PARAMS", format!("sequence {} is gone", plan.sequence_id)))?;
        self.caption_hits.clear();
        self.frame.fill(if self.transparent { Color::TRANSPARENT } else { Color::BLACK });
        // Keep black when the background color cannot be read.
        let [r, g, b, a] = hex_rgba(&plan.canvas.background).unwrap_or([0, 0, 0, 255]);
        let alpha = (f64::from(a) / 255.0 * plan.canvas.background_alpha.clamp(0.0, 1.0)) as f32;
        if alpha > 0.0 && !self.transparent {
            let colour = Color::from_rgba(f32::from(r) / 255.0, f32::from(g) / 255.0, f32::from(b) / 255.0, alpha).unwrap_or(Color::BLACK);
            fill(&mut self.frame, colour);
        }
        let mut context = SequenceContext::new(sequence, video.assets);
        // Audio waveforms take asset spectra from the sequence's sound plan (the whole sequence, time starting at 0); frames with no waveform do not compute it.
        let visualizer = |layer: &VisualLayer| matches!(&layer.content, Some(LayerContent::Generator { generator, .. }) if generator == "cuccut.audio-visualizer");
        if plan
            .layers
            .iter()
            .any(|l| visualizer(l) || l.transition.as_ref().and_then(|t| t.partner.as_deref()).is_some_and(visualizer))
        {
            context.audio = render_graph::audio_plan::plan_audio(video, &plan.sequence_id, None)
                .ok()
                .map(|p| p.segments);
        }

        let mut caption_groups: HashSet<&str> = HashSet::new();
        for layer in &plan.layers {
            if layer.kind == LayerKind::Caption {
                // Captions that share a style document form a group and are drawn once at the position of the group's first layer.
                if self.options.captions && caption_groups.insert(caption_group(layer)) {
                    self.draw_captions(video, sequence, plan, caption_group(layer), context.fps)?;
                }
                continue;
            }
            let Some(skipped_effects) = self.admit(layer, sequence)? else {
                continue;
            };
            let transition = match &layer.transition {
                Some(tr) => match check_transition(layer) {
                    None => Some(tr),
                    Some(item) => {
                        self.refuse_or_skip(vec![item])?;
                        None
                    }
                },
                None => None,
            };
            let Some(own) = self.draw_layer(&context, layer, &skipped_effects, seconds, media)? else {
                continue;
            };
            let Some(tr) = transition else {
                over(&mut self.frame, &own.pixmap);
                continue;
            };
            let partner = match tr.partner.as_deref() {
                Some(partner) => match self.admit(partner, sequence)? {
                    Some(skipped) => self.draw_layer(&context, partner, &skipped, seconds, media)?,
                    None => None,
                },
                None => None,
            };
            let two_sided = partner.is_some();
            let e = effective_progress(tr, two_sided);
            // Two sides: A is the outgoing side, B the incoming side. Single side: B is this layer (outgoing is drawn using the reverse process e′).
            let (a, b) = match (tr.role, &partner) {
                (TransitionRole::Outgoing, Some(other)) => (Some(&own), other),
                (TransitionRole::Incoming, Some(other)) => (Some(other), &own),
                (_, None) => (None, &own),
            };
            let mut out = Pixmap::new(self.options.width, self.options.height).expect("size was checked at construction");
            compose(&tr.kind, &tr.params, a.map(|l| &l.pixmap), Some(&b.pixmap), b.geom, e, &mut out);
            over(&mut self.frame, &out);
        }
        Ok(self.frame.data())
    }

    /// Draws one layer (excluding transitions). `None` when the whole layer is not drawn (its asset is in the skip list, or the instance no longer exists).
    fn draw_layer(
        &mut self,
        context: &SequenceContext,
        layer: &VisualLayer,
        skipped_effects: &HashSet<String>,
        seconds: f64,
        media: &mut dyn LayerMedia,
    ) -> Result<Option<DrawnLayer>, RenderError> {
        let size = (self.options.width, self.options.height);
        if let Some(LayerContent::Generator { generator, parameters, .. }) = &layer.content
            && generator == "cuccut.template"
        {
            let layer_id = parameters
                .get("layerId")
                .and_then(Value::as_str)
                .unwrap_or(&layer.item_id)
                .to_string();
            let Some(doc) = context.sequence.header.template.as_ref() else {
                return Ok(None);
            };
            self.element_plan(context)?;
            let plan = self.elements.as_mut().expect("just compiled");
            let pixmap = self
                .templates
                .raster(
                    context.sequence,
                    doc,
                    &layer_id,
                    seconds,
                    context.duration,
                    context.fps,
                    size,
                    &mut plan.text,
                )
                .map_err(RenderError::render)?;
            let missing = plan.text.take_missing_families();
            self.note_missing_fonts(&layer.item_id, missing);
            return Ok(Some(DrawnLayer { pixmap, geom: None }));
        }
        let Some(item) = context.items.get(layer.item_id.as_str()).copied() else {
            return Ok(None);
        };
        let bindings = context
            .sequence
            .header
            .animation_bindings
            .iter()
            .filter(|b| b.target_id == layer.item_id);
        let Some(mut element) = visual_element(item, context.fps, bindings) else {
            return Ok(None);
        };
        // The other side of a two-sided transition lies outside its own interval: geometry and animation are evaluated at the nearest moment within the interval, and the source picture is taken at the time the plan gives.
        let eval = seconds.clamp(element.start, (element.end - 1e-6).max(element.start));
        let fx = item.fx().map(|fx| without(fx, skipped_effects));
        let short_edge = f64::from(size.0.min(size.1));

        let mut natural = None;
        let mut injected: Option<Pixmap> = None;
        match (&layer.kind, &layer.content) {
            (LayerKind::Video | LayerKind::Image, _) => {
                let decoded = if layer.kind == LayerKind::Image && context.is_svg(layer.asset.as_ref()) {
                    let overrides = element.sticker.as_ref().map(|sticker| &sticker.fill_overrides);
                    let Some(svg) = self.svg(layer, overrides, media)? else {
                        return Ok(None);
                    };
                    Some(svg)
                } else if layer.kind == LayerKind::Image && context.is_gif(layer.asset.as_ref()) {
                    let Some(gif) = self.gif(layer, media)? else {
                        return Ok(None);
                    };
                    // Animated GIFs in image instances loop continuously; stickers follow `sticker.loop`.
                    let mode = element
                        .sticker
                        .as_ref()
                        .map_or(timeline::schema::STICKER_LOOP_LOOP, |sticker| sticker.loop_mode());
                    Some(gif.frame_at(seconds - element.start, mode).map_err(RenderError::render)?)
                } else {
                    None
                };
                let picture = match &decoded {
                    Some(decoded) => decoded.as_ref(),
                    None => match media.picture(layer)? {
                        Some(picture) => picture,
                        None => return Ok(None),
                    },
                };
                let mut source = cropped(picture, crop_of(item))
                    .ok_or_else(|| RenderError::new("EXPORT_RENDER_FAILED", format!("source frame size of item {} is unavailable", layer.item_id)))?;
                if let Some(fx) = &fx {
                    apply_to_source(fx, &mut source, short_edge);
                }
                natural = Some((f64::from(source.width()), f64::from(source.height())));
                injected = Some(source);
            }
            (LayerKind::Generator, Some(LayerContent::Generator { generator, parameters, .. })) if generator == "cuccut.lottie" => {
                let overrides = element.sticker.as_ref().map(|sticker| &sticker.fill_overrides);
                let Some(lottie) = self.lottie(layer, parameters, overrides, media)? else {
                    return Ok(None);
                };
                let meta = lottie.metadata();
                let dims = (f64::from(meta.width.max(1)), f64::from(meta.height.max(1)));
                let mut probe = element.clone();
                probe.keyframe_place(eval);
                let geom = BoxGeom::of(&probe, Some(dims), (f64::from(size.0), f64::from(size.1)));
                let (w, h) = (geom.w.round().clamp(1.0, 4096.0) as u32, geom.h.round().clamp(1.0, 4096.0) as u32);
                let at = lottie_time(parameters, layer.source_seconds.unwrap_or(0.0), meta.duration());
                let frame = lottie.sample_scaled(MediaTime::from_secs(at), w, h).map_err(RenderError::render)?;
                let mut source = Arc::try_unwrap(frame.pixmap).unwrap_or_else(|shared| (*shared).clone());
                if let Some(fx) = &fx {
                    apply_to_source(fx, &mut source, short_edge);
                }
                natural = Some(dims);
                injected = Some(source);
            }
            (LayerKind::Generator, Some(LayerContent::Generator { generator, .. })) if generator == "cuccut.audio-visualizer" => {
                self.visualizer_track(&element, context, media);
                if !self.visualizer_shown(&element.id, eval) {
                    return Ok(None);
                }
            }
            _ => {}
        }

        let has_source = injected.is_some();
        let duration = context.duration;
        let fps = context.fps;
        let viz = self.viz.get(&element.id).and_then(|entry| entry.track.clone());
        let plan = self.element_plan(context)?;
        plan.duration = duration;
        plan.fps = fps;
        plan.media.injected.clear();
        if let Some(source) = injected {
            let id = source_id(&element.id);
            plan.media.injected.insert(id.clone(), Arc::new(source));
            element.src_id = Some(id);
        }
        if let Some(track) = viz {
            plan.viz_tracks.insert(element.id.clone(), track);
        }
        plan.elements = vec![element.clone()];
        plan.text.take_missing_families();
        let rendered = plan.render_drawop_overlay_frame(eval, None).map_err(RenderError::render);
        plan.elements.clear();
        plan.media.injected.clear();
        let notes = std::mem::take(&mut plan.warnings);
        let missing = plan.text.take_missing_families();
        for note in notes {
            self.warn(RENDER_NOTE, format!("{}: {note}", layer.item_id));
        }
        self.note_missing_fonts(&layer.item_id, missing);
        let rendered = rendered?;
        let mut pixmap = Pixmap::from_vec(
            rendered.rgba,
            IntSize::from_wh(size.0, size.1).ok_or_else(|| RenderError::new("INVALID_PARAMS", "output size is unavailable"))?,
        )
        .ok_or_else(|| RenderError::new("EXPORT_RENDER_FAILED", "the layer the kernel drew has the wrong size"))?;
        if let Some(fx) = &fx {
            if !has_source {
                apply_to_source(fx, &mut pixmap, short_edge);
            }
            if needs_layer_pass(fx) {
                apply_to_layer(fx, &mut pixmap, short_edge).map_err(RenderError::render)?;
            }
        }
        element.keyframe_place(eval);
        let geom = BoxGeom::of(&element, natural, (f64::from(size.0), f64::from(size.1)));
        Ok(Some(DrawnLayer { pixmap, geom: Some(geom) }))
    }

    /// The kernel plan used to draw instances (compiled on first use).
    fn element_plan(&mut self, context: &SequenceContext) -> Result<&mut OverlayRenderPlan, RenderError> {
        if self.elements.is_none() {
            let includes = OverlayIncludes {
                subtitles: false,
                texts: true,
                media_overlays: true,
                watermarks: false,
            };
            let engine = self.take_engine();
            let mut plan = OverlayRenderPlan::compile_with_text_engine(
                &json!({ "style": {}, "cues": [] }),
                self.options.width,
                self.options.height,
                context.duration.max(1.0),
                context.fps,
                None,
                includes,
                self.fonts.len(),
                engine,
            )
            .map_err(RenderError::render)?;
            // Drawn layers do not read the DrawOp fingerprint: the resource names of dynamic rasters need not hash the whole frame's pixels every frame.
            plan.set_dynamic_asset_names(DynamicAssetNames::Slot);
            // The source picture is injected before each draw and cleared after: the plan can own it exclusively, so it is not copied again.
            plan.set_consume_injected_sources(true);
            self.elements = Some(plan);
        }
        Ok(self.elements.as_mut().expect("just compiled"))
    }

    /// The source for a Lottie sticker (cached by asset version and color-replacement table; embedded images attached and recolored, see [`crate::load_lottie`]). When it cannot be read or decoded, it reports an error or skips, depending on the option (`asset`).
    fn lottie(
        &mut self,
        layer: &VisualLayer,
        parameters: &Value,
        overrides: Option<&BTreeMap<String, String>>,
        media: &mut dyn LayerMedia,
    ) -> Result<Option<Arc<Lottie>>, RenderError> {
        let asset: Option<VersionRef> = parameters.get("asset").cloned().and_then(|v| serde_json::from_value(v).ok());
        let Some(asset) = asset else {
            self.refuse_or_skip(vec![asset_item(layer, "lottie-asset-missing", "Lottie sticker has no asset".into())])?;
            return Ok(None);
        };
        let mut key = format!("{}@{}", asset.id, asset.revision);
        if let Some(overrides) = overrides.filter(|o| !o.is_empty()) {
            key = subtitle_render::sticker_fill_variant_id(&key, overrides);
        }
        if !self.lotties.contains_key(&key) {
            let parsed = media
                .asset_bytes(&asset)
                .map(|bytes| crate::load_lottie(&asset.id, &bytes, overrides).map(Arc::new));
            let entry = match parsed {
                Some(Ok(lottie)) => Some(lottie),
                Some(Err((reason, why))) => {
                    self.lotties.insert(key.clone(), None);
                    self.refuse_or_skip(vec![asset_item(layer, reason, format!("Lottie asset cannot be read: {why}"))])?;
                    return Ok(None);
                }
                None => None,
            };
            if entry.is_none() {
                self.refuse_or_skip(vec![asset_item(layer, "lottie-asset-missing", "Lottie asset is not readable".into())])?;
                return Ok(None);
            }
            self.lotties.insert(key.clone(), entry);
        }
        Ok(self.lotties.get(&key).cloned().flatten())
    }

    /// The picture of an SVG image: the asset bytes rasterized at the output long edge ([`crate::decode_svg`]); for stickers with `fillOverrides`, colors are replaced first ([`timeline::svg_fill::apply_overrides`], using the same grouping as the sticker panel's swatches). Cached by asset version and color-replacement table. When it cannot be read or decoded, it reports an error or skips, depending on the option (`asset`, `asset-undecodable`); an SVG that is not UTF-8 cannot be recolored, so it is drawn in its original colors with a notice.
    fn svg(
        &mut self,
        layer: &VisualLayer,
        overrides: Option<&BTreeMap<String, String>>,
        media: &mut dyn LayerMedia,
    ) -> Result<Option<Arc<Pixmap>>, RenderError> {
        let asset = layer.asset.as_ref().expect("the caller checked this is an SVG asset");
        let overrides = overrides.filter(|o| !o.is_empty());
        let mut key = format!("{}@{}", asset.id, asset.revision);
        if let Some(overrides) = overrides {
            key = subtitle_render::sticker_fill_variant_id(&key, overrides);
        }
        if !self.svgs.contains_key(&key) {
            let Some(bytes) = media.asset_bytes(asset) else {
                self.refuse_or_skip(vec![asset_item(
                    layer,
                    "asset-undecodable",
                    format!("SVG image {} is not readable", asset.id),
                )])?;
                return Ok(None);
            };
            let mut recolour_failed = false;
            let recoloured = overrides.and_then(|overrides| match std::str::from_utf8(&bytes) {
                Ok(text) => Some(timeline::svg_fill::apply_overrides(text, overrides).into_bytes()),
                Err(_) => {
                    recolour_failed = true;
                    None
                }
            });
            if recolour_failed {
                self.warn(
                    RENDER_NOTE,
                    format!("{}: SVG sticker is not UTF-8 text, so its color cannot be changed; drawing in the original colors", layer.item_id),
                );
            }
            let long_edge = self.options.width.max(self.options.height);
            match crate::decode_svg(recoloured.as_deref().unwrap_or(&bytes), long_edge) {
                Ok(pixmap) => {
                    self.svgs.insert(key.clone(), Some(Arc::new(pixmap)));
                }
                Err(error) => {
                    self.svgs.insert(key.clone(), None);
                    self.refuse_or_skip(vec![asset_item(layer, "asset-undecodable", format!("SVG image failed to decode: {error:#}"))])?;
                    return Ok(None);
                }
            }
        }
        match self.svgs.get(&key).cloned().flatten() {
            Some(svg) => Ok(Some(svg)),
            None => {
                self.refuse_or_skip(vec![asset_item(
                    layer,
                    "asset-undecodable",
                    format!("SVG image {} failed to decode", asset.id),
                )])?;
                Ok(None)
            }
        }
    }

    /// GIF image: asset bytes decoded into an animation ([`crate::load_gif`]), cached by asset version. When it cannot be read or even its first frame cannot be decoded, it reports an error or skips, depending on the option (`asset-undecodable`); when over the limit and only the first frame is drawn, a notice is given.
    fn gif(&mut self, layer: &VisualLayer, media: &mut dyn LayerMedia) -> Result<Option<Arc<crate::Gif>>, RenderError> {
        let asset = layer.asset.as_ref().expect("the caller checked this is a GIF asset");
        let key = format!("{}@{}", asset.id, asset.revision);
        if !self.gifs.contains_key(&key) {
            let Some(bytes) = media.asset_bytes(asset) else {
                self.refuse_or_skip(vec![asset_item(
                    layer,
                    "asset-undecodable",
                    format!("GIF image {} is not readable", asset.id),
                )])?;
                return Ok(None);
            };
            match crate::load_gif(&asset.id, &bytes) {
                Ok((gif, note)) => {
                    if let Some(note) = note {
                        self.warn(RENDER_NOTE, format!("{}: {note}", layer.item_id));
                    }
                    self.gifs.insert(key.clone(), Some(Arc::new(gif)));
                }
                Err(error) => {
                    self.gifs.insert(key.clone(), None);
                    self.refuse_or_skip(vec![asset_item(layer, "asset-undecodable", format!("GIF image failed to decode: {error:#}"))])?;
                    return Ok(None);
                }
            }
        }
        match self.gifs.get(&key).cloned().flatten() {
            Some(gif) => Ok(Some(gif)),
            None => {
                self.refuse_or_skip(vec![asset_item(
                    layer,
                    "asset-undecodable",
                    format!("GIF image {} failed to decode", asset.id),
                )])?;
                Ok(None)
            }
        }
    }

    /// The spectrum track for an audio waveform instance: uses the caller's ready-made one if given; otherwise assembles it from the asset spectrum according to the sound plan ([`crate::spectrum`]). Cached per instance; reassembled only when parameters, the sound segments used, or the asset change. When the asset spectrum is missing there is no track (the kernel draws a static form and reports a notice), and the missing one is recorded in [`Self::missing_spectra`].
    /// When `speaker` is set, only the segments this speaker talks in are kept ([`spectrum::gate`]); when there is no transcript, or the transcript has no such speaker, the whole thing is silent and a notice is reported;
    /// when `alwaysShow: false`, whether each frame has sound is also recorded ([`spectrum::audible_frames`]), and frames without sound are not drawn.
    fn visualizer_track(&mut self, element: &TimelineVisualElement, context: &SequenceContext, media: &mut dyn LayerMedia) {
        let Some(props) = element.visualizer.as_ref() else {
            return;
        };
        let params = VizParams {
            min_db: props.min_db(),
            max_db: props.max_db(),
            smoothing: props.smoothing(),
            gain: props.gain(),
        };
        let route = Route::of(props.audio());
        let segments = context
            .audio
            .as_deref()
            .map(|all| spectrum::segments_for(all, &route, element.start, element.end))
            .unwrap_or_default();
        let speaker = props.speaker.as_deref().filter(|s| !s.is_empty());
        let key = format!(
            "{}|{}|{}|{}|{:?}|{}|{}|{}|{:?}|{}",
            params.min_db,
            params.max_db,
            params.smoothing,
            params.gain,
            route,
            element.start,
            element.end,
            serde_json::to_string(&segments).unwrap_or_default(),
            speaker,
            props.always_show()
        );
        if let Some(entry) = self.viz.get(&element.id)
            && entry.key == key
        {
            let (missing, notes) = (entry.missing.clone(), entry.notes.clone());
            for asset in missing {
                self.note_missing(&element.id, asset);
            }
            for note in notes {
                self.warn(RENDER_NOTE, note);
            }
            return;
        }
        let derive = |bytes: &[u8]| VizTrack::derive(bytes, params).ok().map(Arc::new);
        let mut missing = Vec::new();
        let track = if let Some(bytes) = media.spectrum(&element.id) {
            derive(&bytes)
        } else {
            let mut sources = BTreeMap::new();
            for asset in spectrum::sources_of(&segments) {
                match media.audio_spectrum(&asset) {
                    Some(bytes) => {
                        sources.insert(spectrum::asset_key(&asset), bytes);
                    }
                    None => missing.push(asset),
                }
            }
            if missing.is_empty() {
                match spectrum::compose(&segments, &route, element.start, element.end, &sources) {
                    Ok(bytes) => derive(&bytes),
                    Err(message) => {
                        self.warn(RENDER_NOTE, format!("{}: {message}", element.id));
                        None
                    }
                }
            } else {
                None
            }
        };
        for asset in &missing {
            self.note_missing(&element.id, asset.clone());
        }
        let mut notes = Vec::new();
        let track = match speaker {
            None => track,
            Some(speaker) => {
                let spans = match self.speakers.as_deref() {
                    None => {
                        notes.push(format!(
                            "{}: the video has no transcript, so the speaker {speaker}'s speaking times are unknown; the audio visualizer is drawn as silent",
                            element.id
                        ));
                        None
                    }
                    Some(speakers) => match speakers.get(speaker) {
                        Some(intervals) => Some(spectrum::speaking_spans(intervals)),
                        None => {
                            notes.push(format!(
                                "{}: the transcript has no speech by speaker {speaker} on this sequence; the audio visualizer is drawn as silent",
                                element.id
                            ));
                            None
                        }
                    },
                };
                track.and_then(|track| spectrum::gate(&track, spans.as_deref())).map(Arc::new)
            }
        };
        for note in &notes {
            self.warn(RENDER_NOTE, note.clone());
        }
        let audible = (!props.always_show()).then(|| track.as_deref().map(spectrum::audible_frames).unwrap_or_default());
        self.viz.insert(
            element.id.clone(),
            VizEntry {
                key,
                track,
                missing,
                notes,
                audible,
            },
        );
    }

    /// Whether the waveform is drawn at this moment: with `alwaysShow: false`, only frames with sound are drawn ([`spectrum::audible_frames`]; no track means no sound).
    fn visualizer_shown(&self, item_id: &str, at: f64) -> bool {
        let Some(entry) = self.viz.get(item_id) else {
            return true;
        };
        let Some(audible) = &entry.audible else {
            return true;
        };
        entry
            .track
            .as_ref()
            .and_then(|track| track.frame_index_at(at))
            .and_then(|index| audible.get(index).copied())
            .unwrap_or(false)
    }

    fn note_missing(&mut self, item_id: &str, asset: VersionRef) {
        let entry = (item_id.to_string(), asset);
        if !self.missing_spectra.contains(&entry) {
            self.missing_spectra.push(entry);
        }
    }

    /// The host changed the spectrum of a waveform or asset: cached spectrum tracks are invalidated, and the next frame fetches and reassembles them.
    pub fn clear_spectra(&mut self) {
        self.viz.clear();
    }

    /// Takes spectrum tracks already assembled by another renderer (independent of output size; the preview keeps several renderers by size, and assembling a long video's spectrum track takes hundreds of milliseconds). The other renderer is the one that drew more recently: for instances it has, its tracks take precedence; keys that do not match are still reassembled on the next frame. Not taken when the speaker intervals differ.
    pub fn share_spectra_from(&mut self, other: &FrameRenderer) {
        let same = match (&self.speakers, &other.speakers) {
            (None, None) => true,
            (Some(a), Some(b)) => Arc::ptr_eq(a, b) || a == b,
            _ => false,
        };
        if !same {
            return;
        }
        for (item_id, entry) in &other.viz {
            self.viz.insert(item_id.clone(), entry.clone());
        }
    }

    /// Draws a group of captions: layers in the group that cannot be drawn are reported as errors or skipped, depending on the option, and the rest are laid out and drawn together.
    fn draw_captions(&mut self, video: VideoView, sequence: &Sequence, plan: &FramePlan, group: &str, fps: f64) -> Result<(), RenderError> {
        let mut admitted = Vec::new();
        for layer in plan
            .layers
            .iter()
            .filter(|l| l.kind == LayerKind::Caption && caption_group(l) == group)
        {
            let (documents, checks) = (&self.documents, &mut self.caption_checks);
            let items = check_layer_with(layer, None, &mut |document_id, style_document_id| {
                let key = (document_id.to_owned(), style_document_id.map(str::to_owned));
                checks
                    .entry(key)
                    .or_insert_with(|| caption_problem(documents, document_id, style_document_id))
                    .clone()
            });
            if items.is_empty() {
                admitted.push(layer);
            } else {
                self.refuse_or_skip(items)?;
            }
        }
        let Some(first) = admitted.first() else { return Ok(()) };
        let Some(LayerContent::Caption {
            style_document_id,
            sequence_seconds,
            scope,
            ..
        }) = &first.content
        else {
            return Ok(());
        };
        let document_ids: Vec<&str> = admitted
            .iter()
            .filter_map(|l| match &l.content {
                Some(LayerContent::Caption { document_id, .. }) => Some(document_id.as_str()),
                _ => None,
            })
            .collect();
        let prefix = format!("{group}|{}|", document_ids.join(","));
        let signature_key = (sequence.id.to_string(), prefix.clone());
        let signature = match self.caption_signatures.get(&signature_key) {
            Some(signature) => signature.clone(),
            None => {
                let signature = self.caption_signature(sequence, &document_ids);
                self.caption_signatures.insert(signature_key, signature.clone());
                signature
            }
        };
        let key = format!("{prefix}{signature}");
        if !self.captions.contains_key(&key) {
            let Ok(style) = CaptionStyle::read(style_document_id.as_deref().and_then(|id| self.documents.get(id))) else {
                return Ok(());
            };
            // A plan compiled for the same group from an old edit is no longer used.
            let stale: Vec<String> = self.captions.keys().filter(|k| k.starts_with(&prefix)).cloned().collect();
            for old in stale {
                if let Some(plan) = self.captions.remove(&old) {
                    self.spare_engine(plan.into_text_engine());
                }
            }
            let engine = self.take_engine();
            let mut members = Vec::new();
            for id in &document_ids {
                let Some(document) = self.documents.get(id) else { continue };
                let Some(mut track) = read_captions(&document.body) else { continue };
                // Sentence words (word-by-word animation, emphasis): original captions take words from the transcript they point to, from the effective word stream.
                if !is_translation(document)
                    && let Some(speech) = document.source_document_id.as_deref().and_then(|s| self.documents.get(s))
                    && let Some(words) = SpeechWords::read(&speech.body)
                {
                    let on_sequence = track.sequence_clock && !words.sequence_clock;
                    let placement = place(
                        video,
                        &plan.sequence_id,
                        id,
                        speech,
                        document.source_asset_id.as_deref(),
                        on_sequence,
                    );
                    track.attach_words(&words, &placement);
                }
                members.push((document, track));
            }
            let size = (self.options.width, self.options.height);
            let compiled = CaptionPlan::compile(&style, &members, size, fps, engine, self.fonts.len()).map_err(RenderError::render)?;
            self.captions.insert(key.clone(), compiled);
        }
        let captions = self.captions.get_mut(&key).expect("just compiled");
        captions.avoid_template(sequence.header.template.as_ref());
        // A group takes its times from the first layer's clock: when there is no acting instance on the source media clock, this moment is not drawn.
        let at = if captions.sequence_clock {
            Some(*sequence_seconds)
        } else {
            scope.as_ref().map(|s| s.source_seconds)
        };
        let rendered = match at {
            Some(at) => captions.render(at).map_err(RenderError::render)?,
            None => None,
        };
        let style_opacity = captions.opacity;
        if self.collect_caption_hits && rendered.is_some() && first.opacity * f64::from(style_opacity) > 0.0 {
            for mut hit in captions.hits(at.unwrap()).map_err(RenderError::render)? {
                let Some(layer) = admitted.iter().find(|layer| {
                    matches!(
                        &layer.content, Some(LayerContent::Caption { document_id, .. }) if document_id == &hit.document_id
                    )
                }) else {
                    continue;
                };
                hit.layer_id = first.item_id.clone();
                hit.item_id = layer.item_id.clone();
                // Unified back to sequence canvas pixels: preview quality, device pixel ratio and zoom do not change the picking position.
                let kx = f64::from(plan.canvas.width) / f64::from(self.options.width);
                let ky = f64::from(plan.canvas.height) / f64::from(self.options.height);
                hit.cx *= kx;
                hit.cy *= ky;
                hit.w *= kx;
                hit.h *= ky;
                self.caption_hits.push(hit);
            }
        }
        // Caption notices are persistent: the kernel reports them only once at compile time, and the preview must still report them after clearing reports each frame (consistent with export).
        let (notes, missing) = captions.notes();
        for note in notes {
            self.warn(RENDER_NOTE, format!("{}: {note}", first.item_id));
        }
        self.note_missing_fonts(&first.item_id, missing);
        if let Some(layer) = rendered {
            let opacity = first.opacity.clamp(0.0, 1.0) as f32 * style_opacity;
            let pixmap = PixmapRef::from_bytes(&layer.rgba, layer.width, layer.height)
                .ok_or_else(|| RenderError::render(anyhow::anyhow!("caption layer has the wrong size")))?;
            // Caption layers are mostly transparent: they are composited only within the glyph bounding rectangle the kernel gives (byte-for-byte identical to compositing the full image), without copying or rescanning.
            if render_raster::plan::composite_bounded_rect(&mut self.frame, pixmap, layer.rect, opacity, layer.blend).is_none() {
                self.frame.draw_pixmap(
                    0,
                    0,
                    pixmap,
                    &PixmapPaint {
                        opacity,
                        blend_mode: layer.blend,
                        quality: FilterQuality::Nearest,
                    },
                    Transform::identity(),
                    None,
                );
            }
        }
        Ok(())
    }

    /// The edits that caption compile results depend on: when a caption in the group takes words from a transcript, whether each word is kept and its timing change with the instances that use the source media and with the caption instances. Only these instances are checked, so changing text, stickers and so on does not force captions to recompile.
    fn caption_signature(&self, sequence: &Sequence, document_ids: &[&str]) -> String {
        use std::hash::{DefaultHasher, Hash, Hasher};
        let worded = document_ids.iter().any(|id| {
            self.documents
                .get(id)
                .and_then(|d| d.source_document_id.as_deref())
                .is_some_and(|s| self.documents.get(s).is_some())
        });
        if !worded {
            return String::new();
        }
        let mut hasher = DefaultHasher::new();
        for item in &sequence.items {
            if matches!(
                item,
                TimelineItem::Video(_) | TimelineItem::Audio(_) | TimelineItem::Composition(_) | TimelineItem::Caption(_)
            ) {
                serde_json::to_string(item).unwrap_or_default().hash(&mut hasher);
            }
        }
        format!("{:016x}", hasher.finish())
    }

    /// Whether this layer is drawn: the parts that cannot be drawn are reported as errors or skipped, depending on the option. `None` when the whole layer is not drawn; otherwise gives the kinds of effects that were skipped.
    fn admit(&mut self, layer: &VisualLayer, sequence: &Sequence) -> Result<Option<HashSet<String>>, RenderError> {
        let items = check_layer(layer, &self.documents, sequence.header.template.as_ref());
        if items.is_empty() {
            return Ok(Some(HashSet::new()));
        }
        let drop = items.iter().any(UnsupportedItem::drops_layer);
        let skipped_effects: HashSet<String> = items
            .iter()
            .filter(|i| i.scope == "effect")
            .filter_map(|i| i.kind.clone())
            .collect();
        self.refuse_or_skip(items)?;
        Ok((!drop).then_some(skipped_effects))
    }

    fn refuse_or_skip(&mut self, items: Vec<UnsupportedItem>) -> Result<(), RenderError> {
        if !self.options.skip_unsupported {
            return Err(RenderError {
                code: "EXPORT_UNSUPPORTED_CONTENT".into(),
                message: items.iter().map(|i| i.message.clone()).collect::<Vec<_>>().join("; "),
                items,
            });
        }
        for item in items {
            if self.skipped_keys.insert(item.key()) {
                self.skipped.push(item);
            }
        }
        Ok(())
    }

    fn warn(&mut self, code: &'static str, detail: String) {
        if !self.warnings.iter().any(|w| w.code == code && w.detail == detail) {
            self.warnings.push(RenderWarning { code, detail });
        }
    }
}

/// The read-only context of the sequence within one frame.
struct SequenceContext<'a> {
    sequence: &'a Sequence,
    assets: &'a BTreeMap<Id, AssetRecord>,
    items: HashMap<&'a str, &'a TimelineItem>,
    fps: f64,
    /// The sequence end (seconds; format spec §2.10: fixed length is by frame, derived length takes the end of the last instance). Element animation progress, template progress and chapters are computed from it.
    duration: f64,
    /// The sound plan for the whole sequence (computed only when this frame has a waveform).
    audio: Option<Vec<AudioSegment>>,
}

/// The spectrum track of one waveform instance, and where it came from.
#[derive(Clone)]
struct VizEntry {
    key: String,
    track: Option<Arc<VizTrack>>,
    /// Asset spectra missing when assembling it.
    missing: Vec<VersionRef>,
    /// A notice that must be reported on every frame (speaker mismatch).
    notes: Vec<String>,
    /// Whether each frame has sound when `alwaysShow: false`; `None` means always drawn.
    audible: Option<Vec<bool>>,
}

impl<'a> SequenceContext<'a> {
    fn new(sequence: &'a Sequence, assets: &'a BTreeMap<Id, AssetRecord>) -> SequenceContext<'a> {
        let rate = sequence.header.fps;
        let fps = if rate.den > 0 && rate.num > 0 {
            rate.num as f64 / rate.den as f64
        } else {
            30.0
        };
        // The frame plan has already been computed from the same sequence, so an overflow here only occurs when called outside the plan: fall back to computing from the instance end on the frame grid.
        let duration = render_graph::audio_plan::sequence_end(sequence)
            .map(|end| end.to_f64())
            .unwrap_or_else(|_| {
                let end = sequence
                    .items
                    .iter()
                    .filter_map(|i| i.span())
                    .map(|s| s.end_frame())
                    .max()
                    .unwrap_or(0);
                end as f64 / fps
            });
        SequenceContext {
            sequence,
            assets,
            items: sequence.items.iter().map(|i| (i.base().id.as_str(), i)).collect(),
            fps,
            duration,
            audio: None,
        }
    }
}

impl SequenceContext<'_> {
    /// Whether the asset version is an SVG image (by the `mediaType` recorded for the version, not by inspecting the bytes).
    fn is_svg(&self, asset: Option<&VersionRef>) -> bool {
        self.media_type_is(asset, SVG_MEDIA_TYPE)
    }

    /// Whether the asset version is a GIF image (same as above).
    fn is_gif(&self, asset: Option<&VersionRef>) -> bool {
        self.media_type_is(asset, GIF_MEDIA_TYPE)
    }

    fn media_type_is(&self, asset: Option<&VersionRef>, media_type: &str) -> bool {
        asset
            .and_then(|asset| self.assets.get(&asset.id)?.revisions.get(&asset.revision))
            .is_some_and(|revision| revision.media_type.eq_ignore_ascii_case(media_type))
    }
}

/// The media type of SVG image assets.
pub const SVG_MEDIA_TYPE: &str = "image/svg+xml";

/// The media type of GIF image assets: the picture is decoded by the frame rasterizer from the asset bytes (animation frames are picked by time).
pub const GIF_MEDIA_TYPE: &str = "image/gif";

/// The group a caption layer belongs to: the style document's ID; when there is no style document, the instance itself.
fn caption_group(layer: &VisualLayer) -> &str {
    match &layer.content {
        Some(LayerContent::Caption {
            style_document_id: Some(id),
            ..
        }) => id,
        _ => &layer.item_id,
    }
}

fn asset_item(layer: &VisualLayer, reason: &str, message: String) -> UnsupportedItem {
    UnsupportedItem {
        item_id: layer.item_id.clone(),
        scope: "asset",
        layer_kind: kind_name(layer.kind),
        effect_id: None,
        transition_id: None,
        kind: None,
        reason: reason.into(),
        message,
    }
}

/// The time a Lottie takes when `elapsed` seconds have passed in the instance (`sticker.loop`, format spec §3.7): `loop` (default) takes the duration modulo; `once` stops at the end after playing; `hold` freezes on the first frame.
fn lottie_time(parameters: &Value, elapsed: f64, duration: f64) -> f64 {
    let elapsed = if elapsed.is_finite() { elapsed.max(0.0) } else { 0.0 };
    let mode = parameters
        .get("loop")
        .and_then(Value::as_str)
        .unwrap_or(timeline::schema::STICKER_LOOP_DEFAULT);
    if !(duration > 0.0) {
        return elapsed;
    }
    match mode {
        timeline::schema::STICKER_LOOP_HOLD => 0.0,
        // Last frame: the duration minus less than a millisecond, which falls within the final frame.
        timeline::schema::STICKER_LOOP_ONCE => elapsed.min((duration - 0.0005).max(0.0)),
        _ => elapsed.rem_euclid(duration),
    }
}

/// Cropping for video and image instances.
fn crop_of(item: &TimelineItem) -> Option<[f64; 4]> {
    let crop = match item {
        TimelineItem::Video(v) => v.crop.as_ref(),
        TimelineItem::Image(i) => i.crop.as_ref(),
        _ => None,
    }?;
    (crop.is_valid() && !crop.is_empty()).then(|| crop.rect())
}

/// Copies the region of the source picture left by cropping (when there is no crop, the whole picture is copied).
fn cropped(picture: &Pixmap, rect: Option<[f64; 4]>) -> Option<Pixmap> {
    let Some([u0, v0, u1, v1]) = rect else {
        return Some(picture.clone());
    };
    let (w, h) = (f64::from(picture.width()), f64::from(picture.height()));
    let x = (u0 * w).round().clamp(0.0, w - 1.0);
    let y = (v0 * h).round().clamp(0.0, h - 1.0);
    let cw = ((u1 * w).round() - x).clamp(1.0, w - x);
    let ch = ((v1 * h).round() - y).clamp(1.0, h - y);
    picture.clone_rect(tiny_skia::IntRect::from_xywh(x as i32, y as i32, cw as u32, ch as u32)?)
}

/// The `fx` after skipped effects are removed. Kind names are the same as the frame plan's effect kinds.
fn without(fx: &Fx, skipped: &HashSet<String>) -> Fx {
    let mut fx = fx.clone();
    for kind in skipped {
        match kind.as_str() {
            "filterPreset" => fx.filter_preset = None,
            "effectPreset" => fx.effect_preset = None,
            "colorAdjust" => (fx.grayscale, fx.brightness) = (None, None),
            "exposure" => fx.exposure = None,
            "contrast" => fx.contrast = None,
            "saturation" => fx.saturation = None,
            "hue" => fx.hue = None,
            "temperature" => fx.temperature = None,
            "blur" => fx.blur = None,
            "sharpen" => fx.sharpen = None,
            "noise" => fx.noise = None,
            "vignette" => fx.vignette = None,
            "stroke" => fx.stroke = None,
            "shadow" => fx.shadow = None,
            _ => {}
        }
    }
    fx
}

fn over(target: &mut Pixmap, layer: &Pixmap) {
    // A full-frame opaque layer (a whole video) is copied as is; other layers (a line of text, a sticker) are composited only within the bounding rectangle of non-zero pixels. Both are byte-for-byte identical to the code below.
    if render_raster::raster::copy_over(target, layer.as_ref(), Transform::identity())
        || render_raster::plan::composite_bounded(target, layer, 1.0, BlendMode::SourceOver).is_some()
    {
        return;
    }
    target.draw_pixmap(
        0,
        0,
        layer.as_ref(),
        &PixmapPaint {
            opacity: 1.0,
            blend_mode: BlendMode::SourceOver,
            quality: FilterQuality::Nearest,
        },
        Transform::identity(),
        None,
    );
}

fn fill(target: &mut Pixmap, color: Color) {
    let mut paint = tiny_skia::Paint::default();
    paint.set_color(color);
    if let Some(rect) = Rect::from_xywh(0.0, 0.0, target.width() as f32, target.height() as f32) {
        target.fill_rect(rect, &paint, Transform::identity(), None);
    }
}

/// Missing-font notice (the same sentence the caption kernel reports at compile time).
pub fn missing_font_note(family: &str) -> String {
    format!("font {family:?} is not available in the current font library; falling back to Noto Sans SC")
}
