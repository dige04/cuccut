//! mlx ↔ candle cross-backend parity check (ported from v2 `ccut-speech`'s `candle_parity`; macOS Apple Silicon only, both backends must be enabled):
//!
//! cargo test -p model-runtime --features backend-candle --test candle_parity -- --test-threads=1
//!
//! Numeric parity without weights (quantization bit order, RoPE semantics) runs by default. Real-model parity is marked `#[ignore]`; weights are checked against `<CUCCUT_TEST_MODELS_DIR>/<repo>/.ccut-manifest.json` and loaded if present, otherwise the reason is printed and the test is skipped:
//!
//! CUCCUT_TEST_MODELS_DIR=… cargo test --release -p model-runtime --features backend-candle --test candle_parity \
//!   -- --ignored --test-threads=1 --nocapture
//!
//! Real-model parity must use `--release` (same as v2's verify.sh): a dev-profile MLX build picks a different token at the brand-name position, where the probabilities are nearly tied (“Bocut”; changing dependencies or all crates to O2, or turning off debug-assertions, does the same), while a release-build MLX and both candle profiles all produce “BioCut”.

#![cfg(all(feature = "backend-mlx", feature = "backend-candle", target_os = "macos", target_arch = "aarch64"))]

use std::path::{Path, PathBuf};
use std::sync::Mutex;

use model_runtime::audio::decode_mono;
use model_runtime::backend::candle;
use model_runtime::backend::mlx;
use model_runtime::bundle::{self, VerifiedFiles};
use model_runtime::speech::qwen3_asr::{Qwen3Config, TokenizerFiles};
use model_runtime::speech::wespeaker_fbank::{EMBEDDING_DIM, cosine_distance};
use model_runtime::speech::{ForcedAlignment, RecognitionRequest, SpeakerEmbedding, SpeechRecognizer, StreamingVad};
use serde_json::{Value, json};

/// MLX/Metal does not support concurrent initialization, so all mlx tests in this file run serially.
static MLX_LOCK: Mutex<()> = Mutex::new(());

const ASR_REPO: &str = "aufklarer/Qwen3-ASR-0.6B-MLX-4bit";
const VAD_REPO: &str = "aufklarer/Silero-VAD-v6.2.1-MLX";
const ALIGNER_REPO: &str = "aufklarer/Qwen3-ForcedAligner-0.6B-4bit";
const WESPEAKER_REPO: &str = "aufklarer/WeSpeaker-ResNet34-LM-MLX";
const PYANNOTE_REPO: &str = "aufklarer/Pyannote-Segmentation-MLX";
const MOSS_REPO: &str = "OpenMOSS-Team/MOSS-Transcribe-Diarize";

/// candle's affine dequantization must match MLX `quantize`/`dequantize` value for value. This is the foundation of the “reuse the MLX model repository” strategy
/// (bit-packing order + `w = q*scale + bias`).
#[test]
fn candle_dequantization_matches_mlx_for_4bit_and_8bit() {
    let _guard = MLX_LOCK.lock().unwrap();
    mlx::runtime::ensure_metal_device().unwrap();
    for bits in [4, 8] {
        let rows = 8;
        let columns = 128;
        let values = (0..rows * columns)
            .map(|index| ((index * 2_654_435_761_usize) % 1_000) as f32 / 250.0 - 2.0)
            .collect::<Vec<_>>();
        let weight = mlx_rs::Array::from_slice(&values, &[rows as i32, columns as i32]);
        let (quantized, scales, biases) = mlx_rs::ops::quantize(&weight, 64, bits).unwrap();
        let reference = mlx_rs::ops::dequantize(&quantized, &scales, &biases, 64, bits).unwrap();
        let reference = reference.as_dtype(mlx_rs::Dtype::Float32).unwrap().as_slice::<f32>().to_vec();

        let device = candle_core::Device::Cpu;
        let quantized_host = quantized.as_slice::<u32>().to_vec();
        let packed_columns = quantized.dim(1) as usize;
        let quantized_tensor = candle_core::Tensor::from_vec(quantized_host, (rows, packed_columns), &device).unwrap();
        let host = |array: &mlx_rs::Array| array.as_dtype(mlx_rs::Dtype::Float32).unwrap().as_slice::<f32>().to_vec();
        let scales_tensor = candle_core::Tensor::from_vec(host(&scales), (rows, columns / 64), &device).unwrap();
        let biases_tensor = candle_core::Tensor::from_vec(host(&biases), (rows, columns / 64), &device).unwrap();
        let dequantized = candle::weights::dequantize_affine(&quantized_tensor, &scales_tensor, &biases_tensor, 64, bits as usize).unwrap();
        let actual = dequantized.flatten_all().unwrap().to_vec1::<f32>().unwrap();
        assert_eq!(actual.len(), reference.len());
        for (index, (actual, reference)) in actual.iter().zip(reference.iter()).enumerate() {
            assert!(
                (actual - reference).abs() < 2e-3,
                "bits={bits} element {index} mismatch: candle={actual} mlx={reference}"
            );
        }
    }
}

/// candle's half-split RoPE must match mlx `fast::rope(traditional=false)` (including KV cache offset semantics).
#[test]
fn candle_rope_matches_mlx_fast_rope() {
    let _guard = MLX_LOCK.lock().unwrap();
    mlx::runtime::ensure_metal_device().unwrap();
    let (batch, heads, sequence, head_dim) = (1_usize, 2_usize, 5_usize, 16_usize);
    let theta = 1_000_000.0_f32;
    for offset in [0_usize, 7] {
        let values = (0..batch * heads * sequence * head_dim)
            .map(|index| ((index % 37) as f32 / 37.0) - 0.5)
            .collect::<Vec<_>>();
        let mlx_input = mlx_rs::Array::from_slice(&values, &[batch as i32, heads as i32, sequence as i32, head_dim as i32]);
        let mlx_output = mlx_rs::fast::rope(&mlx_input, head_dim as i32, false, theta, 1.0, offset as i32, None).unwrap();
        let reference = mlx_output.as_dtype(mlx_rs::Dtype::Float32).unwrap().as_slice::<f32>().to_vec();

        let device = candle_core::Device::Cpu;
        let candle_input = candle_core::Tensor::from_vec(values.clone(), (batch, heads, sequence, head_dim), &device).unwrap();
        let candle_output = candle::layers::rope(&candle_input, theta, offset).unwrap();
        let actual = candle_output.flatten_all().unwrap().to_vec1::<f32>().unwrap();
        for (index, (actual, reference)) in actual.iter().zip(reference.iter()).enumerate() {
            assert!(
                (actual - reference).abs() < 1e-4,
                "offset={offset} element {index} mismatch: candle={actual} mlx={reference}"
            );
        }
    }
}

/// Real-model parity: candle and mlx should produce the same greedy transcript for the same audio (same weight values, same greedy decoding; only the floating-point summation order differs).
/// The MLX build must be optimized (see the file header).
#[test]
#[ignore = "needs CUCCUT_TEST_MODELS_DIR with Qwen3-ASR 0.6B installed; run with --release"]
fn candle_qwen3_transcription_matches_mlx() {
    let Some(files) = verified(ASR_REPO, "qwen3-asr", "asr") else {
        return;
    };
    let config: Value = serde_json::from_slice(&std::fs::read(files.require("config.json").unwrap()).unwrap()).unwrap();
    let config = Qwen3Config::parse(&config).unwrap();
    let weights = files.require_extension("safetensors").unwrap();
    let tokenizer = || TokenizerFiles {
        vocabulary: files.require("vocab.json").unwrap(),
        merges: files.path("merges.txt"),
        config: files.path("tokenizer_config.json"),
    };
    let audio = audio("test-sample.wav");
    let request = RecognitionRequest {
        language: Some("en"),
        context: None,
    };

    let mlx_text = {
        let _guard = MLX_LOCK.lock().unwrap();
        let mut model = mlx::qwen3::Qwen3Asr::load(config, &weights, tokenizer()).expect("load mlx Qwen3");
        model.recognize(&audio, &request).unwrap().text
    };
    let mut model = candle::Qwen3Asr::load(config, &weights, tokenizer(), &candle_core::Device::Cpu).expect("load candle Qwen3");
    let candle_text = model.recognize(&audio, &request).unwrap().text;
    assert_eq!(
        normalize(&candle_text),
        normalize(&mlx_text),
        "candle=\"{candle_text}\" mlx=\"{mlx_text}\""
    );
}

/// Silero VAD per-chunk probability parity: on the same waveform, the probability difference between the two backends should be negligible.
#[test]
#[ignore = "needs CUCCUT_TEST_MODELS_DIR with Silero VAD installed"]
fn candle_silero_probabilities_match_mlx() {
    let Some(files) = verified(VAD_REPO, "silero-vad", "vad") else {
        return;
    };
    let weights = files.require_extension("safetensors").unwrap();
    let samples = (0..512 * 20).map(|index| (index as f32 * 0.03).sin() * 0.4).collect::<Vec<_>>();
    let mlx_probabilities = {
        let _guard = MLX_LOCK.lock().unwrap();
        let mut vad = mlx::silero::SileroVad::load(&weights).unwrap();
        vad.process_chunks(&samples).unwrap()
    };
    let mut vad = candle::SileroVad::load(&weights).unwrap();
    let candle_probabilities = vad.process_chunks(&samples).unwrap();
    assert_eq!(mlx_probabilities.len(), candle_probabilities.len());
    for (index, (mlx, candle)) in mlx_probabilities.iter().zip(candle_probabilities.iter()).enumerate() {
        assert!((mlx - candle).abs() < 0.02, "block {index} probability mismatch: candle={candle} mlx={mlx}");
    }
}

/// Word-level timestamp parity: the forced aligner must produce the same word order on both backends, and timestamp differences must be ≤0.08s (one timestamp quantization step).
#[test]
#[ignore = "needs CUCCUT_TEST_MODELS_DIR with the forced aligner installed"]
fn candle_aligner_timestamps_match_mlx() {
    let Some(files) = verified(ALIGNER_REPO, "qwen3-forced-aligner", "aligner") else {
        return;
    };
    let audio = audio("test-sample.wav");
    let text = "Testing one two three CucCut is ready";

    let mlx_words = {
        let _guard = MLX_LOCK.lock().unwrap();
        let mut aligner = mlx::aligner::ForcedAligner::load(&files).unwrap();
        aligner.align(&audio, text, Some("en")).unwrap()
    };
    let mut aligner = candle::ForcedAligner::load(&files, &candle_core::Device::Cpu).unwrap();
    let candle_words = aligner.align(&audio, text, Some("en")).unwrap();
    assert_eq!(mlx_words.len(), candle_words.len());
    for (mlx, candle) in mlx_words.iter().zip(candle_words.iter()) {
        assert_eq!(mlx.text, candle.text);
        assert!(
            (mlx.start - candle.start).abs() <= 0.08 + 1e-6,
            "word {} start mismatch: candle={} mlx={}",
            mlx.text,
            candle.start,
            mlx.start
        );
        assert!(
            (mlx.end - candle.end).abs() <= 0.08 + 1e-6,
            "word {} end mismatch: candle={} mlx={}",
            mlx.text,
            candle.end,
            mlx.end
        );
    }
}

/// MOSS transcription parity: mlx runs in bf16 (quality, no load-time quantization), candle runs in f32; with the same weight values, the greedy-decoded text should match. Speaker segment times may drift slightly due to floating-point differences.
#[test]
#[ignore = "needs CUCCUT_TEST_MODELS_DIR with MOSS Transcribe Diarize installed"]
fn candle_moss_transcription_matches_mlx() {
    let Some(files) = verified(MOSS_REPO, "moss-transcribe-diarize", "asr") else {
        return;
    };
    let audio = audio("test-sample.wav");

    let mlx_result = {
        let _guard = MLX_LOCK.lock().unwrap();
        let mut model = mlx::moss::MossTranscribeDiarize::load_with_preference(&files, "quality").expect("load mlx MOSS");
        model.transcribe_diarized(&audio, None).unwrap()
    };
    let mut model = candle::MossTranscribeDiarize::load(&files, &candle_core::Device::Cpu).expect("load candle MOSS");
    let candle_result = model.transcribe_diarized(&audio, None).unwrap();

    assert_eq!(
        normalize(&candle_result.text),
        normalize(&mlx_result.text),
        "candle=\"{}\" mlx=\"{}\"",
        candle_result.text,
        mlx_result.text
    );
    assert_eq!(mlx_result.rows.len(), candle_result.rows.len());
    for (mlx, candle) in mlx_result.rows.iter().zip(candle_result.rows.iter()) {
        assert!(
            (mlx.start - candle.start).abs() <= 0.5 && (mlx.end - candle.end).abs() <= 0.5,
            "row time mismatch: candle=[{}, {}] mlx=[{}, {}]",
            candle.start,
            candle.end,
            mlx.start,
            mlx.end
        );
    }
}

/// Pyannote segmentation parity: the same batch of windows is fed to both backends, and the **decoded quantities** must match.
///
/// Both sides share the `pyannote_common` decoding (softmax → sum per speaker → hysteresis binarization), so what actually determines the output is the per-frame speaker probability sums and the binarized tracks, not which class wins the argmax. Three assertions each cover one layer: probabilities (numerical layer), tracks (decision layer), argmax (localization layer). Comparing argmax alone is not enough: when MLX gives a frame probability of 0.51 and candle 0.49, the argmax is identical but the segment boundary has already flipped.
///
/// History: when candle's `Conv1d::load` omitted `contiguous()` after the permute, 156/589 frames of window 0 disagreed (see the comment there).
#[test]
#[ignore = "needs CUCCUT_TEST_MODELS_DIR with Pyannote installed"]
fn candle_pyannote_classes_match_mlx() {
    use model_runtime::speech::pyannote_common::{
        FRAMES_PER_WINDOW, LOCAL_SPEAKERS, STEP_SAMPLES, WINDOW_SAMPLES, argmax_classes, binarize_speaker_track, speaker_probabilities,
    };

    let Some(files) = verified(PYANNOTE_REPO, "pyannote-segmentation", "segmentation") else {
        return;
    };
    let audio = audio("test-sample.wav");

    // Three windows: one at the start, one offset by one sliding-window step, and one ending in zero-padded windows.
    const BATCH: usize = 3;
    let mut packed = vec![0.0_f32; BATCH * WINDOW_SAMPLES];
    let starts = [0, STEP_SAMPLES.min(audio.len()), audio.len().saturating_sub(WINDOW_SAMPLES)];
    for (index, start) in starts.into_iter().enumerate() {
        let end = (start + WINDOW_SAMPLES).min(audio.len());
        let slot = &mut packed[index * WINDOW_SAMPLES..(index + 1) * WINDOW_SAMPLES];
        slot[..end - start].copy_from_slice(&audio[start..end]);
    }

    let mlx_logits = {
        let _guard = MLX_LOCK.lock().unwrap();
        let mut model = mlx::pyannote::PyannoteDiarizer::load(&files).unwrap();
        model.frame_logits(&packed, BATCH).unwrap()
    };
    let mut candle_model = candle::PyannoteDiarizer::load(&files, &candle_core::Device::Cpu).unwrap();
    let candle_logits = candle_model.frame_logits(&packed, BATCH).unwrap();

    assert_eq!(mlx_logits.len(), BATCH);
    assert_eq!(candle_logits.len(), BATCH);
    for (window, (mlx, candle)) in mlx_logits.iter().zip(candle_logits.iter()).enumerate() {
        let mlx_probabilities = speaker_probabilities(mlx);
        let candle_probabilities = speaker_probabilities(candle);
        for local in 0..LOCAL_SPEAKERS {
            assert_eq!(mlx_probabilities[local].len(), FRAMES_PER_WINDOW);
            assert_eq!(candle_probabilities[local].len(), FRAMES_PER_WINDOW);
            // Bit-exact equality is unrealistic given the f32 accumulation differences in BiLSTM; 1e-2 is a magnitude that catches weight-reading errors at the wrong level without flapping from accumulated error.
            let worst = mlx_probabilities[local]
                .iter()
                .zip(candle_probabilities[local].iter())
                .map(|(left, right)| (left - right).abs())
                .fold(0.0_f32, f32::max);
            assert!(worst <= 1e-2, "window {window} speaker {local} max probability deviation {worst}");

            let mlx_track = binarize_speaker_track(&mlx_probabilities[local]);
            let candle_track = binarize_speaker_track(&candle_probabilities[local]);
            let mismatched = mlx_track
                .iter()
                .zip(candle_track.iter())
                .filter(|(left, right)| left != right)
                .count();
            // When probabilities sit near onset/offset, binarization may flip; keep the 1% tolerance.
            assert!(
                mismatched * 100 <= FRAMES_PER_WINDOW,
                "window {window} speaker {local} has {mismatched}/{FRAMES_PER_WINDOW} frames with mismatched activity state"
            );
        }

        // argmax no longer takes part in decoding; it is kept only to localize differences to a network layer.
        let mismatched = argmax_classes(mlx)
            .into_iter()
            .zip(argmax_classes(candle))
            .filter(|(left, right)| left != right)
            .count();
        assert!(
            mismatched * 100 <= FRAMES_PER_WINDOW,
            "window {window} has {mismatched}/{FRAMES_PER_WINDOW} frames with mismatched argmax class"
        );
    }
}

/// WeSpeaker speaker-embedding parity: the same audio is fed to both backends, and the 256-dim embeddings must match element by element.
///
/// If the flatten order before statistics pooling is wrong (MLX is NHWC `[B,F',T',C]` transposed to C·F, while candle is NCHW reshaped directly), the embedding is still 256-dim, still L2-normalized, and speakers are still separable, but the values are all wrong. Only a cosine distance plus per-dimension differences pin this error down.
#[test]
#[ignore = "needs CUCCUT_TEST_MODELS_DIR with WeSpeaker installed"]
fn candle_wespeaker_embedding_matches_mlx() {
    let Some(files) = verified(WESPEAKER_REPO, "wespeaker", "speaker") else {
        return;
    };
    for name in ["test-sample.wav", "chinese-sample.wav"] {
        let audio = audio(name);
        let mlx = {
            let _guard = MLX_LOCK.lock().unwrap();
            let mut embedder = mlx::wespeaker::WeSpeakerEmbedder::load(&files).unwrap();
            SpeakerEmbedding::embed(&mut embedder, &audio).unwrap()
        };
        let mut embedder = candle::WeSpeakerEmbedder::load(&files, &candle_core::Device::Cpu).unwrap();
        let candle = SpeakerEmbedding::embed(&mut embedder, &audio).unwrap();

        assert_eq!(mlx.len(), EMBEDDING_DIM);
        assert_eq!(candle.len(), EMBEDDING_DIM);
        let distance = cosine_distance(&mlx, &candle);
        assert!(distance < 1e-3, "{name}: embedding cosine distance between the two backends {distance:.6} is too large");
        let worst = mlx
            .iter()
            .zip(&candle)
            .map(|(left, right)| (left - right).abs())
            .fold(0.0_f32, f32::max);
        assert!(worst < 5e-3, "{name}: max per-dimension difference {worst:.6} is too large");
    }
}

fn fixture(name: &str) -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures").join(name)
}

fn audio(name: &str) -> Vec<f32> {
    decode_mono(&fixture(name), 16_000).expect("decode fixture")
}

/// Resolves a component's files from `<models-root>/<repo>/.ccut-manifest.json`; returns `None` and prints the reason if the weights are absent.
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

fn normalize(text: &str) -> String {
    text.to_lowercase()
        .chars()
        .filter(|character| character.is_alphanumeric() || character.is_whitespace())
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}
