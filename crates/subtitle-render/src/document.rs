// —— The content below was moved verbatim from `core/crates/ccut-kernel/src/cmd/studio_export.rs` (main plan D2) ——
// Source line ranges (line numbers after merging e64ed8fc): :1-229 (header notes, imports, constants, the subtitle core types) and :407-2063 (document loading, style parsing, per-word animation, layout projection). The middle section :230-406 holds export-only types (VideoExportStats / PatchFallback / VideoRenderMode / VideoExportTiming / fallback_envelope), which stay in the CLI.

// Unified overlay video export for Subtitle Studio and timeline elements.
//
// Studio's Canvas preview and this code share the same `studio/data.json` style semantics: the display window, bilingual font sizes, per-word state and entrance durations are all computed by the pure-function rules in `subtitle-rendering.js`. The CLI compiles the result into a typed per-frame plan, draws the transparent overlay with cosmic-text + tiny-skia, and records a deterministic DrawOp instruction stream for each frame. The native media backend of the current platform then decodes, composites and encodes it as an H.264/AAC MP4.

use anyhow::{Context, Result, anyhow, bail};
use speech_doc::split::target_delivery_projection;
#[cfg(feature = "host")]
use render_raster::MediaStore;
#[cfg(feature = "host")]
use render_raster::assets::{LoadedAssets, VideoInfo, decode_image, probe_media};
use render_raster::drawop::{DrawOp, FrameBuilder, FrameOps};
use render_raster::{FrameMedia, GlyphAtlasRender, GlyphRender, TextEngine};
#[cfg(feature = "host")]
use timeline::schema::TimelineDocument;
use timeline::schema::{
    Animation, Background, ConfettiProps, CounterProps, DrawProps, Element, ElementKind,
    ElementRole, Fit, Fx, Main, Mask, Place, PlaceholderProps, ProgressProps, ShapeProps,
    StickerProps, Tile, VisualMode, VisualizerProps, WhiteboardProps,
};
use serde_json::{Value, json};
use std::collections::{HashMap, VecDeque};
#[cfg(feature = "host")]
use std::fs;
use std::ops::Range;
use std::path::Path;
#[cfg(feature = "host")]
use std::path::PathBuf;
use std::sync::Arc;
use tiny_skia::{
    Color, FillRule, FilterQuality, GradientStop, IntSize, LinearGradient, Mask as PixmapMask,
    Paint, PathBuilder, Pattern, Pixmap, PixmapPaint, PixmapRef, Point, SpreadMode, Stroke,
    Transform,
};
use unicode_segmentation::UnicodeSegmentation;

// The single source of truth for the reference short edge (540) is `timeline::REFERENCE_SHORT_EDGE`. Subtitle layout's canvas_scale and element effect lowering both scale against this same baseline. The same-valued copy in studio_export was also merged into it during the move. The glob export lets the CLI-side `ass_style.rs` keep referring to it by its bare name.
pub use timeline::REFERENCE_SHORT_EDGE;
pub const DEFAULT_LEAD_IN: f64 = 0.5;
pub const DEFAULT_TAIL: f64 = 1.0;
/// The authoritative definition of the bilingual font-size default ratios. The burn-in side [`resolve_line_style`], the Web `subtitle-rendering.js` `lineFontSize`, and the NLE editable export `services::editable_export::line_style` all share the same set of constants. Changing the numbers on any one side alone would make the three sides' font sizes diverge.
/// Reference font size: the default value of `root.fontSize`, and also the normalisation denominator for the background plate's padding, corner radius and letter-spacing.
///
/// The prototype `designs/cuccut/app/panel-substyle.jsx:82-86` `padOf` / `radiusOf` are **percentages of the font size**, so these must scale with **this line's own font size**. Previously they multiplied `canvas_scale` (which contains only the canvas short edge and the global `scale`), so the bilingual translation line's `transScale` had no effect on them, and the translation line's plate and letter-spacing were as large as the source line's. A row at the default font size has `font_size / REFERENCE_FONT_SIZE == canvas_scale`, and its output is unchanged pixel for pixel.
pub const REFERENCE_FONT_SIZE: f64 = 30.0;
/// The horizontal-to-vertical ratio of the plate's padding. The prototype `padOf` uses vertical `pad·fz/100` and horizontal ×1.4: “left and right slightly wider than top and bottom, so the text does not stick to the plate edge”. Previously the core had vertical = horizontal × 0.45 (block plate 0.62), which made plates flatter than the prototype by about half.
pub const PLATE_PAD_ASPECT: f64 = 1.4;
/// Default bilingual sizes: top line (translation) 32, bottom line (source) 20, independent of language; root font size 30 is the baseline.
pub const DEFAULT_BILINGUAL_ORIG_SCALE: f64 = 20.0 / 30.0;
pub const DEFAULT_TRANSLATION_RATIO: f64 = 32.0 / 20.0;

#[derive(Debug, Clone)]
pub struct Word {
    pub id: String,
    pub text: String,
    pub start: f64,
    pub end: f64,
}

#[derive(Debug, Clone)]
pub struct TimedItem {
    pub id: String,
    pub series_index: u32,
    pub text: String,
    pub display_start: f64,
    pub display_end: f64,
    pub words: Vec<Word>,
}

#[derive(Debug, Clone, Copy)]
pub struct TimedInput<'a> {
    pub item: &'a Value,
    pub text_key: &'static str,
    pub language: &'a str,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LineKind {
    Original,
    Translation,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StudioMode {
    Original,
    Translated,
    Bilingual,
}

impl StudioMode {
    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "orig" | "original" => Some(Self::Original),
            "trans" | "translated" => Some(Self::Translated),
            "bi" | "bilingual" => Some(Self::Bilingual),
            _ => None,
        }
    }

    /// The display mode of a document is always derived from the subtitle track set. `style.mode` is only a compatibility projection. All read points go through here, to avoid a second criterion. When absent, fall back uniformly to `orig`.
    pub fn of_style(style: &Value) -> Self {
        mode_of(&resolve_track_set(style))
    }
}

/// The role of a subtitle track. One language = one track; in this round, each role has at most one track in the two-line core.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TrackRole {
    Source,
    Translation,
}

impl TrackRole {
    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "source" => Some(Self::Source),
            "translation" => Some(Self::Translation),
            _ => None,
        }
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Source => "source",
            Self::Translation => "translation",
        }
    }

    pub fn line_kind(self) -> LineKind {
        match self {
            Self::Source => LineKind::Original,
            Self::Translation => LineKind::Translation,
        }
    }
}

/// The two persistent contexts for subtitle style (`voiceInkContexts.{sub,bi}`).
///
/// The wire format still uses the existing `"sub"` / `"bi"`. The enum only stops the App, the CLI and the shared write path from guessing which style set is being edited from scattered strings. It originally lived in `ccut-workspace`'s `studio::style_sync`. The write transaction envelope (`ccut-editor-core::edits::Mutation`) also needs to carry it, but a pure crate must not depend on the write path, so it moved here alongside the track-set judgement.
#[derive(Clone, Copy, Debug, Eq, Hash, PartialEq, serde::Serialize, serde::Deserialize)]
pub enum StyleContext {
    #[serde(rename = "sub")]
    Subtitle,
    #[serde(rename = "bi")]
    Bilingual,
}

impl StyleContext {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Subtitle => "sub",
            Self::Bilingual => "bi",
        }
    }

    pub fn from_hint(value: &str) -> Option<Self> {
        match value {
            "sub" => Some(Self::Subtitle),
            "bi" => Some(Self::Bilingual),
            _ => None,
        }
    }

    /// Which context the flat layer of this style was flattened from. This is the criterion for `selected_context` on the write path when there is no `ctx` hint.
    ///
    /// **The criterion is deliberately not the track-set resolution** ([`resolve_track_set`] prefers `voiceInkContexts.bi.mode`). `bi.mode` is the `bi` context's own record (“whether to draw bilingual or translation-only when I am selected”), always equal to `bi`/`trans`, so it cannot answer “which tab the user is in right now”. On the Mac, when editing in the Subtitle Tab, the flat layer is a projection of `sub` and the root `mode` is `orig`. Using `bi.mode` to pick the context would write single-line style into the bilingual set.
    ///
    /// 1. If the root `mode` can be parsed, it decides.
    /// 2. Otherwise look at `tracks` (new-model clients may write only the track set).
    /// 3. If neither is present, `Subtitle`, on the same side as the default `orig` of `render_plan`.
    pub fn of_style(style: &Value) -> Self {
        let mode = style
            .get("mode")
            .and_then(Value::as_str)
            .and_then(StudioMode::parse)
            .unwrap_or_else(|| mode_of(&parse_track_set(style)));
        match mode {
            StudioMode::Original => Self::Subtitle,
            _ => Self::Bilingual,
        }
    }
}

/// One entry of the root key `tracks` in `studio/style.json`: one subtitle track on the picture / timeline.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SubtitleTrack {
    pub role: TrackRole,
    pub lang: Option<String>,
    /// Whether this track is switched off on the picture (D10, `tracks[].hidden`, default `false`).
    ///
    /// This is different from “removing” (deleting the track from `tracks`). `hidden` keeps the declaration; it just is not burned in and does not take part in deriving the effective mode. The track set is still the document's truth, so the root `mode` continues to follow the **declared** track set (`mode_of` does not look at `hidden`). Only the render and export side goes through [`effective_track_set`] / [`effective_mode`].
    pub hidden: bool,
}

impl SubtitleTrack {
    pub fn new(role: TrackRole, lang: Option<String>) -> Self {
        Self {
            role,
            lang,
            hidden: false,
        }
    }

    pub fn source(lang: Option<String>) -> Self {
        Self::new(TrackRole::Source, lang)
    }

    pub fn translation(lang: Option<String>) -> Self {
        Self::new(TrackRole::Translation, lang)
    }

    /// Chained setter for [`hidden`](Self::hidden).
    pub fn with_hidden(mut self, hidden: bool) -> Self {
        self.hidden = hidden;
        self
    }

    /// The id of this track within the protocol lane key `subs:<styleTrackId>`.
    ///
    /// **The only place** that constructs a subtitle track id. A role has at most one track in the track set ([`parse_track_set`] de-duplicates), so the role string is a stable id. The App's display lane ids (`tr-subs` / `tr-subs-trans`) are a different thing; do not mix them.
    pub fn track_id(&self) -> &'static str {
        self.role.as_str()
    }
}

/// Track set → compatibility `mode`. The single derivation rule.
pub fn mode_of(tracks: &[SubtitleTrack]) -> StudioMode {
    let has_source = tracks.iter().any(|t| t.role == TrackRole::Source);
    let has_translation = tracks.iter().any(|t| t.role == TrackRole::Translation);
    match (has_source, has_translation) {
        (true, true) => StudioMode::Bilingual,
        (false, true) => StudioMode::Translated,
        // An empty track set should not exist; if one is encountered, fall back to the most conservative orig.
        _ => StudioMode::Original,
    }
}

/// `mode` → track set. When re-deriving, preferably keep the `lang` of the old entry with the same role.
pub fn track_set_of_mode(mode: StudioMode, previous: &[SubtitleTrack]) -> Vec<SubtitleTrack> {
    // `hidden` is kept per role, just like `lang`. Re-deriving changes only the shape of the track set, and must not quietly re-enable a track the user had switched off.
    let track_of = |role: TrackRole| {
        let previous = previous.iter().find(|t| t.role == role);
        SubtitleTrack::new(role, previous.and_then(|t| t.lang.clone()))
            .with_hidden(previous.is_some_and(|t| t.hidden))
    };
    match mode {
        StudioMode::Original => vec![track_of(TrackRole::Source)],
        StudioMode::Translated => vec![track_of(TrackRole::Translation)],
        StudioMode::Bilingual => vec![
            track_of(TrackRole::Source),
            track_of(TrackRole::Translation),
        ],
    }
}

/// Reads only `style.tracks`, not `mode`. Invalid entries are dropped; duplicate roles are de-duplicated (the first entry is kept).
pub fn parse_track_set(style: &Value) -> Vec<SubtitleTrack> {
    let Some(items) = style.get("tracks").and_then(Value::as_array) else {
        return Vec::new();
    };
    let mut tracks: Vec<SubtitleTrack> = Vec::new();
    for item in items {
        let Some(role) = item
            .get("role")
            .and_then(Value::as_str)
            .and_then(TrackRole::parse)
        else {
            continue;
        };
        if tracks.iter().any(|t| t.role == role) {
            continue;
        }
        let lang = item
            .get("lang")
            .and_then(Value::as_str)
            .filter(|lang| !lang.trim().is_empty())
            .map(str::to_owned);
        let hidden = item.get("hidden").and_then(Value::as_bool).unwrap_or(false);
        tracks.push(SubtitleTrack::new(role, lang).with_hidden(hidden));
    }
    tracks
}

/// The roles of the duplicate entries in the raw `tracks` array that [`parse_track_set`] dropped during de-duplication by role.
///
/// The contract requires “when there is more than one effective translation track, take the first in document order and emit a warning”. The track-set model allows at most one per role, so extras are dropped at parse time. The warning criterion therefore has to be taken from the raw array.
pub fn duplicate_track_roles(style: &Value) -> Vec<TrackRole> {
    let Some(items) = style.get("tracks").and_then(Value::as_array) else {
        return Vec::new();
    };
    let mut seen: Vec<TrackRole> = Vec::new();
    let mut duplicates: Vec<TrackRole> = Vec::new();
    for item in items {
        let Some(role) = item
            .get("role")
            .and_then(Value::as_str)
            .and_then(TrackRole::parse)
        else {
            continue;
        };
        if seen.contains(&role) {
            if !duplicates.contains(&role) {
                duplicates.push(role);
            }
        } else {
            seen.push(role);
        }
    }
    duplicates
}

/// Compatibility `mode` signal: `voiceInkContexts.bi.mode` takes priority, followed by the flat root `mode`.
///
/// Whenever apps/mac changes any style in the Subtitle Tab, it writes back a root `mode="orig"` from the `.sub` set, which is pinned to a single line. That is not the user's intent. The mode the user actually sees is recorded in the `bi` context. Re-deriving from the root `mode` would silently remove the translation track, so of the two signals `bi.mode` is the more trustworthy.
pub fn mode_signal(style: &Value) -> Option<StudioMode> {
    style
        .pointer("/voiceInkContexts/bi/mode")
        .and_then(Value::as_str)
        .and_then(StudioMode::parse)
        .or_else(|| {
            style
                .get("mode")
                .and_then(Value::as_str)
                .and_then(StudioMode::parse)
        })
}

/// Read-time migration and compatibility resolution: gives the subtitle track set currently on screen for this style.
///
/// 1. Read `tracks` (drop invalid entries, de-duplicate by role).
/// 2. Read the compatibility `mode` signal ([`mode_signal`]: `voiceInkContexts.bi.mode` takes priority, followed by the root `mode`).
/// 3. If tracks is valid and non-empty, and a signal exists but is inconsistent with `mode_of(tracks)`, re-derive from the signal. New-model writers always keep the two consistent, so inconsistency can only come from an old writer (apps/mac unconditionally writes back `mode` and `bi.mode`), and the old writer's values are the more recent ones.
/// 4. If tracks is missing or empty, derive from the signal; if the signal is also missing, `[source]`.
///
/// This is a pure read function and never writes back to disk. Persistence is the job of the canonicalize step on the write path, and canonicalize's output satisfies `mode == bi.mode == mode_of(tracks)`, so read-time migration is idempotent.
pub fn resolve_track_set(style: &Value) -> Vec<SubtitleTrack> {
    let tracks = parse_track_set(style);
    let mode = mode_signal(style);
    match (tracks.is_empty(), mode) {
        (true, Some(mode)) => track_set_of_mode(mode, &tracks),
        (true, None) => vec![SubtitleTrack::source(None)],
        (false, Some(mode)) if mode != mode_of(&tracks) => track_set_of_mode(mode, &tracks),
        (false, _) => tracks,
    }
}

/// Effective track set: after [`resolve_track_set`], the entries with `hidden` removed (D10).
///
/// Rendering, burn-in and export derive the subtitle language **from this set only**. The root `mode` on `style` and [`mode_of`] still describe the **declared** track set: switching one track off does not change the document's declaration, and “putting it back” restores it as it was. The effective set may be empty, meaning no subtitles are burned in this time.
pub fn effective_track_set(style: &Value) -> Vec<SubtitleTrack> {
    resolve_track_set(style)
        .into_iter()
        .filter(|track| !track.hidden)
        .collect()
}

/// Effective track set → effective mode. `None` when the effective set is empty (= do not burn subtitles, equivalent to `--no-subs`).
pub fn effective_mode(style: &Value) -> Option<StudioMode> {
    let tracks = effective_track_set(style);
    if tracks.is_empty() {
        return None;
    }
    Some(mode_of(&tracks))
}

/// Track set → the JSON form of `style.tracks`.
pub fn tracks_json(tracks: &[SubtitleTrack]) -> Value {
    Value::Array(
        tracks
            .iter()
            .map(|track| {
                let mut entry = serde_json::Map::new();
                entry.insert("role".into(), Value::String(track.role.as_str().to_owned()));
                if let Some(lang) = &track.lang {
                    entry.insert("lang".into(), Value::String(lang.clone()));
                }
                // Default values are not written to disk, so old documents and new documents where no track has ever been switched off are byte-identical.
                if track.hidden {
                    entry.insert("hidden".into(), Value::Bool(true));
                }
                Value::Object(entry)
            })
            .collect(),
    )
}

/// The compatibility write-out string for `mode` (a short string from the same source as [`StudioMode::parse`]).
pub fn mode_token(mode: StudioMode) -> &'static str {
    match mode {
        StudioMode::Original => "orig",
        StudioMode::Translated => "trans",
        StudioMode::Bilingual => "bi",
    }
}

#[derive(Debug, Clone)]
pub struct LineStyle {
    pub shaped_italic: bool,
    pub text_motion: Option<Arc<motion::text_motion::CompiledTextMotion>>,
    pub word_background: Option<WordBackground>,
    pub font_name: String,
    pub font_size: f64,
    /// Shaping weight. `bold` remains the compatibility projection used by ASS.
    pub font_weight: u16,
    pub color: SubtitleColor,
    pub bold: bool,
    pub italic: bool,
    pub underline: bool,
    pub letter_spacing: f64,
    pub outline_on: bool,
    pub outline_color: SubtitleColor,
    pub outline_width: f64,
    pub effect_on: bool,
    pub effect_color: SubtitleColor,
    pub effect_x: f64,
    pub effect_y: f64,
    pub effect_blur: f64,
    pub background_on: bool,
    pub background_color: SubtitleColor,
    /// Horizontal padding `backgroundPadding × (font_size / REFERENCE_FONT_SIZE) × 0.8` (also used as the default for the plate's corner radius).
    pub background_pad_h: f64,
    /// Vertical padding `pad_h / PLATE_PAD_ASPECT`, on the same basis as `padOf` in the prototype `panel-substyle.jsx` (vertical `pad·fz/100`, horizontal further ×1.4).
    ///
    /// Independent of `background_on`: a row whose plate is turned off still expands its own slot by this amount.
    pub background_pad_v: f64,
    /// Rounded-corner radius in output pixels. Missing `borderRadius` deliberately
    /// falls back to the legacy `background_pad_h` value for byte compatibility.
    pub background_radius: f64,
    /// `backgroundStyle == "block"`: one plate for the whole wrapped line and a
    /// 28%-of-frame minimum width. Missing or explicit `wrap` paints one plate per
    /// visual line.
    pub block_background: bool,
    /// Minimum width of the whole plate (output pixels). The subtitle track is set to 28% of the frame by `resolve_line_style`. For text elements, `render_plan::text_element_block_plate` changes it to the element box width (`place.w`; if none is given, 0 = wrap around the widest line).
    pub background_min_width: f64,
    pub line_height: f64,
    pub text_transform: String,
    /// Emphasis appearance for words in ordinary (non-recipe) subtitles: the root-level `emphasisLook` of the style applies to words with role emphasis / hero in `captionEmphasis`. Designed captions (recipes) have their own emphasis channel, so this is always `None` there. When there is no `emphasisLook`, it is also `None`, so the layout and pixels are bit-identical to the old behaviour.
    pub emphasis: Option<Arc<EmphasisLook>>,
}

/// Value range of `emphasisLook` (the scale centre is the word's baseline centre; clamped to this interval).
pub const EMPHASIS_LOOK_SCALE_RANGE: (f64, f64) = (0.8, 1.6);
/// The extra multiplier applied to a hero word on top of `emphasisLook.scale` (the result is still clamped to the range above).
pub const EMPHASIS_LOOK_HERO_FACTOR: f64 = 1.15;

/// An emphasised word: `captionEmphasis[<wordId>]`.
#[derive(Debug, Clone, PartialEq)]
pub struct EmphasisWord {
    pub hero: bool,
    /// Per-word colour, which takes precedence over [`EmphasisLook::color`].
    pub color: Option<SubtitleColor>,
}

/// Emphasis appearance for words in ordinary subtitles (root-level `emphasisLook`).
#[derive(Debug, Clone, PartialEq)]
pub struct EmphasisLook {
    pub color: Option<SubtitleColor>,
    /// Already mapped to the actual shaping font family (same source as [`font_name`]).
    pub font_name: Option<String>,
    pub bold: Option<bool>,
    pub italic: Option<bool>,
    /// Already clamped to [`EMPHASIS_LOOK_SCALE_RANGE`].
    pub scale: f64,
    pub words: HashMap<String, EmphasisWord>,
}

/// The glyph parameters actually used for an emphasised word.
#[derive(Debug, Clone, PartialEq)]
pub struct EmphasisVariant<'a> {
    pub color: Option<SubtitleColor>,
    pub font_name: Option<&'a str>,
    pub bold: Option<bool>,
    pub italic: Option<bool>,
    pub scale: f64,
}

impl EmphasisLook {
    /// The emphasis appearance of word `id`; returns `None` if it is not in `captionEmphasis`.
    pub fn variant(&self, id: &str) -> Option<EmphasisVariant<'_>> {
        let word = self.words.get(id)?;
        let (low, high) = EMPHASIS_LOOK_SCALE_RANGE;
        Some(EmphasisVariant {
            color: word.color.or(self.color),
            font_name: self.font_name.as_deref(),
            bold: self.bold,
            italic: self.italic,
            scale: if word.hero {
                (self.scale * EMPHASIS_LOOK_HERO_FACTOR).clamp(low, high)
            } else {
                self.scale
            },
        })
    }
}

/// Words in `captionEmphasis` with role emphasis / hero: `(word ID, role, per-word colour, original entry)`. Designed caption recipes and the emphasis of ordinary subtitles (`emphasisLook`) share this one criterion.
pub fn caption_emphasis_words(
    style: &Value,
) -> impl Iterator<Item = (&String, &str, Option<SubtitleColor>, &Value)> {
    style
        .get("captionEmphasis")
        .and_then(Value::as_object)
        .into_iter()
        .flatten()
        .filter_map(|(id, value)| {
            let role = value
                .get("role")
                .and_then(Value::as_str)
                .unwrap_or("normal");
            matches!(role, "emphasis" | "hero").then(|| {
                (
                    id,
                    role,
                    value
                        .get("color")
                        .and_then(Value::as_str)
                        .and_then(parse_css_color),
                    value,
                )
            })
        })
}

/// Resolves [`EmphasisLook`] from the (merged) line style. Returns `None` when there is no `emphasisLook`, no emphasised words, or this line uses a designed caption recipe.
pub fn emphasis_look(style: &Value) -> Option<Arc<EmphasisLook>> {
    let look = style.get("emphasisLook")?.as_object()?;
    let animation = style
        .get("wordAnimation")
        .or_else(|| style.get("anim"))
        .unwrap_or(&Value::Null);
    if designed_caption(style, animation).is_some() {
        return None;
    }
    let words = caption_emphasis_words(style)
        .map(|(id, role, color, _)| {
            (
                id.clone(),
                EmphasisWord {
                    hero: role == "hero",
                    color,
                },
            )
        })
        .collect::<HashMap<_, _>>();
    if words.is_empty() {
        return None;
    }
    let (low, high) = EMPHASIS_LOOK_SCALE_RANGE;
    Some(Arc::new(EmphasisLook {
        color: look
            .get("color")
            .and_then(Value::as_str)
            .and_then(parse_css_color),
        font_name: look
            .get("fontFamily")
            .and_then(Value::as_str)
            .filter(|family| !family.trim().is_empty())
            .map(|family| font_name(&serde_json::json!({ "fontFamily": family }))),
        bold: look.get("bold").and_then(Value::as_bool),
        italic: look.get("italic").and_then(Value::as_bool),
        scale: finite(look.get("scale"), 1.0).clamp(low, high),
        words,
    }))
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SubtitleColor {
    pub r: u8,
    pub g: u8,
    pub b: u8,
    pub a: u8,
}

impl SubtitleColor {
    const WHITE: Self = Self {
        r: 255,
        g: 255,
        b: 255,
        a: 0,
    };
    const BLACK: Self = Self {
        r: 0,
        g: 0,
        b: 0,
        a: 0,
    };

    pub fn parse(value: Option<&Value>, fallback: Self) -> Self {
        value
            .and_then(Value::as_str)
            .and_then(parse_css_color)
            .unwrap_or(fallback)
    }

    pub fn with_opacity(mut self, opacity: f64) -> Self {
        self.a = (255.0 * (1.0 - clamp(opacity, 0.0, 1.0))).round() as u8;
        self
    }

    pub fn mix(self, other: Self, amount: f64) -> Self {
        let amount = amount.clamp(0.0, 1.0);
        let channel = |left: u8, right: u8| {
            (f64::from(left) + (f64::from(right) - f64::from(left)) * amount).round() as u8
        };
        Self {
            r: channel(self.r, other.r),
            g: channel(self.g, other.g),
            b: channel(self.b, other.b),
            a: channel(self.a, other.a),
        }
    }
}

#[derive(Debug, Clone, Default)]
pub struct WordVisual {
    pub color: Option<SubtitleColor>,
    pub opacity: Option<f64>,
    pub background: Option<SubtitleColor>,
    pub border_radius_em: Option<f64>,
    pub underline: Option<bool>,
    pub underline_offset_em: Option<f64>,
    pub bottom_em: Option<f64>,
    pub shadow_off: bool,
    /// The scale factor of the classic per-word highlight block for this frame (`None` = constant 1.0, the old behaviour). The block scales around the rectangle's **centre**, and its corner radius follows at the same rate. Text is not affected.
    pub box_scale: Option<f64>,
    /// The alpha of the classic per-word highlight block for this frame (`None` = use the word's own opacity). **The block and the text are animated separately**: if the block's alpha borrowed the word's opacity, the text would fade along with it.
    pub box_opacity: Option<f64>,
    pub recipe: Option<CaptionRecipeResolvedWord>,
}

/// The timeline of the per-word highlight block (the prototype `designs/cuccut/app/model-subanim.js` `boxHighlightV2` track, `group: "word"`). **One word's window is one cycle**: the block's scale and alpha each follow their own keyframe curve, and are drawn only on the current word.
///
/// This layer does not enter the three-tier merge of `spoken`/`unspoken`. The curve only has meaning for `active`. Folding it into [`WordVisual`] would require [`merge_visual`] to define semantics for “overriding a curve”, while the document has never had a second curve to override.
#[derive(Debug, Clone, PartialEq)]
pub struct WordBoxTrack {
    /// `(phase, multiplier)`, phases in ascending order.
    pub scale: Vec<(f64, f64)>,
    /// `(phase, alpha)`, phases in ascending order.
    pub opacity: Vec<(f64, f64)>,
    /// The easing control points for each segment (`cubic-bezier(x1, y1, x2, y2)`).
    pub easing: [f64; 4],
}

impl WordBoxTrack {
    pub fn scale_at(&self, phase: f64) -> Option<f64> {
        sample_keyframes(&self.scale, self.easing, phase)
    }

    pub fn opacity_at(&self, phase: f64) -> Option<f64> {
        sample_keyframes(&self.opacity, self.easing, phase)
    }

    /// Whether the curve actually varies over time. A constant track (e.g. `stack`'s .92) should not drag the whole caption into the per-frame cache key.
    pub fn is_animated(&self) -> bool {
        let varies = |frames: &[(f64, f64)]| {
            frames
                .first()
                .is_some_and(|(_, first)| frames.iter().any(|(_, value)| value != first))
        };
        varies(&self.scale) || varies(&self.opacity)
    }
}

/// The control points for `sinInOut` (prototype `EASING` table: `cubic-bezier(0.37, 0, 0.63, 1)`).
pub const WORD_BOX_EASING_SIN_IN_OUT: [f64; 4] = [0.37, 0.0, 0.63, 1.0];

/// Easing name → `cubic-bezier` control points. The table shares its source with the prototype `designs/cuccut/app/model-subanim.js` `EASING`. `square*` are steps, which block tracks do not use. Unknown names always fall back to `sinInOut`.
pub fn word_box_easing(name: &str) -> [f64; 4] {
    match name {
        "linear" => [0.0, 0.0, 1.0, 1.0],
        "sinIn" => [0.12, 0.0, 0.39, 0.0],
        "sinOut" | "sinout" => [0.61, 1.0, 0.88, 1.0],
        "expoOut" => [0.16, 1.0, 0.3, 1.0],
        "cubicOut" => [0.33, 1.0, 0.68, 1.0],
        "quadOut" => [0.5, 1.0, 0.89, 1.0],
        _ => WORD_BOX_EASING_SIN_IN_OUT,
    }
}

/// The y of `cubic-bezier(x1, y1, x2, y2)` at `t`.
///
/// CSS clamps the control points to x∈[0,1], so x(u) is monotonic and the solution is unique. Binary search with 32 steps gives an error already smaller than the effective precision of f64 in this range, and it **does not depend on the initial guess**, so it is bit-identical across platforms. (Render determinism is a red line: the convergence path of Newton iteration drifts with FMA results.)
pub fn cubic_bezier_ease(curve: [f64; 4], t: f64) -> f64 {
    let [x1, y1, x2, y2] = curve;
    let t = t.clamp(0.0, 1.0);
    let axis = |a: f64, b: f64, u: f64| {
        let v = 1.0 - u;
        3.0 * v * v * u * a + 3.0 * v * u * u * b + u * u * u
    };
    if (x1 - y1).abs() < 1e-12 && (x2 - y2).abs() < 1e-12 {
        return t;
    }
    let (mut low, mut high) = (0.0_f64, 1.0_f64);
    for _ in 0..32 {
        let mid = f64::midpoint(low, high);
        if axis(x1, x2, mid) < t {
            low = mid;
        } else {
            high = mid;
        }
    }
    axis(y1, y2, f64::midpoint(low, high))
}

/// Keyframe linear interpolation plus within-segment easing. The phase is clamped to `[0, 1]`; before the first frame the first value is taken, and after the last frame the last value is taken.
pub fn sample_keyframes(frames: &[(f64, f64)], easing: [f64; 4], phase: f64) -> Option<f64> {
    let first = frames.first()?;
    let phase = phase.clamp(0.0, 1.0);
    if phase <= first.0 {
        return Some(first.1);
    }
    for pair in frames.windows(2) {
        let (start, from) = pair[0];
        let (end, to) = pair[1];
        if phase <= end {
            let span = end - start;
            if span <= 0.0 {
                return Some(to);
            }
            let eased = cubic_bezier_ease(easing, (phase - start) / span);
            return Some(from + (to - from) * eased);
        }
    }
    frames.last().map(|(_, value)| *value)
}

/// `boxScale` / `boxOpacity` / `boxEasing` in the `active` payload. When all three keys are absent, returns `None`, and the block returns to a constant rectangle. The behaviour of old documents and of the other presets is unchanged byte for byte.
pub fn word_box_track(active: &Value) -> Option<WordBoxTrack> {
    fn keyframes(value: &Value) -> Option<Vec<(f64, f64)>> {
        let array = value.as_array()?;
        let mut frames = Vec::with_capacity(array.len());
        for entry in array {
            let pair = entry.as_array()?;
            let time = pair.first()?.as_f64()?;
            let value = pair.get(1)?.as_f64()?;
            if !time.is_finite() || !value.is_finite() {
                return None;
            }
            frames.push((time.clamp(0.0, 1.0), value));
        }
        (!frames.is_empty()).then_some(frames)
    }
    let scale = active.get("boxScale").and_then(keyframes);
    let opacity = active.get("boxOpacity").and_then(keyframes);
    if scale.is_none() && opacity.is_none() {
        return None;
    }
    Some(WordBoxTrack {
        scale: scale.unwrap_or_default(),
        opacity: opacity.unwrap_or_default(),
        easing: word_box_easing(
            active
                .get("boxEasing")
                .and_then(Value::as_str)
                .unwrap_or("sinInOut"),
        ),
    })
}

/// The phase (0–1) of word `index`'s window at `time`. A zero-length window or an out-of-range index returns 0.
pub fn word_phase(item: &TimedItem, index: usize, time: f64) -> f64 {
    let Some(word) = item.words.get(index) else {
        return 0.0;
    };
    let span = word.end - word.start;
    if !span.is_finite() || span <= 0.0 {
        return 0.0;
    }
    ((time - word.start) / span).clamp(0.0, 1.0)
}

/// The default corner radius (`em`) of the classic per-word highlight block: the basis used when `active.borderRadiusEm` is absent.
///
/// The stage, export and panel preview all read **the same number**. If the panel side wrote its own 0.25, changing the kernel default once would update only half of the UI.
pub const CLASSIC_WORD_BOX_RADIUS_EM: f64 = 0.25;

/// The rectangle of the classic per-word highlight block. The CPU `draw_line_layout` and the GPU `subtitle_scene_frame` **share this one definition**: if each wrote its own, there would be two geometric opinions, and cross-checks would inevitably diverge.
///
/// The geometry comes from the same source as the highlight Rect in Studio's `canvas-stage.jsx`, field by field (0.14em outset left and right, 0.04em outset on top, 1.08em height, `borderRadiusEm` default 0.25). It is then scaled as a whole around the rectangle's centre by [`WordVisual::box_scale`]. The corner radius scales at the same rate, so the pill does not turn square-cornered while expanding or contracting.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct ClassicWordBox {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub radius: f64,
}

pub fn classic_word_box(
    font_size: f64,
    cursor: f64,
    chunk_width: f64,
    line_top: f64,
    line_height: f64,
    part_dx: f64,
    part_dy: f64,
    bounce: f64,
    visual: &WordVisual,
) -> ClassicWordBox {
    let text_top = line_top + (line_height - font_size) / 2.0;
    let x = cursor - font_size * 0.14 + part_dx;
    let y = text_top - font_size * 0.04 - bounce + part_dy;
    let width = chunk_width + font_size * 0.28;
    let height = font_size * 1.08;
    let radius_em = visual
        .border_radius_em
        .unwrap_or(CLASSIC_WORD_BOX_RADIUS_EM);
    let radius = font_size * radius_em;
    let scale = visual.box_scale.unwrap_or(1.0).max(0.0);
    let (scaled_width, scaled_height) = (width * scale, height * scale);
    ClassicWordBox {
        x: x + (width - scaled_width) / 2.0,
        y: y + (height - scaled_height) / 2.0,
        width: scaled_width,
        height: scaled_height,
        radius: radius * scale,
    }
}

/// The block's own alpha factor. When there is a `boxOpacity` track, the block and the text are separated: the block alpha is **no longer** equated with the word's opacity. Without a track, it reverts bit-for-bit to the old behaviour.
pub fn classic_word_box_alpha(visual: &WordVisual) -> f64 {
    clamp(
        visual
            .box_opacity
            .unwrap_or_else(|| visual.opacity.unwrap_or(1.0)),
        0.0,
        1.0,
    )
}

#[derive(Debug, Clone)]
pub struct WordAnimation {
    pub name: String,
    /// An explicit catalogue selection opts into continuous motion. Old custom
    /// payloads retain their three-state interpretation.
    pub motion_id: Option<String>,
    pub spoken: WordVisual,
    pub active: WordVisual,
    pub unspoken: WordVisual,
    /// The timeline of the current-word highlight block ([`word_box_track`]); only the “pill highlight” option writes it.
    pub box_track: Option<WordBoxTrack>,
    pub caption: Option<DesignedCaption>,
}

#[derive(Debug, Clone)]
pub struct DesignedCaption {
    pub style_id: String,
    pub style_version: u32,
    pub content: String,
    pub primary: SubtitleColor,
    pub accent: SubtitleColor,
    /// The third colour (the Daoyazi hero word); if not written, it follows `accent`.
    pub secondary: SubtitleColor,
    pub intensity: f64,
    pub speed: f64,
    pub seed: Option<u64>,
    pub options: Vec<Value>,
    pub overrides: HashMap<String, CaptionWordOverride>,
    /// Stage C editing intent (root style key `captionSequences`, §5.4).
    pub sequences: CaptionSequenceIntent,
}

/// The user's manual edits to “dynamic typography”: segment breaks, per-segment version changes, and pinned rows. Units are pixels of the 540 short-edge reference canvas (`REFERENCE_SHORT_EDGE`); the output canvas is converted by `min(w, h) / 540`.
///
/// JSON shape:
/// ```json
/// "captionSequences": {
///   "schema": 1,
///   "sequenceBreakBefore": ["w-120"],
///   "seeds": { "w-000": 3 },
///   "pins": { "w-052": { "center": [12.5, -40], "rotationDeg": 90 } }
/// }
/// ```
#[derive(Debug, Clone, Default, PartialEq)]
pub struct CaptionSequenceIntent {
    /// Start a new segment before these cues (keyed by each cue's first word id).
    pub break_before: Vec<String>,
    /// Segment key (the segment's first word id) → version number.
    pub seeds: HashMap<String, u64>,
    /// Row key (the row's first word id) → fixed position.
    pub pins: HashMap<String, CaptionSequencePin>,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct CaptionSequencePin {
    /// Segment-local world coordinates, in 540 short-edge units.
    pub center: [f64; 2],
    pub rot_deg: f64,
}

/// The name of the root style key `captionSequences`.
pub const CAPTION_SEQUENCES_KEY: &str = "captionSequences";

impl CaptionSequenceIntent {
    pub fn from_style(style: &Value) -> Self {
        let Some(root) = style.get(CAPTION_SEQUENCES_KEY).and_then(Value::as_object) else {
            return Self::default();
        };
        let break_before = root
            .get("sequenceBreakBefore")
            .and_then(Value::as_array)
            .into_iter()
            .flatten()
            .filter_map(Value::as_str)
            .map(str::to_owned)
            .collect();
        let seeds = root
            .get("seeds")
            .and_then(Value::as_object)
            .into_iter()
            .flatten()
            .filter_map(|(key, value)| {
                let n = value.as_u64().or_else(|| {
                    value
                        .as_f64()
                        .filter(|v| v.is_finite() && *v >= 0.0)
                        .map(|v| v as u64)
                })?;
                Some((key.clone(), n))
            })
            .collect();
        let pins = root
            .get("pins")
            .and_then(Value::as_object)
            .into_iter()
            .flatten()
            .filter_map(|(key, value)| {
                let center = value.get("center")?.as_array()?;
                let x = center.first()?.as_f64().filter(|v| v.is_finite())?;
                let y = center.get(1)?.as_f64().filter(|v| v.is_finite())?;
                let rot_deg = finite(value.get("rotationDeg"), 0.0);
                Some((
                    key.clone(),
                    CaptionSequencePin {
                        center: [x, y],
                        rot_deg,
                    },
                ))
            })
            .collect();
        Self {
            break_before,
            seeds,
            pins,
        }
    }

    pub fn is_empty(&self) -> bool {
        self.break_before.is_empty() && self.seeds.is_empty() && self.pins.is_empty()
    }
}

impl DesignedCaption {
    pub fn number_option(&self, key: &str) -> Option<f64> {
        self.options.iter().find_map(|option| {
            (option.get("kind").and_then(Value::as_str) == Some("number")
                && option.get("key").and_then(Value::as_str) == Some(key))
            .then(|| option.get("number").and_then(Value::as_f64))
            .flatten()
        })
    }

    pub fn text_option(&self, key: &str) -> Option<&str> {
        self.options.iter().find_map(|option| {
            (option.get("kind").and_then(Value::as_str) == Some("text")
                && option.get("key").and_then(Value::as_str) == Some(key))
            .then(|| option.get("text").and_then(Value::as_str))
            .flatten()
        })
    }
}

#[derive(Debug, Clone)]
pub struct CaptionWordOverride {
    pub role: String,
    pub color: Option<SubtitleColor>,
    pub emoji: Option<String>,
}

pub fn finite(value: Option<&Value>, fallback: f64) -> f64 {
    value
        .and_then(Value::as_f64)
        .filter(|number| number.is_finite())
        .unwrap_or(fallback)
}

pub fn clamp(value: f64, low: f64, high: f64) -> f64 {
    value.max(low).min(high)
}

pub fn parse_css_color(raw: &str) -> Option<SubtitleColor> {
    let input = raw.trim();
    if input.eq_ignore_ascii_case("transparent") {
        return Some(SubtitleColor {
            a: 255,
            ..SubtitleColor::BLACK
        });
    }
    if let Some(hex) = input.strip_prefix('#') {
        let expanded = match hex.len() {
            3 | 4 => hex.chars().flat_map(|c| [c, c]).collect::<String>(),
            6 | 8 => hex.to_owned(),
            _ => return None,
        };
        let r = u8::from_str_radix(&expanded[0..2], 16).ok()?;
        let g = u8::from_str_radix(&expanded[2..4], 16).ok()?;
        let b = u8::from_str_radix(&expanded[4..6], 16).ok()?;
        let alpha = if expanded.len() == 8 {
            u8::from_str_radix(&expanded[6..8], 16).ok()?
        } else {
            255
        };
        return Some(SubtitleColor {
            r,
            g,
            b,
            a: 255 - alpha,
        });
    }
    let open = input.find('(')?;
    let close = input.rfind(')')?;
    let name = input[..open].trim().to_ascii_lowercase();
    if name != "rgb" && name != "rgba" {
        return None;
    }
    let parts: Vec<f64> = input[open + 1..close]
        .split(',')
        .map(str::trim)
        .map(str::parse)
        .collect::<std::result::Result<_, _>>()
        .ok()?;
    if parts.len() < 3 {
        return None;
    }
    let alpha = parts.get(3).copied().unwrap_or(1.0);
    Some(SubtitleColor {
        r: clamp(parts[0], 0.0, 255.0).round() as u8,
        g: clamp(parts[1], 0.0, 255.0).round() as u8,
        b: clamp(parts[2], 0.0, 255.0).round() as u8,
        a: (255.0 * (1.0 - clamp(alpha, 0.0, 1.0))).round() as u8,
    })
}

#[cfg(feature = "host")]
pub fn project_media(project: &Path) -> Result<PathBuf> {
    let manifest_path = project.join("project.json");
    let manifest: Value = serde_json::from_slice(
        &fs::read(&manifest_path)
            .with_context(|| format!("项目缺少 {}", manifest_path.display()))?,
    )
    .with_context(|| format!("解析 {}", manifest_path.display()))?;
    let raw = manifest
        .pointer("/media/path")
        .and_then(Value::as_str)
        .filter(|path| !path.is_empty())
        .context("project.json 缺少 media.path")?;
    let path = PathBuf::from(raw);
    let path = if path.is_absolute() {
        path
    } else {
        project.join(path)
    };
    if !path.is_file() {
        bail!("项目媒体不存在：{}", path.display());
    }
    Ok(path)
}

/// Reads the Studio body and applies, in the same order as the page, the edits not yet applied, so that CLI export matches the current preview.
#[cfg(feature = "host")]
pub fn load_preview_document(project: &Path) -> Result<Value> {
    if let Some(data) = crate::host::live_document(project)? {
        return apply_pending_edits(project, data);
    }
    let data_path = project.join("studio/data.json");
    let data: Value = serde_json::from_slice(&fs::read(&data_path).with_context(|| {
        format!(
            "项目缺少 {}；先运行 `ccut studio sync`",
            data_path.display()
        )
    })?)
    .with_context(|| format!("解析 {}", data_path.display()))?;
    apply_pending_edits(project, data)
}

/// Reads the Studio body in the translation language requested by the export.
///
/// The projection carries only one target language, and the Mac side never specifies a language when it refreshes the projection. So translations in the project other than the current target language could never be exported. When the language does not match, this re-projects in memory by `lang`: `rev` is kept, and the not-yet-committed edits.json overlay from the page still applies.
#[cfg(feature = "host")]
pub fn load_preview_document_for_lang(project: &Path, lang: Option<&str>) -> Result<Value> {
    let document = load_preview_document(project)?;
    let Some(lang) = lang else {
        return Ok(document);
    };
    if document
        .pointer("/meta/targetLang/code")
        .and_then(Value::as_str)
        == Some(lang)
    {
        return Ok(document);
    }
    match crate::host::reproject_language(project, lang)? {
        Some(data) => apply_pending_edits(project, data),
        None => Ok(document),
    }
}

/// The **in-process** content fingerprint of the body. The serialised byte stream is fed directly into the hasher, without first building a whole string (a seven-hour project's body is tens of MB when serialised, so that intermediate `String` would be pure waste).
///
/// It is used only within the same process, to check whether “this body and the previous one are identical, byte for byte”. It is not persisted and not shared across processes. It does not matter that `DefaultHasher` is unstable across versions.
pub fn document_fingerprint(document: &Value) -> u64 {
    use std::hash::Hasher;
    struct HashSink(std::collections::hash_map::DefaultHasher);
    impl std::io::Write for HashSink {
        fn write(&mut self, bytes: &[u8]) -> std::io::Result<usize> {
            self.0.write(bytes);
            Ok(bytes.len())
        }
        fn flush(&mut self) -> std::io::Result<()> {
            Ok(())
        }
    }
    let mut sink = HashSink(std::collections::hash_map::DefaultHasher::new());
    // `Value` serialisation does not fail. In the unlikely event that it does, the prefix written is still deterministic.
    let _ = serde_json::to_writer(&mut sink, document);
    sink.0.finish()
}

#[cfg(feature = "host")]
pub fn apply_pending_edits(project: &Path, mut data: Value) -> Result<Value> {
    let edits_path = project.join("studio/edits.json");
    let overlay: Value = match fs::read(&edits_path) {
        Ok(bytes) => serde_json::from_slice(&bytes)
            .with_context(|| format!("解析 {}", edits_path.display()))?,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(data),
        Err(error) => return Err(error).with_context(|| format!("读取 {}", edits_path.display())),
    };
    apply_preview_overlays(&mut data, &overlay);
    Ok(data)
}

/// Turns a body borrowed from the kernel's shared cache into a mutable preview body. If it is exclusively owned, it is taken apart directly; otherwise a deep copy is made. Then the `studio/edits.json` overlay is applied.
///
/// The deep copy and the edits overlay are placed together, so the caller pays for a copy only when it needs a writable one (zero copies if the `Arc` is already exclusive), rather than each caller copying the body itself. `Value::clone` is the derived implementation compiled inside serde_json. Calling it from one crate or another makes no measured difference in speed.
#[cfg(feature = "host")]
pub fn preview_document_from_shared(
    project: &Path,
    shared: std::sync::Arc<Value>,
) -> Result<Value> {
    let document =
        std::sync::Arc::try_unwrap(shared).unwrap_or_else(|shared| Value::clone(&shared));
    apply_pending_edits(project, document)
}

/// Reads the export-time subtitle style specified by `ccut export --to mp4 --sub-style`.
///
/// The file has the same shape as `studio/style.json`: a flat style blob, which may carry line-level partial overrides `origStyle` / `transStyle`. A read failure, invalid JSON, or a top level that is not an object is reported as an error. It never silently falls back to the project style, because a silent fallback would give the user an output that looks normal but has the wrong style.
#[cfg(feature = "host")]
pub fn load_subtitle_style_override(path: &Path) -> Result<Value> {
    let bytes = fs::read(path)
        .with_context(|| format!("读取 --sub-style 字幕样式文件 {}", path.display()))?;
    let style: Value = serde_json::from_slice(&bytes)
        .with_context(|| format!("解析 --sub-style 字幕样式文件 {}", path.display()))?;
    if !style.is_object() {
        bail!(
            "--sub-style 字幕样式文件 {} 顶层必须是 JSON 对象（与 studio/style.json 同构）",
            path.display()
        );
    }
    Ok(style)
}

/// Writes the export-time style wholesale into the in-memory Studio body.
///
/// This is a **replacement**, not a merge. The semantics of a preset export are “render this time with exactly this style”, so the project's `studio/style.json` and the `style` overlay of `studio/edits.json` are both discarded. [`load_preview_document`] has already merged the edits overlay into `document["style"]`, so assigning the whole value after it satisfies both semantics at once. The document is not persisted, and project state is unaffected.
pub fn apply_subtitle_style_override(document: &mut Value, style: Value) {
    document["style"] = style;
}

#[cfg(feature = "host")]
pub fn load_overlay_document(project: &Path) -> Result<Value> {
    let document = load_preview_document(project)?;
    overlay_document_with_live_timeline(project, &document)
}

/// Replaces the whole cue stream of the Studio body with a one-off sample (plan §5.4 S16).
///
/// The style panel's Designed Caption recipe preview needs “run a demo word sequence with this style”, and the project transcript has nothing to do with it. The Mac `StylePreviewViews.update` builds one `Cue(id:"pv")` plus `pv0..pvN`, with 1-second per-word timing, and hands it to the local Presentation kernel. Subtitle pixels go only through serve (plan D4), so the same construction was moved here.
///
/// Four things happen. ① `cues` is replaced with a single `pv` (word ids are fixed at `pv0..pvN-1`, so `sampleEmphasis` attaches to this id set). ② `sentences` / `transCues` / `sourceDocs` are cleared, since the sample has no translation axis. ③ `timeline` is dropped and `_overlayTimelineFingerprint` is stamped, so that [`overlay_document_with_live_timeline`] short-circuits and `load_timeline_elements` gets an empty track. The style sample draws only captions, not the project's B-roll, watermark or text elements. ④ `captionEmphasis` is **wholly replaced**, because the project's one is attached to real word ids and is meaningless for the sample.
///
/// Returns the end time in seconds of the sample's own timeline. The caller uses it to set the duration of this render plan.
pub fn apply_overlay_sample(
    document: &mut Value,
    words: &[(&str, f64, f64)],
    emphasis: &serde_json::Map<String, Value>,
) -> f64 {
    let rows: Vec<Value> = words
        .iter()
        .enumerate()
        .map(|(index, (text, start, end))| {
            json!({"id": format!("pv{index}"), "text": text, "t0": start, "t1": end})
        })
        .collect();
    let start = words.first().map(|word| word.1).unwrap_or(0.0);
    let end = words.last().map(|word| word.2).unwrap_or(0.0);
    let text = speech_doc::atomize::join_word_texts(words.iter().map(|word| word.0));
    document["cues"] = json!([{
        "id": "pv", "start": start, "end": end, "sp": "s1", "text": text, "words": rows,
    }]);
    document["sentences"] = json!([]);
    document["transCues"] = json!([]);
    if let Some(root) = document.as_object_mut() {
        root.remove("sourceDocs");
        root.remove("timeline");
    }
    document["_overlayTimelineFingerprint"] = json!("sample");
    if !document["style"].is_object() {
        document["style"] = json!({});
    }
    if emphasis.is_empty() {
        if let Some(style) = document["style"].as_object_mut() {
            style.remove("captionEmphasis");
        }
    } else {
        document["style"]["captionEmphasis"] = Value::Object(emphasis.clone());
    }
    end
}

/// Replaces the cue stream in the Studio body with the segments that have already settled during transcription (ledger #219, gap ①).
///
/// While transcription is running, `transcript.json` does not yet exist on the project disk, but the task frame being served already reports “how many seconds have been transcribed, plus the text of those sentences” (`liveSegments`; the accumulator lives in `ccut_editor_core::live_track`). Subtitle pixels are produced only by the kernel (plan D6: the App does no layout of a single line at all), so live segments take the same path. The caller hands the accumulated segments here, the cue stream in the body is replaced wholesale by them, and the render plan is then compiled as usual.
///
/// Difference from [`apply_overlay_sample`]: **only the subtitles are replaced**. `timeline` is kept as is, so the element layer (including the main video on a detached audio track) is still drawn. The times are the project's own timeline seconds, not the sample's 0..N seconds. `sentences` / `transCues` are cleared, because live segments have no translation axis, and leaving them would map old-draft word ids onto newly created cues.
///
/// No per-word timing is available (the task frame gives only whole sentences), so the word list is derived from the text by [`timed_inputs`], following the same fallback as for “cues in the transcript without `words`”.
pub fn apply_live_cues(document: &mut Value, spans: &[(f64, f64, &str)]) {
    let rows: Vec<Value> = spans
        .iter()
        .enumerate()
        .map(|(index, (start, end, text))| {
            json!({"id": format!("live{index}"), "start": start, "end": end.max(*start), "text": text})
        })
        .collect();
    document["cues"] = Value::Array(rows);
    document["sentences"] = json!([]);
    document["transCues"] = json!([]);
}

/// Whether the Studio body has a usable translation. For multi-source timelines, the translation comes from `sourceDocs` and is counted too.
pub fn document_has_translation(document: &Value) -> bool {
    fn filled(scope: &Value) -> bool {
        let text = |value: &Value| value.as_str().is_some_and(|text| !text.trim().is_empty());
        scope["transCues"]
            .as_array()
            .is_some_and(|cues| cues.iter().any(|cue| text(&cue["text"])))
            || scope["sentences"]
                .as_array()
                .is_some_and(|rows| rows.iter().any(|row| text(&row["trans"])))
    }
    filled(document)
        || document["sourceDocs"]
            .as_object()
            .is_some_and(|docs| docs.values().any(filled))
}

pub fn same_json_base(base: Option<&str>, value: &Value) -> bool {
    base.and_then(|raw| serde_json::from_str::<Value>(raw).ok())
        .is_some_and(|base| base == *value)
}

pub fn overlay_ops(data: &Value, overlay: &Value, key: &str) -> Option<Vec<Value>> {
    let entry = overlay.get(key)?;
    let base_revision = entry.get("baseRev")?;
    let data_revision = data.get("rev")?;
    (base_revision == data_revision)
        .then(|| entry.get("ops")?.as_array().cloned())
        .flatten()
}

pub fn source_structure(data: &mut Value, ops: &[Value]) {
    let Some(cues) = data.get_mut("cues").and_then(Value::as_array_mut) else {
        return;
    };
    for operation in ops {
        let Some(id) = operation.get("id").and_then(Value::as_str) else {
            continue;
        };
        let Some(index) = cues
            .iter()
            .position(|cue| cue.get("id").and_then(Value::as_str) == Some(id))
        else {
            continue;
        };
        match operation.get("kind").and_then(Value::as_str) {
            Some("split") => {
                let cue = cues[index].clone();
                let Some(text) = cue.get("text").and_then(Value::as_str) else {
                    continue;
                };
                if operation.get("baseText").and_then(Value::as_str) != Some(text) {
                    continue;
                }
                let offset = finite(operation.get("offset"), 0.0);
                let length = text.encode_utf16().count().max(1) as f64;
                let fraction = clamp(offset / length, 0.1, 0.9);
                let start = finite(cue.get("start"), 0.0);
                let end = finite(cue.get("end"), start);
                let middle = start + (end - start) * fraction;
                let mut upper = cue.clone();
                let mut lower = cue;
                if let Some(object) = upper.as_object_mut() {
                    object.insert("id".to_owned(), Value::String(format!("{id}a")));
                    object.insert("end".to_owned(), Value::from(middle));
                    object.insert(
                        "text".to_owned(),
                        operation.get("textA").cloned().unwrap_or(Value::Null),
                    );
                    object.remove("words");
                }
                if let Some(object) = lower.as_object_mut() {
                    object.insert("id".to_owned(), Value::String(format!("{id}b")));
                    object.insert("start".to_owned(), Value::from(middle));
                    object.insert(
                        "text".to_owned(),
                        operation.get("textB").cloned().unwrap_or(Value::Null),
                    );
                    object.remove("words");
                }
                cues.splice(index..=index, [upper, lower]);
            }
            Some("merge") if index > 0 => {
                if cues[index - 1].get("sp") != cues[index].get("sp") {
                    continue;
                }
                let previous = cues[index - 1].clone();
                let current = cues[index].clone();
                let merged_text = format!(
                    "{} {}",
                    previous.get("text").and_then(Value::as_str).unwrap_or(""),
                    current.get("text").and_then(Value::as_str).unwrap_or("")
                )
                .split_whitespace()
                .collect::<Vec<_>>()
                .join(" ");
                if let Some(object) = cues[index - 1].as_object_mut() {
                    object.insert(
                        "end".to_owned(),
                        current.get("end").cloned().unwrap_or(Value::Null),
                    );
                    object.insert("text".to_owned(), Value::String(merged_text));
                    object.remove("words");
                }
                cues.remove(index);
            }
            _ => {}
        }
    }
}

pub fn integer(value: Option<&Value>) -> Option<i64> {
    value.and_then(|value| {
        value
            .as_i64()
            .or_else(|| value.as_u64().and_then(|number| number.try_into().ok()))
    })
}

pub fn word_span(row: &Value) -> Option<(i64, i64)> {
    Some((integer(row.get("wordFrom"))?, integer(row.get("wordTo"))?))
}

pub fn source_word_fields(words: &[Value]) -> (Value, Value) {
    let ids = words
        .iter()
        .filter_map(|word| word.get("id").cloned())
        .collect::<Vec<_>>();
    let text = words
        .iter()
        .filter_map(|word| word.get("text").and_then(Value::as_str))
        .collect::<Vec<_>>()
        .join(" ");
    (Value::Array(ids), Value::String(text))
}

pub fn retime_translation_piece(
    template: &Value,
    words: Vec<Value>,
    from: i64,
    to: i64,
    text: &str,
) -> Value {
    let mut piece = template.clone();
    let (source_word_ids, source_text) = source_word_fields(&words);
    let start = words
        .first()
        .and_then(|word| word.get("start"))
        .cloned()
        .unwrap_or(Value::Null);
    let end = words
        .last()
        .and_then(|word| word.get("end"))
        .cloned()
        .unwrap_or(Value::Null);
    if let Some(object) = piece.as_object_mut() {
        object.insert("text".to_owned(), Value::String(text.to_owned()));
        object.insert("wordFrom".to_owned(), Value::from(from));
        object.insert("wordTo".to_owned(), Value::from(to));
        object.insert("start".to_owned(), start);
        object.insert("end".to_owned(), end);
        object.insert("sourceWords".to_owned(), Value::Array(words));
        object.insert("sourceWordIds".to_owned(), source_word_ids);
        object.insert("sourceText".to_owned(), source_text);
        object.insert("_edited".to_owned(), Value::Bool(true));
    }
    piece
}

pub fn translation_structure(data: &mut Value, ops: &[Value]) {
    let words_by_id = data["cues"]
        .as_array()
        .into_iter()
        .flatten()
        .flat_map(|cue| cue["words"].as_array().into_iter().flatten())
        .filter_map(|word| {
            let id = word["id"].as_str()?.to_owned();
            Some((
                id.clone(),
                json!({
                    "id": id,
                    "text": word["text"].as_str().unwrap_or_default(),
                    "start": word.get("start").or_else(|| word.get("t0")).cloned().unwrap_or(Value::Null),
                    "end": word.get("end").or_else(|| word.get("t1")).cloned().unwrap_or(Value::Null),
                }),
            ))
        })
        .collect::<std::collections::BTreeMap<_, _>>();
    let sentence_words = data["sentences"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|sentence| {
            let id = sentence["id"].as_str()?.to_owned();
            let words = sentence["sourceWordIds"]
                .as_array()
                .into_iter()
                .flatten()
                .filter_map(Value::as_str)
                .filter_map(|word_id| words_by_id.get(word_id).cloned())
                .collect::<Vec<_>>();
            Some((id, words))
        })
        .collect::<std::collections::BTreeMap<_, _>>();
    let Some(rows) = data.get_mut("transCues").and_then(Value::as_array_mut) else {
        return;
    };
    for operation in ops {
        let Some(sentence_id) = operation.get("sid").and_then(Value::as_str) else {
            continue;
        };
        let mut candidates = rows
            .iter()
            .enumerate()
            .filter(|(_, row)| {
                row.get("sid").and_then(Value::as_str) == Some(sentence_id)
                    && row.get("kind").and_then(Value::as_str) == Some("piece")
            })
            .map(|(index, _)| index)
            .collect::<Vec<_>>();
        candidates.sort_by_key(|index| word_span(&rows[*index]).map_or(0, |span| span.0));
        match operation.get("kind").and_then(Value::as_str) {
            Some("split") => {
                let Some(from) = integer(operation.get("from")) else {
                    continue;
                };
                let Some(to) = integer(operation.get("to")) else {
                    continue;
                };
                let Some(at) = integer(operation.get("at")) else {
                    continue;
                };
                let mut index = candidates.iter().copied().find(|index| {
                    word_span(&rows[*index]) == Some((from, to))
                        && rows[*index].get("text").and_then(Value::as_str)
                            == operation.get("baseText").and_then(Value::as_str)
                });
                let mut seeded_words = None;
                if index.is_none() && operation["seedUnaligned"].as_bool() == Some(true) {
                    let words = sentence_words.get(sentence_id).cloned().unwrap_or_default();
                    let whole = rows.iter().position(|row| {
                        row["sid"].as_str() == Some(sentence_id)
                            && row["kind"] == "sentence"
                            && row["text"].as_str()
                                == operation.get("baseText").and_then(Value::as_str)
                    });
                    if !words.is_empty() && from == 0 && to == words.len() as i64 - 1 {
                        index = whole;
                        seeded_words = Some(words);
                    }
                }
                let Some(index) = index else {
                    continue;
                };
                if at < from || at >= to {
                    continue;
                }
                let words = seeded_words.unwrap_or_else(|| {
                    rows[index]
                        .get("sourceWords")
                        .and_then(Value::as_array)
                        .cloned()
                        .unwrap_or_default()
                });
                let position = (at - from + 1) as usize;
                if position == 0 || position >= words.len() {
                    continue;
                }
                let Some(text_a) = operation.get("textA").and_then(Value::as_str) else {
                    continue;
                };
                let Some(text_b) = operation.get("textB").and_then(Value::as_str) else {
                    continue;
                };
                if text_a.is_empty() || text_b.is_empty() {
                    continue;
                }
                let mut template = rows[index].clone();
                template["kind"] = Value::String("piece".to_owned());
                let upper = retime_translation_piece(
                    &template,
                    words[..position].to_vec(),
                    from,
                    at,
                    text_a,
                );
                let lower = retime_translation_piece(
                    &template,
                    words[position..].to_vec(),
                    at + 1,
                    to,
                    text_b,
                );
                rows.splice(index..=index, [upper, lower]);
            }
            Some("merge") => {
                let Some(upper_span) =
                    integer(operation.get("upperFrom")).zip(integer(operation.get("upperTo")))
                else {
                    continue;
                };
                let Some(lower_span) =
                    integer(operation.get("lowerFrom")).zip(integer(operation.get("lowerTo")))
                else {
                    continue;
                };
                let upper_index = candidates.iter().copied().find(|index| {
                    word_span(&rows[*index]) == Some(upper_span)
                        && rows[*index].get("text").and_then(Value::as_str)
                            == operation.get("upperText").and_then(Value::as_str)
                });
                let lower_index = candidates.iter().copied().find(|index| {
                    word_span(&rows[*index]) == Some(lower_span)
                        && rows[*index].get("text").and_then(Value::as_str)
                            == operation.get("lowerText").and_then(Value::as_str)
                });
                let (Some(upper_index), Some(lower_index)) = (upper_index, lower_index) else {
                    continue;
                };
                if upper_span.1 + 1 != lower_span.0 {
                    continue;
                }
                let mut words = rows[upper_index]
                    .get("sourceWords")
                    .and_then(Value::as_array)
                    .cloned()
                    .unwrap_or_default();
                words.extend(
                    rows[lower_index]
                        .get("sourceWords")
                        .and_then(Value::as_array)
                        .cloned()
                        .unwrap_or_default(),
                );
                if words.is_empty() {
                    continue;
                }
                let text = join_pieces([
                    rows[upper_index]
                        .get("text")
                        .and_then(Value::as_str)
                        .unwrap_or(""),
                    rows[lower_index]
                        .get("text")
                        .and_then(Value::as_str)
                        .unwrap_or(""),
                ]);
                let mut merged = retime_translation_piece(
                    &rows[upper_index],
                    words,
                    upper_span.0,
                    lower_span.1,
                    &text,
                );
                if let Some(object) = merged.as_object_mut() {
                    object.insert(
                        "start".to_owned(),
                        rows[upper_index]
                            .get("start")
                            .cloned()
                            .unwrap_or(Value::Null),
                    );
                    object.insert(
                        "end".to_owned(),
                        rows[lower_index].get("end").cloned().unwrap_or(Value::Null),
                    );
                }
                let high = upper_index.max(lower_index);
                let low = upper_index.min(lower_index);
                rows.remove(high);
                rows.splice(low..=low, [merged]);
            }
            _ => {}
        }
        let mut updated = rows
            .iter()
            .enumerate()
            .filter(|(_, row)| {
                row.get("sid").and_then(Value::as_str) == Some(sentence_id)
                    && row.get("kind").and_then(Value::as_str) == Some("piece")
            })
            .map(|(index, _)| index)
            .collect::<Vec<_>>();
        updated.sort_by_key(|index| word_span(&rows[*index]).map_or(0, |span| span.0));
        for (piece_index, row_index) in updated.into_iter().enumerate() {
            rows[row_index]["id"] = Value::String(format!("{sentence_id}#{piece_index}"));
        }
    }
    rows.sort_by(|left, right| {
        finite(left.get("start"), 0.0).total_cmp(&finite(right.get("start"), 0.0))
    });
}

/// Pairs of characters with no space inserted between them: Han characters, kana or full-width punctuation adjacent to each other, or Hangul next to Han or kana. When both sides are Hangul, a space is added, because Korean is split into words by spaces (the same rule as `sep_len` in `ccut-flow-core`).
pub fn unspaced_pair(left: char, right: char) -> bool {
    speech_doc::atomize::unspaced_pair(left, right)
}

pub fn join_pieces<'a>(parts: impl IntoIterator<Item = &'a str>) -> String {
    let mut output = String::new();
    for part in parts.into_iter().filter(|part| !part.is_empty()) {
        let separated = output
            .chars()
            .last()
            .zip(part.chars().next())
            .is_some_and(|(left, right)| !unspaced_pair(left, right));
        if separated {
            output.push(' ');
        }
        output.push_str(part);
    }
    output
}

pub fn apply_preview_overlays(data: &mut Value, overlay: &Value) {
    let source_ops = overlay_ops(data, overlay, "struct");
    let translation_ops = overlay_ops(data, overlay, "transStruct");
    let base_starts = data["cues"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|cue| {
            Some((
                cue.get("id")?.as_str()?.to_owned(),
                cue.get("start")?.as_f64()?,
            ))
        })
        .collect::<std::collections::BTreeMap<_, _>>();
    if let Some(ops) = source_ops.as_deref() {
        source_structure(data, ops);
    }

    if let (Some(cues), Some(edits)) = (data["cues"].as_array_mut(), overlay["edits"].as_object()) {
        for cue in cues {
            let Some(id) = cue["id"].as_str() else {
                continue;
            };
            let Some(edit) = edits.get(id).and_then(|entry| entry.get("text")) else {
                continue;
            };
            if cue["text"].as_str() == edit["base"].as_str()
                && let Some(value) = edit["value"].as_str()
            {
                cue["text"] = Value::String(value.to_owned());
                cue.as_object_mut().map(|object| object.remove("words"));
            }
        }
    }

    if let (Some(cues), Some(timing)) = (data["cues"].as_array_mut(), overlay["timing"].as_object())
    {
        for cue in cues {
            let Some(id) = cue["id"].as_str() else {
                continue;
            };
            let Some(edit) = timing.get(id) else {
                continue;
            };
            let Some(base) = edit["base"].as_array() else {
                continue;
            };
            let Some(value) = edit["value"].as_array() else {
                continue;
            };
            if base.len() == 2
                && value.len() == 2
                && base_starts.get(id).copied() == base[0].as_f64()
                && let (Some(start), Some(end)) = (value[0].as_f64(), value[1].as_f64())
            {
                cue["start"] = Value::from(start);
                cue["end"] = Value::from(end);
                cue.as_object_mut().map(|object| object.remove("words"));
            }
        }
    }

    let trans = overlay["trans"].as_object();
    if let (Some(rows), Some(trans)) = (data["transCues"].as_array_mut(), trans) {
        for row in rows.iter_mut() {
            let Some(id) = row["id"].as_str() else {
                continue;
            };
            let Some(edit) = trans.get(id) else {
                continue;
            };
            if edit["kind"] == "piece"
                && row["text"].as_str() == edit["base"].as_str()
                && let Some(value) = edit["value"].as_str()
            {
                row["text"] = Value::String(value.to_owned());
                row["_edited"] = Value::Bool(true);
            }
        }
    }
    if let Some(ops) = translation_ops.as_deref() {
        translation_structure(data, ops);
    }

    let sentence_ids = data["sentences"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|sentence| sentence["id"].as_str().map(str::to_owned))
        .collect::<Vec<_>>();
    for id in sentence_ids {
        let sentence_index = data["sentences"].as_array().and_then(|sentences| {
            sentences
                .iter()
                .position(|sentence| sentence["id"].as_str() == Some(id.as_str()))
        });
        let Some(sentence_index) = sentence_index else {
            continue;
        };
        let edit = trans.and_then(|trans| trans.get(&id));
        let sentence_edit = edit.is_some_and(|edit| {
            edit["kind"] == "sentence"
                && data["sentences"][sentence_index]["trans"].as_str() == edit["base"].as_str()
        });
        if sentence_edit {
            let edit = edit.unwrap();
            if let Some(value) = edit["value"].as_str() {
                let value = value.to_owned();
                let sentence = &mut data["sentences"][sentence_index];
                sentence["trans"] = Value::String(value.clone());
                sentence["aligned"] = Value::Bool(false);
                sentence["_editedTrans"] = Value::Bool(true);
                let start = finite(sentence.get("start"), 0.0);
                let end = finite(sentence.get("end"), start);
                if let Some(rows) = data["transCues"].as_array_mut() {
                    rows.retain(|row| row["sid"].as_str() != Some(id.as_str()));
                    rows.push(serde_json::json!({
                        "id": id, "sid": id, "kind": "sentence", "text": value,
                        "start": start, "end": end, "_edited": true,
                    }));
                    rows.sort_by(|left, right| {
                        finite(left.get("start"), 0.0).total_cmp(&finite(right.get("start"), 0.0))
                    });
                }
            }
            continue;
        }
        let pieces = data["transCues"]
            .as_array()
            .into_iter()
            .flatten()
            .filter(|row| row["sid"].as_str() == Some(id.as_str()) && row["kind"] == "piece")
            .collect::<Vec<_>>();
        if pieces
            .iter()
            .any(|row| row["_edited"].as_bool() == Some(true))
        {
            data["sentences"][sentence_index]["trans"] = Value::String(join_pieces(
                pieces.iter().filter_map(|row| row["text"].as_str()),
            ));
            data["sentences"][sentence_index]["_editedTrans"] = Value::Bool(true);
        }
    }

    if let Some(style) = overlay.get("style")
        && same_json_base(style["base"].as_str(), &data["style"])
        && let (Some(current), Some(patch)) =
            (data["style"].as_object_mut(), style["value"].as_object())
    {
        current.extend(patch.clone());
    }
}

pub fn timing(style: &Value) -> (f64, f64) {
    let value = style.get("displayTiming").unwrap_or(&Value::Null);
    (
        finite(value.get("leadIn"), DEFAULT_LEAD_IN).max(0.0),
        finite(value.get("tail"), DEFAULT_TAIL).max(0.0),
    )
}

pub fn display_padding(buffer: f64, gap: f64, lead_in: f64, tail: f64) -> f64 {
    let cap = lead_in + tail;
    if cap <= 0.0 {
        return 0.0;
    }
    buffer.max(0.0).min(gap.max(0.0) * buffer.max(0.0) / cap)
}

/// Display spacing does not depend on the punctuation switch or the language tag: source subtitles, translations and imported subtitles can all be mixed-script. A space is added only at the direct boundary between Han or kana and ASCII letters or digits. Text content, case and word timings are not changed.
pub fn projected_text(text: &str, language: &str, enabled: bool) -> String {
    let text = if enabled {
        target_delivery_projection(text, language)
    } else {
        text.to_owned()
    };
    speech_doc::autocorrect::display_spacing(&text)
}

pub fn derived_words(
    item: &Value,
    text: &str,
    start: f64,
    end: f64,
    language: &str,
    project_punctuation: bool,
) -> Vec<Word> {
    let explicit: Vec<Word> = item["words"]
        .as_array()
        .into_iter()
        .flatten()
        .enumerate()
        .filter_map(|(index, word)| {
            Some(Word {
                id: word
                    .get("id")
                    .and_then(Value::as_str)
                    .map(str::to_owned)
                    .unwrap_or_else(|| format!("word-{index}")),
                text: projected_text(word.get("text")?.as_str()?, language, project_punctuation),
                start: word
                    .get("t0")
                    .or_else(|| word.get("start"))
                    .and_then(Value::as_f64)
                    .unwrap_or(start),
                end: word.get("t1").or_else(|| word.get("end"))?.as_f64()?,
            })
        })
        .collect();
    if !explicit.is_empty() {
        return explicit;
    }
    // When there is no per-word timing, split by display spacing. Otherwise a mixed-script sentence without spaces would be treated as one word, and wrapping and highlight extrapolation would differ from the same sentence written with explicit spaces. Existing word IDs and timings are unchanged.
    let spaced = speech_doc::autocorrect::display_spacing(text);
    let tokens: Vec<&str> = spaced
        .split_whitespace()
        .filter(|token| !token.is_empty())
        .collect();
    let weights: Vec<f64> = tokens
        .iter()
        .map(|token| {
            token
                .chars()
                .filter(|character| character.is_alphanumeric() || *character == '\'')
                .count()
                .max(2) as f64
                + 1.4
        })
        .collect();
    let total = weights.iter().sum::<f64>().max(1.0);
    let duration = (end - start).max(0.01);
    let mut elapsed = 0.0;
    tokens
        .iter()
        .zip(weights)
        .enumerate()
        .map(|(index, (token, weight))| {
            let word_start = start + duration * elapsed / total;
            elapsed += weight;
            Word {
                id: format!("derived-{index}"),
                text: projected_text(token, language, project_punctuation),
                start: word_start,
                end: start + duration * elapsed / total,
            }
        })
        .collect()
}

pub fn timed_items(
    values: &[Value],
    text_key: &'static str,
    style: &Value,
    language: &str,
) -> Vec<TimedItem> {
    let values = values
        .iter()
        .map(|item| TimedInput {
            item,
            text_key,
            language,
        })
        .collect::<Vec<_>>();
    timed_inputs(&values, style)
}

/// The id a drawing input gets when it becomes a [`TimedItem`]: `id`, else `sid`, else a number from its position in the input slice (`index` is the index **before filtering**). Per-item styles must look this id back up from the original entry, so both sites must go through the same function.
pub fn timed_input_id(item: &Value, text_key: &str, index: usize) -> String {
    item.get("id")
        .or_else(|| item.get("sid"))
        .and_then(Value::as_str)
        .map(str::to_owned)
        .unwrap_or_else(|| format!("{text_key}-{index}"))
}

pub fn timed_inputs(values: &[TimedInput<'_>], style: &Value) -> Vec<TimedItem> {
    let (lead_in, tail) = timing(style);
    let project_punctuation = style.get("punct").and_then(Value::as_bool).unwrap_or(true);
    let mut base: Vec<(String, String, f64, f64, Vec<Word>)> = values
        .iter()
        .enumerate()
        .filter_map(|(index, input)| {
            let item = input.item;
            let raw_text = item.get(input.text_key)?.as_str()?.to_owned();
            let text = projected_text(&raw_text, input.language, project_punctuation);
            if text.trim().is_empty() {
                return None;
            }
            let start = finite(item.get("start"), 0.0);
            let end = finite(item.get("end"), start).max(start);
            Some((
                timed_input_id(item, input.text_key, index),
                text.clone(),
                start,
                end,
                derived_words(
                    item,
                    &raw_text,
                    start,
                    end,
                    input.language,
                    project_punctuation,
                ),
            ))
        })
        .collect();
    base.sort_by(|left, right| left.2.total_cmp(&right.2));
    (0..base.len())
        .map(|index| {
            let previous_gap = if index > 0 {
                base[index].2 - base[index - 1].3
            } else {
                f64::INFINITY
            };
            let next_gap = if index + 1 < base.len() {
                base[index + 1].2 - base[index].3
            } else {
                f64::INFINITY
            };
            TimedItem {
                id: base[index].0.clone(),
                series_index: index as u32,
                text: base[index].1.clone(),
                display_start: base[index].2
                    - display_padding(lead_in, previous_gap, lead_in, tail),
                display_end: base[index].3 + display_padding(tail, next_gap, lead_in, tail),
                words: base[index].4.clone(),
            }
        })
        .collect()
}

pub fn active_at(items: &[TimedItem], time: f64) -> Option<&TimedItem> {
    let next = items.partition_point(|item| item.display_start <= time);
    next.checked_sub(1)
        .and_then(|index| items.get(index))
        .filter(|item| time < item.display_end)
}

pub fn merged_line_style(root: &Value, kind: LineKind) -> Value {
    let mut merged = root.as_object().cloned().unwrap_or_default();
    let key = match kind {
        LineKind::Original => "origStyle",
        LineKind::Translation => "transStyle",
    };
    if let Some(overrides) = root.get(key).and_then(Value::as_object) {
        merged.extend(overrides.clone());
    }
    Value::Object(merged)
}

/// Line-level position override: `origStyle.x/y` and `transStyle.x/y` are frame-percentage positions of the centre of that line's text block.
///
/// It must read the partial explicitly and must not go through [`merged_line_style`]: the merged result always carries the root node's anchor `x`/`y`, so every line would be judged as “overridden”, and the stack would collapse onto the anchor as a whole.
/// x and y must both be present and finite to count as an override (contract: both must be present to leave the stack). So `finite()` cannot be used here either, because it would fill `null`/NaN with defaults and invent an override out of nothing.
///
/// A line-level position only has meaning in a bilingual context. Single-line export must ignore leftover overrides, otherwise one bilingual placement would also move the only line in orig/trans single-line mode.
pub fn line_position_override(
    root: &Value,
    kind: LineKind,
    mode: StudioMode,
) -> Option<(f64, f64)> {
    if mode != StudioMode::Bilingual {
        return None;
    }
    let overrides = match kind {
        LineKind::Original => root.get("origStyle"),
        LineKind::Translation => root.get("transStyle"),
    }?;
    let coordinate = |key: &str| {
        overrides
            .get(key)
            .and_then(Value::as_f64)
            .filter(|value| value.is_finite())
    };
    Some((coordinate("x")?, coordinate("y")?))
}

/// Vertical anchor: which edge of the text block (or of a row within a slot) hangs on the anchor line.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum VerticalAlign {
    Top,
    Center,
    Bottom,
}

/// A strict allowlist: only the three strings `"top" | "center" | "bottom"` are accepted, and anything else is absent.
///
/// Absent is not a synonym for center. It also means “use the seam rule”. So this must return an `Option`, to distinguish “explicitly wrote center” from “wrote nothing”. Numbers, booleans and misspelt strings are all treated as not written, which is isomorphic to the JS preview's `typeof === 'string'` check.
pub fn vertical_align_from_str(value: &str) -> Option<VerticalAlign> {
    match value {
        "top" => Some(VerticalAlign::Top),
        "center" => Some(VerticalAlign::Center),
        "bottom" => Some(VerticalAlign::Bottom),
        _ => None,
    }
}

/// The JSON-side [`vertical_align_from_str`]: non-strings are treated as not written.
pub fn parse_vertical_align(value: Option<&Value>) -> Option<VerticalAlign> {
    vertical_align_from_str(value?.as_str()?)
}

/// Line-level vertical anchor: `origStyle.verticalAlign` / `transStyle.verticalAlign`.
///
/// Isomorphic to [`line_position_override`], with the same two rules copied over:
/// - Read only the partial, not via [`merged_line_style`]. The merged result would carry the root node's block-level anchor, so every line would be judged as “explicitly specified”, and the seam rule would never get a turn.
/// - Consumed only in a bilingual context. Single-line export must ignore leftover line-level anchors, otherwise one bilingual placement would also move the only line in orig/trans single-line mode.
pub fn line_vertical_align(
    root: &Value,
    kind: LineKind,
    mode: StudioMode,
) -> Option<VerticalAlign> {
    if mode != StudioMode::Bilingual {
        return None;
    }
    let overrides = match kind {
        LineKind::Original => root.get("origStyle"),
        LineKind::Translation => root.get("transStyle"),
    }?;
    parse_vertical_align(overrides.get("verticalAlign"))
}

/// The per-item style override table's keys on the root style (§16.3.1):
/// `style.cueStyles[source entry id]["source" | "translation"] = {…sparse fields}`.
///
/// Absent means the line follows the whole track. `{}` means detached but with nothing changed, which renders pixel-identical to following.
pub const CUE_STYLES_KEY: &str = "cueStyles";

/// The key in the override table that distinguishes the source layer from the translation layer.
pub fn cue_style_track(kind: LineKind) -> &'static str {
    match kind {
        LineKind::Original => "source",
        LineKind::Translation => "translation",
    }
}

/// The override table for one source entry on one line; `None` when it is not detached.
pub fn cue_style_partial<'a>(
    root: &'a Value,
    kind: LineKind,
    source_id: &str,
) -> Option<&'a serde_json::Map<String, Value>> {
    root.get(CUE_STYLES_KEY)?
        .get(source_id)?
        .get(cue_style_track(kind))?
        .as_object()
}

/// The root style used to draw this one caption: the whole track's style with its own override table laid on top.
///
/// When the override table is empty or absent, returns `None`, and the caller uses the whole track's copy directly, without copying the root style needlessly.
/// The overlay method matches the reading method of [`merged_line_style`] / [`resolve_line_style`]:
/// - Bilingual: the override is written into this line's own partial (`origStyle` / `transStyle`), and the other line is unaffected. A line-level position counts as detached from the stack only when both x and y are present. If only one is given, the other takes the track's current value.
/// - Single-line: the override is written into the root node at the same time (anchor x/y/verticalAlign and root font size are read from the root). It overrides the same-named keys already in both partials, otherwise the partials would overwrite the override back.
///
/// The `cueStyles` key itself is removed from the result, since copying the whole table for each override would be O(n²).
pub fn cue_root(root: &Value, kind: LineKind, source_id: &str, mode: StudioMode) -> Option<Value> {
    let partial = cue_style_partial(root, kind, source_id).filter(|partial| !partial.is_empty())?;
    let mut next = root.as_object().cloned().unwrap_or_default();
    next.remove(CUE_STYLES_KEY);
    if mode == StudioMode::Bilingual {
        let line_key = match kind {
            LineKind::Original => "origStyle",
            LineKind::Translation => "transStyle",
        };
        let mut line = next
            .get(line_key)
            .and_then(Value::as_object)
            .cloned()
            .unwrap_or_default();
        let (has_x, has_y) = (partial.contains_key("x"), partial.contains_key("y"));
        if has_x != has_y {
            let (missing, fallback) = if has_x { ("y", 86.0) } else { ("x", 50.0) };
            if !line.contains_key(missing) {
                let merged = merged_line_style(root, kind);
                line.insert(
                    missing.to_owned(),
                    json!(finite(merged.get(missing), fallback)),
                );
            }
        }
        line.extend(partial.clone());
        next.insert(line_key.to_owned(), Value::Object(line));
    } else {
        for line_key in ["origStyle", "transStyle"] {
            if let Some(line) = next.get_mut(line_key).and_then(Value::as_object_mut) {
                for (key, value) in partial {
                    if line.contains_key(key) {
                        line.insert(key.clone(), value.clone());
                    }
                }
            }
        }
        next.extend(partial.clone());
    }
    Some(Value::Object(next))
}

pub fn font_name(style: &Value) -> String {
    let value = style
        .get("fontFamily")
        .and_then(|value| {
            value
                .as_str()
                .or_else(|| value.get("fontFamily").and_then(Value::as_str))
        })
        .unwrap_or("system");
    let mapped = match value {
        "system" => "Noto Sans SC",
        "montserrat" => "Montserrat",
        "bebas" => "Bebas Neue",
        "lexend" => "Lexend Deca",
        "serif" => "Source Serif 4",
        // SwiftPM writes a stable internal family for UI fonts. The style model still keeps the product name the user sees, and MP4 shaping lands on the family actually bundled here.
        "Source Sans 3" => "VK Sans",
        "Source Code Pro" => "VK Code",
        other => other,
    };
    let sanitized = mapped
        .chars()
        .filter(|character| !matches!(character, '\\' | '{' | '}' | '\r' | '\n'))
        .collect::<String>();
    (!sanitized.trim().is_empty())
        .then_some(sanitized)
        .unwrap_or_else(|| "Noto Sans SC".to_owned())
}

pub fn resolve_line_style(
    root: &Value,
    kind: LineKind,
    width: u32,
    height: u32,
    compact_original: bool,
) -> LineStyle {
    let style = merged_line_style(root, kind);
    let size_basis = if style.get("fontSizeBasis").and_then(Value::as_str) == Some("height") {
        height
    } else {
        width.min(height)
    };
    let canvas_scale =
        (f64::from(size_basis) / REFERENCE_SHORT_EDGE) * finite(root.get("scale"), 1.0).max(0.05);
    let explicit_size = match kind {
        LineKind::Original => root.get("origStyle"),
        LineKind::Translation => root.get("transStyle"),
    }
    .and_then(Value::as_object)
    .and_then(|value| value.get("fontSize"))
    .and_then(Value::as_f64)
    .map(|size| size.max(1.0));
    let base = finite(root.get("fontSize"), REFERENCE_FONT_SIZE).max(1.0);
    let bilingual_scale =
        finite(root.get("bilingualOrigScale"), DEFAULT_BILINGUAL_ORIG_SCALE).max(0.1);
    let logical_size = explicit_size.unwrap_or_else(|| match kind {
        LineKind::Translation => {
            base * bilingual_scale
                * finite(root.get("transScale"), DEFAULT_TRANSLATION_RATIO).max(0.1)
        }
        LineKind::Original if compact_original => base * bilingual_scale,
        LineKind::Original => base,
    });
    let font_size = logical_size * canvas_scale;
    let outline = style.get("textOutline").unwrap_or(&Value::Null);
    let outline_color = SubtitleColor::parse(
        outline.get("color"),
        SubtitleColor {
            r: 0,
            g: 0,
            b: 0,
            a: 31,
        },
    );
    let outline_on = outline
        .get("on")
        .and_then(Value::as_bool)
        .or_else(|| style.get("outline").and_then(Value::as_bool))
        .unwrap_or_else(|| finite(outline.get("width"), 0.0) > 0.0 && outline_color.a < 252);
    // The persisted `textOutline.width` is the **visible outset** as a percentage of the font size, not the line width. Mac `StagePaneView` writes `.strokeWidth = -width * 0.5` (AppKit's negative stroke is centred across the contour, and its unit is a percentage of the font size). Line width = width/100·fontSize·0.5, and the outset is exactly half of it. Here the full centred line width is stored; the tiny-skia stroke in `raster` and the outset in `ass_style` both derive from it. Missing the 0.5 would make the burned-in outline twice as thick as the preview.
    let outline_width = finite(
        outline.get("width"),
        if style.get("outline").and_then(Value::as_bool) == Some(true) {
            14.0
        } else {
            0.0
        },
    )
    .max(0.0)
        * font_size
        / 100.0
        * 0.5;
    let shadow = style.get("dropShadow").unwrap_or(&Value::Null);
    let legacy_outline = style.get("outline").and_then(Value::as_bool) == Some(true);
    let shadow_on = shadow
        .get("on")
        .and_then(Value::as_bool)
        .unwrap_or_else(|| {
            finite(shadow.get("blur"), 0.0) > 0.0 || finite(shadow.get("distance"), 0.0) > 0.0
        });
    let shadow_distance = finite(shadow.get("distance"), 0.04).max(0.0) * font_size;
    let shadow_angle = finite(shadow.get("rotation"), 90.0).to_radians();
    let shadow_color = SubtitleColor::parse(shadow.get("color"), SubtitleColor::BLACK)
        .with_opacity(finite(
            shadow.get("opacity"),
            if legacy_outline { 0.48 } else { 0.6 },
        ));
    let glow = style.get("glow").unwrap_or(&Value::Null);
    let glow_on = glow
        .get("on")
        .and_then(Value::as_bool)
        .unwrap_or_else(|| finite(glow.get("intensity"), 0.0) > 0.0);
    // The blur radius is **not capped**. Neither the prototype nor the Web preview caps it: `panel-substyle.jsx`'s `filter: drop-shadow()` takes the range directly. Capping it once would mean “soft in the preview, hard in burn-in”. The panel's glow range maximum is 100 (⇒ 0.9·fontSize), and the shadow blur maximum is 0.5 (⇒ 0.5·fontSize), so the adjustable range already falls within the old cap. Clamping only affected hand-written JSON, and that is exactly where large-blur recipes such as Bulb and Vegas were cut down. The lower bound still keeps 1px, since a 0-radius box blur is meaningless.
    // Known gap: glow and shadow share the same effect slot, so when `glow_on` the shadow is dropped entirely. On the Mac preview, the shadowed outline is still drawn after the glow pass (`SubtitleFrameDrawing.swift:544-551`), and the two can stack. Splitting them into two slots would require changing the DrawOp structure in render_plan, which is outside the scope of this fix.
    let (effect_on, effect_color, effect_x, effect_y, effect_blur) = if glow_on {
        (
            true,
            SubtitleColor::parse(glow.get("color"), SubtitleColor::WHITE)
                .with_opacity(finite(glow.get("intensity"), 50.0) / 100.0),
            0.0,
            0.0,
            (finite(glow.get("range"), 40.0) / 100.0 * font_size * 0.9).max(1.0),
        )
    } else if shadow_on {
        (
            true,
            shadow_color,
            shadow_angle.cos() * shadow_distance,
            shadow_angle.sin() * shadow_distance,
            finite(shadow.get("blur"), if legacy_outline { 0.12 } else { 0.08 }).max(0.0)
                * font_size,
        )
    } else {
        (false, SubtitleColor::BLACK, 0.0, 0.0, 0.0)
    };
    let background_on = style
        .get("background")
        .and_then(Value::as_bool)
        .or_else(|| style.get("bgOn").and_then(Value::as_bool))
        .unwrap_or_else(|| {
            style
                .get("backgroundColor")
                .and_then(Value::as_str)
                .and_then(parse_css_color)
                .is_some_and(|color| color.a < 252)
        });
    // The `block` plate affects only the minimum width (`background_min_width` below). **It no longer adjusts vertical padding separately**: the prototype `padOf` has only one `pad`, so the horizontal-to-vertical ratio is always [`PLATE_PAD_ASPECT`].
    let block_background =
        style.get("backgroundStyle").and_then(Value::as_str) == Some("block") && background_on;
    // Plate padding, corner radius and letter-spacing are all normalised to **this line's own font size** (see [`REFERENCE_FONT_SIZE`]).
    let size_scale = font_size / REFERENCE_FONT_SIZE;
    let background_pad_h = finite(style.get("backgroundPadding"), 10.0).max(0.0) * size_scale * 0.8;
    let font_weight = style
        .get("fontWeight")
        .and_then(|value| {
            value.as_u64().map(|value| value as u16).or_else(|| {
                value.as_str().map(|value| {
                    value.parse::<u16>().unwrap_or_else(|_| match value {
                        "medium" => 500,
                        "semibold" => 600,
                        "bold" => 700,
                        "extrabold" | "heavy" => 800,
                        "black" => 900,
                        _ => 400,
                    })
                })
            })
        })
        .unwrap_or(400)
        .clamp(100, 900);
    let bold = style.get("bold").and_then(Value::as_bool).unwrap_or(false);
    let font_weight = if bold {
        font_weight.max(700)
    } else {
        font_weight
    };
    LineStyle {
        shaped_italic: size_basis == height
            && style.get("fontSizeBasis").and_then(Value::as_str) == Some("height")
            && style
                .get("italic")
                .and_then(Value::as_bool)
                .unwrap_or(false),
        text_motion: style
            .get("textMotion")
            .filter(|v| !v.is_null())
            .and_then(|v| {
                serde_json::from_value::<motion::text_motion::TextMotion>(v.clone()).ok()
            })
            .and_then(|m| m.compile().ok())
            .map(Arc::new),
        word_background: style
            .get("wordBackground")
            .filter(|v| !v.is_null())
            .and_then(|v| serde_json::from_value(v.clone()).ok()),
        font_name: font_name(&style),
        font_size,
        font_weight,
        color: SubtitleColor::parse(
            style.get("fontColor").or_else(|| root.get("fontColor")),
            SubtitleColor::WHITE,
        ),
        bold: font_weight >= 700,
        italic: style
            .get("italic")
            .and_then(Value::as_bool)
            .unwrap_or(false)
            || style.get("fontStyle").and_then(Value::as_str) == Some("italic"),
        underline: style
            .get("underline")
            .and_then(Value::as_bool)
            .unwrap_or(false),
        letter_spacing: finite(style.get("letterSpacing"), 0.0) * size_scale,
        outline_on,
        outline_color,
        outline_width,
        effect_on,
        effect_color,
        effect_x,
        effect_y,
        effect_blur,
        background_on,
        background_color: SubtitleColor::parse(
            style
                .get("backgroundColor")
                .or_else(|| root.get("backgroundColor")),
            SubtitleColor {
                r: 0,
                g: 0,
                b: 0,
                a: 51,
            },
        ),
        background_pad_h,
        background_pad_v: style
            .get("backgroundPaddingY")
            .and_then(Value::as_f64)
            .filter(|v| v.is_finite() && *v >= 0.0)
            .map_or(background_pad_h / PLATE_PAD_ASPECT, |v| {
                v * size_scale * 0.8
            }),
        background_radius: style
            .get("borderRadius")
            .and_then(Value::as_f64)
            .filter(|value| value.is_finite())
            .map_or(background_pad_h, |value| value.max(0.0) * size_scale * 0.55),
        block_background,
        background_min_width: if block_background {
            f64::from(width) * 0.28
        } else {
            0.0
        },
        line_height: finite(style.get("lineHeight"), 1.2).max(0.5),
        text_transform: style
            .get("textTransform")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_owned(),
        emphasis: emphasis_look(&style),
    }
}

fn transform_text_chunk(text: &str, transform: &str, capitalize_next: &mut bool) -> String {
    match transform {
        "uppercase" => text.to_uppercase(),
        "lowercase" => text.to_lowercase(),
        // CSS `text-transform: capitalize` uppercases the first character after the start or
        // whitespace and preserves every remaining character verbatim. In particular, ACME
        // stays `ACME`; forcing the tail to lowercase would diverge from the Web preview.
        "title" | "capitalize" => {
            let mut output = String::with_capacity(text.len());
            for character in text.chars() {
                if *capitalize_next && !character.is_whitespace() {
                    output.extend(character.to_uppercase());
                } else {
                    output.push(character);
                }
                *capitalize_next = character.is_whitespace();
            }
            output
        }
        _ => text.to_owned(),
    }
}

pub fn transform_text(text: &str, transform: &str) -> String {
    transform_text_chunk(text, transform, &mut true)
}

pub fn transition_duration(style: &Value) -> f64 {
    let transition = style.get("transition").unwrap_or(&Value::Null);
    let id = transition
        .get("transitionId")
        .or_else(|| transition.get("id"))
        .and_then(Value::as_str)
        .or_else(|| style.get("transitionId").and_then(Value::as_str))
        .unwrap_or("none");
    let speed = clamp(
        finite(
            transition
                .get("transitionSpeed")
                .or_else(|| transition.get("speed"))
                .or_else(|| style.get("transitionSpeed")),
            50.0,
        ),
        0.0,
        100.0,
    );
    let (maximum, minimum) = match id {
        "magic-fade" => (0.15, 0.35),
        "magic-pop" | "magic-flip" => (0.01, 0.19),
        _ => return 0.0,
    };
    maximum + (minimum - maximum) * ((100.0 - speed) / 100.0)
}

pub fn visual_from_json(value: &Value) -> WordVisual {
    WordVisual {
        color: value
            .get("color")
            .and_then(Value::as_str)
            .and_then(parse_css_color),
        opacity: value.get("opacity").and_then(Value::as_f64),
        background: value
            .get("backgroundColor")
            .and_then(Value::as_str)
            .and_then(parse_css_color),
        border_radius_em: value.get("borderRadiusEm").and_then(Value::as_f64),
        underline: value.get("underline").and_then(Value::as_bool),
        underline_offset_em: value.get("underlineOffsetEm").and_then(Value::as_f64),
        bottom_em: value.get("bottomEm").and_then(Value::as_f64),
        shadow_off: value
            .get("shadowOff")
            .and_then(Value::as_bool)
            .unwrap_or(false),
        // Curves are not part of the three-tier merge; see [`WordBoxTrack`].
        box_scale: None,
        box_opacity: None,
        recipe: None,
    }
}

pub fn merge_visual(base: &mut WordVisual, extra: WordVisual) {
    if extra.color.is_some() {
        base.color = extra.color;
    }
    if extra.opacity.is_some() {
        base.opacity = extra.opacity;
    }
    if extra.background.is_some() {
        base.background = extra.background;
    }
    if extra.border_radius_em.is_some() {
        base.border_radius_em = extra.border_radius_em;
    }
    if extra.underline.is_some() {
        base.underline = extra.underline;
    }
    if extra.underline_offset_em.is_some() {
        base.underline_offset_em = extra.underline_offset_em;
    }
    if extra.bottom_em.is_some() {
        base.bottom_em = extra.bottom_em;
    }
    if extra.box_scale.is_some() {
        base.box_scale = extra.box_scale;
    }
    if extra.box_opacity.is_some() {
        base.box_opacity = extra.box_opacity;
    }
    base.shadow_off |= extra.shadow_off;
}

pub fn designed_caption(style: &Value, animation: &Value) -> Option<DesignedCaption> {
    let caption = animation.get("caption")?.as_object()?;
    let style_id = caption
        .get("style")
        .and_then(|value| value.get("id"))
        .and_then(Value::as_str)?
        .to_owned();
    if !style_id.starts_with("caption-") {
        return None;
    }
    let palette = caption.get("palette").unwrap_or(&Value::Null);
    let mut overrides = HashMap::new();
    for (id, role, color, value) in caption_emphasis_words(style) {
        overrides.insert(
            id.clone(),
            CaptionWordOverride {
                role: role.to_owned(),
                color,
                emoji: value
                    .get("emoji")
                    .and_then(Value::as_str)
                    .map(str::to_owned),
            },
        );
    }
    Some(DesignedCaption {
        style_id,
        style_version: caption
            .get("style")
            .and_then(|value| value.get("version"))
            .and_then(Value::as_u64)
            .unwrap_or(1) as u32,
        content: caption
            .get("content")
            .and_then(Value::as_str)
            .unwrap_or("orig")
            .to_owned(),
        primary: SubtitleColor::parse(palette.get("primary"), SubtitleColor::WHITE),
        accent: SubtitleColor::parse(
            palette.get("accent"),
            parse_css_color("#FFD43B").unwrap_or(SubtitleColor::WHITE),
        ),
        secondary: SubtitleColor::parse(
            palette.get("secondary"),
            SubtitleColor::parse(
                palette.get("accent"),
                parse_css_color("#FFD43B").unwrap_or(SubtitleColor::WHITE),
            ),
        ),
        intensity: (finite(caption.get("intensity"), 60.0) / 100.0).clamp(0.0, 1.0),
        speed: finite(caption.get("speed"), 1.0).clamp(0.35, 2.0),
        seed: caption.get("seed").and_then(|value| {
            value.as_u64().or_else(|| {
                value
                    .as_f64()
                    .filter(|value| value.is_finite() && *value >= 0.0)
                    .map(|value| value as u64)
            })
        }),
        options: caption
            .get("options")
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default(),
        overrides,
        sequences: CaptionSequenceIntent::from_style(style),
    })
}

pub fn word_animation(style: &Value) -> WordAnimation {
    let value = style
        .get("wordAnimation")
        .or_else(|| style.get("anim"))
        .unwrap_or(&Value::Null);
    let explicit = !value.is_null();
    let name = value
        .get("animationName")
        .or_else(|| value.get("name"))
        .and_then(Value::as_str)
        .unwrap_or(if explicit { "None" } else { "Color" })
        .to_owned();
    let caption = designed_caption(style, value);
    let mut animation = WordAnimation {
        motion_id: value
            .get("catalogId")
            .and_then(Value::as_str)
            .filter(|id| word_motion::by_id(id).is_some() && *id != "none")
            .map(str::to_owned),
        name: if caption.is_some() {
            "Designed".to_owned()
        } else {
            name.clone()
        },
        spoken: WordVisual::default(),
        active: WordVisual::default(),
        unspoken: WordVisual::default(),
        box_track: word_box_track(&value["active"]),
        caption,
    };
    match name.as_str() {
        "Color" => {
            animation.active.color = parse_css_color(if explicit {
                "#FFD43B"
            } else {
                style
                    .get("karaokeColor")
                    .and_then(Value::as_str)
                    .unwrap_or("#8CAAFF")
            });
        }
        "Highlight" => {
            animation.active.background = parse_css_color("#FFD43B");
            animation.active.color = parse_css_color("#0D0D0D");
            animation.active.border_radius_em = Some(0.25);
        }
        "Reveal" => {
            animation.unspoken.color = parse_css_color("transparent");
            animation.unspoken.shadow_off = true;
            animation.unspoken.underline = Some(false);
            animation.unspoken.opacity = Some(0.0);
        }
        // Pure opacity tiers (the prototype `model-subanim.js` `karaokeV2` / `highlight`).
        //
        // **Neither has a plate, and neither changes colour.** Among the colour parameters, only three take a colour: `colourHighlight` as the text colour, and `boxHighlight` / `bgHighlight` as the box colour. Karaoke and highlighter are neither of these. Each has only one `colour.a` curve, so only `opacity` is written here. `background` / `color` are not written, so `classic_word_box` will not draw a box, and the panel side's `accent_bindings` has no colour row to offer.
        "Karaoke" => {
            animation.spoken.opacity = Some(1.0);
            animation.active.opacity = Some(1.0);
            animation.unspoken.opacity = Some(0.5);
        }
        "Highlighter" => {
            animation.spoken.opacity = Some(0.5);
            animation.active.opacity = Some(1.0);
            animation.unspoken.opacity = Some(0.5);
        }
        "Bounce" => animation.active.bottom_em = Some(0.22),
        "Paint" => {
            animation.spoken.color = parse_css_color("#FFD43B");
            animation.spoken.underline = Some(true);
            animation.spoken.underline_offset_em = Some(0.18);
        }
        "Custom" => {
            animation.spoken.color = parse_css_color("#2EC971");
            animation.active.background = parse_css_color("#FFD43B");
            animation.active.color = parse_css_color("#0D0D0D");
            animation.active.border_radius_em = Some(0.25);
            animation.unspoken.opacity = Some(0.5);
        }
        _ => {}
    }
    merge_visual(&mut animation.spoken, visual_from_json(&value["spoken"]));
    merge_visual(&mut animation.active, visual_from_json(&value["active"]));
    merge_visual(
        &mut animation.unspoken,
        visual_from_json(&value["unspoken"]),
    );
    animation
}

/// The three-tier merge of the classic per-word animation. `phase` is the phase **within the current word's own window** (0–1), consumed only by [`WordAnimation::box_track`]. Effects without a track are immune to it, whatever is passed.
pub fn word_state(
    animation: &WordAnimation,
    index: usize,
    current: usize,
    phase: f64,
) -> WordVisual {
    let mut value = WordVisual::default();
    if index <= current {
        merge_visual(&mut value, animation.spoken.clone());
    }
    if index == current {
        merge_visual(&mut value, animation.active.clone());
    }
    if index > current {
        merge_visual(&mut value, animation.unspoken.clone());
    }
    if index == current
        && let Some(track) = &animation.box_track
    {
        value.box_scale = track.scale_at(phase);
        value.box_opacity = track.opacity_at(phase);
    }
    value
}

/// The per-word projection of a Designed Caption. All timing channels are given by the Mac-equivalent recipe resolver. Here, colour, opacity and plate semantics are converted into state that the shared raster layer can consume.
pub fn designed_word_state(
    design: &DesignedCaption,
    item: &TimedItem,
    index: usize,
    time: f64,
    fps: f64,
) -> WordVisual {
    let word = &item.words[index];
    let resolved = resolve_caption_recipe_word(design, item, index, time, fps);
    let mut visual = WordVisual {
        color: Some(design.primary),
        recipe: resolved.clone(),
        ..WordVisual::default()
    };
    let marked = design.overrides.get(&word.id);
    if resolved.is_none() {
        // The Mac treats a frozen but unusable recipe as an explicit validation error. The shared burn-in layer has no error return channel, so it draws nothing rather than degrading to an unrelated Basic caption.
        visual.opacity = Some(0.0);
        return visual;
    }
    let role = resolved.as_ref().map_or_else(
        || marked.map_or("normal", |value| value.role.as_str()),
        |value| value.role.as_str(),
    );
    if let Some(resolved) = &resolved {
        visual.color = Some(
            resolved
                .color
                .unwrap_or(design.primary)
                .mix(design.accent, resolved.color_mix),
        );
    } else if role != "normal" {
        visual.color = Some(
            marked
                .and_then(|value| value.color)
                .unwrap_or(design.accent),
        );
    }
    visual.opacity = resolved.as_ref().map(|value| value.opacity);

    let family =
        caption_recipe_design_descriptor(design).map(|descriptor| descriptor.family.as_str());
    match family {
        Some("highlight")
            if resolved
                .as_ref()
                .is_some_and(|value| value.plate_progress > 0.001) =>
        {
            visual.background = Some(design.accent);
            visual.border_radius_em = resolved.as_ref().map(|value| value.plate_radius);
        }
        Some("pillKaraoke")
            if resolved
                .as_ref()
                .is_some_and(|value| value.plate_progress > 0.001) =>
        {
            visual.background = Some(design.accent);
            visual.border_radius_em = resolved.as_ref().map(|value| value.plate_radius);
        }
        _ => {}
    }
    visual
}

pub fn word_visual(
    animation: &WordAnimation,
    item: &TimedItem,
    index: usize,
    current: usize,
    time: f64,
    fps: f64,
) -> WordVisual {
    if animation.caption.is_none()
        && let Some(id) = animation.motion_id.as_deref()
    {
        let frame = motion_for_item(id, item, time);
        if let Some(pose) = frame.words.get(index) {
            let mut visual = WordVisual::default();
            visual.opacity = Some(pose.opacity);
            if pose.tint {
                visual.color = animation
                    .active
                    .color
                    .or(animation.spoken.color)
                    .or_else(|| parse_css_color("#FFD43B"));
            }
            if let Some(chip) = pose.chip {
                visual.background = animation
                    .active
                    .background
                    .or_else(|| parse_css_color("#FFD43B"));
                visual.box_scale = Some(chip.scale);
                visual.box_opacity = Some(chip.alpha);
                visual.border_radius_em = Some(chip.corner_rounding);
                visual.color = animation.active.color;
            }
            return visual;
        }
    }
    animation.caption.as_ref().map_or_else(
        || word_state(animation, index, current, word_phase(item, index, time)),
        |caption| designed_word_state(caption, item, index, time, fps),
    )
}

pub fn motion_for_item(id: &str, item: &TimedItem, time: f64) -> word_motion::MotionFrame {
    let words = item
        .words
        .iter()
        .map(|word| {
            (
                word.start - item.display_start,
                word.end - item.display_start,
            )
        })
        .collect::<Vec<_>>();
    word_motion::motion_frame_seeded(
        id,
        time - item.display_start,
        item.display_end - item.display_start,
        &words,
        item.series_index,
        word_motion::item_seed(&item.id),
    )
}

#[derive(Debug)]
pub struct TextRun {
    pub text: String,
    pub word: Option<usize>,
    pub start: usize,
}

pub fn timed_runs(text: &str, words: &[Word], transform: &str) -> Vec<TextRun> {
    // Locate timing spans in the original cue first. Searching the transformed cue for each
    // independently transformed word is not stable: title case depends on the preceding cue
    // character, and Unicode case conversion may change byte lengths. Transform the located
    // runs afterwards with one shared capitalize state so their concatenation is byte-for-byte
    // identical to `transform_text(text, transform)` while word timing survives.
    let mut source_runs = Vec::new();
    let mut cursor = 0;
    for (index, word) in words.iter().enumerate() {
        if word.text.is_empty() {
            continue;
        }
        let Some(found) = text[cursor..]
            .find(&word.text)
            .map(|offset| cursor + offset)
        else {
            continue;
        };
        if found > cursor {
            source_runs.push((text[cursor..found].to_owned(), None));
        }
        let end = found + word.text.len();
        source_runs.push((text[found..end].to_owned(), Some(index)));
        cursor = end;
    }
    if cursor < text.len() {
        source_runs.push((text[cursor..].to_owned(), None));
    }
    if source_runs.is_empty() {
        source_runs.push((text.to_owned(), None));
    }

    let mut runs = Vec::with_capacity(source_runs.len());
    let mut output_cursor = 0;
    let mut capitalize_next = true;
    for (source, word) in source_runs {
        let transformed = transform_text_chunk(&source, transform, &mut capitalize_next);
        if !transformed.is_empty() {
            let start = output_cursor;
            output_cursor += transformed.len();
            runs.push(TextRun {
                text: transformed,
                word,
                start,
            });
        }
    }
    if runs.is_empty() {
        runs.push(TextRun {
            text: String::new(),
            word: None,
            start: 0,
        });
    }
    runs
}

// The pure assembly of element geometry → DrawOp was moved wholesale in P6a into `ccut-timeline-render` (design §9.1; a `git mv` move, function bodies unchanged). This file now only calls it.
use timeline_render as element_draw;
