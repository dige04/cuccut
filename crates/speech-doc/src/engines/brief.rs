//! Document brief (analysis/brief stage, mirrors voice-ink `AnalysisStage`):
//! summary, term lock and named entities, injected into the system prompt of every later LLM stage.
//!
//! Degradation contract: the whole analysis is optional. Failures are left to the caller to ignore (an Err must not block the pipeline), but [`crate::llm::LlmError::Terminal`] should still abort the whole run.

use serde::{Deserialize, Serialize};

use crate::doc::TranscriptDoc;
use crate::engines::markers::marked_text;
use crate::engines::translate::term_occurrences;
use crate::filepipe::{
    ANALYSIS_MAX_TERMS, BilingualTerm, CanonicalTerm, PageAttempt, Problem, ProblemScope,
    SourceContext, TargetContext, TermCategory, TermOrigin, merge_bilingual_terms,
    merge_canonical_terms, parse_model_source_context, parse_model_target_context,
    render_target_context, term_merge_key,
};
use crate::fingerprint::{fingerprint, fingerprint_strings};
use crate::llm::{
    LlmError, LlmJson, LlmRequest, MAX_RETRIES, complete_batch_retry_report, with_retry,
};
use crate::paging::{budgets, paginate_word_ranges};

/// Translation tone override. The default, neutral, injects no extra constraints.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TranslationTone {
    Formal,
    Casual,
}

impl TranslationTone {
    pub fn parse(value: &str) -> Result<Self, String> {
        match value {
            "formal" => Ok(Self::Formal),
            "casual" => Ok(Self::Casual),
            other => Err(format!(
                "Unknown translation tone {other} (available: formal|casual)"
            )),
        }
    }

    pub fn prompt_line(self) -> &'static str {
        match self {
            Self::Formal => {
                "Use a formal, polished register appropriate for professional subtitles."
            }
            Self::Casual => {
                "Use a natural, conversational register while preserving the speaker's meaning."
            }
        }
    }
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GlossaryEntry {
    pub source: String,
    pub target: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub note: Option<String>,
    /// Generated entries are always false; the user can explicitly lock them after editing the artifact.
    #[serde(default)]
    pub locked: bool,
}

/// Bilingual translation brief for each target language; its body can be edited by the user.
///
/// The three fingerprint fields only constrain the generation inputs. The glossary/styleGuide body does not take part in cache hits, so user edits can be reused stably across re-translations.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentBrief {
    #[serde(default)]
    pub target_lang: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tone: Option<TranslationTone>,
    pub summary: String,
    #[serde(default)]
    pub glossary: Vec<GlossaryEntry>,
    #[serde(default)]
    pub named_entities: Vec<String>,
    #[serde(default)]
    pub style_guide: String,
    #[serde(default)]
    pub difficulties: Vec<String>,
    pub fingerprint: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub analysis_fingerprint: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub instructions_fingerprint: Option<String>,
}

impl DocumentBrief {
    pub fn matches_inputs(
        &self,
        doc: &TranscriptDoc,
        analysis: Option<&Analysis>,
        instructions: Option<&str>,
    ) -> bool {
        self.fingerprint == fingerprint(&doc.words)
            && self.analysis_fingerprint == analysis.map(|analysis| analysis.fingerprint.clone())
            && self.instructions_fingerprint
                == instructions
                    .filter(|value| !value.trim().is_empty())
                    .map(|value| fingerprint_strings([value]))
    }

    /// Relaxed reuse check for align-only (refinement) rounds: compare only the word truth and the target language.
    ///
    /// Refinement rounds do not semantically change the truth of the translation. On this path the brief is only consumed (protected terms + bilingual anchors) and is not used for generation. Refinement rounds also cannot get the analysis (`--align-only` always discards it) or the original `instructions` (per-sentence detail goes only into the align contract), so the check with [`Self::matches_inputs`] always mismatches: every refinement round reruns translate-brief and overwrites `ai/brief-<lang>.json` as a whole, washing out the `locked` terms the user explicitly locked. When the word truth has not changed, the existing brief can simply be reused.
    pub fn matches_document(&self, doc: &TranscriptDoc, target_lang: &str) -> bool {
        self.target_lang == target_lang && self.fingerprint == fingerprint(&doc.words)
    }

    /// Glossary for the translation prompt: **only entries that actually hit in this document**, sorted by hit count descending, stably taking the first `limit` entries.
    ///
    /// Previously this only sorted and did not filter: zero-hit entries were still ranked after the others and entered the prompt (words from fragments extracted during analysis and later cut, or from a very large user glossary). That wasted tokens and drowned out the few entries that matter. The hit criterion is the same as `term_present` of each page's `rt` (Latin terms check identifier boundaries, CJK checks literal inclusion). A misrecognized form recorded for the same word in `analysis` also counts as a hit, since before the transcript is polished the body text may read 维科夫 (a Chinese transliteration) rather than `Wyckoff`.
    ///
    /// [`term_present`]: crate::engines::translate::term_present
    pub fn glossary_for_prompt(
        &self,
        source_text: &str,
        analysis: Option<&Analysis>,
        limit: usize,
    ) -> Vec<&GlossaryEntry> {
        let mut indexed = self
            .glossary
            .iter()
            .enumerate()
            .filter_map(|(index, entry)| {
                let key = term_merge_key(&entry.source);
                let observed = analysis
                    .into_iter()
                    .flat_map(|analysis| analysis.terms.iter())
                    .filter(|term| !key.is_empty() && term_merge_key(&term.term) == key)
                    .flat_map(|term| term.observed_variants.iter().map(String::as_str));
                let count = std::iter::once(entry.source.as_str())
                    .chain(observed)
                    .map(|form| term_occurrences(source_text, form))
                    .sum::<usize>();
                (count > 0).then_some((entry, count, index))
            })
            .collect::<Vec<_>>();
        indexed.sort_by(|left, right| right.1.cmp(&left.1).then_with(|| left.2.cmp(&right.2)));
        indexed
            .into_iter()
            .take(limit)
            .map(|(entry, _, _)| entry)
            .collect()
    }

    pub fn protected_targets(&self) -> Vec<String> {
        let mut targets = self
            .glossary
            .iter()
            .map(|entry| entry.target.trim())
            .filter(|target| !target.is_empty())
            .map(str::to_owned)
            .collect::<Vec<_>>();
        targets.sort();
        targets.dedup();
        targets
    }

    /// Align may protect only terms that fit in one target line; a term wider
    /// than `fit` has no legal indivisible placement and must remain splittable.
    pub fn protected_targets_for_fit(&self, lang: &str, fit: usize) -> Vec<String> {
        self.protected_targets()
            .into_iter()
            .filter(|target| !crate::split::exceeds_one_line_fit(target, lang, fit))
            .collect()
    }
}

#[derive(Debug, Clone, Default)]
pub struct TranslationBriefOptions<'a> {
    pub source_lang: &'a str,
    pub target_lang: &'a str,
    pub analysis: Option<&'a Analysis>,
    pub instructions: Option<&'a str>,
    pub reference_context: Option<&'a str>,
    pub tone: Option<TranslationTone>,
}

/// BCP-47 script-aware simplified-Chinese policy gate: applies to zh / zh-Hans, does not apply to zh-Hant (including region subtags).
pub fn is_simplified_chinese(lang: &str) -> bool {
    let subtags = lang
        .split(['-', '_'])
        .map(|part| part.to_ascii_lowercase())
        .collect::<Vec<_>>();
    subtags.first().is_some_and(|primary| primary == "zh")
        && !subtags.iter().any(|subtag| subtag == "hant")
}

pub fn simplified_chinese_prompt_block(lang: &str) -> Option<&'static str> {
    is_simplified_chinese(lang).then_some(
        r#"Simplified-Chinese target policy (fixed, higher priority than a generated style guide):
- Use idiomatic Simplified Chinese, not source-language word order when it sounds translated.
- Use Chinese punctuation conventions. Never insert a space between two Chinese characters, and never insert a space inside an identifier.
- Always put exactly one ASCII space between a Chinese character and adjacent Latin script: Latin words, identifiers, model names, and a CLI flag together with its leading dashes. Write 35% KV 缓存 and 通过 --speculative-model 指定, never 35%KV缓存 or 通过--speculative-model指定. The same single space applies between an Arabic numeral or a % value and an adjacent Latin word. This spacing is mandatory, not a preference.
- Use “…” for ellipses, collapse noisy repeated ?!/？！ punctuation, and write ordinary four-digit numbers without a thousands comma.
- Preserve code, identifiers, URLs, model names, product names, and LOCKED glossary renderings verbatim; copying them verbatim means the identifier's own characters are untouched, and it still takes the single surrounding space when Chinese text touches it.
- Subtitle display cuts are a later transAlign projection; never insert line breaks."#,
    )
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalysisTerm {
    pub term: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub note: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub observed_variants: Vec<String>,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Analysis {
    pub summary: String,
    #[serde(default)]
    pub terms: Vec<AnalysisTerm>,
    #[serde(default)]
    pub named_entities: Vec<String>,
    /// Content fingerprint of the input word stream (always present in the header of the persisted artifact; readers must verify it).
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub fingerprint: String,
    /// Fingerprint of the project/source metadata reference block; a change in the metadata invalidates the brief cache.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reference_fingerprint: Option<String>,
}

#[derive(Debug, Clone, Default)]
pub struct AnalysisOptions {
    pub instructions: Option<String>,
    pub reference_context: Option<String>,
}

/// User-instruction injection block (compared verbatim against `AnalysisStage.instructionsBlock`).
pub fn instructions_block(instructions: Option<&str>) -> String {
    match instructions.filter(|text| !text.is_empty()) {
        Some(text) => format!(
            "\n\n\nExtra instructions from the user — AUTHORITATIVE: any names, spellings, or facts stated here are correct by definition and override your own knowledge and mishearing guesses. Never list a \"correct spelling\" that contradicts them: {text}"
        ),
        None => String::new(),
    }
}

/// Project and source metadata are background reference only. Titles and descriptions usually supply the correct proper nouns, but they must not be used to add facts to the spoken content or to override explicit transcript evidence.
pub fn reference_context_block(context: Option<&str>) -> String {
    match context.filter(|text| !text.is_empty()) {
        Some(text) => format!(
            "\n\n\nProject and source metadata — BACKGROUND REFERENCE, not transcript content or absolute authority. Use exact spellings of names, people, organizations, products, and technical terms as strong correction hints only when the speech plausibly refers to them. Never add facts or words merely because they appear here:\n{text}"
        ),
        None => String::new(),
    }
}

/// Display of the glossary in the prompt (mirrors `AnalysisStage.formatForPrompt`).
pub fn format_for_prompt(analysis: &Analysis) -> String {
    if analysis.terms.is_empty() {
        return "(none)".to_owned();
    }
    analysis
        .terms
        .iter()
        .map(|term| {
            let mut line = format!("- {}", term.term);
            if !term.observed_variants.is_empty() {
                let variants = term
                    .observed_variants
                    .iter()
                    .map(|variant| format!("{variant} → {}", term.term))
                    .collect::<Vec<_>>()
                    .join("; ");
                line.push_str(&format!(" [observed ASR: {variants}]"));
            }
            if let Some(note) = term.note.as_deref().filter(|note| !note.is_empty()) {
                line.push_str(&format!(" ({note})"));
            }
            line
        })
        .collect::<Vec<_>>()
        .join("\n")
}

fn has_slash(value: &str) -> bool {
    value.contains('/') || value.contains('／')
}

fn head_tail_excerpt(doc: &TranscriptDoc, budget: usize) -> String {
    let joined = marked_text(&doc.words);
    let chars = joined.chars().collect::<Vec<_>>();
    if chars.len() <= budget {
        return joined;
    }
    let half = budget / 2;
    let head = chars[..half].iter().collect::<String>();
    let tail = chars[chars.len().saturating_sub(half)..]
        .iter()
        .collect::<String>();
    format!("{head}\n\n[… middle omitted; use complete analysis …]\n\n{tail}")
}

// ── File contract (file-v1): `ai/context.md` / `ai/context.<lang>.md` (design §5) ──

/// analysis extraction prompt (file-v1): the input is the ASR source page, the output is one `context.md`.
const CONTEXT_EXTRACT_PROMPT: &str = r#"You are a transcription quality analyst.

The user gives you a RAW speech-recognition transcript. It may contain spelling errors, homophone mistakes, and misrecognized proper nouns.

Answer with ONE markdown document and nothing else — no prose before or after it, no code fence. Its shape is fixed:

---
format: "context-doc/1"
fingerprint: ""
---
# Summary
Two or three sentences describing the subject matter, register, speaker roles, and any style requirement.

# Canonical Terms
| Source | Category | Variants | Note | Lock | Origin |
|---|---|---|---|---|---|
| CucCut | product | cook cut, CukKut | keep the English casing | no | analyzed |

Rules:
- Reproduce the frontmatter keys exactly as shown and leave `fingerprint` empty; the app stamps it.
- Keep both headings verbatim: `# Summary` and `# Canonical Terms`. Add no other section.
- This table exists for ONE purpose: fixing speech-recognition mistakes. `Source` is the CORRECT spelling of a term the recognizer is likely to get wrong — a proper noun, a person, a product, a technical term, a brand, an acronym, or a foreign word mixed into the speech. Infer the correct form when the transcript misspells it.
- NEVER list ordinary vocabulary, common nouns, verbs, generic topic words, filler or backchannel words (嗯/啊/哦/对/好/是, um, uh, yeah), single characters, numbers, or punctuation. If a competent typist would spell it correctly without thinking, it does not belong in the table.
- At most 80 rows per answer. When more candidates exist, keep only the ones a recognizer most plausibly mangles. One row per term; never repeat a `Source` — merge every observation of the same term into that single row.
- `Category` is a closed set: product, person, tech, proper, other. Any other value is treated as `other`.
- `Variants` lists exact misrecognized forms that LITERALLY occur in the supplied transcript and clearly refer to that term, separated by commas. Never invent a variant, and never repeat the canonical `Source` as its own variant. Leave the cell empty when there is none.
- `Lock` is always `no` and `Origin` is always `analyzed` in your answer. Rows the user locked are merged back by the app; writing `yes` or `user` yourself is a protocol violation.
- Keep every cell on one line and escape a literal `|` inside a cell as `\|`."#;

/// analysis summary-merge prompt (file-v1): the input is only the `# Summary` of each page.
///
/// The model no longer rewrites the glossary as a whole. The `Canonical Terms` of multiple pages are unioned deterministically by the host via [`merge_partial_terms`]; the model writes only one overall summary. The payload and answer of this call are therefore only a few lines, and the serial reduce is no longer the long tail of the analysis stage.
const CONTEXT_SUMMARY_PROMPT: &str = r#"You are a transcription quality analyst.

The user gives you the per-part summaries written for consecutive parts of ONE transcript. Write one overall two-to-three sentence summary describing the subject matter, register, speaker roles, and any style requirement.

Answer with ONE markdown document and nothing else — no prose before or after it, no code fence:

---
format: "context-doc/1"
fingerprint: ""
---
# Summary
…

# Canonical Terms
| Source | Category | Variants | Note | Lock | Origin |
|---|---|---|---|---|---|

Rules:
- Reproduce the frontmatter keys exactly as shown and leave `fingerprint` empty.
- Keep both headings and the table header verbatim and leave the table EMPTY: the app merges the term rows itself; any row you add is discarded.
- Do not echo the per-part summaries back; write the merged summary only."#;

/// translate-brief prompt (file-v1): the input is the `context.<lang>.md` seed document to be filled in.
const CONTEXT_TARGET_PROMPT: &str = r#"You prepare a bilingual subtitle-translation brief as a markdown document.

The user gives you a target-language context document whose `Bilingual Glossary` rows are already fixed, plus a transcript excerpt for evidence. Fill it in and answer with ONE markdown document and nothing else — no prose before or after it, no code fence. Keep the frontmatter, the four headings, and the table header verbatim:

---
format: "context-doc/1"
targetLang: "…"
fingerprint: "…"
---
# Translated Summary
…
# Bilingual Glossary
| Source | Target | Note | Lock | Origin |
|---|---|---|---|---|
# Translation Style
…
# Difficulties
- …

Rules:
- Copy the frontmatter block through unchanged, including every fingerprint value.
- Keep every glossary row that the input already has, in the same order, and never add or drop a `Source`. Fill in each empty `Target`.
- A row whose `Lock` is `yes` is locked by the user: copy its `Target` character for character when it already has one, and never rewrite it.
- Copy the `Lock` and `Origin` cells through unchanged.
- Every `Target` is exactly one literal, screen-ready rendering. Never offer slash-separated alternatives; a slash is allowed only when the source term itself contains one and is copied verbatim, such as a CLI command like /compact.
- An acronym and its spelled-out form are separate rows that must map to the same single literal target.
- `# Translated Summary` restates the summary in the target language. `# Translation Style` states the register plus the numeric, unit, and spacing conventions that every page must follow: one fixed shape for percent ranges such as 75%–95% written with an en dash and no spaces, Arabic numerals for quantities, and one spelled form per unit.
- When the target language is written in Han characters or kana (Chinese, Japanese), `# Translation Style` must state the CJK/Latin spacing rule as mandatory, never as a preference: exactly one ASCII space between a Han or kana character and adjacent Latin words, identifiers, model names, numerals, % values, and CLI flags together with their leading dashes, as in 35% KV 缓存 and 通过 --speculative-model 指定; never a space between two such characters and never a space inside an identifier.
- That spacing rule does not apply to a target written in Hangul. Korean separates words with spaces and attaches a particle or counter directly to the Latin word or numeral before it (AI가, 2박 3일, 35%를): `# Translation Style` must say so and must never ask for a space between Hangul and an adjacent Latin word or numeral.
- `# Difficulties` is a `- ` bulleted list of translation pitfalls in this document; leave the section empty when there is none.
- Keep every table cell on one line and escape a literal `|` inside a cell as `\|`. Do not echo the transcript excerpt back."#;

/// Page id (same shape as the `pNNN` of translate/polish), used for naming audit artifacts.
fn context_page_id(index: usize) -> String {
    format!("p{:03}", index + 1)
}

/// Problem summary (used to feed retry reasons back; same shape as polish/align).
fn summarize_context_problems(problems: &[Problem]) -> String {
    if problems.is_empty() {
        return "no parseable context document".to_owned();
    }
    problems
        .iter()
        .take(4)
        .map(|problem| format!("[{}] {}", problem.code, problem.detail))
        .collect::<Vec<_>>()
        .join("; ")
}

/// `LlmError` → human-readable explanation that can be fed back (the Display prefix of `Malformed` is misleading for the md carrier).
fn malformed_detail(error: &LlmError) -> String {
    match error {
        LlmError::Malformed(detail) => detail.clone(),
        other => other.to_string(),
    }
}

fn context_problem_lines(problems: &[Problem]) -> Vec<String> {
    problems
        .iter()
        .map(|problem| match &problem.scope {
            ProblemScope::Sentence { id } => format!("[{}] {id}: {}", problem.code, problem.detail),
            _ => format!("[{}] {}", problem.code, problem.detail),
        })
        .collect()
}

/// Model rows are all downgraded to `Origin=analyzed, Lock=no`. `Lock`/`Origin` are the user channel, and the model must not grant them to itself. Otherwise one hallucination could pin a generated translation as "user-locked".
fn demote_model_terms(terms: &mut Vec<CanonicalTerm>) {
    for term in terms.iter_mut() {
        term.origin = TermOrigin::Analyzed;
        term.locked = false;
        term.source = term.source.trim().to_owned();
    }
    terms.retain(|term| !term.source.is_empty());
}

/// Anti-hallucination cleanup: `Variants` keeps only the forms that literally appear in the full text.
fn filter_invented_variants(terms: &mut [CanonicalTerm], doc: &TranscriptDoc) {
    let full_text = crate::atomize::join_word_texts(doc.words.iter()).to_lowercase();
    for term in terms.iter_mut() {
        let canonical = term.source.to_lowercase();
        let mut seen = std::collections::HashSet::new();
        term.variants.retain(|variant| {
            let lowered = variant.to_lowercase();
            lowered != canonical && full_text.contains(&lowered) && seen.insert(lowered)
        });
    }
}

/// Settlement of [`run_analysis_file_contract_report`].
///
/// `pages_failed` and `terms_dropped` are the two observable counters from §2.1 of the retry-strategy redesign. The former is the number of pages that did not produce a parseable document after three attempts (the whole analysis is **no longer** thrown upward). The latter is the number of term rows cut by the row-count limit. The host writes them into the analysis section of `ccut polish` / `ccut brief` (`pagesFailed` / `termsDropped`).
#[derive(Debug, Clone, Default)]
pub struct AnalysisOutcome {
    /// The merged source-language context (the same thing as the old return value).
    pub context: SourceContext,
    /// Number of pages exhausted at page level. As long as at least one page succeeds, it is not an overall failure.
    pub pages_failed: u32,
    /// Number of term rows cut by the row limit (per page 150 / whole text [`ANALYSIS_MAX_TERMS`]).
    pub terms_dropped: u32,
}

/// Deterministic union of the `Canonical Terms` across multiple pages (replaces the old serial reduce, in which the model rewrote the whole table).
///
/// Within a key group: the `Source` spelling is the most frequent one (ties go to the first seen). `Category` is the mode (ties go to the first seen). `Note` is the longest (ties go to the first seen). `Variants` is the union (case-insensitive dedup, excluding the winning spelling). Losing `Source` spellings are also merged into `Variants`, and they then go through the same literal-occurrence check of [`filter_invented_variants`], so no forms appear out of nowhere. The output is in order of first occurrence. `Lock`/`Origin` always follow the model-row convention.
fn merge_partial_terms(partials: &[SourceContext]) -> (Vec<CanonicalTerm>, u32) {
    struct Group {
        spellings: Vec<(String, usize)>,
        categories: Vec<(TermCategory, usize)>,
        note: String,
        variants: Vec<String>,
        /// Total number of times this key appears across pages (the sort key for the whole-text row limit).
        hits: usize,
    }
    fn bump<T: PartialEq>(counts: &mut Vec<(T, usize)>, value: T) {
        match counts.iter_mut().find(|(seen, _)| *seen == value) {
            Some((_, count)) => *count += 1,
            None => counts.push((value, 1)),
        }
    }
    fn winner<T: Clone>(counts: &[(T, usize)]) -> T {
        let mut best = &counts[0];
        for entry in counts {
            if entry.1 > best.1 {
                best = entry;
            }
        }
        best.0.clone()
    }

    let mut order: Vec<String> = Vec::new();
    let mut groups: std::collections::HashMap<String, Group> = std::collections::HashMap::new();
    for term in partials.iter().flat_map(|partial| partial.terms.iter()) {
        let source = term.source.trim();
        if source.is_empty() {
            continue;
        }
        let key = term_merge_key(source);
        if key.is_empty() {
            continue;
        }
        let group = groups.entry(key.clone()).or_insert_with(|| {
            order.push(key);
            Group {
                spellings: Vec::new(),
                categories: Vec::new(),
                note: String::new(),
                variants: Vec::new(),
                hits: 0,
            }
        });
        group.hits += 1;
        bump(&mut group.spellings, source.to_owned());
        bump(&mut group.categories, term.category);
        let note = term.note.trim();
        if note.chars().count() > group.note.chars().count() {
            group.note = note.to_owned();
        }
        group.variants.extend(
            term.variants
                .iter()
                .map(|variant| variant.trim())
                .filter(|variant| !variant.is_empty())
                .map(str::to_owned),
        );
    }

    // Whole-text row limit (R2 deterministic truncation): take the first ANALYSIS_MAX_TERMS keys sorted by cross-page occurrence count, descending. Ties go to first-occurrence order. Cut rows are only counted, never a reason to reject a page.
    let dropped = order.len().saturating_sub(ANALYSIS_MAX_TERMS) as u32;
    let mut ranked: Vec<(usize, String)> = order.into_iter().enumerate().collect();
    if dropped > 0 {
        ranked.sort_by(|(left_pos, left), (right_pos, right)| {
            groups[right]
                .hits
                .cmp(&groups[left].hits)
                .then(left_pos.cmp(right_pos))
        });
        ranked.truncate(ANALYSIS_MAX_TERMS);
        // After truncation, restore first-occurrence order: the output order is still determined only by the "first appearance".
        ranked.sort_by_key(|(position, _)| *position);
    }

    let terms = ranked
        .into_iter()
        .filter_map(|(_, key)| groups.remove(&key))
        .map(|group| {
            let source = winner(&group.spellings);
            let category = winner(&group.categories);
            let canonical = source.to_lowercase();
            let mut seen = std::collections::HashSet::new();
            let variants = group
                .variants
                .into_iter()
                .chain(group.spellings.into_iter().map(|(spelling, _)| spelling))
                .filter(|variant| {
                    let lowered = variant.to_lowercase();
                    lowered != canonical && seen.insert(lowered)
                })
                .collect();
            CanonicalTerm {
                source,
                category,
                variants,
                note: group.note,
                locked: false,
                origin: TermOrigin::Analyzed,
            }
        })
        .collect();
    (terms, dropped)
}

/// Multi-page summary merge: only let the model write the overall summary (the terms table has already been merged by [`merge_partial_terms`]).
///
/// When retries are exhausted and the output is still unparseable, fall back to the longest per-page summary. A summary is only background for the prompt and is not worth failing the whole analysis over. Other errors (Terminal/Transient exhausted) propagate as usual.
fn merge_partial_summaries(
    partials: &[SourceContext],
    llm: &mut dyn LlmJson,
    options: &AnalysisOptions,
    sleep: &mut dyn FnMut(f64),
    on_attempt: &mut dyn FnMut(&PageAttempt<'_>),
) -> Result<String, LlmError> {
    let payload = partials
        .iter()
        .enumerate()
        .map(|(index, partial)| {
            format!(
                "## Part {}\n{}",
                context_page_id(index),
                partial.summary.trim()
            )
        })
        .collect::<Vec<_>>()
        .join("\n\n");
    let merge_system = format!(
        "{CONTEXT_SUMMARY_PROMPT}{}{}",
        reference_context_block(options.reference_context.as_deref()),
        instructions_block(options.instructions.as_deref())
    );
    let merge_id = "merge".to_owned();
    let mut merge_tries = 0_u32;
    // Retry feedback carries the real problems summary (retry-strategy redesign §2.5). A fixed string neither tells the model what went wrong nor shows in the logs what happened in the previous round.
    let mut last_problems: Option<String> = None;
    let merged = with_retry(MAX_RETRIES, &mut *sleep, |attempt| {
        let raw = llm.complete(&LlmRequest {
            kind: "analysis",
            system: merge_system.clone(),
            user: payload.clone(),
            temperature: 0.2,
            attempt: attempt + 1,
            retry_reason: (attempt > 0).then(|| {
                last_problems.clone().unwrap_or_else(|| {
                    "the previous merged summary document was not parseable".to_owned()
                })
            }),
        })?;
        merge_tries += 1;
        let parsed = parse_model_source_context(Some(&payload), &raw);
        let problems = parsed.diagnostics.problems.clone();
        on_attempt(&PageAttempt {
            page_id: &merge_id,
            attempt: merge_tries,
            input: &payload,
            output: &raw,
            problems: &problems,
            accepted: parsed.context.is_some(),
        });
        let summary = parsed
            .context
            .map(|context| context.summary.trim().to_owned())
            .filter(|summary| !summary.is_empty());
        match summary {
            Some(summary) => Ok(summary),
            None => {
                let detail = if problems.is_empty() {
                    "the merged summary document had no non-empty `# Summary` section".to_owned()
                } else {
                    summarize_context_problems(&problems)
                };
                last_problems = Some(detail.clone());
                Err(LlmError::Malformed(format!(
                    "merged summary rejected — {detail}"
                )))
            }
        }
    });
    match merged {
        Ok(summary) => Ok(summary),
        Err(LlmError::Malformed(_)) => Ok(partials
            .iter()
            .map(|partial| partial.summary.trim())
            .max_by_key(|summary| summary.chars().count())
            .unwrap_or_default()
            .to_owned()),
        Err(error) => Err(error),
    }
}

/// Full-text analysis under the file contract (§5): produces the [`SourceContext`] for `ai/context.md`.
///
/// Key points: the same page budget, the same map/reduce structure (with multiple pages the glossary is merged deterministically by [`merge_partial_terms`], and the model writes one overall summary serially), the same anti-hallucination cleanup, and the same `fingerprint`/`referenceFingerprint` basis, so the host's cache-freshness criterion holds unchanged.
///
/// The model rewrites a document rather than JSON. Rows with `Origin=user` in `existing` are kept one by one via [`merge_canonical_terms`] (§5.1 rebuild rule), and model rows are all downgraded to `Origin=analyzed`. On a parse failure it returns `Err`. The host must keep the old verified context and **never overwrite it with an empty table**.
pub fn run_analysis_file_contract(
    doc: &TranscriptDoc,
    llm: &mut dyn LlmJson,
    options: &AnalysisOptions,
    existing: Option<&SourceContext>,
    sleep: &mut dyn FnMut(f64),
    on_attempt: &mut dyn FnMut(&PageAttempt<'_>),
) -> Result<SourceContext, LlmError> {
    run_analysis_file_contract_report(doc, llm, options, existing, sleep, on_attempt)
        .map(|outcome| outcome.context)
}

/// Same as [`run_analysis_file_contract`], but also returns the two degradation counters from §2.1 ([`AnalysisOutcome::pages_failed`] / [`AnalysisOutcome::terms_dropped`]).
///
/// Page-level exhaustion **is no longer propagated**. As long as at least one page succeeds, the successful pages are merged (term union plus summary merge or fallback), and failed pages are only counted. Only when every page fails does it return `Err`, and the host keeps the old context.
pub fn run_analysis_file_contract_report(
    doc: &TranscriptDoc,
    llm: &mut dyn LlmJson,
    options: &AnalysisOptions,
    existing: Option<&SourceContext>,
    sleep: &mut dyn FnMut(f64),
    on_attempt: &mut dyn FnMut(&PageAttempt<'_>),
) -> Result<AnalysisOutcome, LlmError> {
    let pages = paginate_word_ranges(&doc.words, budgets::ANALYSIS, budgets::ANALYSIS_MIN_LAST);
    let system = format!(
        "{CONTEXT_EXTRACT_PROMPT}{}{}",
        reference_context_block(options.reference_context.as_deref()),
        instructions_block(options.instructions.as_deref())
    );
    let inputs = pages
        .iter()
        .map(|page| marked_text(&doc.words[page.clone()]))
        .collect::<Vec<_>>();
    let page_ids = (0..inputs.len()).map(context_page_id).collect::<Vec<_>>();
    let requests = inputs
        .iter()
        .map(|input| LlmRequest {
            kind: "analysis",
            system: system.clone(),
            user: input.clone(),
            temperature: 0.2,
            attempt: 1,
            retry_reason: None,
        })
        .collect::<Vec<_>>();

    let mut partials: Vec<Option<SourceContext>> = vec![None; requests.len()];
    let mut tries = vec![0_u32; requests.len()];
    let wave = complete_batch_retry_report(
        llm,
        &requests,
        MAX_RETRIES,
        sleep,
        &mut |index, raw| {
            tries[index] += 1;
            let parsed = parse_model_source_context(Some(&inputs[index]), raw);
            let problems = parsed.diagnostics.problems.clone();
            on_attempt(&PageAttempt {
                page_id: &page_ids[index],
                attempt: tries[index],
                input: &inputs[index],
                output: raw,
                problems: &problems,
                accepted: parsed.context.is_some(),
            });
            parsed
                .context
                .map(|mut context| {
                    demote_model_terms(&mut context.terms);
                    context
                })
                .ok_or_else(|| {
                    LlmError::Malformed(format!(
                        "context page {} rejected — {}",
                        page_ids[index],
                        summarize_context_problems(&problems)
                    ))
                })
        },
        &mut |_, error| error.to_string(),
        &mut |index, context| partials[index] = Some(context),
    )?;
    // Page-level exhaustion drops only that page (R1/R3). The whole analysis is no longer thrown upward because one page failed to parse three times, which would drag the whole polish down with it. It is judged a failure only when every page fails.
    let pages_failed = wave.failed.len() as u32;
    let first_failure = wave.failed.into_iter().next().map(|(_, error)| error);
    let partials: Vec<SourceContext> = partials.into_iter().flatten().collect();
    if partials.is_empty() {
        return Err(first_failure
            .unwrap_or_else(|| LlmError::Malformed("no context page completed".to_owned())));
    }

    let mut terms_dropped = 0_u32;
    let mut merged = if partials.len() == 1 {
        partials.into_iter().next().unwrap_or_default()
    } else {
        let (terms, dropped) = merge_partial_terms(&partials);
        terms_dropped = dropped;
        let summary = merge_partial_summaries(&partials, llm, options, sleep, on_attempt)?;
        SourceContext {
            summary,
            terms,
            ..SourceContext::default()
        }
    };

    filter_invented_variants(&mut merged.terms, doc);
    merged.terms = merge_canonical_terms(
        existing
            .map(|context| context.terms.as_slice())
            .unwrap_or(&[]),
        &merged.terms,
    );
    if merged.summary.trim().is_empty()
        && let Some(previous) = existing.map(|context| context.summary.as_str())
    {
        merged.summary = previous.to_owned();
    }
    merged.fingerprint = fingerprint(&doc.words);
    merged.reference_fingerprint = options
        .reference_context
        .as_deref()
        .map(|context| fingerprint_strings([context]));
    Ok(AnalysisOutcome {
        context: merged,
        pages_failed,
        terms_dropped,
    })
}

/// Seed document: projects the source-language canonical terms into bilingual rows to be filled in. Existing translations are carried over as they are.
///
/// `Lock`/`Origin` follow the user channel (a user lock on a source-language row stays locked on the target-language row). The model is only allowed to fill `Target` and the three body sections.
fn seed_target_context(
    doc: &TranscriptDoc,
    options: &TranslationBriefOptions<'_>,
    source: Option<&SourceContext>,
    existing: Option<&TargetContext>,
) -> TargetContext {
    let prior: std::collections::BTreeMap<&str, &BilingualTerm> = existing
        .map(|context| {
            context
                .glossary
                .iter()
                .map(|term| (term.source.as_str(), term))
                .collect()
        })
        .unwrap_or_default();
    let mut glossary: Vec<BilingualTerm> = Vec::new();
    let mut seen = std::collections::BTreeSet::new();
    for term in source
        .map(|context| context.terms.as_slice())
        .unwrap_or(&[])
    {
        if !seen.insert(term.source.as_str()) {
            continue;
        }
        let existing_row = prior.get(term.source.as_str());
        glossary.push(BilingualTerm {
            source: term.source.clone(),
            target: existing_row
                .map(|row| row.target.clone())
                .unwrap_or_default(),
            note: existing_row
                .map(|row| row.note.clone())
                .filter(|note| !note.is_empty())
                .unwrap_or_else(|| term.note.clone()),
            // Target-language side lock: a user lock on either side counts as locked (§5.2 locked→rt chain).
            locked: term.locked || existing_row.is_some_and(|row| row.locked),
            origin: if term.origin == TermOrigin::User
                || existing_row.is_some_and(|row| row.origin == TermOrigin::User)
            {
                TermOrigin::User
            } else {
                TermOrigin::Analyzed
            },
        });
    }
    // User rows that exist only on the target-language side (entries absent from the source table) must not disappear.
    for term in existing
        .map(|context| context.glossary.as_slice())
        .unwrap_or(&[])
    {
        if term.origin == TermOrigin::User && seen.insert(term.source.as_str()) {
            glossary.push(term.clone());
        }
    }
    glossary.sort_by(|left, right| left.source.cmp(&right.source));
    TargetContext {
        target_lang: options.target_lang.to_owned(),
        fingerprint: fingerprint(&doc.words),
        analysis_fingerprint: options
            .analysis
            .map(|analysis| analysis.fingerprint.clone())
            .or_else(|| source.map(|context| context.fingerprint.clone())),
        instructions_fingerprint: options
            .instructions
            .filter(|value| !value.trim().is_empty())
            .map(|value| fingerprint_strings([value])),
        tone: options.tone,
        summary: existing
            .map(|context| context.summary.clone())
            .unwrap_or_default(),
        glossary,
        style: existing
            .map(|context| context.style.clone())
            .unwrap_or_default(),
        difficulties: existing
            .map(|context| context.difficulties.clone())
            .unwrap_or_default(),
    }
}

fn context_target_system(options: &TranslationBriefOptions<'_>) -> String {
    let mut system = CONTEXT_TARGET_PROMPT.to_owned();
    system.push_str(&format!(
        "\n\nTranslation direction: {} → {}.",
        options.source_lang, options.target_lang
    ));
    if let Some(policy) = simplified_chinese_prompt_block(options.target_lang) {
        system.push_str("\n\n");
        system.push_str(policy);
    }
    if let Some(tone) = options.tone {
        system.push_str("\n\nTone: ");
        system.push_str(tone.prompt_line());
    }
    if let Some(reference) = options
        .reference_context
        .filter(|value| !value.trim().is_empty())
    {
        system.push_str(&reference_context_block(Some(reference)));
    }
    if let Some(instructions) = options
        .instructions
        .filter(|value| !value.trim().is_empty())
    {
        system.push_str(&format!(
            "\n\nExplicit translation instructions — AUTHORITATIVE: {instructions}"
        ));
    }
    system
}

/// Validity of a target-language row: a slash is illegal only when the target invents it (a slash carried over from the source is kept verbatim).
fn validate_target_rows(glossary: &[BilingualTerm]) -> Result<(), LlmError> {
    for term in glossary {
        if !has_slash(&term.source) && has_slash(&term.target) {
            return Err(LlmError::Malformed(format!(
                "translation brief target {:?} for {:?} contains slash-separated alternatives — return exactly one literal rendering",
                term.target, term.source
            )));
        }
    }
    Ok(())
}

/// Target-language translation brief under the file contract (§5): produces the [`TargetContext`] for `ai/context.<lang>.md`.
///
/// A single call. The seed document is projected from the canonical term table (§5.3, terms first). The model only fills `Target` and the three body sections, then the code restores user rows: existing `Origin=user` translations are kept verbatim, and model rows are all `Origin=analyzed, Lock=no`.
///
/// Design decision: the full text is no longer run page by page through extract+merge. The seed table already carries the full set of analysis terms, and the remaining evidence needs are covered by head and tail excerpts. When the analysis is missing, it degrades to a single call with an empty table plus excerpts, which still does not block the pipeline.
pub fn run_translation_brief_file_contract(
    doc: &TranscriptDoc,
    llm: &mut dyn LlmJson,
    options: &TranslationBriefOptions<'_>,
    source: Option<&SourceContext>,
    existing: Option<&TargetContext>,
    sleep: &mut dyn FnMut(f64),
    on_attempt: &mut dyn FnMut(&PageAttempt<'_>),
) -> Result<TargetContext, LlmError> {
    let seed = seed_target_context(doc, options, source, existing);
    let input = format!(
        "{}\n# Transcript Excerpt\n{}\n",
        render_target_context(&seed),
        head_tail_excerpt(doc, budgets::ANALYSIS)
    );
    let system = context_target_system(options);
    let page_id = context_page_id(0);
    let mut tries = 0_u32;
    // Retry feedback carries the real problems summary (§2.5) and is no longer a fixed string.
    let mut last_problems: Option<String> = None;
    let parsed = with_retry(MAX_RETRIES, &mut *sleep, |attempt| {
        let raw = llm.complete(&LlmRequest {
            kind: "translate-brief",
            system: system.clone(),
            user: input.clone(),
            temperature: 0.2,
            attempt: attempt + 1,
            retry_reason: (attempt > 0).then(|| {
                last_problems.clone().unwrap_or_else(|| {
                    "the previous target context document failed validation".to_owned()
                })
            }),
        })?;
        tries += 1;
        let parsed = parse_model_target_context(Some(&input), &raw);
        let problems = parsed.diagnostics.problems.clone();
        let outcome = match parsed.context {
            Some(context) => validate_target_rows(&context.glossary).map(|()| context),
            None => Err(LlmError::Malformed(format!(
                "target context rejected — {}",
                summarize_context_problems(&problems)
            ))),
        };
        if let Err(error) = &outcome {
            last_problems = Some(malformed_detail(error));
        }
        on_attempt(&PageAttempt {
            page_id: &page_id,
            attempt: tries,
            input: &input,
            output: &raw,
            problems: &problems,
            accepted: outcome.is_ok(),
        });
        outcome
    })?;

    let mut model_rows = parsed.glossary;
    for row in &mut model_rows {
        row.source = row.source.trim().to_owned();
        row.target = row.target.trim().to_owned();
        row.origin = TermOrigin::Analyzed;
        row.locked = false;
    }
    model_rows.retain(|row| !row.source.is_empty());
    let model_targets: std::collections::BTreeMap<&str, &str> = model_rows
        .iter()
        .map(|row| (row.source.as_str(), row.target.as_str()))
        .collect();
    // Final form of user rows: existing translations are kept verbatim. Only a first-time translation (`Target` still empty) adopts the translation the model filled in this round. `Lock`/`Origin` always come from the user channel.
    let user_rows = seed
        .glossary
        .iter()
        .filter(|row| row.origin == TermOrigin::User)
        .map(|row| {
            let mut row = row.clone();
            if row.target.trim().is_empty()
                && let Some(target) = model_targets.get(row.source.as_str())
            {
                row.target = (*target).to_owned();
            }
            row
        })
        .filter(|row| !(row.locked && row.target.trim().is_empty()))
        .collect::<Vec<_>>();
    let glossary = merge_bilingual_terms(&user_rows, &model_rows);

    Ok(TargetContext {
        target_lang: options.target_lang.to_owned(),
        fingerprint: fingerprint(&doc.words),
        analysis_fingerprint: seed.analysis_fingerprint.clone(),
        instructions_fingerprint: seed.instructions_fingerprint.clone(),
        tone: options.tone,
        // The summary and style are echoed into the translate prompt. At acceptance time, normalize the half-width punctuation in CJK context, so the persisted context.<lang>.md is in its clean form.
        summary: crate::atomize::normalize_cjk_ascii_punctuation(
            if parsed.summary.trim().is_empty() {
                &seed.summary
            } else {
                parsed.summary.trim()
            },
        ),
        glossary,
        style: crate::atomize::normalize_cjk_ascii_punctuation(if parsed.style.trim().is_empty() {
            &seed.style
        } else {
            parsed.style.trim()
        }),
        difficulties: if parsed.difficulties.is_empty() {
            seed.difficulties.clone()
        } else {
            parsed.difficulties
        },
    })
}

/// Mirror lint at `task submit` time (§10.3): uses the same parser as the engine.
///
/// The parse mode is [`crate::filepipe::ParseMode::Model`]. Defects that code can resolve (duplicate rows, broken column counts, unknown Category, missing frontmatter) are only recorded as Warnings. So the mirror lint no longer marks them `rejected`, which keeps it strictly consistent with the engine's acceptance criterion.
pub fn lint_agent_answer_context_source(payload: &str, answer: &str) -> Vec<String> {
    let parsed = parse_model_source_context(Some(payload), answer);
    context_problem_lines(&parsed.diagnostics.problems)
}

/// Same as above, for the target-language document. Additionally re-checks the slash rule (same criterion as the engine side).
pub fn lint_agent_answer_context_target(payload: &str, answer: &str) -> Vec<String> {
    let parsed = parse_model_target_context(Some(payload), answer);
    let mut problems = context_problem_lines(&parsed.diagnostics.problems);
    if let Some(context) = parsed.context
        && let Err(error) = validate_target_rows(&context.glossary)
    {
        problems.push(error.to_string());
    }
    problems
}

/// `context.md` → legacy [`Analysis`] model (downstream prompt assembly still consumes it).
///
/// `namedEntities` has no separate field in context.md. Design §5.1 explicitly says context.md **replaces** the three of `summary/terms/namedEntities`, and the entities are the term rows whose `Category` is person/product/proper. The conversion rebuilds them by this rule, so the dual write of `ai/brief.json` does not degrade into an empty entity table.
pub fn analysis_from_source_context(context: &SourceContext) -> Analysis {
    Analysis {
        summary: context.summary.clone(),
        terms: context
            .terms
            .iter()
            .map(|term| AnalysisTerm {
                term: term.source.clone(),
                note: (!term.note.is_empty()).then(|| term.note.clone()),
                observed_variants: term.variants.clone(),
            })
            .collect(),
        named_entities: context
            .terms
            .iter()
            .filter(|term| {
                matches!(
                    term.category,
                    TermCategory::Person | TermCategory::Product | TermCategory::Proper
                )
            })
            .map(|term| term.source.clone())
            .collect(),
        fingerprint: context.fingerprint.clone(),
        reference_fingerprint: context.reference_fingerprint.clone(),
    }
}

/// Legacy [`Analysis`] model → `context.md` (migration of existing data, §5.2 item 2).
///
/// Terms in the legacy model have no category: named-entity rows go to `proper`, the rest to `other`. All rows are `Origin=analyzed, Lock=no`, because the legacy source-language table never had a user-lock channel.
pub fn source_context_from_analysis(analysis: &Analysis) -> SourceContext {
    let entities = analysis
        .named_entities
        .iter()
        .map(String::as_str)
        .collect::<std::collections::BTreeSet<_>>();
    let mut seen = std::collections::BTreeSet::new();
    let mut terms = analysis
        .terms
        .iter()
        .filter(|term| !term.term.trim().is_empty())
        .filter(|term| seen.insert(term.term.trim().to_owned()))
        .map(|term| CanonicalTerm {
            source: term.term.trim().to_owned(),
            category: if entities.contains(term.term.trim()) {
                TermCategory::Proper
            } else {
                TermCategory::Other
            },
            variants: term.observed_variants.clone(),
            note: term.note.clone().unwrap_or_default(),
            locked: false,
            origin: TermOrigin::Analyzed,
        })
        .collect::<Vec<_>>();
    for entity in analysis
        .named_entities
        .iter()
        .filter(|entity| !entity.trim().is_empty())
    {
        if seen.insert(entity.trim().to_owned()) {
            terms.push(CanonicalTerm {
                source: entity.trim().to_owned(),
                category: TermCategory::Proper,
                variants: Vec::new(),
                note: String::new(),
                locked: false,
                origin: TermOrigin::Analyzed,
            });
        }
    }
    terms.sort_by(|left, right| left.source.cmp(&right.source));
    SourceContext {
        fingerprint: analysis.fingerprint.clone(),
        reference_fingerprint: analysis.reference_fingerprint.clone(),
        summary: analysis.summary.clone(),
        terms,
    }
}

/// `context.<lang>.md` → legacy [`DocumentBrief`] model.
///
/// **This is where the M4 consumer-chain migration lands.** `Lock=yes` rows become `GlossaryEntry.locked=true`. The four downstream constraints of §5.2 (`rt` → [`crate::engines::translate::validate_translated_page`] → `lint_agent_answer` → `check missingTargets`), and align's `protected_targets` / `bilingual_anchors`, are then all connected as they are, without changing any consumer. Rows not yet translated (empty `Target`) do not enter the brief, since an empty translation would only produce noise downstream.
///
/// `source` is the `context.md` of the same document. In the context contract, named entities are determined by the `Category` in the source-language table (person/product/proper). When `source` is missing, it degrades to "user-locked rows are the entities". Note that this is a **degraded** interpretation: when the host has the source-language context it must pass it in, otherwise a document with no locked rows at all loses the entity hint block of translate.
pub fn brief_from_target_context(
    context: &TargetContext,
    source: Option<&SourceContext>,
) -> DocumentBrief {
    let glossary = context
        .glossary
        .iter()
        .filter(|term| !term.source.trim().is_empty() && !term.target.trim().is_empty())
        .map(|term| GlossaryEntry {
            source: term.source.clone(),
            target: term.target.clone(),
            note: (!term.note.is_empty()).then(|| term.note.clone()),
            locked: term.locked,
        })
        .collect::<Vec<_>>();
    let named_entities = match source {
        Some(source) => source
            .terms
            .iter()
            .filter(|term| {
                matches!(
                    term.category,
                    TermCategory::Person | TermCategory::Product | TermCategory::Proper
                )
            })
            .map(|term| term.source.clone())
            .collect(),
        None => glossary
            .iter()
            .filter(|entry| entry.locked)
            .map(|entry| entry.source.clone())
            .collect(),
    };
    DocumentBrief {
        target_lang: context.target_lang.clone(),
        tone: context.tone,
        // The read side also normalizes punctuation. Existing context.<lang>.md files may contain half-width punctuation that slipped in before acceptance. Cleaning it once at conversion covers historical residue (idempotent).
        summary: crate::atomize::normalize_cjk_ascii_punctuation(&context.summary),
        named_entities,
        glossary,
        style_guide: crate::atomize::normalize_cjk_ascii_punctuation(&context.style),
        difficulties: context.difficulties.clone(),
        fingerprint: context.fingerprint.clone(),
        analysis_fingerprint: context.analysis_fingerprint.clone(),
        instructions_fingerprint: context.instructions_fingerprint.clone(),
    }
}

/// Legacy [`DocumentBrief`] model → `context.<lang>.md` (migration of existing data, §5.2 item 2).
///
/// Legacy entries with `locked=true` become `Origin=user, Lock=yes`. This is the "user-lock channel" migration the design requires. Generated entries land as `Origin=analyzed`.
pub fn target_context_from_brief(brief: &DocumentBrief) -> TargetContext {
    let mut glossary = brief
        .glossary
        .iter()
        .filter(|entry| !entry.source.trim().is_empty())
        .map(|entry| BilingualTerm {
            source: entry.source.trim().to_owned(),
            target: entry.target.trim().to_owned(),
            note: entry.note.clone().unwrap_or_default(),
            locked: entry.locked,
            origin: if entry.locked {
                TermOrigin::User
            } else {
                TermOrigin::Analyzed
            },
        })
        // A locked row without a translation cannot compile the required targets, and the parser rejects it too. Such rows should not exist in existing data; if one does appear, it is downgraded to unlocked.
        .map(|mut term| {
            if term.locked && term.target.is_empty() {
                term.locked = false;
                term.origin = TermOrigin::Analyzed;
            }
            term
        })
        .collect::<Vec<_>>();
    glossary.sort_by(|left, right| left.source.cmp(&right.source));
    glossary.dedup_by(|left, right| left.source == right.source);
    TargetContext {
        target_lang: brief.target_lang.clone(),
        fingerprint: brief.fingerprint.clone(),
        analysis_fingerprint: brief.analysis_fingerprint.clone(),
        instructions_fingerprint: brief.instructions_fingerprint.clone(),
        tone: brief.tone,
        summary: brief.summary.clone(),
        glossary,
        style: brief.style_guide.clone(),
        difficulties: brief.difficulties.clone(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::asr_rows::RowIn;
    use crate::build::build_doc;
    use crate::doc::{DocEngine, DocMedia};
    use crate::llm::FakeLlm;

    fn doc() -> TranscriptDoc {
        build_doc(
            &[RowIn::new(0.0, 5.0, "we use cook cut every day")],
            DocMedia {
                id: None,
                path: None,
                hash: "sha256-00".to_owned(),
                duration: 10.0,
                sample_rate: None,
            },
            "en",
            DocEngine {
                name: "t".to_owned(),
                version: None,
                aligned_words: false,
            },
            None,
        )
    }

    // ── file-v1（M4）────────────────────────────────────────────────────

    const CONTEXT_ANSWER: &str = "---\nformat: \"context-doc/1\"\nfingerprint: \"\"\n---\n# Summary\nA demo about CucCut.\n\n# Canonical Terms\n| Source | Category | Variants | Note | Lock | Origin |\n|---|---|---|---|---|---|\n| CucCut | product | cook cut, CukKut | 产品名 | no | analyzed |\n";

    #[test]
    fn file_contract_analysis_filters_variants_and_stamps_fingerprint() {
        let doc = doc();
        let mut llm = FakeLlm::ok([CONTEXT_ANSWER]);
        let mut attempts = Vec::new();
        let context = run_analysis_file_contract(
            &doc,
            &mut llm,
            &AnalysisOptions::default(),
            None,
            &mut |_| {},
            &mut |attempt| attempts.push((attempt.page_id.to_owned(), attempt.accepted)),
        )
        .expect("analysis");
        assert_eq!(llm.calls.len(), 1);
        assert_eq!(llm.calls[0].0, "analysis");
        assert_eq!(attempts, vec![("p001".to_owned(), true)]);
        assert_eq!(context.terms.len(), 1);
        // Anti-hallucination check: a CukKut that does not literally appear is filtered out.
        assert_eq!(context.terms[0].variants, vec!["cook cut".to_owned()]);
        assert_eq!(context.terms[0].category, TermCategory::Product);
        assert_eq!(context.fingerprint, fingerprint(&doc.words));
    }

    #[test]
    fn file_contract_analysis_keeps_user_rows_and_demotes_model_claims() {
        let doc = doc();
        // The model granting Lock/Origin to itself: it must be downgraded, and it must not displace user rows.
        let answer: &'static str = Box::leak(
            CONTEXT_ANSWER
                .replace("| no | analyzed |", "| yes | user |")
                .into_boxed_str(),
        );
        let mut llm = FakeLlm::ok([answer]);
        let existing = SourceContext {
            terms: vec![CanonicalTerm {
                source: "CucCut".to_owned(),
                category: TermCategory::Product,
                variants: vec!["cook cut".to_owned()],
                note: "用户钉死".to_owned(),
                locked: true,
                origin: TermOrigin::User,
            }],
            ..SourceContext::default()
        };
        let context = run_analysis_file_contract(
            &doc,
            &mut llm,
            &AnalysisOptions::default(),
            Some(&existing),
            &mut |_| {},
            &mut |_| {},
        )
        .expect("analysis");
        assert_eq!(context.terms.len(), 1);
        assert_eq!(context.terms[0].origin, TermOrigin::User);
        assert!(context.terms[0].locked);
        assert_eq!(context.terms[0].note, "用户钉死");
    }

    #[test]
    fn file_contract_analysis_rejects_unparseable_document() {
        let doc = doc();
        let mut llm = FakeLlm::ok(["not a context document at all", "still not one", "nor this"]);
        let mut rejected = 0_u32;
        let error = run_analysis_file_contract(
            &doc,
            &mut llm,
            &AnalysisOptions::default(),
            None,
            &mut |_| {},
            &mut |attempt| {
                if !attempt.accepted {
                    rejected += 1;
                }
            },
        )
        .expect_err("must not fabricate an empty context");
        assert!(matches!(error, LlmError::Malformed(_)), "{error:?}");
        assert!(rejected >= 1);
    }

    /// 9600 words → two analysis pages (ANALYSIS=8000 + 10% slack / ANALYSIS_MIN_LAST=500).
    fn two_page_doc() -> TranscriptDoc {
        let text = "yan lecun says cook cut ".repeat(40);
        let rows = (0..48)
            .map(|i| RowIn::new(i as f64 * 10.0, i as f64 * 10.0 + 9.0, text.trim()))
            .collect::<Vec<_>>();
        build_doc(
            &rows,
            DocMedia {
                id: None,
                path: None,
                hash: "sha256-00".to_owned(),
                duration: 430.0,
                sample_rate: None,
            },
            "en",
            DocEngine {
                name: "t".to_owned(),
                version: None,
                aligned_words: false,
            },
            None,
        )
    }

    const PAGE_ONE_ANSWER: &str = "---\nformat: \"context-doc/1\"\nfingerprint: \"\"\n---\n# Summary\nPart one summary.\n\n# Canonical Terms\n| Source | Category | Variants | Note | Lock | Origin |\n|---|---|---|---|---|---|\n| CucCut | product | cook cut | short | no | analyzed |\n| Yann LeCun | person | yan lecun | | no | analyzed |\n";
    const PAGE_TWO_ANSWER: &str = "---\nformat: \"context-doc/1\"\nfingerprint: \"\"\n---\n# Summary\nPart two summary is the longer one.\n\n# Canonical Terms\n| Source | Category | Variants | Note | Lock | Origin |\n|---|---|---|---|---|---|\n| cuccut | product | | a much longer note | no | analyzed |\n| Yann-LeCun | tech | | | no | analyzed |\n";
    const SUMMARY_ANSWER: &str = "---\nformat: \"context-doc/1\"\nfingerprint: \"\"\n---\n# Summary\nMerged summary.\n\n# Canonical Terms\n| Source | Category | Variants | Note | Lock | Origin |\n|---|---|---|---|---|---|\n";

    #[test]
    fn file_contract_analysis_merges_terms_deterministically_and_asks_summary_only() {
        let doc = two_page_doc();
        assert_eq!(
            paginate_word_ranges(&doc.words, budgets::ANALYSIS, budgets::ANALYSIS_MIN_LAST).len(),
            2
        );
        let mut llm = FakeLlm::ok([PAGE_ONE_ANSWER, PAGE_TWO_ANSWER, SUMMARY_ANSWER]);
        let mut attempts = Vec::new();
        let context = run_analysis_file_contract(
            &doc,
            &mut llm,
            &AnalysisOptions::default(),
            None,
            &mut |_| {},
            &mut |attempt| attempts.push((attempt.page_id.to_owned(), attempt.accepted)),
        )
        .expect("analysis");
        assert_eq!(llm.calls.len(), 3);
        // The merge call carries only the per-page summaries, not the whole glossary table any more.
        let merge_user = &llm.calls[2].2;
        assert!(
            merge_user.contains("## Part p001\nPart one summary."),
            "{merge_user}"
        );
        assert!(!merge_user.contains("| CucCut |"), "{merge_user}");
        assert!(llm.calls[2].1.contains("leave the table EMPTY"));
        assert_eq!(
            attempts,
            vec![
                ("p001".to_owned(), true),
                ("p002".to_owned(), true),
                ("merge".to_owned(), true)
            ]
        );
        assert_eq!(context.summary, "Merged summary.");
        // Term union: on spelling ties the first seen wins, Note takes the longest, Category mode ties go to the first seen. Losing spellings merged into Variants still face the literal-occurrence check ("Yann-LeCun" not appearing → filtered).
        assert_eq!(context.terms.len(), 2);
        let cuccut = &context.terms[0];
        assert_eq!(cuccut.source, "CucCut");
        assert_eq!(cuccut.note, "a much longer note");
        assert_eq!(cuccut.variants, vec!["cook cut".to_owned()]);
        let lecun = &context.terms[1];
        assert_eq!(lecun.source, "Yann LeCun");
        assert_eq!(lecun.category, TermCategory::Person);
        assert_eq!(lecun.variants, vec!["yan lecun".to_owned()]);
        assert_eq!(context.fingerprint, fingerprint(&doc.words));
    }

    #[test]
    fn file_contract_analysis_summary_merge_falls_back_to_longest_partial() {
        let doc = two_page_doc();
        let mut llm = FakeLlm::ok([
            PAGE_ONE_ANSWER,
            PAGE_TWO_ANSWER,
            "not a document",
            "still not",
            "nor this",
        ]);
        let context = run_analysis_file_contract(
            &doc,
            &mut llm,
            &AnalysisOptions::default(),
            None,
            &mut |_| {},
            &mut |_| {},
        )
        .expect("summary failure must not sink the merged terms");
        assert_eq!(llm.calls.len(), 5);
        assert_eq!(context.summary, "Part two summary is the longer one.");
        assert_eq!(context.terms.len(), 2);
    }

    #[test]
    fn merge_partial_terms_prefers_majority_spelling_and_unions_variants() {
        let term = |source: &str, category, variants: &[&str], note: &str| CanonicalTerm {
            source: source.to_owned(),
            category,
            variants: variants.iter().map(|v| (*v).to_owned()).collect(),
            note: note.to_owned(),
            locked: false,
            origin: TermOrigin::Analyzed,
        };
        let partial = |terms: Vec<CanonicalTerm>| SourceContext {
            terms,
            ..SourceContext::default()
        };
        let merged = merge_partial_terms(&[
            partial(vec![term("resnext", TermCategory::Tech, &["res next"], "")]),
            partial(vec![term(
                "ResNeXt",
                TermCategory::Tech,
                &["Res Next", "resnet x"],
                "arch",
            )]),
            partial(vec![
                term("ResNeXt", TermCategory::Proper, &[], ""),
                term("DiT", TermCategory::Tech, &["dit"], ""),
            ]),
        ]);
        let (merged, dropped) = merged;
        assert_eq!(dropped, 0);
        assert_eq!(merged.len(), 2);
        assert_eq!(merged[0].source, "ResNeXt");
        assert_eq!(merged[0].category, TermCategory::Tech);
        assert_eq!(merged[0].note, "arch");
        assert_eq!(
            merged[0].variants,
            vec!["res next".to_owned(), "resnet x".to_owned()]
        );
        assert_eq!(merged[1].source, "DiT");
        // Variants that differ from the canonical form only in case are not kept.
        assert!(merged[1].variants.is_empty());
    }

    /// Whole-text row limit (§2.1): keys beyond [`ANALYSIS_MAX_TERMS`] are selected by cross-page occurrence count, descending. The output is still in first-occurrence order. The drop count is handed to the host to report, and pages are not rejected.
    #[test]
    fn merge_partial_terms_caps_total_rows_by_cross_page_hits() {
        let term = |source: String| CanonicalTerm {
            source,
            category: TermCategory::Tech,
            variants: Vec::new(),
            note: String::new(),
            locked: false,
            origin: TermOrigin::Analyzed,
        };
        // Page 1 writes ANALYSIS_MAX_TERMS + 20 unique words; page 2 only rewrites the last 10.
        let unique: Vec<CanonicalTerm> = (0..ANALYSIS_MAX_TERMS + 20)
            .map(|index| term(format!("Term{index:04}")))
            .collect();
        let repeated: Vec<CanonicalTerm> = (ANALYSIS_MAX_TERMS + 10..ANALYSIS_MAX_TERMS + 20)
            .map(|index| term(format!("Term{index:04}")))
            .collect();
        let partial = |terms: Vec<CanonicalTerm>| SourceContext {
            terms,
            ..SourceContext::default()
        };
        let (merged, dropped) = merge_partial_terms(&[partial(unique), partial(repeated)]);
        assert_eq!(merged.len(), ANALYSIS_MAX_TERMS);
        assert_eq!(dropped, 20);
        // The 10 words that appear twice must be kept, even if their first occurrence comes latest in order.
        for index in ANALYSIS_MAX_TERMS + 10..ANALYSIS_MAX_TERMS + 20 {
            let wanted = format!("Term{index:04}");
            assert!(
                merged.iter().any(|term| term.source == wanted),
                "{wanted} appears twice but was truncated"
            );
        }
        // The output order is still the first-occurrence order (monotonically increasing Term sequence number).
        let sources: Vec<&str> = merged.iter().map(|term| term.source.as_str()).collect();
        let mut sorted = sources.clone();
        sorted.sort_unstable();
        assert_eq!(sources, sorted);
    }

    /// §2.1 end to end: exhausting three attempts on one page **no longer** propagates upward and fails the whole analysis. The remaining pages are merged as usual, and failed pages are only counted in `pages_failed`. Measured: each of 5 analysis runs had 3–9 pages exhausted, and the old behavior dragged the whole polish down with it.
    #[test]
    fn file_contract_analysis_keeps_good_pages_when_one_page_gives_up() {
        let doc = two_page_doc();
        let mut llm = FakeLlm::ok([PAGE_ONE_ANSWER, "not a document", "still not", "nor this"]);
        let outcome = run_analysis_file_contract_report(
            &doc,
            &mut llm,
            &AnalysisOptions::default(),
            None,
            &mut |_| {},
            &mut |_| {},
        )
        .expect("one failed page must not sink the analysis");
        assert_eq!(outcome.pages_failed, 1);
        assert_eq!(outcome.terms_dropped, 0);
        // Only one page succeeded ⇒ no merge call is run; the summary is taken directly from that page.
        assert_eq!(outcome.context.summary, "Part one summary.");
        assert_eq!(
            outcome
                .context
                .terms
                .iter()
                .map(|term| term.source.as_str())
                .collect::<Vec<_>>(),
            vec!["CucCut", "Yann LeCun"]
        );
        assert_eq!(outcome.context.fingerprint, fingerprint(&doc.words));
    }

    /// If every page is exhausted, it still returns `Err`: the host must keep the old context and never overwrite it with an empty table.
    #[test]
    fn file_contract_analysis_errors_only_when_every_page_fails() {
        let doc = two_page_doc();
        let mut llm = FakeLlm::ok(["a", "b", "c", "d", "e", "f"]);
        let error = run_analysis_file_contract_report(
            &doc,
            &mut llm,
            &AnalysisOptions::default(),
            None,
            &mut |_| {},
            &mut |_| {},
        )
        .expect_err("no usable page at all");
        assert!(matches!(error, LlmError::Malformed(_)), "{error:?}");
    }

    /// The two most common page rejections measured (duplicate rows / oversized table) are now accepted on the first round, so a single call is enough.
    #[test]
    fn file_contract_analysis_accepts_duplicate_and_bulky_tables_in_one_call() {
        // Single page but long input: the hard size ceiling is computed as 8× the input, so short fixtures are not eaten by the floor.
        let text = "we use cook cut every day ".repeat(20);
        let rows = (0..20)
            .map(|i| RowIn::new(i as f64 * 10.0, i as f64 * 10.0 + 9.0, text.trim()))
            .collect::<Vec<_>>();
        let doc = build_doc(
            &rows,
            DocMedia {
                id: None,
                path: None,
                hash: "sha256-00".to_owned(),
                duration: 200.0,
                sample_rate: None,
            },
            "en",
            DocEngine {
                name: "t".to_owned(),
                version: None,
                aligned_words: false,
            },
            None,
        );
        assert_eq!(
            paginate_word_ranges(&doc.words, budgets::ANALYSIS, budgets::ANALYSIS_MIN_LAST).len(),
            1
        );
        let bulky: String = (0..400)
            .map(|index| format!("| Term{index:04} | tech | | | no | analyzed |\n"))
            .collect();
        let answer: &'static str = Box::leak(
            format!(
                "---\nformat: \"context-doc/1\"\nfingerprint: \"\"\n---\n# Summary\n摘要。\n\n\
                 # Canonical Terms\n| Source | Category | Variants | Note | Lock | Origin |\n\
                 |---|---|---|---|---|---|\n\
                 | CucCut | product | cook cut | | no | analyzed |\n\
                 | cuccut | brand | cook cut | 重复行 | no | analyzed |\n{bulky}"
            )
            .into_boxed_str(),
        );
        let mut llm = FakeLlm::ok([answer]);
        let mut rejected = 0_u32;
        let outcome = run_analysis_file_contract_report(
            &doc,
            &mut llm,
            &AnalysisOptions::default(),
            None,
            &mut |_| {},
            &mut |attempt| {
                if !attempt.accepted {
                    rejected += 1;
                }
            },
        )
        .expect("duplicate rows and a 400-row table are repaired, not retried");
        assert_eq!(
            llm.calls.len(),
            1,
            "accepted on the first round, no three retries"
        );
        assert_eq!(rejected, 0);
        assert_eq!(outcome.pages_failed, 0);
        // The single-page cap is cut to 150 rows; duplicates of the first row are merged.
        assert_eq!(
            outcome.context.terms.len(),
            crate::filepipe::ANALYSIS_MAX_TERMS_PER_PAGE
        );
        assert_eq!(outcome.context.terms[0].source, "CucCut");
    }

    /// Prompt tightened (§2.1): explicitly forbids common words and filler words, and fixes the per-page row limit.
    #[test]
    fn analysis_prompt_forbids_ordinary_vocabulary() {
        assert!(CONTEXT_EXTRACT_PROMPT.contains("NEVER list ordinary vocabulary"));
        assert!(CONTEXT_EXTRACT_PROMPT.contains("At most 80 rows"));
        assert!(CONTEXT_EXTRACT_PROMPT.contains("never repeat a `Source`"));
    }

    #[test]
    fn file_contract_analysis_injects_reference_and_stamps_fingerprint() {
        let doc = doc();
        let mut llm = FakeLlm::ok([CONTEXT_ANSWER]);
        let context_text = "Source title: CucCut with Dana Li";
        let context = run_analysis_file_contract(
            &doc,
            &mut llm,
            &AnalysisOptions {
                reference_context: Some(context_text.to_owned()),
                ..Default::default()
            },
            None,
            &mut |_| {},
            &mut |_| {},
        )
        .expect("analysis");
        assert!(llm.calls[0].1.contains(context_text));
        assert_eq!(
            context.reference_fingerprint,
            Some(fingerprint_strings([context_text]))
        );
    }

    fn source_context() -> SourceContext {
        SourceContext {
            fingerprint: "fp-src".to_owned(),
            reference_fingerprint: None,
            summary: "A demo about CucCut.".to_owned(),
            terms: vec![
                CanonicalTerm {
                    source: "CucCut".to_owned(),
                    category: TermCategory::Product,
                    variants: vec!["cook cut".to_owned()],
                    note: String::new(),
                    locked: true,
                    origin: TermOrigin::User,
                },
                CanonicalTerm {
                    source: "every day".to_owned(),
                    category: TermCategory::Other,
                    variants: Vec::new(),
                    note: String::new(),
                    locked: false,
                    origin: TermOrigin::Analyzed,
                },
            ],
        }
    }

    #[test]
    fn file_contract_translation_brief_seeds_terms_and_keeps_user_targets() {
        let doc = doc();
        let source = source_context();
        let existing = TargetContext {
            target_lang: "zh-Hans".to_owned(),
            glossary: vec![BilingualTerm {
                source: "CucCut".to_owned(),
                target: "酷剪".to_owned(),
                note: String::new(),
                locked: true,
                origin: TermOrigin::User,
            }],
            ..TargetContext::default()
        };
        let answer = "---\nformat: \"context-doc/1\"\ntargetLang: \"zh-Hans\"\nfingerprint: \"\"\n---\n# Translated Summary\n关于酷剪的演示。\n\n# Bilingual Glossary\n| Source | Target | Note | Lock | Origin |\n|---|---|---|---|---|\n| CucCut | 包裁 | | yes | user |\n| every day | 每天 | | no | analyzed |\n\n# Translation Style\n口语化。\n\n# Difficulties\n- 产品名不译\n";
        let mut llm = FakeLlm::ok([answer]);
        let options = TranslationBriefOptions {
            source_lang: "en",
            target_lang: "zh-Hans",
            ..TranslationBriefOptions::default()
        };
        let context = run_translation_brief_file_contract(
            &doc,
            &mut llm,
            &options,
            Some(&source),
            Some(&existing),
            &mut |_| {},
            &mut |_| {},
        )
        .expect("brief");
        assert_eq!(llm.calls.len(), 1);
        assert_eq!(llm.calls[0].0, "translate-brief");
        // The seed document must project the source-language terms into it. The model only fills Target.
        assert!(llm.calls[0].2.contains("| CucCut |"), "{}", llm.calls[0].2);
        let locked = context
            .glossary
            .iter()
            .find(|term| term.source == "CucCut")
            .expect("locked row");
        // User-locked translations are kept verbatim. Model rewrites (wrapping) are discarded.
        assert_eq!(locked.target, "酷剪");
        assert_eq!(locked.origin, TermOrigin::User);
        assert!(locked.locked);
        let generated = context
            .glossary
            .iter()
            .find(|term| term.source == "every day")
            .expect("generated row");
        assert_eq!(generated.target, "每天");
        assert_eq!(generated.origin, TermOrigin::Analyzed);
        assert!(!generated.locked);
        assert_eq!(context.style, "口语化。");
        assert_eq!(context.difficulties, vec!["产品名不译".to_owned()]);
        assert_eq!(context.fingerprint, fingerprint(&doc.words));
        assert_eq!(context.analysis_fingerprint.as_deref(), Some("fp-src"));
    }

    #[test]
    fn file_contract_translation_brief_rejects_slash_alternatives() {
        let doc = doc();
        let answer = "---\nformat: \"context-doc/1\"\ntargetLang: \"zh-Hans\"\nfingerprint: \"\"\n---\n# Translated Summary\ns\n\n# Bilingual Glossary\n| Source | Target | Note | Lock | Origin |\n|---|---|---|---|---|\n| CucCut | 酷剪/包裁 | | no | analyzed |\n\n# Translation Style\n\n# Difficulties\n";
        let mut llm = FakeLlm::ok([answer, answer, answer]);
        let options = TranslationBriefOptions {
            source_lang: "en",
            target_lang: "zh-Hans",
            ..TranslationBriefOptions::default()
        };
        let error = run_translation_brief_file_contract(
            &doc,
            &mut llm,
            &options,
            None,
            None,
            &mut |_| {},
            &mut |_| {},
        )
        .expect_err("slash alternatives are rejected");
        assert!(matches!(error, LlmError::Malformed(_)), "{error:?}");
    }

    #[test]
    fn context_documents_round_trip_through_legacy_models() {
        let source = source_context();
        let analysis = analysis_from_source_context(&source);
        // Rows with Category ∈ {person, product, proper} are the named entities.
        assert_eq!(analysis.named_entities, vec!["CucCut".to_owned()]);
        let back = source_context_from_analysis(&analysis);
        assert_eq!(back.summary, source.summary);
        assert_eq!(
            back.terms
                .iter()
                .map(|t| t.source.as_str())
                .collect::<Vec<_>>(),
            vec!["CucCut", "every day"]
        );

        let target = TargetContext {
            target_lang: "zh-Hans".to_owned(),
            fingerprint: "fp".to_owned(),
            glossary: vec![
                BilingualTerm {
                    source: "CucCut".to_owned(),
                    target: "酷剪".to_owned(),
                    note: "产品".to_owned(),
                    locked: true,
                    origin: TermOrigin::User,
                },
                BilingualTerm {
                    source: "pending".to_owned(),
                    target: String::new(),
                    note: String::new(),
                    locked: false,
                    origin: TermOrigin::Analyzed,
                },
            ],
            style: "口语".to_owned(),
            ..TargetContext::default()
        };
        let brief = brief_from_target_context(&target, Some(&source));
        // Rows not yet translated do not enter the brief. Lock=yes becomes GlossaryEntry.locked.
        assert_eq!(brief.glossary.len(), 1);
        assert!(brief.glossary[0].locked);
        // Entities come from the Category in the source-language table, not from the degraded "locked row" interpretation.
        assert_eq!(brief.named_entities, vec!["CucCut".to_owned()]);
        assert_eq!(brief.style_guide, "口语");
        let degraded = brief_from_target_context(&target, None);
        // Half-width punctuation in CJK context in an existing context is normalized at conversion (historical residue cleanup).
        let infected = TargetContext {
            summary: "介绍 vLLM,重点是显存".to_owned(),
            style: "口语化,短句;避免书面腔:直译".to_owned(),
            ..target.clone()
        };
        let cleaned = brief_from_target_context(&infected, Some(&source));
        assert_eq!(cleaned.summary, "介绍 vLLM，重点是显存");
        assert_eq!(cleaned.style_guide, "口语化，短句；避免书面腔：直译");
        assert_eq!(degraded.named_entities, vec!["CucCut".to_owned()]);
        let back = target_context_from_brief(&brief);
        assert_eq!(back.glossary.len(), 1);
        assert_eq!(back.glossary[0].origin, TermOrigin::User);
        assert!(back.glossary[0].locked);
    }

    #[test]
    fn legacy_brief_locked_entries_migrate_to_user_origin() {
        let brief = DocumentBrief {
            target_lang: "zh-Hans".to_owned(),
            glossary: vec![
                GlossaryEntry {
                    source: "CucCut".to_owned(),
                    target: "酷剪".to_owned(),
                    note: None,
                    locked: true,
                },
                GlossaryEntry {
                    source: "demo".to_owned(),
                    target: "演示".to_owned(),
                    note: None,
                    locked: false,
                },
            ],
            ..DocumentBrief::default()
        };
        let context = target_context_from_brief(&brief);
        let locked = &context.glossary[0];
        assert_eq!(locked.source, "CucCut");
        assert_eq!(locked.origin, TermOrigin::User);
        assert!(locked.locked);
        assert_eq!(context.glossary[1].origin, TermOrigin::Analyzed);
    }

    #[test]
    fn merge_bilingual_terms_respects_user_lock_priority() {
        let existing = vec![BilingualTerm {
            source: "CucCut".to_owned(),
            target: "酷剪".to_owned(),
            note: String::new(),
            locked: true,
            origin: TermOrigin::User,
        }];
        let regenerated = vec![
            BilingualTerm {
                source: "CucCut".to_owned(),
                target: "包裁".to_owned(),
                note: String::new(),
                locked: false,
                origin: TermOrigin::Analyzed,
            },
            BilingualTerm {
                source: "demo".to_owned(),
                target: "演示".to_owned(),
                note: String::new(),
                locked: false,
                origin: TermOrigin::Analyzed,
            },
        ];
        let merged = merge_bilingual_terms(&existing, &regenerated);
        assert_eq!(merged.len(), 2);
        assert_eq!(merged[0].target, "酷剪");
        assert_eq!(merged[1].target, "演示");
    }

    #[test]
    fn agent_lint_mirrors_engine_rejection() {
        assert!(lint_agent_answer_context_source("", CONTEXT_ANSWER).is_empty());
        assert!(!lint_agent_answer_context_source("", "garbage").is_empty());
        let slashed = "---\nformat: \"context-doc/1\"\ntargetLang: \"zh-Hans\"\nfingerprint: \"\"\n---\n# Translated Summary\ns\n\n# Bilingual Glossary\n| Source | Target | Note | Lock | Origin |\n|---|---|---|---|---|\n| CucCut | 酷剪/包裁 | | no | analyzed |\n\n# Translation Style\n\n# Difficulties\n";
        let problems = lint_agent_answer_context_target("", slashed);
        assert!(
            problems.iter().any(|line| line.contains("slash")),
            "{problems:?}"
        );
        // A slash inside a source word (half- or full-width) is kept verbatim and is not treated as an alternative. A full-width slash that the target invents is also rejected.
        let verbatim = "---\nformat: \"context-doc/1\"\ntargetLang: \"zh-Hans\"\nfingerprint: \"\"\n---\n# Translated Summary\ns\n\n# Bilingual Glossary\n| Source | Target | Note | Lock | Origin |\n|---|---|---|---|---|\n| /compact | /compact | | no | analyzed |\n| AI／人工智能 | AI／人工智能 | | no | analyzed |\n\n# Translation Style\n\n# Difficulties\n";
        assert!(lint_agent_answer_context_target("", verbatim).is_empty());
        let fullwidth = "---\nformat: \"context-doc/1\"\ntargetLang: \"zh-Hans\"\nfingerprint: \"\"\n---\n# Translated Summary\ns\n\n# Bilingual Glossary\n| Source | Target | Note | Lock | Origin |\n|---|---|---|---|---|\n| CucCut | 酷剪辑／包剪 | | no | analyzed |\n\n# Translation Style\n\n# Difficulties\n";
        assert!(!lint_agent_answer_context_target("", fullwidth).is_empty());
    }

    #[test]
    fn format_for_prompt_lists_variants_and_notes() {
        let analysis = Analysis {
            summary: "s".to_owned(),
            terms: vec![AnalysisTerm {
                term: "CucCut".to_owned(),
                note: Some("产品名".to_owned()),
                observed_variants: vec!["宝卡特".to_owned()],
            }],
            named_entities: vec![],
            fingerprint: String::new(),
            reference_fingerprint: None,
        };
        let text = format_for_prompt(&analysis);
        assert!(text.contains("- CucCut [observed ASR: 宝卡特 → CucCut] (产品名)"));
        assert_eq!(format_for_prompt(&Analysis::default()), "(none)");
    }

    #[test]
    fn brief_prompts_require_mandatory_cjk_latin_spacing() {
        let zh = simplified_chinese_prompt_block("zh-Hans").unwrap();
        assert!(zh.contains("mandatory, not a preference"));
        assert!(zh.contains("35% KV 缓存"));
        assert!(zh.contains("--speculative-model"));
        assert!(zh.contains("never insert a space inside an identifier"));

        assert!(CONTEXT_TARGET_PROMPT.contains("spacing rule as mandatory"));
        assert!(CONTEXT_TARGET_PROMPT.contains("35% KV 缓存"));
        assert!(CONTEXT_TARGET_PROMPT.contains("--speculative-model"));
        // Korean is not covered by this rule: particles are written attached to the word before them.
        assert!(CONTEXT_TARGET_PROMPT.contains("Han characters or kana"));
        assert!(CONTEXT_TARGET_PROMPT.contains("does not apply to a target written in Hangul"));
    }

    /// On a refinement (align-only) round the analysis, instructions and tone are unavailable. Judging by the generation inputs necessarily mismatches, so the brief is rerun every round and the user-locked terms get washed out. The relaxed check looks only at the word truth and the target language.
    #[test]
    fn align_only_brief_reuse_ignores_generation_inputs() {
        let doc = doc();
        let brief = DocumentBrief {
            target_lang: "zh".to_owned(),
            tone: Some(TranslationTone::Formal),
            fingerprint: fingerprint(&doc.words),
            analysis_fingerprint: Some("analysis-from-the-translate-round".to_owned()),
            instructions_fingerprint: Some(fingerprint_strings(["Keep CucCut"])),
            ..Default::default()
        };
        // The generation-input check mismatches (refinement rounds pass exactly these three None).
        assert!(!brief.matches_inputs(&doc, None, None));
        // Document check hit.
        assert!(brief.matches_document(&doc, "zh"));
        // If the word truth changed, do not reuse. The translation's truth itself has expired.
        let mut changed_words = doc.clone();
        changed_words.words[0].text = "They".to_owned();
        assert!(!brief.matches_document(&changed_words, "zh"));
        // Different target language: do not reuse.
        assert!(!brief.matches_document(&doc, "ja"));
    }

    #[test]
    fn translation_brief_cache_invalidates_each_input_but_not_user_edits() {
        let doc = doc();
        let analysis = Analysis {
            fingerprint: fingerprint(&doc.words),
            ..Default::default()
        };
        let mut brief = DocumentBrief {
            fingerprint: fingerprint(&doc.words),
            analysis_fingerprint: Some(analysis.fingerprint.clone()),
            instructions_fingerprint: Some(fingerprint_strings(["Keep CucCut"])),
            summary: "user-edited summary".to_owned(),
            style_guide: "user-edited style".to_owned(),
            glossary: vec![GlossaryEntry {
                source: "CucCut".to_owned(),
                target: "酷剪辑".to_owned(),
                locked: true,
                ..Default::default()
            }],
            ..Default::default()
        };
        assert!(brief.matches_inputs(&doc, Some(&analysis), Some("Keep CucCut")));

        // Editable body fields are deliberately outside the cache key.
        brief.glossary[0].target = "酷剪".to_owned();
        brief.summary = "another user summary".to_owned();
        assert!(brief.matches_inputs(&doc, Some(&analysis), Some("Keep CucCut")));

        let mut changed_words = doc.clone();
        changed_words.words[0].text = "They".to_owned();
        assert!(!brief.matches_inputs(&changed_words, Some(&analysis), Some("Keep CucCut")));

        let mut changed_analysis = analysis.clone();
        changed_analysis.fingerprint = "different-analysis".to_owned();
        assert!(!brief.matches_inputs(&doc, Some(&changed_analysis), Some("Keep CucCut")));
        assert!(!brief.matches_inputs(&doc, Some(&analysis), Some("Translate formally")));
    }

    #[test]
    fn simplified_chinese_gate_is_script_aware() {
        assert!(simplified_chinese_prompt_block("zh-Hans").is_some());
        assert!(simplified_chinese_prompt_block("zh-CN").is_some());
        assert!(simplified_chinese_prompt_block("zh").is_some());
        assert!(simplified_chinese_prompt_block("zh-Hant").is_none());
        assert!(simplified_chinese_prompt_block("zh-Hant-TW").is_none());
    }

    #[test]
    fn glossary_prompt_limit_prefers_source_hits_stably() {
        let brief = DocumentBrief {
            glossary: vec![
                GlossaryEntry {
                    source: "rare".to_owned(),
                    target: "罕见".to_owned(),
                    ..Default::default()
                },
                GlossaryEntry {
                    source: "Air".to_owned(),
                    target: "空气".to_owned(),
                    ..Default::default()
                },
            ],
            ..Default::default()
        };
        let selected = brief.glossary_for_prompt("Air Air Airport", None, 1);
        assert_eq!(selected[0].source, "Air");
    }

    #[test]
    fn glossary_prompt_carries_only_entries_the_source_actually_hits() {
        let entry = |source: &str, target: &str| GlossaryEntry {
            source: source.to_owned(),
            target: target.to_owned(),
            ..Default::default()
        };
        let brief = DocumentBrief {
            glossary: vec![
                entry("commit", "突破确认"),
                entry("Wyckoff", "威科夫"),
                entry("spring", "弹簧"),
                entry("量化", "quantization"),
            ],
            ..Default::default()
        };
        let analysis = Analysis {
            terms: vec![AnalysisTerm {
                term: "Wyckoff".to_owned(),
                note: None,
                observed_variants: vec!["维科夫".to_owned()],
            }],
            ..Default::default()
        };
        // `commitment` is not `commit`; `spring` does not appear; `Wyckoff` appears only as a misrecognized form.
        let source = "维科夫讲过 commitment 和量化，量化之后更稳。";
        let picked = |analysis| {
            brief
                .glossary_for_prompt(source, analysis, 80)
                .into_iter()
                .map(|entry| entry.source.as_str())
                .collect::<Vec<_>>()
        };
        assert_eq!(picked(None), ["量化"]);
        assert_eq!(picked(Some(&analysis)), ["量化", "Wyckoff"]);
    }

    #[test]
    fn alignment_protection_ignores_terms_wider_than_fit() {
        let brief = DocumentBrief {
            glossary: vec![
                GlossaryEntry {
                    target: "酷剪辑".to_owned(),
                    ..Default::default()
                },
                GlossaryEntry {
                    target: "这是一个不可能完整放进同一行的超长锁定译名".to_owned(),
                    ..Default::default()
                },
            ],
            ..Default::default()
        };
        assert_eq!(brief.protected_targets_for_fit("zh-Hans", 8), ["酷剪辑"]);
    }
}
