//! Segment-level transcriber for Whisper large-v3 / large-v3 Turbo on whisper.cpp (ported unchanged from v2 `ccut-speech`'s `ggml_backend/whisper.rs`).
//!
//! Same approach as the CoreML version ([`crate::backend::coreml`]): greedy decoding, 30 s windows, word-level timing handed to the shared forced aligner. Here the whole "mel → encode → decode" step is replaced by `whisper_full`; windowing and temperature fallback use whisper.cpp's own implementation.
//!
//! v3 scope: the weight file is taken from the manifest by the loader ([`super::GgmlBackend`]). Recognition enters the transcription pipeline through [`SpeechRecognizer`]; the hint (`hint`) is used as the initial prompt (v2's `HintKind::Prompt`); the device is decided by the model pack ([`WhisperGgml::load_on`]).

use std::path::Path;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};

use anyhow::{Context, Result, bail};
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

use super::{GgmlDevice, default_device};
use crate::speech::{Recognition, RecognitionRequest, SpeechRecognizer};

/// Upper limit on whisper.cpp decoding threads; more would only compete with each other on the small cores.
const MAX_THREADS: usize = 8;

/// GGML build of Whisper. One instance can be reused for multiple `transcribe` calls (a new state is created each time).
pub struct WhisperGgml {
    context: WhisperContext,
    device: GgmlDevice,
    threads: usize,
    cancel: Option<Arc<AtomicBool>>,
}

/// The two fields Whisper fills in v2's `TranscriptionResult`: the segment-level text and the detected language code.
#[derive(Debug)]
struct TranscriptionResult {
    text: String,
    language: Option<String>,
}

impl WhisperGgml {
    /// Loads a single-file GGML weight (such as `ggml-large-v3-turbo-q8_0.bin`); the device is this process's default device.
    pub fn load(weights: &Path) -> Result<Self> {
        Self::load_on(weights, None)
    }

    /// Same as [`Self::load`], but uses `device` when given (when the model pack's device is `cpu`, pass the CPU device).
    pub fn load_on(weights: &Path, device: Option<GgmlDevice>) -> Result<Self> {
        if !weights.is_file() {
            bail!("Whisper GGML 权重不存在：{}", weights.display());
        }
        // whisper.cpp / ggml sends its loading logs straight to stderr by default; install a hook once to suppress them,
        // keeping only our own one-line device log.
        whisper_rs::install_logging_hooks();
        let device = device.unwrap_or_else(default_device);
        let mut params = WhisperContextParameters::default();
        params.use_gpu(device.is_gpu);
        let context =
            WhisperContext::new_with_params(weights, params).with_context(|| format!("加载 Whisper GGML 权重 {}", weights.display()))?;
        let threads = std::thread::available_parallelism()
            .map(|n| n.get())
            .unwrap_or(4)
            .clamp(1, MAX_THREADS);
        eprintln!(
            "whisper: backend={} device=\"{}\" model={}",
            device.label(),
            device.description,
            weights.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default()
        );
        Ok(Self {
            context,
            device,
            threads,
            cancel: None,
        })
    }

    /// Cancel flag: once set to true, whisper.cpp aborts at the next decoding step and `transcribe` returns an error.
    pub fn with_cancel_flag(mut self, flag: Arc<AtomicBool>) -> Self {
        self.cancel = Some(flag);
        self
    }

    pub fn device(&self) -> &GgmlDevice {
        &self.device
    }

    fn transcribe_audio(&self, audio: &[f32], language_hint: Option<&str>, prompt: Option<&str>) -> Result<TranscriptionResult> {
        if audio.is_empty() {
            return Ok(TranscriptionResult {
                text: String::new(),
                language: language_hint.map(str::to_owned),
            });
        }
        let language = language_hint.map(whisper_language_code);
        let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
        params.set_n_threads(self.threads as i32);
        params.set_translate(false);
        // As in the CoreML version, each 30 s window is decoded independently and the previous window's text is not used as a prompt;
        // repetition loops in long audio mostly come from cross-window prompts.
        params.set_no_context(true);
        params.set_single_segment(false);
        params.set_suppress_blank(true);
        params.set_suppress_nst(true);
        params.set_token_timestamps(false);
        params.set_print_special(false);
        params.set_print_progress(false);
        params.set_print_realtime(false);
        params.set_print_timestamps(false);
        match language.as_deref() {
            Some(code) => params.set_language(Some(code)),
            None => {
                params.set_language(Some("auto"));
                params.set_detect_language(false);
            }
        }
        // Recognition prompt: whisper.cpp tokenizes it into `prompt_past`, and the model reads it as **preceding context**.
        // `no_context` clears the history before the initial prompt, so the two do not conflict; the prompt therefore
        // applies to every segment, not just the first one.
        let prompt = prompt.map(sanitize_prompt);
        if let Some(text) = prompt.as_deref().filter(|text| !text.is_empty()) {
            params.set_initial_prompt(text);
        }
        if let Some(flag) = &self.cancel {
            let flag = Arc::clone(flag);
            params.set_abort_callback_safe(move || flag.load(Ordering::Relaxed));
        }

        let mut state = self.context.create_state().context("创建 whisper.cpp 解码状态")?;
        state.full(params, audio).context("whisper.cpp 解码失败")?;
        if self.cancel.as_ref().is_some_and(|flag| flag.load(Ordering::Relaxed)) {
            bail!("转录已取消");
        }

        let mut pieces = Vec::new();
        for segment in state.as_iter() {
            let text = segment.to_str_lossy().context("读取 whisper.cpp 段文本")?;
            let text = text.trim();
            if !text.is_empty() {
                pieces.push(text.to_owned());
            }
        }
        let detected = whisper_rs::get_lang_str(state.full_lang_id_from_state())
            .map(str::to_owned)
            .filter(|code| !code.is_empty());
        Ok(TranscriptionResult {
            text: join_segments(&pieces),
            language: detected.or_else(|| language_hint.map(str::to_owned)),
        })
    }
}

/// One segment of the transcription pipeline: the asserted language goes in as the language parameter, and the recognition hint as the initial prompt (v2's `HintKind::Prompt`).
/// Whisper reports language codes (`en`, `yue`), not language names like Qwen3-ASR does.
impl SpeechRecognizer for WhisperGgml {
    fn recognize(&mut self, audio: &[f32], request: &RecognitionRequest<'_>) -> Result<Recognition> {
        let result = self.transcribe_audio(audio, request.language, request.context)?;
        Ok(Recognition {
            text: result.text,
            language_name: result.language,
            degenerate: false,
        })
    }
}

/// `whisper_rs::FullParams::set_initial_prompt` builds a `CString` internally, and **an embedded NUL causes a
/// panic**. The prompt comes in from user input all the way, so here NUL is replaced with a space rather than trusting the caller.
fn sanitize_prompt(text: &str) -> String {
    text.replace('\0', " ").trim().to_owned()
}

/// Reduces CucCut's language tags (`zh-Hans` / `en-US` / `yue`) to the two-letter codes that whisper.cpp accepts.
pub fn whisper_language_code(hint: &str) -> String {
    let lowered = hint.trim().to_ascii_lowercase();
    let head = lowered.split(['-', '_']).next().unwrap_or("").to_owned();
    match head.as_str() {
        "" => "auto".to_owned(),
        "zh" | "cmn" => "zh".to_owned(),
        "jp" => "ja".to_owned(),
        "kr" => "ko".to_owned(),
        other => other.to_owned(),
    }
}

/// Matches the joining rule of the CoreML version's `transcribe_audio`: one space between segments, then trim the whole result.
pub fn join_segments(pieces: &[String]) -> String {
    pieces.join(" ").trim().to_owned()
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE_RATE: u32 = 16_000;

    #[test]
    fn language_codes_collapse_to_whisper_form() {
        assert_eq!(whisper_language_code("zh-Hans"), "zh");
        assert_eq!(whisper_language_code("zh_TW"), "zh");
        assert_eq!(whisper_language_code("en-US"), "en");
        assert_eq!(whisper_language_code("  JA "), "ja");
        assert_eq!(whisper_language_code("jp"), "ja");
        assert_eq!(whisper_language_code("yue"), "yue");
        assert_eq!(whisper_language_code(""), "auto");
    }

    #[test]
    fn a_prompt_with_an_embedded_nul_does_not_reach_cstring() {
        assert_eq!(sanitize_prompt("  \u{0}\u{0}威科夫 \u{0}"), "威科夫");
        assert_eq!(sanitize_prompt("  "), "");
    }

    #[test]
    fn segments_join_like_coreml_chunks() {
        assert_eq!(join_segments(&[]), "");
        assert_eq!(join_segments(&["hello".into(), "world".into()]), "hello world");
        assert_eq!(join_segments(&["你好".into()]), "你好");
    }

    #[test]
    fn missing_weights_fail_before_touching_ggml() {
        let error = match WhisperGgml::load(Path::new("/nonexistent/ggml.bin")) {
            Ok(_) => panic!("missing weights must fail"),
            Err(error) => error,
        };
        assert!(format!("{error:#}").contains("不存在"));
    }

    /// End-to-end runs with weights are only done manually on a real device: `CUCCUT_WHISPER_GGML=/path/ggml-large-v3-turbo-q8_0.bin`.
    #[test]
    #[ignore]
    fn transcribes_silence_with_real_weights() {
        let path = std::env::var("CUCCUT_WHISPER_GGML").expect("CUCCUT_WHISPER_GGML");
        let mut model = WhisperGgml::load(Path::new(&path)).unwrap();
        let silence = vec![0.0_f32; SAMPLE_RATE as usize * 2];
        let result = model
            .recognize(
                &silence,
                &RecognitionRequest {
                    language: Some("en"),
                    context: None,
                },
            )
            .unwrap();
        assert!(result.text.len() < 64, "{result:?}");
    }
}
