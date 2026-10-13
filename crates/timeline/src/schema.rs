use std::collections::{BTreeMap, HashSet};
use std::error::Error;
use std::fmt::{self, Display, Formatter};

use serde::{Deserialize, Deserializer, Serialize};
use serde_json::{Value, json};

use crate::template::TemplateDoc;

/// Version written on output. Reading is compatible with every value in [`TIMELINE_VERSIONS`]; output is always upgraded to this value (design `ccut-element-render-foundation-design.md` §5.3).
pub use crate::protocol::versions::TIMELINE_CURRENT as TIMELINE_VERSION;

/// Readable versions (ascending). `0.1` is the document from before the four element kinds shape / sticker / visualizer / progress were made official. They have no new fields, so upgrading is a pure version-string replacement and needs no migration script (ADR-E02 "zero migration burden").
pub use crate::protocol::versions::TIMELINE_SUPPORTED as TIMELINE_VERSIONS;

/// `element-props-mismatch`: `kind` and the four element props groups must correspond one-to-one.
///
/// This is a **timeline-side schema validation code**. It does not belong to the `LINT_RULES` system of `ccut-core` (that table only registers BCF / motion-side diagnostics), so it is pinned only in this crate's tests.
pub const ELEMENT_PROPS_MISMATCH: &str = "element-props-mismatch";
/// Diagnostic code (0.8) for a whiteboard hand-drawn element that references a source that is not `image` (or the main source).
pub const WHITEBOARD_SOURCE_KIND: &str = "whiteboard-source-kind";

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TimelineError {
    UnsupportedVersion(String),
    Invalid(String),
    MissingSource(String),
    EmptyClip(String),
    Unmapped(String),
    Ambiguous(String),
}

impl Display for TimelineError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> fmt::Result {
        match self {
            Self::UnsupportedVersion(version) => {
                write!(formatter, "不支持 timeline 版本 {version}")
            }
            Self::Invalid(message) => formatter.write_str(message),
            Self::MissingSource(id) => write!(formatter, "source 不存在：{id}"),
            Self::EmptyClip(id) => write!(formatter, "clip 扣除 cuts 后为空：{id}"),
            Self::Unmapped(id) => write!(formatter, "对象未映射到时间轴：{id}"),
            Self::Ambiguous(id) => write!(formatter, "对象在时间轴上有多个映射：{id}"),
        }
    }
}

impl Error for TimelineError {}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct TimelineDocument {
    #[serde(rename = "ccutTimeline", deserialize_with = "deserialize_version")]
    pub version: String,
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub sources: BTreeMap<String, Source>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub clips: Vec<Clip>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub tracks: Vec<Track>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub main: Option<Main>,
    /// Template instance applied over the picture (new in 0.4); `None` = no template applied.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub template: Option<TemplateDoc>,
}

impl Default for TimelineDocument {
    fn default() -> Self {
        Self {
            version: TIMELINE_VERSION.to_owned(),
            sources: BTreeMap::new(),
            clips: Vec::new(),
            tracks: Vec::new(),
            main: None,
            template: None,
        }
    }
}

/// Upgrades in place at read time: `0.1` / `0.2` / `0.3` → [`TIMELINE_VERSION`].
///
/// The upgrade happens at **deserialization** rather than at the moment of writing to disk, because write paths are scattered across the CLI / serve / client code, and deserialization is the only entry point every reader goes through. Unknown versions are kept as they are and left to [`TimelineDocument::validate`] to report [`TimelineError::UnsupportedVersion`]. Reporting them at the serde layer would demote the version error from a `TimelineError` to a serde text error.
fn deserialize_version<'de, D>(deserializer: D) -> Result<String, D::Error>
where
    D: Deserializer<'de>,
{
    let raw = String::deserialize(deserializer)?;
    Ok(if TIMELINE_VERSIONS.contains(&raw.as_str()) {
        TIMELINE_VERSION.to_owned()
    } else {
        raw
    })
}

impl TimelineDocument {
    /// Merges registered audio/video sources that are the same file as the project's main media (same `hash`) back into `main`.
    ///
    /// In a blank project, first `clip add narration.wav` (registered as `src-aN`), and then the same file is transcribed and set as the project media. The main-track clip still points at the duplicate source, while the words in `transcript.json` belong only to `main`. The projection cannot find a clip carrying them, so the subtitles disappear from the whole layer in the stage and the export. The duplicate source and `main` are the same media, so repointing the reference changes neither picture nor sound. When both sides have cuts it cannot be merged losslessly, so it is left as is. Returns the IDs of the sources that were merged away.
    pub fn fold_main_duplicates(&mut self, main_hash: Option<&str>) -> Vec<String> {
        let Some(main_hash) = main_hash.filter(|hash| !hash.is_empty()) else {
            return Vec::new();
        };
        let duplicates: Vec<String> = self
            .sources
            .iter()
            .filter(|(id, source)| {
                id.as_str() != "main"
                    && source.hash.as_deref() == Some(main_hash)
                    && matches!(
                        source.kind,
                        None | Some(SourceKind::Audio) | Some(SourceKind::Video)
                    )
            })
            .map(|(id, _)| id.clone())
            .collect();
        let mut folded = Vec::new();
        for id in duplicates {
            let main_has_cuts = self
                .sources
                .get("main")
                .is_some_and(|main| !main.cuts.is_empty());
            let cuts = self.sources[&id].cuts.clone();
            if main_has_cuts && !cuts.is_empty() {
                continue;
            }
            self.sources.remove(&id);
            if !cuts.is_empty() {
                self.sources.entry("main".to_owned()).or_default().cuts = cuts;
            }
            for clip in &mut self.clips {
                if clip.src_id == id {
                    clip.src_id = "main".to_owned();
                }
            }
            for element in self.tracks.iter_mut().flat_map(|track| &mut track.elements) {
                if element.src_id.as_deref() == Some(id.as_str()) {
                    element.src_id = Some("main".to_owned());
                }
            }
            folded.push(id);
        }
        folded
    }

    pub fn validate(&self) -> Result<(), TimelineError> {
        if self.version != TIMELINE_VERSION {
            return Err(TimelineError::UnsupportedVersion(self.version.clone()));
        }
        let mut ids = HashSet::new();
        for (source_id, source) in &self.sources {
            validate_id("source", source_id)?;
            unique_id(&mut ids, source_id)?;
            if source_id == "main" && source.has_identity_fields() {
                return Err(TimelineError::Invalid(
                    "main source 的媒体身份必须只存在于 project.json".to_owned(),
                ));
            }
            source.validate(source_id, &mut ids)?;
        }
        for clip in &self.clips {
            validate_id("clip", &clip.id)?;
            unique_id(&mut ids, &clip.id)?;
            if !clip.in_time.is_finite()
                || !clip.out.is_finite()
                || clip.in_time < 0.0
                || clip.out <= clip.in_time
                || !clip.rate.is_finite()
                || clip.rate <= 0.0
            {
                return Err(TimelineError::Invalid(format!(
                    "clip {} 的区间或 rate 非法",
                    clip.id
                )));
            }
            if clip.src_id != "main" {
                let Some(source) = self.sources.get(&clip.src_id) else {
                    return Err(TimelineError::MissingSource(clip.src_id.clone()));
                };
                if source.kind == Some(SourceKind::Lottie) {
                    return Err(TimelineError::Invalid(format!(
                        "clip {} 引用的 source {} 是 lottie，Lottie 只能作为贴纸元素的素材",
                        clip.id, clip.src_id
                    )));
                }
            }
        }
        for track in &self.tracks {
            validate_id("track", &track.id)?;
            unique_id(&mut ids, &track.id)?;
            for element in &track.elements {
                element.validate(&mut ids)?;
                let media_kind = matches!(
                    element.kind,
                    ElementKind::Image
                        | ElementKind::Video
                        | ElementKind::Audio
                        | ElementKind::Whiteboard
                );
                if media_kind && element.src_id.is_none() {
                    return Err(TimelineError::Invalid(format!(
                        "媒体元素 {} 缺少 srcId",
                        element.id
                    )));
                }
                if let Some(source_id) = &element.src_id
                    && source_id != "main"
                {
                    let Some(source) = self.sources.get(source_id) else {
                        return Err(TimelineError::MissingSource(source_id.clone()));
                    };
                    if source.kind == Some(SourceKind::Lottie) && !element.is_asset_sticker() {
                        return Err(TimelineError::Invalid(format!(
                            "元素 {} 引用的 source {} 是 lottie，只有 sticker.source=\"asset\" 的贴纸元素可以引用",
                            element.id, source_id
                        )));
                    }
                    if element.kind == ElementKind::Whiteboard
                        && source.kind.is_some_and(|kind| kind != SourceKind::Image)
                    {
                        return Err(TimelineError::Invalid(format!(
                            "元素 {} 引用的 source {} 不是 image，白板手绘只接受静态图片源（{WHITEBOARD_SOURCE_KIND}）",
                            element.id, source_id
                        )));
                    }
                } else if element.kind == ElementKind::Whiteboard {
                    return Err(TimelineError::Invalid(format!(
                        "元素 {} 是白板手绘，不能引用 main 源（{WHITEBOARD_SOURCE_KIND}）",
                        element.id
                    )));
                }
                if (track.kind == TrackKind::Audio) != (element.kind == ElementKind::Audio) {
                    return Err(TimelineError::Invalid(format!(
                        "track {} 的 kind 与 element {} 不匹配",
                        track.id, element.id
                    )));
                }
            }
        }
        for track in &self.tracks {
            for element in &track.elements {
                let Some(duck) = &element.duck else {
                    continue;
                };
                if duck.is_speech() {
                    continue;
                }
                if duck.under == track.id {
                    return Err(TimelineError::Invalid(format!(
                        "element {} 的 duck.under 不能是它自己所在的轨 {}",
                        element.id, track.id
                    )));
                }
                if !self.tracks.iter().any(|other| other.id == duck.under) {
                    return Err(TimelineError::Invalid(format!(
                        "element {} 的 duck.under 指向不存在的轨：{}",
                        element.id, duck.under
                    )));
                }
            }
        }
        if let Some(template) = &self.template {
            crate::template::validate(template)?;
        }
        if self.main.as_ref().is_some_and(|main| {
            main.detached
                && (!main.muted || main.place.as_ref().and_then(|place| place.opacity) != Some(0.0))
        }) {
            return Err(TimelineError::Invalid(
                "detached main 必须 muted=true 且 place.opacity=0；请编辑普通视频元素".into(),
            ));
        }
        if self
            .main
            .as_ref()
            .and_then(|main| main.source_duration)
            .is_some_and(|duration| !duration.is_finite() || duration <= 0.0)
        {
            return Err(TimelineError::Invalid(
                "main.sourceDuration 必须是正有限数".into(),
            ));
        }
        Ok(())
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Source {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub hash: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub kind: Option<SourceKind>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub duration: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub natural_w: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub natural_h: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub has_audio: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub poster: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub cuts: Vec<Cut>,
    /// Where the asset came from (new in 0.11): currently only `"ai"` (image-generation results; the asset card shows a ✦ badge, image-generation design doc §7.5). Default = an ordinary imported asset.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub origin: Option<String>,
    /// Provenance sidecar path (new in 0.11): uses the same relative / absolute rules as `path`, and points to a same-named `.json` (`{"kind":"image-gen","v":1,…}`, `ccut_image::ImageProvenance`). Default = no sidecar.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub provenance: Option<String>,
}

/// The closed set for `Source.origin` (0.11).
pub const SOURCE_ORIGINS: &[&str] = &["ai"];

impl Source {
    fn has_identity_fields(&self) -> bool {
        self.path.is_some()
            || self.hash.is_some()
            || self.kind.is_some()
            || self.duration.is_some()
            || self.natural_w.is_some()
            || self.natural_h.is_some()
            || self.has_audio.is_some()
            || self.poster.is_some()
    }

    fn validate(&self, source_id: &str, ids: &mut HashSet<String>) -> Result<(), TimelineError> {
        if let Some(origin) = &self.origin
            && !SOURCE_ORIGINS.contains(&origin.as_str())
        {
            return Err(TimelineError::Invalid(format!(
                "source {source_id} 的 origin 只能是 {}",
                SOURCE_ORIGINS.join(" / ")
            )));
        }
        if self
            .provenance
            .as_deref()
            .is_some_and(|path| path.trim().is_empty())
        {
            return Err(TimelineError::Invalid(format!(
                "source {source_id} 的 provenance 不能为空"
            )));
        }
        let mut previous_end = -f64::INFINITY;
        for cut in &self.cuts {
            validate_id("cut", &cut.id)?;
            unique_id(ids, &cut.id)?;
            if !cut.t0.is_finite() || !cut.t1.is_finite() || cut.t0 < 0.0 || cut.t1 <= cut.t0 {
                return Err(TimelineError::Invalid(format!(
                    "source {source_id} 的 cut {} 区间非法",
                    cut.id
                )));
            }
            if cut.t0 < previous_end {
                return Err(TimelineError::Invalid(format!(
                    "source {source_id} 的 cuts 必须排序且不重叠"
                )));
            }
            if let Some(duration) = self.duration
                && cut.t1 > duration
            {
                return Err(TimelineError::Invalid(format!(
                    "cut {} 超过 source {source_id} 时长",
                    cut.id
                )));
            }
            previous_end = cut.t1;
        }
        Ok(())
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum SourceKind {
    Video,
    Image,
    Audio,
    /// Bodymovin / Lottie JSON animation (since 0.7). It can only be referenced by an element with `kind:"sticker"` + `sticker.source:"asset"`. It cannot be a main-track clip, nor attach to `image` / `video` / `audio` elements. `duration` is taken from the end of the frame table, `naturalW/H` from `w`/`h`, and `hasAudio` is always false.
    Lottie,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct Cut {
    pub id: String,
    pub t0: f64,
    pub t1: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub r#ref: Option<String>,
}

fn default_main() -> String {
    "main".to_owned()
}

fn is_main(value: &str) -> bool {
    value == "main"
}

fn default_rate() -> f64 {
    1.0
}

fn is_one(value: &f64) -> bool {
    (*value - 1.0).abs() <= f64::EPSILON
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Clip {
    pub id: String,
    #[serde(default = "default_main", skip_serializing_if = "is_main")]
    pub src_id: String,
    #[serde(rename = "in")]
    pub in_time: f64,
    pub out: f64,
    #[serde(default = "default_rate", skip_serializing_if = "is_one")]
    pub rate: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Track {
    pub id: String,
    pub kind: TrackKind,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(default, skip_serializing_if = "is_false")]
    pub hidden: bool,
    #[serde(default, skip_serializing_if = "is_false")]
    pub locked: bool,
    #[serde(default, skip_serializing_if = "is_false")]
    pub muted: bool,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub elements: Vec<Element>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum TrackKind {
    Overlay,
    Audio,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(untagged)]
pub enum TimeValue {
    Seconds(f64),
    Anchor(String),
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Element {
    pub id: String,
    pub kind: ElementKind,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub role: Option<ElementRole>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub start: Option<TimeValue>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub end: Option<TimeValue>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub place: Option<Place>,
    /// Vertical anchor: which edge of the text block `place.y` pins (`"top" | "center" | "bottom"`).
    ///
    /// It sits on the element record alongside x/y/rot, **not in `style`**. The anchor is geometry, not appearance, and a style preset must not move an element just because it carries an anchor. Absent = center = the historical behaviour, so old documents need zero migration. (`style.verticalAlign` is a dead field that no rendering path has ever consumed; do not revive it.)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub vertical_align: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub src_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub src_start: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub rate: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub muted: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub volume: Option<f64>,
    /// Audio fade-in / fade-out duration in seconds. Consumed only by audio / video; defaults to 0.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub audio_fade_in: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub audio_fade_out: Option<f64>,
    /// For `kind == "audio"` imported from an animation project's narration: the ID of the claimed BCF audio clip (new in 0.10; voiceover design doc §7.2). The composite audio (playback and the studio export mix) excludes the claimed clip. When the element is deleted or undone, the clip automatically returns to the composite audio.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub bcf_clip: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mode: Option<VisualMode>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub fit: Option<Fit>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub bg: Option<Background>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub style: Option<Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub style_preset_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tile: Option<Tile>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mask: Option<Mask>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub fx: Option<Fx>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub animate: Option<Animation>,
    /// Independent video entry/exit transitions; never replaces `animate`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub transitions: Option<crate::video_transitions::VideoTransitions>,
    /// Keyframes (0.12): property → a series of `{t, v, ease?}`. The sampled value replaces the property's static value.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub keyframes: Option<crate::keyframes::Keyframes>,
    /// Ducking (0.12): audio / video only.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub duck: Option<crate::duck::Duck>,
    /// Source of an image watermark (`file` / `html`). Rendering still consumes only `srcId`; this field is used by the editor to decide whether an HTML fragment can be reopened.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,
    /// The original fragment kept when `source == html`; actual frame-by-frame rendering uses the registered PNG source.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub html: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ai: Option<Value>,
    /// Dynamically timed text for `kind == "text"`. Strictly mutually exclusive with `text`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub counter: Option<CounterProps>,
    /// Shape parameters for `kind == "shape"` (new in 0.2).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub shape: Option<ShapeProps>,
    /// Sticker source for `kind == "sticker"` (new in 0.2).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sticker: Option<StickerProps>,
    /// Audio visualization parameters for `kind == "visualizer"` (new in 0.2).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub visualizer: Option<VisualizerProps>,
    /// Progress bar parameters for `kind == "progress"` (new in 0.2).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub progress: Option<ProgressProps>,
    /// Freehand drawing strokes for `kind == "draw"` (new in 0.3).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub draw: Option<DrawProps>,
    /// Media placeholder frame for `kind == "placeholder"` (new in 0.3).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub placeholder: Option<PlaceholderProps>,
    /// Algorithmic confetti parameters for `kind == "confetti"` (new in 0.6; design doc §3).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub confetti: Option<ConfettiProps>,
    /// Whiteboard hand-drawing parameters for `kind == "whiteboard"` (new in 0.8; design doc §3).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub whiteboard: Option<WhiteboardProps>,
    #[serde(default, skip_serializing_if = "is_false")]
    pub hidden: bool,
}

impl Element {
    /// `kind:"sticker"` with `sticker.source:"asset"`: an asset sticker, where `srcId` points to an image / video / lottie source in `sources{}`. Since 0.7, lottie can only be referenced through this kind.
    pub fn is_asset_sticker(&self) -> bool {
        self.kind == ElementKind::Sticker
            && self
                .sticker
                .as_ref()
                .is_some_and(|props| props.source == STICKER_SOURCE_ASSET)
    }

    /// Field validation for a single element (applicability, one-to-one props correspondence, role and kind, animation preset table, value ranges), without looking at other elements in the document. The v3 VideoEngine calls it when writing an instance rather than keeping its own copy.
    pub fn validate_fields(&self) -> Result<(), TimelineError> {
        self.validate(&mut HashSet::new())
    }

    fn validate(&self, ids: &mut HashSet<String>) -> Result<(), TimelineError> {
        validate_id("element", &self.id)?;
        unique_id(ids, &self.id)?;
        for time in [&self.start, &self.end].into_iter().flatten() {
            match time {
                TimeValue::Seconds(value) if !value.is_finite() || *value < 0.0 => {
                    return Err(TimelineError::Invalid(format!(
                        "element {} 的时间非法",
                        self.id
                    )));
                }
                TimeValue::Anchor(anchor) if !valid_anchor(anchor) => {
                    return Err(TimelineError::Invalid(format!(
                        "element {} 的词锚点非法：{anchor}",
                        self.id
                    )));
                }
                _ => {}
            }
        }
        if self.kind == ElementKind::Audio && self.animate.is_some() {
            return Err(TimelineError::Invalid(format!(
                "audio element {} 不支持动画",
                self.id
            )));
        }
        if let (Some(TimeValue::Seconds(start)), Some(TimeValue::Seconds(end))) =
            (&self.start, &self.end)
            && end <= start
        {
            return Err(TimelineError::Invalid(format!(
                "element {} 的 end 必须晚于 start",
                self.id
            )));
        }
        if self.kind == ElementKind::Text && self.text.is_none() && self.counter.is_none() {
            return Err(TimelineError::Invalid(format!(
                "text element {} 必须带 text 或 counter",
                self.id
            )));
        }
        if self.kind == ElementKind::Text && self.text.is_some() && self.counter.is_some() {
            return Err(TimelineError::Invalid(format!(
                "text element {} 的 text 与 counter 必须互斥",
                self.id
            )));
        }
        let is_text = self.kind == ElementKind::Text;
        let is_asset_sticker = self.is_asset_sticker();
        // A whiteboard hand-drawing is an image that goes through `render_media_element` (0.8). mode / fit / bg /
        // mask / fx use the same consumption path as image (design doc §3: `mode: fullscreen` fills the canvas).
        let is_visual_media = matches!(
            self.kind,
            ElementKind::Image
                | ElementKind::Video
                | ElementKind::Placeholder
                | ElementKind::Whiteboard
        ) || is_asset_sticker;
        let is_media = matches!(
            self.kind,
            ElementKind::Image | ElementKind::Video | ElementKind::Audio
        );
        if is_media && self.src_id.is_none() {
            return Err(TimelineError::Invalid(format!(
                "{} element {} 缺少 srcId",
                self.kind.as_str(),
                self.id
            )));
        }
        self.validate_props()?;
        if let Some(transitions) = &self.transitions {
            if self.kind != ElementKind::Video {
                return Err(TimelineError::Invalid(
                    "transitions only applies to video elements".into(),
                ));
            }
            transitions.validate()?;
        }
        if is_text
            && (self.src_id.is_some()
                || self.src_start.is_some()
                || self.rate.is_some()
                || self.muted.is_some()
                || self.volume.is_some()
                || self.audio_fade_in.is_some()
                || self.audio_fade_out.is_some()
                || self.mode.is_some()
                || self.fit.is_some()
                || self.bg.is_some()
                || self.mask.is_some()
                || self.fx.is_some())
        {
            return Err(TimelineError::Invalid(format!(
                "text element {} 带有不适用的媒体字段",
                self.id
            )));
        }
        if !is_text
            && (self.text.is_some()
                || self.counter.is_some()
                || self.style.is_some()
                || self.style_preset_id.is_some())
        {
            return Err(TimelineError::Invalid(format!(
                "非 text element {} 带有文本字段",
                self.id
            )));
        }
        if self.kind != ElementKind::Image && (self.source.is_some() || self.html.is_some()) {
            return Err(TimelineError::Invalid(format!(
                "非 image element {} 带有 source/html",
                self.id
            )));
        }
        if self
            .source
            .as_deref()
            .is_some_and(|source| !matches!(source, "file" | "html"))
        {
            return Err(TimelineError::Invalid(format!(
                "image element {} 的 source 不是 file/html",
                self.id
            )));
        }
        if self.html.is_some() && self.source.as_deref() != Some("html") {
            return Err(TimelineError::Invalid(format!(
                "image element {} 的 html 必须配合 source=html",
                self.id
            )));
        }
        if !is_visual_media && (self.mode.is_some() || self.fit.is_some() || self.bg.is_some()) {
            return Err(TimelineError::Invalid(format!(
                "element {} 的 mode/fit/bg 只适用于 image/video",
                self.id
            )));
        }
        if !matches!(self.kind, ElementKind::Text | ElementKind::Image) && self.tile.is_some() {
            return Err(TimelineError::Invalid(format!(
                "element {} 的 tile 只适用于 text/image",
                self.id
            )));
        }
        if !is_visual_media && (self.mask.is_some() || self.fx.is_some()) {
            return Err(TimelineError::Invalid(format!(
                "element {} 的 mask/fx 只适用于 image/video",
                self.id
            )));
        }
        if self.kind == ElementKind::Audio && self.place.is_some() {
            return Err(TimelineError::Invalid(format!(
                "audio element {} 不支持 place",
                self.id
            )));
        }
        if !matches!(self.kind, ElementKind::Audio | ElementKind::Video)
            && (self.audio_fade_in.is_some() || self.audio_fade_out.is_some())
        {
            return Err(TimelineError::Invalid(format!(
                "element {} 的 audioFadeIn/audioFadeOut 只适用于 audio/video",
                self.id
            )));
        }
        if let Some(keyframes) = &self.keyframes {
            keyframes.validate(
                &self.id,
                crate::keyframes::KeyframeCaps::for_kind(&self.kind, is_visual_media),
            )?;
        }
        if let Some(duck) = &self.duck {
            if !matches!(self.kind, ElementKind::Audio | ElementKind::Video) {
                return Err(TimelineError::Invalid(format!(
                    "element {} 的 duck 只适用于 audio/video",
                    self.id
                )));
            }
            duck.validate(&self.id)?;
        }
        if let Some(clip) = &self.bcf_clip
            && (self.kind != ElementKind::Audio || clip.trim().is_empty())
        {
            return Err(TimelineError::Invalid(format!(
                "element {} 的 bcfClip 只适用于 audio，且不能为空",
                self.id
            )));
        }
        for (name, value) in [
            ("audioFadeIn", self.audio_fade_in),
            ("audioFadeOut", self.audio_fade_out),
        ] {
            if let Some(value) = value
                && (!value.is_finite()
                    || !(AUDIO_FADE_RANGE.0..=AUDIO_FADE_RANGE.1).contains(&value))
            {
                return Err(TimelineError::Invalid(format!(
                    "element {} 的 {name} 须在 0..=5 秒",
                    self.id
                )));
            }
        }
        if let Some(role) = self.role {
            let compatible = match role {
                ElementRole::Broll => matches!(self.kind, ElementKind::Image | ElementKind::Video),
                ElementRole::Watermark => matches!(
                    self.kind,
                    ElementKind::Text
                        | ElementKind::Image
                        | ElementKind::Video
                        | ElementKind::Sticker
                ),
                ElementRole::Screentext => self.kind == ElementKind::Text,
                ElementRole::Overlay | ElementRole::Frame => matches!(
                    self.kind,
                    ElementKind::Image | ElementKind::Video | ElementKind::Sticker
                ),
            };
            if !compatible {
                return Err(TimelineError::Invalid(format!(
                    "element {} 的 role 与 kind={} 不匹配",
                    self.id,
                    self.kind.as_str()
                )));
            }
        }
        if self.tile.as_ref().is_some_and(|tile| !tile.on) {
            return Err(TimelineError::Invalid(format!(
                "element {} 的 tile.on=false 应删除整个 tile 字段",
                self.id
            )));
        }
        if self.kind != ElementKind::Text
            && self.animate.as_ref().is_some_and(|animation| {
                [animation.enter.as_ref(), animation.exit.as_ref()]
                    .into_iter()
                    .flatten()
                    .any(|slot| matches!(slot.preset.as_str(), "typewriter" | "riseWords"))
            })
        {
            return Err(TimelineError::Invalid(format!(
                "element {} 的 typewriter/riseWords 只适用于 text",
                self.id
            )));
        }
        if self.counter.is_some()
            && self.animate.as_ref().is_some_and(|animation| {
                [animation.enter.as_ref(), animation.exit.as_ref()]
                    .into_iter()
                    .flatten()
                    .any(|slot| matches!(slot.preset.as_str(), "typewriter" | "riseWords"))
            })
        {
            return Err(TimelineError::Invalid(format!(
                "counter element {} 不支持 typewriter/riseWords",
                self.id
            )));
        }
        if let Some(place) = &self.place {
            place.validate(&self.id)?;
        }
        for (name, value) in [
            ("srcStart", self.src_start),
            ("rate", self.rate),
            ("volume", self.volume),
        ] {
            if let Some(value) = value
                && (!value.is_finite()
                    || (name != "volume" && value < 0.0)
                    || (name == "rate" && value == 0.0))
            {
                return Err(TimelineError::Invalid(format!(
                    "element {} 的 {name} 非法",
                    self.id
                )));
            }
        }
        if let Some(animation) = &self.animate {
            animation.validate(&self.id)?;
        }
        if let Some(fx) = &self.fx {
            fx.validate(&self.id)?;
        }
        Ok(())
    }

    /// `kind` corresponds one-to-one with the six props groups (§5.1 mutual-exclusion rule). Mismatched props raise an error directly and are not silently ignored: silently ignoring them would make the user's shape definition disappear.
    fn validate_props(&self) -> Result<(), TimelineError> {
        let expected = self.kind.props_field();
        for (field, present) in [
            ("shape", self.shape.is_some()),
            ("sticker", self.sticker.is_some()),
            ("visualizer", self.visualizer.is_some()),
            ("progress", self.progress.is_some()),
            ("draw", self.draw.is_some()),
            ("placeholder", self.placeholder.is_some()),
            ("confetti", self.confetti.is_some()),
            ("whiteboard", self.whiteboard.is_some()),
        ] {
            if present && expected != Some(field) {
                return Err(TimelineError::Invalid(format!(
                    "element {} 的 kind={} 不接受 {field} props（{ELEMENT_PROPS_MISMATCH}）",
                    self.id,
                    self.kind.as_str()
                )));
            }
            if !present && expected == Some(field) {
                return Err(TimelineError::Invalid(format!(
                    "element {} 的 kind={} 缺少 {field} props（{ELEMENT_PROPS_MISMATCH}）",
                    self.id,
                    self.kind.as_str()
                )));
            }
        }
        if let Some(shape) = &self.shape {
            shape.validate(&self.id)?;
        }
        if let Some(sticker) = &self.sticker {
            sticker.validate(&self.id)?;
        }
        if let Some(visualizer) = &self.visualizer {
            visualizer.validate(&self.id)?;
        }
        if let Some(progress) = &self.progress {
            progress.validate(&self.id)?;
        }
        if let Some(draw) = &self.draw {
            draw.validate(&self.id)?;
        }
        if let Some(placeholder) = &self.placeholder {
            placeholder.validate(&self.id)?;
        }
        if let Some(confetti) = &self.confetti {
            confetti.validate(&self.id)?;
        }
        if let Some(whiteboard) = &self.whiteboard {
            whiteboard.validate(&self.id)?;
        }
        if let Some(counter) = &self.counter {
            counter.validate(&self.id)?;
        }
        Ok(())
    }
}

/// Element kinds. **Closed enum + version gate**: unknown kinds raise an error at parse time, and no open enum is used (ADR-E02). Silently rendering an unknown kind as empty would make "我加的形状不见了" ("the shape I added is gone") the norm.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ElementKind {
    // Existing in 0.1
    Text,
    Image,
    Video,
    Audio,
    // New in 0.2 (ADR-E02)
    Shape,
    Sticker,
    /// Audio spectrum visualization. **A top-level kind, not a sticker subtype**: its data source and property panel are both unrelated to stickers (ADR-E02).
    Visualizer,
    Progress,
    // New in 0.3
    Draw,
    Placeholder,
    /// Algorithmic confetti particles (new in 0.6). **A top-level kind, not a sticker subtype**: no `srcId`. The whole frame is computed in closed form from `(props, t)` by the `confetti-v1` motion kernel (design doc ADR-CF01).
    Confetti,
    /// Whiteboard hand-drawing (new in 0.8). **A top-level kind**, using the same host-rasterization route as image: it must have a `srcId` and the source must be an `image`. The kernel derives the pixels at render time from the source image to build the reveal field, then evaluates it frame by frame (`ccut-whiteboard-animation-design.md` ADR-WB01 / WB02).
    Whiteboard,
}

impl ElementKind {
    /// serde names (the diagnostics and the JSON Schema share the same table).
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Text => "text",
            Self::Image => "image",
            Self::Video => "video",
            Self::Audio => "audio",
            Self::Shape => "shape",
            Self::Sticker => "sticker",
            Self::Visualizer => "visualizer",
            Self::Progress => "progress",
            Self::Draw => "draw",
            Self::Placeholder => "placeholder",
            Self::Confetti => "confetti",
            Self::Whiteboard => "whiteboard",
        }
    }

    /// Elements with a props sub-object: kind corresponds one-to-one with the props of the same name.
    pub const fn props_field(self) -> Option<&'static str> {
        match self {
            Self::Shape => Some("shape"),
            Self::Sticker => Some("sticker"),
            Self::Visualizer => Some("visualizer"),
            Self::Progress => Some("progress"),
            Self::Draw => Some("draw"),
            Self::Placeholder => Some("placeholder"),
            Self::Confetti => Some("confetti"),
            Self::Whiteboard => Some("whiteboard"),
            _ => None,
        }
    }
}

pub const ELEMENT_KINDS: &[&str] = &[
    "text",
    "image",
    "video",
    "audio",
    "shape",
    "sticker",
    "visualizer",
    "progress",
    "draw",
    "placeholder",
    // New in 0.6
    "confetti",
    // New in 0.8
    "whiteboard",
];

/// Range (in seconds) for `audioFadeIn` / `audioFadeOut`.
pub const AUDIO_FADE_RANGE: (f64, f64) = (0.0, 5.0);
/// Closed set of values for `verticalAlign`; absent = `center`.
pub const VERTICAL_ALIGNS: &[&str] = &["top", "center", "bottom"];
/// Default for `ShapeProps.strokeWidth` (`ElementModels.swift:205-215`).
pub const SHAPE_STROKE_WIDTH_DEFAULT: f64 = 2.0;
/// The first batch of shape names. P7 expanded them in stages to 23 basic shapes. The source of truth is the `Domain::TimelineShape` catalog in the preset registry, and this is only a mirror for the schema and diagnostics.
pub const SHAPE_NAMES: &[&str] = &["rect", "ellipse", "line", "arrow"];
/// Closed set of values for `ShapeProps.head`.
pub const SHAPE_HEADS: &[&str] = &["arrow", "none"];
/// The two values of `StickerProps.source`. The **built-in template library** (`core/presets/builtin/
/// sticker/`, vector output directly) and **assets in timeline sources** (PNG / JPEG / SVG /
/// looping WebM with alpha, decoded by the host) take two completely different rendering paths. Anywhere that checks the source type must therefore reference these two constants rather than write literals.
pub const STICKER_SOURCE_TEMPLATE: &str = "template";
pub const STICKER_SOURCE_ASSET: &str = "asset";
/// Closed set of values for `StickerProps.source`.
pub const STICKER_SOURCES: &[&str] = &[STICKER_SOURCE_TEMPLATE, STICKER_SOURCE_ASSET];
/// The three values of `StickerProps.loop`. Since P7b they are actually consumed: when the asset is a video, they decide how the media time is taken (loop / play once and stop on the last frame / freeze on the first frame).
pub const STICKER_LOOP_LOOP: &str = "loop";
pub const STICKER_LOOP_ONCE: &str = "once";
pub const STICKER_LOOP_HOLD: &str = "hold";
/// Closed set of values and the default for `StickerProps.loop`.
pub const STICKER_LOOPS: &[&str] = &[STICKER_LOOP_LOOP, STICKER_LOOP_ONCE, STICKER_LOOP_HOLD];
pub const STICKER_LOOP_DEFAULT: &str = STICKER_LOOP_LOOP;
/// Defaults for `VisualizerProps`. This takes the **new-element defaults** group (§5.2).
pub const VISUALIZER_FFT_SIZES: &[u32] = &[256, 512, 1024, 2048];
pub const VISUALIZER_FFT_SIZE_DEFAULT: u32 = 1024;
/// The **table-wide fallback** for the dB window, used only when this style cannot be found in the registry. The real default is taken per style, see [`visualizer_db_window`]. Of the 10 styles, 2 (`oscilloscope` / `ring_wave`) use the −120 / −10 window.
pub const VISUALIZER_MIN_DB_DEFAULT: f64 = -80.0;
pub const VISUALIZER_MAX_DB_DEFAULT: f64 = 40.0;
pub const VISUALIZER_SMOOTHING_DEFAULT: f64 = 0.8;
/// A CucCut-native field, originating from Mac `WaveformConfig`. Multiplied after remapping and before drawing.
pub const VISUALIZER_GAIN_DEFAULT: f64 = 1.0;
pub const VISUALIZER_AUDIO_DEFAULT: &str = "project";

/// A style's own dB window (`defaultMinDb` / `defaultMaxDb` in `core/presets/builtin/visualizer/*.json`), i.e. the default used when an element does not write `minDb` / `maxDb`.
///
/// **Taken per style rather than one value for the whole table**, following the same convention as the `mainColor` fallback (`visualizer_defaults` in `ccut-editor-core`). The two `oscilloscope-v1` styles (`oscilloscope` / `ring_wave`), which read the time-domain row, use the narrow, hot −120 / −10 window. The time-domain row is carried over byte for byte, so the dB window is just a label in the registry for it, but keeping this pair lets the property panel's Min / Max dB readouts match the recipe declaration. The other 8 styles read the frequency-domain row and use −80 / 40. Using the wrong window to draw a spectrum-type style would make the same dB value map to a normalized amplitude that is off by roughly a factor of two.
///
/// If the style is not found in the registry, it falls back to [`VISUALIZER_MIN_DB_DEFAULT`] / [`VISUALIZER_MAX_DB_DEFAULT`]. Such an element would not pass `style` validation anyway.
pub fn visualizer_db_window(style: &str) -> (f64, f64) {
    ::motion::preset_registry::timeline_visualizer(style)
        .and_then(|recipe| recipe.visualizer())
        .map(|body| (body.default_min_db, body.default_max_db))
        .unwrap_or((VISUALIZER_MIN_DB_DEFAULT, VISUALIZER_MAX_DB_DEFAULT))
}

/// Shape parameters for `kind == "shape"` (design §5.2).
///
/// The source of truth for `shape` names is the catalog-style recipe in the preset registry (ADR-E05). The schema layer only guarantees that it is a non-empty string. "Referencing a shape that is not in the registry" is a `preset-unknown` at lint / resolve time, not a parse error here (§5.3: two moments, two codes).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ShapeProps {
    pub shape: String,
    /// `"#RRGGBB"` or `"#RRGGBBAA"`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub fill: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub stroke: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub stroke_width: Option<f64>,
    /// Four corners set independently (`[0,0,0,0]` order). The single-value `radius` from Mac's history is converted to `[r,r,r,r]` at read time. It is a separate thing from `Place.radius` (element-level rounded-corner clipping), and the two are not merged.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub corner_radius: Option<[f64; 4]>,
    /// Frame height in %; `None` = square (see `geometry::element_height`).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub h: Option<f64>,
    /// Endpoints of `line` / `arrow`, in % of the element box.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub x1: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub y1: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub x2: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub y2: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub head: Option<String>,
}

impl ShapeProps {
    pub fn new(shape: impl Into<String>) -> Self {
        Self {
            shape: shape.into(),
            fill: None,
            stroke: None,
            stroke_width: None,
            corner_radius: None,
            h: None,
            x1: None,
            y1: None,
            x2: None,
            y2: None,
            head: None,
        }
    }

    pub fn stroke_width(&self) -> f64 {
        self.stroke_width.unwrap_or(SHAPE_STROKE_WIDTH_DEFAULT)
    }

    pub fn corner_radius(&self) -> [f64; 4] {
        self.corner_radius.unwrap_or([0.0; 4])
    }

    /// Endpoints of `line` / `arrow`, 0..100 % of the element box. The default is the box's horizontal midline.
    pub fn endpoints(&self) -> [f64; 4] {
        [
            self.x1.unwrap_or(0.0),
            self.y1.unwrap_or(50.0),
            self.x2.unwrap_or(100.0),
            self.y2.unwrap_or(50.0),
        ]
    }

    fn validate(&self, element_id: &str) -> Result<(), TimelineError> {
        if self.shape.trim().is_empty() {
            return Err(TimelineError::Invalid(format!(
                "element {element_id} 的 shape.shape 为空"
            )));
        }
        for (name, color) in [("fill", &self.fill), ("stroke", &self.stroke)] {
            if let Some(color) = color {
                validate_color(element_id, &format!("shape.{name}"), color)?;
            }
        }
        for (name, value) in [
            ("strokeWidth", self.stroke_width),
            ("h", self.h),
            ("x1", self.x1),
            ("y1", self.y1),
            ("x2", self.x2),
            ("y2", self.y2),
        ] {
            finite(element_id, &format!("shape.{name}"), value)?;
        }
        if self.stroke_width.is_some_and(|width| width < 0.0) {
            return Err(TimelineError::Invalid(format!(
                "element {element_id} 的 shape.strokeWidth 必须非负"
            )));
        }
        if let Some(radius) = self.corner_radius
            && radius
                .iter()
                .any(|value| !value.is_finite() || *value < 0.0)
        {
            return Err(TimelineError::Invalid(format!(
                "element {element_id} 的 shape.cornerRadius 必须是四个非负有限数"
            )));
        }
        if let Some(head) = &self.head
            && !SHAPE_HEADS.contains(&head.as_str())
        {
            return Err(TimelineError::Invalid(format!(
                "element {element_id} 的 shape.head 非法：{head}"
            )));
        }
        Ok(())
    }
}

/// Sticker source for `kind == "sticker"` (design §5.2). **There is no waveform subtype.** Waveforms have already moved out into the standalone [`ElementKind::Visualizer`] (§5.4 deprecation list).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct StickerProps {
    /// `"template"` | `"asset"`。
    pub source: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub template_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
    /// `"loop"` | `"once"` | `"hold"`, default `"loop"`.
    #[serde(default, rename = "loop", skip_serializing_if = "Option::is_none")]
    pub r#loop: Option<String>,
    /// Exact colour-replacement table for SVG assets: original `#RRGGBB[AA]` → target colour.
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub fill_overrides: BTreeMap<String, String>,
}

impl StickerProps {
    pub fn new(source: impl Into<String>) -> Self {
        Self {
            source: source.into(),
            template_id: None,
            path: None,
            r#loop: None,
            fill_overrides: BTreeMap::new(),
        }
    }

    pub fn loop_mode(&self) -> &str {
        self.r#loop.as_deref().unwrap_or(STICKER_LOOP_DEFAULT)
    }

    fn validate(&self, element_id: &str) -> Result<(), TimelineError> {
        if !STICKER_SOURCES.contains(&self.source.as_str()) {
            return Err(TimelineError::Invalid(format!(
                "element {element_id} 的 sticker.source 非法：{}",
                self.source
            )));
        }
        if let Some(mode) = &self.r#loop
            && !STICKER_LOOPS.contains(&mode.as_str())
        {
            return Err(TimelineError::Invalid(format!(
                "element {element_id} 的 sticker.loop 非法：{mode}"
            )));
        }
        for (source, target) in &self.fill_overrides {
            validate_color(element_id, "sticker.fillOverrides key", source)?;
            validate_color(element_id, "sticker.fillOverrides value", target)?;
        }
        Ok(())
    }
}

/// Audio spectrum parameters for `kind == "visualizer"` (design §5.2).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct VisualizerProps {
    /// Style ID (validated against the registry; 15 styles).
    pub style: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub main_color: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub secondary_color: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub fft_size: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub min_db: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub max_db: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub smoothing: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub gain: Option<f64>,
    /// Audio source; default `"project"` (the output track of the whole cut).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub audio: Option<String>,
    /// Optional speaker ID. Whether the current frame is visible is decided by the speaker time spans injected by the host.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub speaker: Option<String>,
    /// Whether the silent form is still shown when the speaker is not matched; default true.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub always_show: Option<bool>,
}

impl VisualizerProps {
    pub fn new(style: impl Into<String>) -> Self {
        Self {
            style: style.into(),
            main_color: None,
            secondary_color: None,
            fft_size: None,
            min_db: None,
            max_db: None,
            smoothing: None,
            gain: None,
            audio: None,
            speaker: None,
            always_show: None,
        }
    }

    pub fn fft_size(&self) -> u32 {
        self.fft_size.unwrap_or(VISUALIZER_FFT_SIZE_DEFAULT)
    }

    /// The lower edge of the dB window that **actually takes effect** for the element. If written, the written value is used; if not, the default for this style is used ([`visualizer_db_window`]). Both rendering and the property panel read this one.
    pub fn min_db(&self) -> f64 {
        self.min_db
            .unwrap_or_else(|| visualizer_db_window(&self.style).0)
    }

    /// Upper edge, same as [`Self::min_db`].
    pub fn max_db(&self) -> f64 {
        self.max_db
            .unwrap_or_else(|| visualizer_db_window(&self.style).1)
    }

    pub fn smoothing(&self) -> f64 {
        self.smoothing.unwrap_or(VISUALIZER_SMOOTHING_DEFAULT)
    }

    pub fn gain(&self) -> f64 {
        self.gain.unwrap_or(VISUALIZER_GAIN_DEFAULT)
    }

    pub fn audio(&self) -> &str {
        self.audio.as_deref().unwrap_or(VISUALIZER_AUDIO_DEFAULT)
    }

    pub fn always_show(&self) -> bool {
        self.always_show.unwrap_or(true)
    }

    fn validate(&self, element_id: &str) -> Result<(), TimelineError> {
        if self.style.trim().is_empty() {
            return Err(TimelineError::Invalid(format!(
                "element {element_id} 的 visualizer.style 为空"
            )));
        }
        for (name, color) in [
            ("mainColor", &self.main_color),
            ("secondaryColor", &self.secondary_color),
        ] {
            if let Some(color) = color {
                validate_color(element_id, &format!("visualizer.{name}"), color)?;
            }
        }
        if let Some(size) = self.fft_size
            && !VISUALIZER_FFT_SIZES.contains(&size)
        {
            return Err(TimelineError::Invalid(format!(
                "element {element_id} 的 visualizer.fftSize 非法：{size}"
            )));
        }
        for (name, value) in [
            ("minDb", self.min_db),
            ("maxDb", self.max_db),
            ("smoothing", self.smoothing),
            ("gain", self.gain),
        ] {
            finite(element_id, &format!("visualizer.{name}"), value)?;
        }
        // Validation deliberately uses the **table-wide fallback** rather than the per-style defaults of `min_db()` / `max_db()`. The check applies only to the pair actually written in the document, so switching styles must not turn a previously valid timeline into an invalid one (the curve family's window top is −10, and a `minDb` between −10..0 would suddenly invert under per-style defaults). If an inverted window does occur, `remap_decibels_value` in `ccut-waveform` has a degenerate branch and will not produce NaN.
        if self.min_db.unwrap_or(VISUALIZER_MIN_DB_DEFAULT)
            >= self.max_db.unwrap_or(VISUALIZER_MAX_DB_DEFAULT)
        {
            return Err(TimelineError::Invalid(format!(
                "element {element_id} 的 visualizer.minDb 必须小于 maxDb"
            )));
        }
        if self.smoothing.is_some_and(|tau| !(0.0..1.0).contains(&tau)) {
            return Err(TimelineError::Invalid(format!(
                "element {element_id} 的 visualizer.smoothing 须在 [0, 1)"
            )));
        }
        if self.gain.is_some_and(|gain| gain < 0.0) {
            return Err(TimelineError::Invalid(format!(
                "element {element_id} 的 visualizer.gain 必须非负"
            )));
        }
        if self
            .speaker
            .as_deref()
            .is_some_and(|speaker| speaker.trim().is_empty())
        {
            return Err(TimelineError::Invalid(format!(
                "element {element_id} 的 visualizer.speaker 为空"
            )));
        }
        Ok(())
    }
}

/// Progress bar parameters for `kind == "progress"` (design §5.2).
///
/// The data source is the playhead rather than audio (`progress = clamp((t-start)/(end-start), 0, 1)`), so the parameter set is just the style and two colours (ADR-E04).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ProgressProps {
    pub style: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub main_color: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub secondary_color: Option<String>,
    /// Normalized start and end values. `start > end` is allowed, to express reverse progress.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub start_progress: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub end_progress: Option<f64>,
}

impl ProgressProps {
    pub fn new(style: impl Into<String>) -> Self {
        Self {
            style: style.into(),
            main_color: None,
            secondary_color: None,
            start_progress: None,
            end_progress: None,
        }
    }

    fn validate(&self, element_id: &str) -> Result<(), TimelineError> {
        if self.style.trim().is_empty() {
            return Err(TimelineError::Invalid(format!(
                "element {element_id} 的 progress.style 为空"
            )));
        }
        for (name, color) in [
            ("mainColor", &self.main_color),
            ("secondaryColor", &self.secondary_color),
        ] {
            if let Some(color) = color {
                validate_color(element_id, &format!("progress.{name}"), color)?;
            }
        }
        for (name, value) in [
            ("startProgress", self.start_progress),
            ("endProgress", self.end_progress),
        ] {
            if let Some(value) = value
                && (!value.is_finite() || !(0.0..=1.0).contains(&value))
            {
                return Err(TimelineError::Invalid(format!(
                    "element {element_id} 的 progress.{name} 须在 0..=1"
                )));
            }
        }
        Ok(())
    }
}

impl ProgressProps {
    pub fn remap(&self, progress: f64) -> f64 {
        let start = self.start_progress.unwrap_or(0.0);
        let end = self.end_progress.unwrap_or(1.0);
        (start + (end - start) * progress.clamp(0.0, 1.0)).clamp(0.0, 1.0)
    }
}

/// Closed set of values for `confetti.shapes` (design doc §3.3, 12 unit shapes).
pub const CONFETTI_SHAPES: &[&str] = &[
    "rect", "strip", "circle", "ellipse", "triangle", "diamond", "star", "starlet", "sparkle",
    "heart", "petal", "ribbon",
];
/// Upper limit for `confetti.colors` (ADR-CF04: the panel caps it at 8 colour swatches).
pub const CONFETTI_MAX_COLORS: usize = 8;
/// Upper limit for `confetti.emit.rate` (particles per second).
pub const CONFETTI_MAX_RATE: f64 = 400.0;
/// Upper limit for `confetti.emit.count` (number per burst).
pub const CONFETTI_MAX_COUNT: f64 = 500.0;
/// Upper limit for `confetti.emit.interval` (seconds).
pub const CONFETTI_MAX_INTERVAL: f64 = 60.0;
/// Range for the multiplier fields `size` / `speed`.
pub const CONFETTI_SCALE_RANGE: (f64, f64) = (0.25, 4.0);
/// Range for the `gravity` multiplier (negative values float upward).
pub const CONFETTI_GRAVITY_RANGE: (f64, f64) = (-2.0, 4.0);
/// Range for the `drift` / `spin` multipliers (0 = no sway / no spin).
pub const CONFETTI_RATE_SCALE_RANGE: (f64, f64) = (0.0, 3.0);
/// Range for `wind` (px/s², referenced to a 540 short side).
pub const CONFETTI_WIND_RANGE: (f64, f64) = (-600.0, 600.0);
/// Range for `origin.x` / `origin.y` (in % of the box; may fall outside the frame).
pub const CONFETTI_ORIGIN_RANGE: (f64, f64) = (-20.0, 120.0);
/// Range for `opacity`.
pub const CONFETTI_OPACITY_RANGE: (f64, f64) = (0.0, 1.0);
/// Range for `angle` (degrees).
pub const CONFETTI_ANGLE_RANGE: (f64, f64) = (-180.0, 180.0);
/// Range for `spread` (degrees).
pub const CONFETTI_SPREAD_RANGE: (f64, f64) = (0.0, 360.0);
/// Range for `emit.rate` (particles per second).
pub const CONFETTI_RATE_RANGE: (f64, f64) = (1.0, CONFETTI_MAX_RATE);
/// Range for `emit.count` (number per burst).
pub const CONFETTI_COUNT_RANGE: (f64, f64) = (1.0, CONFETTI_MAX_COUNT);
/// Range for `emit.interval` (seconds; 0 = fire once).
pub const CONFETTI_INTERVAL_RANGE: (f64, f64) = (0.0, CONFETTI_MAX_INTERVAL);

/// `confetti.emit.mode`: continuous emission or batched bursts.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ConfettiEmitMode {
    Continuous,
    Burst,
}

impl ConfettiEmitMode {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Continuous => "continuous",
            Self::Burst => "burst",
        }
    }
}

/// `confetti.emit`: the emission method. Fields that do not match `mode` may still be present (so the other side's values are kept when switching modes). Rendering reads only the ones the current mode uses.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ConfettiEmit {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mode: Option<ConfettiEmitMode>,
    /// `continuous`: particles per second, `1..=400`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub rate: Option<f64>,
    /// `burst`: number per burst, `1..=500`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub count: Option<f64>,
    /// `burst`: repeat interval in seconds, `0..=60`; `0` = fire once.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub interval: Option<f64>,
    /// Emission stops `lifeMax` seconds before the element ends, so the picture clears naturally.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub settle: Option<bool>,
}

/// `confetti.origin`: **replaces** the recipe's emitter group with this single point (in % of the box).
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ConfettiOrigin {
    pub x: f64,
    pub y: f64,
}

/// Algorithmic confetti parameters for `kind == "confetti"` (design doc §3.2).
///
/// Only `style` is required. Everything else overrides the recipe defaults, and when absent the recipe value is used. The multiplier fields (`size/speed/gravity/drift/spin`) are applied on top of the recipe's range base. `wind/rate/count/interval/angle/spread` have natural absolute units, so they use absolute values (ADR-CF03).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ConfettiProps {
    pub style: String,
    /// Random seed; defaults to 0 when absent. A random value is written at creation (ADR-CF06).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub seed: Option<u64>,
    /// Particle palette `#RRGGBB(AA)` × 1–8.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub colors: Option<Vec<String>>,
    /// Shape mix, a subset of [`CONFETTI_SHAPES`] × 1–12.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub shapes: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub size: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub speed: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub gravity: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub drift: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub spin: Option<f64>,
    /// Constant horizontal acceleration, referenced in px/s² (scaled by `pixelScale`).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub wind: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub opacity: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub emit: Option<ConfettiEmit>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub origin: Option<ConfettiOrigin>,
    /// Emission direction in degrees: 0 is right, −90 is up, 90 is down.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub angle: Option<f64>,
    /// Emission fan angle in degrees, `0..=360`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub spread: Option<f64>,
}

impl ConfettiProps {
    pub fn new(style: impl Into<String>) -> Self {
        Self {
            style: style.into(),
            seed: None,
            colors: None,
            shapes: None,
            size: None,
            speed: None,
            gravity: None,
            drift: None,
            spin: None,
            wind: None,
            opacity: None,
            emit: None,
            origin: None,
            angle: None,
            spread: None,
        }
    }

    fn validate(&self, element_id: &str) -> Result<(), TimelineError> {
        if self.style.trim().is_empty() {
            return Err(TimelineError::Invalid(format!(
                "element {element_id} 的 confetti.style 为空"
            )));
        }
        if let Some(colors) = &self.colors {
            if colors.is_empty() || colors.len() > CONFETTI_MAX_COLORS {
                return Err(TimelineError::Invalid(format!(
                    "element {element_id} 的 confetti.colors 须有 1..={CONFETTI_MAX_COLORS} 项"
                )));
            }
            for color in colors {
                validate_color(element_id, "confetti.colors[]", color)?;
            }
        }
        if let Some(shapes) = &self.shapes {
            if shapes.is_empty() || shapes.len() > CONFETTI_SHAPES.len() {
                return Err(TimelineError::Invalid(format!(
                    "element {element_id} 的 confetti.shapes 须有 1..={} 项",
                    CONFETTI_SHAPES.len()
                )));
            }
            if let Some(unknown) = shapes
                .iter()
                .find(|shape| !CONFETTI_SHAPES.contains(&shape.as_str()))
            {
                return Err(TimelineError::Invalid(format!(
                    "element {element_id} 的 confetti.shapes 含未知形状：{unknown}"
                )));
            }
        }
        let ranges: [(&str, Option<f64>, (f64, f64)); 11] = [
            ("size", self.size, CONFETTI_SCALE_RANGE),
            ("speed", self.speed, CONFETTI_SCALE_RANGE),
            ("gravity", self.gravity, CONFETTI_GRAVITY_RANGE),
            ("drift", self.drift, CONFETTI_RATE_SCALE_RANGE),
            ("spin", self.spin, CONFETTI_RATE_SCALE_RANGE),
            ("wind", self.wind, CONFETTI_WIND_RANGE),
            ("opacity", self.opacity, CONFETTI_OPACITY_RANGE),
            ("angle", self.angle, CONFETTI_ANGLE_RANGE),
            ("spread", self.spread, CONFETTI_SPREAD_RANGE),
            ("origin.x", self.origin.map(|o| o.x), CONFETTI_ORIGIN_RANGE),
            ("origin.y", self.origin.map(|o| o.y), CONFETTI_ORIGIN_RANGE),
        ];
        for (name, value, (lo, hi)) in ranges {
            check_confetti_range(element_id, name, value, lo, hi)?;
        }
        if let Some(emit) = &self.emit {
            let ranges = [
                ("emit.rate", emit.rate, CONFETTI_RATE_RANGE),
                ("emit.count", emit.count, CONFETTI_COUNT_RANGE),
                ("emit.interval", emit.interval, CONFETTI_INTERVAL_RANGE),
            ];
            for (name, value, (lo, hi)) in ranges {
                check_confetti_range(element_id, name, value, lo, hi)?;
            }
        }
        Ok(())
    }

    /// The emission mode in effect (when absent, it is left to the recipe and `None` is returned).
    pub fn emit_mode(&self) -> Option<ConfettiEmitMode> {
        self.emit.as_ref().and_then(|emit| emit.mode)
    }
}

fn check_confetti_range(
    element_id: &str,
    name: &str,
    value: Option<f64>,
    lo: f64,
    hi: f64,
) -> Result<(), TimelineError> {
    if let Some(value) = value
        && (!value.is_finite() || !(lo..=hi).contains(&value))
    {
        return Err(TimelineError::Invalid(format!(
            "element {element_id} 的 confetti.{name} 须在 {lo}..={hi}"
        )));
    }
    Ok(())
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum CounterMode {
    Countdown,
    Countup,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum CounterFormat {
    #[serde(rename = "s")]
    Seconds,
    #[serde(rename = "mm:ss")]
    MinutesSeconds,
    #[serde(rename = "hh:mm:ss")]
    HoursMinutesSeconds,
}

fn default_counter_format() -> CounterFormat {
    CounterFormat::Seconds
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CounterProps {
    pub mode: CounterMode,
    #[serde(
        default = "default_counter_format",
        skip_serializing_if = "is_counter_seconds"
    )]
    pub format: CounterFormat,
}

fn is_counter_seconds(value: &CounterFormat) -> bool {
    *value == CounterFormat::Seconds
}

impl CounterProps {
    /// The readout is evaluated on a **millisecond grid** (`docs/design/elements/ccut-counter-element-design.md` §4). Floating-point differences such as `end − time` carry residue at the value-change points (`8.05 − 1.05 =
    /// 7.000000000000001`). Calling `ceil` directly would show one second too many, and the direction of the residue depends on each end's own floating-point representation. Without quantizing, the three surfaces could give different readouts on the same frame, breaking the determinism contract (§15). Convert first to integer milliseconds (the display precision of the timecode), and boundary ownership is then unambiguous.
    pub fn value_at(&self, start: f64, end: f64, time: f64) -> u64 {
        let ms = |value: f64| (value * 1000.0).round() as i64;
        let (t, s0, s1) = (ms(time), ms(start), ms(end));
        let value = match self.mode {
            // ceil / floor on integers. For the anchored end of half-open windows, see ADR-CT02.
            CounterMode::Countdown => ((s1 - t).max(0) + 999) / 1000,
            CounterMode::Countup => (t - s0).max(0) / 1000,
        };
        value as u64
    }

    pub fn text_at(&self, start: f64, end: f64, time: f64) -> String {
        let value = self.value_at(start, end, time);
        match self.format {
            CounterFormat::Seconds => value.to_string(),
            CounterFormat::MinutesSeconds => format!("{:02}:{:02}", value / 60, value % 60),
            CounterFormat::HoursMinutesSeconds => format!(
                "{:02}:{:02}:{:02}",
                value / 3_600,
                value / 60 % 60,
                value % 60
            ),
        }
    }

    fn validate(&self, _element_id: &str) -> Result<(), TimelineError> {
        Ok(())
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum DrawBrush {
    Round,
    Sliced,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct DrawStroke {
    pub points: Vec<[f64; 2]>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct DrawProps {
    pub brush: DrawBrush,
    pub color: String,
    pub size: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub alpha: Option<f64>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub strokes: Vec<DrawStroke>,
}

impl DrawProps {
    pub const MAX_STROKES: usize = 256;
    pub const MAX_POINTS: usize = 16_384;

    fn validate(&self, element_id: &str) -> Result<(), TimelineError> {
        validate_color(element_id, "draw.color", &self.color)?;
        if !self.size.is_finite() || !(1.0..=40.0).contains(&self.size) {
            return Err(TimelineError::Invalid(format!(
                "element {element_id} 的 draw.size 须在 1..=40"
            )));
        }
        if self
            .alpha
            .is_some_and(|alpha| !alpha.is_finite() || !(0.0..=1.0).contains(&alpha))
        {
            return Err(TimelineError::Invalid(format!(
                "element {element_id} 的 draw.alpha 须在 0..=1"
            )));
        }
        if self.strokes.len() > Self::MAX_STROKES {
            return Err(TimelineError::Invalid(format!(
                "element {element_id} 的 draw.strokes 超过 {}",
                Self::MAX_STROKES
            )));
        }
        let mut total = 0usize;
        for stroke in &self.strokes {
            total = total.saturating_add(stroke.points.len());
            for [x, y] in &stroke.points {
                if !x.is_finite()
                    || !y.is_finite()
                    || !(0.0..=100.0).contains(x)
                    || !(0.0..=100.0).contains(y)
                {
                    return Err(TimelineError::Invalid(format!(
                        "element {element_id} 的 draw point 须在 0..=100"
                    )));
                }
            }
        }
        if total > Self::MAX_POINTS {
            return Err(TimelineError::Invalid(format!(
                "element {element_id} 的 draw points 总数超过 {}",
                Self::MAX_POINTS
            )));
        }
        Ok(())
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum PlaceholderVariant {
    Camera,
    Media,
    Screen,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PlaceholderProps {
    pub variant: PlaceholderVariant,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
}

impl PlaceholderProps {
    fn validate(&self, element_id: &str) -> Result<(), TimelineError> {
        if self
            .notes
            .as_deref()
            .is_some_and(|notes| notes.len() > 2_048)
        {
            return Err(TimelineError::Invalid(format!(
                "element {element_id} 的 placeholder.notes 超过 2048 字节"
            )));
        }
        Ok(())
    }
}

fn finite(element_id: &str, field: &str, value: Option<f64>) -> Result<(), TimelineError> {
    match value {
        Some(value) if !value.is_finite() => Err(TimelineError::Invalid(format!(
            "element {element_id} 的 {field} 非法"
        ))),
        _ => Ok(()),
    }
}

/// `"#RRGGBB"` / `"#RRGGBBAA"`. The colour goes all the way to the rasterizer, and the format is locked down at the contract layer so that every rendering surface does not write its own loose parser.
/// Whiteboard hand-drawing parameters for `kind == "whiteboard"` (design doc §3; for the 0.9 extension, see the narration-sync design doc §5).
///
/// All optional. When absent, defaults apply (`hand=marker`, transparent paper colour, `draw` derived from the element duration and natural duration, ink lines before colour blocks, `pace=stretch`, `strict=false`). The reveal field itself is a render-time derived product and is **not persisted here** (ADR-WB02). 0.8 documents contain no new fields and are read with 0.9 semantics.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct WhiteboardProps {
    /// Hand style: `marker` / `pen` / `none`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub hand: Option<WhiteboardHand>,
    /// Paper colour `#RRGGBB(AA)`. Transparent when absent, so the project background shows through (ADR-WB06).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub paper: Option<String>,
    /// Seconds to finish drawing the full picture (`> 0`). When absent, `min(0.8 × duration, natural duration)` is used, and values exceeding the duration are truncated to the duration.
    /// Word anchors are not accepted: the completion point is computed into a number by `ccut whiteboard sync` and written, so there is a single source of truth.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub draw: Option<f64>,
    /// Ink lines before colour blocks; default true when absent.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ink_first: Option<bool>,
    /// 0.9: per-beat pacing. `stretch` (default when absent) = the group window is filled, byte-for-byte identical to 0.8. `natural` = draw at natural speed, then freeze until the group window ends. If it does not fit, it is compressed and `whiteboard-window-too-short` is reported.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pace: Option<WhiteboardPace>,
    /// 0.9: when `true`, `box` is a hard mask. Pixel ownership follows beat order, overlaps go to the later beat, connected regions spanning several boxes are cut apart by pixel, and foreground not covered by any box is placed after the final beat. Absent `false` = centroid grouping.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub strict: Option<bool>,
    /// Semantic order hint: connected regions falling inside `box` belong to that beat and are drawn from `at` to `end` (element-local seconds or word anchors).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub beats: Option<Vec<WhiteboardBeat>>,
}

/// Closed enum for `whiteboard.pace` (0.9).
#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum WhiteboardPace {
    /// Group window filled (default = the 0.8 behaviour).
    #[default]
    Stretch,
    /// Draw at natural speed, then freeze until the end of the group window.
    Natural,
}

impl WhiteboardPace {
    pub const ALL: [Self; 2] = [Self::Stretch, Self::Natural];

    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Stretch => "stretch",
            Self::Natural => "natural",
        }
    }
}

/// Closed enum for `whiteboard.hand`.
#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum WhiteboardHand {
    #[default]
    Marker,
    Pen,
    None,
}

impl WhiteboardHand {
    pub const ALL: [Self; 3] = [Self::Marker, Self::Pen, Self::None];

    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Marker => "marker",
            Self::Pen => "pen",
            Self::None => "none",
        }
    }
}

/// One beat. `at` / `end` are [`TimeValue`]: a number is element-local seconds (relative to `start`), and a string is a word anchor (same grammar as the element's `start` / `end`; the host resolves it and subtracts the element start). `box` is the picture percentage `[x, y, w, h]`. When `end` is absent it equals the next beat's `at`; when the final beat's `end` is absent it equals `draw`. `label` is for display and alignment checking only and does not take part in rendering (≤ [`WHITEBOARD_MAX_LABEL_CHARS`] characters).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct WhiteboardBeat {
    pub at: TimeValue,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub end: Option<TimeValue>,
    #[serde(rename = "box")]
    pub rect: [f64; 4],
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
}

impl WhiteboardBeat {
    /// Beat in numeric form (the 0.8 shape).
    pub fn at_seconds(at: f64, rect: [f64; 4]) -> Self {
        Self {
            at: TimeValue::Seconds(at),
            end: None,
            rect,
            label: None,
        }
    }

    /// Local seconds when `at` is a number. Returns `None` for an anchor (the host must resolve it).
    pub fn at_local(&self) -> Option<f64> {
        match &self.at {
            TimeValue::Seconds(value) => Some(*value),
            TimeValue::Anchor(_) => None,
        }
    }

    /// Local seconds when `end` is a number. Returns `None` when absent or an anchor.
    pub fn end_local(&self) -> Option<f64> {
        match &self.end {
            Some(TimeValue::Seconds(value)) => Some(*value),
            _ => None,
        }
    }

    /// Either end is a word anchor.
    pub fn is_anchored(&self) -> bool {
        matches!(self.at, TimeValue::Anchor(_)) || matches!(self.end, Some(TimeValue::Anchor(_)))
    }
}

/// Upper limit for `whiteboard.beats`.
pub const WHITEBOARD_MAX_BEATS: usize = 64;
/// Character limit for `whiteboard.beats[].label`.
pub const WHITEBOARD_MAX_LABEL_CHARS: usize = 80;

/// Whiteboard beat timing validation code (0.9): after parsing, it must hold that `at_g < end_g ≤ at_{g+1}`.
pub const WHITEBOARD_BEAT_WINDOW: &str = "whiteboard-beat-window";
/// Relationship between the final beat's `end` and `draw`: `end_last ≤ draw ≤ duration`.
pub const WHITEBOARD_BEAT_AFTER_DRAW: &str = "whiteboard-beat-after-draw";
/// Under `pace: natural`, a beat's natural duration is longer than the group window (it is compressed).
pub const WHITEBOARD_WINDOW_TOO_SHORT: &str = "whiteboard-window-too-short";
/// Under `strict`, some foreground pixels are not inside any `box` (they are placed after the final beat).
pub const WHITEBOARD_UNASSIGNED_FOREGROUND: &str = "whiteboard-unassigned-foreground";
/// Under `strict`, a `box` is emptied out by a later beat.
pub const WHITEBOARD_EMPTY_BOX: &str = "whiteboard-empty-box";
/// `ccut whiteboard sync` did not get an object mapping, and fell back to “reading-order connected regions ∝ characters per sentence”.
pub const WHITEBOARD_BEATS_HEURISTIC: &str = "whiteboard-beats-heuristic";
/// `label` does not match the sentence text where the anchor word sits (the script changed, or the id drifted).
pub const WHITEBOARD_LABEL_MISMATCH: &str = "whiteboard-label-mismatch";
/// A hold segment: within the element window there is speech, a continuous stretch in which the reveal does not advance, and which is not inside any beat.
pub const WHITEBOARD_SPEECH_WITHOUT_PROGRESS: &str = "whiteboard-speech-without-progress";

impl WhiteboardProps {
    /// Default `inkFirst`.
    pub fn ink_first(&self) -> bool {
        self.ink_first.unwrap_or(true)
    }

    /// Default `hand`.
    pub fn hand(&self) -> WhiteboardHand {
        self.hand.unwrap_or_default()
    }

    /// Default `pace` (0.9).
    pub fn pace(&self) -> WhiteboardPace {
        self.pace.unwrap_or_default()
    }

    /// Default `strict` (0.9).
    pub fn strict(&self) -> bool {
        self.strict.unwrap_or(false)
    }

    fn validate(&self, element_id: &str) -> Result<(), TimelineError> {
        if let Some(paper) = &self.paper {
            validate_color(element_id, "whiteboard.paper", paper)?;
        }
        if let Some(draw) = self.draw
            && !(draw.is_finite() && draw > 0.0)
        {
            return Err(TimelineError::Invalid(format!(
                "element {element_id} 的 whiteboard.draw 须为正数：{draw}"
            )));
        }
        if let Some(beats) = &self.beats {
            if beats.len() > WHITEBOARD_MAX_BEATS {
                return Err(TimelineError::Invalid(format!(
                    "element {element_id} 的 whiteboard.beats 至多 {WHITEBOARD_MAX_BEATS} 条"
                )));
            }
            let mut last = f64::NEG_INFINITY;
            let mut last_end: Option<f64> = None;
            for (index, beat) in beats.iter().enumerate() {
                for (field, value) in [("at", Some(&beat.at)), ("end", beat.end.as_ref())] {
                    match value {
                        Some(TimeValue::Seconds(value)) if !value.is_finite() || *value < 0.0 => {
                            return Err(TimelineError::Invalid(format!(
                                "element {element_id} 的 whiteboard.beats[{index}].{field} 须为非负秒数"
                            )));
                        }
                        Some(TimeValue::Anchor(anchor)) if !valid_anchor(anchor) => {
                            return Err(TimelineError::Invalid(format!(
                                "element {element_id} 的 whiteboard.beats[{index}].{field} 词锚点非法：{anchor}"
                            )));
                        }
                        _ => {}
                    }
                }
                if let Some(label) = &beat.label
                    && label.chars().count() > WHITEBOARD_MAX_LABEL_CHARS
                {
                    return Err(TimelineError::Invalid(format!(
                        "element {element_id} 的 whiteboard.beats[{index}].label 至多 {WHITEBOARD_MAX_LABEL_CHARS} 字符"
                    )));
                }
                // Numeric beat timing can be validated at the contract layer. Anchor forms must wait for the host to resolve them (the same code is reported with elementId + field).
                if let Some(at) = beat.at_local() {
                    if at < last {
                        return Err(TimelineError::Invalid(format!(
                            "element {element_id} 的 whiteboard.beats[{index}].at 须单调不减（{WHITEBOARD_BEAT_WINDOW}）"
                        )));
                    }
                    if let Some(prev_end) = last_end
                        && prev_end > at
                    {
                        return Err(TimelineError::Invalid(format!(
                            "element {element_id} 的 whiteboard.beats[{}].end 须不晚于下一拍的 at（{WHITEBOARD_BEAT_WINDOW}）",
                            index - 1
                        )));
                    }
                    last = at;
                }
                last_end = match (beat.at_local(), beat.end_local()) {
                    (Some(at), Some(end)) => {
                        if end <= at {
                            return Err(TimelineError::Invalid(format!(
                                "element {element_id} 的 whiteboard.beats[{index}].end 须晚于 at（{WHITEBOARD_BEAT_WINDOW}）"
                            )));
                        }
                        Some(end)
                    }
                    (None, Some(end)) => Some(end),
                    _ => None,
                };
                if index + 1 == beats.len()
                    && let (Some(end), Some(draw)) = (beat.end_local(), self.draw)
                    && end > draw
                {
                    return Err(TimelineError::Invalid(format!(
                        "element {element_id} 的 whiteboard.beats[{index}].end 须不晚于 draw（{WHITEBOARD_BEAT_AFTER_DRAW}）"
                    )));
                }
                let [x, y, w, h] = beat.rect;
                if ![x, y, w, h].iter().all(|v| v.is_finite())
                    || w <= 0.0
                    || h <= 0.0
                    || !(-100.0..=200.0).contains(&x)
                    || !(-100.0..=200.0).contains(&y)
                    || w > 300.0
                    || h > 300.0
                {
                    return Err(TimelineError::Invalid(format!(
                        "element {element_id} 的 whiteboard.beats[{index}].box 非法：{:?}",
                        beat.rect
                    )));
                }
            }
        }
        Ok(())
    }
}

pub(crate) fn validate_color(
    element_id: &str,
    field: &str,
    color: &str,
) -> Result<(), TimelineError> {
    let hex = color.strip_prefix('#').unwrap_or("");
    if !matches!(hex.len(), 6 | 8) || !hex.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err(TimelineError::Invalid(format!(
            "element {element_id} 的 {field} 不是 #RRGGBB[AA]：{color}"
        )));
    }
    Ok(())
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ElementRole {
    Broll,
    Watermark,
    Screentext,
    Overlay,
    Frame,
}

#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CornerRadii {
    pub top_left: f64,
    pub top_right: f64,
    pub bottom_right: f64,
    pub bottom_left: f64,
}

impl CornerRadii {
    pub fn values(self) -> [f64; 4] {
        [
            self.top_left,
            self.top_right,
            self.bottom_right,
            self.bottom_left,
        ]
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Place {
    pub x: Option<f64>,
    pub y: Option<f64>,
    pub w: Option<f64>,
    pub scale: Option<f64>,
    pub scale_y: Option<f64>,
    pub rot: Option<f64>,
    pub opacity: Option<f64>,
    pub radius: Option<f64>,
    /// Media crop radius set independently for each corner. When present it takes precedence over the legacy single-value `radius`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub corner_radii: Option<CornerRadii>,
    /// Horizontal / vertical mirroring (new in 0.2). **Mirroring is geometry, not appearance**, so it belongs to `Place` rather than to the schema-less `style` (ADR-E01). Both carry `skip_serializing_if`: an old document without mirroring serializes byte-for-byte identical to 0.1.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub flip_x: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub flip_y: Option<bool>,
}

impl Place {
    /// The scale sign after mirroring, multiplied directly into the affine matrix's `sx` / `sy`.
    pub fn flip_signs(&self) -> (f64, f64) {
        (
            if self.flip_x.unwrap_or(false) {
                -1.0
            } else {
                1.0
            },
            if self.flip_y.unwrap_or(false) {
                -1.0
            } else {
                1.0
            },
        )
    }

    pub fn corner_radii(&self) -> [f64; 4] {
        self.corner_radii
            .map(CornerRadii::values)
            .unwrap_or_else(|| [self.radius.unwrap_or(0.0); 4])
    }
}

impl Place {
    pub fn validate(&self, element_id: &str) -> Result<(), TimelineError> {
        for (name, value) in [
            ("x", self.x),
            ("y", self.y),
            ("w", self.w),
            ("scale", self.scale),
            ("scaleY", self.scale_y),
            ("rot", self.rot),
            ("opacity", self.opacity),
            ("radius", self.radius),
        ] {
            if let Some(value) = value
                && (!value.is_finite() || (name == "radius" && value < 0.0))
            {
                return Err(TimelineError::Invalid(format!(
                    "element {element_id} 的 place.{name} 非法"
                )));
            }
        }
        if self.corner_radii.is_some_and(|radii| {
            radii
                .values()
                .iter()
                .any(|value| !value.is_finite() || *value < 0.0)
        }) {
            return Err(TimelineError::Invalid(format!(
                "element {element_id} 的 place.cornerRadii 必须是非负有限数"
            )));
        }
        Ok(())
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum VisualMode {
    Fullscreen,
    Pip,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Fit {
    Cover,
    Contain,
}

/// Background behind a media element (its margins / canvas base): `"blur"`, `"black"`, or a solid `"#RRGGBB"` colour (since 0.12).
///
/// Input is case-insensitive; output is always uppercase `#RRGGBB`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Background {
    Blur,
    Black,
    Color([u8; 3]),
}

impl Background {
    /// Parses the value in the document; returns `None` if it is not recognized.
    pub fn parse(text: &str) -> Option<Self> {
        match text {
            "blur" => Some(Self::Blur),
            "black" => Some(Self::Black),
            _ => {
                let hex = text.strip_prefix('#')?;
                if hex.len() != 6 || !hex.chars().all(|c| c.is_ascii_hexdigit()) {
                    return None;
                }
                let byte = |index: usize| u8::from_str_radix(&hex[index..index + 2], 16).ok();
                Some(Self::Color([byte(0)?, byte(2)?, byte(4)?]))
            }
        }
    }

    /// The form written in the document (`blur` / `black` / uppercase `#RRGGBB`).
    pub fn as_string(&self) -> String {
        match self {
            Self::Blur => "blur".into(),
            Self::Black => "black".into(),
            Self::Color([r, g, b]) => format!("#{r:02X}{g:02X}{b:02X}"),
        }
    }

    /// RGB of a solid background (`black` is `[0, 0, 0]`); `blur` returns `None`.
    pub fn solid_rgb(&self) -> Option<[u8; 3]> {
        match self {
            Self::Blur => None,
            Self::Black => Some([0, 0, 0]),
            Self::Color(rgb) => Some(*rgb),
        }
    }
}

impl Serialize for Background {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.as_string())
    }
}

impl<'de> Deserialize<'de> for Background {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let text = String::deserialize(deserializer)?;
        Self::parse(&text).ok_or_else(|| {
            serde::de::Error::custom(format!(
                "背景须是 \"blur\"、\"black\" 或 \"#RRGGBB\"：{text}"
            ))
        })
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Tile {
    pub on: bool,
    pub angle: Option<f64>,
    pub gap_x: Option<f64>,
    pub gap_y: Option<f64>,
    pub stagger: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Mask {
    pub shape: MaskShape,
    pub feather: Option<f64>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum MaskShape {
    Ellipse,
}

/// Range for the intensity-type fields in `fx` (grayscale / sharpen / noise / vignette / effectIntensity).
pub const FX_AMOUNT_RANGE: (f64, f64) = (0.0, 1.0);
/// Range for the signed colour-grading fields in `fx` (brightness / contrast / exposure / hue / saturation).
pub const FX_ADJUST_RANGE: (f64, f64) = (-1.0, 1.0);
/// Range for `fx.blur`.
pub const FX_BLUR_RANGE: (f64, f64) = (0.0, 100.0);

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Fx {
    pub grayscale: Option<f64>,
    pub blur: Option<f64>,
    pub brightness: Option<f64>,
    pub contrast: Option<f64>,
    pub exposure: Option<f64>,
    pub hue: Option<f64>,
    pub saturation: Option<f64>,
    pub sharpen: Option<f64>,
    pub noise: Option<f64>,
    pub vignette: Option<f64>,
    pub filter_preset: Option<FilterPreset>,
    pub effect_preset: Option<EffectPreset>,
    pub effect_intensity: Option<f64>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum FilterPreset {
    None,
    Calm1,
    Calm2,
    Calm3,
    Clean1,
    Clean2,
    Clean3,
    Cottage1,
    Cottage2,
    Cottage3,
    Peckham1,
    Peckham2,
    Peckham3,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum EffectPreset {
    None,
    Invert,
    NightVision,
    ThermalVision,
    Old,
    Polaroid,
    Filmic,
    Snowy,
    BoxBlur,
    BokehBlur,
}

pub const FILTER_PRESETS: &[&str] = &[
    "none", "calm1", "calm2", "calm3", "clean1", "clean2", "clean3", "cottage1", "cottage2",
    "cottage3", "peckham1", "peckham2", "peckham3",
];

pub const EFFECT_PRESETS: &[&str] = &[
    "none",
    "invert",
    "night_vision",
    "thermal_vision",
    "old",
    "polaroid",
    "filmic",
    "snowy",
    "box_blur",
    "bokeh_blur",
];

impl Fx {
    pub fn validate(&self, element_id: &str) -> Result<(), TimelineError> {
        for (name, value) in [
            ("grayscale", self.grayscale),
            ("sharpen", self.sharpen),
            ("noise", self.noise),
            ("vignette", self.vignette),
            ("effectIntensity", self.effect_intensity),
        ] {
            let (lo, hi) = FX_AMOUNT_RANGE;
            if let Some(value) = value
                && (!value.is_finite() || !(lo..=hi).contains(&value))
            {
                return Err(TimelineError::Invalid(format!(
                    "element {element_id} 的 fx.{name} 须在 0..=1"
                )));
            }
        }
        for (name, value) in [
            ("brightness", self.brightness),
            ("contrast", self.contrast),
            ("exposure", self.exposure),
            ("hue", self.hue),
            ("saturation", self.saturation),
        ] {
            let (lo, hi) = FX_ADJUST_RANGE;
            if let Some(value) = value
                && (!value.is_finite() || !(lo..=hi).contains(&value))
            {
                return Err(TimelineError::Invalid(format!(
                    "element {element_id} 的 fx.{name} 须在 -1..=1"
                )));
            }
        }
        let (lo, hi) = FX_BLUR_RANGE;
        if self
            .blur
            .is_some_and(|value| !value.is_finite() || !(lo..=hi).contains(&value))
        {
            return Err(TimelineError::Invalid(format!(
                "element {element_id} 的 fx.blur 须在 0..=100"
            )));
        }
        Ok(())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct Animation {
    pub enter: Option<AnimationSlot>,
    pub exit: Option<AnimationSlot>,
    pub r#loop: Option<AnimationSlot>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AnimationSlot {
    pub preset: String,
    pub preset_version: Option<u32>,
    pub dur: Option<f64>,
    pub delay: Option<f64>,
    pub intensity: Option<f64>,
    pub ease: Option<String>,
    pub stagger: Option<f64>,
    pub stagger_from: Option<String>,
    pub period: Option<f64>,
    pub phase: Option<f64>,
    pub seed: Option<u64>,
}

/// Closed vocabulary for the enter slot (`animate.enter.preset`) = the `timeline.enter.*` recipe table in `ccut-motion`. Since round 156 the two are equal entry by entry, and `preset_lists_frozen` keeps it that way.
pub const ENTER_PRESETS: &[&str] = &[
    "none",
    "fade",
    "rise",
    "drop",
    "slideL",
    "slideR",
    // 2026-09-05 (round 156): slide gains the up and down directions (enter = which side it comes from), in the same position as the registry. wave / flipboard / dragonfly / billboard are at the end of the table.
    "slideUp",
    "slideDown",
    "pop",
    "zoomIn",
    "zoomOut",
    "spin",
    "blurIn",
    "typewriter",
    "riseWords",
    "wipe",
    // 2026-08-30: aligned with the text animation catalog (designs/cuccut model-textpresets). Five entry animations expressible as a 2D pose: compress / fall / skid / roll carry a mirrored exit, and bounce deliberately has no exit (a bounce has no symmetrical leaving motion). The recipes are in
    // core/presets/builtin/motion/timeline.{enter,exit}.*.json.
    "compress",
    "bounce",
    "fall",
    "skid",
    "roll",
    // 2026-09-05 (round 156): filled out to the design doc's In 19 / Out 16 / Loop 9. wave / flipboard / dragonfly / billboard land in the core for the first time, and `drop` also gains an exit of the same name (design doc stomp).
    "wave",
    "flipboard",
    "dragonfly",
    "billboard",
    // 2026-09-08: element animation catalog (shape / image / video, `surface: "element"`, multi-keyframe recipes). The text catalog does not list these ids. Order = the registry's `order`.
    "elFade",
    "elFloatL",
    "elFloatR",
    "elFloatUp",
    "elFloatDown",
    "elZoom",
    "elKenBurns",
    "elDrop",
    "elSlideL",
    "elSlideR",
    "elSlideUp",
    "elSlideDown",
    "elWipeL",
    "elWipeR",
    "elWipeUp",
    "elWipeDown",
    "elPop",
    "elBounce",
    "elSpinCw",
    "elSpinCcw",
    "elSlideBounceL",
    "elSlideBounceR",
    "elSlideBounceUp",
    "elSlideBounceDown",
    "elGentleFloatL",
    "elGentleFloatR",
    "elGentleFloatUp",
    "elGentleFloatDown",
];

/// Closed vocabulary for the exit slot (`animate.exit.preset`) = the `timeline.exit.*` recipe table in `ccut-motion`, in registry `order`. Before 2026-09-05 (round 156) the exit slot borrowed the enter vocabulary for validation. So ids that only have an exit recipe, such as `sink` / `shrink`, could not be written into a document: once the editing panel materialized an exit that the engine had derived as “follow the entrance” via `mirror` (`text_workbench::choose` keeps an already derived exit when a different slot is changed), saving was rejected by `validate`. The exit vocabulary has been independent since then.
pub const EXIT_PRESETS: &[&str] = &[
    "none",
    "fade",
    "sink",
    "rise",
    "slideL",
    "slideR",
    "slideUp",
    "slideDown",
    "shrink",
    "zoomIn",
    "zoomOut",
    "spin",
    "wipe",
    "compress",
    "fall",
    "skid",
    "roll",
    "drop",
    "flipboard",
    "dragonfly",
    "billboard",
    // 2026-09-08: element animation catalog (shape / image / video, `surface: "element"`, multi-keyframe recipes). The text catalog does not list these ids. Order = the registry's `order`.
    "elFade",
    "elFloatL",
    "elFloatR",
    "elFloatUp",
    "elFloatDown",
    "elZoom",
    "elKenBurns",
    "elDrop",
    "elSlideL",
    "elSlideR",
    "elSlideUp",
    "elSlideDown",
    "elWipeL",
    "elWipeR",
    "elWipeUp",
    "elWipeDown",
    "elPop",
    "elBounce",
    "elSpinCw",
    "elSpinCcw",
    "elSlideBounceL",
    "elSlideBounceR",
    "elSlideBounceUp",
    "elSlideBounceDown",
    "elGentleFloatL",
    "elGentleFloatR",
    "elGentleFloatUp",
    "elGentleFloatDown",
];

/// In the Timeline 0.1 era the exit slot borrowed the enter vocabulary. These names were legal in the exit slot but had no exit recipe (`lower_timeline::effective_exit` treats them as no exit). A published closed enum does not drop words (spec §19: adding words within an enum does not bump the version, but removing them does), so they are still accepted on input with unchanged meaning. The edit write path must no longer produce them, and `ccut-motion`'s `textpreset` also rejects them at parse time against the recipe table.
pub const EXIT_LEGACY_PRESETS: &[&str] = &["pop", "blurIn", "typewriter", "riseWords", "bounce"];

/// IDs the exit slot actually accepts: the recipe table ∪ the 0.1 compatibility names.
pub fn exit_preset_accepted(id: &str) -> bool {
    EXIT_PRESETS.contains(&id) || EXIT_LEGACY_PRESETS.contains(&id)
}

pub const LOOP_PRESETS: &[&str] = &[
    "float",
    "pulse",
    "sway",
    "jitter",
    "blink",
    // Round 156: the design doc's Loop catalog (rotate uses the ramp wave, heartBeat uses the heartbeat wave).
    "rotate",
    "heartBeat",
    "vogue",
    "dragonfly",
    "billboard",
    "roll",
    // 2026-09-08: element animation catalog (shape / image / video, `surface: "element"`, multi-keyframe recipes). The text catalog does not list these ids. Order = the registry's `order`.
    "elSpin",
    "elSpinSmooth",
    "elSpin3d",
    "elBounce",
    "elHeartbeat",
    "elSway",
    "elSway3d",
    "elSqueezy",
    "elJiggle",
];

/// The Timeline `ease` enum = the closed table in spec Appendix A. The only implementation is in `motion::curve`.
pub use ::motion::curve::EASE_NAMES;

impl Animation {
    pub fn validate(&self, element_id: &str) -> Result<(), TimelineError> {
        if let Some(slot) = &self.enter {
            slot.validate(element_id, "enter", |id| ENTER_PRESETS.contains(&id))?;
        }
        if let Some(slot) = &self.exit {
            slot.validate(element_id, "exit", exit_preset_accepted)?;
        }
        if let Some(slot) = &self.r#loop {
            slot.validate(element_id, "loop", |id| LOOP_PRESETS.contains(&id))?;
        }
        Ok(())
    }
}

impl AnimationSlot {
    fn validate(
        &self,
        element_id: &str,
        slot_name: &str,
        accepted: impl Fn(&str) -> bool,
    ) -> Result<(), TimelineError> {
        if !accepted(self.preset.as_str()) {
            return Err(TimelineError::Invalid(format!(
                "element {element_id} 的 {slot_name} preset 非法：{}",
                self.preset
            )));
        }
        use crate::animations::{
            DURATION_MAX, DURATION_MIN, INTENSITY_MAX, INTENSITY_MIN, PERIOD_MAX, PERIOD_MIN,
        };
        if let Some(duration) = self.dur
            && (!duration.is_finite() || !(DURATION_MIN..=DURATION_MAX).contains(&duration))
        {
            return Err(TimelineError::Invalid(format!(
                "element {element_id} 的 {slot_name}.dur 须在 {DURATION_MIN}..={DURATION_MAX}"
            )));
        }
        if let Some(period) = self.period
            && (!period.is_finite() || !(PERIOD_MIN..=PERIOD_MAX).contains(&period))
        {
            return Err(TimelineError::Invalid(format!(
                "element {element_id} 的 {slot_name}.period 须在 {PERIOD_MIN}..={PERIOD_MAX}"
            )));
        }
        if let Some(intensity) = self.intensity
            && (!intensity.is_finite() || !(INTENSITY_MIN..=INTENSITY_MAX).contains(&intensity))
        {
            return Err(TimelineError::Invalid(format!(
                "element {element_id} 的 {slot_name}.intensity 须在 {INTENSITY_MIN}..={INTENSITY_MAX}"
            )));
        }
        for (name, value) in [("delay", self.delay), ("phase", self.phase)] {
            if let Some(value) = value
                && !value.is_finite()
            {
                return Err(TimelineError::Invalid(format!(
                    "element {element_id} 的 {slot_name}.{name} 非法"
                )));
            }
        }
        if let Some(stagger) = self.stagger
            && (!stagger.is_finite() || stagger <= 0.0)
        {
            return Err(TimelineError::Invalid(format!(
                "element {element_id} 的 {slot_name}.stagger 须为正有限数"
            )));
        }
        if let Some(from) = &self.stagger_from
            && !["start", "end", "center"].contains(&from.as_str())
        {
            return Err(TimelineError::Invalid(format!(
                "element {element_id} 的 {slot_name}.staggerFrom 非法：{from}"
            )));
        }
        if slot_name == "loop" && (self.stagger.is_some() || self.stagger_from.is_some()) {
            return Err(TimelineError::Invalid(format!(
                "element {element_id} 的 loop 不接受 stagger/staggerFrom"
            )));
        }
        if let Some(ease) = &self.ease
            && !EASE_NAMES.contains(&ease.as_str())
        {
            return Err(TimelineError::Invalid(format!(
                "element {element_id} 的 {slot_name}.ease 非法：{ease}"
            )));
        }
        Ok(())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Main {
    /// The source-clock clips remain for transcript mapping; media lives in ordinary elements.
    #[serde(default, skip_serializing_if = "is_false")]
    pub detached: bool,
    pub place: Option<Place>,
    #[serde(default, skip_serializing_if = "is_false")]
    pub muted: bool,
    pub background: Option<Background>,
    /// The main-source duration that an ordinary video element in a detached document is aligned to (new in 0.10). It is set at split time, and reconciled at read time (`crate::video_elements::follow_main_duration`), following refreshes of the main source. The main source of an animation project is synthesized on site, so its duration changes when re-rendered. A main video element whose source end falls exactly on this value follows to the new end. Absent = an old document: it does not follow, and records the current value the first time it is read.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_duration: Option<f64>,
}

fn is_false(value: &bool) -> bool {
    !*value
}

fn unique_id(ids: &mut HashSet<String>, id: &str) -> Result<(), TimelineError> {
    if ids.insert(id.to_owned()) {
        Ok(())
    } else {
        Err(TimelineError::Invalid(format!("重复 id：{id}")))
    }
}

pub(crate) fn validate_id(kind: &str, id: &str) -> Result<(), TimelineError> {
    if id.is_empty() || id.chars().any(char::is_whitespace) {
        Err(TimelineError::Invalid(format!("{kind} id 非法：{id}")))
    } else {
        Ok(())
    }
}

fn valid_anchor(value: &str) -> bool {
    crate::anchors::is_word_anchor(value)
}

pub fn schema_json() -> Value {
    let exit_presets_accepted = EXIT_PRESETS
        .iter()
        .chain(EXIT_LEGACY_PRESETS.iter())
        .copied()
        .collect::<Vec<_>>();
    json!({
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "title": "CucCut timeline.json",
        "type": "object",
        "additionalProperties": false,
        "required": ["ccutTimeline"],
        "properties": {
            "ccutTimeline": {"enum": TIMELINE_VERSIONS},
            "sources": {
                "type": "object",
                "properties": {"main": {"$ref": "#/$defs/mainSource"}},
                "additionalProperties": {"$ref": "#/$defs/source"}
            },
            "clips": {"type": "array", "items": {"$ref": "#/$defs/clip"}},
            "tracks": {"type": "array", "items": {"$ref": "#/$defs/track"}},
            "main": {"$ref": "#/$defs/main"},
            "template": {"$ref": "#/$defs/template"}
        },
        "$defs": {
            "cut": {
                "type": "object", "additionalProperties": false,
                "required": ["id", "t0", "t1"],
                "properties": {"id": {"type": "string"}, "t0": {"type": "number", "minimum": 0}, "t1": {"type": "number", "exclusiveMinimum": 0}, "ref": {"type": "string"}}
            },
            "source": {
                "type": "object", "additionalProperties": false,
                "properties": {"path": {"type": "string"}, "hash": {"type": "string"}, "kind": {"enum": ["video", "image", "audio", "lottie"]}, "duration": {"type": "number", "minimum": 0}, "naturalW": {"type": "integer"}, "naturalH": {"type": "integer"}, "hasAudio": {"type": "boolean"}, "poster": {"type": "string"}, "cuts": {"type": "array", "items": {"$ref": "#/$defs/cut"}}, "origin": {"enum": SOURCE_ORIGINS}, "provenance": {"type": "string", "minLength": 1}}
            },
            "mainSource": {
                "type": "object", "additionalProperties": false,
                "properties": {"cuts": {"type": "array", "items": {"$ref": "#/$defs/cut"}}}
            },
            "clip": {
                "type": "object", "additionalProperties": false,
                "required": ["id", "in", "out"],
                "properties": {"id": {"type": "string"}, "srcId": {"type": "string", "default": "main"}, "in": {"type": "number", "minimum": 0}, "out": {"type": "number", "exclusiveMinimum": 0}, "rate": {"type": "number", "exclusiveMinimum": 0, "default": 1}}
            },
            "timeValue": {
                "oneOf": [
                    {"type": "number", "minimum": 0},
                    {"type": "string", "pattern": "^~[A-Za-z0-9_.-]+:[A-Za-z0-9_.-]+(?:(?::(?:start|end))(?:[+-](?:\\d+(?:\\.\\d+)?|\\.\\d+))?|\\+(?:\\d+(?:\\.\\d+)?|\\.\\d+))?$"}
                ]
            },
            "place": {
                "type": "object", "additionalProperties": false,
                "properties": {"x": {"type": "number"}, "y": {"type": "number"}, "w": {"type": "number"}, "scale": {"type": "number"}, "scaleY": {"type": "number"}, "rot": {"type": "number"}, "opacity": {"type": "number"}, "radius": {"type": "number"}, "cornerRadii": {"$ref": "#/$defs/cornerRadii"}, "flipX": {"type": "boolean"}, "flipY": {"type": "boolean"}}
            },
            "cornerRadii": {
                "type": "object", "additionalProperties": false,
                "required": ["topLeft", "topRight", "bottomRight", "bottomLeft"],
                "properties": {
                    "topLeft": {"type": "number", "minimum": 0}, "topRight": {"type": "number", "minimum": 0},
                    "bottomRight": {"type": "number", "minimum": 0}, "bottomLeft": {"type": "number", "minimum": 0}
                }
            },
            "shapeProps": {
                "type": "object", "additionalProperties": false, "required": ["shape"],
                "properties": {
                    "shape": {"type": "string"}, "fill": {"type": "string"}, "stroke": {"type": "string"},
                    "strokeWidth": {"type": "number", "minimum": 0},
                    "cornerRadius": {"type": "array", "items": {"type": "number", "minimum": 0}, "minItems": 4, "maxItems": 4},
                    "h": {"type": "number"},
                    "x1": {"type": "number"}, "y1": {"type": "number"}, "x2": {"type": "number"}, "y2": {"type": "number"},
                    "head": {"enum": SHAPE_HEADS}
                }
            },
            "stickerProps": {
                "type": "object", "additionalProperties": false, "required": ["source"],
                "properties": {"source": {"enum": STICKER_SOURCES}, "templateId": {"type": "string"}, "path": {"type": "string"}, "loop": {"enum": STICKER_LOOPS}, "fillOverrides": {"type": "object", "additionalProperties": {"type": "string"}}}
            },
            "visualizerProps": {
                "type": "object", "additionalProperties": false, "required": ["style"],
                "properties": {
                    "style": {"type": "string"}, "mainColor": {"type": "string"}, "secondaryColor": {"type": "string"},
                    "fftSize": {"enum": VISUALIZER_FFT_SIZES}, "minDb": {"type": "number"}, "maxDb": {"type": "number"},
                    "smoothing": {"type": "number", "minimum": 0, "exclusiveMaximum": 1},
                    "gain": {"type": "number", "minimum": 0}, "audio": {"type": "string"},
                    "speaker": {"type": "string", "minLength": 1}, "alwaysShow": {"type": "boolean"}
                }
            },
            "progressProps": {
                "type": "object", "additionalProperties": false, "required": ["style"],
                "properties": {"style": {"type": "string"}, "mainColor": {"type": "string"}, "secondaryColor": {"type": "string"}, "startProgress": {"type": "number", "minimum": 0, "maximum": 1}, "endProgress": {"type": "number", "minimum": 0, "maximum": 1}}
            },
            "whiteboardProps": {
                "type": "object", "additionalProperties": false,
                "properties": {
                    "hand": {"enum": ["marker", "pen", "none"]}, "paper": {"type": "string"},
                    "draw": {"type": "number", "exclusiveMinimum": 0}, "inkFirst": {"type": "boolean"},
                    "pace": {"enum": ["stretch", "natural"]}, "strict": {"type": "boolean"},
                    "beats": {"type": "array", "maxItems": WHITEBOARD_MAX_BEATS, "items": {"$ref": "#/$defs/whiteboardBeat"}}
                }
            },
            "whiteboardBeat": {
                "type": "object", "additionalProperties": false, "required": ["at", "box"],
                "properties": {
                    "at": {"$ref": "#/$defs/timeValue"},
                    "end": {"$ref": "#/$defs/timeValue"},
                    "box": {"type": "array", "minItems": 4, "maxItems": 4, "items": {"type": "number"}},
                    "label": {"type": "string", "maxLength": WHITEBOARD_MAX_LABEL_CHARS}
                }
            },
            "confettiProps": {
                "type": "object", "additionalProperties": false, "required": ["style"],
                "properties": {
                    "style": {"type": "string"}, "seed": {"type": "integer", "minimum": 0},
                    "colors": {"type": "array", "minItems": 1, "maxItems": CONFETTI_MAX_COLORS, "items": {"type": "string"}},
                    "shapes": {"type": "array", "minItems": 1, "maxItems": CONFETTI_SHAPES.len(), "items": {"enum": CONFETTI_SHAPES}},
                    "size": {"type": "number", "minimum": CONFETTI_SCALE_RANGE.0, "maximum": CONFETTI_SCALE_RANGE.1},
                    "speed": {"type": "number", "minimum": CONFETTI_SCALE_RANGE.0, "maximum": CONFETTI_SCALE_RANGE.1},
                    "gravity": {"type": "number", "minimum": CONFETTI_GRAVITY_RANGE.0, "maximum": CONFETTI_GRAVITY_RANGE.1},
                    "drift": {"type": "number", "minimum": CONFETTI_RATE_SCALE_RANGE.0, "maximum": CONFETTI_RATE_SCALE_RANGE.1},
                    "spin": {"type": "number", "minimum": CONFETTI_RATE_SCALE_RANGE.0, "maximum": CONFETTI_RATE_SCALE_RANGE.1},
                    "wind": {"type": "number", "minimum": CONFETTI_WIND_RANGE.0, "maximum": CONFETTI_WIND_RANGE.1},
                    "opacity": {"type": "number", "minimum": 0, "maximum": 1},
                    "emit": {
                        "type": "object", "additionalProperties": false,
                        "properties": {
                            "mode": {"enum": ["continuous", "burst"]},
                            "rate": {"type": "number", "minimum": 1, "maximum": CONFETTI_MAX_RATE},
                            "count": {"type": "number", "minimum": 1, "maximum": CONFETTI_MAX_COUNT},
                            "interval": {"type": "number", "minimum": 0, "maximum": CONFETTI_MAX_INTERVAL},
                            "settle": {"type": "boolean"}
                        }
                    },
                    "origin": {
                        "type": "object", "additionalProperties": false, "required": ["x", "y"],
                        "properties": {
                            "x": {"type": "number", "minimum": CONFETTI_ORIGIN_RANGE.0, "maximum": CONFETTI_ORIGIN_RANGE.1},
                            "y": {"type": "number", "minimum": CONFETTI_ORIGIN_RANGE.0, "maximum": CONFETTI_ORIGIN_RANGE.1}
                        }
                    },
                    "angle": {"type": "number", "minimum": -180, "maximum": 180},
                    "spread": {"type": "number", "minimum": 0, "maximum": 360}
                }
            },
            "counterProps": {
                "type": "object", "additionalProperties": false, "required": ["mode"],
                "properties": {"mode": {"enum": ["countdown", "countup"]}, "format": {"enum": ["s", "mm:ss", "hh:mm:ss"]}}
            },
            "drawStroke": {
                "type": "object", "additionalProperties": false, "required": ["points"],
                "properties": {"points": {"type": "array", "items": {"type": "array", "items": {"type": "number", "minimum": 0, "maximum": 100}, "minItems": 2, "maxItems": 2}}}
            },
            "drawProps": {
                "type": "object", "additionalProperties": false, "required": ["brush", "color", "size"],
                "properties": {
                    "brush": {"enum": ["round", "sliced"]}, "color": {"type": "string"},
                    "size": {"type": "number", "minimum": 1, "maximum": 40},
                    "alpha": {"type": "number", "minimum": 0, "maximum": 1},
                    "strokes": {"type": "array", "maxItems": 256, "items": {"$ref": "#/$defs/drawStroke"}}
                }
            },
            "placeholderProps": {
                "type": "object", "additionalProperties": false, "required": ["variant"],
                "properties": {"variant": {"enum": ["camera", "media", "screen"]}, "notes": {"type": "string", "maxLength": 2048}}
            },
            "tile": {
                "type": "object", "additionalProperties": false, "required": ["on"],
                "properties": {"on": {"type": "boolean"}, "angle": {"type": "number"}, "gapX": {"type": "number"}, "gapY": {"type": "number"}, "stagger": {"type": "boolean"}}
            },
            "mask": {
                "type": "object", "additionalProperties": false, "required": ["shape"],
                "properties": {"shape": {"const": "ellipse"}, "feather": {"type": "number"}}
            },
            "fx": {
                "type": "object", "additionalProperties": false,
                "properties": {
                    "grayscale": {"type": "number", "minimum": 0, "maximum": 1}, "blur": {"type": "number", "minimum": 0, "maximum": 100},
                    "brightness": {"type": "number", "minimum": -1, "maximum": 1}, "contrast": {"type": "number", "minimum": -1, "maximum": 1},
                    "exposure": {"type": "number", "minimum": -1, "maximum": 1}, "hue": {"type": "number", "minimum": -1, "maximum": 1},
                    "saturation": {"type": "number", "minimum": -1, "maximum": 1}, "sharpen": {"type": "number", "minimum": 0, "maximum": 1},
                    "noise": {"type": "number", "minimum": 0, "maximum": 1}, "vignette": {"type": "number", "minimum": 0, "maximum": 1},
                    "filterPreset": {"enum": FILTER_PRESETS}, "effectPreset": {"enum": EFFECT_PRESETS},
                    "effectIntensity": {"type": "number", "minimum": 0, "maximum": 1}
                }
            },
            "enterAnimation": {
                "type": "object", "additionalProperties": false, "required": ["preset"],
                "properties": {
                    "preset": {"enum": ENTER_PRESETS}, "presetVersion": {"type": "integer", "minimum": 1},
                    "dur": {"type": "number", "minimum": 0.1, "maximum": 2.0}, "delay": {"type": "number"},
                    "intensity": {"type": "number", "minimum": 0, "maximum": 1}, "ease": {"enum": EASE_NAMES},
                    "stagger": {"type": "number", "exclusiveMinimum": 0}, "staggerFrom": {"enum": ["start", "end", "center"]},
                    "period": {"type": "number", "minimum": 0.2, "maximum": 6.0}, "phase": {"type": "number"}, "seed": {"type": "integer", "minimum": 0}
                }
            },
            "exitAnimation": {
                "type": "object", "additionalProperties": false, "required": ["preset"],
                "properties": {
                    "preset": {"enum": exit_presets_accepted}, "presetVersion": {"type": "integer", "minimum": 1},
                    "dur": {"type": "number", "minimum": 0.1, "maximum": 2.0}, "delay": {"type": "number"},
                    "intensity": {"type": "number", "minimum": 0, "maximum": 1}, "ease": {"enum": EASE_NAMES},
                    "stagger": {"type": "number", "exclusiveMinimum": 0}, "staggerFrom": {"enum": ["start", "end", "center"]},
                    "period": {"type": "number", "minimum": 0.2, "maximum": 6.0}, "phase": {"type": "number"}, "seed": {"type": "integer", "minimum": 0}
                }
            },
            "loopAnimation": {
                "type": "object", "additionalProperties": false, "required": ["preset"],
                "properties": {
                    "preset": {"enum": LOOP_PRESETS}, "presetVersion": {"type": "integer", "minimum": 1},
                    "dur": {"type": "number", "minimum": 0.1, "maximum": 2.0}, "delay": {"type": "number"},
                    "intensity": {"type": "number", "minimum": 0, "maximum": 1}, "ease": {"enum": EASE_NAMES},
                    "period": {"type": "number", "minimum": 0.2, "maximum": 6.0}, "phase": {"type": "number"}, "seed": {"type": "integer", "minimum": 0}
                }
            },
            "animation": {
                "type": "object", "additionalProperties": false,
                "properties": {"enter": {"$ref": "#/$defs/enterAnimation"}, "exit": {"$ref": "#/$defs/exitAnimation"}, "loop": {"$ref": "#/$defs/loopAnimation"}}
            },
            "videoTransition": {
                "type": "object", "additionalProperties": false, "required": ["k"],
                "properties": {"k": {"enum": crate::video_transitions::PRESETS}, "dur": {"type": "number", "minimum": 0.1, "maximum": 2.0, "default": 0.5}}
            },
            "videoTransitions": {
                "type": "object", "additionalProperties": false,
                "properties": {"in": {"$ref": "#/$defs/videoTransition"}, "out": {"$ref": "#/$defs/videoTransition"}}
            },
            "element": {
                "type": "object", "additionalProperties": false, "required": ["id", "kind"],
                "properties": {
                    "id": {"type": "string"}, "kind": {"enum": ELEMENT_KINDS}, "name": {"type": "string"},
                    "role": {"enum": ["broll", "watermark", "screentext", "overlay", "frame"]}, "start": {"$ref": "#/$defs/timeValue"}, "end": {"$ref": "#/$defs/timeValue"},
                    "place": {"$ref": "#/$defs/place"}, "verticalAlign": {"enum": ["top", "center", "bottom"]}, "srcId": {"type": "string"}, "srcStart": {"type": "number", "minimum": 0}, "rate": {"type": "number", "exclusiveMinimum": 0}, "muted": {"type": "boolean"}, "volume": {"type": "number"}, "audioFadeIn": {"type": "number", "minimum": 0, "maximum": 5}, "audioFadeOut": {"type": "number", "minimum": 0, "maximum": 5}, "bcfClip": {"type": "string", "minLength": 1},
                    "mode": {"enum": ["fullscreen", "pip"]}, "fit": {"enum": ["cover", "contain"]}, "bg": {"$ref": "#/$defs/background"},
                    "text": {"type": "string"}, "counter": {"$ref": "#/$defs/counterProps"}, "style": {"type": "object"}, "stylePresetId": {"type": "string"}, "source": {"enum": ["file", "html"]}, "html": {"type": "string"}, "tile": {"$ref": "#/$defs/tile"}, "mask": {"$ref": "#/$defs/mask"}, "fx": {"$ref": "#/$defs/fx"}, "animate": {"$ref": "#/$defs/animation"}, "ai": {"type": "object"},
                    "shape": {"$ref": "#/$defs/shapeProps"}, "sticker": {"$ref": "#/$defs/stickerProps"}, "visualizer": {"$ref": "#/$defs/visualizerProps"}, "progress": {"$ref": "#/$defs/progressProps"}, "draw": {"$ref": "#/$defs/drawProps"}, "placeholder": {"$ref": "#/$defs/placeholderProps"}, "confetti": {"$ref": "#/$defs/confettiProps"}, "whiteboard": {"$ref": "#/$defs/whiteboardProps"},
                    "hidden": {"type": "boolean"}, "transitions": {"$ref": "#/$defs/videoTransitions"},
                    "keyframes": {"$ref": "#/$defs/keyframes"}, "duck": {"$ref": "#/$defs/duck"}
                },
                "allOf": [
                    {"if": {"required": ["transitions"]}, "then": {"properties": {"kind": {"const": "video"}}}},
                    {"if": {"properties": {"kind": {"const": "text"}}, "required": ["kind"]}, "then": {"oneOf": [{"required": ["text"], "not": {"required": ["counter"]}}, {"required": ["counter"], "not": {"required": ["text"]}}]}},
                    {"if": {"properties": {"kind": {"enum": ["image", "video", "audio", "whiteboard"]}}, "required": ["kind"]}, "then": {"required": ["srcId"]}},
                    // element-props-mismatch: kind corresponds one-to-one with the eight props groups (§5.1; confetti added in 0.6, whiteboard added in 0.8).
                    {"if": {"properties": {"kind": {"const": "shape"}}, "required": ["kind"]},
                     "then": {"required": ["shape"], "not": {"anyOf": [{"required": ["sticker"]}, {"required": ["visualizer"]}, {"required": ["progress"]}, {"required": ["draw"]}, {"required": ["placeholder"]}, {"required": ["confetti"]}, {"required": ["whiteboard"]}]}}},
                    {"if": {"properties": {"kind": {"const": "sticker"}}, "required": ["kind"]},
                     "then": {"required": ["sticker"], "not": {"anyOf": [{"required": ["shape"]}, {"required": ["visualizer"]}, {"required": ["progress"]}, {"required": ["draw"]}, {"required": ["placeholder"]}, {"required": ["confetti"]}, {"required": ["whiteboard"]}]}}},
                    {"if": {"properties": {"kind": {"const": "visualizer"}}, "required": ["kind"]},
                     "then": {"required": ["visualizer"], "not": {"anyOf": [{"required": ["shape"]}, {"required": ["sticker"]}, {"required": ["progress"]}, {"required": ["draw"]}, {"required": ["placeholder"]}, {"required": ["confetti"]}, {"required": ["whiteboard"]}]}}},
                    {"if": {"properties": {"kind": {"const": "progress"}}, "required": ["kind"]},
                     "then": {"required": ["progress"], "not": {"anyOf": [{"required": ["shape"]}, {"required": ["sticker"]}, {"required": ["visualizer"]}, {"required": ["draw"]}, {"required": ["placeholder"]}, {"required": ["confetti"]}, {"required": ["whiteboard"]}]}}},
                    {"if": {"properties": {"kind": {"const": "draw"}}, "required": ["kind"]},
                     "then": {"required": ["draw"], "not": {"anyOf": [{"required": ["shape"]}, {"required": ["sticker"]}, {"required": ["visualizer"]}, {"required": ["progress"]}, {"required": ["placeholder"]}, {"required": ["confetti"]}, {"required": ["whiteboard"]}]}}},
                    {"if": {"properties": {"kind": {"const": "placeholder"}}, "required": ["kind"]},
                     "then": {"required": ["placeholder"], "not": {"anyOf": [{"required": ["shape"]}, {"required": ["sticker"]}, {"required": ["visualizer"]}, {"required": ["progress"]}, {"required": ["draw"]}, {"required": ["confetti"]}, {"required": ["whiteboard"]}]}}},
                    {"if": {"properties": {"kind": {"const": "confetti"}}, "required": ["kind"]},
                     "then": {"required": ["confetti"], "not": {"anyOf": [{"required": ["shape"]}, {"required": ["sticker"]}, {"required": ["visualizer"]}, {"required": ["progress"]}, {"required": ["draw"]}, {"required": ["placeholder"]}, {"required": ["whiteboard"]}]}}},
                    {"if": {"properties": {"kind": {"const": "whiteboard"}}, "required": ["kind"]},
                     "then": {"required": ["whiteboard"], "not": {"anyOf": [{"required": ["shape"]}, {"required": ["sticker"]}, {"required": ["visualizer"]}, {"required": ["progress"]}, {"required": ["draw"]}, {"required": ["placeholder"]}, {"required": ["confetti"]}]}}},
                    {"if": {"properties": {"kind": {"enum": ["text", "image", "video", "audio"]}}, "required": ["kind"]},
                     "then": {"not": {"anyOf": [{"required": ["shape"]}, {"required": ["sticker"]}, {"required": ["visualizer"]}, {"required": ["progress"]}, {"required": ["draw"]}, {"required": ["placeholder"]}, {"required": ["confetti"]}, {"required": ["whiteboard"]}]}}}
                ]
            },
            "track": {
                "type": "object", "additionalProperties": false, "required": ["id", "kind"],
                "properties": {"id": {"type": "string"}, "kind": {"enum": ["overlay", "audio"]}, "name": {"type": "string"}, "hidden": {"type": "boolean"}, "locked": {"type": "boolean"}, "muted": {"type": "boolean"}, "elements": {"type": "array", "items": {"$ref": "#/$defs/element"}}}
            },
            "main": {
                "type": "object", "additionalProperties": false,
                "properties": {"detached": {"type": "boolean"}, "place": {"$ref": "#/$defs/place"}, "muted": {"type": "boolean"}, "background": {"$ref": "#/$defs/background"}, "sourceDuration": {"type": "number", "exclusiveMinimum": 0}}
            },
            "background": {
                "anyOf": [
                    {"enum": ["blur", "black"]},
                    {"type": "string", "pattern": "^#[0-9A-Fa-f]{6}$"}
                ]
            },
            "keyframe": {
                "type": "object", "additionalProperties": false, "required": ["t", "v"],
                "properties": {
                    "t": {"oneOf": [
                        {"type": "number", "minimum": 0},
                        {"type": "string", "pattern": "^(?:\\d+(?:\\.\\d+)?|\\.\\d+)%$"}
                    ]},
                    "v": {"type": "number"},
                    "ease": {"enum": EASE_NAMES}
                }
            },
            "keyframeTrack": {"type": "array", "minItems": 1, "maxItems": crate::keyframes::KEYFRAMES_MAX_PER_PROP, "items": {"$ref": "#/$defs/keyframe"}},
            "keyframes": {
                "type": "object", "additionalProperties": false, "minProperties": 1,
                "properties": {
                    "x": {"$ref": "#/$defs/keyframeTrack"}, "y": {"$ref": "#/$defs/keyframeTrack"},
                    "scale": {"$ref": "#/$defs/keyframeTrack"}, "scaleY": {"$ref": "#/$defs/keyframeTrack"},
                    "rot": {"$ref": "#/$defs/keyframeTrack"}, "opacity": {"$ref": "#/$defs/keyframeTrack"},
                    "radius": {"$ref": "#/$defs/keyframeTrack"}, "volume": {"$ref": "#/$defs/keyframeTrack"}
                }
            },
            "duck": {
                "type": "object", "additionalProperties": false, "required": ["under"],
                "properties": {
                    "under": {"type": "string", "minLength": 1},
                    "depth": {"type": "number", "minimum": crate::duck::DUCK_DEPTH_RANGE.0, "maximum": crate::duck::DUCK_DEPTH_RANGE.1, "default": crate::duck::DUCK_DEPTH_DEFAULT},
                    "attack": {"type": "number", "minimum": crate::duck::DUCK_TIME_RANGE.0, "maximum": crate::duck::DUCK_TIME_RANGE.1, "default": crate::duck::DUCK_ATTACK_DEFAULT},
                    "release": {"type": "number", "minimum": crate::duck::DUCK_TIME_RANGE.0, "maximum": crate::duck::DUCK_TIME_RANGE.1, "default": crate::duck::DUCK_RELEASE_DEFAULT}
                }
            },
            "color": {"type": "string", "pattern": "^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$"},
            "layerBox": {
                "type": "object", "additionalProperties": false, "required": ["x", "y", "w", "h"],
                "properties": {"x": {"type": "number", "minimum": 0, "maximum": 100}, "y": {"type": "number", "minimum": 0, "maximum": 100}, "w": {"type": "number", "minimum": 4, "maximum": 100}, "h": {"type": "number", "minimum": 0.6, "maximum": 100}}
            },
            "logoSrc": {
                "oneOf": [
                    {"const": "text"},
                    {"type": "object", "additionalProperties": false, "required": ["brandLogo"], "properties": {"brandLogo": {"type": "string"}}},
                    {"type": "object", "additionalProperties": false, "required": ["file"], "properties": {"file": {"type": "string"}}}
                ]
            },
            "templateLayer": {
                "type": "object", "required": ["id", "kind", "box"],
                "properties": {
                    "id": {"type": "string"}, "on": {"type": "boolean", "default": true}, "box": {"$ref": "#/$defs/layerBox"},
                    "kind": {"enum": ["chapters", "progress", "logo", "text"]}
                },
                "allOf": [
                    {"if": {"properties": {"kind": {"const": "chapters"}}, "required": ["kind"]},
                     "then": {"required": ["bg", "color", "accent"], "properties": {"fill": {"enum": ["bar", "dim"], "default": "bar"}, "bg": {"$ref": "#/$defs/color"}, "color": {"$ref": "#/$defs/color"}, "accent": {"$ref": "#/$defs/color"}, "colorDone": {"$ref": "#/$defs/color"}, "divider": {"type": "boolean", "default": true}, "size": {"type": "number", "exclusiveMinimum": 0, "default": 2.6}}}},
                    {"if": {"properties": {"kind": {"const": "progress"}}, "required": ["kind"]},
                     "then": {"required": ["accent", "track"], "properties": {"accent": {"$ref": "#/$defs/color"}, "track": {"$ref": "#/$defs/color"}}}},
                    {"if": {"properties": {"kind": {"const": "logo"}}, "required": ["kind"]},
                     "then": {"required": ["color"], "properties": {"src": {"$ref": "#/$defs/logoSrc"}, "text": {"type": "string"}, "bg": {"$ref": "#/$defs/color"}, "color": {"$ref": "#/$defs/color"}, "shape": {"enum": ["badge", "plain"], "default": "badge"}, "align": {"enum": ["left", "center", "right"], "default": "center"}, "size": {"type": "number", "exclusiveMinimum": 0, "default": 3}, "pad": {"type": "number", "minimum": 0}}}},
                    {"if": {"properties": {"kind": {"const": "text"}}, "required": ["kind"]},
                     "then": {"required": ["text", "color"], "properties": {"text": {"type": "string"}, "color": {"$ref": "#/$defs/color"}, "bg": {"$ref": "#/$defs/color"}, "align": {"enum": ["left", "center", "right"], "default": "left"}, "size": {"type": "number", "exclusiveMinimum": 0, "default": 2.8}, "pad": {"type": "number", "minimum": 0}, "mono": {"type": "boolean", "default": false}, "weight": {"type": "integer", "minimum": 100, "maximum": 900, "default": 700}}}}
                ]
            },
            "template": {
                "type": "object", "required": ["id", "name"],
                "properties": {
                    "id": {"type": "string"}, "name": {"type": "string"},
                    "hue": {"enum": crate::template::HUES, "default": "gray"},
                    "canvas": {"enum": ["16:9", "9:16"], "default": "16:9"},
                    "ratio": {"type": "string", "description": "套用时把项目画幅改成 original 或 W:H；缺省不改"},
                    "lockRatio": {"type": "boolean", "default": false, "description": "与 ratio 同时为真时锁住项目画幅：舞台 / 项目设置 / ccut project canvas 只允许改成 ratio 本身"},
                    "builtin": {"type": "boolean", "default": false},
                    "desc": {"type": "string"},
                    "font": {"type": "string"},
                    "from": {"type": "string"},
                    "subsAvoid": {"type": "boolean", "default": true},
                    "layers": {"type": "array", "items": {"$ref": "#/$defs/templateLayer"}}
                }
            }
        }
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The quantization ruling of §4: floating-point differences such as `end − time` carry residue, and the direction follows each end's own floating-point representation (`8.05 − 1.05 = 7.000000000000001`, nudged up; `34.12 − 25.12 =
    /// 8.999999999999996`, nudged down). A bare `ceil` would read one second too many in the former case, and the three surfaces could give different readouts on the same frame. On the millisecond grid, boundary ownership is unambiguous.
    #[test]
    fn counter_boundaries_are_judged_on_the_millisecond_grid() {
        // The premise really holds: for this pair, the bare floating-point difference lifts 7 to 8.
        assert_eq!((8.05_f64 - 1.05_f64).ceil(), 8.0);
        let countdown = CounterProps {
            mode: CounterMode::Countdown,
            format: CounterFormat::Seconds,
        };
        assert_eq!(countdown.value_at(1.05, 8.05, 1.05), 7);
        // The §3.1 example of 24.12…34.12: the start reads the full length, it counts down second by second in the middle, and near the end it reads 1 (0 falls outside the window and is cut off by the half-open window, ADR-CT02).
        assert_eq!(countdown.value_at(24.12, 34.12, 24.12), 10);
        assert_eq!(countdown.value_at(24.12, 34.12, 25.12), 9);
        assert_eq!(countdown.value_at(24.12, 34.12, 34.0), 1);
        let countup = CounterProps {
            mode: CounterMode::Countup,
            format: CounterFormat::MinutesSeconds,
        };
        assert_eq!(countup.value_at(24.12, 34.12, 25.12), 1);
        assert_eq!(countup.text_at(24.12, 34.12, 25.12), "00:01");
        // `mm:ss` does not carry over into hours (§3). Once this format is chosen, an hours segment must not suddenly appear.
        assert_eq!(countup.text_at(0.0, 7000.0, 6000.0), "100:00");
    }

    /// In a blank project, first `clip add` the narration and then transcribe the same file as the project media. The main-track clip points at the duplicate source, the transcript words of `main` have no carrying clip, and the subtitles disappear from the whole layer. Audio/video sources with the same hash are merged back into `main`. Image sources, other files, and sources where both sides have cuts are left alone.
    #[test]
    fn a_source_identical_to_the_project_media_folds_back_into_main() {
        let mut document: TimelineDocument = serde_json::from_value(json!({
            "ccutTimeline": TIMELINE_VERSION,
            "sources": {
                "src-a1": {"path": "/a/narration.wav", "hash": "sha256-same", "kind": "audio",
                           "duration": 10.0, "cuts": [{"id": "cut-1", "t0": 1.0, "t1": 2.0}]},
                "src-a2": {"path": "/a/other.wav", "hash": "sha256-other", "kind": "audio", "duration": 5.0},
                "src-a3": {"path": "/a/board.png", "hash": "sha256-same", "kind": "image"}
            },
            "clips": [
                {"id": "c2", "srcId": "src-a1", "in": 0.0, "out": 10.0},
                {"id": "c3", "srcId": "src-a2", "in": 0.0, "out": 5.0}
            ]
        }))
        .unwrap();
        document.validate().unwrap();

        assert!(document.fold_main_duplicates(None).is_empty());
        assert_eq!(
            document.fold_main_duplicates(Some("sha256-same")),
            vec!["src-a1"]
        );
        document.validate().unwrap();
        assert_eq!(document.clips[0].src_id, "main");
        assert_eq!(document.clips[1].src_id, "src-a2");
        assert!(!document.sources.contains_key("src-a1"));
        assert!(document.sources.contains_key("src-a3"));
        assert_eq!(document.sources["main"].cuts[0].id, "cut-1");
        // Idempotent: running it again changes nothing.
        assert!(
            document
                .fold_main_duplicates(Some("sha256-same"))
                .is_empty()
        );
    }

    /// After `EASE_NAMES` moved to `motion::curve`, the Timeline JSON Schema contract must not move: the `timelineSchema` from `ccut spec` is a public commitment.
    #[test]
    fn the_ease_enum_in_the_schema_is_the_frozen_appendix_a_table() {
        let expected = json!([
            "linear",
            "easeInQuad",
            "easeOutQuad",
            "easeInOutQuad",
            "easeInCubic",
            "easeOutCubic",
            "easeInOutCubic",
            "easeInQuart",
            "easeOutQuart",
            "easeInOutQuart",
            "easeInExpo",
            "easeOutExpo",
            "easeInOutExpo",
            "easeInSine",
            "easeOutSine",
            "easeInOutSine",
            "easeInBack",
            "easeOutBack",
            "easeInOutBack",
            "easeOutElastic"
        ]);
        assert_eq!(json!(EASE_NAMES), expected);
        let schema = schema_json();
        for slot in ["enterAnimation", "exitAnimation", "loopAnimation"] {
            assert_eq!(
                schema["$defs"][slot]["properties"]["ease"],
                json!({ "enum": EASE_NAMES }),
                "{slot}"
            );
        }
    }

    /// Each of the three slots checks its own vocabulary. Exit accepts `sink` (before round 156, validation borrowing the enter vocabulary would reject it), the 0.1 compatibility name `pop` is still readable, and `wave` is rejected by the exit slot because it only has an enter recipe.
    #[test]
    fn each_animation_slot_validates_against_its_own_vocabulary() {
        let schema = schema_json();
        assert!(
            schema["$defs"]["enterAnimation"]["properties"]["preset"]["enum"]
                .as_array()
                .unwrap()
                .iter()
                .any(|v| v == "wave")
        );
        let exit_enum = schema["$defs"]["exitAnimation"]["properties"]["preset"]["enum"]
            .as_array()
            .unwrap()
            .clone();
        assert!(exit_enum.iter().any(|v| v == "sink"));
        assert!(exit_enum.iter().any(|v| v == "pop"));
        assert!(!exit_enum.iter().any(|v| v == "wave"));
        let slot = |preset: &str| AnimationSlot {
            preset: preset.to_owned(),
            preset_version: None,
            dur: None,
            delay: None,
            intensity: None,
            ease: None,
            stagger: None,
            stagger_from: None,
            period: None,
            phase: None,
            seed: None,
        };
        let anim = |enter: Option<&str>, exit: Option<&str>| Animation {
            enter: enter.map(slot),
            exit: exit.map(slot),
            r#loop: None,
        };
        assert!(anim(Some("rise"), Some("sink")).validate("el-14").is_ok());
        assert!(anim(None, Some("pop")).validate("el-14").is_ok());
        assert!(anim(Some("sink"), None).validate("el-14").is_err());
        assert!(anim(None, Some("wave")).validate("el-14").is_err());
    }

    #[test]
    fn minimal_document_round_trips_and_unknown_fields_fail() {
        let document: TimelineDocument = serde_json::from_str(r#"{"ccutTimeline":"0.1"}"#).unwrap();
        assert_eq!(document, TimelineDocument::default());
        document.validate().unwrap();
        assert!(
            serde_json::from_str::<TimelineDocument>(r#"{"ccutTimeline":"0.1","unknown":true}"#)
                .is_err()
        );
    }

    /// 0.11: AI-generated assets carry `origin: "ai"` and a provenance sidecar path. When defaulted, not a single key is written, so an old document differs from its read-and-written output only in the version number.
    #[test]
    fn ai_sources_round_trip_origin_and_provenance() {
        let text = format!(
            r#"{{"ccutTimeline":"{TIMELINE_VERSION}","sources":{{"ai1":{{"path":"assets/图片-001-glm-image-7.png","kind":"image","naturalW":1024,"naturalH":1024,"origin":"ai","provenance":"assets/图片-001-glm-image-7.json"}},"s2":{{"path":"b.png","kind":"image"}}}}}}"#
        );
        let doc: TimelineDocument = serde_json::from_str(&text).unwrap();
        doc.validate().unwrap();
        let ai = &doc.sources["ai1"];
        assert_eq!(ai.origin.as_deref(), Some("ai"));
        assert_eq!(
            ai.provenance.as_deref(),
            Some("assets/图片-001-glm-image-7.json")
        );
        assert_eq!(serde_json::to_string(&doc).unwrap(), text);
        let plain = serde_json::to_value(&doc.sources["s2"]).unwrap();
        assert!(plain.get("origin").is_none() && plain.get("provenance").is_none());

        for (field, value) in [("origin", json!("stock")), ("provenance", json!(" "))] {
            let mut bad = serde_json::to_value(&doc).unwrap();
            bad["sources"]["ai1"][field] = value;
            let bad: TimelineDocument = serde_json::from_value(bad).unwrap();
            assert!(bad.validate().is_err(), "{field} 应被拒");
        }
        let schema = schema_json();
        assert_eq!(
            schema["$defs"]["source"]["properties"]["origin"],
            json!({"enum": ["ai"]})
        );
    }

    /// `element` is constrained by both `deny_unknown_fields` and the schema's `additionalProperties: false`, and the two must move together. If the hand-written schema misses a field, a document that Rust accepts would be rejected as invalid by the `timelineSchema` from `ccut spec`.
    #[test]
    fn the_element_schema_carries_the_vertical_anchor_the_struct_accepts() {
        let element: Element = serde_json::from_str(
            r#"{"id":"e1","kind":"text","text":"hi","verticalAlign":"bottom"}"#,
        )
        .unwrap();
        assert_eq!(element.vertical_align.as_deref(), Some("bottom"));
        assert_eq!(
            schema_json()["$defs"]["element"]["properties"]["verticalAlign"],
            json!({"enum": ["top", "center", "bottom"]})
        );
    }

    #[test]
    fn html_watermark_provenance_is_validated_and_present_in_schema() {
        let element: Element = serde_json::from_str(
            r#"{"id":"e1","kind":"image","srcId":"src-a1","source":"html","html":"<b>hi</b>"}"#,
        )
        .unwrap();
        let mut ids = HashSet::new();
        element.validate(&mut ids).unwrap();
        assert_eq!(
            schema_json()["$defs"]["element"]["properties"]["source"],
            json!({"enum": ["file", "html"]})
        );
        assert_eq!(
            schema_json()["$defs"]["element"]["properties"]["html"],
            json!({"type": "string"})
        );

        let invalid: Element = serde_json::from_str(
            r#"{"id":"e2","kind":"image","srcId":"src-a2","source":"file","html":"<b>hi</b>"}"#,
        )
        .unwrap();
        assert!(invalid.validate(&mut HashSet::new()).is_err());

        let invalid_source: Element = serde_json::from_str(
            r#"{"id":"e3","kind":"image","srcId":"src-a3","source":"remote"}"#,
        )
        .unwrap();
        assert!(invalid_source.validate(&mut HashSet::new()).is_err());
    }

    #[test]
    fn text_watermark_is_a_valid_role_kind_pair() {
        let element: Element = serde_json::from_str(
            r#"{"id":"wm-text","kind":"text","role":"watermark","text":"CucCut"}"#,
        )
        .unwrap();
        element.validate(&mut HashSet::new()).unwrap();
    }

    #[test]
    fn timeline_0_1_explicitly_rejects_unversioned_clip_transitions() {
        for field in ["transitionIn", "transitionOut"] {
            let source = format!(
                r#"{{
                    "ccutTimeline":"0.1",
                    "clips":[{{
                        "id":"c1","in":0.0,"out":1.0,
                        "{field}":{{"preset":"fade","duration":0.25}}
                    }}]
                }}"#,
            );
            let error = serde_json::from_str::<TimelineDocument>(&source).unwrap_err();
            assert!(error.to_string().contains(field), "{field}: {error}");
        }
    }

    /// 0.7 Lottie source: `sources[].kind:"lottie"` round-trips, and only asset stickers may reference it. A main-track clip, or an image / video / audio element referencing it, raises an error at validation time.
    #[test]
    fn lottie_sources_are_only_referenced_by_asset_stickers() {
        let source: Source = serde_json::from_str(
            r#"{"path":"anim.json","kind":"lottie","duration":2.0,"naturalW":200,"naturalH":200,"hasAudio":false}"#,
        )
        .unwrap();
        assert_eq!(source.kind, Some(SourceKind::Lottie));
        assert_eq!(
            serde_json::to_value(SourceKind::Lottie).unwrap(),
            json!("lottie")
        );
        assert_eq!(
            schema_json()["$defs"]["source"]["properties"]["kind"],
            json!({"enum": ["video", "image", "audio", "lottie"]})
        );

        let with_element = |element: &str| -> String {
            format!(
                r#"{{"ccutTimeline":"0.7","sources":{{"s1":{{"path":"anim.json","kind":"lottie","duration":2.0}}}},"tracks":[{{"id":"t1","kind":"overlay","elements":[{element}]}}]}}"#
            )
        };
        let ok: TimelineDocument = serde_json::from_str(&with_element(
            r#"{"id":"e1","kind":"sticker","srcId":"s1","sticker":{"source":"asset","loop":"once"}}"#,
        ))
        .unwrap();
        ok.validate().unwrap();
        assert!(ok.tracks[0].elements[0].is_asset_sticker());

        for (element, why) in [
            (
                r#"{"id":"e1","kind":"image","srcId":"s1"}"#,
                "image 元素不能引用 lottie",
            ),
            (
                r#"{"id":"e1","kind":"video","srcId":"s1"}"#,
                "video 元素不能引用 lottie",
            ),
            (
                r#"{"id":"e1","kind":"placeholder","srcId":"s1","placeholder":{"variant":"camera"}}"#,
                "placeholder 不能引用 lottie",
            ),
            (
                r#"{"id":"e1","kind":"sticker","srcId":"s1","sticker":{"source":"template","templateId":"box"}}"#,
                "模板贴纸不能引用 lottie",
            ),
        ] {
            let document: TimelineDocument = serde_json::from_str(&with_element(element)).unwrap();
            let error = document.validate().unwrap_err();
            assert!(error.to_string().contains("lottie"), "{why}: {error}");
        }

        let clip: TimelineDocument = serde_json::from_str(
            r#"{"ccutTimeline":"0.7","sources":{"s1":{"path":"anim.json","kind":"lottie","duration":2.0}},"clips":[{"id":"c1","srcId":"s1","in":0.0,"out":1.0}]}"#,
        )
        .unwrap();
        let error = clip.validate().unwrap_err();
        assert!(error.to_string().contains("lottie"), "{error}");
    }

    #[test]
    fn main_rejects_duplicated_media_identity() {
        let document: TimelineDocument = serde_json::from_str(
            r#"{"ccutTimeline":"0.1","sources":{"main":{"path":"movie.mp4"}}}"#,
        )
        .unwrap();
        assert!(document.validate().is_err());
    }

    // ── 0.2 element contract (design §5) ─────────────────────────────────────────

    fn element(json: &str) -> Element {
        serde_json::from_str(json).unwrap()
    }

    /// Round-trip of the 11-value enum: the serde names, `as_str()` and the JSON Schema enum are **one and the same table**. If any one of the three misses a value, the other two become inaccurate.
    #[test]
    fn the_element_kind_enum_round_trips_all_twelve_values() {
        let kinds = [
            ElementKind::Text,
            ElementKind::Image,
            ElementKind::Video,
            ElementKind::Audio,
            ElementKind::Shape,
            ElementKind::Sticker,
            ElementKind::Visualizer,
            ElementKind::Progress,
            ElementKind::Draw,
            ElementKind::Placeholder,
            ElementKind::Confetti,
            ElementKind::Whiteboard,
        ];
        assert_eq!(kinds.len(), ELEMENT_KINDS.len());
        for (kind, name) in kinds.into_iter().zip(ELEMENT_KINDS) {
            assert_eq!(kind.as_str(), *name);
            assert_eq!(serde_json::to_value(kind).unwrap(), json!(name));
            assert_eq!(
                serde_json::from_value::<ElementKind>(json!(name)).unwrap(),
                kind
            );
        }
        assert_eq!(
            schema_json()["$defs"]["element"]["properties"]["kind"],
            json!({"enum": ELEMENT_KINDS})
        );
        // Closed enum: unknown kinds are an error at parse time, and no open enum is used (ADR-E02).
        assert!(serde_json::from_value::<ElementKind>(json!("motion")).is_err());
        assert!(
            serde_json::from_str::<Element>(r#"{"id":"e1","kind":"motion"}"#).is_err(),
            "未知 kind 必须解析期报错"
        );
    }

    /// The serde names of the six props groups are always camelCase, and default fields do not appear in the output.
    #[test]
    fn the_six_props_structs_serialize_as_camel_case() {
        let shape = element(
            r##"{"id":"e1","kind":"shape","shape":{"shape":"rect","fill":"#112233",
                "stroke":"#00000080","strokeWidth":3,"cornerRadius":[1,2,3,4],"h":25,
                "x1":0,"y1":10,"x2":100,"y2":90,"head":"arrow"}}"##,
        );
        let props = shape.shape.as_ref().unwrap();
        assert_eq!(props.shape, "rect");
        assert_eq!(props.stroke_width(), 3.0);
        assert_eq!(props.corner_radius(), [1.0, 2.0, 3.0, 4.0]);
        assert_eq!(props.h, Some(25.0));
        assert_eq!(props.endpoints(), [0.0, 10.0, 100.0, 90.0]);
        assert_eq!(props.head.as_deref(), Some("arrow"));
        let round_tripped = serde_json::to_value(props).unwrap();
        for key in [
            "shape",
            "fill",
            "stroke",
            "strokeWidth",
            "cornerRadius",
            "h",
            "x1",
            "y1",
            "x2",
            "y2",
            "head",
        ] {
            assert!(round_tripped.get(key).is_some(), "缺 {key}");
        }

        let sticker = element(
            r##"{"id":"e2","kind":"sticker","sticker":{"source":"template","templateId":"box","loop":"once","fillOverrides":{"#ffffff":"#112233"}}}"##,
        );
        let props = sticker.sticker.as_ref().unwrap();
        assert_eq!(props.template_id.as_deref(), Some("box"));
        assert_eq!(props.loop_mode(), "once");
        assert_eq!(
            serde_json::to_value(props).unwrap(),
            json!({"source": "template", "templateId": "box", "loop": "once", "fillOverrides": {"#ffffff": "#112233"}})
        );
        // The default loop is not written out; "loop" is filled in at read time.
        assert_eq!(StickerProps::new("asset").loop_mode(), STICKER_LOOP_DEFAULT);
        assert_eq!(
            serde_json::to_value(StickerProps::new("asset")).unwrap(),
            json!({"source": "asset"})
        );

        let visualizer = element(
            r##"{"id":"e3","kind":"visualizer","visualizer":{"style":"bars",
                "mainColor":"#ff0000","secondaryColor":"#00ff00","fftSize":512,
                "minDb":-120,"maxDb":-10,"smoothing":0.5,"gain":1.5,"audio":"src-a",
                "speaker":"spk-1","alwaysShow":false}}"##,
        );
        let props = visualizer.visualizer.as_ref().unwrap();
        assert_eq!(
            (
                props.fft_size(),
                props.min_db(),
                props.max_db(),
                props.smoothing(),
                props.gain(),
                props.audio()
            ),
            (512, -120.0, -10.0, 0.5, 1.5, "src-a")
        );
        assert!(
            serde_json::to_value(props)
                .unwrap()
                .get("fftSize")
                .is_some()
        );
        assert_eq!(props.speaker.as_deref(), Some("spk-1"));
        assert!(!props.always_show());
        // This is the **new-element defaults** group (§5.2).
        let bare = VisualizerProps::new("bars");
        assert_eq!(
            (
                bare.fft_size(),
                bare.min_db(),
                bare.max_db(),
                bare.smoothing(),
                bare.gain(),
                bare.audio()
            ),
            (1024, -80.0, 40.0, 0.8, 1.0, "project")
        );
        assert_eq!(
            serde_json::to_value(&bare).unwrap(),
            json!({"style": "bars"})
        );
        // dB window taken per style: the two oscilloscope styles use −120 / −10, not the table-wide group.
        for style in ["oscilloscope", "ring_wave"] {
            let bare = VisualizerProps::new(style);
            assert_eq!((bare.min_db(), bare.max_db()), (-120.0, -10.0), "{style}");
        }
        assert_eq!(visualizer_db_window("bars"), (-80.0, 40.0));
        // Old style names in old documents are mapped to the new styles via the alias table, and the dB window follows the new style.
        assert_eq!(visualizer_db_window("beam"), (-120.0, -10.0));
        assert_eq!(visualizer_db_window("formation"), (-80.0, 40.0));
        // Styles that cannot be found fall back to the table-wide default (`style` validation catches such an element first).
        assert_eq!(
            visualizer_db_window("nope"),
            (VISUALIZER_MIN_DB_DEFAULT, VISUALIZER_MAX_DB_DEFAULT)
        );
        // An old document that only wrote `minDb` does not become invalid because of the per-style default (validation only looks at the pair that was actually written).
        assert!(
            element(r#"{"id":"e5","kind":"visualizer","visualizer":{"style":"oscilloscope","minDb":-5}}"#)
                .validate(&mut HashSet::new())
                .is_ok()
        );

        let progress = element(
            r##"{"id":"e4","kind":"progress","progress":{"style":"rounded","mainColor":"#fff000","secondaryColor":"#000fff","startProgress":0.8,"endProgress":0.2}}"##,
        );
        assert_eq!(
            serde_json::to_value(progress.progress.as_ref().unwrap()).unwrap(),
            json!({"style": "rounded", "mainColor": "#fff000", "secondaryColor": "#000fff", "startProgress": 0.8, "endProgress": 0.2})
        );
        assert!((progress.progress.as_ref().unwrap().remap(0.25) - 0.65).abs() < 1e-9);

        let draw = element(
            r##"{"id":"e5","kind":"draw","draw":{"brush":"round","color":"#ff000080","size":12,"alpha":0.5,"strokes":[{"points":[[0,0],[50,75],[100,100]]}]}}"##,
        );
        assert_eq!(draw.draw.as_ref().unwrap().strokes[0].points.len(), 3);
        assert!(
            serde_json::to_value(draw.draw.as_ref().unwrap())
                .unwrap()
                .get("strokes")
                .is_some()
        );

        let placeholder = element(
            r#"{"id":"e6","kind":"placeholder","placeholder":{"variant":"screen","notes":"Demo"}}"#,
        );
        assert_eq!(
            serde_json::to_value(placeholder.placeholder.as_ref().unwrap()).unwrap(),
            json!({"variant": "screen", "notes": "Demo"})
        );
        // Each props group also has deny_unknown_fields itself.
        assert!(
            serde_json::from_str::<Element>(
                r#"{"id":"e7","kind":"progress","progress":{"style":"rounded","bars":16}}"#
            )
            .is_err()
        );

        // 0.6 confetti: only fields the user has changed are written; when absent, the recipe default applies. Emit fields that belong to the wrong mode may still be present (so the other side's values are kept when switching modes).
        let confetti = element(
            r##"{"id":"e8","kind":"confetti","confetti":{"style":"rainbow-paper","seed":7391026451,"colors":["#FF476F","#FFCA3A"],"shapes":["rect","strip"],"size":1.25,"gravity":-0.5,"wind":40,"emit":{"mode":"burst","rate":60,"count":80,"interval":0,"settle":true},"origin":{"x":-10,"y":110},"angle":-90,"spread":45}}"##,
        );
        let props = confetti.confetti.as_ref().unwrap();
        assert_eq!(props.seed, Some(7391026451));
        assert_eq!(props.emit_mode(), Some(ConfettiEmitMode::Burst));
        assert_eq!(
            serde_json::to_value(props).unwrap(),
            json!({"style": "rainbow-paper", "seed": 7391026451u64, "colors": ["#FF476F", "#FFCA3A"], "shapes": ["rect", "strip"], "size": 1.25, "gravity": -0.5, "wind": 40.0, "emit": {"mode": "burst", "rate": 60.0, "count": 80.0, "interval": 0.0, "settle": true}, "origin": {"x": -10.0, "y": 110.0}, "angle": -90.0, "spread": 45.0})
        );
        assert_eq!(
            serde_json::to_value(ConfettiProps::new("pastel-fall")).unwrap(),
            json!({"style": "pastel-fall"})
        );
        assert!(
            serde_json::from_str::<Element>(
                r#"{"id":"e9","kind":"confetti","confetti":{"style":"rainbow-paper","emit":{"mode":"loop"}}}"#
            )
            .is_err(),
            "emit.mode 是封闭枚举"
        );
        assert!(
            serde_json::from_str::<Element>(
                r#"{"id":"e9","kind":"confetti","confetti":{"style":"rainbow-paper","density":3}}"#
            )
            .is_err(),
            "confetti props deny_unknown_fields"
        );
    }

    /// `kind` corresponds one-to-one with props. Mismatches in either direction report `element-props-mismatch`.
    #[test]
    fn the_props_are_mutually_exclusive_with_the_kind() {
        for (source, why) in [
            (
                r#"{"id":"e1","kind":"shape"}"#,
                "kind=shape 却没有 shape props",
            ),
            (
                r#"{"id":"e1","kind":"text","text":"hi","shape":{"shape":"rect"}}"#,
                "text 带 shape props",
            ),
            (
                r#"{"id":"e1","kind":"shape","shape":{"shape":"rect"},"progress":{"style":"normal"}}"#,
                "shape 同时带 progress props",
            ),
            (
                r#"{"id":"e1","kind":"visualizer","sticker":{"source":"asset"}}"#,
                "visualizer 带 sticker props",
            ),
            (
                r##"{"id":"e1","kind":"draw","draw":{"brush":"round","color":"#ffffff","size":4},"placeholder":{"variant":"media"}}"##,
                "draw 同时带 placeholder props",
            ),
            (
                r#"{"id":"e1","kind":"confetti"}"#,
                "kind=confetti 却没有 confetti props",
            ),
            (
                r#"{"id":"e1","kind":"sticker","sticker":{"source":"asset","path":"a.png"},"confetti":{"style":"rainbow-paper"}}"#,
                "sticker 同时带 confetti props",
            ),
            (
                r#"{"id":"e1","kind":"confetti","confetti":{"style":"rainbow-paper"},"progress":{"style":"normal"}}"#,
                "confetti 同时带 progress props",
            ),
            (
                r#"{"id":"e1","kind":"whiteboard","srcId":"s1"}"#,
                "kind=whiteboard 却没有 whiteboard props",
            ),
            (
                r#"{"id":"e1","kind":"image","srcId":"s1","whiteboard":{}}"#,
                "image 带 whiteboard props",
            ),
        ] {
            let error = element(source).validate(&mut HashSet::new()).unwrap_err();
            assert!(
                error.to_string().contains(ELEMENT_PROPS_MISMATCH),
                "{why}: {error}"
            );
        }
        // Positive case: the eight kinds, each carrying its own props, pass.
        for source in [
            r#"{"id":"e1","kind":"shape","shape":{"shape":"rect"}}"#,
            r#"{"id":"e1","kind":"sticker","sticker":{"source":"asset","path":"a.png"}}"#,
            r#"{"id":"e1","kind":"visualizer","visualizer":{"style":"bars"}}"#,
            r#"{"id":"e1","kind":"progress","progress":{"style":"normal"}}"#,
            r##"{"id":"e1","kind":"draw","draw":{"brush":"sliced","color":"#ffffff","size":1}}"##,
            r#"{"id":"e1","kind":"placeholder","placeholder":{"variant":"camera"}}"#,
            r#"{"id":"e1","kind":"confetti","confetti":{"style":"rainbow-paper"}}"#,
            r##"{"id":"e1","kind":"whiteboard","srcId":"s1","whiteboard":{"hand":"pen","paper":"#F5EBD7","draw":4,"inkFirst":false,"beats":[{"at":0,"box":[0,0,50,100]},{"at":2,"box":[50,0,50,100]}]}}"##,
            // Whiteboard follows the same route as image: mode / fit / mask / fx are all accepted (`ccut element add --mode fullscreen`).
            r#"{"id":"e1","kind":"whiteboard","srcId":"s1","mode":"fullscreen","fit":"contain","mask":{"shape":"ellipse"},"fx":{"grayscale":1},"whiteboard":{}}"#,
        ] {
            element(source).validate(&mut HashSet::new()).unwrap();
        }
    }

    /// Timeline 0.9 whiteboard beats: `pace` / `strict` / `end` / `label`, and the word-anchor form of `at` / `end`. The 0.8 numeric form is read in as-is (default = the old behaviour), and an element without new fields differs from 0.8 on output only in the version.
    #[test]
    fn whiteboard_beats_accept_0_9_fields_and_word_anchors() {
        let source = r##"{"id":"e1","kind":"whiteboard","srcId":"s1","whiteboard":{"draw":9.2,"pace":"natural","strict":true,"beats":[{"at":"~main:g1.1:start","end":"~main:g1.4:end","box":[0,0,50,100],"label":"第一步"},{"at":3.2,"end":6.3,"box":[50,0,50,100]},{"at":"~main:g2.1:start","box":[0,50,100,50]}]}}"##;
        let parsed = element(source);
        parsed.validate(&mut HashSet::new()).unwrap();
        let props = parsed.whiteboard.as_ref().unwrap();
        assert_eq!(props.pace(), WhiteboardPace::Natural);
        assert!(props.strict());
        let beats = props.beats.as_ref().unwrap();
        assert!(beats[0].is_anchored());
        assert_eq!(beats[0].at_local(), None);
        assert_eq!(beats[0].label.as_deref(), Some("第一步"));
        assert_eq!(beats[1].at_local(), Some(3.2));
        assert_eq!(beats[1].end_local(), Some(6.3));
        assert!(!beats[1].is_anchored());
        assert!(beats[2].end.is_none());
        // Round trip: fields unchanged, absent keys not written out
        let value = serde_json::to_value(&parsed).unwrap();
        assert_eq!(value["whiteboard"]["pace"], json!("natural"));
        assert_eq!(value["whiteboard"]["strict"], json!(true));
        assert_eq!(
            value["whiteboard"]["beats"][0]["at"],
            json!("~main:g1.1:start")
        );
        assert_eq!(value["whiteboard"]["beats"][0]["label"], json!("第一步"));
        assert!(value["whiteboard"]["beats"][1].get("label").is_none());
        assert!(value["whiteboard"]["beats"][2].get("end").is_none());

        // 0.8 numeric form: default pace=stretch / strict=false
        let legacy = element(
            r##"{"id":"e1","kind":"whiteboard","srcId":"s1","whiteboard":{"beats":[{"at":0,"box":[0,0,50,100]},{"at":2,"box":[50,0,50,100]}]}}"##,
        );
        legacy.validate(&mut HashSet::new()).unwrap();
        let props = legacy.whiteboard.as_ref().unwrap();
        assert_eq!(props.pace(), WhiteboardPace::Stretch);
        assert!(!props.strict());
        assert_eq!(
            serde_json::to_value(&legacy).unwrap()["whiteboard"],
            json!({"beats":[{"at":0.0,"box":[0.0,0.0,50.0,100.0]},{"at":2.0,"box":[50.0,0.0,50.0,100.0]}]})
        );
        // A whole 0.8 document is read in and written out as the current version
        let doc: TimelineDocument = serde_json::from_str(
            r##"{"ccutTimeline":"0.8","sources":{"s1":{"path":"a.png","kind":"image"}},"tracks":[{"id":"t","kind":"overlay","elements":[{"id":"e1","kind":"whiteboard","srcId":"s1","whiteboard":{"beats":[{"at":1,"box":[0,0,50,100]}]}}]}]}"##,
        )
        .unwrap();
        doc.validate().unwrap();
        assert_eq!(doc.version, TIMELINE_VERSION);
        assert_eq!(
            serde_json::to_value(&doc).unwrap()["ccutTimeline"],
            json!(TIMELINE_VERSION)
        );
    }

    /// Contract validation of 0.9 whiteboard beats. Timing in numeric form is reported here as `whiteboard-beat-window` / `whiteboard-beat-after-draw`. Anchor grammar, label length and the pace enum are also checked here.
    #[test]
    fn whiteboard_beats_are_time_checked_when_numeric() {
        let cases: [(&str, &str); 8] = [
            (
                r##"{"id":"e1","kind":"whiteboard","srcId":"s1","whiteboard":{"beats":[{"at":2,"box":[0,0,50,100]},{"at":1,"box":[50,0,50,100]}]}}"##,
                WHITEBOARD_BEAT_WINDOW,
            ),
            (
                r##"{"id":"e1","kind":"whiteboard","srcId":"s1","whiteboard":{"beats":[{"at":0,"end":3,"box":[0,0,50,100]},{"at":2,"box":[50,0,50,100]}]}}"##,
                WHITEBOARD_BEAT_WINDOW,
            ),
            (
                r##"{"id":"e1","kind":"whiteboard","srcId":"s1","whiteboard":{"beats":[{"at":2,"end":2,"box":[0,0,50,100]}]}}"##,
                WHITEBOARD_BEAT_WINDOW,
            ),
            (
                r##"{"id":"e1","kind":"whiteboard","srcId":"s1","whiteboard":{"draw":4,"beats":[{"at":0,"end":5,"box":[0,0,50,100]}]}}"##,
                WHITEBOARD_BEAT_AFTER_DRAW,
            ),
            (
                r##"{"id":"e1","kind":"whiteboard","srcId":"s1","whiteboard":{"beats":[{"at":"main:g1:start","box":[0,0,50,100]}]}}"##,
                "词锚点非法",
            ),
            (
                r##"{"id":"e1","kind":"whiteboard","srcId":"s1","whiteboard":{"beats":[{"at":-1,"box":[0,0,50,100]}]}}"##,
                "非负秒数",
            ),
            (
                r##"{"id":"e1","kind":"whiteboard","srcId":"s1","whiteboard":{"beats":[{"at":0,"box":[0,0,50,100],"label":"很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很"}]}}"##,
                "label 至多",
            ),
            (
                r##"{"id":"e1","kind":"whiteboard","srcId":"s1","whiteboard":{"beats":[{"at":0,"box":[0,0,50,100]},{"at":"~main:g1.1:start","box":[50,0,50,100]}]}}"##,
                "",
            ),
        ];
        for (source, expect) in cases {
            let result = element(source).validate(&mut HashSet::new());
            if expect.is_empty() {
                result.unwrap();
                continue;
            }
            let err = result.unwrap_err().to_string();
            assert!(err.contains(expect), "{source}\n{err}");
        }
        assert!(
            serde_json::from_str::<Element>(
                r##"{"id":"e1","kind":"whiteboard","srcId":"s1","whiteboard":{"pace":"fast"}}"##
            )
            .is_err(),
            "pace 是封闭枚举"
        );
        assert!(
            serde_json::from_str::<Element>(
                r##"{"id":"e1","kind":"whiteboard","srcId":"s1","whiteboard":{"beats":[{"at":0,"box":[0,0,50,100],"hold":1}]}}"##
            )
            .is_err(),
            "beat deny_unknown_fields"
        );
    }

    #[test]
    fn the_props_values_are_range_checked() {
        for source in [
            // Colour must be #RRGGBB[AA]
            r#"{"id":"e1","kind":"shape","shape":{"shape":"rect","fill":"red"}}"#,
            r#"{"id":"e1","kind":"shape","shape":{"shape":"rect","strokeWidth":-1}}"#,
            r#"{"id":"e1","kind":"shape","shape":{"shape":"rect","cornerRadius":[0,0,0,-2]}}"#,
            r#"{"id":"e1","kind":"shape","shape":{"shape":"line","head":"circle"}}"#,
            r#"{"id":"e1","kind":"sticker","sticker":{"source":"remote"}}"#,
            r#"{"id":"e1","kind":"sticker","sticker":{"source":"asset","loop":"pingpong"}}"#,
            r#"{"id":"e1","kind":"visualizer","visualizer":{"style":"bars","fftSize":333}}"#,
            r#"{"id":"e1","kind":"visualizer","visualizer":{"style":"bars","minDb":10,"maxDb":-10}}"#,
            r#"{"id":"e1","kind":"visualizer","visualizer":{"style":"bars","smoothing":1}}"#,
            r#"{"id":"e1","kind":"progress","progress":{"style":""}}"#,
            r#"{"id":"e1","kind":"progress","progress":{"style":"normal","startProgress":1.1}}"#,
            r##"{"id":"e1","kind":"draw","draw":{"brush":"round","color":"red","size":4}}"##,
            r##"{"id":"e1","kind":"draw","draw":{"brush":"round","color":"#ffffff","size":0}}"##,
            r##"{"id":"e1","kind":"draw","draw":{"brush":"round","color":"#ffffff","size":4,"strokes":[{"points":[[101,0]]}]}}"##,
            // confetti (design doc §3.5): out-of-range values, empty tables, unknown shapes and bad colours are all reported as errors at parse time.
            r#"{"id":"e1","kind":"confetti","confetti":{"style":""}}"#,
            r#"{"id":"e1","kind":"confetti","confetti":{"style":"rainbow-paper","colors":[]}}"#,
            r##"{"id":"e1","kind":"confetti","confetti":{"style":"rainbow-paper","colors":["#111111","#222222","#333333","#444444","#555555","#666666","#777777","#888888","#999999"]}}"##,
            r#"{"id":"e1","kind":"confetti","confetti":{"style":"rainbow-paper","colors":["red"]}}"#,
            r#"{"id":"e1","kind":"confetti","confetti":{"style":"rainbow-paper","shapes":[]}}"#,
            r#"{"id":"e1","kind":"confetti","confetti":{"style":"rainbow-paper","shapes":["emoji"]}}"#,
            r#"{"id":"e1","kind":"confetti","confetti":{"style":"rainbow-paper","size":4.5}}"#,
            r#"{"id":"e1","kind":"confetti","confetti":{"style":"rainbow-paper","speed":0.1}}"#,
            r#"{"id":"e1","kind":"confetti","confetti":{"style":"rainbow-paper","gravity":-3}}"#,
            r#"{"id":"e1","kind":"confetti","confetti":{"style":"rainbow-paper","spin":3.5}}"#,
            r#"{"id":"e1","kind":"confetti","confetti":{"style":"rainbow-paper","wind":601}}"#,
            r#"{"id":"e1","kind":"confetti","confetti":{"style":"rainbow-paper","opacity":1.5}}"#,
            r#"{"id":"e1","kind":"confetti","confetti":{"style":"rainbow-paper","emit":{"rate":0}}}"#,
            r#"{"id":"e1","kind":"confetti","confetti":{"style":"rainbow-paper","emit":{"count":501}}}"#,
            r#"{"id":"e1","kind":"confetti","confetti":{"style":"rainbow-paper","emit":{"interval":61}}}"#,
            r#"{"id":"e1","kind":"confetti","confetti":{"style":"rainbow-paper","origin":{"x":121,"y":50}}}"#,
            r#"{"id":"e1","kind":"confetti","confetti":{"style":"rainbow-paper","angle":181}}"#,
            r#"{"id":"e1","kind":"confetti","confetti":{"style":"rainbow-paper","spread":361}}"#,
        ] {
            assert!(
                element(source).validate(&mut HashSet::new()).is_err(),
                "{source}"
            );
        }
        assert!(
            serde_json::from_str::<Element>(
                r#"{"id":"e1","kind":"placeholder","placeholder":{"variant":"recording"}}"#
            )
            .is_err(),
            "placeholder.variant 必须是封闭枚举"
        );
    }

    /// `Place.flipX/flipY`: mirroring belongs to geometry (ADR-E01), and `skip_serializing_if` guarantees that old documents serialize to the same bytes.
    #[test]
    fn the_place_carries_flip_without_changing_old_bytes() {
        let flipped: Place = serde_json::from_str(r#"{"x":50,"flipX":true}"#).unwrap();
        assert_eq!(flipped.flip_signs(), (-1.0, 1.0));
        assert_eq!(Place::default().flip_signs(), (1.0, 1.0));
        let corners: Place = serde_json::from_str(
            r#"{"radius":8,"cornerRadii":{"topLeft":1,"topRight":2,"bottomRight":3,"bottomLeft":4}}"#,
        )
        .unwrap();
        assert_eq!(corners.corner_radii(), [1.0, 2.0, 3.0, 4.0]);
        let plain = serde_json::to_value(Place::default()).unwrap();
        assert!(plain.get("flipX").is_none() && plain.get("flipY").is_none());
        assert_eq!(
            schema_json()["$defs"]["place"]["properties"]["flipX"],
            json!({"type": "boolean"})
        );
    }

    /// Reading versions 0.1–0.8: old versions are read normally and written out upgraded to the current version. **A document without new fields differs from 0.1 after serialization only in the version string.**
    #[test]
    fn all_supported_timeline_versions_read_and_everything_writes_as_the_current_one() {
        let source = r#"{"ccutTimeline":"0.1","clips":[{"id":"c1","in":0.0,"out":1.0}]}"#;
        let old: TimelineDocument = serde_json::from_str(source).unwrap();
        assert_eq!(old.version, TIMELINE_VERSION);
        old.validate().unwrap();
        let previous: TimelineDocument =
            serde_json::from_str(&source.replace("0.1", "0.2")).unwrap();
        let third: TimelineDocument = serde_json::from_str(&source.replace("0.1", "0.3")).unwrap();
        let fourth: TimelineDocument = serde_json::from_str(&source.replace("0.1", "0.4")).unwrap();
        let fifth: TimelineDocument = serde_json::from_str(&source.replace("0.1", "0.5")).unwrap();
        let sixth: TimelineDocument = serde_json::from_str(&source.replace("0.1", "0.6")).unwrap();
        let seventh: TimelineDocument =
            serde_json::from_str(&source.replace("0.1", "0.7")).unwrap();
        let eighth: TimelineDocument = serde_json::from_str(&source.replace("0.1", "0.8")).unwrap();
        let ninth: TimelineDocument = serde_json::from_str(&source.replace("0.1", "0.9")).unwrap();
        let tenth: TimelineDocument = serde_json::from_str(&source.replace("0.1", "0.10")).unwrap();
        let current: TimelineDocument =
            serde_json::from_str(&source.replace("0.1", TIMELINE_VERSION)).unwrap();
        assert_eq!(old, previous);
        assert_eq!(previous, third);
        assert_eq!(third, fourth);
        assert_eq!(fourth, fifth);
        assert_eq!(fifth, sixth);
        assert_eq!(sixth, seventh);
        assert_eq!(seventh, eighth);
        assert_eq!(eighth, ninth);
        assert_eq!(ninth, tenth);
        assert_eq!(tenth, current);
        for version in TIMELINE_VERSIONS {
            let parsed: TimelineDocument =
                serde_json::from_str(&source.replace("0.1", version)).unwrap();
            assert_eq!(parsed, old);
        }
        assert_eq!(
            serde_json::to_string(&old).unwrap(),
            source.replace("0.1", TIMELINE_VERSION),
            "不含新字段的文档只差 version 字符串"
        );
        // Unknown versions are kept as-is, and validate reports UnsupportedVersion (not a serde text error).
        let future: TimelineDocument = serde_json::from_str(r#"{"ccutTimeline":"9.9"}"#).unwrap();
        assert_eq!(
            future.validate().unwrap_err(),
            TimelineError::UnsupportedVersion("9.9".to_owned())
        );
        assert_eq!(
            schema_json()["properties"]["ccutTimeline"],
            json!({"enum": TIMELINE_VERSIONS})
        );
    }

    /// The 0.4 `template`: the whole layer document hangs off the root. Reading and writing are symmetric, and validation goes through `template::validate`.
    #[test]
    fn template_field_round_trips_and_validates() {
        let mut doc = TimelineDocument::default();
        assert!(
            serde_json::to_value(&doc)
                .unwrap()
                .get("template")
                .is_none()
        );
        doc.template = Some(crate::template::instance(
            &crate::template::builtin("tpl-chapter-bar").unwrap(),
        ));
        doc.validate().unwrap();
        let text = serde_json::to_string(&doc).unwrap();
        let back: TimelineDocument = serde_json::from_str(&text).unwrap();
        assert_eq!(back, doc);
        assert_eq!(
            back.template.as_ref().unwrap().from.as_deref(),
            Some("tpl-chapter-bar")
        );
        doc.template.as_mut().unwrap().layers[0].rect.y = 99.0;
        assert!(matches!(doc.validate(), Err(TimelineError::Invalid(_))));
        assert!(schema_json()["$defs"]["template"]["properties"]["layers"].is_object());
    }

    /// Where a new element lands in the full document: carried on the overlay track, and the schema and the struct move together.
    #[test]
    fn the_new_kinds_survive_a_full_document_round_trip() {
        let source = r##"{
            "ccutTimeline":"0.2",
            "tracks":[{"id":"t1","kind":"overlay","elements":[
                {"id":"e1","kind":"shape","start":1.0,"end":2.0,
                 "place":{"x":50,"y":50,"w":30,"flipX":true},
                 "shape":{"shape":"rect","fill":"#ff0000ff","cornerRadius":[8,8,8,8]}},
                {"id":"e2","kind":"visualizer","start":0.0,"end":5.0,
                 "visualizer":{"style":"bars","mainColor":"#ffffff"}},
                {"id":"e3","kind":"progress","start":0.0,"end":5.0,
                 "progress":{"style":"rounded"}},
                {"id":"e4","kind":"sticker","start":0.0,"end":5.0,
                 "sticker":{"source":"asset","path":"stickers/star.png"}},
                {"id":"e5","kind":"confetti","start":0.0,"end":5.0,
                 "confetti":{"style":"golden-starburst","seed":42}}
            ]}]
        }"##;
        let document: TimelineDocument = serde_json::from_str(source).unwrap();
        document.validate().unwrap();
        let again: TimelineDocument =
            serde_json::from_str(&serde_json::to_string(&document).unwrap()).unwrap();
        assert_eq!(document, again);
        // Audio tracks hold only audio elements: a new kind must not slip into an audio track.
        let on_audio_track = source
            .replace("\"kind\":\"overlay\"", "\"kind\":\"audio\"")
            .replace("\"id\":\"e1\"", "\"id\":\"e9\"");
        let document: TimelineDocument = serde_json::from_str(&on_audio_track).unwrap();
        assert!(document.validate().is_err());
    }

    #[test]
    fn anchor_grammar_is_closed() {
        assert!(valid_anchor("~main:g42.0"));
        assert!(valid_anchor("~src-a:g42.0:end+0.4"));
        assert!(!valid_anchor("~g42.0"));
        assert!(!valid_anchor("~main:g42.0+calc(1)"));
    }
}
