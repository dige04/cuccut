//! IndexTTS2 and IndexTTS 2.5 real-weight synthesis: each of the two models speaks one Chinese and one English sentence with built-in voices. Each then runs once with an emotion preset vector (one of the eight slider dimensions at full, plus the official default emotion weight) and speaks one Chinese sentence with a `<行|hang2>` pronunciation annotation. 2.5 additionally tests the speech-rate knob once. Checks: duration is reasonable, the output is not silent, there is no severe clipping, the annotations are not dropped. The WAVs are written outside the repo for listening.
//!
//! CUCCUT_TEST_MODELS_DIR="$HOME/Library/Application Support/CucCut/models" \
//!   cargo test -p model-runtime --test synthesize_index_tts2 -- --ignored --test-threads=1 --nocapture
//!
//! WAVs are written to `CUCCUT_TEST_OUTPUT_DIR` (if unset, to the `cuccut-tts-listen/` directory under the system temp directory).

#![cfg(any(
    feature = "backend-candle",
    all(feature = "backend-mlx", target_os = "macos", target_arch = "aarch64")
))]

use std::path::{Path, PathBuf};
use std::time::Instant;

use model_runtime::bundle::{FAMILY_INDEX_TTS2, FAMILY_INDEX_TTS2_AUX, FAMILY_INDEX_TTS25, FileEntry, ModelFiles, VerifiedFiles};
use model_runtime::synthesize::types::{DEFAULT_EMOTION_ALPHA, EmotionSpec};
use model_runtime::synthesize::{self, EngineFiles, TtsAudio, TtsEngine, TtsEngineKind, TtsRequest, VoiceSpec, wav};
use serde_json::Value;

const INDEX_TTS2_REPO: &str = "aufklarer/IndexTTS2-MLX-fp16";
const INDEX_TTS25_REPO: &str = "mlx-community/IndexTTS-2.5-fp16";

const ZH: &str = "今天下午三点，我们在会议室讨论新版本的发布计划。";
const EN: &str = "The quick brown fox jumps over the lazy dog near the river bank.";
const ZH_HAPPY: &str = "太好了，我们终于把这个版本按时发布了！";
/// “行” is read as hang2 here; without the annotation the model mostly says xing2.
const ZH_READING: &str = "他在这一<行|hang2>做了十年，经验很丰富。";

/// Order of the eight emotion sliders: happy, angry, sad, afraid, disgusted, melancholic, surprised, calm.
const HAPPY: [f32; 8] = [1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0];

fn fixture(name: &str) -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures").join(name)
}

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
    assert_eq!(audio.sample_rate, 22_050);
    let seconds = audio.samples.len() as f32 / audio.sample_rate as f32;
    let peak = audio.samples.iter().fold(0.0_f32, |max, s| max.max(s.abs()));
    let rms = (audio.samples.iter().map(|s| s * s).sum::<f32>() / audio.samples.len().max(1) as f32).sqrt();
    let clipped = audio.samples.iter().filter(|s| s.abs() >= 0.999).count() as f32 / audio.samples.len().max(1) as f32;
    let path = output_dir().join(format!("{name}.wav"));
    wav::write_wav_pcm16(&path, &audio.samples, audio.sample_rate).expect("write wav");
    println!(
        "{name}: {seconds:.2} s, peak {peak:.3}, rms {rms:.4}, clipped {:.3}% → {}",
        clipped * 100.0,
        path.display()
    );
    assert!((0.5..=20.0).contains(&seconds), "{name}: {seconds:.2} s 不在 0.5–20 s 内");
    assert!(peak > 0.01, "{name}: 峰值 {peak} 像静音");
    assert!(rms > 0.003, "{name}: RMS {rms} 像静音");
    assert!(clipped < 0.001, "{name}: {:.3}% 的样本削波", clipped * 100.0);
    assert!(audio.samples.iter().all(|s| s.is_finite()), "{name}: 有 NaN / Inf");
    path
}

/// 2.0 has only the main model component; 2.5 additionally has an `aux` component (the whole IndexTTS2 repo).
fn load(kind: TtsEngineKind) -> Box<dyn TtsEngine> {
    let (model, aux) = match kind {
        TtsEngineKind::IndexTts2 => (verified(INDEX_TTS2_REPO, FAMILY_INDEX_TTS2, "tts"), None),
        TtsEngineKind::IndexTts25 => (
            verified(INDEX_TTS25_REPO, FAMILY_INDEX_TTS25, "tts"),
            Some(verified(INDEX_TTS2_REPO, FAMILY_INDEX_TTS2_AUX, "aux")),
        ),
        other => panic!("not an IndexTTS engine: {other:?}"),
    };
    let started = Instant::now();
    let engine = synthesize::load(
        kind,
        EngineFiles {
            model: &model,
            codec: None,
            aux: aux.as_ref(),
        },
    )
    .expect("load IndexTTS");
    println!("{}: 加载 {:.2} s", kind.as_str(), started.elapsed().as_secs_f32());
    assert_eq!(engine.kind(), kind);
    assert_eq!(engine.sample_rate(), 22_050);
    assert!(engine.preset_speakers().contains(&"zh-female".to_owned()), "内置音色当预置说话人");
    engine
}

fn speak(engine: &mut dyn TtsEngine, request: &TtsRequest, name: &str) -> f32 {
    speak_audio(engine, request, name).duration_seconds() as f32
}

fn speak_audio(engine: &mut dyn TtsEngine, request: &TtsRequest, name: &str) -> TtsAudio {
    let started = Instant::now();
    let mut chunks = 0;
    let audio = engine
        .synthesize(request, &mut |progress| {
            if let synthesize::TtsProgress::ChunkFinished { .. } = progress {
                chunks += 1;
            }
            true
        })
        .expect("synthesize");
    println!("{name}: 合成 {:.2} s，{chunks} 段", started.elapsed().as_secs_f32());
    assert!(chunks >= 1);
    check_and_write(&audio, name);
    audio
}

/// Speaks one Chinese and one English sentence with the built-in voices (`Default` picks by language), then one Chinese sentence with the “happy” preset on the Chinese built-in voice.
fn synthesize_set(engine: &mut dyn TtsEngine, label: &str) {
    for (lang, text) in [("zh", ZH), ("en", EN)] {
        let mut request = TtsRequest::new(text, VoiceSpec::Default);
        request.language = Some(lang.to_owned());
        request.sampling.seed = Some(7);
        speak(engine, &request, &format!("{label}-builtin-{lang}"));
    }

    let mut request = TtsRequest::new(
        ZH_HAPPY,
        VoiceSpec::Preset {
            speaker: "zh-female".to_owned(),
        },
    );
    request.language = Some("zh".to_owned());
    request.sampling.seed = Some(7);
    request.emotion = Some(EmotionSpec::Vector {
        weights: HAPPY,
        alpha: DEFAULT_EMOTION_ALPHA,
    });
    speak(engine, &request, &format!("{label}-emotion-happy-zh"));

    // Annotations: 2.0 swaps in vocabulary pinyin pieces; 2.5 consumes `<字|读音>` as is. Neither should report dropped.
    let mut request = TtsRequest::new(ZH_READING, VoiceSpec::Default);
    request.language = Some("zh".to_owned());
    request.sampling.seed = Some(7);
    let audio = speak_audio(engine, &request, &format!("{label}-reading-hang2-zh"));
    assert!(
        audio.readings_dropped.is_empty(),
        "{label}: 注音被丢了：{:?}",
        audio.readings_dropped
    );
}

#[test]
#[ignore = "needs CUCCUT_TEST_MODELS_DIR with the IndexTTS2 bundle installed"]
fn index_tts2_speaks_with_builtin_voices_and_an_emotion_preset() {
    let mut engine = load(TtsEngineKind::IndexTts2);
    synthesize_set(engine.as_mut(), "index-tts2");
}

#[test]
#[ignore = "needs CUCCUT_TEST_MODELS_DIR with the IndexTTS 2.5 bundle installed"]
fn index_tts25_speaks_with_builtin_voices_an_emotion_preset_and_a_speed_knob() {
    let mut engine = load(TtsEngineKind::IndexTts25);
    synthesize_set(engine.as_mut(), "index-tts2.5");

    // Speech rate only scales the length-normalized target frame count: same sentence, same seed, and 1.4× speech rate is clearly shorter.
    let mut request = TtsRequest::new(ZH, VoiceSpec::Default);
    request.language = Some("zh".to_owned());
    request.sampling.seed = Some(7);
    let normal = speak(engine.as_mut(), &request, "index-tts2.5-speed-1.0-zh");
    request.speed = Some(1.4);
    let fast = speak(engine.as_mut(), &request, "index-tts2.5-speed-1.4-zh");
    println!("语速 1.0 → {normal:.2} s，1.4 → {fast:.2} s");
    assert!(fast < normal * 0.9, "1.4 倍语速没有变短：{normal:.2} s → {fast:.2} s");

    // An out-of-range speech rate is rejected before the reference audio is loaded.
    request.speed = Some(3.0);
    assert!(engine.synthesize(&request, &mut |_| true).is_err());
}

#[test]
#[ignore = "needs CUCCUT_TEST_MODELS_DIR with the IndexTTS2 bundle installed"]
fn index_tts2_clones_a_file_takes_emotion_from_audio_and_cancels() {
    let mut engine = load(TtsEngineKind::IndexTts2);
    let mut request = TtsRequest::new(
        ZH,
        VoiceSpec::Clone {
            reference_audio: fixture("chinese-sample.wav"),
            reference_text: None,
        },
    );
    request.sampling.seed = Some(7);
    speak(engine.as_mut(), &request, "index-tts2-clone-zh");

    // The emotion reference audio is mixed with the timbre reference according to alpha.
    request.emotion = Some(EmotionSpec::Audio {
        reference_audio: fixture("test-sample.wav"),
        alpha: 0.5,
    });
    speak(engine.as_mut(), &request, "index-tts2-clone-emotion-audio-zh");

    // The progress callback returns false: stop at the next safe point and report cancellation.
    let error = engine
        .synthesize(
            &request,
            &mut |progress| !matches!(progress, synthesize::TtsProgress::Tokens { generated, .. } if generated >= 5),
        )
        .unwrap_err();
    assert!(error.to_string().contains("取消"), "{error}");
}
