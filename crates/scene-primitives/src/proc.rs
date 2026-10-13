//! Procedural picture source `proc` (spec §6.2 / §6.12): rain, splashes, night sky.
//!
//! Same discipline as confetti: **no per-frame state**. Each frame is a closed-form function of `(local seconds, seed, params)`, so any moment can be jumped to directly. This module only **parses and validates** (closed key set, ranges, defaults). Geometry and pixels live in `ccut-render::source::proc`.
//!
//! All lengths are **proportions of the element box** (x by box width, y by box height, radii by the box's short side), so the same document draws the same composition at any frame size.
use crate::Rgba;
use anyhow::{Result, anyhow, bail};
use serde_json::{Map, Value};

/// Kind of procedural source (the `proc` field).
pub const PROC_KINDS: &[&str] = &["rain", "splash", "sky"];

/// Per-element particle cap: guards against pathological parameters. It is not a frame budget.
pub const MAX_DROPS: usize = 6_000;
pub const MAX_STARS: usize = 4_000;

#[derive(Clone, Debug, PartialEq)]
pub struct Rain {
    /// 0..1: on a 1080p box, about `density × 1400` rain streaks, scaled linearly by box area.
    pub density: f64,
    /// Tilt from vertical, in degrees. Positive values fall toward the lower right.
    pub angle: f64,
    /// Fall speed: box heights per second (nearest layer; far layers slow down with depth).
    pub speed: f64,
    /// Rain streak length: proportion of box height (nearest layer; far layers shorten with depth).
    pub length: f64,
    /// Gusts: tilt swings ±`wind × 20°` over time (`0` = constant tilt).
    pub wind: f64,
    /// Line width (px, nearest layer).
    pub width: f64,
    pub color: Rgba,
}

#[derive(Clone, Debug, PartialEq)]
pub struct Splash {
    /// Trigger time (element-local seconds).
    pub at: f64,
    /// Landing point: proportion of box width / box height.
    pub x: f64,
    pub y: f64,
    pub count: usize,
    /// Gravity: box heights per second².
    pub gravity: f64,
    /// Upper limit on initial velocity: box heights per second.
    pub speed: f64,
    /// Droplet radius (px).
    pub size: f64,
    /// Lifetime in seconds: after this, an op draws nothing.
    pub life: f64,
    pub color: Rgba,
}

#[derive(Clone, Debug, PartialEq)]
pub struct Moon {
    /// Centre: proportion of box width / box height.
    pub x: f64,
    pub y: f64,
    /// Radius: proportion of the box's short side.
    pub r: f64,
    /// Glow intensity, 0..1.
    pub glow: f64,
    pub color: Rgba,
}

#[derive(Clone, Debug, PartialEq)]
pub struct Sky {
    /// 0..1: on a 1080p box, about `stars × 900` stars, scaled linearly by box area.
    pub stars: f64,
    /// Milky Way intensity, 0..1 (0 = don't draw).
    pub milky_way: f64,
    /// Cloud opacity, 0..1 (0 = don't draw).
    pub cloud: f64,
    /// Cloud cover, 0..1: the fraction of the noise field covered by cloud.
    pub cover: f64,
    /// Cloud drift: box widths per second.
    pub drift: f64,
    pub cloud_color: Rgba,
    /// Vertical gradient for the background. If both ends are transparent, no background is drawn.
    pub top: Rgba,
    pub bottom: Rgba,
    pub moon: Option<Moon>,
}

#[derive(Clone, Debug, PartialEq)]
pub enum ProcKind {
    Rain(Rain),
    Splash(Splash),
    Sky(Sky),
}

#[derive(Clone, Debug, PartialEq)]
pub struct ProcSource {
    pub seed: u64,
    pub kind: ProcKind,
    /// Original author source (`proc` / `seed` / `params`), read-only, for the stage projection.
    pub source: Value,
}

/// Keys allowed on the node (closed set).
const NODE_KEYS: &[&str] = &[
    "type",
    "id",
    "style",
    "animate",
    "effects",
    "backdropEffects",
    "cadence",
    "proc",
    "seed",
    "params",
    "_origin",
    "follow",
    "sizeScale",
    "echo",
];

struct Params<'a> {
    kind: &'static str,
    map: &'a Map<String, Value>,
}

impl Params<'_> {
    fn number(&self, key: &str, default: f64, min: f64, max: f64) -> Result<f64> {
        let Some(raw) = self.map.get(key) else {
            return Ok(default);
        };
        let n = raw
            .as_f64()
            .filter(|n| n.is_finite())
            .ok_or_else(|| anyhow!("schema: proc.{}.{key} must be a finite number", self.kind))?;
        if !(min..=max).contains(&n) {
            bail!(
                "schema: proc.{}.{key} must be within {min}..{max}, got {n}",
                self.kind
            );
        }
        Ok(n)
    }

    fn color(&self, key: &str, default: &str) -> Result<Rgba> {
        let raw = match self.map.get(key) {
            None => default,
            Some(v) => v
                .as_str()
                .ok_or_else(|| anyhow!("schema: proc.{}.{key} must be a color string", self.kind))?,
        };
        Rgba::parse(raw)
            .ok_or_else(|| anyhow!("schema: proc.{}.{key} is not a parsable color: {raw}", self.kind))
    }

    fn closed(&self, keys: &[&str]) -> Result<()> {
        if let Some(key) = self.map.keys().find(|key| !keys.contains(&key.as_str())) {
            bail!(
                "schema: proc.{} has no parameter {key}; available: {keys:?} (§6.12)",
                self.kind
            );
        }
        Ok(())
    }
}

impl ProcSource {
    /// Parse from a node JSON whose references (`$vars` / `$theme`) are already resolved.
    pub fn parse(node: &Value) -> Result<Self> {
        let object = node
            .as_object()
            .ok_or_else(|| anyhow!("schema: proc node must be an object"))?;
        if let Some(key) = object.keys().find(|key| !NODE_KEYS.contains(&key.as_str())) {
            bail!("schema: proc node has unknown field {key}; put parameters in params (§6.12)");
        }
        let name = object
            .get("proc")
            .and_then(Value::as_str)
            .ok_or_else(|| anyhow!("schema: proc node is missing proc ({PROC_KINDS:?})"))?;
        let kind: &'static str = PROC_KINDS
            .iter()
            .copied()
            .find(|k| *k == name)
            .ok_or_else(|| anyhow!("schema: proc \"{name}\" is not in the closed set {PROC_KINDS:?}"))?;
        let seed = match object.get("seed") {
            None => 0,
            Some(v) => v
                .as_u64()
                .filter(|n| *n <= u64::from(u32::MAX))
                .ok_or_else(|| anyhow!("schema: proc.seed must be an integer in 0..4294967295"))?,
        };
        let empty = Map::new();
        let map = match object.get("params") {
            None | Some(Value::Null) => &empty,
            Some(Value::Object(map)) => map,
            Some(other) => bail!("schema: proc.params must be an object, got {other}"),
        };
        let p = Params { kind, map };
        let parsed = match kind {
            "rain" => {
                p.closed(&[
                    "density", "angle", "speed", "length", "wind", "width", "color",
                ])?;
                ProcKind::Rain(Rain {
                    density: p.number("density", 0.5, 0.0, 1.0)?,
                    angle: p.number("angle", 12.0, -60.0, 60.0)?,
                    speed: p.number("speed", 1.6, 0.05, 10.0)?,
                    length: p.number("length", 0.06, 0.0, 0.5)?,
                    wind: p.number("wind", 0.0, 0.0, 1.0)?,
                    width: p.number("width", 1.2, 0.1, 16.0)?,
                    color: p.color("color", "rgba(200,215,255,0.55)")?,
                })
            }
            "splash" => {
                p.closed(&[
                    "at", "x", "y", "count", "gravity", "speed", "size", "life", "color",
                ])?;
                let count = p.number("count", 24.0, 1.0, 400.0)?;
                if count.fract() != 0.0 {
                    bail!("schema: proc.splash.count must be an integer");
                }
                ProcKind::Splash(Splash {
                    at: p.number("at", 0.0, 0.0, 86_400.0)?,
                    x: p.number("x", 0.5, -1.0, 2.0)?,
                    y: p.number("y", 0.9, -1.0, 2.0)?,
                    count: count as usize,
                    gravity: p.number("gravity", 2.5, 0.0, 50.0)?,
                    speed: p.number("speed", 0.9, 0.0, 20.0)?,
                    size: p.number("size", 2.5, 0.2, 64.0)?,
                    life: p.number("life", 1.2, 0.05, 30.0)?,
                    color: p.color("color", "rgba(210,225,255,0.9)")?,
                })
            }
            "sky" => {
                p.closed(&[
                    "stars",
                    "milkyWay",
                    "cloud",
                    "cover",
                    "drift",
                    "cloudColor",
                    "top",
                    "bottom",
                    "moon",
                ])?;
                let moon = match map.get("moon") {
                    None | Some(Value::Null) | Some(Value::Bool(false)) => None,
                    Some(Value::Object(m)) => {
                        let mp = Params {
                            kind: "sky.moon",
                            map: m,
                        };
                        mp.closed(&["x", "y", "r", "glow", "color"])?;
                        Some(Moon {
                            x: mp.number("x", 0.75, -1.0, 2.0)?,
                            y: mp.number("y", 0.22, -1.0, 2.0)?,
                            r: mp.number("r", 0.06, 0.001, 1.0)?,
                            glow: mp.number("glow", 0.6, 0.0, 1.0)?,
                            color: mp.color("color", "#f4f1e6")?,
                        })
                    }
                    Some(other) => bail!("schema: proc.sky.moon must be an object, got {other}"),
                };
                ProcKind::Sky(Sky {
                    stars: p.number("stars", 0.5, 0.0, 1.0)?,
                    milky_way: p.number("milkyWay", 0.0, 0.0, 1.0)?,
                    cloud: p.number("cloud", 0.0, 0.0, 1.0)?,
                    cover: p.number("cover", 0.4, 0.0, 1.0)?,
                    drift: p.number("drift", 0.01, -1.0, 1.0)?,
                    cloud_color: p.color("cloudColor", "#7d88a3")?,
                    top: p.color("top", "#03050c")?,
                    bottom: p.color("bottom", "#141c33")?,
                    moon,
                })
            }
            _ => unreachable!("PROC_KINDS is exhaustive"),
        };
        let mut source = Map::new();
        for key in ["proc", "seed", "params"] {
            if let Some(value) = object.get(key) {
                source.insert(key.into(), value.clone());
            }
        }
        Ok(Self {
            seed,
            kind: parsed,
            source: Value::Object(source),
        })
    }

    pub fn kind_name(&self) -> &'static str {
        match self.kind {
            ProcKind::Rain(_) => "rain",
            ProcKind::Splash(_) => "splash",
            ProcKind::Sky(_) => "sky",
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn defaults_fill_in_and_ranges_are_enforced() {
        let rain = ProcSource::parse(&json!({"type":"proc","proc":"rain","seed":3})).unwrap();
        let ProcKind::Rain(r) = &rain.kind else {
            panic!()
        };
        assert_eq!((rain.seed, r.density, r.angle), (3, 0.5, 12.0));

        for bad in [
            json!({"type":"proc","proc":"snow"}),
            json!({"type":"proc"}),
            json!({"type":"proc","proc":"rain","params":{"density":2}}),
            json!({"type":"proc","proc":"rain","params":{"nope":1}}),
            json!({"type":"proc","proc":"rain","density":0.3}),
            json!({"type":"proc","proc":"splash","params":{"count":2.5}}),
            json!({"type":"proc","proc":"sky","params":{"moon":{"x":0.5,"size":3}}}),
            json!({"type":"proc","proc":"sky","params":{"top":"not-a-color"}}),
            json!({"type":"proc","proc":"rain","seed":-1}),
        ] {
            assert!(ProcSource::parse(&bad).is_err(), "{bad}");
        }
    }

    #[test]
    fn sky_moon_is_optional_and_parsed() {
        let sky = ProcSource::parse(&json!({"type":"proc","proc":"sky","params":{
            "stars":0.8,"milkyWay":0.5,"moon":{"x":0.3,"y":0.2,"r":0.05}
        }}))
        .unwrap();
        let ProcKind::Sky(s) = &sky.kind else {
            panic!()
        };
        let moon = s.moon.as_ref().unwrap();
        assert_eq!((moon.x, moon.y, moon.r, moon.glow), (0.3, 0.2, 0.05, 0.6));
        assert_eq!(sky.source["proc"], json!("sky"));
    }
}
