//! The frame plan (architecture design §9.1, §9.4, §9.10): which layers are stacked to form the picture at a given moment in the video, how each layer is placed, which source moment it takes, and which sounds are audible at that moment.
//!
//! This is the single implementation of render semantics: the editor preview calls it via WASM, native export links it directly, and the two sides do not each write their own version.
//! The plan only describes “what to draw and where”; it does not decode or composite. Pixels are drawn by each backend according to the plan.
//!
//! It covers all instance kinds. Geometry is the v2 element model's `place` (percent of the frame), converted to pixel boxes via `timeline::geometry`. Layers that need decoded pictures (video, images, and also material stickers, placeholder boxes with material, whiteboards, and compositions with a pre-rendered stand-in) are given their material and source time. Text, shapes and captions are given placement and time, with content as formal fields (text style, `ShapeProps`). Progress bars, waveforms, confetti, counters, template stickers, Lottie stickers, hand-drawn content, placeholder boxes and template layers are given by built-in generators (parameters are the v2 props). For anything the plan cannot draw (code-package compositions without a pre-rendered stand-in, and material stickers that are unrecognized), it marks `unsupported`, so the backend reports it explicitly instead of drawing blank (format spec §3.7).
//! Cropping is folded into `sourceRect`; `fx` is listed as effects in application order (format spec §3.9). Pixels are drawn by `frame-render` from the instance's own fields (masks, tiling, element animation and keyframes are all handled there); the plan only gives layers, order, time and transitions. Transitions and ducking are given on layers and sounds (format spec §3.5, §3.9).
//! Chapters are not part of the plan.

pub mod audio_plan;
pub mod ducking;
pub mod envelope;
pub mod item_box;
pub mod text_plan;
pub mod video_plan;

use std::collections::{BTreeMap, HashMap};

use editor_semantics::{MediaTime, Rate, Ratio, TimeError, TimeMap, frame_time, frames_at, map_time};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use video_model::{
    AssetKind, AssetRecord, AudioItem, CompositionSource, Crop, Easing, EnvelopePoint, Fit, FrameSpan, Id, MediaFields, Place, Revision,
    Sequence, SoloGroup, TimelineItem, Track, Transition, TransitionKind, VersionRef, VideoSnapshot,
};

use crate::ducking::DuckingEnvelope;
use crate::item_box::{display_size, item_geometry, pixel_box};

/// The plan for one frame. Layers are in compositing order: the ones drawn first are underneath.
#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FramePlan {
    pub sequence_id: Id,
    pub sequence_revision: Revision,
    /// The video frame at this moment (rounded down). Whether an instance is on the picture is judged by this.
    pub frame: i64,
    pub canvas: PlanCanvas,
    pub layers: Vec<VisualLayer>,
    pub voices: Vec<AudioVoice>,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlanCanvas {
    pub width: u32,
    pub height: u32,
    pub background: String,
    pub background_alpha: f64,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum LayerKind {
    Video,
    Image,
    Text,
    Shape,
    /// The picture drawn by built-in generators from local time: progress bars, waveforms, confetti, counters, template stickers, Lottie stickers, hand-drawn content, placeholder boxes and template layers.
    Generator,
    /// Captions: fill the canvas; position and appearance are determined by the style document.
    Caption,
    /// This layer should have a picture but the plan cannot give a way to draw it (code-package composition without a pre-rendered stand-in, unrecognized material sticker): the backend must report it explicitly instead of drawing blank.
    Unsupported,
}

/// A picture layer.
///
/// `matrix` maps the unit square to canvas pixels: `x' = a·u + c·v + e`, `y' = b·u + d·v + f`, i.e. Canvas 2D's `setTransform(a, b, c, d, e, f)`. Video and images draw the source picture's `sourceRect` (`[u0, v0, u1, v1]`, normalized relative to the source's display size) into the unit square. For text, shapes, generators and unsupported layers the unit square is the instance's layout box (flip already included); for captions the unit square is the whole canvas.
#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VisualLayer {
    pub item_id: Id,
    pub kind: LayerKind,
    /// The material used for the picture: video, image, or the unsupported code package itself.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub asset: Option<VersionRef>,
    /// The source moment (seconds) to fetch for video; for generators, the composition's local moment (after its time mapping). None for the rest.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_seconds: Option<f64>,
    /// The speed of source time relative to sequence time: the media element advances at this rate during playback; freeze is 0.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_rate: Option<f64>,
    pub matrix: [f64; 6],
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_rect: Option<[f64; 4]>,
    pub opacity: f64,
    /// The content to draw for text, shapes, generators, captions and unsupported layers; none for video and images.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content: Option<LayerContent>,
    /// `fx` effects in application order (format spec §3.9), with lengths converted from the 540 short side to canvas pixels. Masks, tiling, element animation and keyframes are not here: the backend draws them from the instance's own fields.
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub effects: Vec<LayerEffect>,
    /// Whether this layer is in a transition at this moment (format spec §3.9). Backends that do not recognize this field draw only this layer itself, i.e. a hard cut.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub transition: Option<Box<LayerTransition>>,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LayerEffect {
    pub id: Id,
    pub kind: String,
    #[serde(skip_serializing_if = "Map::is_empty")]
    pub params: Map<String, Value>,
    /// The reason it cannot be drawn. Currently every step of `fx` has a drawing method, so the plan no longer writes it; the field is kept for effects that lack a drawing method in only one backend.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub unsupported: Option<String>,
}

/// The transition this layer belongs to. `progress` is the position at this moment within the transition window (0 to 1, continuous), and `eased` is the value after easing; drawing uses `eased` throughout. The other side of a two-sided transition is given in `partner` (it lies outside its own interval, and its source moment is in handles); a one-sided transition has no `partner`, and the other side is transparent.
#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LayerTransition {
    pub id: Id,
    pub kind: String,
    #[serde(skip_serializing_if = "Map::is_empty")]
    pub params: Map<String, Value>,
    pub easing: Easing,
    pub progress: f64,
    pub eased: f64,
    /// Whether this layer is the outgoing side (`outgoing`) or the incoming side (`incoming`) of the transition.
    pub role: TransitionRole,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub partner: Option<Box<VisualLayer>>,
    /// An unrecognized transition kind: the backend draws it as a hard cut (only this layer) and reports it.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub unsupported: Option<String>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum TransitionRole {
    Outgoing,
    Incoming,
}

/// The layer's content, distinguished by `kind`. Style, geometry and parameters are carried over as-is: their schema is interpreted by the backend, and anything unrecognized must be reported.
#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(untagged, rename_all_fields = "camelCase")]
pub enum LayerContent {
    Text {
        text: String,
        style: Value,
    },
    Shape {
        shape: Value,
    },
    Generator {
        generator: String,
        version: u32,
        parameters: Value,
        /// How long since the instance started and how long the instance is in total (sequence time, seconds): progress bars and counters are computed from these.
        elapsed_seconds: f64,
        duration_seconds: f64,
    },
    Caption {
        /// A caption instance follows the document's current version, so the document ID is given.
        document_id: Id,
        #[serde(skip_serializing_if = "Option::is_none")]
        style_document_id: Option<Id>,
        /// The sequence time at this moment: when the document is on the sequence clock, sentences are found by it.
        sequence_seconds: f64,
        /// When the document is on the source material clock, which effect instance this moment passes through and which source moment it falls on (§3.8). Omitted when there is no effect instance.
        #[serde(skip_serializing_if = "Option::is_none")]
        scope: Option<CaptionScope>,
    },
    Unsupported {
        reason: String,
    },
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CaptionScope {
    pub item_id: Id,
    pub asset: VersionRef,
    pub source_seconds: f64,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum VoiceSource {
    /// The sound carried by the video instance itself.
    Embedded,
    /// An instance on an audio track.
    Audio,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioVoice {
    pub item_id: Id,
    pub source: VoiceSource,
    pub asset: VersionRef,
    pub source_seconds: f64,
    pub source_rate: f64,
    /// The gain at this moment: the instance's gain, fades, the transition's sound cross-fade and ducking are all already included.
    pub gain_db: f64,
    /// The gain before ducking, while ducking is attenuating this sound (the UI uses this to show ducking). Omitted when not attenuated.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub unducked_gain_db: Option<f64>,
    /// The sound in a transition's cross-fade (both sides carry the same transition ID).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub transition_id: Option<Id>,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct PlanError {
    pub code: String,
    pub message: String,
}

impl PlanError {
    fn new(code: &str, message: impl Into<String>) -> PlanError {
        PlanError {
            code: code.into(),
            message: message.into(),
        }
    }
}

impl PlanError {
    fn overflow(field: &str) -> PlanError {
        PlanError::new("TIME_ARITHMETIC_OVERFLOW", format!("{field} 超出范围"))
    }
}

impl From<TimeError> for PlanError {
    fn from(error: TimeError) -> PlanError {
        let message = match &error {
            TimeError::Invalid { field, reason } => format!("{field}：{reason}"),
            TimeError::Overflow { field } => format!("{field} 超出范围"),
            TimeError::NotOnFrameGrid { .. } => "时刻不在帧边界上".to_string(),
        };
        PlanError::new(error.code(), message)
    }
}

/// The part of the video needed to compute the plan: the sequence and the material.
#[derive(Clone, Copy)]
pub struct VideoView<'a> {
    pub sequences: &'a BTreeMap<Id, Sequence>,
    pub assets: &'a BTreeMap<Id, AssetRecord>,
}

impl<'a> From<&'a VideoSnapshot> for VideoView<'a> {
    fn from(video: &'a VideoSnapshot) -> VideoView<'a> {
        VideoView {
            sequences: &video.sequences,
            assets: &video.assets,
        }
    }
}

/// The video as sent by the UI: same shape as `VideoSnapshot`; only the fields the plan uses are read, and the rest are ignored.
#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlanDocument {
    pub root_sequence_id: Id,
    pub sequences: BTreeMap<Id, Sequence>,
    pub assets: BTreeMap<Id, AssetRecord>,
}

impl PlanDocument {
    pub fn view(&self) -> VideoView<'_> {
        VideoView {
            sequences: &self.sequences,
            assets: &self.assets,
        }
    }
}

/// The entry point for interactive preview (§9.4 Interactive): the host clock gives floating-point seconds, which are first approximated to microseconds before the plan is computed.
/// Strict export does not go through here: it calls [`plan_frame`] with the exact moment of each output frame (§9.10).
pub fn plan_interactive(video: VideoView<'_>, sequence_id: &str, seconds: f64) -> Result<FramePlan, PlanError> {
    plan_interactive_with_speech(video, sequence_id, seconds, None)
}

/// Same as [`plan_interactive`]; for `speech`, see [`plan_frame_with_speech`].
pub fn plan_interactive_with_speech(
    video: VideoView<'_>,
    sequence_id: &str,
    seconds: f64,
    speech: Option<&[(f64, f64)]>,
) -> Result<FramePlan, PlanError> {
    if !seconds.is_finite() {
        return Err(PlanError::new("INVALID_TIME", "时刻必须是有限的数"));
    }
    let micros = libm::round(seconds.max(0.0) * 1_000_000.0);
    let t = Ratio::new(micros as i128, 1_000_000).ok_or_else(|| PlanError::overflow("t"))?;
    // Floating-point seconds cannot land exactly on a frame boundary (1/30 s cannot be written as a finite decimal); if within 1 microsecond of the next boundary, it counts as having reached it. Otherwise, jumping to frame n would get frame n − 1's picture.
    let fps = match video.sequences.get(sequence_id) {
        Some(sequence) => Some(checked_fps(sequence)?),
        None => None,
    };
    let t = match fps.and_then(|fps| frame_time(frames_at(t, fps)?.ceil(), fps)) {
        Some(boundary)
            if boundary
                .checked_sub(t)
                .is_some_and(|gap| gap <= Ratio::new(1, 1_000_000).expect("常量")) =>
        {
            boundary
        }
        _ => t,
    };
    plan_frame_with_speech(video, sequence_id, t, speech)
}

/// The plan at sequence moment `t`. Does not expand script-triggered ducking (no word stream); to expand it, use [`plan_frame_with_speech`].
pub fn plan_frame(video: VideoView<'_>, sequence_id: &str, t: Ratio) -> Result<FramePlan, PlanError> {
    plan_frame_with_speech(video, sequence_id, t, None)
}

/// The plan at sequence moment `t`. `speech` is the effective word stream's intervals on the sequence ([`audio_plan::speech_activity`], the same data as the export sound plan). When given, script-triggered ducking is also expanded, and the sound's `gainDb` matches export at the same moment.
pub fn plan_frame_with_speech(
    video: VideoView<'_>,
    sequence_id: &str,
    t: Ratio,
    speech: Option<&[(f64, f64)]>,
) -> Result<FramePlan, PlanError> {
    if t.is_negative() {
        return Err(PlanError::new("INVALID_TIME", "时刻不能为负"));
    }
    let sequence = video
        .sequences
        .get(sequence_id)
        .ok_or_else(|| PlanError::new("SEQUENCE_NOT_FOUND", format!("没有序列 {sequence_id}")))?;
    let header = &sequence.header;
    let fps = checked_fps(sequence)?;
    let frame = frames_at(t, fps).ok_or_else(|| PlanError::overflow("t"))?.floor();
    let frame = i64::try_from(frame).map_err(|_| PlanError::overflow("t"))?;

    let tracks: HashMap<&str, &Track> = sequence.tracks.iter().map(|track| (track.id.as_str(), track)).collect();
    let items: HashMap<&str, &TimelineItem> = sequence.items.iter().map(|item| (item.base().id.as_str(), item)).collect();
    let rules = TrackRules::new(&sequence.tracks);
    let canvas = (header.canvas.width as f64, header.canvas.height as f64);

    let mut layers: Vec<(LayerOrder<'_>, VisualLayer)> = Vec::new();
    let mut voices: Vec<(i64, AudioVoice)> = Vec::new();
    for item in &sequence.items {
        let base = item.base();
        let Some(track) = tracks.get(base.track_id.as_str()) else {
            continue;
        };
        if !base.enabled {
            continue;
        }
        match item {
            TimelineItem::Video(video_item) => {
                if !covers(video_item.span, frame) {
                    continue;
                }
                let start = frame_start(video_item.span, fps)?;
                let rate = source_rate(&video_item.time_map)?;
                let source = map_time(&video_item.time_map, start, t)?.to_f64();
                if rules.visible(track)
                    && let Some(layer) = visual_layer(video, item, t, fps, canvas)?
                {
                    layers.push((
                        LayerOrder::new(track, &video_item.base.id, video_item.base.paint_order, video_item.span),
                        layer,
                    ));
                }
                if video_item.embedded_audio.enabled && rules.audible(track) {
                    let audio = &video_item.embedded_audio;
                    let bounds = span_bounds(video_item.span, fps)?;
                    let fade = fade_db(bounds, t, audio.fade_in.as_ref(), audio.fade_out.as_ref())?;
                    let volume = volume_at(audio.volume, &audio.envelope, bounds, t)?;
                    voices.push((
                        track.order,
                        AudioVoice {
                            item_id: video_item.base.id.clone(),
                            source: VoiceSource::Embedded,
                            asset: video_item.asset_ref.clone(),
                            source_seconds: source,
                            source_rate: rate,
                            gain_db: volume_db(volume) + fade,
                            unducked_gain_db: None,
                            transition_id: None,
                        },
                    ));
                }
            }
            TimelineItem::Audio(audio) => {
                if !rules.audible(track) || audio.mix.muted {
                    continue;
                }
                let Some((source, rate)) = audio_timing(audio, t, fps)? else {
                    continue;
                };
                let bounds = audio_bounds(audio, fps)?;
                let fade = fade_db(bounds, t, audio.mix.fade_in.as_ref(), audio.mix.fade_out.as_ref())?;
                let volume = volume_at(audio.mix.volume, &audio.mix.envelope, bounds, t)?;
                voices.push((
                    track.order,
                    AudioVoice {
                        item_id: audio.base.id.clone(),
                        source: VoiceSource::Audio,
                        asset: audio.asset_ref.clone(),
                        source_seconds: source,
                        source_rate: rate,
                        gain_db: volume_db(volume) + fade,
                        unducked_gain_db: None,
                        transition_id: None,
                    },
                ));
            }
            // With a pre-rendered stand-in, the picture and sound are output as video; without one, it is marked unsupported.
            TimelineItem::Composition(composition) => {
                if !covers(composition.span, frame) {
                    continue;
                }
                let start = frame_start(composition.span, fps)?;
                let rate = source_rate(&composition.time_map)?;
                let source = map_time(&composition.time_map, start, t)?.to_f64();
                if rules.visible(track)
                    && let Some(layer) = visual_layer(video, item, t, fps, canvas)?
                {
                    let order = LayerOrder::new(track, &composition.base.id, composition.base.paint_order, composition.span);
                    layers.push((order, layer));
                }
                let Some(prerender) = &composition.prerender else {
                    continue;
                };
                if let Some(audio) = composition.audio.as_ref().filter(|a| a.enabled && rules.audible(track)) {
                    let bounds = span_bounds(composition.span, fps)?;
                    let fade = fade_db(bounds, t, audio.fade_in.as_ref(), audio.fade_out.as_ref())?;
                    let volume = volume_at(audio.volume, &audio.envelope, bounds, t)?;
                    voices.push((
                        track.order,
                        AudioVoice {
                            item_id: composition.base.id.clone(),
                            source: VoiceSource::Embedded,
                            asset: prerender.clone(),
                            source_seconds: source,
                            source_rate: rate,
                            gain_db: volume_db(volume) + fade,
                            unducked_gain_db: None,
                            transition_id: None,
                        },
                    ));
                }
            }
            // Other visual instances: those that can be drawn get a drawing method; those that cannot get an unsupported layer (`visual_layer` has an answer for every kind).
            TimelineItem::Image(_)
            | TimelineItem::Text(_)
            | TimelineItem::Shape(_)
            | TimelineItem::Sticker(_)
            | TimelineItem::Visualizer(_)
            | TimelineItem::Progress(_)
            | TimelineItem::Draw(_)
            | TimelineItem::Placeholder(_)
            | TimelineItem::Confetti(_)
            | TimelineItem::Whiteboard(_) => {
                let span = item.span().expect("视觉实例都在帧网格上");
                if !covers(span, frame) || !rules.visible(track) {
                    continue;
                }
                if let Some(layer) = visual_layer(video, item, t, fps, canvas)? {
                    layers.push((LayerOrder::new(track, &base.id, base.paint_order, span), layer));
                }
            }
            // Captions display only within their own interval (§3.8). When the document is on the source material clock, the effect instance covering this moment is projected; if effect instances exist but none covers this moment (a cut gap), there is no caption at this moment.
            TimelineItem::Caption(caption) => {
                if !covers(caption.span, frame) || !rules.visible(track) {
                    continue;
                }
                let scope = if caption.scope_item_ids.is_empty() {
                    None
                } else {
                    let mut found = None;
                    for id in &caption.scope_item_ids {
                        let Some(scope_item) = items.get(id.as_str()) else {
                            continue;
                        };
                        if let Some(scope) = scope_at(scope_item, frame, t, fps)? {
                            found = Some(scope);
                            break;
                        }
                    }
                    match found {
                        Some(scope) => Some(scope),
                        None => continue,
                    }
                };
                let content = LayerContent::Caption {
                    document_id: caption.document_id.clone(),
                    style_document_id: caption.style_document_id.clone(),
                    sequence_seconds: t.to_f64(),
                    scope,
                };
                let layer = VisualLayer {
                    item_id: caption.base.id.clone(),
                    kind: LayerKind::Caption,
                    asset: None,
                    source_seconds: None,
                    source_rate: None,
                    matrix: [canvas.0, 0.0, 0.0, canvas.1, 0.0, 0.0],
                    source_rect: None,
                    opacity: 1.0,
                    content: Some(content),
                    effects: Vec::new(),
                    transition: None,
                };
                layers.push((
                    LayerOrder::new(track, &caption.base.id, caption.base.paint_order, caption.span),
                    layer,
                ));
            }
        }
    }

    let scene = Scene {
        video,
        sequence,
        items: &items,
        tracks: &tracks,
        rules: &rules,
        frame,
        t,
        fps,
        canvas,
    };
    for (_, layer) in &mut layers {
        layer.transition = scene.layer_transition(&layer.item_id)?;
    }
    scene.crossfade_voices(&mut voices)?;
    if !sequence.ducking.is_empty() {
        for (_, voice) in &mut voices {
            let Some(item) = items.get(voice.item_id.as_str()) else {
                continue;
            };
            let reduction = DuckingEnvelope::for_item_with_speech(sequence, item, fps, speech)?.reduction_db(t.to_f64());
            if reduction > 0.0 {
                voice.unducked_gain_db = Some(voice.gain_db);
                voice.gain_db -= reduction;
            }
        }
    }

    // A larger track `order` is higher; within the same track, sorting is by `paintOrder` (format spec §3.3), not by the stored return order.
    layers.sort_by(|(a, _), (b, _)| a.cmp(b));
    let mut layers: Vec<VisualLayer> = layers.into_iter().map(|(_, layer)| layer).collect();
    // Template layers (objects on the sequence, §3.17): each open layer is a generator layer that sits in its own box, drawn on top in document order.
    // Progress-type variables are computed from the sequence length (the end of the last instance).
    if let Some(template) = &header.template {
        let end = sequence
            .items
            .iter()
            .filter_map(TimelineItem::span)
            .map(|s| s.end_frame())
            .max()
            .unwrap_or(0);
        let duration = frame_time(end as i128, fps)
            .ok_or_else(|| PlanError::overflow("durationFrames"))?
            .to_f64();
        for layer in template.layers.iter().filter(|l| l.on) {
            let r = layer.rect;
            let pixel = PixelBox {
                cx: canvas.0 * (r.x + r.w / 2.0) / 100.0,
                cy: canvas.1 * (r.y + r.h / 2.0) / 100.0,
                width: canvas.0 * r.w / 100.0,
                height: canvas.1 * r.h / 100.0,
                rotation: 0.0,
                flip_x: false,
                flip_y: false,
            };
            let content = LayerContent::Generator {
                generator: "cuccut.template".into(),
                version: 1,
                parameters: serde_json::json!({ "layerId": layer.id }),
                elapsed_seconds: clean(t.to_f64()),
                duration_seconds: clean(duration),
            };
            if let Some(mut planned) = box_layer(&layer.id, LayerKind::Generator, &pixel, 1.0, content) {
                planned.source_seconds = Some(clean(t.to_f64()));
                planned.source_rate = Some(1.0);
                layers.push(planned);
            }
        }
    }
    voices.sort_by(|(a, x), (b, y)| a.cmp(b).then_with(|| x.item_id.cmp(&y.item_id)));

    Ok(FramePlan {
        sequence_id: sequence.id.clone(),
        sequence_revision: sequence.revision.clone(),
        frame,
        canvas: PlanCanvas {
            width: header.canvas.width,
            height: header.canvas.height,
            background: header.canvas.background.clone(),
            background_alpha: 1.0,
        },
        layers,
        voices: voices.into_iter().map(|(_, voice)| voice).collect(),
    })
}

/// The picture layer of a visual instance at `t` (including the effect stack). Does not check whether it covers this moment, whether it is enabled, or whether the track is shown: the other side of a transition needs its picture outside its own interval (source moments fall in handles). `None` when it cannot be drawn (fully transparent, box with no area); audio and captions have none. Kinds the old drawing method could not draw yield an `Unsupported` layer, not `None`.
fn visual_layer(
    video: VideoView<'_>,
    item: &TimelineItem,
    t: Ratio,
    fps: Rate,
    canvas: (f64, f64),
) -> Result<Option<VisualLayer>, PlanError> {
    let generator = |name: &str, parameters: Value, span: FrameSpan| -> Result<(LayerContent, f64), PlanError> {
        let start = frame_start(span, fps)?;
        let elapsed = t.checked_sub(start).ok_or_else(|| PlanError::overflow("t"))?;
        let duration = frame_time(span.duration_frames as i128, fps).ok_or_else(|| PlanError::overflow("durationFrames"))?;
        let content = LayerContent::Generator {
            generator: name.into(),
            version: 1,
            parameters,
            elapsed_seconds: elapsed.to_f64(),
            duration_seconds: duration.to_f64(),
        };
        Ok((content, elapsed.to_f64()))
    };
    // Generator layers: the local moment is how long since the instance started, at speed 1.
    let generator_layer = |item_id: &str, pixel: &PixelBox, opacity: f64, (content, elapsed): (LayerContent, f64)| {
        box_layer(item_id, LayerKind::Generator, pixel, opacity, content).map(|mut layer| {
            layer.source_seconds = Some(elapsed);
            layer.source_rate = Some(1.0);
            layer
        })
    };
    let unsupported = |item_id: &str, pixel: &PixelBox, reason: &str| {
        let content = LayerContent::Unsupported { reason: reason.into() };
        box_layer(item_id, LayerKind::Unsupported, pixel, 1.0, content)
    };
    let keyframed = video
        .sequences
        .values()
        .flat_map(|s| &s.header.animation_bindings)
        .any(|b| b.target_id == item.base().id);
    // When keyframes are present, a static opacity does not count: this moment's value is computed by the backend, so a layer must not be dropped because its static value is 0.
    let op = |opacity: f64| if keyframed { 1.0 } else { opacity };
    // The box has only one derivation (`item_box`): the stage's selection box and what is drawn here are the same.
    let Some(geometry) = item_geometry(item, video.assets) else {
        return Ok(None);
    };
    let (pixel, _) = pixel_box(&geometry, canvas);
    let layer = match item {
        TimelineItem::Video(v) => {
            let start = frame_start(v.span, fps)?;
            let timing = (map_time(&v.time_map, start, t)?.to_f64(), source_rate(&v.time_map)?);
            let dims = display_size(video.assets, &v.asset_ref);
            let fit = fit_of(&v.media);
            media_layer(
                &v.base.id,
                LayerKind::Video,
                &v.asset_ref,
                Some(timing),
                &pixel,
                fit,
                op(v.place.opacity()),
                dims,
                v.crop.as_ref(),
            )
        }
        TimelineItem::Image(i) => {
            let dims = display_size(video.assets, &i.asset_ref);
            let fit = fit_of(&i.media);
            media_layer(
                &i.base.id,
                LayerKind::Image,
                &i.asset_ref,
                None,
                &pixel,
                fit,
                op(i.place.opacity()),
                dims,
                i.crop.as_ref(),
            )
        }
        TimelineItem::Text(text) => {
            let style = text.style.clone().unwrap_or_else(|| Value::Object(Map::new()));
            match &text.counter {
                // Counter: the old-style `cuccut.counter` reads the v2 counter field, text and style.
                Some(counter) => {
                    let mut parameters = match serde_json::to_value(counter) {
                        Ok(Value::Object(map)) => map,
                        _ => Map::new(),
                    };
                    parameters.insert("text".into(), Value::String(text.text.clone().unwrap_or_default()));
                    parameters.insert("style".into(), style);
                    let made = generator("cuccut.counter", Value::Object(parameters), text.span)?;
                    generator_layer(&text.base.id, &pixel, op(text.place.opacity()), made)
                }
                None => {
                    let content = LayerContent::Text {
                        text: text.text.clone().unwrap_or_default(),
                        style,
                    };
                    box_layer(&text.base.id, LayerKind::Text, &pixel, op(text.place.opacity()), content)
                }
            }
        }
        TimelineItem::Shape(shape) => {
            let content = LayerContent::Shape {
                shape: serde_json::to_value(&shape.shape).unwrap_or(Value::Null),
            };
            box_layer(&shape.base.id, LayerKind::Shape, &pixel, op(shape.place.opacity()), content)
        }
        TimelineItem::Sticker(sticker) => {
            let asset_kind = sticker.asset_ref.as_ref().and_then(|r| video.assets.get(&r.id)).map(|a| a.kind);
            match (&sticker.asset_ref, asset_kind) {
                // Video stickers (animated images converted to transparent video) are drawn as video; the source moment taken follows `sticker.loop` (format spec §3.7).
                (Some(asset), Some(AssetKind::Video)) => {
                    let dims = display_size(video.assets, asset);
                    let start = frame_start(sticker.span, fps)?;
                    let elapsed = t.checked_sub(start).ok_or_else(|| PlanError::overflow("t"))?.to_f64();
                    let timing = sticker_timing(video.assets, asset, sticker.sticker.r#loop.as_deref(), elapsed);
                    media_layer(
                        &sticker.base.id,
                        LayerKind::Video,
                        asset,
                        Some(timing),
                        &pixel,
                        Fit::Contain,
                        op(sticker.place.opacity()),
                        dims,
                        None,
                    )
                }
                // Image stickers are drawn as images; the box follows the image's aspect ratio.
                (Some(asset), Some(AssetKind::Image)) => {
                    let dims = display_size(video.assets, asset);
                    media_layer(
                        &sticker.base.id,
                        LayerKind::Image,
                        asset,
                        None,
                        &pixel,
                        Fit::Contain,
                        op(sticker.place.opacity()),
                        dims,
                        None,
                    )
                }
                (Some(asset), Some(AssetKind::Lottie)) => {
                    let parameters = serde_json::json!({
                        "asset": asset,
                        "loop": sticker.sticker.r#loop.clone().unwrap_or_else(|| "loop".into()),
                    });
                    let made = generator("cuccut.lottie", parameters, sticker.span)?;
                    generator_layer(&sticker.base.id, &pixel, op(sticker.place.opacity()), made)
                }
                (Some(_), _) => unsupported(&sticker.base.id, &pixel, "sticker-asset-not-supported"),
                (None, _) => {
                    let mut parameters = Map::new();
                    if let Some(id) = &sticker.sticker.template_id {
                        parameters.insert("templateId".into(), Value::String(id.clone()));
                    }
                    if !sticker.sticker.fill_overrides.is_empty() {
                        parameters.insert(
                            "fillOverrides".into(),
                            serde_json::to_value(&sticker.sticker.fill_overrides).unwrap_or(Value::Null),
                        );
                    }
                    let made = generator("cuccut.sticker", Value::Object(parameters), sticker.span)?;
                    generator_layer(&sticker.base.id, &pixel, op(sticker.place.opacity()), made)
                }
            }
        }
        TimelineItem::Visualizer(v) => {
            let parameters = serde_json::to_value(&v.visualizer).unwrap_or(Value::Null);
            let made = generator("cuccut.audio-visualizer", parameters, v.span)?;
            generator_layer(&v.base.id, &pixel, op(v.place.opacity()), made)
        }
        TimelineItem::Progress(p) => {
            let parameters = serde_json::to_value(&p.progress).unwrap_or(Value::Null);
            let made = generator("cuccut.progress", parameters, p.span)?;
            generator_layer(&p.base.id, &pixel, op(p.place.opacity()), made)
        }
        TimelineItem::Confetti(c) => {
            let parameters = serde_json::to_value(&c.confetti).unwrap_or(Value::Null);
            let made = generator("cuccut.confetti", parameters, c.span)?;
            generator_layer(&c.base.id, &pixel, op(c.place.opacity()), made)
        }
        TimelineItem::Draw(d) => {
            let parameters = serde_json::to_value(&d.draw).unwrap_or(Value::Null);
            let made = generator("cuccut.draw", parameters, d.span)?;
            generator_layer(&d.base.id, &pixel, op(d.place.opacity()), made)
        }
        // Placeholder box: with material, it is drawn as visual media (image or video; the box uses the placeholder box's default placement); without material, the placeholder's appearance is drawn.
        TimelineItem::Placeholder(p) => {
            let asset_kind = p.asset_ref.as_ref().and_then(|r| video.assets.get(&r.id)).map(|a| a.kind);
            match (&p.asset_ref, asset_kind) {
                (Some(asset), Some(kind @ (AssetKind::Image | AssetKind::Video))) => {
                    let dims = display_size(video.assets, asset);
                    let timing = if kind == AssetKind::Video {
                        let start = frame_start(p.span, fps)?;
                        Some((clean(t.checked_sub(start).ok_or_else(|| PlanError::overflow("t"))?.to_f64()), 1.0))
                    } else {
                        None
                    };
                    let layer_kind = if kind == AssetKind::Video {
                        LayerKind::Video
                    } else {
                        LayerKind::Image
                    };
                    media_layer(
                        &p.base.id,
                        layer_kind,
                        asset,
                        timing,
                        &pixel,
                        p.media.fit(),
                        op(p.place.opacity()),
                        dims,
                        None,
                    )
                }
                (Some(_), _) => unsupported(&p.base.id, &pixel, "placeholder-asset-not-supported"),
                (None, _) => {
                    let parameters = serde_json::to_value(&p.placeholder).unwrap_or(Value::Null);
                    let made = generator("cuccut.placeholder", parameters, p.span)?;
                    generator_layer(&p.base.id, &pixel, op(p.place.opacity()), made)
                }
            }
        }
        // Whiteboard: image material is drawn in reveal order; the thing to decode is that image.
        TimelineItem::Whiteboard(w) => {
            let dims = display_size(video.assets, &w.asset_ref);
            media_layer(
                &w.base.id,
                LayerKind::Image,
                &w.asset_ref,
                None,
                &pixel,
                w.media.fit(),
                op(w.place.opacity()),
                dims,
                None,
            )
        }
        TimelineItem::Composition(composition) => {
            let start = frame_start(composition.span, fps)?;
            let rate = source_rate(&composition.time_map)?;
            let source = map_time(&composition.time_map, start, t)?.to_f64();
            match &composition.prerender {
                Some(prerender) => {
                    let dims = display_size(video.assets, prerender);
                    media_layer(
                        &composition.base.id,
                        LayerKind::Video,
                        prerender,
                        Some((source, rate)),
                        &pixel,
                        Fit::Contain,
                        op(composition.place.opacity()),
                        dims,
                        None,
                    )
                }
                None => {
                    let CompositionSource::Bundle { asset_ref } = &composition.source;
                    unsupported(&composition.base.id, &pixel, "bundle-without-prerender").map(|mut layer| {
                        layer.asset = Some(asset_ref.clone());
                        layer
                    })
                }
            }
        }
        TimelineItem::Audio(_) | TimelineItem::Caption(_) => None,
    };
    let Some(mut layer) = layer else {
        return Ok(None);
    };
    if layer.kind != LayerKind::Unsupported {
        layer.effects = layer_effects(item, canvas);
    }
    Ok(Some(layer))
}

/// The source moment and speed for a video sticker `elapsed` seconds into the instance (`sticker.loop`, format spec §3.7): `loop` (default) wraps modulo the material duration, `once` plays through and stops at the end, and `hold` freezes the first frame. When the material duration is unknown, elapsed time is used.
fn sticker_timing(assets: &BTreeMap<Id, AssetRecord>, asset: &VersionRef, mode: Option<&str>, elapsed: f64) -> (f64, f64) {
    let duration = assets
        .get(&asset.id)
        .and_then(|a| a.revisions.get(&asset.revision))
        .and_then(|r| r.duration.as_ref())
        .and_then(|d| d.to_ratio("duration").ok())
        .map(Ratio::to_f64)
        .filter(|d| *d > 0.0);
    let elapsed = elapsed.max(0.0);
    match (mode.unwrap_or(timeline::schema::STICKER_LOOP_DEFAULT), duration) {
        (timeline::schema::STICKER_LOOP_HOLD, _) => (0.0, 0.0),
        (timeline::schema::STICKER_LOOP_ONCE, Some(d)) => (clean(elapsed.min(d)), 1.0),
        (_, Some(d)) => (clean(elapsed.rem_euclid(d)), 1.0),
        (_, None) => (clean(elapsed), 1.0),
    }
}

/// The layer's effects: each step of `fx` is listed in application order (format spec §3.9's 1–14, excluding masks and reveal), with identity values omitted. Lengths are converted from the 540 short side to canvas pixels, and hue from [-1, 1] to degrees.
fn layer_effects(item: &TimelineItem, canvas: (f64, f64)) -> Vec<LayerEffect> {
    let Some(fx) = item.fx() else {
        return Vec::new();
    };
    let unit = canvas.0.min(canvas.1) / timeline::REFERENCE_SHORT_EDGE;
    let on = |v: Option<f64>| v.filter(|v| v.is_finite() && *v != 0.0);
    let mut steps: Vec<(&str, Value)> = Vec::new();
    if let Some(preset) = fx.filter_preset.filter(|p| *p != video_model::FilterPreset::None) {
        steps.push(("filterPreset", serde_json::json!({ "preset": preset })));
    }
    if let Some(preset) = fx.effect_preset.filter(|p| *p != video_model::EffectPreset::None) {
        steps.push((
            "effectPreset",
            serde_json::json!({ "preset": preset, "intensity": fx.effect_intensity.unwrap_or(1.0) }),
        ));
    }
    if on(fx.grayscale).is_some() || on(fx.brightness).is_some() {
        steps.push((
            "colorAdjust",
            serde_json::json!({ "grayscale": fx.grayscale.unwrap_or(0.0), "brightness": fx.brightness.unwrap_or(0.0) }),
        ));
    }
    for (kind, value) in [("exposure", fx.exposure), ("contrast", fx.contrast), ("saturation", fx.saturation)] {
        if let Some(value) = on(value) {
            steps.push((kind, serde_json::json!({ "amount": value })));
        }
    }
    if let Some(hue) = on(fx.hue) {
        steps.push(("hue", serde_json::json!({ "degrees": hue * 180.0 })));
    }
    if let Some(temperature) = on(fx.temperature) {
        steps.push(("temperature", serde_json::json!({ "amount": temperature })));
    }
    if let Some(blur) = on(fx.blur) {
        steps.push(("blur", serde_json::json!({ "radius": blur * unit })));
    }
    for (kind, value) in [("sharpen", fx.sharpen), ("noise", fx.noise), ("vignette", fx.vignette)] {
        if let Some(value) = on(value) {
            steps.push((kind, serde_json::json!({ "amount": value })));
        }
    }
    if let Some(stroke) = &fx.stroke {
        steps.push(("stroke", serde_json::json!({ "width": stroke.width * unit, "color": stroke.color })));
    }
    if let Some(shadow) = &fx.shadow {
        steps.push((
            "shadow",
            serde_json::json!({
                "offsetX": shadow.offset_x * unit,
                "offsetY": shadow.offset_y * unit,
                "blur": shadow.blur * unit,
                "color": shadow.color,
                "opacity": shadow.opacity,
            }),
        ));
    }
    steps
        .into_iter()
        .map(|(kind, params)| LayerEffect {
            id: format!("fx.{kind}"),
            kind: kind.into(),
            params: match params {
                Value::Object(map) => map,
                _ => Map::new(),
            },
            unsupported: None,
        })
        .collect()
}

/// The context at this frame needed to compute transitions and sound cross-fades.
struct Scene<'a> {
    video: VideoView<'a>,
    sequence: &'a Sequence,
    items: &'a HashMap<&'a str, &'a TimelineItem>,
    tracks: &'a HashMap<&'a str, &'a Track>,
    rules: &'a TrackRules,
    frame: i64,
    t: Ratio,
    fps: Rate,
    canvas: (f64, f64),
}

/// The transitions covering this frame: both sides' instances and the progress within the window.
struct Active<'a> {
    left: Option<&'a TimelineItem>,
    right: Option<&'a TimelineItem>,
    progress: f64,
}

impl<'a> Scene<'a> {
    /// Whether the transition is active at this frame (window: see [`transition_window`]).
    fn active(&self, tr: &Transition) -> Result<Option<Active<'a>>, PlanError> {
        let Some((left, right, start, end)) = transition_window(self.items, tr) else {
            return Ok(None);
        };
        if self.frame < start || self.frame >= end {
            return Ok(None);
        }
        let from = frame_time(start as i128, self.fps).ok_or_else(|| PlanError::overflow("transition"))?;
        let to = frame_time(end as i128, self.fps).ok_or_else(|| PlanError::overflow("transition"))?;
        let elapsed = self.t.checked_sub(from).ok_or_else(|| PlanError::overflow("t"))?;
        let length = to.checked_sub(from).ok_or_else(|| PlanError::overflow("transition"))?;
        let progress = elapsed.checked_div(length).ok_or_else(|| PlanError::overflow("t"))?.to_f64();
        Ok(Some(Active {
            left,
            right,
            progress: clean(progress.clamp(0.0, 1.0)),
        }))
    }

    /// The transition that this instance's layer is in at this moment (format spec §3.9). When the other side of a two-sided transition cannot be drawn (disabled, fully transparent), it is a hard cut, with no transition.
    fn layer_transition(&self, item_id: &str) -> Result<Option<Box<LayerTransition>>, PlanError> {
        for tr in &self.sequence.transitions {
            if !tr.item_ids().any(|id| id == item_id) {
                continue;
            }
            let Some(active) = self.active(tr)? else {
                continue;
            };
            let outgoing = tr.left_item_id.as_deref() == Some(item_id);
            let unsupported = matches!(tr.kind, TransitionKind::Unsupported { .. }).then(|| "unknown-kind".to_string());
            let other = if outgoing { active.right } else { active.left };
            let partner = match other {
                Some(other) if unsupported.is_none() => {
                    let visible = self
                        .tracks
                        .get(other.base().track_id.as_str())
                        .is_some_and(|t| self.rules.visible(t));
                    if !other.base().enabled || !visible {
                        continue;
                    }
                    match visual_layer(self.video, other, self.t, self.fps, self.canvas)? {
                        Some(layer) => Some(Box::new(layer)),
                        None => continue,
                    }
                }
                _ => None,
            };
            return Ok(Some(Box::new(LayerTransition {
                id: tr.id.clone(),
                kind: tr.kind.name().to_string(),
                params: tr.kind.params(),
                easing: tr.easing,
                progress: active.progress,
                eased: clean(tr.easing.apply(active.progress)),
                role: if outgoing {
                    TransitionRole::Outgoing
                } else {
                    TransitionRole::Incoming
                },
                partner,
                unsupported,
            })));
        }
        Ok(None)
    }

    /// A two-sided transition with `audioCrossfade`: the sound each video carries is cross-faded in the window with equal power, the outgoing side multiplied by cos(p·π/2) and the incoming side by sin(p·π/2), where p is linear progress (no easing). The other side lies outside its own interval and takes sound from handles according to its time mapping, without applying its own fade in/out. Cross-fading only happens when both sides are enabled; when one side has its own sound turned off, that side is silent and the other side still fades in or out per its curve as usual.
    fn crossfade_voices(&self, voices: &mut Vec<(i64, AudioVoice)>) -> Result<(), PlanError> {
        for tr in self.sequence.transitions.iter().filter(|tr| tr.audio_crossfade) {
            let Some(active) = self.active(tr)? else {
                continue;
            };
            let (Some(TimelineItem::Video(left)), Some(TimelineItem::Video(right))) = (active.left, active.right) else {
                continue;
            };
            // When one side is disabled, it is a hard cut: the other side sounds as usual, with no cross-fade.
            if !left.base.enabled || !right.base.enabled {
                continue;
            }
            let Some(track) = self.tracks.get(left.base.track_id.as_str()) else {
                continue;
            };
            if !self.rules.audible(track) {
                continue;
            }
            let angle = active.progress * std::f64::consts::FRAC_PI_2;
            for (side, amplitude) in [(left, libm::cos(angle)), (right, libm::sin(angle))] {
                let db = 20.0 * libm::log10(amplitude.max(1e-5));
                let existing = voices
                    .iter_mut()
                    .find(|(_, v)| v.item_id == side.base.id && v.source == VoiceSource::Embedded);
                if let Some((_, voice)) = existing {
                    voice.gain_db += db;
                    voice.transition_id = Some(tr.id.clone());
                } else if side.embedded_audio.enabled {
                    let start = frame_start(side.span, self.fps)?;
                    let audio = &side.embedded_audio;
                    let volume = volume_at(audio.volume, &audio.envelope, span_bounds(side.span, self.fps)?, self.t)?;
                    voices.push((
                        track.order,
                        AudioVoice {
                            item_id: side.base.id.clone(),
                            source: VoiceSource::Embedded,
                            asset: side.asset_ref.clone(),
                            source_seconds: map_time(&side.time_map, start, self.t)?.to_f64(),
                            source_rate: source_rate(&side.time_map)?,
                            gain_db: volume_db(volume) + db,
                            unducked_gain_db: None,
                            transition_id: Some(tr.id.clone()),
                        },
                    ));
                }
            }
        }
        Ok(())
    }
}

/// The transition's window on the timeline `[start, end)` (frames) and its two sides' instances. The plan does not trust the video passed in: if an instance is missing, not on the frame grid, the two sides are not on the same track or not adjacent, or the window extends beyond an instance, the transition is treated as absent (hard cut). Handles are not checked here: when source moments extend past the material, the backend clamps them to the material's ends.
/// The frame plan and the interval plan for audio export ([`audio_plan`]) share this judgement.
pub(crate) fn transition_window<'a>(
    items: &HashMap<&'a str, &'a TimelineItem>,
    tr: &Transition,
) -> Option<(Option<&'a TimelineItem>, Option<&'a TimelineItem>, i64, i64)> {
    let lookup = |id: &Option<Id>| match id {
        None => Some(None),
        Some(id) => items.get(id.as_str()).map(|item| Some(*item)),
    };
    let (Some(left), Some(right)) = (lookup(&tr.left_item_id), lookup(&tr.right_item_id)) else {
        return None;
    };
    let (ls, rs) = (left.and_then(TimelineItem::span), right.and_then(TimelineItem::span));
    if (left.is_some() && ls.is_none()) || (right.is_some() && rs.is_none()) {
        return None;
    }
    if let (Some(l), Some(r), Some(ls), Some(rs)) = (left, right, ls, rs)
        && (l.base().track_id != r.base().track_id || ls.end_frame() != rs.from_frame)
    {
        return None;
    }
    let (start, end) = tr.window(ls, rs)?;
    let lo = ls.or(rs).map_or(0, |s| s.from_frame);
    let hi = rs.or(ls).map_or(0, |s| s.end_frame());
    if start >= end || start < lo || end > hi {
        return None;
    }
    Some((left, right, start, end))
}

/// Track display and sound rules: hiding only affects the picture, and muting only affects sound; Solo takes effect separately for the visual group and the audio group.
pub(crate) struct TrackRules {
    visual_solo: bool,
    audio_solo: bool,
}

impl TrackRules {
    pub(crate) fn new(tracks: &[Track]) -> TrackRules {
        let solo = |group| tracks.iter().any(|t| t.solo.enabled && t.solo.group == group);
        TrackRules {
            visual_solo: solo(SoloGroup::Visual),
            audio_solo: solo(SoloGroup::Audio),
        }
    }

    fn visible(&self, track: &Track) -> bool {
        track.visible && (!self.visual_solo || (track.solo.enabled && track.solo.group == SoloGroup::Visual))
    }

    pub(crate) fn audible(&self, track: &Track) -> bool {
        !track.muted && (!self.audio_solo || (track.solo.enabled && track.solo.group == SoloGroup::Audio))
    }
}

#[derive(PartialEq, Eq, PartialOrd, Ord)]
struct LayerOrder<'a> {
    track_order: i64,
    track_id: &'a str,
    paint_order: i64,
    from_frame: i64,
    item_id: &'a str,
}

impl<'a> LayerOrder<'a> {
    fn new(track: &'a Track, item_id: &'a str, paint_order: i64, span: FrameSpan) -> LayerOrder<'a> {
        LayerOrder {
            track_order: track.order,
            track_id: &track.id,
            paint_order,
            from_frame: span.from_frame,
            item_id,
        }
    }
}

/// A visual instance occupies `[fromFrame, fromFrame + durationFrames)`.
fn covers(span: FrameSpan, frame: i64) -> bool {
    span.from_frame <= frame && frame < span.end_frame()
}

fn frame_start(span: FrameSpan, fps: Rate) -> Result<Ratio, PlanError> {
    frame_time(span.from_frame as i128, fps).ok_or_else(|| PlanError::overflow("fromFrame"))
}

/// The plan does not trust the video passed in: frame rate and speed are validated first, since an illegal denominator would panic in the rational arithmetic below, which in WASM is a trap.
fn checked_fps(sequence: &Sequence) -> Result<Rate, PlanError> {
    sequence.header.fps.validate("fps")?;
    Ok(sequence.header.fps)
}

/// The speed of source time relative to sequence time.
fn source_rate(time_map: &TimeMap) -> Result<f64, PlanError> {
    match time_map {
        TimeMap::Linear { rate, .. } => {
            rate.validate("timeMap.rate")?;
            Ok(rate.ratio().to_f64())
        }
        TimeMap::Hold { .. } => Ok(0.0),
    }
}

/// The interval `[start, end)` in which an audio instance sounds: its start and length are at sample level (format spec §2.10), not judged by frames.
pub(crate) fn audio_bounds(audio: &AudioItem, fps: Rate) -> Result<(Ratio, Ratio), PlanError> {
    let offset = audio.subframe_offset.to_ratio("subframeOffset")?;
    let start = frame_time(audio.from_frame as i128, fps)
        .and_then(|s| s.checked_add(offset))
        .ok_or_else(|| PlanError::overflow("fromFrame"))?;
    let end = start
        .checked_add(audio.play_duration.to_ratio("playDuration")?)
        .ok_or_else(|| PlanError::overflow("playDuration"))?;
    Ok((start, end))
}

/// The interval `[start, end)` occupied by an instance on the frame grid.
pub(crate) fn span_bounds(span: FrameSpan, fps: Rate) -> Result<(Ratio, Ratio), PlanError> {
    let end = frame_time(span.end_frame() as i128, fps).ok_or_else(|| PlanError::overflow("durationFrames"))?;
    Ok((frame_start(span, fps)?, end))
}

/// The instance's volume (linear multiplier) at moment `t`: when there is an envelope, it is the envelope's sampled value (replacing `volume`); otherwise it is `volume` (format spec §3.9, [`envelope::VolumeCurve`]). `t` may lie outside the instance's interval (when a transition takes handles), and the envelope is extended at both ends.
fn volume_at(volume: f64, points: &[EnvelopePoint], (start, end): (Ratio, Ratio), t: Ratio) -> Result<f64, PlanError> {
    if points.is_empty() {
        return Ok(volume);
    }
    let duration = end.checked_sub(start).ok_or_else(|| PlanError::overflow("duration"))?.to_f64();
    let local = t.checked_sub(start).ok_or_else(|| PlanError::overflow("t"))?.to_f64();
    Ok(envelope::VolumeCurve::new(volume, points, duration).at(local))
}

/// The fade gain at moment `t`, converted to dB (added on top of `gainDb`): amplitude rises linearly from 0 to 1 in the fade-in section and falls linearly to 0 in the fade-out section (format spec §3.9). Where the two sections overlap, the smaller amplitude is taken; outside any fade it is 0 dB.
fn fade_db((start, end): (Ratio, Ratio), t: Ratio, fade_in: Option<&MediaTime>, fade_out: Option<&MediaTime>) -> Result<f64, PlanError> {
    let since = t.checked_sub(start).ok_or_else(|| PlanError::overflow("t"))?.to_f64();
    let until = end.checked_sub(t).ok_or_else(|| PlanError::overflow("t"))?.to_f64();
    let mut amplitude: f64 = 1.0;
    for (fade, distance, field) in [(fade_in, since, "fadeIn"), (fade_out, until, "fadeOut")] {
        let length = fade.map(|f| f.to_ratio(field)).transpose()?.map_or(0.0, Ratio::to_f64);
        if length > 0.0 {
            amplitude = amplitude.min((distance / length).max(0.0));
        }
    }
    // −100 dB is already inaudible; −∞ is not written, because the plan must be serializable to JSON.
    Ok(if amplitude >= 1.0 {
        0.0
    } else {
        20.0 * amplitude.max(1e-5).log10()
    })
}

/// The source moment and speed of an audio instance at `t`; `None` when outside the interval in which it sounds.
fn audio_timing(audio: &AudioItem, t: Ratio, fps: Rate) -> Result<Option<(f64, f64)>, PlanError> {
    let (start, end) = audio_bounds(audio, fps)?;
    if t < start || t >= end {
        return Ok(None);
    }
    let rate = source_rate(&audio.time_map)?;
    Ok(Some((map_time(&audio.time_map, start, t)?.to_f64(), rate)))
}

/// When a caption's effect instance covers `t`, the position within its source at this moment. Only instances with a time mapping (video, audio, compositions) can be projected; disabling an instance or hiding/muting its track does not affect the projection, which only decides whether the instance itself shows picture and sound.
fn scope_at(item: &TimelineItem, frame: i64, t: Ratio, fps: Rate) -> Result<Option<CaptionScope>, PlanError> {
    let (id, asset, seconds) = match item {
        TimelineItem::Video(video) => {
            if !covers(video.span, frame) {
                return Ok(None);
            }
            let start = frame_start(video.span, fps)?;
            (&video.base.id, &video.asset_ref, map_time(&video.time_map, start, t)?.to_f64())
        }
        TimelineItem::Composition(composition) => {
            let CompositionSource::Bundle { asset_ref } = &composition.source;
            let asset = composition.prerender.as_ref().unwrap_or(asset_ref);
            if !covers(composition.span, frame) {
                return Ok(None);
            }
            let start = frame_start(composition.span, fps)?;
            (&composition.base.id, asset, map_time(&composition.time_map, start, t)?.to_f64())
        }
        TimelineItem::Audio(audio) => match audio_timing(audio, t, fps)? {
            Some((seconds, _)) => (&audio.base.id, &audio.asset_ref, seconds),
            None => return Ok(None),
        },
        _ => return Ok(None),
    };
    Ok(Some(CaptionScope {
        item_id: id.clone(),
        asset: asset.clone(),
        source_seconds: seconds,
    }))
}

/// The instance's pixel box on the canvas: center, width and height, rotation (degrees, clockwise about the center) and flip. Converted from v2's `place` (percent of the frame) via `timeline::geometry`; the old drawing method draws with it.
#[derive(Clone, Copy, Debug, PartialEq)]
pub(crate) struct PixelBox {
    cx: f64,
    cy: f64,
    width: f64,
    height: f64,
    rotation: f64,
    flip_x: bool,
    flip_y: bool,
}

impl PixelBox {
    pub(crate) fn new(place: &Place, (x, y, width, height): (f64, f64, f64, f64)) -> PixelBox {
        PixelBox {
            cx: x + width / 2.0,
            cy: y + height / 2.0,
            width,
            height,
            rotation: place.rot.unwrap_or(0.0),
            flip_x: place.flip_x,
            flip_y: place.flip_y,
        }
    }
}

/// How the source picture is fitted into the box (v2 default `cover`). When the source size is unknown, [`media_layer`] fills the box and ignores this.
fn fit_of(media: &MediaFields) -> Fit {
    media.fit()
}

/// Video and image layers (format spec §3.5): the source picture is fitted into the instance's pixel box per `fit`. Fills when the source size is unknown.
#[allow(clippy::too_many_arguments)]
fn media_layer(
    item_id: &str,
    kind: LayerKind,
    asset: &VersionRef,
    timing: Option<(f64, f64)>,
    pixel: &PixelBox,
    fit: Fit,
    opacity: f64,
    source: Option<(f64, f64)>,
    crop: Option<&Crop>,
) -> Option<VisualLayer> {
    let opacity = drawable(pixel, opacity)?;
    let (bw, bh) = (pixel.width, pixel.height);
    // Cropping comes before fitting: the remaining region is fitted as if it were the source picture, and the source region is mapped back to whole-source coordinates (format spec §3.5).
    let [cl, ct, cr, cb] = crop.filter(|c| c.is_valid()).map_or([0.0, 0.0, 1.0, 1.0], Crop::rect);
    let source = source.map(|(sw, sh)| (sw * (cr - cl), sh * (cb - ct)));

    // The rectangle of content within the box (relative to the box's top-left corner) and the source region taken.
    let (cw, ch, ox, oy, rect) = match (fit, source) {
        (_, None) => (bw, bh, 0.0, 0.0, [0.0, 0.0, 1.0, 1.0]),
        (Fit::Contain, Some((sw, sh))) => {
            let scale = (bw / sw).min(bh / sh);
            let (w, h) = (sw * scale, sh * scale);
            (w, h, (bw - w) / 2.0, (bh - h) / 2.0, [0.0, 0.0, 1.0, 1.0])
        }
        (Fit::Cover, Some((sw, sh))) => {
            let scale = (bw / sw).max(bh / sh);
            let (u, v) = (bw / (sw * scale), bh / (sh * scale));
            (
                bw,
                bh,
                0.0,
                0.0,
                [(1.0 - u) / 2.0, (1.0 - v) / 2.0, (1.0 + u) / 2.0, (1.0 + v) / 2.0],
            )
        }
    };

    Some(VisualLayer {
        item_id: item_id.to_string(),
        kind,
        asset: Some(asset.clone()),
        source_seconds: timing.map(|(seconds, _)| seconds),
        source_rate: timing.map(|(_, rate)| rate),
        matrix: placement(pixel, (cw, ch, ox, oy)),
        source_rect: Some(
            [
                cl + rect[0] * (cr - cl),
                ct + rect[1] * (cb - ct),
                cl + rect[2] * (cr - cl),
                ct + rect[3] * (cb - ct),
            ]
            .map(clean),
        ),
        opacity,
        content: None,
        effects: Vec::new(),
        transition: None,
    })
}

/// Layers whose content is the whole pixel box: text, shapes, generators and unsupported layers.
fn box_layer(item_id: &str, kind: LayerKind, pixel: &PixelBox, opacity: f64, content: LayerContent) -> Option<VisualLayer> {
    let opacity = drawable(pixel, opacity)?;
    Some(VisualLayer {
        item_id: item_id.to_string(),
        kind,
        asset: None,
        source_seconds: None,
        source_rate: None,
        matrix: placement(pixel, (pixel.width, pixel.height, 0.0, 0.0)),
        source_rect: None,
        opacity,
        content: Some(content),
        effects: Vec::new(),
        transition: None,
    })
}

/// Opacity of an instance that can be drawn: the box must be a finite number, have area, and not be fully transparent.
fn drawable(pixel: &PixelBox, opacity: f64) -> Option<f64> {
    let opacity = if opacity.is_finite() { opacity.clamp(0.0, 1.0) } else { 0.0 };
    let finite = [pixel.width, pixel.height, pixel.cx, pixel.cy, pixel.rotation]
        .iter()
        .all(|v| v.is_finite());
    (opacity > 0.0 && finite && pixel.width > 0.0 && pixel.height > 0.0).then_some(opacity)
}

/// Matrix from the unit square to canvas pixels (format spec §3.5): the box rotates about its own center (angle, clockwise).
/// `content` is the rectangle of content within the box (width, height, and offset relative to the box's top-left). Flip is the content mirrored about its own center, applied before rotation; since the content is centered in the box, it is the same as flipping the whole box.
fn placement(pixel: &PixelBox, content: (f64, f64, f64, f64)) -> [f64; 6] {
    let (cw, ch, ox, oy) = content;
    let (bw, bh) = (pixel.width, pixel.height);
    let (sin, cos) = rotation(pixel.rotation);
    let (px, py) = (pixel.cx, pixel.cy);
    let (qx, qy) = (ox - 0.5 * bw, oy - 0.5 * bh);
    let [mut a, mut b, mut c, mut d, mut e, mut f] = [
        cw * cos,
        cw * sin,
        -ch * sin,
        ch * cos,
        px + qx * cos - qy * sin,
        py + qx * sin + qy * cos,
    ];
    // u → 1 − u: right-multiply the matrix by [−1, 0, 0, 1, 1, 0].
    if pixel.flip_x {
        (e, f) = (e + a, f + b);
        (a, b) = (-a, -b);
    }
    // v → 1 − v: right-multiply the matrix by [1, 0, 0, −1, 0, 1].
    if pixel.flip_y {
        (e, f) = (e + c, f + d);
        (c, d) = (-c, -d);
    }
    [a, b, c, d, e, f].map(clean)
}

/// Converts a linear volume multiplier to dB: 0 is recorded as −100 dB (inaudible; −∞ is not written, because the plan must be serializable to JSON).
pub(crate) fn volume_db(volume: f64) -> f64 {
    if !volume.is_finite() {
        return -100.0;
    }
    clean(20.0 * libm::log10(volume.max(1e-5)))
}

/// Sine and cosine of an angle. Exact values at multiples of 90°; otherwise computed via libm, so native and wasm32 results agree.
fn rotation(degrees: f64) -> (f64, f64) {
    let normalized = libm::fmod(degrees, 360.0);
    let normalized = if normalized < 0.0 { normalized + 360.0 } else { normalized };
    match normalized {
        0.0 => (0.0, 1.0),
        90.0 => (1.0, 0.0),
        180.0 => (0.0, -1.0),
        270.0 => (-1.0, 0.0),
        _ => {
            let radians = normalized * std::f64::consts::PI / 180.0;
            (libm::sin(radians), libm::cos(radians))
        }
    }
}

/// Strips `-0.0`: output must be stable, so the same plan has only one representation.
pub(crate) fn clean(value: f64) -> f64 {
    if value == 0.0 { 0.0 } else { value }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rotation_is_exact_on_right_angles() {
        assert_eq!(rotation(0.0), (0.0, 1.0));
        assert_eq!(rotation(-90.0), (-1.0, 0.0));
        assert_eq!(rotation(450.0), (1.0, 0.0));
        let (sin, cos) = rotation(30.0);
        assert!((sin - 0.5).abs() < 1e-12 && (cos - 3f64.sqrt() / 2.0).abs() < 1e-12);
    }

    #[test]
    fn clean_drops_negative_zero() {
        assert!(clean(-0.0).is_sign_positive());
        assert_eq!(clean(-1.5), -1.5);
    }
}
