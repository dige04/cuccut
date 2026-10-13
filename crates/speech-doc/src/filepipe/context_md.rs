//! context.md carrier (§5): rendering and parsing of `ai/context.md` and `ai/context.<lang>.md`.
//!
//! Both documents are "frontmatter + sections + Lock/Origin table" structures. The header row is fixed in English (a machine contract), and `Category` is a closed set. **When glossary parsing fails, `context: None` is returned**, and the caller must keep the old verified context and must never overwrite it with an empty table (§5.1 rebuild rule).

use std::collections::BTreeMap;

use crate::engines::brief::TranslationTone;

use super::common::{
    CONTEXT_DOC_FORMAT, Diagnostics, Problem, ProblemCode, WarningCode, guard_output_size,
    normalize_llm_output, sanitize_inline_text, sanitize_payload_text,
};

/// Header of the `Canonical Terms` table (verified verbatim).
const CANONICAL_HEADER: [&str; 6] = ["Source", "Category", "Variants", "Note", "Lock", "Origin"];
/// Header of the `Bilingual Glossary` table (verified verbatim).
const BILINGUAL_HEADER: [&str; 5] = ["Source", "Target", "Note", "Lock", "Origin"];

/// Maximum number of rows retained for `Canonical Terms` on a single page (retry strategy redesign §2.1).
///
/// Measured: deepseek-v4-flash also writes 论文 (paper), 学习 (study), 嗯 and 啊 (filler words) as term rows, returning 500–1000 rows per page. The row cap is a deterministic truncation, not a reason to reject: the excess is recorded as [`WarningCode::ContentIgnored`] with a dropped count.
pub const ANALYSIS_MAX_TERMS_PER_PAGE: usize = 150;
/// Maximum number of rows in `Canonical Terms` after full-text merging (see [`ANALYSIS_MAX_TERMS_PER_PAGE`]; for the sort basis see `crate::engines::brief::merge_partial_terms`).
pub const ANALYSIS_MAX_TERMS: usize = 400;

/// Parse mode (retry strategy redesign §2.1).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ParseMode {
    /// User-written `ai/context.md` or `context.<lang>.md`: any structural or value defect fails it. The caller keeps the old verified context and must never overwrite it with a half-table.
    Strict,
    /// Model answer: whatever can be resolved in code is resolved (R2 code-first fix). This covers merging duplicate Sources, padding or merging columns, downgrading an unknown Category to `other`, downgrading Lock/Origin, relaxing the header, dropping garbage rows, and truncating row count. All of these only record Warnings. Only two page-fatal cases remain: "neither a glossary section nor any parseable row", and "hard ceiling on size exceeded".
    Model,
}

/// Term merge key: lowercase, with whitespace and ASCII punctuation stripped, so `Yann LeCun`, `yann lecun`, and `Yann-LeCun` fall into the same group. CJK and other characters are kept as is.
///
/// Within-page dedup ([`ParseMode::Model`]) and cross-page merging (`crate::engines::brief::merge_partial_terms`) share this single key, so rows already merged within a page are not treated as two groups in the cross-page stage.
pub fn term_merge_key(source: &str) -> String {
    source
        .chars()
        .filter(|ch| !ch.is_whitespace() && !ch.is_ascii_punctuation())
        .flat_map(char::to_lowercase)
        .collect()
}

/// Junk term-row criterion (deterministic filter for [`ParseMode::Model`]).
///
/// The ASR-correction glossary serves only proper nouns that are easy to misrecognize. Single CJK characters, pure punctuation, pure digits, and response interjections (reusing the speaker-repair whitelist) have no correction value, yet in measurements they take up hundreds or thousands of rows. They are dropped rather than used to reject the page.
pub fn is_junk_term_source(source: &str) -> bool {
    let trimmed = source.trim();
    if trimmed.is_empty() {
        return true;
    }
    let meaningful: Vec<char> = trimmed
        .chars()
        .filter(|ch| ch.is_alphanumeric() || *ch == '\u{200D}')
        .collect();
    if meaningful.is_empty() {
        // Pure punctuation and symbols.
        return true;
    }
    if meaningful.iter().all(|ch| ch.is_numeric()) {
        return true;
    }
    if meaningful.len() == 1 && crate::atomize::is_cjk_text(&meaningful[0].to_string()) {
        return true;
    }
    let normalized: String = trimmed
        .chars()
        .filter(|ch| ch.is_alphanumeric() || ch.is_whitespace() || *ch == '-')
        .flat_map(char::to_lowercase)
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");
    let compact: String = normalized
        .chars()
        .filter(|ch| !ch.is_whitespace())
        .collect();
    crate::engines::speaker_repair::SPEAKER_REPAIR_BACKCHANNEL_LEXICON
        .iter()
        .any(|entry| *entry == normalized || *entry == compact)
}

/// Term category (closed set; an unknown category fails lint).
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum TermCategory {
    /// Product name.
    Product,
    /// Person name.
    Person,
    /// Technical term.
    Tech,
    /// Other proper noun.
    Proper,
    /// Other.
    Other,
}

impl TermCategory {
    /// Literal in the table.
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Product => "product",
            Self::Person => "person",
            Self::Tech => "tech",
            Self::Proper => "proper",
            Self::Other => "other",
        }
    }

    /// Parsed from a table literal (case-sensitive; anything outside the closed set fails).
    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "product" => Some(Self::Product),
            "person" => Some(Self::Person),
            "tech" => Some(Self::Tech),
            "proper" => Some(Self::Proper),
            "other" => Some(Self::Other),
            _ => None,
        }
    }
}

/// Term source: determines priority `user+lock > user > analyzed`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum TermOrigin {
    /// User entry: retained one by one on analysis rerun; deleting or rewriting is forbidden.
    User,
    /// Model entry: the whole table is overwritten on analysis rerun.
    Analyzed,
}

impl TermOrigin {
    /// Literal in the table.
    pub fn as_str(self) -> &'static str {
        match self {
            Self::User => "user",
            Self::Analyzed => "analyzed",
        }
    }

    /// Parsed from a table literal.
    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "user" => Some(Self::User),
            "analyzed" => Some(Self::Analyzed),
            _ => None,
        }
    }
}

/// One row of `Canonical Terms`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CanonicalTerm {
    /// Canonical form (also the row's primary key).
    pub source: String,
    /// Category.
    pub category: TermCategory,
    /// Misrecognized variants that actually appeared in the body text (fabrication forbidden).
    pub variants: Vec<String>,
    /// Note.
    pub note: String,
    /// Whether locked.
    pub locked: bool,
    /// Source.
    pub origin: TermOrigin,
}

impl CanonicalTerm {
    /// Priority: `user+lock` 3 > `user` 2 > `analyzed` 1.
    pub fn priority(&self) -> u8 {
        match (self.origin, self.locked) {
            (TermOrigin::User, true) => 3,
            (TermOrigin::User, false) => 2,
            (TermOrigin::Analyzed, _) => 1,
        }
    }
}

/// One row of `Bilingual Glossary`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BilingualTerm {
    /// Source-language canonical form (row primary key).
    pub source: String,
    /// Target-language rendering.
    pub target: String,
    /// Note.
    pub note: String,
    /// Whether locked. `true` means it is compiled into the required targets (§5.2).
    pub locked: bool,
    /// Source.
    pub origin: TermOrigin,
}

impl BilingualTerm {
    /// Priority: `user+lock` 3 > `user` 2 > `analyzed` 1 (same basis as [`CanonicalTerm::priority`], §5.1).
    pub fn priority(&self) -> u8 {
        match (self.origin, self.locked) {
            (TermOrigin::User, true) => 3,
            (TermOrigin::User, false) => 2,
            (TermOrigin::Analyzed, _) => 1,
        }
    }
}

/// `ai/context.md` (source-language context).
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct SourceContext {
    /// Vocabulary fingerprint.
    pub fingerprint: String,
    /// User reference material fingerprint.
    pub reference_fingerprint: Option<String>,
    /// Overall summary.
    pub summary: String,
    /// Canonical glossary.
    pub terms: Vec<CanonicalTerm>,
}

/// `ai/context.<lang>.md` (target-language context).
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct TargetContext {
    /// Target language tag.
    pub target_lang: String,
    /// Vocabulary fingerprint.
    pub fingerprint: String,
    /// Upstream analysis fingerprint.
    pub analysis_fingerprint: Option<String>,
    /// User instruction fingerprint.
    pub instructions_fingerprint: Option<String>,
    /// Translation tone (closed enum; stored in the frontmatter for verbatim round-trip).
    pub tone: Option<TranslationTone>,
    /// Translation summary.
    pub summary: String,
    /// Bilingual glossary.
    pub glossary: Vec<BilingualTerm>,
    /// Style requirements.
    pub style: String,
    /// Difficulty notes.
    pub difficulties: Vec<String>,
}

/// Parse result: when `context` is `None`, the caller must keep the old verified context.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ContextParsed<T> {
    /// Successfully parsed document; `None` when the structure or table is invalid.
    pub context: Option<T>,
    /// Diagnostics.
    pub diagnostics: Diagnostics,
}

impl<T> ContextParsed<T> {
    fn failed(diagnostics: Diagnostics) -> Self {
        Self {
            context: None,
            diagnostics,
        }
    }
}

// --- Rendering ---

/// Markdown table cell escaping: `|` and `\` must be escaped, and newlines are folded into spaces.
fn escape_cell(text: &str) -> String {
    let inline = sanitize_inline_text(text);
    let mut out = String::with_capacity(inline.len());
    for ch in inline.chars() {
        match ch {
            '\\' => out.push_str("\\\\"),
            '|' => out.push_str("\\|"),
            c => out.push(c),
        }
    }
    out
}

/// Cell unescaping.
fn unescape_cell(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    let mut chars = text.chars();
    while let Some(ch) = chars.next() {
        if ch == '\\' {
            match chars.next() {
                Some('|') => out.push('|'),
                Some('\\') => out.push('\\'),
                Some(other) => {
                    out.push('\\');
                    out.push(other);
                }
                None => out.push('\\'),
            }
        } else {
            out.push(ch);
        }
    }
    out.trim().to_owned()
}

/// Frontmatter value escaping (wrapped in double quotes).
fn escape_front(text: &str) -> String {
    let inline = sanitize_inline_text(text);
    format!("\"{}\"", inline.replace('\\', "\\\\").replace('"', "\\\""))
}

/// Frontmatter value unescaping (quotes optional).
fn unescape_front(text: &str) -> String {
    let trimmed = text.trim();
    let inner = match (
        trimmed.starts_with('"'),
        trimmed.ends_with('"'),
        trimmed.len(),
    ) {
        (true, true, len) if len >= 2 => &trimmed[1..len - 1],
        _ => return trimmed.to_owned(),
    };
    let mut out = String::with_capacity(inner.len());
    let mut chars = inner.chars();
    while let Some(ch) = chars.next() {
        if ch == '\\' {
            match chars.next() {
                Some('"') => out.push('"'),
                Some('\\') => out.push('\\'),
                Some(other) => {
                    out.push('\\');
                    out.push(other);
                }
                None => out.push('\\'),
            }
        } else {
            out.push(ch);
        }
    }
    out
}

fn render_row(cells: &[String]) -> String {
    format!("| {} |\n", cells.join(" | "))
}

fn render_header(header: &[&str]) -> String {
    let mut out = render_row(&header.iter().map(|h| (*h).to_owned()).collect::<Vec<_>>());
    out.push_str(&format!("|{}\n", "---|".repeat(header.len())));
    out
}

/// Render `ai/context.md` (§5.1).
pub fn render_source_context(context: &SourceContext) -> String {
    let mut out = String::from("---\n");
    out.push_str(&format!("format: {}\n", escape_front(CONTEXT_DOC_FORMAT)));
    out.push_str(&format!(
        "fingerprint: {}\n",
        escape_front(&context.fingerprint)
    ));
    if let Some(reference) = &context.reference_fingerprint {
        out.push_str(&format!(
            "referenceFingerprint: {}\n",
            escape_front(reference)
        ));
    }
    out.push_str("---\n\n# Summary\n");
    out.push_str(&render_body(&context.summary));
    out.push_str("\n# Canonical Terms\n");
    out.push_str(&render_header(&CANONICAL_HEADER));
    for term in &context.terms {
        out.push_str(&render_row(&[
            escape_cell(&term.source),
            term.category.as_str().to_owned(),
            escape_cell(&term.variants.join(", ")),
            escape_cell(&term.note),
            if term.locked { "yes" } else { "no" }.to_owned(),
            term.origin.as_str().to_owned(),
        ]));
    }
    out
}

/// Render `ai/context.<lang>.md` (§5.1).
pub fn render_target_context(context: &TargetContext) -> String {
    let mut out = String::from("---\n");
    out.push_str(&format!("format: {}\n", escape_front(CONTEXT_DOC_FORMAT)));
    out.push_str(&format!(
        "targetLang: {}\n",
        escape_front(&context.target_lang)
    ));
    out.push_str(&format!(
        "fingerprint: {}\n",
        escape_front(&context.fingerprint)
    ));
    if let Some(value) = &context.analysis_fingerprint {
        out.push_str(&format!("analysisFingerprint: {}\n", escape_front(value)));
    }
    if let Some(value) = &context.instructions_fingerprint {
        out.push_str(&format!(
            "instructionsFingerprint: {}\n",
            escape_front(value)
        ));
    }
    if let Some(tone) = context.tone {
        let value = match tone {
            TranslationTone::Formal => "formal",
            TranslationTone::Casual => "casual",
        };
        out.push_str(&format!("tone: {}\n", escape_front(value)));
    }
    out.push_str("---\n\n# Translated Summary\n");
    out.push_str(&render_body(&context.summary));
    out.push_str("\n# Bilingual Glossary\n");
    out.push_str(&render_header(&BILINGUAL_HEADER));
    for term in &context.glossary {
        out.push_str(&render_row(&[
            escape_cell(&term.source),
            escape_cell(&term.target),
            escape_cell(&term.note),
            if term.locked { "yes" } else { "no" }.to_owned(),
            term.origin.as_str().to_owned(),
        ]));
    }
    out.push_str("\n# Translation Style\n");
    out.push_str(&render_body(&context.style));
    out.push_str("\n# Difficulties\n");
    for item in &context.difficulties {
        out.push_str(&format!("- {}\n", sanitize_inline_text(item)));
    }
    out
}

/// Body section rendering: sanitizes control characters and guarantees it ends with a newline.
fn render_body(text: &str) -> String {
    let cleaned = sanitize_payload_text(text);
    let trimmed = cleaned.trim();
    if trimmed.is_empty() {
        return String::new();
    }
    format!("{trimmed}\n")
}

// --- Parsing ---

struct Document {
    front: BTreeMap<String, String>,
    sections: Vec<(String, Vec<String>)>,
}

impl Document {
    fn section(&self, name: &str) -> Option<&[String]> {
        self.sections
            .iter()
            .find(|(title, _)| title == name)
            .map(|(_, lines)| lines.as_slice())
    }

    /// Section lookup insensitive to case and whitespace ([`ParseMode::Model`]).
    fn section_lenient(&self, name: &str) -> Option<&[String]> {
        self.sections
            .iter()
            .find(|(title, _)| title.trim().eq_ignore_ascii_case(name))
            .map(|(_, lines)| lines.as_slice())
    }

    /// Case-insensitive body value lookup ([`ParseMode::Model`]).
    fn body_lenient(&self, name: &str) -> String {
        self.section_lenient(name)
            .map(|lines| lines.join("\n").trim().to_owned())
            .unwrap_or_default()
    }

    /// Table rows across all sections in the full text (fallback scan when section headings are missing).
    fn all_lines(&self) -> Vec<String> {
        self.sections
            .iter()
            .flat_map(|(_, lines)| lines.iter().cloned())
            .collect()
    }

    fn body(&self, name: &str) -> String {
        self.section(name)
            .map(|lines| lines.join("\n").trim().to_owned())
            .unwrap_or_default()
    }
}

/// Split frontmatter and `# ` sections. Returns `None` when the frontmatter is missing.
fn split_document(text: &str) -> Option<Document> {
    let mut lines = text.lines();
    if lines.next()?.trim() != "---" {
        return None;
    }
    let mut front = BTreeMap::new();
    let mut closed = false;
    for line in lines.by_ref() {
        if line.trim() == "---" {
            closed = true;
            break;
        }
        if let Some((key, value)) = line.split_once(':') {
            front.insert(key.trim().to_owned(), unescape_front(value));
        }
    }
    if !closed {
        return None;
    }
    let mut sections: Vec<(String, Vec<String>)> = Vec::new();
    for line in lines {
        if let Some(title) = line.strip_prefix("# ") {
            sections.push((title.trim().to_owned(), Vec::new()));
        } else if let Some((_, body)) = sections.last_mut() {
            body.push(line.to_owned());
        }
    }
    Some(Document { front, sections })
}

/// Document splitting for [`ParseMode::Model`]: sections are still split when the frontmatter is missing; the fingerprint is stamped by the engine.
///
/// Section heading matching is also relaxed: `# `, `## `, and `###` at any level all count as section headers (the model often writes `# Canonical Terms` as `## Canonical Terms`). Headings are saved after trim, and [`Document::section`] does a case-insensitive comparison.
fn split_document_lenient(text: &str) -> Document {
    if let Some(document) = split_document(text) {
        return document;
    }
    let mut front = BTreeMap::new();
    let mut sections: Vec<(String, Vec<String>)> = Vec::new();
    let mut lines = text.lines().peekable();
    // If the frontmatter is not closed, `key: value` lines at the top are still accepted.
    while let Some(line) = lines.peek() {
        let trimmed = line.trim();
        if trimmed == "---" {
            lines.next();
            continue;
        }
        if trimmed.starts_with('#') || trimmed.starts_with('|') {
            break;
        }
        match trimmed.split_once(':') {
            Some((key, value)) if !key.trim().is_empty() && !key.contains(' ') => {
                front.insert(key.trim().to_owned(), unescape_front(value));
                lines.next();
            }
            _ => break,
        }
    }
    // Loose lines before the first section heading are grouped into an anonymous section, so the table scan can still find them.
    sections.push((String::new(), Vec::new()));
    for line in lines {
        let trimmed = line.trim_start();
        if let Some(title) = trimmed
            .strip_prefix("### ")
            .or_else(|| trimmed.strip_prefix("## "))
            .or_else(|| trimmed.strip_prefix("# "))
        {
            sections.push((title.trim().to_owned(), Vec::new()));
        } else if let Some((_, body)) = sections.last_mut() {
            body.push(line.to_owned());
        }
    }
    Document { front, sections }
}

/// Extract table rows from a section body (excluding the header and separator rows); returns `None` when the header does not match.
fn table_rows(lines: &[String], header: &[&str]) -> Option<Vec<Vec<String>>> {
    let mut rows = Vec::new();
    let mut seen_header = false;
    let mut seen_divider = false;
    for line in lines {
        let trimmed = line.trim();
        if !trimmed.starts_with('|') {
            continue;
        }
        let cells = split_row(trimmed);
        if !seen_header {
            if cells.len() != header.len()
                || cells
                    .iter()
                    .zip(header.iter())
                    .any(|(cell, expected)| cell != expected)
            {
                return None;
            }
            seen_header = true;
            continue;
        }
        if !seen_divider {
            if cells.iter().all(|cell| {
                !cell.is_empty() && cell.chars().all(|c| c == '-' || c == ':' || c == ' ')
            }) {
                seen_divider = true;
                continue;
            }
            return None;
        }
        rows.push(cells);
    }
    if seen_header && seen_divider {
        Some(rows)
    } else {
        None
    }
}

/// Table row extraction for [`ParseMode::Model`]: header and separator rows are recognized by shape and skipped; all other `|` rows are treated as data rows (mis-sized columns are left to row-level repair).
///
/// The header criterion is relaxed to "first cell trimmed and case-insensitively equal to `Source`". The model occasionally omits, adds, or rewrites the header names after that, and the header itself carries no data.
fn table_rows_lenient(lines: &[String]) -> Vec<Vec<String>> {
    let mut rows = Vec::new();
    let mut seen_header = false;
    for line in lines {
        let trimmed = line.trim();
        if !trimmed.starts_with('|') {
            continue;
        }
        let cells = split_row(trimmed);
        if cells
            .iter()
            .all(|cell| !cell.is_empty() && cell.chars().all(|c| c == '-' || c == ':' || c == ' '))
        {
            continue;
        }
        if !seen_header
            && cells
                .first()
                .is_some_and(|cell| cell.trim().eq_ignore_ascii_case("source"))
        {
            seen_header = true;
            continue;
        }
        rows.push(cells);
    }
    rows
}

/// Column-count repair for [`ParseMode::Model`]: pulls rows of any column count back to a fixed `width` columns.
///
/// - `> width`: the middle columns (the extra part after `[2..len-2]`) are merged back into the note column, so a row still works when the model forgot to escape a `|` in a note;
/// - `< width` and ≥2: missing columns are padded with blanks by default (Lock and Origin are then downgraded by value parsing);
/// - only 1 column: returns `None`, and the row is dropped.
///
/// `note_at` is the note column index (canonical table: 3, bilingual table: 2). The two columns after `width` are always `Lock` and `Origin`, so the extra part is merged only into the note.
fn repair_row_width(cells: &[String], width: usize, note_at: usize) -> Option<Vec<String>> {
    if cells.len() == width {
        return Some(cells.to_vec());
    }
    if cells.len() < 2 {
        return None;
    }
    if cells.len() > width {
        let mut repaired: Vec<String> = cells[..note_at].to_vec();
        let tail = cells.len() - 2;
        let note = cells[note_at..tail.max(note_at)]
            .iter()
            .map(|cell| cell.trim())
            .filter(|cell| !cell.is_empty())
            .collect::<Vec<_>>()
            .join(" | ");
        repaired.push(note);
        repaired.push(cells[cells.len() - 2].clone());
        repaired.push(cells[cells.len() - 1].clone());
        debug_assert_eq!(repaired.len(), width);
        return Some(repaired);
    }
    let mut repaired = cells.to_vec();
    repaired.resize(width, String::new());
    Some(repaired)
}

/// Split a line on unescaped `|`.
fn split_row(line: &str) -> Vec<String> {
    let inner = line
        .trim()
        .trim_start_matches('|')
        .trim_end_matches('|')
        .to_owned();
    let mut cells = Vec::new();
    let mut current = String::new();
    let mut escaped = false;
    for ch in inner.chars() {
        if escaped {
            current.push('\\');
            current.push(ch);
            escaped = false;
            continue;
        }
        match ch {
            '\\' => escaped = true,
            '|' => cells.push(std::mem::take(&mut current)),
            c => current.push(c),
        }
    }
    if escaped {
        current.push('\\');
    }
    cells.push(current);
    cells.into_iter().map(|cell| unescape_cell(&cell)).collect()
}

fn parse_lock(value: &str) -> Option<bool> {
    match value {
        "yes" => Some(true),
        "no" => Some(false),
        _ => None,
    }
}

fn parse_variants(value: &str) -> Vec<String> {
    value
        .split(&[',', '，'][..])
        .map(str::trim)
        .filter(|item| !item.is_empty())
        .map(str::to_owned)
        .collect()
}

/// Pre-normalization and size guard; `Err` means it can be rejected outright.
fn prepare(input: Option<&str>, output: &str) -> Result<(String, Diagnostics), Diagnostics> {
    let mut diagnostics = Diagnostics::new();
    let normalized = normalize_llm_output(output);
    for warning in normalized.warnings() {
        diagnostics.push_warning(warning);
    }
    if let Some(input) = input
        && let Some(problem) = guard_output_size(input, &normalized.text)
    {
        diagnostics.push_problem(problem);
        return Err(diagnostics);
    }
    Ok((normalized.text, diagnostics))
}

/// Parse `ai/context.md` ([`ParseMode::Strict`], the user-written document standard).
///
/// `input` is the rendered text actually sent to the model (optional), used only as the baseline for the §16 size guard. Passing `None` skips the size guard, for example when parsing a user-written context.md.
pub fn parse_source_context(input: Option<&str>, output: &str) -> ContextParsed<SourceContext> {
    parse_source_context_with_mode(input, output, ParseMode::Strict)
}

/// Parse `ai/context.md` returned by the model ([`ParseMode::Model`], lenient standard).
///
/// The engine and the agent mirror lint share this entry point. All repairs of [`ParseMode::Model`] only record Warnings, so the mirror lint will not mark an answer `rejected` for defects that can be resolved in code.
pub fn parse_model_source_context(
    input: Option<&str>,
    output: &str,
) -> ContextParsed<SourceContext> {
    parse_source_context_with_mode(input, output, ParseMode::Model)
}

/// Shared implementation of [`parse_source_context`] and [`parse_model_source_context`].
pub fn parse_source_context_with_mode(
    input: Option<&str>,
    output: &str,
    mode: ParseMode,
) -> ContextParsed<SourceContext> {
    if mode == ParseMode::Model {
        return parse_source_context_model(input, output);
    }
    let (text, mut diagnostics) = match prepare(input, output) {
        Ok(value) => value,
        Err(diagnostics) => return ContextParsed::failed(diagnostics),
    };
    let Some(document) = split_document(&text) else {
        diagnostics.push_problem(Problem::document(
            ProblemCode::ContextInvalid,
            "missing frontmatter (key-value block wrapped in `---`)",
        ));
        return ContextParsed::failed(diagnostics);
    };
    let Some(lines) = document.section("Canonical Terms") else {
        diagnostics.push_problem(Problem::document(
            ProblemCode::ContextInvalid,
            "missing `# Canonical Terms` section",
        ));
        return ContextParsed::failed(diagnostics);
    };
    let Some(rows) = table_rows(lines, &CANONICAL_HEADER) else {
        diagnostics.push_problem(Problem::document(
            ProblemCode::ContextInvalid,
            format!(
                "the `Canonical Terms` table header must be exactly {}",
                CANONICAL_HEADER.join(" | ")
            ),
        ));
        return ContextParsed::failed(diagnostics);
    };

    let mut terms: Vec<CanonicalTerm> = Vec::new();
    for row in rows {
        if row.len() != CANONICAL_HEADER.len() {
            diagnostics.push_problem(Problem::document(
                ProblemCode::ContextInvalid,
                format!(
                    "term row has {} columns, expected {}",
                    row.len(),
                    CANONICAL_HEADER.len()
                ),
            ));
            return ContextParsed::failed(diagnostics);
        }
        let source = row[0].clone();
        if source.is_empty() {
            diagnostics.push_problem(Problem::document(
                ProblemCode::ContextInvalid,
                "term row has an empty Source",
            ));
            return ContextParsed::failed(diagnostics);
        }
        let Some(category) = TermCategory::parse(&row[1]) else {
            diagnostics.push_problem(Problem::sentence(
                ProblemCode::ContextInvalid,
                &source,
                format!(
                    "unknown Category `{}` (closed set: product/person/tech/proper/other)",
                    row[1]
                ),
            ));
            return ContextParsed::failed(diagnostics);
        };
        let (Some(locked), Some(origin)) = (parse_lock(&row[4]), TermOrigin::parse(&row[5])) else {
            diagnostics.push_problem(Problem::sentence(
                ProblemCode::ContextInvalid,
                &source,
                format!("invalid Lock/Origin value: `{}` / `{}`", row[4], row[5]),
            ));
            return ContextParsed::failed(diagnostics);
        };
        if terms.iter().any(|term| term.source == source) {
            diagnostics.push_problem(Problem::sentence(
                ProblemCode::DuplicateId,
                &source,
                "the same Source appears on multiple rows",
            ));
            return ContextParsed::failed(diagnostics);
        }
        terms.push(CanonicalTerm {
            source,
            category,
            variants: parse_variants(&row[2]),
            note: row[3].clone(),
            locked,
            origin,
        });
    }

    let summary = document.body("Summary");
    if summary.is_empty() {
        diagnostics.push_warning(super::common::Warning::document(
            WarningCode::ContentIgnored,
            "`# Summary` is empty",
        ));
    }
    ContextParsed {
        context: Some(SourceContext {
            fingerprint: document
                .front
                .get("fingerprint")
                .cloned()
                .unwrap_or_default(),
            reference_fingerprint: document.front.get("referenceFingerprint").cloned(),
            summary,
            terms,
        }),
        diagnostics,
    }
}

/// `ai/context.md` parsing for [`ParseMode::Model`] (retry strategy redesign §2.1).
///
/// Only two page-fatal cases remain: exceeding the hard size ceiling, and having neither a `# Canonical Terms` section nor any table row. Everything else is resolved in code and recorded as a Warning:
///
/// - missing frontmatter → parse as usual (fingerprint stamped by the engine); header matching relaxed to the first cell;
/// - mis-sized columns → [`repair_row_width`]; unknown Category → `other`;
///   illegal Lock or Origin → downgrade (model rows are downgraded anyway);
/// - junk rows ([`is_junk_term_source`]) dropped;
/// - multiple rows for the same Source (by [`term_merge_key`]) → merged (Variants union, Note longest, Category first-seen);
/// - beyond [`ANALYSIS_MAX_TERMS_PER_PAGE`] rows → truncated with a dropped count.
fn parse_source_context_model(input: Option<&str>, output: &str) -> ContextParsed<SourceContext> {
    let (text, mut diagnostics) = match prepare(input, output) {
        Ok(value) => value,
        Err(diagnostics) => return ContextParsed::failed(diagnostics),
    };
    let document = split_document_lenient(&text);
    let has_section = document.section_lenient("Canonical Terms").is_some();
    let owned_all;
    let lines: &[String] = match document.section_lenient("Canonical Terms") {
        Some(lines) => lines,
        None => {
            owned_all = document.all_lines();
            &owned_all
        }
    };
    let rows = table_rows_lenient(lines);
    if !has_section && rows.is_empty() {
        diagnostics.push_problem(Problem::document(
            ProblemCode::ContextInvalid,
            "missing `# Canonical Terms` section, and the document has no parseable table rows at all",
        ));
        return ContextParsed::failed(diagnostics);
    }
    if !has_section {
        diagnostics.push_warning(super::common::Warning::document(
            WarningCode::RowRepaired,
            "missing `# Canonical Terms` section; accepted the table rows found in the document",
        ));
    }

    let mut repaired_rows = 0usize;
    let mut dropped_rows = 0usize;
    let mut demoted = 0usize;
    let mut merged_rows = 0usize;
    let mut terms: Vec<CanonicalTerm> = Vec::new();
    let mut index_of: BTreeMap<String, usize> = BTreeMap::new();
    for row in rows {
        let original_width = row.len();
        let Some(row) = repair_row_width(&row, CANONICAL_HEADER.len(), 3) else {
            dropped_rows += 1;
            continue;
        };
        repaired_rows += usize::from(original_width != CANONICAL_HEADER.len());
        let source = row[0].trim().to_owned();
        if is_junk_term_source(&source) {
            dropped_rows += 1;
            continue;
        }
        let category = TermCategory::parse(row[1].trim()).unwrap_or_else(|| {
            demoted += 1;
            TermCategory::Other
        });
        // Lock and Origin are the user channel: model rows are downgraded whatever they write, and illegal values are the same thing.
        if parse_lock(row[4].trim()).is_none() || TermOrigin::parse(row[5].trim()).is_none() {
            demoted += 1;
        }
        let key = term_merge_key(&source);
        if key.is_empty() {
            dropped_rows += 1;
            continue;
        }
        let variants = parse_variants(&row[2]);
        let note = row[3].trim().to_owned();
        match index_of.get(&key) {
            Some(&slot) => {
                merged_rows += 1;
                let term: &mut CanonicalTerm = &mut terms[slot];
                for variant in variants {
                    if !term
                        .variants
                        .iter()
                        .any(|seen| seen.eq_ignore_ascii_case(&variant))
                    {
                        term.variants.push(variant);
                    }
                }
                if note.chars().count() > term.note.chars().count() {
                    term.note = note;
                }
            }
            None => {
                index_of.insert(key, terms.len());
                terms.push(CanonicalTerm {
                    source,
                    category,
                    variants,
                    note,
                    locked: false,
                    origin: TermOrigin::Analyzed,
                });
            }
        }
    }
    if merged_rows > 0 {
        diagnostics.push_warning(super::common::Warning::document(
            WarningCode::DuplicateId,
            format!("the same Source appears on multiple rows; merged {merged_rows} rows"),
        ));
    }
    if repaired_rows > 0 || demoted > 0 {
        diagnostics.push_warning(super::common::Warning::document(
            WarningCode::RowRepaired,
            format!("deterministically repaired {repaired_rows} rows' column counts and {demoted} invalid values"),
        ));
    }
    if dropped_rows > 0 {
        diagnostics.push_warning(super::common::Warning::document(
            WarningCode::ContentIgnored,
            format!(
                "dropped {dropped_rows} unusable term rows (empty Source / single character / pure punctuation or digits / interjection)"
            ),
        ));
    }
    if terms.len() > ANALYSIS_MAX_TERMS_PER_PAGE {
        let overflow = terms.len() - ANALYSIS_MAX_TERMS_PER_PAGE;
        terms.truncate(ANALYSIS_MAX_TERMS_PER_PAGE);
        diagnostics.push_warning(super::common::Warning::document(
            WarningCode::ContentIgnored,
            format!("term rows exceed the per-page limit of {ANALYSIS_MAX_TERMS_PER_PAGE}; dropped the last {overflow} rows"),
        ));
    }

    let summary = document.body_lenient("Summary");
    if summary.is_empty() {
        diagnostics.push_warning(super::common::Warning::document(
            WarningCode::ContentIgnored,
            "`# Summary` is empty",
        ));
    }
    ContextParsed {
        context: Some(SourceContext {
            fingerprint: document
                .front
                .get("fingerprint")
                .cloned()
                .unwrap_or_default(),
            reference_fingerprint: document.front.get("referenceFingerprint").cloned(),
            summary,
            terms,
        }),
        diagnostics,
    }
}

/// Parse `ai/context.<lang>.md` ([`ParseMode::Strict`]).
///
/// `input` has the same meaning as in [`parse_source_context`]: the rendered text sent to the model, used only for the size guard.
pub fn parse_target_context(input: Option<&str>, output: &str) -> ContextParsed<TargetContext> {
    parse_target_context_with_mode(input, output, ParseMode::Strict)
}

/// Parse `ai/context.<lang>.md` returned by the model ([`ParseMode::Model`]).
pub fn parse_model_target_context(
    input: Option<&str>,
    output: &str,
) -> ContextParsed<TargetContext> {
    parse_target_context_with_mode(input, output, ParseMode::Model)
}

/// Shared implementation of [`parse_target_context`] and [`parse_model_target_context`].
pub fn parse_target_context_with_mode(
    input: Option<&str>,
    output: &str,
    mode: ParseMode,
) -> ContextParsed<TargetContext> {
    if mode == ParseMode::Model {
        return parse_target_context_model(input, output);
    }
    let (text, mut diagnostics) = match prepare(input, output) {
        Ok(value) => value,
        Err(diagnostics) => return ContextParsed::failed(diagnostics),
    };
    let Some(document) = split_document(&text) else {
        diagnostics.push_problem(Problem::document(
            ProblemCode::ContextInvalid,
            "missing frontmatter (key-value block wrapped in `---`)",
        ));
        return ContextParsed::failed(diagnostics);
    };
    let Some(lines) = document.section("Bilingual Glossary") else {
        diagnostics.push_problem(Problem::document(
            ProblemCode::ContextInvalid,
            "missing `# Bilingual Glossary` section",
        ));
        return ContextParsed::failed(diagnostics);
    };
    let Some(rows) = table_rows(lines, &BILINGUAL_HEADER) else {
        diagnostics.push_problem(Problem::document(
            ProblemCode::ContextInvalid,
            format!(
                "the `Bilingual Glossary` table header must be exactly {}",
                BILINGUAL_HEADER.join(" | ")
            ),
        ));
        return ContextParsed::failed(diagnostics);
    };

    let mut glossary: Vec<BilingualTerm> = Vec::new();
    for row in rows {
        if row.len() != BILINGUAL_HEADER.len() {
            diagnostics.push_problem(Problem::document(
                ProblemCode::ContextInvalid,
                format!(
                    "term row has {} columns, expected {}",
                    row.len(),
                    BILINGUAL_HEADER.len()
                ),
            ));
            return ContextParsed::failed(diagnostics);
        }
        let source = row[0].clone();
        if source.is_empty() {
            diagnostics.push_problem(Problem::document(
                ProblemCode::ContextInvalid,
                "term row has an empty Source",
            ));
            return ContextParsed::failed(diagnostics);
        }
        let (Some(locked), Some(origin)) = (parse_lock(&row[3]), TermOrigin::parse(&row[4])) else {
            diagnostics.push_problem(Problem::sentence(
                ProblemCode::ContextInvalid,
                &source,
                format!("invalid Lock/Origin value: `{}` / `{}`", row[3], row[4]),
            ));
            return ContextParsed::failed(diagnostics);
        };
        if glossary.iter().any(|term| term.source == source) {
            diagnostics.push_problem(Problem::sentence(
                ProblemCode::DuplicateId,
                &source,
                "the same Source appears on multiple rows",
            ));
            return ContextParsed::failed(diagnostics);
        }
        if row[1].is_empty() {
            // Rows not yet translated are a legal intermediate state (translate-brief only translates rows without a Target), but locked rows must have a Target, otherwise required targets cannot be compiled.
            if locked {
                diagnostics.push_problem(Problem::sentence(
                    ProblemCode::EmptyTranslation,
                    &source,
                    "locked term is missing a Target",
                ));
                return ContextParsed::failed(diagnostics);
            }
        }
        glossary.push(BilingualTerm {
            source,
            target: row[1].clone(),
            note: row[2].clone(),
            locked,
            origin,
        });
    }

    let tone = match document.front.get("tone") {
        Some(value) => match TranslationTone::parse(value) {
            Ok(tone) => Some(tone),
            Err(message) => {
                diagnostics.push_problem(Problem::document(ProblemCode::ContextInvalid, message));
                return ContextParsed::failed(diagnostics);
            }
        },
        None => None,
    };

    let difficulties = document
        .section("Difficulties")
        .map(|lines| {
            lines
                .iter()
                .filter_map(|line| line.trim().strip_prefix("- ").map(str::to_owned))
                .collect()
        })
        .unwrap_or_default();

    ContextParsed {
        context: Some(TargetContext {
            target_lang: document
                .front
                .get("targetLang")
                .cloned()
                .unwrap_or_default(),
            fingerprint: document
                .front
                .get("fingerprint")
                .cloned()
                .unwrap_or_default(),
            analysis_fingerprint: document.front.get("analysisFingerprint").cloned(),
            instructions_fingerprint: document.front.get("instructionsFingerprint").cloned(),
            tone,
            summary: document.body("Translated Summary"),
            glossary,
            style: document.body("Translation Style"),
            difficulties,
        }),
        diagnostics,
    }
}

/// `ai/context.<lang>.md` parsing for [`ParseMode::Model`].
///
/// Same R2 repairs as [`parse_source_context_model`]: missing frontmatter, mismatched header, mis-sized columns, illegal Lock or Origin, and duplicate Source are all resolved in code. A locked row missing `Target` no longer rejects the page either: model rows are downgraded to `Origin=analyzed, Lock=no` anyway, and the engine then restores the user channel from the seed table. Page-fatal remains only: exceeding the hard ceiling, and "neither a glossary section nor any table row".
fn parse_target_context_model(input: Option<&str>, output: &str) -> ContextParsed<TargetContext> {
    let (text, mut diagnostics) = match prepare(input, output) {
        Ok(value) => value,
        Err(diagnostics) => return ContextParsed::failed(diagnostics),
    };
    let document = split_document_lenient(&text);
    let has_section = document.section_lenient("Bilingual Glossary").is_some();
    let owned_all;
    let lines: &[String] = match document.section_lenient("Bilingual Glossary") {
        Some(lines) => lines,
        None => {
            owned_all = document.all_lines();
            &owned_all
        }
    };
    let rows = table_rows_lenient(lines);
    if !has_section && rows.is_empty() {
        diagnostics.push_problem(Problem::document(
            ProblemCode::ContextInvalid,
            "missing `# Bilingual Glossary` section, and the document has no parseable table rows at all",
        ));
        return ContextParsed::failed(diagnostics);
    }

    let mut repaired_rows = 0usize;
    let mut dropped_rows = 0usize;
    let mut merged_rows = 0usize;
    let mut glossary: Vec<BilingualTerm> = Vec::new();
    let mut index_of: BTreeMap<String, usize> = BTreeMap::new();
    for row in rows {
        let original_width = row.len();
        let Some(row) = repair_row_width(&row, BILINGUAL_HEADER.len(), 2) else {
            dropped_rows += 1;
            continue;
        };
        repaired_rows += usize::from(original_width != BILINGUAL_HEADER.len());
        let source = row[0].trim().to_owned();
        if source.is_empty() {
            dropped_rows += 1;
            continue;
        }
        let key = term_merge_key(&source);
        if key.is_empty() {
            dropped_rows += 1;
            continue;
        }
        let target = row[1].trim().to_owned();
        let note = row[2].trim().to_owned();
        match index_of.get(&key) {
            Some(&slot) => {
                merged_rows += 1;
                let term: &mut BilingualTerm = &mut glossary[slot];
                if term.target.is_empty() {
                    term.target = target;
                }
                if note.chars().count() > term.note.chars().count() {
                    term.note = note;
                }
            }
            None => {
                index_of.insert(key, glossary.len());
                glossary.push(BilingualTerm {
                    source,
                    target,
                    note,
                    // Model rows' Lock and Origin are always downgraded; the engine then restores the user channel from the seed table.
                    locked: false,
                    origin: TermOrigin::Analyzed,
                });
            }
        }
    }
    if merged_rows > 0 {
        diagnostics.push_warning(super::common::Warning::document(
            WarningCode::DuplicateId,
            format!("the same Source appears on multiple rows; merged {merged_rows} rows"),
        ));
    }
    if repaired_rows > 0 {
        diagnostics.push_warning(super::common::Warning::document(
            WarningCode::RowRepaired,
            format!("deterministically repaired the column counts of {repaired_rows} rows"),
        ));
    }
    if dropped_rows > 0 {
        diagnostics.push_warning(super::common::Warning::document(
            WarningCode::ContentIgnored,
            format!("dropped {dropped_rows} unusable term rows"),
        ));
    }

    // An illegal tone is downgraded only to "unspecified": it is background hint, not worth rejecting a complete translation table.
    let tone = document
        .front
        .get("tone")
        .and_then(|value| match TranslationTone::parse(value) {
            Ok(tone) => Some(tone),
            Err(message) => {
                diagnostics.push_warning(super::common::Warning::document(
                    WarningCode::ContentIgnored,
                    message,
                ));
                None
            }
        });
    let difficulties = document
        .section_lenient("Difficulties")
        .map(|lines| {
            lines
                .iter()
                .filter_map(|line| line.trim().strip_prefix("- ").map(str::to_owned))
                .collect()
        })
        .unwrap_or_default();

    ContextParsed {
        context: Some(TargetContext {
            target_lang: document
                .front
                .get("targetLang")
                .cloned()
                .unwrap_or_default(),
            fingerprint: document
                .front
                .get("fingerprint")
                .cloned()
                .unwrap_or_default(),
            analysis_fingerprint: document.front.get("analysisFingerprint").cloned(),
            instructions_fingerprint: document.front.get("instructionsFingerprint").cloned(),
            tone,
            summary: document.body_lenient("Translated Summary"),
            glossary,
            style: document.body_lenient("Translation Style"),
            difficulties,
        }),
        diagnostics,
    }
}

/// §5.1 rebuild rule: analysis rerun overwrites the whole table for `Origin=analyzed`, while `Origin=user` rows are retained one by one.
///
/// On a conflict for the same Source, the winner is chosen by [`CanonicalTerm::priority`]. Results are sorted by Source to ensure determinism.
pub fn merge_canonical_terms(
    existing: &[CanonicalTerm],
    regenerated: &[CanonicalTerm],
) -> Vec<CanonicalTerm> {
    let mut merged: BTreeMap<&str, CanonicalTerm> = BTreeMap::new();
    for term in existing
        .iter()
        .filter(|term| term.origin == TermOrigin::User)
    {
        merged.insert(term.source.as_str(), term.clone());
    }
    for term in regenerated {
        let entry = merged.get(term.source.as_str());
        if entry.is_none_or(|current| term.priority() > current.priority()) {
            merged.insert(term.source.as_str(), term.clone());
        }
    }
    merged.into_values().collect()
}

/// The bilingual-table counterpart of [`merge_canonical_terms`] (the target-language side of the §5.1 rebuild rule).
///
/// `Origin=user` rows are retained one by one. A regenerated table can only overwrite rows of lower priority, so user-locked renderings cannot be wiped out by a translate-brief rerun. Results are sorted by Source to ensure determinism.
pub fn merge_bilingual_terms(
    existing: &[BilingualTerm],
    regenerated: &[BilingualTerm],
) -> Vec<BilingualTerm> {
    let mut merged: BTreeMap<&str, BilingualTerm> = BTreeMap::new();
    for term in existing
        .iter()
        .filter(|term| term.origin == TermOrigin::User)
    {
        merged.insert(term.source.as_str(), term.clone());
    }
    for term in regenerated {
        let entry = merged.get(term.source.as_str());
        if entry.is_none_or(|current| term.priority() > current.priority()) {
            merged.insert(term.source.as_str(), term.clone());
        }
    }
    merged.into_values().collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_source() -> SourceContext {
        SourceContext {
            fingerprint: "1024:g1.0:g88.4:ab12cd".to_owned(),
            reference_fingerprint: Some("ref-1".to_owned()),
            summary: "科技访谈，语域偏口语。".to_owned(),
            terms: vec![
                CanonicalTerm {
                    source: "CucCut".to_owned(),
                    category: TermCategory::Product,
                    variants: vec!["宝卡特".to_owned(), "包卡".to_owned()],
                    note: "保持英文大小写".to_owned(),
                    locked: true,
                    origin: TermOrigin::User,
                },
                CanonicalTerm {
                    source: "KV cache".to_owned(),
                    category: TermCategory::Tech,
                    variants: Vec::new(),
                    note: "首次可译，后文统一".to_owned(),
                    locked: false,
                    origin: TermOrigin::Analyzed,
                },
            ],
        }
    }

    fn sample_target() -> TargetContext {
        TargetContext {
            target_lang: "zh".to_owned(),
            fingerprint: "1024:g1.0:g88.4:ab12cd".to_owned(),
            analysis_fingerprint: Some("an-1".to_owned()),
            instructions_fingerprint: Some("in-1".to_owned()),
            tone: Some(TranslationTone::Formal),
            summary: "整体讲增长与产品策略。".to_owned(),
            glossary: vec![BilingualTerm {
                source: "CucCut".to_owned(),
                target: "CucCut".to_owned(),
                note: "产品名保留英文".to_owned(),
                locked: true,
                origin: TermOrigin::User,
            }],
            style: "短句优先，避免翻译腔。".to_owned(),
            difficulties: vec!["双关语较多".to_owned(), "行业黑话".to_owned()],
        }
    }

    #[test]
    fn source_context_render_matches_spec_shape() {
        let rendered = render_source_context(&sample_source());
        assert!(rendered.starts_with("---\n"));
        assert!(rendered.contains("fingerprint: \"1024:g1.0:g88.4:ab12cd\"\n"));
        assert!(rendered.contains("# Summary\n科技访谈，语域偏口语。\n"));
        assert!(rendered.contains("| Source | Category | Variants | Note | Lock | Origin |\n"));
        assert!(
            rendered
                .contains("| CucCut | product | 宝卡特, 包卡 | 保持英文大小写 | yes | user |\n")
        );
    }

    #[test]
    fn source_context_round_trips() {
        let context = sample_source();
        let rendered = render_source_context(&context);
        let parsed = parse_source_context(Some(&rendered), &rendered);
        assert!(
            !parsed.diagnostics.has_problems(),
            "{:?}",
            parsed.diagnostics
        );
        assert_eq!(parsed.context.unwrap(), context);
    }

    #[test]
    fn target_context_round_trips_all_brief_fields() {
        let context = sample_target();
        let rendered = render_target_context(&context);
        let parsed = parse_target_context(Some(&rendered), &rendered);
        assert!(
            !parsed.diagnostics.has_problems(),
            "{:?}",
            parsed.diagnostics
        );
        assert_eq!(parsed.context.unwrap(), context);
    }

    #[test]
    fn empty_tables_and_bodies_round_trip() {
        let context = SourceContext {
            fingerprint: "fp".to_owned(),
            reference_fingerprint: None,
            summary: String::new(),
            terms: Vec::new(),
        };
        let rendered = render_source_context(&context);
        let parsed = parse_source_context(Some(&rendered), &rendered);
        assert_eq!(parsed.context.unwrap(), context);
    }

    #[test]
    fn pipe_and_backslash_in_cells_survive() {
        let mut context = sample_source();
        context.terms[0].note = "含 | 竖线 与 \\ 反斜杠".to_owned();
        context.terms[0].source = "A|B".to_owned();
        let rendered = render_source_context(&context);
        let parsed = parse_source_context(Some(&rendered), &rendered);
        assert_eq!(parsed.context.unwrap(), context);
    }

    #[test]
    fn unknown_category_keeps_old_context() {
        let mut rendered = render_source_context(&sample_source());
        rendered = rendered.replace("| CucCut | product |", "| CucCut | brand |");
        let parsed = parse_source_context(None, &rendered);
        assert!(parsed.context.is_none(), "a failed parse must never return a half-built table");
        assert!(parsed.diagnostics.has_code(ProblemCode::ContextInvalid));
    }

    #[test]
    fn wrong_header_is_rejected() {
        let rendered = render_source_context(&sample_source())
            .replace("| Source | Category |", "| 来源 | 类别 |");
        let parsed = parse_source_context(None, &rendered);
        assert!(parsed.context.is_none());
        assert!(parsed.diagnostics.has_code(ProblemCode::ContextInvalid));
    }

    #[test]
    fn missing_frontmatter_is_rejected() {
        let parsed = parse_source_context(None, "# Summary\nhi\n");
        assert!(parsed.context.is_none());
        assert!(parsed.diagnostics.has_code(ProblemCode::ContextInvalid));
    }

    #[test]
    fn missing_terms_section_is_rejected() {
        let parsed = parse_source_context(None, "---\nfingerprint: \"a\"\n---\n\n# Summary\nhi\n");
        assert!(parsed.context.is_none());
        assert!(parsed.diagnostics.has_code(ProblemCode::ContextInvalid));
    }

    #[test]
    fn duplicate_term_source_is_rejected() {
        let rendered = render_source_context(&sample_source())
            .replace("| KV cache | tech |", "| CucCut | tech |");
        let parsed = parse_source_context(None, &rendered);
        assert!(parsed.context.is_none());
        assert!(parsed.diagnostics.has_code(ProblemCode::DuplicateId));
    }

    #[test]
    fn locked_glossary_row_needs_target() {
        let rendered =
            render_target_context(&sample_target()).replace("| CucCut | CucCut |", "| CucCut |  |");
        let parsed = parse_target_context(None, &rendered);
        assert!(parsed.context.is_none());
        assert!(parsed.diagnostics.has_code(ProblemCode::EmptyTranslation));
    }

    #[test]
    fn unlocked_glossary_row_may_await_translation() {
        let mut context = sample_target();
        context.glossary.push(BilingualTerm {
            source: "KV cache".to_owned(),
            target: String::new(),
            note: String::new(),
            locked: false,
            origin: TermOrigin::Analyzed,
        });
        let rendered = render_target_context(&context);
        let parsed = parse_target_context(Some(&rendered), &rendered);
        assert_eq!(parsed.context.unwrap(), context);
    }

    #[test]
    fn code_fence_wrapper_is_stripped() {
        let rendered = render_source_context(&sample_source());
        let wrapped = format!("```markdown\n{rendered}```\n");
        let parsed = parse_source_context(None, &wrapped);
        assert!(parsed.context.is_some());
        assert!(
            parsed
                .diagnostics
                .warnings
                .iter()
                .any(|w| w.code == WarningCode::WrapperStripped)
        );
    }

    #[test]
    fn control_characters_are_stripped() {
        let rendered = render_source_context(&sample_source()).replace("CucCut", "Cuc\u{202E}Cut");
        let parsed = parse_source_context(None, &rendered);
        let context = parsed.context.unwrap();
        assert_eq!(context.terms[0].source, "CucCut");
    }

    #[test]
    fn oversized_document_is_rejected() {
        let rendered = render_source_context(&sample_source());
        let bloat =
            "啊".repeat(super::super::common::max_output_chars(rendered.chars().count()) + 1);
        let parsed = parse_source_context(Some(&rendered), &bloat);
        assert!(parsed.context.is_none());
        assert!(parsed.diagnostics.has_code(ProblemCode::DocumentOversize));
    }

    #[test]
    fn merge_keeps_user_rows_and_refreshes_analyzed() {
        let existing = sample_source().terms;
        let regenerated = vec![
            CanonicalTerm {
                source: "CucCut".to_owned(),
                category: TermCategory::Other,
                variants: vec!["爆刻".to_owned()],
                note: "模型重写".to_owned(),
                locked: false,
                origin: TermOrigin::Analyzed,
            },
            CanonicalTerm {
                source: "KV cache".to_owned(),
                category: TermCategory::Tech,
                variants: vec!["KV 缓存".to_owned()],
                note: "更新说明".to_owned(),
                locked: false,
                origin: TermOrigin::Analyzed,
            },
        ];
        let merged = merge_canonical_terms(&existing, &regenerated);
        assert_eq!(merged.len(), 2);
        let cuccut = merged.iter().find(|t| t.source == "CucCut").unwrap();
        assert_eq!(cuccut.origin, TermOrigin::User);
        assert_eq!(cuccut.note, "保持英文大小写");
        let kv = merged.iter().find(|t| t.source == "KV cache").unwrap();
        assert_eq!(kv.variants, vec!["KV 缓存".to_owned()]);
    }

    // --- ParseMode::Model (retry strategy redesign §2.1, R2 code-first fixes) ---

    /// Minimal usable document for Model mode (header complete; rows supplied by the caller).
    fn model_doc(rows: &str) -> String {
        format!(
            "---\nformat: \"context-doc/1\"\nfingerprint: \"\"\n---\n# Summary\n一段摘要。\n\n\
             # Canonical Terms\n| Source | Category | Variants | Note | Lock | Origin |\n\
             |---|---|---|---|---|---|\n{rows}"
        )
    }

    /// The most frequent failure measured: the same Source repeated 6–11 times within one page. The old parser rejected the whole page and retried three rounds. Now they are merged into one row (Variants union, Note longest) and only a Warning is recorded.
    #[test]
    fn model_mode_merges_duplicate_sources_instead_of_rejecting() {
        let rows = "| ResNeXt | tech | res next | | no | analyzed |\n\
                    | resnext | proper | resnet x | 更长的备注说明 | no | analyzed |\n\
                    | Res-NeXt | tech | | | no | analyzed |\n\
                    | DiT | tech | dit | | no | analyzed |\n";
        let parsed = parse_model_source_context(None, &model_doc(rows));
        assert!(
            !parsed.diagnostics.has_problems(),
            "{:?}",
            parsed.diagnostics
        );
        let context = parsed.context.expect("model mode accepts duplicates");
        assert_eq!(context.terms.len(), 2);
        assert_eq!(context.terms[0].source, "ResNeXt");
        // Category takes first-seen, Note takes longest, Variants takes union.
        assert_eq!(context.terms[0].category, TermCategory::Tech);
        assert_eq!(context.terms[0].note, "更长的备注说明");
        assert_eq!(
            context.terms[0].variants,
            vec!["res next".to_owned(), "resnet x".to_owned()]
        );
        assert!(
            parsed
                .diagnostics
                .warnings
                .iter()
                .any(|warning| warning.code == WarningCode::DuplicateId)
        );
        // Strict mode (user-written documents) still fails the whole document, because there duplicates are real conflicts.
        let strict = parse_source_context(
            None,
            &model_doc(
                "| ResNeXt | tech | | | no | analyzed |\n\
                 | ResNeXt | tech | | | no | analyzed |\n",
            ),
        );
        assert!(strict.context.is_none());
        assert!(strict.diagnostics.has_code(ProblemCode::DuplicateId));
    }

    /// Mis-sized columns, unknown Category, and illegal Lock or Origin: all fixed in code, no page rejection.
    #[test]
    fn model_mode_repairs_row_shape_and_illegal_values() {
        let rows = "| CucCut | brand | cook cut | 备注 | 也许 | 模型自封 |\n\
                    | KV cache | tech |\n\
                    | ResNeXt | tech | res next | 前半 | 后半 | 再来 | no | analyzed |\n\
                    | 只有一列 |\n";
        let parsed = parse_model_source_context(None, &model_doc(rows));
        assert!(
            !parsed.diagnostics.has_problems(),
            "{:?}",
            parsed.diagnostics
        );
        let context = parsed.context.expect("model mode repairs rows");
        assert_eq!(context.terms.len(), 3);
        // Unknown Category → other; illegal Lock or Origin → downgrade (model rows are downgraded anyway).
        assert_eq!(context.terms[0].category, TermCategory::Other);
        assert!(!context.terms[0].locked);
        assert_eq!(context.terms[0].origin, TermOrigin::Analyzed);
        // Missing columns padded with defaults.
        assert_eq!(context.terms[1].source, "KV cache");
        assert!(context.terms[1].note.is_empty());
        // Extra columns: middle part merged back into Note.
        assert_eq!(context.terms[2].note, "前半 | 后半 | 再来");
        assert!(
            parsed
                .diagnostics
                .warnings
                .iter()
                .any(|warning| warning.code == WarningCode::RowRepaired)
        );
    }

    /// Deterministic filtering of junk rows: single CJK characters, pure punctuation, pure digits, response interjections.
    #[test]
    fn model_mode_drops_junk_term_rows() {
        let rows = "| 嗯 | other | | | no | analyzed |\n\
                    | 好的 | other | | | no | analyzed |\n\
                    | 的 | other | | | no | analyzed |\n\
                    | ！！！ | other | | | no | analyzed |\n\
                    | 2024 | other | | | no | analyzed |\n\
                    | yeah | other | | | no | analyzed |\n\
                    | 论文集 | other | | | no | analyzed |\n\
                    | CucCut | product | | | no | analyzed |\n";
        let parsed = parse_model_source_context(None, &model_doc(rows));
        let context = parsed.context.expect("junk rows are dropped, not fatal");
        assert_eq!(
            context
                .terms
                .iter()
                .map(|term| term.source.as_str())
                .collect::<Vec<_>>(),
            vec!["论文集", "CucCut"],
            "only single characters, pure punctuation, pure digits and acknowledgement words are dropped"
        );
        assert!(is_junk_term_source("嗯"));
        assert!(is_junk_term_source("OK"));
        assert!(!is_junk_term_source("CucCut"));
        assert!(!is_junk_term_source("KV cache"));
    }

    /// Relaxed header (trim, case-insensitive, first cell only); still accepted when the frontmatter is missing.
    #[test]
    fn model_mode_relaxes_header_and_frontmatter() {
        let text = "## Canonical Terms\n| source | CATEGORY | variants | note | lock | origin |\n\
                    |---|---|---|---|---|---|\n\
                    | CucCut | product | cook cut | | no | analyzed |\n";
        let parsed = parse_model_source_context(None, text);
        assert!(
            !parsed.diagnostics.has_problems(),
            "{:?}",
            parsed.diagnostics
        );
        let context = parsed.context.expect("relaxed header is accepted");
        assert_eq!(context.terms.len(), 1);
        assert_eq!(context.terms[0].source, "CucCut");
        // Strict mode still requires an exact header and frontmatter.
        assert!(parse_source_context(None, text).context.is_none());
    }

    /// Per-page row cap: truncation with a counted warning, never rejects the page (measured: flash returns 500–1000 rows).
    #[test]
    fn model_mode_truncates_oversized_term_tables() {
        let rows: String = (0..1000)
            .map(|index| format!("| Term{index:04} | tech | | | no | analyzed |\n"))
            .collect();
        let parsed = parse_model_source_context(None, &model_doc(&rows));
        assert!(
            !parsed.diagnostics.has_problems(),
            "{:?}",
            parsed.diagnostics
        );
        let context = parsed.context.expect("1000-row table is truncated");
        assert_eq!(context.terms.len(), ANALYSIS_MAX_TERMS_PER_PAGE);
        assert!(
            parsed
                .diagnostics
                .warnings
                .iter()
                .any(|warning| warning.code == WarningCode::ContentIgnored
                    && warning.detail.contains("850"))
        );
    }

    /// Page-fatal remains only two: exceeding the hard ceiling, and having neither a glossary section nor any table row.
    #[test]
    fn model_mode_page_fatal_is_only_shape_free_or_over_cap() {
        let parsed = parse_model_source_context(None, "完全不是一份文档");
        assert!(parsed.context.is_none());
        assert!(parsed.diagnostics.has_code(ProblemCode::ContextInvalid));

        // No section heading but table rows present ⇒ still accepted.
        let loose = "| Source | Category | Variants | Note | Lock | Origin |\n\
                     |---|---|---|---|---|---|\n\
                     | CucCut | product | | | no | analyzed |\n";
        let parsed = parse_model_source_context(None, loose);
        assert_eq!(
            parsed
                .context
                .expect("stray table is recoverable")
                .terms
                .len(),
            1
        );

        // Exceeding the hard ceiling (8× input) is still page-fatal.
        let rendered = render_source_context(&sample_source());
        let bloat =
            "啊".repeat(super::super::common::max_output_chars(rendered.chars().count()) + 1);
        let parsed = parse_model_source_context(Some(&rendered), &bloat);
        assert!(parsed.context.is_none());
        assert!(parsed.diagnostics.has_code(ProblemCode::DocumentOversize));
    }

    /// Model mode for the target-language document: a locked row missing Target no longer rejects the page (the model row is downgraded later), and duplicate Sources are merged.
    #[test]
    fn model_mode_target_context_is_lenient() {
        let text = "---\ntargetLang: \"zh-Hans\"\n---\n# Translated Summary\n摘要\n\n\
                    # Bilingual Glossary\n| Source | Target | Note | Lock | Origin |\n\
                    |---|---|---|---|---|\n\
                    | CucCut |  | | yes | user |\n\
                    | CucCut | 酷剪 | 补上的备注 | yes | user |\n";
        let parsed = parse_model_target_context(None, text);
        assert!(
            !parsed.diagnostics.has_problems(),
            "{:?}",
            parsed.diagnostics
        );
        let context = parsed.context.expect("model mode accepts the glossary");
        assert_eq!(context.glossary.len(), 1);
        assert_eq!(context.glossary[0].target, "酷剪");
        assert_eq!(context.glossary[0].note, "补上的备注");
        assert!(!context.glossary[0].locked);
        assert_eq!(context.glossary[0].origin, TermOrigin::Analyzed);
        // Strict mode still rejects (in a user-written document, locked rows must have a Target).
        assert!(parse_target_context(None, text).context.is_none());
    }

    // --- property tests: fixed-seed LCG, unseeded randomness forbidden ---

    struct Lcg(u64);

    impl Lcg {
        fn next(&mut self) -> u64 {
            self.0 = self
                .0
                .wrapping_mul(6364136223846793005)
                .wrapping_add(1442695040888963407);
            self.0 >> 33
        }

        fn pick<'a>(&mut self, items: &[&'a str]) -> &'a str {
            items[(self.next() as usize) % items.len()]
        }
    }

    #[test]
    fn property_source_context_round_trip_is_identity() {
        const CELLS: &[&str] = &[
            "CucCut",
            "你好世界",
            "mixed 中英",
            "with | pipe",
            "with \\ slash",
            "quote \" and '",
            "",
        ];
        const CATEGORIES: [TermCategory; 5] = [
            TermCategory::Product,
            TermCategory::Person,
            TermCategory::Tech,
            TermCategory::Proper,
            TermCategory::Other,
        ];
        let mut rng = Lcg(0xc0ffee);
        for round in 0..200 {
            let count = (rng.next() as usize) % 5;
            let mut terms = Vec::new();
            for index in 0..count {
                terms.push(CanonicalTerm {
                    source: format!("{}-{index}", rng.pick(CELLS)),
                    category: CATEGORIES[(rng.next() as usize) % CATEGORIES.len()],
                    variants: (0..(rng.next() as usize) % 3)
                        .map(|_| rng.pick(CELLS).to_owned())
                        .filter(|v: &String| !v.is_empty())
                        .collect(),
                    note: rng.pick(CELLS).to_owned(),
                    locked: rng.next().is_multiple_of(2),
                    origin: if rng.next().is_multiple_of(2) {
                        TermOrigin::User
                    } else {
                        TermOrigin::Analyzed
                    },
                });
            }
            let context = SourceContext {
                fingerprint: format!("fp-{round}"),
                reference_fingerprint: if rng.next().is_multiple_of(2) {
                    Some(format!("ref-{round}"))
                } else {
                    None
                },
                summary: rng.pick(CELLS).to_owned(),
                terms,
            };
            let rendered = render_source_context(&context);
            let parsed = parse_source_context(Some(&rendered), &rendered);
            assert!(
                !parsed.diagnostics.has_problems(),
                "{:?}",
                parsed.diagnostics
            );
            assert_eq!(parsed.context.unwrap(), context);
        }
    }

    #[test]
    fn property_parse_never_panics_on_hostile_input() {
        const CHARS: &[char] = &[
            '-', '|', '\\', '"', '#', ':', '\n', ' ', 'a', '你', '\u{0000}', '\u{202E}', '`', '{',
            '}', 'S', 'o', 'u', 'r', 'c', 'e',
        ];
        let mut rng = Lcg(0xfeed_face);
        for _ in 0..500 {
            let len = (rng.next() as usize) % 200;
            let text: String = (0..len)
                .map(|_| CHARS[(rng.next() as usize) % CHARS.len()])
                .collect();
            let _ = parse_source_context(None, &text);
            let _ = parse_target_context(None, &text);
        }
    }
}
