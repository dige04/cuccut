//! Timeline projection of text (architecture design §9.13 subtitle and transcript export, format spec §5.7 EditedSpeechView): where the caption sentences and transcript words appear on the sequence after editing. The rules match preview's caption drawing (the caption branch of [`plan_frame`](super::plan_frame)):
//!
//! - When the document is on the source-asset clock, it is projected onto the sequence through the time mapping of the active item instance: `seq = itemStart + (src − sourceIn) / rate`. Parts outside the source ranges used by all active instances (cut away) do not appear, and parts spanning a cut point are trimmed to the instance's edges.
//! - When several active instances cover the same moment, the per-frame plan uses the first covering instance in the list; here the same precedence applies, so a later instance only projects the part not already covered by earlier ones. When the same source is used twice (two instances), a sentence appears twice (two occurrences).
//! - Freeze-frame instances (speed 0) and compositions without source material cannot be projected.
//! - When the document time is already sequence time (`clock: 'sequence'`), no mapping is applied; it is only trimmed to the caption instance's span.
//!
//! The scope of active instances is determined in this order: the instances the caller explicitly passes; the caption instances that display this document (each with its own active instances and span); all instances on the timeline of the document's source asset. Everything is computed with exact rational numbers and only converted to seconds at serialization.

use editor_semantics::{MediaTime, Ratio, TimeMap, map_time};
use serde::Serialize;
use serde_json::Value;
use video_model::{CompositionSource, DocumentRecord, FrameSpan, Id, Sequence, TimelineItem};

use super::{PlanError, VideoView, audio_bounds, checked_fps, span_bounds};
use crate::audio_plan::{PlanRange, resolve_range};

/// Basis of the projection: which active instances were used.
#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TextScope {
    /// `explicit` (passed by the caller), `caption-items` (caption instances displaying this document), `asset-items` (instances of the document's asset), `sequence` (no mapping applied).
    pub basis: String,
    pub caption_item_ids: Vec<Id>,
    pub scope_item_ids: Vec<Id>,
}

/// A caption sentence or a word projected onto the sequence.
#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TextEntry {
    /// occurrence: `<active instance>:<ID in the document>`; one entry each time the same source is used. Without mapping, it is the ID in the document.
    pub key: String,
    pub id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub scope_item_id: Option<Id>,
    /// Seconds, relative to the start of the export range.
    pub start: f64,
    pub end: f64,
    pub text: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub speaker: Option<String>,
    /// Sentence ID of a transcript word, when the document has sentence segmentation.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sentence_id: Option<String>,
    #[serde(skip_serializing_if = "std::ops::Not::not")]
    pub paragraph_start: bool,
    /// The timing belongs to this word itself (from alignment or provided by the service). A whole passage written as one “word”, or a word interpolated by character length, is false: those can only be used as the timing of the whole passage and must not pass for word-by-word sync (acceptance AT-05). Caption sentences are always false (sentence level).
    pub word_timing: bool,
    /// Trimmed by a cut point or the export range.
    #[serde(skip_serializing_if = "std::ops::Not::not")]
    pub clipped: bool,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TextPlan {
    pub sequence_id: Id,
    pub document_id: Id,
    /// `caption` (sentence) or `speech` (word).
    pub unit: String,
    pub clock: String,
    pub scope: TextScope,
    pub range: PlanRange,
    /// Sorted by start time; at the same moment, by occurrence.
    pub entries: Vec<TextEntry>,
    /// The number of entries in the document, and the number of entries that do not appear at all after projection (cut, or outside the range).
    pub source_count: usize,
    pub omitted_count: usize,
}

/// One entry in the document: its source (or sequence) time span and text.
struct SourceEntry {
    id: String,
    start: Ratio,
    end: Ratio,
    text: String,
    speaker: Option<String>,
    sentence_id: Option<String>,
    paragraph_start: bool,
    word_timing: bool,
}

/// The part one active instance can project: its mapping and the sequence span it exclusively owns (after subtracting earlier instances, trimmed to the caption span and export range).
struct Projector {
    item_id: Option<Id>,
    /// `None` means no mapping (document time is sequence time).
    map: Option<(Ratio, TimeMapRef)>,
    windows: Vec<(Ratio, Ratio)>,
}

#[derive(Clone, Copy)]
struct TimeMapRef {
    source_in: Ratio,
    rate: Ratio,
}

impl TimeMapRef {
    /// Source time → sequence time (`item_start + (src − sourceIn) / rate`).
    fn to_sequence(self, item_start: Ratio, source: Ratio) -> Option<Ratio> {
        item_start.checked_add(source.checked_sub(self.source_in)?.checked_div(self.rate)?)
    }
}

/// Project the body of `document`. When `scope_item_ids` is not empty, only these instances are used.
pub fn plan_text(
    video: VideoView<'_>,
    sequence_id: &str,
    document: &DocumentRecord,
    body: &Value,
    scope_item_ids: &[Id],
    range: Option<(Ratio, Ratio)>,
) -> Result<TextPlan, PlanError> {
    plan_text_scan(video, sequence_id, document, body, scope_item_ids, range, false)
}

/// With `full_scan`, every entry is tried against every active instance (tests use this as a reference); otherwise only entries whose source span may fall into the instance's window are tried.
fn plan_text_scan(
    video: VideoView<'_>,
    sequence_id: &str,
    document: &DocumentRecord,
    body: &Value,
    scope_item_ids: &[Id],
    range: Option<(Ratio, Ratio)>,
    full_scan: bool,
) -> Result<TextPlan, PlanError> {
    let sequence = video
        .sequences
        .get(sequence_id)
        .ok_or_else(|| PlanError::new("SEQUENCE_NOT_FOUND", format!("no sequence {sequence_id}")))?;
    let (range_start, range_end) = resolve_range(sequence, range)?;
    let schema = body.get("schema").and_then(Value::as_str).unwrap_or_default();
    let (unit, entries) = match schema {
        "cuccut.caption/1" => ("caption", caption_entries(body)?),
        "cuccut.speech/1" => ("speech", speech_entries(body)?),
        other => {
            return Err(PlanError::new(
                "EXPORT_SOURCE_UNSUPPORTED",
                format!("this document ({}) cannot be exported as captions or a transcript: schema {other}", document.kind),
            ));
        }
    };
    let clock = body.get("clock").and_then(Value::as_str).unwrap_or("source-asset").to_string();
    let (scope, projectors) = projectors(sequence, document, &clock, scope_item_ids, (range_start, range_end))?;

    // Computing exact rational mappings pairwise for thousands of instances × thousands of words takes tens of seconds (on long timelines, the speaker and caption preview and the content index get stuck here):
    // each instance only tries entries whose start time may fall in its window (sorted by start time, then binary search), then projects pair by pair in the original (entry, instance) order. The result is exactly the same as trying every pair.
    let (count, scopes) = (entries.len(), projectors.len());
    let pairs: Box<dyn Iterator<Item = (usize, usize)>> = match (!full_scan).then(|| candidate_pairs(&entries, &projectors)).flatten() {
        Some(pairs) => Box::new(pairs.into_iter()),
        None => Box::new((0..count).flat_map(move |e| (0..scopes).map(move |p| (e, p)))),
    };
    let mut placed: Vec<TextEntry> = Vec::new();
    let mut shown = vec![false; entries.len()];
    for (e, p) in pairs {
        let (entry, projector) = (&entries[e], &projectors[p]);
        let (a, b) = match projector.map {
            None => (entry.start, entry.end),
            Some((item_start, map)) => (
                map.to_sequence(item_start, entry.start)
                    .ok_or_else(|| PlanError::overflow("start"))?,
                map.to_sequence(item_start, entry.end).ok_or_else(|| PlanError::overflow("end"))?,
            ),
        };
        let mut piece = 0;
        for &(from, to) in &projector.windows {
            let start = a.max(from);
            let end = b.min(to);
            if end <= start {
                continue;
            }
            piece += 1;
            shown[e] = true;
            let base = match &projector.item_id {
                Some(item) => format!("{item}:{}", entry.id),
                None => entry.id.clone(),
            };
            placed.push(TextEntry {
                key: if piece == 1 { base } else { format!("{base}#{piece}") },
                id: entry.id.clone(),
                scope_item_id: projector.item_id.clone(),
                start: start.checked_sub(range_start).ok_or_else(|| PlanError::overflow("start"))?.to_f64(),
                end: end.checked_sub(range_start).ok_or_else(|| PlanError::overflow("end"))?.to_f64(),
                text: entry.text.clone(),
                speaker: entry.speaker.clone(),
                sentence_id: entry.sentence_id.clone(),
                paragraph_start: entry.paragraph_start,
                word_timing: entry.word_timing,
                clipped: start != a || end != b,
            });
        }
    }
    let omitted = shown.iter().filter(|shown| !**shown).count();
    placed.sort_by(|x, y| x.start.total_cmp(&y.start).then_with(|| x.key.cmp(&y.key)));
    Ok(TextPlan {
        sequence_id: sequence.id.clone(),
        document_id: document.id.clone(),
        unit: unit.into(),
        clock,
        scope,
        range: PlanRange::new(range_start, range_end)?,
        entries: placed,
        source_count: entries.len(),
        omitted_count: omitted,
    })
}

/// The (entry, instance) pairs to project pairwise, ordered by entry, then by instance. The instance window on the source clock is `[lo, hi)` (the mapping is monotonically increasing: speed is positive). An entry can project into it only if `start < hi` and `end > lo`; entries last at most `longest`, so only those whose start falls in `(lo − longest, hi)` need checking.
/// An instance whose window is fully taken by earlier instances projects nothing and is skipped. When rational overflow makes the bounds impossible to compute, returns `None` and falls back to pairwise trial.
fn candidate_pairs(entries: &[SourceEntry], projectors: &[Projector]) -> Option<Vec<(usize, usize)>> {
    let mut order: Vec<usize> = (0..entries.len()).collect();
    order.sort_by(|&x, &y| entries[x].start.cmp(&entries[y].start));
    let mut longest = Ratio::ZERO;
    for entry in entries {
        longest = longest.max(entry.end.checked_sub(entry.start)?);
    }
    let mut pairs = Vec::new();
    for (p, projector) in projectors.iter().enumerate() {
        let Some((lo, hi)) = source_window(projector)? else {
            continue;
        };
        let after = lo.checked_sub(longest)?;
        let first = order.partition_point(|&e| entries[e].start <= after);
        let last = order.partition_point(|&e| entries[e].start < hi);
        pairs.extend(order[first..last.max(first)].iter().map(|&e| (e, p)));
    }
    pairs.sort_unstable();
    Some(pairs)
}

/// The outer edge `[lo, hi)` on the source clock of the union of the instance windows: `src = sourceIn + (seq − itemStart) × rate`. With no windows, `Some(None)`.
fn source_window(projector: &Projector) -> Option<Option<(Ratio, Ratio)>> {
    let (Some(from), Some(to)) = (
        projector.windows.iter().map(|w| w.0).min(),
        projector.windows.iter().map(|w| w.1).max(),
    ) else {
        return Some(None);
    };
    let Some((item_start, map)) = projector.map else {
        return Some(Some((from, to)));
    };
    let back = |t: Ratio| map.source_in.checked_add(t.checked_sub(item_start)?.checked_mul(map.rate)?);
    Some(Some((back(from)?, back(to)?)))
}

/// Active instances and the span each one exclusively owns.
fn projectors(
    sequence: &Sequence,
    document: &DocumentRecord,
    clock: &str,
    explicit: &[Id],
    range: (Ratio, Ratio),
) -> Result<(TextScope, Vec<Projector>), PlanError> {
    let fps = checked_fps(sequence)?;
    let whole = range;
    // Each candidate: an active instance (None means no mapping) and the span limiting it (the caption instance's span; unlimited when there is no caption instance).
    let mut candidates: Vec<(Option<&TimelineItem>, (Ratio, Ratio))> = Vec::new();
    let mut caption_item_ids: Vec<Id> = Vec::new();
    let basis;
    let find = |id: &Id| sequence.items.iter().find(|item| &item.base().id == id);
    if clock == "sequence" {
        basis = "sequence";
        let captions = displaying(sequence, &document.id);
        if captions.is_empty() {
            candidates.push((None, whole));
        }
        for (id, span) in captions {
            caption_item_ids.push(id.clone());
            candidates.push((None, span_bounds(span, fps)?));
        }
    } else if !explicit.is_empty() {
        basis = "explicit";
        for id in explicit {
            let item = find(id).ok_or_else(|| PlanError::new("ITEM_NOT_FOUND", format!("no item {id}")))?;
            candidates.push((Some(item), whole));
        }
    } else {
        let captions = displaying(sequence, &document.id);
        if !captions.is_empty() {
            basis = "caption-items";
            for (id, span) in captions {
                caption_item_ids.push(id.clone());
                let caption = find(id).and_then(|item| match item {
                    TimelineItem::Caption(c) => Some(c),
                    _ => None,
                });
                let limit = span_bounds(span, fps)?;
                match caption.map(|c| c.scope_item_ids.as_slice()).unwrap_or_default() {
                    [] => candidates.push((None, limit)),
                    ids => {
                        for scope_id in ids {
                            if let Some(item) = find(scope_id) {
                                candidates.push((Some(item), limit));
                            }
                        }
                    }
                }
            }
        } else {
            basis = "asset-items";
            let Some(asset_id) = &document.source_asset_id else {
                return Err(PlanError::new(
                    "EXPORT_SOURCE_UNPLACED",
                    "the document is on a source asset's clock, but it does not record which asset, and no caption item on the timeline displays it: provide the scoped items (scopeItemIds)",
                ));
            };
            let mut items: Vec<(Ratio, &TimelineItem)> = Vec::new();
            for item in &sequence.items {
                if source_asset(item).is_some_and(|asset| &asset == asset_id) {
                    items.push((item_bounds(item, fps)?.0, item));
                }
            }
            items.sort_by(|(a, x), (b, y)| a.cmp(b).then_with(|| x.base().id.cmp(&y.base().id)));
            candidates.extend(items.into_iter().map(|(_, item)| (Some(item), whole)));
        }
    }

    let mut taken = Taken::default();
    let mut projectors = Vec::new();
    let mut scope_item_ids: Vec<Id> = Vec::new();
    for (item, (limit_start, limit_end)) in candidates {
        let (bounds, map) = match item {
            None => ((limit_start, limit_end), None),
            Some(item) => {
                let Some(map) = linear_map(item)? else {
                    continue;
                };
                let bounds = item_bounds(item, fps)?;
                if !scope_item_ids.contains(&item.base().id) {
                    scope_item_ids.push(item.base().id.clone());
                }
                (bounds, Some((bounds.0, map)))
            }
        };
        let from = bounds.0.max(limit_start).max(range.0);
        let to = bounds.1.min(limit_end).min(range.1);
        if to <= from {
            continue;
        }
        let windows = taken.subtract((from, to));
        taken.add((from, to));
        projectors.push(Projector {
            item_id: item.map(|i| i.base().id.clone()),
            map,
            windows,
        });
    }
    if projectors.is_empty() && basis != "sequence" && scope_item_ids.is_empty() {
        return Err(PlanError::new(
            "EXPORT_SOURCE_UNPLACED",
            "no item on the timeline can project this document (its asset is not on the timeline, or every item is frozen)",
        ));
    }
    Ok((
        TextScope {
            basis: basis.into(),
            caption_item_ids,
            scope_item_ids,
        },
        projectors,
    ))
}

/// Caption instances that display this document (enabled), sorted by span start.
fn displaying<'a>(sequence: &'a Sequence, document_id: &Id) -> Vec<(&'a Id, FrameSpan)> {
    let mut found: Vec<(&Id, FrameSpan)> = sequence
        .items
        .iter()
        .filter_map(|item| match item {
            TimelineItem::Caption(c) if c.base.enabled && &c.document_id == document_id => Some((&c.base.id, c.span)),
            _ => None,
        })
        .collect();
    found.sort_by(|(x, a), (y, b)| a.from_frame.cmp(&b.from_frame).then_with(|| x.cmp(y)));
    found
}

/// Assets used by the instance: video and audio assets, the pre-rendered substitute of a composition (or the code package if none). Same as `scope_at` in the per-frame plan.
fn source_asset(item: &TimelineItem) -> Option<Id> {
    match item {
        TimelineItem::Video(v) => Some(v.asset_ref.id.clone()),
        TimelineItem::Audio(a) => Some(a.asset_ref.id.clone()),
        TimelineItem::Composition(c) => {
            let CompositionSource::Bundle { asset_ref } = &c.source;
            Some(c.prerender.as_ref().unwrap_or(asset_ref).id.clone())
        }
        _ => None,
    }
}

/// Linear mapping of a projectable instance. Freeze-frame, non-positive speed, or sourceless instances return `None`.
fn linear_map(item: &TimelineItem) -> Result<Option<TimeMapRef>, PlanError> {
    if source_asset(item).is_none() {
        return Ok(None);
    }
    let time_map = match item {
        TimelineItem::Video(v) => &v.time_map,
        TimelineItem::Audio(a) => &a.time_map,
        TimelineItem::Composition(c) => &c.time_map,
        _ => return Ok(None),
    };
    match time_map {
        TimeMap::Hold { .. } => Ok(None),
        TimeMap::Linear { source_in, rate } => {
            rate.validate("timeMap.rate")?;
            let rate = rate.ratio();
            if rate <= Ratio::ZERO {
                return Ok(None);
            }
            // Shares `map_time` with the per-frame plan: confirms that sourceIn is valid.
            map_time(time_map, Ratio::ZERO, Ratio::ZERO)?;
            Ok(Some(TimeMapRef {
                source_in: source_in.to_ratio("sourceIn")?,
                rate,
            }))
        }
    }
}

/// The span an instance occupies on the sequence: audio instances at sample level, others at frame level.
fn item_bounds(item: &TimelineItem, fps: editor_semantics::Rate) -> Result<(Ratio, Ratio), PlanError> {
    match item {
        TimelineItem::Audio(a) => audio_bounds(a, fps),
        other => span_bounds(other.span().expect("non-audio items are on the frame grid"), fps),
    }
}

/// Spans already taken by earlier candidates. With thousands of instances, subtracting pairwise is quadratic, so the taken spans are kept as a union sorted by start, with segments that neither overlap nor touch (the end of one segment is strictly less than the start of the next); both subtraction and union use binary search. The `explicit` and `caption-items` candidates are not sorted by start, so merging finds the segments that overlap or touch in general.
#[derive(Default)]
struct Taken(Vec<(Ratio, Ratio)>);

impl Taken {
    /// The part of `interval` left after subtracting the taken spans (in order). Same as pairwise subtraction (`subtract_pairwise` in the tests): the non-zero-length pieces of `interval` after removing these open intervals, with endpoints taken from the same values (`Ratio` is always reduced, so equal means the same value).
    fn subtract(&self, (start, end): (Ratio, Ratio)) -> Vec<(Ratio, Ratio)> {
        let mut parts = Vec::new();
        let mut cur = start;
        let first = self.0.partition_point(|&(_, b)| b <= start);
        for &(a, b) in self.0[first..].iter().take_while(|&&(a, _)| a < end) {
            if a > cur {
                parts.push((cur, a));
            }
            cur = cur.max(b);
        }
        if cur < end {
            parts.push((cur, end));
        }
        parts
    }

    fn add(&mut self, (start, end): (Ratio, Ratio)) {
        // The ones that overlap or touch it are `first..last`; if it falls entirely within one segment, the replacement is that segment.
        let first = self.0.partition_point(|&(_, b)| b < start);
        let last = self.0.partition_point(|&(a, _)| a <= end);
        let (mut lo, mut hi) = (start, end);
        if first < last {
            lo = lo.min(self.0[first].0);
            hi = hi.max(self.0[last - 1].1);
        }
        self.0.splice(first..last, [(lo, hi)]);
    }
}

/// The part of `interval` left after subtracting the spans in `taken` (in order). Pairwise subtraction; the tests compare `Taken` against it.
#[cfg(test)]
fn subtract_pairwise(interval: (Ratio, Ratio), taken: &[(Ratio, Ratio)]) -> Vec<(Ratio, Ratio)> {
    let mut parts = vec![interval];
    for &(a, b) in taken {
        let mut next = Vec::new();
        for (x, y) in parts {
            if b <= x || a >= y {
                next.push((x, y));
                continue;
            }
            if a > x {
                next.push((x, a));
            }
            if b < y {
                next.push((b, y));
            }
        }
        parts = next;
    }
    parts
}

// ---- Document body ----

fn timescale(body: &Value) -> Result<i64, PlanError> {
    match body.get("timescale").and_then(Value::as_i64) {
        Some(t) if t > 0 => Ok(t),
        _ => Err(PlanError::new("EXPORT_SOURCE_INVALID", "the document's timescale must be a positive integer")),
    }
}

fn ticks(value: Option<&Value>, timescale: i64, field: &str) -> Result<Ratio, PlanError> {
    let ticks = value
        .and_then(Value::as_i64)
        .ok_or_else(|| PlanError::new("EXPORT_SOURCE_INVALID", format!("{field} in the document must be an integer tick")))?;
    Ok(MediaTime {
        ticks: ticks.to_string(),
        timescale,
    }
    .to_ratio(field)?)
}

fn text_of(value: &Value) -> String {
    value.get("text").and_then(Value::as_str).unwrap_or_default().to_string()
}

fn string_field(value: &Value, field: &str) -> Option<String> {
    value.get(field).and_then(Value::as_str).map(str::to_string)
}

/// Caption document sentences: blank sentences are not shown (consistent with the timeline); reversed times are an error.
fn caption_entries(body: &Value) -> Result<Vec<SourceEntry>, PlanError> {
    let timescale = timescale(body)?;
    let cues = body
        .get("cues")
        .and_then(Value::as_array)
        .ok_or_else(|| PlanError::new("EXPORT_SOURCE_INVALID", "caption document has no cues"))?;
    let mut entries = Vec::new();
    for cue in cues {
        let text = text_of(cue);
        if text.trim().is_empty() {
            continue;
        }
        let start = ticks(cue.get("start"), timescale, "cues[].start")?;
        let end = ticks(cue.get("end"), timescale, "cues[].end")?;
        if end <= start {
            continue;
        }
        entries.push(SourceEntry {
            id: string_field(cue, "id").unwrap_or_default(),
            start,
            end,
            text,
            speaker: string_field(cue, "speaker"),
            sentence_id: None,
            paragraph_start: cue.get("paragraphStart").and_then(Value::as_bool).unwrap_or(false),
            word_timing: false,
        });
    }
    Ok(entries)
}

/// The span a zero-duration word takes in the gap after it: up to the start of the next word (hidden ones count too, since their timing still exists), at most one alignment step (0.08 s). When there is no following word, one step is added. Returns `None` when the next word starts right here (no gap). Same rule as `caption-cues.ts` in the caption layer.
fn zero_duration_slot(start: Ratio, next_start: Option<Ratio>) -> Option<Ratio> {
    let nominal = start.checked_add(Ratio::new(2, 25)?)?;
    match next_start {
        Some(next) if next <= start => None,
        Some(next) if next < nominal => Some(next),
        _ => Some(nominal),
    }
}

/// Words of a transcript document. Hidden words are not exported. A zero-duration word takes the gap after it (`zero_duration_slot`); words with no gap are skipped. When the document has sentence segmentation, each word is tagged with its sentence and whether it starts a paragraph.
///
/// Words that do not have word-level timing are recognized by two rules: the word has `timingQuality: 'estimated' | 'missing'` (interpolated, or a whole passage written as one word; see `speech-document.ts`), or the word's text contains a space (real words contain no whitespace; old documents have no `timingQuality`). They are given only the timing of the whole passage and do not pass for word-by-word sync (acceptance AT-05).
fn speech_entries(body: &Value) -> Result<Vec<SourceEntry>, PlanError> {
    let timescale = timescale(body)?;
    let words = body
        .get("words")
        .and_then(Value::as_array)
        .ok_or_else(|| PlanError::new("EXPORT_SOURCE_INVALID", "transcript document has no words"))?;
    let index: std::collections::HashMap<&str, usize> = words
        .iter()
        .enumerate()
        .filter_map(|(i, w)| w.get("id").and_then(Value::as_str).map(|id| (id, i)))
        .collect();
    // Word index → (sentence ID, whether it starts a paragraph).
    let mut sentence_of: Vec<Option<(String, bool)>> = vec![None; words.len()];
    if let Some(sentences) = body.get("sentences").and_then(Value::as_array) {
        for sentence in sentences {
            let Some(id) = string_field(sentence, "id") else {
                continue;
            };
            let paragraph = sentence.get("paragraphStart").and_then(Value::as_bool).unwrap_or(false);
            let members: Vec<usize> = if let Some(ids) = sentence.get("wordIds").and_then(Value::as_array) {
                ids.iter().filter_map(|w| w.as_str().and_then(|w| index.get(w).copied())).collect()
            } else {
                let first = sentence.get("first").and_then(Value::as_str).and_then(|w| index.get(w).copied());
                let last = sentence.get("last").and_then(Value::as_str).and_then(|w| index.get(w).copied());
                match (first, last) {
                    (Some(a), Some(b)) if a <= b => (a..=b).collect(),
                    _ => Vec::new(),
                }
            };
            for (n, i) in members.into_iter().enumerate() {
                sentence_of[i] = Some((id.clone(), paragraph && n == 0));
            }
        }
    }
    let mut entries = Vec::new();
    for (i, word) in words.iter().enumerate() {
        if word.get("hidden").and_then(Value::as_bool).unwrap_or(false) {
            continue;
        }
        let text = text_of(word);
        if text.trim().is_empty() {
            continue;
        }
        let start = ticks(word.get("start"), timescale, "words[].start")?;
        let mut end = ticks(word.get("end"), timescale, "words[].end")?;
        if end <= start {
            // Zero-duration words (word timing from transcription collapsed to a point): if there is a gap after, they take a small slot; they are skipped only when the next word starts right here.
            let next_start = words[i + 1..]
                .iter()
                .find_map(|next| ticks(next.get("start"), timescale, "words[].start").ok());
            match zero_duration_slot(start, next_start) {
                Some(slot) => end = slot,
                None => continue,
            }
        }
        let quality = word.get("timingQuality").and_then(Value::as_str);
        let word_timing = !matches!(quality, Some("estimated" | "missing")) && !text.trim().contains(char::is_whitespace);
        let (sentence_id, paragraph_start) = match &sentence_of[i] {
            Some((id, paragraph)) => (Some(id.clone()), *paragraph),
            None => (None, false),
        };
        entries.push(SourceEntry {
            id: string_field(word, "id").unwrap_or_default(),
            start,
            end,
            text,
            speaker: string_field(word, "speaker"),
            sentence_id,
            paragraph_start,
            word_timing,
        });
    }
    Ok(entries)
}

#[cfg(test)]
mod tests {
    use serde_json::{Value, json};
    use video_model::{DocumentRecord, VideoSnapshot};

    use super::{Ratio, Taken, VideoView, plan_text_scan, subtract_pairwise};

    /// The fixture video turned into many instances of the same source: two video tracks alternating front and back, with speed changes, repeatedly reusing the same source span, plus one audio instance and one caption instance.
    fn video(clips: usize) -> VideoSnapshot {
        let mut value: Value = serde_json::from_str(include_str!("../tests/fixtures/video.json")).expect("fixture");
        value["assets"] = json!({ "asset_a": { "id": "asset_a", "kind": "video", "name": "a", "currentRevision": "r1", "revisions": { "r1": {
            "revision": "r1", "contentHash": "sha256:a", "byteLength": 10, "mediaType": "video/mp4", "storage": { "mode": "managed" },
            "provenance": { "origin": "import" }, "audio": { "sampleRate": 48000, "channels": 2 } } } } });
        let track = |id: &str, order: i64, kind: &str| {
            json!({ "id": id, "order": order, "kind": kind, "locked": false, "visible": true, "muted": false,
                    "solo": { "enabled": false, "group": if kind == "audio" { "audio" } else { "visual" } } })
        };
        let sequence = &mut value["sequences"]["seq_main"];
        sequence["tracks"] = json!([
            track("v1", 0, "visual"),
            track("v2", 1, "visual"),
            track("a1", 0, "audio"),
            track("s1", 0, "subtitle")
        ]);
        let base = |id: &str, track: &str| json!({ "id": id, "trackId": track, "enabled": true, "locked": false, "paintOrder": 0, "followPolicy": { "kind": "sequence-fixed" } });
        let mut seed: u64 = 7;
        let mut next = |n: u64| {
            seed = seed.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
            (seed >> 33) % n
        };
        let mut items = Vec::new();
        let mut ids = Vec::new();
        for k in 0..clips {
            let id = format!("clip{k}");
            let mut item = base(&id, if k % 3 == 2 { "v2" } else { "v1" });
            let rate = [(1, 1), (2, 1), (1, 2), (3, 2)][next(4) as usize];
            item.as_object_mut().unwrap().extend(
                json!({
                    "type": "video", "span": { "fromFrame": next(1800), "durationFrames": 1 + next(240) },
                    "place": {}, "mode": "fullscreen", "fit": "contain", "assetRef": { "id": "asset_a", "revision": "r1" },
                    "timeMap": { "kind": "linear", "sourceIn": { "ticks": next(60_000).to_string(), "timescale": 1000 },
                                 "rate": { "num": rate.0, "den": rate.1 } },
                    "embeddedAudio": { "enabled": true, "volume": 1 },
                })
                .as_object()
                .unwrap()
                .clone(),
            );
            items.push(item);
            ids.push(id);
        }
        let mut audio = base("dub", "a1");
        audio.as_object_mut().unwrap().extend(
            json!({
                "type": "audio", "assetRef": { "id": "asset_a", "revision": "r1" }, "fromFrame": 300,
                "subframeOffset": { "ticks": "1", "timescale": 3000 }, "playDuration": { "ticks": "7", "timescale": 1 },
                "timeMap": { "kind": "linear", "sourceIn": { "ticks": "12", "timescale": 1 }, "rate": { "num": 1, "den": 1 } },
                "mix": { "volume": 1 },
            })
            .as_object()
            .unwrap()
            .clone(),
        );
        items.push(audio);
        let mut caption = base("cap", "s1");
        let scopes: Vec<&String> = ids.iter().step_by(2).collect();
        caption.as_object_mut().unwrap().extend(
            json!({ "type": "caption", "span": { "fromFrame": 90, "durationFrames": 1200 }, "documentId": "doc_cap", "scopeItemIds": scopes })
                .as_object()
                .unwrap()
                .clone(),
        );
        items.push(caption);
        sequence["items"] = Value::Array(items);
        serde_json::from_value(value).expect("video snapshot")
    }

    fn record(id: &str, kind: &str) -> DocumentRecord {
        serde_json::from_value(
            json!({ "id": id, "kind": kind, "name": id, "currentRevision": "d1", "revisions": {}, "sourceAssetId": "asset_a" }),
        )
        .expect("document header")
    }

    /// Words and sentences: mostly short, mixed with long sentences crossing cut points, overlapping sentences, and duplicate IDs.
    fn body(schema: &str, clock: &str) -> Value {
        let mut list = Vec::new();
        for k in 0..400i64 {
            let start = k * 170;
            let end = start + if k % 37 == 0 { 9_000 } else { 120 + (k % 5) * 40 };
            let id = if k % 97 == 0 { "dup".to_string() } else { format!("e{k}") };
            list.push(json!({ "id": id, "start": start, "end": end, "text": format!("t{k}") }));
        }
        let key = if schema == "cuccut.caption/1" { "cues" } else { "words" };
        json!({ "schema": schema, "clock": clock, "timescale": 1000, key: list })
    }

    #[test]
    fn candidate_pairs_match_the_full_scan() {
        let video = video(60);
        let view = || VideoView::from(&video);
        let r = |a: i128, b: i128| Some((Ratio::from_int(a).unwrap(), Ratio::from_int(b).unwrap()));
        let ranges = [None, r(3, 40), r(20, 21)];
        let cases: [(&str, &str, &str, &[&str]); 5] = [
            ("doc_cap", "caption", "cuccut.caption/1", &[]),
            ("doc_speech", "speech", "cuccut.speech/1", &[]),
            ("doc_speech", "speech", "cuccut.speech/1", &["clip3", "clip4", "dub", "clip3"]),
            ("doc_cap", "caption", "cuccut.caption/1", &["dub", "clip10"]),
            ("doc_seq", "caption", "cuccut.caption/1", &[]),
        ];
        for (id, kind, schema, scope) in cases {
            let clock = if id == "doc_seq" { "sequence" } else { "source-asset" };
            let body = body(schema, clock);
            let scope: Vec<String> = scope.iter().map(|s| s.to_string()).collect();
            for range in ranges {
                let fast = plan_text_scan(view(), "seq_main", &record(id, kind), &body, &scope, range, false).expect("projection");
                let full = plan_text_scan(view(), "seq_main", &record(id, kind), &body, &scope, range, true).expect("projection");
                assert!(range.is_some() || full.entries.len() > 20, "{id} {scope:?}: the fixture must actually project something");
                assert_eq!(fast, full, "{id} {scope:?} {range:?}");
            }
        }
    }

    /// Subtracting the union of taken spans gives the same result as pairwise subtraction. The candidates are not sorted by start (`explicit`, `caption-items`): they overlap, touch, nest, share the same span, or cover several earlier segments.
    #[test]
    fn merged_taken_matches_pairwise_subtract() {
        let mut seed: u64 = 3;
        let mut next = |n: i128| {
            seed = seed.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
            ((seed >> 33) % n as u64) as i128
        };
        let q = |num: i128, den: i128| Ratio::new(num, den).unwrap();
        for _ in 0..200 {
            let mut taken = Taken::default();
            let mut raw: Vec<(Ratio, Ratio)> = Vec::new();
            for _ in 0..60 {
                let den = [1, 2, 3][next(3) as usize];
                let fresh = |next: &mut dyn FnMut(i128) -> i128| {
                    let start = q(next(600) - 100, den);
                    (start, start.checked_add(q(1 + next(60), den)).unwrap())
                };
                let (start, end) = match raw.get(next(raw.len().max(1) as i128) as usize).copied() {
                    None => fresh(&mut next),
                    Some((a, b)) => match next(6) {
                        // Adjacent to a segment, after or before it
                        0 => (b, b.checked_add(q(1 + next(30), den)).unwrap()),
                        1 => (a.checked_sub(q(1 + next(30), den)).unwrap(), a),
                        // Nested inside a segment, or the same span as it
                        2 => {
                            let length = b.checked_sub(a).unwrap();
                            let inner = |k: i128| a.checked_add(length.checked_mul(q(k, 8)).unwrap()).unwrap();
                            let from = next(8);
                            (inner(from), inner(from + 1 + next(8 - from)))
                        }
                        // Covers a segment
                        3 => (a.checked_sub(q(next(20), den)).unwrap(), b.checked_add(q(next(20), den)).unwrap()),
                        _ => fresh(&mut next),
                    },
                };
                let probe = fresh(&mut next);
                assert_eq!(taken.subtract(probe), subtract_pairwise(probe, &raw), "{probe:?} minus {raw:?}");
                assert_eq!(
                    taken.subtract((start, end)),
                    subtract_pairwise((start, end), &raw),
                    "{start:?}..{end:?} minus {raw:?}"
                );
                taken.add((start, end));
                raw.push((start, end));
                assert!(taken.0.iter().all(|&(a, b)| a < b), "{:?}", taken.0);
                assert!(
                    taken.0.windows(2).all(|w| w[0].1 < w[1].0),
                    "the union must be sorted by start and non-touching: {:?}",
                    taken.0
                );
            }
        }
    }
}
