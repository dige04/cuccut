//! Automatic typesetting for CJK ⇄ Latin subtitle text.
//!
//! Ported from voice-ink `Pipeline/Text/AutoCorrect`. The rules derive from the plain-text core of `huacnlee/autocorrect` v2.16.3. Markdown, code and LaTeX are not handled here; the input is always ordinary body text from transcripts or translations.
//!
//! The rules that match upstream include CJK/Latin spacing, safe full-width punctuation in a CJ context, full-width letter and digit normalization, and technical-term casing. Full-width letters and digits are normalized before the other rules, so that `format(format(text)) == format(text)`.

use std::collections::{BTreeMap, BTreeSet};
use std::sync::LazyLock;

use regex::{Captures, Regex};

use crate::atomize::is_cjk_text;
use crate::doc::Word;
use crate::split::primary_subtag;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Options {
    pub word_case: bool,
    /// Whether Hangul takes part in the “CJK ⇄ Western text” spacing rules. The default is `true`, which keeps voice-ink's behaviour: Hangul embedded in Chinese or Japanese text stays as it is. Hangul translations turn it off in [`format_translation_with_options`]. The source side uses `false` ([`Options::source`]). Hangul is split on spaces, and a word often contains digits or Latin letters (`2박`, `600원`, `AI가`), and the source word list is the truth. Typesetting must not change whitespace in text containing Hangul: it must neither insert spaces into a word nor merge two words into one. Full-width letter and digit normalization and technical-term casing still apply as usual.
    pub hangul_spacing: bool,
}

impl Default for Options {
    fn default() -> Self {
        Self {
            word_case: true,
            hangul_spacing: true,
        }
    }
}

impl Options {
    /// Typesetting for the source text (transcript word text, polished source sentences): see [`Options::hangul_spacing`].
    pub fn source() -> Self {
        Self {
            word_case: true,
            hangul_spacing: false,
        }
    }
}

/// Formats ordinary subtitle text. The operation is idempotent.
pub fn format(text: &str) -> String {
    format_with_options(text, Options::default())
}

/// Spacing projection for subtitle display. It only adds CJK ⇄ ASCII letter and digit spacing, and does not change case or punctuation. It follows the segment boundaries and the Hangul protection of the source typesetting. Segments containing Hangul, paths and URLs are kept as they are.
pub fn display_spacing(text: &str) -> String {
    let mut output = String::with_capacity(text.len());
    for part in text.split_inclusive([' ', '\n', '\r']) {
        if contains_hangul(part) || path_re().is_match(part) {
            output.push_str(part);
            continue;
        }
        let mut previous = None;
        for ch in part.chars() {
            if needs_pangu_space(previous, Some(ch)) {
                output.push(' ');
            }
            output.push(ch);
            previous = Some(ch);
        }
    }
    output
}

pub fn format_with_options(text: &str, options: Options) -> String {
    if text.is_empty() {
        return String::new();
    }
    // A deliberate deviation from voice-ink: halfwidth-word is a preliminary step, so full-width ASCII gets CJK/Latin spacing in the first pass rather than only in the second.
    let mut output = halfwidth_word(text);
    // Source side: segments containing Hangul (one Hangul word), and whole sentences containing Hangul, do not move any whitespace.
    let frozen = |text: &str| !options.hangul_spacing && contains_hangul(text);
    if contains_cjk_script(&output) {
        // Split by space or newline, keeping trailing separators. The full-width punctuation rule absorbs the space that follows it.
        let mut result = String::with_capacity(output.len() + 8);
        let mut part = String::new();
        let mut flush = |part: &mut String, result: &mut String| {
            if frozen(part) {
                result.push_str(part);
            } else {
                result.push_str(&format_part(part));
            }
            part.clear();
        };
        for ch in output.chars() {
            part.push(ch);
            if matches!(ch, ' ' | '\n' | '\r') {
                flush(&mut part, &mut result);
            }
        }
        if !part.is_empty() {
            flush(&mut part, &mut result);
        }
        output = result;
        if !frozen(&output) {
            for strategy in no_space_fullwidth_strategies().iter() {
                output = strategy.format(&output);
            }
        }
    }
    if options.word_case {
        output = apply_word_case(&output);
    }
    output
}

/// VoiceInk formats translations only in the automatic pipeline for CJK target languages.
pub fn is_cjk_language(lang: &str) -> bool {
    matches!(primary_subtag(lang).as_str(), "zh" | "yue" | "ja" | "ko")
}

/// CJK languages that leave no space between words: Chinese (including Cantonese) and Japanese. Hangul is not among them. It counts as CJK typesetting ([`is_cjk_language`]) but is split on spaces.
pub fn is_unspaced_cjk_language(lang: &str) -> bool {
    matches!(primary_subtag(lang).as_str(), "zh" | "yue" | "ja")
}

/// Non-CJK scripts that also write without spaces between words: Thai, Lao, Burmese, Khmer, and Tibetan (including Zongkha), which are the scripts excluded by [`crate::atomize::spaced_script_letter`]. In these languages a space is a pause in a phrase or clause, not a word boundary, so the code must not add spaces in its place. Languages not listed here are treated as having spaces between words.
pub fn is_unspaced_script_language(lang: &str) -> bool {
    matches!(
        primary_subtag(lang).as_str(),
        "th" | "lo" | "my" | "km" | "bo" | "dz"
    )
}

/// Source gate: at least half of the word atoms must contain CJK. This keeps a stray Han character from switching an English document onto the CJK path.
pub fn source_is_cjk(words: &[Word]) -> bool {
    !words.is_empty()
        && words.iter().filter(|word| is_cjk_text(&word.text)).count() * 2 >= words.len()
}

/// Typesets source word atoms word by word, and returns the number of words changed. The caller passes the [`source_is_cjk`] gate first. No whitespace is allowed within a word: a word whose typeset result would contain whitespace is kept as it is.
pub fn format_words(words: &mut [Word]) -> usize {
    let mut changed = 0;
    for word in words {
        let formatted = format_with_options(&word.text, Options::source());
        let trimmed = formatted.trim();
        if trimmed.is_empty() || trimmed == word.text || trimmed.chars().any(char::is_whitespace) {
            continue;
        }
        word.text = trimmed.to_owned();
        changed += 1;
    }
    changed
}

/// Formats the target-language translation. Non-CJK targets are kept character for character unchanged. Hangul targets do not change whitespace ([`Options::hangul_spacing`]).
pub fn format_translation(text: &str, lang: &str) -> String {
    format_translation_with_options(text, lang, &[], Options::default())
}

/// Protected terms are kept character for character. Only the text between terms is formatted, and CJK ⇄ ASCII letter and digit spacing is added at the edges of terms.
pub fn format_translation_with_options(
    text: &str,
    lang: &str,
    protected_terms: &[String],
    options: Options,
) -> String {
    if !is_cjk_language(lang) {
        return text.to_owned();
    }
    // Hangul translations: particles and classifiers attached directly to a Latin word or a digit (`AI가`, `2박 3일`). Whitespace is the word boundary here, so the spacing rules do not apply. Other normalization proceeds as usual.
    let korean = primary_subtag(lang) == "ko";
    let options = Options {
        hangul_spacing: options.hangul_spacing && !korean,
        ..options
    };
    let terms: Vec<&str> = protected_terms
        .iter()
        .map(String::as_str)
        .filter(|term| !term.is_empty() && text.contains(term))
        .collect();
    if terms.is_empty() {
        let formatted = format_with_options(text, options);
        return target_policy_format(&formatted, lang);
    }

    let mut output = String::with_capacity(text.len() + 8);
    let mut cursor = 0;
    while cursor < text.len() {
        let next = terms
            .iter()
            .filter_map(|term| {
                text[cursor..]
                    .find(term)
                    .map(|offset| (cursor + offset, *term))
            })
            .min_by(|(left_start, left_term), (right_start, right_term)| {
                left_start
                    .cmp(right_start)
                    .then_with(|| right_term.chars().count().cmp(&left_term.chars().count()))
            });
        let Some((start, term)) = next else {
            let formatted = format_with_options(&text[cursor..], options);
            output.push_str(&target_policy_format(&formatted, lang));
            break;
        };
        let formatted = format_with_options(&text[cursor..start], options);
        output.push_str(&target_policy_format(&formatted, lang));
        if !korean && needs_pangu_space(output.chars().last(), term.chars().next()) {
            output.push(' ');
        }
        output.push_str(term);
        cursor = start + term.len();
        if !korean && needs_pangu_space(term.chars().last(), text[cursor..].chars().next()) {
            output.push(' ');
        }
    }
    output
}

fn simplified_chinese(lang: &str) -> bool {
    let subtags = lang
        .split(['-', '_'])
        .map(|part| part.to_ascii_lowercase())
        .collect::<Vec<_>>();
    subtags.first().is_some_and(|primary| primary == "zh")
        && !subtags.iter().any(|subtag| subtag == "hant")
}

/// Simplified Chinese target typesetting that can be decided deterministically converges before it is written to `trans`. Code and URL samples are protected by the existing `path_re`. Characters that may be data, such as straight quotes, are not rewritten here and are left to the check advisory.
fn target_policy_format(text: &str, lang: &str) -> String {
    if !simplified_chinese(lang) || text.is_empty() {
        return text.to_owned();
    }
    let ellipsis = rx(r"(?:⋯|\.{3,})+");
    let noisy_marks = rx(r"[!?！？]{2,}");
    let four_digit_group =
        rx(r"(?P<prefix>(?:^|[^0-9]))(?P<lead>[0-9]),(?P<tail>[0-9]{3})(?P<suffix>(?:[^0-9]|$))");
    let mut output = String::with_capacity(text.len());
    let mut part = String::new();
    let flush = |part: &mut String, output: &mut String| {
        if part.is_empty() {
            return;
        }
        if path_re().is_match(part) {
            output.push_str(part);
        } else {
            let normalized = ellipsis.replace_all(part, "…");
            let normalized = noisy_marks.replace_all(&normalized, |caps: &Captures<'_>| {
                let raw = caps.get(0).map(|value| value.as_str()).unwrap_or_default();
                match raw.chars().last() {
                    Some('?' | '？') => "？",
                    _ => "！",
                }
            });
            let normalized = four_digit_group.replace_all(&normalized, "$prefix$lead$tail$suffix");
            output.push_str(&normalized);
        }
        part.clear();
    };
    for ch in text.chars() {
        part.push(ch);
        if ch.is_whitespace() {
            flush(&mut part, &mut output);
        }
    }
    flush(&mut part, &mut output);
    output
}

/// Formats a target-language translation table in place, and returns the number of entries actually changed.
pub fn format_translation_map(
    map: &mut BTreeMap<String, String>,
    lang: &str,
    keys: Option<&BTreeSet<String>>,
    protected_terms: &[String],
) -> usize {
    if !is_cjk_language(lang) {
        return 0;
    }
    let mut changed = 0;
    for (key, text) in map.iter_mut() {
        if keys.is_some_and(|keys| !keys.contains(key)) {
            continue;
        }
        let formatted =
            format_translation_with_options(text, lang, protected_terms, Options::default());
        if formatted != *text {
            *text = formatted;
            changed += 1;
        }
    }
    changed
}

fn needs_pangu_space(left: Option<char>, right: Option<char>) -> bool {
    fn ascii_alnum(ch: char) -> bool {
        ch.is_ascii_alphanumeric()
    }
    matches!((left, right),
        (Some(left), Some(right))
            if (crate::atomize::is_cjk_char(left) && ascii_alnum(right))
                || (ascii_alnum(left) && crate::atomize::is_cjk_char(right)))
}

fn format_part(part: &str) -> String {
    if path_re().is_match(part) || !contains_cjk_script(part) {
        return part.to_owned();
    }
    let mut output = part.to_owned();
    for strategy in word_strategies().iter() {
        output = strategy.format(&output);
    }
    for strategy in bracket_strategies().iter() {
        output = strategy.format(&output);
    }
    for strategy in dash_strategies().iter() {
        output = strategy.format(&output);
    }
    fullwidth_punctuation(&output)
}

/// voice-ink preserves the regexp! text-replacement behaviour of huacnlee/autocorrect. In particular, `CJK` expands into an ungrouped alternation, and when `CJ` appears inside `[]` it leaves a literal `|`. These seemingly odd priorities affect existing output, and must not be “corrected” during porting.
fn rx(pattern: &str) -> Regex {
    let pattern = pattern
        .replace(
            r"\p{CJK_N}",
            r"\p{Han}\p{Hangul}\p{Katakana}\p{Hiragana}\p{Bopomofo}",
        )
        .replace(
            r"\p{CJK}",
            r"\p{Han}|\p{Hangul}|\p{Katakana}|\p{Hiragana}|\p{Bopomofo}",
        )
        .replace(r"\p{CJ}", r"\p{Han}|\p{Katakana}|\p{Hiragana}|\p{Bopomofo}");
    Regex::new(&pattern)
        .unwrap_or_else(|error| panic!("invalid autocorrect regex {pattern:?}: {error}"))
}

struct Strategy {
    regex: Regex,
    reverse_regex: Option<Regex>,
    replacement: &'static str,
}

impl Strategy {
    fn new(one: &str, other: &str, reverse: bool, remove_space: bool) -> Self {
        let middle = if remove_space { "[ ]+" } else { "" };
        Self {
            regex: rx(&format!("({one}){middle}({other})")),
            reverse_regex: reverse.then(|| rx(&format!("({other}){middle}({one})"))),
            replacement: if remove_space { "$1$2" } else { "$1 $2" },
        }
    }

    fn format(&self, text: &str) -> String {
        let output = self.regex.replace_all(text, self.replacement).into_owned();
        self.reverse_regex.as_ref().map_or(output.clone(), |regex| {
            regex.replace_all(&output, self.replacement).into_owned()
        })
    }
}

fn path_re() -> &'static Regex {
    static VALUE: LazyLock<Regex> =
        LazyLock::new(|| rx(r"(^[a-zA-Z\d]+://)|(^/?[a-zA-Z\d\-_\.]{2,}/)"));
    &VALUE
}

fn word_strategies() -> &'static [Strategy] {
    static VALUE: LazyLock<Vec<Strategy>> = LazyLock::new(|| {
        vec![
            Strategy::new(r"\p{CJK}[^%\$\\]", r"[a-zA-Z0-9]", false, false),
            Strategy::new(r"[^%\$\\][a-zA-Z0-9]", r"\p{CJK}", false, false),
            Strategy::new(r"\p{CJK}", r"[\-+][\d]+", true, false),
            Strategy::new(r"^[a-zA-Z0-9]", r"\p{CJK}", false, false),
            Strategy::new(r"[0-9][%]", r"\p{CJK}", false, false),
            Strategy::new(r"[a-zA-Z0-9][+#]+", r"\p{CJK}", false, false),
        ]
    });
    &VALUE
}

fn bracket_strategies() -> &'static [Strategy] {
    static VALUE: LazyLock<Vec<Strategy>> = LazyLock::new(|| {
        vec![
            Strategy::new(r"\p{CJK}", r"[\[\(]", false, false),
            Strategy::new(r"[\]\)]", r"\p{CJK}", false, false),
        ]
    });
    &VALUE
}

fn dash_strategies() -> &'static [Strategy] {
    static VALUE: LazyLock<Vec<Strategy>> = LazyLock::new(|| {
        vec![
            Strategy::new(
                r"[\p{CJK_N}”’]",
                r"[\-][\p{CJK_N}\s（【「《“‘]",
                false,
                false,
            ),
            Strategy::new(
                r"[\p{CJK_N}\s）】」”’》][\-]",
                r"[\p{CJK_N}“‘]",
                false,
                false,
            ),
        ]
    });
    &VALUE
}

fn no_space_fullwidth_strategies() -> &'static [Strategy] {
    static VALUE: LazyLock<Vec<Strategy>> = LazyLock::new(|| {
        vec![
            Strategy::new(
                r"\w|\p{CJK}|`",
                r"[，。、！？：；（）「」《》【】]",
                true,
                true,
            ),
            Strategy::new(r"\w|\p{CJK}", r"[“”‘’]", true, true),
        ]
    });
    &VALUE
}

fn fullwidth_patterns() -> &'static [Regex] {
    static VALUE: LazyLock<Vec<Regex>> = LazyLock::new(|| {
        vec![
            rx(r"[\p{CJ}\w\d]+[,?]([ ]*)[\p{CJ}]+"),
            rx(r"[\p{CJ}]+[,?]([ ]*)"),
            rx(r"[\p{CJ}]+[.:!]([ ]*)[\p{CJ}]+"),
            rx(r#"[\p{CJ}]+[.:!]([ ]*)["']?$"#),
        ]
    });
    &VALUE
}

fn fullwidth_punct_re() -> &'static Regex {
    static VALUE: LazyLock<Regex> = LazyLock::new(|| rx(r"([.:!]([ ]*)|[,?]([ ]*))"));
    &VALUE
}

fn fullwidth_punctuation(part: &str) -> String {
    let mut output = part.to_owned();
    for pattern in fullwidth_patterns() {
        output = pattern
            .replace_all(&output, |captures: &Captures<'_>| {
                fullwidth_punct_re()
                    .replace_all(&captures[0], |punct: &Captures<'_>| {
                        match punct[0].trim_matches(' ') {
                            "," => "，".to_owned(),
                            "." => "。".to_owned(),
                            ":" => "：".to_owned(),
                            "!" => "！".to_owned(),
                            "?" => "？".to_owned(),
                            _ => punct[0].to_owned(),
                        }
                    })
                    .into_owned()
            })
            .into_owned();
    }
    output
}

fn half_time_re() -> &'static Regex {
    static VALUE: LazyLock<Regex> = LazyLock::new(|| rx(r"(\d)(：)(\d)"));
    &VALUE
}

fn halfwidth_word(text: &str) -> String {
    let mut changed = false;
    let mut output = String::with_capacity(text.len());
    for ch in text.chars() {
        match ch as u32 {
            value @ (0xFF10..=0xFF19 | 0xFF21..=0xFF3A | 0xFF41..=0xFF5A) => {
                changed = true;
                output.push(char::from_u32(value - 0xFEE0).expect("fullwidth ASCII maps"));
            }
            0x3000 => {
                changed = true;
                output.push(' ');
            }
            _ => output.push(ch),
        }
    }
    if !changed {
        return text.to_owned();
    }
    half_time_re().replace_all(&output, "$1:$3").into_owned()
}

const WORD_CASE_DICT: &[&str] = &[
    "iOS",
    "iPadOS",
    "macOS",
    "watchOS",
    "tvOS",
    "visionOS",
    "iPhone",
    "iPad",
    "iMac",
    "MacBook",
    "AirPods",
    "AirDrop",
    "iCloud",
    "Xcode",
    "TestFlight",
    "App Store",
    "GitHub",
    "GitLab",
    "VS Code",
    "vscode = VS Code",
    "Wi-Fi",
    "wifi = Wi-Fi",
    "YouTube",
    "TikTok",
    "Instagram",
    "WhatsApp",
    "WeChat",
    "Telegram",
    "Netflix",
    "Spotify",
    "Reddit",
    "Wikipedia",
    "Bilibili",
    "JavaScript",
    "TypeScript",
    "Python",
    "Node.js",
    "nodejs = Node.js",
    "HTML",
    "CSS",
    "JSON",
    "YAML",
    "SQL",
    "API",
    "URL",
    "HTTP",
    "HTTPS",
    "AI",
    "AGI",
    "GPU",
    "CPU",
    "ChatGPT",
    "chatgpt = ChatGPT",
    "OpenAI",
    "DeepSeek",
    "Claude",
    "Gemini",
    "Anthropic",
    "Google",
    "Microsoft",
    "NVIDIA",
    "nvidia = NVIDIA",
    "Docker",
    "Kubernetes",
    "Linux",
    "Ubuntu",
    "Android",
    "Photoshop",
    "PowerPoint",
    "Figma",
];

struct WordCaseEntry {
    key: Vec<String>,
    replacement: Vec<char>,
}

fn word_case_entries() -> &'static [WordCaseEntry] {
    static VALUE: LazyLock<Vec<WordCaseEntry>> = LazyLock::new(|| {
        let mut entries: Vec<WordCaseEntry> = WORD_CASE_DICT
            .iter()
            .map(|raw| {
                let mut sides = raw.splitn(2, '=').map(str::trim);
                let from = sides.next().expect("word case source");
                let to = sides.next().unwrap_or(from);
                WordCaseEntry {
                    key: from
                        .chars()
                        .map(|ch| ch.to_lowercase().collect::<String>())
                        .collect(),
                    replacement: to.chars().collect(),
                }
            })
            .collect();
        entries.sort_by_key(|entry| std::cmp::Reverse(entry.key.len()));
        entries
    });
    &VALUE
}

fn is_disallowed_neighbor(ch: Option<char>) -> bool {
    let Some(ch) = ch else {
        return false;
    };
    if ch.is_whitespace() || matches!(ch as u32, 0x4E00..=0x9FFF) {
        return false;
    }
    !"？！：，。；、「」“”‘’【】《》".contains(ch)
}

fn apply_word_case(text: &str) -> String {
    let chars: Vec<char> = text.chars().collect();
    let folded: Vec<String> = chars
        .iter()
        .map(|ch| ch.to_lowercase().collect::<String>())
        .collect();
    let mut output = String::with_capacity(text.len());
    let mut index = 0;
    while index < chars.len() {
        let accepted = word_case_entries().iter().find(|entry| {
            index + entry.key.len() <= chars.len()
                && folded[index..index + entry.key.len()] == entry.key
                && !is_disallowed_neighbor(index.checked_sub(1).map(|i| chars[i]))
                && !is_disallowed_neighbor(chars.get(index + entry.key.len()).copied())
        });
        let Some(entry) = accepted else {
            output.push(chars[index]);
            index += 1;
            continue;
        };
        output.extend(entry.replacement.iter());
        index += entry.key.len();
    }
    output
}

fn contains_hangul(text: &str) -> bool {
    text.chars().any(|ch| {
        matches!(
            ch as u32,
            0x1100..=0x11FF | 0x3130..=0x318F | 0xA960..=0xA97F | 0xAC00..=0xD7FF
        )
    })
}

fn contains_cjk_script(text: &str) -> bool {
    text.chars().any(|ch| {
        matches!(
            ch as u32,
            0x3005..=0x3007
                | 0x3040..=0x30FF
                | 0x3100..=0x312F
                | 0x31A0..=0x31BF
                | 0x31F0..=0x31FF
                | 0x3400..=0x4DBF
                | 0x4E00..=0x9FFF
                | 0xF900..=0xFAFF
                | 0x1100..=0x11FF
                | 0x3130..=0x318F
                | 0xA960..=0xA97F
                | 0xAC00..=0xD7FF
                | 0x20000..=0x3134F
        )
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn voice_ink_format_vectors_are_idempotent() {
        let cases = [
            ("hello你好", "hello 你好"),
            ("测试ios应用", "测试 iOS 应用"),
            ("于3月10日开始", "于 3 月 10 日开始"),
            ("10%中文", "10% 中文"),
            ("C++中文", "C++ 中文"),
            ("你好[世界]", "你好 [世界]"),
            ("你好-世界", "你好 - 世界"),
            ("foo-世界", "foo-世界"),
            ("内容带有%s的内容", "内容带有%s的内容"),
            ("你好,这是一个句子.", "你好，这是一个句子。"),
            (
                "刚刚买了一部 iPhone,好开心!",
                "刚刚买了一部 iPhone，好开心！",
            ),
            ("\"请求参数错误.\"", "\"请求参数错误。\""),
            ("你好, 世界", "你好，世界"),
            (
                "蚂蚁集团上市后有多大的上涨空间?",
                "蚂蚁集团上市后有多大的上涨空间？",
            ),
            ("Hello世界.", "Hello 世界。"),
            ("中文;中文", "中文;中文"),
            (
                "蚂蚁集团是阿里巴巴 (BABA.N) 旗下金融科技子公司",
                "蚂蚁集团是阿里巴巴 (BABA.N) 旗下金融科技子公司",
            ),
            ("!开头不处理.", "!开头不处理。"),
            (
                "근면, 검소, 협동은 우리 겨레의 미덕이다.",
                "근면, 검소, 협동은 우리 겨레의 미덕이다.",
            ),
            ("한국어hello", "한국어 hello"),
            (
                "そんな新機能を体験してみましょう.",
                "そんな新機能を体験してみましょう。",
            ),
            ("１６：３２", "16:32"),
            ("去ＣＢＤ中心。", "去 CBD 中心。"),
            ("你好\u{3000}世界", "你好 世界"),
            ("测试 ，", "测试，"),
            (
                "详见 https://example.com/页面.html 哦",
                "详见 https://example.com/页面.html 哦",
            ),
            ("我用ios和github开发", "我用 iOS 和 GitHub 开发"),
            ("变量hello_ios不动", "变量 hello_ios 不动"),
            ("看这个https://ios.com链接", "看这个 https://ios.com 链接"),
            (
                "This is a plain English sentence.",
                "This is a plain English sentence.",
            ),
        ];

        for (input, expected) in cases {
            let actual = format(input);
            assert_eq!(actual, expected, "{input}");
            assert_eq!(format(&actual), actual, "not idempotent: {input}");
        }
    }

    #[test]
    fn options_can_disable_word_case() {
        assert_eq!(
            format_with_options(
                "测试ios应用",
                Options {
                    word_case: false,
                    ..Options::default()
                }
            ),
            "测试 ios 应用"
        );
    }

    /// Source-side typesetting does not move whitespace in text containing Hangul. It neither inserts spaces into Hangul words nor merges words on either side of a quote. Han and kana text is character-for-character identical to the default typesetting.
    #[test]
    fn source_format_leaves_hangul_whitespace_alone() {
        let source = Options::source();
        for text in [
            "2박 3일 일정에 600원이라는",
            "AI가 발전하면서 iPhone을 샀어요.",
            "그가 “좋아” 하고 말했어요.",
            "서울(Seoul)에서 10%만",
            "한국어hello",
        ] {
            assert_eq!(format_with_options(text, source), text, "{text}");
        }
        // Technical-term casing for standalone words, and full-width letter and digit normalization, still apply as usual.
        assert_eq!(
            format_with_options("ios 앱을 ＡＩ가 씁니다", source),
            "iOS 앱을 AI가 씁니다"
        );
        for text in [
            "测试ios应用",
            "于3月10日开始",
            "你好,这是一个句子.",
            "Hello世界.",
        ] {
            assert_eq!(format_with_options(text, source), format(text), "{text}");
        }
        // Translation typesetting is unchanged (voice-ink's existing vectors).
        assert_eq!(format("한국어hello"), "한국어 hello");
    }

    #[test]
    fn display_spacing_reuses_source_hangul_and_path_guards() {
        for text in [
            "AI가 2박 3일 600원",
            "중국어中文AI가",
            "ᄀAI ᄂ2",
            "https://example.com/中文AI",
            "path/中文AI",
        ] {
            assert_eq!(display_spacing(text), text);
        }
        for (text, expected) in [
            ("让Claude创建Artifact", "让 Claude 创建 Artifact"),
            ("中文AI AI가", "中文 AI AI가"),
            ("AIを使う", "AI を使う"),
            ("v3版本\n用AI", "v3 版本\n用 AI"),
        ] {
            assert_eq!(display_spacing(text), expected);
            assert_eq!(display_spacing(expected), expected);
        }
        assert_eq!(display_spacing("中文ios，ＡＩ！"), "中文 ios，ＡＩ！");
    }

    /// Hangul translations: particles and classifiers are written attached to a Latin word or a digit. Typesetting does not split them, and does not change spaces the model wrote. Protected terms on either side are not padded either. Chinese and Japanese targets are unchanged.
    #[test]
    fn korean_translation_keeps_its_own_word_spacing() {
        for text in [
            "하지만 AI가 출시를 쉽게 만듭니다.",
            "아이디어 10개를 PM이라는 직함으로",
            "2박 3일 일정에 35%만 씁니다.",
            "서울(Seoul)에서 “좋아” 하고 말했어요.",
        ] {
            assert_eq!(format_translation(text, "ko"), text, "{text}");
            assert_eq!(format_translation(text, "ko-KR"), text, "{text}");
        }
        assert_eq!(format_translation("ＡＩ가 ios 앱을", "ko"), "AI가 iOS 앱을");
        let terms = vec!["GitHub".to_owned()];
        assert_eq!(
            format_translation_with_options("GitHub에서 코드를", "ko", &terms, Options::default()),
            "GitHub에서 코드를"
        );
        assert_eq!(
            format_translation("使用AI管理代码", "zh"),
            "使用 AI 管理代码"
        );
        assert_eq!(format_translation("AIを使う", "ja"), "AI を使う");
    }

    #[test]
    fn format_words_never_puts_whitespace_inside_a_word() {
        let word = |text: &str| Word {
            id: String::new(),
            t0: 0.0,
            t1: 0.0,
            text: text.to_owned(),
            sp: String::new(),
            glue: false,
        };
        let mut korean: Vec<Word> = ["2박", "3일", "600원이라는", "6시쯤", "ｉｏｓ"]
            .into_iter()
            .map(word)
            .collect();
        assert_eq!(format_words(&mut korean), 1);
        let texts: Vec<&str> = korean.iter().map(|word| word.text.as_str()).collect();
        assert_eq!(texts, ["2박", "3일", "600원이라는", "6시쯤", "iOS"]);

        // Even when a word atom mixes Han characters and Western text (the case where tokenization did not split it), no space is inserted.
        let mut mixed: Vec<Word> = ["3月", "ｉｏｓ", "你", "好,"]
            .into_iter()
            .map(word)
            .collect();
        format_words(&mut mixed);
        let texts: Vec<&str> = mixed.iter().map(|word| word.text.as_str()).collect();
        assert_eq!(texts, ["3月", "iOS", "你", "好，"]);
    }

    #[test]
    fn protected_terms_remain_verbatim_and_receive_edge_spacing() {
        let terms = vec!["GitHub".to_owned()];
        let once =
            format_translation_with_options("使用GitHub管理代码", "zh", &terms, Options::default());
        assert_eq!(once, "使用 GitHub 管理代码");
        assert_eq!(
            format_translation_with_options(&once, "zh", &terms, Options::default()),
            once
        );

        let locked = vec!["版本...？！1,234".to_owned()];
        assert_eq!(
            format_translation_with_options(
                "使用版本...？！1,234发布...？！共1,234次",
                "zh-Hans",
                &locked,
                Options::default()
            ),
            "使用版本...？！1,234 发布…！共 1234 次"
        );
    }

    #[test]
    fn simplified_chinese_target_policy_is_deterministic_and_script_aware() {
        let input = "等等⋯...？！共1,234次，另有12,345次";
        assert_eq!(
            format_translation(input, "zh-Hans"),
            "等等…！共 1234 次，另有 12,345 次"
        );
        assert_eq!(
            format_translation(&format_translation(input, "zh"), "zh"),
            format_translation(input, "zh")
        );
        assert_eq!(format_translation(input, "zh-Hant"), format(input));
    }

    #[test]
    fn translation_map_respects_language_and_key_filter() {
        let mut map = BTreeMap::from([
            ("s-1".to_owned(), "在Claude里".to_owned()),
            ("s-2".to_owned(), "用AI写作".to_owned()),
        ]);
        let keys = BTreeSet::from(["s-2".to_owned()]);
        assert_eq!(format_translation_map(&mut map, "zh", Some(&keys), &[]), 1);
        assert_eq!(map["s-1"], "在Claude里");
        assert_eq!(map["s-2"], "用 AI 写作");
        assert_eq!(format_translation_map(&mut map, "en", None, &[]), 0);
    }
}
