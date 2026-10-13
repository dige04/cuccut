//! Ducking expanded into a gain envelope (video format spec §3.9): the single rule set; both the frame plan and export take it from here.
//!
//! The curve uses v2 (`timeline::duck::duck_curve`): the trigger intervals of a rule are merged first (intervals separated by no more than max(0.5 s, attack + release) are merged into one segment). Each segment `[s, e]` expands into four points on the gain curve: (s − attack, 1), (s, g), (e, g), (e + release, 1), with g = 10^(−depth/20), and points interpolated linearly in linear gain; attack and release smaller than 0.001 s are treated as 0.001 s. When one instance falls in the target groups of several rules, their gains are multiplied. The attenuation (dB) is subtracted from the instance's gain (including fades), i.e. multiplied in amplitude.
//!
//! Trigger intervals: for instance-triggered rules these are the sequence intervals of the sounding instances in the group; for script-triggered rules these are the interval on the sequence of each word in the current effective word stream, supplied by the caller ([`speech_activity`](crate::audio_plan::speech_activity)). The export sound plan and the preview's per-frame plan use the same word stream. When no word stream is given, script-triggered rules are not expanded.
//!
//! Computed by interval, not by signal level: the result depends only on the timeline and the script, so it is deterministic frame by frame.

use editor_semantics::Rate;
use timeline::duck::{Duck, ENVELOPE_BAKE_STEP, GainEnvelope, duck_curve};
use timeline::keyframes::volume_to_db;
use video_model::{DuckingRule, Sequence, TimelineItem, Track};

use crate::audio_plan::knots_at;
use crate::{PlanError, TrackRules, audio_bounds, span_bounds};

/// The ducking one instance receives: the gain curves of each rule multiplied together, then baked into dB breakpoints. The frame plan and export read the same sequence of breakpoints, so they match point for point.
#[derive(Clone, Debug, PartialEq)]
pub struct DuckingEnvelope {
    knots: Vec<(f64, f64)>,
}

impl DuckingEnvelope {
    /// The ducking an instance receives on the sequence; script-triggered rules are not expanded (no word stream was given). When the instance is not in the target group of any enabled rule, it is an empty envelope (0 dB everywhere).
    pub fn for_item(sequence: &Sequence, item: &TimelineItem, fps: Rate) -> Result<DuckingEnvelope, PlanError> {
        DuckingEnvelope::for_item_with_speech(sequence, item, fps, None)
    }

    /// Same as [`for_item`](Self::for_item); `speech` is the effective word stream's intervals on the sequence (seconds). When given, script-triggered rules are also expanded.
    pub fn for_item_with_speech(
        sequence: &Sequence,
        item: &TimelineItem,
        fps: Rate,
        speech: Option<&[(f64, f64)]>,
    ) -> Result<DuckingEnvelope, PlanError> {
        let base = item.base();
        let rules = TrackRules::new(&sequence.tracks);
        let mut curves = Vec::new();
        for rule in sequence
            .ducking
            .iter()
            .filter(|r| r.enabled && r.depth.is_finite() && r.depth > 0.0)
        {
            if !rule.target.contains(&base.id, &base.track_id) {
                continue;
            }
            let activity = match rule.trigger.group() {
                Some(trigger) if trigger.contains(&base.id, &base.track_id) => continue,
                Some(_) => trigger_intervals(sequence, rule, &rules, fps, &base.id)?,
                None => match speech {
                    Some(speech) => speech.to_vec(),
                    None => continue,
                },
            };
            if activity.is_empty() {
                continue;
            }
            curves.push(GainEnvelope(duck_curve(&activity, &duck_of(rule)?)));
        }
        Ok(DuckingEnvelope { knots: bake(&curves) })
    }

    pub fn is_empty(&self) -> bool {
        self.knots.is_empty()
    }

    /// How many dB to attenuate at `t` (seconds) (≥ 0): linear interpolation in dB between breakpoints.
    pub fn reduction_db(&self, t: f64) -> f64 {
        knots_at(&self.knots, t)
    }

    /// The breakpoints `(seconds, attenuation dB)` of the whole envelope, sorted by time: linear interpolation in dB between breakpoints; 0 before the first and after the last.
    pub fn knots(&self) -> Vec<(f64, f64)> {
        self.knots.clone()
    }
}

/// How many dB to attenuate at `t`, after multiplying together the gains of each rule at this moment.
fn exact_reduction_db(curves: &[GainEnvelope], t: f64) -> f64 {
    curves.iter().map(|curve| -volume_to_db(curve.at(t))).sum::<f64>().max(0.0)
}

/// Baking: every breakpoint of each curve is kept; gain is linear on the ramps but dB is no longer linear, so each ramp is sampled at equal intervals of `ENVELOPE_BAKE_STEP` (0.02 s); the value at each moment is the product of the gains of each rule.
fn bake(curves: &[GainEnvelope]) -> Vec<(f64, f64)> {
    let mut times: Vec<f64> = Vec::new();
    for curve in curves {
        let points = curve.points();
        for pair in points.windows(2) {
            let ([t0, g0], [t1, g1]) = (pair[0], pair[1]);
            times.push(t0);
            if g0 != g1 && t1 > t0 {
                let steps = ((t1 - t0) / ENVELOPE_BAKE_STEP).ceil().max(1.0) as usize;
                times.extend((1..steps).map(|k| t0 + (t1 - t0) * k as f64 / steps as f64));
            }
        }
        times.extend(points.last().map(|p| p[0]));
    }
    times.sort_by(f64::total_cmp);
    times.dedup();
    times.into_iter().map(|t| (t, exact_reduction_db(curves, t))).collect()
}

/// The rule's parameters converted to v2's `Duck` (the curve exists in only one place, in `timeline::duck`).
fn duck_of(rule: &DuckingRule) -> Result<Duck, PlanError> {
    let seconds = |m: &editor_semantics::MediaTime, field: &str| -> Result<f64, PlanError> {
        let v = m.to_ratio(field)?.to_f64();
        Ok(if v.is_finite() { v.max(0.0) } else { 0.0 })
    };
    Ok(Duck {
        under: String::new(),
        depth: Some(rule.depth),
        attack: Some(seconds(&rule.attack, "attack")?),
        release: Some(seconds(&rule.release, "release")?),
    })
}

/// Intervals (seconds, not merged) that trigger by instance: sounding instances in the group that are enabled, on a sounding track, and sounding themselves; excludes the target itself.
fn trigger_intervals(
    sequence: &Sequence,
    rule: &DuckingRule,
    rules: &TrackRules,
    fps: Rate,
    target_id: &str,
) -> Result<Vec<(f64, f64)>, PlanError> {
    let tracks: std::collections::HashMap<&str, &Track> = sequence.tracks.iter().map(|t| (t.id.as_str(), t)).collect();
    let mut intervals = Vec::new();
    let Some(trigger) = rule.trigger.group() else {
        return Ok(intervals);
    };
    for item in &sequence.items {
        let base = item.base();
        if base.id == target_id || !base.enabled || !trigger.contains(&base.id, &base.track_id) {
            continue;
        }
        let Some(track) = tracks.get(base.track_id.as_str()) else {
            continue;
        };
        if !rules.audible(track) {
            continue;
        }
        let bounds = match item {
            TimelineItem::Audio(a) if !a.mix.muted => audio_bounds(a, fps)?,
            TimelineItem::Video(v) if v.embedded_audio.enabled => span_bounds(v.span, fps)?,
            TimelineItem::Composition(c) if c.prerender.is_some() && c.audio.as_ref().is_some_and(|a| a.enabled) => {
                span_bounds(c.span, fps)?
            }
            _ => continue,
        };
        intervals.push((bounds.0.to_f64(), bounds.1.to_f64()));
    }
    Ok(intervals)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// One rule: attenuates by `depth` dB, with trigger intervals `activity`.
    fn curve(depth: f64, attack: f64, release: f64, activity: &[(f64, f64)]) -> GainEnvelope {
        let duck = Duck {
            under: String::new(),
            depth: Some(depth),
            attack: Some(attack),
            release: Some(release),
        };
        GainEnvelope(duck_curve(activity, &duck))
    }

    fn envelope(rules: Vec<GainEnvelope>) -> DuckingEnvelope {
        DuckingEnvelope { knots: bake(&rules) }
    }

    fn near(a: f64, b: f64) {
        assert!((a - b).abs() < 1e-9, "{a} ≠ {b}");
    }

    #[test]
    fn ramps_are_linear_in_gain() {
        let env = envelope(vec![curve(12.0, 0.4, 1.0, &[(2.0, 4.0)])]);
        let floor = 10f64.powf(-12.0 / 20.0);
        assert_eq!(env.reduction_db(1.0), 0.0);
        near(env.reduction_db(2.0), 12.0);
        near(env.reduction_db(3.5), 12.0);
        // The midpoint of the ramp falls on a sample point: the gain is the average of 1 and g, not the average of the dB values.
        near(env.reduction_db(1.8), -volume_to_db((1.0 + floor) / 2.0));
        near(env.reduction_db(4.5), -volume_to_db((1.0 + floor) / 2.0));
        assert!(env.reduction_db(1.8) < 6.0);
        assert_eq!(env.reduction_db(5.0), 0.0);
    }

    #[test]
    fn triggers_closer_than_half_a_second_merge() {
        // Gap of 0.4 s (< max(0.5, attack + release)): merged into one segment, with no recovery in between.
        let env = envelope(vec![curve(10.0, 0.02, 0.35, &[(1.0, 2.0), (2.4, 3.0)])]);
        near(env.reduction_db(2.2), 10.0);
        // Gap of 0.6 s: two segments, back to 0 dB in between.
        let env = envelope(vec![curve(10.0, 0.02, 0.35, &[(1.0, 2.0), (2.6, 3.0)])]);
        assert_eq!(env.reduction_db(2.45), 0.0);
    }

    #[test]
    fn zero_ramps_take_the_minimum_ramp() {
        let env = envelope(vec![curve(12.0, 0.0, 0.0, &[(1.0, 2.0)])]);
        assert_eq!(env.reduction_db(0.998), 0.0);
        near(env.reduction_db(1.0), 12.0);
        assert_eq!(env.reduction_db(2.002), 0.0);
        assert!(env.reduction_db(2.0005) > 0.0 && env.reduction_db(2.0005) < 12.0);
    }

    #[test]
    fn rules_multiply_their_gains() {
        let env = envelope(vec![
            curve(12.0, 0.001, 0.001, &[(0.0, 2.0)]),
            curve(3.0, 0.001, 0.001, &[(1.0, 3.0)]),
        ]);
        near(env.reduction_db(0.5), 12.0);
        near(env.reduction_db(1.5), 15.0);
        near(env.reduction_db(2.5), 3.0);
    }

    #[test]
    fn knots_follow_the_gain_curve_within_the_bake_step() {
        let curves = vec![curve(24.0, 0.3, 0.7, &[(1.0, 2.0)])];
        let env = envelope(curves.clone());
        let knots = env.knots();
        assert_eq!(knots.first().map(|k| k.1), Some(0.0));
        assert_eq!(knots.last().map(|k| k.1), Some(0.0));
        // Ramps are sampled no more than once every 0.02 s; between breakpoints dB is interpolated linearly, and the difference from the true curve is no more than 0.5 dB.
        for pair in knots.windows(2) {
            let ((t0, d0), (t1, d1)) = (pair[0], pair[1]);
            if d0 != d1 {
                assert!(t1 - t0 <= ENVELOPE_BAKE_STEP + 1e-9);
            }
            let mid = (t0 + t1) / 2.0;
            assert!((exact_reduction_db(&curves, mid) - env.reduction_db(mid)).abs() < 0.5, "{mid}");
        }
    }
}
