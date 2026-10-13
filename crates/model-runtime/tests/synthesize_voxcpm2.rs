//! VoxCPM2 real-weight synthesis: built-in voice (high-fidelity continuation cloning), reference recording (controllable cloning), and style instructions. Each speaks one Chinese and one English sentence. Checks that the duration is reasonable and the output is not silent, and writes the WAVs outside the repo for listening.
//!
//! CUCCUT_TEST_MODELS_DIR="$HOME/Library/Application Support/CucCut/models" \
//!   cargo test -p model-runtime --test synthesize_voxcpm2 -- --ignored --test-threads=1 --nocapture
//!
//! If the weights are absent (no `CUCCUT_TEST_MODELS_DIR` or no `.ccut-manifest.json`), the reason is printed and the test is skipped.
//! WAVs are written to `CUCCUT_TEST_OUTPUT_DIR` (if unset, to the `cuccut-tts-listen/` directory under the system temp directory).

#![cfg(any(
    feature = "backend-candle",
    all(feature = "backend-mlx", target_os = "macos", target_arch = "aarch64")
))]

use std::path::{Path, PathBuf};
use std::time::Instant;

use model_runtime::bundle::{FAMILY_VOXCPM2, FileEntry, ModelFiles, VerifiedFiles};
use model_runtime::synthesize::{self, EngineFiles, TtsAudio, TtsEngine, TtsEngineKind, TtsRequest, VoiceSpec, wav};
use serde_json::Value;

const REPO: &str = "aufklarer/VoxCPM2-MLX-int8";
const SAMPLE_RATE: u32 = 48_000;

const ZH: &str = "今天下午三点，我们在会议室讨论新版本的发布计划。";
const EN: &str = "The quick brown fox jumps over the lazy dog near the river bank.";

fn output_dir() -> PathBuf {
    let dir = std::env::var_os("CUCCUT_TEST_OUTPUT_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|| std::env::temp_dir().join("cuccut-tts-listen"));
    std::fs::create_dir_all(&dir).expect("create output dir");
    dir
}

/// Builds and validates the file manifest from `<models-root>/<repo>/.ccut-manifest.json`; returns `None` and prints the reason if the weights are absent.
fn verified(repo: &str, family: &str, component: &'static str) -> Option<VerifiedFiles> {
    let Some(root) = std::env::var_os("CUCCUT_TEST_MODELS_DIR") else {
        println!("skipped: CUCCUT_TEST_MODELS_DIR is not set");
        return None;
    };
    let dir = PathBuf::from(root).join(repo);
    let Ok(bytes) = std::fs::read(dir.join(".ccut-manifest.json")) else {
        println!("skipped: {} has no .ccut-manifest.json (weights not installed)", dir.display());
        return None;
    };
    let manifest: Value = serde_json::from_slice(&bytes).expect("manifest JSON");
    let files = manifest["files"]
        .as_array()
        .expect("manifest files")
        .iter()
        .map(|file| FileEntry {
            path: file["path"].as_str().expect("path").to_owned(),
            sha256: file["sha256"].as_str().unwrap_or_default().to_owned(),
            byte_length: file["size"].as_u64().expect("size"),
        })
        .collect();
    Some(
        ModelFiles {
            family: family.to_owned(),
            revision: manifest["revision"].as_str().unwrap_or_default().to_owned(),
            dir: dir.to_string_lossy().into_owned(),
            files,
        }
        .verify(component)
        .expect("verify bundle files"),
    )
}

fn fixture(name: &str) -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures").join(name)
}

/// Duration reasonable (0.5–20 s per sentence), peak and RMS not silent.
fn check_and_write(audio: &TtsAudio, name: &str) -> PathBuf {
    assert_eq!(audio.sample_rate, SAMPLE_RATE);
    let seconds = audio.samples.len() as f32 / audio.sample_rate as f32;
    let peak = audio.samples.iter().fold(0.0_f32, |max, s| max.max(s.abs()));
    let rms = (audio.samples.iter().map(|s| s * s).sum::<f32>() / audio.samples.len().max(1) as f32).sqrt();
    let path = output_dir().join(format!("{name}.wav"));
    wav::write_wav_pcm16(&path, &audio.samples, audio.sample_rate).expect("write wav");
    println!("{name}: {seconds:.2} s, peak {peak:.3}, rms {rms:.4} → {}", path.display());
    assert!((0.5..=20.0).contains(&seconds), "{name}: {seconds:.2} s is outside 0.5–20 s");
    assert!(peak > 0.01, "{name}: peak {peak} looks silent");
    assert!(rms > 0.003, "{name}: RMS {rms} looks silent");
    assert!(audio.samples.iter().all(|s| s.is_finite()), "{name}: contains NaN / Inf");
    path
}

fn load() -> Option<Box<dyn TtsEngine>> {
    let model = verified(REPO, FAMILY_VOXCPM2, "tts")?;
    let started = Instant::now();
    let engine = synthesize::load(
        TtsEngineKind::VoxCpm2,
        EngineFiles {
            model: &model,
            codec: None,
            aux: None,
        },
    )
    .expect("load VoxCPM2");
    println!("VoxCPM2: loaded in {:.2} s", started.elapsed().as_secs_f32());
    assert_eq!(engine.kind(), TtsEngineKind::VoxCpm2);
    assert_eq!(engine.sample_rate(), SAMPLE_RATE);
    Some(engine)
}

fn synthesize_pair(engine: &mut dyn TtsEngine, voice: VoiceSpec, instruct: Option<&str>, label: &str) {
    for (lang, text) in [("zh", ZH), ("en", EN)] {
        let mut request = TtsRequest::new(text, voice.clone());
        request.language = Some(lang.to_owned());
        request.instruct = instruct.map(str::to_owned);
        request.sampling.seed = Some(7);
        let started = Instant::now();
        let audio = engine.synthesize(&request, &mut |_| true).expect("synthesize");
        println!("{label}-{lang}: synthesized in {:.2} s", started.elapsed().as_secs_f32());
        check_and_write(&audio, &format!("voxcpm2-{label}-{lang}"));
    }
}

#[test]
#[ignore = "needs CUCCUT_TEST_MODELS_DIR with aufklarer/VoxCPM2-MLX-int8 installed"]
fn voxcpm2_speaks_chinese_and_english_with_builtin_reference_and_clone() {
    let Some(mut engine) = load() else { return };
    // Built-in voice with transcript: high-fidelity continuation cloning.
    synthesize_pair(engine.as_mut(), VoiceSpec::Default, None, "builtin");
    // Reference recording without transcript: controllable cloning.
    synthesize_pair(
        engine.as_mut(),
        VoiceSpec::Clone {
            reference_audio: fixture("test-sample.wav"),
            reference_text: None,
        },
        None,
        "clone",
    );
    // Style instruction: prepended to the body text, goes through controllable cloning.
    synthesize_pair(engine.as_mut(), VoiceSpec::Default, Some("用欢快、兴奋的语气"), "instruct");
}
