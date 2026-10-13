> Ported from CucCut v2. The data-model names in this document (TranscriptDoc, etc.) refer to the v2 models. For their mapping to the v3 document models, see [Architecture design §14](../../architecture/architecture-design.md#14-items-pending-review).

# Subtitle Segmentation: Four-Layer Separation and the Minimal Monotonic Alignment Block

Status: **Confirmed (2026-08-16; D1–D6 all adopt the default recommendations), in implementation**. Implementation log: see §12.
Scope: source subtitle Cue segmentation optimizer, bilingual subtitle alignment data model, alignment LLM contract, multi-surface consumers. Does not change the `words[]` truth, Sentence derivation, the sentence-level `trans` truth, or the Cue §18.5 derivation algorithm itself.
Related documents: [ccut-transcript-v03-design.md](ccut-transcript-v03-design.md) (v0.3 data model), [ccut-ai-pipeline-design.md](ccut-ai-pipeline-design.md) §8–§9 (translate/align engines), [ccut-file-contract-subtitle-ai-design.md](ccut-file-contract-subtitle-ai-design.md) §8 (HTML alignment table contract), [ccut-subtitle-agent-workflow.md](ccut-subtitle-agent-workflow.md) §4 (internal alignment strategy), [cuccut-format-spec.md](../bcf/cuccut-format-spec.md) §18.4–§18.7.
External references: FBK IWSLT 2026 Subtitling system paper (`2026.iwslt-1.7`, sentence-aware two-stage pipeline), Netflix Timed Text Style Guide, SimAlign / awesome-align, SubER.

## 0. Summary of Conclusions

Subtitle “segmentation” is four distinct layers of problems, and today two of them are collapsed into one layer:

```text
words[]                       word-level text and timing truth (unchanged)
   ↓
Sentence                      semantic unit: what gets translated (unchanged, sentence.rs)
   ↓
Alignment Block   ← new       bilingual unit: which target text maps to which source words (monotonic, mergeable, not further splittable)
   ↓
Cue / Piece                   timing unit: when to display (source: §18.5 + optimizer; target: transAlign.pieces)
   ↓
Line                          layout unit: where to wrap lines inside one subtitle (render-time projection, not persisted)
```

This plan does four things, in dependency order:

1. **Separate the source Cue optimizer from user intent.** Optimizer results move from `breaks` to `autoBreaks[profile]`, keyed by `LayoutProfile`. The §18.5 greedy derivation stays normative and unchanged; the three implementations perform only one extra merge where user pins override automatic pins. At the same time, the local pairwise repair in `layout.rs` is upgraded to a global DP over candidate breaks.
2. **Introduce the Alignment Block layer.** `transAlign` entries gain `blocks[]`: the minimal monotonic alignment blocks, deterministically derived from source-word ↔ target-text alignment edges via a “monotonic closure”. `pieces[]` remains the display segmentation, but every piece boundary must fall on a block boundary. `crossing` is replaced by `correspondence: "block" | "sentence"`.
3. **Source alignment edges and slim the LLM task.** The LLM no longer splits both columns and resolves crossings at the same time. It only outputs alignment edges “target semantic block → set of source-word indices” (fused into the translate call, with a dedicated align call as fallback). Block merging, bilingual DP and timing allocation are all deterministic code. Word-order crossings are merged first. Only if the merged result still exceeds hard does a narrow task, “monotonic display rewrite”, run, writing to a separate `transDisplay` without overwriting the natural sentence translation `trans`. If that still fails, degrade to whole-sentence correspondence. Never fabricate line-by-line one-to-one correspondence.
4. **Acceptance and evaluation.** `ccut check` adds alignment coverage, crossing rate, safe-boundary ratio, sentence-level degradation rate and rewrite trigger rate. Offline evaluation adds SubER.

The most critical rule: **bilingual subtitle boundaries may only be placed where no high-confidence alignment edge spans the position.**

## 1. Current-State Review (Code Facts, as Design Premises)

All of the following is based on the current `main`, checked point by point against the judgments in the user's analysis report:

| Report's claim | Code facts | Verdict |
| --- | --- | --- |
| Cue derivation is a single-pass greedy scan | [`cue.rs:125`](../../../core/crates/ccut-flow-core/src/cue.rs) `derive_cues`: looks only at the single `next` word; `min_cue_display_sec` is never read during derivation at all | Accurate |
| Optimization is delegated to a “later optimizer” and written into `breaks` | [`layout.rs`](../../../core/crates/ccut-flow-core/src/layout.rs) `balanced_cue_breaks` → minimal pin set written to `doc.breaks`; `ensure_balanced_cue_layout` **skips the whole document as soon as `breaks` is non-empty** | Accurate, and worse than the report: once the user manually touches any break, the whole document is no longer optimized |
| The optimizer is a local heuristic | `fix_pair` scores all internal cut points for two adjacent cues, and `repartition_for_reading_time` iterates to convergence | Accurate; not globally optimal |
| No LayoutProfile | `CueParams` (source, language-independent, 42 cells), `TransParams` (target, fit/soft/hard per language), and three separate sets of CPS thresholds (`layout.rs` 13/21, `split.rs::target_reading_cps`, `apps/gpui/.../subtitle_list.rs` 9/13/17/21) share nothing | Accurate |
| No 1-line/2-line decision inside a Cue | A Cue = one 42-cell logical line. Line wrapping is projected in two places: at render time by `ccut-core::layout_captions` (font metrics), and in the editor by `subtitle-rendering.js::sourceDisplayLines` (cell-width DP) | Accurate. The Line layer is already naturally separated; it just has no name |
| `transAlign` simultaneously handles semantic alignment, time mapping and display segmentation | `TransPiece{from,to,text}`: `from/to` are source-word ranges within the sentence, and `align_entry_valid` requires `from == expected`, i.e. contiguous full coverage. **Non-monotonic mappings cannot be expressed** | Accurate |
| Crossings are declared via `data-crossing` | `align_table.rs::parse_group` reads `data-reordered/data-crossing` (mutually exclusive). `crossing` lands in `TransAlign.crossing`, and check emits only info-level `align-bilingual-anchor-crossing`. `reordered` passes the ±max(25%,4) guardrail and is **written back to `trans`** | Accurate. The `doc.rs` comment already marks `crossing` as “legacy, read-only”, but `align.rs:4262` still writes it. Docs and implementation have drifted apart |
| Currently translated per source Cue | No: the translation unit is already Sentence; source Cues/`breaks` do not enter the alignment payload | The report's “wrong flow” is already avoided by CucCut; no change needed |
| Bilingual rendering requires line 1 to match line 1 | No: `stage.jsx:136–172` / `render_plan.rs::active_layouts` wrap two independent timelines separately. Pairing exists only in the editor's `.tg-pair` rows | The rendering layer needs no change. This plan only changes the pairing semantics and the source of time windows |

Existing components that can be reused directly: target-language split DP (`split.rs::split_independent_impl`, seam penalties 0/0.3/0.8/NO_SEAM), seam lint (`seam.rs::lint_pieces` / `is_objective_blocking`), bilingual anchor checks (`align.rs::anchor_token_colocation` / `unique_anchor_bindings`), timing smoothing (`split.rs::smooth_trans_cue_times` / `pad_trans_cue_times`), translation fusion channel (`data-align-*` attributes), and HTML carrier encode/decode (`filepipe/align_table.rs`, where one validator is shared by both execution paths).

## 2. Target Model and Invariants

Five invariants (all machine-checkable, enforced in `ccut check`):

- **I1 word truth**: `words[]` remains the only text/timing truth. Block, Cue and Line are all derived or overlay layers.
- **I2 sentence-level translation**: `trans[lang][sid]` is the complete natural translated sentence. No text rewritten for subtitles may overwrite it.
- **I3 block monotonicity**: on the source side, a sentence's `blocks[]` are non-overlapping, sequentially contiguous word ranges. On the target side, they are non-overlapping, sequentially contiguous character ranges. Blocks advance monotonically in order. Within a block, arbitrary many-to-many mappings and local reordering are allowed.
- **I4 boundaries fall only on blocks**: each piece in `pieces[]` = the union of several **consecutive** blocks. Never cut inside a block. When `correspondence: "sentence"`, the whole sentence is a single block.
- **I5 separation of user intent**: `breaks` stores only explicit user intent. Optimizer results are written only to `autoBreaks[profile]`.

## 3. Source Subtitles: LayoutProfile, autoBreaks and Global DP

### 3.1 `LayoutProfile` (new module `layout_profile.rs` in ccut-flow-core)

Consolidate the three scattered sets of thresholds into one table-driven structure, serving as the common source for the optimizer, the alignment DP, check, and the CPS coloring on each surface:

```rust
pub struct LayoutProfile {
    pub id: String,                       // "default" | "portrait" | "netflix-2line" …
    pub source: CueParams,                // existing structure, maxChars etc.
    pub target: fn(lang) -> TransParams,  // existing fit/soft/hard table
    pub max_lines: u8,                    // max lines per caption; M1 keeps 1
    pub cps: CpsBudget,                   // per language: warn / bad (unifies 9/13/17/21 with target_reading_cps)
    pub min_duration_sec: f64,            // 1.0 (current min_cue_display_sec)
    pub max_duration_sec: f64,            // 7.0 (current LONG_DWELL_SECONDS)
    pub lead_in_sec: f64, pub tail_sec: f64, // 0.5 / 1.0 (current SUB_TIMING)
}
```

- The numbers in the `default` profile = all of today's constants, guaranteeing zero behavioral drift at the first milestone.
- The transcript's top level records `layoutProfile` (default `default`). During implementation it moves from project.json to the transcript, so that all three implementations can determine which `autoBreaks` to merge by reading only the transcript. CLI `--layout-profile`.
- Netflix Simplified Chinese at 16 characters per line, two lines, ≤7s, etc. are just another profile's data and do not go into the algorithm.

### 3.2 `autoBreaks[profile]`: Optimizer Output Separated from User Intent

```jsonc
"breaks":     { "g3.7": "break" },                       // only the user's explicit intent remains
"autoBreaks": { "default": { "g5.2": "break", "g9.1": "nobreak" } }
```

- Consumer replacement rule: during §18.5 derivation, use `pins = autoBreaks[profile] ⊕ breaks` (user keys override automatic keys) in place of today's `breaks`. This is the only change needed in every implementation (Rust `derive_cues`, Swift `TranscriptProjectionAdapter.deriveCues`, `designs/cuccut-mac/app/transcript-model.js`, and gpui via `data.json`): a single map merge. The derivation algorithm and the contract fixture `cueDerivations[]` stay unchanged; only a new case for “user pin overrides automatic pin” needs to be added.
- The optimizer now **always runs** (no longer “skip when breaks is non-empty”), treating user `breaks` and `paraBreaks` as hard boundaries.
- Migration: all existing projects' `breaks` are treated as user intent (their origin cannot be told apart, so we err on the conservative side). Only when the `stages.asrLayout` fingerprint shows no manual layout intervention may the upgrader migrate the whole table into `autoBreaks.default`.
- `patchTranscript` adds a top-level sparse `autoBreaks` table. The `stages.asrLayout` fingerprint hashes only `breaks` (user layout intent). The fingerprint is produced uniformly by `ccut_flow_core::layout::layout_fingerprint`.

### 3.3 Global DP over Candidate Breaks (Replacing `repartition_for_reading_time`)

Keep the six §18.5 rules as the **candidate generator** and final replayer. The optimizer no longer repairs pair by pair but selects globally:

```text
Hard boundaries (must break): user break, speaker change, paraBreaks, chapters, (from M3) timeline cut
Forbidden boundaries: user nobreak, inside locked terms, between numbers and units, inside Latin words,
          between articles/auxiliaries/negators and the constituent that follows (seam.rs already has objective grammatical-error criteria; English rules are added on the source side)
Soft candidates: sentence-final punctuation 0 < clause punctuation 0.3 < pause ≥ pauseSec 0.5 < ordinary word boundary 0.8   (reusing the split.rs penalty scale)

dp[j] = min over i<j, [i..j) valid, of dp[i] + cueCost(words[i..j))
cueCost = heavy penalty for line-width overflow (short English clauses may use trailing-punctuation slack, see below)
        + reading-speed penalty (linear when cps exceeds warn, quadratic when it exceeds bad; the time window borrows silence using lead_in/tail)
        + penalty for duration too short (< min_duration) / too long (> max_duration)
        + seam penalty (table above)
        + orphaned short-tail penalty (last segment < minClauseChars and the preceding segment is not full)
        + penalty for length imbalance between two segments
```

- The output is still a **minimal pin set**: `autoBreaks[profile]` is written only where the result differs from the `auto_break` replay (reusing the diff logic of `balanced_cue_breaks`). Therefore the three implementations need no DP, only replay.
- For English (`en` / `en-*`) source Cues, first use `source_boundary::english_cue_boundary_issue` to rule out recognized dangling function words, modifiers, negators/auxiliaries, and boundaries inside fixed phrases; then optimize width and CPS among the remaining candidates. This function reuses the source-boundary judgment already used by translation alignment and adds Cue rules on top. Alignment calls keep using the original criteria, and the local Agent and Cloud polish/segment write-backs share the same layout entry point.
- An English clause punctuation mark that has enough body text and duration and is followed by a new clause is a protected boundary. The optimizer must not write `nobreak` to suppress it merely to balance width or CPS. Short filler words and enumeration commas are still handled by ordinary layout, and explicit user `break` / `nobreak` keep priority.
- When a short English clause is not enough to fill two minimum display durations, the existing `overflowSlack` may absorb the trailing punctuation, so that `I think that's very dangerous for the world.` is not split into a flashing `I think`. When an unsplittable phrase by itself exceeds the budget, keep the complete unit and let the width check surface the problem, rather than falling back to an illegal cut point.
- The English judgment is a conservative rule over a bounded word window; it does not claim to cover arbitrary English syntax or all proper nouns. Candidates and scoring for other languages are unchanged. Automatic breaks in existing projects are recomputed the next time the layout write path runs; reading a project and replay never implicitly rewrite them. The screenshot regression fixture is `core/fixtures/align/source-cue-boundaries.json`.
- Complexity O(n·W) (W = maximum words per cue). Each sentence/paragraph is solved independently.
- The Swift mirror `applyBalancedCues` in `apps/mac` is removed. Optimization runs only in the CLI backend (as already required by mac-port design §4.2).

### 3.4 Line layer: named, but no new persisted state

With `max_lines = 1`, behaviour is identical to today. The `max_lines = 2` profile (M4) runs a second, intra-cue line-break DP inside the Cue DP (reusing the balance and boundary-penalty scoring of `subtitle-rendering.js::sourceDisplayLines`, ported to Rust as `line_break_plan`). It is used only to add a "two-line imbalance" term to `cueCost`. Break positions are still decided by the render-time projection and are not persisted. As a result, "Cue boundaries (new time events)" and "Line boundaries (visual wraps within the same event)" are two results from two sources, and they do not contaminate each other.

## 4. Bilingual subtitles: Alignment Block

### 4.1 Flow

```text
Sentence → trans (full natural translated sentence, already exists)
        → alignment edges: source word index ↔ target character range           §4.2
        → safe-boundary detection + minimal monotonic alignment blocks blocks      §4.3
        → bilingual DP: blocks → pieces (each piece = union of consecutive blocks)  §4.4
        → decision tree: merge / monotonic rewrite / sentence-level correspondence  §4.5
        → timing allocation, seam lint, write back transAlign                       §4.6
```

### 4.2 Source of alignment edges: `WordAligner` abstraction

```rust
pub struct AlignEdge { pub src: usize /* word index within the sentence */, pub tgt: Range<usize> /* character range in the normalized trans */, pub weight: f32, pub hard: bool }
pub trait WordAligner { fn align(&self, src_words: &[&str], tgt: &str, ctx: &AlignCtx) -> Vec<AlignEdge>; }
```

The two implementations are stacked by confidence, with hard edges taking priority. (**There is no local aligner.** The `ModelAligner` slot that was once reserved was filled by a local scorer, but it was removed entirely on 2026-08-18 together with the local text-model feature. The historical design is in [semantic reranker alignment design](../../archive/subtitle/ccut-semantic-reranker-alignment-design.md) (**archived**).)

| Implementation | Edge type | Cost | Status |
| --- | --- | --- | --- |
| `AnchorAligner` (deterministic) | numbers, dates, URLs, verbatim Latin fragments, brief-locked terms, person names → `hard` | 0 | reuses the matching logic of `unique_anchor_bindings` / `anchor_token_colocation`, changed to emit edges |
| `LlmChunkAligner` (default) | LLM outputs "target semantic chunk → set of source word indices"; the program expands these into edges, and `weight` is determined by chunk size and whether an anchor corroborates it | merged into the translate call; falls back to a dedicated `align-edges` call on failure | new, see §6 |

LLM chunk-level alignment is more stable than word-level alignment. The model does not need to output token indices; it only needs to split the translation into semantic chunks as small as possible and list the source word indices that each chunk corresponds to (these may be non-contiguous, out of order, or empty). Protocol constraints: each source word index belongs to at most one chunk (or to none), and the target chunks **exactly** partition the whole sentence by character range. This is a bipartite partition rather than an arbitrary bipartite graph, so validation is simple, and it naturally expresses "one-to-many / many-to-one / omitted translation".

### 4.3 Safe boundaries and minimal monotonic blocks (deterministic core)

Let candidate cut points in the translation be at character position k (only legal seams on the target side are considered: punctuation, whitespace, and CJK character boundaries that are not objective grammatical errors, reusing `seam.rs`):

```text
leftMax(k)  = max{ e.src | e.tgt.end ≤ k }        largest source word index aligned by the translation left of the cut
rightMin(k) = min{ e.src | e.tgt.start ≥ k }      smallest source word index aligned by the translation right of the cut
k is a safe boundary  ⇔  leftMax(k) < rightMin(k)
```

- Only `hard` edges and soft edges with `weight ≥ τ` (τ is configurable, default 0.5) count in this judgment. Low-confidence soft edges do not participate, so that one misjudgment cannot merge a whole sentence into one block.
- For each safe boundary, the source-side breakpoint is chosen within the interval `(leftMax, rightMin]`: first prefer sentence-final or clause punctuation, pauses, and syntactic seams; then prefer positions close to the ideal length ratio. This is the current two-stage discipline of "freeze the target piece first, then map it to a contiguous range of source words", except that the guarantee moves from the model's self-discipline to code.
- The span between two adjacent safe boundaries is one **minimal monotonic alignment block**: source side `[srcFrom, srcTo]`, target side `[tgtFrom, tgtTo)`. Source words not covered by any edge (articles, omitted translations) are merged into the preceding block (sentence-initial ones are merged into the following block).
- Regions with crossed word order automatically fall into the same block. For example, `I didn't go / because I was sick` ↔ `因为我病了，所以没去` (because I was sick, so I didn't go) is one block for the whole sentence, and `the plan we discussed yesterday` ↔ `我们昨天讨论的计划` (the plan we discussed yesterday) is one noun-phrase block while the rest of the sentence can still be split. This is the direct implementation of §5 of the report, "local crossings need not merge the whole sentence."
- A block's `confidence` = the minimum edge weight among the edges supporting its two boundaries. `flags`: `local-reorder` (a crossing edge exists inside the block), `anchor` (contains a hard anchor), `weak` (soft edges only).

### 4.4 Bilingual DP: blocks → pieces

Blocks are the atoms, and `pieces` = unions of consecutive blocks. A piece is constrained by both languages at once:

```text
dp[j] = min over i<j of dp[i] + pairCost(blocks[i..j))
pairCost = targetLayoutCost (step penalty above fit, infinite above hard, close to soft; reuses split.rs penalties and TransParams)
         + sourceLayoutCost (source span width > single-line budget, or time window > 4s/6s: reuses the source_ceiling criterion)
         + sharedDurationCost (time window < target-language target_required_seconds ⇒ penalty; > max_duration ⇒ penalty)
         + targetSeamPenalty + sourceSeamPenalty (seam.rs objective grammar errors = infinite; dangling conjunctions / trailing “的” etc. step penalties)
         + blockMergePenalty (light penalty when merging several blocks, encouraging fine-grained alignment)
         + lowConfidencePenalty (extra penalty for cutting at a weak boundary)
Hard constraints: never cut inside a block; never cut a locked term; do not cross a speaker / paraBreak / timeline cut; neither side may exceed the absolute limit; target CPS ≤ hard
```

Three magnitude rulings (2026-08-18, from the post-mortem of a real 9-minute run on s-g40.34 / s-g7.0 / s-g38.25):

- The over-fit step ladder in `targetLayoutCost` **grows quadratically** with the amount of overflow. Just past fit pays `OVER_FIT_PENALTY` (the low end of the grey band does not change existing trade-offs), and reaching hard pays three times that. With a flat penalty, "a whole line stuck at hard" (1.5) would always be lighter than a bad source-side seam with a dangling copula (`BLOCKING_SEAM_PENALTY` + 0.8), so the DP would rather keep a 20-unit full line. Yet check's `align-paired-density` requires cutting at exactly that target seam, and a refine rerun would only produce the same blocks, wasting a round of calls. hard is a ceiling, not a target.
- A seam closed by clause-final punctuation in `sourceSeamPenalty` is a legal seam. In `Generally speaking, though, | the …`, the `though` is in the prefix-word table, but the comma already closes the parenthetical, so the line ending there does not dangle. Only unclosed tokens are judged illegal by the prefix table.
- The 顿号 (enumeration comma 、) in `targetSeamPenalty` follows the same criteria as `seam::lint_pieces`: when coordinated items are split and the left and right pieces, once merged, are still ≤ hard, the 顿号 is not a seam (it is charged as `BLOCKING_SEAM_PENALTY`). The candidate seam table charges "left piece | the entire remainder", and the remainder almost always exceeds hard, so the 顿号 always looks cheap. The DP, in `pairCost`, knows the real width of the right piece, and takes the left piece as the predecessor piece that dp has already chosen for block i. If the sum of the two is ≤ hard, it counts as a blocking seam. Otherwise check would report this cut as `align-target-seam`, and refine would waste a round.

Because blocks already guarantee semantic monotonicity, every piece the DP outputs naturally satisfies "this Chinese line really translates this English line". The checks that today reject results after the fact (`degenerate_paired_row` / `paired_density` / `bilingual_anchor`) become cost terms of the DP or hold by construction.

### 4.5 Decision tree

```text
blocks computed
 ├─ all blocks ≤ hard and DP has a solution       → correspondence: "block", write pieces
 ├─ local crossing blocks exist, but still ≤ hard after merging → same as above (pieces are just longer)
 ├─ some block > hard (does not fit even after merging) → trigger the narrow task "monotonic display rewrite" (§6.3)
 │       rewrite passes → write transDisplay, re-align (edges→blocks→DP)
 │       rewrite rejected / magnitude exceeds guardrail ↓
 └─ still no solution, or sentence block confidence < τ_s → correspondence: "sentence": one block for the whole sentence,
        source highlighted word by word using word timing, translation shown statically as a whole sentence, explicitly marked, no fabricated block-level correspondence
```

The difference from the current design: today the model first reorders and rewrites, and crossing is only used if the rewrite is unnatural. This plan **merges first (no rewrite, no call)**, rewrites only when the merged result really exceeds the hard limit, and falls back to sentence-level correspondence if the rewrite also fails. The rewrite trigger rate will be significantly lower than today's `reordered` rate.

**2026-09-24 revision (crossing best-effort and degradation that does not exceed hard)**:

- When the model self-reports `data-crossing="true"`, the sentence is no longer downgraded to `correspondence: "sentence"`. The worker already produces rows under the contract "cut at natural seams of the target language, and take a best-effort monotonic cut point on the source side". The engine therefore keeps these rows and source cut points (`correspondence` remains `block`), and records only one entry in violations: `declared word-order crossing … row-level correspondence is approximate`. Reason: a whole-sentence downgrade in a paired wrap-up round is equivalent to handing back 1 piece, which is necessarily rejected. The old entries had already become invalid because the translation had changed, so the result ended up displayed as a single whole-sentence cue exceeding `hard` (s-g9.0 round 3: 28 characters on one line, `align-stale` + `translation-overflow`).
- If the whole-sentence translation in the last branch of the diagram above exceeds `hard`, it must not produce a single line. First cut it into two pieces at the deterministic target seam given by `seam::preferred_target_split` (adopt only if both pieces are ≤ `hard`). Otherwise, fall back to a deterministic split proportional to source-word durations. Record the fallback (`aligner: deterministic/1`) and append the violation `cut at a deterministic target seam`. The display projection `derive_trans_cues`'s whole-sentence fallback cue, used only when there are **no entries at all**, is not part of the alignment degradation path and is not bound by this rule (it is still reported by `align-stale` / `translation-overflow`).

### 4.6 Timing and write-back

- Each piece gets `at = t0`, the earliest source-word time in the block, and `until = t1`, the latest source-word time in the block. It then reuses `smooth_trans_cue_times` / `pad_trans_cue_times`: only real silence between adjacent subtitles, or blank space at the media tail, is borrowed to fill up to `min_duration`. It never overwrites the next cue.
- The time window for `correspondence: "sentence"` = the time window of the whole sentence's words, as a single translation piece.
- The write-back order remains `trans` (untouched) → `transDisplay` (if any) → `transAlign`.

## 5. Data structure changes (transcript `0.4`, `0.3` still readable)

```jsonc
{
  "ccutTranscript": "0.4",
  "breaks":     { "g3.7": "break" },
  "autoBreaks": { "default": { "g5.2": "break" } },
  "trans":        { "zh": { "s-g1.0": "因为我病了，所以没去。" } },
  "transSrc":     { "zh": { "s-g1.0": "8:g1.0:g1.7:ab12cd34" } },
  "transDisplay": { "zh": { "s-g1.0": {                       // present only when a monotonic rewrite is triggered
      "text": "我没去，因为我病了。",
      "basis": "monotonic-rewrite",
      "transFingerprint": "…"                                  // fingerprint of the corresponding trans text; mismatch ⇒ display-stale
  } } },
  "transAlign": { "zh": { "s-g1.0": {
      "mode": "manyToOne",
      "words": ["g1.0", "…", "g1.7"],
      "correspondence": "block",                                // block | sentence
      "textBasis": "display",                                   // trans | display: which text the pieces concatenate to
      "aligner": "llm-chunk+anchor/1",
      "blocks": [
        { "src": [0, 2], "tgt": [0, 4],  "confidence": 0.9, "flags": [] },
        { "src": [3, 7], "tgt": [4, 10], "confidence": 0.8, "flags": ["local-reorder"] }
      ],
      "pieces": [
        { "from": 0, "to": 2, "text": "我没去，" },
        { "from": 3, "to": 7, "text": "因为我病了。" }
      ]
  } } }
}
```

Invariants and invalidation semantics (added on top of §4 of v0.3):

- The concatenation invariant becomes `normalize(concat(pieces.text)) == normalize(textBasis == "display" ? transDisplay.text : trans)`.
- `blocks` satisfies I3; `pieces` satisfies I4 (each piece's `from/to` and `text` ranges are unions of consecutive blocks). A violation ⇒ `align-stale`, downgrading to whole-sentence display (current semantics).
- If `transDisplay.transFingerprint` does not match the current `trans` ⇒ `display-stale`: delete `transDisplay` and that sentence's `transAlign`, and fall back to displaying the natural whole-sentence translation.
- Old entries with `crossing: true` are mapped on read to `correspondence: "sentence"` (keeping the pieces' timing, and no longer claiming per-piece correspondence). `oneToOne` / `cues` handling is unchanged.
- The `independent` mode does not include `blocks` (it makes no alignment claim), and `correspondence` defaults to `"sentence"`.
- Alignment edges (`edges`) do not enter the transcript. They are written as recomputable AI artifacts to `ai/align/<lang>/vNNN/edges/<sid>.json` for review and re-runs.
- Editing semantics (v0.3 §8 table) additions: editing a translation line's text → write the corresponding `textBasis` text and keep the concatenation invariant, and the target character ranges of blocks shift by prefix-difference deltas. Moving a line boundary → only allowed to snap to block boundaries; dragging across blocks equals block merge/split, and the DP is re-run immediately. Editing the whole-sentence translation → delete `transDisplay` + `transAlign` (current behaviour).
- `patchTranscript` adds `autoBreaks`, the top-level `transDisplay` table, and the `blocks/correspondence/textBasis` fields inside `transAlign`.

## 6. LLM contract changes (local agent and Cloud Model in sync)

### 6.1 Fused translation: `data-align-*` changes from a "two-column table" to "block alignment edges"

The current fused answer is `data-align-target="片1 | 片2"` + `data-align-breaks='["b7"]'` (the model decides both the translation cut points and the source cut points at once). Change it so the model only labels semantic blocks and source-word attribution, for example:

```html
<p data-sid="s-g1.0" data-align-words="1:the 2:plan 3:we 4:discussed 5:yesterday …">
  <span data-src="3 4 5">我们昨天讨论的</span><span data-src="1 2">计划</span>…
</p>
```

- The body text is still a complete, natural translated sentence. `<span>` is only a wrapper; after stripping the tags, the text must equal the `<p>` body character for character. A parse failure only discards the draft and does not reject the translation, as in the current policy.
- `data-src` is a set of source-word ordinals. It may be unordered or empty, and each ordinal appears at most once.
- The contract also keeps a "sentence-order-driven" preference: when two renderings are equally natural, prefer the one that follows the source clause order. This reduces crossings at the source.
- Sentences where fusion fails or is not enabled use a dedicated `align-edges/1` carrier (the same microformat, in a separate request). It replaces the current `align-table/1` as the **default** alignment carrier.
- **The fused draft is an optional channel** (`ccut translate --align-fusion rows|on|off`, default `rows`). With `off`, the prompt omits `data-align-*` and the fusion contract section, falling back to the plain translation contract (shorter, with fewer constraints). The parsing side is unchanged: if an answer still contains `<span data-src>` under `off`, it is treated as plain text and the page is not rejected.

**`rows` mode (default)**: the contract no longer asks the model to mark semantic blocks. Instead, it asks the model to cut the whole translated sentence, in source-word order, into **display rows**. In `<span data-src="a-b">`, `a-b` is a single contiguous increasing range. Adjacent rows abut each other and together cover `1..N` exactly. The carrier also carries `data-align-groups` (`firstOrdinal-lastOrdinal@startSec-endSec`, semicolon-separated, ordinals as 1-based closed intervals, seconds relative to sentence start with one decimal place). This is a deterministically computed source-side grouping hint. Seeds are the first words of source subtitle cues. Cuts are then added at clause punctuation or silences ≥ 0.35 s, small groups are merged with neighbours, and large groups (> 5 s or > 14 words) are split at their largest internal pause. A row must be one group or a union of several adjacent groups, and must not cut inside a group. Each row is ≤ `fit` and never exceeds `hard`, with reading speed ≤ 6 units/s.

Row partitions are persisted through the standalone entry point `align_block::plan_sentence_rows`. The minimal monotonic blocks of §4.3 become **grouped by row**: the candidate cut set is merged with the start points of each row. The block starts produced by `minimal_monotonic_blocks` must hit every row start exactly. Otherwise the row boundary is straddled by an anchor, and the whole sentence returns `None`. Only when a row exceeds `hard` is the §4.4 bilingual DP run on that row's block subsequence alone. Blocks are never merged across rows, and if a row has no solution, the whole sentence also returns `None`. On success, blocks and display rows correspond one-to-one. `aligner` is set to the new label `llm-rows+anchor/1`, `correspondence` remains `Block`, and the block-level invariants I3/I4 are unchanged. In effect, the block granularity just gets coarser, from "semantic blocks" to "display rows". If any step fails, the engine silently falls back to the regular block-merging path of `on` mode, so a bad draft does not reject the translation. If a row boundary fails to land on a `data-align-groups` group boundary (`on_groups=false`), that is not a failure. It is only counted in the `alignFusionRowsOffGroup` observation hit rate in `--json`. `data-align-groups` is only a hint attribute and is not persisted into the transcript.

After row grouping and before `plan_entry`, a **deterministic short-row merge** (`merge_short_rows`) runs. In practice, the model cuts rows almost one-to-one along the source groups (each sentence has clearly more rows than in regular fusion), and the contract's "prefer merging" wording has no effect, so the engine handles it instead. For two adjacent pieces in the same sentence, the merge triggers if either piece is "too fast" (reading speed > 6 units/s) or "too small" (duration < 1.0 s or width < 6 units). However, **merge guards are tiered**. A merge triggered by "too fast" may grow the merged width up to `hard` (zh 20), because there is no cheaper remedy for reading speed other than lengthening the time window. A merge triggered only by "too small" still respects `fit` (zh 16). Both tiers also require the merged duration to be ≤ 7 s. This is a deliberate width-for-reading-speed trade-off, consistent with the bilingual DP in §4.4 (in `pairCost`, exceeding fit is only a penalty step; only exceeding hard is a hard constraint). In the fourth cross-check round, rows' overFit was already down to 1–2%, while cps > 6 was still 12–13% (`on` median 7.9%). Giving up width for reading speed is exactly the missing step. When both sides can merge, take the side with the lower reading speed after merging (ties go left, to keep it deterministic). Iterate until no legal merge remains. **Only pieces (`groups`) are merged; `blocks` are not touched.** Blocks still record, row by row, the source-word↔translation correspondences given by the model, so downstream bilingual highlighting does not become coarser because of merging. Fragments that the in-row DP split off because they exceeded `hard` are not glued back by this step. Both guard tiers are ≤ `hard`, and those fragments were split precisely because joining them would exceed `hard`. The number of rows merged away is counted in `AlignOutcome.rows_merged` (`rowsMerged` in `--json`) and is not persisted into the transcript.

**Soft resend when a whole page lacks rows**: if, on a page, there are ≥ 3 sentences that requested rows (non-empty `data-align-groups`) and fewer than 30% of them got a valid row partition, the page is judged to have abandoned row annotation altogether. (The model occasionally returns a structurally complete answer that keeps only the `id`s and gives no `<span data-src>` at all.) The engine resends that page once, unchanged (same system/user prompt), with `retry_reason` replaced by a version that stresses "the previous attempt had no display rows at all". This is a soft retry. It does not consume the page-level error retry budget and does not reject the page, and it runs at most once per page. If the second attempt still lacks rows or the transport fails, the first result is kept. If the second attempt is usable, both the translation and the row draft follow the second attempt. The provider and the agent use the same criterion. Not applicable to `routed` (final timeline) translation. The count is recorded as `rowsPageRetries` in `--json`.

### 6.2 `align-table/1` demoted to a review and repair carrier

The current HTML two-column table is kept, for humans and agents to inspect low-confidence blocks (`weak`, `local-reorder`, `sentence` downgrade) and for targeted repair via `refine-align`. Table rows are now rendered per block, with `data-block-confidence`. `data-reordered` and `data-crossing` are removed from the writable attributes.

### 6.3 New narrow task: `align-rewrite/1` (monotonizing display rewrite)

Triggered only by the third branch of §4.5. Input: the source sentence (with word ordinals), the natural translation, the over-limit blocks and their source ranges, `TransParams`, and locked terms. Output: **one** new target-language sentence. The contract in one sentence:

> Without losing any fact, negation, number, proper noun or locked term, rewrite this translation so that its order is as close as possible to the source meaning order and every alignment block fits within the hard budget, as subtitle text. Output only the rewritten full sentence.

Acceptance: the existing ±max(25%, 4 units) magnitude guardrail applies; locked terms and numeric anchors must all be kept; AutoCorrect runs piece by piece. After passing, write `transDisplay`, then **re-run the alignment edges and blocks** (the model's self-reported monotonicity is not trusted).

### 6.4 Sync obligations

Add `filepipe/align_edges.rs` alongside `filepipe/align_table.rs` (render / parse / reverse-parse trio, plus round-trip tests). In `engines/align.rs`, `accept_answers` gets a layer in front: `edges → blocks → DP`. The submit-time lint in `core/crates/ccut-kernel/src/cmd/task.rs` shares one string-level validator with the engine (following the one-validator principle of `file_contract_lint_and_engine_share_one_string_level_checker`). Sync the alignment-carrier table and error-code table in `skills/cuccut/references/agent-tasks.md`. Add `edges/` to the `ai/state` and `ai/align/<lang>/vNNN` artifacts.

## 7. Consumers and multi-surface sync

`--align-fusion rows` only changes how `blocks` are computed in §6.1 (block granularity coarsens from semantic blocks to display rows). It adds no new fields and does not change the shape of `blocks[]`, `pieces[]` or `correspondence`. Every consumer in the table below still reads the same `TransAlign`, so no separate adaptation is needed for rows mode. The `llm-rows+anchor/1` value in the `aligner` field is diagnostic information only and plays no part in consumer rendering decisions.

| Surface | Impact | Handling |
| --- | --- | --- |
| CLI `data.json` / JSON export | `sentences[].trans[lang]` gains `correspondence`, `textBasis`, `blocks[]`; `crossing` is kept for one compatibility release and marked deprecated | `studio.rs::derive_project_rows`, `media.rs::build_json_export_payload` |
| Web Studio `skills/cuccut/templates/studio` | The `语序交叉` (word-order crossing) chip on `SentenceCard` becomes `整句对应` (whole-sentence correspondence). Between paired rows `.tg-pair`, block ticks and `weak` markers are shown. Dragging row boundaries snaps to block boundaries. Canvas lanes are unchanged | `panes.jsx`, `store.jsx`, `subtitle-rendering.js` |
| `apps/mac` | Sync the chip and block ticks in `TransSentenceCardView` / `TranslateCardOriginalLineView`. `deriveCues` merges `autoBreaks`. Delete the Swift `applyBalancedCues` mirror | See §3.2, §3.3 |
| `designs/cuccut-mac` prototype | `transcript-model.js` merges `autoBreaks` (`optimizeBreaks` is kept inside the prototype as a reference but is no longer a production cross-check source). `translate-model.js` is synced | Use the baoyu-design workflow |
| `apps/gpui` | Consumes Cues only via `data.json`. Add fields to the `TransCue` struct. There is no bilingual pairing panel yet, so the pairing UI does not apply | `projection/doc.rs` |
| `apps/windows` | Translation alignment is not implemented, so it does not apply | — |
| Export (SRT/VTT/ASS/MP4) | Monolingual target-language export uses the `textBasis` text. The bilingual union segmentation logic is unchanged | `derive_trans_cues` |
| `ccut check` | New lints are in §8. `align-bilingual-anchor-crossing` is retired | `ai/check.rs` |

CLI/serve reference doc sync items: `--layout-profile`; the `autoBreaks`/`transDisplay` patch keys; the `writes` of the `align` stage in `ccut spec` gains `transcript.transDisplay` and `transcript.autoBreaks` (written in the respective entries for `align`, `polish` and `segment`).

## 8. Acceptance metrics and evaluation

New in `ccut check` and `alignDiag` (aggregated per language, plus per-sentence details):

| Metric | Definition |
| --- | --- |
| `align-coverage` | Share of source words, and share of translation characters, covered by ≥ 1 hard/soft edge |
| `align-crossing-rate` | Share of sentences containing a `local-reorder` block; crossing edge pairs within blocks / total edges |
| `align-safe-boundary-ratio` | Share of safe boundaries among legal seams in the target language |
| `align-sentence-degrade-rate` | Share of sentences with `correspondence: "sentence"` (broken down by: low confidence / over hard with no solution / independent) |
| `align-rewrite-rate` | Share of sentences that trigger `align-rewrite`, and its pass rate |
| `align-manual-edit-rate` | Share of sentences where the user edited block or row boundaries (recorded by apply) |
| Existing | CPS/CPL/fit/soft/hard, seam defect, `align-overfit`, etc. are kept |

Offline evaluation: build a golden set with human-verified bilingual subtitles under `core/fixtures/align/` (first take one segment from each of the three projects in `examples/`). Implement SubER (a TER variant that penalizes text, segmentation and time offsets together) as a regression metric, and include it with the `align-*` structural metrics as an optional step in `verify.sh`. Goal: compared with the current many-to-one, on the same LLM and the same fixtures, SubER does not regress; `sentence-degrade` and `rewrite-rate` are both lower than the current sum of `crossing + reordered`; and `bilingual-anchor` mismatches are 0 (by construction).

## 9. Implementation milestones

| Milestone | Content | Acceptance |
| --- | --- | --- |
| **M0 Spec** | Finalize this plan. Add `autoBreaks`/`transDisplay`/`blocks`/`correspondence` to format-spec §18.4/§18.5/§18.7. Mark superseded clauses in the v0.3 design doc | Document review |
| **M1 LayoutProfile + autoBreaks + source DP** | `layout_profile.rs`. `autoBreaks` table and patch. `layout.rs` global DP replaces `repartition_for_reading_time`. Three-side merge rules + new contract fixture cases. Upgrader migration strategy | `cargo test -p ccut-flow-core`. `cueDerivations` fixtures pass on all three sides. Under the `default` profile, existing fixture output shows zero drift, or each difference is explained one by one |
| **M2 Block core (pure functions)** | `align_block.rs`: `AlignEdge`, safe boundaries, minimal monotonic blocks, bilingual DP. New `TransAlign` fields and validation. `crossing` compatibility mapping. `derive_trans_cues` consumes `textBasis` | Table-driven tests covering all example sentences in the report (causal inversion, relative clauses, local crossings, omitted translation, numeric anchors) |
| **M3 LLM contract** | `align_edges.rs` carrier + fused translation protocol change + `align-rewrite/1`. `AnchorAligner`/`LlmChunkAligner`. Both execution paths and the submit-time lint kept in sync. agent-tasks docs. `align-table/1` demoted to a review carrier | Shared regression fixtures. translate→align end-to-end test. The `fused draft` zero-call path still passes |
| **M4 Consumers** | Sync studio / mac / gpui / designs. Export. New check lints and metrics. `--layout-profile`. `line_break_plan` for the two-line profile | Per-surface tests or visual verification. serve contract tests |
| **M5 Evaluation and optional aligner** | Golden set + SubER. `ModelAligner` feasibility (model size, MLX/Candle inference latency, agreement rate with LLM block alignment) | Evaluation report. Decide whether to enable by default |

M1 and M2 are independent and can run in parallel. M3 depends on M2. M4 depends on M1+M3.

## 10. Risks and Decisions Pending

Risks:

- **LLM block alignment quality**: where the translation is abridged or free, the model may return an empty or wrong attribution. Mitigations: hard-anchor validation (numbers and terms must fall in the same block), low-weight edges do not take part in safe-boundary decisions, a `sentence` degradation exit, and the review table exposes `weak` blocks.
- **Large regression surface**: `align.rs` is nearly 9k lines and its acceptance criteria are dense. Mitigations: in M2, land it first as pure functions and cross-check against the existing criteria (DP results must pass all blocker-level checks from today); in M3, switch the default path and keep a one-release fallback switch, `--align-carrier table`.
- **`transDisplay` adds a "which text" mental load**. Mitigation: it exists only when a rewrite is triggered; the UI shows the subtitle text by default, labelled “已为字幕改写” (“rewritten for subtitles”), and sentence cards can expand to show the natural translated sentence.
- **Profile switching cost**: switching profile requires re-running the source DP and the bilingual DP. Both are deterministic and make zero LLM calls.

Decisions for you (defaults in bold):

- **D1** Whether `autoBreaks` is keyed by profile: **yes** (otherwise portrait and two-line profiles would have to overwrite the same table).
- **D2** Default source of alignment edges: **LLM block-level alignment fused into translate** (zero extra models) vs. a local SimAlign model first.
- **D3** Whether rewritten text lands in a separate `transDisplay` table vs. the current write-back to `trans` with added provenance: **separate table** (I2 invariant, auditable "why this translation reads this way").
- **D4** Whether `align-table/1` is fully retired: **kept as the review and repair carrier**, no longer the default alignment protocol.
- **D5** Version number: **bump to `0.4`, with 0.3 read-only compatible** (the `crossing` semantics change should not happen silently).
- **D6** Whether two-line profiles (`max_lines = 2`) go into this round: **yes, in M4, but the default profile stays single-line**.

## 11. Comparison with Papers and External Approaches

- **FBK IWSLT 2026 (`2026.iwslt-1.7`)**: two stages. First, VAD and Whisper produce time-aligned subtitles, and each subtitle is translated on its own (contrastive-1). Then, for long audio, they aggregate and transcribe with Voxtral, split into sentences at strong punctuation, translate sentence by sentence with MADLAD, and finally use mweralign (Levenshtein re-segmentation) to pour the sentence-level translations back into the first-stage SRT timing template. The conclusion is that "sentence-level re-segmentation" is the main source of gains; on en-de and es, translation quality and SubER both improve. Worth adopting: the sentence-level translation unit (CucCut already does this); SubER as an evaluation that covers text, segmentation and timing together; CPS/CPL thresholds per language (zh 9 cps / 16 字 (characters), ja 4 cps / 13 字, others 21 cps / 42 字) as profile data. **Not worth adopting**: re-segmenting the translation against the **source subtitle timing template**. The paper's Table 5 primary output, `Die Erwartungen in Bezug auf / die Kürzungen der Fed haben sich sehr verfestigt.`, is exactly a template-driven cut placed after a preposition. For target languages with large word-order differences, such as zh and ja, template re-segmentation is precisely what this design replaces with aligned blocks. Their reading-speed fix also only "extends the end time to the next cue's start", which is weaker than CucCut's use of real silences.
- **Netflix TTSG**: grammatical units first, two lines, Simplified Chinese 16 字 (characters) per line, a single cue ≤ 7s. These go into `LayoutProfile`, not into the algorithm.
- **SimAlign / awesome-align**: unsupervised or fine-tuned multilingual word alignment. Corresponds to `ModelAligner`, as a second source alongside LLM block alignment and as a consistency check.
- **Phrase-translation alignment consistency constraint (Koehn et al. 2003)**: phrase pairs must not contradict the word alignment. `leftMax < rightMin` is exactly this, repurposed as a subtitle boundary criterion.
- **AppTek subtitle compression (IWSLT 2025)**: treat length-constrained rewriting of the translation as a separate step. Corresponds to the separation of `align-rewrite/1` and `transDisplay`.
- **SubER (IWSLT 2022)**: an edit rate that considers text, segmentation and timing together. The M5 evaluation baseline.

## 12. Implementation Log

- 2026-08-16 data model (commit `0261dc1`): `ccutTranscript` bumped to `0.4`, with `0.3` read-only compatible (`SUPPORTED_TRANSCRIPT_VERSIONS`; `from_json` bumps the version number on read-in); `TranscriptDoc` adds `autoBreaks` / `layoutProfile` / `transDisplay` and `effective_breaks(profile)`; `TransAlign` adds `correspondence` / `textBasis` / `aligner` / `blocks` and `TransAlign::new` / `correspondence()` (legacy `crossing:true` ⇒ `sentence`); `ccut upgrade` writes the 0.3 version number as 0.4.
- 2026-08-16 M1 (commit `9e3c810`): `layout_profile.rs` (`LayoutProfile::default_profile()` equals the old constants; `CpsBudget{warn,bad,reading}` unifies the three CPS thresholds); `derive_cues` reads `effective_breaks`; the global DP over candidate breakpoints in `layout.rs` replaces `repartition_for_reading_time`; the minimal pin set writes only `autoBreaks[profile]`, and the optimizer always runs; the Swift and JS three-way merge `autoBreaks ⊕ breaks`, and the Swift `applyBalancedCues` mirror is removed; contract fixture `cueDerivations[]` gets two new cases; `ccut upgrade` migrates the old `breaks` into `autoBreaks.default` when `stages.asrLayout` is unchanged; `patchTranscript` supports `autoBreaks` / `layoutProfile`. Known deviation: widths above `maxChars` are treated as forbidden in the DP, so lines that the greedy approach would extend by one word to catch punctuation get re-split.
- 2026-08-16 M2 (same commit): `align_block.rs` (`AlignEdge` / `AnchorAligner` / `safe_boundaries` / `minimal_monotonic_blocks` / `bilingual_dp` / `plan_sentence`); `split.rs`'s `basis_text`, I3/I4 block validation, explicit `sentence` correspondence derives a single cue, and `display-stale` cleanup. Implementation deviations: the safe-boundary check adds a rule that edges must not span a cut point; block confidence takes the minimum of the boundary and in-block edge weights; `plan_sentence` checks τ_s first, then the hard-limit overflow.
- 2026-08-16 M5 metrics (commit `a0bf2b9`): `metrics.rs` SubER (cross-checked against the AppTek reference implementation on 102 cases; char-by-char splitting for ja/ko is a known deviation) and `align_metrics`. Golden set and `ModelAligner` evaluation pending.
- 2026-08-16 M3 LLM contract: new default alignment carrier `filepipe/align_edges.rs` (the `align-edges/1` render / parse / de-parse trio with round-trip and property tests; the model only tags `<span data-src>` semantic blocks with source word ordinals, using the new closed-set codes `align-edge-ordinal` / `align-edge-text`) and the narrow task `align-rewrite/1` (same-shape table + `data-over-hard`; rewrite and span delivered in one pass; ±max(25%,4) and hard-anchor retention validated in the same parser). The translate fusion protocol changed to `data-align-words="[1]…"` + `data-align-needed` plus span block tags inside `<p>` (`FusionDraft { chunks }`). `engines/align.rs::run_align_with_projection` routes by `AlignOptions.carrier` (`AlignCarrier::Edges` by default, `Table` for review): fused draft → dedicated `align-edges` (first round `b…` plus one global repair round `r…`) → `align-rewrite` round (`w…`, by writing `transDisplay{basis:"monotonic-rewrite"}` with `text_basis: display`; otherwise whole-sentence correspondence) → pure `AnchorAligner` block alignment → deterministic fallback. `purge_stale_display` runs first, and `align_entry_valid_for_lang` judges existing entries. The table carrier's `data-crossing` now writes `correspondence: sentence` (one block per whole sentence, no longer writes `crossing`; since 2026-09-24 it keeps worker rows on a best-effort basis, see the §4.5 revision), and `data-reordered` rewrites now write `transDisplay{basis:"table-reorder"}` instead of overwriting `trans`. `AlignOutcome` adds `rewritten_sentences` / `sentence_level_sentences`. The CLI registers kinds `align-edges` / `align-rewrite` (HTML carrier, `<tbody data-sid>` counting, high effort); `task submit` routes by kind to `lint_agent_answer_edges` / `lint_agent_answer_rewrite`; the `align` stage's `writes` in `ccut spec` adds `transcript.transDisplay` and `carriers`; `translate` / `refine-align` add `--align-carrier edges|table`; `ccut check`'s `align-bilingual-anchor-crossing` now reads `correspondence() == sentence`. Also synced: `agent-tasks.md`, ai-pipeline §8.6 / §9.2, file-contract §8.5, agent-workflow §4.1, and the CLI reference.
- 2026-08-16 M4 (commit `4913746` + this commit): data.json / JSON export carries `correspondence` / `textBasis` / `displayText` / `aligner` / `blocks` (`crossing` is derived and deprecated); studio, mac and designs sync the “整句对应” (“whole-sentence correspondence”) and “已为字幕改写” (“rewritten for subtitles”) chips, block ticks, and split snapping to block boundaries; apply and patch maintain the block layer and `transDisplay`; the gpui projection gets the fields (no bilingual panel, so the UI does not apply; `apps/windows` has no translation feature, so it does not apply). `ccut check` outputs `alignMetrics[lang]` plus `align-sentence-level` / `align-weak-block` / `align-display-rewrite`, and retires `align-bilingual-anchor-crossing`; `--layout-profile` (`default` / `two-line`, with `cue_params_for_doc` unifying each consumer point); `line_break_plan` ports `sourceDisplayLines` and cross-checks the three ends against `lineBreaks[]` fixtures; the `two-line` profile budgets `max_lines×maxChars` in the DP, plus an inter-line imbalance penalty; `verify.sh` optionally runs the full SubER cross-check with `CCUT_VERIFY_METRICS=1`.

## 13. M5 Evaluation Conclusions: Golden Set and `ModelAligner`

### 13.1 Golden Set and SubER Baseline

- Landed: SubER (word-level and char-level) and `align_metrics` in `metrics.rs`, with the reference fixture `core/fixtures/align/suber-cases.json` (102 cases, matching AppTek `subtitle-edit-rate` 0.4.0 case by case; char-by-char splitting for ja/ko is a known deviation).
- Not landed (needs real LLM runs and human confirmation; `ccut` cannot be compiled on this machine and there is no provider): take one passage from each of the three projects under `examples/`, run the `edges` carrier, have a human confirm the bilingual subtitles, then freeze them as `core/fixtures/align/golden/<project>/<lang>.json` (subtitle blocks + `alignMetrics` expected values). Acceptance criteria are unchanged: compared with `--align-carrier table`, SubER must not regress; `sentence-degrade` + `rewrite-rate` must be lower than the old sum of `crossing` + `reordered`; `bilingual-anchor` mismatches must be 0. When the golden set is first generated, also record the first-round pass rate of `align-edges` and the repair-round trigger rate, as the basis for reviewing D2.

### 13.2 Feasibility of `ModelAligner` (SimAlign-style Local Word Alignment)

Conclusion: **the interface is kept (`WordAligner` trait), not implemented this round, and not enabled by default.** Basis:

> Later (2026-08-18): this slot was later implemented as one version by a local text-model approach (embedding coarse scoring + cross-encoder fine scoring), then removed entirely because of quality and maintenance cost — see [`archive/ccut-semantic-reranker-alignment-design.md`](../../archive/subtitle/ccut-semantic-reranker-alignment-design.md) (**archived**).
> Current status: **no local aligner**; alignment evidence comes only from `AnchorAligner` and `LlmChunkAligner`.

| Dimension | Assessment |
| --- | --- |
| Model and size | SimAlign needs a multilingual contextual encoder: mBERT ~700 MB, XLM-R base ~1.1 GB, LaBSE ~1.8 GB (fp32), multilingual-MiniLM-L12 ~470 MB. The CucCut model directory currently holds only the ASR, speaker and VAD families, with no text encoder; it would need a new model family, a tokenizer and a BERT forward pass (one each for MLX and Candle) |
| Inference cost | Milliseconds per sentence, negligible; the main costs are the first download and resident memory |
| Quality | SimAlign (mBERT argmax/itermax) reaches an en-zh word-alignment AER of about 0.2–0.3, weaker than en-de and en-fr; awesome-align is better after fine-tuning but needs fine-tuned artifacts from parallel corpora. For the block layer it only needs "no crossing edges at the boundary"; word-level noise has limited impact after the τ filter, but recall on abridged or free translation is lower than with LLM block-level alignment |
| Relationship to the current default path | The default path already fuses alignment edges into the translate call (zero extra calls). The value of `ModelAligner` lies in: ① offline re-alignment without a provider (recomputing blocks immediately after the user edits a translation); ② serving as a second source that cross-checks agreement with LLM edges and reduces the share of `weak` blocks. Both are optimizations and do not block delivery |
| Trigger | Start this work when the golden set shows `align-weak-block` or `sentence-degrade` clearly high, or when user-side offline re-alignment is clearly needed; then evaluate multilingual-MiniLM first (smallest size) with a Candle implementation, with MLX reusing the same weights |
