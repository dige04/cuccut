//! The backend-independent parts of MOSS-Transcribe-Diarize: configuration, prompt constants, low-energy chunking, the chunked transcription loop and output protocol rendering. Ported verbatim from v2 `ccut-speech`; the engines are in `backend::mlx::moss` and `backend::candle::moss`. v2's `MossCallbacks`, `MossCancelled` and `MossTranscription` are here as [`SegmentingCallbacks`], [`SegmentingCancelled`] and [`SegmentedTranscription`].
// The chunk loop and streaming state are used only by the MLX and candle engines; in builds where neither is compiled, they have no callers.
#![cfg_attr(
    not(any(
        all(feature = "backend-mlx", target_os = "macos", target_arch = "aarch64"),
        feature = "backend-candle"
    )),
    allow(dead_code, unused_imports)
)]

use std::fs;
use std::path::Path;

use anyhow::{Context, Result, bail};
use serde_json::Value;

use super::language::{MOSS_LANGUAGES, canonical_code};
use super::moss_parse::{MossGenerationPlan, MossOutputParser, MossOutputSegment, adapt_output, preview_segment};
use super::{SegmentedTranscription, SegmentingCallbacks, SegmentingCancelled};

mod repetition;
use repetition::RepetitionGuard;
pub(crate) use repetition::repetitive_token_tail;

pub const SAMPLE_RATE: usize = 16_000;
pub const WHISPER_WINDOW_SAMPLES: usize = 480_000;
pub const HOP_LENGTH: usize = 160;
pub const WHISPER_ENCODER_STRIDE: usize = 2;
pub const DEFAULT_AUDIO_TOKEN: i32 = 151_671;
pub const AUDIO_START: i32 = 151_669;
pub const AUDIO_END: i32 = 151_670;
pub const IM_START: i32 = 151_644;
pub const IM_END: i32 = 151_645;
pub const PAD_EOS: i32 = 151_643;
pub const NEWLINE: i32 = 198;
pub const SYSTEM: i32 = 8_948;
pub const USER: i32 = 872;
pub const ASSISTANT: i32 = 77_091;
pub const PREFILL_STEP: usize = 512;

pub const DEFAULT_PROMPT: &str = "Transcribe the audio into text. Start each segment with the start \
timestamp and speaker label ([S01], [S02], [S03], ...), write the corresponding spoken content, \
and end each segment with the ending timestamp to clearly mark the segment range.";

/// Language constraint appended after [`DEFAULT_PROMPT`] when `auto`.
///
/// MOSS has no separate language parameter. With only [`DEFAULT_PROMPT`] given, even short chunks under 300 s will translate an entire English passage into French (greedy decoding, so the same material gives the same output every time). Abstract wordings such as “照原语言转写、不要翻译”(transcribe in the original language, do not translate) do not work: six wordings, one of them in Chinese, all still yield French. Naming a few common languages does bring it back to the language actually spoken. The named languages are not a whitelist: Italian, Portuguese and Russian outside the list are still transcribed in their original language, and languages inside the list are not pulled toward other languages in the list (the measured conclusion from v2).
pub const AUTO_LANGUAGE_RULE: &str = "The speech may be in Chinese, English, Japanese, Korean, \
French, German, Spanish or another language. Transcribe it verbatim in the language actually \
spoken; do not translate.";

/// Full-chunk transcription instruction in the user turn: [`DEFAULT_PROMPT`] plus the language constraint.
///
/// `language` is the source language written into the instruction; `None` / `auto` means automatic. **Naming a language is a hard constraint**: MOSS will translate other languages into the named output language (English material with `de` yields a German translation). Wordings such as “预期是”(“expected to be”) or “如果实际不是就照实际”(“if it is not, follow the actual one”) do not stop it. So callers should pass a language only when it is the user's assertion for this material (`job.run` hands `language` to MOSS only when it is asserted). Words from other languages embedded in the text (OPENAI / CHATGPT inside 中文口播, Chinese narration) are kept as-is.
pub fn moss_instruction(language: Option<&str>) -> String {
    match language.and_then(language_name) {
        Some(name) => format!(
            "{DEFAULT_PROMPT} The speech is expected to be in {name}. Transcribe it verbatim \
             in {name}, exactly as spoken; do not translate. Keep any words spoken in \
             another language as they were spoken."
        ),
        None => format!("{DEFAULT_PROMPT} {AUTO_LANGUAGE_RULE}"),
    }
}

/// English language name used in the instruction; returns `None` when the code is unrecognized or `auto` (treated as automatic).
///
/// All Chinese variants (`zh-*`, `yue`, `cmn`) are always `Chinese` (same as the v2 autolang normalization). Everything else is taken from MOSS's language table ([`MOSS_LANGUAGES`], the same English names the v2 language catalog gives speech models).
pub fn language_name(code: &str) -> Option<String> {
    let code = code.trim();
    if code.is_empty() || code.eq_ignore_ascii_case("auto") {
        return None;
    }
    let canonical = canonical_code(code)?;
    if canonical.starts_with("zh") || canonical == "yue" || canonical == "cmn" {
        return Some("Chinese".to_owned());
    }
    MOSS_LANGUAGES
        .iter()
        .find(|(known, _)| *known == canonical)
        .map(|(_, name)| (*name).to_owned())
}

#[derive(Debug, Clone)]
pub struct MossConfig {
    pub hidden_size: usize,
    pub intermediate_size: usize,
    pub text_layers: usize,
    pub text_heads: usize,
    pub text_kv_heads: usize,
    pub head_dim: usize,
    pub rms_eps: f32,
    pub rope_theta: f32,
    pub mel_bins: usize,
    pub audio_model_size: usize,
    pub audio_layers: usize,
    pub audio_heads: usize,
    pub maximum_source_positions: usize,
    pub audio_token_id: i32,
    pub audio_merge_size: usize,
    pub adaptor_input_dim: usize,
    pub sample_rate: usize,
}

impl MossConfig {
    pub fn load(path: &Path) -> Result<Self> {
        let raw: Value = serde_json::from_slice(&fs::read(path).with_context(|| format!("读取 {}", path.display()))?)
            .context("解析 MOSS config.json")?;
        let text = raw
            .get("text_config")
            .and_then(Value::as_object)
            .context("MOSS config 缺少 text_config")?;
        let audio = raw
            .get("audio_config")
            .and_then(Value::as_object)
            .context("MOSS config 缺少 audio_config")?;
        let audio_model_size = usize_field(audio, "d_model", 1_024);
        let audio_merge_size = usize_value(raw.get("audio_merge_size")).unwrap_or(4);
        let config = Self {
            hidden_size: usize_field(text, "hidden_size", 1_024),
            intermediate_size: usize_field(text, "intermediate_size", 3_072),
            text_layers: usize_field(text, "num_hidden_layers", 28),
            text_heads: usize_field(text, "num_attention_heads", 16),
            text_kv_heads: usize_field(text, "num_key_value_heads", 8),
            head_dim: usize_field(text, "head_dim", 128),
            rms_eps: f32_field(text, "rms_norm_eps", 1e-6),
            rope_theta: f32_field(text, "rope_theta", 1_000_000.0),
            mel_bins: usize_field(audio, "num_mel_bins", 80),
            audio_model_size,
            audio_layers: usize_field(audio, "encoder_layers", 24),
            audio_heads: usize_field(audio, "encoder_attention_heads", 16),
            maximum_source_positions: usize_field(audio, "max_source_positions", 1_500),
            audio_token_id: i32_value(raw.get("audio_token_id")).unwrap_or(DEFAULT_AUDIO_TOKEN),
            audio_merge_size,
            adaptor_input_dim: usize_value(raw.get("adaptor_input_dim")).unwrap_or(audio_model_size * audio_merge_size),
            sample_rate: usize_value(raw.get("sample_rate")).unwrap_or(SAMPLE_RATE),
        };
        if config.sample_rate != SAMPLE_RATE
            || config.mel_bins != 80
            || config.audio_merge_size == 0
            || config.text_heads == 0
            || config.text_kv_heads == 0
        {
            bail!("不支持的 MOSS 配置：{config:?}");
        }
        Ok(config)
    }
}

/// Fields in processor_config.json that affect prompt assembly.
#[derive(Debug, Clone)]
pub struct MossProcessorConfig {
    pub audio_tokens_per_second: f32,
    pub time_marker_every_seconds: usize,
    pub enable_time_marker: bool,
}

impl Default for MossProcessorConfig {
    fn default() -> Self {
        Self {
            audio_tokens_per_second: 12.5,
            time_marker_every_seconds: 5,
            enable_time_marker: true,
        }
    }
}

impl MossProcessorConfig {
    /// `processor_path` is the `processor_config.json` in the manifest; default values are used when it is absent.
    pub fn load(processor_path: Option<&Path>) -> Result<Self> {
        let mut config = Self::default();
        if let Some(processor_path) = processor_path {
            let processor: Value = serde_json::from_slice(&fs::read(processor_path)?).context("解析 MOSS processor_config.json")?;
            config.audio_tokens_per_second = processor
                .get("audio_tokens_per_second")
                .and_then(Value::as_f64)
                .map(|value| value as f32)
                .unwrap_or(config.audio_tokens_per_second);
            config.time_marker_every_seconds =
                usize_value(processor.get("time_marker_every_seconds")).unwrap_or(config.time_marker_every_seconds);
            config.enable_time_marker = processor
                .get("enable_time_marker")
                .and_then(Value::as_bool)
                .unwrap_or(config.enable_time_marker);
        }
        Ok(config)
    }
}

/// v2 name: MOSS's structured output is the output of the self-segmenting recognizer (`rows` already carry absolute times and speaker labels).
pub type MossTranscription = SegmentedTranscription;
/// v2 name: observation and abort hooks for the generation process.
pub type MossCallbacks<'a> = SegmentingCallbacks<'a>;
/// v2 name: payload of the error on cancellation.
pub use super::SegmentingCancelled as MossCancelled;

/// Prefix that [`transcribe_chunks`] writes into `warnings` when a chunk is not fully written; `job.run` uses it to report `segment-incomplete`.
pub const INCOMPLETE_WARNING_PREFIX: &str = "moss-incomplete: ";

/// Every time this many new tokens accumulate, run an incremental decode, side-channel parse and cancellation check.
pub(crate) const STREAM_FLUSH_INTERVAL: usize = 16;

/// Stopping generation early must not masquerade as EOS, or the chunk driver would treat the audio it missed as a success.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum GenerationStopReason {
    Eos,
    TokenLimit,
    Repetition,
}

pub(crate) struct ChunkGeneration {
    pub(crate) text: String,
    pub(crate) token_count: usize,
    pub(crate) stop_reason: GenerationStopReason,
}

/// Streaming observation state during single-chunk generation. `covered` is the global high-water mark shared across chunks.
pub(crate) struct StreamState<'a, 'b> {
    pub(crate) callbacks: &'a mut MossCallbacks<'b>,
    pub(crate) offset_seconds: f64,
    pub(crate) chunk_duration: f64,
    pub(crate) total_duration: f64,
    pub(crate) covered: f64,
    /// Global seconds; live segments starting before it are no longer emitted. When a chunk is re-run, the failed attempt had already pushed its previews to the UI; the re-run only fills in what follows, so the same segment does not appear twice on the live track.
    pub(crate) preview_floor: f64,
    /// Latest end point (global seconds) among the live segments already emitted.
    pub(crate) previewed: f64,
    repetition: RepetitionGuard,
}

impl StreamState<'_, '_> {
    /// When true, the backend should end this generation immediately and hand back to the chunk driver with the Repetition reason.
    pub(crate) fn observe(&mut self, segments: &[MossOutputSegment]) -> bool {
        for segment in segments {
            // Even without a UI subscriber, or when previews are suppressed by the retry floor, the generation loop must still be checked.
            if self.repetition.observe(segment) {
                return true;
            }
            let (mut live, suppressed) = preview_segment(segment);
            live.start += self.offset_seconds;
            live.end += self.offset_seconds;
            if !suppressed
                && live.end > live.start
                && live.start >= self.preview_floor
                && let Some(callback) = self.callbacks.on_segment.as_deref_mut()
            {
                self.previewed = self.previewed.max(live.end);
                callback(&live);
            }
            let bounded = live.end.min(self.offset_seconds + self.chunk_duration).min(self.total_duration);
            self.advance(bounded);
        }
        false
    }

    /// Advances the coverage progress and guarantees it never decreases globally.
    pub(crate) fn advance(&mut self, covered: f64) {
        if !covered.is_finite() || covered <= self.covered {
            return;
        }
        self.covered = covered;
        if let Some(callback) = self.callbacks.on_progress.as_deref_mut() {
            callback(self.covered, self.total_duration);
        }
    }
}

pub struct AudioChunk<'a> {
    pub samples: &'a [f32],
    pub offset_seconds: f64,
}

pub fn split_audio_at_low_energy(audio: &[f32], chunk_duration: f64, search_seconds: f64, window_seconds: f64) -> Vec<AudioChunk<'_>> {
    let maximum = (chunk_duration * SAMPLE_RATE as f64) as usize;
    if audio.len() <= maximum || maximum == 0 {
        return vec![AudioChunk {
            samples: audio,
            offset_seconds: 0.0,
        }];
    }
    let search = (search_seconds * SAMPLE_RATE as f64) as usize;
    let window = ((window_seconds * SAMPLE_RATE as f64) as usize).max(1);
    let mut chunks = Vec::new();
    let mut start = 0;
    while start < audio.len() {
        let expected_end = (start + maximum).min(audio.len());
        if expected_end == audio.len() {
            chunks.push(AudioChunk {
                samples: &audio[start..],
                offset_seconds: start as f64 / SAMPLE_RATE as f64,
            });
            break;
        }
        let search_start = expected_end.saturating_sub(search).max(start);
        // Only look for low-energy points before the target boundary, so no chunk ever exceeds the chunk_duration hard cap.
        let search_end = expected_end;
        let cut = lowest_energy_point(audio, search_start, search_end, window)
            .unwrap_or(expected_end)
            .max(start + SAMPLE_RATE)
            .min(audio.len());
        chunks.push(AudioChunk {
            samples: &audio[start..cut],
            offset_seconds: start as f64 / SAMPLE_RATE as f64,
        });
        start = cut;
    }
    chunks
}

/// Center of the lowest-energy `window`-sample window within `audio[search_start..search_end]`; returns `None` when the range is not longer than the window.
fn lowest_energy_point(audio: &[f32], search_start: usize, search_end: usize, window: usize) -> Option<usize> {
    let region = &audio[search_start..search_end];
    if region.len() <= window {
        return None;
    }
    let mut energy = region[..window].iter().map(|sample| sample * sample).sum::<f32>();
    let mut minimum = energy;
    let mut minimum_index = 0;
    for index in 1..=region.len() - window {
        energy += region[index + window - 1].powi(2) - region[index - 1].powi(2);
        if energy < minimum {
            minimum = energy;
            minimum_index = index;
        }
    }
    Some(search_start + minimum_index + window / 2)
}

/// When a chunk is re-split, each resulting half is at least this long. If a half would be shorter, it is not split further and is accepted as a partial result.
pub(crate) const MIN_RETRY_PIECE_SECONDS: f64 = MossGenerationPlan::MIN_CHUNK_DURATION;

/// Finds a low-energy point within 5 s before and after the midpoint to split a chunk in two, with both halves at least `min_seconds` long; returns `None` when the chunk is too short to split. The return value is the sample index of the split point.
pub(crate) fn split_in_half_at_low_energy(audio: &[f32], min_seconds: f64) -> Option<usize> {
    let minimum = (min_seconds * SAMPLE_RATE as f64) as usize;
    if minimum == 0 || audio.len() < minimum * 2 {
        return None;
    }
    let middle = audio.len() / 2;
    let search = 5 * SAMPLE_RATE;
    let low = middle.saturating_sub(search).max(minimum);
    let high = (middle + search).min(audio.len() - minimum);
    let window = SAMPLE_RATE / 10;
    let cut = lowest_energy_point(audio, low, high, window).unwrap_or(middle);
    Some(cut.clamp(minimum, audio.len() - minimum))
}

/// One chunk of audio handed to the backend to run a generation.
pub(crate) struct ChunkRequest<'a> {
    pub(crate) samples: &'a [f32],
    /// Index in the initial chunking plan; re-split sub-chunks are `None`. The mlx backend uses it to fetch the input materialized in advance; sub-chunks are computed on the fly.
    #[cfg_attr(not(all(feature = "backend-mlx", target_os = "macos", target_arch = "aarch64")), allow(dead_code))]
    pub(crate) planned: Option<usize>,
    pub(crate) max_tokens: usize,
}

struct Piece<'a> {
    samples: &'a [f32],
    offset_seconds: f64,
    planned: Option<usize>,
}

/// Chunked transcription loop (shared by the mlx and candle backends in v2). `generate` runs one generation over a chunk of audio and returns the raw output, the number of tokens actually generated and the stop reason.
///
/// When a chunk shows a repetition loop, or when the token budget is used up while the output does not reach the end of the chunk (common with music, silence, or very fast speech), retrying the same input does not help: decoding is greedy, so the same input always produces the same output. Instead, the chunk is split in two at a low-energy point near its midpoint and each half is re-run: each half gets at least [`MossGenerationPlan::MIN_TOKENS`] of budget, the usable tokens per second double, and the context changes. If a half is still shorter than [`MIN_RETRY_PIECE_SECONDS`], the segments already written are kept (trailing repetition loop trimmed) and `warnings` records which passage may be missing words, rather than discarding the results of the preceding hours.
pub(crate) fn transcribe_chunks<'a, G>(
    audio: &'a [f32],
    chunks: &[AudioChunk<'a>],
    chunk_seconds: f64,
    callbacks: &mut MossCallbacks<'_>,
    mut generate: G,
) -> Result<MossTranscription>
where
    G: FnMut(ChunkRequest<'_>, &mut StreamState<'_, '_>) -> Result<ChunkGeneration>,
{
    let total_duration = audio.len() as f64 / SAMPLE_RATE as f64;
    let mut result = MossTranscription::default();
    let mut texts = Vec::new();
    let mut next_cluster = 0;
    let mut accepted_pieces = 0;
    let mut covered = 0.0_f64;
    let mut preview_floor = 0.0_f64;
    let mut previewed = 0.0_f64;
    // Last in, first out: the two re-split halves are pushed back on top of the stack and processed before the later chunks, so time order is preserved.
    let mut pending = chunks
        .iter()
        .enumerate()
        .rev()
        .map(|(index, chunk)| Piece {
            samples: chunk.samples,
            offset_seconds: chunk.offset_seconds,
            planned: Some(index),
        })
        .collect::<Vec<_>>();
    while let Some(piece) = pending.pop() {
        if callbacks.cancelled() {
            return Err(anyhow::Error::from(SegmentingCancelled));
        }
        let piece_duration = piece.samples.len() as f64 / SAMPLE_RATE as f64;
        let plan = MossGenerationPlan::make_with_chunk_duration(piece_duration, chunk_seconds);
        let mut stream = StreamState {
            callbacks,
            offset_seconds: piece.offset_seconds,
            chunk_duration: piece_duration,
            total_duration,
            covered,
            preview_floor,
            previewed,
            repetition: RepetitionGuard::default(),
        };
        let generation = generate(
            ChunkRequest {
                samples: piece.samples,
                planned: piece.planned,
                max_tokens: plan.max_tokens,
            },
            &mut stream,
        )?;
        result.generation_tokens += generation.token_count;
        let mut segments = MossOutputParser::parse(&generation.text);
        let last_end = segments.iter().map(|segment| segment.end).fold(0.0_f64, f64::max);
        let needs_recovery = match generation.stop_reason {
            GenerationStopReason::Eos => false,
            GenerationStopReason::TokenLimit => plan.stopped_at_token_limit(generation.token_count, last_end, piece_duration),
            // A loop that occurs at the end of a chunk is still not a normal finish, so it must not be hidden by the 5 s tail tolerance.
            GenerationStopReason::Repetition => true,
        };
        if needs_recovery {
            if let Some(cut) = split_in_half_at_low_energy(piece.samples, MIN_RETRY_PIECE_SECONDS) {
                covered = stream.covered;
                previewed = stream.previewed;
                preview_floor = preview_floor.max(previewed);
                let (first, second) = piece.samples.split_at(cut);
                pending.push(Piece {
                    samples: second,
                    offset_seconds: piece.offset_seconds + cut as f64 / SAMPLE_RATE as f64,
                    planned: None,
                });
                pending.push(Piece {
                    samples: first,
                    offset_seconds: piece.offset_seconds,
                    planned: None,
                });
                continue;
            }
            segments = drop_runaway_repeats(segments);
            let kept_until = segments
                .iter()
                .map(|segment| segment.end)
                .fold(0.0_f64, f64::max)
                .min(piece_duration);
            let reason = match generation.stop_reason {
                GenerationStopReason::Repetition => {
                    format!("生成 {} token 后因重复循环停止", generation.token_count)
                }
                _ => format!("用满了 {} token 上限仍没写到结尾", plan.max_tokens),
            };
            result.warnings.push(format!(
                "{INCOMPLETE_WARNING_PREFIX}MOSS 在 {}–{} 这段{}，已保留识别出的部分，{} 之后可能缺字；可以换 Qwen3-ASR 或 Whisper 重新转录",
                clock(piece.offset_seconds),
                clock(piece.offset_seconds + piece_duration),
                reason,
                clock(piece.offset_seconds + kept_until),
            ));
        }
        // The chunk has been generated, so coverage progress advances at least to the chunk end, to avoid stalls caused by empty chunks.
        stream.advance((piece.offset_seconds + piece_duration).min(total_duration));
        covered = stream.covered;
        previewed = stream.previewed;
        let mut adapted = adapt_output(&segments, piece_duration, true);
        let local_cluster_count = adapted.speaker_ranges.iter().map(|range| range.cluster + 1).max().unwrap_or(0);
        for row in &mut adapted.rows {
            row.start += piece.offset_seconds;
            row.end += piece.offset_seconds;
        }
        // Each generation's speaker labels number themselves from S01 independently, and the two re-split halves are also two independent generations. So the chunk sequence number is counted by the chunks actually accepted, not by the sequence number of the initial plan.
        for range in &mut adapted.speaker_ranges {
            range.start += piece.offset_seconds;
            range.end += piece.offset_seconds;
            range.cluster += next_cluster;
            range.chunk = accepted_pieces;
        }
        next_cluster += local_cluster_count;
        accepted_pieces += 1;
        result.rows.extend(adapted.rows);
        result.speaker_ranges.extend(adapted.speaker_ranges);
        let shifted = offset_segments(&segments, piece.offset_seconds);
        let shifted_text = render_segments(&shifted);
        if !shifted_text.is_empty() {
            texts.push(shifted_text);
        }
    }
    result.text = texts.join("\n");
    Ok(result)
}

/// In the output of a failed generation, the tail often repeats the same few sentences with shifting timestamps. Before accepting partial results, drop segments whose time goes backwards, and segments whose text matches one of the most recent few segments. Used only as a fallback on failure: in normal output, saying 「はい」 twice in a row is genuine.
pub(crate) fn drop_runaway_repeats(segments: Vec<MossOutputSegment>) -> Vec<MossOutputSegment> {
    const LOOKBACK: usize = 4;
    let mut kept: Vec<MossOutputSegment> = Vec::with_capacity(segments.len());
    for segment in segments {
        let text = segment.text.trim();
        // Consistent with the validity of the final rows; otherwise the warning would treat a zero-duration hallucinated end point as retained text.
        if segment.end <= segment.start || text.is_empty() {
            continue;
        }
        let went_back = kept.last().is_some_and(|last| segment.start < last.start);
        let repeated = kept.iter().rev().take(LOOKBACK).any(|previous| previous.text.trim() == text);
        if !went_back && !repeated {
            kept.push(segment);
        }
    }
    kept
}

fn clock(seconds: f64) -> String {
    let total = seconds.max(0.0).round() as u64;
    format!("{}:{:02}:{:02}", total / 3_600, total / 60 % 60, total % 60)
}

pub fn offset_segments(segments: &[MossOutputSegment], offset: f64) -> Vec<MossOutputSegment> {
    segments
        .iter()
        .cloned()
        .map(|mut segment| {
            segment.start += offset;
            segment.end += offset;
            segment
        })
        .collect()
}

pub fn render_segments(segments: &[MossOutputSegment]) -> String {
    segments
        .iter()
        .map(|segment| format!("[{:.2}][{}]{}[{:.2}]", segment.start, segment.speaker, segment.text, segment.end))
        .collect::<Vec<_>>()
        .join("")
}

pub fn usize_value(value: Option<&Value>) -> Option<usize> {
    value.and_then(Value::as_u64).map(|value| value as usize)
}

pub fn i32_value(value: Option<&Value>) -> Option<i32> {
    value.and_then(Value::as_i64).map(|value| value as i32)
}

pub fn usize_field(object: &serde_json::Map<String, Value>, key: &str, default: usize) -> usize {
    usize_value(object.get(key)).unwrap_or(default)
}

pub fn f32_field(object: &serde_json::Map<String, Value>, key: &str, default: f32) -> f32 {
    object.get(key).and_then(Value::as_f64).map(|value| value as f32).unwrap_or(default)
}

#[cfg(test)]
mod tests {
    use std::collections::HashSet;

    use super::*;
    use crate::speech::LiveSegment;

    #[test]
    fn instruction_names_asserted_language_and_forbids_translation() {
        let english = moss_instruction(Some("en"));
        assert!(english.starts_with(DEFAULT_PROMPT));
        assert!(english.contains("The speech is expected to be in English."));
        assert!(english.contains("Transcribe it verbatim in English, exactly as spoken"));
        assert!(english.contains("do not translate"));
        assert!(!english.contains(AUTO_LANGUAGE_RULE));
        // The kernel passes in a code already normalized by autolang; elsewhere it may carry region / writing-system subtags.
        assert!(moss_instruction(Some("zh")).contains("expected to be in Chinese."));
        assert!(moss_instruction(Some("zh-Hans")).contains("expected to be in Chinese."));
        assert!(moss_instruction(Some("fr")).contains("expected to be in French."));
        assert!(moss_instruction(Some("ja-JP")).contains("expected to be in Japanese."));
    }

    #[test]
    fn instruction_without_language_keeps_spoken_language() {
        let expected = format!("{DEFAULT_PROMPT} {AUTO_LANGUAGE_RULE}");
        assert_eq!(moss_instruction(None), expected);
        assert_eq!(moss_instruction(Some("auto")), expected);
        assert_eq!(moss_instruction(Some("AUTO")), expected);
        assert_eq!(moss_instruction(Some("  ")), expected);
        // An unrecognized code is not forced into the instruction (naming it would make it a translation target); it is treated as automatic.
        assert_eq!(moss_instruction(Some("xx-unknown")), expected);
        assert!(AUTO_LANGUAGE_RULE.contains("in the language actually spoken; do not translate"));
    }

    #[test]
    fn language_names_cover_autolang_and_catalog_codes() {
        assert_eq!(language_name("en").as_deref(), Some("English"));
        assert_eq!(language_name("de").as_deref(), Some("German"));
        assert_eq!(language_name("yue").as_deref(), Some("Chinese"));
        // Codes that autolang does not recognize but the language catalog does use the catalog's English name for the speech model.
        assert_eq!(language_name("uk").as_deref(), Some("Ukrainian"));
        assert_eq!(language_name("auto"), None);
        assert_eq!(language_name(""), None);
    }

    /// Replicates the chunk loop of both backends: each chunk creates a new StreamState but keeps `covered`, and the chunk end is forced to advance to the chunk boundary.
    fn drive_chunks(chunks: &[(f64, Vec<MossOutputSegment>)], chunk_duration: f64, total_duration: f64, callbacks: &mut MossCallbacks<'_>) {
        let mut covered = 0.0_f64;
        for (offset_seconds, segments) in chunks {
            let mut stream = StreamState {
                callbacks,
                offset_seconds: *offset_seconds,
                chunk_duration,
                total_duration,
                covered,
                preview_floor: 0.0,
                previewed: 0.0,
                repetition: RepetitionGuard::default(),
            };
            stream.observe(segments);
            stream.advance((offset_seconds + chunk_duration).min(total_duration));
            covered = stream.covered;
        }
    }

    fn segment(start: f64, end: f64, text: &str) -> MossOutputSegment {
        MossOutputSegment {
            start,
            end,
            speaker: "S01".to_owned(),
            text: text.to_owned(),
        }
    }

    #[test]
    fn stream_state_keeps_progress_monotonic_and_global_across_chunks() {
        let chunks = vec![
            (
                0.0,
                vec![
                    segment(10.0, 20.0, "one"),
                    // Rolled-back segments must not move progress backwards.
                    segment(2.0, 5.0, "back"),
                    // Segments containing replacement characters are suppressed: no live segment is emitted, but the covered seconds still advance.
                    segment(30.0, 40.0, "bro\u{FFFD}ken"),
                    // Segments crossing the chunk boundary are clamped back to the chunk end.
                    segment(1_700.0, 5_000.0, "over"),
                ],
            ),
            (1_800.0, vec![segment(5.0, 15.0, "two"), segment(500.0, 700.0, "three")]),
        ];
        let mut live = Vec::new();
        let mut progress = Vec::new();
        let mut on_segment = |segment: &LiveSegment| {
            live.push((segment.start, segment.end, segment.text.clone()));
        };
        let mut on_progress = |covered: f64, total: f64| progress.push((covered, total));
        drive_chunks(
            &chunks,
            1_800.0,
            2_400.0,
            &mut MossCallbacks {
                on_progress: Some(&mut on_progress),
                on_segment: Some(&mut on_segment),
                should_cancel: None,
            },
        );

        assert_eq!(
            live,
            vec![
                (10.0, 20.0, "one".to_owned()),
                (2.0, 5.0, "back".to_owned()),
                (1_700.0, 5_000.0, "over".to_owned()),
                (1_805.0, 1_815.0, "two".to_owned()),
                (2_300.0, 2_500.0, "three".to_owned()),
            ]
        );
        assert!(
            progress.windows(2).all(|pair| pair[1].0 > pair[0].0),
            "覆盖秒数必须全局严格递增：{progress:?}"
        );
        assert!(progress.iter().all(|(_, total)| *total == 2_400.0), "总时长必须始终是整片时长");
        assert_eq!(
            progress.iter().map(|(covered, _)| *covered).collect::<Vec<_>>(),
            vec![20.0, 40.0, 1_800.0, 1_815.0, 2_400.0]
        );
    }

    #[test]
    fn zero_duration_music_segments_do_not_reach_live_preview() {
        let segments = MossOutputParser::parse(
            "[11.98][S01][Music][11.99][11.99][S01][Music][11.99]\
             [11.99][S01][Music][11.99]",
        );
        assert_eq!(segments.len(), 3);
        let mut live = Vec::new();
        let mut on_segment = |segment: &LiveSegment| live.push(segment.clone());
        drive_chunks(
            &[(0.0, segments)],
            60.0,
            60.0,
            &mut MossCallbacks {
                on_progress: None,
                on_segment: Some(&mut on_segment),
                should_cancel: None,
            },
        );
        assert_eq!(live.len(), 1, "zero-duration segments must not flood the preview");
        assert_eq!((live[0].start, live[0].end), (11.98, 11.99));
    }

    /// One output of the fake generator: `[start][S01]text[end]`, relative to in-chunk time.
    fn raw(segments: &[(f64, f64, &str)]) -> String {
        segments
            .iter()
            .map(|(start, end, text)| format!("[{start:.2}][S01]{text}[{end:.2}]"))
            .collect()
    }

    fn seconds(samples: &[f32]) -> f64 {
        samples.len() as f64 / SAMPLE_RATE as f64
    }

    #[test]
    fn exhausted_chunk_is_split_and_retried_instead_of_failing() {
        // A tail chunk like chunk 27: 162 s, budget 5184 tokens. Running the whole chunk at full budget only writes up to 40 s; running each half separately can write to the end.
        let audio = vec![0.1_f32; SAMPLE_RATE * 162];
        let chunks = vec![AudioChunk {
            samples: &audio,
            offset_seconds: 0.0,
        }];
        let mut calls = Vec::new();
        let mut live = Vec::new();
        let mut on_segment = |segment: &LiveSegment| live.push((segment.start, segment.text.clone()));
        let result = transcribe_chunks(
            &audio,
            &chunks,
            MossGenerationPlan::CHUNK_DURATION,
            &mut MossCallbacks {
                on_progress: None,
                on_segment: Some(&mut on_segment),
                should_cancel: None,
            },
            |request, stream| {
                let duration = seconds(request.samples);
                calls.push((request.planned, duration, request.max_tokens));
                let output = if duration > 150.0 {
                    raw(&[(0.0, 20.0, "one"), (20.0, 40.0, "two")])
                } else {
                    raw(&[(0.0, duration / 2.0, "head"), (duration / 2.0, duration - 1.0, "tail")])
                };
                stream.observe(&MossOutputParser::parse(&output));
                let tokens = if duration > 150.0 { request.max_tokens } else { 900 };
                Ok(ChunkGeneration {
                    text: output,
                    token_count: tokens,
                    stop_reason: if duration > 150.0 {
                        GenerationStopReason::TokenLimit
                    } else {
                        GenerationStopReason::Eos
                    },
                })
            },
        )
        .unwrap();

        assert_eq!(calls.len(), 3);
        assert_eq!(calls[0], (Some(0), 162.0, 5_184));
        assert!(
            calls[1..]
                .iter()
                .all(|(planned, duration, tokens)| { planned.is_none() && *duration >= MIN_RETRY_PIECE_SECONDS && *tokens == 5_120 })
        );
        assert!(result.warnings.is_empty(), "{:?}", result.warnings);
        assert_eq!(result.generation_tokens, 5_184 + 900 * 2);
        // Segments from the failed attempt are not included in the results; the two halves are joined back in time order, and the last row is written up to near the end of the whole chunk.
        let texts = result.rows.iter().map(|row| row.text.as_str()).collect::<Vec<_>>();
        assert_eq!(texts, vec!["head", "tail", "head", "tail"]);
        assert!(result.rows.windows(2).all(|pair| pair[1].start >= pair[0].start));
        assert!(result.rows.last().unwrap().end > 160.0);
        // The two halves are two independent generations, so the chunk index of speaker ranges and the cluster numbers are counted separately.
        let chunks_seen = result
            .speaker_ranges
            .iter()
            .map(|range| (range.chunk, range.cluster))
            .collect::<HashSet<_>>();
        assert_eq!(chunks_seen, HashSet::from([(0, 0), (1, 1)]));
        // The 0–40 s already pushed to the live track by the failed attempt is not resent: the two segments whose start is before 40 s in the first half are suppressed, and only the later ones are filled in. Audio energy is uniform everywhere, so the split point lands at the start of the search zone 5 s before the midpoint (76.05 s).
        let live = live.iter().map(|(start, text)| (start.round(), text.as_str())).collect::<Vec<_>>();
        assert_eq!(live, vec![(0.0, "one"), (20.0, "two"), (76.0, "head"), (119.0, "tail")]);
    }

    #[test]
    fn centisecond_loop_retries_early_and_recovers_later_audio() {
        let audio = vec![0.1_f32; SAMPLE_RATE * 162];
        let chunks = vec![AudioChunk {
            samples: &audio,
            offset_seconds: 0.0,
        }];
        let mut calls = 0;
        let mut loop_segments = 0;
        let result = transcribe_chunks(
            &audio,
            &chunks,
            MossGenerationPlan::CHUNK_DURATION,
            &mut MossCallbacks::none(),
            |request, stream| {
                calls += 1;
                // Detection does not depend on a preview subscription or the floor; even if this segment would not be sent to the UI, the loop must not continue.
                stream.preview_floor = f64::INFINITY;
                let duration = seconds(request.samples);
                if request.planned.is_some() {
                    let mut output = String::new();
                    for index in 0..100 {
                        let start = 11.0 + index as f64 * 0.01;
                        let next = segment(start, start + 0.01, "[Music]");
                        output.push_str(&raw(&[(next.start, next.end, &next.text)]));
                        loop_segments += 1;
                        if stream.observe(&[next]) {
                            let token_count = loop_segments * STREAM_FLUSH_INTERVAL;
                            assert!(token_count < request.max_tokens);
                            return Ok(ChunkGeneration {
                                text: output,
                                token_count,
                                stop_reason: GenerationStopReason::Repetition,
                            });
                        }
                    }
                    panic!("the centisecond loop was not stopped");
                }
                let output = raw(&[(0.0, duration - 1.0, "recovered speech")]);
                assert!(!stream.observe(&MossOutputParser::parse(&output)));
                Ok(ChunkGeneration {
                    text: output,
                    token_count: 30,
                    stop_reason: GenerationStopReason::Eos,
                })
            },
        )
        .unwrap();

        assert_eq!(loop_segments, 8);
        assert_eq!(calls, 3);
        assert_eq!(result.generation_tokens, 8 * STREAM_FLUSH_INTERVAL + 60);
        assert!(result.warnings.is_empty());
        assert_eq!(result.rows.len(), 2);
        assert!(result.rows.iter().all(|row| row.text == "recovered speech"));
        assert!(result.rows[1].end > 160.0);
    }

    #[test]
    fn unsplittable_loop_warns_even_near_chunk_end_and_drops_zero_duration_tail() {
        for loop_time in [11.99, 99.0] {
            let audio = vec![0.1_f32; SAMPLE_RATE * 100];
            let chunks = vec![AudioChunk {
                samples: &audio,
                offset_seconds: 0.0,
            }];
            let mut calls = 0;
            let result = transcribe_chunks(
                &audio,
                &chunks,
                MossGenerationPlan::CHUNK_DURATION,
                &mut MossCallbacks::none(),
                |request, stream| {
                    calls += 1;
                    let mut output = raw(&[(0.0, 10.0, "real")]);
                    assert!(!stream.observe(&MossOutputParser::parse(&output)));
                    for index in 0..8 {
                        let next = raw(&[(loop_time, loop_time, "[Music]")]);
                        output.push_str(&next);
                        assert_eq!(stream.observe(&MossOutputParser::parse(&next)), index == 7);
                    }
                    assert!(144 < request.max_tokens);
                    Ok(ChunkGeneration {
                        text: output,
                        token_count: 144,
                        stop_reason: GenerationStopReason::Repetition,
                    })
                },
            )
            .unwrap();

            assert_eq!(calls, 1);
            assert_eq!(result.generation_tokens, 144);
            assert_eq!(result.rows.len(), 1);
            assert_eq!(result.rows[0].text, "real");
            assert!(!result.text.contains("[Music]"));
            assert_eq!(result.warnings.len(), 1);
            assert!(result.warnings[0].contains("生成 144 token 后因重复循环停止"));
            assert!(result.warnings[0].contains("0:00:10 之后可能缺字"));
        }
    }

    #[test]
    fn eos_keeps_real_repetition_and_does_not_retry_silent_tail() {
        let audio = vec![0.1_f32; SAMPLE_RATE * 162];
        let chunks = vec![AudioChunk {
            samples: &audio,
            offset_seconds: 0.0,
        }];
        let mut calls = 0;
        let result = transcribe_chunks(
            &audio,
            &chunks,
            MossGenerationPlan::CHUNK_DURATION,
            &mut MossCallbacks::none(),
            |_, stream| {
                calls += 1;
                let output = raw(&[(0.0, 10.0, "はい"), (10.0, 20.0, "はい")]);
                assert!(!stream.observe(&MossOutputParser::parse(&output)));
                Ok(ChunkGeneration {
                    text: output,
                    token_count: 32,
                    stop_reason: GenerationStopReason::Eos,
                })
            },
        )
        .unwrap();
        assert_eq!(calls, 1);
        assert_eq!(result.rows.len(), 2);
        assert!(result.warnings.is_empty());
    }

    #[test]
    fn chunk_that_cannot_be_split_further_keeps_partial_output_with_warning() {
        // Splitting a 100 s chunk in two gives halves shorter than 60 s, so no further splitting: accept the part already written and trim the trailing loop.
        let audio = vec![0.1_f32; SAMPLE_RATE * 100];
        let chunks = vec![AudioChunk {
            samples: &audio,
            offset_seconds: 7_700.0,
        }];
        let mut calls = 0;
        let result = transcribe_chunks(
            &audio,
            &chunks,
            MossGenerationPlan::CHUNK_DURATION,
            &mut MossCallbacks::none(),
            |request, _stream| {
                calls += 1;
                let output = raw(&[
                    (0.0, 10.0, "real"),
                    (10.0, 12.0, "ご視聴ありがとうございました"),
                    (12.0, 14.0, "music"),
                    (12.0, 14.0, "ご視聴ありがとうございました"),
                    (14.0, 16.0, "music"),
                ]);
                Ok(ChunkGeneration {
                    text: output,
                    token_count: request.max_tokens,
                    stop_reason: GenerationStopReason::TokenLimit,
                })
            },
        )
        .unwrap();

        assert_eq!(calls, 1);
        let texts = result.rows.iter().map(|row| row.text.as_str()).collect::<Vec<_>>();
        assert_eq!(texts, vec!["real", "ご視聴ありがとうございました", "music"]);
        assert_eq!(result.rows[0].start, 7_700.0);
        assert_eq!(result.warnings.len(), 1);
        let warning = &result.warnings[0];
        assert!(warning.starts_with("moss-incomplete: "), "{warning}");
        assert!(warning.contains("2:08:20–2:10:00"), "{warning}");
        assert!(warning.contains("2:08:34 之后"), "{warning}");
    }

    #[test]
    fn cancellation_is_checked_before_each_piece() {
        let audio = vec![0.1_f32; SAMPLE_RATE * 10];
        let chunks = vec![AudioChunk {
            samples: &audio,
            offset_seconds: 0.0,
        }];
        let mut cancel = || true;
        let error = transcribe_chunks(
            &audio,
            &chunks,
            MossGenerationPlan::CHUNK_DURATION,
            &mut MossCallbacks {
                on_progress: None,
                on_segment: None,
                should_cancel: Some(&mut cancel),
            },
            |_, _| unreachable!("取消后不应再生成"),
        )
        .unwrap_err();
        assert!(error.downcast_ref::<SegmentingCancelled>().is_some());
    }

    #[test]
    fn half_split_prefers_the_quiet_point_and_respects_minimum() {
        let mut audio = vec![0.5_f32; SAMPLE_RATE * 160];
        // There is a stretch of silence 2 s before the midpoint.
        let quiet = SAMPLE_RATE * 78;
        audio[quiet..quiet + SAMPLE_RATE / 5].fill(0.0);
        let cut = split_in_half_at_low_energy(&audio, 60.0).unwrap();
        assert!((quiet..quiet + SAMPLE_RATE / 5).contains(&cut), "{cut}");
        assert!(split_in_half_at_low_energy(&audio[..SAMPLE_RATE * 119], 60.0).is_none());
        let cut = split_in_half_at_low_energy(&audio[..SAMPLE_RATE * 121], 60.0).unwrap();
        assert!(cut >= SAMPLE_RATE * 60 && SAMPLE_RATE * 121 - cut >= SAMPLE_RATE * 60);
    }

    #[test]
    fn runaway_repeats_drop_looping_and_backward_segments_only() {
        let segments = MossOutputParser::parse(&raw(&[
            (0.0, 2.0, "はい"),
            (2.0, 4.0, "そうです"),
            (4.0, 6.0, "はい"),
            (6.0, 8.0, "次へ"),
            (3.0, 5.0, "戻り"),
            (8.0, 9.0, "終わり"),
        ]));
        let kept = drop_runaway_repeats(segments)
            .into_iter()
            .map(|segment| segment.text)
            .collect::<Vec<_>>();
        assert_eq!(kept, vec!["はい", "そうです", "次へ", "終わり"]);
    }

    #[test]
    fn audio_token_length_matches_reference_stride() {
        let stride = HOP_LENGTH * WHISPER_ENCODER_STRIDE * 4;
        assert_eq!((WHISPER_WINDOW_SAMPLES - 1) / stride + 1, 375);
    }

    #[test]
    fn low_energy_chunker_offsets_are_contiguous() {
        let mut audio = vec![0.5_f32; SAMPLE_RATE * 4];
        audio[SAMPLE_RATE * 2] = 0.0;
        let chunks = split_audio_at_low_energy(&audio, 2.0, 0.25, 0.01);
        assert!(chunks.len() >= 2);
        assert!(chunks.iter().all(|chunk| chunk.samples.len() <= SAMPLE_RATE * 2));
        for pair in chunks.windows(2) {
            let expected = pair[0].offset_seconds + pair[0].samples.len() as f64 / SAMPLE_RATE as f64;
            assert!((pair[1].offset_seconds - expected).abs() < 1e-9);
        }
    }

    #[test]
    fn rendered_segments_apply_chunk_offset() {
        let segments = vec![MossOutputSegment {
            start: 0.5,
            end: 1.0,
            speaker: "S01".to_owned(),
            text: "hello".to_owned(),
        }];
        let shifted = offset_segments(&segments, 1_800.0);
        assert_eq!(render_segments(&shifted), "[1800.50][S01]hello[1801.00]");
    }
}
