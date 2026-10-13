//! Partly implemented by rewriting speech-swift (https://github.com/soniqo/speech-swift).
//! Upstream files: `Sources/Qwen3TTS/Qwen3TTS.swift / Sources/Qwen3TTS/Qwen3TTS+ICL.swift`.
//! Copyright 2025 Ivan Digital
//! SPDX-License-Identifier: Apache-2.0
//! Changes: CucCut rewrote the related Swift implementation in Rust and adapted it to this project's tensor backend and model-package interface.
//! Full original license: `crates/model-runtime/licenses/speech-swift.txt`; for the scope of sources, see `THIRD_PARTY_NOTICES.md` at the repo root.
//!
//! Pure-logic part of prompt construction: the chat-template token sequence, codec prefix, speaker resolution, and
//! the max-token cap (both the normal and ICL paths).
//!
//! Embedding concatenation (which needs MLX arrays) is done in `talker.rs`. This module only produces the token sequence and
//! length information, so it can be unit-tested without weights.

use super::config::SpeakerConfig;
use super::tokens::*;

/// Default instruction automatically added for CustomVoice when no explicit instruct is given (prevents rambling on short sentences).
pub const DEFAULT_INSTRUCT: &str = "Speak naturally.";

/// `<|im_start|>assistant\n{text}<|im_end|>\n<|im_start|>assistant\n`。
pub fn text_tokens(text_ids: &[i32]) -> Vec<i32> {
    let mut tokens = Vec::with_capacity(text_ids.len() + 8);
    tokens.extend_from_slice(&[IM_START, ASSISTANT, NEWLINE]);
    tokens.extend_from_slice(text_ids);
    tokens.extend_from_slice(&[IM_END, NEWLINE, IM_START, ASSISTANT, NEWLINE]);
    tokens
}

/// `<|im_start|>user\n{instruct}<|im_end|>\n`。
pub fn instruct_tokens(instruct_ids: &[i32]) -> Vec<i32> {
    let mut tokens = Vec::with_capacity(instruct_ids.len() + 5);
    tokens.extend_from_slice(&[IM_START, USER, NEWLINE]);
    tokens.extend_from_slice(instruct_ids);
    tokens.extend_from_slice(&[IM_END, NEWLINE]);
    tokens
}

/// Assistant role prefix `<|im_start|>assistant\n` (used separately on the ICL path).
pub fn role_tokens() -> [i32; 3] {
    [IM_START, ASSISTANT, NEWLINE]
}

/// codec 前缀：`[think, think_bos, lang, think_eos, (spk)?, pad, bos]`。
pub fn codec_prefix(language_id: i32, speaker_token: Option<i32>) -> Vec<i32> {
    let mut prefix = vec![CODEC_THINK, CODEC_THINK_BOS, language_id, CODEC_THINK_EOS];
    if let Some(spk) = speaker_token {
        prefix.push(spk);
    }
    prefix.push(CODEC_PAD);
    prefix.push(CODEC_BOS);
    prefix
}

/// Codec prefix for the ICL path (excludes the speaker token; the speaker embedding is inserted at the vector level):
/// with a language, `[think, think_bos, lang, think_eos, pad, bos]`, with the speaker inserted at index 4;
/// without a language (auto), `[nothink, think_bos, think_eos, pad, bos]`, with the speaker inserted at index 3.
/// Returns `(tokens, speaker_insert_index)`.
pub fn icl_codec_prefix(language_id: Option<i32>) -> (Vec<i32>, usize) {
    match language_id {
        Some(lang) => (vec![CODEC_THINK, CODEC_THINK_BOS, lang, CODEC_THINK_EOS, CODEC_PAD, CODEC_BOS], 4),
        None => (vec![CODEC_NOTHINK, CODEC_THINK_BOS, CODEC_THINK_EOS, CODEC_PAD, CODEC_BOS], 3),
    }
}

/// Speaker resolution result.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ResolvedSpeaker {
    /// Speaker codec token; `None` when the model has no speaker table or the name is unknown.
    pub token: Option<i32>,
    /// Effective language name (overridden by the dialect when the speaker is a dialect speaker and the caller did not explicitly specify a language).
    pub language: String,
    /// Hint emitted when no speaker is found (can be used for a warning or an error).
    pub warning: Option<String>,
}

/// The 9 CustomVoice speakers. The roster is pure data and lives in `synthesize::voices`, so it can be listed without loading the engine.
pub use crate::synthesize::voices::CUSTOM_VOICE_SPEAKERS;

/// Of CustomVoice's 9 speakers, the default for each language (lowercase name, matching the keys of `speaker_ids`).
/// Japanese and Korean each have a female voice in their own language, Chinese uses Vivian, and the other Latin-script languages use Serena. This is the same "female voice first" rule as the built-in voices (`crate::synthesize::voices::default_for`).
const DEFAULT_SPEAKERS: &[(&str, &str)] = &[
    ("chinese", "vivian"),
    ("beijing_dialect", "vivian"),
    ("sichuan_dialect", "vivian"),
    ("japanese", "ono_anna"),
    ("korean", "sohee"),
    ("english", "serena"),
];

/// Built-in voice id → the **nearest** CustomVoice speaker. CustomVoice cannot clone, so the recording bundled with the pack has no use on it. When the name is passed through, no error is raised; a same-language, same-gender speaker is picked.
/// Neither model has a Japanese male voice or the Spanish voices, so English stands in for them; the log says so.
const BUILTIN_NEAR: &[(&str, &str)] = &[
    ("zh-female", "vivian"),
    ("zh-male", "uncle_fu"),
    ("en-female", "serena"),
    ("en-male", "eric"),
    ("ja-female", "ono_anna"),
    ("ja-male", "dylan"),
    ("es-female", "serena"),
    ("es-male", "ryan"),
];

/// The speaker CustomVoice uses when none is specified: look up by language first. If the table has no entry (or the model lacks that speaker), fall back to the first speaker in the speaker table. When the model has no speaker table, give `None` (Base takes the cloning path).
pub fn default_speaker(language: &str, config: Option<&SpeakerConfig>) -> Option<String> {
    let config = config?;
    let wanted = DEFAULT_SPEAKERS
        .iter()
        .find(|(lang, _)| *lang == language)
        .map(|(_, speaker)| *speaker);
    if let Some(wanted) = wanted
        && config.speaker_ids.contains_key(wanted)
    {
        return Some(wanted.to_owned());
    }
    config.available_speakers().into_iter().next()
}

/// Built-in voice id → the nearest speaker in this model. If it is not a built-in voice, or the model lacks that speaker, give `None`.
pub fn nearest_speaker(id: &str, config: &SpeakerConfig) -> Option<&'static str> {
    let id = crate::synthesize::voices::find(id)?.id;
    BUILTIN_NEAR
        .iter()
        .find(|(builtin, _)| *builtin == id)
        .map(|(_, speaker)| *speaker)
        .filter(|speaker| config.speaker_ids.contains_key(*speaker))
}

/// Lowercase lookup. For dialect speakers, when `language_explicit == false`,
/// the language is changed to the dialect.
pub fn resolve_speaker(speaker: Option<&str>, config: Option<&SpeakerConfig>, language: &str, language_explicit: bool) -> ResolvedSpeaker {
    let Some(name) = speaker else {
        return ResolvedSpeaker {
            token: None,
            language: language.to_string(),
            warning: None,
        };
    };
    let Some(config) = config else {
        return ResolvedSpeaker {
            token: None,
            language: language.to_string(),
            warning: Some(format!("模型没有说话人表，忽略说话人 {name:?}（需要 CustomVoice 变体）")),
        };
    };
    let mut key = name.to_lowercase();
    if !config.speaker_ids.contains_key(&key)
        && let Some(near) = nearest_speaker(name, config)
    {
        eprintln!("[qwen3-tts] CustomVoice 没有内置音色 {name:?}，就近用 {near}");
        key = near.to_owned();
    }
    let Some(&token) = config.speaker_ids.get(&key) else {
        return ResolvedSpeaker {
            token: None,
            language: language.to_string(),
            warning: Some(format!("未知说话人 {name:?}，可用：{}", config.available_speakers().join(", "))),
        };
    };
    let mut effective = language.to_string();
    if !language_explicit && let Some(dialect) = config.speaker_dialects.get(&key) {
        effective = dialect.clone();
    }
    ResolvedSpeaker {
        token: Some(token),
        language: effective,
        warning: None,
    }
}

/// Lower bound of the cap: 125 frames = 10 s.
///
/// The cap should only stop runaway generation that never ends. It should not truncate a normal sentence spoken slowly. The original 75 frames (6 s) was in practice the cap for short sentences: an 18-character sentence with three enumeration commas (、) spoken a bit slowly runs past 6 s, gets cut mid-way, and leaves only a warning line on stderr (measured during a speaking-rate investigation on 2026-09-23).
pub const MIN_TOKEN_CAP: usize = 125;

/// Token cap for normal synthesis: `min(max_tokens, max(125, text token count × 8))`,
/// further truncated by the generation loop's safety cap of 2048. 8 frames per token (0.64 s) is more than twice the duration of normal speech.
pub fn max_token_cap(text_token_count: usize, max_tokens: usize) -> usize {
    max_tokens.min((text_token_count * 8).max(MIN_TOKEN_CAP))
}

/// Token cap for ICL synthesis: `min(max_tokens, max(125, target text token count × 8))`.
pub fn icl_max_token_cap(target_token_count: usize, max_tokens: usize) -> usize {
    max_tokens.min((target_token_count * 8).max(MIN_TOKEN_CAP))
}

/// Hard cap on the generation loop (matches the reference implementation's 2048).
pub const SAFE_MAX_TOKENS: usize = 2048;

/// Token index range `[4, len-5)` for the trailing text on the normal path.
/// When the range is empty, only `tts_eos` remains.
pub fn trailing_text_range(text_token_len: usize) -> Option<std::ops::Range<usize>> {
    let start = 4usize;
    let end = text_token_len.saturating_sub(5);
    (end > start).then_some(start..end)
}

/// Text/codec alignment on the ICL path: returns `(overlay_len, trailing_kind)`.
/// When the text is longer than the codec, the first `codec_len` text embeddings are overlaid onto the codec and the rest form the trailing part.
/// Otherwise the text is right-padded with `tts_pad` to `codec_len`, and the trailing part is a single `tts_pad`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum IclTrailing {
    /// The trailing part is the text embeddings `[codec_len, text_len)`.
    TextFrom(usize),
    /// Text is too short: pad with `pad_count` `tts_pad` tokens, and the trailing part is a single `tts_pad`.
    Padded { pad_count: usize },
}

pub fn icl_alignment(text_len_with_eos: usize, codec_len: usize) -> IclTrailing {
    if text_len_with_eos > codec_len {
        IclTrailing::TextFrom(codec_len)
    } else {
        IclTrailing::Padded {
            pad_count: codec_len - text_len_with_eos,
        }
    }
}

/// Number of samples to trim from the front of the waveform after ICL decoding, to remove the reference portion:
/// `cut = ref_frames * total_samples / total_frames`, applied only when `0 < cut < total_samples`.
pub fn icl_reference_cut(ref_frames: usize, total_frames: usize, total_samples: usize) -> usize {
    if total_frames == 0 {
        return 0;
    }
    let cut = ref_frames * total_samples / total_frames;
    if cut > 0 && cut < total_samples { cut } else { 0 }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::BTreeMap;

    fn speaker_config() -> SpeakerConfig {
        let mut speaker_ids = BTreeMap::new();
        speaker_ids.insert("vivian".to_string(), 3065);
        speaker_ids.insert("eric".to_string(), 2875);
        speaker_ids.insert("ono_anna".to_string(), 2901);
        speaker_ids.insert("sohee".to_string(), 2902);
        let mut speaker_dialects = BTreeMap::new();
        speaker_dialects.insert("eric".to_string(), "sichuan_dialect".to_string());
        SpeakerConfig {
            speaker_ids,
            speaker_dialects,
            codec_language_ids: BTreeMap::new(),
        }
    }

    #[test]
    fn customvoice_default_speaker_follows_the_language() {
        let config = speaker_config();
        assert_eq!(default_speaker("japanese", Some(&config)).as_deref(), Some("ono_anna"));
        assert_eq!(default_speaker("korean", Some(&config)).as_deref(), Some("sohee"));
        assert_eq!(default_speaker("chinese", Some(&config)).as_deref(), Some("vivian"));
        // No serena in the table: fall back to the first speaker in the speaker table (BTreeMap lexicographic order)
        assert_eq!(default_speaker("english", Some(&config)).as_deref(), Some("eric"));
        // No speaker table means Base, which takes the cloning path
        assert_eq!(default_speaker("chinese", None), None);
    }

    #[test]
    fn builtin_ids_land_on_the_nearest_customvoice_speaker() {
        let config = speaker_config();
        assert_eq!(nearest_speaker("zh-female", &config), Some("vivian"));
        assert_eq!(nearest_speaker("ja-female", &config), Some("ono_anna"));
        // The nearest speaker is not installed in this model (uncle_fu): don't force it
        assert_eq!(nearest_speaker("zh-male", &config), None);
        assert_eq!(nearest_speaker("Vivian", &config), None);
        // An unknown speaker that is a built-in voice id is resolved to the nearest speaker at parse time, with no error
        let resolved = resolve_speaker(Some("zh-female"), Some(&config), "chinese", true);
        assert_eq!(resolved.token, Some(3065));
        assert!(resolved.warning.is_none());
        // Neither a speaker nor a built-in voice: warn as before
        assert!(resolve_speaker(Some("女性-温柔"), Some(&config), "chinese", true).warning.is_some());
    }

    #[test]
    fn chat_template_layout() {
        let tokens = text_tokens(&[10, 11, 12]);
        assert_eq!(
            tokens,
            vec![
                IM_START, ASSISTANT, NEWLINE, 10, 11, 12, IM_END, NEWLINE, IM_START, ASSISTANT, NEWLINE
            ]
        );
        assert_eq!(trailing_text_range(tokens.len()), Some(4..6));
        // Single-token text: [4, 4) is empty, only tts_eos remains.
        assert_eq!(trailing_text_range(text_tokens(&[10]).len()), None);
        assert_eq!(instruct_tokens(&[7]), vec![IM_START, USER, NEWLINE, 7, IM_END, NEWLINE]);
    }

    #[test]
    fn codec_prefix_layout() {
        assert_eq!(
            codec_prefix(LANGUAGE_CHINESE, None),
            vec![CODEC_THINK, CODEC_THINK_BOS, 2055, CODEC_THINK_EOS, CODEC_PAD, CODEC_BOS]
        );
        assert_eq!(codec_prefix(LANGUAGE_CHINESE, Some(3065)).len(), 7);
        assert_eq!(codec_prefix(LANGUAGE_CHINESE, Some(3065))[4], 3065);
        assert_eq!(icl_codec_prefix(Some(2050)).1, 4);
        let (no_lang, at) = icl_codec_prefix(None);
        assert_eq!(no_lang[0], CODEC_NOTHINK);
        assert_eq!(no_lang.len(), 5);
        assert_eq!(at, 3);
    }

    #[test]
    fn speaker_resolution_and_dialect_override() {
        let config = speaker_config();
        let r = resolve_speaker(Some("Vivian"), Some(&config), "chinese", false);
        assert_eq!(r.token, Some(3065));
        assert_eq!(r.language, "chinese");
        let r = resolve_speaker(Some("eric"), Some(&config), "chinese", false);
        assert_eq!(r.language, "sichuan_dialect");
        let r = resolve_speaker(Some("eric"), Some(&config), "chinese", true);
        assert_eq!(r.language, "chinese");
        let r = resolve_speaker(Some("nobody"), Some(&config), "english", false);
        assert_eq!(r.token, None);
        assert!(r.warning.unwrap().contains("vivian"));
        let r = resolve_speaker(Some("vivian"), None, "english", false);
        assert_eq!(r.token, None);
        assert!(r.warning.is_some());
    }

    #[test]
    fn token_caps() {
        assert_eq!(max_token_cap(5, 4096), 125);
        // "工具是它的双手，能搜索、点击、下单；" ("Tools are its hands: it can search, click and place orders;"), about 12 tokens: the old 75-frame cap cut it off at 6 s.
        assert_eq!(max_token_cap(12, 4096), 125);
        assert_eq!(max_token_cap(100, 4096), 800);
        assert_eq!(max_token_cap(1000, 500), 500);
        assert_eq!(icl_max_token_cap(5, 4096), 125);
        assert_eq!(icl_max_token_cap(20, 4096), 160);
    }

    #[test]
    fn icl_alignment_and_cut() {
        assert_eq!(icl_alignment(10, 6), IclTrailing::TextFrom(6));
        assert_eq!(icl_alignment(4, 6), IclTrailing::Padded { pad_count: 2 });
        assert_eq!(icl_alignment(6, 6), IclTrailing::Padded { pad_count: 0 });
        assert_eq!(icl_reference_cut(10, 40, 40 * 1920), 10 * 1920);
        assert_eq!(icl_reference_cut(0, 40, 100), 0);
        assert_eq!(icl_reference_cut(40, 40, 100), 0);
    }

    /// The default speaker and the names in the nearest-voice table are both in the publicly listed roster (the roster is another way of writing the lowercase lookup).
    #[test]
    fn speaker_tables_point_into_the_published_list() {
        let published: Vec<String> = CUSTOM_VOICE_SPEAKERS.iter().map(|name| name.to_lowercase()).collect();
        for (_, speaker) in DEFAULT_SPEAKERS.iter().chain(BUILTIN_NEAR) {
            assert!(published.iter().any(|name| name == speaker), "{speaker}");
        }
    }
}
