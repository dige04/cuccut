//! Editorial proposals (video format spec §6.2): `proposeCuts` detects verbal tics (filler words) and long pauses from the transcript and writes the suggestions into the source asset's editorial proposal document (`cuccut.editorial-proposal/1`, at most one per asset). `acceptCutSuggestions` compiles the accepted suggestions into cut points (`addCuts`, with `ref` being the suggestion's ID), and marks them `accepted` in the same transaction.
//!
//! - Detection reuses `timeline::detect` (verbal tics and pauses; default parameters match the old version). Hidden words and words without time take no part. Repeated segments have no detector, so none are produced.
//! - A suggestion that already lies entirely inside a cut is not proposed again. Suggestions beyond the asset's duration are dropped.
//! - A suggestion records the transcript version that detection read. If the transcript has changed since, accepting is rejected as a whole (`details.rule: 'proposal-stale'`), and the proposal must be made again.

use std::collections::{BTreeMap, BTreeSet, HashMap};

use editor_semantics::{MAX_SAFE_INTEGER, Ratio};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use timeline::detect::{
    ChapterWindow, CutProposal, DetectWord, FillerOptions, SilenceOptions, detect_fillers, detect_silences, merge_proposals,
    normalize_filler, skip_already_cut,
};
use video_model::editorial_proposal::{
    EDITORIAL_PROPOSAL_KIND, EDITORIAL_PROPOSAL_SCHEMA, EditorialProposalBody, ProposalSpeechRef, Suggestion, SuggestionKind,
    SuggestionStatus, editorial_proposal_body_problems,
};
use video_model::speech::SpeechBody;

use crate::cuts::{CutRange, add_cut_ranges, current_cut_set, source_duration};
use crate::error::{EngineResult, ErrorBody, kinds, msg};
use crate::model::*;
use crate::ops::{AssetTarget, EditContext, PutDocumentInput, put_document};
use crate::state::VideoState;

/// The kind of a transcript document.
const SPEECH_KIND: &str = "speech";

/// Detection parameters for `proposeCuts`. Those not given use the old defaults: pauses of 0.8 seconds or more, compressed to 0.3 seconds; pauses of 3 seconds or more are not counted as pauses; verbal tics cover Chinese and English, including soft tics.
#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct DetectInput {
    /// Detect long pauses; default true.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pauses: Option<bool>,
    /// Detect verbal tics (filler words); default true.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub fillers: Option<bool>,
    /// Decimal seconds.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub min_pause: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub compress_to: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub max_gap: Option<String>,
    /// `auto` (English, Chinese and Vietnamese), `en`, `zh` or `vi`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub filler_language: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub custom_fillers: Vec<String>,
    /// Pauses between chapters are also compressed; default false.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub trim_chapter_starts: Option<bool>,
}

/// The editorial proposal document of the source asset (at most one).
pub fn proposal_document(state: &VideoState, asset_id: &str) -> Option<Id> {
    state
        .documents
        .values()
        .filter(|d| d.kind == EDITORIAL_PROPOSAL_KIND && d.source_asset_id.as_deref() == Some(asset_id))
        .map(|d| d.id.clone())
        .min()
}

/// The transcript that detection reads: the one given, or the asset's only transcript; when there are several, one must be given.
pub fn speech_document(state: &VideoState, asset_id: &str, explicit: Option<&str>) -> EngineResult<Id> {
    if let Some(id) = explicit {
        let record = state
            .documents
            .get(id)
            .filter(|d| d.kind == SPEECH_KIND)
            .ok_or_else(|| ErrorBody::not_found(kinds::transcript(), id))?;
        if record.source_asset_id.as_deref() != Some(asset_id) {
            return Err(
                ErrorBody::invalid_operation(msg!(
                    "engine.transcriptOtherAsset",
                    "Transcript {transcript} does not belong to asset {asset}",
                    transcript = id,
                    asset = asset_id
                )).entities([id.to_string(), asset_id.to_string()])
            );
        }
        return Ok(id.to_string());
    }
    let found: Vec<Id> = state
        .documents
        .values()
        .filter(|d| d.kind == SPEECH_KIND && d.source_asset_id.as_deref() == Some(asset_id))
        .map(|d| d.id.clone())
        .collect();
    match found.as_slice() {
        [] => Err(ErrorBody::not_found(kinds::asset_transcript(), asset_id)),
        [one] => Ok(one.clone()),
        _ => Err(ErrorBody::invalid_operation(msg!(
            "engine.transcriptAmbiguous",
            "The asset has several transcripts; use speechDocumentId to pick one"
        ))
            .entities(found.clone())
            .details(json!({ "rule": "speech-ambiguous" }))),
    }
}

/// The document's body within this transaction: a body written earlier takes precedence; otherwise it is the body read outside the transaction.
fn body_of(ctx: &EditContext<'_>, id: &str) -> EngineResult<Value> {
    match ctx.documents.iter().rev().find(|d| d.document_id == id) {
        Some(written) => serde_json::from_str(&written.body).map_err(|e| ErrorBody::storage(msg!(
            "engine.documentBodyCorrupt",
            "The body of document {id} is corrupt: {error}",
            id,
            error = e.to_string()
        ))),
        None => ctx
            .document_bodies
            .get(id)
            .cloned()
            .ok_or_else(|| ErrorBody::storage(msg!("engine.documentBodyNotLoaded", "The body of document {id} was not loaded", id))),
    }
}

fn seconds(text: &Option<String>, field: &str, default: f64) -> EngineResult<f64> {
    match text {
        Some(t) => Ok(editor_semantics::parse_decimal_seconds(t, field)?.to_f64()),
        None => Ok(default),
    }
}

/// Detection parameters are checked by the old version's rules: the pause length must be positive, the compressed length must be less than the minimum pause, and the maximum pause must be greater than the minimum pause. When neither kind of detection is on, there is nothing to do.
fn options(input: &DetectInput) -> EngineResult<(Option<SilenceOptions>, Option<FillerOptions>)> {
    let pauses = input.pauses.unwrap_or(true);
    let fillers = input.fillers.unwrap_or(true);
    if !pauses && !fillers {
        return Err(ErrorBody::invalid_operation(msg!(
            "engine.detectNothing",
            "With both pauses and fillers turned off there is nothing to detect"
        )));
    }
    let min_pause = seconds(&input.min_pause, "minPause", 0.8)?;
    let compress_to = seconds(&input.compress_to, "compressTo", 0.3)?;
    let max_gap = seconds(&input.max_gap, "maxGap", 3.0)?;
    if min_pause <= 0.0 || compress_to <= 0.0 {
        return Err(ErrorBody::invalid_operation(msg!(
            "engine.pauseSecondsPositive",
            "minPause and compressTo must be positive numbers of seconds"
        )));
    }
    if compress_to >= min_pause {
        return Err(ErrorBody::invalid_operation(msg!("engine.compressToRange", "compressTo must be less than minPause")));
    }
    if max_gap <= min_pause {
        return Err(ErrorBody::invalid_operation(msg!("engine.maxGapRange", "maxGap must be greater than minPause")));
    }
    let langs = match input.filler_language.as_deref().unwrap_or("auto").to_ascii_lowercase().as_str() {
        "auto" => vec!["en".to_owned(), "zh".to_owned(), "vi".to_owned()],
        "en" => vec!["en".to_owned()],
        "zh" => vec!["zh".to_owned()],
        "vi" => vec!["vi".to_owned()],
        other => {
            return Err(ErrorBody::invalid_operation(msg!(
                "engine.fillerLanguageInvalid",
                "fillerLanguage must be auto, en, zh or vi (got {value})",
                value = other
            )));
        }
    };
    let mut seen = BTreeSet::new();
    let custom = input
        .custom_fillers
        .iter()
        .map(|v| normalize_filler(v.trim()))
        .filter(|v| !v.is_empty() && seen.insert(v.clone()))
        .collect();
    let silence = pauses.then_some(SilenceOptions {
        threshold: min_pause,
        compress_to,
        sentence_compress_to: compress_to.max((compress_to + 0.1).min(0.5)),
        max_gap,
        trim_chapter_starts: input.trim_chapter_starts.unwrap_or(false),
    });
    let filler = fillers.then_some(FillerOptions {
        langs,
        custom,
        include_soft: true,
    });
    Ok((silence, filler))
}

fn lcm(a: i128, b: i128) -> i128 {
    let gcd = |mut x: i128, mut y: i128| {
        while y != 0 {
            (x, y) = (y, x % y);
        }
        x
    };
    a / gcd(a, b) * b
}

/// Join two pieces of text: if both sides are Latin letters or digits, separate them with one space; otherwise join them directly (no space for Chinese).
fn join_text(words: &[&str]) -> String {
    let mut out = String::new();
    for w in words {
        let w = w.trim();
        if out.chars().last().is_some_and(|c| c.is_ascii_alphanumeric()) && w.chars().next().is_some_and(|c| c.is_ascii_alphanumeric()) {
            out.push(' ');
        }
        out.push_str(w);
    }
    out
}

/// Detect verbal tics and long pauses from the transcript, and write them into the source asset's editorial proposal (§6.2).
pub(crate) fn propose_cuts(
    state: &mut VideoState,
    asset_id: &str,
    speech_document_id: Option<&str>,
    detect: &DetectInput,
    ctx: &mut EditContext<'_>,
) -> EngineResult<()> {
    let duration = source_duration(state, asset_id)?;
    let (silence, filler) = options(detect)?;
    let speech_id = speech_document(state, asset_id, speech_document_id)?;
    let speech_revision = state.documents[&speech_id].current_revision.clone();
    let speech: SpeechBody = serde_json::from_value(body_of(ctx, &speech_id)?)
        .map_err(|e| ErrorBody::invalid_operation(msg!(
            "engine.transcriptBodyUnreadable",
            "The body of the transcript cannot be read: {error}",
            error = e.to_string()
        )).entities([speech_id.clone()]))?;
    let speech_scale = i128::from(speech.timescale.unwrap_or(1_000_000));
    if speech_scale <= 0 {
        return Err(ErrorBody::invalid_operation(msg!(
            "engine.transcriptTimescalePositive",
            "The timescale of the transcript must be positive"
        )).entities([speech_id]));
    }
    let scale = lcm(speech_scale, 100);
    if scale > MAX_SAFE_INTEGER {
        return Err(ErrorBody::invalid_operation(msg!(
            "engine.transcriptTimescaleTooLarge",
            "The timescale of the transcript is too large for suggestions to be exact"
        )).entities([speech_id]));
    }
    let factor = scale / speech_scale;

    // Hidden words and words without time take no part (consistent with the old version).
    let mut ticks: HashMap<&str, (i128, i128, &str)> = HashMap::new();
    let mut words = Vec::new();
    for w in &speech.words {
        let (Some(start), Some(end)) = (w.start, w.end) else { continue };
        if w.hidden == Some(true) || end < start {
            continue;
        }
        ticks.insert(w.id.as_str(), (i128::from(start), i128::from(end), w.text.as_str()));
        words.push(DetectWord {
            id: w.id.clone(),
            t0: start as f64 / speech_scale as f64,
            t1: end as f64 / speech_scale as f64,
            text: w.text.clone(),
            speaker: w.speaker.clone().unwrap_or_default(),
        });
    }
    let chapters: Vec<ChapterWindow> = speech
        .chapters
        .iter()
        .flatten()
        .map(|c| ChapterWindow {
            start: c.start as f64 / speech_scale as f64,
            end: c.end as f64 / speech_scale as f64,
        })
        .collect();
    let mut found: Vec<CutProposal> = silence.map(|o| detect_silences(&words, &chapters, o)).unwrap_or_default();
    if let Some(o) = &filler {
        found.extend(detect_fillers(&words, o));
    }
    let found = skip_already_cut(merge_proposals(found), &current_cut_set(state, ctx, asset_id)?);

    let mut suggestions = Vec::new();
    for p in found {
        let (kind, t0, t1, text) = if p.kind == "filler" {
            let first = p.word_ids.first().and_then(|id| ticks.get(id.as_str()));
            let last = p.word_ids.last().and_then(|id| ticks.get(id.as_str()));
            let (Some(first), Some(last)) = (first, last) else { continue };
            let texts: Vec<&str> = p.word_ids.iter().filter_map(|id| ticks.get(id.as_str()).map(|t| t.2)).collect();
            (SuggestionKind::Filler, first.0 * factor, last.1 * factor, join_text(&texts))
        } else {
            // Pause boundaries are seconds with two decimal places, and the scale includes 100, so the conversion is exact.
            let at = |t: f64| (t * scale as f64).round() as i128;
            (SuggestionKind::Pause, at(p.t0), at(p.t1), String::new())
        };
        let (Some(r0), Some(r1)) = (Ratio::new(t0, scale), Ratio::new(t1, scale)) else {
            continue;
        };
        if r0.is_negative() || r1 <= r0 || r1 > duration {
            continue;
        }
        suggestions.push(Suggestion {
            id: p.id,
            kind,
            t0: t0.to_string(),
            t1: t1.to_string(),
            word_ids: p.word_ids,
            after_word_id: p.after_word,
            text,
            reason: p.reason,
            detail: p.detail,
            confidence: None,
            status: SuggestionStatus::Pending,
        });
    }
    suggestions.sort_by(|a, b| {
        let key = |s: &Suggestion| s.t0.parse::<i128>().unwrap_or(0);
        key(a).cmp(&key(b)).then_with(|| a.id.cmp(&b.id))
    });
    let body = EditorialProposalBody {
        schema: EDITORIAL_PROPOSAL_SCHEMA.to_string(),
        timescale: scale as u64,
        clock: "source-asset".to_string(),
        speech_ref: ProposalSpeechRef {
            id: speech_id,
            revision: speech_revision,
        },
        suggestions,
    };
    let existing = proposal_document(state, asset_id);
    write(state, ctx, asset_id, existing.as_deref(), &body)
}

fn write(
    state: &mut VideoState,
    ctx: &mut EditContext<'_>,
    asset_id: &str,
    existing: Option<&str>,
    body: &EditorialProposalBody,
) -> EngineResult<()> {
    let body = serde_json::to_value(body).expect("剪辑提案可以序列化");
    let target = AssetTarget::Id {
        asset_id: asset_id.to_string(),
    };
    put_document(
        state,
        PutDocumentInput {
            document_id: existing,
            reference: None,
            kind: EDITORIAL_PROPOSAL_KIND,
            name: existing.is_none().then_some("剪辑建议"),
            language: None,
            source_asset: Some(&target),
            source_document: None,
            body: &body,
            summary: None,
            extensions: &BTreeMap::new(),
        },
        ctx,
    )
}

/// Accept the suggestions in an editorial proposal: compile them into cut points (`ref` is the suggestion's ID) and mark them `accepted`, in one transaction (§6.2).
pub(crate) fn accept_cut_suggestions(
    state: &mut VideoState,
    sequence_id: Option<&str>,
    proposal_id: &str,
    suggestion_ids: &[Id],
    ctx: &mut EditContext<'_>,
) -> EngineResult<()> {
    if suggestion_ids.is_empty() {
        return Err(ErrorBody::invalid_operation(msg!(
            "engine.acceptSuggestionsEmpty",
            "acceptCutSuggestions must accept at least one suggestion"
        )));
    }
    let record = state
        .documents
        .get(proposal_id)
        .filter(|d| d.kind == EDITORIAL_PROPOSAL_KIND)
        .ok_or_else(|| ErrorBody::not_found(kinds::cut_proposal(), proposal_id))?;
    let asset_id = record
        .source_asset_id
        .clone()
        .ok_or_else(|| ErrorBody::invalid_operation(msg!("engine.proposalNoSource", "The cut proposal has no source asset")).entities([proposal_id.to_string()]))?;
    let value = body_of(ctx, proposal_id)?;
    let problems = editorial_proposal_body_problems(&value);
    if !problems.is_empty() {
        return Err(
            ErrorBody::invalid_operation(msg!(
                "engine.bodyNotSchema",
                "The body does not match {schema}: {problems}",
                schema = EDITORIAL_PROPOSAL_SCHEMA,
                problems = message_ref::join(problems)
            ))
                .entities([proposal_id.to_string()]),
        );
    }
    let mut body: EditorialProposalBody = serde_json::from_value(value).expect("刚核对过形状");
    let current = state.documents.get(&body.speech_ref.id).map(|d| d.current_revision.as_str());
    if current != Some(body.speech_ref.revision.as_str()) {
        return Err(
            ErrorBody::invalid_operation(msg!(
                "engine.proposalStale",
                "The transcript changed after the suggestions were made, so they are out of date; run proposeCuts again"
            ))
                .entities([proposal_id.to_string(), body.speech_ref.id.clone()])
                .details(json!({ "rule": "proposal-stale", "speechRevision": body.speech_ref.revision, "currentRevision": current })),
        );
    }
    let mut ranges = Vec::new();
    let mut accepted = BTreeSet::new();
    for id in suggestion_ids {
        if !accepted.insert(id.clone()) {
            continue;
        }
        let s = body
            .suggestions
            .iter()
            .find(|s| &s.id == id)
            .ok_or_else(|| ErrorBody::not_found(kinds::suggestion(), id))?;
        let (t0, t1) = s.range(body.timescale).expect("刚核对过刻度");
        ranges.push(CutRange {
            t0,
            t1,
            reference: Some(id.clone()),
        });
    }
    add_cut_ranges(state, sequence_id, &asset_id, &ranges, ctx)?;
    for s in &mut body.suggestions {
        if accepted.contains(&s.id) {
            s.status = SuggestionStatus::Accepted;
        }
    }
    write(state, ctx, &asset_id, Some(proposal_id), &body)
}
