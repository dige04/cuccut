//! MOSS Transcribe Diarize real-weight test (ported from v2 `ccut-speech`'s e2e): after recognition, releasing the audio frontend (Whisper encoder and adapter) does not change the output. The text, lines, speaker spans, and generated token count are all the same as without the release.
//!
//! CUCCUT_TEST_MODELS_DIR="$HOME/Library/Application Support/CucCut/models" \
//!   cargo test -p model-runtime --test moss_mlx -- --ignored --test-threads=1 --nocapture
//!
//! `CCUT_MOSS_TEST_AUDIO` can swap in another parity clip. If the weights are absent (no `CUCCUT_TEST_MODELS_DIR` or no `.ccut-manifest.json`), the reason is printed and the test is skipped.

#![cfg(all(feature = "backend-mlx", target_os = "macos", target_arch = "aarch64"))]

use std::path::{Path, PathBuf};

use model_runtime::audio::decode_mono;
use model_runtime::backend::mlx::moss::{MossTranscribeDiarize, QUANTIZATION_PREFERENCE};
use model_runtime::bundle::{self, ModelBundle, VerifiedFiles};
use model_runtime::speech::SegmentingCallbacks;
use serde_json::{Value, json};

const MOSS_REPO: &str = "OpenMOSS-Team/MOSS-Transcribe-Diarize";

/// Resolves the files of the `asr` component from `<models-root>/<repo>/.ccut-manifest.json`; returns `None` and prints the reason if the weights are absent.
fn moss_files() -> Option<VerifiedFiles> {
    let Some(root) = std::env::var_os("CUCCUT_TEST_MODELS_DIR") else {
        println!("跳过：没设 CUCCUT_TEST_MODELS_DIR");
        return None;
    };
    let dir = PathBuf::from(root).join(MOSS_REPO);
    let Ok(bytes) = std::fs::read(dir.join(".ccut-manifest.json")) else {
        println!("跳过：{} 没有 .ccut-manifest.json（权重没装好）", dir.display());
        return None;
    };
    let manifest: Value = serde_json::from_slice(&bytes).expect("manifest JSON");
    let files: Vec<Value> = manifest["files"]
        .as_array()
        .expect("manifest files")
        .iter()
        .map(|file| json!({ "path": file["path"], "sha256": file["sha256"], "byteLength": file["size"] }))
        .collect();
    let bundle: ModelBundle = serde_json::from_value(json!({
        "bundleId": "moss-transcribe-diarize@mlx-8bit",
        "backend": "mlx",
        "device": "metal",
        "components": {
            "asr": { "family": "moss-transcribe-diarize", "revision": manifest["revision"], "dir": dir.to_string_lossy(), "files": files },
        },
        "threads": 4,
        "memoryBudgetBytes": null,
    }))
    .expect("bundle JSON");
    bundle::verify(&bundle).expect("verify bundle").asr
}

#[test]
#[ignore = "needs CUCCUT_TEST_MODELS_DIR with MOSS Transcribe Diarize installed"]
fn moss_audio_frontend_release_preserves_output() {
    let Some(files) = moss_files() else {
        return;
    };
    let fixture = std::env::var_os("CCUT_MOSS_TEST_AUDIO")
        .map(PathBuf::from)
        .unwrap_or_else(|| Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/test-sample.wav"));
    let audio = decode_mono(&fixture, 16_000).expect("decode fixture");

    let retained = {
        let mut moss = MossTranscribeDiarize::load_with_preference(&files, QUANTIZATION_PREFERENCE).unwrap();
        moss.transcribe_diarized_with(&audio, Some("en"), &mut SegmentingCallbacks::none())
            .unwrap()
    };
    let released = {
        let mut moss = MossTranscribeDiarize::load_with_preference(&files, QUANTIZATION_PREFERENCE).unwrap();
        moss.transcribe_diarized_with_release(&audio, Some("en"), true, &mut SegmentingCallbacks::none())
            .unwrap()
    };

    println!("{}", retained.text);
    assert_eq!(released.text, retained.text);
    assert_eq!(released.rows, retained.rows);
    assert_eq!(released.speaker_ranges, retained.speaker_ranges);
    assert_eq!(released.generation_tokens, retained.generation_tokens);
}
