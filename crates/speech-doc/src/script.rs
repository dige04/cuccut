//! Script reading for `ccut transcribe --script`: four shapes (plain text / LRC / SRT·VTT / JSON), plus derivation of the time window of the audio that each line falls in.
//!
//! Pure functions with no I/O. The caller reads the file, gives a format hint from the extension, gets the lines, then aligns them.
//!
//! - **Plain text**: split by line, then within each line by sentence-final punctuation (see [`split_plain`]). Lines that consist entirely of a bracketed marker such as `[Chorus]` are section labels, not lyrics, and are dropped.
//! - **LRC**: `[mm:ss.xx]` line timestamps. Several timestamps on one line (a reused chorus) each count as a separate line. `[offset:±ms]` takes effect. A blank line containing only timestamps marks the end of the previous line. The `<mm:ss.xx>` word tags of enhanced LRC give per-word timing.
//! - **SRT / WebVTT**: the start and end of a cue are the line window. Multi-line bodies are merged into one line. Tags such as `<i>` and `{\an8}` are stripped.
//! - **JSON**: a top-level array, or a `lines` / `segments` / `cues` array. Each item is either a string (no timing) or `{text, start, end, words?}` (`t0`/`t1` are synonyms; the word text key is `text` or `word`).
//!
//! [`resolve_windows`] fills in the line windows. A line with a start but no end takes the next line's start. Consecutive untimed lines split the gap between the surrounding known times evenly by character count. Plain text with no timing at all can borrow words from an existing transcript as anchors ([`anchor_windows`]): script words are matched to transcript words by word-order LCS, and each line takes the times of the matched words.

use std::collections::HashMap;

use serde_json::Value;

use crate::atomize::{is_cjk_char, unspaced_pair};
use crate::lcs::{LCS_CELL_CAP, lcs_matches};

/// Script format.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ScriptFormat {
    Text,
    Lrc,
    Srt,
    Json,
}

impl ScriptFormat {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Text => "text",
            Self::Lrc => "lrc",
            Self::Srt => "srt",
            Self::Json => "json",
        }
    }

    /// Determines the format from the extension. An unrecognized extension returns `None`, and [`detect`] sniffs the content instead.
    pub fn from_extension(extension: &str) -> Option<Self> {
        match extension.to_ascii_lowercase().as_str() {
            "lrc" => Some(Self::Lrc),
            "srt" | "vtt" => Some(Self::Srt),
            "json" => Some(Self::Json),
            "txt" | "md" => Some(Self::Text),
            _ => None,
        }
    }
}

/// A timed word (seconds).
#[derive(Debug, Clone, PartialEq)]
pub struct TimedWord {
    pub start: f64,
    pub end: f64,
    pub text: String,
}

/// One script line: its text, an optional line window, and optional per-word times.
#[derive(Debug, Clone, PartialEq)]
pub struct ScriptLine {
    pub text: String,
    pub start: Option<f64>,
    pub end: Option<f64>,
    pub words: Option<Vec<TimedWord>>,
}

impl ScriptLine {
    fn plain(text: impl Into<String>) -> Self {
        Self {
            text: text.into(),
            start: None,
            end: None,
            words: None,
        }
    }
}

/// The extension takes priority. If it is not recognized, look at the content: JSON-looking content is JSON, content containing `-->` is SRT / VTT, lines starting with a `[mm:ss` tag are LRC, and anything else is plain text.
pub fn detect(text: &str, extension: Option<&str>) -> ScriptFormat {
    if let Some(format) = extension.and_then(ScriptFormat::from_extension) {
        return format;
    }
    let trimmed = text.trim_start_matches('\u{feff}').trim_start();
    if (trimmed.starts_with('{') || trimmed.starts_with('['))
        && serde_json::from_str::<Value>(trimmed).is_ok()
    {
        return ScriptFormat::Json;
    }
    if text.lines().any(|line| line.contains("-->")) {
        return ScriptFormat::Srt;
    }
    if text
        .lines()
        .any(|line| parse_lrc_time_tag(line.trim_start()).is_some())
    {
        return ScriptFormat::Lrc;
    }
    ScriptFormat::Text
}

/// Parses into lines by format. An empty script returns an empty `Vec` (the caller reports the error). A malformed format returns `Err`.
pub fn parse(text: &str, format: ScriptFormat) -> Result<Vec<ScriptLine>, String> {
    let text = text.trim_start_matches('\u{feff}');
    match format {
        ScriptFormat::Text => Ok(split_plain(text)
            .into_iter()
            .map(ScriptLine::plain)
            .collect()),
        ScriptFormat::Lrc => Ok(parse_lrc(text)),
        ScriptFormat::Srt => Ok(parse_srt(text)),
        ScriptFormat::Json => parse_json(text),
    }
}

/// A script that looks like lyrics or verse, with at least this many lines...
const VERSE_MIN_LINES: usize = 4;
/// ...and at least 4/5 of its lines no wider than this display width (CJK counts as 2): in that case a line is one segment, and it is not split again at sentence-final punctuation.
const VERSE_LINE_WIDTH: usize = 60;

/// Script to lines: split by newline, then within each line by sentence-final punctuation. ASCII `. ! ? ;` count as sentence-final only when followed by whitespace or the end of the line, so `3.5` is not split. Abbreviations such as `Dr. Li` do get split, but that affects only line boundaries, not words. Empty lines and whole-line bracketed markers (`[Chorus]`, `[Verse 1]`) are discarded. When the whole script consists of short lines (lyrics, poems), sentences are not split within a line: `What did Ilya see? We'll never know.` is one lyric line, not two lines of dialogue.
pub fn split_plain(text: &str) -> Vec<String> {
    let raw_lines: Vec<&str> = text
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty() && !is_section_tag(line))
        .collect();
    let short = raw_lines
        .iter()
        .filter(|line| display_width(line) <= VERSE_LINE_WIDTH)
        .count();
    if raw_lines.len() >= VERSE_MIN_LINES && short * 5 >= raw_lines.len() * 4 {
        return raw_lines.into_iter().map(str::to_owned).collect();
    }
    let mut lines = Vec::new();
    for line in raw_lines {
        let chars: Vec<char> = line.chars().collect();
        let mut current = String::new();
        for (index, ch) in chars.iter().enumerate() {
            current.push(*ch);
            let next_blank = chars.get(index + 1).is_none_or(|next| next.is_whitespace());
            let terminal = matches!(ch, '。' | '！' | '？' | '；')
                || (matches!(ch, '.' | '!' | '?' | ';') && next_blank);
            if terminal {
                let piece = current.trim();
                if !piece.is_empty() {
                    lines.push(piece.to_owned());
                }
                current.clear();
            }
        }
        let piece = current.trim();
        if !piece.is_empty() {
            lines.push(piece.to_owned());
        }
    }
    lines
}

fn display_width(line: &str) -> usize {
    line.chars()
        .map(|c| if is_cjk_char(c) { 2 } else { 1 })
        .sum()
}

/// The whole line is inside one pair of square brackets (a section marker from a lyrics site).
fn is_section_tag(line: &str) -> bool {
    line.starts_with('[') && line.ends_with(']') && line[1..line.len() - 1].find(']').is_none()
}

// ---------------------------------------------------------------- LRC

/// A leading `[mm:ss]` / `[mm:ss.xx]` / `[mm:ss:xx]` tag at the start of a line: returns the seconds and the remaining text after the tag.
fn parse_lrc_time_tag(line: &str) -> Option<(f64, &str)> {
    let rest = line.strip_prefix('[')?;
    let close = rest.find(']')?;
    let seconds = parse_clock(&rest[..close])?;
    Some((seconds, &rest[close + 1..]))
}

/// `mm:ss(.xx)`. Also accepts `hh:mm:ss(.xx)` and `mm:ss:xx` (some LRC editors write a colon as the decimal separator).
fn parse_clock(text: &str) -> Option<f64> {
    let text = text.trim();
    if text.is_empty()
        || !text
            .chars()
            .all(|c| c.is_ascii_digit() || c == ':' || c == '.')
    {
        return None;
    }
    let parts: Vec<&str> = text.split(':').collect();
    let number = |part: &str| part.parse::<f64>().ok().filter(|value| value.is_finite());
    match parts.as_slice() {
        [minutes, seconds] => Some(number(minutes)? * 60.0 + number(seconds)?),
        [a, b, c] if c.contains('.') || c.len() == 3 => {
            // hh:mm:ss(.xx)
            Some(number(a)? * 3600.0 + number(b)? * 60.0 + number(c)?)
        }
        [minutes, seconds, fraction] => {
            let digits = fraction.len() as i32;
            Some(
                number(minutes)? * 60.0 + number(seconds)? + number(fraction)? / 10f64.powi(digits),
            )
        }
        _ => None,
    }
}

struct LrcEntry {
    time: f64,
    text: String,
    words: Option<Vec<(f64, String)>>,
}

fn parse_lrc(text: &str) -> Vec<ScriptLine> {
    let mut offset = 0.0_f64;
    let mut entries: Vec<LrcEntry> = Vec::new();
    for raw in text.lines() {
        let mut rest = raw.trim();
        let mut times = Vec::new();
        loop {
            if let Some((time, after)) = parse_lrc_time_tag(rest) {
                times.push(time);
                rest = after.trim_start();
                continue;
            }
            // Metadata tags such as `[ti:…]` and `[offset:+120]`.
            if let Some(tag) = rest.strip_prefix('[')
                && let Some(close) = tag.find(']')
                && let Some((key, value)) = tag[..close].split_once(':')
                && key.chars().all(|c| c.is_ascii_alphabetic())
            {
                if key.eq_ignore_ascii_case("offset")
                    && let Ok(ms) = value.trim().parse::<f64>()
                {
                    offset = ms / 1000.0;
                }
                rest = tag[close + 1..].trim_start();
                continue;
            }
            break;
        }
        if times.is_empty() {
            continue;
        }
        let (line_text, words) = lrc_words(rest);
        for time in times {
            entries.push(LrcEntry {
                time,
                text: line_text.clone(),
                words: words.clone(),
            });
        }
    }
    // Stable sort: two lines at the same time keep their order in the file.
    entries.sort_by(|a, b| a.time.total_cmp(&b.time));
    // LRC specifies that a positive offset makes the lyrics appear earlier.
    let shift = |time: f64| round_ms((time - offset).max(0.0));
    let mut lines = Vec::new();
    for (index, entry) in entries.iter().enumerate() {
        if entry.text.is_empty() {
            continue;
        }
        let next = entries.get(index + 1).map(|next| shift(next.time));
        let start = shift(entry.time);
        let words = entry.words.as_ref().map(|words| {
            let mut timed = Vec::with_capacity(words.len());
            for (position, (time, text)) in words.iter().enumerate() {
                let start = shift(*time);
                let end = words
                    .get(position + 1)
                    .map(|(time, _)| shift(*time))
                    .or(next)
                    .unwrap_or(start)
                    .max(start);
                if !text.is_empty() {
                    timed.push(TimedWord {
                        start,
                        end,
                        text: text.clone(),
                    });
                }
            }
            timed
        });
        lines.push(ScriptLine {
            text: entry.text.clone(),
            start: Some(start),
            end: next.filter(|end| *end > start),
            words: words.filter(|words| !words.is_empty()),
        });
    }
    lines
}

/// Enhanced LRC: `<00:12.30>I <00:12.60>see` becomes line text plus (word start, word) pairs. A final `<…>` that has a tag but no text is the end time of the last word, and is recorded as an empty word. When there are no word tags, `words` is `None`.
fn lrc_words(text: &str) -> (String, Option<Vec<(f64, String)>>) {
    if !text.contains('<') {
        return (collapse_spaces(text), None);
    }
    let mut words = Vec::new();
    let mut plain = String::new();
    let mut rest = text;
    let mut current: Option<(f64, String)> = None;
    while let Some(open) = rest.find('<') {
        let before = &rest[..open];
        plain.push_str(before);
        if let Some((_, word)) = current.as_mut() {
            word.push_str(before);
        }
        let after = &rest[open + 1..];
        let Some(close) = after.find('>') else {
            plain.push_str(&rest[open..]);
            rest = "";
            break;
        };
        match parse_clock(&after[..close]) {
            Some(time) => {
                if let Some((start, word)) = current.take() {
                    words.push((start, word.trim().to_owned()));
                }
                current = Some((time, String::new()));
            }
            None => plain.push_str(&rest[open..open + 1 + close + 1]),
        }
        rest = &after[close + 1..];
    }
    plain.push_str(rest);
    if let Some((start, mut word)) = current.take() {
        word.push_str(rest);
        words.push((start, word.trim().to_owned()));
    }
    let text = collapse_spaces(&plain);
    if words.iter().all(|(_, word)| word.is_empty()) {
        return (text, None);
    }
    (text, Some(words))
}

// ---------------------------------------------------------------- SRT / VTT

fn parse_srt(text: &str) -> Vec<ScriptLine> {
    let mut lines = Vec::new();
    let mut block: Vec<&str> = Vec::new();
    for raw in text.lines() {
        let line = raw.trim();
        if line.is_empty() {
            srt_block(&block, &mut lines);
            block.clear();
        } else {
            block.push(line);
        }
    }
    srt_block(&block, &mut lines);
    lines.sort_by(|a, b| a.start.unwrap_or(0.0).total_cmp(&b.start.unwrap_or(0.0)));
    lines
}

/// A block separated by blank lines. The line containing `-->` is the timing line, and the lines after it are the body. Sequence-number lines, `WEBVTT`, and `NOTE` / `STYLE` blocks have no timing line, so the whole block is skipped.
fn srt_block(block: &[&str], lines: &mut Vec<ScriptLine>) {
    let Some(position) = block.iter().position(|line| line.contains("-->")) else {
        return;
    };
    let (from, to) = block[position].split_once("-->").expect("contains -->");
    let start = parse_subtitle_clock(from);
    // VTT cue settings (`align:start` …) follow the end time.
    let end = parse_subtitle_clock(to.split_whitespace().next().unwrap_or(""));
    let body: Vec<String> = block[position + 1..]
        .iter()
        .map(|line| strip_markup(line))
        .filter(|line| !line.is_empty())
        .collect();
    let body = collapse_spaces(&body.join(" "));
    if let (Some(start), Some(end), false) = (start, end, body.is_empty()) {
        lines.push(ScriptLine {
            text: body,
            start: Some(round_ms(start)),
            end: Some(round_ms(end.max(start))),
            words: None,
        });
    }
}

/// `00:01:02,500` / `00:01:02.500` / `01:02.500`。
fn parse_subtitle_clock(text: &str) -> Option<f64> {
    let text = text.trim().replace(',', ".");
    let parts: Vec<&str> = text.split(':').collect();
    let number = |part: &str| part.trim().parse::<f64>().ok().filter(|v| v.is_finite());
    match parts.as_slice() {
        [h, m, s] => Some(number(h)? * 3600.0 + number(m)? * 60.0 + number(s)?),
        [m, s] => Some(number(m)? * 60.0 + number(s)?),
        _ => None,
    }
}

/// Strips HTML/VTT tags such as `<i>`, `<c.color>` and `<00:01.000>`, and ASS overrides such as `{\an8}`.
fn strip_markup(line: &str) -> String {
    let mut out = String::with_capacity(line.len());
    let mut depth_angle = false;
    let mut depth_brace = false;
    for ch in line.chars() {
        match ch {
            '<' => depth_angle = true,
            '>' if depth_angle => depth_angle = false,
            '{' if line.contains("{\\") => depth_brace = true,
            '}' if depth_brace => depth_brace = false,
            _ if depth_angle || depth_brace => {}
            _ => out.push(ch),
        }
    }
    out.trim().to_owned()
}

// ---------------------------------------------------------------- JSON

fn parse_json(text: &str) -> Result<Vec<ScriptLine>, String> {
    let value: Value =
        serde_json::from_str(text).map_err(|error| format!("JSON 文稿解析失败：{error}"))?;
    let items = match &value {
        Value::Array(items) => items,
        Value::Object(map) => ["lines", "segments", "cues"]
            .iter()
            .find_map(|key| map.get(*key).and_then(Value::as_array))
            .ok_or("JSON 文稿要么是数组，要么带 lines / segments / cues 数组")?,
        _ => return Err("JSON 文稿要么是数组，要么带 lines / segments / cues 数组".into()),
    };
    let mut lines = Vec::new();
    for (index, item) in items.iter().enumerate() {
        match item {
            Value::String(text) => {
                let text = collapse_spaces(text);
                if !text.is_empty() {
                    lines.push(ScriptLine::plain(text));
                }
            }
            Value::Object(map) => {
                let text = ["text", "line", "lyric"]
                    .iter()
                    .find_map(|key| map.get(*key).and_then(Value::as_str))
                    .map(collapse_spaces)
                    .unwrap_or_default();
                let words = map
                    .get("words")
                    .and_then(Value::as_array)
                    .and_then(|words| json_words(words));
                let text = if text.is_empty() {
                    words
                        .as_ref()
                        .map(|words| join_words(words.iter().map(|w| w.text.as_str())))
                        .unwrap_or_default()
                } else {
                    text
                };
                if text.is_empty() {
                    continue;
                }
                let start = seconds_of(map, &["start", "t0"]);
                let end = seconds_of(map, &["end", "t1"]);
                if let (Some(start), Some(end)) = (start, end)
                    && end < start
                {
                    return Err(format!("JSON 文稿第 {} 行终点早于起点", index + 1));
                }
                lines.push(ScriptLine {
                    text,
                    start: start.map(round_ms),
                    end: end.map(round_ms),
                    words,
                });
            }
            _ => {
                return Err(format!(
                    "JSON 文稿第 {} 项既不是字符串也不是对象",
                    index + 1
                ));
            }
        }
    }
    Ok(lines)
}

fn seconds_of(map: &serde_json::Map<String, Value>, keys: &[&str]) -> Option<f64> {
    keys.iter()
        .find_map(|key| map.get(*key).and_then(Value::as_f64))
        .filter(|value| value.is_finite() && *value >= 0.0)
}

/// A word counts only if it has both a start and an end. If one is missing, the whole line gets no per-word timing and is left to the aligner.
fn json_words(words: &[Value]) -> Option<Vec<TimedWord>> {
    let mut out = Vec::with_capacity(words.len());
    for word in words {
        let map = word.as_object()?;
        let text = ["text", "word"]
            .iter()
            .find_map(|key| map.get(*key).and_then(Value::as_str))?
            .trim()
            .to_owned();
        let start = seconds_of(map, &["start", "t0"])?;
        let end = seconds_of(map, &["end", "t1"])?.max(start);
        if !text.is_empty() {
            out.push(TimedWord {
                start: round_ms(start),
                end: round_ms(end),
                text,
            });
        }
    }
    (!out.is_empty()).then_some(out)
}

// ---------------------------------------------------------------- line windows

/// Fills in `(start, end)` for every line:
///
/// - A line with a start but no end takes the next known time (the next line's start). If there is none, it takes `duration`.
/// - A line with no start: a run of consecutive untimed lines splits the gap between the previous known end and the next known start evenly by character count. If neither side has a time, the gap runs from 0 to `duration`.
///
/// The result is non-decreasing and lies within `[0, duration]`; each end is no earlier than its start.
pub fn resolve_windows(lines: &[ScriptLine], duration: f64) -> Vec<(f64, f64)> {
    let duration = duration.max(0.0);
    let count = lines.len();
    let mut windows: Vec<Option<(f64, f64)>> = vec![None; count];
    for index in 0..count {
        let Some(start) = lines[index].start else {
            continue;
        };
        let start = start.clamp(0.0, duration);
        let next_start = lines[index + 1..]
            .iter()
            .find_map(|line| line.start)
            .map(|next| next.clamp(start, duration));
        let end = lines[index]
            .end
            .or(next_start)
            .unwrap_or(duration)
            .clamp(start, duration);
        windows[index] = Some((start, end));
    }
    let weight = |line: &ScriptLine| {
        line.text
            .chars()
            .filter(|c| !c.is_whitespace())
            .count()
            .max(1) as f64
    };
    let mut index = 0;
    while index < count {
        if windows[index].is_some() {
            index += 1;
            continue;
        }
        let mut run_end = index;
        while run_end < count && windows[run_end].is_none() {
            run_end += 1;
        }
        let gap_start = if index == 0 {
            0.0
        } else {
            windows[index - 1].map_or(0.0, |(_, end)| end)
        };
        let gap_end = if run_end < count {
            windows[run_end].map_or(duration, |(start, _)| start)
        } else {
            duration
        }
        .max(gap_start);
        let total: f64 = lines[index..run_end].iter().map(weight).sum();
        let mut cursor = gap_start;
        for (offset, line) in lines[index..run_end].iter().enumerate() {
            let next = cursor + (gap_end - gap_start) * weight(line) / total;
            windows[index + offset] = Some((round_ms(cursor), round_ms(next)));
            cursor = next;
        }
        index = run_end;
    }
    let mut previous = 0.0_f64;
    windows
        .into_iter()
        .map(|window| {
            let (start, end) = window.expect("every window filled");
            let start = start.max(previous);
            let end = end.max(start);
            previous = start;
            (start, end)
        })
        .collect()
}

/// Anchors untimed script lines using the words of an existing transcript.
#[derive(Debug, Clone, PartialEq)]
pub struct AnchorOutcome {
    /// `(start, end)` for each line. A line that matched no word is `None` (left to [`resolve_windows`] to split evenly).
    pub windows: Vec<Option<(f64, f64)>>,
    /// Share of script words that matched transcript words.
    pub matched: f64,
}

/// Unmatched words at the start or end of a line are estimated at no less than this many seconds per word...
const MISSING_WORD_MIN: f64 = 0.35;
/// ...long words are estimated by character count (sung slower than spoken)...
const MISSING_WORD_PER_CHAR: f64 = 0.09;
/// ...and then widened by this factor. Wider windows are better than narrow ones: the aligner can find the right position within a window, whereas words outside the window can only be squeezed into the edge.
const MISSING_SLACK: f64 = 1.5;

/// Script lines × transcript words: normalized to tokens (lowercased, punctuation stripped, CJK one character per token), aligned by LCS in word order, and each line takes the time range of its matched words. Stray outlier matches (the `my` / `the` of a chorus matched somewhere else) are discarded by keeping the cluster near the median.
///
/// When the first few words of a line are unmatched (recognition missed them or misheard them), those words are sung **before** the first matched word. The window start is pushed earlier by their estimated duration into the gap between lines, but no earlier than the end of the previous line's match. The same applies at the end of the line: it is pushed later, but no later than the start of the next line. Otherwise those words would be squeezed into the alignment margin, become words lasting tens of milliseconds, and the whole line would lag behind.
pub fn anchor_windows(lines: &[String], anchors: &[TimedWord]) -> AnchorOutcome {
    let mut vocabulary: HashMap<String, u32> = HashMap::new();
    let mut intern = |token: String| -> u32 {
        let next = vocabulary.len() as u32;
        *vocabulary.entry(token).or_insert(next)
    };
    let mut script_tokens: Vec<u32> = Vec::new();
    let mut script_line: Vec<usize> = Vec::new();
    let mut script_pos: Vec<usize> = Vec::new();
    // Estimated duration per token of each line (seconds), used to estimate windows for unmatched leading and trailing words.
    let mut line_estimates: Vec<Vec<f64>> = vec![Vec::new(); lines.len()];
    for (index, line) in lines.iter().enumerate() {
        for (pos, token) in tokens(line).into_iter().enumerate() {
            let chars = token.chars().count() as f64;
            line_estimates[index].push((chars * MISSING_WORD_PER_CHAR).max(MISSING_WORD_MIN));
            script_tokens.push(intern(token));
            script_line.push(index);
            script_pos.push(pos);
        }
    }
    let mut anchor_tokens: Vec<u32> = Vec::new();
    let mut anchor_time: Vec<(f64, f64)> = Vec::new();
    for word in anchors {
        for token in tokens(&word.text) {
            anchor_tokens.push(intern(token));
            anchor_time.push((word.start, word.end.max(word.start)));
        }
    }
    let empty = AnchorOutcome {
        windows: vec![None; lines.len()],
        matched: 0.0,
    };
    if script_tokens.is_empty() || anchor_tokens.is_empty() {
        return empty;
    }
    let Some(pairs) = lcs_matches(&script_tokens, &anchor_tokens, LCS_CELL_CAP) else {
        return empty;
    };
    // (start, end, token index within the line)
    let mut per_line: Vec<Vec<(f64, f64, usize)>> = vec![Vec::new(); lines.len()];
    for (script_index, anchor_index) in &pairs {
        let (start, end) = anchor_time[*anchor_index];
        per_line[script_line[*script_index]].push((start, end, script_pos[*script_index]));
    }
    // The matched range, plus the estimated durations of the unmatched leading and trailing words.
    let matched_spans: Vec<Option<(f64, f64, f64, f64)>> = per_line
        .iter()
        .zip(&line_estimates)
        .map(|(times, estimates)| {
            if times.is_empty() {
                return None;
            }
            let mut starts: Vec<f64> = times.iter().map(|(start, _, _)| *start).collect();
            starts.sort_by(f64::total_cmp);
            let median = starts[starts.len() / 2];
            // A line cannot last long: a radius beyond 0.8 s per word, with a minimum of 4 s, counts as an outlier.
            let radius = (estimates.len() as f64 * 0.8).max(4.0);
            let kept: Vec<&(f64, f64, usize)> = times
                .iter()
                .filter(|(start, _, _)| (start - median).abs() <= radius)
                .collect();
            let start = kept
                .iter()
                .map(|(start, _, _)| *start)
                .fold(f64::INFINITY, f64::min);
            let end = kept
                .iter()
                .map(|(_, end, _)| *end)
                .fold(f64::NEG_INFINITY, f64::max);
            let first = kept.iter().map(|(_, _, pos)| *pos).min().unwrap_or(0);
            let last = kept.iter().map(|(_, _, pos)| *pos).max().unwrap_or(0);
            let lead: f64 = estimates[..first].iter().sum();
            let tail: f64 = estimates[last + 1..].iter().sum();
            Some((
                start,
                end.max(start),
                lead * MISSING_SLACK,
                tail * MISSING_SLACK,
            ))
        })
        .collect();
    let known: Vec<usize> = (0..lines.len())
        .filter(|index| matched_spans[*index].is_some())
        .collect();
    let mut windows: Vec<Option<(f64, f64)>> = vec![None; lines.len()];
    for (order, index) in known.iter().enumerate() {
        let (start, end, lead, tail) = matched_spans[*index].expect("known");
        let floor = order
            .checked_sub(1)
            .and_then(|previous| matched_spans[known[previous]])
            .map_or(0.0, |(_, previous_end, _, _)| previous_end);
        let ceiling = known
            .get(order + 1)
            .and_then(|next| matched_spans[*next])
            .map_or(f64::INFINITY, |(next_start, _, _, _)| next_start);
        let widened_start = (start - lead).max(floor).min(start);
        let widened_end = (end + tail).min(ceiling).max(end);
        windows[*index] = Some((widened_start, widened_end));
    }
    // When two lines both place their words in the same gap, split the gap between them so that the windows do not overlap.
    for pair in known.windows(2) {
        let (Some((_, previous_end)), Some((next_start, _))) = (windows[pair[0]], windows[pair[1]])
        else {
            continue;
        };
        if previous_end > next_start {
            let middle = (previous_end + next_start) / 2.0;
            let previous_floor = matched_spans[pair[0]].map_or(middle, |span| span.1);
            let next_ceiling = matched_spans[pair[1]].map_or(middle, |span| span.0);
            if let Some(window) = windows[pair[0]].as_mut() {
                window.1 = middle.max(previous_floor);
            }
            if let Some(window) = windows[pair[1]].as_mut() {
                window.0 = middle.min(next_ceiling);
            }
        }
    }
    let windows = windows
        .into_iter()
        .map(|window| window.map(|(start, end)| (round_ms(start), round_ms(end.max(start)))))
        .collect();
    AnchorOutcome {
        windows,
        matched: pairs.len() as f64 / script_tokens.len() as f64,
    }
}

/// Tokens for matching: lowercased. Anything other than letters and digits is a separator. Each CJK character is its own token.
fn tokens(text: &str) -> Vec<String> {
    let mut out = Vec::new();
    let mut current = String::new();
    for ch in text.chars() {
        if is_cjk_char(ch) {
            if !current.is_empty() {
                out.push(std::mem::take(&mut current));
            }
            out.push(ch.to_string());
        } else if ch.is_alphanumeric() {
            current.extend(ch.to_lowercase());
        } else if ch == '\'' || ch == '’' {
            // `that's` and `don't` are often transcribed as `thats` or split apart in transcripts; they are merged into one token.
        } else if !current.is_empty() {
            out.push(std::mem::take(&mut current));
        }
    }
    if !current.is_empty() {
        out.push(current);
    }
    out
}

fn collapse_spaces(text: &str) -> String {
    text.split_whitespace().collect::<Vec<_>>().join(" ")
}

/// Joins words back into line text. No space is added where both sides are scripts without spaces between words (Han / kana). Korean words are eojeol, so spaces are added between them.
pub fn join_words<'a>(words: impl Iterator<Item = &'a str>) -> String {
    let mut out = String::new();
    for word in words {
        let word = word.trim();
        if word.is_empty() {
            continue;
        }
        let glue = match (out.chars().last(), word.chars().next()) {
            (Some(prev), Some(next)) => {
                !(is_cjk_char(prev) && is_cjk_char(next) && unspaced_pair(prev, next))
            }
            _ => false,
        };
        if glue {
            out.push(' ');
        }
        out.push_str(word);
    }
    out
}

fn round_ms(seconds: f64) -> f64 {
    (seconds * 1000.0).round() / 1000.0
}

#[cfg(test)]
mod tests {
    use super::*;

    fn texts(lines: &[ScriptLine]) -> Vec<&str> {
        lines.iter().map(|line| line.text.as_str()).collect()
    }

    #[test]
    fn join_words_spaces_korean_and_glues_han_and_kana() {
        assert_eq!(
            join_words(["저는", "내일", "샀다."].into_iter()),
            "저는 내일 샀다."
        );
        assert_eq!(join_words(["大", "家", "好"].into_iter()), "大家好");
        assert_eq!(join_words(["い", "い", "天", "気"].into_iter()), "いい天気");
        assert_eq!(join_words(["hello", "world"].into_iter()), "hello world");
    }

    #[test]
    fn plain_text_splits_sentences_and_drops_section_tags() {
        let lines = split_plain(
            "[Verse 1]\nDraw the sun. Then the tree!\n\n  第一步，收需求。第二步：画图？  \nVersion 3.5 is fine\n[Chorus]\n",
        );
        assert_eq!(
            lines,
            vec![
                "Draw the sun.",
                "Then the tree!",
                "第一步，收需求。",
                "第二步：画图？",
                "Version 3.5 is fine",
            ]
        );
        assert!(split_plain("  \n\t\n").is_empty());
        // For a script of short lines (lyrics), sentence-final punctuation inside a line is not split.
        assert_eq!(
            split_plain(
                "I see sparks\nNo surprise\nWhat did Ilya see? We'll never know.\nWas it all for show?\n"
            ),
            vec![
                "I see sparks",
                "No surprise",
                "What did Ilya see? We'll never know.",
                "Was it all for show?"
            ]
        );
        // Brackets that cover only part of the line's start are not a marker.
        assert_eq!(split_plain("[laughs] okay"), vec!["[laughs] okay"]);
    }

    #[test]
    fn detect_prefers_extension_then_sniffs() {
        assert_eq!(detect("hello", Some("lrc")), ScriptFormat::Lrc);
        assert_eq!(detect("hello", Some("SRT")), ScriptFormat::Srt);
        assert_eq!(detect("[00:01.00]hi", None), ScriptFormat::Lrc);
        assert_eq!(detect("[00:01.00]hi", Some("txt")), ScriptFormat::Text);
        assert_eq!(
            detect("1\n00:00:01,000 --> 00:00:02,000\nhi\n", None),
            ScriptFormat::Srt
        );
        assert_eq!(detect("{\"lines\":[\"hi\"]}", None), ScriptFormat::Json);
        assert_eq!(detect("[Chorus]\nla la", None), ScriptFormat::Text);
        assert_eq!(detect("just words", Some("lyrics")), ScriptFormat::Text);
    }

    #[test]
    fn lrc_lines_take_the_next_tag_as_their_end() {
        let lines = parse(
            "[ti:Song]\n[ar:Someone]\n[00:04.25]I see sparks\n[00:07.85][01:02.00]Your circuits\n[00:09.81]\n[00:10.50]that's no surprise\n",
            ScriptFormat::Lrc,
        )
        .unwrap();
        assert_eq!(
            texts(&lines),
            vec![
                "I see sparks",
                "Your circuits",
                "that's no surprise",
                "Your circuits"
            ]
        );
        assert_eq!(lines[0].start, Some(4.25));
        assert_eq!(lines[0].end, Some(7.85));
        // An empty tag line is the end of the previous line.
        assert_eq!(lines[1].end, Some(9.81));
        assert_eq!(lines[2].end, Some(62.0));
        // The last line has no end and is left to resolve_windows.
        assert_eq!(lines[3].start, Some(62.0));
        assert_eq!(lines[3].end, None);
    }

    #[test]
    fn lrc_offset_and_three_part_clocks() {
        let lines = parse(
            "[offset:+500]\n[00:02:50]one\n[00:04.000]two\n",
            ScriptFormat::Lrc,
        )
        .unwrap();
        assert_eq!(lines[0].start, Some(2.0));
        assert_eq!(lines[1].start, Some(3.5));
        assert_eq!(lines[0].end, Some(3.5));
    }

    #[test]
    fn enhanced_lrc_gives_word_times() {
        let lines = parse(
            "[00:01.00]<00:01.00>I <00:01.40>see <00:01.90>sparks<00:02.60>\n[00:03.00]next\n",
            ScriptFormat::Lrc,
        )
        .unwrap();
        assert_eq!(lines[0].text, "I see sparks");
        let words = lines[0].words.as_ref().unwrap();
        assert_eq!(words.len(), 3);
        assert_eq!((words[0].start, words[0].end), (1.0, 1.4));
        assert_eq!(words[2].text, "sparks");
        assert_eq!((words[2].start, words[2].end), (1.9, 2.6));
        assert!(lines[1].words.is_none());
    }

    #[test]
    fn srt_and_vtt_cues_become_windows() {
        let srt = "1\n00:00:01,000 --> 00:00:02,500\n<i>Hello</i>\nthere\n\n2\n00:00:03,000 --> 00:00:04,000\n{\\an8}Bye\n";
        let lines = parse(srt, ScriptFormat::Srt).unwrap();
        assert_eq!(texts(&lines), vec!["Hello there", "Bye"]);
        assert_eq!((lines[0].start, lines[0].end), (Some(1.0), Some(2.5)));
        let vtt = "WEBVTT\n\nNOTE hi\n\n00:01.000 --> 00:02.000 align:start\n- Hey\n";
        let lines = parse(vtt, ScriptFormat::Srt).unwrap();
        assert_eq!(texts(&lines), vec!["- Hey"]);
        assert_eq!(lines[0].end, Some(2.0));
    }

    #[test]
    fn json_lines_accept_strings_objects_and_word_times() {
        let lines = parse(
            r#"{"lines":[
                "untimed",
                {"text":"timed","start":1.0,"end":2.0},
                {"start":3,"end":4,"words":[{"word":"a","start":3,"end":3.4},{"text":"b","t0":3.4,"t1":4}]},
                {"text":"partial words","words":[{"text":"x"}]}
            ]}"#,
            ScriptFormat::Json,
        )
        .unwrap();
        assert_eq!(
            texts(&lines),
            vec!["untimed", "timed", "a b", "partial words"]
        );
        assert_eq!(lines[0].start, None);
        assert_eq!(lines[2].words.as_ref().unwrap()[1].start, 3.4);
        assert!(lines[3].words.is_none());
        let segments = parse(
            r#"{"segments":[{"text":" hi ","start":0.5,"end":1}]}"#,
            ScriptFormat::Json,
        )
        .unwrap();
        assert_eq!(texts(&segments), vec!["hi"]);
        assert!(parse(r#"{"x":1}"#, ScriptFormat::Json).is_err());
        assert!(parse(r#"[{"text":"bad","start":2,"end":1}]"#, ScriptFormat::Json).is_err());
    }

    #[test]
    fn windows_fill_open_ends_and_untimed_runs() {
        let line = |text: &str, start: Option<f64>, end: Option<f64>| ScriptLine {
            text: text.into(),
            start,
            end,
            words: None,
        };
        let lines = vec![
            line("aa", None, None),
            line("bb", Some(2.0), None),
            line("cc", None, None),
            line("dddddd", None, None),
            line("ee", Some(10.0), Some(11.0)),
            line("ff", Some(12.0), None),
        ];
        let windows = resolve_windows(&lines, 20.0);
        assert_eq!(windows[0], (0.0, 2.0));
        // Has a start but no end: take the next known start.
        assert_eq!(windows[1], (2.0, 10.0));
        // These two lines lie between 10.0 (the end of bb) and 10.0, so the gap is zero, which still keeps the sequence monotonic.
        assert_eq!(windows[2], (10.0, 10.0));
        assert_eq!(windows[4], (10.0, 11.0));
        assert_eq!(windows[5], (12.0, 20.0));
        let untimed = vec![line("aa", None, None), line("bbbbbb", None, None)];
        assert_eq!(resolve_windows(&untimed, 8.0), vec![(0.0, 2.0), (2.0, 8.0)]);
    }

    #[test]
    fn anchors_place_untimed_lines_on_asr_words() {
        let word = |text: &str, start: f64, end: f64| TimedWord {
            text: text.into(),
            start,
            end,
        };
        let asr = vec![
            word("I", 4.3, 4.5),
            word("see", 4.5, 4.9),
            word("sparks", 4.9, 5.4),
            word("of", 5.4, 5.6),
            word("AGI", 5.6, 6.5),
            word("your", 7.9, 8.2),
            word("circus", 8.2, 8.8), // ASR misheard the words: this does not affect the line windows.
            word("make", 8.8, 9.0),
            word("me", 9.0, 9.2),
            word("nervous", 9.2, 9.8),
            word("thats", 9.9, 10.2),
            word("no", 10.2, 10.4),
            word("surprise", 10.4, 11.0),
        ];
        let lines: Vec<String> = [
            "I see sparks of AGI",
            "Your circuits make me nervous,",
            "that's no surprise",
            "[never sung]",
        ]
        .iter()
        .map(|s| (*s).to_owned())
        .collect();
        let outcome = anchor_windows(&lines, &asr);
        assert_eq!(outcome.windows[0], Some((4.3, 6.5)));
        assert_eq!(outcome.windows[1], Some((7.9, 9.8)));
        assert_eq!(outcome.windows[2], Some((9.9, 11.0)));
        assert_eq!(outcome.windows[3], None);
        // 12 of the 15 script tokens matched.
        assert!(
            (outcome.matched - 12.0 / 15.0).abs() < 1e-9,
            "{}",
            outcome.matched
        );
        assert_eq!(anchor_windows(&lines, &[]).matched, 0.0);
    }

    #[test]
    fn anchor_outliers_do_not_stretch_a_line() {
        let word = |text: &str, start: f64| TimedWord {
            text: text.into(),
            start,
            end: start + 0.3,
        };
        // “my” appears again 30 s away, and LCS might match it there. The window must not be stretched to 30 s.
        let asr = vec![word("upping", 1.0), word("doom", 1.6), word("my", 31.0)];
        let lines = vec!["upping doom my".to_owned()];
        let outcome = anchor_windows(&lines, &asr);
        // A stray `my` does not stretch the window. It counts as an unmatched word at the end of the line, and the window is extended only by its estimated duration (0.35 × 1.5).
        assert_eq!(outcome.windows[0], Some((1.0, 2.425)));
    }

    #[test]
    fn unmatched_line_heads_and_tails_widen_into_the_gaps() {
        let word = |text: &str, start: f64, end: f64| TimedWord {
            text: text.into(),
            start,
            end,
        };
        // Recognition missed “orthogonality thesis” on line 2 and “dense” on line 3, so only `blues` and `post chinchilla super` matched.
        let asr = vec![
            word("we", 4.0, 4.3),
            word("had", 4.3, 4.6),
            word("a", 4.6, 4.7),
            word("stable", 4.7, 5.4),
            word("run", 5.4, 6.0),
            word("blues", 10.0, 10.5),
            word("post", 11.0, 11.3),
            word("chinchilla", 11.3, 12.0),
            word("super", 12.0, 12.3),
            word("next", 12.8, 13.1),
        ];
        let lines: Vec<String> = [
            "We had a stable run",
            "Orthogonality thesis blues.",
            "Post-Chinchilla, super-dense",
            "next",
        ]
        .iter()
        .map(|s| (*s).to_owned())
        .collect();
        let outcome = anchor_windows(&lines, &asr);
        assert_eq!(outcome.windows[0], Some((4.0, 6.0)));
        // The two leading words are estimated at (13 × 0.09 + 6 × 0.09) × 1.5 = 2.565 s, so the start moves from 10.0 to 7.435.
        assert_eq!(outcome.windows[1], Some((7.435, 10.5)));
        // The trailing `dense` is estimated at 0.45 × 1.5 = 0.675 s, but the next line starts at 12.8, so the window ends at 12.8.
        assert_eq!(outcome.windows[2], Some((11.0, 12.8)));
        assert_eq!(outcome.windows[3], Some((12.8, 13.1)));

        // When the gap between lines is not large enough, the window extends at most to the previous line's end, so the windows do not overlap.
        let tight = vec![word("run", 5.4, 6.0), word("blues", 6.3, 6.8)];
        let lines = vec!["run".to_owned(), "orthogonality thesis blues".to_owned()];
        let outcome = anchor_windows(&lines, &tight);
        assert_eq!(outcome.windows[0], Some((5.4, 6.0)));
        assert_eq!(outcome.windows[1], Some((6.0, 6.8)));
    }
}
