//! Lottie property evaluation: static values, keyframes, bezier easing, hold, and spatial position curves.
//!
//! Same semantics as `sample(t)` in `ccut-motion` — **absolute time in, value out**, with no incremental
//! clock and no "where it last got to" state. The time unit is **composition frames** (`f64`), not seconds:
//! bodymovin's keyframe times `t` are already frame numbers, so converting to seconds and back would only introduce rounding.
//!
//! Determinism: all operations are f64 arithmetic plus Newton/bisection with a fixed iteration count; there is no `Date`,
//! no randomness, and no platform-dependent transcendental functions (`sin`/`cos` appear only in the constant geometry of stars and ellipses,
//! whose inputs are parsed constants or already-evaluated properties, and give the same values across platforms).

use anyhow::{Result, bail};
use serde_json::Value;

/// One end of an easing curve (bodymovin's `i` / `o`). Stored per dimension: AE allows each component
/// to have its own easing; when the length is 1 it is shared across all dimensions.
#[derive(Debug, Clone, Default)]
pub struct Ease {
    pub x: Vec<f64>,
    pub y: Vec<f64>,
}

impl Ease {
    fn at(&self, dim: usize, fallback: f64) -> (f64, f64) {
        let pick = |v: &Vec<f64>| -> f64 {
            if v.is_empty() {
                fallback
            } else if v.len() == 1 {
                v[0]
            } else {
                *v.get(dim).unwrap_or(&v[v.len() - 1])
            }
        };
        (pick(&self.x), pick(&self.y))
    }
}

#[derive(Debug, Clone)]
pub struct Keyframe {
    /// Keyframe time (composition frame number)
    pub t: f64,
    pub start: Vec<f64>,
    /// Before bodymovin 5.x the segment-end value was written in this frame's `e`; afterwards the next frame's `s` is used.
    pub end: Option<Vec<f64>>,
    pub hold: bool,
    pub out: Ease,
    pub inn: Ease,
    /// Spatial tangents of a position property (relative to the start / end point)
    pub to: Option<Vec<f64>>,
    pub ti: Option<Vec<f64>>,
}

#[derive(Debug, Clone)]
pub enum Animated {
    Static(Vec<f64>),
    Keyframed(Vec<Keyframe>),
}

impl Animated {
    pub fn constant(values: Vec<f64>) -> Animated {
        Animated::Static(values)
    }

    /// Is this property constant over the whole span? The still-frame check uses this.
    pub fn is_static(&self) -> bool {
        match self {
            Animated::Static(_) => true,
            Animated::Keyframed(frames) => frames.len() <= 1,
        }
    }

    pub fn value(&self, frame: f64) -> Vec<f64> {
        match self {
            Animated::Static(v) => v.clone(),
            Animated::Keyframed(frames) => sample_keyframes(frames, frame),
        }
    }

    pub fn scalar(&self, frame: f64) -> f64 {
        self.value(frame).first().copied().unwrap_or(0.0)
    }

    pub fn point(&self, frame: f64) -> [f64; 2] {
        let v = self.value(frame);
        [
            v.first().copied().unwrap_or(0.0),
            v.get(1).copied().unwrap_or(0.0),
        ]
    }
}

/// Keyframe sampling. Within a segment, a cubic bezier ease from `o`/`i`; `h == 1` holds the segment-start value;
/// when there are spatial tangents, position follows a spatial bezier. Outside both ends, values are clamped to the endpoint values.
fn sample_keyframes(frames: &[Keyframe], frame: f64) -> Vec<f64> {
    if frames.is_empty() {
        return Vec::new();
    }
    if frame <= frames[0].t {
        return frames[0].start.clone();
    }
    let last = &frames[frames.len() - 1];
    if frame >= last.t {
        return tail_value(frames);
    }
    // frames[i].t <= frame < frames[i+1].t
    let idx = frames
        .partition_point(|k| k.t <= frame)
        .saturating_sub(1)
        .min(frames.len() - 2);
    let a = &frames[idx];
    let b = &frames[idx + 1];
    let end = a.end.clone().unwrap_or_else(|| b.start.clone());
    if a.hold {
        return a.start.clone();
    }
    let span = b.t - a.t;
    let raw = if span > 0.0 {
        (frame - a.t) / span
    } else {
        0.0
    };
    let raw = raw.clamp(0.0, 1.0);

    // Spatial curve: `to` / `ti` are control-point offsets relative to the start / end point (only the first dimension's easing is used)
    if let (Some(to), Some(ti)) = (&a.to, &a.ti)
        && a.start.len() >= 2
        && end.len() >= 2
        && (to.iter().any(|v| *v != 0.0) || ti.iter().any(|v| *v != 0.0))
    {
        let (ox, oy) = a.out.at(0, 0.0);
        let (ix, iy) = a.inn.at(0, 1.0);
        let eased = bezier_ease(ox, oy, ix, iy, raw);
        let dims = a.start.len().min(end.len()).min(3);
        let mut out = Vec::with_capacity(dims);
        for d in 0..dims {
            let p0 = a.start[d];
            let p3 = end[d];
            let p1 = p0 + to.get(d).copied().unwrap_or(0.0);
            let p2 = p3 + ti.get(d).copied().unwrap_or(0.0);
            out.push(cubic(p0, p1, p2, p3, eased));
        }
        return out;
    }

    let dims = a.start.len().max(end.len());
    let mut out = Vec::with_capacity(dims);
    for d in 0..dims {
        let p0 = a.start.get(d).copied().unwrap_or(0.0);
        let p1 = end.get(d).copied().unwrap_or(p0);
        let (ox, oy) = a.out.at(d, 0.0);
        let (ix, iy) = a.inn.at(d, 1.0);
        let eased = bezier_ease(ox, oy, ix, iy, raw);
        out.push(p0 + (p1 - p0) * eased);
    }
    out
}

/// End-value lookup.
///
/// In the new format the last keyframe carries its own `s`; **in the old format (`{s, e, t}` pairs) the last entry is a pure terminator**
/// — it has only a `t`, and that segment's end value is written in the **previous frame's** `e`. We got this wrong once: the last entry was handled as "if `s` is absent, take its own `e`", but it has no `e` either, so the whole property dropped to zero at the end
/// (7 files and 46 properties in the corpus were hit).
fn tail_value(frames: &[Keyframe]) -> Vec<f64> {
    let Some(last) = frames.last() else {
        return Vec::new();
    };
    // The last entry carries its own `s` (new format) ⇒ use it.
    if !last.start.is_empty() {
        return last.start.clone();
    }
    if let Some(end) = &last.end {
        return end.clone();
    }
    // The last entry is a pure terminator ⇒ search backwards for the last keyframe that has a value and take its **segment-end value** `e`.
    // The priority here is deliberately the reverse of the one above: the `s` of the frame just before the terminator is the **start** value of its own segment, and taking it would play the whole animation backwards to its starting point.
    for frame in frames.iter().rev().skip(1) {
        if let Some(end) = &frame.end {
            return end.clone();
        }
        if !frame.start.is_empty() {
            return frame.start.clone();
        }
    }
    Vec::new()
}

fn cubic(p0: f64, p1: f64, p2: f64, p3: f64, t: f64) -> f64 {
    let u = 1.0 - t;
    u * u * u * p0 + 3.0 * u * u * t * p1 + 3.0 * u * t * t * p2 + t * t * t * p3
}

/// Cubic bezier ease `(0,0) (x1,y1) (x2,y2) (1,1)`: solves y for a given x.
///
/// A fixed 12 Newton iterations with a 30-step bisection fallback — **the iteration count is a constant**, so the same input takes the same number of steps and gives the same bits on any platform. The convergence threshold does not participate in early exit.
pub fn bezier_ease(x1: f64, y1: f64, x2: f64, y2: f64, x: f64) -> f64 {
    let x = x.clamp(0.0, 1.0);
    // Pass-through for linear easing: AE's default export is (0,0)-(1,1)
    if (x1 - y1).abs() < f64::EPSILON && (x2 - y2).abs() < f64::EPSILON {
        return x;
    }
    let curve_x = |t: f64| cubic(0.0, x1, x2, 1.0, t);
    let curve_y = |t: f64| cubic(0.0, y1, y2, 1.0, t);
    let slope = |t: f64| {
        let u = 1.0 - t;
        3.0 * u * u * x1 + 6.0 * u * t * (x2 - x1) + 3.0 * t * t * (1.0 - x2)
    };
    let mut t = x;
    for _ in 0..12 {
        let d = slope(t);
        if d.abs() < 1e-9 {
            break;
        }
        t -= (curve_x(t) - x) / d;
        t = t.clamp(0.0, 1.0);
    }
    // Bisection fallback: Newton drifts with extreme S-shaped control points, so this part always runs to completion
    let (mut lo, mut hi) = (0.0f64, 1.0f64);
    let mut u = t;
    for _ in 0..30 {
        let cx = curve_x(u);
        if cx < x {
            lo = u;
        } else {
            hi = u;
        }
        u = (lo + hi) * 0.5;
    }
    curve_y(u)
}

// ── Parsing (serde_json::Value → Animated) ───────────────────────────────

/// Takes an array or scalar as `Vec<f64>`.
fn numbers(value: &Value) -> Vec<f64> {
    match value {
        Value::Number(n) => vec![n.as_f64().unwrap_or(0.0)],
        Value::Array(items) => items
            .iter()
            .map(|v| match v {
                Value::Number(n) => n.as_f64().unwrap_or(0.0),
                Value::Bool(b) => f64::from(u8::from(*b)),
                _ => 0.0,
            })
            .collect(),
        Value::Bool(b) => vec![f64::from(u8::from(*b))],
        _ => Vec::new(),
    }
}

fn ease(value: Option<&Value>) -> Ease {
    let Some(Value::Object(map)) = value else {
        return Ease::default();
    };
    Ease {
        x: map.get("x").map(numbers).unwrap_or_default(),
        y: map.get("y").map(numbers).unwrap_or_default(),
    }
}

/// `{a, k, x?}` → [`Animated`]. `path` is used only for error location.
///
/// An expression (a non-empty string `x`) is a hard error here: it would need a JS evaluator, which directly conflicts with
/// BCF's determinism guarantee (no `Date` / unseeded randomness / timers).
pub fn parse_property(path: &str, value: &Value) -> Result<Animated> {
    let Some(map) = value.as_object() else {
        // Some assets write constants directly as bare arrays / bare numbers
        return Ok(Animated::Static(numbers(value)));
    };
    if let Some(Value::String(expr)) = map.get("x")
        && !expr.trim().is_empty()
    {
        bail!(
            "lottie-unsupported-feature: {path} 带表达式（\"x\"）；\
             表达式需要运行期 JS 求值器，与 BCF 的确定性承诺冲突（首版不支持）"
        );
    }
    let k = map.get("k").unwrap_or(&Value::Null);
    // **Animatedness is judged by structure, not by the `a` flag**: if `k` is an array of keyframe dictionaries, it is keyframes.
    // lottie-web's `PropertyFactory` judges it this way (`k.length && typeof k[0]
    // === 'object'`), because in real assets `a` may be missing entirely or may be written as 0 while still carrying
    // keyframes. We got this wrong once: one exporter omitted `a`, the property was treated as a constant, and `numbers()` cannot extract numbers from a
    // series of objects → **silently became 0** (10 files in the corpus were hit: layer opacity dropped to zero so the whole layer vanished, rotation went to zero, and time remapping went to zero so the precomposition froze).
    // This rule also covers "`a: 1` but `k` is a bare array" — that is a constant and goes to Static.
    let keyframed = k
        .as_array()
        .is_some_and(|items| items.first().is_some_and(Value::is_object));
    if !keyframed {
        return Ok(Animated::Static(numbers(k)));
    }
    let items = k.as_array().expect("keyframed 已保证 k 是数组");
    let mut frames = Vec::with_capacity(items.len());
    for item in items {
        let Some(obj) = item.as_object() else {
            continue;
        };
        frames.push(Keyframe {
            t: obj.get("t").and_then(Value::as_f64).unwrap_or(0.0),
            start: obj.get("s").map(numbers).unwrap_or_default(),
            end: obj.get("e").map(numbers).filter(|v| !v.is_empty()),
            hold: obj.get("h").and_then(Value::as_i64).unwrap_or(0) == 1,
            out: ease(obj.get("o")),
            inn: ease(obj.get("i")),
            to: obj.get("to").map(numbers).filter(|v| !v.is_empty()),
            ti: obj.get("ti").map(numbers).filter(|v| !v.is_empty()),
        });
    }
    if frames.is_empty() {
        return Ok(Animated::Static(Vec::new()));
    }
    // AE exports guarantee t is non-decreasing; a defensive sort makes the binary-search precondition hold
    if frames.windows(2).any(|w| w[0].t > w[1].t) {
        frames.sort_by(|a, b| a.t.partial_cmp(&b.t).unwrap_or(std::cmp::Ordering::Equal));
    }
    Ok(Animated::Keyframed(frames))
}

/// Optional property: when absent, gives a default constant.
pub fn parse_property_or(path: &str, value: Option<&Value>, default: &[f64]) -> Result<Animated> {
    match value {
        Some(v) if !v.is_null() => parse_property(path, v),
        _ => Ok(Animated::Static(default.to_vec())),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn a_static_property_ignores_time() {
        let p = parse_property("t", &json!({"a": 0, "k": [1.0, 2.0]})).unwrap();
        assert_eq!(p.value(0.0), vec![1.0, 2.0]);
        assert_eq!(p.value(999.0), vec![1.0, 2.0]);
        assert!(p.is_static());
    }

    #[test]
    fn linear_keyframes_interpolate_and_clamp_at_both_ends() {
        let p = parse_property(
            "t",
            &json!({"a": 1, "k": [
                {"t": 0, "s": [0.0], "o": {"x": [0.0], "y": [0.0]}, "i": {"x": [1.0], "y": [1.0]}},
                {"t": 10, "s": [100.0]}
            ]}),
        )
        .unwrap();
        assert_eq!(p.scalar(-5.0), 0.0);
        assert!((p.scalar(5.0) - 50.0).abs() < 1e-9);
        assert_eq!(p.scalar(10.0), 100.0);
        assert_eq!(p.scalar(50.0), 100.0);
    }

    #[test]
    fn a_hold_keyframe_does_not_interpolate() {
        let p = parse_property(
            "t",
            &json!({"a": 1, "k": [
                {"t": 0, "s": [0.0], "h": 1},
                {"t": 10, "s": [100.0]}
            ]}),
        )
        .unwrap();
        assert_eq!(p.scalar(9.999), 0.0);
        assert_eq!(p.scalar(10.0), 100.0);
    }

    #[test]
    fn spatial_tangents_bend_the_position_path() {
        let p = parse_property(
            "p",
            &json!({"a": 1, "k": [
                {"t": 0, "s": [0.0, 0.0], "to": [0.0, 50.0], "ti": [0.0, 50.0],
                 "o": {"x": [0.0], "y": [0.0]}, "i": {"x": [1.0], "y": [1.0]}},
                {"t": 10, "s": [100.0, 0.0]}
            ]}),
        )
        .unwrap();
        let mid = p.point(5.0);
        assert!((mid[0] - 50.0).abs() < 1e-9, "x 仍然线性：{mid:?}");
        assert!(mid[1] > 30.0, "y 应当被空间切线拱起来：{mid:?}");
    }

    #[test]
    fn the_ease_curve_is_monotone_and_pinned_at_both_ends() {
        assert!((bezier_ease(0.6, 0.0, 0.4, 1.0, 0.0)).abs() < 1e-9);
        assert!((bezier_ease(0.6, 0.0, 0.4, 1.0, 1.0) - 1.0).abs() < 1e-9);
        let mut prev = -1.0;
        for i in 0..=100 {
            let y = bezier_ease(0.6, 0.0, 0.4, 1.0, f64::from(i) / 100.0);
            assert!(y >= prev - 1e-12, "缓动必须单调：{i} → {y}");
            prev = y;
        }
        // Ease in-out: the midpoint is still 0.5, with both sides squeezed/stretched
        assert!((bezier_ease(0.6, 0.0, 0.4, 1.0, 0.5) - 0.5).abs() < 1e-6);
        assert!(bezier_ease(0.6, 0.0, 0.4, 1.0, 0.25) < 0.25);
    }

    #[test]
    fn keyframes_are_detected_by_structure_not_by_the_a_flag() {
        // In real assets `a` may be missing entirely (10 files in the corpus), or may be written as 0 while still carrying
        // keyframes. The criterion looks only at the shape of `k` — trusting `a` would silently turn the property into 0.
        for property in [
            json!({"k": [
                {"t": 0, "s": [0.0], "o": {"x": [0.0], "y": [0.0]}, "i": {"x": [1.0], "y": [1.0]}},
                {"t": 10, "s": [100.0]}
            ]}),
            json!({"a": 0, "k": [
                {"t": 0, "s": [0.0], "o": {"x": [0.0], "y": [0.0]}, "i": {"x": [1.0], "y": [1.0]}},
                {"t": 10, "s": [100.0]}
            ]}),
        ] {
            let p = parse_property("t", &property).unwrap();
            assert!(!p.is_static(), "缺 / 假的 `a` 标志不得把关键帧降成常量");
            assert!(
                (p.scalar(5.0) - 50.0).abs() < 1e-9,
                "实际 {}",
                p.scalar(5.0)
            );
            assert_eq!(p.scalar(10.0), 100.0);
        }
        // Converse: `a: 1` but `k` is a bare array — that is a constant
        let p = parse_property("t", &json!({"a": 1, "k": [12.0, 34.0]})).unwrap();
        assert!(p.is_static());
        assert_eq!(p.value(7.0), vec![12.0, 34.0]);
    }

    #[test]
    fn legacy_start_end_keyframes_hold_their_final_value() {
        // Old format: values are written in pairs in `s`/`e`, and the **last entry is a pure terminator** (only `t`).
        // The end-value lookup must go back to the previous frame's `e`, not drop to zero.
        let p = parse_property(
            "tm",
            &json!({"a": 1, "k": [
                {"t": -25, "s": [0.0], "e": [2.135],
                 "o": {"x": [0.167], "y": [0.167]}, "i": {"x": [0.833], "y": [0.833]}},
                {"t": 39}
            ]}),
        )
        .unwrap();
        assert_eq!(p.scalar(-30.0), 0.0, "起点之前取首值");
        assert!(p.scalar(0.0) > 0.0 && p.scalar(0.0) < 2.135, "段内插值");
        assert!(
            (p.scalar(39.0) - 2.135).abs() < 1e-9,
            "实际 {}",
            p.scalar(39.0)
        );
        assert!((p.scalar(999.0) - 2.135).abs() < 1e-9, "末端之后冻结在终值");
    }

    #[test]
    fn a_trailing_terminator_never_wins_over_a_real_final_value() {
        // The last entry of the new format carries its own `s` and must not be rewritten by the "search backwards" fallback
        let p = parse_property(
            "t",
            &json!({"a": 1, "k": [
                {"t": 0, "s": [1.0], "e": [9.0]},
                {"t": 10, "s": [5.0]}
            ]}),
        )
        .unwrap();
        assert_eq!(p.scalar(50.0), 5.0);
    }

    #[test]
    fn expressions_are_refused_by_name() {
        let error = parse_property("layer.ks.p", &json!({"a": 0, "k": [0], "x": "value*2"}))
            .unwrap_err()
            .to_string();
        assert!(error.contains("lottie-unsupported-feature"), "{error}");
        // An empty-string `x` is exporter noise and does not count as an expression
        assert!(parse_property("p", &json!({"a": 0, "k": [0], "x": ""})).is_ok());
    }

    #[test]
    fn sampling_is_order_independent() {
        let p = parse_property(
            "t",
            &json!({"a": 1, "k": [
                {"t": 0, "s": [0.0], "o": {"x": [0.3], "y": [0.0]}, "i": {"x": [0.7], "y": [1.0]}},
                {"t": 12, "s": [40.0], "o": {"x": [0.3], "y": [0.0]}, "i": {"x": [0.7], "y": [1.0]}},
                {"t": 30, "s": [-10.0]}
            ]}),
        )
        .unwrap();
        let times: Vec<f64> = (0..=30).map(f64::from).collect();
        let forward: Vec<f64> = times.iter().map(|t| p.scalar(*t)).collect();
        let backward: Vec<f64> = times.iter().rev().map(|t| p.scalar(*t)).collect();
        assert_eq!(
            forward,
            backward.into_iter().rev().collect::<Vec<_>>(),
            "乱序采样必须逐位等于顺序采样"
        );
    }
}
