//! Pagination (derived from voice-ink `PipelinePagination.paginateWordRanges`; now the balanced version).
//!
//! The page count is first determined as `ceil(total words / (budget + slack))`. Slack is the overflow allowance per page: when the word count exceeds N pages' budget by only a small amount, no extra page is cut for the tail. Each page's target is then "remaining words / remaining pages", which avoids greedy filling leaving a short tail page (with budget 6000 and 24200 total words, the result should be 4 pages of 6050 each, not the 3 pages plus a 200-word tail page of the version when the budget was 8000). Breakpoints are still chosen by rank within the last 20% window of each page's target: speaker change (3) > long pause (2) > sentence-final punctuation (1) > none (0); ties go to the later one. A final page that is too short is merged into the previous page. Page boundaries are not persisted; they are deterministically re-derived from the fingerprinted word stream.
//!
//! When speaker information is available, the paging unit can be raised from "word stream + breakpoint scoring" to a **sequence of turns** ([`turn_boundary_cut`], used by the polish carrier): a page is a union of consecutive whole turns, and the word-budget target stays the same. Only long turns that exceed the budget on their own are split internally at sentence boundaries. Documents without speaker information do not take this path, and their per-page results are the same as before the change.

use crate::atomize::{sentence_end, word_count};
use crate::doc::Word;

/// Page budgets, all measured in the language-aware word count from [`crate::atomize::word_count`]: Latin is counted by word, CJK by character, and attached punctuation is not counted separately.
pub mod budgets {
    pub const ORGANIZE: usize = 12000;
    pub const SEGMENT: usize = 8000;
    pub const ANALYSIS: usize = 8000;
    /// Page budget for the per-chapter Map step (paragraphs are atomic). One page or less goes straight to a single call for the chapters; multiple pages go through Map/Reduce. Same tier as segment/analysis: one call can safely read it all, and the number of parallel pages stays moderate.
    pub const CHAPTERS: usize = 8000;
    /// Translation/alignment page budgets for the file contract (`file-v1`) (§12), tiered by executor.
    ///
    /// The unit is words (see [`crate::atomize::word_count`]): a Latin word is about 5.5 characters, so counting by words is language-neutral, and CJK and Latin pages carry similar information density.
    ///
    /// Translation and alignment both page only by source word count, with no extra tiers for sentence count, character count, or worker slots.
    /// Both tiers share the same motivation: a single page's response time scales roughly linearly with its word count, and too few pages cannot fill the concurrency. But the per-page curves of the two executor types differ a lot:
    ///
    /// - **Agent worker** (an external coding-agent session that hand-writes answers sentence by sentence): measured, a 5000-word page takes one worker 5–11 minutes, and a 193-sentence talk (3571 words) is only 1 page at the 5000 tier, leaving all the worker slots idle. At 2000 + 10% slack, a 30-minute talk splits into 2–3 pages that are claimed in parallel, each landing around 2–4 minutes, which also shrinks the exposure to lease timeouts and whole-page redos.
    /// - **Provider direct** (a cloud model generates a whole page in one go): a single page's duration is dominated by output tokens and scales roughly linearly with word count, while the concurrent lanes (default 8) usually aren't saturated. Splitting pages smaller spreads serial output time across parallel lanes. Measured with DeepSeek v4-flash (brief cached): a 3571-word talk at the 4000 tier is 1 page at 147/208s, and at the 2000 tier 2 pages at 108/95s; a 9784-word talk at 4000 is 3 pages at 244s, and at 2000 is 5 pages at 140s; residual violations are also fewer. So the provider tier is currently 2000, the same as agent, and only pays for one extra brief and the page-head system prompt. The two tiers are still declared separately, the host picks the tier by executor, and they can be tuned independently later.
    ///
    /// The host picks the tier by executor: [`PageExecutor::translate_words_for`] / [`PageExecutor::align_words`].
    pub const TRANSLATE_AGENT_WORDS: usize = 2000;
    pub const ALIGN_AGENT_WORDS: usize = 2000;
    pub const TRANSLATE_PROVIDER_WORDS: usize = 2000;
    pub const ALIGN_PROVIDER_WORDS: usize = 2000;

    /// Translation page budget for the fused **row-partition** mode (`--align-fusion rows`); agent and provider share one tier.
    ///
    /// rows raises the cost of each source word's call by about 1.6–2×, making both sides more expensive:
    ///
    /// - **Input**: coverage is widened from "the source side already needs splitting" to "≥ 8 words", and each covered sentence carries an extra `data-align-groups` entry. Measured on the same page (30 sentences of mixed-length English), the user payload went from 8928 to 10206 characters.
    /// - **Output**: each covered sentence must cut its translation into `<span data-src>` display rows, so the answer is no longer "one line of text per sentence". Provider single-page duration is dominated by output tokens (see above), so this lands directly on the critical path.
    ///
    /// More critically, **compliance drops as page length grows**: measured with deepseek-v4-flash, on a page of 59 sentences only the first 3 sentences in the output got row spans, and the remaining 56 fell back to plain translation as a whole (the reply was complete, not truncated, and the spans given were themselves valid). On long pages the model gives up on the micro-format midway. The same model reliably gives 38/50 on shorter pages.
    ///
    /// So the rows tier is **800** (with 10% slack, a page's cap is 880 words). The value was tightened over two rounds: first it landed at `2000 / 1.67 ≈ 1200`; in the fourth round of comparison runs, 1200 already made Trilemma split into 2 parallel pages, with wall-clock going from 58–61 s to 16–22 s. But in the same round Pi Agent still produced whole pages with 0 spans (the reply was clean and well-structured, it just didn't give rows). Halving the page is the most direct means of reducing this exposure: a 30-minute talk (about 3500 words) goes from 3 pages to 4, and sentences per page fall to around 30, right in the range where row-giving was measured to be stable.
    ///
    /// Page-level retry is the other half of the same thing: if a whole page is still missing rows, [`crate::engines::translate`]'s soft page retry resends it once, unchanged (bounded, at most 1 time per page). Together they turn "a whole page abandons the micro-format" from unrecoverable into recoverable.
    ///
    /// The host picks the tier with [`PageExecutor::translate_words_for`]. The override semantics of `CCUT_LLM_PAGE_WORDS` are unchanged: if set, it overrides everything, rows included.
    pub const TRANSLATE_ROWS_WORDS: usize = 800;
    pub const ORGANIZE_MIN_LAST: usize = 100;
    pub const SEGMENT_MIN_LAST: usize = 200;
    pub const ANALYSIS_MIN_LAST: usize = 500;
}

/// Executor tier for translation/alignment page budgets (the host maps it from the `--llm` mode).
///
/// It only decides which source-word budget tier to take from [`budgets`]; the paging algorithm itself ([`balanced_page_sizes`] / [`paginate_word_ranges`]) is independent of the executor.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PageExecutor {
    /// `--llm agent`: an external worker pool claims pages one by one through a task queue.
    Agent,
    /// `--llm provider:<vendor>/<model>`: this process connects directly to the cloud model over multiple lanes.
    Provider,
}

impl PageExecutor {
    /// Translation page budget (source word count), for the regular fusion / no-fusion tiers.
    pub fn translate_words(self) -> usize {
        self.translate_words_for(false)
    }

    /// Translation page budget (source word count). `rows` = `--align-fusion rows`: both executor types share the smaller [`budgets::TRANSLATE_ROWS_WORDS`] tier (see that constant for the reasoning).
    pub fn translate_words_for(self, rows: bool) -> usize {
        if rows {
            return budgets::TRANSLATE_ROWS_WORDS;
        }
        match self {
            Self::Agent => budgets::TRANSLATE_AGENT_WORDS,
            Self::Provider => budgets::TRANSLATE_PROVIDER_WORDS,
        }
    }

    /// Alignment page budget (source word count), shared by the first pass, the fixed-point repair, and the global repair rounds.
    pub fn align_words(self) -> usize {
        match self {
            Self::Agent => budgets::ALIGN_AGENT_WORDS,
            Self::Provider => budgets::ALIGN_PROVIDER_WORDS,
        }
    }
}

/// Overflow allowance per page (10% of the budget): used **only for the page count** calculation.
///
/// When the total word count exceeds N pages' budget by only a small amount (for example, budget 5000 and total 10300), each page after balancing is 5150, which is still within an acceptable range. It isn't worth cutting an extra page and paying for one more call for 300 words.
pub fn page_slack(budget: usize) -> usize {
    budget / 10
}

/// Target page count under budget + slack (at least 1).
pub fn page_count_for_total(total_cost: usize, budget: usize) -> usize {
    total_cost
        .div_ceil(budget.max(1) + page_slack(budget))
        .max(1)
}

/// Pause breakpoint threshold (`Rules.pauseSec`).
const PAUSE_SEC: f64 = 0.6;

/// Prefix sums of word costs (`prefix[i]` = sum of `counts[..i]`), so turn-based paging can get the word-budget cost of any range in O(1).
pub fn cost_prefix(counts: &[usize]) -> Vec<usize> {
    let mut prefix = Vec::with_capacity(counts.len() + 1);
    prefix.push(0usize);
    for count in counts {
        let last = prefix.last().copied().unwrap_or_default();
        prefix.push(last.saturating_add(*count));
    }
    prefix
}

/// Page-boundary selection for turn-aware paging: within `(start, limit]`, pick a **turn start** so that this page's word cost is closest to `target`; ties go to the later one. If there is no turn start in the range, return `None`. That means the current turn alone exceeds the page budget (a long monologue), and the caller instead takes a breakpoint at a sentence boundary inside the turn.
///
/// A page is a union of consecutive whole turns: short turns (dialogue, Q&A) naturally group together, and a page seam no longer splits one person's speech. `turn_starts` must be in ascending order (the starts from [`crate::speaker::speaker_turns`]).
pub fn turn_boundary_cut(
    turn_starts: &[usize],
    prefix_cost: &[usize],
    start: usize,
    limit: usize,
    target: usize,
) -> Option<usize> {
    let base = prefix_cost.get(start).copied()?;
    turn_starts
        .iter()
        .copied()
        .filter(|boundary| *boundary > start && *boundary <= limit)
        .filter_map(|boundary| {
            let cost = prefix_cost.get(boundary)?.saturating_sub(base);
            Some((boundary, cost.abs_diff(target)))
        })
        .reduce(|best, current| if current.1 <= best.1 { current } else { best })
        .map(|(boundary, _)| boundary)
}

/// Scoring of word-gap breakpoints: speaker change 3 > pause 2 > sentence end 1 > none 0.
///
/// `word` is the word to the left of the breakpoint and `next` the word to the right; when paging, the cut is made after `word`.
pub fn breakpoint_rank(word: &Word, next: &Word) -> u8 {
    if next.sp != word.sp {
        3
    } else if next.t0 - word.t1 >= PAUSE_SEC {
        2
    } else if sentence_end(&word.text) {
        1
    } else {
        0
    }
}

/// Split the word stream into page ranges `[start, end)`.
///
/// `max_words` is the **nominal** page budget: first the target page count is determined via [`page_count_for_total`] (including slack), then each page's target is set to "remaining words / remaining pages", and the best breakpoint is searched within its last 20% window. Breakpoints are scored jointly as "word position + rank×(target/20)": a stronger breakpoint can only buy an advance of about 5% of the target word count per rank level, so it does not veto a more balanced lower-rank breakpoint at the tail of the window. The target is recomputed page by page as the remainder shrinks, so if an earlier page comes up a little short, later pages make it up automatically. The remaining page count is also floored by `ceil(remaining words / (budget + slack))`, so a single page's actual word count exceeds the nominal budget by at most one slack. If an earlier page falls too far short, it is better to add a page than to overload the last page.
pub fn paginate_word_ranges(
    words: &[Word],
    max_words: usize,
    min_last_words: usize,
) -> Vec<std::ops::Range<usize>> {
    if words.is_empty() {
        return Vec::new();
    }
    let counts: Vec<usize> = words
        .iter()
        .map(|word| word_count(&word.text).max(1))
        .collect();
    let total: usize = counts.iter().sum();
    let target_pages = page_count_for_total(total, max_words);

    let page_cap = max_words.max(1) + page_slack(max_words);
    let mut pages: Vec<std::ops::Range<usize>> = Vec::new();
    let mut start = 0;
    let mut remaining = total;
    let mut last_page_words = 0;
    while start < words.len() {
        let cap_pages = remaining.div_ceil(page_cap).max(1);
        let pages_left = target_pages
            .saturating_sub(pages.len())
            .max(cap_pages)
            .max(1);
        let page_target = remaining.div_ceil(pages_left).max(1);
        let window_floor = (page_target as f64 * 0.8) as usize;
        let rank_bonus = (page_target / 20).max(1) as i64;
        let mut page_words = 0;
        let mut end = start;
        let mut candidate: Option<(usize, i64)> = None; // (idx, joint score)
        while end < words.len() {
            let add = counts[end];
            if page_words + add > page_target && end > start {
                break;
            }
            page_words += add;
            if page_words >= window_floor && end + 1 < words.len() {
                let rank = breakpoint_rank(&words[end], &words[end + 1]);
                // score = word position + rank bonus; ties go to the later one (>=).
                if rank > 0 {
                    let score = page_words as i64 + i64::from(rank) * rank_bonus;
                    if candidate.is_none_or(|(_, s)| score >= s) {
                        candidate = Some((end, score));
                    }
                }
            }
            end += 1;
        }
        if end >= words.len() {
            pages.push(start..words.len());
            last_page_words = page_words;
            break;
        }
        let cut = candidate.map_or(end, |(idx, _)| idx + 1);
        pages.push(start..cut);
        remaining = remaining.saturating_sub(counts[start..cut].iter().sum::<usize>());
        start = cut;
    }
    if pages.len() > 1
        && last_page_words < min_last_words
        && let Some(last) = pages.last().cloned()
    {
        let previous = pages.len() - 2;
        pages[previous] = pages[previous].start..last.end;
        pages.pop();
    }
    pages
}

/// Split items in order under a fixed page count and a per-page item-count cap, minimizing the cost of the heaviest page.
///
/// Binary-search the smallest feasible maximum page cost, then greedily build exactly the specified number of contiguous pages under that cap. The result is deterministic and order-preserving, with complexity O(n log Σcost). Returns the item count per page, with Σ = the total number of items. The caller can decide the page count from the original source-word budget, then use `item_costs`, which is closer to the real request complexity, to balance the long tail, without changing the number of calls.
pub fn balanced_page_sizes_for_count(
    item_costs: &[usize],
    page_count: usize,
    max_items: usize,
) -> Vec<usize> {
    if item_costs.is_empty() {
        return Vec::new();
    }
    let item_count = item_costs.len();
    let max_items = max_items.max(1).min(item_count);
    let pages = page_count
        .max(item_count.div_ceil(max_items))
        .clamp(1, item_count);

    let total = item_costs
        .iter()
        .fold(0_usize, |sum, cost| sum.saturating_add(*cost));
    let mut low = item_costs
        .iter()
        .copied()
        .max()
        .unwrap_or_default()
        .max(total.div_ceil(pages));
    let mut high = total.max(low);
    let required_pages = |costs: &[usize], capacity: usize| {
        if costs.is_empty() {
            return 0;
        }
        let mut needed = 1_usize;
        let mut page_cost = 0_usize;
        let mut page_items = 0_usize;
        for &cost in costs {
            if page_items == max_items
                || (page_items > 0 && page_cost.saturating_add(cost) > capacity)
            {
                needed += 1;
                page_cost = 0;
                page_items = 0;
            }
            page_cost = page_cost.saturating_add(cost);
            page_items += 1;
        }
        needed
    };
    while low < high {
        let middle = low + (high - low) / 2;
        if required_pages(item_costs, middle) <= pages {
            high = middle;
        } else {
            low = middle + 1;
        }
    }

    let capacity = low;
    let mut prefix = Vec::with_capacity(item_count + 1);
    prefix.push(0_usize);
    for &cost in item_costs {
        prefix.push(
            prefix
                .last()
                .copied()
                .unwrap_or_default()
                .saturating_add(cost),
        );
    }
    let mut sizes = Vec::with_capacity(pages);
    let mut start = 0_usize;
    for page in 0..pages {
        let remaining_pages = pages - page - 1;
        let min_end =
            (start + 1).max(item_count.saturating_sub(remaining_pages.saturating_mul(max_items)));
        let max_end = item_count
            .saturating_sub(remaining_pages)
            .min(start.saturating_add(max_items));
        let remaining_cost = prefix[item_count].saturating_sub(prefix[start]);
        let target = remaining_cost.div_ceil(remaining_pages + 1);
        let mut end = min_end;
        let mut best_diff = usize::MAX;
        for candidate in min_end..=max_end {
            let page_cost = prefix[candidate].saturating_sub(prefix[start]);
            if page_cost > capacity {
                break;
            }
            let diff = page_cost.abs_diff(target);
            if diff < best_diff {
                best_diff = diff;
                end = candidate;
            }
        }
        // If an early boundary chosen by the mean would make the suffix need too many pages, extend it rightward until the suffix is feasible. The global greedy boundary at minimal capacity guarantees that this position can always be found within the current page cap.
        while remaining_pages > 0 && required_pages(&item_costs[end..], capacity) > remaining_pages
        {
            end += 1;
            debug_assert!(end <= max_end);
            debug_assert!(prefix[end].saturating_sub(prefix[start]) <= capacity);
        }
        debug_assert!(end > start);
        sizes.push(end - start);
        start = end;
    }
    debug_assert_eq!(start, item_count);
    sizes
}

/// Balanced paging: first compute the minimum page count from budget + slack ([`page_count_for_total`]), then use [`balanced_page_sizes_for_count`] to minimize the cost of the heaviest page.
///
/// Greedy filling leaves a short tail page at the end (measured on the G3 baseline: 67 sentences → 31/30/6). A tiny page occupies a whole LLM call and a worker turn on its own. An even split (→ 23/22/22) also shortens the largest page: under parallel dispatch, a batch's wall-clock time is the response time of the largest page. Slack guards against the opposite waste: when the total exceeds N pages' budget by only a small amount, no extra call is paid for the tail.
pub fn balanced_page_sizes(item_costs: &[usize], budget: usize) -> Vec<usize> {
    if item_costs.is_empty() {
        return Vec::new();
    }
    let total = item_costs
        .iter()
        .fold(0_usize, |sum, cost| sum.saturating_add(*cost));
    let pages = page_count_for_total(total, budget).clamp(1, item_costs.len());
    balanced_page_sizes_for_count(item_costs, pages, item_costs.len())
}

/// Balanced paging constrained by both the cost budget and the per-page item-count cap. The page count is the larger of the counts each constraint requires; then the maximum page cost is still minimized in contiguous order.
pub fn balanced_bounded_page_sizes(
    item_costs: &[usize],
    budget: usize,
    max_items: usize,
) -> Vec<usize> {
    if item_costs.is_empty() {
        return Vec::new();
    }
    let max_items = max_items.max(1);
    let total = item_costs
        .iter()
        .fold(0_usize, |sum, cost| sum.saturating_add(*cost));
    let pages = page_count_for_total(total, budget)
        .max(item_costs.len().div_ceil(max_items))
        .clamp(1, item_costs.len());
    balanced_page_sizes_for_count(item_costs, pages, max_items)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn word(t0: f64, t1: f64, text: &str, sp: &str) -> Word {
        Word {
            id: format!("g{t0}"),
            t0,
            t1,
            text: text.to_owned(),
            sp: sp.to_owned(),
            glue: false,
        }
    }

    #[test]
    fn prefers_higher_ranked_speaker_boundary() {
        // 5 words; the budget holds a little more than 3 words; the window contains both a sentence end (rank 1) and a speaker change (rank 3).
        let words = vec![
            word(0.0, 1.0, "aaaa.", "s1"),
            word(1.0, 2.0, "bbbb", "s1"),
            word(2.0, 3.0, "cccc.", "s1"),
            word(3.1, 4.0, "dddd", "s2"),
            word(4.0, 5.0, "eeee", "s2"),
        ];
        let pages = paginate_word_ranges(&words, 3, 1);
        assert_eq!(pages, vec![0..3, 3..5]);
    }

    #[test]
    fn turn_cut_picks_the_boundary_closest_to_the_word_target() {
        let counts = vec![1usize; 12];
        let prefix = cost_prefix(&counts);
        assert_eq!(prefix.last(), Some(&12));
        let turn_starts = vec![0usize, 2, 5, 9];
        // target 4: candidates 2 (off by 2) / 5 (off by 1) / 9 (over the cap) → pick 5.
        assert_eq!(turn_boundary_cut(&turn_starts, &prefix, 0, 6, 4), Some(5));
        // Ties go to the later one: with target 3.5, 2 and 5 are equidistant.
        assert_eq!(turn_boundary_cut(&turn_starts, &prefix, 0, 6, 3), Some(2));
        assert_eq!(turn_boundary_cut(&turn_starts, &prefix, 0, 6, 4), Some(5));
        // No turn start within the cap (a long turn) → None; the caller falls back to sentence boundaries.
        assert_eq!(turn_boundary_cut(&turn_starts, &prefix, 5, 8, 3), None);
        // When only one slightly short candidate remains, still take it: the next turn would exceed the budget, so it gets its own page.
        assert_eq!(turn_boundary_cut(&turn_starts, &prefix, 2, 6, 9), Some(5));
    }

    #[test]
    fn short_last_page_merges_into_previous() {
        let words: Vec<Word> = (0..5)
            .map(|i| word(i as f64, i as f64 + 1.0, "aaaa", "s1"))
            .collect();
        let pages = paginate_word_ranges(&words, 2, 2);
        assert_eq!(pages, vec![0..2, 2..5]);
        for pair in pages.windows(2) {
            assert_eq!(pair[0].end, pair[1].start);
        }
        assert_eq!(pages.first().unwrap().start, 0);
    }

    #[test]
    fn single_page_when_budget_fits_all() {
        let words: Vec<Word> = (0..3)
            .map(|i| word(i as f64, i as f64 + 1.0, "hi", "s1"))
            .collect();
        assert_eq!(paginate_word_ranges(&words, 1000, 10), vec![0..3]);
    }

    #[test]
    fn page_cost_uses_language_aware_word_count() {
        let words = vec![
            word(0.0, 1.0, "one two", "s1"),
            word(1.0, 2.0, "三四", "s1"),
            word(2.0, 3.0, "five", "s1"),
        ];
        // 5 words total, budget 4 → 2 pages, balanced target 3 per page: the first page holds only "one two"
        // (adding two CJK characters would bring it to 4, over the target). A raw character count would yield a different boundary.
        assert_eq!(paginate_word_ranges(&words, 4, 1), vec![0..1, 1..3]);
    }

    #[test]
    fn word_pages_balance_instead_of_leaving_a_fragment_tail() {
        // User scenario: budget 6000, full text 24200 words. The old greedy approach gave 6000×4 + a 200-word tail page; after balancing it is 4 pages of 6050 (slack 600 absorbs the overflow).
        let words: Vec<Word> = (0..24_200)
            .map(|i| word(i as f64, i as f64 + 1.0, "aaaa", "s1"))
            .collect();
        let pages = paginate_word_ranges(&words, 6000, 200);
        assert_eq!(pages.len(), 4);
        assert_eq!(pages.last().unwrap().end, 24_200);
        for page in &pages {
            let size = page.end - page.start;
            assert!((6000..=6100).contains(&size), "unbalanced page: {size}");
        }
    }

    #[test]
    fn stronger_rank_cannot_veto_a_much_later_breakpoint() {
        // Regression on a real word stream: the window has a pause (rank 2) in its early part and a sentence end (rank 1) in its tail. Under the old logic the higher rank vetoed everything else: the first page broke early at word 42 and the last page was overloaded. Under joint scoring a rank is only worth 5% of the target as an advance, so the sentence-end breakpoint at word 48 should be chosen.
        let mut words: Vec<Word> = (0..100)
            .map(|i| word(i as f64, i as f64 + 0.9, "aaaa", "s1"))
            .collect();
        words[42].t0 = 42.7; // 0.8s pause between 41→42 (rank 2)
        words[47].text = "aaaa.".to_owned(); // sentence end at 47→48 (rank 1)
        let pages = paginate_word_ranges(&words, 90, 10);
        assert_eq!(pages, vec![0..48, 48..100]);
    }

    #[test]
    fn accumulated_deficit_adds_a_page_instead_of_overloading_the_tail() {
        // The first two pages each have only an early pause breakpoint, so the shortfall keeps being passed on. The cap backstop should cut an extra page, and no page may exceed budget + slack (100+10).
        let mut words: Vec<Word> = (0..300)
            .map(|i| word(i as f64, i as f64 + 0.9, "aaaa", "s1"))
            .collect();
        words[80].t0 = 80.7;
        words[168].t0 = 168.7;
        let pages = paginate_word_ranges(&words, 100, 10);
        assert_eq!(pages.first().unwrap().start, 0);
        assert_eq!(pages.last().unwrap().end, 300);
        for pair in pages.windows(2) {
            assert_eq!(pair[0].end, pair[1].start);
        }
        for page in &pages {
            let size = page.end - page.start;
            assert!(size <= 110, "page exceeds budget+slack: {size}");
        }
        assert!(pages.len() >= 3);
    }

    #[test]
    fn slack_absorbs_a_small_overflow_without_an_extra_page() {
        // 8300 words, budget 8000: within the 800 slack, one page absorbs it; no extra call is paid for 300 words.
        let words: Vec<Word> = (0..8300)
            .map(|i| word(i as f64, i as f64 + 1.0, "aaaa", "s1"))
            .collect();
        assert_eq!(paginate_word_ranges(&words, 8000, 500), vec![0..8300]);
        assert_eq!(page_count_for_total(8300, 8000), 1);
        // Paging happens only when the total exceeds slack, and once it splits, the pages are balanced.
        assert_eq!(page_count_for_total(8801, 8000), 2);
        assert_eq!(page_count_for_total(24_200, 6000), 4);
    }

    #[test]
    fn balanced_pages_avoid_fragment_tail() {
        // 67 equal-length items ×128 = 8576: greedy filling gives a tiny tail page of 31/31/5. Slack (4000+400) first brings the page count down to 2, and balancing then cuts it into 34/33 (each page 4352 ≤ 4400).
        let items = vec![128_usize; 67];
        let sizes = balanced_page_sizes(&items, 4000);
        assert_eq!(sizes.iter().sum::<usize>(), 67);
        assert_eq!(sizes.len(), 2);
        let max = *sizes.iter().max().unwrap();
        let min = *sizes.iter().min().unwrap();
        assert!(max - min <= 1, "sizes not balanced: {sizes:?}");
        // When slack cannot absorb the excess, the page count grows as usual, and the pages are still balanced.
        let items = vec![128_usize; 110];
        let sizes = balanced_page_sizes(&items, 4000);
        assert_eq!(sizes.len(), 4);
        assert!(sizes.iter().max().unwrap() - sizes.iter().min().unwrap() <= 1);
    }

    #[test]
    fn balanced_pages_edge_cases() {
        assert!(balanced_page_sizes(&[], 100).is_empty());
        // Everything goes into a single page.
        assert_eq!(balanced_page_sizes(&[10, 20, 30], 1000), vec![3]);
        // A single item over budget still takes its own page, without panicking.
        assert_eq!(balanced_page_sizes(&[5000], 100), vec![1]);
        // The page count does not exceed the item count.
        assert_eq!(balanced_page_sizes(&[5000, 5000], 100), vec![1, 1]);
        // Variable-length items also keep full coverage and the correct page count.
        let items = vec![900, 100, 100, 900, 100, 900];
        let sizes = balanced_page_sizes(&items, 1000);
        assert_eq!(sizes.iter().sum::<usize>(), items.len());
        assert_eq!(sizes.len(), 3);
    }

    #[test]
    fn fixed_page_count_balances_cost_without_reordering() {
        let items = [50, 50, 1, 1, 1, 1];
        let sizes = balanced_page_sizes_for_count(&items, 2, items.len());
        assert_eq!(sizes, vec![1, 5]);
        assert_eq!(sizes.iter().sum::<usize>(), items.len());
    }

    #[test]
    fn bounded_pages_balance_seventeen_items_in_two_batches() {
        let items = vec![1_600_usize; 17];
        let sizes = balanced_bounded_page_sizes(&items, 20_000, 15);
        assert_eq!(sizes.len(), 2);
        assert_eq!(sizes.iter().sum::<usize>(), 17);
        assert!(sizes.iter().all(|size| *size <= 15));
        assert_eq!(sizes.iter().max().unwrap() - sizes.iter().min().unwrap(), 1);
    }

    #[test]
    fn bounded_pages_respect_hard_item_cap_and_oversized_items() {
        let items = [50_000, 10, 10, 10, 10, 10, 10];
        let sizes = balanced_bounded_page_sizes(&items, 20_000, 3);
        assert_eq!(sizes.iter().sum::<usize>(), items.len());
        assert!(sizes.iter().all(|size| *size <= 3));
        assert_eq!(sizes.first(), Some(&1));
    }

    #[test]
    fn fixed_page_partitioner_matches_small_exhaustive_optimum() {
        fn optimum(costs: &[usize], pages: usize, max_items: usize) -> usize {
            if pages == 1 {
                return (costs.len() <= max_items)
                    .then(|| costs.iter().sum())
                    .unwrap_or(usize::MAX);
            }
            let max_first = max_items.min(costs.len().saturating_sub(pages - 1));
            (1..=max_first)
                .filter_map(|size| {
                    let suffix = optimum(&costs[size..], pages - 1, max_items);
                    (suffix != usize::MAX).then(|| costs[..size].iter().sum::<usize>().max(suffix))
                })
                .min()
                .unwrap_or(usize::MAX)
        }

        for item_count in 1_usize..=6 {
            let combinations = 3_usize.pow(item_count as u32);
            for encoded in 0..combinations {
                let mut value = encoded;
                let costs = (0..item_count)
                    .map(|_| {
                        let cost = value % 3 + 1;
                        value /= 3;
                        cost
                    })
                    .collect::<Vec<_>>();
                for max_items in 1..=item_count {
                    for requested_pages in 1..=item_count {
                        let pages = requested_pages
                            .max(item_count.div_ceil(max_items))
                            .min(item_count);
                        let sizes =
                            balanced_page_sizes_for_count(&costs, requested_pages, max_items);
                        assert_eq!(sizes.len(), pages, "{costs:?}");
                        assert_eq!(sizes.iter().sum::<usize>(), item_count, "{costs:?}");
                        assert!(sizes.iter().all(|size| *size <= max_items), "{costs:?}");
                        let mut cursor = 0_usize;
                        let actual = sizes
                            .iter()
                            .map(|size| {
                                let cost = costs[cursor..cursor + size].iter().sum::<usize>();
                                cursor += size;
                                cost
                            })
                            .max()
                            .unwrap();
                        assert_eq!(
                            actual,
                            optimum(&costs, pages, max_items),
                            "costs={costs:?} sizes={sizes:?}"
                        );
                    }
                }
            }
        }
    }
}
