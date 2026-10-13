> Ported from CucCut v2. The data model names in this text (timeline.json, Element, Source / Clip / Cut, etc.) refer to the v2 model. For how they map to v3 sequences, tracks and instances, see [Element model mapping](element-model-mapping.md) and [Architecture design §14](../../architecture/architecture-design.md#14-items-pending-review).

# CucCut Talking-Head Cut Technical Plan (Prototype Rounds 192–197 → Kernel / serve / App v2 / Web)

> **Status**: v0.3 implementation reconciliation (2026-09-07). The P0 review is at reviewVersion 5. P1 shared semantics and the API 23 Web binding are wired up. **P2 App v2 has fully landed per prototype rounds 192–197** (§14, commit chain `dfccdfc7e` → `ab873450f` → `553421dac` → `e318281e8`). P3 Web only covers rounds 192–193 (§13); the Web gaps for rounds 196–197 are recorded in the **§15 Web remaining-work ledger**. The early inventory in this document is kept as background. The current landing status and verification boundaries are defined by §13–§15.
> **Problem**: [`designs/cuccut`](../../../designs/cuccut/README.md) rounds 192–193 drew "talking-head cutting" as a complete interaction. The AI / Agent finds filler words, pauses and repeated sentence openers and presents them as **suggestions**, which can be accepted or ignored one by one or in batch. Select a span of text in the script and press ⌫ to cut it manually. Cut segments stay visible in both the script and the timeline, and a click restores them. Every step can be undone. The script selection is mirrored to the timeline with timecodes. A toolbar floats above the selection. This plan implements that in real code. The kernel already has lossless media-layer cutting, a local detector, an LLM cleanup flow and a review transaction. What is missing is **persistent per-suggestion state, suggestions coexisting with manual cuts, the cut-mode UI on both ends, selection sync, and the Web write path**.
> **Benchmark**: Descript's script-driven editing (dragging to select text selects the matching timeline range, deleting words cuts the clip, Show/Hide deleted).
> **Related docs**:
> - [`docs/design/cli/ccut-edit-domain-design.md`](../cli/ccut-edit-domain-design.md) — the two-layer cut model, `sources[].cuts[]`, the three-layer time domains, the `timeline/apply` op table, and `ai/cuts.json` provenance. This plan does not change these contracts; it only adds the suggestion layer and UI on top of them.
> - [`docs/design/bcf/cuccut-format-spec.md`](../bcf/cuccut-format-spec.md) §18.6 WordSpan (word span → source time padding and frame alignment), §19 Product Timeline.
> - [`docs/design/subtitle/ccut-ai-pipeline-design.md`](../subtitle/ccut-ai-pipeline-design.md) — "timestamps never enter the LLM", fingerprints and incremental semantics. The cleanup flow follows the same discipline.
> - [`docs/design/editor/ccut-editor-interaction-port-design.md`](ccut-editor-interaction-port-design.md) — two thin views share the thick semantics of `ccut-editor-core`, `SelectionSet`, key tables, and two-view comparison fixtures. The cut mode in this plan follows the same layering.
> - [`docs/design/architecture/ccut-v2-architecture-redesign.md`](../architecture/ccut-v2-architecture-redesign.md) ADR-3 protocol single source, ADR-4 kernel-resident priority. These decide that the review write path must move from the App subprocess to `Kernel::dispatch`.
> - [`docs/design/product/product-design.md`](../product/product-design.md) §9 (clean entry and experimental project), §12.6 "cut overlay layer" and "script selection synced to the timeline", §13.1 "text edit / cut: two modes", §15.3 "find the cuttable spots". These are the authoritative prototype-side descriptions.

---

## Contents

This document has been split by chapter (2026-09-10). The body lives under [`ccut-talking-head-cut-design/`](ccut-talking-head-cut-design/), one chapter per file. Chapters that are too long are split into subdirectories by section; the subdirectory's `README.md` is that chapter's introduction and section table of contents. References written as "§N" still mean chapter N in the table below. Edit whichever file holds the section you change. For a new chapter, create a new file and add a line here. **Do not write the body back into this file.**

- [0. One-page summary](ccut-talking-head-cut-design/00.md)
- [1. Goals and scope](ccut-talking-head-cut-design/01.md)
- [2. Current-state inventory (2026-09-07, verified file by file)](ccut-talking-head-cut-design/02.md)
- [3. Key decisions](ccut-talking-head-cut-design/03.md)
- [4. Data model](ccut-talking-head-cut-design/04.md)
- [5. Shared semantics: `ccut-editor-core::cut_mode`](ccut-talking-head-cut-design/05.md)
- [6. Detection flow: `cleanup` incremental semantics and word lists](ccut-talking-head-cut-design/06.md)
- [7. Write path and protocol](ccut-talking-head-cut-design/07.md)
- [8. View implementation](ccut-talking-head-cut-design/08.md)
- [9. Playback, audition and export](ccut-talking-head-cut-design/09.md)
- [10. Phased implementation plan](ccut-talking-head-cut-design/10.md)
- [11. Deliberate exclusions and open questions](ccut-talking-head-cut-design/11.md)
- [12. Revision checklist for existing docs](ccut-talking-head-cut-design/12.md)
- [13. Web implementation reconciliation (2026-09-07)](ccut-talking-head-cut-design/13.md)
- [14. App v2 implementation reconciliation (2026-09-07, rounds 192–197)](ccut-talking-head-cut-design/14.md)
- [15. Web implementation ledger (rounds 196–201)](ccut-talking-head-cut-design/15.md)
