//! Orchestration of `job.run` (capability `synthesize`) (Model Worker protocol spec §2.5.2): frozen parameters → [`TtsRequest`] → engine synthesis → `speech.wav` (`cuccut.speech-wav/v1`).
//!
//! Phases: `preparing-reference` (only for `clone`; decodes the reference recording first, and if it cannot be read, it is `INPUT_UNREADABLE`) → `synthesizing` (`steps` in `job.progress` counts text chunks: at the start report `0/n`, and after each chunk completes report `i+1/n`) → `encoding`.
//! Cancellation: every engine progress callback (including per token) checks the cancel flag; returning `false` makes the engine return at the next safe point; the result is then `outcome: 'cancelled'`, and no output is written.
//!
//! Voice styles and knobs the model cannot support are reported as `MODEL_UNSUPPORTED` (`details.reason`) before the run starts; they are not swapped for another voice or silently ignored. The Runtime already rejects them at submission according to the model's description; this is the same rule applied as a fallback on the Worker side. Other failures inside the engine are `INFERENCE_FAILED` (details are written only to stderr; the message contains no paths); failing to write `speech.wav` into staging is `OUTPUT_WRITE_FAILED`.

use std::fs::File;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Instant;

use serde_json::{Value, json};

use super::types::{SamplingOptions, TtsEngineKind, TtsProgress, TtsRequest, VoiceSpec};
use super::{TtsEngine, gpt_sovits, omnivoice, voices, wav};
use crate::asr_result::sha256_hex;
use crate::audio::{self, DecodeError};
use crate::protocol::{
    ErrorBody, JobOutcome, OutputFile, SPEECH_OUTPUT_FILE, SynthesizeRunParams, SynthesizeRunResult, SynthesizeStats, SynthesizeVoice,
    SynthesizedAudio, codes,
};
use crate::transcribe::JobSink;

/// The reference recording is decoded only to confirm it can be read (and to measure its duration); the sample rate does not matter to the engine.
const REFERENCE_PROBE_RATE: u32 = 16_000;

/// Runs one synthesis job. The returned error is the error response for that request.
pub fn run(
    engine: &mut dyn TtsEngine,
    params: &SynthesizeRunParams,
    cancel: &AtomicBool,
    sink: &mut dyn JobSink,
) -> Result<SynthesizeRunResult, ErrorBody> {
    params.validate()?;
    let staging = Path::new(&params.staging);
    if !staging.is_dir() {
        return Err(ErrorBody::invalid_params("staging must be an existing absolute directory"));
    }
    let request = request_for(engine, params)?;
    let job_id = params.job_id.as_str();
    let mut stats = SynthesizeStats::default();
    let cancelled = |stats: SynthesizeStats| SynthesizeRunResult {
        outcome: JobOutcome::Cancelled,
        output: None,
        audio: None,
        stats,
        readings_dropped: Vec::new(),
    };

    if let Some(input) = &params.input {
        phase(sink, job_id, "preparing-reference");
        let started = Instant::now();
        let seconds = probe_reference(Path::new(&input.file))?;
        check_reference_length(engine.kind(), &request, seconds)?;
        stats.reference_ms = started.elapsed().as_millis() as u64;
    }
    if cancel.load(Ordering::SeqCst) {
        return Ok(cancelled(stats));
    }

    phase(sink, job_id, "synthesizing");
    let started = Instant::now();
    let mut stopped = false;
    let mut chunks = 0usize;
    let synthesized = {
        let mut on_progress = |progress: TtsProgress| -> bool {
            if cancel.load(Ordering::SeqCst) {
                stopped = true;
                return false;
            }
            match progress {
                // At the start of the first chunk, report `0/n`; after each chunk completes, report once (the start of the next chunk and the completion of the previous one are the same number).
                TtsProgress::ChunkStarted { index, count } => {
                    chunks = count;
                    if index == 0 {
                        steps(sink, job_id, 0, count);
                    }
                }
                TtsProgress::ChunkFinished { index, .. } if chunks > 0 => steps(sink, job_id, index + 1, chunks),
                _ => {}
            }
            true
        };
        engine.synthesize(&request, &mut on_progress)
    };
    stats.synthesis_ms = started.elapsed().as_millis() as u64;
    let audio = match synthesized {
        _ if stopped || cancel.load(Ordering::SeqCst) => return Ok(cancelled(stats)),
        Ok(audio) => audio,
        Err(error) => return Err(inference_failed(engine.kind(), &error)),
    };
    if audio.is_empty() || audio.sample_rate == 0 {
        return Err(ErrorBody::new(codes::INFERENCE_FAILED, "the model produced no audio")
            .with_details(json!({ "engine": engine.kind().as_str(), "reason": "empty-audio" })));
    }

    phase(sink, job_id, "encoding");
    let started = Instant::now();
    let bytes = wav::encode_wav_pcm16(&audio.samples, audio.sample_rate);
    let output = write_output(staging, &bytes).map_err(|error| {
        eprintln!("[model-worker] writing {SPEECH_OUTPUT_FILE} failed: {error}");
        ErrorBody::new(codes::OUTPUT_WRITE_FAILED, format!("could not write {SPEECH_OUTPUT_FILE}"))
            .with_details(json!({ "file": SPEECH_OUTPUT_FILE }))
    })?;
    stats.encode_ms = started.elapsed().as_millis() as u64;
    Ok(SynthesizeRunResult {
        outcome: JobOutcome::Completed,
        output: Some(output),
        audio: Some(SynthesizedAudio {
            sample_rate: audio.sample_rate,
            channels: 1,
            duration_sec: audio.duration_seconds(),
        }),
        stats,
        readings_dropped: audio.readings_dropped,
    })
}

/// Frozen parameters → engine request. Voice styles and knobs the model cannot support are reported here as `MODEL_UNSUPPORTED`.
pub fn request_for(engine: &dyn TtsEngine, params: &SynthesizeRunParams) -> Result<TtsRequest, ErrorBody> {
    let kind = engine.kind();
    let options = &params.options;
    let unsupported = |reason: &str, extra: Value| {
        let mut details = json!({ "engine": kind.as_str(), "reason": reason });
        if let (Some(details), Some(extra)) = (details.as_object_mut(), extra.as_object()) {
            details.extend(extra.clone());
        }
        ErrorBody::new(
            codes::MODEL_UNSUPPORTED,
            format!("the {} engine cannot do this ({reason})", kind.as_str()),
        )
        .with_details(details)
    };
    let instructions = options.instructions.as_deref().map(str::trim).filter(|text| !text.is_empty());
    if instructions.is_some() && !accepts_instructions(kind) {
        return Err(unsupported("unsupported-option", json!({ "option": "instructions" })));
    }
    for (option, given, accepted) in [
        ("speed", options.speed.is_some(), accepts_speed(kind)),
        ("cfg", options.cfg.is_some(), accepts_diffusion_knobs(kind)),
        ("steps", options.steps.is_some(), accepts_diffusion_knobs(kind)),
    ] {
        if given && !accepted {
            return Err(unsupported("unsupported-option", json!({ "option": option })));
        }
    }
    if let Some(speed) = options.speed
        && !(speed.is_finite() && speed > 0.0)
    {
        return Err(ErrorBody::invalid_params("options.speed must be a positive number"));
    }
    if let Some(cfg) = options.cfg
        && !(cfg.is_finite() && cfg >= 0.0)
    {
        return Err(ErrorBody::invalid_params("options.cfg must be a non-negative number"));
    }
    // VoxCPM2's guidance strength must be greater than 0 (the engine only checks it at synthesis time, where it would become an inference failure); OmniVoice's 0 means “no guidance”.
    if kind == TtsEngineKind::VoxCpm2 && options.cfg == Some(0.0) {
        return Err(ErrorBody::invalid_params("options.cfg must be positive for VoxCPM2"));
    }
    if options.steps == Some(0) {
        return Err(ErrorBody::invalid_params("options.steps must be positive"));
    }

    let (voice, instruct) = match (&options.voice, &params.input) {
        (SynthesizeVoice::Preset { id }, _) => {
            // Same rule as v2: speaker names are case-insensitive (`Uncle_Fu`), and built-in voice ids are always allowed (for CustomVoice, the closest matching speaker is substituted).
            if voices::unknown_preset(id, &engine.preset_speakers()) {
                return Err(unsupported("unknown-voice", json!({ "voice": id })));
            }
            (VoiceSpec::Preset { speaker: id.clone() }, instructions.map(str::to_owned))
        }
        (SynthesizeVoice::Clone { transcript }, Some(input)) => (
            VoiceSpec::Clone {
                reference_audio: PathBuf::from(&input.file),
                reference_text: transcript
                    .as_deref()
                    .map(str::trim)
                    .filter(|text| !text.is_empty())
                    .map(str::to_owned),
            },
            instructions.map(str::to_owned),
        ),
        (SynthesizeVoice::Clone { .. }, None) => {
            return Err(ErrorBody::invalid_params("voice mode clone needs input (the reference audio)"));
        }
        (SynthesizeVoice::Describe { description }, _) => {
            if !accepts_description(kind) {
                return Err(unsupported("unsupported-voice-mode", json!({ "voiceMode": "describe" })));
            }
            // The description and the style instruction are the same `instruct` in the engine; giving both cannot be done, so they are not merged on the caller's behalf.
            if instructions.is_some() {
                return Err(unsupported(
                    "unsupported-option",
                    json!({ "option": "instructions", "voiceMode": "describe" }),
                ));
            }
            let description = description.trim();
            if description.is_empty() {
                return Err(ErrorBody::invalid_params("options.voice.description must not be empty"));
            }
            // OmniVoice only accepts a closed vocabulary: descriptions outside the vocabulary are rejected here as a parameter error, rather than becoming an inference failure at synthesis time.
            if kind == TtsEngineKind::OmniVoice
                && let Err(error) = omnivoice::instruct::resolve_instruct(Some(description), has_han(&options.text))
            {
                eprintln!("[model-worker] OmniVoice description rejected: {error:#}");
                return Err(
                    ErrorBody::invalid_params("options.voice.description is outside the OmniVoice vocabulary")
                        .with_details(json!({ "engine": kind.as_str(), "reason": "description-vocabulary" })),
                );
            }
            (VoiceSpec::Default, Some(description.to_owned()))
        }
    };
    Ok(TtsRequest {
        text: options.text.clone(),
        language: options
            .language
            .as_deref()
            .map(str::trim)
            .filter(|tag| !tag.is_empty())
            .map(str::to_owned),
        voice,
        instruct,
        emotion: None,
        target_duration_seconds: None,
        sampling: SamplingOptions {
            seed: options.seed,
            cfg: options.cfg.map(|cfg| cfg as f32),
            steps: options.steps.map(|steps| steps as usize),
            ..SamplingOptions::default()
        },
        speed: options.speed.map(|speed| speed as f32),
    })
}

/// Style instruction (tone directive): Qwen3-TTS (CustomVoice) and VoxCPM2.
fn accepts_instructions(kind: TtsEngineKind) -> bool {
    matches!(kind, TtsEngineKind::Qwen3Tts | TtsEngineKind::VoxCpm2)
}

/// Voice design from a description: Qwen3-TTS (VoiceDesign) and OmniVoice.
fn accepts_description(kind: TtsEngineKind) -> bool {
    matches!(kind, TtsEngineKind::Qwen3Tts | TtsEngineKind::OmniVoice)
}

/// Speaking-rate multiplier: OmniVoice and IndexTTS 2.5.
fn accepts_speed(kind: TtsEngineKind) -> bool {
    matches!(kind, TtsEngineKind::OmniVoice | TtsEngineKind::IndexTts25)
}

/// Classifier-free guidance strength and diffusion step count: VoxCPM2 and OmniVoice.
fn accepts_diffusion_knobs(kind: TtsEngineKind) -> bool {
    matches!(kind, TtsEngineKind::VoxCpm2 | TtsEngineKind::OmniVoice)
}

/// The synthesized text contains Han characters (OmniVoice uses this to choose the Chinese or English description words).
fn has_han(text: &str) -> bool {
    text.chars().any(|ch| ('\u{4e00}'..='\u{9fff}').contains(&ch))
}

/// GPT-SoVITS, when the reference text is given, accepts only a 3–10 second reference recording (official limit); if the recording is outside that range, `MODEL_UNSUPPORTED` is reported before synthesis.
fn check_reference_length(kind: TtsEngineKind, request: &TtsRequest, seconds: f64) -> Result<(), ErrorBody> {
    let VoiceSpec::Clone {
        reference_text: Some(_), ..
    } = &request.voice
    else {
        return Ok(());
    };
    if kind != TtsEngineKind::GptSovits {
        return Ok(());
    }
    let [min, max] = gpt_sovits::REFERENCE_SECONDS_WITH_TEXT.map(f64::from);
    if (min..=max).contains(&seconds) {
        return Ok(());
    }
    Err(ErrorBody::new(
        codes::MODEL_UNSUPPORTED,
        format!("GPT-SoVITS needs a {min}–{max} s reference when the transcript is given"),
    )
    .with_details(json!({
        "engine": kind.as_str(),
        "reason": "reference-duration",
        "seconds": (seconds * 10.0).round() / 10.0,
        "range": [min, max],
    })))
}

/// A reference recording that cannot be read (missing, fails to decode, or has no sound) is `INPUT_UNREADABLE`. Returns its duration in seconds.
fn probe_reference(file: &Path) -> Result<f64, ErrorBody> {
    let unreadable = |detail: String| {
        eprintln!("[model-worker] the reference audio is unreadable: {detail}");
        ErrorBody::new(codes::INPUT_UNREADABLE, "the reference audio is unreadable").with_details(json!({ "input": "reference" }))
    };
    match audio::decode_mono(file, REFERENCE_PROBE_RATE) {
        Ok(samples) if samples.is_empty() => Err(unreadable("no samples".into())),
        Ok(samples) => Ok(samples.len() as f64 / f64::from(REFERENCE_PROBE_RATE)),
        Err(DecodeError::Cancelled) => Err(unreadable("cancelled".into())),
        Err(error) => Err(unreadable(error.to_string())),
    }
}

fn inference_failed(kind: TtsEngineKind, error: &anyhow::Error) -> ErrorBody {
    if let Some(body) = error.downcast_ref::<ErrorBody>() {
        return body.clone();
    }
    eprintln!("[model-worker] {} synthesis failed: {error:#}", kind.as_str());
    ErrorBody::new(codes::INFERENCE_FAILED, format!("{} synthesis failed", kind.as_str()))
        .with_details(json!({ "engine": kind.as_str(), "reason": "synthesis-failed" }))
}

/// `speech.wav`: written to a temporary file first, then renamed. The path is absolute (staging is an absolute path).
fn write_output(staging: &Path, bytes: &[u8]) -> std::io::Result<OutputFile> {
    let path = staging.join(SPEECH_OUTPUT_FILE);
    let temporary = staging.join(format!("{SPEECH_OUTPUT_FILE}.tmp"));
    {
        let mut file = File::create(&temporary)?;
        file.write_all(bytes)?;
        file.sync_all()?;
    }
    std::fs::rename(&temporary, &path)?;
    Ok(OutputFile {
        path: path.to_string_lossy().into_owned(),
        sha256: sha256_hex(bytes),
        byte_length: bytes.len() as u64,
    })
}

fn phase(sink: &mut dyn JobSink, job_id: &str, phase: &str) {
    sink.event("job.phase", json!({ "jobId": job_id, "phase": phase }));
}

fn steps(sink: &mut dyn JobSink, job_id: &str, done: usize, total: usize) {
    sink.event(
        "job.progress",
        json!({ "jobId": job_id, "phase": "synthesizing", "done": done, "total": total, "unit": "steps" }),
    );
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::protocol::{Capability, SPEECH_OUTPUT_CONTRACT, SpeechReference, SynthesizeOptions};
    use crate::synthesize::{ProgressSink, TtsAudio};
    use anyhow::bail;

    /// Fake engine: each chunk generates `tokens` tokens, 0.1 s of 440 Hz per chunk; `cancel_at` sets the cancel flag during that chunk.
    struct FakeEngine {
        kind: TtsEngineKind,
        speakers: Vec<String>,
        chunks: usize,
        fail: bool,
        cancel_at: Option<(usize, &'static AtomicBool)>,
        seen: Option<TtsRequest>,
    }

    impl FakeEngine {
        fn new(kind: TtsEngineKind) -> Self {
            Self {
                kind,
                speakers: vec!["Vivian".into(), "zh-female".into()],
                chunks: 2,
                fail: false,
                cancel_at: None,
                seen: None,
            }
        }
    }

    impl TtsEngine for FakeEngine {
        fn kind(&self) -> TtsEngineKind {
            self.kind
        }
        fn sample_rate(&self) -> u32 {
            24_000
        }
        fn preset_speakers(&self) -> Vec<String> {
            self.speakers.clone()
        }
        fn synthesize(&mut self, request: &TtsRequest, progress: ProgressSink<'_>) -> Result<TtsAudio, anyhow::Error> {
            self.seen = Some(request.clone());
            if self.fail {
                bail!("weights are corrupt: /secret/path/model.safetensors");
            }
            let mut samples = Vec::new();
            for index in 0..self.chunks {
                if !progress(TtsProgress::ChunkStarted { index, count: self.chunks }) {
                    bail!("synthesis cancelled");
                }
                for generated in 1..=3 {
                    if let Some((at, flag)) = self.cancel_at
                        && at == index
                    {
                        flag.store(true, Ordering::SeqCst);
                    }
                    if !progress(TtsProgress::Tokens { index, generated }) {
                        bail!("synthesis cancelled");
                    }
                }
                samples.extend((0..2_400).map(|i| (i as f32 * 440.0 * std::f32::consts::TAU / 24_000.0).sin() * 0.5));
                if !progress(TtsProgress::ChunkFinished {
                    index,
                    seconds: samples.len() as f64 / 24_000.0,
                }) {
                    bail!("synthesis cancelled");
                }
            }
            Ok(TtsAudio {
                samples,
                sample_rate: 24_000,
                readings_dropped: Vec::new(),
            })
        }
    }

    #[derive(Default)]
    struct Events(Vec<(String, Value)>);

    impl JobSink for Events {
        fn event(&mut self, name: &str, params: Value) {
            self.0.push((name.to_owned(), params));
        }
    }

    impl Events {
        fn phases(&self) -> Vec<&str> {
            self.0
                .iter()
                .filter(|(name, _)| name == "job.phase")
                .map(|(_, params)| params["phase"].as_str().unwrap())
                .collect()
        }
        fn progress(&self) -> Vec<(u64, u64)> {
            self.0
                .iter()
                .filter(|(name, _)| name == "job.progress")
                .map(|(_, params)| {
                    assert_eq!(params["unit"], "steps");
                    assert_eq!(params["phase"], "synthesizing");
                    (params["done"].as_u64().unwrap(), params["total"].as_u64().unwrap())
                })
                .collect()
        }
    }

    fn params(staging: &Path, voice: SynthesizeVoice, input: Option<SpeechReference>) -> SynthesizeRunParams {
        SynthesizeRunParams {
            job_id: "job_1".into(),
            run_generation: 1,
            capability: Capability::Synthesize,
            input,
            options: SynthesizeOptions {
                text: "你好，世界。".into(),
                language: Some("zh-CN".into()),
                voice,
                instructions: None,
                speed: None,
                cfg: None,
                steps: None,
                seed: Some(7),
            },
            staging: staging.to_string_lossy().into_owned(),
            output_contract: SPEECH_OUTPUT_CONTRACT.into(),
        }
    }

    fn preset(id: &str) -> SynthesizeVoice {
        SynthesizeVoice::Preset { id: id.into() }
    }

    #[test]
    fn writes_speech_wav_with_phases_and_step_progress() {
        let staging = tempfile::tempdir().unwrap();
        let mut engine = FakeEngine::new(TtsEngineKind::Qwen3Tts);
        let mut events = Events::default();
        let cancel = AtomicBool::new(false);
        let result = run(&mut engine, &params(staging.path(), preset("Vivian"), None), &cancel, &mut events).unwrap();

        assert_eq!(result.outcome, JobOutcome::Completed);
        assert_eq!(
            events.phases(),
            ["synthesizing", "encoding"],
            "no reference, no preparing-reference"
        );
        assert_eq!(events.progress(), [(0, 2), (1, 2), (2, 2)]);
        let output = result.output.unwrap();
        let path = staging.path().join(SPEECH_OUTPUT_FILE);
        assert_eq!(output.path, path.to_string_lossy());
        let bytes = std::fs::read(&path).unwrap();
        assert_eq!(output.byte_length, bytes.len() as u64);
        assert_eq!(output.sha256, sha256_hex(&bytes));
        assert!(!staging.path().join("speech.wav.tmp").exists());
        let (samples, rate) = wav::decode_wav_pcm16(&bytes).unwrap();
        assert_eq!((samples.len(), rate), (4_800, 24_000));
        assert_eq!(
            result.audio,
            Some(SynthesizedAudio {
                sample_rate: 24_000,
                channels: 1,
                duration_sec: 0.2
            })
        );
        let seen = engine.seen.unwrap();
        assert_eq!(seen.voice, VoiceSpec::Preset { speaker: "Vivian".into() });
        assert_eq!(seen.language.as_deref(), Some("zh-CN"));
        assert_eq!(seen.sampling.seed, Some(7));
    }

    #[test]
    fn readings_the_engine_cannot_voice_come_back_in_the_result() {
        let staging = tempfile::tempdir().unwrap();
        let mut engine = crate::synthesize::readings::Annotating::new(Box::new(FakeEngine::new(TtsEngineKind::VoxCpm2)));
        let mut job = params(staging.path(), preset("zh-female"), None);
        job.options.text = "他<行|hang2>不行。".into();
        let result = run(&mut engine, &job, &AtomicBool::new(false), &mut Events::default()).unwrap();
        assert_eq!(result.outcome, JobOutcome::Completed);
        let dropped = serde_json::to_value(&result.readings_dropped).unwrap();
        assert_eq!(dropped, json!([{ "start": 1, "end": 2, "reading": "hang2", "origin": "user" }]));

        let plain = run(
            &mut engine,
            &params(staging.path(), preset("zh-female"), None),
            &AtomicBool::new(false),
            &mut Events::default(),
        )
        .unwrap();
        assert!(plain.readings_dropped.is_empty());
    }

    #[test]
    fn clone_prepares_the_reference_first_and_unreadable_references_fail() {
        let staging = tempfile::tempdir().unwrap();
        let reference = staging.path().join("ref.wav");
        let tone: Vec<f32> = (0..16_000).map(|i| (i as f32 * 0.05).sin() * 0.3).collect();
        wav::write_wav_pcm16(&reference, &tone, 16_000).unwrap();
        let input = |file: &Path| SpeechReference {
            file: file.to_string_lossy().into_owned(),
            content_hash: "sha256:ab".into(),
            track: 0,
        };
        let voice = SynthesizeVoice::Clone {
            transcript: Some(" 参考原文 ".into()),
        };
        let mut engine = FakeEngine::new(TtsEngineKind::Qwen3Tts);
        let mut events = Events::default();
        let cancel = AtomicBool::new(false);
        let result = run(
            &mut engine,
            &params(staging.path(), voice.clone(), Some(input(&reference))),
            &cancel,
            &mut events,
        )
        .unwrap();
        assert_eq!(result.outcome, JobOutcome::Completed);
        assert_eq!(events.phases(), ["preparing-reference", "synthesizing", "encoding"]);
        assert_eq!(
            engine.seen.unwrap().voice,
            VoiceSpec::Clone {
                reference_audio: reference.clone(),
                reference_text: Some("参考原文".into())
            }
        );

        let missing = staging.path().join("missing.wav");
        let mut engine = FakeEngine::new(TtsEngineKind::Qwen3Tts);
        let error = run(
            &mut engine,
            &params(staging.path(), voice, Some(input(&missing))),
            &cancel,
            &mut Events::default(),
        )
        .unwrap_err();
        assert_eq!(error.code, codes::INPUT_UNREADABLE);
        assert!(!error.message.contains(&*staging.path().to_string_lossy()));
        assert!(engine.seen.is_none(), "the engine never runs on an unreadable reference");
    }

    #[test]
    fn cancel_stops_at_the_next_progress_callback() {
        static CANCEL: AtomicBool = AtomicBool::new(false);
        let staging = tempfile::tempdir().unwrap();
        let mut engine = FakeEngine::new(TtsEngineKind::Qwen3Tts);
        engine.cancel_at = Some((0, &CANCEL));
        let mut events = Events::default();
        let result = run(&mut engine, &params(staging.path(), preset("Vivian"), None), &CANCEL, &mut events).unwrap();
        assert_eq!(result.outcome, JobOutcome::Cancelled);
        assert_eq!(result.output, None);
        assert_eq!(result.audio, None);
        assert_eq!(events.phases(), ["synthesizing"], "no encoding after a cancel");
        assert!(!staging.path().join(SPEECH_OUTPUT_FILE).exists());

        // Cancelled before starting: the engine is not touched.
        let mut engine = FakeEngine::new(TtsEngineKind::Qwen3Tts);
        let result = run(
            &mut engine,
            &params(staging.path(), preset("Vivian"), None),
            &CANCEL,
            &mut Events::default(),
        )
        .unwrap();
        assert_eq!(result.outcome, JobOutcome::Cancelled);
        assert!(engine.seen.is_none());
    }

    #[test]
    fn engine_failures_are_inference_failed_without_paths() {
        let staging = tempfile::tempdir().unwrap();
        let mut engine = FakeEngine::new(TtsEngineKind::VoxCpm2);
        engine.fail = true;
        let error = run(
            &mut engine,
            &params(staging.path(), preset("zh-female"), None),
            &AtomicBool::new(false),
            &mut Events::default(),
        )
        .unwrap_err();
        assert_eq!(error.code, codes::INFERENCE_FAILED);
        assert!(error.retryable);
        assert!(!error.message.contains("/secret"), "{}", error.message);
    }

    #[test]
    fn maps_describe_instructions_and_knobs() {
        let staging = tempfile::tempdir().unwrap();
        let engine = FakeEngine::new(TtsEngineKind::OmniVoice);
        let mut run_params = params(
            staging.path(),
            SynthesizeVoice::Describe {
                description: " female, low pitch ".into(),
            },
            None,
        );
        run_params.options.speed = Some(1.25);
        run_params.options.cfg = Some(2.5);
        run_params.options.steps = Some(16);
        let request = request_for(&engine, &run_params).unwrap();
        assert_eq!(request.voice, VoiceSpec::Default);
        assert_eq!(request.instruct.as_deref(), Some("female, low pitch"));
        assert_eq!(request.speed, Some(1.25));
        assert_eq!(request.sampling.cfg, Some(2.5));
        assert_eq!(request.sampling.steps, Some(16));

        let engine = FakeEngine::new(TtsEngineKind::VoxCpm2);
        let mut run_params = params(staging.path(), preset("zh-female"), None);
        run_params.options.instructions = Some("用兴奋的语气".into());
        let request = request_for(&engine, &run_params).unwrap();
        assert_eq!(request.instruct.as_deref(), Some("用兴奋的语气"));
    }

    #[test]
    fn what_the_model_cannot_do_is_unsupported() {
        let staging = tempfile::tempdir().unwrap();
        let reason = |kind: TtsEngineKind, edit: &dyn Fn(&mut SynthesizeRunParams)| {
            let engine = FakeEngine::new(kind);
            let mut run_params = params(staging.path(), preset("Vivian"), None);
            edit(&mut run_params);
            let error = request_for(&engine, &run_params).unwrap_err();
            assert_eq!(error.code, codes::MODEL_UNSUPPORTED, "{error:?}");
            error.details.unwrap()
        };
        let details = reason(TtsEngineKind::Qwen3Tts, &|p| p.options.voice = preset("Nobody"));
        assert_eq!(details["reason"], "unknown-voice");
        let details = reason(TtsEngineKind::Qwen3Tts, &|p| p.options.speed = Some(1.1));
        assert_eq!(
            (&details["reason"], &details["option"]),
            (&json!("unsupported-option"), &json!("speed"))
        );
        let details = reason(TtsEngineKind::Qwen3Tts, &|p| p.options.cfg = Some(2.0));
        assert_eq!(details["option"], "cfg");
        let details = reason(TtsEngineKind::OmniVoice, &|p| p.options.instructions = Some("calm".into()));
        assert_eq!(details["option"], "instructions");
        let details = reason(TtsEngineKind::VoxCpm2, &|p| {
            p.options.voice = SynthesizeVoice::Describe {
                description: "female".into(),
            }
        });
        assert_eq!(details["reason"], "unsupported-voice-mode");
        let details = reason(TtsEngineKind::Qwen3Tts, &|p| {
            p.options.voice = SynthesizeVoice::Describe {
                description: "female".into(),
            };
            p.options.instructions = Some("calm".into());
        });
        assert_eq!(details["option"], "instructions");

        // A knob with the right shape but a wrong value is a parameter error.
        let engine = FakeEngine::new(TtsEngineKind::OmniVoice);
        let mut run_params = params(staging.path(), preset("zh-female"), None);
        run_params.options.speed = Some(0.0);
        assert_eq!(request_for(&engine, &run_params).unwrap_err().code, codes::INVALID_PARAMS);
        run_params.options.speed = None;
        run_params.options.steps = Some(0);
        assert_eq!(request_for(&engine, &run_params).unwrap_err().code, codes::INVALID_PARAMS);
    }

    #[test]
    fn preset_names_ignore_case_and_builtin_ids_reach_the_engine() {
        let staging = tempfile::tempdir().unwrap();
        let mut engine = FakeEngine::new(TtsEngineKind::Qwen3Tts);
        // CustomVoice's speaker table comes from lowercase keys (`uncle_fu` → `Uncle_fu`), while the catalog writes `Uncle_Fu`.
        engine.speakers = vec!["Vivian".into(), "Uncle_fu".into(), "Ono_anna".into()];
        for id in ["Uncle_Fu", "ono_anna", "VIVIAN", "zh-female", "ja-male"] {
            let request = request_for(&engine, &params(staging.path(), preset(id), None)).unwrap();
            assert_eq!(request.voice, VoiceSpec::Preset { speaker: id.into() }, "{id}");
        }
        let error = request_for(&engine, &params(staging.path(), preset("Uncle Fu"), None)).unwrap_err();
        assert_eq!(error.code, codes::MODEL_UNSUPPORTED);
        assert_eq!(error.details.unwrap()["reason"], "unknown-voice");
    }

    #[test]
    fn knob_values_and_descriptions_the_engine_rejects_are_invalid_params() {
        let staging = tempfile::tempdir().unwrap();
        // VoxCPM2's guidance strength must be greater than 0; OmniVoice's 0 means no guidance.
        let mut run_params = params(staging.path(), preset("zh-female"), None);
        run_params.options.cfg = Some(0.0);
        let error = request_for(&FakeEngine::new(TtsEngineKind::VoxCpm2), &run_params).unwrap_err();
        assert_eq!(error.code, codes::INVALID_PARAMS);
        assert_eq!(
            request_for(&FakeEngine::new(TtsEngineKind::OmniVoice), &run_params)
                .unwrap()
                .sampling
                .cfg,
            Some(0.0)
        );

        // OmniVoice's descriptions are checked only against the vocabulary (for Chinese text, both Chinese and English words are accepted).
        let describe = |description: &str| {
            params(
                staging.path(),
                SynthesizeVoice::Describe {
                    description: description.into(),
                },
                None,
            )
        };
        let engine = FakeEngine::new(TtsEngineKind::OmniVoice);
        assert!(request_for(&engine, &describe("女, 低音调")).is_ok());
        assert!(request_for(&engine, &describe("female, low pitch")).is_ok());
        let error = request_for(&engine, &describe("温柔的播音腔")).unwrap_err();
        assert_eq!(error.code, codes::INVALID_PARAMS);
        assert_eq!(error.details.unwrap()["reason"], "description-vocabulary");
        // Models that take free-form descriptions do not check the vocabulary.
        assert!(request_for(&FakeEngine::new(TtsEngineKind::Qwen3Tts), &describe("温柔的播音腔")).is_ok());
    }

    #[test]
    fn gpt_sovits_rejects_a_reference_outside_three_to_ten_seconds_with_a_transcript() {
        let staging = tempfile::tempdir().unwrap();
        let write = |name: &str, seconds: f32| {
            let path = staging.path().join(name);
            let tone: Vec<f32> = (0..(seconds * 16_000.0) as usize).map(|i| (i as f32 * 0.05).sin() * 0.3).collect();
            wav::write_wav_pcm16(&path, &tone, 16_000).unwrap();
            SpeechReference {
                file: path.to_string_lossy().into_owned(),
                content_hash: "sha256:ab".into(),
                track: 0,
            }
        };
        let (short, fine) = (write("short.wav", 1.5), write("fine.wav", 4.0));
        let clone = |transcript: Option<&str>| SynthesizeVoice::Clone {
            transcript: transcript.map(str::to_owned),
        };
        let attempt = |kind: TtsEngineKind, voice: SynthesizeVoice, input: &SpeechReference| {
            let mut engine = FakeEngine::new(kind);
            let result = run(
                &mut engine,
                &params(staging.path(), voice, Some(input.clone())),
                &AtomicBool::new(false),
                &mut Events::default(),
            );
            (result, engine.seen.is_some())
        };

        let (result, ran) = attempt(TtsEngineKind::GptSovits, clone(Some("参考原文")), &short);
        let error = result.unwrap_err();
        assert_eq!(error.code, codes::MODEL_UNSUPPORTED);
        let details = error.details.unwrap();
        assert_eq!(
            (&details["reason"], &details["seconds"]),
            (&json!("reference-duration"), &json!(1.5))
        );
        assert!(!ran, "the engine never runs on a reference it would reject");
        // No duration limit when the reference text is not given; other engines are not subject to this rule.
        assert!(attempt(TtsEngineKind::GptSovits, clone(None), &short).0.is_ok());
        assert!(attempt(TtsEngineKind::GptSovits, clone(Some("参考原文")), &fine).0.is_ok());
        assert!(attempt(TtsEngineKind::VoxCpm2, clone(Some("参考原文")), &short).0.is_ok());
    }
}
