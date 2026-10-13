> Ported from CucCut v2; the data model names in this document (TranscriptDoc, etc.) refer to the v2 models. For how they correspond to the v3 document model, see [Architecture design §14](../../architecture/architecture-design.md#14-items-pending-review).

# CucCut File-Contract Subtitle AI Pipeline Design (File-Contract Pipeline, v0.3)

> Status: **M0–M4 implemented** (commits `4be5a153..37c0baf9`). From v0.3 onward this document is an **implementation spec**, not a pure design draft. This plan replaces the **exchange format** of the three LLM stages (polish/segmentation, translation, alignment) from JSON with "directly editable files" (txt / HTML / HTML tables), with code handling rendering and parsing back. **JSON is only replaced as the LLM contract; `words[]` / `trans` / `transAlign` remain the project source of truth, and the write rules are unchanged.**
>
> v0.2 was reconciled against `docs/ccut-file-driven-ai-pipeline-design.md` (hereafter reference A) and `docs/ccut-file-based-subtitle-ai-design.md` (hereafter reference B); the main decision comparison is in appendix §18.
>
> **2026-08 deprecation note**: The "JSON contract deprecation" in §17.2 has been executed. The `--contract` parameter is removed entirely, and the five migrated kinds (polish/translate/align/analysis/translate-brief) **always use file-v1**, with no gradual-rollout switch. `ContractMode`, `TRANSLATE_WORDS`/`TRANSLATE_FUSED_WORDS`, the JSON versions of `run_polish`/`run_analysis`/`run_translation_brief`, carry-over, and the JSON branch of the fused-split draft are all deleted. The align routed via the timeline also uses file-v1. Paragraphs describing a "json-v0 path retained / coexisting" are from now on **historical records**. The json-v0 semantics that remain valid are only two: unmigrated single-round kinds (polish-retry/segment/segment-index/cleanup/broll) keep the JSON envelope (chapters moved to the file-v1 HTML carriers `chapters-source/1` / `chapters-outline/1` in 2026-08 with paged Map/Reduce, see AI pipeline design §7; their json-v0 survives only as historical task directories), and the §9.6 rule that "json-v0 of historical tasks is interpreted by the old runner; this version does not lint their commits and passes them through unchanged". The `ai/brief.json` / `ai/polish.json` dual writes and the Mac read-point migration (§13.1 (1)) are not yet removed and still follow the original text.
>
> **2026-08 paging unification note**: analysis, segment, translate and align now all use `atomize::word_count`; Latin is counted by word, CJK by character, and attached punctuation is not counted. The starting stress-test budgets for analysis/segment/translate/align are all 8000 source words, and align point-fix and full-round passes share the same budget. The sentence count, serialized character count and worker slot count no longer change the page shape. Polish still uses a 2200 core-word budget plus up to 200 words of context on each side.
>
> **v0.3 change note**: Following the "implementation is the spec" principle, the document has been aligned with the code landed in M0–M4. The v0.2 historical conclusions are all kept; only the parts overturned by the implementation are changed, and each changed spot is marked with a sentence "**M1–M4 implementation ruling**". Deliberate deviations in the implementation are collected in §13.1; unimplemented items all point to §17. The criterion for reading this document: **paragraphs without an implementation status annotation = implemented literally as written.**

---

## Table of Contents

This document has been split by chapter (2026-09-10). The body is under [`ccut-file-contract-subtitle-ai-design/`](ccut-file-contract-subtitle-ai-design/), one chapter per file, and overly long chapters are further split into subdirectories by section (the `README.md` in a subdirectory is that chapter's introduction and section TOC). References written as "§N" still refer to chapter N in the table below. When editing a section, edit the file it lives in; new chapters get a new file plus a row added here. **Do not write the body back into this file.**

- [1. Goals and motivation](ccut-file-contract-subtitle-ai-design/01.md)
- [2. Invariants (red lines)](ccut-file-contract-subtitle-ai-design/02.md)
- [3. Overall architecture: contract switching](ccut-file-contract-subtitle-ai-design/03.md)
- [4. Directory layout and versioning](ccut-file-contract-subtitle-ai-design/04.md)
- [5. Stage 0: analysis — summaries and glossary](ccut-file-contract-subtitle-ai-design/05.md)
- [6. Stage 1: polish + segmentation (txt contract)](ccut-file-contract-subtitle-ai-design/06.md)
- [7. Stage 2: translation (HTML contract)](ccut-file-contract-subtitle-ai-design/07.md)
- [8. Stage 3: alignment (HTML table contract)](ccut-file-contract-subtitle-ai-design/08.md)
- [9. Execution layer: unified document interface for Agent and Cloud Model](ccut-file-contract-subtitle-ai-design/09.md)
- [10. Error classification, retry accounting and degradation ladder](ccut-file-contract-subtitle-ai-design/10.md)
- [11. Incrementality, fingerprints and provenance](ccut-file-contract-subtitle-ai-design/11.md)
- [12. Paging and budget parameter table (8000-word starting stress values)](ccut-file-contract-subtitle-ai-design/12.md)
- [13. Migration, compatibility and affected surface](ccut-file-contract-subtitle-ai-design/13.md)
- [14. Implementation milestones](ccut-file-contract-subtitle-ai-design/14.md)
- [15. Testing and acceptance](ccut-file-contract-subtitle-ai-design/15.md)
- [16. Security and input isolation](ccut-file-contract-subtitle-ai-design/16.md)
- [17. Open questions and known gaps](ccut-file-contract-subtitle-ai-design/17.md)
- [18. Appendix: main decision comparison with the two reference designs](ccut-file-contract-subtitle-ai-design/18.md)
