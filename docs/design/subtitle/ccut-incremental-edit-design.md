> Ported from CucCut v2. The data model names (such as TranscriptDoc) refer to the v2 models; for how they map to the v3 document model, see [Architecture design §14](../../architecture/architecture-design.md#14-items-pending-review).

# CucCut Incremental Editing Design (Transcript Partial Patches and Write-Path Audit)

> Status: on 2026-08-15 phase one landed (`patchTranscript` op, request-body limit, Mac differential commit, Studio write-failure rollback). On 2026-08-18, §3.5 landed (write-failure classification across all three clients: transient failures are retried first, and only a verdict rolls back) and §3.6 (`patchTimeline`: the Mac timeline also commits differentially).
> This document is also the audit ledger for all current edit write paths and the follow-up consolidation plan.
> Endpoint parameters follow [`ccut-cli-server-reference.md`](../cli/ccut-cli-server-reference.md).

## 1. Problem

A user renamed a speaker in the Mac App in a 7-hour project and got:

```
Could not save your edit, so it was reverted. (serve HTTP 400: body too large)
```

Root cause chain (verified file by file):

1. The Mac editor holds a mutable `Doc` locally. Every change in `Store.commit` (including speaker renames, chapter titles, paragraph breaks, and single-segment subtitles) goes through `productDocumentDidChange` → 250 ms debounce → `ProductTranscriptAdapter.replacingTranscript`, which **rebuilds the entire transcript.json** (unconditionally rewriting `words[]`) → `AppStore.applyTranscriptDocument` POSTs the whole document via `replaceTranscript {document}` to `__ccut/transcript/apply`.
2. `ccut serve` sets a 1 MiB limit on request bodies for every endpoint except `export/video` (`router.rs::MAX_BODY`). Seven hours is about 60,000 words, which serializes to several MB, so the request is rejected outright.
3. The rejection response is a bare-text 400 `body too large`. The App can only relay "serve HTTP 400," and then rolls the edit back under transaction-failure semantics.

Three independent defects compounded: **metadata edits were committed as whole-document writes**, **the limit was too small and its error unreadable**, and **no partial-edit channel was used by the Mac client**.

## 2. Write-path audit (2026-08-15)

| Surface | Endpoint | Payload | Concurrency guard | Assessment |
| --- | --- | --- | --- | --- |
| Mac `AppStore.applyTranscriptDocument` | `transcript/apply` | Before: `replaceTranscript` whole document; after: `patchTranscript` diff, falling back to `replaceTranscript` | `baseRev` = `data.json.rev` | The object fixed in this change |
| Mac `AppStore.applyTimelineDocument` | `timeline/apply` | Before: `replaceTimeline` whole timeline.json; after (§3.6): `patchTimeline` diff, falling back to `replaceTimeline` | `baseRev` = timeline history count | Small in size, but whole-document replacement hands the client the cut provenance and word anchors to rebuild; §3.6 closes this |
| Mac `AppStore.applySubtitleStyle` | `style/apply` | Whole `studio/style.json` | `baseRev` | Style object is small; acceptable |
| Mac `applySourceEdit` / `applyTranslationEdit` | `transcript/apply` | Single op `sourceText` / `translation` | `baseRev` + op `base` | Only called by the unmounted `ProjectsViewController`; dead code in the product shell |
| Mac project title/description/notes/links | `ccut project edit` (subprocess) | Only the changed fields | — | Does not go through serve; unaffected by this problem |
| Studio Web `applyTranscriptOps` | `transcript/apply` | 1–2 fine-grained ops (sourceText/translation/timing/structure) | `baseRev` + op `base`; single serial queue | Good |
| Studio Web `mutate/flush` | `put` | Whole `studio/edits.json` (style overrides, Agent requests) | sha256 CAS; on stale, re-fetch and replay | Defect: non-409 failures were retried indefinitely (fixed in this change); files are usually small |
| Studio Web export | `export/video` | Full derived projection (`data.json` + timeline-derived rows) | — | Several MB; accommodated by the higher limit |
| gpui | `transcript/apply` / `timeline/apply` / `style/apply` / `restore` | Fine-grained ops (same as Web); style as whole | Dual rev counters | Good; no change needed |
| Windows | No serve write path | — | — | Not applicable |

Studio Web has no speaker, chapter, or title editing UI, so the whole-metadata-commit problem does not exist there. Mac is the only client that treats "the whole local document" as its write unit.

## 3. Landed in this change

### 3.1 `patchTranscript` op (server side)

- Implementation: [`core/crates/ccut-flow-core/src/patch.rs`](../../../core/crates/ccut-flow-core/src/patch.rs), a pure function `apply_patch(&mut TranscriptDoc, &Value)` with no I/O and transactional behaviour (it works on an internal copy, so a failure leaves no partial changes). Serve side: [`core/crates/ccut-serve/src/endpoints/transcript.rs`](../core/crates/ccut-serve/src/endpoints/transcript.rs), `apply_transcript_patch`: read from disk → patch → `validate()` → atomic write → rebuild projection → history. The primary source and `transcripts/<srcId>.json` share the same path.
- Shape (like `replaceTranscript`, it must be the only op in the transaction):

  ```jsonc
  { "kind": "patchTranscript",
    "words": {
      "update":  { "<wordId>": { "t0"?, "t1"?, "text"?, "sp"? } },
      "splices": [ { "first": "<id>", "last": "<id>", "words": [ …Word ] },
                   { "after": "<id>" | null, "words": [ …Word ] } ] },
    "set": {
      "speakers":   { "<id>": {name,hue?} | null },
      "breaks":     { "<wordId>": "break"|"nobreak" | null },
      "paraBreaks": { "<wordId>": true | null },
      "hidden":     { "<wordId>": true | null },
      "stages":     { "asr"|"asrLayout"|"polish"|"segment"|"chapters": "…" | null },
      "trans":      { "<lang>": null | { "<sid>": "…" | null } },
      "transAlign": { "<lang>": null | { "<sid>": {…} | null } },
      "transSrc":   { "<lang>": null | { "<sid>": "…" | null } },
      "transDisplay": { "<lang>": null | { "<sid>": {text,basis,transFingerprint} | null } },
      "autoBreaks": { "<profile>": null | { "<wordId>": "break"|"nobreak" | null } },
      "layoutProfile": "<id>" | null,
      "chapters":   [ …Chapter ] } }
  ```

- Design trade-offs:
  - **Why a "diff patch" rather than a set of semantic ops (renameSpeaker, setChapter…)**: The Mac business semantics already live in the local `Doc` and the adapter (merging sentence boundaries, folding translation overlays back, and so on). Splitting them into semantic ops would duplicate those rules into a second copy on the server. The patch keeps the semantics "the client submits its desired final values," and reduces transport and journal cost to something proportional to the change. Studio and gpui have no local whole document, so they keep using semantic ops (`sourceText`/`sourceStructure`…). Both channels validate against the same `TranscriptDoc`.
  - **No CLI command, no skill doc**: the patch is a transport format between the UI clients and serve. Agents go through the `ccut studio apply` overlay and CLI commands, and do not need to know about it.
  - `baseRev` remains the only concurrency lock. Any write does `rev+1`. The patch no longer carries a per-word `base`. References to nonexistent words or keys return 400 directly.

### 3.2 Request body limit and error envelope

`MAX_BODY` 1 MiB → 64 MiB, `MAX_EXPORT_BODY` 32 MiB → 256 MiB. Serve listens only on 127.0.0.1, so the limit is a guardrail against misuse, not a resource quota. Over-limit requests return 413 JSON `{ok:false, reason:"body-too-large", error, declared, limit}`, so the client can show the reason verbatim. The existence of the limit still signals to clients that routine edits must send incremental ops.

### 3.3 Mac differential commit

[`apps/mac/Sources/CucCutCore/TranscriptPatch.swift`](../apps/mac/Sources/CucCutCore/TranscriptPatch.swift): `TranscriptPatch.plan(baseline:desired:)` performs a JSON-level diff between the whole document rebuilt by the adapter and the on-disk baseline `document.transcriptDocument`:

- `words[]`: find the longest common prefix and suffix by id. The middle section becomes one splice (a structural change). Words in the prefix and suffix whose id matches but whose fields differ go into `update`. When several structural changes occur within one debounce window, they merge into a single splice covering all of them. The result is still bounded by the edited region, not the whole file.
- Top-level tables: `speakers/breaks/paraBreaks/hidden/stages` get a one-level sparse diff; `trans/transAlign/transSrc/transDisplay/autoBreaks` get a two-level diff; `layoutProfile` is a scalar; `chapters` is sent as a whole table (it is very small).
- A difference in `media/lang/engine/ccutTranscript/createdAt` or in unknown keys → `.replace`, falling back to `replaceTranscript`. Two identical documents → `.unchanged`, and no request is sent.

`AppStore.applyTranscriptDocument` selects the op accordingly. The caller (`ShellProjectAdapter.scheduleProductDocumentSave`) and the rollback semantics are unchanged. A speaker rename's request body changes from "the whole transcript" to a single `set.speakers.<id>`.

### 3.4 Studio Web write-failure rollback

`store.jsx flush`: a non-409 failure from `put` (including 413) no longer keeps `pendingMuts` for `finally` to retry every 400 ms while flooding toasts. It discards this batch of transformations, reverts to the overlay the server already knows, and shows the message "changes reverted," consistent with Mac semantics.

### 3.5 Write-failure classification: retry transients first, roll back on a verdict (2026-08-18)

After phase one, there is still one class of report: when splitting a clip on the timeline (one `patchTranscript` break plus one `replaceTimeline`), the following occurs intermittently:

```
无法保存你的编辑，改动已回退。（The network connection was lost.）
无法保存你的编辑，改动已回退。（serve HTTP 400：body too large）   ← old serve
…timeout…
```

Measured on the synthetic 5-hour project under §3.1–3.3, these two writes take about 1 s and 0.6 s on the serve side in the current build, and their request bodies are only a few hundred bytes. URLSession also receives the 413 normally. The remaining "connection lost / timeout" is therefore not a size or verdict problem. It is a **transient transport error**: `ccut serve` is taken over by a build generation swap of the same root with a different build (`serve.log` shows the CLI and App bundle alternately launching hundreds of times), restarted by another session, or hit while the project lock is held by a flow. Until now the Mac treated every failure as a verdict. `applyTranscriptDocument` returned `false`, the client rolled back to the disk state, and a toast said "changes reverted." A single transient error therefore cost the user a step.

All three clients now unify on "retry transients first, roll back on a verdict":

| Surface | Classification | Retry |
| --- | --- | --- |
| Mac `AppStore.apply{Transcript,Timeline}Document` / `applySubtitleStyle` | Returns `WriteOutcome`: `saved` / `rejected(reason)` / `retryable(reason)`. `WriteOutcome.classify`: URL-layer errors (timeout, connection lost, unreachable), POSIX errors, and HTTP 409/423/5xx → `retryable`. Other HTTP (400/404/413/500), `serve not running`, and parse failures → `rejected` | `ShellProjectAdapter.scheduleProductDocumentSave`: on `retryable`, the same desired snapshot is re-queued (yielding if a newer snapshot arrived in the meantime). It backs off 0.5/1/2/4/4 s, recomputes the diff against the disk baseline, and resends. Only after 5 consecutive transient failures does it take the `rejected` path, rolling back and toasting once |
| GPUI `serve::apply::post_json` | `ureq::Error::Transport` with `ConnectionFailed`, and non-timeout `Io`, are transient. Status codes and timeouts are not retried | Once each at 0.3 s and 0.9 s |
| Studio Web `apply-fetch.js` | A thrown `fetch` exception is transient. Any response with a status code is not retried | Once each at 0.3 s and 0.9 s |

Resending is safe because all three write endpoints carry the `baseRev` CAS. If the first send actually landed and only the response was lost, the Mac retry reloads the disk document before diffing again. An empty diff sends nothing (`transcript` uses `TranscriptPatch.plan == .unchanged`, and `timeline` uses `timeline == refreshed.timelineDocument`). GPUI and Web resends receive 409 stale and are handled by the existing "reload" semantics. Under no circumstances is anything written twice.

Companion change: `ServeError.http`'s `errorDescription` now quotes the envelope's `error`/`reason` text rather than the whole JSON blob, so the Mac toast and GPUI `status_error` are equally readable. For example, `serve HTTP 413：请求体过大：… 字节，上限 … 字节` (Chinese locale copy, meaning "request body too large: … bytes, limit … bytes").

### 3.6 Mac timeline differential commit: `patchTimeline` (2026-08-18)

`replaceTimeline` is the only whole-document write unit left on Mac after the §2 audit (every clip drag, split and element move sends the whole document back, including the cut provenance of the main source). It is now consolidated using the same approach as `patchTranscript`:

- Server op `patchTimeline` ([`core/crates/ccut-timeline/src/patch.rs`](../../../core/crates/ccut-timeline/src/patch.rs)
  `apply_patch`): the `sources` table is put/null; `clips` / `tracks` / each track's `elements` are ordered id arrays → one splice outside the common prefix and suffix, plus field-level `update` for retained items (null deletes optional fields); `main` is a whole object. The patch is applied to the document JSON, then strictly deserialized against the closed schema, `validate()`d, and the projection is rebuilt from the durations of the post-patch sources. If any step fails, it returns 400 and nothing is persisted. Fields not mentioned are kept as they are. Field table: see [server reference](../cli/ccut-cli-server-reference.md) `timeline/apply`.
- Mac [`TimelinePatch.plan(baseline:desired:)`](../apps/mac/Sources/CucCutCore/TimelinePatch.swift)
  computes a JSON-level diff between the rebuilt result of `ProductTimelineAdapter.replacingTimeline` and the on-disk baseline `document.timelineDocument`. With no baseline (no timeline.json yet), a change in the `ccutTimeline` version, unknown top-level keys, or items without ids → `.replace` falls back to the whole document; identical documents → `.unchanged`, and no request is sent. `AppStore.applyTimelineDocument` picks the op on this basis; callers are unchanged. The request for a split segment changes from "the whole timeline.json" to `clips.update.<id>.out` plus one `clips.splices[].after` insertion.
- The timeline write paths in GPUI and Studio Web were already fine-grained ops (`splitClip`/`trimClip`/`patchElement`/`putSource`…), so they are unaffected. GPUI `adapters::timeline_doc::replacing_timeline` is now referenced only by tests and is not on a write path.

With this, the write units in the audit table that are still "whole document" are only: `style/apply {document}` (the same on all three platforms; `studio/style.json` ≈ 5–8 KB, and the contract itself is "one style document"), Studio `put` (`studio/edits.json` ≈ a few KB, sha CAS), and the full preview projection in `export/video` (not an edit). Their size and semantics are not a problem, so they stay in §4 as optional optimizations.

## 4. Follow-up consolidation (by benefit)

1. ~~**Mac timeline fine-grained op**~~: consolidated by `patchTimeline` in §3.6. Per-entry base validation and the `skipped` semantics (§5.3) still exist only on the fine-grained ops; `patchTimeline`, like `patchTranscript`, relies only on `baseRev` CAS.
2. **Mac reload cost after save**: every successful write calls `DocumentModel.load`, which fully re-reads `transcript.json` (and parses it twice: `TranscriptDocument` plus the raw `JSONValue`), `data.json` and `timeline.json`, then re-projects everything with `mapDocument`. For a 7-hour project, every keystroke means parsing tens of MB. Direction: the apply response already carries `rev`, so re-read only when `rev` changes; change `transcriptDocument` from a parse result to "a local copy with the patch applied" (equivalent once the server accepts), avoiding a second full parse; make `mapDocument` re-project incrementally by splice range.
3. **`studio/poll` returns all of `data.json`**: any rev change returns the whole projection. Add `since=<rev>` to return an incremental `{cues: [changed], removed: [...]}`, or at least gzip it.
4. **`export/video` payload**: the front end POSTs the whole derived projection back, while the server could rebuild most of it from the on-disk projection. It should submit only `patchRanges` and the overridden fields that differ from disk.
5. **Studio `put` rewrites the whole file**: `edits.json` is mainly style overrides and Agent requests, and `requests[]` only grows, never shrinks. Move `requests` to a separate file or add cleanup, and let `put` support JSON merge patch.
6. **Mac dead code**: `ProjectsViewController` and `applySourceEdit/applyTranslationEdit` have no callers. Either delete them, or wire the product shell's source and translation cell edits to these two semantic ops (more precise than a patch, and able to carry an op-level base).
7. **Studio 409 stale recovery**: on stale, `applyTranscriptOps` only shows a toast and the user's input is lost, relying on the next poll to catch up. On stale it could first fetch the latest `rev` and then replay the same ops once.
8. **Full candidates in AI review**: `ai/reviews/<kind>.json` embeds the whole candidate transcript, so accept overwrites the whole document and captures a full history baseline. Chapters moved to overlay candidates in 2026-08 (`reviewVersion 4`: stores only `chapters` + `stages.chapters`, accept changes only those two fields, and the baseline is keyed by media identity). polish and translate are still full candidates. The history journal also still records the baseline per whole file, so on long recordings every AI accept is still a write of tens of MB.

## 5. Verification log

- `cargo test -p ccut-flow-core patch`: 5 passed (pure patch functions).
- `apps/cli` router test `transcript_apply_accepts_sparse_patches_and_keeps_history` added. This machine lacks the Xcode/Metal toolchain and cannot build `ccut` (the MLX build script needs `metal`), so this test and `cargo test -p ccut` must run on a machine with full Xcode.
- Mac: `swift build --target CucCutCore` passes. The 8 `TranscriptPatchTests` pass on this machine, which has no XCTest, through a standalone `swiftc` assertion stub; the XCTest version needs an Xcode environment to run.
- §3.5 (2026-08-18): on a synthetic 40k-word / 5-hour project, with `ccut serve` running: `patchTranscript` ≈1.0 s, `replaceTranscript` (5.9 MB) ≈0.9 s, `replaceTimeline` ≈0.6 s. A 70 MB over-limit body received a 413 envelope both via curl and via URLSession. Mac: 4 `WriteOutcomeTests` + 4 `ShellProjectSaveRetryTests` (scripted serve via URLProtocol: a retry lands after the connection is cut; the re-diff is empty after a lost response; an exhausted retry budget is reported only once; a 413 is not retried and the toast quotes the envelope text) + the existing `ShellProjectMediaAdapterTests` pass. GPUI: `cargo test --features runtime-shaders serve::apply` 10 tests pass (including a real TCP cut service). Web: `node --test studio/apply-fetch.test.js` 3 pass.
- §3.6 (2026-08-18): `cargo test -p ccut-timeline patch` 4 pass; `cargo test -p ccut timeline_apply` 9 pass (including `timeline_apply_patch_is_sparse_validated_and_undoable`: split + new source + element duration change land in one step, cut provenance is kept, dangling references and invalid results return 400 without persisting, one-step undo); Mac `TimelinePatchTests` 7 pass.
