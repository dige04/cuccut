//! Partly implemented by rewriting speech-swift (https://github.com/soniqo/speech-swift).
//! Upstream file: `Sources/Qwen3TTS/Configuration.swift`.
//! Copyright 2025 Ivan Digital
//! SPDX-License-Identifier: Apache-2.0
//! Changes: CucCut rewrote the related Swift implementation in Rust and adapted it to this project's tensor backend and model-package interface.
//! Full original license: `crates/model-runtime/licenses/speech-swift.txt`; for the scope of sources, see `THIRD_PARTY_NOTICES.md` at the repo root.
//!
//! Fixed token ids and language mapping for Qwen3-TTS. Pure constants, compiles on all platforms.

/// Codec-side special tokens.
pub const CODEC_PAD: i32 = 2148;
pub const CODEC_BOS: i32 = 2149;
pub const CODEC_EOS: i32 = 2150;
pub const CODEC_THINK: i32 = 2154;
pub const CODEC_NOTHINK: i32 = 2155;
pub const CODEC_THINK_BOS: i32 = 2156;
pub const CODEC_THINK_EOS: i32 = 2157;

/// Text-side TTS special tokens.
pub const TTS_PAD: i32 = 151_671;
pub const TTS_BOS: i32 = 151_672;
pub const TTS_EOS: i32 = 151_673;

/// Chat template tokens.
pub const IM_START: i32 = 151_644;
pub const IM_END: i32 = 151_645;
pub const NEWLINE: i32 = 198;
pub const ASSISTANT: i32 = 77_091;
pub const USER: i32 = 872;

/// Codec vocabulary range `[2048, 3072)` suppressed during Talker sampling (EOS excepted).
pub const SUPPRESS_START: i32 = 2048;
pub const SUPPRESS_END: i32 = 3072;

/// Language ids.
pub const LANGUAGE_ENGLISH: i32 = 2050;
pub const LANGUAGE_GERMAN: i32 = 2053;
pub const LANGUAGE_SPANISH: i32 = 2054;
pub const LANGUAGE_CHINESE: i32 = 2055;
pub const LANGUAGE_JAPANESE: i32 = 2058;
pub const LANGUAGE_FRENCH: i32 = 2061;
pub const LANGUAGE_SICHUAN_DIALECT: i32 = 2062;
pub const LANGUAGE_KOREAN: i32 = 2064;
pub const LANGUAGE_RUSSIAN: i32 = 2069;
pub const LANGUAGE_ITALIAN: i32 = 2070;
pub const LANGUAGE_PORTUGUESE: i32 = 2071;
pub const LANGUAGE_BEIJING_DIALECT: i32 = 2074;

/// 24 kHz samples per codec frame (12.5 Hz).
pub const SAMPLES_PER_FRAME: usize = 1920;
/// Output sample rate.
pub const SAMPLE_RATE: u32 = 24_000;
/// Number of codebooks per frame (1 Talker + 15 Code Predictor).
pub const NUM_CODEBOOKS: usize = 16;

/// Language name (full name or ISO abbreviation, case-insensitive) → codec language id. Returns `None` if unknown.
pub fn language_id(language: &str) -> Option<i32> {
    match language.trim().to_ascii_lowercase().as_str() {
        "english" | "en" => Some(LANGUAGE_ENGLISH),
        "german" | "de" => Some(LANGUAGE_GERMAN),
        "chinese" | "zh" => Some(LANGUAGE_CHINESE),
        "japanese" | "ja" => Some(LANGUAGE_JAPANESE),
        "spanish" | "es" => Some(LANGUAGE_SPANISH),
        "french" | "fr" => Some(LANGUAGE_FRENCH),
        "korean" | "ko" => Some(LANGUAGE_KOREAN),
        "russian" | "ru" => Some(LANGUAGE_RUSSIAN),
        "italian" | "it" => Some(LANGUAGE_ITALIAN),
        "portuguese" | "pt" => Some(LANGUAGE_PORTUGUESE),
        "beijing_dialect" => Some(LANGUAGE_BEIJING_DIALECT),
        "sichuan_dialect" => Some(LANGUAGE_SICHUAN_DIALECT),
        _ => None,
    }
}

/// Normalizes a language label from `crate::synthesize::text::guess_language` or from user input into the full name used by the language table. Unknown labels are returned as-is (the following `language_id` call will classify them as unknown).
pub fn normalize_language(tag: &str) -> String {
    let lower = tag.trim().to_ascii_lowercase();
    let base = lower.split(['-', '_']).next().unwrap_or("");
    let base = if lower == "beijing_dialect" || lower == "sichuan_dialect" {
        lower.as_str()
    } else {
        base
    };
    match base {
        "en" => "english",
        "de" => "german",
        "zh" | "cmn" => "chinese",
        "ja" => "japanese",
        "es" => "spanish",
        "fr" => "french",
        "ko" => "korean",
        "ru" => "russian",
        "it" => "italian",
        "pt" => "portuguese",
        _ => return lower,
    }
    .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_language_names_and_codes() {
        assert_eq!(language_id("Chinese"), Some(LANGUAGE_CHINESE));
        assert_eq!(language_id("zh"), Some(LANGUAGE_CHINESE));
        assert_eq!(language_id("EN"), Some(LANGUAGE_ENGLISH));
        assert_eq!(language_id("sichuan_dialect"), Some(LANGUAGE_SICHUAN_DIALECT));
        assert_eq!(language_id("klingon"), None);
        assert_eq!(language_id("auto"), None);
    }

    #[test]
    fn normalizes_bcp47_tags() {
        assert_eq!(normalize_language("zh-CN"), "chinese");
        assert_eq!(normalize_language("en_US"), "english");
        assert_eq!(normalize_language("ja"), "japanese");
        assert_eq!(normalize_language("beijing_dialect"), "beijing_dialect");
        assert_eq!(normalize_language("Chinese"), "chinese");
        assert_eq!(normalize_language("xx"), "xx");
    }
}
