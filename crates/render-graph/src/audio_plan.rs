//! The interval plan for sound (the audio export in architecture design §9.13): which sounds are in a sequence range, which segment of source material each one takes, where it sits on the timeline, and its gain and fades. It is the interval form of `voices` in [`plan_frame`](super::plan_frame): which instances sound, gain, fades and speed all follow the same rules (track mute and Solo, instance disable, `mix.muted`, the embedded-audio switch, the pre-rendered stand-in for compositions), except that instead of being evaluated per frame, it gives each instance's whole span within the range. Mixing is done by the backend according to the plan (ffmpeg at export time); nothing is decoded or mixed here.
//!
//! Ducking and the audio cross-fade of transitions use the same implementation: the ducking attenuation comes from [`DuckingEnvelope`] (which gives the breakpoints; the backend linearly interpolates between them), and the cross-fade window comes from [`transition_window`](super::transition_window). The curve is the same as in the per-frame plan (equal-power, linear progress). Within the window, sounds from the other side that lie outside its own interval take handles according to its time mapping; these form a separate segment (`handle`) that does not apply its own fade in/out.
//!
//! Volume envelopes (`mix.envelope`, `embeddedAudio.envelope`, the synthesized `audio.envelope`) replace the instance's `volume`, and are evaluated with the same method as the per-frame plan ([`VolumeCurve`]): for a segment with an envelope, `gain_db` is 0, and the volume is in the envelope's breakpoints (linear multiplier, linear between breakpoints, extended at both ends).
//!
//! Trade-offs consistent with the per-frame plan:
//! - Ducking rules triggered by the script (`trigger.kind = speech`) need the effective word stream, which the caller computes with [`speech_activity`] and passes to [`plan_audio_with_speech`]. When the word stream is empty there is no attenuation, and each instance that would have been attenuated reports one `DUCK_NO_SPEECH`. The preview passes the same word stream to the per-frame plan ([`plan_frame_with_speech`](super::plan_frame_with_speech)), so the attenuation at any given moment is identical on both sides;
//! - When the handles a cross-fade needs extend past the ends of the material, the part that extends past has no sound, and this is reported (`CROSSFADE_HANDLE_SHORT`);
//! - Instances in a freeze (`TimeMap::Hold`) get speed 0 in the per-frame plan, and the preview is silent at speed 0; here no interval is given, and this is likewise reported;
//! - When the material has no audio stream (for example a video without sound), there is nothing to mix and no interval is given; this is reported.

use std::collections::{BTreeMap, HashMap};

use editor_semantics::{MediaTime, Rate, Ratio, TimeMap, frame_time, map_time};
use serde::Serialize;
use serde_json::Value;
use video_model::{DocumentRecord, DurationPolicy, EnvelopePoint, Id, Revision, Sequence, TimelineItem, Track, VersionRef};

use super::{
    PlanError, TrackRules, VideoView, VoiceSource, audio_bounds, checked_fps, frame_start, source_rate, span_bounds, transition_window,
    volume_db,
};
use crate::ducking::DuckingEnvelope;
use crate::envelope::VolumeCurve;
use crate::text_plan::plan_text;

/// The sequence range `[start, end)` covered by the plan: exact value and seconds.
#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlanRange {
    pub start: MediaTime,
    pub end: MediaTime,
    pub start_seconds: f64,
    pub end_seconds: f64,
    pub duration_seconds: f64,
}

impl PlanRange {
    pub(crate) fn new(start: Ratio, end: Ratio) -> Result<PlanRange, PlanError> {
        let duration = end.checked_sub(start).ok_or_else(|| PlanError::overflow("range"))?;
        Ok(PlanRange {
            start: MediaTime::from_ratio(start, "range.start")?,
            end: MediaTime::from_ratio(end, "range.end")?,
            start_seconds: start.to_f64(),
            end_seconds: end.to_f64(),
            duration_seconds: duration.to_f64(),
        })
    }
}

/// Fade: the amplitude changes linearly within `[start, end)` (fade-in rises from 0 to 1, fade-out falls from 1 to 0). In seconds, relative to the start of the range; it may fall outside the interval
/// (when the interval has been clipped by the range, the fade is still computed at its original position).
#[derive(Clone, Copy, Debug, PartialEq, Serialize)]
pub struct AudioFade {
    pub start: f64,
    pub end: f64,
}

/// Which side of a cross-fade: the outgoing side is multiplied by cos(p·π/2), the incoming side by sin(p·π/2).
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum CrossfadeRole {
    Outgoing,
    Incoming,
}

/// Sound cross-fade of a transition (equal-power, format spec §3.9): p is the linear progress within `[start, end)` (no easing applied); before the window it is clamped to 0, and after it to 1.
/// In seconds, relative to the start of the range.
#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioCrossfade {
    pub transition_id: Id,
    pub role: CrossfadeRole,
    pub start: f64,
    pub end: f64,
}

impl AudioCrossfade {
    /// The amplitude coefficient at the moment `t` (seconds, relative to the start of the range).
    pub fn amplitude(&self, t: f64) -> f64 {
        let p = ((t - self.start) / (self.end - self.start)).clamp(0.0, 1.0);
        let angle = p * std::f64::consts::FRAC_PI_2;
        match self.role {
            CrossfadeRole::Outgoing => libm::cos(angle),
            CrossfadeRole::Incoming => libm::sin(angle),
        }
    }
}

/// The whole span during which an instance sounds within the range.
#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioSegment {
    pub item_id: Id,
    pub source: VoiceSource,
    pub asset: VersionRef,
    pub track_order: i64,
    /// Position in the output `[start, end)`, in seconds, relative to the start of the range.
    pub start: f64,
    pub end: f64,
    /// Which second of the material is taken at the moment `start`, and how many seconds of source time advance for each second of sequence time thereafter.
    pub source_start: f64,
    pub source_rate: f64,
    /// The instance's gain (excluding fades). When there is a volume envelope it is 0: the volume lives in `envelope`.
    pub gain_db: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fade_in: Option<AudioFade>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fade_out: Option<AudioFade>,
    /// The transition cross-fade this segment belongs to (one instance can be both the incoming side of one transition and the outgoing side of another).
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub crossfades: Vec<AudioCrossfade>,
    /// Breakpoints `[seconds, dB]` of the ducking attenuation (relative to the start of the range): linear between breakpoints, 0 before the first, and the last value is held after the last; when two
    /// breakpoints share the same moment, it is a step (the value on the left first, then the value on the right). Only the breakpoints needed to cover this segment are given; empty when there is no ducking. The attenuation is subtracted from the gain.
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub ducking: Vec<(f64, f64)>,
    /// Breakpoints `[seconds, linear multiplier]` of the volume envelope (relative to the start of the range): linear between breakpoints, the first breakpoint's value is used before it, and the last breakpoint's value after the last
    /// ([`envelope_at`]). Only the breakpoints needed to cover this segment are given; empty when there is no envelope. The envelope replaces the instance's volume and is multiplied into the gain.
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub envelope: Vec<(f64, f64)>,
    /// A segment taking handles outside the instance's own interval during a cross-fade: the instance's fade in/out is not applied.
    #[serde(skip_serializing_if = "std::ops::Not::not")]
    pub handle: bool,
}

impl AudioSegment {
    /// The gain at the moment `t` (seconds, relative to the start of the range): includes the instance's gain, volume envelope, fade in/out, cross-fade and ducking. It is the same quantity as `AudioVoice.gain_db` in the per-frame plan (tests check the two plans against it), and the amplitude likewise is not below -100 dB.
    pub fn gain_db_at(&self, t: f64) -> f64 {
        let mut fade: f64 = 1.0;
        if let Some(f) = self.fade_in {
            fade = fade.min(((t - f.start) / (f.end - f.start)).max(0.0));
        }
        if let Some(f) = self.fade_out {
            fade = fade.min(((f.end - t) / (f.end - f.start)).max(0.0));
        }
        let fade_db = if fade >= 1.0 { 0.0 } else { 20.0 * fade.max(1e-5).log10() };
        let crossfade: f64 = self.crossfades.iter().map(|c| 20.0 * libm::log10(c.amplitude(t).max(1e-5))).sum();
        let envelope = if self.envelope.is_empty() {
            0.0
        } else {
            volume_db(envelope_at(&self.envelope, t))
        };
        self.gain_db + envelope + fade_db + crossfade - knots_at(&self.ducking, t)
    }
}

/// The value of the volume envelope's breakpoints at `t` (see [`AudioSegment::envelope`]): same convention as `timeline::duck::GainEnvelope::at`.
/// It is 1 when there are no breakpoints.
pub fn envelope_at(knots: &[(f64, f64)], t: f64) -> f64 {
    let Some(&(t0, first)) = knots.first() else {
        return 1.0;
    };
    if t <= t0 {
        return first;
    }
    // The first breakpoint whose time is greater than t.
    let i = knots.partition_point(|&(at, _)| at <= t);
    let Some(&(t1, g1)) = knots.get(i) else {
        return knots[knots.len() - 1].1;
    };
    let (t0, g0) = knots[i - 1];
    if t1 - t0 <= 0.0 {
        return g1;
    }
    g0 + (g1 - g0) * ((t - t0) / (t1 - t0))
}

/// Linear interpolation between breakpoints (see [`AudioSegment::ducking`]).
pub fn knots_at(knots: &[(f64, f64)], t: f64) -> f64 {
    let Some(i) = knots.iter().rposition(|&(at, _)| at <= t) else {
        return 0.0;
    };
    match knots.get(i + 1) {
        Some(&(t1, v1)) if t1 > knots[i].0 => {
            let (t0, v0) = knots[i];
            v0 + (v1 - v0) * (t - t0) / (t1 - t0)
        }
        _ => knots[i].1,
    }
}

/// Things the plan did not carry out: freezes, material without an audio stream, ducking triggered by the script, and insufficient handles.
#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioPlanNote {
    pub code: String,
    pub item_id: Id,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioPlan {
    pub sequence_id: Id,
    pub sequence_revision: Revision,
    pub range: PlanRange,
    /// Sorted by track `order`, then by instance ID (same order as `voices` in the per-frame plan).
    pub segments: Vec<AudioSegment>,
    pub notes: Vec<AudioPlanNote>,
}

/// The exact length of the sequence: a fixed length is in frames; a derived length takes the end of all instances, with audio instances using their sample-level end (format spec §2.10; pure audio export does not inherit the frame padding of the visual tail).
pub fn sequence_end(sequence: &Sequence) -> Result<Ratio, PlanError> {
    let fps = checked_fps(sequence)?;
    if let DurationPolicy::Fixed { frames } = sequence.header.duration_policy {
        return frame_time(frames as i128, fps).ok_or_else(|| PlanError::overflow("durationPolicy.frames"));
    }
    let mut end = Ratio::ZERO;
    for item in &sequence.items {
        let item_end = match item {
            TimelineItem::Audio(audio) => audio_bounds(audio, fps)?.1,
            other => span_bounds(other.span().expect("non-audio items are on the frame grid"), fps)?.1,
        };
        end = end.max(item_end);
    }
    Ok(end)
}

/// Export range: when not given, the whole sequence. If the range end exceeds the sequence length, it is clipped to the sequence length; if it is empty after clipping, `EXPORT_RANGE_EMPTY` is reported.
pub fn resolve_range(sequence: &Sequence, range: Option<(Ratio, Ratio)>) -> Result<(Ratio, Ratio), PlanError> {
    let end_of_sequence = sequence_end(sequence)?;
    let (start, end) = range.unwrap_or((Ratio::ZERO, end_of_sequence));
    if start.is_negative() || end <= start {
        return Err(PlanError::new(
            "EXPORT_RANGE_EMPTY",
            "the export range is empty: the end must be greater than the start, and the start must not be negative",
        ));
    }
    let end = end.min(end_of_sequence);
    if end <= start {
        return Err(PlanError::new("EXPORT_RANGE_EMPTY", "the export range is outside the sequence, or the sequence is empty"));
    }
    Ok((start, end))
}

/// A sounding instance: the interval in which it sounds on the sequence, its source mapping, gain and fades.
struct Voice<'a> {
    item_id: &'a Id,
    source: VoiceSource,
    asset: &'a VersionRef,
    bounds: (Ratio, Ratio),
    time_map: &'a TimeMap,
    volume: f64,
    envelope: &'a [EnvelopePoint],
    fade_in: Option<&'a MediaTime>,
    fade_out: Option<&'a MediaTime>,
}

/// Intervals (seconds, counted from the start of the sequence) of the effective word stream (video format spec §5.7) on the sequence: the words of each transcript document (`cuccut.speech/1`) projected onto the sequence by [`plan_text`]; words that were trimmed away, frozen, or not on the timeline are excluded. Documents that cannot be projected onto the sequence are skipped. Ducking triggered by the script uses these as its trigger intervals (§3.9).
///
/// Transcripts on the source material clock are projected through the instances of the material that plays them (sorted by start, then by ID), not through caption instances: when a caption only displays one segment, speech in the remaining parts still triggers ducking.
pub fn speech_activity(
    video: VideoView<'_>,
    sequence_id: &str,
    documents: &[(&DocumentRecord, &Value)],
) -> Result<Vec<(f64, f64)>, PlanError> {
    let mut intervals = Vec::new();
    for_each_spoken_word(video, sequence_id, documents, |_, start, end| intervals.push((start, end)))?;
    intervals.sort_by(|a, b| a.0.total_cmp(&b.0).then(a.1.total_cmp(&b.1)));
    Ok(intervals)
}

/// The intervals (seconds, counted from the start of the sequence) during which each speaker talks on the sequence: words in the effective word stream (same as [`speech_activity`]) that carry a `speaker` are split by speaker, and each group is sorted by start time. Words without a speaker are not counted. A waveform's `speaker` (video format spec §3.7) follows this, and the preview and export use the same data.
pub fn speaker_activity(
    video: VideoView<'_>,
    sequence_id: &str,
    documents: &[(&DocumentRecord, &Value)],
) -> Result<BTreeMap<String, Vec<(f64, f64)>>, PlanError> {
    let mut speakers: BTreeMap<String, Vec<(f64, f64)>> = BTreeMap::new();
    for_each_spoken_word(video, sequence_id, documents, |speaker, start, end| {
        if let Some(speaker) = speaker {
            speakers.entry(speaker.to_owned()).or_default().push((start, end));
        }
    })?;
    for intervals in speakers.values_mut() {
        intervals.sort_by(|a, b| a.0.total_cmp(&b.0).then(a.1.total_cmp(&b.1)));
    }
    Ok(speakers)
}

/// Each word in the effective word stream: its speaker and its interval on the sequence (only given when `end > start`).
fn for_each_spoken_word(
    video: VideoView<'_>,
    sequence_id: &str,
    documents: &[(&DocumentRecord, &Value)],
    mut visit: impl FnMut(Option<&str>, f64, f64),
) -> Result<(), PlanError> {
    let sequence = video
        .sequences
        .get(sequence_id)
        .ok_or_else(|| PlanError::new("SEQUENCE_NOT_FOUND", format!("no sequence {sequence_id}")))?;
    let fps = checked_fps(sequence)?;
    for (document, body) in documents {
        if body.get("schema").and_then(Value::as_str) != Some("cuccut.speech/1") {
            continue;
        }
        let mut scope: Vec<(Ratio, &Id)> = Vec::new();
        if body.get("clock").and_then(Value::as_str) != Some("sequence") {
            let Some(asset_id) = &document.source_asset_id else {
                continue;
            };
            for item in &sequence.items {
                let start = match item {
                    TimelineItem::Video(v) if &v.asset_ref.id == asset_id => span_bounds(v.span, fps)?.0,
                    TimelineItem::Audio(a) if &a.asset_ref.id == asset_id => audio_bounds(a, fps)?.0,
                    _ => continue,
                };
                scope.push((start, &item.base().id));
            }
            if scope.is_empty() {
                continue;
            }
            scope.sort();
        }
        let scope: Vec<Id> = scope.into_iter().map(|(_, id)| id.clone()).collect();
        let plan = match plan_text(video, sequence_id, document, body, &scope, None) {
            Ok(plan) => plan,
            Err(error) if error.code == "EXPORT_SOURCE_UNPLACED" || error.code == "EXPORT_RANGE_EMPTY" => continue,
            Err(error) => return Err(error),
        };
        for entry in plan.entries.iter().filter(|e| e.end > e.start) {
            visit(entry.speaker.as_deref(), entry.start, entry.end);
        }
    }
    Ok(())
}

/// The sound of sequence `sequence_id` within `range` (sequence time); script-triggered ducking is treated as having no word stream (see [`plan_audio_with_speech`]).
pub fn plan_audio(video: VideoView<'_>, sequence_id: &str, range: Option<(Ratio, Ratio)>) -> Result<AudioPlan, PlanError> {
    plan_audio_with_speech(video, sequence_id, range, &[])
}

/// The sound of sequence `sequence_id` within `range` (sequence time). `speech` is the effective word stream intervals computed by [`speech_activity`].
pub fn plan_audio_with_speech(
    video: VideoView<'_>,
    sequence_id: &str,
    range: Option<(Ratio, Ratio)>,
    speech: &[(f64, f64)],
) -> Result<AudioPlan, PlanError> {
    let sequence = video
        .sequences
        .get(sequence_id)
        .ok_or_else(|| PlanError::new("SEQUENCE_NOT_FOUND", format!("no sequence {sequence_id}")))?;
    let fps = checked_fps(sequence)?;
    let (range_start, range_end) = resolve_range(sequence, range)?;
    let rules = TrackRules::new(&sequence.tracks);
    let tracks: HashMap<&str, &Track> = sequence.tracks.iter().map(|t| (t.id.as_str(), t)).collect();
    let items: HashMap<&str, &TimelineItem> = sequence.items.iter().map(|item| (item.base().id.as_str(), item)).collect();

    let mut segments: Vec<AudioSegment> = Vec::new();
    let mut notes: Vec<AudioPlanNote> = Vec::new();
    // Ducking triggered by the script: when the word stream is empty there is no attenuation, and `DUCK_NO_SPEECH` is reported.
    let speech_rules: Vec<_> = sequence
        .ducking
        .iter()
        .filter(|r| r.enabled && r.depth.is_finite() && r.depth > 0.0 && r.trigger.group().is_none())
        .collect();
    for item in &sequence.items {
        let base = item.base();
        let Some(track) = tracks.get(base.track_id.as_str()) else {
            continue;
        };
        if !base.enabled || !rules.audible(track) {
            continue;
        }
        let voice = match item {
            TimelineItem::Video(v) if v.embedded_audio.enabled => Voice {
                item_id: &v.base.id,
                source: VoiceSource::Embedded,
                asset: &v.asset_ref,
                bounds: span_bounds(v.span, fps)?,
                time_map: &v.time_map,
                volume: v.embedded_audio.volume,
                envelope: &v.embedded_audio.envelope,
                fade_in: v.embedded_audio.fade_in.as_ref(),
                fade_out: v.embedded_audio.fade_out.as_ref(),
            },
            TimelineItem::Audio(a) if !a.mix.muted => Voice {
                item_id: &a.base.id,
                source: VoiceSource::Audio,
                asset: &a.asset_ref,
                bounds: audio_bounds(a, fps)?,
                time_map: &a.time_map,
                volume: a.mix.volume,
                envelope: &a.mix.envelope,
                fade_in: a.mix.fade_in.as_ref(),
                fade_out: a.mix.fade_out.as_ref(),
            },
            TimelineItem::Composition(c) => {
                let (Some(prerender), Some(audio)) = (&c.prerender, c.audio.as_ref().filter(|a| a.enabled)) else {
                    continue;
                };
                Voice {
                    item_id: &c.base.id,
                    source: VoiceSource::Embedded,
                    asset: prerender,
                    bounds: span_bounds(c.span, fps)?,
                    time_map: &c.time_map,
                    volume: audio.volume,
                    envelope: &audio.envelope,
                    fade_in: audio.fade_in.as_ref(),
                    fade_out: audio.fade_out.as_ref(),
                }
            }
            _ => continue,
        };
        let (start, end) = voice.bounds;
        let clipped = (start.max(range_start), end.min(range_end));
        if clipped.1 <= clipped.0 {
            continue;
        }
        if speech.is_empty() && speech_rules.iter().any(|r| r.target.contains(&base.id, &base.track_id)) {
            notes.push(note("DUCK_NO_SPEECH", voice.item_id));
        }
        if matches!(voice.time_map, TimeMap::Hold { .. }) {
            notes.push(note("HOLD_IS_SILENT", voice.item_id));
            continue;
        }
        if !has_audio(&video, voice.asset) {
            notes.push(note("ASSET_HAS_NO_AUDIO", voice.item_id));
            continue;
        }
        let relative =
            |t: Ratio| -> Result<f64, PlanError> { Ok(t.checked_sub(range_start).ok_or_else(|| PlanError::overflow("t"))?.to_f64()) };
        let length = |fade: Option<&MediaTime>, field: &str| -> Result<Option<Ratio>, PlanError> {
            Ok(fade.map(|f| f.to_ratio(field)).transpose()?.filter(|l| *l > Ratio::ZERO))
        };
        let fade_in = match length(voice.fade_in, "fadeIn")? {
            Some(l) => Some(AudioFade {
                start: relative(start)?,
                end: relative(start.checked_add(l).ok_or_else(|| PlanError::overflow("fadeIn"))?)?,
            }),
            None => None,
        };
        let fade_out = match length(voice.fade_out, "fadeOut")? {
            Some(l) => Some(AudioFade {
                start: relative(end.checked_sub(l).ok_or_else(|| PlanError::overflow("fadeOut"))?)?,
                end: relative(end)?,
            }),
            None => None,
        };
        let (gain_db, envelope) = volume_plan(voice.volume, voice.envelope, (start, end), range_start, clipped)?;
        segments.push(AudioSegment {
            item_id: voice.item_id.clone(),
            source: voice.source,
            asset: voice.asset.clone(),
            track_order: track.order,
            start: relative(clipped.0)?,
            end: relative(clipped.1)?,
            source_start: map_time(voice.time_map, start, clipped.0)?.to_f64(),
            source_rate: source_rate(voice.time_map)?,
            gain_db,
            fade_in,
            fade_out,
            crossfades: Vec::new(),
            envelope,
            ducking: ducking_knots(sequence, item, fps, speech, range_start, clipped)?,
            handle: false,
        });
    }
    let context = Context {
        video: &video,
        sequence,
        items: &items,
        tracks: &tracks,
        rules: &rules,
        fps,
        speech,
        range: (range_start, range_end),
    };
    context.crossfade_segments(&mut segments, &mut notes)?;
    segments.sort_by(|a, b| a.track_order.cmp(&b.track_order).then_with(|| a.item_id.cmp(&b.item_id)));
    Ok(AudioPlan {
        sequence_id: sequence.id.clone(),
        sequence_revision: sequence.revision.clone(),
        range: PlanRange::new(range_start, range_end)?,
        segments,
        notes,
    })
}

fn has_audio(video: &VideoView<'_>, asset: &VersionRef) -> bool {
    video
        .assets
        .get(&asset.id)
        .and_then(|a| a.revisions.get(&asset.revision))
        .is_some_and(|revision| revision.audio.is_some())
}

/// How the instance's volume is given for the segment `[start, end)` (sequence time): without an envelope it is the `volume` converted to dB with empty breakpoints; with an envelope the gain is 0 dB, and the breakpoints are those from the envelope's baked polyline that cover this segment, converted to seconds relative to the start of the range. `bounds` is the instance's own interval (the envelope's local clock and percentages are computed against it).
fn volume_plan(
    volume: f64,
    points: &[EnvelopePoint],
    bounds: (Ratio, Ratio),
    range_start: Ratio,
    (start, end): (Ratio, Ratio),
) -> Result<(f64, Vec<(f64, f64)>), PlanError> {
    let since = |t: Ratio| -> Result<f64, PlanError> { Ok(t.checked_sub(range_start).ok_or_else(|| PlanError::overflow("t"))?.to_f64()) };
    let duration = bounds
        .1
        .checked_sub(bounds.0)
        .ok_or_else(|| PlanError::overflow("duration"))?
        .to_f64();
    let curve = match VolumeCurve::new(volume, points, duration) {
        VolumeCurve::Constant(volume) => return Ok((volume_db(volume), Vec::new())),
        VolumeCurve::Envelope(curve) => curve,
    };
    let origin = since(bounds.0)?;
    let knots: Vec<(f64, f64)> = curve.points().iter().map(|&[t, g]| (origin + t, g)).collect();
    let (start, end) = (since(start)?, since(end)?);
    // From the last breakpoint at or before `start` to the first breakpoint at or after `end`; extended at both ends, and when the segment lies outside the polyline only one breakpoint is kept.
    let first = knots.iter().rposition(|&(t, _)| t <= start).unwrap_or(0);
    let last = knots.iter().position(|&(t, _)| t >= end).unwrap_or(knots.len() - 1);
    Ok((0.0, knots[first..=last.max(first)].to_vec()))
}

/// The ducking the instance receives within `[start, end)` (sequence time): only the breakpoints needed to cover this segment are kept, converted to seconds relative to the start of the range.
fn ducking_knots(
    sequence: &Sequence,
    item: &TimelineItem,
    fps: Rate,
    speech: &[(f64, f64)],
    range_start: Ratio,
    (start, end): (Ratio, Ratio),
) -> Result<Vec<(f64, f64)>, PlanError> {
    if sequence.ducking.is_empty() {
        return Ok(Vec::new());
    }
    let knots = DuckingEnvelope::for_item_with_speech(sequence, item, fps, Some(speech))?.knots();
    if knots.is_empty() {
        return Ok(Vec::new());
    }
    let (start, end, origin) = (start.to_f64(), end.to_f64(), range_start.to_f64());
    // From the last breakpoint at or before `start` to the first breakpoint at or after `end`; when the segment is outside the envelope there is no attenuation.
    let first = knots.iter().rposition(|&(t, _)| t <= start).unwrap_or(0);
    let last = knots.iter().position(|&(t, _)| t >= end).unwrap_or(knots.len() - 1);
    let slice = &knots[first..=last.max(first)];
    if slice.iter().all(|&(_, db)| db == 0.0) {
        return Ok(Vec::new());
    }
    Ok(slice.iter().map(|&(t, db)| (t - origin, db)).collect())
}

/// The sequence context needed when computing cross-fade segments.
struct Context<'a, 'v> {
    video: &'a VideoView<'v>,
    sequence: &'a Sequence,
    items: &'a HashMap<&'a str, &'a TimelineItem>,
    tracks: &'a HashMap<&'a str, &'a Track>,
    rules: &'a TrackRules,
    fps: Rate,
    speech: &'a [(f64, f64)],
    range: (Ratio, Ratio),
}

impl Context<'_, '_> {
    fn relative(&self, t: Ratio) -> Result<f64, PlanError> {
        Ok(t.checked_sub(self.range.0).ok_or_else(|| PlanError::overflow("t"))?.to_f64())
    }

    /// Two-sided transitions with `audioCrossfade` (`crossfade_voices` in the per-frame plan): each side's own segment carries the curve; the part of the window outside the instance's interval starts a separate segment, taking handles according to the instance's time mapping. Cross-fading only happens when both sides are enabled and the track sounds; when one side has its own sound turned off, that side has no sound.
    fn crossfade_segments(&self, segments: &mut Vec<AudioSegment>, notes: &mut Vec<AudioPlanNote>) -> Result<(), PlanError> {
        for tr in self.sequence.transitions.iter().filter(|tr| tr.audio_crossfade) {
            let Some((Some(TimelineItem::Video(left)), Some(TimelineItem::Video(right)), start, end)) = transition_window(self.items, tr)
            else {
                continue;
            };
            if !left.base.enabled || !right.base.enabled {
                continue;
            }
            let Some(track) = self.tracks.get(left.base.track_id.as_str()) else {
                continue;
            };
            if !self.rules.audible(track) {
                continue;
            }
            let frame = |n: i64| frame_time(n as i128, self.fps).ok_or_else(|| PlanError::overflow("transition"));
            let (from, to, cut) = (frame(start)?, frame(end)?, frame(left.span.end_frame())?);
            for (side, role) in [(left, CrossfadeRole::Outgoing), (right, CrossfadeRole::Incoming)] {
                let curve = AudioCrossfade {
                    transition_id: tr.id.clone(),
                    role,
                    start: self.relative(from)?,
                    end: self.relative(to)?,
                };
                if let Some(own) = segments
                    .iter_mut()
                    .find(|s| !s.handle && s.item_id == side.base.id && s.source == VoiceSource::Embedded)
                {
                    own.crossfades.push(curve.clone());
                }
                if !side.embedded_audio.enabled || matches!(side.time_map, TimeMap::Hold { .. }) || !has_audio(self.video, &side.asset_ref)
                {
                    continue;
                }
                // The part of the window outside the instance's own interval: for the outgoing side it lies after the cut point; for the incoming side it lies before the cut point.
                let (lo, hi) = match role {
                    CrossfadeRole::Outgoing => (cut.max(from), to),
                    CrossfadeRole::Incoming => (from, cut.min(to)),
                };
                let (lo, hi) = (lo.max(self.range.0), hi.min(self.range.1));
                if hi <= lo {
                    continue;
                }
                if let Some(segment) = self.handle(side, track.order, curve, (lo, hi), notes)? {
                    segments.push(segment);
                }
            }
        }
        Ok(())
    }

    /// Handles on one side outside its own interval: there is no sound before the start of the material or after its end (the segment starts at source second 0; silence after the end is padded by the backend), and this is reported.
    fn handle(
        &self,
        side: &video_model::VideoItem,
        track_order: i64,
        curve: AudioCrossfade,
        (lo, hi): (Ratio, Ratio),
        notes: &mut Vec<AudioPlanNote>,
    ) -> Result<Option<AudioSegment>, PlanError> {
        let item_start = frame_start(side.span, self.fps)?;
        let rate = source_rate(&side.time_map)?;
        let (mut start, end) = (self.relative(lo)?, self.relative(hi)?);
        let mut source_start = map_time(&side.time_map, item_start, lo)?.to_f64();
        let mut short = false;
        if source_start < 0.0 {
            short = true;
            if rate <= 0.0 {
                notes.push(note("CROSSFADE_HANDLE_SHORT", &side.base.id));
                return Ok(None);
            }
            start -= source_start / rate;
            source_start = 0.0;
        }
        let duration = self
            .video
            .assets
            .get(&side.asset_ref.id)
            .and_then(|a| a.revisions.get(&side.asset_ref.revision))
            .and_then(|r| r.duration.as_ref())
            .map(|d| d.to_ratio("duration"))
            .transpose()?
            .map(Ratio::to_f64);
        if duration.is_some_and(|d| source_start + (end - start) * rate > d + 1e-9) {
            short = true;
        }
        if short {
            notes.push(note("CROSSFADE_HANDLE_SHORT", &side.base.id));
        }
        if end <= start {
            return Ok(None);
        }
        let item = self.items[side.base.id.as_str()];
        let audio = &side.embedded_audio;
        let (gain_db, envelope) = volume_plan(
            audio.volume,
            &audio.envelope,
            span_bounds(side.span, self.fps)?,
            self.range.0,
            (lo, hi),
        )?;
        Ok(Some(AudioSegment {
            item_id: side.base.id.clone(),
            source: VoiceSource::Embedded,
            asset: side.asset_ref.clone(),
            track_order,
            start,
            end,
            source_start,
            source_rate: rate,
            gain_db,
            fade_in: None,
            fade_out: None,
            crossfades: vec![curve],
            envelope,
            ducking: ducking_knots(self.sequence, item, self.fps, self.speech, self.range.0, (lo, hi))?,
            handle: true,
        }))
    }
}

fn note(code: &str, item_id: &Id) -> AudioPlanNote {
    AudioPlanNote {
        code: code.into(),
        item_id: item_id.clone(),
    }
}
