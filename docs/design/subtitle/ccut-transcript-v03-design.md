> Ported from CucCut v2. Data model names in this document (TranscriptDoc, etc.) refer to the v2 models; for the mapping to the v3 document model, see [architecture design §14](../../architecture/architecture-design.md#14-items-pending-review).

# ccut Subtitle Data Structure v0.3 Design: Sentence as First-Class Citizen and Independent Translation Cue Stream

Status: **Confirmed** (2026-07-28: default strategy manyToOne, sentence key prefix `s-`, no 0.2 compatibility or migration needed. The format is unreleased, so 0.3 becomes the current format directly, and the LLM review for `independent` is off by default. From 2026-07-31, translation Cues are fully independent of source Cues.)

> **2026-08-16 addendum (transcript 0.4)**: The alignment-block design [ccut-alignment-block-subtitle-split-design.md](ccut-alignment-block-subtitle-split-design.md) adds `autoBreaks[profile]`, `transDisplay`, and `transAlign.blocks / correspondence / textBasis / aligner` on top of this document. It also supersedes the following clauses: the `crossing` marker in §4 (new writes no longer produce it; on read it is interpreted as `correspondence = sentence`); the rule in §5.2 that "sentences whose word order cannot be cut in sequence are first handled by having the align worker directly reorder the target sentence and write back the sentence-level `trans`" (changed to: first merge crossing blocks; only if the merged block still exceeds hard does a narrow rewrite task run and write to `transDisplay`, with `trans` remaining a natural translation); and in the §8 table, "change translation line boundaries" can now only snap to alignment block boundaries. The other clauses remain in effect. This redesigns the translation and alignment data structures on top of ccut's existing §18 word-atom model (`ccut-flow-core/src/{doc,cue}.rs`, `engines/{translate,align}.rs`), with reference to voice-ink `Sources/VoiceInk/Models` (Doc/Word/BreakOverride/trans/transBreaks) and `skills/cuccut/references/alignment.md` (the two-stage translation model and the fit/aim/hard budgets).

## 1. Motivation: the current model (0.2) cannot hold the requirements

Current state (transcript 0.2):

- `words[]` atoms → `Cue` (derived, six line-break rules) → `Para` (derived, chapter × speaker × paraBreaks). The hierarchy is sound.
- **Sentence is not a first-class citizen**: translation groups (≈ sentences) are derived temporarily inside the translate engine (`translation_groups`) and do not appear in the doc model or the cue module.
- **Translations are persisted by source Cue key**: `trans[lang][source cueId] = already-split display text`. This welds "translation lines must be anchored on source Cue boundaries" into the storage layer:
  1. **Independent alignment is impossible**: the boundaries of a translation line cannot fall outside the start of the source Cue.
  2. **Many-to-one span information is lost**: when a span covers Cues 2..3, only the first Cue is written and the rest are left empty. The rendering side cannot tell "this span covers up to here" from "there really is no translation after this". (The 26 "untranslated" placeholders from today's import of the voice-ink project are exactly this semantic gap.)
  3. **Sentence-level truth is missing**: the full natural translation of a sentence lives only in the `ai/sentences-<lang>.json` cache, which is lost once its fingerprint is invalidated. After the user edits one translation line on the page, sentence-level re-alignment is out of reach.
- Thresholds are a single advisory `fit` (CJK 16 / Latin 42). There is no split between voice-ink's soft aim (advice to the LLM) and hard ceiling (enforced by code).

Requirements (acceptance criteria for this redesign):

- An explicit hierarchy: **word → cue → sentence → paragraph → chapter → subtitle**;
- The unit of translation alignment is the **sentence**: source sentence 1:1 target sentence, source paragraph 1:1 target paragraph;
- Within a sentence, the translation Cue supports **two strategies** (independent alignment / word-level many-to-one). Both derive only from Sentence, and alignment decisions do not read source Cue boundaries (except the read-only display grouping of the editor's source column, §5.2);
- Split thresholds are divided into **soft** (advisory values for the LLM) and **hard** (upper limits detected by code).

## 2. Hierarchy model

| Level | Storage | id | Derivation rule |
| --- | --- | --- | --- |
| **word** | ✅ persisted (the sole text and time truth) | `g1.4` / `wXXX-n` | — |
| **cue** | derived | `q-<first word id>` | §18.5 six line-break rules (unchanged) |
| **sentence** | derived; **translations are persisted keyed by it** | `s-<first word id>` | 1..N consecutive visible words; Cue only backfills display metadata, see §3 |
| **paragraph** | derived | `p-<first word id>` | chapter × consecutive same speaker × paraBreaks (unchanged) |
| **chapter** | ✅ persisted (`chapters[]`) | `ch1` | — |
| **subtitle** | projection (render/export layer) | — | language stream × style × bilingual pairing, see §7 |

`cue` and `sentence` are two independent projections over the same visible word stream: each word is covered by both. A sentence is not aggregated from cues, and reordering source Cues must not change sentences. A sentence still does not cross paragraph or chapter boundaries. Without an explicit `nobreak`, sentence-final punctuation also closes a Cue, but this is only a source display rule.

The corresponding relations on the translation side:

- **Sentence 1:1**: each source sentence has exactly one target sentence (`trans[lang][s-…]`);
- **Paragraph 1:1**: paragraphs are derived from the source structure and sentences do not cross paragraphs (guaranteed by §3). Target sentences follow their source sentences into the same paragraph, so 1:1 holds automatically and no extra storage is needed;
- **Cues within a sentence are not guaranteed 1:1**: word order differs, and the alignment strategy decides (§5).

## 3. Sentence as a first-class citizen

Move `translation_groups` from `engines/translate.rs` into core (new `sentence.rs`) and rename it to `derive_sentences(doc, cues) -> Vec<Sentence>`:

```rust
pub struct Sentence {
    /// "s-" + first word id. Stable across re-derivation as long as the first word id is unchanged.
    pub id: String,
    pub cue_indices: Vec<usize>,   // indices back into the derive_cues result
    pub word_indices: Vec<usize>,
    pub src_fingerprint: String,   // fingerprint of the in-group word slice (transSrc baseline, algorithm unchanged)
}
```

Closing conditions (**two new ones** are added to the existing four, guaranteeing sentence ⊂ paragraph):

1. The last word has `sentence_end` (。．！？!?…)
2. The gap to the next visible word is ≥ 1.8s (a strong pause; 0.6–1.2s is used only for Cue line breaks and soft markers and is not equivalent to a semantic sentence boundary)
3. A speaker change
4. The group has ≥ 80 words (a fallback for long unpunctuated runs; avoids hard cuts in the middle of prepositions, particles, or predicates)
5. **New**: the next visible word is pinned by `paraBreaks` (a paragraph boundary)
6. **New**: the next visible word crosses a chapter boundary

The key changes from `q-<first word id>` in 0.2 (borrowing the first Cue's id) to `s-<first word id>`. Sentences and Cues are two namespaces, and borrowing one confuses them. In 0.2's `trans` table, Cue keys and group keys looked alike but meant different things, and that is exactly the root of the "key re-attachment" patch during import. On migration, rewrite mechanically.

## 4. Translation data v0.3: sentence-level truth plus an alignment overlay

`trans` becomes **sentence-level truth**, and a new `transAlign` overlay is added:

```jsonc
{
  "ccutTranscript": "0.3",
  // Phase-1 truth: complete natural translated sentence (target-language word order, no line breaks)
  "trans":     { "zh": { "s-g1.0": "你过的就是2028年人们会过的生活。" } },
  // fingerprint of the source sentence (dirty detection; semantics unchanged, key changed to s-)
  "transSrc":  { "zh": { "s-g1.0": "8:g1.0:g1.7:ab12cd34" } },
  // Phase-2 overlay: how this translated sentence is split into display lines
  "transAlign": {
    "zh": {
      "s-g1.0": {
        "mode": "manyToOne",            // independent | manyToOne
        "words": ["g1.0", "g1.1", "g1.2"],        // source word snapshot for manyToOne
        "pieces": [
          { "from": 0, "to": 0, "text": "你过的就是" },
          { "from": 1, "to": 2, "text": "2028年人们会过的生活。" }
          // manyToOne: from/to = source word order within the Sentence
        ]
      }
    }
  }
}
```

Invariants and invalidation semantics (all machine-checkable, enforced in `ccut check`):

- **Concatenation invariant**: `normalize_chars(concat(pieces.text)) ==
  normalize_chars(trans[lang][key])`. A violation ⇒ `align-stale` (a blocker precondition: degrade to showing the whole sentence and prompt re-alignment).
- **Word-anchor snapshot**: in a new manyToOne, `transAlign.words` must equal the current sequence of word ids within the sentence. The old `cues` field is kept only for reading historical projects; validation and projection must ignore it, and new writes omit it.
- **Crossing marker**: `crossing` is kept only for reading compatibility with old projects. New alignments always write false, and a missing field is treated as false. Even if an old entry is true, the hard ceiling of the target piece must not be relaxed.
- **Sentence fingerprint**: if `transSrc` does not match the current `src_fingerprint` ⇒ `translation-stale` (the translation is retranslated together with its sentence, as in 0.2).
- **No transAlign entry** = unaligned, a legal intermediate state. The display side degrades to **showing the whole sentence** (a single piece covering the word time window of the Sentence). The current degradation in align, "write the first Cue and leave the rest empty across Cue pieces", now has an explicit representation and no longer relies on empty entries as implicit hints.

The `translate` engine changes from "does not write doc" to **persisting `trans` + `transSrc` page by page** (each sentence is persisted as soon as it is translated). `ai/translate-*_status.json` is left with only the role of a progress snapshot, and resumable runs read the translated sentences directly from doc. For CJK translated sentences, idempotent AutoCorrect runs after they are written to `trans` and before align, so that punctuation, mixed-script spacing, and technical-term casing become part of the sentence-level truth. The `align` engine then writes only `transAlign`, based on this final character stream.

## 5. Two alignment strategies

### 5.1 `independent` — aligned separately (deterministic, zero LLM)

The source and target are each cut according to their own language's line-breaking habits, with no correspondence established within the sentence:

> you are living the way, / somebody in twenty twenty eight / is going to live.
> 你过的就是 / 2028年人们会过的生活。

**Cutting**: run the target-language splitter (§6.2) on the translation text. Candidate seams are ordered by sentence-final punctuation > clause punctuation (，、；：…) > whitespace > CJK character boundary. A DP picks seams so that every piece is ≤ hard and close to soft, preferring higher-grade seams. Forbidden cut points: inside a Latin word, before closing punctuation or after opening punctuation, and inside a protected term.

**Time anchoring**: first map the cumulative reading-unit share of the translation → the cumulative weight share of the source sentence's word sequence → the nearest source-word edge, establishing `wordSpan` semantic anchors. The display projection can then smooth the boundaries between adjacent pieces within the sentence. If the sentence's total duration is sufficient, each piece is guaranteed at least `max(1s, reading units / CPS)`. If not, the sentence's time window is divided in proportion to each piece's required duration. The shortage is shared by all pieces, rather than letting the line that happened to get a short source piece flash by alone. Finally, padding is borrowed only from real silence between adjacent subtitles or from the media's trailing blank space, and never overwrites the next subtitle. The persisted word anchors do not change, and `words[]` remains the only time source. In the extreme case where the number of target pieces exceeds the number of source words, a non-empty `wordSpan` cannot be assigned to every piece. The continuous display time is then allocated within the sentence's word time window in proportion to each piece's reading units, and `wordSpan` is left empty, explicitly signalling that no per-piece bilingual correspondence is established.

### 5.2 `manyToOne` — many-to-one (LLM pieces protocol, current align engine)

One target-language semantic piece corresponds to a contiguous range of source words. In the **display layer**, the source text of that range is wrapped at two levels. First it is grouped into sub-lines by the source Cue boundaries it covers (spanning N source Cues shows N sub-lines, which is exactly the visible form of "many-to-one"). If a single sub-line still exceeds the column width, it is wrapped by width at word-atom edges. Both levels are only a **non-persistent display projection** (see the final paragraph of this section) and write nothing back to any field:

> Production deployments have seen fifty   ← source Cue A
> percent throughput improvement,          ← source Cue B
> 生产部署已观察到 50% 的吞吐量提升，  (Chinese data: "Production deployments have observed a 50% throughput improvement,")

In this example, the two source sub-lines come from two source Cues. They are not new alignment entries, and they do not change the time window of this one manyToOne pair row.

The LLM is the preferred cutter: it directly decides the natural semantic seams of the target language and maps each piece to a contiguous range of source words. `{"from","to","text"}` must contiguously cover all source words, and the piece texts must concatenate to the full sentence translation. Word-level pauses and clause seams are only hints for mapping source words, and must never force the target language to imitate the source Cues. The program performs only deterministic reconciliation. Only after consecutive retry failures does it fall back to deterministic target-language splitting plus source-word proportional anchoring. This is the **default strategy**. For budgeting, Simplified Chinese is projected first: two Latin half-width cells approximate one CJK reading unit, and ordinary commas and periods consume no hard or CPS budget.

The number of pieces is driven by the reading needs of the translation. The length of the source only affects anchoring and payload suggestions and does not raise the lower bound on the piece count. "Several short source phrases sharing one compact translation" is the default form of many-to-one. When a sentence's translation fits on one line, it is queued for splitting only when the sentence's spoken time window exceeds the dwell guardrail (~7s). For sentences whose word order cannot be cut in sequence, the align worker is preferred to reorder the translation directly (`reordered: true`). The worker has language ability of its own and, without changing meaning, reorganizes the translation in the order of the source clauses. Acceptance is guarded by a length-bandwidth check, and after passing, the sentence-level `trans` truth is written back with an attached review advisory. Only if reordering is still unnatural is `crossing: true` self-reported and stored (legal only for `manyToOne` word-anchored entries). The review side then marks that "the inter-line semantics intentionally do not correspond one-to-one", and the display side may arrange timing by length proportion.

The order of alignment execution is normative. First, the target pieces are determined and frozen using only target-language naturalness, protected terms, and the fit/hard budgets. Only then is each piece mapped to a contiguous range of source words in the Sentence. Source-word pauses and clause seams are used only in this later mapping step. The original Cue ids and boundaries, and `breaks`, neither enter the payload nor may be inferred by the model or reverse-applied by the consuming side as alignment decisions (piece count, cut points, `from`/`to`, time windows). If a merged draft fails only the source anchor, pieces that already passed target-side acceptance must be preserved across the dedicated align, and only the source-word range may be reselected for that round. Reordering or crossing may not be used to imitate source Cues. This prohibition's scope is the **decision layer**: the model payload, the align engine, and `transAlign` semantics. The read-only, non-persistent display grouping by source Cue is outside it, as described at the end of this section.

Bilingual pairing readability is a secondary target-first guardrail. A source span cannot by itself create a target cut point. Only when a source piece exceeds the language-aware single-line budget or about 4s, and the corresponding target piece already has a complete clause or parallel-action seam of its own, is it required to split further along that natural target-language seam. A complete parallel action may use the 顿号 (、) seam under this condition, while an ordinary noun list stays cohesive.

The editor's source column and the Web Studio's source column have one further layer of **non-persistent display projection**, in two levels, in fixed order:

1. **Sub-lines grouped by source Cue**: intersect the piece's source-word range with the word sets of each source Cue. Spanning N source Cues renders N sub-lines, so that "many-to-one" is visible in the interface (user decision of 2026-08-08. Commit 6fb2fd1 removed even this display-layer grouping when decoupling the alignment decisions. That display-layer clause is overturned here, while the decision-layer conclusion remains in force). The grouping intersects `cues[].words[].id` with the piece's `sourceWordIds`. It does not match by time, and it does not introduce the text or `breaks` of a source Cue.
2. **Width wrapping within a sub-line**: if a single sub-line still exceeds the column width, wrap it balanced at word-atom edges, so the full source text is shown and scannability improves.

Both levels are computed at render time. They add no target pieces, do not change `from`/`to`, do not write `breaks` or `transAlign`, and add no new fields to `data.json`. Clicking jumps to the time point of the first word of that sub-line, and the time window of the pair row itself is unchanged. So "the source text has multiple visual lines" does not mean "there is one more semantic alignment". Degradation is monotonic: when word-id indexing is entirely unavailable (the source Cues have no `words[]`), it falls back to pure width wrapping, byte-for-byte identical to the output before grouping existed. When indexing is partially missing (some word ids do not match, for example in a locally edited Cue), unmapped words are merged into the preceding group, so the grouping becomes coarser but never drops a word. In all cases, the concatenated word sequence of the sub-lines must equal the complete source-word range of the piece. Reopening the project deterministically rebuilds the same display from the word snapshot.

### 5.3 Strategy comparison and selection

| | independent | manyToOne (default) |
| --- | --- | --- |
| LLM calls | 0 (optional review) | Batched calls for long sentences |
| Line boundaries | The target language's own habits | Semantic seams in the target language + source-word boundaries within a Sentence |
| Bilingual line-by-line alignment | ❌ Two independent streams | Approximately mapped by word ranges |
| Segmentation quality | Most natural in the target language | Best semantic correspondence |
| Use | Monolingual subtitles, vertical/short lines | Bilingual subtitles |

`oneToOne` is kept only for backward compatibility when deserializing the enum from old JSON. The CLI no longer accepts this mode; old entries that were anchored directly to source Cues are treated as invalid and downgraded to a whole-Sentence projection of the Sentence until they are realigned.

Granularity: project-level default (`translate --align-mode X`, recorded in `project.json`); sentence-level override is possible (`transAlign[key].mode` holds one per sentence; when realigning a single sentence in studio, the strategy can be switched). Switching strategy = rerunning Phase-2 for that sentence; the sentence-level translation source of truth is unchanged.

## 6. Threshold system and target-language splitter

### 6.1 Three numbers: fit / soft / hard

Carried over from the voice-ink semantics (`budgets: {s, t, f}` in alignment.md), graded by **target language**, all held in `TransParams` (analogous to `CueParams`, normative defaults):

| | CJK (zh/ja/ko) | Others (Latin) | Meaning |
| --- | --- | --- | --- |
| `fit` | 16 | 42 | **Trigger**: translation ≤ fit and not over hard ⇒ whole sentence on one line, no split |
| `soft` | 14 | 30 | **Suggestion**: target segment length when splitting; written into the LLM prompt, and the DP target of the splitter |
| `hard` | 20 | 42 | **Absolute hard ceiling**: any target segment > hard ⇒ `ccut check` blocker; the deterministic splitter never produces one by construction |

Counting: hard/CPS uses the delivery-projected `target_cps_chars` (for Simplified Chinese, ordinary commas and full stops are projected away and whitespace removed, then two half-width cells count as roughly one Chinese reading unit); the fit trigger for Simplified Chinese uses the full visual width instead (CJK/fullwidth = 2 cells). Between soft and hard lies a "whole-sentence retention zone": when a segment falls in (soft, hard] and there is no safe seam, it may remain unsplit. This is the point of separating soft from hard: avoid cutting a sentence badly just to hit a count. CLI: `--fit N` overrides fit; soft/hard follow proportionally (soft = fit−2, floor 4; hard = max(fit, round(soft×1.4))).

Narrowed by delivery (`1.276.0`): when `delivery` in `project.json` is `shorts`, the default three thresholds are replaced by `TransParams::for_shorts`. `fit` takes one line of a vertical-screen subtitle block (block width 60% of frame width ÷ translation font size 5.5% of frame width ≈ 10.9 em: CJK 10; other languages measured per non-whitespace character at 0.58–0.65 em with the built-in Noto Sans SC at weight 800, taking 17). `soft` / `hard` scale in the same tier and proportion as the table above (CJK 10/9/13, others 17/12/17), without changing `OVER_FIT_PENALTY` or the calibration of seam penalties. `--fit` still takes precedence. Budgets are not written into `transAlign`, and validity checks do not look at budgets, so existing splits are not re-split automatically when the delivery changes (otherwise an over-long segment that cannot be split would re-run the LLM every round). To re-split, use `ccut translate --align-only --yes`. `ccut check`'s `translation-overflow` and the splitter's fallback warnings still judge by `for_lang` and do not tighten with delivery.

Overflow and seam quality are divided by strategy. The independent splitter never overflows by construction. For manyToOne, target segments must also all satisfy hard; crossed word order, semantic completeness, product names or phrase cohesion cannot be exempted. The LLM's first pass prefers natural seams. If the response still contains a segment over hard, the program continues deterministic splitting within the same response at natural target-language seams, re-anchoring consecutive source words by length, with no extra LLM call. If there are more target segments than source words, the sentence is switched directly to independent, and its lines are timed within the sentence's time window by reading length. In that case, line-by-line semantic correspondence may be imperfect: the delivery character limit takes priority over bilingual correspondence. Coverage, ranges, verbatim concatenation of the translation text, and empty segments remain hard errors; dangling connectives, sticky particles, short segments and length balance are advisory and do not alone trigger expensive rework.

manyToOne runs one first-pass semantic review per batch of 32 sentences over all long sentences. Sentences that pass within a batch are accepted immediately; failed sentences from all batches are aggregated into at most one global repair. Sentences that still fail fall back to "deterministic target-language splitting + source-word proportional anchoring", and the fallback result gets a seam-lint merge repair. Only when there are more segments than source words is the sentence recorded as `mode=independent`, to avoid re-merging segments over hard just to satisfy anchoring.

### 6.2 Target-language tokenizer (atomize extension)

Translations have no word atoms, so a plain-text tokenizer is needed to support the splitter and snapping:

- Latin: split on whitespace into tokens, with punctuation attached (consistent with the §word-splitting rules in the apply script);
- CJK: character by character, but **forbidden break positions** are derived from character classes (before closing punctuation, after opening punctuation, between a digit and its unit, inside a Latin-mixed token);
- Protected terms: taken from the `ai/brief.json` glossary (used if present, empty if not). ccut has no brief stage yet, so the interface is reserved without blocking anything.
- Intra-word seams in CJK (“构|建”-type): the Rust side has no NLTokenizer, and v0.3 does no dictionary segmentation. Independent mode offers an optional `--review` that lets the LLM review the seams once (off by default).

## 7. Subtitle projection: display and export

- **Monolingual (target language)**: the translation Cue stream is the pieces of each sentence expanded in time order. SRT/VTT emit one entry per piece directly.
- **Bilingual**: the source Cue stream and the translation Cue stream are always derived independently. Only in the final bilingual SRT/VTT projection are the **union of the boundaries** of the two time streams taken to segment, and adjacent segments with identical content merged automatically (to avoid flicker).
- studio `data.json` adds a sentence layer: `sentences: [{id, cueIds, trans, mode, alignStale}]`. The Translate panel changes from "group-key guessing" to reading the sentence structure directly. Edits to translation lines land on pieces (§8).

## 8. Editing and write-back semantics (studio / apply script)

| User action | Landing point | Cascade |
| --- | --- | --- |
| Edit the text of a **translation line** | `transAlign.pieces[i].text` of that sentence | Synchronously rewrite `trans[key]` = concatenation result (concatenation invariant maintained); `transSrc` is untouched, so manual translation edits do not count as stale |
| Edit the **whole-sentence translation** (sentence-level edit) | `trans[key]` | Delete that sentence's `transAlign` ⇒ the deterministic strategy re-splits immediately; manyToOne marks it for realignment and degrades the whole sentence on screen |
| Move a translation-line **boundary** (independent) | Characters moved between two adjacent pieces | Concatenation invariant maintained automatically |
| Change the **source text / breaks** | words / breaks (current semantics) | Sentence fingerprint changes ⇒ `translation-stale` (retranslate); a Cue structure change alone does not affect the translation Cues |

The apply script's trans edit channel changes from "cueId → text" to "pieceRef → text"; base invalidation semantics are unchanged.

## 9. Import (no 0.2 migration burden)

The format is unpublished, so **no 0.2 compatibility**: `ccutTranscript` is bumped directly to `0.3`, and the parser accepts only 0.3. Existing 0.2 projects in the repo (examples/, e2e fixtures) are regenerated with the revised importer/flow.

**voice-ink import** (`import_cuccut.py` revised, emitting 0.3 directly): its `trans` key is the first-word id of a display unit, which is naturally a piece rather than a sentence ⇒ following this plan's sentence derivation, entries are attached to sentences. An entry located at Cue i, followed by consecutive gaps up to the next entry (or the sentence end) ⇒ restored as piece `{from: i, to: end of gap}` (recovering the spans lost in 0.2-style storage), `trans[s-…]` = piece texts concatenated in order, `mode = "manyToOne"`. Remove the current "key re-attachment" patch, which forcibly concatenated span pieces into the first Cue. That patch was a workaround forced by cue-key storage. `transBreaks` (voice-ink's translation line break overrides) is not imported, since v0.3 piece boundaries are explicitly persisted. Re-import the three examples/ projects to verify.

## 10. Implementation plan

1. **Core data layer**: `sentence.rs` (derive_sentences + new sealing conditions), `doc.rs` v0.3 fields/validation/migration, `TransParams` (fit/soft/hard);
2. **Deterministic splitter**: atomize target-language tokenizer + independent split DP + Sentence word-time anchoring; all pure functions, table-driven tests;
3. **Engine rework**: translate writes trans/transSrc page by page; align accepts `--mode`, manyToOne goes through the existing protocol to write transAlign, independent uses zero LLM; prompt injects soft/hard;
4. **Consumers**: export (monolingual / bilingual union segmentation), check (new align-stale / translation-overflow lints);
5. **serve/studio/skill**: data.json sentence layer, apply script pieceRef channel, sync studio_sync/SKILL.md/references;
6. **Verification**: re-import the three examples/ projects from voice-ink + E2E (run one passage of p130 in each of the two modes).
