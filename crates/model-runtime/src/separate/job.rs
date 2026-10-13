//! Orchestration of `job.run` (capability `separate`) (Model Worker protocol spec §2.5.4): the whole input is decoded to stereo → separated →
//! `vocals.wav` and `background.wav` (`cuccut.stems-wav/v1`).
//!
//! Stages: `decoding` (the whole input is decoded into memory; WAV keeps its original sample rate, other formats are decoded by ffmpeg to the model's working sample rate) → `separating`
//! (the `steps` in `job.progress` are "windows × sub-models": it reports `0/n` at the start and reports once after each window finishes) → `encoding`
//! (both outputs are converted to `options.sampleRate` and written as 16-bit PCM stereo WAV). The background is the sum of drums, bass and the other stems.
//! Cancellation: the cancel flag is checked once after each window; returning `false` makes the model return before the next window; the outcome is then `outcome: 'cancelled'`, and no output is written.
//! Failing to write the output to staging is `OUTPUT_WRITE_FAILED` (`details.file`), kept separate from failures of the model itself (`INFERENCE_FAILED`).

use std::fs::File;
use std::io::Write;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Instant;

use serde_json::json;

use super::resample::resample;
use super::types::{SeparationProgress, StereoAudio};
use super::{Separator, wav};
use crate::asr_result::sha256_hex;
use crate::audio::{self, DecodeError};
use crate::protocol::{
    BACKGROUND_OUTPUT_FILE, ErrorBody, JobOutcome, OutputFile, SeparateRunParams, SeparateRunResult, SeparateStats, SeparatedAudio,
    SeparatedFiles, VOCALS_OUTPUT_FILE, codes,
};
use crate::transcribe::JobSink;

/// Runs one separation task. The error returned is the error response for that request.
pub fn run(
    separator: &mut dyn Separator,
    params: &SeparateRunParams,
    cancel: &AtomicBool,
    sink: &mut dyn JobSink,
) -> Result<SeparateRunResult, ErrorBody> {
    params.validate()?;
    let staging = Path::new(&params.staging);
    if !staging.is_dir() {
        return Err(ErrorBody::invalid_params("staging must be an existing absolute directory"));
    }
    let job_id = params.job_id.as_str();
    let model_rate = separator.sample_rate();
    let mut stats = SeparateStats::default();
    let cancelled = |stats: SeparateStats| SeparateRunResult {
        outcome: JobOutcome::Cancelled,
        stems: None,
        audio: None,
        stats,
    };

    phase(sink, job_id, "decoding");
    let started = Instant::now();
    let decoded = audio::decode_stereo(Path::new(&params.input.file), params.input.track, model_rate);
    stats.decode_ms = started.elapsed().as_millis() as u64;
    let pcm = decoded.map_err(decode_error)?;
    let target_rate = params.options.sample_rate.unwrap_or(model_rate);
    let mix = StereoAudio {
        left: pcm.left,
        right: pcm.right,
        sample_rate: pcm.sample_rate,
    };
    // Length of the input at the target sample rate: the two outputs are aligned to it (rounding in resampling differs by at most a sample or two).
    let expected_len = ((mix.len() as f64) * f64::from(target_rate) / f64::from(mix.sample_rate)).round() as usize;
    if cancel.load(Ordering::SeqCst) {
        return Ok(cancelled(stats));
    }

    phase(sink, job_id, "separating");
    let started = Instant::now();
    let mut stopped = false;
    let separated = {
        let mut on_progress = |progress: SeparationProgress| -> bool {
            if cancel.load(Ordering::SeqCst) {
                stopped = true;
                return false;
            }
            if let SeparationProgress::Window { done, total } = progress {
                sink.event(
                    "job.progress",
                    json!({ "jobId": job_id, "phase": "separating", "done": done, "total": total, "unit": "steps" }),
                );
            }
            true
        };
        separator.separate(&mix, &mut on_progress)
    };
    stats.separation_ms = started.elapsed().as_millis() as u64;
    drop(mix);
    let stems = match separated {
        _ if stopped || cancel.load(Ordering::SeqCst) => return Ok(cancelled(stats)),
        Ok(stems) => stems,
        Err(error) => return Err(inference_failed(&error)),
    };
    if stems.vocals.is_empty() {
        return Err(ErrorBody::new(codes::INFERENCE_FAILED, "the model produced no audio").with_details(json!({ "reason": "empty-audio" })));
    }

    phase(sink, job_id, "encoding");
    let started = Instant::now();
    let background = stems.background();
    let vocals = to_rate(stems.vocals, target_rate, expected_len);
    let background = to_rate(background, target_rate, expected_len);
    let write = |name: &str, audio: &StereoAudio| {
        let bytes = wav::encode_wav_stereo_pcm16(audio).map_err(|error| write_failed(name, &error.to_string()))?;
        write_output(staging, name, &bytes).map_err(|error| write_failed(name, &error.to_string()))
    };
    let files = SeparatedFiles {
        vocals: write(VOCALS_OUTPUT_FILE, &vocals)?,
        background: write(BACKGROUND_OUTPUT_FILE, &background)?,
    };
    stats.encode_ms = started.elapsed().as_millis() as u64;
    Ok(SeparateRunResult {
        outcome: JobOutcome::Completed,
        stems: Some(files),
        audio: Some(SeparatedAudio {
            sample_rate: target_rate,
            channels: 2,
            duration_sec: vocals.duration_seconds(),
        }),
        stats,
    })
}

/// Converts to `rate`, then zero-pads or truncates to `len` (rounding in resampling makes the lengths differ by a sample or two).
fn to_rate(audio: StereoAudio, rate: u32, len: usize) -> StereoAudio {
    let fit = |channel: Vec<f32>| {
        let mut channel = if audio.sample_rate == rate {
            channel
        } else {
            resample(&channel, audio.sample_rate, rate)
        };
        channel.resize(len, 0.0);
        channel
    };
    StereoAudio {
        left: fit(audio.left),
        right: fit(audio.right),
        sample_rate: rate,
    }
}

fn decode_error(error: DecodeError) -> ErrorBody {
    match error {
        DecodeError::NoAudioTrack => {
            ErrorBody::new(codes::INPUT_UNREADABLE, "the input has no such audio track").with_details(json!({ "reason": "no-audio-track" }))
        }
        DecodeError::InputUnreadable(detail) => {
            eprintln!("[model-worker] input unreadable: {detail}");
            ErrorBody::new(codes::INPUT_UNREADABLE, "the input file cannot be read or demuxed")
        }
        // The path that decodes the whole input into memory does not check the cancel flag, so it never gets here.
        DecodeError::Cancelled => ErrorBody::new(codes::INPUT_UNREADABLE, "the input file cannot be read or demuxed"),
        DecodeError::DecodeFailed(detail) => {
            eprintln!("[model-worker] decode failed: {detail}");
            ErrorBody::new(codes::DECODE_FAILED, "audio decoding failed")
        }
    }
}

fn inference_failed(error: &anyhow::Error) -> ErrorBody {
    if let Some(body) = error.downcast_ref::<ErrorBody>() {
        return body.clone();
    }
    eprintln!("[model-worker] separation failed: {error:#}");
    ErrorBody::new(codes::INFERENCE_FAILED, "audio separation failed").with_details(json!({ "reason": "separation-failed" }))
}

fn write_failed(name: &str, detail: &str) -> ErrorBody {
    eprintln!("[model-worker] writing {name} failed: {detail}");
    ErrorBody::new(codes::OUTPUT_WRITE_FAILED, format!("could not write {name}")).with_details(json!({ "file": name }))
}

/// Writes to a temporary file first, then renames it. The path is absolute (staging is an absolute path).
fn write_output(staging: &Path, name: &str, bytes: &[u8]) -> std::io::Result<OutputFile> {
    let path = staging.join(name);
    let temporary = staging.join(format!("{name}.tmp"));
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::protocol::{Capability, STEMS_OUTPUT_CONTRACT, SeparateInput, SeparateOptions};
    use crate::separate::{ProgressSink, SeparatedStems};
    use anyhow::bail;
    use serde_json::Value;

    /// Fake model: 44.1 kHz; vocals = half of the mix, and drums / bass / other each take a third of the rest. `windows` windows × 4 sub-models.
    struct FakeSeparator {
        windows: usize,
        fail: bool,
        cancel_after: Option<(usize, &'static AtomicBool)>,
    }

    impl Separator for FakeSeparator {
        fn sample_rate(&self) -> u32 {
            44_100
        }

        fn separate(&mut self, mix: &StereoAudio, progress: ProgressSink<'_>) -> anyhow::Result<SeparatedStems> {
            if self.fail {
                bail!("权重坏了：/secret/path/htdemucs_ft.safetensors");
            }
            let mix = StereoAudio {
                left: resample(&mix.left, mix.sample_rate, 44_100),
                right: resample(&mix.right, mix.sample_rate, 44_100),
                sample_rate: 44_100,
            };
            let total = self.windows * 4;
            if !progress(SeparationProgress::Window { done: 0, total }) {
                bail!("已取消");
            }
            for done in 1..=total {
                if let Some((after, flag)) = self.cancel_after
                    && done > after
                {
                    flag.store(true, Ordering::SeqCst);
                }
                if !progress(SeparationProgress::Window { done, total }) {
                    bail!("已取消");
                }
            }
            let scale = |audio: &StereoAudio, k: f32| StereoAudio {
                left: audio.left.iter().map(|v| v * k).collect(),
                right: audio.right.iter().map(|v| v * k).collect(),
                sample_rate: audio.sample_rate,
            };
            Ok(SeparatedStems {
                vocals: scale(&mix, 0.5),
                drums: scale(&mix, 0.5 / 3.0),
                bass: scale(&mix, 0.5 / 3.0),
                other: scale(&mix, 0.5 / 3.0),
            })
        }
    }

    fn fake() -> FakeSeparator {
        FakeSeparator {
            windows: 2,
            fail: false,
            cancel_after: None,
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
    }

    /// 0.5 s of 48 kHz stereo: DC at 0.4 on the left and -0.2 on the right.
    fn input_wav(dir: &Path) -> std::path::PathBuf {
        let path = dir.join("input.wav");
        let audio = StereoAudio {
            left: vec![0.4; 24_000],
            right: vec![-0.2; 24_000],
            sample_rate: 48_000,
        };
        wav::write_wav_stereo_pcm16(&path, &audio).unwrap();
        path
    }

    fn params(file: &Path, staging: &Path, sample_rate: Option<u32>) -> SeparateRunParams {
        SeparateRunParams {
            job_id: "job_s".into(),
            run_generation: 1,
            capability: Capability::Separate,
            input: SeparateInput {
                file: file.to_string_lossy().into_owned(),
                content_hash: "sha256:ab".into(),
                track: 0,
            },
            options: SeparateOptions { sample_rate },
            staging: staging.to_string_lossy().into_owned(),
            output_contract: STEMS_OUTPUT_CONTRACT.into(),
        }
    }

    #[test]
    fn writes_vocals_and_background_at_the_requested_rate() {
        let dir = tempfile::tempdir().unwrap();
        let input = input_wav(dir.path());
        let mut events = Events::default();
        let cancel = AtomicBool::new(false);
        let result = run(&mut fake(), &params(&input, dir.path(), Some(48_000)), &cancel, &mut events).unwrap();
        assert_eq!(result.outcome, JobOutcome::Completed);
        assert_eq!(events.phases(), ["decoding", "separating", "encoding"]);
        let progress: Vec<(u64, u64)> = events
            .0
            .iter()
            .filter(|(name, _)| name == "job.progress")
            .map(|(_, p)| {
                assert_eq!((p["phase"].as_str(), p["unit"].as_str()), (Some("separating"), Some("steps")));
                (p["done"].as_u64().unwrap(), p["total"].as_u64().unwrap())
            })
            .collect();
        assert_eq!(progress.first(), Some(&(0, 8)));
        assert_eq!(progress.last(), Some(&(8, 8)));

        let audio = result.audio.unwrap();
        assert_eq!((audio.sample_rate, audio.channels), (48_000, 2));
        assert!((audio.duration_sec - 0.5).abs() < 1e-9, "{}", audio.duration_sec);
        let stems = result.stems.unwrap();
        for file in [&stems.vocals, &stems.background] {
            let bytes = std::fs::read(&file.path).unwrap();
            assert_eq!(file.byte_length, bytes.len() as u64);
            assert_eq!(file.sha256, sha256_hex(&bytes));
            let decoded = wav::decode_wav(&bytes).unwrap();
            assert_eq!(decoded.sample_rate, 48_000);
            assert_eq!(decoded.len(), 24_000);
            // Away from the edges it is DC: vocals and background each take half.
            let (left, right) = (decoded.left[12_000], decoded.right[12_000]);
            assert!((left - 0.2).abs() < 0.01 && (right + 0.1).abs() < 0.01, "{left} {right}");
        }
        assert!(stems.vocals.path.ends_with(VOCALS_OUTPUT_FILE));
        assert!(stems.background.path.ends_with(BACKGROUND_OUTPUT_FILE));
        assert!(!dir.path().join("vocals.wav.tmp").exists());
    }

    #[test]
    fn defaults_to_the_model_rate() {
        let dir = tempfile::tempdir().unwrap();
        let input = input_wav(dir.path());
        let result = run(
            &mut fake(),
            &params(&input, dir.path(), None),
            &AtomicBool::new(false),
            &mut Events::default(),
        )
        .unwrap();
        let audio = result.audio.unwrap();
        assert_eq!(audio.sample_rate, 44_100);
        assert!((audio.duration_sec - 0.5).abs() < 1e-4);
    }

    #[test]
    fn cancel_between_windows_writes_nothing() {
        static CANCEL: AtomicBool = AtomicBool::new(false);
        let dir = tempfile::tempdir().unwrap();
        let input = input_wav(dir.path());
        let mut separator = FakeSeparator {
            cancel_after: Some((3, &CANCEL)),
            ..fake()
        };
        let result = run(
            &mut separator,
            &params(&input, dir.path(), Some(48_000)),
            &CANCEL,
            &mut Events::default(),
        )
        .unwrap();
        assert_eq!(result.outcome, JobOutcome::Cancelled);
        assert!(result.stems.is_none() && result.audio.is_none());
        assert!(!dir.path().join(VOCALS_OUTPUT_FILE).exists());
        assert!(!dir.path().join(BACKGROUND_OUTPUT_FILE).exists());
    }

    #[test]
    fn errors_map_to_protocol_codes() {
        let dir = tempfile::tempdir().unwrap();
        let input = input_wav(dir.path());
        let cancel = AtomicBool::new(false);
        let failing = run(
            &mut FakeSeparator { fail: true, ..fake() },
            &params(&input, dir.path(), None),
            &cancel,
            &mut Events::default(),
        )
        .unwrap_err();
        assert_eq!(failing.code, codes::INFERENCE_FAILED);
        assert!(!failing.message.contains("/secret"), "{}", failing.message);

        let missing = run(
            &mut fake(),
            &params(&dir.path().join("missing.wav"), dir.path(), None),
            &cancel,
            &mut Events::default(),
        )
        .unwrap_err();
        assert_eq!(missing.code, codes::INPUT_UNREADABLE);

        let no_staging = run(
            &mut fake(),
            &params(&input, &dir.path().join("nope"), None),
            &cancel,
            &mut Events::default(),
        )
        .unwrap_err();
        assert_eq!(no_staging.code, codes::INVALID_PARAMS);

        // Output cannot be written to staging (simulated here with a directory occupying the temp file name): this is not a model failure, so it does not report `INFERENCE_FAILED`.
        let staging = dir.path().join("blocked");
        std::fs::create_dir_all(staging.join(format!("{VOCALS_OUTPUT_FILE}.tmp"))).unwrap();
        let unwritable = run(&mut fake(), &params(&input, &staging, None), &cancel, &mut Events::default()).unwrap_err();
        assert_eq!(unwritable.code, codes::OUTPUT_WRITE_FAILED);
        assert!(unwritable.retryable);
        assert_eq!(unwritable.details, Some(json!({ "file": VOCALS_OUTPUT_FILE })));
        assert!(!unwritable.message.contains(&*staging.to_string_lossy()), "{}", unwritable.message);
    }
}
