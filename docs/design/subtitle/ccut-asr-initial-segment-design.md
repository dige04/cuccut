> Ported from CucCut v2. The data model names in this document (such as TranscriptDoc) refer to the v2 models. For their correspondence to the v3 document model, see [Architecture design §14](../../architecture/architecture-design.md#14-items-pending-review).

# Initial Soft Segmentation Design for ASR Segments (Revised)

> Status: implemented (2026-08-26). This revision updates the first draft after checking the code. Revision points are listed in §11.

## 0. Core conclusion

The segments returned by the model are used for the "initial paragraph display after transcription completes". They are not written directly into `paraBreaks` in `transcript.json`, and they do not stamp `stages.segment`. The later polish/segment step still produces the formal semantic segmentation.

The initial segments are a **promotable projection**, not a fourth kind of persistent segmentation truth:

- They provide a better initial result immediately than "one paragraph per speaker turn".
- They do not mistake the model's decoding chunks for final paragraphs.
- Polish keeps full freedom to re-merge and re-split.

Three revised premises (see §11 for details):

1. The existing derivation rules at the paragraph layer (`derive_paras`) have only three boundaries: pin, speaker change, and chapter change ([cue.rs:235](../../../core/crates/ccut-flow-core/src/cue.rs)). **There is no pause rule.** The 1.8-second value is a constant at the Sentence layer. Pause boundaries must be produced by the initial segmentation algorithm itself.
2. The Web Studio only polls `studio/data.json` on disk (the serve-side `POLL_FILES`, [media.rs:723](../../../core/crates/ccut-serve/src/endpoints/media.rs)). It does not call the projection function. Initial boundaries must be **written into data.json** by `projection::refresh`. A clone that exists only in memory is invisible to the Web.
3. `derive_paras` recognizes only pins on the **first word of a Cue**. Formal splits therefore write `paraBreaks[next]=true` and `breaks[prev]="break"` as a pair ([source_paragraph.rs:92](../../../core/crates/ccut-flow-core/src/source_paragraph.rs)). Both injecting and promoting initial boundaries must reuse the same paired semantics. Writing only `paraBreaks` would be silently ignored, or the boundary would be lost after promotion.

## 1. Data flow

```text
ASR model
  │
  ├─ raw segments ───────────────► ai/asr-rows.json
  │                                  audit source of truth (engine.segmentation records the source)
  ▼
RowIn[]
  │
  ├─ build_doc ──────────────────► transcript.json words[]
  │                                  persistent source of truth; does not write paraBreaks
  │
  └─ derive_initial_segment_plan ─► InitialSegmentPlan (pure function, deterministic)
                                          │
                                projection::refresh / project_language
                                paired injection into the clone: paraBreaks+breaks
                                          │
                                     studio/data.json written to disk
                                (transcript.json unchanged; data.json is already a derived cache)
                 ┌────────────────────────┴────────────────────┐
                 ▼                                              ▼
          User has not edited; polish runs              User submits any Cue/Para-level op
                 │                                              │
       LLM re-merges/re-splits and writes            Atomically promoted to formal
       paraBreaks + stages.segment                   paraBreaks+breaks + segment stamp
       (initial projection exits automatically)      (then the op is applied)
```

## 2. Data model

V1 does not modify the `transcript.json` 0.4 structure, and it does not add a new persistent segmentation source of truth.

### 2.1 Source annotation in `ai/asr-rows.json`

Add an optional field to `TranscriptEngine` ([transcript.rs:6]):

```rust
pub struct TranscriptEngine {
    pub id: String,
    pub aligner: Option<String>,
    pub vad: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub segmentation: Option<RowSegmentation>,
}

#[serde(rename_all = "lowercase")]
pub enum RowSegmentation {
    Model,     // MOSS native timestamp segments (local and remote)
    Provider,  // OpenAI segments[], Volcano utterances[]
    Host,      // Rows the host synthesizes from the provider word stream (ElevenLabs three-condition line splitting)
    Vad,       // Silero VAD spans for Qwen/Whisper: an acoustic window, not a semantic boundary
    Synthetic, // Rows synthesized from the whole text; DashScope fixed-duration windows
}
```

Constraints:

- **The field must be in the struct, not only written to JSON.** The `seed-transcript` write-back is a typed re-serialization ([project.rs:1020]), so keys outside the struct are erased. The top-level `remote` stamp is already lost this way today.
- `version` stays `"0.1"`. `Transcript` has no `deny_unknown_fields`, so older readers silently ignore the new field, which keeps compatibility.
- The source is filled in **each parse branch according to the actual path**, not uniformly by provider. When OpenAI `segments[]` is empty and degrades to a synthetic single row, the value must be `Synthetic`, not `Provider`.
- Only `Model` and `Provider` take part in initial soft segmentation by default. `Host` takes part by default but is labelled separately (see §7). `Vad` and `Synthetic` do not take part.

### 2.2 Contract obligations of the first production reader

No production code in the repository currently **reads** `ai/asr-rows.json` from disk. The only consumer, `seed-transcript`, reads the same contract from stdin. The projection layer becomes the first production reader and must handle the following:

- [docs/design/subtitle/ccut-ai-pipeline-design.md](ccut-ai-pipeline-design.md) claims that the audit artifact carries a `fingerprint` field and that "readers must validate it". However, the `Transcript` struct has no such field. This task corrects the document: source matching is reconciled by `media.hash` (see §5), and no new fingerprint field is introduced.
- Make the degradation path explicit. If the file is missing, parsing fails, `validate()` does not pass, `version` is not recognized, or `segmentation` is missing or outside the enabled set, **silently disable initial projection** and fall back to the current behavior. Do not report an error and do not block the projection build.

### 2.3 Runtime structures (not in the main document)

```rust
pub struct InitialSegmentPlan {
    pub source: RowSegmentation,
    pub input_fingerprint: String,       // id_fingerprint(words), consistency check on promotion
    pub boundaries: Vec<InitialBoundary>,
}

pub struct InitialBoundary {
    pub para_word_id: String,            // First word id of the paragraph (paraBreaks key)
    pub break_after_word_id: String,     // Previous word id (breaks key, paired semantics)
    pub strength: BoundaryStrength,
    pub evidence: Vec<BoundaryEvidence>,
}
```

`InitialBoundary` carries the paired keys directly, so injection and promotion share them and do not each convert them separately.

## 3. Initial segmentation algorithm

Add `ccut-flow-core::initial_segment`. Input: `TranscriptDoc + ASR RowIn[] + RowSegmentation`. Output: a deterministic `InitialSegmentPlan`. It is a pure function with no I/O and no randomness.

### 3.1 Reverse lookup from row to word id

Reuse rather than rewrite. Extract the shared mapping logic (row-order replay and `row_index_of`) from `realign_to_row_speakers` ([speaker.rs:253]). That implementation covers four known pitfalls:

1. File row order is not `gN` order. The mapping must replay the same "drop empty rows, then stable sort by start" that `build_doc` uses.
2. The column number of a row's first word is not guaranteed to be 0, because `enumerate` runs before `filter`. The paragraph anchor takes the word with the **smallest column number** in `words[]` for that row. It does not construct `g{N}.0`.
3. Some rows take up a row number but produce no words (the `continue` in `build.rs`). Such rows produce no boundary, and the anchor moves on to the next mappable row.
4. After a rebind, ids lose the `gN` form. The enabling conditions in §5 exclude this case naturally, so the algorithm does not handle it.

### 3.2 Candidate boundaries and aggregation

Candidate boundaries come from the seams between adjacent model rows. Each candidate is graded by its evidence:

1. Speaker change: **not written**. The existing Para-layer rules already produce this boundary, and a duplicate pin would only add noise at promotion time.
2. Complete sentence-ending punctuation plus a seam pause of at least 1.8s (strongest);
3. Complete sentence-ending punctuation;
4. Seam pause of 0.6–1.8s;
5. Clause punctuation;
6. Ordinary model segment seam (weakest).

Note that the pause evidence for levels 2 and 4 is **produced by the algorithm itself**. It does not depend on any Para-layer derivation rule, because that rule does not exist (see §0).

Aggregation strategy: do not turn every model segment into a paragraph. Consecutive rows are aggregated first. A strong boundary is accepted only after the minimum content amount is met. When the maximum length is reached, fall back to the highest-grade candidate within the window. Internal constants for the first version (no new CLI parameters; calibrate against real corpora):

```rust
MIN_PARAGRAPH_SECONDS   = 8.0
MIN_CJK_CHARS           = 24
MIN_LATIN_WORDS         = 12
TARGET_PARAGRAPH_SECONDS = 20.0
MAX_PARAGRAPH_SECONDS   = 45.0
MAX_CJK_CHARS           = 240
MAX_LATIN_WORDS         = 120
```

The hard limits match the order of magnitude of the segment engine's existing fallback constants (soft 200 / hard 400 characters, 1.2s, [segment.rs:43]). The "Latin 300 / CJK 500" values in the first draft have no source in the code, so they are dropped.

Expected effect: segments that MOSS emits every 2–4 seconds are aggregated into initial paragraphs of roughly 10–30 seconds.

## 4. Projection semantics

### 4.1 Injection point

Modify the shared projection layer [projection.rs](../../../core/crates/ccut-workspace/src/studio/projection.rs), which is the only build implementation of `studio/data.json`. Inject uniformly before the derivation entry point of `build`:

- `refresh` (disk-write path): after injection, the result is written to disk together with `data.json`. Web reads the file by polling, and this is the only way it sees the initial paragraphs.
- `project_language` (in-memory reprojection when the App changes display language): the same injection. Otherwise the initial paragraphs disappear after switching language.

Injection method: clone `TranscriptDoc`, and for each `InitialBoundary`, write **in pairs** into the clone:

```rust
clone.para_breaks.insert(b.para_word_id, true);
clone.breaks.insert(b.break_after_word_id, BreakOverride::Break);
```

The `transcript.json` on disk is not touched. Injection changes the clone's `effective_breaks`, which ensures that the anchor word becomes the first word of a Cue and that `derive_paras` reads the pin.

### 4.2 Enabling conditions (inject only when all are met)

- `stages.segment` is absent, or stale (`!= id_fingerprint(words)`);
- `ai/asr-rows.json` exists, parses, passes `validate()`, and its `media.hash` matches `DocMedia.hash`. Both write the same `sha256-…` string, so a direct string comparison works;
- `segmentation ∈ {model, provider, host}`;
- **Structural criterion**: all ids in `words[]` have the form `gN.*` (including `~k` atoms). Ids of the form `w…` produced by a polish rebind naturally invalidate it. Do not use `stages.asr == fingerprint(words)` as the primary criterion. That is a text content fingerprint. Old projects get it backfilled on upgrade ([upgrade.rs:434]), `patch_stages` can rewrite it arbitrarily, and it proves that the text is unchanged, not that the id structure is unchanged;
- `para_breaks` is empty. If the user has written any scattered pin through the `patchTranscript.set.paraBreaks` side channel (this side channel is really reachable and has contract tests), it counts as an existing manual segmentation intent. Initial projection then exits, which avoids mixed semantics.

### 4.3 Projection metadata

```json
{
  "initialSegments": {
    "active": true,
    "source": "model",
    "provisional": true,
    "paragraphs": 86
  }
}
```

The App and the Web consume the same `data.json`. Paragraph ids (`p-<first word id>`) and the Cue/Sentence derivation are fully identical, so there is no cross-platform algorithm drift.

## 5. Relationship with polish/segment

The initial plan does not affect the formal AI stage:

- The polish input still comes from `words[]`. Initial boundaries are not treated as hard constraints, so model segments may be freely merged or split.
- After polish completes, write the formal `paraBreaks` and stamp `stages.segment` as the existing logic does (only when `stages.segment.is_none()` and non-degenerate, [polish.rs:3470](../../../core/crates/ccut-flow-core/src/engines/polish.rs)). At the same time, rebind word ids so they leave the `gN` form. Each of the two conditions alone would make the initial projection exit, so this is a double safeguard.
- **Do not stamp `stages.segment` early**, otherwise polish would skip its segment derivation.
- `run_segment` has no guard and reruns unconditionally, and its pins only grow, never shrink ([segment.rs:971]). If the user promotes and then explicitly runs segment again, it keeps adding pins on top of the promoted structure. This is the existing semantics and expected behaviour, and it is stated explicitly in acceptance.
- V1 does not write `autoBreaks`. That field belongs to the subtitle Cue layout output (LayoutProfile-specific, produced by the layout optimizer; `autoBreaks ⊕ breaks` merged, not included in the layout fingerprint), and its semantics differ from paragraph evidence.

## 6. User-edit promotion

### 6.1 Trigger surface: all main-source ops addressed by Cue, Para or Sentence

Paragraph ids in the initial projection do not exist in the on-disk document. The server-side `apply_source_paragraph_operation` re-derives from the **on-disk doc**, then locates by id plus a `baseText` CAS ([apply.rs:625]). Therefore not only split and merge but also paragraph text editing (`edit` kind) will return 409. It is addressed by `paraId + baseText`, and the paragraph derived on disk is longer than the projected one.

The same deadlock also occurs on Cue-level ops, and this is the motivation for this revision. A Cue id is `q-<first word id>` ([cue.rs:151]). The injected paired breaks change Cue derivation, so each Cue on either side of an injected boundary has one set of `q-` ids in the projection and a different set on disk. Requests the client sends with projection ids for `sourceText` / `timing` / `sourceStructure` / `deleteOriginalCue` will inevitably return 404 or CAS 409 (`timing` has a double mismatch, since the Cue endpoint times at the boundary also differ). These ops do not trigger promotion, and each projection `refresh` re-injects the same boundaries, so client retries fail forever. No data is lost, but it is a deadlock.

Sentence belongs to the same class. `derive_sentences` closes when the next word is pinned by `paraBreaks`, and its id is `s-<first word id>`, so `s-` ids that exist only in the projection appear below injected boundaries. Code review confirms that the old whole-sentence `translation` did not verify that sid belongs to the current derived Sentence. When `base=""`, it writes directly to `trans[lang][sid]`, silently leaving the projection id as an orphan key. `piece` and `translationStructure` depend on `transAlign`, and may also keep rewriting if orphan alignments already exist. Now the sid is first validated against a real derived Sentence. If it does not exist, the whole request returns 409 and nothing is written. `translationParagraphMerge` already had Sentence existence and adjacency checks.

The trigger set is therefore **`sourceParagraph | sourceText | timing | sourceStructure | deleteOriginalCue | translation | translationStructure | translationParagraphMerge`**, that is, all main-source ops addressed by derived Cue / Para / Sentence. Deliberately excluded: `sourceSpan` (addressed by word id, so injection does not affect it), `patchTranscript` / `replaceTranscript` (whole-document write entry points; after they persist, the projection exits automatically per §4.2), and non-`main` source routes (additional sources have no initial projection). For translation to join promotion, the semantics are: the user edits a Sentence in the current provisional projection. On successful commit, the boundaries already used for addressing become the formal structure in the same transaction. It is not that entering one translated sentence unconditionally triggers resegmentation of the whole text. Promotion happens once, and only while the §4.2 initial projection is still valid.

The decision converges on the single function `studio::initial_segments::op_triggers_promotion`, which two call sites share. `apply::apply_transcript` uses it to decide whether the journal splits into two records sharing one group. `studio::apply::apply_inline_locked` uses it to decide whether to promote before applying the op. Drift between two copies of the set would make journal records mismatch what was actually written, so no call site may keep its own kind list.

Promotion logic sits in front of the unified entry for these kinds, **before the op is applied**. Only after promotion do the on-disk derived ids align with the projection ids:

1. The server-side detection of the enabling conditions holds (same as §4.2; the on-disk doc should satisfy it at this point);
2. Recompute `InitialSegmentPlan` and verify `input_fingerprint == id_fingerprint(words)`. On mismatch (concurrent edits have rewritten words), return 409 `conflict`, and the client refreshes and refetches the projection;
3. Within the same transaction, write all initial boundaries **in pairs** into the real `paraBreaks` and `breaks`;
4. Apply the user's original op. The projection ids and the on-disk derived ids now agree, so it proceeds normally with CAS;
5. Stamp `stages.segment = id_fingerprint(words)`;
6. The journal merges into one step by `group` (`promote-asr-segments` plus the original op label), so one undo rolls back everything.

Promotion happens **inside the per-op loop, not before it**. If an earlier op in the same transaction (such as `sourceSpan`) rewrote `words`, the fingerprint check in step 2 must be able to see it and return 409 for the whole transaction. Lifting promotion outside the loop would bypass that check.

### 6.2 Carrier

- Transaction guarantees reuse the current arrangement. The App calls `apply_transcript` directly from a single-writer thread. Serve has no write thread and relies on `ProjectLock + baseRev CAS`. The two sides are **structurally different but equivalent in guarantees** under concurrency. Promotion logic lives in the shared `ccut-workspace` layer, so both automatically get it.
- Do not accept a client submitting the whole initial pin table. Server-side recomputation is the only source of promotion, which prevents an old projection from overwriting a new document. Existing side paths (`patchTranscript.set.paraBreaks`, `replaceTranscript`) are not blocked by this. But after they write, `para_breaks` is non-empty, and the initial projection exits automatically per §4.2.

## 7. Backend strategy

| Backend | Actual source of row boundaries | `segmentation` | Included by default |
|---|---|---|---:|
| MOSS local | Model-native `[start][speaker]text[end]` | `model` | Yes |
| Remote MOSS | Remote MOSS rows passed through unchanged | `model` | Yes |
| OpenAI-compatible | `response.segments[]` | `provider` | Yes |
| OpenAI (empty `segments[]` degrades) | Whole text synthesized into a single row | `synthetic` | No |
| Volcano | `utterances[]` | `provider` | Yes |
| ElevenLabs | **Host** synthesizes from the word stream (speaker change / >0.8s pause / 12s+ sentence-final punctuation, [ccut-cloud-stt/src/lib.rs]), not provider-native rows | `host` | Yes |
| Qwen3/Whisper local | Silero VAD span, an acoustic window | `vad` | No |
| DashScope | Fixed-duration window slicing (`DASHSCOPE_WINDOW_SECONDS`, unrelated to speech content) | `synthetic` | No |

ElevenLabs is listed separately as `host` because its row boundaries overlap heavily with this algorithm's heuristics (essentially the same kind of signal). It is included by default, but there is room to keep an independent off switch. If corpus calibration finds that it adds no incremental information, downgrading it to `synthetic` requires changing only one mapping.

## 8. Implementation split

### Phase 1: core and contract

- Add a `segmentation` field to `TranscriptEngine` (inside the struct, `serde(default)`). Each parse branch fills it according to its actual path, including the OpenAI empty-segments degradation branch.
- Implement `derive_initial_segment_plan`, and extract the shared line-number-to-word-id mapping from `speaker.rs`.
- Correct the inaccurate description of the `fingerprint` field in [ccut-ai-pipeline-design.md](ccut-ai-pipeline-design.md).
- The CLI, App in-process, remote and cloud paths all fill in the source uniformly. Do not change existing transcription output behaviour.

### Phase 2: shared projection and multi-surface sync

- `projection::build` / `project_language` inject uniformly (paired pin plus break) and output `initialSegments` metadata. The degraded path follows §2.2.
- The App (`apps/cuccut`) and the Web Studio (`skills/cuccut/templates/studio`) display the `provisional` state.
- **Multi-surface sync obligation**: within the same task, update the corresponding interaction in the `designs/cuccut` prototype and the [product-design.md](../product/product-design.md) section, add a README round log entry, and pass the design system gate.
- Formal export, translation and quality checks still read the real transcript, not the temporary plan.

### Phase 3: edit promotion and default enablement

- The atomic promotion for every kind in the §6.1 trigger set, plus the `input_fingerprint` 409 branch and journal group undo.
- Calibrate the §3.2 thresholds against a real interview corpus.
- Enable by default for MOSS / Remote MOSS / OpenAI / Volcano / ElevenLabs.

## 9. Acceptance criteria

- After transcription, a single-speaker long video no longer shows up as one overlong paragraph. **Pause boundaries are produced by the algorithm itself** (there is no Para-level pause rule to rely on).
- A 2–4 second model segment does not become one paragraph per segment.
- After pure transcription completes, `transcript.json` has no new `paraBreaks` and `stages.segment` is empty. Initial boundaries appear only in `studio/data.json`.
- **Visible on the web**: the `data.json` returned by the serve poll contains the initial paragraphs and the `initialSegments` metadata.
- polish may freely merge model boundaries. After polish completes, the initial projection exits (segment stamp plus rebind, the dual condition).
- Any op in the §6.1 trigger set triggers promotion. The result is paired formal `paraBreaks + breaks`, undoable as a whole in one step. After promotion, paragraph boundaries are **identical, paragraph by paragraph,** to the projection before promotion.
- Cue-level ops (`sourceText` / `timing` / `sourceStructure` / `deleteOriginalCue`) submitted with `q-` ids that **exist only in the projection** succeed on the first try, with no client retry needed. Test cases must first assert that the id is indeed absent from the on-disk derived Cue set, otherwise the test is a false pass.
- Sentence-level `translation` submitted with `s-` ids that **exist only in the projection** promotes first and then hits exactly. Non-existent sids (including on the non-provisional path) uniformly return 409 and must not write orphan keys into `trans` / `transAlign`. If an earlier op in the same transaction changes word structure, the whole transaction returns 409. One undo rolls back both the promotion and the translation.
- After promotion, explicitly running segment adds pins incrementally on the existing structure (existing semantics), without error.
- Qwen/Whisper VAD spans and DashScope windows are not mistaken for semantic segments.
- When `ai/asr-rows.json` is missing, corrupt or an old version, the projection silently falls back to the current behaviour.
- CLI transcription and App in-process transcription produce exactly the same initial plan (same write code plus a pure-function derivation).
- No new LLM calls, and `words[]` text and timing do not change.

## 10. Explicitly not doing (V1)

- No new `transcript.json` fields and no `asr-rows.json` fingerprint fields.
- Do not write `autoBreaks`.
- Do not block the `patchTranscript.set.paraBreaks` / `replaceTranscript` side paths. They are naturally mutually exclusive with this plan through the §4.2 `para_breaks`-empty condition.
- Do not add CLI parameters for the thresholds.
- The web-side display language is pinned to the current projection language of `data.json`. This is an existing limitation unrelated to this plan and is not handled here.

## 11. Revision log against the first draft

| # | First-draft wording | Revision | Basis |
|---|---|---|---|
| 1 | "≥1.8s pauses are still handled by the existing derivation rules; no soft boundary is written again" | Pause boundaries become algorithm-produced; speaker changes stay unwritten | Para-level boundaries come only from pin / speaker change / chapter (cue.rs); 1.8s is a Sentence-level constant (sentence.rs) |
| 2 | "Clone-injected at projection time … does not modify disk" (implies not persisted) | The injection result lands in `data.json` with `refresh`; `project_language` injects in sync | Web only polls the on-disk `data.json`; serve does not call projection functions |
| 3 | Injection and promotion write only `paraBreaks` | Always write `paraBreaks + breaks` in pairs; `InitialBoundary` carries the paired keys directly | `derive_paras` only recognizes Cue first-word pins; a formal split is paired semantics (source_paragraph.rs) |
| 4 | Promotion trigger surface = split / merge | Expanded to all `sourceParagraph` kinds (including `edit`); adds the `input_fingerprint` 409 branch | `edit` is likewise addressed by paraId + baseText, so disk re-derivation always returns 409 |
| 5 | Enabling criterion `stages.asr == fingerprint(words)` | Changed to a structural criterion: all ids are `gN.*` and `para_breaks` is empty | A text fingerprint does not prove id structure; upgrade backfill and patch_stages can forge "fresh" |
| 6 | ElevenLabs marked `provider`; DashScope grouped under the "whole-text fallback" | ElevenLabs as a separate `host` (host-synthesized rows); DashScope as fixed window slicing → `synthetic`; OpenAI empty-segments degradation fills `synthetic` per branch | Each parse implementation in cloud_stt.rs |
| 7 | `segmentation` described only as a JSON field | Must be in the `TranscriptEngine` struct (`serde(default)`) | Typed write-back of seed-transcript would wipe keys outside the struct |
| 8 | "Hard quality gate reuses Latin 300 / CJK 500" | Changed to match the magnitude of the measured segment-engine constants (200/400/1.2s); the original numbers have no code source | segment.rs fallback constants |
| 9 | Not mentioned | Adds the §2.2 first-production-reader contract obligation, the §5 `run_segment` incremental-pin expectation, and the §8 multi-surface sync obligation | asr-rows.json currently has no production reader; CLAUDE.md multi-surface rule |
| 10 | Promotion trigger surface = all `sourceParagraph` kinds | Expanded to all main-source ops addressed by Cue / Para (newly adding `sourceText` / `timing` / `sourceStructure` / `deleteOriginalCue`); the decision converges on the shared `op_triggers_promotion` | Cue id is `q-<first word id>`, and injection changes Cue derivation → projection q-ids do not exist on disk. These ops did not originally trigger promotion, and the projection re-injects on every refresh, so client retries always fail (UX deadlock) |
| 11 | The `s-`-addressed translation family deferred, pending verification of orphan behaviour | `translation` / `translationStructure` / `translationParagraphMerge` all join promotion; the translation write path first validates that a real Sentence exists | Injected `paraBreaks` likewise change Sentence derivation. The old whole-sentence `translation` silently writes an orphan key when the sid does not exist and base is empty, so it cannot rely on the provisional window usually being short to avoid this |

### Ruling: wire the `s-`-addressed translation series into promotion

The audit finds that the old whole-sentence `translation` op, after `current.unwrap_or_default()`, runs only a base CAS. A nonexistent sid and a valid Sentence that has no translation yet both get an empty string, so `base=""` is then unconditionally `insert`ed. The real outcome is a **silent orphan key**, not a 404/409, and not a lucky hit. The `seedUnaligned` path in `translationStructure` checks that the Sentence exists, but the existing `transAlign` path checked only the alignment. `translationParagraphMerge` already checks through `derive_sentences` that both sentences exist and are adjacent.

The formal decision is to first tighten every sentence and piece write path of `translation` and `translationStructure` so that a sid must belong to the currently derived real Sentence, otherwise the transaction returns 409. Then add all three translation kinds to `op_triggers_promotion`. The `s-` ids below the projection boundary are, after promotion, derived stably from the same first word, so the original op will hit exactly. Promotion, the original op and `stages.segment` commit atomically, and a single undo within the same history group reverts them all. Although the provisional window usually precedes the appearance of translations, this can only reduce frequency; it cannot provide correctness guarantees against deadlocks or orphan writes. When a user edits with a provisional Sentence as the target, atomically solidifying that projected structure is an explainable and reversible commit semantic.
