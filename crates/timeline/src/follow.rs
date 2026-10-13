//! Following: after segments and cuts change the clock, how elements follow (BCF §19.1 "following", clip-tool gap plan §2.1).
//!
//! `clips[]` plus `sources.<id>.cuts` is the only source of truth for the clock; pictures and sound live only on the elements. Every write that changes the clock (adding or removing cuts, adding, removing, splitting, moving, trimming or speed-changing segments) calls [`follow_clock`] inside the same write transaction:
//! the inputs are the document **before this item** (used only for its clock) and the document with segments / cuts already changed but elements not yet moved.
//!
//! Four rules:
//!
//! 1. **Which elements count as "a segment's picture"**: in the document before the operation, `kind:"video"`, role not broll / watermark, not on an audio track, `srcId` matching a segment, and the time range falls within one of the spans that segment projects
//!    (judged span by span, tolerance [`COMPOSE_EPS`]), with `srcStart` matching that span at the same moment, and `rate` equal to the segment's. Anything that was moved (source moment does not match) or stretched (beyond that span) does not count. Claimed only on a separated document.
//!    One more category, **stale pictures**: when an old version cut on a separated document, the picture did not follow, leaving a picture that does not match any folded span, but matches, by the same criteria, the segment's **uncut** clock (the projection after clearing all cuts), and the segment has no picture that follows properly — such pictures also belong to this segment ([`stale_pictures`]). They follow rule 2 by their source range, which is equivalent to first back-filling the historical cut. Writes that do not change the clock do not touch them.
//! 2. **What happens to pictures after the operation**: for each span of the projection after the operation (segment c, source range `[a, b)`), take the pictures belonging to c (the right half of a split segment inherits its parent), sort them by source time, and clip each to the intersection; source ranges **that only became visible with this operation** (restoring a cut, trim expansion) are filled by extending the preceding item, and the start of a span is filled backward by the following item; across an old gap, a neighbouring item is copied; source ranges that were visible before the operation but have no picture (deleted or shrunk by the user) are not filled; adjacent items are not automatically merged.
//!    When the same item is assigned to multiple spans, the part with the earliest source time keeps the original id. An item that falls entirely within the removed range is deleted. A newly added segment is created with the separated default; a segment that had no picture originally is not filled.
//! 3. **Other elements placed by numeric time**: start and end are each converted through "timeline moment before the operation → segment and source moment → timeline moment after the operation"; if inside a removed range, the start is pushed to the first kept moment after it and the end is pulled back to the last kept moment before it;
//!    an element whose end is not greater than its start is deleted; elements with their own source (`video` / `audio`) have `srcStart` moved forward by the same push amount as measured on the pre-operation clock when their start is pushed later; elements that span a cut are only shortened and no hole is dug; anything beyond the tail keeps its distance to the tail. When a segment is moved, only elements whose start and end both fall within the same segment move with it; when splitting, the clock does not change, and elements stacked on the split point are cut.
//! 4. Word anchors (`~word`) and elements with no end point are not moved.
use std::collections::{BTreeMap, HashMap, HashSet};

use serde::ser::SerializeStruct;
use serde::{Serialize, Serializer};

use crate::arrange::{ClipProjection, TimelineProjection};
use crate::keyframes::{Rewindow, rewindow};
use crate::schema::{
    Cut, Element, ElementKind, ElementRole, TimeValue, TimelineDocument, TimelineError,
};
use crate::schema::{Track, TrackKind};
use crate::video_elements::default_picture_element;

/// Tolerance for claiming pictures and judging seam equality: the kernel writes `segments` in seconds, and element `start/end/srcStart` are serialized from the same set of
/// numbers; 1 ms is enough to absorb floating-point jitter, and it is far smaller than any real editing seam (the shortest in cut mode is 40 ms). The editor's
/// fragment grouping (`compose_assignments` in `ccut-editor-core`) references the same constant.
pub const COMPOSE_EPS: f64 = 1e-3;

const RATE_EPS: f64 = 1e-6;
const TINY: f64 = 1e-9;

/// What this write did to the clock.
#[derive(Debug, Clone, PartialEq)]
pub enum ClockEdit {
    /// Changes the clock length: adding or removing cuts, adding or removing segments, trimming, speed.
    Retime,
    /// Splitting: does not change the clock. `right` is the new segment, and its picture is inherited from `left`; `at` is the split point (timeline moment).
    Split {
        left: String,
        right: String,
        at: f64,
    },
    /// Only changes the order of segments.
    Move,
}

/// An element newly created by following.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FollowCreated {
    pub id: String,
    /// Which element it was split from / copied from; a segment created with the default has no picture source.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub from: Option<String>,
    /// The segment that a segment picture belongs to; empty for other elements.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub clip_id: Option<String>,
}

/// The result of following: which were deleted, which were newly created (and their sources), and which kept their original id but had their time changed.
///
/// Serialized shape (command-line receipt and `follow` in `EditApplied`):
/// `{"removed":[id…],"created":[{"id","from"?,"clipId"?}…],"retimed":N}`.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct FollowReport {
    pub removed: Vec<String>,
    pub created: Vec<FollowCreated>,
    pub retimed: Vec<String>,
}

impl Serialize for FollowReport {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let mut state = serializer.serialize_struct("FollowReport", 3)?;
        state.serialize_field("removed", &self.removed)?;
        state.serialize_field("created", &self.created)?;
        state.serialize_field("retimed", &self.retimed.len())?;
        state.end()
    }
}

impl FollowReport {
    pub fn is_empty(&self) -> bool {
        self.removed.is_empty() && self.created.is_empty() && self.retimed.is_empty()
    }

    /// The next item in the same write transaction. Something created earlier and deleted later never existed; something whose time was changed earlier and deleted later is recorded as a deletion.
    pub fn merge(&mut self, next: FollowReport) {
        for id in next.removed {
            if let Some(index) = self.created.iter().position(|created| created.id == id) {
                self.created.remove(index);
                continue;
            }
            self.retimed.retain(|retimed| retimed != &id);
            if !self.removed.contains(&id) {
                self.removed.push(id);
            }
        }
        for created in next.created {
            if !self.created.iter().any(|known| known.id == created.id) {
                self.created.push(created);
            }
        }
        for id in next.retimed {
            if !self.created.iter().any(|created| created.id == id) && !self.retimed.contains(&id) {
                self.retimed.push(id);
            }
        }
    }
}

/// A copy keeping only the clock (sources, cuts, segments, `main`), used by [`follow_clock`] as the "before the operation" state.
pub fn clock_snapshot(document: &TimelineDocument) -> TimelineDocument {
    TimelineDocument {
        version: document.version.clone(),
        sources: document.sources.clone(),
        clips: document.clips.clone(),
        tracks: Vec::new(),
        main: document.main.clone(),
        template: None,
    }
}

/// Whether the clocks of two documents are the same (segments and each source's cuts). Registering a new source, or filling in an empty `main` source,
/// does not change the clock: an absent source and a source with no cuts are equivalent.
pub fn same_clock(a: &TimelineDocument, b: &TimelineDocument) -> bool {
    fn cuts_of<'a>(document: &'a TimelineDocument, id: &str) -> &'a [Cut] {
        document
            .sources
            .get(id)
            .map_or(&[][..], |source| source.cuts.as_slice())
    }
    a.clips == b.clips
        && a.sources
            .keys()
            .chain(b.sources.keys())
            .all(|id| cuts_of(a, id) == cuts_of(b, id))
}

/// Makes elements follow the clock change made by this item.
///
/// - `before`: the document before this item, of which only the clock is read ([`clock_snapshot`] is enough).
/// - `document`: segments / cuts already changed, elements still in their pre-operation state; following changes its tracks and elements in place.
/// - `durations`: the duration of each source (same as [`TimelineProjection::build`]).
/// - `widths`: the `place.w` used when a new segment is created with the default separated picture (per source, default 100).
/// - `next_id`: the id of new elements.
pub fn follow_clock(
    before: &TimelineDocument,
    document: &mut TimelineDocument,
    durations: &BTreeMap<String, f64>,
    widths: &BTreeMap<String, f64>,
    edit: &ClockEdit,
    next_id: &mut dyn FnMut() -> String,
) -> Result<FollowReport, TimelineError> {
    let pre = TimelineProjection::build(before, durations)?;
    let post = TimelineProjection::build(document, durations)?;
    let mut report = FollowReport::default();
    let originally_empty: HashSet<String> = document
        .tracks
        .iter()
        .filter(|track| track.elements.is_empty())
        .map(|track| track.id.clone())
        .collect();

    // 1–2. Segment pictures (only on a separated document).
    let mut pictures: HashSet<String> = HashSet::new();
    if document.is_detached() && (!pre.clips().is_empty() || !post.clips().is_empty()) {
        let unfolded = unfolded_projection(before, durations);
        follow_pictures(
            &pre,
            unfolded.as_ref(),
            &post,
            document,
            widths,
            edit,
            next_id,
            &mut pictures,
            &mut report,
        );
    }

    // 3. Other elements placed by numeric time.
    if !pre.clips().is_empty() {
        match edit {
            ClockEdit::Retime => retime_elements(&pre, &post, document, &pictures, &mut report),
            ClockEdit::Move => move_elements(&pre, &post, document, &pictures, &mut report),
            ClockEdit::Split { at, .. } => {
                for (id, from) in split_elements(document, *at, next_id, &pictures) {
                    if !report.retimed.contains(&from) {
                        report.retimed.push(from.clone());
                    }
                    report.created.push(FollowCreated {
                        id,
                        from: Some(from),
                        clip_id: None,
                    });
                }
            }
        }
    }

    // A track referenced by ducking is kept even if it becomes empty after following: `duck.under` must not point to a non-existent track.
    let ducked: HashSet<String> = document
        .tracks
        .iter()
        .flat_map(|track| &track.elements)
        .filter_map(|element| element.duck.as_ref())
        .map(|duck| duck.under.clone())
        .collect();
    document.tracks.retain(|track| {
        !track.elements.is_empty()
            || originally_empty.contains(&track.id)
            || ducked.contains(&track.id)
    });
    Ok(report)
}

// ---------------------------------------------------------------------------
// Segment pictures
// ---------------------------------------------------------------------------

/// The public form of rule 1: the picture element ids under each segment name, sorted by source time (`clip list`'s `elements`, `element list`'s
/// `clipId` and following all share this one criterion). A legacy document (without separation) is always an empty table;
/// segments without pictures do not appear in the table.
pub fn picture_assignments(
    document: &TimelineDocument,
    projection: &TimelineProjection,
) -> BTreeMap<String, Vec<String>> {
    let mut out: BTreeMap<String, Vec<String>> = BTreeMap::new();
    if !document.is_detached() {
        return out;
    }
    let mut claimed: Vec<(usize, f64, &str)> = claim_all(document, projection, None)
        .into_iter()
        .map(|claim| {
            let element = &document.tracks[claim.track].elements[claim.index];
            (
                claim.clip,
                element.src_start.unwrap_or(0.0),
                element.id.as_str(),
            )
        })
        .collect();
    claimed.sort_by(|a, b| a.0.cmp(&b.0).then(a.1.total_cmp(&b.1)));
    for (clip, _, id) in claimed {
        out.entry(projection.clips()[clip].id.clone())
            .or_default()
            .push(id.to_owned());
    }
    out
}

/// A "stale picture" that did not follow a cut (a supplement to rule 1).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StalePicture {
    pub element_id: String,
    pub clip_id: String,
}

/// An element in a separated document recognised as a stale picture (used by `ccut check`'s `picture-not-following-cuts`).
/// An old version, when cutting a separated document, did not make the picture follow, so the remaining picture still sits at the segment's uncut position; the next write that changes the clock
/// will distribute them over the spans ([`follow_clock`]), and until then they do not enter [`picture_assignments`].
pub fn stale_pictures(
    document: &TimelineDocument,
    projection: &TimelineProjection,
    durations: &BTreeMap<String, f64>,
) -> Vec<StalePicture> {
    if !document.is_detached() {
        return Vec::new();
    }
    let Some(unfolded) = unfolded_projection(document, durations) else {
        return Vec::new();
    };
    claim_all(document, projection, Some(&unfolded))
        .into_iter()
        .filter(|claim| claim.stale)
        .map(|claim| StalePicture {
            element_id: document.tracks[claim.track].elements[claim.index]
                .id
                .clone(),
            clip_id: projection.clips()[claim.clip].id.clone(),
        })
        .collect()
}

/// The uncut clock: the projection after clearing all cuts of each source (segment order, indices correspond one-to-one with the folded projection).
/// If the document has no cuts at all, the two are the same and `None` is returned.
fn unfolded_projection(
    document: &TimelineDocument,
    durations: &BTreeMap<String, f64>,
) -> Option<TimelineProjection> {
    if document
        .sources
        .values()
        .all(|source| source.cuts.is_empty())
    {
        return None;
    }
    let mut clock = clock_snapshot(document);
    for source in clock.sources.values_mut() {
        source.cuts.clear();
    }
    TimelineProjection::build(&clock, durations).ok()
}

/// One claimed picture: track `track`, item `index`, belonging to segment `clip` (projection index).
struct Claim {
    track: usize,
    index: usize,
    clip: usize,
    stale: bool,
}

/// Rule 1 and its supplement.
///
/// - Pictures that follow properly: match some span of the folded projection ([`claim_picture`]).
/// - Stale pictures (judged only when `unfolded` is given): match no span of the folded projection, but on the segment's **uncut** clock they are source-synchronised (fall within a span, `srcStart` matches, same rate),
///   and the segment has no picture that follows properly. This is the shape left when an old version's cut did not carry its picture along; an intentionally placed overlay video whose start is not at the unfolded position of the segment,
///   and the segment's own picture that still exists, both block it.
fn claim_all(
    document: &TimelineDocument,
    folded: &TimelineProjection,
    unfolded: Option<&TimelineProjection>,
) -> Vec<Claim> {
    let folded_segments = pre_segments(folded);
    let mut claims = Vec::new();
    let mut unclaimed = Vec::new();
    for (track_index, track) in document.tracks.iter().enumerate() {
        if track.kind == TrackKind::Audio {
            continue;
        }
        for (index, element) in track.elements.iter().enumerate() {
            match claim_picture(element, &folded_segments, folded.clips()) {
                Some(clip) => claims.push(Claim {
                    track: track_index,
                    index,
                    clip,
                    stale: false,
                }),
                None => unclaimed.push((track_index, index)),
            }
        }
    }
    let Some(unfolded) = unfolded else {
        return claims;
    };
    let unfolded_segments = pre_segments(unfolded);
    let followed: HashSet<usize> = claims.iter().map(|claim| claim.clip).collect();
    for (track_index, index) in unclaimed {
        let element = &document.tracks[track_index].elements[index];
        if let Some(clip) = claim_picture(element, &unfolded_segments, unfolded.clips())
            && !followed.contains(&clip)
        {
            claims.push(Claim {
                track: track_index,
                index,
                clip,
                stale: true,
            });
        }
    }
    claims
}

/// All spans in the projection, sorted by timeline time (segments in order, spans in order, already ordered by construction).
fn pre_segments(projection: &TimelineProjection) -> Vec<PreSegment> {
    projection
        .clips()
        .iter()
        .enumerate()
        .flat_map(|(clip, projection)| {
            projection.segments.iter().map(move |segment| PreSegment {
                tl0: segment.timeline_start,
                tl1: segment.timeline_end,
                src0: segment.source_start,
                clip,
            })
        })
        .collect()
}

fn seconds(value: &Option<TimeValue>) -> Option<f64> {
    match value {
        Some(TimeValue::Seconds(value)) => Some(*value),
        _ => None,
    }
}

fn element_rate(element: &Element) -> f64 {
    element
        .rate
        .filter(|rate| rate.is_finite() && *rate > 0.0)
        .unwrap_or(1.0)
}

/// One span in the projection before the operation, sorted by timeline time.
struct PreSegment {
    tl0: f64,
    tl1: f64,
    src0: f64,
    clip: usize,
}

/// Rule 1: whether this element counts as a picture of segment `clip` (index in the projection before the operation).
fn claim_picture(
    element: &Element,
    segments: &[PreSegment],
    clips: &[ClipProjection],
) -> Option<usize> {
    if element.kind != ElementKind::Video
        || matches!(
            element.role,
            Some(ElementRole::Broll) | Some(ElementRole::Watermark)
        )
    {
        return None;
    }
    let start = seconds(&element.start)?;
    let end = seconds(&element.end)?;
    let src_id = element.src_id.as_deref()?;
    if !(end > start + TINY) {
        return None;
    }
    let middle = (start + end) / 2.0;
    let index = segments.partition_point(|segment| segment.tl1 <= middle);
    let segment = segments.get(index)?;
    let clip = &clips[segment.clip];
    let rate = element_rate(element);
    let aligned = clip.src_id == src_id
        && start >= segment.tl0 - COMPOSE_EPS
        && end <= segment.tl1 + COMPOSE_EPS
        && (rate - clip.rate).abs() <= RATE_EPS
        && (element.src_start.unwrap_or(0.0) - (segment.src0 + (start - segment.tl0) * clip.rate))
            .abs()
            <= COMPOSE_EPS;
    aligned.then_some(segment.clip)
}

struct Candidate {
    track: usize,
    index: usize,
    s0: f64,
    s1: f64,
    /// The speed of the segment the projection before the operation belongs to.
    rate: f64,
}

/// One picture after the operation: `candidate` is the retained original (`None` = a copied patch), and `template` is the source of its attributes (the original or the one copied from).
struct Piece {
    candidate: Option<usize>,
    template: usize,
    s0: f64,
    s1: f64,
    post_clip: usize,
    post_segment: usize,
}

#[allow(clippy::too_many_arguments)]
fn follow_pictures(
    pre: &TimelineProjection,
    unfolded: Option<&TimelineProjection>,
    post: &TimelineProjection,
    document: &mut TimelineDocument,
    widths: &BTreeMap<String, f64>,
    edit: &ClockEdit,
    next_id: &mut dyn FnMut() -> String,
    pictures: &mut HashSet<String>,
    report: &mut FollowReport,
) {
    // Claiming (those that follow properly and stale ones are treated alike: stale pictures are distributed over the spans after the operation by their source range, equivalent to
    // first back-filling the historical cut). The segment indices of the two projections correspond one-to-one, so the rate of the folded projection is sufficient.
    let mut candidates: Vec<Candidate> = Vec::new();
    let mut by_clip: Vec<Vec<usize>> = vec![Vec::new(); pre.clips().len()];
    for claim in claim_all(document, pre, unfolded) {
        let element = &document.tracks[claim.track].elements[claim.index];
        let start = seconds(&element.start).unwrap_or(0.0);
        let end = seconds(&element.end).unwrap_or(start);
        let s0 = element.src_start.unwrap_or(0.0);
        by_clip[claim.clip].push(candidates.len());
        let rate = pre.clips()[claim.clip].rate;
        candidates.push(Candidate {
            track: claim.track,
            index: claim.index,
            s0,
            s1: s0 + (end - start) * rate,
            rate,
        });
    }
    for list in &mut by_clip {
        list.sort_by(|a, b| candidates[*a].s0.total_cmp(&candidates[*b].s0));
    }

    let pre_index: HashMap<&str, usize> = pre
        .clips()
        .iter()
        .enumerate()
        .map(|(index, clip)| (clip.id.as_str(), index))
        .collect();
    let lineage = |post_clip: &ClipProjection| -> Option<usize> {
        if let ClockEdit::Split { left, right, .. } = edit
            && &post_clip.id == right
        {
            return pre_index.get(left.as_str()).copied();
        }
        pre_index
            .get(post_clip.id.as_str())
            .copied()
            .filter(|index| pre.clips()[*index].src_id == post_clip.src_id)
    };

    let mut pieces: Vec<Piece> = Vec::new();
    let mut new_clips: Vec<usize> = Vec::new();
    for (post_clip_index, post_clip) in post.clips().iter().enumerate() {
        let Some(parent) = lineage(post_clip) else {
            new_clips.push(post_clip_index);
            continue;
        };
        let list = &by_clip[parent];
        if list.is_empty() {
            continue;
        }
        let segments = &post_clip.segments;
        let mut per_segment: Vec<Vec<usize>> = vec![Vec::new(); segments.len()];
        for &candidate_index in list {
            let candidate = &candidates[candidate_index];
            let lo = segments.partition_point(|segment| segment.source_end <= candidate.s0 + TINY);
            let hi = segments.partition_point(|segment| segment.source_start < candidate.s1 - TINY);
            for (segment_index, segment) in segments.iter().enumerate().take(hi).skip(lo) {
                let mut s0 = candidate.s0.max(segment.source_start);
                let mut s1 = candidate.s1.min(segment.source_end);
                if (s0 - segment.source_start).abs() <= COMPOSE_EPS {
                    s0 = segment.source_start;
                }
                if (s1 - segment.source_end).abs() <= COMPOSE_EPS {
                    s1 = segment.source_end;
                }
                if s1 - s0 <= COMPOSE_EPS {
                    continue;
                }
                per_segment[segment_index].push(pieces.len());
                pieces.push(Piece {
                    candidate: Some(candidate_index),
                    template: candidate_index,
                    s0,
                    s1,
                    post_clip: post_clip_index,
                    post_segment: segment_index,
                });
            }
        }
        let visible = &pre.clips()[parent].segments;
        for (segment_index, segment) in segments.iter().enumerate() {
            let mut order = std::mem::take(&mut per_segment[segment_index]);
            order.sort_by(|a, b| pieces[*a].s0.total_cmp(&pieces[*b].s0));
            let (a, b) = (segment.source_start, segment.source_end);
            let mut cursor = a;
            let mut cursor_piece: Option<usize> = None;
            let mut gaps: Vec<(f64, f64, Option<usize>, Option<usize>)> = Vec::new();
            for &piece_index in &order {
                let s0 = pieces[piece_index].s0;
                if s0 > cursor + COMPOSE_EPS {
                    gaps.push((cursor, s0, cursor_piece, Some(piece_index)));
                } else if s0 > cursor {
                    pieces[piece_index].s0 = cursor;
                }
                if pieces[piece_index].s1 > cursor {
                    cursor = pieces[piece_index].s1;
                    cursor_piece = Some(piece_index);
                }
            }
            if b > cursor + COMPOSE_EPS {
                gaps.push((cursor, b, cursor_piece, None));
            } else if b > cursor
                && let Some(piece_index) = cursor_piece
            {
                pieces[piece_index].s1 = b;
            }
            for (g0, g1, previous, following) in gaps {
                for (n0, n1) in newly_visible(g0, g1, visible) {
                    if let Some(previous) = previous
                        && (n0 - g0).abs() <= COMPOSE_EPS
                        && (pieces[previous].s1 - g0).abs() <= COMPOSE_EPS
                    {
                        pieces[previous].s1 = n1;
                    } else if let Some(following) = following
                        && (n1 - g1).abs() <= COMPOSE_EPS
                    {
                        pieces[following].s0 = n0;
                    } else {
                        let template = previous
                            .or(following)
                            .map(|piece| pieces[piece].template)
                            .unwrap_or_else(|| nearest(list, &candidates, n0, n1));
                        pieces.push(Piece {
                            candidate: None,
                            template,
                            s0: n0,
                            s1: n1,
                            post_clip: post_clip_index,
                            post_segment: segment_index,
                        });
                    }
                }
            }
        }
    }

    // Assigning ids: among the pieces of each original, the one with the earliest source time keeps the original id.
    let mut by_candidate: Vec<Vec<usize>> = vec![Vec::new(); candidates.len()];
    let mut clones: Vec<Vec<usize>> = vec![Vec::new(); candidates.len()];
    for (piece_index, piece) in pieces.iter().enumerate() {
        match piece.candidate {
            Some(candidate) => by_candidate[candidate].push(piece_index),
            None => clones[piece.template].push(piece_index),
        }
    }
    let mut order: Vec<usize> = (0..candidates.len()).collect();
    order.sort_by_key(|index| (candidates[*index].track, candidates[*index].index));
    let mut outputs: HashMap<(usize, usize), Vec<Element>> = HashMap::new();
    for candidate_index in order {
        let candidate = &candidates[candidate_index];
        let original = document.tracks[candidate.track].elements[candidate.index].clone();
        let mut own = std::mem::take(&mut by_candidate[candidate_index]);
        own.sort_by(|a, b| pieces[*a].s0.total_cmp(&pieces[*b].s0));
        let mut extra = std::mem::take(&mut clones[candidate_index]);
        extra.sort_by(|a, b| pieces[*a].s0.total_cmp(&pieces[*b].s0));
        let mut emitted = Vec::with_capacity(own.len() + extra.len());
        let divided = own.len() + extra.len() > 1;
        if own.is_empty() {
            report.removed.push(original.id.clone());
        }
        for (rank, piece_index) in own.iter().chain(extra.iter()).enumerate() {
            let piece = &pieces[*piece_index];
            let post_clip = &post.clips()[piece.post_clip];
            let template = &candidates[piece.template];
            let mut element = place_piece(&original, piece, post_clip, template, divided);
            if rank == 0 && piece.candidate.is_some() {
                if element != original {
                    report.retimed.push(element.id.clone());
                }
            } else {
                element.id = next_id();
                report.created.push(FollowCreated {
                    id: element.id.clone(),
                    from: Some(original.id.clone()),
                    clip_id: Some(post_clip.id.clone()),
                });
            }
            pictures.insert(element.id.clone());
            emitted.push(element);
        }
        outputs.insert((candidate.track, candidate.index), emitted);
    }
    let touched: HashSet<usize> = outputs.keys().map(|(track, _)| *track).collect();
    for (track_index, track) in document.tracks.iter_mut().enumerate() {
        if !touched.contains(&track_index) {
            continue;
        }
        let old = std::mem::take(&mut track.elements);
        for (index, element) in old.into_iter().enumerate() {
            match outputs.remove(&(track_index, index)) {
                Some(replacement) => track.elements.extend(replacement),
                None => track.elements.push(element),
            }
        }
    }

    // Newly added segments: created as the separated default.
    if new_clips.is_empty() {
        return;
    }
    let target = candidates
        .first()
        .map(|candidate| candidate.track)
        .or_else(|| {
            document
                .tracks
                .iter()
                .position(|track| track.elements.iter().any(|el| pictures.contains(&el.id)))
        });
    let target = match target {
        Some(index) => index,
        None => {
            let used: HashSet<&str> = document
                .tracks
                .iter()
                .map(|track| track.id.as_str())
                .chain(document.clips.iter().map(|clip| clip.id.as_str()))
                .chain(document.sources.keys().map(String::as_str))
                .chain(
                    document
                        .tracks
                        .iter()
                        .flat_map(|track| track.elements.iter().map(|el| el.id.as_str())),
                )
                .collect();
            let mut id = "video-track".to_owned();
            let mut suffix = 2;
            while used.contains(id.as_str()) {
                id = format!("video-track-{suffix}");
                suffix += 1;
            }
            document.tracks.insert(
                0,
                Track {
                    id,
                    kind: TrackKind::Overlay,
                    name: None,
                    hidden: false,
                    locked: false,
                    muted: false,
                    elements: Vec::new(),
                },
            );
            0
        }
    };
    for post_clip_index in new_clips {
        let clip = &post.clips()[post_clip_index];
        let width = widths.get(&clip.src_id).copied().unwrap_or(100.0);
        for segment in &clip.segments {
            let id = next_id();
            let element = default_picture_element(
                &id,
                &clip.src_id,
                segment.source_start,
                segment.timeline_start,
                segment.timeline_end,
                clip.rate,
                width,
            );
            pictures.insert(id.clone());
            report.created.push(FollowCreated {
                id,
                from: None,
                clip_id: Some(clip.id.clone()),
            });
            document.tracks[target].elements.push(element);
        }
    }
}

/// The part of `[g0, g1)` that was not visible before the operation (not within any span of `visible`).
fn newly_visible(g0: f64, g1: f64, visible: &[crate::arrange::ClipSegment]) -> Vec<(f64, f64)> {
    let mut out = Vec::new();
    let mut cursor = g0;
    let start = visible.partition_point(|segment| segment.source_end <= g0);
    for segment in &visible[start..] {
        if segment.source_start >= g1 {
            break;
        }
        if segment.source_start > cursor + COMPOSE_EPS {
            out.push((cursor, segment.source_start.min(g1)));
        }
        cursor = cursor.max(segment.source_end);
        if cursor >= g1 {
            break;
        }
    }
    if g1 > cursor + COMPOSE_EPS {
        out.push((cursor, g1));
    }
    out
}

fn nearest(list: &[usize], candidates: &[Candidate], n0: f64, n1: f64) -> usize {
    *list
        .iter()
        .min_by(|a, b| {
            let distance = |index: usize| {
                let candidate = &candidates[index];
                (candidate.s0 - n1).max(n0 - candidate.s1).max(0.0)
            };
            distance(**a).total_cmp(&distance(**b))
        })
        .expect("clip has candidates")
}

/// `template` is the original this picture copies from (keyframes are converted by its source range), and `divided` = whether this original was split into more than one item.
fn place_piece(
    original: &Element,
    piece: &Piece,
    clip: &ClipProjection,
    template: &Candidate,
    divided: bool,
) -> Element {
    let segment = &clip.segments[piece.post_segment];
    let start = segment.timeline_start + (piece.s0 - segment.source_start) / clip.rate;
    let end = if (piece.s1 - segment.source_end).abs() <= TINY {
        segment.timeline_end
    } else {
        segment.timeline_start + (piece.s1 - segment.source_start) / clip.rate
    };
    let mut element = original.clone();
    element.start = Some(TimeValue::Seconds(start));
    element.end = Some(TimeValue::Seconds(end));
    element.src_start = Some(piece.s0);
    if element.rate.is_some() || (clip.rate - 1.0).abs() > f64::EPSILON {
        element.rate = Some(clip.rate);
    }
    if let Some(keyframes) = &original.keyframes {
        let rate = if template.rate > 0.0 {
            template.rate
        } else {
            1.0
        };
        element.keyframes = Some(rewindow(
            keyframes,
            Rewindow {
                old_duration: (template.s1 - template.s0) / rate,
                head: (piece.s0 - template.s0) / rate,
                new_duration: end - start,
                scale: if clip.rate > 0.0 {
                    rate / clip.rate
                } else {
                    1.0
                },
                divided,
            },
        ));
    }
    element
}

// ---------------------------------------------------------------------------
// Other elements placed by numeric time
// ---------------------------------------------------------------------------

/// Linearly maps the timeline range `[p0, p1)` before the operation to `[q0, q1)` after it: same segment, same source span.
#[derive(Debug, Clone, Copy)]
struct MapPiece {
    p0: f64,
    p1: f64,
    q0: f64,
    q1: f64,
}

impl MapPiece {
    fn at(self, t: f64) -> f64 {
        if self.p1 - self.p0 <= TINY {
            return self.q0;
        }
        self.q0 + (t - self.p0) * (self.q1 - self.q0) / (self.p1 - self.p0)
    }
}

struct ClockMap {
    pieces: Vec<MapPiece>,
    pre_end: f64,
    post_end: f64,
}

impl ClockMap {
    fn build(pre: &TimelineProjection, post: &TimelineProjection) -> Self {
        let post_by_id: HashMap<&str, &ClipProjection> = post
            .clips()
            .iter()
            .map(|clip| (clip.id.as_str(), clip))
            .collect();
        let mut pieces = Vec::new();
        for before in pre.clips() {
            let Some(after) = post_by_id.get(before.id.as_str()) else {
                continue;
            };
            if after.src_id != before.src_id {
                continue;
            }
            let (mut i, mut j) = (0, 0);
            while i < before.segments.len() && j < after.segments.len() {
                let (a, b) = (&before.segments[i], &after.segments[j]);
                let s0 = a.source_start.max(b.source_start);
                let s1 = a.source_end.min(b.source_end);
                if s1 > s0 + TINY {
                    let p = |s: f64| a.timeline_start + (s - a.source_start) / before.rate;
                    let q = |s: f64| b.timeline_start + (s - b.source_start) / after.rate;
                    pieces.push(MapPiece {
                        p0: p(s0),
                        p1: if s1 == a.source_end {
                            a.timeline_end
                        } else {
                            p(s1)
                        },
                        q0: q(s0),
                        q1: if s1 == b.source_end {
                            b.timeline_end
                        } else {
                            q(s1)
                        },
                    });
                }
                if a.source_end <= b.source_end {
                    i += 1;
                } else {
                    j += 1;
                }
            }
        }
        pieces.sort_by(|a, b| a.p0.total_cmp(&b.p0));
        Self {
            pieces,
            pre_end: pre.duration(),
            post_end: post.duration(),
        }
    }

    /// Start: if it falls inside a removed range, it is pushed to the first kept moment after it. Returns (moment after the operation, the push amount on the pre-operation clock).
    fn start(&self, t: f64) -> (f64, f64) {
        let k = self.pieces.partition_point(|piece| piece.p1 <= t);
        match self.pieces.get(k) {
            Some(piece) if piece.p0 <= t => (piece.at(t), 0.0),
            Some(piece) => (piece.q0, piece.p0 - t),
            None => (
                self.post_end + (t - self.pre_end).max(0.0),
                (self.pre_end - t).max(0.0),
            ),
        }
    }

    /// End: if it falls inside a removed range, it is pulled back to the last kept moment before it.
    fn end(&self, t: f64) -> f64 {
        let k = self.pieces.partition_point(|piece| piece.p1 < t);
        match self.pieces.get(k) {
            Some(piece) if piece.p0 < t => piece.at(t),
            _ if k == self.pieces.len() && t > self.pre_end => t - self.pre_end + self.post_end,
            _ => match k.checked_sub(1).and_then(|index| self.pieces.get(index)) {
                Some(previous) => previous.q1,
                None => self.pieces.first().map_or(0.0, |piece| piece.q0),
            },
        }
    }
}

/// Elements that can be converted by numeric time: neither start nor end is a word anchor, and an end is set.
fn numeric_span(element: &Element) -> Option<(f64, f64)> {
    if matches!(element.start, Some(TimeValue::Anchor(_))) {
        return None;
    }
    let end = seconds(&element.end)?;
    Some((seconds(&element.start).unwrap_or(0.0), end))
}

fn set_span(element: &mut Element, start: f64, end: f64) {
    if element.start.is_some() || start.abs() > TINY {
        element.start = Some(TimeValue::Seconds(start));
    }
    element.end = Some(TimeValue::Seconds(end));
}

fn retime_elements(
    pre: &TimelineProjection,
    post: &TimelineProjection,
    document: &mut TimelineDocument,
    pictures: &HashSet<String>,
    report: &mut FollowReport,
) {
    let map = ClockMap::build(pre, post);
    for track in &mut document.tracks {
        track.elements.retain_mut(|element| {
            if pictures.contains(&element.id) {
                return true;
            }
            let Some((start, end)) = numeric_span(element) else {
                return true;
            };
            let (new_start, pushed) = map.start(start);
            let new_end = map.end(end);
            if new_end - new_start <= TINY {
                report.removed.push(element.id.clone());
                return false;
            }
            let before = element.clone();
            set_span(element, new_start, new_end);
            if let Some(keyframes) = &element.keyframes
                && ((new_start - start).abs() > TINY
                    || (new_end - end).abs() > TINY
                    || pushed > TINY)
            {
                element.keyframes = Some(rewindow(
                    keyframes,
                    Rewindow::trim(end - start, pushed, new_end - new_start),
                ));
            }
            if pushed > TINY && matches!(element.kind, ElementKind::Video | ElementKind::Audio) {
                element.src_start =
                    Some(element.src_start.unwrap_or(0.0) + pushed * element_rate(element));
            }
            if *element != before {
                report.retimed.push(element.id.clone());
            }
            true
        });
    }
}

fn move_elements(
    pre: &TimelineProjection,
    post: &TimelineProjection,
    document: &mut TimelineDocument,
    pictures: &HashSet<String>,
    report: &mut FollowReport,
) {
    let post_start: HashMap<&str, f64> = post
        .clips()
        .iter()
        .map(|clip| (clip.id.as_str(), clip.timeline_start))
        .collect();
    let clips = pre.clips();
    for track in &mut document.tracks {
        for element in &mut track.elements {
            if pictures.contains(&element.id) {
                continue;
            }
            let Some((start, end)) = numeric_span(element) else {
                continue;
            };
            let index = clips.partition_point(|clip| clip.timeline_end <= start + COMPOSE_EPS);
            let Some(clip) = clips.get(index) else {
                continue;
            };
            if start < clip.timeline_start - COMPOSE_EPS || end > clip.timeline_end + COMPOSE_EPS {
                continue;
            }
            let Some(target) = post_start.get(clip.id.as_str()) else {
                continue;
            };
            let delta = target - clip.timeline_start;
            if delta.abs() <= TINY {
                continue;
            }
            set_span(element, start + delta, end + delta);
            report.retimed.push(element.id.clone());
        }
    }
}

/// A split seam cuts all tracks: an element with numeric `start < t < end` becomes `[start, t]` (original id) plus
/// `[t, end]` (new id); for media elements the right half's `srcStart` advances by the amount already played. An element whose edge lies exactly on the seam, one with no end point, or a word anchor is unchanged. Returns `(new id, original id)`.
fn split_elements(
    document: &mut TimelineDocument,
    timeline_time: f64,
    next_id: &mut dyn FnMut() -> String,
    skip: &HashSet<String>,
) -> Vec<(String, String)> {
    let mut created = Vec::new();
    for track in &mut document.tracks {
        let mut index = 0;
        while index < track.elements.len() {
            let element = &track.elements[index];
            let span = if skip.contains(&element.id) {
                None
            } else {
                numeric_span(element)
            };
            let Some((start, end)) = span else {
                index += 1;
                continue;
            };
            if timeline_time <= start + TINY || timeline_time >= end - TINY {
                index += 1;
                continue;
            }
            let mut right = track.elements[index].clone();
            right.id = next_id();
            right.start = Some(TimeValue::Seconds(timeline_time));
            if let Some(keyframes) = right.keyframes.clone() {
                let halves = |head: f64, new_duration: f64| Rewindow {
                    old_duration: end - start,
                    head,
                    new_duration,
                    scale: 1.0,
                    divided: true,
                };
                right.keyframes = Some(rewindow(
                    &keyframes,
                    halves(timeline_time - start, end - timeline_time),
                ));
                track.elements[index].keyframes =
                    Some(rewindow(&keyframes, halves(0.0, timeline_time - start)));
            }
            if matches!(right.kind, ElementKind::Video | ElementKind::Audio) {
                right.src_start = Some(
                    right.src_start.unwrap_or(0.0) + (timeline_time - start) * element_rate(&right),
                );
            }
            created.push((right.id.clone(), track.elements[index].id.clone()));
            track.elements[index].end = Some(TimeValue::Seconds(timeline_time));
            track.elements.insert(index + 1, right);
            index += 2;
        }
    }
    created
}

#[cfg(test)]
#[path = "follow_tests.rs"]
mod tests;
