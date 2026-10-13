//! Catalogue recipe (ADR-E05) — the **third** recipe shape in the registry.
//!
//! It sits alongside the two existing shapes:
//!
//! - [`super::frozen`]: the four dedicated parse paths frozen in phase 1;
//! - [`super::manifest`]: the general animation manifest (`tracks` or `compose`);
//! - **this module**: `core/presets/builtin/{shape,sticker,visualizer,progress,confetti}/*.json`.
//!
//! **Why not reuse `parse_manifest`**: it has three hard constraints that do not hold at all for catalogue recipes:
//! `domain` must be in the closed set `ManifestDomain{Motion,Transition,Filter}`;
//! `determinism` is required (the shape recipe has no such concept, since direct vector output is always strict);
//! and exactly one of `tracks` or `compose` must be present. A catalogue recipe describes “how to draw one frame”,
//! not “how a property changes over time”, so forcing it in would only work by inventing a fake empty `tracks`.
//!
//! What is reused is the **discipline**, not the parser: the `builtin!` + `include_str!` manifest list, a one-time `build()` behind `OnceLock`,
//! freezing by `(id, version)` + `manifest_hash`, catalogue consistency guarded by `tests/manifests.rs`, and `available` as the switch for rolling out in waves.
//!
//! **Dispatch relies on manifest ownership, not on the JSON `domain` field**, consistent with the frozen path. The JSON still
//! writes `domain`, purely as self-description for human readers; parse time only does a one-time equality check.

use serde_json::{Map, Value};

use crate::MotionError;

use super::json::{field, number, text, version};
use super::manifest::Determinism;

/// The kinds of catalogue recipe. P0 lands [`CatalogueKind::Shape`], P2 adds visualizer /
/// progress, P7b adds [`CatalogueKind::Sticker`], and the confetti design draft (§4) adds
/// [`CatalogueKind::Confetti`]. The skeleton was already parameterized from the start, so all five kinds share the same
/// `parse_catalogue` entry point, each adding only one body parser.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum CatalogueKind {
    Shape,
    Sticker,
    Visualizer,
    Progress,
    Confetti,
}

impl CatalogueKind {
    /// The self-describing value of the JSON `domain` field, which is also the directory name under `core/presets/builtin/`.
    pub const fn dir(self) -> &'static str {
        match self {
            Self::Shape => "shape",
            Self::Sticker => "sticker",
            Self::Visualizer => "visualizer",
            Self::Progress => "progress",
            Self::Confetti => "confetti",
        }
    }
}

/// Shape outline: a definition **normalized to the element box 0..1** (origin at top-left).
///
/// A closed set. An unknown `kind` reports `manifest-invalid` at **registry parse time** (a build-time error
/// that users' documents never encounter). “`timeline.json` references a shape name that is not in the registry” is a different
/// moment with a different code (`preset-unknown`, at lint / resolve time); see design §5.3.
#[derive(Clone, Debug, PartialEq)]
pub enum ShapePath {
    /// The element box itself; `ShapeProps.cornerRadius` applies.
    Rect,
    /// The ellipse inscribed in the element box.
    Ellipse,
    /// The `x1,y1 → x2,y2` line segment of `ShapeProps`; `defaultHead` is the default end cap.
    Segment { default_head: ShapeHead },
    /// Explicit outline: the 19 shapes of P7 take this path; all points lie within 0..1.
    Outline { segments: Vec<PathSegment> },
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ShapeHead {
    None,
    Arrow,
}

impl ShapeHead {
    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "none" => Some(Self::None),
            "arrow" => Some(Self::Arrow),
            _ => None,
        }
    }
}

/// An outline segment. Each verb corresponds one-to-one with its point count, validated at parse time, so consumers need not guard against it.
#[derive(Clone, Debug, PartialEq)]
pub enum PathSegment {
    Move([f64; 2]),
    Line([f64; 2]),
    Quad([f64; 2], [f64; 2]),
    Cubic([f64; 2], [f64; 2], [f64; 2]),
    Close,
}

/// The adjustable options this shape supports (a closed set). The property panel uses it to decide which controls to show,
/// and the renderer uses it to decide whether to read a given `ShapeProps` field.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ShapeParam {
    Fill,
    Stroke,
    StrokeWidth,
    CornerRadius,
    /// `x1/y1/x2/y2`。
    Endpoints,
    Head,
}

impl ShapeParam {
    fn parse(value: &str) -> Option<Self> {
        match value {
            "fill" => Some(Self::Fill),
            "stroke" => Some(Self::Stroke),
            "strokeWidth" => Some(Self::StrokeWidth),
            "cornerRadius" => Some(Self::CornerRadius),
            "endpoints" => Some(Self::Endpoints),
            "head" => Some(Self::Head),
            _ => None,
        }
    }
}

/// One catalogue recipe.
///
/// `id` is the **document-facing value**: whatever `shape.shape` is set to in `timeline.json` is what it is here
/// (`rect` / `ellipse` / `line` / `arrow`), the same convention as the frozen path's `bcf.cut.json →
/// id "cut"`. The file name and the id are the same, so the directory consistency test is a character-for-character comparison.
#[derive(Clone, Debug, PartialEq)]
pub struct CatalogueRecipe {
    pub id: String,
    pub version: u32,
    pub kind: CatalogueKind,
    pub order: usize,
    pub body: CatalogueBody,
    /// The **surface-catalogue** switch, with the same meaning as `SlotRecipe.available`: whether it can be selected in the panel.
    /// It does not use the general manifest's `exposedTo` + `Surface`: catalogue recipes serve only timeline elements,
    /// `namespace` is always `"timeline"`, so there is no multi-surface exposure dimension.
    pub available: bool,
    pub manifest_hash: u64,
}

impl CatalogueRecipe {
    /// The qualified name with the `Domain.dir` prefix (`shape.rect`), for reference by the UI and documents.
    pub fn qualified_id(&self) -> String {
        format!("{}.{}", self.kind.dir(), self.id)
    }

    pub fn shape(&self) -> Option<&ShapeBody> {
        match &self.body {
            CatalogueBody::Shape(body) => Some(body),
            _ => None,
        }
    }

    pub fn sticker(&self) -> Option<&StickerBody> {
        match &self.body {
            CatalogueBody::Sticker(body) => Some(body),
            _ => None,
        }
    }

    pub fn visualizer(&self) -> Option<&VisualizerBody> {
        match &self.body {
            CatalogueBody::Visualizer(body) => Some(body),
            _ => None,
        }
    }

    pub fn progress(&self) -> Option<&ProgressBody> {
        match &self.body {
            CatalogueBody::Progress(body) => Some(body),
            _ => None,
        }
    }

    pub fn confetti(&self) -> Option<&ConfettiBody> {
        match &self.body {
            CatalogueBody::Confetti(body) => Some(body),
            _ => None,
        }
    }

    /// Drawing recipe (present for visualizer / progress / confetti, absent for shape / sticker,
    /// since direct vector output needs no algorithm name).
    pub fn recipe(&self) -> Option<&Recipe> {
        match &self.body {
            CatalogueBody::Shape(_) | CatalogueBody::Sticker(_) => None,
            CatalogueBody::Visualizer(body) => Some(&body.recipe),
            CatalogueBody::Progress(body) => Some(&body.recipe),
            CatalogueBody::Confetti(body) => Some(&body.recipe),
        }
    }
}

/// The recipe body for each kind.
#[derive(Clone, Debug, PartialEq)]
pub enum CatalogueBody {
    Shape(ShapeBody),
    Sticker(StickerBody),
    Visualizer(VisualizerBody),
    Progress(ProgressBody),
    Confetti(ConfettiBody),
}

#[derive(Clone, Debug, PartialEq)]
pub struct ShapeBody {
    pub path: ShapePath,
    pub params: Vec<ShapeParam>,
}

impl ShapeBody {
    pub fn supports(&self, param: ShapeParam) -> bool {
        self.params.contains(&param)
    }
}

// ── Sticker recipe body (the template source for design §10 P7) ─────────────────────

/// Template sticker: **a stack of outline layers that carry their own colors**, drawn bottom to top in declaration order.
///
/// Two essential differences from [`ShapeBody`] (which is also why it is not “a shape with a few more params”):
///
/// 1. **Colors live in the recipe, not in the props.** `StickerProps` (design §5.2) has only
///    `source` / `templateId` / `path` / `loop`, with no `fill` / `stroke`:
///    a sticker is a **finished picture**, not an adjustable colored primitive. The palette is therefore part of the template;
///    changing the color means swapping the template, not editing an element property.
/// 2. **Multiple layers, multiple colors.** One template can be “a green base + a white check mark” in two layers, which a shape's single fill + single
///    stroke cannot express.
///
/// **Geometry is always a unit square (0..1, origin at top-left, y pointing down).** The element box of a template sticker follows the
/// “square” default of the sticker branch in `element_height` (`geometry.rs`), so the recipe
/// neither needs nor is allowed to declare an aspect ratio: for a non-square look, draw the margin into the viewBox.
/// This constraint means P7b does not have to touch the geometry default table or the three-platform mirror implementations of `ccut-timeline` at all.
#[derive(Clone, Debug, PartialEq)]
pub struct StickerBody {
    pub layers: Vec<StickerLayer>,
}

/// One outline layer plus its own colors. At least one of `fill` / `stroke` is required (validated at parse time).
#[derive(Clone, Debug, PartialEq)]
pub struct StickerLayer {
    pub segments: Vec<PathSegment>,
    /// `#RRGGBB[AA]`。
    pub fill: Option<String>,
    pub stroke: Option<String>,
    /// **A ratio of the element box's short edge** (0..1), not pixels on a reference short edge of 540.
    ///
    /// Its basis is **deliberately different** from `ShapeProps.stroke_width`: a shape's stroke width is a user
    /// property that follows the canvas, so it does not turn into a hairline at 4K; a sticker's stroke is **part of the picture**
    /// and must scale with the sticker itself. Otherwise, doubling the size of the same sticker would leave the outline thickness unchanged and ruin the proportions.
    pub stroke_width: f64,
}

/// `strokeWidth` default: 3% of the element box's short edge.
pub const STICKER_DEFAULT_STROKE_WIDTH: f64 = 0.03;

// ── Visualizer / progress recipe bodies (design §7.2) ─────────────────────────

/// Bin width of the audio texture. `Half` = `fftSize/2` (the four full-bin bicubic kinds).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum BinWidth {
    /// Takes only the lowest 64 bins; 11 of the 15 kinds use this.
    Fixed64,
    Half,
}

impl BinWidth {
    fn parse(value: &str) -> Option<Self> {
        match value {
            "64" => Some(Self::Fixed64),
            "half" => Some(Self::Half),
            _ => None,
        }
    }

    pub const fn name(self) -> &'static str {
        match self {
            Self::Fixed64 => "64",
            Self::Half => "half",
        }
    }
}

/// The default box shape for visualizer elements (the frame-percentage table in ADR-E01).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum VisualizerAspect {
    Free,
    /// Forced square (`ring_bars` / `ring_wave` / `pulse_rings` / progress `circle` / `donut`).
    Square,
}

impl VisualizerAspect {
    fn parse(value: &str) -> Option<Self> {
        match value {
            "free" => Some(Self::Free),
            "square" => Some(Self::Square),
            _ => None,
        }
    }
}

/// The default box shape for progress elements. The `Frame` kinds follow the canvas aspect and fill the frame.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ProgressAspect {
    Bar,
    Square,
    Frame,
}

impl ProgressAspect {
    fn parse(value: &str) -> Option<Self> {
        match value {
            "bar" => Some(Self::Bar),
            "square" => Some(Self::Square),
            "frame" => Some(Self::Frame),
            _ => None,
        }
    }
}

#[derive(Clone, Debug, PartialEq)]
pub struct VisualizerBody {
    pub num_colors: u8,
    pub color_labels: Vec<String>,
    pub default_main_color: String,
    pub default_secondary_color: String,
    pub default_min_db: f64,
    pub default_max_db: f64,
    /// `false` = the property panel has no dB control (`beam`).
    pub has_control: bool,
    pub bin_width: BinWidth,
    pub aspect: VisualizerAspect,
    pub recipe: Recipe,
    pub determinism: Determinism,
    /// All 10 sound-wave styles are CPU vector recipes, so `shader` must be written as `null` in the manifest
    /// (the visualizer WGSL list in design §8.6 has been retired as a whole); the field is kept as an
    /// `Option` only to leave room for future GPU recipes.
    pub shader: Option<String>,
}

#[derive(Clone, Debug, PartialEq)]
pub struct ProgressBody {
    pub num_colors: u8,
    /// The title of each palette (one each for the primary and secondary colors).
    ///
    /// Same basis as [`VisualizerBody::color_labels`]: the count always equals `num_colors`,
    /// so “rainbow border, whole-run colors not emitted” (0) and “roaming rainbow emits only one Background” (1)
    /// are both expressed by these two fields together, and the panel does not hard-code style names.
    pub color_labels: Vec<String>,
    pub default_main_color: String,
    pub default_secondary_color: String,
    pub aspect: ProgressAspect,
    pub recipe: Recipe,
    pub determinism: Determinism,
    pub shader: String,
}

// ── Confetti recipe body (`docs/design/elements/ccut-confetti-element-design.md` §4) ────────

/// The closed set of values for `confetti.shapes`: 12 unit shapes, the same table as `ccut-timeline`'s
/// `CONFETTI_SHAPES` (that side guards the documentation, this side guards the recipe; both report errors at parse time).
pub const CONFETTI_SHAPES: &[&str] = &[
    "rect", "strip", "circle", "ellipse", "triangle", "diamond", "star", "starlet", "sparkle",
    "heart", "petal", "ribbon",
];

/// One confetti style = **palette + shape mix + a `confetti-v1` parameter bundle**.
///
/// Two differences from [`ProgressBody`]: the colors are a **list** rather than a primary/secondary pair
/// (when `ConfettiProps.colors` is absent the whole table applies; when written, it replaces the whole table); and there is no shader.
/// All ten styles emit `FillPath` from the CPU closed-form motion kernel, and the GPU side uses `SceneNode::Vectors`
/// to reuse the same paths, so `determinism` is always `strict`. Geometry is always `aspect: "frame"`
/// (fills the frame), and the recipe declares no other box shape.
#[derive(Clone, Debug, PartialEq)]
pub struct ConfettiBody {
    /// `#RRGGBB[AA]` × 1–8, in catalogue order.
    pub palette: Vec<String>,
    /// A non-empty subset of [`CONFETTI_SHAPES`].
    pub shapes: Vec<String>,
    /// Adaptation source (the id in `core/assets/elements/vendor/sources.json`); used only for the attribution and
    /// license list, and the renderer does not read it.
    pub sources: Vec<String>,
    /// Whether the property page shows the “origin” toggle (design draft §6.2): multi-emitter / directional burst styles
    /// are `true`; continuous styles scattered from the top are `false` (a custom origin is meaningless for them).
    pub has_emitter_control: bool,
    pub recipe: Recipe,
    pub determinism: Determinism,
}

/// Drawing recipe = **closed algorithm name + parameter bundle**.
///
/// The parameters are kept verbatim as a JSON object: the Rust side holds only the algorithm implementations, and **carries not a single number** (the same discipline as phase 1's
/// `loop_kernel`). The P3/P4/P5 drawing kernels read values item by item with [`Recipe::number`] /
/// [`Recipe::integer`] / [`Recipe::flag`] / [`Recipe::text`] / [`Recipe::object`] /
/// [`Recipe::array`]; parse time has already guaranteed that required items are present and within the legal domain, so the reading side need not guard again.
#[derive(Clone, Debug, PartialEq)]
pub struct Recipe {
    pub algorithm: RecipeAlgorithm,
    pub params: Map<String, Value>,
}

impl Recipe {
    pub fn get(&self, key: &str) -> Option<&Value> {
        self.params.get(key)
    }

    /// Both `null` and a missing key return `None`: in a recipe, `null` means “this tier is not enabled”
    /// (`shaping: null`, `spin: null`, `echoLayers: null`).
    fn present<'a>(&'a self, key: &str) -> Option<&'a Value> {
        match self.params.get(key) {
            None | Some(Value::Null) => None,
            Some(value) => Some(value),
        }
    }

    pub fn number(&self, key: &str) -> Option<f64> {
        self.present(key)?.as_f64()
    }

    pub fn integer(&self, key: &str) -> Option<u64> {
        self.present(key)?.as_u64()
    }

    pub fn flag(&self, key: &str) -> Option<bool> {
        self.present(key)?.as_bool()
    }

    pub fn text(&self, key: &str) -> Option<&str> {
        self.present(key)?.as_str()
    }

    pub fn object(&self, key: &str) -> Option<&Map<String, Value>> {
        self.present(key)?.as_object()
    }

    pub fn array(&self, key: &str) -> Option<&Vec<Value>> {
        self.present(key)?.as_array()
    }
}

/// Closed algorithm names (the two tables in design §7.2 / §7.4). An unknown name reports
/// `manifest-invalid` at **registry parse time**. It is a different moment and a different code from `preset-unknown`, which is for “a document references a style id that does not exist”
/// (design §5.3).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum RecipeAlgorithm {
    // Visualizer (design §7.2)
    SpectrumBarsV1,
    PolarBarsV1,
    OscilloscopeV1,
    SpectrumAreaV1,
    DotMatrixV1,
    PulseRingsV1,
    RibbonsV1,
    // progress
    BarV1,
    FrameV1,
    RingV1,
    SnakeV1,
    // confetti（`docs/design/elements/ccut-confetti-element-design.md` §4.3）
    ConfettiV1,
}

impl RecipeAlgorithm {
    pub const fn name(self) -> &'static str {
        match self {
            Self::SpectrumBarsV1 => "spectrum-bars-v1",
            Self::PolarBarsV1 => "polar-bars-v1",
            Self::OscilloscopeV1 => "oscilloscope-v1",
            Self::SpectrumAreaV1 => "spectrum-area-v1",
            Self::DotMatrixV1 => "dot-matrix-v1",
            Self::PulseRingsV1 => "pulse-rings-v1",
            Self::RibbonsV1 => "ribbons-v1",
            Self::BarV1 => "bar-v1",
            Self::FrameV1 => "frame-v1",
            Self::RingV1 => "ring-v1",
            Self::SnakeV1 => "snake-v1",
            Self::ConfettiV1 => "confetti-v1",
        }
    }

    /// Which catalogue this algorithm belongs to, to prevent a visualizer algorithm name from being written into a progress recipe.
    const fn kind(self) -> CatalogueKind {
        match self {
            Self::BarV1 | Self::FrameV1 | Self::RingV1 | Self::SnakeV1 => CatalogueKind::Progress,
            Self::ConfettiV1 => CatalogueKind::Confetti,
            _ => CatalogueKind::Visualizer,
        }
    }

    /// Required parameter keys. Missing even one reports `manifest-invalid` at parse time.
    const fn required(self) -> &'static [&'static str] {
        match self {
            Self::SpectrumBarsV1 => &["barCount", "align", "gap", "radius", "minHeight", "easing"],
            Self::PolarBarsV1 => &["barCount", "innerRadius", "gap", "minHeight", "easing"],
            Self::OscilloscopeV1 => &["layout", "samples", "lineWidth", "amplitude", "baseRadius"],
            Self::SpectrumAreaV1 => &["samples", "minHeight", "easing", "lineWidth"],
            Self::DotMatrixV1 => &["columns", "rows", "dotRadius", "easing"],
            Self::PulseRingsV1 => &["bands", "coreRadius", "ringRadius", "ringWidth", "easing"],
            Self::RibbonsV1 => &["ribbonCount", "samples", "lineWidth", "speed", "cycles"],
            Self::BarV1 => &["direction", "corner"],
            Self::FrameV1 => &["borderSize", "smoothing", "fill", "background", "colorMode"],
            Self::RingV1 => &[
                "featherPx",
                "edgeFeatherPx",
                "innerRadius",
                "startAngle",
                "direction",
            ],
            Self::SnakeV1 => &[
                "dotRadius",
                "smoothing",
                "orbitRadius",
                "startAngleDeg",
                "angleIncrementDeg",
                "maxIterations",
                "boostSteps",
                "spin",
                "colorMode",
            ],
            Self::ConfettiV1 => &[
                "emit",
                "emitters",
                "angle",
                "spread",
                "speedPx",
                "dragX",
                "dragY",
                "gravityPx",
                "windPx",
                "driftPx",
                "driftHz",
                "sizePx",
                "sizeRamp",
                "spinDps",
                "flipHz",
                "pulse",
                "lifeSec",
                "fadeIn",
                "fadeOut",
                "maxAlive",
            ],
        }
    }

    fn parse(name: &str) -> Option<Self> {
        [
            Self::SpectrumBarsV1,
            Self::PolarBarsV1,
            Self::OscilloscopeV1,
            Self::SpectrumAreaV1,
            Self::DotMatrixV1,
            Self::PulseRingsV1,
            Self::RibbonsV1,
            Self::BarV1,
            Self::FrameV1,
            Self::RingV1,
            Self::SnakeV1,
            Self::ConfettiV1,
        ]
        .into_iter()
        .find(|algorithm| algorithm.name() == name)
    }
}

/// Parameter keys that must be positive integers (common to all algorithms).
const POSITIVE_INT_KEYS: &[&str] = &[
    "barCount",
    "columns",
    "rows",
    "bands",
    "ribbonCount",
    "samples",
    "maxIterations",
    "maxAlive",
];

/// The lower bound of `samples` (the path sampling density of the curve families).
///
/// It is a **frozen recipe constant**: the premise for a curve family to be rated `strict` (the determinism column in design §7.3)
/// is that “each manifest fixes how many points it samples”; if the drawing side changed the density, it would be a different
/// picture. Two points are needed to join into a polyline, and one point cannot, so the lower bound is 2 rather than the 1 of `POSITIVE_INT_KEYS`.
/// This is a geometric fact, not a styling choice.
const MIN_SAMPLES: u64 = 2;

/// Parameter keys that must fall within `[0, 1]` (common to all algorithms).
const UNIT_INTERVAL_KEYS: &[&str] = &[
    "minHeight",
    "innerRadius",
    "gap",
    "radius",
    "lineWidth",
    "baseRadius",
    "coreRadius",
    "ringRadius",
    "ringWidth",
    "dotRadius",
    "orbitRadius",
    "borderSize",
    "smoothing",
];

/// Real-number parameter keys that must be strictly greater than 0 (common to all algorithms).
const POSITIVE_NUMBER_KEYS: &[&str] = &["amplitude", "speed", "cycles"];

/// The closed table of allowed values for top-level string parameters.
const ENUM_KEYS: &[(&str, &[&str])] = &[
    (
        "easing",
        &["none", "easeOutQuad", "easeOutSine", "easeOutCubic"],
    ),
    ("align", &["mirror", "bottom"]),
    ("layout", &["linear", "polar"]),
    ("fill", &["forward", "reverse"]),
    ("direction", &["ltr", "rtl", "cw", "ccw"]),
    ("startAngle", &["top"]),
];

/// The shared parse skeleton for catalogue recipes: a common header + a recipe body for each kind.
pub(crate) fn parse_catalogue(
    kind: CatalogueKind,
    file: &str,
    doc: &Value,
    manifest_hash: u64,
) -> Result<CatalogueRecipe, MotionError> {
    let id = text(file, doc, "id")?.to_owned();
    if id != file {
        return Err(MotionError::ManifestInvalid(format!(
            "{file}: \"id\" must match the file name (got {id:?})"
        )));
    }
    // `domain` / `namespace` are for self-description only; dispatch relies on manifest ownership. The check is done once to block
    // recipes copy-pasted across catalogues.
    let domain = text(file, doc, "domain")?;
    if domain != kind.dir() {
        return Err(MotionError::ManifestInvalid(format!(
            "{file}: \"domain\" should be {:?}, got {domain:?}",
            kind.dir()
        )));
    }
    let namespace = text(file, doc, "namespace")?;
    if namespace != "timeline" {
        return Err(MotionError::ManifestInvalid(format!(
            "{file}: directory recipe \"namespace\" is always \"timeline\", got {namespace:?}"
        )));
    }
    let order = field(file, doc, "order")?
        .as_u64()
        .ok_or_else(|| MotionError::ManifestInvalid(format!("{file}: bad \"order\"")))?
        as usize;
    let available = field(file, doc, "available")?
        .as_bool()
        .ok_or_else(|| MotionError::ManifestInvalid(format!("{file}: bad \"available\"")))?;
    let body = match kind {
        CatalogueKind::Shape => CatalogueBody::Shape(parse_shape_body(file, doc)?),
        CatalogueKind::Sticker => CatalogueBody::Sticker(parse_sticker_body(file, doc)?),
        CatalogueKind::Visualizer => CatalogueBody::Visualizer(parse_visualizer_body(file, doc)?),
        CatalogueKind::Progress => CatalogueBody::Progress(parse_progress_body(file, doc)?),
        CatalogueKind::Confetti => CatalogueBody::Confetti(parse_confetti_body(file, doc)?),
    };
    Ok(CatalogueRecipe {
        id,
        version: version(file, doc)?,
        kind,
        order,
        body,
        available,
        manifest_hash,
    })
}

fn parse_shape_body(file: &str, doc: &Value) -> Result<ShapeBody, MotionError> {
    let path_doc = field(file, doc, "path")?;
    let path = match text(file, path_doc, "kind")? {
        "rect" => ShapePath::Rect,
        "ellipse" => ShapePath::Ellipse,
        "segment" => {
            let head = text(file, path_doc, "defaultHead")?;
            ShapePath::Segment {
                default_head: ShapeHead::parse(head).ok_or_else(|| {
                    MotionError::ManifestInvalid(format!("{file}: unknown head {head:?}"))
                })?,
            }
        }
        "outline" => ShapePath::Outline {
            segments: parse_outline(file, field(file, path_doc, "segments")?)?,
        },
        other => {
            return Err(MotionError::ManifestInvalid(format!(
                "{file}: unknown path kind {other:?}"
            )));
        }
    };
    let params = field(file, doc, "params")?
        .as_array()
        .ok_or_else(|| MotionError::ManifestInvalid(format!("{file}: \"params\" is not an array")))?
        .iter()
        .map(|value| {
            value
                .as_str()
                .and_then(ShapeParam::parse)
                .ok_or_else(|| MotionError::ManifestInvalid(format!("{file}: bad param {value}")))
        })
        .collect::<Result<Vec<_>, _>>()?;
    Ok(ShapeBody { path, params })
}

/// Template sticker: `layers[]`, one outline per layer plus its own colors.
///
/// The four checks are all early detection of “cannot be drawn”: the layer count is non-empty, each layer has at least one color,
/// the outline starts with `move` (reusing [`parse_outline`]), and `strokeWidth` falls within (0, 1]
/// — it is a ratio of the element box's short edge, and a value above 1 means the author wrote it in pixels.
fn parse_sticker_body(file: &str, doc: &Value) -> Result<StickerBody, MotionError> {
    let items = field(file, doc, "layers")?.as_array().ok_or_else(|| {
        MotionError::ManifestInvalid(format!("{file}: \"layers\" is not an array"))
    })?;
    if items.is_empty() {
        return Err(MotionError::ManifestInvalid(format!(
            "{file}: sticker needs at least one layer"
        )));
    }
    let mut layers = Vec::with_capacity(items.len());
    for item in items {
        let fill = optional_color(file, item, "fill")?;
        let stroke = optional_color(file, item, "stroke")?;
        if fill.is_none() && stroke.is_none() {
            return Err(MotionError::ManifestInvalid(format!(
                "{file}: a sticker layer has neither \"fill\" nor \"stroke\", so nothing would be drawn"
            )));
        }
        let stroke_width = match item.get("strokeWidth") {
            None | Some(Value::Null) => STICKER_DEFAULT_STROKE_WIDTH,
            Some(value) => value
                .as_f64()
                .filter(|width| *width > 0.0 && *width <= 1.0)
                .ok_or_else(|| {
                    MotionError::ManifestInvalid(format!(
                        "{file}: \"strokeWidth\" is a ratio of the element box's short side and must be in (0, 1] (got {value})"
                    ))
                })?,
        };
        layers.push(StickerLayer {
            segments: parse_outline(file, field(file, item, "segments")?)?,
            fill,
            stroke,
            stroke_width,
        });
    }
    Ok(StickerBody { layers })
}

/// An optional `#RRGGBB[AA]` field. Absent is the same as `null`; everything else is validated against the format.
fn optional_color(file: &str, doc: &Value, key: &str) -> Result<Option<String>, MotionError> {
    match doc.get(key) {
        None | Some(Value::Null) => Ok(None),
        Some(_) => parse_color(file, doc, key).map(Some),
    }
}

fn parse_outline(file: &str, doc: &Value) -> Result<Vec<PathSegment>, MotionError> {
    let items = doc.as_array().ok_or_else(|| {
        MotionError::ManifestInvalid(format!("{file}: \"segments\" is not an array"))
    })?;
    let mut out = Vec::with_capacity(items.len());
    for item in items {
        let verb = text(file, item, "verb")?;
        let points = match item.get("pts") {
            Some(Value::Array(points)) => points
                .iter()
                .map(|point| {
                    let pair = point.as_array().filter(|pair| pair.len() == 2);
                    let pair = pair.ok_or_else(|| {
                        MotionError::ManifestInvalid(format!("{file}: bad point {point}"))
                    })?;
                    let x = pair[0].as_f64();
                    let y = pair[1].as_f64();
                    match (x, y) {
                        (Some(x), Some(y)) => Ok([x, y]),
                        _ => Err(MotionError::ManifestInvalid(format!(
                            "{file}: bad point {point}"
                        ))),
                    }
                })
                .collect::<Result<Vec<_>, _>>()?,
            None => Vec::new(),
            Some(other) => {
                return Err(MotionError::ManifestInvalid(format!(
                    "{file}: \"pts\" is not an array: {other}"
                )));
            }
        };
        out.push(match (verb, points.len()) {
            ("move", 1) => PathSegment::Move(points[0]),
            ("line", 1) => PathSegment::Line(points[0]),
            ("quad", 2) => PathSegment::Quad(points[0], points[1]),
            ("cubic", 3) => PathSegment::Cubic(points[0], points[1], points[2]),
            ("close", 0) => PathSegment::Close,
            (verb, count) => {
                return Err(MotionError::ManifestInvalid(format!(
                    "{file}: verb {verb:?} does not accept {count} points"
                )));
            }
        });
    }
    if !matches!(out.first(), Some(PathSegment::Move(_))) {
        return Err(MotionError::ManifestInvalid(format!(
            "{file}: outline must start with move"
        )));
    }
    Ok(out)
}

// ── visualizer / progress ────────────────────────────────────────────

fn parse_visualizer_body(file: &str, doc: &Value) -> Result<VisualizerBody, MotionError> {
    let num_colors = parse_num_colors(file, doc)?;
    let labels = parse_color_labels(file, doc, num_colors)?;
    let default_min_db = number(file, doc, "defaultMinDb")?;
    let default_max_db = number(file, doc, "defaultMaxDb")?;
    if !(default_min_db < default_max_db) {
        return Err(MotionError::ManifestInvalid(format!(
            "{file}: dB window must have min < max (got {default_min_db} / {default_max_db})"
        )));
    }
    let bin_width = text(file, doc, "binWidth")?;
    let aspect = text(file, doc, "aspect")?;
    Ok(VisualizerBody {
        num_colors,
        color_labels: labels,
        default_main_color: parse_color(file, doc, "defaultMainColor")?,
        default_secondary_color: parse_color(file, doc, "defaultSecondaryColor")?,
        default_min_db,
        default_max_db,
        has_control: field(file, doc, "hasControl")?
            .as_bool()
            .ok_or_else(|| MotionError::ManifestInvalid(format!("{file}: bad \"hasControl\"")))?,
        bin_width: BinWidth::parse(bin_width).ok_or_else(|| {
            MotionError::ManifestInvalid(format!("{file}: unknown binWidth {bin_width:?}"))
        })?,
        aspect: VisualizerAspect::parse(aspect).ok_or_else(|| {
            MotionError::ManifestInvalid(format!("{file}: unknown aspect {aspect:?}"))
        })?,
        recipe: parse_recipe(file, doc, CatalogueKind::Visualizer)?,
        determinism: parse_determinism(file, doc)?,
        shader: parse_visualizer_shader(file, doc)?,
    })
}

/// All sound-wave recipes run on the CPU vector kernel: `shader` accepts only `null` (or may be omitted). Writing a file name
/// means the manifest and the kernel disagree, so parsing rejects it outright.
fn parse_visualizer_shader(file: &str, doc: &Value) -> Result<Option<String>, MotionError> {
    match doc.get("shader") {
        None | Some(Value::Null) => Ok(None),
        Some(shader) => Err(MotionError::ManifestInvalid(format!(
            "{file}: visualizer recipe has no shader (got {shader})"
        ))),
    }
}

fn parse_progress_body(file: &str, doc: &Value) -> Result<ProgressBody, MotionError> {
    let aspect = text(file, doc, "aspect")?;
    let num_colors = parse_num_colors(file, doc)?;
    Ok(ProgressBody {
        num_colors,
        color_labels: parse_color_labels(file, doc, num_colors)?,
        default_main_color: parse_color(file, doc, "defaultMainColor")?,
        default_secondary_color: parse_color(file, doc, "defaultSecondaryColor")?,
        aspect: ProgressAspect::parse(aspect).ok_or_else(|| {
            MotionError::ManifestInvalid(format!("{file}: unknown aspect {aspect:?}"))
        })?,
        recipe: parse_recipe(file, doc, CatalogueKind::Progress)?,
        determinism: parse_determinism(file, doc)?,
        shader: parse_shader(file, doc)?,
    })
}

/// Confetti recipe body: `palette[]` + `shapes[]` + `sources[]` + the `confetti-v1` parameter bundle.
///
/// It does not go through [`parse_shader`]: confetti has no WGSL (`shader` is written as `null` or omitted);
/// `aspect` accepts only `"frame"`, since other box shapes are not a concept for this family.
fn parse_confetti_body(file: &str, doc: &Value) -> Result<ConfettiBody, MotionError> {
    let aspect = text(file, doc, "aspect")?;
    if aspect != "frame" {
        return Err(MotionError::ManifestInvalid(format!(
            "{file}: confetti \"aspect\" is always \"frame\" (got {aspect:?})"
        )));
    }
    if let Some(shader) = doc.get("shader")
        && !shader.is_null()
    {
        return Err(MotionError::ManifestInvalid(format!(
            "{file}: confetti has no shader (got {shader})"
        )));
    }
    let palette = string_list(file, doc, "palette")?;
    if palette.is_empty() || palette.len() > 8 {
        return Err(MotionError::ManifestInvalid(format!(
            "{file}: \"palette\" must have 1..=8 items (got {})",
            palette.len()
        )));
    }
    for (index, color) in palette.iter().enumerate() {
        let hex = color.strip_prefix('#').unwrap_or("");
        if !matches!(hex.len(), 6 | 8) || !hex.bytes().all(|b| b.is_ascii_hexdigit()) {
            return Err(MotionError::ManifestInvalid(format!(
                "{file}: \"palette[{index}]\" is not #RRGGBB / #RRGGBBAA (got {color:?})"
            )));
        }
    }
    let shapes = string_list(file, doc, "shapes")?;
    if shapes.is_empty() {
        return Err(MotionError::ManifestInvalid(format!(
            "{file}: \"shapes\" must not be empty"
        )));
    }
    if let Some(unknown) = shapes
        .iter()
        .find(|shape| !CONFETTI_SHAPES.contains(&shape.as_str()))
    {
        return Err(MotionError::ManifestInvalid(format!(
            "{file}: unknown confetti shape {unknown:?}"
        )));
    }
    let sources = string_list(file, doc, "sources")?;
    let has_emitter_control = field(file, doc, "hasEmitterControl")?
        .as_bool()
        .ok_or_else(|| {
            MotionError::ManifestInvalid(format!("{file}: bad \"hasEmitterControl\""))
        })?;
    let recipe = parse_recipe(file, doc, CatalogueKind::Confetti)?;
    validate_confetti_recipe(file, &recipe)?;
    Ok(ConfettiBody {
        palette,
        shapes,
        sources,
        has_emitter_control,
        recipe,
        determinism: parse_determinism(file, doc)?,
    })
}

fn string_list(file: &str, doc: &Value, key: &str) -> Result<Vec<String>, MotionError> {
    field(file, doc, key)?
        .as_array()
        .ok_or_else(|| MotionError::ManifestInvalid(format!("{file}: \"{key}\" is not an array")))?
        .iter()
        .map(|value| {
            value.as_str().map(str::to_owned).ok_or_else(|| {
                MotionError::ManifestInvalid(format!("{file}: bad \"{key}\" item {value}"))
            })
        })
        .collect()
}

/// Shape validation for the `confetti-v1` parameter bundle (design draft §4.2): each range `[lo, hi]` is a pair of non-negative numbers in ascending order,
/// there is at least one emitter and its coordinates are numbers, `emit.mode` is a closed set, and `pulse` is `null` or
/// `{min, max, hz}`. The values themselves remain the recipe's degrees of freedom; the Rust side carries not a single number.
fn validate_confetti_recipe(file: &str, recipe: &Recipe) -> Result<(), MotionError> {
    let bad = |what: &str| MotionError::ManifestInvalid(format!("{file}: confetti-v1 {what}"));
    for key in ["speedPx", "sizePx", "spinDps", "flipHz"] {
        let pair = recipe
            .array(key)
            .ok_or_else(|| bad(&format!("\"{key}\" is not an array")))?;
        let lo = pair.first().and_then(Value::as_f64);
        let hi = pair.get(1).and_then(Value::as_f64);
        match (pair.len(), lo, hi) {
            (2, Some(lo), Some(hi)) if lo >= 0.0 && hi >= lo => {}
            _ => {
                return Err(bad(&format!(
                    "\"{key}\" must be an ascending non-negative [lo, hi] (got {pair:?})"
                )));
            }
        }
    }
    for key in [
        "angle",
        "spread",
        "dragX",
        "dragY",
        "gravityPx",
        "windPx",
        "driftPx",
        "driftHz",
        "lifeSec",
        "fadeIn",
        "fadeOut",
    ] {
        if recipe.number(key).is_none() {
            return Err(bad(&format!("\"{key}\" is not a number")));
        }
    }
    if recipe.number("lifeSec").is_some_and(|life| life <= 0.0) {
        return Err(bad("\"lifeSec\" must be positive"));
    }
    if recipe.flag("sizeRamp").is_none() {
        return Err(bad("\"sizeRamp\" is not a boolean"));
    }
    let emitters = recipe
        .array("emitters")
        .ok_or_else(|| bad("\"emitters\" is not an array"))?;
    if emitters.is_empty() {
        return Err(bad("\"emitters\" needs at least one entry"));
    }
    for emitter in emitters {
        for key in ["x", "y", "spreadX", "spreadY"] {
            if emitter.get(key).and_then(Value::as_f64).is_none() {
                return Err(bad(&format!("emitter is missing \"{key}\" (got {emitter})")));
            }
        }
        if let Some(angle) = emitter.get("angle")
            && !angle.is_null()
            && angle.as_f64().is_none()
        {
            return Err(bad(&format!("emitter \"angle\" is not a number (got {emitter})")));
        }
    }
    let emit = recipe
        .object("emit")
        .ok_or_else(|| bad("\"emit\" is not an object"))?;
    validate_tagged(file, recipe, "emit", "mode", &["continuous", "burst"])?;
    for key in ["rate", "count", "interval", "jitter"] {
        if !emit
            .get(key)
            .and_then(Value::as_f64)
            .is_some_and(|v| v >= 0.0)
        {
            return Err(bad(&format!("\"emit.{key}\" must be a non-negative number (got {emit:?})")));
        }
    }
    if let Some(pulse) = recipe.object("pulse") {
        for key in ["min", "max", "hz"] {
            if !pulse
                .get(key)
                .and_then(Value::as_f64)
                .is_some_and(|v| v >= 0.0)
            {
                return Err(bad(&format!(
                    "\"pulse.{key}\" must be a non-negative number (got {pulse:?})"
                )));
            }
        }
    } else if recipe.get("pulse").is_some_and(|v| !v.is_null()) {
        return Err(bad("\"pulse\" must be null or an object"));
    }
    Ok(())
}

/// `colorLabels`: the count must equal `numColors` exactly.
///
/// Sound-wave and progress share one definition: the palette titles of both families are the original English text
/// (Bars / Wave 1 / Bar / Base / Color 1 / Foreground…), and translations are done on each surface itself.
fn parse_color_labels(file: &str, doc: &Value, num_colors: u8) -> Result<Vec<String>, MotionError> {
    let labels = field(file, doc, "colorLabels")?
        .as_array()
        .ok_or_else(|| {
            MotionError::ManifestInvalid(format!("{file}: \"colorLabels\" is not an array"))
        })?
        .iter()
        .map(|value| {
            value.as_str().map(str::to_owned).ok_or_else(|| {
                MotionError::ManifestInvalid(format!("{file}: bad color label {value}"))
            })
        })
        .collect::<Result<Vec<_>, _>>()?;
    if labels.len() != usize::from(num_colors) {
        return Err(MotionError::ManifestInvalid(format!(
            "{file}: \"colorLabels\" has {} entries, but \"numColors\" is {num_colors}",
            labels.len()
        )));
    }
    Ok(labels)
}

fn parse_num_colors(file: &str, doc: &Value) -> Result<u8, MotionError> {
    match field(file, doc, "numColors")?.as_u64() {
        Some(count @ 0..=2) => Ok(count as u8),
        other => Err(MotionError::ManifestInvalid(format!(
            "{file}: \"numColors\" must be 0 / 1 / 2 (got {other:?})"
        ))),
    }
}

/// `#RRGGBB` or `#RRGGBBAA` (semi-transparent default colors use 8 digits).
fn parse_color(file: &str, doc: &Value, key: &str) -> Result<String, MotionError> {
    let value = text(file, doc, key)?;
    let hex = value.strip_prefix('#').unwrap_or("");
    if !matches!(hex.len(), 6 | 8) || !hex.bytes().all(|b| b.is_ascii_hexdigit()) {
        return Err(MotionError::ManifestInvalid(format!(
            "{file}: \"{key}\" is not #RRGGBB / #RRGGBBAA (got {value:?})"
        )));
    }
    Ok(value.to_owned())
}

fn parse_determinism(file: &str, doc: &Value) -> Result<Determinism, MotionError> {
    let value = text(file, doc, "determinism")?;
    Determinism::parse(value).ok_or_else(|| {
        MotionError::ManifestInvalid(format!("{file}: unknown determinism {value:?}"))
    })
}

fn parse_shader(file: &str, doc: &Value) -> Result<String, MotionError> {
    let value = text(file, doc, "shader")?;
    if !value.ends_with(".wgsl") || value.len() <= ".wgsl".len() {
        return Err(MotionError::ManifestInvalid(format!(
            "{file}: \"shader\" must be a WGSL file name (got {value:?})"
        )));
    }
    Ok(value.to_owned())
}

/// `recipe` = closed algorithm name + parameter bundle; parameters are schema-validated according to the algorithm name.
fn parse_recipe(file: &str, doc: &Value, kind: CatalogueKind) -> Result<Recipe, MotionError> {
    let recipe = field(file, doc, "recipe")?;
    let name = text(file, recipe, "algorithm")?;
    let algorithm = RecipeAlgorithm::parse(name).ok_or_else(|| {
        MotionError::ManifestInvalid(format!("{file}: unknown recipe algorithm {name:?}"))
    })?;
    if algorithm.kind() != kind {
        return Err(MotionError::ManifestInvalid(format!(
            "{file}: algorithm {name:?} belongs to the {} directory and cannot be used in a {} recipe",
            algorithm.kind().dir(),
            kind.dir()
        )));
    }
    let params = field(file, recipe, "params")?
        .as_object()
        .ok_or_else(|| {
            MotionError::ManifestInvalid(format!("{file}: \"recipe.params\" is not an object"))
        })?
        .clone();
    let recipe = Recipe { algorithm, params };
    validate_recipe(file, &recipe)?;
    Ok(recipe)
}

fn validate_recipe(file: &str, recipe: &Recipe) -> Result<(), MotionError> {
    let name = recipe.algorithm.name();
    for key in recipe.algorithm.required() {
        if !recipe.params.contains_key(*key) {
            return Err(MotionError::ManifestInvalid(format!(
                "{file}: recipe {name} is missing parameter \"{key}\""
            )));
        }
    }
    for (key, value) in &recipe.params {
        if matches!(value, Value::Null) {
            continue;
        }
        if POSITIVE_INT_KEYS.contains(&key.as_str())
            && !value.as_u64().is_some_and(|count| count > 0)
        {
            return Err(MotionError::ManifestInvalid(format!(
                "{file}: recipe {name} \"{key}\" must be a positive integer (got {value})"
            )));
        }
        if UNIT_INTERVAL_KEYS.contains(&key.as_str())
            && !value.as_f64().is_some_and(|v| (0.0..=1.0).contains(&v))
        {
            return Err(MotionError::ManifestInvalid(format!(
                "{file}: recipe {name} \"{key}\" must be in [0, 1] (got {value})"
            )));
        }
        if POSITIVE_NUMBER_KEYS.contains(&key.as_str())
            && !value.as_f64().is_some_and(|v| v > 0.0 && v.is_finite())
        {
            return Err(MotionError::ManifestInvalid(format!(
                "{file}: recipe {name} \"{key}\" must be positive (got {value})"
            )));
        }
        if key == "samples" && !value.as_u64().is_some_and(|n| n >= MIN_SAMPLES) {
            return Err(MotionError::ManifestInvalid(format!(
                "{file}: recipe {name} \"samples\" must be at least {MIN_SAMPLES} (got {value})"
            )));
        }
        if let Some((_, allowed)) = ENUM_KEYS.iter().find(|(name, _)| name == key) {
            let found = value.as_str().unwrap_or_default();
            if !allowed.contains(&found) {
                return Err(MotionError::ManifestInvalid(format!(
                    "{file}: recipe {name} \"{key}\" only accepts {allowed:?} (got {value})"
                )));
            }
        }
    }
    validate_tagged(file, recipe, "corner", "kind", &["none", "capsule"])?;
    validate_tagged(
        file,
        recipe,
        "colorMode",
        "kind",
        &["solid", "rainbow", "strobe"],
    )?;
    Ok(())
}

/// Nested parameters with a tag (`{"kind": ...}` / `{"form": ...}` / `{"ease": ...}`):
/// if present, they must be an object, and the tag must fall within the closed set.
fn validate_tagged(
    file: &str,
    recipe: &Recipe,
    key: &str,
    tag: &str,
    allowed: &[&str],
) -> Result<(), MotionError> {
    let Some(value) = recipe.params.get(key) else {
        return Ok(());
    };
    if matches!(value, Value::Null) {
        return Ok(());
    }
    let found = value.get(tag).and_then(Value::as_str);
    match found {
        Some(found) if allowed.contains(&found) => Ok(()),
        _ => Err(MotionError::ManifestInvalid(format!(
            "{file}: recipe {} \"{key}.{tag}\" only accepts {allowed:?} (got {value})",
            recipe.algorithm.name()
        ))),
    }
}
