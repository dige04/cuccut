//! Splitting long text into chunks: a TTS model can only reliably generate about ten-odd seconds at a time, so long text must be split at natural pauses and synthesized chunk by chunk.
//!
//! Handles Chinese and English alike: sentence-final punctuation
//! (。！？.!?) takes priority, then semicolon / colon / comma (including full-width), and finally a hard cut at the budget.
//! The length budget is counted in units: one CJK character counts as one unit, and one space-separated Latin word counts as one unit.

/// By default, each chunk holds at most 60 units (about 35 English words or 60 Chinese characters, roughly 15 seconds of Qwen3-TTS speech).
pub const DEFAULT_MAX_UNITS: usize = 60;
/// Fragments shorter than this number are merged into adjacent chunks.
pub const MIN_UNITS: usize = 8;

const SENTENCE_END: &[char] = &['。', '！', '？', '.', '!', '?', '…'];
const CLAUSE_END: &[char] = &['；', ';', '：', ':', '，', ',', '、'];

/// Splits the whole text into chunks suitable for a single synthesis call, keeping the original punctuation.
pub fn chunk(text: &str, max_units: usize) -> Vec<String> {
    chunk_with_breaks(text, max_units).into_iter().map(|chunk| chunk.text).collect()
}

/// Which boundary level follows a chunk: used during stitching to insert pauses ([`crate::synthesize::stitch`]).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ChunkBreak {
    /// A chunk breaks mid-sentence: it falls on clause punctuation such as a semicolon or comma, or is hard-cut when it is too long with no punctuation.
    Clause,
    /// A chunk ends with sentence-final punctuation (。！？.!?…, which may be followed by a closing quote or closing bracket).
    Sentence,
    /// Paragraph (line break) boundary; the last chunk of the whole text is also recorded as this.
    Paragraph,
}

/// A chunk produced by [`chunk`], along with the boundary level that follows it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TextChunk {
    pub text: String,
    pub after: ChunkBreak,
}

/// Splits exactly as [`chunk`] does, and additionally gives the boundary level after each chunk.
pub fn chunk_with_breaks(text: &str, max_units: usize) -> Vec<TextChunk> {
    let mut out = Vec::new();
    for paragraph in chunk_paragraphs(text, max_units) {
        let last = paragraph.len().saturating_sub(1);
        out.extend(paragraph.into_iter().enumerate().map(|(index, text)| {
            let after = if index == last {
                ChunkBreak::Paragraph
            } else if ends_sentence(&text) {
                ChunkBreak::Sentence
            } else {
                ChunkBreak::Clause
            };
            TextChunk { text, after }
        }));
    }
    out
}

/// After stripping trailing closing quotes, closing brackets and whitespace, is the last character sentence-final punctuation?
fn ends_sentence(text: &str) -> bool {
    text.trim_end_matches(|c: char| c.is_whitespace() || is_closing_quote(c))
        .chars()
        .last()
        .is_some_and(|c| SENTENCE_END.contains(&c))
}

/// Chunks grouped by paragraph: a paragraph (line break) is always a chunk boundary, and each paragraph is split separately.
fn chunk_paragraphs(text: &str, max_units: usize) -> Vec<Vec<String>> {
    let max_units = max_units.max(MIN_UNITS);
    let normalized = text.replace("\r\n", "\n");
    let mut out = Vec::new();
    let mut chunks = Vec::new();
    for paragraph in normalized.split('\n') {
        let paragraph = paragraph.trim();
        if paragraph.is_empty() {
            continue;
        }
        let sentences = split_sentences(paragraph);
        let mut current = String::new();
        let mut current_units = 0usize;
        for sentence in sentences {
            let units = count_units(&sentence);
            if units > max_units {
                flush(&mut chunks, &mut current, &mut current_units);
                chunks.extend(split_long_sentence(&sentence, max_units));
                continue;
            }
            if current_units + units > max_units && current_units >= MIN_UNITS {
                flush(&mut chunks, &mut current, &mut current_units);
            }
            if !current.is_empty() && needs_space(&current, &sentence) {
                current.push(' ');
            }
            current.push_str(&sentence);
            current_units += units;
        }
        flush(&mut chunks, &mut current, &mut current_units);
        // A trailing fragment is merged back only within the same paragraph, never across paragraphs.
        let paragraph_chunks = merge_tiny_tail(std::mem::take(&mut chunks));
        if !paragraph_chunks.is_empty() {
            out.push(paragraph_chunks);
        }
    }
    out
}

fn flush(chunks: &mut Vec<String>, current: &mut String, units: &mut usize) {
    let trimmed = current.trim();
    if !trimmed.is_empty() {
        chunks.push(trimmed.to_owned());
    }
    current.clear();
    *units = 0;
}

/// When the last chunk is too short, it is merged back into the previous chunk (to avoid a fragment such as “。好的” being synthesized alone and producing strange sounds).
fn merge_tiny_tail(mut chunks: Vec<String>) -> Vec<String> {
    if chunks.len() >= 2 {
        let last_units = count_units(&chunks[chunks.len() - 1]);
        if last_units < MIN_UNITS {
            let last = chunks.pop().unwrap_or_default();
            let previous = chunks.last_mut().expect("len >= 2");
            if needs_space(previous, &last) {
                previous.push(' ');
            }
            previous.push_str(&last);
        }
    }
    chunks
}

fn needs_space(left: &str, right: &str) -> bool {
    let Some(last) = left.chars().last() else {
        return false;
    };
    let Some(first) = right.chars().next() else {
        return false;
    };
    !(is_cjk(last) || is_cjk(first) || last.is_whitespace())
}

/// Splits into sentences at sentence-final punctuation; the punctuation stays with the preceding sentence.
pub fn split_sentences(text: &str) -> Vec<String> {
    let chars: Vec<char> = text.chars().collect();
    let mut out = Vec::new();
    let mut start = 0usize;
    let mut i = 0usize;
    while i < chars.len() {
        let c = chars[i];
        if SENTENCE_END.contains(&c) {
            // Decimal point / abbreviation: a period immediately followed by a non-whitespace character, as in `3.14` or `e.g.`, does not count as a sentence end.
            let mut end = i + 1;
            while end < chars.len() && (SENTENCE_END.contains(&chars[end]) || is_closing_quote(chars[end])) {
                end += 1;
            }
            let ascii_dot = c == '.';
            let followed_by_text = end < chars.len() && !chars[end].is_whitespace() && !is_cjk(chars[end]);
            // `e.g. roughly` / `Mr. smith`: a period followed by a lowercase word does not count as a sentence end either.
            let followed_by_lowercase = chars[end..]
                .iter()
                .find(|ch| !ch.is_whitespace())
                .is_some_and(|ch| ch.is_ascii_lowercase());
            if ascii_dot && (followed_by_text || followed_by_lowercase) {
                i = end;
                continue;
            }
            let sentence: String = chars[start..end].iter().collect();
            let sentence = sentence.trim().to_owned();
            if !sentence.is_empty() {
                out.push(sentence);
            }
            start = end;
            i = end;
            continue;
        }
        i += 1;
    }
    if start < chars.len() {
        let tail: String = chars[start..].iter().collect();
        let tail = tail.trim().to_owned();
        if !tail.is_empty() {
            out.push(tail);
        }
    }
    out
}

fn is_closing_quote(c: char) -> bool {
    matches!(c, '"' | '\'' | '”' | '’' | '」' | '』' | ')' | '）' | '】' | ']')
}

/// The punctuation that truly ends a sentence: full stop, question mark, exclamation mark. The English period `.` has its own abbreviation / decimal checks, which are not here.
const STRONG_END: &[char] = &['。', '｡', '．', '！', '？', '!', '?'];
const OPEN_MARKS: &[char] = &['“', '‘', '「', '『', '（', '(', '【', '[', '《', '〈'];
const CLOSE_MARKS: &[char] = &['”', '’', '」', '』', '）', ')', '】', ']', '》', '〉'];
/// Common English abbreviations after which a period does not end a sentence (compared in lowercase).
const ABBREVIATIONS: &[&str] = &[
    "mr", "mrs", "ms", "dr", "prof", "st", "jr", "sr", "vs", "etc", "no", "inc", "ltd", "co", "mt", "fig", "approx",
];

/// Counts how many sentences are spoken: a sentence ends at a full stop, question mark or exclamation mark; returns each sentence in order (the narration list rule: “一句一条”, one sentence per entry).
///
/// Used only as a reminder, so it errs on the side of undercounting rather than overcounting. Its criteria differ from [`split_sentences`], which is used for chunking (that one decides the synthesized audio, and is not changed here), and it is stricter than the sentences in the alignment result (picture anchors, which are additionally split at `；` and `…`):
/// - Ellipses (`…`, two or more dots) do not end a sentence: “嗯……好吧。” is one sentence;
/// - A sentence end inside quotes or brackets does not count: “他问：“你去哪？”她没回答。” is one sentence;
/// - An English period followed by a non-whitespace character (`3.14`, `U.S.`), followed by a lowercase word, preceded by a single capital letter (`J. K.`), or a common abbreviation (`Mr.`, `etc.`) does not count;
/// - When only punctuation or whitespace remains after a sentence end, it does not start a new sentence.
pub fn spoken_sentences(text: &str) -> Vec<String> {
    let chars: Vec<char> = text.chars().collect();
    let mut cuts = Vec::new();
    let mut depth = 0usize;
    // A straight double quote opens and closes with the same character, so there is no separate record of whether one is open.
    let mut straight = false;
    let mut i = 0usize;
    while i < chars.len() {
        let c = chars[i];
        if c == '"' {
            straight = !straight;
        } else if OPEN_MARKS.contains(&c) {
            depth += 1;
        } else if CLOSE_MARKS.contains(&c) {
            // The `’` in `don’t` is an apostrophe, not a closing quote.
            if !(c == '’' && is_apostrophe(&chars, i)) {
                depth = depth.saturating_sub(1);
            }
        } else if STRONG_END.contains(&c) || c == '.' || c == '…' {
            let mut end = i + 1;
            while end < chars.len() && (STRONG_END.contains(&chars[end]) || matches!(chars[end], '.' | '…')) {
                end += 1;
            }
            if depth == 0 && !straight && closes_sentence(&chars, i, end) {
                cuts.push(end);
            }
            i = end;
            continue;
        }
        i += 1;
    }

    let mut out: Vec<String> = Vec::new();
    let mut pending = String::new();
    let mut start = 0usize;
    for end in cuts.into_iter().chain(std::iter::once(chars.len())) {
        let piece: String = chars[start..end].iter().collect();
        start = end;
        let piece = piece.trim();
        if piece.is_empty() {
            continue;
        }
        // A segment that is only punctuation (a closing quote after the sentence end, or stray symbols) is merged back into the previous sentence.
        if !piece.chars().any(char::is_alphanumeric) {
            match out.last_mut() {
                Some(last) => last.push_str(piece),
                None => pending.push_str(piece),
            }
            continue;
        }
        out.push(format!("{}{piece}", std::mem::take(&mut pending)));
    }
    if !pending.is_empty() {
        out.push(pending);
    }
    out
}

fn is_apostrophe(chars: &[char], at: usize) -> bool {
    let before = at.checked_sub(1).and_then(|i| chars.get(i));
    let after = chars.get(at + 1);
    before.is_some_and(char::is_ascii_alphabetic) && after.is_some_and(char::is_ascii_alphabetic)
}

/// `chars[start..end]` is a run of consecutive sentence-final marks / ellipses; whether it ends a sentence.
fn closes_sentence(chars: &[char], start: usize, end: usize) -> bool {
    let run = &chars[start..end];
    if run.iter().any(|c| STRONG_END.contains(c)) {
        return true;
    }
    if run.contains(&'…') || run.len() >= 2 {
        return false;
    }
    // Only a single English period remains.
    if chars.get(end).is_some_and(|c| !c.is_whitespace() && !is_cjk(*c)) {
        return false;
    }
    if chars[end..]
        .iter()
        .find(|c| !c.is_whitespace())
        .is_some_and(char::is_ascii_lowercase)
    {
        return false;
    }
    let word: String = chars[..start]
        .iter()
        .rev()
        .take_while(|c| c.is_ascii_alphabetic())
        .collect::<Vec<_>>()
        .into_iter()
        .rev()
        .collect();
    let initial = word.len() == 1 && word.chars().all(|c| c.is_ascii_uppercase());
    !(initial || ABBREVIATIONS.contains(&word.to_ascii_lowercase().as_str()))
}

/// An overly long single sentence: first split at clause punctuation, then hard-cut at the budget.
fn split_long_sentence(sentence: &str, max_units: usize) -> Vec<String> {
    let chars: Vec<char> = sentence.chars().collect();
    let mut pieces: Vec<String> = Vec::new();
    let mut start = 0usize;
    for (i, c) in chars.iter().enumerate() {
        if CLAUSE_END.contains(c) {
            let piece: String = chars[start..=i].iter().collect();
            let piece = piece.trim().to_owned();
            if !piece.is_empty() {
                pieces.push(piece);
            }
            start = i + 1;
        }
    }
    if start < chars.len() {
        let tail: String = chars[start..].iter().collect();
        let tail = tail.trim().to_owned();
        if !tail.is_empty() {
            pieces.push(tail);
        }
    }
    // Joins clauses back into chunks that do not exceed the budget; a single clause that is still too long is hard-cut by units.
    let mut out = Vec::new();
    let mut current = String::new();
    let mut units = 0usize;
    for piece in pieces {
        let piece_units = count_units(&piece);
        if piece_units > max_units {
            flush(&mut out, &mut current, &mut units);
            out.extend(hard_split(&piece, max_units));
            continue;
        }
        if units + piece_units > max_units && units > 0 {
            flush(&mut out, &mut current, &mut units);
        }
        if !current.is_empty() && needs_space(&current, &piece) {
            current.push(' ');
        }
        current.push_str(&piece);
        units += piece_units;
    }
    flush(&mut out, &mut current, &mut units);
    out
}

fn hard_split(text: &str, max_units: usize) -> Vec<String> {
    let mut out = Vec::new();
    let mut current = String::new();
    let mut units = 0usize;
    for token in tokens(text) {
        let token_units = if token.chars().all(is_cjk) { token.chars().count() } else { 1 };
        if units + token_units > max_units && units > 0 {
            flush(&mut out, &mut current, &mut units);
        }
        if token.chars().all(is_cjk) {
            // CJK runs are split character by character, ensuring no single chunk exceeds the budget.
            for ch in token.chars() {
                if units >= max_units {
                    flush(&mut out, &mut current, &mut units);
                }
                current.push(ch);
                units += 1;
            }
        } else {
            if !current.is_empty() && needs_space(&current, token) {
                current.push(' ');
            }
            current.push_str(token);
            units += 1;
        }
    }
    flush(&mut out, &mut current, &mut units);
    out
}

/// Splits into two kinds of tokens: “CJK runs” and “non-CJK words”.
fn tokens(text: &str) -> Vec<&str> {
    let mut out = Vec::new();
    let mut start: Option<usize> = None;
    let mut cjk_run = false;
    for (idx, ch) in text.char_indices() {
        if ch.is_whitespace() {
            if let Some(s) = start.take() {
                out.push(&text[s..idx]);
            }
            continue;
        }
        let this_cjk = is_cjk(ch);
        match start {
            None => {
                start = Some(idx);
                cjk_run = this_cjk;
            }
            Some(s) if this_cjk != cjk_run => {
                out.push(&text[s..idx]);
                start = Some(idx);
                cjk_run = this_cjk;
            }
            Some(_) => {}
        }
    }
    if let Some(s) = start {
        out.push(&text[s..]);
    }
    out
}

/// Unit count: each CJK character counts as 1, and each other space-separated word counts as 1. Punctuation is not counted.
pub fn count_units(text: &str) -> usize {
    let mut units = 0usize;
    let mut in_word = false;
    for ch in text.chars() {
        if is_cjk(ch) {
            units += 1;
            in_word = false;
        } else if ch.is_alphanumeric() {
            if !in_word {
                units += 1;
                in_word = true;
            }
        } else {
            in_word = false;
        }
    }
    units
}

pub fn is_cjk(c: char) -> bool {
    matches!(c as u32,
        0x3040..=0x30FF | // Hiragana / katakana
        0x3400..=0x4DBF | 0x4E00..=0x9FFF | 0xF900..=0xFAFF | // CJK Unified Ideographs
        0xAC00..=0xD7AF | // Hangul syllables
        0x20000..=0x2FA1F
    )
}

/// Determines the main language of the text (for automatic selection of the Qwen3-TTS language token); returns `zh`/`ja`/`ko`/`en`.
pub fn guess_language(text: &str) -> &'static str {
    let mut han = 0usize;
    let mut kana = 0usize;
    let mut hangul = 0usize;
    let mut latin = 0usize;
    for c in text.chars() {
        match c as u32 {
            0x3040..=0x30FF => kana += 1,
            0xAC00..=0xD7AF => hangul += 1,
            0x3400..=0x4DBF | 0x4E00..=0x9FFF | 0xF900..=0xFAFF | 0x20000..=0x2FA1F => han += 1,
            _ if c.is_ascii_alphabetic() => latin += 1,
            _ => {}
        }
    }
    if kana > 0 && kana * 4 >= han {
        "ja"
    } else if hangul > 0 && hangul >= han {
        "ko"
    } else if han > 0 && han * 2 >= latin {
        "zh"
    } else {
        "en"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn short_text_is_one_chunk() {
        assert_eq!(chunk("你好，世界。", 60), vec!["你好，世界。"]);
        assert_eq!(chunk("  Hello world.  ", 60), vec!["Hello world."]);
        assert!(chunk("   ", 60).is_empty());
    }

    #[test]
    fn splits_chinese_on_sentence_punctuation() {
        let text = "第一句话有一些内容在这里。第二句话也有一些内容在这里！第三句话呢？第四句。";
        let chunks = chunk(text, 20);
        assert_eq!(chunks.len(), 2, "{chunks:?}");
        assert_eq!(chunks[0], "第一句话有一些内容在这里。");
        // “第三句话呢？” still fits; “第四句。” is a trailing fragment and is merged back into the previous chunk.
        assert_eq!(chunks[1], "第二句话也有一些内容在这里！第三句话呢？第四句。");
        let sentences = split_sentences(text);
        assert_eq!(sentences.len(), 4);
        assert_eq!(sentences[2], "第三句话呢？");
    }

    #[test]
    fn english_sentences_keep_abbreviations_and_numbers() {
        let sentences = split_sentences("Pi is 3.14 e.g. roughly. Next sentence here!");
        assert_eq!(sentences, vec!["Pi is 3.14 e.g. roughly.", "Next sentence here!"]);
    }

    #[test]
    fn long_sentence_falls_back_to_clauses_then_hard_split() {
        let text = "这是一个非常长的句子，它没有句号，只有逗号，一直在说一直在说，说个不停，还在说，继续说，再说一点，最后终于结束了";
        let chunks = chunk(text, 12);
        assert!(chunks.len() >= 3, "{chunks:?}");
        for c in &chunks {
            assert!(count_units(c) <= 12 + MIN_UNITS, "{c}");
        }
        let joined: String = chunks.concat();
        assert_eq!(joined, text.replace(' ', ""));
        let no_punct = "一".repeat(40);
        let hard = chunk(&no_punct, 16);
        assert_eq!(hard.len(), 3);
        assert_eq!(hard[0].chars().count(), 16);
    }

    #[test]
    fn tiny_tail_merges_into_previous_chunk() {
        let text = "One two three four five six seven eight nine ten eleven. Ok then.";
        let chunks = chunk(text, 12);
        assert_eq!(chunks, vec![text]);
    }

    #[test]
    fn paragraphs_are_always_boundaries() {
        let chunks = chunk("一段。\n\n二段。", 60);
        assert_eq!(chunks, vec!["一段。", "二段。"]);
    }

    #[test]
    fn breaks_follow_sentence_ends_and_paragraphs() {
        let text = "第一句话说得比较长一点，凑够字数。第二句也不短，继续凑够这一块的字数。\n\
                    这一句没有句末标点却非常非常长，长到一块装不下，只好在逗号处断开，然后再接着往下说，一直说到这里才停下来，\
                    后面还跟着一句话。「引号里的一句。」\r\n最后一段。";
        let chunks = chunk_with_breaks(text, 20);
        // The splitting is identical, character for character, to `chunk`.
        assert_eq!(
            chunks.iter().map(|c| c.text.clone()).collect::<Vec<_>>(),
            chunk(text, 20),
            "{chunks:#?}"
        );
        let breaks: Vec<ChunkBreak> = chunks.iter().map(|c| c.after).collect();
        // A paragraph's last chunk is Paragraph; a chunk ending with sentence-final punctuation (including a closing quote after it) is Sentence; one broken at a comma is Clause.
        for chunk in &chunks {
            let expected = if chunk.text.ends_with("凑够这一块的字数。") || chunk.text == "最后一段。" || chunk.text.ends_with("」")
            {
                ChunkBreak::Paragraph
            } else if chunk.text.ends_with('。') {
                ChunkBreak::Sentence
            } else {
                ChunkBreak::Clause
            };
            assert_eq!(chunk.after, expected, "{chunks:#?}");
        }
        assert!(
            breaks.contains(&ChunkBreak::Sentence) && breaks.contains(&ChunkBreak::Clause),
            "{chunks:#?}"
        );
        assert_eq!(breaks.iter().filter(|b| **b == ChunkBreak::Paragraph).count(), 3);
        assert!(ends_sentence("他说：“走吧。”") && ends_sentence("Done!) ") && !ends_sentence("然后，"));
        assert!(chunk_with_breaks(" \n\n ", 20).is_empty());
    }

    #[test]
    fn unit_counting_mixes_scripts() {
        assert_eq!(count_units("你好 world"), 3);
        assert_eq!(count_units("hello, world!"), 2);
        assert_eq!(count_units("日本語のテスト"), 7);
    }

    #[test]
    fn guesses_language() {
        assert_eq!(guess_language("你好世界"), "zh");
        assert_eq!(guess_language("Hello there"), "en");
        assert_eq!(guess_language("こんにちは世界"), "ja");
        assert_eq!(guess_language("안녕하세요"), "ko");
        assert_eq!(guess_language("CucCut 是一个视频工具"), "zh");
    }

    fn spoken(text: &str) -> usize {
        spoken_sentences(text).len()
    }

    /// Two entries written into the list from a fresh Agent live run on 2026-09-24: two sentences each; four chunks held six sentences.
    #[test]
    fn two_sentences_in_one_entry_are_counted() {
        assert_eq!(
            spoken_sentences("看这句话：小猫趴在垫子上，因为它很暖。这里的‘它’，指的是谁？"),
            vec!["看这句话：小猫趴在垫子上，因为它很暖。", "这里的‘它’，指的是谁？"]
        );
        assert_eq!(spoken("分数越高，信息的权重越大。把这些信息加权汇总，这个词就理解了上下文。"), 2);
        assert_eq!(spoken("注意力机制，让每个词都去看看其他词。"), 1);
        assert_eq!(spoken("こんにちは。元気ですか？"), 2);
        assert_eq!(spoken("I don’t know. Maybe tomorrow!"), 2);
        assert_eq!(spoken("It costs $3. That is cheap."), 2);
    }

    #[test]
    fn ellipses_and_stacked_marks_do_not_start_a_sentence() {
        assert_eq!(spoken("嗯……好吧。"), 1);
        assert_eq!(spoken("从前有个放羊的孩子……"), 1);
        assert_eq!(spoken("真的吗？！"), 1);
        assert_eq!(spoken("Wait... what?"), 1);
        assert_eq!(spoken("Really?!"), 1);
        assert_eq!(spoken("没有句末标点"), 1);
        assert!(spoken_sentences("  ").is_empty());
    }

    #[test]
    fn quoted_and_bracketed_ends_stay_inside_the_sentence() {
        assert_eq!(spoken("他问：“你去哪？”她没回答。"), 1);
        assert_eq!(spoken("他说：“你好。”"), 1);
        assert_eq!(spoken("书名是「三体。」很好看。"), 1);
        assert_eq!(spoken("注意（见图 1。）这里。"), 1);
        assert_eq!(spoken("He said \"Stop. Now.\" and left."), 1);
        assert_eq!(spoken("“I don’t know. Maybe,” she said."), 1);
        // Only a closing quote remains after the sentence end: merged into the previous sentence, not started anew.
        assert_eq!(spoken_sentences("好了。”"), vec!["好了。”"]);
        // Book-title marks (《》) do not block a sentence end: the two sentences each end on their own.
        assert_eq!(spoken("这是《三体》。那是《球状闪电》。"), 2);
    }

    #[test]
    fn english_dots_in_numbers_and_abbreviations_do_not_split() {
        assert_eq!(spoken("圆周率约等于 3.14。"), 1);
        assert_eq!(spoken("我们用 Node.js 写服务。"), 1);
        assert_eq!(spoken("Pi is 3.14 e.g. roughly."), 1);
        assert_eq!(spoken("Dr. Smith arrived at 3.30 p.m. yesterday."), 1);
        assert_eq!(spoken("J. K. Rowling wrote it."), 1);
        assert_eq!(spoken("Apples, pears, etc. Also plums."), 1);
        assert_eq!(spoken("The U.S. is large."), 1);
    }

    /// The chunking criteria do not change with sentence counting: `…` is still a sentence end for chunking.
    #[test]
    fn chunking_still_splits_on_ellipsis() {
        assert_eq!(split_sentences("嗯……好吧。"), vec!["嗯……", "好吧。"]);
    }
}
