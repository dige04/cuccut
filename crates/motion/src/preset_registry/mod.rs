//! Preset recipe registry (ADR-M03, design §5.4).
//!
//! Built-in recipes are **data**: `core/presets/builtin/{motion,transition}/*.json`,
//! embedded via `include_str!` and parsed once through `OnceLock` into `'static` structures.
//! Numbers all come from the manifest; algorithms are referenced by name (`lattice-murmur-v1`, `idle-ramp-v1`).
//! Unknown algorithm names are rejected at parse time (`manifest-invalid`).
//!
//! Two shapes coexist (ADR-M08):
//!
//! - [`frozen`]: the `timeline.*@1` / `bcf.*@1` / transition recipes published in phase 1. They have four dedicated parse paths and **must not be rewritten**, because they pin the pixels of old projects.
//! - [`manifest`]: the generic manifest of design §5.4.1 (`tracks` or `compose` + `params`
//!   + `aliases` + `exposedTo`). Phase 2's canonical families use it.
//!   Expansion is in [`compose`], and `"{param}"` substitution is in [`substitute`].
//!
//! Why an explicit `include_str!` list instead of `build.rs`: the list is greppable, renaming turns it red,
//! `cargo build --offline` and `apps/gpui`'s separate lockfile are both unaffected, and
//! "adding a preset = adding one line" holds literally. Consistency between the directory and the list is guarded by
//! `tests/manifests.rs` (dev-only, may read the filesystem).

use std::sync::OnceLock;

use serde_json::{Map, Value};

use crate::MotionError;
use crate::fingerprint::fnv1a64;

macro_rules! builtin {
    ($ns:literal, $file:literal) => {
        (
            $file,
            include_str!(concat!("../../presets/builtin/", $ns, "/", $file, ".json")),
        )
    };
}

/// Adding a motion recipe = adding one line.
static MOTION_SOURCES: &[(&str, &str)] = &[
    builtin!("motion", "timeline.enter.none"),
    builtin!("motion", "timeline.enter.fade"),
    builtin!("motion", "timeline.enter.rise"),
    builtin!("motion", "timeline.enter.drop"),
    builtin!("motion", "timeline.enter.slideL"),
    builtin!("motion", "timeline.enter.slideR"),
    builtin!("motion", "timeline.enter.pop"),
    builtin!("motion", "timeline.enter.zoomIn"),
    builtin!("motion", "timeline.enter.zoomOut"),
    builtin!("motion", "timeline.enter.spin"),
    builtin!("motion", "timeline.enter.blurIn"),
    builtin!("motion", "timeline.enter.typewriter"),
    builtin!("motion", "timeline.enter.riseWords"),
    builtin!("motion", "timeline.enter.wipe"),
    // Supplement to the text animation catalogue in the design draft (`designs/cuccut/app/model-textpresets.js`):
    // pose values are taken from the start and duration feel of the same-named animation; approximated with a single-pose model.
    builtin!("motion", "timeline.enter.compress"),
    builtin!("motion", "timeline.enter.bounce"),
    builtin!("motion", "timeline.enter.fall"),
    builtin!("motion", "timeline.enter.skid"),
    builtin!("motion", "timeline.enter.roll"),
    // Round 156 supplement to reach the design draft's In 19 / Out 16 / Loop 9: slide adds the up and down directions
    // (entry direction = which side it comes from); wave/flipboard/dragonfly/billboard land in core for the first time.
    builtin!("motion", "timeline.enter.slideUp"),
    builtin!("motion", "timeline.enter.slideDown"),
    builtin!("motion", "timeline.enter.wave"),
    builtin!("motion", "timeline.enter.flipboard"),
    builtin!("motion", "timeline.enter.dragonfly"),
    builtin!("motion", "timeline.enter.billboard"),
    builtin!("motion", "timeline.enter.elFade"),
    builtin!("motion", "timeline.enter.elFloatL"),
    builtin!("motion", "timeline.enter.elFloatR"),
    builtin!("motion", "timeline.enter.elFloatUp"),
    builtin!("motion", "timeline.enter.elFloatDown"),
    builtin!("motion", "timeline.enter.elZoom"),
    builtin!("motion", "timeline.enter.elKenBurns"),
    builtin!("motion", "timeline.enter.elDrop"),
    builtin!("motion", "timeline.enter.elSlideL"),
    builtin!("motion", "timeline.enter.elSlideR"),
    builtin!("motion", "timeline.enter.elSlideUp"),
    builtin!("motion", "timeline.enter.elSlideDown"),
    builtin!("motion", "timeline.enter.elWipeL"),
    builtin!("motion", "timeline.enter.elWipeR"),
    builtin!("motion", "timeline.enter.elWipeUp"),
    builtin!("motion", "timeline.enter.elWipeDown"),
    builtin!("motion", "timeline.enter.elPop"),
    builtin!("motion", "timeline.enter.elBounce"),
    builtin!("motion", "timeline.enter.elSpinCw"),
    builtin!("motion", "timeline.enter.elSpinCcw"),
    builtin!("motion", "timeline.enter.elSlideBounceL"),
    builtin!("motion", "timeline.enter.elSlideBounceR"),
    builtin!("motion", "timeline.enter.elSlideBounceUp"),
    builtin!("motion", "timeline.enter.elSlideBounceDown"),
    builtin!("motion", "timeline.enter.elGentleFloatL"),
    builtin!("motion", "timeline.enter.elGentleFloatR"),
    builtin!("motion", "timeline.enter.elGentleFloatUp"),
    builtin!("motion", "timeline.enter.elGentleFloatDown"),
    builtin!("motion", "timeline.exit.none"),
    builtin!("motion", "timeline.exit.fade"),
    builtin!("motion", "timeline.exit.sink"),
    builtin!("motion", "timeline.exit.rise"),
    builtin!("motion", "timeline.exit.slideL"),
    builtin!("motion", "timeline.exit.slideR"),
    builtin!("motion", "timeline.exit.shrink"),
    builtin!("motion", "timeline.exit.zoomIn"),
    builtin!("motion", "timeline.exit.zoomOut"),
    builtin!("motion", "timeline.exit.spin"),
    builtin!("motion", "timeline.exit.wipe"),
    builtin!("motion", "timeline.exit.compress"),
    builtin!("motion", "timeline.exit.fall"),
    builtin!("motion", "timeline.exit.skid"),
    builtin!("motion", "timeline.exit.roll"),
    // Exit direction = which side it goes toward; `drop` is the design draft's stomp exit (sinks and enlarges).
    builtin!("motion", "timeline.exit.slideUp"),
    builtin!("motion", "timeline.exit.slideDown"),
    builtin!("motion", "timeline.exit.drop"),
    builtin!("motion", "timeline.exit.flipboard"),
    builtin!("motion", "timeline.exit.dragonfly"),
    builtin!("motion", "timeline.exit.billboard"),
    builtin!("motion", "timeline.exit.elFade"),
    builtin!("motion", "timeline.exit.elFloatL"),
    builtin!("motion", "timeline.exit.elFloatR"),
    builtin!("motion", "timeline.exit.elFloatUp"),
    builtin!("motion", "timeline.exit.elFloatDown"),
    builtin!("motion", "timeline.exit.elZoom"),
    builtin!("motion", "timeline.exit.elKenBurns"),
    builtin!("motion", "timeline.exit.elDrop"),
    builtin!("motion", "timeline.exit.elSlideL"),
    builtin!("motion", "timeline.exit.elSlideR"),
    builtin!("motion", "timeline.exit.elSlideUp"),
    builtin!("motion", "timeline.exit.elSlideDown"),
    builtin!("motion", "timeline.exit.elWipeL"),
    builtin!("motion", "timeline.exit.elWipeR"),
    builtin!("motion", "timeline.exit.elWipeUp"),
    builtin!("motion", "timeline.exit.elWipeDown"),
    builtin!("motion", "timeline.exit.elPop"),
    builtin!("motion", "timeline.exit.elBounce"),
    builtin!("motion", "timeline.exit.elSpinCw"),
    builtin!("motion", "timeline.exit.elSpinCcw"),
    builtin!("motion", "timeline.exit.elSlideBounceL"),
    builtin!("motion", "timeline.exit.elSlideBounceR"),
    builtin!("motion", "timeline.exit.elSlideBounceUp"),
    builtin!("motion", "timeline.exit.elSlideBounceDown"),
    builtin!("motion", "timeline.exit.elGentleFloatL"),
    builtin!("motion", "timeline.exit.elGentleFloatR"),
    builtin!("motion", "timeline.exit.elGentleFloatUp"),
    builtin!("motion", "timeline.exit.elGentleFloatDown"),
    builtin!("motion", "timeline.loop.float"),
    builtin!("motion", "timeline.loop.pulse"),
    builtin!("motion", "timeline.loop.sway"),
    builtin!("motion", "timeline.loop.jitter"),
    builtin!("motion", "timeline.loop.blink"),
    // Design draft Loop catalogue: rotate uses the ramp wave (the 360° seam closes), heartBeat uses the
    // heartbeat wave, and the rest are multi-channel combinations of sine/dip.
    builtin!("motion", "timeline.loop.rotate"),
    builtin!("motion", "timeline.loop.heartBeat"),
    builtin!("motion", "timeline.loop.vogue"),
    builtin!("motion", "timeline.loop.dragonfly"),
    builtin!("motion", "timeline.loop.billboard"),
    builtin!("motion", "timeline.loop.roll"),
    builtin!("motion", "timeline.loop.elSpin"),
    builtin!("motion", "timeline.loop.elSpinSmooth"),
    builtin!("motion", "timeline.loop.elSpin3d"),
    builtin!("motion", "timeline.loop.elBounce"),
    builtin!("motion", "timeline.loop.elHeartbeat"),
    builtin!("motion", "timeline.loop.elSway"),
    builtin!("motion", "timeline.loop.elSway3d"),
    builtin!("motion", "timeline.loop.elSqueezy"),
    builtin!("motion", "timeline.loop.elJiggle"),
    builtin!("motion", "bcf.fadeIn"),
    builtin!("motion", "bcf.fadeOut"),
    builtin!("motion", "bcf.countUp"),
    builtin!("motion", "bcf.barFill"),
    builtin!("motion", "bcf.kenBurns"),
];

static TRANSITION_SOURCES: &[(&str, &str)] = &[
    builtin!("transition", "bcf.cut"),
    builtin!("transition", "bcf.crossfade"),
    builtin!("transition", "bcf.slideLeft"),
    builtin!("transition", "bcf.slideRight"),
    builtin!("transition", "bcf.slideUp"),
    builtin!("transition", "bcf.slideDown"),
    // Phase 5: fills in the Motion Transition vocabulary of spec §9.
    builtin!("transition", "bcf.wipeLeft"),
    builtin!("transition", "bcf.wipeRight"),
    builtin!("transition", "bcf.zoomThrough"),
    builtin!("transition", "bcf.whipPan"),
];

/// Caption entry-pose recipes (the `magic-*` set absorbed in phase 5). Kept in a table separate from `TRANSITION_SOURCES`:
/// they produce no BCF channels, and their consumer is caption compositing in `studio_export`.
static CAPTION_TRANSITION_SOURCES: &[(&str, &str)] = &[
    builtin!("transition", "caption.fade"),
    builtin!("transition", "caption.pop"),
    builtin!("transition", "caption.flip"),
];

/// Catalogue-type recipes (ADR-E05): **shape libraries for shape / visualizer / progress**.
///
/// The fourth list, alongside the three lists MOTION_SOURCES / TRANSITION_SOURCES / MANIFEST_SOURCES. It goes through its own loop and its own parser, and its parse results are stored in separate fields of [`RegistryData`]. **They do not go into the `manifests` vector**, so they do not appear in `families()` / `manifest_ids()`, and phase 2's three guards are unaffected.
///
/// P0 lands only the first batch of 4 shapes. P7 expands to 23 basic shapes, and P2 adds visualizer / progress.
/// Shape catalogue (design §10 P7). List order does not matter: panel order comes from the `order` field, and writing the entries here in panel grid order is only for readability.
///
/// **23 basic shapes**: 21 `d=` paths with `viewBox="0 0 100 100"` → 0..1 normalized outlines; `rect` / `ellipse` are parameterized `path.kind`.
/// **`line` is CucCut's own 24th entry**: P0 already wrote it into the contract, the golden and the three-way twin. Deleting it would silently make existing documents' shapes disappear, with no benefit.
/// `arrow` is P0's **line segment + head** (with the two parameters `endpoints` / `head`, which is stronger for annotation use), not a block arrow. The block-arrow shape is covered by the same family's `squig2` (right-pointing block arrow).
static SHAPE_SOURCES: &[(&str, &str)] = &[
    builtin!("shape", "rect"),
    builtin!("shape", "ellipse"),
    builtin!("shape", "triangle"),
    builtin!("shape", "rombus"),
    builtin!("shape", "pentagon"),
    builtin!("shape", "hex"),
    builtin!("shape", "octagon"),
    builtin!("shape", "squig"),
    builtin!("shape", "squig2"),
    builtin!("shape", "line"),
    builtin!("shape", "arrow"),
    builtin!("shape", "tick"),
    builtin!("shape", "tick2"),
    builtin!("shape", "chevron"),
    builtin!("shape", "chevron2"),
    builtin!("shape", "cross2"),
    builtin!("shape", "cross"),
    builtin!("shape", "love2"),
    builtin!("shape", "love"),
    builtin!("shape", "diamond"),
    builtin!("shape", "star"),
    builtin!("shape", "sharp"),
    builtin!("shape", "star2"),
    builtin!("shape", "sharp2"),
];

/// Template stickers (design §10 P7's `StickerProps.source == "template"`).
///
/// **The first batch of 10, all CucCut-drawn normalized paths**, with no third-party artwork assets.
/// A static sticker is a single-frame SVG/PNG; an animated sticker is a looping WebM with alpha.
///
/// The first batch deliberately picks **precisely constructible geometry** (circle, regular polygon, star, rounded rectangle, cubic-Bézier
/// heart and teardrop), so that "is the structure right" can be pinned by a golden. Adding artwork-style templates is pure data: one more = one line + one JSON (P7c).
static STICKER_SOURCES: &[(&str, &str)] = &[
    builtin!("sticker", "badge_check"),
    builtin!("sticker", "badge_cross"),
    builtin!("sticker", "star_burst"),
    builtin!("sticker", "speech_bubble"),
    builtin!("sticker", "heart"),
    builtin!("sticker", "bolt"),
    builtin!("sticker", "pin"),
    builtin!("sticker", "sparkle"),
    builtin!("sticker", "arrow_curved"),
    builtin!("sticker", "crown"),
];

/// 10 sound wave styles (design §7.3). Order does not matter; catalogue order comes from the `order` field.
static VISUALIZER_SOURCES: &[(&str, &str)] = &[
    builtin!("visualizer", "bars"),
    builtin!("visualizer", "bars_rounded"),
    builtin!("visualizer", "bars_bottom"),
    builtin!("visualizer", "ring_bars"),
    builtin!("visualizer", "oscilloscope"),
    builtin!("visualizer", "ring_wave"),
    builtin!("visualizer", "spectrum_area"),
    builtin!("visualizer", "dots"),
    builtin!("visualizer", "pulse_rings"),
    builtin!("visualizer", "ribbons"),
];

/// The sound-wave catalogue before 2026-09 was the old set of 15. After the generation change, old `timeline.json` files may still contain old ids in
/// `visualizer.style`. This table maps each old id to the closest-looking new style, so old projects still open and render as before (the property panel shows the new style). The table is a compatibility layer that is only added to, never removed from. The new catalogue's own ids are not in the table.
static VISUALIZER_STYLE_ALIASES: &[(&str, &str)] = &[
    ("trio_wave", "bars"),
    ("formation", "bars"),
    ("formation_thin", "bars"),
    ("formation_rounded", "bars_rounded"),
    ("formation_aligned", "bars_bottom"),
    ("formation_thin_aligned", "bars_bottom"),
    ("static", "bars_bottom"),
    ("formation_circle", "ring_bars"),
    ("beam", "oscilloscope"),
    ("simi", "ribbons"),
    ("harmony", "ribbons"),
    ("waves", "ribbons"),
    ("frequency_lines", "dots"),
    ("echo_lines", "dots"),
    ("ripple_wave", "pulse_rings"),
];

/// 14 progress styles (design §7.4). The panel has 16 tiles, but Countdown / Count Up are actually text elements, not progress shaders, so only the real 14 are registered here.
static PROGRESS_SOURCES: &[(&str, &str)] = &[
    builtin!("progress", "normal"),
    builtin!("progress", "rounded"),
    builtin!("progress", "circle"),
    builtin!("progress", "donut"),
    builtin!("progress", "border"),
    builtin!("progress", "reverse_border"),
    builtin!("progress", "rainbow_border"),
    builtin!("progress", "reverse_rainbow_border"),
    builtin!("progress", "strobe_border"),
    builtin!("progress", "reverse_strobe_border"),
    builtin!("progress", "snake"),
    builtin!("progress", "snake_spin"),
    builtin!("progress", "snake_rainbow"),
    builtin!("progress", "snake_spin_rainbow"),
];

/// 10 confetti styles (`docs/design/elements/ccut-confetti-element-design.md` §4.4): adapted from three MIT sources,
/// react-confetti / party-js / js-confetti. One recipe per style.
static CONFETTI_SOURCES: &[(&str, &str)] = &[
    builtin!("confetti", "rainbow-paper"),
    builtin!("confetti", "pastel-fall"),
    builtin!("confetti", "neon-streamers"),
    builtin!("confetti", "golden-starburst"),
    builtin!("confetti", "festival-fireworks"),
    builtin!("confetti", "hearts-petals"),
    builtin!("confetti", "party-cannons"),
    builtin!("confetti", "curling-ribbons"),
    builtin!("confetti", "geometric-pop"),
    builtin!("confetti", "champagne-sparkle"),
];

/// Text preset pack (`docs/design/app-v2/text-pane-and-groups.md` §6.2): the catalogue for the Text panel's preset library.
/// **The fifth list**, with its own structure, its own loop and its own fields. A preset is "a group of elements already laid out",
/// not "one way of drawing one kind", so it cannot be stuffed into `CatalogueRecipe` (see the [`textpreset`] module header).
///
/// The first batch has 51 presets in four categories (simple 13 / title 10 / lowerThird 20 / other 8). Each entry is a **configuration parameter**: category, coordinates, font size, font name, color, animation timing and delay. Units are converted at generation time into CucCut's own units (frame-size percentages / 540-pixel short edge / degrees). Image-type decorations use the equivalent shapes already in this catalogue (`arrow` / `diamond`), with no third-party artwork.
static TEXTPRESET_SOURCES: &[(&str, &str)] = &[
    builtin!("textpreset", "simple.01"),
    builtin!("textpreset", "simple.02"),
    builtin!("textpreset", "simple.03"),
    builtin!("textpreset", "simple.04"),
    builtin!("textpreset", "simple.05"),
    builtin!("textpreset", "simple.06"),
    builtin!("textpreset", "simple.07"),
    builtin!("textpreset", "simple.08"),
    builtin!("textpreset", "simple.09"),
    builtin!("textpreset", "simple.10"),
    builtin!("textpreset", "simple.11"),
    builtin!("textpreset", "simple.12"),
    builtin!("textpreset", "simple.13"),
    builtin!("textpreset", "title.01"),
    builtin!("textpreset", "title.02"),
    builtin!("textpreset", "title.03"),
    builtin!("textpreset", "title.04"),
    builtin!("textpreset", "title.05"),
    builtin!("textpreset", "title.06"),
    builtin!("textpreset", "title.07"),
    builtin!("textpreset", "title.08"),
    builtin!("textpreset", "title.09"),
    builtin!("textpreset", "title.10"),
    builtin!("textpreset", "lowerThird.01"),
    builtin!("textpreset", "lowerThird.02"),
    builtin!("textpreset", "lowerThird.03"),
    builtin!("textpreset", "lowerThird.04"),
    builtin!("textpreset", "lowerThird.05"),
    builtin!("textpreset", "lowerThird.06"),
    builtin!("textpreset", "lowerThird.07"),
    builtin!("textpreset", "lowerThird.08"),
    builtin!("textpreset", "lowerThird.09"),
    builtin!("textpreset", "lowerThird.10"),
    builtin!("textpreset", "lowerThird.11"),
    builtin!("textpreset", "lowerThird.12"),
    builtin!("textpreset", "lowerThird.13"),
    builtin!("textpreset", "lowerThird.14"),
    builtin!("textpreset", "lowerThird.15"),
    builtin!("textpreset", "lowerThird.16"),
    builtin!("textpreset", "lowerThird.17"),
    builtin!("textpreset", "lowerThird.18"),
    builtin!("textpreset", "lowerThird.19"),
    builtin!("textpreset", "lowerThird.20"),
    builtin!("textpreset", "other.01"),
    builtin!("textpreset", "other.02"),
    builtin!("textpreset", "other.03"),
    builtin!("textpreset", "other.04"),
    builtin!("textpreset", "other.05"),
    builtin!("textpreset", "other.06"),
    builtin!("textpreset", "other.07"),
    builtin!("textpreset", "other.08"),
];

pub mod catalogue;
pub mod compose;
pub mod frozen;
pub(crate) mod json;
pub mod manifest;
pub mod substitute;
pub mod textpreset;

pub use catalogue::{
    BinWidth, CONFETTI_SHAPES, CatalogueBody, CatalogueKind, CatalogueRecipe, ConfettiBody,
    PathSegment, ProgressAspect, ProgressBody, Recipe, RecipeAlgorithm,
    STICKER_DEFAULT_STROKE_WIDTH, ShapeBody, ShapeHead, ShapeParam, ShapePath, StickerBody,
    StickerLayer, VisualizerAspect, VisualizerBody,
};
pub use compose::{ExpandCtx, ExpandedPreset, ResolvedFrame, ResolvedTrack, expand, expand_with};
pub use frozen::{
    BcfPreset, CaptionChannel, CaptionTransitionRecipe, LoopRecipe, RecipeSurface, Slot,
    SlotChannels, SlotKeyframe, SlotRecipe, TransitionChannel, TransitionRecipe, TranslateBasis,
};
pub use manifest::{
    AppliesTo, Determinism, ManifestDomain, ParamSpec, ParamType, PresetBody, PresetManifest,
    Surface,
};
pub use textpreset::{
    TextPresetCategory, TextPresetItem, TextPresetItemKind, TextPresetRecipe, TextPresetTables,
};

/// Design §13 "preset vocabulary inflation" risk row and §5.4.3: the cap on **element** canonical families.
/// Before changing this constant, go back to the ADR. UI variants expand through **parameters**, not through new families.
///
/// Of the 12 families listed in design §5.4.3, none is `fadeIn`. This implementation issues it as its own family, since it is the most-used card in the Gallery, so the actual budget is 12 + 1 (a phase 3 deviation from §15).
pub const CANONICAL_FAMILY_BUDGET: usize = 13;

/// Separate budget for text-part families (spec §7.9). Part effects are a different vocabulary; mixing them into the element budget would only make both crowd each other out.
pub const PART_FAMILY_BUDGET: usize = 8;

use frozen::{parse_bcf, parse_caption_transition, parse_loop, parse_slot, parse_transition};

/// Generic manifest (design §5.4.1). Adding a family = adding one line.
/// The first eight are **internal building blocks** (`family: null`), referenced only by `compose`, and they do not enter the Gallery.
static MANIFEST_SOURCES: &[(&str, &str)] = &[
    builtin!("motion", "motion.shiftIn"),
    builtin!("motion", "motion.shiftOut"),
    builtin!("motion", "motion.zoomIn"),
    builtin!("motion", "motion.zoomOut"),
    builtin!("motion", "motion.spinIn"),
    builtin!("motion", "motion.spinOut"),
    builtin!("motion", "motion.blurFrom"),
    builtin!("motion", "motion.blurTo"),
    builtin!("motion", "motion.fadeIn"),
    builtin!("motion", "motion.fadeOut"),
    builtin!("motion", "motion.moveIn"),
    builtin!("motion", "motion.moveOut"),
    builtin!("motion", "motion.scaleIn"),
    builtin!("motion", "motion.scaleOut"),
    builtin!("motion", "motion.backIn"),
    builtin!("motion", "motion.backOut"),
    builtin!("motion", "motion.elasticIn"),
    builtin!("motion", "motion.elasticOut"),
    builtin!("motion", "motion.rotateIn"),
    builtin!("motion", "motion.rotateOut"),
    builtin!("motion", "motion.rollIn"),
    builtin!("motion", "motion.rollOut"),
    builtin!("motion", "motion.blurIn"),
    builtin!("motion", "motion.blurOut"),
    builtin!("motion", "motion.pulse"),
    builtin!("motion", "motion.flash"),
    builtin!("motion", "motion.tilt"),
    builtin!("motion", "motion.shake"),
    builtin!("motion", "motion.drift"),
    // Text part recipes (`appliesTo: "part"`, spec §7.9)
    builtin!("motion", "motion.typewriter"),
    builtin!("motion", "motion.riseParts"),
    builtin!("motion", "motion.wipeParts"),
    builtin!("motion", "motion.karaokeScale"),
    builtin!("motion", "motion.seededJitter"),
];

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Domain {
    TimelineEnter,
    TimelineExit,
    TimelineLoop,
    BcfMotion,
    BcfTransition,
    /// Catalogue-type recipes: the shape library for Timeline `shape` elements (ADR-E05).
    TimelineShape,
    /// Catalogue-type recipes: the template sticker library for Timeline `sticker` elements (design §10 P7).
    TimelineSticker,
    /// Catalogue-type recipes: the 10 sound-wave styles for Timeline `visualizer` elements (design §7.3).
    TimelineVisualizer,
    /// Catalogue-type recipes: the 14 progress bar styles for Timeline `progress` elements (design §7.4).
    TimelineProgress,
    /// Catalogue-type recipes: the 10 confetti styles for Timeline `confetti` elements (confetti design draft §4).
    TimelineConfetti,
    /// Text preset pack: the 51 scene templates of the Text panel's preset library (§6.2).
    TextPreset,
}

/// Per-channel `Option<f64>`; field order matches `AnimationPose`.

struct RegistryData {
    manifests: Vec<PresetManifest>,
    /// alias → canonical id. Built at parse time; a conflict is `manifest-invalid`.
    aliases: Vec<(String, String)>,
    enter: Vec<SlotRecipe>,
    exit: Vec<SlotRecipe>,
    loops: Vec<LoopRecipe>,
    bcf: Vec<BcfPreset>,
    transitions: Vec<TransitionRecipe>,
    caption_transitions: Vec<CaptionTransitionRecipe>,
    /// Catalogue-type recipes (ADR-E05): **separate fields**, deliberately not mixed into `manifests`.
    shapes: Vec<CatalogueRecipe>,
    stickers: Vec<CatalogueRecipe>,
    visualizers: Vec<CatalogueRecipe>,
    progresses: Vec<CatalogueRecipe>,
    confettis: Vec<CatalogueRecipe>,
    /// Text preset pack: likewise a separate field, not mixed into any animation table.
    text_presets: Vec<TextPresetRecipe>,
    bcf_map: Value,
}

fn data() -> &'static RegistryData {
    static DATA: OnceLock<RegistryData> = OnceLock::new();
    DATA.get_or_init(|| build().expect("builtin preset manifests"))
}

fn build() -> Result<RegistryData, MotionError> {
    let mut enter = Vec::new();
    let mut exit = Vec::new();
    let mut loops = Vec::new();
    let mut bcf = Vec::new();
    for (file, source) in MOTION_SOURCES {
        let hash = fnv1a64(source.as_bytes());
        let doc: Value = serde_json::from_str(source)
            .map_err(|err| MotionError::ManifestInvalid(format!("{file}: {err}")))?;
        match doc.get("namespace").and_then(Value::as_str) {
            Some("timeline") => match doc.get("slot").and_then(Value::as_str) {
                Some("enter") => enter.push(parse_slot(file, &doc, Slot::Enter, hash)?),
                Some("exit") => exit.push(parse_slot(file, &doc, Slot::Exit, hash)?),
                Some("loop") => loops.push(parse_loop(file, &doc, hash)?),
                other => {
                    return Err(MotionError::ManifestInvalid(format!(
                        "{file}: unknown slot {other:?}"
                    )));
                }
            },
            Some("bcf") => bcf.push(parse_bcf(file, &doc, hash)?),
            other => {
                return Err(MotionError::ManifestInvalid(format!(
                    "{file}: unknown namespace {other:?}"
                )));
            }
        }
    }
    let mut transitions = Vec::new();
    for (file, source) in TRANSITION_SOURCES {
        let hash = fnv1a64(source.as_bytes());
        let doc: Value = serde_json::from_str(source)
            .map_err(|err| MotionError::ManifestInvalid(format!("{file}: {err}")))?;
        transitions.push(parse_transition(file, &doc, hash)?);
    }
    let mut caption_transitions = Vec::new();
    for (file, source) in CAPTION_TRANSITION_SOURCES {
        let hash = fnv1a64(source.as_bytes());
        let doc: Value = serde_json::from_str(source)
            .map_err(|err| MotionError::ManifestInvalid(format!("{file}: {err}")))?;
        caption_transitions.push(parse_caption_transition(file, &doc, hash)?);
    }
    caption_transitions.sort_by_key(|recipe| recipe.order);
    enter.sort_by_key(|recipe| recipe.order);
    exit.sort_by_key(|recipe| recipe.order);
    loops.sort_by_key(|recipe| recipe.order);
    bcf.sort_by_key(|preset| preset.order);
    transitions.sort_by_key(|recipe| recipe.order);

    let mut map = Map::new();
    for preset in &bcf {
        map.insert(preset.id.clone(), preset.definition.clone());
    }
    let mut manifests = Vec::new();
    for (file, source) in MANIFEST_SOURCES {
        let hash = fnv1a64(source.as_bytes());
        let doc: Value = serde_json::from_str(source)
            .map_err(|err| MotionError::ManifestInvalid(format!("{file}: {err}")))?;
        manifests.push(manifest::parse_manifest(file, &doc, hash)?);
    }
    manifests.sort_by(|a, b| a.id.cmp(&b.id));
    let mut aliases: Vec<(String, String)> = Vec::new();
    for entry in &manifests {
        if manifests.iter().filter(|m| m.id == entry.id).count() > 1 {
            return Err(MotionError::ManifestInvalid(format!(
                "duplicate manifest id \"{}\"",
                entry.id
            )));
        }
        for alias in &entry.aliases {
            if manifests.iter().any(|m| &m.id == alias) || bcf.iter().any(|p| &p.id == alias) {
                return Err(MotionError::ManifestInvalid(format!(
                    "alias \"{alias}\" collides with a canonical id"
                )));
            }
            if let Some((_, owner)) = aliases.iter().find(|(name, _)| name == alias) {
                return Err(MotionError::ManifestInvalid(format!(
                    "alias \"{alias}\" declared by both \"{owner}\" and \"{}\"",
                    entry.id
                )));
            }
            aliases.push((alias.clone(), entry.id.clone()));
        }
    }
    aliases.sort();
    // Separate loops for catalogue-type recipes (ADR-E05): three lists, three loops, sharing the
    // `parse_catalogue` skeleton. Results do not go into `manifests`, and they do not take part in the alias table.
    let shapes = build_catalogue(CatalogueKind::Shape, SHAPE_SOURCES)?;
    let stickers = build_catalogue(CatalogueKind::Sticker, STICKER_SOURCES)?;
    let visualizers = build_catalogue(CatalogueKind::Visualizer, VISUALIZER_SOURCES)?;
    let progresses = build_catalogue(CatalogueKind::Progress, PROGRESS_SOURCES)?;
    let confettis = build_catalogue(CatalogueKind::Confetti, CONFETTI_SOURCES)?;
    let text_presets = build_text_presets(textpreset::TextPresetTables {
        shapes: &shapes,
        enter: &enter,
        exit: &exit,
        loops: &loops,
    })?;
    Ok(RegistryData {
        manifests,
        aliases,
        enter,
        exit,
        loops,
        bcf,
        transitions,
        caption_transitions,
        shapes,
        stickers,
        visualizers,
        progresses,
        confettis,
        text_presets,
        bcf_map: Value::Object(map),
    })
}

/// One catalogue-type list → a sorted, duplicate-checked recipe table.
fn build_catalogue(
    kind: CatalogueKind,
    sources: &[(&str, &str)],
) -> Result<Vec<CatalogueRecipe>, MotionError> {
    let mut out = Vec::with_capacity(sources.len());
    for (file, source) in sources {
        let hash = fnv1a64(source.as_bytes());
        let doc: Value = serde_json::from_str(source)
            .map_err(|err| MotionError::ManifestInvalid(format!("{file}: {err}")))?;
        out.push(catalogue::parse_catalogue(kind, file, &doc, hash)?);
    }
    out.sort_by_key(|recipe| recipe.order);
    if let Some(duplicate) = out
        .windows(2)
        .find(|pair| pair[0].order == pair[1].order || pair[0].id == pair[1].id)
    {
        return Err(MotionError::ManifestInvalid(format!(
            "duplicate {} recipe \"{}\" / \"{}\"",
            kind.dir(),
            duplicate[0].id,
            duplicate[1].id
        )));
    }
    Ok(out)
}

/// Text preset list → preset table sorted by `order` and checked for duplicates.
///
/// The reference tables (the shape catalogue and the three animation tables) are **parameters** rather than a query surface. This function runs inside `build()`, when `data()`'s `OnceLock` is not yet initialized. Querying here would re-enter, and `get_or_init` deadlocks on re-entry rather than reporting an error.
fn build_text_presets(
    tables: textpreset::TextPresetTables<'_>,
) -> Result<Vec<TextPresetRecipe>, MotionError> {
    let mut out = Vec::with_capacity(TEXTPRESET_SOURCES.len());
    for (file, source) in TEXTPRESET_SOURCES {
        let hash = fnv1a64(source.as_bytes());
        let doc: Value = serde_json::from_str(source)
            .map_err(|err| MotionError::ManifestInvalid(format!("{file}: {err}")))?;
        out.push(textpreset::parse_text_preset(file, &doc, hash, tables)?);
    }
    out.sort_by_key(|recipe| recipe.order);
    if let Some(duplicate) = out
        .windows(2)
        .find(|pair| pair[0].order == pair[1].order || pair[0].id == pair[1].id)
    {
        return Err(MotionError::ManifestInvalid(format!(
            "duplicate textpreset \"{}\" / \"{}\"",
            duplicate[0].id, duplicate[1].id
        )));
    }
    Ok(out)
}

// ── Query surface ───────────────────────────────────────────────────────────

pub fn timeline_enter(id: &str) -> Option<&'static SlotRecipe> {
    data().enter.iter().find(|recipe| recipe.id == id)
}

pub fn timeline_exit(id: &str) -> Option<&'static SlotRecipe> {
    data().exit.iter().find(|recipe| recipe.id == id)
}

pub fn timeline_loop(id: &str) -> Option<&'static LoopRecipe> {
    data().loops.iter().find(|recipe| recipe.id == id)
}

pub fn bcf_preset(name: &str) -> Option<&'static BcfPreset> {
    data().bcf.iter().find(|preset| preset.id == name)
}

/// `{params?, keyframes}` definition body, consumed by `Resolver::expand_preset_def`.
pub fn bcf_builtin(name: &str) -> Option<&'static Value> {
    bcf_preset(name).map(|preset| &preset.definition)
}

/// A `Value::Object` identical word for word to the result of parsing `resolve.rs::BUILTIN_PRESETS`.
pub fn bcf_builtin_map() -> &'static Value {
    &data().bcf_map
}

/// Replaces the hard-coded `name == "countUp"` at `resolve.rs:709`.
pub fn emits_params_meta(name: &str) -> bool {
    bcf_preset(name).is_some_and(|preset| preset.emits_params_meta)
}

pub fn bcf_transition(name: &str) -> Option<&'static TransitionRecipe> {
    data().transitions.iter().find(|recipe| recipe.id == name)
}

/// Caption entry-pose recipe. **Looked up by the historical id stored in persistence** (`magic-fade` …).
/// Caption styles store this id. The recipe id `transition.caption.fade` is the canonical name after absorption.
pub fn caption_transition(legacy_id: &str) -> Option<&'static CaptionTransitionRecipe> {
    data()
        .caption_transitions
        .iter()
        .find(|recipe| recipe.legacy_id == legacy_id)
}

/// All caption entry-pose recipes (catalogue order).
pub fn caption_transitions() -> &'static [CaptionTransitionRecipe] {
    &data().caption_transitions
}

/// UI catalogue order (data, not filename sorting).
pub fn ids(domain: Domain) -> Vec<&'static str> {
    match domain {
        Domain::TimelineEnter => data().enter.iter().map(|r| r.id.as_str()).collect(),
        Domain::TimelineExit => data().exit.iter().map(|r| r.id.as_str()).collect(),
        Domain::TimelineLoop => data().loops.iter().map(|r| r.id.as_str()).collect(),
        Domain::BcfMotion => data().bcf.iter().map(|r| r.id.as_str()).collect(),
        Domain::BcfTransition => data().transitions.iter().map(|r| r.id.as_str()).collect(),
        Domain::TimelineShape => data().shapes.iter().map(|r| r.id.as_str()).collect(),
        Domain::TimelineSticker => data().stickers.iter().map(|r| r.id.as_str()).collect(),
        Domain::TimelineVisualizer => data().visualizers.iter().map(|r| r.id.as_str()).collect(),
        Domain::TimelineProgress => data().progresses.iter().map(|r| r.id.as_str()).collect(),
        Domain::TimelineConfetti => data().confettis.iter().map(|r| r.id.as_str()).collect(),
        Domain::TextPreset => data().text_presets.iter().map(|r| r.id.as_str()).collect(),
    }
}

/// Shape recipe for Timeline `shape` elements. The lookup key is the value of `shape.shape` in `timeline.json`
/// (`rect` / `ellipse` / `line` / `arrow`).
pub fn timeline_shape(id: &str) -> Option<&'static CatalogueRecipe> {
    data().shapes.iter().find(|recipe| recipe.id == id)
}

/// Shapes selectable in the property panel (`available: true`, catalogue order).
pub fn timeline_shapes() -> &'static [CatalogueRecipe] {
    &data().shapes
}

/// Template recipe for Timeline `sticker` elements. The lookup key is the value of `sticker.templateId`
/// (`heart` / `badge_check` / …, design §10 P7).
pub fn timeline_sticker(id: &str) -> Option<&'static CatalogueRecipe> {
    data().stickers.iter().find(|recipe| recipe.id == id)
}

/// All template stickers (catalogue order): the data source for the sticker picker.
pub fn timeline_stickers() -> &'static [CatalogueRecipe] {
    &data().stickers
}

/// Style recipe for Timeline `visualizer` elements. The lookup key is the value of `visualizer.style`
/// (`bars` / `ribbons` / …, design §7.3). Old catalogue ids are folded to the new styles via
/// [`canonical_visualizer_style`], so old projects do not lose elements because of it.
pub fn timeline_visualizer(id: &str) -> Option<&'static CatalogueRecipe> {
    let id = canonical_visualizer_style(id);
    data().visualizers.iter().find(|recipe| recipe.id == id)
}

/// Folds an old-catalogue sound-wave style id to the equivalent style in the current catalogue. Current-catalogue ids and unknown ids
/// are returned as-is (unknown ids are left to [`timeline_visualizer`] to return `None`).
pub fn canonical_visualizer_style(id: &str) -> &str {
    VISUALIZER_STYLE_ALIASES
        .iter()
        .find(|(old, _)| *old == id)
        .map_or(id, |(_, new)| new)
}

/// All 10 sound-wave styles (catalogue order).
pub fn timeline_visualizers() -> &'static [CatalogueRecipe] {
    &data().visualizers
}

/// Style recipe for Timeline `progress` elements (design §7.4).
pub fn timeline_progress(id: &str) -> Option<&'static CatalogueRecipe> {
    data().progresses.iter().find(|recipe| recipe.id == id)
}

/// All 14 progress bar styles (catalogue order).
pub fn timeline_progresses() -> &'static [CatalogueRecipe] {
    &data().progresses
}

/// Style recipe for Timeline `confetti` elements (confetti design draft §4). The lookup key is the value of
/// `confetti.style` (`rainbow-paper` / `party-cannons` / …).
pub fn timeline_confetti(id: &str) -> Option<&'static CatalogueRecipe> {
    data().confettis.iter().find(|recipe| recipe.id == id)
}

/// All 10 confetti styles (catalogue order): the data source for the "confetti" tile grid.
pub fn timeline_confettis() -> &'static [CatalogueRecipe] {
    &data().confettis
}

/// Parses only one class of catalogue-type recipes, without building the whole registry. The caller references only this class's list, so the other built-in recipes are not linked into its artifact
/// (the interface's edit-semantics WASM only needs the sound-wave, progress-bar and confetti catalogues). The parsing is the same as the query surfaces such as [`timeline_visualizers`]. Each call re-parses, and the caller caches the result itself.
pub fn parse_builtin_catalogue(kind: CatalogueKind) -> Result<Vec<CatalogueRecipe>, MotionError> {
    let sources = match kind {
        CatalogueKind::Shape => SHAPE_SOURCES,
        CatalogueKind::Sticker => STICKER_SOURCES,
        CatalogueKind::Visualizer => VISUALIZER_SOURCES,
        CatalogueKind::Progress => PROGRESS_SOURCES,
        CatalogueKind::Confetti => CONFETTI_SOURCES,
    };
    build_catalogue(kind, sources)
}

/// Old sound-wave style id → equivalent in the current catalogue (the table that [`canonical_visualizer_style`] looks up).
pub fn visualizer_style_aliases() -> &'static [(&'static str, &'static str)] {
    VISUALIZER_STYLE_ALIASES
}

/// One text preset (§6.2). The lookup key is the preset id (`lowerThird.07`), which is also the filename.
pub fn text_preset(id: &str) -> Option<&'static TextPresetRecipe> {
    data().text_presets.iter().find(|recipe| recipe.id == id)
}

/// All text presets (ascending `order`): the data source for the Text panel's preset library.
pub fn text_presets() -> &'static [TextPresetRecipe] {
    &data().text_presets
}

/// Generic manifest query (design §5.4.1).
pub fn manifest(id: &str) -> Option<&'static PresetManifest> {
    data().manifests.iter().find(|m| m.id == id)
}

/// alias → canonical id; returned as-is when it is not an alias.
pub fn canonical_id<'a>(id: &'a str) -> &'a str {
    match data().aliases.iter().find(|(alias, _)| alias == id) {
        Some((_, canonical)) => canonical.as_str(),
        None => id,
    }
}

/// All canonical ids of the generic manifest (ascending).
pub fn manifest_ids() -> Vec<&'static str> {
    data().manifests.iter().map(|m| m.id.as_str()).collect()
}

/// All aliases (ascending), as `(alias, canonical)`.
pub fn aliases() -> Vec<(&'static str, &'static str)> {
    data()
        .aliases
        .iter()
        .map(|(a, c)| (a.as_str(), c.as_str()))
        .collect()
}

/// Deduplicated **element** UI families (excluding internal building blocks with `family: null`, and excluding part families).
pub fn families() -> Vec<&'static str> {
    families_of(AppliesTo::Element)
}

/// Deduplicated **text part** families (spec §7.9).
pub fn part_families() -> Vec<&'static str> {
    families_of(AppliesTo::Part)
}

fn families_of(scope: AppliesTo) -> Vec<&'static str> {
    let mut out: Vec<&'static str> = Vec::new();
    for entry in &data().manifests {
        if entry.applies_to != scope {
            continue;
        }
        if let Some(family) = entry.family.as_deref() {
            if !out.contains(&family) {
                out.push(family);
            }
        }
    }
    out.sort_unstable();
    out
}

/// Recipe scope (`appliesTo`). An unknown id returns `None`.
pub fn applies_to(id: &str) -> Option<AppliesTo> {
    manifest(canonical_id(id)).map(|entry| entry.applies_to)
}

/// preset id → family (the normalized count used by `preset-sprawl`). An unknown id returns `None`.
pub fn family_of(id: &str) -> Option<&'static str> {
    manifest(canonical_id(id)).and_then(|m| m.family.as_deref())
}

/// Filename (without extension) in the `include_str!` list, used by the directory consistency test.
pub fn registered_files(domain_dir: &str) -> Vec<&'static str> {
    match domain_dir {
        "motion" => MOTION_SOURCES
            .iter()
            .chain(MANIFEST_SOURCES.iter())
            .map(|(file, _)| *file)
            .collect(),
        "transition" => TRANSITION_SOURCES
            .iter()
            .chain(CAPTION_TRANSITION_SOURCES.iter())
            .map(|(file, _)| *file)
            .collect(),
        "shape" => SHAPE_SOURCES.iter().map(|(file, _)| *file).collect(),
        "sticker" => STICKER_SOURCES.iter().map(|(file, _)| *file).collect(),
        "visualizer" => VISUALIZER_SOURCES.iter().map(|(file, _)| *file).collect(),
        "progress" => PROGRESS_SOURCES.iter().map(|(file, _)| *file).collect(),
        "confetti" => CONFETTI_SOURCES.iter().map(|(file, _)| *file).collect(),
        "textpreset" => TEXTPRESET_SOURCES.iter().map(|(file, _)| *file).collect(),
        _ => Vec::new(),
    }
}

/// Force-parses all manifests. Parse errors surface here instead of panicking at the first sample.
pub fn validate_all() -> Result<(), MotionError> {
    build().map(|_| ())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::curve::{CurveSpec, EaseId};
    use crate::loop_kernel::{NoiseKind, WaveKind};
    use crate::preset_registry::frozen::{parse_loop, parse_transition};
    use crate::relative_value::LengthBasis;
    use crate::text_parts::PartUnit;

    #[test]
    fn one_catalogue_parses_the_same_as_the_full_registry() {
        let kinds = [
            (CatalogueKind::Shape, timeline_shapes()),
            (CatalogueKind::Sticker, timeline_stickers()),
            (CatalogueKind::Visualizer, timeline_visualizers()),
            (CatalogueKind::Progress, timeline_progresses()),
            (CatalogueKind::Confetti, timeline_confettis()),
        ];
        for (kind, registry) in kinds {
            assert_eq!(
                parse_builtin_catalogue(kind).unwrap(),
                registry,
                "{}",
                kind.dir()
            );
        }
        assert!(visualizer_style_aliases().contains(&("beam", "oscilloscope")));
    }

    #[test]
    fn catalogue_is_frozen_at_fifty_three_enter_forty_nine_exit_twenty_loop() {
        // Text catalogue 25/21/11 (frozen 2026-09-05) + element catalogue 28/28/9 (2026-09-08,
        // `surface: "element"`, uses the multi-keyframe form).
        assert_eq!(ids(Domain::TimelineEnter).len(), 53);
        assert_eq!(ids(Domain::TimelineExit).len(), 49);
        assert_eq!(ids(Domain::TimelineLoop).len(), 20);
        let element = |domain| {
            ids(domain)
                .into_iter()
                .filter(|id| id.starts_with("el"))
                .count()
        };
        assert_eq!(element(Domain::TimelineEnter), 28);
        assert_eq!(element(Domain::TimelineExit), 28);
        assert_eq!(element(Domain::TimelineLoop), 9);
        assert_eq!(ids(Domain::BcfMotion).len(), 5);
        assert_eq!(ids(Domain::BcfTransition).len(), 10);
    }

    #[test]
    fn enter_order_matches_the_timeline_schema_enum() {
        assert_eq!(
            ids(Domain::TimelineEnter),
            vec![
                // From round 156 onward, slide's four directions are contiguous in `order` (members of a direction family must be adjacent,
                // otherwise the flattening in `anim_direction::families` would not match the registry). Other
                // new recipes are appended at the tail. The schema enum only governs membership, not order.
                "none",
                "fade",
                "rise",
                "drop",
                "slideL",
                "slideR",
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
                "compress",
                "bounce",
                "fall",
                "skid",
                "roll",
                "wave",
                "flipboard",
                "dragonfly",
                "billboard",
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
            ]
        );
        assert_eq!(
            ids(Domain::TimelineLoop),
            vec![
                "float",
                "pulse",
                "sway",
                "jitter",
                "blink",
                "rotate",
                "heartBeat",
                "vogue",
                "dragonfly",
                "billboard",
                "roll",
                "elSpin",
                "elSpinSmooth",
                "elSpin3d",
                "elBounce",
                "elHeartbeat",
                "elSway",
                "elSway3d",
                "elSqueezy",
                "elJiggle",
            ]
        );
    }

    #[test]
    fn enter_and_exit_tables_stay_asymmetric() {
        // The exit table accepts sink/shrink, which have no same-named entry. Conversely,
        // pop/blurIn/typewriter/riseWords have no exit recipe (`drop` has a same-named exit since round 156 = the design draft's stomp exit; the enter drop mirror now points to it).
        // `bounce` does not have an exit recipe of its own: a reversed bounce (bounce first, then fly away) has no entry in the design draft.
        // Its mirror points to `rise`, though. App rule 6 requires every entry to be able to derive a "follow-through" exit. The pairing is the same as drop→rise (enter from above, leave upward).
        assert!(timeline_exit("sink").is_some());
        assert!(timeline_exit("shrink").is_some());
        assert!(timeline_enter("sink").is_none());
        for id in ["pop", "blurIn", "typewriter", "riseWords", "bounce"] {
            assert!(timeline_exit(id).is_none(), "{id} must have no exit recipe");
        }
        assert_eq!(
            timeline_enter("bounce").unwrap().mirror.as_deref(),
            Some("rise")
        );
        assert_eq!(
            timeline_enter("drop").unwrap().mirror.as_deref(),
            Some("drop")
        );
        // Slide's four directions: the entry "from which side" and the exit "toward which side" are paired by the same name.
        for id in ["slideL", "slideR", "slideUp", "slideDown"] {
            assert_eq!(timeline_enter(id).unwrap().mirror.as_deref(), Some(id));
        }
        assert!(timeline_enter("slideUp").unwrap().from.dy.unwrap() < 0.0);
        assert!(timeline_exit("slideUp").unwrap().from.dy.unwrap() < 0.0);
        assert!(timeline_enter("slideDown").unwrap().from.dy.unwrap() > 0.0);
        assert!(timeline_exit("slideDown").unwrap().from.dy.unwrap() > 0.0);
    }

    #[test]
    fn every_mirror_resolves_to_an_exit_recipe() {
        for id in ids(Domain::TimelineEnter) {
            let recipe = timeline_enter(id).unwrap();
            if let Some(mirror) = &recipe.mirror {
                assert!(
                    timeline_exit(mirror).is_some(),
                    "{id} mirrors missing exit {mirror}"
                );
            }
        }
    }

    #[test]
    fn one_over_twenty_four_survives_json_bit_for_bit() {
        let plan = timeline_enter("typewriter").unwrap().parts.unwrap();
        assert_eq!(plan.stagger.to_bits(), (1.0f64 / 24.0).to_bits());
        assert_eq!(plan.part_dur.to_bits(), 0.04f64.to_bits());
        assert_eq!(plan.unit, PartUnit::Char);
    }

    #[test]
    fn timeline_numbers_match_the_old_hardcoded_tables_bit_for_bit() {
        // Old table (`ccut-timeline/src/motion.rs:154-391`, `:905-941`), compared line by line.
        let enter_expect: &[(&str, f64, Option<&str>)] = &[
            ("none", 0.0, None),
            ("fade", 0.40, Some("fade")),
            ("rise", 0.50, Some("sink")),
            ("drop", 0.50, Some("drop")),
            ("slideL", 0.50, Some("slideL")),
            ("slideR", 0.50, Some("slideR")),
            ("pop", 0.45, Some("shrink")),
            ("zoomIn", 0.50, Some("zoomIn")),
            ("zoomOut", 0.50, Some("zoomOut")),
            ("spin", 0.55, Some("spin")),
            ("blurIn", 0.55, Some("fade")),
            ("typewriter", 0.60, Some("fade")),
            ("riseWords", 0.90, Some("sink")),
            ("wipe", 0.45, Some("wipe")),
            // Round 156 new recipes and their mirrors.
            ("slideUp", 0.5, Some("slideUp")),
            ("slideDown", 0.5, Some("slideDown")),
            ("wave", 0.6, Some("sink")),
            ("flipboard", 0.5, Some("flipboard")),
            ("dragonfly", 0.6, Some("dragonfly")),
            ("billboard", 0.5, Some("billboard")),
        ];
        for (id, duration, mirror) in enter_expect {
            let recipe = timeline_enter(id).unwrap();
            assert_eq!(recipe.duration.to_bits(), duration.to_bits(), "{id}");
            assert_eq!(recipe.mirror.as_deref(), *mirror, "{id}");
            assert_eq!(recipe.version, 1);
        }
        assert_eq!(timeline_enter("rise").unwrap().from.dy, Some(0.033));
        assert_eq!(timeline_enter("drop").unwrap().from.dy, Some(-0.033));
        assert_eq!(timeline_enter("slideL").unwrap().from.dx, Some(-0.05));
        assert_eq!(timeline_enter("slideR").unwrap().from.dx, Some(0.05));
        assert_eq!(timeline_enter("blurIn").unwrap().from.blur, Some(8.0));
        assert_eq!(timeline_enter("wipe").unwrap().from.reveal, Some(0.0));
        assert_eq!(timeline_enter("wipe").unwrap().from.opacity, None);
        assert_eq!(timeline_enter("riseWords").unwrap().from.dy, Some(0.026));
        assert_eq!(timeline_enter("spin").unwrap().from.rotation, Some(-12.0));
        assert_eq!(
            timeline_enter("pop").unwrap().curve,
            CurveSpec::Spring {
                response: 0.5,
                damping: 0.82
            }
        );
        assert_eq!(
            timeline_enter("pop").unwrap().opacity_curve,
            Some(CurveSpec::Named(EaseId::EaseOutExpo))
        );
        assert_eq!(
            timeline_enter("spin").unwrap().opacity_curve,
            Some(CurveSpec::Named(EaseId::EaseOutCubic))
        );

        let exit_expect: &[(&str, f64)] = &[
            ("none", 0.0),
            ("fade", 0.30),
            ("sink", 0.375),
            ("rise", 0.375),
            ("slideL", 0.375),
            ("slideR", 0.375),
            ("shrink", 0.34),
            ("zoomIn", 0.375),
            ("zoomOut", 0.375),
            ("spin", 0.41),
            ("wipe", 0.34),
        ];
        for (id, duration) in exit_expect {
            let recipe = timeline_exit(id).unwrap();
            assert_eq!(recipe.duration.to_bits(), duration.to_bits(), "{id}");
            assert!(recipe.mirror.is_none(), "{id}");
        }
        assert_eq!(timeline_exit("sink").unwrap().from.dy, Some(0.028));
        assert_eq!(timeline_exit("rise").unwrap().from.dy, Some(-0.028));
        assert_eq!(timeline_exit("slideL").unwrap().from.dx, Some(-0.042));
        assert_eq!(timeline_exit("slideR").unwrap().from.dx, Some(0.042));
        assert_eq!(timeline_exit("shrink").unwrap().from.scale_x, Some(0.60));
        assert_eq!(timeline_exit("spin").unwrap().from.rotation, Some(12.0));
        assert_eq!(
            timeline_exit("spin").unwrap().opacity_curve,
            Some(CurveSpec::Named(EaseId::EaseInCubic))
        );

        let loop_expect: &[(&str, f64, WaveKind)] = &[
            ("float", 2.4, WaveKind::Sine),
            ("pulse", 2.0, WaveKind::Sine),
            ("sway", 2.8, WaveKind::Sine),
            ("jitter", 0.6, WaveKind::Noise),
            ("blink", 1.2, WaveKind::Dip),
            ("rotate", 2.0, WaveKind::Ramp),
            ("heartBeat", 2.0, WaveKind::Heartbeat),
            ("vogue", 2.4, WaveKind::Sine),
            ("dragonfly", 1.6, WaveKind::Sine),
            ("billboard", 2.0, WaveKind::Dip),
            ("roll", 2.0, WaveKind::Sine),
        ];
        for (id, period, wave) in loop_expect {
            let recipe = timeline_loop(id).unwrap();
            assert_eq!(recipe.period.to_bits(), period.to_bits(), "{id}");
            assert_eq!(recipe.wave, *wave, "{id}");
            assert_eq!(recipe.wave_samples, 32, "{id}");
            assert_eq!(recipe.channel_seed_stride, 101, "{id}");
            assert_eq!(recipe.default_seed, 17, "{id}");
        }
        assert_eq!(timeline_loop("float").unwrap().amplitudes.dy, Some(0.0055));
        assert_eq!(
            timeline_loop("pulse").unwrap().amplitudes.scale_x,
            Some(0.012)
        );
        assert_eq!(
            timeline_loop("sway").unwrap().amplitudes.rotation,
            Some(0.6)
        );
        assert_eq!(timeline_loop("jitter").unwrap().amplitudes.dx, Some(0.0035));
        assert_eq!(
            timeline_loop("blink").unwrap().amplitudes.opacity,
            Some(0.35)
        );
        let noise = timeline_loop("jitter").unwrap().noise.unwrap();
        assert_eq!(noise.kind, NoiseKind::LatticeMurmurV1);
        assert_eq!(noise.lattice, 8);
        assert_eq!(noise.default_seed, 17);
    }

    #[test]
    fn builtin_map_equals_the_old_resolve_literal() {
        // String constant copy of `ccut-core/src/resolve.rs:425-438`. Lossless extraction is proven by this
        // test. After one version is released, the literals can be deleted.
        const OLD_BUILTIN_PRESETS: &str = r#"{
  "fadeIn":  { "keyframes": [ { "prop": "opacity", "frames": [ { "t": "0%", "v": 0 }, { "t": "100%", "v": 1 } ] } ] },
  "fadeOut": { "keyframes": [ { "prop": "opacity", "frames": [ { "t": "0%", "v": 1 }, { "t": "100%", "v": 0 } ] } ] },
  "countUp": { "params": { "to": { "default": 1 }, "prefix": { "default": "" }, "suffix": { "default": "" }, "decimals": { "default": 0 } },
    "keyframes": [ { "prop": "textCount", "frames": [ { "t": "0%", "v": 0 }, { "t": "100%", "v": "{to}", "ease": "easeOutCubic" } ] } ] },
  "barFill": { "params": { "to": { "default": 1 } },
    "keyframes": [ { "prop": "scaleY", "frames": [ { "t": "0%", "v": 0 }, { "t": "100%", "v": "{to}", "ease": "easeOutQuart" } ] } ] },
  "kenBurns": { "params": { "fromZoom": { "default": 1 }, "toZoom": { "default": 1.1 },
                            "fromX": { "default": 0 }, "toX": { "default": 0 },
                            "fromY": { "default": 0 }, "toY": { "default": 0 } },
    "keyframes": [ { "prop": "cam", "frames": [
      { "t": "0%",   "v": { "x": "{fromX}", "y": "{fromY}", "zoom": "{fromZoom}" } },
      { "t": "100%", "v": { "x": "{toX}",   "y": "{toY}",   "zoom": "{toZoom}" }, "ease": "easeInOutSine" } ] } ] }
}"#;
        let old: Value = serde_json::from_str(OLD_BUILTIN_PRESETS).unwrap();
        assert_eq!(&old, bcf_builtin_map());
        assert!(emits_params_meta("countUp"));
        assert!(!emits_params_meta("fadeIn"));
        assert!(!emits_params_meta("notAPreset"));
    }

    #[test]
    fn transition_recipes_match_the_old_match_arms() {
        assert!(bcf_transition("cut").unwrap().prop.is_none());
        assert!(bcf_transition("cut").unwrap().is_cut());
        let crossfade = bcf_transition("crossfade").unwrap();
        assert_eq!(crossfade.prop.as_deref(), Some("opacity"));
        assert_eq!(crossfade.ease.as_deref(), Some("easeInOutSine"));
        assert_eq!(crossfade.out[0].prop, "opacity");
        assert_eq!(crossfade.out[0].ease.as_deref(), Some("easeInOutSine"));
        assert_eq!(crossfade.out[0].from.value, 1.0);
        assert_eq!(crossfade.out[0].to.value, 0.0);
        assert_eq!(crossfade.r#in[0].from.value, 0.0);
        assert_eq!(crossfade.r#in[0].to.value, 1.0);

        let left = bcf_transition("slideLeft").unwrap();
        assert_eq!(left.prop.as_deref(), Some("x"));
        assert_eq!(left.out[0].to.basis, LengthBasis::CanvasWidth);
        assert_eq!(left.out[0].to.value, -1.0);
        assert_eq!(left.r#in[0].from.value, 1.0);

        let up = bcf_transition("slideUp").unwrap();
        assert_eq!(up.prop.as_deref(), Some("y"));
        assert_eq!(up.out[0].to.basis, LengthBasis::CanvasHeight);
        assert_eq!(up.out[0].to.value, -1.0);
        assert_eq!(up.r#in[0].from.value, 1.0);

        let down = bcf_transition("slideDown").unwrap();
        assert_eq!(down.out[0].to.value, 1.0);
        assert_eq!(down.r#in[0].from.value, -1.0);
        assert!(bcf_transition("nope").is_none());
    }

    /// The spec §9 vocabulary completed in phase 5: the `prop` differs between the two sides (wipe), and sides with multiple channels
    /// (zoomThrough / whipPan) must both parse into channel tables.
    #[test]
    fn the_spec_section_nine_vocabulary_is_complete() {
        assert_eq!(
            ids(Domain::BcfTransition),
            [
                "cut",
                "crossfade",
                "slideLeft",
                "slideRight",
                "slideUp",
                "slideDown",
                "wipeLeft",
                "wipeRight",
                "zoomThrough",
                "whipPan",
            ]
        );

        // wipe: the same edge, with the two sides clipping different halves.
        let left = bcf_transition("wipeLeft").unwrap();
        assert!(left.prop.is_none());
        assert_eq!(left.out[0].prop, "clipInsetRight");
        assert_eq!((left.out[0].from.value, left.out[0].to.value), (0.0, 1.0));
        assert_eq!(left.r#in[0].prop, "clipInsetLeft");
        assert_eq!((left.r#in[0].from.value, left.r#in[0].to.value), (1.0, 0.0));
        let right = bcf_transition("wipeRight").unwrap();
        assert_eq!(right.out[0].prop, "clipInsetLeft");
        assert_eq!(right.r#in[0].prop, "clipInsetRight");
        // Every channel inherits the recipe's default ease.
        for recipe in [left, right] {
            for channel in recipe.out.iter().chain(recipe.r#in.iter()) {
                assert_eq!(channel.ease.as_deref(), Some("easeInOutSine"));
            }
        }

        // zoomThrough / whipPan: two channels per side, each with its own ease.
        let zoom = bcf_transition("zoomThrough").unwrap();
        assert_eq!(
            zoom.out.iter().map(|c| c.prop.as_str()).collect::<Vec<_>>(),
            ["scale", "opacity"]
        );
        assert_eq!(zoom.out[0].to.value, 2.5);
        assert_eq!(zoom.out[0].ease.as_deref(), Some("easeInCubic"));
        assert_eq!(zoom.r#in[0].from.value, 0.5);
        assert_eq!(zoom.r#in[0].ease.as_deref(), Some("easeOutCubic"));

        let whip = bcf_transition("whipPan").unwrap();
        assert_eq!(
            whip.out.iter().map(|c| c.prop.as_str()).collect::<Vec<_>>(),
            ["x", "opacity"]
        );
        // The out side swings to the left; the in side brakes back in from the right. The directions must be opposite, otherwise the two frames would move stacked together.
        assert_eq!(whip.out[0].to.value, -1.2);
        assert_eq!(whip.out[0].to.basis, LengthBasis::CanvasWidth);
        assert_eq!(whip.r#in[0].from.value, 1.2);
        assert_eq!(whip.r#in[0].from.basis, LengthBasis::CanvasWidth);
    }

    #[test]
    fn manifest_hashes_are_stable_and_distinct() {
        let a = timeline_enter("fade").unwrap().manifest_hash;
        let b = timeline_enter("rise").unwrap().manifest_hash;
        assert_ne!(a, b);
        assert_eq!(a, timeline_enter("fade").unwrap().manifest_hash);
    }

    #[test]
    fn unknown_kernel_names_are_rejected_at_parse_time() {
        let bad = serde_json::json!({
            "id": "bad", "version": 1, "domain": "motion", "namespace": "timeline",
            "slot": "loop", "order": 0, "period": 1.0,
            "amplitudes": {"dy": 0.01},
            "wave": {"kind": "noise", "samples": 32, "noise": {"kind": "perlin", "lattice": 8}},
            "channelSeedStride": 101, "defaultSeed": 17,
            "envelope": {"kind": "idle-ramp-v1", "rampCap": 0.3, "rampFraction": 0.15,
                         "tailThresholdSec": 6.0, "tailStart": 0.8, "tailSpan": 0.2},
            "determinism": "strict"
        });
        assert!(matches!(
            parse_loop("bad.json", &bad, 0),
            Err(MotionError::ManifestInvalid(_))
        ));

        let bad_envelope = serde_json::json!({
            "id": "bad", "version": 1, "domain": "motion", "namespace": "timeline",
            "slot": "loop", "order": 0, "period": 1.0,
            "amplitudes": {"dy": 0.01},
            "wave": {"kind": "sine", "samples": 32},
            "channelSeedStride": 101, "defaultSeed": 17,
            "envelope": {"kind": "linear-fade", "rampCap": 0.3, "rampFraction": 0.15,
                         "tailThresholdSec": 6.0, "tailStart": 0.8, "tailSpan": 0.2},
            "determinism": "strict"
        });
        assert!(matches!(
            parse_loop("bad.json", &bad_envelope, 0),
            Err(MotionError::ManifestInvalid(_))
        ));
    }

    /// Parsing discipline for channel tables: empty arrays, a missing `prop`, and a `channels` that is not an array must all raise errors,
    /// rather than silently producing zero channels (zero channels = `cut`, which means something else).
    #[test]
    fn transition_channel_tables_are_parsed_strictly() {
        let base = serde_json::json!({
            "id": "x", "version": 1, "order": 0,
            "out": { "channels": [] }
        });
        assert!(matches!(
            parse_transition("bad.json", &base, 0),
            Err(MotionError::ManifestInvalid(_))
        ));

        let no_prop = serde_json::json!({
            "id": "x", "version": 1, "order": 0,
            "out": { "channels": [{ "from": {"value": 0, "basis": "absolute"},
                                    "to": {"value": 1, "basis": "absolute"} }] }
        });
        assert!(matches!(
            parse_transition("bad.json", &no_prop, 0),
            Err(MotionError::ManifestInvalid(_))
        ));

        let not_array = serde_json::json!({
            "id": "x", "version": 1, "order": 0, "out": { "channels": 3 }
        });
        assert!(matches!(
            parse_transition("bad.json", &not_array, 0),
            Err(MotionError::ManifestInvalid(_))
        ));

        // The single-channel sugar and the channel table parse into the same structure.
        let sugar = serde_json::json!({
            "id": "x", "version": 1, "order": 0, "prop": "opacity", "ease": "linear",
            "out": { "from": {"value": 1, "basis": "absolute"},
                     "to": {"value": 0, "basis": "absolute"} }
        });
        let table = serde_json::json!({
            "id": "x", "version": 1, "order": 0,
            "out": { "channels": [{ "prop": "opacity", "ease": "linear",
                                    "from": {"value": 1, "basis": "absolute"},
                                    "to": {"value": 0, "basis": "absolute"} }] }
        });
        assert_eq!(
            parse_transition("a.json", &sugar, 0).unwrap().out,
            parse_transition("b.json", &table, 0).unwrap().out
        );
    }

    #[test]
    fn all_manifests_parse() {
        validate_all().unwrap();
        // 127 frozen shapes (timeline text 57 + element 65 + bcf 5) + 34 generic manifests.
        assert_eq!(registered_files("motion").len(), 161);
        assert_eq!(MANIFEST_SOURCES.len(), 34);
        assert_eq!(registered_files("transition").len(), 13);
        // P7a: 23 basic shapes + CucCut's own `line` (see SHAPE_SOURCES).
        assert_eq!(registered_files("shape").len(), 24);
        assert_eq!(registered_files("visualizer").len(), 10);
        assert_eq!(registered_files("progress").len(), 14);
        // P7b: the first batch of 10 template stickers (see `STICKER_SOURCES`).
        assert_eq!(registered_files("sticker").len(), 10);
        // Ten confetti styles (see `CONFETTI_SOURCES`).
        assert_eq!(registered_files("confetti").len(), 10);
        // An unknown catalogue still returns empty. `registered_files` is a hard-coded match, so forgetting to add an arm silently
        // misses it. Therefore the catalogue loop in `tests/manifests.rs` must be extended in sync. The sentinel uses `filter`:
        // it is the effect registry's catalogue (`tests/effects.rs` manages it), and the preset side never recognizes it.
        assert!(registered_files("filter").is_empty());
    }

    // ── Catalogue-type recipes (ADR-E05) ─────────────────────────────────────────

    #[test]
    fn the_shape_catalogue_is_a_third_recipe_shape_not_a_manifest() {
        // Data does not go into the `manifests` vector, so the three phase-2 guards are unaffected.
        for id in ids(Domain::TimelineShape) {
            assert!(manifest(id).is_none(), "{id} should not appear in the generic manifest");
            assert!(!manifest_ids().contains(&id), "{id}");
            assert_eq!(canonical_id(id), id, "{id} should not have an alias");
            assert!(family_of(id).is_none(), "{id} should not take up the family budget");
        }
        // Panel order = fixed grid order; `line` and the line-segment `arrow` take the arrow slot.
        // **Not** filename sorting, nor the order of writing in the list.
        assert_eq!(
            ids(Domain::TimelineShape),
            vec![
                "rect", "ellipse", "triangle", "rombus", "pentagon", "hex", "octagon", "squig",
                "squig2", "line", "arrow", "tick", "tick2", "chevron", "chevron2", "cross2",
                "cross", "love2", "love", "diamond", "star", "sharp", "star2", "sharp2"
            ],
            "directory order comes from the order field, not from file-name sorting"
        );
    }

    /// Acceptance criterion for §10 P7: **none of the 23 basic shape names is missing**,
    /// and each one can actually be looked up to a recipe. `line` is CucCut's own 24th entry and is asserted separately,
    /// so that "one basic shape missing but one own shape added" does not cancel out in the total.
    #[test]
    fn the_shape_catalogue_covers_every_base_shape_name() {
        const BASE_SHAPE_NAMES: [&str; 23] = [
            "rect", "ellipse", "triangle", "rombus", "pentagon", "hex", "octagon", "squig",
            "squig2", "arrow", "tick", "tick2", "chevron", "chevron2", "cross", "cross2", "love",
            "love2", "diamond", "star", "star2", "sharp", "sharp2",
        ];
        for name in BASE_SHAPE_NAMES {
            let recipe = timeline_shape(name).unwrap_or_else(|| panic!("missing shape {name}"));
            assert!(recipe.available, "{name} should be selectable");
            assert_eq!(recipe.qualified_id(), format!("shape.{name}"));
        }
        assert!(
            timeline_shape("line").is_some(),
            "CucCut's own line must not be removed"
        );
        assert_eq!(timeline_shapes().len(), BASE_SHAPE_NAMES.len() + 1);

        // All 21 path shapes fall under `outline` (`rect` / `ellipse` are parameterized path.kind, and `line` / `arrow` are line segments).
        let outlines = timeline_shapes()
            .iter()
            .filter(|recipe| matches!(recipe.shape().unwrap().path, ShapePath::Outline { .. }))
            .count();
        assert_eq!(outlines, 20, "20 outline shapes = 21 path shapes minus the block arrow");
    }

    #[test]
    fn the_shape_recipes_carry_their_path_and_param_vocabulary() {
        let rect = timeline_shape("rect").unwrap();
        assert_eq!(rect.version, 1);
        assert!(rect.available);
        assert_eq!(rect.qualified_id(), "shape.rect");
        let body = rect.shape().unwrap();
        assert_eq!(body.path, ShapePath::Rect);
        assert!(body.supports(ShapeParam::CornerRadius));
        assert!(!body.supports(ShapeParam::Endpoints));

        assert_eq!(
            timeline_shape("ellipse").unwrap().shape().unwrap().path,
            ShapePath::Ellipse
        );
        assert_eq!(
            timeline_shape("line").unwrap().shape().unwrap().path,
            ShapePath::Segment {
                default_head: ShapeHead::None
            }
        );
        let arrow = timeline_shape("arrow").unwrap().shape().unwrap();
        assert_eq!(
            arrow.path,
            ShapePath::Segment {
                default_head: ShapeHead::Arrow
            }
        );
        assert!(arrow.supports(ShapeParam::Head));
        // Ellipse does not take a corner radius. The property panel hides the control accordingly, and rendering accordingly does not read that field.
        assert!(
            !timeline_shape("ellipse")
                .unwrap()
                .shape()
                .unwrap()
                .supports(ShapeParam::CornerRadius)
        );
        assert!(timeline_shape("hexagon").is_none());
    }

    /// `(id, version)` + `manifest_hash` freeze discipline: the same source, byte for byte, gives the same hash.
    #[test]
    fn the_shape_manifest_hash_is_the_content_hash_of_the_source_file() {
        for (file, source) in SHAPE_SOURCES {
            let recipe = timeline_shape(file).unwrap();
            assert_eq!(recipe.manifest_hash, fnv1a64(source.as_bytes()), "{file}");
        }
    }

    #[test]
    fn a_shape_recipe_that_lies_about_itself_is_rejected_at_parse_time() {
        use catalogue::parse_catalogue;
        let good = serde_json::json!({
            "id": "rect", "version": 1, "domain": "shape", "namespace": "timeline",
            "order": 0, "path": {"kind": "rect"}, "params": ["fill"], "available": true
        });
        assert!(parse_catalogue(CatalogueKind::Shape, "rect", &good, 0).is_ok());
        for (file, mutate) in [
            ("rect", "id"),
            ("rect", "domain"),
            ("rect", "namespace"),
            ("rect", "params"),
            ("rect", "pathKind"),
        ] {
            let mut doc = good.clone();
            match mutate {
                "id" => doc["id"] = serde_json::json!("square"),
                "domain" => doc["domain"] = serde_json::json!("motion"),
                "namespace" => doc["namespace"] = serde_json::json!("bcf"),
                "params" => doc["params"] = serde_json::json!(["glow"]),
                _ => doc["path"]["kind"] = serde_json::json!("blob"),
            }
            assert!(
                parse_catalogue(CatalogueKind::Shape, file, &doc, 0).is_err(),
                "{mutate} should fail with manifest-invalid at parse time"
            );
        }
    }

    /// P7's 19 shapes go through `outline`: points are all normalized to the element box 0..1,
    /// and verbs and point counts are paired at parse time, so consumers need not guard against mismatches.
    #[test]
    fn outline_paths_are_validated_at_parse_time() {
        let doc = serde_json::json!({
            "id": "tri", "version": 1, "domain": "shape", "namespace": "timeline",
            "order": 9, "available": true, "params": ["fill"],
            "path": {"kind": "outline", "segments": [
                {"verb": "move", "pts": [[0.5, 0.0]]},
                {"verb": "line", "pts": [[1.0, 1.0]]},
                {"verb": "line", "pts": [[0.0, 1.0]]},
                {"verb": "close"}
            ]}
        });
        let recipe = catalogue::parse_catalogue(CatalogueKind::Shape, "tri", &doc, 0).unwrap();
        assert_eq!(
            recipe.shape().unwrap().path,
            ShapePath::Outline {
                segments: vec![
                    PathSegment::Move([0.5, 0.0]),
                    PathSegment::Line([1.0, 1.0]),
                    PathSegment::Line([0.0, 1.0]),
                    PathSegment::Close,
                ]
            }
        );
        let mut bad = doc.clone();
        bad["path"]["segments"][1] =
            serde_json::json!({"verb": "line", "pts": [[0.0, 0.0], [1.0, 1.0]]});
        assert!(catalogue::parse_catalogue(CatalogueKind::Shape, "tri", &bad, 0).is_err());
        let mut headless = doc;
        headless["path"]["segments"][0] = serde_json::json!({"verb": "line", "pts": [[0.5, 0.0]]});
        assert!(catalogue::parse_catalogue(CatalogueKind::Shape, "tri", &headless, 0).is_err());
    }

    // ── visualizer / progress catalogues (design §7.3 / §7.4) ─────────────────

    /// The two new domains are isomorphic to shape: their data is in separate fields and never in `manifests`,
    /// so phase 2's guards (the family budget, the full `exposedTo` assertion of `manifest_ids()`,
    /// and the built-in preset id query surface) **need no modification and will not turn red**.
    #[test]
    fn the_new_catalogues_stay_out_of_the_manifest_pipeline() {
        for domain in [
            Domain::TimelineVisualizer,
            Domain::TimelineProgress,
            Domain::TimelineConfetti,
        ] {
            for id in ids(domain) {
                assert!(manifest(id).is_none(), "{id} should not appear in the generic manifest");
                assert!(!manifest_ids().contains(&id), "{id}");
                assert_eq!(canonical_id(id), id, "{id} should not have an alias");
                assert!(family_of(id).is_none(), "{id} should not take up the family budget");
                assert!(!families().contains(&id), "{id}");
            }
        }
    }

    /// Catalogue order comes from the `order` field. Sound waves follow the table order of design §7.3 (bars → waveform → area →
    /// dot matrix → pulse → ribbons), and progress bars follow the fixed order of the style dropdown.
    #[test]
    fn the_catalogue_order_matches_the_style_dropdowns() {
        assert_eq!(
            ids(Domain::TimelineVisualizer),
            vec![
                "bars",
                "bars_rounded",
                "bars_bottom",
                "ring_bars",
                "oscilloscope",
                "ring_wave",
                "spectrum_area",
                "dots",
                "pulse_rings",
                "ribbons",
            ]
        );
        assert_eq!(
            ids(Domain::TimelineProgress),
            vec![
                "normal",
                "rounded",
                "circle",
                "donut",
                "border",
                "reverse_border",
                "rainbow_border",
                "reverse_rainbow_border",
                // The spelling is `strobe` (频闪, stroboscopic flashing).
                "strobe_border",
                "reverse_strobe_border",
                "snake",
                "snake_spin",
                "snake_rainbow",
                "snake_spin_rainbow",
            ]
        );
        // Confetti catalogue order = the table order of design draft §4.4, which is also the grid order of the prototype's "confetti" tile grid.
        assert_eq!(
            ids(Domain::TimelineConfetti),
            vec![
                "rainbow-paper",
                "pastel-fall",
                "neon-streamers",
                "golden-starburst",
                "festival-fireworks",
                "hearts-petals",
                "party-cannons",
                "curling-ribbons",
                "geometric-pop",
                "champagne-sparkle",
            ]
        );
    }

    /// Ten confetti styles: palette of 1–8 colors, shapes all within a closed table, algorithm always `confetti-v1`,
    /// and each one credits its adaptation source. `recipe()` has a value for it (the render core uses it to fetch the parameter bundle).
    #[test]
    fn every_confetti_recipe_is_well_formed() {
        assert_eq!(timeline_confettis().len(), 10);
        for recipe in timeline_confettis() {
            assert!(recipe.available, "{}", recipe.id);
            assert_eq!(recipe.version, 1, "{}", recipe.id);
            assert_eq!(recipe.qualified_id(), format!("confetti.{}", recipe.id));
            let body = recipe.confetti().expect(&recipe.id);
            assert!((1..=8).contains(&body.palette.len()), "{}", recipe.id);
            assert!(!body.shapes.is_empty(), "{}", recipe.id);
            assert!(
                body.shapes
                    .iter()
                    .all(|s| CONFETTI_SHAPES.contains(&s.as_str())),
                "{}",
                recipe.id
            );
            assert!(!body.sources.is_empty(), "{}", recipe.id);
            assert_eq!(body.recipe.algorithm, RecipeAlgorithm::ConfettiV1);
            assert_eq!(body.determinism, Determinism::Strict, "{}", recipe.id);
            assert!(recipe.recipe().is_some(), "{}", recipe.id);
            assert!(recipe.progress().is_none() && recipe.visualizer().is_none());
        }
        assert!(timeline_confetti("rainbow-paper").is_some());
        assert!(timeline_confetti("dyn-confetti-01").is_none());
    }

    /// CucCut has no paid tiers: every style in the catalogue is selectable.
    #[test]
    fn every_catalogue_recipe_is_available_at_version_one() {
        for recipe in timeline_visualizers()
            .iter()
            .chain(timeline_progresses().iter())
        {
            assert!(recipe.available, "{}", recipe.id);
            assert_eq!(recipe.version, 1, "{}", recipe.id);
        }
        assert_eq!(timeline_visualizers().len(), 10);
        assert_eq!(timeline_progresses().len(), 14);
        assert_eq!(
            timeline_visualizer("bars").unwrap().qualified_id(),
            "visualizer.bars"
        );
        assert_eq!(
            timeline_progress("snake_spin").unwrap().qualified_id(),
            "progress.snake_spin"
        );
        assert!(timeline_visualizer("stropeBorder").is_none());
        assert!(timeline_progress("countdown").is_none());
    }

    /// Palette arrangement for progress bars: **four categories**, not one.
    ///
    /// The two rainbow-border styles emit no colors across their whole segment (`numColors == 0`: their stroke colors are hard-coded in the shader's rainbow, so changing the palette makes no visual difference).
    /// The two traveling-rainbow styles output only one swatch, titled `Background`, which sits on the **main color**. The two strobe-border styles name their two colors
    /// `Color 1` / `Color 2`. The rest are split into `Bar/Base` (bar and track), `Bar/Background`
    /// (border and canvas background), and `Foreground/Background` (traveling).
    #[test]
    fn the_progress_color_table_matches_the_registry() {
        let expect: &[(&str, u8, &[&str])] = &[
            ("normal", 2, &["Bar", "Base"]),
            ("rounded", 2, &["Bar", "Base"]),
            ("circle", 2, &["Bar", "Base"]),
            ("donut", 2, &["Bar", "Base"]),
            ("border", 2, &["Bar", "Background"]),
            ("reverse_border", 2, &["Bar", "Background"]),
            ("rainbow_border", 0, &[]),
            ("reverse_rainbow_border", 0, &[]),
            ("strobe_border", 2, &["Color 1", "Color 2"]),
            ("reverse_strobe_border", 2, &["Color 1", "Color 2"]),
            ("snake", 2, &["Foreground", "Background"]),
            ("snake_spin", 2, &["Foreground", "Background"]),
            ("snake_rainbow", 1, &["Background"]),
            ("snake_spin_rainbow", 1, &["Background"]),
        ];
        assert_eq!(expect.len(), timeline_progresses().len());
        for (id, num_colors, labels) in expect {
            let body = timeline_progress(id).unwrap().progress().unwrap().clone();
            assert_eq!(body.num_colors, *num_colors, "{id}");
            assert_eq!(body.color_labels, *labels, "{id}");
        }
    }

    /// The style property table, aligned one by one to design §7.3: the two time-domain waveforms (oscilloscope / ring_wave) use a narrow
    /// dB window, `half` bins, and no dB control. The four dual-palette styles (spectrum_area / dots / pulse /
    /// ribbons) each have two titles, which are the names of the property panel's palette swatches.
    #[test]
    fn the_visualizer_style_table_matches_the_design() {
        // (id, numColors, main, minDb, maxDb, hasControl, binWidth, aspect)
        let expect: &[(&str, u8, &str, f64, f64, bool, BinWidth, VisualizerAspect)] = &[
            (
                "bars",
                1,
                "#3CADFF",
                -80.0,
                40.0,
                true,
                BinWidth::Fixed64,
                VisualizerAspect::Free,
            ),
            (
                "bars_rounded",
                1,
                "#FF6B9A",
                -80.0,
                40.0,
                true,
                BinWidth::Fixed64,
                VisualizerAspect::Free,
            ),
            (
                "bars_bottom",
                1,
                "#70DB74",
                -80.0,
                40.0,
                true,
                BinWidth::Fixed64,
                VisualizerAspect::Free,
            ),
            (
                "ring_bars",
                1,
                "#FFAC46",
                -80.0,
                40.0,
                true,
                BinWidth::Fixed64,
                VisualizerAspect::Square,
            ),
            (
                "oscilloscope",
                1,
                "#46E1FF",
                -120.0,
                -10.0,
                false,
                BinWidth::Half,
                VisualizerAspect::Free,
            ),
            (
                "ring_wave",
                1,
                "#B98CFF",
                -120.0,
                -10.0,
                false,
                BinWidth::Half,
                VisualizerAspect::Square,
            ),
            (
                "spectrum_area",
                2,
                "#3CADFF",
                -80.0,
                40.0,
                true,
                BinWidth::Fixed64,
                VisualizerAspect::Free,
            ),
            (
                "dots",
                2,
                "#3CADFF",
                -80.0,
                40.0,
                true,
                BinWidth::Fixed64,
                VisualizerAspect::Free,
            ),
            (
                "pulse_rings",
                2,
                "#3CADFF",
                -80.0,
                40.0,
                true,
                BinWidth::Fixed64,
                VisualizerAspect::Square,
            ),
            (
                "ribbons",
                2,
                "#437BDC",
                -80.0,
                40.0,
                true,
                BinWidth::Fixed64,
                VisualizerAspect::Free,
            ),
        ];
        assert_eq!(expect.len(), timeline_visualizers().len());
        for (id, num_colors, main, min_db, max_db, has_control, bin_width, aspect) in expect {
            let body = timeline_visualizer(id).unwrap().visualizer().unwrap();
            assert_eq!(body.num_colors, *num_colors, "{id}");
            assert_eq!(body.color_labels.len(), usize::from(*num_colors), "{id}");
            assert_eq!(body.default_main_color, *main, "{id}");
            assert_eq!(body.default_min_db.to_bits(), min_db.to_bits(), "{id}");
            assert_eq!(body.default_max_db.to_bits(), max_db.to_bits(), "{id}");
            assert_eq!(body.has_control, *has_control, "{id}");
            assert_eq!(body.bin_width, *bin_width, "{id}");
            assert_eq!(body.aspect, *aspect, "{id}");
            assert!(
                body.shader.is_none(),
                "{id}: all sound-wave recipes are CPU vectors and have no WGSL"
            );
        }
        // Only the two styles that read time-domain rows use the narrow dB window, and only they are `half` and have no dB control.
        let half: Vec<&str> = timeline_visualizers()
            .iter()
            .filter(|r| r.visualizer().unwrap().bin_width == BinWidth::Half)
            .map(|r| r.id.as_str())
            .collect();
        assert_eq!(half, vec!["oscilloscope", "ring_wave"]);
        let labels = |id: &str| {
            timeline_visualizer(id)
                .unwrap()
                .visualizer()
                .unwrap()
                .color_labels
                .clone()
        };
        assert_eq!(labels("spectrum_area"), vec!["Fill", "Line"]);
        assert_eq!(labels("dots"), vec!["Dots", "Peaks"]);
        assert_eq!(labels("pulse_rings"), vec!["Core", "Rings"]);
        assert_eq!(labels("ribbons"), vec!["Ribbon A", "Ribbon B"]);
        assert_eq!(
            timeline_visualizer("dots")
                .unwrap()
                .visualizer()
                .unwrap()
                .default_secondary_color,
            "#FF4C45"
        );
    }

    /// All 15 ids of the old catalogue are folded into the new catalogue, so an old project's `visualizer.style` does not
    /// become `None`. New ids and unknown ids are returned as-is.
    #[test]
    fn every_legacy_visualizer_style_resolves_to_a_current_recipe() {
        let expect: &[(&str, &str)] = &[
            ("trio_wave", "bars"),
            ("formation", "bars"),
            ("formation_thin", "bars"),
            ("formation_rounded", "bars_rounded"),
            ("formation_aligned", "bars_bottom"),
            ("formation_thin_aligned", "bars_bottom"),
            ("static", "bars_bottom"),
            ("formation_circle", "ring_bars"),
            ("beam", "oscilloscope"),
            ("simi", "ribbons"),
            ("harmony", "ribbons"),
            ("waves", "ribbons"),
            ("frequency_lines", "dots"),
            ("echo_lines", "dots"),
            ("ripple_wave", "pulse_rings"),
        ];
        assert_eq!(expect.len(), 15);
        for (old, new) in expect {
            assert_eq!(canonical_visualizer_style(old), *new, "{old}");
            assert_eq!(timeline_visualizer(old).unwrap().id, *new, "{old}");
            // The alias is only a compatibility layer. The catalogue itself no longer registers the old ids.
            assert!(!ids(Domain::TimelineVisualizer).contains(old), "{old}");
        }
        for id in ids(Domain::TimelineVisualizer) {
            assert_eq!(canonical_visualizer_style(id), id);
        }
        assert_eq!(canonical_visualizer_style("nope"), "nope");
        assert!(timeline_visualizer("nope").is_none());
    }

    /// The determinism grading is the ADR-E05 table. The values are existing Rust enums, not new string constants.
    #[test]
    fn the_determinism_grades_match_adr_e05() {
        let visual_visualizers: Vec<&str> = timeline_visualizers()
            .iter()
            .filter(|r| r.visualizer().unwrap().determinism == Determinism::Visual)
            .map(|r| r.id.as_str())
            .collect();
        // All 10 sound waves are pure vector, with no noise and no GPU branch. None of them needs the `visual` level.
        assert!(visual_visualizers.is_empty(), "{visual_visualizers:?}");
        let visual_progress: Vec<&str> = timeline_progresses()
            .iter()
            .filter(|r| r.progress().unwrap().determinism == Determinism::Visual)
            .map(|r| r.id.as_str())
            .collect();
        assert_eq!(
            visual_progress,
            vec![
                "rainbow_border",
                "reverse_rainbow_border",
                "strobe_border",
                "reverse_strobe_border",
                "snake_rainbow",
                "snake_spin_rainbow",
            ]
        );
        // All the rest are strict, and none of them uses the backend level.
        for recipe in timeline_visualizers()
            .iter()
            .chain(timeline_progresses().iter())
        {
            let determinism = match &recipe.body {
                CatalogueBody::Visualizer(body) => body.determinism,
                CatalogueBody::Progress(body) => body.determinism,
                CatalogueBody::Shape(_)
                | CatalogueBody::Sticker(_)
                | CatalogueBody::Confetti(_) => unreachable!(),
            };
            assert_ne!(determinism, Determinism::Backend, "{}", recipe.id);
        }
    }

    /// Algorithm names are a closed set, aligned one by one to the recipe column of design §7.3 / §7.4.
    #[test]
    fn every_recipe_declares_one_of_the_closed_algorithm_names() {
        let expect: &[(&str, RecipeAlgorithm)] = &[
            ("bars", RecipeAlgorithm::SpectrumBarsV1),
            ("bars_rounded", RecipeAlgorithm::SpectrumBarsV1),
            ("bars_bottom", RecipeAlgorithm::SpectrumBarsV1),
            ("ring_bars", RecipeAlgorithm::PolarBarsV1),
            ("oscilloscope", RecipeAlgorithm::OscilloscopeV1),
            ("ring_wave", RecipeAlgorithm::OscilloscopeV1),
            ("spectrum_area", RecipeAlgorithm::SpectrumAreaV1),
            ("dots", RecipeAlgorithm::DotMatrixV1),
            ("pulse_rings", RecipeAlgorithm::PulseRingsV1),
            ("ribbons", RecipeAlgorithm::RibbonsV1),
        ];
        assert_eq!(expect.len(), timeline_visualizers().len());
        for (id, algorithm) in expect {
            let recipe = timeline_visualizer(id).unwrap().recipe().unwrap();
            assert_eq!(recipe.algorithm, *algorithm, "{id}");
        }
        let progress_expect: &[(&str, RecipeAlgorithm)] = &[
            ("normal", RecipeAlgorithm::BarV1),
            ("rounded", RecipeAlgorithm::BarV1),
            ("border", RecipeAlgorithm::FrameV1),
            ("reverse_border", RecipeAlgorithm::FrameV1),
            ("rainbow_border", RecipeAlgorithm::FrameV1),
            ("reverse_rainbow_border", RecipeAlgorithm::FrameV1),
            ("strobe_border", RecipeAlgorithm::FrameV1),
            ("reverse_strobe_border", RecipeAlgorithm::FrameV1),
            ("circle", RecipeAlgorithm::RingV1),
            ("donut", RecipeAlgorithm::RingV1),
            ("snake", RecipeAlgorithm::SnakeV1),
            ("snake_spin", RecipeAlgorithm::SnakeV1),
            ("snake_rainbow", RecipeAlgorithm::SnakeV1),
            ("snake_spin_rainbow", RecipeAlgorithm::SnakeV1),
        ];
        for (id, algorithm) in progress_expect {
            let recipe = timeline_progress(id).unwrap().recipe().unwrap();
            assert_eq!(recipe.algorithm, *algorithm, "{id}");
        }
        // Rainbow and strobe variants do not coin new algorithm names. They are the `colorMode` parameter of frame-v1 / snake-v1 (design §7.4 note).
        assert_eq!(
            timeline_progress("rainbow_border")
                .unwrap()
                .recipe()
                .unwrap()
                .object("colorMode")
                .unwrap()
                .get("kind")
                .unwrap(),
            "rainbow"
        );
        assert_eq!(
            timeline_progress("strobe_border")
                .unwrap()
                .recipe()
                .unwrap()
                .object("colorMode")
                .unwrap()
                .get("kind")
                .unwrap(),
            "strobe"
        );
        assert!(
            timeline_progress("snake_spin_rainbow")
                .unwrap()
                .recipe()
                .unwrap()
                .object("spin")
                .is_some()
        );
        assert!(
            timeline_progress("snake_rainbow")
                .unwrap()
                .recipe()
                .unwrap()
                .object("spin")
                .is_none(),
            "a non-spin variant writes null, so reading it back must give None"
        );
    }

    /// The three bar styles share `spectrum-bars-v1` and differ only in parameters (the six formations + static +
    /// trio_wave of the old catalogue were merged precisely by these degrees of freedom). The Rust core carries no numbers at all.
    #[test]
    fn the_spectrum_bars_parameters_are_the_only_thing_separating_the_three_bar_styles() {
        // (id, barCount, align, gap, radius, minHeight, easing)
        let expect: &[(&str, u64, &str, f64, f64, f64, &str)] = &[
            ("bars", 48, "mirror", 0.35, 0.0, 0.02, "easeOutQuad"),
            ("bars_rounded", 32, "mirror", 0.45, 1.0, 0.06, "easeOutQuad"),
            ("bars_bottom", 64, "bottom", 0.25, 0.0, 0.02, "easeOutQuad"),
        ];
        for (id, bar_count, align, gap, radius, min_height, easing) in expect {
            let recipe = timeline_visualizer(id).unwrap().recipe().unwrap();
            assert_eq!(recipe.integer("barCount"), Some(*bar_count), "{id}");
            assert_eq!(recipe.text("align"), Some(*align), "{id}");
            assert_eq!(recipe.number("gap"), Some(*gap), "{id}");
            assert_eq!(recipe.number("radius"), Some(*radius), "{id}");
            assert_eq!(recipe.number("minHeight"), Some(*min_height), "{id}");
            assert_eq!(recipe.text("easing"), Some(*easing), "{id}");
        }
        // The two time-domain waveforms likewise differ only in `layout` and radius.
        let linear = timeline_visualizer("oscilloscope")
            .unwrap()
            .recipe()
            .unwrap();
        let polar = timeline_visualizer("ring_wave").unwrap().recipe().unwrap();
        assert_eq!(linear.text("layout"), Some("linear"));
        assert_eq!(polar.text("layout"), Some("polar"));
        assert_eq!(linear.number("baseRadius"), Some(0.0));
        assert_eq!(polar.number("baseRadius"), Some(0.6));
        assert_eq!(linear.integer("samples"), polar.integer("samples"));
    }

    /// Only `ribbons` reads the clock (`speed` / `cycles`). The other nine are pure spectrum or time-domain functions:
    /// the same frame data draws the same picture at any moment (`tests/visualizer_draw.rs` relies on this to freeze the golden).
    #[test]
    fn only_the_ribbons_recipe_reads_the_clock() {
        for recipe in timeline_visualizers() {
            let params = recipe.recipe().unwrap();
            let reads_clock = params.number("speed").is_some();
            assert_eq!(reads_clock, recipe.id == "ribbons", "{}", recipe.id);
        }
        let ribbons = timeline_visualizer("ribbons").unwrap().recipe().unwrap();
        assert_eq!(ribbons.integer("ribbonCount"), Some(3));
        assert_eq!(ribbons.number("cycles"), Some(2.5));
    }

    /// The `(id, version)` + `manifest_hash` freeze discipline covers the 24 catalogue recipes (10 sound waves + 14 progress).
    #[test]
    fn the_catalogue_manifest_hashes_are_the_content_hashes_of_the_source_files() {
        for (file, source) in VISUALIZER_SOURCES {
            let recipe = timeline_visualizer(file).unwrap();
            assert_eq!(recipe.manifest_hash, fnv1a64(source.as_bytes()), "{file}");
        }
        for (file, source) in PROGRESS_SOURCES {
            let recipe = timeline_progress(file).unwrap();
            assert_eq!(recipe.manifest_hash, fnv1a64(source.as_bytes()), "{file}");
        }
        // The 24 are mutually distinct, so even same-named entries in different catalogues will not collide.
        let mut hashes: Vec<u64> = timeline_visualizers()
            .iter()
            .chain(timeline_progresses().iter())
            .map(|recipe| recipe.manifest_hash)
            .collect();
        hashes.sort_unstable();
        let total = hashes.len();
        hashes.dedup();
        assert_eq!(hashes.len(), total);
        assert_eq!(total, 24);
    }

    /// Unknown algorithm names, algorithm names from another family, missing parameters, out-of-range values, bad colors, and bad dB windows
    /// all report `manifest-invalid` at **registry parse time**, rather than panicking on the first draw.
    #[test]
    fn a_catalogue_recipe_that_lies_about_itself_is_rejected_at_parse_time() {
        use catalogue::parse_catalogue;
        let good = serde_json::json!({
            "id": "bars", "version": 1, "domain": "visualizer", "namespace": "timeline",
            "order": 0, "numColors": 1, "colorLabels": ["Bars"],
            "defaultMainColor": "#3CADFF", "defaultSecondaryColor": "#FFFFFF",
            "defaultMinDb": -80.0, "defaultMaxDb": 40.0, "hasControl": true,
            "binWidth": "64", "aspect": "free", "determinism": "strict",
            "shader": null, "available": true,
            "recipe": {"algorithm": "spectrum-bars-v1", "params": {
                "barCount": 48, "align": "mirror", "gap": 0.35, "radius": 0.0,
                "minHeight": 0.02, "easing": "easeOutQuad"}}
        });
        assert!(parse_catalogue(CatalogueKind::Visualizer, "bars", &good, 0).is_ok());

        let mutations: &[(&str, fn(&mut Value))] = &[
            ("unknown algorithm name", |doc| {
                doc["recipe"]["algorithm"] = serde_json::json!("bars-v1")
            }),
            ("algorithm name from another family", |doc| {
                doc["recipe"]["algorithm"] = serde_json::json!("snake-v1")
            }),
            ("missing required parameter", |doc| {
                doc["recipe"]["params"]
                    .as_object_mut()
                    .unwrap()
                    .remove("gap");
            }),
            ("barCount not a positive integer", |doc| {
                doc["recipe"]["params"]["barCount"] = serde_json::json!(0)
            }),
            ("minHeight out of range", |doc| {
                doc["recipe"]["params"]["minHeight"] = serde_json::json!(1.5)
            }),
            ("gap out of range", |doc| {
                doc["recipe"]["params"]["gap"] = serde_json::json!(-0.1)
            }),
            ("easing not in the closed set", |doc| {
                doc["recipe"]["params"]["easing"] = serde_json::json!("easeInBounce")
            }),
            ("align not in the closed set", |doc| {
                doc["recipe"]["params"]["align"] = serde_json::json!("top")
            }),
            ("colorLabels mismatched with numColors", |doc| {
                doc["colorLabels"] = serde_json::json!([])
            }),
            ("numColors out of range", |doc| {
                doc["numColors"] = serde_json::json!(3)
            }),
            ("bad color", |doc| {
                doc["defaultMainColor"] = serde_json::json!("purple")
            }),
            ("dB window reversed", |doc| {
                doc["defaultMinDb"] = serde_json::json!(40.0)
            }),
            ("unknown binWidth", |doc| {
                doc["binWidth"] = serde_json::json!("128")
            }),
            ("unknown determinism", |doc| {
                doc["determinism"] = serde_json::json!("eventual")
            }),
            ("sound-wave recipe does not accept shader", |doc| {
                doc["shader"] = serde_json::json!("bars.wgsl")
            }),
        ];
        for (label, mutate) in mutations {
            let mut doc = good.clone();
            mutate(&mut doc);
            assert!(
                matches!(
                    parse_catalogue(CatalogueKind::Visualizer, "bars", &doc, 0),
                    Err(MotionError::ManifestInvalid(_))
                ),
                "{label} should fail with manifest-invalid at parse time"
            );
        }
    }

    /// Sampling density and clock parameters of curve families are also checked at parse time: `samples` must be at least 2,
    /// and `speed` / `cycles` / `amplitude` must be positive numbers.
    #[test]
    fn the_curve_recipes_reject_degenerate_densities_and_clocks() {
        use catalogue::parse_catalogue;
        let source = |id: &str| -> Value {
            serde_json::from_str(
                VISUALIZER_SOURCES
                    .iter()
                    .find(|(file, _)| *file == id)
                    .unwrap()
                    .1,
            )
            .unwrap()
        };
        let mut ribbons = source("ribbons");
        assert!(parse_catalogue(CatalogueKind::Visualizer, "ribbons", &ribbons, 0).is_ok());
        ribbons["recipe"]["params"]["samples"] = serde_json::json!(1);
        assert!(matches!(
            parse_catalogue(CatalogueKind::Visualizer, "ribbons", &ribbons, 0),
            Err(MotionError::ManifestInvalid(_))
        ));
        let mut ribbons = source("ribbons");
        ribbons["recipe"]["params"]["speed"] = serde_json::json!(0.0);
        assert!(matches!(
            parse_catalogue(CatalogueKind::Visualizer, "ribbons", &ribbons, 0),
            Err(MotionError::ManifestInvalid(_))
        ));
        let mut scope = source("oscilloscope");
        scope["recipe"]["params"]["layout"] = serde_json::json!("spiral");
        assert!(matches!(
            parse_catalogue(CatalogueKind::Visualizer, "oscilloscope", &scope, 0),
            Err(MotionError::ManifestInvalid(_))
        ));
        let mut scope = source("oscilloscope");
        scope["recipe"]["params"]["amplitude"] = serde_json::json!(-1.0);
        assert!(matches!(
            parse_catalogue(CatalogueKind::Visualizer, "oscilloscope", &scope, 0),
            Err(MotionError::ManifestInvalid(_))
        ));
    }

    #[test]
    fn canonical_families_stay_inside_the_budget() {
        let families = families();
        assert!(
            families.len() <= CANONICAL_FAMILY_BUDGET,
            "{families:?} exceeds the budget of {CANONICAL_FAMILY_BUDGET} canonical families (design §5.4.3)"
        );
        assert_eq!(
            families,
            vec![
                "backIn",
                "blurIn",
                "drift",
                "elasticIn",
                "fadeIn",
                "flash",
                "moveIn",
                "pulse",
                "rollIn",
                "rotateIn",
                "scaleIn",
                "shake",
                "tilt",
            ]
        );
    }

    #[test]
    fn part_families_have_their_own_budget() {
        let families = part_families();
        assert!(
            families.len() <= PART_FAMILY_BUDGET,
            "{families:?} exceeds the budget of {PART_FAMILY_BUDGET} part families (spec §7.9)"
        );
        assert_eq!(
            families,
            vec![
                "karaokeScale",
                "riseParts",
                "seededJitter",
                "typewriter",
                "wipeParts",
            ]
        );
        // Part families do not occupy the element budget, and vice versa
        for family in &families {
            assert!(!super::families().contains(family), "{family}");
        }
        assert_eq!(applies_to("motion.riseParts"), Some(AppliesTo::Part));
        assert_eq!(applies_to("motion.moveIn"), Some(AppliesTo::Element));
        assert_eq!(applies_to("typeIn"), Some(AppliesTo::Part));
    }

    /// The real form of `shake` / `drift` / `seededJitter` is `oscillate` / `noise` ops
    /// (phase 2 deferred them to here because the graph was not yet implemented; §15 phase 2 deviation 5).
    #[test]
    fn the_op_bodied_recipes_expand_to_keyframes() {
        for id in ["motion.shake", "motion.drift", "motion.seededJitter"] {
            let entry = manifest(id).unwrap();
            assert!(matches!(entry.body, PresetBody::Ops(_)), "{id}");
            let out = expand(id, None, &Map::new(), &ExpandCtx::with_dur(1.0)).unwrap();
            assert_eq!(out.tracks.len(), 2, "{id}");
            for track in &out.tracks {
                assert!(track.frames.len() > 4, "{id}: {:?}", track.prop);
                // Relative length raw text is preserved and evaluated only after layout
                assert!(
                    track.frames.iter().all(|f| f.v.get("basis").is_some()),
                    "{id}"
                );
            }
        }
        // Same seed, same output
        let a = expand("motion.shake", None, &Map::new(), &ExpandCtx::with_dur(1.0)).unwrap();
        let b = expand("motion.shake", None, &Map::new(), &ExpandCtx::with_dur(1.0)).unwrap();
        assert_eq!(a.tracks, b.tracks);
    }

    #[test]
    fn aliases_map_the_appendix_b_vocabulary_to_canonical_ids() {
        for (alias, canonical) in [
            ("rise", "motion.moveIn"),
            ("slideIn", "motion.moveIn"),
            ("slideOut", "motion.moveOut"),
            ("scaleIn", "motion.scaleIn"),
            ("scaleOut", "motion.scaleOut"),
            ("springPop", "motion.backIn"),
            ("pop", "motion.pulse"),
            ("pulse", "motion.pulse"),
            ("flash", "motion.flash"),
            ("tiltNudge", "motion.tilt"),
        ] {
            assert_eq!(canonical_id(alias), canonical, "{alias}");
            assert_eq!(
                family_of(alias),
                manifest(canonical).unwrap().family.as_deref()
            );
        }
        // The frozen bcf recipe names are not taken over by an alias
        assert_eq!(canonical_id("fadeIn"), "fadeIn");
        assert!(bcf_preset("fadeIn").is_some());
    }

    #[test]
    fn the_new_families_are_not_exposed_to_the_timeline_or_the_mac_stage() {
        for id in manifest_ids() {
            let entry = manifest(id).unwrap();
            assert_eq!(
                entry.exposed_to,
                vec![Surface::Bcf],
                "{id}: new families are only open to BCF (ADR-M09 / design §10 phase 2)"
            );
            assert_eq!(entry.determinism, Determinism::Strict, "{id}");
            assert_eq!(entry.version, 1, "{id}");
        }
    }

    #[test]
    fn internal_building_blocks_carry_no_family() {
        for id in [
            "motion.shiftIn",
            "motion.shiftOut",
            "motion.zoomIn",
            "motion.zoomOut",
            "motion.spinIn",
            "motion.spinOut",
            "motion.blurFrom",
            "motion.blurTo",
        ] {
            assert!(manifest(id).unwrap().family.is_none(), "{id}");
        }
    }
}
