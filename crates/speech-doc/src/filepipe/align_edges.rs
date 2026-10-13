//! The HTML table codec for the align default carrier `align-edges/1` and the narrow monotonic-rewrite task `align-rewrite/1` (alignment block design §6.1 / §6.3).
//!
//! Unlike the two-column split table of [`super::align_table`], here the model **does not split the source, does not split the translation, and does not resolve crossings**. It only divides the translation into semantic blocks as small as possible, and lists for each block the corresponding source word ordinals (these may be out of order, non-contiguous, or empty). Block merging, safe boundaries, bilingual DP and time allocation are all deterministic code in [`crate::align_block`].
//!
//! Payload shape (tag names are not part of the protocol; location always goes through `data-*` / `class`):
//!
//! ```html
//! <table data-lang="zh" data-fit="16" data-soft="14" data-hard="20" data-ccut-format="align-edges/1">
//!   <tbody data-sid="s-g1.0">
//!     <tr><th scope="rowgroup">s-g1.0</th>
//!         <td class="src">[1]I [2]didn't [3]go [4]because [5]I [6]was [7]sick.</td>
//!         <td class="tgt">因为我病了，所以没去。</td></tr>
//!   </tbody>
//! </table>
//! ```
//!
//! The model may only change the content of `td.tgt`, turning it into a series of `<span data-src="4-7">因为我病了，</span><span data-src="1 2 3">所以没去。</span>`. `data-src` is a whitespace- or comma-separated list of 1-based ordinals and ranges, and may be empty (an omitted translation or a function block). Each ordinal belongs to at most one block within a sentence. The span text, concatenated under the [`normalize_chars`] convention, must equal the translation (the same tolerance as the concatenation invariant of the split table). `align-rewrite/1` uses the same table, but `td.tgt` is allowed to be **rewritten** (monotonized), and spans are annotated at the same time. The magnitude of the rewrite is guarded by [`reordered_rewrite_exceeds`], and hard anchors (numbers, URLs, verbatim Latin) must not be lost.
//!
//! This module is the **only string-level validator** for these two kinds: the engine and the agent's submit-time lint both call [`parse_align_edges`]. Zero I/O, zero clock, zero randomness.

use std::collections::{BTreeMap, BTreeSet};
use std::ops::Range;

use crate::align_block::{AlignCtx, AlignEdge, AnchorAligner, WordAligner};
use crate::atomize::normalize_chars;
use crate::split::{TransParams, reordered_rewrite_exceeds, target_cps_chars};

use super::common::{
    ALIGN_EDGES_FORMAT, ALIGN_REWRITE_FORMAT, Diagnostics, Problem, ProblemCode, Warning,
    WarningCode, guard_output_size, normalize_llm_output, sanitize_inline_text,
};
use super::html::{Element, Node, escape_attr, escape_text, parse_html, parse_html_in_table};

/// Soft edge weight for LLM block alignment (alignment block design §4.2: block-level attribution, not corroborated by anchors).
pub const CHUNK_EDGE_WEIGHT: f32 = 0.75;

/// Render input for one sentence in the table.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AlignEdgesSentenceInput {
    /// Sentence id (`data-sid`, exact byte-for-byte match).
    pub id: String,
    /// Anchored words within the sentence; order is the ordinal (one word per ordinal; CJK sources are counted atomically per `words[]`).
    pub source_words: Vec<String>,
    /// `align-edges/1`: the natural translation sentence is the ground truth. `align-rewrite/1`: the rewrite baseline is the natural translation sentence.
    pub translation: String,
    /// The over-hard block hint (`data-over-hard`) for `align-rewrite/1`. It carries only relative budgets, e.g. `chunk 1 (words 1-9): 27 units > hard 20`; in edges mode it is always `None`.
    pub over_hard: Option<String>,
}

impl AlignEdgesSentenceInput {
    /// Constructs a render input for one sentence (edges mode).
    pub fn new(
        id: impl Into<String>,
        source_words: Vec<String>,
        translation: impl Into<String>,
    ) -> Self {
        Self {
            id: id.into(),
            source_words,
            translation: translation.into(),
            over_hard: None,
        }
    }
}

/// The render input for a whole table, which is also the reconciliation baseline at parse time.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AlignEdgesInput {
    /// Target language tag (`data-lang`).
    pub lang: String,
    /// Target-language thresholds (`data-fit` / `data-soft` / `data-hard`).
    pub params: TransParams,
    /// `true` ⇒ `align-rewrite/1` (rewriting tgt is allowed); otherwise `align-edges/1`.
    pub rewrite: bool,
    pub sentences: Vec<AlignEdgesSentenceInput>,
}

impl AlignEdgesInput {
    /// Constructs an edges-table input (parameters take the target language's canonical defaults).
    pub fn new(lang: impl Into<String>, sentences: Vec<AlignEdgesSentenceInput>) -> Self {
        let lang = lang.into();
        let params = TransParams::for_lang(&lang);
        Self {
            lang,
            params,
            rewrite: false,
            sentences,
        }
    }

    fn format(&self) -> &'static str {
        if self.rewrite {
            ALIGN_REWRITE_FORMAT
        } else {
            ALIGN_EDGES_FORMAT
        }
    }
}

/// One semantic block of the translation annotated by the model: text + the source word ordinals it is attributed to (**0-based**).
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct AlignChunk {
    pub text: String,
    pub ordinals: Vec<usize>,
}

/// The parsed group for one sentence.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct AlignEdgesGroup {
    pub id: String,
    /// Semantic blocks in order of appearance; empty = tgt not annotated (the engine treats this as "no alignment edges").
    pub chunks: Vec<AlignChunk>,
    /// The normalized full text of the tgt cell (in rewrite mode, the rewritten full sentence).
    pub text: String,
}

/// The result of one parse.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct AlignEdgesParsed {
    pub groups: Vec<AlignEdgesGroup>,
    pub diagnostics: Diagnostics,
}

impl AlignEdgesParsed {
    /// Gets a group by id.
    pub fn group(&self, id: &str) -> Option<&AlignEdgesGroup> {
        self.groups.iter().find(|group| group.id == id)
    }
}

// ---------------------------------------------------------------------------
// Ordinal word string
// ---------------------------------------------------------------------------

/// `[1]I [2]didn't [3]go`: each anchored word is prefixed with its 1-based ordinal. Word text first goes through [`sanitize_inline_text`]; the renderer is responsible for HTML escaping.
pub fn render_ordinal_words(words: &[String]) -> String {
    words
        .iter()
        .enumerate()
        .map(|(index, word)| format!("[{}]{}", index + 1, sanitize_inline_text(word)))
        .collect::<Vec<_>>()
        .join(" ")
}

/// The inverse of [`render_ordinal_words`]: splits back into the word table by `[N]` markers (whitespace inside a word is kept, leading and trailing whitespace trimmed). Returns an empty table when the input is not an ordinal word string.
pub fn parse_ordinal_words(text: &str) -> Vec<String> {
    let chars: Vec<char> = text.chars().collect();
    // (start, word start) of each marker.
    let mut markers: Vec<(usize, usize)> = Vec::new();
    let mut index = 0usize;
    while index < chars.len() {
        if chars[index] == '[' && (index == 0 || chars[index - 1].is_whitespace()) {
            let mut end = index + 1;
            while end < chars.len() && chars[end].is_ascii_digit() {
                end += 1;
            }
            if end > index + 1 && end < chars.len() && chars[end] == ']' {
                markers.push((index, end + 1));
                index = end + 1;
                continue;
            }
        }
        index += 1;
    }
    let mut words = Vec::with_capacity(markers.len());
    for (position, &(_, word_start)) in markers.iter().enumerate() {
        let word_end = markers
            .get(position + 1)
            .map(|&(start, _)| start)
            .unwrap_or(chars.len());
        let word: String = chars[word_start..word_end].iter().collect();
        words.push(word.trim().to_owned());
    }
    words
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

/// Renders an edges / rewrite table. Output is deterministic: attribute order, indentation and row order are fixed.
pub fn render_align_edges(input: &AlignEdgesInput) -> String {
    let mut output = String::new();
    output.push_str(&format!(
        "<table data-lang=\"{}\" data-fit=\"{}\" data-soft=\"{}\" data-hard=\"{}\" data-ccut-format=\"{}\">\n",
        escape_attr(&sanitize_inline_text(&input.lang)),
        input.params.fit,
        input.params.soft,
        input.params.hard,
        escape_attr(input.format()),
    ));
    for sentence in &input.sentences {
        let over_hard = match sentence.over_hard.as_deref().filter(|_| input.rewrite) {
            Some(hint) => format!(
                " data-over-hard=\"{}\"",
                escape_attr(&sanitize_inline_text(hint))
            ),
            None => String::new(),
        };
        output.push_str(&format!(
            "  <tbody data-sid=\"{}\"{}>\n",
            escape_attr(&sanitize_inline_text(&sentence.id)),
            over_hard,
        ));
        output.push_str(&format!(
            "    <tr><th scope=\"rowgroup\">{}</th><td class=\"src\">{}</td><td class=\"tgt\">{}</td></tr>\n",
            cell_text(&sentence.id),
            escape_text(&render_ordinal_words(&sentence.source_words)),
            cell_text(&sentence.translation),
        ));
        output.push_str("  </tbody>\n");
    }
    output.push_str("</table>\n");
    output
}

fn cell_text(text: &str) -> String {
    escape_text(&sanitize_inline_text(text))
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/// Parses the table returned by the model (the only string-level validation shared by the engine and the submit-time lint).
///
/// `input` is the render text that was actually sent; it is used only as the baseline for the size guard. `None` skips the guard.
///
/// Criteria (per-sentence Problems, which do not block other sentences):
/// - `data-src` ordinal that is unparseable / out of range / duplicated across blocks ⇒ [`ProblemCode::AlignEdgeOrdinal`];
/// - in edges mode, the concatenated span text (under the [`normalize_chars`] convention) ≠ the translation ⇒ [`ProblemCode::AlignEdgeText`];
/// - in rewrite mode, the rewritten text is empty ⇒ [`ProblemCode::EmptyTranslation`]; the magnitude exceeds [`reordered_rewrite_exceeds`], or a numeric / URL / verbatim Latin hard anchor is lost ⇒ [`ProblemCode::AlignContentDrift`];
/// - a tgt cell with no spans at all ⇒ only [`WarningCode::ContentIgnored`] is recorded, and the group is returned with `chunks: []` (the engine falls back to no alignment edges).
///
/// Truncation vs. scattered missing ids, and bare `<tbody>` recovery, follow the same conventions as [`super::align_table`].
pub fn parse_align_edges(
    input: &AlignEdgesInput,
    payload: Option<&str>,
    output: &str,
) -> AlignEdgesParsed {
    let mut diagnostics = Diagnostics::new();
    let normalized = normalize_llm_output(output);
    for warning in normalized.warnings() {
        diagnostics.push_warning(warning);
    }
    if let Some(problem) = payload.and_then(|payload| guard_output_size(payload, &normalized.text))
    {
        diagnostics.push_problem(problem);
        return AlignEdgesParsed {
            groups: Vec::new(),
            diagnostics,
        };
    }
    if has_residual_fence(&normalized.text) {
        diagnostics.push_problem(Problem::document(
            ProblemCode::DocumentWrapped,
            "the output still contains code-fence residue or extra commentary that cannot be stripped at no cost",
        ));
    }

    let mut tree = parse_html(&normalized.text);
    let mut elements = Vec::new();
    walk_groups(&tree.roots, &mut elements);
    if elements.is_empty() && normalized.text.contains("data-sid") {
        tree = parse_html_in_table(&normalized.text);
        elements = Vec::new();
        walk_groups(&tree.roots, &mut elements);
    }
    for warning in tree.warnings() {
        diagnostics.push_warning(warning);
    }

    let expected: BTreeMap<&str, &AlignEdgesSentenceInput> = input
        .sentences
        .iter()
        .map(|sentence| (sentence.id.as_str(), sentence))
        .collect();
    let mut groups = Vec::new();
    let mut seen: BTreeSet<String> = BTreeSet::new();
    let mut duplicated: BTreeSet<String> = BTreeSet::new();
    for element in elements {
        let sid = element
            .attr("data-sid")
            .map(str::trim)
            .unwrap_or_default()
            .to_owned();
        if sid.is_empty() {
            diagnostics.push_warning(Warning::document(
                WarningCode::ContentIgnored,
                "ignored a group with an empty data-sid",
            ));
            continue;
        }
        if seen.contains(&sid) {
            if duplicated.insert(sid.clone()) {
                diagnostics.push_problem(Problem::sentence(
                    ProblemCode::DuplicateId,
                    sid.clone(),
                    "the same id appears more than once; only the first group is used",
                ));
            }
            continue;
        }
        seen.insert(sid.clone());
        let Some(sentence) = expected.get(sid.as_str()).copied() else {
            diagnostics.push_problem(Problem::sentence(
                ProblemCode::UnknownId,
                sid.clone(),
                "id outside the protocol, ignored",
            ));
            continue;
        };
        groups.push(parse_group(element, sentence, input, &mut diagnostics));
    }
    report_missing(input, &seen, &mut diagnostics);
    AlignEdgesParsed {
        groups,
        diagnostics,
    }
}

/// Recovers an [`AlignEdgesInput`] from the **originally emitted payload HTML** (submit-time lint).
///
/// It must be the strict inverse of [`render_align_edges`]: `render → parse_input → render` byte-for-byte equality is pinned by a unit test. Returns `None` when the table is neither edges nor rewrite.
pub fn parse_align_edges_input(payload: &str) -> Option<AlignEdgesInput> {
    let tree = parse_html(payload);
    let table = tree.elements().into_iter().find(|element| {
        matches!(
            element.attr("data-ccut-format"),
            Some(ALIGN_EDGES_FORMAT) | Some(ALIGN_REWRITE_FORMAT)
        )
    })?;
    let rewrite = table.attr("data-ccut-format") == Some(ALIGN_REWRITE_FORMAT);
    let lang = table
        .attr("data-lang")
        .unwrap_or_default()
        .trim()
        .to_owned();
    let defaults = TransParams::for_lang(&lang);
    let params = TransParams {
        fit: attr_usize(table, "data-fit").unwrap_or(defaults.fit),
        soft: attr_usize(table, "data-soft").unwrap_or(defaults.soft),
        hard: attr_usize(table, "data-hard").unwrap_or(defaults.hard),
    };
    let mut elements = Vec::new();
    walk_groups(&tree.roots, &mut elements);
    let mut sentences = Vec::new();
    for element in elements {
        let Some(id) = element
            .attr("data-sid")
            .map(str::trim)
            .filter(|id| !id.is_empty())
        else {
            continue;
        };
        let (Some(src), Some(tgt)) = (find_cell(element, "src"), find_cell(element, "tgt")) else {
            continue;
        };
        sentences.push(AlignEdgesSentenceInput {
            id: id.to_owned(),
            source_words: parse_ordinal_words(&src.text()),
            translation: tgt.text(),
            over_hard: element
                .attr("data-over-hard")
                .filter(|_| rewrite)
                .map(str::to_owned),
        });
    }
    Some(AlignEdgesInput {
        lang,
        params,
        rewrite,
        sentences,
    })
}

fn attr_usize(element: &Element, name: &str) -> Option<usize> {
    element.attr(name)?.trim().parse().ok()
}

/// Recursively collects groups that carry `data-sid`; does not descend further after a match.
fn walk_groups<'a>(nodes: &'a [Node], out: &mut Vec<&'a Element>) {
    for node in nodes {
        let Node::Element(element) = node else {
            continue;
        };
        if element.attrs.contains_key("data-sid") {
            out.push(element);
            continue;
        }
        walk_groups(&element.children, out);
    }
}

/// The first descendant cell with the given class inside the group.
fn find_cell<'a>(group: &'a Element, class: &str) -> Option<&'a Element> {
    group
        .descendants()
        .into_iter()
        .find(|element| element.has_class(class))
}

/// Locates the tgt cell: prefer `class="tgt"`; otherwise take the last cell of the first row after removing the id column.
fn locate_target_cell<'a>(group: &'a Element, sid: &str) -> Option<&'a Element> {
    if let Some(cell) = find_cell(group, "tgt") {
        return Some(cell);
    }
    for row in group.child_elements() {
        let cells: Vec<&Element> = row
            .child_elements()
            .into_iter()
            .filter(|cell| {
                !(cell.attrs.contains_key("scope")
                    || cell.attrs.contains_key("rowspan")
                    || cell.text().trim() == sid)
            })
            .collect();
        if cells.len() >= 2 {
            return cells.last().copied();
        }
    }
    None
}

/// Extracts semantic blocks from the direct children of a container element (a `<span data-src>` is a block; text directly inside the container, or child elements without `data-src`, count as blocks with an empty attribution). Returns `None` when the container has no `data-src` annotations at all.
///
/// The translate fusion channel (spans inside `<p>`) shares this function with this carrier.
pub fn chunks_from_element(container: &Element) -> Option<Vec<(String, Option<String>)>> {
    let mut chunks: Vec<(String, Option<String>)> = Vec::new();
    let mut annotated = false;
    for node in &container.children {
        match node {
            Node::Text(text) => {
                let text = super::html::normalize_html_text(text);
                if !text.trim().is_empty() {
                    chunks.push((text, None));
                }
            }
            Node::Element(element) => {
                let text = element.text();
                match element.attr("data-src") {
                    Some(raw) => {
                        annotated = true;
                        chunks.push((text, Some(raw.to_owned())));
                    }
                    None => {
                        if !text.trim().is_empty() {
                            chunks.push((text, None));
                        }
                    }
                }
            }
        }
    }
    annotated.then_some(chunks)
}

/// Parses `data-src`: whitespace- or comma-separated 1-based ordinals, or `a-b` ranges, ⇒ a list of 0-based ordinals (order of appearance kept, duplicates removed).
pub fn parse_ordinals(raw: &str, word_count: usize) -> Result<Vec<usize>, String> {
    let mut ordinals: Vec<usize> = Vec::new();
    for token in raw
        .split(|ch: char| ch.is_whitespace() || ch == ',' || ch == '，' || ch == ';')
        .filter(|token| !token.is_empty())
    {
        let (low, high) = match token.split_once(['-', '–', '—']) {
            Some((low, high)) => (parse_ordinal(low)?, parse_ordinal(high)?),
            None => {
                let value = parse_ordinal(token)?;
                (value, value)
            }
        };
        if low > high {
            return Err(format!("range `{token}` starts after it ends"));
        }
        if high > word_count {
            return Err(format!("ordinal `{token}` exceeds the source word count {word_count}"));
        }
        for value in low..=high {
            if !ordinals.contains(&(value - 1)) {
                ordinals.push(value - 1);
            }
        }
    }
    Ok(ordinals)
}

fn parse_ordinal(token: &str) -> Result<usize, String> {
    let value: usize = token
        .trim()
        .parse()
        .map_err(|_| format!("ordinal `{token}` cannot be parsed"))?;
    if value == 0 {
        return Err("ordinals start at 1".to_owned());
    }
    Ok(value)
}

/// Semantic blocks → alignment edges: each block is located in order on `target` under the [`normalize_chars`] convention (tolerant of whitespace, punctuation and case). Each attributed ordinal yields one soft edge (weight [`CHUNK_EDGE_WEIGHT`]), whose target interval is the half-open character-index range from the block's first to last valid character. If any block fails to locate, returns empty: no evidence is better than wrong evidence.
pub fn chunks_to_edges(chunks: &[AlignChunk], target: &str) -> Vec<AlignEdge> {
    let Some(ranges) = chunk_char_ranges(chunks, target) else {
        return Vec::new();
    };
    let mut edges = Vec::new();
    for (chunk, range) in chunks.iter().zip(ranges) {
        for &ordinal in &chunk.ordinals {
            edges.push(AlignEdge::soft(ordinal, range.clone(), CHUNK_EDGE_WEIGHT));
        }
    }
    edges
}

/// Compress block membership to extrema without filling the source hull. For
/// identical target ranges and weights this preserves every crossing decision.
/// It does not preserve word coverage statistics. Kept separate for M0 A/B tests.
pub fn chunks_to_endpoint_edges(chunks: &[AlignChunk], target: &str) -> Vec<AlignEdge> {
    let Some(ranges) = chunk_char_ranges(chunks, target) else {
        return Vec::new();
    };
    let mut edges = Vec::new();
    for (chunk, range) in chunks.iter().zip(ranges) {
        if let (Some(&lo), Some(&hi)) = (chunk.ordinals.iter().min(), chunk.ordinals.iter().max()) {
            edges.push(AlignEdge::soft(lo, range.clone(), CHUNK_EDGE_WEIGHT));
            if hi != lo {
                edges.push(AlignEdge::soft(hi, range, CHUNK_EDGE_WEIGHT));
            }
        }
    }
    edges
}

/// The character interval of each semantic block on `target` (ordered location with exactly the same convention as [`chunks_to_edges`]). If any block fails to locate, returns `None`. Line-partition mode needs the blocks' own target coordinates to decide whether a line boundary falls on a block boundary, so the location is exposed separately.
pub fn chunk_char_ranges(chunks: &[AlignChunk], target: &str) -> Option<Vec<Range<usize>>> {
    let target_chars: Vec<char> = target.chars().collect();
    let mut cursor = 0usize;
    let mut ranges = Vec::with_capacity(chunks.len());
    for chunk in chunks {
        ranges.push(locate_chunk(&target_chars, &mut cursor, &chunk.text)?);
    }
    Some(ranges)
}

/// Starting from `cursor`, matches the block's valid character sequence within `target`; on success advances `cursor`. A block with no valid characters (pure punctuation) returns an empty interval without advancing.
fn locate_chunk(target: &[char], cursor: &mut usize, text: &str) -> Option<Range<usize>> {
    let want: Vec<char> = normalize_chars(text).chars().collect();
    if want.is_empty() {
        return Some(*cursor..*cursor);
    }
    let mut position = *cursor;
    let mut matched = 0usize;
    let mut first: Option<usize> = None;
    let mut last = 0usize;
    while position < target.len() && matched < want.len() {
        let ch = target[position];
        let mut significant = String::new();
        if !ch.is_whitespace() && !crate::atomize::is_punctuation_or_symbol(ch) {
            significant.extend(ch.to_lowercase());
        }
        if significant.is_empty() {
            position += 1;
            continue;
        }
        for low in significant.chars() {
            if matched < want.len() && want[matched] == low {
                matched += 1;
            } else {
                return None;
            }
        }
        first.get_or_insert(position);
        last = position;
        position += 1;
    }
    if matched < want.len() {
        return None;
    }
    *cursor = last + 1;
    Some(first.unwrap_or(*cursor)..last + 1)
}

/// Parses one sentence group and runs the sentence-level acceptance checks.
fn parse_group(
    element: &Element,
    sentence: &AlignEdgesSentenceInput,
    input: &AlignEdgesInput,
    diagnostics: &mut Diagnostics,
) -> AlignEdgesGroup {
    let sid = sentence.id.as_str();
    let Some(cell) = locate_target_cell(element, sid) else {
        diagnostics.push_problem(Problem::sentence(
            ProblemCode::EmptyTranslation,
            sid,
            "the group has no tgt cell",
        ));
        return AlignEdgesGroup {
            id: sentence.id.clone(),
            chunks: Vec::new(),
            text: String::new(),
        };
    };
    let text = cell.text();
    let Some(raw_chunks) = chunks_from_element(cell) else {
        diagnostics.push_warning(Warning::sentence(
            WarningCode::ContentIgnored,
            sid,
            "the tgt cell has no <span data-src> annotations; treated as having no alignment edges",
        ));
        return AlignEdgesGroup {
            id: sentence.id.clone(),
            chunks: Vec::new(),
            text,
        };
    };
    let word_count = sentence.source_words.len();
    let mut chunks: Vec<AlignChunk> = Vec::with_capacity(raw_chunks.len());
    let mut used: BTreeSet<usize> = BTreeSet::new();
    let mut ordinal_errors: Vec<String> = Vec::new();
    for (index, (chunk_text, raw)) in raw_chunks.into_iter().enumerate() {
        if chunk_text.trim().is_empty() {
            diagnostics.push_warning(Warning::sentence(
                WarningCode::ContentIgnored,
                sid,
                format!("chunk {} has empty text, ignored", index + 1),
            ));
            continue;
        }
        let ordinals = match raw.as_deref() {
            None => Vec::new(),
            Some(raw) => match parse_ordinals(raw, word_count) {
                Ok(ordinals) => ordinals,
                Err(detail) => {
                    ordinal_errors
                        .push(format!("chunk {} data-src=\"{raw}\": {detail}", index + 1));
                    Vec::new()
                }
            },
        };
        for &ordinal in &ordinals {
            if !used.insert(ordinal) {
                ordinal_errors.push(format!(
                    "chunk {} references source word {} again (each ordinal belongs to at most one chunk)",
                    index + 1,
                    ordinal + 1
                ));
            }
        }
        chunks.push(AlignChunk {
            text: chunk_text,
            ordinals,
        });
    }
    if !ordinal_errors.is_empty() {
        diagnostics.push_problem(Problem::sentence(
            ProblemCode::AlignEdgeOrdinal,
            sid,
            ordinal_errors.join("；"),
        ));
    }
    let concat: String = chunks.iter().map(|chunk| chunk.text.as_str()).collect();
    if input.rewrite {
        check_rewrite(&concat, sentence, input, diagnostics);
    } else if normalize_chars(&concat) != normalize_chars(&sentence.translation) {
        diagnostics.push_problem(Problem::sentence(
            ProblemCode::AlignEdgeText,
            sid,
            "the concatenated span text does not match the translation: spans may only wrap the translation and must not rewrite, add, remove or reorder any character",
        ));
    }
    AlignEdgesGroup {
        id: sentence.id.clone(),
        chunks,
        text,
    }
}

/// String-level acceptance for rewrite mode: non-empty, magnitude guard, hard anchors preserved.
fn check_rewrite(
    rewritten: &str,
    sentence: &AlignEdgesSentenceInput,
    input: &AlignEdgesInput,
    diagnostics: &mut Diagnostics,
) {
    let sid = sentence.id.as_str();
    if rewritten.trim().is_empty() {
        diagnostics.push_problem(Problem::sentence(
            ProblemCode::EmptyTranslation,
            sid,
            "the rewritten translation is empty",
        ));
        return;
    }
    let lang = input.lang.as_str();
    let old_units = target_cps_chars(&sentence.translation, lang);
    let new_units = target_cps_chars(rewritten, lang);
    if reordered_rewrite_exceeds(old_units, new_units) {
        diagnostics.push_problem(Problem::sentence(
            ProblemCode::AlignContentDrift,
            sid,
            format!(
                "the rewrite is too large ({old_units} → {new_units} reading units): only clause order and necessary connectives, particles or punctuation may change; do not add, remove or compress content"
            ),
        ));
    }
    let dropped = dropped_hard_anchors(
        &sentence.source_words,
        &sentence.translation,
        rewritten,
        lang,
    );
    if !dropped.is_empty() {
        diagnostics.push_problem(Problem::sentence(
            ProblemCode::AlignContentDrift,
            sid,
            format!("the rewrite lost numeric/URL/verbatim Latin anchors: {}", dropped.join(", ")),
        ));
    }
}

/// A source word that [`AnchorAligner`] can uniquely anchor in the natural translation sentence, but that cannot be found in the rewritten text.
pub fn dropped_hard_anchors(
    source_words: &[String],
    translation: &str,
    rewritten: &str,
    lang: &str,
) -> Vec<String> {
    let refs: Vec<&str> = source_words.iter().map(String::as_str).collect();
    let ctx = AlignCtx {
        source_lang: String::new(),
        lang: lang.to_owned(),
        protected_terms: Vec::new(),
    };
    let before: BTreeSet<usize> = AnchorAligner
        .align(&refs, translation, &ctx)
        .into_iter()
        .filter(|edge| edge.hard)
        .map(|edge| edge.src)
        .collect();
    if before.is_empty() {
        return Vec::new();
    }
    let after: BTreeSet<usize> = AnchorAligner
        .align(&refs, rewritten, &ctx)
        .into_iter()
        .filter(|edge| edge.hard)
        .map(|edge| edge.src)
        .collect();
    before
        .difference(&after)
        .filter_map(|&index| source_words.get(index).cloned())
        .collect()
}

/// Missing-id determination: a consecutive suffix missing as a whole ⇒ truncation; otherwise, per-sentence `missing-id`.
fn report_missing(input: &AlignEdgesInput, seen: &BTreeSet<String>, diagnostics: &mut Diagnostics) {
    let missing: Vec<&str> = input
        .sentences
        .iter()
        .map(|sentence| sentence.id.as_str())
        .filter(|id| !seen.contains(*id))
        .collect();
    if missing.is_empty() {
        return;
    }
    let first_missing = input
        .sentences
        .iter()
        .position(|sentence| !seen.contains(&sentence.id))
        .unwrap_or(0);
    if input.sentences[first_missing..]
        .iter()
        .all(|sentence| !seen.contains(&sentence.id))
    {
        diagnostics.push_problem(Problem::document(
            ProblemCode::DocumentTruncated,
            format!(
                "starting at {}, {} sentences are entirely missing; the output may have been truncated",
                input.sentences[first_missing].id,
                missing.len()
            ),
        ));
        return;
    }
    for id in missing {
        diagnostics.push_problem(Problem::sentence(
            ProblemCode::MissingId,
            id,
            "the expected id does not appear in the output",
        ));
    }
}

fn has_residual_fence(text: &str) -> bool {
    text.lines().any(|line| {
        let trimmed = line.trim();
        trimmed.starts_with("```") || trimmed.starts_with("~~~")
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn en_words(text: &str) -> Vec<String> {
        text.split_whitespace().map(str::to_owned).collect()
    }

    fn causal_input() -> AlignEdgesInput {
        AlignEdgesInput::new(
            "zh",
            vec![
                AlignEdgesSentenceInput::new(
                    "s-g1.0",
                    en_words("I didn't go because I was sick."),
                    "因为我病了，所以没去。",
                ),
                AlignEdgesSentenceInput::new(
                    "s-g2.0",
                    en_words("We ship today."),
                    "我们今天发布。",
                ),
            ],
        )
    }

    /// Test-side "model answer" renderer: deliberately kept separate from the production renderer.
    fn answer(groups: &[(&str, &[(&str, &str)])]) -> String {
        let mut out = String::from("<table>\n");
        for (sid, spans) in groups {
            out.push_str(&format!("<tbody data-sid=\"{sid}\"><tr><th>{sid}</th><td class=\"src\">x</td><td class=\"tgt\">"));
            for (src, text) in *spans {
                out.push_str(&format!("<span data-src=\"{src}\">{text}</span>"));
            }
            out.push_str("</td></tr></tbody>\n");
        }
        out.push_str("</table>\n");
        out
    }

    #[test]
    fn render_carries_ordinal_words_and_parse_extracts_chunks_and_edges() {
        let input = causal_input();
        let rendered = render_align_edges(&input);
        assert!(
            rendered.contains("data-ccut-format=\"align-edges/1\""),
            "{rendered}"
        );
        assert!(
            rendered.contains("[1]I [2]didn't [3]go [4]because [5]I [6]was [7]sick."),
            "{rendered}"
        );
        let output = answer(&[
            (
                "s-g1.0",
                &[("4-7", "因为我病了，"), ("1 2 3", "所以没去。")],
            ),
            ("s-g2.0", &[("1", "我们"), ("3", "今天"), ("2", "发布。")]),
        ]);
        let parsed = parse_align_edges(&input, Some(&rendered), &output);
        assert!(
            !parsed.diagnostics.has_problems(),
            "{:?}",
            parsed.diagnostics
        );
        let group = parsed.group("s-g1.0").unwrap();
        assert_eq!(group.chunks.len(), 2);
        assert_eq!(group.chunks[0].ordinals, vec![3, 4, 5, 6]);
        assert_eq!(group.chunks[1].ordinals, vec![0, 1, 2]);
        assert_eq!(group.text, "因为我病了，所以没去。");
        let edges = chunks_to_edges(&group.chunks, "因为我病了，所以没去。");
        assert_eq!(edges.len(), 7);
        assert!(
            edges
                .iter()
                .all(|edge| !edge.hard && edge.weight == CHUNK_EDGE_WEIGHT)
        );
        assert_eq!(edges[0].src, 3);
        assert_eq!(edges[0].tgt, 0..5, "the first chunk runs up to 「了」 (punctuation not counted)");
        assert_eq!(edges[4].src, 0);
        assert_eq!(edges[4].tgt, 6..10);
    }

    #[test]
    fn plain_text_outside_spans_is_an_unattributed_chunk_and_no_span_is_a_warning() {
        let input = causal_input();
        let output = concat!(
            "<table><tbody data-sid=\"s-g1.0\"><tr><th>s-g1.0</th><td class=\"src\">x</td>",
            "<td class=\"tgt\">因为<span data-src=\"5-7\">我病了，</span>所以<span data-src=\"1-3\">没去。</span></td></tr></tbody>",
            "<tbody data-sid=\"s-g2.0\"><tr><th>s-g2.0</th><td class=\"src\">x</td><td class=\"tgt\">我们今天发布。</td></tr></tbody></table>",
        );
        let parsed = parse_align_edges(&input, None, output);
        assert!(
            !parsed.diagnostics.has_problems(),
            "{:?}",
            parsed.diagnostics
        );
        let group = parsed.group("s-g1.0").unwrap();
        assert_eq!(group.chunks.len(), 4);
        assert!(group.chunks[0].ordinals.is_empty());
        assert_eq!(group.chunks[0].text, "因为");
        assert_eq!(group.chunks[1].ordinals, vec![4, 5, 6]);
        let plain = parsed.group("s-g2.0").unwrap();
        assert!(plain.chunks.is_empty());
        assert!(
            parsed
                .diagnostics
                .warnings
                .iter()
                .any(|warning| warning.code == WarningCode::ContentIgnored)
        );
        // Unannotated blocks produce no edges; chunks_to_edges can still locate past them in order.
        let edges = chunks_to_edges(&group.chunks, "因为我病了，所以没去。");
        assert_eq!(edges.len(), 6);
        assert_eq!(edges[0].tgt, 2..5);
    }

    #[test]
    fn text_drift_bad_ordinals_and_duplicates_are_sentence_problems() {
        let input = causal_input();
        let output = answer(&[
            (
                "s-g1.0",
                &[("4-7", "因为我生病了，"), ("1 2 3", "所以没去。")],
            ),
            (
                "s-g2.0",
                &[("1 9", "我们"), ("2", "今天"), ("2,3", "发布。")],
            ),
        ]);
        let parsed = parse_align_edges(&input, None, &output);
        let codes: Vec<(ProblemCode, String)> = parsed
            .diagnostics
            .problems
            .iter()
            .map(|problem| (problem.code, problem.scope.describe()))
            .collect();
        assert!(
            codes.iter().any(
                |(code, scope)| *code == ProblemCode::AlignEdgeText && scope.contains("s-g1.0")
            ),
            "{codes:?}"
        );
        assert!(
            codes
                .iter()
                .any(|(code, scope)| *code == ProblemCode::AlignEdgeOrdinal
                    && scope.contains("s-g2.0")),
            "{codes:?}"
        );
        let detail = &parsed
            .diagnostics
            .problems
            .iter()
            .find(|problem| problem.code == ProblemCode::AlignEdgeOrdinal)
            .unwrap()
            .detail;
        assert!(detail.contains("exceeds the source word count 3"), "{detail}");
        assert!(detail.contains("references source word 2 again"), "{detail}");
        // A problematic sentence does not stop another sentence from being parsed normally.
        assert_eq!(parsed.groups.len(), 2);
    }

    #[test]
    fn missing_suffix_is_truncation_and_scattered_missing_is_missing_id() {
        let input = causal_input();
        let only_first = answer(&[("s-g1.0", &[("4-7", "因为我病了，"), ("1-3", "所以没去。")])]);
        let parsed = parse_align_edges(&input, None, &only_first);
        assert!(parsed.diagnostics.has_code(ProblemCode::DocumentTruncated));
        assert!(!parsed.diagnostics.has_code(ProblemCode::MissingId));
        let only_second = answer(&[("s-g2.0", &[("1", "我们"), ("3", "今天"), ("2", "发布。")])]);
        let parsed = parse_align_edges(&input, None, &only_second);
        assert!(parsed.diagnostics.has_code(ProblemCode::MissingId));
        assert!(!parsed.diagnostics.has_code(ProblemCode::DocumentTruncated));
        // A bare <tbody> (without the <table> wrapper) can still be recovered.
        let bare = "<tbody data-sid=\"s-g1.0\"><tr><td class=\"src\">x</td><td class=\"tgt\"><span data-src=\"4-7\">因为我病了，</span><span data-src=\"1-3\">所以没去。</span></td></tr></tbody><tbody data-sid=\"s-g2.0\"><tr><td class=\"src\">x</td><td class=\"tgt\"><span data-src=\"1-3\">我们今天发布。</span></td></tr></tbody>";
        let parsed = parse_align_edges(&input, None, bare);
        assert!(
            !parsed.diagnostics.has_problems(),
            "{:?}",
            parsed.diagnostics
        );
        assert_eq!(parsed.groups.len(), 2);
    }

    #[test]
    fn rewrite_mode_guards_amplitude_anchors_and_emptiness() {
        let mut input = AlignEdgesInput::new(
            "zh",
            vec![AlignEdgesSentenceInput {
                id: "s-1".to_owned(),
                source_words: en_words("Revenue grew 40% in 2025 because we cut costs."),
                translation: "因为我们削减了成本，2025 年收入增长了 40%。".to_owned(),
                over_hard: Some("chunk 1 (words 1-9): 24 units > hard 20".to_owned()),
            }],
        );
        input.rewrite = true;
        let rendered = render_align_edges(&input);
        assert!(
            rendered.contains("data-ccut-format=\"align-rewrite/1\""),
            "{rendered}"
        );
        assert!(
            rendered.contains("data-over-hard=\"chunk 1 (words 1-9): 24 units &gt; hard 20\""),
            "{rendered}"
        );

        let good = answer(&[(
            "s-1",
            &[
                ("1-5", "2025 年收入增长了 40%，"),
                ("6-9", "因为我们削减了成本。"),
            ],
        )]);
        let parsed = parse_align_edges(&input, Some(&rendered), &good);
        assert!(
            !parsed.diagnostics.has_problems(),
            "{:?}",
            parsed.diagnostics
        );
        assert_eq!(
            parsed.groups[0].text,
            "2025 年收入增长了 40%，因为我们削减了成本。"
        );

        let dropped = answer(&[(
            "s-1",
            &[
                ("1-5", "去年收入增长了 40%，"),
                ("6-9", "因为我们削减了成本。"),
            ],
        )]);
        let parsed = parse_align_edges(&input, None, &dropped);
        assert!(parsed.diagnostics.has_code(ProblemCode::AlignContentDrift));
        assert!(
            parsed.diagnostics.problems[0].detail.contains("2025"),
            "{:?}",
            parsed.diagnostics
        );

        let bloated = answer(&[(
            "s-1",
            &[(
                "1-9",
                "2025 年公司的整体收入相比去年同期大幅增长了 40%，原因是我们削减了成本。",
            )],
        )]);
        let parsed = parse_align_edges(&input, None, &bloated);
        assert!(parsed.diagnostics.has_code(ProblemCode::AlignContentDrift));

        let empty = answer(&[("s-1", &[("1-9", " ")])]);
        let parsed = parse_align_edges(&input, None, &empty);
        assert!(parsed.diagnostics.has_code(ProblemCode::EmptyTranslation));
    }

    #[test]
    fn ordinal_words_round_trip_including_cjk_atoms() {
        let words: Vec<String> = ["我们", "今天", "[x]", "发布。"]
            .into_iter()
            .map(str::to_owned)
            .collect();
        let rendered = render_ordinal_words(&words);
        assert_eq!(rendered, "[1]我们 [2]今天 [3][x] [4]发布。");
        assert_eq!(parse_ordinal_words(&rendered), words);
        assert!(parse_ordinal_words("no markers here").is_empty());
        assert_eq!(parse_ordinals("1-3, 9 5", 9).unwrap(), vec![0, 1, 2, 8, 4]);
        assert!(parse_ordinals("0", 3).is_err());
        assert!(parse_ordinals("3-2", 3).is_err());
        assert!(parse_ordinals("a", 3).is_err());
        assert_eq!(parse_ordinals("", 3).unwrap(), Vec::<usize>::new());
    }

    #[test]
    fn chunks_to_edges_tolerates_autocorrect_spacing_and_punctuation() {
        let chunks = vec![
            AlignChunk {
                text: "Revenue grew 40%".to_owned(),
                ordinals: vec![0, 1, 2],
            },
            AlignChunk {
                text: "in 2025".to_owned(),
                ordinals: vec![3, 4],
            },
        ];
        // After submission it passes through AutoCorrect: spaces are added between CJK and Latin text, and commas are changed to full-width.
        let target = "Revenue grew 40 %，in 2025.";
        let edges = chunks_to_edges(&chunks, target);
        assert_eq!(edges.len(), 5);
        assert_eq!(edges[0].tgt, 0..15);
        assert_eq!(edges[3].tgt, 18..25);
        // Text does not match ⇒ empty.
        assert!(chunks_to_edges(&chunks, "Something else").is_empty());
    }

    #[test]
    fn render_parse_input_render_is_byte_identical() {
        let mut input = AlignEdgesInput {
            lang: "zh".to_owned(),
            params: TransParams {
                fit: 15,
                soft: 13,
                hard: 19,
            },
            rewrite: false,
            sentences: vec![
                AlignEdgesSentenceInput::new(
                    "s-g1.0",
                    en_words("alpha bravo charlie delta"),
                    "第一段译文需要自然对应，第二段负责收尾。",
                ),
                AlignEdgesSentenceInput::new("s-g2.0", en_words("echo foxtrot"), "回声与狐步。"),
            ],
        };
        let rendered = render_align_edges(&input);
        let recovered = parse_align_edges_input(&rendered).expect("payload is an edges table");
        assert_eq!(recovered, input);
        assert_eq!(render_align_edges(&recovered), rendered);

        input.rewrite = true;
        input.sentences[0].over_hard = Some("chunk 1 (words 1-4): 27 units > hard 19".to_owned());
        let rendered = render_align_edges(&input);
        let recovered = parse_align_edges_input(&rendered).expect("payload is a rewrite table");
        assert_eq!(recovered, input);
        assert_eq!(render_align_edges(&recovered), rendered);
        assert!(parse_align_edges_input("<article><p id=\"s-1\">x</p></article>").is_none());
        assert!(
            parse_align_edges_input(
                "<table data-ccut-format=\"align-table/1\"><tbody data-sid=\"s-1\"></tbody></table>"
            )
            .is_none()
        );
    }

    #[test]
    fn self_roundtrip_of_rendered_payload_has_no_problems() {
        // Feeding the rendered payload (with unannotated spans) back in as an answer: only the ContentIgnored warning.
        let input = causal_input();
        let rendered = render_align_edges(&input);
        let parsed = parse_align_edges(&input, Some(&rendered), &rendered);
        assert!(
            !parsed.diagnostics.has_problems(),
            "{:?}",
            parsed.diagnostics
        );
        assert_eq!(parsed.groups.len(), 2);
        assert!(parsed.groups.iter().all(|group| group.chunks.is_empty()));
    }

    struct Lcg(u64);

    impl Lcg {
        fn next(&mut self) -> u64 {
            self.0 = self
                .0
                .wrapping_mul(6364136223846793005)
                .wrapping_add(1442695040888963407);
            self.0 >> 33
        }

        fn below(&mut self, bound: usize) -> usize {
            (self.next() as usize) % bound.max(1)
        }
    }

    #[test]
    fn property_parse_never_panics_on_garbage() {
        const CHUNKS: &[&str] = &[
            "<", ">", "&", "\"", "'", "/", "=", "table", "tbody", "tr", "td", "th", "span",
            "data-sid", "data-src", "s-g1.0", "1-3", "9", "0", ",", "-", "class", "tgt", "src",
            "甲", "a", " ", "\n", "\u{0000}", "\u{202E}", "```", "<!--", "-->", "&amp;",
        ];
        let input = causal_input();
        let mut rng = Lcg(0x0BAD_C0DE_0000_0011);
        for _ in 0..300 {
            let length = rng.below(40);
            let junk: String = (0..length)
                .map(|_| CHUNKS[rng.below(CHUNKS.len())])
                .collect();
            let first = parse_align_edges(&input, None, &junk);
            let second = parse_align_edges(&input, None, &junk);
            assert_eq!(first, second);
            let _ = parse_align_edges_input(&junk);
            let _ = parse_ordinal_words(&junk);
            let _ = parse_ordinals(&junk, 7);
        }
    }
}
