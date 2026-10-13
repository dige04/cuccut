//! Ducking and element gain envelopes (`ccutTimeline` 0.12, BCF spec §19.x “Volume envelopes and ducking”).
//!
//! The `duck: {under, depth?, attack?, release?}` on an element: `under` is `"speech"` (when someone is speaking) or the id of a track (when a sounding element on that track is playing). **Active intervals are computed from the document only, with no audio analysis**:
//!
//! - `speech`: the timing of each word in the script (already projected onto the finished-picture clock, with cut words dropped, i.e. the export document's `cues[].words[].t0/t1`; when a cue has no words, fall back to its `start/end`).
//! - Track: the `[start, end]` of audio / video elements on that track that are not hidden, not muted, and whose source is not "no audio track", excluding the ducking element itself.
//!
//! When the gap between adjacent intervals does not exceed `max(DUCK_MERGE_GAP, attack + release)`, they are merged into one segment, so the ramp down and the ramp back up never overlap. The ducking gain for each active segment `[a, b]`: starting at `a - attack`, it falls linearly from 1 to `10^(-depth/20)`, holds until `b`, then returns linearly to 1 within `release` seconds.
//!
//! Final gain (normative order) = volume (the static value, or sampled from `volume` keyframes) × fade in/out × ducking. This module combines "volume × ducking" into a single piecewise-linear [`GainEnvelope`] (in element-local seconds); fades are still multiplied in by each host using its existing formula. An element with neither `volume` keyframes nor effective ducking produces no envelope, so hosts keep using the static volume and the result is bit-identical. The export mix (native and ffmpeg), the Web preview (via wasm) and the App preview all consume only the results of [`element_gain_envelopes`].

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::keyframes::{self, Keyframes, VOLUME_RANGE};
use crate::schema::TimelineError;

/// The reserved value of `duck.under`: when someone is speaking.
pub const DUCK_UNDER_SPEECH: &str = "speech";
/// The default for `duck.depth` (dB, how much to lower; the 10 dB from the BCF `audio.duck` spec example).
pub const DUCK_DEPTH_DEFAULT: f64 = 10.0;
/// The range of `duck.depth` (dB, inclusive; 0 = no ducking).
pub const DUCK_DEPTH_RANGE: (f64, f64) = (0.0, 60.0);
/// The default for `duck.attack` (seconds): the same constant as BCF `audio.duck`.
pub const DUCK_ATTACK_DEFAULT: f64 = scene_primitives::audio_mix::DUCK_ATTACK;
/// The default for `duck.release` (seconds): the same constant as BCF `audio.duck`.
pub const DUCK_RELEASE_DEFAULT: f64 = scene_primitives::audio_mix::DUCK_RELEASE;
/// The range of `duck.attack` / `duck.release` (seconds, inclusive).
pub const DUCK_TIME_RANGE: (f64, f64) = (0.0, 5.0);
/// The merge threshold for active intervals (seconds): adjacent intervals whose gap does not exceed it (or `attack + release`, whichever is larger) are merged.
pub const DUCK_MERGE_GAP: f64 = 0.5;
/// The minimum ramp duration (seconds): when `attack` / `release` is written as 0, this value is used instead, to avoid a gain jump that produces a click, and to give every segment of the envelope a non-zero duration.
pub const DUCK_MIN_RAMP: f64 = 0.001;
/// The step size (seconds) used when baking an eased `volume` keyframe segment into a polyline.
pub const ENVELOPE_BAKE_STEP: f64 = 0.02;
/// Warning code: `under:"speech"` is set but the document has no timed script at all, so ducking has no effect.
pub const DUCK_NO_SPEECH: &str = "duck-no-speech";
/// Warning code: the track that `under` points to does not exist.
pub const DUCK_TRACK_MISSING: &str = "duck-track-missing";

/// `duck` on an element. Absent parameters take their defaults (`depth` 10 dB, `attack` 0.02 s, `release` 0.35 s).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Duck {
    pub under: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub depth: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub attack: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub release: Option<f64>,
}

impl Duck {
    pub fn depth_db(&self) -> f64 {
        self.depth.unwrap_or(DUCK_DEPTH_DEFAULT)
    }

    pub fn attack_seconds(&self) -> f64 {
        self.attack.unwrap_or(DUCK_ATTACK_DEFAULT)
    }

    pub fn release_seconds(&self) -> f64 {
        self.release.unwrap_or(DUCK_RELEASE_DEFAULT)
    }

    /// The gain during ducking (linear).
    pub fn floor_gain(&self) -> f64 {
        keyframes::db_to_volume(-self.depth_db())
    }

    pub fn is_speech(&self) -> bool {
        self.under == DUCK_UNDER_SPEECH
    }

    /// Field-level validation (whether `under` points to an existing track is checked at the document level).
    pub fn validate(&self, element_id: &str) -> Result<(), TimelineError> {
        if self.under.trim().is_empty() || self.under == "none" {
            return Err(TimelineError::Invalid(format!(
                "element {element_id} 的 duck.under 须是 \"speech\" 或一条轨的 id"
            )));
        }
        let within = |value: Option<f64>, range: (f64, f64)| {
            value.is_none_or(|value| value.is_finite() && (range.0..=range.1).contains(&value))
        };
        if !within(self.depth, DUCK_DEPTH_RANGE) {
            return Err(TimelineError::Invalid(format!(
                "element {element_id} 的 duck.depth 须在 {}..={} dB",
                DUCK_DEPTH_RANGE.0, DUCK_DEPTH_RANGE.1
            )));
        }
        for (name, value) in [("attack", self.attack), ("release", self.release)] {
            if !within(value, DUCK_TIME_RANGE) {
                return Err(TimelineError::Invalid(format!(
                    "element {element_id} 的 duck.{name} 须在 {}..={} 秒",
                    DUCK_TIME_RANGE.0, DUCK_TIME_RANGE.1
                )));
            }
        }
        Ok(())
    }
}

/// A piecewise-linear gain envelope, with times in element-local seconds. Before the first point the first point's value is used; after the last point the last point's value is used. Points are in ascending time order, and adjacent point times strictly increase.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct GainEnvelope(pub Vec<[f64; 2]>);

impl GainEnvelope {
    pub fn points(&self) -> &[[f64; 2]] {
        &self.0
    }

    /// The gain at local time `local`.
    pub fn at(&self, local: f64) -> f64 {
        let points = &self.0;
        let Some(first) = points.first() else {
            return 1.0;
        };
        if local <= first[0] {
            return first[1];
        }
        for pair in points.windows(2) {
            let ([t0, g0], [t1, g1]) = (pair[0], pair[1]);
            if local < t1 {
                let span = t1 - t0;
                if span <= 0.0 {
                    return g1;
                }
                return g0 + (g1 - g0) * ((local - t0) / span);
            }
        }
        points[points.len() - 1][1]
    }
}

/// One warning (the reason ducking is configured but has no effect).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GainWarning {
    pub element: String,
    pub code: String,
    pub message: String,
}

/// The result of [`element_gain_envelopes`].
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioGainPlan {
    /// Element id → envelope. Contains only elements that have `volume` keyframes or effective ducking.
    pub envelopes: BTreeMap<String, GainEnvelope>,
    pub warnings: Vec<GainWarning>,
}

/// Sorts and merges intervals: overlapping intervals, or adjacent ones whose gap does not exceed `gap`, are combined into one. Empty intervals are dropped.
pub fn merge_intervals(mut intervals: Vec<(f64, f64)>, gap: f64) -> Vec<(f64, f64)> {
    intervals.retain(|(start, end)| start.is_finite() && end.is_finite() && end > start);
    intervals.sort_by(|a, b| a.0.total_cmp(&b.0).then(a.1.total_cmp(&b.1)));
    let mut out: Vec<(f64, f64)> = Vec::with_capacity(intervals.len());
    for (start, end) in intervals {
        match out.last_mut() {
            Some(last) if start - last.1 <= gap => last.1 = last.1.max(end),
            _ => out.push((start, end)),
        }
    }
    out
}

fn number(value: Option<&Value>) -> Option<f64> {
    value
        .and_then(Value::as_f64)
        .filter(|value| value.is_finite())
}

/// The speech intervals of the script (finished-picture clock, not merged). `cues` is the array of cues already projected onto the finished-picture clock (the `cues` of the export document and of the Web render document): each word's `t0/t1` (or `start/end`); a cue with no words uses its own `start/end`.
pub fn speech_intervals(cues: &Value) -> Vec<(f64, f64)> {
    let mut out = Vec::new();
    for cue in cues.as_array().into_iter().flatten() {
        let words = cue.get("words").and_then(Value::as_array);
        let mut any = false;
        for word in words.into_iter().flatten() {
            let start = number(word.get("t0").or_else(|| word.get("start")));
            let end = number(word.get("t1").or_else(|| word.get("end")));
            if let (Some(start), Some(end)) = (start, end)
                && end > start
            {
                out.push((start, end));
                any = true;
            }
        }
        if !any
            && let (Some(start), Some(end)) = (number(cue.get("start")), number(cue.get("end")))
            && end > start
        {
            out.push((start, end));
        }
    }
    out
}

fn element_window(element: &Value, project_end: f64) -> (f64, f64) {
    let start = number(element.get("start"))
        .unwrap_or(0.0)
        .clamp(0.0, project_end.max(0.0));
    let end = number(element.get("end"))
        .unwrap_or(project_end)
        .clamp(0.0, project_end.max(0.0));
    (start, end)
}

fn source_is_silent(timeline: &Value, element: &Value) -> bool {
    element
        .get("srcId")
        .and_then(Value::as_str)
        .and_then(|id| timeline.pointer(&format!("/sources/{id}/hasAudio")))
        .and_then(Value::as_bool)
        == Some(false)
}

/// The intervals of sounding elements on one track (finished-picture clock, not merged); returns `None` if the track does not exist.
pub fn track_intervals(
    timeline: &Value,
    track_id: &str,
    exclude_element: &str,
    project_end: f64,
) -> Option<Vec<(f64, f64)>> {
    let track = timeline
        .get("tracks")
        .and_then(Value::as_array)?
        .iter()
        .find(|track| track.get("id").and_then(Value::as_str) == Some(track_id))?;
    if track.get("hidden").and_then(Value::as_bool) == Some(true)
        || track.get("muted").and_then(Value::as_bool) == Some(true)
    {
        return Some(Vec::new());
    }
    let mut out = Vec::new();
    for element in track
        .get("elements")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
    {
        if !matches!(
            element.get("kind").and_then(Value::as_str),
            Some("audio" | "video")
        ) || element.get("id").and_then(Value::as_str) == Some(exclude_element)
            || element.get("hidden").and_then(Value::as_bool) == Some(true)
            || element.get("muted").and_then(Value::as_bool) == Some(true)
            || source_is_silent(timeline, element)
        {
            continue;
        }
        let (start, end) = element_window(element, project_end);
        if end > start {
            out.push((start, end));
        }
    }
    Some(out)
}

/// Merged active intervals → polyline of the ducking gain (finished-picture clock). No active intervals returns an empty polyline (constant 1).
pub fn duck_curve(activity: &[(f64, f64)], duck: &Duck) -> Vec<[f64; 2]> {
    let floor = duck.floor_gain();
    let attack = duck.attack_seconds().max(DUCK_MIN_RAMP);
    let release = duck.release_seconds().max(DUCK_MIN_RAMP);
    let merged = merge_intervals(activity.to_vec(), DUCK_MERGE_GAP.max(attack + release));
    let mut out = Vec::with_capacity(merged.len() * 4);
    for (start, end) in merged {
        out.push([start - attack, 1.0]);
        out.push([start, floor]);
        out.push([end, floor]);
        out.push([end + release, 1.0]);
    }
    out
}

/// `volume` keyframes → volume polyline (element-local seconds). Linear segments take only the points at the keyframes; eased segments are baked at [`ENVELOPE_BAKE_STEP`]. With no effective keyframes, it is a single point at the static volume.
pub fn volume_curve(
    static_volume: f64,
    keyframes: Option<&Keyframes>,
    duration: f64,
) -> Vec<[f64; 2]> {
    let clamp = |value: f64| value.clamp(VOLUME_RANGE.0, VOLUME_RANGE.1);
    let frames = keyframes.and_then(|keyframes| keyframes.volume.as_deref());
    let mut out: Vec<[f64; 2]> = Vec::new();
    let mut previous: Option<(f64, f64)> = None;
    for frame in frames.into_iter().flatten() {
        let at = frame.t.local_seconds(duration);
        if matches!(frame.t, keyframes::KeyTime::Seconds(_)) && at > duration + 1e-9 {
            break;
        }
        let linear = frame.ease.as_deref().is_none_or(|ease| ease == "linear");
        if let Some((from_t, from_v)) = previous
            && !linear
            && at > from_t
        {
            let steps = ((at - from_t) / ENVELOPE_BAKE_STEP).ceil().max(1.0) as usize;
            for step in 1..steps {
                let local = from_t + (at - from_t) * step as f64 / steps as f64;
                let progress = (local - from_t) / (at - from_t);
                let eased = ::motion::curve::apply_ease(frame.ease.as_deref(), progress);
                out.push([local, clamp(from_v + (frame.v - from_v) * eased)]);
            }
        }
        out.push([at, clamp(frame.v)]);
        previous = Some((at, frame.v));
    }
    if out.is_empty() {
        out.push([0.0, clamp(static_volume)]);
    }
    out
}

fn curve_at(points: &[[f64; 2]], local: f64, empty: f64) -> f64 {
    if points.is_empty() {
        empty
    } else {
        GainEnvelope(points.to_vec()).at(local)
    }
}

/// Volume polyline × ducking polyline (already converted to local seconds) → envelope. Takes the union of the breakpoints of the two polylines (clamped to `[0, duration]`, including both ends), multiplies point by point, and removes middle points where three consecutive values are equal.
fn combine(volume: &[[f64; 2]], duck: &[[f64; 2]], duration: f64) -> GainEnvelope {
    let mut times: Vec<f64> = volume
        .iter()
        .chain(duck.iter())
        .map(|point| point[0])
        .filter(|time| *time > 0.0 && *time < duration)
        .collect();
    times.push(0.0);
    times.push(duration.max(0.0));
    times.sort_by(f64::total_cmp);
    times.dedup_by(|a, b| (*a - *b).abs() <= 1e-9);
    let mut points: Vec<[f64; 2]> = Vec::with_capacity(times.len());
    for time in times {
        let gain = curve_at(volume, time, 1.0) * curve_at(duck, time, 1.0);
        if points.len() >= 2 {
            let n = points.len();
            if points[n - 1][1] == gain && points[n - 2][1] == gain {
                points[n - 1][0] = time;
                continue;
            }
        }
        points.push([time, gain]);
    }
    GainEnvelope(points)
}

/// The element gain envelopes for the whole timeline.
///
/// - `timeline`: the raw timeline JSON (the `start/end` of elements in `tracks[]` are already in finished-picture seconds; it may carry `sources` to recognize sources with no audio track).
/// - `cues`: the array of cues projected onto the finished-picture clock (pass `null` or an empty array when there is no script).
/// - `project_end`: the end of open-ended elements (the finished-picture duration).
///
/// Only audio / video elements are processed; hidden or muted elements (or their track) produce no envelope.
pub fn element_gain_envelopes(timeline: &Value, cues: &Value, project_end: f64) -> AudioGainPlan {
    let mut plan = AudioGainPlan::default();
    let mut speech: Option<Vec<(f64, f64)>> = None;
    for track in timeline
        .get("tracks")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
    {
        if track.get("hidden").and_then(Value::as_bool) == Some(true)
            || track.get("muted").and_then(Value::as_bool) == Some(true)
        {
            continue;
        }
        for element in track
            .get("elements")
            .and_then(Value::as_array)
            .into_iter()
            .flatten()
        {
            if !matches!(
                element.get("kind").and_then(Value::as_str),
                Some("audio" | "video")
            ) || element.get("hidden").and_then(Value::as_bool) == Some(true)
                || element.get("muted").and_then(Value::as_bool) == Some(true)
            {
                continue;
            }
            let keyframes = keyframes::from_json(element.get("keyframes"))
                .filter(|keyframes| keyframes.volume.is_some());
            let duck = element
                .get("duck")
                .filter(|duck| duck.is_object())
                .and_then(|duck| serde_json::from_value::<Duck>(duck.clone()).ok());
            if keyframes.is_none() && duck.is_none() {
                continue;
            }
            let id = element
                .get("id")
                .and_then(Value::as_str)
                .unwrap_or_default()
                .to_owned();
            let (start, end) = element_window(element, project_end);
            let duration = (end - start).max(0.0);
            let static_volume = number(element.get("volume")).unwrap_or(1.0);
            let mut duck_points = Vec::new();
            if let Some(duck) = &duck {
                let activity = if duck.is_speech() {
                    let intervals = speech.get_or_insert_with(|| speech_intervals(cues));
                    if intervals.is_empty() {
                        plan.warnings.push(GainWarning {
                            element: id.clone(),
                            code: DUCK_NO_SPEECH.into(),
                            message: "没有带时间的文稿，按人声闪避不生效".into(),
                        });
                    }
                    intervals.clone()
                } else {
                    match track_intervals(timeline, &duck.under, &id, project_end) {
                        Some(intervals) => intervals,
                        None => {
                            plan.warnings.push(GainWarning {
                                element: id.clone(),
                                code: DUCK_TRACK_MISSING.into(),
                                message: format!("闪避依据的轨 {} 不存在，闪避不生效", duck.under),
                            });
                            Vec::new()
                        }
                    }
                };
                duck_points = duck_curve(&activity, duck)
                    .into_iter()
                    .map(|[time, gain]| [time - start, gain])
                    .collect();
            }
            if keyframes.is_none() && duck_points.is_empty() {
                continue;
            }
            let volume = volume_curve(static_volume, keyframes.as_ref(), duration);
            plan.envelopes
                .insert(id, combine(&volume, &duck_points, duration));
        }
    }
    plan
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn close(a: f64, b: f64) -> bool {
        (a - b).abs() < 1e-9
    }

    #[test]
    fn merge_joins_close_intervals() {
        let merged = merge_intervals(vec![(3.0, 4.0), (0.0, 1.0), (1.2, 2.0), (-1.0, -1.0)], 0.5);
        assert_eq!(merged, vec![(0.0, 2.0), (3.0, 4.0)]);
    }

    #[test]
    fn speech_duck_envelope_uses_word_times_and_defaults() {
        let timeline = json!({"tracks": [{"id": "music", "kind": "audio", "elements": [
            {"id": "bgm", "kind": "audio", "srcId": "m", "start": 1.0, "end": 11.0, "volume": 0.5,
             "duck": {"under": "speech"}}
        ]}]});
        let cues = json!([
            {"start": 2.0, "end": 4.0, "words": [{"t0": 2.0, "t1": 2.5}, {"t0": 2.6, "t1": 4.0}]},
            {"start": 8.0, "end": 9.0}
        ]);
        let plan = element_gain_envelopes(&timeline, &cues, 20.0);
        assert!(plan.warnings.is_empty());
        let envelope = &plan.envelopes["bgm"];
        let floor = keyframes::db_to_volume(-DUCK_DEPTH_DEFAULT);
        // Local seconds = finished-picture seconds - 1.
        assert!(close(envelope.at(0.0), 0.5));
        assert!(close(envelope.at(1.0), 0.5 * floor)); // Speech starts (finished picture 2.0)
        assert!(close(envelope.at(2.5), 0.5 * floor)); // Gaps between words merged
        assert!(close(envelope.at(3.0 + DUCK_RELEASE_DEFAULT), 0.5)); // Recovery complete
        assert!(close(envelope.at(7.5), 0.5 * floor));
        assert!(close(envelope.at(9.5), 0.5));
        let last = envelope.points().last().unwrap();
        assert!(close(last[0], 10.0));
    }

    #[test]
    fn speech_without_transcript_warns_and_emits_nothing() {
        let timeline = json!({"tracks": [{"id": "t", "kind": "audio", "elements": [
            {"id": "bgm", "kind": "audio", "srcId": "m", "duck": {"under": "speech"}}
        ]}]});
        let plan = element_gain_envelopes(&timeline, &Value::Null, 10.0);
        assert!(plan.envelopes.is_empty());
        assert_eq!(plan.warnings[0].code, DUCK_NO_SPEECH);
    }

    #[test]
    fn track_duck_ignores_muted_and_silent_elements() {
        let timeline = json!({
            "sources": {"quiet": {"kind": "video", "hasAudio": false}},
            "tracks": [
                {"id": "vo", "kind": "audio", "elements": [
                    {"id": "a", "kind": "audio", "srcId": "v", "start": 2.0, "end": 3.0},
                    {"id": "b", "kind": "audio", "srcId": "v", "start": 5.0, "end": 6.0, "muted": true},
                    {"id": "c", "kind": "video", "srcId": "quiet", "start": 7.0, "end": 8.0}
                ]},
                {"id": "music", "kind": "audio", "elements": [
                    {"id": "bgm", "kind": "audio", "srcId": "m", "start": 0.0, "end": 10.0,
                     "duck": {"under": "vo", "depth": 20, "attack": 0, "release": 0}}
                ]}
            ]
        });
        let plan = element_gain_envelopes(&timeline, &Value::Null, 10.0);
        let envelope = &plan.envelopes["bgm"];
        assert!(close(envelope.at(2.5), 0.1));
        assert!(close(envelope.at(5.5), 1.0));
        assert!(close(envelope.at(7.5), 1.0));
        assert!(close(envelope.at(1.0), 1.0));
    }

    #[test]
    fn volume_keyframes_without_duck_become_the_envelope() {
        let timeline = json!({"tracks": [{"id": "t", "kind": "audio", "elements": [
            {"id": "a", "kind": "audio", "srcId": "m", "start": 0.0, "end": 4.0,
             "keyframes": {"volume": [{"t": "0%", "v": 0.0}, {"t": "50%", "v": 1.0}, {"t": "100%", "v": 1.0, "ease": "easeInQuad"}]}},
            {"id": "plain", "kind": "audio", "srcId": "m", "volume": 0.3}
        ]}]});
        let plan = element_gain_envelopes(&timeline, &Value::Null, 4.0);
        assert!(!plan.envelopes.contains_key("plain"));
        let envelope = &plan.envelopes["a"];
        assert!(close(envelope.at(1.0), 0.5));
        assert!(close(envelope.at(3.0), 1.0));
        assert!(close(envelope.at(0.0), 0.0));
    }

    #[test]
    fn duck_validation_ranges() {
        let parse = |value: serde_json::Value| serde_json::from_value::<Duck>(value).unwrap();
        assert!(parse(json!({"under": "speech"})).validate("e").is_ok());
        assert!(
            parse(json!({"under": "speech", "depth": 61}))
                .validate("e")
                .is_err()
        );
        assert!(
            parse(json!({"under": "speech", "attack": -1}))
                .validate("e")
                .is_err()
        );
        assert!(parse(json!({"under": "none"})).validate("e").is_err());
        assert!(serde_json::from_value::<Duck>(json!({"depth": 3})).is_err());
    }
}
