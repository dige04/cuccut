//! Model bundle description (protocol spec §4) and file checks before loading.
//!
//! The Runtime hands the Worker all files of a model bundle explicitly. The Worker does not scan directories or read the manifest; it reads only the files listed in `files`, and checks each one for existence and size before loading. The sha256 is verified by the Runtime at install and registration time and is not rechecked here.
//!
//! Engines ported from v2 locate files by "model directory + relative path" (`model_dir.join(..)`, `read_dir` filtered by extension, subdirectories). During porting, these forms are replaced by same-named queries on [`VerifiedFiles`], so the directory itself is no longer touched:
//!
//! | v2 form | replaced by |
//! |---|---|
//! | `model_dir.join("config.json")` | [`VerifiedFiles::require`] (for optional files, [`VerifiedFiles::path`]) |
//! | `read_dir(model_dir)` taking `*.safetensors` (not recursive) | [`VerifiedFiles::require_extension_in`]`("", "safetensors")` |
//! | `model_dir.join("qwen")` handed to a sub-loader | [`VerifiedFiles::require_subdirectory`]`("qwen")` |
//! | file set taken per component | [`VerifiedBundle::component`]`("aligner")` |
//! | whole directory handed to the framework (CoreML's `X.mlmodelc`) | [`VerifiedFiles::require_directory`]`("AudioEncoder.mlmodelc")` |
//!
//! Errors from these queries are [`ErrorBody`] (`MODEL_NOT_INSTALLED` / `MODEL_UNSUPPORTED`) and can be passed straight into `anyhow` with `?`. The backend's load-failure handling passes them through unchanged rather than rewriting them as load failures.

use std::path::{Component, Path, PathBuf};

use serde::{Deserialize, Serialize};
use serde_json::json;

use crate::protocol::{ErrorBody, codes};

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ModelBundle {
    pub bundle_id: String,
    /// `mlx` | `coreml` | `candle`. Taken as a string; an unrecognized backend is `MODEL_UNSUPPORTED`, not `INVALID_PARAMS`.
    pub backend: String,
    pub device: String,
    pub components: Components,
    pub threads: u32,
    #[serde(default)]
    pub memory_budget_bytes: Option<u64>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Components {
    #[serde(default)]
    pub asr: Option<ModelFiles>,
    #[serde(default)]
    pub vad: Option<ModelFiles>,
    #[serde(default)]
    pub aligner: Option<ModelFiles>,
    #[serde(default)]
    pub speaker: Option<ModelFiles>,
    /// Speaker segmentation (Pyannote segmentation). It comes from the "speaker diarization" bundle together with `speaker`. When the transcription model does not diarize speakers itself, the Runtime attaches it to the recognition bundle (§6.6). Having `speaker` without it is not enough to diarize.
    #[serde(default)]
    pub segmentation: Option<ModelFiles>,
    /// Tokenizer files for a recognition model taken from another repository (Whisper's `tokenizer.json` and others, taken from `openai/whisper-large-v3`).
    #[serde(default)]
    pub tokenizer: Option<ModelFiles>,
    /// The main model for local speech synthesis (§4.1). A bundle that includes it is a synthesis bundle and does not need `asr` / `vad`.
    #[serde(default)]
    pub tts: Option<ModelFiles>,
    /// The speech codec used for synthesis (Qwen3-TTS's 12 Hz tokenizer); shared by several bundles.
    #[serde(default)]
    pub codec: Option<ModelFiles>,
    /// Auxiliary weights for synthesis (IndexTTS 2.5 takes the semantic encoder and others from the IndexTTS2 repository).
    #[serde(default)]
    pub aux: Option<ModelFiles>,
    /// Vocal and accompaniment separation model (HTDemucs-FT). A bundle that includes it is a separation bundle and includes no other components.
    #[serde(default)]
    pub separator: Option<ModelFiles>,
    /// Local text-to-image model (§4.2, Qwen-Image: text encoder, DiT, VAE and tokenizer in one repository). A bundle that includes it does only text-to-image.
    #[serde(default)]
    pub image: Option<ModelFiles>,
}

impl Components {
    /// The bundle includes a synthesis component (one of `tts` / `codec` / `aux`).
    pub fn has_speech(&self) -> bool {
        self.tts.is_some() || self.codec.is_some() || self.aux.is_some()
    }
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ModelFiles {
    /// Decides the loader. Taken as a string: an unknown family returns `MODEL_UNSUPPORTED` (§4).
    pub family: String,
    pub revision: String,
    pub dir: String,
    pub files: Vec<FileEntry>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct FileEntry {
    pub path: String,
    pub sha256: String,
    pub byte_length: u64,
}

/// Qwen3-ASR (0.6B / 1.7B, MLX quantized): needs VAD segmentation.
pub const FAMILY_QWEN3_ASR: &str = "qwen3-asr";
/// Whisper large-v3 / large-v3-turbo CoreML bundle (`MelSpectrogram`, `AudioEncoder`, `TextDecoder` and other `.mlmodelc` directories): needs VAD segmentation; the tokenizer is in the `tokenizer` component.
pub const FAMILY_WHISPER_COREML: &str = "whisper-coreml";
/// Whisper large-v3 / large-v3-turbo MLX weights (mlx-community's fp16 conversion: `config.json` + safetensors): needs VAD segmentation; the tokenizer and `generation_config.json` are in the `tokenizer` component.
pub const FAMILY_WHISPER_MLX: &str = "whisper-mlx";
/// Whisper large-v3 / large-v3-turbo whisper.cpp single-file GGML weights (`ggml-*.bin`, vocabulary embedded): needs VAD segmentation; no tokenizer.
pub const FAMILY_WHISPER_GGML: &str = "whisper-ggml";
/// Whisper's tokenizer files (the `openai/whisper-large-v3` repository); large-v3 and turbo share one copy.
pub const FAMILY_WHISPER_TOKENIZER: &str = "whisper-tokenizer";
/// MOSS-Transcribe-Diarize (MLX): segments the audio by itself and carries speaker labels; no VAD.
pub const FAMILY_MOSS_TRANSCRIBE_DIARIZE: &str = "moss-transcribe-diarize";
pub const FAMILY_SILERO_VAD: &str = "silero-vad";
pub const FAMILY_QWEN3_ALIGNER: &str = "qwen3-forced-aligner";
pub const FAMILY_WESPEAKER: &str = "wespeaker";
/// Pyannote speaker segmentation (PyanNet from segmentation-3.0; safetensors from `aufklarer/Pyannote-Segmentation-MLX`).
pub const FAMILY_PYANNOTE_SEGMENTATION: &str = "pyannote-segmentation";
/// Qwen3-TTS 12 Hz main model (Base / CustomVoice / VoiceDesign, 0.6B / 1.7B).
pub const FAMILY_QWEN3_TTS: &str = "qwen3-tts";
/// Qwen3-TTS's 12 Hz speech tokenizer (codec); shared across sizes and variants.
pub const FAMILY_QWEN3_TTS_CODEC: &str = "qwen3-tts-tokenizer";
/// VoxCPM2 (`config.json` + `tokenizer.json` + `model.safetensors`, a single component).
pub const FAMILY_VOXCPM2: &str = "voxcpm2";
/// OmniVoice (main model, plus the audio tokenizer under `audio_tokenizer/` in the same component).
pub const FAMILY_OMNIVOICE: &str = "omnivoice";
/// IndexTTS2 main model.
pub const FAMILY_INDEXTTS2: &str = "indextts2";
/// IndexTTS 2.5 main model (auxiliary weights are in the `aux` component; the family is `indextts2-aux`).
pub const FAMILY_INDEXTTS25: &str = "indextts2.5";
/// GPT-SoVITS v2 (`PJMixers-Dev/lj1995_GPT-SoVITS-safetensors`): chinese-hubert, chinese-roberta, T2S and SoVITS are all in one component.
pub const FAMILY_GPT_SOVITS: &str = "gpt-sovits";
/// IndexTTS2 (`aufklarer/IndexTTS2-MLX-fp16`): GPT, S2Mel and the MaskGCT semantic codebook, plus w2v-BERT, CAM++ and BigVGAN under `aux/`, are all in one component.
pub const FAMILY_INDEX_TTS2: &str = "indextts2";
/// IndexTTS 2.5 main model (tiktoken multilingual GPT, semantic codebook decoder, S2Mel); auxiliary weights are in the `aux` component.
pub const FAMILY_INDEX_TTS25: &str = "indextts2.5";
/// The `aux` component of IndexTTS 2.5: the whole IndexTTS2 repository, of which only the w2v-BERT, CAM++, BigVGAN and statistics under `aux/` are read.
pub const FAMILY_INDEX_TTS2_AUX: &str = "indextts2-aux";
/// HTDemucs-FT (`aufklarer/HTDemucs-FT-MLX`): `htdemucs_ft_config.json` + `htdemucs_ft.safetensors`; the four sub-models are in one file.
pub const FAMILY_HTDEMUCS_FT: &str = "htdemucs-ft";
/// Qwen-Image-2.1 (`mlx-community/Qwen-Image-2.1-MLX-4bit`): the five subdirectories `processor/`, `scheduler/`, `text_encoder/`, `transformer/` and `vae/` are all in the `image` component.
pub const FAMILY_QWEN_IMAGE: &str = "qwen-image";

impl ModelFiles {
    /// Verifies the files of a single component on its own (the same checks [`verify`] applies to each component). For capabilities that do not yet have a field in [`Components`] (e.g. synthesis) and for tests: the caller chooses the component name itself.
    pub fn verify(&self, component: &'static str) -> Result<VerifiedFiles, ErrorBody> {
        verify_files(component, self)
    }
}

/// The files of a component that passed verification: only the paths listed here can be opened.
#[derive(Debug, Clone)]
pub struct VerifiedFiles {
    pub component: &'static str,
    pub family: String,
    pub revision: String,
    /// Root directory of the component (`ModelFiles::dir`). Only used by [`Self::require_directory`] to hand a whole directory to the framework.
    root: PathBuf,
    /// Prefix of a subdirectory view (`qwen/`); the component itself has the empty string. Only used to give the full relative path within the bundle in error messages.
    scope: String,
    files: Vec<(String, PathBuf, u64)>,
}

impl VerifiedFiles {
    /// Gets a listed file by relative path.
    pub fn path(&self, relative: &str) -> Option<&Path> {
        self.files
            .iter()
            .find(|(rel, _, _)| rel == relative)
            .map(|(_, path, _)| path.as_path())
    }

    /// Gets a required file; if it is not listed, `MODEL_NOT_INSTALLED`.
    pub fn require(&self, relative: &str) -> Result<&Path, ErrorBody> {
        self.path(relative).ok_or_else(|| {
            ErrorBody::new(
                codes::MODEL_NOT_INSTALLED,
                format!("模型包的 {} 组件缺少文件 {}{relative}", self.component, self.scope),
            )
            .with_details(json!({ "component": self.component, "file": format!("{}{relative}", self.scope), "reason": "not-listed" }))
        })
    }

    /// Listed files with extension `extension`, sorted by relative path.
    pub fn with_extension(&self, extension: &str) -> Vec<&Path> {
        let mut matches: Vec<_> = self
            .files
            .iter()
            .filter(|(_, path, _)| path.extension().is_some_and(|ext| ext == extension))
            .collect();
        matches.sort_by(|a, b| a.0.cmp(&b.0));
        matches.into_iter().map(|(_, path, _)| path.as_path()).collect()
    }

    /// Gets at least one `extension` file; if there is none, `MODEL_NOT_INSTALLED`.
    pub fn require_extension(&self, extension: &str) -> Result<Vec<&Path>, ErrorBody> {
        let files = self.with_extension(extension);
        if files.is_empty() {
            return Err(ErrorBody::new(
                codes::MODEL_NOT_INSTALLED,
                format!("模型包的 {} 组件没有 .{extension} 文件", self.component),
            )
            .with_details(json!({ "component": self.component, "file": format!("{}*.{extension}", self.scope), "reason": "not-listed" })));
        }
        Ok(files)
    }

    /// Files with extension `extension` located directly under `directory` (the empty string is this view's root), excluding deeper subdirectories, sorted by relative path. Corresponds to v2's `read_dir(dir)` plus the extension filter.
    pub fn with_extension_in(&self, directory: &str, extension: &str) -> Vec<&Path> {
        let directory = directory.trim_end_matches('/');
        let mut matches: Vec<_> = self
            .files
            .iter()
            .filter(|(rel, path, _)| {
                let parent = Path::new(rel).parent().unwrap_or(Path::new(""));
                parent == Path::new(directory) && path.extension().is_some_and(|ext| ext == extension)
            })
            .collect();
        matches.sort_by(|a, b| a.0.cmp(&b.0));
        matches.into_iter().map(|(_, path, _)| path.as_path()).collect()
    }

    /// Same as [`Self::with_extension_in`]; if there is none, `MODEL_NOT_INSTALLED`.
    pub fn require_extension_in(&self, directory: &str, extension: &str) -> Result<Vec<&Path>, ErrorBody> {
        let files = self.with_extension_in(directory, extension);
        if files.is_empty() {
            let directory = directory.trim_end_matches('/');
            let pattern = if directory.is_empty() {
                format!("{}*.{extension}", self.scope)
            } else {
                format!("{}{directory}/*.{extension}", self.scope)
            };
            return Err(ErrorBody::new(
                codes::MODEL_NOT_INSTALLED,
                format!("模型包的 {} 组件没有 {pattern} 文件", self.component),
            )
            .with_details(json!({ "component": self.component, "file": pattern, "reason": "not-listed" })));
        }
        Ok(files)
    }

    /// A view of all listed files under `directory`: relative paths with the `directory/` prefix removed, handed to sub-loaders that find files by directory.
    /// If no file is listed, returns `None`. Where v2 used "does the subdirectory exist" to pick a candidate directory, this takes its place.
    pub fn subdirectory(&self, directory: &str) -> Option<VerifiedFiles> {
        let directory = directory.trim_end_matches('/');
        if directory.is_empty() {
            return Some(self.clone());
        }
        let prefix = format!("{directory}/");
        let files: Vec<_> = self
            .files
            .iter()
            .filter_map(|(rel, path, size)| rel.strip_prefix(&prefix).map(|rest| (rest.to_owned(), path.clone(), *size)))
            .collect();
        (!files.is_empty()).then(|| VerifiedFiles {
            component: self.component,
            family: self.family.clone(),
            revision: self.revision.clone(),
            root: self.root.clone(),
            scope: format!("{}{prefix}", self.scope),
            files,
        })
    }

    /// The path of `directory` itself, for frameworks that load by directory (CoreML opens `X.mlmodelc` as a whole). At least one file under the directory must be listed; otherwise `None`. The framework reads all files in the directory, so the manifest must list all of them (sizes are already checked one by one in [`verify`]); the directory is not scanned here.
    pub fn directory(&self, directory: &str) -> Option<PathBuf> {
        let directory = directory.trim_end_matches('/');
        if directory.is_empty() || !is_plain_relative(directory) {
            return None;
        }
        let prefix = format!("{directory}/");
        self.files
            .iter()
            .any(|(rel, _, _)| rel.starts_with(&prefix))
            .then(|| self.root.join(&self.scope).join(directory))
    }

    /// Same as [`Self::directory`]; if no file under the directory is listed, `MODEL_NOT_INSTALLED`.
    pub fn require_directory(&self, directory: &str) -> Result<PathBuf, ErrorBody> {
        self.directory(directory).ok_or_else(|| {
            let directory = format!("{}{}/", self.scope, directory.trim_end_matches('/'));
            ErrorBody::new(
                codes::MODEL_NOT_INSTALLED,
                format!("模型包的 {} 组件缺少目录 {directory}", self.component),
            )
            .with_details(json!({ "component": self.component, "file": directory, "reason": "not-listed" }))
        })
    }

    /// Same as [`Self::subdirectory`]; if no file is listed, `MODEL_NOT_INSTALLED`.
    pub fn require_subdirectory(&self, directory: &str) -> Result<VerifiedFiles, ErrorBody> {
        self.subdirectory(directory).ok_or_else(|| {
            let directory = format!("{}{}/", self.scope, directory.trim_end_matches('/'));
            ErrorBody::new(
                codes::MODEL_NOT_INSTALLED,
                format!("模型包的 {} 组件缺少目录 {directory}", self.component),
            )
            .with_details(json!({ "component": self.component, "file": directory, "reason": "not-listed" }))
        })
    }

    pub fn total_bytes(&self) -> u64 {
        self.files.iter().map(|(_, _, size)| size).sum()
    }
}

/// A model bundle whose files have been verified.
#[derive(Debug, Clone)]
pub struct VerifiedBundle {
    pub bundle_id: String,
    pub backend: String,
    pub device: String,
    pub threads: u32,
    pub memory_budget_bytes: Option<u64>,
    pub asr: Option<VerifiedFiles>,
    pub vad: Option<VerifiedFiles>,
    pub aligner: Option<VerifiedFiles>,
    pub speaker: Option<VerifiedFiles>,
    pub segmentation: Option<VerifiedFiles>,
    pub tokenizer: Option<VerifiedFiles>,
    pub tts: Option<VerifiedFiles>,
    pub codec: Option<VerifiedFiles>,
    pub aux: Option<VerifiedFiles>,
    pub separator: Option<VerifiedFiles>,
    pub image: Option<VerifiedFiles>,
}

impl VerifiedBundle {
    /// Gets the file set by component name (`asr` / `vad` / `aligner` / `speaker` / `segmentation` / `tokenizer` / `tts` / `codec` / `aux` / `separator` / `image`). If the bundle does not include this component, it is `MODEL_UNSUPPORTED`, the same shape as `backend::load`'s check of required components. An unrecognized component name is the caller's mistake and is also reported as `MODEL_UNSUPPORTED`.
    pub fn component(&self, name: &str) -> Result<&VerifiedFiles, ErrorBody> {
        let files = match name {
            "asr" => self.asr.as_ref(),
            "vad" => self.vad.as_ref(),
            "aligner" => self.aligner.as_ref(),
            "speaker" => self.speaker.as_ref(),
            "segmentation" => self.segmentation.as_ref(),
            "tokenizer" => self.tokenizer.as_ref(),
            "tts" => self.tts.as_ref(),
            "codec" => self.codec.as_ref(),
            "aux" => self.aux.as_ref(),
            "separator" => self.separator.as_ref(),
            "image" => self.image.as_ref(),
            _ => None,
        };
        files.ok_or_else(|| {
            ErrorBody::new(codes::MODEL_UNSUPPORTED, format!("the bundle has no {name} component"))
                .with_details(json!({ "component": name, "reason": "missing-component" }))
        })
    }

    pub fn total_bytes(&self) -> u64 {
        [
            &self.asr,
            &self.vad,
            &self.aligner,
            &self.speaker,
            &self.segmentation,
            &self.tokenizer,
            &self.tts,
            &self.codec,
            &self.aux,
            &self.separator,
            &self.image,
        ]
        .into_iter()
        .flatten()
        .map(VerifiedFiles::total_bytes)
        .sum()
    }
}

/// Checks each component's path shape, existence and size. Runs before the backend and family decisions, and is platform-independent.
pub fn verify(bundle: &ModelBundle) -> Result<VerifiedBundle, ErrorBody> {
    let c = &bundle.components;
    Ok(VerifiedBundle {
        bundle_id: bundle.bundle_id.clone(),
        backend: bundle.backend.clone(),
        device: bundle.device.clone(),
        threads: bundle.threads,
        memory_budget_bytes: bundle.memory_budget_bytes,
        asr: c.asr.as_ref().map(|files| verify_files("asr", files)).transpose()?,
        vad: c.vad.as_ref().map(|files| verify_files("vad", files)).transpose()?,
        aligner: c.aligner.as_ref().map(|files| verify_files("aligner", files)).transpose()?,
        speaker: c.speaker.as_ref().map(|files| verify_files("speaker", files)).transpose()?,
        segmentation: c
            .segmentation
            .as_ref()
            .map(|files| verify_files("segmentation", files))
            .transpose()?,
        tokenizer: c.tokenizer.as_ref().map(|files| verify_files("tokenizer", files)).transpose()?,
        tts: c.tts.as_ref().map(|files| verify_files("tts", files)).transpose()?,
        codec: c.codec.as_ref().map(|files| verify_files("codec", files)).transpose()?,
        aux: c.aux.as_ref().map(|files| verify_files("aux", files)).transpose()?,
        separator: c.separator.as_ref().map(|files| verify_files("separator", files)).transpose()?,
        image: c.image.as_ref().map(|files| verify_files("image", files)).transpose()?,
    })
}

fn verify_files(component: &'static str, files: &ModelFiles) -> Result<VerifiedFiles, ErrorBody> {
    let dir = PathBuf::from(&files.dir);
    if !dir.is_absolute() {
        return Err(ErrorBody::invalid_params(format!("{component} 组件的 dir 必须是绝对路径")));
    }
    let mut verified = Vec::with_capacity(files.files.len());
    for entry in &files.files {
        if !is_plain_relative(&entry.path) {
            return Err(ErrorBody::invalid_params(format!(
                "{component} 组件的文件路径必须是 dir 之下的相对路径"
            )));
        }
        if verified.iter().any(|(rel, _, _): &(String, PathBuf, u64)| rel == &entry.path) {
            return Err(ErrorBody::invalid_params(format!("{component} 组件重复列出文件 {}", entry.path)));
        }
        let path = dir.join(&entry.path);
        let not_installed = |reason: &str, extra: serde_json::Value| {
            let mut details = json!({ "component": component, "file": entry.path, "reason": reason });
            if let (Some(details), Some(extra)) = (details.as_object_mut(), extra.as_object()) {
                details.extend(extra.clone());
            }
            ErrorBody::new(codes::MODEL_NOT_INSTALLED, format!("模型文件 {} 不可用（{reason}）", entry.path)).with_details(details)
        };
        let metadata = match std::fs::metadata(&path) {
            Ok(metadata) if metadata.is_file() => metadata,
            Ok(_) => return Err(not_installed("not-a-file", json!({}))),
            Err(_) => return Err(not_installed("missing", json!({}))),
        };
        if metadata.len() != entry.byte_length {
            return Err(not_installed(
                "size-mismatch",
                json!({ "expected": entry.byte_length, "actual": metadata.len() }),
            ));
        }
        verified.push((entry.path.clone(), path, entry.byte_length));
    }
    Ok(VerifiedFiles {
        component,
        family: files.family.clone(),
        revision: files.revision.clone(),
        root: dir,
        scope: String::new(),
        files: verified,
    })
}

/// Paths must be relative and non-empty, and must not contain `..`, a root, or a drive prefix.
fn is_plain_relative(path: &str) -> bool {
    let path = Path::new(path);
    !path.as_os_str().is_empty() && path.components().all(|component| matches!(component, Component::Normal(_)))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn bundle(dir: &Path, files: Vec<(&str, u64)>) -> ModelBundle {
        ModelBundle {
            bundle_id: "b".into(),
            backend: "mlx".into(),
            device: "metal".into(),
            components: Components {
                vad: Some(ModelFiles {
                    family: FAMILY_SILERO_VAD.into(),
                    revision: "r".into(),
                    dir: dir.to_string_lossy().into_owned(),
                    files: files
                        .into_iter()
                        .map(|(path, byte_length)| FileEntry {
                            path: path.into(),
                            sha256: String::new(),
                            byte_length,
                        })
                        .collect(),
                }),
                ..Components::default()
            },
            threads: 1,
            memory_budget_bytes: None,
        }
    }

    #[test]
    fn verify_checks_presence_size_and_shape() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("model.safetensors"), b"12345").unwrap();
        let ok = verify(&bundle(dir.path(), vec![("model.safetensors", 5)])).unwrap();
        let vad = ok.vad.unwrap();
        assert_eq!(vad.require_extension("safetensors").unwrap().len(), 1);
        assert!(vad.path("config.json").is_none());
        assert_eq!(vad.require("config.json").unwrap_err().code, codes::MODEL_NOT_INSTALLED);

        let missing = verify(&bundle(dir.path(), vec![("other.safetensors", 5)])).unwrap_err();
        assert_eq!(missing.code, codes::MODEL_NOT_INSTALLED);
        assert_eq!(missing.details.unwrap()["reason"], "missing");

        let size = verify(&bundle(dir.path(), vec![("model.safetensors", 6)])).unwrap_err();
        assert_eq!(size.details.unwrap()["reason"], "size-mismatch");

        for bad in ["../x", "/etc/passwd", "", "a/../b"] {
            assert_eq!(
                verify(&bundle(dir.path(), vec![(bad, 1)])).unwrap_err().code,
                codes::INVALID_PARAMS,
                "{bad}"
            );
        }
        assert_eq!(
            verify(&bundle(Path::new("relative"), vec![])).unwrap_err().code,
            codes::INVALID_PARAMS
        );
    }

    #[test]
    fn model_files_verify_alone_like_a_bundle_component() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("model.safetensors"), b"12345").unwrap();
        let files = bundle(dir.path(), vec![("model.safetensors", 5)]).components.vad.unwrap();
        let verified = files.verify("tts").unwrap();
        assert_eq!(verified.component, "tts");
        assert_eq!(verified.family, FAMILY_SILERO_VAD);
        assert_eq!(verified.require_extension_in("", "safetensors").unwrap().len(), 1);
        let error = verified.require("config.json").unwrap_err();
        assert_eq!(error.code, codes::MODEL_NOT_INSTALLED);
        assert_eq!(error.details.unwrap()["component"], "tts");

        let wrong_size = bundle(dir.path(), vec![("model.safetensors", 6)]).components.vad.unwrap();
        let error = wrong_size.verify("codec").unwrap_err();
        assert_eq!(error.code, codes::MODEL_NOT_INSTALLED);
        assert_eq!(error.details.unwrap()["reason"], "size-mismatch");
    }

    /// A component with a subdirectory: one safetensors file at the top level, plus another set of files under the `qwen/` subdirectory.
    fn nested() -> (tempfile::TempDir, VerifiedBundle) {
        let dir = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(dir.path().join("qwen/extra")).unwrap();
        let files = [
            ("config.json", "{}"),
            ("b.safetensors", "bb"),
            ("a.safetensors", "a"),
            ("qwen/vocab.json", "{}"),
            ("qwen/model-00002.safetensors", "22"),
            ("qwen/model-00001.safetensors", "1"),
            ("qwen/extra/deep.safetensors", "d"),
        ];
        for (path, content) in files {
            std::fs::write(dir.path().join(path), content).unwrap();
        }
        let listed = files.iter().map(|(path, content)| (*path, content.len() as u64)).collect();
        let verified = verify(&bundle(dir.path(), listed)).unwrap();
        (dir, verified)
    }

    #[test]
    fn components_are_looked_up_by_name() {
        let (_dir, verified) = nested();
        assert_eq!(verified.component("vad").unwrap().family, FAMILY_SILERO_VAD);
        for missing in ["asr", "aligner", "speaker", "tokenizer", "unknown"] {
            let error = verified.component(missing).unwrap_err();
            assert_eq!(error.code, codes::MODEL_UNSUPPORTED);
            assert_eq!(error.details.unwrap()["reason"], "missing-component");
        }
    }

    #[test]
    fn extension_queries_in_one_directory_do_not_recurse() {
        let (dir, verified) = nested();
        let vad = verified.component("vad").unwrap();
        // The original with_extension spans all listed files.
        assert_eq!(vad.with_extension("safetensors").len(), 5);
        assert_eq!(
            vad.with_extension_in("", "safetensors"),
            [dir.path().join("a.safetensors"), dir.path().join("b.safetensors")]
        );
        assert_eq!(
            vad.with_extension_in("qwen/", "safetensors"),
            [
                dir.path().join("qwen/model-00001.safetensors"),
                dir.path().join("qwen/model-00002.safetensors")
            ]
        );
        let error = vad.require_extension_in("qwen", "onnx").unwrap_err();
        assert_eq!(error.code, codes::MODEL_NOT_INSTALLED);
        assert_eq!(error.details.unwrap()["file"], "qwen/*.onnx");
    }

    #[test]
    fn subdirectory_views_strip_the_prefix_and_report_full_paths() {
        let (dir, verified) = nested();
        let vad = verified.component("vad").unwrap();
        let qwen = vad.require_subdirectory("qwen").unwrap();
        assert_eq!(qwen.component, "vad");
        assert_eq!(qwen.require("vocab.json").unwrap(), dir.path().join("qwen/vocab.json"));
        assert!(qwen.path("config.json").is_none(), "上一级的文件不在子目录视图里");
        assert_eq!(qwen.with_extension_in("", "safetensors").len(), 2);
        assert_eq!(qwen.total_bytes(), 2 + 2 + 1 + 1);
        // When a file is missing in a subdirectory view, the error gives the full relative path within the bundle.
        let error = qwen.require("tokenizer.json").unwrap_err();
        assert_eq!(error.code, codes::MODEL_NOT_INSTALLED);
        assert_eq!(error.details.unwrap()["file"], "qwen/tokenizer.json");
        let deep = qwen.require_subdirectory("extra").unwrap();
        assert_eq!(
            deep.require("deep.safetensors").unwrap(),
            dir.path().join("qwen/extra/deep.safetensors")
        );
        assert_eq!(deep.require("x").unwrap_err().details.unwrap()["file"], "qwen/extra/x");
        // A directory with no listed files: candidate directory selection relies on None; where it is required, MODEL_NOT_INSTALLED.
        assert!(vad.subdirectory("Qwen2.5-Omni-3B").is_none());
        let error = qwen.require_subdirectory("missing").unwrap_err();
        assert_eq!(error.code, codes::MODEL_NOT_INSTALLED);
        assert_eq!(error.details.unwrap()["file"], "qwen/missing/");
        // "qwen" must not match a sibling directory with the same prefix, such as "qwen-extra/".
        assert!(vad.subdirectory("qwe").is_none());
    }

    #[test]
    fn directories_are_handed_over_whole() {
        let (dir, verified) = nested();
        let vad = verified.component("vad").unwrap();
        assert_eq!(vad.require_directory("qwen/").unwrap(), dir.path().join("qwen"));
        // A directory taken from a subdirectory view; the path is still computed from the component root.
        let qwen = vad.require_subdirectory("qwen").unwrap();
        assert_eq!(qwen.require_directory("extra").unwrap(), dir.path().join("qwen/extra"));
        let error = qwen.require_directory("Model.mlmodelc").unwrap_err();
        assert_eq!(error.code, codes::MODEL_NOT_INSTALLED);
        assert_eq!(error.details.unwrap()["file"], "qwen/Model.mlmodelc/");
        // A sibling directory with the same prefix, the file itself, and out-of-bounds paths do not count as directories.
        assert!(vad.directory("qwe").is_none());
        assert!(vad.directory("config.json").is_none());
        assert!(vad.directory("").is_none());
        assert!(vad.directory("../qwen").is_none());
    }

    #[test]
    fn lookup_errors_flow_through_anyhow() {
        let (dir, verified) = nested();
        let find = || -> anyhow::Result<std::path::PathBuf> {
            let files = verified.component("vad")?;
            Ok(files.require("missing.json")?.to_path_buf())
        };
        let error = find().unwrap_err();
        let body = error.downcast_ref::<ErrorBody>().expect("ErrorBody survives the anyhow conversion");
        assert_eq!(body.code, codes::MODEL_NOT_INSTALLED);
        assert!(!error.to_string().contains(&*dir.path().to_string_lossy()), "报错不含本机绝对路径");
    }

    #[test]
    fn speech_components_parse_verify_and_count() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(dir.path().join("tts")).unwrap();
        std::fs::create_dir_all(dir.path().join("codec")).unwrap();
        std::fs::write(dir.path().join("tts/model.safetensors"), b"1234").unwrap();
        std::fs::write(dir.path().join("codec/model.safetensors"), b"12").unwrap();
        let files = |sub: &str, family: &str, size: u64| {
            json!({
                "family": family,
                "revision": "r",
                "dir": dir.path().join(sub).to_string_lossy(),
                "files": [{ "path": "model.safetensors", "sha256": "", "byteLength": size }],
            })
        };
        let bundle: ModelBundle = serde_json::from_value(json!({
            "bundleId": "qwen3-tts-0.6b-base@mlx-8bit",
            "backend": "mlx",
            "device": "metal",
            "components": { "tts": files("tts", "qwen3-tts", 4), "codec": files("codec", "qwen3-tts-tokenizer", 2) },
            "threads": 1,
        }))
        .unwrap();
        assert!(bundle.components.has_speech());
        assert!(bundle.components.asr.is_none());
        let verified = verify(&bundle).unwrap();
        assert_eq!(verified.component("tts").unwrap().family, "qwen3-tts");
        assert_eq!(verified.component("codec").unwrap().component, "codec");
        assert_eq!(
            verified.component("aux").unwrap_err().details.unwrap()["reason"],
            "missing-component"
        );
        assert_eq!(verified.total_bytes(), 6);

        // Serializes back to the same shape (matches the Runtime-Worker contract word for word).
        let round: ModelBundle = serde_json::from_value(serde_json::to_value(&bundle).unwrap()).unwrap();
        assert_eq!(round.components.codec.unwrap().family, "qwen3-tts-tokenizer");
        // Unrecognized component names are still rejected.
        let unknown = json!({ "tts": files("tts", "qwen3-tts", 4), "vocoder": files("codec", "x", 2) });
        assert!(serde_json::from_value::<Components>(unknown).is_err());
        // File size mismatch: synthesis and recognition components alike report MODEL_NOT_INSTALLED, naming the component.
        let mut wrong = bundle.clone();
        wrong.components.tts.as_mut().unwrap().files[0].byte_length = 5;
        let error = verify(&wrong).unwrap_err();
        assert_eq!(error.code, codes::MODEL_NOT_INSTALLED);
        assert_eq!(error.details.unwrap()["component"], "tts");
    }
}
