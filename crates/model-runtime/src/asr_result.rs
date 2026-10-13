//! Output contract `cuccut.asr-result/v1` (protocol spec §6): types, self-checks before writing, `segments.jsonl` and `result.json`.

use std::collections::HashSet;
use std::fs::File;
use std::io::{BufWriter, Write};
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};

use crate::protocol::OutputFile;

pub const SCHEMA: &str = "cuccut.asr-result/v1";
pub const CLOCK: &str = "source-asset";
pub const SEGMENTS_FILE: &str = "segments.jsonl";
pub const RESULT_FILE: &str = "result.json";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum Outcome {
    Transcribed,
    NoAudioTrack,
    NoSpeech,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AsrResult {
    pub schema: String,
    pub outcome: Outcome,
    pub timescale: u64,
    pub clock: String,
    pub duration: u64,
    pub language: LanguageResult,
    pub segments: Vec<Segment>,
    pub speakers: Vec<Speaker>,
    pub coverage: Vec<TickSpan>,
    pub warnings: Vec<Warning>,
    pub provenance: Provenance,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LanguageSource {
    Asserted,
    Detected,
    Unknown,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LanguageResult {
    pub tag: Option<String>,
    pub source: LanguageSource,
    pub confidence: Option<f64>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Segment {
    pub id: String,
    pub start: u64,
    pub end: u64,
    pub text: String,
    pub speaker_id: Option<String>,
    pub words: Vec<Word>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TimingQuality {
    Aligned,
    Provider,
    Estimated,
    Missing,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Word {
    pub start: u64,
    pub end: u64,
    pub text: String,
    pub confidence: Option<f64>,
    pub timing_quality: TimingQuality,
    /// Word-level speaker (the id in `speakers[]`). Speaker diarization (§6.6) is projected per word, so the speaker can change within a segment; a segment's `speakerId` is the speaker with the most speaking time in that segment. Omitted when there is no speaker diarization.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub speaker_id: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Speaker {
    pub id: String,
    pub label: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct TickSpan {
    pub start: u64,
    pub end: u64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum WarningCode {
    AlignmentFailed,
    TimingAdjusted,
    BackendDegraded,
    DiarizationUnavailable,
    SegmentDegenerate,
    RangeClamped,
    /// The model has no channel for recognition hints (MOSS), so the `hint` in the request is not passed to the model.
    HintIgnored,
    /// The model left a segment incomplete (MOSS generated a chunk up to the limit or fell into repetition and could not be split): the recognized part is kept, and characters may be missing afterwards.
    SegmentIncomplete,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Warning {
    pub code: WarningCode,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub segment_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
}

impl Warning {
    pub fn new(code: WarningCode) -> Self {
        Self {
            code,
            segment_id: None,
            detail: None,
        }
    }

    pub fn segment(mut self, id: &str) -> Self {
        self.segment_id = Some(id.to_owned());
        self
    }

    pub fn detail(mut self, detail: impl Into<String>) -> Self {
        self.detail = Some(detail.into());
        self
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ModelRef {
    pub family: String,
    pub revision: String,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct ModelRefs {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub asr: Option<ModelRef>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub vad: Option<ModelRef>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub aligner: Option<ModelRef>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub speaker: Option<ModelRef>,
    /// The Pyannote segmentation model used for speaker diarization (§6.6).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub segmentation: Option<ModelRef>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Provenance {
    pub provider: String,
    pub bundle_id: Option<String>,
    pub models: ModelRefs,
    pub backend: String,
    pub device: String,
    pub worker_version: String,
    pub input_hash: String,
    pub run_generation: u64,
}

/// Monotonic correction of word timing (architecture design §6.6, step 6): words lie within the segment, their start and end are not inverted, and each word does not end before the previous one.
/// Corrected words keep their original `timingQuality`; words marked `missing` are pinned to the segment start. Returns whether any timed word was changed.
pub fn fix_word_times(segment: &mut Segment) -> bool {
    let (start, end) = (segment.start, segment.end);
    let mut adjusted = false;
    let mut previous_end = start;
    for word in &mut segment.words {
        if word.timing_quality == TimingQuality::Missing {
            word.start = start;
            word.end = start;
            continue;
        }
        let fixed_start = word.start.clamp(previous_end, end);
        let fixed_end = word.end.clamp(fixed_start, end);
        if (fixed_start, fixed_end) != (word.start, word.end) {
            adjusted = true;
            word.start = fixed_start;
            word.end = fixed_end;
        }
        previous_end = word.end;
    }
    adjusted
}

/// Self-check before writing (the validation rules of §6). `asserted` is the language asserted in the request.
pub fn validate(result: &AsrResult, asserted: Option<&str>) -> Result<(), String> {
    if result.schema != SCHEMA {
        return Err(format!("schema must be {SCHEMA}"));
    }
    if result.clock != CLOCK {
        return Err(format!("clock must be {CLOCK}"));
    }
    if result.timescale == 0 {
        return Err("timescale must be greater than 0".into());
    }
    if result.outcome != Outcome::Transcribed && !result.segments.is_empty() {
        return Err("segments must be empty unless outcome is transcribed".into());
    }
    for span in &result.coverage {
        if span.start > span.end || span.end > result.duration {
            return Err(format!("coverage [{}, {}] is out of range", span.start, span.end));
        }
    }
    let speakers: HashSet<&str> = result.speakers.iter().map(|speaker| speaker.id.as_str()).collect();
    let mut ids = HashSet::new();
    let mut previous_end = 0;
    for segment in &result.segments {
        let id = &segment.id;
        if !ids.insert(id.as_str()) {
            return Err(format!("segment id repeated: {id}"));
        }
        if segment.start >= segment.end || segment.end > result.duration {
            return Err(format!(
                "segment {id} has invalid time [{}, {}] (duration {})",
                segment.start, segment.end, result.duration
            ));
        }
        if segment.start < previous_end {
            return Err(format!("segment {id} overlaps the previous segment or start is not increasing"));
        }
        previous_end = segment.end;
        if segment.text.trim().is_empty() {
            return Err(format!("segment {id} has empty text"));
        }
        if let Some(speaker) = &segment.speaker_id
            && !speakers.contains(speaker.as_str())
        {
            return Err(format!("segment {id} speakerId {speaker} is not in speakers[]"));
        }
        let mut previous: Option<&Word> = None;
        for word in &segment.words {
            if word.text.trim().is_empty() {
                return Err(format!("segment {id} has an empty word"));
            }
            if let Some(speaker) = &word.speaker_id
                && !speakers.contains(speaker.as_str())
            {
                return Err(format!("word '{}' in segment {id} has speakerId {speaker} not in speakers[]", word.text));
            }
            if word.start > word.end || word.start < segment.start || word.end > segment.end {
                return Err(format!("word '{}' in segment {id} is outside the segment or its start is after its end", word.text));
            }
            if let Some(previous) = previous
                && (word.start < previous.start || word.end < previous.end)
            {
                return Err(format!("segment {id} word times are not monotonic"));
            }
            match word.timing_quality {
                TimingQuality::Missing if word.start != segment.start || word.end != segment.start => {
                    return Err(format!("segment {id} missing word must use the segment start"));
                }
                TimingQuality::Aligned if result.provenance.models.aligner.is_none() => {
                    return Err(format!("segment {id} has aligned words but no aligner"));
                }
                _ => {}
            }
            previous = Some(word);
        }
    }
    if let Some(tag) = &result.language.tag
        && !is_bcp47(tag)
    {
        return Err(format!("language.tag is not valid BCP 47: {tag}"));
    }
    if result.language.source == LanguageSource::Asserted && result.language.tag.as_deref() != asserted {
        return Err("asserted language must equal the requested assertion".into());
    }
    Ok(())
}

/// BCP 47 shape check: the primary language is 2–3 or 5–8 letters, followed by segments of 1–8 alphanumeric characters each.
pub fn is_bcp47(tag: &str) -> bool {
    let mut parts = tag.split('-');
    let Some(language) = parts.next() else { return false };
    let language_ok = matches!(language.len(), 2 | 3 | 5..=8) && language.chars().all(|c| c.is_ascii_alphabetic());
    language_ok && parts.all(|part| (1..=8).contains(&part.len()) && part.chars().all(|c| c.is_ascii_alphanumeric()))
}

/// `segments.jsonl`: the first line is the header, followed by one segment per line, flushed after each line is written (§5).
pub struct SegmentsWriter {
    path: PathBuf,
    out: BufWriter<File>,
}

impl SegmentsWriter {
    pub fn create(staging: &Path, header: &SegmentsHeader<'_>) -> std::io::Result<Self> {
        let path = staging.join(SEGMENTS_FILE);
        let mut writer = Self {
            out: BufWriter::new(File::create(&path)?),
            path,
        };
        writer.line(&json!({
            "header": true,
            "jobId": header.job_id,
            "contentHash": header.content_hash,
            "bundleId": header.bundle_id,
            "workerVersion": header.worker_version,
            "timescale": header.timescale,
        }))?;
        Ok(writer)
    }

    pub fn append(&mut self, segment: &Segment) -> std::io::Result<()> {
        self.line(&serde_json::to_value(segment).map_err(std::io::Error::other)?)
    }

    pub fn path(&self) -> &Path {
        &self.path
    }

    fn line(&mut self, value: &Value) -> std::io::Result<()> {
        serde_json::to_writer(&mut self.out, value).map_err(std::io::Error::other)?;
        self.out.write_all(b"\n")?;
        self.out.flush()
    }
}

pub struct SegmentsHeader<'a> {
    pub job_id: &'a str,
    pub content_hash: &'a str,
    pub bundle_id: &'a str,
    pub worker_version: &'a str,
    pub timescale: u64,
}

/// Writes `result.json` in one go: writes a temporary file first, then renames it. Returns the path, the sha256 of the bytes (lowercase hex), and the length.
pub fn write_result(staging: &Path, result: &AsrResult) -> std::io::Result<OutputFile> {
    let bytes = serde_json::to_vec(result).map_err(std::io::Error::other)?;
    let path = staging.join(RESULT_FILE);
    let temporary = staging.join(format!("{RESULT_FILE}.tmp"));
    {
        let mut file = File::create(&temporary)?;
        file.write_all(&bytes)?;
        file.sync_all()?;
    }
    std::fs::rename(&temporary, &path)?;
    Ok(OutputFile {
        path: path.to_string_lossy().into_owned(),
        sha256: sha256_hex(&bytes),
        byte_length: bytes.len() as u64,
    })
}

pub fn sha256_hex(bytes: &[u8]) -> String {
    Sha256::digest(bytes).iter().map(|b| format!("{b:02x}")).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn word(start: u64, end: u64, text: &str) -> Word {
        Word {
            start,
            end,
            text: text.into(),
            confidence: None,
            timing_quality: TimingQuality::Estimated,
            speaker_id: None,
        }
    }

    fn segment(id: &str, start: u64, end: u64, words: Vec<Word>) -> Segment {
        Segment {
            id: id.into(),
            start,
            end,
            text: "hello world".into(),
            speaker_id: None,
            words,
        }
    }

    fn result(segments: Vec<Segment>) -> AsrResult {
        AsrResult {
            schema: SCHEMA.into(),
            outcome: Outcome::Transcribed,
            timescale: 1_000,
            clock: CLOCK.into(),
            duration: 10_000,
            language: LanguageResult {
                tag: Some("en".into()),
                source: LanguageSource::Detected,
                confidence: None,
            },
            segments,
            speakers: vec![],
            coverage: vec![TickSpan { start: 0, end: 10_000 }],
            warnings: vec![],
            provenance: Provenance {
                provider: "local".into(),
                bundle_id: Some("b".into()),
                models: ModelRefs::default(),
                backend: "mlx".into(),
                device: "metal".into(),
                worker_version: "0".into(),
                input_hash: "sha256:00".into(),
                run_generation: 1,
            },
        }
    }

    #[test]
    fn a_well_formed_result_passes() {
        let ok = result(vec![
            segment("seg-0001", 0, 1_000, vec![word(0, 400, "hello"), word(400, 1_000, "world")]),
            segment("seg-0002", 1_000, 2_000, vec![]),
        ]);
        assert_eq!(validate(&ok, None), Ok(()));
    }

    #[test]
    fn segment_rules_are_enforced() {
        let overlap = result(vec![segment("seg-0001", 0, 1_000, vec![]), segment("seg-0002", 900, 2_000, vec![])]);
        assert!(validate(&overlap, None).unwrap_err().contains("overlap"));
        let empty = result(vec![segment("seg-0001", 0, 0, vec![])]);
        assert!(validate(&empty, None).is_err());
        let beyond = result(vec![segment("seg-0001", 9_000, 10_001, vec![])]);
        assert!(validate(&beyond, None).is_err());
        let duplicate = result(vec![segment("seg-0001", 0, 10, vec![]), segment("seg-0001", 10, 20, vec![])]);
        assert!(validate(&duplicate, None).unwrap_err().contains("repeated"));
        let mut blank = result(vec![segment("seg-0001", 0, 10, vec![])]);
        blank.segments[0].text = "  ".into();
        assert!(validate(&blank, None).is_err());
        let mut speaker = result(vec![segment("seg-0001", 0, 10, vec![])]);
        speaker.segments[0].speaker_id = Some("spk-1".into());
        assert!(validate(&speaker, None).is_err());
        speaker.speakers.push(Speaker {
            id: "spk-1".into(),
            label: None,
        });
        assert_eq!(validate(&speaker, None), Ok(()));
        // Word-level speakers must likewise appear in speakers[].
        let mut word_speaker = result(vec![segment(
            "seg-0001",
            0,
            10,
            vec![Word {
                start: 0,
                end: 5,
                text: "hi".into(),
                confidence: None,
                timing_quality: TimingQuality::Estimated,
                speaker_id: Some("spk-2".into()),
            }],
        )]);
        assert!(validate(&word_speaker, None).unwrap_err().contains("spk-2"));
        word_speaker.speakers.push(Speaker {
            id: "spk-2".into(),
            label: None,
        });
        assert_eq!(validate(&word_speaker, None), Ok(()));
        let mut no_speech = result(vec![segment("seg-0001", 0, 10, vec![])]);
        no_speech.outcome = Outcome::NoSpeech;
        assert!(validate(&no_speech, None).is_err());
        no_speech.segments.clear();
        assert_eq!(validate(&no_speech, None), Ok(()));
    }

    #[test]
    fn word_rules_are_enforced() {
        let outside = result(vec![segment("seg-0001", 100, 1_000, vec![word(50, 400, "hello")])]);
        assert!(validate(&outside, None).is_err());
        let backwards = result(vec![segment("seg-0001", 0, 1_000, vec![word(500, 600, "a"), word(100, 200, "b")])]);
        assert!(validate(&backwards, None).unwrap_err().contains("monotonic"));
        let mut missing = result(vec![segment("seg-0001", 100, 1_000, vec![word(200, 200, "a")])]);
        missing.segments[0].words[0].timing_quality = TimingQuality::Missing;
        assert!(validate(&missing, None).is_err());
        missing.segments[0].words[0].start = 100;
        missing.segments[0].words[0].end = 100;
        assert_eq!(validate(&missing, None), Ok(()));
        let mut aligned = result(vec![segment("seg-0001", 0, 1_000, vec![word(0, 100, "a")])]);
        aligned.segments[0].words[0].timing_quality = TimingQuality::Aligned;
        assert!(validate(&aligned, None).unwrap_err().contains("aligner"));
    }

    #[test]
    fn language_rules_are_enforced() {
        let mut asserted = result(vec![]);
        asserted.language = LanguageResult {
            tag: Some("en".into()),
            source: LanguageSource::Asserted,
            confidence: None,
        };
        assert_eq!(validate(&asserted, Some("en")), Ok(()));
        assert!(validate(&asserted, Some("de")).is_err());
        asserted.language.tag = Some("not a tag".into());
        assert!(validate(&asserted, Some("not a tag")).is_err());
        assert!(is_bcp47("zh-Hant-TW") && is_bcp47("fil") && is_bcp47("yue") && is_bcp47("en-US"));
        assert!(!is_bcp47("") && !is_bcp47("e") && !is_bcp47("en_US") && !is_bcp47("en-") && !is_bcp47("english language"));
    }

    #[test]
    fn word_fixup_clamps_into_the_segment_and_flags_changes() {
        let mut fine = segment("seg-0001", 100, 1_000, vec![word(100, 500, "a"), word(500, 1_000, "b")]);
        assert!(!fix_word_times(&mut fine));
        let mut messy = segment("seg-0001", 100, 1_000, vec![word(50, 600, "a"), word(400, 1_200, "b")]);
        assert!(fix_word_times(&mut messy));
        assert_eq!((messy.words[0].start, messy.words[0].end), (100, 600));
        assert_eq!((messy.words[1].start, messy.words[1].end), (600, 1_000));
        assert_eq!(messy.words[1].timing_quality, TimingQuality::Estimated);
        let mut fixed = result(vec![messy]);
        fixed.duration = 10_000;
        assert_eq!(validate(&fixed, None), Ok(()));
    }

    #[test]
    fn writers_produce_header_rows_and_a_hashed_result() {
        let dir = tempfile::tempdir().unwrap();
        let header = SegmentsHeader {
            job_id: "j",
            content_hash: "sha256:00",
            bundle_id: "b",
            worker_version: "0",
            timescale: 1_000,
        };
        let mut writer = SegmentsWriter::create(dir.path(), &header).unwrap();
        writer.append(&segment("seg-0001", 0, 10, vec![])).unwrap();
        let text = std::fs::read_to_string(dir.path().join(SEGMENTS_FILE)).unwrap();
        let lines: Vec<Value> = text.lines().map(|line| serde_json::from_str(line).unwrap()).collect();
        assert_eq!(lines[0]["header"], true);
        assert_eq!(lines[0]["timescale"], 1_000);
        assert_eq!(lines[1]["id"], "seg-0001");
        assert_eq!(lines[1]["speakerId"], Value::Null);

        let output = write_result(dir.path(), &result(vec![])).unwrap();
        let bytes = std::fs::read(dir.path().join(RESULT_FILE)).unwrap();
        assert_eq!(output.sha256, sha256_hex(&bytes));
        assert_eq!(output.byte_length, bytes.len() as u64);
        assert!(!dir.path().join("result.json.tmp").exists());
        let parsed: AsrResult = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(parsed.outcome, Outcome::Transcribed);
    }
}
