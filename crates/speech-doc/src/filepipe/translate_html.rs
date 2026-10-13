//! translate carrier (§7): rendering and parsing of the bare-root `<article>` HTML.
//!
//! Rendering emits only sentence-level structure, **with no timestamps and no word ids**; parsing always extracts by `id`,
//! and tag names are not part of the protocol (if the model changes `<p>` to `<div>` but the id is kept, it is still accepted).

use std::collections::{BTreeMap, BTreeSet};

use crate::atomize::normalize_chars;
use crate::engines::align::FusionGroup;
use crate::engines::translate::term_present;
use crate::language_quality::{
    TRANSLATION_VALIDATOR_VERSION, TranslationQualityCode, duplicate_collapse_ids,
    translation_quality_issues,
};

use super::align_edges::{
    AlignChunk, chunks_from_element, parse_ordinal_words, parse_ordinals, render_ordinal_words,
};
use super::common::{
    Diagnostics, Problem, ProblemCode, TRANSLATION_SOURCE_FORMAT, Warning, WarningCode,
    guard_output_size, normalize_llm_output, sanitize_inline_text,
};
use super::html::{Element, escape_attr, escape_text, index_by_id, parse_html};

/// Rendering input for one sentence in the translation carrier.
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct TranslateSentence {
    /// HTML id: `s-<first word id>` in the normal case, a globally unique route id in the multi-source timeline case.
    pub id: String,
    /// Source text (escaped when rendered).
    pub source: String,
    /// Whether the sentence is editable; `false` marks a frozen sentence per §7.6.
    pub editable: bool,
    /// Existing translation: the read-only reference for a frozen sentence, written to `data-translation`.
    ///
    /// It is carried in an attribute rather than an HTML comment so that [`parse_translate_source`] can
    /// rebuild everything validation needs from the rendered text alone (comments are dropped by the sanitizing parser, and escaping cannot be undone).
    pub existing_translation: Option<String>,
    /// Required targets compiled from locked terms (`rt` in §5.2), written as a JSON array to `data-rt`.
    pub required_targets: Vec<String>,
    /// Source id for timeline multi-source routing (written to `data-source-id`).
    pub source_id: Option<String>,
    /// Sentence id for timeline multi-source routing (written to `data-sid`).
    pub sentence_id: Option<String>,
    /// Reading budget for this sentence (in reading units, see the `target_cps_chars` convention), written to `data-budget`.
    ///
    /// The convention matches `data-budget` in the align table: it carries only a relative budget phrase and never seconds;
    /// the value is computed on the engine side as `reading_budget` (display duration × target-language cps) and passed in,
    /// so the carrier only handles the wording. `None` means the attribute is not rendered (frozen sentences, and old payloads without a budget).
    pub budget: Option<usize>,
    /// Source-side hint for when the translation call also produces a display-split draft. The draft in the output is only best-effort
    /// side information; a parse failure never affects acceptance of this sentence's translation.
    pub alignment: Option<TranslateAlignmentInput>,
}

/// Fusion alignment hint for one sentence in the `file-v1` translation carrier (alignment block design §6.1).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TranslateAlignmentInput {
    /// Anchor words within the sentence; order is the index. Rendered as `data-align-words="[1]I [2]didn't …"`
    /// (the same ordinal word string as the `align-edges/1` carrier, see [`render_ordinal_words`]).
    pub source_words: Vec<String>,
    /// “Glue to previous” markers at the same indices as `source_words` ([`crate::doc::Word::glue`]);
    /// empty = none present. Used in-process only: input parsed back from HTML does not carry it.
    pub source_glue: Vec<bool>,
    /// The source side already requires a split; when false, the model may still give a draft if the target translation exceeds fit.
    pub needs_split: bool,
    /// Deterministic source-side grouping (rows mode); rendered as `data-align-groups`. Empty = not rendered.
    pub groups: Vec<FusionGroup>,
}

/// Optional block-alignment draft carried by the translation answer: the target-text semantic blocks marked with `<span data-src="…">` inside `<p>`
/// ([`AlignChunk`], 0-based indices). With the spans stripped, the text equals the `<p>` body verbatim;
/// block merging, bilingual DP and acceptance are done by the align engine.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TranslateAlignmentDraft {
    pub chunks: Vec<AlignChunk>,
    /// The draft is a valid row partition (see [`is_row_partition`]).
    pub rows: bool,
    /// All row boundaries fall on group boundaries of `data-align-groups` (see
    /// [`rows_on_group_boundaries`]). Failing this does not affect acceptance; it is only counted.
    pub on_groups: bool,
}

/// Whether the block sequence forms a valid **row partition**: each block has non-empty indices that increase consecutively; adjacent blocks join end to start;
/// together they cover `0..word_count` exactly; block text is non-empty.
///
/// When satisfied, each block can be stored directly as one display row (the engine still checks whether row boundaries can become block boundaries).
/// Note: being classified as a row partition does **not** mean the rows should be stored as rows. Only drafts in rows mode (carrier has
/// `data-align-groups`) take the direct row path; the normal fusion contract asks for minimal semantic blocks.
pub fn is_row_partition(chunks: &[AlignChunk], word_count: usize) -> bool {
    if chunks.is_empty() || word_count == 0 {
        return false;
    }
    let mut expected = 0usize;
    for chunk in chunks {
        if chunk.text.trim().is_empty() || chunk.ordinals.is_empty() {
            return false;
        }
        if chunk.ordinals[0] != expected {
            return false;
        }
        if chunk.ordinals.windows(2).any(|pair| pair[1] != pair[0] + 1) {
            return false;
        }
        expected = chunk.ordinals[chunk.ordinals.len() - 1] + 1;
    }
    expected == word_count
}

/// Whether all row boundaries fall on the boundaries of the deterministic groups: each row's first index is the first index of some group,
/// and its last index is the last index of some group (i.e. "a row = one group, or the union of several adjacent groups").
///
/// Always `true` when `groups` is empty (no grouping hint means no such constraint).
pub fn rows_on_group_boundaries(chunks: &[AlignChunk], groups: &[FusionGroup]) -> bool {
    if groups.is_empty() {
        return true;
    }
    let starts: BTreeSet<usize> = groups.iter().map(|group| group.from).collect();
    let ends: BTreeSet<usize> = groups.iter().map(|group| group.to).collect();
    chunks.iter().all(|chunk| {
        match (chunk.ordinals.first(), chunk.ordinals.last()) {
            (Some(first), Some(last)) => starts.contains(first) && ends.contains(last),
            // Empty-index blocks are already excluded from the row partition; here they are treated as "not on a group boundary".
            _ => false,
        }
    })
}

/// Rendering of `data-align-groups`: `1-4@0.0-1.4;5-9@1.4-3.2` — indices are 1-based
/// closed ranges, and times are seconds relative to the sentence start (fixed to one decimal place). An empty table returns an empty string (the attribute is not rendered).
pub fn render_align_groups(groups: &[FusionGroup]) -> String {
    groups
        .iter()
        .map(|group| {
            format!(
                "{}-{}@{}-{}",
                group.from + 1,
                group.to + 1,
                format_deciseconds(group.t0_ds),
                format_deciseconds(group.t1_ds),
            )
        })
        .collect::<Vec<_>>()
        .join(";")
}

fn format_deciseconds(value: u32) -> String {
    format!("{}.{}", value / 10, value % 10)
}

fn parse_deciseconds(raw: &str) -> Option<u32> {
    let (whole, fraction) = raw.trim().split_once('.')?;
    let whole: u32 = whole.parse().ok()?;
    let fraction: u32 = (fraction.len() == 1).then(|| fraction.parse().ok())??;
    Some(whole * 10 + fraction)
}

/// The inverse of [`render_align_groups`]. If any item cannot be parsed ⇒ empty table (groups are only a hint,
/// and a parse failure never affects the translation).
pub fn parse_align_groups(raw: &str) -> Vec<FusionGroup> {
    let mut groups = Vec::new();
    for item in raw.split(';').filter(|item| !item.trim().is_empty()) {
        let Some((span, times)) = item.split_once('@') else {
            return Vec::new();
        };
        let (Some((from, to)), Some((t0, t1))) = (span.split_once('-'), times.split_once('-'))
        else {
            return Vec::new();
        };
        let (Ok(from), Ok(to)) = (from.trim().parse::<usize>(), to.trim().parse::<usize>()) else {
            return Vec::new();
        };
        let (Some(t0_ds), Some(t1_ds)) = (parse_deciseconds(t0), parse_deciseconds(t1)) else {
            return Vec::new();
        };
        if from == 0 || to < from {
            return Vec::new();
        }
        groups.push(FusionGroup {
            from: from - 1,
            to: to - 1,
            t0_ds,
            t1_ds,
        });
    }
    groups
}

impl TranslateSentence {
    /// Constructs an editable sentence.
    pub fn new(id: impl Into<String>, source: impl Into<String>) -> Self {
        Self {
            id: id.into(),
            source: source.into(),
            editable: true,
            existing_translation: None,
            required_targets: Vec::new(),
            source_id: None,
            sentence_id: None,
            budget: None,
            alignment: None,
        }
    }

    /// Constructs a frozen sentence (an already-translated sentence kept for context on a stale-only page).
    pub fn frozen(
        id: impl Into<String>,
        source: impl Into<String>,
        translation: impl Into<String>,
    ) -> Self {
        Self {
            editable: false,
            existing_translation: Some(translation.into()),
            ..Self::new(id, source)
        }
    }
}

/// One paragraph (`<section>` is the pagination atom and is never split across pages).
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct TranslateSection {
    /// Paragraph id (`p-<first word id of the paragraph>`).
    pub id: String,
    /// Speaker label, written to `data-sp`. It is only there so the model can adjust tone; it is not required to be written back.
    pub speaker: Option<String>,
    /// Sentences within the paragraph.
    pub sentences: Vec<TranslateSentence>,
}

/// One page of the translation carrier.
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct TranslatePage {
    /// Source language tag.
    pub source_lang: String,
    /// Target language tag.
    pub target_lang: String,
    /// Project fingerprint, written to `data-project-fp`.
    pub project_fingerprint: String,
    /// Context from the tail of the previous page (injected statically as an HTML comment; the model is not asked to output it).
    pub context_before: Option<String>,
    /// Context from the head of the next page.
    pub context_after: Option<String>,
    /// List of paragraphs.
    pub sections: Vec<TranslateSection>,
}

impl TranslatePage {
    /// All sentence ids, listed in rendering order.
    pub fn sentence_ids(&self) -> Vec<&str> {
        self.sections
            .iter()
            .flat_map(|section| section.sentences.iter())
            .map(|sentence| sentence.id.as_str())
            .collect()
    }

    /// Look up a sentence by id.
    pub fn sentence(&self, id: &str) -> Option<&TranslateSentence> {
        self.sections
            .iter()
            .flat_map(|section| section.sentences.iter())
            .find(|sentence| sentence.id == id)
    }

    /// Sentence id → id of the paragraph it belongs to.
    pub fn section_of(&self) -> BTreeMap<&str, &str> {
        let mut map = BTreeMap::new();
        for section in &self.sections {
            for sentence in &section.sentences {
                map.insert(sentence.id.as_str(), section.id.as_str());
            }
        }
        map
    }
}

/// Parse result.
///
/// **The retry criteria are [`page_rejected`](Self::page_rejected) and [`retry_ids`](Self::retry_ids),
/// not `diagnostics.has_problems()`.** Two §10 codes can land on a page whose result is “everything else accepted”: `paragraph-move` on an editable sentence (the layout suggestion is recorded and the translation is still stored as usual) and `unknown-id`
/// (extra nodes have been discarded). If a caller uses `has_problems()` to decide whether to resend, these two cases will retry endlessly.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct TranslateParsed {
    /// Sentence translations that passed validation and can be persisted (sentence id → translation). Frozen sentences are not included.
    pub translations: BTreeMap<String, String>,
    /// Best-effort fusion alignment drafts. Bad drafts are silently dropped and do not enter `retry_ids`, so
    /// a successful submit only proves the translations are correct; it does not mean the draft has been accepted by align.
    pub alignments: BTreeMap<String, TranslateAlignmentDraft>,
    /// Per-sentence alignment drafts from the line-text carrier (`lines/1`, [`super::lines_translation`]);
    /// always empty under the HTML carrier. As with `alignments`: bad drafts are only dropped and do not affect translation acceptance.
    pub lines: BTreeMap<String, super::lines_translation::TranslateLinesDraft>,
    /// Sentence ids that need to go into a repair wave (missing / empty translation / missing term / truncated tail).
    pub retry_ids: Vec<String>,
    /// Whether this whole page is rejected.
    ///
    /// After the retry-strategy redesign (§2.3), only two page-fatal cases remain: the size exceeds the hard cap
    /// (`document-oversize`), and not a single expected sentence was parsed (`document-truncated` /
    /// `document-wrapped`). Duplicate ids, a truncated tail, and frozen sentences being edited or moved have all been downgraded
    /// to unit-level or advisory.
    pub page_rejected: bool,
    /// Diagnostics.
    pub diagnostics: Diagnostics,
}

/// Turns comment text into safe HTML comment content (`--` would close the comment early).
fn escape_comment(text: &str) -> String {
    sanitize_inline_text(text).replace("--", "- -")
}

/// Encoding of `data-rt`: a JSON array, so that any target term (including `"` `<` `&` `/`) round-trips unchanged.
fn encode_required_targets(targets: &[String]) -> String {
    serde_json::to_string(targets).unwrap_or_else(|_| "[]".to_owned())
}

/// Decoding of `data-rt`; an invalid value is treated as “no locked terms”, and never causes the page to be rejected.
fn decode_required_targets(raw: &str) -> Vec<String> {
    serde_json::from_str::<Vec<String>>(raw).unwrap_or_default()
}

/// Extracts the block-alignment draft from the answer's `<p>`: at least one `<span data-src>`, each index
/// valid and not repeated within the sentence, and the concatenated block text (under the [`normalize_chars`] convention) equals the translation. If any
/// condition fails ⇒ `None` (the draft is dropped, the translation is not rejected).
fn fused_chunks(
    element: &Element,
    word_count: usize,
    translation: &str,
) -> Option<Vec<AlignChunk>> {
    let raw_chunks = chunks_from_element(element)?;
    let mut chunks = Vec::with_capacity(raw_chunks.len());
    let mut used = std::collections::BTreeSet::new();
    for (chunk_text, raw) in raw_chunks {
        if chunk_text.trim().is_empty() {
            continue;
        }
        let ordinals = match raw {
            None => Vec::new(),
            Some(raw) => parse_ordinals(&raw, word_count).ok()?,
        };
        if ordinals.iter().any(|ordinal| !used.insert(*ordinal)) {
            return None;
        }
        chunks.push(AlignChunk {
            text: chunk_text,
            ordinals,
        });
    }
    if chunks.is_empty() || chunks.iter().all(|chunk| chunk.ordinals.is_empty()) {
        return None;
    }
    let concat: String = chunks.iter().map(|chunk| chunk.text.as_str()).collect();
    (normalize_chars(&concat) == normalize_chars(translation)).then_some(chunks)
}

/// `data-budget` wording: carries only a relative budget (the whole-sentence character limit), not seconds.
///
/// It follows the same convention as the attribute of the same name in [`super::align_table`]: the unit switches between CJK and other scripts based on the **target language**, and the value itself has already been computed by the engine from the target-language cps.
fn budget_text(budget: usize, target_lang: &str) -> String {
    let unit = if matches!(
        crate::split::primary_subtag(target_lang).as_str(),
        "zh" | "ja" | "ko"
    ) {
        "字"
    } else {
        "字符"
    };
    format!("整句≤{budget}{unit}")
}

/// Renders one page of the translation carrier (§7.1).
pub fn render_translate_page(page: &TranslatePage) -> String {
    let mut out = String::new();
    out.push_str(&format!(
        "<article lang=\"{}\" data-target=\"{}\" data-ccut-format=\"{}\" data-project-fp=\"{}\" data-validator=\"{}\">\n",
        escape_attr(&page.source_lang),
        escape_attr(&page.target_lang),
        escape_attr(TRANSLATION_SOURCE_FORMAT),
        escape_attr(&page.project_fingerprint),
        TRANSLATION_VALIDATOR_VERSION,
    ));
    if let Some(context) = &page.context_before {
        out.push_str(&format!(
            "  <!-- context-before: {} -->\n",
            escape_comment(context)
        ));
    }
    for section in &page.sections {
        out.push_str(&format!("  <section id=\"{}\"", escape_attr(&section.id)));
        if let Some(speaker) = &section.speaker {
            out.push_str(&format!(" data-sp=\"{}\"", escape_attr(speaker)));
        }
        out.push_str(">\n");
        for sentence in &section.sentences {
            out.push_str(&format!("    <p id=\"{}\"", escape_attr(&sentence.id)));
            if let Some(source_id) = &sentence.source_id {
                out.push_str(&format!(" data-source-id=\"{}\"", escape_attr(source_id)));
            }
            if let Some(sid) = &sentence.sentence_id {
                out.push_str(&format!(" data-sid=\"{}\"", escape_attr(sid)));
            }
            if !sentence.editable {
                out.push_str(" data-editable=\"false\"");
            }
            if let Some(budget) = sentence.budget {
                out.push_str(&format!(
                    " data-budget=\"{}\"",
                    escape_attr(&budget_text(budget, &page.target_lang))
                ));
            }
            if let Some(alignment) = sentence.alignment.as_ref().filter(|_| sentence.editable) {
                out.push_str(&format!(
                    " data-align-words=\"{}\" data-align-needed=\"{}\"",
                    escape_attr(&render_ordinal_words(&alignment.source_words)),
                    alignment.needs_split,
                ));
                if !alignment.groups.is_empty() {
                    out.push_str(&format!(
                        " data-align-groups=\"{}\"",
                        escape_attr(&render_align_groups(&alignment.groups))
                    ));
                }
            }
            if !sentence.required_targets.is_empty() {
                out.push_str(&format!(
                    " data-rt=\"{}\"",
                    escape_attr(&encode_required_targets(&sentence.required_targets))
                ));
            }
            if let Some(translation) = &sentence.existing_translation {
                out.push_str(&format!(
                    " data-translation=\"{}\"",
                    escape_attr(&sanitize_inline_text(translation))
                ));
            }
            out.push_str(&format!(
                ">{}</p>\n",
                escape_text(&sanitize_inline_text(&sentence.source))
            ));
        }
        out.push_str("  </section>\n");
    }
    if let Some(context) = &page.context_after {
        out.push_str(&format!(
            "  <!-- context-after: {} -->\n",
            escape_comment(context)
        ));
    }
    out.push_str("</article>\n");
    if let Some(reminder) = fusion_reminder(page) {
        out.push_str(reminder);
    }
    out
}

/// Fusion reminder at the end of the payload (one line of plain text after `</article>`).
///
/// On long documents, the fusion contract in the system prompt gets "diluted": in testing, deepseek on a 59-sentence page only marked rows for the first 3 sentences, and everything else fell back to plain translation. Placing the most critical requirement at the **end** of the user message (where the model reads last) is the least intrusive fix: it changes no protocol and no parsing
/// ([`parse_translate_source`] locates `<article>` via `data-ccut-format`, and trailing text at the root level is always ignored), and it does not affect the §16 size guard (which only looks at length).
///
/// Returns `None` = this page has no fusion sentences, so no reminder is added.
fn fusion_reminder(page: &TranslatePage) -> Option<&'static str> {
    let alignments = page
        .sections
        .iter()
        .flat_map(|section| section.sentences.iter())
        .filter(|sentence| sentence.editable)
        .filter_map(|sentence| sentence.alignment.as_ref());
    let mut any = false;
    let mut rows = false;
    for alignment in alignments {
        any = true;
        rows |= !alignment.groups.is_empty();
    }
    if !any {
        return None;
    }
    Some(if rows {
        "\nReminder: answer with `<p id=\"…\">` and no other attributes. EVERY sentence that carried data-align-groups — all of them, not just the first few — must come back cut into <span data-src=\"a-b\"> display rows.\n"
    } else {
        "\nReminder: answer with `<p id=\"…\">` and no other attributes. EVERY sentence that carried data-align-words must come back with its <span data-src=\"…\"> chunk annotation.\n"
    })
}

/// Recovers a [`TranslatePage`] from rendered text that is **validation-equivalent** (§2: “there is only one validation”).
///
/// `ccut task submit` runs in a separate process and only has the input file on disk and the model's answer; it has no render-side
/// structure. This function lets the agent lint and the provider validate both reach the same [`parse_translate_page`],
/// instead of each keeping its own validation.
///
/// It restores only the **validation-relevant** fields: sentence ids and order, paragraph membership, `editable`, existing translations, and required
/// targets. Source text is refilled from normalized text ([`parse_translate_page`] never reads `source`).
/// Context comments and `budget` are not restored (they are hints for the model and have no corresponding validation item; retry waves
/// are re-rendered by the engine's row projection and do not infer budgets from here).
///
/// Parsing **ignores unknown attributes**: a newly added carrier attribute will not turn an old task directory's `src.html`
/// into a `document-*` problem, and vice versa.
///
/// Returns `None` if this is not a translate carrier (no `data-ccut-format` root found).
pub fn parse_translate_source(input: &str) -> Option<TranslatePage> {
    let tree = parse_html(input);
    let article = tree
        .elements()
        .into_iter()
        .find(|element| element.attr("data-ccut-format") == Some(TRANSLATION_SOURCE_FORMAT))?;
    let mut page = TranslatePage {
        source_lang: article.attr("lang").unwrap_or_default().to_owned(),
        target_lang: article.attr("data-target").unwrap_or_default().to_owned(),
        project_fingerprint: article
            .attr("data-project-fp")
            .unwrap_or_default()
            .to_owned(),
        context_before: None,
        context_after: None,
        sections: Vec::new(),
    };
    for section_element in article.child_elements() {
        let Some(section_id) = section_element.id().filter(|id| !id.is_empty()) else {
            continue;
        };
        let mut section = TranslateSection {
            id: section_id.to_owned(),
            speaker: section_element.attr("data-sp").map(str::to_owned),
            sentences: Vec::new(),
        };
        for element in section_element.descendants() {
            let Some(id) = element.id().filter(|id| !id.is_empty()) else {
                continue;
            };
            section.sentences.push(TranslateSentence {
                id: id.to_owned(),
                source: element.text(),
                editable: element.attr("data-editable") != Some("false"),
                existing_translation: element.attr("data-translation").map(str::to_owned),
                required_targets: element
                    .attr("data-rt")
                    .map(decode_required_targets)
                    .unwrap_or_default(),
                source_id: element.attr("data-source-id").map(str::to_owned),
                sentence_id: element.attr("data-sid").map(str::to_owned),
                budget: None,
                alignment: element
                    .attr("data-align-words")
                    .map(|raw| TranslateAlignmentInput {
                        source_words: parse_ordinal_words(raw),
                        needs_split: element.attr("data-align-needed") == Some("true"),
                        groups: element
                            .attr("data-align-groups")
                            .map(parse_align_groups)
                            .unwrap_or_default(),
                        source_glue: Vec::new(),
                    }),
            });
        }
        page.sections.push(section);
    }
    Some(page)
}

/// Parses and lints the translation HTML returned by the model (§7.4 symptom reconciliation table).
///
/// `page` is the render-side structure: the id set, frozen sentences and required targets all come from here,
/// so the parse entry point does not accept a bare string.
///
/// `input` is the rendered text that was actually sent to the model (on the host side this is `DocumentRequest.input.content`),
/// used only as the baseline for the §16 size guard; passing `None` skips the size guard. parse never calls render itself to infer the length.
pub fn parse_translate_page(
    page: &TranslatePage,
    input: Option<&str>,
    output: &str,
) -> TranslateParsed {
    let mut parsed = TranslateParsed::default();
    let normalized = normalize_llm_output(output);
    for warning in normalized.warnings() {
        parsed.diagnostics.push_warning(warning);
    }
    if let Some(problem) = input.and_then(|input| guard_output_size(input, &normalized.text)) {
        parsed.diagnostics.push_problem(problem);
        parsed.page_rejected = true;
        return parsed;
    }

    let tree = parse_html(&normalized.text);
    for warning in tree.warnings() {
        parsed.diagnostics.push_warning(warning);
    }
    let (index, duplicates) = index_by_id(&tree);

    let expected_sentences: BTreeSet<&str> = page.sentence_ids().into_iter().collect();
    let expected_sections: BTreeSet<&str> = page.sections.iter().map(|s| s.id.as_str()).collect();

    // Duplicate id: keep the **first** one and record a Warning (retry-strategy redesign §2.3).
    //
    // `index_by_id` already keeps the first occurrence, so here we only need to state the trade-off. The old implementation rejected the whole page and retried it; a duplicate id means the model wrote one sentence twice while the rest were fine, so re-generating the whole page just wastes tokens.
    for id in &duplicates {
        if expected_sentences.contains(id.as_str()) || expected_sections.contains(id.as_str()) {
            parsed.diagnostics.push_warning(Warning::sentence(
                WarningCode::DuplicateId,
                id,
                "the same id appears more than once; kept the first",
            ));
        }
    }

    // Unknown id: the criterion is **structure**, not the literal id value.
    //
    // There is more than one id scheme: the usual one is `s-<first word id>`, and the timeline multi-source case uses a globally unique route id
    // (currently `r%06d`). Guessing by prefix whether something "looks like a protocol id" would silently drop hallucinated sentences in the route-id case,
    // so instead we check whether it wraps any expected id on this page:
    // - wraps an expected id → a container the model added itself (such as `<div id="page">`) → ContentIgnored warning,
    //   advisory and not recorded in the retry ledger, so it does not pollute the closed-set semantics of §10;
    // - wraps no expected id → an extra content node that appeared out of nowhere → `unknown-id`.
    for (id, element) in index.iter() {
        if expected_sentences.contains(id.as_str()) || expected_sections.contains(id.as_str()) {
            continue;
        }
        let wraps_expected = element.descendants().into_iter().any(|descendant| {
            descendant.id().is_some_and(|inner| {
                expected_sentences.contains(inner) || expected_sections.contains(inner)
            })
        });
        if wraps_expected {
            parsed.diagnostics.push_warning(Warning::sentence(
                WarningCode::ContentIgnored,
                id,
                "container node added by the model, ignored",
            ));
        } else {
            parsed.diagnostics.push_problem(Problem::sentence(
                ProblemCode::UnknownId,
                id,
                "id outside the protocol, node ignored",
            ));
        }
    }

    // Paragraph membership: flag paragraph-move only when a sentence has landed inside a different known paragraph.
    let mut actual_section: BTreeMap<&str, &str> = BTreeMap::new();
    for section_id in &expected_sections {
        if let Some(element) = index.get(*section_id) {
            for descendant in element.descendants() {
                if let Some(id) = descendant.id()
                    && expected_sentences.contains(id)
                {
                    actual_section.entry(id).or_insert(section_id);
                }
            }
        }
    }
    let expected_section_of = page.section_of();

    let ordered_ids = page.sentence_ids();
    let mut present = Vec::new();
    let mut missing = Vec::new();
    for id in &ordered_ids {
        if index.contains_key(*id) {
            present.push(*id);
        } else {
            missing.push(*id);
        }
    }

    // §9.3: truncation and omission must be told apart — truncation means the whole “contiguous suffix” of expected ids is missing.
    let truncated = !missing.is_empty()
        && !present.is_empty()
        && ordered_ids[ordered_ids.len() - missing.len()..] == missing[..];
    // Not a single expected sentence was parsed: this is no longer “a few sentences missing” but a whole-page failure, so this page is rejected.
    // Criterion: if the output still contains other ids (including section ids) → the structure is there but the sentences are gone, handled as truncation;
    // if the output has no ids at all → the model most likely rewrote or wrapped the whole document, handled as document-wrapped.
    let nothing_parsed = present.is_empty() && !ordered_ids.is_empty();
    if nothing_parsed {
        let has_any_id = !index.is_empty();
        let code = if has_any_id {
            ProblemCode::DocumentTruncated
        } else {
            ProblemCode::DocumentWrapped
        };
        parsed.page_rejected = true;
        parsed.diagnostics.push_problem(Problem::document(
            code,
            format!("no expected sentence id was parsed ({} sentences in total)", ordered_ids.len()),
        ));
        return parsed;
    }
    // Truncation (the contiguous suffix of expected ids is entirely missing) and scattered omissions are now **handled the same way, per unit**
    // (retry-strategy redesign §2.3): parsed sentences are accepted and stored as usual, and missing ids go into `retry_ids`
    // for waves 2/3 to resend. Only when not a single expected sentence is parsed is it page-fatal (the `nothing_parsed`
    // branch above). The old implementation rejected the whole page on truncation, so dozens of sentences translated up front were thrown away.
    if truncated {
        parsed.diagnostics.push_problem(Problem::document(
            ProblemCode::DocumentTruncated,
            format!(
                "the last {} sentences are missing in a row; the output may be truncated. Accepted the first {} sentences; the missing ids go to a make-up wave",
                missing.len(),
                present.len()
            ),
        ));
    }
    for id in &missing {
        parsed.retry_ids.push((*id).to_owned());
        if !truncated {
            parsed.diagnostics.push_problem(Problem::sentence(
                ProblemCode::MissingId,
                *id,
                "the sentence id is missing from the output",
            ));
        }
    }

    for id in present {
        let Some(sentence) = page.sentence(id) else {
            continue;
        };
        let element = index[id];
        let text = element.text();

        // Paragraph membership: an editable sentence moved to another paragraph is a unit-level problem (recorded as a problem as usual, does not reject the page);
        // a frozen sentence moved to another paragraph is downgraded to advisory — the **text of a frozen sentence never enters `translations`**
        // (the `continue` below is the only exit), and the existing translation is kept as-is on the apply side,
        // so moving it has no effect on the truth (retry-strategy redesign §2.3).
        let moved = match (actual_section.get(id), expected_section_of.get(id)) {
            (Some(actual), Some(expected)) => actual != expected,
            _ => false,
        };
        if moved {
            let actual = actual_section[id];
            let expected = expected_section_of[id];
            if sentence.editable {
                parsed.diagnostics.push_problem(Problem::sentence(
                    ProblemCode::ParagraphMove,
                    id,
                    format!("sentence moved to paragraph {actual} (should be in {expected})"),
                ));
            } else {
                parsed.diagnostics.push_warning(Warning::sentence(
                    WarningCode::FrozenIgnored,
                    id,
                    format!("frozen sentence moved to paragraph {actual} (should be in {expected}), ignored"),
                ));
            }
        }

        if !sentence.editable {
            let existing = sentence.existing_translation.as_deref().unwrap_or_default();
            if normalize_chars(&text) != normalize_chars(existing) {
                parsed.diagnostics.push_warning(Warning::sentence(
                    WarningCode::FrozenIgnored,
                    id,
                    "frozen sentence was changed; ignored the model text and kept the existing translation",
                ));
            }
            continue;
        }

        if text.trim().is_empty() {
            parsed.retry_ids.push(id.to_owned());
            parsed.diagnostics.push_problem(Problem::sentence(
                ProblemCode::EmptyTranslation,
                id,
                "the translation is empty",
            ));
            continue;
        }

        let missing_terms: Vec<&str> = sentence
            .required_targets
            .iter()
            .filter(|target| !term_present(&text, target))
            .map(String::as_str)
            .collect();
        if !missing_terms.is_empty() {
            parsed.retry_ids.push(id.to_owned());
            parsed.diagnostics.push_problem(Problem::sentence(
                ProblemCode::GlossaryMissing,
                id,
                format!("locked terms missing: {}", missing_terms.join(", ")),
            ));
            continue;
        }

        // Fusion block-alignment draft (alignment block design §6.1): `<span data-src>` inside `<p>`.
        // Bad drafts are silently dropped and never reject the translation.
        if let Some(alignment) = sentence.alignment.as_ref()
            && let Some(chunks) = fused_chunks(element, alignment.source_words.len(), &text)
        {
            // A row partition is trusted only when the **carrier requested rows**: `data-align-groups` is exactly
            // the carrier signal for rows mode (the normal fusion contract wants minimal semantic blocks; treating them as display rows would cut a sentence into a string of fragments).
            let rows = !alignment.groups.is_empty()
                && is_row_partition(&chunks, alignment.source_words.len());
            let on_groups = rows && rows_on_group_boundaries(&chunks, &alignment.groups);
            parsed.alignments.insert(
                id.to_owned(),
                TranslateAlignmentDraft {
                    chunks,
                    rows,
                    on_groups,
                },
            );
        }
        parsed.translations.insert(id.to_owned(), text);
    }

    if !normalized.text.trim_start().starts_with('<') && !parsed.translations.is_empty() {
        parsed.diagnostics.push_warning(Warning::document(
            WarningCode::ContentIgnored,
            "the output starts with non-HTML content; extracted by id",
        ));
    }

    parsed
}

/// Appends the content quality gate after structural parsing. It is split into an explicit step so that the underlying HTML parser can still be
/// tested on its own for structure recovery; both the production provider and the Agent lint must call this function.
pub fn validate_translation_quality(page: &TranslatePage, parsed: &mut TranslateParsed) {
    let accepted = parsed.translations.clone();
    for (id, text) in accepted {
        let Some(sentence) = page.sentence(&id) else {
            continue;
        };
        let issues = translation_quality_issues(&sentence.source, &page.target_lang, &text);
        if issues.is_empty() {
            continue;
        }
        parsed.translations.remove(&id);
        if !parsed.retry_ids.contains(&id) {
            parsed.retry_ids.push(id.clone());
        }
        for issue in issues {
            let code = match issue.code {
                TranslationQualityCode::TargetLanguageMismatch => {
                    ProblemCode::TargetLanguageMismatch
                }
                TranslationQualityCode::Placeholder => ProblemCode::TranslationPlaceholder,
                TranslationQualityCode::SourceCopy => ProblemCode::TranslationSourceCopy,
                TranslationQualityCode::TooShort => ProblemCode::TranslationTooShort,
            };
            parsed
                .diagnostics
                .push_problem(Problem::sentence(code, &id, issue.detail));
        }
    }

    let collapsed = duplicate_collapse_ids(parsed.translations.iter().filter_map(|(id, text)| {
        page.sentence(id)
            .map(|sentence| (id.as_str(), sentence.source.as_str(), text.as_str()))
    }));
    let collapsed_count = collapsed.len();
    for id in collapsed {
        parsed.translations.remove(&id);
        if !parsed.retry_ids.contains(&id) {
            parsed.retry_ids.push(id.clone());
        }
        parsed.diagnostics.push_problem(Problem::sentence(
            ProblemCode::TranslationDuplicateCollapse,
            &id,
            format!("{collapsed_count} sentences on this page collapsed into the same short translation"),
        ));
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_page() -> TranslatePage {
        TranslatePage {
            source_lang: "en".to_owned(),
            target_lang: "zh".to_owned(),
            project_fingerprint: "1024:g1.0:g88.4:ab12cd".to_owned(),
            context_before: Some("previous tail".to_owned()),
            context_after: None,
            sections: vec![TranslateSection {
                id: "p-g1.0".to_owned(),
                speaker: Some("S1".to_owned()),
                sentences: vec![
                    TranslateSentence::new("s-g1.0", "Ninety days, eight times the growth."),
                    TranslateSentence::new("s-g1.7", "We did it without ads."),
                ],
            }],
        }
    }

    fn answer(pairs: &[(&str, &str)]) -> String {
        let mut out = String::from("<article>\n  <section id=\"p-g1.0\">\n");
        for (id, text) in pairs {
            out.push_str(&format!("    <p id=\"{id}\">{text}</p>\n"));
        }
        out.push_str("  </section>\n</article>\n");
        out
    }

    #[test]
    fn render_matches_spec_shape() {
        let rendered = render_translate_page(&sample_page());
        let expected = concat!(
            "<article lang=\"en\" data-target=\"zh\" data-ccut-format=\"translation-source/1\" data-project-fp=\"1024:g1.0:g88.4:ab12cd\" data-validator=\"4\">\n",
            "  <!-- context-before: previous tail -->\n",
            "  <section id=\"p-g1.0\" data-sp=\"S1\">\n",
            "    <p id=\"s-g1.0\">Ninety days, eight times the growth.</p>\n",
            "    <p id=\"s-g1.7\">We did it without ads.</p>\n",
            "  </section>\n",
            "</article>\n",
        );
        assert_eq!(rendered, expected);
    }

    #[test]
    fn round_trip_accepts_all_sentences() {
        let page = sample_page();
        let parsed = parse_translate_page(
            &page,
            None,
            &answer(&[("s-g1.0", "九十天翻了八倍。"), ("s-g1.7", "没投一分广告。")]),
        );
        assert!(
            !parsed.diagnostics.has_problems(),
            "{:?}",
            parsed.diagnostics
        );
        assert_eq!(parsed.translations["s-g1.0"], "九十天翻了八倍。");
        assert_eq!(parsed.translations["s-g1.7"], "没投一分广告。");
        assert!(!parsed.page_rejected);
    }

    #[test]
    fn content_gate_rejects_wrong_language_placeholders_and_source_copy() {
        let mut page = sample_page();
        page.source_lang = "zh".to_owned();
        page.target_lang = "en".to_owned();
        page.sections[0].sentences[0].source = "这是第一句中文源文。".to_owned();
        page.sections[0].sentences[1].source = "这是第二句中文源文。".to_owned();
        let mut parsed = parse_translate_page(
            &page,
            None,
            &answer(&[
                ("s-g1.0", "这是完整的中文回答。"),
                ("s-g1.7", "Translation."),
            ]),
        );
        validate_translation_quality(&page, &mut parsed);
        assert!(parsed.translations.is_empty());
        assert!(
            parsed
                .diagnostics
                .has_code(ProblemCode::TargetLanguageMismatch)
        );
        assert!(
            parsed
                .diagnostics
                .has_code(ProblemCode::TranslationPlaceholder)
        );

        let mut copied = parse_translate_page(
            &page,
            None,
            &answer(&[
                ("s-g1.0", "这是第一句中文源文。"),
                ("s-g1.7", "A valid translation."),
            ]),
        );
        validate_translation_quality(&page, &mut copied);
        assert!(
            copied
                .diagnostics
                .has_code(ProblemCode::TranslationSourceCopy)
        );
    }

    #[test]
    fn content_gate_rejects_page_duplicate_collapse() {
        let mut page = sample_page();
        page.target_lang = "en".to_owned();
        page.sections[0]
            .sentences
            .push(TranslateSentence::new("s-g1.9", "Third source sentence."));
        let mut parsed = parse_translate_page(
            &page,
            None,
            &answer(&[
                ("s-g1.0", "Done."),
                ("s-g1.7", "Done."),
                ("s-g1.9", "Done."),
            ]),
        );
        validate_translation_quality(&page, &mut parsed);
        assert!(parsed.translations.is_empty());
        assert!(
            parsed
                .diagnostics
                .has_code(ProblemCode::TranslationDuplicateCollapse)
        );
    }

    /// The per-sentence reading budget is the length channel of file-v1: `data-budget` carries only relative budget wording,
    /// with the unit switching according to the target language, and never seconds.
    #[test]
    fn budget_renders_as_a_readable_attribute() {
        let mut page = sample_page();
        page.sections[0].sentences[0].budget = Some(42);
        let rendered = render_translate_page(&page);
        assert!(
            rendered.contains(
                "    <p id=\"s-g1.0\" data-budget=\"整句≤42字\">Ninety days, eight times the growth.</p>\n"
            ),
            "{rendered}"
        );
        // Sentences without a budget still omit this attribute.
        assert!(
            rendered.contains("    <p id=\"s-g1.7\">We did it without ads.</p>\n"),
            "{rendered}"
        );

        page.target_lang = "de".to_owned();
        let rendered = render_translate_page(&page);
        assert!(
            rendered.contains("data-budget=\"整句≤42字符\""),
            "{rendered}"
        );
    }

    /// New attributes are not part of validation: the parser ignores them, and an old task directory's `src.html` without `data-budget`
    /// must give exactly the same verdict as the new rendered text.
    #[test]
    fn budget_is_ignored_by_the_parser() {
        let mut page = sample_page();
        page.sections[0].sentences[0].budget = Some(42);
        page.sections[0].sentences[1].budget = Some(9);
        let rendered = render_translate_page(&page);

        let recovered = parse_translate_source(&rendered).expect("translate carrier");
        assert_eq!(recovered.sentence_ids(), page.sentence_ids());
        assert_eq!(recovered.sentence("s-g1.0").unwrap().budget, None);

        let mut legacy = page.clone();
        for sentence in &mut legacy.sections[0].sentences {
            sentence.budget = None;
        }
        let legacy_rendered = render_translate_page(&legacy);
        assert!(!legacy_rendered.contains("data-budget"));

        let answer = answer(&[("s-g1.0", "九十天翻了八倍。"), ("s-g1.7", "没投一分广告。")]);
        let with_budget = parse_translate_page(&page, Some(&rendered), &answer);
        let without_budget = parse_translate_page(&legacy, Some(&legacy_rendered), &answer);
        assert!(!with_budget.diagnostics.has_problems());
        assert_eq!(with_budget, without_budget);
        // Backward compatibility: an old payload paired with the new render structure, or a new payload paired with the old structure, gets the same verdict either way.
        assert_eq!(
            parse_translate_page(&recovered, Some(&rendered), &answer),
            without_budget
        );
    }

    #[test]
    fn fused_alignment_attributes_round_trip_and_extract_a_valid_draft() {
        let mut page = sample_page();
        page.sections[0].sentences[0].alignment = Some(TranslateAlignmentInput {
            source_words: ["Ninety", "days,", "eight", "times", "the", "growth."]
                .into_iter()
                .map(str::to_owned)
                .collect(),
            needs_split: true,
            groups: Vec::new(),
            source_glue: Vec::new(),
        });
        let rendered = render_translate_page(&page);
        assert!(
            rendered.contains(
                "data-align-words=\"[1]Ninety [2]days, [3]eight [4]times [5]the [6]growth.\" data-align-needed=\"true\""
            ),
            "{rendered}"
        );
        assert!(!rendered.contains("data-align-target"), "{rendered}");
        let recovered = parse_translate_source(&rendered).expect("translate carrier");
        assert_eq!(
            recovered.sections[0].sentences[0].alignment,
            page.sections[0].sentences[0].alignment
        );

        let output = concat!(
            "<article><section id=\"p-g1.0\">",
            "<p id=\"s-g1.0\" data-align-words=\"[1]Ninety [2]days, [3]eight [4]times [5]the [6]growth.\" data-align-needed=\"true\">",
            "<span data-src=\"1-2\">九十天</span><span data-src=\"3 4 6\">增长八倍。</span></p>",
            "<p id=\"s-g1.7\">没投一分广告。</p>",
            "</section></article>",
        );
        let parsed = parse_translate_page(&page, Some(&rendered), output);
        assert!(!parsed.page_rejected);
        assert!(parsed.retry_ids.is_empty(), "{:?}", parsed.diagnostics);
        // The span is transparent to the translation: the body is still the complete translated sentence.
        assert_eq!(parsed.translations["s-g1.0"], "九十天增长八倍。");
        assert_eq!(
            parsed.alignments["s-g1.0"],
            TranslateAlignmentDraft {
                chunks: vec![
                    AlignChunk {
                        text: "九十天".to_owned(),
                        ordinals: vec![0, 1],
                    },
                    AlignChunk {
                        text: "增长八倍。".to_owned(),
                        ordinals: vec![2, 3, 5],
                    },
                ],
                // Index gap (4 not covered) ⇒ not a row partition.
                rows: false,
                on_groups: false,
            }
        );
    }

    #[test]
    fn invalid_fused_draft_is_silently_ignored_without_rejecting_translation() {
        let mut page = sample_page();
        page.sections[0].sentences[0].alignment = Some(TranslateAlignmentInput {
            source_words: ["Ninety", "days,", "eight", "times", "the", "growth."]
                .into_iter()
                .map(str::to_owned)
                .collect(),
            needs_split: true,
            groups: Vec::new(),
            source_glue: Vec::new(),
        });
        // One example each of an out-of-range index (9 > 6) and an index repeated across blocks; the translation itself is still stored as usual.
        for output in [
            concat!(
                "<article><section id=\"p-g1.0\">",
                "<p id=\"s-g1.0\"><span data-src=\"1-2\">九十天</span><span data-src=\"9\">增长八倍。</span></p>",
                "<p id=\"s-g1.7\">没投一分广告。</p>",
                "</section></article>",
            ),
            concat!(
                "<article><section id=\"p-g1.0\">",
                "<p id=\"s-g1.0\"><span data-src=\"1-2\">九十天</span><span data-src=\"2 3\">增长八倍。</span></p>",
                "<p id=\"s-g1.7\">没投一分广告。</p>",
                "</section></article>",
            ),
        ] {
            let parsed = parse_translate_page(&page, None, output);
            assert!(parsed.alignments.is_empty(), "{output}");
            assert!(parsed.retry_ids.is_empty(), "{:?}", parsed.diagnostics);
            assert!(!parsed.page_rejected);
            assert_eq!(parsed.translations["s-g1.0"], "九十天增长八倍。");
        }
    }

    #[test]
    fn source_specials_survive_round_trip() {
        let mut page = sample_page();
        page.sections[0].sentences[0].source = "a <b> & \"c\" 'd'".to_owned();
        let rendered = render_translate_page(&page);
        assert!(rendered.contains("a &lt;b&gt; &amp; \"c\" 'd'"));
        let tree = parse_html(&rendered);
        let (index, _) = index_by_id(&tree);
        assert_eq!(index["s-g1.0"].text(), "a <b> & \"c\" 'd'");
    }

    #[test]
    fn cjk_spaces_are_collapsed_on_parse() {
        // Same convention as `markers::sanitize_corrected`: spaces between CJK characters are model noise.
        let page = sample_page();
        let parsed = parse_translate_page(
            &page,
            None,
            &answer(&[("s-g1.0", "九十 天"), ("s-g1.7", "no ads")]),
        );
        assert_eq!(parsed.translations["s-g1.0"], "九十天");
        assert_eq!(parsed.translations["s-g1.7"], "no ads");
    }

    #[test]
    fn tag_name_changes_are_accepted() {
        let page = sample_page();
        let output = "<div><div id=\"p-g1.0\"><span id=\"s-g1.0\">译一</span><span id=\"s-g1.7\">译二</span></div></div>";
        let parsed = parse_translate_page(&page, None, output);
        assert!(!parsed.diagnostics.has_problems());
        assert_eq!(parsed.translations.len(), 2);
    }

    #[test]
    fn missing_middle_sentence_is_missing_id() {
        let mut page = sample_page();
        page.sections[0]
            .sentences
            .push(TranslateSentence::new("s-g2.0", "Third."));
        let parsed =
            parse_translate_page(&page, None, &answer(&[("s-g1.0", "一"), ("s-g2.0", "三")]));
        assert!(parsed.diagnostics.has_code(ProblemCode::MissingId));
        assert!(!parsed.diagnostics.has_code(ProblemCode::DocumentTruncated));
        assert_eq!(parsed.retry_ids, vec!["s-g1.7".to_owned()]);
        assert_eq!(parsed.translations.len(), 2);
    }

    #[test]
    /// §2.3: a missing contiguous suffix (truncation) with ≥1 parsed sentence ⇒ accept the parsed sentences, and missing ids go into
    /// `retry_ids` (the existing waves 2/3 mechanism); the whole page is no longer rejected, which would throw away dozens of sentences already translated.
    fn missing_suffix_is_truncation_but_keeps_the_parsed_prefix() {
        let mut page = sample_page();
        page.sections[0]
            .sentences
            .push(TranslateSentence::new("s-g2.0", "Third."));
        let parsed = parse_translate_page(&page, None, &answer(&[("s-g1.0", "一")]));
        assert!(parsed.diagnostics.has_code(ProblemCode::DocumentTruncated));
        assert!(!parsed.diagnostics.has_code(ProblemCode::MissingId));
        assert!(!parsed.page_rejected);
        assert_eq!(parsed.translations["s-g1.0"], "一");
        assert_eq!(parsed.retry_ids, vec!["s-g1.7", "s-g2.0"]);
    }

    #[test]
    fn chatter_without_html_is_document_wrapped() {
        let page = sample_page();
        let parsed = parse_translate_page(&page, None, "好的，这是翻译：九十天翻了八倍。");
        assert!(parsed.diagnostics.has_code(ProblemCode::DocumentWrapped));
        assert!(parsed.page_rejected);
    }

    #[test]
    fn single_code_fence_is_stripped_without_error() {
        let page = sample_page();
        let wrapped = format!(
            "```html\n{}```\n",
            answer(&[("s-g1.0", "一"), ("s-g1.7", "二")])
        );
        let parsed = parse_translate_page(&page, None, &wrapped);
        assert!(!parsed.diagnostics.has_problems());
        assert_eq!(parsed.translations.len(), 2);
        assert!(
            parsed
                .diagnostics
                .warnings
                .iter()
                .any(|w| w.code == WarningCode::WrapperStripped)
        );
    }

    #[test]
    /// §2.3: for a duplicate id, keep the first one and emit a Warning; the whole page is no longer rejected, since the other sentences are fully usable.
    fn duplicate_id_takes_the_first_and_warns() {
        let page = sample_page();
        let parsed = parse_translate_page(
            &page,
            None,
            &answer(&[("s-g1.0", "一"), ("s-g1.0", "壹"), ("s-g1.7", "二")]),
        );
        assert!(!parsed.page_rejected);
        assert!(!parsed.diagnostics.has_code(ProblemCode::DuplicateId));
        assert!(
            parsed
                .diagnostics
                .warnings
                .iter()
                .any(|w| w.code == WarningCode::DuplicateId)
        );
        assert_eq!(parsed.translations["s-g1.0"], "一");
        assert_eq!(parsed.translations.len(), 2);
    }

    #[test]
    fn unknown_id_is_reported_and_ignored() {
        let page = sample_page();
        let parsed = parse_translate_page(
            &page,
            None,
            &answer(&[("s-g1.0", "一"), ("s-g1.7", "二"), ("s-g9.9", "凭空")]),
        );
        assert!(parsed.diagnostics.has_code(ProblemCode::UnknownId));
        assert_eq!(parsed.translations.len(), 2);
        assert!(!parsed.page_rejected);
    }

    #[test]
    fn non_protocol_wrapper_id_is_only_a_warning() {
        // The model wrapping things in its own `<div id="page">` is not a protocol violation and must not enter the retry ledger.
        let page = sample_page();
        let body = answer(&[("s-g1.0", "一"), ("s-g1.7", "二")]);
        let wrapped = format!("<div id=\"page\">\n{body}</div>\n");
        let parsed = parse_translate_page(&page, None, &wrapped);
        assert!(!parsed.diagnostics.has_code(ProblemCode::UnknownId));
        assert!(!parsed.diagnostics.has_problems());
        assert!(
            parsed
                .diagnostics
                .warnings
                .iter()
                .any(|w| w.code == WarningCode::ContentIgnored)
        );
        assert_eq!(parsed.translations.len(), 2);
    }

    #[test]
    fn route_style_stray_leaf_is_an_unknown_id() {
        // In the timeline multi-source case, ids are globally unique route ids (`r%06d`) with no `s-` prefix.
        // Leaf nodes of this kind that appear out of nowhere must be flagged as unknown-id, and must not be silently dropped as if they were model containers.
        let page = sample_page();
        let body = answer(&[("s-g1.0", "一"), ("s-g1.7", "二")]);
        let polluted = format!("{body}<p id=\"r000999\">凭空</p>\n");
        let parsed = parse_translate_page(&page, None, &polluted);
        assert!(parsed.diagnostics.has_code(ProblemCode::UnknownId));
        assert_eq!(parsed.translations.len(), 2);
        assert!(!parsed.page_rejected);
    }

    #[test]
    fn empty_translation_is_reported() {
        let page = sample_page();
        let parsed =
            parse_translate_page(&page, None, &answer(&[("s-g1.0", "  "), ("s-g1.7", "二")]));
        assert!(parsed.diagnostics.has_code(ProblemCode::EmptyTranslation));
        assert_eq!(parsed.retry_ids, vec!["s-g1.0".to_owned()]);
    }

    #[test]
    fn locked_glossary_target_must_appear() {
        let mut page = sample_page();
        page.sections[0].sentences[0].required_targets = vec!["CucCut".to_owned()];
        let ok = parse_translate_page(
            &page,
            None,
            &answer(&[("s-g1.0", "CucCut 增长八倍"), ("s-g1.7", "二")]),
        );
        assert!(!ok.diagnostics.has_code(ProblemCode::GlossaryMissing));
        let bad = parse_translate_page(
            &page,
            None,
            &answer(&[("s-g1.0", "宝卡特增长八倍"), ("s-g1.7", "二")]),
        );
        assert!(bad.diagnostics.has_code(ProblemCode::GlossaryMissing));
        assert!(!bad.translations.contains_key("s-g1.0"));
    }

    #[test]
    fn frozen_sentence_must_stay_verbatim() {
        let mut page = sample_page();
        page.sections[0].sentences[1] =
            TranslateSentence::frozen("s-g1.7", "We did it without ads.", "没投一分广告。");
        let rendered = render_translate_page(&page);
        assert!(rendered.contains("data-editable=\"false\""));
        assert!(rendered.contains("data-translation=\"没投一分广告。\""));

        let intact = parse_translate_page(
            &page,
            None,
            &answer(&[("s-g1.0", "一"), ("s-g1.7", "没投一分广告。")]),
        );
        assert!(!intact.diagnostics.has_code(ProblemCode::FrozenModified));
        assert_eq!(intact.translations.len(), 1);

        // §2.3: a frozen sentence that was changed only records a Warning — its text never enters `translations`,
        // and the existing translation is kept as-is on the apply side, so rejecting the whole page would only needlessly re-roll the other sentences.
        let touched = parse_translate_page(
            &page,
            None,
            &answer(&[("s-g1.0", "一"), ("s-g1.7", "一分广告都没投。")]),
        );
        assert!(!touched.diagnostics.has_code(ProblemCode::FrozenModified));
        assert!(!touched.page_rejected);
        assert!(
            !touched.translations.contains_key("s-g1.7"),
            "frozen sentences are never written back"
        );
        assert!(
            touched
                .diagnostics
                .warnings
                .iter()
                .any(|w| w.code == WarningCode::FrozenIgnored)
        );
    }

    #[test]
    fn paragraph_move_is_detected() {
        let mut page = sample_page();
        page.sections.push(TranslateSection {
            id: "p-g2.0".to_owned(),
            speaker: None,
            sentences: vec![TranslateSentence::new("s-g2.0", "Third.")],
        });
        let output = concat!(
            "<article><section id=\"p-g1.0\"><p id=\"s-g1.0\">一</p></section>",
            "<section id=\"p-g2.0\"><p id=\"s-g1.7\">二</p><p id=\"s-g2.0\">三</p></section></article>",
        );
        let parsed = parse_translate_page(&page, None, output);
        assert!(parsed.diagnostics.has_code(ProblemCode::ParagraphMove));
        assert_eq!(parsed.translations.len(), 3);
    }

    #[test]
    fn moving_a_frozen_sentence_is_only_a_warning() {
        // §2.3: moving a frozen sentence likewise only records a Warning — frozen sentence text is never written back to the truth.
        let mut page = sample_page();
        page.sections[0].sentences[1] =
            TranslateSentence::frozen("s-g1.7", "We did it without ads.", "没投一分广告。");
        page.sections.push(TranslateSection {
            id: "p-g2.0".to_owned(),
            speaker: None,
            sentences: vec![TranslateSentence::new("s-g2.0", "Third.")],
        });
        let output = concat!(
            "<article><section id=\"p-g1.0\"><p id=\"s-g1.0\">一</p></section>",
            "<section id=\"p-g2.0\"><p id=\"s-g1.7\">没投一分广告。</p>",
            "<p id=\"s-g2.0\">三</p></section></article>",
        );
        let parsed = parse_translate_page(&page, None, output);
        assert!(!parsed.diagnostics.has_code(ProblemCode::ParagraphMove));
        assert!(!parsed.page_rejected);
        assert!(
            parsed
                .diagnostics
                .warnings
                .iter()
                .any(|w| w.code == WarningCode::FrozenIgnored)
        );
    }

    #[test]
    fn missing_section_ids_still_accept_sentences() {
        let page = sample_page();
        let parsed = parse_translate_page(
            &page,
            None,
            "<article><p id=\"s-g1.0\">一</p><p id=\"s-g1.7\">二</p></article>",
        );
        assert!(!parsed.diagnostics.has_problems());
        assert_eq!(parsed.translations.len(), 2);
    }

    #[test]
    fn script_injection_is_dropped() {
        let page = sample_page();
        let output = concat!(
            "<article><section id=\"p-g1.0\">",
            "<script>alert(1)</script>",
            "<p id=\"s-g1.0\" onclick=\"steal()\">一</p><p id=\"s-g1.7\">二</p>",
            "</section></article>",
        );
        let parsed = parse_translate_page(&page, None, output);
        assert_eq!(parsed.translations["s-g1.0"], "一");
        assert!(
            parsed
                .diagnostics
                .warnings
                .iter()
                .any(|w| w.code == WarningCode::NodeDropped)
        );
    }

    #[test]
    fn control_characters_are_stripped_before_parsing() {
        let page = sample_page();
        let output = answer(&[("s-g1.0", "一\u{202E}二"), ("s-g1.7", "三")]);
        let parsed = parse_translate_page(&page, None, &output);
        assert_eq!(parsed.translations["s-g1.0"], "一二");
        assert!(
            parsed
                .diagnostics
                .warnings
                .iter()
                .any(|w| w.code == WarningCode::ControlStripped)
        );
    }

    #[test]
    fn oversized_output_is_rejected() {
        let page = sample_page();
        let rendered = render_translate_page(&page);
        let bloat =
            "啊".repeat(super::super::common::max_output_chars(rendered.chars().count()) + 1);
        let parsed = parse_translate_page(&page, Some(&rendered), &bloat);
        assert!(parsed.diagnostics.has_code(ProblemCode::DocumentOversize));
        assert!(parsed.page_rejected);

        // Without input there is no guard baseline, so the same output must pass through to the normal parsing flow.
        let unguarded = parse_translate_page(&page, None, &bloat);
        assert!(
            !unguarded
                .diagnostics
                .has_code(ProblemCode::DocumentOversize)
        );
    }

    // --- property tests: fixed-seed LCG; unseeded randomness is forbidden ---

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
    fn property_round_trip_is_identity_for_random_pages() {
        const FRAGMENTS: &[&str] = &[
            "hello world",
            "你好，世界",
            "mixed 中英 text",
            "a <b> & \"c\"",
            "",
            "emoji 👍🏽 test",
            "很长很长的一句话，用来验证渲染与解析在长文本下仍然逐字一致，不会被空白折叠吃掉内容。",
        ];
        const TRANSLATIONS: &[&str] = &[
            "译文一",
            "translation two",
            "混合 translation 三",
            "带 <标签> 与 & 符号",
        ];
        let mut rng = Lcg(0x5eed_1234);
        for _ in 0..200 {
            let section_count = 1 + (rng.next() as usize) % 3;
            let mut sections = Vec::new();
            let mut index = 0usize;
            for s in 0..section_count {
                let sentence_count = 1 + (rng.next() as usize) % 4;
                let mut sentences = Vec::new();
                for _ in 0..sentence_count {
                    let mut sentence =
                        TranslateSentence::new(format!("s-g{index}"), rng.pick(FRAGMENTS));
                    sentence.editable = true;
                    sentences.push(sentence);
                    index += 1;
                }
                sections.push(TranslateSection {
                    id: format!("p-g{s}"),
                    speaker: None,
                    sentences,
                });
            }
            let page = TranslatePage {
                source_lang: "en".to_owned(),
                target_lang: "zh".to_owned(),
                project_fingerprint: "fp".to_owned(),
                context_before: None,
                context_after: None,
                sections,
            };
            let expected: Vec<(String, String)> = page
                .sentence_ids()
                .into_iter()
                .map(|id| (id.to_owned(), rng.pick(TRANSLATIONS).to_owned()))
                .collect();
            let mut output = String::from("<article>\n");
            for section in &page.sections {
                output.push_str(&format!("<section id=\"{}\">\n", section.id));
                for sentence in &section.sentences {
                    let text = &expected
                        .iter()
                        .find(|(id, _)| id == &sentence.id)
                        .unwrap()
                        .1;
                    output.push_str(&format!(
                        "<p id=\"{}\">{}</p>\n",
                        sentence.id,
                        escape_text(text)
                    ));
                }
                output.push_str("</section>\n");
            }
            output.push_str("</article>\n");
            let parsed = parse_translate_page(&page, None, &output);
            assert!(
                !parsed.diagnostics.has_problems(),
                "{:?}",
                parsed.diagnostics
            );
            for (id, text) in expected {
                assert_eq!(parsed.translations[&id], text);
            }
        }
    }

    #[test]
    fn property_parse_never_panics_on_hostile_input() {
        const CHARS: &[char] = &[
            '<', '>', '&', '"', '\'', '/', '=', 'p', 'i', 'd', 's', '-', 'g', '1', '.', '0', '\n',
            '\t', '\u{0000}', '\u{202E}', '你', '👍', '`', '{', '}',
        ];
        let page = sample_page();
        let mut rng = Lcg(0xdead_beef);
        for _ in 0..500 {
            let len = (rng.next() as usize) % 120;
            let text: String = (0..len)
                .map(|_| CHARS[(rng.next() as usize) % CHARS.len()])
                .collect();
            let parsed = parse_translate_page(&page, None, &text);
            let _ = parsed.translations.len();
        }
    }

    #[test]
    fn property_escaping_round_trips() {
        const CHARS: &[char] = &['<', '>', '&', '"', '\'', 'a', '你', ' ', '👍'];
        let mut rng = Lcg(0x1234_5678);
        for _ in 0..300 {
            let len = 1 + (rng.next() as usize) % 30;
            let text: String = (0..len)
                .map(|_| CHARS[(rng.next() as usize) % CHARS.len()])
                .collect();
            // Contract: escaping round-trips verbatim on text that has been “after HTML whitespace normalization”.
            // `Element::text()` collapses spaces between CJK characters (same convention as `sanitize_corrected`),
            // so the baseline text first goes through the same normalization, guaranteeing idempotence.
            let text = super::super::html::normalize_html_text(&sanitize_inline_text(&text));
            if text.is_empty() {
                continue;
            }
            let html = format!("<p id=\"s-x\">{}</p>", escape_text(&text));
            let tree = parse_html(&html);
            let (index, _) = index_by_id(&tree);
            assert_eq!(index["s-x"].text(), text);
        }
    }

    #[test]
    fn parse_source_recovers_validation_shape() {
        // The rendered text must carry all the machine-readable information validation needs: `task submit` runs in a separate process
        // with only the input file and the answer, and has no render-side structure.
        let mut page = sample_page();
        page.sections[0].sentences[0].required_targets =
            vec!["A&<B> \"C\"".to_owned(), "/compact".to_owned()];
        page.sections[0].sentences[0].source_id = Some("src-1".to_owned());
        page.sections[0].sentences[0].sentence_id = Some("42".to_owned());
        page.sections[0].sentences[1] =
            TranslateSentence::frozen("s-g1.7", "We did it without ads.", "没投 <一分> & 广告。");
        let rendered = render_translate_page(&page);

        let recovered = parse_translate_source(&rendered).expect("translate carrier");
        assert_eq!(recovered.source_lang, "en");
        assert_eq!(recovered.target_lang, "zh");
        assert_eq!(recovered.project_fingerprint, "1024:g1.0:g88.4:ab12cd");
        assert_eq!(recovered.sections.len(), 1);
        assert_eq!(recovered.sections[0].id, "p-g1.0");
        assert_eq!(recovered.sections[0].speaker.as_deref(), Some("S1"));
        assert_eq!(recovered.sentence_ids(), page.sentence_ids());

        let first = recovered.sentence("s-g1.0").unwrap();
        assert!(first.editable);
        assert_eq!(
            first.required_targets,
            page.sections[0].sentences[0].required_targets
        );
        assert_eq!(first.source_id.as_deref(), Some("src-1"));
        assert_eq!(first.sentence_id.as_deref(), Some("42"));
        let second = recovered.sentence("s-g1.7").unwrap();
        assert!(!second.editable);
        assert_eq!(
            second.existing_translation.as_deref(),
            Some("没投 <一分> & 广告。")
        );
    }

    #[test]
    fn parse_source_is_validation_equivalent() {
        let mut page = sample_page();
        page.sections[0].sentences[0].required_targets = vec!["CucCut".to_owned()];
        page.sections[0].sentences[1] =
            TranslateSentence::frozen("s-g1.7", "We did it without ads.", "没投一分广告。");
        page.sections.push(TranslateSection {
            id: "p-g2.0".to_owned(),
            speaker: None,
            sentences: vec![TranslateSentence::new("s-g2.0", "Third.")],
        });
        let rendered = render_translate_page(&page);
        let recovered = parse_translate_source(&rendered).expect("translate carrier");

        let outputs = [
            // All valid
            "<article><section id=\"p-g1.0\"><p id=\"s-g1.0\">CucCut 八倍</p><p id=\"s-g1.7\">没投一分广告。</p></section><section id=\"p-g2.0\"><p id=\"s-g2.0\">三</p></section></article>".to_owned(),
            // Missing term + empty translation
            "<article><section id=\"p-g1.0\"><p id=\"s-g1.0\">宝卡特八倍</p><p id=\"s-g1.7\">没投一分广告。</p></section><section id=\"p-g2.0\"><p id=\"s-g2.0\"> </p></section></article>".to_owned(),
            // Frozen sentence edited
            "<article><section id=\"p-g1.0\"><p id=\"s-g1.0\">CucCut 八倍</p><p id=\"s-g1.7\">改了</p></section><section id=\"p-g2.0\"><p id=\"s-g2.0\">三</p></section></article>".to_owned(),
            // Frozen sentence moved to another paragraph
            "<article><section id=\"p-g1.0\"><p id=\"s-g1.0\">CucCut 八倍</p></section><section id=\"p-g2.0\"><p id=\"s-g1.7\">没投一分广告。</p><p id=\"s-g2.0\">三</p></section></article>".to_owned(),
            // Tail truncation
            "<article><section id=\"p-g1.0\"><p id=\"s-g1.0\">CucCut 八倍</p></section></article>".to_owned(),
            // Garbage
            "好的，这是翻译".to_owned(),
        ];
        for output in &outputs {
            let from_page = parse_translate_page(&page, Some(&rendered), output);
            let from_source = parse_translate_page(&recovered, Some(&rendered), output);
            assert_eq!(from_page, from_source, "output: {output}");
        }
    }

    #[test]
    fn parse_source_rejects_foreign_document() {
        assert!(parse_translate_source("<article><p id=\"s-g1.0\">x</p></article>").is_none());
        assert!(parse_translate_source("").is_none());
    }

    // ---- Row partition (`--align-fusion rows`) -----------------------------------

    fn chunk(text: &str, ordinals: &[usize]) -> AlignChunk {
        AlignChunk {
            text: text.to_owned(),
            ordinals: ordinals.to_vec(),
        }
    }

    /// Valid row partition: each block's indices increase consecutively, adjacent blocks join end to start, and together they cover `0..N` exactly.
    #[test]
    fn row_partition_accepts_contiguous_full_coverage() {
        let chunks = vec![chunk("九十天", &[0, 1]), chunk("增长八倍。", &[2, 3, 4, 5])];
        assert!(is_row_partition(&chunks, 6));
        // A single row covering the whole sentence (a valid degenerate form when the word order does not line up).
        assert!(is_row_partition(
            &[chunk("九十天增长八倍。", &[0, 1, 2, 3, 4, 5])],
            6
        ));
    }

    /// Counterexamples, one per case: a gap in the ranges / ranges not increasing / not covering N / start not at 1 /
    /// empty index / empty text. In rows mode these drafts never take the direct path.
    #[test]
    fn row_partition_rejects_gaps_reordering_and_short_coverage() {
        // The concatenation can exactly equal the translation, yet index 3 is covered by nobody — a gap.
        assert!(!is_row_partition(
            &[chunk("九十天", &[0, 1, 2]), chunk("增长八倍。", &[4, 5])],
            6
        ));
        // Indices within a block do not increase.
        assert!(!is_row_partition(
            &[chunk("九十天", &[1, 0]), chunk("增长八倍。", &[2, 3, 4, 5])],
            6
        ));
        // Blocks out of order between them (the second block goes backwards).
        assert!(!is_row_partition(
            &[chunk("九十天", &[3, 4, 5]), chunk("增长八倍。", &[0, 1, 2])],
            6
        ));
        // Does not cover N.
        assert!(!is_row_partition(
            &[chunk("九十天", &[0, 1]), chunk("增长八倍。", &[2, 3])],
            6
        ));
        // First block does not start at 0.
        assert!(!is_row_partition(
            &[chunk("九十天增长八倍。", &[1, 2, 3, 4, 5])],
            6
        ));
        // Empty-index block / empty-text block / empty table.
        assert!(!is_row_partition(
            &[chunk("九十天", &[0, 1]), chunk("增长八倍。", &[])],
            2
        ));
        assert!(!is_row_partition(
            &[chunk("  ", &[0, 1]), chunk("增长八倍。", &[2, 3, 4, 5])],
            6
        ));
        assert!(!is_row_partition(&[], 6));
    }

    /// Row = one group, or the union of several adjacent groups; a row cut inside a group does not count as lying on a group boundary
    /// (this only affects the count, not acceptance).
    #[test]
    fn rows_on_group_boundaries_only_accepts_unions_of_whole_groups() {
        let groups = vec![
            FusionGroup {
                from: 0,
                to: 3,
                t0_ds: 0,
                t1_ds: 14,
            },
            FusionGroup {
                from: 4,
                to: 8,
                t0_ds: 14,
                t1_ds: 32,
            },
            FusionGroup {
                from: 9,
                to: 11,
                t0_ds: 32,
                t1_ds: 41,
            },
        ];
        // The first two groups merge into one row; the third group is its own row.
        let joined = vec![
            chunk("甲", &(0..=8).collect::<Vec<_>>()),
            chunk("乙", &(9..=11).collect::<Vec<_>>()),
        ];
        assert!(rows_on_group_boundaries(&joined, &groups));
        // Cut inside the second group.
        let split_inside = vec![
            chunk("甲", &(0..=5).collect::<Vec<_>>()),
            chunk("乙", &(6..=11).collect::<Vec<_>>()),
        ];
        assert!(!rows_on_group_boundaries(&split_inside, &groups));
        // Without a grouping hint, this constraint does not apply.
        assert!(rows_on_group_boundaries(&split_inside, &[]));
    }

    /// Rendering and parsing of `data-align-groups` share one source; an unparseable value falls back to an empty table (groups are only
    /// a hint and never affect the translation).
    #[test]
    fn align_groups_round_trip_through_the_carrier() {
        let groups = vec![
            FusionGroup {
                from: 0,
                to: 3,
                t0_ds: 0,
                t1_ds: 14,
            },
            FusionGroup {
                from: 4,
                to: 8,
                t0_ds: 14,
                t1_ds: 32,
            },
            FusionGroup {
                from: 9,
                to: 11,
                t0_ds: 32,
                t1_ds: 41,
            },
        ];
        let rendered = render_align_groups(&groups);
        assert_eq!(rendered, "1-4@0.0-1.4;5-9@1.4-3.2;10-12@3.2-4.1");
        assert_eq!(parse_align_groups(&rendered), groups);
        assert!(parse_align_groups("1-4;5-9").is_empty());
        assert!(parse_align_groups("0-4@0.0-1.4").is_empty());
        assert!(parse_align_groups("1-4@0-1.4").is_empty());
        assert!(parse_align_groups("").is_empty());
    }

    fn rows_page() -> TranslatePage {
        let mut page = sample_page();
        page.sections[0].sentences[0].alignment = Some(TranslateAlignmentInput {
            source_words: ["Ninety", "days,", "eight", "times", "the", "growth."]
                .into_iter()
                .map(str::to_owned)
                .collect(),
            needs_split: true,
            groups: vec![
                FusionGroup {
                    from: 0,
                    to: 1,
                    t0_ds: 0,
                    t1_ds: 8,
                },
                FusionGroup {
                    from: 2,
                    to: 5,
                    t0_ds: 8,
                    t1_ds: 24,
                },
            ],
            source_glue: Vec::new(),
        });
        page
    }

    /// Rows-mode carrier: `data-align-groups` is rendered and parsed back; a valid row partition is marked
    /// `rows` and lies on group boundaries.
    #[test]
    fn rows_carrier_round_trips_groups_and_extracts_a_row_partition() {
        let page = rows_page();
        let rendered = render_translate_page(&page);
        assert!(
            rendered.contains("data-align-groups=\"1-2@0.0-0.8;3-6@0.8-2.4\""),
            "{rendered}"
        );
        let recovered = parse_translate_source(&rendered).expect("translate carrier");
        assert_eq!(
            recovered.sections[0].sentences[0].alignment,
            page.sections[0].sentences[0].alignment
        );

        let output = concat!(
            "<article><section id=\"p-g1.0\">",
            "<p id=\"s-g1.0\">",
            "<span data-src=\"1-2\">九十天，</span><span data-src=\"3-6\">增长八倍。</span></p>",
            "<p id=\"s-g1.7\">没投一分广告。</p>",
            "</section></article>",
        );
        let parsed = parse_translate_page(&page, Some(&rendered), output);
        assert!(parsed.retry_ids.is_empty(), "{:?}", parsed.diagnostics);
        assert_eq!(parsed.translations["s-g1.0"], "九十天，增长八倍。");
        let draft = &parsed.alignments["s-g1.0"];
        assert!(draft.rows);
        assert!(draft.on_groups);
        assert_eq!(draft.chunks.len(), 2);
    }

    /// Row boundaries cut inside a group: still a valid row partition (accepted as usual), but `on_groups` is false.
    #[test]
    fn rows_off_group_boundaries_are_still_accepted_as_rows() {
        let page = rows_page();
        let rendered = render_translate_page(&page);
        let output = concat!(
            "<article><section id=\"p-g1.0\">",
            "<p id=\"s-g1.0\">",
            "<span data-src=\"1-3\">九十天，</span><span data-src=\"4-6\">增长八倍。</span></p>",
            "</section></article>",
        );
        let draft = &parse_translate_page(&page, Some(&rendered), output).alignments["s-g1.0"];
        assert!(draft.rows);
        assert!(!draft.on_groups);
    }

    /// A draft from normal fusion (the carrier has no `data-align-groups`) is not marked `rows`, even if its shape happens to be a row
    /// partition: its contract asks for minimal semantic blocks, and storing by row would cut out fragments.
    #[test]
    fn row_shaped_draft_without_groups_is_not_marked_as_rows() {
        let mut page = sample_page();
        page.sections[0].sentences[0].alignment = Some(TranslateAlignmentInput {
            source_words: ["Ninety", "days,", "eight", "times", "the", "growth."]
                .into_iter()
                .map(str::to_owned)
                .collect(),
            needs_split: true,
            groups: Vec::new(),
            source_glue: Vec::new(),
        });
        let rendered = render_translate_page(&page);
        assert!(!rendered.contains("data-align-groups"), "{rendered}");
        let output = concat!(
            "<article><section id=\"p-g1.0\">",
            "<p id=\"s-g1.0\">",
            "<span data-src=\"1-2\">九十天，</span><span data-src=\"3-6\">增长八倍。</span></p>",
            "</section></article>",
        );
        let draft = &parse_translate_page(&page, Some(&rendered), output).alignments["s-g1.0"];
        assert!(!draft.rows);
        assert!(!draft.on_groups);
    }

    /// Read-only attributes may be omitted: when each `<p>` in the answer keeps only `id` (dropping `data-align-*` as well),
    /// the translation and the **row-partition** draft are still extracted as usual, with zero problems. This is the key to compressing rows-mode output — validation uses the input page, so echoing those attributes in the answer is pure wasted tokens.
    #[test]
    fn an_answer_that_keeps_only_ids_still_yields_translations_and_row_drafts() {
        let page = rows_page();
        let rendered = render_translate_page(&page);
        // The input page of course carries the full set of read-only attributes.
        assert!(rendered.contains("data-align-words="), "{rendered}");
        assert!(rendered.contains("data-align-groups="), "{rendered}");

        let output = concat!(
            "<article><section id=\"p-g1.0\">",
            "<p id=\"s-g1.0\">",
            "<span data-src=\"1-2\">九十天，</span><span data-src=\"3-6\">增长八倍。</span></p>",
            "<p id=\"s-g1.7\">没投一分广告。</p>",
            "</section></article>",
        );
        assert!(!output.contains("data-align-words"), "the answer must not echo read-only attributes");
        let parsed = parse_translate_page(&page, Some(&rendered), output);
        assert!(!parsed.page_rejected);
        assert!(parsed.retry_ids.is_empty(), "{:?}", parsed.diagnostics);
        assert!(
            parsed.diagnostics.problems.is_empty(),
            "{:?}",
            parsed.diagnostics
        );
        assert_eq!(parsed.translations["s-g1.0"], "九十天，增长八倍。");
        assert_eq!(parsed.translations["s-g1.7"], "没投一分广告。");
        let draft = &parsed.alignments["s-g1.0"];
        assert!(draft.rows && draft.on_groups);
    }

    /// The same principle in `on` mode (block drafts) and for frozen/term sentences: `data-editable`,
    /// `data-translation` and `data-rt` are all read only from the **input page**, so even if the answer drops them all, the verdict does not change.
    #[test]
    fn readonly_attributes_are_read_from_the_input_page_not_the_answer() {
        let mut page = sample_page();
        page.sections[0].sentences[0].alignment = Some(TranslateAlignmentInput {
            source_words: ["Ninety", "days,", "eight", "times", "the", "growth."]
                .into_iter()
                .map(str::to_owned)
                .collect(),
            needs_split: true,
            groups: Vec::new(),
            source_glue: Vec::new(),
        });
        page.sections[0].sentences[0].required_targets = vec!["ARR".to_owned()];
        page.sections[0].sentences[1] =
            TranslateSentence::frozen("s-g1.7", "We did it without ads.", "没投一分广告。");
        let rendered = render_translate_page(&page);

        // Answer: all attributes omitted; the frozen sentence echoes its existing translation text as-is.
        let output = concat!(
            "<article><section id=\"p-g1.0\">",
            "<p id=\"s-g1.0\"><span data-src=\"1-2\">九十天，</span>",
            "<span data-src=\"3 4 6\">ARR 增长八倍。</span></p>",
            "<p id=\"s-g1.7\">没投一分广告。</p>",
            "</section></article>",
        );
        let parsed = parse_translate_page(&page, Some(&rendered), output);
        assert!(parsed.retry_ids.is_empty(), "{:?}", parsed.diagnostics);
        assert!(
            parsed.diagnostics.problems.is_empty(),
            "{:?}",
            parsed.diagnostics
        );
        // Frozen sentences still do not enter translations (the criterion comes from `editable=false` on the input page).
        assert!(!parsed.translations.contains_key("s-g1.7"));
        // Term validation also uses `data-rt` from the input page: the answer did not echo it, and it still applies.
        assert_eq!(parsed.translations["s-g1.0"], "九十天，ARR 增长八倍。");
        assert_eq!(parsed.alignments["s-g1.0"].chunks.len(), 2);
    }

    /// Fusion reminder at the end of the payload: added only when there are fusion sentences; the rows and on wording differ, and it does not affect parsing back.
    #[test]
    fn the_payload_carries_a_trailing_fusion_reminder_that_parsing_ignores() {
        let plain = render_translate_page(&sample_page());
        assert!(!plain.contains("Reminder:"), "{plain}");

        let rows = render_translate_page(&rows_page());
        assert!(
            rows.contains("must come back cut into <span data-src="),
            "{rows}"
        );
        assert!(rows.trim_end().ends_with("display rows."), "{rows}");
        // The reminder is root-level text after `</article>`, and parsing back always ignores it.
        let recovered = parse_translate_source(&rows).expect("translate carrier");
        assert_eq!(recovered.sentence_ids(), vec!["s-g1.0", "s-g1.7"]);
        assert_eq!(
            recovered.sections[0].sentences[0].alignment,
            rows_page().sections[0].sentences[0].alignment
        );

        let mut chunk_page = rows_page();
        chunk_page.sections[0].sentences[0]
            .alignment
            .as_mut()
            .unwrap()
            .groups
            .clear();
        let chunks = render_translate_page(&chunk_page);
        assert!(chunks.contains("chunk annotation"), "{chunks}");
    }

    /// When a row partition is invalid (ranges have a gap), the draft is still kept as an ordinary block draft, and the translation is stored as usual.
    #[test]
    fn row_partition_failure_keeps_the_translation_and_the_plain_draft() {
        let page = rows_page();
        let rendered = render_translate_page(&page);
        let output = concat!(
            "<article><section id=\"p-g1.0\">",
            "<p id=\"s-g1.0\">",
            "<span data-src=\"1-2\">九十天，</span><span data-src=\"4-6\">增长八倍。</span></p>",
            "<p id=\"s-g1.7\">没投一分广告。</p>",
            "</section></article>",
        );
        let parsed = parse_translate_page(&page, Some(&rendered), output);
        assert_eq!(parsed.translations["s-g1.0"], "九十天，增长八倍。");
        assert!(parsed.retry_ids.is_empty(), "{:?}", parsed.diagnostics);
        let draft = &parsed.alignments["s-g1.0"];
        assert!(!draft.rows);
    }
}
