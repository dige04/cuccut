//! Subtitle file export: Cue / sentence / translated Cue → srt, vtt, ass, and json with per-word timestamps.
//!
//! Ported from CucCut v2 `ccut-kernel`: all parts of `cmd/media/subtitles.rs` that can be pure functions, and the production code section of `cmd/media/tests.rs` (`build_subtitle_events` / `render_subtitle_events` / `render_source_subtitles` / `ass_time` / `subtitle_time` etc., which `media.rs` pulls in with `include!`). `ExportMode` comes from `cmd/media.rs`, and the ASS header constants and [`AssStyleSheet`] come from `cmd/studio_export/ass_style.rs` (see [`ass_style`]).
//!
//! Semantics are kept as-is: in bilingual mode, segments are split by the union of source Cue boundaries within a sentence and translation segment boundaries ([`build_subtitle_events`]); a sentence missing its translation never falls back to the source text. In translation mode the whole sentence produces no event; in bilingual mode only the source line is kept.
//!
//! Depends only on [`TranscriptDoc`] and pure data inputs. The v2 branch that reads and writes the project directory and goes through timeline projection (`render_project_timeline_subtitles`, `timeline_timed_words`, `extra_source_transcripts`) is not in this module.

pub mod ass_style;

use serde_json::{Value, json};

use crate::asr_rows::RowIn;
use crate::build::{SpeakerBoundaryPolicy, build_doc_with_policy};
use crate::cue::{Cue, derive_cues};
use crate::doc::{DocEngine, DocMedia, TranscriptDoc};
use crate::sentence::{Sentence, derive_sentences};
use crate::split::{TransCue, derive_trans_cues, target_delivery_projection};

pub use ass_style::{ASS_PRIMARY_STYLE, ASS_TRANSLATION_STYLE, AssStyleSheet};

/// Fixed sample rate of the v2 host when word segmentation is saved to disk (v2 `ccut-speech::audio::SAMPLE_RATE`).
const SAMPLE_RATE: u32 = 16_000;

/// Subtitle content mode: source text, translation, or bilingual.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ExportMode {
    Original,
    Translated,
    Bilingual,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SubtitleFlavor {
    Srt,
    Vtt,
    Ass,
    /// Subtitle-style JSON: its events come from the same source as the first three formats, and it additionally carries per-word timestamps ([`render_json_words`]).
    JsonWords,
}

/// One-shot subtitle selection, applied after source/timeline projection.
#[derive(Debug, Clone, Copy)]
pub struct SubtitleWindow {
    start: f64,
    end: f64,
}

impl SubtitleWindow {
    /// A segment (in seconds) after `--range` conversion: must be finite and `0 <= start < end`.
    ///
    /// Invalid input returns an error message; v2's CLI additionally wraps it as a structured `time-invalid` / `--range` failure.
    pub fn new(start: f64, end: f64) -> Result<Self, String> {
        if start.is_finite() && end.is_finite() && start >= 0.0 && end > start {
            Ok(Self { start, end })
        } else {
            Err(format!(
                "--range 导出窗口非法：换算后是 {start}..{end}，须有限且 0 <= 起 < 止"
            ))
        }
    }

    pub fn overlaps(self, start: f64, end: f64) -> bool {
        start < self.end && end > self.start
    }

    fn apply(self, events: &mut Vec<SubtitleEvent>, words: &mut Vec<TimedWord>) {
        events.retain_mut(|(start, end, _, _)| {
            if !self.overlaps(*start, *end) {
                return false;
            }
            *start = start.max(self.start) - self.start;
            *end = end.min(self.end) - self.start;
            true
        });
        words.retain_mut(|word| {
            if !self.overlaps(word.start, word.end) {
                return false;
            }
            word.start = word.start.max(self.start) - self.start;
            word.end = word.end.min(self.end) - self.start;
            true
        });
    }
}

/// rows → subtitle text (the worker's OpenAI-compatible surface, `response_format=srt|vtt`).
///
/// It uses the **same** projection as `ccut export --to srt --no-cuts`: `build_doc` → `derive_cues` → `derive_sentences` → [`render_source_subtitles`]. The compatibility surface has no project and no timeline, so it corresponds to the "original source time" branch. The same rows must produce byte-identical output on both paths; the cross-check test in `worker_openai.rs` guards this.
///
/// In v2 the function looks up the speaker-boundary policy from the model catalog by engine id (`speaker_boundary_policy_for_engine`); here the caller passes it in as `speaker_policy`.
pub fn subtitles_from_rows(
    rows: &[RowIn],
    language: &str,
    duration: f64,
    engine_id: &str,
    speaker_policy: SpeakerBoundaryPolicy,
    flavor: SubtitleFlavor,
) -> String {
    let aligned_words = rows
        .iter()
        .any(|row| row.words.as_ref().is_some_and(|words| !words.is_empty()));
    let doc = build_doc_with_policy(
        rows,
        DocMedia {
            id: None,
            path: None,
            hash: String::new(),
            duration,
            sample_rate: Some(SAMPLE_RATE),
        },
        language,
        DocEngine {
            name: engine_id.to_owned(),
            version: None,
            aligned_words,
        },
        None,
        speaker_policy,
    );
    let cues = derive_cues(&doc, &crate::layout_profile::cue_params_for_doc(&doc));
    let sentences = derive_sentences(&doc, &cues);
    let mut missing = 0_usize;
    render_source_subtitles(
        &doc,
        &cues,
        &sentences,
        ExportMode::Original,
        None,
        // The compatibility surface has no studio/style.json, so the delivery punctuation follows the default of `ccut export`.
        true,
        flavor,
        &SubtitleRenderOptions::default(),
        &mut missing,
    )
    .0
}

/// Speaker display name: a prefix is added only when there are multiple speakers; single-speaker subtitles have none.
fn speaker_prefix(doc: &TranscriptDoc, sp: &str, flavor: SubtitleFlavor) -> String {
    if doc.speakers.len() < 2 {
        return String::new();
    }
    let name = doc
        .speakers
        .get(sp)
        .map_or_else(|| sp.to_owned(), |speaker| speaker.name.clone());
    match flavor {
        SubtitleFlavor::Srt => format!("[{name}] "),
        SubtitleFlavor::Vtt => format!("<v {name}>"),
        SubtitleFlavor::Ass | SubtitleFlavor::JsonWords => String::new(),
    }
}

/// Speaker display name read out in subtitle events: uses the same criterion as the ASS Name field (only present when there are multiple speakers).
fn speaker_display_name(doc: &TranscriptDoc, sp: &str) -> Option<String> {
    (doc.speakers.len() >= 2).then(|| {
        doc.speakers
            .get(sp)
            .map_or_else(|| sp.to_owned(), |speaker| speaker.name.clone())
    })
}

/// A source word already placed on the output clock (used by `--to json-words`).
///
/// `src` has a value only in the timeline-projection branch: for multi-source projects the event sp is `{src}:{speaker}`, and words are attached only to events from the same source, so two overlapping source tracks never cross-contaminate each other's words.
struct TimedWord {
    src: Option<String>,
    start: f64,
    end: f64,
    text: String,
}

/// Source-time branch (`--no-cuts`): non-hidden words take their source times as-is, using the same word set as the Cues.
fn source_timed_words(doc: &TranscriptDoc) -> Vec<TimedWord> {
    doc.words
        .iter()
        .filter(|word| !doc.hidden.get(&word.id).copied().unwrap_or(false))
        .map(|word| TimedWord {
            src: None,
            start: word.t0,
            end: word.t1,
            text: word.text.clone(),
        })
        .collect()
}

/// Seconds → millisecond precision, so floating-point tails like `0.1 + 0.2` do not end up in the file.
fn json_seconds(value: f64) -> Value {
    json!((value * 1000.0).round() / 1000.0)
}

/// `--to json-words`: writes the same events as srt/vtt/ass as JSON, each with per-word timestamps.
///
/// - `text` is character-for-character identical to the body of that entry in SRT (bilingual is two lines, "source\ntranslation");
/// - `words[]` are **source** words: words whose midpoint falls within this entry's `[start, end)` and that come from the same source. Translation has no per-word timing, so in translation mode this still lists the source words that were spoken;
/// - `speaker` appears only when there are multiple speakers and `--no-speakers` is not given (same criterion as the ASS Name);
/// - `timebase` is `output` (output timeline, cuts applied) or `source` (`--no-cuts`).
fn render_json_words(
    doc: &TranscriptDoc,
    events: &[SubtitleEvent],
    words: &mut [TimedWord],
    timebase: &str,
    options: &SubtitleRenderOptions,
) -> String {
    words.sort_by(|left, right| {
        (left.start + left.end)
            .total_cmp(&(right.start + right.end))
            .then(left.start.total_cmp(&right.start))
    });
    let cues: Vec<Value> = events
        .iter()
        .map(|(start, end, sp, body)| {
            let src = sp.split_once(':').map(|(src, _)| src);
            let first = words.partition_point(|word| (word.start + word.end) / 2.0 < *start);
            let cue_words: Vec<Value> = words[first..]
                .iter()
                .take_while(|word| (word.start + word.end) / 2.0 < *end)
                .filter(|word| word.src.is_none() || word.src.as_deref() == src)
                .map(|word| {
                    json!({
                        "text": word.text,
                        "start": json_seconds(word.start),
                        "end": json_seconds(word.end),
                    })
                })
                .collect();
            let mut cue = serde_json::Map::new();
            cue.insert("start".to_owned(), json_seconds(*start));
            cue.insert("end".to_owned(), json_seconds(*end));
            if options.speakers
                && let Some(name) = speaker_display_name(doc, sp)
            {
                cue.insert("speaker".to_owned(), json!(name));
            }
            cue.insert("text".to_owned(), json!(body));
            cue.insert("words".to_owned(), Value::Array(cue_words));
            Value::Object(cue)
        })
        .collect();
    let mut root = serde_json::Map::new();
    root.insert("version".to_owned(), json!(1));
    root.insert("timebase".to_owned(), json!(timebase));
    if let Value::Object(header) = &options.json_header {
        root.extend(
            header
                .iter()
                .filter(|(_, value)| !value.is_null())
                .map(|(key, value)| (key.clone(), value.clone())),
        );
    }
    root.insert("cues".to_owned(), Value::Array(cues));
    let mut text =
        serde_json::to_string_pretty(&Value::Object(root)).expect("json-words payload serializes");
    text.push('\n');
    text
}

/// Subtitle event: (start, end, sp, body).
pub type SubtitleEvent = (f64, f64, String, String);

fn subtitle_delivery_text(text: &str, language: &str, project_punctuation: bool) -> String {
    if project_punctuation {
        target_delivery_projection(text, language)
    } else {
        text.to_owned()
    }
}

fn join_subtitle_lines(lines: impl IntoIterator<Item = String>) -> String {
    lines
        .into_iter()
        .filter(|line| !line.trim().is_empty())
        .collect::<Vec<_>>()
        .join("\n")
}

/// independent bilingual: segments split by the union of the source Cue boundaries within a sentence and the translation segment boundaries; adjacent segments with identical content are merged.
fn union_events(
    doc: &TranscriptDoc,
    cues: &[Cue],
    sentence: &Sentence,
    pieces: &[&TransCue],
    target_lang: &str,
    project_punctuation: bool,
) -> Vec<SubtitleEvent> {
    const EPSILON: f64 = 1e-6;
    let mut bounds: Vec<f64> = Vec::new();
    for &cue_index in &sentence.cue_indices {
        bounds.push(cues[cue_index].start);
        bounds.push(cues[cue_index].end);
    }
    for piece in pieces {
        bounds.push(piece.start);
        bounds.push(piece.end);
    }
    bounds.sort_by(f64::total_cmp);
    bounds.dedup_by(|a, b| (*a - *b).abs() < EPSILON);
    let mut events: Vec<SubtitleEvent> = Vec::new();
    for window in bounds.windows(2) {
        let (start, end) = (window[0], window[1]);
        if end - start < EPSILON {
            continue;
        }
        let midpoint = (start + end) / 2.0;
        let source = sentence
            .cue_indices
            .iter()
            .map(|&cue_index| &cues[cue_index])
            .find(|cue| cue.start <= midpoint && midpoint < cue.end);
        let translated = pieces
            .iter()
            .find(|piece| piece.start <= midpoint && midpoint < piece.end);
        let body = match (source, translated) {
            (Some(cue), Some(piece)) => join_subtitle_lines([
                subtitle_delivery_text(&cue.text(doc), &doc.lang, project_punctuation),
                subtitle_delivery_text(&piece.text, target_lang, project_punctuation),
            ]),
            (Some(cue), None) => {
                subtitle_delivery_text(&cue.text(doc), &doc.lang, project_punctuation)
            }
            (None, Some(piece)) => {
                subtitle_delivery_text(&piece.text, target_lang, project_punctuation)
            }
            (None, None) => continue,
        };
        let sp = source.map_or_else(
            || cues[sentence.cue_indices[0]].sp.clone(),
            |cue| cue.sp.clone(),
        );
        if let Some(last) = events.last_mut()
            && last.3 == body
            && (start - last.1).abs() < EPSILON
        {
            last.1 = end;
            continue;
        }
        events.push((start, end, sp, body));
    }
    events
}

/// Rendering options for subtitle file export, and the interval selection after projection.
pub struct SubtitleRenderOptions {
    /// Inverse of `--no-speakers`: the `[Name] ` prefix for srt, `<v Name>` for vtt, and the Name field for ass.
    pub speakers: bool,
    /// Style name for the ASS header and the bilingual second line; srt/vtt do not use it.
    pub ass: AssStyleSheet,
    /// Leading fields of `--to json-words` (mode / language); keys whose value is null are not written out. Other formats do not use them.
    pub json_header: Value,
    /// Crops the projected window and zeroes it; None keeps the full export.
    pub window: Option<SubtitleWindow>,
}

impl Default for SubtitleRenderOptions {
    fn default() -> Self {
        Self {
            speakers: true,
            ass: AssStyleSheet::legacy(),
            json_header: Value::Null,
            window: None,
        }
    }
}

#[cfg(test)]
fn render_subtitles(
    doc: &TranscriptDoc,
    cues: &[Cue],
    sentences: &[Sentence],
    stream: &[TransCue],
    mode: ExportMode,
    target_lang: Option<&str>,
    project_punctuation: bool,
    flavor: SubtitleFlavor,
    missing_translations: &mut usize,
) -> String {
    let events = build_subtitle_events(
        doc,
        cues,
        sentences,
        stream,
        mode,
        target_lang,
        project_punctuation,
        missing_translations,
    );
    render_subtitle_events(doc, &events, flavor, &SubtitleRenderOptions::default())
}

pub fn build_subtitle_events(
    doc: &TranscriptDoc,
    cues: &[Cue],
    sentences: &[Sentence],
    stream: &[TransCue],
    mode: ExportMode,
    target_lang: Option<&str>,
    project_punctuation: bool,
    missing_translations: &mut usize,
) -> Vec<SubtitleEvent> {
    let mut events = Vec::new();
    if mode == ExportMode::Original {
        for cue in cues {
            events.push((
                cue.start,
                cue.end,
                cue.sp.clone(),
                subtitle_delivery_text(&cue.text(doc), &doc.lang, project_punctuation),
            ));
        }
    } else {
        let mut by_sentence: std::collections::BTreeMap<&str, Vec<&TransCue>> =
            std::collections::BTreeMap::new();
        for trans_cue in stream {
            by_sentence
                .entry(trans_cue.sentence_id.as_str())
                .or_default()
                .push(trans_cue);
        }
        for sentence in sentences {
            let Some(pieces) = by_sentence.get(sentence.id.as_str()) else {
                // A missing translation never falls back to the source text, consistent with the picture pipeline (MP4 burn-in / preview):
                // in translation mode the whole sentence is left empty: the sidecar simply produces no event for it, and numbering continues;
                // in bilingual mode there is just no translation line, and the source line is output as usual.
                *missing_translations += 1;
                if mode == ExportMode::Bilingual {
                    for &cue_index in &sentence.cue_indices {
                        let cue = &cues[cue_index];
                        events.push((
                            cue.start,
                            cue.end,
                            cue.sp.clone(),
                            subtitle_delivery_text(&cue.text(doc), &doc.lang, project_punctuation),
                        ));
                    }
                }
                continue;
            };
            match mode {
                ExportMode::Translated => {
                    // The translation forms its own Cue stream (in independent mode, the line boundaries are the translation's own lines).
                    let sp = cues[sentence.cue_indices[0]].sp.clone();
                    for piece in pieces {
                        events.push((
                            piece.start,
                            piece.end,
                            sp.clone(),
                            subtitle_delivery_text(
                                &piece.text,
                                target_lang.unwrap_or_default(),
                                project_punctuation,
                            ),
                        ));
                    }
                }
                ExportMode::Bilingual => {
                    // The source Cue stream and the translation Cue stream are two independent time streams. Bilingual export takes only the union of their boundaries at the final display stage, and does not let source Cues dictate how the translation is split.
                    events.extend(union_events(
                        doc,
                        cues,
                        sentence,
                        pieces,
                        target_lang.unwrap_or_default(),
                        project_punctuation,
                    ));
                }
                ExportMode::Original => unreachable!(),
            }
        }
    }
    events.retain(|(_, _, _, body)| !body.trim().is_empty());
    events
}

pub fn render_subtitle_events(
    doc: &TranscriptDoc,
    events: &[SubtitleEvent],
    flavor: SubtitleFlavor,
    options: &SubtitleRenderOptions,
) -> String {
    let mut output = match flavor {
        SubtitleFlavor::Srt => String::new(),
        SubtitleFlavor::Vtt => String::from("WEBVTT\n\n"),
        // The header is composed by the caller: by default it comes from the project style (v2 `studio_export::ass_style_sheet`); `--no-style` falls back to the fixed header from the VoiceInk era. Event projection is still shared by all three formats.
        SubtitleFlavor::Ass => options.ass.header.clone(),
        SubtitleFlavor::JsonWords => {
            unreachable!("json-words 带逐词时间，由 render_json_words 渲染")
        }
    };
    for (index, (start, end, sp, body)) in events.iter().enumerate() {
        match flavor {
            SubtitleFlavor::Srt => {
                output.push_str(&(index + 1).to_string());
                output.push('\n');
                output.push_str(&format!(
                    "{} --> {}\n",
                    subtitle_time(*start, ','),
                    subtitle_time(*end, ',')
                ));
                if options.speakers {
                    output.push_str(&speaker_prefix(doc, sp, flavor));
                }
                output.push_str(body);
                output.push_str("\n\n");
            }
            SubtitleFlavor::Vtt => {
                output.push_str(&format!(
                    "{} --> {}\n",
                    subtitle_time(*start, '.'),
                    subtitle_time(*end, '.')
                ));
                if options.speakers {
                    output.push_str(&speaker_prefix(doc, sp, flavor));
                }
                output.push_str(body);
                output.push_str("\n\n");
            }
            SubtitleFlavor::Ass => {
                let speaker = if !options.speakers || doc.speakers.len() < 2 {
                    String::new()
                } else {
                    doc.speakers
                        .get(sp)
                        .map_or_else(|| sp.to_owned(), |speaker| speaker.name.clone())
                        .replace(',', "，")
                        .replace(['\r', '\n'], " ")
                };
                output.push_str(&format!(
                    "Dialogue: 0,{},{},{},{speaker},0,0,0,,{}\n",
                    ass_time(*start),
                    ass_time(*end),
                    ASS_PRIMARY_STYLE,
                    ass_dialogue_text(body, options.ass.translation_style.as_deref())
                ));
            }
            SubtitleFlavor::JsonWords => unreachable!("已在函数开头分流"),
        }
    }
    output
}

/// `--no-cuts`: skips clip timeline projection and outputs directly using the original source times from `transcript.json`.
///
/// Reads only the main transcript. Each source in a multi-source project has its own source timeline starting at 0, so putting them in the same subtitle file would inevitably overlap. Secondary sources are therefore always skipped, and the caller issues a warning. This is the boundary of the "original source time" semantics itself, not laziness in the implementation.
pub fn render_source_subtitles(
    doc: &TranscriptDoc,
    cues: &[Cue],
    sentences: &[Sentence],
    mode: ExportMode,
    target_lang: Option<&str>,
    project_punctuation: bool,
    flavor: SubtitleFlavor,
    options: &SubtitleRenderOptions,
    missing_translations: &mut usize,
) -> (String, usize, usize) {
    let selected_sentences = options.window.map(|window| {
        sentences
            .iter()
            .filter(|sentence| {
                sentence
                    .cue_indices
                    .iter()
                    .any(|&index| window.overlaps(cues[index].start, cues[index].end))
            })
            .cloned()
            .collect::<Vec<_>>()
    });
    let sentences = selected_sentences.as_deref().unwrap_or(sentences);
    let stream = target_lang
        .map(|lang| derive_trans_cues(doc, sentences, lang))
        .unwrap_or_default();
    let mut events = build_subtitle_events(
        doc,
        cues,
        sentences,
        &stream,
        mode,
        target_lang,
        project_punctuation,
        missing_translations,
    );
    let mut words = if flavor == SubtitleFlavor::JsonWords || options.window.is_some() {
        source_timed_words(doc)
    } else {
        Vec::new()
    };
    let mut word_count = doc.words.len();
    if let Some(window) = options.window {
        window.apply(&mut events, &mut words);
        word_count = words.len();
    }
    let count = events.len();
    let rendered = if flavor == SubtitleFlavor::JsonWords {
        render_json_words(doc, &events, &mut words, "source", options)
    } else {
        render_subtitle_events(doc, &events, flavor, options)
    };
    (rendered, count, word_count)
}

pub fn ass_time(seconds: f64) -> String {
    let total_centis = (seconds.max(0.0) * 100.0).round() as u64;
    let centis = total_centis % 100;
    let total_seconds = total_centis / 100;
    let seconds = total_seconds % 60;
    let total_minutes = total_seconds / 60;
    let minutes = total_minutes % 60;
    let hours = total_minutes / 60;
    format!("{hours}:{minutes:02}:{seconds:02}.{centis:02}")
}

/// The body of one Dialogue entry.
///
/// A bilingual body is always "source line + `\n` + translation line" (see `join_subtitle_lines`); the translation line switches to the translation style with an inline `{\r<style name>}`. The two styles share Alignment/Margin, so the inline switch does not move this event's position.
///
/// The switch tag is inserted only when the body really contains a line break. Single-line events (in bilingual mode, a sentence missing its translation leaves only the source line, or a union interval falls on only one side) keep the main style. Known approximation: in bilingual mode, a single-line event that has a translation but no source is rendered in the source style.
fn ass_dialogue_text(body: &str, translation_style: Option<&str>) -> String {
    let escaped = ass_text(body);
    let Some(style) = translation_style else {
        return escaped;
    };
    escaped
        .split_once("\\N")
        .map_or(escaped.clone(), |(first, rest)| {
            format!("{first}\\N{{\\r{style}}}{rest}")
        })
}

fn ass_text(value: &str) -> String {
    value
        .replace('\\', "\\\\")
        .replace("\r\n", "\\N")
        .replace(['\r', '\n'], "\\N")
        .replace('{', "\\{")
        .replace('}', "\\}")
}

pub fn subtitle_time(seconds: f64, separator: char) -> String {
    let total_millis = (seconds.max(0.0) * 1_000.0).round() as u64;
    let millis = total_millis % 1_000;
    let total_seconds = total_millis / 1_000;
    let seconds = total_seconds % 60;
    let total_minutes = total_seconds / 60;
    let minutes = total_minutes % 60;
    let hours = total_minutes / 60;
    format!("{hours:02}:{minutes:02}:{seconds:02}{separator}{millis:03}")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::build::build_doc;
    use crate::cue::CueParams;

    fn word_doc() -> TranscriptDoc {
        let mut row_a = RowIn::new(1.23, 5.0, "hello there");
        row_a.speaker = Some("S01".to_owned());
        let mut row_b = RowIn::new(6.0, 65.5, "goodbye now");
        row_b.speaker = Some("S02".to_owned());
        build_doc(
            &[row_a, row_b],
            DocMedia {
                id: None,
                path: Some("sample.wav".to_owned()),
                hash: "sha256-00".to_owned(),
                duration: 65.5,
                sample_rate: Some(16_000),
            },
            "en",
            DocEngine {
                name: "test".to_owned(),
                version: None,
                aligned_words: false,
            },
            None,
        )
    }

    #[test]
    fn subtitle_renderers_use_required_time_separators() {
        assert_eq!(
            join_subtitle_lines([String::new(), "译文".to_owned()]),
            "译文"
        );
        assert_eq!(subtitle_delivery_text("，，。", "zh", true), "");
        assert_eq!(
            subtitle_delivery_text("Hello, world.", "en", true),
            "Hello world"
        );
        let doc = word_doc();
        let cues = derive_cues(&doc, &CueParams::default());
        let sentences = derive_sentences(&doc, &cues);
        let mut missing = 0;
        let srt = render_subtitles(
            &doc,
            &cues,
            &sentences,
            &[],
            ExportMode::Original,
            None,
            true,
            SubtitleFlavor::Srt,
            &mut missing,
        );
        assert!(srt.contains("00:00:01,230 -->"));
        assert!(srt.contains("[S01] hello there"));
        let vtt = render_subtitles(
            &doc,
            &cues,
            &sentences,
            &[],
            ExportMode::Original,
            None,
            true,
            SubtitleFlavor::Vtt,
            &mut missing,
        );
        assert!(vtt.starts_with("WEBVTT\n\n"));
        assert!(vtt.contains("00:00:01.230 -->"));
        assert!(vtt.contains("<v S02>goodbye now"));
        let ass = render_subtitles(
            &doc,
            &cues,
            &sentences,
            &[],
            ExportMode::Original,
            None,
            true,
            SubtitleFlavor::Ass,
            &mut missing,
        );
        assert!(ass.starts_with("[Script Info]\nTitle: CucCut\nScriptType: v4.00+"));
        assert!(ass.contains("Dialogue: 0,0:00:01.23,0:00:05.00,CucCut,S01,0,0,0,,hello there"));
        assert_eq!(ass_text("one\ntwo {x} \\"), "one\\Ntwo \\{x\\} \\\\");
        assert_eq!(missing, 0);
    }

    #[test]
    fn bilingual_mode_stacks_original_and_translation() {
        let mut doc = word_doc();
        let cues = derive_cues(&doc, &CueParams::default());
        let sentences = derive_sentences(&doc, &cues);
        assert_eq!(sentences.len(), 2);
        doc.trans
            .entry("zh".to_owned())
            .or_default()
            .insert(sentences[0].id.clone(), "你好".to_owned());
        let stream = derive_trans_cues(&doc, &sentences, "zh");
        let mut missing = 0;
        let bilingual = render_subtitles(
            &doc,
            &cues,
            &sentences,
            &stream,
            ExportMode::Bilingual,
            Some("zh"),
            true,
            SubtitleFlavor::Srt,
            &mut missing,
        );
        assert!(bilingual.contains("hello there\n你好"));
        // The bilingual semantics are unchanged: a missing translation just means there is no translation line, and the source line is output as usual.
        assert!(bilingual.contains("goodbye now"), "{bilingual}");
        assert_eq!(missing, 1); // The second sentence has no translation
        let mut missing = 0;
        let translated = render_subtitles(
            &doc,
            &cues,
            &sentences,
            &stream,
            ExportMode::Translated,
            Some("zh"),
            true,
            SubtitleFlavor::Srt,
            &mut missing,
        );
        assert!(translated.contains("你好"));
        // In translation mode, a sentence with a missing translation is left empty: no event is produced at all, never falling back to the source text; numbering continues.
        assert!(!translated.contains("goodbye now"), "{translated}");
        assert!(!translated.contains("\n2\n"), "{translated}");
        assert_eq!(missing, 1); // Counting is not affected by the empty entries
    }

    /// In vtt/ass, a missing translation likewise means "this entry does not exist", not an entry with empty text.
    #[test]
    fn translated_mode_drops_untranslated_sentences_from_every_flavor() {
        let mut doc = word_doc();
        let cues = derive_cues(&doc, &CueParams::default());
        let sentences = derive_sentences(&doc, &cues);
        doc.trans
            .entry("zh".to_owned())
            .or_default()
            .insert(sentences[0].id.clone(), "你好".to_owned());
        let stream = derive_trans_cues(&doc, &sentences, "zh");
        for flavor in [SubtitleFlavor::Vtt, SubtitleFlavor::Ass] {
            let mut missing = 0;
            let rendered = render_subtitles(
                &doc,
                &cues,
                &sentences,
                &stream,
                ExportMode::Translated,
                Some("zh"),
                true,
                flavor,
                &mut missing,
            );
            assert!(rendered.contains("你好"), "{rendered}");
            assert!(!rendered.contains("goodbye now"), "{rendered}");
            assert_eq!(missing, 1);
            if flavor == SubtitleFlavor::Ass {
                // Only the first sentence's Dialogue remains; a missing translation does not take up any space on the timeline.
                assert_eq!(rendered.matches("Dialogue:").count(), 1, "{rendered}");
            }
        }
    }

    /// ASS bilingual is "one Dialogue entry with two lines". When the translation is missing, that event has only the source line:
    /// the body contains no `\N`, so there should be no `{\r...}` tag switching to the translation style.
    #[test]
    fn ass_bilingual_missing_translation_stays_a_single_primary_line() {
        let mut doc = word_doc();
        let cues = derive_cues(&doc, &CueParams::default());
        let sentences = derive_sentences(&doc, &cues);
        doc.trans
            .entry("zh".to_owned())
            .or_default()
            .insert(sentences[0].id.clone(), "你好".to_owned());
        let stream = derive_trans_cues(&doc, &sentences, "zh");
        let mut missing = 0;
        let events = build_subtitle_events(
            &doc,
            &cues,
            &sentences,
            &stream,
            ExportMode::Bilingual,
            Some("zh"),
            true,
            &mut missing,
        );
        // v2 composes the bilingual header with `studio_export::ass_style_sheet(&json!({}), "bi", …)`. That depends on the subtitle rendering kernel; the verbatim version of this test lives in `subtitle-render`'s `ass_style`. This crate does not depend on rendering, so a header with a translation style is hand-built here, and the assertions only look at the Dialogue lines.
        let ass = AssStyleSheet {
            translation_style: Some(ASS_TRANSLATION_STYLE.to_owned()),
            ..AssStyleSheet::legacy()
        };
        let translation_style = ass.translation_style.clone();
        assert!(translation_style.is_some(), "双语头必须带译文样式");
        let rendered = render_subtitle_events(
            &doc,
            &events,
            SubtitleFlavor::Ass,
            &SubtitleRenderOptions {
                speakers: true,
                ass,
                ..SubtitleRenderOptions::default()
            },
        );
        assert_eq!(missing, 1);
        let dialogues: Vec<&str> = rendered
            .lines()
            .filter(|line| line.starts_with("Dialogue:"))
            .collect();
        assert_eq!(dialogues.len(), 2, "{rendered}");
        assert!(dialogues[0].contains("hello there\\N"), "{rendered}");
        // The entry with the missing translation: a single source line, with no line break and no translation style switch.
        let missing_line = dialogues[1];
        assert!(missing_line.contains("goodbye now"), "{rendered}");
        assert!(!missing_line.contains("\\N"), "{rendered}");
        if let Some(style) = translation_style.as_deref() {
            assert!(!missing_line.contains(style), "{rendered}");
        }
    }

    #[test]
    fn bilingual_spanning_piece_repeats_across_its_cues() {
        use crate::doc::{AlignMode, TransAlign, TransPiece};
        // One sentence spans two Cues, and a single clip spans both Cues (the whole sentence is shown at once): the translation line is repeated in two events.
        let mut row = RowIn::new(
            0.0,
            8.0,
            "alpha bravo charlie delta echo, foxtrot golf hotel.",
        );
        row.speaker = Some("S01".to_owned());
        let mut doc = build_doc(
            &[row],
            DocMedia {
                id: None,
                path: Some("sample.wav".to_owned()),
                hash: "sha256-00".to_owned(),
                duration: 10.0,
                sample_rate: Some(16_000),
            },
            "en",
            DocEngine {
                name: "test".to_owned(),
                version: None,
                aligned_words: false,
            },
            None,
        );
        let cues = derive_cues(&doc, &CueParams::default());
        assert_eq!(cues.len(), 2);
        let sentences = derive_sentences(&doc, &cues);
        doc.trans
            .entry("zh".to_owned())
            .or_default()
            .insert(sentences[0].id.clone(), "整句译文。".to_owned());
        doc.trans_align.entry("zh".to_owned()).or_default().insert(
            sentences[0].id.clone(),
            TransAlign {
                mode: AlignMode::ManyToOne,
                crossing: false,
                correspondence: None,
                text_basis: Default::default(),
                aligner: None,
                blocks: Vec::new(),
                cues: sentences[0].cue_ids.clone(),
                words: Vec::new(),
                pieces: vec![TransPiece {
                    from: Some(0),
                    to: Some(1),
                    text: "整句译文。".to_owned(),
                }],
            },
        );
        let stream = derive_trans_cues(&doc, &sentences, "zh");
        let mut missing = 0;
        let bilingual = render_subtitles(
            &doc,
            &cues,
            &sentences,
            &stream,
            ExportMode::Bilingual,
            Some("zh"),
            true,
            SubtitleFlavor::Srt,
            &mut missing,
        );
        assert_eq!(bilingual.matches("整句译文").count(), 2, "{bilingual}");
        assert!(!bilingual.contains("整句译文。"), "{bilingual}");
        let literal = render_subtitles(
            &doc,
            &cues,
            &sentences,
            &stream,
            ExportMode::Bilingual,
            Some("zh"),
            false,
            SubtitleFlavor::Srt,
            &mut missing,
        );
        assert_eq!(literal.matches("整句译文。").count(), 2, "{literal}");
        assert_eq!(missing, 0);
    }

    #[test]
    fn bilingual_independent_uses_union_partition() {
        use crate::doc::{AlignMode, TransAlign, TransPiece};
        let mut row = RowIn::new(
            0.0,
            8.0,
            "alpha bravo charlie delta echo, foxtrot golf hotel.",
        );
        row.speaker = Some("S01".to_owned());
        let mut doc = build_doc(
            &[row],
            DocMedia {
                id: None,
                path: Some("sample.wav".to_owned()),
                hash: "sha256-00".to_owned(),
                duration: 10.0,
                sample_rate: Some(16_000),
            },
            "en",
            DocEngine {
                name: "test".to_owned(),
                version: None,
                aligned_words: false,
            },
            None,
        );
        let cues = derive_cues(&doc, &CueParams::default());
        let sentences = derive_sentences(&doc, &cues);
        doc.trans.entry("zh".to_owned()).or_default().insert(
            sentences[0].id.clone(),
            "前半句译文，后半句译文。".to_owned(),
        );
        doc.trans_align.entry("zh".to_owned()).or_default().insert(
            sentences[0].id.clone(),
            TransAlign {
                mode: AlignMode::Independent,
                crossing: false,
                correspondence: None,
                text_basis: Default::default(),
                aligner: None,
                blocks: Vec::new(),
                cues: sentences[0].cue_ids.clone(),
                words: Vec::new(),
                pieces: vec![
                    TransPiece {
                        from: None,
                        to: None,
                        text: "前半句译文，".to_owned(),
                    },
                    TransPiece {
                        from: None,
                        to: None,
                        text: "后半句译文。".to_owned(),
                    },
                ],
            },
        );
        let stream = derive_trans_cues(&doc, &sentences, "zh");
        let mut missing = 0;
        let bilingual = render_subtitles(
            &doc,
            &cues,
            &sentences,
            &stream,
            ExportMode::Bilingual,
            Some("zh"),
            true,
            SubtitleFlavor::Srt,
            &mut missing,
        );
        // Union segmentation: each event is two lines, source\ntranslation; the boundary union is ≥ the number of source Cues.
        assert!(bilingual.contains("\n前半句译文\n"), "{bilingual}");
        assert!(bilingual.contains("\n后半句译文\n"), "{bilingual}");
        assert_eq!(missing, 0);
        // Translation-only export: lines are the translation's own boundaries.
        let mut missing = 0;
        let translated = render_subtitles(
            &doc,
            &cues,
            &sentences,
            &stream,
            ExportMode::Translated,
            Some("zh"),
            true,
            SubtitleFlavor::Srt,
            &mut missing,
        );
        assert!(translated.contains("前半句译文\n\n"), "{translated}");
    }
}
