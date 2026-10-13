> Ported from CucCut v2. Data model names in this text (such as TranscriptDoc) refer to the v2 models. For how they map to the v3 document model, see [Architecture design §14](../../architecture/architecture-design.md#14-items-pending-review).

# ccut Subtitle Agent Workflow Internal Reference

> Internal development material. This document keeps the orchestration, performance, contract and recovery notes that were moved out of the distributable skill.
> The contract, payloads, JSON state and tests returned by the CLI always take precedence; do not copy these internal details back into `skills/`.
> The model content protocol has switched to the file contract for TXT / Markdown / HTML (file-v1). The design is in [File-based subtitle AI pipeline redesign](ccut-file-contract-subtitle-ai-design.md), and it went single-track in 2026-08 (the `--contract` parameter and the json branch have been removed). The `json-v0` workflow described here is kept only as historical material and as a reference for the not-yet-migrated single-turn kinds (polish-retry/segment/segment-index/cleanup/broll). (chapters moved to the file-v1 HTML carrier with paged Map/Reduce in 2026-08; see AI pipeline design §7.)

This was compiled from `skills/ccut-subtitle-studio/SKILL.md` and `references/workflow.md` as of the `3992b2d^` point. For verbatim tracing, use `git show 3992b2d^:<path>`.

Related material: [Studio Web implementation](ccut-studio-web-implementation.md),
[AI pipeline design](ccut-ai-pipeline-design.md),
[Subtitle pipeline implementation](ccut-subtitle-pipeline-implementation.md).

## 1. Project Layout

Typical project:

```text
<name>.ccut/
  project.json
  transcript.json
  ai/
  tasks/<taskId>/
    contracts/
    payloads/
    requests/
    responses/
    claims/
  checks/
  exports/
  studio/
    data.json
    edits.json
    progress.json
  .ccut/history/
```

Key ownership rules:

- `transcript.json` may only be written through CLI/flow/Studio apply.
- Deterministic transcript search and replacement should use `ccut transcript find/replace` first. Use `find.total` as the `replace --expect` value, and use `--scope all` when both body text and speaker display names change. Do not launch a browser editor for literal search or replacement.
- AI intermediate results and stage stamps are used for resuming. Freshness is never judged by "file exists" alone.
- `studio/data.json` is a derived projection; `studio/edits.json` is the unapplied page overlay.
- Studio page code stays in the skill and is served live by the shared `ccut serve`; it is not part of the project package.
- Only one flow runs per project at a time.

Before starting:

```bash
<repo>/scripts/dev/prepare-ccut.sh          # run after source updates, before timing the task
CCUT=$(<repo>/scripts/dev/prepare-ccut.sh --check)
$CCUT --json doctor --quick
$CCUT --json model list
$CCUT --json project show $PROJ
$CCUT --json check $PROJ --lang <lang>
```

`prepare-ccut.sh` pre-builds and verifies the commit/target/profile after source updates; the media stages use only the verified release binary. `ccut` is a thin client: the commands all run in the sibling `ccut-serve` (Runtime), and the script builds and verifies both binaries together. If another Runtime is already running on the machine, `ccut` uses it (when the commit differs, stderr prints a one-line notice). To time this build, run `$CCUT serve --stop` first; the next command starts a new sibling Runtime. To diagnose only online video downloads, use `doctor --url-only`, which does not load the inference runtime or the model cache. A regular `doctor --quick` only checks model readiness; it does not run deep weight hashing or model inference. The deep integrity check still uses the no-argument `doctor`.

For Windows URL input, first run the skill's `prepare-url-deps.ps1 -Mode Plan`. If dependencies are missing, show the summary plan once and get explicit authorization, then run `-Mode Install -Confirmed`; if authorization is refused, stop. After creating the shared project, first run `serve --background` idempotently, read the actual URL from `serve --status`, and confirm the project page returns HTTP 200. If the model is not ready, first run `model download <id> --jsonl` on its own; after it finishes, ensure the preview again, then start `auto`. Before resuming a task and before final delivery, repeat the same preview self-heal check.

## 2. Transcription and Live Preview

Regular transcription:

```bash
$CCUT transcribe <media> --project $PROJ
```

Live preview in the page:

```bash
$CCUT transcribe <media> --project $PROJ --jsonl \
  > $PROJ/studio/live.jsonl

$CCUT studio sync $PROJ \
  --live-jsonl $PROJ/studio/live.jsonl \
  --phase transcribing
```

JSONL events include:

- `progress`: model, download, decode, VAD, recognition, refinement and write stages.
- `segment`: recognized interim text and timing.
- `language`: language detection.
- `done`: the formal transcript has been committed.

Progress for a first-time model download can carry file bytes, resumed bytes, the component stage, and model/repo/path. Regular JSONL output emits at most once per second; boundary events are sent immediately. When a stdout consumer disconnects, the run is cancelled cooperatively rather than panicking, and the partial is kept so that a later explicit download can resume it. `auto`/`transcribe` still prepare the model automatically for compatibility, but the Agent workflow uses a separate download so that the first-time ~1.62 GB cold start does not share one opaque timeout window with transcription.

The live sync used to run on a cadence of about 5 seconds; this is a UI refresh policy and is not part of transcript semantics.
After the formal write completes, the CLI commit hook refreshes Studio, and the formal Cues replace the live Cues.

Re-transcription overwrites the existing transcript. It must use the explicit confirmation flag, and a recoverable state must be preserved first.

## 3. Stage Dependencies and Default Chain

Internal dependency graph:

```text
transcribe
  → polish (the same result derives paragraph)
  → translate
  → alignment candidate filtering
  → batch LLM alignment
  → check residual hotspots
  → targeted refine-align
```

Performance conclusions:

- After the first polish, `paraBreaks` and segment stamps are derived from the paragraph/sentence results that passed validation. Ordinary translation tasks should not run a standalone segment beforehand.
- The hard prerequisite for translate is `polish=fresh`. `segment=stale` may simply be the normal state after polish changed wording, and should not by itself trigger re-segmenting.
- After a page text edit is applied, use `auto --polish` to explicitly re-validate the polish prerequisite.
- chapters run only when the user asks for chapter navigation; they do not replace paragraph.
- By default, translate processes incrementally only the sentences that are missing or whose source changed; only `--force` re-translates everything.

Default chain:

```bash
rm -f $PROJ/studio/worker_stop
$CCUT --json auto $PROJ --polish --lang zh &
```

The ordinary pipeline sends all long sentences in one batch to the many-to-one LLM, completing splitting and alignment in the first pass. `refine-align` only handles the stubborn sentences that remain after check; it is not a fixed second stage. The compatibility flag `--align-local` is deprecated; even if passed, it does not bypass the long-sentence LLM. The explicit full run `--align-only --yes` is still kept for alignment experiments.

## 4. Alignment Internal Strategy

### 4.1 many-to-one

**Default carrier: block alignment edges (`align-edges/1`, alignment block design M3).** The engine first filters out sentences that need no splitting. For the fused translation draft (`<span data-src>` block annotations inside `<p>`), it first tries the deterministic block kernel; sentences the kernel cannot resolve go to a dedicated round. The dedicated payload is an HTML table: `td.src` is the in-sentence source words with `[N]` ordinals, and `td.tgt` is the complete, natural translated sentence. The model only changes `td.tgt` into `<span data-src="4-7">因为我病了，</span><span data-src="1 2 3">所以没去。</span>` (“I got sick, so I didn't go.”). The minimal natural semantic blocks follow the target's own order, and `data-src` lists source word ordinals (they may be out of order, non-contiguous, or empty; each ordinal appears in at most one block per sentence). It does not split the source, does not split the target, and does not resolve crossings. Everything after that is code: blocks → soft edges (0.75) + hard edges for numbers/URLs/verbatim Latin/terms → safe boundary (`leftMax < rightMin`) → minimal monotone blocks → bilingual DP → `correspondence: block` + `blocks[]`. Word-order crossings fall into the same block automatically (a whole sentence such as `因为我病了，所以没去。` in one block is still block-level correspondence). If a block exceeds the hard limit, one narrow `align-rewrite/1` task is issued. It uses the same table shape, with `data-over-hard` marking the over-limit block and its source word ordinal range; the model rewrites the whole sentence following the source clause order and marks spans at the same time. Acceptance requires ±max(25%,4) reading units, locked terms and numbers/URLs/Latin anchors must not be lost, the target must pass AutoCorrect, and the block kernel must hold when rerun on the rewritten text ⇒ write `transDisplay{basis:"monotonic-rewrite"}` + `text_basis: display`, with `trans` unchanged. The rewrite round has no repair. If that still fails, fall back to sentence-level correspondence (`correspondence: sentence`). Sentences that fail in the first round share one global repair (issue codes: `align-edge-ordinal` / `align-edge-text` / `missing-id` …). When the budget is exhausted, first try pure anchor block alignment; the deterministic target-language split is the final fallback. The commit-time lint and the engine share one validator, `parse_align_edges`. `ccut translate --align-carrier table` switches back to the two-column split table below as the review/repair carrier (self-reported `data-crossing` falls back to sentence-level correspondence; `data-reordered` rewrites land in `transDisplay{basis:"table-reorder"}`).

**Review/repair carrier: two-column split table (`align-table/1`).** Sentences that need the LLM are batched in consecutive order. The page count is the maximum of three constraints:

- `atomize::word_count`: Latin is counted by words, CJK by characters, and attached punctuation is not counted separately. The executor budget is currently 2000 words, with 10% slack;
- at most 40 pending items per page, so that many short sentences do not pile into one overlong manual task;
- a deterministic complexity budget of 16000 per page, approximating HTML body text, suggested piece count, terms and bilingual anchor cost.

Page boundaries are then balanced by complexity while keeping sentence order continuous. `CCUT_LLM_PAGE_WORDS` only overrides the first word-count constraint. The full run, `--align-only`, the `--sentences` targeted repair, and the single global repair round all share this algorithm; the worker slot count does not change the page shape. Each item contains:

```json
{
  "key": "s-…",
  "source": "…",
  "target": "…",
  "lengthPlan": {
    "pieceCount": {"min": 2, "max": 3, "recommended": 2},
    "source": {"lang": "en", "unit": "word", "total": 24, "preferredPerPiece": [9, 15]},
    "target": {"lang": "zh", "unit": "readingCharacter", "total": 30, "preferredPerPiece": [11, 19]},
    "targetDisplayUnits": 30,
    "targetHardDisplayUnits": 20
  },
  "sourceBreakCandidates": [
    {"id": "b8", "after": "developers,", "before": "a", "seam": 3, "pause": 0, "risky": false}
  ],
  "draftSource": "… | …",
  "draftTarget": "… | …",
  "draftSourceUnits": [8, 16],
  "draftTargetUnits": [14, 16],
  "draftWidths": [12, 14],
  "data-target-frozen": [],
  "sourceWordUnits": [4, 6, 8],
  "draftReady": true,
  "budgets": {}
}
```

`lengthPlan` analyzes source and target length together. For space-tokenized languages such as English, word count is primary. For Chinese, Japanese and Thai, reading characters are primary. For Korean, eojeol (space-separated word groups) is the semantic unit, and it is additionally bound by the display-character hard limit. After combining the fit/soft limits of both sides, the target block count gives min/max/recommended, and each side additionally gives a suggested range per piece. The ranges only guide balancing; they cannot override complete phrases, word-order crossings, and bilingual meaning.
Pause hints may be injected into the source:

| Marker | Gap between words |
| --- | --- |
| `⏸` | ≥ 0.25s |
| `⏸⏸` | ≥ 0.6s |
| `⏸⏸⏸` | ≥ 1.2s |

The model first reviews the deterministic draft. When the draft already meets the delivery constraints and the semantic mapping is correct, it returns only `{"key":"…","useDraft":true}`. When adjustment is needed, it selects an ordered `sourceBreaks` from `sourceBreakCandidates` and inserts ` | ` only in the target:

- Both sides have the same number of pieces.
- The model does not retype the source; break points can only be the complete word-boundary ids provided by the program.
- The target covers the complete translated sentence verbatim.
- Strictly follow the target-first two-stage process. First, based only on target-language naturalness, terms, and fit/hard budgets, determine and freeze the target pieces. Then map the fixed target pieces onto contiguous source word ranges. Source pause and clause hints serve only the second-stage mapping and must not move the target break points.
- A non-empty `data-target-frozen` means the fused target pieces have already passed acceptance individually and only the source anchor failed. The worker must keep `draftTarget` and all separators verbatim, and return only the new `sourceBreaks`. Such sentences are exempt from `pieceCount.min`, since the target pieces cannot change and will not be asked to "add one more cut".
- When the source span exceeds the single-line budget or about 4s, split further only if the target piece itself already has a complete clause or parallel-action seam. A complete parallel action may use a 顿号 (、) seam; ordinary noun lists must not be split just for symmetry.
- Semantic completeness comes first. Where meaning allows, stay close to the suggested lengths on both sides and satisfy the target-language hard budget.
- Single-line width (fit) is a hard constraint, not a length preference. When a piece exceeds the single-line visual width and a **free seam** exists, it must be cut at that seam. `draftBlockers` provides the text on both sides of the cut point together. A free seam must meet four criteria at the same time: after the cut, neither side exceeds fit; neither side is a flash fragment; no objective blocking-seam criterion is triggered; and the seam itself is backed by punctuation in the original or by **real whitespace present in the original text**. A space that rendering inserts at a CJK/Latin boundary is not a seam (“担心 | AI 会抢走…” (“worry | AI will take away…”) cuts between a verb and its object clause). A piece over fit with no free seam stays whole. That is a problem for the translation rewrite to solve; forced cutting would only turn the overlong line into a dangling tail.
- A bare tail piece (one ending without punctuation) must not fall on a tail shape that still needs following constituents. The criterion is morphological, not a closed word list: the disposal construction (把/将 + NP with no predicate after it); a transitive verb + directional or resultative complement (到/掉/出/成) missing its object; an unclosed locative frame (在/从/对… + 上/里/中/下/内/间); the pivotal construction (让/使/叫 + NP with no predicate after it); a light verb (来/去 + monosyllabic reduplicated verb) missing its object; the copula “是” missing its predicate. It also covers the structural particle “得”, adverbs (如何/只是/同时/预先), the auxiliary “可以”, measure-word phrases awaiting a head noun (一系列/一块), and a light verb + “了” (采用了/内置了/提供了). “剩余的 35% 得 | 支撑…” and “输出质量在数学上 | 与…相同” (“the remaining 35% must | support…” and “output quality mathematically | is the same as…”) are always sent back for rework. Move the cut point one to two characters later, or keep the whole piece. Word-formation traps (such as “心得”, “以上”, “即将”, “把握”) are exempted through a whitelist. Light verbs missing an object that depends on context (知道/占用/生成) are recorded only as advisory.
- Must not cut before the coordinating conjunctions `和`/`及`/`与`, e.g. “它们是 KV 缓存 | 和 PagedAttention” (“they are KV cache | and PagedAttention”). A coordinating conjunction may begin a piece only if the preceding piece ends in punctuation. This is the mirror of the "dangling conjunction at piece end" rule. The other half of the symmetry is equally forbidden: must not cut **after the second coordinated item**, which would push the head noun of a modifier structure onto the next piece (“Key 和 Value | 矩阵” (“Key and Value | matrix”)).
- Degenerate pairing rows: a target piece of ≥8 display units must be paired with at least 3 source words. The exemption applies when there are not enough source words to allocate, or when the source range has ≥2 words and its width has already reached 40% of the target piece. Otherwise, let adjacent phrases share a piece rather than chopping the source side into crumbs. Single-word ranges get no width exemption, since word-by-word highlighting then advances only one step.
- Pauses are a reference, not a forced break point.

The program anchors the source pieces back onto contiguous word ranges and derives display timing. Sentences that pass within a batch are accepted immediately. The sentences that fail across all first-round batches are merged and share one global repair round; only those still failing fall back to the deterministic split. Under the current complexity budget, about 120–130 typical sentences awaiting splitting usually take 5 first-round calls. The repair round only resends the failing set and fans out under the same rules, so the whole document is never resent.

Repair calls are used only for undeliverable structural errors: unknown or duplicate keys, illegal source word boundaries, unequal piece counts on the two sides, source words or target not fully covered, empty pieces, invalid ranges, target pieces exceeding hard, unfinished Chinese numeral-measure phrases, bare tail pieces falling on a weak, non-pausable tail shape, pieces starting with a coordinating conjunction, degenerate pairing rows, drift in frozen target pieces, and bilingual source lines that are too dense where natural target-language seams exist. If a target piece is deterministically re-split because of hard, and the proportional source anchor would then fall inside a bound phrase, it is changed directly to independent, without spending another call on mechanical re-anchoring. Soft overruns and piece-length imbalance caused solely by natural word-order crossings are still recorded as advisory and do not on their own trigger expensive rework.

### 4.2 Other modes

- `independent`: the target language is cut into lines independently, with zero LLM calls; suits natural single-language layout.
- `many-to-one`: all over-long source or target sentences go into the batch LLM.

Translation Cues are fully independent of the source Cues of the transcript/subtitle. Both modes derive target Cues from the word sequence and word time windows of the Sentence; source Cues only serve the original-text stream and may not take part in translation alignment or invalidation decisions (except for the read-only display grouping of the editor's source-text column, see Transcript v0.3 §5.2). After `breaks` changes, the translated segment text, word spans and fingerprints must remain unchanged. The historical `one-to-one` mode has been deprecated because it depends on source Cues. The local Agent task and the Cloud Model/provider share this contract; any change to the prompt, schema or acceptance on either side must be synchronized to the other side and verified with the same regression fixture.

Modes are saved per sentence and can be re-run in a targeted way:

```bash
$CCUT --json translate $PROJ \
  --lang zh \
  --align-only \
  --sentences s-a,s-b \
  --align-mode many-to-one
```

A full `--align-only` run requires explicit confirmation and is generally used only for alignment experiments.

To fix a complete translated sentence, omit `--align-only`:

```bash
$CCUT --json translate $PROJ --lang zh --sentences s-a,s-b
```

This command only re-translates and re-aligns the explicit sentence set; other fresh translated sentences remain unchanged.

## 5. refine-align

```bash
$CCUT refine-align $PROJ --lang <lang>
```

It reads the full `warnings[].allItems` / `allSentences` / `allPieces` from check first, rather than copying only the human-readable summary or the truncated repair command in `check.next`:

- `align-overfit`
- `align-stale`
- sentences belonging to `translation-overflow`
- `align-source-ceiling` / `align-source-fragment`
- `align-source-seam` / `align-target-seam`
- `align-paired-density` / `align-bilingual-anchor` / `align-degraded-fallback`
- `align-row-deficit` (translation sticking: one translated line covers multiple source lines and its dwell exceeds the limit)
  (It only guarantees that sentence-level entries match the engine's acceptance criteria; it does not report anchor misalignment, which is instead listed by `align-sentence-level` in `infos[]`. `align-weak-block` / `align-display-rewrite` are, together with `alignMetrics[lang]`, structural facts that produce no fix and do not enter hotspots.)

By default, the full set of hotspots is grouped into one targeted task that runs a single LLM round. An explicit `refine-align` only re-dispatches these **no-op / deferred sentences** for at most one more round when that round is idle (the source geometry of sentences still failing is identical to what entered the round) or when it is truncated by the fan-out cap. It does not resend sentences whose geometry has changed but still resist (so `rounds` may be 0, 1 or 2). The `auto` wrap-up has no extra follow-up round and sets the internal repair budget to 0, to avoid resetting the budget for all stages after the main align. On finish, it writes `studio/worker_stop`, which distinguishes "the queue is briefly empty between stages" from "the whole chain has ended".

Output:

- `status=clean`: may finish.
- `status=residual`: `remaining[]` lists sentences that still cannot be legally recut.

Do not repeat the same recut for residuals. Options:

1. Shorten the translation through Studio sentence rewrite.
2. After applying, re-align only that sentence.
3. If it cannot be eliminated, report it as a known residual.

## 6. Agent claim/submit

When a flow uses `--llm agent`, it blocks waiting for answers. After the first batch of requests is posted, check the queue size first:

```bash
$CCUT --json task status $PROJ
```

Workers are always started on demand. When starting the producer, start only **one** catch-all worker with no kind filter (media processing and the serial analysis/polish/translate-brief stages only need that one). Do not pre-start any extra workers: an idle worker occupies an entire model session, and its cost far exceeds the overhead of starting a worker a little later. After calls are posted, `batch-dispatch.workerPlan` and `workerPlans[]` in `task status` give, per `task + kind`, `execution`, `suggestedWorkers`, `claimKinds`, `recommendedEffort`, `poolKey` and `maxLeaseSec`. `recommendedEffort` is `high` for align (including the global repair of the same kind) and `medium` for the other stages. The orchestrator should choose the worker's reasoning tier according to this hint; old workers ignore the field and can still claim normally. The suggested worker count for parallel stages is `min(cap, pendingCount)`, where the cap defaults to 3 and can be overridden by `CCUT_LLM_MAX_WORKERS` (0 means open all according to `pendingCount`). When it is not explicitly overridden and the median worker duration of delivered calls for the same task (`observedWorkerSec`) is ≥ 90 s, the cap is automatically raised to `ceil(pendingCount/2)` and clamped to 3..16, so a pool of slow agent-session workers taking minutes per page is no longer pinned to 3 lanes. `maxWorkers` in the plan is the currently effective cap (`null` when unlimited), and `expectedWaves = ceil(pendingCount/suggestedWorkers)` is the expected number of waves when workers are started at the suggested count. Serial stages are always 1.

`suggestedWorkers` is a **ceiling hint** computed from the actual pending work, not a minimum that must be filled. After seeing a parallel batch, the orchestrator tops up running workers to `min(pendingCount, available slots)`, and does not top up when there is no pending work. Long-video translate and align usually fill the suggested count, since batches are independent of each other. When there are clearly fewer workers than batches, wall-clock time is determined by queueing rather than response time. Stage boundaries do not need people staged in advance: a worker uses `submit --next` to claim the next batch directly within the same session (including align and global repair calls). When a claim times out and the queue is empty, the worker exits; there is no standby hot spare. It is started again when the next parallel batch appears. A worker can be reused throughout the whole flow, but each time it must be explicitly reassigned according to `claimKinds`, and `worker_stop` remains the exit signal.

When the orchestrator's actual available slot count is not the default 3, run `export CCUT_LLM_MAX_WORKERS=<actual slot count>` before starting `ccut`. This value determines `suggestedWorkers` and the actual concurrent consumption cap, but does not change the paging shape. By default, translate (`--align-fusion rows`) forms pages on an 800 source-word budget (+10% slack), i.e. `ceil(source words/880)`. `--align-fusion on|off` falls back to a 2000-word budget (`/2200`); see AI pipeline design §8.6.1/§10.4. The expected page count for align is the maximum of `ceil(source words/2200)`, `ceil(items to align/40)` and `ceil(total complexity cost/16000)`, and this tier does not change with the `--align-fusion` value. The orchestrator should go by the actual `workerPlans[]`; the real slot count is `min(expected pages, number of worker sessions that can run at the same time)`.

Claim:

```bash
$CCUT --json task claim $PROJ \
  --worker <worker-id> \
  --timeout 240
```

Typical return:

```json
{
  "status": "prompt",
  "callId": "cNNNN",
  "kind": "polish",
  "leaseId": "lXXX",
  "task": "t-…",
  "contract": "…/contracts/polish.md",
  "payload": "…/payloads/cNNNN.json",
  "problems": []
}
```

After answering:

```bash
$CCUT --json task submit $PROJ \
  --call cNNNN \
  --lease-id lXXX \
  --task t-… \
  --file /tmp/answer.json \
  --next
```

Key points:

- On first encountering a kind, read the contract; read the payload every time.
- The contract is the authoritative source for the shape of this answer.
- `--task` prevents identical callIds under different tasks from colliding.
- Put answer files in a temporary directory, not in the repository or project root.
- When submit omits `--worker`, it is booked to the holder of this lease, and `--next` also uses this id to continue claiming. Do not pass an id that differs from the claim to save effort, or the continued claim will land on another worker.
- After a rejection, correct according to `problems` and resubmit under the same lease. Historically, a single call was allowed at most 3 attempts.
- `--next` merges submit with the next claim and allows a window of about 2 seconds for dependent requests to be flushed to disk. When it returns empty, check `producerState` / `activeTasks` in the same response. `alive` means the producer is still running (a serial segment between stages, or engine computation), so make one bounded `claim --timeout 300` to keep alive and avoid a cold start for the next wave. `gone` means all registered producers have exited and no more calls will be posted, so exit directly. `unstarted` means the project has no producer record yet; the flow is probably still downloading or transcribing, and the first wave of AI calls has not been dispatched. This is normal dead time alongside the baseline worker started at t=0, so keep waiting boundedly. `producerAlive` is the compatibility boolean for `producerState == "alive"`; its `false` covers both `gone` and `unstarted`, so it must not be used alone as an exit criterion.
- After a worker crashes, claim again; the CLI manages leases and idempotency.

Leases are tiered by payload size: 600 seconds for short payloads, 900 seconds for medium, 1800 seconds for long. After claiming, read, answer and submit continuously, and do not insert unrelated work into the lease window.

Historical answer shapes:

| kind | Shape and key constraints |
| --- | --- |
| `analysis` / `brief` | `summary`, `terms[]`, `namedEntities[]` |
| `polish` | `paragraphs[].sentences[]`; the concatenation fully covers the input, and sentence boundaries are semantically complete |
| `polish-retry` | `sentences[].startWordIndex/correctedText` |
| `segment` | `paragraphs[]`; preserve characters verbatim, only adjust punctuation and boundaries |
| `segment-index` | `paragraphs[].startWordIndex/endWordIndex` |
| `chapters` | NDJSON `{title,startSeg}` (historical; now file-v1 HTML `<h2>` + summary + `<p id>` first-paragraph anchor, see AI pipeline design §7) |
| `translate` | `translations{sentenceId:text}`; each requested sentence exactly once |
| `align` | `sentences[].key/sourceBreaks/target`; the source side selects candidate ids, the target side only inserts ` | ` |

The runtime contract may evolve. The table is only for understanding the historical design and cannot replace reading the contract.

## 7. Worker disconnect recovery

A worker may lose contact during a long answer. You can run the following at the same time:

```bash
$CCUT task watch $PROJ
```

When pending calls are observed with no claim activity for a long time, watch has historically woken the orchestrator with exit 3.

Recovery order:

1. If a completed answer already exists, re-claim and submit it immediately.
2. If there is no answer, the orchestrator reads the contract/payload and answers.
3. When batch processing needs to continue, rebuild persistent workers.
4. After processing, restart watch.

Legacy practice names answer files `<task>-<callId>.json` to avoid overwriting across tasks. After claiming, complete answering and submission as quickly as possible, and do not interleave unrelated work in the middle of a lease.

Quality notes:

- polish sentence boundaries keep one complete question or statement.
- translate: translations are natural, concise and terminology-consistent; product names stay in the original.
- align: cut at punctuation and semantic seams, and keep segment lengths as balanced as possible.
- Watch quote escaping in self-produced JSON strings; fields that must be copied back verbatim must not have their quotes rewritten.

## 8. Progress commits

LLM stages:

- The flow creates `studio/progress.json` on start.
- Task dispatch / submit refresh the model-call denominator / numerator respectively; `callsDone` / `callsTotal` can be shown directly as `x/y`.
- `flow` / `lang` / `taskId` identify the current external flow; on failure, `error` keeps the visible error. These are all optional incremental fields, and old consumers should decode them tolerantly.
- translate posts all pages in one batch first. As soon as any page's result is ready and passes validation, it checkpoints immediately: it first refreshes `studio/data.json`, then advances progress. It does not wait for the other pages in the same batch, and it does not change the per-page submission constraint. Failed pages independently enter the next retry round.
- data and progress both carry `contentFingerprint`.
- When fingerprints disagree, the page shows syncing, not complete.
- Studio polls progress about once per second, so call counts and stage changes can appear in real time.

Transcription still goes through JSONL + `studio sync --live-jsonl`.

Successful content projection is the commit gate for stage advancement. Do not report completion before the body text has been written.

## 9. Delivery gates

```bash
$CCUT --json project show $PROJ
$CCUT --json check $PROJ --lang <lang>
```

Historical rules:

- Polish delivery requires `polish=fresh`.
- Translation delivery requires polish and the target-language translation to be fresh.
- Agent submits for translation and `align-edges` are impenetrable hard gates: only answers that pass both structure and content quality are settled. Target-script errors, placeholders, source-text copying, abnormally short translations and batch short-line collapse cannot be forced through by lint count. For hedging, the first candidate to pass the full quality gate is adopted, not the first one to write out HTML.
- The `data-validator` of the translation carrier is part of the response reuse key. After a validator version change, old responses must not be manually moved over to bypass automatic invalidation.
- `segment=stale` does not need to be mechanically re-run after polish.
- `chapters=never` only means there is no chapter navigation.
- Blockers must be eliminated; warnings must be reported with their impact.

Common check items:

| Diagnostic | Action |
| --- | --- |
| `translation-stale` | Incrementally re-run translate |
| `align-stale` | Targeted align-only |
| `align-overfit` | Targeted re-cut |
| `align-source-fragment` | Targeted re-cut (the translated segment sits on a fragment of one or two source words) |
| `polish-fallback` | **blocker**: sentences with `fallback: true` in `ai/polish.json` were reverted by the engine to the original text during polishing (the original words were kept after the whole-page/single-sentence validation failed), so they were not actually polished; `polish=fresh` does not mean these sentences were polished. Follow `fix` (`ccut polish <project> --paragraphs <p-…>`, already in `next[]`) to re-polish them in a targeted way; once fixed, it disappears |
| `polish-false-sentence-end` | Sentence-final punctuation falls on a dangling word (a false sentence end; the legitimate English wh-fronted object plus stranded preposition is excepted). Report only, no automatic fix; if necessary, re-polish in a targeted way per `fix` |
| `translation-overflow` | Re-cut or rewrite the translation |
| orphan keys | Check whether they were produced by text write-back, and report |

Export is performed only when the user explicitly asks for it:

```bash
$CCUT --json export $PROJ \
  --to srt \
  --mode original|translated|bilingual \
  --lang <lang>
```

Unattended provider mode uses:

```text
--llm provider:<vendor>/<model>
CCUT_API_KEY_<VENDOR>
```

It bypasses Agent claim/submit. It suits explicitly requested automated runs, but loses per-call manual quality control.

## 10. Resuming interrupted runs

Decisions:

1. Project does not exist: create it.
2. Transcript missing but live JSONL exists: transcription was interrupted; ASR inference still reruns from the start, but valid model `.part` files are verified against their sidecar identity and resumed from the middle of the file.
3. Translation interrupted: verify that polish is fresh first, then translate incrementally.
4. pendingCalls exist: first check whether the original flow is still alive; if it is, resume the worker; if it has exited, restart the corresponding flow and reuse the committed results.
5. `studio/edits.json` has unapplied edits: apply them first.
6. The user asks to start over: state explicitly which results will be discarded, then use the explicit override option.

Do not judge a stage complete merely because an artifact file exists or because of the translation coverage count; use the stage fingerprint, `project show` and `check` as evidence.

## 11. Upgrading old CucCut projects

```bash
$CCUT --json upgrade-cuccut <id> [--root <CucCut 数据根>]
```

In-place upgrade semantics:

- words, speakers, chapters, breaks and paraBreaks are kept where possible.
- Import-side display segments are merged into ccut sentence-level `trans`; the source spans are written to `transAlign`.
- The two sides' fingerprint schemes do not recognize each other, so the old `transSrc` and stage stamps are not inherited.
- If the original media exists, it stays as a relative or external reference and is not copied; otherwise `media/main.m4a` is generated from the project's audio cache.
- Old JSON/JSONL files are moved into the project's `archive/` once all the new files are written; use `--dry-run` first to review the loss.

The upgrade generates the Studio projection and registers the project; then the project is run through `studio sync` and checks like any ordinary project.
