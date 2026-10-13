use std::collections::BTreeMap;
use std::error::Error;
use std::fmt::{self, Display, Formatter};

use crate::arrange::TimelineProjection;
use crate::cuts::SeamBias;
use crate::schema::TimeValue;
use crate::words::WordTiming;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AnchorBoundary {
    Start,
    End,
}

#[derive(Debug, Clone, PartialEq)]
pub struct WordAnchor {
    pub source_id: String,
    pub word_id: String,
    pub boundary: AnchorBoundary,
    pub offset: f64,
}

#[derive(Debug, Clone, PartialEq)]
pub enum AnchorError {
    Invalid(String),
    WordMissing { source_id: String, word_id: String },
    WordCut(String),
    Unmapped(String),
    Ambiguous(String),
}

impl AnchorError {
    pub fn code(&self) -> &'static str {
        match self {
            Self::Invalid(_) => "word-anchor-invalid",
            Self::WordMissing { .. } => "word-anchor-missing",
            Self::WordCut(_) => "word-anchor-cut",
            Self::Unmapped(_) => "word-anchor-unmapped",
            Self::Ambiguous(_) => "word-anchor-ambiguous",
        }
    }
}

impl Display for AnchorError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> fmt::Result {
        match self {
            Self::Invalid(anchor) => write!(formatter, "invalid word anchor: {anchor}"),
            Self::WordMissing { source_id, word_id } => {
                write!(formatter, "word {word_id} does not exist in source {source_id}")
            }
            Self::WordCut(anchor) => write!(formatter, "word anchor points to a cut word: {anchor}"),
            Self::Unmapped(anchor) => write!(formatter, "word anchor is not placed on the timeline: {anchor}"),
            Self::Ambiguous(anchor) => write!(formatter, "word anchor has multiple placements on the timeline: {anchor}"),
        }
    }
}

impl Error for AnchorError {}

fn split_offset(raw: &str) -> Option<(&str, f64)> {
    if let Some(index) = raw.rfind('+') {
        let value = raw[index + 1..].parse::<f64>().ok()?;
        return Some((&raw[..index], value));
    }
    // A direct negative offset is intentionally not recognized because word ids may
    // contain '-'. The closed grammar permits a negative offset after :start/:end.
    for marker in [":start-", ":end-"] {
        if let Some(index) = raw.rfind(marker) {
            let number_start = index + marker.len();
            let value = raw[number_start..].parse::<f64>().ok()?;
            return Some((&raw[..number_start - 1], -value));
        }
    }
    None
}

fn is_id_byte(byte: u8) -> bool {
    byte.is_ascii_alphanumeric() || matches!(byte, b'_' | b'.' | b'-')
}

/// `\d+(\.\d+)?` or `\.\d+`; only ASCII digits are recognized.
fn is_offset_number(raw: &str) -> bool {
    let digits = |part: &str| !part.is_empty() && part.bytes().all(|b| b.is_ascii_digit());
    match raw.split_once('.') {
        None => digits(raw),
        Some((int, frac)) => (int.is_empty() || digits(int)) && digits(frac),
    }
}

/// The closed grammar of word anchors: `~<source>:<word>`, optionally followed by `:start` / `:end` (each of which may carry `+n` / `-n` again) or directly `+n`; the id contains only `[A-Za-z0-9_.-]`. It is hand-written rather than using a regex: timeline validation runs in the browser wasm, and this is the only place in both the CPU and GPU artifacts that pulls in a regex engine.
pub(crate) fn is_word_anchor(raw: &str) -> bool {
    let Some((source, rest)) = raw.strip_prefix('~').and_then(|body| body.split_once(':')) else {
        return false;
    };
    if source.is_empty() || !source.bytes().all(is_id_byte) {
        return false;
    }
    // `:` and `+` are not id characters, so the word id is the longest run of id characters.
    let word_len = rest
        .bytes()
        .position(|b| !is_id_byte(b))
        .unwrap_or(rest.len());
    let (word, tail) = rest.split_at(word_len);
    if word.is_empty() {
        return false;
    }
    if tail.is_empty() {
        return true;
    }
    if let Some(number) = tail.strip_prefix('+') {
        return is_offset_number(number);
    }
    let Some(boundary) = tail.strip_prefix(':') else {
        return false;
    };
    match boundary
        .strip_prefix("start")
        .or_else(|| boundary.strip_prefix("end"))
    {
        Some("") => true,
        Some(offset) => offset
            .strip_prefix(['+', '-'])
            .is_some_and(is_offset_number),
        None => false,
    }
}

pub fn parse_word_anchor(raw: &str) -> Result<WordAnchor, AnchorError> {
    if !is_word_anchor(raw) {
        return Err(AnchorError::Invalid(raw.to_owned()));
    }
    let body = raw.strip_prefix('~').expect("grammar checked");
    let (body, offset) = split_offset(body).unwrap_or((body, 0.0));
    let (source_id, tail) = body
        .split_once(':')
        .ok_or_else(|| AnchorError::Invalid(raw.to_owned()))?;
    let (word_id, boundary) = if let Some(word) = tail.strip_suffix(":start") {
        (word, AnchorBoundary::Start)
    } else if let Some(word) = tail.strip_suffix(":end") {
        (word, AnchorBoundary::End)
    } else {
        (tail, AnchorBoundary::Start)
    };
    Ok(WordAnchor {
        source_id: source_id.to_owned(),
        word_id: word_id.to_owned(),
        boundary,
        offset,
    })
}

fn word_is_cut(projection: &TimelineProjection, anchor: &WordAnchor, word: &WordTiming) -> bool {
    projection
        .source(&anchor.source_id)
        .is_some_and(|source| source.word_is_cut(word.t0, word.t1))
}

pub fn resolve_word_anchor(
    raw: &str,
    projection: &TimelineProjection,
    words: &BTreeMap<String, Vec<WordTiming>>,
) -> Result<f64, AnchorError> {
    let anchor = parse_word_anchor(raw)?;
    let word = words
        .get(&anchor.source_id)
        .and_then(|words| words.iter().find(|word| word.id == anchor.word_id))
        .ok_or_else(|| AnchorError::WordMissing {
            source_id: anchor.source_id.clone(),
            word_id: anchor.word_id.clone(),
        })?;
    if word_is_cut(projection, &anchor, word) {
        return Err(AnchorError::WordCut(raw.to_owned()));
    }
    let mut source_time = match anchor.boundary {
        AnchorBoundary::Start => word.t0,
        AnchorBoundary::End => word.t1,
    };
    // The word is kept but its endpoint falls exactly inside the cut (a cut only trims the word's head/tail): snap to the kept side where the word body lies, consistent with the snapping semantics of §2.3, where clip endpoints fall inside a cut.
    if let Some(source) = projection.source(&anchor.source_id)
        && source.contains_cut(source_time)
    {
        let view = source.view_time_at_seam(source_time);
        let bias = match anchor.boundary {
            AnchorBoundary::Start => SeamBias::Following,
            AnchorBoundary::End => SeamBias::Preceding,
        };
        source_time = source.source_time(view, bias);
    }
    let matches = projection.source_to_timeline(&anchor.source_id, source_time);
    let time = match matches.as_slice() {
        [] => return Err(AnchorError::Unmapped(raw.to_owned())),
        [time] => *time,
        _ => return Err(AnchorError::Ambiguous(raw.to_owned())),
    } + anchor.offset;
    if !time.is_finite() || time < 0.0 {
        return Err(AnchorError::Invalid(raw.to_owned()));
    }
    Ok(time)
}

pub fn resolve_time_value(
    value: Option<&TimeValue>,
    fallback: f64,
    projection: &TimelineProjection,
    words: &BTreeMap<String, Vec<WordTiming>>,
) -> Result<f64, AnchorError> {
    match value {
        None => Ok(fallback),
        Some(TimeValue::Seconds(value)) => Ok(*value),
        Some(TimeValue::Anchor(anchor)) => resolve_word_anchor(anchor, projection, words),
    }
}

#[cfg(test)]
mod tests {
    use crate::schema::{Clip, Cut, Source, TimelineDocument};

    use super::*;

    fn fixture(reused: bool) -> (TimelineProjection, BTreeMap<String, Vec<WordTiming>>) {
        let mut document = TimelineDocument::default();
        document.sources.insert(
            "main".to_owned(),
            Source {
                cuts: vec![Cut {
                    id: "cut-1".to_owned(),
                    t0: 2.0,
                    t1: 3.0,
                    r#ref: None,
                }],
                ..Source::default()
            },
        );
        document.clips.push(Clip {
            id: "c1".to_owned(),
            src_id: "main".to_owned(),
            in_time: 0.0,
            out: 6.0,
            rate: 1.0,
        });
        if reused {
            document.clips.push(Clip {
                id: "c2".to_owned(),
                src_id: "main".to_owned(),
                in_time: 0.0,
                out: 6.0,
                rate: 1.0,
            });
        }
        let projection =
            TimelineProjection::build(&document, &BTreeMap::from([("main".to_owned(), 6.0)]))
                .unwrap();
        let words = BTreeMap::from([(
            "main".to_owned(),
            vec![
                WordTiming {
                    id: "w1".to_owned(),
                    t0: 1.0,
                    t1: 1.5,
                    hidden: false,
                },
                WordTiming {
                    id: "w2".to_owned(),
                    t0: 2.1,
                    t1: 2.8,
                    hidden: false,
                },
            ],
        )]);
        (projection, words)
    }

    /// The hand-written grammar is checked case by case against the original regex (the two are equivalent on ASCII input).
    #[test]
    fn grammar_matches_the_former_regex() {
        let pattern = regex::Regex::new(
            r"^~[A-Za-z0-9_.-]+:[A-Za-z0-9_.-]+(?:(?::(?:start|end))(?:[+-](?:\d+(?:\.\d+)?|\.\d+))?|\+(?:\d+(?:\.\d+)?|\.\d+))?$",
        )
        .unwrap();
        let pieces = [
            "~", ":", "+", "-", ".", "main", "g42.0", "w-1", "src_a", "start", "end", ":start",
            ":end", "0.4", "5", ".5", "5.", "x", "calc(1)", " ", "\n", "Start", "~a",
        ];
        // A deterministic linear congruential sequence, avoiding a dependency on a random-number crate.
        let mut state: u64 = 0x9e37_79b9_7f4a_7c15;
        let mut checked = 0;
        let mut positives = 0;
        for _ in 0..60_000 {
            state = state
                .wrapping_mul(6_364_136_223_846_793_005)
                .wrapping_add(1);
            let count = 1 + (state >> 60) as usize;
            let mut raw = String::new();
            for step in 0..count {
                let index = ((state >> (step * 5 % 59)) as usize) % pieces.len();
                raw.push_str(pieces[index]);
            }
            let accepted = is_word_anchor(&raw);
            assert_eq!(accepted, pattern.is_match(&raw), "{raw:?}");
            positives += usize::from(accepted);
            checked += 1;
        }
        // The sequence must contain enough valid anchors; otherwise the cross-check only exercises the “all rejected” side (measured: 222 cases).
        assert!(positives > 100, "only {positives} accepted");
        for raw in [
            "~main:g42.0",
            "~src-a:g42.0:end+0.4",
            "~main:w1:start-0.2",
            "~main:w1+.5",
            "~main:w1-1",
            "~g42.0",
            "~main:g42.0+calc(1)",
            "~main:w1:start-",
            "~main:w1:end+5.",
            "~main:w1:mid",
            "~:w1",
            "~main:",
            "main:w1",
            "~main:w1\n",
        ] {
            assert_eq!(is_word_anchor(raw), pattern.is_match(raw), "{raw:?}");
            checked += 1;
        }
        assert!(checked > 60_000);
    }

    /// The regex `\d` matches Unicode digits, whereas the hand-written version only accepts ASCII. Offsets using full-width or Arabic-Indic digits used to pass validation but could not be parsed into a number; they are now rejected outright as invalid.
    #[test]
    fn offsets_take_ascii_digits_only() {
        assert!(!is_word_anchor("~main:w1+\u{0663}"));
        assert!(!is_word_anchor("~main:w1:end-\u{FF11}"));
    }

    #[test]
    fn parses_boundary_and_offsets_without_losing_word_hyphens() {
        assert_eq!(
            parse_word_anchor("~src-a:w-1:end+0.4").unwrap(),
            WordAnchor {
                source_id: "src-a".to_owned(),
                word_id: "w-1".to_owned(),
                boundary: AnchorBoundary::End,
                offset: 0.4,
            }
        );
        assert_eq!(
            parse_word_anchor("~main:w1:start-0.2").unwrap().offset,
            -0.2
        );
    }

    #[test]
    fn distinguishes_cut_unmapped_and_ambiguous_word_anchors() {
        let (projection, words) = fixture(false);
        assert_eq!(
            resolve_word_anchor("~main:w1:end+0.2", &projection, &words).unwrap(),
            1.7
        );
        assert!(matches!(
            resolve_word_anchor("~main:w2", &projection, &words),
            Err(AnchorError::WordCut(_))
        ));
        let (projection, words) = fixture(true);
        assert!(matches!(
            resolve_word_anchor("~main:w1", &projection, &words),
            Err(AnchorError::Ambiguous(_))
        ));
    }

    #[test]
    fn partially_cut_words_follow_the_midpoint_rule_and_snap_boundaries() {
        // cut 2.0-3.0: the head of w-head is trimmed (midpoint 3.1 kept), and w-gone's midpoint 2.45 falls inside the cut.
        let (projection, _) = fixture(false);
        let words = BTreeMap::from([(
            "main".to_owned(),
            vec![
                WordTiming {
                    id: "w-head".to_owned(),
                    t0: 2.8,
                    t1: 3.4,
                    hidden: false,
                },
                WordTiming {
                    id: "w-gone".to_owned(),
                    t0: 2.1,
                    t1: 2.8,
                    hidden: false,
                },
            ],
        )]);
        // View time: source 3.0 collapses to 2.0 (the part before the cut keeps [0,2)). The word-head endpoint snaps to cut.t1=3.0.
        assert_eq!(
            resolve_word_anchor("~main:w-head:start", &projection, &words).unwrap(),
            2.0
        );
        assert!(matches!(
            resolve_word_anchor("~main:w-gone:end", &projection, &words),
            Err(AnchorError::WordCut(_))
        ));
    }
}
