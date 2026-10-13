> Ported from CucCut v2. The data model names in this text (TranscriptDoc, etc.) refer to the v2 models; for their mapping to the v3 document models, see [Architecture design §14](../../architecture/architecture-design.md#14-items-pending-review).

# Streamlined LLM Exchange Format for the Subtitle AI Pipeline (Line-Text Carrier + First/Last Anchor Words)

> Status: **M0 foundation implemented; M1 second round (chunked prompts + joint localization + line-attribution gate + re-ask completion round) reaches 491 / 0 / 17 (aligned / whole-sentence / rewritten) on the same 508 sentences, versus 378 / 97 / 33 for the old carrier; the combined cost of the two rounds, converted at list price, is about 0.4×. The M2 direct-provider path is wired into production `ccut translate --align-fusion lines` as opt-in (the default is still `rows`; the Agent path is not wired yet; the partial-commit / state machine of §5 is not implemented)** (2026-09-30, §8.2–§8.3). Per-call provider raw response/usage ledger, first/last compression, the experimental `lines/1` codec, and the shared translation acceptance adapter have landed. A 4-project, 10-page, 508-sentence comparison with the DeepSeek V4.1 Flash model found cross-sentence content misalignment and planning degradation; see §8.1. Partial commit, session recovery, LCS frozen-cut recovery and M2–M4 are not yet wired in. When frozen echoes in the experiment are not exactly identical, the original text is kept and the cut is revoked. The old start-replay of §7 is not used as acceptance for the first/last anchor-word format.
> Scope: translation and the LLM exchange formats for translation alignment (`align-edges/1`, `align-rewrite/1`, `align-table/1`), session shape and fault tolerance. Pre-translation polishing is not merged into the page session (§6.6); its patch-style output is in §10.1. The speaker page comes last.
> Unchanged: the `words[]` / `trans` / `transDisplay` / `transAlign` data model; the discipline of “fix the translation first, then map contiguous source-word spans” ([transcript-v03 §5.2](ccut-transcript-v03-design.md)); alignment blocks and the line-splitting DP ([alignment-block](ccut-alignment-block-subtitle-split-design.md)); the three-level Problem and the bounded-retry principle ([ai-pipeline §10.2](ccut-ai-pipeline-design/10.md)). The resubmission count and terminal states for the new task carrier are defined in §5; old tasks are not retroactively changed.
> The interview examples in this document are taken from an English → Simplified Chinese project; a short English → Spanish sentence set is used as a cross-check. Both are illustrative. The rules are written in terms of `words[]` atoms and display units, and do not presuppose the output language.

## 1. Problem and measurements

Sample: the local project “AMD Acquires Fei-Fei Li's World Labs” (English source, 3,819 words, 220 sentences, translated into Simplified Chinese, local Agent path). `logs/llm/*.jsonl` records the full system / user / response of every call; the table below gives exact character totals.

| Stage | Calls | system | user | response |
| --- | ---: | ---: | ---: | ---: |
| translate | 5 | 59,755 | 92,158 | 23,766 |
| Alignment, three page types combined | 10 | 83,036 | 41,183 | 49,841 |
| polish | 3 | 28,161 | 23,104 | 22,746 |
| Others (analysis / chapters / brief / speaker) | 5 | 19,486 | 58,954 | 4,845 |
| Total | 23 | 190,438 | 215,399 | 101,198 |

Translation plus alignment accounts for 75% of system, 62% of user, and 73% of response. Waste occurs in five places:

1. **The source text is sent twice, and the second copy carries per-word numbering.** Each sentence on a translation page has its body text, plus `data-align-words="[1]I [2]can …"`, plus the time groups in `data-align-groups`. Of the 92,158 characters across the five pages, only 20,921 are body text; `data-align-words` takes 36,759 and `data-align-groups` takes 12,523.
2. **Output echoes the whole page.** Alignment pages ask for “return the SAME table”. The `w001` output is 12,780 characters, of which the content the model actually decides (cut points and translations) is about 1,600 characters; the rest is copied source text, serial numbers and HTML skeleton.
3. **Prompts are bigger than the content.** The `align-table/1` system prompt is about 13.4 KB; three targeted repair rounds plus retries make 5 calls in total, processing only 19 sentences. The translation system prompt is about 12 KB, and the same proper nouns appear there three times (source-language terms, glossary, proper-noun list). The Cloud path resends the whole system prompt on every call, with no explicit cache breakpoint and no complete usage ledger (`ccut-engine/src/llm_exec.rs`). This does not prove the provider has no implicit cache hits; actual cost awaits the observation in §6.5.
4. **Four carriers, four prompt sets and four parsers.** `translation-source/1`, `align-edges/1`, `align-rewrite/1` and `align-table/1` each have their own format rules, and the model and worker must learn each one anew.
5. **One bad sentence penalises the whole page.** On the Agent path, the whole document is linted at submission, and any single problem sends the whole document back; the page then has to be rewritten in full. The current `LINT_MAX_TRIES = 3`, but not every kind is released on the third attempt: after `translate` / `align-edges` are exhausted they are still rejected by `hardGate`; alignment kinds with the same problem have a `noProgress` branch; some other kinds keep force-through (`ccut-kernel/src/cmd/task.rs`). In this project, `w001` of `align/zh-Hans/v001` (22 sentences) is recorded as `failed` for the whole page. The Cloud path writes sentence by sentence, but page artifacts are likewise recorded as `Failed`.

Another fact: 44 of the 220 sentences (20%) had translation word order crossing the source, and the merged block exceeded hard, so they went to the `align-rewrite` second-pass rewrite page. This step is required by discipline (first obtain a natural translation; if it does not fit, rewrite in source order) and should not be dropped, but it is currently expensive.

## 2. Solution overview

Five changes; the first two are the core:

| Change | Now | Becomes |
| --- | --- | --- |
| Addressing | Each source word is prefixed with a number; output writes the set of source words | **First/last anchor words**: reference the leftmost and rightmost endpoints of the source words each block corresponds to; code locates them and combines deterministic anchors to judge crossings; no end point is inferred from the next start point |
| Carrier | HTML document / table; output echoes the whole page | **Line text**: one sentence per line, page-local short serial numbers; output writes only what the model decides |
| Page type | Four formats: translation, edges, rewrite, table | **One syntax**, with per-sentence permissions: new translation, frozen, or rewritable in source order |
| Fault tolerance | Agent lints the whole page and returns the whole page | Translations and alignments are accepted separately; uncertain mappings do not create safe cut points; problem sentences are closed out by failure type after bounded re-issue |
| Session | Every call is an independent system + user | One session per page is candidate A; choose it against cold queue C by actual cost, quality and latency (§6.5) |

The code continues to reuse `AlignEdge`, `AnchorAligner`, `safe_boundaries` → minimal monotone block → `plan_sentence` / `bilingual_dp` (`ccut-flow-core/src/align_block.rs`). What is new is reference-based localization, a conservative gate for insufficient evidence, and a submission state machine. The model only gives semantic blocks and their corresponding endpoints; crossing judgement, merging, line splitting and time allocation are done by code.

## 3. Line-text carrier `lines/1`

### 3.1 Input

```
@S2
7 Well, first, Ed, thanks for having us.
8 And today is a super exciting day.
9 I can tell you that ⏸ we are super excited to be acquiring World Labs.
! ≤37

@S1
15 I think we should get to the backstory with both of you, but would you talk a little bit, Lisa, how it came about, the catalyst for doing the actual transaction?
```

- One sentence per line: `<in-page serial number> <source text>`. Serial numbers run continuously from 1 to N; their correspondence to sentence IDs such as `s-g6.14` is recorded in the page manifest and is not part of the payload. The rationale for short serial numbers is the existing index-contract pages (paragraph fill, page-seam repair, speaker repair): after the paragraph-fill page was changed to return only line-number ranges, none of 47 calls had an illegal range and none altered text ([file-contract §6](ccut-file-contract-subtitle-ai-design/06.md)).
- Blank lines separate paragraphs; `@S2` is the speaker. Both are shown to the model only and are not echoed in output.
- `⏸` keeps the pause hint from the polish page; it appears only where the pause is long enough. Same-named characters in the body are escaped as in §3.2, and parsing keeps the two distinct. The time groups `data-align-groups` are removed entirely; reasons in §6.2.
- Lines beginning with `#` are read-only context lines (sentences from adjacent pages); they have no serial number and are not answered.
- Lines beginning with `!` are hint lines and appear only when a constraint actually applies: a tight reading-speed budget (`! ≤37`, where the unit is display units), locked translated names that must appear verbatim, and the rejection reason from the previous round in repair rounds. Sentences with no constraints have no such line.

For alignment and rewrite pages, each source line is followed by a line carrying the existing translation; the first character of that line is its permission:

```
4 So World Labs is a frontier model company specializing in spatial and physical intelligence.
~ World Labs 是一家专攻空间智能和物理智能的前沿模型公司。
! 整句 26 单位，只有一块，超过 20

5 Now, this is a next phase for World Labs as part of AMD.
= 如今加入 AMD，World Labs 进入了新阶段。
```

| Leading char | Permission | Corresponds to today's |
| --- | --- | --- |
| No translation line | New translation: model writes the translation and marks cut points | Translation page (rows fusion) |
| `=` | Frozen: the translation is not changed at all; only cut points are marked | `align-edges/1`, `data-no-rewrite`, `data-target-frozen` |
| `~` | Rewritable: sentence splitting may be adjusted to source order; nothing else changes | `align-rewrite/1`, `data-reordered` |

Sentences of all three kinds can be mixed on one page, so the repair queue (§5) needs only one page type. Permissions are determined by the page manifest; a `~` in the model's output does not grant rewrite permission. Each `=` / `~` sentence explicitly records its current text baseline and fingerprint (`trans`, or the accepted `transDisplay.text`). The magnitude of a new rewrite is still checked against the natural translation, so drift cannot accumulate over rounds.

### 3.2 Output

Output of a translation page:

```
7 首先，Ed Ludlow，谢谢邀请我们。
8 今天真是令人兴奋的一天。
9 |I can..tell you|我可以告诉你，|that we..super excited|我们非常兴奋|to be..World Labs|能收购 World Labs。
```

Output of the alignment and rewrite page above:

```
4~ |So World..model company|World Labs 是一家前沿模型公司，|specializing in..physical intelligence|专攻空间智能和物理智能。
5 |Now..Now|如今|as part..AMD|加入 AMD，|for World..World Labs|World Labs |this is..next phase|进入了新阶段。
```

- One sentence per line: `<serial number> <translation>`. A sentence that has been rewritten carries `~` after its serial number. Source text, paragraphs, speakers and hint lines are not echoed.
- `|left-ref..right-ref|` is written before a translation block. The left reference starts at the **leftmost source word** the block corresponds to, and the right reference ends at the **rightmost source word**. A reference may be extended inward into the span to disambiguate. Within a block, source-word attribution may be discontinuous; the endpoints only express how far it reaches.
- `|full source phrase|` is an equivalent shorthand: the code uniquely matches this complete atom sequence, taking the phrase's own first and last atoms as the two endpoints. It does not mean “only a start point”, and the end must not be borrowed from the next block or filled from the sentence end. A repeated phrase is still ambiguous; discontinuous attribution still uses the first/last dual reference. This form comes from real trials with DeepSeek V4.1 Flash: the model often outputs the full phrase, and the code can deterministically recover its span, so there is no need to have the model write the same phrase twice or call again.
- Every block of a segmented sentence is marked, including the first block; the first block is no longer implicitly bound to source word 1. A single source word may be written `|light..light|`. A functional block with explicitly no independent source-word attribution is written `|∅|`; an undeterminable attribution is written `|?|`, and the two are not the same thing. A substantive content block may not bypass reference localization with `∅`.
- A short sentence that needs no splitting may be given just its whole-sentence translation; code treats it as a whole-sentence match. A sentence that needs splitting omits the markers; it is treated as lacking mapping evidence and goes to the planning triage of §4.2.

**Fixed symbols and escaping.** New translations are not known in advance, so a delimiter cannot be chosen after scanning the input to avoid collisions. `lines/1` always uses `|` and `..` inside markers: a literal `|` in body text and references is written `\|`, and a backslash is written `\\`. Inside a reference, two literal consecutive dots must be written `\.\.` so they are not confused with the endpoint separator. The encoder writes every literal `.` inside a reference as `\.`; the parser also accepts a single dot that does not form `..` (such as `3.14`). A literal `∅` / `?` inside a reference is written `\∅` / `\?`, to be distinguished from the whole markers `|∅|` / `|?|`. The body text does not interpret `..`. A literal pause symbol is written `\⏸`; the real pause hint is inserted by the renderer as metadata.

Text fields write LF / CR / TAB as `\n` / `\r` / `\t`; only a physical line break ends a record. Syntax prefixes are recognized only at the start of a physical line; `#`, `!`, `=`, `~`, `@` inside body text are not separate directives. Parsing first recognizes escapes and markers, and only then decodes the body; it must not unescape first and then split on `|`. Unknown escapes, unclosed markers, empty endpoints in a dual reference, extra endpoint separators, or a marker with no body text following it are all single-sentence syntax errors. A marker without a separator is handled as a complete phrase, then checked for unique localization. Code must not guess and strip body text from a suspected marker. Source text, frozen translations and new translations all go through the same codec.

The outer JSON is still escaped by the JSON serializer; the CLI passes body text through files and does not concatenate it into shell commands. Line text only removes the HTML skeleton; it does not cancel the outer encoding requirement.

### 3.3 How anchor words are resolved

#### 3.3.1 Keep the first and last positions; the code judges crossings

Storing only start points cannot be treated as equivalent to replacing the ownership of old blocks. For example, if translated block A corresponds to source words `{1,3}` and B to `{2}`, the original edges cross. Deriving A=`{1}` and B=`{2,3}` from starts 1 and 2 would create a false safe cut point.

For a non-empty source word set `S_i`, storing `lo_i = min(S_i)` and `hi_i = max(S_i)` is enough to preserve the inter-block criterion. At target block boundary `k`, the safe condition is `max(hi_left) < min(lo_right)`. First-to-last ranges may overlap; they must not be treated as a partition in which each block exclusively owns its source words. An empty set is kept as empty; an unknown set with no evidence is marked separately.

For example, `Turn the light off.` → `|Turn..off|Apaga |the light..the light|la luz.`: the code gets `[1,4]` and `[2,3]` and synthesizes one block from them. Do not expand `[1,4]` into "every source word in the middle belongs to Apaga". Source word coverage and non-overlap are invariants of the final `blocks/pieces`, not requirements on the input endpoint ranges.

This equivalence applies only to boundary decisions for the same target block with the same effective edge weights. It does not recover full word-level ownership, and it does not prove that the model's endpoints are semantically correct. Coverage and other diagnostics must not count the interior of a range as an observed correspondence. During review, 43,688 boundary cases were enumerated with consistent results. M0 must turn the property verification and the non-contiguous ownership counterexamples into shared regression tests, and must not use this offline enumeration in place of golden acceptance.

#### 3.3.2 Locate, supplement evidence, and degrade

1. Decode per §3.2 to get the target block and its character interval. Concatenate the body to get the natural translation or the display-rewrite candidate. Target coordinates use Rust character indices, with a mapping kept back to the original string; do not write back using offsets from normalized text directly.
2. Source words use the same basis as the `TransAlign.words` snapshot in the page manifest. First try exact matching. Then allow NFKC, case folding, quote-form normalization, and tolerance for outer-edge sentence punctuation on atoms (for example, a quoted `off` matches `off.`); every normalized character keeps its atom position. Only recognizable outer-edge sentence punctuation may be dropped; characters that carry meaning in numbers, URLs, or identifiers must not be stripped. Whitespace serves only as a separator between atoms; punctuation inside the body is not uniformly deleted. Pause markers are excluded as metadata, while literal characters are kept. If extra normalization still leaves multiple candidates, they are still treated as ambiguous.
3. A left quote must match from the start of an atom; a right quote must end at the end of an atom. Both quotes are located on the full atom sequence and never use half an atom as an endpoint. Apply the constraints `lo ≤ hi` to candidate combinations, with both quotes inside that range. Accept only when exactly one combination remains. Multiple combinations give `anchor-ambiguous`; none gives `anchor-unresolved`. Do not pick "the first occurrence after" based on the position of the previous target block, and do not automatically accept approximate matches with spelling edit distance. An endpoint that context cannot uniquely identify enters targeted repair, and may fall back to the old ordinal carrier.
4. Each located non-empty block generates two soft `AlignEdge`s, `lo` and `hi`, over the same target interval. Identical endpoints generate only one edge, reusing `CHUNK_EDGE_WEIGHT`. Different blocks with the same start or overlapping ranges are not `anchor-duplicate`; they may be exactly the evidence needed to merge. Only fully identical edges are deduplicated.
5. The code runs the existing `AnchorAligner`, adding hard edges for unique matches of numbers, URLs, verbatim proper nouns, and bilingual terms, and keeps their real target character intervals. When a hard edge lies outside the endpoint range, keep the evidence, record the conflict, and re-plan; do not clip the hard edge into the model's range. This forbids some cut points and merges blocks where necessary. String rules may only supplement known anchors; the absence of detected crossings must not be used to infer that every cross-language relation is complete.
6. Complete and reliably located edges go to `safe_boundaries`, the minimal monotone blocks, and DP. `∅` is an explicit empty ownership and generates no edge. A cut point with no source-word evidence on either side must not create a display time window by itself. `?`, missing block markers, locating failures, or unresolved conflicts are insufficient evidence. In the first version, such a sentence may not add a new semantic cut point: keep the accepted translation, request re-annotation, and once that is exhausted, fall back to a whole-sentence or deterministic fallback clearly marked as degraded. Do not simply delete the edges and hand the result to the existing "no edge means safe" criterion. If the outer bounding range of an unknown segment can be proven later, local merging may be verified separately. This version does not assume that merging only with the previous block is safe.

Reference length is not fixed for any language. Whether the atoms are character-level or word-level, judge by unique location. The model does not need to sort, compute ordinals, or handle crossings; the code is responsible for locating, supplementing evidence, and adjudicating.

### 3.4 Two interpretations

One syntax has two usages, declared at the top of the page:

- **Block (default)**: markers are evidence of semantic cut points; the finer the better, and the final number of lines is decided by the code's DP. Corresponds to the current `align-edges/1`.
- **Line**: markers are the boundaries of expected display lines. They must still pass the §3.3 crossing check, reading-speed merging, and seam lint. When there is a crossing or insufficient evidence, the line boundary must not be forcibly kept; the receipt explains the reason for merging or re-annotation. Corresponds to the current `align-table/1`, used in targeted repair when the reviewer passes `--instructions`.

## 4. Validation

### 4.1 Structural checks and per-cut-point verification of frozen text

The model no longer outputs source word ordinals, so the new carrier cannot produce out-of-range ordinals written by the model. Reference resolution must still check that endpoints exist, `lo ≤ hi`, the target block is non-empty, the target body concatenates exactly, and the final `blocks/pieces` have contiguous source word coverage and full target character coverage. Do not remove the old carrier's `align-edge-ordinal` check, and do not treat overlapping endpoint ranges as overlapping final blocks.

Frozen sentences (`=`) always write the text frozen in the manifest. When the echo matches, locate directly. When there are small discrepancies, character-level LCS may assist the mapping, but whole-sentence similarity is only a preliminary screen and cannot replace per-cut-point acceptance:

1. Both sides of a cut point must have a uniquely mappable matching context. If the cut point falls in an inserted or deleted region, or repeated phrases create several equivalent positions, discard that cut point, merge the adjacent target blocks, and take the `min/max` of the union of their source endpoints. Do not pick an arbitrary LCS path.
2. Deleted or unechoed frozen text must be restored into the merged target block. If the two ends of the merged block remain uncertain, keep expanding; in the worst case, merge the whole sentence. Body text must not be discarded along with a cut point.
3. After mapping, recheck empty pieces, character boundaries, protected terms, and target-language segmentation constraints, then generate edges and run planning. If the restored text contains new numbers or terms, rerun `AnchorAligner` as well.
4. Insufficient overall similarity fails the sentence's alignment. Sufficient similarity with insufficient cut points requests re-annotation or degradation per §4.2. Alignment failure does not revoke the accepted translation.

The thresholds for similarity and local matching windows are calibrated in M0 using fixtures for repeated phrases, dropped characters, negation words, and punctuation, and are fixed in code tests. Do not let wrong cut points pass by lowering the overall threshold. Character indices follow Unicode character and combining-mark boundaries; do not infer them from bytes or from the character count of any one language.

### 4.2 Still checked by code

Reuse the three-level Problem; do not add new levels.

| Level | Situation | Handling |
| --- | --- | --- |
| Whole-page fatal | Output empty, size over the guardrail, no expected ordinal appears at all | Retry the whole page, reusing the existing retry count and halving split of pages |
| Single sentence | Missing ordinal, duplicate ordinal, broken escape or markup syntax, empty translation, placeholder text, identical to source, script mismatch, locked term missing; unauthorized rewrite, rewrite length drift beyond limit, dropped numbers or anchor words; frozen-sentence echo similarity insufficient | Reject only the corresponding content or alignment artifact; other sentences on the same page are accepted as usual; keep the existing per-language criteria and exemptions such as proper nouns |
| Advisory | Ambiguous anchor, anchor not found, endpoint conflicts with hard anchor, frozen cut-point mapping not unique, cut point inside a protected term, unknown ordinal, frozen-sentence echo with small discrepancies, unannotated | Do not reject an independently valid natural translation; record and revoke unverified segmentation, then route through planning, rather than merely warning and accepting the alignment as-is |

Planning routing follows this priority, so missing evidence is not mistaken for a word-order problem: first accept valid natural translations; when there is no reliable mapping and the sentence needs splitting, request re-annotation with `=`; only when evidence is complete, the post-merge crossing result still exceeds hard, and rewriting is permitted, request a rewrite with `~`; accept alignments that satisfy budget and boundary rules. Sentences without rewrite permission always stay frozen, and after re-annotation is exhausted they degrade per §5.2. For short sentences that can be displayed whole, do not add a call just to fill in omittable markers.

New problem codes (`anchor-ambiguous`, `anchor-unresolved`, `anchor-conflict`, `frozen-cut-ambiguous`, `lines-syntax`, `rewrite-forbidden`, etc.) are registered in the closed `ProblemCode` set at implementation time and shared by both paths. Completely duplicate edges are deduplicated by code and add no new rejection reason.

### 4.3 Receipt

The validation result is structured. The Cloud path writes it into the page manifest; the Agent path returns it as the result of `ccut task submit`:

```json
{
  "page": "p003",
  "submissionId": "sub-001",
  "baseRevision": 0,
  "pageRevision": 1,
  "status": "followup-pending",
  "accepted": {"translation": [7, 17], "display": [], "alignment": [7]},
  "queued": [
    {"n": 17, "sid": "s-g62.0", "code": "over-hard", "as": "rewrite"},
    {"n": 23, "sid": "s-g75.0", "code": "missing-id", "as": "translate"}
  ],
  "advisories": [],
  "followupRemaining": 1,
  "pageFatal": null
}
```

The example lists only three sentences, to show that "the translation of 17 is accepted, its alignment is still pending a fix". `accepted` lists, separately for natural translation, display rewrite, and alignment, the in-page ordinals newly accepted in this submission. They are not merged into one count. `queued` is the remaining work for the current page, and `as` distinguishes `translate` / `align` / `rewrite`. Acceptance means the content and receipt have been persisted. Document application progress is recorded separately (§5.3), and it does not claim that all projections have been refreshed.

A separate non-persisting preflight entry is also provided. It runs the same pure-function validator and planner, returns the same diagnostic structure, but is marked `preview: true`. The accepted set is only a prediction: it does not increment the revision, consume budget, or produce a submission receipt. A formal submission must still verify the baseline fingerprint and revision.

`queued` is also the checklist for in-page follow-up work. The Cloud path uses it to assemble the second-round follow-up question, and the Agent path's worker uses it to resubmit within the same lease (§6.5).

## 5. Fault tolerance, state, and resumption

### 5.1 Per-sentence acceptance and two rounds of remediation

1. **Evidence level**: when a frozen cut point can be uniquely recovered, correct it in place. When the source endpoint is uncertain, handle it conservatively per §3.3. Keep the body text, and do not create a cut point from a guessed endpoint.
2. **Sentence level**: natural translation, display rewrite, and alignment are validated and persisted separately. A sentence may be "translation accepted, alignment pending a fix". Good sentences on the same page enter the producer's document-application queue immediately, without waiting for the page-level remediation to finish.
3. **One in-page remediation round (A)**: in the same session, follow up only on the problem sentences, giving the ordinal, the permissions, and the specific reason. If the frozen text after code correction differs from the historical answer, the follow-up must attach the current full frozen text and the text baseline. It must not require the model to recover from the old answer. Therefore, the cost of a follow-up is not always just the ordinal and reason.
4. **Cold queue**: by stage, collect the remaining sentences and re-page them with the source text, the current effective text, necessary neighboring sentences, and the reasons. Each sentence gets at most two rounds of semantic remediation: A is one in-page round plus one cold-queue round; C does not go in-page and keeps its two cold-queue opportunities. If A's in-page follow-up is wholly unavailable, that round is consumed only when the existing whole-page recovery strategy still fails, and then only one cold-queue round remains. Switching between A and C, taking over a lease, and re-paging do not reset the sentence-level budget. When cold pages mix different remaining budgets, count per sentence.
5. **Terminal errors**: `Terminal` errors such as authentication or model configuration, and cancellation, are raised immediately and committed artifacts are preserved. Do not disguise a content fallback as success. Transport retries, whole-page fatal retries, and halving splits follow the existing bounded strategy and are accounted for separately from sentence-level semantic rounds.

The cold queue uses a clean context and may include accepted translations and the specific error reasons. It does not automatically replay the complete failed session. Each round keeps the same tier. Whether to adopt the middle tier must first be settled by the independent comparison in §8.

### 5.2 Determine the terminal state by failure type

| State at exhaustion | Write and report |
| --- | --- |
| Missing translation, or translation always invalid | Keep the existing valid translation; if there was none, leave it missing and rely on existing checks such as `translation-partial`. Never treat source or placeholder text as a translation, and do not call the alignment fallback that requires a valid translation |
| Natural translation valid, alignment failed | Run only the existing deterministic ladder on the accepted text: pure anchor alignment → `fallback_word_entry` → `ai/align-fallback-<lang>.json`, which `ccut check` reports as `align-degraded-fallback`; if no valid entry can still be formed, keep the missing/stale state and report it |
| Display rewrite failed | Do not accept the failed rewrite. Keep `trans`; an existing `transDisplay` whose fingerprint is still valid may continue to be used, otherwise run the alignment fallback on the natural translation |

The natural translation writes only `trans[lang][sid]`; the subtitle display rewrite writes only `transDisplay`, bound to the fingerprint of the natural translation; alignment writes only `transAlign` that matches the current text baseline. Because the new carrier mixes three kinds of sentences together, the write target must not be confused. When a change to the source word, a user edit or the natural translation causes a fingerprint mismatch, the old rewrite and alignment must no longer be applied.

### 5.3 Persistent state machine

The page manifest must record these separately:

- **Identity and input**: task/page id, the stable mapping `n ↔ (srcId, sid)`, snapshot fingerprints of source word id/text/timing, fingerprints of the natural translation and display text, permissions, carrier/contract version, and the budget and planning config fingerprint. In single-source projects `srcId` may be omitted; in cross-source projects `sid` alone must not be used as a key.
- **Sentence-level state**: `translation = pending | accepted | missing-final`; `display = unchanged | pending | accepted | rejected-final`; `alignment = pending | accepted | degraded | missing-final`. Existing natural translations are initialised as accepted. These are task states and do not extend the transcript data model.
- **Page-level state**: `awaiting-initial → followup-pending → closed`. Going straight to closed is allowed when the first submission leaves no residue, or when option C is chosen. `closed` means the current call has ended, though sentences handed to the cold queue may remain. Completing the stage must wait for the cold queue and document application to converge, and must report the counts of missing translations and degradations.
- **Bookkeeping**: a monotonically increasing `pageRevision`; for each submission, its `submissionId`, answer hash and base revision; per sentence, the number of follow-up rounds consumed; the current lease; the stable entry keys of the cold queue; and the producer's applied revision.

| Event | State change and action |
| --- | --- |
| First submission partly succeeds | Persist the accepted set and the remaining sentences; valid translations may be accepted first, while alignment stays pending. A stays in followup-pending and follows up under the same lease; `--next` does not claim another page |
| Follow-up submission | Handle only the sentences still pending from the previous submission's queued receipt, and only the fields permitted. Do not overwrite accepted translations; `rewrite` writes only the display layer; suggestions for the other sequence numbers are recorded. After submission, the rest goes to the cold queue within the remaining budget, and the page becomes closed |
| Content accepted but document not yet applied | On rerun, complete only the missing stages and replay accepted records not yet applied. Do not skip alignment=pending just because translation=accepted |
| Lease expired or worker dropped | The successor reads the same page revision, remaining budget, current frozen text and receipts. If history can be recovered, continue from it; otherwise open a new context with the full repair payload. Do not send only sequence numbers, and do not re-accept the whole page |
| User edit or input baseline change | Mark pending old results stale and re-plan against the new snapshot. Accepted history is kept for audit and does not overwrite the current document |

**Order of submission and application.** The parser/planner stays a pure function. Formal submission is done by the shared coordinator, which checks the baseline under the lock, writes an immutable submission record (containing the valid text, planning artifacts, answer hash, receipt and next state), and then atomically publishes the page manifest revision. The receipt is returned only after the persistent commit completes. The producer is the sole writer of the transcript and applies changes incrementally from committed records; CLI submit must not open a separate path that modifies the transcript directly. A partial submission must not write `responses/<call>.json` early, because old consumers treat that file as "the whole call is complete". The final response is published only after the page is closed, and the producer reads intermediate results through the newly added submission events.

**Document update and applied revision must be replayable.** First record the intent to apply, together with the before and after fingerprints; then write atomically through the existing document write path; and finally advance the applied revision. On crash recovery: if the document matches the after-fingerprint, record completion; if it matches the before-fingerprint, apply once; if neither matches, report stale. Never replay unconditionally. The tests must cover interruption points such as "submission record written but manifest not published" and "document written but applied revision not yet updated". An atomic rename of a single file is not a cross-file transaction.

**Idempotency and concurrency.** The idempotency key includes task, page, base revision and answer hash. `submissionId` is generated before the first send; the same id with different content is a conflict. Resending an identical submission returns the original receipt directly, without writing the document again or consuming a round, even if the first response was lost. A new submission must do compare-and-swap against the current revision. Hedged or late answers compete only once, and only while the same baseline is still valid. An old revision returns stale plus the current receipt; it must not overwrite the winner, close a page that still has follow-ups, or consume the current worker's budget. Takeover and hedging share page and sentence state; they do not each build their own repair budget.

## 6. How each stage lands

### 6.1 Comparison

| Now | Later |
| --- | --- |
| Translation page `translation-source/1`, with rows that merge attributes | `lines/1`, with no translation rows |
| `align-edges/1` (page b) | `lines/1`, `=` sentences, block interpretation |
| `align-rewrite/1` (page w) | `lines/1`, `~` sentences, block interpretation |
| `r` repair page | A follows up on the same page, then the cold queue; C goes straight to the cold queue; the repair page mixes all three sentence kinds |
| `align-table/1` (targeted repair, review) | `lines/1`, `=` or `~` sentences, row interpretation |
| Paired row-repair tail rounds | `=` sentences in the repair queue; the `!` line says "these sentences are now marked at finer granularity" |

Old-format data in historical task directories is still read by the old parser and the old submission state machine, handled the same way json-v0 was wound down. The carrier, submission protocol and prompt version enter the persisted request and the reuse fingerprints. An old lease must not run under the new follow-up rules just because the file extension changed.

### 6.2 Timing information is no longer given to the model

`data-align-groups` has the model judge "at least 1 second per row, and no more than 6 units per second" by group duration. Reasons for dropping it:

- Reading speed and minimum duration already have deterministic bounds (`merge_short_rows`, and the duration term in `pair_cost`). The model's rows have always been drafts.
- Of the three sources of grouping, the model can see sentence punctuation itself, and pauses can be expressed with `⏸`. Source Cue boundaries, by discipline, should not have been evidence in the first place.
- It takes about 14% of the translation input, and it mixes two things together: "settle the translation first" and "group and join lines by the source side".

The cost is that first-round rows may more often be merged by code. This is the first metric that §8 must compare.

### 6.3 Rewriting is still a second step, but cheaper

"Rewrite in source order when it does not fit" is not merged into the translation call. The reason: the discipline requires a complete, natural translation first, and the row-first experiment also showed that letting the model fit lines while it translates loses information. Rewritten sentences are handled together with the other problem sentences, either as a follow-up on the same page or in the cold queue (§6.5). In §7, the rewrite output replayed from the old starting-format is about 15% of the original. The actual output volume of the head/tail anchors must be measured again.

### 6.4 Two execution paths

The local Agent and the Cloud Model share the same contract text, the same parser and the same validator. Switching must complete in the same submission:

- Cloud: system prompt, the media type of `<BEGIN INPUT>`, acceptance.
- Agent: `contracts/<kind>.md`, the file extension of `payloads/`, the lint gate and receipt of `ccut task submit`, and several skill references such as `agent-task-file-contracts.md` (the descriptions of the four carriers are merged into one, which noticeably shortens the text).
- Shared regression: the same batch of fixtures runs through both paths (§8).

Changes to the CLI surface: `--align-carrier` gains new values, plus a preflight entry, base-revision and idempotency fields on submission, partial-acceptance receipts, `--next` and late-submission semantics, and `specVersion`. All of these must be synchronised at implementation time with [cli-server-reference](../cli/ccut-cli-server-reference.md), the closed protocol set and the related tests. This design doc does not modify the current CLI reference in advance, so that a proposal is not treated as a published contract.

### 6.5 Session and cache

Translation and alignment can share one session, with the unit being a **page**. Whether to use in-page follow-up is decided by a separate controlled comparison; it must not be inferred from "the cache is available" alone. Three shapes are available:

| Shape | Round 1 | Round 2 (same session) | Afterwards |
| --- | --- | --- | --- |
| **A fused + in-page follow-up** (candidate) | Translate, while also giving head/tail anchors | Follow up only on this page's problem sentences | The rest goes to a cold queue at the end of the stage |
| B translate first, mark later | Translate only, no marking | Give head/tail anchors for the sentences that need splitting, echoing the frozen translation | Problem sentences are followed up within the remaining budget; all rounds count toward cost |
| C cold queue only (cost baseline) | Translate, while also giving head/tail anchors | None | A cross-page queue at the end of the stage, at most two rounds, executed within each sentence's remaining budget |

B's normal first-pass marking is not failure repair. If it also fills missing translations, the affected sentences must consume the semantic follow-up budget, and the count must not be reset by switching stages.

A's round 2 is a follow-up of this form. The output format is the same as §3.2, and it returns only the sentences that were pointed out:

```
4~
! Whole sentence 26 units, only one block, over 20
17=
! Anchor "you know" appears 4 times in this sentence; quote a few more words
```

**Cost is first calculated by the actual cache boundary.** The old draft wrote A's round 2 as `c·(5S + P + T) + R + w·F`, assuming the round-1 answer `T` was also cached. For a Claude request whose first breakpoint stops at `user₁`, round 2 can only read up to that point; the newly appearing `assistant₁` must be billed as uncached input or as cache write. The official multi-turn examples distinguish these two parts clearly, so "same session" must not be taken to mean everything hits. [Claude prompt caching docs](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)

To show the magnitude of this correction, the old-starting-format data from §7 is used tentatively: `S=6,000`, `P=22,157`, `T=8,657`, `F=3,056`, `Q=8,253`, `R≈2,000`. Input characters count as 1, output counts as `w=4`, and cache reads count as `c`. The table assumes all five pages get one follow-up, and C's first-round cold queue is split into two pages. It still excludes the cache-write premium, storage fees, reasoning tokens, extra residual repairs and the cross-page system discount. **It is not a billing forecast for the new scheme**:

| Shape | Formula | c = 0.1 | c = 0.25 | No cache |
| --- | --- | ---: | ---: | ---: |
| A, round-1 answer not cached | `5S + P + w·T + c·(5S + P) + T + R + w·F` | 114,882 | 122,705 | 161,823 |
| C, first-round cold queue only | `5S + P + w·T + 2c·S + Q + w·F` | 108,462 | 110,262 | 119,262 |

Therefore the earlier draft's break-even conclusion at `c≈0.13`, and its quantitative conclusion that "B costs a quarter more than A", are withdrawn. Head/tail anchors add output; frozen-text corrections may add follow-ups; A's final-round cold queue and C's round-2 cold queue must both be counted at their real residual. B is kept as the quality control for "translate first, mark later", and is recalculated from each round's actual requests. It must not be extrapolated from the old-starting-format character table.

**Unified ledger.** Each real request records provider/API/model, input, output and reasoning tokens, cache read and write tokens, the billing category and price version, explicit cache storage/TTL cost (if any), latency, and whether it was a hedge or a retry. Usage fields that overlap by provider definition are first converted into mutually exclusive billing categories, and only then summed; reasoning already included in output billing must not be added again. When usage is missing, mark it unknown, not 0. Streaming responses aggregate the final usage. Agents read the billing data the host provides; when none is available, they report only character/token estimates and must not claim that the actual cost has dropped.

**A/C selection.** M1 first compares the two under the same carrier, tier, page budget and a two-round follow-up cap. It reports total cost, remaining errors and end-to-end latency separately, and then fixes the winning strategy into the provider/model configuration. A system cache hit does not mean the whole page history hit, and the unified rule "use A if more than half hits" is no longer used. Use C when there is no reliable usage information or the configuration is unverified. When falling back to C midway, keep the per-sentence budget already consumed. A's neighbouring-sentence context may improve quality or shorten waiting, but this must be supported by the comparison results.

**The cross-page shared system can be implemented separately.** The system prompt of this project's five translation calls is byte-identical (12,753 bytes, 11,951 characters each), and resending it does not mean full price. Assuming none of the earlier calls hit the cache, the later four hit fully, and `c=0.1`, only the system character weight would drop from 59,755 to about 16,700. The actual gain is subject to the ledger. Gemini enables implicit caching by default, which shows that the absence of explicit breakpoints is not enough to assume there is no cache. [Gemini caching docs](https://ai.google.dev/gemini-api/docs/generate-content/caching)

- Put page content in user; keep the system byte-identical throughout a run, enforced by a test.
- Choose explicit or implicit caching and breakpoints per provider capability. Claude may set breakpoints at the end of the shared system and at the end of the first user message; the cache eligibility of the first-round assistant input is calculated separately. Automatic breakpoints can also incur write fees, so "automatic" versus "explicit" cannot be used to split free from paid.
- Only a provider that needs first-request warm-up, and whose measured benefit holds, may defer the start of other pages, and the waiting latency is recorded. For Claude, the entry can be reused once the first response starts. Other APIs cannot copy this timing.
- Record the model, API, minimum cacheable token count, TTL, read and write prices, and adaptation behaviour as an updatable capability config. Do not write this section's example character counts or uniform hit ratios as routing constants. Re-check the official docs at implementation time.

**Do not put all pages into one long session.** Each round re-reads all earlier content, so cost grows with the square of the page count. Pages cannot run concurrently, one bad page affects the ones after it, and hours-long manuscripts do not fit. The only thing to share across pages is the system.

**What the cloud path needs to add.** Each call is now stateless: `system + one user` (`LlmRequest` has only these two parts). "Same session" here means the request body carries the history `[system, user₁, assistant₁, user₂]`:

- `assistant₁` stores the complete message representation that the provider supports for replay. It is not reconstructed from the cleaned translation. The current `response_text` and `logs/llm/*.jsonl` mainly keep the extracted answer text and cannot be treated as the full provider response. A new dedicated page artifact must store the content blocks, signatures/opaque state and text that replay requires, following each API's rules, and must not attempt to obtain hidden reasoning that was not returned.
- The session is rebuilt from persisted requests and responses. A response is persisted before parsing and bound to the request fingerprint. An existing response or submission receipt is reused directly. An interruption after the request was sent but before the response was persisted may cause duplicate billing, so no promise is made that only the cache is lost. Disk idempotency guarantees "applied once", not "executed once by the provider".
- Round 2 and round 1 use the same model and tier. OpenAI-compatible, Anthropic and Gemini each need tests for history replay, required opaque fields, usage and error recovery. Where reliable replay is not supported, fall back to the cold queue with the full payload; do not pretend a generic assistant string is the original history.
- Follow up as soon as validation finishes, but the TTL is also affected by first-round generation time and queueing, so fast code validation does not guarantee a hit. Record the actual hit. The cold queue also cannot assume the system cache is still valid in advance.
- The current `reasoning_tokens` is read only in some error diagnostics and is not a full usage record. Cost reduction is evaluated only after the ledger above is complete.

**What the Agent path needs to add.** The worker's CLI session already keeps context across calls, and the cache is managed by the CLI itself. What is missing is "the same worker continues to follow up the same page":

- `ccut task submit` runs the shared parser and planner synchronously, and returns `queued` through the atomic submission of §5.3. A's `followup-pending` receipt lets the worker submit one follow-up within the same lease. `--next` must first finish the current page, and claims another page only after the page is closed. Lease takeover, late submission and hedging also follow the revision and idempotency rules.
- The new carrier does not copy the old kind's force-through behaviour. After the first submission, valid parts are kept, and failed units are subject to the two-round follow-up cap. Old tasks keep the old protocol for hardGate/noProgress; the new protocol must not bypass content acceptance through migration.
- The Agent's CLI session is not guaranteed to persist. If the host compresses context or restarts, the full repair payload is restored from the manifest. The provider's usage cache gate does not apply directly to Agents; choose A or C based on independently measured worker cost and latency.
- The target reasoning effort is medium for every round, with no automatic step-up, but "medium is sufficient" is not yet verified. First fix the current tiers and test the carrier, then compare medium separately. Only after passing the §8 quality gate may the corresponding `recommendedEffort` change from `high` to `medium`; otherwise keep the current tier. Error feedback should still prioritise adding the specific reason and context.

### 6.6 Pre-translation polishing is not merged into the page session (decided)

The page session handles only translation and alignment. Polishing before translation (which edits the source text) remains a separate stage with its own pages, for these reasons:

- Different paging: the polish pages have a 2,200-word core region, with up to 200 words of read-only context on each side (`PolishBudget`); the rows translation pages use 800 words.
- Whole-document steps sit between the stages: after polishing there are four cross-page waves (`punct-repair`, `polish-retry`, `seam-repair`, `segment-repair`) and one whole-document write-back, and `translate-brief` reads an excerpt of the polished full text, so translation must wait until all of these are done. Merging them into the session would require reordering this entire sequence.
- Reusable page boundaries are limited: on this machine, 4 of the 26 projects have more than 20% of their sentence-final positions changed by polishing. The extra saving of 10%–13% from the old draft depended on an unapproved cache assumption, so that quantitative conclusion is withdrawn and is not a basis for the merge stage.

Polishing's own condensation (patch-style output) is covered in §10.1 and is unrelated to the page session.

The current pipeline has no "polish translation" step. `~` sentences only produce a separate display rewrite and do not overwrite the natural translation. If a natural-translation polishing step is added later, its write permissions, fingerprint invalidation and alignment recomputation must be redefined. It must not be appended as an extra round merely because a page session already exists.

## 7. Historical replay and data to be re-measured

The following keeps the **starting-point-only format** replay from the original draft: existing outputs of this project are mechanically converted without calling any model, and only the size is compared. Anchors are taken as “the shortest prefix that is unique within the sentence, at least two atoms.” The character counts are the values from that replay. Tokens are relative values under the same heuristic estimator, not absolute counts from any vendor's tokenizer. This document review did not rerun these projects independently and did not recalculate with head-and-tail references, so the old output saving ratios must not be labelled as results of the current `lines/1`.

| Page | Input characters | Output characters | Estimated tokens (in / out) |
| --- | --- | --- | --- |
| Five translation pages | 92,158 → 22,157 (−76%) | 23,766 → 8,657 (−64%) | −86% / −61% |
| `w001` rewrite page | 10,552 → 4,283 (−59%) | 12,780 → 1,640 (−87%) | −69% / −84% |
| `w002` rewrite page | 10,216 → 3,970 (−61%) | 12,075 → 1,416 (−88%) | −71% / −86% |
| `b001` edges page of `v002` (including 10 out-of-order spots) | 7,411 → 3,424 (−54%) | 9,924 → 1,503 (−85%) | −67% / −83% |

How many atoms an anchor must quote to be unique within a sentence:

| Sample | Cut points | 1 | ≤2 | ≤3 | ≤4 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Existing `transAlign` cut points in the 27 local English-source projects | 3,561 | 72.3% | 95.3% | 98.5% | 99.6% |
| Chinese source (character-level atoms), first 30,000 characters of a long interview, synthetic cut points | 2,167 | 60.7% | 86.7% | 94.5% | 97.7% |
| Chinese source (character-level atoms), short film, synthetic cut points | 151 | 72.8% | 93.4% | 98.0% | 98.7% |

The two Chinese-source rows have no real translations to use. Their cut points come from splitting sentences at pauses and taking one cut point every 10 atoms, so they indicate only the order of magnitude of the collision rate. In the English sample, there are 5 cut points (0.14%) that are still not unique even when quoting 5 atoms. The new rule must not guess by “the first occurrence after the previous anchor”; it must add context references, fall back to ordinal numbers, or mark the position as unknown. Other source languages are positioned by their own atoms, and these percentages do not apply to them.

In the M0 re-measurement, fix the input snapshot, the conversion script version and the tokenizer, and report the total length of head-and-tail references, the joint uniqueness rate of the endpoints, the proportion that cannot be encoded, the escaping overhead, and the input/output tokens. Only M1 can answer the actual model's mis-anchoring rate, information retention and final cost. Collision rate and correct-positioning rate must not be merged into one metric.

## 8. Verification and implementation order

| Step | Content | Pass condition |
| --- | --- | --- |
| M0a | First add the §6.5 usage ledger, the historical replay artifacts and the current baseline; carrier, tier and paging stay unchanged for now. The shared system cache and removing useless echo can each be tested separately | Actual billed fields can be reconciled; unknown is not reported as zero; cost and latency are reported item by item, and the combined gain from several changes is not credited to anchors |
| M0b | First compress the old `AlignChunk.ordinals` into two edges, the head and the tail, without involving strings; then add `lines/1` encoding/decoding and reference positioning. Fix the target block, candidate cut points, hard edges and weights, and reuse the 126 cases in `core/fixtures/align/golden/` and add contract fixtures | With complete evidence, endpoint compression preserves the safety boundary and the block/line results; coverage metrics must not be padded by scope. The new conservative gate for empty attribution and unknown evidence is listed separately as an expected change and must not be relaxed silently. Format round trips, frozen body preservation and all the counterexamples below pass; §7 is recalculated with the real tokenizer |
| M1 | Run a real head-to-head comparison of old and new formats on the same projects. First fix the model, tier, page budget and repair strategy, then test carriers, prompt slimming, removal of the time group, A/B/C sessions, the middle tier and an expanded page budget. Extend `scripts/bench/translate_prompt_ab.py` or its companion harness to collect the new receipts and ledger | Accept against the content, alignment and cost gates below. At least one weak model and one strong model; Agent runs real projects with Sonnet workers, with at least about 10 pages per tier at 800 / 1200 / 2000 (re-paginated from the same source corpus); change only one factor at a time |
| M2 | After M1 passes, enable the new carrier on both paths in the same switch commit; connect partial acceptance, producer incremental consumption, repair budget, state machine and protocol compatibility from §5; sync the CLI reference and the product skill | `cargo test -p ccut-flow-core -p ccut-engine -p ccut-kernel -p ccut-serve`, a skill directory check, and one full real run on each of the two execution paths; the fault-recovery tests below pass, and tasks on the old carrier can still continue |
| M3 | Polish patch (§10.1), still a separate stage | Checked against word-level changes, preservation of facts and numbers, and consistency of sentence and paragraph boundaries; patch conflicts and idempotent replay pass |
| M4 | Speaker page (§10.2) | Accuracy of speaker-change positions, no wrong edits for unknown positions, fallback to old indexes, and cost compared separately in head-to-head runs |

**Required M0 counterexamples:** non-contiguous crossing `{1,3}` / `{2}`; the first block corresponds to the second half of the source sentence; a repeated phrase appears before the previous block; identical starts, containing ranges and multiple adjacent crossings; empty attribution and unknown attribution; a hard anchor falls outside the model's range; short-reference collisions, pure-punctuation atoms, numbers and URLs; new translations containing delimiters, backslashes, `..` and line breaks; repeated phrases in frozen sentences, local dropped characters or negation words, insertion, and protected-word boundaries. Normalization and indexing cover character-level, word-level, combining-character and bidirectional text; do not infer space tokenization for languages not listed.

**Quality and cost gates for M1:**

- Content: blind human review of a sample comparing naturalness, completeness, negation, numbers and proper nouns; A must not be worse than B. Structural acceptance rate must not substitute for translation quality.
- Alignment: under the same human reference, report the mis-anchoring rate, the false-safe cut-point rate, the whole-sentence downgrade rate, the first-round acceptance rate, the residual repairs, `overFit`, the proportion exceeding reading-speed limits per target language/profile, SubER and boundary F1 (`CCUT_VERIFY_METRICS=1`). The 6 display units per second in the original example is only the corresponding profile and must not be generalized into a threshold for all languages.
- Cost and latency: sum all actual requests, including cold queues, inference, cache writes and storage, and hedges, and list them separately for Agent and for each provider. The target is at least halving the actual cost at the same quality, while also reporting end-to-end latency. Paths without billing data keep the conclusion that cost is unknown, and estimates must not be used to declare a pass.
- Before a head-to-head run, fix the samples, versions, repeat counts and non-inferiority tolerance, and report by language pair and by sentence length. About 10 pages is only an exploratory lower bound and is not enough to rule out tail degradation; if needed, expand the sample, and do not decide on a single average score.

**Fault-recovery gates for M2:** interruption after a partial commit; resending the same answer after a lost response; same id with different answers; baseline changes after pre-check; lease takeover; late arrival from an old worker; hedge races; crashes between the record, manifest and document writes; recovery after cancellation; and staleness caused by edits to source words or user translations. Assert that accepted body text is not overwritten, unfinished alignment is not skipped, the per-sentence budget is not reset, document application is idempotent, and a final response does not close early before late resubmissions.

If the anchor path does not pass M0/M1, the default is not switched, and the system falls back to the conservative ordinal scheme in §11. Other independently passed observation, caching and echo optimizations may be kept.

### 8.1 Implementation and real comparison on 2026-09-30

This round, as the user specified, had the sol sub-agent collect data read-only, and all real LLM requests used DeepSeek V4.1 Flash (API ID `deepseek-flash`). The implementation entry points are `ccut-flow-core::filepipe::{lines,lines_translation}` and `plan_sentence_at_cuts`; the experiment commands are in the `lean_carrier_grade` / `lean_carrier_replay` / `provider_carrier_bench` examples and `scripts/bench/lean_carrier_ab.py`. The production default, the task-submission protocol and the product skill have not been switched yet.

**Deterministic validation.** 73,728 combinations and the 126 golden cases preserve the safety boundary, the blocks and the golden final plan. Of 43 real historical calls with 1,553 lines in total, after re-parsing with the old Rust parser, 1,197 lines had usable annotations and 356 had none. For 3,961 blocks, the edges were reduced from 24,935 to 7,752, and there were 0 boundary/block differences and 0 round-trip failures. 26 blocks could not be encoded as unique references, so they kept unknown; the interior of a range was not treated as observed correspondence. This only proves the property of compressing identical annotations.

**Real first round.** 4 projects, 10 pages, 508 sentences and 8,724 source words, all en→zh-Hans. The test used real word timings, the same default planner, auto tier (thinking off), temperature 0.2, and alternated the old/new call order page by page, with one run per page per variant. The candidate replaced the format instructions and removed the time group simultaneously, while keeping the context and terminology constraints, so it is a combined exploration and cannot be attributed to any single change. The scorer did not inject extra bilingual TermPairs. The first AMD page overlapped with the pilot, and its cache was a mix of cold and warm.

| First-round metric | Old HTML / ordinal | New line text / head-and-tail references |
| --- | ---: | ---: |
| Input tokens | 115,394 | 36,366 |
| Output tokens | 41,079 | 16,761 |
| Format and existing-content validation passed | 508 / 508 | 500 / 508 |
| Passed alignment planning directly | 378 / 508 | 329 / 508 |
| Needs rewrite / whole-sentence downgrade / translation pending | 33 / 97 / 0 | 98 / 73 / 8 |
| Actual cached usage converted at list price (USD) | 0.03753474 | 0.01306542 |
| Total call time for 10 pages / per-page median (s) | 126.627 / 10.596 | 79.347 / 7.370 |

Costs were converted from the real hit/miss/output tokens at the time of the call using the [DeepSeek official off-peak list price](https://api-docs.deepseek.com/quick_start/pricing/), at $0.003 / $0.15 / $0.6 per million tokens respectively. These are not billed charges, and reasoning tokens are not counted again. Failures and fixes from the exploratory pilot are accounted separately and are not mixed into the table above. Backfill and whole-project wrap-up have not been completed, so the first-round saving cannot be used to claim that “total cost at equal quality has fallen.”

The sol agent spot check found that the second page of Open Models had consecutive cross-sentence misalignment: the Nvidia / Apple Silicon content of sentence 29 moved into sentence 28, sentence 31 showed the next sentence's “24 hours” early, the negation in sentence 45 was replaced by the next sentence's content, and sentence 46 was missing. In the AMD long sentences, the old output had 4–6 blocks while the new output had only 1 block, which added needs-rewrite. Format passing does not mean semantic correctness, and successful automatic positioning does not mean correct correspondence. These examples are enough to block switching the default. This round was not blind human review and has no SubER / boundary F1 or full-project export acceptance.

The experimental adapter is narrower than the full specification: frozen echo accepts only exactly identical body text; the diagnostics are temporarily experimental `Issue` entries and are not registered as production ProblemCodes; the renderer uses `= N text` / `! N constraint` to explicitly tie on-page ordinal numbers, and `~` rewrite pages and task backfill are not yet supported. M0's LCS and full frozen coverage, M1's single-factor and multi-configuration tests and final quality acceptance, and M2–M4 are still pending. The next round should test the carrier, the time group and the chunking instruction separately, keep the ordinal-addressing control, and add cross-sentence content-misalignment fixtures.

### 8.2 2026-09-30 Round 2: chunk hints, joint location, line-ownership gate and re-ask round

The three classes of failure from §8.1 (cross-sentence misalignment, long sentences collapsing into one chunk, fragile quote-based location) were attributed one by one and fixed on the same batch of samples; no rollback to the old carrier. Still DeepSeek V4.1 Flash, auto tier, temperature 0.2, the same 10 pages and 508 sentences, one run per round.

**What changed.**

- *Chunk hints and piece markers*: the model ignores the abstract “≥k”, so at render time each source sentence is cut directly into k pieces, with `¦` between pieces (`lines_translation::piece_boundaries` / `with_pieces`). Cut points near the even split prefer positions after punctuation, otherwise positions before a clause-initial word (the list of initial words is given per source language; for unlisted languages only punctuation and even splitting are used). No cut is made between two words that both begin with a capital letter (multi-word proper names in cased scripts); scripts without case are unaffected. k is set by `chunk_hint`: for a Latin-script source and a CJK target, the target length is estimated as non-whitespace characters × 0.34 (the measured p75 for en→zh); for other language pairs only the budget is used. The count is then divided by `chunk_units = fit×2/3` to get the number of pieces (deliberately finer than one line, leaving short-line merging to the planner), capped at half the number of words. The protocol requires one chunk per piece, quotes within a piece use the first and last words of that piece, no quote may span `¦`, and the output must not contain `¦`; the parser strips any echoed `¦`.
- *Joint location*: `lines::resolve_jointly` resolves all quotes in a line together and may drop individual quotes. Branch-and-bound scoring maximises, in order: the number of quotes kept, the number of words covered, the number of endpoints that fall on piece boundaries, fewer crossings, and the total quote grade. Grades are Exact / Punct / Fold / Stem (Stem lets `you` match word-initial forms such as `you're`), and each endpoint is graded separately. The trimming set gains dashes, ellipses, brackets and curly quotes. When a line has only one chunk, that chunk owns the whole sentence (the outermost chunk extends to both ends), so partial quotes no longer cause hard anchor conflicts.
- *Line-ownership gate*: `lines_translation::parse` first computes `owned` (the lines whose quotes hit this sentence), then gives each chunk a `Verdict`. A chunk whose quote hits this sentence is Own. If all of its quotes hit other sentences and this sentence has no chunk hit, it is Drifted (re-attributed to the unique unoccupied editable sentence, per the original logic). If its quotes hit another sentence and that sentence's own line text already contains this chunk's text, it is Merged (the chunk is dropped and `LineMismatch` is left). If the sentence has no line of its own, the whole line is Swallowed (rejected). Syntax tolerance: redundant `..` inside a quote is ignored (adjacent `....` still errors), and dangling `|` / `||` at the end of a line are dropped.
- *Re-ask round*: after the first round, sentences marked “translation missing” are re-asked as they are, and sentences where “chunks too coarse (located chunk count < required chunk count)” are re-asked as **editable** sentences (`existing_translation` is used only to raise `≥k` by one and does not print the old translation). An attempt to freeze the old translation with `= N` so the model would only re-split was tried first; the model silently changed the translation as well, and the strict frozen-validation then revoked all the cuts, so it was dropped. `validate_translation_quality` in `ccut-flow-core` only looks at `existing_translation` for non-editable sentences, so re-asking is safe. Scoring changes to `plan_sentence_at_cuts(edges, candidate cuts ∩ evidence cuts)`, so a sentence is no longer vetoed as a whole for lacking evidence.

**Result.** The same 508 sentences. “Aligned” = passed block-level planning directly, “whole sentence” = demoted to a whole-sentence entry, “rewritten” = some chunk exceeds hard and needs monotone rewriting. Tokens are wire usage; cost is converted at the list prices from §8.1 (cache miss / hit / output = $0.15 / $0.003 / $0.6 per million; this is not a bill).

| Round | Aligned / whole sentence / rewritten | Re-translated | Input (of which cache hits) / output tokens | Time | Cost at list price |
| --- | ---: | ---: | ---: | ---: | ---: |
| Old HTML carrier (§8.1, one round) | 378 / 97 / 33 | 0 | 115,394 (30,080) / 41,079 | 126.6 s | $0.0375 |
| §8.1 first round re-scored with the new parser | 364 / 1 / 132 | 11 | — | — | — |
| Round 5 first pass (chunking + joint location + ownership gate) | 439 / 0 / 67 | 0 | 42,100 (26,112) / 16,321 | 88.7 s | $0.0123 |
| Round 6 = round 5 first pass + re-ask round | **491 / 0 / 17** | 0 | re-ask 30,776 (25,344) / 3,738 | +26.6 s | total $0.0154 |
| Round 7 (proper names not cut; both rounds fresh) | 490 / 0 / 18 | 0 | 42,100 (38,528) / 16,317 + 31,889 (25,984) / 5,044 | 88.2 + 32.8 s | $0.0144 |

The round-7 first pass alone had only 412 / 0 / 67, with 29 sentences re-translated. On AMD page 4, 26 lines were written by the model in the postfix form `text |quote||text |quote|` (under the same protocol and the same input, round 5 produced only 2 such lines). This whole-page syntax failure was fully recovered by the re-ask round. It is a failure mode the model enters at random and then reinforces within the page. The parser does not guess its convention (a wrong guess would write wrong cut points); it only rejects and re-asks. After round 7 the protocol gained one more sentence, “write the quote before the body in each chunk”, which was not run as a control. The remaining 17–18 rewrites are almost all sentences where the translation's word order was swapped, or where a monotone chunk exceeds the one-line hard limit (the old carrier had 33 as well). They belong to the rewrite stage in §6.3, not to the carrier.

**Not done and limits.** It is still a single en→zh-Hans language pair, with one sample per round, and there is no SubER or boundary F1. The 0.34 in `estimated_units` is only the Latin→CJK coefficient; other pairs rely on the budget. Switching the production path is covered in §8.3. Experiment entry points: `lean_carrier_grade {protocol|render|grade|render-fix|grade-fix}` and `scripts/bench/lean_carrier_ab.py {prepare|grade|prepare-fix|grade-fix}`. Model calls go through `provider_carrier_bench`, and all artifacts are written only to the experiment directory.

### 8.3 2026-09-30 Round 3: content blind review, parser guardrails and production wiring (M2 provider path)

**Content blind review of round 7.** Scores measure only cut points, not translation content. So a separate blind review was run on the 508 sentences of both round-7 passes, looking only at the source and the translation (not the scores, not the quotes). Results: cross-sentence content misalignment 0, fragments 0. Errors: 1 (in the re-ask round, s-g96.0 rendered Lisa as “李飞飞” (Li Feifei), a wrong name). Duplicated body text between two adjacent chunks: 4 (the model restated the same phrase to pad the `≥k` chunk count). In the 30 lines of the re-ask round, extra spaces appeared at chunk seams (spaces on either side of `|` were copied into the translation as they were). Checking 30 sentences for whether the `≥k` piece hint matched the model's chunks: 20 corresponded, 8 had the right chunk count but boundaries offset from the piece hint, and 2 were other. The conclusion is that the carrier itself does not mix up content. The defects are two surface problems that code can guard against: padding the chunk count, and whitespace at seams.

**Parser guardrails.** `lines_translation::parse` adds two steps after syntax parsing and before semantic attribution. `tidy_joints` normalises whitespace at chunk seams according to the target script (adjacent CJK characters get no space; otherwise a single space is kept; whitespace-only chunks count as having no body marker). `repeated_chunk` runs an LCS on adjacent chunk pairs (each with ≥4 valid characters). At ≥80%, it rejects the line with the new issue code `translation-chunk-repeat` and asks again, without guessing which chunk is the redundant one. Two more protocol sentences were added: chunks only split the translation and must not restate or pad it; if k chunks cannot be cut, give fewer. And `|` must not be surrounded by spaces that the target language itself does not have. Like the “write the chunk's quote first” sentence added after round 7, these two were not re-run against the 10-page control. Their effect will be judged from later real-project batches.

**Production wiring.** `ccut translate --align-fusion lines` (`specVersion` 1.299.0). `engines/translate.rs` switches carriers with `FileCarrier::{Html{rows}, Lines(TransParams)}`. The request kind is `translate-lines`, `text/plain`, temperature 0.2, and the full `lines_translation::PROTOCOL` text is appended to the end of the system prompt. The page body is generated by `render_with_params` and parsed by `parse_with_params`. Accepted sentences, together with their piece boundaries and source word snapshot, go into `TranslateParsed.lines`. Pagination reuses the 800-word tier of `rows`. On commit, `lines_translation::rebase` re-cuts the chunk text onto the auto-corrected stored translation, and `FusionDraft.lines` enters `accept_fused_drafts`. It is accepted only if the source words match the current transcript word for word. Evidence cut points ∩ target cut points form chunks via `plan_sentence_at_cuts` (`TransAlign.aligner = "llm-lines+anchor/1"`). Sentences with monotone chunks exceeding `hard` go into the existing `align-rewrite/1` rewrite round; the rest fall back to standalone align. `--llm agent` combined with `lines` is rejected with `invalid_arg` before the call is created. The Agent path's task contract, worker guidance and submission lint are not yet wired to this carrier. The synchronisation obligation for both paths is met by “explicit rejection” rather than “silently falling back to the old carrier”, and both will be changed together when wiring happens. The whole-page soft resend and the display-line merging specific to `rows` do not apply to `lines`. Defaults are unchanged; the product skill does not need changes.

**Not done.** Partial commits, idempotency receipts and the state machine from §5 (the M2 fault-recovery gate), M3–M4, and the Agent path. The rewrite round is still a standalone call (§6.3).

### 8.4 2026-09-30 Round 4: Codex re-test, real-project batch and ownership-gate fixes

**Codex re-test of §8.3 (replay of the same 508 sentences, no new calls).** All four findings were adopted. (P1) Joint location “dropping individual quotes” discarded crossing evidence and produced false safe cut points. It now treats each quote as the source “envelope” of its chunk. When two chunk envelopes overlap, that is still kept as word-order crossing evidence, and only the gap between the two gets no cut point. Adjacent chunks sharing an endpoint are clipped to one chunk by the partition reading (advisory `shared-endpoint quote(s) clipped`). No quote is dropped any more. (P1) A chunk whose quotes could not be located previously only disabled the adjacent cuts. Now, if any non-`∅` chunk quote cannot be located, the whole sentence gets no cut points. (P2) Of the 7 hits from the repetition guard, 6 were normal translations. It now computes the LCS over reading units (per character for CJK, per word otherwise, each ≥4 units), and repetitions that already exist in the source are allowed. (P2) A literal `¦` in body text was silently stripped. It is now escaped as `\¦`, the same as `|` and `⏸`. Unescaped echoes are still stripped, and logged as `marker-residue`. Replaying the same 508 sentences: first-round aligned / rewritten / pending re-ask changed from Codex's 479 / 67 / 29 to 477 / 63 / 31. Sentences with anchor conflicts went from 44 to 24. The two-round merge went from 490 / 18 to 489 / 17. The 2 fewer (`amd-p002 s-g40.4`, `open-models s-g51.0`) are cases where the model really wrote restatements such as “美国和欧洲的模型，美国和欧洲模型，” (American and European models, American and European models,) into the translation, which had previously passed as aligned. They are now rejected with `translation-chunk-repeat` and re-asked, which is the correct cost. Moving the `unlocated` decision after the anchor step was tried once: the replay lost 8 sentences and gained none, because an anchor that crossed an already located quote was judged as unlocatable. This was rejected, and the evidence is recorded in the comments in `lines.rs`. In the `FusionDraft` receipt, `translatedSentences` now counts the sentences actually stored, and a new `missingSentences` field is added (`specVersion` 1.300.0).

**Real-project batch.** At the user's request, Sonnet subagents ran the freshly compiled `ccut translate --force --align-fusion lines --llm provider:deepseek/deepseek-flash` over sandbox copies of six real projects (`/private/tmp/cuccut-lean-real-20260930/<project>-lines<N>.ccut`, kept). They are grouped by duration: < 5 min (opus 3.4 min), 5–20 min (dario 7.0, aisec 8.8, zhelite 5.3; the last is zh→en), > 20 min (godmother 23.9, stanford 34.3). The sandboxes were copied from the original projects by script, and `trans / transDisplay / transAlign / transSrc[lang]` were **stripped by hand** so that translation runs from scratch. This is experiment preparation, not the product path; the product path relies on `--force`. Round one (`lines`) and round three (`lines3`) were clean sandboxes. Round two reused round one's directory, and the provider log reuse fed the old answers back in, so its numbers are void and are not listed.

Round three exposed three new classes of problem, all fixed in this round:

- *An echoed empty marker swallowed the whole tail*: on stanford page 7, after the model merged sentences 35 and 36 into one line, every following line began with this sentence's empty quote marker, but the body held the next sentence's translation (`|I..for| |it..towards| |the..but| |You..questions|我们问自己……`, “we ask ourselves…”). `quote_hits` also counted empty markers, so 31 sentences (starting at `s-wmty1w7j1-32`) received the next sentence's translation as a whole, and `ccut check` did not catch it. Fix: attribution looks only at **chunks with body text** (`quote_hits` filters out empty chunks, and Merged / Swallowed also skip empty chunks). When a chunk with body text is attributed to another sentence, `reattributed` strips the empty markers that do not appear in the target sentence, and this sentence is re-asked as missing. A five-sentence reproduction test was added. Round two had 0 empty-marker lines on the same page; round three had 46. The difference was the sentence I had added to the protocol, “write the chunk as it appears in the sentence; `|` stands for nothing”. That same sentence also triggered zhelite's whole-page copying of source text. It was replaced with “chunk body is always translation, never the source words of the quote; between two chunks keep only the spaces that the target language itself has”, and an example with unspaced source was added.

- *Whole-page copying of the source*: zhelite (zh→en) had three pages that came back on the first and second attempts entirely as `|其实他的生活换个|其实他的生活换个|…` (“actually his life changes into…”, with the Chinese source echoed in the chunks). Only the third attempt's residue of 58 sentences was English. Round two had only 2 instances in the same project. The protocol wording was changed as above. Two further half-translated sentences (`s-g24.0`, mixed Chinese and English; `s-g111.0`, containing `technical sales，想当 product manager。`, “technical sales, wants to be a product manager”) passed the script's proportion gate. A new `untranslated_run` check was added: when the source is ideographic (Han / kana / Hangul) and the target is non-CJK, the translation is flagged `translation-source-copy` if ≥6 consecutive ideographic characters from the source are copied verbatim (`TRANSLATION_VALIDATOR_VERSION` 2 → 3; other script pairs do not run this rule). Cases like `s-g24.0` are now caught. `s-g111.0` has only two characters left, so it is not caught; this is recorded as is.

- *Repetition-guard false positives*: `how-claude s-g24.0` has a source `caring about … and caring about` that repeats twice, and the translation's two chunks `那么在意对话记录` (“so caring about the conversation log”) / `、那么在意` (“, so caring about”) were rejected. The original exemption required the two source segments to be nearly identical (≥80% shared). It now allows either ≥80% shared, or ≥2 units with ≥40% of the shorter segment.

The chunking was also adjusted. When the source is written without spaces and there is no punctuation within the piece, it splits by even character count rather than scoring by clause-initial words. Chunking does no word segmentation, so in long sentences such as zhelite's, piece markers still fall inside a word (`发|现`, `薪|资`, split inside the words for “discover” and “salary”), and English line boundaries become awkward (`from another | angle`). The fix is either to add word segmentation or to relax “no quote may span `¦`”. Neither was done this round.

**Round four (`lines4`, six projects with fresh sandboxes) exposed four issues. They were fixed the same day and re-parsed with the same batch of model answers (`lines4s`, provider log reuse: the five English-source projects made 0 new calls; zhelite's piece markers changed, so it was re-sent 4 times):**

- *Trailing context translated in*: on stanford page 1, the model's last sentence (`s-wmty1s40b-53`) also translated the `# after` context line into the last line, as one chunk `|You..launched|你当时就在起点上……` (“you were right at the starting point…”). The quote could not be located within this sentence, so the sentence had no cut point. The rewrite round was rejected for content drift, and in the end the deterministic split copied the next sentence's translation into this one (round three had the same problem on this sentence). Fix: a chunk with body text whose quote hits no sentence on the page but hits a context line is dropped (warning `content-ignored`). If only such chunks remain on a line, the sentence is re-asked as missing. After re-parsing, this sentence has all 3 chunks located, `llm-lines+anchor/1`.

- *Latin word seams glued together*: in godmother `s-g26.0`, the model split at `University ¦ of Toronto`. The seam cleanup, which followed the rule “a CJK target keeps no space”, joined it into `Universityof`, so the stored translation was wrong. Fix: when both sides of a seam are spaced letters or digits, one space is kept. Scripts that are written without spaces (Thai, Lao, Myanmar, Khmer, Tibetan) are excluded; unlisted scripts are treated as spaced.

- *Punctuation-only chunks*: four aisec sentences (`s-g1.31` and others) had the model write chunks such as `|than..children|，` that contain only one punctuation mark. After joining they became `，，` / `、，` (doubled punctuation). Fix: a punctuation-only chunk is merged into the previous chunk, and if the previous chunk already ends in punctuation, the extra one is dropped.

- *Numbers split by piece markers*: in zhelite, `二十 ¦ 七岁` (“twenty | seven years old”) made the model write `twen- ty-seven`, and `已 ¦ 经` (“already | past”) across sentences became `al-` / `ready`. Fix: no source is split between two digits or number words. In scripts without spaces, the search window falls back to half a piece length. Widening it to the whole piece length made the splits very uneven: single chunks exceeded the line budget, rewrites were rejected, and sentences fell back to deterministic splitting. zhelite's round four had 13 deterministic sentences against 5 in round three, and the extra ones came from this. The cross-sentence `已|经` is an ASR sentence boundary that falls in the middle of a word; it is not a chunking matter.

**Round one of the six projects (`lines`, the first real run after the production wiring at `e24acd607`, before the Codex re-test and all of this round's fixes) → round four (`lines4`, a real run with the code at `f1590ab3b`) → re-parse (`lines4s`, with the four fixes above).** Call counts count only `translate-lines` (rewrite rounds and `brief` are counted separately). The short calls 1–2 seconds after each page are the wave-2 per-sentence re-asks, not whole-page retries; all calls in the six projects were `attempt` 1, with `retryReason` empty. Tokens are wire usage (the prompt includes cache hits). The alignment column is the distribution of `TransAlign.aligner`: `-` is a single line that needs no splitting; the rest are, in order, `llm-lines+anchor/1` / `llm-chunk+anchor/1` / `deterministic/1`. “Display rewrite” is the number of sentences whose stored translation differs from the display line (`DISP` in `lr-dump`).

| Project (sentences) | Round 1 calls · prompt+completion · `-`/lines/chunk/det · display rewrite | Round 4 | Re-parse |
| --- | --- | --- | --- |
| opus (39) | 1 · 3,873+1,485 · 4/26/8/1 · 0 | 1 · 4,908+1,493 · 5/28/5/1 · 1 | same as round 4 |
| dario (92) | 3 · 11,352+2,620 · 52/35/1/4 · 0 | 2 · 8,371+2,500 · 49/37/2/4 · 1 | same as round 4 |
| aisec (84) | 3 · 10,215+2,810 · 29/49/4/2 · 0 | 2 · 8,067+2,784 · 27/53/4/0 · 1 | 27/55/2/0 · 1, 0 instances of `，，` |
| zhelite (60, zh→en) | 5 · 19,705+3,718 · 14/36/0/10 · 0 | 3 · 11,631+3,576 · 13/33/1/13 · 0 | 7 · 26,568+7,624 (of which 4 new calls) · 13/38/0/9 · 0; 0 hyphenated word breaks, 0 leftover Chinese characters in the translation |
| godmother (326) | 5 · 24,530+7,321 · 177/103/40/6 · 5 | 6 · 28,254+7,940 · 175/127/18/6 · 5 | 175/128/18/5 · 6; `s-g26.0` becomes `University of Toronto` |
| stanford (443) | 11 · 49,774+11,244 · 233/153 (+4 old `llm-rows`)/35/18 · 8 | 8 · 42,609+11,488 · 230/163/36/14 · 3 | 230/164/36/13 · 3; `s-wmty1s40b-53` becomes 3 chunks `llm-lines` |

All six projects in round four returned rc 0, with 0 provider errors and 0 retries. `translate-lines` had 0 first lines consisting only of empty markers and 0 pages copying the source. The round-one stanford page-7 whole-block misalignment and the zhelite whole-page copying did not recur in rounds three or four. Zhelite's 10 deterministic sentences in round one came from the parsing before round three (3 pages + 2 per-sentence re-asks). Round four's 13 sentences came from an overly wide piece-search window, which has been reverted above, and the re-parse is back to 9 sentences. What remains are English-line sentences where `hard` 42 is too tight, single chunks exceed the budget, and rewrite rounds are rejected. From round five either the line budget should be relaxed, or the rewrite round should receive the piece hint; this is unrelated to the carrier. The extra prompt tokens in round one compared with round four are mainly due to more per-sentence re-asks (stanford: 7 pages + 4 re-asks against 8 calls in round four; zhelite: 3 + 2 against 3). The 4 `llm-rows+anchor/1` sentences in stanford round one were leftover old `transAlign` entries that the sandbox preparation had not fully stripped at the time. They are not output of this carrier (the round-three and round-four preparation scripts strip `transAlign`).

**Sentence-level content review by subagents, report only, not fixed (round-five candidates; disposition in §8.5):** Almost all of the deterministically split sentences have piece boundaries that fall inside a word or are hard proportional cuts (godmother `s-g64.6`, split inside `成‖为` (“become”); stanford `s-wmty1s40b-87`; dario `s-g76.0`, where the piece is off by one line as a whole; opus `s-g84.0`, which dropped `in settings JSON`). A few `llm-lines` sentences also cut mid-phrase (stanford `s-g93.0`, `不‖在`; godmother `s-g62.11`, `一‖样`; aisec `s-g33.19`). These are matters for the placement of `¦` and for `plan_sentence_at_cuts`, not for parsing. The model's own mistranslations and additions or omissions (godmother `s-g92.0` renders advised as its opposite; `s-g106.16` adds a personal name; `s-g81.14` has a typo; dario `s-g99.0` adds a surname; `s-g56.0` repeats “在你身后” (“behind you”); aisec `s-g11.0` repeats “分析输出” (“analysis output”) within one line; the word order of four aisec sentences such as `s-g33.0` follows the source too rigidly; opus `s-wmuetbszu-20` has English word order; `s-g92.0` renders “同时” (“at the same time”) as “一次” (“at once”)) are things the carrier cannot catch, and only the content blind review can see them. Zhelite's long-sentence `¦` markers still fall inside words (`发|现`, `薪|资`, about 22 instances), which needs word segmentation. `ccut check` has no gate for “a whole sentence mistranslated”. The `polish-fallback` blocking (stanford, 9 sentences in zhelite) is a pre-existing issue on the polishing side. One more observation: when a sandbox already has `transAlign`, `translate --force` reuses the old alignment entries, and a translation that only changed punctuation is still reused, so `pieces` does not match `trans` when joined. For this reason, all re-parsing in this round was done on copies with the translation stripped (`lr-rerun-clean.py`). On the product path, users will generally not edit `lines_translation` and then run `--force`, but this is noted for later.

### 8.5 2026-09-30 Round 5: in-block splitting for over-limit lines, pairwise repair without regression, and all three `¦` placement alternatives rejected

**`hard` 42 unchanged; what changed is how over-limit lines are handled.** The deterministic split sentences left at the end of round 4 (32 sentences across six projects) were mostly English lines where `hard` 42 is too tight, sentences where the model wrote one block too coarsely, and sentences that the rewrite round had then rejected. Loosening the budget would make every line longer and affect all target languages at once, so the budget stays and one more step is added to the ladder (`183a3a844`, `specVersion` 1.301.0): when the model's cut points are all allowed, but some monotone block still exceeds `hard`, first pick a cut **inside that block**. The cut must be a target seam that is lint-clean, leaves both sides ≤ `hard` (when equally qualified, prefer both sides ≤ `fit`, then the seam cost, then the seam closer to the block midpoint), and is not crossed by a hard anchor. Split the block in two there and store it. `aligner` writes `llm-lines+split/1`, and the advisory records `with N over-hard block(s) split at a lint-clean target seam`. Evidence outside the block stays byte-for-byte unchanged. Source breaks inside the split block are snapped, near the proportional landing point, to source-side punctuation, pauses or legal seams (`choose_source_break`; the first draft wrote "taken proportionally", which was inaccurate). If there is no such seam inside the block, or if the sentence needs two cuts, it goes to `align-rewrite/1`. Round 7 (§8.7) changed seam selection to three tiers. The six projects were re-parsed with the same model answers (`lines4s` → `lines5e`, 0 new calls for English source): deterministic splits 32 → 2 (opus `s-g84.0` is deterministic both before and after; stanford `s-g304.0`; the first draft wrongly wrote "32 → 1", corrected after Codex re-checked), `llm-lines+split/1` 0 → 46, `llm-chunk+anchor/1` 63 → 45, rewrite calls 13 → 18 (+5, because sentences that previously fell through to deterministic splitting are now eligible for the rewrite round), displayed rewrites 12 → 13. `ccut check` on the six projects: alignment-class blockers 0 (the `polish-fallback` blocker on 9 zhelite sentences and 1 stanford sentence is on the polish side and was already there before this round). Warnings are counted per hit entry (not per sentence): `align-target-seam` 11 → 3, `align-source-seam` 24 → 15, `align-bilingual-anchor` 6 → 0, `align-source-fragment` 5 → 2, over `fit` (not over `hard`) 56 → 64 (splitting only guarantees ≤ `hard`; after the `fit` preference it dropped from 66 to 64), lines short of 15 → 16. The first draft mislabeled these warning counts as the metric for the 508-sentence replay and wrote "0 warnings"; both were corrected. 508-sentence replay: first-pass alignment 412 → 440, pending rewrite 67 → 38, coarse blocks 52 → 30.

**Pair-line repair must not replace model alignment with a no-model split.** After splitting shipped, `lines5c` showed 4 sentences regressing. In the pair-repair batch for the table carrier, one `align-edge-ordinal` error sent every batch member to `fallback_word_entry` (`deterministic/1`), and the acceptance check compared only the resident shape, so `deterministic/1` displaced the original `llm-lines+split/1`. A gate is added: a candidate is rejected when the baseline is not stale, the original entry was model-produced (`aligner` starts with `llm-`), and the candidate is not model-produced. The rejection reason is `model-free` (the closed rejection set is `no-write | rewritten-basis | model-free | not-improved`). In `lines5d`, all 4 sentences returned to their original alignment.

**Codex re-test of `a4cd6ebcc`:** P2 (the restatement gate rejected `critical, critical`) was fixed in round 4. The two P1s (shared-endpoint trimming, and a hard-anchor conflict voiding the whole segment) were not measured this round. Round 6 (§8.6) changed both after measuring them on the 508-sentence replay, and the AMD `s-g107.0` `perfectly` fixture was pinned into tests. Another sentence newly rejected in round 5, `open-models s-g51.0` (`|And..US|而这目前主要是通过美国和欧洲的模型，|and..Europe|美国和欧洲模型，|…`), had the model write the same phrase twice at a quote seam. The `translation-chunk-repeat` rejection is correct and was pinned as a test. The cross-block "source self-repetition" exemption was also extended with a `seam_repeat` criterion.

**`¦` placement: three alternatives, each run for real on zhelite (the only one of the six projects whose source is written without spaces; all 508 sentences are English source), each with 3 new `translate-lines` calls. All were rejected, and the code returned to deterministic placement.** The cause was the piece marker landing inside a word, observed in round 4, which made English line boundaries look awkward. Real runs confirmed that the model copies the piece markers it sees verbatim: in `lines5e` and `lines7`, 100% of the 183 block starts land on piece markers. This is how `|毕业以后进|and after graduating entered |入美国大厂当了五|a big US tech company and spent five |年程序员|years as a programmer` came about. (1) *Snap to the host's source-side seam* (`lines6`: the `lines` carrier also counts as a source group for `rows`, and within the window piece markers prefer group starts). zhelite's word timings are interpolated. Of its 1895 words, only 8 have ≥0.35 s of silence (4 of them not after punctuation), so group starts are in effect the budget cut points of the source subtitle lines. Seventeen lines' piece markers moved, and by eye about half looked worse (cases like `他老|板` and `因为当时|需要`; no blind judgment was done). The `lines5e` → `lines6` alignment distribution was flat (deterministic 0 → 1, rewrite calls +1). (2) *The protocol allows the model to move a piece marker that falls inside a word to a word boundary, with examples* (`lines7`). 183/183 were still copied verbatim. The translation differences were only model randomness under the same piece marker (`rash|ly` also split one more target word), so this was ineffective. (3) *Show only the piece markers we are confident in (after punctuation, before subordinating conjunctions), and leave the rest to the model to cut itself by `≥k`* (`lines8`). The model cut only at the shown markers, and block starts fell 183 → 89. The blocks grew and went over the limit: `llm-lines+anchor/1` 38 → 18, `llm-lines+split/1` 9 → 20, `llm-chunk+anchor/1` 0 → 4, deterministic 0 → 5. Clearly worse. I also checked whether the seam table in `seam.rs` could score midpoint cuts. The table holds function words (dangling conjunctions, clinging particles, weak trailing adverbs), while the observed landing points were all inside content words (进入, 薪资, 已经, 好像, 女生, 自己, 护送, 这些, 老板, 怎么), and the table caught none of them. Two deterministic rules are kept: for source written without spaces, within the window take the start point of a subordinate conjunction (`CUT_BEFORE_CJK`, `或 ¦ 者` → `¦ 或者`, which the model follows); and never cut between two numbers or number words in any source (already in round 4). The final code's piece-marker placement is the same as `lines7`, and the protocol body is the same as `lines5e` (the ineffective wording was restored). The two parts were each verified separately and not run combined again: `lines5e` → `lines7` alignment is flat (`llm-lines+anchor/1` 38 → 39, split 9 → 8). This round's trade-offs were judged by aligner distribution and citation landing points; no blind-judgment subagent was dispatched. The only root fix left is word segmentation (not done this round; round 14 added a dictionary-segmentation gate, see §8.14). The sandboxes for the three alternatives (`zhelite-lines6/7/8.ccut`), the wire logs, and the `lines7-pieces.txt` / `lines8-pieces.txt` comparisons are all kept.

### 8.6 2026-09-30 Round 6: Codex's two P1s measured on the 508-sentence replay, both changed

**Both are parse-side changes; the protocol and `specVersion` are unchanged.** (1) Shared endpoints are no longer trimmed. When the envelopes of two adjacent blocks overlap (the previous block's RIGHT equals the next block's RIGHT or vice versa, plus any larger crossing), both are kept as quoted. `Evidence.overlapping` only counts them (advisory `N overlapping quote hull pair(s) kept as crossing evidence`), and `safe_boundaries` already offers no cut points inside the overlap zone. The premise of trimming, that "the shared endpoint is a copy error by the model", mostly does not hold on real data (Chinese fronting of adverbials produces shared endpoints), and the cut points that trimming produced left the left line carrying words from the right line's time window. (2) A hard-anchor conflict no longer voids the envelope. An anchor's source word falling outside some block's envelope only means the quote was written too narrowly on that side, not that the quote is unusable. The envelope and the anchor are both kept as edges, and only `Issue::AnchorConflict` is recorded. Previously this judged the whole block undeterminable, which let through a cut point two blocks away (`World| Labs`).

Four variants were replayed on the same 508 sentences (10 pages, DeepSeek answers stored in round 7; historical replays were re-judged under the mapping of that time, with the per-page mapping assertions unchanged; 0 new calls; `scratchpad/p1-replay.py` / `p1-diff.py`, output in `/private/tmp/cuccut-lean-p1-20260930/<variant>/`):

| Variant | First pass aligned / pending rewrite / coarse blocks | Merged aligned / pending rewrite | Synthetic counterexample false-safe (Codex 4 cases + 100 two-block endpoint combinations) |
| --- | --- | --- | --- |
| V0 `f3e8735f4` | 440 / 38 / 30 | 501 / 6 | 20 / 100; cases 3 and 4 cut `[4]`, case 5 `[11,16]` |
| V1 trimming removed only | 440 / 38 / 30 (2 sentences each lose one false-safe cut point) | 501 / 6 | 0 / 100; case 5 still `[11,16]` |
| V2 keep conflict envelopes only | 445 / 33 / 25 | 503 / 4 | 20 / 100; case 5 `[16]` |
| V3 both (landed) | 445 / 33 / 25 | 503 / 4 | 0 / 100; case 5 `[16]` |

V1 removes two cut points: `s-wmulx1t0s-40` `在今年早些时候融了|一大笔钱` and `s-g107.0` `完美地描述了|那项…`. The other 5 lines Codex named were trimmed anyway, and the target lint rejected those trims, so removing trimming loses not one sentence among the 508. V2 gained 5 extra sentences in the first pass (`s-g30.0`, `s-g35.1`, `s-g174.0`, `s-wmtpax7ia-92`, `s-g154.6`). Four of them were cut correctly. `s-g30.0` fell into the split ladder, where the seam was picked at `看到什|么机会` (the comma seam exceeds `hard`, leaving only character-level candidates; under V0 this sentence went to the rewrite round). This is a gap in the split ladder's seam selection, handled in round 7. Among the first-pass block changes in these 5 sentences, `s-g49.0` and `s-g52.13` improved, `s-g65.0` was flat, and `s-g44.14` is a model slip. The merge's extra `s-g255.0` fixed `World| Labs`. The oracle for the 100 endpoint combinations is `safe_boundaries` under full membership, and V3's set of cut points is a subset of it. The model's real slip `|I..world|我劝她|joining..world|` loses only its own cut point (a 12-character block does not exceed `hard`). Tests: `an_anchor_conflict_keeps_the_hull_and_the_anchor_as_edges`, `shared_endpoint_quotes_keep_both_hulls_and_refuse_the_cut_between_them` (including the AMD `s-g107.0` fixture), and `two_quoted_hulls_never_admit_a_cut_the_full_membership_refuses`. Round 5's six-project re-parse was not run this round (running it alongside the four-project real runs would collide on the same Runtime). The four-project real runs were done on this version of the code (§8.7).

### 8.7 2026-09-30 Round 7: four real projects run in batch, in-block splitting moved to three-tier seams, `¦` echoes turned into cut hints, and the restatement exemption switched to a target-side criterion

**Real runs of four recent projects (round-6 code; one Sonnet subagent per project, in parallel; DeepSeek Flash; `rows` and `lines` once each; `translate` without polish; the sandbox is a copy with `trans / transDisplay / transAlign / transSrc[lang]` stripped).** Wire-count tokens (input + output): pm (31 sentences) `lines` 4,875 vs `rows` 8,971; altman (248 sentences) 75.8k vs 140.1k; grok (337 sentences) 54,349 + 25,853 vs 128,824 + 45,502; brockman (283 sentences) 81.7k vs 128.0k. Wall-clock: grok 68 s on both sides; brockman `lines` 46.2 s vs `rows` 37.1 s, so `lines` was slower (what it saved was tokens, not time: fewer pages, but each page was longer, and the rewrite rounds queued behind it). Problems the subagents reported: brockman had 59 entries `lines draft leaves a N-unit block over hard 20 … rewrite turn`, 3 `align-rewrite` calls, and 40 displayed rewrites of sentences. The two page answers copied `¦` verbatim into the translation (180 echoes in the wire for brockman, 75 for grok). After parsing stripped the piece markers, double spaces were left between CJK characters (57 brockman sentences with `trans` containing spaces, e.g. `C++  或`), which also left the block with only one. Godmother `s-g50.10` had one block spanning two timestamps. The `seam_repeat` exemption let through `it; it` (a Codex probe). Single-word sentences such as `Dottie.` and `Okay` were rejected by `translation-source-copy`.

**Changes (all on the parse side; protocol and `specVersion` unchanged):**

1. In-block split seams come in three tiers (`SplitSeam`): `backed` has punctuation, or whitespace between words, and is lint-clean; `model-hinted` is a cut the model gave itself; `character-level` is only a per-character seam that lint did not reject. The tier comes first; within the same tier, prefer both sides ≤ `fit`, then compare the seam cost and the distance from the block midpoint. Model cut points come from two sources: quoted block boundaries, and the `¦` the model copied into the translation body. `Chunk.marks` records its position within the block (normalized unit offsets, `#[serde(default)]`, so old manifests still parse), and `cut_hints` synthesizes hints. A hint snaps forward to the nearest atom start (only whitespace and punctuation in between). Objective grammar-error cases (dangling tail, weak tail, clinging head) are accepted, since that cuts better than per-character; broken noun phrases, list separators, unclosed delimiters, and positions inside locked terms are still not accepted (`hinted_cut_candidates`). The advisory is now `split in place at N backed, N model-hinted, N character-level seam(s)`, and the replay's grade records `splitSeams` per sentence. Sentences with a hint but no evidence cut accepted by any candidate also enter the ladder, but **without character-level seams**. If the hint cannot snap, the sentence is left for the rewrite round (how-claude `s-g33.0`, `软|件产品`-type cases, was taken by a character seam in the first draft; the gate was added after review). A sentence that needs two cuts still cannot be split (AMD `s-g30.0`: a block already split once has only one edge per half, and `split_edges_at` cannot judge a second cut). This is recorded as a known limit in the tests.
2. `¦` echoes: after stripping, they are kept as cut hints. The whitespace around a piece marker collapses to one space, and no space is kept when both sides are CJK characters (`split_piece_marks`). Piece markers inside quotes are stripped but give no hint. Piece markers at line start are also stripped. `marker-residue` counts by raw answer line.
3. The `seam_repeat` exemption switched to a target-side criterion. When the last word of the previous segment equals the first word of the next, the exemption applies only if the longer block's length beyond the two blocks' shared units is at least the shared length (`beyond_shared >= shared`). `|This..critical|这至关重要，|critical..project|对整个项目至关重要。` is let through, while `|The committee rejected it;|委员会否决了它，|it was very expensive.|委员会否决了它。` is still rejected. Codex's four probes were pinned into tests. The earlier source-side unit-count scheme (both segments longer than the shared part) was calculated, found not to hold, and was not shipped.
4. `translation-source-copy`: when the source has only one word written with spaces in a spaced script (`spaced_script_letter`, excluding CJK, Thai, Lao, Burmese, Khmer and Tibetan), copying it verbatim does not count as copying.
5. The round-5 design note's "source break inside a split block taken proportionally" is corrected to "snapped, near the proportional landing point, to source-side punctuation, pauses or legal seams" (which is what `choose_source_break` already did).

**508-sentence replay (0 new calls):** first-pass aligned / pending rewrite 445 / 33 → 456 / 22 (three-tier seams) → 453 / 25 (after adding "hint-only, no character-level seam", the three sentences sent back, how-claude `s-g22.0`, `s-g33.0` and `s-g45.0`, are all character seams). Merged 503 / 4 → 506 / 1, `translationRetries` 1, accepted translations 507. Of the 8 newly aligned first-pass sentences, 4 were `backed` (amd `s-g122.0` and `s-g273.0`, open-models `s-g138.0` and `s-g144.7`) and 4 were `model-hinted` (amd `s-g141.0`, `s-g154.0` and `s-g180.0`, open-models `s-g8.0`). Split seams by tier: 16 `backed` / 12 `model-hinted` / 6 `character-level` (33 sentences). I read through the 10 first-pass block-changed sentences one by one. The model hints replaced within-word seams such as `这|项`, `机|器`, `优|秀`, `转|变` and `就|是` with word boundaries. A counterexample is amd `s-g75.0`: the comma seam `4D 一致性，|` has one side at 18 > `fit` 16, and it lost to the hint seam `…并让摄像头 | 和智能体…`, which fits both sides but is flagged by lint as "starts with a coordinating conjunction" (see below). Conversely, the brockman echo example `我认为，|` (4 / 20) losing to the hint `…创造价值 | 的空间` follows the same rule. Godmother `s-g50.10` is not something splitting can fix (the model wrote one block spanning two timestamps), so it is recorded as the boundary of `split/1`.

**Re-parsing the four projects with the same answers (`lines` → `lines8`, 0 `translate-lines` new calls; the over-limit blocks changed, so the `align-edges` / `align-rewrite` requests differ, and each issued new calls: altman 1 + 2, grok 2 + 2, brockman 2 + 2, pm 0):**

| Project | `split/1` | `llm-chunk+anchor/1` | Deterministic | Over-limit advisory | Displayed rewrites | CJK double-space sentences | `check` blocker | `align-target-seam` entries | Over-`fit` entries | Rewrite + edges call tokens (input / output) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| pm | 1 → 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 → 1 | 2 → 2 | no new calls |
| altman | 19 → 26 | 21 → 14 | 2 → 2 | 14 → 8 | 6 → 5 | 0 | 1 → 0 | 3 → 12 | 26 → 25 | 8,114 / 7,204 → 6,973 / 5,861 |
| grok | 19 → 30 | 21 → 13 | 5 → 2 | 17 → 5 | 7 → 2 | 0 | 0 | 5 → 14 | 38 → 41 | 9,514 / 8,449 → 7,933 / 6,699 |
| brockman | 9 → 52 | 56 → 18 | 6 → 1 | 59 → 12 | 40 → 0 | 57 → 0 | 0 | 1 → 6 | 23 → 28 | 15,367 / 14,889 → 7,447 / 5,960 |

brockman is the strongest group. The rewrite round went from 3 calls at 13.2k / 14.0k tokens to 2 calls at 4.7k / 4.3k. The 40 displayed "verify no meaning shifted" rewrites dropped to zero. The `trans` text changed for 57 sentences (after removing whitespace, each matches the original sentence by sentence; all are double-space fixes). Rewrite request bodies went from 3 calls totaling 35.6k characters to 2 calls at 14.8k. The cost of the "hint-only, no character-level seam" gate across the four projects (`lines7` → `lines8`): `split/1` altman / grok / brockman 28 / 30 / 54 → 26 / 30 / 52, `llm-chunk+anchor/1` 10 / 15 / 15 → 14 / 13 / 18, rewritten sentences 3 / 1 / 2 → 5 / 2 / 0. The cost is that warnings such as over-`fit` and `align-source-ceiling` (brockman 23 → 27) rose slightly, because the rewrite round used to shorten sentences and now direct splitting stores them. The wall-clock of the re-parse (altman 39 s / grok 47 s / brockman 36 s) covers only the few new calls and cannot be compared with full runs.

**Pending decision: conflict between model-hinted seams and lint.** Across the four projects, 35 `model-hinted` split sentences produced 28 `align-target-seam` entries (grok `s-g17.0` has two entries in one sentence; the four-project entry total went 9 → 33). The three classes of grammar problem that hint snapping lets through (all forms of dangling tail and weak tail: 「得」, "concurrent-style missing predicate" (兼语式缺谓语), "disposal-style missing predicate" (处置式缺谓语), "copula missing complement" (系词缺表语), "verb-complement missing object" (动补缺宾), "locative frame" (方位框架); and clinging heads that begin with the coordinating conjunction 和/及/与/或) are exactly what the `check` lint reports. Compared with how the same sentences were placed in round 6 (per entry): 16 entries were originally unsupported character-level seams, mostly cutting inside words (`存|在于`, `意识|到`, `以人为|本`, `晨间|简报`), and a few were themselves grammar-problem seams (`能|把`, `最|让人`). `check` cannot see within-word seams, so these look worse on the metric while reading as mostly better. 8 entries were originally via `llm-chunk+anchor/1` (one extra `align-edges` call, with clean seams: `另一件事 | 是我` → `是我自己个人的 | 插件栈`, `板块和领域，| 其实` → `板块 | 和领域`). 3 entries were originally deterministic splits. 1 was a comma seam (brockman `s-g371.0` `如果你，|`, a 4-character line). In the current ordering, anchored seams and hint seams share a tier and are compared by `fit` first. So a lint-flagged hint seam beats a clean punctuation seam with one side slightly over `fit` (amd `s-g75.0`). Conversely, the brockman echo example `我认为，|` (4 / 20) losing to hint `…创造价值 | 的空间` follows the same rule. Two questions are left for the user: whether clean seams should always take precedence over lint-flagged hint seams regardless of `fit`; and whether the permitted grammar-problem classes should be narrowed to dangling tails. This round's code stays as it is. `check` not seeing within-word CJK seams is a blind spot of the metric itself, and fixing it needs word segmentation. (User ruling: "clean seams always take precedence; only dangling tails are allowed", landed in round 8, see §8.8.)

The six-project re-parse (§8.5 `lr-rerun-clean.py`) was not run this round. The four-project sandboxes (`<project>-lines.ccut` / `-lines7.ccut` / `-lines8.ccut`), the wire logs, the subagent reports (`<project>-report.md`), and the replay outputs (`/private/tmp/cuccut-lean-p1-20260930/commitb*/`) are all kept.

### 8.8 2026-09-30 Round 8: clean seams always first, only dangling tails are admitted, refused hints also enter the ladder

**Ruling (user, on the two questions in §8.7):** Clean seams rank ahead of lint-flagged hinted seams regardless of `fit`; hint-snap admission for grammatical errors is narrowed to dangling tails. Replay once more after the change.

**Changes (parser side; protocol and `specVersion` unchanged):**

1. `SplitSeam` has four tiers: `backed` (backed by punctuation or inter-word whitespace and lint-clean) and `model-hinted` (a lint-clean model cut point whose seam cost is below the blocking penalty) share the first tier; `model-hinted-flagged` (carries a dangling tail, or is a model cut point that falls inside a word per the heuristic) comes next; `character-level` last. The sort key is now (tier, whether it exceeds `fit`, seam cost, distance from the block midpoint). Tier is compared first, then `fit`, so a hinted seam that fits on both sides but ends in 「的」 (possessive particle 的) no longer beats a comma seam that slightly exceeds `fit` on one side.
2. `cut_candidate_at(…, tolerant)` admits only `DanglingTail`. All weak-tail forms (「得」 complement tail, 兼语式 pivotal construction missing predicate, 处置式 disposal construction missing predicate, 系词 copula missing complement, 动补 verb complement missing object, 方位框架 locative frame) and sticky openers (coordinating-conjunction openers, clingy particles, locative suffixes) are no longer admitted; these hints are treated as refused.
3. The ladder's gate is opened by the **raw hints** (`cut_hints` non-empty), not by the candidates admitted after snapping. Sentences whose hints were all rejected by lint also enter the ladder, and clean `backed` seams remain usable as before. `character_allowed = !cuts.is_empty()` is unchanged, so sentences that enter the ladder only through hints still do not get character-level seams. In the replay of the version that only changed sorting and admission (`commitc`), amd `s-g122.0` and open-models `s-g138.0` each had a clean comma seam, but because their only hint was rejected, `hinted` was empty and the gate closed, falling back to a rewrite round. After the gate change, both sentences are back on `backed`. The advisory `N cut hint(s)` now counts the raw hints.
4. Expectations of two existing tests changed under the new rules. The PM sentence `有前景的 | 想法` changes from `Hinted` to `HintedFlagged`. In the brockman echo case, the comma seam `我认为，|` at 4/20 now beats the hint `…创造价值 | 的空间` (sticky particle 的 opener, no longer admitted).

**508-sentence replay (0 new calls):** first round aligned / to-rewrite 453 / 25 (round 7) → 448 / 30 (sorting and admission only, `commitc`) → 451 / 27 (gate fix added, `commitd`). After merge: 506 / 1 → 504 / 3 → 505 / 2. The extra sentence in the `commitd` merge (amd `s-g180.0`) is an artifact of the replay tool. It had already aligned with a `backed` seam in the first round, but the rewrite page for the replay was generated from the rewrite set of the original run and unconditionally overwrote the first-round result, so historical rewrite answers count as to-rewrite under the new rules. Following the production path (sentences aligned in the first round do not enter the rewrite round), it counts as 506 / 1. Seam tiers: 16 `backed` / 12 `model-hinted` / 6 `character-level` (33 sentences) → 19 `backed` / 3 `model-hinted-flagged` / 10 `character-level` (31 sentences). Round 7 → `commitd` changed 9 sentences, all originally `model-hinted`: 3 moved to `backed` (amd `s-g75.0` `4D 一致性，|`, `s-g45.16` `研究团队，|`, `s-g180.0` `这一直是AMD |` inter-word space seam); 2 went back to the rewrite round (amd `s-g154.0` `就是用 |`, open-models `s-g8.0` `大家觉得 |`; hint rejected, no evidence cut point); **4 fell to character-level seams**: ai-security `s-g40.34` `组合 | 是`, amd `s-g107.0` `这 | 项`, `s-g93.0` `前沿的机 | 器人` (original hint `工作流 | 和前沿`), `s-g165.0` `重视 | 是AI`. This is the direct cost of the ruling: rejected hints no longer block character-level seams, and `check` cannot see CJK intra-word seams.

**Four projects reparsed (`lines8` → `lines9`, same batch of `translate-lines` answers, 0 new calls; `align-edges` / `align-rewrite` new calls: pm 0, altman rewrite 1 (edges request unchanged, not resent), grok rewrite 2 + edges 2, brockman rewrite 2 + edges 2; `trans` text unchanged for all four projects, 0 sentences differ):**

| Project | `split/1` | `llm-chunk+anchor/1` | Deterministic | Over-line advisory | Shown rewrites | `align-target-seam` entries | Character-level seams | Over-`fit` entries | Rewrite + edges call tokens (input / output) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| pm | 1 → 1 | 0 | 0 | 0 | 0 | 1 → 1 | 0 | 2 → 2 | No new calls |
| altman | 26 → 24 | 14 → 15 | 2 → 3 | 8 → 9 | 5 → 3 | 12 → 6 | 3 → 5 | 25 → 26 | 6,973 / 5,861 → 2,341 / 2,212 |
| grok | 30 → 28 | 13 → 18 | 2 → 1 | 5 → 7 | 2 → 5 | 14 → 7 | 3 → 7 | 41 → 39 | 7,933 / 6,699 → 8,478 / 7,314 |
| brockman | 52 → 51 | 18 → 18 | 1 → 2 | 12 → 13 | 0 | 6 → 1 | 1 → 2 | 28 → 28 | 7,447 / 5,960 → 7,634 / 6,063 |

Across the four projects, seam tiers went from 74 `backed` / 36 `model-hinted` / 7 `character-level` → 86 `backed` / 12 `model-hinted-flagged` / 14 `character-level`. Where the 28 `align-target-seam` entries from `lines8` on `model-hinted` sentences ended up in `lines9`: 7 are dangling tails and remain `model-hinted-flagged` (pm 1, altman `s-g6.0`, grok `s-g17.0` / `s-g233.0` / `s-g321.0` / `s-g470.0`, brockman `s-g569.0`); 1 has a refused hint (grok `s-g569.0` `形容为 |`, disposal construction missing predicate), so the sentence was re-split at another dangling-tail hint `关系中的 |`, still `model-hinted-flagged`; 7 moved to clean `backed` seams (altman `s-g65.0` / `s-g131.0` / `s-g297.0`, grok `s-g232.0`, brockman `s-g252.0` `我认为，|` / `s-g371.0` `如果你，|` / `s-g392.0` `板块和领域，|`); 5 fell back to `llm-chunk+anchor/1` (one extra `align-edges` call each: altman `s-g17.8` / `s-g40.0`, grok `s-g133.0` / `s-g413.0`, brockman `s-g528.0`); 1 moved to deterministic splitting (altman `s-g248.0`); **7 fell to character-level seams** (altman `s-g142.0` `当我在 | 散步`, `s-g398.0` `意识 | 到`; grok `s-g17.0` `最 | 让人`, `s-g108.0` `格式完全 | 按`, `s-g311.0` `在聊 | 天里`, `s-g336.0` `工程主 | 管`; brockman `s-g422.0` `晨间 | 简报` in two places). Of these, `意识|到`, `聊|天`, `主|管` and `晨间|简报` are cut inside words. The 4 new `lines9` entries are all objective grammatical errors that lint already reported, now falling in other tiers (altman `s-g65.0` list separator, `s-g248.0` / `s-g382.0` dangling tail and 如何 in deterministic splitting, grok `s-g569.0` the dangling tail moved above). altman `s-g65.0` and grok `s-g84.0` (already in `lines8`) have `backed` seams after the list separator `、`, yet `check` reports `align-target-seam`. The split planner's seam lint and `check`'s lint disagree on list separators; "lint-clean" for `backed` refers to the former. brockman `align-source-seam` 12 → 15 and `align-source-fragment` 5 → 7 result from block-internal source breakpoints re-snapping to the new seam positions; these were not reviewed one by one.

**Conclusions and open items:** On metrics, `align-target-seam` across the four projects went 33 → 15, the 508-replay first round has 2 more sentences aligned, and four-project `split/1` has 1–2 fewer sentences. On readability, the share of clean seams rose from 74 / 117 to 86 / 112, at the cost of character-level seams doubling (7 → 14, 6 → 10), most of them cutting inside words. To stop cutting inside words, character-level seams need word segmentation (recorded in §8.7 as a blind spot of `check`), or a tier of "refused model hints" ranked ahead of character-level seams; the latter was done in §8.9. Re-parsing the six projects has still not been run. This round's four-project sandbox (`-lines9.ccut`), `table-lines8-lines9.txt` and the replay outputs (`commitc` / `commitd`) were kept in `/private/tmp` at the time, and were wiped by the system when the machine restarted on the evening of 2026-09-30 (see §8.9 “数据”).

### 8.9 2026-09-30 Round 9: refused hints form their own tier, ranked ahead of character-level seams

**Ruling (user, on the §8.8 open items):** Add a tier of "refused hints" ranked ahead of character-level seams; change and replay once more.

**Changes (parser side; protocol and `specVersion` unchanged):**

1. `SplitSeam` has five tiers: `backed` = `model-hinted` (same tier) > `model-hinted-flagged` (with dangling tail) > `model-hinted-refused` > `character-level`. `hinted_cut_candidates` now returns `HintedCuts { admitted, refused }`. Model cut points that the seam lint flags with objective grammatical errors other than dangling tails (the various weak-tail forms, sticky openers, noun-phrase incompleteness, list separators, unpaired brackets or quotation marks) go into `refused` instead of being dropped. Hints that fall inside locked terms go into neither. These categories come from the seam lint; which categories apply to which language is decided by the per-language implementation of the lint. When the lint reports none of a category for a language, `refused` is always empty for that language, and behaviour matches round 8.
2. Refused hints **do not count as admitted**. Like character-level seams, they are usable only in a ladder with evidence cut points (`unadmitted()` = `HintedRefused | Character`; when `cuts` is empty, both tiers are excluded). Sentences that rely only on hints to enter the ladder stay `NeedsRewrite` and go to the rewrite round. This follows "ranked ahead of character-level seams" literally: it only replaces the position that would otherwise pick a character-level seam, and does not admit any new sentences.
3. The advisory gets an additional label, `N model-hinted-refused seam(s)`. `ccut-translate.md` is synced to five tiers.
4. Tests: added `a_refused_hint_outranks_a_character_seam_but_never_carries_a_hint_only_ladder` (a hint ending in 「得」 outranks a character-level seam when evidence cut points exist, and is not used when only hints exist). The integration case for the AMD sentence changes from `Character` to `HintedRefused` (both model boundaries are rejected by lint, so it now cuts at the model boundary). Added an assertion that hints inside locked terms enter neither side.

**Data (important):** On 2026-09-30 at about 20:15 the machine restarted and `/private/tmp` was wiped by the system. All replay-page answers, project sandboxes and batch scripts from §8.1–§8.8 were lost. The 508-sentence page inputs were recovered from Codex's re-test evidence package; the round-7 raw model answers could not be recovered. So this round's replay uses **new call answers**: its numbers are not comparable with the 453 / 451 series of §8.6–§8.8, and this round's conclusions come only from comparing "the same new answers, two code versions" (old behaviour = round 9 code with the `refused` tier temporarily disabled, equivalent to round 8). Validation data moved to the external drive `/Volumes/ExtremeSSD/cuccut-lean-validation/` (`round9/`, `real/`, `scripts/`, `bin/`).

**508 sentences, new round (DeepSeek Flash; first round 10 calls plus 6 supplementary calls; first-round input 44,297 tokens of which 24,192 cache hits, output 16,868; supplementary input 18,265 of which 16,256 cache hits, output 723):** first round aligned 495 / to-rewrite 11 / pending translation 2; after merge 505 / 3. Both code versions give identical verdicts for this batch of answers (495 / 11, 505 / 3, `split/1` 44 sentences). Only the seam tiers changed: first round 32 `backed` / 2 `model-hinted-flagged` / 10 `character-level` → 32 / 2 / 7 `model-hinted-refused` / 3 `character-level`. The 7 changed sentences:

| Sentence | Old (character-level seam) | New (refused hint) |
| --- | --- | --- |
| amd `s-g93.0` | `…首个此类 \| 机器人仿真工作流和前沿的机 \| 器人策略训练模型。` | `…打造了 \| 首个此类机器人仿真工作流 \| 和前沿的机器人策略训练模型。` |
| amd `s-g52.13` | `…世界模型和物理智能 \| 这类下一件大事的边界。` | `…世界模型 \| 和物理智能这类下一件大事的边界。` |
| how-claude `s-g24.0` | `…每一次单独的工具调 \| 用和模型做的每一个决定，` | `…每一次单独的工具调用 \| 和模型做的每一个决定，` |
| how-claude `s-g36.1` | `…它能在几年 \| 甚至更长时间里一直存在。` | `…它能在几年甚至更长时间里 \| 一直存在。` |
| how-claude `s-g43.0` | `我该如何为这项在我脚下飞 \| 速变化的技术做开发？` | `我该如何为这项在我脚下 \| 飞速变化的技术做开发？` |
| how-claude `s-g60.0` | `我觉得我们 \| 把这些东西构建进 Claude Code 的框架里——` | `我觉得我们把这些东西 \| 构建进 Claude Code 的框架里——` |
| how-claude `s-g115.0` | `所以我觉得这就是我们经 \| 历这个转变的起源故事，` | `所以我觉得这就是 \| 我们经历这个转变的起源故事，` |

4 sentences were originally cut inside words (`机|器人`, `调|用`, `飞|速`, `经|历`) and are now at word boundaries. The other 3 were already at word boundaries in both versions. The remaining 3 character-level seams (amd `s-g165.0`, `s-g248.0` `共 | 同`, `s-g251.0` `都 | 是`) lie in blocks where the model gave no hints.

**Four projects (`lines10`: copied read-only from the user's projects with translations removed and run from scratch; `translate-lines` 30 calls, `align-edges` 4 calls, `align-rewrite` 4 calls. The same answers were then reparsed as `lines10r8` (old behaviour) and `lines10r9` (new code). Both reparse runs made 0 new calls in every category, and `trans` text was identical sentence by sentence):**

| Project | `split/1` | `llm-chunk+anchor/1` | Deterministic | Character-level seams | Refused-hint seams | `align-target-seam` entries |
| --- | --- | --- | --- | --- | --- | --- |
| pm | 0 | 0 | 0 | 0 | 0 | 0 |
| altman | 28 | 15 | 3 | 7 → 5 | 0 → 2 | 5 → 8 |
| grok | 32 | 21 | 1 | 6 → 2 | 0 → 4 | 7 → 11 |
| brockman | 14 | 5 | 1 | 2 → 1 | 0 → 1 | 1 → 2 |

Across the four projects, seam tiers went from 55 `backed` / 7 `model-hinted-flagged` / 15 `character-level` → 55 / 7 / 7 `model-hinted-refused` / 8 `character-level`. The aligner distribution is unchanged (774 `llm-lines+anchor/1` / 74 `split/1` / 41 `llm-chunk+anchor/1` / 5 deterministic). The 7 changed sentences: altman `s-g193.0` (`让我的 Dot | 或者别人的 Dot 来做后续跟进`), `s-g398.0` (`意识到我们 | 必须` → `意识到 | 我们必须`); grok `s-g108.0` (`配方提 | 取清晰的要点` → `…要点 | 和下一步行动`), `s-g311.0` (`…还是得 | 在聊天里说明…`), `s-g336.0` (`工程主 | 管` → `工程主管 | 和两个工程师机器人`), `s-g512.12` (`智能 | 体化` → `…间接的方式 | 或者说智能体化的方式`); brockman `s-g422.0` (`晨间 | 简报` in two places → `…因为我觉得 | 那个晨间简报智能体…`). 4 sentences were originally cut inside words or terms and are now at word boundaries; 3 sentences were at word boundaries in both versions.

**Cost: `check`'s `align-target-seam` across the four projects went 13 → 21 entries.** The 8 new entries all fall on these 7 sentences: 4 are coordinating-conjunction openers (`和…` / `或者…`), 2 are 「得」-ending, 1 is a pivotal construction missing its predicate, and 1 is a verb complement missing its object. This is the other side of the blind spot recorded in §8.8. `check`'s lint sees grammatical errors at word boundaries but not character-level intra-word seams, so replacing character-level seams with model boundaries raised the warning count. `因为我觉得 |` (「觉得」 is a verb, not the complement marker 「得」) and `意识到 |` are lint false positives, not changed in this round. Small fluctuations in other metrics (`align-overfit` 91 → 93, `align-paired-density` 91 → 90, `align-source-seam` 38 → 37) come from re-sorting after seam shifts; these were not reviewed one by one.

**Conclusions and open items:** Refused hints displaced all character-level seams where a hint was usable (508: 10 → 3; four projects: 15 → 8), without changing the alignment state or translation of any sentence. Remaining character-level seams lie in blocks where the model gave no hints (the four projects still have intra-word seams such as `举 | 措`, `团 | 队`, `创 | 造`, `发消 | 息`, `东 | 西`). Eliminating them still requires word segmentation. Two trade-offs are left for the user. First, refused hints no longer carry a hint-only ladder (those sentences go to the rewrite round); allowing it would admit a few more sentences but would land lint-refused seams in the store with no evidence cut point at all. This was not measured this round. Second, `check`'s warnings for refused-hint seams and the `--align-only` fix suggestions point back to the same seam; whether to downgrade the warning level for `model-hinted-refused` was not changed. Not done: six-project reparse, blind review; `polish` was not rerun (only translate was run).

### 8.10 2026-10-01 Round 10: the segment marker is written at the marker's opening

**Source:** The first en→ko run in the acceptance test of the Korean word-segmentation rework. The translation contained fragments of source markers (`하지만 AI 는 of..in 전통적인…`), and in the same sentence a piece of the translation was lost. `check` did not catch it.

**Shape:** The model treats the `¦` in the input as the opening of the next marker: `N |a..b|译文 ¦ c..d|译文 ¦ e..f|译文`. The parser strips an unescaped `¦` as an echo, so `c..d` lands in the previous block's translation, and the next block's translation is treated as a marker whose source word cannot be found. This is not specific to Korean. In an older en→zh run (altman, 40 of 446 lines) the same shape appeared, with 17 of 423 sentences carrying fragments. Another run in the same project had none; it showed a random offset across the whole page.

**Change (parser side; protocol and `specVersion` unchanged):** `reopen_markers` now reads this kind of `¦` as `|` before parsing line by line. All three criteria must hold: it is inside a translation segment (the preceding `|` pair is balanced); it is directly followed by a leading and trailing quote that can be found in **this sentence's** source text; and it is followed by `|`. Cut-point hints in the body text, and a `¦` echoed inside a quote, are left alone. The number of reinterpreted occurrences is recorded in a `MarkerResidue` warning.

**Result (DeepSeek Flash, fresh copies of the same batches rerun):**

| en→ko | Sentences | Translations with fragments | First round anchored | Fallback | Source coverage |
| --- | --- | --- | --- | --- | --- |
| Sample, before → after | 31 | 8 → 0 | 14 → 16 | 4 → 1 | 0.78 → 0.97 |
| altman, before → after | 423 | 69 → 0 | 237 → 281 | 65 → 6 | 0.77 → 0.97 |

After the change, the model no longer wrote lines of this shape (the two real runs gave different answers, so not all the differences in the table are due to the parser). On the parser side, the change is guarded by unit tests and a replay of 508 sentences: the old and new binaries scored each sentence identically, with 0 differences (495 first-round aligned / 505 aligned after merge, unchanged).

**Open:** `check` has no dedicated gate for "a translation contains fragments of source markers". For now, the parser prevents them from being produced.

### 8.11 2026-10-01 Round 11: strip outer punctuation of quotes by Unicode category

**Source:** In the multilingual acceptance fixture (`scripts/bench/fixtures/lean-carrier-acceptance-2026-10-01/`), the four Hindi-source sentences `hi-03`, `hi-05`, `hi-06` and `hi-07` all failed to locate their first-round quotes and went to `needs-rewrite`.

**Root cause:** Hindi sentences end with the Devanagari danda `।` (U+0964). The source atoms are written as `था।`, `है।`, `पहुँची।`, `भेजें।` and `गए।`, and the model, when quoting, dropped the full stop and wrote `था`. The "strip leading and trailing punctuation" level of `canonical()` uses a hard-coded character set: ASCII plus `，。！？；：—–…（）“”「」`. It includes `。` but not `।`. The `Glued` level needs two or more atoms, and the `Stem` level only recognises apostrophes, so all five levels fall through. The combining-mark segmentation is not at fault (`is_combining` covers Mn/Mc, and `पहुँची।` and `मंज़ूरी` are complete atoms in the list). A marker with several `..`, such as `|लेकिन..नहीं..था|`, is read by the existing convention as its two ends, so this is not a parsing defect either.

**Change (parser side; protocol body, request bytes and `specVersion` unchanged):** Whether an outer character can be stripped is now decided by `outer_punctuation`. For ASCII, the original table is kept (`,.!?;:"-()`; `#%@&/'*` belong to the word itself, so `50%`, `#3` and `students’` are not quoted as `50`, `3` or `students`). Beyond ASCII, characters are stripped by Unicode general category Pd/Ps/Pe/Pi/Pf/Po, except the curly single quotes U+2018–U+201B, which (like ASCII `'`) count as part of the word. Every non-ASCII character in the original table falls into these categories, so the new rule is a superset of the old one. As a result, `।` `॥` (Devanagari), `؟` `،` (Arabic), `¿` `«»` (Spanish, French), `։` (Armenian) and `、` (Chinese, Japanese) no longer block a quote.

**Two paths:** `lines/1` is available only through direct provider calls (`--llm agent` rejects it with `invalid_arg`), so the Agent path does not apply. The tolerance lives in the parser. The protocol body already requires only that whole words be quoted "as written in the sentence", so the prompt does not change. The `rows` carrier uses source word indices rather than quoting the source, so it is not affected.

**Repair-request half:** These four sentences are located in the first round after the change, so no repair round is needed. I also checked the production path. Sentences whose quotes cannot be located go, in production, to `align-edges/1` (source words carry indices, and the model can only pick an index; valid choices are guaranteed by construction) or to `align-rewrite/1`. They do **not** trigger another repair round for `lines`. The `fix` answers in the acceptance fixture come from the scoring tool `lean_carrier_grade`'s `render-fix` and exist only in replay. This round does not add a new production repair round for `lines`; whether to add one is left to the user.

**Result (zero model calls, archived answers re-scored):**

| Set | Before | After | Sentences changed |
| --- | --- | --- | --- |
| Acceptance fixture, 92 sentences, first-round aligned | 79 | 83 | `hi-03` `hi-05` `hi-06` `hi-07` change from `needs-rewrite` to fully located in both segments |
| Acceptance fixture, aligned after merging repair answers | 82 | 86 | Same as above. Three more sentences that were already aligned now get one more cut point: `hi-04` (`…lent Ravi yesterday \| belongs…`), `hi-08` (cut at `；`), and `ar-08` (the quote `اشترينا..الأرز` now matches the atom with `،`; `我们买了2.5公斤大米， \| 晚饭后还剩一半。` = "We bought 2.5 kg of rice, \| half is left after dinner.") |
| 508-sentence replay (`round9`) | 495 / 505 | 495 / 505 | 0 per-sentence differences |

The remaining 6 `needs-rewrite` sentences are all Thai-source (`th-01`…`th-06`). These are a segmentation problem, not a punctuation one. For `hi-07`, the translation “另一个版本” (“another version”) corresponds to source word `दूसरा`, which can mean either "second" or "another". The alignment is correct; whether the wording is apt is outside the scope of this round.

### 8.12 2026-10-01 Round 12: Thai-style text stored per word, with a Snap level for quotes

**Source:** After §8.11, the remaining 6 `needs-rewrite` sentences in the acceptance fixture (`th-01`…`th-06`).

**Root cause (not in the carrier):** In the document, a Thai phrase is one word. One phrase per sentence means one source word, so the block-count cap `words.div_ceil(2)` = 1. The fix is in segmentation and document construction, recorded in [`ccut-unspaced-script-segmentation-design.md`](ccut-unspaced-script-segmentation-design.md): new documents are split into words with ICU4X LSTM, and within a phrase, the word joins carry a "attached to the previous word" marker. Existing documents are not migrated.

**Companion change on the carrier side (parser side; protocol body, request bytes and `specVersion` unchanged):** The tokenizer's boundaries do not always match the words the model sees (for example, `นัทแต่` is glued into one word). On top of the five existing levels, quote matching gets a widest **Snap** level. When the quote, with whitespace removed, appears in the sentence, and the word(s) at the boundary fall inside a word that is "glued to a neighbour, containing text without spaces", the match expands to the whole word. Old documents, where one phrase is one atom, and text segmented by spaces will not hit this level (`cat` does not expand to `catalog`). `pieces_with_params` checks that the source is verbatim only for the Korean markers from before 0.5; Thai markers are not counted.

**Two paths:** `lines/1` is available only through direct provider calls, so the Agent path does not apply. `rows` uses source word indices and is not affected.

**Offline regression (zero model calls):** The 508-sentence replay `round9` first round and merged results (495 / 505) show 0 per-sentence differences. The 92-sentence acceptance fixture gives 83 / 9 in the first round and 86 / 6 merged, the same as §8.11, with the same per-sentence list. The archived answers were all requested against the old document (one phrase per word) and produced one block, so the 6 Thai sentences do not change on re-scoring. For real runs on the new documents, see §9 of the segmentation design doc.

**Limitation of the evaluation tool:** The acceptance page has no `data-budget`, so `chunk_hint` is always 1, and neither the first round nor the repair round shows "≥k" or `¦`. Under the old document, one word per sentence caps the output at 1 block. Under the new document, this limit no longer applies.

**Real run (second run, [changelog](../../changelog/core/2026-10-01-024011.md)):** With the budget injected per the production setup, DeepSeek Flash's first round on the new document got 8 / 8 `aligned`, and on the old document 3 / 8 (the other 5 became `sentence-level` after a repair round). `¦` comes from the tokenizer's word boundaries. Where segmentation is wrong, the model follows it and breaks the translation mid-word. Thai source without a length estimate gets block counts by word count, which tends to be too fragmented. Both points lie outside the carrier and are recorded in §8 of the segmentation design doc. The same run also fixed `clamp(2, 1)` from `chunk_hint` when there is one word per sentence (only the evaluation tool's repair page can trigger it).

### 8.13 2026-10-01 Round 13: `aligned` does not include a meaning check (`de-07` unresolved)

**Source:** Item 1 of the unresolved items in the acceptance fixture README: `de-07` (German→Chinese) was mistranslated in meaning but still judged `aligned`. `hi-07` (Hindi→Chinese) translated “第二版” ("second edition") as “另一个版本” ("another version").

**None of the three existing mechanisms catches this (fact):**

- `language_quality::translation_quality_issues` checks only script, copying, placeholders and over-short output. The recorded answers for both sentences return empty, pinned by the test `a_fluent_mistranslation_passes_the_script_gate`.
- `ccut translate --review` only hands the two document versions to `ccut review accept` for manual acceptance (`stage_review_locked` in `flows/translate.rs`). It does not look at content.
- The "content blind check" in §8.3 was a one-off offline subagent read-through, not a product path.

**Mechanism tried (only in the evaluation tool, not wired into production):** The first-round answer gets an extra line at the end, `? N …`, in which the model self-reports sentences where "the meaning is easy to get wrong and I am not confident" (who did what to whom, conditions, negation, numbers, polysemous words). Each flagged sentence goes through a further verification call that receives only the source text and the current translation, and replies line by line with `N ok` or `N fix <corrected full sentence>`. Acceptance fixture: 16 pages / 92 sentences, DeepSeek Flash, the same pages run 3 times independently, plus 1 baseline run without this line to measure tokens:

| | Run 1 | Run 2 | Run 3 |
| --- | --- | --- | --- |
| Self-reported sentences / 92 | 34 | 35 | 33 |
| Pages with no `?` line | 0 | 1 | 1 |
| `de-07` self-reported | yes | no | no |
| `hi-07` self-reported | no | no | no |
| Verification calls (out of 16 pages) | 11 | 10 | 11 |
| Sentences answered `fix` by verification | 5 | 2 | 1 |

- **`de-07` was not caught.** The 4 new runs (3 with the `?` line, 1 baseline): the first-round output no longer contains the extra condition "Anna receives the file" that appears in the recorded answer. But all 4 read the approved object as "the second edition / the owner of the second draft agrees" (the fixture's reading: management approves the second edition). Only Run 1 self-reported it. Verification answered `fix`, but the corrected sentence still says “第二稿的负责人同意” ("the owner of the second draft agrees"). That run fixed the model repeating the whole sentence twice. Feeding the recorded wrong answer directly to verification 3 times: all 3 answered `fix` and removed the extra condition, but all 3 kept “第二版的负责人同意” ("the owner of the second edition agrees"). Verification and translation are the same model, and both make the same misreading. (Inference, not checked by a native speaker: `der zweiten Fassung` read as genitive, and “第二版的负责人同意了” ("the owner of the second edition agreed") is also grammatical, though far less natural than the dative “同意第二版” ("agreed to the second edition").)
- **`hi-07`:** No run self-reported it. The recorded answer fed directly to verification 3 times returned `ok` each time. `दूसरा` itself can be read as "second" or "another". The verification prompt's rule "answer ok when both readings of the source hold" may have helped. The fixture's `required_facts` is the question-setter's reading, so this sentence is not a certain error.
- **Cost:** The `?` line adds about 132 tokens to each first-round input (16 runs total +2,112, about +9.7%) and +97…+135 output tokens (about +2%). Verification adds 10–11 calls per run (16 first-round calls), with about 4.3k input and 119–223 output tokens. Self-reporting covers about 37% of sentences, so the verification page is not "slimmer".
- The sentences answered `fix` by verification were not checked one by one for whether they were really wrong. `hi-05` (run 1), sampled, had the same meaning before and after the change, so it was a no-op rewrite.

**Only the reporting wording landed:** `ccut check` adds one info, `translation-meaning-unverified`, per language with `aligned` sentences (`{code, lang, aligned, message}`; it produces no `fix` and does not enter `next`). The summary line `align <lang>: …` ends with “意思未核对” ("meaning not verified"). The meaning of `aligned` is unchanged. `infos[]` is an open list, and past additions of info did not bump `specVersion`, so this one does not either. The `rows` carrier and the local Agent path are unchanged.

**Not resolved:** Self-report plus same-model verification cannot catch a consistent misreading. Directions to consider: use a different model for verification (cost: a second provider); back-translation comparison (again the same model); manual spot-checks of sentences with conditions or negation.

**Ruling (2026-10-01):**

- Keep this info. It is an info, and it is factually accurate. Removing it would bring back the misreading that "`aligned` = translated correctly", which is exactly why it was added.
- No semantic verification on the production path. Same-model verification failed 3/3 times. Switching models or back-translation would change the cost structure, so measure first. `de-07` is recorded as a known miss, and this info is the honest disclosure of it.

**Cross-model probe (2026-10-01, measured after the ruling; production path still unchanged):**

- Setup:
  - The verification prompt is the same as above (`VERIFY_SYS`). The input is the recorded wrong answers from the fixture.
  - The verification model is switched to Gemini, `gemini-pro-latest`, which resolved to `gemini-3.1-pro-preview`.
- Single-sentence forced verification, 3 runs each:
  - `de-07`: 3/3 answered `fix`. The corrected sentences were all “只有在管理层同意第二版后，才把文件发给安娜” ("only after management agrees to the second edition is the file sent to Anna"), removing both the misreading and the extra condition.
  - `hi-07`: 3/3 answered `ok`, the same as DeepSeek.
- Full fixture, 16 pages, 92 sentences, all submitted for verification (not relying on self-report), one run. Each of the 6 sentences it answered `fix` was checked one by one:

  | Category | Sentences | Examples |
  | --- | --- | --- |
  | Genuine meaning error | 3 | `de-07`; `ko-real` sentence 5, where `자루우동` (bamboo-steamer udon) was originally translated as “一根乌冬” ("one udon"); `hi-05`, where E-12 is written beside “已确认” ("confirmed") and the original translated it as "written above" |
  | Arguably a slight drift | 1 | `ja-real` sentence 8, with an extra “一直是” ("has always been") |
  | Unrelated to meaning | 2 | one stray `·`; one Korean→Chinese sentence with awkward phrasing changed to read smoothly |

  The same-model verification in §8.13 judged `hi-05` a no-op rewrite. Here it was caught.
- Cost: these 16 calls used 7.7k input tokens and 448 output tokens, plus 18.5k thinking tokens. Serial wall-clock time was 159 s.
- Conclusion: cross-model verification catches misreadings that same-model verification misses, so the direction holds. Putting it into production still requires a key from a second provider, the cost of thinking tokens, and a formal evaluation of the false-change rate (2 of the 6 sentences were non-meaning changes). This is not done in this round. Data and scripts are at `/Volumes/ExtremeSSD/cuccut-lean-validation/round12/meaning-xmodel/` and `scripts/meaning-xmodel.py`.

### 8.14 2026-10-01 Round 14: Chinese and Japanese `¦` only land on seams that dictionary segmentation breaks

**Source:** §8.5 rejected three alternatives and concluded that "the only real fix left is to wire in word segmentation." The round-12 gate for Thai-like scripts (`unsure_boundaries`: a seam that dictionary segmentation does not break gets no `¦`, see the segmentation design note §10) was not applied to Chinese and Japanese. §8.5 never tried dictionary segmentation, so this round runs that A/B.

**Change** (`lines_translation.rs` `unsure_boundaries`): a seam is untrustworthy when both sides are Han characters or kana and the ICU4X dictionary segmenter does not break there. The Thai rules then apply: within the window, pick a trustworthy seam instead; if the whole window is untrustworthy, search outward; if none exists, emit one piece fewer. Production rendering and parsing both go through `pieces_with_params`, so they stay consistent. Seams next to Latin words, punctuation or digits remain trustworthy as before; Hangul syllables are in neither family and are unaffected. The protocol body, request format and `specVersion` are unchanged; only where `¦` lands changes.

**Data:** production pages from two real projects, copied as-is and read-only, with production `data-budget`:

| Project | Direction | Pages | Sentences to align |
| --- | --- | --- | --- |
| skill8 | zh→en | 3 | 84 |
| tokyo | ja→zh-Hans | 8 | 188 |

Scorer r21b is the version before the change; r22 is this round. DeepSeek Flash, 2 runs per page per version, the two versions interleaved, 44 calls in total.

**Deterministic comparison:**

- Piece-marker counts are 1141 in both versions, and `≥k` totals are 1414 in both, so no piece was dropped for lack of a trustworthy seam.
- Counting in-word piece markers with the dictionary criterion: r21b has 359 (skill8 48/291, tokyo 311/850), r22 has 0. This number uses the same dictionary the gate uses, so it only shows the gate works; it is not independent evidence.

**Live runs:**

| | skill8 r21b | skill8 r22 | tokyo r21b | tokyo r22 |
| --- | --- | --- | --- | --- |
| aligned | 167/168 | 168/168 | 360/360 | 376/376 |
| needs-rewrite | 1 | 0 | 0 | 0 |
| sentences retried after format error | 0 | 0 | 16 | 0 |
| coarse | 6 | 2 | 0 | 0 |
| average chunk count | 4.45 | 4.46 | 5.25 | 5.20 |
| model chunk starts inside a word (dictionary criterion) | 80/547 | 8/560 | 401/1018 | 3/962 |

- **r21b tokyo's 16 retried sentences** fall across 5 of 16 responses, all `lines-syntax`: the source piece at the end of a line had no translation. In 8 of these sentences, the unpaired piece was exactly the second half of a split word (`集 ¦ まっています`, `鑑 ¦ 賞できます`, `誕 ¦ 生しました`): the model translated the whole word into the preceding piece, leaving the following piece with nothing to write. The other 8 sentences had in-word piece markers elsewhere on the same line. In r22, the same sentence `集 ¦ まっています` was written by the model as `|。` and was paired. This is an observation only; causation is not proven.

**Independent blind review:** the 60 sentences whose piece markers differ between the two versions were given to an Opus subagent. Left/right order was randomized, and the subagent did not know which side was which version. It counted in-word piece markers per word and chose the better side. Ties were not allowed: sentences with equal counts were ranked by severity (inside a word > stem|suffix > inside a proper name > prefix/suffix), and 0:0 sentences were decided by "cut after a function word." The subagent also listed 5 sentences it was least sure about. The left/right mapping of all 60 sentences was checked one by one: the two text versions in `key.json` and the piece markers re-rendered by the two evaluation tools match sentence by sentence.

| Language | Sentences | r22 better | In-word piece markers r21b → r22 |
| --- | --- | --- | --- |
| Chinese | 17 | 17 | 21 → 2 |
| Japanese | 43 | 43 | 105 → 34 |

The 34 Japanese cases remaining in r22:

| Category | Count | Examples |
| --- | --- | --- |
| Inflection / suffix inside a word (the dictionary itself breaks here) | 14 | `集\|まって`、`飾\|られ`、`食べた\|い`、`まさ\|に` |
| Inside a proper name | 10 | `国立科学\|博物館`、`ハリー・\|ポッター`、`麻布台\|ヒルズ` |
| Prefix/suffix split | 5 | `魅力\|的`、`お\|店`、`玄関\|口` |
| Numbers and counters | 3 | `2007\|年`、`1\|階` |
| Other | 2 | `牛\|たん`、`日本人\|と` (the latter should not count under the subagent's own rules) |

The classification was done by the author from context, not given by the blind review. The 2 remaining Chinese cases are `二十一万|Star` and `配|图`.

**Cost:** one extra dictionary segmentation per sentence. Rendering 284 sentences across 11 pages, 5 times each: 0.34 s vs 0.37 s, about 20 µs per sentence. Binary size: both evaluation tools (debug) are 15,335,808 B. The dictionary segmenter was already present, and the Thai gate already uses it; the production binary was not measured separately.

**Regression:**

- `cargo test --locked -p ccut-flow-core` passes. The new test `chinese_and_japanese_pieces_open_at_dictionary_word_boundaries` pins the `¦` of one Chinese and one Japanese sentence, before and after the change.
- Replay of 508 English source sentences: 495 in the first round, 505 after merging; unchanged sentence by sentence.
- Replay of `lean-carrier-acceptance-2026-10-01-915bfef13` passes.

**Not done:**

- Seams that the Japanese dictionary breaks between stem and suffix are still trusted, so this kind of piece marker can still land inside a word. Fixing it needs a separate rule for kana suffixes, or switching to a different Japanese dictionary. Not in this round.
- Seams inside proper names and between numbers and counters are outside this gate's reach (the dictionary breaks there).
- `々` and CJK extension-area Han characters are not in `is_unspaced_cjk_char`, so seams like `人 ¦ 々` still count as trustworthy.
- Per-character seams on the target side (end of §8.9) are a different matter: they cut the translation and are not affected.
- Only the direct provider `lines/1` path. The `rows` carrier and the local Agent path do not use piece markers, so this does not apply to them.

Data and scripts are in `/Volumes/ExtremeSSD/cuccut-lean-validation/round12/cjk-pieces/` and `scripts/cjk-pieces-ab.py`. Blind-review materials (`items.json` / `key.json` / `verdicts.json`) are in `judge/`.

### 8.15 2026-10-01 Round 15: piece markers do not land on the inner side of brackets or quotes

**Source:** In Codex acceptance `lean-carrier-acceptance-2026-10-01-9bb2a8f62`, Thai `th-05` was translated as `the word “ confirmed”`. The request was `คำว่า“ ¦ ยืนยันแล้ว`. In unspaced source text, an opening quote attaches to the end of the previous word (Thai `ว่า“`; in word-for-word Chinese or Japanese, `说“` (said “) and `画『` (drew 『)). The "after punctuation" score ranked highest, and an opening quote also counts as punctuation, so the piece marker landed after it. The model left `“` in the previous chunk and then wrote a space after it. Chunk-seam cleanup also let "keep the space if the model wrote one" take precedence over "no space after an opening quote."

**Change** (`lines_translation.rs`; protocol and request format unchanged):

- Seams on the inner side of brackets and quotes are not trustworthy (`inside_delimiter`, merged into `unsure_boundaries`).
  - Brackets (Ps / Pe) always count.
  - Quotes (Pi / Pf) have a direction that depends on the language (German `„…“`, Swedish `”…”`, German `»…«`). They count only when there is no whitespace between the two words, or when the quote stands alone as a word (French `« mot »`).
- Every piece must contain a letter or digit: after moving piece markers, `シャーロック ¦ ・ ¦ ホームズ` appeared, where the middle piece was only a `・`.
- At chunk seams, no space is left after an opening bracket or opening quote, or before a closing bracket or closing quote. If the model wrote one, it is removed (`opens_at_end` / `closes_at_start`, ranked before "keep the space if the model wrote one").
  - `“` and `‘` count as opening quotes only when preceded by whitespace, at the start of the text, or by unspaced text, so German `„Ja!“` is unaffected.
  - A `”` immediately followed by a letter of spaced text counts as a Swedish opening quote.
  - `«»` and `’` are not handled.

**Results:**

- The 508-sentence replay is unchanged sentence by sentence.
- Of 448 request lines across the two real projects, 2 lines changed, both Japanese: `ポッター』 ¦ や『`, and `小説『シャーロック ¦ ・ホームズ』 ¦ の世界を`. The total piece-marker count is unchanged.
- In the 9bb2a8f62 fixture, only th-05 changed score: `“ confirmed”` → `“confirmed”`; 92/92 aligned is unchanged.
- A synthetic Thai→English page was run 3 times; all runs were 6/6 aligned, and th-05 had no extra space.

**Still not done:**

- `・` counts as punctuation, so a marker placed after it scores highest; `ハリー・ ¦ ポッター` inside a proper name remains (the "inside a proper name" category in the §8.14 blind review). `・` is also used to separate parallel words, so the rule must first distinguish these two uses.
- Two sentences not accepted in the first round of the same report (target word order differs from the source; one source piece has no separate translation), hi-07 misreading the name `सारा` (Sara) as "all", and de-07 are only recorded.

See [`docs/changelog/core/2026-10-01-115443.md`](../../changelog/core/2026-10-01-115443.md).

## 9. Prompts and fixed costs

Once the input shrinks, the fixed cost per call takes a larger share, and it has to be handled as well:

- **Translation system:** the row-fusion section is about 3.5 KB (grouping, duration, reading-speed rules). Replace it with a minimal description of the head and tail references, permissions, escaping and failure feedback. The new size is measured at M0; do not presume it will be under 1 KB. The source-language terms, glossary and proper-name list merge into one table.
- **Alignment system:** most of the 13.4 KB of `align-table/1` is a list of seam prohibitions. These prohibitions are already enforced by code lint, and rejections come back with the specific reason. For chunk-level interpretation, line splitting moves to code and the prompt keeps only the principles; for line-level interpretation, the prohibition that matched is written into that sentence's `!` line.
- **Ordering and cache:** the system prompt is ordered "fixed protocol → target-language policy → this document's summary and terms," so unchanged parts come first. The whole system prompt stays byte-identical within a run, so it can be reused across pages in the cache. Cache breakpoints, provider-dependent warm-up and usage logging are in §6.5.
- **Page budget:** the rows translation page is set at 800 words, because with numbering the cost per source word rises to 1.6–2×, and on long pages the model gives up on annotation partway through ([ai-pipeline §8.6](ccut-ai-pipeline-design/08.md)). With the new carrier this reason weakens, but the page budget affects quality, so it is not changed together with the carrier, and it is not decided by replay either. In M1, run at least about 10 pages of real data with Sonnet subagents and compare three tiers: 800 / 1200 / 2000.

## 10. Polishing, speakers and other

### 10.1 Polishing (patch-style output)

Measured on three pages of this project for polishing: core area 3,841 words, 86 words changed (2.2%; 1.6%–3.0% per page), yet the output rewrote the full text of 22,746 characters. The changes were mainly two kinds: repeated proper-name corrections (`Fei Fei` → `Fei-Fei Li`, a dozen-plus instances) and scattered punctuation and hyphens.

The approach is patch-style output, with input sentences numbered (the existing paragraph-page rendering already does this). An illustration:

```
Fei Fei => Fei-Fei Li
Marvel => Marble
41 So we saw Fei-Fei Li build when there were only just a very few researchers, and really building to the team with Marble and then with now the release of Atlas.
¶ 1 3 4 5 6 10 12
```

- `A => B`: within this page's editable core area, matches and replaces the source words as an atomic sequence; used for repeated recognition errors. "Whole word" is not implemented as a space or Latin regex boundary.
- `<index> <whole new sentence text>`: changes only this sentence. Sentences that are not changed do not appear.
- `¶ …`: the index of the first sentence of a paragraph.

The code applies the patch to the source text to get the polished text; the word-level LCS rebinding and time interpolation that follow are unchanged. Drift checking moves from the whole page to each sentence, so one over-edited sentence rejects only that sentence. In this project's simulation, the output is about 20% of the current size.

M3 must settle these boundaries before the patch carrier is published: all matches apply to the original page snapshot, and replacements do not cascade; an explicit sentence-level replacement takes precedence over the global rules for that sentence; replacements that overlap at the same level or conflict with each other are rejected per affected sentence; read-only areas are not applied. The receipt lists affected sentences and replacement counts, and is replayed in the idempotent way of §5. Body text containing `=>`, `¶`, line breaks and so on needs reversible escaping. When in-sentence punctuation supplementation creates new sentence boundaries, how paragraph-start addressing works must be verified first; do not assume the input sentence indices still cover all the new boundaries.

The patch saving on output depends on the source already having sentence-final punctuation. When the recognition result has no punctuation, almost every sentence must change, the patch degenerates into line-by-line rewriting, and the output is no better than the full-text contract, so there is no saving. Whether such pages keep the full-text contract or are unified into line-by-line rewriting is to be decided by comparison in M3. The code has no existing punctuation-density criterion, but the existing overlong-sentence criterion (a single sentence that is too long and has no sentence-final punctuation) can be borrowed.

A small thing can be done first: the prompt requires repeating the read-only areas before and after, verbatim, and says the whole page is rejected if they change. The parser actually takes only the core area and only logs a warning if read-only areas change. Removing this repeat requirement does not affect parsing; in this project's three pages, read-only areas account for 2%–12% of the output.

### 10.2 Speaker-fix page

The `sk` page numbers each word on its own line, so its input is about 4 times the plain text. A speaker change is a single boundary, so a single-point reference can be used; the range syntax for the first and last words of a translation block does not apply. Reuse the unique-positioning, atomic-mapping and escaping mechanisms of §3.3, but use an independent carrier version. Ambiguous references, such as repeated thanks, must not be guessed by order; on failure, keep the current state or fall back to the original index contract. It is small, so it goes last.

### 10.3 Fixed overhead of the Agent path

The worker's contract file is the system prompt, and it shrinks together with §9. The task-related reference docs in the skill total about 95 KB, of which the carrier description (28 KB) explains each of the four formats separately. Once the carriers are unified, this document should be rewritten and shortened so that `contracts/<kind>.md` is self-sufficient, and the worker no longer needs to read the reference.

## 11. Other approaches considered

| Approach | Conclusion |
| --- | --- |
| Keep per-word numbering, only drop the echo | Conservative option that does not go stale with M0/M1. Block interpretation still returns arbitrary source-word sets, or their min/max with explicit semantics; it must not allow only contiguous exclusive intervals, which would lose crossings again. Dropping the echo saves output, but the actual ratio must be re-measured |
| Give only start points; code fills end points from the next start | Abandoned as the default. It would wrongly turn `{1,3}` / `{2}` into a safe partition. Deterministic hard anchors can only find some omissions and cannot prove that all remaining relations are complete |
| Code first marks candidate seams (①②…) in the source text; the model places markers with the same numbers in the translation | Cuts numbering by about 90%, but cut points can only fall on precomputed seams. Same class as `sourceBreaks` in the json-contract era ([subtitle-agent-workflow](ccut-subtitle-agent-workflow.md)) and `data-align-breaks`, later replaced by block-aligned edges ([alignment-block §6.1](ccut-alignment-block-subtitle-split-design.md)) |
| Echo both the source and translation columns, split (the current table) | Doubles output. Having the model restate the source drifts. Precedent from segment supplementation: 22 of 87 calls hit `source-drift` ([file-contract §6](ccut-file-contract-subtitle-ai-design/06.md)) |
| Frozen sentences do not echo the translation; only "a few characters before the translation cut point + source anchor words" | Saves another half of the output, but the translation side also needs reference positioning, which adds another ambiguity class. Frozen sentences are very few in the new flow, so not doing this for now |
| Local word alignment or a vector model | Evaluated. The local text-model feature was removed entirely on 2026-08-18 ([alignment-block §13.2](ccut-alignment-block-subtitle-split-design.md)); not to be re-proposed |
| Model produces only display lines, not full-sentence translations | The row-first experiment concluded that it systematically loses information |
| Fold the rewrite in source order into the translation call | Conflicts with "settle the translation first"; see §6.3 |

## 12. Decision record and pending items

Solution decisions after the 2026-09-30 review (they replace the corresponding conclusions in the original draft):

1. **Line text + head/tail anchor words.** Store the min/max of block membership; code fills in deterministic anchors and judges crossings. Filling end points from start points is dropped. If M0/M1 fail, fall back to a sequence-number carrier that preserves the semantics.
2. **No guessing on ambiguity; no loss of text.** Fixed symbols and reversible escaping; frozen text is mapped per cut point; never create a safe boundary when the evidence is insufficient.
3. **Partial acceptance with tiered bookkeeping.** Natural translation, display rewrite and alignment are accepted separately. Resubmission and takeover share the revision, the idempotency key and a two-round sentence-level budget; the terminal state is determined by the failure type.
4. **Time-group removal is tested separately.** Candidate carriers keep only pause hints and the necessary budget. Removal becomes the default only after passing reading-speed and split acceptance on the target profile.
5. **Page sessions do not span pages, and polishing is not merged.** A/C are decided by real cost, quality and latency; B is kept as a translate-then-tag control. Cross-page system caching can land independently; implicit caching must not be counted as zero.
6. **Reasoning tier is verified first.** The goal is the same tier for every repair round, with no automatic escalation. A medium tier is adopted only after an independent control passes the gate; the quality assumption is not treated as a verified fact.

To be decided after validation: the A/C configuration for each provider/Agent, the total head-and-tail format cost at equal quality, the LCS local threshold, the normalization boundaries, and the 800 / 1200 / 2000-word page budgets (each tier needs at least about 10 pages of exploration, see §8). §8.1 records the implemented foundation and the first-round results that did not pass the gate. It should not be taken as evidence that M0–M4 are all complete.
