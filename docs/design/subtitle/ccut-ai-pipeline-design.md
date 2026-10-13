> Ported from CucCut v2. The data model names in this document (such as TranscriptDoc) refer to the v2 models. For their mapping to the v3 document model, see [Architecture design §14](../../architecture/architecture-design.md#14-items-pending-review).

# ccut Post-Transcription AI Pipeline Technical Design (Polish / Segment / Chapters / Translate / Subtitle Alignment)

> **Version**: implementation-aligned v0.4 (2026-08-01)
> **Status**: P0–P5 and final-timeline cross-source translation are implemented; the code and tests are the authoritative source for algorithm parameters
> **Follow-up refactor proposal**: the plan to change the model content protocol from JSON to TXT / Markdown / HTML is described in
> [File-based subtitle AI pipeline redesign](ccut-file-based-subtitle-ai-design.md). This document continues to describe the currently implemented behaviour and remains the implementation reference until that proposal lands.
> **Related documents**:
> - [cuccut-format-spec.md](../bcf/cuccut-format-spec.md) — §17 Project container / §18 Transcript word-atom spec (the data layer of this design)
> - [ccut-cli-design.md](../cli/ccut-cli-design.md) — §8 LLM dual execution modes / task reply loop (the execution layer of this design)
> - [ccut-transcribe-port-plan.md](../speech/ccut-transcribe-port-plan.md) — local ASR stack porting plan (the upstream of this design)
> **Reference implementation**: the Pipeline / Translation / AI directories of voice-ink (the Swift version of CucCut). This design inherits much of its battle-tested machinery and lists the deliberate differences at the end (§13).
>
> **v0.3 consolidation**: the data structures for translation and alignment have been redesigned per
> [ccut-transcript-v03-design.md](ccut-transcript-v03-design.md) — sentences as first-class entities, `trans` as the sentence-level source of truth plus the `transAlign` alignment overlay, two alignment strategies (independent / manyToOne), and three fit/soft/hard thresholds. Translation Cues are derived only from Sentences and are fully independent of source Cues. Final-timeline items are also routed by `(srcId, sentenceId)`, using a fingerprint of the visible words after cut, cross-source context and per-source scatter write-back; §8/§9 and below are now described uniformly according to the current implementation.

---

## Table of Contents

This document was split by chapter on 2026-09-10: the body lives under [`ccut-ai-pipeline-design/`](ccut-ai-pipeline-design/), one chapter per file. Chapters that are too long are further split into subdirectories by section (the `README.md` in a subdirectory is that chapter's introduction and section list). References written as “§N” still mean chapter N in the table below. To change a section, edit its file; to add a chapter, create a new file and add a line here. **Do not write the body back into this file.**

- [1. Background and current state](ccut-ai-pipeline-design/01.md)
- [2. Overall architecture](ccut-ai-pipeline-design/02.md)
- [3. Data and state](ccut-ai-pipeline-design/03.md)
- [4. Stage 0: word-level timestamps and forced alignment](ccut-ai-pipeline-design/04.md)
- [5. Stage 1: polish](ccut-ai-pipeline-design/05.md)
- [6. Stage 2: segment](ccut-ai-pipeline-design/06.md)
- [7. Stage 3: chapters](ccut-ai-pipeline-design/07.md)
- [8. Stage 4: translate](ccut-ai-pipeline-design/08.md)
- [9. Stage 5: display split / align](ccut-ai-pipeline-design/09.md)
- [10. LLM call layer](ccut-ai-pipeline-design/10.md)
- [11. Orchestration, progress and CLI command surface](ccut-ai-pipeline-design/11.md)
- [12. Implementation status](ccut-ai-pipeline-design/12.md)
- [13. Comparison with voice-ink and deliberate differences](ccut-ai-pipeline-design/13.md)
