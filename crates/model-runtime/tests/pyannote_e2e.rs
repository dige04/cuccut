//! Pyannote segmentation + WeSpeaker speaker-embedding clustering real-weight e2e (ported from v2 `ccut-speech`'s `pyannote_e2e`):
//!
//! CUCCUT_TEST_MODELS_DIR=… cargo test -p model-runtime --test pyannote_e2e -- --ignored --test-threads=1 --nocapture
//! CUCCUT_TEST_MODELS_DIR=… cargo test -p model-runtime --no-default-features --features backend-candle \
//!   --test pyannote_e2e -- --ignored --test-threads=1 --nocapture
//!
//! If candle is enabled, test candle (CPU); otherwise test MLX. Weights are checked against `<CUCCUT_TEST_MODELS_DIR>/<repo>/.ccut-manifest.json` and loaded; if absent, the reason is printed and the test is skipped.

#![cfg(any(
    feature = "backend-candle",
    all(feature = "backend-mlx", target_os = "macos", target_arch = "aarch64")
))]

use std::collections::BTreeSet;
use std::path::{Path, PathBuf};

use model_runtime::audio::decode_mono;
use model_runtime::bundle::{self, VerifiedFiles};
use model_runtime::speech::pyannote_common::{DiarizedSegment, PyannoteCallbacks, PyannoteOptions};
use serde_json::{Value, json};

const PYANNOTE_REPO: &str = "aufklarer/Pyannote-Segmentation-MLX";
const WESPEAKER_REPO: &str = "aufklarer/WeSpeaker-ResNet34-LM-MLX";

#[cfg(feature = "backend-candle")]
struct Diarizer(model_runtime::backend::candle::PyannoteDiarizer);

#[cfg(feature = "backend-candle")]
impl Diarizer {
    fn load(segmentation: &VerifiedFiles, speaker: Option<&VerifiedFiles>) -> Self {
        use model_runtime::backend::candle::PyannoteDiarizer;
        let device = candle_core::Device::Cpu;
        Self(match speaker {
            Some(speaker) => PyannoteDiarizer::load_with_embedding(segmentation, speaker, &device).unwrap(),
            None => PyannoteDiarizer::load(segmentation, &device).unwrap(),
        })
    }

    fn diarize(&mut self, audio: &[f32], options: &PyannoteOptions) -> Vec<DiarizedSegment> {
        self.0.diarize_with(audio, options, &mut PyannoteCallbacks::default()).unwrap()
    }
}

#[cfg(not(feature = "backend-candle"))]
struct Diarizer(model_runtime::backend::mlx::pyannote::PyannoteDiarizer);

#[cfg(not(feature = "backend-candle"))]
impl Diarizer {
    fn load(segmentation: &VerifiedFiles, speaker: Option<&VerifiedFiles>) -> Self {
        use model_runtime::backend::mlx::pyannote::PyannoteDiarizer;
        Self(match speaker {
            Some(speaker) => PyannoteDiarizer::load_with_embedding(segmentation, speaker).unwrap(),
            None => PyannoteDiarizer::load(segmentation).unwrap(),
        })
    }

    fn diarize(&mut self, audio: &[f32], options: &PyannoteOptions) -> Vec<DiarizedSegment> {
        self.0.diarize_with(audio, options, &mut PyannoteCallbacks::default()).unwrap()
    }
}

/// If a speaker-embedding model is present, use “segmentation + speaker re-identification”; otherwise use pure IoU.
fn load_diarizer() -> Option<Diarizer> {
    let segmentation = verified(PYANNOTE_REPO, "pyannote-segmentation", "segmentation")?;
    let speaker = verified(WESPEAKER_REPO, "wespeaker", "speaker");
    Some(Diarizer::load(&segmentation, speaker.as_ref()))
}

#[test]
#[ignore = "needs CUCCUT_TEST_MODELS_DIR with Pyannote installed"]
fn pyannote_diarizes_reference_fixture() {
    let Some(mut diarizer) = load_diarizer() else {
        return;
    };
    let audio = audio("test-sample.wav");
    let duration = audio.len() as f64 / 16_000.0;
    let segments = diarizer.diarize(
        &audio,
        &PyannoteOptions {
            max_speakers: Some(8),
            ..PyannoteOptions::default()
        },
    );

    assert!(!segments.is_empty());
    assert!(segments.iter().all(|segment| {
        segment.start.is_finite()
            && segment.end.is_finite()
            && segment.start >= 0.0
            && segment.end > segment.start
            && segment.end <= duration + 1e-6
    }));
    // Output is sorted ascending by start time; ties are sorted by speaker ascending.
    assert!(
        segments
            .windows(2)
            .all(|pair| pair[0].start < pair[1].start || (pair[0].start == pair[1].start && pair[0].speaker <= pair[1].speaker)),
        "{segments:?}"
    );

    let speakers = segments.iter().map(|segment| segment.speaker).collect::<BTreeSet<_>>();
    // Speaker ids must be a contiguous range starting from 0 (render_segments compacts any gaps).
    assert_eq!(
        speakers,
        (0..speakers.len()).collect::<BTreeSet<_>>(),
        "说话人 id 不连续：{segments:?}"
    );

    // The following are numeric assertions calibrated by measuring with real weights, and both backends must satisfy them. The reference fixture is a single reader, 3.68 seconds: shorter than one sliding window, so it can only verify that a single window does not split. Cross-window stitching and speaker clustering are covered by `pyannote_reidentifies_speaker_after_interruption` below, which uses concatenated audio.
    // The measured output is exactly one segment, [0.000, 3.680] speaker 0. Both paths (embedding / pure IoU) and both backends (MLX / candle) give the same result.
    assert!(
        (1..=2).contains(&speakers.len()),
        "说话人数 {} 超出预期：{segments:?}",
        speakers.len()
    );
    assert!((1..=8).contains(&segments.len()), "段数 {} 超出预期：{segments:?}", segments.len());
    let voiced: f64 = segments.iter().map(|segment| segment.end - segment.start).sum();
    assert!(
        voiced > duration * 0.5 && voiced <= duration * 1.5,
        "语音总时长 {voiced:.2}s 与音频 {duration:.2}s 不匹配：{segments:?}"
    );
    // Every segment is no shorter than the minimum speech threshold.
    assert!(
        segments.iter().all(|segment| segment.end - segment.start >= 0.30 - 1e-9),
        "{segments:?}"
    );
}

/// Cross-window speaker re-identification: A speaks → B interrupts → A returns. A's turns before and after must share the same global id.
///
/// The two fixtures are different speakers (real WeSpeaker measured a cosine distance of 0.841, far above the 0.715 threshold; the same person's first and second halves score only 0.381), so the concatenated audio is a legitimate two-person dialogue. The silence in between fully cuts the IoU chain, so only speaker-embedding clustering can tie A's two turns back to one person. The pure IoU path would classify A's second turn as a new speaker.
#[test]
#[ignore = "needs CUCCUT_TEST_MODELS_DIR with Pyannote and WeSpeaker installed"]
fn pyannote_reidentifies_speaker_after_interruption() {
    let Some(segmentation) = verified(PYANNOTE_REPO, "pyannote-segmentation", "segmentation") else {
        return;
    };
    let Some(speaker) = verified(WESPEAKER_REPO, "wespeaker", "speaker") else {
        return;
    };
    const GAP_SECONDS: f64 = 2.0;
    let speaker_a = audio("test-sample.wav");
    let speaker_b = audio("chinese-sample.wav");

    // Four turns, A, B, A, B, with silence inserted between turns; record each turn's ground-truth interval.
    let mut samples = Vec::new();
    let mut turns = Vec::new();
    for (label, turn) in [('A', &speaker_a), ('B', &speaker_b), ('A', &speaker_a), ('B', &speaker_b)] {
        let start = samples.len() as f64 / 16_000.0;
        samples.extend_from_slice(turn);
        turns.push((label, start, samples.len() as f64 / 16_000.0));
        samples.resize(samples.len() + (GAP_SECONDS * 16_000.0) as usize, 0.0);
    }
    assert!(samples.len() > 16_000 * 15, "拼接音频必须跨多个滑窗");

    let mut diarizer = Diarizer::load(&segmentation, Some(&speaker));
    let segments = diarizer.diarize(
        &samples,
        &PyannoteOptions {
            max_speakers: Some(8),
            ..PyannoteOptions::default()
        },
    );

    // Each turn takes the segment with the most overlap as that turn's speaker.
    let dominant = |start: f64, end: f64| -> usize {
        segments
            .iter()
            .map(|segment| (segment.speaker, (end.min(segment.end) - start.max(segment.start)).max(0.0)))
            .max_by(|left, right| left.1.total_cmp(&right.1))
            .filter(|(_, overlap)| *overlap > 0.0)
            .map(|(speaker, _)| speaker)
            .unwrap_or_else(|| panic!("{start:.2}..{end:.2} 没有任何段覆盖：{segments:?}"))
    };
    let voices = turns
        .iter()
        .map(|(label, start, end)| (*label, dominant(*start, *end)))
        .collect::<Vec<_>>();

    assert_eq!(voices[0].1, voices[2].1, "A 打断后没有认回同一人：{voices:?} {segments:?}");
    assert_eq!(voices[1].1, voices[3].1, "B 的两轮不是同一人：{voices:?} {segments:?}");
    assert_ne!(voices[0].1, voices[1].1, "A 与 B 被并成同一人：{voices:?} {segments:?}");
    let speakers = segments.iter().map(|segment| segment.speaker).collect::<BTreeSet<_>>();
    assert_eq!(speakers, BTreeSet::from([0, 1]), "双人对话应当恰好识别出两个人：{segments:?}");
}

/// The speaker-count cap must be a hard cap: it must not be exceeded by the IoU or the clustering fallback paths.
#[test]
#[ignore = "needs CUCCUT_TEST_MODELS_DIR with Pyannote installed"]
fn pyannote_respects_speaker_cap() {
    let Some(mut diarizer) = load_diarizer() else {
        return;
    };
    let segments = diarizer.diarize(
        &audio("test-sample.wav"),
        &PyannoteOptions {
            max_speakers: Some(1),
            ..PyannoteOptions::default()
        },
    );
    let speakers = segments.iter().map(|segment| segment.speaker).collect::<BTreeSet<_>>();
    assert_eq!(speakers, BTreeSet::from([0]), "{segments:?}");
}

fn audio(name: &str) -> Vec<f32> {
    decode_mono(&Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures").join(name), 16_000).expect("decode fixture")
}

/// Resolves a component's files from `<models-root>/<repo>/.ccut-manifest.json`; returns `None` and prints the reason if the weights are absent.
fn verified(repo: &str, family: &str, component: &'static str) -> Option<VerifiedFiles> {
    let Some(root) = std::env::var_os("CUCCUT_TEST_MODELS_DIR") else {
        println!("跳过：没设 CUCCUT_TEST_MODELS_DIR");
        return None;
    };
    let dir = PathBuf::from(root).join(repo);
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
    let files: bundle::ModelFiles =
        serde_json::from_value(json!({ "family": family, "revision": manifest["revision"], "dir": dir.to_string_lossy(), "files": files }))
            .expect("ModelFiles");
    Some(files.verify(component).expect("verify component files"))
}
