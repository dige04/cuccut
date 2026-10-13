//! Parsing of the bodymovin subset (subset boundary per ADR-M11, see `core/fixtures/lottie/README.md`).
//!
//! **Why not a single `#[derive(Deserialize)]`**: bodymovin is a format that has accumulated over a dozen exporter versions, and the same key has different types under different `ty` values (`fl`'s `r` is an integer fill rule,
//! while `rc`'s `r` is a rounded-corner property object; `st`'s `d` is a dash array, while `sh`'s `d` is an integer direction;
//! `bm` is sometimes an integer and sometimes a property object). Dispatching on `ty` over a `serde_json::Value` tree is
//! shorter than writing a set of `#[serde(untagged)]` variants, gives better errors, and is less likely to **silently read 0** when it meets
//! an exporter it has never seen.
//!
//! Parsing is the subset gatekeeper: unsupported features become a `lottie-unsupported-feature`
//! hard error or a warn diagnostic here, **with no silent degradation**.

use super::geometry::{Affine, Contour};
use super::value::{self, Animated, Ease};
use crate::drawop::MatteMode;
use crate::plan::PreflightDiagnostic;
use anyhow::{Result, bail};
use motion::effect::BlendMode;
use serde_json::Value;
use std::collections::BTreeMap;

/// Diagnostics collector used during parsing. Warn-level items go here; fail-level items return `Err` directly.
#[derive(Debug, Default)]
pub struct Diagnostics {
    items: Vec<PreflightDiagnostic>,
}

impl Diagnostics {
    pub fn warn(&mut self, message: String) {
        let item = PreflightDiagnostic {
            rule: super::LOTTIE_RULE,
            message,
        };
        // Keep only one copy of the same warning: when dozens of layers in one document attach the same set of expression controllers,
        // reporting each one would drown out the useful diagnostics.
        if !self.items.contains(&item) {
            self.items.push(item);
        }
    }

    pub fn into_inner(self) -> Vec<PreflightDiagnostic> {
        self.items
    }
}

macro_rules! unsupported {
    ($($arg:tt)*) => {
        anyhow::bail!("lottie-unsupported-feature: {}", format!($($arg)*))
    };
}

// ── Top-level document ───────────────────────────────────────────────────

#[derive(Debug)]
pub struct Animation {
    pub version: String,
    /// Composition frame rate
    pub fr: f64,
    pub ip: f64,
    pub op: f64,
    pub width: f64,
    pub height: f64,
    pub layers: Vec<Layer>,
    pub precomps: BTreeMap<String, Vec<Layer>>,
    pub images: BTreeMap<String, ImageAsset>,
    pub markers: Vec<Marker>,
}

#[derive(Debug, Clone)]
pub struct ImageAsset {
    pub id: String,
    pub width: f64,
    pub height: f64,
    /// Path relative to the document directory (`u` + `p`). Embedded assets (`e: 1`) are `None`.
    pub path: Option<String>,
    /// Embedded data URI bytes (`e: 1`).
    pub embedded: Option<Vec<u8>>,
}

#[derive(Debug, Clone)]
pub struct Marker {
    pub name: String,
    /// Frame number
    pub time: f64,
    pub duration: f64,
}

#[derive(Debug)]
pub struct Layer {
    pub index: i64,
    pub name: String,
    pub kind: LayerKind,
    pub parent: Option<i64>,
    /// `sr`: time stretch
    pub stretch: f64,
    pub transform: LayerTransform,
    pub in_point: f64,
    pub out_point: f64,
    /// `st`: the layer's start point on the composition timeline
    pub start: f64,
    pub blend: BlendMode,
    /// `tt`: this layer is masked by the matte source layer above it
    pub matte: Option<MatteMode>,
    /// `td`: this layer is the matte source for the layer below it
    pub is_matte_source: bool,
    pub hidden: bool,
    pub masks: Vec<Mask>,
    /// `tm`: time remapping of the precomposition (seconds)
    pub time_remap: Option<Animated>,
}

#[derive(Debug)]
pub enum LayerKind {
    Precomp {
        ref_id: String,
        width: f64,
        height: f64,
    },
    Solid {
        color: [f64; 3],
        width: f64,
        height: f64,
    },
    Image {
        ref_id: String,
    },
    Null,
    Shape(Vec<ShapeItem>),
}

#[derive(Debug)]
pub struct LayerTransform {
    pub anchor: Animated,
    pub position: Position,
    pub scale: Animated,
    pub rotation: Animated,
    pub opacity: Animated,
    pub skew: Animated,
    pub skew_axis: Animated,
}

#[derive(Debug)]
pub enum Position {
    Unified(Animated),
    Split { x: Animated, y: Animated },
}

impl LayerTransform {
    /// Affine matrix at this moment (excluding opacity).
    pub fn matrix(&self, frame: f64) -> Affine {
        let anchor = self.anchor.value(frame);
        let (ax, ay) = (
            anchor.first().copied().unwrap_or(0.0),
            anchor.get(1).copied().unwrap_or(0.0),
        );
        let (px, py) = match &self.position {
            Position::Unified(p) => {
                let v = p.point(frame);
                (v[0], v[1])
            }
            Position::Split { x, y } => (x.scalar(frame), y.scalar(frame)),
        };
        let scale = self.scale.value(frame);
        let (sx, sy) = (
            scale.first().copied().unwrap_or(100.0) / 100.0,
            scale.get(1).copied().unwrap_or(100.0) / 100.0,
        );
        let skew = self.skew.scalar(frame);
        let axis = self.skew_axis.scalar(frame);
        Affine::translate(-ax, -ay)
            .then(Affine::scale(sx, sy))
            .then(Affine::skew(skew, axis))
            .then(Affine::rotate(self.rotation.scalar(frame)))
            .then(Affine::translate(px, py))
    }

    pub fn alpha(&self, frame: f64) -> f64 {
        (self.opacity.scalar(frame) / 100.0).clamp(0.0, 1.0)
    }

    pub fn is_static(&self) -> bool {
        let position_static = match &self.position {
            Position::Unified(p) => p.is_static(),
            Position::Split { x, y } => x.is_static() && y.is_static(),
        };
        self.anchor.is_static()
            && position_static
            && self.scale.is_static()
            && self.rotation.is_static()
            && self.opacity.is_static()
            && self.skew.is_static()
            && self.skew_axis.is_static()
    }
}

#[derive(Debug)]
pub struct Mask {
    pub path: AnimatedShape,
    pub opacity: Animated,
    pub inverted: bool,
}

// ── Shape tree ─────────────────────────────────────────────────────────

#[derive(Debug)]
pub enum ShapeItem {
    Group {
        items: Vec<ShapeItem>,
    },
    Path {
        path: AnimatedShape,
        reversed: bool,
    },
    Rect {
        position: Animated,
        size: Animated,
        radius: Animated,
        reversed: bool,
    },
    Ellipse {
        position: Animated,
        size: Animated,
        reversed: bool,
    },
    Star {
        position: Animated,
        points: Animated,
        rotation: Animated,
        outer_radius: Animated,
        outer_round: Animated,
        inner_radius: Animated,
        inner_round: Animated,
        is_star: bool,
    },
    Fill {
        color: Animated,
        opacity: Animated,
        even_odd: bool,
    },
    GradientFill {
        gradient: Gradient,
        opacity: Animated,
        even_odd: bool,
    },
    Stroke {
        color: Animated,
        opacity: Animated,
        style: StrokeStyle,
    },
    GradientStroke {
        gradient: Gradient,
        opacity: Animated,
        style: StrokeStyle,
    },
    Transform(ShapeTransform),
    Trim {
        start: Animated,
        end: Animated,
        offset: Animated,
        individually: bool,
    },
    RoundCorners {
        radius: Animated,
    },
    /// `mm: 1` (plain merge). This implementation's fill already concatenates the paths in a group and draws them as one,
    /// so it is a no-op; boolean modes are already rejected at parse time.
    MergeAppend,
}

#[derive(Debug)]
pub struct ShapeTransform {
    pub anchor: Animated,
    pub position: Animated,
    pub scale: Animated,
    pub rotation: Animated,
    pub opacity: Animated,
    pub skew: Animated,
    pub skew_axis: Animated,
}

impl ShapeTransform {
    pub fn matrix(&self, frame: f64) -> Affine {
        let anchor = self.anchor.point(frame);
        let position = self.position.point(frame);
        let scale = self.scale.value(frame);
        let (sx, sy) = (
            scale.first().copied().unwrap_or(100.0) / 100.0,
            scale.get(1).copied().unwrap_or(100.0) / 100.0,
        );
        Affine::translate(-anchor[0], -anchor[1])
            .then(Affine::scale(sx, sy))
            .then(Affine::skew(
                self.skew.scalar(frame),
                self.skew_axis.scalar(frame),
            ))
            .then(Affine::rotate(self.rotation.scalar(frame)))
            .then(Affine::translate(position[0], position[1]))
    }

    pub fn alpha(&self, frame: f64) -> f64 {
        (self.opacity.scalar(frame) / 100.0).clamp(0.0, 1.0)
    }
}

#[derive(Debug)]
pub struct StrokeStyle {
    pub width: Animated,
    /// 0=butt 1=round 2=square (DrawOp encoding)
    pub cap: u8,
    /// 0=miter 1=round 2=bevel
    pub join: u8,
    pub miter: f64,
    /// Dash sequence (alternating dash / gap) and offset
    pub dashes: Vec<Animated>,
    pub dash_offset: Option<Animated>,
}

#[derive(Debug)]
pub struct Gradient {
    pub start: Animated,
    pub end: Animated,
    pub radial: bool,
    /// Radial gradient highlight (`h` percentage / `a` angle)
    pub highlight_length: Animated,
    pub highlight_angle: Animated,
    /// Number of color stops
    pub stop_count: usize,
    /// Flattened color-stop array: the first `stop_count * 4` entries are (offset, r, g, b),
    /// followed by (offset, alpha) pairs, if any.
    pub stops: Animated,
}

/// Shape property (`ks` of `sh` and `pt` of masks).
#[derive(Debug)]
pub enum AnimatedShape {
    Static(Contour),
    Keyframed(Vec<ShapeKeyframe>),
}

#[derive(Debug)]
pub struct ShapeKeyframe {
    pub t: f64,
    pub start: Contour,
    pub end: Option<Contour>,
    pub hold: bool,
    pub out: Ease,
    pub inn: Ease,
}

impl AnimatedShape {
    pub fn is_static(&self) -> bool {
        match self {
            AnimatedShape::Static(_) => true,
            AnimatedShape::Keyframed(frames) => frames.len() <= 1,
        }
    }

    pub fn value(&self, frame: f64) -> Contour {
        match self {
            AnimatedShape::Static(c) => c.clone(),
            AnimatedShape::Keyframed(frames) => {
                if frames.is_empty() {
                    return Contour::default();
                }
                if frame <= frames[0].t {
                    return frames[0].start.clone();
                }
                let last = &frames[frames.len() - 1];
                if frame >= last.t {
                    // Same reasoning and same priority as `value::tail_value`: in the old format
                    // the last entry is a pure terminator (only `t`), and the end value sits in the `e` of the previous frame
                    if !last.start.v.is_empty() {
                        return last.start.clone();
                    }
                    if let Some(end) = &last.end {
                        return end.clone();
                    }
                    for candidate in frames.iter().rev().skip(1) {
                        if let Some(end) = &candidate.end {
                            return end.clone();
                        }
                        if !candidate.start.v.is_empty() {
                            return candidate.start.clone();
                        }
                    }
                    return Contour::default();
                }
                let idx = frames
                    .partition_point(|k| k.t <= frame)
                    .saturating_sub(1)
                    .min(frames.len() - 2);
                let a = &frames[idx];
                let b = &frames[idx + 1];
                if a.hold {
                    return a.start.clone();
                }
                let end = a.end.clone().unwrap_or_else(|| b.start.clone());
                let span = b.t - a.t;
                let raw = if span > 0.0 {
                    ((frame - a.t) / span).clamp(0.0, 1.0)
                } else {
                    0.0
                };
                let x1 = a.out.x.first().copied().unwrap_or(0.0);
                let y1 = a.out.y.first().copied().unwrap_or(0.0);
                let x2 = a.inn.x.first().copied().unwrap_or(1.0);
                let y2 = a.inn.y.first().copied().unwrap_or(1.0);
                lerp_contour(&a.start, &end, value::bezier_ease(x1, y1, x2, y2, raw))
            }
        }
    }
}

/// Interpolates point by point when vertex counts match; when they differ, holds the segment-start shape. AE does not export
/// interpolatable shapes with different vertex counts, and if one ever shows up it is better to "freeze" than to draw a pile of misaligned control points.
fn lerp_contour(a: &Contour, b: &Contour, t: f64) -> Contour {
    if a.v.len() != b.v.len() {
        return a.clone();
    }
    let lerp = |x: &[[f64; 2]], y: &[[f64; 2]]| -> Vec<[f64; 2]> {
        x.iter()
            .zip(y.iter())
            .map(|(p, q)| [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t])
            .collect()
    };
    Contour {
        v: lerp(&a.v, &b.v),
        i: lerp(&a.i, &b.i),
        o: lerp(&a.o, &b.o),
        closed: a.closed,
    }
}

// ── Parsing ───────────────────────────────────────────────────────────

fn obj<'a>(value: &'a Value, path: &str) -> Result<&'a serde_json::Map<String, Value>> {
    value
        .as_object()
        .ok_or_else(|| anyhow::anyhow!("lottie-parse: {path} is not an object"))
}

fn num(map: &serde_json::Map<String, Value>, key: &str) -> Option<f64> {
    map.get(key).and_then(Value::as_f64)
}

fn flag(map: &serde_json::Map<String, Value>, key: &str) -> bool {
    match map.get(key) {
        Some(Value::Bool(b)) => *b,
        Some(Value::Number(n)) => n.as_f64().unwrap_or(0.0) != 0.0,
        _ => false,
    }
}

fn text(map: &serde_json::Map<String, Value>, key: &str) -> Option<String> {
    map.get(key).and_then(Value::as_str).map(str::to_owned)
}

fn prop(
    path: &str,
    map: &serde_json::Map<String, Value>,
    key: &str,
    default: &[f64],
) -> Result<Animated> {
    value::parse_property_or(&format!("{path}.{key}"), map.get(key), default)
}

/// Which `ty` values in `ef` are **expression controllers** (Slider / Angle / Color / Point /
/// Checkbox / Group / Layer / Dropdown). Without expressions they are dead data —
/// ignore and warn, do not fail (survey 2026-08-20: 13 files in the corpus hit this).
const EXPRESSION_CONTROL_TYPES: [i64; 8] = [0, 1, 2, 3, 4, 5, 6, 7];

pub fn parse(src: &str, doc: &Value, diagnostics: &mut Diagnostics) -> Result<Animation> {
    let root = obj(doc, src)?;
    if flag(root, "ddd") {
        unsupported!("{src}: 3D composition (ddd = 1); the first version only supports 2D");
    }
    let fr = num(root, "fr").unwrap_or(0.0);
    if !(fr.is_finite() && fr > 0.0) {
        bail!("lottie-parse: {src} is missing a usable frame rate fr (got {fr})");
    }
    let ip = num(root, "ip").unwrap_or(0.0);
    let op = num(root, "op").unwrap_or(ip);
    if !(op > ip) {
        bail!("lottie-parse: {src} has an invalid time range (ip = {ip}, op = {op})");
    }

    let mut precomps = BTreeMap::new();
    let mut images = BTreeMap::new();
    for (idx, asset) in root
        .get("assets")
        .and_then(Value::as_array)
        .map(Vec::as_slice)
        .unwrap_or_default()
        .iter()
        .enumerate()
    {
        let path = format!("{src}.assets[{idx}]");
        let map = obj(asset, &path)?;
        let Some(id) = text(map, "id") else {
            bail!("lottie-parse: {path} is missing id");
        };
        if let Some(layers) = map.get("layers").and_then(Value::as_array) {
            let mut parsed = Vec::with_capacity(layers.len());
            for (li, layer) in layers.iter().enumerate() {
                parsed.push(parse_layer(
                    &format!("{path}.layers[{li}]"),
                    layer,
                    diagnostics,
                )?);
            }
            precomps.insert(id, parsed);
            continue;
        }
        let file = text(map, "p").unwrap_or_default();
        let dir = text(map, "u").unwrap_or_default();
        let embedded = if flag(map, "e") || file.starts_with("data:") {
            Some(decode_data_uri(&path, &file)?)
        } else {
            None
        };
        images.insert(
            id.clone(),
            ImageAsset {
                id,
                width: num(map, "w").unwrap_or(0.0),
                height: num(map, "h").unwrap_or(0.0),
                path: (embedded.is_none()).then(|| format!("{dir}{file}")),
                embedded,
            },
        );
    }

    let mut layers = Vec::new();
    for (idx, layer) in root
        .get("layers")
        .and_then(Value::as_array)
        .map(Vec::as_slice)
        .unwrap_or_default()
        .iter()
        .enumerate()
    {
        layers.push(parse_layer(
            &format!("{src}.layers[{idx}]"),
            layer,
            diagnostics,
        )?);
    }

    let markers = root
        .get("markers")
        .and_then(Value::as_array)
        .map(Vec::as_slice)
        .unwrap_or_default()
        .iter()
        .filter_map(|marker| {
            let map = marker.as_object()?;
            Some(Marker {
                name: text(map, "cm").unwrap_or_default(),
                time: num(map, "tm").unwrap_or(0.0),
                duration: num(map, "dr").unwrap_or(0.0),
            })
        })
        .collect();

    Ok(Animation {
        version: text(root, "v").unwrap_or_default(),
        fr,
        ip,
        op,
        width: num(root, "w").unwrap_or(0.0),
        height: num(root, "h").unwrap_or(0.0),
        layers,
        precomps,
        images,
        markers,
    })
}

fn parse_layer(path: &str, value: &Value, diagnostics: &mut Diagnostics) -> Result<Layer> {
    let map = obj(value, path)?;
    let ty = map.get("ty").and_then(Value::as_i64).unwrap_or(-1);
    let name = text(map, "nm").unwrap_or_default();
    if flag(map, "ddd") {
        unsupported!("{path} (\"{name}\"): 3D layer (ddd = 1); the first version only supports 2D");
    }
    if flag(map, "ao") {
        unsupported!("{path} (\"{name}\"): auto-orient (ao = 1) is not supported in the first version");
    }
    check_effects(path, &name, map, diagnostics)?;

    let kind = match ty {
        0 => LayerKind::Precomp {
            ref_id: text(map, "refId")
                .ok_or_else(|| anyhow::anyhow!("lottie-parse: {path} is a precomp layer but is missing refId"))?,
            width: num(map, "w").unwrap_or(0.0),
            height: num(map, "h").unwrap_or(0.0),
        },
        1 => LayerKind::Solid {
            color: parse_hex_color(text(map, "sc").as_deref().unwrap_or("#000000")),
            width: num(map, "sw").unwrap_or(0.0),
            height: num(map, "sh").unwrap_or(0.0),
        },
        2 => LayerKind::Image {
            ref_id: text(map, "refId")
                .ok_or_else(|| anyhow::anyhow!("lottie-parse: {path} is an image layer but is missing refId"))?,
        },
        3 => LayerKind::Null,
        4 => {
            let mut items = Vec::new();
            for (idx, item) in map
                .get("shapes")
                .and_then(Value::as_array)
                .map(Vec::as_slice)
                .unwrap_or_default()
                .iter()
                .enumerate()
            {
                if let Some(parsed) = parse_shape(&format!("{path}.shapes[{idx}]"), item)? {
                    items.push(parsed);
                }
            }
            LayerKind::Shape(items)
        }
        5 => unsupported!("{path} (\"{name}\"): text layer (ty = 5); the first version does not do text layout or glyph fallback"),
        other => unsupported!("{path} (\"{name}\"): unknown layer type ty = {other}"),
    };

    let ks = map
        .get("ks")
        .and_then(Value::as_object)
        .cloned()
        .unwrap_or_default();
    let tpath = format!("{path}.ks");
    let position = match ks.get("p").and_then(Value::as_object) {
        Some(p) if flag(p, "s") => Position::Split {
            x: value::parse_property_or(&format!("{tpath}.p.x"), p.get("x"), &[0.0])?,
            y: value::parse_property_or(&format!("{tpath}.p.y"), p.get("y"), &[0.0])?,
        },
        _ => Position::Unified(prop(&tpath, &ks, "p", &[0.0, 0.0])?),
    };
    let transform = LayerTransform {
        anchor: prop(&tpath, &ks, "a", &[0.0, 0.0])?,
        position,
        scale: prop(&tpath, &ks, "s", &[100.0, 100.0])?,
        rotation: prop(&tpath, &ks, "r", &[0.0])?,
        opacity: prop(&tpath, &ks, "o", &[100.0])?,
        skew: prop(&tpath, &ks, "sk", &[0.0])?,
        skew_axis: prop(&tpath, &ks, "sa", &[0.0])?,
    };

    let mut masks = Vec::new();
    for (idx, mask) in map
        .get("masksProperties")
        .and_then(Value::as_array)
        .map(Vec::as_slice)
        .unwrap_or_default()
        .iter()
        .enumerate()
    {
        if let Some(parsed) = parse_mask(&format!("{path}.masksProperties[{idx}]"), mask, &name)? {
            masks.push(parsed);
        }
    }

    let matte = match map.get("tt").and_then(Value::as_i64) {
        None | Some(0) => None,
        Some(1) => Some(MatteMode::Alpha),
        Some(2) => Some(MatteMode::AlphaInverted),
        Some(3) => Some(MatteMode::Luma),
        Some(4) => Some(MatteMode::LumaInverted),
        Some(other) => unsupported!("{path} (\"{name}\"): unknown track matte type tt = {other}"),
    };

    Ok(Layer {
        index: map.get("ind").and_then(Value::as_i64).unwrap_or(-1),
        name,
        kind,
        parent: map.get("parent").and_then(Value::as_i64),
        stretch: num(map, "sr").filter(|v| *v != 0.0).unwrap_or(1.0),
        transform,
        in_point: num(map, "ip").unwrap_or(f64::NEG_INFINITY),
        out_point: num(map, "op").unwrap_or(f64::INFINITY),
        start: num(map, "st").unwrap_or(0.0),
        blend: parse_blend(path, map)?,
        matte,
        is_matte_source: map.get("td").and_then(Value::as_i64).unwrap_or(0) != 0,
        hidden: flag(map, "hd"),
        masks,
        time_remap: match map.get("tm") {
            Some(tm) if !tm.is_null() => Some(value::parse_property(&format!("{path}.tm"), tm)?),
            _ => None,
        },
    })
}

fn check_effects(
    path: &str,
    name: &str,
    map: &serde_json::Map<String, Value>,
    diagnostics: &mut Diagnostics,
) -> Result<()> {
    let effects = map
        .get("ef")
        .and_then(Value::as_array)
        .map(Vec::as_slice)
        .unwrap_or_default();
    if effects.is_empty() {
        return Ok(());
    }
    for effect in effects {
        let Some(entry) = effect.as_object() else {
            continue;
        };
        let ty = entry.get("ty").and_then(Value::as_i64);
        let label = text(entry, "nm").unwrap_or_default();
        match ty {
            Some(code) if EXPRESSION_CONTROL_TYPES.contains(&code) => {
                diagnostics.warn(format!(
                    "layer \"{name}\"'s effect group \"{label}\" is an expression controller (ef ty = {code}); \
                     the document contains no expressions, so it is dead data — ignored, the picture is unaffected"
                ));
            }
            None => {
                diagnostics.warn(format!(
                    "layer \"{name}\"'s effect entry \"{label}\" has no ty field; ignored"
                ));
            }
            Some(code) => unsupported!(
                "{path} (\"{name}\"): raster effect \"{label}\" (ef ty = {code}); \
                 the first version only handles shapes, gradients and masks; for raster effects use BCF's effects[] or the lottie-thorvg escape hatch"
            ),
        }
    }
    Ok(())
}

fn parse_blend(path: &str, map: &serde_json::Map<String, Value>) -> Result<BlendMode> {
    let code = match map.get("bm") {
        None | Some(Value::Null) => 0,
        Some(Value::Number(n)) => n.as_i64().unwrap_or(0),
        Some(Value::Object(inner)) => inner.get("k").and_then(Value::as_i64).unwrap_or(0),
        Some(_) => 0,
    };
    Ok(match code {
        0 => BlendMode::Normal,
        1 => BlendMode::Multiply,
        2 => BlendMode::Screen,
        3 => BlendMode::Overlay,
        4 => BlendMode::Darken,
        5 => BlendMode::Lighten,
        10 => BlendMode::Difference,
        11 => BlendMode::Exclusion,
        16 => BlendMode::Plus,
        other => unsupported!("{path}: blend mode bm = {other} is not in BCF's closed enumeration (§6.6, nine modes)"),
    })
}

fn parse_mask(path: &str, value: &Value, layer: &str) -> Result<Option<Mask>> {
    let map = obj(value, path)?;
    let mode = text(map, "mode").unwrap_or_else(|| "a".into());
    match mode.as_str() {
        "n" => return Ok(None),
        "a" => {}
        other => unsupported!(
            "{path} (layer \"{layer}\"): mask mode \"{other}\"; the first version only supports add (\"a\") and none (\"n\")"
        ),
    }
    // Feathering needs a blur pass; the first-release masks are pure geometric compositing
    let feather = value::parse_property_or(&format!("{path}.x"), map.get("x"), &[0.0])?;
    if !feather.is_static() || feather.scalar(0.0) != 0.0 {
        unsupported!("{path} (layer \"{layer}\"): mask feather (x ≠ 0) is not supported in the first version");
    }
    let Some(pt) = map.get("pt") else {
        return Ok(None);
    };
    Ok(Some(Mask {
        path: parse_shape_property(&format!("{path}.pt"), pt)?,
        opacity: value::parse_property_or(&format!("{path}.o"), map.get("o"), &[100.0])?,
        inverted: flag(map, "inv"),
    }))
}

/// `ks` of `sh` / `pt` of masks: the value is `{i, o, v, c}`, not an array.
pub fn parse_shape_property(path: &str, value: &Value) -> Result<AnimatedShape> {
    let Some(map) = value.as_object() else {
        bail!("lottie-parse: {path} shape property is not an object");
    };
    if let Some(Value::String(expr)) = map.get("x")
        && !expr.trim().is_empty()
    {
        unsupported!("{path} has an expression (\"x\"); this conflicts with BCF's determinism guarantee");
    }
    // Same rule as `value::parse_property`: **judged by structure, not by the `a` flag**.
    // The constant form of a shape property is an `{i, o, v, c}` object, and the keyframe form is an array — so the criterion is more direct:
    // if `k` is an array, it is keyframes. If we kept trusting `a`, assets missing the `a` flag would go into
    // `parse_contour`, which returns an **empty contour** for an array, and the shape would vanish from the picture.
    let k = map.get("k").unwrap_or(&Value::Null);
    let Some(items) = k.as_array() else {
        return Ok(AnimatedShape::Static(parse_contour(path, k)?));
    };
    let mut frames = Vec::with_capacity(items.len());
    for (idx, item) in items.iter().enumerate() {
        let Some(entry) = item.as_object() else {
            continue;
        };
        let kpath = format!("{path}.k[{idx}]");
        let start = match entry.get("s") {
            Some(Value::Array(list)) => {
                parse_contour(&kpath, list.first().unwrap_or(&Value::Null))?
            }
            Some(other) => parse_contour(&kpath, other)?,
            None => Contour::default(),
        };
        let end = match entry.get("e") {
            Some(Value::Array(list)) => {
                list.first().map(|v| parse_contour(&kpath, v)).transpose()?
            }
            Some(other) if !other.is_null() => Some(parse_contour(&kpath, other)?),
            _ => None,
        };
        frames.push(ShapeKeyframe {
            t: entry.get("t").and_then(Value::as_f64).unwrap_or(0.0),
            start,
            end,
            hold: entry.get("h").and_then(Value::as_i64).unwrap_or(0) == 1,
            out: parse_ease(entry.get("o")),
            inn: parse_ease(entry.get("i")),
        });
    }
    if frames.is_empty() {
        return Ok(AnimatedShape::Static(Contour::default()));
    }
    Ok(AnimatedShape::Keyframed(frames))
}

fn parse_ease(value: Option<&Value>) -> Ease {
    let Some(Value::Object(map)) = value else {
        return Ease::default();
    };
    let numbers = |v: Option<&Value>| -> Vec<f64> {
        match v {
            Some(Value::Number(n)) => vec![n.as_f64().unwrap_or(0.0)],
            Some(Value::Array(list)) => list.iter().filter_map(Value::as_f64).collect(),
            _ => Vec::new(),
        }
    };
    Ease {
        x: numbers(map.get("x")),
        y: numbers(map.get("y")),
    }
}

fn parse_contour(path: &str, value: &Value) -> Result<Contour> {
    let Some(map) = value.as_object() else {
        return Ok(Contour::default());
    };
    let points = |key: &str| -> Vec<[f64; 2]> {
        map.get(key)
            .and_then(Value::as_array)
            .map(|list| {
                list.iter()
                    .map(|p| {
                        let pair = p.as_array().map(Vec::as_slice).unwrap_or_default();
                        [
                            pair.first().and_then(Value::as_f64).unwrap_or(0.0),
                            pair.get(1).and_then(Value::as_f64).unwrap_or(0.0),
                        ]
                    })
                    .collect()
            })
            .unwrap_or_default()
    };
    let v = points("v");
    let mut i = points("i");
    let mut o = points("o");
    if (!i.is_empty() && i.len() != v.len()) || (!o.is_empty() && o.len() != v.len()) {
        bail!("lottie-parse: {path} vertex and tangent counts do not match");
    }
    i.resize(v.len(), [0.0, 0.0]);
    o.resize(v.len(), [0.0, 0.0]);
    Ok(Contour {
        v,
        i,
        o,
        closed: flag(map, "c"),
    })
}

fn parse_shape(path: &str, value: &Value) -> Result<Option<ShapeItem>> {
    let map = obj(value, path)?;
    if flag(map, "hd") {
        return Ok(None);
    }
    let ty = map.get("ty").and_then(Value::as_str).unwrap_or("");
    let name = text(map, "nm").unwrap_or_default();
    let reversed = map.get("d").and_then(Value::as_i64).unwrap_or(1) == 3;
    let item = match ty {
        "gr" => {
            let mut items = Vec::new();
            for (idx, child) in map
                .get("it")
                .and_then(Value::as_array)
                .map(Vec::as_slice)
                .unwrap_or_default()
                .iter()
                .enumerate()
            {
                if let Some(parsed) = parse_shape(&format!("{path}.it[{idx}]"), child)? {
                    items.push(parsed);
                }
            }
            ShapeItem::Group { items }
        }
        "sh" => ShapeItem::Path {
            path: parse_shape_property(
                &format!("{path}.ks"),
                map.get("ks").unwrap_or(&Value::Null),
            )?,
            reversed,
        },
        "rc" => ShapeItem::Rect {
            position: prop(path, map, "p", &[0.0, 0.0])?,
            size: prop(path, map, "s", &[0.0, 0.0])?,
            radius: prop(path, map, "r", &[0.0])?,
            reversed,
        },
        "el" => ShapeItem::Ellipse {
            position: prop(path, map, "p", &[0.0, 0.0])?,
            size: prop(path, map, "s", &[0.0, 0.0])?,
            reversed,
        },
        "sr" => ShapeItem::Star {
            position: prop(path, map, "p", &[0.0, 0.0])?,
            points: prop(path, map, "pt", &[5.0])?,
            rotation: prop(path, map, "r", &[0.0])?,
            outer_radius: prop(path, map, "or", &[0.0])?,
            outer_round: prop(path, map, "os", &[0.0])?,
            inner_radius: prop(path, map, "ir", &[0.0])?,
            inner_round: prop(path, map, "is", &[0.0])?,
            is_star: map.get("sy").and_then(Value::as_i64).unwrap_or(1) == 1,
        },
        "fl" => ShapeItem::Fill {
            color: prop(path, map, "c", &[0.0, 0.0, 0.0])?,
            opacity: prop(path, map, "o", &[100.0])?,
            even_odd: map.get("r").and_then(Value::as_i64).unwrap_or(1) == 2,
        },
        "gf" => ShapeItem::GradientFill {
            gradient: parse_gradient(path, map)?,
            opacity: prop(path, map, "o", &[100.0])?,
            even_odd: map.get("r").and_then(Value::as_i64).unwrap_or(1) == 2,
        },
        "st" => ShapeItem::Stroke {
            color: prop(path, map, "c", &[0.0, 0.0, 0.0])?,
            opacity: prop(path, map, "o", &[100.0])?,
            style: parse_stroke_style(path, map)?,
        },
        "gs" => ShapeItem::GradientStroke {
            gradient: parse_gradient(path, map)?,
            opacity: prop(path, map, "o", &[100.0])?,
            style: parse_stroke_style(path, map)?,
        },
        "tr" => ShapeItem::Transform(ShapeTransform {
            anchor: prop(path, map, "a", &[0.0, 0.0])?,
            position: prop(path, map, "p", &[0.0, 0.0])?,
            scale: prop(path, map, "s", &[100.0, 100.0])?,
            rotation: prop(path, map, "r", &[0.0])?,
            opacity: prop(path, map, "o", &[100.0])?,
            skew: prop(path, map, "sk", &[0.0])?,
            skew_axis: prop(path, map, "sa", &[0.0])?,
        }),
        "tm" => ShapeItem::Trim {
            start: prop(path, map, "s", &[0.0])?,
            end: prop(path, map, "e", &[100.0])?,
            offset: prop(path, map, "o", &[0.0])?,
            individually: map.get("m").and_then(Value::as_i64).unwrap_or(1) == 2,
        },
        "rd" => ShapeItem::RoundCorners {
            radius: prop(path, map, "r", &[0.0])?,
        },
        "mm" => match map.get("mm").and_then(Value::as_i64).unwrap_or(1) {
            1 => ShapeItem::MergeAppend,
            other => unsupported!(
                "{path} (\"{name}\"): boolean merge path (mm = {other}); \
                 the first version only does plain concatenation (mm = 1); boolean operations need a path intersection/difference engine"
            ),
        },
        "rp" => unsupported!("{path} (\"{name}\"): repeater (rp) is not supported in the first version"),
        other => unsupported!("{path} (\"{name}\"): unknown shape item ty = \"{other}\""),
    };
    Ok(Some(item))
}

fn parse_stroke_style(path: &str, map: &serde_json::Map<String, Value>) -> Result<StrokeStyle> {
    // bodymovin: lc/lj 1=butt/miter 2=round 3=square/bevel
    let cap = match map.get("lc").and_then(Value::as_i64).unwrap_or(2) {
        1 => 0,
        3 => 2,
        _ => 1,
    };
    let join = match map.get("lj").and_then(Value::as_i64).unwrap_or(2) {
        1 => 0,
        3 => 2,
        _ => 1,
    };
    let mut dashes = Vec::new();
    let mut dash_offset = None;
    for (idx, entry) in map
        .get("d")
        .and_then(Value::as_array)
        .map(Vec::as_slice)
        .unwrap_or_default()
        .iter()
        .enumerate()
    {
        let Some(item) = entry.as_object() else {
            continue;
        };
        let dpath = format!("{path}.d[{idx}]");
        let parsed = value::parse_property_or(&dpath, item.get("v"), &[0.0])?;
        match item.get("n").and_then(Value::as_str).unwrap_or("d") {
            "o" => dash_offset = Some(parsed),
            _ => dashes.push(parsed),
        }
    }
    Ok(StrokeStyle {
        width: prop(path, map, "w", &[1.0])?,
        cap,
        join,
        miter: num(map, "ml").unwrap_or(4.0),
        dashes,
        dash_offset,
    })
}

fn parse_gradient(path: &str, map: &serde_json::Map<String, Value>) -> Result<Gradient> {
    let g = map.get("g").and_then(Value::as_object);
    let stop_count = g
        .and_then(|g| g.get("p"))
        .and_then(Value::as_i64)
        .unwrap_or(0)
        .max(0) as usize;
    let stops = match g.and_then(|g| g.get("k")) {
        Some(k) => value::parse_property(&format!("{path}.g.k"), k)?,
        None => Animated::constant(Vec::new()),
    };
    Ok(Gradient {
        start: prop(path, map, "s", &[0.0, 0.0])?,
        end: prop(path, map, "e", &[0.0, 0.0])?,
        radial: map.get("t").and_then(Value::as_i64).unwrap_or(1) == 2,
        highlight_length: prop(path, map, "h", &[0.0])?,
        highlight_angle: prop(path, map, "a", &[0.0])?,
        stop_count,
        stops,
    })
}

/// `#rrggbb` → three components in 0..1.
fn parse_hex_color(text: &str) -> [f64; 3] {
    let hex = text.trim_start_matches('#');
    let byte = |i: usize| -> f64 {
        u8::from_str_radix(hex.get(i..i + 2).unwrap_or("00"), 16).unwrap_or(0) as f64 / 255.0
    };
    if hex.len() < 6 {
        return [0.0; 3];
    }
    [byte(0), byte(2), byte(4)]
}

/// `data:image/png;base64,....` → bytes. Includes its own base64 decoder, so that one embedded image asset does not add a dependency.
/// Data URIs without `;base64` (common with `data:image/svg+xml;utf8,<svg…>`) are decoded as URL percent-encoding.
fn decode_data_uri(path: &str, uri: &str) -> Result<Vec<u8>> {
    let Some((header, payload)) = uri.split_once(',') else {
        bail!("lottie-parse: {path} is declared as an embedded asset (e = 1), but p is not a data URI");
    };
    if !header
        .split(';')
        .any(|part| part.trim().eq_ignore_ascii_case("base64"))
    {
        return percent_decode(path, payload);
    }
    let mut out = Vec::with_capacity(payload.len() / 4 * 3);
    let mut acc: u32 = 0;
    let mut bits = 0u32;
    for ch in payload.bytes() {
        let sextet = match ch {
            b'A'..=b'Z' => u32::from(ch - b'A'),
            b'a'..=b'z' => u32::from(ch - b'a') + 26,
            b'0'..=b'9' => u32::from(ch - b'0') + 52,
            b'+' => 62,
            b'/' => 63,
            b'=' | b'\n' | b'\r' | b' ' | b'\t' => continue,
            other => bail!("lottie-parse: {path} base64 contains an illegal character 0x{other:02x}"),
        };
        acc = (acc << 6) | sextet;
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            out.push(((acc >> bits) & 0xff) as u8);
        }
    }
    Ok(out)
}

/// Percent-decoding of a data URI: `%XX` is replaced by that byte, everything else is kept as is.
fn percent_decode(path: &str, payload: &str) -> Result<Vec<u8>> {
    let bytes = payload.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut at = 0;
    while at < bytes.len() {
        if bytes[at] == b'%' {
            let byte = payload
                .get(at + 1..at + 3)
                .and_then(|hex| u8::from_str_radix(hex, 16).ok())
                .ok_or_else(|| {
                    anyhow::anyhow!("lottie-parse: {path} data URI contains a malformed percent-encoding")
                })?;
            out.push(byte);
            at += 3;
        } else {
            out.push(bytes[at]);
            at += 1;
        }
    }
    Ok(out)
}

/// Color property evaluation: Lottie uses 0..1, very old exporters use 0..255.
pub fn color_at(color: &Animated, frame: f64) -> [f64; 3] {
    let v = color.value(frame);
    let mut rgb = [
        v.first().copied().unwrap_or(0.0),
        v.get(1).copied().unwrap_or(0.0),
        v.get(2).copied().unwrap_or(0.0),
    ];
    if rgb.iter().any(|c| *c > 1.0) {
        for c in rgb.iter_mut() {
            *c /= 255.0;
        }
    }
    rgb
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn minimal(layers: Value) -> Value {
        json!({"v": "5.7.0", "fr": 30, "ip": 0, "op": 30, "w": 100, "h": 100, "layers": layers})
    }

    fn parse_ok(doc: &Value) -> (Animation, Vec<PreflightDiagnostic>) {
        let mut diagnostics = Diagnostics::default();
        let animation = parse("t", doc, &mut diagnostics).unwrap();
        (animation, diagnostics.into_inner())
    }

    fn parse_err(doc: &Value) -> String {
        let mut diagnostics = Diagnostics::default();
        parse("t", doc, &mut diagnostics).unwrap_err().to_string()
    }

    fn shape_layer(shapes: Value) -> Value {
        json!({"ty": 4, "ind": 1, "ip": 0, "op": 30, "st": 0, "ks": {}, "shapes": shapes})
    }

    #[test]
    fn a_shape_layer_parses_with_its_transform_defaults() {
        let (animation, diagnostics) = parse_ok(&minimal(json!([shape_layer(json!([]))])));
        assert!(diagnostics.is_empty());
        assert_eq!(animation.layers.len(), 1);
        let m = animation.layers[0].transform.matrix(0.0);
        assert_eq!(m, Affine::IDENTITY, "the default transform must be the identity matrix");
        assert_eq!(animation.layers[0].transform.alpha(0.0), 1.0);
    }

    #[test]
    fn text_layers_expressions_and_boolean_merges_are_refused_by_name() {
        for (doc, needle) in [
            (
                minimal(json!([{"ty": 5, "ip": 0, "op": 30, "ks": {}}])),
                "text layer",
            ),
            (
                minimal(json!([shape_layer(json!([{"ty": "mm", "mm": 2}]))])),
                "boolean merge path",
            ),
            (
                minimal(json!([shape_layer(json!([{"ty": "rp"}]))])),
                "repeater",
            ),
            (
                minimal(json!([{"ty": 4, "ddd": 1, "ip": 0, "op": 30, "ks": {}}])),
                "3D",
            ),
            (
                minimal(json!([{"ty": 4, "ao": 1, "ip": 0, "op": 30, "ks": {}}])),
                "auto-orient",
            ),
            (
                minimal(
                    json!([{"ty": 4, "ip": 0, "op": 30, "ks": {"o": {"a": 0, "k": 100, "x": "t"}}}]),
                ),
                "expression",
            ),
            (
                minimal(json!([{"ty": 4, "ip": 0, "op": 30, "ks": {},
                    "ef": [{"ty": 29, "nm": "Gaussian Blur"}]}])),
                "raster effect",
            ),
            (
                minimal(json!([{"ty": 4, "ip": 0, "op": 30, "ks": {},
                    "masksProperties": [{"mode": "s", "pt": {"a": 0, "k": {}}}]}])),
                "mask mode",
            ),
        ] {
            let error = parse_err(&doc);
            assert!(
                error.contains("lottie-unsupported-feature") && error.contains(needle),
                "expected a fail-fast for {needle}, got: {error}"
            );
        }
    }

    #[test]
    fn expression_control_groups_only_warn() {
        let (_, diagnostics) = parse_ok(&minimal(json!([{
            "ty": 4, "ind": 1, "ip": 0, "op": 30, "ks": {},
            "nm": "ctrl",
            "ef": [{"ty": 5, "nm": "控制组", "ef": [{"ty": 0, "nm": "滑块"}]}]
        }])));
        assert_eq!(diagnostics.len(), 1);
        assert_eq!(diagnostics[0].rule, super::super::LOTTIE_RULE);
        assert!(diagnostics[0].message.contains("expression controller"));
    }

    #[test]
    fn every_supported_blend_mode_maps_and_the_rest_fail() {
        for (code, expected) in [
            (0, BlendMode::Normal),
            (1, BlendMode::Multiply),
            (5, BlendMode::Lighten),
            (11, BlendMode::Exclusion),
            (16, BlendMode::Plus),
        ] {
            let doc = minimal(json!([{"ty": 4, "ip": 0, "op": 30, "ks": {}, "bm": code}]));
            assert_eq!(parse_ok(&doc).0.layers[0].blend, expected);
        }
        // Also accepts a `bm` in property-object form
        let doc = minimal(json!([{"ty": 4, "ip": 0, "op": 30, "ks": {}, "bm": {"a": 0, "k": 5}}]));
        assert_eq!(parse_ok(&doc).0.layers[0].blend, BlendMode::Lighten);
        let doc = minimal(json!([{"ty": 4, "ip": 0, "op": 30, "ks": {}, "bm": 9}]));
        assert!(parse_err(&doc).contains("blend mode"));
    }

    #[test]
    fn a_split_position_reads_both_axes() {
        let doc = minimal(json!([{"ty": 4, "ip": 0, "op": 30, "ks": {
            "p": {"s": true, "x": {"a": 0, "k": 12}, "y": {"a": 0, "k": 34}}
        }}]));
        let m = parse_ok(&doc).0.layers[0].transform.matrix(0.0);
        assert_eq!((m.tx, m.ty), (12.0, 34.0));
    }

    #[test]
    fn a_data_uri_image_asset_decodes_inline() {
        let doc = json!({"v": "5.7.0", "fr": 30, "ip": 0, "op": 30, "w": 10, "h": 10,
            "assets": [{"id": "i", "w": 1, "h": 1, "e": 1, "p": "data:image/png;base64,QUJD"}],
            "layers": []});
        let asset = &parse_ok(&doc).0.images["i"];
        assert_eq!(asset.embedded.as_deref(), Some(b"ABC".as_slice()));
        assert!(asset.path.is_none());
    }

    #[test]
    fn an_animated_shape_interpolates_vertex_by_vertex() {
        let shape = parse_shape_property(
            "t",
            &json!({"a": 1, "k": [
                {"t": 0, "s": [{"v": [[0.0, 0.0]], "i": [[0.0, 0.0]], "o": [[0.0, 0.0]], "c": true}],
                 "o": {"x": 0.0, "y": 0.0}, "i": {"x": 1.0, "y": 1.0}},
                {"t": 10, "s": [{"v": [[10.0, 0.0]], "i": [[0.0, 0.0]], "o": [[0.0, 0.0]], "c": true}]}
            ]}),
        )
        .unwrap();
        assert!(!shape.is_static());
        assert!((shape.value(5.0).v[0][0] - 5.0).abs() < 1e-9);
        assert_eq!(shape.value(20.0).v[0][0], 10.0);
    }

    #[test]
    fn an_animated_shape_needs_no_a_flag_either() {
        let contour =
            |x: f64| json!({"v": [[x, 0.0]], "i": [[0.0, 0.0]], "o": [[0.0, 0.0]], "c": true});
        // No `a`: still parsed as keyframes (trusting `a` would route it into parse_contour, get an empty contour,
        // and the shape would vanish from the picture)
        let shape = parse_shape_property(
            "t",
            &json!({"k": [
                {"t": 0, "s": [contour(0.0)],
                 "o": {"x": 0.0, "y": 0.0}, "i": {"x": 1.0, "y": 1.0}},
                {"t": 10, "s": [contour(10.0)]}
            ]}),
        )
        .unwrap();
        assert!(!shape.is_static());
        assert!((shape.value(5.0).v[0][0] - 5.0).abs() < 1e-9);
        // The pure-terminator last entry of the old format: the end value comes from the `e` of the previous frame
        let legacy = parse_shape_property(
            "t",
            &json!({"a": 1, "k": [
                {"t": 0, "s": [contour(0.0)], "e": [contour(8.0)],
                 "o": {"x": 0.0, "y": 0.0}, "i": {"x": 1.0, "y": 1.0}},
                {"t": 10}
            ]}),
        )
        .unwrap();
        assert!((legacy.value(5.0).v[0][0] - 4.0).abs() < 1e-9);
        assert_eq!(
            legacy.value(99.0).v[0][0],
            8.0,
            "the end freezes at 8, not an empty outline"
        );
    }

    #[test]
    fn colours_accept_both_the_unit_and_the_byte_convention() {
        let unit = Animated::constant(vec![1.0, 0.5, 0.0]);
        assert_eq!(color_at(&unit, 0.0), [1.0, 0.5, 0.0]);
        let byte = Animated::constant(vec![255.0, 128.0, 0.0]);
        let rgb = color_at(&byte, 0.0);
        assert!((rgb[0] - 1.0).abs() < 1e-12 && (rgb[1] - 128.0 / 255.0).abs() < 1e-12);
    }
}
