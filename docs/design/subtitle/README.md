> Ported from CucCut v2. Data model names in this document (TranscriptDoc, etc.) refer to the v2 models. For how they map to the v3 document model, see [Architecture design §14](../../architecture/architecture-design.md#14-items-pending-review).

# docs/design/subtitle/ — Subtitle AI pipeline

The subtitle pipeline that runs after transcription: the Transcript data model; the polish, segmentation, chaptering, translation and alignment stages; the LLM exchange contract and acceptance. Core invariants (`words[]` is the single source of truth, the two layers `trans` / `transAlign`, translation alignment fixes the translated Cue first, and the local Agent and Cloud paths stay in sync) are in the root [`AGENTS.md`](../../../AGENTS.md), under “Transcript and AI pipeline”.

## Overview and data model

| File | Content and status |
| --- | --- |
| [`ccut-ai-pipeline-design.md`](ccut-ai-pipeline-design.md) | **AI pipeline overview**: AI flow, fingerprint and incremental semantics, contracts for each stage (implementation-aligned v0.4). Body text is in [`ccut-ai-pipeline-design/`](ccut-ai-pipeline-design/) |
| [`ccut-transcript-v03-design.md`](ccut-transcript-v03-design.md) | Transcript v0.3: `words[]` as the source of truth, sentences as first-class units, sentence-level translation in `trans` and the display overlay `transAlign` (confirmed; current data structure spec) |
| [`ccut-subtitle-pipeline-implementation.md`](ccut-subtitle-pipeline-implementation.md) | Implementation notes for the pipeline from post-transcription segment → polish → translate → align, and the boundaries of its four stages |
| [`ccut-file-contract-subtitle-ai-design.md`](ccut-file-contract-subtitle-ai-design.md) | File contract pipeline v0.3: the LLM exchange format changes from JSON to txt / HTML (M0–M4 implemented; this is the **implementation spec**). Body text is in [`ccut-file-contract-subtitle-ai-design/`](ccut-file-contract-subtitle-ai-design/) |
| [`ccut-incremental-edit-design.md`](ccut-incremental-edit-design.md) | Audit of the edit write path, `patchTranscript` partial patches, and consolidation of incremental editing |
| [`ccut-korean-word-spacing-design.md`](ccut-korean-word-spacing-design.md) | Korean words and spacing: current state, where per-syllable segmentation drops spaces; call-site survey for the four problems S / W / B / L; the “attach-to-previous” marker and the migration plan for script 0.5 (**proposal, pending decision, not implemented**, 2026-09-30) |
| [`ccut-unspaced-script-segmentation-design.md`](ccut-unspaced-script-segmentation-design.md) | Word segmentation for Thai, Lao, Burmese, Khmer and Tibetan: new scripts are stored by word using ICU4X LSTM, and word gaps inside a phrase carry the “attach-to-previous” marker; rewrite ranges anchor to old words, and quotes are at Snap level; existing scripts are not migrated (implemented 2026-10-01) |

## Segmentation, alignment and translation repair

| File | Content and status |
| --- | --- |
| [`ccut-asr-initial-segment-design.md`](ccut-asr-initial-segment-design.md) | Initial soft segmentation of ASR segments: promotable projection, `RowSegmentation` source annotation (implemented 2026-08-26) |
| [`ccut-alignment-block-subtitle-split-design.md`](ccut-alignment-block-subtitle-split-design.md) | Four-layer separation of subtitle splitting, `autoBreaks` / `LayoutProfile`, minimal monotonic alignment blocks, `transDisplay` (confirmed; implementation record in §12) |
| [`ccut-translation-row-repair-design.md`](ccut-translation-row-repair-design.md) | Detection of merged translation rows (adjacent sentences glued together) and second-pass correction: `align-row-deficit` criterion, targeted re-splitting with `--align-density paired` (M1–M3 and M5 done) |
| [`ccut-lean-llm-carrier-design.md`](ccut-lean-llm-carrier-design.md) | Head-and-tail quotation of `lines/1` and cross-check of code; M0 foundation and experiment tools implemented. Round two (sharded prompts, joint localization, line-attribution gate, make-up round) on DeepSeek V4.1 Flash with 508 sentences: 491 / 0 / 17 vs. the old carrier at 378 / 97 / 33, at about 0.4× cost. After a third blind test, two guardrails were added: block-seam cleanup and rejection of block restatement. The direct provider path is opt-in via `ccut translate --align-fusion lines` (default is still `rows`; the Agent path and the §5 state machine are pending) (2026-09-30) |
| [`ccut-translate-prompt-ab-runbook.md`](ccut-translate-prompt-ab-runbook.md) | Acceptance gate for translation prompt A/B (in English); script at `scripts/bench/translate_prompt_ab.py`. The design draft for the two-version prompt upgrade that it validates is archived in [`../../archive/subtitle/`](../../archive/subtitle/README.md) |

The [fixed multilingual baseline for `lines/1`](../../../scripts/bench/fixtures/lean-carrier-multilingual-2026-09-30/README.md) keeps samples from three real video projects, six synthetic source languages, model responses, and offline replay results.

The [2026-10-01 multilingual acceptance](../../../scripts/bench/fixtures/lean-carrier-acceptance-2026-10-01/README.md) keeps the new fixed-response replay, the new model tests, per-sentence scores, and comparison charts.

The [915bfef13 multilingual re-check](../../../scripts/bench/fixtures/lean-carrier-acceptance-2026-10-01-915bfef13/README.md) records the Hindi quotation fix, Thai segmentation and simulated budget tests, and the semantic and architecture checks that still fail.

The [9bb2a8f62 multilingual acceptance](../../../scripts/bench/fixtures/lean-carrier-acceptance-2026-10-01-9bb2a8f62/README.md) records the old-vs-new comparison under the same reading budget, polish and translation regressions, and the semantic errors that remain.

**New acceptance pages must carry a reading budget.** In production, every editable sentence has a budget, and both `chunk_hint`'s `≥k` and the `¦` shards are derived from it. A page without a budget only takes the “no budget” branch. That is why the “segmentation too coarse” results for German and Thai in the main table of that re-check mostly came out this way; they do not represent production behaviour.

The syntax is `data-budget="整句≤N字"` on the `<p>` (整句 = whole sentence; 字 = characters, the unit for zh, ja and ko targets; for other targets the unit is 字符, also characters):

- `N` is computed by production's `reading_budget_duration`: displayed seconds × target-language cps (`zh` 9, `ja` / `ko` 13, others 21), rounded down.
- The production parser ignores this attribute. When `lean_carrier_grade` reads the page (`render`, `render-fix`, `grade` and other subcommands all go through `load_page`), it restores it as `Sentence.budget`.
- When a synthetic case has no real duration, estimate one with `syntheticDurationSeconds` or from the reference translation, and state in the acceptance record that this is an assumption.
- The test `multilingual_piece_marks_never_cut_inside_a_word` applies a budget to each case using the same convention.

## Agent workflow, terminology and style

The [multilingual polish and translation cases](../../../scripts/bench/fixtures/subtitle-multilingual-cases/README.md) cover 12 source languages, 25 scenarios and 50 tasks, with reference outputs, wrong counter-examples, production path regressions, and model task exports.

| File | Content and status |
| --- | --- |
| [`ccut-subtitle-agent-workflow.md`](ccut-subtitle-agent-workflow.md) | Subtitle Agent stage orchestration, alignment strategy, worker and resume experience (internal development material, not copied back into `skills/`) |
| [`ccut-glossary-design.md`](ccut-glossary-design.md) | Glossary: a cross-project table of proper nouns, split into a transcription glossary and a translation glossary, compiled into `ai/context.md` on match; transcription term selection and custom prompts (2026-09-20 prototype first; product spec [§15.10](../product/product-design/15-glossary.md)) |
| [`caption-style-model-design.md`](caption-style-model-design.md) | **Caption style model**: seven independent dimensions (font / finish / placement / current word / motion / emphasis word / layout mode) combine into a style, and presets are just values. Each preset carries its own current-word style; KTV color sweep is one mode of current word, and “Daoyazi” (倒鸭子) is a layout mode. Compilation table from new body text to Studio style (proposal, prototype first, 2026-10-09) |
| [`ccut-daoyazi-caption-design.md`](ccut-daoyazi-caption-design.md) | “Daoyazi” (倒鸭子) cross-sentence dynamic-layout captions: `CaptionSequencePlan` reuses `MotionProgram`, with `wordAnimation.caption.seed` + `options.daoyazi` (core and App v2 landed 2026-09-17) |
| [`ccut-daoyazi-caption-style.example.json`](ccut-daoyazi-caption-style.example.json) | Example payload for the document above |
| [`ccut-subtitle-style-motion-design.md`](ccut-subtitle-style-motion-design.md) | Behaviour analysis of 31 subtitle and text designs and 17 animation primitives, CucCut capability gaps, shared-render migration and acceptance plan (proposal, not yet implemented) |

The user-facing explainer pages are in [`../../guide/explainers/`](../../guide/explainers/README.md). The distributable subtitle workflow is in [`skills/cuccut`](../../../skills/cuccut/SKILL.md).
