//! Keyframe channels and pure-function sampling (spec §14.1 sample(t)).

use crate::color::Rgba;
use crate::ease::apply_ease;
use motion::{CompositeMode, PostOp};
use serde_json::{Map, Value};

#[derive(Debug, Clone)]
pub struct Kf {
    pub t: f64,
    pub v: Value,
    pub ease: Option<String>,
}

#[derive(Debug, Clone)]
pub struct Channel {
    pub prop: String,
    pub frames: Vec<Kf>,
    /// Display parameters for presets such as countUp (prefix/suffix/decimals)
    pub meta: Option<Map<String, Value>>,
    /// Composite mode (spec §7.7). The four legacy slots are always `Replace`.
    pub composite: CompositeMode,
    /// Override order between replace channels: when windows overlap, the larger one wins; at equal order, the one declared later wins (see `replace_rank`).
    /// The four slots take the values enter=0, exit=1000, emphasis[i]=(2+i)·1000, keyframes[j]=(1000+j)·1000,
    /// which matches the "later declaration overrides" rule (spec §7.1) in order.
    pub order: u32,
}

impl Channel {
    /// Legacy channel: `Replace` + `order 0`.
    pub fn replace(prop: String, frames: Vec<Kf>, meta: Option<Map<String, Value>>) -> Self {
        Self {
            prop,
            frames,
            meta,
            composite: CompositeMode::Replace,
            order: 0,
        }
    }
}

/// The composite result of a set of channels at one instant (fixed order of spec §7.7).
///
/// `values` holds only the winning **replace** values (the winner is decided at `t` by `replace_rank`);
/// `add` / `mul` are stored separately and are folded by the caller together with its own base (the element's static transform initial value).
/// When no add or multiply participates, `scalar()` returns the replace value unchanged.
/// `add` / `mul` are `Option`: most nodes are pure replace, so these two maps are never allocated.
#[derive(Debug, Clone, Default)]
pub struct SampledPose {
    pub values: Map<String, Value>,
    add: Option<Map<String, Value>>,
    mul: Option<Map<String, Value>>,
    /// Display parameters for the `textCount` channel.
    pub count_meta: Option<Map<String, Value>>,
}

impl SampledPose {
    pub fn get(&self, prop: &str) -> Option<&Value> {
        self.values.get(prop)
    }

    /// Fold: `(replace ?? base) + Σadd) × Πmul`, then normalize per property (spec §7.7, step 5).
    pub fn scalar(&self, prop: &str, base: f64) -> f64 {
        let raw = self
            .values
            .get(prop)
            .and_then(Value::as_f64)
            .unwrap_or(base);
        let add = self
            .add
            .as_ref()
            .and_then(|m| m.get(prop))
            .and_then(Value::as_f64);
        let mul = self
            .mul
            .as_ref()
            .and_then(|m| m.get(prop))
            .and_then(Value::as_f64);
        if add.is_none() && mul.is_none() {
            return raw;
        }
        PostOp::for_property(prop).apply((raw + add.unwrap_or(0.0)) * mul.unwrap_or(1.0))
    }

    /// Whether any add / multiply tracks participate. The four legacy slots are always `false`.
    pub fn has_composition(&self) -> bool {
        let filled = |m: &Option<Map<String, Value>>| m.as_ref().is_some_and(|m| !m.is_empty());
        filled(&self.add) || filled(&self.mul)
    }
}

/// Override level of a replace channel at `t` (spec §7.7). The larger tuple wins:
///
/// - `2` inside the window `[first frame, last frame]`: at the same level, `order` decides (§7.1 “later declaration overrides”);
/// - `1` already ended, holding the last value: at the same level, whichever ended later wins (the most recent writer);
/// - `0` not yet started, backfilling the first value: at the same level, whichever started earlier wins.
///
/// Finally `order` is compared, and on a tie the later declaration wins. So `order` only decides the outcome when the **windows really overlap** (exactly the case reported by `motion-replace-overlap`). Two keyframe segments that meet end to end, or an enter and an exit on the same property, each keep to their own window and are not wholly overwritten by the first value the other one backfills.
fn replace_rank(frames: &[Kf], order: u32, t: f64) -> (u8, f64, u32) {
    let (Some(first), Some(last)) = (frames.first(), frames.last()) else {
        return (0, f64::NEG_INFINITY, order);
    };
    if t < first.t {
        (0, -first.t, order)
    } else if t > last.t {
        (1, last.t, order)
    } else {
        (2, 0.0, order)
    }
}

/// Samples a set of channels in the fixed order of spec §7.7.
pub fn sample_channels(channels: &[Channel], t: f64) -> SampledPose {
    let mut pose = SampledPose::default();
    // Override-order ledger: there are only a few channels, so borrowing a linear table of props instead of a `Map<String, Value>` saves one String clone and one JSON number per channel.
    let mut winner: Vec<(&str, (u8, f64, u32))> = Vec::new();
    for ch in channels {
        let v = if ch.prop == "text" {
            let index = ch
                .frames
                .partition_point(|frame| frame.t <= t)
                .saturating_sub(1);
            ch.frames
                .get(index)
                .map_or(Value::Null, |frame| frame.v.clone())
        } else {
            sample_frames(&ch.frames, t)
        };
        if ch.prop == "textCount" {
            pose.count_meta = ch.meta.clone();
        }
        match ch.composite {
            CompositeMode::Replace => {
                let rank = replace_rank(&ch.frames, ch.order, t);
                match winner.iter_mut().find(|(prop, _)| *prop == ch.prop) {
                    Some((_, seen)) => {
                        // For the levels see `replace_rank`; on a complete tie the later declaration wins (spec §7.1).
                        if rank >= *seen {
                            *seen = rank;
                            // If this prop has already won before ⇒ `values` must already have a slot, so overwrite it in place without cloning the key again.
                            match pose.values.get_mut(&ch.prop) {
                                Some(slot) => *slot = v,
                                None => {
                                    pose.values.insert(ch.prop.clone(), v);
                                }
                            }
                        }
                    }
                    None => {
                        winner.push((ch.prop.as_str(), rank));
                        pose.values.insert(ch.prop.clone(), v);
                    }
                }
            }
            CompositeMode::Add => {
                let Some(raw) = v.as_f64() else { continue };
                let add = pose.add.get_or_insert_with(Map::new);
                let acc = add.get(&ch.prop).and_then(Value::as_f64).unwrap_or(0.0);
                add.insert(ch.prop.clone(), Value::from(acc + raw));
            }
            CompositeMode::Multiply => {
                let Some(raw) = v.as_f64() else { continue };
                let mul = pose.mul.get_or_insert_with(Map::new);
                let acc = mul.get(&ch.prop).and_then(Value::as_f64).unwrap_or(1.0);
                mul.insert(ch.prop.clone(), Value::from(acc * raw));
            }
        }
    }
    pose
}

/// Numbers interpolate linearly, color components per channel, objects per key; everything else steps.
pub fn mix_value(a: &Value, b: &Value, u: f64) -> Value {
    if let (Some(na), Some(nb)) = (a.as_f64(), b.as_f64()) {
        return Value::from(na + (nb - na) * u);
    }
    if let (Some(sa), Some(sb)) = (a.as_str(), b.as_str()) {
        if let (Some(ca), Some(cb)) = (Rgba::parse(sa), Rgba::parse(sb)) {
            return Value::from(ca.mixed(&cb, u).css());
        }
    }
    if let (Some(oa), Some(ob)) = (a.as_object(), b.as_object()) {
        let mut out = Map::new();
        for (k, vb) in ob {
            let va = oa.get(k).unwrap_or(vb);
            out.insert(k.clone(), mix_value(va, vb, u));
        }
        return Value::Object(out);
    }
    if u < 1.0 { a.clone() } else { b.clone() }
}

pub fn sample_frames(frames: &[Kf], t: f64) -> Value {
    let (Some(first), Some(last)) = (frames.first(), frames.last()) else {
        return Value::Null;
    };
    if t <= first.t {
        return first.v.clone();
    }
    if t >= last.t {
        return last.v.clone();
    }
    for w in frames.windows(2) {
        let (a, b) = (&w[0], &w[1]);
        if t >= a.t && t <= b.t {
            let span = b.t - a.t;
            let mut u = if span == 0.0 { 1.0 } else { (t - a.t) / span };
            u = apply_ease(b.ease.as_deref(), u);
            return mix_value(&a.v, &b.v, u);
        }
    }
    last.v.clone()
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn kf(t: f64, v: Value, ease: Option<&str>) -> Kf {
        Kf {
            t,
            v,
            ease: ease.map(String::from),
        }
    }

    #[test]
    fn numeric_channel() {
        let frames = vec![kf(0.0, json!(0), None), kf(1.0, json!(100), None)];
        assert_eq!(sample_frames(&frames, -1.0), json!(0));
        assert_eq!(sample_frames(&frames, 0.5), json!(50.0));
        assert_eq!(sample_frames(&frames, 2.0), json!(100));
    }

    #[test]
    fn eased_channel() {
        let frames = vec![
            kf(0.0, json!(0), None),
            kf(1.0, json!(1), Some("easeOutCubic")),
        ];
        let v = sample_frames(&frames, 0.5).as_f64().unwrap();
        assert!((v - 0.875).abs() < 1e-12);
    }

    #[test]
    fn color_channel() {
        let frames = vec![
            kf(0.0, json!("#000000"), None),
            kf(1.0, json!("#ffffff"), None),
        ];
        let v = sample_frames(&frames, 0.5);
        let c = Rgba::parse(v.as_str().unwrap()).unwrap();
        assert!((c.r - 127.5).abs() < 1.0);
    }

    #[test]
    fn object_channel() {
        let frames = vec![
            kf(0.0, json!({"x": 0, "zoom": 1.0}), None),
            kf(1.0, json!({"x": 100, "zoom": 2.0}), None),
        ];
        let v = sample_frames(&frames, 0.5);
        assert_eq!(v["x"], json!(50.0));
        assert_eq!(v["zoom"], json!(1.5));
    }
}
