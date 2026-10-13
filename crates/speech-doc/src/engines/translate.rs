//! Stage four: translation engine (§8 / v0.3 §4). Sentence-level whole-sentence translation, **written directly to the doc page by page**.
//!
//! Three granularities: sentence (the unit of translation and dirty checking, see the `sentence` module), page (the packing unit), and translated Cue (the display unit, derived from the `transAlign` overlay of the align engine). From v0.3 this engine writes the doc. Each page lands `trans[lang][s-…]` (complete, natural translated sentences) and stamps the `transSrc` sentence fingerprint. A sentence is persisted as soon as it is translated, so the doc itself is the checkpoint for resumable runs. Display splitting (`transAlign`) belongs to the align engine.
//!
//! Incremental semantics: first clean up orphan keys that no longer correspond to a current sentence after a source structure change. Only sentences that are missing a translation or are stale go to the LLM. `force` retranslates everything, and `sentences` retranslates the named sentences.

use std::collections::{BTreeMap, BTreeSet};

use crate::atomize::{is_cjk_text, normalize_chars};
use crate::autocorrect::{Options as AutocorrectOptions, format_translation_with_options};
use crate::cue::{derive_cues, derive_paras};
use crate::doc::TranscriptDoc;
use crate::engines::align::{FusionDraft, FusionDrafts, FusionLineInfo, fusion_line_info};
use crate::engines::brief::{
    Analysis, DocumentBrief, TranslationTone, format_for_prompt, simplified_chinese_prompt_block,
};
use crate::filepipe::{
    Diagnostics, ProblemCode, ProblemScope, TranslateAlignmentDraft, TranslateAlignmentInput,
    TranslatePage, TranslateParsed, TranslateSection, TranslateSentence, is_row_partition,
    lines_translation, parse_translate_page, parse_translate_source, render_translate_page,
};
use crate::llm::{
    LlmError, LlmJson, LlmRequest, MAX_RETRIES, RetryPolicy, complete_batch_retry_report,
};
use crate::sentence::{Sentence, derive_sentences, stale_sentences};
use crate::split::{TransParams, primary_subtag};

#[derive(Debug, Clone)]
pub struct TranslateOptions {
    pub source_lang: String,
    /// Target language (BCP-47).
    pub lang: String,
    /// Retranslate all sentences. By default only missing and stale sentences are translated.
    pub force: bool,
    /// When `Some`, only the named sentences are processed. Explicitly selected sentences are retranslated even if their translation is fresh.
    pub sentences: Option<BTreeSet<String>>,
    /// Page budget (source word count; counting rules in [`crate::atomize::word_count`]). The host takes it from the executor's [`crate::paging::PageExecutor::translate_words`] (§12).
    pub page_budget: usize,
    /// Explicit user instructions (appended at the end of the system prompt).
    pub instructions: Option<String>,
    /// Full-text source analysis. Also the complete fallback context when there is no bilingual brief.
    pub analysis: Option<Analysis>,
    /// Editable bilingual brief for each target language.
    pub brief: Option<DocumentBrief>,
    /// formal or casual. None means neutral.
    pub tone: Option<TranslationTone>,
    /// Apply the default CJK punctuation/spacing/casing normalization.
    pub autocorrect: bool,
    /// When `Some`, the translate `file-v1` answer also carries a target-first alignment draft. A bad draft is only discarded and does not affect acceptance of the translation.
    pub align: Option<TransParams>,
    /// **Row-partition mode** of the fusion draft (`--align-fusion rows`). The contract changes to require the model to split the translation into display rows in source-word order. The carrier additionally carries deterministic source-side grouping (`data-align-groups`). Coverage widens from "the source side already needs splitting" to "≥ 8 words". This field has no effect when `align` is `None`.
    pub align_rows: bool,
    /// Line-text carrier (`--align-fusion lines`, [`crate::filepipe::lines_translation`]). The whole page switches to `lines/1` plain text: one sentence per line, translations written in blocks, and each block tied to its source by the first and last source-word references. The engine locates the alignment evidence jointly and checks blocks directly. When this is true, `align_rows` has no effect. This field has no effect when `align` is `None`.
    pub align_lines: bool,
    /// Number of concurrent slots available on the execution side. Kept in the options so the host can plan workers. Pagination looks only at the source word count of `page_budget`, and does not change with concurrency slots or sentence count.
    pub worker_slots: Option<usize>,
    /// Sentence ids judged stale by provenance (§11.3, computed by the host with [`crate::provenance::scan_provenance`]).
    ///
    /// This is the **incremental** criterion. It is ORed into the set to translate alongside stale and missing translations, but it is still subject to the explicit `sentences` selection. `sentences` narrows the set, and provenance must not bypass that.
    pub provenance_stale: BTreeSet<String>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct TranslateOutcome {
    /// Number of sentences whose translation was actually received and committed in this run. On the doc path this is `committed_sentences.len()`. The routed path cannot verify sentence by sentence, so it is still the number of sentences sent for translation in this run.
    pub translated_sentences: usize,
    /// Number of sentences skipped (they already have fresh translations).
    pub skipped_sentences: usize,
    /// Total number of sentences in the current document.
    pub total_sentences: usize,
    /// IDs, in ascending order, of sentences sent in this run that got no translation back: the ones that were not recovered even after partial per-page success and the make-up round. They get no new fingerprint, so they will be selected for retranslation next time. Always empty on the routed path.
    pub missing_sentences: Vec<String>,
    /// IDs of sentences whose translation was actually committed in this run. Under the file contract, success is partial per page, so this set is not equal to the pending set. The host uses it to write `ai/state/translation.<lang>.json` (§11.3). Only sentences actually retranslated refresh their provenance snapshot. The routed (final timeline) path does not produce this set.
    pub committed_sentences: BTreeSet<String>,
    /// A structurally valid fusion draft from this run's translation answer. Align still verifies it against the worker answer in the same way.
    pub alignment_drafts: FusionDrafts,
    /// In rows mode, the number of sentences whose row partition is qualified but whose row boundaries do not fall on the group boundaries in `data-align-groups`. These drafts are **still accepted**. The count is used only to observe the hit rate of the grouping hint.
    pub rows_off_group_sentences: usize,
    /// In rows mode, the number of pages where a whole-page return of plain translation with no rows led to a soft resend, and the second answer was used (at most one per page; see [`rows_page_gave_up`]).
    pub rows_page_retries: usize,
}

/// One source-owned sentence after a host has projected it through the final
/// timeline. Route ids are request-local opaque ids; `(src_id, sentence_id)` is
/// the durable scatter destination.
#[derive(Debug, Clone, PartialEq)]
pub struct RoutedSentence {
    pub route_id: String,
    pub src_id: String,
    pub sentence_id: String,
    pub source_lang: String,
    pub source_text: String,
    pub src_fingerprint: String,
    pub display_duration: f64,
    pub translation: Option<String>,
    pub stamped_fingerprint: Option<String>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct RoutedTranslation {
    pub src_id: String,
    pub sentence_id: String,
    pub text: String,
    pub src_fingerprint: String,
}

#[derive(Debug, Clone)]
pub struct RoutedTranslateOptions {
    pub lang: String,
    pub force: bool,
    /// Durable `(srcId, sentenceId)` keys. Explicit selection always retranslates.
    pub sentences: Option<BTreeSet<(String, String)>>,
    /// Page budget (source word count; counting rules in [`crate::atomize::word_count`]). The host takes it from the executor's [`crate::paging::PageExecutor::translate_words`] (§12).
    pub page_budget: usize,
    pub instructions: Option<String>,
    pub analysis: Option<Analysis>,
    pub brief: Option<DocumentBrief>,
    pub tone: Option<TranslationTone>,
    pub autocorrect: bool,
    /// Chapter titles projected by the host, for the final-timeline path where no single doc can be read.
    pub chapter_titles: Vec<String>,
    /// Number of concurrent slots available on the execution side. Kept in the options so the host can plan workers. Pagination looks only at the source word count of `page_budget`, and does not change with concurrency slots or sentence count.
    pub worker_slots: Option<usize>,
}

fn identifier_char(ch: char) -> bool {
    ch.is_alphanumeric() || ch == '_'
}

/// Same counting rules as VoiceInk's `termPresent`. CJK uses literal substring matching. Latin and identifiers use case-insensitive matching and check identifier boundaries on both sides, so "Air" does not match "Airport".
pub fn term_present(source: &str, term: &str) -> bool {
    term_occurrences(source, term) > 0
}

/// Counting version of [`term_present`]: how many times the term appears in `source` under the same rules.
pub fn term_occurrences(source: &str, term: &str) -> usize {
    let term = term.trim();
    if term.is_empty() {
        return 0;
    }
    if is_cjk_text(term) {
        return source.match_indices(term).count();
    }
    let source_lower = source.to_lowercase();
    let term_lower = term.to_lowercase();
    source_lower
        .match_indices(&term_lower)
        .filter(|(start, matched)| {
            let end = start + matched.len();
            let before = source_lower[..*start].chars().next_back();
            let after = source_lower[end..].chars().next();
            !before.is_some_and(identifier_char) && !after.is_some_and(identifier_char)
        })
        .count()
}

fn required_targets(source: &str, brief: Option<&DocumentBrief>) -> Vec<String> {
    let Some(brief) = brief else {
        return Vec::new();
    };
    let mut targets = brief
        .glossary
        .iter()
        .filter(|entry| entry.locked && term_present(source, &entry.source))
        .map(|entry| entry.target.trim())
        .filter(|target| !target.is_empty())
        .map(str::to_owned)
        .collect::<Vec<_>>();
    targets.sort();
    targets.dedup();
    targets
}

fn prune_orphans<T>(
    table: Option<&mut BTreeMap<String, T>>,
    sentence_ids: &BTreeSet<&str>,
) -> bool {
    let Some(table) = table else {
        return false;
    };
    let before = table.len();
    table.retain(|id, _| sentence_ids.contains(id.as_str()));
    table.len() != before
}

/// Sentence-level whole-sentence translation. Zero I/O: the LLM and the backoff sleep are injected. After each page's `doc.trans` and `doc.transSrc` are written, `on_page` is called back. The host is responsible for atomically writing the doc to disk, since the doc is the checkpoint.
pub fn run_translate(
    doc: &mut TranscriptDoc,
    llm: &mut dyn LlmJson,
    options: &TranslateOptions,
    on_page: &mut dyn FnMut(&TranscriptDoc),
    sleep: &mut dyn FnMut(f64),
) -> Result<TranslateOutcome, LlmError> {
    run_translate_with_artifacts(doc, llm, options, on_page, &mut |_| {}, sleep)
}

/// Same as [`run_translate`], and it also hands the per-page attempts to the host to persist (`ai/translate/<lang>/vNNN/`, §4/§11).
pub fn run_translate_with_artifacts(
    doc: &mut TranscriptDoc,
    llm: &mut dyn LlmJson,
    options: &TranslateOptions,
    on_page: &mut dyn FnMut(&TranscriptDoc),
    on_attempt: &mut dyn FnMut(&TranslatePageAttempt<'_>),
    sleep: &mut dyn FnMut(f64),
) -> Result<TranslateOutcome, LlmError> {
    let cues = derive_cues(doc, &crate::layout_profile::cue_params_for_doc(doc));
    let sentences = derive_sentences(doc, &cues);
    let sentence_ids: BTreeSet<&str> = sentences
        .iter()
        .map(|sentence| sentence.id.as_str())
        .collect();

    // After a structural re-split, the old sentence ids can no longer be consumed by any projection. If they were kept, check would permanently report translation-orphan, and the user could not clear them by rerunning translation. The three tables that share the same source must converge together. Call back and persist first, before entering the LLM stage that may fail.
    let pruned_orphans = prune_orphans(doc.trans.get_mut(&options.lang), &sentence_ids)
        | prune_orphans(doc.trans_src.get_mut(&options.lang), &sentence_ids)
        | prune_orphans(doc.trans_align.get_mut(&options.lang), &sentence_ids);
    if pruned_orphans {
        on_page(doc);
    }

    let stale = stale_sentences(doc, &options.lang, &sentences);
    let translated: BTreeSet<&str> = doc
        .trans
        .get(&options.lang)
        .map(|table| table.keys().map(String::as_str).collect())
        .unwrap_or_default();
    let pending: Vec<&Sentence> = sentences
        .iter()
        .filter(|sentence| {
            options
                .sentences
                .as_ref()
                .is_none_or(|filter| filter.contains(&sentence.id))
                && (options.force
                    || options.sentences.is_some()
                    || stale.contains(&sentence.id)
                    || options.provenance_stale.contains(&sentence.id)
                    || !translated.contains(sentence.id.as_str()))
        })
        .collect();
    let skipped = sentences.len() - pending.len();
    let mut committed_sentences: BTreeSet<String> = BTreeSet::new();

    // Page count and boundaries are determined only by the language-aware word count of the source. Latin counts words and CJK counts characters. The number of sentences, the serialized character count, or worker slots no longer silently change how many calls are made.
    let prepared: Vec<PreparedLine<'_>> = pending
        .iter()
        .map(|sentence| PreparedLine::new(sentence, options.brief.as_ref()))
        .collect();
    let source_words: Vec<usize> = prepared
        .iter()
        .map(|line| crate::atomize::word_count(&line.sentence.source_text))
        .collect();
    let mut pages: Vec<&[PreparedLine<'_>]> = Vec::new();
    let mut cursor = 0_usize;
    for size in translate_page_sizes(&source_words, options.page_budget) {
        pages.push(&prepared[cursor..cursor + size]);
        cursor += size;
    }

    let document_source = sentences
        .iter()
        .map(|sentence| sentence.source_text.as_str())
        .collect::<Vec<_>>()
        .join("\n");
    let carrier = match options.align {
        Some(params) if options.align_lines => FileCarrier::Lines(params),
        Some(_) => FileCarrier::Html {
            rows: options.align_rows,
        },
        None => FileCarrier::Html { rows: false },
    };
    let system = {
        let mut system = translate_system_prompt(
            &options.source_lang,
            &options.lang,
            options.analysis.as_ref(),
            options.brief.as_ref(),
            options.tone,
            options.instructions.as_deref(),
            &document_source,
            carrier.prompt_body(),
        );
        if !doc.chapters.is_empty() {
            system.push_str(&format!(
                "\n\nChapters (document context only; never translate them): {}",
                doc.chapters
                    .iter()
                    .map(|chapter| chapter.title.as_str())
                    .collect::<Vec<_>>()
                    .join(" · ")
            ));
        }
        match carrier {
            FileCarrier::Html { rows } => {
                if let Some(params) = options.align.as_ref() {
                    system.push_str(&fusion_file_prompt_section(params, rows));
                }
            }
            // The carrier grammar reads last: it is what the model must obey
            // line by line, after the document context.
            FileCarrier::Lines(_) => {
                system.push_str("\n\nCarrier format — ");
                system.push_str(lines_translation::PROTOCOL);
            }
        }
        system
    };
    let file_pages = project_file_pages(
        doc,
        &cues,
        &sentences,
        &options.lang,
        &pages,
        &prepared,
        options.align.is_some(),
        carrier,
    );
    // The row-partition check of the fusion draft needs the source word count of the sentence. It is re-verified after AutoCorrect.
    let align_word_counts: BTreeMap<String, usize> = file_pages
        .iter()
        .flat_map(|page| page.lines.iter())
        .filter_map(|line| {
            line.alignment
                .as_ref()
                .map(|info| (line.id.clone(), info.source_words.len()))
        })
        .collect();
    let project_fingerprint = crate::fingerprint::fingerprint(&doc.words);
    let fingerprint_by_id = sentences
        .iter()
        .map(|sentence| (sentence.id.clone(), sentence.src_fingerprint.clone()))
        .collect::<BTreeMap<_, _>>();
    let protected_terms = options
        .brief
        .as_ref()
        .map(DocumentBrief::protected_targets)
        .unwrap_or_default();
    let mut alignment_drafts = FusionDrafts::new();
    let mut rows_off_group_sentences = 0usize;
    let mut rows_page_retries = 0usize;
    run_translate_file_contract(
        llm,
        sleep,
        &system,
        &options.source_lang,
        &options.lang,
        &project_fingerprint,
        &file_pages,
        carrier,
        &mut rows_page_retries,
        on_attempt,
        &mut |parsed| {
            let trans_table = doc.trans.entry(options.lang.clone()).or_default();
            let mut committed = Vec::with_capacity(parsed.translations.len());
            for (id, text) in parsed.translations {
                let text = if options.autocorrect {
                    format_translation_with_options(
                        &text,
                        &options.lang,
                        &protected_terms,
                        AutocorrectOptions::default(),
                    )
                } else {
                    text
                };
                if let Some(draft) = parsed.alignments.get(&id)
                    && let Some(draft) = format_fusion_draft(
                        draft,
                        &text,
                        align_word_counts.get(&id).copied().unwrap_or_default(),
                    )
                {
                    if draft.rows && !draft.on_groups {
                        rows_off_group_sentences += 1;
                    }
                    alignment_drafts.insert(id.clone(), draft);
                }
                if let Some(draft) = parsed.lines.get(&id)
                    && let Some(draft) = format_lines_draft(draft, &text)
                {
                    alignment_drafts.insert(id.clone(), draft);
                }
                trans_table.insert(id.clone(), text);
                committed.push(id);
            }
            // The sentence fingerprint is stamped only on sentences that were **actually committed**. A page can succeed partially. If the whole page were stamped, the sentences that failed would carry a fresh fingerprint with no translation. They would never be selected as stale again, a permanent and invisible missed translation.
            let src_table = doc.trans_src.entry(options.lang.clone()).or_default();
            for id in committed {
                if let Some(fingerprint) = fingerprint_by_id.get(&id) {
                    src_table.insert(id.clone(), fingerprint.clone());
                }
                committed_sentences.insert(id);
            }
            on_page(doc);
        },
    )?;
    let missing_sentences: Vec<String> = pending
        .iter()
        .map(|sentence| sentence.id.clone())
        .filter(|id| !committed_sentences.contains(id))
        .collect();
    Ok(TranslateOutcome {
        translated_sentences: committed_sentences.len(),
        skipped_sentences: skipped,
        total_sentences: sentences.len(),
        missing_sentences,
        committed_sentences,
        alignment_drafts,
        rows_off_group_sentences,
        rows_page_retries,
    })
}

/// Translate a final-timeline sentence stream and scatter each completed page
/// back through the host callback. The engine owns paging, global context,
/// response validation and formatting; source document I/O remains in the host.
pub fn run_routed_translate(
    sentences: &[RoutedSentence],
    llm: &mut dyn LlmJson,
    options: &RoutedTranslateOptions,
    on_page: &mut dyn FnMut(&[RoutedTranslation]),
    sleep: &mut dyn FnMut(f64),
) -> Result<TranslateOutcome, LlmError> {
    run_routed_translate_with_artifacts(sentences, llm, options, on_page, &mut |_| {}, sleep)
}

/// Same as [`run_routed_translate`], and it also hands the per-page attempts to the host to persist (`ai/translate/<lang>/vNNN/`, §4/§11).
pub fn run_routed_translate_with_artifacts(
    sentences: &[RoutedSentence],
    llm: &mut dyn LlmJson,
    options: &RoutedTranslateOptions,
    on_page: &mut dyn FnMut(&[RoutedTranslation]),
    on_attempt: &mut dyn FnMut(&TranslatePageAttempt<'_>),
    sleep: &mut dyn FnMut(f64),
) -> Result<TranslateOutcome, LlmError> {
    let pending: Vec<&RoutedSentence> = sentences
        .iter()
        .filter(|sentence| {
            let key = (sentence.src_id.clone(), sentence.sentence_id.clone());
            options
                .sentences
                .as_ref()
                .is_none_or(|filter| filter.contains(&key))
                && (options.force
                    || options.sentences.is_some()
                    || sentence.translation.is_none()
                    || sentence.stamped_fingerprint.as_deref()
                        != Some(sentence.src_fingerprint.as_str()))
        })
        .collect();
    let skipped = sentences.len() - pending.len();
    let source_words: Vec<usize> = pending
        .iter()
        .map(|sentence| crate::atomize::word_count(&sentence.source_text))
        .collect();
    let mut pages: Vec<Vec<&RoutedSentence>> = Vec::new();
    let mut cursor = 0_usize;
    for size in translate_page_sizes(&source_words, options.page_budget) {
        pages.push(pending[cursor..cursor + size].to_vec());
        cursor += size;
    }

    let mut source_languages = sentences
        .iter()
        .map(|sentence| sentence.source_lang.as_str())
        .collect::<BTreeSet<_>>()
        .into_iter()
        .collect::<Vec<_>>();
    source_languages.sort_unstable();
    let source_language = source_languages.join(", ");
    let system = translate_system_prompt(
        if source_language.is_empty() {
            "und"
        } else {
            &source_language
        },
        &options.lang,
        options.analysis.as_ref(),
        options.brief.as_ref(),
        options.tone,
        options.instructions.as_deref(),
        &sentences
            .iter()
            .map(|sentence| sentence.source_text.as_str())
            .collect::<Vec<_>>()
            .join("\n"),
        TRANSLATE_FILE_PROMPT_BODY,
    );

    run_routed_translate_file(
        sentences, llm, options, &pages, system, on_page, on_attempt, sleep,
    )
    .map(|()| TranslateOutcome {
        translated_sentences: pending.len(),
        skipped_sentences: skipped,
        total_sentences: sentences.len(),
        missing_sentences: Vec::new(),
        // The truth on the routed (final timeline) path is scattered across several source projects. There is no single doc to attach provenance to, so the §11.3 state file does not cover this path.
        committed_sentences: BTreeSet::new(),
        alignment_drafts: FusionDrafts::new(),
        rows_off_group_sentences: 0,
        rows_page_retries: 0,
    })
}

/// File-contract branch of the routed path. Paragraphs are bounded by `src_id`. The final timeline has no natural doc paragraphs, so consecutive sentences from the same source segment are the closest context unit.
#[allow(clippy::too_many_arguments)]
fn run_routed_translate_file(
    sentences: &[RoutedSentence],
    llm: &mut dyn LlmJson,
    options: &RoutedTranslateOptions,
    pages: &[Vec<&RoutedSentence>],
    mut system: String,
    on_page: &mut dyn FnMut(&[RoutedTranslation]),
    on_attempt: &mut dyn FnMut(&TranslatePageAttempt<'_>),
    sleep: &mut dyn FnMut(f64),
) -> Result<(), LlmError> {
    if !options.chapter_titles.is_empty() {
        system.push_str(&format!(
            "\n\nChapters (document context only; never translate them): {}",
            options.chapter_titles.join(" · ")
        ));
    }
    let position = sentences
        .iter()
        .enumerate()
        .map(|(index, sentence)| (sentence.route_id.as_str(), index))
        .collect::<BTreeMap<_, _>>();
    let by_route = sentences
        .iter()
        .map(|sentence| (sentence.route_id.as_str(), sentence))
        .collect::<BTreeMap<_, _>>();

    let mut file_pages = Vec::with_capacity(pages.len());
    for (index, page) in pages.iter().enumerate() {
        let (Some(first), Some(last)) = (page.first(), page.last()) else {
            continue;
        };
        let editable_ids = page
            .iter()
            .map(|sentence| sentence.route_id.as_str())
            .collect::<BTreeSet<_>>();
        let span = position[first.route_id.as_str()]..=position[last.route_id.as_str()];
        let mut lines = Vec::new();
        for sentence in &sentences[span] {
            let editable = editable_ids.contains(sentence.route_id.as_str());
            if !editable && sentence.translation.is_none() {
                continue;
            }
            lines.push(FileLine {
                id: sentence.route_id.clone(),
                source: sentence.source_text.clone(),
                section_id: format!("p-{}", sentence.src_id),
                speaker: None,
                required_targets: if editable {
                    required_targets(&sentence.source_text, options.brief.as_ref())
                } else {
                    Vec::new()
                },
                source_id: Some(sentence.src_id.clone()),
                sentence_id: Some(sentence.sentence_id.clone()),
                editable,
                existing_translation: (!editable).then(|| sentence.translation.clone()).flatten(),
                budget: editable
                    .then(|| reading_budget_duration(sentence.display_duration, &options.lang)),
                // The source words of the routed final timeline belong to several source documents, and there is currently no single doc that can generate stable bN boundaries. Keep the dedicated projected align path.
                alignment: None,
            });
        }
        file_pages.push(FilePage {
            id: format!("p{:03}", index + 1),
            lines,
        });
    }

    let source_languages = sentences
        .iter()
        .map(|sentence| sentence.source_lang.as_str())
        .collect::<BTreeSet<_>>()
        .into_iter()
        .collect::<Vec<_>>()
        .join(", ");
    let project_fingerprint = crate::fingerprint::fingerprint_strings(
        sentences
            .iter()
            .map(|sentence| sentence.src_fingerprint.as_str()),
    );
    let protected_terms = options
        .brief
        .as_ref()
        .map(DocumentBrief::protected_targets)
        .unwrap_or_default();
    run_translate_file_contract(
        llm,
        sleep,
        &system,
        if source_languages.is_empty() {
            "und"
        } else {
            &source_languages
        },
        &options.lang,
        &project_fingerprint,
        &file_pages,
        // The routed (final timeline) path does not run the fusion draft, so there are no missing rows to resend.
        FileCarrier::Html { rows: false },
        &mut 0,
        on_attempt,
        &mut |parsed| {
            let completed = parsed
                .translations
                .into_iter()
                .filter_map(|(route_id, text)| {
                    let sentence = by_route.get(route_id.as_str())?;
                    Some(RoutedTranslation {
                        src_id: sentence.src_id.clone(),
                        sentence_id: sentence.sentence_id.clone(),
                        text: if options.autocorrect {
                            format_translation_with_options(
                                &text,
                                &options.lang,
                                &protected_terms,
                                AutocorrectOptions::default(),
                            )
                        } else {
                            text
                        },
                        src_fingerprint: sentence.src_fingerprint.clone(),
                    })
                })
                .collect::<Vec<_>>();
            on_page(&completed);
        },
    )
}

// ---- file contract (file-v1) path ----------------------------------------------

/// Material from one page-level attempt, for the host to write to `ai/translate/<lang>/vNNN/` (§4/§11).
///
/// The shape is shared with polish via [`crate::filepipe::PageAttempt`]. Here, `accepted` means `page_rejected == false`.
pub type TranslatePageAttempt<'a> = crate::filepipe::PageAttempt<'a>;

/// One sentence's rendering projection under the file contract. It hides the difference between the two data sources, doc and routed.
#[derive(Debug, Clone)]
struct FileLine {
    id: String,
    source: String,
    section_id: String,
    speaker: Option<String>,
    required_targets: Vec<String>,
    source_id: Option<String>,
    sentence_id: Option<String>,
    /// `false` means a §7.6 frozen sentence. It is kept only to preserve paragraph context and is not included in `translations`.
    editable: bool,
    existing_translation: Option<String>,
    /// Reading budget (same source as [`reading_budget`]), written into `data-budget`.
    ///
    /// As with `required_targets`, only editable sentences get this. Frozen sentences must be copied verbatim. Attaching a budget to them would only induce the model to "optimize" translations that should not change.
    budget: Option<usize>,
    alignment: Option<FusionLineInfo>,
}

/// Rendering projection of one page.
#[derive(Debug, Clone)]
struct FilePage {
    id: String,
    lines: Vec<FileLine>,
}

/// Assembles the row projections into a [`TranslatePage`].
///
/// Paragraphs are merged **by id**, not by grouping adjacent ones. The global residual wave repacks sentences from different pages, so a cross-page natural paragraph would otherwise show up as two paragraphs with the same id. Rendered into the text, that is `duplicate-id`, and it rejects the page outright.
fn build_translate_page(
    source_lang: &str,
    target_lang: &str,
    project_fingerprint: &str,
    lines: &[FileLine],
    context_before: Option<String>,
    context_after: Option<String>,
) -> TranslatePage {
    let mut page = TranslatePage {
        source_lang: source_lang.to_owned(),
        target_lang: target_lang.to_owned(),
        project_fingerprint: project_fingerprint.to_owned(),
        context_before,
        context_after,
        sections: Vec::new(),
    };
    let mut seen_sentences: BTreeSet<&str> = BTreeSet::new();
    for line in lines {
        if !seen_sentences.insert(line.id.as_str()) {
            continue;
        }
        let sentence = TranslateSentence {
            id: line.id.clone(),
            source: line.source.clone(),
            editable: line.editable,
            existing_translation: line.existing_translation.clone(),
            required_targets: line.required_targets.clone(),
            source_id: line.source_id.clone(),
            sentence_id: line.sentence_id.clone(),
            budget: line.budget,
            alignment: line.alignment.as_ref().map(|info| TranslateAlignmentInput {
                source_words: info.source_words.clone(),
                source_glue: info.source_glue.clone(),
                needs_split: info.needs_split,
                groups: info.groups.clone(),
            }),
        };
        match page
            .sections
            .iter_mut()
            .find(|section| section.id == line.section_id)
        {
            Some(section) => section.sentences.push(sentence),
            None => page.sections.push(TranslateSection {
                id: line.section_id.clone(),
                speaker: line.speaker.clone(),
                sentences: vec![sentence],
            }),
        }
    }
    page
}

/// Carrier for a translation page: HTML (`file-v1`, which may carry the fusion draft channel) or line text (`lines/1`).
#[derive(Debug, Clone, Copy)]
enum FileCarrier {
    Html {
        /// `--align-fusion rows`: the row-partition draft channel.
        rows: bool,
    },
    /// `--align-fusion lines`: the `row=` and `≥k` hints are given according to this set of thresholds.
    Lines(TransParams),
}

impl FileCarrier {
    /// [`LlmRequest::kind`]: the two carriers are two kinds at the execution layer. Carrier format, entry counting and reuse lint are all dispatched by kind.
    fn kind(self) -> &'static str {
        match self {
            Self::Html { .. } => "translate",
            Self::Lines(_) => "translate-lines",
        }
    }

    fn rows(self) -> bool {
        matches!(self, Self::Html { rows: true })
    }

    /// Contract section of the system prompt (carrier description plus quality rules).
    fn prompt_body(self) -> &'static str {
        match self {
            Self::Html { .. } => TRANSLATE_FILE_PROMPT_BODY,
            Self::Lines(_) => TRANSLATE_LINES_PROMPT_BODY,
        }
    }

    /// Sampling temperature. The line-text carrier uses the setting chosen from measured comparisons (0.2).
    fn temperature(self) -> f32 {
        match self {
            Self::Html { .. } => 0.3,
            Self::Lines(_) => 0.2,
        }
    }

    fn render(self, page: &TranslatePage) -> String {
        match self {
            Self::Html { .. } => render_translate_page(page),
            Self::Lines(params) => lines_translation::render_with_params(page, &params),
        }
    }

    /// Parses one answer. Both carriers go through their own unique parser and content quality gate.
    fn parse(self, page: &TranslatePage, rendered: &str, raw: &str) -> TranslateParsed {
        match self {
            Self::Html { .. } => {
                let mut parsed = parse_translate_page(page, Some(rendered), raw);
                crate::filepipe::translate_html::validate_translation_quality(page, &mut parsed);
                parsed
            }
            Self::Lines(params) => {
                lines_translation::parse_with_params(page, rendered, raw, &params).translation
            }
        }
    }
}

/// Renders one page and also keeps "the text that was actually sent". The §16 size guardrail uses it as the baseline.
fn render_file_page(
    source_lang: &str,
    target_lang: &str,
    project_fingerprint: &str,
    lines: &[FileLine],
    context_before: Option<String>,
    context_after: Option<String>,
    carrier: FileCarrier,
) -> (TranslatePage, String) {
    let page = build_translate_page(
        source_lang,
        target_lang,
        project_fingerprint,
        lines,
        context_before,
        context_after,
    );
    let rendered = carrier.render(&page);
    (page, rendered)
}

fn summarize_problems(diagnostics: &Diagnostics) -> String {
    if diagnostics.problems.is_empty() {
        return "unspecified".to_owned();
    }
    // In a targeted retranslation, a page carries a large amount of read-only context. If a weak model rewrites every frozen sentence, the parser reports frozen-modified one sentence at a time. Stuffing hundreds of identically worded lines back into retryReason would both crowd out the real repair instruction and make the next call keep editing according to the noise. Keep first-seen order and aggregate identical code plus detail into counts. Fine-grained diagnostics remain fully preserved in the attempt artifacts.
    let mut groups: Vec<(crate::filepipe::ProblemCode, &str, usize)> = Vec::new();
    for problem in &diagnostics.problems {
        if let Some((_, _, count)) = groups
            .iter_mut()
            .find(|(code, detail, _)| *code == problem.code && *detail == problem.detail)
        {
            *count += 1;
        } else {
            groups.push((problem.code, problem.detail.as_str(), 1));
        }
    }
    groups
        .into_iter()
        .map(|(code, detail, count)| {
            if count == 1 {
                format!("{code}: {detail}")
            } else {
                format!("{code}: {detail} (repeated {count} times)")
            }
        })
        .collect::<Vec<_>>()
        .join("; ")
}

/// Runs one wave. The skeleton [`complete_batch_retry_report`] is **not changed at all**. The injected validate closure decides `page_rejected` (whole-page retry). The on_ready callback collects `retry_ids` (sentence-level repair is left to the next wave).
///
/// Returns `(sentence ids per page that need the next wave, page indices whose whole-page attempts were exhausted)`. Page-level exhaustion is **no longer** raised upward (retry policy redesign §2.3). The caller halves the set according to [`RetryPolicy::SPLIT_THEN`]. Half-pages that still fail put their editable sentences into the make-up wave, and final misses are reported as `translation-partial`. Terminal and Cancelled are still raised immediately.
#[allow(clippy::too_many_arguments)]
/// rows soft page retry: a page needs at least this many sentences that requested rows before it is worth resending the whole page to fill in missing rows.
const ROWS_RETRY_MIN_SENTENCES: usize = 3;
/// Missing-row ratio threshold (percent). Among sentences that requested rows, resend only if fewer than 30% got a qualifying row partition.
const ROWS_RETRY_MISSING_PERCENT: usize = 70;
/// Emphasis text attached to `retry_reason` on resend.
const ROWS_RETRY_REASON: &str = "Your previous answer for this page contained NO display rows: the sentences carrying data-align-groups came back as plain translations. Translate the page again and this time wrap EVERY such sentence's translation in <span data-src=\"a-b\"> display rows, exactly as the contract describes. Keep only the id attribute on each element.";

/// Whether this page gave up on rows entirely: at least [`ROWS_RETRY_MIN_SENTENCES`] sentences requested rows, and fewer than `100 - ROWS_RETRY_MISSING_PERCENT`% of them got a qualifying row partition.
///
/// Measured in round four of parity testing: the model occasionally returns a structurally complete, clean answer that keeps only the ids and gives no `<span data-src>` at all. That is not a bad draft but a **whole-page omission**, and one resend usually recovers it. The criterion is deliberately conservative: a few unmarked sentences do not count, since that is allowed anyway. Only whole-page omission is caught.
fn rows_page_gave_up(page: &TranslatePage, parsed: &TranslateParsed) -> bool {
    let requested: Vec<&str> = page
        .sections
        .iter()
        .flat_map(|section| section.sentences.iter())
        .filter(|sentence| sentence.editable)
        .filter(|sentence| {
            sentence
                .alignment
                .as_ref()
                .is_some_and(|alignment| !alignment.groups.is_empty())
        })
        .map(|sentence| sentence.id.as_str())
        .collect();
    if requested.len() < ROWS_RETRY_MIN_SENTENCES {
        return false;
    }
    let missing = requested
        .iter()
        .filter(|id| !parsed.alignments.get(**id).is_some_and(|draft| draft.rows))
        .count();
    missing * 100 >= requested.len() * ROWS_RETRY_MISSING_PERCENT
}

/// Records sentences on this page that were rejected for "not translated into the target language" (copied from the source, wrong language). Sentences that appear on this page have their old records cleared first. Then sentences still rejected for either of these two reasons this time are registered.
fn note_untranslated(
    untranslated: &mut BTreeSet<String>,
    page: &TranslatePage,
    parsed: &TranslateParsed,
) {
    for sentence in page.sections.iter().flat_map(|section| &section.sentences) {
        untranslated.remove(&sentence.id);
    }
    for problem in &parsed.diagnostics.problems {
        let ProblemScope::Sentence { id } = &problem.scope else {
            continue;
        };
        if matches!(
            problem.code,
            ProblemCode::TranslationSourceCopy | ProblemCode::TargetLanguageMismatch
        ) && parsed.retry_ids.contains(id)
        {
            untranslated.insert(id.clone());
        }
    }
}

/// Re-ask reason for the make-up wave. When some sentence on this page last came back as something other than a target-language translation, the re-ask names the target language. Measured on a whole page with no brief: resending the same request verbatim gets the same copy-through, so the re-ask must say what went wrong last time. Make-up for other reasons (drifted rows, missing rows) still carries no reason, as before.
fn untranslated_retry_reason(
    target_lang: &str,
    lines: &[FileLine],
    untranslated: &BTreeSet<String>,
) -> Option<String> {
    let count = lines
        .iter()
        .filter(|line| line.editable && untranslated.contains(&line.id))
        .count();
    (count > 0).then(|| {
        format!(
            "{count} of the {total} sentences on this page were answered before with text that is not a translation into \"{target_lang}\": the source text was copied, or the answer was written in another language. Write every translation in \"{target_lang}\". Only names, code, and terms that \"{target_lang}\" itself writes the same way stay as they are.",
            total = lines.len(),
        )
    })
}

#[allow(clippy::too_many_arguments)]
fn run_file_wave(
    llm: &mut dyn LlmJson,
    sleep: &mut dyn FnMut(f64),
    system: &str,
    page_ids: &[String],
    prepared: &[(TranslatePage, String)],
    // Each page carries its own re-ask reasons for the make-up wave. An empty slice means none are attached.
    reasons: &[Option<String>],
    attempts: u32,
    attempt_base: u32,
    carrier: FileCarrier,
    rows_page_retries: &mut usize,
    untranslated: &mut BTreeSet<String>,
    on_attempt: &mut dyn FnMut(&TranslatePageAttempt<'_>),
    commit: &mut dyn FnMut(TranslateParsed),
) -> Result<(Vec<Vec<String>>, Vec<usize>), LlmError> {
    let rows = carrier.rows();
    let requests = prepared
        .iter()
        .enumerate()
        .map(|(index, (_, rendered))| LlmRequest {
            kind: carrier.kind(),
            system: system.to_owned(),
            user: rendered.clone(),
            temperature: carrier.temperature(),
            attempt: 1,
            retry_reason: reasons.get(index).cloned().flatten(),
        })
        .collect::<Vec<_>>();
    let mut retry_by_page = vec![Vec::new(); prepared.len()];
    let mut tries = vec![0_u32; prepared.len()];
    // rows soft page retry: the page indices where the whole page is missing rows. Filled in only in rows mode.
    let mut gave_up_rows = vec![false; prepared.len()];
    let outcome = complete_batch_retry_report(
        llm,
        &requests,
        attempts,
        sleep,
        &mut |index, raw| {
            tries[index] += 1;
            let (page, rendered) = &prepared[index];
            let parsed = carrier.parse(page, rendered, raw);
            on_attempt(&TranslatePageAttempt {
                page_id: &page_ids[index],
                attempt: attempt_base + tries[index],
                input: rendered,
                output: raw,
                problems: &parsed.diagnostics.problems,
                accepted: !parsed.page_rejected,
            });
            if parsed.page_rejected {
                // The criterion is page_rejected, not has_problems(). Paragraph-move and unknown-id on editable sentences occur in results where everything else was accepted, and resending on has_problems() would spin forever.
                return Err(LlmError::Malformed(format!(
                    "translate page {} rejected — {}",
                    page_ids[index],
                    summarize_problems(&parsed.diagnostics)
                )));
            }
            Ok(parsed)
        },
        &mut |_, error| error.to_string(),
        &mut |index, parsed: TranslateParsed| {
            retry_by_page[index] = parsed.retry_ids.clone();
            gave_up_rows[index] = rows && rows_page_gave_up(&prepared[index].0, &parsed);
            note_untranslated(untranslated, &prepared[index].0, &parsed);
            commit(parsed);
        },
    )?;

    // rows soft page retry (bounded, at most once per page): when the whole page comes back as plain translation, resend the page verbatim, with retry_reason naming "last time there were no rows at all". This is a **soft** retry. It does not go through the failure ledger of `complete_batch_retry_report` and does not consume the page-level error retry budget. A transport failure, or a second rejection, simply abandons the retry, and the first translation is kept as it was. The principle that a bad draft does not reject the translation applies equally to a whole page missing rows. When the second answer is usable, both the translation and the rows follow it. `commit` overwrites the same batch of ids.
    let retry_pages: Vec<usize> = (0..prepared.len())
        .filter(|&index| gave_up_rows[index])
        .collect();
    if !retry_pages.is_empty() {
        let requests = retry_pages
            .iter()
            .map(|&index| LlmRequest {
                kind: carrier.kind(),
                system: system.to_owned(),
                user: prepared[index].1.clone(),
                temperature: carrier.temperature(),
                attempt: attempt_base + tries[index] + 1,
                retry_reason: Some(ROWS_RETRY_REASON.to_owned()),
            })
            .collect::<Vec<_>>();
        let mut second: Vec<Option<TranslateParsed>> =
            (0..retry_pages.len()).map(|_| None).collect();
        llm.complete_batch_with(&requests, &mut |slot, result| {
            let (Some(&index), Ok(raw)) = (retry_pages.get(slot), result.as_ref()) else {
                return;
            };
            let (page, rendered) = &prepared[index];
            let parsed = carrier.parse(page, rendered, raw);
            on_attempt(&TranslatePageAttempt {
                page_id: &page_ids[index],
                attempt: attempt_base + tries[index] + 1,
                input: rendered,
                output: raw,
                problems: &parsed.diagnostics.problems,
                accepted: !parsed.page_rejected,
            });
            if !parsed.page_rejected {
                second[slot] = Some(parsed);
            }
        });
        for (slot, parsed) in second.into_iter().enumerate() {
            let (Some(parsed), Some(&index)) = (parsed, retry_pages.get(slot)) else {
                continue;
            };
            *rows_page_retries += 1;
            retry_by_page[index] = parsed.retry_ids.clone();
            note_untranslated(untranslated, &prepared[index].0, &parsed);
            commit(parsed);
        }
    }
    // Leave remaining sentences blank (check reports translation-partial) rather than ever writing a fake translation.
    Ok((
        retry_by_page,
        outcome.failed.into_iter().map(|(index, _)| index).collect(),
    ))
}

/// File-contract three waves (§7.5 sentence-level ledger: each sentence gets 3 attempts in total).
///
/// - Wave 1: all pages. Whole-page attempts run up to [`RetryPolicy::MAX_PAGE_ATTEMPTS`] times (this also absorbs transport errors). Pages whose attempts are exhausted are split in half into two sentence sets, each sent once (an R3 rejection narrows the set). Half-pages that still fail put their editable sentences into the make-up wave, and nothing is a hard error any more.
/// - Wave 2: each page sends its own `retry_ids` as a separate page once more.
/// - Wave 3: the residual sentences across pages are merged into one page and sent once more.
///
/// All three waves call the same unchanged skeleton.
#[allow(clippy::too_many_arguments)]
fn run_translate_file_contract(
    llm: &mut dyn LlmJson,
    sleep: &mut dyn FnMut(f64),
    system: &str,
    source_lang: &str,
    target_lang: &str,
    project_fingerprint: &str,
    pages: &[FilePage],
    carrier: FileCarrier,
    rows_page_retries: &mut usize,
    on_attempt: &mut dyn FnMut(&TranslatePageAttempt<'_>),
    commit: &mut dyn FnMut(TranslateParsed),
) -> Result<(), LlmError> {
    if pages.is_empty() {
        return Ok(());
    }
    let page_ids = pages.iter().map(|page| page.id.clone()).collect::<Vec<_>>();
    let prepared = pages
        .iter()
        .enumerate()
        .map(|(index, page)| {
            // Static neighbor-page context: source text only. There is no serial data dependency between pages.
            let before = index
                .checked_sub(1)
                .and_then(|previous| pages[previous].lines.last())
                .map(|line| line.source.clone());
            let after = pages
                .get(index + 1)
                .and_then(|next| next.lines.first())
                .map(|line| line.source.clone());
            render_file_page(
                source_lang,
                target_lang,
                project_fingerprint,
                &page.lines,
                before,
                after,
                carrier,
            )
        })
        .collect::<Vec<_>>();

    let mut untranslated = BTreeSet::new();
    let (mut wave_one, failed_pages) = run_file_wave(
        llm,
        sleep,
        system,
        &page_ids,
        &prepared,
        &[],
        RetryPolicy::MAX_PAGE_ATTEMPTS,
        0,
        carrier,
        rows_page_retries,
        &mut untranslated,
        on_attempt,
        commit,
    )?;

    // R3 rejection narrows: pages whose whole-page attempts are exhausted are split in half into two sentence sets, each sent once. Half-pages that still fail put their editable sentences into wave 2 or 3, and final misses are reported as `translation-partial`.
    if RetryPolicy::SPLIT_THEN && !failed_pages.is_empty() {
        let mut half_ids = Vec::new();
        let mut half_prepared = Vec::new();
        // (original page index, this half-page's editable ids)
        let mut half_origin: Vec<(usize, Vec<String>)> = Vec::new();
        for &index in &failed_pages {
            let lines = &pages[index].lines;
            let mid = lines.len() / 2;
            if mid == 0 {
                // A single-sentence page cannot be split, so all of its editable sentences go directly into the make-up wave.
                wave_one[index].extend(
                    lines
                        .iter()
                        .filter(|line| line.editable)
                        .map(|line| line.id.clone()),
                );
                continue;
            }
            for (slot, half) in [&lines[..mid], &lines[mid..]].into_iter().enumerate() {
                half_ids.push(format!("{}-h{}", page_ids[index], slot + 1));
                half_prepared.push(render_file_page(
                    source_lang,
                    target_lang,
                    project_fingerprint,
                    half,
                    None,
                    None,
                    carrier,
                ));
                half_origin.push((
                    index,
                    half.iter()
                        .filter(|line| line.editable)
                        .map(|line| line.id.clone())
                        .collect(),
                ));
            }
        }
        if !half_prepared.is_empty() {
            let (half_retry, half_failed) = run_file_wave(
                llm,
                sleep,
                system,
                &half_ids,
                &half_prepared,
                &[],
                1,
                RetryPolicy::MAX_PAGE_ATTEMPTS,
                carrier,
                rows_page_retries,
                &mut untranslated,
                on_attempt,
                commit,
            )?;
            for (slot, ids) in half_retry.iter().enumerate() {
                wave_one[half_origin[slot].0].extend(ids.iter().cloned());
            }
            for slot in half_failed {
                let (page, ids) = &half_origin[slot];
                wave_one[*page].extend(ids.iter().cloned());
            }
        }
    }

    // Wave 2: per-page repair.
    let mut repair_ids = Vec::new();
    let mut repair_prepared = Vec::new();
    let mut repair_origin = Vec::new();
    let mut repair_reasons = Vec::new();
    for (index, ids) in wave_one.iter().enumerate() {
        let wanted = ids.iter().map(String::as_str).collect::<BTreeSet<_>>();
        let lines = pages[index]
            .lines
            .iter()
            .filter(|line| line.editable && wanted.contains(line.id.as_str()))
            .cloned()
            .collect::<Vec<_>>();
        if lines.is_empty() {
            continue;
        }
        repair_reasons.push(untranslated_retry_reason(
            target_lang,
            &lines,
            &untranslated,
        ));
        repair_prepared.push(render_file_page(
            source_lang,
            target_lang,
            project_fingerprint,
            &lines,
            None,
            None,
            carrier,
        ));
        repair_ids.push(page_ids[index].clone());
        repair_origin.push(index);
    }
    if repair_prepared.is_empty() {
        return Ok(());
    }
    let (mut wave_two, wave_two_failed) = run_file_wave(
        llm,
        sleep,
        system,
        &repair_ids,
        &repair_prepared,
        &repair_reasons,
        1,
        MAX_RETRIES,
        carrier,
        rows_page_retries,
        &mut untranslated,
        on_attempt,
        commit,
    )?;
    // For a page that was rejected as a whole in wave 2, all of its pending sentences go into wave 3. Otherwise they would fall straight to `translation-partial` without their last chance.
    for slot in wave_two_failed {
        let index = repair_origin[slot];
        let wanted = wave_one[index].iter().cloned().collect::<BTreeSet<_>>();
        wave_two[slot] = wanted.into_iter().collect();
    }

    // Wave 3: merge the cross-page residuals into one page.
    let mut residual = Vec::new();
    for (slot, ids) in wave_two.iter().enumerate() {
        let wanted = ids.iter().map(String::as_str).collect::<BTreeSet<_>>();
        residual.extend(
            pages[repair_origin[slot]]
                .lines
                .iter()
                .filter(|line| line.editable && wanted.contains(line.id.as_str()))
                .cloned(),
        );
    }
    if residual.is_empty() {
        return Ok(());
    }
    let residual_reasons = [untranslated_retry_reason(
        target_lang,
        &residual,
        &untranslated,
    )];
    let residual_prepared = vec![render_file_page(
        source_lang,
        target_lang,
        project_fingerprint,
        &residual,
        None,
        None,
        carrier,
    )];
    run_file_wave(
        llm,
        sleep,
        system,
        &["residual".to_owned()],
        &residual_prepared,
        &residual_reasons,
        1,
        MAX_RETRIES + 1,
        carrier,
        rows_page_retries,
        &mut untranslated,
        on_attempt,
        commit,
    )?;
    Ok(())
}

/// Minimum source word count for attaching fusion attributes in rows mode. Shorter sentences fit on one row anyway, so the row-partition hint would only cost context.
const FUSED_ROWS_MIN_WORDS: usize = 8;

/// Row projection on the doc path: sentences are grouped into paragraphs (`derive_paras`). Sentences awaiting translation become editable. Sentences that already have translations in the gaps within the page become §7.6 frozen sentences, which preserve paragraph context but may not be rewritten.
///
/// Frozen sentences fill only the gaps **between the first and last sentence of this page**. They do not extend across pages, so the page count and wave alignment do not change.
fn project_file_pages(
    doc: &TranscriptDoc,
    cues: &[crate::cue::Cue],
    sentences: &[Sentence],
    lang: &str,
    pages: &[&[PreparedLine<'_>]],
    prepared: &[PreparedLine<'_>],
    fused_alignment: bool,
    carrier: FileCarrier,
) -> Vec<FilePage> {
    let fused_rows = carrier.rows();
    let fused_lines = matches!(carrier, FileCarrier::Lines(_));
    let paras = derive_paras(doc, cues);
    let mut para_of_cue: BTreeMap<usize, usize> = BTreeMap::new();
    for (index, para) in paras.iter().enumerate() {
        for cue_index in &para.cue_indices {
            para_of_cue.insert(*cue_index, index);
        }
    }
    let position = sentences
        .iter()
        .enumerate()
        .map(|(index, sentence)| (sentence.id.as_str(), index))
        .collect::<BTreeMap<_, _>>();
    let targets_of = prepared
        .iter()
        .map(|line| (line.sentence.id.as_str(), &line.required_targets))
        .collect::<BTreeMap<_, _>>();
    let existing = doc.trans.get(lang).cloned().unwrap_or_default();

    let section_of = |sentence: &Sentence| -> (String, Option<String>) {
        match sentence
            .cue_indices
            .first()
            .and_then(|cue| para_of_cue.get(cue))
        {
            Some(&index) => (
                paras[index].id.clone(),
                (!paras[index].sp.is_empty()).then(|| paras[index].sp.clone()),
            ),
            // If paragraphs cannot be derived (should not happen in theory), fall back to one sentence per paragraph, so section ids never collide.
            None => (format!("p-{}", sentence.id.trim_start_matches("s-")), None),
        }
    };

    let mut file_pages = Vec::with_capacity(pages.len());
    for (index, page) in pages.iter().enumerate() {
        let (Some(first), Some(last)) = (page.first(), page.last()) else {
            continue;
        };
        let editable_ids = page
            .iter()
            .map(|line| line.sentence.id.as_str())
            .collect::<BTreeSet<_>>();
        let span = position[first.sentence.id.as_str()]..=position[last.sentence.id.as_str()];
        let mut lines = Vec::new();
        for sentence in &sentences[span] {
            let editable = editable_ids.contains(sentence.id.as_str());
            let translation = existing.get(&sentence.id);
            if !editable && translation.is_none() {
                continue;
            }
            let (section_id, speaker) = section_of(sentence);
            lines.push(FileLine {
                id: sentence.id.clone(),
                source: sentence.source_text.clone(),
                section_id,
                speaker,
                required_targets: if editable {
                    targets_of
                        .get(sentence.id.as_str())
                        .map(|targets| (*targets).clone())
                        .unwrap_or_default()
                } else {
                    Vec::new()
                },
                source_id: None,
                sentence_id: None,
                editable,
                existing_translation: (!editable).then(|| translation.cloned()).flatten(),
                budget: editable.then(|| reading_budget(doc, sentence, lang)),
                alignment: if editable && fused_alignment {
                    let info = fusion_line_info(doc, cues, sentence, fused_rows);
                    // Regular fusion serves only the sentences that the deterministic criterion already requires to be split. Short sentences still get backstopped by dedicated align if their translation occasionally exceeds fit. Not giving every short sentence the source text and per-boundary hints again significantly reduces the translate single-page context.
                    //
                    // Rows mode relaxes the criterion to "≥ FUSED_ROWS_MIN_WORDS words". Row partitioning is a pass-through path that needs no align call, so covering one more sentence means dispatching one fewer align call. It is also cheaper in hints than per-chunk drafts, at one groups string per sentence.
                    //
                    // Every sentence in the lines carrier is marked with its first and last source-word references, so the source word table is the basis for locating them. The carrier does not echo the word table. It places only segment markers between long sentences, without paying the cost of per-word ordinals. So editable sentences always carry it.
                    let covered = if fused_lines {
                        true
                    } else if fused_rows {
                        info.needs_split || info.source_words.len() >= FUSED_ROWS_MIN_WORDS
                    } else {
                        info.needs_split
                    };
                    covered.then_some(info)
                } else {
                    None
                },
            });
        }
        file_pages.push(FilePage {
            id: format!("p{:03}", index + 1),
            lines,
        });
    }
    file_pages
}

// ---- request construction -------------------------------------------------------------

struct PreparedLine<'a> {
    sentence: &'a Sentence,
    required_targets: Vec<String>,
}

impl<'a> PreparedLine<'a> {
    fn new(sentence: &'a Sentence, brief: Option<&DocumentBrief>) -> Self {
        Self {
            sentence,
            required_targets: required_targets(&sentence.source_text, brief),
        }
    }
}

/// Single-page criterion (P2-1, single page without brief): the sentence count does not factor into pagination. Only the source word count of the whole text does. Same counting basis as [`crate::paging::balanced_page_sizes`] (budget plus slack). A document judged to be a single page is necessarily one page in actual pagination as well.
pub fn fits_single_translate_page(
    sentence_count: usize,
    total_words: usize,
    page_budget: usize,
) -> bool {
    sentence_count > 0 && crate::paging::page_count_for_total(total_words, page_budget) == 1
}

fn translate_page_sizes(source_words: &[usize], page_budget: usize) -> Vec<usize> {
    crate::paging::balanced_page_sizes(source_words, page_budget)
}

/// CPS reading budget: `maxChars = max(1, floor(display duration × cps))`. Display duration = the last word's t1 minus the first word's t0 of the sentence. cps by target language: zh → 9, other CJK (ja, ko) → 13, default → 21. Same source as the reading units per second in [`crate::split::target_reading_cps`]. The counting basis is the reading units of [`crate::split::target_cps_chars`]: ordinary commas and periods are free, and under a CJK target, Latin counts as about half a character. It is **not** the bare count of non-whitespace characters. Both prompt texts used to declare "characters excluding whitespace". That made for an unsatisfiable budget with short sentences plus mandatory Latin locked terms (rt). For example, "description" is 11 characters against a budget of 11. The worker could only exceed the budget or cut meaning.
fn reading_budget(doc: &TranscriptDoc, sentence: &Sentence, target_lang: &str) -> usize {
    let first = &doc.words[*sentence.word_indices.first().expect("sentence non-empty")];
    let last = &doc.words[*sentence.word_indices.last().expect("sentence non-empty")];
    let duration = (last.t1 - first.t0).max(0.0);
    reading_budget_duration(duration, target_lang)
}

fn reading_budget_duration(duration: f64, target_lang: &str) -> usize {
    let cps = match primary_subtag(target_lang).as_str() {
        "zh" => 9.0,
        "ja" | "ko" => 13.0,
        _ => 21.0,
    };
    ((duration * cps).floor() as usize).max(1)
}

// The system prompt base is taken from voice-ink `TranslatePrompts.translateSystemPrompt`. Both analysis and each language's DocumentBrief may be absent. Block-level assembly guarantees that when the brief fails or `--no-brief` is used, it degrades stably to the source-language analysis, and then to the base contract.
// ccut addition: a preference for driving by sequential clauses (sequential translation in the style of simultaneous interpretation). Among several equally natural word orders, prefer the one closest to the source clause order, which reduces cross-ordering in display alignment at the source. See the three-question subtitle alignment scheme.
/// Contract section of the file contract (`file-v1`).
///
/// The length channel: the legacy json version kept translation width in check with `maxChars` and each fused segment's per-row display limit. The early file version had neither, and measured display width ran more than 10% higher. So the contract states directly that the output is subtitles, and attaches the per-sentence budget to `data-budget`. The per-row display limit varies by target language (about 16 cells for CJK, about 42 characters for Latin scripts). The contract text describes only the **nature of the constraint**. The specific numbers are always carried by the carrier's `data-budget`.
const TRANSLATE_FILE_PROMPT_BODY: &str = r#"The user message is ONE HTML document: an <article> whose <section> elements are paragraphs and whose elements carrying an "id" attribute are the sentences to translate.

Respond with the SAME document structure and nothing else — no markdown fences, no prose, no explanation. Keep the <article> wrapper and every <section id>, and replace each sentence element's text content with its translation.

Rules:
- Ids are the only thing that locates a sentence. Reproduce every "id" byte-for-byte, exactly once. Never invent, drop, merge, split, or reorder ids, and never move a sentence into a different <section>.
- OMIT every other attribute from your answer. data-align-words, data-align-groups, data-align-needed, data-budget, data-rt, data-source-id, data-sid and data-translation are INPUT-ONLY instructions: nothing reads them back, so echoing them only makes your answer longer and slower. The ideal sentence element is exactly `<p id="s-g1.0">译文</p>`. (Copying them back is tolerated and never an error — but always prefer to leave them out.) Never translate or edit them either.
- An element with data-editable="false" is FROZEN: emit its data-translation value verbatim as that element's text content — you still drop the attributes themselves. Never retranslate it and never move it.
- data-rt, when present, is a JSON array of exact required target renderings for LOCKED glossary terms found in that sentence. Every string in it MUST appear verbatim in that sentence's translation. Do not inflect, respell, re-space, translate, or omit it.
- HTML comments carry neighbouring context for continuity only — never translate them and never reproduce them.
- Understand the complete sentence, then translate faithfully and naturally in the TARGET language's own idiomatic word order. The later alignment phase maps that natural sentence to timing; never produce stilted phrasing just to follow the source clause order.
- Among equally natural renderings, prefer the one whose clause order FOLLOWS the source clause order (simultaneous-interpretation style): subtitle rows are timed against the source speech, so a translation that unfolds in the same order yields rows whose meaning matches what is being heard. Reorder only when the target language genuinely requires it.
- The finished product is SUBTITLES, not prose: every sentence you write is later cut into narrow display rows (a row holds only a handful of display cells) that must be read while the speaker is still talking. Length is therefore part of correctness, not a matter of style — a translation that says the same thing in fewer characters is the better translation.
- data-budget, when present, restates that sentence's reading-speed budget in reading units, not raw characters: whitespace and ordinary commas and periods are free, and in CJK target languages a Latin letter or digit counts about half a unit — so a required data-rt term costs far less than its letter count. The whole translation should fit the budget. Prefer concise phrasing — cut filler, redundant connectives, restated subjects, and padding first, and choose the shorter of two equally faithful wordings.
- The budget never outranks meaning. Never remove essential meaning, negation, qualifications, numbers, names, tone, or register just to meet it: when a sentence genuinely needs the length, take the length.
- Preserve every explicit causal, contrastive, conditional, and result relation (for example because / but / if / therefore) and the content governed by it, even when that pushes the sentence past data-budget. The alignment phase can split a complete translation but cannot recover an omitted clause.
- Output exactly ONE rendering per sentence — never slash-separated or parenthesized alternatives. A slash is allowed only when it belongs to a term that is copied verbatim — a CLI command like /compact, whether it comes from the source text, a data-rt string, or a glossary target.
- Keep terminology consistent across the whole document.
- Follow the target language's own spacing conventions: no spaces between Chinese or Japanese characters; Korean separates words with spaces and attaches a particle or counter to the word or numeral before it.
- Do not insert newline characters or segmentation marks inside a sentence. When fusion metadata is present, the only markup allowed inside a sentence element is the `<span data-src>` annotation described below; the sentence text remains one complete translation."#;

/// Contract section of the line-text carrier (`lines/1`, `--align-fusion lines`). Its quality rules are the same set as [`TRANSLATE_FILE_PROMPT_BODY`]. Budgets and locked terms are carried by the `≤n` and `! N required=` lines. The carrier syntax is appended separately at the end of the system prompt ([`lines_translation::PROTOCOL`]).
const TRANSLATE_LINES_PROMPT_BODY: &str = r#"The user message is ONE plain-text page in the lines/1 format described at the end of these instructions: each numbered line is one sentence to translate, in document order.

Rules:
- Understand the complete sentence, then translate faithfully and naturally in the TARGET language's own idiomatic word order. The later alignment phase maps that natural sentence to timing; never produce stilted phrasing just to follow the source clause order.
- Among equally natural renderings, prefer the one whose clause order FOLLOWS the source clause order (simultaneous-interpretation style): subtitle rows are timed against the source speech, so a translation that unfolds in the same order yields rows whose meaning matches what is being heard. Reorder only when the target language genuinely requires it.
- The finished product is SUBTITLES, not prose: every sentence you write is later cut into narrow display rows (a row holds only a handful of display cells) that must be read while the speaker is still talking. Length is therefore part of correctness, not a matter of style — a translation that says the same thing in fewer characters is the better translation.
- `≤n` before a sentence restates that sentence's reading-speed budget in reading units, not raw characters: whitespace and ordinary commas and periods are free, and in CJK target languages a Latin letter or digit counts about half a unit — so a required term costs far less than its letter count. The whole translation should fit the budget. Prefer concise phrasing — cut filler, redundant connectives, restated subjects, and padding first, and choose the shorter of two equally faithful wordings.
- The budget never outranks meaning. Never remove essential meaning, negation, qualifications, numbers, names, tone, or register just to meet it: when a sentence genuinely needs the length, take the length.
- Preserve every explicit causal, contrastive, conditional, and result relation (for example because / but / if / therefore) and the content governed by it, even when that pushes the sentence past the budget. The alignment phase can split a complete translation but cannot recover an omitted clause.
- A `! N required=[…]` line lists exact required target renderings for LOCKED glossary terms found in sentence N. Every string in it MUST appear verbatim in that sentence's translation. Do not inflect, respell, re-space, translate, or omit it.
- Output exactly ONE rendering per sentence — never slash-separated or parenthesized alternatives. A slash is allowed only when it belongs to a term that is copied verbatim — a CLI command like /compact, whether it comes from the source text, a required string, or a glossary target.
- Keep terminology consistent across the whole document.
- Follow the target language's own spacing conventions: no spaces between Chinese or Japanese characters; Korean separates words with spaces and attaches a particle or counter to the word or numeral before it.
- A sentence's translation stays on its own numbered line: no newline inside it, and the chunk markers described below are the only structure inside a line."#;

/// `file-v1` translation fusion contract (alignment block design §6.1). The translated text remains the only source of truth. `<span data-src>` is only a best-effort block-alignment draft channel. The align engine expands it into alignment edges and then passes it through exactly the same deterministic block merge and bilingual DP as dedicated `align-edges`.
fn fusion_file_prompt_section(params: &TransParams, rows: bool) -> String {
    if rows {
        return fusion_rows_prompt_section(params);
    }
    format!(
        r#"

Fused block alignment (optional draft channel): editable sentences that already need display splitting carry `data-align-words` (the source words, each prefixed with its 1-based ordinal like `[1]I [2]didn't [3]go`) and `data-align-needed`. Sentences without those attributes need only a translation. Read those attributes, then drop them from your answer — the `<span data-src>` annotation below is the only thing that must come back.
- First write the complete natural translation as the element text. Then, INSIDE that same `<p>`, wrap the translation in a sequence of `<span data-src="…">chunk</span>` elements: the span texts concatenated must reproduce the translation exactly (never add, drop, reorder, or rewrite a character; punctuation stays with the chunk it ends). Everything outside a span counts as an unattributed chunk.
- Chunk the translation into the SMALLEST natural semantic chunks (a clause, a phrase, a term — never below a word). For each chunk, `data-src` lists the ordinals of the source words it translates: whitespace or comma separated, ranges allowed (`4-7`, `1 2 3`, `1-3,9`), any order, non-contiguous ok, empty (`data-src=""`) for particles or connectives with no source word. Every ordinal may appear at most once in the sentence; unaligned source words are fine.
- Never reorder, merge, or split chunks to imitate the source order — the chunk order is the translation's own order; the ordinals record the correspondence, including crossings. Numbers, names, URLs, and glossary terms must sit in the chunk whose `data-src` contains their source ordinal.
- Aim the whole sentence at ≤{fit} display units per eventual row (prefer ≤{soft}, absolute {hard}), but never distort, shorten, or retranslate the sentence to make chunks smaller. A bad or missing annotation is silently discarded and never rejects the translation."#,
        fit = params.fit,
        soft = params.soft,
        hard = params.hard,
    )
}

/// **Row-partition** variant of the `file-v1` translation fusion contract (`--align-fusion rows`). The whole-sentence translation remains the only source of truth. `<span data-src>` is promoted from "semantic block draft" to "display row partition": each span is one subtitle row, `data-src` is a contiguous, increasing range of source word indices, and all ranges, joined end to end, cover `1..N`. Sentences of that shape are placed into blocks and pieces directly by the engine, with no further align call.
///
/// The carrier also carries `data-align-groups` (deterministic source-side grouping, plus the duration of each group), so that while splitting rows the model can also see how long each short passage lasts. That balances reading speed against layout.
fn fusion_rows_prompt_section(params: &TransParams) -> String {
    format!(
        r#"

Fused display rows (draft channel): editable sentences carry `data-align-words` (the source words, each prefixed with its 1-based ordinal like `[1]I [2]didn't [3]go`), `data-align-needed`, and `data-align-groups`. Sentences without those attributes need only a translation. Read those attributes, then drop them from your answer — the `<span data-src>` rows below are the only thing that must come back, and a sentence that carried `data-align-groups` and comes back WITHOUT rows is an incomplete answer.
- Every sentence carrying `data-align-groups` needs rows — all of them, from the first to the last element in the document. Do not annotate the first few and then fall back to plain translations: the rows are the point of this request, and dropping the attributes above leaves you plenty of room for them.
- `data-align-groups` lists deterministic source groups as `firstOrdinal-lastOrdinal@startSec-endSec`, separated by `;` — the seconds are measured from the start of that sentence, so `5-9@1.4-3.2` means source words 5 to 9 are spoken between 1.4s and 3.2s, lasting 1.8s.
- First write the complete natural translation as the element text. Then, INSIDE that same `<p>`, cut that translation into DISPLAY ROWS: a sequence of `<span data-src="a-b">row</span>` elements whose texts concatenated reproduce the translation exactly — never add, drop, reorder, or rewrite a character, and never leave any text outside a span.
- Each row's `data-src` is ONE contiguous ascending ordinal range. Consecutive rows must be adjacent and together cover every ordinal from 1 to the last one exactly once, in source order: `1-9`, `10-14`, `15-20`. The first row therefore translates the first source words, the second row the next ones, and so on (simultaneous-interpretation style).
- Rows are built out of the groups: a row is exactly one group, or several ADJACENT groups joined together (`1-4` plus `5-9` becomes `data-src="1-9"`). Never cut inside a group.
- AIM FOR {floor} to {fit} display units per row. Group boundaries are candidate cuts, not required cuts — never chop a sentence into many short rows just to land on every one of them. Merge a group into a neighbour whenever that group lasts under 1.5s, or whenever its share of the translation is under 6 display units, unless it ends the sentence; and merge two adjacent groups whenever the joined row still fits {fit} units. A sentence of four groups usually wants two rows, not four.
- Keep every row at most {fit} display units and NEVER above {hard}.
- Reading speed is a target of the same rank: for every row, its display units divided by its duration in seconds (add up the durations of the groups it covers) must be at most 6, and the row must last at least 1s. A row failing either test is too short — join it with a neighbour, and prefer a longer row over one whose words have not been spoken yet.
- Numbers, names, URLs and glossary terms must sit in the row whose ordinal range contains their source ordinal.
- When the natural target word order does not follow the source order at some point, join the groups involved into ONE longer row instead of reordering; if the whole sentence cannot be laid out in source order, emit a single span covering `1-N`. Fewer, longer rows are always better than rows that misstate the correspondence.
- Never distort, shorten, pad, or retranslate the sentence to make the rows come out — the translation is the truth and the rows are a draft. A malformed annotation is silently discarded and never rejects the translation."#,
        // The lower bound defaults to 10. Under narrow budgets such as Shorts, when soft is below 10 the lower bound follows soft, so it does not read "10 to 10".
        floor = params.soft.min(10),
        fit = params.fit,
        hard = params.hard,
    )
}

/// Whether the fusion draft is still usable after the translation has been committed through AutoCorrect. The concatenated block texts equal the committed translation under [`normalize_chars`] (AutoCorrect only changes whitespace, punctuation and case). If usable, it passes to the align engine as is. The character ranges of blocks within the committed translation are located in order by `chunks_to_edges`.
fn format_fusion_draft(
    draft: &TranslateAlignmentDraft,
    committed_translation: &str,
    source_words: usize,
) -> Option<FusionDraft> {
    let concat: String = draft
        .chunks
        .iter()
        .map(|chunk| chunk.text.as_str())
        .collect();
    if draft.chunks.is_empty() || normalize_chars(&concat) != normalize_chars(committed_translation)
    {
        return None;
    }
    // The row partition is re-verified after AutoCorrect. The committed translation is the text the engine will actually split.
    let rows = draft.rows && is_row_partition(&draft.chunks, source_words);
    Some(FusionDraft {
        chunks: draft.chunks.clone(),
        rows,
        on_groups: rows && draft.on_groups,
        lines: None,
    })
}

/// Whether the line-text carrier's draft is still usable after the translation has been committed through AutoCorrect. The recorded block texts are located, in effective-character order, on the committed translation and cut again ([`lines_translation::rebase`]). The concatenated block texts then equal the committed translation. If the relocation fails (a change beyond AutoCorrect), the draft is discarded.
fn format_lines_draft(
    draft: &crate::filepipe::TranslateLinesDraft,
    committed_translation: &str,
) -> Option<FusionDraft> {
    let record = lines_translation::rebase(&draft.record, committed_translation)?;
    Some(FusionDraft {
        chunks: Vec::new(),
        rows: false,
        on_groups: false,
        lines: Some(crate::filepipe::TranslateLinesDraft {
            record,
            pieces: draft.pieces.clone(),
            source_words: draft.source_words.clone(),
        }),
    })
}

fn translate_system_prompt(
    source_lang: &str,
    target_lang: &str,
    analysis: Option<&Analysis>,
    brief: Option<&DocumentBrief>,
    tone: Option<TranslationTone>,
    instructions: Option<&str>,
    source_text: &str,
    body: &str,
) -> String {
    let mut prompt = format!(
        "You are a professional subtitle translator translating from \"{source_lang}\" to \"{target_lang}\"."
    );
    if let Some(summary) = brief
        .map(|brief| brief.summary.as_str())
        .filter(|summary| !summary.trim().is_empty())
        .or_else(|| {
            analysis
                .map(|analysis| analysis.summary.as_str())
                .filter(|summary| !summary.trim().is_empty())
        })
    {
        prompt.push_str(&format!("\n\nDocument summary: {summary}"));
    }
    if let Some(analysis) = analysis {
        prompt.push_str(&format!(
            "\n\nSource-language terms confirmed during transcript analysis — recognize them in the source (ASR may misspell them; observed forms are listed) and render each ONE consistent way across the whole document:\n{}",
            format_for_prompt(analysis)
        ));
    }
    if let Some(brief) = brief {
        if !brief.style_guide.trim().is_empty() {
            prompt.push_str(&format!(
                "\n\nGenerated style guide (advisory; fixed target-locale rules and explicit user instructions override it): {}",
                brief.style_guide.trim()
            ));
        }
        let glossary = brief.glossary_for_prompt(source_text, analysis, 80);
        if !glossary.is_empty() {
            let lines = glossary
                .into_iter()
                .map(|entry| {
                    let lock = if entry.locked { "LOCKED" } else { "preferred" };
                    let note = entry
                        .note
                        .as_deref()
                        .filter(|note| !note.trim().is_empty())
                        .map(|note| format!(" ({note})"))
                        .unwrap_or_default();
                    format!("- [{lock}] {} → {}{note}", entry.source, entry.target)
                })
                .collect::<Vec<_>>()
                .join("\n");
            prompt.push_str(&format!(
                "\n\nGlossary — LOCKED entries are exact requirements; preferred entries guide consistency but may yield to context. Each entry has ONE target rendering; never emit slash-separated alternatives — but when an entry's own target contains a slash (a CLI command such as /compact), reproduce it exactly as written:\n{lines}"
            ));
        }
    }
    let mut named_entities = brief
        .map(|brief| brief.named_entities.clone())
        .unwrap_or_default();
    if named_entities.is_empty() {
        named_entities = analysis
            .map(|analysis| analysis.named_entities.clone())
            .unwrap_or_default();
    }
    if !named_entities.is_empty() {
        prompt.push_str(&format!(
            "\n\nNamed entities to preserve and render consistently: {}",
            named_entities.join(" · ")
        ));
    }
    prompt.push_str("\n\n");
    prompt.push_str(body);
    if let Some(policy) = simplified_chinese_prompt_block(target_lang) {
        prompt.push_str("\n\n");
        prompt.push_str(policy);
    }
    if let Some(tone) = tone {
        prompt.push_str("\n\nTone: ");
        prompt.push_str(tone.prompt_line());
    }
    if let Some(instructions) = instructions.filter(|text| !text.is_empty()) {
        prompt.push_str(&format!(
            "\n\nExplicit user instructions (highest content-specific priority; do not violate LOCKED glossary renderings or the document contract): {instructions}"
        ));
    }
    prompt
}

// ---- response validation -------------------------------------------------------------

/// Mirror lint of the `file-v1` contract for `task submit`.
///
/// `input` is the rendered text on disk. There is **only one** validation. First, [`parse_translate_source`] reconstructs a render structure equivalent for validation. Then the engine's own [`parse_translate_page`] runs. No second set of criteria exists.
///
/// The criteria match the engine's. A page is rejected only if `page_rejected` is set (the whole page is void) or there are `retry_ids` (missing sentences, empty translations, missing terms). `paragraph-move` and `unknown-id` on editable sentences are advisory and do not reject. Otherwise the agent would spin endlessly on warnings it cannot clear.
pub fn lint_agent_answer_file(input: &str, answer: &str) -> Vec<String> {
    let Some(page) = parse_translate_source(input) else {
        return Vec::new();
    };
    let mut parsed = parse_translate_page(&page, Some(input), answer);
    crate::filepipe::translate_html::validate_translation_quality(&page, &mut parsed);
    if !parsed.page_rejected && parsed.retry_ids.is_empty() {
        return Vec::new();
    }
    parsed
        .diagnostics
        .problems
        .iter()
        .map(|problem| match &problem.scope {
            crate::filepipe::ProblemScope::Sentence { id } => {
                format!("[{}] {id}: {}", problem.code, problem.detail)
            }
            _ => format!("[{}] {}", problem.code, problem.detail),
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cue::CueParams;
    use crate::doc::{AlignMode, DocEngine, DocMedia, Speaker, TransAlign, Word};
    use crate::llm::FakeLlm;
    use crate::split::TransParams;
    use std::collections::VecDeque;

    struct ScriptedBatchLlm {
        rounds: VecDeque<Vec<(usize, Result<String, LlmError>)>>,
        requests: Vec<Vec<(String, Option<String>)>>,
    }

    impl ScriptedBatchLlm {
        fn new(rounds: Vec<Vec<(usize, Result<String, LlmError>)>>) -> Self {
            Self {
                rounds: rounds.into(),
                requests: Vec::new(),
            }
        }
    }

    impl LlmJson for ScriptedBatchLlm {
        fn complete(&mut self, _: &LlmRequest) -> Result<String, LlmError> {
            panic!("translate should use complete_batch_with")
        }

        fn complete_batch_with(
            &mut self,
            requests: &[LlmRequest],
            on_ready: &mut dyn FnMut(usize, Result<String, LlmError>),
        ) {
            self.requests.push(
                requests
                    .iter()
                    .map(|request| (request.user.clone(), request.retry_reason.clone()))
                    .collect(),
            );
            for (index, result) in self.rounds.pop_front().expect("scripted batch round") {
                on_ready(index, result);
            }
        }
    }

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

    fn w(id: &str, t0: f64, t1: f64, text: &str, sp: &str) -> Word {
        Word {
            id: id.to_owned(),
            t0,
            t1,
            text: text.to_owned(),
            sp: sp.to_owned(),
            glue: false,
        }
    }

    /// Sentence 1 is two Cues ("echo," breaks at pause_punct, and "hotel." ends the sentence). Sentence 2 is the single Cue "Done.".
    fn two_sentence_doc() -> TranscriptDoc {
        doc_with_words(vec![
            w("g1.0", 0.0, 0.4, "alpha", "s1"),
            w("g1.1", 0.4, 0.8, "bravo", "s1"),
            w("g1.2", 0.8, 1.2, "charlie", "s1"),
            w("g1.3", 1.2, 1.6, "delta", "s1"),
            w("g1.4", 1.6, 2.0, "echo,", "s1"),
            w("g1.5", 2.0, 2.4, "foxtrot", "s1"),
            w("g1.6", 2.4, 2.8, "golf", "s1"),
            w("g1.7", 2.8, 3.2, "hotel.", "s1"),
            w("g2.0", 3.4, 3.8, "Done.", "s1"),
        ])
    }

    fn options(lang: &str) -> TranslateOptions {
        TranslateOptions {
            source_lang: "en".to_owned(),
            lang: lang.to_owned(),
            force: false,
            sentences: None,
            page_budget: crate::paging::budgets::TRANSLATE_PROVIDER_WORDS,
            instructions: None,
            analysis: None,
            brief: None,
            tone: None,
            autocorrect: true,
            align: None,
            align_rows: false,
            align_lines: false,
            worker_slots: None,
            provenance_stale: BTreeSet::new(),
        }
    }

    #[test]
    fn word_balancing_uses_only_source_words() {
        let source_words = [10, 10, 10, 10, 10, 10];
        let sizes = translate_page_sizes(&source_words, 30);
        assert_eq!(sizes, vec![3, 3]);
        assert_eq!(sizes.len(), 2);
        assert_eq!(sizes.iter().sum::<usize>(), source_words.len());
    }

    #[test]
    fn sentence_count_does_not_split_a_page_under_the_word_budget() {
        // 218 sentences × 10 words = 2180 ≤ 2000 + 200 slack. Many sentences do not split the page either.
        let source_words = vec![10_usize; 218];
        let budget = crate::paging::budgets::TRANSLATE_PROVIDER_WORDS;
        assert_eq!(218 * 10, 2180);
        assert_eq!(translate_page_sizes(&source_words, budget), vec![218]);
        assert!(fits_single_translate_page(218, 2180, budget));
    }

    #[test]
    fn long_documents_split_only_at_word_budget_multiples() {
        // 9860 words ÷ (2000 + 200 slack) → 5 pages, about 1972 words each.
        let source_words = vec![20_usize; 493];
        let sizes = translate_page_sizes(
            &source_words,
            crate::paging::budgets::TRANSLATE_PROVIDER_WORDS,
        );
        assert_eq!(sizes.len(), 5);
        assert_eq!(sizes.iter().sum::<usize>(), 493);
        assert!(sizes.iter().max().unwrap() - sizes.iter().min().unwrap() <= 1);
    }

    #[test]
    fn a_talk_that_the_old_budget_kept_whole_now_splits_in_two() {
        // A 193-sentence, 3571-word conversation (p-00ec2e27 baseline). Under the old 5000 tier it was a single page with idle workers. Both the agent and provider tiers now split it into 2 pages to be claimed in parallel.
        let source_words = vec![18_usize; 199];
        assert_eq!(199 * 18, 3582);
        assert!(fits_single_translate_page(199, 3582, 5000));
        for executor in [
            crate::paging::PageExecutor::Agent,
            crate::paging::PageExecutor::Provider,
        ] {
            let budget = executor.translate_words();
            assert!(!fits_single_translate_page(199, 3582, budget));
            let sizes = translate_page_sizes(&source_words, budget);
            assert_eq!(sizes.len(), 2);
            assert!(sizes.iter().all(|size| size * 18 <= budget + budget / 10));
        }
    }

    #[test]
    fn word_budget_drives_page_count_for_long_sentences() {
        let source_words = vec![500_usize; 6];
        let budget = 1000;
        assert_eq!(translate_page_sizes(&source_words, budget), vec![2, 2, 2]);

        // When the budget puts every entry on its own page, the page count is clamped back to the number of entries, so no empty pages are cut.
        let dense_words = vec![100_usize; 10];
        let sizes = translate_page_sizes(&dense_words, 100);
        assert_eq!(sizes.len(), 10);
        assert!(sizes.iter().all(|size| *size == 1));
    }

    #[test]
    fn run_translate_lands_sentences_and_stamps_into_doc() {
        let mut doc = two_sentence_doc();
        let mut llm = FakeLlm::new([Ok(file_answer(&[
            ("s-g1.0", "第一段译文,第二段收尾。"),
            ("s-g2.0", "完成。"),
        ]))]);
        let mut page_snapshots = Vec::new();
        let outcome = run_translate(
            &mut doc,
            &mut llm,
            &options("zh"),
            &mut |doc| page_snapshots.push(doc.trans["zh"].len()),
            &mut |_| {},
        )
        .unwrap();
        assert_eq!(outcome.translated_sentences, 2);
        assert_eq!(outcome.skipped_sentences, 0);
        assert_eq!(outcome.total_sentences, 2);
        assert_eq!(doc.trans["zh"]["s-g1.0"], "第一段译文，第二段收尾。");
        assert_eq!(doc.trans["zh"]["s-g2.0"], "完成。");
        // Sentence fingerprints are stamped along with the page, so stale is empty.
        let cues = derive_cues(&doc, &CueParams::default());
        let sentences = derive_sentences(&doc, &cues);
        assert!(stale_sentences(&doc, "zh", &sentences).is_empty());
        assert_eq!(page_snapshots, vec![2]);

        assert_eq!(llm.calls.len(), 1);
        let (kind, system, user, retry) = &llm.calls[0];
        assert_eq!(kind, "translate");
        assert!(system.contains("professional subtitle translator"));
        assert!(system.contains("from \"en\" to \"zh\""));
        assert!(retry.is_none());
        // HTML payload. zh CPS=9: 3.2s → 28, and "Done." at 0.4s × 9 → 3.
        assert!(user.contains("id=\"s-g1.0\""), "{user}");
        assert!(user.contains("data-budget=\"整句≤28字\""), "{user}");
        assert!(user.contains("data-budget=\"整句≤3字\""), "{user}");
    }

    #[test]
    fn fused_translate_only_marks_sentences_that_already_need_splitting() {
        let mut doc = two_sentence_doc();
        doc.words[7].t1 = 8.0;
        doc.words[8].t0 = 8.2;
        doc.words[8].t1 = 8.6;
        let mut llm = FakeLlm::new([Ok(file_answer(&[
            ("s-g1.0", "第一段译文，第二段收尾。"),
            ("s-g2.0", "完成。"),
        ]))]);
        let mut options = options("zh-Hans");
        options.align = Some(TransParams::for_lang("zh-Hans"));

        run_translate(&mut doc, &mut llm, &options, &mut |_| {}, &mut |_| {}).unwrap();

        let user = &llm.calls[0].2;
        let long = user
            .lines()
            .find(|line| line.contains("id=\"s-g1.0\""))
            .expect("long sentence row");
        let short = user
            .lines()
            .find(|line| line.contains("id=\"s-g2.0\""))
            .expect("short sentence row");
        assert!(
            long.contains("data-align-words=\"[1]alpha [2]bravo [3]charlie [4]delta [5]echo, [6]foxtrot [7]golf [8]hotel.\""),
            "{long}"
        );
        assert!(long.contains("data-align-needed=\"true\""), "{long}");
        assert!(!short.contains("data-align-words="), "{short}");
        assert!(!short.contains("data-align-needed="), "{short}");
    }

    #[test]
    fn run_translate_respects_disabled_autocorrect() {
        let mut doc = two_sentence_doc();
        let mut llm = FakeLlm::new([Ok(file_answer(&[
            ("s-g1.0", "在Claude里开发."),
            ("s-g2.0", "完成."),
        ]))]);
        let mut options = options("zh-Hans");
        options.autocorrect = false;

        run_translate(&mut doc, &mut llm, &options, &mut |_| {}, &mut |_| {}).unwrap();

        assert_eq!(doc.trans["zh-Hans"]["s-g1.0"], "在Claude里开发.");
        assert_eq!(doc.trans["zh-Hans"]["s-g2.0"], "完成.");
    }

    #[test]
    fn routed_translate_keeps_timeline_order_and_scatter_keys() {
        let rows = vec![
            RoutedSentence {
                route_id: "r1".to_owned(),
                src_id: "src-b".to_owned(),
                sentence_id: "s-b1".to_owned(),
                source_lang: "ja".to_owned(),
                source_text: "先に見せる。".to_owned(),
                src_fingerprint: "visible-b".to_owned(),
                display_duration: 2.0,
                translation: None,
                stamped_fingerprint: None,
            },
            RoutedSentence {
                route_id: "r2".to_owned(),
                src_id: "main".to_owned(),
                sentence_id: "s-a1".to_owned(),
                source_lang: "en".to_owned(),
                source_text: "Then the main source.".to_owned(),
                src_fingerprint: "visible-a".to_owned(),
                display_duration: 3.0,
                translation: Some("old".to_owned()),
                stamped_fingerprint: Some("old-visible".to_owned()),
            },
            RoutedSentence {
                route_id: "r3".to_owned(),
                src_id: "main".to_owned(),
                sentence_id: "s-a2".to_owned(),
                source_lang: "en".to_owned(),
                source_text: "A legacy unstamped translation.".to_owned(),
                src_fingerprint: "visible-a2".to_owned(),
                display_duration: 2.0,
                translation: Some("legacy".to_owned()),
                stamped_fingerprint: None,
            },
        ];
        let mut llm = FakeLlm::new([Ok("<article><section id=\"p-src-b\"><p id=\"r1\">先展示。</p></section><section id=\"p-main\"><p id=\"r2\">然后是主素材。</p><p id=\"r3\">补盖可见指纹。</p></section></article>".to_owned())]);
        let mut pages = Vec::new();
        let outcome = run_routed_translate(
            &rows,
            &mut llm,
            &RoutedTranslateOptions {
                lang: "zh-Hans".to_owned(),
                force: false,
                sentences: None,
                page_budget: 10_000,
                instructions: None,
                analysis: None,
                brief: None,
                tone: None,
                autocorrect: true,
                chapter_titles: Vec::new(),
                worker_slots: None,
            },
            &mut |page| pages.push(page.to_vec()),
            &mut |_| {},
        )
        .unwrap();
        assert_eq!(outcome.translated_sentences, 3);
        assert_eq!(pages[0][0].src_id, "src-b");
        assert_eq!(pages[0][0].sentence_id, "s-b1");
        assert_eq!(pages[0][0].src_fingerprint, "visible-b");
        assert_eq!(pages[0][1].src_id, "main");
        assert_eq!(pages[0][2].sentence_id, "s-a2");
        let user = &llm.calls[0].2;
        assert!(user.find("先に見せる").unwrap() < user.find("Then the main").unwrap());
    }

    /// Two-sentence minimal corpus for the routed path: the same source segment means they belong to the same `p-main` paragraph under the file contract.
    fn routed_pair() -> Vec<RoutedSentence> {
        vec![
            RoutedSentence {
                route_id: "r1".to_owned(),
                src_id: "main".to_owned(),
                sentence_id: "s-a1".to_owned(),
                source_lang: "en".to_owned(),
                source_text: "First line.".to_owned(),
                src_fingerprint: "fp-a1".to_owned(),
                display_duration: 2.0,
                translation: None,
                stamped_fingerprint: None,
            },
            RoutedSentence {
                route_id: "r2".to_owned(),
                src_id: "main".to_owned(),
                sentence_id: "s-a2".to_owned(),
                source_lang: "en".to_owned(),
                source_text: "Second line.".to_owned(),
                src_fingerprint: "fp-a2".to_owned(),
                display_duration: 2.0,
                translation: None,
                stamped_fingerprint: None,
            },
        ]
    }

    fn routed_options() -> RoutedTranslateOptions {
        RoutedTranslateOptions {
            lang: "zh-Hans".to_owned(),
            force: false,
            sentences: None,
            page_budget: 10_000,
            instructions: None,
            analysis: None,
            brief: None,
            tone: None,
            autocorrect: false,
            chapter_titles: Vec::new(),
            worker_slots: None,
        }
    }

    fn routed_file_answer(pairs: &[(&str, &str)]) -> String {
        let mut out = String::from("<article><section id=\"p-main\">");
        for (id, text) in pairs {
            out.push_str(&format!("<p id=\"{id}\">{text}</p>"));
        }
        out.push_str("</section></article>");
        out
    }

    #[test]
    fn file_contract_routed_reports_every_page_attempt() {
        let rows = routed_pair();
        let mut llm = ScriptedBatchLlm::new(vec![
            // No expected sentence parsed at all (page-fatal) ⇒ a second attempt on the same page.
            vec![(0, Ok("好的，这是翻译：一。二。".to_owned()))],
            vec![(0, Ok(routed_file_answer(&[("r1", "一。"), ("r2", "二。")])))],
        ]);
        let mut attempts: Vec<(String, u32, bool, bool)> = Vec::new();
        let mut pages = Vec::new();
        let outcome = run_routed_translate_with_artifacts(
            &rows,
            &mut llm,
            &routed_options(),
            &mut |page| pages.push(page.to_vec()),
            &mut |attempt| {
                attempts.push((
                    attempt.page_id.to_owned(),
                    attempt.attempt,
                    attempt.accepted,
                    attempt.input.contains("id=\"r1\"") && !attempt.output.is_empty(),
                ));
            },
            &mut |_| {},
        )
        .expect("routed file contract translate");

        assert_eq!(outcome.translated_sentences, 2);
        // The two page-level attempts of wave 1 each call back once. There is no extra repair wave.
        assert_eq!(llm.requests.len(), 2);
        assert_eq!(
            attempts.len(),
            2,
            "extra attempts would mean a repair wave fired: {attempts:?}"
        );
        assert_eq!(
            attempts,
            vec![
                ("p001".to_owned(), 1, false, true),
                ("p001".to_owned(), 2, true, true),
            ]
        );
        assert_eq!(pages.len(), 1);
        assert_eq!(pages[0].len(), 2);
        assert_eq!(pages[0][0].sentence_id, "s-a1");
    }

    #[test]
    fn rerun_skips_fresh_sentences_and_retranslates_stale_only() {
        let mut doc = two_sentence_doc();
        let mut llm = FakeLlm::new([Ok(file_answer(&[("s-g1.0", "甲。"), ("s-g2.0", "乙。")]))]);
        run_translate(&mut doc, &mut llm, &options("zh"), &mut |_| {}, &mut |_| {}).unwrap();

        // Everything is fresh ⇒ zero calls.
        let mut llm = FakeLlm::ok(std::iter::empty::<&'static str>());
        let outcome =
            run_translate(&mut doc, &mut llm, &options("zh"), &mut |_| {}, &mut |_| {}).unwrap();
        assert_eq!(llm.calls.len(), 0);
        assert_eq!(outcome.translated_sentences, 0);
        assert_eq!(outcome.skipped_sentences, 2);

        // Edited words in sentence 1 ⇒ only sentence 1 is retranslated.
        doc.words[2].text = "charlee".to_owned();
        let mut llm = FakeLlm::new([Ok(file_answer(&[("s-g1.0", "重翻。")]))]);
        let outcome =
            run_translate(&mut doc, &mut llm, &options("zh"), &mut |_| {}, &mut |_| {}).unwrap();
        assert_eq!(outcome.translated_sentences, 1);
        assert_eq!(outcome.skipped_sentences, 1);
        assert!(!llm.calls[0].2.contains("s-g2.0"));
        assert_eq!(doc.trans["zh"]["s-g1.0"], "重翻。");
        assert_eq!(doc.trans["zh"]["s-g2.0"], "乙。");

        // force ⇒ everything is retranslated.
        let mut llm = FakeLlm::new([Ok(file_answer(&[
            ("s-g1.0", "强一。"),
            ("s-g2.0", "强二。"),
        ]))]);
        let mut opts = options("zh");
        opts.force = true;
        let outcome = run_translate(&mut doc, &mut llm, &opts, &mut |_| {}, &mut |_| {}).unwrap();
        assert_eq!(outcome.translated_sentences, 2);
    }

    #[test]
    fn sentence_filter_retranslates_only_the_selected_fresh_sentence() {
        let mut doc = two_sentence_doc();
        let mut llm = FakeLlm::new([Ok(file_answer(&[("s-g1.0", "甲。"), ("s-g2.0", "乙。")]))]);
        run_translate(&mut doc, &mut llm, &options("zh"), &mut |_| {}, &mut |_| {}).unwrap();

        let mut opts = options("zh");
        opts.sentences = Some(BTreeSet::from(["s-g1.0".to_owned()]));
        let mut llm = FakeLlm::new([Ok(file_answer(&[("s-g1.0", "定向重翻。")]))]);
        let outcome = run_translate(&mut doc, &mut llm, &opts, &mut |_| {}, &mut |_| {}).unwrap();

        assert_eq!(outcome.translated_sentences, 1);
        assert_eq!(outcome.skipped_sentences, 1);
        assert_eq!(doc.trans["zh"]["s-g1.0"], "定向重翻。");
        assert_eq!(doc.trans["zh"]["s-g2.0"], "乙。");
        assert_eq!(llm.calls.len(), 1);
        assert!(!llm.calls[0].2.contains("s-g2.0"));
    }

    #[test]
    fn rerun_prunes_orphan_translation_state_without_calling_llm() {
        let mut doc = two_sentence_doc();
        let mut llm = FakeLlm::new([Ok(file_answer(&[("s-g1.0", "甲。"), ("s-g2.0", "乙。")]))]);
        run_translate(&mut doc, &mut llm, &options("zh"), &mut |_| {}, &mut |_| {}).unwrap();

        doc.trans
            .entry("zh".to_owned())
            .or_default()
            .insert("s-retired".to_owned(), "旧译文".to_owned());
        doc.trans_src
            .entry("zh".to_owned())
            .or_default()
            .insert("s-retired".to_owned(), "old-fingerprint".to_owned());
        doc.trans_align.entry("zh".to_owned()).or_default().insert(
            "s-retired".to_owned(),
            TransAlign {
                mode: AlignMode::ManyToOne,
                crossing: false,
                correspondence: None,
                text_basis: Default::default(),
                aligner: None,
                blocks: Vec::new(),
                cues: vec![],
                words: vec![],
                pieces: vec![],
            },
        );

        let mut llm = FakeLlm::ok(std::iter::empty::<&'static str>());
        let mut snapshots = Vec::new();
        let outcome = run_translate(
            &mut doc,
            &mut llm,
            &options("zh"),
            &mut |doc| {
                snapshots.push((
                    doc.trans["zh"].contains_key("s-retired"),
                    doc.trans_src["zh"].contains_key("s-retired"),
                    doc.trans_align["zh"].contains_key("s-retired"),
                ));
            },
            &mut |_| {},
        )
        .unwrap();

        assert_eq!(outcome.translated_sentences, 0);
        assert_eq!(outcome.skipped_sentences, 2);
        assert!(llm.calls.is_empty());
        assert_eq!(snapshots, vec![(false, false, false)]);
        assert_eq!(doc.trans["zh"].len(), 2);
        assert_eq!(doc.trans_src["zh"].len(), 2);
        assert!(doc.trans_align["zh"].is_empty());
    }

    #[test]
    fn run_translate_stops_on_terminal_without_retry() {
        // The retry and exhaustion semantics for malformed responses are covered by the file_contract_* test series. Here we only pin that Terminal propagates immediately, without retry, and that the doc gets no pages.
        let mut doc = two_sentence_doc();
        let mut llm = FakeLlm::new([Err(LlmError::Terminal("401".to_owned()))]);
        let result = run_translate(&mut doc, &mut llm, &options("zh"), &mut |_| {}, &mut |_| {});
        assert!(matches!(result, Err(LlmError::Terminal(_))));
        assert_eq!(llm.calls.len(), 1);
        assert!(doc.trans.is_empty());
    }

    #[test]
    fn paging_splits_by_budget_and_carries_static_neighbour_context() {
        let mut doc = two_sentence_doc();
        let mut opts = options("zh");
        opts.page_budget = 1; // Word-count budget 1: each sentence gets its own page
        let mut llm = FakeLlm::new([
            Ok(file_answer(&[("s-g1.0", "第一页。")])),
            Ok(file_answer(&[("s-g2.0", "第二页。")])),
        ]);
        let mut page_sizes = Vec::new();
        let outcome = run_translate(
            &mut doc,
            &mut llm,
            &opts,
            &mut |doc| page_sizes.push(doc.trans["zh"].len()),
            &mut |_| {},
        )
        .unwrap();
        assert_eq!(outcome.translated_sentences, 2);
        assert_eq!(llm.calls.len(), 2);
        assert_eq!(page_sizes, vec![1, 2]);
        assert!(
            llm.calls[0].2.contains("context-after: Done."),
            "{}",
            llm.calls[0].2
        );
        assert!(!llm.calls[0].2.contains("context-before"));
        assert!(
            llm.calls[1].2.contains("context-before: alpha bravo"),
            "{}",
            llm.calls[1].2
        );
    }

    #[test]
    fn batch_retries_only_the_bad_page_and_checkpoints_out_of_order_success() {
        let mut doc = two_sentence_doc();
        let mut opts = options("zh");
        opts.page_budget = 1;
        let mut llm = ScriptedBatchLlm::new(vec![
            vec![
                (1, Ok(file_answer(&[("s-g2.0", "第二页。")]))),
                // No expected sentence parsed ⇒ page-fatal, so only this page is retried as a whole.
                (0, Ok("好的，这是第一页的翻译。".to_owned())),
            ],
            vec![(0, Ok(file_answer(&[("s-g1.0", "第一页。")])))],
        ]);
        let mut snapshots = Vec::new();
        run_translate(
            &mut doc,
            &mut llm,
            &opts,
            &mut |doc| snapshots.push(doc.trans["zh"].keys().cloned().collect::<Vec<_>>()),
            &mut |_| {},
        )
        .unwrap();

        assert_eq!(snapshots[0], vec!["s-g2.0"]);
        assert_eq!(snapshots[1], vec!["s-g1.0", "s-g2.0"]);
        assert_eq!(llm.requests[0].len(), 2);
        assert_eq!(llm.requests[1].len(), 1);
        assert!(llm.requests[0].iter().all(|(_, reason)| reason.is_none()));
        assert!(
            llm.requests[1][0]
                .1
                .as_deref()
                .unwrap()
                .contains("document-wrapped")
        );
    }

    #[test]
    fn terminal_batch_error_keeps_successful_pages_from_the_same_round() {
        let mut doc = two_sentence_doc();
        let mut opts = options("zh");
        opts.page_budget = 1;
        let mut llm = ScriptedBatchLlm::new(vec![vec![
            (0, Err(LlmError::Terminal("401".to_owned()))),
            (1, Ok(file_answer(&[("s-g2.0", "已落盘。")]))),
        ]]);
        let mut snapshots = Vec::new();
        let result = run_translate(
            &mut doc,
            &mut llm,
            &opts,
            &mut |doc| snapshots.push(doc.trans["zh"].len()),
            &mut |_| {},
        );

        assert!(matches!(result, Err(LlmError::Terminal(_))));
        assert_eq!(snapshots, vec![1]);
        assert_eq!(doc.trans["zh"]["s-g2.0"], "已落盘。");
        assert_eq!(llm.requests.len(), 1);
    }

    #[test]
    fn reading_budget_cps_varies_by_target_lang() {
        let doc = two_sentence_doc();
        let cues = derive_cues(&doc, &CueParams::default());
        let sentences = derive_sentences(&doc, &cues);
        assert_eq!(reading_budget(&doc, &sentences[0], "zh-CN"), 28);
        assert_eq!(reading_budget(&doc, &sentences[0], "ja"), 41);
        assert_eq!(reading_budget(&doc, &sentences[0], "fr"), 67);
        assert_eq!(reading_budget(&doc, &sentences[1], "zh"), 3);
    }

    #[test]
    fn instructions_append_to_system_prompt() {
        let prompt = translate_system_prompt(
            "en",
            "zh",
            None,
            None,
            None,
            Some("正式书面语"),
            "",
            TRANSLATE_FILE_PROMPT_BODY,
        );
        assert!(prompt.contains("Explicit user instructions"));
        assert!(prompt.ends_with("正式书面语"));
        let prompt = translate_system_prompt(
            "en",
            "zh-Hant",
            None,
            None,
            None,
            None,
            "",
            TRANSLATE_FILE_PROMPT_BODY,
        );
        assert!(!prompt.contains("Explicit user instructions"));
        assert!(!prompt.contains("Simplified-Chinese target policy"));
        assert!(prompt.contains("cannot recover an omitted clause"));
    }

    #[test]
    fn term_presence_uses_identifier_boundaries_and_cjk_contains() {
        assert!(term_present("Air is a model", "Air"));
        assert!(!term_present("Airport is nearby", "Air"));
        assert!(term_present("We compile C++ today", "C++"));
        assert!(term_present("使用宝剪辑处理字幕", "宝剪辑"));
    }

    #[test]
    fn prompt_includes_analysis_brief_tone_and_chapters() {
        let mut doc = two_sentence_doc();
        doc.chapters.push(crate::doc::Chapter {
            id: "ch1".to_owned(),
            title: "Opening".to_owned(),
            start: 0.0,
            end: 10.0,
        });
        let mut opts = options("zh-Hans");
        opts.analysis = Some(Analysis {
            summary: "source summary".to_owned(),
            terms: vec![],
            named_entities: vec!["Alice".to_owned()],
            fingerprint: "fp".to_owned(),
            reference_fingerprint: None,
        });
        opts.brief = Some(DocumentBrief {
            summary: "译向摘要".to_owned(),
            style_guide: "短句".to_owned(),
            named_entities: vec!["CucCut".to_owned()],
            ..Default::default()
        });
        opts.tone = Some(TranslationTone::Casual);
        let mut llm = FakeLlm::new([Ok(file_answer(&[
            ("s-g1.0", "第一段。"),
            ("s-g2.0", "完成。"),
        ]))]);
        run_translate(&mut doc, &mut llm, &opts, &mut |_| {}, &mut |_| {}).unwrap();
        let system = &llm.calls[0].1;
        assert!(system.contains("Document summary: 译向摘要"));
        assert!(system.contains("Generated style guide"));
        assert!(system.contains("CucCut"));
        assert!(system.contains("conversational register"));
        assert!(system.contains("Simplified-Chinese target policy"));
        assert!(system.contains("Chapters (document context only"));
        assert!(system.contains("Opening"));
    }

    // ---- file contract (file-v1) --------------------------------------------

    /// Three sentences in one paragraph: `s-g1.0`, `s-g2.0` and `s-g3.0` all fall in paragraph `p-g1.0`.
    fn three_sentence_doc() -> TranscriptDoc {
        doc_with_words(vec![
            w("g1.0", 0.0, 0.4, "alpha", "s1"),
            w("g1.1", 0.4, 0.8, "bravo", "s1"),
            w("g1.2", 0.8, 1.2, "charlie.", "s1"),
            w("g2.0", 1.4, 1.8, "delta", "s1"),
            w("g2.1", 1.8, 2.2, "echo.", "s1"),
            w("g3.0", 2.4, 2.8, "foxtrot", "s1"),
            w("g3.1", 2.8, 3.2, "golf.", "s1"),
        ])
    }

    /// `count` sentences of 10 words each, all on the same page (within 880 words for the rows tier).
    fn rows_page_doc(count: usize) -> TranscriptDoc {
        let mut words = Vec::new();
        let mut clock = 0.0f64;
        for sentence in 0..count {
            for index in 0..10 {
                let text = if index == 9 {
                    "end.".to_owned()
                } else {
                    format!("word{index}")
                };
                words.push(w(
                    &format!("g{sentence}.{index}"),
                    clock,
                    clock + 0.4,
                    &text,
                    "s1",
                ));
                clock += 0.4;
            }
            clock += 0.9;
        }
        doc_with_words(words)
    }

    fn file_answer(pairs: &[(&str, &str)]) -> String {
        let mut out = String::from("<article><section id=\"p-g1.0\">");
        for (id, text) in pairs {
            out.push_str(&format!("<p id=\"{id}\">{text}</p>"));
        }
        out.push_str("</section></article>");
        out
    }

    #[test]
    fn file_contract_renders_html_and_writes_truth() {
        let mut doc = three_sentence_doc();
        let mut llm = ScriptedBatchLlm::new(vec![vec![(
            0,
            Ok(file_answer(&[
                ("s-g1.0", "一。"),
                ("s-g2.0", "二。"),
                ("s-g3.0", "三。"),
            ])),
        )]]);
        let mut pages = 0;
        let outcome = run_translate(
            &mut doc,
            &mut llm,
            &options("zh-Hans"),
            &mut |_| pages += 1,
            &mut |_| {},
        )
        .expect("file contract translate");

        let sent = &llm.requests[0][0].0;
        assert!(
            sent.contains("data-ccut-format=\"translation-source/1\""),
            "{sent}"
        );
        assert!(
            sent.contains("<section id=\"p-g1.0\" data-sp=\"s1\">"),
            "{sent}"
        );
        // The per-sentence reading budget is the length channel of file-v1 (parity with json-v0's `maxChars`). Without it, the translator does not know the output is subtitles, and display width would inflate across the board.
        assert!(
            sent.contains("<p id=\"s-g2.0\" data-budget=\"整句≤7字\">delta echo.</p>"),
            "{sent}"
        );
        // §7.7: the file contract no longer attaches the fusion contract section.
        assert!(!sent.contains("sourceBreaks"));

        assert_eq!(outcome.translated_sentences, 3);
        let trans = &doc.trans["zh-Hans"];
        assert_eq!(trans["s-g1.0"], "一。");
        assert_eq!(trans["s-g3.0"], "三。");
        assert_eq!(doc.trans_src["zh-Hans"].len(), 3);
        assert!(pages >= 1);
    }

    #[test]
    fn file_contract_rejected_page_retries_whole_page() {
        let mut doc = three_sentence_doc();
        let mut llm = ScriptedBatchLlm::new(vec![
            // No expected sentence parsed ⇒ page-fatal, so the whole page is retried.
            vec![(0, Ok("好的，这是翻译：一。二。三。".to_owned()))],
            vec![(
                0,
                Ok(file_answer(&[
                    ("s-g1.0", "一。"),
                    ("s-g2.0", "二。"),
                    ("s-g3.0", "三。"),
                ])),
            )],
        ]);
        run_translate(
            &mut doc,
            &mut llm,
            &options("zh-Hans"),
            &mut |_| {},
            &mut |_| {},
        )
        .expect("retry succeeds");
        assert_eq!(doc.trans["zh-Hans"].len(), 3);
        let reason = llm.requests[1][0]
            .1
            .as_deref()
            .expect("second round carries a retry reason");
        assert!(reason.contains("document-wrapped"), "{reason}");
    }

    /// M4 end to end: `context.md` / `context.<lang>.md` → brief → the file-contract translate's `data-rt` → rejection when a locked translated term is missing → align's protected words and anchors.
    ///
    /// Asserting only that "locked=true after conversion" cannot prove the chain works. So this starts from the original Markdown and asserts all the way through to the engine actually rejecting the page.
    #[test]
    fn file_contract_terms_flow_from_context_md_into_translate_and_align() {
        let source_md = "---\nformat: \"context-doc/1\"\nfingerprint: \"fp\"\n---\n\n\
# Summary\nA product demo.\n\n\
# Canonical Terms\n| Source | Category | Variants | Note | Lock | Origin |\n\
|---|---|---|---|---|---|\n| Air | product | | 机型 | yes | user |\n";
        let target_md = "---\nformat: \"context-doc/1\"\ntargetLang: \"zh-Hans\"\nfingerprint: \"fp\"\n---\n\n\
# Translated Summary\n产品演示。\n\n\
# Bilingual Glossary\n| Source | Target | Note | Lock | Origin |\n\
|---|---|---|---|---|\n| Air | 空气 | 机型 | yes | user |\n\n\
# Translation Style\n短句。\n\n# Difficulties\n";
        let source = crate::filepipe::parse_source_context(None, source_md)
            .context
            .expect("source context parses");
        let target = crate::filepipe::parse_target_context(None, target_md)
            .context
            .expect("target context parses");
        let brief = crate::engines::brief::brief_from_target_context(&target, Some(&source));
        // Lock=yes → GlossaryEntry.locked. Category=product → named entity.
        assert!(brief.glossary[0].locked);
        assert_eq!(brief.named_entities, vec!["Air".to_owned()]);

        let mut doc = three_sentence_doc();
        doc.words[0].text = "Air".to_owned();
        let mut opts = options("zh-Hans");
        opts.brief = Some(brief.clone());

        // A missing locked translated term → all three attempts rejected.
        let miss = file_answer(&[("s-g1.0", "一。"), ("s-g2.0", "二。"), ("s-g3.0", "三。")]);
        let mut llm = ScriptedBatchLlm::new(vec![
            vec![(0, Ok(miss.clone()))],
            vec![(0, Ok(miss.clone()))],
            vec![(0, Ok(miss))],
        ]);
        let outcome = run_translate(&mut doc, &mut llm, &opts, &mut |_| {}, &mut |_| {})
            .expect("file contract degrades per line, not per run");
        // The file contract succeeds partially, line by line. The sentence that omitted a locked term is rejected even after its retries run out, so it is neither committed nor entered into the provenance ledger. The other sentences on the same page land as usual.
        assert!(!doc.trans["zh-Hans"].contains_key("s-g1.0"));
        assert!(!outcome.committed_sentences.contains("s-g1.0"));
        assert!(outcome.committed_sentences.contains("s-g2.0"));
        // rt is indeed delivered with the page.
        assert!(
            llm.requests[0][0].0.contains("data-rt="),
            "{}",
            llm.requests[0][0].0
        );
        assert!(
            llm.requests[0][0].0.contains("空气"),
            "{}",
            llm.requests[0][0].0
        );

        let mut llm = ScriptedBatchLlm::new(vec![vec![(
            0,
            Ok(file_answer(&[
                ("s-g1.0", "空气一。"),
                ("s-g2.0", "二。"),
                ("s-g3.0", "三。"),
            ])),
        )]]);
        run_translate(&mut doc, &mut llm, &opts, &mut |_| {}, &mut |_| {})
            .expect("locked target satisfied");
        assert_eq!(doc.trans["zh-Hans"]["s-g1.0"], "空气一。");

        // align side: protected words and bilingual anchors (the host injects them directly from the glossary) both receive the term.
        assert!(
            brief
                .protected_targets_for_fit("zh-Hans", TransParams::for_lang("zh-Hans").fit)
                .contains(&"空气".to_owned())
        );
        assert_eq!(brief.glossary[0].source, "Air");
        assert_eq!(brief.glossary[0].target, "空气");
    }

    #[test]
    fn file_contract_missing_sentence_goes_to_a_repair_wave() {
        let mut doc = three_sentence_doc();
        let mut llm = ScriptedBatchLlm::new(vec![
            // A middle sentence is missing. It is not a trailing contiguous omission, so it goes into the sentence-level repair wave as missing-id.
            vec![(
                0,
                Ok(file_answer(&[("s-g1.0", "一。"), ("s-g3.0", "三。")])),
            )],
            vec![(0, Ok(file_answer(&[("s-g2.0", "二。")])))],
        ]);
        run_translate(
            &mut doc,
            &mut llm,
            &options("zh-Hans"),
            &mut |_| {},
            &mut |_| {},
        )
        .expect("repair wave succeeds");
        assert_eq!(doc.trans["zh-Hans"].len(), 3);
        assert_eq!(doc.trans["zh-Hans"]["s-g2.0"], "二。");
        // The repair wave resends only the missing sentence.
        let repair = &llm.requests[1][0].0;
        assert!(repair.contains("id=\"s-g2.0\""), "{repair}");
        assert!(!repair.contains("id=\"s-g1.0\""), "{repair}");
    }

    #[test]
    fn file_contract_never_stamps_a_sentence_it_did_not_translate() {
        let mut doc = doc_with_words(vec![
            w("g1.0", 0.0, 0.4, "alpha", "s1"),
            w("g1.1", 0.4, 0.8, "bravo.", "s1"),
            w("g2.0", 1.0, 1.4, "charlie", "s1"),
            w("g2.1", 1.4, 1.8, "delta.", "s1"),
            w("g3.0", 2.0, 2.4, "echo", "s1"),
            w("g3.1", 2.4, 2.8, "foxtrot.", "s1"),
            w("g4.0", 3.0, 3.4, "golf", "s1"),
            w("g4.1", 3.4, 3.8, "hotel.", "s1"),
        ]);
        // Every wave omits one sentence, and none of the missing ones is a trailing contiguous omission (that would be a document-truncated page rejection). So s-g2.0 goes through to the cross-page residual wave and still fails there.
        let mut llm = ScriptedBatchLlm::new(vec![
            vec![(
                0,
                Ok(file_answer(&[("s-g1.0", "一。"), ("s-g4.0", "四。")])),
            )],
            vec![(0, Ok(file_answer(&[("s-g3.0", "三。")])))],
            vec![(0, Ok(file_answer(&[])))],
        ]);
        run_translate(
            &mut doc,
            &mut llm,
            &options("zh-Hans"),
            &mut |_| {},
            &mut |_| {},
        )
        .expect("residual failure is not a translation failure");
        // Wave 1 (whole page), wave 2 (in-page repair) and wave 3 (cross-page residual), one call each.
        assert_eq!(llm.requests.len(), 3);
        assert!(llm.requests[2][0].0.contains("id=\"s-g2.0\""));

        // Sentences that fail have neither a translation nor a fingerprint stamp. Stamping them would mean they are never selected as stale again.
        assert!(!doc.trans["zh-Hans"].contains_key("s-g2.0"));
        assert!(!doc.trans_src["zh-Hans"].contains_key("s-g2.0"));
        assert_eq!(doc.trans["zh-Hans"].len(), 3);
        assert_eq!(doc.trans_src["zh-Hans"].len(), 3);
    }

    /// §2.3: page-level exhaustion in wave 1 is **no longer** a hard error. The ladder is "whole page twice → each half once → the half-page's editable sentences go into the make-up wave". If no sentence is recovered at all, the command still succeeds, and the missing sentences are reported by `ccut check` as `translation-partial`.
    #[test]
    fn page_rejections_fall_through_to_the_unit_wave_without_failing_the_command() {
        let mut doc = three_sentence_doc();
        let garbage = || Ok("好的，这是翻译：一。二。三。".to_owned());
        let mut llm = ScriptedBatchLlm::new(vec![
            // Wave 1: two whole-page attempts.
            vec![(0, garbage())],
            vec![(0, garbage())],
            // Halve on narrowing: one attempt per half-page.
            vec![(0, garbage()), (1, garbage())],
            // Wave 2: the editable sentences still pending on the whole page.
            vec![(0, garbage())],
            // Wave 3: cross-page residuals.
            vec![(0, garbage())],
        ]);
        run_translate(
            &mut doc,
            &mut llm,
            &options("zh-Hans"),
            &mut |_| {},
            &mut |_| {},
        )
        .expect("page rejections are no longer a command failure");
        assert!(doc.trans.get("zh-Hans").is_none_or(BTreeMap::is_empty));
        assert_eq!(llm.requests.len(), 5);
        assert_eq!(llm.requests[2].len(), 2, "第三轮是两个半页");
    }

    /// After narrowing, when a half-page can be translated, that half is committed as usual. Only the half-pages that still fail go into the make-up wave.
    #[test]
    fn split_retry_saves_the_half_the_model_can_translate() {
        let mut doc = three_sentence_doc();
        let garbage = || Ok("好的，这是翻译：一。二。三。".to_owned());
        let mut llm = ScriptedBatchLlm::new(vec![
            vec![(0, garbage())],
            vec![(0, garbage())],
            // Half-page 1 (s-g1.0) was translated. Half-page 2 still gave off-target answers.
            vec![(0, Ok(file_answer(&[("s-g1.0", "一。")]))), (1, garbage())],
            // Wave 2: only the last two sentences remain.
            vec![(
                0,
                Ok(file_answer(&[("s-g2.0", "二。"), ("s-g3.0", "三。")])),
            )],
        ]);
        run_translate(
            &mut doc,
            &mut llm,
            &options("zh-Hans"),
            &mut |_| {},
            &mut |_| {},
        )
        .expect("split retry recovers what it can");
        assert_eq!(doc.trans["zh-Hans"].len(), 3);
        assert!(llm.requests[3][0].0.contains("id=\"s-g2.0\""));
        assert!(!llm.requests[3][0].0.contains("id=\"s-g1.0\""));
    }

    #[test]
    fn file_contract_freezes_fresh_sentences_for_context() {
        let mut doc = three_sentence_doc();
        // First make the middle sentence "fresh". If it has a translation and its fingerprint matches, it is not in this run's set to translate.
        let cues = derive_cues(&doc, &CueParams::default());
        let sentences = derive_sentences(&doc, &cues);
        let fresh = sentences
            .iter()
            .find(|sentence| sentence.id == "s-g2.0")
            .expect("middle sentence");
        doc.trans
            .entry("zh-Hans".to_owned())
            .or_default()
            .insert("s-g2.0".to_owned(), "既有译文。".to_owned());
        doc.trans_src
            .entry("zh-Hans".to_owned())
            .or_default()
            .insert("s-g2.0".to_owned(), fresh.src_fingerprint.clone());

        let mut llm = ScriptedBatchLlm::new(vec![vec![(
            0,
            Ok(file_answer(&[
                ("s-g1.0", "一。"),
                ("s-g2.0", "既有译文。"),
                ("s-g3.0", "三。"),
            ])),
        )]]);
        let outcome = run_translate(
            &mut doc,
            &mut llm,
            &options("zh-Hans"),
            &mut |_| {},
            &mut |_| {},
        )
        .expect("frozen context page");
        assert_eq!(outcome.translated_sentences, 2);
        assert_eq!(outcome.skipped_sentences, 1);

        let sent = &llm.requests[0][0].0;
        assert!(sent.contains("data-editable=\"false\""), "{sent}");
        assert!(sent.contains("data-translation=\"既有译文。\""), "{sent}");
        // Frozen sentences must be copied verbatim. Attaching a budget only induces the model to "tidy up" a translation that should not change. The assertion lands on the frozen sentence's own line, not on an attribute-order coincidence such as "data-editable immediately followed by data-budget". Otherwise, swapping the rendering order would silently disable the assertion.
        let frozen_line = sent
            .lines()
            .find(|line| line.contains("id=\"s-g2.0\""))
            .expect("frozen sentence renders on its own line");
        assert!(!frozen_line.contains("data-budget="), "{frozen_line}");
        // The other two sentences are both editable, and both carry the budget.
        assert_eq!(sent.matches("data-budget=").count(), 2, "{sent}");
        assert_eq!(doc.trans["zh-Hans"]["s-g2.0"], "既有译文。");
    }

    /// Length-channel regression for file-v1. json-v0 kept translation width in check with `maxChars` and each fused segment's per-row display limit. file-v1 early on had neither, and measured display width ran more than 10% higher across the board. The contract text describes only the nature of the constraint: the output is subtitles, with a per-sentence budget and a reverse guardrail. The specific numbers are carried per target language by the carrier's `data-budget`. So this also asserts that it does **not** hard-code one language's per-row character count.
    #[test]
    fn file_contract_prompt_states_the_subtitle_length_channel() {
        let body = TRANSLATE_FILE_PROMPT_BODY;
        assert!(body.contains("SUBTITLES"), "{body}");
        assert!(body.contains("data-budget"), "{body}");
        assert!(body.contains("reading-speed budget"), "{body}");
        assert!(body.contains("Prefer concise phrasing"), "{body}");
        // Reverse guardrail: length takes priority over compression.
        assert!(body.contains("never outranks meaning"), "{body}");
        assert!(body.contains("past data-budget"), "{body}");
        // Without a splitting channel, the model must not be induced to insert separators into sentences on its own.
        assert!(body.contains("or segmentation marks"), "{body}");
        // The per-row display limit varies by target language (CJK ≈16 cells, Latin ≈42 characters). Hard-coding either one in a constant prompt would lie to the other group of languages.
        assert!(!body.contains("16"), "{body}");
        assert!(!body.contains("42"), "{body}");
    }

    #[test]
    fn retry_reason_compacts_repeated_frozen_sentence_failures() {
        use crate::filepipe::{Problem, ProblemCode};

        let mut diagnostics = Diagnostics::new();
        for id in ["s-g1.0", "s-g2.0", "s-g3.0"] {
            diagnostics.push_problem(Problem::sentence(
                ProblemCode::FrozenModified,
                id,
                "冻结句被改动，绝不覆盖已有译文",
            ));
        }
        diagnostics.push_problem(Problem::sentence(
            ProblemCode::MissingId,
            "s-g4.0",
            "缺少句子 s-g4.0",
        ));

        assert_eq!(
            summarize_problems(&diagnostics),
            "frozen-modified: 冻结句被改动，绝不覆盖已有译文 (repeated 3 times); missing-id: 缺少句子 s-g4.0"
        );
    }

    #[test]
    /// §2.3: a frozen sentence being modified only records a Warning, and the page is still accepted as usual. The existing translation is kept as it was, and the whole page is no longer re-rolled because of it.
    fn file_contract_ignores_a_modified_frozen_sentence() {
        let mut doc = three_sentence_doc();
        let cues = derive_cues(&doc, &CueParams::default());
        let sentences = derive_sentences(&doc, &cues);
        let fresh = sentences
            .iter()
            .find(|sentence| sentence.id == "s-g2.0")
            .expect("middle sentence");
        doc.trans
            .entry("zh-Hans".to_owned())
            .or_default()
            .insert("s-g2.0".to_owned(), "既有译文。".to_owned());
        doc.trans_src
            .entry("zh-Hans".to_owned())
            .or_default()
            .insert("s-g2.0".to_owned(), fresh.src_fingerprint.clone());

        let mut llm = ScriptedBatchLlm::new(vec![vec![(
            0,
            Ok(file_answer(&[
                ("s-g1.0", "一。"),
                ("s-g2.0", "改写过的译文。"),
                ("s-g3.0", "三。"),
            ])),
        )]]);
        run_translate(
            &mut doc,
            &mut llm,
            &options("zh-Hans"),
            &mut |_| {},
            &mut |_| {},
        )
        .expect("a modified frozen sentence no longer rejects the page");
        assert_eq!(llm.requests.len(), 1, "不再有整页重试");
        assert_eq!(doc.trans["zh-Hans"]["s-g2.0"], "既有译文。");
        assert_eq!(doc.trans["zh-Hans"]["s-g1.0"], "一。");
    }

    #[test]
    fn file_contract_locked_glossary_target_drives_a_repair_wave() {
        let mut doc = three_sentence_doc();
        let mut opts = options("zh-Hans");
        opts.brief = Some(DocumentBrief {
            glossary: vec![crate::engines::brief::GlossaryEntry {
                source: "delta".to_owned(),
                target: "增量/差值".to_owned(),
                locked: true,
                note: None,
            }],
            ..Default::default()
        });
        let mut llm = ScriptedBatchLlm::new(vec![
            vec![(
                0,
                Ok(file_answer(&[
                    ("s-g1.0", "一。"),
                    ("s-g2.0", "德尔塔回声。"),
                    ("s-g3.0", "三。"),
                ])),
            )],
            vec![(0, Ok(file_answer(&[("s-g2.0", "增量/差值 回声。")])))],
        ]);
        run_translate(&mut doc, &mut llm, &opts, &mut |_| {}, &mut |_| {})
            .expect("glossary repair wave");
        let sent = &llm.requests[0][0].0;
        // Locked terms land in data-rt as a JSON array, so content containing `/` round-trips intact.
        assert!(
            sent.contains("data-rt=\"[&quot;增量/差值&quot;]\""),
            "{sent}"
        );
        assert!(doc.trans["zh-Hans"]["s-g2.0"].contains("增量/差值"));
    }

    #[test]
    fn file_contract_lint_mirrors_the_engine_validator() {
        let mut doc = three_sentence_doc();
        let mut llm = ScriptedBatchLlm::new(vec![vec![(
            0,
            Ok(file_answer(&[
                ("s-g1.0", "一。"),
                ("s-g2.0", "二。"),
                ("s-g3.0", "三。"),
            ])),
        )]]);
        run_translate(
            &mut doc,
            &mut llm,
            &options("zh-Hans"),
            &mut |_| {},
            &mut |_| {},
        )
        .expect("translate");
        let input = &llm.requests[0][0].0;

        assert!(
            lint_agent_answer_file(
                input,
                &file_answer(&[("s-g1.0", "一。"), ("s-g2.0", "二。"), ("s-g3.0", "三。")])
            )
            .is_empty()
        );
        let complaints = lint_agent_answer_file(
            input,
            &file_answer(&[("s-g1.0", "一。"), ("s-g3.0", "三。")]),
        );
        assert!(
            complaints.iter().any(|line| line.contains("missing-id")),
            "{complaints:?}"
        );
        // When the payload is not a translate carrier, lint passes silently (so legacy json-v0 tasks are not affected).
        assert!(lint_agent_answer_file("{\"lines\":[]}", "whatever").is_empty());
    }

    #[test]
    fn file_contract_budgets_are_declared_per_executor() {
        use crate::paging::{PageExecutor, budgets};
        // The two tiers are declared separately, and the host picks by executor. Both currently measure at 2000 (see paging.rs).
        assert_eq!(budgets::TRANSLATE_AGENT_WORDS, 2000);
        assert_eq!(budgets::TRANSLATE_PROVIDER_WORDS, 2000);
        assert_eq!(PageExecutor::Agent.translate_words(), 2000);
        assert_eq!(PageExecutor::Provider.translate_words(), 2000);
        assert!(fits_single_translate_page(66, 1200, 2000));
        // Within slack (10% of the budget) it still counts as a single page. Once that is exceeded, it is paginated.
        assert!(fits_single_translate_page(66, 2200, 2000));
        assert!(!fits_single_translate_page(66, 2201, 2000));
    }

    /// rows tier (`--align-fusion rows`): both executors share the smaller 1200-word budget. Rows cost about 1.6–2× per source word, and long pages make the model omit row markup for a whole page (measured: a 59-sentence page had only 3 sentences marked). So pages must be cut smaller.
    #[test]
    fn rows_mode_uses_a_smaller_translate_page_budget() {
        use crate::paging::{PageExecutor, budgets, page_count_for_total};
        assert_eq!(budgets::TRANSLATE_ROWS_WORDS, 800);
        assert_eq!(PageExecutor::Agent.translate_words_for(true), 800);
        assert_eq!(PageExecutor::Provider.translate_words_for(true), 800);
        // `translate_words()` remains the regular tier. `translate_words_for(false)` is equivalent to it.
        assert_eq!(PageExecutor::Agent.translate_words_for(false), 2000);
        assert_eq!(
            PageExecutor::Provider.translate_words_for(false),
            PageExecutor::Provider.translate_words()
        );

        // Slack is still 10% of the budget. The rows single-page cap is 880 words, and the regular tier is 2200 words.
        let rows = budgets::TRANSLATE_ROWS_WORDS;
        let plain = budgets::TRANSLATE_PROVIDER_WORDS;
        assert!(fits_single_translate_page(60, 880, rows));
        assert!(!fits_single_translate_page(60, 881, rows));
        // The same article: one page in the regular tier, two pages in the rows tier.
        assert!(fits_single_translate_page(66, 1526, plain));
        assert!(!fits_single_translate_page(66, 1526, rows));
        assert_eq!(page_count_for_total(1526, plain), 1);
        assert_eq!(page_count_for_total(1526, rows), 2);
        assert_eq!(page_count_for_total(1257, plain), 1);
        assert_eq!(page_count_for_total(1257, rows), 2);
        // A 30-minute conversation (about 3500 words): 2 pages in the regular tier, 4 pages in the rows tier.
        assert_eq!(page_count_for_total(3500, plain), 2);
        assert_eq!(page_count_for_total(3500, rows), 4);
    }

    /// An explicit `page_budget` is always the only basis for pagination, rows included.
    ///
    /// This is how the `CCUT_LLM_PAGE_WORDS` override takes effect on the engine side. The tier choice belongs to the host ([`crate::paging::PageExecutor::translate_words_for`]). The engine accepts only the number it is given, and never shrinks pages on its own just because `align_rows` is set.
    #[test]
    fn explicit_page_budget_always_wins_including_rows_mode() {
        // 100 sentences × 15 words = 1500 words. The rows tier (800 + 10% slack = 880) needs 2 pages, while the regular tier (2000 + slack = 2200) needs only 1.
        let mut words = Vec::new();
        let mut clock = 0.0f64;
        for sentence in 0..100 {
            for index in 0..15 {
                let text = if index == 14 {
                    "end.".to_owned()
                } else {
                    format!("word{index}")
                };
                words.push(w(
                    &format!("g{sentence}.{index}"),
                    clock,
                    clock + 0.3,
                    &text,
                    "s1",
                ));
                clock += 0.3;
            }
            clock += 0.8;
        }
        let doc = doc_with_words(words);
        let ids: Vec<String> = (0..100).map(|index| format!("s-g{index}.0")).collect();
        // The answer carries a qualifying row partition (one whole sentence per row). Otherwise it would trigger the rows whole-page missing-row soft resend, and the extra call would pollute the "page count = call count" criterion.
        let answer = rows_answer(&ids, "译文内容需要足够长。", 15);

        for (budget, expected_calls) in [(2000usize, 1usize), (800, 2)] {
            let mut doc = doc.clone();
            let mut options = options("zh");
            options.align = Some(TransParams::for_lang("zh"));
            options.align_rows = true;
            options.page_budget = budget;
            let mut llm = FakeLlm::new((0..4).map(|_| Ok::<_, LlmError>(answer.clone())));
            run_translate(&mut doc, &mut llm, &options, &mut |_| {}, &mut |_| {}).unwrap();
            assert_eq!(llm.calls.len(), expected_calls, "budget {budget}");
        }
    }

    /// The minimal qualifying row-partition answer: one row span per sentence, covering `1..word_count`.
    fn rows_answer(ids: &[String], text: &str, word_count: usize) -> String {
        let mut out = String::from("<article><section id=\"p-g0.0\">");
        for id in ids {
            out.push_str(&format!(
                "<p id=\"{id}\"><span data-src=\"1-{word_count}\">{text}</span></p>"
            ));
        }
        out.push_str("</section></article>");
        out
    }

    /// Soft resend for whole-page missing rows in rows mode. If the first answer is structurally complete and keeps only ids, with no span at all, the engine resends the page verbatim once and takes both the translation and the rows from the second answer. Bounded: at most once per page.
    #[test]
    fn a_rows_page_with_no_spans_is_resent_once_and_the_second_answer_wins() {
        let mut doc = rows_page_doc(12);
        let ids: Vec<String> = (0..12).map(|index| format!("s-g{index}.0")).collect();
        let plain = file_answer(
            &ids.iter()
                .map(|id| (id.as_str(), "第一次的译文内容。"))
                .collect::<Vec<_>>(),
        );
        let with_rows = rows_answer(&ids, "第二次的译文内容。", 10);
        let mut llm = FakeLlm::new([Ok(plain), Ok(with_rows)]);

        let mut options = options("zh");
        options.align = Some(TransParams::for_lang("zh"));
        options.align_rows = true;
        let outcome =
            run_translate(&mut doc, &mut llm, &options, &mut |_| {}, &mut |_| {}).unwrap();

        assert_eq!(llm.calls.len(), 2, "整页缺行必须重发一次");
        assert_eq!(outcome.rows_page_retries, 1);
        // On resend, retry_reason names "last time there were no rows at all".
        assert!(
            llm.calls[1]
                .3
                .as_deref()
                .is_some_and(|reason| reason.contains("NO display rows")),
            "{:?}",
            llm.calls[1].3
        );
        // Both the translation and the rows follow the second answer.
        assert_eq!(doc.trans["zh"]["s-g0.0"], "第二次的译文内容。");
        assert_eq!(outcome.alignment_drafts.len(), 12);
        assert!(outcome.alignment_drafts["s-g0.0"].rows);
    }

    /// If the second answer still gives no rows, there is no further resend (once per page). The second answer's translation is used as usual, and the sentence falls back to the dedicated align path as usual.
    #[test]
    fn a_rows_page_is_never_resent_more_than_once() {
        let mut doc = rows_page_doc(12);
        let ids: Vec<String> = (0..12).map(|index| format!("s-g{index}.0")).collect();
        let plain =
            |text: &str| file_answer(&ids.iter().map(|id| (id.as_str(), text)).collect::<Vec<_>>());
        let mut llm = FakeLlm::new([
            Ok(plain("第一次的译文内容。")),
            Ok(plain("第二次的译文内容。")),
        ]);

        let mut options = options("zh");
        options.align = Some(TransParams::for_lang("zh"));
        options.align_rows = true;
        let outcome =
            run_translate(&mut doc, &mut llm, &options, &mut |_| {}, &mut |_| {}).unwrap();

        assert_eq!(llm.calls.len(), 2, "最多重发一次");
        assert_eq!(outcome.rows_page_retries, 1);
        assert_eq!(doc.trans["zh"]["s-g0.0"], "第二次的译文内容。");
        assert!(outcome.alignment_drafts.is_empty(), "没有行 ⇒ 没有草稿");
    }

    /// When the whole page came back as a copy of the source (not translated into the target language), the make-up wave's request must say what went wrong last time and what the target language is. Resending verbatim would only get the same copy again.
    #[test]
    fn a_page_answered_in_the_source_language_is_asked_again_with_the_reason() {
        let mut doc = rows_page_doc(3);
        let source = "word0 word1 word2 word3 word4 word5 word6 word7 word8 end.";
        let copied = (1..=3)
            .map(|n| format!("{n} |word0..end.|{source}"))
            .collect::<Vec<_>>()
            .join("\n");
        let translated = (1..=3)
            .map(|n| format!("{n} |word0..end.|这一句的译文内容。"))
            .collect::<Vec<_>>()
            .join("\n");
        let mut llm = FakeLlm::new([Ok(copied), Ok(translated)]);

        let mut options = options("zh");
        options.align = Some(TransParams::for_lang("zh"));
        options.align_lines = true;
        run_translate(&mut doc, &mut llm, &options, &mut |_| {}, &mut |_| {}).unwrap();

        assert_eq!(llm.calls.len(), 2);
        assert_eq!(llm.calls[0].3, None);
        let reason = llm.calls[1]
            .3
            .as_deref()
            .expect("repair wave carries a reason");
        assert!(
            reason.starts_with("3 of the 3 sentences on this page")
                && reason.contains("not a translation into \"zh\""),
            "{reason}"
        );
        assert_eq!(doc.trans["zh"]["s-g0.0"], "这一句的译文内容。");
        assert_eq!(doc.trans["zh"].len(), 3);
    }

    /// Make-up for other reasons (here, a missing row) does not carry this reason.
    #[test]
    fn a_repair_wave_for_a_missing_line_carries_no_language_reason() {
        let mut doc = rows_page_doc(3);
        let line = |n: usize| format!("{n} |word0..end.|这一句的译文内容。");
        let mut llm = FakeLlm::new([Ok(format!("{}\n{}", line(1), line(2))), Ok(line(1))]);

        let mut options = options("zh");
        options.align = Some(TransParams::for_lang("zh"));
        options.align_lines = true;
        run_translate(&mut doc, &mut llm, &options, &mut |_| {}, &mut |_| {}).unwrap();

        assert_eq!(llm.calls.len(), 2);
        assert_eq!(llm.calls[1].3, None);
        assert_eq!(doc.trans["zh"].len(), 3);
    }

    /// A few unmarked sentences do not count as a "whole-page omission". The threshold is at least 3 sentences that requested rows, with at least 70% of them missing.
    #[test]
    fn a_page_where_most_sentences_carry_rows_is_not_resent() {
        let mut doc = rows_page_doc(12);
        let ids: Vec<String> = (0..12).map(|index| format!("s-g{index}.0")).collect();
        // 10 of 12 sentences gave rows (2 of 12 ≈ 17% missing, below 70%).
        let mut answer = String::from("<article><section id=\"p-g0.0\">");
        for (index, id) in ids.iter().enumerate() {
            if index < 10 {
                answer.push_str(&format!(
                    "<p id=\"{id}\"><span data-src=\"1-10\">这一句的译文内容。</span></p>"
                ));
            } else {
                answer.push_str(&format!("<p id=\"{id}\">这一句的译文内容。</p>"));
            }
        }
        answer.push_str("</section></article>");

        let mut llm = FakeLlm::new([Ok(answer)]);
        let mut options = options("zh");
        options.align = Some(TransParams::for_lang("zh"));
        options.align_rows = true;
        let outcome =
            run_translate(&mut doc, &mut llm, &options, &mut |_| {}, &mut |_| {}).unwrap();

        assert_eq!(llm.calls.len(), 1, "没到门槛就不该重发");
        assert_eq!(outcome.rows_page_retries, 0);
        assert_eq!(outcome.alignment_drafts.len(), 10);
    }

    /// `on` mode (non-rows) never triggers a missing-row resend, because that contract already allows having no draft.
    #[test]
    fn a_chunk_mode_page_without_spans_is_never_resent() {
        let mut doc = rows_page_doc(12);
        let ids: Vec<String> = (0..12).map(|index| format!("s-g{index}.0")).collect();
        let plain = file_answer(
            &ids.iter()
                .map(|id| (id.as_str(), "这一句的译文内容。"))
                .collect::<Vec<_>>(),
        );
        let mut llm = FakeLlm::new([Ok(plain)]);
        let mut options = options("zh");
        options.align = Some(TransParams::for_lang("zh"));
        options.align_rows = false;
        let outcome =
            run_translate(&mut doc, &mut llm, &options, &mut |_| {}, &mut |_| {}).unwrap();
        assert_eq!(llm.calls.len(), 1);
        assert_eq!(outcome.rows_page_retries, 0);
    }

    // ---- M5.2: `--align-fusion off` (design §20.4 ③) -------------------------

    /// With `off` (`align: None`), the translation prompt carries no `data-align-*` fusion microformat, and the system prompt no longer attaches the fusion contract section. This is exactly the observable form of a "shorter prompt".
    #[test]
    fn align_fusion_off_drops_the_microformat_from_the_prompt() {
        let mut doc = two_sentence_doc();
        doc.words[7].t1 = 8.0;
        doc.words[8].t0 = 8.2;
        doc.words[8].t1 = 8.6;
        let answer = file_answer(&[("s-g1.0", "第一段译文，第二段收尾。"), ("s-g2.0", "完成。")]);

        let mut on = options("zh-Hans");
        on.align = Some(TransParams::for_lang("zh-Hans"));
        let mut on_llm = FakeLlm::new([Ok(answer.clone())]);
        run_translate(&mut doc.clone(), &mut on_llm, &on, &mut |_| {}, &mut |_| {}).unwrap();
        let (_, on_system, on_user, _) = &on_llm.calls[0];
        assert!(on_user.contains("data-align-words="), "{on_user}");
        assert!(on_system.contains("Fused block alignment"), "{on_system}");

        let mut off_llm = FakeLlm::new([Ok(answer)]);
        run_translate(
            &mut doc,
            &mut off_llm,
            &options("zh-Hans"),
            &mut |_| {},
            &mut |_| {},
        )
        .unwrap();
        let (_, off_system, off_user, _) = &off_llm.calls[0];
        assert!(!off_user.contains("data-align-"), "{off_user}");
        // When fusion is off, no reminder is appended to the end of the payload either.
        assert!(!off_user.contains("Reminder:"), "{off_user}");
        assert!(on_user.contains("Reminder: answer with"), "{on_user}");
        // Read-only attributes may all be omitted. Both modes' contracts say explicitly "OMIT every other attribute".
        assert!(
            on_system.contains("OMIT every other attribute"),
            "{on_system}"
        );
        assert!(
            off_system.contains("OMIT every other attribute"),
            "{off_system}"
        );
        assert!(
            !off_system.contains("Fused block alignment"),
            "{off_system}"
        );
        assert!(off_system.len() < on_system.len());
    }

    /// With `off`, parsing still accepts answers that carry microformats. Extra `<span data-src>` is treated only as translation text. It does not reject the page or drop any sentence, since toggling a switch should not void a whole answer.
    #[test]
    fn align_fusion_off_still_parses_answers_that_carry_the_microformat() {
        let mut doc = two_sentence_doc();
        let mut llm = FakeLlm::new([Ok(String::from(
            "<article><section id=\"p-g1.0\">\
             <p id=\"s-g1.0\"><span data-src=\"1-5\">第一段译文，</span><span data-src=\"6-9\">第二段收尾。</span></p>\
             <p id=\"s-g2.0\">完成。</p></section></article>",
        ))]);

        let outcome =
            run_translate(&mut doc, &mut llm, &options("zh"), &mut |_| {}, &mut |_| {}).unwrap();

        assert_eq!(outcome.translated_sentences, 2);
        assert_eq!(doc.trans["zh"]["s-g1.0"], "第一段译文，第二段收尾。");
        assert_eq!(doc.trans["zh"]["s-g2.0"], "完成。");
        // The fusion channel is off ⇒ this draft is not trusted.
        assert!(outcome.alignment_drafts.is_empty());
    }

    /// Agent-side mirror for the case where read-only attributes may be omitted. A rows payload plus an answer that keeps only ids must pass submit-time lint, and the page reconstructed from the payload must still yield a qualifying row partition. The `data-align-*` attributes in answers have never been read by anyone. Omitting them is the recommended form, and they were measured to be more than half of provider output.
    #[test]
    fn rows_answers_that_keep_only_ids_pass_the_agent_submit_lint() {
        let mut doc = two_sentence_doc();
        doc.words[7].t1 = 8.0;
        doc.words[8].t0 = 8.2;
        doc.words[8].t1 = 8.6;
        let mut options = options("zh");
        options.align = Some(TransParams::for_lang("zh"));
        options.align_rows = true;
        let mut llm = FakeLlm::new([Ok(file_answer(&[
            ("s-g1.0", "第一段译文需要自然对应，第二段译文负责完整收尾。"),
            ("s-g2.0", "完成。"),
        ]))]);
        run_translate(&mut doc, &mut llm, &options, &mut |_| {}, &mut |_| {}).unwrap();
        let payload = llm.calls[0].2.clone();
        assert!(payload.contains("data-align-groups="), "{payload}");
        assert!(payload.contains("Reminder: answer with"), "{payload}");

        // The answer keeps only ids and row spans, and echoes no other attribute.
        let answer = "<article><section id=\"p-g1.0\">\
             <p id=\"s-g1.0\"><span data-src=\"1-5\">第一段译文需要自然对应，</span>\
             <span data-src=\"6-8\">第二段译文负责完整收尾。</span></p>\
             <p id=\"s-g2.0\">完成。</p></section></article>";
        assert!(!answer.contains("data-align-words"), "{answer}");
        assert!(
            lint_agent_answer_file(&payload, answer).is_empty(),
            "{:?}",
            lint_agent_answer_file(&payload, answer)
        );

        // The reconstructed page plus the same answer still yield a qualifying row partition.
        let page = parse_translate_source(&payload).expect("translate carrier");
        let parsed = parse_translate_page(&page, Some(&payload), answer);
        assert!(
            parsed.diagnostics.problems.is_empty(),
            "{:?}",
            parsed.diagnostics
        );
        assert!(parsed.alignments["s-g1.0"].rows);
    }

    /// The same thing on the agent path: submit-time lint (`lint_agent_answer_file`) must also accept a fusion-off payload with an answer that carries microformats. The two paths of the translation alignment contract share the same string-level validation, and each is covered once here.
    #[test]
    fn align_fusion_off_answers_with_spans_pass_the_agent_submit_lint() {
        let mut doc = two_sentence_doc();
        doc.words[7].t1 = 8.0;
        doc.words[8].t0 = 8.2;
        doc.words[8].t1 = 8.6;
        let mut llm = FakeLlm::new([Ok(file_answer(&[
            ("s-g1.0", "第一段译文，第二段收尾。"),
            ("s-g2.0", "完成。"),
        ]))]);
        run_translate(&mut doc, &mut llm, &options("zh"), &mut |_| {}, &mut |_| {}).unwrap();
        let payload = llm.calls[0].2.clone();
        assert!(!payload.contains("data-align-"), "{payload}");

        let with_spans = "<article><section id=\"p-g1.0\">\
             <p id=\"s-g1.0\"><span data-src=\"1-5\">第一段译文，</span><span data-src=\"6-9\">第二段收尾。</span></p>\
             <p id=\"s-g2.0\">完成。</p></section></article>";
        assert!(
            lint_agent_answer_file(&payload, with_spans).is_empty(),
            "{:?}",
            lint_agent_answer_file(&payload, with_spans)
        );
    }
}
