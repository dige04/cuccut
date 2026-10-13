//! Drawing attributes of a Path (spec §6.2.1): texture fill, stroke jitter, line caps / joins / dashes,
//! fill rule, and the `cadence` sampling-domain declaration (spec §7.10).
//!
//! This module only **parses and validates** (closed key set, value ranges). Generating geometry is the host's job
//! (`ccut-render::source::texture`). All lengths are in the **path's own coordinate system**
//! (the units of `<Svg viewBox>`), using the same convention as `strokeWidth`, and they scale with the svg.

use crate::color::Rgba;
use anyhow::{Result, bail};
use serde_json::{Map, Value};

/// Texture fill algorithm version. Changing the generation rules (row order, the order in which random numbers are drawn, default values) must bump the version. It takes part in the cache key and the geometry digest.
pub const TEXTURE_ALGORITHM_VERSION: u32 = 1;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Finish {
    /// No texture. Lets `finish: "$theme.look.finish"` switch a whole piece back to flat fill.
    Flat,
    /// Parallel short lines + grain.
    Ink,
    /// Sparse thin lines + grain.
    Pencil,
    /// Grain only.
    Grain,
    /// Orthogonal dot grid; dot area = coverage.
    Screen,
    /// Rotated dot grid + slight jitter.
    Riso,
    /// Translucent pigment patches, clipped to the original fill geometry.
    Wash,
    /// Oil-paint stroke: laid down row by row along `angle`, with bristle-textured brush strokes. The base colour is taken from the path `fill`.
    Paint,
}

impl Finish {
    pub const ALL: [&'static str; 8] = [
        "flat", "ink", "pencil", "grain", "screen", "riso", "wash", "paint",
    ];

    pub fn parse(text: &str) -> Option<Finish> {
        Some(match text {
            "flat" => Finish::Flat,
            "ink" => Finish::Ink,
            "pencil" => Finish::Pencil,
            "grain" => Finish::Grain,
            "screen" => Finish::Screen,
            "riso" => Finish::Riso,
            "wash" => Finish::Wash,
            "paint" => Finish::Paint,
            _ => return None,
        })
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Finish::Flat => "flat",
            Finish::Ink => "ink",
            Finish::Pencil => "pencil",
            Finish::Grain => "grain",
            Finish::Screen => "screen",
            Finish::Riso => "riso",
            Finish::Wash => "wash",
            Finish::Paint => "paint",
        }
    }

    pub fn is_hatch(self) -> bool {
        matches!(self, Finish::Ink | Finish::Pencil)
    }

    pub fn is_dots(self) -> bool {
        matches!(self, Finish::Screen | Finish::Riso)
    }
}

/// Coverage field: a scalar, or a function from a closed set (`cx / cy / r` are proportions of the path's bounding box).
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Density {
    Flat(f64),
    Radial {
        cx: f64,
        cy: f64,
        r: f64,
        from: f64,
        to: f64,
    },
    Linear {
        angle: f64,
        from: f64,
        to: f64,
    },
}

impl Density {
    /// `(u, v)` are proportional coordinates within the bounding box. The return value is clamped to `[0, 1]`.
    pub fn at(&self, u: f64, v: f64) -> f64 {
        let value = match *self {
            Density::Flat(value) => value,
            Density::Radial {
                cx,
                cy,
                r,
                from,
                to,
            } => {
                let d = ((u - cx).powi(2) + (v - cy).powi(2)).sqrt();
                let k = if r > 0.0 { (d / r).min(1.0) } else { 1.0 };
                from + (to - from) * k
            }
            Density::Linear { angle, from, to } => {
                let k = ((u - 0.5) * angle.cos() + (v - 0.5) * angle.sin() + 0.5).clamp(0.0, 1.0);
                from + (to - from) * k
            }
        };
        value.clamp(0.0, 1.0)
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct PathTexture {
    pub finish: Finish,
    pub color: Rgba,
    pub alpha: f64,
    /// Hatch direction / dot-grid rotation (radians).
    pub angle: f64,
    /// Hatch line spacing / dot-grid cell spacing.
    pub gap: f64,
    /// Length of a single hatch segment (only for `ink` / `pencil`).
    pub len: f64,
    /// Hatch line width (only for `ink` / `pencil`).
    pub width: f64,
    pub density: Density,
    pub jitter: f64,
    /// Grain count (0 = no grain).
    pub grain: u32,
    pub grain_color: Option<Rgba>,
    pub grain_alpha: f64,
    pub grain_size: f64,
    pub seed: u64,
    /// Dry-brush amount for `paint`, 0..1 (other finishes ignore it).
    pub dry: f64,
    /// Second paint colour for `paint` (other finishes ignore it).
    pub load: Option<Rgba>,
}

/// Upper limit on grain count: one path's grain is composited as a single fill, so too many just slows rasterization.
pub const GRAIN_MAX: u32 = 40_000;

const TEXTURE_KEYS: &[&str] = &[
    "finish",
    "color",
    "alpha",
    "angle",
    "gap",
    "len",
    "width",
    "density",
    "jitter",
    "grain",
    "grainColor",
    "grainAlpha",
    "grainSize",
    "seed",
    "dry",
    "load",
];
const DENSITY_KEYS_RADIAL: &[&str] = &["kind", "cx", "cy", "r", "from", "to"];
const DENSITY_KEYS_LINEAR: &[&str] = &["kind", "angle", "from", "to"];
const DENSITY_KEYS_FLAT: &[&str] = &["kind", "value"];

fn optional_color(map: &Map<String, Value>, key: &str, what: &str) -> Result<Option<Rgba>> {
    match map.get(key) {
        None | Some(Value::Null) => Ok(None),
        Some(value) => match Rgba::parse_value(Some(value)) {
            Some(color) => Ok(Some(color)),
            None => bail!("schema: {what}.{key} is not a valid color: {value}"),
        },
    }
}

fn finite(map: &Map<String, Value>, key: &str, what: &str) -> Result<Option<f64>> {
    match map.get(key) {
        None | Some(Value::Null) => Ok(None),
        Some(value) => match value.as_f64().filter(|v| v.is_finite()) {
            Some(v) => Ok(Some(v)),
            None => bail!("schema: {what}.{key} must be a finite number, got {value}"),
        },
    }
}

fn seed_of(map: &Map<String, Value>, what: &str) -> Result<u64> {
    match map.get("seed") {
        None | Some(Value::Null) => Ok(0),
        Some(value) => {
            if let Some(v) = value.as_u64() {
                return Ok(v);
            }
            match value.as_f64() {
                Some(v) if v.is_finite() && v >= 0.0 && v.fract() == 0.0 && v <= 9.007e15 => {
                    Ok(v as u64)
                }
                _ => bail!("schema: {what}.seed must be a non-negative integer (≤ 2^53), got {value}"),
            }
        }
    }
}

fn closed_keys(map: &Map<String, Value>, allowed: &[&str], what: &str) -> Result<()> {
    for key in map.keys() {
        if !allowed.contains(&key.as_str()) {
            bail!("schema: {what} has no key \"{key}\" (closed key set {allowed:?})");
        }
    }
    Ok(())
}

impl Density {
    fn parse(value: &Value) -> Result<Density> {
        if let Some(v) = value.as_f64() {
            if !v.is_finite() {
                bail!("schema: texture.density must be a finite number");
            }
            return Ok(Density::Flat(v.clamp(0.0, 1.0)));
        }
        let Some(map) = value.as_object() else {
            bail!(
                "schema: texture.density must be a number or {{kind: flat|radial|linear}}, got {value}"
            );
        };
        let kind = map.get("kind").and_then(Value::as_str).unwrap_or("flat");
        let get = |key: &str, default: f64| -> Result<f64> {
            Ok(finite(map, key, "texture.density")?.unwrap_or(default))
        };
        Ok(match kind {
            "flat" => {
                closed_keys(map, DENSITY_KEYS_FLAT, "texture.density(flat)")?;
                Density::Flat(get("value", 0.5)?.clamp(0.0, 1.0))
            }
            "radial" => {
                closed_keys(map, DENSITY_KEYS_RADIAL, "texture.density(radial)")?;
                Density::Radial {
                    cx: get("cx", 0.5)?,
                    cy: get("cy", 0.5)?,
                    r: get("r", 0.75)?,
                    from: get("from", 0.15)?,
                    to: get("to", 0.7)?,
                }
            }
            "linear" => {
                closed_keys(map, DENSITY_KEYS_LINEAR, "texture.density(linear)")?;
                Density::Linear {
                    angle: get("angle", 0.0)?,
                    from: get("from", 0.15)?,
                    to: get("to", 0.7)?,
                }
            }
            other => bail!("schema: texture.density.kind \"{other}\" is not one of flat|radial|linear"),
        })
    }
}

impl PathTexture {
    /// `value` must already have had `$theme` / `$vars` references resolved. `null` ⇒ `None`.
    pub fn parse(value: &Value) -> Result<Option<PathTexture>> {
        if value.is_null() {
            return Ok(None);
        }
        let Some(map) = value.as_object() else {
            bail!("schema: texture must be an object (§6.2.1), got {value}");
        };
        closed_keys(map, TEXTURE_KEYS, "texture")?;
        let finish = match map.get("finish") {
            None | Some(Value::Null) => Finish::Ink,
            Some(value) => match value.as_str().and_then(Finish::parse) {
                Some(finish) => finish,
                None => bail!(
                    "schema: texture.finish {value} is not in the closed set {:?}",
                    Finish::ALL
                ),
            },
        };
        let color = match map.get("color") {
            None | Some(Value::Null) => Rgba {
                r: 0.0,
                g: 0.0,
                b: 0.0,
                a: 1.0,
            },
            Some(value) => match Rgba::parse_value(Some(value)) {
                Some(color) => color,
                None => bail!("schema: texture.color is not a valid color: {value}"),
            },
        };
        let grain_color = match map.get("grainColor") {
            None | Some(Value::Null) => None,
            Some(value) => match Rgba::parse_value(Some(value)) {
                Some(color) => Some(color),
                None => bail!("schema: texture.grainColor is not a valid color: {value}"),
            },
        };
        // Default value for each finish. Changing this table = changing the algorithm version.
        let (angle, gap, len, width, density, jitter, alpha) = match finish {
            Finish::Pencil => (0.6, 7.0, 22.0, 0.9, 0.3, 1.5, 0.5),
            Finish::Screen => (0.0, 6.0, 0.0, 0.0, 0.4, 0.0, 0.6),
            Finish::Riso => (0.26, 6.0, 0.0, 0.0, 0.45, 0.6, 0.6),
            Finish::Wash => (0.0, 32.0, 0.0, 0.0, 0.6, 0.6, 0.22),
            Finish::Paint => (0.5, 14.0, 90.0, 22.0, 0.92, 4.0, 1.0),
            _ => (0.6, 5.0, 16.0, 1.3, 0.55, 1.5, 0.6),
        };
        let num = |key: &str, default: f64| -> Result<f64> {
            Ok(finite(map, key, "texture")?.unwrap_or(default))
        };
        let grain = num("grain", 0.0)?;
        if grain < 0.0 {
            bail!("schema: texture.grain must not be negative");
        }
        Ok(Some(PathTexture {
            finish,
            color,
            alpha: num("alpha", alpha)?.clamp(0.0, 1.0),
            angle: num("angle", angle)?,
            gap: num("gap", gap)?.max(0.5),
            len: num("len", len)?.max(1.0),
            width: num("width", width)?.max(0.0),
            density: match map.get("density") {
                None | Some(Value::Null) => Density::Flat(density),
                Some(value) => Density::parse(value)?,
            },
            jitter: num("jitter", jitter)?.max(0.0),
            grain: (grain as u32).min(GRAIN_MAX),
            grain_color,
            grain_alpha: num("grainAlpha", 0.12)?.clamp(0.0, 1.0),
            grain_size: num("grainSize", 1.8)?.max(0.1),
            seed: seed_of(map, "texture")?,
            dry: num("dry", 0.3)?.clamp(0.0, 1.0),
            load: optional_color(map, "load", "texture")?,
        }))
    }
}

/// Stroke jitter: per-vertex offset keyed by `(seed, vertex index)`. The fill does not move.
/// `every > 0` ⇒ re-seed once every `every` draw frames (boil). The draw frame rate is taken from the node's `cadence` sampling domain; outside any domain, [`DEFAULT_DRAW_FPS`] is used.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct PathWobble {
    pub amp: f64,
    pub seed: u64,
    pub every: u32,
}

/// Frame rate at which boil is counted when there is no `cadence` sampling domain.
pub const DEFAULT_DRAW_FPS: f64 = 12.0;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BrushKind {
    Clean,
    Pencil,
    Ink,
    /// Oil-paint stroke: tapering bristle bands, dry-brush breaks, two-colour mixing (`ccut-render::source::paint`).
    Paint,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct StrokeBrush {
    pub kind: BrushKind,
    pub seed: u64,
    pub roughness: f64,
    /// `paint` only: dry-brush amount, 0..1, default 0.35.
    pub dry: f64,
    /// `paint` only: second paint colour.
    pub load: Option<Rgba>,
}

impl StrokeBrush {
    pub fn parse(value: &Value) -> Result<Self> {
        let map = value
            .as_object()
            .ok_or_else(|| anyhow::anyhow!("schema: brush must be an object"))?;
        closed_keys(map, &["kind", "seed", "roughness", "dry", "load"], "brush")?;
        let kind = match map.get("kind").and_then(Value::as_str) {
            Some("clean") => BrushKind::Clean,
            Some("pencil") => BrushKind::Pencil,
            Some("ink") => BrushKind::Ink,
            Some("paint") => BrushKind::Paint,
            _ => bail!("schema: brush.kind must be clean|pencil|ink|paint"),
        };
        if kind != BrushKind::Paint && (map.contains_key("dry") || map.contains_key("load")) {
            bail!("schema: brush.dry / brush.load only apply to kind: \"paint\"");
        }
        // For paint, roughness is a perceptual multiplier (1 = default). The others are double-line offsets in path units.
        let default = if kind == BrushKind::Paint { 1.0 } else { 0.7 };
        let roughness = finite(map, "roughness", "brush")?.unwrap_or(default);
        if !(0.0..=10.0).contains(&roughness) {
            bail!("schema: brush.roughness must be in 0..10");
        }
        let dry = finite(map, "dry", "brush")?.unwrap_or(0.35);
        if !(0.0..=1.0).contains(&dry) {
            bail!("schema: brush.dry must be in 0..1");
        }
        Ok(Self {
            kind,
            roughness,
            seed: seed_of(map, "brush")?,
            dry,
            load: optional_color(map, "load", "brush")?,
        })
    }
}

#[derive(Debug, Clone, Copy)]
pub enum FollowPosition {
    Start,
    End,
    Progress(f64),
}

#[derive(Debug, Clone)]
pub struct PathFollow {
    pub source: String,
    pub position: FollowPosition,
    pub rotate: bool,
    pub offset: [f64; 2],
}

impl PathFollow {
    pub fn parse(value: &Value) -> Result<Self> {
        let map = value
            .as_object()
            .ok_or_else(|| anyhow::anyhow!("schema: follow must be an object"))?;
        closed_keys(map, &["source", "position", "rotate", "offset"], "follow")?;
        let source = map
            .get("source")
            .and_then(Value::as_str)
            .and_then(|s| s.strip_prefix('#'))
            .filter(|s| !s.is_empty())
            .ok_or_else(|| anyhow::anyhow!("schema: follow.source must be #pathId"))?
            .to_owned();
        let position = match map.get("position") {
            None => FollowPosition::End,
            Some(v) => match v.as_str() {
                Some("start") => FollowPosition::Start,
                Some("end") => FollowPosition::End,
                _ => FollowPosition::Progress(
                    v.as_f64()
                        .filter(|v| v.is_finite() && (0.0..=1.0).contains(v))
                        .ok_or_else(|| {
                            anyhow::anyhow!("schema: follow.position must be start|end|0..1")
                        })?,
                ),
            },
        };
        let rotate = match map.get("rotate") {
            None => false,
            Some(v) => v
                .as_bool()
                .ok_or_else(|| anyhow::anyhow!("schema: follow.rotate must be a boolean"))?,
        };
        let offset = match map.get("offset") {
            None => [0.0; 2],
            Some(v) => {
                let a = v
                    .as_array()
                    .filter(|a| a.len() == 2)
                    .ok_or_else(|| anyhow::anyhow!("schema: follow.offset must be [x,y]"))?;
                let number = |index: usize| {
                    a[index]
                        .as_f64()
                        .filter(|n| n.is_finite())
                        .ok_or_else(|| anyhow::anyhow!("schema: follow.offset must be finite numbers"))
                };
                [number(0)?, number(1)?]
            }
        };
        Ok(Self {
            source,
            position,
            rotate,
            offset,
        })
    }
}

const WOBBLE_KEYS: &[&str] = &["amp", "seed", "every"];

impl PathWobble {
    pub fn parse(value: &Value) -> Result<Option<PathWobble>> {
        if value.is_null() {
            return Ok(None);
        }
        let Some(map) = value.as_object() else {
            bail!("schema: wobble must be an object (§6.2.1), got {value}");
        };
        closed_keys(map, WOBBLE_KEYS, "wobble")?;
        let every = finite(map, "every", "wobble")?.unwrap_or(0.0);
        if every < 0.0 || every.fract() != 0.0 {
            bail!("schema: wobble.every must be a non-negative integer (number of drawn frames)");
        }
        Ok(Some(PathWobble {
            amp: finite(map, "amp", "wobble")?.unwrap_or(1.8).max(0.0),
            seed: seed_of(map, "wobble")?,
            every: every as u32,
        }))
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum LineCap {
    Butt,
    #[default]
    Round,
    Square,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum LineJoin {
    Miter,
    #[default]
    Round,
    Bevel,
}

impl LineCap {
    pub fn parse(text: &str) -> Option<LineCap> {
        Some(match text {
            "butt" => LineCap::Butt,
            "round" => LineCap::Round,
            "square" => LineCap::Square,
            _ => return None,
        })
    }
    /// Encoding of `DrawOp::StrokePathPaint.cap`.
    pub fn code(self) -> u8 {
        match self {
            LineCap::Butt => 0,
            LineCap::Round => 1,
            LineCap::Square => 2,
        }
    }
}

impl LineJoin {
    pub fn parse(text: &str) -> Option<LineJoin> {
        Some(match text {
            "miter" => LineJoin::Miter,
            "round" => LineJoin::Round,
            "bevel" => LineJoin::Bevel,
            _ => return None,
        })
    }
    /// Encoding of `DrawOp::StrokePathPaint.join`.
    pub fn code(self) -> u8 {
        match self {
            LineJoin::Miter => 0,
            LineJoin::Round => 1,
            LineJoin::Bevel => 2,
        }
    }
}

/// `dash`: `[on, off, on, off, …]`, in the path's own coordinates. With an odd count, it is repeated once, per SVG rules.
pub fn parse_dash(value: &Value) -> Result<Vec<f64>> {
    if value.is_null() {
        return Ok(Vec::new());
    }
    let Some(items) = value.as_array() else {
        bail!("schema: dash must be an array of numbers, got {value}");
    };
    let mut out = Vec::with_capacity(items.len());
    for item in items {
        match item.as_f64().filter(|v| v.is_finite() && *v >= 0.0) {
            Some(v) => out.push(v),
            None => bail!("schema: each dash item must be a finite non-negative number, got {item}"),
        }
    }
    if out.len() > 16 {
        bail!("schema: dash allows at most 16 items");
    }
    if out.iter().sum::<f64>() <= 0.0 {
        return Ok(Vec::new());
    }
    if out.len() % 2 == 1 {
        let copy = out.clone();
        out.extend(copy);
    }
    Ok(out)
}

/// `cadence` sampling-domain declaration (spec §7.10).
#[derive(Debug, Clone, Copy, PartialEq, Default)]
pub enum Cadence {
    /// Omitted: inherit the parent domain.
    #[default]
    Inherit,
    /// `"none"`: explicitly leave the parent domain and use real time.
    Off,
    /// `{ fps }`: open a new drawing-frequency domain.
    Fps(f64),
}

/// Value range for drawing frequency. The upper bound is only a guard: a cadence above the output frame rate is meaningless.
pub const CADENCE_FPS_RANGE: (f64, f64) = (1.0, 120.0);

impl Cadence {
    pub fn parse(value: &Value) -> Result<Cadence> {
        match value {
            Value::Null => Ok(Cadence::Inherit),
            Value::String(text) if text == "none" => Ok(Cadence::Off),
            Value::Object(map) => {
                closed_keys(map, &["fps"], "cadence")?;
                match finite(map, "fps", "cadence")? {
                    Some(fps) if fps >= CADENCE_FPS_RANGE.0 && fps <= CADENCE_FPS_RANGE.1 => {
                        Ok(Cadence::Fps(fps))
                    }
                    _ => bail!(
                        "schema: cadence.fps must be within [{}, {}]",
                        CADENCE_FPS_RANGE.0,
                        CADENCE_FPS_RANGE.1
                    ),
                }
            }
            other => bail!("schema: cadence must be {{ fps }} or \"none\", got {other}"),
        }
    }

    /// The drawing frequency in effect after this declaration, under parent domain `parent`.
    pub fn apply(self, parent: Option<f64>) -> Option<f64> {
        match self {
            Cadence::Inherit => parent,
            Cadence::Off => None,
            Cadence::Fps(fps) => Some(fps),
        }
    }
}

/// Quantizes real time `t` to the drawing-frame start for `fps`. Done with integer frame-number arithmetic; the boundary gets +1e-9 to guard against floating-point drift in `k/fps * fps`.
pub fn hold(t: f64, fps: f64) -> f64 {
    ((t * fps) + 1e-9).floor() / fps
}

/// The drawing-frame number that `t` falls in (boil's re-seed counter).
pub fn draw_frame(t: f64, fps: f64) -> u64 {
    ((t * fps) + 1e-9).floor().max(0.0) as u64
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn texture_defaults_and_closed_keys() {
        let tx = PathTexture::parse(&json!({ "finish": "riso", "seed": 7 }))
            .unwrap()
            .unwrap();
        assert_eq!(tx.finish, Finish::Riso);
        assert_eq!(tx.seed, 7);
        assert_eq!(tx.density, Density::Flat(0.45));
        let err = PathTexture::parse(&json!({ "finsh": "ink" })).unwrap_err();
        assert!(err.to_string().starts_with("schema:"), "{err}");
        assert!(PathTexture::parse(&json!({ "finish": "oil" })).is_err());
        assert!(PathTexture::parse(&json!({ "seed": -1 })).is_err());
        assert!(PathTexture::parse(&Value::Null).unwrap().is_none());
    }

    #[test]
    fn paint_texture_and_brush() {
        let tx = PathTexture::parse(&json!({ "finish": "paint", "load": "#ffffff", "dry": 0.5 }))
            .unwrap()
            .unwrap();
        assert_eq!(tx.finish, Finish::Paint);
        assert_eq!(tx.alpha, 1.0);
        assert_eq!(tx.dry, 0.5);
        assert!(tx.load.is_some());
        assert!(PathTexture::parse(&json!({ "finish": "paint", "load": "nope" })).is_err());
        let brush = StrokeBrush::parse(&json!({ "kind": "paint", "load": "#ff0000" })).unwrap();
        assert_eq!(brush.kind, BrushKind::Paint);
        assert_eq!(brush.roughness, 1.0);
        assert_eq!(brush.dry, 0.35);
        assert!(brush.load.is_some());
        assert!(StrokeBrush::parse(&json!({ "kind": "ink", "dry": 0.2 })).is_err());
        assert!(StrokeBrush::parse(&json!({ "kind": "paint", "dry": 2 })).is_err());
        assert_eq!(
            StrokeBrush::parse(&json!({ "kind": "ink" }))
                .unwrap()
                .roughness,
            0.7
        );
    }

    #[test]
    fn density_fields() {
        let radial =
            Density::parse(&json!({ "kind": "radial", "from": 0.0, "to": 1.0, "r": 0.5 })).unwrap();
        assert!(radial.at(0.5, 0.5) < 1e-9);
        assert!((radial.at(1.0, 0.5) - 1.0).abs() < 1e-9);
        let linear = Density::parse(&json!({ "kind": "linear", "from": 0.2, "to": 0.8 })).unwrap();
        assert!((linear.at(0.0, 0.5) - 0.2).abs() < 1e-9);
        assert!((linear.at(1.0, 0.5) - 0.8).abs() < 1e-9);
        assert!(Density::parse(&json!({ "kind": "spiral" })).is_err());
    }

    #[test]
    fn dash_rules() {
        assert_eq!(parse_dash(&json!([4, 2])).unwrap(), vec![4.0, 2.0]);
        assert_eq!(parse_dash(&json!([3])).unwrap(), vec![3.0, 3.0]);
        assert!(parse_dash(&json!([0, 0])).unwrap().is_empty());
        assert!(parse_dash(&json!([1, -1])).is_err());
    }

    #[test]
    fn cadence_hold_is_stable_on_grid() {
        for k in 0..240u32 {
            let t = f64::from(k) / 12.0;
            assert_eq!(draw_frame(t, 12.0), u64::from(k), "k={k}");
            assert!((hold(t, 12.0) - t).abs() < 1e-9);
        }
        // At 24 fps output, each drawing is held for two frames
        assert_eq!(hold(1.0 / 24.0, 12.0), 0.0);
        assert_eq!(draw_frame(3.0 / 24.0, 12.0), 1);
        assert_eq!(Cadence::parse(&json!("none")).unwrap(), Cadence::Off);
        assert_eq!(
            Cadence::parse(&json!({ "fps": 12 })).unwrap().apply(None),
            Some(12.0)
        );
        assert_eq!(Cadence::Off.apply(Some(12.0)), None);
        assert!(Cadence::parse(&json!({ "fps": 0 })).is_err());
    }
}

/// Author-level seed derivation: FNV-1a 32 over UTF-8 of `keys.join("/")`.
/// `seedOf` in `@cuccut/sketch` is the JS implementation of the same algorithm; `ccut-compile/tests/sketch_module.rs` cross-checks the two.
pub fn author_seed(keys: &[&str]) -> u32 {
    let mut hash: u32 = 0x811c_9dc5;
    for byte in keys.join("/").bytes() {
        hash ^= u32::from(byte);
        hash = hash.wrapping_mul(0x0100_0193);
    }
    hash
}
