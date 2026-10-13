//! Breakpoint layout optimization: a global DP over candidate breakpoints (aligned with the block plan §3.3).
//!
//! The Cue derivation algorithm (§18.5) stays simple, greedy and strictly consistent across the three platforms; display quality comes from the deterministic optimizer here. It treats the six rules of §18.5 as **the candidate generator and the final replayer**:
//!
//! - Hard boundaries (must break): user `break`, speaker change, `paraBreaks`, sentence-final punctuation, and, for English, clause punctuation where the body text/duration is sufficient and a new clause follows (Sentence is aggregated from complete Cues, so a sentence end cannot be crossed);
//! - Forbidden boundaries: user `nobreak`, high-confidence English dangling constituents, and the interior of fixed phrases;
//! - All other positions are soft candidates, chosen as a whole by the DP:
//!
//! ```text
//! dp[j] = min over i<j, [i..j) legal of dp[i] + cueCost(words[i..j))
//! cueCost = line width (heavy penalty beyond budget; keeps semantically indivisible units and explicit nobreak solvable)
//!         + reading-speed penalty (cps: linear beyond warn, squared beyond bad; the time window borrows the silence convention of lead_in/tail)
//!         + too short (< min_duration) / too long (> max_duration) penalty
//!         + seam penalty (uses the split.rs scale: sentence end 0 < clause punctuation 0.3 < pause 0.5 < ordinary inter-word 0.8 < dangling article/preposition/particle end 1.5 < CJK intra-word character boundary 3.0)
//!         + isolated short-tail penalty (< minClauseChars and adjacent to a soft boundary)
//!         + line-length imbalance penalty (underfill squared; only breaks ties)
//!         + two-line imbalance penalty (only for profiles with max_lines > 1: squared difference between the widest and narrowest lines after the in-line wrap DP)
//! ```
//!
//! The seam penalty is measured as the cost of deviating from §18.5: a seam where the greedy pass would break anyway costs 0 when we break it; where greedy does not break and we do, the penalty follows the seam level; where greedy would break and we suppress that break, the penalty follows the level of the suppressed seam. This way, when the greedy layout has no semantic or readability problem, the minimal pin set is empty. Semantically forbidden cut points are removed from the candidates first and can never be bought back with width or CPS scores. When an English short clause cannot fit into two shortest display durations, overflowSlack may be used to absorb trailing punctuation, to avoid creating a flash cue. When an indivisible phrase or a user nobreak is over-width, the complete unit is kept and the width check reports the problem; non-English text keeps the original soft penalties and width strategy.
//!
//! Two-line profile (`LayoutProfile::max_lines = 2`, plan §3.4): the width budget grows to `max_lines × maxChars`, so one Cue may carry two lines of text. How those lines wrap is decided by a render-time projection (not persisted). The DP uses [`line_break_plan_with`] only to recompute the line-break positions once, to score the "two-line imbalance"; a segment whose line count exceeds `max_lines` is treated as over-width. Under the `default` profile (`max_lines = 1`) none of these branches participate, and the behaviour is byte-for-byte identical to the single-line case.
//!
//! The output is still the **minimal pin set**: `break`/`nobreak` are written only where the replay of `auto_break` disagrees, into `doc.auto_breaks[layoutProfile]`, and **never into `doc.breaks`** (that is explicit user intent, which is a constraint for the DP). Any §18.5 implementation (Studio server, designs prototype, Mac client) that replays from words + `autoBreaks ⊕ breaks` gets the same layout, without needing its own built-in optimizer.
//!
//! Typical fix patterns (from real failure samples):
//! - An overflow hard break throws the last words of a sentence into a Cue of near-zero duration (`…reshape the` / `environment.`) → the seam moves back to where line width is balanced;
//! - A pause break leaves the sentence tail too fast (`…tools that were` / `once managed
//!   separately.`, >21 cps) → the seam moves earlier so the second line gets enough time window.

use std::collections::{BTreeMap, BTreeSet};

use crate::atomize::{
    clause_end_char, count_cps_chars, is_cjk_text, join_word_texts, sentence_end, visual_width,
    word_sep,
};
use crate::cue::{CueParams, auto_break, derive_cues};
use crate::doc::{BreakOverride, TranscriptDoc, Word};
use crate::fingerprint::fingerprint_strings;
use crate::layout_profile::{CpsBudget, LayoutProfile, line_break_plan_with};
use crate::seam::{cjk_midword_boundary, ends_dangling};
use crate::source_boundary::{english_clause_start, english_cue_boundary_issue};

/// Seam-penalty scale (the same ladder as `split.rs::seam_penalty`; a sentence end is a hard boundary and does not participate).
const SEAM_CLAUSE: f64 = 0.3;
const SEAM_PAUSE: f64 = 0.5;
const SEAM_WORD: f64 = 0.8;
/// Seam after a dangling article/preposition/particle (`seam.rs::ends_dangling`): grammatically it must not be a pause point, but source words are ASR atoms, and in long sentences there may be no better seam, so it is penalized heavily rather than forbidden.
const SEAM_DANGLING: f64 = 1.5;
/// CJK intra-word character boundary (both sides are ideographs with no punctuation or whitespace): same magnitude as the seamless tier in `split.rs`.
const SEAM_CJK_MIDWORD: f64 = 3.0;
/// Reading speed: for cps between warn and bad, a linear penalty up to 0.5; beyond bad, the squared "excess / (bad−warn)" × 4. A 23.5 cps Latin line ≈ 2.1, enough to buy one seam move (0.8) plus one seam suppression (0.5).
const READING_WARN_LINEAR: f64 = 0.5;
const READING_BAD_QUADRATIC: f64 = 4.0;
/// Duration: shorter than min_duration, linear × 3 by the proportional gap (an orphan tail of 0.58 s ≈ 1.25, enough to buy one seam move); longer than max_duration, × 2 by the proportional excess.
const SHORT_DURATION_PENALTY: f64 = 3.0;
const LONG_DURATION_PENALTY: f64 = 2.0;
/// Isolated short segment (< minClauseChars and adjacent to a soft boundary): × 1 by the proportional shortfall.
const ORPHAN_PENALTY: f64 = 1.0;
/// Beyond maxChars: treated as infinite (keeping it finite only ensures the DP still has a solution when a user nobreak welds words together or a single word is itself over-wide, and the wider it is, the worse).
const OVERWIDE_PENALTY: f64 = 1e6;
/// Weight of the underfill squared term: it only breaks ties; any real deviation (≥ 0.3) cannot be bought with it.
const UNDERFILL_WEIGHT: f64 = 0.1;
/// Two-line imbalance weight (only `max_lines > 1`): the squared ratio of the difference between the widest and narrowest lines to the single-line width. For one line of 42 and one of 21 ≈ 0.25, enough to buy an underfill tie-break but not a seam move (0.8).
const LINE_IMBALANCE_WEIGHT: f64 = 1.0;

/// Reading-speed budget for the document script: CJK (Han/Kana/Hangul) is determined from the first 80 words.
fn reading_budget(words: &[Word], profile: &LayoutProfile) -> CpsBudget {
    let sample: String = words
        .iter()
        .take(80)
        .map(|word| word.text.as_str())
        .collect();
    profile.cps_for_script(is_cjk_text(&sample))
}

/// Boundary classification (the seam after word `k`).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Seam {
    /// Must break: last word, user break, speaker change, paragraph pin, sentence end, and protected English clause punctuation.
    Hard,
    /// Must not break: user nobreak, or a recognized illegal English phrase boundary; hard boundaries still override it.
    Forbidden,
    /// Soft candidate.
    Soft,
}

fn classify_seams(
    words: &[Word],
    user: &BTreeMap<String, BreakOverride>,
    para_breaks: &BTreeMap<String, bool>,
    english: bool,
    params: &CueParams,
    min_duration: f64,
) -> Vec<Seam> {
    let texts: Vec<_> = words.iter().map(|word| word.text.as_str()).collect();
    let mut clause_start = 0;
    let mut clause_width = 0;
    (0..words.len())
        .map(|k| {
            let Some(next) = words.get(k + 1) else {
                return Seam::Hard;
            };
            let word = &words[k];
            if k > clause_start {
                clause_width += word_sep(&words[k - 1].text, word);
            }
            clause_width += visual_width(&word.text);
            // The criterion only needs a local word window; avoid scanning the whole prefix at every cut point, so long scripts keep linear preprocessing.
            let start = k.saturating_sub(2);
            let end = (k + 4).min(words.len());
            let seam = if next.sp != word.sp || para_breaks.get(&next.id).copied().unwrap_or(false)
            {
                Seam::Hard
            } else {
                match user.get(&word.id) {
                    Some(BreakOverride::Break) => Seam::Hard,
                    Some(BreakOverride::Nobreak) => Seam::Forbidden,
                    None if sentence_end(&word.text) => Seam::Hard,
                    None if english
                        && english_cue_boundary_issue(&texts[start..end], k + 1 - start)
                            .is_some() =>
                    {
                        Seam::Forbidden
                    }
                    None if english
                        && clause_end_char(&word.text).is_some()
                        && english_clause_start(&next.text)
                        && clause_width >= params.min_clause_chars
                        && word.t1 - words[clause_start].t0 >= min_duration =>
                    {
                        Seam::Hard
                    }
                    None => Seam::Soft,
                }
            };
            if seam == Seam::Hard || clause_end_char(&word.text).is_some() {
                clause_start = k + 1;
                clause_width = 0;
            }
            seam
        })
        .collect()
}

/// Rule-based seam level (lower = more willing to break here): punctuation > pause > CJK intra-word character boundary > ordinary word boundary.
fn seam_grade(word: &Word, next: &Word, params: &CueParams) -> f64 {
    if clause_end_char(&word.text).is_some() {
        SEAM_CLAUSE
    } else if next.t0 - word.t1 >= params.pause_sec {
        SEAM_PAUSE
    } else if next.glue || cjk_midword_boundary(&word.text, &next.text) {
        // A seam marked “贴前” (attach-to-previous) has no space and sits in the same tier as the character seams between ideographs.
        SEAM_CJK_MIDWORD
    } else {
        SEAM_WORD
    }
}

/// Dangling-tail penalty: whether or not greedy would break here (greedy's overflow arm often throws `the` / `to` to the end of a line), a seam after a dangling article/preposition/particle is penalized, and the DP moves away if it finds a better seam.
fn dangling_cost(word: &Word) -> f64 {
    if clause_end_char(&word.text).is_none() && ends_dangling(&word.text) {
        SEAM_DANGLING
    } else {
        0.0
    }
}

/// The cost of suppressing a break that greedy would make here: the clause/pause tiers are charged by seam level; the overflow tier is carried by the line-width penalty.
fn suppression_cost(word: &Word, next: &Word, line_chars: usize, params: &CueParams) -> f64 {
    if let Some(punct) = clause_end_char(&word.text) {
        let gate = if punct == '—' || punct == '–' {
            params.min_dash_chars
        } else {
            params.min_clause_chars
        };
        if line_chars >= gate {
            return SEAM_CLAUSE;
        }
    }
    if next.t0 - word.t1 >= params.pause_sec && line_chars >= params.min_pause_chars {
        return SEAM_PAUSE;
    }
    0.0
}

struct Optimizer<'a> {
    words: &'a [Word],
    seams: Vec<Seam>,
    params: &'a CueParams,
    profile: &'a LayoutProfile,
    budget: CpsBudget,
    english: bool,
}

impl Optimizer<'_> {
    /// Number of lines in the profile (at least 1).
    fn max_lines(&self) -> usize {
        usize::from(self.profile.max_lines.max(1))
    }

    /// Width budget of one Cue: `max_lines × maxChars` (for a single-line profile, just `maxChars`).
    fn width_budget(&self) -> usize {
        self.params.max_chars * self.max_lines()
    }

    /// Two-line imbalance penalty (plan §3.4): computed only for `max_lines > 1` and for segments whose width already exceeds a single line. It reuses the balancing and boundary-penalty scoring of studio `sourceDisplayLines` (Rust port [`line_break_plan_with`]; width is measured by `visual_width`, consistent with the rest of this file). A line count above `max_lines` counts as over-width (same tier as the infinite width penalty).
    fn line_imbalance_cost(&self, words: &[Word], width: usize) -> f64 {
        let max_lines = self.max_lines();
        let max_chars = self.params.max_chars;
        if max_lines <= 1 || width <= max_chars {
            return 0.0;
        }
        let plan = line_break_plan_with(words, max_lines, max_chars, visual_width);
        if plan.len() > max_lines {
            return OVERWIDE_PENALTY + (plan.len() - max_lines) as f64 * 1e3;
        }
        let widths: Vec<usize> = plan
            .iter()
            .map(|line| visual_width(&join_word_texts(line.iter().map(|&index| &words[index]))))
            .collect();
        let widest = widths.iter().copied().max().unwrap_or(0);
        let narrowest = widths.iter().copied().min().unwrap_or(0);
        let imbalance = (widest - narrowest) as f64 / max_chars.max(1) as f64;
        LINE_IMBALANCE_WEIGHT * imbalance * imbalance
    }

    fn gap_before(&self, i: usize) -> f64 {
        if i == 0 {
            f64::INFINITY
        } else {
            self.words[i].t0 - self.words[i - 1].t1
        }
    }

    fn gap_after(&self, j: usize) -> f64 {
        if j >= self.words.len() {
            f64::INFINITY
        } else {
            self.words[j].t0 - self.words[j - 1].t1
        }
    }

    /// The cost of `[i..j)` as one Cue (excluding legality checks other than infinite width).
    fn segment_cost(&self, i: usize, j: usize) -> f64 {
        let words = &self.words[i..j];
        let params = self.params;
        let mut cost = 0.0;

        // Replay greedy within the segment: a suppressed greedy break is penalized; the final seam is charged by its deviation.
        let mut line = 0_usize;
        for (offset, word) in words.iter().enumerate() {
            if offset > 0 {
                line += word_sep(&words[offset - 1].text, word);
            }
            line += visual_width(&word.text);
            let k = i + offset;
            let Some(next) = self.words.get(k + 1) else {
                break;
            };
            let greedy = auto_break(word, next, line, params);
            if k + 1 < j {
                if greedy && self.seams[k] == Seam::Soft {
                    cost += suppression_cost(word, next, line, params);
                }
            } else if self.seams[k] == Seam::Soft {
                if !greedy {
                    cost += seam_grade(word, next, params);
                }
                cost += dangling_cost(word);
            }
        }

        // Line width (under a two-line profile the budget is max_lines × maxChars).
        let width = visual_width(&join_word_texts(words));
        let max_chars = self.width_budget();
        // When two Cues that each last at least min_duration cannot hold this short clause, the existing overflow_slack may be used to absorb trailing punctuation, to avoid a flash cue like “I think | that's ... world.”. Long sentences still choose legal cut points within the normal width; the margin is not expanded into a new target for all lines.
        let short_clause_slack = self.english
            && (clause_end_char(&words[words.len() - 1].text).is_some()
                || sentence_end(&words[words.len() - 1].text))
            && words[words.len() - 1].t1 - words[0].t0 < 2.0 * self.profile.min_duration_sec
            && width <= max_chars + params.overflow_slack;
        if width > max_chars && !short_clause_slack {
            cost += OVERWIDE_PENALTY + (width - max_chars) as f64 * 1e3;
        } else {
            let slack = max_chars.abs_diff(width) as f64 / max_chars.max(1) as f64;
            cost += UNDERFILL_WEIGHT * slack * slack;
        }
        cost += self.line_imbalance_cost(words, width);

        // Reading speed and duration (borrowing the silence convention, so they match on-screen presentation).
        let window = self.profile.display_window(
            words[0].t0,
            words[words.len() - 1].t1,
            self.gap_before(i),
            self.gap_after(j),
        );
        let chars = words
            .iter()
            .map(|word| count_cps_chars(&word.text))
            .sum::<usize>() as f64;
        let CpsBudget { warn, bad, .. } = self.budget;
        let span = (bad - warn).max(f64::EPSILON);
        let cps = if window > 0.0 {
            chars / window
        } else {
            f64::INFINITY
        };
        if cps.is_finite() {
            if cps > warn {
                cost += READING_WARN_LINEAR * (cps - warn) / span;
            }
            if cps > bad {
                let over = (cps - bad) / span;
                cost += READING_BAD_QUADRATIC * over * over;
            }
        } else if chars > 0.0 {
            cost += READING_WARN_LINEAR + READING_BAD_QUADRATIC * 100.0;
        }
        let min_duration = self.profile.min_duration_sec;
        if min_duration > 0.0 && window < min_duration {
            cost += SHORT_DURATION_PENALTY * (min_duration - window) / min_duration;
        }
        let max_duration = self.profile.max_duration_sec;
        if max_duration > 0.0 && window > max_duration {
            cost += LONG_DURATION_PENALTY * (window - max_duration) / max_duration;
        }

        // Isolated short segment: an over-narrow segment adjacent to a soft boundary.
        let start_soft = i > 0 && self.seams[i - 1] == Seam::Soft;
        let end_soft = self.seams[j - 1] == Seam::Soft;
        if width < params.min_clause_chars && (start_soft || end_soft) {
            cost += ORPHAN_PENALTY * (params.min_clause_chars - width) as f64
                / params.min_clause_chars.max(1) as f64;
        }
        cost
    }

    /// Within one block `[start..=end]` cut out by hard boundaries, find the optimal segmentation and return the last-word index of each segment.
    fn solve_block(&self, start: usize, end: usize) -> Vec<usize> {
        let n = end - start + 1;
        let max_chars = self.width_budget()
            + if self.english {
                self.params.overflow_slack
            } else {
                0
            };
        let mut dp = vec![f64::INFINITY; n + 1];
        let mut prev = vec![usize::MAX; n + 1];
        dp[0] = 0.0;
        for i in 0..n {
            if !dp[i].is_finite() {
                continue;
            }
            let mut width = 0_usize;
            let mut found_end = false;
            for j in (i + 1)..=n {
                let k = start + j - 1;
                if j > i + 1 {
                    width += word_sep(&self.words[k - 1].text, &self.words[k]);
                }
                width += visual_width(&self.words[k].text);
                if self.seams[k] != Seam::Forbidden {
                    let candidate = dp[i] + self.segment_cost(start + i, k + 1);
                    if candidate < dp[j] {
                        dp[j] = candidate;
                        prev[j] = i;
                    }
                    found_end = true;
                }
                if width > max_chars && found_end {
                    break;
                }
            }
        }
        let mut ends = Vec::new();
        let mut cursor = n;
        while cursor > 0 {
            ends.push(start + cursor - 1);
            cursor = prev[cursor];
        }
        ends.reverse();
        ends
    }

    /// The set of optimal Cue end-words for the whole document.
    fn desired_ends(&self) -> BTreeSet<usize> {
        let mut ends = BTreeSet::new();
        let mut start = 0;
        for k in 0..self.words.len() {
            if self.seams[k] == Seam::Hard {
                ends.extend(self.solve_block(start, k));
                start = k + 1;
            }
        }
        ends
    }
}

/// Visible words for layout (non-empty id and not hidden), in `doc.words` order.
fn visible_words(doc: &TranscriptDoc) -> Vec<Word> {
    doc.words
        .iter()
        .filter(|word| !word.id.is_empty())
        .filter(|word| !doc.hidden.get(&word.id).copied().unwrap_or(false))
        .cloned()
        .collect()
}

/// Component strings of the `stages.asrLayout` fingerprint: the user's layout strings ([`TranscriptDoc::layout_strings`], already sorted).
pub fn layout_fingerprint_strings(doc: &TranscriptDoc) -> Vec<String> {
    doc.layout_strings()
}

/// The fingerprint value of [`layout_fingerprint_strings`]: the string written into `stages.asrLayout`.
pub fn layout_fingerprint(doc: &TranscriptDoc) -> String {
    fingerprint_strings(layout_fingerprint_strings(doc))
}

/// Computes the minimal automatic pin set of the balanced layout (the content written to `autoBreaks[layoutProfile]`): user `breaks`, paragraph pins, speakers and sentence ends are hard constraints, and everything else is decided by the global DP over candidate breakpoints. Only where the automatic ladder disagrees with the target layout, and the user has not pinned that word, is a `break`/`nobreak` written. Paragraph-pin seams explicitly write `break`, so that mirror implementations without the pre-paragraph seal logic (designs JS / mac Swift) stay word-for-word equivalent. Existing `autoBreaks` do not take part in the computation, so re-running is idempotent.
pub fn balanced_cue_breaks(
    doc: &TranscriptDoc,
    params: &CueParams,
) -> BTreeMap<String, BreakOverride> {
    let visible = visible_words(doc);
    let mut out = BTreeMap::new();
    if visible.len() < 2 {
        return out;
    }
    let profile = LayoutProfile::by_id_or_default(doc.layout_profile_id());
    let seams = classify_seams(
        &visible,
        &doc.breaks,
        &doc.para_breaks,
        crate::split::primary_subtag(&doc.lang) == "en",
        params,
        profile.min_duration_sec,
    );
    let optimizer = Optimizer {
        words: &visible,
        seams,
        params,
        profile: &profile,
        budget: reading_budget(&visible, &profile),
        english: crate::split::primary_subtag(&doc.lang) == "en",
    };
    let desired = optimizer.desired_ends();

    let mut line = 0_usize;
    for position in 0..visible.len() {
        let word = &visible[position];
        if line > 0 {
            line += word_sep(&visible[position - 1].text, word);
        }
        line += visual_width(&word.text);
        let Some(next) = visible.get(position + 1) else {
            break;
        };
        if next.sp != word.sp {
            line = 0;
            continue;
        }
        if doc.para_breaks.get(&next.id).copied().unwrap_or(false) {
            out.insert(word.id.clone(), BreakOverride::Break);
            line = 0;
            continue;
        }
        let want = desired.contains(&position);
        if !doc.breaks.contains_key(&word.id) && want != auto_break(word, next, line, params) {
            out.insert(
                word.id.clone(),
                if want {
                    BreakOverride::Break
                } else {
                    BreakOverride::Nobreak
                },
            );
        }
        if want {
            line = 0;
        }
    }
    out
}

/// Overwrites `doc.auto_breaks[layoutProfile]` with the balanced-layout pin set (an empty set removes that profile's table); returns whether anything changed. `doc.breaks` is read-only.
pub fn apply_balanced_cues(doc: &mut TranscriptDoc, params: &CueParams) -> bool {
    let profile = doc.layout_profile_id().to_owned();
    let pins = balanced_cue_breaks(doc, params);
    let current = doc.auto_breaks.get(&profile);
    if pins.is_empty() {
        return doc.auto_breaks.remove(&profile).is_some();
    }
    if current == Some(&pins) {
        return false;
    }
    doc.auto_breaks.insert(profile, pins);
    true
}

/// Lays out the balanced layout. It always runs (user `breaks` and `paraBreaks` are hard constraints; it is no longer skipped for the whole document just because "pins already exist"), and the result goes only into `autoBreaks`. Returns whether anything changed.
pub fn ensure_balanced_cue_layout(doc: &mut TranscriptDoc, params: &CueParams) -> bool {
    apply_balanced_cues(doc, params)
}

/// Layout exit statistics, with the same meaning as `stats.after / stats.longAfter` of `optimizeBreaks` in the designs prototype (`over_width` is the new over-width count). The over-width criterion is the profile budget [`LayoutProfile::cue_width_budget`] (for a single-line profile this is the actual ceiling of the automatic ladder, `max_chars + overflow_slack`; for a two-line profile it is `2 × max_chars + overflow_slack`). On the normal pipeline output, `over_width == 0` should always hold; a non-zero value means the layout layer emitted over-wide lines beyond the budget, which is a regression signal.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct CueLayoutStats {
    /// Number of derived Cues.
    pub cues: usize,
    /// Visual width of the longest Cue (CJK counts as 2).
    pub longest_width: usize,
    /// Number of Cues that exceed the single-line budget.
    pub over_width: usize,
}

/// Derives Cues from the current pin table (`autoBreaks ⊕ breaks`) and computes the width distribution.
pub fn cue_layout_stats(doc: &TranscriptDoc, params: &CueParams) -> CueLayoutStats {
    let budget = LayoutProfile::for_doc(doc).cue_width_budget(params);
    let cues = derive_cues(doc, params);
    let mut stats = CueLayoutStats {
        cues: cues.len(),
        ..CueLayoutStats::default()
    };
    for cue in &cues {
        let width = visual_width(&cue.text(doc));
        stats.longest_width = stats.longest_width.max(width);
        if width > budget {
            stats.over_width += 1;
        }
    }
    stats
}

/// Removes the `nobreak` overrides that weld an over-wide Cue together (both user `breaks` and the current profile's `autoBreaks` are checked). Ordinary `break`s and any `nobreak` that does not cause over-width are kept. The over-width criterion is the profile budget [`LayoutProfile::cue_width_budget`]: under a two-line profile, a two-line Cue that the optimizer produced is not over-wide.
///
/// After a rebind changes word ids or punctuation, an old layout pin can go from "suppressing an early break" to "suppressing the only legal break", forming an over-wide Cue that the UI/export layers cannot re-wrap. Each round removes only the `nobreak`s inside over-wide Cues, so the canonical automatic ladder regains the right to break; returns the number actually removed.
pub fn remove_overwide_nobreaks(doc: &mut TranscriptDoc, params: &CueParams) -> usize {
    let budget = LayoutProfile::for_doc(doc).cue_width_budget(params);
    let profile = doc.layout_profile_id().to_owned();
    let mut removed = 0usize;
    loop {
        let cues = derive_cues(doc, params);
        let mut targets = BTreeSet::new();
        for cue in cues {
            if visual_width(&cue.text(doc)) <= budget {
                continue;
            }
            for &word_index in cue.word_indices.iter().take(cue.word_indices.len() - 1) {
                let id = &doc.words[word_index].id;
                let user = doc.breaks.get(id) == Some(&BreakOverride::Nobreak);
                let auto = doc
                    .auto_breaks
                    .get(&profile)
                    .and_then(|table| table.get(id))
                    == Some(&BreakOverride::Nobreak);
                if user || auto {
                    targets.insert(id.clone());
                }
            }
        }
        if targets.is_empty() {
            break;
        }
        removed += targets.len();
        for id in targets {
            doc.breaks.remove(&id);
            if let Some(table) = doc.auto_breaks.get_mut(&profile) {
                table.remove(&id);
            }
        }
        doc.auto_breaks.retain(|_, table| !table.is_empty());
    }
    removed
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cue::derive_cues;
    use crate::doc::{DocEngine, DocMedia, Speaker};

    fn doc_with_words(words: Vec<Word>) -> TranscriptDoc {
        let mut doc = TranscriptDoc::new(
            DocMedia {
                id: None,
                path: None,
                hash: "sha256-00".to_owned(),
                duration: 1000.0,
                sample_rate: None,
            },
            "en",
            DocEngine {
                name: "test".to_owned(),
                version: None,
                aligned_words: true,
            },
        );
        for sp in ["s1", "s2"] {
            doc.speakers.insert(
                sp.to_owned(),
                Speaker {
                    name: sp.to_uppercase(),
                    hue: None,
                },
            );
        }
        doc.words = words;
        doc
    }

    fn w(id: &str, t0: f64, t1: f64, text: &str) -> Word {
        Word {
            id: id.to_owned(),
            t0,
            t1,
            text: text.to_owned(),
            sp: "s1".to_owned(),
            glue: false,
        }
    }

    fn cue_texts(doc: &TranscriptDoc) -> Vec<String> {
        derive_cues(doc, &CueParams::default())
            .iter()
            .map(|cue| cue.text(doc))
            .collect()
    }

    fn auto_table(doc: &TranscriptDoc) -> BTreeMap<String, BreakOverride> {
        doc.auto_breaks
            .get(doc.layout_profile_id())
            .cloned()
            .unwrap_or_default()
    }

    #[test]
    fn english_source_cues_preserve_phrases_and_clause_punctuation() {
        let cases: serde_json::Value = serde_json::from_str(include_str!(
            "../tests/fixtures/align/source-cue-boundaries.json"
        ))
        .unwrap();
        for case in cases.as_array().unwrap() {
            let words: Vec<Word> = serde_json::from_value(case["words"].clone()).unwrap();
            let mut doc = doc_with_words(words.clone());
            apply_balanced_cues(&mut doc, &CueParams::default());
            let cues = derive_cues(&doc, &CueParams::default());
            let texts: Vec<_> = cues.iter().map(|cue| cue.text(&doc)).collect();
            eprintln!("{}: {texts:?}", case["name"]);
            for phrase in case["protected"].as_array().unwrap() {
                let phrase = phrase.as_str().unwrap();
                assert!(
                    texts.iter().any(|text| text.contains(phrase)),
                    "{phrase}: {texts:?}"
                );
            }
            for id in case["breakAfter"].as_array().unwrap() {
                assert!(
                    cues.iter()
                        .any(|cue| doc.words[*cue.word_indices.last().unwrap()].id
                            == id.as_str().unwrap()),
                    "{id}: {texts:?}"
                );
            }
            assert_eq!(doc.words, words);
            assert!(doc.breaks.is_empty());
            assert!(!apply_balanced_cues(&mut doc, &CueParams::default()));
        }
    }

    #[test]
    fn semantic_guards_yield_to_user_and_paragraph_boundaries() {
        let mut doc = doc_with_words(vec![
            w("a", 0.0, 1.0, "national"),
            w("b", 1.0, 2.0, "security,"),
            w("c", 2.0, 2.5, "we"),
            w("d", 2.5, 3.0, "agree."),
        ]);
        doc.breaks.insert("a".into(), BreakOverride::Break);
        doc.breaks.insert("b".into(), BreakOverride::Nobreak);
        let user = doc.breaks.clone();
        apply_balanced_cues(&mut doc, &CueParams::default());
        assert_eq!(cue_texts(&doc), ["national", "security, we agree."]);
        assert_eq!(doc.breaks, user);
        doc.breaks.clear();
        doc.para_breaks.insert("b".into(), true);
        apply_balanced_cues(&mut doc, &CueParams::default());
        assert_eq!(cue_texts(&doc)[0], "national");
    }

    #[test]
    fn indivisible_phrase_can_exceed_width_without_an_illegal_cut() {
        let mut doc = doc_with_words(vec![
            w("a", 0.0, 1.0, "national"),
            w("b", 1.0, 2.0, "security"),
        ]);
        let params = CueParams {
            max_chars: 8,
            ..CueParams::default()
        };
        apply_balanced_cues(&mut doc, &params);
        let cues = derive_cues(&doc, &params);
        assert_eq!(cues.len(), 1);
        assert_eq!(cues[0].text(&doc), "national security");
        assert_eq!(cue_layout_stats(&doc, &params).over_width, 1);
        assert!(!apply_balanced_cues(&mut doc, &params));
    }

    #[test]
    fn english_guards_do_not_change_other_language_layouts() {
        let words = vec![w("a", 0.0, 1.0, "national"), w("b", 1.0, 2.0, "security")];
        let mut doc = doc_with_words(words);
        doc.lang = "de".into();
        let params = CueParams {
            max_chars: 8,
            ..CueParams::default()
        };
        apply_balanced_cues(&mut doc, &params);
        assert_eq!(derive_cues(&doc, &params).len(), 2);
    }

    #[test]
    fn long_english_transcript_preserves_every_word_and_legal_seams() {
        let phrase = [
            "we", "can", "use", "a", "model", "for", "national", "security",
        ];
        let words: Vec<_> = (0..16_000)
            .map(|i| {
                w(
                    &format!("w{i}"),
                    i as f64 * 0.3,
                    (i + 1) as f64 * 0.3,
                    phrase[i % phrase.len()],
                )
            })
            .collect();
        let mut doc = doc_with_words(words);
        apply_balanced_cues(&mut doc, &CueParams::default());
        let cues = derive_cues(&doc, &CueParams::default());
        assert_eq!(
            cues.iter().map(|cue| cue.word_indices.len()).sum::<usize>(),
            doc.words.len()
        );
        let texts: Vec<_> = doc.words.iter().map(|word| word.text.as_str()).collect();
        for cue in &cues {
            let end = *cue.word_indices.last().unwrap() + 1;
            let start = end.saturating_sub(3);
            assert!(
                english_cue_boundary_issue(&texts[start..(end + 3).min(texts.len())], end - start)
                    .is_none()
            );
        }
        assert_eq!(cue_layout_stats(&doc, &CueParams::default()).over_width, 0);
    }

    /// Real failure sample A: an overflow hard break throws the last word of a sentence into a near-zero-duration orphan Cue (0.58 s < 1 s). After the DP, the seam moves back to where line width is balanced and the orphan disappears; the result goes only into `autoBreaks`. The difference from the old pairwise optimizer: the old one moved it to `…beginning to | reshape…`, but the DP penalizes the dangling infinitive `to` (plan §3.3 forbidden boundary), so it picks `…beginning | to reshape…`.
    #[test]
    fn overflow_orphan_tail_is_rebalanced() {
        let mut doc = doc_with_words(vec![
            w("g1.0", 65.0, 65.3, "and"),
            w("g1.1", 65.3, 65.6, "how"),
            w("g1.2", 65.6, 65.9, "AI"),
            w("g1.3", 65.9, 66.1, "is"),
            w("g1.4", 66.1, 66.8, "beginning"),
            w("g1.5", 66.8, 67.0, "to"),
            w("g1.6", 67.0, 67.6, "reshape"),
            w("g1.7", 67.6, 67.8, "the"),
            w("g1.8", 67.8, 68.15, "environment."),
            // Following sentence: the orphan tail cannot borrow display time from the end of the media.
            w("g2.0", 68.5, 69.2, "Modern"),
            w("g2.1", 69.2, 69.9, "workflows"),
            w("g2.2", 69.9, 70.6, "changed."),
        ]);
        // Greedy derivation with no layout: the last word of the sentence is thrown out by an overflow hard break.
        assert_eq!(
            cue_texts(&doc)[0..2],
            [
                "and how AI is beginning to reshape the".to_owned(),
                "environment.".to_owned(),
            ]
        );
        assert!(ensure_balanced_cue_layout(&mut doc, &CueParams::default()));
        assert_eq!(
            cue_texts(&doc),
            vec![
                "and how AI is beginning".to_owned(),
                "to reshape the environment.".to_owned(),
                "Modern workflows changed.".to_owned(),
            ]
        );
        assert!(doc.breaks.is_empty(), "优化器不得写 breaks");
        assert_eq!(auto_table(&doc).get("g1.4"), Some(&BreakOverride::Break));
    }

    /// Real failure sample B: a pause break squeezed the sentence-tail fragment into too narrow a window (23.5 cps > 21). The DP moves the seam earlier, so the second line gets a full window that includes the pause.
    #[test]
    fn pause_break_too_fast_tail_moves_seam_earlier() {
        let mut doc = doc_with_words(vec![
            w("g1.0", 70.0, 70.4, "Modern"),
            w("g1.1", 70.4, 70.8, "IDEs"),
            w("g1.2", 70.8, 71.2, "bring"),
            w("g1.3", 71.2, 71.8, "together"),
            w("g1.4", 71.8, 72.9, "tools"),
            w("g1.5", 72.9, 73.1, "that"),
            w("g1.6", 73.1, 73.4, "were"),
            // ≥0.6 s pause: greedy derivation breaks the line here.
            w("g1.7", 74.1, 74.25, "once"),
            w("g1.8", 74.25, 74.5, "managed"),
            w("g1.9", 74.5, 74.75, "separately."),
            w("g2.0", 74.9, 75.5, "Next"),
            w("g2.1", 75.5, 76.1, "topic."),
        ]);
        assert_eq!(
            cue_texts(&doc)[0..2],
            [
                "Modern IDEs bring together tools that were".to_owned(),
                "once managed separately.".to_owned(),
            ]
        );
        assert!(ensure_balanced_cue_layout(&mut doc, &CueParams::default()));
        let texts = cue_texts(&doc);
        assert_eq!(texts[0], "Modern IDEs bring together tools");
        assert_eq!(texts[1], "that were once managed separately.");
        assert!(doc.breaks.is_empty());
    }

    /// Real failure sample C (regression): the speech rate of the whole segment hugs the CPS ceiling. If the old optimizer's merge branch were relaxed to 2× the target, it would weld two compliant 40-wide lines into one 81-wide line and pin a `nobreak`. The DP treats > `max_chars` as infinite: whatever the rearrangement, no over-wide line may appear, and no single-word orphan tail may be thrown out to reduce width.
    #[test]
    fn merge_is_capped_at_single_line_budget() {
        let mut doc = doc_with_words(vec![
            w("g16.0", 56.70, 56.88, "It's"),
            w("g16.1", 56.88, 57.06, "been"),
            w("g16.2", 57.06, 57.35, "working"),
            w("g16.3", 57.35, 57.60, "really"),
            w("g16.4", 57.60, 57.78, "well."),
            w("g17.0", 57.81, 57.97, "We've"),
            w("g17.1", 57.97, 58.37, "been"),
            w("g17.2", 58.37, 58.45, "running"),
            w("g17.3", 58.45, 58.93, "it"),
            w("g17.4", 58.93, 59.09, "for"),
            w("g17.5", 59.09, 59.10, "a"),
            w("g17.6", 59.10, 59.19, "few"),
            w("g17.7", 59.19, 59.43, "weeks"),
            w("g17.8", 59.43, 59.67, "in"),
            w("g17.9", 59.67, 59.76, "shadow"),
            w("g17.10", 59.76, 60.23, "and"),
            w("g17.11", 60.23, 60.32, "it's"),
            w("g17.12", 60.55, 61.02, "been"),
            w("g17.13", 61.02, 61.03, "consistently"),
            w("g17.14", 61.03, 61.12, "faster"),
            w("g17.15", 61.12, 61.67, "than"),
            w("g17.16", 61.67, 62.45, "where"),
            w("g17.17", 62.45, 63.08, "our"),
            w("g17.18", 63.08, 63.24, "current"),
            w("g17.19", 63.24, 63.49, "implementation"),
            w("g17.20", 63.49, 63.78, "is."),
        ]);
        let params = CueParams::default();
        let budget = params.max_chars + params.overflow_slack;
        // Greedy baseline: two lines of 40 each, both within the single-line budget.
        let greedy = cue_texts(&doc);
        assert_eq!(greedy[1], "We've been running it for a few weeks in");
        assert_eq!(greedy[2], "shadow and it's been consistently faster");

        ensure_balanced_cue_layout(&mut doc, &params);
        let texts = cue_texts(&doc);
        let stats = cue_layout_stats(&doc, &params);
        // No over-wide single line may appear.
        assert_eq!(stats.over_width, 0, "layout: {texts:?}");
        assert!(stats.longest_width <= budget, "layout: {texts:?}");
        // The start and end of the sentence do not move: a sentence end is a hard boundary.
        assert_eq!(texts[0], "It's been working really well.");
        assert!(texts.last().unwrap().ends_with("implementation is."));
        // Nor may a single-word orphan tail be thrown out to reduce width.
        let cues = derive_cues(&doc, &params);
        assert!(
            cues.iter().all(|cue| cue.word_indices.len() >= 2),
            "orphan tail: {texts:?}"
        );
        assert!(doc.breaks.is_empty());
    }

    /// The pin set is a minimal covering set: derived replay must reproduce the DP layout byte for byte; re-running converges (idempotent).
    #[test]
    fn emitted_pins_reproduce_dp_layout_and_rerun_is_idempotent() {
        let mut doc = doc_with_words(vec![
            w("g1.0", 65.0, 65.3, "and"),
            w("g1.1", 65.3, 65.6, "how"),
            w("g1.2", 65.6, 65.9, "AI"),
            w("g1.3", 65.9, 66.1, "is"),
            w("g1.4", 66.1, 66.8, "beginning"),
            w("g1.5", 66.8, 67.0, "to"),
            w("g1.6", 67.0, 67.6, "reshape"),
            w("g1.7", 67.6, 67.8, "the"),
            w("g1.8", 67.8, 68.15, "environment."),
            w("g2.0", 68.5, 69.2, "Modern"),
            w("g2.1", 69.2, 69.9, "workflows"),
            w("g2.2", 69.9, 70.6, "changed."),
        ]);
        let params = CueParams::default();
        // The DP's target layout (the set of word-index ends) matches the replay of derive_cues word for word after the pins are written.
        let visible: Vec<Word> = doc.words.clone();
        let profile = LayoutProfile::default_profile();
        let optimizer = Optimizer {
            words: &visible,
            seams: classify_seams(
                &visible,
                &doc.breaks,
                &doc.para_breaks,
                true,
                &params,
                profile.min_duration_sec,
            ),
            params: &params,
            profile: &profile,
            budget: reading_budget(&visible, &profile),
            english: true,
        };
        let desired = optimizer.desired_ends();
        assert!(apply_balanced_cues(&mut doc, &params));
        let replayed: BTreeSet<usize> = derive_cues(&doc, &params)
            .iter()
            .map(|cue| *cue.word_indices.last().unwrap())
            .collect();
        assert_eq!(replayed, desired);
        // The second computation converges: when the layout is already balanced, it produces no further change.
        let pins = auto_table(&doc);
        assert!(!apply_balanced_cues(&mut doc, &params));
        assert_eq!(auto_table(&doc), pins);
        assert!(!ensure_balanced_cue_layout(&mut doc, &params));
    }

    /// A greedy layout that already has zero deviation: writes no automatic pins and does not touch the document.
    #[test]
    fn well_formed_greedy_layout_needs_no_auto_pins() {
        let mut doc = doc_with_words(vec![
            w("g1.0", 0.0, 0.5, "This"),
            w("g1.1", 0.5, 1.0, "line"),
            w("g1.2", 1.0, 1.5, "reads"),
            w("g1.3", 1.5, 2.0, "fine."),
            w("g2.0", 2.5, 3.0, "So"),
            w("g2.1", 3.0, 3.5, "does"),
            w("g2.2", 3.5, 4.0, "this"),
            w("g2.3", 4.0, 4.5, "one."),
        ]);
        let before = doc.clone();
        assert!(!ensure_balanced_cue_layout(&mut doc, &CueParams::default()));
        assert_eq!(doc, before);
    }

    /// Sentence-end and speaker-boundary seams cannot be moved by rearrangement.
    #[test]
    fn dp_never_crosses_sentence_or_speaker_boundaries() {
        let mut words = vec![
            w("g1.0", 0.0, 0.2, "Hi."),
            w("g2.0", 0.2, 0.5, "Quick"),
            w("g2.1", 0.5, 0.7, "reply."),
        ];
        words[1].sp = "s2".to_owned();
        words[2].sp = "s2".to_owned();
        let mut doc = doc_with_words(words);
        ensure_balanced_cue_layout(&mut doc, &CueParams::default());
        let cues = derive_cues(&doc, &CueParams::default());
        assert_eq!(cues.len(), 2);
        assert_eq!(cues[0].text(&doc), "Hi.");
    }

    /// User pins are hard constraints: the optimizer always runs, but `break` always breaks and `nobreak` never breaks, and the `breaks` table is kept as is.
    #[test]
    fn user_pins_are_respected_and_never_rewritten() {
        let mut doc = doc_with_words(vec![
            w("g1.0", 65.0, 65.3, "and"),
            w("g1.1", 65.3, 65.6, "how"),
            w("g1.2", 65.6, 65.9, "AI"),
            w("g1.3", 65.9, 66.1, "is"),
            w("g1.4", 66.1, 66.8, "beginning"),
            w("g1.5", 66.8, 67.0, "to"),
            w("g1.6", 67.0, 67.6, "reshape"),
            w("g1.7", 67.6, 67.8, "the"),
            w("g1.8", 67.8, 68.15, "environment."),
            w("g2.0", 68.5, 69.2, "Modern"),
            w("g2.1", 69.2, 69.9, "workflows"),
            w("g2.2", 69.9, 70.6, "changed."),
        ]);
        // The user wants a break after "AI" and no break after "to".
        doc.breaks.insert("g1.2".to_owned(), BreakOverride::Break);
        doc.breaks.insert("g1.5".to_owned(), BreakOverride::Nobreak);
        let user = doc.breaks.clone();
        ensure_balanced_cue_layout(&mut doc, &CueParams::default());
        assert_eq!(doc.breaks, user);
        let texts = cue_texts(&doc);
        assert_eq!(texts[0], "and how AI");
        assert!(
            !texts.iter().any(|text| text.ends_with(" to")),
            "nobreak 被越过：{texts:?}"
        );
        assert!(texts.iter().all(|text| visual_width(text) <= 42));
        // The automatic table does not repeat keys the user has already pinned.
        for id in user.keys() {
            assert!(!auto_table(&doc).contains_key(id));
        }
    }

    /// Legacy documents: optimizer pins still live in `breaks`. On load they are treated as user intent: the derived result is byte-for-byte identical to the 0.3-era output, and re-running the optimizer will not rewrite them.
    #[test]
    fn legacy_optimizer_pins_in_breaks_are_treated_as_user_intent() {
        let words = vec![
            w("g1.0", 65.0, 65.3, "and"),
            w("g1.1", 65.3, 65.6, "how"),
            w("g1.2", 65.6, 65.9, "AI"),
            w("g1.3", 65.9, 66.1, "is"),
            w("g1.4", 66.1, 66.8, "beginning"),
            w("g1.5", 66.8, 67.0, "to"),
            w("g1.6", 67.0, 67.6, "reshape"),
            w("g1.7", 67.6, 67.8, "the"),
            w("g1.8", 67.8, 68.15, "environment."),
            w("g2.0", 68.5, 69.2, "Modern"),
            w("g2.1", 69.2, 69.9, "workflows"),
            w("g2.2", 69.9, 70.6, "changed."),
        ];
        // 0.3-era optimizer output: the minimal pin set sits directly in breaks.
        let mut legacy = doc_with_words(words.clone());
        let mut fresh = doc_with_words(words);
        apply_balanced_cues(&mut fresh, &CueParams::default());
        legacy.breaks = auto_table(&fresh);
        assert!(!legacy.breaks.is_empty());
        let legacy_layout = cue_texts(&legacy);
        assert_eq!(legacy_layout, cue_texts(&fresh));

        // Re-run: breaks are unchanged, the layout is unchanged, and no automatic pins are needed.
        let pins = legacy.breaks.clone();
        ensure_balanced_cue_layout(&mut legacy, &CueParams::default());
        assert_eq!(legacy.breaks, pins);
        assert_eq!(cue_texts(&legacy), legacy_layout);
        assert!(auto_table(&legacy).is_empty());
    }

    /// Paragraph-pin boundaries explicitly write a break into the pin set (mirror implementations have no pre-paragraph seal logic).
    #[test]
    fn paragraph_pin_seams_get_explicit_break_pins() {
        let mut doc = doc_with_words(vec![
            w("g1.0", 0.0, 0.4, "First"),
            w("g1.1", 0.4, 0.8, "paragraph"),
            w("g1.2", 0.8, 1.2, "line"),
            w("g2.0", 1.4, 1.8, "second"),
            w("g2.1", 1.8, 2.2, "starts"),
            w("g2.2", 2.2, 2.6, "here."),
        ]);
        doc.para_breaks.insert("g2.0".to_owned(), true);
        let breaks = balanced_cue_breaks(&doc, &CueParams::default());
        assert_eq!(breaks.get("g1.2"), Some(&BreakOverride::Break));
    }

    /// When a user nobreak welds a line over budget, the DP still has a solution (the infinite penalty keeps it finite), and it does not produce over-width output beyond the user's own constraint.
    #[test]
    fn forbidden_seams_keep_the_dp_solvable() {
        let words = (0..12)
            .map(|index| {
                w(
                    &format!("g1.{index}"),
                    index as f64 * 0.3,
                    index as f64 * 0.3 + 0.25,
                    "alpha",
                )
            })
            .collect();
        let mut doc = doc_with_words(words);
        for index in 0..11 {
            doc.breaks
                .insert(format!("g1.{index}"), BreakOverride::Nobreak);
        }
        let params = CueParams::default();
        ensure_balanced_cue_layout(&mut doc, &params);
        assert_eq!(derive_cues(&doc, &params).len(), 1);
        assert!(auto_table(&doc).is_empty());
    }

    #[test]
    fn overwide_nobreak_repair_removes_only_pins_that_weld_an_overwide_cue() {
        let words = (0..12)
            .map(|index| {
                w(
                    &format!("g1.{index}"),
                    index as f64 * 0.3,
                    index as f64 * 0.3 + 0.25,
                    "alpha",
                )
            })
            .collect();
        let mut doc = doc_with_words(words);
        for index in 0..11 {
            doc.breaks
                .insert(format!("g1.{index}"), BreakOverride::Nobreak);
        }
        let params = CueParams::default();
        assert!(cue_layout_stats(&doc, &params).over_width > 0);

        assert_eq!(remove_overwide_nobreaks(&mut doc, &params), 11);
        assert_eq!(cue_layout_stats(&doc, &params).over_width, 0);
    }

    /// Pin-set snapshot of the `default` profile. Sample C once broke at `for | a few weeks`; the English semantic gate was changed to `weeks | in shadow`, and the other two baselines are unchanged.
    #[test]
    fn default_profile_pins_preserve_legal_reference_seams() {
        let expected: [&[(&str, BreakOverride)]; 3] = [
            &[("g1.4", BreakOverride::Break)],
            &[("g1.4", BreakOverride::Break)],
            &[("g17.7", BreakOverride::Break)],
        ];
        for (words, pins) in [sample_a(), sample_b(), sample_c()]
            .into_iter()
            .zip(expected)
        {
            let mut doc = doc_with_words(words);
            assert_eq!(doc.layout_profile_id(), "default");
            apply_balanced_cues(&mut doc, &CueParams::default());
            let want: BTreeMap<String, BreakOverride> = pins
                .iter()
                .map(|(id, value)| ((*id).to_owned(), *value))
                .collect();
            assert_eq!(auto_table(&doc), want);
        }
    }

    /// Two-line profile (plan §3.4): the width budget grows to 2 × maxChars, and the DP uses `nobreak` to weld two compliant lines of text into one Cue. In-line wrapping is recomputed by `line_break_plan` and must not exceed two lines. `cue_layout_stats` / `remove_overwide_nobreaks` judge over-width against the profile budget, so a two-line Cue is not treated as a regression. The same document under `default` is still two single-line Cues.
    #[test]
    fn two_line_profile_welds_two_balanced_lines_into_one_cue() {
        let text =
            "the quick brown fox jumps over the lazy dog while the cat watches from the fence.";
        let words: Vec<Word> = text
            .split(' ')
            .enumerate()
            .map(|(index, word)| {
                let t0 = 10.0 + index as f64 * 0.3;
                w(&format!("g1.{index}"), t0, t0 + 0.25, word)
            })
            .collect();
        let params = CueParams::default();

        let mut single = doc_with_words(words.clone());
        ensure_balanced_cue_layout(&mut single, &params);
        assert_eq!(cue_texts(&single).len(), 2, "{:?}", cue_texts(&single));

        let mut two = doc_with_words(words);
        two.layout_profile = Some("two-line".to_owned());
        assert!(ensure_balanced_cue_layout(&mut two, &params));
        let texts = cue_texts(&two);
        assert_eq!(texts, vec![text.to_owned()]);
        assert!(visual_width(&texts[0]) <= 2 * params.max_chars);
        let pins = auto_table(&two);
        assert!(!pins.is_empty());
        assert!(pins.values().all(|value| *value == BreakOverride::Nobreak));
        assert!(two.breaks.is_empty());
        assert!(!two.auto_breaks.contains_key("default"));
        // In-line wrapping is a render-time projection; here we only verify that the recomputed wrap is at most two lines and that each line is compliant.
        let word_texts: Vec<&str> = two.words.iter().map(|word| word.text.as_str()).collect();
        let plan = crate::layout_profile::line_break_plan_with(
            &word_texts,
            2,
            params.max_chars,
            visual_width,
        );
        assert_eq!(plan.len(), 2, "{plan:?}");
        for line in &plan {
            let line_text = join_word_texts(line.iter().map(|&index| word_texts[index]));
            assert!(visual_width(&line_text) <= params.max_chars, "{line_text}");
        }
        // Profile budget: a two-line Cue is not over budget, and over-width repair does not split it.
        let stats = cue_layout_stats(&two, &params);
        assert_eq!(stats.over_width, 0);
        assert_eq!(remove_overwide_nobreaks(&mut two, &params), 0);
        assert_eq!(cue_texts(&two), vec![text.to_owned()]);
        // Re-running is idempotent.
        assert!(!ensure_balanced_cue_layout(&mut two, &params));
    }

    fn sample_a() -> Vec<Word> {
        vec![
            w("g1.0", 65.0, 65.3, "and"),
            w("g1.1", 65.3, 65.6, "how"),
            w("g1.2", 65.6, 65.9, "AI"),
            w("g1.3", 65.9, 66.1, "is"),
            w("g1.4", 66.1, 66.8, "beginning"),
            w("g1.5", 66.8, 67.0, "to"),
            w("g1.6", 67.0, 67.6, "reshape"),
            w("g1.7", 67.6, 67.8, "the"),
            w("g1.8", 67.8, 68.15, "environment."),
            w("g2.0", 68.5, 69.2, "Modern"),
            w("g2.1", 69.2, 69.9, "workflows"),
            w("g2.2", 69.9, 70.6, "changed."),
        ]
    }
    fn sample_b() -> Vec<Word> {
        vec![
            w("g1.0", 70.0, 70.4, "Modern"),
            w("g1.1", 70.4, 70.8, "IDEs"),
            w("g1.2", 70.8, 71.2, "bring"),
            w("g1.3", 71.2, 71.8, "together"),
            w("g1.4", 71.8, 72.9, "tools"),
            w("g1.5", 72.9, 73.1, "that"),
            w("g1.6", 73.1, 73.4, "were"),
            w("g1.7", 74.1, 74.25, "once"),
            w("g1.8", 74.25, 74.5, "managed"),
            w("g1.9", 74.5, 74.75, "separately."),
            w("g2.0", 74.9, 75.5, "Next"),
            w("g2.1", 75.5, 76.1, "topic."),
        ]
    }
    fn sample_c() -> Vec<Word> {
        vec![
            w("g16.0", 56.70, 56.88, "It's"),
            w("g16.1", 56.88, 57.06, "been"),
            w("g16.2", 57.06, 57.35, "working"),
            w("g16.3", 57.35, 57.60, "really"),
            w("g16.4", 57.60, 57.78, "well."),
            w("g17.0", 57.81, 57.97, "We've"),
            w("g17.1", 57.97, 58.37, "been"),
            w("g17.2", 58.37, 58.45, "running"),
            w("g17.3", 58.45, 58.93, "it"),
            w("g17.4", 58.93, 59.09, "for"),
            w("g17.5", 59.09, 59.10, "a"),
            w("g17.6", 59.10, 59.19, "few"),
            w("g17.7", 59.19, 59.43, "weeks"),
            w("g17.8", 59.43, 59.67, "in"),
            w("g17.9", 59.67, 59.76, "shadow"),
            w("g17.10", 59.76, 60.23, "and"),
            w("g17.11", 60.23, 60.32, "it's"),
            w("g17.12", 60.55, 61.02, "been"),
            w("g17.13", 61.02, 61.03, "consistently"),
            w("g17.14", 61.03, 61.12, "faster"),
            w("g17.15", 61.12, 61.67, "than"),
            w("g17.16", 61.67, 62.45, "where"),
            w("g17.17", 62.45, 63.08, "our"),
            w("g17.18", 63.08, 63.24, "current"),
            w("g17.19", 63.24, 63.49, "implementation"),
            w("g17.20", 63.49, 63.78, "is."),
        ]
    }

    /// Stale automatic nobreaks are likewise removed by over-width repair.
    #[test]
    fn overwide_repair_also_drops_stale_auto_nobreaks() {
        let words = (0..12)
            .map(|index| {
                w(
                    &format!("g1.{index}"),
                    index as f64 * 0.3,
                    index as f64 * 0.3 + 0.25,
                    "alpha",
                )
            })
            .collect();
        let mut doc = doc_with_words(words);
        let table = doc.auto_breaks.entry("default".to_owned()).or_default();
        for index in 0..11 {
            table.insert(format!("g1.{index}"), BreakOverride::Nobreak);
        }
        let params = CueParams::default();
        assert!(cue_layout_stats(&doc, &params).over_width > 0);
        assert_eq!(remove_overwide_nobreaks(&mut doc, &params), 11);
        assert_eq!(cue_layout_stats(&doc, &params).over_width, 0);
        assert!(doc.auto_breaks.is_empty());
    }

    fn seam_grades(words: &[Word]) -> Vec<f64> {
        let params = CueParams::default();
        (0..words.len() - 1)
            .map(|k| seam_grade(&words[k], &words[k + 1], &params))
            .collect()
    }

    #[test]
    fn a_glued_seam_has_no_space_and_grades_as_a_midword_seam() {
        let mut words = vec![
            w("a", 0.0, 0.2, "ab"),
            w("b", 0.2, 0.4, "cd"),
            w("c", 0.4, 0.6, "ef"),
        ];
        words[1].glue = true;
        assert_eq!(seam_grades(&words), [SEAM_CJK_MIDWORD, SEAM_WORD]);
        let doc = doc_with_words(words);
        assert_eq!(cue_texts(&doc), ["abcd ef"]);
        // The wrap budget uses the same measure: a seam that sticks to the previous character takes up no separator width.
        assert_eq!(
            crate::atomize::join_prefix_char_lens(&doc.words),
            vec![2, 4, 7]
        );
    }

    /// **Regression lock**: the expected values are hard-coded one by one. The four samples cover the seam levels 0.3 / 0.5 / 0.8 / 3.0 and the 1.5 dangling penalty.
    #[test]
    fn seam_grade_and_dangling_cost_match_the_locked_baseline() {
        let expected: [(&[f64], &[f64]); 4] = [
            (
                &[0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8],
                &[1.5, 0.0, 0.0, 0.0, 0.0, 1.5, 0.0, 1.5, 0.0, 0.0, 0.0],
            ),
            (
                &[0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.5, 0.8, 0.8, 0.8, 0.8],
                &[0.0; 11],
            ),
            (&[0.8; 25], {
                const C: [f64; 25] = {
                    let mut values = [0.0; 25];
                    values[10] = 1.5;
                    values[15] = 1.5;
                    values
                };
                &C
            }),
            (
                &[
                    3.0, 3.0, 3.0, 3.0, 3.0, 3.0, 0.8, 0.3, 3.0, 3.0, 3.0, 3.0, 3.0, 3.0, 3.0, 3.0,
                    3.0, 3.0, 3.0, 0.8,
                ],
                &[
                    0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1.5, 0.0, 0.0, 0.0, 0.0, 0.0, 1.5, 0.0, 0.0, 0.0,
                    0.0, 1.5, 0.0, 0.0,
                ],
            ),
        ];
        for (words, (grades, dangling)) in [sample_a(), sample_b(), sample_c()]
            .into_iter()
            .zip(expected)
        {
            assert_eq!(seam_grades(&words), grades.to_vec());
            let actual: Vec<f64> = (0..words.len() - 1)
                .map(|k| dangling_cost(&words[k]))
                .collect();
            assert_eq!(actual, dangling.to_vec());
        }
    }
}
