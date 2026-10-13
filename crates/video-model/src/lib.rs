//! Exchange DTOs for the video (video format spec §3, §4). Picture element kinds and parameters use the v2 element model (`crates/timeline`):
//! kinds correspond one-to-one with `ElementKind`, and the parameter field names, values and ranges follow it; an instance's identity, its track and its time are the
//! v3 container. The props of each kind use the types of `timeline::schema` directly; geometry, effects, animation and so on are types that v2 writes out as
//! `null`, and here there is a separate exchange form that does not write `null`; during validation it is converted to the same-named types of `timeline`.
//! Script-type content (transcripts, translations, caption styles, cut sets and so on) is versioned documents: the snapshot holds only the document header, and the body is fetched separately by version;
//! the DTOs for transcript, translation and cut-set bodies are in [`speech`], [`translation`] and [`cut_set`] (§5.2, §5.3, §6.7), and the checks for the caption-style body are in [`caption_style`] (§5.6).

use std::collections::BTreeMap;

use editor_semantics::{MediaTime, Rate, TimeMap};
use message_ref::MessageRef;
use serde::{Deserialize, Serialize};
use serde_json::Value;

mod animation;
pub mod caption_style;
pub mod cut_set;
mod ducking;
pub mod editorial_proposal;
mod effect;
mod marker;
mod place;
pub mod speech;
mod transition;
pub mod translation;

pub use animation::{Animation, AnimationBinding, AnimationSlot, Keyframe, KeyframeProperty, bindings_to_timeline};
pub use ducking::{DuckingGroup, DuckingRule, DuckingTrigger};
pub use effect::{
    Crop, EffectPreset, FX_SHADOW_BLUR_RANGE, FX_SHADOW_OPACITY_RANGE, FX_STROKE_WIDTH_MAX, FX_TEMPERATURE_RANGE, FilterPreset, Fx,
    FxShadow, FxStroke, Mask, MaskShape, is_color,
};
pub use marker::{Marker, MarkerKind};
pub use place::{Background, CornerRadii, Fit, MediaFields, Place, Tile, VisualMode};
pub use timeline::protocol::template::TemplateDoc as TemplateLayers;
pub use timeline::schema::{
    ConfettiProps, CounterProps, DrawProps, PlaceholderProps, ProgressProps, ShapeProps, StickerProps, VisualizerProps, WhiteboardProps,
};
pub use transition::{Direction, Easing, SINGLE_SIDED_KINDS, TWO_SIDED_ONLY_KINDS, Transition, TransitionKind, TransitionPlacement};

pub type Id = String;
pub type Revision = String;

pub const VIDEO_FORMAT: &str = "cuccut.video";
/// The current format version. From 3 onward, picture elements use the v2 element model (§1.4); only this version is accepted, and videos of older versions must be re-imported.
pub const SCHEMA_VERSION: u32 = 3;
/// Default canvas background color (§3.2).
pub const DEFAULT_CANVAS_BACKGROUND: &str = "#000000";

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct VersionRef {
    pub id: Id,
    pub revision: Revision,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FrameSpan {
    pub from_frame: i64,
    pub duration_frames: i64,
}

impl FrameSpan {
    pub fn end_frame(&self) -> i64 {
        self.from_frame + self.duration_frames
    }
}

/// Video snapshot (§3.1). The working state is held by VideoStore; the snapshot is not a second writer.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VideoSnapshot {
    pub format: String,
    pub schema_version: u32,
    pub time_contract_version: u32,
    pub id: Id,
    pub name: String,
    pub revision: Revision,
    pub root_sequence_id: Id,
    pub sequences: BTreeMap<Id, Sequence>,
    pub assets: BTreeMap<Id, AssetRecord>,
    /// Document header (§4.4). The body is not in the snapshot.
    pub documents: BTreeMap<Id, DocumentRecord>,
    pub fonts: BTreeMap<Id, Value>,
    pub localization_sets: BTreeMap<Id, Value>,
    pub canvas_variants: BTreeMap<Id, Value>,
    pub sync_groups: BTreeMap<Id, Value>,
    pub protections: BTreeMap<Id, ProtectionRecord>,
    pub checkpoints: BTreeMap<Id, Checkpoint>,
    pub links: Vec<Value>,
}

/// Sequence (§3.2). `tracks` and `items` are separate entities in storage and are assembled in order when the snapshot is taken; `animationBindings` are in [`SequenceHeader`].
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Sequence {
    pub id: Id,
    pub revision: Revision,
    #[serde(flatten)]
    pub header: SequenceHeader,
    pub tracks: Vec<Track>,
    pub items: Vec<TimelineItem>,
    /// Transitions (§3.9), sorted by ID.
    #[serde(default)]
    pub transitions: Vec<Transition>,
    /// Markers and chapters (§3.13), sorted by frame.
    #[serde(default)]
    pub markers: Vec<Marker>,
    /// Ducking rules (§3.9), sorted by ID.
    #[serde(default)]
    pub ducking: Vec<DuckingRule>,
}

/// The sequence's own fields (excluding tracks and instances), saved as one entity.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SequenceHeader {
    pub name: String,
    /// While `name` is still the default name given by the engine, its message reference (§3.2): the UI regenerates it in the reader's language. Absent after a rename.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name_ref: Option<MessageRef>,
    pub fps: Rate,
    pub canvas: Canvas,
    pub duration_policy: DurationPolicy,
    /// Keyframe bindings (§3.15). They are saved together with the sequence's other fields, so they are here and not on [`Sequence`]; the exchange form is the same.
    #[serde(default)]
    pub animation_bindings: Vec<AnimationBinding>,
    /// Template layers (§3.17); omitted when there are none.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub template: Option<TemplateLayers>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Canvas {
    pub width: u32,
    pub height: u32,
    pub working_space: String,
    /// Canvas background: an opaque solid `#RRGGBB`, always written in uppercase (§3.2).
    pub background: String,
}

/// Canvas background: `#RRGGBB` (case-insensitive); returns the uppercase form; other forms return `None`.
pub fn canvas_background(text: &str) -> Option<String> {
    (text.len() == 7 && text.starts_with('#') && text[1..].chars().all(|c| c.is_ascii_hexdigit())).then(|| text.to_ascii_uppercase())
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum DurationPolicy {
    Derived,
    Fixed { frames: i64 },
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TrackKind {
    Visual,
    Audio,
    Subtitle,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Track {
    pub id: Id,
    pub order: i64,
    pub kind: TrackKind,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    pub locked: bool,
    pub visible: bool,
    pub muted: bool,
    pub solo: Solo,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Solo {
    pub enabled: bool,
    pub group: SoloGroup,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SoloGroup {
    Audio,
    Visual,
}

/// Fields shared by all instances (§3.4).
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ItemBase {
    pub id: Id,
    pub track_id: Id,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    pub enabled: bool,
    pub locked: bool,
    pub paint_order: i64,
    /// An instance without this field (earlier versions did not write it) is read as the default `follow-cuts` (§3.16).
    #[serde(default)]
    pub follow_policy: FollowPolicy,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub lineage: Option<ItemLineage>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub link_group_id: Option<Id>,
    /// The role of the instance in the video (open vocabulary). For `broll`, `watermark`, `screentext`, `overlay` and `frame`, the pairing with the kind is checked on write.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub role: Option<String>,
    /// Description of the generation source; the engine does not interpret it and keeps it as is.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ai: Option<Value>,
    /// The end point follows the sequence end (§3.16); omitted when it is not.
    #[serde(default, skip_serializing_if = "place::is_false")]
    pub until_sequence_end: bool,
    /// Extensions under a namespace (§1.4): the engine does not interpret them and keeps them on write-back.
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub extensions: BTreeMap<String, Value>,
}

/// What an instance moves with (§3.16). Default `follow-cuts`: instances placed by time follow the cuts; `sequence-fixed` must be chosen explicitly.
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "kebab-case", rename_all_fields = "camelCase")]
// Semantic anchors on both ends stay in place, and reads, writes and matching are all direct; the number of instances is small, so they are not boxed to save memory.
#[allow(clippy::large_enum_variant)]
pub enum FollowPolicy {
    /// Fixed to sequence time.
    SequenceFixed,
    /// Moves with the cuts and shortens with them.
    #[default]
    FollowCuts,
    /// Moves and is trimmed with the specified clip.
    ItemLocal { item_id: Id },
    /// Start and end points are attached to words or sentences; at least one.
    SpeechAnchor {
        #[serde(default, skip_serializing_if = "Option::is_none")]
        start: Option<SemanticAnchor>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        end: Option<SemanticAnchor>,
    },
    /// Audio and picture grouped, linked by rules.
    ExplicitLinkGroup { group_id: Id },
}

/// Semantic anchor (§3.16).
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "kebab-case", rename_all_fields = "camelCase")]
pub enum SemanticAnchor {
    Word {
        speech_ref: VersionRef,
        word_id: Id,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        occurrence_id: Option<Id>,
        edge: AnchorEdge,
        /// An exact signed duration, added after mapping to sequence time.
        #[serde(default, skip_serializing_if = "Option::is_none")]
        offset: Option<MediaTime>,
    },
    Sentence {
        speech_ref: VersionRef,
        sentence_id: Id,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        occurrence_id: Option<Id>,
        edge: AnchorEdge,
    },
    Item {
        item_id: Id,
        local_offset: MediaTime,
    },
    Sequence {
        sequence_id: Id,
        frame: i64,
    },
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AnchorEdge {
    Start,
    End,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ItemLineage {
    pub origin_item_id: Id,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub parent_item_id: Option<Id>,
    pub via_transaction_id: Id,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VideoItem {
    #[serde(flatten)]
    pub base: ItemBase,
    pub span: FrameSpan,
    pub place: Place,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub animate: Option<Animation>,
    #[serde(flatten)]
    pub media: MediaFields,
    pub asset_ref: VersionRef,
    pub time_map: TimeMap,
    /// Cropping of the source picture, applied before `fit` (§3.5).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub crop: Option<Crop>,
    /// Routing of embedded audio. Until it is split into a separate audio instance, it plays along with the picture.
    pub embedded_audio: EmbeddedAudio,
}

/// The embedded audio of a video instance, and the composition instance's own sound (§3.9).
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmbeddedAudio {
    pub enabled: bool,
    /// Linear multiplier, [0, 4].
    pub volume: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub fade_in: Option<MediaTime>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub fade_out: Option<MediaTime>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub envelope: Vec<EnvelopePoint>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageItem {
    #[serde(flatten)]
    pub base: ItemBase,
    pub span: FrameSpan,
    pub place: Place,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub animate: Option<Animation>,
    #[serde(flatten)]
    pub media: MediaFields,
    pub asset_ref: VersionRef,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub crop: Option<Crop>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tile: Option<Tile>,
    /// The editing source of an image (`file` / `html`); rendering uses only `assetRef`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,
    /// The original fragment kept when `source` is `html`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub html: Option<String>,
}

/// Text instance: a piece of text or a timer readout, plus text style (§3.6). The style is a v2 text-style object, which the engine saves as an object.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TextItem {
    #[serde(flatten)]
    pub base: ItemBase,
    pub span: FrameSpan,
    pub place: Place,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub animate: Option<Animation>,
    /// Exactly one of this and `counter` is required; one must be present.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub counter: Option<CounterProps>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub style: Option<Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub style_preset_id: Option<String>,
    /// `top` / `center` / `bottom`: which part of the text block `place.y` pins; default `center`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub vertical_align: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tile: Option<Tile>,
}

/// Shape instance (§3.6).
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShapeItem {
    #[serde(flatten)]
    pub base: ItemBase,
    pub span: FrameSpan,
    pub place: Place,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub animate: Option<Animation>,
    pub shape: ShapeProps,
}

/// Sticker (§3.7): a template sticker draws a vector from the catalog; a material sticker draws the image, video or Lottie that `assetRef` points to.
/// `MediaFields` is used only for material stickers.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StickerItem {
    #[serde(flatten)]
    pub base: ItemBase,
    pub span: FrameSpan,
    pub place: Place,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub animate: Option<Animation>,
    #[serde(flatten)]
    pub media: MediaFields,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub asset_ref: Option<VersionRef>,
    pub sticker: StickerProps,
}

impl StickerItem {
    pub fn is_asset(&self) -> bool {
        self.sticker.source == timeline::schema::STICKER_SOURCE_ASSET
    }
}

/// Waveform (§3.7).
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VisualizerItem {
    #[serde(flatten)]
    pub base: ItemBase,
    pub span: FrameSpan,
    pub place: Place,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub animate: Option<Animation>,
    pub visualizer: VisualizerProps,
}

/// Progress bar (§3.7).
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProgressItem {
    #[serde(flatten)]
    pub base: ItemBase,
    pub span: FrameSpan,
    pub place: Place,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub animate: Option<Animation>,
    pub progress: ProgressProps,
}

/// Hand-drawn (§3.7).
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DrawItem {
    #[serde(flatten)]
    pub base: ItemBase,
    pub span: FrameSpan,
    pub place: Place,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub animate: Option<Animation>,
    pub draw: DrawProps,
}

/// Placeholder frame (§3.7): when there is no `assetRef`, draws a placeholder appearance; sometimes drawn as visual media.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaceholderItem {
    #[serde(flatten)]
    pub base: ItemBase,
    pub span: FrameSpan,
    pub place: Place,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub animate: Option<Animation>,
    #[serde(flatten)]
    pub media: MediaFields,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub asset_ref: Option<VersionRef>,
    pub placeholder: PlaceholderProps,
}

/// Confetti (§3.7).
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfettiItem {
    #[serde(flatten)]
    pub base: ItemBase,
    pub span: FrameSpan,
    pub place: Place,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub animate: Option<Animation>,
    pub confetti: ConfettiProps,
}

/// Whiteboard drawing (§3.7): an image material drawn in a derived order.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WhiteboardItem {
    #[serde(flatten)]
    pub base: ItemBase,
    pub span: FrameSpan,
    pub place: Place,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub animate: Option<Animation>,
    #[serde(flatten)]
    pub media: MediaFields,
    pub asset_ref: VersionRef,
    pub whiteboard: WhiteboardProps,
}

/// Composition instance: a picture drawn by the code package by local time (§3.7).
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompositionItem {
    #[serde(flatten)]
    pub base: ItemBase,
    pub span: FrameSpan,
    pub place: Place,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub animate: Option<Animation>,
    pub source: CompositionSource,
    pub parameter_values: Value,
    pub time_map: TimeMap,
    /// Pre-rendered stand-in: the video material rendered from this composition, sharing one time mapping with the composition.
    /// Preview and export use it in place of the composition when the composition's runtime is unavailable or cannot render in real time in time.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub prerender: Option<VersionRef>,
    /// Routing of the sound the composition itself emits; compositions with no sound do not write it.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub audio: Option<EmbeddedAudio>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mask: Option<Mask>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub fx: Option<Fx>,
}

/// The source of the composition: a version of a code package material (§4.3, code package spec).
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "lowercase", rename_all_fields = "camelCase")]
pub enum CompositionSource {
    Bundle { asset_ref: VersionRef },
}

/// Caption instance: shows a caption document over a span of sequence time (§3.8). It follows the document's current version, so it references the document ID.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CaptionItem {
    #[serde(flatten)]
    pub base: ItemBase,
    pub span: FrameSpan,
    pub document_id: Id,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub style_document_id: Option<Id>,
    /// The instances whose timeMap projects the caption's word times onto the sequence. Empty means the times in the document are already sequence times.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub scope_item_ids: Vec<Id>,
}

/// Audio instance: the exact start position is `fromFrame` + `subframeOffset`, and the length is `playDuration` (§2.10).
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioItem {
    #[serde(flatten)]
    pub base: ItemBase,
    pub asset_ref: VersionRef,
    pub from_frame: i64,
    pub subframe_offset: MediaTime,
    pub play_duration: MediaTime,
    pub time_map: TimeMap,
    pub mix: AudioMix,
}

/// Mix (§3.9). The gain stored on the instance is only the linear multiplier `volume`.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioMix {
    /// Linear multiplier, [0, 4], default 1.
    pub volume: f64,
    #[serde(default, skip_serializing_if = "place::is_false")]
    pub muted: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub fade_in: Option<MediaTime>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub fade_out: Option<MediaTime>,
    /// Volume envelope; when present, replaces `volume`.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub envelope: Vec<EnvelopePoint>,
}

/// One point of the volume envelope: the time is either an exact time local to the instance or a percentage of the instance length, one or the other.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct EnvelopePoint {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub at: Option<MediaTime>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub percent: Option<f64>,
    /// Linear multiplier, [0, 4].
    pub volume: f64,
    /// The easing of the segment leading into this point; default `linear`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ease: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "kebab-case")]
pub enum TimelineItem {
    Video(VideoItem),
    Image(ImageItem),
    Audio(AudioItem),
    Text(TextItem),
    Shape(ShapeItem),
    Sticker(StickerItem),
    Visualizer(VisualizerItem),
    Progress(ProgressItem),
    Draw(DrawItem),
    Placeholder(PlaceholderItem),
    Confetti(ConfettiItem),
    Whiteboard(WhiteboardItem),
    Composition(CompositionItem),
    Caption(CaptionItem),
}

/// Expands the same code for each picture instance (kinds that have `span` and `place`).
macro_rules! visual_items {
    ($value:expr, $item:ident => $body:expr, $other:pat => $fallback:expr) => {
        match $value {
            TimelineItem::Video($item) => $body,
            TimelineItem::Image($item) => $body,
            TimelineItem::Text($item) => $body,
            TimelineItem::Shape($item) => $body,
            TimelineItem::Sticker($item) => $body,
            TimelineItem::Visualizer($item) => $body,
            TimelineItem::Progress($item) => $body,
            TimelineItem::Draw($item) => $body,
            TimelineItem::Placeholder($item) => $body,
            TimelineItem::Confetti($item) => $body,
            TimelineItem::Whiteboard($item) => $body,
            TimelineItem::Composition($item) => $body,
            $other => $fallback,
        }
    };
}

impl TimelineItem {
    pub fn base(&self) -> &ItemBase {
        match self {
            TimelineItem::Audio(a) => &a.base,
            TimelineItem::Caption(c) => &c.base,
            other => visual_items!(other, item => &item.base, _ => unreachable!()),
        }
    }

    pub fn base_mut(&mut self) -> &mut ItemBase {
        match self {
            TimelineItem::Audio(a) => &mut a.base,
            TimelineItem::Caption(c) => &mut c.base,
            other => visual_items!(other, item => &mut item.base, _ => unreachable!()),
        }
    }

    /// The spelling of `type`, same as v2's `ElementKind::as_str` (plus `composition` and `caption`).
    pub fn kind_name(&self) -> &'static str {
        match self {
            TimelineItem::Video(_) => "video",
            TimelineItem::Image(_) => "image",
            TimelineItem::Audio(_) => "audio",
            TimelineItem::Text(_) => "text",
            TimelineItem::Shape(_) => "shape",
            TimelineItem::Sticker(_) => "sticker",
            TimelineItem::Visualizer(_) => "visualizer",
            TimelineItem::Progress(_) => "progress",
            TimelineItem::Draw(_) => "draw",
            TimelineItem::Placeholder(_) => "placeholder",
            TimelineItem::Confetti(_) => "confetti",
            TimelineItem::Whiteboard(_) => "whiteboard",
            TimelineItem::Composition(_) => "composition",
            TimelineItem::Caption(_) => "caption",
        }
    }

    /// The material version the instance references. Text, shapes, captions, template stickers and most generated elements do not have one.
    pub fn asset_ref(&self) -> Option<&VersionRef> {
        match self {
            TimelineItem::Video(v) => Some(&v.asset_ref),
            TimelineItem::Image(i) => Some(&i.asset_ref),
            TimelineItem::Audio(a) => Some(&a.asset_ref),
            TimelineItem::Sticker(s) => s.asset_ref.as_ref(),
            TimelineItem::Placeholder(p) => p.asset_ref.as_ref(),
            TimelineItem::Whiteboard(w) => Some(&w.asset_ref),
            TimelineItem::Composition(CompositionItem {
                source: CompositionSource::Bundle { asset_ref },
                ..
            }) => Some(asset_ref),
            _ => None,
        }
    }

    /// All material versions the instance references: the content itself, plus the composition's pre-rendered stand-in.
    pub fn asset_refs(&self) -> impl Iterator<Item = &VersionRef> {
        let prerender = match self {
            TimelineItem::Composition(c) => c.prerender.as_ref(),
            _ => None,
        };
        self.asset_ref().into_iter().chain(prerender)
    }

    /// A range on the frame grid. Audio instances are positioned at sample level, so they do not have one.
    pub fn span(&self) -> Option<FrameSpan> {
        match self {
            TimelineItem::Audio(_) => None,
            TimelineItem::Caption(c) => Some(c.span),
            other => visual_items!(other, item => Some(item.span), _ => None),
        }
    }

    pub fn span_mut(&mut self) -> Option<&mut FrameSpan> {
        match self {
            TimelineItem::Audio(_) => None,
            TimelineItem::Caption(c) => Some(&mut c.span),
            other => visual_items!(other, item => Some(&mut item.span), _ => None),
        }
    }

    /// Geometry of a picture instance. Audio and captions do not have it.
    pub fn place(&self) -> Option<&Place> {
        visual_items!(self, item => Some(&item.place), _ => None)
    }

    pub fn place_mut(&mut self) -> Option<&mut Place> {
        visual_items!(self, item => Some(&mut item.place), _ => None)
    }

    /// The three slots of element animation. Audio and captions do not have them.
    pub fn animate(&self) -> Option<&Animation> {
        visual_items!(self, item => item.animate.as_ref(), _ => None)
    }

    /// The `animate` field of a picture instance itself (writable). Audio and captions do not have it.
    pub fn animate_mut(&mut self) -> Option<&mut Option<Animation>> {
        visual_items!(self, item => Some(&mut item.animate), _ => None)
    }

    /// Common fields of visual media: video, image, placeholder frame, whiteboard and material stickers. Stickers are given regardless of source (the field itself applies only to material stickers, and is checked on write).
    pub fn media(&self) -> Option<&MediaFields> {
        match self {
            TimelineItem::Video(v) => Some(&v.media),
            TimelineItem::Image(i) => Some(&i.media),
            TimelineItem::Sticker(s) => Some(&s.media),
            TimelineItem::Placeholder(p) => Some(&p.media),
            TimelineItem::Whiteboard(w) => Some(&w.media),
            _ => None,
        }
    }

    pub fn media_mut(&mut self) -> Option<&mut MediaFields> {
        match self {
            TimelineItem::Video(v) => Some(&mut v.media),
            TimelineItem::Image(i) => Some(&mut i.media),
            TimelineItem::Sticker(s) => Some(&mut s.media),
            TimelineItem::Placeholder(p) => Some(&mut p.media),
            TimelineItem::Whiteboard(w) => Some(&mut w.media),
            _ => None,
        }
    }

    /// Whether it is visual media (§3.4): video, image, placeholder frame, whiteboard, and material stickers.
    pub fn is_visual_media(&self) -> bool {
        match self {
            TimelineItem::Video(_) | TimelineItem::Image(_) | TimelineItem::Placeholder(_) | TimelineItem::Whiteboard(_) => true,
            TimelineItem::Sticker(s) => s.is_asset(),
            _ => false,
        }
    }

    /// Effects (§3.9): visual media and composition instances have them.
    pub fn fx(&self) -> Option<&Fx> {
        match self {
            TimelineItem::Composition(c) => c.fx.as_ref(),
            other => other.media().and_then(|m| m.fx.as_ref()),
        }
    }

    /// The `fx` field itself (writable): visual media (including stickers) and composition instances have it.
    pub fn fx_mut(&mut self) -> Option<&mut Option<Fx>> {
        match self {
            TimelineItem::Composition(c) => Some(&mut c.fx),
            other => other.media_mut().map(|m| &mut m.fx),
        }
    }

    /// Mask (§3.9): visual media and composition instances have it.
    pub fn mask(&self) -> Option<&Mask> {
        match self {
            TimelineItem::Composition(c) => c.mask.as_ref(),
            other => other.media().and_then(|m| m.mask.as_ref()),
        }
    }

    /// The `mask` field itself (writable): visual media (including stickers) and composition instances have it.
    pub fn mask_mut(&mut self) -> Option<&mut Option<Mask>> {
        match self {
            TimelineItem::Composition(c) => Some(&mut c.mask),
            other => other.media_mut().map(|m| &mut m.mask),
        }
    }

    /// Tiling (§3.5): images and text have it.
    pub fn tile_mut(&mut self) -> Option<&mut Option<Tile>> {
        match self {
            TimelineItem::Image(i) => Some(&mut i.tile),
            TimelineItem::Text(t) => Some(&mut t.tile),
            _ => None,
        }
    }

    /// Mapping from instance time to source time. Instances with no source time (images, text, shapes, generated elements, captions) do not have it.
    pub fn time_map_mut(&mut self) -> Option<&mut TimeMap> {
        match self {
            TimelineItem::Video(v) => Some(&mut v.time_map),
            TimelineItem::Audio(a) => Some(&mut a.time_map),
            TimelineItem::Composition(c) => Some(&mut c.time_map),
            _ => None,
        }
    }

    /// Mapping from instance time to source time (read-only).
    pub fn time_map(&self) -> Option<&TimeMap> {
        match self {
            TimelineItem::Video(v) => Some(&v.time_map),
            TimelineItem::Audio(a) => Some(&a.time_map),
            TimelineItem::Composition(c) => Some(&c.time_map),
            _ => None,
        }
    }

    pub fn track_kind(&self) -> TrackKind {
        match self {
            TimelineItem::Audio(_) => TrackKind::Audio,
            TimelineItem::Caption(_) => TrackKind::Subtitle,
            _ => TrackKind::Visual,
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AssetKind {
    Video,
    Audio,
    Image,
    /// Lottie animation (JSON), referenced only by material stickers (§3.7).
    Lottie,
    Font,
    Caption,
    Document,
    /// Code package: a directory (§4.3).
    Bundle,
    Other,
}

/// Material record (§4.1): identity and its versions. Once a version is written it is not modified.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssetRecord {
    pub id: Id,
    pub kind: AssetKind,
    pub name: String,
    pub current_revision: Revision,
    pub revisions: BTreeMap<Revision, AssetRevision>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssetRevision {
    pub revision: Revision,
    pub content_hash: String,
    pub byte_length: u64,
    pub media_type: String,
    pub storage: AssetStorage,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub duration: Option<MediaTime>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub timebase: Option<Rate>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub video: Option<VideoInfo>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub audio: Option<AudioInfo>,
    /// Summary of the file listing when the material is a directory.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tree: Option<TreeInfo>,
    /// The code package manifest (code package spec §2). The engine saves it as an object.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub bundle: Option<Value>,
    pub provenance: Provenance,
}

/// Where the bytes are kept (§4.2). Location is not part of a version's identity: collecting and relinking do not produce a new version.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "mode", rename_all = "lowercase")]
pub enum AssetStorage {
    /// In the video directory's `blobs/`, content-addressed.
    Managed,
    /// Stays where it is; the video only records where to find it.
    Linked { locator: FileLocator, frozen: bool },
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileLocator {
    /// An absolute path, or a path relative to the video directory (when the file is in the project directory).
    pub path: String,
    /// The file's modification time at link time, used to cheaply detect that “the file may have changed”.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub modified_at: Option<String>,
    /// The name of the volume it is on, used to prompt “please connect a certain drive” when the file cannot be found.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub volume: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TreeInfo {
    pub file_count: u32,
    /// Collect only these files or subdirectories in the directory (relative paths). Omitted means the whole directory.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub include: Option<Vec<String>>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VideoInfo {
    pub display_width: u32,
    pub display_height: u32,
    pub rotation: u32,
    pub pixel_aspect_ratio: Rate,
    pub frame_rate: FrameRateInfo,
    pub pts_origin: MediaTime,
    pub has_alpha: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum FrameRateInfo {
    Cfr {
        rate: Rate,
    },
    Vfr {
        #[serde(default, skip_serializing_if = "Option::is_none")]
        nominal: Option<Rate>,
    },
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioInfo {
    pub sample_rate: u32,
    pub channels: u32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub layout: Option<String>,
}

/// Source (§4.5). Local paths appear only in `storage.locator`; here the original file name and provenance are kept.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Provenance {
    pub origin: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub imported_from: Option<ImportedFrom>,
    /// Known provenance: source URL, metadata from the original platform, generation records and so on.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source: Option<Value>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportedFrom {
    pub original_name: String,
    pub imported_at: String,
}

/// Document header (§4.4): identity and fingerprints of each version. Bodies are saved per version in storage and are not sent with the snapshot.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentRecord {
    pub id: Id,
    /// Document kind: `speech`, `translation`, `caption`, `caption-style`, ... (open vocabulary, §5).
    pub kind: String,
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub language: Option<String>,
    /// The material this document describes (for example, the recording a transcript corresponds to).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_asset_id: Option<Id>,
    /// Which document this one is derived from (for example, the transcript a translation corresponds to).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_document_id: Option<Id>,
    pub current_revision: Revision,
    pub revisions: BTreeMap<Revision, DocumentRevision>,
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub extensions: BTreeMap<String, Value>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentRevision {
    pub revision: Revision,
    pub content_hash: String,
    pub byte_length: u64,
    pub created_at: String,
    /// The transaction that wrote this version.
    pub created_by: Id,
    /// A summary of the body (word count, sentence count and so on), so that lists and agents need not read the body.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub summary: Option<Value>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Checkpoint {
    pub id: Id,
    pub name: String,
    pub video_revision: Revision,
    pub created_at: String,
    pub origin: CheckpointOrigin,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub note: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckpointOrigin {
    pub by: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub task_id: Option<Id>,
}

/// Protection (§3.10). In 0.4 it is only read and validated; operations that set protection appear with the task contract.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProtectionRecord {
    pub id: Id,
    pub level: String,
    pub target: Value,
    pub origin: Value,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub note: Option<String>,
}

/// The actor: constructed by the Runtime from the authenticated connection; clients cannot declare it (command and protocol spec §2.2).
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Actor {
    pub kind: ActorKind,
    pub id: Id,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ActorKind {
    User,
    Agent,
    System,
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Instances from earlier versions that did not write `followPolicy` are read as the default `follow-cuts`; those that did are kept as they are.
    #[test]
    fn a_missing_follow_policy_reads_as_follow_cuts() {
        let base = |extra: serde_json::Value| -> ItemBase {
            let mut value = serde_json::json!({ "id": "i", "trackId": "t", "enabled": true, "locked": false, "paintOrder": 1 });
            value.as_object_mut().unwrap().extend(extra.as_object().unwrap().clone());
            serde_json::from_value(value).unwrap()
        };
        assert_eq!(base(serde_json::json!({})).follow_policy, FollowPolicy::FollowCuts);
        assert_eq!(
            base(serde_json::json!({ "followPolicy": { "kind": "sequence-fixed" } })).follow_policy,
            FollowPolicy::SequenceFixed
        );
    }
}
