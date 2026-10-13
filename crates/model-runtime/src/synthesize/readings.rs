//! Pinyin readings (pronunciations of polyphonic characters) applied before TTS synthesis, ported from the v2 `ccut-tts::text::readings` and the reading wrapper layer of `ccut-tts::engine`.
//!
//! Architecture design §6.1: reading annotation is part of the input text, and the adapter converts it into each model's own notation; when a model does not support it, report that honestly rather than silently dropping it.
//!
//! - Parsing / stripping / re-emitting of the `<surface|reading>` syntax is in [`syntax`], re-exported here as a whole;
//! - [`annotate`]: dictionary decision. Readings fixed by the phrase table (mmseg longest match) are recorded as [`Origin::Phrase`] annotations; the remaining context-dependent polyphonic single characters are listed as [`Candidate`];
//! - [`parse_for_engine`]: parsing used by the engine wrapper layer; multi-character annotations that match the phrase table are recognized as [`Origin::Phrase`];
//! - [`render`]: renders annotations, according to the engine's [`ReadingsSupport`], into text the engine can consume; what cannot be rendered goes into `dropped` (soft failure);
//! - [`Annotating`]: the wrapper layer that [`crate::synthesize::load`] wraps around each engine; the single resolution point for annotations.
//!
//! The data is in `readings/data/` (sources, licenses and SHA-256 are in `readings/data/README.md`); the phrase table and single-character default readings reuse the pypinyin table embedded in the GPT-SoVITS front end.

pub mod syntax;

pub use syntax::{Annotated, Candidate, Origin, Reading, has_readings, parse, strip};

use std::collections::{HashMap, HashSet};
use std::io::Read;
use std::sync::LazyLock;

use anyhow::Result;

use super::gpt_sovits::text::pinyin;
use super::types::{TtsAudio, TtsEngineKind, TtsRequest};
use super::{ProgressSink, TtsEngine};

/// The pinyin pieces rendered by IndexTTS2 are wrapped in this pair of private-use-area characters. `normalizer.rs` uses them to protect the piece before number normalization, then restores it as a piece with spaces on both sides (so it is not read out as a number, and does not merge with adjacent Latin letters into one word).
pub const PIECE_OPEN: char = '\u{E000}';
pub const PIECE_CLOSE: char = '\u{E001}';

/// The engine-rendered text, and the part that could not be read as annotated.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct Rendered {
    pub text: String,
    /// Parts not read as annotated (the engine does not accept them, the vocabulary has no such piece, or there is no representative character); the sentence is still synthesized as usual.
    pub dropped: Vec<Reading>,
}

/// How an engine consumes readings. The capability value and [`TtsEngineKind::readings_support`] live in [`super::types`].
pub use super::types::ReadingsSupport;

/// Renders annotations into the text the engine needs, according to the rendering method. `pinyin_pieces` is the set of pinyin pieces in the IndexTTS2 vocabulary (uppercase, without `▁`); only [`ReadingsSupport::InlinePinyin`] reads it; when given `None`, that whole category is dropped.
pub fn render(support: ReadingsSupport, annotated: &Annotated, pinyin_pieces: Option<&HashSet<String>>) -> Rendered {
    match support {
        ReadingsSupport::Annotated => Rendered {
            text: annotated.to_text(),
            dropped: Vec::new(),
        },
        ReadingsSupport::InlinePinyin => render_inline_pinyin(annotated, pinyin_pieces),
        ReadingsSupport::Homophone => render_homophone(annotated),
        ReadingsSupport::Unsupported => render_unsupported(annotated),
    }
}

/// Engines that do not accept readings: surface text, with all annotations dropped. Phrase readings are the exception: the engine reads them with its own phrase table, so they are not counted as unread (see [`Origin::Phrase`]).
pub fn render_unsupported(annotated: &Annotated) -> Rendered {
    let mut out = render_per_char(annotated, |_, _, _| CharRender::Keep);
    out.dropped = annotated.readings.iter().filter(|r| r.origin != Origin::Phrase).cloned().collect();
    out
}

/// Parsing for the engine wrapper layer: after [`parse`], multi-character annotations whose reading exactly matches the phrase table are recognized as [`Origin::Phrase`].
/// Annotations live only in the text, and their source does not travel with the text (after `to_text` they all look hand-written). This step makes the phrase annotations added by [`annotate`] behave like hand-written annotations of the same kind: on Qwen3 they are not swapped for another character, and on engines that do not accept readings they are not reported as dropped.
pub fn parse_for_engine(text: &str) -> Annotated {
    let mut annotated = parse(text);
    if annotated.readings.iter().any(|r| r.end - r.start >= 2) {
        let chars: Vec<char> = annotated.surface.chars().collect();
        for r in &mut annotated.readings {
            if r.end - r.start >= 2 && phrase_reading(&chars[r.start..r.end]).is_some_and(|p| p == r.reading) {
                r.origin = Origin::Phrase;
            }
        }
    }
    annotated
}

/// The reading (TONE3, space-separated) of a whole run of Han characters that is exactly one word in the phrase table.
fn phrase_reading(span: &[char]) -> Option<String> {
    if !span.iter().all(|&c| is_han(c)) {
        return None;
    }
    let run: String = span.iter().collect();
    match pinyin::segments(&run).as_slice() {
        [(piece, Some(ids))] if *piece == run => Some(ids.iter().map(|&id| pinyin::tone3(id)).collect::<Vec<_>>().join(" ")),
        _ => None,
    }
}

/// A malformed annotation is literally `<surface|reading>` in the surface text; engines that do not accept this syntax should speak only the surface characters.
/// Returns the positions in the surface text to skip (`<`, `|reading>`).
fn malformed_brackets(annotated: &Annotated, len: usize) -> Vec<bool> {
    let mut skip = vec![false; len];
    for m in &annotated.malformed {
        let tail = m.end + 2 + m.reading.chars().count();
        if m.start >= 1 && tail <= len {
            skip[m.start - 1] = true;
            skip[m.end..tail].fill(true);
        }
    }
    skip
}

enum CharRender {
    /// Keep the character as is (this character has only this one reading).
    Keep,
    Replace(String),
    Drop,
}

/// Character-by-character rendering: each character in the annotation is paired with its syllable, and `decide` determines what it is replaced with; drops are counted per character.
/// A malformed annotation keeps only the surface characters (the brackets and reading are not sent to the engine).
fn render_per_char(annotated: &Annotated, mut decide: impl FnMut(char, &str, Origin) -> CharRender) -> Rendered {
    let mut out = Rendered::default();
    let mut readings = annotated.readings.iter().peekable();
    let mut current: Option<(&Reading, Vec<&str>)> = None;
    let skip = malformed_brackets(annotated, annotated.surface.chars().count());
    for (index, c) in annotated.surface.chars().enumerate() {
        if skip[index] {
            continue;
        }
        if current.as_ref().is_some_and(|(r, _)| index >= r.end) {
            current = None;
        }
        if current.is_none()
            && let Some(reading) = readings.next_if(|r| r.start == index)
        {
            current = Some((reading, reading.syllables().collect()));
        }
        let Some((reading, syllables)) = current.as_ref() else {
            out.text.push(c);
            continue;
        };
        let syllable = syllables[index - reading.start];
        match decide(c, syllable, reading.origin) {
            CharRender::Keep => out.text.push(c),
            CharRender::Replace(text) => out.text.push_str(&text),
            CharRender::Drop => {
                out.text.push(c);
                out.dropped.push(Reading {
                    start: index,
                    end: index + 1,
                    reading: syllable.to_owned(),
                    origin: reading.origin,
                });
            }
        }
    }
    out
}

fn is_han(c: char) -> bool {
    ('\u{4E00}'..='\u{9FFF}').contains(&c)
}

/// This character has only this one reading, so the annotation is a no-op for it.
fn only_reading_is(c: char, syllable: &str) -> bool {
    !HETERONYMS.contains_key(&c) && pinyin::default_syllable(c).is_some_and(|id| pinyin::tone3(id) == syllable)
}

/// IndexTTS2: character → uppercase pinyin piece (`XING2`; ü is written `V`), replaced only when the vocabulary contains that piece.
pub fn render_inline_pinyin(annotated: &Annotated, pinyin_pieces: Option<&HashSet<String>>) -> Rendered {
    render_per_char(annotated, |c, syllable, origin| {
        if !is_han(c) {
            return CharRender::Drop;
        }
        if only_reading_is(c, syllable) {
            return CharRender::Keep;
        }
        let piece = inline_pinyin_piece(syllable);
        match pinyin_pieces {
            Some(pieces) if pieces.contains(&piece) => CharRender::Replace(format!("{PIECE_OPEN}{piece}{PIECE_CLOSE}")),
            // A phrase reading has no piece: the character is kept as is and the engine reads it with its own phrase segmentation; this is not counted as unread.
            _ if origin == Origin::Phrase => CharRender::Keep,
            _ => CharRender::Drop,
        }
    })
}

/// Reading → piece name in the IndexTTS2 vocabulary: uppercase. ü after j / q / x is written `V` in the vocabulary (`JV4`, `XVE2`; there is no `JU4`); after y, per TONE3, it is written `U` (`YU2`).
fn inline_pinyin_piece(syllable: &str) -> String {
    let mut piece = syllable.to_ascii_uppercase();
    if matches!(piece.as_bytes(), [b'J' | b'Q' | b'X', b'U', ..]) {
        piece.replace_range(1..2, "V");
    }
    piece
}

/// Qwen3-TTS: character → representative character with the same reading. Annotations from the phrase table are neither replaced nor reported.
pub fn render_homophone(annotated: &Annotated) -> Rendered {
    render_per_char(annotated, |c, syllable, origin| {
        if origin == Origin::Phrase {
            return CharRender::Keep;
        }
        if !is_han(c) {
            return CharRender::Drop;
        }
        if only_reading_is(c, syllable) {
            return CharRender::Keep;
        }
        match HOMOPHONES.get(syllable) {
            Some(&rep) => CharRender::Replace(rep.to_string()),
            None => CharRender::Drop,
        }
    })
}

/// All readings of a character (default reading first). A non-polyphonic character gets its only reading; a character with no reading gets empty.
pub fn readings_of(c: char) -> Vec<String> {
    match HETERONYMS.get(&c) {
        Some(entry) => entry.all.clone(),
        None => pinyin::default_syllable(c).map(|id| vec![pinyin::tone3(id)]).unwrap_or_default(),
    }
}

/// Whether it is a curated context-dependent polyphonic character (`readings/data/context_heteronyms.txt`).
pub fn is_context_heteronym(c: char) -> bool {
    CONTEXT.contains(&c)
}

/// Options for [`annotate`].
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct AnnotateOptions {
    /// Candidate single characters are also written as [`Origin::Dict`] annotations using the dictionary default reading. The v2 CLI's automatic annotation is off (it only lists candidates); hosts with human review or LLM finishing decide that themselves.
    pub dict_readings: bool,
}

/// Dictionary decision: hand-written annotations are kept as they are; other Han characters are segmented by the phrase table (mmseg longest match). When a phrase reading fixes a context-dependent polyphonic character to a **non-default** reading (`银行` (bank) → `hang2`), one `Phrase` annotation is recorded for the whole word; context-dependent polyphonic single characters not covered by a phrase are listed in `candidates`.
pub fn annotate(text: &str, options: AnnotateOptions) -> Annotated {
    let mut annotated = parse(text);
    let chars: Vec<char> = annotated.surface.chars().collect();
    let mut covered = vec![false; chars.len()];
    for r in annotated.readings.iter().chain(&annotated.malformed) {
        covered[r.start..r.end.min(chars.len())].fill(true);
    }
    let mut added = Vec::new();
    let mut index = 0;
    while index < chars.len() {
        if covered[index] || !is_han(chars[index]) {
            index += 1;
            continue;
        }
        let start = index;
        while index < chars.len() && !covered[index] && is_han(chars[index]) {
            index += 1;
        }
        let run: String = chars[start..index].iter().collect();
        let mut offset = start;
        for (piece, ids) in pinyin::segments(&run) {
            let piece_chars: Vec<char> = piece.chars().collect();
            let len = piece_chars.len();
            if len >= 2 {
                if let Some(ids) = ids
                    && piece_chars
                        .iter()
                        .zip(ids)
                        .any(|(&c, &id)| is_context_heteronym(c) && pinyin::default_syllable(c) != Some(id))
                {
                    added.push(Reading {
                        start: offset,
                        end: offset + len,
                        reading: ids.iter().map(|&id| pinyin::tone3(id)).collect::<Vec<_>>().join(" "),
                        origin: Origin::Phrase,
                    });
                }
            } else if let Some(&c) = piece_chars.first()
                && is_context_heteronym(c)
                && let Some(entry) = HETERONYMS.get(&c)
            {
                annotated.candidates.push(Candidate {
                    start: offset,
                    end: offset + 1,
                    default: entry.default.clone(),
                    readings: entry.all.clone(),
                });
                if options.dict_readings {
                    added.push(Reading {
                        start: offset,
                        end: offset + 1,
                        reading: entry.default.clone(),
                        origin: Origin::Dict,
                    });
                }
            }
            offset += len;
        }
    }
    annotated.readings.extend(added);
    annotated.readings.sort_by_key(|r| r.start);
    annotated
}

// ---------------------------------------------------------------- 包装层

/// The wrapper returned by [`crate::synthesize::load`]: the single resolution point for annotations, through which every engine synthesizes. Without annotations it passes the request through unchanged; with annotations it asks the inner engine for the rendered result ([`TtsEngine::render_readings`]), swaps the rendered text into a copy of the request and synthesizes that. Readings that could not be read as annotated are written into [`TtsAudio::readings_dropped`]: engines that do not accept readings report this honestly here rather than silently dropping it.
pub struct Annotating {
    inner: Box<dyn TtsEngine>,
}

impl Annotating {
    pub fn new(inner: Box<dyn TtsEngine>) -> Self {
        Self { inner }
    }
}

impl TtsEngine for Annotating {
    fn kind(&self) -> TtsEngineKind {
        self.inner.kind()
    }

    fn sample_rate(&self) -> u32 {
        self.inner.sample_rate()
    }

    fn preset_speakers(&self) -> Vec<String> {
        self.inner.preset_speakers()
    }

    fn render_readings(&self, annotated: &Annotated) -> Rendered {
        self.inner.render_readings(annotated)
    }

    fn synthesize(&mut self, request: &TtsRequest, progress: ProgressSink<'_>) -> Result<TtsAudio> {
        if !request.text.contains('<') {
            return self.inner.synthesize(request, progress);
        }
        let annotated = parse_for_engine(&request.text);
        if annotated.is_plain() {
            return self.inner.synthesize(request, progress);
        }
        let rendered = self.inner.render_readings(&annotated);
        let mut rendered_request = request.clone();
        rendered_request.text = rendered.text;
        let mut audio = self.inner.synthesize(&rendered_request, progress)?;
        let mut dropped = annotated.malformed;
        dropped.extend(rendered.dropped);
        dropped.sort_by_key(|r| r.start);
        audio.readings_dropped = dropped;
        Ok(audio)
    }
}

// ---------------------------------------------------------------- 内嵌表

struct Heteronym {
    default: String,
    all: Vec<String>,
}

fn inflate_text(bytes: &[u8]) -> String {
    let mut out = String::new();
    flate2::read::ZlibDecoder::new(bytes)
        .read_to_string(&mut out)
        .expect("embedded reading data failed to decompress");
    out
}

static HETERONYMS: LazyLock<HashMap<char, Heteronym>> = LazyLock::new(|| {
    inflate_text(include_bytes!("readings/data/heteronyms.txt.z"))
        .lines()
        .filter_map(|line| {
            let mut parts = line.split('\t');
            let c = parts.next()?.chars().next()?;
            let default = parts.next()?.to_owned();
            let all = parts.next()?.split(' ').map(str::to_owned).collect();
            Some((c, Heteronym { default, all }))
        })
        .collect()
});

static HOMOPHONES: LazyLock<HashMap<String, char>> = LazyLock::new(|| {
    inflate_text(include_bytes!("readings/data/homophones.txt.z"))
        .lines()
        .filter_map(|line| {
            let (reading, c) = line.split_once('\t')?;
            Some((reading.to_owned(), c.chars().next()?))
        })
        .collect()
});

static CONTEXT: LazyLock<HashSet<char>> = LazyLock::new(|| {
    include_str!("readings/data/context_heteronyms.txt")
        .lines()
        .flat_map(|line| line.split('#').next().unwrap_or("").split_whitespace())
        .filter_map(|word| word.chars().next())
        .collect()
});

#[cfg(test)]
mod tests;
