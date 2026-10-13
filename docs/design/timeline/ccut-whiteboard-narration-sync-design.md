> Ported from CucCut v2. The data model names in this doc (timeline.json, Element, Source / Clip / Cut, etc.) refer to the v2 model. For how they map to v3 sequences, tracks and instances, see [element model mapping](element-model-mapping.md) and [architecture design §14](../../architecture/architecture-design.md#14-items-pending-review).

# CucCut Whiteboard Hand-Drawn Animation: Narration Sync and Text Generation (Design Draft)

> Status: **P0 + P1 landed 2026-09-18** (core: `ccutTimeline` 0.9, `ccut-render` natural / strict, `ccut whiteboard sync`, extensions to `plan` / `probe`, `transcribe --script`; App v2: property page "Pace" / "Per beat" / "Sections" / "Re-align to narration", timeline beat markers and hold ticks, new-project page tile copy; skill and reference docs synced; Web read-only 0.9, intentionally no property page). P2 (ink quality) not done. P3 (word-level anchoring on the BCF route) landed 2026-09-23 (§4 BCF branch, §12). Prototype first: `cf9fa53ee`. Review baseline: `main @ 17e329814`.
> This doc is a sequel to [`ccut-whiteboard-animation-design.md`](ccut-whiteboard-animation-design.md). It revises the timing semantics of ADR-WB05, gives `beats` explicit windows and word anchors, and chains the existing local TTS and forced alignment into a "text → whiteboard video" entry point.
> Sources: the user's 2026-09-17 proposal draft "Narration-Sync and Text-to-Video Technical Proposal" (hereafter "the proposal draft"), and four reference repos: `hi-nikola/hand-drawn-explainer-video-nikola`, `geeklee/srt-whiteboard-animation`, `ChenShuo2004/cs-board`, `masihsultani/whiteboard-animator` (review conclusions in §2, corrections to the proposal draft in §3).

## 0. In One Sentence

Two symptoms, one root: **between scenes, the picture already follows the sentences, but within a scene, how fast the drawing proceeds is still determined by the image geometry**. The default draw time `min(0.8 × duration, natural draw time)` finishes simple images in a few seconds and leaves the rest of the scene static for a dozen seconds. The skill also does not write `draw` / `beats`, so it treats this default as the finished product. The fix has three layers. At the authoring layer, immediately write explicit draw times and beats computed from the narration (no format change, no change to existing projects). At the format layer, give `beats` explicit ends, word anchors, and a rhythm of "draw at natural speed, then hold", so beats re-flow automatically with the transcript. At the entry layer, chain `ccut tts` → create project → forced alignment against known text → storyboard, so text can directly produce a whiteboard video. The goal is "the picture advances as the narration proceeds", not "something must move in every frame".

## 1. Current State Check (Verified Against the Code)

| Fact | Location | Consequence |
| --- | --- | --- |
| Default draw time `draw = min(0.8 × duration, natural)`, then `max(0.1)` | `ccut-timeline-render::element::whiteboard_draw_seconds` | The longer the scene and the simpler the image, the longer it sits still |
| Natural draw time `(path length / 900 + connected components × 0.25).clamp(1, 15)` | `ccut-render::source::whiteboard::natural_draw_seconds` | Simple images finish in 1–4 s; the 15 s cap also cannot cover a 20 s scene |
| Progress `((t − start) / draw).clamp(0, 1)`, origin fixed at the element's `start` | same as `element.rs` | With leading silence, `draw` must be measured from the element's start |
| `beats[].at` converted to `at / draw`, then clamped to 1 | `element.rs::whiteboard_params` | A beat later than `draw` is silently compressed into a zero-width window |
| Beats are only grouping + start points: the centroid falls into the first box, otherwise the nearest box; group window `[at_g, at_{g+1}]`, last group runs to `draw`; within a group, allocation by √area, ink lines 0.7 / colour blocks 0.3 | `whiteboard.rs::analyze` / `group_window` | The group window is always stretched to fill its span: with a long window and little ink, it creeps slowly; there is no concept of a pause; one connecting line can join two objects into one connected component and leak one of them early |
| `plan` gives each scene `start/end` (contiguous), `speechStart/speechEnd`, `sentenceIds`, `text`, `hint`; `probe` gives `inkRatio/components/suggestedDraw/warnings/suitable` | `ccut-kernel::cmd::whiteboard` | Cuts between scenes already follow sentences; missing is "which object within a scene corresponds to which sentence" |
| Skill step 4 says "`suggestedDraw` is for reference only, no need to set it by hand"; step 5 `element add` writes no `draw` / `beats` | `skills/ccut-whiteboard-video/SKILL.md` | Every new project falls into the default branch |
| Three places with the same draw-time definition: `ccut-editor-core::whiteboard_lane::effective_draw`, App `engine/whiteboard_strip.rs`, prototype `model-whiteboard.js::effectiveDraw` | timeline draw lane / thumbnail strip / prototype | Changing the semantics requires changing all three together |
| `ccut tts` outputs WAV; `TtsAudio { samples, sample_rate }` has no word-level timestamps | `ccut-tts`, `ccut-cli-server-reference/06/ccut-tts.md` | Timestamps have to come from alignment, not from TTS |
| `ForcedAlignment::{align, align_long}` already exist; the dubbing service's `TimingRuntime::measure` already does "TTS output + known text → VAD + forced alignment" | `ccut-speech-core::traits`, `ccut-kernel::services::dubbing::acoustic_timing` | The text entry point does not need a new alignment engine; reuse directly |
| Element `start` / `end` already accept word anchors `~<source>:<wordId>:start\|end±offset` (`TimeValue::Anchor`); the render host resolves them per element and reports `word-anchor-missing / cut / unmapped / ambiguous` | `ccut-timeline::anchors`, `ccut-subtitle-render::host_support` | The mechanism for beats to follow the transcript **already exists**; only `beats[].at` has not used it yet |
| Word ids are generated by sequence number at flow build time as `w{index+1}` | `ccut-flow-core` | Re-aligning the same script yields the same ids; when the script changes, the ids drift |
| Source time → output time projection `TimelineProjection::source_to_timeline` (`arrange.rs`) / `clamp_source_event` (`map.rs`) | `ccut-timeline` | Transcript seconds cannot be dropped straight into `beats.at`; project first, then subtract the element's start |

The proposal draft's code check in §1 ([B1]–[B11]) matches the repo, so this doc does not repeat it. The two capabilities it missed are the last four rows of the table above: **word anchors** and **`TimingRuntime`**. These two determine several of the corrections in §3.

## 2. Review of Four Reference Repos

| Repo | Where timing comes from | In-scene pace model | Borrow | Don't borrow |
| --- | --- | --- | --- | --- |
| nikola | Reuse or generate the full narration first; real audio produces SRT, then regions are split into `startMs/durationMs` | Stretch to the region window; "if the strokes are still too fast, split the scene, don't speed up the pen" | Ordering discipline (audio before timing); 4–8 s per scene, with splitting scenes taking priority; `check_drawable_regions` overlap / blank / cross-region connectivity checks; `hand-follow` only smooths the hand, never changes the strokes | Volcano Engine TTS default voice, Python renderer, HyperFrames programmatic-animation route |
| srt-whiteboard-animation | `annotation.json` per region: `sequence/startMs/durationMs/region/protectedRegions/subtitle` | Stretch to the region window; ink : colour = 2 : 1; ≥ 0.5 s hold at the end | **Allowed mask = this region minus later regions and protected regions**; regions not yet started are completely invisible; one pen in series; drawn content persists | Stateful canvas (depends on the previous frame); persisting regions into the project |
| cs-board | Whisper.cpp DTW first produces a full phrase timetable; the model only references phrase ids; the program computes ms → frames (`ceil` to 30 fps); coverage < 72% is rejected; no even-split fallback | Event-driven, not per-stroke | **The model picks anchors, the program computes seconds**; insufficient alignment must raise an error, not pretend | Remotion / fixed 30 fps / 72% threshold |
| whiteboard-animator | Default: first 70% drawn; region plan estimates by 70% character share + 30% area, no speech alignment; `element_plan` only accepts explicit `start/end` | **After drawing at natural duration, hold; do not stretch the strokes** (`_schedule_semantic_objects`: `natural = 0.28 + √area / 190`, compressing the whole only when the window is insufficient); structural connected components spanning elements go to the earliest element; unmatched connected components are merged into the last element, "none may be skipped" | Natural-speed + hold in-scene model; √area, skeleton, stroke decomposition; the rule for assigning cross-region connected components | 70% / 75% defaults and character-count timing estimates; OpenCV offline baking |

The four repos split into two camps: nikola and srt **stretch** strokes to the narration window, while whiteboard-animator draws at **natural speed, then holds**. §2.4 of the proposal draft only saw whiteboard-animator's 70% default without alignment, and missed the underlying "natural length + hold". That is exactly the right in-scene model for us: the window is set by the narration (borrowing from srt / cs-board); within the window, draw at natural speed and hold when done (borrowing from whiteboard-animator); when the window cannot fit, compress and warn (borrowing nikola's "splitting scenes takes priority over speeding up the pen"). CucCut's current state is the stretch-to-fill camp, so simple images with long sentences creep slowly and complex images with short sentences rush, and both feel unnatural.

## 3. Review Conclusions on the Proposal Draft

Kept: the three progressive steps (explicit authoring layer → semantic binding → hard masking and strokes), no change to the default for existing projects, the three clocks not being mixed, the formula "completion point = min(scene.end, speechEnd), draw measured from the element's start", the diagnostic approach, the test matrix, acceptance not using `ccut frames`, and not introducing a Remotion / Python renderer or a second TTS. The following are corrections:

| Proposal draft | Problem | Correction |
| --- | --- | --- |
| §6.5 adds a separate "authoring manifest" (`authoringVersion / narration.audioSha256 / transcriptRevision / startAnchor.wordId`) + compile cache | The repo already has the word-anchor syntax and parser, error codes, and render-host wiring; adding a manifest layer + cache = two sources of timing truth and a new set of file ownership | `beats[].at` / `beats[].end` directly accept `TimeValue` (seconds or word anchors such as `~main:w12:start`); parsing reuses `resolve_word_anchor`; "re-time automatically when the narration changes" comes naturally from the anchors (§5, §10) |
| §8.3 adds a `regions[]` branch, mutually exclusive with `draw/beats` | Two format branches, two render paths, two UIs in the property page; the mutual-exclusion rule itself admits "two sources of truth" | Incremental extension to `beats`: `end` (explicit end), per-element `pace` (stretch / natural), `strict` (hard mask), `label`; existing field semantics unchanged (§5) |
| §5.2 `displayText / spokenText / textMap` three concepts | Local TTS reads the original text directly, and the skill does not rewrite pronunciation; the three concepts are for "reading script ≠ display script", which P1 does not need | P1 rule "the original is the reading script": `ccut tts` and forced alignment consume the same text; to change pronunciation, change the original. `textMap` is deferred until there is a real need (§13) |
| §1.5 / §11 "add a reusable orchestration service for known text" | Already exists: dubbing's `TimingRuntime::measure(samples, expected)` | Extract into `ccut transcribe <project> --script <file>`: forced alignment of known text writes directly to the transcript, with no ASR (§7.3) |
| §12 P0 "integrate the existing TTS → create project → transcribe → whiteboard chain into one entry" | Today `ccut transcribe` has only the ASR path; ASR write-back would change the original's punctuation and typos | P0 allows the ASR path to run first (the script follows ASR); after P1 adds `--script`, switch the skill |
| §7.1 whiteboard flow adds a three-source panel: "text / audio / current script" | Product design §08 has decided: the "Whiteboard teaching animation" tile on the new-project page → Agent + `ccut-whiteboard-video` skill; the 2026-09-14 decision: the whiteboard directory section is not listed for now | The text entry is that tile plus the skill's text route; the App does not build a new whiteboard panel. The only editing-time entry added is one "Re-align to narration" button in the property page (§9) |
| §4.2 formula | Correct, but misses three boundary conditions: `plan`'s `end` already includes the gap to the next sentence; pure-silence scenes; `draw > duration` truncated per format rules | §6.1 fills these in; `sync` and `lint` validate `at < end ≤ draw ≤ duration`, rather than relying on clamping `at / draw` |
| §6.2 two new pure functions `resolve_narration_anchors / schedule_whiteboard_scene` | The former = `resolve_word_anchor` + subtract the element's start; the latter should go inside the existing `analyze()` rather than a new layer | Add only one `ccut whiteboard sync` (§7.4) and a `pace/strict` branch in `analyze()` (§6) |
| §10.3 diagnostic names in camelCase, `staleNarrationBinding` | The repo's validation-code convention is kebab-case; anchor invalidation already has `word-anchor-*` codes | §10 diagnostic codes merge into these; "narration changed but timing did not" = anchor missing or `label` not matching the word text, with no separate code |
| §7.2 editor left / middle / right three-pane linkage | Whiteboard elements are ordinary elements of the Timeline; the editor has no "whiteboard mode" | The property page beat list shows `label` + sentence time, click to jump; no dedicated three-pane layout (§9) |

## 4. Architecture: one narration preparation chain, three clocks

```text
文字 ──ccut tts──► narration.wav ─┐
                                  ├─► project create --media --ptype a2v
音频 / 视频 ──────────────────────┘
                                  │
        已知文本 ── transcribe --script（强制对齐，P1）
        未知文本 ── transcribe（ASR，今天可用）
                                  ▼
                 transcript.json（words[] 唯一真相，id = w1, w2 …）
                                  │
        ccut whiteboard plan ─────► 分镜（每镜 sentenceIds + 词锚点 + 画时预算）
        Agent 出图 → probe ──────► 连通域包围盒（阅读序）
        Agent 把对象映到 box ────► beats（at/end 写词锚点，box 写百分比）
        ccut whiteboard sync ────► 写 draw / pace / beats 进元素（或只 --check 出诊断）
                                  ▼
        预览 / 缩略条 / 导出：同一 analyze() + whiteboard_frame(t)

BCF 手绘分支（无线稿位图时 skill 走这条，P3，2026-09-23）：

文字（清单 out/vo.json）
  └─ ccut tts --batch --align ──► assets/vo/<段>.wav + out/vo.json.words.json（段内词 / 句时刻，同一只强制对齐器）
       └─ @cuccut/dsl narration()：place → cue / end / sceneDur / clips（场景内秒）
            └─ ccut lint narration-idle ──► 成片 ──► transcribe --script 台词稿 ──► 项目字幕轨
```

Three clocks (following design doc §3.1): **source time** (WAV sample position, transcript seconds) → **output time** (via `TimelineProjection`, including trims / speed changes / multiple uses of the same source) → **element-local time** (minus the element's `start`).
Word-anchor resolution yields output time, while `beats` semantics are element-local time, so an anchor-form `at` = resolved value − the resolved element start.
When the same source appears twice on the timeline, `resolve_word_anchor` returns `word-anchor-ambiguous`, and `sync` reports the error as is rather than guessing.

Audio stays editable (trim pauses, change voice, change speed): anchors follow `TimelineProjection`; if the script changes, ids drift, and the drift is caught by cross-checking `label` (§10). Do not clip, speed up, or pad with silence just to make things “look in sync.”

## 5. Data format: `ccutTimeline` 0.8 → 0.9 (all optional, backward compatible)

```jsonc
"whiteboard": {
  "hand": "marker", "paper": "#FFFFFF",
  "draw": 12.0,                 // unchanged: local seconds from element start to full-image completion; default formula unchanged (old projects unchanged)
  "inkFirst": true,
  "pace": "natural",            // new: stretch (default = current behaviour, group window fully used) | natural (drawn at natural speed, then frozen at completion)
  "strict": true,               // new: box is a hard mask (this box subtracts from later boxes); default false = current centroid grouping
  "beats": [
    { "at": "~main:w12:start", "end": "~main:w18:end", "box": [0, 0, 30, 100], "label": "太阳升起" },
    { "at": 4.1,               "end": 7.8,             "box": [35, 0, 30, 100] },
    { "at": "~main:w31:start",                         "box": [70, 0, 30, 100] }
  ]
}
```

Rules (on top of the original §3 rules):

- `beats[].at` and `beats[].end` are `TimeValue`s: a number = element-local seconds; a string = a word anchor, which after resolution has the element start subtracted.
  Both forms may be mixed within one element. `end` defaults to the next beat's `at`; the last beat's `end` defaults to `draw`.
- Validation: after resolution, `at_g < end_g ≤ at_{g+1}` (new code `whiteboard-beat-window`), and `end_last ≤ draw ≤ duration` (`whiteboard-beat-after-draw`). When an anchor cannot be resolved, reuse the `word-anchor-*` codes and report them at `elementId + field` (`beats[3].at`). The render host **degrades a beat whose parsing fails to geometric order** and logs an error, so the whole element does not disappear.
- `pace:"natural"`: each group is drawn at natural speed (§6.2), then holds until the group window ends. If the natural duration exceeds the group window, it is compressed to fit and emits `whiteboard-window-too-short`. `stretch` behaves exactly as 0.8.
- `strict:true`: pixel ownership is decided by box order, and **overlaps belong to the later beat** (srt rule: a region drawn earlier must not reveal later content early). Connected components that span boxes are split by pixel, and each part gets a geodesic time field within its owning beat. Foreground not covered by any box is placed after the last beat (`whiteboard-unassigned-foreground`, warning). A box emptied by this process emits `whiteboard-empty-box`. `false` = current behaviour.
- `label` ≤ 80 characters; used only for display and cross-checking, not rendering.
- Versions: read 0.1–0.9, write 0.9; bump `specVersion` accordingly; regenerate `docs/generated/`; sync the JSON schema `$defs.whiteboardProps`. 0.8 documents do not contain the new fields and are read with 0.9 semantics on load (defaults = old behaviour).

Not doing: no `regions` branch (§3); `draw` does not accept anchors (the completion point is computed by `sync` as a number and written in one place, the single source of truth); no per-beat independent `draw` (the open question in §9 of the original design is resolved by `end` + `pace`).

## 6. Rendering algorithm changes (`ccut-render::source::whiteboard`)

### 6.1 Group windows and completion point

- Group window `W_g = [at_g, end_g]` (default rules in §5), still within `[0, draw]`; `draw` remains the only completion point.
- No beats: unchanged.
- `draw` written by `sync` = `min(element end, last sentence end) − element start`; first beat `at` = first sentence start − element start. A purely silent shot (no sentence falls inside the window) writes no beats, and `draw` takes the natural drawing time (equal to today's behaviour).

### 6.2 Allocation within groups for `pace:"natural"`

```text
natural_g = Σ_i(path_len_i / 900) + comps_g × 0.25          // same basis as natural_draw_seconds; no longer clamped to [1,15]
draw_g    = min(natural_g, |W_g|)                           // if it doesn't fit, compress and report window-too-short
Within group: ink lines occupy [at_g, at_g + 0.7·draw_g]; color fills follow them (when inkFirst); √-area share same as 0.8
hold: [at_g + draw_g, end_g] the group stays still; pen lifted (hand not drawn, or resting on the last stroke)
```

Between groups is a pen-lift phase: the hand moves from the last stroke of the previous group to the first stroke of the next (linear, display only; it does not change when ink lands).
The `stretch` formula keeps the 0.8 formula verbatim, so old projects stay byte-identical (cross-checked in §11).

### 6.3 Pixel ownership for `strict:true`

Insert an “ownership” step after analysis step 3 (connected components) and before step 4 (ordering): tag each pixel with an owner in beat order (later beats override earlier ones), and split each connected component into `(region, owner)` sub-regions; steps 5–6 run on the sub-regions. A 3 px dilation must not cross an owner boundary.
The hand position still uses the “centroid of just-revealed pixels”; because sub-regions are already confined to their box, the jumping between objects disappears.

### 6.4 Memoization key

`(source_id, box size, props hash)` is unchanged; `pace / strict / beats.end / label` go into the props hash (`label` may be excluded, to avoid recomputation when only the label changes). Anchor-form `at/end` enter the hash after the host resolves them to seconds, so when the transcript changes, the key is naturally invalidated.

## 7. CLI (`ccut whiteboard`, one command with four subcommands)

Whenever any of these changes, update in sync [`06/ccut-whiteboard.md`](../cli/ccut-cli-server-reference/06/ccut-whiteboard.md), `serve_contract.rs` (if exposed through serve) and `ccut spec`.

### 7.1 `plan` (extended output)

Each shot gains:

```jsonc
{
  "start": 20.0, "end": 32.5, "speechStart": 20.2, "speechEnd": 32.0,
  "drawBudget": 12.0,                          // = min(end, speechEnd) − start; distinguish from probe's suggestedDraw (natural drawing time)
  "anchors": { "start": "~main:w101:start", "speechEnd": "~main:w140:end" },
  "sentences": [                               // each sentence in this shot: for the agent to map objects
    { "id": "s-w101", "text": "…", "localStart": 0.2, "localEnd": 3.9,
      "at": "~main:w101:start", "end": "~main:w108:end" }
  ]
}
```

`localStart/localEnd` have already been projected through `TimelineProjection` and have `start` subtracted; `at/end` are anchor strings that can be written directly into `beats`.
Shot splitting is unchanged (`--seconds` targets 12 s per shot, `--scenes` ≤ 64, never cut mid-sentence). Add a hard cap with `--max-seconds <N>`: shots exceeding it are split by sentence, implementing nikola's rule “split scenes before speeding up strokes.”

### 7.2 `probe` (extended output)

Adds `boxes[]`: bounding boxes of connected components in reading order (percentages `[x,y,w,h]`), `area`, `kind` (ink / color), and `natural` (seconds). The agent uses these to map “sun / leaves / arrow” to boxes, instead of estimating percentages by eye. The meaning of `suggestedDraw` is unchanged (natural drawing time); the docs are revised to say it is “a geometric reference, not the default draw time.”

### 7.3 `ccut transcribe <project> --script <file>` (P1, belongs to transcribe rather than whiteboard)

Known text → forced alignment → transcript: reuses `TimingRuntime` (SileroVad + ForcedAligner, `align_long` chunking, with chunk offsets taken from the real sample positions in the final WAV). Words are written to disk via the flow's build path, ids remain `w{index+1}`, and `--source-lang` determines tokenization. Mutually exclusive with `--model`; redoing requires `--yes`. Alignment quality is recorded in the stage stamp (`aligned: { mode: "script", coverage, lowConfidence[] }`). If coverage is insufficient, it **exits with an error** instead of falling back to even distribution (cs-board rule). It is useful for voice-over and any “audio with a script,” not whiteboard-specific.

### 7.4 `ccut whiteboard sync <project> [--element <id>…] [--beats <json>] [--pace natural|stretch] [--strict] [--check] [--yes] [--json]`

For each whiteboard element (all by default; filter with `--element`):

1. Take the sentences within the element's window (after projection), and compute `draw` and the first beat's `at` (§6.1).
2. With `--beats` (the `{ elementId: [{ sentenceId | at, box, label? }] }` supplied by the agent): write `at/end` anchors + box per sentence. Without it: write only `draw` + `pace`, and assign boxes to sentences by **accumulating √area ∝ sentence character count across reading-order connected components**, reporting `whiteboard-beats-heuristic` (warning). This is the fallback mapping from “object → sentence”; the timing still comes from the real speech, not from the “even time distribution” that cs-board forbids.
3. Validate against the §5 rules; write back through the same write path as `element set` (undoable, `docRev` advances).
4. `--check` writes nothing and only outputs diagnostics (§10), serving as “analysing sync issues.”

At P0 the format is still 0.8, and `sync` writes numbers rather than anchors. Once 0.9 lands, anchors are written by default, and `--seconds` can force numeric output.

## 8. Changes to the skill `ccut-whiteboard-video`

- Inputs expand to three kinds: audio / video (current), **script text** (`ccut tts --text-file … --out narration.wav` → `project create --media narration.wav --ptype a2v` → P1 `transcribe --script`; at P0, `transcribe` first), and existing projects. Voice, model and language all reuse the existing parameters and model table of `ccut tts`; voices are not listed in the skill.
- Step 2, storyboard: read `drawBudget` and `sentences[]`; split a shot when it exceeds about 15 s or a sentence has to draw more than three objects (`--max-seconds`).
- Step 3, image prompt: add “leave space between objects, do not connect objects with lines, make each object a separate block,” laying groundwork for box partitioning and `strict`.
- Step 4, `probe`: read `boxes[]`. The agent maps each sentence's objects in this shot to boxes and writes a `--beats` file; `suitable:false` still means redraw.
- Step 5, after placing on the timeline, `sync` is **required**: `ccut whiteboard sync <project> --element <id> --beats beats.json --pace natural --strict` (P0: `--beats` takes seconds, without `--pace/--strict`). Delete the sentence “no manual setup needed.”
- Step 6, verify: `sync --check` shows no error-level diagnostics, plus check three points in extracted frames of the finished video (first sentence starts drawing, one cross-beat transition, last sentence completes).
- Minimal disclosure: state only commands and inputs/outputs; do not write constants such as 0.7 / 900 / 0.25.

## 9. Three surfaces

Under the “multi-surface sync” rule, the prototype and App v2 ship in the same batch. Web is not built, per the 2026-09-11 decision (wasm only guarantees that 0.9 reads without error and falls back to a plain image).

| Surface | Property page | Timeline | Other |
| --- | --- | --- | --- |
| Prototype `designs/cuccut` | `panel-element-whiteboard.jsx`: add a three-level read-only “pace” badge to the drawing-time segment (**Follow narration** = beats contain anchors / **Natural speed** = no `draw` / **Manual** = hand-entered `draw`); the beat list shows `label` + local start/end; button “Re-align to narration” (in demo mode it only shows a toast) | `timeline-whiteboard.jsx` adds beat-point ticks on the drawing-time band; `model-whiteboard.js` adds `pace` / `strict` / `end` / `label` and validation, `effectiveDraw` unchanged | Change log + ledger; update copy in product-design §14.4 / §12.6 |
| App v2 `apps/cuccut` | `elements/panel.rs`, same as above; “Re-align to narration” → kernel `whiteboard sync --element`, going through the existing write path for element patches (undoable, external-write detection unchanged); `--check` results shown as toast / small text in the panel | `timeline/whiteboard.rs` beat-point ticks; the thumbnail strip key in `whiteboard_strip.rs` includes `pace/strict/end`; `whiteboard_lane::effective_draw` unchanged | The new-project page’s “whiteboard teaching animation” tile copy changes to “a block of text or a block of audio…”; i18n in 15 languages |
| Web `apps/web` | Not done | Not done | Ledger entry |

## 10. Diagnostic codes (shared by `sync --check` / `lint` / the render host)

| Code | Level | Meaning |
| --- | --- | --- |
| `whiteboard-speech-without-progress` | warning | Speech within the element window lasts ≥ 1.5 s in a row with no reveal progress and is not in any beat’s hold segment (the threshold is an experimental value for now; calibrate against real projects) |
| `whiteboard-window-too-short` | warning | A beat’s natural duration > group window (compressed) |
| `whiteboard-beat-window` / `whiteboard-beat-after-draw` | error | §5 timing validation failed |
| `word-anchor-missing / cut / unmapped / ambiguous` | error | Carried over; attach `elementId` and `beats[i].at|end` |
| `whiteboard-label-mismatch` | warning | `label` does not match the text of the sentence containing the anchor word — the script changed or the id drifted |
| `whiteboard-unassigned-foreground` / `whiteboard-empty-box` | warning | Ownership issues under `strict` |
| `whiteboard-beats-heuristic` | warning | `sync` did not get the Agent’s object mapping and used the fallback |
| `whiteboard-source-kind` / `element-props-mismatch` | error | Unchanged |

“Voiceover swapped, timing not updated” does not get its own code: re-aligning the same script keeps the ids unchanged, so anchors follow automatically; if the script changed → `word-anchor-missing` or `label-mismatch`.

## 11. Alignment and tests

- `ccut-timeline`: 0.9 round trip; the two spellings of `beats.at/end` and mixing them; validation codes; a 0.8 document read in and then written out is equivalent to the 0.9 defaults.
- `ccut-render`: (a) the 0.8 fixture under `pace:"stretch"` is byte-for-byte unchanged; (b) under `natural`, `frame(at_g + draw_g) == frame(end_g)` (the hold segment is stable) and `draw_g ≤ |W_g|`; (c) under `strict`, one connector spans two boxes, and before the second beat starts, the pixels inside the second box are fully transparent; (d) overlaps are assigned to the later beat; (e) uncovered foreground is sorted to the end.
- `ccut-timeline-render`: regression test reproducing the default early freeze for a “12 s shot, 4 s natural drawing time” case; after `sync` writes, the completion point = `speechEnd`.
- `ccut-kernel`: the `plan` projections of `drawBudget/anchors/sentences` are correct (including cropping, speed changes, and the same source appearing twice → ambiguous); the `sync --check` diagnostic matrix; the coverage threshold for `transcribe --script`.
- Three surfaces: add `pace/end` cases to `whiteboard_lane` / `whiteboard_strip` / `model-whiteboard.test.js`; App property-page snapshot hook.
- End to end: a 60 s text → `tts` → create project → align → 6 shots → `sync --pace natural --strict` → export; check the pen-down time of the first sentence, the completion point of each sentence, and that the final sentence is complete; pixels match under out-of-order seeks.
- The acceptance matrix follows §10.4 of the design draft, with three rows changed: “new regions” → “`strict` + `end`”; “staleNarrationBinding” → “re-aligning the same script keeps ids unchanged / a changed script reports missing or label-mismatch”; “changing the voice only invalidates alignment” → the memoization key contains only the resolved seconds.

## 12. Phases

| Phase | Content | Format | Done when |
| --- | --- | --- | --- |
| P0 Stop the bleeding at the authoring layer | skill: three input types + required `sync`; `plan` adds `drawBudget/sentences`; `probe` adds `boxes`; `ccut whiteboard sync` (writes seconds); regression test for the default formula; reference docs | 0.8 unchanged | Shots in the new flow are no longer cut short by natural drawing time; a text script can produce a finished video via the `tts` + ASR path; old projects have zero changes |
| P1 Format and alignment | 0.9: `pace/strict/end/label` + anchors `at/end`; `analyze()` natural / strict branches; `transcribe --script`; `sync` writes anchors + `--check`; property page “Pace” + “Re-align to narration” + beat-point ticks (prototype + App); product-design §14.4 / §12.6 | 0.9 | After changing voice / speaking rate, `sync` reuses the images and re-lays them out; script edits can be diagnosed; no early leak under `strict`; out-of-order seeks are consistent |
| P2 Stroke quality | Skeleton / endpoint paths replace the diffuse-feeling reveal; pen-lift hand trajectories precomputed; polygon / alpha masks; build `textMap` only if a real need arises for a read script ≠ displayed script | 0.9+ | Perceived quality; does not affect timing |
| P3 BCF track word-level anchoring (2026-09-23) | `ccut tts --align` writes `<manifest>.words.json` (`457469e95`, spec 1.191.0); `@cuccut/dsl` `narration()` (`core/runtime/dsl/bcf.tsx`) and `ccut-core` lint `narration-idle` (`b1bf5f574`, spec 1.192.0); skill `references/video/narration.md` as the main path, plus `create.md` / `qa.md` / `sketch.md` / `whiteboard.md`; overview in [`ccut-whiteboard-animation-design.md`](ccut-whiteboard-animation-design.md) §10 | Does not involve `ccutTimeline` | Within a BCF scene, every on-screen action is anchored to the real word time; a missing `words.json` or a phrase that doesn’t match is a compile error; lint reports narration that is speaking while the picture stays still for > 4 s |

The order must not be reversed: first establish the timing basis and the workflow, then work on the physical feel of the strokes.

## 13. Deliberately not done

- Do not change the default formula of `whiteboard_draw_seconds` (old projects stay the same); do not treat changing 0.8 to 0.95 as the solution.
- Do not add a `regions` branch, do not add a separate whiteboard project type, do not build a whiteboard-only three-column editor, and do not add a whiteboard section to the catalog listing (the 2026-09-14 decision stands).
- Do not allocate **time** by word-count share; do not fake sync with last-frame extension, looping hand jitter, pan/zoom, frame-rate reduction, or `-shortest`.
- Do not bring in a Remotion, Python, or Chromium renderer, a second TTS, or OCR.
- Do not build `displayText / spokenText / textMap` (in P1 the script is the read script); do not build word-level timestamps on `TtsAudio` (alignment handles that).
- Do not use `ccut frames` for acceptance (it does not include the element layer).

## 14. Sources

- Design draft: the user’s 2026-09-17 《CucCut 白板手绘动画：旁白同步与文字生成视频技术方案》 (baseline `main @ 17e329814`); its code references [B1]–[B11] have each been checked line by line.
- Repository: `core/crates/ccut-timeline-render/src/element.rs`, `core/crates/ccut-render/src/source/whiteboard.rs`, `core/crates/ccut-kernel/src/cmd/whiteboard.rs`, `core/crates/ccut-timeline/src/{schema,anchors,arrange,map}.rs`, `core/crates/ccut-subtitle-render/src/host_support.rs`, `core/crates/ccut-kernel/src/services/dubbing/acoustic_timing.rs`, `core/crates/ccut-speech-core/src/{traits,refine}.rs`, `skills/ccut-whiteboard-video/SKILL.md`, [`product-design/08.md`](../product/product-design/08.md), [`14/14.4.md`](../product/product-design/14/14.4.md), [`12.md`](../product/product-design/12.md).
- nikola `3ee5d1c0`: `SKILL.md`, `references/{voiceover,stroke-story-workflow,quality-and-delivery}.md`, `scripts/check_drawable_regions.py`, `vendor/srt-whiteboard-animation/scripts/render_stream_whiteboard.py`.
- srt-whiteboard-animation `696a724`: `SKILL.md`, `annotation.json` contract.
- cs-board `e752abe`: `docs/semantic-timing-contract.md`, `scripts/semantic_timeline.py`.
- whiteboard-animator `e6e4dbc`: `README.md`, `whiteboard_animator/animator.py` (`_schedule_elements`, `_schedule_semantic_objects`), `regions.py`.
