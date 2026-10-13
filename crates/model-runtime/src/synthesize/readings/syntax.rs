//! Inline annotation syntax `<surface|reading>` for TTS pre-synthesis annotation (architecture design §6.1, “reading annotation”), ported from v2 `ccut-lang::readings`.
//!
//! This file holds only the syntax itself: parsing, stripping, and re-emitting verbatim. v2 placed it in the language directory layer because the speaking-rate measure must count the surface text after annotations are stripped (`<行|xing2>` must not count as five extra units). v3's speaking-rate measure has not been ported yet, so for now the syntax lives with synthesis, and the `JsonSchema` derive that existed only for the online schema has been removed. Dictionary decisions and per-engine rendering are in the layer above, [`super`].
//!
//! A reading is pinyin. One annotation can cover one character or one word; multi-character readings are separated by spaces (`<银行|yin2 hang2>` (bank)), and the number of readings must equal the number of surface characters.
//! Each syllable accepts both notations, and they can be mixed within one annotation (`<银行|yín hang2>`):
//!
//! - Tone numbers: ASCII letters + `1`–`5` (`hang2`; neutral tone is `5`); ü is written `v` or `ü`;
//! - Tone-marked pinyin: the tone mark is placed on the vowel (`háng`, `lǜ`); no tone mark means neutral tone (`le` → `le5`), and ü may be left without a tone (`nü` → `nv5`).
//!   Only precomposed characters are accepted (`á`, `ǘ`, and `ń ň ǹ ḿ`); combining diacritics are not accepted. One syllable with two tone marks, or a tone mark together with a tone number, is invalid.
//!
//! Parsing always normalizes to the tone-number form: case is ignored (folded to lowercase), `ü` is folded to `v`, and `v` after j / q / x / y is folded to `u` (the same form as pypinyin `Style.TONE3`). So the engine, storage and later processing only ever see `hang2` / `lv4` / `le5`.
//! Syllables are judged only by shape (1–6 letters after the tone is removed, containing a vowel, or being `m n ng hm hng`); they are not checked against the pinyin syllable table.
//!
//! Only angle brackets whose surface contains Han characters, and whose reading consists only of ASCII letters and digits, spaces, `ü`, and tone-marked vowels, can be pinyin annotations. A reading that has tone digits or tone marks and is invalid (tone mark together with digit, two tone marks, not syllable-shaped, wrong number of readings) keeps the whole thing literal in the surface text and is recorded in [`Annotated::malformed`]. One with neither digits nor tone marks (`<了|le>` (particle)) is an annotation only when the whole thing is valid; otherwise (`<中文|Chinese>` (Chinese)) it is kept literal and not reported.
//! Other angle brackets (English ARPAbet, Japanese kana, unpaired `<`) are always kept literal and not reported.

use serde::{Deserialize, Serialize};

/// The source of an annotation. The rendering layer uses it to tell them apart: Qwen3-TTS does not replace `Phrase` (a phrase reading is already pronounced correctly).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Origin {
    /// An annotation hand-written by the user (or agent) in the text.
    User,
    /// A reading fixed by a phrase-table match.
    Phrase,
    /// A single character, using its dictionary default reading.
    Dict,
    /// A reading decided by an LLM from context.
    Llm,
}

/// One annotation: the surface text `[start, end)` (Unicode scalar offsets) is read as `reading`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Reading {
    pub start: usize,
    pub end: usize,
    /// The normalized reading, with multiple readings separated by a single space (`yin2 hang2`); for a malformed annotation, the original reading text.
    pub reading: String,
    pub origin: Origin,
}

impl Reading {
    /// Per-character readings.
    pub fn syllables(&self) -> impl Iterator<Item = &str> {
        self.reading.split(' ')
    }
}

/// A context-dependent polyphonic single-character candidate: a character whose reading the phrase table could not fix, and which depends on context.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Candidate {
    pub start: usize,
    pub end: usize,
    /// The dictionary default reading.
    pub default: String,
    /// All readings (default reading first).
    pub readings: Vec<String>,
}

/// Parse result: the surface text with annotations stripped, and the annotations that fall on it.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Annotated {
    pub surface: String,
    /// Sorted by `start` in ascending order, non-overlapping.
    pub readings: Vec<Reading>,
    /// Something recognized as a pinyin annotation but with an invalid reading is kept literal in `surface`; the offsets point to its surface text.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub malformed: Vec<Reading>,
    /// Context-dependent polyphonic candidates given by `annotate` (`parse` does not produce these).
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub candidates: Vec<Candidate>,
}

impl Annotated {
    /// No annotations at all (and no malformed annotations).
    pub fn is_plain(&self) -> bool {
        self.readings.is_empty() && self.malformed.is_empty()
    }

    /// The surface text of `[start, end)`.
    pub fn slice(&self, start: usize, end: usize) -> String {
        self.surface.chars().skip(start).take(end.saturating_sub(start)).collect()
    }

    /// Re-emits annotations verbatim as `<surface|reading>` (IndexTTS 2.5 consumes this syntax directly); `parse(to_text())` equals the original.
    pub fn to_text(&self) -> String {
        let mut out = String::with_capacity(self.surface.len() + self.readings.len() * 12);
        let mut next = self.readings.iter().peekable();
        let mut pending: Option<(&Reading, String)> = None;
        for (index, c) in self.surface.chars().enumerate() {
            if pending.is_none()
                && let Some(reading) = next.next_if(|r| r.start == index)
            {
                pending = Some((reading, String::new()));
            }
            match pending.as_mut() {
                Some((reading, buf)) => {
                    buf.push(c);
                    if index + 1 == reading.end {
                        out.push('<');
                        out.push_str(buf);
                        out.push('|');
                        out.push_str(&reading.reading);
                        out.push('>');
                        pending = None;
                    }
                }
                None => out.push(c),
            }
        }
        out
    }
}

/// Removes annotations, keeping only the surface text (`<行|xing2>` → `行`).
pub fn strip(text: &str) -> String {
    if !text.contains('<') {
        return text.to_owned();
    }
    parse(text).surface
}

/// Whether the text contains any valid pinyin annotation.
pub fn has_readings(text: &str) -> bool {
    text.contains('<') && !parse(text).readings.is_empty()
}

/// Parses `<surface|reading>` annotations; hand-written ones are always recorded as [`Origin::User`].
pub fn parse(text: &str) -> Annotated {
    let mut out = Annotated::default();
    if !text.contains('<') {
        out.surface = text.to_owned();
        return out;
    }
    let chars: Vec<char> = text.chars().collect();
    let mut surface_len = 0usize;
    let mut i = 0;
    while i < chars.len() {
        if chars[i] == '<'
            && let Some((bar, close)) = bracket(&chars, i)
        {
            let face = &chars[i + 1..bar];
            let raw: String = chars[bar + 1..close].iter().collect();
            if is_pinyin_attempt(face, &raw) {
                let reading = normalize(&raw, face.len());
                if reading.is_none() && !has_tone(&raw) {
                    // A reading without tones (`<中文|Chinese>` (Chinese)) that is invalid does not look like a pinyin annotation: kept literal, not reported.
                    out.surface.push(chars[i]);
                    surface_len += 1;
                    i += 1;
                    continue;
                }
                match reading {
                    Some(reading) => {
                        out.readings.push(Reading {
                            start: surface_len,
                            end: surface_len + face.len(),
                            reading,
                            origin: Origin::User,
                        });
                        out.surface.extend(face);
                        surface_len += face.len();
                    }
                    None => {
                        out.malformed.push(Reading {
                            start: surface_len + 1,
                            end: surface_len + 1 + face.len(),
                            reading: raw,
                            origin: Origin::User,
                        });
                        out.surface.extend(&chars[i..=close]);
                        surface_len += close + 1 - i;
                    }
                }
                i = close + 1;
                continue;
            }
        }
        out.surface.push(chars[i]);
        surface_len += 1;
        i += 1;
    }
    out
}

/// For `<surface|reading>` starting at `chars[open] == '<'`: returns the indices of `|` and `>`. Both parts must be non-empty, and must not contain `< > |` or a newline.
fn bracket(chars: &[char], open: usize) -> Option<(usize, usize)> {
    let stop = |c: char| matches!(c, '<' | '>' | '|' | '\n');
    let bar = open + 1 + chars[open + 1..].iter().position(|&c| stop(c))?;
    if chars[bar] != '|' || bar == open + 1 {
        return None;
    }
    let close = bar + 1 + chars[bar + 1..].iter().position(|&c| stop(c))?;
    if chars[close] != '>' || close == bar + 1 {
        return None;
    }
    Some((bar, close))
}

fn is_han(c: char) -> bool {
    ('\u{3400}'..='\u{9FFF}').contains(&c) || ('\u{20000}'..='\u{2FFFF}').contains(&c)
}

/// A toned letter (already lowercased) → the ASCII letter with the tone removed, and the tone (`ü` carries no tone, so the tone is 0).
fn fold_marked(c: char) -> Option<(char, u8)> {
    const TABLE: [(char, [char; 4]); 8] = [
        ('a', ['ā', 'á', 'ǎ', 'à']),
        ('e', ['ē', 'é', 'ě', 'è']),
        ('i', ['ī', 'í', 'ǐ', 'ì']),
        ('o', ['ō', 'ó', 'ǒ', 'ò']),
        ('u', ['ū', 'ú', 'ǔ', 'ù']),
        ('v', ['ǖ', 'ǘ', 'ǚ', 'ǜ']),
        ('n', ['\0', 'ń', 'ň', 'ǹ']),
        ('m', ['\0', 'ḿ', '\0', '\0']),
    ];
    if c == 'ü' {
        return Some(('v', 0));
    }
    TABLE.iter().find_map(|(base, marks)| {
        let tone = marks.iter().position(|&m| m == c && m != '\0')?;
        Some((*base, tone as u8 + 1))
    })
}

/// One character of the reading, after lowercasing (the uppercase Latin letters each have only one lowercase form).
fn lower(c: char) -> char {
    c.to_lowercase().next().unwrap_or(c)
}

fn is_pinyin_char(c: char) -> bool {
    c.is_ascii_alphanumeric() || c == ' ' || fold_marked(lower(c)).is_some()
}

/// The reading has tone digits or a tone mark: this shows a pinyin annotation is being written (reported as malformed if invalid).
fn has_tone(raw: &str) -> bool {
    raw.chars()
        .any(|c| c.is_ascii_digit() || fold_marked(lower(c)).is_some_and(|(_, tone)| tone > 0))
}

fn is_pinyin_attempt(face: &[char], raw: &str) -> bool {
    face.iter().any(|&c| is_han(c)) && raw.chars().all(is_pinyin_char)
}

/// One syllable → canonical form such as `hang2`. Must be 1–6 letters and contain a vowel (or be a syllabic `m n ng hm hng`); the tone comes from a trailing digit 1–5, a single tone mark, or neutral tone.
fn normalize_syllable(raw: &str) -> Option<String> {
    let mut body = String::with_capacity(raw.len());
    let mut mark = None;
    let mut digit = None;
    for c in raw.chars() {
        if digit.is_some() {
            return None;
        }
        let c = lower(c);
        match c {
            'a'..='z' => body.push(c),
            '1'..='5' => digit = Some(c as u8 - b'0'),
            _ => {
                let (base, tone) = fold_marked(c)?;
                body.push(base);
                if tone > 0 {
                    if mark.is_some() {
                        return None;
                    }
                    mark = Some(tone);
                }
            }
        }
    }
    let tone = match (digit, mark) {
        (Some(_), Some(_)) => return None,
        (Some(tone), None) | (None, Some(tone)) => tone,
        (None, None) => 5,
    };
    let voiced = body.contains(['a', 'e', 'i', 'o', 'u', 'v']) || matches!(body.as_str(), "m" | "n" | "ng" | "hm" | "hng");
    if !(1..=6).contains(&body.len()) || !voiced {
        return None;
    }
    if matches!(body.as_bytes()[0], b'j' | b'q' | b'x' | b'y') {
        body = body.replace('v', "u");
    }
    Some(format!("{body}{tone}"))
}

/// Normalizes a reading; each syllable is handled per [`normalize_syllable`], and the number of syllables equals the number of surface characters.
fn normalize(raw: &str, count: usize) -> Option<String> {
    let syllables = raw.split_whitespace().map(normalize_syllable).collect::<Option<Vec<_>>>()?;
    (syllables.len() == count).then(|| syllables.join(" "))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn user(start: usize, end: usize, reading: &str) -> Reading {
        Reading {
            start,
            end,
            reading: reading.to_owned(),
            origin: Origin::User,
        }
    }

    #[test]
    fn single_character() {
        let a = parse("他在银<行|XING2>里");
        assert_eq!(a.surface, "他在银行里");
        assert_eq!(a.readings, [user(3, 4, "xing2")]);
        assert!(a.malformed.is_empty());
        assert_eq!(strip("他在银<行|XING2>里"), "他在银行里");
    }

    #[test]
    fn multi_character_and_umlaut() {
        let a = parse("<银行|yin2  hang2>门口的<绿|lü4>灯，<句|jv4>子");
        assert_eq!(a.surface, "银行门口的绿灯，句子");
        assert_eq!(a.readings, [user(0, 2, "yin2 hang2"), user(5, 6, "lv4"), user(8, 9, "ju4")]);
        assert_eq!(a.readings[0].syllables().collect::<Vec<_>>(), ["yin2", "hang2"]);
    }

    #[test]
    fn mixed_chinese_and_english() {
        let a = parse("AI 让这一<行|hang2>变了，<read|R EH1 D> it，a < b");
        assert_eq!(a.surface, "AI 让这一行变了，<read|R EH1 D> it，a < b");
        assert_eq!(a.readings, [user(6, 7, "hang2")]);
        assert!(a.malformed.is_empty(), "English phoneme annotations are not pinyin annotations, so they are not reported");
    }

    #[test]
    fn no_annotation_is_untouched() {
        let a = parse("这件事我觉得行。");
        assert_eq!(a.surface, "这件事我觉得行。");
        assert!(a.is_plain());
        assert!(!has_readings("这件事我觉得行。"));
        assert!(has_readings("觉得<行|xing2>"));
    }

    #[test]
    fn malformed_annotations_stay_literal() {
        // No `|`: not an annotation, kept literal and not reported.
        let a = parse("<行xing2>走");
        assert_eq!(a.surface, "<行xing2>走");
        assert!(a.is_plain());
        // Wrong number of readings: the whole thing is kept literal and reported as malformed; the offsets point to the surface text.
        let a = parse("去<银行|hang2>办事");
        assert_eq!(a.surface, "去<银行|hang2>办事");
        assert!(a.readings.is_empty());
        assert_eq!(a.malformed, [user(2, 4, "hang2")]);
        assert_eq!(a.slice(2, 4), "银行");
        // One extra tone digit: malformations other than a wrong reading count are reported the same way.
        assert_eq!(parse("<行|xing22>").malformed.len(), 1);
        // A reading without tones that is also invalid (wrong number of readings, more than 6 letters) does not look like a pinyin annotation: kept literal, not reported.
        assert!(parse("<中文|Chinese>").is_plain());
        assert!(parse("<好|hello world>").is_plain());
        assert!(parse("<行|xyz>").is_plain());
        // A toned syllable without a vowel is invalid (syllabic m / n / ng / hm / hng excepted).
        assert_eq!(parse("<行|xyz2>").malformed.len(), 1);
        assert_eq!(parse("<呣|m2>").readings, [user(0, 1, "m2")]);
        assert_eq!(parse("<哼|hng>").readings, [user(0, 1, "hng5")]);
        // Nesting: the outer `<` is literal; the inner one is parsed as usual.
        let a = parse("<外<行|xing2>|x>");
        assert_eq!(a.surface, "<外行|x>");
        assert_eq!(a.readings, [user(2, 3, "xing2")]);
        // Empty reading, or Japanese kana: literal.
        assert!(parse("<行|>").is_plain());
        assert!(parse("<今日|きょう>").is_plain());
    }

    #[test]
    fn tone_marks_normalize_to_digits() {
        let a = parse("<行|háng>、<银行|yín háng>、<绿|lǜ>、走<了|le>、<女|nǚ>、<驴|lǘ>、<女|nü>、<嗯|ńg>");
        assert_eq!(a.surface, "行、银行、绿、走了、女、驴、女、嗯");
        let readings: Vec<_> = a.readings.iter().map(|r| r.reading.as_str()).collect();
        assert_eq!(readings, ["hang2", "yin2 hang2", "lv4", "le5", "nv3", "lv2", "nv5", "ng2"]);
        assert!(a.malformed.is_empty());
        // ü after j / q / x / y is folded to u, the same form as the digit notation.
        assert_eq!(parse("<句|jǜ>").readings, [user(0, 1, "ju4")]);
        assert_eq!(parse("<雨|yǔ>").readings, [user(0, 1, "yu3")]);
        // A single untoned character: neutral tone.
        assert_eq!(parse("<行|xing>").readings, [user(0, 1, "xing5")]);
    }

    #[test]
    fn mixed_and_uppercase_syllables() {
        // Each syllable's notation is recognized separately, so they may be mixed.
        assert_eq!(parse("<银行|yín hang2>").readings, [user(0, 2, "yin2 hang2")]);
        assert_eq!(parse("<银行|yin2 háng>").readings, [user(0, 2, "yin2 hang2")]);
        // In the digit notation, a syllable without a digit is likewise neutral tone.
        assert_eq!(parse("<东西|dong1 xi>").readings, [user(0, 2, "dong1 xi5")]);
        // Uppercase is always folded to lowercase, including uppercase toned letters.
        assert_eq!(parse("<行|HÁNG>").readings, [user(0, 1, "hang2")]);
        assert_eq!(parse("<银行|Yín Háng>").readings, [user(0, 2, "yin2 hang2")]);
        assert_eq!(parse("<绿|LǛ>").readings, [user(0, 1, "lv4")]);
        assert_eq!(parse("<女|NÜ3>").readings, [user(0, 1, "nv3")]);
    }

    #[test]
    fn invalid_tone_marks_stay_literal() {
        for text in [
            "<行|háng2>",       // Tone mark and tone digit both present
            "<行|hángá>",       // Two tone marks in one syllable
            "<银行|yín>",       // Wrong number of readings
            "<行|zhuángáng>",   // More than 6 letters after the tone is removed
            "<银行|yín 2háng>", // Digit not at the end
        ] {
            let a = parse(text);
            assert_eq!(a.surface, text, "{text}");
            assert!(a.readings.is_empty(), "{text}");
            assert_eq!(a.malformed.len(), 1, "{text}");
        }
        // A malformed annotation records the original reading.
        assert_eq!(parse("<行|háng2>").malformed[0].reading, "háng2");
        // A combining diacritic (`a` + U+0301) is not accepted: it is not a pinyin character, so it is kept literal and not reported.
        assert!(parse("<行|ha\u{301}ng>").is_plain());
    }

    #[test]
    fn tone_marks_round_trip_as_digits() {
        let a = parse("他在<银行|yín háng>上班，<长|zhǎng>得高，不<行|xíng>了。");
        assert_eq!(a.to_text(), "他在<银行|yin2 hang2>上班，<长|zhang3>得高，不<行|xing2>了。");
        assert_eq!(parse(&a.to_text()), a);
    }

    #[test]
    fn to_text_round_trips() {
        let text = "他在<银行|yin2 hang2>上班，<长|zhang3>得高，不<行|xing2>。";
        let a = parse(text);
        assert_eq!(a.to_text(), text);
        assert_eq!(parse(&a.to_text()), a);
    }
}
