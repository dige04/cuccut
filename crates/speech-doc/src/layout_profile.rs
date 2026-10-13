//! `LayoutProfile`: table-driven source of subtitle layout thresholds (alignment block plan §3.1).
//!
//! Previously the optimizer ([`crate::layout`]), target-language splitting, check, and the CPS coloring on each surface each kept their own copy
//! of constants: 13/21 in `layout.rs`, `split.rs::target_reading_cps`, and 9/13/17/21 in the gpui subtitle list. Here they are consolidated into one data structure looked up by id; the values of the `default` profile
//! are these very constants, so switching to a profile does not change any existing behavior.
//!
//! Adding a new profile (vertical screen, Netflix two-line, etc.) only means adding one set of
//! data to [`LayoutProfile::by_id`]; it does not touch the algorithm.

use crate::atomize::{JoinWord, word_sep};
use crate::cue::CueParams;
use crate::doc::TranscriptDoc;
use crate::split::{TransParams, primary_subtag};

/// Default profile id (matches [`crate::doc::DEFAULT_LAYOUT_PROFILE`]).
pub const DEFAULT_PROFILE_ID: &str = crate::doc::DEFAULT_LAYOUT_PROFILE;
/// Two-line profile id: the source-side per-line width is the same as `default`, `max_lines = 2`, and everything else
/// equals `default` — used to prove that a profile is just data (plan §3.4 / D6).
pub const TWO_LINE_PROFILE_ID: &str = "two-line";
/// List of known profile ids (hint for the allowed values of the CLI `--layout-profile`).
pub const KNOWN_PROFILE_IDS: &[&str] = &[DEFAULT_PROFILE_ID, TWO_LINE_PROFILE_ID];

/// Reading-speed budget (characters per second).
///
/// - `warn` / `bad`: the two tiers of upper limits for coloring and the optimizer (CJK 9/13, others 17/21);
/// - `reading`: the delivery speed for the target language, at which the text “must be finished reading”, in the same table as
///   `split.rs::target_reading_cps` (zh 9 / ja, ko 13 / th 15 / ar, hi 18 /
///   others 21), for callers such as `target_required_seconds` to migrate to.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct CpsBudget {
    pub warn: f64,
    pub bad: f64,
    pub reading: f64,
}

/// CPS table: warn/bad by script, reading by primary-language subtag.
#[derive(Debug, Clone, PartialEq)]
pub struct CpsTable {
    pub cjk_warn: f64,
    pub cjk_bad: f64,
    pub latin_warn: f64,
    pub latin_bad: f64,
    /// Primary-language subtag → delivery reading speed; default [`CpsTable::reading_default`].
    pub reading: Vec<(&'static str, f64)>,
    pub reading_default: f64,
}

impl CpsTable {
    /// Whether the primary-language subtag takes the warn/bad tier of CJK.
    pub fn is_cjk_lang(lang: &str) -> bool {
        matches!(primary_subtag(lang).as_str(), "zh" | "ja" | "ko")
    }

    /// Takes warn/bad by script (CJK or not); `reading` takes the default tier.
    pub fn for_script(&self, cjk: bool) -> CpsBudget {
        if cjk {
            CpsBudget {
                warn: self.cjk_warn,
                bad: self.cjk_bad,
                reading: self.reading_default,
            }
        } else {
            CpsBudget {
                warn: self.latin_warn,
                bad: self.latin_bad,
                reading: self.reading_default,
            }
        }
    }

    /// Takes all three tiers by language.
    pub fn for_lang(&self, lang: &str) -> CpsBudget {
        let subtag = primary_subtag(lang);
        let mut budget = self.for_script(Self::is_cjk_lang(lang));
        budget.reading = self
            .reading
            .iter()
            .find(|(tag, _)| *tag == subtag.as_str())
            .map(|(_, cps)| *cps)
            .unwrap_or(self.reading_default);
        budget
    }
}

/// One layout profile: source Cue parameters, the three target-language thresholds, line count, CPS, and the duration / borrowed-silence convention.
#[derive(Debug, Clone, PartialEq)]
pub struct LayoutProfile {
    /// `"default"` | `"portrait"` | `"netflix-2line"` …
    pub id: String,
    /// Source subtitle §18.5 parameters (maxChars, etc.).
    pub source: CueParams,
    /// Maximum lines per subtitle; M1 keeps 1 (line breaks are still a render-time projection and are not persisted).
    pub max_lines: u8,
    /// Reading-speed table.
    pub cps: CpsTable,
    /// Minimum display duration (currently `min_cue_display_sec`).
    pub min_duration_sec: f64,
    /// Maximum display duration (currently the align engine's `LONG_DWELL_SECONDS`).
    pub max_duration_sec: f64,
    /// Display padding: borrows lead-in time from the real gap before the cue (studio `SUB_TIMING.leadIn`).
    pub lead_in_sec: f64,
    /// Display padding: borrows tail time from the real gap after the cue (studio `SUB_TIMING.tail`).
    pub tail_sec: f64,
}

impl Default for LayoutProfile {
    fn default() -> Self {
        Self::default_profile()
    }
}

impl LayoutProfile {
    /// `default` profile: its values are all of today's constants, guaranteeing zero behavioral drift.
    pub fn default_profile() -> Self {
        Self {
            id: DEFAULT_PROFILE_ID.to_owned(),
            source: CueParams::default(),
            max_lines: 1,
            cps: CpsTable {
                cjk_warn: 9.0,
                cjk_bad: 13.0,
                latin_warn: 17.0,
                latin_bad: 21.0,
                reading: vec![
                    ("zh", 9.0),
                    ("ja", 13.0),
                    ("ko", 13.0),
                    ("th", 15.0),
                    ("ar", 18.0),
                    ("hi", 18.0),
                ],
                reading_default: 21.0,
            },
            min_duration_sec: 1.0,
            max_duration_sec: 7.0,
            lead_in_sec: 0.5,
            tail_sec: 1.0,
        }
    }

    /// `two-line` profile: only changes `max_lines` to 2; all other data is identical to `default`, item by item.
    pub fn two_line_profile() -> Self {
        Self {
            id: TWO_LINE_PROFILE_ID.to_owned(),
            max_lines: 2,
            ..Self::default_profile()
        }
    }

    /// Looks up a profile by id; an unknown id returns `None` (the caller decides its own fallback).
    /// To add a new profile, just add one branch of data here.
    pub fn by_id(id: &str) -> Option<Self> {
        match id {
            DEFAULT_PROFILE_ID => Some(Self::default_profile()),
            TWO_LINE_PROFILE_ID => Some(Self::two_line_profile()),
            _ => None,
        }
    }

    /// The profile in effect for the document (`doc.layoutProfile`; an unknown id falls back to the `default` values).
    pub fn for_doc(doc: &TranscriptDoc) -> Self {
        Self::by_id_or_default(doc.layout_profile_id())
    }

    /// Visual width budget for one Cue: `max_lines × params.max_chars + overflow_slack`.
    /// Under a single-line profile this is the actual ceiling of the automatic ladder (`max_chars + overflow_slack`);
    /// under a two-line profile the optimizer may use `nobreak` to weld two lines into one Cue, so the overflow criterion,
    /// the over-width repair, and check's `source-width` must all take this budget; otherwise a valid
    /// two-line Cue would be treated as a regression. `params` lets the caller override `max_chars` (`--cue-line-length`).
    pub fn cue_width_budget(&self, params: &CueParams) -> usize {
        params.max_chars * usize::from(self.max_lines.max(1)) + params.overflow_slack
    }

    /// Looks up a profile by id; an unknown id falls back to the `default` values (the id is still the one passed in,
    /// so `autoBreaks` is still written under the profile key the caller supplied).
    pub fn by_id_or_default(id: &str) -> Self {
        Self::by_id(id).unwrap_or_else(|| Self {
            id: id.to_owned(),
            ..Self::default_profile()
        })
    }

    /// The three target-language thresholds (delegated to [`TransParams::for_lang`]).
    pub fn target(&self, lang: &str) -> TransParams {
        TransParams::for_lang(lang)
    }

    /// Gets the CPS budget by language.
    pub fn cps_for_lang(&self, lang: &str) -> CpsBudget {
        self.cps.for_lang(lang)
    }

    /// Gets the CPS budget by script (used by callers that detect CJK by sampling the text).
    pub fn cps_for_script(&self, cjk: bool) -> CpsBudget {
        self.cps.for_script(cjk)
    }

    /// Borrowed-silence convention (matching studio `subPad`): `buffer` is the display padding wanted,
    /// and `gap` is the real gap between adjacent subtitles; the amount borrowed is proportional to how much of `leadIn + tail` the gap covers.
    pub fn borrowed_pad(&self, buffer: f64, gap: f64) -> f64 {
        let cap = self.lead_in_sec + self.tail_sec;
        if cap <= 0.0 {
            return 0.0;
        }
        (gap.max(0.0) * buffer / cap).min(buffer)
    }

    /// Display window of one Cue: the word window plus the lead-in / tail padding borrowed from the real gaps on either side.
    pub fn display_window(&self, t0: f64, t1: f64, gap_prev: f64, gap_next: f64) -> f64 {
        (t1 - t0)
            + self.borrowed_pad(self.tail_sec, gap_next)
            + self.borrowed_pad(self.lead_in_sec, gap_prev)
    }
}

/// The §18.5 parameters that document-derived / optimized Cues should use: `LayoutProfile::for_doc(doc).source`.
///
/// Every consumer that derives source Cues from the transcript (the engine write path, `derive_project_rows`,
/// export, check) takes its parameters from here rather than each calling `CueParams::default()`. When a document carries a
/// `layoutProfile`, all three ends replay `autoBreaks[profile]` from the same profile data.
/// The `source` of every known profile currently equals `CueParams::default()`, so existing documents
/// see zero behavioral drift.
pub fn cue_params_for_doc(doc: &TranscriptDoc) -> CueParams {
    LayoutProfile::for_doc(doc).source
}

/// Boundary penalty for break positions within a line: no penalty if the line ends on sentence-final or clause punctuation (or is the last line); otherwise a penalty of 12
/// (matching `boundaryPenalty` in studio `sourceDisplayLines`).
const LINE_BREAK_BOUNDARY_PENALTY: i64 = 12;
/// Base score per additional line (matching the JS `100000`: line count takes priority over balance).
const LINE_BREAK_LINE_BASE: i64 = 100_000;
/// JS `Math.max(8, floor(fit))`: the width floor.
const LINE_BREAK_MIN_LIMIT: usize = 8;

/// Line-break plan within a line (plan §3.4): spreads one Cue's words evenly across
/// several lines by `max_chars_per_line`, and returns the word indices for each line. Ported from
/// `skills/cuccut/templates/studio/subtitle-rendering.js::sourceDisplayLines`
/// (same origin as `designs/cuccut-mac/app/translate-model.js`):
///
/// - total width ≤ limit ⇒ a single line;
/// - otherwise the target line count is `n = clamp(ceil(total / limit), 2, max(2, max_lines))`,
///   and the ideal line width is `ideal = min(limit, ceil(total / n))`;
/// - backward DP: each line costs `LINE_BREAK_LINE_BASE + (ideal − min(width, limit))² +
///   boundary penalty`; candidates whose line width exceeds the limit are kept only when a single word forms the line; on equal scores, the earlier line end wins
///   (consistent with the JS strict `<` update).
///
/// As long as the text fits within the `max_lines × limit` budget, the line-count clamp does not take effect and the result matches JS line by line;
/// the shared fixture `core/fixtures/subtitle-render-contract.json#lineBreaks` pins this down.
/// The two JS consumers (the Subtitle Studio page and `designs/cuccut-mac`) have been archived along with their
/// respective surfaces, so the fixture is now consumed only on the Rust side and remains the non-regression baseline for this function.
///
/// Width is counted in Unicode scalars (JS `Array.from(text).length`), and word separators follow
/// [`crate::atomize::sep_len`] (one space between Latin words, none between adjacent CJK). Line-break positions are **not persisted**: here
/// only a “two-line imbalance” score is added to the Cue DP; each rendering surface still projects its own breaks.
pub fn line_break_plan(
    words: &[&str],
    max_lines: usize,
    max_chars_per_line: usize,
) -> Vec<Vec<usize>> {
    line_break_plan_with(words, max_lines, max_chars_per_line, |text| {
        text.chars().count()
    })
}

/// Variant of [`line_break_plan`] with injectable width: the source Cue optimizer uses [`crate::atomize::visual_width`]
/// (CJK counts as 2) to stay consistent with the rest of the §18.5 scale; for Latin text the two are identical.
pub fn line_break_plan_with<W: JoinWord>(
    words: &[W],
    max_lines: usize,
    max_chars_per_line: usize,
    width: impl Fn(&str) -> usize,
) -> Vec<Vec<usize>> {
    let n = words.len();
    if n == 0 {
        return Vec::new();
    }
    let limit = max_chars_per_line.max(LINE_BREAK_MIN_LIMIT);
    // Prefix widths: `prefix[i]` is the width of the first i words concatenated; `line_width(from, to)` is obtained from
    // the prefix difference plus a correction for the separator before the first word, equivalent to measuring each concatenation in turn.
    let mut prefix = Vec::with_capacity(n + 1);
    prefix.push(0_usize);
    for (index, word) in words.iter().enumerate() {
        let sep = if index == 0 {
            0
        } else {
            word_sep(words[index - 1].join_text(), word)
        };
        prefix.push(prefix[index] + sep + width(word.join_text()));
    }
    let line_width = |from: usize, to: usize| -> usize {
        // The line does not include the separator before the `from` word.
        let lead = if from == 0 {
            0
        } else {
            word_sep(words[from - 1].join_text(), &words[from])
        };
        prefix[to + 1] - prefix[from] - lead
    };
    let total = line_width(0, n - 1);
    if total <= limit {
        return vec![(0..n).collect()];
    }
    let line_count = total.div_ceil(limit).clamp(2, max_lines.max(2));
    let ideal = limit.min(total.div_ceil(line_count));

    let mut best = vec![i64::MAX; n + 1];
    let mut next = vec![usize::MAX; n];
    best[n] = 0;
    for from in (0..n).rev() {
        for to in from..n {
            let w = line_width(from, to);
            if w > limit && to > from {
                break;
            }
            let boundary = if to == n - 1 || ends_at_line_boundary(words[to].join_text()) {
                0
            } else {
                LINE_BREAK_BOUNDARY_PENALTY
            };
            // Every suffix has at least one solution in which a single word occupies a line, so `best[to + 1]` is always finite; this is kept as a defensive guard.
            if best[to + 1] == i64::MAX {
                continue;
            }
            let gap = ideal as i64 - w.min(limit) as i64;
            let score = LINE_BREAK_LINE_BASE + gap * gap + boundary + best[to + 1];
            if score < best[from] {
                best[from] = score;
                next[from] = to + 1;
            }
        }
    }
    let mut lines = Vec::new();
    let mut from = 0;
    while from < n {
        let end = if next[from] != usize::MAX && next[from] > from {
            next[from]
        } else {
            from + 1
        };
        lines.push((from..end).collect());
        from = end;
    }
    lines
}

/// JS: `/[.!?;:，。！？；：]/u.test(line.trim().slice(-1))` — the line's final character (that is, the last character of the line's last word)
/// is sentence-final or clause punctuation. The regex character set is deliberately matched character for character; `sentence_end` and
/// `clause_end_char` are not used (they strip quotes/brackets and exclude abbreviation dots, which gives different results from JS).
fn ends_at_line_boundary(word: &str) -> bool {
    matches!(
        word.trim_end().chars().last(),
        Some('.' | '!' | '?' | ';' | ':' | '，' | '。' | '！' | '？' | '；' | '：')
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_profile_equals_the_legacy_constants() {
        let profile = LayoutProfile::default_profile();
        assert_eq!(profile.id, "default");
        assert_eq!(profile.source, CueParams::default());
        assert_eq!(profile.max_lines, 1);
        assert_eq!(
            profile.min_duration_sec,
            CueParams::default().min_cue_display_sec
        );
        assert_eq!(profile.max_duration_sec, 7.0);
        assert_eq!((profile.lead_in_sec, profile.tail_sec), (0.5, 1.0));
        // layout.rs legacy constants: CJK 13 / Latin 21 are the bad tier.
        assert_eq!(profile.cps_for_script(true).bad, 13.0);
        assert_eq!(profile.cps_for_script(false).bad, 21.0);
        // gpui `cps_level`：(9, 13) / (17, 21)。
        let cjk = profile.cps_for_script(true);
        let latin = profile.cps_for_script(false);
        assert_eq!((cjk.warn, cjk.bad), (9.0, 13.0));
        assert_eq!((latin.warn, latin.bad), (17.0, 21.0));
        assert_eq!(profile.target("zh"), TransParams::for_lang("zh"));
        assert_eq!(profile.target("en"), TransParams::for_lang("en"));
    }

    #[test]
    fn reading_cps_matches_split_target_reading_cps_for_every_language_tier() {
        let profile = LayoutProfile::default_profile();
        for lang in [
            "zh", "zh-Hans", "ja", "ko", "th", "ar", "hi", "en", "en-US", "de", "fr", "vi", "",
        ] {
            assert_eq!(
                profile.cps_for_lang(lang).reading,
                crate::split::target_reading_cps(lang),
                "{lang}"
            );
        }
        assert_eq!(profile.cps_for_lang("ja").warn, 9.0);
        assert_eq!(profile.cps_for_lang("th").warn, 17.0);
    }

    #[test]
    fn by_id_knows_default_and_two_line_and_or_default_keeps_the_requested_id() {
        assert_eq!(
            LayoutProfile::by_id("default"),
            Some(LayoutProfile::default_profile())
        );
        assert_eq!(
            LayoutProfile::by_id("two-line"),
            Some(LayoutProfile::two_line_profile())
        );
        assert_eq!(LayoutProfile::by_id("portrait"), None);
        let fallback = LayoutProfile::by_id_or_default("portrait");
        assert_eq!(fallback.id, "portrait");
        assert_eq!(fallback.cps, LayoutProfile::default_profile().cps);
        for id in KNOWN_PROFILE_IDS {
            assert_eq!(LayoutProfile::by_id(id).map(|p| p.id).as_deref(), Some(*id));
        }
    }

    /// The two-line profile is just data: apart from `id` and `max_lines`, every item equals `default`.
    #[test]
    fn two_line_profile_differs_from_default_only_in_max_lines() {
        let two = LayoutProfile::two_line_profile();
        let expected = LayoutProfile {
            id: "two-line".to_owned(),
            max_lines: 2,
            ..LayoutProfile::default_profile()
        };
        assert_eq!(two, expected);
        assert_eq!(two.source, CueParams::default());
        let params = CueParams::default();
        assert_eq!(
            LayoutProfile::default_profile().cue_width_budget(&params),
            42 + 8
        );
        assert_eq!(two.cue_width_budget(&params), 84 + 8);
        let narrow = CueParams {
            max_chars: 24,
            ..params
        };
        assert_eq!(two.cue_width_budget(&narrow), 48 + 8);
    }

    #[test]
    fn cue_params_for_doc_follow_the_document_profile() {
        let mut doc = TranscriptDoc::new(
            crate::doc::DocMedia {
                id: None,
                path: None,
                hash: "sha256-00".to_owned(),
                duration: 1.0,
                sample_rate: None,
            },
            "en",
            crate::doc::DocEngine {
                name: "test".to_owned(),
                version: None,
                aligned_words: true,
            },
        );
        assert_eq!(cue_params_for_doc(&doc), CueParams::default());
        assert_eq!(LayoutProfile::for_doc(&doc).id, "default");
        doc.layout_profile = Some("two-line".to_owned());
        assert_eq!(LayoutProfile::for_doc(&doc).max_lines, 2);
        assert_eq!(cue_params_for_doc(&doc), CueParams::default());
        doc.layout_profile = Some("portrait".to_owned());
        assert_eq!(LayoutProfile::for_doc(&doc).id, "portrait");
        assert_eq!(cue_params_for_doc(&doc), CueParams::default());
    }

    /// The fixture `core/fixtures/subtitle-render-contract.json#lineBreaks` (originally shared with the archived
    /// studio `sourceDisplayLines` / designs `translate-model.js`): the per-line word indices must match.
    #[test]
    fn line_break_plan_matches_the_shared_javascript_contract() {
        let contract: serde_json::Value = serde_json::from_str(include_str!(
            "../tests/fixtures/subtitle-render-contract.json"
        ))
        .unwrap();
        let rows = contract["lineBreaks"].as_array().unwrap();
        assert!(!rows.is_empty());
        for row in rows {
            let words: Vec<String> = serde_json::from_value(row["words"].clone()).unwrap();
            let refs: Vec<&str> = words.iter().map(String::as_str).collect();
            let fit = row["fit"].as_u64().unwrap() as usize;
            let max_lines = row["maxLines"].as_u64().unwrap() as usize;
            let expected: Vec<Vec<usize>> =
                serde_json::from_value(row["expected"].clone()).unwrap();
            assert_eq!(
                line_break_plan(&refs, max_lines, fit),
                expected,
                "{}",
                row["name"]
            );
            // Under the Latin fixture the visual width equals the code point count, so variants that inject `visual_width` must produce the same solutions.
            if words.iter().all(|word| word.is_ascii()) {
                assert_eq!(
                    line_break_plan_with(&refs, max_lines, fit, crate::atomize::visual_width),
                    expected,
                    "{} (visual_width)",
                    row["name"]
                );
            }
        }
    }

    #[test]
    fn line_break_plan_covers_every_word_exactly_once_and_respects_the_width() {
        let text = "Modern IDEs bring together tools that were once managed separately \
                    and now sit behind a single command palette that anyone can search";
        let words: Vec<&str> = text.split(' ').collect();
        for (max_lines, fit) in [(2, 42), (3, 30), (4, 20), (2, 8)] {
            let plan = line_break_plan(&words, max_lines, fit);
            let flat: Vec<usize> = plan.iter().flatten().copied().collect();
            assert_eq!(
                flat,
                (0..words.len()).collect::<Vec<_>>(),
                "{max_lines}x{fit}"
            );
            for line in &plan {
                let width: usize =
                    line.iter().map(|&i| words[i].len()).sum::<usize>() + line.len() - 1;
                assert!(
                    width <= fit.max(8) || line.len() == 1,
                    "{max_lines}x{fit}: {line:?}"
                );
            }
        }
        assert!(line_break_plan(&[], 2, 42).is_empty());
        assert_eq!(line_break_plan(&["one"], 2, 42), vec![vec![0]]);
    }

    /// When the text exceeds the `max_lines × limit` budget, the line-count clamp only changes the ideal line width (preferring fuller lines),
    /// and does not change the constraints that “no line exceeds the width and every word is covered exactly once”.
    #[test]
    fn line_break_plan_clamp_keeps_the_width_constraint_when_over_budget() {
        let text = "so the humans don't get distracted paying attention to that in reviews, stuff like that.";
        let words: Vec<&str> = text.split(' ').collect();
        // 88 characters > 2 × 42: even after clamping to 2 lines, three lines are still needed to avoid exceeding the width.
        let clamped = line_break_plan(&words, 2, 42);
        assert_eq!(clamped.len(), 3);
        let flat: Vec<usize> = clamped.iter().flatten().copied().collect();
        assert_eq!(flat, (0..words.len()).collect::<Vec<_>>());
        for line in &clamped {
            let width: usize = line.iter().map(|&i| words[i].len()).sum::<usize>() + line.len() - 1;
            assert!(width <= 42, "{line:?}");
        }
    }

    #[test]
    fn borrowed_pad_matches_studio_sub_pad() {
        let profile = LayoutProfile::default_profile();
        // When the gap is ≥ leadIn + tail, the whole buffer can be borrowed; otherwise it is borrowed proportionally.
        assert_eq!(profile.borrowed_pad(1.0, f64::INFINITY), 1.0);
        assert_eq!(profile.borrowed_pad(1.0, 1.5), 1.0);
        assert!((profile.borrowed_pad(1.0, 0.75) - 0.5).abs() < 1e-12);
        assert_eq!(profile.borrowed_pad(0.5, 0.0), 0.0);
        assert_eq!(profile.borrowed_pad(0.5, -1.0), 0.0);
        assert!(
            (profile.display_window(1.0, 2.0, f64::INFINITY, 0.3) - (1.0 + 0.5 + 0.2)).abs()
                < 1e-12
        );
    }
}
