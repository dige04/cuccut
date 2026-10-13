# Alignment golden set (`ccut-align-golden/1`)

Human-annotated reference labels for bilingual alignment. Bead P/R/F1, Boundary F1, Path EM and the sentence-level downgrade rate are all judged against it.

Terminology matches upstream: Sentence / Alignment Block / AlignEdge / `plan_sentence` are defined in the [alignment block design](../../../../docs/design/subtitle/ccut-alignment-block-subtitle-split-design.md) §4, §8–§10.

## Directory and naming

```text
core/fixtures/align/golden/<project>/<lang>.json
```

- `<project>` = the directory name of `examples/<project>.ccut` with the `.ccut` suffix removed; also the `project` value in the JSON.
- `<lang>` = the BCP-47 primary language subtag of the target language; also the `lang` value in the JSON. The source language is not written into the file; it is taken from the `lang` in `examples/<project>.ccut/transcript.json`.

Current contents:

| File | Language pair | Cases | Notes |
| --- | --- | --- | --- |
| `p130-what-is-an-agentic-harness/zh.json` | en→zh | 36 | Dialogue narration, dense with terminology (harness / LLM / agent) |
| `p130-what-is-an-agentic-harness/ja.json` | en→ja | 31 | Japanese annotation of the same source text; verb-final word order causes many large crossing blocks |
| `p839-building-with-chatgpt-voice-openai/zh.json` | en→zh | 29 | Demo narration, many short sentences and fragments, proper nouns (Codex / Voice / Chat) |
| `p128-…-生成高级感分镜/en.json` | zh→en | 30 | Chinese source (word atoms are single characters), dense with numbers and ordinals (`生成高级感分镜` is a directory name, meaning "generate premium-feel storyboard") |

## File format

```jsonc
{
  "schema": "ccut-align-golden/1",
  "project": "p130-what-is-an-agentic-harness",
  "lang": "zh",
  "cases": [
    {
      "id": "p130-zh-012",
      "sentenceId": "s-g12.0",
      "sourceWords": ["I", "didn't", "go", "because", "I", "was", "sick"],
      "target": "因为我病了，所以没去",
      "tags": ["N:M", "causal-inversion"],
      "beads": [{ "src": [0, 7], "tgt": [0, 10] }],
      "hardAnchors": [{ "src": 3, "tgt": [0, 2] }],
      "expected": { "correspondence": "block", "minBlocks": 1 }
    }
  ]
}
```

### Field semantics

| Field | Meaning |
| --- | --- |
| `schema` | Always `ccut-align-golden/1`. The field name is frozen; the value may be extended. Changing the structure requires bumping the schema as well. |
| `project` / `lang` | See above. Must match the directory / file name. |
| `cases[].id` | Globally unique, `<project short id>-<lang>-<three-digit sequence number>`. Referenced by `hardNegativeOf`; **do not renumber**. |
| `cases[].sentenceId` | The sentence id that `derive_sentences` actually derives from this transcript (`s-<first word id>`). Source Cues and `breaks` do not take part; changing line breaks does not change it. |
| `cases[].sourceWords` | Text of the visible words in the sentence; the order is the index base for `beads[].src`. Must equal the words of the derived Sentence one by one (guarded by a test). |
| `cases[].target` | Human-confirmed full-sentence translation in the target language. `beads[].tgt` are `chars()` indices into it, not bytes. |
| `cases[].tags` | Phenomenon tags; values are listed in the table below. |
| `cases[].beads` | Human-annotated minimal monotonic alignment block partition. |
| `cases[].beads[].src` | Source word index, **half-open interval** `[start, end)`. |
| `cases[].beads[].tgt` | Target `chars()` index, **half-open interval** `[start, end)`. |
| `cases[].hardAnchors` | `(source word index, target character interval)` pairs that any aligner must judge as hard anchors: numbers, dates, verbatim Latin, proper nouns, locked terms. The interval must fall within the target interval of the bead that owns the same source word. |
| `cases[].expected.correspondence` | Expected correspondence granularity: `block` allows block-level mapping; `sentence` allows only whole-sentence correspondence. |
| `cases[].expected.minBlocks` | Minimum number of blocks a human expects to reach, `1 ≤ minBlocks ≤ beads.length` (currently always equal to `beads.length`). |
| `cases[].expected.hardNegativeOf` | Optional. The `id` of another case in the same file whose topic is highly similar; the model must be able to tell the two apart. |

### Hard constraints on beads

`beads` is a **partition** of the two sides, not an arbitrary bipartite graph:

1. **Contiguous**: the first bead starts at `src[0] = 0` and `tgt[0] = 0`; each bead's start equals the previous bead's end.
2. **Full coverage**: the last bead has `src[1] == sourceWords.length` and `tgt[1] == target.chars().count()`.
3. **Monotonic**: both sides increase in the same order (implied by 1 + 2).
4. **Non-empty**: each bead has a non-empty interval on both sides; `0:1` / `1:0` are forbidden. Omitted source words (articles, filler words, repetitions) are merged into an adjacent bead; sentence-initial ones merge into the following bead. Added target fragments are handled the same way.
5. **Crossings are merged**: a region where the word order of the source and target sides crosses must fall into **one single** bead. `I didn't go / because I was sick` ↔ `因为我病了，所以没去` (because I was sick, so I didn't go) is one bead for the whole sentence. `the plan we discussed yesterday` ↔ `我们昨天讨论的计划` (the plan we discussed yesterday) merges only that noun phrase into one bead; the rest of the sentence can still be split.

This is consistent with the `minimal_monotonic_blocks` output contract of `ccut-flow-core`, so golden and predicted output can be compared bead by bead.
The validation code is in [`core/crates/ccut-flow-core/src/golden.rs`](../../../crates/ccut-flow-core/src/golden.rs).

## Tag values

It covers 12 categories of phenomena in total; `omission` / `addition` are the two directions of "omitted translation / added translation", so there are 13 tag values in total.
A case may carry several tags; **each tag must appear in at least 5 cases across the whole golden set** (asserted by a test).

| Tag | Meaning |
| --- | --- |
| `1:1` | A direct correspondence exists between one source word and a single target fragment (the bead's source interval has length 1). |
| `1:N` | A source-language unit expands into several display units in the translation (one source word corresponds to a much longer target fragment). |
| `N:1` | Several source words merge into a single target unit (including function words, copulas and auxiliaries that are absorbed). |
| `N:M` | Many-to-many blocks: multiple source words and multiple target units are intertwined and cannot be subdivided further. |
| `causal-inversion` | Cause or condition clauses appear in different positions in the two languages (`because` / `since` / `if` ↔ `因为…所以` (because…so) / `如果…就` (if…then)). |
| `attributive-reorder` | Attributives, relative clauses, `of` phrases and time/place adverbials swap position relative to their head word. |
| `negation` | The scope or position of negation (`not` / `never` / `no` / `不` / `没`) differs between the two languages. |
| `number` | Contains numbers, percentages, resolutions, dates or ordinals that must be matched one by one. |
| `proper-noun` | Contains person, organization or product proper nouns (`Simon Williamson`, `Codex`, `Hyper Frames`). |
| `term` | Contains technical terms (locked-term candidates: `harness` / `LLM` / `feature flag` / `pull request`). |
| `omission` | A source-side word has no corresponding translation and is merged into an adjacent bead. |
| `addition` | The translation adds explicit material absent from the source (connectives, subjects, quantifiers, punctuation). |
| `hard-negative` | Topic highly similar to the case named in `expected.hardNegativeOf`; must be distinguishable. |

Current distribution (printed by `cargo test -p ccut-flow-core --test golden_align -- --nocapture`):

```text
1:1 36 / 1:N 9 / N:1 31 / N:M 79 / causal-inversion 9 / attributive-reorder 59
negation 17 / number 14 / proper-noun 26 / term 65 / omission 18 / addition 8 / hard-negative 11
```

## Source and confirmation record

| Item | Content |
| --- | --- |
| Source text | `words[]` of `examples/<project>.ccut/transcript.json` (unchanged; golden does not write back to examples) |
| Translation | **Written by an agent, pending human confirmation**. `p130/zh` and `p839/zh` reference the existing `trans.zh` of the same project, but were rewritten and expanded to cover the annotated phenomena; `p130/ja` and `p128/en` have no counterpart in the examples' translations and were written entirely by the agent |
| beads / hardAnchors / tags / expected | **Annotated by an agent, pending human confirmation** |
| Annotation date | 2026-08-16 |
| Human confirmer | To be filled in (after confirmation, change this row to name + date, and record this round's revision below) |

> Until human confirmation is complete, numbers derived from this golden set may only be used as **trend cross-checks**.

## Consumers

- [`core/crates/ccut-flow-core/src/golden.rs`](../../../crates/ccut-flow-core/src/golden.rs): serde structures and pure validation (`GoldenFile::from_str`, no I/O).
- [`core/crates/ccut-flow-core/src/metrics.rs`](../../../crates/ccut-flow-core/src/metrics.rs): `bead_prf` (`Strict` / `Lax`), `boundary_f1`, `path_exact_match`, `beads_boundaries`, `beads_contiguous`.
  - `Strict`: a predicted bead counts as a hit only when its intervals on both sides are **exactly equal** to those of the golden bead.
  - `Lax`: a hit is counted when both sides have a non-empty intersection (still scores when the segmentation granularity differs but the correspondence is correct).
  - Precision uses predictions as the denominator and recall uses golden as the denominator; each is judged independently (following the convention of Vecalign / Bertalign).
- [`core/crates/ccut-flow-core/tests/golden_align.rs`](../../../crates/ccut-flow-core/tests/golden_align.rs): the only side that does file I/O; loads all golden files, validates the constraints, and prints the `AnchorAligner` baseline.

```bash
cd core
cargo test -p ccut-flow-core --test golden_align -- --nocapture
```

Baseline numbers have **no threshold** (only the deterministic hard anchors of `AnchorAligner` are used, no LLM). Their purpose is to give later alignment paths a lower bound that can be compared item by item. Snapshot of 2026-08-16:

```text
Language pair   Cases  strictP  strictR strictF1     laxP     laxR    laxF1 bndSrcF1 bndTgtF1   pathEM  Sentence-level rate
p128 zh→en      30     0.035    0.069    0.045    0.795    0.853    0.812    0.324    0.388    0.000    0.467
p130 en→ja      31     0.000    0.000    0.000    0.734    0.882    0.781    0.205    0.030    0.000    0.806
p130 en→zh      36     0.010    0.013    0.012    0.656    0.769    0.688    0.331    0.118    0.000    0.750
p839 en→zh      29     0.297    0.303    0.299    0.805    0.810    0.802    0.572    0.502    0.241    0.862
Total           126    0.080    0.090    0.083    0.743    0.826    0.766    0.354    0.249    0.056    0.722

Decision tree: block-level 27 / needs rewriting 8 / whole-sentence 91 (of 126)
Hard anchor hits: 56/65
```

Reading: relying only on deterministic anchors, 72% of sentences lack enough evidence and fall back directly to whole-sentence correspondence, and strict Path EM is only 5.6%. Without semantic evidence, blocks cannot be split out. Lax F1 is clearly higher than strict F1, which shows that the few block directions found by Anchor are correct but the granularity is too coarse. The gap in `硬锚命中 56/65` (hard anchor hits 56/65) comes from proper nouns rewritten in the translation (`Claude code` → `Claude Code`, `anti-gravity` → `Antigravity`) and from numbers whose spelling differs. This is a known boundary of `AnchorAligner`, not an error in the golden annotation.

## How to add cases

1. Select a sentence from `examples/<project>.ccut/transcript.json`; the sentence id must be the one currently derived by `derive_sentences` (the simplest way is to write a temporary test that calls `derive_sentences` and prints `id` + word text, and delete it once labeling is done).
2. Write `sourceWords`: copy the word text of the sentence directly; the order must not change. The test compares them one by one and fails on any mismatch.
3. Write `target`: a natural full-sentence translation in the target language. First decide the translation for naturalness in the target language, **then** map the source word intervals. Do not distort the translation to make alignment easier, and do not let the original subtitle Cues or `breaks` take part in segmentation decisions (upstream discipline, see §4.1 of the alignment block design).
4. Split beads: cut at legal seams in the translation (punctuation, whitespace, CJK character boundaries); the source word intervals on either side of a cut point must not cross. If they cross, merge back into one bead. Accumulate bead by bead to confirm that both sides are contiguous, fully covered and non-empty.
5. Mark `hardAnchors`: numbers, verbatim Latin, proper nouns, locked terms. The target interval must fall within the bead that owns that source word.
6. Tag `tags`: per the table above, at least one tag; if unsure, tag less rather than forcing tags to fill a quota.
7. Fill `expected`: `correspondence` is usually `block`; write `sentence` only when block-level correspondence truly is not possible (the whole sentence is a single bead with low confidence). Set `minBlocks` to `beads.length`.
8. `id`: continue from this file's maximum sequence number; do not renumber existing ids (`hardNegativeOf` references them).
9. Run the tests:

   ```bash
   cd core
   cargo fmt --all -- --check
   cargo test -p ccut-flow-core --test golden_align -- --nocapture
   ```

10. Update the case counts and confirmation status in the "Directory and naming" table and in the "Source and confirmation record" section above.
