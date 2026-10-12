//! Real Metal inference through the Worker protocol. Run explicitly with a pinned,
//! installed GGML + Silero bundle in CUCCUT_TEST_GGML_BUNDLE. Set
//! CUCCUT_TEST_GPU_NAME=AMD to require the Intel Mac's discrete GPU.

#![cfg(all(feature = "whisper-ggml-metal", target_os = "macos"))]

mod support;

use std::path::PathBuf;
use std::time::Duration;

use model_runtime::asr_result::{self, AsrResult};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use support::{WorkerProcess, fixture, result};

fn sha256_hex(bytes: &[u8]) -> String {
    Sha256::digest(bytes).iter().map(|byte| format!("{byte:02x}")).collect()
}

#[test]
#[ignore = "needs CUCCUT_TEST_GGML_BUNDLE and a working Metal GPU"]
fn metal_worker_transcribes_reference_fixture() {
    let bundle_path = std::env::var("CUCCUT_TEST_GGML_BUNDLE").expect("set CUCCUT_TEST_GGML_BUNDLE to the installed bundle JSON");
    let mut bundle: Value = serde_json::from_slice(&std::fs::read(bundle_path).unwrap()).unwrap();
    assert_eq!(bundle["backend"], "ggml");
    bundle["device"] = json!("metal");

    let mut worker = WorkerProcess::spawn();
    let (_, hello) = worker.call("worker.hello", json!({ "contractVersion": 1 }), Duration::from_secs(30));
    let ggml = result(&hello)["backends"]
        .as_array()
        .unwrap()
        .iter()
        .find(|backend| backend["id"] == "ggml")
        .unwrap();
    assert_eq!(ggml["available"], true, "{hello}");
    assert_eq!(ggml["devices"][0], "metal", "{hello}");

    let (_, loaded) = worker.call("model.load", json!({ "bundle": bundle }), Duration::from_secs(300));
    assert_eq!(result(&loaded)["loaded"], true, "{loaded}");
    let diagnostics = model_runtime::backend::ggml::runtime_probe();
    assert_eq!(diagnostics.backend, "ggml-metal");
    if let Ok(expected) = std::env::var("CUCCUT_TEST_GPU_NAME") {
        assert!(diagnostics.device.contains(&expected), "expected {expected} in {diagnostics:?}");
    }

    let audio = fixture("test-sample.wav");
    let bytes = std::fs::read(&audio).unwrap();
    let staging = tempfile::tempdir().unwrap();
    let (_, response) = worker.call(
        "job.run",
        json!({
            "jobId": "metal-reference", "runGeneration": 1, "capability": "transcribe",
            "input": { "file": audio, "contentHash": format!("sha256:{}", sha256_hex(&bytes)), "track": 0 },
            "options": { "language": { "mode": "assert", "tag": "en" }, "diarize": false, "timescale": 1_000_000 },
            "staging": staging.path(), "outputContract": "cuccut.asr-result/v1",
        }),
        Duration::from_secs(300),
    );
    let completed = result(&response);
    assert_eq!(completed["outcome"], "completed", "{response}");
    let output = &completed["output"];
    let path = PathBuf::from(output["path"].as_str().unwrap());
    assert_eq!(path, staging.path().join("result.json"));
    let bytes = std::fs::read(path).unwrap();
    assert_eq!(output["sha256"], sha256_hex(&bytes));
    assert_eq!(output["byteLength"], bytes.len() as u64);
    let asr: AsrResult = serde_json::from_slice(&bytes).unwrap();
    asr_result::validate(&asr, Some("en")).unwrap();
    assert_eq!(asr.provenance.backend, "ggml");
    assert_eq!(asr.provenance.device, "metal");
    let transcript = asr
        .segments
        .iter()
        .map(|segment| segment.text.as_str())
        .collect::<Vec<_>>()
        .join(" ");
    let normalized = transcript
        .to_lowercase()
        .replace(|c: char| !c.is_alphanumeric() && !c.is_whitespace(), "");
    assert!(
        normalized.contains("testing one two three") || normalized.contains("testing 1 2 3"),
        "{transcript}"
    );
    eprintln!("Metal reference transcript: {transcript}");
}
