//! The HTML table codec for the align carrier (`align-table/1`) (§8).
//!
//! Steps one and three of the four-step process: it renders an over-long sentence that needs semantic splitting into a table, and parses the table the model returns into "(source segment, translation piece) text pairs grouped by `data-sid`".
//!
//! Boundaries (M0 covers only the structural layer, a hard line):
//!
//! - **No atom-LCS source-word interval mapping, and no `from`/`to` output**. The ordered cursor and word-boundary snapping of §8.4 step 1 are M3 engine work; reimplementing them here would create two mirrored copies.
//! - **Absolute timestamps do not enter the payload** (§8.2). The "suggested piece count" derived from on-screen seconds is computed by the caller and passed in as [`AlignSentenceInput::suggested_pieces`]; seconds do not enter filepipe.
//! - **Tag names are not part of the protocol**. Location always goes through the `data-sid` / `class` / `scope` / `rowspan` attributes; `<tbody>`/`<tr>`/`<td>` are just the current form.
//! - **No non-regression check** (§8.4 step 3): it requires the "worst-case input rows" and the ground truth of `words[]` timing, which belongs to the engine layer.
//!
//! From M3 on, this module is the **only string-level validator** for file-v1 align. The engine provider path and the agent's submit-time lint both call [`parse_align_table`]; the latter also holds the §8.3 rewrite-magnitude guard for reordered rows (the arithmetic is shared with [`crate::split::reordered_rewrite_exceeds`]). Criteria that need the ground truth of `words[]` (interval mapping, pairing density, bilingual anchors, non-regression) remain in the engine.
//!
//! This module has zero I/O, zero clock, zero randomness; everything is a pure function.

use std::collections::{BTreeMap, BTreeSet};

use crate::atomize::normalize_chars;
use crate::seam::{SeamLintClass, cjk_midword_boundary, is_objective_blocking, lint_pieces};
use crate::split::{
    TransParams, legal_split_for_lang, piece_display_units, primary_subtag,
    reordered_rewrite_exceeds, target_cps_chars,
};

use super::common::{
    ALIGN_TABLE_FORMAT, Diagnostics, Problem, ProblemCode, Warning, WarningCode, guard_output_size,
    normalize_llm_output, sanitize_inline_text,
};
use super::html::{Element, Node, escape_attr, escape_text, parse_html, parse_html_in_table};

/// One read-only context row in the table (§8.2: "up to one sentence before and after").
///
/// Rendered as `<tbody class="ctx">` and **without `data-sid`**: it is not an editable unit, only context. If the model changes its content, that is reported as [`ProblemCode::SourceDrift`].
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct AlignContextRow {
    /// Read-only source text (concatenation of visible words in order).
    pub source: String,
    /// Read-only translation.
    pub translation: String,
}

impl AlignContextRow {
    /// Constructs a context row.
    pub fn new(source: impl Into<String>, translation: impl Into<String>) -> Self {
        Self {
            source: source.into(),
            translation: translation.into(),
        }
    }
}

/// Render input for one sentence in the table.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AlignSentenceInput {
    /// Sentence id (`data-sid`, exact byte-for-byte match, no case folding).
    pub id: String,
    /// Full source text of the sentence (concatenation of visible words in order). Not pre-split, does not expose word ids, does not expose source Cue boundaries.
    pub source: String,
    /// Sentence-level translation ground truth `trans[lang][sid]`. The concatenation of the line pieces must be equivalent to it (§2 invariant).
    pub translation: String,
    /// Display line limit (`data-max-lines`); only a constraint hint to the model.
    pub max_lines: usize,
    /// Suggested piece-count range `(lower, upper)`: converted by the caller from the on-screen duration. **Seconds do not enter the payload.**
    pub suggested_pieces: (usize, usize),
    /// The "no split point on the source side" state marked by the model in the previous round, carried back so that a targeted round can re-check it. The first round is always `false`; when `false`, the attribute is not rendered.
    pub unsplittable: bool,
    /// The frozen target pieces, when the translate-fusion draft has already passed target-side acceptance. When non-empty, the worker may only reselect source boundaries; the submit-time lint can fully restore the same constraint from the carrier.
    pub frozen_target: Vec<String>,
    /// Forbids `data-reordered="true"`: this round only reselects source-text cut points, so rewriting the translation is meaningless.
    ///
    /// The difference from [`Self::frozen_target`] is that it does **not** prescribe what the target pieces look like. It only rules out the "rewrite the translation" route. Paired line-filling rounds need exactly the reselection of boundaries, and frozen target pieces would forbid the one thing this round should do.
    ///
    /// It is needed because `data-reordered="true"` is the rewrite channel that validation accepts. Once it is set, the "line pieces concatenated must equal the sentence-level translation" invariant is replaced by a much looser magnitude threshold, and answers are accepted anyway. Paired-round acceptance only measures the original `trans`, so the whole round's calls were doomed. Measured in practice: all 38 candidates were rejected and 0 sentences were fixed. That is how the calls were wasted.
    pub no_rewrite: bool,
}

impl AlignSentenceInput {
    /// Constructs a one-sentence render input (`max_lines` defaults to 2, the suggested piece count defaults to 2–3, not unsplittable).
    pub fn new(
        id: impl Into<String>,
        source: impl Into<String>,
        translation: impl Into<String>,
    ) -> Self {
        Self {
            id: id.into(),
            source: source.into(),
            translation: translation.into(),
            max_lines: 2,
            suggested_pieces: (2, 3),
            unsplittable: false,
            frozen_target: Vec::new(),
            no_rewrite: false,
        }
    }
}

/// The render input for a whole align table, which is also the reconciliation baseline at parse time.
///
/// Parsing must take this as well, not just the string: the expected id set, the read-only context rows, and the sentence-level translations and sources are all reconciled against it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AlignTableInput {
    /// Target language tag (`data-lang`).
    pub lang: String,
    /// Target-language thresholds (`data-fit` / `data-hard` derive from this).
    pub params: TransParams,
    /// Source language tag (`data-source-lang`). It only feeds the source-line width measure for the "parallel-action comma seam" exemption (`source_fit` takes its value by source language). An empty string is measured with the Latin-source budget.
    pub source_lang: String,
    /// Read-only context rows before the table.
    pub context_before: Vec<AlignContextRow>,
    /// The sentences to handle in this table (packing is done by the caller under both sentence-count and size constraints).
    pub sentences: Vec<AlignSentenceInput>,
    /// Read-only context rows after the table.
    pub context_after: Vec<AlignContextRow>,
}

impl AlignTableInput {
    /// Constructs a table input containing only sentences, with no context (parameters take the target language's canonical defaults).
    pub fn new(lang: impl Into<String>, sentences: Vec<AlignSentenceInput>) -> Self {
        let lang = lang.into();
        let params = TransParams::for_lang(&lang);
        Self {
            lang,
            params,
            source_lang: String::new(),
            context_before: Vec::new(),
            sentences,
            context_after: Vec::new(),
        }
    }
}

/// The parsed line pieces for one sentence: one translation piece plus a continuous source segment 1:1 with it.
///
/// M0 holds text only; source-word intervals (`from`/`to`) are derived by the M3 engine via atom-LCS mapping.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct AlignParsedRow {
    /// The source segment corresponding to this piece (normalized visible text).
    pub source: String,
    /// The translation piece (normalized visible text).
    pub target: String,
}

/// The parsed group for one sentence.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct AlignParsedGroup {
    /// Sentence id (`data-sid`).
    pub id: String,
    /// The line pieces, in order of appearance.
    pub rows: Vec<AlignParsedRow>,
    /// `data-reordered="true"`: the model rewrote the translation to eliminate word-order crossings. When true, this module does **not** perform the concatenation consistency check (the rewrite-magnitude guard belongs to the engine layer).
    pub reordered: bool,
    /// `data-crossing="true"`: residual word-order crossing. Mutually exclusive with [`Self::reordered`].
    pub crossing: bool,
    /// `data-unsplittable="true"`: the source side has no cut point at all; routed to the `translation-unsplittable` channel.
    pub unsplittable: bool,
}

/// The result of one align-table parse.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct AlignParsed {
    /// Groups in the order they appear in the output (only in-protocol ids).
    pub groups: Vec<AlignParsedGroup>,
    /// Protocol problems and non-protocol diagnostics.
    pub diagnostics: Diagnostics,
}

impl AlignParsed {
    /// Gets a group by id.
    pub fn group(&self, id: &str) -> Option<&AlignParsedGroup> {
        self.groups.iter().find(|group| group.id == id)
    }
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

/// Reject contradictory structured input before paying for a model response.
/// This cannot decide whether arbitrary free-text instructions are satisfiable.
pub fn validate_input_constraints(input: &AlignTableInput) -> Result<(), String> {
    for sentence in &input.sentences {
        let (min, max) = sentence.suggested_pieces;
        if min == 0 || min > max {
            return Err(format!(
                "{}: conflicting row budget {min}..{max}",
                sentence.id
            ));
        }
        if !sentence.frozen_target.is_empty() {
            let pieces = &sentence.frozen_target;
            if pieces.len() < min
                || pieces.len() > max
                || normalize_chars(&pieces.concat()) != normalize_chars(&sentence.translation)
                || pieces.iter().any(|p| {
                    p.trim().is_empty() || piece_display_units(p, &input.lang) > input.params.hard
                })
            {
                return Err(format!(
                    "{}: frozen target conflicts with the translation or row budget; replan the target before dispatch",
                    sentence.id
                ));
            }
        }
    }
    Ok(())
}

/// Renders one align table (§8.2). The attribute order, indentation and row order of the output are fixed; text and attributes are escaped by escape_text / escape_attr respectively. Styles are not previewed inline, so they are not discarded at parse time.
pub fn render_align_table(input: &AlignTableInput) -> String {
    let mut output = String::new();
    // `data-soft` is a **deliberate addition** to the §8.2 attribute list. Submit-time lint only gets the persisted payload HTML, and [`parse_align_table_input`] must be able to restore the full TransParams in order to recompute the same seam criteria (soft goes into lint_pieces). Without it one can only guess, and a wrong guess means two different validations, which is exactly what design §2 sets out to eliminate.
    // `data-source-lang` works the same way: the "parallel-action comma seam" exemption needs the source-line width measured against the source-language budget, and submit-time lint can only get the source language from the payload.
    let source_lang = if input.source_lang.trim().is_empty() {
        String::new()
    } else {
        format!(
            " data-source-lang=\"{}\"",
            escape_attr(&sanitize_inline_text(&input.source_lang))
        )
    };
    output.push_str(&format!(
        "<table data-lang=\"{}\"{} data-fit=\"{}\" data-soft=\"{}\" data-hard=\"{}\" data-ccut-format=\"{}\">\n",
        escape_attr(&sanitize_inline_text(&input.lang)),
        source_lang,
        input.params.fit,
        input.params.soft,
        input.params.hard,
        escape_attr(ALIGN_TABLE_FORMAT),
    ));
    for row in &input.context_before {
        push_context_group(&mut output, row);
    }
    for sentence in &input.sentences {
        push_sentence_group(&mut output, sentence, &input.lang, &input.params);
    }
    for row in &input.context_after {
        push_context_group(&mut output, row);
    }
    output.push_str("</table>\n");
    output
}

/// Renders one read-only context group.
fn push_context_group(output: &mut String, row: &AlignContextRow) {
    output.push_str("  <tbody class=\"ctx\">\n");
    output.push_str(&format!(
        "    <tr><th scope=\"rowgroup\"></th><td class=\"src\">{}</td><td class=\"tgt\">{}</td></tr>\n",
        cell_text(&row.source),
        cell_text(&row.translation),
    ));
    output.push_str("  </tbody>\n");
}

/// Renders one editable sentence group.
fn push_sentence_group(
    output: &mut String,
    sentence: &AlignSentenceInput,
    lang: &str,
    params: &TransParams,
) {
    let unsplittable = if sentence.unsplittable {
        " data-unsplittable=\"true\""
    } else {
        ""
    };
    let frozen_target = if sentence.frozen_target.is_empty() {
        String::new()
    } else {
        format!(
            " data-target-frozen=\"{}\"",
            escape_attr(
                &serde_json::to_string(&sentence.frozen_target).unwrap_or_else(|_| "[]".to_owned())
            )
        )
    };
    let no_rewrite = if sentence.no_rewrite {
        " data-no-rewrite=\"true\""
    } else {
        ""
    };
    output.push_str(&format!(
        "  <tbody data-sid=\"{}\" data-max-lines=\"{}\" data-budget=\"{}\"{}{}{}>\n",
        escape_attr(&sanitize_inline_text(&sentence.id)),
        sentence.max_lines.max(1),
        escape_attr(&budget_text(params, lang, sentence.suggested_pieces)),
        unsplittable,
        frozen_target,
        no_rewrite,
    ));
    output.push_str(&format!(
        "    <tr><th rowspan=\"1\" scope=\"rowgroup\">{}</th><td class=\"src\">{}</td><td class=\"tgt\">{}</td></tr>\n",
        cell_text(&sentence.id),
        cell_text(&sentence.source),
        cell_text(&sentence.translation),
    ));
    output.push_str("  </tbody>\n");
}

/// Cell text: first cleaned into a single line, then HTML-escaped.
fn cell_text(text: &str) -> String {
    escape_text(&sanitize_inline_text(text))
}

/// `data-budget` text: carries only relative budgets (per-line threshold and suggested piece count), no seconds.
fn budget_text(params: &TransParams, lang: &str, suggested: (usize, usize)) -> String {
    let unit = if matches!(primary_subtag(lang).as_str(), "zh" | "ja" | "ko") {
        "字"
    } else {
        "字符"
    };
    // Preserve the actual constraint for shared submit lint. The producer
    // preflights it; silently repairing it here would hide an input conflict.
    let (low, high) = suggested;
    let pieces = if low == high {
        format!("建议{low}片")
    } else {
        format!("建议{low}–{high}片")
    };
    format!("每行≤{}{}，{}", params.fit, unit, pieces)
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/// Parses the align table returned by the model (the structural layer, which comes before §8.3 and §8.4 step 1).
///
/// Flow: normalization (§10.2 zero-cost recovery) → size guard (§16) → lenient parsing → group reconciliation.
///
/// - `table` is the reconciliation baseline (expected id set, read-only context, sentence-level source and translation). It is not an optional parameter: the id set and the concatenation invariant cannot be checked from a string alone.
/// - `input` is **the render text that was actually sent to the model** (the host's `DocumentRequest.input.content`). It is used only as the size baseline for [`guard_output_size`]; passing `None` skips that guard. It does not internally call [`render_align_table`] to back-compute the length, since that would couple parse to render and spend an extra allocation.
///
/// Key criteria:
///
/// - **Bare `<tbody>` recovery**: when the model returns only `<tbody>`/`<tr>` without a `<table>` wrapper, html5ever's table scope **silently drops all rows**. So when document-mode parsing yields 0 groups while the original text contains the literal string `data-sid`, re-parse using a `<table>` fragment context. This step must happen before the truncation check, otherwise it would falsely report "every sentence missing".
/// - **Truncation vs. scattered missing**: the lenient parser auto-closes everything, so truncation cannot be judged from it. The criterion is "a **consecutive suffix** of expected ids missing as a whole" ⇒ [`ProblemCode::DocumentTruncated`]; scattered missing ids ⇒ [`ProblemCode::MissingId`]. Misjudging these as omissions would waste a whole round of targeted retries (§9.3).
pub fn parse_align_table(
    table: &AlignTableInput,
    input: Option<&str>,
    output: &str,
) -> AlignParsed {
    let mut diagnostics = Diagnostics::new();
    if let Err(detail) = validate_input_constraints(table) {
        diagnostics.push_problem(Problem::document(ProblemCode::InputConflict, detail));
        return AlignParsed {
            groups: Vec::new(),
            diagnostics,
        };
    }

    let normalized = normalize_llm_output(output);
    for warning in normalized.warnings() {
        diagnostics.push_warning(warning);
    }

    // Size guard: over the limit, reject outright without parsing (so that runaway generation does not turn the subsequent checks into noise).
    if let Some(problem) = input.and_then(|input| guard_output_size(input, &normalized.text)) {
        diagnostics.push_problem(problem);
        return AlignParsed {
            groups: Vec::new(),
            diagnostics,
        };
    }

    if has_residual_fence(&normalized.text) {
        diagnostics.push_problem(Problem::document(
            ProblemCode::DocumentWrapped,
            "输出仍残留代码块围栏或夹带解释，无法零成本剥离",
        ));
    }

    let mut tree = parse_html(&normalized.text);
    let mut collected = collect_groups(&tree.roots);
    if collected.sentences.is_empty() && normalized.text.contains("data-sid") {
        tree = parse_html_in_table(&normalized.text);
        collected = collect_groups(&tree.roots);
    }
    for warning in tree.warnings() {
        diagnostics.push_warning(warning);
    }

    let expected: BTreeMap<&str, &AlignSentenceInput> = table
        .sentences
        .iter()
        .map(|sentence| (sentence.id.as_str(), sentence))
        .collect();

    let mut groups: Vec<AlignParsedGroup> = Vec::new();
    let mut seen: BTreeSet<String> = BTreeSet::new();
    let mut duplicated: BTreeSet<String> = BTreeSet::new();

    for element in collected.sentences {
        let sid = element
            .attr("data-sid")
            .map(str::trim)
            .unwrap_or_default()
            .to_owned();
        if sid.is_empty() {
            diagnostics.push_warning(Warning::document(
                WarningCode::ContentIgnored,
                "忽略 data-sid 为空的分组",
            ));
            continue;
        }
        if seen.contains(&sid) {
            if duplicated.insert(sid.clone()) {
                diagnostics.push_problem(Problem::sentence(
                    ProblemCode::DuplicateId,
                    sid.clone(),
                    "同一 id 出现多次，只采用首次出现的分组",
                ));
            }
            continue;
        }
        seen.insert(sid.clone());

        let Some(sentence) = expected.get(sid.as_str()).copied() else {
            diagnostics.push_problem(Problem::sentence(
                ProblemCode::UnknownId,
                sid.clone(),
                "协议外的 id，已忽略",
            ));
            continue;
        };

        let group = parse_group(element, sentence, table, &mut diagnostics);
        groups.push(group);
    }

    report_missing(table, &seen, &mut diagnostics);
    check_context(table, &collected.contexts, &mut diagnostics);

    AlignParsed {
        groups,
        diagnostics,
    }
}

/// Recovers an [`AlignTableInput`] from the **originally emitted payload HTML** (§10.3 submit-time lint).
///
/// The `task submit` process has no `TranscriptDoc`, only the persisted `payloads/<callId>.html`. Recovery lets the submit-time lint call exactly the same [`parse_align_table`] as the engine, which fulfils design §2's "there is only one validation", rather than copying the criteria over again.
///
/// Recovery **must** be the strict inverse of [`render_align_table`]: `render → parse_input → render` byte-for-byte equality is pinned by a unit test. Any attribute newly added on the render side must be synced here, otherwise the lint silently degrades into "payload unreadable ⇒ do not block".
///
/// Returns `None` when this is not an align table (old task directories, payloads of other kinds). The caller downgrades to "do not block" per the M1/M2 convention, and must not report an error out of nothing.
pub fn parse_align_table_input(payload: &str) -> Option<AlignTableInput> {
    let tree = parse_html(payload);
    let table = tree
        .elements()
        .into_iter()
        .find(|element| element.attr("data-ccut-format") == Some(ALIGN_TABLE_FORMAT))?;

    let lang = table
        .attr("data-lang")
        .unwrap_or_default()
        .trim()
        .to_owned();
    let source_lang = table
        .attr("data-source-lang")
        .unwrap_or_default()
        .trim()
        .to_owned();
    let defaults = TransParams::for_lang(&lang);
    let params = TransParams {
        fit: attr_usize(table, "data-fit").unwrap_or(defaults.fit),
        soft: attr_usize(table, "data-soft").unwrap_or(defaults.soft),
        hard: attr_usize(table, "data-hard").unwrap_or(defaults.hard),
    };

    let mut ordered = Vec::new();
    walk_groups_ordered(&tree.roots, &mut ordered);
    let mut context_before = Vec::new();
    let mut context_after = Vec::new();
    let mut sentences = Vec::new();
    let mut diagnostics = Diagnostics::new();
    for element in ordered {
        if let Some(id) = element
            .attr("data-sid")
            .map(str::trim)
            .filter(|id| !id.is_empty())
        {
            let rows = extract_rows(element, Some(id), &mut diagnostics);
            let Some(row) = rows.first() else {
                continue;
            };
            sentences.push(AlignSentenceInput {
                id: id.to_owned(),
                source: row.source.clone(),
                translation: row.target.clone(),
                max_lines: attr_usize(element, "data-max-lines").unwrap_or(2).max(1),
                suggested_pieces: parse_budget_pieces(
                    element.attr("data-budget").unwrap_or_default(),
                )
                .unwrap_or((2, 3)),
                unsplittable: element.attr("data-unsplittable").map(str::trim) == Some("true"),
                frozen_target: element
                    .attr("data-target-frozen")
                    .and_then(|raw| serde_json::from_str(raw).ok())
                    .unwrap_or_default(),
                no_rewrite: element.attr("data-no-rewrite").map(str::trim) == Some("true"),
            });
            continue;
        }
        let rows = extract_rows(element, None, &mut diagnostics);
        if let Some(row) = rows.first() {
            let context = AlignContextRow::new(row.source.clone(), row.target.clone());
            // Preceding / following attribution follows document order: everything before the first editable group is preceding context; the rest is following context.
            if sentences.is_empty() {
                context_before.push(context);
            } else {
                context_after.push(context);
            }
        }
    }

    Some(AlignTableInput {
        lang,
        params,
        source_lang,
        context_before,
        sentences,
        context_after,
    })
}

/// Collects groups in document order (editable and read-only mixed). [`collect_groups`] puts them into two buckets and loses the interleaving order, but recovering from the payload needs that order to restore preceding / following context attribution.
fn walk_groups_ordered<'a>(nodes: &'a [Node], out: &mut Vec<&'a Element>) {
    for node in nodes {
        let Node::Element(element) = node else {
            continue;
        };
        if element.attrs.contains_key("data-sid") || element.has_class("ctx") {
            out.push(element);
            continue;
        }
        walk_groups_ordered(&element.children, out);
    }
}

fn attr_usize(element: &Element, name: &str) -> Option<usize> {
    element.attr(name)?.trim().parse().ok()
}

/// The inverse of [`budget_text`]: retrieves the suggested piece-count range from strings like `…建议2–3片` / `…建议3片`.
fn parse_budget_pieces(budget: &str) -> Option<(usize, usize)> {
    let tail = budget.rsplit_once("建议")?.1;
    let body = tail.strip_suffix('片')?;
    match body.split_once('–') {
        Some((low, high)) => Some((low.trim().parse().ok()?, high.trim().parse().ok()?)),
        None => {
            let value: usize = body.trim().parse().ok()?;
            Some((value, value))
        }
    }
}

/// Group collection result: editable groups and read-only context groups.
struct CollectedGroups<'a> {
    sentences: Vec<&'a Element>,
    contexts: Vec<&'a Element>,
}

/// Recursively collects groups: once a group is matched, it does **not** descend further.
///
/// Not descending tolerates the model writing `data-sid` on both the group and every row. Otherwise the same sentence would be counted as several groups, falsely reporting `duplicate-id`.
fn collect_groups(nodes: &[Node]) -> CollectedGroups<'_> {
    let mut collected = CollectedGroups {
        sentences: Vec::new(),
        contexts: Vec::new(),
    };
    walk_groups(nodes, &mut collected);
    collected
}

fn walk_groups<'a>(nodes: &'a [Node], collected: &mut CollectedGroups<'a>) {
    for node in nodes {
        let Node::Element(element) = node else {
            continue;
        };
        if element.attrs.contains_key("data-sid") {
            collected.sentences.push(element);
            continue;
        }
        if element.has_class("ctx") {
            collected.contexts.push(element);
            continue;
        }
        walk_groups(&element.children, collected);
    }
}

/// Parses one sentence group and runs the sentence-level acceptance checks.
fn parse_group(
    element: &Element,
    sentence: &AlignSentenceInput,
    input: &AlignTableInput,
    diagnostics: &mut Diagnostics,
) -> AlignParsedGroup {
    let sid = sentence.id.as_str();
    let rows = extract_rows(element, Some(sid), diagnostics);

    let reordered = bool_attr(element, "data-reordered", sid, diagnostics);
    let mut crossing = bool_attr(element, "data-crossing", sid, diagnostics);
    let unsplittable = bool_attr(element, "data-unsplittable", sid, diagnostics);
    if reordered && crossing {
        // §8: the two are mutually exclusive. Keep reordered (the rewrite has indeed happened) and discard the self-reported residual crossing.
        crossing = false;
        diagnostics.push_warning(Warning::sentence(
            WarningCode::ContentIgnored,
            sid,
            "data-reordered 与 data-crossing 互斥，已忽略 data-crossing",
        ));
    }

    check_rowspan(element, sid, rows.len(), diagnostics);

    if rows.is_empty() {
        diagnostics.push_problem(Problem::sentence(
            ProblemCode::EmptyTranslation,
            sid,
            "分组内没有可用的行片",
        ));
    } else {
        check_rows(&rows, sentence, input, reordered, diagnostics);
    }

    AlignParsedGroup {
        id: sentence.id.clone(),
        rows,
        reordered,
        crossing,
        unsplittable,
    }
}

/// Sentence-level acceptance: empty translation, source drift, concatenation invariant, hard limit, seam lint.
///
/// No check is suppressed because of `data-unsplittable`. Suppression would be invisible in the parser, and it would erase the difference between "unsplittable and compliant" and "unsplittable but over hard (blocker level)" (§8.1).
fn check_rows(
    rows: &[AlignParsedRow],
    sentence: &AlignSentenceInput,
    input: &AlignTableInput,
    reordered: bool,
    diagnostics: &mut Diagnostics,
) {
    let sid = sentence.id.as_str();
    let lang = input.lang.as_str();
    let params = &input.params;

    let empty: Vec<String> = rows
        .iter()
        .enumerate()
        .filter(|(_, row)| row.target.trim().is_empty())
        .map(|(index, _)| (index + 1).to_string())
        .collect();
    if !empty.is_empty() {
        diagnostics.push_problem(Problem::sentence(
            ProblemCode::EmptyTranslation,
            sid,
            format!("第 {} 片译文为空", empty.join("、")),
        ));
    }

    // The source column is read-only: the model may only split, not modify.
    let source_concat: String = rows.iter().map(|row| row.source.as_str()).collect();
    if normalize_chars(&source_concat) != normalize_chars(&sentence.source) {
        diagnostics.push_problem(Problem::sentence(
            ProblemCode::SourceDrift,
            sid,
            "源文段拼接与整句源文不一致：源文列只能切分，不能改写",
        ));
    }

    // Concatenation invariant (§2). reordered groups are allowed to rewrite the translation, so the concatenation naturally differs; they are judged by the rewrite-magnitude guard instead (§8.3 ±25%). Both are pure string-level criteria, so they live here: the engine provider path and the agent's submit-time lint share one implementation (§2).
    let target_concat: String = rows.iter().map(|row| row.target.as_str()).collect();
    if !sentence.frozen_target.is_empty() {
        let actual = rows
            .iter()
            .map(|row| row.target.clone())
            .collect::<Vec<_>>();
        if reordered {
            diagnostics.push_problem(Problem::sentence(
                ProblemCode::AlignContentDrift,
                sid,
                "data-target-frozen 禁止 data-reordered=\"true\"：只可重选源文边界",
            ));
        } else if actual != sentence.frozen_target {
            diagnostics.push_problem(Problem::sentence(
                ProblemCode::AlignContentDrift,
                sid,
                "目标片必须逐片等于 data-target-frozen：只可重选源文边界",
            ));
        }
    }
    if sentence.no_rewrite && reordered {
        diagnostics.push_problem(Problem::sentence(
            ProblemCode::AlignContentDrift,
            sid,
            "data-no-rewrite 禁止 data-reordered=\"true\"：本轮只重选源文切点，请原样保留句级译文（词序交叉标 data-crossing=\"true\"）",
        ));
    }
    if reordered {
        let old_units = target_cps_chars(&sentence.translation, lang);
        let new_units = target_cps_chars(&target_concat, lang);
        if reordered_rewrite_exceeds(old_units, new_units) {
            diagnostics.push_problem(Problem::sentence(
                ProblemCode::AlignContentDrift,
                sid,
                format!(
                    "重排译文改写幅度过大（{old_units} → {new_units} 阅读单位）：只调小句顺序与必要的连接词，或改标 data-crossing=\"true\""
                ),
            ));
        }
    } else if normalize_chars(&target_concat) != normalize_chars(&sentence.translation) {
        diagnostics.push_problem(Problem::sentence(
            ProblemCode::AlignContentDrift,
            sid,
            "行片拼接与句级译文不一致；若确需改写请标 data-reordered=\"true\"",
        ));
    }

    let pieces: Vec<&str> = rows.iter().map(|row| row.target.as_str()).collect();
    check_over_hard(&pieces, &target_concat, sid, lang, params, diagnostics);

    // The "parallel-action comma seam" that the contract permits (source lines too dense + both pieces are complete actions) is exempted by the same criteria used by json-v0 acceptance and `ccut check`. If it were not exempted, the contract would allow it but the lint would reject it.
    let sources: Vec<&str> = rows.iter().map(|row| row.source.as_str()).collect();
    let allowed_list_seams = crate::engines::align::allowed_list_seam_indices_for_source_rows(
        &pieces,
        &sources,
        &input.source_lang,
    );
    let messages: Vec<String> = lint_pieces(&pieces, lang, params)
        .iter()
        .filter(|issue| is_objective_blocking(issue))
        .filter(|issue| {
            !(issue.class == SeamLintClass::ListSeparator
                && allowed_list_seams.contains(&issue.piece_index))
        })
        .map(|issue| issue.message.clone())
        .collect();
    if !messages.is_empty() {
        diagnostics.push_problem(Problem::sentence(
            ProblemCode::AlignIllegalSeam,
            sid,
            messages.join("；"),
        ));
    }
}

/// hard-limit validation, with actionable hints.
///
/// A bare message reporting only "piece N: X units exceeds hard" often makes the worker resubmit in place. The same piece gets retried three times in lint, and finally force-through lets it pass and the engine hard-cuts it mechanically. In the live case 01a00494, piece 4 of s-g109.20 with 23 units already had a legal cut point at "，". Three handling tiers:
///
/// 1. A legal split of the translation exists ([`legal_split_for_lang`]: every piece ≤ hard, no objective grammatical seams cut) ⇒ still report [`ProblemCode::AlignOverHard`]. When the cut point is backed by punctuation or whitespace, the detail gives the split directly. When only CJK character boundaries remain (the splitter has no dictionary, so it cannot choose word boundaries for the worker), it only says "no punctuation or whitespace seam inside the piece; please cut at a word boundary". When there is no solution inside the piece but there is one for the whole sentence, it hints to re-cut together with the adjacent pieces;
/// 2. Even the whole translation has no legal split (a giant Latin token, where every seam is an objective grammatical error) ⇒ only [`WarningCode::AlignOverHardUncuttable`] is recorded, and it is **not rejected**. Apart from rewriting the translation, the worker has no legal action, and rejection would only burn lint tries. On the acceptance side the engine already treats this code as advisory and hard-cuts mechanically per `enforce_target_hard_limit`, so letting it pass at submit time does not change the final result.
fn check_over_hard(
    pieces: &[&str],
    target_concat: &str,
    sid: &str,
    lang: &str,
    params: &TransParams,
    diagnostics: &mut Diagnostics,
) {
    let over_hard: Vec<(usize, usize)> = pieces
        .iter()
        .enumerate()
        .filter_map(|(index, text)| {
            let width = piece_display_units(text, lang);
            (width > params.hard).then_some((index, width))
        })
        .collect();
    if over_hard.is_empty() {
        return;
    }

    let mut fixable: Vec<String> = Vec::new();
    let mut uncuttable: Vec<String> = Vec::new();
    // The whole-sentence legal split is only computed when there is no solution inside the piece, and it is computed only once per sentence.
    let mut sentence_advice: Option<CutAdvice> = None;
    let mut sentence_hint: Option<Vec<String>> = None;
    for (index, width) in over_hard {
        let label = format!(
            "第 {} 片 {} 单位超过 hard 上限 {}",
            index + 1,
            width,
            params.hard
        );
        match over_hard_piece_advice(pieces, index, lang, params) {
            CutAdvice::Backed(parts) => {
                fixable.push(format!("{label}，可切为{}", render_cut_hint(&parts)));
                continue;
            }
            CutAdvice::MidwordOnly => {
                fixable.push(format!("{label}，片内无标点/空白缝，请在词边界处切开"));
                continue;
            }
            CutAdvice::None => {}
        }
        let advice = sentence_advice
            .get_or_insert_with(|| CutAdvice::from(legal_partition(target_concat, lang, params)));
        match advice {
            CutAdvice::Backed(parts) => {
                sentence_hint.get_or_insert_with(|| parts.clone());
                fixable.push(format!("{label}，片内无合法切点，需连同相邻片一起重切"));
            }
            CutAdvice::MidwordOnly => fixable.push(format!(
                "{label}，片内无合法切点，需连同相邻片一起在词边界处重切"
            )),
            CutAdvice::None => uncuttable.push(label),
        }
    }

    if !fixable.is_empty() {
        let mut detail = fixable.join("；");
        if let Some(parts) = sentence_hint.as_ref() {
            detail.push_str(&format!("；整句可重切为{}", render_cut_hint(parts)));
        }
        detail.push_str("；对应源文段在同一位置切开");
        diagnostics.push_problem(Problem::sentence(ProblemCode::AlignOverHard, sid, detail));
    }
    if !uncuttable.is_empty() {
        diagnostics.push_warning(Warning::sentence(
            WarningCode::AlignOverHardUncuttable,
            sid,
            format!(
                "{}，且译文无合法切点：提交期放行，引擎按 hard 机械硬切",
                uncuttable.join("；")
            ),
        ));
    }
}

/// A legal-split suggestion for a stretch of translation.
enum CutAdvice {
    /// A legal split exists and every seam is backed by punctuation or whitespace: it can be given directly as the split hint.
    Backed(Vec<String>),
    /// A legal split exists, but at least one seam falls on a CJK character boundary ([`cjk_midword_boundary`]): the splitter has no dictionary, so it cannot choose word boundaries for the worker. It only says that a cut at a word boundary is needed.
    MidwordOnly,
    /// No legal split exists.
    None,
}

impl From<Option<Vec<String>>> for CutAdvice {
    fn from(parts: Option<Vec<String>>) -> Self {
        match parts {
            Option::None => Self::None,
            Some(parts) => {
                let midword = parts
                    .windows(2)
                    .any(|pair| cjk_midword_boundary(pair[0].trim_end(), pair[1].trim_start()));
                if midword {
                    Self::MidwordOnly
                } else {
                    Self::Backed(parts)
                }
            }
        }
    }
}

/// The in-piece legal-split suggestion for piece `index`: after the strict splitter's pieces are substituted back into the whole group, the number of objective blocking seams must not increase. End-piece dangling and similar rules depend on a piece's position within the group, so it must be put back in place before linting.
fn over_hard_piece_advice(
    pieces: &[&str],
    index: usize,
    lang: &str,
    params: &TransParams,
) -> CutAdvice {
    let text = pieces[index];
    let neighbours: Vec<&str> = pieces
        .iter()
        .copied()
        .enumerate()
        .filter_map(|(i, piece)| (i != index).then_some(piece))
        .collect();
    let baseline = objective_blocking_count(pieces, lang, params);
    CutAdvice::from(legal_partition_with(text, lang, params, |parts| {
        let mut substituted: Vec<&str> = neighbours[..index].to_vec();
        substituted.extend(parts.iter().map(String::as_str));
        substituted.extend_from_slice(&neighbours[index..]);
        objective_blocking_count(&substituted, lang, params) <= baseline
    }))
}

/// An independent legal split of a whole text: every piece ≤ hard, and it has no objective blocking seams of its own.
fn legal_partition(text: &str, lang: &str, params: &TransParams) -> Option<Vec<String>> {
    legal_partition_with(text, lang, params, |parts| {
        let borrowed: Vec<&str> = parts.iter().map(String::as_str).collect();
        objective_blocking_count(&borrowed, lang, params) == 0
    })
}

/// The strict legal splitter ([`legal_split_for_lang`]: only cuts non-objective-grammar seams, every piece ≤ hard, no hard cuts at character positions) gives ≥2 pieces and satisfies `accept` (the caller's seam criteria after putting the pieces back into context). Then it is a legal split.
fn legal_partition_with(
    text: &str,
    lang: &str,
    params: &TransParams,
    accept: impl Fn(&[String]) -> bool,
) -> Option<Vec<String>> {
    let width = target_cps_chars(text, lang);
    // The cap on the number of pieces only limits the scale of the DP. ≥ ceil(width / soft) is enough for every piece to land near soft; more pieces would not change the conclusion of "whether a legal split with every piece ≤ hard exists".
    let max_pieces = width.div_ceil(params.soft.max(1)) + 2;
    let parts = legal_split_for_lang(text, params, max_pieces, lang)?;
    if parts.len() < 2 {
        return None;
    }
    debug_assert!(
        parts
            .iter()
            .all(|part| piece_display_units(part, lang) <= params.hard)
    );
    accept(&parts).then_some(parts)
}

fn objective_blocking_count(pieces: &[&str], lang: &str, params: &TransParams) -> usize {
    lint_pieces(pieces, lang, params)
        .iter()
        .filter(|issue| is_objective_blocking(issue))
        .count()
}

/// 「a」｜「b」｜「c」。
fn render_cut_hint(parts: &[String]) -> String {
    parts
        .iter()
        .map(|part| format!("「{}」", part.trim()))
        .collect::<Vec<_>>()
        .join("｜")
}

/// `rowspan` redundancy check: a mismatch only reports a diagnostic, not a protocol problem (§8.3 "pure redundancy check").
fn check_rowspan(element: &Element, sid: &str, rows: usize, diagnostics: &mut Diagnostics) {
    let Some(raw) = element
        .descendants()
        .into_iter()
        .find_map(|child| child.attr("rowspan"))
    else {
        return;
    };
    match raw.trim().parse::<usize>() {
        Ok(value) if value == rows => {}
        Ok(value) => diagnostics.push_warning(Warning::sentence(
            WarningCode::RowspanMismatch,
            sid,
            format!("rowspan={value} 与实际 {rows} 行不符"),
        )),
        Err(_) => diagnostics.push_warning(Warning::sentence(
            WarningCode::RowspanMismatch,
            sid,
            format!("rowspan=\"{raw}\" 不可解析"),
        )),
    }
}

/// Reads a boolean attribute. When an uninterpretable value appears, a diagnostic is recorded and the value is treated as `false`.
fn bool_attr(element: &Element, name: &str, sid: &str, diagnostics: &mut Diagnostics) -> bool {
    let Some(raw) = element.attr(name) else {
        return false;
    };
    let value = raw.trim();
    if value.eq_ignore_ascii_case("true") || value == "1" {
        return true;
    }
    if value.eq_ignore_ascii_case("false") || value == "0" || value.is_empty() {
        return false;
    }
    diagnostics.push_warning(Warning::sentence(
        WarningCode::ContentIgnored,
        sid,
        format!("{name}=\"{value}\" 不是布尔值，按 false 处理"),
    ));
    false
}

/// Extracts (source segment, translation piece) pairs from a group.
///
/// Location ladder (tag names never take part):
/// 1. If the same row contains both `class="src"` and `class="tgt"` ⇒ take them directly;
/// 2. Otherwise, remove the id column (one with `rowspan` / `scope`, or whose text is exactly the sid) and take cells by position;
/// 3. If more than two cells remain after removal, take the **last two cells**. The id column is always leftmost, and redundant columns can only appear on the left.
fn extract_rows(
    element: &Element,
    sid: Option<&str>,
    diagnostics: &mut Diagnostics,
) -> Vec<AlignParsedRow> {
    let mut rows = Vec::new();
    for row in element.child_elements() {
        let cells = row.child_elements();
        if cells.is_empty() {
            continue;
        }
        if let (Some(source), Some(target)) = (
            cells.iter().find(|cell| cell.has_class("src")),
            cells.iter().find(|cell| cell.has_class("tgt")),
        ) {
            rows.push(AlignParsedRow {
                source: source.text(),
                target: target.text(),
            });
            continue;
        }
        let data: Vec<&&Element> = cells.iter().filter(|cell| !is_id_cell(cell, sid)).collect();
        if data.len() < 2 {
            diagnostics.push_warning(Warning::document(
                WarningCode::ContentIgnored,
                format!("忽略列数不足的行：{}", row.text()),
            ));
            continue;
        }
        if data.len() > 2 {
            diagnostics.push_warning(Warning::document(
                WarningCode::ContentIgnored,
                format!("行内多余的列已忽略：{}", row.text()),
            ));
        }
        rows.push(AlignParsedRow {
            source: data[data.len() - 2].text(),
            target: data[data.len() - 1].text(),
        });
    }
    rows
}

/// Whether this is an id-column cell.
fn is_id_cell(cell: &Element, sid: Option<&str>) -> bool {
    if cell.attrs.contains_key("rowspan") || cell.attrs.contains_key("scope") {
        return true;
    }
    sid.is_some_and(|sid| cell.text().trim() == sid)
}

/// Missing-id determination: a consecutive suffix missing as a whole ⇒ truncation; otherwise, per-sentence `missing-id`.
fn report_missing(input: &AlignTableInput, seen: &BTreeSet<String>, diagnostics: &mut Diagnostics) {
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
    let suffix_all_missing = input.sentences[first_missing..]
        .iter()
        .all(|sentence| !seen.contains(&sentence.id));
    if suffix_all_missing {
        diagnostics.push_problem(Problem::document(
            ProblemCode::DocumentTruncated,
            format!(
                "自 {} 起共 {} 句整体缺失，疑似输出被截断",
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
            "期望的 id 未出现在输出中",
        ));
    }
}

/// Read-only context reconciliation.
///
/// It matches by content rather than by position. When the model echoes back only one of them, a positional comparison would match "following context" against "preceding context" and waste a `source-drift` (a whole-page retry). Text that appears in the output but matches none of the expected context rows ⇒ it was modified. Not echoed at all ⇒ only a diagnostic is recorded.
fn check_context(input: &AlignTableInput, contexts: &[&Element], diagnostics: &mut Diagnostics) {
    let expected: Vec<(String, String)> = input
        .context_before
        .iter()
        .chain(input.context_after.iter())
        .map(|row| {
            (
                normalize_chars(&row.source),
                normalize_chars(&row.translation),
            )
        })
        .collect();
    if expected.is_empty() {
        if !contexts.is_empty() {
            diagnostics.push_warning(Warning::document(
                WarningCode::ContentIgnored,
                "输出里出现了协议外的只读上下文分组",
            ));
        }
        return;
    }
    if contexts.is_empty() {
        diagnostics.push_warning(Warning::document(
            WarningCode::ContentIgnored,
            "输出未回显只读上下文行",
        ));
        return;
    }
    // Shape diagnostics for context rows are not actionable (they should not be echoed or modified at all), so they go into a local diagnostics bucket and do not pollute the sentence-level ledger.
    let mut ignored = Diagnostics::new();
    for element in contexts {
        let rows = extract_rows(element, None, &mut ignored);
        if rows.is_empty() {
            diagnostics.push_warning(Warning::document(
                WarningCode::ContentIgnored,
                "忽略无法解析的只读上下文分组",
            ));
            continue;
        }
        let source = normalize_chars(
            &rows
                .iter()
                .map(|row| row.source.as_str())
                .collect::<String>(),
        );
        let target = normalize_chars(
            &rows
                .iter()
                .map(|row| row.target.as_str())
                .collect::<String>(),
        );
        if !expected
            .iter()
            .any(|(want_source, want_target)| *want_source == source && *want_target == target)
        {
            diagnostics.push_problem(Problem::document(
                ProblemCode::SourceDrift,
                "只读上下文行被修改",
            ));
        }
    }
}

/// Whether code-fence markers still remain after normalization (multiple fences, or extra explanation mixed in ⇒ `document-wrapped`).
fn has_residual_fence(text: &str) -> bool {
    text.lines().any(|line| {
        let trimmed = line.trim();
        trimmed.starts_with("```") || trimmed.starts_with("~~~")
    })
}

#[cfg(test)]
mod tests {
    use super::super::html::normalize_html_text;
    use super::*;

    #[test]
    fn contradictory_payload_is_rejected_by_both_preflight_and_answer_lint() {
        let mut input = AlignTableInput {
            lang: "zh".into(),
            params: TransParams::for_lang("zh"),
            source_lang: String::new(),
            context_before: vec![],
            context_after: vec![],
            sentences: vec![AlignSentenceInput::new("s1", "one two", "第一部分第二部分")],
        };
        for (budget, frozen) in [
            ((8, 4), vec![]),
            ((2, 3), vec!["第一部分第二部分".to_owned()]),
            ((2, 3), vec!["第一部分".to_owned(), "不是原译文".to_owned()]),
        ] {
            input.sentences[0].suggested_pieces = budget;
            input.sentences[0].frozen_target = frozen;
            assert!(validate_input_constraints(&input).is_err());
            let payload = render_align_table(&input);
            let restored = parse_align_table_input(&payload).unwrap();
            let result = parse_align_table(&restored, None, &payload);
            assert_eq!(
                result.diagnostics.problems[0].code,
                ProblemCode::InputConflict
            );
        }
    }

    /// The right-hand side of the round-trip invariant: rendering applies [`sanitize_inline_text`], and parsing applies [`normalize_html_text`] (which includes CJK space folding). Equality holds only in this sense.
    fn expect_cell(text: &str) -> String {
        normalize_html_text(&sanitize_inline_text(text))
    }

    fn sentence(id: &str, source: &str, translation: &str) -> AlignSentenceInput {
        AlignSentenceInput::new(id, source, translation)
    }

    /// Test-side "model answer" renderer: deliberately kept separate from the production renderer, so the round-trip tests do not just verify themselves.
    struct FakeGroup {
        sid: String,
        rows: Vec<(String, String)>,
        reordered: bool,
        crossing: bool,
        unsplittable: bool,
        rowspan: Option<usize>,
        classed: bool,
    }

    impl FakeGroup {
        fn new(sid: &str, rows: &[(&str, &str)]) -> Self {
            Self {
                sid: sid.to_owned(),
                rows: rows
                    .iter()
                    .map(|(a, b)| ((*a).to_owned(), (*b).to_owned()))
                    .collect(),
                reordered: false,
                crossing: false,
                unsplittable: false,
                rowspan: None,
                classed: false,
            }
        }

        fn html(&self) -> String {
            let mut out = format!("<tbody data-sid=\"{}\"", escape_attr(&self.sid));
            if self.reordered {
                out.push_str(" data-reordered=\"true\"");
            }
            if self.crossing {
                out.push_str(" data-crossing=\"true\"");
            }
            if self.unsplittable {
                out.push_str(" data-unsplittable=\"true\"");
            }
            out.push_str(">\n");
            let rowspan = self.rowspan.unwrap_or(self.rows.len());
            for (index, (source, target)) in self.rows.iter().enumerate() {
                out.push_str("<tr>");
                if index == 0 {
                    out.push_str(&format!(
                        "<th rowspan=\"{}\" scope=\"rowgroup\">{}</th>",
                        rowspan,
                        escape_text(&self.sid)
                    ));
                }
                let (src_attr, tgt_attr) = if self.classed {
                    (" class=\"src\"", " class=\"tgt\"")
                } else {
                    ("", "")
                };
                out.push_str(&format!(
                    "<td{}>{}</td><td{}>{}</td></tr>\n",
                    src_attr,
                    escape_text(source),
                    tgt_attr,
                    escape_text(target)
                ));
            }
            out.push_str("</tbody>\n");
            out
        }
    }

    fn fake_table(groups: &[FakeGroup]) -> String {
        let mut out = String::from("<table data-ccut-format=\"align-table/1\">\n");
        for group in groups {
            out.push_str(&group.html());
        }
        out.push_str("</table>\n");
        out
    }

    fn fake_rows_only(groups: &[FakeGroup]) -> String {
        groups.iter().map(FakeGroup::html).collect()
    }

    // -- Rendering and round-trip ----------------------------------------------

    #[test]
    fn render_carries_protocol_attributes_only() {
        let mut item = sentence("s-g1.0", "hello world", "你好世界");
        item.max_lines = 2;
        item.suggested_pieces = (2, 3);
        let input = AlignTableInput::new("zh", vec![item]);
        let html = render_align_table(&input);
        assert!(html.contains("data-ccut-format=\"align-table/1\""));
        assert!(html.contains("data-lang=\"zh\""));
        assert!(html.contains("data-fit=\"16\""));
        assert!(html.contains("data-hard=\"20\""));
        assert!(html.contains("data-sid=\"s-g1.0\""));
        assert!(html.contains("data-max-lines=\"2\""));
        assert!(html.contains("data-budget=\"每行≤16字，建议2–3片\""));
        assert!(html.contains("rowspan=\"1\""));
        // Absolute timestamps, word ids, and source Cue boundaries do not enter the payload.
        assert!(!html.contains("data-unsplittable"));
        assert!(!html.contains("<style"));
        assert!(!html.contains("秒"));
    }

    #[test]
    fn render_budget_switches_unit_for_latin() {
        let mut item = sentence("s-1", "a", "b");
        item.suggested_pieces = (3, 3);
        let input = AlignTableInput::new("en", vec![item]);
        let html = render_align_table(&input);
        assert!(html.contains("data-fit=\"42\""));
        assert!(html.contains("data-budget=\"每行≤42字符，建议3片\""));
    }

    #[test]
    fn roundtrip_single_sentence_single_piece() {
        let input = AlignTableInput::new(
            "zh",
            vec![sentence("s-g1.0", "hello world", "你好，世界。")],
        );
        let output = render_align_table(&input);
        let parsed = parse_align_table(&input, None, &output);
        assert!(
            !parsed.diagnostics.has_problems(),
            "{:?}",
            parsed.diagnostics
        );
        assert_eq!(parsed.groups.len(), 1);
        let group = parsed.group("s-g1.0").unwrap();
        assert_eq!(group.rows.len(), 1);
        assert_eq!(group.rows[0].source, "hello world");
        assert_eq!(group.rows[0].target, "你好，世界。");
        assert!(!group.reordered && !group.crossing && !group.unsplittable);
    }

    #[test]
    fn roundtrip_multi_sentence_multi_piece() {
        let input = AlignTableInput::new(
            "zh",
            vec![
                sentence(
                    "s-g1.0",
                    "Ninety days, eight times the growth, and we did it without any paid marketing.",
                    "九十天翻了八倍，没花一分钱做付费营销。",
                ),
                sentence("s-g1.1", "That is the whole story.", "这就是全部经过。"),
            ],
        );
        let output = fake_table(&[
            FakeGroup::new(
                "s-g1.0",
                &[
                    ("Ninety days, eight times the growth,", "九十天翻了八倍，"),
                    (
                        "and we did it without any paid marketing.",
                        "没花一分钱做付费营销。",
                    ),
                ],
            ),
            FakeGroup::new(
                "s-g1.1",
                &[("That is the whole story.", "这就是全部经过。")],
            ),
        ]);
        let parsed = parse_align_table(&input, None, &output);
        assert!(
            !parsed.diagnostics.has_problems(),
            "{:?}",
            parsed.diagnostics
        );
        assert_eq!(
            parsed
                .groups
                .iter()
                .map(|g| g.id.as_str())
                .collect::<Vec<_>>(),
            vec!["s-g1.0", "s-g1.1"]
        );
        assert_eq!(parsed.groups[0].rows.len(), 2);
        assert_eq!(parsed.groups[0].rows[1].target, "没花一分钱做付费营销。");
    }

    #[test]
    fn roundtrip_covers_cjk_latin_and_mixed_scripts() {
        let cases = [
            ("s-1", "純粋な日本語の文です", "纯 CJK 的一句"),
            ("s-2", "a plain latin sentence here", "another latin line"),
            ("s-3", "mixed 中文 and English 混排", "混排 mixed 结果"),
        ];
        let input = AlignTableInput::new(
            "zh",
            cases
                .iter()
                .map(|(id, source, translation)| sentence(id, source, translation))
                .collect(),
        );
        let output = render_align_table(&input);
        let parsed = parse_align_table(&input, None, &output);
        assert!(
            !parsed.diagnostics.has_problems(),
            "{:?}",
            parsed.diagnostics
        );
        for (id, source, translation) in cases {
            let group = parsed.group(id).unwrap();
            assert_eq!(group.rows[0].source, expect_cell(source));
            assert_eq!(group.rows[0].target, expect_cell(translation));
        }
        // Spaces between CJK characters are folded, while spaces between Latin characters are not. The round-trip holds only in the normalized sense.
        assert_eq!(expect_cell("纯 CJK 的一句"), "纯 CJK 的一句");
        assert_eq!(expect_cell("你好 世界"), "你好世界");
        assert_eq!(expect_cell("hello  world"), "hello world");
    }

    #[test]
    fn roundtrip_escapes_html_specials() {
        let input = AlignTableInput::new(
            "zh",
            vec![sentence(
                "s-1",
                "a < b && c > d \"quoted\"",
                "a < b 且 c > d 「引用」",
            )],
        );
        let output = render_align_table(&input);
        assert!(output.contains("&lt;") && output.contains("&amp;") && output.contains("&gt;"));
        let parsed = parse_align_table(&input, None, &output);
        assert!(
            !parsed.diagnostics.has_problems(),
            "{:?}",
            parsed.diagnostics
        );
        assert_eq!(parsed.groups[0].rows[0].source, "a < b && c > d \"quoted\"");
    }

    #[test]
    fn roundtrip_long_sentence_and_empty_context() {
        let source = "word ".repeat(120);
        let translation = "很长的中文句子".repeat(30);
        let input = AlignTableInput::new("zh", vec![sentence("s-1", &source, &translation)]);
        assert!(input.context_before.is_empty() && input.context_after.is_empty());
        let output = render_align_table(&input);
        let parsed = parse_align_table(&input, None, &output);
        assert_eq!(parsed.groups[0].rows[0].source, expect_cell(&source));
        // A single piece for the whole sentence necessarily exceeds hard, but the structural layer does not drop the group because of that.
        assert!(parsed.diagnostics.has_code(ProblemCode::AlignOverHard));
        assert!(!parsed.diagnostics.has_code(ProblemCode::AlignContentDrift));
    }

    #[test]
    fn roundtrip_context_rows() {
        let mut input = AlignTableInput::new("zh", vec![sentence("s-2", "middle", "中间句")]);
        input.context_before = vec![AlignContextRow::new("before sentence", "前一句")];
        input.context_after = vec![AlignContextRow::new("after sentence", "后一句")];
        let output = render_align_table(&input);
        assert!(output.contains("class=\"ctx\""));
        let parsed = parse_align_table(&input, None, &output);
        assert!(
            !parsed.diagnostics.has_problems(),
            "{:?}",
            parsed.diagnostics
        );
        assert_eq!(parsed.groups.len(), 1);
    }

    #[test]
    fn empty_sentence_list_renders_and_parses_clean() {
        let input = AlignTableInput::new("zh", Vec::new());
        let output = render_align_table(&input);
        let parsed = parse_align_table(&input, None, &output);
        assert!(parsed.groups.is_empty());
        assert!(
            !parsed.diagnostics.has_problems(),
            "{:?}",
            parsed.diagnostics
        );
    }

    #[test]
    fn model_flags_roundtrip() {
        let input = AlignTableInput::new(
            "zh",
            vec![
                sentence("s-1", "abc", "甲乙丙"),
                sentence("s-2", "def", "丁戊己"),
            ],
        );
        let mut reordered = FakeGroup::new("s-1", &[("abc", "丙乙甲")]);
        reordered.reordered = true;
        let mut unsplittable = FakeGroup::new("s-2", &[("def", "丁戊己")]);
        unsplittable.unsplittable = true;
        let parsed = parse_align_table(&input, None, &fake_table(&[reordered, unsplittable]));
        assert!(parsed.group("s-1").unwrap().reordered);
        assert!(parsed.group("s-2").unwrap().unsplittable);
        // reordered groups skip the concatenation consistency check (the rewrite-magnitude guard is in the engine layer).
        assert!(!parsed.diagnostics.has_code(ProblemCode::AlignContentDrift));
    }

    #[test]
    fn unsplittable_group_still_reports_over_hard() {
        let translation = "这是一个非常长且完全无法在源侧找到任何切点的中文译句内容";
        let input = AlignTableInput::new("zh", vec![sentence("s-1", "src", translation)]);
        let mut group = FakeGroup::new("s-1", &[("src", translation)]);
        group.unsplittable = true;
        let parsed = parse_align_table(&input, None, &fake_table(&[group]));
        assert!(parsed.group("s-1").unwrap().unsplittable);
        assert!(parsed.diagnostics.has_code(ProblemCode::AlignOverHard));
    }

    // -- Negative cases ----------------------------------------------------------

    #[test]
    fn bare_tbody_without_table_wrapper_is_recovered() {
        let input = AlignTableInput::new("zh", vec![sentence("s-1", "abc def", "甲乙丙")]);
        let bare = fake_rows_only(&[FakeGroup::new("s-1", &[("abc", "甲乙"), ("def", "丙")])]);
        assert!(!bare.contains("<table"));
        // Document mode silently drops all rows, so the recovery path must come before the truncation check.
        assert!(parse_html(&bare).elements_with_attr("data-sid").is_empty());
        let parsed = parse_align_table(&input, None, &bare);
        assert_eq!(parsed.groups.len(), 1);
        assert_eq!(parsed.groups[0].rows.len(), 2);
        assert!(!parsed.diagnostics.has_code(ProblemCode::DocumentTruncated));
        assert!(!parsed.diagnostics.has_code(ProblemCode::MissingId));
    }

    #[test]
    fn trailing_suffix_gap_reports_truncated() {
        let input = AlignTableInput::new(
            "zh",
            vec![
                sentence("s-1", "a", "甲"),
                sentence("s-2", "b", "乙"),
                sentence("s-3", "c", "丙"),
                sentence("s-4", "d", "丁"),
            ],
        );
        let output = fake_table(&[
            FakeGroup::new("s-1", &[("a", "甲")]),
            FakeGroup::new("s-2", &[("b", "乙")]),
        ]);
        let parsed = parse_align_table(&input, None, &output);
        assert!(parsed.diagnostics.has_code(ProblemCode::DocumentTruncated));
        assert!(!parsed.diagnostics.has_code(ProblemCode::MissingId));
        assert!(
            parsed.diagnostics.problems[0].detail.contains("s-3"),
            "{:?}",
            parsed.diagnostics.problems
        );
    }

    #[test]
    fn scattered_gap_reports_missing_id() {
        let input = AlignTableInput::new(
            "zh",
            vec![
                sentence("s-1", "a", "甲"),
                sentence("s-2", "b", "乙"),
                sentence("s-3", "c", "丙"),
            ],
        );
        let output = fake_table(&[
            FakeGroup::new("s-1", &[("a", "甲")]),
            FakeGroup::new("s-3", &[("c", "丙")]),
        ]);
        let parsed = parse_align_table(&input, None, &output);
        assert!(parsed.diagnostics.has_code(ProblemCode::MissingId));
        assert!(!parsed.diagnostics.has_code(ProblemCode::DocumentTruncated));
    }

    #[test]
    fn empty_output_counts_as_truncated() {
        let input = AlignTableInput::new("zh", vec![sentence("s-1", "a", "甲")]);
        let parsed = parse_align_table(&input, None, "");
        assert!(parsed.diagnostics.has_code(ProblemCode::DocumentTruncated));
    }

    #[test]
    fn duplicate_sid_is_reported_once_and_first_wins() {
        let input = AlignTableInput::new("zh", vec![sentence("s-1", "a b", "甲乙")]);
        let output = fake_table(&[
            FakeGroup::new("s-1", &[("a", "甲"), ("b", "乙")]),
            FakeGroup::new("s-1", &[("a b", "甲乙")]),
        ]);
        let parsed = parse_align_table(&input, None, &output);
        assert_eq!(parsed.groups.len(), 1);
        assert_eq!(parsed.groups[0].rows.len(), 2);
        assert_eq!(
            parsed
                .diagnostics
                .problems
                .iter()
                .filter(|p| p.code == ProblemCode::DuplicateId)
                .count(),
            1
        );
    }

    #[test]
    fn nested_sid_echo_is_not_a_duplicate() {
        let input = AlignTableInput::new("zh", vec![sentence("s-1", "a b", "甲乙")]);
        // The model writes data-sid on both the group and every row.
        let output = concat!(
            "<table><tbody data-sid=\"s-1\">",
            "<tr data-sid=\"s-1\"><th rowspan=\"2\" scope=\"rowgroup\">s-1</th><td>a</td><td>甲</td></tr>",
            "<tr data-sid=\"s-1\"><td>b</td><td>乙</td></tr>",
            "</tbody></table>"
        );
        let parsed = parse_align_table(&input, None, output);
        assert_eq!(parsed.groups.len(), 1);
        assert_eq!(parsed.groups[0].rows.len(), 2);
        assert!(!parsed.diagnostics.has_code(ProblemCode::DuplicateId));
    }

    #[test]
    fn unknown_sid_is_reported_and_ignored() {
        let input = AlignTableInput::new("zh", vec![sentence("s-1", "a", "甲")]);
        let output = fake_table(&[
            FakeGroup::new("s-1", &[("a", "甲")]),
            FakeGroup::new("s-99", &[("x", "叉")]),
        ]);
        let parsed = parse_align_table(&input, None, &output);
        assert_eq!(parsed.groups.len(), 1);
        assert!(parsed.diagnostics.has_code(ProblemCode::UnknownId));
    }

    #[test]
    fn ids_are_compared_byte_exactly() {
        let input = AlignTableInput::new("zh", vec![sentence("s-G1.0", "a", "甲")]);
        let parsed = parse_align_table(
            &input,
            None,
            &fake_table(&[FakeGroup::new("s-g1.0", &[("a", "甲")])]),
        );
        assert!(parsed.diagnostics.has_code(ProblemCode::UnknownId));
        assert!(parsed.diagnostics.has_code(ProblemCode::DocumentTruncated));
    }

    #[test]
    fn empty_translation_is_reported() {
        let input = AlignTableInput::new("zh", vec![sentence("s-1", "a b", "甲乙")]);
        let parsed = parse_align_table(
            &input,
            None,
            &fake_table(&[FakeGroup::new("s-1", &[("a", "甲乙"), ("b", "  ")])]),
        );
        assert!(parsed.diagnostics.has_code(ProblemCode::EmptyTranslation));
    }

    #[test]
    fn group_without_rows_is_present_but_empty() {
        let input = AlignTableInput::new(
            "zh",
            vec![sentence("s-1", "a", "甲"), sentence("s-2", "b", "乙")],
        );
        let output = concat!(
            "<table><tbody data-sid=\"s-1\"><tr><th scope=\"rowgroup\">s-1</th><td>a</td><td>甲</td></tr></tbody>",
            "<tbody data-sid=\"s-2\"></tbody></table>"
        );
        let parsed = parse_align_table(&input, None, output);
        // Having data-sid counts as "the id has appeared": it is not a truncation, only the empty translation is reported.
        assert!(!parsed.diagnostics.has_code(ProblemCode::DocumentTruncated));
        assert!(!parsed.diagnostics.has_code(ProblemCode::MissingId));
        assert!(parsed.diagnostics.has_code(ProblemCode::EmptyTranslation));
        assert_eq!(parsed.group("s-2").unwrap().rows.len(), 0);
    }

    #[test]
    fn source_column_edit_reports_source_drift() {
        let input = AlignTableInput::new("zh", vec![sentence("s-1", "alpha beta gamma", "甲乙丙")]);
        let parsed = parse_align_table(
            &input,
            None,
            &fake_table(&[FakeGroup::new(
                "s-1",
                &[("alpha beta", "甲乙"), ("delta", "丙")],
            )]),
        );
        assert!(parsed.diagnostics.has_code(ProblemCode::SourceDrift));
    }

    #[test]
    fn source_split_with_only_punctuation_changes_is_accepted() {
        let input = AlignTableInput::new("zh", vec![sentence("s-1", "alpha beta gamma", "甲乙丙")]);
        let parsed = parse_align_table(
            &input,
            None,
            &fake_table(&[FakeGroup::new(
                "s-1",
                &[("alpha, beta", "甲乙"), ("gamma.", "丙")],
            )]),
        );
        assert!(!parsed.diagnostics.has_code(ProblemCode::SourceDrift));
    }

    #[test]
    fn context_row_edit_reports_source_drift() {
        let mut input = AlignTableInput::new("zh", vec![sentence("s-1", "a", "甲")]);
        input.context_before = vec![AlignContextRow::new("before sentence", "前一句")];
        let output = concat!(
            "<table><tbody class=\"ctx\"><tr><th scope=\"rowgroup\"></th>",
            "<td class=\"src\">before sentence CHANGED</td><td class=\"tgt\">前一句</td></tr></tbody>",
            "<tbody data-sid=\"s-1\"><tr><th rowspan=\"1\" scope=\"rowgroup\">s-1</th><td>a</td><td>甲</td></tr></tbody></table>"
        );
        let parsed = parse_align_table(&input, None, output);
        assert!(parsed.diagnostics.has_code(ProblemCode::SourceDrift));
    }

    #[test]
    fn omitted_context_is_a_warning_not_a_problem() {
        let mut input = AlignTableInput::new("zh", vec![sentence("s-1", "a", "甲")]);
        input.context_before = vec![AlignContextRow::new("before", "前")];
        input.context_after = vec![AlignContextRow::new("after", "后")];
        let parsed = parse_align_table(
            &input,
            None,
            &fake_table(&[FakeGroup::new("s-1", &[("a", "甲")])]),
        );
        assert!(
            !parsed.diagnostics.has_problems(),
            "{:?}",
            parsed.diagnostics
        );
        assert!(
            parsed
                .diagnostics
                .warnings
                .iter()
                .any(|w| w.code == WarningCode::ContentIgnored)
        );
    }

    #[test]
    fn partial_context_echo_matches_by_content_not_position() {
        let mut input = AlignTableInput::new("zh", vec![sentence("s-1", "a", "甲")]);
        input.context_before = vec![AlignContextRow::new("before", "前")];
        input.context_after = vec![AlignContextRow::new("after", "后")];
        // Only the "following context" row was echoed back: a positional comparison would match it to context_before.
        let output = concat!(
            "<table><tbody data-sid=\"s-1\"><tr><th rowspan=\"1\" scope=\"rowgroup\">s-1</th><td>a</td><td>甲</td></tr></tbody>",
            "<tbody class=\"ctx\"><tr><th scope=\"rowgroup\"></th><td class=\"src\">after</td><td class=\"tgt\">后</td></tr></tbody></table>"
        );
        let parsed = parse_align_table(&input, None, output);
        assert!(!parsed.diagnostics.has_code(ProblemCode::SourceDrift));
    }

    #[test]
    fn concat_mismatch_reports_content_drift() {
        let input = AlignTableInput::new("zh", vec![sentence("s-1", "a b", "九十天翻了八倍")]);
        let parsed = parse_align_table(
            &input,
            None,
            &fake_table(&[FakeGroup::new("s-1", &[("a", "九十天"), ("b", "涨了八倍")])]),
        );
        assert!(parsed.diagnostics.has_code(ProblemCode::AlignContentDrift));
    }

    #[test]
    fn frozen_target_is_enforced_by_shared_file_lint() {
        let mut frozen = sentence("s-1", "a b", "第一段第二段");
        frozen.frozen_target = vec!["第一段".to_owned(), "第二段".to_owned()];
        let input = AlignTableInput::new("zh", vec![frozen]);

        let accepted = parse_align_table(
            &input,
            None,
            &fake_table(&[FakeGroup::new("s-1", &[("a", "第一段"), ("b", "第二段")])]),
        );
        assert!(!accepted.diagnostics.has_problems());

        let changed = parse_align_table(
            &input,
            None,
            &fake_table(&[FakeGroup::new("s-1", &[("a", "第一"), ("b", "段第二段")])]),
        );
        assert!(
            changed.diagnostics.problems.iter().any(|problem| {
                problem.code == ProblemCode::AlignContentDrift
                    && problem.detail.contains("data-target-frozen")
            }),
            "{:?}",
            changed.diagnostics
        );

        let mut reordered = FakeGroup::new("s-1", &[("a", "第一段"), ("b", "第二段")]);
        reordered.reordered = true;
        let changed = parse_align_table(&input, None, &fake_table(&[reordered]));
        assert!(changed.diagnostics.problems.iter().any(|problem| {
            problem.code == ProblemCode::AlignContentDrift
                && problem.detail.contains("禁止 data-reordered")
        }));
    }

    /// The two requirements of `data-no-rewrite`: it must survive the round-trip with the carrier, and it must reject the rewrite channel.
    ///
    /// Measured in p-fb353b44: in a paired line-filling round, all 38 candidates were rejected and 0 sentences were fixed. In the answer, `data-reordered="true"` made validation use a much looser rewrite-magnitude threshold and let the answers through. But paired acceptance only counts rows against the original `trans`. The two yardsticks did not agree, so the whole round's calls were wasted.
    ///
    /// This check lives inside `parse_align_table`, so the engine provider path and the submit-time validation in `lint_agent_answer_file` share the same one. There is no second copy that could drift.
    #[test]
    fn no_rewrite_rejects_the_reorder_escape_hatch_in_the_shared_lint() {
        let mut locked = sentence("s-1", "a b", "第一段第二段");
        locked.no_rewrite = true;
        let input = AlignTableInput::new("zh", vec![locked]);

        // The attribute must survive the round-trip: after rendering and parsing back, it is still no_rewrite.
        let rendered = render_align_table(&input);
        assert!(rendered.contains("data-no-rewrite=\"true\""), "{rendered}");
        let round_tripped = parse_align_table_input(&rendered).expect("round trip");
        assert!(round_tripped.sentences[0].no_rewrite);

        // Only reselecting cut points: accept.
        let accepted = parse_align_table(
            &input,
            None,
            &fake_table(&[FakeGroup::new("s-1", &[("a", "第一段"), ("b", "第二段")])]),
        );
        assert!(
            !accepted.diagnostics.has_problems(),
            "{:?}",
            accepted.diagnostics
        );

        // Rewrote the translation and marked data-reordered: reject.
        let mut reordered = FakeGroup::new("s-1", &[("a", "第二段落"), ("b", "第一段落")]);
        reordered.reordered = true;
        let rejected = parse_align_table(&input, None, &fake_table(&[reordered]));
        assert!(
            rejected.diagnostics.problems.iter().any(|problem| {
                problem.code == ProblemCode::AlignContentDrift
                    && problem.detail.contains("data-no-rewrite")
            }),
            "{:?}",
            rejected.diagnostics
        );

        // The legitimate route for word-order crossings remains open.
        let mut crossing = FakeGroup::new("s-1", &[("a", "第一段"), ("b", "第二段")]);
        crossing.crossing = true;
        let crossed = parse_align_table(&input, None, &fake_table(&[crossing]));
        assert!(!crossed.diagnostics.has_code(ProblemCode::AlignContentDrift));

        // Sentences without this attribute are unaffected: the rewrite channel remains available as usual.
        let free = AlignTableInput::new("zh", vec![sentence("s-2", "a b", "第一段第二段")]);
        let mut reordered = FakeGroup::new("s-2", &[("a", "第二段"), ("b", "第一段")]);
        reordered.reordered = true;
        let parsed = parse_align_table(&free, None, &fake_table(&[reordered]));
        assert!(!parsed.diagnostics.has_code(ProblemCode::AlignContentDrift));
    }

    #[test]
    fn punctuation_only_change_is_not_content_drift() {
        let input = AlignTableInput::new("zh", vec![sentence("s-1", "a b", "九十天翻了八倍")]);
        let parsed = parse_align_table(
            &input,
            None,
            &fake_table(&[FakeGroup::new(
                "s-1",
                &[("a", "九十天，"), ("b", "翻了八倍。")],
            )]),
        );
        assert!(!parsed.diagnostics.has_code(ProblemCode::AlignContentDrift));
    }

    #[test]
    fn over_hard_piece_is_reported() {
        let long = "这是一个远远超过硬上限的中文字幕行内容不可接受";
        let input = AlignTableInput::new("zh", vec![sentence("s-1", "a b", long)]);
        assert!(target_cps_chars(long, "zh") > TransParams::for_lang("zh").hard);
        let parsed = parse_align_table(
            &input,
            None,
            &fake_table(&[FakeGroup::new("s-1", &[("a b", long)])]),
        );
        assert!(parsed.diagnostics.has_code(ProblemCode::AlignOverHard));
        let problem = parsed
            .diagnostics
            .problems
            .iter()
            .find(|p| p.code == ProblemCode::AlignOverHard)
            .expect("over-hard problem");
        assert!(problem.detail.contains("第 1 片"), "{}", problem.detail);
        // Pure CJK with no punctuation: the splitter has no dictionary, so it gives no concrete split (it would cut inside a word). It only says the cut must be made at word boundaries. It is still a Problem, not a pass.
        assert!(
            problem.detail.contains("请在词边界处切开") && !problem.detail.contains("可切为"),
            "{}",
            problem.detail
        );
        assert!(
            parsed.diagnostics.warnings.is_empty(),
            "{:?}",
            parsed.diagnostics
        );
    }

    /// The live case 01a00494, s-g109.20: piece 4 has 23 units, and there is a legal cut point at "，", yet the worker consumed three lint tries in a row. The detail must give the split directly, and that split itself must pass lint.
    #[test]
    fn over_hard_hint_names_a_legal_in_piece_cut() {
        let translation = "那就是你设定的目标。我们会持续这样做，直到模型自己调用工具update plan、update goal，说明计划或目标已真正实现。";
        let input = AlignTableInput::new(
            "zh-Hans",
            vec![sentence("s-g109.20", "a b c d", translation)],
        );
        let over = "update plan、update goal，说明计划或目标已真正实现。";
        assert!(piece_display_units(over, "zh-Hans") > input.params.hard);
        let parsed = parse_align_table(
            &input,
            None,
            &fake_table(&[FakeGroup::new(
                "s-g109.20",
                &[
                    ("a", "那就是你设定的目标。"),
                    ("b", "我们会持续这样做，"),
                    ("c", "直到模型自己调用工具"),
                    ("d", over),
                ],
            )]),
        );
        let problem = parsed
            .diagnostics
            .problems
            .iter()
            .find(|p| p.code == ProblemCode::AlignOverHard)
            .expect("over-hard problem");
        assert!(
            problem.detail.contains("第 4 片 23 单位"),
            "{}",
            problem.detail
        );
        assert!(
            problem
                .detail
                .contains("可切为「update plan、update goal，」｜「说明计划或目标已真正实现。」"),
            "{}",
            problem.detail
        );
        assert!(
            !parsed
                .diagnostics
                .warnings
                .iter()
                .any(|w| w.code == WarningCode::AlignOverHardUncuttable)
        );

        // After cutting as suggested: no longer over hard, and no align-illegal-seam is introduced.
        let fixed = parse_align_table(
            &input,
            None,
            &fake_table(&[FakeGroup::new(
                "s-g109.20",
                &[
                    ("a", "那就是你设定的目标。"),
                    ("b", "我们会持续这样做，"),
                    ("c", "直到模型自己调用工具"),
                    ("d", "update plan、update goal，"),
                    ("", "说明计划或目标已真正实现。"),
                ],
            )]),
        );
        assert!(
            !fixed.diagnostics.has_code(ProblemCode::AlignOverHard)
                && !fixed.diagnostics.has_code(ProblemCode::AlignIllegalSeam),
            "{:?}",
            fixed.diagnostics
        );
    }

    /// When the whole sentence has no legal split, it is downgraded to a warning and passed. The worker has no legal action, so rejection only burns tries.
    #[test]
    fn over_hard_without_legal_cut_downgrades_to_warning() {
        // A single atom, a giant Latin token: the splitter does no hard cuts at character positions, so the whole sentence has no legal split.
        let token = "supercalifragilisticexpialidocious_extremely_long_identifier_name";
        let input = AlignTableInput::new("zh", vec![sentence("s-1", "a b", token)]);
        assert!(piece_display_units(token, "zh") > input.params.hard);
        let parsed = parse_align_table(
            &input,
            None,
            &fake_table(&[FakeGroup::new("s-1", &[("a b", token)])]),
        );
        assert!(
            !parsed.diagnostics.has_code(ProblemCode::AlignOverHard),
            "{:?}",
            parsed.diagnostics
        );
        let warning = parsed
            .diagnostics
            .warnings
            .iter()
            .find(|w| w.code == WarningCode::AlignOverHardUncuttable)
            .expect("uncuttable warning");
        assert!(warning.detail.contains("第 1 片"), "{}", warning.detail);
        assert!(
            !parsed.diagnostics.has_problems(),
            "{:?}",
            parsed.diagnostics
        );
    }

    #[test]
    fn illegal_seam_is_reported() {
        // A dangling conjunction "和" at the end of a piece: an objective grammatical-error-level problem from seam::lint_pieces.
        let translation = "我们砍掉了付费营销和自建的渠道团队";
        let input = AlignTableInput::new("zh", vec![sentence("s-1", "a b", translation)]);
        let parsed = parse_align_table(
            &input,
            None,
            &fake_table(&[FakeGroup::new(
                "s-1",
                &[("a", "我们砍掉了付费营销和"), ("b", "自建的渠道团队")],
            )]),
        );
        assert!(
            parsed.diagnostics.has_code(ProblemCode::AlignIllegalSeam),
            "{:?}",
            parsed.diagnostics.problems
        );
    }

    /// The contract's paired-row balance permits cutting at the enumeration comma (、) when the source lines are too dense and both sides are complete parallel actions. In Shorts acceptance criterion C6, measurements showed that the align-table submit-time lint still rejected it as an ordinary list.
    fn list_seam_parsed(source_lang: &str, rows: &[(&str, &str)]) -> AlignParsed {
        let source: String = rows
            .iter()
            .map(|(source, _)| *source)
            .collect::<Vec<_>>()
            .join(" ");
        let translation: String = rows.iter().map(|(_, target)| *target).collect();
        let mut input = AlignTableInput::new("zh", vec![sentence("s-1", &source, &translation)]);
        input.source_lang = source_lang.to_owned();
        // The real entry point of the submit-time lint: recover the table input from the persisted payload.
        let table = parse_align_table_input(&render_align_table(&input)).expect("align payload");
        parse_align_table(&table, None, &fake_table(&[FakeGroup::new("s-1", rows)]))
    }

    fn reports_list_separator(parsed: &AlignParsed) -> bool {
        parsed.diagnostics.problems.iter().any(|problem| {
            problem.code == ProblemCode::AlignIllegalSeam
                && problem.detail.contains("list separator")
        })
    }

    #[test]
    fn parallel_action_list_seam_is_allowed_when_source_rows_are_dense() {
        let parsed = list_seam_parsed(
            "en",
            &[
                (
                    "because every single time we have to go and update the skills",
                    "因为得不断更新技能、",
                ),
                ("and check out the branch again", "检出分支，"),
                ("before we push.", "然后再推送。"),
            ],
        );
        assert!(
            !parsed.diagnostics.has_code(ProblemCode::AlignIllegalSeam),
            "{:?}",
            parsed.diagnostics.problems
        );
    }

    #[test]
    fn parallel_action_list_seam_is_rejected_when_source_rows_fit() {
        let parsed = list_seam_parsed(
            "en",
            &[
                ("update skills", "因为得不断更新技能、"),
                ("check out", "检出分支，"),
                ("then push.", "然后再推送。"),
            ],
        );
        assert!(
            reports_list_separator(&parsed),
            "{:?}",
            parsed.diagnostics.problems
        );
    }

    #[test]
    fn noun_list_seam_stays_rejected_even_when_source_rows_are_dense() {
        let parsed = list_seam_parsed(
            "en",
            &[
                (
                    "and what you end up with is the controller that reads the error",
                    "最后得到的是控制器、",
                ),
                ("and the actuator that applies the fix", "执行器，"),
                ("working together.", "二者协同工作。"),
            ],
        );
        assert!(
            reports_list_separator(&parsed),
            "{:?}",
            parsed.diagnostics.problems
        );
    }

    #[test]
    fn list_seam_source_width_follows_the_source_language_budget() {
        // The same 20 source characters: a Chinese source has a single-line budget of 16, so it is already too dense; a Latin source has a budget of 42, so it is not dense.
        let rows = [
            (
                "我们每一次都得回去把全部技能重新更新一",
                "因为得不断更新技能、",
            ),
            ("遍", "检出分支，"),
            ("然后推送。", "然后再推送。"),
        ];
        assert!(
            !list_seam_parsed("zh", &rows)
                .diagnostics
                .has_code(ProblemCode::AlignIllegalSeam)
        );
        assert!(
            list_seam_parsed("", &rows)
                .diagnostics
                .has_code(ProblemCode::AlignIllegalSeam)
        );
    }

    #[test]
    fn rowspan_mismatch_is_a_warning_not_a_problem() {
        let input = AlignTableInput::new("zh", vec![sentence("s-1", "a b", "甲乙")]);
        let mut group = FakeGroup::new("s-1", &[("a", "甲"), ("b", "乙")]);
        group.rowspan = Some(5);
        let parsed = parse_align_table(&input, None, &fake_table(&[group]));
        assert!(
            !parsed.diagnostics.has_problems(),
            "{:?}",
            parsed.diagnostics
        );
        assert!(
            parsed
                .diagnostics
                .warnings
                .iter()
                .any(|w| w.code == WarningCode::RowspanMismatch)
        );
    }

    #[test]
    fn crossing_and_reordered_are_mutually_exclusive() {
        let input = AlignTableInput::new("zh", vec![sentence("s-1", "a", "甲")]);
        let mut group = FakeGroup::new("s-1", &[("a", "乙")]);
        group.reordered = true;
        group.crossing = true;
        let parsed = parse_align_table(&input, None, &fake_table(&[group]));
        let parsed_group = parsed.group("s-1").unwrap();
        assert!(parsed_group.reordered);
        assert!(!parsed_group.crossing);
        assert!(
            parsed
                .diagnostics
                .warnings
                .iter()
                .any(|w| w.code == WarningCode::ContentIgnored)
        );
    }

    #[test]
    fn crossing_alone_survives() {
        let input = AlignTableInput::new("zh", vec![sentence("s-1", "a", "甲")]);
        let mut group = FakeGroup::new("s-1", &[("a", "甲")]);
        group.crossing = true;
        let parsed = parse_align_table(&input, None, &fake_table(&[group]));
        assert!(parsed.group("s-1").unwrap().crossing);
        assert!(!parsed.group("s-1").unwrap().reordered);
    }

    #[test]
    fn non_boolean_flag_value_degrades_to_false() {
        let input = AlignTableInput::new("zh", vec![sentence("s-1", "a", "甲")]);
        let output = "<table><tbody data-sid=\"s-1\" data-unsplittable=\"maybe\"><tr><td>a</td><td>甲</td></tr></tbody></table>";
        let parsed = parse_align_table(&input, None, output);
        assert!(!parsed.group("s-1").unwrap().unsplittable);
        assert!(
            parsed
                .diagnostics
                .warnings
                .iter()
                .any(|w| w.code == WarningCode::ContentIgnored)
        );
    }

    #[test]
    fn control_characters_are_stripped_before_parsing() {
        let input = AlignTableInput::new("zh", vec![sentence("s-1", "ab", "甲乙")]);
        let output = "<table><tbody data-sid=\"s-1\"><tr><td>a\u{202E}b</td><td>甲\u{0007}乙</td></tr></tbody></table>";
        let parsed = parse_align_table(&input, None, output);
        assert_eq!(parsed.groups[0].rows[0].source, "ab");
        assert_eq!(parsed.groups[0].rows[0].target, "甲乙");
        assert!(
            parsed
                .diagnostics
                .warnings
                .iter()
                .any(|w| w.code == WarningCode::ControlStripped)
        );
    }

    #[test]
    fn script_injection_is_dropped() {
        let input = AlignTableInput::new("zh", vec![sentence("s-1", "a", "甲")]);
        let output = concat!(
            "<table><script>fetch('http://evil')</script><style>td{color:red}</style>",
            "<tbody data-sid=\"s-1\"><tr><td onclick=\"x()\">a</td><td>甲</td></tr></tbody></table>"
        );
        let parsed = parse_align_table(&input, None, output);
        assert_eq!(parsed.groups[0].rows[0].target, "甲");
        assert!(!parsed.groups[0].rows[0].source.contains("evil"));
        assert!(
            parsed
                .diagnostics
                .warnings
                .iter()
                .any(|w| w.code == WarningCode::NodeDropped)
        );
        assert!(
            !parsed.diagnostics.has_problems(),
            "{:?}",
            parsed.diagnostics
        );
    }

    #[test]
    fn oversize_output_is_rejected_without_parsing() {
        let input = AlignTableInput::new("zh", vec![sentence("s-1", "a", "甲")]);
        let sent = render_align_table(&input);
        let parsed = parse_align_table(&input, Some(&sent), &"x".repeat(50_000));
        assert!(parsed.groups.is_empty());
        assert_eq!(
            parsed.diagnostics.codes(),
            vec![ProblemCode::DocumentOversize]
        );
    }

    #[test]
    fn residual_fence_reports_wrapped() {
        let input = AlignTableInput::new("zh", vec![sentence("s-1", "a", "甲")]);
        let body = fake_table(&[FakeGroup::new("s-1", &[("a", "甲")])]);
        let output = format!("好的，这是结果：\n```html\n{body}```\n希望有帮助。");
        let parsed = parse_align_table(&input, None, &output);
        assert!(parsed.diagnostics.has_code(ProblemCode::DocumentWrapped));
        // Extra explanation does not prevent continuing to extract the structure.
        assert_eq!(parsed.groups.len(), 1);
    }

    #[test]
    fn single_clean_fence_is_stripped_for_free() {
        let input = AlignTableInput::new("zh", vec![sentence("s-1", "a", "甲")]);
        let body = fake_table(&[FakeGroup::new("s-1", &[("a", "甲")])]);
        let parsed = parse_align_table(&input, None, &format!("```html\n{body}```\n"));
        assert!(
            !parsed.diagnostics.has_problems(),
            "{:?}",
            parsed.diagnostics
        );
        assert!(
            parsed
                .diagnostics
                .warnings
                .iter()
                .any(|w| w.code == WarningCode::WrapperStripped)
        );
    }

    #[test]
    fn extra_left_column_is_ignored_and_last_two_win() {
        let input = AlignTableInput::new("zh", vec![sentence("s-1", "a", "甲")]);
        let output = "<table><tbody data-sid=\"s-1\"><tr><td>1</td><td>a</td><td>甲</td></tr></tbody></table>";
        let parsed = parse_align_table(&input, None, output);
        assert_eq!(parsed.groups[0].rows[0].source, "a");
        assert_eq!(parsed.groups[0].rows[0].target, "甲");
    }

    #[test]
    fn classed_cells_win_over_position() {
        let input = AlignTableInput::new("zh", vec![sentence("s-1", "a", "甲")]);
        let output = "<table><tbody data-sid=\"s-1\"><tr><td class=\"tgt\">甲</td><td class=\"src\">a</td></tr></tbody></table>";
        let parsed = parse_align_table(&input, None, output);
        assert_eq!(parsed.groups[0].rows[0].source, "a");
        assert_eq!(parsed.groups[0].rows[0].target, "甲");
    }

    #[test]
    fn short_row_is_ignored_with_warning() {
        let input = AlignTableInput::new("zh", vec![sentence("s-1", "a", "甲")]);
        let output = "<table><tbody data-sid=\"s-1\"><tr><td>甲</td></tr></tbody></table>";
        let parsed = parse_align_table(&input, None, output);
        assert!(parsed.groups[0].rows.is_empty());
        assert!(parsed.diagnostics.has_code(ProblemCode::EmptyTranslation));
        assert!(
            parsed
                .diagnostics
                .warnings
                .iter()
                .any(|w| w.code == WarningCode::ContentIgnored)
        );
    }

    // -- Deterministic property tests ---------------------------------------------

    /// A hand-written LCG with a fixed seed (unseeded randomness is forbidden; tests must be reproducible bit for bit).
    struct Lcg(u64);

    impl Lcg {
        fn new(seed: u64) -> Self {
            Self(seed)
        }

        fn next(&mut self) -> u64 {
            self.0 = self
                .0
                .wrapping_mul(6_364_136_223_846_793_005)
                .wrapping_add(1_442_695_040_888_963_407);
            self.0 >> 33
        }

        fn below(&mut self, bound: usize) -> usize {
            (self.next() % bound as u64) as usize
        }

        fn pick<'a, T>(&mut self, items: &'a [T]) -> &'a T {
            &items[self.below(items.len())]
        }
    }

    const TOKENS: &[&str] = &[
        "hello",
        "world",
        "growth",
        "paid",
        "中文",
        "字幕",
        "翻译",
        "对齐",
        "a&b",
        "x<y",
        "z>w",
        "\"quo\"",
        "混排 mix",
        "９０天",
        "emoji👍",
        "tail,",
    ];

    fn random_text(rng: &mut Lcg, count: usize) -> String {
        (0..count.max(1))
            .map(|_| *rng.pick(TOKENS))
            .collect::<Vec<_>>()
            .join(" ")
    }

    #[test]
    fn property_render_parse_roundtrip_is_identity_modulo_normalization() {
        let mut rng = Lcg::new(0x5EED_1234_ABCD_0001);
        for _ in 0..200 {
            let sentence_count = 1 + rng.below(4);
            let mut sentences = Vec::new();
            let mut fakes = Vec::new();
            for index in 0..sentence_count {
                let id = format!("s-g{index}.0");
                let piece_count = 1 + rng.below(4);
                let mut sources = Vec::new();
                let mut targets = Vec::new();
                for _ in 0..piece_count {
                    let source_len = 1 + rng.below(3);
                    sources.push(random_text(&mut rng, source_len));
                    let target_len = 1 + rng.below(3);
                    targets.push(random_text(&mut rng, target_len));
                }
                let source = sources.join(" ");
                let translation = targets.join("");
                let mut fake = FakeGroup::new(
                    &id,
                    &sources
                        .iter()
                        .zip(targets.iter())
                        .map(|(a, b)| (a.as_str(), b.as_str()))
                        .collect::<Vec<_>>(),
                );
                fake.reordered = rng.below(4) == 0;
                fake.crossing = !fake.reordered && rng.below(4) == 0;
                fake.unsplittable = piece_count == 1 && rng.below(3) == 0;
                fake.classed = rng.below(2) == 0;
                fakes.push((fake, sources, targets));
                sentences.push(sentence(&id, &source, &translation));
            }
            let input = AlignTableInput::new("zh", sentences);
            let output = fake_table(
                &fakes
                    .iter()
                    .map(|(fake, sources, targets)| FakeGroup {
                        sid: fake.sid.clone(),
                        rows: sources
                            .iter()
                            .cloned()
                            .zip(targets.iter().cloned())
                            .collect(),
                        reordered: fake.reordered,
                        crossing: fake.crossing,
                        unsplittable: fake.unsplittable,
                        rowspan: None,
                        classed: fake.classed,
                    })
                    .collect::<Vec<_>>(),
            );
            let parsed = parse_align_table(&input, None, &output);
            assert_eq!(parsed.groups.len(), fakes.len());
            for (group, (fake, sources, targets)) in parsed.groups.iter().zip(fakes.iter()) {
                assert_eq!(group.id, fake.sid);
                assert_eq!(group.reordered, fake.reordered);
                assert_eq!(group.crossing, fake.crossing);
                assert_eq!(group.unsplittable, fake.unsplittable);
                assert_eq!(group.rows.len(), sources.len());
                for (row, (source, target)) in group.rows.iter().zip(sources.iter().zip(targets)) {
                    assert_eq!(row.source, expect_cell(source));
                    assert_eq!(row.target, expect_cell(target));
                }
            }
            // The structural-layer ledger must be clean: content problems (over hard, seams) are outside the scope of these assertions.
            for code in [
                ProblemCode::DocumentTruncated,
                ProblemCode::DocumentWrapped,
                ProblemCode::DocumentOversize,
                ProblemCode::MissingId,
                ProblemCode::DuplicateId,
                ProblemCode::UnknownId,
                ProblemCode::EmptyTranslation,
                ProblemCode::SourceDrift,
                ProblemCode::AlignContentDrift,
            ] {
                assert!(
                    !parsed.diagnostics.has_code(code),
                    "unexpected {code} in {:?}",
                    parsed.diagnostics.problems
                );
            }

            // The second leg: go through the real render_align_table. The leg above deliberately uses the test-side "model answer" renderer, to avoid merely confirming its own output. Only property tests cover the renderer's escape_text / escape_attr. An unsplit whole sentence is itself a legal answer: one sentence per piece, with the source and translation written back as they are.
            let rendered = render_align_table(&input);
            let direct = parse_align_table(&input, Some(&rendered), &rendered);
            assert_eq!(direct.groups.len(), input.sentences.len());
            for (group, expected) in direct.groups.iter().zip(input.sentences.iter()) {
                assert_eq!(group.id, expected.id);
                assert!(!group.reordered);
                assert!(!group.crossing);
                assert_eq!(group.rows.len(), 1);
                assert_eq!(group.rows[0].source, expect_cell(&expected.source));
                assert_eq!(group.rows[0].target, expect_cell(&expected.translation));
            }
            for code in [
                ProblemCode::DocumentTruncated,
                ProblemCode::DocumentWrapped,
                ProblemCode::DocumentOversize,
                ProblemCode::MissingId,
                ProblemCode::DuplicateId,
                ProblemCode::UnknownId,
                ProblemCode::EmptyTranslation,
                ProblemCode::SourceDrift,
                ProblemCode::AlignContentDrift,
            ] {
                assert!(
                    !direct.diagnostics.has_code(code),
                    "unexpected {code} on self-roundtrip in {:?}",
                    direct.diagnostics.problems
                );
            }
            // A self-loop must not drop nodes or attributes: the renderer may only produce tags and attributes that the parser accepts.
            for warning in &direct.diagnostics.warnings {
                assert!(
                    warning.code != WarningCode::NodeDropped
                        && warning.code != WarningCode::AttributeDropped,
                    "render emitted something the parser strips: {warning:?}"
                );
            }
        }
    }

    #[test]
    fn property_parse_never_panics_on_garbage() {
        const CHUNKS: &[&str] = &[
            "<", ">", "&", "\"", "'", "/", "=", "table", "tbody", "tr", "td", "th", "data-sid",
            "s-1", "rowspan", "class", "ctx", "甲", "a", " ", "\n", "\t", "\u{0000}", "\u{202E}",
            "```", "<!--", "-->", "\u{FEFF}", "<script>", "</table>", "&amp;", "&#x41;",
        ];
        let input = AlignTableInput::new(
            "zh",
            vec![sentence("s-1", "a b", "甲乙"), sentence("s-2", "c", "丙")],
        );
        let mut rng = Lcg::new(0x0BAD_C0DE_0000_0007);
        for _ in 0..300 {
            let length = rng.below(40);
            let junk: String = (0..length).map(|_| *rng.pick(CHUNKS)).collect();
            let first = parse_align_table(&input, None, &junk);
            let second = parse_align_table(&input, None, &junk);
            // A pure function: parsing the same input twice must give field-by-field equal results.
            assert_eq!(first, second);
        }
    }

    #[test]
    fn render_parse_input_render_is_byte_identical() {
        // `parse_align_table_input` must be the strict inverse of `render_align_table`. Submit-time lint only gets the persisted payload HTML. If recovery lacks a field, it silently degrades into "payload unreadable ⇒ do not block", which amounts to a second set of criteria (§2). Any attribute newly added on the render side must make this assertion fail first.
        let input = AlignTableInput {
            lang: "zh".to_owned(),
            params: TransParams {
                fit: 15,
                soft: 13,
                hard: 19,
            },
            source_lang: "en".to_owned(),
            context_before: vec![AlignContextRow::new("Before it.", "前一句。")],
            sentences: vec![
                AlignSentenceInput {
                    id: "s-g1.0".to_owned(),
                    source: "alpha bravo ⏸ charlie delta".to_owned(),
                    translation: "第一段译文需要自然对应，第二段负责收尾。".to_owned(),
                    max_lines: 2,
                    suggested_pieces: (2, 3),
                    unsplittable: false,
                    frozen_target: vec![
                        "第一段译文需要自然对应，".to_owned(),
                        "第二段负责收尾。".to_owned(),
                    ],
                    no_rewrite: false,
                },
                AlignSentenceInput {
                    id: "s-g2.0".to_owned(),
                    source: "echo foxtrot".to_owned(),
                    translation: "回声与狐步。".to_owned(),
                    max_lines: 1,
                    suggested_pieces: (2, 2),
                    unsplittable: true,
                    frozen_target: Vec::new(),
                    no_rewrite: false,
                },
            ],
            context_after: vec![AlignContextRow::new("After it.", "后一句。")],
        };
        let rendered = render_align_table(&input);
        let parsed = parse_align_table_input(&rendered).expect("payload is an align table");
        assert_eq!(parsed, input);
        assert_eq!(render_align_table(&parsed), rendered);
        // A payload that is not an align table returns None (the caller degrades to "do not block" accordingly).
        assert!(parse_align_table_input("<article><p id=\"s-1\">x</p></article>").is_none());
    }
}
