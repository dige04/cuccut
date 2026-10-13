//! Pure logic for the OmniVoice text side: language resolution, text concatenation and cleaning, punctuation completion for reference text,
//! splitting of non-verbal tags, and duration (token count) estimation. All ported line by line from the upstream source:
//! - `omnivoice/models/omnivoice.py`: `_resolve_language`, `_combine_text`,
//!   `_NONVERBAL_PATTERN`, `_estimate_target_tokens`, and how `_ZH_RE` is used;
//! - `omnivoice/utils/text.py::add_punctuation`;
//! - `omnivoice/utils/duration.py::RuleDurationEstimator`.

use super::lang_table::LANG_NAME_TO_ID;
use fancy_regex::Regex as FancyRegex;
use regex::Regex;
use std::sync::OnceLock;

/// Upstream `_ZH_RE`: `[一-鿿]`.
pub fn contains_zh(text: &str) -> bool {
    text.chars().any(is_cjk)
}

fn is_cjk(c: char) -> bool {
    ('\u{4e00}'..='\u{9fff}').contains(&c)
}

/// Upstream `_resolve_language`: `None` / `"none"` → language-independent; an exact language id match is used as-is;
/// otherwise the lowercase language name is looked up in the table; if neither matches, it falls back to `None` (upstream likewise only logs a warning).
///
/// CucCut adds one step: when upstream fails to recognize the value, it takes the lowercase primary subtag of the BCP-47 tag (`zh-CN` → `zh`, `EN` → `en`), because CucCut passes BCP-47 tags everywhere.
pub fn resolve_language(language: Option<&str>) -> Option<String> {
    let language = language?;
    if language.to_lowercase() == "none" {
        return None;
    }
    let official = |tag: &str| -> Option<String> {
        if is_language_id(tag) {
            return Some(tag.to_string());
        }
        let key = tag.to_lowercase();
        LANG_NAME_TO_ID
            .binary_search_by(|(name, _)| name.as_bytes().cmp(key.as_bytes()))
            .ok()
            .map(|i| LANG_NAME_TO_ID[i].1.to_string())
    };
    if let Some(id) = official(language) {
        return Some(id);
    }
    let base = language.trim().split(['-', '_']).next().unwrap_or("").to_ascii_lowercase();
    if !base.is_empty() && is_language_id(&base) {
        return Some(base);
    }
    None
}

fn is_language_id(tag: &str) -> bool {
    LANG_NAME_TO_ID.iter().any(|(_, id)| *id == tag)
}

/// Upstream `_combine_text`: when there is reference text, `ref.strip() + " " + text.strip()`; removes CR/LF, converts full-width brackets to half-width, merges consecutive spaces and tabs into one, and removes whitespace directly adjacent to Han characters.
pub fn combine_text(text: &str, ref_text: Option<&str>) -> String {
    static NEWLINES: OnceLock<Regex> = OnceLock::new();
    static SPACES: OnceLock<Regex> = OnceLock::new();
    static AROUND_CJK: OnceLock<FancyRegex> = OnceLock::new();
    let full = match ref_text.filter(|r| !r.is_empty()) {
        Some(r) => format!("{} {}", py_strip(r), py_strip(text)),
        None => py_strip(text).to_string(),
    };
    let full = NEWLINES
        .get_or_init(|| Regex::new(r"[\r\n]+").expect("regex"))
        .replace_all(&full, "");
    let full = full.replace('\u{ff08}', "(").replace('\u{ff09}', ")");
    let full = SPACES.get_or_init(|| Regex::new(r"[ \t]+").expect("regex")).replace_all(&full, " ");
    AROUND_CJK
        .get_or_init(|| FancyRegex::new(r"(?<=[\x{4e00}-\x{9fff}])\s+|\s+(?=[\x{4e00}-\x{9fff}])").expect("regex"))
        .replace_all(&full, "")
        .into_owned()
}

/// Python `str.strip()`: removes Unicode whitespace at both ends.
fn py_strip(s: &str) -> &str {
    s.trim()
}

/// Upstream `END_PUNCTUATION` (`omnivoice/utils/text.py`); the two-character “……” in the upstream set can never
/// match a single final character, so it is omitted here.
const END_PUNCTUATION: &[char] = &[
    '!', '"', '\'', ')', ',', '.', ':', ';', '?', ']', '}', '‘', '’', '“', '”', '…', '、', '。', '】', '！', '）', '，', '：', '；', '？',
];

/// Upstream `add_punctuation`: if the reference text does not end with punctuation, appends “。” (when it contains Han characters) or “.”.
pub fn add_punctuation(text: &str) -> String {
    let text = text.trim();
    match text.chars().last() {
        None => String::new(),
        Some(last) if END_PUNCTUATION.contains(&last) => text.to_string(),
        Some(_) if contains_zh(text) => format!("{text}。"),
        Some(_) => format!("{text}."),
    }
}

/// The 13 non-verbal tags of upstream `_NONVERBAL_PATTERN`.
pub const NONVERBAL_TAGS: [&str; 13] = [
    "laughter",
    "sigh",
    "confirmation-en",
    "question-en",
    "question-ah",
    "question-oh",
    "question-ei",
    "question-yi",
    "surprise-ah",
    "surprise-oh",
    "surprise-wa",
    "surprise-yo",
    "dissatisfaction-hnn",
];

/// Splitting in upstream `_tokenize_with_nonverbal_tags`: non-verbal tags (`[laughter]` etc.) form their own segments,
/// and the remaining text forms segments as-is (each segment is tokenized separately, then concatenated).
pub fn split_nonverbal(text: &str) -> Vec<&str> {
    static PATTERN: OnceLock<Regex> = OnceLock::new();
    let pattern = PATTERN.get_or_init(|| Regex::new(&format!(r"\[({})\]", NONVERBAL_TAGS.join("|"))).expect("regex"));
    let mut parts = Vec::new();
    let mut last = 0;
    for m in pattern.find_iter(text) {
        if m.start() > last {
            parts.push(&text[last..m.start()]);
        }
        parts.push(m.as_str());
        last = m.end();
    }
    if last < text.len() {
        parts.push(&text[last..]);
    }
    parts
}

/// Character weights of upstream `RuleDurationEstimator`.
fn char_weight(c: char) -> f64 {
    const LATIN: f64 = 1.0;
    const SPACE: f64 = 0.2;
    const MARK: f64 = 0.0;
    const PUNCTUATION: f64 = 0.5;
    const DIGIT: f64 = 3.5;
    const CJK: f64 = 3.0;
    const DEFAULT: f64 = 1.0;
    let code = c as u32;
    if c.is_ascii_alphabetic() {
        return LATIN;
    }
    if code == 32 {
        return SPACE;
    }
    if code == 0x0640 {
        return MARK;
    }
    match general_category(c) {
        Category::Mark => return MARK,
        Category::PunctuationOrSymbol => return PUNCTUATION,
        Category::Separator => return SPACE,
        Category::Number => return DIGIT,
        Category::Other => {}
    }
    // bisect_left(breakpoints, code): the first range whose upper bound is >= code.
    match SCRIPT_RANGES.iter().find(|(upper, _)| *upper >= code) {
        Some((_, weight)) => *weight,
        None if code > 0x20000 => CJK,
        None => DEFAULT,
    }
}

enum Category {
    Mark,
    PunctuationOrSymbol,
    Separator,
    Number,
    Other,
}

/// Prefixes of Unicode general categories (M / P·S / Z / N), using the same convention as Python `unicodedata.category`.
fn general_category(c: char) -> Category {
    static CLASSES: OnceLock<[Regex; 4]> = OnceLock::new();
    let classes = CLASSES.get_or_init(|| {
        [
            Regex::new(r"^\p{M}$").expect("regex"),
            Regex::new(r"^[\p{P}\p{S}]$").expect("regex"),
            Regex::new(r"^\p{Z}$").expect("regex"),
            Regex::new(r"^\p{N}$").expect("regex"),
        ]
    });
    let mut buf = [0u8; 4];
    let s = c.encode_utf8(&mut buf);
    if classes[0].is_match(s) {
        Category::Mark
    } else if classes[1].is_match(s) {
        Category::PunctuationOrSymbol
    } else if classes[2].is_match(s) {
        Category::Separator
    } else if classes[3].is_match(s) {
        Category::Number
    } else {
        Category::Other
    }
}

/// Upstream `self.ranges`: `(range upper bound, weight)`, with weights already substituted by script type
/// (cjk 3.0 / hangul 2.5 / kana 2.2 / ethiopic 3.0 / yi 3.0 / indic 1.8 / thai_lao 1.5 /
/// khmer_myanmar 1.8 / arabic 1.5 / hebrew 1.5 / latin·cyrillic·greek·armenian·georgian·default 1.0).
const SCRIPT_RANGES: [(u32, f64); 88] = [
    (0x02AF, 1.0), // latin
    (0x03FF, 1.0), // greek
    (0x052F, 1.0), // cyrillic
    (0x058F, 1.0), // armenian
    (0x05FF, 1.5), // hebrew
    (0x077F, 1.5), // arabic
    (0x089F, 1.5), // arabic
    (0x08FF, 1.5), // arabic
    (0x097F, 1.8), // indic
    (0x09FF, 1.8), // indic
    (0x0A7F, 1.8), // indic
    (0x0AFF, 1.8), // indic
    (0x0B7F, 1.8), // indic
    (0x0BFF, 1.8), // indic
    (0x0C7F, 1.8), // indic
    (0x0CFF, 1.8), // indic
    (0x0D7F, 1.8), // indic
    (0x0DFF, 1.8), // indic
    (0x0EFF, 1.5), // thai_lao
    (0x0FFF, 1.8), // indic
    (0x109F, 1.8), // khmer_myanmar
    (0x10FF, 1.0), // georgian
    (0x11FF, 2.5), // hangul
    (0x137F, 3.0), // ethiopic
    (0x139F, 3.0), // ethiopic
    (0x13FF, 1.0), // default
    (0x167F, 1.0), // default
    (0x169F, 1.0), // default
    (0x16FF, 1.0), // default
    (0x171F, 1.0), // default
    (0x173F, 1.0), // default
    (0x175F, 1.0), // default
    (0x177F, 1.0), // default
    (0x17FF, 1.8), // khmer_myanmar
    (0x18AF, 1.0), // default
    (0x18FF, 1.0), // default
    (0x194F, 1.8), // indic
    (0x19DF, 1.8), // indic
    (0x19FF, 1.8), // khmer_myanmar
    (0x1A1F, 1.8), // indic
    (0x1AAF, 1.8), // indic
    (0x1B7F, 1.8), // indic
    (0x1BBF, 1.8), // indic
    (0x1BFF, 1.8), // indic
    (0x1C4F, 1.8), // indic
    (0x1C7F, 1.8), // indic
    (0x1C8F, 1.0), // cyrillic
    (0x1CBF, 1.0), // georgian
    (0x1CCF, 1.8), // indic
    (0x1CFF, 1.8), // indic
    (0x1D7F, 1.0), // latin
    (0x1DBF, 1.0), // latin
    (0x1DFF, 1.0), // default
    (0x1EFF, 1.0), // latin
    (0x309F, 2.2), // kana
    (0x30FF, 2.2), // kana
    (0x312F, 3.0), // cjk
    (0x318F, 2.5), // hangul
    (0x9FFF, 3.0), // cjk
    (0xA4CF, 3.0), // yi
    (0xA4FF, 1.0), // default
    (0xA63F, 1.0), // default
    (0xA69F, 1.0), // cyrillic
    (0xA6FF, 1.0), // default
    (0xA7FF, 1.0), // latin
    (0xA82F, 1.8), // indic
    (0xA87F, 1.0), // default
    (0xA8DF, 1.8), // indic
    (0xA8FF, 1.8), // indic
    (0xA92F, 1.8), // indic
    (0xA95F, 1.8), // indic
    (0xA97F, 2.5), // hangul
    (0xA9DF, 1.8), // indic
    (0xA9FF, 1.8), // khmer_myanmar
    (0xAA5F, 1.8), // indic
    (0xAA7F, 1.8), // khmer_myanmar
    (0xAADF, 1.8), // indic
    (0xAAFF, 1.8), // indic
    (0xAB2F, 3.0), // ethiopic
    (0xAB6F, 1.0), // latin
    (0xABBF, 1.0), // default
    (0xABFF, 1.8), // indic
    (0xD7AF, 2.5), // hangul
    (0xFAFF, 3.0), // cjk
    (0xFDFF, 1.5), // arabic
    (0xFE6F, 1.0), // default
    (0xFEFF, 1.5), // arabic
    (0xFFEF, 1.0), // latin
];

/// Total weight of a piece of text (upstream `calculate_total_weight`).
pub fn total_weight(text: &str) -> f64 {
    text.chars().map(char_weight).sum()
}

/// Upstream `RuleDurationEstimator.estimate_duration` (`low_threshold=50`, `boost_strength=3`).
/// The unit of “duration” here is the same as the reference length (the caller passes the reference audio token count).
pub fn estimate_duration(target_text: &str, ref_text: &str, ref_duration: f64) -> f64 {
    const LOW_THRESHOLD: f64 = 50.0;
    const BOOST_STRENGTH: f64 = 3.0;
    if ref_duration <= 0.0 || ref_text.is_empty() {
        return 0.0;
    }
    let ref_weight = total_weight(ref_text);
    if ref_weight == 0.0 {
        return 0.0;
    }
    let speed_factor = ref_weight / ref_duration;
    let estimated = total_weight(target_text) / speed_factor;
    if estimated < LOW_THRESHOLD {
        LOW_THRESHOLD * (estimated / LOW_THRESHOLD).powf(1.0 / BOOST_STRENGTH)
    } else {
        estimated
    }
}

/// Upstream `_estimate_target_tokens`: when there is no reference audio or the reference text is empty, the baseline is “Nice to meet you.”
/// = 25 tokens; when `speed > 0` and not equal to 1, it is scaled by speed; at least 1.
pub fn estimate_target_tokens(text: &str, ref_text: Option<&str>, num_ref_audio_tokens: Option<usize>, speed: f64) -> usize {
    let (ref_text, ref_tokens) = match (ref_text, num_ref_audio_tokens) {
        (Some(r), Some(n)) if !r.is_empty() => (r, n as f64),
        _ => ("Nice to meet you.", 25.0),
    };
    let mut est = estimate_duration(text, ref_text, ref_tokens);
    if speed > 0.0 && speed != 1.0 {
        est /= speed;
    }
    (est as usize).max(1)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolves_languages_like_the_official_table() {
        assert_eq!(resolve_language(None), None);
        assert_eq!(resolve_language(Some("None")), None);
        assert_eq!(resolve_language(Some("zh")).as_deref(), Some("zh"));
        assert_eq!(resolve_language(Some("English")).as_deref(), Some("en"));
        assert_eq!(resolve_language(Some("cantonese")).as_deref(), Some("yue"));
        assert_eq!(resolve_language(Some("Ömie")).as_deref(), Some("aom"));
        // CucCut's added BCP-47 primary subtag fallback.
        assert_eq!(resolve_language(Some("zh-CN")).as_deref(), Some("zh"));
        assert_eq!(resolve_language(Some("EN")).as_deref(), Some("en"));
        assert_eq!(resolve_language(Some("klingon")), None);
        assert_eq!(LANG_NAME_TO_ID.len(), 646);
        assert!(LANG_NAME_TO_ID.windows(2).all(|w| w[0].0.as_bytes() < w[1].0.as_bytes()));
    }

    // Expected values were produced by upstream `_combine_text`.
    #[test]
    fn combines_text_like_the_official_cleaner() {
        assert_eq!(combine_text("  你好 世界 ", None), "你好世界");
        assert_eq!(
            combine_text("Hello\r\n  world\t\tagain", Some(" Ref text ")),
            "Ref text Hello world again"
        );
        assert_eq!(combine_text("（注）a  b 中 c", None), "(注)a b中c");
        assert_eq!(combine_text("今天 天气 good", Some("大家好。")), "大家好。今天天气good");
        assert_eq!(combine_text("x", Some("")), "x");
    }

    #[test]
    fn adds_terminal_punctuation_to_reference_text() {
        assert_eq!(add_punctuation("大家好，欢迎使用宝典"), "大家好，欢迎使用宝典。");
        assert_eq!(add_punctuation(" hello "), "hello.");
        assert_eq!(add_punctuation("done!"), "done!");
        assert_eq!(add_punctuation("好」"), "好」。");
        assert_eq!(add_punctuation("  "), "");
    }

    #[test]
    fn splits_nonverbal_tags() {
        assert_eq!(
            split_nonverbal("<|text_start|>hi [laughter] there[sigh]<|text_end|>"),
            vec!["<|text_start|>hi ", "[laughter]", " there", "[sigh]", "<|text_end|>"]
        );
        assert_eq!(split_nonverbal("[unknown] x"), vec!["[unknown] x"]);
    }

    // Expected values were produced by upstream `RuleDurationEstimator` / `_estimate_target_tokens`.
    #[test]
    fn duration_estimates_match_the_official_estimator() {
        let cases: [(&str, f64); 7] = [
            ("Hello, world.", 11.2),
            ("你好，世界！", 13.0),
            ("नमस्ते दुनिया", 12.8),
            ("Chào thế giới", 11.4),
            ("Hello 🌍! This is fun 🎉", 16.5),
            ("123 abc", 13.7),
            // Arabic tatweel / combining marks / Extension B Han characters / titlecase letters.
            ("\u{0640}a\u{00e9}\u{0301} \u{20000} \u{01c5}", 4.4),
        ];
        for (text, want) in cases {
            let got = total_weight(text);
            assert!((got - want).abs() < 1e-9, "{text}: {got} != {want}");
        }
        let long_zh = "今天天气真不错，我们一起去公园散步吧。";
        let long_en = "A much longer english sentence that should clearly exceed the low threshold of fifty tokens in total.";
        assert_eq!(estimate_target_tokens("Hello, world.", None, None, 1.0), 36);
        assert_eq!(estimate_target_tokens(long_zh, None, None, 1.0), 92);
        assert_eq!(estimate_target_tokens(long_zh, None, None, 1.5), 61);
        assert_eq!(
            estimate_target_tokens("今天天气真不错。", Some("大家好，欢迎使用宝典。"), Some(60), 1.0),
            48
        );
        assert_eq!(estimate_target_tokens("", None, None, 1.0), 1);
        assert_eq!(estimate_target_tokens(long_en, None, None, 0.8), 194);
    }
}
