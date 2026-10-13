//! The txt carrier codec for the polish stage (§6).
//!
//! This module handles only the "carrier": it splits the word stream into pages and renders them as plain text with sentinel fences and soft markers,
//! then parses the model's returned text back into a paragraph sequence and diagnostics. It does not do word binding / rebinding / similarity matching (that is the rebind job of M2), and it writes no truth.
//!
//! Reuse relationships (do not invent new thresholds in this file):
//!
//! - ⏸ / ⏹ and the 0.6 / 1.0 / 1.8 second tiers come from [`crate::engines::markers`];
//! - breakpoint scoring comes from [`crate::paging::breakpoint_rank`] (speaker change 3 > pause 2 > sentence end 1 > 0);
//! - the "word" counting basis for page budgets comes from [`crate::atomize::word_count`].
//!
//! Zero I/O, zero clock, zero randomness: all pure functions; the same input always yields the same output.
//!
//! # Input convention
//!
//! The `words` this module receives must already be the **projection that participates in this AI run**: hidden (trimmed-away) words must not appear in the slices. Page-internal indices are always indices into that slice; absolute timestamps do not enter the payload.

use std::ops::Range;

use crate::atomize::{is_cjk_text, normalize_chars, sentence_end, word_count};
use crate::doc::Word;
use crate::engines::markers;
use crate::paging::breakpoint_rank;
use crate::speaker::{SpeakerLabels, speaker_turns};

use super::common::{
    Diagnostics, Problem, ProblemCode, ProblemScope, Warning, WarningCode, guard_output_size,
    normalize_llm_output, sanitize_inline_text,
};

/// Read-only leading-context fence line (exact whole-line match).
pub const FENCE_CONTEXT_BEFORE: &str = "<<<CONTEXT-BEFORE 只读，勿修改>>>";
/// Start fence line of the editable core region.
pub const FENCE_EDIT_BEGIN: &str = "<<<EDIT-BEGIN>>>";
/// End fence line of the editable core region.
pub const FENCE_EDIT_END: &str = "<<<EDIT-END>>>";
/// Read-only trailing-context fence line (also the termination marker for the whole page).
pub const FENCE_CONTEXT_AFTER: &str = "<<<CONTEXT-AFTER 只读，勿修改>>>";

/// Only a read-only region whose fingerprint similarity falls below this value triggers [`ProblemCode::SourceDrift`] and rejects the page.
///
/// Basis: `atomize::similarity` (normalized character edit distance, with ⏸/⏹ and structure lines stripped).
/// Incidental surface fixes (wrong words, repeated words — measured on p850 material: a single ~70-word region with 3 edits) fall at 0.97+;
/// truncation, whole sentences leaking across the fence, or off-topic answers drop below 0.8. The threshold sits between the two, leaning conservative.
const READONLY_DRIFT_MIN_SIMILARITY: f64 = 0.85;
/// Hard-cut marker line: when a page seam falls mid-sentence, it tells the model that "this is not a paragraph boundary".
pub const MARKER_HARD_CUT: &str = "<<<HARD-CUT>>>";

/// Word-count cap for a single paragraph (Latin, [`word_count`] basis: each Latin word counts as one).
///
/// Spoken paragraphs are usually 40–150 words; when segmentation degenerates (the model inserts no blank lines at all, so the whole page becomes one block), it grows to the page-budget scale (default core region 2200 words). The gap between realistic upper bounds and degenerate values is an order of magnitude; the threshold of 300 only catches degeneration and does not penalize dense monologues.
pub const MAX_PARAGRAPH_WORDS_LATIN: usize = 300;
/// Word-count cap for a single paragraph (CJK, [`word_count`] basis: each CJK character counts as one).
///
/// Information density differs (1 Latin word ≈ 1.5–2 CJK characters), so on the same word-count scale CJK paragraphs are naturally longer; the threshold is relaxed accordingly.
pub const MAX_PARAGRAPH_WORDS_CJK: usize = 500;

/// The per-paragraph word cap is chosen by the paragraph text's language (any CJK character selects the CJK tier, the lenient direction).
pub fn paragraph_word_limit(text: &str) -> usize {
    if is_cjk_text(text) {
        MAX_PARAGRAPH_WORDS_CJK
    } else {
        MAX_PARAGRAPH_WORDS_LATIN
    }
}

/// Sentinel prefix: body lines starting with it must be neutralized to avoid forging fences.
const SENTINEL_PREFIX: &str = "<<<";
/// Lower bound ratio of the breakpoint search window (aligned with the "last 20%" convention of [`crate::paging`]).
const WINDOW_FLOOR_RATIO: f64 = 0.8;

/// Polish page budget (§6.2 / §12, all in words).
#[derive(Debug, Clone, PartialEq)]
pub struct PolishBudget {
    /// Target word count of the core region.
    pub core_words: usize,
    /// Maximum word count of one-sided read-only context.
    pub context_words: usize,
    /// Maximum sentence count of one-sided read-only context.
    pub context_sentences: usize,
    /// Allowed overflow ratio for reaching the next rank≥1 breakpoint.
    pub overflow_ratio: f64,
}

impl Default for PolishBudget {
    /// §6.2 defaults: core region 2200 words, context min(200 words, 3 sentences), overflow 15%.
    fn default() -> Self {
        Self {
            core_words: 2200,
            context_words: 200,
            context_sentences: 3,
            overflow_ratio: 0.15,
        }
    }
}

/// Split plan for one page. All ranges are half-open index ranges `[start, end)` on the `words` slice.
///
/// Page boundaries are not written to disk: this structure is deterministically re-derived from the word stream by [`plan_polish_pages`].
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PolishPagePlan {
    /// Page id (starting from `p001`).
    pub id: String,
    /// Read-only leading-context range (empty range for the first page).
    pub before: Range<usize>,
    /// Editable core range.
    pub core: Range<usize>,
    /// Read-only trailing-context range (empty range for the last page).
    pub after: Range<usize>,
    /// Whether this page begins with a hard cut (the previous page was split mid-sentence).
    pub hard_cut_start: bool,
    /// Whether this page ends with a hard cut.
    pub hard_cut_end: bool,
    /// Existing manual paragraph pins (absolute indices into `words`, meaning that word must start a new paragraph).
    ///
    /// A pin equal to `core.start` holds naturally (that word already starts the first paragraph), so it produces no extra segmentation; pins outside the core region are ignored.
    pub para_starts: Vec<usize>,
}

/// Render result: the text plus warnings raised during rendering (e.g. sentinel neutralization).
///
/// Carrier rendering needs to return [`WarningCode::SentinelNeutralized`], so it returns a struct rather than a bare `String`.
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct PolishRendered {
    /// Full page text (ending with a newline).
    pub text: String,
    /// Warnings raised during rendering.
    pub warnings: Vec<Warning>,
}

/// Parse result.
#[derive(Debug, Clone, PartialEq, Default)]
pub struct PolishParsed {
    /// Paragraphs parsed from the core region (markers stripped, CJK spaces folded).
    pub paragraphs: Vec<String>,
    /// ⏹ hard guarantee: these `words` absolute indices must be paragraph starts.
    ///
    /// Regardless of what the model returns, this field is given unconditionally from the original speaker-change positions;
    /// only when the text is verbatim (the model did not alter the core region's text) does parsing actually split [`PolishParsed::paragraphs`] on them and record [`WarningCode::BoundaryForced`].
    /// Placement in the non-verbatim case is handled by rebind in M2.
    pub forced_boundaries: Vec<usize>,
    /// Explicit page-seam signal: the model left a blank line after `EDIT-BEGIN` and before the first sentence, meaning the core region's first paragraph does **not** continue the last paragraph of the read-only leading context (it starts a new paragraph). No blank line only means "no stance taken" — the engine hands it to the seam-repair wave to decide, and it must not be inferred as "continues".
    pub starts_new_paragraph: bool,
    /// Protocol problems and warnings.
    pub diagnostics: Diagnostics,
}

/// Splits the word stream into polish pages per §6.2.
///
/// The page count is first fixed as `ceil(total core words / (core_words + slack))` (see [`crate::paging::page_count_for_total`]). Each page's target is "remaining words / remaining pages": greedy filling would leave a short tail page at the end, so balancing keeps the pages' word counts comparable. The remaining page count is backstopped by `ceil(remaining words / (core_words + slack))`, so that when earlier pages fall far short, adding a page is preferred over overloading the last page.
///
/// **The paging unit switches with speaker information**:
///
/// - **With speakers** (at least two distinct `sp` appear in the word stream): the unit is a **sequence of turns**. A page is a union of consecutive whole turns; the page boundary is a turn start within the +15% overflow cap whose word cost is closest to the page target (ties go to the later one). Short turns group naturally; only long turns that individually exceed the budget are split internally, and in that case **sentence boundaries take priority** (sentence-final punctuation, see [`sentence_end`]). Only when the window has no sentence boundary does it fall back to the generic scoring below. Page seams therefore fall only on turn boundaries or on sentence boundaries inside long turns, and never split the middle of someone's speech. When the turn boundary closest to the page target still cannot reach the window's lower bound (the next turn alone exceeds the budget), no page is opened for a single “um”: instead the split is made at a sentence boundary inside the long turn, so this page = the short turns + the head of the long turn. Only if the long turn has no breakpoints at all does it fall back to that shorter whole-turn page.
/// - **Without speakers** (a single `sp` throughout): the unit is the word stream plus breakpoint scoring. Core words accumulate from 20% before the page target, and breakpoints are scored jointly as "word position + rank×(page target/20)" ([`breakpoint_rank`] is worth only about 5% of the page target in advance per rank step; ties go to the later one). But as inside long turns, **sentence boundaries take priority**: if the window contains any sentence-final punctuation, the highest-scoring sentence boundary is taken; only without one does it fall back to pause breakpoints.
///
/// When neither path finds a breakpoint in the window, it first takes the **first** sentence boundary in the +15% overflow zone, then the first breakpoint with rank ≥1; only if that also fails does it hard-cut and set `hard_cut_*`. Context is taken from complete sentences in the adjacent pages' core regions, at most `context_sentences` sentences or `context_words` words, and at least 1 sentence.
///
/// The `words` passed in must be a projection with hidden words already excluded (see module docs).
pub fn plan_polish_pages(words: &[Word], budget: &PolishBudget) -> Vec<PolishPagePlan> {
    if words.is_empty() {
        return Vec::new();
    }
    let counts: Vec<usize> = words.iter().map(|w| word_count(&w.text).max(1)).collect();
    let core_budget = budget.core_words.max(1);
    let total = words.len();
    let total_cost: usize = counts.iter().sum();
    let target_pages = crate::paging::page_count_for_total(total_cost, core_budget);
    // Turn sequence (without speaker information there is only one turn, which takes the original word-stream path).
    let turn_starts: Vec<usize> = speaker_turns(words).into_iter().map(|t| t.start).collect();
    let turn_aware = turn_starts.len() > 1;
    let prefix_cost = crate::paging::cost_prefix(&counts);

    let mut cores: Vec<Range<usize>> = Vec::new();
    // Whether each page's tail is a hard cut.
    let mut hard_cuts: Vec<bool> = Vec::new();
    let mut start = 0usize;
    let mut remaining_cost = total_cost;
    let page_cap = core_budget + crate::paging::page_slack(core_budget);
    while start < total {
        let cap_pages = remaining_cost.div_ceil(page_cap).max(1);
        let pages_left = target_pages
            .saturating_sub(cores.len())
            .max(cap_pages)
            .max(1);
        let page_budget = remaining_cost.div_ceil(pages_left).max(1);
        let floor = ((page_budget as f64) * WINDOW_FLOOR_RATIO) as usize;
        let overflow_budget =
            ((page_budget as f64) * (1.0 + budget.overflow_ratio.max(0.0))) as usize;
        let (budget_end, overflow_end) = span_ends(&counts, start, page_budget, overflow_budget);
        if overflow_end >= total {
            cores.push(start..total);
            hard_cuts.push(false);
            break;
        }
        let rank_bonus = (page_budget / 20).max(1) as i64;
        // With speakers, find page boundaries by whole turns first; on a hit the whole page is made of complete turns.
        let turn_cut = turn_aware
            .then(|| {
                crate::paging::turn_boundary_cut(
                    &turn_starts,
                    &prefix_cost,
                    start,
                    overflow_end,
                    page_budget,
                )
            })
            .flatten();
        // The turn boundary closest to the page target still cannot reach the window's lower bound ⇒ the next turn alone exceeds the budget (a long monologue).
        // Rather than opening a page for a single “um”, split at a sentence boundary inside the long turn,
        // so that this page = the short turns + the head of the long turn.
        let mut cut = turn_cut
            .filter(|boundary| prefix_cost[*boundary].saturating_sub(prefix_cost[start]) >= floor);
        if cut.is_none() {
            // Inside a long turn (or a word stream without speakers): joint scoring within the window.
            let mut cut_score = 0i64;
            // Sentence boundaries take priority (both paths consistent): if the window contains any sentence-final punctuation, take the highest-scoring sentence boundary;
            // only if there is none does it fall back to generic scoring (pauses). Otherwise a 0.6s hesitation pause could outscore every sentence end in the window — in a measured single-speaker long talk, 30 of 47 page seams fell mid-sentence (“我们大 ‖ 脑的皮层”), leaving half a sentence on each side of the seam, which then got treated as paragraph boundaries. With sentence-boundary priority, cuts mid-sentence happen only in stretches with no punctuation at all.
            let mut clause_cut: Option<(usize, i64)> = None;
            let mut used = 0usize;
            for index in start..budget_end {
                used += counts[index];
                if index + 1 >= total {
                    break;
                }
                if used >= floor {
                    let rank = breakpoint_rank(&words[index], &words[index + 1]);
                    // Score = word position + rank bonus (same method as paginate_word_ranges);
                    // a higher-rank breakpoint trades for at most about 5% of the page target in advance per rank step; ties go to the later one.
                    if rank > 0 {
                        let score = used as i64 + i64::from(rank) * rank_bonus;
                        if cut.is_none() || score >= cut_score {
                            cut = Some(index + 1);
                            cut_score = score;
                        }
                        if sentence_end(&words[index].text)
                            && clause_cut.is_none_or(|(_, best)| score >= best)
                        {
                            clause_cut = Some((index + 1, score));
                        }
                    }
                }
            }
            if let Some((sentence_cut, _)) = clause_cut {
                cut = Some(sentence_cut);
            }
            if cut.is_none() {
                // The overflow zone also gives sentence boundaries priority (under turn awareness this stretch is certainly still within one turn: turn boundaries were already consumed by turn_boundary_cut).
                for index in budget_end..overflow_end {
                    if index + 1 >= total {
                        break;
                    }
                    if sentence_end(&words[index].text) {
                        cut = Some(index + 1);
                        break;
                    }
                }
            }
            if cut.is_none() {
                // If the window plus overflow zone has not a single sentence-final punctuation mark: fall back to generic breakpoints (pauses); only if none is found, hard-cut.
                for index in budget_end..overflow_end {
                    if index + 1 >= total {
                        break;
                    }
                    if breakpoint_rank(&words[index], &words[index + 1]) > 0 {
                        cut = Some(index + 1);
                        break;
                    }
                }
            }
            // Inside a long turn with no breakpoints at all: prefer a shorter-than-ideal whole-turn page over a hard cut.
            if cut.is_none() {
                cut = turn_cut;
            }
        }
        let hard = cut.is_none();
        // Invariant: every page consumes at least one word, otherwise this loops forever.
        let cut = cut.unwrap_or(budget_end).clamp(start + 1, total);
        cores.push(start..cut);
        hard_cuts.push(hard);
        remaining_cost = remaining_cost.saturating_sub(counts[start..cut].iter().sum::<usize>());
        start = cut;
    }

    let mut plans = Vec::with_capacity(cores.len());
    for (index, core) in cores.iter().enumerate() {
        let before = if index > 0 {
            context_before(words, &counts, core.start, cores[index - 1].start, budget)
        } else {
            core.start..core.start
        };
        let after = if index + 1 < cores.len() {
            context_after(words, &counts, core.end, cores[index + 1].end, budget)
        } else {
            core.end..core.end
        };
        plans.push(PolishPagePlan {
            id: format!("p{:03}", index + 1),
            before,
            core: core.clone(),
            after,
            hard_cut_start: index > 0 && hard_cuts[index - 1],
            hard_cut_end: hard_cuts[index],
            para_starts: Vec::new(),
        });
    }
    plans
}

/// Computes the end indices (half-open) that fully consume the core budget and the overflow budget, respectively, starting from `start`.
fn span_ends(
    counts: &[usize],
    start: usize,
    core_budget: usize,
    overflow_budget: usize,
) -> (usize, usize) {
    let mut used = 0usize;
    let mut budget_end = start;
    let mut overflow_end = start;
    for (index, count) in counts.iter().enumerate().skip(start) {
        used += count;
        if used <= core_budget {
            budget_end = index + 1;
        }
        if used <= overflow_budget {
            overflow_end = index + 1;
        } else {
            break;
        }
    }
    let budget_end = budget_end.max(start + 1).min(counts.len());
    (budget_end, overflow_end.max(budget_end))
}

/// Collects complete sentences backward as read-only leading context, with the lower bound clamped to the start of the previous page's core region.
fn context_before(
    words: &[Word],
    counts: &[usize],
    core_start: usize,
    lower: usize,
    budget: &PolishBudget,
) -> Range<usize> {
    let mut sentences = 0usize;
    let mut used = 0usize;
    let mut best = core_start;
    let mut index = core_start;
    while index > lower {
        index -= 1;
        used += counts[index];
        let starts_sentence = index == lower || sentence_end(&words[index - 1].text);
        if starts_sentence {
            sentences += 1;
            best = index;
            if sentences >= budget.context_sentences || used >= budget.context_words {
                break;
            }
        } else if sentences >= 1 && used >= budget.context_words {
            break;
        }
    }
    best..core_start
}

/// Collects complete sentences forward as read-only trailing context, with the upper bound clamped to the end of the next page's core region.
fn context_after(
    words: &[Word],
    counts: &[usize],
    core_end: usize,
    upper: usize,
    budget: &PolishBudget,
) -> Range<usize> {
    let mut sentences = 0usize;
    let mut used = 0usize;
    let mut best = core_end;
    let mut index = core_end;
    while index < upper {
        used += counts[index];
        let ends_sentence = index + 1 == upper || sentence_end(&words[index].text);
        index += 1;
        if ends_sentence {
            sentences += 1;
            best = index;
            if sentences >= budget.context_sentences || used >= budget.context_words {
                break;
            }
        } else if sentences >= 1 && used >= budget.context_words {
            break;
        }
    }
    core_end..best
}

/// Renders one polish txt page (§6.2 fence layout).
///
/// Layout:
///
/// ```text
/// <<<CONTEXT-BEFORE 只读，勿修改>>>
/// …tail of previous page…
/// <<<EDIT-BEGIN>>>
/// …core region of this page, one blank line between paragraphs…
/// <<<EDIT-END>>>
/// …head of next page…
/// <<<CONTEXT-AFTER 只读，勿修改>>>
/// ```
///
/// `<<<HARD-CUT>>>` falls **outside** the editing fences (before `EDIT-BEGIN` / after `EDIT-END`), guaranteeing the core region is pure body text. If a body line starts with `<<<`, a space is prepended to the line to neutralize it and [`WarningCode::SentinelNeutralized`] is recorded.
pub fn render_polish_page(words: &[Word], plan: &PolishPagePlan) -> PolishRendered {
    let mut warnings = Vec::new();
    let before = clamp_range(&plan.before, words.len());
    let core = clamp_range(&plan.core, words.len());
    let after = clamp_range(&plan.after, words.len());
    // Labels are derived from the **whole projection**, so the same speaker has the same label on every page.
    let labels = SpeakerLabels::from_words(words);
    let labels = (!labels.is_empty()).then_some(labels);
    let mut lines: Vec<String> = Vec::new();

    lines.push(FENCE_CONTEXT_BEFORE.to_owned());
    push_blocks(
        &mut lines,
        render_region(words, &before, &[], labels.as_ref()),
        &plan.id,
        &mut warnings,
    );
    if plan.hard_cut_start {
        lines.push(MARKER_HARD_CUT.to_owned());
    }
    lines.push(FENCE_EDIT_BEGIN.to_owned());
    push_blocks(
        &mut lines,
        render_region(words, &core, &plan.para_starts, labels.as_ref()),
        &plan.id,
        &mut warnings,
    );
    lines.push(FENCE_EDIT_END.to_owned());
    if plan.hard_cut_end {
        lines.push(MARKER_HARD_CUT.to_owned());
    }
    push_blocks(
        &mut lines,
        render_region(words, &after, &[], labels.as_ref()),
        &plan.id,
        &mut warnings,
    );
    lines.push(FENCE_CONTEXT_AFTER.to_owned());

    let mut text = lines.join("\n");
    text.push('\n');
    PolishRendered { text, warnings }
}

/// All checks that can be computed from the "payload string + answer string" alone (§6.4 tier 1).
///
/// **Why validation is split along this line**: the agent-side mirror lint of `task submit` only has access to the two texts on disk, **without `words`** (the word stream does not go into the agent task directory; the task directory holds only the rendered txt). So the checks are divided by whether they need ground truth:
///
/// - This function (strings are enough): the output size guard, sentinel fence integrity/order/duplication, stray material outside the fences, read-only region drift (compares the input's **own** read-only regions against the output, no word stream needed), blank-line semantics and folding of three or more consecutive newlines, leftover code blocks, and an empty core region;
/// - Engine-side validation (needs `words`): whole-page atom-LCS ratio, per-sentence similarity gate, per-sentence source span cap (characters / seconds).
///
/// [`parse_polish_page`] **calls this function internally**, and `engines::polish::lint_agent_answer_file` also calls it directly, so there is only one implementation of the protocol validation.
///
/// The scope is always [`ProblemScope::Document`] (this function does not know the page id); [`parse_polish_page`] rewrites them to page scope.
pub fn lint_polish_page(input: &str, output: &str) -> Diagnostics {
    lint_page(input, output).diagnostics
}

/// The internal form of [`lint_polish_page`]: diagnostics plus the core region's already-split paragraphs.
struct PolishLint {
    diagnostics: Diagnostics,
    paragraphs: Vec<String>,
    /// The core region starts with a blank line (the explicit "start a new paragraph" signal at the page seam).
    starts_new_paragraph: bool,
    /// Whether the four fences were located successfully (on failure `paragraphs` is necessarily empty).
    fenced: bool,
}

fn lint_page(input: &str, output: &str) -> PolishLint {
    let mut diagnostics = Diagnostics::new();
    let introduced_controls = output
        .chars()
        .filter(|character| {
            character.is_control()
                && !matches!(character, '\n' | '\r' | '\t')
                && output.matches(*character).count() > input.matches(*character).count()
        })
        .count();
    if introduced_controls > 0 {
        diagnostics.push_problem(Problem::document(
            ProblemCode::SourceDrift,
            "the answer introduced illegal control characters (possibly UTF-8 mojibake)",
        ));
    }
    let normalized = normalize_llm_output(output);
    for warning in normalized.warnings() {
        diagnostics.push_warning(Warning {
            code: warning.code,
            scope: ProblemScope::Document,
            detail: warning.detail,
        });
    }
    if let Some(problem) = guard_output_size(input, &normalized.text) {
        diagnostics.push_problem(Problem::document(problem.code, problem.detail));
    }

    // The payload-side fences are always ones we rendered ourselves, so exact per-character location is enough.
    let input_lines: Vec<&str> = input.lines().collect();
    let input_anchors = locate_fences(&input_lines);
    let expected_before = input_anchors
        .map(|[in_before, in_begin, _, _]| region_signature(&input_lines[in_before + 1..in_begin]));

    let lines: Vec<&str> = normalized.text.lines().collect();
    let recovered = recover_fences(&lines, expected_before.as_deref());
    let Some((regions, recoveries)) = recovered else {
        diagnostics.push_problem(Problem::document(
            ProblemCode::DocumentTruncated,
            "both edit fences are missing and the core-region boundary cannot be inferred from the read-only fences",
        ));
        return PolishLint {
            diagnostics,
            paragraphs: Vec::new(),
            starts_new_paragraph: false,
            fenced: false,
        };
    };
    for note in recoveries {
        diagnostics.push_warning(Warning {
            code: WarningCode::FenceRecovered,
            scope: ProblemScope::Document,
            detail: note,
        });
    }

    let stray_outside = lines[..regions.head].iter().any(|l| !l.trim().is_empty())
        || lines[regions.tail..].iter().any(|l| !l.trim().is_empty());
    if stray_outside {
        diagnostics.push_problem(Problem::document(
            ProblemCode::DocumentWrapped,
            "there is non-body content outside the fences",
        ));
        diagnostics.push_warning(Warning {
            code: WarningCode::ContentIgnored,
            scope: ProblemScope::Document,
            detail: "ignored content outside the fences".to_owned(),
        });
    }

    // Read-only region drift is always downgraded to advisory (retry strategy redesign §2.2).
    //
    // Parsing takes only the core region; the read-only region in the output is never written back to truth, and the core region is separately guarded by the word-stream truth gates (mapping coverage, similarity, span). The old implementation rejected the whole page when similarity fell below [`READONLY_DRIFT_MIN_SIMILARITY`]. Measurement showed that this rule rejected only two cases, both of which left this page's body unaffected: the model incidentally fixed ASR wrong words in the read-only region, and the read-only region was truncated. Both reproduced deterministically at temperature 0, so after three retries all failed, the whole page fell back. Now only a Warning is recorded; the threshold is used only to distinguish wording.
    if let Some([_, _, in_end, in_after]) = input_anchors {
        let zones = [
            (
                expected_before.clone().unwrap_or_default(),
                region_signature(&lines[regions.before.clone()]),
                "read-only context-before zone (CONTEXT-BEFORE)",
            ),
            (
                region_signature(&input_lines[in_end + 1..in_after]),
                region_signature(&lines[regions.after.clone()]),
                "read-only context-after zone (CONTEXT-AFTER)",
            ),
        ];
        for (expected, actual, zone) in zones {
            if expected == actual {
                continue;
            }
            let score = crate::atomize::similarity(&expected, &actual);
            let detail = if score < READONLY_DRIFT_MIN_SIMILARITY {
                format!("{zone} was rewritten or truncated; ignored (read-only zones are never written back as truth)")
            } else {
                format!("{zone} has surface-level rewrites; ignored")
            };
            diagnostics.push_warning(Warning {
                code: WarningCode::ContentIgnored,
                scope: ProblemScope::Document,
                detail,
            });
        }
    }

    let (paragraphs, notes) = parse_core_blocks(&lines[regions.core.clone()]);
    if notes.blank_runs {
        diagnostics.push_warning(Warning {
            code: WarningCode::BlankLinesCollapsed,
            scope: ProblemScope::Document,
            detail: "consecutive blank lines were collapsed into a single paragraph boundary".to_owned(),
        });
    }
    if notes.marker_residue {
        diagnostics.push_warning(Warning {
            code: WarningCode::MarkerResidue,
            scope: ProblemScope::Document,
            detail: "stripped leftover ⏸/⏹ soft markers from the core region".to_owned(),
        });
    }
    if notes.structural_ignored {
        diagnostics.push_warning(Warning {
            code: WarningCode::ContentIgnored,
            scope: ProblemScope::Document,
            detail: "ignored structural marker lines inside the core region".to_owned(),
        });
    }
    if notes.punctuation_normalized {
        diagnostics.push_warning(Warning {
            code: WarningCode::PunctuationNormalized,
            scope: ProblemScope::Document,
            detail: "conflicting adjacent punctuation in the core region was normalized in code (kept the one that expresses the boundary)".to_owned(),
        });
    }
    if notes.code_fence {
        diagnostics.push_problem(Problem::document(
            ProblemCode::DocumentWrapped,
            "a code-block wrapper remains inside the core region",
        ));
    }
    let input_core_empty = input_anchors
        .map(|[_, in_begin, in_end, _]| {
            parse_core_blocks(&input_lines[in_begin + 1..in_end])
                .0
                .is_empty()
        })
        .unwrap_or(true);
    if paragraphs.is_empty() && !input_core_empty {
        diagnostics.push_problem(Problem::document(
            ProblemCode::DocumentTruncated,
            "the core region is empty",
        ));
    }
    // Surface-level blemishes do **not** reject the page (retry strategy redesign §2.2): conflicting punctuation is already normalized in code in [`flush_block`]; glued Latin strings and dangling false sentence endings only record [`WarningCode::SurfaceArtifact`], and once the engine maps them into sentences it sends them to the sentence-level follow-up queue of `polish-retry`. The old implementation filed these three under `document-oversize`, so one sentence's surface blemish rejected the whole page and re-rolled all sentences (measured: a considerable share of polish retries).
    for (index, paragraph) in paragraphs.iter().enumerate() {
        // Chinese ASR's English code-switching occasionally gets glued into a single atom in full. Spaces do not take part in the atom-LCS fidelity signature, so the model can, and should, restore them.
        if crate::atomize::is_cjk_text(paragraph)
            && crate::seam::contains_likely_collapsed_latin_atom(paragraph, 20)
        {
            diagnostics.push_warning(Warning::paragraph(
                WarningCode::SurfaceArtifact,
                index,
                format!(
                    "corrected Chinese transcript still contains a likely run-together Latin phrase (20+ letters): {paragraph:?}; restore the spoken English word boundaries with spaces without translating or changing meaning"
                ),
            ));
        }
        if crate::seam::contains_dangling_sentence_end(paragraph) {
            diagnostics.push_warning(Warning::paragraph(
                WarningCode::SurfaceArtifact,
                index,
                format!(
                    "corrected text contains a sentence ending at a dangling connector/preposition: {paragraph:?}; remove that false sentence end and join the following clause into a complete thought"
                ),
            ));
        }
    }
    // Over-limit paragraph word counts (degenerate segmentation) are **not** blocked here: the polish body itself is valid, and a whole-page retry would only re-roll all sentences. The main page is accepted on the first round, and degenerate paragraphs are given targeted re-segmentation after the wave by the `segment-repair` carrier (see [`parse_segment_repair_page`]).

    PolishLint {
        diagnostics,
        paragraphs,
        starts_new_paragraph: notes.leading_blank,
        fenced: true,
    }
}

/// Parses the polish txt returned by the model (§6.3 / §6.4).
///
/// Order: all string-level checks of [`lint_polish_page`], then the ⏹ hard guarantee.
///
/// Newline semantics: a single newline is a soft newline (folded to a space, no boundary meaning); a blank line is a paragraph boundary; two or more consecutive blank lines are folded into one and record [`WarningCode::BlankLinesCollapsed`].
///
/// `words` and `plan` must be exactly the same as at render time (same projection, same plan): the verbatim judgment is derived directly from the word stream. `input` is the rendered text that was actually sent to the model.
pub fn parse_polish_page(
    words: &[Word],
    plan: &PolishPagePlan,
    input: &str,
    output: &str,
) -> PolishParsed {
    let forced = forced_boundaries(words, plan);
    let core = clamp_range(&plan.core, words.len());

    let lint = lint_page(input, output);
    let mut diagnostics = Diagnostics::new();
    for problem in lint.diagnostics.problems {
        diagnostics.push_problem(Problem {
            scope: rescope(problem.scope, plan),
            ..problem
        });
    }
    for warning in lint.diagnostics.warnings {
        diagnostics.push_warning(Warning {
            scope: rescope(warning.scope, plan),
            ..warning
        });
    }
    if !lint.fenced {
        return PolishParsed {
            paragraphs: Vec::new(),
            forced_boundaries: forced,
            starts_new_paragraph: false,
            diagnostics,
        };
    }
    let mut paragraphs = lint.paragraphs;

    // ⏹ hard guarantee: placed in situ only when verbatim (the non-verbatim case is handed to M2 rebind).
    let source_signature = words_signature(&words[core.clone()]);
    let actual_signature = normalize_chars(&paragraphs.join(" "));
    if !source_signature.is_empty() && source_signature == actual_signature {
        let targets: Vec<usize> = forced
            .iter()
            .filter(|index| **index > core.start)
            .map(|index| {
                words[core.start..*index]
                    .iter()
                    .map(|word| normalized_len(&word.text))
                    .sum()
            })
            .filter(|offset| *offset > 0)
            .collect();
        if !targets.is_empty() {
            paragraphs = apply_forced_boundaries(paragraphs, &targets, plan, &mut diagnostics);
        }
    }

    PolishParsed {
        paragraphs,
        forced_boundaries: forced,
        starts_new_paragraph: lint.starts_new_paragraph,
        diagnostics,
    }
}

/// The boundary table of the ⏹ hard guarantee: absolute word indices of speaker changes within the core region.
///
/// When the page seam is itself a speaker change, that boundary belongs to the **later page** (the paragraph id takes the first word), so `core.start` is also included; a hard-cut page seam continues a split sentence and is not included.
///
/// Exposed to the engine: the whole-page fallback path has no [`PolishParsed`] to take, but must still enforce the ⏹ hard guarantee.
pub fn forced_boundaries(words: &[Word], plan: &PolishPagePlan) -> Vec<usize> {
    let core = clamp_range(&plan.core, words.len());
    let mut boundaries = Vec::new();
    if core.is_empty() {
        return boundaries;
    }
    if core.start > 0 && !plan.hard_cut_start && words[core.start - 1].sp != words[core.start].sp {
        boundaries.push(core.start);
    }
    for index in core.start..core.end.saturating_sub(1) {
        if words[index].sp != words[index + 1].sp {
            boundaries.push(index + 1);
        }
    }
    boundaries
}

/// Splits paragraphs at normalized character offsets, recording [`WarningCode::BoundaryForced`].
fn apply_forced_boundaries(
    paragraphs: Vec<String>,
    targets: &[usize],
    plan: &PolishPagePlan,
    diagnostics: &mut Diagnostics,
) -> Vec<String> {
    let mut result: Vec<String> = Vec::new();
    let mut consumed = 0usize;
    for paragraph in paragraphs {
        let length = normalized_len(&paragraph);
        let mut rest = paragraph;
        let mut rest_start = consumed;
        for target in targets
            .iter()
            .copied()
            .filter(|t| *t > consumed && *t < consumed + length)
        {
            let Some(index) = split_index(&rest, target - rest_start) else {
                continue;
            };
            let left = rest[..index].trim_end().to_owned();
            let right = rest[index..].trim_start().to_owned();
            if left.is_empty() || right.is_empty() {
                continue;
            }
            diagnostics.push_warning(Warning {
                code: WarningCode::BoundaryForced,
                scope: ProblemScope::Paragraph {
                    index: result.len(),
                },
                detail: format!("forced paragraph boundary at ⏹ speaker change (page {})", plan.id),
            });
            result.push(left);
            rest = right;
            rest_start = target;
        }
        result.push(rest);
        consumed += length;
    }
    result
}

/// Finds the byte index of the first substantive character after `target` normalized characters have been consumed in `text`.
fn split_index(text: &str, target: usize) -> Option<usize> {
    let mut consumed = 0usize;
    for (index, ch) in text.char_indices() {
        let mut buffer = [0u8; 4];
        let width = normalized_len(ch.encode_utf8(&mut buffer));
        if consumed == target && width > 0 {
            return Some(index);
        }
        consumed += width;
    }
    None
}

/// Number of normalized characters ([`normalize_chars`] drops whitespace and punctuation).
fn normalized_len(text: &str) -> usize {
    normalize_chars(text).chars().count()
}

/// Observations gathered while splitting the core region into paragraphs.
#[derive(Debug, Default)]
struct CoreNotes {
    blank_runs: bool,
    marker_residue: bool,
    structural_ignored: bool,
    code_fence: bool,
    /// There is a blank line before the first line of body text (the explicit page-seam "start a new paragraph" signal).
    leading_blank: bool,
    /// Adjacent conflicting punctuation in some paragraphs was normalized in code (R2: code fixes first).
    punctuation_normalized: bool,
}

/// Splits core-region lines into paragraphs: blank lines start a new paragraph, single newlines fold to spaces.
///
/// Blank lines before the body produce no paragraph and only set [`CoreNotes::leading_blank`]; a single leading blank line does not count as "consecutive blank lines" (it is a signal the contract allows, so it should not record `BlankLinesCollapsed`).
fn parse_core_blocks(lines: &[&str]) -> (Vec<String>, CoreNotes) {
    let mut notes = CoreNotes::default();
    let mut blocks: Vec<String> = Vec::new();
    let mut current: Vec<&str> = Vec::new();
    let mut blank_run = 0usize;
    let mut seen_content = false;
    for line in lines {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            if !seen_content {
                notes.leading_blank = true;
                continue;
            }
            blank_run += 1;
            if blank_run >= 2 {
                notes.blank_runs = true;
            }
            flush_block(&mut current, &mut blocks, &mut notes.punctuation_normalized);
            continue;
        }
        blank_run = 0;
        seen_content = true;
        // Structure lines never enter the body: hard-cut markers, and **any** sentinel fence line. Fence recovery ([`recover_fences`]) may leave a misplaced or indented fence inside the core region, while body lines were already neutralized by a prepended space at render time, so this test does not falsely hit real content.
        if trimmed == MARKER_HARD_CUT || is_fence_line(line) {
            notes.structural_ignored = true;
            continue;
        }
        if trimmed.starts_with("```") || trimmed.starts_with("~~~") {
            notes.code_fence = true;
            continue;
        }
        if line.contains(markers::PAUSE_MARKER) || line.contains(markers::SPEAKER_MARKER) {
            notes.marker_residue = true;
        }
        current.push(line);
    }
    flush_block(&mut current, &mut blocks, &mut notes.punctuation_normalized);
    (blocks, notes)
}

/// Finalizes a paragraph: soft newlines folded to spaces, markers stripped, CJK spaces folded, conflicting punctuation normalized.
///
/// Conflicting adjacent punctuation (`。，` / `，。` / `，，` / `..`) is a surface blemish that code can resolve deterministically, so it is no longer fed back to the model to re-roll the whole page (R2: code fixes first).
fn flush_block(current: &mut Vec<&str>, blocks: &mut Vec<String>, normalized: &mut bool) {
    if current.is_empty() {
        return;
    }
    let joined = current.join(" ");
    current.clear();
    let cleaned = markers::sanitize_corrected(&joined).trim().to_owned();
    if cleaned.is_empty() {
        return;
    }
    let repaired = crate::seam::normalize_conflicting_punctuation(&cleaned);
    if repaired != cleaned {
        *normalized = true;
    }
    let repaired = repaired.trim().to_owned();
    if !repaired.is_empty() {
        blocks.push(repaired);
    }
}

/// Locates the four fences: each must appear exactly once, in the correct order.
///
/// Whole-line exact match; trailing whitespace is allowed (`trim_end`), leading whitespace is not.
fn locate_fences(lines: &[&str]) -> Option<[usize; 4]> {
    let mut anchors = [0usize; 4];
    for (slot, fence) in [
        FENCE_CONTEXT_BEFORE,
        FENCE_EDIT_BEGIN,
        FENCE_EDIT_END,
        FENCE_CONTEXT_AFTER,
    ]
    .into_iter()
    .enumerate()
    {
        let hits: Vec<usize> = lines
            .iter()
            .enumerate()
            .filter(|(_, line)| line.trim_end() == fence)
            .map(|(index, _)| index)
            .collect();
        if hits.len() != 1 {
            return None;
        }
        anchors[slot] = hits[0];
    }
    if anchors[0] < anchors[1] && anchors[1] < anchors[2] && anchors[2] < anchors[3] {
        Some(anchors)
    } else {
        None
    }
}

/// The three line ranges after fence recovery (half-open, all indices into `lines`).
#[derive(Debug, Clone, PartialEq, Eq)]
struct FenceRegions {
    /// Read-only leading-context region.
    before: Range<usize>,
    /// Editable core region.
    core: Range<usize>,
    /// Read-only trailing-context region.
    after: Range<usize>,
    /// Start line (inclusive) of the fence structure: all lines before it must be whitespace.
    head: usize,
    /// Line after the end of the fence structure (exclusive): all lines after it must be whitespace.
    tail: usize,
}

/// The first occurrence of a fence in `lines` after `from`.
fn fence_at(lines: &[&str], fence: &str, from: usize) -> Option<usize> {
    lines
        .iter()
        .enumerate()
        .skip(from)
        .find(|(_, line)| line.trim_end() == fence)
        .map(|(index, _)| index)
}

/// Sentinel fence recovery (retry strategy redesign §2.2).
///
/// Measured: among 7 cases of "document-truncated, sentinel fence missing", 5 only lacked `<<<EDIT-END>>>` while `<<<CONTEXT-AFTER …>>>` was still there, 1 lacked CONTEXT-AFTER, and 1 lacked EDIT-BEGIN; in all of them the core region itself was **complete**. Three rounds of whole-page retry only re-rolled the same answer, so boundaries are now first inferred from adjacent fences:
///
/// - EDIT-END missing, CONTEXT-AFTER present → CONTEXT-AFTER is taken as the end of the core region and the read-only trailing region is treated as empty; if both are missing → the core region runs to the end of the file;
/// - EDIT-BEGIN missing, CONTEXT-BEFORE present → scan from after CONTEXT-BEFORE, stripping the prefix whose normalized similarity to the payload's read-only leading region is ≥ [`READONLY_DRIFT_MIN_SIMILARITY`]; if it cannot be stripped, it is page-fatal;
/// - CONTEXT-BEFORE missing, EDIT-BEGIN present → the read-only leading region takes all lines before EDIT-BEGIN;
/// - both EDIT fences missing and nothing can be inferred → `None` (page-fatal `document-truncated`);
/// - duplicated fences → take the instance in the first legal order (for each fence, the first occurrence after the previous one).
///
/// `expected_before` is the fingerprint of the payload's read-only leading region ([`region_signature`] basis); it is used only in the prefix-stripping branch. `None` means the payload structure is unavailable, in which case no prefix is stripped.
/// The second return value describes the recovery action; the caller records [`WarningCode::FenceRecovered`].
fn recover_fences(
    lines: &[&str],
    expected_before: Option<&str>,
) -> Option<(FenceRegions, Vec<String>)> {
    if let Some([before_at, begin_at, end_at, after_at]) = locate_fences(lines) {
        return Some((
            FenceRegions {
                before: before_at + 1..begin_at,
                core: begin_at + 1..end_at,
                after: end_at + 1..after_at,
                head: before_at,
                tail: after_at + 1,
            },
            Vec::new(),
        ));
    }
    let mut notes = Vec::new();
    let before_at = fence_at(lines, FENCE_CONTEXT_BEFORE, 0);
    let begin_at = fence_at(lines, FENCE_EDIT_BEGIN, before_at.map_or(0, |at| at + 1));
    let end_at = fence_at(
        lines,
        FENCE_EDIT_END,
        begin_at.or(before_at).map_or(0, |at| at + 1),
    );
    let after_at = fence_at(
        lines,
        FENCE_CONTEXT_AFTER,
        end_at.or(begin_at).or(before_at).map_or(0, |at| at + 1),
    );

    // Start of the core region.
    let (core_start, before) = match begin_at {
        Some(at) => (at + 1, before_at.map_or(0, |b| b + 1)..at),
        None => {
            let before_at = before_at?;
            let limit = end_at.or(after_at).unwrap_or(lines.len());
            if before_at + 1 > limit {
                return None;
            }
            let start = strip_readonly_prefix(lines, before_at + 1, limit, expected_before)?;
            notes.push(format!(
                "missing `{FENCE_EDIT_BEGIN}`: stripped the read-only leading region after \
                 `{FENCE_CONTEXT_BEFORE}`; the core region starts at line {}",
                start + 1
            ));
            (start, before_at + 1..start)
        }
    };
    // End of the core region and the read-only trailing region.
    let (core_end, after, tail) = match (end_at, after_at) {
        (Some(end), Some(after)) if after > end => (end, end + 1..after, after + 1),
        (Some(end), _) => {
            notes.push(format!(
                "missing `{FENCE_CONTEXT_AFTER}`: the core region ends at `{FENCE_EDIT_END}`"
            ));
            (end, end..end, end + 1)
        }
        (None, Some(after)) if after > core_start => {
            notes.push(format!(
                "missing `{FENCE_EDIT_END}`: the core region ends at `{FENCE_CONTEXT_AFTER}`; \
                 the read-only trailing region is treated as empty"
            ));
            (after, after..after, after + 1)
        }
        (None, _) => {
            if begin_at.is_none() {
                // Both EDIT fences are missing, and the branch above also failed to strip out a start.
                return None;
            }
            notes.push(format!(
                "missing `{FENCE_EDIT_END}` and `{FENCE_CONTEXT_AFTER}`: the core region runs to the end of the file"
            ));
            (lines.len(), lines.len()..lines.len(), lines.len())
        }
    };
    if core_start > core_end {
        return None;
    }
    // On the recovery path, the core region's two ends may hold an indented or misplaced fence line: tighten the boundaries so it does not become a body paragraph.
    let mut core_start = core_start;
    let mut core_end = core_end;
    while core_start < core_end && is_loose_fence_line(lines[core_start]) {
        core_start += 1;
    }
    while core_end > core_start && is_loose_fence_line(lines[core_end - 1]) {
        core_end -= 1;
    }
    if begin_at.is_some() && before_at.is_none() {
        notes.push(format!(
            "missing `{FENCE_CONTEXT_BEFORE}`: lines before `{FENCE_EDIT_BEGIN}` are treated as the read-only leading region"
        ));
    }
    Some((
        FenceRegions {
            before,
            core: core_start..core_end,
            after,
            head: before_at.or(begin_at).unwrap_or(0),
            tail,
        },
        notes,
    ))
}

/// Prefix stripping when `EDIT-BEGIN` is missing: within `[from, limit)`, finds the first `k` such that the fingerprint of `lines[from..k]` has similarity ≥ [`READONLY_DRIFT_MIN_SIMILARITY`] with the payload's read-only leading region. If none is found, the core region's start cannot be inferred.
fn strip_readonly_prefix(
    lines: &[&str],
    from: usize,
    limit: usize,
    expected_before: Option<&str>,
) -> Option<usize> {
    let expected = expected_before?;
    if expected.is_empty() {
        // The first page has no read-only leading region: right after CONTEXT-BEFORE comes the core region directly.
        return Some(from);
    }
    let mut best: Option<(usize, f64)> = None;
    for k in from..=limit {
        let score = crate::atomize::similarity(expected, &region_signature(&lines[from..k]));
        if score >= READONLY_DRIFT_MIN_SIMILARITY && best.is_none_or(|(_, seen)| score > seen) {
            best = Some((k, score));
        }
    }
    best.map(|(k, _)| k)
}

/// Fingerprint of a read-only region: strip structure lines, strip markers, then normalized characters.
fn region_signature(lines: &[&str]) -> String {
    let joined = lines
        .iter()
        .filter(|line| !is_structural_line(line))
        .copied()
        .collect::<Vec<_>>()
        .join(" ");
    normalize_chars(&markers::strip_markers(&joined))
}

/// The same-basis fingerprint on the word-stream side (used for read-only drift and the verbatim judgment).
fn words_signature(words: &[Word]) -> String {
    normalize_chars(&markers::strip_markers(&markers::marked_text(words)))
}

/// Whether a line is one of the four sentinel fences (same basis as [`locate_fences`]: trailing whitespace allowed, **leading whitespace not allowed**, because at render time a leading space is exactly how a fake fence inside body text is neutralized).
fn is_fence_line(line: &str) -> bool {
    matches!(
        line.trim_end(),
        FENCE_CONTEXT_BEFORE | FENCE_EDIT_BEGIN | FENCE_EDIT_END | FENCE_CONTEXT_AFTER
    )
}

/// Lenient fence test: both ends trimmed. Used only by [`recover_fences`] to tighten the core region's boundaries, since on the recovery path an indented or misplaced fence line should not be treated as body text.
fn is_loose_fence_line(line: &str) -> bool {
    matches!(
        line.trim(),
        FENCE_CONTEXT_BEFORE | FENCE_EDIT_BEGIN | FENCE_EDIT_END | FENCE_CONTEXT_AFTER
    )
}

/// Whether a line is a structure line (hard-cut marker, sentinel fence, or code block fence), excluded from the drift comparison.
fn is_structural_line(line: &str) -> bool {
    let trimmed = line.trim();
    trimmed == MARKER_HARD_CUT
        || is_loose_fence_line(line)
        || trimmed.starts_with("```")
        || trimmed.starts_with("~~~")
}

/// Renders a range into body blocks, splitting at speaker changes and manual paragraph pins.
///
/// Paragraph aggregation never crosses turns: each speaker change is split here into an independent body block, which appears on the page as a single blank-line paragraph boundary; [`forced_boundaries`] then guarantees it unconditionally.
fn render_region(
    words: &[Word],
    range: &Range<usize>,
    para_starts: &[usize],
    labels: Option<&SpeakerLabels>,
) -> Vec<String> {
    let mut blocks = Vec::new();
    for segment in segments(words, range, para_starts) {
        let mut text = markers::marked_text_labeled(&words[segment.clone()], labels);
        if segment.end < range.end {
            text.push_str(&markers::boundary_marker_suffix_labeled(
                &words[segment.end - 1],
                &words[segment.end],
                labels,
            ));
        }
        let line = sanitize_inline_text(&text);
        if markers::sanitize_corrected(&line).trim().is_empty() {
            continue;
        }
        blocks.push(line);
    }
    blocks
}

/// Split points within a range: speaker changes plus manual paragraph pins.
fn segments(words: &[Word], range: &Range<usize>, para_starts: &[usize]) -> Vec<Range<usize>> {
    let mut output = Vec::new();
    if range.start >= range.end {
        return output;
    }
    let mut start = range.start;
    for index in range.start..range.end - 1 {
        let boundary = words[index].sp != words[index + 1].sp || para_starts.contains(&(index + 1));
        if boundary {
            output.push(start..index + 1);
            start = index + 1;
        }
    }
    output.push(start..range.end);
    output
}

/// Appends a body block: one blank line between blocks, sentinel prefix neutralized.
fn push_blocks(
    lines: &mut Vec<String>,
    blocks: Vec<String>,
    page: &str,
    warnings: &mut Vec<Warning>,
) {
    for (index, block) in blocks.into_iter().enumerate() {
        if index > 0 {
            lines.push(String::new());
        }
        if block.trim_start().starts_with(SENTINEL_PREFIX) {
            warnings.push(Warning {
                code: WarningCode::SentinelNeutralized,
                scope: ProblemScope::Page {
                    id: page.to_owned(),
                },
                detail: format!("body line starts with `{SENTINEL_PREFIX}`; neutralized by prefixing a space"),
            });
            lines.push(format!(" {block}"));
        } else {
            lines.push(block);
        }
    }
}

/// Clamps the range to the word stream length (defensive against a stale plan passed in from outside).
fn clamp_range(range: &Range<usize>, len: usize) -> Range<usize> {
    let start = range.start.min(len);
    let end = range.end.clamp(start, len);
    start..end
}

/// Rewrites the document-level scope of [`lint_polish_page`] to page scope; other scopes are kept as they are.
fn rescope(scope: ProblemScope, plan: &PolishPagePlan) -> ProblemScope {
    match scope {
        ProblemScope::Document => ProblemScope::Page {
            id: plan.id.clone(),
        },
        other => other,
    }
}

// ---------------------------------------------------------------------------
// segment-repair carrier (kind = "segment-repair")
// ---------------------------------------------------------------------------
//
// The **index-contract** carriers for targeted re-segmentation and page-seam judgment (kind = "segment-repair" /
// "seam-repair"): the main polish page accepts body text on the first round; after the wave, paragraphs still over
// [`paragraph_word_limit`] (or windows on either side of a page seam) are gathered together and re-paged by word budget.
// The payload is still plain text: each block sits between a pair of fences, and inside the fences there is **one sentence per line, with a line number**
// (`12| sentence`); the block-header fence states the sentence count, word count and minimum paragraph count. The answer **no longer restates the body**;
// each block returns only a few `a-b` line-number ranges (one paragraph per line), which must start from 1, be contiguous end to end, and cover through the last line.
// This makes validation pure arithmetic: non-contiguous or non-covering ranges ⇒ `range-invalid`; a single range covering the whole block when the block exceeds the limit ⇒ `paragraph-oversize`.
// The class of hallucinated body rewriting has no foothold in the index contract. In the old source-drift carrier, a model that changed even one character accounted for a quarter of segmentation-repair failures, whereas the answer text only serves to locate boundaries and is never written back. If the answer still restates a numbered sentence line (`12| …`), it is accepted too, as long as paragraphs are grouped by blank lines — only the line numbers are trusted.

/// Index-contract block-header fence prefix: `<<<BLOCK 1 | 63 sentences | 1832 characters | at least 4 paragraphs>>>`.
pub const FENCE_BLOCK_PREFIX: &str = "<<<BLOCK";
/// Index-contract block-closing fence line.
pub const FENCE_BLOCK_END: &str = "<<<BLOCK-END>>>";

/// Minimum paragraph count for a block: `ceil(word count / single-paragraph cap)`, at least 1.
pub fn block_min_paragraphs(lines: &[String]) -> usize {
    let text = lines.join(" ");
    let count = word_count(&text);
    let limit = paragraph_word_limit(&text).max(1);
    count.div_ceil(limit).max(1)
}

/// Renders one index-contract payload block: the block header `<<<BLOCK k | n sentences | c words|characters[ | extra]>>>`, then inside the fences one sentence per line prefixed `N| ` (starting at 1), closed by `<<<BLOCK-END>>>`.
///
/// Newlines within a line are folded into spaces (soft-newline semantics). The line-number prefix already neutralizes the `<<<` sentinel, so no extra leading space is needed.
fn render_index_block(index: usize, lines: &[String], extra: &str) -> String {
    let text = lines.join(" ");
    let count = word_count(&text);
    let unit = if is_cjk_text(&text) {
        "characters"
    } else {
        "words"
    };
    let mut out = Vec::with_capacity(lines.len() + 2);
    let mut header = format!(
        "{FENCE_BLOCK_PREFIX} {} | {} sentences | {count} {unit}",
        index + 1,
        lines.len()
    );
    if !extra.is_empty() {
        header.push_str(" | ");
        header.push_str(extra);
    }
    header.push_str(">>>");
    out.push(header);
    for (offset, line) in lines.iter().enumerate() {
        let flat = line.split_whitespace().collect::<Vec<_>>().join(" ");
        out.push(format!("{}| {flat}", offset + 1));
    }
    out.push(FENCE_BLOCK_END.to_owned());
    out.join("\n")
}

/// Renders the segment-repair payload: one block per over-limit paragraph. The block header additionally states the minimum paragraph count (`at least N paragraphs`, see [`block_min_paragraphs`]); blocks are separated by one blank line.
pub fn render_segment_repair_page(paragraphs: &[Vec<String>]) -> String {
    let mut blocks = Vec::with_capacity(paragraphs.len());
    for (index, lines) in paragraphs.iter().enumerate() {
        let need = block_min_paragraphs(lines);
        blocks.push(render_index_block(
            index,
            lines,
            &format!("at least {need} paragraphs"),
        ));
    }
    let mut text = blocks.join("\n\n");
    text.push('\n');
    text
}

/// Renders the seam-repair payload: one block per page-seam window. The block header additionally states the page-seam positions (`page seam before line N`, multiple seams comma-separated; `seams` are the 0-based sentence-line offsets within the block, i.e. the line where page k+1's first sentence sits). No minimum paragraph count is stated, since a whole block in one paragraph is a legal answer.
pub fn render_seam_repair_page(blocks: &[(Vec<String>, Vec<usize>)]) -> String {
    let mut rendered = Vec::with_capacity(blocks.len());
    for (index, (lines, seams)) in blocks.iter().enumerate() {
        let positions: Vec<String> = seams
            .iter()
            .map(|offset| (offset + 1).to_string())
            .collect();
        let extra = if positions.len() == 1 {
            format!("page seam before line {}", positions[0])
        } else {
            format!("page seams before lines {}", positions.join(", "))
        };
        rendered.push(render_index_block(index, lines, &extra));
    }
    let mut text = rendered.join("\n\n");
    text.push('\n');
    text
}

/// The result of [`parse_segment_repair_page`]: diagnostics plus the per-block grouping plan.
#[derive(Debug)]
pub struct SegmentRepairParsed {
    /// String-level diagnostics. Problems are located per block (`ProblemScope::Paragraph`, index is the block's order within the payload) and block only the corresponding block; document-level problems (the size guard) block the whole answer.
    pub diagnostics: Diagnostics,
    /// One-to-one with the payload blocks: `Some(groups)` = the block passed validation, and the groups are cut according to the answer's ranges, each element being a 0-based, consecutively increasing sentence-line index of the block, which together exactly cover the whole block; `None` = the block was rejected (illegal ranges, missing block, or a single paragraph covering the whole block while over the limit).
    pub paragraphs: Vec<Option<Vec<Vec<usize>>>>,
}

/// Block-header fence: returns the block number (1-based). Accepts `<<<BLOCK 3 | …>>>`, `<<<BLOCK 3>>>`, and `BLOCK 3` (angle brackets dropped by the model); `<<<BLOCK-END>>>` does not count as a block header.
fn block_header_index(line: &str) -> Option<usize> {
    let trimmed = line.trim();
    let body = trimmed.strip_prefix("<<<").unwrap_or(trimmed).trim_start();
    if body.len() < 5 || !body.is_char_boundary(5) || !body[..5].eq_ignore_ascii_case("block") {
        return None;
    }
    let rest = body[5..].trim_start();
    if rest.starts_with('-') {
        return None;
    }
    let digits: String = rest.chars().take_while(char::is_ascii_digit).collect();
    if digits.is_empty() {
        return None;
    }
    digits.parse().ok()
}

/// Whether it is a block-closing fence (tolerates dropped angle brackets).
fn is_block_end(line: &str) -> bool {
    let trimmed = line.trim();
    let body = trimmed.strip_prefix("<<<").unwrap_or(trimmed);
    let body = body.strip_suffix(">>>").unwrap_or(body);
    body.trim().eq_ignore_ascii_case("BLOCK-END")
}

/// Numbered sentence line `12| 句子` → `(12, "句子")`.
fn numbered_line(line: &str) -> Option<(usize, &str)> {
    let trimmed = line.trim();
    let digits_end = trimmed
        .char_indices()
        .find(|(_, c)| !c.is_ascii_digit())
        .map(|(i, _)| i)
        .unwrap_or(trimmed.len());
    if digits_end == 0 {
        return None;
    }
    let rest = trimmed[digits_end..].trim_start();
    let rest = rest.strip_prefix('|')?;
    Some((trimmed[..digits_end].parse().ok()?, rest.trim()))
}

/// Payload side: splits out each block's sentence lines between its block-header and closing fences (line numbers removed, trimmed, non-empty).
fn segment_repair_payload_paragraphs(payload: &str) -> Vec<Vec<&str>> {
    let mut paragraphs: Vec<Vec<&str>> = Vec::new();
    let mut current: Option<Vec<&str>> = None;
    for line in payload.lines() {
        if block_header_index(line).is_some() {
            if let Some(lines) = current.take() {
                paragraphs.push(lines);
            }
            current = Some(Vec::new());
        } else if is_block_end(line) {
            if let Some(lines) = current.take() {
                paragraphs.push(lines);
            }
        } else if let Some((_, text)) = numbered_line(line) {
            current.get_or_insert_with(Vec::new).push(text);
        } else if !line.trim().is_empty() {
            current.get_or_insert_with(Vec::new).push(line.trim());
        }
    }
    if let Some(lines) = current {
        paragraphs.push(lines);
    }
    paragraphs
}

/// A range within an answer line: `1-14`, `15 – 30`, `31~40`, or a single `41`; one line may hold several (separated by commas, semicolons or spaces). If the line contains any character other than digits, separators or hyphens, the whole line is not a range line (returns None) and the caller ignores it.
fn parse_range_line(line: &str) -> Option<Vec<(usize, usize)>> {
    #[derive(Clone, Copy, PartialEq, Eq)]
    enum Tok {
        Num(usize),
        Dash,
    }
    let mut toks: Vec<Tok> = Vec::new();
    let mut digits = String::new();
    for c in line.trim().chars() {
        if c.is_ascii_digit() {
            digits.push(c);
            continue;
        }
        if !digits.is_empty() {
            toks.push(Tok::Num(digits.parse().ok()?));
            digits.clear();
        }
        match c {
            '-' | '–' | '—' | '~' => toks.push(Tok::Dash),
            ',' | ';' | ' ' | '\t' | '，' | '；' | '、' => {}
            _ => return None,
        }
    }
    if !digits.is_empty() {
        toks.push(Tok::Num(digits.parse().ok()?));
    }
    let mut ranges = Vec::new();
    let mut i = 0;
    while i < toks.len() {
        let Tok::Num(a) = toks[i] else {
            return None;
        };
        if i + 2 < toks.len()
            && toks[i + 1] == Tok::Dash
            && let Tok::Num(b) = toks[i + 2]
        {
            ranges.push((a, b));
            i += 3;
            continue;
        }
        ranges.push((a, a));
        i += 1;
    }
    Some(ranges)
}

/// The two acceptable forms of one block's body in the answer: range lines, or restated numbered sentence lines (grouped by blank lines, only the line numbers trusted). Returns (list of ranges, whether anything was parsed).
fn parse_block_answer(lines: &[&str]) -> Vec<(usize, usize)> {
    // Form two: numbered sentence lines.
    let numbered: Vec<Option<usize>> = lines
        .iter()
        .map(|line| numbered_line(line).map(|(n, _)| n))
        .collect();
    if numbered.iter().any(Option::is_some) {
        let mut ranges: Vec<(usize, usize)> = Vec::new();
        let mut open: Option<(usize, usize)> = None;
        for (line, number) in lines.iter().zip(&numbered) {
            match number {
                Some(n) => match open {
                    Some((a, b)) if b + 1 == *n => open = Some((a, *n)),
                    Some(range) => {
                        ranges.push(range);
                        open = Some((*n, *n));
                    }
                    None => open = Some((*n, *n)),
                },
                None if line.trim().is_empty() => {
                    if let Some(range) = open.take() {
                        ranges.push(range);
                    }
                }
                None => {}
            }
        }
        if let Some(range) = open {
            ranges.push(range);
        }
        return ranges;
    }
    // Form one: range lines.
    let mut ranges = Vec::new();
    for line in lines {
        if let Some(mut found) = parse_range_line(line) {
            ranges.append(&mut found);
        }
    }
    ranges
}

/// Whether the range sequence starts from 1, is contiguous end to end, and covers through `total`. Returns a description of the first defect.
fn validate_ranges(ranges: &[(usize, usize)], total: usize) -> Result<(), String> {
    if ranges.is_empty() {
        return Err("没有解析到任何 `a-b` 行号区间".to_owned());
    }
    let mut expected = 1usize;
    for &(a, b) in ranges {
        if a > b {
            return Err(format!("区间 {a}-{b} 起点大于终点"));
        }
        if a != expected {
            return Err(if a > expected {
                format!("第 {expected} 行没有被任何区间覆盖（下一个区间从 {a} 开始）")
            } else {
                format!(
                    "区间 {a}-{b} 与前一个区间重叠（前一个区间到 {} 结束）",
                    expected - 1
                )
            });
        }
        expected = b + 1;
    }
    if expected != total + 1 {
        return Err(if expected <= total {
            format!("第 {expected}–{total} 行没有被任何区间覆盖")
        } else {
            format!(
                "区间越界：块只有 {total} 行，区间却到 {} 结束",
                expected - 1
            )
        });
    }
    Ok(())
}

/// Parses and validates the index-contract answer block by block (string level; the agent mirror lint reuses the same implementation).
///
/// All checks rely only on the payload and answer texts. The answer is split into blocks by `<<<BLOCK k>>>` / `<<<BLOCK-END>>>` (block headers without angle brackets are accepted too; if the payload has only one block and the answer has no block header, the whole answer is block 1). Each block's body is parsed into a sequence of `a-b` ranges (restated numbered sentence lines grouped by blank lines are also accepted):
///
/// - missing block, no ranges, ranges not starting at 1, not contiguous end to end, not covering through the last line, or out of bounds ⇒ that block gets [`ProblemCode::RangeInvalid`] (detail locates the first defect), and `paragraphs[i] = None`;
/// - legal ranges but only one, and the whole block exceeds [`paragraph_word_limit`] ⇒ that block gets [`ProblemCode::ParagraphOversize`] (the detail is the targeted retry instruction, including the minimum paragraph count), and `paragraphs[i] = None`; the engine accepts seam blocks as "whole block in one paragraph";
/// - legal ranges with two or more of them (or the whole block was not over the limit to begin with) ⇒ the block passes, `paragraphs[i] = Some(groups)`. If the cut groups still exceed the limit, **this does not judge it guilty here**: the engine decides by overflow magnitude whether to cut further deterministically or ask again in the next round (see `engines::polish::segment_repair_wave`).
///
/// The size guard ([`guard_output_size`]) is the only document-level problem; when it hits, all blocks are rejected.
pub fn parse_segment_repair_page(payload: &str, answer: &str) -> SegmentRepairParsed {
    let mut diagnostics = Diagnostics::new();
    let source = segment_repair_payload_paragraphs(payload);
    let normalized = normalize_llm_output(answer);
    for warning in normalized.warnings() {
        diagnostics.push_warning(Warning {
            code: warning.code,
            scope: ProblemScope::Document,
            detail: warning.detail,
        });
    }
    if let Some(problem) = guard_output_size(payload, &normalized.text) {
        diagnostics.push_problem(Problem::document(problem.code, problem.detail));
        return SegmentRepairParsed {
            diagnostics,
            paragraphs: vec![None; source.len()],
        };
    }

    // Answer side: split by block headers; lines before any block header go into a "no block header" bucket.
    let mut sections: std::collections::BTreeMap<usize, Vec<&str>> =
        std::collections::BTreeMap::new();
    let mut unlabeled: Vec<&str> = Vec::new();
    let mut current: Option<usize> = None;
    for line in normalized.text.lines() {
        if let Some(index) = block_header_index(line) {
            current = Some(index);
            sections.entry(index).or_default();
            continue;
        }
        if is_block_end(line) {
            current = None;
            continue;
        }
        match current {
            Some(index) => sections.entry(index).or_default().push(line),
            None => unlabeled.push(line),
        }
    }
    if sections.is_empty() && source.len() == 1 {
        sections.insert(1, unlabeled);
    }

    let mut paragraphs: Vec<Option<Vec<Vec<usize>>>> = Vec::with_capacity(source.len());
    for (index, lines) in source.iter().enumerate() {
        let Some(section) = sections.get(&(index + 1)) else {
            diagnostics.push_problem(Problem {
                code: ProblemCode::RangeInvalid,
                scope: ProblemScope::Paragraph { index },
                detail: format!(
                    "第 {} 块缺失：每个块都要回复 `{FENCE_BLOCK_PREFIX} {}>>>` … `{FENCE_BLOCK_END}`，\
                     栅栏内一行一个 `a-b` 行号区间",
                    index + 1,
                    index + 1
                ),
            });
            paragraphs.push(None);
            continue;
        };
        let ranges = parse_block_answer(section);
        if let Err(defect) = validate_ranges(&ranges, lines.len()) {
            diagnostics.push_problem(Problem {
                code: ProblemCode::RangeInvalid,
                scope: ProblemScope::Paragraph { index },
                detail: format!(
                    "第 {} 块区间非法：{defect}。区间必须从 1 开始、首尾相接、到 {} 结束，\
                     一行一个 `a-b`",
                    index + 1,
                    lines.len()
                ),
            });
            paragraphs.push(None);
            continue;
        }
        let text = lines.join(" ");
        let count = word_count(&text);
        let limit = paragraph_word_limit(&text);
        if ranges.len() < 2 && count > limit {
            let need = count.div_ceil(limit.max(1)).max(2);
            diagnostics.push_problem(Problem {
                code: ProblemCode::ParagraphOversize,
                scope: ProblemScope::Paragraph { index },
                detail: format!(
                    "第 {} 块只回了一个区间，仍是 {count} 词的一整段（单段上限 {limit}）：\
                     至少拆成 {need} 个区间，在每个话题/语义转折处断开（口语段落通常 2–6 句）",
                    index + 1
                ),
            });
            paragraphs.push(None);
            continue;
        }
        paragraphs.push(Some(
            ranges
                .iter()
                .map(|&(a, b)| ((a - 1)..b).collect())
                .collect(),
        ));
    }

    SegmentRepairParsed {
        diagnostics,
        paragraphs,
    }
}

// ---------------------------------------------------------------------------
// punct-repair carrier (kind = "punct-repair")
// ---------------------------------------------------------------------------
//
// Targeted punctuation repair: after the main polish page accepts body text on the first round, all mapped sentences **across all pages** that still exceed the single-sentence span cap
// (the model did not add sentence-final punctuation at semantic completion points, so one sentence swallows thousands of source characters) are gathered together and re-paged once,
// asking only for "add sentence-final punctuation". The carrier is still plain text: in the payload, each over-long sentence sits between a pair of **id-tagged** fences
// (`<<<SENTENCE-BEGIN id=s01 min-sentences=4>>>` / `<<<SENTENCE-END id=s01>>>`), and sentences are isolated from each other. The answer is located by id, and each sentence is validated individually:
// the word sequence (per the [`crate::atomize::atom_key`] basis, pure-punctuation atoms not counted) must be exactly identical to the payload, and at least one new in-sentence sentence-final punctuation mark must be added. One rewritten sentence does not implicate the other sentences in the same payload.

/// The prefix of the start fence for each sentence in the punct-repair payload (a whole line looks like `<<<SENTENCE-BEGIN id=s01 min-sentences=4>>>`).
pub const FENCE_SENTENCE_BEGIN_PREFIX: &str = "<<<SENTENCE-BEGIN";
/// The prefix of the end fence for each sentence in the punct-repair payload (a whole line looks like `<<<SENTENCE-END id=s01>>>`).
pub const FENCE_SENTENCE_END_PREFIX: &str = "<<<SENTENCE-END";

/// One sentence in the punct-repair payload.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PunctRepairItem {
    /// In-payload id (starting from `s01`); answers are located by it.
    pub id: String,
    /// Sentence text (final-basis text, which may include ⏸ hints inserted by the engine's projection of source pauses).
    pub text: String,
    /// How many sentences this one should be split into at minimum (a hint value that only goes into the fence attribute; validation only requires ≥ 2).
    pub min_sentences: usize,
}

/// Renders the punct-repair payload: one pair of id-tagged fence lines per sentence, with blank lines between sentence blocks.
///
/// Newlines within a sentence are folded into spaces (soft-newline semantics); a sentence line starting with `<<<` gets a leading space to neutralize it.
pub fn render_punct_repair_page(items: &[PunctRepairItem]) -> String {
    let mut blocks = Vec::with_capacity(items.len());
    for item in items {
        let flat = item.text.split_whitespace().collect::<Vec<_>>().join(" ");
        let body = if flat.starts_with(SENTINEL_PREFIX) {
            format!(" {flat}")
        } else {
            flat
        };
        blocks.push(format!(
            "{FENCE_SENTENCE_BEGIN_PREFIX} id={} min-sentences={}>>>\n{body}\n{FENCE_SENTENCE_END_PREFIX} id={}>>>",
            item.id, item.min_sentences, item.id
        ));
    }
    let mut text = blocks.join("\n\n");
    text.push('\n');
    text
}

/// The result of [`parse_punct_repair_page`]: diagnostics plus per-sentence validated text.
#[derive(Debug)]
pub struct PunctRepairParsed {
    /// String-level diagnostics. Problems are located per sentence (`ProblemScope::Sentence { id }`) and block only the corresponding sentence; document-level problems (the size guard) block the whole answer.
    pub diagnostics: Diagnostics,
    /// One-to-one with the payload sentences: `Some(text)` = the sentence passed validation, and the value is the answer text with markers stripped and soft newlines folded (the engine then splits it at sentence-final punctuation and maps it back); `None` = the sentence was rejected (missing, words rewritten, no sentence-final punctuation added, or conflicting or false sentence endings).
    pub sentences: Vec<Option<String>>,
}

/// Gets the `id=` attribute from a fence line; a fence line looks like `<<<SENTENCE-BEGIN id=s01 …>>>`.
/// Attribute tolerance: `id=s01`, `id="s01"`, and a bare `s01` are all accepted.
fn fence_id(line: &str, prefix: &str) -> Option<String> {
    let trimmed = line.trim();
    let rest = trimmed.strip_prefix(prefix)?;
    let rest = rest.strip_suffix(">>>").unwrap_or(rest);
    for token in rest.split_whitespace() {
        let token = token.trim_matches(|ch| ch == '"' || ch == '\'' || ch == ',');
        if let Some(value) = token.strip_prefix("id=") {
            return Some(value.trim_matches(|ch| ch == '"' || ch == '\'').to_owned());
        }
    }
    // No `id=`: take the first token without `=` as the id (`<<<SENTENCE-END s01>>>`).
    let bare = rest
        .split_whitespace()
        .find(|token| !token.contains('='))
        .map(str::to_owned);
    bare.or_else(|| Some(String::new()))
}

/// Splits out `(id, sentence text)` by fence; the answer side and the payload side use the same parser. Body text outside the fences is ignored entirely: chit-chat or explanation in the answer is not grounds for rejection, since body validation is strict enough.
fn punct_repair_blocks(text: &str) -> Vec<(String, String)> {
    let mut blocks: Vec<(String, String)> = Vec::new();
    let mut current: Option<(String, Vec<String>)> = None;
    for line in text.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with(FENCE_SENTENCE_BEGIN_PREFIX) {
            if let Some((id, lines)) = current.take() {
                blocks.push((id, lines.join(" ")));
            }
            let id = fence_id(trimmed, FENCE_SENTENCE_BEGIN_PREFIX).unwrap_or_default();
            current = Some((id, Vec::new()));
        } else if trimmed.starts_with(FENCE_SENTENCE_END_PREFIX) {
            if let Some((mut id, lines)) = current.take() {
                if id.is_empty()
                    && let Some(end_id) = fence_id(trimmed, FENCE_SENTENCE_END_PREFIX)
                {
                    id = end_id;
                }
                blocks.push((id, lines.join(" ")));
            }
        } else if let Some((_, lines)) = current.as_mut()
            && !trimmed.is_empty()
        {
            lines.push(trimmed.to_owned());
        }
    }
    if let Some((id, lines)) = current {
        blocks.push((id, lines.join(" ")));
    }
    blocks
}

/// Word-sequence signature: after stripping markers, atomize, drop pure-punctuation atoms, and normalize the rest by [`atom_key`]. Adding, removing or replacing punctuation does not change the signature; changing words, adding or removing words, or splitting or merging Latin words does. Korean is keyed by syllable, so adding or changing spaces does not change the signature.
fn lexical_keys(text: &str) -> Vec<String> {
    crate::atomize::atomize_syllables(&markers::strip_markers(text))
        .iter()
        .filter_map(|atom| crate::atomize::atom_key(atom))
        .collect()
}

/// Number of in-sentence sentence-final punctuation marks (a sentence-final mark on the last atom is not counted, since that is just the sentence's own ending).
fn internal_sentence_ends(text: &str) -> usize {
    let atoms = crate::atomize::atomize_syllables(text);
    let last = atoms.len().saturating_sub(1);
    atoms
        .iter()
        .enumerate()
        .filter(|(index, atom)| *index < last && sentence_end(atom))
        .count()
}

/// Parses and validates the punct-repair answer sentence by sentence (string level; the agent mirror lint reuses the same implementation).
///
/// All checks rely only on the payload and answer texts. The agent side runs the full validation; the engine side adds only "split at sentence-final punctuation, LCS mapping back, and whether sub-clauses still exceed the limit", which does not reject sentences and only decides whether to go to the next round. Per sentence:
///
/// - no fence block with that id in the answer (or the block is empty) ⇒ [`ProblemCode::MissingId`];
/// - word signature differs from the payload ⇒ [`ProblemCode::SourceDrift`] (detail locates the first rewritten, added or removed word);
/// - words identical but no in-sentence sentence-final punctuation added at all ⇒ [`ProblemCode::SentenceOversize`] (detail is the targeted retry instruction);
/// - conflicting adjacent punctuation (`。，`/`，。`) appears ⇒ normalized in code (R2), recording only [`WarningCode::PunctuationNormalized`] and not rejecting the sentence;
/// - dangling false sentence end (`当。`) ⇒ [`ProblemCode::SurfaceArtifact`] (same basis as the main polish surface checks).
///
/// The size guard ([`guard_output_size`]) is the only document-level problem; when it hits, all sentences are rejected.
pub fn parse_punct_repair_page(payload: &str, answer: &str) -> PunctRepairParsed {
    let mut diagnostics = Diagnostics::new();
    let source = punct_repair_blocks(payload);
    let normalized = normalize_llm_output(answer);
    for warning in normalized.warnings() {
        diagnostics.push_warning(Warning {
            code: warning.code,
            scope: ProblemScope::Document,
            detail: warning.detail,
        });
    }
    if let Some(problem) = guard_output_size(payload, &normalized.text) {
        diagnostics.push_problem(Problem::document(problem.code, problem.detail));
        return PunctRepairParsed {
            diagnostics,
            sentences: vec![None; source.len()],
        };
    }
    let mut got: Vec<(String, String, bool)> = punct_repair_blocks(&normalized.text)
        .into_iter()
        .map(|(id, text)| (id, text, false))
        .collect();
    let mut sentences: Vec<Option<String>> = Vec::with_capacity(source.len());
    for (position, (id, expected)) in source.iter().enumerate() {
        let scope = ProblemScope::Sentence { id: id.clone() };
        // Look up by id first; if the answer lost its ids but the block count matches, tolerate by position.
        let slot = got
            .iter()
            .position(|(got_id, _, taken)| !taken && got_id == id)
            .or_else(|| {
                (got.len() == source.len() && got[position].0.is_empty() && !got[position].2)
                    .then_some(position)
            });
        let Some(slot) = slot else {
            diagnostics.push_problem(Problem {
                code: ProblemCode::MissingId,
                scope,
                detail: format!(
                    "句 {id} 缺失：答案里没有 `{FENCE_SENTENCE_BEGIN_PREFIX} id={id}>>>` … \
                     `{FENCE_SENTENCE_END_PREFIX} id={id}>>>` 栅栏块；每句都必须带自己的 id \
                     栅栏原样复述"
                ),
            });
            sentences.push(None);
            continue;
        };
        got[slot].2 = true;
        // R2 code fixes first: normalize conflicting adjacent punctuation before validation. The old implementation filed this under `document-oversize` and rejected sentences one by one, so the next round the model often just re-rolled the same answer.
        let sanitized = markers::sanitize_corrected(&got[slot].1);
        let text = crate::seam::normalize_conflicting_punctuation(&sanitized);
        if text != sanitized {
            diagnostics.push_warning(Warning {
                code: WarningCode::PunctuationNormalized,
                scope: scope.clone(),
                detail: format!("sentence {id}: conflicting adjacent punctuation was normalized in code"),
            });
        }
        if text.split_whitespace().next().is_none() {
            diagnostics.push_problem(Problem {
                code: ProblemCode::MissingId,
                scope,
                detail: format!("句 {id} 的栅栏块为空：必须原样复述整句并加上句末标点"),
            });
            sentences.push(None);
            continue;
        }
        let expected_keys = lexical_keys(expected);
        let got_keys = lexical_keys(&text);
        if expected_keys != got_keys {
            diagnostics.push_problem(Problem {
                code: ProblemCode::SourceDrift,
                scope,
                detail: punct_repair_drift_detail(id, &expected_keys, &got_keys),
            });
            sentences.push(None);
            continue;
        }
        if internal_sentence_ends(&text) == 0 {
            let units = word_count(&text);
            let limit = paragraph_word_limit(&text);
            diagnostics.push_problem(Problem {
                code: ProblemCode::SentenceOversize,
                scope,
                detail: format!(
                    "句 {id} 未新增任何句末标点，仍是 {units} 个显示单位的一整句（单句上限 \
                     {limit}）：在每个语义完结处加句号/问号/叹号（`。？！` / `.?!`），把它切成\
                     多句；除标点外不得改动、增删任何词"
                ),
            });
            sentences.push(None);
            continue;
        }
        if crate::seam::contains_dangling_sentence_end(&text) {
            diagnostics.push_problem(Problem {
                code: ProblemCode::SurfaceArtifact,
                scope,
                detail: format!(
                    "句 {id} 有句子结束在悬垂连接词/介词上（如 `当。`、`让。`、`because.`）：\
                     去掉那个假句末，把后面的小句并入，只在完整表达结束处收句"
                ),
            });
            sentences.push(None);
            continue;
        }
        sentences.push(Some(text));
    }
    PunctRepairParsed {
        diagnostics,
        sentences,
    }
}

/// Locating note for a word-signature mismatch: reports the position of the first mismatched word and the word forms on both sides.
fn punct_repair_drift_detail(id: &str, expected: &[String], got: &[String]) -> String {
    let first = expected
        .iter()
        .zip(got)
        .position(|(left, right)| left != right)
        .unwrap_or(expected.len().min(got.len()));
    let show = |keys: &[String]| -> String {
        let lo = first.saturating_sub(2);
        let hi = (first + 3).min(keys.len());
        keys[lo..hi].join(" ")
    };
    if expected.len() != got.len() {
        return format!(
            "句 {id} 的词被增删：载荷 {} 个词、答案 {} 个词（第 {} 个词附近：载荷 “{}” / 答案 \
             “{}”）；只允许增加、替换或删除标点，每个词都必须逐字保留",
            expected.len(),
            got.len(),
            first + 1,
            show(expected),
            show(got)
        );
    }
    format!(
        "句 {id} 第 {} 个词被改写：载荷 “{}” / 答案 “{}”；只允许增加、替换或删除标点，\
         每个词都必须逐字保留（错别字也不要改，那不是本次的任务）",
        first + 1,
        show(expected),
        show(got)
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    fn word(index: usize, t0: f64, t1: f64, text: &str, sp: &str) -> Word {
        Word {
            id: format!("g{index}"),
            t0,
            t1,
            text: text.to_owned(),
            sp: sp.to_owned(),
            glue: false,
        }
    }

    /// A continuous word stream without pauses, from the same speaker.
    fn stream(texts: &[&str]) -> Vec<Word> {
        texts
            .iter()
            .enumerate()
            .map(|(index, text)| {
                let t0 = index as f64 * 0.5;
                word(index, t0, t0 + 0.4, text, "s1")
            })
            .collect()
    }

    fn single_page(words: &[Word]) -> PolishPagePlan {
        PolishPagePlan {
            id: "p001".to_owned(),
            before: 0..0,
            core: 0..words.len(),
            after: words.len()..words.len(),
            hard_cut_start: false,
            hard_cut_end: false,
            para_starts: Vec::new(),
        }
    }

    /// Test-only parse entry point: `input` is always this page's rendered text (the size-guard baseline).
    fn parse(words: &[Word], plan: &PolishPagePlan, output: &str) -> PolishParsed {
        let input = render_polish_page(words, plan).text;
        parse_polish_page(words, plan, &input, output)
    }

    /// Expected paragraphs under the same parsing basis.
    fn expected_paragraphs(words: &[Word], plan: &PolishPagePlan) -> Vec<String> {
        segments(words, &plan.core, &plan.para_starts)
            .into_iter()
            .map(|segment| {
                markers::sanitize_corrected(&markers::marked_text(&words[segment]))
                    .trim()
                    .to_owned()
            })
            .filter(|text| !text.is_empty())
            .collect()
    }

    fn assert_round_trip(words: &[Word], plan: &PolishPagePlan) -> PolishParsed {
        let rendered = render_polish_page(words, plan);
        let parsed = parse(words, plan, &rendered.text);
        assert!(
            !parsed.diagnostics.has_problems(),
            "unexpected problems: {:?}",
            parsed.diagnostics.problems
        );
        assert_eq!(parsed.paragraphs, expected_paragraphs(words, plan));
        parsed
    }

    #[test]
    fn render_uses_documented_fence_layout() {
        let words = vec![
            word(0, 0.0, 0.5, "hello", "s1"),
            word(1, 0.5, 1.0, "world.", "s1"),
        ];
        let rendered = render_polish_page(&words, &single_page(&words));
        assert_eq!(
            rendered.text,
            format!(
                "{FENCE_CONTEXT_BEFORE}\n{FENCE_EDIT_BEGIN}\nhello world.\n{FENCE_EDIT_END}\n{FENCE_CONTEXT_AFTER}\n"
            )
        );
        assert!(rendered.warnings.is_empty());
    }

    /// Character-exact anchors for paragraphing and marker placement: expected values are not derived back through `segments()`, so that rendering and expectations do not share one implementation and mask regressions.
    #[test]
    fn segments_and_markers_render_verbatim() {
        let words = vec![
            word(0, 0.0, 0.5, "hello", "s1"),
            word(1, 1.7, 2.0, "there.", "s1"),
            word(2, 2.0, 2.5, "yes", "s2"),
            word(3, 2.5, 3.0, "indeed.", "s2"),
        ];
        let plan = single_page(&words);
        let rendered = render_polish_page(&words, &plan);
        assert_eq!(
            rendered.text,
            format!(
                "{FENCE_CONTEXT_BEFORE}\n\
                 {FENCE_EDIT_BEGIN}\n\
                 hello ⏸⏸ there. ⏹S2\n\
                 \n\
                 yes indeed.\n\
                 {FENCE_EDIT_END}\n\
                 {FENCE_CONTEXT_AFTER}\n"
            )
        );

        let parsed = parse(&words, &plan, &rendered.text);
        assert!(!parsed.diagnostics.has_problems());
        assert_eq!(parsed.paragraphs, vec!["hello there.", "yes indeed."]);
        assert_eq!(parsed.forced_boundaries, vec![2]);

        // A pin equal to core.start holds naturally and changes no output.
        let mut pinned = plan.clone();
        pinned.para_starts = vec![0];
        assert_eq!(render_polish_page(&words, &pinned).text, rendered.text);
    }

    #[test]
    fn round_trip_latin_cjk_and_mixed() {
        for texts in [
            vec!["Hello", "there,", "friend."],
            vec!["你", "好", "，", "世", "界", "。"],
            vec!["用", "Agent", "做", "事", "很", "好", "。"],
            vec!["<>&\"", "escaped", "text."],
        ] {
            let words = stream(&texts);
            assert_round_trip(&words, &single_page(&words));
        }
    }

    #[test]
    fn round_trip_empty_paragraph_and_empty_core() {
        let words = stream(&["ok."]);
        let mut plan = single_page(&words);
        plan.core = 0..0;
        plan.before = 0..0;
        plan.after = 0..0;
        let rendered = render_polish_page(&words, &plan);
        let parsed = parse(&words, &plan, &rendered.text);
        assert!(parsed.paragraphs.is_empty());
        assert!(!parsed.diagnostics.has_problems());
    }

    #[test]
    fn round_trip_very_long_sentence() {
        let texts: Vec<&str> = std::iter::repeat_n("word", 900).collect();
        let words = stream(&texts);
        let mut plan = single_page(&words);
        // Pins split into 3×300 words: once the paragraph quality gate landed, only legal segmentations exactly within the per-paragraph cap are answers that round-trip. This test is concerned with the render/parse identity of over-long single-sentence lines.
        plan.para_starts = vec![300, 600];
        assert_round_trip(&words, &plan);
    }

    #[test]
    fn round_trip_with_manual_para_start() {
        let words = stream(&["one.", "two.", "three.", "four."]);
        let mut plan = single_page(&words);
        plan.para_starts = vec![2];
        let parsed = assert_round_trip(&words, &plan);
        assert_eq!(parsed.paragraphs, vec!["one. two.", "three. four."]);
    }

    #[test]
    fn sentinel_literal_in_source_is_neutralized() {
        let words = stream(&[FENCE_EDIT_END, "trailing."]);
        let plan = single_page(&words);
        let rendered = render_polish_page(&words, &plan);
        assert!(
            rendered
                .text
                .contains(&format!(" {FENCE_EDIT_END} trailing."))
        );
        assert_eq!(rendered.warnings.len(), 1);
        assert_eq!(rendered.warnings[0].code, WarningCode::SentinelNeutralized);
        assert_round_trip(&words, &plan);
    }

    #[test]
    fn plan_splits_at_speaker_change_without_hard_cut() {
        let mut words = stream(&["a", "b", "c", "d", "e", "f"]);
        for word in words.iter_mut().skip(3) {
            word.sp = "s2".to_owned();
        }
        let budget = PolishBudget {
            core_words: 4,
            context_words: 4,
            context_sentences: 1,
            overflow_ratio: 0.15,
        };
        let plans = plan_polish_pages(&words, &budget);
        assert_eq!(plans.len(), 2);
        assert_eq!(plans[0].core, 0..3);
        assert_eq!(plans[1].core, 3..6);
        assert!(!plans[0].hard_cut_end);
        assert!(!plans[1].hard_cut_start);
        // A page seam that is a speaker change → the boundary belongs to the later page.
        assert!(forced_boundaries(&words, &plans[1]).contains(&3));
        assert!(!forced_boundaries(&words, &plans[0]).contains(&3));
    }

    #[test]
    fn plan_stronger_rank_cannot_veto_a_much_later_breakpoint() {
        // Window: an early pause (rank 2) and a late sentence end (rank 1). Under joint scoring each rank step is worth only 5% of the page target in advance, so it should choose the sentence end at word 48, not the pause at word 42.
        let mut words = stream(&vec!["aaaa"; 100]);
        words[42].t0 = 21.6; // 0.7s pause (rank 2) between words 41 and 42
        words[47].text = "aaaa.".to_owned(); // Sentence end (rank 1) between words 47 and 48
        let budget = PolishBudget {
            core_words: 90,
            context_words: 3,
            context_sentences: 1,
            overflow_ratio: 0.15,
        };
        let plans = plan_polish_pages(&words, &budget);
        assert_eq!(plans.len(), 2);
        assert_eq!(plans[0].core, 0..48);
        assert_eq!(plans[1].core, 48..100);
    }

    #[test]
    fn plan_falls_back_to_hard_cut() {
        let words = stream(&["a", "b", "c", "d", "e", "f", "g", "h"]);
        let budget = PolishBudget {
            core_words: 3,
            context_words: 3,
            context_sentences: 1,
            overflow_ratio: 0.15,
        };
        let plans = plan_polish_pages(&words, &budget);
        assert!(plans.len() >= 2);
        assert!(plans[0].hard_cut_end);
        assert!(plans[1].hard_cut_start);
        assert!(forced_boundaries(&words, &plans[1]).is_empty());
        let rendered = render_polish_page(&words, &plans[0]);
        assert!(rendered.text.contains(MARKER_HARD_CUT));
    }

    #[test]
    fn plan_never_stalls_on_tiny_budget() {
        let words = stream(&["a", "b", "c", "d", "e"]);
        let budget = PolishBudget {
            core_words: 1,
            context_words: 1,
            context_sentences: 1,
            overflow_ratio: 0.0,
        };
        let plans = plan_polish_pages(&words, &budget);
        assert!(!plans.is_empty());
        let mut cursor = 0;
        for plan in &plans {
            assert_eq!(plan.core.start, cursor);
            assert!(plan.core.end > plan.core.start);
            cursor = plan.core.end;
        }
        assert_eq!(cursor, words.len());
    }

    #[test]
    fn plan_context_regions_hold_complete_sentences() {
        let words = stream(&["a.", "b.", "c.", "d.", "e.", "f.", "g.", "h."]);
        let budget = PolishBudget {
            core_words: 4,
            context_words: 200,
            context_sentences: 2,
            overflow_ratio: 0.15,
        };
        let plans = plan_polish_pages(&words, &budget);
        assert_eq!(plans.len(), 2);
        assert!(plans[0].before.is_empty());
        assert_eq!(plans[0].after, 4..6);
        assert_eq!(plans[1].before, 2..4);
        assert!(plans[1].after.is_empty());
        assert_round_trip(&words, &plans[0]);
        assert_round_trip(&words, &plans[1]);
    }

    /// Regression lock: the pagination baseline for a single `sp` throughout (no speaker information).
    ///
    /// From 2026-08 on, the no-speaker path is also **sentence-boundary-first**, like the interior of long turns: when the window contains a sentence-final mark,
    /// pages are not cut at a pause. (The earlier baseline `(0,55)…` had page seams at 55 and 165 falling on mid-sentence pauses.) Every page seam must fall at a sentence end, and the expected values must not be refreshed again.
    #[test]
    fn plan_pages_without_speakers_match_the_pre_turn_baseline() {
        let mut rng = Lcg(0xB40C_0757_0004_0001);
        let mut words: Vec<Word> = Vec::new();
        let mut clock = 0.0_f64;
        for index in 0..400 {
            let text = if rng.below(100) < 15 { "aaaa." } else { "aaaa" };
            let gap = if rng.below(100) < 10 { 0.9 } else { 0.05 };
            clock += gap;
            words.push(word(index, clock, clock + 0.4, text, "s1"));
            clock += 0.4;
        }
        let budget = PolishBudget {
            core_words: 60,
            context_words: 20,
            context_sentences: 2,
            overflow_ratio: 0.15,
        };
        let plans: Vec<(usize, usize, bool, bool)> = plan_polish_pages(&words, &budget)
            .iter()
            .map(|plan| {
                (
                    plan.core.start,
                    plan.core.end,
                    plan.hard_cut_start,
                    plan.hard_cut_end,
                )
            })
            .collect();
        assert_eq!(
            plans,
            vec![
                (0, 50, false, false),
                (50, 107, false, false),
                (107, 166, false, false),
                (166, 222, false, false),
                (222, 276, false, false),
                (276, 336, false, false),
                (336, 400, false, false),
            ]
        );
        for (_, end, _, _) in &plans[..plans.len() - 1] {
            assert!(
                sentence_end(&words[end - 1].text),
                "页缝 {end} 落在句中：{}",
                words[end - 1].text
            );
        }
    }

    /// Sentence-boundary priority on the no-speaker path: a later pause (rank 2) in the window no longer outscores an earlier sentence end (rank 1); fall back to pauses only when neither the window nor the overflow zone has a sentence end.
    #[test]
    fn plan_without_speakers_prefers_sentence_end_over_a_later_pause() {
        // 60-word budget → window [48, 60). Sentence end after word 50, a 0.9s pause after word 57 (mid-sentence).
        let mut words: Vec<Word> = Vec::new();
        let mut clock = 0.0_f64;
        for index in 0..120 {
            let text = if index == 49 || index == 90 {
                "aaaa."
            } else {
                "aaaa"
            };
            let gap = if index == 58 { 0.9 } else { 0.05 };
            clock += gap;
            words.push(word(index, clock, clock + 0.4, text, "s1"));
            clock += 0.4;
        }
        let budget = PolishBudget {
            core_words: 60,
            context_words: 20,
            context_sentences: 2,
            overflow_ratio: 0.15,
        };
        let plans = plan_polish_pages(&words, &budget);
        assert_eq!(plans[0].core.end, 50, "should cut the page at the sentence end, not at a later mid-sentence pause");
        assert!(!plans[0].hard_cut_end);
        // Move the sentence end out of the window and overflow zone: only pauses are left, so it falls back to a pause breakpoint.
        for w in words.iter_mut() {
            if w.text == "aaaa." {
                w.text = "aaaa".to_owned();
            }
        }
        let plans = plan_polish_pages(&words, &budget);
        assert_eq!(plans[0].core.end, 58);
        assert!(!plans[0].hard_cut_end);
    }

    /// Word-by-word speaker assignment for a densely packed word stream (0.1s between words, so it produces no pause breakpoints).
    fn voices(entries: &[(&str, &str)]) -> Vec<Word> {
        entries
            .iter()
            .enumerate()
            .map(|(index, (sp, text))| {
                let t0 = index as f64 * 0.5;
                word(index, t0, t0 + 0.4, text, sp)
            })
            .collect()
    }

    /// Shared assertions for turn-aware pagination: page boundaries fall only on turn boundaries, or on sentence boundaries inside a long turn that **individually exceeds the budget**; the pages cover the whole text continuously.
    fn assert_turn_aware_pages(words: &[Word], budget: &PolishBudget) -> Vec<PolishPagePlan> {
        let plans = plan_polish_pages(words, budget);
        let turns = speaker_turns(words);
        let starts: Vec<usize> = turns.iter().map(|turn| turn.start).collect();
        assert!(plans.len() > 1, "the case should split into multiple pages");
        assert_eq!(plans.first().unwrap().core.start, 0);
        assert_eq!(plans.last().unwrap().core.end, words.len());
        for pair in plans.windows(2) {
            assert_eq!(pair[0].core.end, pair[1].core.start);
        }
        for plan in &plans {
            let cut = plan.core.end;
            if cut == words.len() || starts.contains(&cut) {
                continue;
            }
            let turn = turns
                .iter()
                .find(|turn| turn.contains(&cut))
                .expect("a page boundary must fall inside some turn");
            assert!(
                turn.len() > budget.core_words,
                "a page seam split a turn that is within budget (cut {cut}, turn {turn:?})"
            );
            assert!(
                sentence_end(&words[cut - 1].text),
                "a page seam inside a long turn does not fall on a sentence boundary (cut {cut})"
            );
            assert!(!plan.hard_cut_end, "a sentence-boundary page seam must not be recorded as a hard cut");
        }
        plans
    }

    /// Short-turn dialogue: a page is a union of consecutive whole turns, and every page boundary is a turn start.
    #[test]
    fn turn_paging_groups_short_dialogue_turns() {
        let entries: Vec<(String, String)> = (0..36)
            .map(|index| {
                let speaker = if (index / 3) % 2 == 0 { "s1" } else { "s2" };
                let text = if index % 3 == 2 { "aaaa." } else { "aaaa" };
                (speaker.to_owned(), text.to_owned())
            })
            .collect();
        let entries: Vec<(&str, &str)> = entries
            .iter()
            .map(|(sp, text)| (sp.as_str(), text.as_str()))
            .collect();
        let words = voices(&entries);
        let budget = PolishBudget {
            core_words: 9,
            context_words: 20,
            context_sentences: 2,
            overflow_ratio: 0.15,
        };
        let plans = assert_turn_aware_pages(&words, &budget);
        // 12 three-word turns → 3 whole turns per page.
        assert_eq!(
            plans
                .iter()
                .map(|plan| (plan.core.start, plan.core.end))
                .collect::<Vec<_>>(),
            vec![(0, 9), (9, 18), (18, 27), (27, 36)]
        );
        assert!(plans.iter().all(|plan| !plan.hard_cut_end));
    }

    /// Long monologue: a turn alone exceeds the budget, so it is split at sentence boundaries internally; a later pause does not steal the page boundary.
    #[test]
    fn turn_paging_splits_a_long_monologue_at_sentence_ends() {
        let mut entries: Vec<(String, String)> = Vec::new();
        for _ in 0..3 {
            entries.push(("s1".to_owned(), "aaaa".to_owned()));
        }
        for index in 0..60 {
            // One sentence-final mark every 6 words.
            let text = if index % 6 == 5 { "aaaa." } else { "aaaa" };
            entries.push(("s2".to_owned(), text.to_owned()));
        }
        for _ in 0..3 {
            entries.push(("s1".to_owned(), "aaaa".to_owned()));
        }
        let entries: Vec<(&str, &str)> = entries
            .iter()
            .map(|(sp, text)| (sp.as_str(), text.as_str()))
            .collect();
        let mut words = voices(&entries);
        // Insert a long pause at the tail of the first page's window (rank 2, later than the sentence boundary within the window, and scoring higher). Pure rank-based joint scoring would choose it, but sentence-boundary priority within the turn would not.
        for word in words.iter_mut().skip(17) {
            word.t0 += 1.2;
            word.t1 += 1.2;
        }
        let budget = PolishBudget {
            core_words: 16,
            context_words: 20,
            context_sentences: 2,
            overflow_ratio: 0.15,
        };
        let plans = assert_turn_aware_pages(&words, &budget);
        let cuts: Vec<usize> = plans.iter().map(|plan| plan.core.end).collect();
        assert!(
            !cuts.contains(&3),
            "a 3-word short turn does not reach the window's lower bound and should not take a page alone: {cuts:?}"
        );
        assert!(cuts.contains(&15), "the first page of a long turn should break at sentence boundary 15: {cuts:?}");
        assert!(!cuts.contains(&17), "a pause must not take over a sentence boundary inside a long turn: {cuts:?}");
        assert!(
            cuts.iter()
                .filter(|cut| (4..63).contains(*cut))
                .all(|cut| words[cut - 1].text.ends_with('.')),
            "page boundaries inside a long turn must be sentence boundaries: {cuts:?}"
        );

        // Control group: the same word stream with speaker information stripped takes the word-stream path. From 2026-08 both paths likewise use sentence-boundary priority, so a pause (rank 2) no longer steals sentence boundary 15 within the window.
        let flat: Vec<Word> = words
            .iter()
            .cloned()
            .map(|mut word| {
                word.sp = "s1".to_owned();
                word
            })
            .collect();
        let flat_cuts: Vec<usize> = plan_polish_pages(&flat, &budget)
            .iter()
            .map(|plan| plan.core.end)
            .collect();
        assert!(
            !flat_cuts.contains(&17) && flat_cuts.contains(&15),
            "the no-speaker path also prefers sentence boundaries and should not cut pages at mid-sentence pauses: {flat_cuts:?}"
        );
    }

    /// A “um” followed by a long monologue: no page is opened for this short turn; the page boundary instead falls at a sentence boundary inside the long turn (this page = the short turn + the head of the long turn).
    #[test]
    fn turn_paging_does_not_waste_a_page_on_a_one_word_interjection() {
        let mut entries: Vec<(String, String)> = vec![("s1".to_owned(), "yeah".to_owned())];
        for index in 0..60 {
            let text = if index % 5 == 4 { "aaaa." } else { "aaaa" };
            entries.push(("s2".to_owned(), text.to_owned()));
        }
        let entries: Vec<(&str, &str)> = entries
            .iter()
            .map(|(sp, text)| (sp.as_str(), text.as_str()))
            .collect();
        let words = voices(&entries);
        let budget = PolishBudget {
            core_words: 15,
            context_words: 20,
            context_sentences: 2,
            overflow_ratio: 0.15,
        };
        let plans = assert_turn_aware_pages(&words, &budget);
        assert!(
            plans.iter().all(|plan| plan.core.len() > 1),
            "短轮次不该独占一页: {:?}",
            plans
                .iter()
                .map(|plan| plan.core.clone())
                .collect::<Vec<_>>()
        );
    }

    /// Mixed: short turns grouped together plus sentence-boundary splits inside long turns, with both kinds of page boundary coexisting.
    #[test]
    fn turn_paging_mixes_grouped_turns_and_a_split_long_turn() {
        let mut entries: Vec<(String, String)> = Vec::new();
        for turn in 0..6 {
            let speaker = if turn % 2 == 0 { "s1" } else { "s2" };
            for index in 0..4 {
                let text = if index == 3 { "aaaa." } else { "aaaa" };
                entries.push((speaker.to_owned(), text.to_owned()));
            }
        }
        for index in 0..40 {
            let text = if index % 5 == 4 { "aaaa." } else { "aaaa" };
            entries.push(("s3".to_owned(), text.to_owned()));
        }
        for index in 0..4 {
            let text = if index == 3 { "aaaa." } else { "aaaa" };
            entries.push(("s1".to_owned(), text.to_owned()));
        }
        let entries: Vec<(&str, &str)> = entries
            .iter()
            .map(|(sp, text)| (sp.as_str(), text.as_str()))
            .collect();
        let words = voices(&entries);
        let budget = PolishBudget {
            core_words: 12,
            context_words: 20,
            context_sentences: 2,
            overflow_ratio: 0.15,
        };
        let plans = assert_turn_aware_pages(&words, &budget);
        let starts: Vec<usize> = speaker_turns(&words)
            .iter()
            .map(|turn| turn.start)
            .collect();
        let cuts: Vec<usize> = plans
            .iter()
            .map(|plan| plan.core.end)
            .filter(|cut| *cut < words.len())
            .collect();
        assert!(
            cuts.iter().any(|cut| starts.contains(cut)),
            "there should be page boundaries on turn boundaries: {cuts:?}"
        );
        assert!(
            cuts.iter().any(|cut| !starts.contains(cut)),
            "long turns should be cut internally: {cuts:?}"
        );
    }

    /// `⏹S2` exists only in the payload: even if the model copies it back, it is stripped, and the label does not enter the paragraph text.
    #[test]
    fn speaker_label_lives_only_in_the_payload() {
        let mut words = stream(&["hello", "there.", "yes", "indeed."]);
        words[2].sp = "s2".to_owned();
        words[3].sp = "s2".to_owned();
        let plan = single_page(&words);
        let rendered = render_polish_page(&words, &plan);
        assert!(
            rendered.text.contains("hello there. ⏹S2"),
            "{}",
            rendered.text
        );

        for echoed in ["⏹S2", "⏹"] {
            let output = format!(
                "{FENCE_CONTEXT_BEFORE}\n{FENCE_EDIT_BEGIN}\nhello there. {echoed} yes indeed.\n{FENCE_EDIT_END}\n{FENCE_CONTEXT_AFTER}\n"
            );
            let parsed = parse(&words, &plan, &output);
            assert!(!parsed.diagnostics.has_problems(), "{echoed}");
            // After stripping markers, the text is still verbatim → the ⏹ hard guarantee is placed in situ.
            assert_eq!(parsed.paragraphs, vec!["hello there.", "yes indeed."]);
            assert!(
                parsed
                    .paragraphs
                    .iter()
                    .all(|text| !text.contains('S') && !text.contains(markers::SPEAKER_MARKER)),
                "标签泄漏进输出: {:?}",
                parsed.paragraphs
            );
            assert!(
                parsed
                    .diagnostics
                    .warnings
                    .iter()
                    .any(|warning| warning.code == WarningCode::MarkerResidue),
                "{echoed}"
            );
        }
    }

    /// Paragraph aggregation does not cross turns: each turn forms its own body block, and the ⏹ hard-guarantee table is exactly the turn starts.
    #[test]
    fn paragraph_blocks_never_span_a_speaker_turn() {
        let mut words = stream(&["a.", "b.", "c.", "d.", "e."]);
        words[1].sp = "s2".to_owned();
        words[2].sp = "s2".to_owned();
        words[4].sp = "s3".to_owned();
        let plan = single_page(&words);
        let parsed = assert_round_trip(&words, &plan);
        assert_eq!(parsed.paragraphs, vec!["a.", "b. c.", "d.", "e."]);
        assert_eq!(parsed.forced_boundaries, vec![1, 3, 4]);
        let rendered = render_polish_page(&words, &plan).text;
        assert!(rendered.contains("a. ⏹S2"), "{rendered}");
        assert!(rendered.contains("d. ⏹S3"), "{rendered}");
    }

    #[test]
    fn multi_page_round_trip_keeps_context_readonly() {
        let mut words = stream(&["a.", "b.", "c.", "d.", "e.", "f."]);
        words[3].sp = "s2".to_owned();
        words[4].sp = "s2".to_owned();
        words[5].sp = "s2".to_owned();
        let budget = PolishBudget {
            core_words: 3,
            context_words: 10,
            context_sentences: 1,
            overflow_ratio: 0.15,
        };
        for plan in plan_polish_pages(&words, &budget) {
            assert_round_trip(&words, &plan);
        }
    }

    #[test]
    fn speaker_boundary_is_forced_back_when_model_drops_blank_line() {
        let mut words = stream(&["hello", "there.", "yes", "indeed."]);
        words[2].sp = "s2".to_owned();
        words[3].sp = "s2".to_owned();
        let plan = single_page(&words);
        let output = format!(
            "{FENCE_CONTEXT_BEFORE}\n{FENCE_EDIT_BEGIN}\nhello there. yes indeed.\n{FENCE_EDIT_END}\n{FENCE_CONTEXT_AFTER}\n"
        );
        let parsed = parse(&words, &plan, &output);
        assert!(!parsed.diagnostics.has_problems());
        assert_eq!(parsed.forced_boundaries, vec![2]);
        assert_eq!(parsed.paragraphs, vec!["hello there.", "yes indeed."]);
        assert!(
            parsed
                .diagnostics
                .warnings
                .iter()
                .any(|w| w.code == WarningCode::BoundaryForced)
        );
    }

    /// §2.2 fence recovery: measured, among 7 "sentinel fence missing" cases, 5 were only a missing `<<<EDIT-END>>>` while `<<<CONTEXT-AFTER>>>` was still there. The core region was complete, and three whole-page retry rounds merely re-rolled the same answer. Now boundaries are inferred from adjacent fences and a warning is recorded.
    #[test]
    fn missing_edit_end_fence_is_recovered_from_context_after() {
        let words = stream(&["a.", "b."]);
        let plan = single_page(&words);
        let output =
            format!("{FENCE_CONTEXT_BEFORE}\n{FENCE_EDIT_BEGIN}\na. b.\n{FENCE_CONTEXT_AFTER}\n");
        let parsed = parse(&words, &plan, &output);
        assert!(
            !parsed.diagnostics.has_problems(),
            "{:?}",
            parsed.diagnostics
        );
        assert_eq!(parsed.paragraphs, vec!["a. b.".to_owned()]);
        assert!(
            parsed
                .diagnostics
                .warnings
                .iter()
                .any(|w| w.code == WarningCode::FenceRecovered)
        );
    }

    /// A missing `<<<CONTEXT-AFTER>>>` (the last page has no read-only trailing context anyway) is also recoverable.
    #[test]
    fn missing_context_after_fence_is_recovered_from_edit_end() {
        let words = stream(&["a.", "b."]);
        let plan = single_page(&words);
        let output =
            format!("{FENCE_CONTEXT_BEFORE}\n{FENCE_EDIT_BEGIN}\na. b.\n{FENCE_EDIT_END}\n");
        let parsed = parse(&words, &plan, &output);
        assert!(
            !parsed.diagnostics.has_problems(),
            "{:?}",
            parsed.diagnostics
        );
        assert_eq!(parsed.paragraphs, vec!["a. b.".to_owned()]);
    }

    /// Indented `<<<EDIT-BEGIN>>>`: the core region's start is inferred by stripping the read-only leading region that follows `CONTEXT-BEFORE`; the misplaced fence line itself is ignored as a structure line.
    #[test]
    fn indented_edit_begin_fence_is_recovered() {
        let words = stream(&["a.", "b."]);
        let plan = single_page(&words);
        let output = format!(
            "{FENCE_CONTEXT_BEFORE}\n  {FENCE_EDIT_BEGIN}\na. b.\n{FENCE_EDIT_END}\n{FENCE_CONTEXT_AFTER}\n"
        );
        let parsed = parse(&words, &plan, &output);
        assert!(
            !parsed.diagnostics.has_problems(),
            "{:?}",
            parsed.diagnostics
        );
        assert_eq!(parsed.paragraphs, vec!["a. b.".to_owned()]);
    }

    /// Both EDIT fences missing and the read-only fences cannot infer the core region ⇒ still page-fatal.
    #[test]
    fn structureless_answer_still_reports_document_truncated() {
        let words = stream(&["a.", "b."]);
        let plan = single_page(&words);
        let parsed = parse(&words, &plan, "a. b.\n");
        assert!(parsed.diagnostics.has_code(ProblemCode::DocumentTruncated));
        assert!(parsed.paragraphs.is_empty());
    }

    /// When fences are out of order, recover by the "first legal order seen"; if the recovered core region is empty it is still page-fatal (an empty core region means the body text is lost).
    #[test]
    fn out_of_order_fences_report_document_truncated() {
        let words = stream(&["a.", "b."]);
        let plan = single_page(&words);
        let output = format!(
            "{FENCE_CONTEXT_BEFORE}\n{FENCE_EDIT_END}\na. b.\n{FENCE_EDIT_BEGIN}\n{FENCE_CONTEXT_AFTER}\n"
        );
        let parsed = parse(&words, &plan, &output);
        assert!(parsed.diagnostics.has_code(ProblemCode::DocumentTruncated));
    }

    /// §2.2: a rewritten read-only region no longer rejects the page. The read-only region is never written back to truth, and the core region has its own word-stream truth gate.
    #[test]
    fn modified_readonly_context_is_only_a_warning() {
        let words = stream(&["a.", "b.", "c.", "d.", "e.", "f.", "g.", "h."]);
        let budget = PolishBudget {
            core_words: 4,
            context_words: 200,
            context_sentences: 2,
            overflow_ratio: 0.15,
        };
        let plans = plan_polish_pages(&words, &budget);
        let plan = &plans[1];
        let rendered = render_polish_page(&words, plan);
        let tampered = rendered.text.replacen("c. d.", "c. changed.", 1);
        assert_ne!(tampered, rendered.text);
        let parsed = parse(&words, plan, &tampered);
        assert!(
            !parsed.diagnostics.has_code(ProblemCode::SourceDrift),
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
        assert!(!parsed.paragraphs.is_empty());
    }

    #[test]
    fn mojibake_control_bytes_in_polish_answer_are_rejected() {
        let words = stream(&["你好。"]);
        let plan = single_page(&words);
        let rendered = render_polish_page(&words, &plan);
        let tampered = rendered.text.replace("你好。", "你好ã\u{80}\u{82}");

        let parsed = parse(&words, &plan, &tampered);

        assert!(parsed.diagnostics.has_code(ProblemCode::SourceDrift));
        assert!(
            parsed
                .diagnostics
                .problems
                .iter()
                .any(|problem| problem.detail.contains("UTF-8 mojibake"))
        );
    }

    /// §2.2: dangling false sentence endings no longer reject the page; instead a `surface-artifact` warning is recorded per paragraph, and once the engine maps them into sentences, they are sent to the sentence-level follow-up queue of `polish-retry`.
    #[test]
    fn dangling_sentence_end_becomes_a_surface_artifact_warning() {
        let words = stream(&["就是说当。", "你的 group 数目越多，效果越明显。"]);
        let plan = single_page(&words);
        let rendered = render_polish_page(&words, &plan);

        let parsed = parse(&words, &plan, &rendered.text);

        assert!(
            !parsed.diagnostics.has_problems(),
            "{:?}",
            parsed.diagnostics
        );
        assert!(parsed.diagnostics.warnings.iter().any(|warning| {
            warning.code == WarningCode::SurfaceArtifact
                && warning.detail.contains("dangling connector/preposition")
                && warning.detail.contains("remove that false sentence end")
        }));
    }

    /// §2.2: conflicting adjacent punctuation is normalized in code (R2), and glued Latin strings only record a warning. Neither lets one sentence's surface blemish reject the whole page.
    #[test]
    fn conflicting_punctuation_is_repaired_and_collapsed_latin_only_warns() {
        let words = stream(&["所以他说。，呃 purereinforcementlearning 很重要。"]);
        let plan = single_page(&words);
        let rendered = render_polish_page(&words, &plan);

        let parsed = parse(&words, &plan, &rendered.text);

        assert!(
            !parsed.diagnostics.has_problems(),
            "{:?}",
            parsed.diagnostics
        );
        assert!(
            parsed
                .paragraphs
                .iter()
                .all(|paragraph| { !crate::seam::contains_conflicting_punctuation(paragraph) }),
            "{:?}",
            parsed.paragraphs
        );
        assert!(
            parsed
                .diagnostics
                .warnings
                .iter()
                .any(|w| w.code == WarningCode::PunctuationNormalized)
        );
        assert!(parsed.diagnostics.warnings.iter().any(|warning| {
            warning.code == WarningCode::SurfaceArtifact
                && warning.detail.contains("run-together Latin phrase")
                && warning.detail.contains("word boundaries with spaces")
        }));
    }

    /// Measured regression (deepseek-v4-flash): the model incidentally fixed ASR errors in the read-only region ("RL don"→"RL'd on", "the the"→"the"). Surface-level rewriting no longer rejects the page: the read-only region is never part of the body anyway, and the core region has its own word-stream truth gate.
    #[test]
    fn cosmetic_readonly_drift_is_ignored_with_a_warning() {
        let words = stream(&[
            "models",
            "have",
            "been",
            "RL",
            "don,",
            "and",
            "the",
            "the",
            "models",
            "work.",
            "Second",
            "sentence",
            "of",
            "context",
            "stays",
            "here",
            "unchanged",
            "today.",
            "Core",
            "region",
            "starts",
            "here",
            "and",
            "keeps",
            "going",
            "fine.",
            "More",
            "core",
            "words",
            "fill",
            "the",
            "budget",
            "till",
            "the",
            "end.",
        ]);
        let budget = PolishBudget {
            core_words: 17,
            context_words: 200,
            context_sentences: 2,
            overflow_ratio: 0.15,
        };
        let plans = plan_polish_pages(&words, &budget);
        let plan = plans.last().unwrap();
        let rendered = render_polish_page(&words, plan);
        assert!(rendered.text.contains("RL don,"), "precondition: the read-only context contains the typo");
        let tampered = rendered.text.replacen("RL don,", "RL'd on,", 1).replacen(
            "the the models",
            "the models",
            1,
        );
        assert_ne!(tampered, rendered.text);
        let parsed = parse(&words, plan, &tampered);
        assert!(
            !parsed.diagnostics.has_code(ProblemCode::SourceDrift),
            "a surface-level read-only zone rewrite must not reject the page: {:?}",
            parsed.diagnostics.problems
        );
        assert!(
            parsed
                .diagnostics
                .warnings
                .iter()
                .any(|w| w.code == WarningCode::ContentIgnored && w.detail.contains("read-only context-before zone")),
            "expected a ContentIgnored warning: {:?}",
            parsed.diagnostics.warnings
        );
        assert!(!parsed.paragraphs.is_empty(), "the core region is still parsed as usual");
    }

    /// §2.2: a truncated read-only region (a whole sentence disappeared) likewise only records a warning. The read-only region is never written back to truth, and the truncation does not affect this page's body. The old implementation rejected the page here and re-rolled all sentences.
    #[test]
    fn truncated_readonly_context_is_only_a_warning() {
        let words = stream(&[
            "models",
            "have",
            "been",
            "RL",
            "don,",
            "and",
            "the",
            "the",
            "models",
            "work.",
            "Second",
            "sentence",
            "of",
            "context",
            "stays",
            "here",
            "unchanged",
            "today.",
            "Core",
            "region",
            "starts",
            "here",
            "and",
            "keeps",
            "going",
            "fine.",
            "More",
            "core",
            "words",
            "fill",
            "the",
            "budget",
            "till",
            "the",
            "end.",
        ]);
        let budget = PolishBudget {
            core_words: 17,
            context_words: 200,
            context_sentences: 2,
            overflow_ratio: 0.15,
        };
        let plans = plan_polish_pages(&words, &budget);
        let plan = plans.last().unwrap();
        let rendered = render_polish_page(&words, plan);
        let truncated = rendered.text.replacen(
            "Second sentence of context stays here unchanged today.",
            "",
            1,
        );
        assert_ne!(truncated, rendered.text);
        let parsed = parse(&words, plan, &truncated);
        assert!(
            !parsed.diagnostics.has_code(ProblemCode::SourceDrift),
            "{:?}",
            parsed.diagnostics
        );
        assert!(parsed.diagnostics.warnings.iter().any(|warning| {
            warning.code == WarningCode::ContentIgnored && warning.detail.contains("was rewritten or truncated")
        }));
        assert!(!parsed.paragraphs.is_empty(), "the core region is still parsed as usual");
    }

    #[test]
    fn oversize_output_is_guarded() {
        let words = stream(&["a.", "b."]);
        let plan = single_page(&words);
        let bloat: String = std::iter::repeat_n('x', 6000).collect();
        let output = format!(
            "{FENCE_CONTEXT_BEFORE}\n{FENCE_EDIT_BEGIN}\n{bloat}\n{FENCE_EDIT_END}\n{FENCE_CONTEXT_AFTER}\n"
        );
        let parsed = parse(&words, &plan, &output);
        assert!(parsed.diagnostics.has_code(ProblemCode::DocumentOversize));
    }

    #[test]
    fn clean_code_fence_is_free_but_stray_fence_is_wrapped() {
        let words = stream(&["a.", "b."]);
        let plan = single_page(&words);
        let body = render_polish_page(&words, &plan).text;

        let wrapped = format!("```\n{body}```\n");
        let parsed = parse(&words, &plan, &wrapped);
        assert!(!parsed.diagnostics.has_problems());
        assert!(
            parsed
                .diagnostics
                .warnings
                .iter()
                .any(|w| w.code == WarningCode::WrapperStripped)
        );

        let stray = format!("```text\n{body}");
        let parsed = parse(&words, &plan, &stray);
        assert!(parsed.diagnostics.has_code(ProblemCode::DocumentWrapped));
    }

    #[test]
    fn chatter_outside_fences_is_wrapped_and_ignored() {
        let words = stream(&["a.", "b."]);
        let plan = single_page(&words);
        let output = format!(
            "好的，这是修订后的文本：\n{}",
            render_polish_page(&words, &plan).text
        );
        let parsed = parse(&words, &plan, &output);
        assert!(parsed.diagnostics.has_code(ProblemCode::DocumentWrapped));
        assert!(
            parsed
                .diagnostics
                .warnings
                .iter()
                .any(|w| w.code == WarningCode::ContentIgnored)
        );
        assert_eq!(parsed.paragraphs, vec!["a. b."]);
    }

    #[test]
    fn blank_line_runs_collapse_and_soft_wrap_joins() {
        let words = stream(&["a.", "b.", "c.", "d."]);
        let plan = single_page(&words);
        let output = format!(
            "{FENCE_CONTEXT_BEFORE}\n{FENCE_EDIT_BEGIN}\na.\nb.\n\n\n\nc. d.\n{FENCE_EDIT_END}\n{FENCE_CONTEXT_AFTER}\n"
        );
        let parsed = parse(&words, &plan, &output);
        assert_eq!(parsed.paragraphs, vec!["a. b.", "c. d."]);
        assert!(
            parsed
                .diagnostics
                .warnings
                .iter()
                .any(|w| w.code == WarningCode::BlankLinesCollapsed)
        );
    }

    /// Explicit page-seam signal: blank lines before the core region's body produce no paragraph and do not record BlankLinesCollapsed; they only set `starts_new_paragraph`. Without a leading blank line this is false.
    #[test]
    fn leading_blank_line_is_the_new_paragraph_signal() {
        let words = stream(&["a.", "b.", "c."]);
        let plan = single_page(&words);
        let output = format!(
            "{FENCE_CONTEXT_BEFORE}\n{FENCE_EDIT_BEGIN}\n\na. b.\n\nc.\n{FENCE_EDIT_END}\n{FENCE_CONTEXT_AFTER}\n"
        );
        let parsed = parse(&words, &plan, &output);
        assert!(parsed.starts_new_paragraph);
        assert_eq!(parsed.paragraphs, vec!["a. b.", "c."]);
        assert!(parsed.diagnostics.problems.is_empty());
        assert!(
            !parsed
                .diagnostics
                .warnings
                .iter()
                .any(|w| w.code == WarningCode::BlankLinesCollapsed)
        );
        let plain = format!(
            "{FENCE_CONTEXT_BEFORE}\n{FENCE_EDIT_BEGIN}\na. b.\n\nc.\n{FENCE_EDIT_END}\n{FENCE_CONTEXT_AFTER}\n"
        );
        assert!(!parse(&words, &plan, &plain).starts_new_paragraph);
    }

    #[test]
    fn marker_residue_is_stripped_and_reported() {
        let words = stream(&["a.", "b."]);
        let plan = single_page(&words);
        let output = format!(
            "{FENCE_CONTEXT_BEFORE}\n{FENCE_EDIT_BEGIN}\na. ⏸⏸ b. ⏹\n{FENCE_EDIT_END}\n{FENCE_CONTEXT_AFTER}\n"
        );
        let parsed = parse(&words, &plan, &output);
        assert_eq!(parsed.paragraphs, vec!["a. b."]);
        assert!(
            parsed
                .diagnostics
                .warnings
                .iter()
                .any(|w| w.code == WarningCode::MarkerResidue)
        );
    }

    #[test]
    fn empty_core_against_nonempty_source_is_truncated() {
        let words = stream(&["a.", "b."]);
        let plan = single_page(&words);
        let output = format!(
            "{FENCE_CONTEXT_BEFORE}\n{FENCE_EDIT_BEGIN}\n\n{FENCE_EDIT_END}\n{FENCE_CONTEXT_AFTER}\n"
        );
        let parsed = parse(&words, &plan, &output);
        assert!(parsed.diagnostics.has_code(ProblemCode::DocumentTruncated));
    }

    /// Fixed-seed LCG (unseeded randomness is forbidden).
    struct Lcg(u64);

    impl Lcg {
        fn next(&mut self) -> u64 {
            self.0 = self
                .0
                .wrapping_mul(6364136223846793005)
                .wrapping_add(1442695040888963407);
            self.0 >> 33
        }

        fn below(&mut self, bound: u64) -> usize {
            (self.next() % bound) as usize
        }
    }

    const VOCAB: [&str; 10] = [
        "hello",
        "world,",
        "你",
        "好。",
        "Agent",
        "做事",
        "end.",
        "<>&\"",
        "<<<EDIT-END>>>",
        "fine",
    ];

    #[test]
    fn property_render_parse_round_trip_is_identity() {
        let mut rng = Lcg(0x5EED_1234_ABCD_0001);
        for case in 0..40 {
            let count = 5 + rng.below(45);
            let mut words = Vec::with_capacity(count);
            let mut clock = 0.0f64;
            let mut speaker = 1u32;
            for index in 0..count {
                let gap = (rng.below(30) as f64) / 10.0;
                clock += gap;
                let t0 = clock;
                clock += 0.3;
                if rng.below(6) == 0 {
                    speaker += 1;
                }
                words.push(word(
                    index,
                    t0,
                    clock,
                    VOCAB[rng.below(VOCAB.len() as u64)],
                    &format!("s{speaker}"),
                ));
            }
            let budget = PolishBudget {
                core_words: 6 + rng.below(10),
                context_words: 20,
                context_sentences: 2,
                overflow_ratio: 0.15,
            };
            let plans = plan_polish_pages(&words, &budget);
            assert!(!plans.is_empty(), "case {case} produced no pages");
            let mut cursor = 0;
            for plan in &plans {
                assert_eq!(
                    plan.core.start, cursor,
                    "case {case} page {} 不连续",
                    plan.id
                );
                cursor = plan.core.end;
                assert_round_trip(&words, plan);
            }
            assert_eq!(cursor, words.len(), "case {case} does not cover all words");
        }
    }

    #[test]
    fn parse_never_panics_on_malformed_input() {
        let words = stream(&["你好。", "world.", "<<<EDIT-BEGIN>>>"]);
        let plan = single_page(&words);
        let cases = [
            String::new(),
            "\n\n\n".to_owned(),
            "<".to_owned(),
            "<<<".to_owned(),
            "<<<EDIT-BEGIN>>>".to_owned(),
            format!("{FENCE_EDIT_BEGIN}\n{FENCE_EDIT_BEGIN}\n{FENCE_EDIT_END}"),
            format!(
                "{FENCE_CONTEXT_BEFORE}\n\u{0}\u{1}\n{FENCE_EDIT_BEGIN}\n你\u{7}好\n{FENCE_EDIT_END}\n{FENCE_CONTEXT_AFTER}"
            ),
            format!(
                "{FENCE_CONTEXT_BEFORE}{FENCE_EDIT_BEGIN}{FENCE_EDIT_END}{FENCE_CONTEXT_AFTER}"
            ),
            "\u{FEFF}```\n```\n".to_owned(),
            "⏸⏹⏸⏹".to_owned(),
            format!(
                "{FENCE_CONTEXT_BEFORE}\r\n{FENCE_EDIT_BEGIN}\r\n你好。\r\n{FENCE_EDIT_END}\r\n{FENCE_CONTEXT_AFTER}\r\n"
            ),
        ];
        for case in cases {
            let parsed = parse(&words, &plan, &case);
            let _ = parsed.paragraphs.len();
        }
        // A stale plan (ranges out of bounds) must not panic either.
        let stale = PolishPagePlan {
            id: "p009".to_owned(),
            before: 100..200,
            core: 50..80,
            after: 999..1000,
            hard_cut_start: true,
            hard_cut_end: true,
            para_starts: vec![9999],
        };
        let rendered = render_polish_page(&words, &stale);
        let _ = parse(&words, &stale, &rendered.text);
    }

    /// The main polish lint no longer blocks single-paragraph over-limit: an answer that turns the whole page into one paragraph is still let through as usual (accepted as long as the body is valid); degenerate segmentation is handled by targeted segment-repair.
    #[test]
    fn oversized_paragraph_passes_the_main_polish_lint() {
        let texts: Vec<String> = (0..(MAX_PARAGRAPH_WORDS_LATIN * 2))
            .map(|index| {
                if (index + 1) % 10 == 0 {
                    format!("w{index}.")
                } else {
                    format!("w{index}")
                }
            })
            .collect();
        let refs: Vec<&str> = texts.iter().map(String::as_str).collect();
        let words = stream(&refs);
        let input = render_polish_page(&words, &single_page(&words)).text;
        let diagnostics = lint_polish_page(&input, &input);
        assert!(
            !diagnostics.has_problems(),
            "problems: {:?}",
            diagnostics.problems
        );
    }

    /// Index-contract range gate: a missing block, non-contiguous ranges, non-covering ranges, or out-of-bounds ranges all give RangeInvalid (the detail locates the block and the defect); it only blocks the corresponding block.
    #[test]
    fn segment_repair_rejects_invalid_ranges() {
        let lines: Vec<String> = (0..6).map(|index| format!("sentence {index}.")).collect();
        let payload = render_segment_repair_page(&[lines.clone()]);
        assert!(
            payload.starts_with("<<<BLOCK 1 | 6 sentences | "),
            "{payload}"
        );
        assert!(payload.contains("\n3| sentence 2.\n"));

        for (answer, needle) in [
            (
                "<<<BLOCK 1>>>\n1-2\n4-6\n<<<BLOCK-END>>>\n",
                "第 3 行没有被任何区间覆盖",
            ),
            ("<<<BLOCK 1>>>\n1-3\n3-6\n<<<BLOCK-END>>>\n", "重叠"),
            (
                "<<<BLOCK 1>>>\n1-3\n4-5\n<<<BLOCK-END>>>\n",
                "第 6–6 行没有被任何区间覆盖",
            ),
            ("<<<BLOCK 1>>>\n1-3\n4-9\n<<<BLOCK-END>>>\n", "越界"),
            (
                "<<<BLOCK 1>>>\n2-6\n<<<BLOCK-END>>>\n",
                "第 1 行没有被任何区间覆盖",
            ),
            ("<<<BLOCK 1>>>\nOK\n<<<BLOCK-END>>>\n", "没有解析到任何"),
            ("<<<BLOCK 2>>>\n1-6\n<<<BLOCK-END>>>\n", "第 1 块缺失"),
        ] {
            let parsed = parse_segment_repair_page(&payload, answer);
            assert!(
                parsed.diagnostics.has_code(ProblemCode::RangeInvalid),
                "{answer:?}: {:?}",
                parsed.diagnostics.problems
            );
            assert_eq!(parsed.paragraphs, vec![None], "{answer:?}");
            assert_eq!(
                parsed.diagnostics.problems[0].scope,
                ProblemScope::Paragraph { index: 0 }
            );
            assert!(
                parsed.diagnostics.problems[0].detail.contains(needle),
                "{answer:?} detail: {}",
                parsed.diagnostics.problems[0].detail
            );
        }
    }

    /// Index-contract segmentation gate: a single range covering a whole over-limit block gives ParagraphOversize (the detail is a targeted retry instruction; word counts are reported per `word_count` and language tier, including the minimum paragraph count). Split into two or more ranges, it is accepted; groups still over the limit are handled by the engine.
    #[test]
    fn segment_repair_accepts_progress_and_rejects_untouched_paragraphs() {
        let latin: Vec<String> = (0..MAX_PARAGRAPH_WORDS_LATIN)
            .map(|index| format!("word{index} word{}.", index + 1000))
            .collect();
        let cjk: Vec<String> = (0..MAX_PARAGRAPH_WORDS_CJK)
            .map(|index| format!("第{index}字字。"))
            .collect();
        let payload = render_segment_repair_page(&[latin.clone(), cjk.clone()]);
        let latin_need = block_min_paragraphs(&latin);
        let cjk_need = block_min_paragraphs(&cjk);
        assert_eq!(latin_need, 2);
        assert!(cjk_need >= 2, "{cjk_need}");
        assert!(
            payload.contains(&format!(" words | at least {latin_need} paragraphs>>>")),
            "{payload}"
        );
        assert!(
            payload.contains(&format!(" characters | at least {cjk_need} paragraphs>>>")),
            "{payload}"
        );

        // Both blocks returned only one range ⇒ both rejected; the detail uses each block's own language basis.
        let answer = format!(
            "<<<BLOCK 1>>>\n1-{}\n<<<BLOCK-END>>>\n\n<<<BLOCK 2>>>\n1-{}\n<<<BLOCK-END>>>\n",
            latin.len(),
            cjk.len()
        );
        let parsed = parse_segment_repair_page(&payload, &answer);
        assert_eq!(parsed.paragraphs, vec![None, None]);
        let oversize: Vec<&Problem> = parsed
            .diagnostics
            .problems
            .iter()
            .filter(|problem| problem.code == ProblemCode::ParagraphOversize)
            .collect();
        assert_eq!(oversize.len(), 2, "{:?}", parsed.diagnostics.problems);
        assert!(
            oversize[0]
                .detail
                .contains(&format!("单段上限 {MAX_PARAGRAPH_WORDS_LATIN}"))
        );
        assert!(
            oversize[1]
                .detail
                .contains(&format!("单段上限 {MAX_PARAGRAPH_WORDS_CJK}"))
        );
        assert!(
            oversize[0].detail.contains("至少拆成 2 个区间"),
            "{}",
            oversize[0].detail
        );
        assert!(
            oversize[1]
                .detail
                .contains(&format!("至少拆成 {cjk_need} 个区间")),
            "{}",
            oversize[1].detail
        );

        // Latin block split in half: two groups of 300 words each are still over the limit, but a boundary was obtained ⇒ accepted; a CJK block still with one range ⇒ still rejected.
        let half = MAX_PARAGRAPH_WORDS_LATIN / 2;
        let answer = format!(
            "<<<BLOCK 1>>>\n1-{half}\n{}-{}\n<<<BLOCK-END>>>\n<<<BLOCK 2>>>\n1-{}\n<<<BLOCK-END>>>\n",
            half + 1,
            latin.len(),
            cjk.len()
        );
        let parsed = parse_segment_repair_page(&payload, &answer);
        assert_eq!(
            parsed.diagnostics.problems.len(),
            1,
            "{:?}",
            parsed.diagnostics.problems
        );
        assert_eq!(
            parsed.diagnostics.problems[0].scope,
            ProblemScope::Paragraph { index: 1 }
        );
        let first = parsed.paragraphs[0].as_ref().expect("the Latin block should be accepted");
        assert_eq!(first.len(), 2);
        assert_eq!(first[0].len(), half);
        assert_eq!(first[0][0], 0);
        assert_eq!(first[1][0], half);
        assert!(parsed.paragraphs[1].is_none());
    }

    /// Index-contract happy path (multi-block payload): blocks out of order, block headers missing angle brackets, multiple ranges on one line, en dash, one sentence per line, restated numbered sentence lines grouped by blank lines, and a single block without a header are all tolerated. One illegal block does not implicate other blocks, and a block that is not over the limit is accepted even when it returns only one range.
    #[test]
    fn segment_repair_accepts_range_answers_per_block() {
        let first: Vec<String> = (0..8).map(|index| format!("sentence {index}.")).collect();
        let second: Vec<String> = (0..4).map(|index| format!("other {index}.")).collect();
        let third: Vec<String> = (0..3).map(|index| format!("third {index}.")).collect();
        let payload = render_segment_repair_page(&[first.clone(), second.clone(), third.clone()]);
        assert_eq!(payload.matches("<<<BLOCK 1 |").count(), 1);
        assert_eq!(payload.matches("<<<BLOCK 3 |").count(), 1);
        assert_eq!(payload.matches(FENCE_BLOCK_END).count(), 3);

        let answer = "BLOCK 2\n1–2, 3-4\n<<<BLOCK-END>>>\n\
                      <<<BLOCK 1 | whatever>>>\n1-3\n4 - 6\n7\n8\n<<<BLOCK-END>>>\n\
                      <<<BLOCK 3>>>\n1-4\n<<<BLOCK-END>>>\n";
        let parsed = parse_segment_repair_page(&payload, answer);
        assert_eq!(
            parsed.diagnostics.problems.len(),
            1,
            "{:?}",
            parsed.diagnostics.problems
        );
        assert_eq!(
            parsed.diagnostics.problems[0].code,
            ProblemCode::RangeInvalid
        );
        assert_eq!(
            parsed.diagnostics.problems[0].scope,
            ProblemScope::Paragraph { index: 2 }
        );
        assert_eq!(
            parsed.paragraphs,
            vec![
                Some(vec![vec![0, 1, 2], vec![3, 4, 5], vec![6], vec![7]]),
                Some(vec![vec![0, 1], vec![2, 3]]),
                None,
            ]
        );

        // Restated numbered sentence lines (grouped by blank lines) are accepted too, trusting only the line numbers; a single-block payload may omit the block header.
        let payload = render_segment_repair_page(&[first.clone()]);
        let answer =
            "1| sentence 0.\n2| sentence 1.\n\n3| sentence two.\n4| x\n5| y\n\n6| \n7| \n8| \n";
        let parsed = parse_segment_repair_page(&payload, answer);
        assert!(
            !parsed.diagnostics.has_problems(),
            "{:?}",
            parsed.diagnostics.problems
        );
        assert_eq!(
            parsed.paragraphs,
            vec![Some(vec![vec![0, 1], vec![2, 3, 4], vec![5, 6, 7]])]
        );

        // A whole block not over the limit: one range covering the whole block is also a legal answer (the seam block's "whole block in one paragraph").
        let answer = "1-8\n";
        let parsed = parse_segment_repair_page(&payload, answer);
        assert!(
            !parsed.diagnostics.has_problems(),
            "{:?}",
            parsed.diagnostics.problems
        );
        assert_eq!(parsed.paragraphs, vec![Some(vec![(0..8).collect()])]);
    }

    fn punct_items() -> Vec<PunctRepairItem> {
        vec![
            PunctRepairItem {
                id: "s01".to_owned(),
                text: "我们先看第一个问题 ⏸ 这个模型在训练的时候没有见过这样的数据 ⏸⏸ 所以它的表现会差一些 然后我们再看第二个问题".to_owned(),
                min_sentences: 3,
            },
            PunctRepairItem {
                id: "s02".to_owned(),
                text: "<<<so we start with the data ⏸ then we train the model and then we evaluate it on the held-out set".to_owned(),
                min_sentences: 2,
            },
        ]
    }

    /// punct-repair happy path: fences carry ids, with blank lines between sentence blocks. The answer only adds punctuation, strips ⏸, and folds soft newlines; out-of-order blocks and dropped `min-sentences` attributes are tolerated.
    #[test]
    fn punct_repair_accepts_punctuation_only_answers_per_sentence() {
        let payload = render_punct_repair_page(&punct_items());
        assert!(payload.contains("<<<SENTENCE-BEGIN id=s01 min-sentences=3>>>"));
        assert!(payload.contains("<<<SENTENCE-END id=s01>>>"));
        assert!(payload.contains("\n <<<so we start"), "a sentinel at line start must be neutralized");
        let answer = "<<<SENTENCE-BEGIN id=s02>>>\nSo we start with the data.\nThen we train the model, and then we evaluate it on the held-out set.\n<<<SENTENCE-END id=s02>>>\n\n<<<SENTENCE-BEGIN id=s01>>>\n我们先看第一个问题。这个模型在训练的时候没有见过这样的数据，所以它的表现会差一些。然后我们再看第二个问题。\n<<<SENTENCE-END id=s01>>>\n";
        let parsed = parse_punct_repair_page(&payload, answer);
        assert!(
            parsed.diagnostics.problems.is_empty(),
            "{:?}",
            parsed.diagnostics.problems
        );
        assert_eq!(
            parsed.sentences,
            vec![
                Some(
                    "我们先看第一个问题。这个模型在训练的时候没有见过这样的数据，所以它的表现会差一些。然后我们再看第二个问题。"
                        .to_owned()
                ),
                Some(
                    "So we start with the data. Then we train the model, and then we evaluate it on the held-out set."
                        .to_owned()
                ),
            ]
        );
    }

    /// Per-sentence rejection: rewritten words give `source-drift`; no sentence-final punctuation added gives `sentence-oversize`; a missing block gives `missing-id`; `。，` is judged by the quality gate. One rejected sentence does not implicate the other sentences.
    #[test]
    fn punct_repair_rejects_word_edits_missing_ends_and_conflicting_marks() {
        let payload = render_punct_repair_page(&punct_items());
        // s01 changed one word ("差一些"→"好一些"), s02 repeated verbatim without adding any sentence-final punctuation.
        let answer = "<<<SENTENCE-BEGIN id=s01>>>\n我们先看第一个问题。这个模型在训练的时候没有见过这样的数据，所以它的表现会好一些。然后我们再看第二个问题。\n<<<SENTENCE-END id=s01>>>\n<<<SENTENCE-BEGIN id=s02>>>\nso we start with the data, then we train the model and then we evaluate it on the held-out set\n<<<SENTENCE-END id=s02>>>\n";
        let parsed = parse_punct_repair_page(&payload, answer);
        assert_eq!(parsed.sentences, vec![None, None]);
        let codes: Vec<ProblemCode> = parsed.diagnostics.problems.iter().map(|p| p.code).collect();
        assert_eq!(
            codes,
            vec![ProblemCode::SourceDrift, ProblemCode::SentenceOversize]
        );
        assert_eq!(
            parsed.diagnostics.problems[0].scope,
            ProblemScope::Sentence {
                id: "s01".to_owned()
            }
        );
        assert!(
            parsed.diagnostics.problems[0].detail.contains("被改写"),
            "{}",
            parsed.diagnostics.problems[0].detail
        );
        assert!(
            parsed.diagnostics.problems[1]
                .detail
                .contains("未新增任何句末标点"),
            "{}",
            parsed.diagnostics.problems[1].detail
        );

        // s02 missing, s01 left `。，`: the conflicting punctuation is normalized by code (R2), and s01 passes as usual.
        let answer = "<<<SENTENCE-BEGIN id=s01>>>\n我们先看第一个问题。，这个模型在训练的时候没有见过这样的数据，所以它的表现会差一些。然后我们再看第二个问题。\n<<<SENTENCE-END id=s01>>>\n";
        let parsed = parse_punct_repair_page(&payload, answer);
        assert!(parsed.sentences[0].is_some());
        assert!(!crate::seam::contains_conflicting_punctuation(
            parsed.sentences[0].as_deref().unwrap()
        ));
        assert!(parsed.sentences[1].is_none());
        let codes: Vec<ProblemCode> = parsed.diagnostics.problems.iter().map(|p| p.code).collect();
        assert_eq!(codes, vec![ProblemCode::MissingId]);
        assert!(
            parsed
                .diagnostics
                .warnings
                .iter()
                .any(|w| w.code == WarningCode::PunctuationNormalized)
        );

        // Only one sentence is bad: s02 passes, s01 added one word.
        let answer = "<<<SENTENCE-BEGIN id=s01>>>\n我们先看第一个问题。这个模型在训练的时候其实没有见过这样的数据，所以它的表现会差一些。然后我们再看第二个问题。\n<<<SENTENCE-END id=s01>>>\n<<<SENTENCE-BEGIN id=s02>>>\nSo we start with the data. Then we train the model and then we evaluate it on the held-out set.\n<<<SENTENCE-END id=s02>>>\n";
        let parsed = parse_punct_repair_page(&payload, answer);
        assert!(parsed.sentences[0].is_none());
        assert!(parsed.sentences[1].is_some());
        assert_eq!(parsed.diagnostics.problems.len(), 1);
        assert!(
            parsed.diagnostics.problems[0].detail.contains("被增删"),
            "{}",
            parsed.diagnostics.problems[0].detail
        );
    }
}
