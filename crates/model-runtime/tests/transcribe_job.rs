//! Orchestration of `transcribe::run`: runs the real decoding, segmentation, tick conversion, result assembly, and self-check with a fake VAD and recognizer. No model files are needed and there is no dependency on an inference backend. Models that segment themselves (the MOSS kind) run with the fake [`SegmentingRecognizer`].

use std::collections::VecDeque;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};

use anyhow::Result;
use model_runtime::asr_result::{self, AsrResult, LanguageSource, Outcome, TimingQuality, WarningCode};
use model_runtime::backend::{LoadedModel, RunMode};
use model_runtime::bundle::{self, ModelBundle, VerifiedBundle};
use model_runtime::protocol::{ErrorBody, JobOutcome, JobRunParams, JobRunResult, MemorySnapshot};
use model_runtime::speech::pyannote_common::{DiarizedSegment, PyannoteCallbacks, PyannoteCancelled, PyannoteOptions};
use model_runtime::speech::{
    AlignedWord, ForcedAlignment, Recognition, RecognitionRequest, RowIn, SegmentedTranscription, SegmentingCallbacks, SegmentingCancelled,
    SegmentingRecognizer, SpeakerDiarization, SpeakerEmbedding, SpeakerRange, SpeechRecognizer, StreamingVad,
};
use model_runtime::transcribe::{self, JobSink};
use serde_json::{Value, json};

/// The sample's absolute value is the speech probability.
struct AmplitudeVad;

impl StreamingVad for AmplitudeVad {
    fn process_chunk(&mut self, samples: &[f32]) -> Result<f32> {
        Ok(samples.iter().fold(0.0_f32, |max, value| max.max(value.abs())))
    }

    fn reset_state(&mut self) {}
}

/// Emits preset text in order; can trigger Runtime cancellation on the first call.
struct ScriptedRecognizer {
    texts: VecDeque<&'static str>,
    language_name: Option<&'static str>,
    /// Each call reports its own language name; after use, it reverts to `language_name`.
    language_names: VecDeque<Option<&'static str>>,
    requests: Vec<(usize, Option<String>, Option<String>)>,
    cancel_on_first_call: Option<Arc<AtomicBool>>,
}

impl SpeechRecognizer for ScriptedRecognizer {
    fn recognize(&mut self, audio: &[f32], request: &RecognitionRequest<'_>) -> Result<Recognition> {
        self.requests
            .push((audio.len(), request.language.map(str::to_owned), request.context.map(str::to_owned)));
        if let Some(cancel) = self.cancel_on_first_call.take() {
            cancel.store(true, Ordering::SeqCst);
        }
        let text = self.texts.pop_front().unwrap_or("more words");
        let language_name = self.language_names.pop_front().unwrap_or(self.language_name);
        Ok(Recognition {
            text: text.into(),
            language_name: language_name.map(str::to_owned),
            degenerate: false,
        })
    }
}

/// Fake forced aligner: `align` gives preset words (in seconds relative to the given audio, like hello/world in the v2 pipeline tests), an error, or nothing. `align_long` (`capability: 'align'`) gives a preset full set of words. Records the sample count, text, and language of each call.
enum AlignerScript {
    Words(Vec<(&'static str, f32, f32)>),
    Fail,
    Empty,
}

struct FakeAligner {
    script: AlignerScript,
    calls: Vec<(usize, String, Option<String>)>,
}

impl FakeAligner {
    fn new(script: AlignerScript) -> Self {
        Self { script, calls: Vec::new() }
    }

    fn hello_world() -> Self {
        Self::new(AlignerScript::Words(vec![("hello", 0.0, 0.1), ("world", 0.12, 0.2)]))
    }
}

impl ForcedAlignment for FakeAligner {
    fn align(&mut self, audio: &[f32], text: &str, language: Option<&str>) -> Result<Vec<AlignedWord>> {
        self.calls.push((audio.len(), text.to_owned(), language.map(str::to_owned)));
        match &self.script {
            AlignerScript::Words(words) => Ok(words
                .iter()
                .map(|&(text, start, end)| AlignedWord {
                    text: text.to_owned(),
                    start,
                    end,
                })
                .collect()),
            AlignerScript::Fail => Err(anyhow::anyhow!("aligner exploded")),
            AlignerScript::Empty => Ok(Vec::new()),
        }
    }
}

/// Fake speaker diarization: gives preset spans (in seconds relative to the decode start), an error, or a cancellation report. Records the sample count and options it receives, and reports progress once.
enum DiarizerScript {
    Segments(Vec<(f64, f64, usize)>),
    Fail,
    Cancel,
}

struct FakeDiarizer {
    script: DiarizerScript,
    calls: Vec<(usize, PyannoteOptions)>,
}

impl SpeakerDiarization for FakeDiarizer {
    fn diarize(
        &mut self,
        samples: &[f32],
        options: &PyannoteOptions,
        callbacks: &mut PyannoteCallbacks<'_>,
    ) -> Result<Vec<DiarizedSegment>> {
        self.calls.push((samples.len(), *options));
        if let Some(progress) = callbacks.on_progress.as_deref_mut() {
            progress(2.0, 2.0);
        }
        match &self.script {
            DiarizerScript::Segments(segments) => Ok(segments
                .iter()
                .map(|&(start, end, speaker)| DiarizedSegment { start, end, speaker })
                .collect()),
            DiarizerScript::Fail => Err(anyhow::anyhow!("pyannote exploded")),
            DiarizerScript::Cancel => Err(PyannoteCancelled.into()),
        }
    }
}

struct FakeModel {
    vad: AmplitudeVad,
    asr: ScriptedRecognizer,
    aligner: Option<FakeAligner>,
    /// The diarization file is present (`has_diarizer`), but `diarizer` may be `None` (failed to load).
    diarizer_installed: bool,
    diarizer: Option<FakeDiarizer>,
    finished: usize,
}

impl FakeModel {
    fn new(texts: &[&'static str]) -> Self {
        Self {
            vad: AmplitudeVad,
            asr: ScriptedRecognizer {
                texts: texts.iter().copied().collect(),
                language_name: Some("English"),
                language_names: VecDeque::new(),
                requests: Vec::new(),
                cancel_on_first_call: None,
            },
            aligner: None,
            diarizer_installed: false,
            diarizer: None,
            finished: 0,
        }
    }

    fn with_diarizer(texts: &[&'static str], script: DiarizerScript) -> Self {
        Self {
            diarizer_installed: true,
            diarizer: Some(FakeDiarizer { script, calls: Vec::new() }),
            ..Self::new(texts)
        }
    }

    fn with_aligner(texts: &[&'static str], aligner: FakeAligner) -> Self {
        Self {
            aligner: Some(aligner),
            ..Self::new(texts)
        }
    }
}

impl LoadedModel for FakeModel {
    fn run_mode(&mut self) -> RunMode<'_> {
        RunMode::Pipeline {
            vad: &mut self.vad,
            recognizer: &mut self.asr,
        }
    }

    fn aligner(&mut self) -> Option<&mut dyn ForcedAlignment> {
        self.aligner.as_mut().map(|aligner| aligner as &mut dyn ForcedAlignment)
    }

    fn has_diarizer(&self) -> bool {
        self.diarizer_installed
    }

    fn diarizer(&mut self) -> Option<&mut dyn SpeakerDiarization> {
        self.diarizer.as_mut().map(|diarizer| diarizer as &mut dyn SpeakerDiarization)
    }

    fn finish_job(&mut self) {
        self.finished += 1;
    }

    fn memory(&self) -> Option<MemorySnapshot> {
        Some(MemorySnapshot {
            active: 1,
            cache: 2,
            peak: 3,
        })
    }

    fn warmup_ms(&self) -> u64 {
        0
    }

    fn resident_bytes(&self) -> Option<u64> {
        None
    }
}

/// Emits preset embedding vectors in order (errors when they run out).
struct ScriptedEmbedder {
    vectors: VecDeque<Vec<f32>>,
    calls: Vec<usize>,
}

impl SpeakerEmbedding for ScriptedEmbedder {
    fn embed(&mut self, samples: &[f32]) -> Result<Vec<f32>> {
        self.calls.push(samples.len());
        self.vectors.pop_front().ok_or_else(|| anyhow::anyhow!("no more embeddings"))
    }
}

/// Fake self-segmenting model: the whole audio goes in, preset lines come out. Records the language it receives and reports progress once. It can carry speaker spans, an aligner, and a speaker model (the two optional helpers of MOSS), and counts the calls to `finish_job`.
struct SegmentingModel {
    rows: Vec<RowIn>,
    speaker_ranges: Vec<SpeakerRange>,
    warnings: Vec<String>,
    cancel: bool,
    calls: Vec<(usize, Option<String>)>,
    aligner: Option<FakeAligner>,
    embedder: Option<ScriptedEmbedder>,
    /// The aligner file is present (`has_aligner`), but `aligner` may be `None` (failed to load).
    aligner_installed: bool,
    finished: usize,
}

impl SegmentingModel {
    fn new(rows: Vec<RowIn>) -> Self {
        Self {
            rows,
            speaker_ranges: Vec::new(),
            warnings: Vec::new(),
            cancel: false,
            calls: Vec::new(),
            aligner: None,
            embedder: None,
            aligner_installed: false,
            finished: 0,
        }
    }
}

impl SegmentingRecognizer for SegmentingModel {
    fn transcribe(
        &mut self,
        audio: &[f32],
        language: Option<&str>,
        callbacks: &mut SegmentingCallbacks<'_>,
    ) -> Result<SegmentedTranscription> {
        self.calls.push((audio.len(), language.map(str::to_owned)));
        let total = audio.len() as f64 / 16_000.0;
        if let Some(progress) = callbacks.on_progress.as_deref_mut() {
            progress(total, total);
        }
        if self.cancel {
            return Err(SegmentingCancelled.into());
        }
        Ok(SegmentedTranscription {
            rows: self.rows.clone(),
            speaker_ranges: self.speaker_ranges.clone(),
            warnings: self.warnings.clone(),
            ..SegmentedTranscription::default()
        })
    }
}

impl LoadedModel for SegmentingModel {
    fn run_mode(&mut self) -> RunMode<'_> {
        RunMode::SelfSegmenting(self)
    }

    fn aligner(&mut self) -> Option<&mut dyn ForcedAlignment> {
        self.aligner.as_mut().map(|aligner| aligner as &mut dyn ForcedAlignment)
    }

    fn has_aligner(&mut self) -> bool {
        self.aligner_installed || self.aligner.is_some()
    }

    fn speaker_embedder(&mut self) -> Option<&mut dyn SpeakerEmbedding> {
        self.embedder.as_mut().map(|embedder| embedder as &mut dyn SpeakerEmbedding)
    }

    fn finish_job(&mut self) {
        self.finished += 1;
    }

    fn memory(&self) -> Option<MemorySnapshot> {
        None
    }

    fn warmup_ms(&self) -> u64 {
        0
    }

    fn resident_bytes(&self) -> Option<u64> {
        None
    }
}

#[derive(Default)]
struct Events {
    events: Vec<(String, Value)>,
    memory: Vec<MemorySnapshot>,
}

impl JobSink for Events {
    fn event(&mut self, name: &str, params: Value) {
        self.events.push((name.to_owned(), params));
    }

    fn memory(&mut self, snapshot: MemorySnapshot) {
        self.memory.push(snapshot);
    }
}

impl Events {
    fn named(&self, name: &str) -> Vec<&Value> {
        self.events
            .iter()
            .filter(|(event, _)| event == name)
            .map(|(_, params)| params)
            .collect()
    }
}

struct Fixture {
    dir: tempfile::TempDir,
    bundle: VerifiedBundle,
}

impl Fixture {
    fn new() -> Self {
        Self::with_families("qwen3-asr", Some("silero-vad"))
    }

    /// `asr` uses `asr_family`; `vad_family` being `None` means no VAD (self-segmenting models).
    fn with_families(asr_family: &str, vad_family: Option<&str>) -> Self {
        Self::with_components(asr_family, vad_family, false, false)
    }

    /// Qwen3-ASR + Silero VAD + optional aligner component.
    fn with_aligner() -> Self {
        Self::with_components("qwen3-asr", Some("silero-vad"), true, false)
    }

    /// MOSS + optional aligner and speaker model.
    fn with_moss_helpers() -> Self {
        Self::with_components("moss-transcribe-diarize", None, true, true)
    }

    /// The two components of the “speaker diarization” model pack: Pyannote segmentation and WeSpeaker.
    fn with_diarization() -> Self {
        Self::build("qwen3-asr", Some("silero-vad"), false, true, true)
    }

    fn with_components(asr_family: &str, vad_family: Option<&str>, aligner: bool, speaker: bool) -> Self {
        Self::build(asr_family, vad_family, aligner, speaker, false)
    }

    fn build(asr_family: &str, vad_family: Option<&str>, aligner: bool, speaker: bool, segmentation: bool) -> Self {
        let dir = tempfile::tempdir().unwrap();
        let models = dir.path().join("models");
        std::fs::create_dir_all(&models).unwrap();
        std::fs::write(models.join("model.safetensors"), b"weights").unwrap();
        let files = json!([{ "path": "model.safetensors", "sha256": "0".repeat(64), "byteLength": 7 }]);
        let mut components = json!({
            "asr": { "family": asr_family, "revision": "asr-rev", "dir": models.to_string_lossy(), "files": files },
        });
        if let Some(family) = vad_family {
            components["vad"] = json!({ "family": family, "revision": "vad-rev", "dir": models.to_string_lossy(), "files": files });
        }
        if aligner {
            components["aligner"] =
                json!({ "family": "qwen3-forced-aligner", "revision": "aligner-rev", "dir": models.to_string_lossy(), "files": files });
        }
        if speaker {
            components["speaker"] =
                json!({ "family": "wespeaker", "revision": "speaker-rev", "dir": models.to_string_lossy(), "files": files });
        }
        if segmentation {
            components["segmentation"] = json!({
                "family": "pyannote-segmentation", "revision": "segmentation-rev", "dir": models.to_string_lossy(), "files": files
            });
        }
        let bundle: ModelBundle = serde_json::from_value(json!({
            "bundleId": "fake@test",
            "backend": "mlx",
            "device": "metal",
            "components": components,
            "threads": 1,
            "memoryBudgetBytes": null,
        }))
        .unwrap();
        let bundle = bundle::verify(&bundle).unwrap();
        Self { dir, bundle }
    }

    /// 16 kHz mono WAV: `(seconds, amplitude)` pairs concatenated in order.
    fn wav(&self, name: &str, parts: &[(f64, f32)]) -> PathBuf {
        let path = self.dir.path().join(name);
        let spec = hound::WavSpec {
            channels: 1,
            sample_rate: 16_000,
            bits_per_sample: 16,
            sample_format: hound::SampleFormat::Int,
        };
        let mut writer = hound::WavWriter::create(&path, spec).unwrap();
        for &(seconds, level) in parts {
            for _ in 0..(seconds * 16_000.0) as usize {
                writer.write_sample((level * f32::from(i16::MAX)) as i16).unwrap();
            }
        }
        writer.finalize().unwrap();
        path
    }

    fn staging(&self, name: &str) -> PathBuf {
        let path = self.dir.path().join("staging").join(name);
        std::fs::create_dir_all(&path).unwrap();
        path
    }
}

fn params(file: &Path, staging: &Path, options: Value, range: Option<Value>) -> JobRunParams {
    let mut input = json!({ "file": file.to_string_lossy(), "contentHash": "sha256:abc", "track": 0 });
    if let Some(range) = range {
        input["range"] = range;
    }
    serde_json::from_value(json!({
        "jobId": "job-1",
        "runGeneration": 3,
        "capability": "transcribe",
        "input": input,
        "options": options,
        "staging": staging.to_string_lossy(),
        "outputContract": "cuccut.asr-result/v1",
    }))
    .unwrap()
}

fn prefer_auto() -> Value {
    json!({ "language": { "mode": "prefer", "tag": null }, "diarize": false, "timescale": 1_000_000 })
}

fn run(fixture: &Fixture, model: &mut FakeModel, params: &JobRunParams, events: &mut Events) -> Result<JobRunResult, ErrorBody> {
    transcribe::run(model, &fixture.bundle, params, &AtomicBool::new(false), events)
}

fn read_result(result: &JobRunResult) -> AsrResult {
    let output = result.output.as_ref().expect("completed jobs have an output");
    let bytes = std::fs::read(&output.path).unwrap();
    assert_eq!(output.sha256, asr_result::sha256_hex(&bytes));
    assert_eq!(output.byte_length, bytes.len() as u64);
    serde_json::from_slice(&bytes).unwrap()
}

/// Two speech segments: 1–3 s and 4–5 s (file time).
const TWO_PHRASES: &[(f64, f32)] = &[(1.0, 0.0), (2.0, 0.9), (1.0, 0.0), (1.0, 0.9), (1.0, 0.0)];

#[test]
fn range_jobs_report_ticks_on_the_asset_clock() {
    let fixture = Fixture::new();
    let wav = fixture.wav("two.wav", TWO_PHRASES);
    let staging = fixture.staging("range");
    let mut model = FakeModel::new(&["Hello there, world.", "Bye now."]);
    let mut events = Events::default();
    let range = json!({ "start": 500, "end": 5_500, "timescale": 1_000 });
    let job = params(&wav, &staging, prefer_auto(), Some(range));
    let result = run(&fixture, &mut model, &job, &mut events).unwrap();
    assert_eq!(result.outcome, JobOutcome::Completed);
    assert!(
        result.stats.speech_seconds > 2.5 && result.stats.speech_seconds < 3.5,
        "{:?}",
        result.stats
    );

    let asr = read_result(&result);
    asr_result::validate(&asr, None).unwrap();
    assert_eq!(asr.outcome, Outcome::Transcribed);
    assert_eq!(asr.duration, 5_500_000);
    assert_eq!((asr.coverage[0].start, asr.coverage[0].end), (500_000, 5_500_000));
    assert_eq!(asr.segments.len(), 2);
    let [first, second] = [&asr.segments[0], &asr.segments[1]];
    assert_eq!((first.id.as_str(), second.id.as_str()), ("seg-0001", "seg-0002"));
    // Speech starts at 1.0 s in the source, padded with 0.15 s on each side; VAD chunks are 32 ms.
    assert!((800_000..=900_000).contains(&first.start), "{}", first.start);
    assert!((3_100_000..=3_250_000).contains(&first.end), "{}", first.end);
    assert!((3_800_000..=3_900_000).contains(&second.start), "{}", second.start);
    assert!(first.end <= second.start);
    assert_eq!(
        first.words.iter().map(|word| word.text.as_str()).collect::<Vec<_>>(),
        ["Hello", "there,", "world."]
    );
    assert!(first.words.iter().all(|word| word.timing_quality == TimingQuality::Estimated));
    assert_eq!((first.words[0].start, first.words[2].end), (first.start, first.end));

    assert_eq!(asr.language.tag.as_deref(), Some("en"));
    assert_eq!(asr.language.source, LanguageSource::Detected);
    assert_eq!(asr.provenance.input_hash, "sha256:abc");
    assert_eq!(asr.provenance.run_generation, 3);
    assert_eq!(asr.provenance.models.asr.as_ref().unwrap().revision, "asr-rev");
    assert!(asr.provenance.models.aligner.is_none());

    // Auto-detect: no segment specifies a language; the model decides for each one. The task's language is fixed by the first segment and pushed only once.
    let languages: Vec<Option<&str>> = model.asr.requests.iter().map(|(_, language, _)| language.as_deref()).collect();
    assert_eq!(languages, [None, None]);
    assert_eq!(
        events.named("job.language"),
        [&json!({ "jobId": "job-1", "tag": "en", "confidence": null })]
    );
    let phases: Vec<&str> = events
        .named("job.phase")
        .iter()
        .map(|params| params["phase"].as_str().unwrap())
        .collect();
    assert_eq!(phases, ["decoding", "vad", "transcribing", "finalizing"]);
    assert_eq!(events.named("job.segment").len(), 2);
    assert_eq!(events.memory.len(), 2);

    // segments.jsonl: the first line, then the same as the result.
    let lines: Vec<Value> = std::fs::read_to_string(result.segments_file.as_ref().unwrap())
        .unwrap()
        .lines()
        .map(|line| serde_json::from_str(line).unwrap())
        .collect();
    assert_eq!(
        lines[0],
        json!({ "header": true, "jobId": "job-1", "contentHash": "sha256:abc", "bundleId": "fake@test",
                "workerVersion": model_runtime::WORKER_VERSION, "timescale": 1_000_000 })
    );
    assert_eq!(
        lines[1..],
        [serde_json::to_value(first).unwrap(), serde_json::to_value(second).unwrap()]
    );
}

#[test]
fn empty_recognitions_are_skipped_and_ids_stay_dense() {
    let fixture = Fixture::new();
    let wav = fixture.wav("two.wav", TWO_PHRASES);
    let staging = fixture.staging("skip");
    let mut model = FakeModel::new(&["  ", "Second phrase."]);
    let options = json!({ "language": { "mode": "assert", "tag": "en-US" }, "diarize": true, "hint": "CucCut", "timescale": 48_000 });
    let mut events = Events::default();
    let result = run(&fixture, &mut model, &params(&wav, &staging, options, None), &mut events).unwrap();
    let asr = read_result(&result);
    asr_result::validate(&asr, Some("en-US")).unwrap();
    assert_eq!(asr.timescale, 48_000);
    assert_eq!(asr.duration, 6 * 48_000);
    assert_eq!(asr.segments.len(), 1);
    assert_eq!(asr.segments[0].id, "seg-0001");
    assert_eq!(asr.segments[0].text, "Second phrase.");
    assert_eq!(asr.language.tag.as_deref(), Some("en-US"));
    assert_eq!(asr.language.source, LanguageSource::Asserted);
    // The asserted language and the hint are passed to the recognizer unchanged.
    assert!(
        model
            .asr
            .requests
            .iter()
            .all(|(_, language, context)| language.as_deref() == Some("en") && context.as_deref() == Some("CucCut"))
    );
    assert!(events.named("job.language").is_empty());
    assert_eq!(
        asr.warnings.iter().map(|warning| warning.code).collect::<Vec<_>>(),
        [WarningCode::DiarizationUnavailable]
    );
    assert_eq!(events.named("job.warning").len(), 1);
}

/// Speaker diarization (§6.6): runs once after recognition completes. Spans are projected onto words, and each segment takes the speaker who speaks most in it. IDs are numbered by first appearance in time, and speakers with no words assigned come last. Segments already streamed out carry no speaker; only `result.json` has them.
#[test]
fn pipeline_models_diarize_after_recognition_and_label_words() {
    let fixture = Fixture::with_diarization();
    let wav = fixture.wav("two.wav", TWO_PHRASES);
    let staging = fixture.staging("diarize");
    // The two speech segments are at about 0.85–3.15 s and 3.85–5.15 s. The first speaker is cluster 1; cluster 2 appears only in the trailing silence.
    let script = DiarizerScript::Segments(vec![(0.8, 3.3, 1), (3.8, 5.2, 0), (5.6, 5.9, 2)]);
    let mut model = FakeModel::with_diarizer(&["Hello there, world.", "Bye now."], script);
    let options = json!({ "language": { "mode": "prefer", "tag": null }, "diarize": true, "timescale": 1_000_000 });
    let mut events = Events::default();
    let result = run(&fixture, &mut model, &params(&wav, &staging, options, None), &mut events).unwrap();
    let asr = read_result(&result);
    asr_result::validate(&asr, None).unwrap();
    assert!(asr.warnings.is_empty(), "{:?}", asr.warnings);
    assert_eq!(phases(&events), ["decoding", "vad", "transcribing", "diarizing", "finalizing"]);
    let diarizer = model.diarizer.as_ref().unwrap();
    assert_eq!(diarizer.calls.len(), 1);
    assert_eq!(diarizer.calls[0].0, 6 * 16_000, "the whole decoded audio");
    assert_eq!(diarizer.calls[0].1.max_speakers, None);
    assert_eq!(model.finished, 1);
    assert!(
        events
            .named("job.progress")
            .iter()
            .any(|params| params["phase"] == "diarizing" && params["unit"] == "steps")
    );

    let ids: Vec<&str> = asr.speakers.iter().map(|speaker| speaker.id.as_str()).collect();
    assert_eq!(ids, ["spk-1", "spk-2", "spk-3"]);
    assert!(asr.speakers.iter().all(|speaker| speaker.label.is_none()));
    assert_eq!(asr.segments[0].speaker_id.as_deref(), Some("spk-1"));
    assert_eq!(asr.segments[1].speaker_id.as_deref(), Some("spk-2"));
    for segment in &asr.segments {
        assert!(
            segment.words.iter().all(|word| word.speaker_id == segment.speaker_id),
            "{segment:?}"
        );
    }
    assert_eq!(asr.provenance.models.segmentation.as_ref().unwrap().revision, "segmentation-rev");
    assert_eq!(asr.provenance.models.speaker.as_ref().unwrap().revision, "speaker-rev");

    // Streamed segments (job.segment and segments.jsonl) carry no speaker, because they are sent before diarization.
    for streamed in events.named("job.segment") {
        assert_eq!(streamed["segment"]["speakerId"], Value::Null);
    }
    let lines = std::fs::read_to_string(result.segments_file.as_ref().unwrap()).unwrap();
    assert!(!lines.contains("spk-"), "{lines}");

    // When speakers are not requested, diarization does not run and no warning is raised.
    let staging = fixture.staging("no-diarize");
    let mut model = FakeModel::with_diarizer(&["Hello there, world.", "Bye now."], DiarizerScript::Fail);
    let mut events = Events::default();
    let result = run(&fixture, &mut model, &params(&wav, &staging, prefer_auto(), None), &mut events).unwrap();
    let asr = read_result(&result);
    assert!(asr.speakers.is_empty() && asr.warnings.is_empty());
    assert!(asr.provenance.models.segmentation.is_none() && asr.provenance.models.speaker.is_none());
    assert!(model.diarizer.as_ref().unwrap().calls.is_empty());
    assert_eq!(phases(&events), ["decoding", "vad", "transcribing", "finalizing"]);
}

/// If diarization errors out or fails to load: report `diarization-unavailable` and keep the transcript without speakers. Cancellation is still `cancelled`, as usual.
#[test]
fn diarization_failures_keep_the_transcript_and_cancel_stops_the_job() {
    let fixture = Fixture::with_diarization();
    let wav = fixture.wav("two.wav", TWO_PHRASES);
    let options = json!({ "language": { "mode": "prefer", "tag": null }, "diarize": true, "timescale": 1_000_000 });
    for (name, mut model) in [
        (
            "fail",
            FakeModel::with_diarizer(&["Hello there.", "Bye now."], DiarizerScript::Fail),
        ),
        (
            "unloadable",
            FakeModel {
                diarizer_installed: true,
                ..FakeModel::new(&["Hello there.", "Bye now."])
            },
        ),
    ] {
        let staging = fixture.staging(name);
        let mut events = Events::default();
        let result = run(&fixture, &mut model, &params(&wav, &staging, options.clone(), None), &mut events).unwrap();
        let asr = read_result(&result);
        asr_result::validate(&asr, None).unwrap();
        assert_eq!(asr.segments.len(), 2, "{name}");
        assert!(asr.speakers.is_empty(), "{name}");
        assert!(asr.segments.iter().all(|segment| segment.speaker_id.is_none()), "{name}");
        assert_eq!(
            asr.warnings.iter().map(|warning| warning.code).collect::<Vec<_>>(),
            [WarningCode::DiarizationUnavailable],
            "{name}"
        );
        assert!(asr.provenance.models.segmentation.is_none(), "{name}");
    }

    let staging = fixture.staging("cancel");
    let mut model = FakeModel::with_diarizer(&["Hello there.", "Bye now."], DiarizerScript::Cancel);
    let mut events = Events::default();
    let result = run(&fixture, &mut model, &params(&wav, &staging, options, None), &mut events).unwrap();
    assert_eq!(result.outcome, JobOutcome::Cancelled);
    assert!(result.output.is_none());
    assert_eq!(model.finished, 1);
}

/// A segment with no speech (empty text): the model still self-reports a language (often English). Do not lock to it; wait for the first segment that has text.
#[test]
fn an_empty_segment_does_not_lock_the_detected_language() {
    let fixture = Fixture::new();
    let wav = fixture.wav("two.wav", TWO_PHRASES);
    let staging = fixture.staging("empty-language");
    let mut model = FakeModel::new(&["", "今天下午我们开会讨论发布计划。"]);
    model.asr.language_names = [Some("English"), Some("Chinese")].into_iter().collect();
    let mut events = Events::default();
    let result = run(&fixture, &mut model, &params(&wav, &staging, prefer_auto(), None), &mut events).unwrap();
    let asr = read_result(&result);
    assert_eq!(asr.language.tag.as_deref(), Some("zh"));
    assert_eq!(asr.language.source, LanguageSource::Detected);
    assert_eq!(asr.language.confidence, None);
    let languages: Vec<Option<&str>> = model.asr.requests.iter().map(|(_, language, _)| language.as_deref()).collect();
    assert_eq!(languages, [None, None], "nothing is locked after the empty segment");
    assert_eq!(
        events.named("job.language"),
        [&json!({ "jobId": "job-1", "tag": "zh", "confidence": null })]
    );
}

/// A language fixed early during auto-detect is not forced onto later segments (mixed Chinese-English material): each segment is left to the model. The aligner and word-time estimation use the language the model self-reports for that segment, and fall back to the task's language when none is reported. The task's language is the one fixed by the first segment that has text.
#[test]
fn later_segments_are_not_forced_into_the_first_detected_language() {
    let fixture = Fixture::with_aligner();
    let wav = fixture.wav(
        "three.wav",
        &[(0.5, 0.0), (1.0, 0.9), (1.0, 0.0), (1.0, 0.9), (1.0, 0.0), (1.0, 0.9), (0.5, 0.0)],
    );
    let staging = fixture.staging("mixed-language");
    let mut model = FakeModel::with_aligner(
        &["Let me show you.", "首先打开设置页面。", "然后点击导出。"],
        FakeAligner::new(AlignerScript::Empty),
    );
    model.asr.language_names = [Some("English"), Some("Chinese"), None].into_iter().collect();
    let mut events = Events::default();
    let result = run(&fixture, &mut model, &params(&wav, &staging, prefer_auto(), None), &mut events).unwrap();
    let asr = read_result(&result);
    asr_result::validate(&asr, None).unwrap();
    let languages: Vec<Option<&str>> = model.asr.requests.iter().map(|(_, language, _)| language.as_deref()).collect();
    assert_eq!(languages, [None, None, None]);
    let aligned: Vec<Option<&str>> = model
        .aligner
        .as_ref()
        .unwrap()
        .calls
        .iter()
        .map(|(_, _, language)| language.as_deref())
        .collect();
    assert_eq!(aligned, [Some("en"), Some("zh"), Some("en")]);
    assert_eq!(asr.language.tag.as_deref(), Some("en"));
    assert_eq!(asr.language.source, LanguageSource::Detected);
    assert_eq!(
        events.named("job.language"),
        [&json!({ "jobId": "job-1", "tag": "en", "confidence": null })]
    );
    assert_eq!(asr.segments.len(), 3);
}

#[test]
fn cancel_takes_effect_at_the_next_segment() {
    let fixture = Fixture::new();
    let wav = fixture.wav("two.wav", TWO_PHRASES);
    let staging = fixture.staging("cancel");
    let mut model = FakeModel::new(&["First.", "Second."]);
    let cancel = Arc::new(AtomicBool::new(false));
    model.asr.cancel_on_first_call = Some(cancel.clone());
    let mut events = Events::default();
    let result = transcribe::run(
        &mut model,
        &fixture.bundle,
        &params(&wav, &staging, prefer_auto(), None),
        &cancel,
        &mut events,
    )
    .unwrap();
    assert_eq!(result.outcome, JobOutcome::Cancelled);
    assert!(result.output.is_none());
    assert!(!staging.join(asr_result::RESULT_FILE).exists());
    // A segment that started before cancellation finishes and is written out as usual.
    assert_eq!(model.asr.requests.len(), 1);
    assert_eq!(events.named("job.segment").len(), 1);
    let lines = std::fs::read_to_string(result.segments_file.unwrap()).unwrap();
    assert_eq!(lines.lines().count(), 2);
}

#[test]
fn silence_is_no_speech_and_a_missing_track_is_no_audio_track() {
    let fixture = Fixture::new();
    let wav = fixture.wav("silence.wav", &[(2.0, 0.0)]);

    let staging = fixture.staging("silence");
    let mut model = FakeModel::new(&[]);
    let result = run(
        &fixture,
        &mut model,
        &params(&wav, &staging, prefer_auto(), None),
        &mut Events::default(),
    )
    .unwrap();
    let asr = read_result(&result);
    assert_eq!(asr.outcome, Outcome::NoSpeech);
    assert!(asr.segments.is_empty());
    assert_eq!(asr.duration, 2_000_000);
    assert_eq!((asr.coverage[0].start, asr.coverage[0].end), (0, 2_000_000));
    assert_eq!(asr.language.tag, None);
    assert_eq!(asr.language.source, LanguageSource::Unknown);
    assert!(model.asr.requests.is_empty());

    let staging = fixture.staging("no-track");
    let mut job = params(&wav, &staging, json!({ "language": { "mode": "prefer", "tag": "de" } }), None);
    job.input.track = 1;
    let result = run(&fixture, &mut model, &job, &mut Events::default()).unwrap();
    let asr = read_result(&result);
    assert_eq!(asr.outcome, Outcome::NoAudioTrack);
    assert!(asr.coverage.is_empty());
    assert_eq!(asr.language.tag.as_deref(), Some("de"));
    assert_eq!(asr.language.source, LanguageSource::Unknown);
}

#[test]
fn bad_requests_are_rejected_before_any_work() {
    let fixture = Fixture::new();
    let wav = fixture.wav("two.wav", TWO_PHRASES);
    let staging = fixture.staging("bad");
    let mut model = FakeModel::new(&[]);
    let code = |job: JobRunParams, model: &mut FakeModel| run(&fixture, model, &job, &mut Events::default()).unwrap_err().code;

    let mut job = params(&wav, &staging, prefer_auto(), None);
    job.capability = serde_json::from_value(json!("align")).unwrap();
    assert_eq!(code(job, &mut model), "MODEL_UNSUPPORTED");

    let mut job = params(&wav, &staging, prefer_auto(), None);
    job.output_contract = "cuccut.asr-result/v2".into();
    assert_eq!(code(job, &mut model), "INVALID_PARAMS");

    let job = params(&wav, &staging, json!({ "language": { "mode": "assert", "tag": "sw" } }), None);
    assert_eq!(code(job, &mut model), "MODEL_UNSUPPORTED");

    let job = params(
        &wav,
        &staging,
        json!({ "language": { "mode": "assert", "tag": "not a tag" } }),
        None,
    );
    assert_eq!(code(job, &mut model), "INVALID_PARAMS");

    let job = params(
        &wav,
        &staging,
        json!({ "language": { "mode": "prefer", "tag": null }, "hint": "x".repeat(1_201) }),
        None,
    );
    assert_eq!(code(job, &mut model), "INVALID_PARAMS");

    let job = params(
        &wav,
        &staging,
        json!({ "language": { "mode": "prefer", "tag": null }, "surprise": 1 }),
        None,
    );
    assert_eq!(code(job, &mut model), "INVALID_PARAMS");

    let job = params(&wav, &staging, prefer_auto(), Some(json!({ "start": 5, "end": 5, "timescale": 1 })));
    assert_eq!(code(job, &mut model), "INVALID_PARAMS");

    let job = params(&wav, Path::new("relative/staging"), prefer_auto(), None);
    assert_eq!(code(job, &mut model), "INVALID_PARAMS");

    let missing = fixture.dir.path().join("missing.wav");
    let job = params(&missing, &staging, prefer_auto(), None);
    let error = run(&fixture, &mut model, &job, &mut Events::default()).unwrap_err();
    assert_eq!(error.code, "INPUT_UNREADABLE");
    assert!(!error.message.contains(&*missing.to_string_lossy()));
    assert!(model.asr.requests.is_empty());
}

#[test]
fn a_range_past_the_end_is_clamped_with_a_warning() {
    let fixture = Fixture::new();
    let wav = fixture.wav("two.wav", TWO_PHRASES);
    let staging = fixture.staging("clamped");
    let mut model = FakeModel::new(&["Bye now."]);
    let range = json!({ "start": 3_500, "end": 9_000, "timescale": 1_000 });
    let result = run(
        &fixture,
        &mut model,
        &params(&wav, &staging, prefer_auto(), Some(range)),
        &mut Events::default(),
    )
    .unwrap();
    let asr = read_result(&result);
    asr_result::validate(&asr, None).unwrap();
    assert_eq!(asr.duration, 6_000_000);
    assert_eq!((asr.coverage[0].start, asr.coverage[0].end), (3_500_000, 6_000_000));
    assert!(asr.warnings.iter().any(|warning| warning.code == WarningCode::RangeClamped));
    assert_eq!(asr.segments.len(), 1);
    assert!(asr.segments[0].start >= 3_500_000);
}

fn row(start: f64, end: f64, text: &str, speaker: Option<&str>) -> RowIn {
    RowIn {
        speaker: speaker.map(str::to_owned),
        ..RowIn::new(start, end, text)
    }
}

#[test]
fn self_segmenting_models_skip_vad_and_keep_speakers_only_when_asked() {
    let fixture = Fixture::with_families("moss-transcribe-diarize", None);
    let wav = fixture.wav("two.wav", TWO_PHRASES);
    // Out of order, overlapping, with one empty-text line and one out-of-range line: sorted, split at the midpoints, empty lines dropped, clamped to the audio length.
    let rows = vec![
        row(4.0, 5.2, "Habari.", Some("S02")),
        row(0.9, 3.1, "Jambo, rafiki.", Some("S01")),
        row(3.0, 3.5, "  ", Some("S03")),
        row(5.0, 9.0, "Kwaheri.", Some("S01")),
    ];
    // Qwen3-ASR does not recognize Swahili, MOSS does: the asserted language is enforced per model family.
    let options = json!({ "language": { "mode": "assert", "tag": "sw" }, "diarize": true, "hint": "CucCut", "timescale": 1_000 });
    let mut model = SegmentingModel::new(rows.clone());
    model.warnings.push("a chunk ended early".into());
    model.warnings.push("moss-incomplete: 第 2 块未完整转录".into());
    let mut events = Events::default();
    let staging = fixture.staging("diarized");
    let result = transcribe::run(
        &mut model,
        &fixture.bundle,
        &params(&wav, &staging, options.clone(), None),
        &AtomicBool::new(false),
        &mut events,
    )
    .unwrap();
    let asr = read_result(&result);
    asr_result::validate(&asr, Some("sw")).unwrap();
    assert_eq!(
        model.calls,
        [(6 * 16_000, Some("sw".to_owned()))],
        "整段音频一次交出，只送断言的语言"
    );
    let spans: Vec<(u64, u64, &str, Option<&str>)> = asr
        .segments
        .iter()
        .map(|segment| (segment.start, segment.end, segment.text.as_str(), segment.speaker_id.as_deref()))
        .collect();
    assert_eq!(
        spans,
        [
            (900, 3_100, "Jambo, rafiki.", Some("spk-1")),
            (4_000, 5_100, "Habari.", Some("spk-2")),
            (5_100, 6_000, "Kwaheri.", Some("spk-1")),
        ]
    );
    assert_eq!(
        asr.speakers.iter().map(|speaker| speaker.id.as_str()).collect::<Vec<_>>(),
        ["spk-1", "spk-2"]
    );
    // A self-segmenting model with speakers and only one chunk does not report diarization-unavailable. With no hint channel, passing a hint reports hint-ignored. A chunk that was not finished reports segment-incomplete; the other model warnings go only to the log.
    assert_eq!(
        asr.warnings.iter().map(|warning| warning.code).collect::<Vec<_>>(),
        [WarningCode::HintIgnored, WarningCode::SegmentIncomplete]
    );
    assert_eq!(asr.warnings[1].detail.as_deref(), Some("第 2 块未完整转录"));
    assert!(asr.provenance.models.vad.is_none());
    assert!(asr.provenance.models.aligner.is_none());
    assert!(asr.provenance.models.speaker.is_none());
    assert_eq!(model.finished, 1, "任务结束时放下助手模型");
    let phases: Vec<&str> = events
        .named("job.phase")
        .iter()
        .map(|params| params["phase"].as_str().unwrap())
        .collect();
    assert_eq!(phases, ["decoding", "transcribing", "finalizing"]);
    assert_eq!(events.named("job.segment").len(), 3);
    assert!(
        events
            .named("job.progress")
            .iter()
            .any(|params| params["phase"] == "transcribing" && params["unit"] == "seconds")
    );

    // No speakers requested: labels are dropped.
    let mut options = options;
    options["diarize"] = json!(false);
    let mut model = SegmentingModel::new(rows);
    let staging = fixture.staging("plain");
    let result = transcribe::run(
        &mut model,
        &fixture.bundle,
        &params(&wav, &staging, options, None),
        &AtomicBool::new(false),
        &mut Events::default(),
    )
    .unwrap();
    let asr = read_result(&result);
    assert_eq!(asr.segments.len(), 3);
    assert!(asr.speakers.is_empty());
    assert!(asr.segments.iter().all(|segment| segment.speaker_id.is_none()));

    // Auto-detect: no language is sent; the model's cancellation error counts as cancellation, not failure.
    let mut model = SegmentingModel::new(Vec::new());
    model.cancel = true;
    let staging = fixture.staging("cancelled");
    let result = transcribe::run(
        &mut model,
        &fixture.bundle,
        &params(&wav, &staging, prefer_auto(), None),
        &AtomicBool::new(false),
        &mut Events::default(),
    )
    .unwrap();
    assert_eq!(result.outcome, JobOutcome::Cancelled);
    assert_eq!(model.calls, [(6 * 16_000, None)]);
    assert!(!staging.join(asr_result::RESULT_FILE).exists());
}

/// Two chunks, each with one speaker (the labels within each chunk are all `S01`): MOSS's lines and speaker spans. The first line is longer than 5 seconds and has no word times.
fn two_chunk_rows() -> (Vec<RowIn>, Vec<SpeakerRange>) {
    let rows = vec![
        row(0.0, 5.2, "Hello world.", Some("S01")),
        row(
            5.2,
            6.0,
            "This is the second speaker, and we are talking about the weather.",
            Some("S01"),
        ),
    ];
    let ranges = vec![
        SpeakerRange {
            start: 0.0,
            end: 5.2,
            cluster: 0,
            chunk: 0,
        },
        SpeakerRange {
            start: 5.2,
            end: 6.0,
            cluster: 1,
            chunk: 1,
        },
    ];
    (rows, ranges)
}

#[test]
fn self_segmenting_models_merge_speakers_across_chunks_and_align_long_rows() {
    let fixture = Fixture::with_moss_helpers();
    let wav = fixture.wav("two.wav", TWO_PHRASES);
    let options = json!({ "language": { "mode": "prefer", "tag": null }, "diarize": true });
    let (rows, ranges) = two_chunk_rows();

    // The embeddings of the two chunks are orthogonal: the `S01` in each chunk is actually two different people.
    let mut model = SegmentingModel::new(rows.clone());
    model.speaker_ranges = ranges.clone();
    model.aligner = Some(FakeAligner::hello_world());
    model.embedder = Some(ScriptedEmbedder {
        vectors: VecDeque::from([vec![1.0, 0.0], vec![0.0, 1.0]]),
        calls: Vec::new(),
    });
    let mut events = Events::default();
    let staging = fixture.staging("merged");
    let result = transcribe::run(
        &mut model,
        &fixture.bundle,
        &params(&wav, &staging, options.clone(), None),
        &AtomicBool::new(false),
        &mut events,
    )
    .unwrap();
    let asr = read_result(&result);
    asr_result::validate(&asr, None).unwrap();
    assert_eq!(phases(&events), ["decoding", "transcribing", "diarizing", "aligning", "finalizing"]);
    assert_eq!(
        model.embedder.as_ref().unwrap().calls,
        [(5.2 * 16_000.0) as usize, (0.8 * 16_000.0) as usize]
    );
    assert_eq!(
        asr.segments.iter().map(|segment| segment.speaker_id.as_deref()).collect::<Vec<_>>(),
        [Some("spk-1"), Some("spk-2")]
    );
    assert_eq!(asr.speakers.len(), 2);
    // With no asserted language, guess once from the full text; use the result as the language and push `job.language` once.
    assert_eq!(asr.language.tag.as_deref(), Some("en"));
    assert_eq!(asr.language.source, LanguageSource::Detected);
    assert_eq!(events.named("job.language").len(), 1);
    // Only lines longer than 5 seconds with no word times are sent for alignment; without an asserted language, guess from the full text.
    let aligner = model.aligner.as_ref().unwrap();
    assert_eq!(aligner.calls.len(), 1);
    assert_eq!(aligner.calls[0].1, "Hello world.");
    assert_eq!(aligner.calls[0].2.as_deref(), Some("en"));
    assert!(
        asr.segments[0]
            .words
            .iter()
            .all(|word| word.timing_quality == TimingQuality::Aligned)
    );
    assert!(
        asr.segments[1]
            .words
            .iter()
            .all(|word| word.timing_quality != TimingQuality::Aligned)
    );
    assert!(asr.warnings.is_empty(), "{:?}", asr.warnings);
    assert!(asr.provenance.models.aligner.is_some());
    assert!(asr.provenance.models.speaker.is_some());
    assert!(
        events
            .named("job.progress")
            .iter()
            .any(|params| params["phase"] == "aligning" && params["unit"] == "segments")
    );
    assert_eq!(model.finished, 1);

    // Identical embeddings: merged into one person.
    let mut model = SegmentingModel::new(rows.clone());
    model.speaker_ranges = ranges.clone();
    model.aligner_installed = true;
    model.embedder = Some(ScriptedEmbedder {
        vectors: VecDeque::from([vec![1.0, 0.0], vec![1.0, 0.0]]),
        calls: Vec::new(),
    });
    let staging = fixture.staging("same");
    let result = transcribe::run(
        &mut model,
        &fixture.bundle,
        &params(&wav, &staging, options.clone(), None),
        &AtomicBool::new(false),
        &mut Events::default(),
    )
    .unwrap();
    let asr = read_result(&result);
    assert_eq!(
        asr.segments.iter().map(|segment| segment.speaker_id.as_deref()).collect::<Vec<_>>(),
        [Some("spk-1"), Some("spk-1")]
    );
    // The aligner file is present but did not load: one alignment-failed, word times are estimated, and provenance does not record the aligner.
    assert_eq!(
        asr.warnings.iter().map(|warning| warning.code).collect::<Vec<_>>(),
        [WarningCode::AlignmentFailed]
    );
    assert!(asr.warnings[0].segment_id.is_none());
    assert!(asr.provenance.models.aligner.is_none());
}

#[test]
fn self_segmenting_models_keep_chunk_labels_with_a_warning_when_speakers_cannot_merge() {
    let fixture = Fixture::with_moss_helpers();
    let wav = fixture.wav("two.wav", TWO_PHRASES);
    let options = json!({ "language": { "mode": "assert", "tag": "en" }, "diarize": true });
    let (rows, ranges) = two_chunk_rows();

    // The speaker model fails to load, and the aligner fails on the only long line.
    let mut model = SegmentingModel::new(rows);
    model.speaker_ranges = ranges;
    model.aligner = Some(FakeAligner::new(AlignerScript::Fail));
    let staging = fixture.staging("unmerged");
    let result = transcribe::run(
        &mut model,
        &fixture.bundle,
        &params(&wav, &staging, options, None),
        &AtomicBool::new(false),
        &mut Events::default(),
    )
    .unwrap();
    let asr = read_result(&result);
    asr_result::validate(&asr, Some("en")).unwrap();
    assert_eq!(model.aligner.as_ref().unwrap().calls[0].2.as_deref(), Some("en"));
    assert_eq!(
        asr.segments.iter().map(|segment| segment.speaker_id.as_deref()).collect::<Vec<_>>(),
        [Some("spk-1"), Some("spk-1")]
    );
    let warnings: Vec<_> = asr
        .warnings
        .iter()
        .map(|warning| (warning.code, warning.segment_id.as_deref()))
        .collect();
    assert_eq!(
        warnings,
        [
            (WarningCode::DiarizationUnavailable, None),
            (WarningCode::AlignmentFailed, Some(asr.segments[0].id.as_str())),
        ]
    );
    assert!(asr.provenance.models.speaker.is_none());
    assert!(
        asr.segments[0]
            .words
            .iter()
            .all(|word| word.timing_quality != TimingQuality::Aligned)
    );
    assert_eq!(model.finished, 1);
}

fn phases(events: &Events) -> Vec<&str> {
    events
        .named("job.phase")
        .iter()
        .map(|params| params["phase"].as_str().unwrap())
        .collect()
}

fn align_params(file: &Path, staging: &Path, language: &str, text: &str, range: Option<Value>) -> JobRunParams {
    let options = json!({ "language": { "mode": "assert", "tag": language }, "text": text, "timescale": 1_000_000 });
    let mut job = params(file, staging, options, range);
    job.capability = serde_json::from_value(json!("align")).unwrap();
    job
}

#[test]
fn aligned_words_are_absolute_strictly_increasing_and_name_the_aligner() {
    let fixture = Fixture::with_aligner();
    let wav = fixture.wav("two.wav", TWO_PHRASES);
    let staging = fixture.staging("aligned");
    let mut model = FakeModel::with_aligner(&["hello world", "hello world"], FakeAligner::hello_world());
    let mut events = Events::default();
    let range = json!({ "start": 500, "end": 5_500, "timescale": 1_000 });
    let job = params(&wav, &staging, prefer_auto(), Some(range));
    let result = run(&fixture, &mut model, &job, &mut events).unwrap();
    let asr = read_result(&result);
    asr_result::validate(&asr, None).unwrap();
    assert_eq!(asr.segments.len(), 2);
    for segment in &asr.segments {
        assert_eq!(
            segment.words.iter().map(|word| word.text.as_str()).collect::<Vec<_>>(),
            ["hello", "world"]
        );
        assert!(segment.words.iter().all(|word| word.timing_quality == TimingQuality::Aligned));
        // The aligner's times are relative to the start of the recognition span (which was padded). After converting to source time, the first word falls exactly at the segment start.
        assert_eq!(segment.words[0].start, segment.start);
        let second = segment.words[1].start - segment.start;
        assert!((119_000..=121_000).contains(&second), "{second}");
        assert!(segment.words[0].end <= segment.words[1].start);
        assert!(segment.words[1].end <= segment.end);
    }
    assert!(asr.warnings.is_empty(), "{:?}", asr.warnings);
    let aligner = asr.provenance.models.aligner.as_ref().expect("the aligner is named in provenance");
    assert_eq!(
        (aligner.family.as_str(), aligner.revision.as_str()),
        ("qwen3-forced-aligner", "aligner-rev")
    );
    // Once per segment: receives the same audio as the recognizer, the recognized text, and the model's self-reported language for that segment.
    let calls = &model.aligner.as_ref().unwrap().calls;
    assert_eq!(calls.len(), 2);
    for ((samples, text, language), (asr_samples, _, _)) in calls.iter().zip(&model.asr.requests) {
        assert_eq!(
            (samples, text.as_str(), language.as_deref()),
            (asr_samples, "hello world", Some("en"))
        );
    }
    assert_eq!(phases(&events), ["decoding", "vad", "transcribing", "finalizing"]);
}

#[test]
fn alignment_failures_fall_back_to_estimated_words_with_a_warning() {
    for script in [AlignerScript::Fail, AlignerScript::Empty] {
        let fixture = Fixture::with_aligner();
        let wav = fixture.wav("two.wav", TWO_PHRASES);
        let staging = fixture.staging("fallback");
        let mut model = FakeModel::with_aligner(&["Hello there, world.", "Bye now."], FakeAligner::new(script));
        let mut events = Events::default();
        let result = run(&fixture, &mut model, &params(&wav, &staging, prefer_auto(), None), &mut events).unwrap();
        let asr = read_result(&result);
        asr_result::validate(&asr, None).unwrap();
        assert_eq!(asr.segments.len(), 2);
        assert!(
            asr.segments
                .iter()
                .flat_map(|segment| &segment.words)
                .all(|word| word.timing_quality == TimingQuality::Estimated)
        );
        let warnings: Vec<_> = asr
            .warnings
            .iter()
            .map(|warning| (warning.code, warning.segment_id.as_deref()))
            .collect();
        assert_eq!(
            warnings,
            [
                (WarningCode::AlignmentFailed, Some("seg-0001")),
                (WarningCode::AlignmentFailed, Some("seg-0002"))
            ]
        );
        assert_eq!(events.named("job.warning").len(), 2);
    }
}

#[test]
fn align_segments_known_text_by_pauses_and_sentence_ends() {
    let fixture = Fixture::with_aligner();
    let wav = fixture.wav("two.wav", TWO_PHRASES);
    let staging = fixture.staging("align");
    // Decoding starts at 0.5 s of the source: the aligner's times are relative to the decode start.
    let words = vec![
        ("Hello", 0.5, 0.9),
        ("there.", 1.0, 1.5),
        ("Bye", 3.5, 3.9),
        ("now", 4.0, 4.3),
        ("then", 5.4, 5.6),
    ];
    let mut model = FakeModel::with_aligner(&[], FakeAligner::new(AlignerScript::Words(words)));
    let mut events = Events::default();
    let range = json!({ "start": 500, "end": 5_500, "timescale": 1_000 });
    let job = align_params(&wav, &staging, "en", "Hello there. Bye now then", Some(range));
    let result = run(&fixture, &mut model, &job, &mut events).unwrap();
    assert_eq!(result.stats.vad_ms, 0);
    let asr = read_result(&result);
    asr_result::validate(&asr, Some("en")).unwrap();
    assert_eq!(asr.outcome, Outcome::Transcribed);
    // Sentence-final punctuation starts a new segment. Words that fall outside the decoded audio are dropped.
    assert_eq!(
        asr.segments.iter().map(|segment| segment.text.as_str()).collect::<Vec<_>>(),
        ["Hello there.", "Bye now"]
    );
    assert_eq!((asr.segments[0].start, asr.segments[0].end), (1_000_000, 2_000_000));
    assert_eq!((asr.segments[1].start, asr.segments[1].end), (4_000_000, 4_800_000));
    assert!(
        asr.segments
            .iter()
            .flat_map(|segment| &segment.words)
            .all(|word| word.timing_quality == TimingQuality::Aligned)
    );
    assert_eq!(asr.language.source, LanguageSource::Asserted);
    assert!(asr.provenance.models.aligner.is_some());
    assert!(model.asr.requests.is_empty(), "align does not run the recognizer");
    let calls = &model.aligner.as_ref().unwrap().calls;
    assert_eq!(calls.len(), 1);
    assert_eq!(
        (calls[0].0, calls[0].1.as_str(), calls[0].2.as_deref()),
        (5 * 16_000, "Hello there. Bye now then", Some("en"))
    );
    assert_eq!(phases(&events), ["decoding", "aligning", "finalizing"]);
    assert_eq!(events.named("job.segment").len(), 2);

    // A pause longer than 0.8 s starts a new segment; no space is added between Chinese or Japanese characters.
    let staging = fixture.staging("align-zh");
    let words = vec![("你", 0.1, 0.2), ("好，", 0.2, 0.4), ("世", 1.5, 1.6), ("界", 1.6, 1.6)];
    let mut model = FakeModel::with_aligner(&[], FakeAligner::new(AlignerScript::Words(words)));
    let job = align_params(&wav, &staging, "zh", "你好，世界", None);
    let asr = read_result(&run(&fixture, &mut model, &job, &mut Events::default()).unwrap());
    asr_result::validate(&asr, Some("zh")).unwrap();
    assert_eq!(
        asr.segments.iter().map(|segment| segment.text.as_str()).collect::<Vec<_>>(),
        ["你好，", "世界"]
    );
}

#[test]
fn align_requests_are_checked_before_any_work() {
    let fixture = Fixture::with_aligner();
    let wav = fixture.wav("two.wav", TWO_PHRASES);
    let staging = fixture.staging("align-bad");
    let mut model = FakeModel::with_aligner(&[], FakeAligner::hello_world());
    let code = |job: JobRunParams, model: &mut FakeModel| run(&fixture, model, &job, &mut Events::default()).unwrap_err().code;

    let mut job = align_params(&wav, &staging, "en", "text", None);
    job.options = json!({ "language": { "mode": "prefer", "tag": "en" }, "text": "text", "timescale": 1_000_000 });
    assert_eq!(code(job, &mut model), "INVALID_PARAMS");
    assert_eq!(code(align_params(&wav, &staging, "en", "  ", None), &mut model), "INVALID_PARAMS");
    assert_eq!(
        code(align_params(&wav, &staging, "sw", "text", None), &mut model),
        "MODEL_UNSUPPORTED"
    );
    let mut job = align_params(&wav, &staging, "en", "text", None);
    job.options["diarize"] = json!(false);
    assert_eq!(code(job, &mut model), "INVALID_PARAMS");
    assert!(model.aligner.as_ref().unwrap().calls.is_empty());

    // The model pack has no aligner: MODEL_UNSUPPORTED, with reason aligner-not-loaded.
    let mut model = FakeModel::new(&[]);
    let job = align_params(&wav, &staging, "en", "text", None);
    let error = run(&fixture, &mut model, &job, &mut Events::default()).unwrap_err();
    assert_eq!(error.code, "MODEL_UNSUPPORTED");
    assert_eq!(error.details.unwrap()["reason"], "aligner-not-loaded");
}
