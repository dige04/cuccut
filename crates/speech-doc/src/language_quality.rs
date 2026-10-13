//! Deterministic quality gates for source-language and translation content.
//!
//! This only does high-precision, explainable script and degeneration detection; it does not pose as a full statistical language identifier.
//! The rules prefer letting short sentences, proper nouns and normal code-switching through over falsely rejecting them; the whole-page audit then aggregates
//! the per-sentence signals to catch catastrophic output such as “whole page copied from the source / placeholder / wrong script”.

use crate::atomize::{normalize_chars, spaced_script_letter};
use std::collections::BTreeMap;

/// Changing this constant changes the bytes of the translation carrier, which automatically invalidates the provider/agent historical response cache.
pub const TRANSLATION_VALIDATOR_VERSION: u32 = 4;

/// The number of consecutive source-text ideographic characters appearing verbatim in the translation that counts as an “untranslated run”: anything shorter is a proper noun,
/// a term, or normal code-switching (`KV cache 缓存`).
const UNTRANSLATED_RUN_CHARS: usize = 6;

/// When a stretch of the translation copies a segment of the source sentence verbatim, that stretch must have at least this many whitespace-separated words to count as a “copied fragment”: shorter ones are proper names, titles and terms (`University of Toronto`).
const COPIED_FRAGMENT_WORDS: usize = 4;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TranslationQualityCode {
    TargetLanguageMismatch,
    Placeholder,
    SourceCopy,
    TooShort,
}

impl TranslationQualityCode {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::TargetLanguageMismatch => "target-language-mismatch",
            Self::Placeholder => "translation-placeholder",
            Self::SourceCopy => "translation-source-copy",
            Self::TooShort => "translation-too-short",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TranslationQualityIssue {
    pub code: TranslationQualityCode,
    pub detail: String,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
struct Scripts {
    han: usize,
    kana: usize,
    hangul: usize,
    latin: usize,
    cyrillic: usize,
    arabic: usize,
    devanagari: usize,
    thai: usize,
    hebrew: usize,
}

impl Scripts {
    fn total(self) -> usize {
        self.han
            + self.kana
            + self.hangul
            + self.latin
            + self.cyrillic
            + self.arabic
            + self.devanagari
            + self.thai
            + self.hebrew
    }
}

fn scripts(text: &str) -> Scripts {
    let mut out = Scripts::default();
    for ch in text.chars() {
        let code = ch as u32;
        if matches!(code, 0x3400..=0x4dbf | 0x4e00..=0x9fff | 0xf900..=0xfaff) {
            out.han += 1;
        } else if matches!(code, 0x3040..=0x30ff | 0x31f0..=0x31ff) {
            out.kana += 1;
        } else if matches!(code, 0xac00..=0xd7af | 0x1100..=0x11ff | 0x3130..=0x318f) {
            out.hangul += 1;
        } else if ch.is_ascii_alphabetic() || matches!(code, 0x00c0..=0x024f) {
            out.latin += 1;
        } else if matches!(code, 0x0400..=0x052f) {
            out.cyrillic += 1;
        } else if matches!(code, 0x0600..=0x06ff | 0x0750..=0x077f | 0x08a0..=0x08ff) {
            out.arabic += 1;
        } else if matches!(code, 0x0900..=0x097f) {
            out.devanagari += 1;
        } else if matches!(code, 0x0e00..=0x0e7f) {
            out.thai += 1;
        } else if matches!(code, 0x0590..=0x05ff) {
            out.hebrew += 1;
        }
    }
    out
}

fn primary(lang: &str) -> String {
    lang.split(['-', '_'])
        .next()
        .unwrap_or(lang)
        .to_ascii_lowercase()
}

fn compact_word(text: &str) -> String {
    text.chars()
        .filter(|ch| ch.is_alphanumeric())
        .flat_map(char::to_lowercase)
        .collect()
}

fn placeholder(text: &str) -> bool {
    matches!(
        compact_word(text).as_str(),
        "translation"
            | "translate"
            | "todo"
            | "tbd"
            | "na"
            | "none"
            | "null"
            | "placeholder"
            | "untranslated"
            | "待翻译"
            | "翻译"
    )
}

fn target_script_mismatch(target_lang: &str, text: &str) -> bool {
    let counts = scripts(text);
    let total = counts.total();
    if total < 4 {
        return false;
    }
    match primary(target_lang).as_str() {
        "zh" => counts.han == 0 && total >= 8,
        "ja" => counts.han + counts.kana == 0 && total >= 8,
        "ko" => counts.hangul == 0 && total >= 8,
        "ru" | "uk" | "bg" | "sr" | "mk" => counts.cyrillic == 0 && total >= 8,
        "ar" | "fa" | "ur" => counts.arabic == 0 && total >= 8,
        "hi" | "mr" | "ne" => counts.devanagari == 0 && total >= 8,
        "th" => counts.thai == 0 && total >= 8,
        "he" | "yi" => counts.hebrew == 0 && total >= 8,
        // English and most Latin-script languages: numbers, short proper nouns and a small amount of code-switching are allowed;
        // reject only when another writing system clearly dominates.
        _ => {
            let foreign = total.saturating_sub(counts.latin);
            foreign >= 4 && foreign * 100 >= total * 45
        }
    }
}

/// Partial copying: the target language does not use ideographs, yet the translation carries a run of consecutive text that appears verbatim in the source and is at least
/// [`UNTRANSLATED_RUN_CHARS`] ideographic characters long (`毕业 5 年升职升不上去，
/// internal role transfer 没机会`). The script-ratio gate cannot catch this kind of half-untranslated output:
/// when there are enough Latin letters, it looks as if it is “mainly in the target script”. Only the ideographic-source → non-ideographic-target script pair has this gate; other script pairs (including Latin words copied into an ideographic target, which are often proper nouns and terms)
/// are not checked. Returns the copied text.
fn untranslated_run(
    normalized_source: &str,
    target_lang: &str,
    normalized_target: &str,
) -> Option<String> {
    if matches!(
        primary(target_lang).as_str(),
        "zh" | "ja" | "ko" | "yue" | "cmn" | "wuu"
    ) {
        return None;
    }
    let ideograph = |ch: char| {
        let code = ch as u32;
        matches!(
            code,
            0x3400..=0x4dbf | 0x4e00..=0x9fff | 0xf900..=0xfaff | 0x3040..=0x30ff | 0xac00..=0xd7af
        )
    };
    let mut run = String::new();
    let mut runs = Vec::new();
    for ch in normalized_target.chars().chain(std::iter::once(' ')) {
        if ideograph(ch) {
            run.push(ch);
        } else if !run.is_empty() {
            runs.push(std::mem::take(&mut run));
        }
    }
    runs.into_iter().find(|run| {
        run.chars().count() >= UNTRANSLATED_RUN_CHARS && normalized_source.contains(run.as_str())
    })
}

/// Copied fragment: the whole translation is one consecutive run of words from the source (punctuation and case ignored), at least
/// [`COPIED_FRAGMENT_WORDS`] whitespace-separated words, and the rest of the source does not appear — the model copied a slice of the source verbatim into the translation column. This is independent of the target language. Scripts whose words are written without spaces (CJK, Thai, etc.) have a whole sentence as one “word”, which does not reach the threshold; ideographic sources are handled by [`untranslated_run`].
/// Output that is half translated and half copied is not covered: when the two scripts are the same, there is no deterministic boundary between copied words and proper nouns or homographs that should be kept.
fn copied_fragment(source: &str, translation: &str) -> bool {
    let words = |text: &str| -> Vec<String> {
        text.split_whitespace()
            .map(normalize_chars)
            .filter(|word| !word.is_empty())
            .collect()
    };
    let source = words(source);
    let translation = words(translation);
    translation.len() >= COPIED_FRAGMENT_WORDS
        && translation.len() < source.len()
        && source
            .windows(translation.len())
            .any(|window| window == translation.as_slice())
}

/// Hard gate for single-sentence translation. All problems must be handled before the cache write and the transcript commit.
pub fn translation_quality_issues(
    source: &str,
    target_lang: &str,
    translation: &str,
) -> Vec<TranslationQualityIssue> {
    let mut issues = Vec::new();
    let trimmed = translation.trim();
    if placeholder(trimmed) {
        issues.push(TranslationQualityIssue {
            code: TranslationQualityCode::Placeholder,
            detail: "译文是占位文本".to_owned(),
        });
    }
    let normalized_source = normalize_chars(source);
    let normalized_target = normalize_chars(trimmed);
    // Copying a single whitespace-separated word (a person's name, a brand, a catchphrase) is not untranslated; in scripts written without spaces
    // (CJK, Thai, etc.) a single “word” may be a whole sentence, so this exception does not apply.
    let single_spaced_word = source.split_whitespace().count() == 1
        && normalized_source.chars().any(char::is_alphanumeric)
        && normalized_source
            .chars()
            .filter(|ch| ch.is_alphanumeric())
            .all(spaced_script_letter);
    if normalized_source.chars().count() >= 2
        && normalized_source == normalized_target
        && !single_spaced_word
    {
        issues.push(TranslationQualityIssue {
            code: TranslationQualityCode::SourceCopy,
            detail: "译文与源文完全相同".to_owned(),
        });
    } else if let Some(run) = untranslated_run(&normalized_source, target_lang, &normalized_target)
    {
        issues.push(TranslationQualityIssue {
            code: TranslationQualityCode::SourceCopy,
            detail: format!("译文含原样照抄的源文片段「{run}」"),
        });
    } else if copied_fragment(source, trimmed) {
        issues.push(TranslationQualityIssue {
            code: TranslationQualityCode::SourceCopy,
            detail: "译文整句是源文里原样照抄的一段".to_owned(),
        });
    }
    if target_script_mismatch(target_lang, trimmed) {
        issues.push(TranslationQualityIssue {
            code: TranslationQualityCode::TargetLanguageMismatch,
            detail: format!("期望 {target_lang}，但输出由不匹配的文字脚本主导"),
        });
    }
    let source_units = normalize_chars(source).chars().count();
    let target_units = normalized_target.chars().count();
    if source_units >= 80 && target_units <= 2 {
        issues.push(TranslationQualityIssue {
            code: TranslationQualityCode::TooShort,
            detail: format!("源文有 {source_units} 个内容单位，译文只有 {target_units} 个"),
        });
    }
    issues
}

/// Returns the sentence ids involved in page- or batch-level collapse into short strings. Judged only when there are at least three sentences and they make up more than half of the page.
pub fn duplicate_collapse_ids<'a>(
    translations: impl IntoIterator<Item = (&'a str, &'a str, &'a str)>,
) -> Vec<String> {
    let items = translations.into_iter().collect::<Vec<_>>();
    let mut repeated: BTreeMap<String, Vec<(String, String)>> = BTreeMap::new();
    for (id, source, text) in &items {
        let normalized = normalize_chars(text);
        if !normalized.is_empty() && normalized.chars().count() <= 32 {
            repeated
                .entry(normalized)
                .or_default()
                .push(((*id).to_owned(), normalize_chars(source)));
        }
    }
    repeated
        .into_values()
        .filter(|rows| {
            let distinct_sources = rows
                .iter()
                .map(|(_, source)| source)
                .collect::<std::collections::BTreeSet<_>>()
                .len();
            rows.len() >= 3 && rows.len() * 2 >= items.len().max(1) && distinct_sources >= 3
        })
        .flatten()
        .map(|(id, _)| id)
        .collect()
}

/// Gives a high-confidence language family from the script distribution; returns `None` when no high-confidence judgment is possible.
pub fn dominant_script_language(text: &str) -> Option<&'static str> {
    let counts = scripts(text);
    let total = counts.total();
    if total < 8 {
        return None;
    }
    let candidates = [
        ("zh", counts.han),
        ("ja", counts.kana),
        ("ko", counts.hangul),
        ("ru", counts.cyrillic),
        ("ar", counts.arabic),
        ("hi", counts.devanagari),
        ("th", counts.thai),
        ("he", counts.hebrew),
        ("latin", counts.latin),
    ];
    let (lang, count) = candidates.into_iter().max_by_key(|(_, count)| *count)?;
    (count * 100 >= total * 70).then_some(lang)
}

/// Whether a BCP-47 tag is compatible with a high-confidence script family. `latin` is compatible with all common Latin-script languages.
pub fn language_matches_script(lang: &str, script_lang: &str) -> bool {
    let lang = primary(lang);
    match script_lang {
        "latin" => !matches!(
            lang.as_str(),
            "zh" | "ja" | "ko" | "ru" | "uk" | "bg" | "ar" | "fa" | "ur" | "hi" | "th" | "he"
        ),
        "ru" => matches!(lang.as_str(), "ru" | "uk" | "bg" | "sr" | "mk"),
        "ar" => matches!(lang.as_str(), "ar" | "fa" | "ur"),
        "hi" => matches!(lang.as_str(), "hi" | "mr" | "ne"),
        // Japanese text may consist entirely of kanji with no kana; Han dominance cannot be used to rule out ja.
        "zh" => matches!(lang.as_str(), "zh" | "ja" | "yue" | "cmn" | "wuu"),
        expected => lang == expected,
    }
}

/// The early probe must accumulate this many “script characters” before drawing a conclusion: enough to outweigh an opening voiceover or English title,
/// yet only about one or two minutes of Chinese speech or half a minute of English speech.
pub const SOURCE_PROBE_MIN_CHARS: usize = 160;
/// If, after accumulating this amount, the script distribution still has no high confidence (a genuinely mixed-language recording), the probe stops and leaves it to the full-text check before writing.
pub const SOURCE_PROBE_MAX_CHARS: usize = 2400;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SourceProbeVerdict {
    /// Not enough samples yet; keep feeding.
    Pending,
    /// Compatible with the expected language, or mixed to the point that no high-confidence judgment is possible; not checked afterwards.
    Settled,
    /// The sample's dominant script (the return value of [`dominant_script_language`]) clearly does not match the expected language.
    Mismatch(&'static str),
}

/// Early source-language consistency probe during transcription: streamed segment text is fed in, and once enough samples have accumulated, the script is checked once against the expected
/// source-lang. The judgment criteria are the same as the full-text check before writing (the same pair
/// [`dominant_script_language`] / [`language_matches_script`]); it just runs early, in the first few dozen seconds of transcription, instead of discovering after the whole ASR run that the language was set wrong. Once a conclusion is reached it does not change.
#[derive(Debug, Clone)]
pub struct SourceLanguageProbe {
    expected: String,
    sample: String,
    verdict: SourceProbeVerdict,
}

impl SourceLanguageProbe {
    pub fn new(expected: &str) -> Self {
        Self {
            expected: expected.to_owned(),
            sample: String::new(),
            verdict: SourceProbeVerdict::Pending,
        }
    }

    pub fn expected(&self) -> &str {
        &self.expected
    }

    pub fn verdict(&self) -> SourceProbeVerdict {
        self.verdict
    }

    pub fn observe(&mut self, text: &str) -> SourceProbeVerdict {
        if self.verdict != SourceProbeVerdict::Pending {
            return self.verdict;
        }
        if !self.sample.is_empty() {
            self.sample.push(' ');
        }
        self.sample.push_str(text);
        let total = scripts(&self.sample).total();
        if total < SOURCE_PROBE_MIN_CHARS {
            return self.verdict;
        }
        self.verdict = match dominant_script_language(&self.sample) {
            Some(script) if language_matches_script(&self.expected, script) => {
                SourceProbeVerdict::Settled
            }
            Some(script) => SourceProbeVerdict::Mismatch(script),
            None if total >= SOURCE_PROBE_MAX_CHARS => SourceProbeVerdict::Settled,
            None => SourceProbeVerdict::Pending,
        };
        if self.verdict != SourceProbeVerdict::Pending {
            self.sample = String::new();
        }
        self.verdict
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_chinese_for_english_and_placeholders_and_source_copies() {
        let mismatch = translation_quality_issues("你好世界", "en", "这是完整的中文回答");
        assert!(
            mismatch
                .iter()
                .any(|issue| issue.code == TranslationQualityCode::TargetLanguageMismatch)
        );
        assert!(
            translation_quality_issues("hello", "en", "Translation.")
                .iter()
                .any(|issue| issue.code == TranslationQualityCode::Placeholder)
        );
        assert!(
            translation_quality_issues("原文复制", "en", "原文复制")
                .iter()
                .any(|issue| issue.code == TranslationQualityCode::SourceCopy)
        );
    }

    /// Copying a single whitespace-separated word (a person's name, a brand) is not untranslated; in scripts written without spaces, a single “word”
    /// may be a whole sentence, and copying it still counts.
    #[test]
    fn a_single_spaced_word_copied_verbatim_is_not_a_source_copy() {
        assert!(translation_quality_issues("Dottie.", "zh", "Dottie.").is_empty());
        assert!(translation_quality_issues("Okay", "ja", "Okay").is_empty());
        for (source, lang) in [
            ("Hello world.", "zh"),
            ("原文复制", "en"),
            ("สวัสดีครับ", "en"),
        ] {
            assert!(
                translation_quality_issues(source, lang, source)
                    .iter()
                    .any(|issue| issue.code == TranslationQualityCode::SourceCopy),
                "{source}"
            );
        }
    }

    #[test]
    fn allows_short_names_and_normal_code_switching() {
        assert!(translation_quality_issues("包剪辑", "en", "CucCut").is_empty());
        assert!(translation_quality_issues("缓存", "en", "KV cache 缓存").is_empty());
        // A short name kept in the source script is not an untranslated run.
        assert!(
            translation_quality_issues("我在清华大学读书。", "en", "I studied at 清华大学.")
                .is_empty()
        );
    }

    /// Half-untranslated: when there are enough Latin words, the script-ratio gate cannot see it; a consecutive copied source fragment is the evidence.
    /// Only the ideographic source → non-ideographic target pair has this gate; Latin words copied into an ideographic target are not checked.
    #[test]
    fn rejects_a_half_translated_sentence_that_keeps_a_source_run() {
        let issues = translation_quality_issues(
            "毕业五年升职升不上去，转岗没机会，性格越来越I。",
            "en",
            "毕业 5 年升职升不上去， internal role transfer 没机会，性格越来越 I。",
        );
        assert!(
            issues
                .iter()
                .any(|issue| issue.code == TranslationQualityCode::SourceCopy),
            "{issues:?}"
        );
        assert!(
            !issues
                .iter()
                .any(|issue| issue.code == TranslationQualityCode::TargetLanguageMismatch),
            "the script-ratio gate alone does not see it: {issues:?}"
        );
        // Five characters is below the run length; a name or a term is kept.
        assert!(
            translation_quality_issues(
                "这是升职升不上去的原因。",
                "en",
                "That is why 升职升不上 happens."
            )
            .is_empty()
        );
        // The other direction is not gated: Latin runs in a CJK target are
        // usually names, titles and terms.
        assert!(
            translation_quality_issues(
                "Read the paper Attention Is All You Need tonight.",
                "zh-Hans",
                "今晚读一下 Attention Is All You Need 这篇论文。"
            )
            .is_empty()
        );
    }

    /// The whole translation is just a slice of the source (Spanish source, English target; both use the same script, so the script gate cannot see it): counted from four words onward. Short proper-noun fragments, sentences that already contain some translation, and words-without-spaces scripts are not blocked.
    #[test]
    fn rejects_a_translation_that_is_only_a_verbatim_part_of_the_source() {
        let source = "Aunque Inés salió antes que Mateo, llegó diez minutos después de él.";
        let copied = |lang: &str, translation: &str| {
            translation_quality_issues(source, lang, translation)
                .iter()
                .any(|issue| issue.code == TranslationQualityCode::SourceCopy)
        };
        assert!(copied("en", "llegó diez minutos después de él."));
        assert!(copied("en", "Aunque Inés salió antes que Mateo"));
        assert!(copied("ar", "salió antes que Mateo,"));
        // Three words: a name or a title is kept.
        assert!(!copied("en", "antes que Mateo"));
        // A sentence that carries the copied run among its own words is not
        // judged here.
        assert!(!copied(
            "en",
            "Although Inés left before Mateo, llegó diez minutos después."
        ));
        assert!(!copied(
            "en",
            "Although Inés left before Mateo, she arrived ten minutes after him."
        ));
        // Scripts written without spaces never reach the word count.
        assert!(
            translation_quality_issues("สวัสดีครับวันนี้อากาศดีมาก", "en", "วันนี้อากาศดี")
                .iter()
                .all(|issue| issue.code != TranslationQualityCode::SourceCopy)
        );
    }

    #[test]
    fn detects_dominant_source_script_conservatively() {
        assert_eq!(
            dominant_script_language("这是一个足够长的中文转录文本。"),
            Some("zh")
        );
        assert_eq!(dominant_script_language("CucCut CLI 1.2"), Some("latin"));
        assert!(language_matches_script("en-US", "latin"));
        assert!(!language_matches_script("en", "zh"));
    }

    #[test]
    fn source_probe_waits_for_a_sample_then_flags_the_wrong_script() {
        let mut probe = SourceLanguageProbe::new("en");
        assert_eq!(
            probe.observe("大家好，欢迎来到今天的讲座。"),
            SourceProbeVerdict::Pending
        );
        let mut verdict = SourceProbeVerdict::Pending;
        for _ in 0..20 {
            verdict = probe.observe("我们今天主要讨论 AI 在海外华人社区里的应用和一些实际的例子。");
        }
        assert_eq!(verdict, SourceProbeVerdict::Mismatch("zh"));
        // The conclusion does not revert.
        assert_eq!(
            probe.observe("This is a long English sentence that would not matter anymore."),
            SourceProbeVerdict::Mismatch("zh")
        );
    }

    #[test]
    fn source_probe_settles_on_compatible_or_truly_mixed_speech() {
        let mut probe = SourceLanguageProbe::new("zh-Hans");
        let mut verdict = SourceProbeVerdict::Pending;
        for _ in 0..20 {
            verdict = probe.observe("我们今天主要讨论 AI 在海外华人社区里的应用和一些实际的例子。");
        }
        assert_eq!(verdict, SourceProbeVerdict::Settled);

        // Neither Chinese nor English reaches 70%: when the cap is hit with still no high-confidence dominant script, stop rather than raise a false alarm.
        let mut mixed = SourceLanguageProbe::new("en");
        let mut verdict = SourceProbeVerdict::Pending;
        for _ in 0..200 {
            verdict = mixed.observe("这个功能我们下个迭代再讨论 roadmap 吧");
            assert!(!matches!(verdict, SourceProbeVerdict::Mismatch(_)));
        }
        assert_eq!(verdict, SourceProbeVerdict::Settled);
    }

    /// This gate only looks at writing script, copying and placeholders, not meaning: a fluent but mistranslated sentence still passes.
    /// The acceptance fixtures `de-07` (the condition was changed and the approving party was misread) and `hi-07` (“第二版” (second edition) rendered as “另一个版本” (another version)) produce no issues at all; meaning has to be checked by other mechanisms.
    #[test]
    fn a_fluent_mistranslation_passes_the_script_gate() {
        assert!(
            translation_quality_issues(
                "Sende Anna die Datei nur dann, wenn die Leitung der zweiten Fassung zugestimmt hat.",
                "zh-Hans",
                "只有在安娜收到文件并且第二版的负责人同意后，才发送。",
            )
            .is_empty()
        );
        assert!(
            translation_quality_issues(
                "जब तक प्रबंधक दूसरे संस्करण को मंज़ूरी न दे, तब तक फ़ाइल सारा को मत भेजें।",
                "zh-Hans",
                "在经理批准另一个版本之前，不要把文件发给萨拉。",
            )
            .is_empty()
        );
    }
}
