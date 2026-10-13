//! Text part of `TextPreprocessor.get_phones_and_bert`: segmentation, per-segment `clean_text`, and phone ids.

use super::error::PyError;
use super::langseg::{self, SegLang};
use super::symbols::symbol_id;
use super::{en, zh};

pub struct Segment {
    // Segment languages and the original text are only kept for checking against the golden parity data.
    #[cfg_attr(not(test), allow(dead_code))]
    pub lang: SegLang,
    #[cfg_attr(not(test), allow(dead_code))]
    pub text: String,
    pub norm: String,
    pub ids: Vec<u32>,
    /// Number of phones per character in a Chinese segment (the per-character BERT features are expanded by this count); English segments have none.
    pub word2ph: Option<Vec<usize>>,
}

/// When `mode` is zh, mixed Chinese/English text is split into segments automatically; when it is en, the whole text is treated as English.
pub fn text_phones(text: &str, mode: SegLang) -> Result<Vec<Segment>, PyError> {
    phones(text, mode, false)
}

fn phones(text: &str, mode: SegLang, is_final: bool) -> Result<Vec<Segment>, PyError> {
    let text = langseg::collapse_spaces(text);
    let pairs = match mode {
        SegLang::En => vec![(SegLang::En, text.clone())],
        SegLang::Zh => langseg::zh_segments(&text)?,
    };
    if pairs.is_empty() {
        // Upstream calls torch.cat on an empty bert list
        return Err(PyError::Runtime);
    }
    let mut count = 0;
    let mut segments = Vec::with_capacity(pairs.len());
    for (lang, seg_text) in pairs {
        let (seg_phones, word2ph, norm) = match lang {
            SegLang::Zh => {
                let (seg_phones, word2ph, norm) = zh::clean(&seg_text)?;
                (seg_phones, Some(word2ph), norm)
            }
            SegLang::En => {
                let (seg_phones, norm) = en::clean_text(&seg_text)?;
                (seg_phones, None, norm)
            }
        };
        let ids = seg_phones
            .iter()
            .map(|phone| symbol_id(phone).ok_or(PyError::Key))
            .collect::<Result<Vec<_>, _>>()?;
        count += ids.len();
        segments.push(Segment {
            lang,
            text: seg_text,
            norm,
            ids,
            word2ph,
        });
    }
    // If there are too few phones, prepend a period and recompute once.
    if !is_final && count < 6 {
        return phones(&format!(".{text}"), mode, true);
    }
    Ok(segments)
}
