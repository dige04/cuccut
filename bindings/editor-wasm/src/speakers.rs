//! Speaker identification for an existing transcript (architecture design §6.6): the speaker-embedding clusters projected onto words become a proposal, which is applied only after the user confirms.
//!
//! - [`speaker_proposal`]: transcript body + translations in each language + the speaker-embedding cluster each word projects to (`cuccut.speakers/v1` from the Model Worker) →
//!   a proposal: which words change speaker, each speaker's sentence count and preview clips, and how many translation entries will be re-split at the new boundaries. Clusters are matched one-to-one with existing speakers by overlap duration, reusing them
//!   (keeping their ID and name, so the voice bindings in the library and the dubbing speaker bindings stay intact); unmatched clusters get a new `spk-<n>`, named
//!   “说话人 n” (Speaker n). The rules are ported unchanged from the older version's `speakers reidentify`; words with no speaker (the reserved `""`) do not take part in reuse.
//! - [`apply_speakers`]: transcript body + translations + the proposal's speaker-change table + the speaker table (names the user edited on the confirmation page) → the body and the changed translations to write back.
//!   Applying is done by `apply_speaker_proposal` in the subtitle and translation core: when new speaker boundaries split a sentence, existing translations are re-split at natural break points in the target language,
//!   without re-translating.
//!
//! Both are pure functions. A proposal is a dry run of the apply step (the same function), so the numbers on the confirmation page are the numbers after applying.

use std::collections::{BTreeMap, BTreeSet, HashMap};

use editor_semantics::MediaTime;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use speech_doc::TranscriptDoc;
use speech_doc::doc::Speaker;
use speech_doc::speaker_apply::{SpeakerApplyReport, apply_speaker_proposal};
use speech_doc_bridge::sentences::source_sentences;
use speech_doc_bridge::{MediaFacts, V3Documents, WriteBase, from_transcript_doc, to_transcript_doc};
use video_model::speech::SpeechBody;
use video_model::translation::TranslationBody;

use crate::{EntryError, invalid_input};

/// Reserved ID for words with no speaker (video format spec §5.2).
const NO_SPEAKER: &str = "";
/// Number of preview clips per speaker.
const CLIPS_PER_SPEAKER: usize = 3;
/// Preview clips prefer sentences at least this long (seconds).
const CLIP_MIN_SECONDS: f64 = 1.5;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ProposalInput {
    speech: SpeechBody,
    #[serde(default)]
    translations: Vec<TranslationBody>,
    /// Parallel to `speech.words`: the speaker-embedding cluster each word projects to; null for words with no evidence.
    labels: Vec<Option<String>>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ApplyInput {
    speech: SpeechBody,
    #[serde(default)]
    translations: Vec<TranslationBody>,
    /// Words that change speaker: word ID → speaker ID.
    word_speakers: BTreeMap<String, String>,
    /// Speakers and names in the proposal (names edited on the confirmation page are here); existing speakers not listed are left unchanged.
    speakers: Vec<SpeakerName>,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct SpeakerName {
    id: String,
    name: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ProposalOutput {
    /// Words that change speaker: word ID → speaker ID (changed words only).
    word_speakers: BTreeMap<String, String>,
    /// Speakers after applying, in order of first appearance in the body.
    speakers: Vec<ProposedSpeaker>,
    /// Number of words whose speaker changed; 0 means the proposal matches the current state.
    relabeled: usize,
    /// Number of translation entries that will be re-split at the new boundaries (summed across languages).
    translations_split: usize,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ProposedSpeaker {
    id: String,
    name: String,
    /// Speakers not present in the body before.
    is_new: bool,
    words: usize,
    /// Total duration of this speaker's words (seconds).
    seconds: f64,
    sentences: usize,
    clips: Vec<Clip>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Clip {
    sentence_id: String,
    /// Ticks in the body's `timescale`.
    start: i64,
    end: i64,
    text: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ApplyOutput {
    speech: Value,
    /// Parallel to the input translations: the whole new body where changed, null where unchanged.
    translations: Vec<Option<Value>>,
    relabeled: usize,
    translations_split: usize,
    sentences_split: usize,
    /// Content that the v3 format cannot hold and was dropped on write-back (should normally be empty).
    dropped: Vec<String>,
}

fn invalid_speech(message: impl Into<String>) -> EntryError {
    EntryError {
        code: "INVALID_SPEECH",
        message: message.into(),
    }
}

fn invalid_proposal(message: impl Into<String>) -> EntryError {
    EntryError {
        code: "INVALID_PROPOSAL",
        message: message.into(),
    }
}

/// Sentences and speakers look only at words; the source-media facts are placeholders, and the duration is the end of the last word (the core requires words not to exceed the duration).
pub(crate) fn media_for(body: &SpeechBody) -> MediaFacts {
    let timescale = body.timescale.unwrap_or(1_000_000);
    let end = body.words.iter().filter_map(|word| word.end).max().unwrap_or(0);
    MediaFacts {
        asset_id: None,
        path: None,
        content_hash: String::new(),
        duration: MediaTime {
            ticks: end.max(0).to_string(),
            timescale,
        },
        sample_rate: None,
    }
}

/// One transcript can have several translations in the same language (each translation run creates a new one). The subtitle and translation core keys by language, so before entering the core the language is swapped for an ordinal key,
/// and swapped back after write-back.
fn keyed(translations: &[TranslationBody]) -> Vec<TranslationBody> {
    translations
        .iter()
        .enumerate()
        .map(|(index, body)| TranslationBody {
            language: format!("t{index}"),
            ..body.clone()
        })
        .collect()
}

fn load(speech: &SpeechBody, translations: &[TranslationBody]) -> Result<TranscriptDoc, EntryError> {
    let media = media_for(speech);
    to_transcript_doc(&V3Documents {
        media: &media,
        language: None,
        speech,
        translations,
    })
    .map_err(|error| invalid_speech(error.message))
}

/// Clusters → speakers: match existing speakers one-to-one by overlap duration, largest first; create new ones for unmatched clusters.
fn map_clusters(doc: &TranscriptDoc, labels: &[Option<String>]) -> (BTreeMap<String, String>, BTreeMap<String, Speaker>) {
    let mut overlap: BTreeMap<(&str, &str), f64> = BTreeMap::new();
    for (word, label) in doc.words.iter().zip(labels) {
        if let Some(cluster) = label
            && word.sp != NO_SPEAKER
        {
            *overlap.entry((cluster.as_str(), word.sp.as_str())).or_default() += (word.t1 - word.t0).max(0.01);
        }
    }
    let mut candidates = overlap
        .into_iter()
        .map(|((cluster, speaker), seconds)| (seconds, cluster, speaker))
        .collect::<Vec<_>>();
    candidates.sort_by(|left, right| right.0.total_cmp(&left.0).then(left.1.cmp(right.1)).then(left.2.cmp(right.2)));
    let mut cluster_to_speaker = BTreeMap::new();
    let mut claimed = BTreeSet::new();
    for (_, cluster, speaker) in candidates {
        if cluster_to_speaker.contains_key(cluster) || claimed.contains(speaker) {
            continue;
        }
        cluster_to_speaker.insert(cluster.to_owned(), speaker.to_owned());
        claimed.insert(speaker);
    }

    // New speakers are numbered in the order their clusters first appear, continuing after the existing `spk-<n>`.
    let mut new_speakers = BTreeMap::new();
    let mut next_number = doc
        .speakers
        .keys()
        .filter_map(|id| id.strip_prefix("spk-")?.parse::<usize>().ok())
        .max()
        .unwrap_or(0)
        + 1;
    let names = doc.speakers.values().map(|speaker| speaker.name.clone()).collect::<BTreeSet<_>>();
    let mut seen = BTreeSet::new();
    for cluster in labels.iter().flatten() {
        if !seen.insert(cluster.as_str()) || cluster_to_speaker.contains_key(cluster) {
            continue;
        }
        // Neither the ID nor the name may collide with existing ones (speakers imported from an old project may be named “说话人 1” (Speaker 1) with an ID that is not `spk-1`).
        while doc.speakers.contains_key(&format!("spk-{next_number}")) || names.contains(&format!("说话人 {next_number}")) {
            next_number += 1;
        }
        let id = format!("spk-{next_number}");
        new_speakers.insert(
            id.clone(),
            Speaker {
                name: format!("说话人 {next_number}"),
                hue: None,
            },
        );
        cluster_to_speaker.insert(cluster.clone(), id);
        next_number += 1;
    }
    (cluster_to_speaker, new_speakers)
}

/// Applies once (shared by the proposal's dry run and the real apply). Returns the document after applying and the core's report.
fn run_apply(
    doc: &TranscriptDoc,
    word_speakers: &BTreeMap<String, String>,
    speakers: &BTreeMap<String, Speaker>,
) -> Result<(TranscriptDoc, SpeakerApplyReport), EntryError> {
    let mut next = doc.clone();
    let report = apply_speaker_proposal(&mut next, word_speakers, speakers, &[]).map_err(|error| invalid_proposal(error.to_string()))?;
    Ok((next, report))
}

/// Original translation entries split per language: among split sentences, those that had a translation in that language.
fn split_count(before: &TranscriptDoc, report: &SpeakerApplyReport) -> usize {
    before
        .trans
        .values()
        .map(|table| {
            report
                .sentences_split
                .iter()
                .filter(|id| table.get(*id).is_some_and(|text| !text.trim().is_empty()))
                .count()
        })
        .sum()
}

fn write_back(
    doc: &TranscriptDoc,
    speech: &SpeechBody,
    translations: &[TranslationBody],
) -> Result<speech_doc_bridge::V3Write, EntryError> {
    from_transcript_doc(
        doc,
        &WriteBase {
            speech: Some(speech),
            translations,
            source_basis: None,
        },
    )
    .map_err(|error| invalid_speech(error.message))
}

/// Proposal (JSON). A body that cannot be parsed is `INVALID_SPEECH`; `labels` whose length differs from the word count is `INVALID_PROPOSAL`.
pub fn speaker_proposal(input: &[u8]) -> Result<String, EntryError> {
    let input: ProposalInput = serde_json::from_slice(input).map_err(invalid_input)?;
    if input.labels.len() != input.speech.words.len() {
        return Err(invalid_proposal(format!(
            "labels 有 {} 个，正文有 {} 个词",
            input.labels.len(),
            input.speech.words.len()
        )));
    }
    let translations = keyed(&input.translations);
    let doc = load(&input.speech, &translations)?;
    let (cluster_to_speaker, new_speakers) = map_clusters(&doc, &input.labels);
    let word_speakers = doc
        .words
        .iter()
        .zip(&input.labels)
        .filter_map(|(word, label)| {
            let speaker = cluster_to_speaker.get(label.as_ref()?)?;
            (speaker != &word.sp).then(|| (word.id.clone(), speaker.clone()))
        })
        .collect::<BTreeMap<_, _>>();
    let (after, report) = run_apply(&doc, &word_speakers, &new_speakers)?;
    let translations_split = split_count(&doc, &report);
    let written = write_back(&after, &input.speech, &translations)?;

    let timescale = written.speech.timescale.unwrap_or(1_000_000) as f64;
    let sentences = source_sentences(&written.speech).map_err(|error| invalid_speech(error.message))?;
    let mut by_speaker: HashMap<&str, Vec<&speech_doc_bridge::sentences::SourceSentence>> = HashMap::new();
    for sentence in &sentences.sentences {
        by_speaker
            .entry(sentence.speaker.as_deref().unwrap_or(NO_SPEAKER))
            .or_default()
            .push(sentence);
    }
    let mut order = Vec::<&str>::new();
    let mut stats: HashMap<&str, (usize, f64)> = HashMap::new();
    for word in &after.words {
        if word.sp == NO_SPEAKER {
            continue;
        }
        if !stats.contains_key(word.sp.as_str()) {
            order.push(word.sp.as_str());
        }
        let entry = stats.entry(word.sp.as_str()).or_default();
        entry.0 += 1;
        entry.1 += (word.t1 - word.t0).max(0.0);
    }
    let speakers = order
        .into_iter()
        .map(|id| {
            let (words, seconds) = stats[id];
            let own = by_speaker.get(id).map(Vec::as_slice).unwrap_or_default();
            ProposedSpeaker {
                id: id.to_owned(),
                name: after.speakers.get(id).map(|speaker| speaker.name.clone()).unwrap_or_default(),
                is_new: !doc.speakers.contains_key(id),
                words,
                seconds: (seconds * 1000.0).round() / 1000.0,
                sentences: own.len(),
                clips: pick_clips(own, timescale),
            }
        })
        .collect();
    let output = ProposalOutput {
        word_speakers,
        speakers,
        relabeled: report.relabeled,
        translations_split,
    };
    Ok(serde_json::to_string(&output).expect("提案总能序列化"))
}

/// Preview clips: pick several sentences evenly from this speaker's sentences, preferring ones that are not too short.
fn pick_clips(sentences: &[&speech_doc_bridge::sentences::SourceSentence], timescale: f64) -> Vec<Clip> {
    let long = sentences
        .iter()
        .copied()
        .filter(|sentence| (sentence.end - sentence.start) as f64 / timescale >= CLIP_MIN_SECONDS)
        .collect::<Vec<_>>();
    let pool = if long.len() >= CLIPS_PER_SPEAKER.min(sentences.len()) && !long.is_empty() {
        long
    } else {
        sentences.to_vec()
    };
    let count = pool.len().min(CLIPS_PER_SPEAKER);
    let mut picked = Vec::new();
    for slot in 0..count {
        let index = if count == 1 { 0 } else { slot * (pool.len() - 1) / (count - 1) };
        if picked.last() != Some(&index) {
            picked.push(index);
        }
    }
    picked
        .into_iter()
        .map(|index| {
            let sentence = pool[index];
            Clip {
                sentence_id: sentence.id.clone(),
                start: sentence.start,
                end: sentence.end,
                text: sentence.text.clone(),
            }
        })
        .collect()
}

/// Apply (JSON). A speaker table that references an unknown speaker, or an empty speaker ID, is `INVALID_PROPOSAL`.
pub fn apply_speakers(input: &[u8]) -> Result<String, EntryError> {
    let input: ApplyInput = serde_json::from_slice(input).map_err(invalid_input)?;
    let keyed_translations = keyed(&input.translations);
    let doc = load(&input.speech, &keyed_translations)?;
    let mut speakers = BTreeMap::new();
    for speaker in &input.speakers {
        if speaker.id == NO_SPEAKER {
            return Err(invalid_proposal("说话人的 ID 不能是空字符串"));
        }
        let hue = doc.speakers.get(&speaker.id).and_then(|old| old.hue);
        speakers.insert(
            speaker.id.clone(),
            Speaker {
                name: speaker.name.trim().to_owned(),
                hue,
            },
        );
    }
    let (after, report) = run_apply(&doc, &input.word_speakers, &speakers)?;
    let translations_split = split_count(&doc, &report);
    let written = write_back(&after, &input.speech, &keyed_translations)?;
    if !written.removed_languages.is_empty() || written.translations.len() != input.translations.len() {
        return Err(invalid_proposal(format!(
            "应用后少了译文：{}",
            written.removed_languages.join("、")
        )));
    }
    let mut translations = Vec::new();
    for (before, after) in input.translations.iter().zip(&written.translations) {
        let after = TranslationBody {
            language: before.language.clone(),
            ..after.clone()
        };
        let before = serde_json::to_value(before).expect("译文总能序列化");
        let after = serde_json::to_value(&after).expect("译文总能序列化");
        translations.push((before != after).then_some(after));
    }
    let output = ApplyOutput {
        speech: serde_json::to_value(&written.speech).expect("正文总能序列化"),
        translations,
        relabeled: report.relabeled,
        translations_split,
        sentences_split: report.sentences_split.len(),
        dropped: written.report.dropped,
    };
    Ok(serde_json::to_string(&output).expect("结果总能序列化"))
}
