//! GPT-SoVITS v2 text frontend: ported layer by layer from upstream `RVC-Boss/GPT-SoVITS@48b1a0169a28` (MIT), `TTS_infer_pack/TextPreprocessor.py` and `text/`. Upstream `chinese2.py` enables G2PW by default. Here its ONNX model is not ported, and the `is_g2pw = False` branch is used instead: polyphonic characters rely only on the pypinyin phrase table.
//!
//! - Sentence splitting: `pre_seg_text` (`cut5`), see `split`.
//! - Segmentation: a Chinese request maps to upstream `language="zh"` (automatic segmentation of mixed Chinese/English text), and an English request is treated as English as a whole. Upstream detects the language with fast_langdetect; here it is replaced by the deterministic "rule C", see `langseg`.
//! - Chinese: `zh_normalization` → jieba part-of-speech segmentation → pypinyin + tone sandhi → opencpop initials and finals, producing `word2ph`.
//! - English: `english.py` (inflect number reading, CMUdict / name table, g2p_en homographs, NLTK part of speech, wordsegment splitting, GRU prediction for out-of-vocabulary words).
//!
//! The dictionaries and small models are embedded with `include_bytes!` under `data/` (about 11 MB). Their sources, licenses and how to regenerate them are in `data/README.md`. The generator and parity scripts are in `scripts/dev/gpt-sovits-text/` of the v2 repository (`cuccut-app`); they were not carried into v3. Upstream licenses involved: GPT-SoVITS MIT, PaddleSpeech Apache-2.0, jieba MIT, pypinyin MIT, CMUdict BSD, g2p_en Apache-2.0, NLTK tagger MIT, wordsegment Apache-2.0, inflect MIT, split-lang MIT.

mod data;
mod en;
mod en_norm;
mod error;
mod gpb;
mod jieba;
mod langseg;
pub(crate) mod pinyin;
mod pychar;
mod split;
mod symbols;
mod tone_sandhi;
mod words;
mod zh;
mod zh_norm;

#[cfg(test)]
mod parity;
#[cfg(test)]
mod tests;

use anyhow::{Result, anyhow, bail};
use langseg::SegLang;

/// Frontend language modes. The v2 port only covers Chinese (including mixed Chinese/English) and English.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Language {
    Zh,
    En,
}

impl Language {
    /// Normalizes the requested language (`zh-Hans` / `zh_CN` / `chinese` → Chinese, `en-US` / `english` → English).
    /// When it is missing or `auto`, the language is judged from the text: text containing Han characters is Chinese, otherwise English; text containing kana or Korean is an error.
    pub fn resolve(requested: Option<&str>, text: &str) -> Result<Self> {
        let requested = requested
            .map(|language| language.trim().to_ascii_lowercase().replace('_', "-"))
            .filter(|language| !language.is_empty() && language != "auto");
        let Some(language) = requested else {
            return Self::detect(text);
        };
        match language.as_str() {
            "chinese" | "mandarin" | "cn" => return Ok(Self::Zh),
            "english" => return Ok(Self::En),
            _ => {}
        }
        match language.split('-').next() {
            Some("zh") => Ok(Self::Zh),
            Some("en") => Ok(Self::En),
            _ => bail!("GPT-SoVITS v2 只支持中文与英文，不支持「{language}」"),
        }
    }

    fn detect(text: &str) -> Result<Self> {
        // ・ (U+30FB) and ー (U+30FC) also appear in foreign names transliterated into Chinese, so they do not count as kana
        let kana = |c: char| matches!(c, '\u{3041}'..='\u{3096}' | '\u{30A1}'..='\u{30FA}');
        let hangul = |c: char| matches!(c, '\u{AC00}'..='\u{D7AF}' | '\u{1100}'..='\u{11FF}');
        if text.chars().any(|c| kana(c) || hangul(c)) {
            bail!("GPT-SoVITS v2 只支持中文与英文，文本含日文假名或韩文：{text}");
        }
        let han = |c: char| matches!(c, '\u{3400}'..='\u{4DBF}' | '\u{4E00}'..='\u{9FFF}');
        Ok(if text.chars().any(han) { Self::Zh } else { Self::En })
    }

    fn terminal(self) -> &'static str {
        match self {
            Self::Zh => "。",
            Self::En => ".",
        }
    }

    fn seg_mode(self) -> SegLang {
        match self {
            Self::Zh => SegLang::Zh,
            Self::En => SegLang::En,
        }
    }
}

/// Phone result for one piece of same-language text; `word2ph` only exists for Chinese segments (it is used to expand the BERT features).
pub struct Piece {
    pub norm_text: String,
    pub phones: Vec<i32>,
    pub word2ph: Option<Vec<usize>>,
}

/// Reference text: strips leading and trailing newlines, and appends 「。」 (Chinese full stop) when the last character is not a sentence-ending punctuation mark (English appends ".").
pub fn with_terminal_punctuation(text: &str, language: Language) -> String {
    let mut text = text.trim_matches('\n').to_owned();
    if !text.chars().last().is_some_and(split::is_split) {
        text.push_str(language.terminal());
    }
    text
}

/// Splits synthesis text into sentences: keeps only the first of consecutive punctuation, splits with `cut5`, and appends end-of-sentence punctuation. Empty text returns an empty list;
/// text that is only punctuation or whitespace is an error.
pub fn split_sentences(text: &str, language: Language) -> Result<Vec<String>> {
    split::pre_seg_text(&split::replace_consecutive_punctuation(text), language == Language::En)
}

/// One sentence of text → phone ids per segment (when there are fewer than 6 phones, 「.」 is prepended and the result is recomputed once, as upstream does).
pub fn phonemize(text: &str, language: Language) -> Result<Vec<Piece>> {
    let segments =
        gpb::text_phones(text, language.seg_mode()).map_err(|err| anyhow!("GPT-SoVITS 文本前端无法处理（{}）：{text}", err.name()))?;
    Ok(segments
        .into_iter()
        .map(|segment| Piece {
            norm_text: segment.norm,
            phones: segment.ids.into_iter().map(|id| id as i32).collect(),
            word2ph: segment.word2ph,
        })
        .collect())
}
