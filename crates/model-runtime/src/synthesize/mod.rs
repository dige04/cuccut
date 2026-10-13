//! Speech synthesis (local TTS): request and result types, the engine trait, each engine implementation, and the parts they share.
//!
//! Ported from v2's `ccut-tts-core` (types, chunking, WAV, built-in voice metadata) and `ccut-tts` (engine trait, Qwen3-TTS, bundled recordings). The only difference from v2 is at the boundary: v2 finds files by "model directory + relative path", while here everything is fetched through [`crate::bundle::VerifiedFiles`] by manifest (missing file → `MODEL_NOT_INSTALLED`, missing component → `MODEL_UNSUPPORTED`, backend load failures are passed through as-is); reference audio decoding goes through [`crate::audio::decode_mono`]. Tensors and devices go through the `tensor` facade: on Apple Silicon it is MLX (device and cache via `crate::backend::mlx::runtime`); on other platforms with `backend-candle` enabled it is candle CPU/CUDA (the same adaptation layer as v2).
//!
//! Shared parts, reused directly by the following engines (IndexTTS2 / 2.5, GPT-SoVITS, VoxCPM2, OmniVoice):
//! - [`types`]: request / result / progress / engine kind;
//! - [`text`]: long-text chunking (with the boundary level after each chunk), sentence splitting, rough language detection;
//! - [`voices`]: the eight built-in voices (metadata, bundled recordings, resolution of clone references);
//! - [`wav`]: 16-bit PCM WAV read/write;
//! - [`resample`]: band-limited interpolation resampling;
//! - [`loudness`]: peak ceiling on synthesis results (−1 dBFS, scale down only);
//! - [`stitch`]: stitching after per-chunk synthesis (trims leading and trailing silence at chunk boundaries, inserts fixed pauses by boundary level, aligns loudness to the first chunk);
//! - `layers` / `weights` / `sampling` in `qwen3_tts` (`pub(crate)`): the other v2 engines take the KV cache, linear layers, causal convolution, weight store and random numbers from here.
//!
//! An engine instance holds weights and KV cache and is not `Send`: it is loaded and synthesized on the same thread.

pub mod gpt_sovits;
pub mod index_tts2;
pub mod job;
pub mod loudness;
pub mod omnivoice;
pub mod qwen3_tts;
pub mod readings;
pub mod resample;
pub mod stitch;
#[cfg(any(
    feature = "backend-candle",
    all(feature = "backend-mlx", target_os = "macos", target_arch = "aarch64")
))]
pub mod tensor;
pub mod text;
pub mod types;
pub mod voices;
pub mod voxcpm2;
pub mod wav;

pub use types::{ReadingsSupport, SamplingOptions, TtsAudio, TtsEngineKind, TtsProgress, TtsRequest, VoiceSpec};

use crate::bundle::VerifiedFiles;
use crate::protocol::{ErrorBody, codes};
use anyhow::Result;
use serde_json::json;

/// Progress callback; returning `false` requests cancellation, and the engine should return an error at the next safe point.
pub type ProgressSink<'a> = &'a mut dyn FnMut(TtsProgress) -> bool;

/// A loaded local TTS model. The implementation holds all weights and the KV cache and is not `Sync`; the caller guarantees that only one synthesis runs at a time (two copies of a model cannot run in parallel on a 16 GiB Mac).
pub trait TtsEngine {
    fn kind(&self) -> TtsEngineKind;

    /// Output sample rate (Hz).
    fn sample_rate(&self) -> u32;

    /// Preset speaker list (CustomVoice); clone-only models return an empty list.
    fn preset_speakers(&self) -> Vec<String> {
        Vec::new()
    }

    /// Renders `<char|reading>` annotations into text this engine can consume. By default, dispatches via [`TtsEngineKind::readings_support`] to the pure function [`readings::render`]; `Unsupported` means the surface text with all annotations dropped. Engines that need in-model information (IndexTTS2's vocabulary pinyin pieces) override it. If the rendering changes, [`TtsEngineKind::output_revision`] must be bumped.
    fn render_readings(&self, annotated: &readings::Annotated) -> readings::Rendered {
        readings::render(self.kind().readings_support(), annotated, None)
    }

    /// Synthesizes the whole text. For long text, the implementation chunks it itself, generates chunk by chunk, and concatenates the results.
    fn synthesize(&mut self, request: &TtsRequest, progress: ProgressSink<'_>) -> Result<TtsAudio>;
}

/// Verified files needed for synthesis: the main model, plus the companion components the engine requires.
#[derive(Debug, Clone, Copy)]
pub struct EngineFiles<'a> {
    /// Main model (Qwen3-TTS: `config.json` + `*.safetensors` + `vocab.json` / `merges.txt` / `tokenizer_config.json`; GPT-SoVITS: chinese-hubert, chinese-roberta, T2S and SoVITS are all in this one component).
    pub model: &'a VerifiedFiles,
    /// Speech tokenizer / codec (Qwen3-TTS: the `*.safetensors` of `Qwen/Qwen3-TTS-Tokenizer-12Hz`).
    /// VoxCPM2 does not need it; OmniVoice's audio tokenizer is under `audio_tokenizer/` in the main model component, and it does not use this either.
    pub codec: Option<&'a VerifiedFiles>,
    /// Auxiliary weights (IndexTTS 2.5: the whole IndexTTS2 repository, of which only the w2v-BERT, CAM++, BigVGAN and statistics under `aux/` are read).
    /// Other engines do not need it.
    pub aux: Option<&'a VerifiedFiles>,
}

/// Whether this build has a usable local TTS backend: MLX on Apple Silicon, or candle on any platform (CPU; NVIDIA GPU when `cuda` is enabled).
pub const fn local_tts_available() -> bool {
    cfg!(any(
        feature = "backend-candle",
        all(feature = "backend-mlx", target_os = "macos", target_arch = "aarch64")
    ))
}

/// Whether this engine can load in this build. Engines that have not been ported return `false`.
pub const fn engine_available(kind: TtsEngineKind) -> bool {
    match kind {
        TtsEngineKind::Qwen3Tts => local_tts_available(),
        TtsEngineKind::VoxCpm2 => local_tts_available(),
        TtsEngineKind::OmniVoice => local_tts_available(),
        TtsEngineKind::GptSovits => local_tts_available(),
        TtsEngineKind::IndexTts2 | TtsEngineKind::IndexTts25 => local_tts_available(),
    }
}

/// The main-model families (`components.tts.family`) this build can load, in the order of [`TtsEngineKind::ALL`].
/// `synthesizeFamilies` in `worker.hello` is this list; the Runtime does not hand this Worker any family that is not listed (protocol spec §2.1).
pub fn available_families() -> Vec<&'static str> {
    TtsEngineKind::ALL
        .into_iter()
        .filter(|kind| engine_available(*kind))
        .map(TtsEngineKind::family)
        .collect()
}

/// Loads one engine. The caller does not need to confirm the device beforehand: the implementation calls `tensor::host::ensure_device` first (MLX uses Metal; candle uses this process's default device).
///
/// The [`ErrorBody`] in the error (missing file, missing component, no such engine) can be recovered with `downcast_ref` and reported as-is; anything else is a load failure. Returned engines are all wrapped in [`readings::Annotating`]: `<char|reading>` annotations are rendered per engine at this point, and readings that cannot be voiced are recorded in [`TtsAudio::readings_dropped`]; the outermost layer is [`loudness::PeakLimited`]: if the peak of the whole clip is above −1 dBFS, the clip is scaled down to that level.
pub fn load(kind: TtsEngineKind, files: EngineFiles<'_>) -> Result<Box<dyn TtsEngine>> {
    if !engine_available(kind) {
        return Err(unsupported_engine(kind).into());
    }
    let annotating = readings::Annotating::new(load_available(kind, files)?);
    Ok(Box::new(loudness::PeakLimited::new(Box::new(annotating))))
}

#[cfg(any(
    feature = "backend-candle",
    all(feature = "backend-mlx", target_os = "macos", target_arch = "aarch64")
))]
fn load_available(kind: TtsEngineKind, files: EngineFiles<'_>) -> Result<Box<dyn TtsEngine>> {
    match kind {
        TtsEngineKind::Qwen3Tts => {
            let codec = files.codec.ok_or_else(|| missing_component("codec"))?;
            Ok(Box::new(qwen3_tts::Qwen3Tts::load(files.model, codec)?))
        }
        TtsEngineKind::VoxCpm2 => Ok(Box::new(voxcpm2::VoxCpm2::load(files.model)?)),
        TtsEngineKind::OmniVoice => Ok(Box::new(omnivoice::OmniVoice::load(files.model)?)),
        TtsEngineKind::GptSovits => Ok(Box::new(gpt_sovits::GptSovits::load(files.model)?)),
        TtsEngineKind::IndexTts2 => Ok(Box::new(index_tts2::IndexTts2::load(files.model)?)),
        TtsEngineKind::IndexTts25 => {
            let aux = files.aux.ok_or_else(|| missing_component("aux"))?;
            Ok(Box::new(index_tts2::IndexTts25::load(files.model, aux)?))
        }
    }
}

#[cfg(not(any(
    feature = "backend-candle",
    all(feature = "backend-mlx", target_os = "macos", target_arch = "aarch64")
)))]
fn load_available(kind: TtsEngineKind, _files: EngineFiles<'_>) -> Result<Box<dyn TtsEngine>> {
    Err(unsupported_engine(kind).into())
}

fn unsupported_engine(kind: TtsEngineKind) -> ErrorBody {
    ErrorBody::new(
        codes::MODEL_UNSUPPORTED,
        format!("the {} engine is not available in this build", kind.as_str()),
    )
    .with_details(json!({ "engine": kind.as_str(), "reason": "engine-unavailable" }))
}

#[cfg_attr(
    not(any(
        feature = "backend-candle",
        all(feature = "backend-mlx", target_os = "macos", target_arch = "aarch64")
    )),
    allow(dead_code)
)]
fn missing_component(component: &str) -> ErrorBody {
    ErrorBody::new(codes::MODEL_UNSUPPORTED, format!("the bundle has no {component} component"))
        .with_details(json!({ "component": component, "reason": "missing-component" }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::bundle::{FAMILY_QWEN3_TTS, FileEntry, ModelFiles};

    fn empty_files() -> VerifiedFiles {
        let dir = tempfile::tempdir().unwrap();
        ModelFiles {
            family: FAMILY_QWEN3_TTS.into(),
            revision: "r".into(),
            dir: dir.path().to_string_lossy().into_owned(),
            files: Vec::<FileEntry>::new(),
        }
        .verify("tts")
        .unwrap()
    }

    fn error_of(result: Result<Box<dyn TtsEngine>>) -> ErrorBody {
        match result {
            Ok(_) => panic!("loading should not have succeeded"),
            Err(error) => error.downcast_ref::<ErrorBody>().expect("ErrorBody").clone(),
        }
    }

    #[test]
    fn engines_not_ported_yet_are_unsupported() {
        let model = empty_files();
        for kind in TtsEngineKind::ALL {
            if engine_available(kind) {
                continue;
            }
            assert!(!engine_available(kind));
            let error = error_of(load(
                kind,
                EngineFiles {
                    model: &model,
                    codec: None,
                    aux: None,
                },
            ));
            assert_eq!(error.code, codes::MODEL_UNSUPPORTED, "{kind:?}");
            assert_eq!(error.details.unwrap()["reason"], "engine-unavailable");
        }
    }

    #[cfg(any(
        feature = "backend-candle",
        all(feature = "backend-mlx", target_os = "macos", target_arch = "aarch64")
    ))]
    #[test]
    fn qwen3_tts_needs_its_codec_component_and_listed_files() {
        let model = empty_files();
        let error = error_of(load(
            TtsEngineKind::Qwen3Tts,
            EngineFiles {
                model: &model,
                codec: None,
                aux: None,
            },
        ));
        assert_eq!(error.code, codes::MODEL_UNSUPPORTED);
        assert_eq!(error.details.unwrap()["component"], "codec");

        // There is a codec component, but the main model does not list config.json: a missing file is MODEL_NOT_INSTALLED, reported before touching Metal.
        let codec = empty_files();
        let error = error_of(load(
            TtsEngineKind::Qwen3Tts,
            EngineFiles {
                model: &model,
                codec: Some(&codec),
                aux: None,
            },
        ));
        assert_eq!(error.code, codes::MODEL_NOT_INSTALLED);
        assert_eq!(error.details.unwrap()["file"], "config.json");
    }

    /// VoxCPM2 / OmniVoice only need the main model component; a file the manifest does not list is MODEL_NOT_INSTALLED, reported before touching Metal.
    #[cfg(any(
        feature = "backend-candle",
        all(feature = "backend-mlx", target_os = "macos", target_arch = "aarch64")
    ))]
    #[test]
    fn voxcpm2_and_omnivoice_need_their_listed_files() {
        use crate::bundle::{FAMILY_OMNIVOICE, FAMILY_VOXCPM2};

        fn listed(family: &str, paths: &[&str]) -> (tempfile::TempDir, VerifiedFiles) {
            let dir = tempfile::tempdir().unwrap();
            let files = paths
                .iter()
                .map(|path| {
                    let full = dir.path().join(path);
                    std::fs::create_dir_all(full.parent().unwrap()).unwrap();
                    std::fs::write(&full, b"{}").unwrap();
                    FileEntry {
                        path: (*path).to_owned(),
                        sha256: String::new(),
                        byte_length: 2,
                    }
                })
                .collect();
            let verified = ModelFiles {
                family: family.into(),
                revision: "r".into(),
                dir: dir.path().to_string_lossy().into_owned(),
                files,
            }
            .verify("tts")
            .unwrap();
            (dir, verified)
        }
        fn files(model: &VerifiedFiles) -> EngineFiles<'_> {
            EngineFiles {
                model,
                codec: None,
                aux: None,
            }
        }

        let (_dir, model) = listed(FAMILY_VOXCPM2, &["config.json", "tokenizer.json"]);
        let error = error_of(load(TtsEngineKind::VoxCpm2, files(&model)));
        assert_eq!(error.code, codes::MODEL_NOT_INSTALLED);
        assert_eq!(error.details.unwrap()["file"], "model.safetensors");

        let (_dir, model) = listed(FAMILY_OMNIVOICE, &["config.json", "tokenizer.json", "model.safetensors"]);
        let error = error_of(load(TtsEngineKind::OmniVoice, files(&model)));
        assert_eq!(error.code, codes::MODEL_NOT_INSTALLED);
        assert_eq!(error.details.unwrap()["file"], "audio_tokenizer/");

        let (_dir, model) = listed(
            FAMILY_OMNIVOICE,
            &["config.json", "tokenizer.json", "model.safetensors", "audio_tokenizer/config.json"],
        );
        let error = error_of(load(TtsEngineKind::OmniVoice, files(&model)));
        assert_eq!(error.code, codes::MODEL_NOT_INSTALLED);
        assert_eq!(error.details.unwrap()["file"], "audio_tokenizer/model.safetensors");
    }

    #[cfg(any(
        feature = "backend-candle",
        all(feature = "backend-mlx", target_os = "macos", target_arch = "aarch64")
    ))]
    #[test]
    fn gpt_sovits_reports_the_first_unlisted_file_before_touching_metal() {
        use crate::bundle::FAMILY_GPT_SOVITS;

        let dir = tempfile::tempdir().unwrap();
        let model = ModelFiles {
            family: FAMILY_GPT_SOVITS.into(),
            revision: "r".into(),
            dir: dir.path().to_string_lossy().into_owned(),
            files: Vec::<FileEntry>::new(),
        }
        .verify("tts")
        .unwrap();
        // GPT-SoVITS has only one component: whether a codec is given is not checked.
        let error = error_of(load(
            TtsEngineKind::GptSovits,
            EngineFiles {
                model: &model,
                codec: None,
                aux: None,
            },
        ));
        assert_eq!(error.code, codes::MODEL_NOT_INSTALLED);
        assert_eq!(error.details.unwrap()["file"], "chinese-hubert-base/model.safetensors");
    }

    #[cfg(any(
        feature = "backend-candle",
        all(feature = "backend-mlx", target_os = "macos", target_arch = "aarch64")
    ))]
    #[test]
    fn index_tts_needs_its_components_and_listed_files_before_touching_metal() {
        let model = empty_files();
        let files = |aux| EngineFiles {
            model: &model,
            codec: None,
            aux,
        };
        // 2.0 has only one component: if config.yaml is not listed, the default configuration is used, and then bpe.model is missing.
        let error = error_of(load(TtsEngineKind::IndexTts2, files(None)));
        assert_eq!(error.code, codes::MODEL_NOT_INSTALLED);
        assert_eq!(error.details.unwrap()["file"], "bpe.model");
        // 2.5 first requires the aux component, then the main model's config.yaml.
        let error = error_of(load(TtsEngineKind::IndexTts25, files(None)));
        assert_eq!(error.code, codes::MODEL_UNSUPPORTED);
        assert_eq!(error.details.unwrap()["component"], "aux");
        let aux = empty_files();
        let error = error_of(load(TtsEngineKind::IndexTts25, files(Some(&aux))));
        assert_eq!(error.code, codes::MODEL_NOT_INSTALLED);
        assert_eq!(error.details.unwrap()["file"], "config.yaml");
    }
}
