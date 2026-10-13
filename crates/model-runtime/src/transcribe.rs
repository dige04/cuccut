//! Orchestration of `job.run` (capability `transcribe`): decode → VAD → per-segment recognition (when the model includes an aligner, each segment is force-aligned) → when `diarize` is set and the model package includes speaker diarization, run Pyannote + WeSpeaker over the whole clip and project speakers onto words (same as v2: after recognition finishes) → assemble and self-check
//! `cuccut.asr-result/v1`. Models that segment on their own ([`RunMode::SelfSegmenting`]) have no VAD step: the whole clip is handed to them, and the lines they return are the segments.
//! `capability: 'align'` uses the same exit: decode → use the aligner to time a known text pair → split segments by pauses, sentence-final punctuation and segment length (protocol spec §2.5.1).
//!
//! Internally everything uses f64 seconds (relative to the decode start). Only when writing segments and results is the range start added and the values converted to integer ticks (architecture design §6.6).
//! Cancellation takes effect at segment boundaries: it is checked before each decode read, each 60-second VAD block, and each recognition segment.

use std::collections::HashSet;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Instant;

use serde_json::{Value, json};

use crate::asr_result::{
    self, AsrResult, LanguageResult, LanguageSource, ModelRef, ModelRefs, Outcome, Provenance, Segment, SegmentsHeader, SegmentsWriter,
    Speaker, TickSpan, TimingQuality, Warning, WarningCode, Word,
};
use crate::audio::{self, DecodeError, DecodeRange, DecodeRequest, PcmFile};
use crate::backend::{LoadedModel, RunMode, speech_timing_enabled};
use crate::bundle::{VerifiedBundle, VerifiedFiles};
use crate::protocol::{
    AlignOptions, Capability, ErrorBody, HINT_MAX_CHARS, JobOutcome, JobRunParams, JobRunResult, JobStats, LanguageRequest, MemorySnapshot,
    OUTPUT_CONTRACT, TranscribeOptions, codes, parse_params,
};
use crate::speech::moss_common::INCOMPLETE_WARNING_PREFIX;
use crate::speech::moss_speakers::{self, SpeakerMerge};
use crate::speech::pyannote_common::{DEFAULT_MERGE_THRESHOLD, PyannoteCallbacks, PyannoteCancelled, PyannoteOptions};
use crate::speech::refine::{self, ALIGNER_GRID_SECONDS, enforce_strict_word_times};
use crate::speech::segmenter::{self, SpeechSpan};
use crate::speech::speaker_projection::project_speaker_clusters;
use crate::speech::text_prep::is_han_ideograph;
use crate::speech::vad_stream::{self, SpanScan};
use crate::speech::{
    AlignedWord, RecognitionRequest, SegmentedTranscription, SegmentingCallbacks, SegmentingCancelled, SpeakerRange, SpeechRecognizer,
    StreamingVad, WordIn, autolang, language, word_timing,
};
use crate::ticks::{seconds_to_ticks, ticks_to_seconds};
use crate::{SAMPLE_RATE, WORKER_VERSION};

/// If the decoded audio is shorter than the requested range by more than this many seconds, report `range-clamped`.
const RANGE_CLAMP_TOLERANCE_SECONDS: f64 = 0.05;

/// `align` segmentation: a pause between words longer than this many seconds starts a new segment (same rule as the online provider when it returns only words).
const ALIGN_SEGMENT_GAP_SECONDS: f64 = 0.8;
/// `align` segmentation: once a segment has exceeded this length, a new segment starts.
const ALIGN_SEGMENT_MAX_SECONDS: f64 = 30.0;

/// The task's outward interface: events and in-memory snapshots.
pub trait JobSink {
    /// Pushes one event (`job.phase`, `job.progress`, `job.segment`, `job.warning`, `job.language`).
    fn event(&mut self, name: &str, params: Value);

    /// The latest in-memory snapshot reported by the backend (once after each segment).
    fn memory(&mut self, _snapshot: MemorySnapshot) {}
}

/// A validated transcription task, ready to run.
struct Job<'a> {
    params: &'a JobRunParams,
    options: TranscribeOptions,
    staging: &'a Path,
    /// The asserted language (canonical code); `None` means automatic detection.
    asserted_code: Option<String>,
    /// Decode start (media time, seconds) and requested length.
    offset: f64,
    requested_length: Option<f64>,
    /// Known text for `capability: 'align'`; `None` for `transcribe`.
    align_text: Option<String>,
}

/// Runs one `job.run`. The returned error is the error response for that request.
pub fn run(
    model: &mut dyn LoadedModel,
    bundle: &VerifiedBundle,
    params: &JobRunParams,
    cancel: &AtomicBool,
    sink: &mut dyn JobSink,
) -> Result<JobRunResult, ErrorBody> {
    let family = bundle.asr.as_ref().map_or("", |asr| asr.family.as_str());
    let aligner_loaded = model.has_aligner();
    let job = match prepare(params, family, aligner_loaded) {
        Ok(job) => job,
        Err(error) => {
            model.finish_job();
            return Err(error);
        }
    };
    let mut runner = Runner {
        job,
        bundle,
        cancel,
        sink,
        stats: JobStats::default(),
        warnings: Vec::new(),
        speakers: Vec::new(),
        aligner_loaded,
        speaker_used: false,
        segmentation_used: false,
    };
    let result = runner.run(model);
    model.finish_job();
    result
}

/// The VAD and recognizer for the pipeline model; `None` for models that segment on their own.
fn pipeline(model: &mut dyn LoadedModel) -> Option<(&mut dyn StreamingVad, &mut dyn SpeechRecognizer)> {
    match model.run_mode() {
        RunMode::Pipeline { vad, recognizer } => Some((vad, recognizer)),
        RunMode::SelfSegmenting(_) => None,
    }
}

/// `family` is the model family of the `asr` component: the asserted language is checked against its language table. `align` requires the aligner to be loaded (`aligner_loaded`);
/// its options are replaced by a [`TranscribeOptions`] with the asserted language, no speaker separation and no hints, and the known text is stored separately.
fn prepare<'a>(params: &'a JobRunParams, family: &str, aligner_loaded: bool) -> Result<Job<'a>, ErrorBody> {
    if params.output_contract != OUTPUT_CONTRACT {
        return Err(ErrorBody::invalid_params(format!("outputContract must be {OUTPUT_CONTRACT}")));
    }
    let (options, align_text) = match params.capability {
        Capability::Align => {
            if !aligner_loaded {
                return Err(
                    ErrorBody::new(codes::MODEL_UNSUPPORTED, "the loaded model bundle has no forced aligner")
                        .with_details(json!({ "capability": "align", "reason": "aligner-not-loaded" })),
                );
            }
            let options: AlignOptions = parse_params(params.options.clone())?;
            if !matches!(options.language, LanguageRequest::Assert { .. }) {
                return Err(ErrorBody::invalid_params("options.language must be an assertion for align"));
            }
            if options.text.trim().is_empty() {
                return Err(ErrorBody::invalid_params("options.text must not be empty"));
            }
            let transcribe = TranscribeOptions {
                language: options.language,
                diarize: false,
                hint: None,
                timescale: options.timescale,
            };
            (transcribe, Some(options.text))
        }
        _ => (parse_params::<TranscribeOptions>(params.options.clone())?, None),
    };
    if options.timescale == 0 {
        return Err(ErrorBody::invalid_params("options.timescale must be positive"));
    }
    if options.hint.as_ref().is_some_and(|hint| hint.chars().count() > HINT_MAX_CHARS) {
        return Err(ErrorBody::invalid_params(format!(
            "options.hint is longer than {HINT_MAX_CHARS} characters"
        )));
    }
    let asserted_code = match &options.language {
        LanguageRequest::Assert { tag } => {
            if !asr_result::is_bcp47(tag) {
                return Err(ErrorBody::invalid_params("options.language.tag is not a BCP 47 tag"));
            }
            if !language::supports(family, tag) {
                return Err(
                    ErrorBody::new(codes::MODEL_UNSUPPORTED, "the loaded model does not support the asserted language")
                        .with_details(json!({ "language": tag, "reason": "unsupported-language" })),
                );
            }
            language::canonical_code(tag)
        }
        LanguageRequest::Prefer { tag: Some(tag) } if !asr_result::is_bcp47(tag) => {
            return Err(ErrorBody::invalid_params("options.language.tag is not a BCP 47 tag"));
        }
        LanguageRequest::Prefer { .. } => None,
    };
    let staging = Path::new(&params.staging);
    if !staging.is_absolute() || !staging.is_dir() {
        return Err(ErrorBody::invalid_params("staging must be an existing absolute directory"));
    }
    if !Path::new(&params.input.file).is_absolute() {
        return Err(ErrorBody::invalid_params("input.file must be an absolute path"));
    }
    let (offset, requested_length) = match params.input.range {
        None => (0.0, None),
        Some(range) => {
            if range.timescale == 0 || range.end <= range.start {
                return Err(ErrorBody::invalid_params(
                    "input.range must have a positive timescale and end > start",
                ));
            }
            let start = ticks_to_seconds(range.start, range.timescale);
            (start, Some(ticks_to_seconds(range.end, range.timescale) - start))
        }
    };
    Ok(Job {
        params,
        options,
        staging,
        asserted_code,
        offset,
        requested_length,
        align_text,
    })
}

struct Runner<'a> {
    job: Job<'a>,
    bundle: &'a VerifiedBundle,
    cancel: &'a AtomicBool,
    sink: &'a mut dyn JobSink,
    stats: JobStats,
    warnings: Vec<Warning>,
    /// The result's `speakers[]`: filled by models that segment on their own and attach speaker labels (MOSS) when `diarize` is set, or by speaker diarization (§6.6).
    speakers: Vec<Speaker>,
    /// The model includes an aligner: the result's `provenance.models.aligner` is filled from this. For self-segmenting models, it is true only when this task actually used the aligner.
    aligner_loaded: bool,
    /// This task merged speakers using a speaker model: the result's `provenance.models.speaker` is filled from this.
    speaker_used: bool,
    /// This task ran Pyannote segmentation: the result's `provenance.models.segmentation` is filled from this.
    segmentation_used: bool,
}

/// The outcome of speaker diarization.
enum Diarization {
    /// Words and segments were given a speaker, or no interval was obtained (a warning was reported).
    Done,
    Cancelled,
}

/// The forced-alignment result for one recognized segment.
enum Alignment {
    /// The model package has no aligner: estimate by character length, no warning is reported.
    Unavailable,
    /// Word times (seconds relative to the decode start), already expanded to be strictly increasing and within the output segment.
    Aligned(Vec<WordIn>),
    /// Alignment failed or returned no words: estimate by character length and report `alignment-failed`.
    Failed(&'static str),
}

/// The language determination state.
struct LanguageState {
    /// The task's language (canonical code): the asserted language, or, when detecting automatically, the language set by the first segment that yields recognized text. Only the asserted language is passed to the model.
    locked: Option<String>,
    detected: bool,
    accumulated: String,
}

impl Runner<'_> {
    fn cancelled(&self) -> bool {
        self.cancel.load(Ordering::SeqCst)
    }

    fn job_id(&self) -> &str {
        &self.job.params.job_id
    }

    fn phase(&mut self, phase: &str) {
        let params = json!({ "jobId": self.job_id(), "phase": phase });
        self.sink.event("job.phase", params);
    }

    fn progress(&mut self, phase: &str, done: f64, total: Option<f64>, unit: &str) {
        let params = json!({ "jobId": self.job_id(), "phase": phase, "done": done, "total": total, "unit": unit });
        self.sink.event("job.progress", params);
    }

    fn warn(&mut self, warning: Warning) {
        let params = json!({ "jobId": self.job_id(), "warning": warning });
        self.sink.event("job.warning", params);
        self.warnings.push(warning);
    }

    fn ticks(&self, seconds_from_decode_start: f64) -> u64 {
        seconds_to_ticks(self.job.offset + seconds_from_decode_start, self.job.options.timescale)
    }

    fn run(&mut self, model: &mut dyn LoadedModel) -> Result<JobRunResult, ErrorBody> {
        let header = SegmentsHeader {
            job_id: &self.job.params.job_id,
            content_hash: &self.job.params.input.content_hash,
            bundle_id: &self.bundle.bundle_id,
            worker_version: WORKER_VERSION,
            timescale: self.job.options.timescale,
        };
        let mut segments_file = SegmentsWriter::create(self.job.staging, &header).map_err(|error| {
            eprintln!("[model-worker] cannot create segments.jsonl: {error}");
            ErrorBody::invalid_params("the staging directory is not writable")
        })?;
        let segments_path = segments_file.path().to_string_lossy().into_owned();

        let self_segmenting = matches!(model.run_mode(), RunMode::SelfSegmenting(_));
        if self.job.options.diarize && !self_segmenting && !model.has_diarizer() {
            self.warn(
                Warning::new(WarningCode::DiarizationUnavailable)
                    .detail("the model bundle has no speaker diarization components (the speaker diarization pack is not installed)"),
            );
        }

        // ---- Decoding ----
        self.phase("decoding");
        let started = Instant::now();
        let audio_path = self.job.staging.join(audio::AUDIO_FILE);
        let request = DecodeRequest {
            file: Path::new(&self.job.params.input.file),
            track: self.job.params.input.track,
            range: DecodeRange {
                start: self.job.offset,
                duration: self.job.requested_length,
            },
        };
        let cancel = self.cancel;
        let requested_length = self.job.requested_length;
        let job_id = self.job.params.job_id.clone();
        let sink = &mut *self.sink;
        let decoded = audio::decode_to_file(&request, &audio_path, &|| cancel.load(Ordering::SeqCst), &mut |seconds| {
            sink.event(
                "job.progress",
                json!({ "jobId": job_id, "phase": "decoding", "done": seconds, "total": requested_length, "unit": "seconds" }),
            );
        });
        self.stats.decode_ms = started.elapsed().as_millis() as u64;
        match decoded {
            Ok(_) => {}
            Err(DecodeError::NoAudioTrack) => return self.finish(Outcome::NoAudioTrack, Vec::new(), None, 0.0, &segments_path, false),
            Err(DecodeError::Cancelled) => return Ok(self.cancelled_result(&segments_path)),
            Err(DecodeError::InputUnreadable(detail)) => {
                eprintln!("[model-worker] input unreadable: {detail}");
                return Err(ErrorBody::new(codes::INPUT_UNREADABLE, "the input file cannot be read or demuxed"));
            }
            Err(DecodeError::DecodeFailed(detail)) => {
                eprintln!("[model-worker] decode failed: {detail}");
                return Err(ErrorBody::new(codes::DECODE_FAILED, "audio decoding failed"));
            }
        }
        let pcm = PcmFile::open(&audio_path).map_err(|error| {
            eprintln!("[model-worker] cannot map decoded audio: {error}");
            ErrorBody::new(codes::DECODE_FAILED, "the decoded audio cannot be read back")
        })?;
        let samples = pcm.samples();
        let decoded_seconds = samples.len() as f64 / f64::from(SAMPLE_RATE);
        if let Some(requested) = self.job.requested_length
            && requested - decoded_seconds > RANGE_CLAMP_TOLERANCE_SECONDS
        {
            self.warn(Warning::new(WarningCode::RangeClamped).detail(format!(
                "the range extends past the end of the audio; processed {decoded_seconds:.3} s of {requested:.3} s"
            )));
        }

        if let Some(text) = self.job.align_text.clone() {
            return self.run_align(model, &text, samples, decoded_seconds, &mut segments_file, &segments_path);
        }
        if self_segmenting {
            return self.run_self_segmenting(model, samples, decoded_seconds, &mut segments_file, &segments_path);
        }

        // ---- VAD ----
        self.phase("vad");
        let started = Instant::now();
        let scan = {
            let Some((vad, _)) = pipeline(model) else {
                return Err(not_a_pipeline());
            };
            let job_id = self.job.params.job_id.clone();
            let sink = &mut *self.sink;
            vad_stream::speech_spans(samples, SAMPLE_RATE, vad, &|| cancel.load(Ordering::SeqCst), &mut |fraction| {
                sink.event(
                    "job.progress",
                    json!({
                        "jobId": job_id, "phase": "vad", "done": fraction * decoded_seconds,
                        "total": decoded_seconds, "unit": "seconds"
                    }),
                );
            })
        };
        self.stats.vad_ms = started.elapsed().as_millis() as u64;
        let spans = match scan {
            Ok(SpanScan::Spans(spans)) => spans,
            Ok(SpanScan::Cancelled) => return Ok(self.cancelled_result(&segments_path)),
            Err(error) => {
                eprintln!("[model-worker] VAD failed: {error:#}");
                return Err(ErrorBody::new(codes::INFERENCE_FAILED, "voice activity detection failed"));
            }
        };
        self.stats.speech_seconds = spans.iter().map(|span| span.duration()).sum();

        // Recognition uses the interval padded at the edges; written segments are split at the midpoint of any overlap, so segments never overlap.
        let asr_spans = segmenter::padded(&spans, decoded_seconds);
        let mut output_spans = asr_spans.clone();
        segmenter::resolve_overlaps(&mut output_spans);

        // ---- Per-segment recognition ----
        self.phase("transcribing");
        let started = Instant::now();
        let mut language = LanguageState {
            locked: self.job.asserted_code.clone(),
            detected: false,
            accumulated: String::new(),
        };
        let hint = self.job.options.hint.clone();
        let mut segments = Vec::new();
        let total = asr_spans.len();
        for (index, (asr_span, output_span)) in asr_spans.iter().zip(&output_spans).enumerate() {
            if self.cancelled() {
                self.stats.asr_ms = (started.elapsed().as_millis() as u64).saturating_sub(self.stats.align_ms);
                return Ok(self.cancelled_result(&segments_path));
            }
            let lower = ((asr_span.start * f64::from(SAMPLE_RATE)) as usize).min(samples.len());
            let upper = ((asr_span.end * f64::from(SAMPLE_RATE)) as usize).min(samples.len());
            if upper > lower {
                // Only the asserted language is passed to the model. With automatic detection, the model decides for each segment, so a language fixed earlier is not forced on later segments
                // (Whisper, when given a language, translates other languages into it, so mixed Chinese-English material would come out as a single language).
                let request = RecognitionRequest {
                    language: self.job.asserted_code.as_deref(),
                    context: hint.as_deref(),
                };
                let recognition = {
                    let Some((_, recognizer)) = pipeline(model) else {
                        return Err(not_a_pipeline());
                    };
                    recognizer.recognize(&samples[lower..upper], &request)
                }
                .map_err(|error| {
                    eprintln!("[model-worker] recognition failed: {error:#}");
                    ErrorBody::new(codes::INFERENCE_FAILED, "speech recognition failed")
                })?;
                self.observe_language(&mut language, recognition.language_name.as_deref(), &recognition.text);
                let segment_language = self.segment_language(&language, recognition.language_name.as_deref());
                let text = recognition.text.trim();
                let alignment = match text.is_empty() {
                    true => Alignment::Unavailable,
                    false => self.align_span(
                        model,
                        &samples[lower..upper],
                        text,
                        *asr_span,
                        *output_span,
                        segment_language.as_deref(),
                    ),
                };
                let (aligned, alignment_failure) = match alignment {
                    Alignment::Unavailable => (None, None),
                    Alignment::Aligned(words) => (Some(words), None),
                    Alignment::Failed(detail) => (None, Some(detail)),
                };
                if !text.is_empty()
                    && let Some(segment) = self.build_segment(segments.len() + 1, text, *output_span, segment_language.as_deref(), aligned)
                {
                    if let Some(detail) = alignment_failure {
                        self.warn(Warning::new(WarningCode::AlignmentFailed).segment(&segment.id).detail(detail));
                    }
                    if recognition.degenerate {
                        self.warn(
                            Warning::new(WarningCode::SegmentDegenerate)
                                .segment(&segment.id)
                                .detail("the output still looks repetitive after a repetition-penalty retry"),
                        );
                    }
                    segments_file.append(&segment).map_err(|error| {
                        eprintln!("[model-worker] cannot append to segments.jsonl: {error}");
                        ErrorBody::new(codes::INFERENCE_FAILED, "writing segments.jsonl failed")
                    })?;
                    let params = json!({ "jobId": self.job_id(), "segment": segment });
                    self.sink.event("job.segment", params);
                    segments.push(segment);
                }
            }
            self.progress("transcribing", (index + 1) as f64, Some(total as f64), "segments");
            if let Some(snapshot) = model.memory() {
                self.sink.memory(snapshot);
            }
        }
        self.stats.asr_ms = (started.elapsed().as_millis() as u64).saturating_sub(self.stats.align_ms);

        // ---- Speaker diarization (after recognition; the recognition model is not unloaded; same as v2) ----
        if self.job.options.diarize
            && model.has_diarizer()
            && !segments.is_empty()
            && let Diarization::Cancelled = self.diarize_segments(model, samples, &mut segments)
        {
            return Ok(self.cancelled_result(&segments_path));
        }

        let language_result = self.language_result(&language);
        let outcome = if segments.is_empty() {
            Outcome::NoSpeech
        } else {
            Outcome::Transcribed
        };
        self.finish(outcome, segments, Some(language_result), decoded_seconds, &segments_path, true)
    }

    /// Speaker diarization (architecture design §6.6): the whole clip is passed to Pyannote segmentation + WeSpeaker voice-embedding clustering to get global speaker intervals, which are then projected onto words by word time
    /// ([`project_speaker_clusters`], same as v2). A segment's speaker is the one who speaks the most within that segment. Speaker ids are numbered in the order they first appear in time (`spk-1`, `spk-2`…); speakers who got no words are placed last, ordered by their earliest interval.
    ///
    /// `job.segment` events already emitted and `segments.jsonl` carry no speakers: speakers appear only in `result.json` (protocol spec §2.5.1).
    /// If the model fails to load or inference errors, `diarization-unavailable` is reported and the transcript is kept without speakers (a completed recognition is not voided by a diarization failure).
    fn diarize_segments(&mut self, model: &mut dyn LoadedModel, samples: &[f32], segments: &mut [Segment]) -> Diarization {
        if self.cancelled() {
            return Diarization::Cancelled;
        }
        self.phase("diarizing");
        let started = Instant::now();
        let ranges = {
            let cancel = self.cancel;
            let job_id = self.job.params.job_id.clone();
            let sink = &mut *self.sink;
            match model.diarizer() {
                None => Err(None),
                Some(diarizer) => {
                    let mut on_progress = |done: f64, total: f64| {
                        sink.event(
                            "job.progress",
                            json!({ "jobId": job_id, "phase": "diarizing", "done": done, "total": total, "unit": "steps" }),
                        );
                    };
                    let mut should_cancel = || cancel.load(Ordering::SeqCst);
                    let options = PyannoteOptions {
                        max_speakers: None,
                        clustering_threshold: DEFAULT_MERGE_THRESHOLD.clamp(0.01, 1.99),
                    };
                    let mut callbacks = PyannoteCallbacks {
                        on_progress: Some(&mut on_progress),
                        should_cancel: Some(&mut should_cancel),
                    };
                    diarizer.diarize(samples, &options, &mut callbacks).map_err(Some)
                }
            }
        };
        self.stats.asr_ms += started.elapsed().as_millis() as u64;
        if let Some(snapshot) = model.memory() {
            self.sink.memory(snapshot);
        }
        let ranges: Vec<SpeakerRange> = match ranges {
            Ok(segments) => segments
                .into_iter()
                .map(|segment| SpeakerRange {
                    start: segment.start,
                    end: segment.end,
                    cluster: segment.speaker,
                    chunk: 0,
                })
                .collect(),
            Err(Some(error)) if error.downcast_ref::<PyannoteCancelled>().is_some() => return Diarization::Cancelled,
            Err(error) => {
                let detail = match error {
                    Some(error) => {
                        eprintln!("[model-worker] speaker diarization failed: {error:#}");
                        "speaker diarization failed; the transcript has no speakers"
                    }
                    None => "the speaker diarization models could not be loaded; the transcript has no speakers",
                };
                self.warn(Warning::new(WarningCode::DiarizationUnavailable).detail(detail));
                return Diarization::Done;
            }
        };
        if self.cancelled() {
            return Diarization::Cancelled;
        }
        self.segmentation_used = true;
        self.speaker_used = self.bundle.speaker.is_some();
        if speech_timing_enabled() {
            let clusters = ranges.iter().map(|range| range.cluster).collect::<HashSet<_>>().len();
            eprintln!(
                "[ccut-timing] pyannote ranges={} clusters={clusters} ms={}",
                ranges.len(),
                started.elapsed().as_millis()
            );
        }
        self.speakers = assign_speakers(segments, &ranges, self.job.offset, self.job.options.timescale);
        Diarization::Done
    }

    /// Models that segment on their own (MOSS): the whole clip is handed to it in one pass, and lines → segments (split at the midpoint of any overlap). Speakers are included only when `diarize` is set, and the model package's speaker model merges each chunk's local speakers into global ones (same as v2). When the model package includes an aligner, lines without word times and longer than 5 seconds are force-aligned within the line window (words marked `aligned`); the rest are estimated by character count. There is no VAD step; the language is passed only when asserted. The model has no hint channel, so if a `hint` is given, `hint-ignored` is reported.
    fn run_self_segmenting(
        &mut self,
        model: &mut dyn LoadedModel,
        samples: &[f32],
        decoded_seconds: f64,
        segments_file: &mut SegmentsWriter,
        segments_path: &str,
    ) -> Result<JobRunResult, ErrorBody> {
        if self.job.options.hint.as_deref().is_some_and(|hint| !hint.trim().is_empty()) {
            self.warn(Warning::new(WarningCode::HintIgnored).detail("this model has no recognition hint channel; the hint was not used"));
        }
        self.phase("transcribing");
        let started = Instant::now();
        let asserted = self.job.asserted_code.clone();
        let transcription = {
            let RunMode::SelfSegmenting(recognizer) = model.run_mode() else {
                return Err(not_a_pipeline());
            };
            let cancel = self.cancel;
            let job_id = self.job.params.job_id.clone();
            let sink = &mut *self.sink;
            let mut on_progress = |covered: f64, total: f64| {
                sink.event(
                    "job.progress",
                    json!({ "jobId": job_id, "phase": "transcribing", "done": covered, "total": total, "unit": "seconds" }),
                );
            };
            let mut should_cancel = || cancel.load(Ordering::SeqCst);
            let mut callbacks = SegmentingCallbacks {
                on_progress: Some(&mut on_progress),
                on_segment: None,
                should_cancel: Some(&mut should_cancel),
            };
            recognizer.transcribe(samples, asserted.as_deref(), &mut callbacks)
        };
        self.stats.asr_ms = started.elapsed().as_millis() as u64;
        let SegmentedTranscription {
            mut rows,
            mut speaker_ranges,
            warnings,
            ..
        } = match transcription {
            Ok(transcription) => transcription,
            Err(error) if error.downcast_ref::<SegmentingCancelled>().is_some() => return Ok(self.cancelled_result(segments_path)),
            Err(error) => {
                eprintln!("[model-worker] recognition failed: {error:#}");
                return Err(ErrorBody::new(codes::INFERENCE_FAILED, "speech recognition failed"));
            }
        };
        if self.cancelled() {
            return Ok(self.cancelled_result(segments_path));
        }
        for warning in &warnings {
            match warning.strip_prefix(INCOMPLETE_WARNING_PREFIX) {
                Some(detail) => self.warn(Warning::new(WarningCode::SegmentIncomplete).detail(detail)),
                None => eprintln!("[model-worker] {warning}"),
            }
        }
        if let Some(snapshot) = model.memory() {
            self.sink.memory(snapshot);
        }
        // If no language is asserted, guess once from the full text (same as v2): this is the transcript's language and also the aligner's language.
        let guessed = match asserted {
            Some(_) => None,
            None => autolang::guess_final(&rows.iter().map(|row| row.text.as_str()).collect::<Vec<_>>().join(" ")),
        };
        if let Some(code) = &guessed {
            let params = json!({ "jobId": self.job_id(), "tag": code, "confidence": Value::Null });
            self.sink.event("job.language", params);
        }

        // ---- Merging speakers across chunks ----
        let diarize = self.job.options.diarize;
        if diarize && !speaker_ranges.is_empty() {
            self.phase("diarizing");
            let started = Instant::now();
            let merge = moss_speakers::merge_moss_speakers(
                &mut rows,
                &mut speaker_ranges,
                samples,
                model.speaker_embedder(),
                moss_speakers::speaker_merge_threshold(),
                None,
            );
            self.stats.asr_ms += started.elapsed().as_millis() as u64;
            let chunks = speaker_ranges.iter().map(|range| range.chunk).collect::<HashSet<_>>().len();
            match merge {
                SpeakerMerge::Merged { units, embedded, speakers } => {
                    self.speaker_used = true;
                    if speech_timing_enabled() {
                        eprintln!("[ccut-timing] moss-speakers units={units} embedded={embedded} merged_clusters={speakers}");
                    }
                }
                // With only one chunk, the labels are already global, so no merging is needed.
                SpeakerMerge::EmbedderUnavailable | SpeakerMerge::Mismatched if chunks > 1 => {
                    self.warn(Warning::new(WarningCode::DiarizationUnavailable).detail(format!(
                        "speakers were not merged across the {chunks} chunks the model transcribed separately; \
                         the same label in different chunks may be different people"
                    )));
                }
                _ => {}
            }
            if self.cancelled() {
                return Ok(self.cancelled_result(segments_path));
            }
        }

        // ---- Refining word times for long lines ----
        let mut alignment_failures = HashSet::new();
        self.aligner_loaded = false;
        let targets = refine::indices_needing_words(&rows);
        if !targets.is_empty() && model.has_aligner() {
            self.phase("aligning");
            let started = Instant::now();
            // An unasserted language is not used as the aligner's language (if the material is not in that language, the aligner would split words using the wrong language): use the one guessed from the full text.
            let language = asserted.clone().or_else(|| guessed.clone()).unwrap_or_else(|| "en".to_owned());
            match model.aligner() {
                Some(aligner) => {
                    self.aligner_loaded = true;
                    // refine_word_timings skips lines whose sample window is empty and does not call the aligner for them: the line for the nth call is computed with the same condition.
                    let called: Vec<usize> = targets
                        .iter()
                        .copied()
                        .filter(|&index| {
                            let row = &rows[index];
                            let lower = ((row.start * f64::from(SAMPLE_RATE)) as usize).min(samples.len());
                            let upper = ((row.end * f64::from(SAMPLE_RATE)) as usize).min(samples.len());
                            upper > lower
                        })
                        .collect();
                    let mut attempt = 0;
                    let cancel = self.cancel;
                    let job_id = self.job.params.job_id.clone();
                    let sink = &mut *self.sink;
                    let total = targets.len();
                    let refined = refine::refine_word_timings(
                        &rows,
                        samples,
                        f64::from(SAMPLE_RATE),
                        &language,
                        |audio, text, language| {
                            let row = called.get(attempt).copied();
                            attempt += 1;
                            if cancel.load(Ordering::SeqCst) {
                                return Ok(Vec::new());
                            }
                            match aligner.align_long(audio, text, Some(language)) {
                                Ok(words) if !words.is_empty() => Ok(words),
                                Ok(_) => {
                                    alignment_failures.extend(row);
                                    Ok(Vec::new())
                                }
                                Err(error) => {
                                    eprintln!("[model-worker] forced alignment failed: {error:#}");
                                    alignment_failures.extend(row);
                                    Ok(Vec::new())
                                }
                            }
                        },
                        |fraction| {
                            sink.event(
                                "job.progress",
                                json!({
                                    "jobId": job_id, "phase": "aligning", "done": (fraction * total as f64).round(),
                                    "total": total, "unit": "segments"
                                }),
                            );
                        },
                    );
                    // The closure does not return errors; if one does occur, keep the line-level times (refinement must never void a completed transcript).
                    if let Ok(refined) = refined {
                        rows = refined;
                    }
                }
                None => {
                    self.warn(
                        Warning::new(WarningCode::AlignmentFailed)
                            .detail("the forced aligner could not be loaded; word timings are estimated"),
                    );
                }
            }
            self.stats.align_ms = started.elapsed().as_millis() as u64;
            if self.cancelled() {
                return Ok(self.cancelled_result(segments_path));
            }
            if let Some(snapshot) = model.memory() {
                self.sink.memory(snapshot);
            }
        }

        let mut rows: Vec<_> = rows
            .into_iter()
            .enumerate()
            .filter(|(_, row)| !row.text.trim().is_empty())
            .map(|(index, row)| {
                let span = SpeechSpan {
                    start: row.start.clamp(0.0, decoded_seconds),
                    end: row.end.clamp(0.0, decoded_seconds),
                };
                (span, index, row)
            })
            .filter(|(span, _, _)| span.end > span.start)
            .collect();
        rows.sort_by(|a, b| a.0.start.total_cmp(&b.0.start));
        let mut spans: Vec<_> = rows.iter().map(|(span, _, _)| *span).collect();
        segmenter::resolve_overlaps(&mut spans);
        self.stats.speech_seconds = spans.iter().map(|span| span.duration()).sum();

        let mut labels: Vec<String> = Vec::new();
        let mut segments = Vec::new();
        for (span, (_, index, row)) in spans.into_iter().zip(rows) {
            // Aligned words are clamped into the written interval (de-overlapping may have narrowed the line).
            let aligned = row.words.filter(|words| !words.is_empty()).map(|mut words| {
                enforce_strict_word_times(&mut words, span.start, span.end);
                words
            });
            let Some(mut segment) = self.build_segment(segments.len() + 1, row.text.trim(), span, asserted.as_deref(), aligned) else {
                continue;
            };
            if alignment_failures.contains(&index) {
                self.warn(
                    Warning::new(WarningCode::AlignmentFailed)
                        .segment(&segment.id)
                        .detail("forced alignment failed; word timings are estimated"),
                );
            }
            if diarize && let Some(label) = row.speaker.as_deref() {
                let speaker = labels.iter().position(|known| known == label).unwrap_or_else(|| {
                    labels.push(label.to_owned());
                    labels.len() - 1
                });
                let id = format!("spk-{}", speaker + 1);
                if speaker == self.speakers.len() {
                    self.speakers.push(Speaker {
                        id: id.clone(),
                        label: None,
                    });
                }
                segment.speaker_id = Some(id);
            }
            segments_file.append(&segment).map_err(|error| {
                eprintln!("[model-worker] cannot append to segments.jsonl: {error}");
                ErrorBody::new(codes::INFERENCE_FAILED, "writing segments.jsonl failed")
            })?;
            let params = json!({ "jobId": self.job_id(), "segment": segment });
            self.sink.event("job.segment", params);
            segments.push(segment);
        }

        let language = LanguageState {
            detected: guessed.is_some(),
            locked: asserted.or(guessed),
            accumulated: String::new(),
        };
        let language_result = self.language_result(&language);
        let outcome = if segments.is_empty() {
            Outcome::NoSpeech
        } else {
            Outcome::Transcribed
        };
        self.finish(outcome, segments, Some(language_result), decoded_seconds, segments_path, true)
    }

    /// Automatic detection: prefer the language name the model reports itself, otherwise infer from the accumulated text. Once recognized, it is set as the task's language and `job.language` is pushed once
    /// (later segments still have the model decide the language themselves). Segments with empty text do not count: the model still reports a language on segments where it heard no speech (often English),
    /// and that must not be used to set it.
    fn observe_language(&mut self, state: &mut LanguageState, model_name: Option<&str>, text: &str) {
        if state.locked.is_some() || text.trim().is_empty() {
            return;
        }
        state.accumulated.push_str(text);
        state.accumulated.push(' ');
        let Some(code) = autolang::code_from_name(model_name).or_else(|| autolang::detect(&state.accumulated)) else {
            return;
        };
        state.locked = Some(code.clone());
        state.detected = true;
        let params = json!({ "jobId": self.job_id(), "tag": code, "confidence": Value::Null });
        self.sink.event("job.language", params);
    }

    /// A segment's language (for the aligner and word-time estimation): the asserted language; with automatic detection, the language the model reports for this segment, falling back to the task's language when none is reported.
    fn segment_language(&self, state: &LanguageState, model_name: Option<&str>) -> Option<String> {
        self.job
            .asserted_code
            .clone()
            .or_else(|| autolang::code_from_name(model_name))
            .or_else(|| state.locked.clone())
    }

    fn language_result(&self, state: &LanguageState) -> LanguageResult {
        match &self.job.options.language {
            LanguageRequest::Assert { tag } => LanguageResult {
                tag: Some(tag.clone()),
                source: LanguageSource::Asserted,
                confidence: None,
            },
            LanguageRequest::Prefer { tag } => match (&state.locked, state.detected) {
                (Some(code), true) => LanguageResult {
                    tag: Some(code.clone()),
                    source: LanguageSource::Detected,
                    confidence: None,
                },
                _ => LanguageResult {
                    tag: tag.clone(),
                    source: LanguageSource::Unknown,
                    confidence: None,
                },
            },
        }
    }

    /// `capability: 'align'`: the whole known text is handed to the aligner (long audio is chunked by the aligner itself), and the aligned words are split into segments by pauses, sentence-final punctuation and segment length
    /// (same rules as the online provider when it returns only words). An alignment error is `INFERENCE_FAILED`; there is no estimate to fall back on here.
    fn run_align(
        &mut self,
        model: &mut dyn LoadedModel,
        text: &str,
        samples: &[f32],
        decoded_seconds: f64,
        segments_file: &mut SegmentsWriter,
        segments_path: &str,
    ) -> Result<JobRunResult, ErrorBody> {
        if self.cancelled() {
            return Ok(self.cancelled_result(segments_path));
        }
        self.phase("aligning");
        let code = self.job.asserted_code.clone();
        let started = Instant::now();
        let aligned = {
            let Some(aligner) = model.aligner() else {
                eprintln!("[model-worker] the loaded model dropped its aligner during a job");
                return Err(ErrorBody::new(codes::INFERENCE_FAILED, "forced alignment failed"));
            };
            aligner.align_long(samples, text, code.as_deref())
        };
        self.stats.align_ms = started.elapsed().as_millis() as u64;
        let aligned = aligned.map_err(|error| {
            eprintln!("[model-worker] forced alignment failed: {error:#}");
            ErrorBody::new(codes::INFERENCE_FAILED, "forced alignment failed")
        })?;
        if self.cancelled() {
            return Ok(self.cancelled_result(segments_path));
        }
        if let Some(snapshot) = model.memory() {
            self.sink.memory(snapshot);
        }

        let words: Vec<WordIn> = decode_relative_words(aligned, 0.0)
            .into_iter()
            .filter(|word| word.start < decoded_seconds)
            .map(|word| WordIn {
                end: word.end.min(decoded_seconds),
                ..word
            })
            .collect();
        let groups = group_aligned_words(words);
        let mut spans: Vec<SpeechSpan> = groups
            .iter()
            .map(|group| {
                let start = group[0].start;
                let end = group.iter().map(|word| word.end).fold(start, f64::max);
                let end = if end > start {
                    end
                } else {
                    (start + ALIGNER_GRID_SECONDS).min(decoded_seconds)
                };
                SpeechSpan { start, end }
            })
            .collect();
        segmenter::resolve_overlaps(&mut spans);
        self.stats.speech_seconds = spans.iter().map(|span| span.duration()).sum();

        let mut segments = Vec::new();
        for (span, mut words) in spans.into_iter().zip(groups) {
            enforce_strict_word_times(&mut words, span.start, span.end);
            let text = join_words(&words);
            let Some(segment) = self.build_segment(segments.len() + 1, &text, span, code.as_deref(), Some(words)) else {
                continue;
            };
            segments_file.append(&segment).map_err(|error| {
                eprintln!("[model-worker] cannot append to segments.jsonl: {error}");
                ErrorBody::new(codes::INFERENCE_FAILED, "writing segments.jsonl failed")
            })?;
            let params = json!({ "jobId": self.job_id(), "segment": segment });
            self.sink.event("job.segment", params);
            segments.push(segment);
        }
        let outcome = if segments.is_empty() {
            Outcome::NoSpeech
        } else {
            Outcome::Transcribed
        };
        self.finish(outcome, segments, None, decoded_seconds, segments_path, true)
    }

    /// Pipeline step 5: when the model includes an aligner, align word times for one recognized segment's text. `audio` is the samples of the padded recognition interval
    /// (`asr_span`); the words are expanded to be strictly increasing and clamped into the written interval (`output_span`). If an error occurs or no words are returned, fall back to estimation (architecture design §6.6).
    fn align_span(
        &mut self,
        model: &mut dyn LoadedModel,
        audio: &[f32],
        text: &str,
        asr_span: SpeechSpan,
        output_span: SpeechSpan,
        language: Option<&str>,
    ) -> Alignment {
        let Some(aligner) = model.aligner() else {
            return Alignment::Unavailable;
        };
        let started = Instant::now();
        let aligned = aligner.align(audio, text, language.or(Some("en")));
        self.stats.align_ms += started.elapsed().as_millis() as u64;
        let aligned = match aligned {
            Ok(aligned) => aligned,
            Err(error) => {
                eprintln!("[model-worker] forced alignment failed: {error:#}");
                return Alignment::Failed("forced alignment failed; word timings are estimated");
            }
        };
        let mut words = decode_relative_words(aligned, asr_span.start);
        if words.is_empty() {
            return Alignment::Failed("the forced aligner returned no words; word timings are estimated");
        }
        enforce_strict_word_times(&mut words, output_span.start, output_span.end);
        Alignment::Aligned(words)
    }

    /// Text → segment: tick conversion, word times, monotonicity fix. `aligned` holds the aligned words (seconds relative to the decode start, marked `aligned`);
    /// when absent, times are estimated by character count (marked `estimated`). Segments whose start and end collapse to a single point are dropped.
    fn build_segment(
        &mut self,
        number: usize,
        text: &str,
        span: SpeechSpan,
        language: Option<&str>,
        aligned: Option<Vec<WordIn>>,
    ) -> Option<Segment> {
        let start = self.ticks(span.start);
        let end = self.ticks(span.end);
        if end <= start {
            return None;
        }
        let timescale = self.job.options.timescale;
        let words = match aligned {
            Some(words) => words
                .into_iter()
                .map(|word| Word {
                    start: self.ticks(word.start),
                    end: self.ticks(word.end),
                    text: word.text,
                    confidence: None,
                    timing_quality: TimingQuality::Aligned,
                    speaker_id: None,
                })
                .collect(),
            None => word_timing::estimate(text, language, self.job.offset + span.start, self.job.offset + span.end)
                .into_iter()
                .map(|word| Word {
                    start: seconds_to_ticks(word.start, timescale),
                    end: seconds_to_ticks(word.end, timescale),
                    text: word.text,
                    confidence: None,
                    timing_quality: TimingQuality::Estimated,
                    speaker_id: None,
                })
                .collect(),
        };
        let mut segment = Segment {
            id: format!("seg-{number:04}"),
            start,
            end,
            text: text.to_owned(),
            speaker_id: None,
            words,
        };
        if asr_result::fix_word_times(&mut segment) {
            self.warn(Warning::new(WarningCode::TimingAdjusted).segment(&segment.id));
        }
        Some(segment)
    }

    fn cancelled_result(&self, segments_path: &str) -> JobRunResult {
        JobRunResult {
            outcome: JobOutcome::Cancelled,
            output: None,
            segments_file: Some(segments_path.to_owned()),
            stats: self.stats,
        }
    }

    /// Assembles, self-checks and writes `result.json`. `decoded_seconds` is the length of audio actually processed. `examined` being false
    /// means nothing was checked (no audio track), and coverage is empty.
    fn finish(
        &mut self,
        outcome: Outcome,
        segments: Vec<Segment>,
        language: Option<LanguageResult>,
        decoded_seconds: f64,
        segments_path: &str,
        examined: bool,
    ) -> Result<JobRunResult, ErrorBody> {
        self.phase("finalizing");
        let timescale = self.job.options.timescale;
        let (duration, coverage) = match examined {
            true => {
                let start = self.ticks(0.0);
                let end = self.ticks(decoded_seconds);
                (end, vec![TickSpan { start, end }])
            }
            false => (0, Vec::new()),
        };
        let language = language.unwrap_or_else(|| match &self.job.options.language {
            LanguageRequest::Assert { tag } => LanguageResult {
                tag: Some(tag.clone()),
                source: LanguageSource::Asserted,
                confidence: None,
            },
            LanguageRequest::Prefer { tag } => LanguageResult {
                tag: tag.clone(),
                source: LanguageSource::Unknown,
                confidence: None,
            },
        });
        let result = AsrResult {
            schema: asr_result::SCHEMA.into(),
            outcome,
            timescale,
            clock: asr_result::CLOCK.into(),
            duration,
            language,
            segments,
            speakers: self.speakers.clone(),
            coverage,
            warnings: self.warnings.clone(),
            provenance: Provenance {
                provider: "local".into(),
                bundle_id: Some(self.bundle.bundle_id.clone()),
                models: ModelRefs {
                    asr: model_ref(self.bundle.asr.as_ref()),
                    vad: model_ref(self.bundle.vad.as_ref()),
                    aligner: match self.aligner_loaded {
                        true => model_ref(self.bundle.aligner.as_ref()),
                        false => None,
                    },
                    speaker: match self.speaker_used {
                        true => model_ref(self.bundle.speaker.as_ref()),
                        false => None,
                    },
                    segmentation: match self.segmentation_used {
                        true => model_ref(self.bundle.segmentation.as_ref()),
                        false => None,
                    },
                },
                backend: self.bundle.backend.clone(),
                device: self.bundle.device.clone(),
                worker_version: WORKER_VERSION.into(),
                input_hash: self.job.params.input.content_hash.clone(),
                run_generation: self.job.params.run_generation,
            },
        };
        let asserted = match &self.job.options.language {
            LanguageRequest::Assert { tag } => Some(tag.as_str()),
            LanguageRequest::Prefer { .. } => None,
        };
        if let Err(problem) = asr_result::validate(&result, asserted) {
            eprintln!("[model-worker] result failed self-validation: {problem}");
            return Err(
                ErrorBody::new(codes::INFERENCE_FAILED, "the assembled result failed self-validation")
                    .with_details(json!({ "reason": "invalid-output" })),
            );
        }
        let output = asr_result::write_result(self.job.staging, &result).map_err(|error| {
            eprintln!("[model-worker] cannot write result.json: {error}");
            ErrorBody::new(codes::INFERENCE_FAILED, "writing result.json failed")
        })?;
        Ok(JobRunResult {
            outcome: JobOutcome::Completed,
            output: Some(output),
            segments_file: Some(segments_path.to_owned()),
            stats: self.stats,
        })
    }
}

/// Projects speaker intervals (seconds relative to the decode start) onto the words in segments (ticks), writes `speakerId` on words and segments, and returns the result's `speakers[]`.
/// For how words are assigned, see [`project_speaker_clusters`]; words with no evidence carry no speaker. A segment takes the speaker who speaks the most within it (ties go to whoever appeared first).
/// Ids are numbered in the order they first appear in time; clusters that got no words are placed last, ordered by their earliest interval.
fn assign_speakers(segments: &mut [Segment], ranges: &[SpeakerRange], offset: f64, timescale: u64) -> Vec<Speaker> {
    let spans: Vec<(f64, f64)> = segments
        .iter()
        .flat_map(|segment| segment.words.iter())
        .map(|word| {
            (
                ticks_to_seconds(word.start, timescale) - offset,
                ticks_to_seconds(word.end, timescale) - offset,
            )
        })
        .collect();
    let projected = project_speaker_clusters(&spans, ranges);

    let mut order: Vec<usize> = Vec::new();
    for cluster in projected.iter().flatten() {
        if !order.contains(cluster) {
            order.push(*cluster);
        }
    }
    let mut silent: Vec<(f64, usize)> = Vec::new();
    for range in ranges {
        if order.contains(&range.cluster) {
            continue;
        }
        match silent.iter_mut().find(|(_, cluster)| *cluster == range.cluster) {
            Some(entry) => entry.0 = entry.0.min(range.start),
            None => silent.push((range.start, range.cluster)),
        }
    }
    silent.sort_by(|a, b| a.0.total_cmp(&b.0).then(a.1.cmp(&b.1)));
    order.extend(silent.into_iter().map(|(_, cluster)| cluster));
    let id_of = |cluster: usize| {
        order
            .iter()
            .position(|known| *known == cluster)
            .map(|index| format!("spk-{}", index + 1))
    };

    let mut clusters = projected.into_iter();
    for segment in segments.iter_mut() {
        // Each speaker's speaking time within the segment (ticks), in order of first appearance.
        let mut weights: Vec<(usize, u64)> = Vec::new();
        for word in &mut segment.words {
            let Some(cluster) = clusters.next().flatten() else {
                continue;
            };
            word.speaker_id = id_of(cluster);
            let weight = (word.end - word.start).max(1);
            match weights.iter_mut().find(|(known, _)| *known == cluster) {
                Some(entry) => entry.1 += weight,
                None => weights.push((cluster, weight)),
            }
        }
        let heaviest = weights.iter().fold(None::<(usize, u64)>, |best, &(cluster, weight)| match best {
            Some((_, best_weight)) if best_weight >= weight => best,
            _ => Some((cluster, weight)),
        });
        segment.speaker_id = heaviest.and_then(|(cluster, _)| id_of(cluster));
    }
    (1..=order.len())
        .map(|number| Speaker {
            id: format!("spk-{number}"),
            label: None,
        })
        .collect()
}

/// The run mode changed within one task: a bug in the backend implementation.
fn not_a_pipeline() -> ErrorBody {
    eprintln!("[model-worker] the loaded model changed its run mode during a job");
    ErrorBody::new(codes::INFERENCE_FAILED, "speech recognition failed")
}

/// Words from the aligner (seconds relative to the given audio) → seconds relative to the decode start. Empty words are dropped; a word's end is never earlier than its start (same as v2's pipeline).
fn decode_relative_words(aligned: Vec<AlignedWord>, origin: f64) -> Vec<WordIn> {
    aligned
        .into_iter()
        .filter_map(|word| {
            let text = word.text.trim().to_owned();
            if text.is_empty() {
                return None;
            }
            let start = origin + f64::from(word.start);
            Some(WordIn {
                start,
                end: start.max(origin + f64::from(word.end)),
                text,
            })
        })
        .collect()
}

/// Segmentation when only word times are available: a new segment starts when a pause exceeds [`ALIGN_SEGMENT_GAP_SECONDS`], when the previous word ends in sentence-final punctuation, or when a segment has already exceeded
/// [`ALIGN_SEGMENT_MAX_SECONDS`]. The rules are the same as `groupWords` in `packages/providers`.
fn group_aligned_words(words: Vec<WordIn>) -> Vec<Vec<WordIn>> {
    let mut groups: Vec<Vec<WordIn>> = Vec::new();
    let mut current: Vec<WordIn> = Vec::new();
    for word in words {
        if let (Some(first), Some(last)) = (current.first(), current.last())
            && (word.start - last.end > ALIGN_SEGMENT_GAP_SECONDS
                || ends_sentence(&last.text)
                || word.end - first.start > ALIGN_SEGMENT_MAX_SECONDS)
        {
            groups.push(std::mem::take(&mut current));
        }
        current.push(word);
    }
    if !current.is_empty() {
        groups.push(current);
    }
    groups
}

/// Sentence-final punctuation: `。！？!?…`, or a `.` that is not part of an ellipsis.
fn ends_sentence(text: &str) -> bool {
    let mut characters = text.chars().rev();
    match characters.next() {
        Some('。' | '！' | '？' | '!' | '?' | '…') => true,
        Some('.') => characters.next().is_some_and(|before| before != '.'),
        _ => false,
    }
}

/// Joins words back into text: no space between CJK characters or before punctuation; otherwise words are separated by spaces (same as `joinWords` in `packages/providers`).
fn join_words(words: &[WordIn]) -> String {
    let mut out = String::new();
    for word in words {
        if let (Some(before), Some(after)) = (out.chars().last(), word.text.chars().next())
            && needs_space(before, after)
        {
            out.push(' ');
        }
        out.push_str(&word.text);
    }
    out
}

fn needs_space(before: char, after: char) -> bool {
    if is_cjk(before) || is_cjk(after) {
        return false;
    }
    !matches!(after, ',' | '.' | '!' | '?' | ';' | ':' | '%' | ')' | ']' | '}' | '\'' | '’' | '”')
}

fn is_cjk(character: char) -> bool {
    is_han_ideograph(character) || matches!(character, '\u{3000}'..='\u{30FF}' | '\u{FF00}'..='\u{FFEF}')
}

fn model_ref(files: Option<&VerifiedFiles>) -> Option<ModelRef> {
    files.map(|files| ModelRef {
        family: files.family.clone(),
        revision: files.revision.clone(),
    })
}
