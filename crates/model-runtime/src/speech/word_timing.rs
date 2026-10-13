//! Word timing without an aligner: word times are interpolated proportionally within the segment by each word's character count. The resulting `timingQuality` is always `estimated`.

use super::text_prep::split_into_word_pairs;

/// An estimated word (f64 seconds, on the same clock as the segment).
#[derive(Debug, Clone, PartialEq)]
pub struct EstimatedWord {
    pub text: String,
    pub start: f64,
    pub end: f64,
}

/// Splits `text` into words and divides `[start, end]` among them by their cleaned character counts. The first word starts at `start`, the last word ends at `end`, and adjacent words are joined end to end. If no words can be split out (all punctuation), the whole text counts as one word; if the text is empty, there are no words.
pub fn estimate(text: &str, language: Option<&str>, start: f64, end: f64) -> Vec<EstimatedWord> {
    let text = text.trim();
    if text.is_empty() {
        return Vec::new();
    }
    let end = end.max(start);
    let pairs = split_into_word_pairs(text, language);
    if pairs.is_empty() {
        return vec![EstimatedWord {
            text: text.to_owned(),
            start,
            end,
        }];
    }

    let weights: Vec<f64> = pairs.iter().map(|pair| pair.cleaned.chars().count().max(1) as f64).collect();
    let total: f64 = weights.iter().sum();
    let mut words = Vec::with_capacity(pairs.len());
    let mut consumed = 0.0;
    let mut cursor = start;
    for (index, (pair, weight)) in pairs.into_iter().zip(&weights).enumerate() {
        consumed += weight;
        let word_end = if index + 1 == weights.len() {
            end
        } else {
            (start + (end - start) * consumed / total).min(end)
        };
        words.push(EstimatedWord {
            text: pair.surface,
            start: cursor,
            end: word_end,
        });
        cursor = word_end;
    }
    words
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn interpolates_by_character_length() {
        let words = estimate("ab abcd, ab", Some("en"), 1.0, 2.6);
        assert_eq!(
            words.iter().map(|word| word.text.as_str()).collect::<Vec<_>>(),
            ["ab", "abcd,", "ab"]
        );
        // 2 + 4 + 2 = 8 characters, 1.6 seconds: 0.2 seconds per character.
        let close = |a: f64, b: f64| (a - b).abs() < 1e-9;
        assert!(close(words[0].start, 1.0) && close(words[0].end, 1.4));
        assert!(close(words[1].start, 1.4) && close(words[1].end, 2.2));
        assert_eq!((words[2].start, words[2].end), (words[1].end, 2.6));
    }

    #[test]
    fn han_text_gets_one_word_per_character() {
        let words = estimate("你好。", Some("zh"), 0.0, 1.0);
        assert_eq!(words.len(), 2);
        assert_eq!(words[1].text, "好。");
        assert_eq!(words[1].end, 1.0);
    }

    #[test]
    fn degenerate_inputs() {
        assert!(estimate("   ", None, 0.0, 1.0).is_empty());
        assert_eq!(
            estimate("?!", None, 0.5, 0.75),
            [EstimatedWord {
                text: "?!".into(),
                start: 0.5,
                end: 0.75
            }]
        );
        // When the segment has zero length, all words collapse to one point, which is still monotonic.
        let collapsed = estimate("a b", None, 2.0, 1.0);
        assert!(collapsed.iter().all(|word| word.start == 2.0 && word.end == 2.0));
    }
}
