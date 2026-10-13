//! End-to-end: a real model bundle with real audio. It needs models installed on this machine and is ignored by default:
//!
//! ```sh
//! CUCCUT_TEST_MODELS_DIR="$HOME/Library/Application Support/CucCut/models" \
//!   cargo test -p model-worker --test transcription -- --ignored --test-threads=1 --nocapture
//! ```
//!
//! The tests whose names start with `candle_` run the same bundles on candle's CPU backend. They need `--features backend-candle` (and `--no-default-features` on Windows or Linux):
//!
//! ```sh
//! CUCCUT_TEST_MODELS_DIR=… cargo test -p model-worker --features backend-candle --test transcription \
//!   -- --ignored --test-threads=1 --nocapture candle_
//! ```

mod support;

use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};

use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use support::{
    MOSS_TRANSCRIBE_DIARIZE, QWEN3_ASR_1_7B, QWEN3_FORCED_ALIGNER, WESPEAKER, WHISPER_LARGE_V3, WHISPER_LARGE_V3_MLX,
    WHISPER_LARGE_V3_TURBO, WHISPER_LARGE_V3_TURBO_MLX, WHISPER_TOKENIZER_REPO, WhisperBundle, WhisperMlxBundle, WorkerProcess, error_code,
    fixture, installed_bundle, is_installed, moss_bundle, qwen3_asr_bundle, result, whisper_bundle, whisper_mlx_bundle, with_diarization,
    without_aligner,
};
#[cfg(feature = "backend-candle")]
use support::{MOSS_TRANSCRIBE_DIARIZE_CANDLE, QWEN3_ASR_0_6B, QWEN3_ASR_0_6B_CANDLE, QWEN3_ASR_1_7B_CANDLE, on_candle};

const LOAD_TIMEOUT: Duration = Duration::from_secs(300);
const JOB_TIMEOUT: Duration = Duration::from_secs(300);
const QUICK: Duration = Duration::from_secs(10);

fn models_root() -> PathBuf {
    PathBuf::from(std::env::var("CUCCUT_TEST_MODELS_DIR").expect("set CUCCUT_TEST_MODELS_DIR to the models root"))
}

fn sha256_hex(bytes: &[u8]) -> String {
    Sha256::digest(bytes).iter().map(|byte| format!("{byte:02x}")).collect()
}

fn loaded_worker() -> WorkerProcess {
    loaded_worker_with(installed_bundle(&models_root()))
}

fn loaded_worker_with(bundle: Value) -> WorkerProcess {
    loaded_worker_within(bundle, LOAD_TIMEOUT)
}

fn loaded_worker_within(bundle: Value, load_timeout: Duration) -> WorkerProcess {
    let bundle_id = bundle["bundleId"].clone();
    let backend = bundle["backend"].as_str().unwrap().to_owned();
    let mut worker = WorkerProcess::spawn();
    let (_, hello) = worker.call("worker.hello", json!({ "contractVersion": 1 }), QUICK);
    let status = result(&hello)["backends"]
        .as_array()
        .unwrap()
        .iter()
        .find(|status| status["id"] == backend.as_str())
        .cloned()
        .unwrap();
    assert_eq!(status["available"], true, "the {backend} backend must be available: {hello}");
    let started = Instant::now();
    let (events, response) = worker.call("model.load", json!({ "bundle": bundle }), load_timeout);
    let loaded = result(&response);
    assert_eq!(loaded["loaded"], true);
    let phases: Vec<&str> = events
        .iter()
        .filter(|event| event["event"] == "model.phase")
        .map(|event| event["params"]["phase"].as_str().unwrap())
        .collect();
    assert!(phases.contains(&"loading-weights") && phases.contains(&"warming-up"), "{phases:?}");
    eprintln!(
        "model.load: {:?} (warmupMs {}, residentBytes {})",
        started.elapsed(),
        loaded["warmupMs"],
        loaded["residentBytes"]
    );
    let (_, status) = worker.call("worker.status", json!({}), QUICK);
    assert_eq!(result(&status)["state"], "ready");
    assert_eq!(result(&status)["bundleId"], bundle_id);
    worker
}

fn job_params(job_id: &str, file: &Path, staging: &Path, language: Value, range: Option<Value>) -> Value {
    let bytes = std::fs::read(file).unwrap();
    let mut input = json!({ "file": file.to_string_lossy(), "contentHash": format!("sha256:{}", sha256_hex(&bytes)), "track": 0 });
    if let Some(range) = range {
        input["range"] = range;
    }
    json!({
        "jobId": job_id,
        "runGeneration": 7,
        "capability": "transcribe",
        "input": input,
        "options": { "language": language, "diarize": false, "timescale": 1_000_000 },
        "staging": staging.to_string_lossy(),
        "outputContract": "cuccut.asr-result/v1",
    })
}

fn normalized(text: &str) -> String {
    let lower: String = text
        .to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { ' ' })
        .collect();
    lower.split_whitespace().collect::<Vec<_>>().join(" ")
}

/// Read back `result.json`, check that its sha256 matches the response, and check all the timing properties. The backend is `mlx`.
fn check_output(response: &Value, staging: &Path) -> Value {
    check_output_on(response, staging, "mlx")
}

fn check_output_on(response: &Value, staging: &Path, backend: &str) -> Value {
    let run = result(response);
    assert_eq!(run["outcome"], "completed");
    let output = &run["output"];
    let path = PathBuf::from(output["path"].as_str().unwrap());
    assert_eq!(path, staging.join("result.json"));
    let bytes = std::fs::read(&path).unwrap();
    assert_eq!(output["sha256"], sha256_hex(&bytes));
    assert_eq!(output["byteLength"], bytes.len() as u64);
    let asr: Value = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(asr["schema"], "cuccut.asr-result/v1");
    assert_eq!(asr["clock"], "source-asset");
    assert_eq!(asr["timescale"], 1_000_000);
    assert_eq!(asr["provenance"]["runGeneration"], 7);
    assert_eq!(asr["provenance"]["backend"], backend);

    // When the bundle carries an aligner, word timing comes from alignment (no alignment failure should occur). Otherwise it is estimated from character length.
    let timing = if asr["provenance"]["models"]["aligner"].is_object() {
        "aligned"
    } else {
        "estimated"
    };
    assert!(
        asr["warnings"]
            .as_array()
            .unwrap()
            .iter()
            .all(|warning| warning["code"] != "alignment-failed"),
        "{}",
        asr["warnings"]
    );
    let duration = asr["duration"].as_u64().unwrap();
    let mut previous_end = 0;
    for segment in asr["segments"].as_array().unwrap() {
        let (start, end) = (segment["start"].as_u64().unwrap(), segment["end"].as_u64().unwrap());
        assert!(previous_end <= start && start < end && end <= duration, "{segment}");
        previous_end = end;
        let mut previous_word_end = start;
        for word in segment["words"].as_array().unwrap() {
            assert!(word["timingQuality"].is_string(), "{word}");
            assert_eq!(word["timingQuality"], timing, "{word}");
            let (word_start, word_end) = (word["start"].as_u64().unwrap(), word["end"].as_u64().unwrap());
            assert!(
                previous_word_end <= word_start && word_start <= word_end && word_end <= end,
                "{word} in {segment}"
            );
            previous_word_end = word_end;
        }
    }

    // segments.jsonl: a header plus the same segments as the result. Speaker diarization runs after recognition, so the streamed segments carry no speaker.
    let segments_file = run["segmentsFile"].as_str().unwrap();
    let lines: Vec<Value> = std::fs::read_to_string(segments_file)
        .unwrap()
        .lines()
        .map(|line| serde_json::from_str(line).unwrap())
        .collect();
    assert_eq!(lines[0]["header"], true);
    assert_eq!(lines[0]["timescale"], 1_000_000);
    assert_eq!(lines[0]["bundleId"], asr["provenance"]["bundleId"]);
    let mut segments = asr["segments"].clone();
    for segment in segments.as_array_mut().unwrap() {
        segment["speakerId"] = Value::Null;
        for word in segment["words"].as_array_mut().unwrap() {
            word.as_object_mut().unwrap().remove("speakerId");
        }
    }
    assert_eq!(&lines[1..], segments.as_array().unwrap().as_slice());
    asr
}

fn transcript(asr: &Value) -> String {
    asr["segments"]
        .as_array()
        .unwrap()
        .iter()
        .map(|segment| segment["text"].as_str().unwrap())
        .collect::<Vec<_>>()
        .join(" ")
}

#[test]
#[ignore = "needs CUCCUT_TEST_MODELS_DIR with the Qwen3-ASR and Silero bundles installed"]
fn transcribes_the_english_and_chinese_fixtures() {
    let mut worker = loaded_worker();

    // ---- English, language auto-detected ----
    let staging = tempfile::tempdir().unwrap();
    let started = Instant::now();
    let params = job_params(
        "job-en",
        &fixture("test-sample.wav"),
        staging.path(),
        json!({ "mode": "prefer", "tag": null }),
        None,
    );
    let (events, response) = worker.call("job.run", params, JOB_TIMEOUT);
    let elapsed = started.elapsed();
    let asr = check_output(&response, staging.path());
    assert_eq!(asr["outcome"], "transcribed");
    let text = transcript(&asr);
    let normal = normalized(&text);
    assert!(normal.contains("testing one two three"), "{text}");
    assert!(normal.contains("is ready"), "{text}");
    assert_eq!(asr["language"]["tag"], "en");
    assert_eq!(asr["language"]["source"], "detected");
    assert_eq!(
        asr["provenance"]["models"]["aligner"].is_object(),
        is_installed(&models_root(), QWEN3_FORCED_ALIGNER),
        "the optional aligner is used exactly when it is installed"
    );
    let duration_ticks = asr["duration"].as_u64().unwrap();
    assert!((3_600_000..=3_700_000).contains(&duration_ticks), "{duration_ticks}");
    assert_eq!(asr["coverage"], json!([{ "start": 0, "end": duration_ticks }]));

    let names: Vec<&str> = events.iter().map(|event| event["event"].as_str().unwrap()).collect();
    for expected in ["job.phase", "job.progress", "job.segment", "job.language"] {
        assert!(names.contains(&expected), "missing {expected}: {names:?}");
    }
    assert_eq!(names.iter().filter(|name| **name == "job.language").count(), 1);
    let phases: Vec<&str> = events
        .iter()
        .filter(|event| event["event"] == "job.phase")
        .map(|event| event["params"]["phase"].as_str().unwrap())
        .collect();
    assert_eq!(phases, ["decoding", "vad", "transcribing", "finalizing"]);

    let stats = &result(&response)["stats"];
    let words: usize = asr["segments"]
        .as_array()
        .unwrap()
        .iter()
        .map(|segment| segment["words"].as_array().unwrap().len())
        .sum();
    eprintln!("---- test-sample.wav ----");
    eprintln!("text: {text}");
    eprintln!(
        "segments: {}, words: {words}, duration: {duration_ticks} ticks, wall: {elapsed:?}",
        asr["segments"].as_array().unwrap().len()
    );
    eprintln!("stats: {stats}");
    for segment in asr["segments"].as_array().unwrap() {
        eprintln!(
            "  {} [{} – {}] {}",
            segment["id"], segment["start"], segment["end"], segment["text"]
        );
    }

    // ---- One segment of the same audio: ticks are still on the media clock ----
    let staging = tempfile::tempdir().unwrap();
    let range = json!({ "start": 1_000, "end": 3_680, "timescale": 1_000 });
    let mut params = job_params(
        "job-range",
        &fixture("test-sample.wav"),
        staging.path(),
        json!({ "mode": "assert", "tag": "en" }),
        Some(range),
    );
    params["options"]["hint"] = json!("CucCut");
    let (_, response) = worker.call("job.run", params, JOB_TIMEOUT);
    let ranged = check_output(&response, staging.path());
    assert_eq!(ranged["language"], json!({ "tag": "en", "source": "asserted", "confidence": null }));
    assert_eq!(ranged["coverage"][0]["start"], 1_000_000);
    for segment in ranged["segments"].as_array().unwrap() {
        assert!(segment["start"].as_u64().unwrap() >= 1_000_000, "{segment}");
    }
    // The terminology hint goes into the system segment. Without it, the 0.6B model often hears the product name as “Baeocut”.
    assert!(
        normalized(&transcript(&ranged)).contains("cuccut is ready"),
        "{}",
        transcript(&ranged)
    );
    eprintln!(
        "range [1.0 s, 3.68 s] with hint \"CucCut\": {} (coverage {})",
        transcript(&ranged),
        ranged["coverage"]
    );

    // ---- Chinese ----
    let staging = tempfile::tempdir().unwrap();
    let params = job_params(
        "job-zh",
        &fixture("chinese-sample.wav"),
        staging.path(),
        json!({ "mode": "prefer", "tag": null }),
        None,
    );
    let (_, response) = worker.call("job.run", params, JOB_TIMEOUT);
    let chinese = check_output(&response, staging.path());
    assert_eq!(chinese["outcome"], "transcribed");
    assert_eq!(chinese["language"]["tag"], "zh");
    eprintln!(
        "---- chinese-sample.wav ----\ntext: {}\nstats: {}",
        transcript(&chinese),
        result(&response)["stats"]
    );

    let (_, response) = worker.call("worker.status", json!({}), QUICK);
    let status = result(&response);
    assert_eq!(status["state"], "ready");
    assert!(status["memory"]["active"].as_u64().is_some_and(|bytes| bytes > 0), "{status}");

    let (_, response) = worker.call("model.unload", json!({}), QUICK);
    assert_eq!(result(&response)["unloaded"], true);
    worker.close_stdin();
    assert!(worker.wait_exit(Duration::from_secs(5)).is_some_and(|status| status.success()));
}

#[test]
#[ignore = "needs CUCCUT_TEST_MODELS_DIR with the Qwen3-ASR and Silero bundles installed"]
fn cancel_stops_at_the_next_segment_boundary() {
    // Concatenate the English sample 10 times (about 37 seconds), so that segments are still left when it is cancelled.
    let media = tempfile::tempdir().unwrap();
    let long = media.path().join("long.wav");
    let mut reader = hound::WavReader::open(fixture("test-sample.wav")).unwrap();
    let spec = reader.spec();
    let samples: Vec<i16> = reader.samples::<i16>().map(Result::unwrap).collect();
    let mut writer = hound::WavWriter::create(&long, spec).unwrap();
    for _ in 0..10 {
        for sample in &samples {
            writer.write_sample(*sample).unwrap();
        }
    }
    writer.finalize().unwrap();

    let mut worker = loaded_worker();
    let staging = tempfile::tempdir().unwrap();
    let run_id = worker.send(
        "job.run",
        job_params("job-cancel", &long, staging.path(), json!({ "mode": "prefer", "tag": null }), None),
    );
    // Wait for the first segment to come out before cancelling.
    loop {
        let message = worker.next(JOB_TIMEOUT);
        assert_ne!(
            message.get("id").and_then(Value::as_u64),
            Some(run_id),
            "the job finished before it could be cancelled: {message}"
        );
        if message["event"] == "job.segment" {
            break;
        }
    }
    let (_, status) = worker.call("worker.status", json!({}), QUICK);
    assert_eq!(result(&status)["state"], "busy");
    assert_eq!(result(&status)["job"]["jobId"], "job-cancel");
    assert_eq!(result(&status)["job"]["phase"], "transcribing");

    let cancel_id = worker.send("job.cancel", json!({ "jobId": "job-cancel" }));
    let started = Instant::now();
    let (_, cancel) = worker.response(cancel_id, QUICK);
    assert_eq!(result(&cancel), &json!({ "acknowledged": true }));
    let (_, response) = worker.response(run_id, JOB_TIMEOUT);
    let run = result(&response);
    eprintln!("cancelled after {:?}: {run}", started.elapsed());
    assert_eq!(run["outcome"], "cancelled");
    assert_eq!(run["output"], Value::Null);
    assert!(!staging.path().join("result.json").exists());

    let (_, status) = worker.call("worker.status", json!({}), QUICK);
    assert_eq!(result(&status)["state"], "ready");
    assert_eq!(result(&status)["job"], Value::Null);
    let (_, response) = worker.call("job.cancel", json!({ "jobId": "job-cancel" }), QUICK);
    assert_eq!(error_code(&response), "NOT_FOUND");
}

/// Qwen3-ASR 1.7B (8-bit) uses the same loader as 0.6B. If it is not installed, print one line and skip, so the test still passes when the ignored tests run together.
#[test]
#[ignore = "needs CUCCUT_TEST_MODELS_DIR with the Qwen3-ASR 1.7B and Silero bundles installed"]
fn transcribes_with_the_larger_qwen3_asr() {
    let root = models_root();
    if !is_installed(&root, QWEN3_ASR_1_7B.1) {
        eprintln!("skipped: {} is not installed under {}", QWEN3_ASR_1_7B.1, root.display());
        return;
    }
    let mut worker = loaded_worker_with(qwen3_asr_bundle(&root, QWEN3_ASR_1_7B));

    let staging = tempfile::tempdir().unwrap();
    let params = job_params(
        "job-1.7b-en",
        &fixture("test-sample.wav"),
        staging.path(),
        json!({ "mode": "prefer", "tag": null }),
        None,
    );
    let started = Instant::now();
    let (_, response) = worker.call("job.run", params, JOB_TIMEOUT);
    let english = check_output(&response, staging.path());
    assert_eq!(english["provenance"]["bundleId"], QWEN3_ASR_1_7B.0);
    assert!(
        normalized(&transcript(&english)).contains("testing one two three"),
        "{}",
        transcript(&english)
    );
    assert_eq!(english["language"]["tag"], "en");
    assert_eq!(
        english["provenance"]["models"]["aligner"].is_object(),
        is_installed(&root, QWEN3_FORCED_ALIGNER)
    );
    eprintln!("1.7B test-sample.wav ({:?}): {}", started.elapsed(), transcript(&english));

    let staging = tempfile::tempdir().unwrap();
    let params = job_params(
        "job-1.7b-zh",
        &fixture("chinese-sample.wav"),
        staging.path(),
        json!({ "mode": "prefer", "tag": null }),
        None,
    );
    let (_, response) = worker.call("job.run", params, JOB_TIMEOUT);
    let chinese = check_output(&response, staging.path());
    assert_eq!(chinese["language"]["tag"], "zh");
    eprintln!("1.7B chinese-sample.wav: {}", transcript(&chinese));

    // The language table is the same as 0.6B's: Swahili is not recognized.
    let staging = tempfile::tempdir().unwrap();
    let params = job_params(
        "job-1.7b-sw",
        &fixture("test-sample.wav"),
        staging.path(),
        json!({ "mode": "assert", "tag": "sw" }),
        None,
    );
    let (_, response) = worker.call("job.run", params, QUICK);
    assert_eq!(error_code(&response), "MODEL_UNSUPPORTED");

    let (_, response) = worker.call("model.unload", json!({}), QUICK);
    assert_eq!(result(&response)["unloaded"], true);
}

fn align_params(job_id: &str, file: &Path, staging: &Path, tag: &str, text: &str) -> Value {
    let mut params = job_params(job_id, file, staging, json!({ "mode": "assert", "tag": tag }), None);
    params["capability"] = json!("align");
    params["options"] = json!({ "language": { "mode": "assert", "tag": tag }, "text": text, "timescale": 1_000_000 });
    params
}

/// `capability: 'align'`: re-time the recognized text. Segmentation looks only at pauses, sentence-final punctuation and segment length. The text does not change.
#[test]
#[ignore = "needs CUCCUT_TEST_MODELS_DIR with the Qwen3-ASR, Silero and forced aligner bundles installed"]
fn aligns_known_text_with_the_forced_aligner() {
    let root = models_root();
    if !is_installed(&root, QWEN3_FORCED_ALIGNER) {
        eprintln!("skipped: {QWEN3_FORCED_ALIGNER} is not installed under {}", root.display());
        return;
    }
    let mut worker = loaded_worker();
    let (_, hello) = worker.call("worker.hello", json!({ "contractVersion": 1 }), QUICK);
    assert!(
        result(&hello)["capabilities"].as_array().unwrap().iter().any(|c| c == "align"),
        "{hello}"
    );

    for (sample, tag, text) in [
        ("test-sample.wav", "en", "Testing, one two three. CucCut is ready!"),
        ("chinese-sample.wav", "zh", ""),
    ] {
        // The Chinese sample's text comes from the recognition result.
        let text = if text.is_empty() {
            let staging = tempfile::tempdir().unwrap();
            let params = job_params(
                "job-text",
                &fixture(sample),
                staging.path(),
                json!({ "mode": "assert", "tag": tag }),
                None,
            );
            let (_, response) = worker.call("job.run", params, JOB_TIMEOUT);
            transcript(&check_output(&response, staging.path()))
        } else {
            text.to_owned()
        };
        let staging = tempfile::tempdir().unwrap();
        let started = Instant::now();
        let params = align_params(&format!("job-align-{tag}"), &fixture(sample), staging.path(), tag, &text);
        let (events, response) = worker.call("job.run", params, JOB_TIMEOUT);
        let aligned = check_output(&response, staging.path());
        assert_eq!(aligned["outcome"], "transcribed");
        assert!(aligned["provenance"]["models"]["aligner"].is_object());
        assert_eq!(aligned["language"]["source"], "asserted");
        assert_eq!(normalized(&transcript(&aligned)), normalized(&text), "{}", transcript(&aligned));
        let phases: Vec<&str> = events
            .iter()
            .filter(|event| event["event"] == "job.phase")
            .map(|event| event["params"]["phase"].as_str().unwrap())
            .collect();
        assert_eq!(phases, ["decoding", "aligning", "finalizing"]);
        let stats = &result(&response)["stats"];
        assert_eq!(stats["vadMs"], 0);
        eprintln!("align {sample} ({:?}, stats {stats}):", started.elapsed());
        for segment in aligned["segments"].as_array().unwrap() {
            eprintln!("  [{} – {}] {}", segment["start"], segment["end"], segment["text"]);
        }
    }

    let (_, response) = worker.call("model.unload", json!({}), QUICK);
    assert_eq!(result(&response)["unloaded"], true);
}

/// The optional aligner is not installed: recognition still works, and word timing is estimated from character length. `align` reports MODEL_UNSUPPORTED.
#[test]
#[ignore = "needs CUCCUT_TEST_MODELS_DIR with the Qwen3-ASR and Silero bundles installed"]
fn transcribes_without_the_optional_aligner() {
    let mut worker = loaded_worker_with(without_aligner(installed_bundle(&models_root())));
    let staging = tempfile::tempdir().unwrap();
    let params = job_params(
        "job-no-aligner",
        &fixture("test-sample.wav"),
        staging.path(),
        json!({ "mode": "assert", "tag": "en" }),
        None,
    );
    let (_, response) = worker.call("job.run", params, JOB_TIMEOUT);
    let asr = check_output(&response, staging.path());
    assert!(asr["provenance"]["models"]["aligner"].is_null());
    assert!(
        normalized(&transcript(&asr)).contains("testing one two three"),
        "{}",
        transcript(&asr)
    );

    let staging = tempfile::tempdir().unwrap();
    let params = align_params(
        "job-align",
        &fixture("test-sample.wav"),
        staging.path(),
        "en",
        "Testing, one two three.",
    );
    let (_, response) = worker.call("job.run", params, QUICK);
    assert_eq!(error_code(&response), "MODEL_UNSUPPORTED");
    assert_eq!(response["error"]["details"]["reason"], "aligner-not-loaded");

    let (_, response) = worker.call("model.unload", json!({}), QUICK);
    assert_eq!(result(&response)["unloaded"], true);
}

/// The "testing one two three" in the sample: Whisper writes numbers as digits (`Testing 1, 2, 3`), so both forms count (same rule as the bundle's self-check `TRANSCRIBE_SELF_TEST`).
fn says_testing_one_two_three(text: &str) -> bool {
    let normal = normalized(text);
    normal.contains("testing one two three") || normal.contains("testing 1 2 3")
}

/// The Whisper (CoreML) bundle is fully installed: the `asr` repo, the tokenizer and Silero.
fn whisper_installed(root: &Path, (_, asr_repo, _): WhisperBundle) -> bool {
    whisper_repos_installed(root, asr_repo)
}

/// All the repos the Whisper bundle needs are installed: the `asr` repo, the tokenizer and Silero (same for Core ML and MLX).
fn whisper_repos_installed(root: &Path, asr_repo: &str) -> bool {
    [asr_repo, WHISPER_TOKENIZER_REPO, "aufklarer/Silero-VAD-v6.2.1-MLX"]
        .iter()
        .all(|repo| is_installed(root, repo))
}

/// One Whisper bundle: an English sample (language auto-detected, asserting the language the recognition hint gives), a Chinese sample, a language Whisper recognizes, and one it does not. If the optional aligner is installed, word timing comes from alignment (checked word by word in `check_output_on`). Otherwise it is estimated from character length. If it is not installed, print one line and skip.
/// `bundle` is the bundle's `model.load` parameters. `backend` is the backend expected in the result's provenance.
fn transcribes_with_whisper(bundle: Option<Value>, backend: &str) {
    let root = models_root();
    let Some(bundle) = bundle else {
        eprintln!("skipped: the Whisper bundle is not installed under {}", root.display());
        return;
    };
    let bundle_id = bundle["bundleId"].as_str().unwrap().to_owned();
    let mut worker = loaded_worker_with(bundle);

    let staging = tempfile::tempdir().unwrap();
    let params = job_params(
        "job-whisper-en",
        &fixture("test-sample.wav"),
        staging.path(),
        json!({ "mode": "prefer", "tag": null }),
        None,
    );
    let started = Instant::now();
    let (events, response) = worker.call("job.run", params, JOB_TIMEOUT);
    let elapsed = started.elapsed();
    let english = check_output_on(&response, staging.path(), backend);
    assert_eq!(english["outcome"], "transcribed");
    assert_eq!(english["provenance"]["bundleId"], bundle_id.as_str());
    assert_eq!(
        english["provenance"]["models"]["aligner"].is_object(),
        is_installed(&root, QWEN3_FORCED_ALIGNER)
    );
    let text = transcript(&english);
    assert!(says_testing_one_two_three(&text), "{text}");
    assert_eq!(english["language"]["tag"], "en");
    assert_eq!(english["language"]["source"], "detected");
    let phases: Vec<&str> = events
        .iter()
        .filter(|event| event["event"] == "job.phase")
        .map(|event| event["params"]["phase"].as_str().unwrap())
        .collect();
    assert_eq!(phases, ["decoding", "vad", "transcribing", "finalizing"]);
    eprintln!("{} test-sample.wav ({elapsed:?}): {text}", bundle_id);
    eprintln!("stats: {}", result(&response)["stats"]);

    // Asserted language, plus the recognition hint (used as the initial prompt).
    let staging = tempfile::tempdir().unwrap();
    let mut params = job_params(
        "job-whisper-hint",
        &fixture("test-sample.wav"),
        staging.path(),
        json!({ "mode": "assert", "tag": "en-US" }),
        None,
    );
    params["options"]["hint"] = json!("CucCut");
    let (_, response) = worker.call("job.run", params, JOB_TIMEOUT);
    let hinted = check_output_on(&response, staging.path(), backend);
    assert_eq!(
        hinted["language"],
        json!({ "tag": "en-US", "source": "asserted", "confidence": null })
    );
    let text = transcript(&hinted);
    assert!(says_testing_one_two_three(&text), "{text}");
    eprintln!("{} with hint \"CucCut\": {text}", bundle_id);

    let staging = tempfile::tempdir().unwrap();
    let params = job_params(
        "job-whisper-zh",
        &fixture("chinese-sample.wav"),
        staging.path(),
        json!({ "mode": "prefer", "tag": null }),
        None,
    );
    let (_, response) = worker.call("job.run", params, JOB_TIMEOUT);
    let chinese = check_output_on(&response, staging.path(), backend);
    assert_eq!(chinese["language"]["tag"], "zh");
    eprintln!("{} chinese-sample.wav: {}", bundle_id, transcript(&chinese));

    // Whisper's language table: Swahili is recognized (Qwen3-ASR does not recognize it), Filipino is not.
    let staging = tempfile::tempdir().unwrap();
    let params = job_params(
        "job-whisper-sw",
        &fixture("test-sample.wav"),
        staging.path(),
        json!({ "mode": "assert", "tag": "sw" }),
        None,
    );
    let (_, response) = worker.call("job.run", params, JOB_TIMEOUT);
    let swahili = check_output_on(&response, staging.path(), backend);
    assert_eq!(swahili["language"]["tag"], "sw");
    let staging = tempfile::tempdir().unwrap();
    let params = job_params(
        "job-whisper-fil",
        &fixture("test-sample.wav"),
        staging.path(),
        json!({ "mode": "assert", "tag": "fil" }),
        None,
    );
    let (_, response) = worker.call("job.run", params, QUICK);
    assert_eq!(error_code(&response), "MODEL_UNSUPPORTED");

    let (_, response) = worker.call("worker.status", json!({}), QUICK);
    assert_eq!(result(&response)["state"], "ready");
    let (_, response) = worker.call("model.unload", json!({}), QUICK);
    assert_eq!(result(&response)["unloaded"], true);
    worker.close_stdin();
    assert!(worker.wait_exit(Duration::from_secs(5)).is_some_and(|status| status.success()));
}

#[test]
#[ignore = "needs CUCCUT_TEST_MODELS_DIR with Whisper large-v3 (CoreML), its tokenizer and Silero installed"]
fn transcribes_with_whisper_large_v3() {
    let root = models_root();
    let bundle = whisper_installed(&root, WHISPER_LARGE_V3).then(|| whisper_bundle(&root, WHISPER_LARGE_V3));
    transcribes_with_whisper(bundle, "coreml");
}

#[test]
#[ignore = "needs CUCCUT_TEST_MODELS_DIR with Whisper large-v3-turbo (CoreML), its tokenizer and Silero installed"]
fn transcribes_with_whisper_large_v3_turbo() {
    let root = models_root();
    let bundle = whisper_installed(&root, WHISPER_LARGE_V3_TURBO).then(|| whisper_bundle(&root, WHISPER_LARGE_V3_TURBO));
    transcribes_with_whisper(bundle, "coreml");
}

/// The installed Whisper (MLX) bundle. `None` if it is not installed.
fn installed_whisper_mlx(root: &Path, whisper: WhisperMlxBundle) -> Option<Value> {
    whisper_repos_installed(root, whisper.1).then(|| whisper_mlx_bundle(root, whisper))
}

#[test]
#[ignore = "needs CUCCUT_TEST_MODELS_DIR with Whisper large-v3 (MLX), its tokenizer and Silero installed"]
fn transcribes_with_whisper_large_v3_mlx() {
    transcribes_with_whisper(installed_whisper_mlx(&models_root(), WHISPER_LARGE_V3_MLX), "mlx");
}

#[test]
#[ignore = "needs CUCCUT_TEST_MODELS_DIR with Whisper large-v3-turbo (MLX), its tokenizer and Silero installed"]
fn transcribes_with_whisper_large_v3_turbo_mlx() {
    transcribes_with_whisper(installed_whisper_mlx(&models_root(), WHISPER_LARGE_V3_TURBO_MLX), "mlx");
}

/// One Chinese and one English passage (a 1-second pause in between, so VAD splits them into two segments), language auto-detected, in both orders. The task's language comes from the first segment but is not forced onto the second, and each segment is recognized in its own language. Given a language, Whisper translates the other language into it. (v2 locked the first segment's language for the later segments, which is what happened.)
fn keeps_each_language_of_a_bilingual_recording(bundle: Value, backend: &str) {
    let mut worker = loaded_worker_with(bundle);
    let dir = tempfile::tempdir().unwrap();
    for (job_id, samples, first) in [
        ("job-zh-en", ["chinese-sample.wav", "test-sample.wav"], "zh"),
        ("job-en-zh", ["test-sample.wav", "chinese-sample.wav"], "en"),
    ] {
        let joined = joined_fixtures_with_gap(dir.path(), &format!("{job_id}.wav"), &samples, 1.0);
        let staging = tempfile::tempdir().unwrap();
        let params = job_params(job_id, &joined, staging.path(), json!({ "mode": "prefer", "tag": null }), None);
        let (events, response) = worker.call("job.run", params, JOB_TIMEOUT);
        let asr = check_output_on(&response, staging.path(), backend);
        eprintln!("{job_id} (language {}):", asr["language"]);
        print_segments(&asr);
        assert_eq!(asr["language"]["tag"], first);
        assert_eq!(asr["language"]["source"], "detected");
        assert_eq!(events.iter().filter(|event| event["event"] == "job.language").count(), 1);
        let texts: Vec<&str> = asr["segments"]
            .as_array()
            .unwrap()
            .iter()
            .map(|segment| segment["text"].as_str().unwrap())
            .collect();
        assert_eq!(texts.len(), 2, "{texts:?}");
        let (english, chinese) = if first == "en" {
            (texts[0], texts[1])
        } else {
            (texts[1], texts[0])
        };
        assert!(says_testing_one_two_three(english), "{texts:?}");
        assert!(chinese.chars().any(|c| ('\u{4e00}'..='\u{9fff}').contains(&c)), "{texts:?}");
    }
    let (_, response) = worker.call("model.unload", json!({}), QUICK);
    assert_eq!(result(&response)["unloaded"], true);
}

#[test]
#[ignore = "needs CUCCUT_TEST_MODELS_DIR with the Qwen3-ASR and Silero bundles installed"]
fn keeps_each_language_of_a_bilingual_recording_with_qwen3_asr() {
    keeps_each_language_of_a_bilingual_recording(installed_bundle(&models_root()), "mlx");
}

#[test]
#[ignore = "needs CUCCUT_TEST_MODELS_DIR with Whisper large-v3 (CoreML), its tokenizer and Silero installed"]
fn keeps_each_language_of_a_bilingual_recording_with_whisper_large_v3() {
    let root = models_root();
    if !whisper_installed(&root, WHISPER_LARGE_V3) {
        eprintln!("skipped: {} is not installed under {}", WHISPER_LARGE_V3.0, root.display());
        return;
    }
    keeps_each_language_of_a_bilingual_recording(whisper_bundle(&root, WHISPER_LARGE_V3), "coreml");
}

/// If MOSS is installed, load it (there is no warmup step, so `warmupMs` is 0). If it is not installed, return `None` and print one line.
fn loaded_moss_worker() -> Option<WorkerProcess> {
    loaded_moss_worker_with(|bundle| bundle, LOAD_TIMEOUT)
}

/// Same as [`loaded_moss_worker`], with the bundle first rewritten by `adapt` (backend swap).
fn loaded_moss_worker_with(adapt: impl FnOnce(Value) -> Value, load_timeout: Duration) -> Option<WorkerProcess> {
    let root = models_root();
    let asr_repo = MOSS_TRANSCRIBE_DIARIZE.1;
    if !is_installed(&root, asr_repo) {
        eprintln!("skipped: {asr_repo} is not installed under {}", root.display());
        return None;
    }
    let bundle = adapt(moss_bundle(&root));
    let bundle_id = bundle["bundleId"].clone();
    let mut worker = WorkerProcess::spawn();
    let (_, hello) = worker.call("worker.hello", json!({ "contractVersion": 1 }), QUICK);
    assert!(
        result(&hello)["transcribeFamilies"]
            .as_array()
            .unwrap()
            .iter()
            .any(|family| family == "moss-transcribe-diarize"),
        "{hello}"
    );
    let started = Instant::now();
    let (events, response) = worker.call("model.load", json!({ "bundle": bundle }), load_timeout);
    let loaded = result(&response);
    assert_eq!(loaded["loaded"], true);
    assert_eq!(loaded["warmupMs"], 0);
    let phases: Vec<&str> = events
        .iter()
        .filter(|event| event["event"] == "model.phase")
        .map(|event| event["params"]["phase"].as_str().unwrap())
        .collect();
    assert!(phases.contains(&"loading-weights"), "{phases:?}");
    eprintln!(
        "model.load {bundle_id}: {:?} (residentBytes {})",
        started.elapsed(),
        loaded["residentBytes"]
    );
    let (_, status) = worker.call("worker.status", json!({}), QUICK);
    assert_eq!(result(&status)["state"], "ready");
    assert_eq!(result(&status)["bundleId"], bundle_id);
    Some(worker)
}

/// The MOSS result: segments are ordered by time, and words fall inside their segments. Alignment is used only for lines longer than 5 seconds. Other lines estimate word timing from character length.
fn check_moss_output(response: &Value, staging: &Path) -> Value {
    check_moss_output_on(response, staging, MOSS_TRANSCRIBE_DIARIZE.0, "mlx")
}

fn check_moss_output_on(response: &Value, staging: &Path, bundle_id: &str, backend: &str) -> Value {
    let run = result(response);
    assert_eq!(run["outcome"], "completed");
    let path = PathBuf::from(run["output"]["path"].as_str().unwrap());
    let bytes = std::fs::read(&path).unwrap();
    assert_eq!(path, staging.join("result.json"));
    assert_eq!(run["output"]["sha256"], sha256_hex(&bytes));
    let asr: Value = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(asr["schema"], "cuccut.asr-result/v1");
    assert_eq!(asr["provenance"]["bundleId"], bundle_id);
    assert_eq!(asr["provenance"]["backend"], backend);
    assert!(asr["provenance"]["models"]["vad"].is_null());
    let duration = asr["duration"].as_u64().unwrap();
    let mut previous_end = 0;
    for segment in asr["segments"].as_array().unwrap() {
        let (start, end) = (segment["start"].as_u64().unwrap(), segment["end"].as_u64().unwrap());
        assert!(previous_end <= start && start < end && end <= duration, "{segment}");
        previous_end = end;
        let mut previous_word_end = start;
        for word in segment["words"].as_array().unwrap() {
            assert!(
                ["aligned", "estimated"].contains(&word["timingQuality"].as_str().unwrap()),
                "{word}"
            );
            let (word_start, word_end) = (word["start"].as_u64().unwrap(), word["end"].as_u64().unwrap());
            assert!(
                previous_word_end <= word_start && word_start <= word_end && word_end <= end,
                "{word} in {segment}"
            );
            previous_word_end = word_end;
        }
    }
    asr
}

fn moss_job(job_id: &str, file: &Path, staging: &Path, language: Value, diarize: bool) -> Value {
    let mut params = job_params(job_id, file, staging, language, None);
    params["options"]["diarize"] = json!(diarize);
    params
}

/// Concatenate several 16 kHz mono 16-bit samples end to end and write them to `dir/name`.
fn joined_fixtures(dir: &Path, name: &str, samples: &[&str]) -> PathBuf {
    joined_fixtures_with_gap(dir, name, samples, 0.0)
}

/// Same as [`joined_fixtures`], with `gap` seconds of silence inserted between the samples.
fn joined_fixtures_with_gap(dir: &Path, name: &str, samples: &[&str], gap: f64) -> PathBuf {
    let joined = dir.join(name);
    let spec = hound::WavSpec {
        channels: 1,
        sample_rate: 16_000,
        bits_per_sample: 16,
        sample_format: hound::SampleFormat::Int,
    };
    let mut writer = hound::WavWriter::create(&joined, spec).unwrap();
    for (index, sample) in samples.iter().enumerate() {
        if index > 0 {
            for _ in 0..(gap * 16_000.0) as usize {
                writer.write_sample(0i16).unwrap();
            }
        }
        let mut reader = hound::WavReader::open(fixture(sample)).unwrap();
        let spec = reader.spec();
        assert_eq!((spec.channels, spec.sample_rate, spec.bits_per_sample), (1, 16_000, 16), "{sample}");
        for value in reader.samples::<i16>() {
            writer.write_sample(value.unwrap()).unwrap();
        }
    }
    writer.finalize().unwrap();
    joined
}

fn print_segments(asr: &Value) {
    for segment in asr["segments"].as_array().unwrap() {
        eprintln!(
            "  [{} – {}] {} {}",
            segment["start"], segment["end"], segment["speakerId"], segment["text"]
        );
    }
}

/// MOSS: the English sample is auto-detected (digits written as numerals also count). It asserts the language and the recognition hint (MOSS has no hint channel, so it reports `hint-ignored`). Then the Chinese sample. Without speakers requested, there are no labels.
#[test]
#[ignore = "needs CUCCUT_TEST_MODELS_DIR with MOSS Transcribe Diarize installed"]
fn transcribes_with_moss() {
    let Some(mut worker) = loaded_moss_worker() else {
        return;
    };

    let staging = tempfile::tempdir().unwrap();
    let params = moss_job(
        "job-moss-en",
        &fixture("test-sample.wav"),
        staging.path(),
        json!({ "mode": "prefer", "tag": null }),
        false,
    );
    let started = Instant::now();
    let (events, response) = worker.call("job.run", params, JOB_TIMEOUT);
    let elapsed = started.elapsed();
    let english = check_moss_output(&response, staging.path());
    assert_eq!(english["outcome"], "transcribed");
    let text = transcript(&english);
    assert!(says_testing_one_two_three(&text), "{text}");
    assert!(english["speakers"].as_array().unwrap().is_empty());
    assert!(
        english["segments"]
            .as_array()
            .unwrap()
            .iter()
            .all(|segment| segment["speakerId"].is_null())
    );
    assert!(english["warnings"].as_array().unwrap().is_empty(), "{}", english["warnings"]);
    assert_eq!(english["language"]["tag"], "en");
    assert_eq!(english["language"]["source"], "detected");
    let phases: Vec<&str> = events
        .iter()
        .filter(|event| event["event"] == "job.phase")
        .map(|event| event["params"]["phase"].as_str().unwrap())
        .collect();
    assert_eq!(phases, ["decoding", "transcribing", "finalizing"]);
    eprintln!("MOSS test-sample.wav ({elapsed:?}, language {}): {text}", english["language"]);
    eprintln!("stats: {}", result(&response)["stats"]);
    let (_, status) = worker.call("worker.status", json!({}), QUICK);
    eprintln!("memory after the job: {}", result(&status)["memory"]);

    let staging = tempfile::tempdir().unwrap();
    let mut params = moss_job(
        "job-moss-hint",
        &fixture("test-sample.wav"),
        staging.path(),
        json!({ "mode": "assert", "tag": "en" }),
        false,
    );
    params["options"]["hint"] = json!("CucCut");
    let (_, response) = worker.call("job.run", params, JOB_TIMEOUT);
    let hinted = check_moss_output(&response, staging.path());
    assert_eq!(hinted["language"]["source"], "asserted");
    let codes: Vec<&Value> = hinted["warnings"]
        .as_array()
        .unwrap()
        .iter()
        .map(|warning| &warning["code"])
        .collect();
    assert_eq!(codes, [&json!("hint-ignored")]);
    let text = transcript(&hinted);
    assert!(says_testing_one_two_three(&text), "{text}");
    eprintln!("MOSS asserted en with a hint: {text}");

    let staging = tempfile::tempdir().unwrap();
    let params = moss_job(
        "job-moss-zh",
        &fixture("chinese-sample.wav"),
        staging.path(),
        json!({ "mode": "prefer", "tag": null }),
        false,
    );
    let (_, response) = worker.call("job.run", params, JOB_TIMEOUT);
    let chinese = check_moss_output(&response, staging.path());
    assert_eq!(chinese["outcome"], "transcribed");
    assert!(
        transcript(&chinese).chars().any(|c| ('\u{4e00}'..='\u{9fff}').contains(&c)),
        "{}",
        transcript(&chinese)
    );
    eprintln!("MOSS chinese-sample.wav: {}", transcript(&chinese));

    // The same person speaking twice in a row: lines longer than 5 seconds (if the model provides them) are force-aligned within the line window. Others are estimated from character length.
    let dir = tempfile::tempdir().unwrap();
    let twice = joined_fixtures(dir.path(), "twice.wav", &["test-sample.wav", "test-sample.wav"]);
    let staging = tempfile::tempdir().unwrap();
    let params = moss_job(
        "job-moss-twice",
        &twice,
        staging.path(),
        json!({ "mode": "prefer", "tag": null }),
        false,
    );
    let (_, response) = worker.call("job.run", params, JOB_TIMEOUT);
    let twice = check_moss_output(&response, staging.path());
    eprintln!(
        "MOSS twice.wav: warnings {}, stats {}",
        twice["warnings"],
        result(&response)["stats"]
    );
    print_segments(&twice);
    let long = twice["segments"]
        .as_array()
        .unwrap()
        .iter()
        .filter(|segment| segment["end"].as_u64().unwrap() - segment["start"].as_u64().unwrap() > 5_000_000)
        .count();
    assert_eq!(
        twice["provenance"]["models"]["aligner"].is_object(),
        long > 0 && is_installed(&models_root(), QWEN3_FORCED_ALIGNER)
    );
    if long > 0 && is_installed(&models_root(), QWEN3_FORCED_ALIGNER) {
        assert!(twice["warnings"].as_array().unwrap().is_empty(), "{}", twice["warnings"]);
        let aligned = twice["segments"]
            .as_array()
            .unwrap()
            .iter()
            .flat_map(|segment| segment["words"].as_array().unwrap())
            .filter(|word| word["timingQuality"] == "aligned")
            .count();
        assert!(aligned > 0);
    }

    // `align` also works on MOSS bundles: the aligner is loaded on demand.
    if is_installed(&models_root(), QWEN3_FORCED_ALIGNER) {
        let staging = tempfile::tempdir().unwrap();
        let text = "Testing, one two three. CucCut is ready!";
        let params = align_params("job-moss-align", &fixture("test-sample.wav"), staging.path(), "en", text);
        let (_, response) = worker.call("job.run", params, JOB_TIMEOUT);
        let aligned = check_output(&response, staging.path());
        assert!(aligned["provenance"]["models"]["aligner"].is_object());
        assert_eq!(normalized(&transcript(&aligned)), normalized(text));
    }

    let (_, response) = worker.call("model.unload", json!({}), QUICK);
    assert_eq!(result(&response)["unloaded"], true);
    worker.close_stdin();
    assert!(worker.wait_exit(Duration::from_secs(5)).is_some_and(|status| status.success()));
}

/// Two speakers: the English sample followed by the Chinese sample (a temporary file assembled during the test). When speakers are requested, at least two people must be separated. If the speaker model is installed, it is used to merge speakers (`provenance.models.speaker`).
#[test]
#[ignore = "needs CUCCUT_TEST_MODELS_DIR with MOSS Transcribe Diarize installed"]
fn diarizes_two_speakers_with_moss() {
    let Some(mut worker) = loaded_moss_worker() else {
        return;
    };
    let dir = tempfile::tempdir().unwrap();
    let joined = joined_fixtures(dir.path(), "two-speakers.wav", &["test-sample.wav", "chinese-sample.wav"]);

    let staging = tempfile::tempdir().unwrap();
    let params = moss_job(
        "job-moss-diarize",
        &joined,
        staging.path(),
        json!({ "mode": "prefer", "tag": null }),
        true,
    );
    let started = Instant::now();
    let (events, response) = worker.call("job.run", params, JOB_TIMEOUT);
    let elapsed = started.elapsed();
    let asr = check_moss_output(&response, staging.path());
    eprintln!("MOSS two-speakers.wav ({elapsed:?}): warnings {}", asr["warnings"]);
    print_segments(&asr);
    eprintln!("stats: {}", result(&response)["stats"]);
    let speakers: std::collections::BTreeSet<&str> = asr["segments"]
        .as_array()
        .unwrap()
        .iter()
        .filter_map(|segment| segment["speakerId"].as_str())
        .collect();
    assert!(speakers.len() >= 2, "expected two speakers: {speakers:?}");
    assert_eq!(asr["speakers"].as_array().unwrap().len(), speakers.len());
    assert_eq!(
        asr["provenance"]["models"]["speaker"].is_object(),
        is_installed(&models_root(), WESPEAKER)
    );
    let phases: Vec<&str> = events
        .iter()
        .filter(|event| event["event"] == "job.phase")
        .map(|event| event["params"]["phase"].as_str().unwrap())
        .collect();
    assert_eq!(phases.first(), Some(&"decoding"));
    assert!(phases.contains(&"diarizing"), "{phases:?}");
    let (_, status) = worker.call("worker.status", json!({}), QUICK);
    eprintln!("memory after the job: {}", result(&status)["memory"]);

    // The next job still recognizes as usual. Under memory pressure, MOSS is unloaded before the speaker model is loaded, so it is reloaded here. `CUCCUT_MEMORY_PRESSURE` can simulate this.
    let staging = tempfile::tempdir().unwrap();
    let params = moss_job(
        "job-moss-again",
        &joined,
        staging.path(),
        json!({ "mode": "prefer", "tag": null }),
        false,
    );
    let (_, response) = worker.call("job.run", params, JOB_TIMEOUT);
    let again = check_moss_output(&response, staging.path());
    assert!(again["speakers"].as_array().unwrap().is_empty());
    assert!(says_testing_one_two_three(&transcript(&again)), "{}", transcript(&again));
    eprintln!("MOSS two-speakers.wav without speakers: {}", transcript(&again));

    let (_, response) = worker.call("model.unload", json!({}), QUICK);
    assert_eq!(result(&response)["unloaded"], true);
}

/// Speaker diarization (Pyannote + WeSpeaker): the English sample, 1 second of silence, then the Chinese sample (two people, assembled during the test). After recognition, exactly two people must be separated: the words in the English sample are `spk-1` and those in the Chinese sample are `spk-2`, checked word by word. A pause is needed in between. If the two samples are joined head to tail, VAD cuts them into one segment, and within that segment, English followed by Chinese with no pause, both recognition models judge it to be Chinese and drop the English (a limitation of the models, same in v2). The same Worker then runs again without speakers: the text is the same, with no speaker labels.
/// If the speaker-diarization bundle or the recognition bundle is not installed, print one line and skip.
fn diarizes_two_speakers_with(bundle: Option<Value>, backend: &str, timeout: Duration) {
    let root = models_root();
    let Some(bundle) = bundle.and_then(|bundle| with_diarization(&root, bundle)) else {
        eprintln!(
            "skipped: the speech recognition or speaker diarization models are not installed under {}",
            root.display()
        );
        return;
    };
    let bundle_id = bundle["bundleId"].as_str().unwrap().to_owned();
    let mut worker = loaded_worker_within(bundle, timeout);
    let dir = tempfile::tempdir().unwrap();
    let joined = joined_fixtures_with_gap(dir.path(), "two-speakers.wav", &["test-sample.wav", "chinese-sample.wav"], 1.0);
    let english_end = hound::WavReader::open(fixture("test-sample.wav")).unwrap().duration() as u64 * 1_000_000 / 16_000;

    let staging = tempfile::tempdir().unwrap();
    let mut params = job_params(
        "job-diarize",
        &joined,
        staging.path(),
        json!({ "mode": "prefer", "tag": null }),
        None,
    );
    params["options"]["diarize"] = json!(true);
    let started = Instant::now();
    let (events, response) = worker.call("job.run", params, timeout);
    let elapsed = started.elapsed();
    let asr = check_output_on(&response, staging.path(), backend);
    eprintln!(
        "{bundle_id} two-speakers.wav with speakers ({elapsed:?}): warnings {}",
        asr["warnings"]
    );
    print_segments(&asr);
    eprintln!("stats: {}", result(&response)["stats"]);
    let (_, status) = worker.call("worker.status", json!({}), QUICK);
    eprintln!("memory after the job: {}", result(&status)["memory"]);

    assert!(asr["warnings"].as_array().unwrap().is_empty(), "{}", asr["warnings"]);
    let phases: Vec<&str> = events
        .iter()
        .filter(|event| event["event"] == "job.phase")
        .map(|event| event["params"]["phase"].as_str().unwrap())
        .collect();
    assert_eq!(phases, ["decoding", "vad", "transcribing", "diarizing", "finalizing"]);
    assert!(asr["provenance"]["models"]["segmentation"].is_object(), "{}", asr["provenance"]);
    assert!(asr["provenance"]["models"]["speaker"].is_object(), "{}", asr["provenance"]);
    assert_eq!(
        asr["speakers"],
        json!([{ "id": "spk-1", "label": null }, { "id": "spk-2", "label": null }]),
        "expected exactly two speakers"
    );
    // Words more than 0.3 seconds away from the seam are checked against the sample they come from. Both samples must contain words.
    let mut seen = std::collections::BTreeSet::new();
    for segment in asr["segments"].as_array().unwrap() {
        assert!(["spk-1", "spk-2"].contains(&segment["speakerId"].as_str().unwrap()), "{segment}");
        for word in segment["words"].as_array().unwrap() {
            let (start, end) = (word["start"].as_u64().unwrap(), word["end"].as_u64().unwrap());
            let expected = if end + 300_000 <= english_end {
                "spk-1"
            } else if start >= english_end + 300_000 {
                "spk-2"
            } else {
                continue;
            };
            assert_eq!(word["speakerId"], expected, "{word}");
            seen.insert(expected);
        }
    }
    assert_eq!(seen.len(), 2, "both samples have words");

    let staging = tempfile::tempdir().unwrap();
    let params = job_params(
        "job-no-diarize",
        &joined,
        staging.path(),
        json!({ "mode": "prefer", "tag": null }),
        None,
    );
    let (_, response) = worker.call("job.run", params, timeout);
    let plain = check_output_on(&response, staging.path(), backend);
    assert!(plain["speakers"].as_array().unwrap().is_empty());
    assert!(plain["provenance"]["models"]["segmentation"].is_null());
    assert!(
        plain["segments"]
            .as_array()
            .unwrap()
            .iter()
            .all(|segment| segment["speakerId"].is_null())
    );
    assert_eq!(transcript(&plain), transcript(&asr));

    let (_, response) = worker.call("model.unload", json!({}), QUICK);
    assert_eq!(result(&response)["unloaded"], true);
}

#[test]
#[ignore = "needs CUCCUT_TEST_MODELS_DIR with Qwen3-ASR 0.6B, Silero and the speaker diarization pack installed"]
fn diarizes_two_speakers_with_qwen3_asr() {
    let root = models_root();
    let bundle = is_installed(&root, support::QWEN3_ASR_0_6B.1).then(|| installed_bundle(&root));
    diarizes_two_speakers_with(bundle, "mlx", JOB_TIMEOUT);
}

#[test]
#[ignore = "needs CUCCUT_TEST_MODELS_DIR with Whisper large-v3 (CoreML), its tokenizer, Silero and the speaker diarization pack installed"]
fn diarizes_two_speakers_with_whisper_large_v3() {
    let root = models_root();
    let bundle = whisper_installed(&root, WHISPER_LARGE_V3).then(|| whisper_bundle(&root, WHISPER_LARGE_V3));
    diarizes_two_speakers_with(bundle, "coreml", JOB_TIMEOUT);
}

/// On CPU, candle is an order of magnitude slower than Metal for both loading and recognition (the 1.7B model dequantized to f32 is about 7 GiB).
#[cfg(feature = "backend-candle")]
const CANDLE_TIMEOUT: Duration = Duration::from_secs(1_800);

/// The Worker process's current resident memory (candle's `worker.status.memory.active`).
#[cfg(feature = "backend-candle")]
fn rss_gib(worker: &mut WorkerProcess) -> String {
    let (_, status) = worker.call("worker.status", json!({}), QUICK);
    let memory = &result(&status)["memory"];
    let gib = |value: &Value| value.as_u64().map_or(f64::NAN, |bytes| bytes as f64 / (1u64 << 30) as f64);
    format!("rss {:.2} GiB, peak {:.2} GiB", gib(&memory["active"]), gib(&memory["peak"]))
}

/// Qwen3-ASR on candle (CPU): `worker.hello` reports candle available, device `cpu`, both recognition families and `align`. The English and Chinese samples are recognized. If the aligner is installed, word timing is aligned, and `align` is used to time known text.
#[cfg(feature = "backend-candle")]
fn candle_transcribes_with(bundle_id: &str, asr: (&str, &str)) {
    let root = models_root();
    if !is_installed(&root, asr.1) {
        eprintln!("skipped: {} is not installed under {}", asr.1, root.display());
        return;
    }
    let mut probe = WorkerProcess::spawn();
    let (_, hello) = probe.call("worker.hello", json!({ "contractVersion": 1 }), QUICK);
    let hello = result(&hello);
    let candle = hello["backends"]
        .as_array()
        .unwrap()
        .iter()
        .find(|status| status["id"] == "candle")
        .unwrap();
    assert_eq!(candle["available"], true, "{hello}");
    assert_eq!(candle["devices"].as_array().unwrap().last(), Some(&json!("cpu")), "{hello}");
    for family in ["qwen3-asr", "moss-transcribe-diarize"] {
        assert!(
            hello["transcribeFamilies"].as_array().unwrap().iter().any(|f| f == family),
            "{hello}"
        );
    }
    assert!(hello["capabilities"].as_array().unwrap().iter().any(|c| c == "align"), "{hello}");
    drop(probe);

    let started = Instant::now();
    let mut worker = loaded_worker_within(on_candle(qwen3_asr_bundle(&root, asr), bundle_id), CANDLE_TIMEOUT);
    eprintln!("{bundle_id} loaded in {:?}; {}", started.elapsed(), rss_gib(&mut worker));

    for (sample, tag, job) in [
        ("test-sample.wav", "en", "job-candle-en"),
        ("chinese-sample.wav", "zh", "job-candle-zh"),
    ] {
        let staging = tempfile::tempdir().unwrap();
        let params = job_params(
            job,
            &fixture(sample),
            staging.path(),
            json!({ "mode": "prefer", "tag": null }),
            None,
        );
        let started = Instant::now();
        let (_, response) = worker.call("job.run", params, CANDLE_TIMEOUT);
        let elapsed = started.elapsed();
        let asr_result = check_output_on(&response, staging.path(), "candle");
        assert_eq!(asr_result["provenance"]["bundleId"], bundle_id);
        assert_eq!(asr_result["provenance"]["device"], "cpu");
        assert_eq!(asr_result["outcome"], "transcribed");
        assert_eq!(asr_result["language"]["tag"], tag);
        assert_eq!(
            asr_result["provenance"]["models"]["aligner"].is_object(),
            is_installed(&root, QWEN3_FORCED_ALIGNER)
        );
        let text = transcript(&asr_result);
        if tag == "en" {
            assert!(normalized(&text).contains("testing one two three"), "{text}");
        } else {
            assert!(text.chars().any(|c| ('\u{4e00}'..='\u{9fff}').contains(&c)), "{text}");
        }
        eprintln!("{bundle_id} {sample} ({elapsed:?}; {}): {text}", rss_gib(&mut worker));
        eprintln!("stats: {}", result(&response)["stats"]);
    }

    if is_installed(&root, QWEN3_FORCED_ALIGNER) {
        let staging = tempfile::tempdir().unwrap();
        let text = "Testing, one two three. CucCut is ready!";
        let params = align_params("job-candle-align", &fixture("test-sample.wav"), staging.path(), "en", text);
        let started = Instant::now();
        let (_, response) = worker.call("job.run", params, CANDLE_TIMEOUT);
        let aligned = check_output_on(&response, staging.path(), "candle");
        assert!(aligned["provenance"]["models"]["aligner"].is_object());
        assert_eq!(normalized(&transcript(&aligned)), normalized(text));
        let words: Vec<&Value> = aligned["segments"]
            .as_array()
            .unwrap()
            .iter()
            .flat_map(|segment| segment["words"].as_array().unwrap())
            .collect();
        assert!(!words.is_empty() && words.iter().all(|word| word["timingQuality"] == "aligned"));
        eprintln!("{bundle_id} align ({:?}):", started.elapsed());
        for word in words {
            eprintln!("  [{} – {}] {}", word["start"], word["end"], word["text"]);
        }
    }

    let (_, response) = worker.call("model.unload", json!({}), QUICK);
    assert_eq!(result(&response)["unloaded"], true);
}

#[cfg(feature = "backend-candle")]
#[test]
#[ignore = "needs CUCCUT_TEST_MODELS_DIR with the Qwen3-ASR 0.6B and Silero bundles installed"]
fn candle_transcribes_with_qwen3_asr_0_6b() {
    candle_transcribes_with(QWEN3_ASR_0_6B_CANDLE, QWEN3_ASR_0_6B);
}

#[cfg(feature = "backend-candle")]
#[test]
#[ignore = "needs CUCCUT_TEST_MODELS_DIR with the Qwen3-ASR 1.7B and Silero bundles installed; about 8 GiB of RAM"]
fn candle_transcribes_with_qwen3_asr_1_7b() {
    candle_transcribes_with(QWEN3_ASR_1_7B_CANDLE, QWEN3_ASR_1_7B);
}

/// MOSS on candle (CPU): the English sample is recognized. The two-person sample (English followed by Chinese) separates at least two speakers (if the speaker model is installed, it is used to merge them).
#[cfg(feature = "backend-candle")]
#[test]
#[ignore = "needs CUCCUT_TEST_MODELS_DIR with MOSS Transcribe Diarize installed"]
fn candle_transcribes_and_diarizes_with_moss() {
    let started = Instant::now();
    let Some(mut worker) = loaded_moss_worker_with(|bundle| on_candle(bundle, MOSS_TRANSCRIBE_DIARIZE_CANDLE), CANDLE_TIMEOUT) else {
        return;
    };
    eprintln!("MOSS (candle) loaded in {:?}; {}", started.elapsed(), rss_gib(&mut worker));

    let staging = tempfile::tempdir().unwrap();
    let params = moss_job(
        "job-candle-moss-en",
        &fixture("test-sample.wav"),
        staging.path(),
        json!({ "mode": "prefer", "tag": null }),
        false,
    );
    let started = Instant::now();
    let (_, response) = worker.call("job.run", params, CANDLE_TIMEOUT);
    let elapsed = started.elapsed();
    let english = check_moss_output_on(&response, staging.path(), MOSS_TRANSCRIBE_DIARIZE_CANDLE, "candle");
    assert_eq!(english["provenance"]["device"], "cpu");
    let text = transcript(&english);
    assert!(says_testing_one_two_three(&text), "{text}");
    assert_eq!(english["language"]["tag"], "en");
    eprintln!("MOSS (candle) test-sample.wav ({elapsed:?}; {}): {text}", rss_gib(&mut worker));
    eprintln!("stats: {}", result(&response)["stats"]);

    let dir = tempfile::tempdir().unwrap();
    let joined = joined_fixtures(dir.path(), "two-speakers.wav", &["test-sample.wav", "chinese-sample.wav"]);
    let staging = tempfile::tempdir().unwrap();
    let params = moss_job(
        "job-candle-moss-diarize",
        &joined,
        staging.path(),
        json!({ "mode": "prefer", "tag": null }),
        true,
    );
    let started = Instant::now();
    let (_, response) = worker.call("job.run", params, CANDLE_TIMEOUT);
    let elapsed = started.elapsed();
    let asr = check_moss_output_on(&response, staging.path(), MOSS_TRANSCRIBE_DIARIZE_CANDLE, "candle");
    eprintln!(
        "MOSS (candle) two-speakers.wav ({elapsed:?}; {}): warnings {}",
        rss_gib(&mut worker),
        asr["warnings"]
    );
    print_segments(&asr);
    eprintln!("stats: {}", result(&response)["stats"]);
    let speakers: std::collections::BTreeSet<&str> = asr["segments"]
        .as_array()
        .unwrap()
        .iter()
        .filter_map(|segment| segment["speakerId"].as_str())
        .collect();
    assert!(speakers.len() >= 2, "expected two speakers: {speakers:?}");
    assert_eq!(
        asr["provenance"]["models"]["speaker"].is_object(),
        is_installed(&models_root(), WESPEAKER)
    );

    let (_, response) = worker.call("model.unload", json!({}), QUICK);
    assert_eq!(result(&response)["unloaded"], true);
}

/// Qwen3-ASR 0.6B on candle (CPU) with the speaker-diarization bundle: same as [`diarizes_two_speakers_with_qwen3_asr`].
#[cfg(feature = "backend-candle")]
#[test]
#[ignore = "needs CUCCUT_TEST_MODELS_DIR with Qwen3-ASR 0.6B, Silero and the speaker diarization pack installed"]
fn candle_diarizes_two_speakers_with_qwen3_asr_0_6b() {
    let root = models_root();
    let bundle = is_installed(&root, QWEN3_ASR_0_6B.1).then(|| on_candle(qwen3_asr_bundle(&root, QWEN3_ASR_0_6B), QWEN3_ASR_0_6B_CANDLE));
    diarizes_two_speakers_with(bundle, "candle", CANDLE_TIMEOUT);
}
