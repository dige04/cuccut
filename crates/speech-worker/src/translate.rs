//! Translation of one transcript (architecture design §7.9): brief → paged translation → quality check and repair → alignment → row-sticking tail → time projection of target-language subtitles → write-out.
//!
//! The orchestration is ported from `translate_cmd_core` in v2 `ccut-engine/src/flows/translate.rs`, taking its default profile: no full-text analysis,
//! the target-direction brief is skipped when it fits on a single page and has no terms, fused draft `rows`, alignment with `manyToOne` + block alignment edges, density `auto`, one repair round for the main alignment, the row-sticking tail round,
//! and automatic correction of Chinese punctuation. By default every run produces a fresh translation (§7.9), so the target-language slot starts empty (checkpoints excepted).
//!
//! In-place refresh (input carries `translation` and `sentences`): the base draft is read into the target-language slot, and only the named sentences are re-translated. Alignment and the row-sticking tail also touch only those sentences, and no target-direction brief is run. On write-back the base draft governs (unit IDs, order, review status and extension fields are kept as they are), and `sourceBasis` is replaced with this run's source text.
//!
//! All outputs are written to staging: `translation.json` (the `cuccut.translation/2` body, written out via speech-doc-bridge), `cues.json` (target-language subtitles),
//! `report.json` (statistics and hints). The Worker does not write to the video directory; the Runtime writes it through VideoEngine after validating it.

use std::cell::RefCell;
use std::collections::BTreeSet;
use std::path::Path;
use std::rc::Rc;

use serde_json::{Value, json};
use speech_doc::TranscriptDoc;
use speech_doc::align_block::AlignDensity;
use speech_doc::atomize::word_count;
use speech_doc::cue::derive_cues;
use speech_doc::doc::AlignMode;
use speech_doc::engines::align::{AlignOptions, BilingualAnchor, FusionDrafts, run_align_with_drafts_and_artifacts};
use speech_doc::engines::brief::{DocumentBrief, TranslationBriefOptions, brief_from_target_context, run_translation_brief_file_contract};
use speech_doc::engines::translate::{TranslateOptions, fits_single_translate_page, run_translate_with_artifacts};
use speech_doc::filepipe::{BilingualTerm, TargetContext, TermOrigin};
use speech_doc::fingerprint::{fingerprint, fingerprint_strings};
use speech_doc::layout_profile::cue_params_for_doc;
use speech_doc::llm::LlmError;
use speech_doc::paging::budgets;
use speech_doc::sentence::{Sentence, derive_sentences};
use speech_doc::split::{TransCue, TransParams, derive_trans_cues, primary_subtag};
use speech_doc::translate_flow::plan_row_repair_tail;
use speech_doc_bridge::time::seconds_to_ticks;
use speech_doc_bridge::{MediaFacts, V3Documents, WriteBase, from_transcript_doc, to_transcript_doc};
use video_model::translation::{SourceBasis, TranslationBody};

use crate::Failure;
use crate::checkpoint::{Checkpoints, Phase, TranslateCheckpoint};
use crate::input::TranslateInput;
use crate::llm::StdioLlm;
use crate::protocol::{Control, event};

pub const TRANSLATION_FILE: &str = "translation.json";
pub const CUES_FILE: &str = "cues.json";
pub const REPORT_FILE: &str = "report.json";
pub const CUES_SCHEMA: &str = "cuccut.speech-worker.cues/1";
// The rule names and `editViewHash` use the bridge's copy: the UI and Node compute the same thing via `bindings/editor-wasm`.
pub use speech_doc_bridge::sentences::{SENTENCE_DERIVATION, edit_view_hash};

/// Runs one translation. `Ok` is the result of the `translate` request.
pub fn run(input_path: &Path, staging: &Path, control: Rc<RefCell<Control>>) -> Result<Value, Failure> {
    let input = TranslateInput::load(input_path)?;
    std::fs::create_dir_all(staging).map_err(|error| Failure::new("STAGING_WRITE_FAILED", format!("建不了 staging：{error}")))?;
    let lang = input.target_language.clone();
    let media = MediaFacts {
        asset_id: input.media.asset_id.clone(),
        path: input.media.path.clone(),
        content_hash: input.media.content_hash.clone(),
        duration: input.media.duration.clone(),
        sample_rate: input.media.sample_rate,
    };
    let base = input.translation.as_slice();
    let mut doc = to_transcript_doc(&V3Documents {
        media: &media,
        language: input.source_language.as_deref(),
        speech: &input.speech,
        translations: base,
    })
    .map_err(|error| Failure::new("INPUT_UNREADABLE", format!("转写读不进字幕与翻译核心：{error}")))?;
    if primary_subtag(&lang) == primary_subtag(&doc.lang) {
        return Err(Failure::new(
            "INVALID_PARAMS",
            format!("源语言 {} 与目标语言 {lang} 相同，没有发出翻译请求", doc.lang),
        ));
    }
    let cues = derive_cues(&doc, &cue_params_for_doc(&doc));
    let sentences = derive_sentences(&doc, &cues);
    if sentences.is_empty() {
        return Err(Failure::new("INPUT_UNREADABLE", "转写里没有可翻译的句子"));
    }
    let total = sentences.len();
    // Sentences for an in-place refresh; `None` means a whole new translation.
    let targets: Option<BTreeSet<String>> = input.sentences.as_ref().map(|ids| ids.iter().cloned().collect());
    if let Some(targets) = &targets
        && let Some(unknown) = targets.iter().find(|id| !sentences.iter().any(|sentence| &sentence.id == *id))
    {
        return Err(Failure::new("INPUT_UNREADABLE", format!("要重译的句子 {unknown} 不在转写里")));
    }
    // Progress denominator: during a refresh it is the number of sentences to re-translate. Per-page progress only makes sense for a whole new translation.
    let goal = targets.as_ref().map_or(total, BTreeSet::len);

    let instructions = input.params.instructions.clone().filter(|value| !value.trim().is_empty());
    let checkpoints = Checkpoints::new(staging, checkpoint_key(&doc, &input, instructions.as_deref()));
    let resumed = checkpoints.load();
    let resumed_from = resumed.as_ref().map(|checkpoint| (checkpoint.phase, checkpoint.trans.len()));
    let mut checkpoint = resumed.unwrap_or_default();
    checkpoint.restore(&mut doc, &lang);
    if let Some((phase, translated)) = resumed_from {
        event(
            "resumed",
            json!({ "phase": phase, "translatedSentences": translated, "totalSentences": goal }),
        );
    }

    let backoff = input.params.backoff_scale;
    let sleep_control = control.clone();
    let mut sleep = move |seconds: f64| sleep_control.borrow_mut().sleep(seconds * backoff);
    let mut llm = StdioLlm::new(control.clone());
    let params = TransParams::for_delivery(&lang, None);
    let translate_budget = budgets::TRANSLATE_ROWS_WORDS;
    let mut report = Report::default();

    // Target-direction brief: settled only the first time. Resumed runs reuse the one in the checkpoint.
    if checkpoint.phase == Phase::Brief {
        progress("brief", 0, goal);
        let seed = glossary_context(&doc, &input, &lang);
        // Refreshing a few sentences is not worth a whole new brief: terms are reused, and context comes from the adjacent translated sentences frozen into the translate page being sent.
        let skip = targets.is_some() || brief_skippable_for_single_page(&sentences, translate_budget);
        let from_seed = |seed: &Option<TargetContext>| seed.as_ref().map(|context| brief_from_target_context(context, None));
        checkpoint.brief = if skip {
            report.brief = "skipped";
            from_seed(&seed)
        } else {
            let options = TranslationBriefOptions {
                source_lang: &doc.lang,
                target_lang: &lang,
                analysis: None,
                instructions: instructions.as_deref(),
                reference_context: None,
                tone: None,
            };
            match run_translation_brief_file_contract(&doc, &mut llm, &options, None, seed.as_ref(), &mut sleep, &mut |_| {}) {
                Ok(context) => {
                    report.brief = "generated";
                    Some(brief_from_target_context(&context, None))
                }
                Err(error @ (LlmError::Terminal(_) | LlmError::Cancelled)) => return Err(stopped(error, &llm, &control, &checkpoint)),
                Err(error) => {
                    report.brief = "degraded";
                    report.advisories.push(format!("译向简报没有生成，按没有简报翻译：{error}"));
                    from_seed(&seed)
                }
            }
        };
        checkpoint.phase = Phase::Translating;
        checkpoint.capture(&doc, &lang, false);
        checkpoints.save(&checkpoint, total)?;
    } else {
        report.brief = "resumed";
    }
    let brief = checkpoint.brief.clone();

    let mut drafts = FusionDrafts::new();
    let mut wrote_this_round = matches!(resumed_from, Some((Phase::Aligned, _)));
    if checkpoint.phase == Phase::Translating {
        let options = TranslateOptions {
            source_lang: doc.lang.clone(),
            lang: lang.clone(),
            force: false,
            sentences: targets.clone(),
            page_budget: translate_budget,
            instructions: instructions.clone(),
            analysis: None,
            brief: brief.clone(),
            tone: None,
            autocorrect: true,
            align: Some(params),
            align_rows: true,
            align_lines: false,
            worker_slots: None,
            provenance_stale: BTreeSet::new(),
        };
        let already = if targets.is_some() {
            0
        } else {
            doc.trans.get(&lang).map_or(0, |table| table.len().min(total))
        };
        progress("translate", already, goal);
        let per_page = targets.is_none();
        let mut save_failure: Option<Failure> = None;
        let result = {
            let checkpoint = &mut checkpoint;
            let checkpoints = &checkpoints;
            let save_failure = &mut save_failure;
            let lang = lang.as_str();
            run_translate_with_artifacts(
                &mut doc,
                &mut llm,
                &options,
                &mut |doc| {
                    // After each page: save the checkpoint, then report progress. If it cannot be saved, stop before the next model call.
                    checkpoint.pages += 1;
                    checkpoint.capture(doc, lang, false);
                    if save_failure.is_none() {
                        match checkpoints.save(checkpoint, total) {
                            Ok(()) => {
                                let done = checkpoint.trans.len().min(total);
                                event(
                                    "checkpoint",
                                    json!({ "phase": "translating", "pages": checkpoint.pages, "translatedSentences": done }),
                                );
                                if per_page {
                                    progress("translate", done, total);
                                }
                            }
                            Err(failure) => *save_failure = Some(failure),
                        }
                    }
                },
                &mut |_| {},
                &mut sleep,
            )
        };
        if let Some(failure) = save_failure {
            return Err(failure);
        }
        let outcome = result.map_err(|error| stopped(error, &llm, &control, &checkpoint))?;
        if !outcome.missing_sentences.is_empty() {
            return Err(Failure::with_details(
                "MODEL_OUTPUT_INVALID",
                format!(
                    "{} 句送翻之后没有拿到合格的译文；已完成的页保留在检查点里，重试只补这些句子",
                    outcome.missing_sentences.len()
                ),
                json!({ "missingSentences": outcome.missing_sentences, "translatedSentences": checkpoint.trans.len() }),
            ));
        }
        report.translated_this_run = outcome.translated_sentences;
        if targets.is_some() {
            progress("translate", goal, goal);
        }
        report.rows_page_retries = outcome.rows_page_retries;
        wrote_this_round = outcome.translated_sentences > 0;
        drafts = outcome.alignment_drafts;
    }

    let align_options = AlignOptions {
        lang: lang.clone(),
        mode: AlignMode::ManyToOne,
        params: Some(params),
        protected_terms: brief
            .as_ref()
            .map(|brief| brief.protected_targets_for_fit(&lang, params.fit))
            .unwrap_or_default(),
        bilingual_anchors: brief.as_ref().map(bilingual_anchors).unwrap_or_default(),
        page_budget: budgets::ALIGN_PROVIDER_WORDS,
        repair_calls: 1,
        ..AlignOptions::default()
    };
    if checkpoint.phase == Phase::Translating {
        progress("align", 0, goal);
        // On refresh, only the re-translated sentences are aligned (their translations have all changed, so existing splits are all redone). The alignment of other sentences is left alone.
        let main = AlignOptions {
            sentences: targets.clone(),
            force: targets.is_some(),
            ..align_options.clone()
        };
        let outcome = run_align_with_drafts_and_artifacts(&mut doc, &mut llm, &main, &drafts, &mut |_| {}, &mut sleep)
            .map_err(|error| stopped(error, &llm, &control, &checkpoint))?;
        wrote_this_round |= outcome.aligned_sentences > 0;
        report.align = json!({
            "alignedSentences": outcome.aligned_sentences,
            "prealignedSentences": outcome.prealigned_sentences,
            "rewrittenSentences": outcome.rewritten_sentences,
            "sentenceLevelSentences": outcome.sentence_level_sentences,
            "fallbackSentences": outcome.fallback_sentences,
            "skippedSentences": outcome.skipped_sentences,
            "rowsMerged": outcome.rows_merged,
        });
        report
            .advisories
            .extend(outcome.violations.iter().map(|violation| format!("对齐：{violation}")));
        checkpoint.phase = Phase::Aligned;
        checkpoint.capture(&doc, &lang, true);
        checkpoints.save(&checkpoint, total)?;
        event(
            "checkpoint",
            json!({ "phase": "aligned", "pages": checkpoint.pages, "translatedSentences": checkpoint.trans.len() }),
        );
    }

    // Row-sticking tail round: when one translation is pinned to multiple source subtitle lines, re-split once in a targeted way by paired density (a fixed single round, with no repair budget).
    if checkpoint.phase == Phase::Aligned {
        if let Ok(plan) = plan_row_repair_tail(
            &doc,
            &sentences,
            &cues,
            &lang,
            false,
            AlignDensity::Auto,
            wrote_this_round,
            targets.as_ref(),
        ) {
            progress("row-repair", 0, plan.keys.len());
            let tail = AlignOptions {
                density: AlignDensity::Paired,
                density_sentences: plan.density_sentences.clone(),
                sentences: Some(plan.keys.clone()),
                targeted: true,
                force: true,
                repair_calls: 0,
                ..align_options.clone()
            };
            let outcome = run_align_with_drafts_and_artifacts(&mut doc, &mut llm, &tail, &FusionDrafts::new(), &mut |_| {}, &mut sleep)
                .map_err(|error| stopped(error, &llm, &control, &checkpoint))?;
            report.row_repair = json!({
                "candidates": outcome.row_repair.candidates,
                "repaired": outcome.row_repair.repaired,
                "rejected": outcome.row_repair.rejected,
                "capped": outcome.row_repair.capped,
            });
            report
                .advisories
                .extend(outcome.violations.iter().map(|violation| format!("黏结收尾：{violation}")));
        }
        checkpoint.phase = Phase::Finished;
        checkpoint.capture(&doc, &lang, true);
        checkpoints.save(&checkpoint, total)?;
        event(
            "checkpoint",
            json!({ "phase": "finished", "pages": checkpoint.pages, "translatedSentences": checkpoint.trans.len() }),
        );
    }

    progress("write", total, total);
    let basis = SourceBasis {
        speech_ref: input.speech_ref.clone(),
        sequence_id: input.sequence_id.clone(),
        scope_lineage: Vec::new(),
        edit_view_hash: edit_view_hash(&sentences),
        extra: Default::default(),
    };
    let written = from_transcript_doc(
        &doc,
        &WriteBase {
            speech: Some(&input.speech),
            translations: base,
            source_basis: Some(&basis),
        },
    )
    .map_err(|error| Failure::new("MODEL_OUTPUT_INVALID", format!("译文写不回 v3 的格式：{error}")))?;
    let mut body: TranslationBody = written
        .translations
        .into_iter()
        .find(|body| body.language == lang)
        .ok_or_else(|| Failure::new("MODEL_OUTPUT_INVALID", "没有得到目标语言的译文"))?;
    // The base draft keeps its own sourceBasis (the bridge's rule); what is written here is the source text read this time. glossaryRef records the terms in effect when the whole translation was translated, and refreshing a few sentences does not change it.
    body.source_basis = basis;
    if input.translation.is_none() {
        body.glossary_ref = input.glossary_ref.clone();
    }

    let timescale = input.speech.timescale.filter(|value| *value > 0).unwrap_or(1_000_000);
    let duration = media_seconds(&input).map_err(|message| Failure::new("INPUT_UNREADABLE", message))?;
    let stream = derive_trans_cues(&doc, &sentences, &lang);
    let target_cues = project_cues(&stream, &body, timescale, duration)?;

    write_json(staging, TRANSLATION_FILE, &serde_json::to_value(&body).expect("译文正文可以序列化"))?;
    write_json(
        staging,
        CUES_FILE,
        &json!({ "schema": CUES_SCHEMA, "language": lang, "timescale": timescale, "cues": target_cues }),
    )?;
    let report_value = json!({
        "targetLanguage": lang,
        "sourceLanguage": doc.lang,
        "sentenceDerivation": SENTENCE_DERIVATION,
        "totalSentences": total,
        "mode": if targets.is_some() { "refresh" } else { "full" },
        "targetSentences": goal,
        "unitCount": body.units.len(),
        "translatedThisRun": report.translated_this_run,
        "resumed": resumed_from.map(|(phase, translated)| json!({ "phase": phase, "translatedSentences": translated })),
        "brief": report.brief,
        "glossaryTerms": brief.as_ref().map_or(0, |brief| brief.glossary.len()),
        "pages": checkpoint.pages,
        "rowsPageRetries": report.rows_page_retries,
        "align": report.align,
        "rowRepair": report.row_repair,
        "llmCalls": llm.calls,
        "cueCount": target_cues.len(),
        "advisories": report.advisories,
    });
    write_json(staging, REPORT_FILE, &report_value)?;
    Ok(json!({
        "translation": TRANSLATION_FILE,
        "cues": CUES_FILE,
        "report": REPORT_FILE,
        "unitCount": body.units.len(),
        "cueCount": target_cues.len(),
        "llmCalls": llm.calls,
    }))
}

#[derive(Default)]
struct Report {
    brief: &'static str,
    translated_this_run: usize,
    rows_page_retries: usize,
    align: Value,
    row_repair: Value,
    advisories: Vec<String>,
}

fn progress(stage: &str, done: usize, total: usize) {
    event("progress", json!({ "stage": stage, "done": done, "total": total }));
}

/// The core exits by termination or cancellation. Reports the error given by the Runtime (budget, authorization, stop barrier, ...); the checkpoint is kept.
fn stopped(error: LlmError, llm: &StdioLlm, control: &Rc<RefCell<Control>>, checkpoint: &TranslateCheckpoint) -> Failure {
    let details = json!({ "phase": checkpoint.phase, "translatedSentences": checkpoint.trans.len(), "pages": checkpoint.pages });
    if let Some(reply) = &llm.terminal {
        let code = if reply.code.is_empty() {
            "PROVIDER_REJECTED"
        } else {
            reply.code.as_str()
        };
        return Failure::with_details(code, reply.message.clone(), details);
    }
    match error {
        LlmError::Cancelled => {
            let message = if control.borrow().closed() {
                "stdin 已关闭，停在这里"
            } else {
                "已取消"
            };
            Failure::with_details("CANCELLED", message, details)
        }
        LlmError::Terminal(message) => Failure::with_details("PROVIDER_REJECTED", message, details),
        // Retryable failures have used up the core's retry count.
        LlmError::Http { status, message } => Failure::with_details(
            "PROVIDER_UNAVAILABLE",
            message,
            json!({ "status": status, "phase": checkpoint.phase, "translatedSentences": checkpoint.trans.len() }),
        ),
        LlmError::Malformed(message) => Failure::with_details("MODEL_OUTPUT_INVALID", message, details),
    }
}

/// Checkpoint fingerprint: the word stream, the target language, and the frozen parameters that affect the translation (style hint, terms; during a refresh also the base draft and the sentences to re-translate). If any of them changes,
/// the old checkpoint is voided.
fn checkpoint_key(doc: &TranscriptDoc, input: &TranslateInput, instructions: Option<&str>) -> String {
    let mut settings = vec![format!("instructions={}", instructions.unwrap_or_default())];
    if let (Some(base), Some(sentences)) = (&input.translation, &input.sentences) {
        settings.push(format!("base={}", serde_json::to_string(base).expect("译文正文可以序列化")));
        settings.push(format!("sentences={}", sentences.join("\u{1f}")));
    }
    for term in &input.glossary {
        settings.push(format!(
            "term={}\u{1f}{}\u{1f}{}",
            term.source,
            term.target,
            term.note.as_deref().unwrap_or_default()
        ));
    }
    format!(
        "{}|{}|{}",
        fingerprint(&doc.words),
        input.target_language,
        fingerprint_strings(&settings)
    )
}

/// Frozen terms are passed as user lines in the target-language context (`Origin=user`, not locked). The brief keeps their target-language renderings, and when there is no brief they become the translation's glossary directly.
fn glossary_context(doc: &TranscriptDoc, input: &TranslateInput, lang: &str) -> Option<TargetContext> {
    let glossary: Vec<BilingualTerm> = input
        .glossary
        .iter()
        .filter(|term| !term.source.trim().is_empty() && !term.target.trim().is_empty())
        .map(|term| BilingualTerm {
            source: term.source.trim().to_owned(),
            target: term.target.trim().to_owned(),
            note: term.note.clone().unwrap_or_default(),
            locked: false,
            origin: TermOrigin::User,
        })
        .collect();
    (!glossary.is_empty()).then(|| TargetContext {
        target_lang: lang.to_owned(),
        fingerprint: fingerprint(&doc.words),
        analysis_fingerprint: None,
        instructions_fingerprint: None,
        tone: None,
        summary: String::new(),
        glossary,
        style: String::new(),
        difficulties: Vec::new(),
    })
}

/// A single-page document skips the target-direction brief (v2 `brief_skippable_for_single_page`; analysis is not run, so the only check is whether it fits on one page).
fn brief_skippable_for_single_page(sentences: &[Sentence], page_budget: usize) -> bool {
    let words: usize = sentences.iter().map(|sentence| word_count(&sentence.source_text)).sum();
    fits_single_translate_page(sentences.len(), words, page_budget)
}

fn bilingual_anchors(brief: &DocumentBrief) -> Vec<BilingualAnchor> {
    brief
        .glossary
        .iter()
        .filter(|entry| !entry.source.trim().is_empty() && !entry.target.trim().is_empty())
        .map(|entry| BilingualAnchor {
            source: entry.source.clone(),
            target: entry.target.clone(),
        })
        .collect()
}

fn media_seconds(input: &TranslateInput) -> Result<f64, String> {
    let duration = &input.media.duration;
    let ticks: f64 = duration.ticks.parse::<i64>().map_err(|_| "素材时长的 ticks 不是整数".to_owned())? as f64;
    if duration.timescale <= 0 {
        return Err("素材时长的 timescale 应为正数".into());
    }
    Ok(ticks / duration.timescale as f64)
}

/// Projects target-language subtitles onto the transcript's timeline: times are rounded, clamped within the media duration, sorted by time and non-overlapping. Any cue left with zero length after rounding is dropped.
fn project_cues(stream: &[TransCue], body: &TranslationBody, timescale: i64, duration: f64) -> Result<Vec<Value>, Failure> {
    let unit_of = |sentence_id: &str| {
        body.units
            .iter()
            .find(|unit| unit.source_sentence_id == sentence_id)
            .map(|unit| unit.id.clone())
    };
    let to_ticks = |seconds: f64| {
        seconds_to_ticks(seconds.clamp(0.0, duration.max(0.0)), timescale)
            .map(|rounded| rounded.ticks)
            .map_err(|error| Failure::new("MODEL_OUTPUT_INVALID", format!("字幕时间换不成刻度：{error}")))
    };
    let mut ordered: Vec<&TransCue> = stream.iter().collect();
    ordered.sort_by(|a, b| a.start.total_cmp(&b.start).then(a.end.total_cmp(&b.end)));
    let mut out = Vec::with_capacity(ordered.len());
    let mut previous_end = 0_i64;
    for cue in ordered {
        let text = cue.text.trim();
        if text.is_empty() {
            continue;
        }
        let start = to_ticks(cue.start)?.max(previous_end);
        let end = to_ticks(cue.end)?;
        if end <= start {
            continue;
        }
        previous_end = end;
        out.push(json!({
            "unitId": unit_of(&cue.sentence_id),
            "sentenceId": cue.sentence_id,
            "text": text,
            "start": start,
            "end": end,
            "fallback": cue.fallback,
        }));
    }
    Ok(out)
}

fn write_json(staging: &Path, name: &str, value: &Value) -> Result<(), Failure> {
    let path = staging.join(name);
    let tmp = path.with_extension("json.tmp");
    let bytes = serde_json::to_vec(value).expect("JSON 可以序列化");
    std::fs::write(&tmp, bytes)
        .and_then(|()| std::fs::rename(&tmp, &path))
        .map_err(|error| Failure::new("STAGING_WRITE_FAILED", format!("{name} 写不进 staging：{error}")))
}
