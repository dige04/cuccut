//! Sentence splitting: replicates `pre_seg_text` (`cut5`) from upstream `TTS_infer_pack/TextPreprocessor.py`, along with its helper functions.

use anyhow::{Result, bail};

use super::pychar;

/// `text_segmentation_method.splits`。
const SPLITS: &[char] = &['，', '。', '？', '！', ',', '.', '?', '!', '~', ':', '：', '—', '…'];

pub fn is_split(c: char) -> bool {
    SPLITS.contains(&c)
}

/// `TextPreprocessor.replace_consecutive_punctuation`: consecutive `!?….,-` are reduced to the first one.
pub fn replace_consecutive_punctuation(text: &str) -> String {
    const PUNCTUATION: &[char] = &['!', '?', '…', ',', '.', '-'];
    let mut out = String::with_capacity(text.len());
    let mut previous = false;
    for c in text.chars() {
        let current = PUNCTUATION.contains(&c);
        if !(current && previous) {
            out.push(c);
        }
        previous = current;
    }
    out
}

/// `get_first`: the part before the first split punctuation mark (whitespace stripped).
fn get_first(text: &str) -> &str {
    text.split(is_split).next().unwrap_or("").trim()
}

/// `cut5`: splits on punctuation, does not split at decimal points between digits, drops items that are only punctuation, and joins with newlines.
fn cut5(input: &str) -> String {
    const PUNDS: &[char] = &[',', '.', ';', '?', '!', '、', '，', '。', '？', '！', '：', '…'];
    let chars: Vec<char> = input.trim_matches('\n').chars().collect();
    let mut merged = Vec::new();
    let mut items = String::new();
    for (index, &c) in chars.iter().enumerate() {
        items.push(c);
        if PUNDS.contains(&c) {
            let decimal = c == '.'
                && index > 0
                && index + 1 < chars.len()
                && pychar::is_digit(chars[index - 1])
                && pychar::is_digit(chars[index + 1]);
            if !decimal {
                merged.push(std::mem::take(&mut items));
            }
        }
    }
    if !items.is_empty() {
        merged.push(items);
    }
    merged
        .into_iter()
        .filter(|item| !item.chars().all(|c| PUNDS.contains(&c)))
        .collect::<Vec<_>>()
        .join("\n")
}

/// `merge_short_text_in_array`。
fn merge_short_text_in_array(texts: Vec<String>, threshold: usize) -> Vec<String> {
    if texts.len() < 2 {
        return texts;
    }
    let mut result: Vec<String> = Vec::new();
    let mut text = String::new();
    for item in texts {
        text.push_str(&item);
        if text.chars().count() >= threshold {
            result.push(std::mem::take(&mut text));
        }
    }
    if !text.is_empty() {
        match result.last_mut() {
            Some(last) => last.push_str(&text),
            None => result.push(text),
        }
    }
    result
}

/// `split_big_text(text, max_len=510)`。
fn split_big_text(text: &str, max_len: usize) -> Vec<String> {
    // re.split("([splits])"): text pieces and punctuation alternate, and the first and last may be empty strings
    let mut segments = Vec::new();
    let mut piece = String::new();
    for c in text.chars() {
        if is_split(c) {
            segments.push(std::mem::take(&mut piece));
            segments.push(c.to_string());
        } else {
            piece.push(c);
        }
    }
    segments.push(piece);

    let mut result = Vec::new();
    let mut current = String::new();
    for segment in segments {
        if current.chars().count() + segment.chars().count() > max_len {
            result.push(std::mem::replace(&mut current, segment));
        } else {
            current.push_str(&segment);
        }
    }
    if !current.is_empty() {
        result.push(current);
    }
    result
}

/// `TextPreprocessor.pre_seg_text(text, lang, "cut5")`; the caller runs `replace_consecutive_punctuation` first.
pub fn pre_seg_text(text: &str, english: bool) -> Result<Vec<String>> {
    let terminal = if english { "." } else { "。" };
    let text = text.trim_matches('\n');
    let Some(first) = text.chars().next() else {
        return Ok(Vec::new());
    };
    let mut text = text.to_owned();
    if !is_split(first) && get_first(&text).chars().count() < 4 {
        text.insert_str(0, terminal);
    }
    let mut text = cut5(&text);
    while text.contains("\n\n") {
        text = text.replace("\n\n", "\n");
    }
    let texts: Vec<&str> = text.split('\n').collect();
    // filter_text
    if texts.iter().all(|t| matches!(*t, " " | "\n" | "")) {
        bail!("please enter valid text");
    }
    let texts = texts.into_iter().filter(|t| !matches!(*t, " " | "")).map(str::to_owned).collect();

    let mut out = Vec::new();
    for mut text in merge_short_text_in_array(texts, 5) {
        if text.trim().is_empty() || !text.chars().any(pychar::is_word) {
            continue;
        }
        if !text.chars().last().is_some_and(is_split) {
            text.push_str(terminal);
        }
        if text.chars().count() > 510 {
            out.extend(split_big_text(&text, 510));
        } else {
            out.push(text);
        }
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cut5_keeps_decimal_point() {
        assert_eq!(cut5("圆周率是3.14，对吗？"), "圆周率是3.14，\n对吗？");
    }

    #[test]
    fn collapses_punctuation_runs() {
        assert_eq!(replace_consecutive_punctuation("好!!?啊..."), "好!啊.");
    }
}
