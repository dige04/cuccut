//! filepipe common layer: protocol constants, error codes, diagnostics channel, carrier metadata, and input sanitization.
//!
//! This module has zero I/O, zero clock, and zero randomness; all functions are pure.

use serde::{Deserialize, Serialize};

/// File contract protocol version (written to `protocolVersion` in manifest.json).
pub const PROTOCOL_VERSION: &str = "file-v1";

/// Protocol version of the legacy JSON single-turn contract.
///
/// The file contract kinds have been unified onto [`PROTOCOL_VERSION`]; this constant is only used to recognize kinds whose payload is still a single-turn JSON (`polish-retry`, `segment`, `broll`, `cleanup`) and legacy task directories (including `chapters` tasks from the NDJSON contract before 2026-08).
pub const PROTOCOL_VERSION_JSON: &str = "json-v0";

/// Whether a given LLM call kind goes through the file-v1 file carrier.
///
/// core and the host execution layer share this single criterion: an executor built by `make_llm` is shared by several stages within one command (translate and align use the same `AgentLlm`), and only this function can guarantee that both sides agree on "who writes `.html`" and "who tags `file-v1`".
///
/// The criterion is a **literal exact-match** list of kinds. `polish-retry` (retry of a low-similarity single sentence) is still a json-v0 single-turn contract, and must never be carried into the file carrier by the `polish` entry.
/// `segment-repair` (a targeted segmentation fix after a polish wave: a block of sentences with line numbers, whose answer returns only line-number ranges), `seam-repair` (a page-seam judgment after a polish wave: the tail window of the last segment of page k plus the head window of the first segment of page k+1, in one block on the same index carrier), `punct-repair` (a targeted fix after a polish wave that only adds sentence-final punctuation to over-long sentences), `speaker-repair` (a speaker attribution fix run **before** polish: a window keyed by word numbers, whose answer returns only `start-end label` ranges), and `speaker-names` (speaker real-name inference run at the **end** of polish: opening lines and first-appearance evidence, whose answer returns only `label = name` lines) are all plain-text file carriers.
/// `align-edges` (block alignment edges, the default align carrier) and `align-rewrite` (monotonic display rewrite) are both HTML table carriers (block alignment design §6).
/// `chapters` (Map page: paragraph HTML → chapter title, summary, opening anchor) and `chapters-outline` (Reduce: topic-unit outline → global chapters) are both HTML carriers ([`super::chapters_html`]).
/// `translate-lines` (`--align-fusion lines`) is the line-text carrier for translation ([`super::lines_translation`]), plain text.
pub fn uses_file_contract(kind: &str) -> bool {
    matches!(
        kind,
        "translate"
            | "translate-lines"
            | "polish"
            | "align"
            | "align-edges"
            | "align-rewrite"
            | "analysis"
            | "translate-brief"
            | "segment-repair"
            | "seam-repair"
            | "punct-repair"
            | "speaker-repair"
            | "speaker-names"
            | "chapters"
            | "chapters-outline"
    )
}

/// Material for one page-level attempt, for the host to write `ai/<stage>/…/vNNN/` (§4/§11).
///
/// core does no I/O, takes no clock, and computes no hashes: file names, `sha256`, and timestamps are all filled in by the host. translate and polish share the same shape (see their respective type aliases), so the host does not need a separate artifact writer for each stage.
#[derive(Debug, Clone)]
pub struct PageAttempt<'a> {
    /// Page id (`p001`…; for translate's global residual wave across pages it is `residual`).
    pub page_id: &'a str,
    /// Which attempt this is for the page, 1-based.
    pub attempt: u32,
    /// The render text actually sent (i.e. `DocumentRequest.input.content`).
    pub input: &'a str,
    /// Raw model output, as emitted.
    pub output: &'a str,
    /// Parsed §10 issues.
    pub problems: &'a [Problem],
    /// Whether this page was accepted as a whole.
    pub accepted: bool,
}

/// `data-ccut-format` value of the translate carrier.
pub const TRANSLATION_SOURCE_FORMAT: &str = "translation-source/1";
/// `data-ccut-format` value of the align carrier.
pub const ALIGN_TABLE_FORMAT: &str = "align-table/1";
/// Default align carrier (block alignment design §6.1): `data-ccut-format` value of the block alignment edge table.
pub const ALIGN_EDGES_FORMAT: &str = "align-edges/1";
/// `data-ccut-format` value of the monotonic display rewrite narrow task (block alignment design §6.3).
pub const ALIGN_REWRITE_FORMAT: &str = "align-rewrite/1";
/// Format tag for the polish carrier (plain text has nowhere to put attributes; used only in manifest and request metadata).
pub const POLISH_TEXT_FORMAT: &str = "polish-text/1";
/// Format tag for the context.md carrier (written as `format` in the frontmatter).
pub const CONTEXT_DOC_FORMAT: &str = "context-doc/1";

/// Output size cap coefficient (§16).
///
/// **Hard-ceiling semantics** (retry strategy redesign R2): the guard is no longer a quality criterion of "is the answer too long", but the last gate of "is the payload still worth parsing". Answers that are long but structurally complete (for example, an analysis that also writes common words as term rows) are handled by per-unit rules in each kind that de-duplicate or truncate; only exceeding the hard ceiling counts as page-fatal. The coefficient is therefore raised from 4× to 8×.
pub const OUTPUT_SIZE_MULTIPLIER: usize = 8;
/// Lower bound of the output size cap, so that very short inputs do not drive the threshold to unusable levels.
pub const OUTPUT_SIZE_FLOOR_CHARS: usize = 4096;

/// Input character count → maximum allowed output character count.
pub fn max_output_chars(input_chars: usize) -> usize {
    input_chars
        .saturating_mul(OUTPUT_SIZE_MULTIPLIER)
        .max(OUTPUT_SIZE_FLOOR_CHARS)
}

/// §10 protocol error codes (closed set). Only these codes may enter the retry and audit ledger.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ProblemCode {
    /// Document was truncated (a contiguous suffix of expected ids is missing).
    DocumentTruncated,
    /// Output is wrapped in a code block or small talk and cannot be stripped at zero cost.
    DocumentWrapped,
    /// The input's own frozen content conflicts with the row-count constraints; the plan must be fixed first.
    InputConflict,
    /// Output volume exceeds the limit estimated from the input (§16 additional code).
    DocumentOversize,
    /// Read-only region or source text was modified.
    SourceDrift,
    /// An expected id did not appear (scattered missing).
    MissingId,
    /// Translation is empty.
    EmptyTranslation,
    /// The same id appears more than once.
    DuplicateId,
    /// An id outside the protocol appears.
    UnknownId,
    /// A sentence was moved to a different paragraph or group.
    ParagraphMove,
    /// Frozen content (`data-editable="false"`) was modified.
    FrozenModified,
    /// Locked term does not appear in the translation.
    GlossaryMissing,
    /// The script of the translation's body text clearly does not match the target language.
    TargetLanguageMismatch,
    /// Translation is placeholder text such as TODO / Translation. / 待翻译 ("to be translated").
    TranslationPlaceholder,
    /// Translation copies the source text verbatim.
    TranslationSourceCopy,
    /// A long source sentence received only an abnormally short translation.
    TranslationTooShort,
    /// A large number of sentences on one page collapsed into the same short string.
    TranslationDuplicateCollapse,
    /// Line-text carrier: two adjacent body blocks are nearly identical. The model wrote the same translated passage twice to pad the `≥k` block count. The sentence is rejected and re-asked, so duplicated text does not go into subtitles.
    TranslationChunkRepeat,
    /// Line-piece concatenation result is inconsistent with the sentence-level translation.
    AlignContentDrift,
    /// Line piece exceeds the hard limit.
    AlignOverHard,
    /// Line-piece split falls on an illegal seam.
    AlignIllegalSeam,
    /// Block alignment edge carrier: the concatenated `span` text does not match the translation (block alignment design §6.1).
    AlignEdgeText,
    /// Block alignment edge carrier: `data-src` index is invalid (out of range, unparseable, or duplicated across blocks).
    AlignEdgeOrdinal,
    /// context document structure or values are invalid (unknown Category, header mismatch, missing required section).
    ///
    /// §10 is oriented to the page-level editing stage and does not cover structural validation of context.md. This code is the second addition relative to the design document in this implementation (the first is [`ProblemCode::DocumentOversize`]).
    ContextInvalid,
    /// A single paragraph exceeds the word-count threshold (segmentation degradation: the model did not split paragraphs and merged them into one overlong paragraph).
    /// The main polish page **is not rejected because of it** (the body is accepted on the first round). It only appears in the `segment-repair` index-contract answer after a wave: a block returned only one range while the whole block exceeds the limit, and the detail is the targeted retry instruction (including the minimum number of segments). After the rounds run out, the engine deterministically closes out by pause level, so no over-limit paragraphs remain on exit.
    ParagraphOversize,
    /// The line-number ranges in an index-contract answer (`segment-repair` / `seam-repair`) are illegal: a block is missing, has no range, does not start from 1, is not contiguous end to end, does not cover up to the last line, or goes out of bounds. The detail locates the first defect and is the targeted instruction for the next round.
    RangeInvalid,
    /// A single mapped sentence exceeds the span limit (source characters, duration, or display units) and the model did not split it.
    /// The main polish page **is not rejected because of it**. It only appears in the `punct-repair` targeted-fix answer after a wave: a sentence was restated verbatim without adding any sentence-final punctuation, and the detail is the targeted retry instruction. After the rounds run out, the engine falls back to deterministic sentence splitting on the source timeline.
    SentenceOversize,
    /// Chapter title is empty (chapters carrier: no text inside the title element).
    EmptyTitle,
    /// Chapter count clearly exceeds `data-aim` (chapters-outline carrier: Reduce just copied the outline without merging).
    ChapterOverflow,
    /// Surface-level blemishes: conflicting adjacent punctuation, Latin runs of 20+ letters glued together, dangling fake sentence endings.
    ///
    /// These problems **never reject a page** (retry strategy redesign R1, "advisory / unit"): whatever can be normalized in code is normalized first, and the rest is queued per **sentence** for a re-do (`polish-retry` with `reason = surface-artifact`). When exhausted, the model text is kept and counted. This code replaces the misuse of [`ProblemCode::DocumentOversize`] in polish and punct-repair, which rejected the whole page and re-rolled all sentences because of one sentence's surface blemish.
    SurfaceArtifact,
    /// Invalid real name in a `speaker-names` answer: not in the `label = name` form, an empty value, overlong (the model copied an entire introduction back), contains `=`, or the name itself is still a placeholder label.
    SpeakerNameInvalid,
}

impl ProblemCode {
    /// Machine-readable code string (kebab-case, consistent with the §10 table).
    pub fn as_str(self) -> &'static str {
        match self {
            Self::DocumentTruncated => "document-truncated",
            Self::DocumentWrapped => "document-wrapped",
            Self::InputConflict => "input-conflict",
            Self::DocumentOversize => "document-oversize",
            Self::SourceDrift => "source-drift",
            Self::MissingId => "missing-id",
            Self::EmptyTranslation => "empty-translation",
            Self::DuplicateId => "duplicate-id",
            Self::UnknownId => "unknown-id",
            Self::ParagraphMove => "paragraph-move",
            Self::FrozenModified => "frozen-modified",
            Self::GlossaryMissing => "glossary-missing",
            Self::TargetLanguageMismatch => "target-language-mismatch",
            Self::TranslationPlaceholder => "translation-placeholder",
            Self::TranslationSourceCopy => "translation-source-copy",
            Self::TranslationTooShort => "translation-too-short",
            Self::TranslationDuplicateCollapse => "translation-duplicate-collapse",
            Self::TranslationChunkRepeat => "translation-chunk-repeat",
            Self::AlignContentDrift => "align-content-drift",
            Self::AlignOverHard => "align-over-hard",
            Self::AlignIllegalSeam => "align-illegal-seam",
            Self::AlignEdgeText => "align-edge-text",
            Self::AlignEdgeOrdinal => "align-edge-ordinal",
            Self::ContextInvalid => "context-invalid",
            Self::ParagraphOversize => "paragraph-oversize",
            Self::RangeInvalid => "range-invalid",
            Self::SentenceOversize => "sentence-oversize",
            Self::EmptyTitle => "empty-title",
            Self::ChapterOverflow => "chapter-overflow",
            Self::SpeakerNameInvalid => "speaker-name-invalid",
            Self::SurfaceArtifact => "surface-artifact",
        }
    }
}

impl std::fmt::Display for ProblemCode {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.as_str())
    }
}

/// Non-protocol diagnostic code: for observability only, does not take part in the retry ledger.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum WarningCode {
    /// Stripped a single layer of code-block wrapping (recovered at zero cost).
    WrapperStripped,
    /// Stripped illegal control or invisible characters.
    ControlStripped,
    /// Merged three or more consecutive newlines.
    BlankLinesCollapsed,
    /// Stripped leftover soft markers.
    MarkerResidue,
    /// Dropped unsafe nodes (script, style, iframe…).
    NodeDropped,
    /// Dropped non-whitelisted attributes.
    AttributeDropped,
    /// Neutralized source text that conflicts with a sentinel literal at render time.
    SentinelNeutralized,
    /// `rowspan` does not match the actual number of rows in the group (purely redundant check).
    RowspanMismatch,
    /// Out-of-protocol content that was ignored.
    ContentIgnored,
    /// Paragraph boundary forcibly restored by the program at ⏹.
    BoundaryForced,
    /// An aligned line piece exceeds hard, and the translation has no legal split (giant Latin tokens, where every seam is an objective grammatical error): accepted at submit time, and the engine hard-splits mechanically at hard. When a legal split exists within the piece or the whole sentence, [`ProblemCode::AlignOverHard`] is still reported (with a split hint).
    AlignOverHardUncuttable,
    /// chapters carrier: the anchor id the model wrote does not exist; repaired to the paragraph uniquely matched by its opening snippet.
    AnchorRepaired,
    /// chapters carrier: the anchor id exists, but the opening snippet on the anchor does not match the paragraph's actual opening (the id takes precedence).
    AnchorTextMismatch,
    /// The same id or Source appeared more than once; merged in code, or the first one kept (R2 code-first fix).
    DuplicateId,
    /// Row accepted after deterministic repair: column count padded or merged back, unknown values downgraded, garbage rows dropped.
    RowRepaired,
    /// Sentinel fence missing; core region boundaries inferred from adjacent fences (polish `recover_fences`).
    FenceRecovered,
    /// Conflicting adjacent punctuation normalized in code (keeping the one that expresses the boundary).
    PunctuationNormalized,
    /// Surface-level blemish (dangling fake sentence ending or glued Latin run): only a diagnostic is recorded, not rejected; the engine queues the sentence for a re-do (see [`ProblemCode::SurfaceArtifact`]).
    SurfaceArtifact,
    /// Frozen content was altered or moved; the model text was ignored and the existing translation kept.
    FrozenIgnored,
}

impl WarningCode {
    /// Machine-readable code string.
    pub fn as_str(self) -> &'static str {
        match self {
            Self::WrapperStripped => "wrapper-stripped",
            Self::ControlStripped => "control-stripped",
            Self::BlankLinesCollapsed => "blank-lines-collapsed",
            Self::MarkerResidue => "marker-residue",
            Self::NodeDropped => "node-dropped",
            Self::AttributeDropped => "attribute-dropped",
            Self::SentinelNeutralized => "sentinel-neutralized",
            Self::RowspanMismatch => "rowspan-mismatch",
            Self::ContentIgnored => "content-ignored",
            Self::BoundaryForced => "boundary-forced",
            Self::AlignOverHardUncuttable => "align-over-hard-uncuttable",
            Self::AnchorRepaired => "anchor-repaired",
            Self::AnchorTextMismatch => "anchor-text-mismatch",
            Self::DuplicateId => "duplicate-id",
            Self::RowRepaired => "row-repaired",
            Self::FenceRecovered => "fence-recovered",
            Self::PunctuationNormalized => "punctuation-normalized",
            Self::SurfaceArtifact => "surface-artifact",
            Self::FrozenIgnored => "frozen-ignored",
        }
    }
}

impl std::fmt::Display for WarningCode {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.as_str())
    }
}

/// Problem location info.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum ProblemScope {
    /// Whole document.
    Document,
    /// A single page.
    Page {
        /// Page id (e.g. `p001`).
        id: String,
    },
    /// A sentence or group id (e.g. `s-g1.0`).
    Sentence {
        /// Sentence id.
        id: String,
    },
    /// The n-th paragraph in the core region (0-based).
    Paragraph {
        /// Paragraph index.
        index: usize,
    },
}

impl ProblemScope {
    /// Human-readable location string.
    pub fn describe(&self) -> String {
        match self {
            Self::Document => "document".to_owned(),
            Self::Page { id } => format!("page {id}"),
            Self::Sentence { id } => format!("sentence {id}"),
            Self::Paragraph { index } => format!("paragraph #{index}"),
        }
    }
}

/// Protocol-level problem: machine-readable code, human-readable message, and location.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Problem {
    /// §10 error code.
    pub code: ProblemCode,
    /// Location info.
    pub scope: ProblemScope,
    /// Human-readable explanation (used to feed back to the model).
    pub detail: String,
}

impl Problem {
    /// Document-level problem.
    pub fn document(code: ProblemCode, detail: impl Into<String>) -> Self {
        Self {
            code,
            scope: ProblemScope::Document,
            detail: detail.into(),
        }
    }

    /// Page-level problem.
    pub fn page(code: ProblemCode, id: impl Into<String>, detail: impl Into<String>) -> Self {
        Self {
            code,
            scope: ProblemScope::Page { id: id.into() },
            detail: detail.into(),
        }
    }

    /// Sentence-level problem.
    pub fn sentence(code: ProblemCode, id: impl Into<String>, detail: impl Into<String>) -> Self {
        Self {
            code,
            scope: ProblemScope::Sentence { id: id.into() },
            detail: detail.into(),
        }
    }

    /// Paragraph-level problem.
    pub fn paragraph(code: ProblemCode, index: usize, detail: impl Into<String>) -> Self {
        Self {
            code,
            scope: ProblemScope::Paragraph { index },
            detail: detail.into(),
        }
    }

    /// One-line human-readable description.
    pub fn message(&self) -> String {
        format!("[{}] {}: {}", self.code, self.scope.describe(), self.detail)
    }
}

/// Non-protocol diagnostic.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Warning {
    /// Diagnostic code.
    pub code: WarningCode,
    /// Location info.
    pub scope: ProblemScope,
    /// Human-readable explanation.
    pub detail: String,
}

impl Warning {
    /// Document-level diagnostic.
    pub fn document(code: WarningCode, detail: impl Into<String>) -> Self {
        Self {
            code,
            scope: ProblemScope::Document,
            detail: detail.into(),
        }
    }

    /// Page-level diagnostic.
    pub fn page(code: WarningCode, id: impl Into<String>, detail: impl Into<String>) -> Self {
        Self {
            code,
            scope: ProblemScope::Page { id: id.into() },
            detail: detail.into(),
        }
    }

    /// Sentence-level diagnostic.
    pub fn sentence(code: WarningCode, id: impl Into<String>, detail: impl Into<String>) -> Self {
        Self {
            code,
            scope: ProblemScope::Sentence { id: id.into() },
            detail: detail.into(),
        }
    }

    /// Paragraph-level diagnostic.
    pub fn paragraph(code: WarningCode, index: usize, detail: impl Into<String>) -> Self {
        Self {
            code,
            scope: ProblemScope::Paragraph { index },
            detail: detail.into(),
        }
    }
}

/// All diagnostic output of one parse.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Diagnostics {
    /// Protocol-level problem (enters the retry ledger).
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub problems: Vec<Problem>,
    /// Non-protocol diagnostic (observability only).
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub warnings: Vec<Warning>,
}

impl Diagnostics {
    /// Empty diagnostics.
    pub fn new() -> Self {
        Self::default()
    }

    /// Append a protocol problem.
    pub fn push_problem(&mut self, problem: Problem) {
        self.problems.push(problem);
    }

    /// Append a diagnostic.
    pub fn push_warning(&mut self, warning: Warning) {
        self.warnings.push(warning);
    }

    /// Whether any protocol problem exists.
    pub fn has_problems(&self) -> bool {
        !self.problems.is_empty()
    }

    /// Protocol error codes that occurred (deduplicated, ordered).
    pub fn codes(&self) -> Vec<ProblemCode> {
        let mut codes: Vec<ProblemCode> = self.problems.iter().map(|p| p.code).collect();
        codes.sort_unstable();
        codes.dedup();
        codes
    }

    /// Whether a given error code is hit.
    pub fn has_code(&self, code: ProblemCode) -> bool {
        self.problems.iter().any(|p| p.code == code)
    }
}

/// Carrier format.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DocumentFormat {
    /// Plain text (polish).
    Txt,
    /// Markdown（context/analysis）。
    Markdown,
    /// HTML（translate/align）。
    Html,
    /// JSON (structured artifacts such as the manifest).
    Json,
}

impl DocumentFormat {
    /// File extension (without the dot).
    pub fn extension(self) -> &'static str {
        match self {
            Self::Txt => "txt",
            Self::Markdown => "md",
            Self::Html => "html",
            Self::Json => "json",
        }
    }

    /// Format name used by the protocol.
    pub fn as_str(self) -> &'static str {
        self.extension()
    }
}

/// §9.1 document artifact. core does no I/O: `sha256` is computed by the host and filled in.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentArtifact {
    /// Logical file name (e.g. `p001.src.html`), without path.
    pub name: String,
    /// Carrier format.
    pub format: DocumentFormat,
    /// Full document text.
    pub content: String,
    /// Content digest computed by the host; core neither computes nor verifies it.
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub sha256: String,
}

impl DocumentArtifact {
    /// Construct an artifact (`sha256` left empty, to be filled in by the host).
    pub fn new(
        name: impl Into<String>,
        format: DocumentFormat,
        content: impl Into<String>,
    ) -> Self {
        Self {
            name: name.into(),
            format,
            content: content.into(),
            sha256: String::new(),
        }
    }

    /// Attach the digest computed by the host.
    pub fn with_sha256(mut self, sha256: impl Into<String>) -> Self {
        self.sha256 = sha256.into();
        self
    }
}

/// §9.1 document request: a carrier-agnostic agreement between the execution layer and the LLM.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentRequest {
    /// Stage name (`analysis` / `polish` / `translate` / `align`).
    pub kind: String,
    /// Contract body (prompt and rule description).
    pub contract: String,
    /// Input document to be edited.
    pub input: DocumentArtifact,
    /// Read-only reference documents (context.md, glossary, etc.).
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub references: Vec<DocumentArtifact>,
    /// Expected output format.
    pub output_format: DocumentFormat,
    /// Which attempt this is (0-based).
    pub attempt: u32,
    /// Protocol problems from the previous attempt (fed back to the model).
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub problems: Vec<Problem>,
    /// Sampling temperature.
    pub temperature: f32,
}

impl DocumentRequest {
    /// Construct the first request.
    pub fn new(
        kind: impl Into<String>,
        contract: impl Into<String>,
        input: DocumentArtifact,
        output_format: DocumentFormat,
    ) -> Self {
        Self {
            kind: kind.into(),
            contract: contract.into(),
            input,
            references: Vec::new(),
            output_format,
            attempt: 0,
            problems: Vec::new(),
            temperature: 0.0,
        }
    }
}

/// Whether it is a control or invisible character that is not allowed into a carrier (§16).
///
/// Keeps `\n`, `\t`, and ZWJ/ZWNJ (required for emoji and Indic and Persian scripts).
pub fn is_illegal_payload_char(ch: char) -> bool {
    match ch {
        '\n' | '\t' => false,
        '\u{200C}' | '\u{200D}' => false,
        c if (c as u32) < 0x20 => true,
        '\u{7F}'..='\u{9F}' => true,
        // Directional controls and invisible whitespace
        '\u{200B}' | '\u{200E}' | '\u{200F}' | '\u{FEFF}' => true,
        '\u{202A}'..='\u{202E}' => true,
        '\u{2060}'..='\u{2064}' => true,
        '\u{2066}'..='\u{2069}' => true,
        // Line and paragraph separators: semantically equivalent to newlines, but they break line-oriented parsing
        '\u{2028}' | '\u{2029}' => true,
        _ => false,
    }
}

/// Whether it contains illegal control or invisible characters.
pub fn contains_illegal_chars(text: &str) -> bool {
    text.chars().any(is_illegal_payload_char)
}

/// Render-side sanitization: unify line endings to `\n` and delete illegal control and invisible characters.
pub fn sanitize_payload_text(text: &str) -> String {
    let mut output = String::with_capacity(text.len());
    let mut chars = text.chars().peekable();
    while let Some(ch) = chars.next() {
        match ch {
            '\r' => {
                if chars.peek() == Some(&'\n') {
                    chars.next();
                }
                output.push('\n');
            }
            c if is_illegal_payload_char(c) => {}
            c => output.push(c),
        }
    }
    output
}

/// Single-line sanitization: on top of [`sanitize_payload_text`], fold newlines and tabs into spaces and compress whitespace.
pub fn sanitize_inline_text(text: &str) -> String {
    let cleaned = sanitize_payload_text(text);
    cleaned.split_whitespace().collect::<Vec<_>>().join(" ")
}

/// Normalized model output.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NormalizedOutput {
    /// Normalized text.
    pub text: String,
    /// Whether the BOM was stripped.
    pub bom_stripped: bool,
    /// Whether newline normalization was performed (CR and CRLF → LF).
    pub newlines_normalized: bool,
    /// Whether illegal control characters were stripped.
    pub control_stripped: bool,
    /// Whether a single layer of code-block wrapping was stripped.
    pub wrapper_stripped: bool,
}

impl NormalizedOutput {
    /// Convert the actions taken during normalization into diagnostic items.
    pub fn warnings(&self) -> Vec<Warning> {
        let mut warnings = Vec::new();
        if self.wrapper_stripped {
            warnings.push(Warning::document(
                WarningCode::WrapperStripped,
                "Stripped a single code-fence wrapper",
            ));
        }
        if self.control_stripped {
            warnings.push(Warning::document(
                WarningCode::ControlStripped,
                "Stripped illegal control or invisible characters",
            ));
        }
        warnings
    }
}

/// Pre-parse normalization shared by the four carriers (§10.2 zero-cost recovery):
/// strip BOM → normalize newlines → delete illegal control characters → strip a single layer of code-block wrapping.
pub fn normalize_llm_output(raw: &str) -> NormalizedOutput {
    let (body, bom_stripped) = match raw.strip_prefix('\u{FEFF}') {
        Some(rest) => (rest, true),
        None => (raw, false),
    };
    let newlines_normalized = body.contains('\r');
    let cleaned = sanitize_payload_text(body);
    let control_stripped = body
        .chars()
        .any(|c| c != '\r' && is_illegal_payload_char(c));
    let (text, wrapper_stripped) = strip_single_code_fence(&cleaned);
    NormalizedOutput {
        text,
        bom_stripped,
        newlines_normalized,
        control_stripped,
        wrapper_stripped,
    }
}

/// Strip exactly one complete layer of ``` or ~~~ code-block wrapping; otherwise return unchanged.
fn strip_single_code_fence(text: &str) -> (String, bool) {
    let lines: Vec<&str> = text.lines().collect();
    let fence_indices: Vec<usize> = lines
        .iter()
        .enumerate()
        .filter(|(_, line)| {
            let trimmed = line.trim();
            trimmed.starts_with("```") || trimmed.starts_with("~~~")
        })
        .map(|(index, _)| index)
        .collect();
    if fence_indices.len() != 2 {
        return (text.to_owned(), false);
    }
    let (first, last) = (fence_indices[0], fence_indices[1]);
    let leading_ok = lines[..first].iter().all(|line| line.trim().is_empty());
    let trailing_ok = lines[last + 1..].iter().all(|line| line.trim().is_empty());
    let closing_bare = {
        let trimmed = lines[last].trim();
        trimmed.chars().all(|c| c == '`') || trimmed.chars().all(|c| c == '~')
    };
    if !leading_ok || !trailing_ok || !closing_bare || last <= first {
        return (text.to_owned(), false);
    }
    let mut body = lines[first + 1..last].join("\n");
    if text.ends_with('\n') {
        body.push('\n');
    }
    (body, true)
}

/// Output size guard (§16): exceeding [`max_output_chars`] reports `document-oversize`.
pub fn guard_output_size(input: &str, output: &str) -> Option<Problem> {
    let limit = max_output_chars(input.chars().count());
    let actual = output.chars().count();
    if actual > limit {
        return Some(Problem::document(
            ProblemCode::DocumentOversize,
            format!("Output of {actual} characters exceeds the limit of {limit} characters"),
        ));
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn problem_codes_render_kebab_case() {
        assert_eq!(
            ProblemCode::DocumentTruncated.as_str(),
            "document-truncated"
        );
        assert_eq!(ProblemCode::AlignIllegalSeam.as_str(), "align-illegal-seam");
        let json = serde_json::to_string(&ProblemCode::MissingId).unwrap();
        assert_eq!(json, "\"missing-id\"");
    }

    #[test]
    fn problem_message_includes_scope() {
        let problem = Problem::sentence(ProblemCode::EmptyTranslation, "s-g1.0", "translation is empty");
        assert_eq!(
            problem.message(),
            "[empty-translation] sentence s-g1.0: translation is empty"
        );
    }

    #[test]
    fn sanitize_keeps_emoji_joiners_and_drops_bidi() {
        let text = "a\u{202E}b\u{200B}c\u{0007}d\u{200D}e";
        assert_eq!(sanitize_payload_text(text), "abcd\u{200D}e");
        assert!(contains_illegal_chars(text));
        assert!(!contains_illegal_chars("hello 你好 👍"));
    }

    #[test]
    fn sanitize_normalizes_crlf() {
        assert_eq!(sanitize_payload_text("a\r\nb\rc"), "a\nb\nc");
    }

    #[test]
    fn normalize_strips_single_code_fence() {
        let normalized = normalize_llm_output("```html\n<p>hi</p>\n```\n");
        assert_eq!(normalized.text, "<p>hi</p>\n");
        assert!(normalized.wrapper_stripped);
    }

    #[test]
    fn normalize_keeps_multiple_fences_intact() {
        let raw = "```\na\n```\n中间\n```\nb\n```";
        let normalized = normalize_llm_output(raw);
        assert!(!normalized.wrapper_stripped);
        assert_eq!(normalized.text, raw);
    }

    #[test]
    fn normalize_reports_control_strip() {
        let normalized = normalize_llm_output("\u{FEFF}he\u{0000}llo\r\n");
        assert_eq!(normalized.text, "hello\n");
        assert!(normalized.bom_stripped);
        assert!(normalized.control_stripped);
        assert!(normalized.newlines_normalized);
    }

    /// Hard-ceiling semantics (R2): rejected only beyond 8× the input. In a real incident, an 11k-character input paired with a 50–67k-character answer (flash wrote common words as term rows too) crossed the old 4× line, and all three page retries failed. Raised to 8×, it now parses normally, and the extra rows are de-duplicated and truncated by analysis's per-unit rules.
    #[test]
    fn output_size_guard_uses_input_multiple() {
        assert_eq!(max_output_chars(10), OUTPUT_SIZE_FLOOR_CHARS);
        assert_eq!(max_output_chars(10_000), 80_000);
        let input = "x".repeat(11_000);
        assert!(guard_output_size(&input, &"y".repeat(67_000)).is_none());
        assert!(guard_output_size(&input, &"y".repeat(88_000)).is_none());
        let problem = guard_output_size(&input, &"y".repeat(88_001)).unwrap();
        assert_eq!(problem.code, ProblemCode::DocumentOversize);
    }

    #[test]
    fn diagnostics_dedupe_codes() {
        let mut diagnostics = Diagnostics::new();
        diagnostics.push_problem(Problem::sentence(ProblemCode::MissingId, "a", ""));
        diagnostics.push_problem(Problem::sentence(ProblemCode::MissingId, "b", ""));
        diagnostics.push_warning(Warning::document(WarningCode::ContentIgnored, ""));
        assert_eq!(diagnostics.codes(), vec![ProblemCode::MissingId]);
        assert!(diagnostics.has_code(ProblemCode::MissingId));
        assert!(diagnostics.has_problems());
    }
}
