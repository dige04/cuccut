//! Automatic language identification: prefers the language the model itself reports (Qwen3-ASR's language name, Whisper's language code); when there is none, uses whatlang to infer it from the recognized
//! text.

use super::language::{self, QWEN_LANGUAGES, canonical_code, code_from_qwen_name};
use crate::bundle::FAMILY_WHISPER_MLX;

/// Text-based inference needs at least this many characters to be trusted.
pub const MIN_CHARS: usize = 40;

/// Model-reported language name → canonical code; if the name is not recognized, tries again by language tag.
pub fn code_from_name(name: Option<&str>) -> Option<String> {
    let name = name?.trim();
    if name.is_empty() || name.eq_ignore_ascii_case("none") {
        return None;
    }
    if name.eq_ignore_ascii_case("mandarin") {
        return Some("zh".to_owned());
    }
    code_from_qwen_name(name)
        .map(str::to_owned)
        .or_else(|| supported(name))
        .or_else(|| whisper_code(name))
}

/// Whisper reports a language code; those that Qwen3-ASR does not recognize but Whisper does (`sw`, `jw`) are accepted using Whisper's table.
fn whisper_code(tag: &str) -> Option<String> {
    language::supports(FAMILY_WHISPER_MLX, tag).then(|| canonical_code(tag)).flatten()
}

/// Infers the language from text with whatlang; `None` if the text is too short or the inferred language is not supported by Qwen3-ASR.
pub fn detect(text: &str) -> Option<String> {
    if text.chars().count() < MIN_CHARS {
        return None;
    }
    let info = whatlang::detect(text)?;
    if !info.is_reliable() {
        return None;
    }
    let code = match info.lang() {
        whatlang::Lang::Cmn => "zh",
        whatlang::Lang::Jpn => "ja",
        whatlang::Lang::Kor => "ko",
        whatlang::Lang::Eng => "en",
        other => return supported(&iso639_1(other.code())),
    };
    Some(code.to_owned())
}

/// Last-resort guess when the language is still unknown after the whole transcription (ported from v2): among the first 4000 letters, if kana make up more than 10% it is Japanese; if Hangul make up more than half it is Korean; if Han characters make up more than half it is Chinese;
/// otherwise defer to whatlang, with no minimum length and no confidence threshold. Used to choose the aligner's language when MOSS refines word timings.
pub fn guess_final(text: &str) -> Option<String> {
    let sample: String = text.chars().take(4_000).collect();
    let (mut han, mut kana, mut hangul, mut letters) = (0usize, 0usize, 0usize, 0usize);
    for character in sample.chars().filter(|character| character.is_alphabetic()) {
        letters += 1;
        match character as u32 {
            0x4E00..=0x9FFF | 0x3400..=0x4DBF | 0xF900..=0xFAFF => han += 1,
            0x3040..=0x30FF => kana += 1,
            0xAC00..=0xD7A3 | 0x1100..=0x11FF => hangul += 1,
            _ => {}
        }
    }
    if letters > 0 {
        if kana * 10 >= letters {
            return Some("ja".to_string());
        }
        if hangul * 2 >= letters {
            return Some("ko".to_string());
        }
        if han * 2 >= letters {
            return Some("zh".to_string());
        }
    }
    let info = whatlang::detect(&sample)?;
    match info.lang() {
        whatlang::Lang::Cmn => Some("zh".to_owned()),
        whatlang::Lang::Jpn => Some("ja".to_owned()),
        whatlang::Lang::Kor => Some("ko".to_owned()),
        whatlang::Lang::Eng => Some("en".to_owned()),
        other => supported(&iso639_1(other.code())),
    }
}

fn supported(tag: &str) -> Option<String> {
    let code = canonical_code(tag)?;
    QWEN_LANGUAGES.iter().any(|(known, _)| *known == code).then_some(code)
}

/// whatlang gives ISO 639-3 codes; only these among the languages Qwen supports need to be converted to 639-1.
fn iso639_1(code: &str) -> String {
    const TABLE: &[(&str, &str)] = &[
        ("ara", "ar"),
        ("deu", "de"),
        ("fra", "fr"),
        ("spa", "es"),
        ("por", "pt"),
        ("ind", "id"),
        ("ita", "it"),
        ("rus", "ru"),
        ("tha", "th"),
        ("vie", "vi"),
        ("tur", "tr"),
        ("hin", "hi"),
        ("nld", "nl"),
        ("swe", "sv"),
        ("dan", "da"),
        ("fin", "fi"),
        ("pol", "pl"),
        ("ces", "cs"),
        ("tgl", "fil"),
        ("pes", "fa"),
        ("ell", "el"),
        ("ron", "ro"),
        ("hun", "hu"),
        ("mkd", "mk"),
    ];
    TABLE
        .iter()
        .find(|(three, _)| *three == code)
        .map_or_else(|| code.to_owned(), |(_, two)| (*two).to_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn model_language_names_map_to_codes() {
        assert_eq!(code_from_name(Some("English")).as_deref(), Some("en"));
        assert_eq!(code_from_name(Some("Cantonese")).as_deref(), Some("yue"));
        assert_eq!(code_from_name(Some("mandarin")).as_deref(), Some("zh"));
        assert_eq!(code_from_name(Some("de")).as_deref(), Some("de"));
        // Whisper reports language codes: those that Qwen3-ASR does not recognize are accepted per Whisper's table.
        assert_eq!(code_from_name(Some("sw")).as_deref(), Some("sw"));
        assert_eq!(code_from_name(Some("jw")).as_deref(), Some("jw"));
        assert_eq!(code_from_name(Some("None")), None);
        assert_eq!(code_from_name(Some("Klingon")), None);
        assert_eq!(code_from_name(None), None);
    }

    #[test]
    fn detects_language_from_text() {
        assert_eq!(detect("short"), None);
        let english = "The quick brown fox jumps over the lazy dog while the band keeps playing all night long.";
        assert_eq!(detect(english).as_deref(), Some("en"));
        let german = "Der schnelle braune Fuchs springt über den faulen Hund, während die Musik die ganze Nacht spielt.";
        assert_eq!(detect(german).as_deref(), Some("de"));
        let chinese = "今天天气很好，我们一起去公园散步吧，顺便看看湖边新开的花，还有很多小朋友在那里放风筝玩耍。";
        assert_eq!(detect(chinese).as_deref(), Some("zh"));
    }

    #[test]
    fn final_guess_counts_scripts_before_asking_whatlang() {
        assert_eq!(guess_final("今天天气很好").as_deref(), Some("zh"));
        assert_eq!(guess_final("今日はいい天気ですね").as_deref(), Some("ja"));
        assert_eq!(guess_final("오늘 날씨가 좋네요").as_deref(), Some("ko"));
        // No minimum length threshold: short sentences also get a guess.
        assert_eq!(guess_final("testing one two three").as_deref(), Some("en"));
        assert_eq!(guess_final("   "), None);
    }
}
