use std::collections::BTreeMap;

use crate::cuts::{CutSet, SeamBias};
use crate::schema::{Clip, TimelineDocument, TimelineError};

const EPSILON: f64 = 1e-9;

/// A projected clip segment.
///
/// **The serde shape is the external wire format** (camelCase): `apps/cli`'s `studio_timeline_projection` sends the same table to studio, and studio feeds it back unchanged into the `loadTimeline` envelope of `ccut-wasm` (design §13 P6b “projection wiring”). Once a field name changes, that loop fails immediately on `deny_unknown_fields`.
#[derive(Debug, Clone, Copy, PartialEq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ClipSegment {
    pub source_start: f64,
    pub source_end: f64,
    pub timeline_start: f64,
    pub timeline_end: f64,
}

/// A single projected clip. Its serde shape is the same as [`ClipSegment`].
#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ClipProjection {
    pub id: String,
    pub src_id: String,
    pub source_in: f64,
    pub source_out: f64,
    pub rate: f64,
    pub view_in: f64,
    pub view_out: f64,
    pub timeline_start: f64,
    pub timeline_end: f64,
    pub segments: Vec<ClipSegment>,
}

/// One source-clock sample resolved inside its arranged clip. `seek_source`
/// opens the following kept segment after a cut; `clip_ended` asks the host to
/// advance to the next arranged clip.
#[derive(Debug, Clone, PartialEq)]
pub struct PlaybackStep {
    pub timeline_time: f64,
    pub seek_source: Option<f64>,
    pub src_id: String,
    pub clip_id: String,
    pub clip_ended: bool,
}

/// First playable source frame of an arranged clip.
#[derive(Debug, Clone, PartialEq)]
pub struct SourcePosition {
    pub src_id: String,
    pub source_time: f64,
    pub clip_id: String,
}

/// One OUTPUT instant resolved inside its arranged clip. Borrowed from the
/// projection because the playback loop only needs the ids to drive
/// [`TimelineProjection::playback_step`].
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct TimelinePosition<'a> {
    pub clip_id: &'a str,
    pub src_id: &'a str,
    /// Source-clock instant played at `timeline_time`.
    pub source_time: f64,
    pub rate: f64,
    /// The requested OUTPUT instant, clamped to `[0, duration]`.
    pub timeline_time: f64,
}

impl ClipProjection {
    pub fn duration(&self) -> f64 {
        self.timeline_end - self.timeline_start
    }

    pub fn contains_source_time(&self, source_time: f64) -> bool {
        let index = self
            .segments
            .partition_point(|segment| segment.source_end <= source_time);
        self.segments.get(index).is_some_and(|segment| {
            source_time >= segment.source_start && source_time < segment.source_end
        }) || self
            .segments
            .last()
            .is_some_and(|segment| source_time == segment.source_end)
    }

    pub fn source_to_timeline(&self, source_time: f64) -> Option<f64> {
        let index = self
            .segments
            .partition_point(|segment| segment.source_end <= source_time);
        if let Some(segment) = self.segments.get(index)
            && source_time >= segment.source_start
            && source_time < segment.source_end
        {
            return Some(segment.timeline_start + (source_time - segment.source_start) / self.rate);
        }
        self.segments
            .last()
            .filter(|segment| source_time == segment.source_end)
            .map(|segment| segment.timeline_end)
    }
}

/// Output time → `(source id, source media time)`, **given only a projected clip table**.
///
/// [`TimelineProjection::timeline_to_source`] is a thin wrapper around it, so the two cannot diverge. It is exposed separately for **hosts that hold only the clip table and no `CutSet`**: the browser preview (`ccut-wasm`)'s projection is the table studio fed back unchanged from the one the server computed, and rebuilding a `CutSet` has neither input (source durations are probed by the host) nor purpose (the mapping itself reads no cut at all).
///
/// `duration` must be the `timeline_end` of the table's last segment. The one in `TimelineProjection` is derived that way (`timeline_cursor` in `build`).
pub fn clips_timeline_to_source(
    clips: &[ClipProjection],
    duration: f64,
    timeline_time: f64,
    bias: SeamBias,
) -> Option<(&str, f64)> {
    clips_timeline_to_position(clips, duration, timeline_time, bias)
        .map(|position| (position.src_id, position.source_time))
}

/// The full form of [`clips_timeline_to_source`]: it also reports **which clip is playing**.
///
/// The mapping itself is the same code as `clips_timeline_to_source` (the latter is a thin projection of this), so the two cannot diverge. It exists separately because the host's playback loop needs clip identity: the input to [`TimelineProjection::playback_step`] is a clip id, and without it the host would have to re-implement the seam decision on its own side. The Swift (`TimelineMapProjection.timelineToSource`) and JS (`skills/cuccut/templates/studio/timeline-mapping.js`) twin implementations have always returned `clipId`; this brings the Rust version up to the same shape.
pub fn clips_timeline_to_position(
    clips: &[ClipProjection],
    duration: f64,
    timeline_time: f64,
    bias: SeamBias,
) -> Option<TimelinePosition<'_>> {
    if !timeline_time.is_finite() || clips.is_empty() {
        return None;
    }
    let timeline_time = timeline_time.clamp(0.0, duration);
    let clip_index = clips.partition_point(|clip| {
        clip.timeline_end < timeline_time
            || (bias == SeamBias::Following && clip.timeline_end == timeline_time)
    });
    let clip = clips.get(clip_index).or_else(|| clips.last())?;
    let segment_index = clip.segments.partition_point(|segment| {
        segment.timeline_end < timeline_time
            || (bias == SeamBias::Following && segment.timeline_end == timeline_time)
    });
    let segment = clip
        .segments
        .get(segment_index)
        .or_else(|| clip.segments.last())?;
    let source_time = if timeline_time <= segment.timeline_start {
        segment.source_start
    } else if timeline_time >= segment.timeline_end {
        segment.source_end
    } else {
        segment.source_start + (timeline_time - segment.timeline_start) * clip.rate
    };
    Some(TimelinePosition {
        clip_id: &clip.id,
        src_id: &clip.src_id,
        source_time,
        rate: clip.rate,
        timeline_time,
    })
}

#[derive(Debug, Clone, PartialEq)]
pub struct TimelineProjection {
    sources: BTreeMap<String, CutSet>,
    clips: Vec<ClipProjection>,
    duration: f64,
}

impl TimelineProjection {
    /// `source_durations` is host-probed metadata. The main duration always comes from
    /// project media metadata and therefore must be supplied here, never in timeline.json.
    pub fn build(
        document: &TimelineDocument,
        source_durations: &BTreeMap<String, f64>,
    ) -> Result<Self, TimelineError> {
        document.validate()?;

        let mut sources = BTreeMap::new();
        let mut source_ids = source_durations.keys().cloned().collect::<Vec<_>>();
        source_ids.extend(document.sources.keys().cloned());
        source_ids.sort();
        source_ids.dedup();
        for source_id in source_ids {
            let source = document.sources.get(&source_id);
            let duration = source_durations
                .get(&source_id)
                .copied()
                .or_else(|| source.and_then(|value| value.duration))
                .ok_or_else(|| TimelineError::MissingSource(source_id.clone()))?;
            let cuts = source.map_or_else(Vec::new, |value| value.cuts.clone());
            sources.insert(source_id, CutSet::new(duration, cuts)?);
        }

        let clips = if document.clips.is_empty() {
            let main = sources
                .get("main")
                .ok_or_else(|| TimelineError::MissingSource("main".to_owned()))?;
            if main.duration() == 0.0 {
                Vec::new()
            } else {
                vec![Clip {
                    id: "c1".to_owned(),
                    src_id: "main".to_owned(),
                    in_time: 0.0,
                    out: main.duration(),
                    rate: 1.0,
                }]
            }
        } else {
            document.clips.clone()
        };

        let mut timeline_cursor = 0.0;
        let mut projections = Vec::with_capacity(clips.len());
        for clip in clips {
            let source = sources
                .get(&clip.src_id)
                .ok_or_else(|| TimelineError::MissingSource(clip.src_id.clone()))?;
            if clip.out > source.duration() + EPSILON {
                return Err(TimelineError::Invalid(format!(
                    "clip {} exceeds the duration of source {}",
                    clip.id, clip.src_id
                )));
            }
            let kept = source.kept_intersections(clip.in_time, clip.out, 0.0);
            if kept.is_empty() {
                return Err(TimelineError::EmptyClip(clip.id));
            }
            let view_in = source.view_time_at_seam(clip.in_time);
            let view_out = source.view_time_at_seam(clip.out);
            let mut segment_cursor = timeline_cursor;
            let mut segments = Vec::with_capacity(kept.len());
            for (source_start, source_end) in kept {
                let timeline_end = segment_cursor + (source_end - source_start) / clip.rate;
                segments.push(ClipSegment {
                    source_start,
                    source_end,
                    timeline_start: segment_cursor,
                    timeline_end,
                });
                segment_cursor = timeline_end;
            }
            if segment_cursor - timeline_cursor <= EPSILON {
                return Err(TimelineError::EmptyClip(clip.id));
            }
            projections.push(ClipProjection {
                id: clip.id,
                src_id: clip.src_id,
                source_in: clip.in_time,
                source_out: clip.out,
                rate: clip.rate,
                view_in,
                view_out,
                timeline_start: timeline_cursor,
                timeline_end: segment_cursor,
                segments,
            });
            timeline_cursor = segment_cursor;
        }

        Ok(Self {
            sources,
            clips: projections,
            duration: timeline_cursor,
        })
    }

    pub fn duration(&self) -> f64 {
        self.duration
    }

    pub fn sources(&self) -> &BTreeMap<String, CutSet> {
        &self.sources
    }

    pub fn clips(&self) -> &[ClipProjection] {
        &self.clips
    }

    pub fn source(&self, id: &str) -> Option<&CutSet> {
        self.sources.get(id)
    }

    /// Returns all placements in declaration order. A source interval may be reused.
    pub fn source_to_timeline(&self, src_id: &str, source_time: f64) -> Vec<f64> {
        self.clips
            .iter()
            .filter(|clip| clip.src_id == src_id)
            .filter_map(|clip| clip.source_to_timeline(source_time))
            .collect()
    }

    pub fn timeline_to_source(&self, timeline_time: f64, bias: SeamBias) -> Option<(&str, f64)> {
        clips_timeline_to_source(&self.clips, self.duration, timeline_time, bias)
    }

    /// [`Self::timeline_to_source`] plus the clip identity the playback loop
    /// needs to call [`Self::playback_step`].
    pub fn timeline_to_position(
        &self,
        timeline_time: f64,
        bias: SeamBias,
    ) -> Option<TimelinePosition<'_>> {
        clips_timeline_to_position(&self.clips, self.duration, timeline_time, bias)
    }

    /// Maps a native player's source clock back to OUTPUT time while preserving
    /// clip identity. A sample inside a removed interval seeks to the following
    /// kept segment; passing the final segment marks the clip complete.
    pub fn playback_step(
        &self,
        clip_id: &str,
        source_time: f64,
        tolerance: f64,
    ) -> Option<PlaybackStep> {
        if !source_time.is_finite() {
            return None;
        }
        let clip = self.clips.iter().find(|clip| clip.id == clip_id)?;
        let tolerance = tolerance.max(0.0);
        for (index, segment) in clip.segments.iter().enumerate() {
            if source_time < segment.source_start - tolerance {
                return Some(PlaybackStep {
                    timeline_time: segment.timeline_start,
                    seek_source: Some(segment.source_start),
                    src_id: clip.src_id.clone(),
                    clip_id: clip.id.clone(),
                    clip_ended: false,
                });
            }
            if source_time < segment.source_end - tolerance {
                return Some(PlaybackStep {
                    timeline_time: segment.timeline_start
                        + (source_time.max(segment.source_start) - segment.source_start)
                            / clip.rate,
                    seek_source: None,
                    src_id: clip.src_id.clone(),
                    clip_id: clip.id.clone(),
                    clip_ended: false,
                });
            }
            if let Some(following) = clip.segments.get(index + 1)
                && source_time < following.source_start - tolerance
            {
                return Some(PlaybackStep {
                    timeline_time: following.timeline_start,
                    seek_source: Some(following.source_start),
                    src_id: clip.src_id.clone(),
                    clip_id: clip.id.clone(),
                    clip_ended: false,
                });
            }
        }
        Some(PlaybackStep {
            timeline_time: clip.timeline_end,
            seek_source: None,
            src_id: clip.src_id.clone(),
            clip_id: clip.id.clone(),
            clip_ended: true,
        })
    }

    /// First source frame of the clip arranged immediately after `clip_id`.
    pub fn next_position(&self, clip_id: &str) -> Option<SourcePosition> {
        let index = self.clips.iter().position(|clip| clip.id == clip_id)?;
        let clip = self.clips.get(index + 1)?;
        let segment = clip.segments.first()?;
        Some(SourcePosition {
            src_id: clip.src_id.clone(),
            source_time: segment.source_start,
            clip_id: clip.id.clone(),
        })
    }

    pub fn resolve_unique_source_time(
        &self,
        src_id: &str,
        source_time: f64,
        label: &str,
    ) -> Result<f64, TimelineError> {
        let matches = self.source_to_timeline(src_id, source_time);
        match matches.as_slice() {
            [] => Err(TimelineError::Unmapped(label.to_owned())),
            [time] => Ok(*time),
            _ => Err(TimelineError::Ambiguous(label.to_owned())),
        }
    }
}

pub fn materialize_implicit_clip(
    document: &mut TimelineDocument,
    source_durations: &BTreeMap<String, f64>,
) -> Result<bool, TimelineError> {
    if !document.clips.is_empty() {
        return Ok(false);
    }
    let duration = source_durations
        .get("main")
        .copied()
        .ok_or_else(|| TimelineError::MissingSource("main".to_owned()))?;
    if duration == 0.0 {
        return Ok(false);
    }
    document.clips.push(Clip {
        id: "c1".to_owned(),
        src_id: "main".to_owned(),
        in_time: 0.0,
        out: duration,
        rate: 1.0,
    });
    Ok(true)
}

pub fn add_clip(
    document: &mut TimelineDocument,
    source_durations: &BTreeMap<String, f64>,
    id: String,
    src_id: String,
    view_in: Option<f64>,
    view_out: Option<f64>,
    before: Option<&str>,
    after: Option<&str>,
) -> Result<usize, TimelineError> {
    if before.is_some() && after.is_some() {
        return Err(TimelineError::Invalid(
            "before and after cannot be specified together".to_owned(),
        ));
    }
    materialize_implicit_clip(document, source_durations)?;
    let projection = TimelineProjection::build(document, source_durations)?;
    let source = projection
        .source(&src_id)
        .ok_or_else(|| TimelineError::MissingSource(src_id.clone()))?;
    let view_in = view_in.unwrap_or(0.0);
    let view_out = view_out.unwrap_or_else(|| source.view_duration());
    if !view_in.is_finite()
        || !view_out.is_finite()
        || view_in < 0.0
        || view_out > source.view_duration()
        || view_out <= view_in
    {
        return Err(TimelineError::Invalid(format!("clip {id} has an invalid view range")));
    }
    let in_time = source.source_time(view_in, SeamBias::Following);
    let out = source.source_time(view_out, SeamBias::Preceding);
    let index = if let Some(target) = before {
        document
            .clips
            .iter()
            .position(|clip| clip.id == target)
            .ok_or_else(|| TimelineError::Invalid(format!("clip does not exist: {target}")))?
    } else if let Some(target) = after {
        document
            .clips
            .iter()
            .position(|clip| clip.id == target)
            .map(|index| index + 1)
            .ok_or_else(|| TimelineError::Invalid(format!("clip does not exist: {target}")))?
    } else {
        document.clips.len()
    };
    document.clips.insert(
        index,
        Clip {
            id,
            src_id,
            in_time,
            out,
            rate: 1.0,
        },
    );
    TimelineProjection::build(document, source_durations)?;
    Ok(index)
}

/// Split the main-track clip under `timeline_time`. Only the clock changes here;
/// the caller runs [`crate::follow::follow_clock`] with [`crate::ClockEdit::Split`]
/// in the same edit so every element straddling the seam is split too.
pub fn split_clip(
    document: &mut TimelineDocument,
    source_durations: &BTreeMap<String, f64>,
    timeline_time: f64,
    right_id: String,
) -> Result<(String, String), TimelineError> {
    materialize_implicit_clip(document, source_durations)?;
    let projection = TimelineProjection::build(document, source_durations)?;
    let projected = projection
        .clips()
        .iter()
        .find(|clip| {
            timeline_time > clip.timeline_start + EPSILON
                && timeline_time < clip.timeline_end - EPSILON
        })
        .ok_or_else(|| TimelineError::Invalid("split point is not inside the clip".to_owned()))?;
    let index = document
        .clips
        .iter()
        .position(|clip| clip.id == projected.id)
        .expect("projection clip comes from document");
    let (_, left_out) = projection
        .timeline_to_source(timeline_time, SeamBias::Preceding)
        .ok_or_else(|| TimelineError::Invalid("split point cannot be mapped to the source".to_owned()))?;
    let (_, right_in) = projection
        .timeline_to_source(timeline_time, SeamBias::Following)
        .ok_or_else(|| TimelineError::Invalid("split point cannot be mapped to the source".to_owned()))?;
    let left_id = document.clips[index].id.clone();
    let mut right = document.clips[index].clone();
    document.clips[index].out = left_out;
    right.id = right_id.clone();
    right.in_time = right_in;
    document.clips.insert(index + 1, right);
    TimelineProjection::build(document, source_durations)?;
    Ok((left_id, right_id))
}

pub fn trim_clip(
    document: &mut TimelineDocument,
    source_durations: &BTreeMap<String, f64>,
    clip_id: &str,
    view_in: Option<f64>,
    view_out: Option<f64>,
) -> Result<(), TimelineError> {
    materialize_implicit_clip(document, source_durations)?;
    let projection = TimelineProjection::build(document, source_durations)?;
    let index = document
        .clips
        .iter()
        .position(|clip| clip.id == clip_id)
        .ok_or_else(|| TimelineError::Invalid(format!("clip does not exist: {clip_id}")))?;
    let source = projection
        .source(&document.clips[index].src_id)
        .expect("validated clip source");
    let in_time = view_in
        .map(|value| source.source_time(value, SeamBias::Following))
        .unwrap_or(document.clips[index].in_time);
    let out = view_out
        .map(|value| source.source_time(value, SeamBias::Preceding))
        .unwrap_or(document.clips[index].out);
    if in_time >= out {
        return Err(TimelineError::Invalid(format!(
            "clip {clip_id} is empty after trim"
        )));
    }
    document.clips[index].in_time = in_time;
    document.clips[index].out = out;
    TimelineProjection::build(document, source_durations)?;
    Ok(())
}

pub fn set_clip_rate(
    document: &mut TimelineDocument,
    source_durations: &BTreeMap<String, f64>,
    clip_id: &str,
    rate: f64,
) -> Result<(), TimelineError> {
    if !rate.is_finite() || rate <= 0.0 {
        return Err(TimelineError::Invalid(
            "clip rate must be a finite positive number".to_owned(),
        ));
    }
    materialize_implicit_clip(document, source_durations)?;
    let clip = document
        .clips
        .iter_mut()
        .find(|clip| clip.id == clip_id)
        .ok_or_else(|| TimelineError::Invalid(format!("clip does not exist: {clip_id}")))?;
    clip.rate = rate;
    TimelineProjection::build(document, source_durations)?;
    Ok(())
}

pub fn move_clip(
    document: &mut TimelineDocument,
    clip_id: &str,
    before: Option<&str>,
    after: Option<&str>,
    to: Option<usize>,
) -> Result<usize, TimelineError> {
    let selector_count =
        usize::from(before.is_some()) + usize::from(after.is_some()) + usize::from(to.is_some());
    if selector_count != 1 {
        return Err(TimelineError::Invalid(
            "move must specify exactly one of before, after or to".to_owned(),
        ));
    }
    let from = document
        .clips
        .iter()
        .position(|clip| clip.id == clip_id)
        .ok_or_else(|| TimelineError::Invalid(format!("clip does not exist: {clip_id}")))?;
    let clip = document.clips.remove(from);
    let insertion = if let Some(target) = before {
        document
            .clips
            .iter()
            .position(|clip| clip.id == target)
            .ok_or_else(|| TimelineError::Invalid(format!("clip does not exist: {target}")))?
    } else if let Some(target) = after {
        document
            .clips
            .iter()
            .position(|clip| clip.id == target)
            .map(|index| index + 1)
            .ok_or_else(|| TimelineError::Invalid(format!("clip does not exist: {target}")))?
    } else {
        to.expect("selector count checked")
            .min(document.clips.len())
    };
    document.clips.insert(insertion, clip);
    Ok(insertion)
}

pub fn remove_clips(
    document: &mut TimelineDocument,
    source_durations: &BTreeMap<String, f64>,
    clip_ids: &[String],
) -> Result<Vec<String>, TimelineError> {
    if document.clips.is_empty() {
        return Err(TimelineError::Invalid(
            "the implicit main clip cannot be deleted directly; run clip split/add to materialize the timeline first".to_owned(),
        ));
    }
    for clip_id in clip_ids {
        if !document.clips.iter().any(|clip| &clip.id == clip_id) {
            return Err(TimelineError::Invalid(format!("clip does not exist: {clip_id}")));
        }
    }
    let retained = document
        .clips
        .iter()
        .filter(|clip| !clip_ids.contains(&clip.id))
        .count();
    if retained == 0 {
        return Err(TimelineError::Invalid(
            "cannot delete the last clip (an empty clips list means the implicit main clip)".to_owned(),
        ));
    }
    let removed = document
        .clips
        .iter()
        .filter(|clip| clip_ids.contains(&clip.id))
        .map(|clip| clip.id.clone())
        .collect::<Vec<_>>();
    document.clips.retain(|clip| !clip_ids.contains(&clip.id));
    TimelineProjection::build(document, source_durations)?;
    Ok(removed)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::schema::{Cut, Source};

    fn document() -> TimelineDocument {
        TimelineDocument {
            sources: BTreeMap::from([
                (
                    "main".to_owned(),
                    Source {
                        cuts: vec![Cut {
                            id: "cut-1".to_owned(),
                            t0: 4.0,
                            t1: 6.0,
                            r#ref: None,
                        }],
                        ..Source::default()
                    },
                ),
                (
                    "src-a".to_owned(),
                    Source {
                        duration: Some(8.0),
                        ..Source::default()
                    },
                ),
            ]),
            clips: vec![
                Clip {
                    id: "c1".to_owned(),
                    src_id: "main".to_owned(),
                    in_time: 2.0,
                    out: 8.0,
                    rate: 1.0,
                },
                Clip {
                    id: "c2".to_owned(),
                    src_id: "src-a".to_owned(),
                    in_time: 1.0,
                    out: 5.0,
                    rate: 2.0,
                },
                Clip {
                    id: "c3".to_owned(),
                    src_id: "main".to_owned(),
                    in_time: 6.0,
                    out: 8.0,
                    rate: 1.0,
                },
            ],
            ..TimelineDocument::default()
        }
    }

    #[test]
    fn clips_derive_prefix_positions_from_cut_collapsed_windows() {
        let projection =
            TimelineProjection::build(&document(), &BTreeMap::from([("main".to_owned(), 10.0)]))
                .unwrap();
        assert_eq!(projection.duration(), 8.0);
        assert_eq!(
            projection
                .clips()
                .iter()
                .map(|clip| (clip.timeline_start, clip.timeline_end))
                .collect::<Vec<_>>(),
            vec![(0.0, 4.0), (4.0, 6.0), (6.0, 8.0)]
        );
        assert_eq!(projection.source_to_timeline("main", 7.0), vec![3.0, 7.0]);
        assert!(matches!(
            projection.resolve_unique_source_time("main", 7.0, "word-1"),
            Err(TimelineError::Ambiguous(_))
        ));
        assert_eq!(
            projection.timeline_to_source(4.0, SeamBias::Preceding),
            Some(("main", 8.0))
        );
        assert_eq!(
            projection.timeline_to_source(4.0, SeamBias::Following),
            Some(("src-a", 1.0))
        );
    }

    /// `timeline_to_position` is just the form of `timeline_to_source` that additionally carries clip identity: for the same input it must give a bit-identical result, and clip ownership follows the same seam rule (`Preceding` belongs to the earlier segment, `Following` to the later one).
    #[test]
    fn timeline_to_position_agrees_with_timeline_to_source_and_names_the_clip() {
        let projection =
            TimelineProjection::build(&document(), &BTreeMap::from([("main".to_owned(), 10.0)]))
                .unwrap();

        for time in [0.0, 1.0, 3.999, 4.0, 5.0, 6.0, 7.5, 8.0, 99.0] {
            for bias in [SeamBias::Preceding, SeamBias::Following] {
                let position = projection.timeline_to_position(time, bias);
                assert_eq!(
                    position.map(|position| (position.src_id, position.source_time)),
                    projection.timeline_to_source(time, bias),
                    "t={time} bias={bias:?}"
                );
            }
        }

        let before = projection
            .timeline_to_position(4.0, SeamBias::Preceding)
            .unwrap();
        assert_eq!(before.clip_id, "c1");
        assert_eq!(before.src_id, "main");
        assert_eq!(before.source_time, 8.0);
        assert_eq!(before.rate, 1.0);
        assert_eq!(before.timeline_time, 4.0);

        let after = projection
            .timeline_to_position(4.0, SeamBias::Following)
            .unwrap();
        assert_eq!(after.clip_id, "c2");
        assert_eq!(after.src_id, "src-a");
        assert_eq!(after.source_time, 1.0);
        assert_eq!(after.rate, 2.0);

        // Out-of-range values are always clamped into the arrangement (same tier as `timeline_to_source`).
        assert_eq!(
            projection
                .timeline_to_position(99.0, SeamBias::Following)
                .map(|position| (position.clip_id, position.timeline_time)),
            Some(("c3", 8.0))
        );
        assert!(
            projection
                .timeline_to_position(f64::NAN, SeamBias::Following)
                .is_none()
        );
    }

    #[test]
    fn playback_step_skips_cuts_and_opens_the_next_arranged_clip() {
        let projection =
            TimelineProjection::build(&document(), &BTreeMap::from([("main".to_owned(), 10.0)]))
                .unwrap();

        assert_eq!(
            projection.playback_step("c1", 2.5, 0.001),
            Some(PlaybackStep {
                timeline_time: 0.5,
                seek_source: None,
                src_id: "main".to_owned(),
                clip_id: "c1".to_owned(),
                clip_ended: false,
            })
        );
        assert_eq!(
            projection.playback_step("c1", 4.0, 0.001),
            Some(PlaybackStep {
                timeline_time: 2.0,
                seek_source: Some(6.0),
                src_id: "main".to_owned(),
                clip_id: "c1".to_owned(),
                clip_ended: false,
            })
        );
        assert!(
            projection
                .playback_step("c1", 8.0, 0.001)
                .is_some_and(|step| step.clip_ended && step.timeline_time == 4.0)
        );
        assert_eq!(
            projection.next_position("c1"),
            Some(SourcePosition {
                src_id: "src-a".to_owned(),
                source_time: 1.0,
                clip_id: "c2".to_owned(),
            })
        );
        assert!(projection.next_position("c3").is_none());
        assert!(projection.playback_step("missing", 0.0, 0.001).is_none());
        assert!(projection.playback_step("c1", f64::NAN, 0.001).is_none());
    }

    #[test]
    fn empty_clip_after_source_cuts_is_rejected() {
        let mut document = TimelineDocument::default();
        document.sources.insert(
            "main".to_owned(),
            Source {
                cuts: vec![Cut {
                    id: "cut-1".to_owned(),
                    t0: 0.0,
                    t1: 10.0,
                    r#ref: None,
                }],
                ..Source::default()
            },
        );
        document.clips.push(Clip {
            id: "c1".to_owned(),
            src_id: "main".to_owned(),
            in_time: 2.0,
            out: 3.0,
            rate: 1.0,
        });
        assert!(
            matches!(TimelineProjection::build(&document, &BTreeMap::from([("main".to_owned(), 10.0)])), Err(TimelineError::EmptyClip(id)) if id == "c1")
        );
    }

    #[test]
    fn zero_duration_main_has_no_implicit_clip_and_can_accept_the_first_source() {
        let mut document = TimelineDocument::default();
        document.sources.insert(
            "insert".into(),
            Source {
                duration: Some(2.0),
                ..Source::default()
            },
        );
        let durations = BTreeMap::from([("main".to_owned(), 0.0), ("insert".to_owned(), 2.0)]);
        let projection = TimelineProjection::build(&document, &durations).unwrap();
        assert_eq!(projection.duration(), 0.0);
        assert!(projection.clips().is_empty());
        assert!(!materialize_implicit_clip(&mut document, &durations).unwrap());
        assert!(document.clips.is_empty());
        add_clip(
            &mut document,
            &durations,
            "first".into(),
            "insert".into(),
            None,
            None,
            None,
            None,
        )
        .unwrap();
        let projection = TimelineProjection::build(&document, &durations).unwrap();
        assert_eq!(projection.clips().len(), 1);
        assert_eq!(projection.duration(), 2.0);
    }

    #[test]
    fn split_at_cut_seam_uses_preceding_left_and_following_right() {
        let mut document = TimelineDocument {
            sources: BTreeMap::from([(
                "main".to_owned(),
                Source {
                    cuts: vec![Cut {
                        id: "cut-1".to_owned(),
                        t0: 10.0,
                        t1: 20.0,
                        r#ref: None,
                    }],
                    ..Source::default()
                },
            )]),
            ..TimelineDocument::default()
        };
        let durations = BTreeMap::from([("main".to_owned(), 30.0)]);
        assert_eq!(
            split_clip(&mut document, &durations, 10.0, "c2".to_owned()).unwrap(),
            ("c1".to_owned(), "c2".to_owned())
        );
        assert_eq!(document.clips[0].out, 10.0);
        assert_eq!(document.clips[1].in_time, 20.0);
    }

    #[test]
    fn add_trim_move_and_remove_use_view_clock_and_array_order() {
        let mut document = document();
        let durations = BTreeMap::from([("main".to_owned(), 10.0)]);
        let index = add_clip(
            &mut document,
            &durations,
            "c4".to_owned(),
            "main".to_owned(),
            Some(2.0),
            Some(6.0),
            Some("c1"),
            None,
        )
        .unwrap();
        assert_eq!(index, 0);
        assert_eq!(
            (document.clips[0].in_time, document.clips[0].out),
            (2.0, 8.0)
        );
        trim_clip(&mut document, &durations, "c4", Some(3.0), Some(5.0)).unwrap();
        assert_eq!(
            (document.clips[0].in_time, document.clips[0].out),
            (3.0, 7.0)
        );
        set_clip_rate(&mut document, &durations, "c4", 2.0).unwrap();
        assert_eq!(document.clips[0].rate, 2.0);
        assert!(set_clip_rate(&mut document, &durations, "c4", 0.0).is_err());
        assert_eq!(
            move_clip(&mut document, "c4", None, Some("c3"), None).unwrap(),
            3
        );
        assert_eq!(document.clips.last().unwrap().id, "c4");
        assert_eq!(
            remove_clips(&mut document, &durations, &["c4".to_owned()]).unwrap(),
            vec!["c4"]
        );
    }
}
