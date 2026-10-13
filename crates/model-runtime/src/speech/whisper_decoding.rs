//! Parts of this file's implementation are adapted from speech-swift (https://github.com/soniqo/speech-swift).
//! Corresponding upstream files: `Sources/WhisperASR/WhisperGenerationConfig.swift / Sources/WhisperASR/WhisperByteLevelTokenizer.swift`.
//! Copyright 2025 Ivan Digital
//! SPDX-License-Identifier: Apache-2.0
//! Changes: CucCut reimplements the related algorithms in Rust and adapts them to this project's backend, model packages and transcription interface; the original upstream attribution is kept.
//! Full original license: `crates/model-runtime/licenses/speech-swift.txt`; for the scope of the source, see `THIRD_PARTY_NOTICES.md` in the repository root.
//!
//! Pure logic for Whisper decoding: the tokenizer (byte-level BPE decoding and prompt encoding), the special tokens and language table in `generation_config.json`, the rules that turn a recognition prompt into prefix tokens, and the suppression rules and repeated-word guard for greedy decoding.
//!
//! Independent of the inference framework: the MLX Whisper (`backend::mlx::whisper`) uses it to decide the decoding prefix, which tokens are disallowed at each step, and when to stop. The rules match the earlier CucCut Swift `WhisperCoreMLRuntime` and the Whisper in v2 `ccut-speech` item for item.

use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::Path;

use anyhow::{Context, Result, bail};
use serde_json::Value;

use crate::speech::tokenizer::Qwen3Tokenizer;

/// Number of samples in one decoding window: 30 seconds at 16 kHz. Longer audio is split into independent windows of this size.
pub const WINDOW_SAMPLES: usize = 480_000;
/// Token budget shared by the prompt, task prefix and generation in each window (large-v3's `n_text_ctx` is 448; here the 224 exported by WhisperKit is kept, the same basis as the earlier Core ML version).
pub const DECODER_TOKEN_BUDGET: usize = 224;
/// Stop when the same word repeats more than this many times in a row, so greedy decoding bails out early when it gets stuck in a loop.
const MAX_REPEATED_WORD_RUN: usize = 2;
/// The initial prompt takes at most half of the token budget: the budget is all of the "prompt + generation" for this audio segment, and if the prompt filled it there would be no room left to generate.
/// Overflow is trimmed from the **front**, keeping the part closest to the audio, the same trade-off as `max_prompt_ctx` in whisper.cpp.
const PROMPT_BUDGET_SHARE: usize = 2;

/// Special tokens and the language table from `generation_config.json` that decoding needs.
#[derive(Debug)]
pub struct GenerationConfig {
    pub(crate) start_of_transcript: i32,
    pub(crate) end_token: i32,
    pub(crate) english_token: i32,
    pub(crate) transcribe_token: i32,
    pub(crate) no_timestamps: i32,
    pub(crate) special_token_begin: i32,
    pub(crate) begin_suppress_tokens: HashSet<i32>,
    pub(crate) suppress_tokens: HashSet<i32>,
    pub(crate) language_tokens_by_code: HashMap<String, i32>,
    pub(crate) language_codes_by_token: HashMap<i32, String>,
    pub(crate) language_token_set: HashSet<i32>,
}

impl GenerationConfig {
    pub fn load(path: &Path) -> Result<Self> {
        let raw: Value = serde_json::from_slice(&fs::read(path).with_context(|| format!("read {}", path.display()))?)
            .context("parse Whisper generation_config.json")?;
        Self::from_json(&raw)
    }

    pub fn from_json(raw: &Value) -> Result<Self> {
        let object = raw.as_object().context("Whisper generation_config.json top level must be an object")?;
        let mut languages = HashMap::new();
        if let Some(entries) = object.get("lang_to_id").and_then(Value::as_object) {
            for (token, id) in entries {
                if let Some(id) = id.as_i64() {
                    languages.insert(token.trim_start_matches("<|").trim_end_matches("|>").to_lowercase(), id as i32);
                }
            }
        }
        let inverse = languages
            .iter()
            .map(|(code, token)| (*token, code.clone()))
            .collect::<HashMap<_, _>>();
        let end_token = json_i32(object.get("eos_token_id")).unwrap_or(50_257);
        let transcribe = object
            .get("task_to_id")
            .and_then(Value::as_object)
            .and_then(|tasks| tasks.get("transcribe"))
            .and_then(Value::as_i64)
            .map(|value| value as i32)
            .unwrap_or(50_360);
        let begin_suppress_tokens =
            json_i32_array(object.get("begin_suppress_tokens")).unwrap_or_else(|| [220, end_token].into_iter().collect());
        Ok(Self {
            start_of_transcript: json_i32(object.get("decoder_start_token_id")).unwrap_or(50_258),
            end_token,
            english_token: languages.get("en").copied().unwrap_or(50_259),
            transcribe_token: transcribe,
            no_timestamps: json_i32(object.get("no_timestamps_token_id")).unwrap_or(50_364),
            special_token_begin: end_token,
            begin_suppress_tokens,
            // Matches the Swift/WhisperKit greedy default: the broad exported suppress_tokens are ignored.
            suppress_tokens: HashSet::new(),
            language_token_set: languages.values().copied().collect(),
            language_tokens_by_code: languages,
            language_codes_by_token: inverse,
        })
    }

    pub fn start_of_transcript(&self) -> i32 {
        self.start_of_transcript
    }

    pub fn end_token(&self) -> i32 {
        self.end_token
    }

    pub fn english_token(&self) -> i32 {
        self.english_token
    }

    pub fn no_timestamps(&self) -> i32 {
        self.no_timestamps
    }

    pub fn special_token_begin(&self) -> i32 {
        self.special_token_begin
    }

    /// During language detection, the maximum is taken only over these tokens.
    pub fn is_language_token(&self, token: i32) -> bool {
        self.language_token_set.contains(&token)
    }

    /// Language hint (`zh`, `zh-Hant`, `EN`) → language token; returns `None` if it is not recognized, leaving it to language detection.
    pub fn language_token(&self, hint: &str) -> Option<i32> {
        let code = hint
            .trim()
            .to_lowercase()
            .split_once('-')
            .map(|(head, _)| head.to_owned())
            .unwrap_or_else(|| hint.trim().to_lowercase());
        self.language_tokens_by_code.get(&code).copied()
    }

    pub fn language_code(&self, token: i32) -> Option<String> {
        self.language_codes_by_token.get(&token).cloned()
    }

    /// Decoding task prefix: `<|startoftranscript|><|lang|><|transcribe|>`. This is **not** the initial prompt; that segment comes before it, see [`prompt_tokens`]. `<|notimestamps|>` comes after it, as the input to the first decoding step.
    pub fn task_tokens(&self, language_token: i32) -> [i32; 3] {
        [self.start_of_transcript, language_token, self.transcribe_token]
    }

    /// Whether this greedy decoding step should skip `token`: `<|endoftext|>` is skipped only when it is the first token and begin_suppress applies; all other special tokens (timestamps, language, task) are never emitted; as the first token, the begin_suppress set (spaces) is not emitted, and tokens in suppress are always not emitted.
    pub fn should_suppress(&self, token: i32, generated_count: usize) -> bool {
        if token == self.end_token {
            return generated_count == 0 && self.begin_suppress_tokens.contains(&token);
        }
        if token >= self.special_token_begin {
            return true;
        }
        (generated_count == 0 && self.begin_suppress_tokens.contains(&token)) || self.suppress_tokens.contains(&token)
    }
}

/// Whisper's `tokenizer.json` (`openai/whisper-large-v3`): decodes tokens and encodes recognition prompts.
#[derive(Debug)]
pub struct WhisperTokenizer {
    pub(crate) id_to_token: HashMap<i32, String>,
    pub(crate) special_ids: HashSet<i32>,
    pub(crate) byte_decoder: HashMap<char, u8>,
    /// The start-of-prompt marker. It may be missing from older exports of `tokenizer.json`; `None` means this set of weights has no prompt channel.
    pub(crate) start_of_prev: Option<i32>,
    /// Encoding direction: Whisper and Qwen3 are both GPT-2 byte-level BPE, so encoding reuses the shared tokenizer instead of reimplementing the merge loop here. (Decoding still uses `id_to_token` above, because special tokens are handled differently on the two sides.)
    pub(crate) encoder: Qwen3Tokenizer,
}

impl WhisperTokenizer {
    pub fn load(path: &Path) -> Result<Self> {
        let raw: Value = serde_json::from_slice(&fs::read(path).with_context(|| format!("read {}", path.display()))?)
            .context("parse Whisper tokenizer.json")?;
        let mut id_to_token = HashMap::new();
        if let Some(vocabulary) = raw.get("model").and_then(|model| model.get("vocab")).and_then(Value::as_object) {
            for (token, id) in vocabulary {
                if let Some(id) = id.as_i64() {
                    id_to_token.insert(id as i32, token.clone());
                }
            }
        }
        let mut special_ids = HashSet::new();
        if let Some(added) = raw.get("added_tokens").and_then(Value::as_array) {
            for token in added {
                let Some(id) = token.get("id").and_then(Value::as_i64) else {
                    continue;
                };
                if let Some(content) = token.get("content").and_then(Value::as_str) {
                    id_to_token.insert(id as i32, content.to_owned());
                }
                if token.get("special").and_then(Value::as_bool) == Some(true) {
                    special_ids.insert(id as i32);
                }
            }
        }
        if id_to_token.is_empty() {
            bail!("Whisper tokenizer.json does not contain model.vocab");
        }
        // `model.merges` may be either ["a b", …] (old format) or [["a","b"], …].
        let merges = raw
            .get("model")
            .and_then(|model| model.get("merges"))
            .and_then(Value::as_array)
            .map(|rows| rows.iter().filter_map(merge_pair).collect::<Vec<_>>())
            .unwrap_or_default();
        let start_of_prev = id_to_token
            .iter()
            .find(|(_, token)| token.as_str() == "<|startofprev|>")
            .map(|(id, _)| *id);
        let encoder = Qwen3Tokenizer::from_vocab_and_merges(
            id_to_token.iter().map(|(id, token)| (token.clone(), *id)).collect::<Vec<_>>(),
            merges,
        );
        Ok(Self {
            id_to_token,
            special_ids,
            byte_decoder: make_byte_decoder(),
            start_of_prev,
            encoder,
        })
    }

    /// Used only for recognition prompts: plain text → tokens. Special tokens do not take part (under byte-level BPE, the literal `<|…|>` is split into ordinary fragments and does not get a special id, which is exactly what is wanted).
    pub fn encode(&self, text: &str) -> Vec<i32> {
        self.encoder.encode(text)
    }

    pub fn decode(&self, ids: &[i32]) -> String {
        let mut bytes = Vec::with_capacity(ids.len() * 4);
        for id in ids {
            let Some(token) = self.id_to_token.get(id) else {
                continue;
            };
            if self.special_ids.contains(id) || token.is_empty() {
                continue;
            }
            for character in token.chars() {
                if let Some(byte) = self.byte_decoder.get(&character) {
                    bytes.push(*byte);
                } else {
                    let mut encoded = [0; 4];
                    bytes.extend_from_slice(character.encode_utf8(&mut encoded).as_bytes());
                }
            }
        }
        String::from_utf8_lossy(&bytes).into_owned()
    }
}

/// Builds the prompt segment of the decoder prefix from the recognition prompt (`<|startofprev|>` plus plain-text tokens). Whisper's initial prompt is `<|startofprev|>` followed by a segment of **plain-text** tokens. If this special token is missing (older exports), there is no prompt channel at all, so the function honestly returns empty rather than inserting the text as a transcript prefix (the model would copy it out as if it had already been recognized).
///
/// `token_budget` is the token budget shared by "prompt + generation" in each window. The prompt takes at most half, leaving room for the task prefix and the first-step input (`<|notimestamps|>`). Overflow is trimmed from the front: trimming the end would cut the speech off mid-sentence, while trimming the start only drops the earliest terms.
pub fn prompt_tokens(tokenizer: &WhisperTokenizer, generation: &GenerationConfig, prompt: Option<&str>, token_budget: usize) -> Vec<i32> {
    let Some(text) = prompt.map(str::trim).filter(|text| !text.is_empty()) else {
        return Vec::new();
    };
    let Some(start_of_prev) = tokenizer.start_of_prev else {
        eprintln!("whisper: vocabulary is missing <|startofprev|>; the recognition prompt is ignored");
        return Vec::new();
    };
    let mut tokens = tokenizer.encode(text);
    let task_prefix = generation.task_tokens(generation.english_token).len();
    let budget = (token_budget / PROMPT_BUDGET_SHARE).saturating_sub(task_prefix + 1);
    if tokens.len() > budget {
        tokens.drain(..tokens.len() - budget);
    }
    if tokens.is_empty() {
        return Vec::new();
    }
    let mut out = Vec::with_capacity(tokens.len() + 1);
    out.push(start_of_prev);
    out.extend(tokens);
    out
}

/// Returns the index of the largest value in `logits` that `should_skip` does not skip and that is not NaN.
pub fn argmax_where(logits: &[f32], should_skip: impl Fn(usize) -> bool) -> Option<i32> {
    let mut best = None;
    let mut best_value = f32::NEG_INFINITY;
    for (token, value) in logits.iter().copied().enumerate() {
        if should_skip(token) {
            continue;
        }
        if !value.is_nan() && value > best_value {
            best_value = value;
            best = Some(token as i32);
        }
    }
    best
}

/// Guard against greedy decoding getting stuck in repetition: stop when the last word repeats more than [`MAX_REPEATED_WORD_RUN`] times in a row.
pub fn should_stop_for_repeated_words(tokenizer: &WhisperTokenizer, tokens: &[i32]) -> bool {
    if tokens.len() <= MAX_REPEATED_WORD_RUN {
        return false;
    }
    let words = normalized_words(&tokenizer.decode(tokens));
    let Some(last) = words.last() else {
        return false;
    };
    words.iter().rev().take_while(|word| *word == last).count() > MAX_REPEATED_WORD_RUN
}

fn normalized_words(text: &str) -> Vec<String> {
    text.to_lowercase()
        .split(|character: char| !character.is_alphanumeric())
        .filter(|word| !word.is_empty())
        .map(str::to_owned)
        .collect()
}

/// One entry of the tokenizers `model.merges`: `"a b"` or `["a", "b"]`.
fn merge_pair(row: &Value) -> Option<(String, String)> {
    if let Some(text) = row.as_str() {
        let (first, second) = text.split_once(' ')?;
        return Some((first.to_owned(), second.to_owned()));
    }
    let pair = row.as_array()?;
    Some((pair.first()?.as_str()?.to_owned(), pair.get(1)?.as_str()?.to_owned()))
}

/// The GPT-2 byte-level BPE table mapping visible characters to bytes.
fn make_byte_decoder() -> HashMap<char, u8> {
    let mut bytes = (33_u16..=126).chain(161..=172).chain(174..=255).collect::<Vec<_>>();
    let mut characters = bytes.clone();
    let mut next = 0_u16;
    for byte in 0_u16..=255 {
        if !bytes.contains(&byte) {
            bytes.push(byte);
            characters.push(256 + next);
            next += 1;
        }
    }
    bytes
        .into_iter()
        .zip(characters)
        .filter_map(|(byte, scalar)| char::from_u32(scalar as u32).map(|c| (c, byte as u8)))
        .collect()
}

fn json_i32(value: Option<&Value>) -> Option<i32> {
    value.and_then(Value::as_i64).map(|number| number as i32)
}

fn json_i32_array(value: Option<&Value>) -> Option<HashSet<i32>> {
    value?
        .as_array()
        .map(|values| values.iter().filter_map(|value| json_i32(Some(value))).collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn byte_decoder_round_trips_all_bytes() {
        let decoder = make_byte_decoder();
        assert_eq!(decoder.len(), 256);
        let mut values = decoder.values().copied().collect::<Vec<_>>();
        values.sort_unstable();
        assert_eq!(values, (0..=255).collect::<Vec<_>>());
    }

    /// Only fills the entries decoding needs; the encoder and `<|startofprev|>` are tested separately.
    fn decode_only_tokenizer(id_to_token: HashMap<i32, String>) -> WhisperTokenizer {
        WhisperTokenizer {
            id_to_token,
            special_ids: HashSet::new(),
            byte_decoder: make_byte_decoder(),
            start_of_prev: None,
            encoder: Qwen3Tokenizer::default(),
        }
    }

    fn generation_config() -> GenerationConfig {
        GenerationConfig::from_json(&serde_json::json!({
            "decoder_start_token_id": 50_258,
            "eos_token_id": 50_257,
            "no_timestamps_token_id": 50_364,
            "begin_suppress_tokens": [220, 50_257],
            "suppress_tokens": [1, 2, 7],
            "lang_to_id": { "<|en|>": 50_259, "<|zh|>": 50_260 },
            "task_to_id": { "transcribe": 50_360, "translate": 50_359 },
        }))
        .unwrap()
    }

    #[test]
    fn repeated_word_guard_stops_third_consecutive_word() {
        let tokenizer = decode_only_tokenizer([(1, "Ġtest".to_owned())].into_iter().collect());
        assert!(!should_stop_for_repeated_words(&tokenizer, &[1, 1]));
        assert!(should_stop_for_repeated_words(&tokenizer, &[1, 1, 1]));
    }

    #[test]
    fn a_merge_row_reads_both_export_shapes() {
        assert_eq!(merge_pair(&serde_json::json!("Ġth e")), Some(("Ġth".to_owned(), "e".to_owned())));
        assert_eq!(
            merge_pair(&serde_json::json!(["Ġth", "e"])),
            Some(("Ġth".to_owned(), "e".to_owned()))
        );
        assert_eq!(merge_pair(&serde_json::json!("Ġthe")), None);
    }

    #[test]
    fn a_prompt_becomes_startofprev_plus_bpe_tokens() {
        // Mini vocabulary: single-byte tokens plus one merge, enough to show that "encoding goes through BPE, and the prompt is prefixed with `<|startofprev|>`".
        let vocab = vec![("a".to_owned(), 10), ("b".to_owned(), 11), ("ab".to_owned(), 12)];
        let merges = vec![("a".to_owned(), "b".to_owned())];
        let tokenizer = WhisperTokenizer {
            id_to_token: HashMap::new(),
            special_ids: HashSet::new(),
            byte_decoder: make_byte_decoder(),
            start_of_prev: Some(50_362),
            encoder: Qwen3Tokenizer::from_vocab_and_merges(vocab, merges),
        };
        assert_eq!(tokenizer.encode("ab"), vec![12]);
        let generation = generation_config();
        assert_eq!(
            prompt_tokens(&tokenizer, &generation, Some(" ab "), DECODER_TOKEN_BUDGET),
            vec![50_362, 12]
        );
        assert!(prompt_tokens(&tokenizer, &generation, Some("  "), DECODER_TOKEN_BUDGET).is_empty());
        assert!(prompt_tokens(&tokenizer, &generation, None, DECODER_TOKEN_BUDGET).is_empty());
        // Budget 224: the prompt takes at most 224 / 2 − 4 = 108 plain tokens, trimmed from the front.
        let long = "ab".repeat(200);
        let tokens = prompt_tokens(&tokenizer, &generation, Some(&long), DECODER_TOKEN_BUDGET);
        assert_eq!(tokens.len(), 1 + 108);
        // Without `<|startofprev|>` there is no prompt channel.
        let without = decode_only_tokenizer(HashMap::new());
        assert!(prompt_tokens(&without, &generation, Some("ab"), DECODER_TOKEN_BUDGET).is_empty());
    }

    #[test]
    fn language_hint_accepts_bcp47_region() {
        let generation = generation_config();
        assert_eq!(generation.language_token("zh-Hant"), Some(50_260));
        assert_eq!(generation.language_token(" EN "), Some(50_259));
        assert_eq!(generation.language_token("xx"), None);
        assert_eq!(generation.language_code(50_260).as_deref(), Some("zh"));
        assert_eq!(generation.task_tokens(50_260), [50_258, 50_260, 50_360]);
        assert!(generation.is_language_token(50_259));
        assert!(!generation.is_language_token(50_258));
    }

    #[test]
    fn suppression_matches_the_greedy_defaults() {
        let generation = generation_config();
        // The exported suppress_tokens are deliberately ignored.
        assert!(!generation.should_suppress(7, 1));
        // The first token cannot be a space and cannot end the sequence directly; later tokens may.
        assert!(generation.should_suppress(220, 0));
        assert!(!generation.should_suppress(220, 1));
        assert!(generation.should_suppress(50_257, 0));
        assert!(!generation.should_suppress(50_257, 1));
        // All other special tokens (language, task, timestamps) are never emitted.
        for token in [50_258, 50_259, 50_360, 50_364, 50_365] {
            assert!(generation.should_suppress(token, 3), "{token}");
        }
    }

    #[test]
    fn argmax_skips_suppressed_and_nan() {
        assert_eq!(argmax_where(&[0.1, f32::NAN, 0.3, 0.9], |token| token == 3), Some(2));
        assert_eq!(argmax_where(&[0.1], |_| true), None);
    }
}
