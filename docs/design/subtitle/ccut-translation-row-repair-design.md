> Ported from CucCut v2. The data-model names in this document (TranscriptDoc etc.) refer to the v2 models; for their correspondence with the v3 document models, see [Architecture design §14](../../architecture/architecture-design.md#14-items-pending-review).

# Translation row-sticking detection and second-pass correction plan (translation row repair)

Status: **M1–M3 completed (2026-08-26); the M5 automatic wrap-up round completed (2026-08-28)**. Review of M2 found and fixed two semantic defects: the density tri-state criterion in `refine-align` was inverted, and the paired relaxation applied only on the draft path and did not reach the real `pair_cost` call chain. Condition 3 of M3's four surfaces is now unified to exclude the `align-stale` degraded set. The pre-existing compile blocker in the CLI/serve contract tests has also been fixed and verified. M4 real-sample calibration has not started. Milestones and completion criteria are in §9.
Scope: the alignment criterion of `ccut check`, the per-sentence split-density semantics of the align engine, the `ccut refine-align` loop, and the four consumer surfaces: Mac, App v2, Studio, and the prototypes.
Not changed: `words[]` as the source of truth, Sentence derivation, sentence-level translation `trans` as the source of truth, the main translation prompt and faithfulness contract, and the derivation rules of `derive_trans_cues` itself.

Related documents:
[ccut-alignment-block-subtitle-split-design.md](ccut-alignment-block-subtitle-split-design.md) (four-layer separation and the alignment-block model; the higher-level contract this plan sits under),
[ccut-ai-pipeline-design.md](ccut-ai-pipeline-design.md) §8–§9 (translate/align engines and waves),
[ccut-cli-server-reference.md](../cli/ccut-cli-server-reference.md) §4.5 / §8 (serve allowlist and `translate` parameter table),
[ccut-transcript-v03-design.md](ccut-transcript-v03-design.md) §4 (`transAlign` invariant),
[product-design.md](../product/product-design.md) §13.2 (Subtitle · Edit statbar and the many-to-one card).

## 0. Summary of conclusions

### Fix priority and budget consistency (2026-09-12)

`refine-align` and auto refinement share a bounded round in which hard faults take priority: when an overflow, stale, or degraded fallback exists, only `table + auto` runs, re-determining the natural translation pieces first. Paired density is not appended in the same round, and neither the brief nor a nested row repair is rebuilt. After re-checking, decide whether an independent sticking repair is needed; do not treat a submitted repair request as proof that the actual subtitles have improved. Unhandled hotspots are reported explicitly in `deferred`, and unresolved targets of this round are reported in `remaining`.

The real paired table round writes the same suggested piece count into the payload budget (from 2026-09-24 it is guidance only; final acceptance is now by the residency predicate, see §4.3 ④), and it is forbidden to rewrite the translation. The contradiction of a prompt requiring at least 8 pieces while the table suggests at most 4 no longer appears. The structured budget and the frozen target pieces are checked for consistency before dispatch. Agent submit and the provider engine share this check; contradictory input reports `input-conflict` and is not handed to the model for trial and error. Whether an arbitrary free-text instruction can be satisfied is outside the scope of a pure-function pre-check; semantic naturalness remains the responsibility of the model and shared acceptance.

The historical stage notes below do not change these current orchestration priorities. For the exact CLI semantics, see the [`refine-align` reference](../cli/ccut-cli-server-reference/06/ccut-refine-align.md).

The user-reported symptom: after transcription and translation finish, **one Chinese line sits over several English subtitles**. The Chinese line count is far lower than the English line count, and the user wants a "second-pass correction".

After reviewing the code, the conclusion has two halves:

1. **Many-to-one is an intentional design, not a defect.** When a translation line fits on one line, several short source phrases sharing one translation line is the default shape of CucCut's two-stage model (the comment at [`align.rs:700–711`](../../../core/crates/ccut-flow-core/src/engines/align.rs) is an explicit ruling). Therefore the criterion cannot be "translation cue count ≠ source cue count".
2. **But the existing guardrails leave a precisely describable blind spot.** The four exemptions of `no_entry_needed` ([`align.rs:725–728`](../../../core/crates/ccut-flow-core/src/engines/align.rs)) combined with the three suppression conditions of `source_ceiling` ([`align.rs:3325–3334`](../../../core/crates/ccut-flow-core/src/engines/align.rs)) mean that **sentences whose translation is shorter than 10 reading units are completely unconstrained by source width and duration**. At most one Chinese line can stay on screen for 7 seconds, covering any number of English cues, and `ccut check` emits no warning at all. This is the sticking band the user saw.

This plan does four things:

1. **M1 detection**: add a deterministic, zero-LLM `ccut check` criterion `align-row-deficit`. It judges **residency imbalance** (one translation covers ≥2 source cues and monopolizes the screen for a long time), not a count difference. The criterion function lives in `ccut-flow-core`; the engine, check, and the four surfaces share the same predicate and do not copy the thresholds.
2. **M2 repair**: add a per-sentence split-density directive `density: paired` (CLI panel `--align-density paired`; the default `auto` behaviour is unchanged). Flagged sentences bypass `no_entry_needed`, turn off width-triggered row merging, switch to a prompt variant that tries to keep one row per source group, and are accepted by the residency predicate (before 2026-09-24 acceptance was pure arithmetic minimum-piece counting, see §4.3 ④).
3. **M3 UI**: the Mac / App v2 statbar and the sentence-card right-click menu offer an entry "N sticking points → realign by source row". Studio and the `designs/` prototypes show only read-only counts (Studio has no AI job-submission channel, see §1.4).
4. **M4 acceptance**: golden tests for the five sticking shapes, plus side-by-side real runs on short and long films, to calibrate the only tunable threshold.

The most critical rule: **repair only changes `transAlign`; it never touches `trans`.** Second-pass correction re-splits the display layer; it is not re-translation.

## 1. Current-state review (code facts, as design premises)

The following are all based on the current `main` (`7a70c595`).

### 1.1 The three production chains of sticking

| Chain | Location | Shape |
| --- | --- | --- |
| A. Engine deliberately writes no entry | [`align.rs:725–763`](../../../core/crates/ccut-flow-core/src/engines/align.rs) `no_entry_needed` | All four conditions hold ⇒ `removals.push` (when there is no projection) or write a single-piece entry (when there is a projection). Afterwards [`split.rs:1191–1206`](../../../core/crates/ccut-flow-core/src/split.rs) `derive_trans_cues` produces for this sentence **one translation cue covering the whole-sentence time window** |
| B. Model/engine merges rows back together | [`translate.rs:1392–1411`](../../../core/crates/ccut-flow-core/src/engines/translate.rs) `fusion_rows_prompt_section` + [`align_block.rs:1477–1549`](../../../core/crates/ccut-flow-core/src/align_block.rs) `merge_short_rows` | The contract explicitly says "A sentence of four groups usually wants two rows, not four"; short groups (<1.5s or <6 units) must merge with an adjacent group; when word order cannot be laid out, "emit a single span covering `1-N`"; before persisting, the engine then merges deterministically by reading speed, duration, and width |
| C. Fallback degrades to the whole sentence | [`align_block.rs:1214`](../../../core/crates/ccut-flow-core/src/align_block.rs) `sentence_level_entry`; the three `SentenceLevel` exits of [`align_block.rs:1274–1313`](../../../core/crates/ccut-flow-core/src/align_block.rs) `plan_sentence`; [`align.rs:1043–1061`](../../../core/crates/ccut-flow-core/src/engines/align.rs) `plan_sentence_rows` silently falls back to regular fusion on failure | `correspondence: "sentence"`, one block with one piece, the whole sentence shown statically on screen |

The four exemptions of chain A (all must hold to skip):

```rust
// core/crates/ccut-flow-core/src/engines/align.rs:725
let no_entry_needed = !exceeds_one_line_fit(&translation, &options.lang, params.fit)  // zh fit = 16
    && crate::split::piece_display_units(&translation, &options.lang) <= params.hard   // zh hard = 20
    && dwell <= LONG_DWELL_SECONDS                                                     // 7.0s, align.rs:87
    && source_ceiling.is_none();
```

The deterministic merge of chain B ([`align_block.rs:1488–1516`](../../../core/crates/ccut-flow-core/src/align_block.rs)) triggers on:
`too_fast` = reading speed > `ROW_MAX_CPS` (6.0, [`align_block.rs:1434`](../../../core/crates/ccut-flow-core/src/align_block.rs)), or
`too_small` = duration < `min_duration_sec` (1.0s) **or** width < `ROW_MIN_UNITS` (6, [`align_block.rs:1436`](../../../core/crates/ccut-flow-core/src/align_block.rs));
when triggered by “太快” (too fast), the merge guard relaxes to `hard` (20); when triggered only by “太小” (too small), it still guards at `fit` (16).

### 1.2 Where the existing guardrails cover, and where they leak

`source_ceiling` ([`align.rs:3307–3343`](../../../core/crates/ccut-flow-core/src/engines/align.rs) `source_ceiling_issues`, reached via [`align.rs:3576`](../../../core/crates/ccut-flow-core/src/engines/align.rs) `whole_sentence_source_ceiling_issue`, which the `no_entry_needed` gate and `ccut check` **share as the same predicate**) has this criterion:

```text
words ≥ PAIRED_MIN_SOURCE_WORDS(4)                    // align.rs:103
&& target_units ≥ PAIRED_TARGET_MIN_UNITS(10)         // align.rs:100
&& ( source_units > source_piece_hard(fit)            // en: 42*3/2 = 63 characters
   || seconds > PAIRED_SOURCE_HARD_SECONDS(6.0) )     // align.rs:97
```

That is, **sentences whose translation is shorter than 10 reading units are completely immune to source-side length.** Combining this with the four exemptions of §1.1 gives the residual set that `no_entry_needed` lets through:

- **R1 (main cause)**: `target_units < 10` (a Chinese line of fewer than ten units). The source side may have any width and any number of cues, as long as the whole-sentence window is ≤ 7s. Most of the user's “one Chinese line over three English lines” cases fall here.
- **R2**: `target_units ∈ [10, 16]`, source side ≤63 characters and ≤6s. This is roughly the scale of “one and a half English cues”; the sticking is mild.
- **R3**: very short sentences with fewer than 4 source words are exempt by definition.

Coverage on the check side also has holes:

| Existing code | Location | Criterion | Coverage of sticking |
| --- | --- | --- | --- |
| `align-stale` | [`check.rs:947–959`](../../../core/crates/ccut-engine/src/flows/check.rs) | `TransCue.fallback`, and fallback is true only when **“译文超出单行 fit”** (translation exceeds the single-line fit) ([`split.rs:1200–1202`](../../../core/crates/ccut-flow-core/src/split.rs); the comment there is an explicit ruling: “翻译流不读取源 Cue 数量” (the translation flow does not read the source cue count)) | **Zero coverage**: by definition the R1/R2 translations fit on one line, so `fallback = false` |
| `align-source-ceiling` | [`check.rs:986–1005`](../../../core/crates/ccut-engine/src/flows/check.rs) (no-entry branch) + [`:1114`](../../../core/crates/ccut-engine/src/flows/check.rs) (with-entry branch) | Same predicate as §1.2 | Covers “source row too wide or too long and translation long enough”, which is the complement of R1 |
| `align-paired-density` | [`check.rs:1249`](../../../core/crates/ccut-engine/src/flows/check.rs) + [`align.rs:3603`](../../../core/crates/ccut-flow-core/src/engines/align.rs) | Source rows **too dense**, and the translation pieces already have natural seams | Opposite direction: it governs “source has too many rows and they are too cramped”, not “translation is too short” |
| `align-sentence-level` | [`check.rs:1492`](../../../core/crates/ccut-engine/src/flows/check.rs) | Counts `correspondence == sentence`, info level | Covers chain C, but does not distinguish how many source cues the sentence covers |

**Nowhere in the repository is there a comparison of "translation cue count vs. source cue count".** This is a deliberate design choice (to avoid judging many-to-one as an error), and it is exactly the hole that second-pass correction must fill. The way to fill it is not to restore a count comparison, but to introduce a residency criterion.

### 1.3 The five user-visible sticking shapes

| Shape | Data signature | Chain |
| --- | --- | --- |
| F1 no entry | `transAlign[lang]` has no key for this sentence | A |
| F2 single piece, sentence level | one piece, `correspondence: "sentence"` | C |
| F3 piece count below source cue count | multiple pieces, but each piece spans multiple source cues | B |
| F4 entry invalid | `align_entry_valid` ([`split.rs:983`](../../../core/crates/ccut-flow-core/src/split.rs)) does not hold ⇒ `fallback: true` on derivation | drift after editing |
| F5 independent, no anchor | `mode == independent`, `from = null` | independent split path |

F4 is already fully covered by `align-stale`, so this plan does not report it again (the exclusion rule in §3.2). F5 has no source-word interval, so source cues cannot be counted; it only records the shape in metrics and does not enter the criterion.

### 1.4 Existing reusable assets

**Engine and CLI**

- The `ccut refine-align` loop ([`refine.rs:272`](../../../core/crates/ccut-engine/src/flows/refine.rs)
  `run_refine_round`): `check_verdict` → `hotspot_keys` ([`refine.rs:31`](../../../core/crates/ccut-engine/src/flows/refine.rs),
  collects sentence keys by code; `align-source-*`/`align-paired-density`/`align-bilingual-anchor`/
  `align-degraded-fallback` are each capped at 40; `align-overfit`/`align-stale` are uncapped) →
  `align_instructions` ([`refine.rs:155`](../../../core/crates/ccut-engine/src/flows/refine.rs),
  turns the per-sentence diagnosis into targeted review instructions, ≤3 per sentence, ≤3000 characters overall) → one
  `translate --align-only --sentences <hotspots>` ([`refine.rs:303–311`](../../../core/crates/ccut-engine/src/flows/refine.rs),
  with `align_fusion = "rows"` and `align_mode = "many-to-one"` fixed) → re-run check to compute
  `refined` / `remaining`. **As soon as a new criterion enters `hotspot_keys` and `align_instructions`,
  refine-align gains the ability to fix it at once, with no new flow.**
- The targeted request shape is already in place: `--align-only --sentences`, and `AlignOptions.force = options.align_only`
  ([`translate.rs:209`](../../../core/crates/ccut-engine/src/flows/translate.rs) and
  [`:1008`](../../../core/crates/ccut-engine/src/flows/translate.rs)). **In every `--align-only` round, force is always true**,
  and the existing valid segmentation is used as the payload draft baseline ([`align.rs:854–879`](../../../core/crates/ccut-flow-core/src/engines/align.rs)).
  `AlignOptions` already has three targeting fields, `sentences` / `targeted` / `force`; the new `density` is an extension of the same family.
- serve already registers the `refine-align` job kind ([`supervisor.rs:975–992`](../../../core/crates/ccut-serve/src/supervisor.rs)),
  and the `translate` kind already whitelists `alignOnly` / `sentences` / `alignFusion`
  ([`supervisor.rs:839–860`](../../../core/crates/ccut-serve/src/supervisor.rs)).
- Methodology model: the six-part set of the speaker-repair wave ([`speaker_repair.rs:1–52`](../../../core/crates/ccut-flow-core/src/engines/speaker_repair.rs)):
  deterministic candidate screening → windowing → index contract → pure-arithmetic acceptance → deterministic cap on changes (a window that exceeds the cap is ignored entirely) →
  when rounds run out, keep the original as is.

**Surfaces**

- **Mac**: `OrigLineView.sourceRuns(_:cueIdByWord:)`
  ([`TranslateCardOriginalLineView.swift:127`](../apps/mac/Sources/VoiceInk/Translation/Card/TranslateCardOriginalLineView.swift)
  = `sourceCueRuns` + `mergeShortRuns`) already **splits each translation segment into sub-lines by source cue** and absorbs
  fragments of ≤2 words; its `.count` is "how many English subtitle lines this one Chinese line covers". It is an existing metric,
  used by [`TranslatePaneTable.swift:68`](../apps/mac/Sources/VoiceInk/Translation/Pane/TranslatePaneTable.swift)
  to draw the sub-lines, but it has **never been used as a diagnostic signal**. The same rules have line-for-line identical mirrors in
  [`subtitle-rendering.js:226`](../skills/cuccut/templates/studio/subtitle-rendering.js) and `designs/cuccut-mac/app/translate-model.js`; the three must change together.
- The Mac stats bar `TransStatBar` ([`TranslatePaneSupport.swift:336`](../apps/mac/Sources/VoiceInk/Translation/Pane/TranslatePaneSupport.swift))
  already has a clickable stat item (stale → `openSetup(lang, staleOnly: true)`,
  [`TranslatePaneView.swift:274`](../apps/mac/Sources/VoiceInk/Translation/Pane/TranslatePaneView.swift)).
  The click area, priority demotion and warning color are all in place, so adding an item is an isomorphic extension.
- Mac targeted entry points: the AI menu “Re-align %@ lines…” ([`TranslatePaneActions.swift:59`](../apps/mac/Sources/VoiceInk/Translation/Pane/TranslatePaneActions.swift)),
  the sentence-card right-click “Re-align this line” ([`TransSentenceCardView.swift:365`](../apps/mac/Sources/VoiceInk/Translation/Card/TransSentenceCardView.swift)),
  and the card badge `TranslateCardBadge` ([`TranslateCardBadge.swift:9–15`](../apps/mac/Sources/VoiceInk/Translation/Card/TranslateCardBadge.swift):
  `.realigning` / `.refreshing` / `.outOfDate` / `.timingSplit` / `.speakerSplit` / `.rewritten`). Request assembly is at
  [`Contracts.swift:458–464`](../apps/mac/Sources/CucCutCore/Contracts.swift):
  `kind = "translate"` + `alignOnly: true` + `sentences[]`.
- **App v2**: `AlignSpec::Scoped { language, sentences, align_only }`
  ([`ai/mod.rs:114–125`](../../../apps/cuccut/src/app/editor/ai/mod.rs)); sentence cards already have `SentenceOp::Realign` / `Retranslate` / `Edit`
  ([`lists/translate.rs:2146–2196`](../../../apps/cuccut/src/app/editor/lists/translate.rs))
  and the right-click `TranslateCardAction::Realign` ([`lists/translate.rs:2224–2250`](../../../apps/cuccut/src/app/editor/lists/translate.rs)).
- **Studio web**: `skills/cuccut/templates/studio` **has no AI task submission channel at all**.
  Every `fetch` endpoint is one of `__ccut/{healthz,projects,put,undo,redo,restore,history,media,
  waveform,spectrum,filmstrip,thumb,upload,transcript/apply,timeline/apply,studio/poll,ws,export/*}`,
  with no `jobs`. So Studio can only show **read-only hints**, and cannot offer a repair button.
- **designs/cuccut**: product design doc §13.2 ([`product-design/13/13.2/README.md`](../product/product-design/13/13.2/README.md))
  already specifies the 「多对一卡」 form, “many-to-one card”: the source side renders as dashed-separator sub-lines, with a chip
  “1 行译文 · 对应 2 条原文字幕” (“1 translation line · corresponds to 2 source subtitle lines”) and the note
  「几条短原文共享一条紧凑译文是多对一的默认形态……不是对齐错了」 (“several short source lines sharing one compact translation is the default many-to-one form… it is not a misalignment”).
  **The stickiness hint must coexist with this card without conflict.** The chip says “this is normal”, while the new hint says “this one overruns in time”.
  The boundary between the two is exactly the criterion in §3.
- **apps/windows**: no translation or alignment UI, so this plan does not apply. That surface was archived and deleted on 2026-08-26.

## 2. Design principles and invariants

- **P1 Detection is deterministic, with zero LLM calls.** The criterion reads only `transcript.json` and the derived cue stream,
  can be computed synchronously on the UI thread, and incurs no call cost.
- **P2 Reuse the refine-align loop; do not create a new flow or wave.** What is added is one check code and one per-sentence
  instruction slot, not a new job kind, a new lane or a new stage stamp.
- **P3 The fix must change the semantics.** See §4.1: re-running with the same parameters hits the same `no_entry_needed` gate
  and the same merge bias, and the result is byte-for-byte identical. This is the only reason this plan must change the engine.
- **P4 Acceptance is pure arithmetic; when retries are exhausted, keep the original.** Following the speaker-repair ruling, a repaired
  result must pass a computable lower bound. If it fails, **keep the original and record it**; never write a worse segmentation.
- **P5 Only change `transAlign`.** `trans` is the sentence-level translation source of truth, and `transAlign` is the display
  segmentation overlay. Secondary correction is re-segmentation, not re-translation. It must not write `trans`, and must not go through
  the `transDisplay` rewrite channel (rewriting is the narrow task of “word order crossing and exceeding hard”, unrelated to stickiness).
- **P6 A count mismatch is not a defect.** The criterion's output must keep the copy on the §1.4 “many-to-one card” valid.

## 3. M1 detection criterion: `align-row-deficit`

### 3.1 Decision: judge dwell imbalance, not count difference

Three candidate criteria and their trade-offs:

| Candidate | Problem |
| --- | --- |
| Translation cue count < source cue count | Directly violates P6; it would flag every legitimate many-to-one as a defect (in real projects, this is most sentences) |
| Translation cue count / source cue count < ratio threshold | The ratio is very unstable for short sentences (1:2 and 2:4 have the same ratio but feel very different), and the threshold cannot be derived from existing constants |
| **A single translation cue covers ≥2 source cues and dwells ≥ D seconds** | Maps directly onto the user's experience (“stuck on screen”), belongs to the same family as the existing `LONG_DWELL_SECONDS`, and introduces only one calibratable parameter |

We take the third. Its physical meaning: **after the viewer finishes reading this line of Chinese, they still have to stare at it for a long time, while the English on the other half of the screen has already scrolled past two or three lines.**

### 3.2 Criterion definition

For each translated sentence `s` in language `lang`, let:

- `src_rows(s)` = the **number of source cue segments** covered by the sentence's anchored word interval, computed by the same rule as
  `OrigLineView.sourceRuns`: first split by source cue id, then absorb fragments with `mergeShortRuns`
  (segments of ≤2 words merge into adjacent segments: a first segment merges forward, a last segment merges backward, a middle segment merges into the shorter side, ties go to the earlier one, and merges cascade).
  Using `mergeShortRuns` rather than the raw cue count is deliberate: one- or two-word remnants produced when a sentence starts or ends mid-cue are not stickiness.
  Mac already swallows them at the rendering layer, so the criterion must match the number of sub-lines the user actually sees.
- `trans_cues(s)` = the list of translation cues that `derive_trans_cues` produces for this sentence.

`align-row-deficit` fires if and only if all of the following hold:

1. `src_rows(s) ≥ 2` (a single source row cannot be stickiness);
2. `trans_cues(s).len() < src_rows(s)` (there really are fewer);
3. the sentence is **not** in the degraded set of `align-stale` (that is, no `TransCue.fallback == true`).
   F4 belongs to `align-stale` and is not reported twice;
4. and one of the following holds:
   - **(a) dwell imbalance**: some translation cue has `end - start ≥ D` and covers ≥2 source rows;
   - **(b) whole-sentence degradation with many source rows**: `correspondence == "sentence"` and `src_rows(s) ≥ S`.

Payload of a hit (used by the UI and `align_instructions`):

```jsonc
{
  "sentence": "s12", "key": "s12",
  "sourceRows": 3,          // src_rows
  "transCues": 1,           // trans_cues.len()
  "maxDwellSec": 6.4,       // dwell of the longest translation cue
  "targetUnits": 8,         // reading units of that cue, used to explain why source_ceiling did not catch it
  "reason": "dwell" | "sentence-level"
}
```

Severity: **warning** (same level as `align-source-ceiling`; it goes into the `fix` string in `next`). A sentence that satisfies only
`src_rows ≥ 2 && trans_cues < src_rows` without (a) or (b) is **not reported**. It is only counted in the metrics, because it is exactly
the legitimate form that the “many-to-one card” in §1.4 describes.

The `fix` string has the same shape as the existing codes, and carries the new switch from §4:

```text
ccut translate <project> --lang <lang> --align-only --align-density paired --sentences a,b,c
```

### 3.3 Thresholds and calibration

Two parameters, with initial values and their basis:

| Parameter | Initial value | Basis |
| --- | --- | --- |
| `D` (dwell upper limit for a single translation cue) | **5.0s** | `LONG_DWELL_SECONDS = 7.0` is the gate that “must ask the LLM to split”. The 5–7s band is exactly the range the 7s gate lets through, yet it clearly exceeds comfortable reading time. Taking 5.0 makes the criterion bite only in that gap and not overlap the 7s gate |
| `S` (source-row floor when the whole sentence is degraded) | **3** | A whole sentence covering 2 source rows is a common normal form of `sentence_level_entry` (crossed word order). It is only worth asking the user to review when it covers 3 or more source rows |

Both are placed in `ccut-flow-core` as `pub const`, and **no surface may copy the literals**.

Calibration method (M4): on existing real projects, export the joint distribution of the triples `(src_rows, maxDwellSec, targetUnits)`,
stratify by `src_rows`, and look at the quantiles of `maxDwellSec`. `D` is set to the lower quartile of the cluster that human blind review judges to be stickiness.
The initial values are first derived from the residual-set reasoning in §1.2. **Before M4, they must not be written as settled numbers into any user-visible copy.**

### 3.4 Implementation location and shared contract

- **Criterion function**: `ccut-flow-core` adds `pub fn row_deficit_issues(doc, sentences, lang, cues)
  -> Vec<RowDeficitIssue>`, placed in `engines::align` alongside `source_ceiling_issues_for_ranges` /
  `paired_density_issue_for_ranges`.
  Source-row segmentation (`source_cue_runs` + `merge_short_runs`) is also lifted into flow-core as `pub fn`.
  **Today this logic exists only as three mirrored copies across three surfaces. Once the criterion references it, the Rust side would become a fourth copy, so the direction should be reversed: Rust becomes the canonical source**,
  and the comments in the three JS/Swift mirrors are changed to point back to flow-core. The rules stay unchanged, character for character, and the existing tests on all three sides
  (the [`subtitle-rendering.test.js:201`](../skills/cuccut/templates/studio/subtitle-rendering.test.js) family) keep passing.
- **check integration**: [`check.rs`](../../../core/crates/ccut-engine/src/flows/check.rs) already derives source cues at `:477` and the translation cue stream at `:940`; both are ready. The new code is just one collection block and one push block.
- **metrics**: `SentenceAlignMetrics` ([`metrics.rs:740–770`](../../../core/crates/ccut-flow-core/src/metrics.rs))
  adds `source_rows: usize`, `trans_cues: usize`, `max_dwell_sec: f64`;
  `AlignMetrics` adds `row_deficit_rate: f64` (hit sentences / translated sentences). This is the data source for M4 calibration, and it lets the `--json` summary run first without changing check severity.
- **refine integration**: the code list at [`refine.rs:95–124`](../../../core/crates/ccut-engine/src/flows/refine.rs) adds `align-row-deficit` (cap `ROW_DEFICIT_MAX_KEYS = 40`, consistent with the family);
  the `note` table at [`refine.rs:196–218`](../../../core/crates/ccut-engine/src/flows/refine.rs) adds one English explanation, for example
  `"one translation row covers {sourceRows} source rows for {maxDwellSec}s — split it along the source rows"`.

M1 stops here. It **changes no engine behaviour, no UI and no spec version**: `ccut check` gains one warning, and `ccut refine-align` gains one class of hotspot.
This step can ship on its own and gives users the diagnostic immediately.

## 4. M2 repair semantics: paired re-splitting

### 4.1 Why the engine must change

Suppose M1 reports a hotspot and we run the existing `ccut translate --align-only --sentences <hotspot>` directly:

1. An R1-type sentence (translation <10 units) enters `align_sentences`, and the first check it hits is
   the `no_entry_needed` gate at [`align.rs:725`](../../../core/crates/ccut-flow-core/src/engines/align.rs).
   Its four conditions are **byte-for-byte identical** to the previous round (translation unchanged, word timings unchanged, parameters unchanged), so it again runs `removals.push`, and the entry again does not exist.
2. R2/F3-type sentences, even when they do reach the LLM round, go through [`align_edges_system_prompt`](../core/crates/ccut-flow-core/src/engines/align.rs:1753), which `--align-only` always uses. That prompt asks for "the smallest natural semantic blocks". It is a different prompt from the fused-draft `fusion_rows_prompt_section`, and this step is not affected by `--align-density`. Even if the model now returns finer blocks, they still pass through the same `bilingual_dp` before being stored, priced by the same [`pair_cost`](../core/crates/ccut-flow-core/src/align_block.rs:1040). `((units - soft) / soft).powi(2)` penalises both directions, too narrow and too wide alike, so the DP naturally welds the fine blocks back into pieces close to the `soft` width. With the parameters unchanged, the cost function is unchanged, and so is the result.

**Conclusion: re-running with the same parameters is a no-op.** The fix has to be expressed as "use a different splitting density for this one sentence". This is the only place where the engine must change, and it is the whole of P3.

**The repair entry point goes through the dedicated edges round, not the rows draft round.** The targeted `--align-only` repair, the fix chain of `ccut check`, `refine-align`, and the targeted buttons in the Mac/App v2 all hit an existing valid `transAlign` (or write the whole sentence through the `no_entry_needed` short circuit). So inside `run_align_with_drafts_and_artifacts` there is no new draft to accept, `accept_fused_drafts` falls through, and the sentence goes into [`plan_sentence`](../core/crates/ccut-flow-core/src/align_block.rs:1310) → `bilingual_dp` → `pair_cost`, the normal block-planning path. Only a **fresh translation** (`ccut translate` without `--align-only`, for a sentence that had no translation before) produces a `--align-fusion rows` draft first, which is handed to `plan_sentence_rows` → `merge_short_rows`. If the next implementer changes paired semantics in the wrong pipeline (`merge_short_rows`), nothing will error, and M2's golden tests will not catch it. The change would only take effect on code that the glued-row repair never actually runs through. This fork has to be recognised first.

### 4.2 The `density` directive

```rust
/// core/crates/ccut-flow-core/src/engines/align.rs
pub enum AlignDensity {
    /// Current: many-to-one is the default shape; short translations are not split just because the source is long.
    Auto,
    /// Second-pass correction: make this sentence aim for one translation row per source row.
    Paired,
}
```

- `AlignOptions` gains `density: AlignDensity` (default `Auto`) and `density_sentences: BTreeSet<String>` (when empty, `density` applies to all targeted sentences). The reason it is **per sentence** rather than a round-wide switch: a single refine-align round also carries other hotspots such as `align-overfit` and `align-source-ceiling`. Those sentences should not be forcibly split more finely.
- CLI: `ccut translate <project> --lang <l> --align-only --align-density <auto|paired>`. The enum values, the default, and the relationship with `--align-fusion` / `--align-mode` are recorded in the translate parameter table in §8 of [`ccut-cli-server-reference.md`](../cli/ccut-cli-server-reference.md). `--align-density paired` is only meaningful under `--align-mode many-to-one` (`independent` has no source anchor). An illegal combination reports an error instead of being silently ignored.
- `ccut refine-align` automatically sets `paired` for sentences **selected because of `align-row-deficit`**. The other hotspot sentences stay at `auto`. This is the reason `density_sentences` exists.

### 4.3 Five differences between `Paired` and `Auto`

For the flagged sentences:

1. **Bypass `no_entry_needed`** ([`align.rs:725`](../../../core/crates/ccut-flow-core/src/engines/align.rs)): when `density == Paired`, this gate is always `false`, so the sentence is necessarily queued and produces an entry. This alone fixes R1.
2. **Push the density semantics down into `pair_cost`**: the real entry point does not go through `merge_short_rows` (see §4.1), so the relaxation has to land in [`pair_cost`](../core/crates/ccut-flow-core/src/align_block.rs:1040), which `bilingual_dp` uses to price each piece. Under paired, the width quadratic penalty for the "narrower than `soft`" direction is removed. Today `((units - soft) / soft).powi(2)` penalises both the aligned and the too-narrow directions; paired exempts only the too-narrow half, which encourages cutting into more short pieces. All other cost terms stay exactly as they are: the quadratic penalty for exceeding `fit`, the hard constraint `units > hard`, the source-side width and time-window penalties (`SOURCE_OVER_FIT_PENALTY` / `PAIRED_SOURCE_MAX_SECONDS` / `PAIRED_SOURCE_HARD_SECONDS`), the reading-duration deficit penalty (`DURATION_DEFICIT_WEIGHT`) and the on-screen-excess penalty (`DURATION_EXCESS_WEIGHT`), the seam penalties (`seam_costs` / `BLOCKING_SEAM_PENALTY`), the block-merge penalty (`BLOCK_MERGE_PENALTY`), and the confidence penalty. `merge_short_rows` keeps its `too_small` check, which relaxes `units < ROW_MIN_UNITS` according to `input.density` ([`align_block.rs:1522–1526`](../../../core/crates/ccut-flow-core/src/align_block.rs)). But that only serves the rows-draft round described in §4.1. It is not the path where the paired repair takes effect. `too_fast` (the reading-speed hard guard) is **kept as is** on both paths. Reading speed is a physiological limit, not a layout preference, and relaxing it would only produce lines nobody can finish reading.

   **Known boundary (measured; M4 must re-check with data)**: the saving from the width term is capped below 1.0. So when the seam price at some cut point is clearly higher, paired still cannot split there. Two kinds of sentences will consistently land in `rowRepair.rejected` for this reason. The first: any split of a very short translation produces fragments of ≤ `MIN_PIECE_CHARS`. `target_cut_candidates` ([`split.rs`](../../../core/crates/ccut-flow-core/src/split.rs), `SeamLintClass::FlashFragment`) assigns `BLOCKING_SEAM_PENALTY` to such seams. **This is kept on purpose.** Relaxing it would allow flash subtitles of two or three characters, which is worse than gluing. Sentences of this kind stay many-to-one and are recorded as `rejected`. That is the correct exit for P4, "leave as-is when exhausted". The second: sentences with no usable punctuation or semantic seam at all (the seam price is `NO_SEAM_PENALTY`). Conversely, sentences whose source-side time window is > `PAIRED_SOURCE_HARD_SECONDS` already split under auto, so paired adds nothing in that range. The range where paired really changes the result is roughly: "the seam price is cheap (≈0.3) and the source-side time window lies between the soft and hard thresholds, or only triggers `SOURCE_OVER_FIT_PENALTY`". So the baseline of `rejected` will be clearly above zero. **Do not treat `rejected > 0` as failure.** During M4 calibration, count the share of each of the two kinds above separately, then decide whether to adjust the lower-bound form in §4.3④.
3. **The prompt paragraph goes through the `AlignOptions.instructions` channel**: `fusion_rows_prompt_section` ([`translate.rs:1392`](../../../core/crates/ccut-flow-core/src/engines/translate.rs)) itself is not changed by a single character. It is the fused-draft prompt that `ccut translate` uses when it generates the first translation. The align-only targeted repair never calls it at all (see §4.1). The paired wording change lives in [`paired_prompt_instructions`](../core/crates/ccut-flow-core/src/engines/align.rs:356). For each sentence hit by paired, an appended note is concatenated sentence by sentence. It says: these sentences should have at least N alignment blocks (`aim for at least N blocks`, meaning give more and finer blocks along adjacent source intervals, and do not collapse the sentence into one block. **The number of rows is decided by the engine's DP. The model cannot control rows on the edges carrier**). It also says: keep the natural translation wording, only run pieces in parallel when reading speed is exceeded or the duration is under 1 second, and do not rewrite or move the translation for this repair. The note is attached through `AlignOptions.instructions` at the end of the contract for the edges/table carrier. This is the "why/how to split" channel that targeted refine already has ([`AlignOptions.instructions`](../core/crates/ccut-flow-core/src/engines/align.rs:421)). It is not a newly opened channel. The original constraint still holds: the row-partition carrier shape of `<span data-src>` must not change. The Agent and the provider must both use the same `is_row_partition` validation, and they must not diverge.
   **Known boundary**: if a sentence hit by `ccut translate --align-density paired` (without `--align-only`) had no translation before, it first goes through the initial translation of `ccut translate`. That step still uses `fusion_rows_prompt_section` ("four groups usually want two rows", a Chinese prompt fragment: “四组通常想要两行”). The paired note is only appended in a later align round, so on this path it has almost no effect. The CLI validation layer already pins paired to **require** `--sentences` (see §4.2 and the CLI reference). This narrows the misuse surface but does not force `--align-only`. The combination that actually works is still `--align-only --align-density paired --sentences …`.
4. **Acceptance by the dwell predicate (revised 2026-09-24)**: the original pure-arithmetic acceptance on the minimum piece count,

   ```text
   pieces.len() ≥ min( src_rows, max(2, ceil(target_units / ROW_MIN_UNITS)) )
   ```

   also rejected good answers that had removed the glue but had one fewer piece (s-g9.0: the answer for a 7-chunk sentence was merged by the engine into 2 pieces, and 4 were required, which gave `below-minimum`. Round 2 of the worker's 3-row answer was rejected for the same reason). Now this number only goes into the prompt ("aim for about N blocks") and into `rejections[].required`. It is guidance, not a quota. Acceptance instead uses the same dwell predicate as `align-row-deficit`, `row_dwell_deficit` (dwell ≥ `ROW_DEFICIT_DWELL_SECONDS` (5s) and coverage of ≥2 merged source rows). The old and new shapes are compared sentence by sentence (glued row count, longest dwell, maximum number of source rows spanned):
   - A new shape with no glue ⇒ accept, regardless of piece count.
   - Still glued, but **strictly better** (none of the three measures is worse and at least one improves), or the original entry is missing or invalid (there was an entry but it no longer matches the current translation, or the whole translation exceeds fit/hard), while the new shape is not worse ⇒ accept. Keep the `align-row-deficit` warning and record `accepted a partial fix` in violations.
   - Otherwise `rejected`, with `reason: "not-improved"`, **keeping the original entry as it was** (P4).
   - Exception first: when the repair call got no usable answer, and the budget tail falls on a model-absent split (`deterministic/1` equal-width splitting, `anchor/1` pure anchors), then as long as the original entry is a model-produced `llm-*` alignment it is directly `rejected` with `reason: "model-free"`. It does not go through the dwell predicate. Equal-width splitting clears glued rows only because it cuts them into finer pieces, not because it is a more correct correspondence. (Field case on 2026-09-30: in a stanford batch, the `align-edge-ordinal` rejection replaced 4 `llm-lines` alignments from the same batch with equal-width or pure-anchor splits, and one sentence's dwell only dropped from 6.8s to 6.5s.) When the original entry is missing, invalid, or itself a model-absent split, acceptance proceeds as usual.

   The engine's planning layer uses this predicate too. If the first-pass plan of `bilingual_dp` is still glued, the second pass adds a penalty to the glued pieces, and only reopens readable pieces (≥ `ROW_MIN_UNITS` units, duration ≥ minimum duration, reading speed ≤ `ROW_MAX_CPS`) as new cut points. `merge_short_rows` no longer merges two pieces back into one glued row just because they are "too narrow".
5. **The fragment guard is not relaxed**: the result must still pass `align_entry_valid` ([`split.rs:983`](../../../core/crates/ccut-flow-core/src/split.rs)), `source_fragment_issues` (a "narrow source paired with wide translation" check, where a source span of ≤2 words is paired with ≥8 units of translation, [`align.rs:3513–3527`](../../../core/crates/ccut-flow-core/src/engines/align.rs)), and the block-level I3/I4 checks. Paired relaxes "a translation row may be short". It does not relax "a source anchor may be fragmented".

### 4.4 Bookkeeping

`AlignOutcome` gains a `row_repair` envelope, emitted with the translate `--json` and report output (alongside the existing `rowsMerged`, [`translate.rs:568`](../../../core/crates/ccut-engine/src/flows/translate.rs)):

```jsonc
"rowRepair": {
  "candidates": 37,   // sentences enqueued with the paired flag
  "repaired": 29,     // passed the §4.3 ④ acceptance check and were written
  "rejected": 6,      // new shape still stuck and no better than the original; original kept
  "capped": 2,        // cut off by the 40-sentence cap, left for the next round
  "rejections": [     // per-sentence details of rejected sentences, up to 40 entries
    {
      "sentence": "s-g21.1",
      "reason": "not-improved",   // | "no-write" | "rewritten-basis" | "model-free"
      "sourceRows": 4,            // number of source subtitle rows this sentence currently occupies
      "targetUnits": 14,          // display units of the translation (CJK counted as full-width)
      "required": 3,              // suggested piece count in the prompt (guidance) = min(sourceRows, max(2, ceil(targetUnits / 6)))
      "delivered": 1,             // pieces actually delivered this round
      "unitsPerRow": 3.5          // targetUnits / sourceRows
    }
  ],
  "rejectionsTruncated": 0        // rejected sentences beyond the 40-entry cap, counted only
}
```

A non-zero `rejected` is not a failure; it is the normal exit of P4. But with counts alone, "38 candidates → 38 rejected → 0 repaired" cannot tell whether the acceptance check is too strict or whether this batch simply cannot be split into that many pieces in the target language. So each rejected sentence records the two metrics that go into `required`: when `unitsPerRow` is clearly below `ROW_MIN_UNITS` (6), the translation does not have enough characters to fill its source rows. That is a structural condition that cannot be satisfied, and changing the prompt will not help.

### 4.5 Contract sync obligation (mandatory)

Any change to the prompt section or the acceptance checker must land on **both** paths at the same time: the local Agent and the Cloud Model/provider. The two share one parser and one row-partition validator ([`translate_html.rs:87`](../../../core/crates/ccut-flow-core/src/filepipe/translate_html.rs) `is_row_partition`, exported via [`filepipe/mod.rs:68`](../../../core/crates/ccut-flow-core/src/filepipe/mod.rs)). The paired variant therefore **must not** introduce a new carrier shape. It may only change the prompt wording and the post-write acceptance threshold; the `<span data-src="a-b">` row-partition shape stays exactly as it is. Shared regression tests are updated in the same batch.

## 5. M3 four-surface UI

Common rule: the "stuck" count always comes from the shared criterion in §3.4 and never reads the `check` report file. Each surface (Swift/Rust/JS) computes it with the same rule, or consumes the metrics exported by the engine. `jobs.json` remains the single source of truth for task state; surfaces do not keep their own progress.

### 5.1 apps/mac

- **statbar**: `TransStatBar.stats` gains `stuck: Int`, adding a warning-colored stat item "N stuck" (N 处黏结). Its priority sits between `untrans` and stale. When the bar is narrow, the raw counts drop first and the actionable warning is kept longer, following the `Stat.priority` mechanism in [`TranslatePaneSupport.swift:400`](../apps/mac/Sources/VoiceInk/Translation/Pane/TranslatePaneSupport.swift). Clicking it calls `onRepairRows`, mirroring the existing `onRetranslate`.
- **Confirmation dialog**: reuse `AlignSetupBody` ([`AlignSetupBody.swift`](../apps/mac/Sources/VoiceInk/AI/Flows/Translate/AlignSetupBody.swift)). The title changes to “Re-align by source row” (按源行重新对齐). The footnote's `≈N lines` uses the number of stuck sentences. After confirmation, call `startAlign(keys:)` ([`TranslatePaneActions.swift:72`](../apps/mac/Sources/VoiceInk/Translation/Pane/TranslatePaneActions.swift)).
- **Request assembly**: in the `alignOnly` branch of [`Contracts.swift:458`](../apps/mac/Sources/CucCutCore/Contracts.swift), add `result["alignDensity"] = .string("paired")`. This applies only when the request starts from the stuck-row entry point.
- **Sentence card context menu**: add “Re-align by source row” (按源行拆分对齐) below “Re-align this line”, in [`TransSentenceCardView.swift:365`](../apps/mac/Sources/VoiceInk/Translation/Card/TransSentenceCardView.swift). It takes the same path with `density = paired`.
- **Card badge**: `TranslateCardBadge` gains `.rowStuck` (warning tier), with the text "N source lines share one row" (N 条原文共用一行). It is mutually exclusive with `.realigning`, and the running state takes priority. **It must coexist with the many-to-one chip from §1.4**: the chip says this is the default shape, while the badge appears only when the criterion is met.
- The Result stage, Undo, and the running header (`TransRunInfo`) all stay as they are. No new branches.

### 5.2 App v2 (apps/cuccut)

- `AlignSpec::Scoped` gains `density: AlignDensity` ([`ai/mod.rs:112`](../../../apps/cuccut/src/app/editor/ai/mod.rs)). Add a `start_align_paired` entry point to `start_align`, and pass `alignDensity` through when the job is submitted.
- The sentence card's right-click `TranslateCardAction` and the hover `SentenceOp` each gain a `RealignPaired` item ([`lists/translate.rs:2157`](../../../apps/cuccut/src/app/editor/lists/translate.rs) and [`:2224`](../../../apps/cuccut/src/app/editor/lists/translate.rs)). This follows the established decision to run directly without opening a settings window ([`product-design/13/13.2/13.2.13.md:29`](../product/product-design/13/13.2/13.2.13.md)).
- The statbar adds a stuck-count item, the same as on Mac. v2's running header does not change.

### 5.3 Studio web (skills/cuccut/templates/studio)

Studio has **no AI task submission endpoint** (§1.4), so:

- `translate-pane.js` adds only a **read-only** "stuck N" count (黏结 N) to the stat bar, in the warning color and not clickable. This does not conflict with the existing rule against drawing non-clickable fake actions: a non-clickable count is a static fact, while a non-clickable **action** is the fake kind.
- The count reuses `mergeShortRuns` already in `subtitle-rendering.js` ([`:226`](../skills/cuccut/templates/studio/subtitle-rendering.js)) and the translation cue projection. The rule matches flow-core case by case, and a new `subtitle-rendering.test.js` case locks it down.
- No new fetch endpoints and no new buttons.

### 5.4 designs/ prototypes

- [`designs/cuccut/`](../../../designs/cuccut/README.md): on the Subtitle · Edit board, the statbar gains the stuck-count item. The four block-semantics demo cards gain a fifth, the “stuck card”. Its shape is a many-to-one card plus a warning chip, with the note "This Chinese line stays on screen for 6.4s and covers 3 source subtitle lines, longer than a comfortable reading time" (这一条中文停留 6.4s、覆盖 3 条原文字幕，超过了舒适阅读时长). In the same round, update [`product-design.md`](../product/product-design.md) §13.2 and the round log in this directory's README. This is the mandatory sync rule for `designs/cuccut`.
- [`designs/cuccut-mac/`](../designs/cuccut-mac/CLAUDE.md): change the `mergeShortRuns` comment in `app/translate-model.js` to point back to flow-core. Sync the count item in the statbar.

### 5.5 apps/windows (archived)

There is no translate/align UI here, so this does not apply, and no placeholder implementation is created. On 2026-08-26 this directory was archived and deleted. This section is kept only as a record of the M3 surface inventory.

## 6. M4 acceptance, calibration and transition plan

### 6.1 Unit tests

- **Golden tests for the five shapes** (one fixture each for F1–F5 in §1.3): F1/F2/F3 must report `align-row-deficit` (when (a)/(b) are met). F4 reports only `align-stale` and is not reported twice. F5 reports nothing.
- **Legitimate many-to-one negative case**: a translation of 12 units covering 2 source rows, dwelling 3.2s ⇒ it **must not** match (the P6 lock).
- **Paired plan probe**: the real entry point is `plan_sentence` → `bilingual_dp` → `pair_cost` (see §4.1), not `plan_sentence_rows` + `merge_short_rows` (that path serves only the rows draft). Run the same fixture through `plan_sentence` with `Auto` and with `Paired`. Assert that `Auto` yields 1 piece, that `Paired` yields ≥2 pieces, and that in both cases `concat(pieces) == target` (paired does not rewrite the translation). Separately probe `pair_cost`: when `units ≥ soft`, `Auto` and `Paired` must have byte-identical cost; only the narrow-side cost for `units < soft` is waived by paired.
- **Suggested piece count**: for a translation of 6 units across 3 source rows, assert that the suggested piece count in the prompt is clamped to 2 by `min`, not 3.
- **Dwell acceptance** (2026-09-24): sentence s-g9.0 source words plus an answer of 7 chunks ⇒ ≥3 rows with no stuck; fewer than the suggested count but no stuck ⇒ accept; a strictly better partial repair ⇒ accept and warn; no improvement ⇒ `not-improved` (`sg9_*` tests in `align.rs`).
- **Shared parser tests**: answers produced by the paired prompt variant must still pass `is_row_partition`. The Agent lint and the provider parse use the same assertion set (§4.5).
- **Mirror consistency**: flow-core `merge_short_runs` must align case by case with the existing cases in the [`subtitle-rendering.test.js:201`](../skills/cuccut/templates/studio/subtitle-rendering.test.js) family (same input, same output).

### 6.2 Live-run comparison

Two projects: a short film (IBM, 9 min, the existing comparison baseline) and a long film (≥1h). Run each as `before` (current state) and `after` (M2 fully enabled plus one refine-align round), then compare:

| Metric | Source | Expected direction |
| --- | --- | --- |
| Sentences with `src_rows ≥ 2` and `maxDwellSec ≥ D` | new metrics | Drops significantly |
| Share of translation cues with cps > 6 | existing comparison basis | **Must not rise** (paired keeps the reading-speed hard guard; this is what it is verified against) |
| overFit (share of pieces exceeding `fit`) | existing | A small rise is allowed (pieces get shorter, so this should drop; if it rises, the merge guard is inverted) |
| Sentence count at `align-sentence-level` | check | Must not rise |
| `rowRepair.rejected / candidates` | new --json | Record, to judge whether the acceptance check is too strict |
| Blind-review fidelity | manual | Must not drop (paired does not change `trans`, so it should be identical in theory; sampling confirms no rewrite path leaked through) |

Calibration output: the fixed values for `D` and `S`, and whether the denominator in §4.3 ④ should change from `ROW_MIN_UNITS`.

### 6.3 Transition plan (what users can do before M2 lands)

Today users can already do the following:

```bash
ccut check <project> --lang zh          # look at align-stale / align-source-ceiling / align-overfit
ccut refine-align <project> --lang zh   # check → targeted re-align → review
ccut translate <project> --lang zh --align-only --sentences s12,s13
```

On the Mac side, the corresponding entries are the AI menu's “Re-align … lines…” and the sentence card's “Re-align this line”.

**This only partly mitigates the problem, and does not fix the root cause**, for two reasons from §4.1. R1 sentences (translation <10 units) hit the same `no_entry_needed` gate on re-run, giving exactly the same result. Only sentences that already have an entry, and that are caught by other codes (`align-overfit` / `align-source-ceiling`), can improve. The user-visible effect "re-aligned once, but the stickiest few lines did not change" is the direct consequence of this mechanism. This must be written into the release notes so the transition plan is not mistaken for a fix.

## 7. Registration and sync checklist

| Item | Milestone | Location |
| --- | --- | --- |
| New check code `align-row-deficit` | M1 | [`check.rs`](../../../core/crates/ccut-engine/src/flows/check.rs); the code table docs for `ccut check` |
| New branches in `hotspot_keys` / `align_instructions` | M1 | [`refine.rs:95`](../../../core/crates/ccut-engine/src/flows/refine.rs) / [`:196`](../../../core/crates/ccut-engine/src/flows/refine.rs) |
| New metrics fields | M1 | [`metrics.rs`](../../../core/crates/ccut-flow-core/src/metrics.rs); a change in `--json` shape must be noted in the reference docs |
| CLI `--align-density` | M2 | Near [`core/crates/ccut-kernel/src/cmd/ai.rs:380`](../../../core/crates/ccut-kernel/src/cmd/ai.rs) (same family as `align_fusion`); `ccut spec` echoes it automatically |
| serve allowlist `alignDensity` | M2 | Options table for the `translate` kind in [`supervisor.rs`](../../../core/crates/ccut-serve/src/supervisor.rs) + contract tests in [`contract.rs`](../../../core/crates/ccut-kernel/src/serve_contract.rs) |
| **Spec version bump 1.34.0 → 1.35.0** | M2 | [`core/crates/ccut-kernel/src/cmd/spec.rs:7`](../../../core/crates/ccut-kernel/src/cmd/spec.rs). A new job option is a protocol-surface change, so the bump is required |
| CLI/serve reference docs | M2 | [`ccut-cli-server-reference.md`](../cli/ccut-cli-server-reference.md): add `alignDensity`:`string` → `--align-density` to the `translate` row in §4.5; in the translate parameter table in §8, add the enum, default value, and the conflict rules with `--align-mode`; the `rowRepair` envelope for `--json` |
| Four-surface UI | M3 | Items in §5; `apps/windows` is explicitly not applicable (and was archived and deleted on 2026-08-26) |
| Product design doc | M3 | [`product-design.md`](../product/product-design.md) §13.2 (statbar count item + stuck card); round log in `designs/cuccut/README.md` |
| CLI `--no-row-repair` + serve allowlist `noRowRepair` + **spec bump 1.35.0 → 1.36.0** | M5 | [`core/crates/ccut-kernel/src/cmd/ai.rs`](../../../core/crates/ccut-kernel/src/cmd/ai.rs) `TranslateArgs` / [`supervisor.rs`](../../../core/crates/ccut-serve/src/supervisor.rs) `translate` kind / [`contract.rs`](../../../core/crates/ccut-kernel/src/serve_contract.rs) contract tests / [`spec.rs:7`](../../../core/crates/ccut-kernel/src/cmd/spec.rs); sync the three `specVersion` assertions in the integration tests |
| New `rowRepairAuto` / `rowRepairAutoSkipped` in `--json` | M5 | The summaries of both variants in [`translate.rs`](../../../core/crates/ccut-engine/src/flows/translate.rs); the `--json` summary section §8 of [`ccut-cli-server-reference.md`](../cli/ccut-cli-server-reference.md) |
| Backlink from this document | M1 | Add one line to the document routing table in [`AGENTS.md`](../../../AGENTS.md) |

**Not needed**: a new job kind, a new lane, a new `AIFlowKind`, a new stage stamp, a new fingerprint, or a transcript version change (the `transAlign` shape does not change).

## 8. Rejected approaches

- **A new standalone flow / wave kind (`row-repair`).** The registration surface is large: the job-kind allowlist, lanes, stage stamps, and the kind mappings across four surfaces ([`FlowLiveProjector.swift:22`](../apps/mac/Sources/VoiceInk/Adapters/FlowLiveProjector.swift), [`task_kind.rs:451`](../apps/cuccut/src/adapters/task_kind.rs), [`progress-status.js:33`](../skills/cuccut/templates/studio/progress-status.js)), plus the spec and the reference docs, would all have to change. But the closed-loop skeleton of `refine-align` (check → hotspots → targeted → re-check) is **item-for-item isomorphic** with the shape this plan needs; this plan only has to add one code and one instruction slot to it. Paying the registration cost for a semantically duplicate kind is not worth it.
- **Putting the source cue count directly into the main translation prompt.** This violates the existing ruling that "translation alignment always first fixes the target-language translation independently and freezes the translated Cues, then maps them onto source word spans." Having the model match source line counts while translating would stretch or chop sentences to fit the rows, degrading fidelity across the whole document, when the clumping is only a problem for a few sentences. We would pay a whole-document cost for a local gain.
- **Indiscriminately lowering `LONG_DWELL_SECONDS` or `TransParams.fit`.** These two constants are global thresholds. Lowering them would split **all** legitimate many-to-one cases: lowering `LONG_DWELL` from 7s to 5s would send many normal 5–7s full sentences to the LLM for splitting (call volume and degradation rate both rise), and lowering `fit` from 16 directly changes the single-line capacity and the derived cue shapes for every language. The criterion needs to bite only the residual set, which a global threshold cannot do.
- **Splitting lines locally on the Mac, without writing back to the transcript.** It looks like the cheapest option: the Mac already computes `sourceRuns`, so it could split the translation proportionally along the source rows for display. But this violates the single source of truth. The split result never enters `transAlign`, so export (SRT/burn-in), Studio, App v2 and the CLI would all miss it, the same project would show different row counts on different surfaces, and the next `ccut check` would still report the same problem. Display splitting must be a persisted overlay.
- **Making the criterion a new `reason` of `align-stale`.** `align-stale` means "entry missing or invalidated, causing degradation", and its fix is to rebuild the entry. A clumped sentence's entry is often **valid**; it just has the wrong density. Mixing it into the same code would let the unbounded branch of `hotspot_keys` (which has no 40 cap) swallow every clumped sentence, and the targeted sentence set of a single refine round would spiral out of control.

## 9. Implementation milestones and task breakdown

Each milestone can be accepted and released independently.

### M1 · Criterion and diagnostics (no UI changes, no spec bump)

Scope: move `source_cue_runs` / `merge_short_runs` up into flow-core; `row_deficit_issues`; the new check code; new metrics fields; wire into refine; the §6.1 unit tests (all except the paired probe).

Done when: on existing real-run projects, `ccut check --json` lists the clumped sentences with their `sourceRows/transCues/maxDwellSec`; legitimate many-to-one negative cases do not hit; the existing tests of the three JS/Swift mirrors are all green.

```bash
cd core
cargo fmt --all -- --check
cargo test -p ccut-flow-core
cargo test -p ccut-engine
cd ../skills/cuccut/templates/studio && node --test subtitle-rendering.test.js
```

### M2 · Paired re-split semantics (engine + CLI + serve + docs)

Scope: `AlignDensity`; the `no_entry_needed` bypass; the paired branch of `merge_short_rows`; prompt variants; the minimum piece-count acceptance; `rowRepair` accounting; `--align-density`; the serve allowlist + contract tests; spec bump to 1.35.0; the reference docs in three places.

Done when: `--align-density paired --sentences <clumped sentence>` must produce ≥2 pieces for R1-type sentences, or record an explicit `rejected` in the ledger; the `auto` path's golden output stays **byte-for-byte identical** (zero behaviour drift is this milestone's first acceptance item); serve contract tests cover the new option; `ccut spec` echoes the new enum.

```bash
cd core
cargo fmt --all -- --check
cargo test -p ccut-flow-core
cargo test -p ccut-engine
cargo test --workspace          # cross-crate: serve contract tests live in apps/cli
```

### M3 · Four-surface UI

Scope: §5.1–§5.4. Mac, App v2, Studio, the two prototype directories + `product-design.md`.

Done when: the four applicable surfaces each show the same clumped-sentence count (same project, same value); Mac and App v2 can start a paired targeted rerun and reflect it in the running-state header/badge; Studio is read-only; `apps/windows` (archived) is explicitly marked not applicable in the final reply. Each surface runs its own tests according to risk (Swift unit tests, `cargo test -p cuccut`, `node --test`, prototype visual check + `check-conformance.mjs`).

### M4 · Calibration and real-run acceptance

Scope: before/after comparison of the two projects in §6.2; settle `D` / `S`; if necessary, tighten the acceptance formula in §4.3 ④ afterwards; state the boundaries of the §6.3 transitional plan clearly in the release note.

Done when: the clumped-sentence count drops significantly and the share with cps>6 does not rise; blind-rated fidelity does not drop; the thresholds are written back to the `pub const` and the user-visible copy at their settled values.

Real runs are heavy work; follow the existing discipline of "don't run heavy work in parallel": short and long films run serially, and `--llm-concurrency` stays at its default.

### M5 · Automatic re-split at the end of translation (completed 2026-08-28)

M2 delivered a **manual** repair channel: `ccut check` reports `align-row-deficit`, and the user copies `ccut translate --align-only --align-density paired --sentences …` by hand, or runs `ccut refine-align`. M5 wires this channel into `ccut translate` itself, so users see no clumping after translating and need no manual command.

**Shape**: in the per-language loop of the single-document `translate_cmd_core_with_analysis`, after the main alignment round receives `align_outcome` and before `cancel_point` / `save_doc`, insert one fixed single-round paired targeted re-split (`plan_row_repair_tail` + `run_row_repair_tail` in [`translate.rs`](../../../core/crates/ccut-engine/src/flows/translate.rs)). It must run inside the flow: in review mode the doc is not written to disk, so the candidate bundle itself must contain the repair result, and a rejection rolls back the whole bundle.

**Detection**: reuse check's single predicate entry point `row_deficit_issues`. It is deterministic, zero LLM, and duplicates no thresholds. The translated cues must be re-derived with `derive_trans_cues` **after** the main alignment: it reads `trans` / `transAlign`, which the main round has just changed. Reusing a derivation from before the main round would yield an empty hit set, and the tail round would never fire.

**Four skip criteria** (any one hit skips, producing no second call): `--no-row-repair`; this round's `--align-density` is already `paired`; this round wrote nothing (`translated == 0 && aligned == 0`, so repeated translate runs remain no-ops); detection finds no hits. The skip reason is echoed in `rowRepairAutoSkipped` in `--json`.

**Selection**: intersect the hit set with this round's `--sentences` (a targeted re-translation only tidies the sentences it touched itself; legacy clumping remains with check + `refine-align`), and truncate to `ROW_DEFICIT_MAX_KEYS` (40, sharing the same `pub const` as refine's clumping round, so no duplicate literal) as `sentences`. The **full** hit set goes whole as `density_sentences`, and the engine counts the difference into `row_repair.capped` for the next round.

**Execution**: a second `run_align_with_drafts_and_artifacts` call, with `density: Paired`, `targeted: true`, `force: true`, `repair_calls: 0`, and empty `FusionDrafts` (paired uses its dedicated edges round); the other fields take the same sources as the main round. `force: true` is not optional: by definition the hit sentences already have **valid** ManyToOne entries, and a non-force round would skip the whole batch at the “existing valid entry with same mode: skipped without force” check in [`align.rs`](../../../core/crates/ccut-flow-core/src/engines/align.rs), turning the tail round into a zero-call no-op. The audit artifact's run mode is `row-repair-tail`, kept separate from the main round's manifest.

**Accounting**: `rowRepairAuto` is a four-counter object with a fixed shape (all four `0` when skipped or not applicable), so consumers never need to branch on `null`. The engine has a built-in "keep as-is if re-splitting fails" rule (dwell check fails ⇒ `rejected`, original entry unchanged), so `rejected > 0` is not a failure. The tail round's violations are merged into the advisory with the prefix `<lang> (row-repair-tail): …`. It writes only `transAlign` and never touches the sentence-level translation truth `trans`.

**Callers**: the translate round embedded in `ccut auto` passes `false` (fast mode benefits directly); the targeted `translate --align-only` round inside `refine-align` passes `true`, because it is itself a repair round, which prevents repair-of-repair (its `align_density` is often already `paired`, so the two gates are mutually redundant).

**Timeline variant not done (V1 explicitly skipped, not silently)**: `translate_timeline_cmd_core` calls `run_align_projected` per material, and alignment is built on the **visible-word projection**. `row_deficit_issues`'s `source_rows`, however, are derived from the cues of the whole document, which counts cut words into the source rows. The two bases are inconsistent, and wiring them together would give a wrong hit set. That variant's summary records `rowRepairAutoSkipped: "timeline-unsupported"`, `rowRepairAuto` with all four `0`, and attaches an advisory pointing to `ccut check` + `ccut refine-align`. Enabling it requires first giving `row_deficit_issues` a projection input, which is a separate milestone.

**Tests**: the whole translate flow builds its LLM in-process (`make_llm` constructs `AgentLlm` directly in agent mode), and there is no seam for injecting fixtures. The tests therefore target the tail round itself and its pure judgement, not the whole flow run end to end. `row_repair_tail_tests` in `core/crates/ccut-engine/src/flows/tests.rs` covers: a clumped sentence re-split into ≥2 pieces with exactly 1 call (the sentinel that force takes effect) and `trans` byte-for-byte unchanged; if re-splitting fails, `rejected` with the original entry untouched; one case for each of the four skip criteria; the `--sentences` intersection; and truncation to 40 of 45 hit sentences.
