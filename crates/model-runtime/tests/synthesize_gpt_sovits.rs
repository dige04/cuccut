//! GPT-SoVITS v2 real-weight synthesis: using the built-in voice's bundled recording and its transcript as the reference, speak one Chinese sentence with a pronunciation annotation and one English sentence. Check that the duration is reasonable, the output is not silent, and there is no severe clipping. Annotations are reported honestly as “pronunciation not recognized”, and the WAVs are written outside the repo for listening.
//!
//! CUCCUT_TEST_MODELS_DIR="$HOME/Library/Application Support/CucCut/models" \
//!   cargo test -p model-runtime --test synthesize_gpt_sovits -- --ignored --test-threads=1 --nocapture
//!
//! WAVs are written to `CUCCUT_TEST_OUTPUT_DIR` (if unset, to the `cuccut-tts-listen/` directory under the system temp directory).

#![cfg(any(
    feature = "backend-candle",
    all(feature = "backend-mlx", target_os = "macos", target_arch = "aarch64")
))]

use std::path::PathBuf;
use std::time::Instant;

use model_runtime::bundle::{FAMILY_GPT_SOVITS, FileEntry, ModelFiles, VerifiedFiles};
use model_runtime::synthesize::readings::Origin;
use model_runtime::synthesize::{self, EngineFiles, TtsAudio, TtsEngineKind, TtsRequest, VoiceSpec, wav};
use serde_json::Value;

const REPO: &str = "PJMixers-Dev/lj1995_GPT-SoVITS-safetensors";

/// A pronunciation annotation. GPT-SoVITS does not recognize readings: what is fed to the model is the surface text, and the annotation is reported in `readings_dropped`.
const ZH: &str = "他在这一<行|hang2>做了十年，今天下午三点我们开会讨论新版本的发布计划。";
const EN: &str = "The quick brown fox jumps over the lazy dog near the river bank.";

fn models_root() -> PathBuf {
    PathBuf::from(std::env::var("CUCCUT_TEST_MODELS_DIR").expect("set CUCCUT_TEST_MODELS_DIR to the models root"))
}

fn output_dir() -> PathBuf {
    let dir = std::env::var_os("CUCCUT_TEST_OUTPUT_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|| std::env::temp_dir().join("cuccut-tts-listen"));
    std::fs::create_dir_all(&dir).expect("create output dir");
    dir
}

/// Builds and validates a component's file manifest from `<models-root>/<repo>/.ccut-manifest.json`.
fn verified(repo: &str, family: &str, component: &'static str) -> VerifiedFiles {
    let dir = models_root().join(repo);
    let manifest: Value =
        serde_json::from_slice(&std::fs::read(dir.join(".ccut-manifest.json")).expect("read .ccut-manifest.json")).expect("manifest JSON");
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
    ModelFiles {
        family: family.to_owned(),
        revision: manifest["revision"].as_str().unwrap_or_default().to_owned(),
        dir: dir.to_string_lossy().into_owned(),
        files,
    }
    .verify(component)
    .expect("verify bundle files")
}

/// Samples with reasonable duration (0.5–20 s per sentence), with peak and RMS that are not silent, and with fewer than 0.1% clipped samples (|x| ≥ 0.999).
fn check_and_write(audio: &TtsAudio, name: &str) -> PathBuf {
    assert_eq!(audio.sample_rate, 32_000);
    let seconds = audio.samples.len() as f32 / audio.sample_rate as f32;
    let peak = audio.samples.iter().fold(0.0_f32, |max, s| max.max(s.abs()));
    let rms = (audio.samples.iter().map(|s| s * s).sum::<f32>() / audio.samples.len().max(1) as f32).sqrt();
    let clipped = audio.samples.iter().filter(|s| s.abs() >= 0.999).count();
    let clipped_ratio = clipped as f32 / audio.samples.len().max(1) as f32;
    let path = output_dir().join(format!("{name}.wav"));
    wav::write_wav_pcm16(&path, &audio.samples, audio.sample_rate).expect("write wav");
    println!(
        "{name}: {seconds:.2} s, peak {peak:.3}, rms {rms:.4}, clipped {clipped} ({:.4}%) → {}",
        clipped_ratio * 100.0,
        path.display()
    );
    assert!((0.5..=20.0).contains(&seconds), "{name}: {seconds:.2} s is outside 0.5–20 s");
    assert!(peak > 0.01, "{name}: peak {peak} looks silent");
    assert!(rms > 0.003, "{name}: RMS {rms} looks silent");
    assert!(clipped_ratio < 0.001, "{name}: {clipped} samples clipped");
    assert!(audio.samples.iter().all(|s| s.is_finite()), "{name}: contains NaN / Inf");
    path
}

#[test]
#[ignore = "needs CUCCUT_TEST_MODELS_DIR with the GPT-SoVITS v2 bundle installed"]
fn builtin_voices_speak_chinese_with_a_reading_and_english() {
    let model = verified(REPO, FAMILY_GPT_SOVITS, "tts");
    let started = Instant::now();
    let mut engine = synthesize::load(
        TtsEngineKind::GptSovits,
        EngineFiles {
            model: &model,
            codec: None,
            aux: None,
        },
    )
    .expect("load GPT-SoVITS");
    println!("loaded in {:.2} s", started.elapsed().as_secs_f32());
    assert_eq!(engine.kind(), TtsEngineKind::GptSovits);
    assert_eq!(engine.sample_rate(), 32_000);
    assert!(engine.preset_speakers().contains(&"zh-female".to_owned()));

    // Built-in voice: the bundled recording plus its transcript as the reference (the cloning path with reference text).
    for (lang, text, speaker) in [("zh", ZH, "zh-female"), ("en", EN, "en-male")] {
        let mut request = TtsRequest::new(
            text,
            VoiceSpec::Preset {
                speaker: speaker.to_owned(),
            },
        );
        request.language = Some(lang.to_owned());
        request.sampling.seed = Some(7);
        let started = Instant::now();
        let audio = engine.synthesize(&request, &mut |_| true).expect("synthesize");
        println!(
            "{lang}: synthesized in {:.2} s, readings not applied {:?}",
            started.elapsed().as_secs_f32(),
            audio.readings_dropped
        );
        check_and_write(&audio, &format!("gpt-sovits-{speaker}-{lang}"));
        if lang == "zh" {
            // Pronunciation not recognized: report it honestly; the offset falls on the surface text after the annotation is stripped (the “行” in “他在这一行”).
            assert_eq!(audio.readings_dropped.len(), 1, "{:?}", audio.readings_dropped);
            let dropped = &audio.readings_dropped[0];
            assert_eq!((dropped.start, dropped.end), (4, 5));
            assert_eq!(dropped.reading, "hang2");
            assert_eq!(dropped.origin, Origin::User);
        } else {
            assert!(audio.readings_dropped.is_empty());
        }
    }
}
