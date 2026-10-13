# CucCut Acceptance and Testing

> This document gives pass criteria that can be judged: how to test, what must be reached before release, what the performance targets are, and the 148 acceptance items.

This document defines the **pass criteria**. The behaviour being accepted is in [Product Design](../product/product-design.md); the mechanisms are in [System Architecture Design](../architecture/architecture-design.md); data and protocols are in [`spec/`](../spec/). For terms used here, see [Document conventions](../README.md#conventions-for-this-document); for terminology, see the [Glossary](../glossary.md).

## Contents

- [1. Scope](#1-scope)
- [2. Test Strategy and Evaluation Methods](#2-test-strategy-and-evaluation-methods)
- [3. Release Gates](#3-release-gates)
- [4. Performance Targets](#4-performance-targets)
- [5. Prescribed Behaviour When an Experiment Fails](#5-prescribed-behavior-when-an-experiment-fails)
- [6. Acceptance Matrix](#6-acceptance-matrix)
- [7. Items Pending Review](#7-items-for-review)

---

## 1. Scope

### 1.1 Items are definitions, not results

Every acceptance item in this document is an **acceptance contract awaiting implementation**. An item being written here does not mean it has been executed, and certainly not that it has passed.

- Execution status is kept in test records, not in this document.
- A table existing does not mean tests have passed. Formula re-computation, document checks or static review cannot replace tests against the product implementation.
- When a capability is not yet enabled, its items are marked "N/A (capability off)", and you must confirm that the capability is actually disabled in both the UI and the agent. An item that was not executed must not be recorded as passed.

### UI icon check

Per [Product Design §2.1](../product/product-design.md#icon-sizes-and-semantics), check at 100% zoom in a browser and in the Electron desktop window:

- The workflow canvas icon in the Rail is 20 × 20 CSS px; the sidebar icons on the Home, Space and Settings pages are 16 × 16, and Home's new-session button uses AddCircle.
- Workflow icons outside the Rail are all 16 × 16: main page actions, the Home input box and quick-start entries, menu items, model tabs, file-type icons in lists, favourites, row-end actions, session status and workspace-tag type icons. Identifying glyphs inside icon blocks such as tool cards and service cards are 20 × 20.
- Portal content in Space (viewer, menus, popovers and similar) is also 16 × 16; the same icon set must not change to other sizes such as 14, 18 or 21 px when the text size changes.
- Only the workflow icon canvases and the render boxes of shell icons are measured. Component UI graphics, illustrations and asset previews are checked against their own specs. Safe margins around graphics do not count as a size inconsistency.
- Existing button hit areas, keyboard focus, tooltips and navigation behaviour stay unchanged; icons must be recognisable in both light and dark themes.

### 1.2 Levels

| Level | When it applies |
| --- | --- |
| P0 | Must pass before the first complete closed-loop release |
| P1 | Applies when the corresponding capability is enabled |
| G | Applies to every enabled feature; not exempted by stage |

Technical items without a level marked (T, A, C, M, TM) follow the capability they verify: once that capability is enabled, the item applies.

### 1.3 Seven groups of items

| Prefix | Scope | Count | Location |
| --- | --- | --- | --- |
| `AT` | Product behaviour: results the user can observe | 36 | §6.1 |
| `UI` | Home and Space: interface structure, finished-asset library and secondary editing | 9 | §6.2 |
| `T` | Editor technology: time, subtitles, narration, dubbing, code synthesis, rendering | 40 | §6.3 |
| `A` | Architecture: multiple windows, concurrency, disconnection, crashes, upgrades | 12 | §6.4 |
| `C` | Consistency: commit safety, write rights, stop barrier, identity, budget | 12 | §6.5 |
| `M` | Runtime mechanisms: capability snapshot, batch pre-check, evidence, admission, frame fetch, resources, task contract | 24 | §6.6 |
| `TM` | Time model: units, quantisation, sampling, frame rate | 20 | §6.7 |

152 items in total.

### 1.4 What counts as a pass for an item

- Every result marked "must observe" is observed, and there is a record that can be checked (receipt, event, file, or a reference to a screenshot or recording).
- None of the blocking-level problems listed in §3.2 occurs.
- The record states the execution environment: operating system and device, versions of the Runtime and engine, versions of the relevant Adapter and model, and the fixtures used.
- Items that need human judgement (listening impressions, semantics, narrative) have a reviewer and a problem grade. Automatic scoring does not replace them.

---

## 2. Test Strategy and Evaluation Methods

### 2.1 Fixed task set

Build a fixed, repeatable set of tasks covering:

- native editing done locally;
- bilingual subtitles;
- screen recording;
- animation driven by narration;
- code synthesis;
- error recovery.

Each task includes: the material, the goal, hard constraints, the scope that may be modified, the rounds of user feedback, and the results expected to be observable.

### 2.2 Three acceptance methods

| Method | What it checks | What it cannot replace |
| --- | --- | --- |
| Automated checks | Video differences, timing relationships, receipts and events, file format and integrity | Semantics and listening impression |
| Manual viewing and listening | The picture, subtitles, sound and narrative of key segments | Structural correctness that can be judged automatically |
| Real users completing continuous tasks | Whether they can understand, take over and keep modifying | Automated regression |

Semantics, narrative effect and naturalness of content cannot be replaced by automatic scoring alone.

### 2.3 Test levels

| Level | Target | Focus |
| --- | --- | --- |
| Engine unit and property tests | Time arithmetic, quantisation, mapping, transactions, dependency invalidation | Exact rational expected values; randomly generated edit sequences keep invariants intact |
| Contract tests | Commands, receipts, events, error codes, Adapter, Driver, Provider | Shape and semantics match the spec; incompatible versions are explicitly rejected |
| Integration tests | Runtime, engine host, task scheduling, storage | Idempotence, recovery, stop barrier, authorisation |
| Fault injection | Crash points, disconnection, disk full, lost responses, lease expiry | Recovery behaviour at each point of loss matches the recovery matrix (Architecture Design §7.5) |
| Rendering consistency | Preview vs. export, different backends | Semantics and time mapping are consistent; pixel differences are within a declared tolerance |
| End-to-end | The twelve workflows and the two three-round demos (Product Design §9) | Real preview, editable structure, required finished output |
| Interface | Home, Space, editor | State expression, keyboard reachability, layout stability, synchronisation before sending |

### 2.4 Fixtures

- Fixtures use original material, explicitly licensed material, or procedurally synthesised material. Material whose source or licence is unclear is not distributed.
- Must include at least: a 30-minute narration; a short film with multi-layer transitions; a 10-second Three.js composition; a 1-minute sequential p5.js composition; a Remotion composition with audio; mixed video; translated dubbing for a long film; multilingual batch export; variable-frame-rate phone footage; a 30000/1001 fps long film.
- Only capabilities within the release scope are subject to the release gates. The remaining fixtures are kept for future expansion.

### 2.5 Tests involving models

- Automated regression may use fixed model artefacts or a simulated model service.
- Such tests only prove the process and the contract. They **must not be described as proof that a real model's effect has passed**.
- The effect of real models is ruled on by manual review records and problem grading, and the model version is recorded.

### 2.6 Recording benchmarks

Every performance or time-related benchmark must separately record:

- device, operating system, GPU and driver;
- versions of Runtime, engine, Adapter and browser;
- size of the media and video, cache state (cold or warm), and output quality tier;
- `editFps`, `outputFps`, the timebase of the source material, and the fps of the code package;
- input precision, `timeContractVersion`, and the sampling and rounding policy;
- the logical range and the tail after encoding.

Frame rates in source-code comments, or the author's estimates, are not measured benchmarks.

### 2.7 User research

User research first establishes a baseline, then sets formal completion-rate targets. Do not invent current conversion rates or industry comparisons. For the definitions of success metrics, see Product Design §11.4 and §11.5.

---

## 3. Release Gates

### 3.1 Gates

To release a stage, all of the following must hold at the same time:

1. all G items within the enabled scope pass;
2. the P0 items required by that stage pass (§3.3);
3. there is no blocking-level problem listed in §3.2;
4. performance targets have measured records on the release test matrix (§4);
5. no capability that is not enabled is actually in the on state; the UI and the agent do not claim that it can run.

### 3.2 Blocking-level problems

If any of the following occurs, do not release:

- unauthorised data leaving the system;
- confirmed loss of video content;
- locked or protected content modified by mistake;
- automatic duplicate payment while the state is unknown;
- a result applied to the wrong target;
- reporting export success with no file;
- describing a candidate as applied, or describing an unpublished export as the finished film;
- untrusted code crossing its isolation to read files or access the network.

### 3.3 Exit criteria per stage

| Stage | Exit condition | Main items |
| --- | --- | --- |
| R0 Experience and contract baseline | No gaps in snapshots and events; command retries and commit safety under crashes | A01–A05, C01–C03, C05, C06, TM01–TM07 |
| R1 Delegable editing | Text editing, adding elements, undo, preview and export usable; no wrong object modified | AT-04, AT-11, AT-18, AT-24, AT-25, UI-01–UI-06, T05–T08, T30–T32, M01, M02, M06 |
| R2 P0 two closed loops | Each of the two loops passes three consecutive rounds; all enabled G items | All P0 AT and UI; items in T, A, C, M, TM that belong to enabled capabilities |
| R3 Full version | Original version not harmed; source can be maintained; expiry of input and cost reconciliation complete | All P1 AT; T17–T20, T26, T27, T38 |
| R4 Hardening and scale | Measured report exists; unverified fast paths remain off | All metrics in §4; M07, M08, M11, M12, M20 |

The first half of R0 and R1 is delivered as four starter versions, each with its own exit:

| Version | Exit condition | Main items |
| --- | --- | --- |
| 0.1 Most basic agent | One turn completes a full round trip through the Driver; interrupts and approvals go through the Harness; sessions can be reopened; the event stream has no gaps | AT-20, AT-34, A05, A07, A10, C06 |
| 0.2 Shell | Entry switching, project and session lists usable; a UI reload or disconnect does not cancel a running turn | UI-01, UI-02 parts not involving video; A04 |
| 0.3 Player | Picture, sound and subtitles in sync; no file modified | T30 |
| 0.4 Editor | Same as R0 | A01, A03, C01–C03, C05, T05, T06, TM01–TM07; the part of UI-04 that opens video |

The content of each stage and starter version is in Product Design §11.1. The P0 exit is at R2.

### 3.4 Performance and semantic quality

- Performance targets are measured explicitly on the release test matrix. Complex code scenarios that cannot meet their targets must narrow their supported scope or use a labelled proxy preview. Do not use averages to hide an unusable device.
- Semantic quality is ruled on by manual review records and problem grading. Suggested values are not packaged as guarantees.

---

## 4. Performance Targets

These are **targets awaiting benchmark calibration**, not measured results.

| Metric | Target | Must record |
| --- | --- | --- |
| Receive an action and display the scope it is bound to | Local P95 ≤ 500 ms | Action type, video scale, UI and Runtime versions |
| Stop new calls and automatic commits | Local P95 ≤ 1 s | Confirmation point of the stop barrier, linearisation point of the commit, external Jobs that could not be cancelled |
| Locate common native content in the hot cache | P95 ≤ 150 ms | Frame rate and resolution, device, cache state, input frame and displayed frame |
| Pure native subtitle video | Number of code-browser Worker starts is 0 | Actual execution path |
| Second export after changing only native subtitles | When no changed transitive dependencies exist, the number of frame-seek calls inside the code is 0 | Cache key, background dependencies, reasons for hits and invalidations |
| Memory for long films | Controlled by the streaming window; does not grow linearly with length | Peak RSS, observable GPU memory, buffer pool, backpressure |
| Scrolling and zooming of large timelines and long scripts | Number of mounted nodes and update volume controlled by the visible-window budget | Scale tier, visible window, P95 frame time |

Notes:

- The target for "stop" refers to stopping new calls and automatic application, not to the vendor having stopped billing (Architecture Design §7.4).
- Scale tiers, visible windows and P95 thresholds only become release gates after being frozen on a fixed device.
- Service recovery, session recovery and task recovery are measured separately.

**M12 baseline (2026-10-06)**: first measurement on one development machine of "scrolling and zooming of large timelines and long scripts", used to set scale tiers and visible windows. A single machine is not a frozen device matrix, so these numbers are not gates. The same-scale synthetic fixture and the same method can be re-run with `npm run bench:panels` ([Development Workflow §2](../development-workflow.md#2-verification)).

- Scale tiers (procedurally synthesised fixtures): large tier has 5000 subtitle lines, 32500 words of transcript (1001 segments), 5000 translation lines, a timeline of 2001 items (1000 video clips, 1000 dubbing blocks, 1 subtitle track) and 999 cut bands, and a length of 3:40:00. Small tier has 1000 lines, 6500 words (201 segments), 1000 translation lines, 401 items and 199 cut bands, and a length of 44:00.
- Visible window (Architecture Design §11.5): subtitles, translations and the script list mount one screen's worth of rows above and below the viewport. The timeline is horizontally clipped, with one extra screen on each side of the visible time window. When the whole film is in view, the entire timeline is in the window and all items are mounted.
- Environment: Apple M2, 16 GB, macOS 27.0; commit `62296f0e` (the “进入译文” line, plus a candidate filter for `projectSpeech`); the renderer process is a production build using the plugins and options in `apps/desktop/electron.vite.config.ts` (JS not minified, CSS minified); headless Chrome 154, page 1440×813, Space sidebar collapsed, Typekit fonts blocked; 1-minute load average 2.8–5.0 at the start of testing; 3 fresh loads per tier.
- Method: on each fresh load, first walk through each panel and mode (so on-demand modules are loaded), then measure. Scrolling moves a fixed number of pixels per frame via rAF (40 px, and 200 px also tested), 240 frames each time, reporting the P95 of frame intervals. Operations take the longest task (longtask; only tasks ≥ 50 ms are reported).

| Item | Small tier | Large tier |
| --- | --- | --- |
| Subtitle list mounted (scrolled to midpoint, viewport height 438 px): rows / elements | 17 / 219 | 17 / 219 |
| Translation list mounted (viewport height 337 px): rows / elements | 9 / 83 | 8 / 74 |
| Script mounted (viewport height 586 px): segments / elements | 11 / 592 | 12 / 637 |
| Timeline 100% mounted (viewport width 945 px): items / cut bands / elements | 14 / 7 / 716 | 13 / 7 / 703 |
| Timeline at maximum zoom mounted: items / cut bands / elements | 3 / 0 / 309 | 3 / 0 / 309 |
| Continuous scrolling of lists and timeline (100%, maximum zoom), P95 frame interval | 16.7–16.8 ms, no frame over 50 ms | Same |
| One zoom step on the timeline (between 100% and the adjacent level) | No task ≥ 50 ms | 1 in 18 at 64 ms |
| Whole film in view (all items mounted) | 50–97 ms | 440–630 ms |
| Tab switching: among script, subtitles, elements | No task ≥ 50 ms | Same |
| Tab switching: enter translation (source + translation) | No task ≥ 50 ms | 71–142 ms |
| Replace all subtitles / undo | 112 hits: ≤ 67 ms / 59–71 ms | 556 hits: 240–301 ms / 418–490 ms |

---

## 5. Prescribed behavior when an experiment fails

The following capabilities need experimental verification. Product behavior is already fixed; experiments only decide whether a capability is enabled. **When verification does not pass, follow the right-hand column; the implementer does not decide ad hoc.**

| Item to verify | Prescribed behavior when it does not pass |
| --- | --- |
| Subtitle layout consistency between Rust and WASM | Export-Exact uses the same implementation; Interactive preview marks the difference |
| Browser alpha and video presentation sync across operating systems | Disable the faulty fast capture path; use the verified baseline path |
| Remotion props, audio, transparency and range export | Turn off unsupported compositions per the capability matrix; do not package them as general support |
| GPU surface sharing across processes | Use a controlled CPU buffer or intermediate files; do not promise zero-copy |
| Resumability of sequential checkpoints | Replay from the start, or use a verified segment cache |
| Provider cancellation and idempotency | Best-effort state plus reconciliation; do not pass it off as exactly-once |
| Listening quality of multi-language duration auto-fit | Mark as `needs-fit` and hand to human review; do not force the export |
| Pixel consistency across different GPUs | Fix the execution environment, or declare a tolerance; do not reuse a strict cache across environments |

---

## 6. Acceptance matrix

### 6.1 Product acceptance AT-01–AT-37

| ID | Level and scenario | Result that must be observed | Corresponding requirement |
| --- | --- | --- | --- |
| AT-01 | P0: only a script is given, request for a short video | Deliver a real preview, an editable video and the requested final cut, not just a plan | CRE-01, AG-06 |
| AT-02 | P0: an existing MP3 or SRT, make a whiteboard explainer | The original audio is kept; visual events correspond to a real explanation | CRE-02 |
| AT-03 | P0: the user does not specify an animation technology | The system selects a verified capability and does not force the user to choose a framework | AG-02, CRE-04 |
| AT-04 | P0: add subtitles to a video | Subtitles are independent and can be turned off; original sound is kept; applying twice does not produce a second track | LNG-01 |
| AT-05 | P0: only sentence-level subtitles | Do not fabricate word-level sync; state the alignment or degrade explicitly when needed | LNG-01 |
| AT-06 | P0: Chinese and English subtitles have different word order | Each language shows reasonable Cues separately; keep natural translated sentences | LNG-02 |
| AT-07 | P0: style is changed after the user has fixed line breaks | Manual line breaks are not overridden by automatic layout | LNG-01 |
| AT-08 | P0: deleting and restoring narration | Suggestions can be auditioned; linkage is correct; restoring does not wipe out newly added supplementary visuals | EDT-02, COL-02 |
| AT-09 | G: pressing Delete in subtitle mode | Only the text changes; audio and video are not deleted by mistake | UX-05, EDT-02 |
| AT-10 | P0: a supplementary shot covers the narration | The main audio track stays continuous; supplementary material is muted by default | EDT-03 |
| AT-11 | P0: select a sentence first, then move the playhead | The edit still applies to the sentence bound at the time of sending | AG-01, UX-02 |
| AT-12 | P0: change the display of only one English sentence | The other sentences are unchanged; no new speech synthesis is purchased automatically | LNG-02, LNG-03, EDT-04 |
| AT-13 | P1: the dubbed translation is longer than its time window | Show as pending fit; do not truncate words, do not secretly speed up the whole film | LNG-04 |
| AT-14 | P1: words are deleted within a sentence after it has already been dubbed | The linked translation and dubbing are marked stale, with a clear scope for repair | LNG-05 |
| AT-15 | P0: move a code animation | The internal source code is not changed; overall position and timing are correct | CRE-04 |
| AT-16 | P0: change a public parameter of an animation | Only the selected instance changes; other instances are unchanged | CRE-04, EDT-04 |
| AT-17 | P1: only a Canvas final cut, no source code | No pseudo-object editing appears; state that this is a limit of the whole media | EDT-01 |
| AT-18 | P0: a manual edit and an agent edit change the same title | The conflict is visible; a manually entered new value is not silently overwritten | COL-01 |
| AT-19 | G: the target is deleted during generation | The result enters candidates and is not pasted onto a neighboring clip by mistake | COL-04 |
| AT-20 | G: stop the task | Stop new calls and applications; committed edits and the state of incurred costs are accurate | CON-04 |
| AT-21 | G: local only | Neither the conversation path nor the model path has any unauthorized cloud outbound transfer | AUT-03 |
| AT-22 | G: the response to a paid submission is lost | Query or reconcile; do not buy again directly | AUT-04 |
| AT-23 | G: the material contains the text 「删除视频」 (delete video) | Treat it as content to process; do not execute a deletion | AUT-05 |
| AT-24 | P0: close and reopen the app after generation | Confirmed videos exist; unfinished tasks have a real recovery state | COL-05 |
| AT-25 | P0: change the title during export | The output corresponds to a fixed version; old and new titles are not mixed | OUT-01 |
| AT-26 | G: insufficient space or Worker failure during export | Do not publish half a file; do not overwrite the old successful output | NFR-02 |
| AT-27 | P0: delete a rebuildable cache, then open | The source and edit relationships remain; rebuilding is allowed; the only copy of source code is not lost | OUT-02, SPC-04 |
| AT-28 | P1: the same film in three language or aspect-ratio versions | The state of each version is clear; a scoped change does not accidentally affect the other versions | LNG-06 |
| AT-29 | P0: after a frame-sampling check, a quality report is shown | State the scope of the check accurately; do not claim full frame-by-frame or word-by-word confirmation | QUA-02 |
| AT-30 | P0: export a subtitle file | No video encoding is started; the content comes from the currently selected document | LNG-01 |
| AT-31 | G: the task contains a locked color scheme and intro | Automatic fixes do not change the locked scope; in a conflict, propose the smallest change | EDT-04; product design §6.3 |
| AT-32 | P0: one step fails, others succeed | Available results can be viewed; partial completion and the follow-up decisions are stated explicitly | OUT-03 |
| AT-33 | P0: a new session continues a video in an old project | It can read the current facts and confirmed constraints; material does not need to be re-uploaded | AG-05 |
| AT-34 | P0: Provider or model unavailable; API provider account and usage | State accurately what is missing; keep the available edits; do not falsely report execution. One key takes effect for all capabilities this provider implements; capabilities marked P1 are not reported as available; with several accounts, the first enabled one that has a key is used in order, and an error does not switch accounts; usage separates reported, estimated and unknown costs and does not merge them into one number | SET-01, AG-03 |
| AT-35 | P1: apply a template to a new video | New parameters do not change old instances; no keys or private material are carried over | AST-04 |
| AT-36 | P0: three consecutive changes in each of the two closed loops | Content, timing, versions and editability are all preserved; the final output is usable | product design §9.13 |
| AT-37 | P1: local music generation (`generateMusic`): no model pack installed, model weights installed but no audio.cpp engine component, all present — three machines, reached respectively from Settings, the Tools page, the editor AI tools and the agent | Only a local provider, no factory default: the capability view reports `not-installed` with an install remedy when no model pack is installed; when the weights are present but the engine component (`audiocpp-engine`) is not, it likewise reports `not-installed` (`reason: 'incomplete'`, with `detail` naming this component); the two cases have different `detail`s and do not falsely report availability. The engine is a shared component of the model pack, not a managed external tool: when installing the model pack, it is confirmed once together with the weights and downloaded together; the displayed size already includes it; the component list shows it and its license (Apache-2.0); 「修复」 (Repair) only downloads the missing engine component; when the agent calls `models_install` with the music model pack, the same single confirmation applies; when the host platform has no engine package, the model pack reports `error` / `unsupported`; the downloaded archive is verified against the registered sha256, only files at the package root are extracted, and a bad package fails and leaves no directory; once installed, it is visible to the capability view without a restart, and when the last model pack that uses it is deleted, it is reclaimed too; when `CUCCUT_AUDIOCPP_CLI` points to an existing file, it directly satisfies the engine component (`installed`, `bytes: null`, install plan `keep`, no download), and if the pointed file does not exist, the component counts as missing; when the engine is only in `PATH`, the model pack is still `incomplete` (`PATH` is only a fallback at task execution time); when a task cannot find the engine, it fails with the `musicEngineMissing` message (`details.reason: 'not-installed'`); after installation, if `audiocpp_cli --version` does not read as `audio.cpp <version>`, the directory and archive are deleted and it fails with `MODEL_DOWNLOAD_INTEGRITY`; the model pack's license (CC-BY-NC-4.0, not for commercial use) is visible in the model list, the capability view and the tools page; the Settings › 音乐生成 (Music generation) page can install (including the engine component), check, and 「试听」 (Preview: a fixed few seconds of instrumental, only for choosing a style, not generating a whole piece); Tools › 生成音乐 (Generate music) produces one WAV audio entry, and the page states that it takes several to over ten minutes; the editor AI tool 「生成配乐」 (Generate background track) in the 「声音」 (Sound) group can be clicked without a script, and when the tool opens, the target duration is prefilled from this video, and the finished audio is added to the music track; when the video is longer than the single-generation cap, it is not silently truncated: the cap is prefilled and stated, and when added to the music track it loops to fill the length, with crossfades at the seams and a fade-out at the end, with no speed change, and as one transaction that can be undone as a whole (the prototype `designs/cuccut/app/model-music.test.js` and the UI `packages/ui/src/model/music-bed.test.ts` verify the layout method); `song` without lyrics, `instrumental` with lyrics, and a duration beyond the model's cap are all rejected at submission, and a result that reaches the budget carries an `output-truncated` warning rather than failing; the agent submits via `music`, and `models_capabilities` lists six capabilities | SET-01, AG-03, product design §2.7, §7.6 |

Automated checks related to export (`packages/runtime-core/src/exports/exports.test.ts`, test names include the ID): AT-05 “sentence-level document has no per-word timing”; AT-25 “frozen: changes after submission do not affect this export”; AT-26 covers only that cancellation leaves no half file, while insufficient space and render failure are not yet automated; AT-30 “subtitles and script”, exporting subtitles does not start video encoding. Audio export progress (`packages/runtime-core/src/exports/audio-export.test.ts`, real ffmpeg): when loudness normalization is on, the mix only reaches halfway, the master follows the ratio it reports and completes the rest without going backwards, and the Render Worker's master progress is passed to the caller through `masterRunner`. The same file also verifies that the mix filter graph is read from a file: an envelope with twenty thousand breakpoints (the filter graph exceeds 1 MiB, which on the command line would be `E2BIG`) still mixes and is ducked accordingly; the filter-graph file is deleted after use; the detected syntax and the old option `-filter_complex_script` are each run on the ffmpeg of this machine. `export-helpers.test.ts` verifies that the arguments contain only the option that reads a file and a file name, with the option chosen according to ffmpeg's documentation.

Automated checks for final video export:

- Source codec compatibility (`packages/runtime-core/src/exports/video-export.test.ts`): SDR VP9/AAC MP4, VP9/Opus WebM, VP8/Vorbis WebM and AV1/AAC MP4 are exported with the default MP4 configuration through the real Runtime, Engine Host, Render Worker and FFmpeg; verify the H.264/AAC output, dimensions, duration, sampled frame colors and sound frequency, and confirm that the source file digest and video version are unchanged.

- End to end (`packages/runtime-core/src/exports/video-export.test.ts`, real Engine Host, Render Worker and ffmpeg, test names include the ID): A11 “video + image + crossfade + sound” — streams, frame count, dimensions, encoding, BT.709 tag, the colors of sampled frames (the midpoint of a crossfade is the average of the encoded values) and the sound frequency; it also covers range, output height, frame rate and WebM, and the case where width and height are both given but the aspect ratio differs from the canvas: the picture is centered, letterboxed top and bottom, and picture-in-picture scales to the canvas (frames are checked by pixel). AT-25 / T31 “frozen” — after submission, all instances are deleted, and the final video is still the version at submission. AT-26 “cancel” — stop the Worker and ffmpeg, clear staging, leave no file; “Worker crash” — SIGKILL the Worker during rendering (its ffmpeg is stopped first so it does not exit by itself when the pipe breaks); the task fails with `EXPORT_RENDER_FAILED`, staging is cleared, and ffmpeg is killed along with the process group (POSIX); insufficient space is not yet automated. T35 “graphics and text”, “content that cannot be drawn” — the built-in fonts ship with the render kernel; content that cannot be drawn is rejected by default and listed item by item, no task is created, and with `skip` a warning is issued item by item; SVG is drawn into the final video as vector rasterization. “Waveform” — the waveform is drawn from a spectrum computed from the frozen sound file (sound outside the export range is also frozen); silent segments and loud segments are drawn differently, and no hint is given when the spectrum is missing. Caption burn-in and `burnCaptions: false` are each one item. “Local fonts” — the local font library is scanned only in a temporary directory via the test hook `CUCCUT_FONT_DIRS` (it holds a probe font from the repository, so the test does not depend on what fonts this machine has installed): families beyond the built-in fonts are found by family name and drawn into the final video; the frozen snapshot records each face's file, its index within the file, and its digest (or fallback when not found); when the font file changes before execution (through a wrapper script that modifies the font file and then starts the real Worker), the task fails with `FONT_MISSING`; `fonts.resolve` gives the preview the same face from the same file, and by interval it returns a table with 206 and bytes identical to that segment of the file; a face that is not found is drawn with the fallback font and reports `EXPORT_RENDER_NOTE`; an empty face list is rejected. “Fonts downloaded on demand” — a font directory with only one family is injected, the download address is rewritten to a local fake service (no network): on the first export the frozen snapshot records it as `download`, and it is drawn into the final video after downloading in the task (checked by pixel); the second export freezes the file directly from the download cache (`source: 'downloaded'`); after `fonts.autoDownload` is turned off and the cache is cleared, the third export is drawn with the fallback font, records `fallback: 'not-downloaded'`, and issues the `FONT_NOT_DOWNLOADED` warning (`font` carries the family, weight, fallback family and reason); `fonts.usage` run through the real Render Worker identifies this family, its status is downloadable, and it is replaced by `Noto Sans SC`; when automatic download is off, a `download` request does not download. “Missing assets” — a video with only text and no material, and after a linked material file is deleted or modified (export is rejected with `ASSET_MISSING` / `ASSET_CHANGED`), `fonts.usage` still returns the same list. The checks for the download itself are in `packages/runtime-core/src/fonts/`: `font-service.test.ts` (fake service: the same face is downloaded only once at a time; wrong stylesheet or file address; chunked responses; bad files; family name mismatch; retry with backoff after 5xx; cancellation (the font list records `CANCELLED`); cooldown after failure and manual retry; settings and strict offline; state and order of the font list; faces in use by export remain on deletion and clearing; the export plan and download; cancelling an export only stops the downloads it started; fonts used by specimens and videos), `google-fonts-catalogue.test.ts` (font catalogue, weight alignment, request addresses, response parsing, host restriction, size limit, no redirect following), and `font-engine.test.ts` (the real engine host verifies the downloaded file; families built into the kernel match the Runtime's list); `packages/ui/src/render/font-downloads.test.ts` and `local-fonts.test.ts` verify that preview waits for downloads to finish before injecting, and that faces arriving earlier in the same batch are injected first; `crates/frame-render/tests/census.rs` lists the faces built into the kernel and flags families the kernel does not have. The interface's font library is in `packages/ui/src/model/font-library.test.ts` (row-end states including downloading, failed and cancelled; ordering of segments and freezing; the four states of the font strip; the hint before export, the preparation phase and the fallback list after completion; mirror address validation; the downloaded list and deletion), `font-list-window.test.ts` (the 1944-row virtual list draws only what is in view) and `packages/ui/src/state/font-library-store.test.ts`.
- Pixel golden standard (`crates/frame-render/tests/`, small canvas, verified against computed pixels): `compose.rs` covers background color, placement, cropping, opacity, layer order, mirroring, output scaling, all transition types (including wipes on a rotated picture-in-picture and one-sided transitions), and layers and transitions that cannot be drawn are each rejected or skipped rather than drawn as blank; `elements.rs` has cases for each element kind (image, video, text style, shapes, the order and blur of `fx`, stroke and shadow (a stroke on a rotated instance hugs the rotated outline, and shadows are offset in the canvas direction), masks and tiling, the three slots of element animation, keyframes, timing, progress bars, waveforms, confetti, hand-drawn, placeholder boxes, template stickers and material stickers (SVG material is rasterized in the kernel from its bytes and recolored by `fillOverrides`; when unreadable it reports `asset-undecodable`), Lottie (including embedded bitmaps and `fillOverrides`; images inside a `.lottie` archive and embedded SVG images; external images not found in the package report `lottie-asset-missing`), whiteboard, pre-rendered stand-ins, template layers) and the reasons when something cannot be drawn; `captions.rs` covers caption anchors, bilingual stacking, captions that follow the material clock, the boxed caption style (`cuccut.boxed-caption-style/N`, including left and right alignment flush with the box edge, and that when word-by-word reveal is selected, words light up one by one, while after the full line is spoken it matches the no-animation version), unreadable captions are rejected or skipped, words taken from the transcript (unspaced Chinese text advances character by character; cut and hidden words are not drawn; when there is no transcript the whole sentence changes together), emphasis and per-sentence styles of designed captions land by word ID and sentence ID (emphasis written on a multi-character word lands on every character), a bottom template bar lifts the captions while the caption layer does not draw the template again, and an engine reused when the size or document changes draws the same as a new one; when the caption style's font family is missing everywhere, every frame reports the missing font. `elements.rs` additionally verifies that when a text element's font family is missing, it is reported on every frame; built-in fonts are not reported; once a font is supplied, it is no longer reported and the text is reflowed with the new font. `spectrum.rs` covers waveforms listening to the sound: material spectrum is taken at the source time; sequence mixing follows the volume while a single material played alone does not multiply by volume; missing material spectra are reported item by item until delivered; `speaker` moves only when that speaker is talking (drawn as silent and reported when there is no transcript or no such speaker); `alwaysShow: false` does not draw after 0.5 seconds of silence; and a spectrum computed from a synthesized tone file is deterministic with peaks at the corresponding frequencies. The ported render kernel also carries v2 tests and benchmark images (architecture design §14 “porting the render core”). `crates/render-graph/tests/video_plan.rs` verifies output dimensions: when only height or width is given, the even-number value follows the canvas aspect ratio; when both are given, the picture is fitted as large as possible, centered, with even numbers (left and right letterboxing, and top and bottom letterboxing); the unit tests of `export-worker` verify that the picture lines fall between the black bars. `text_measure.rs` measures text boxes: a box sized from the measured width does not wrap, and when a wrap width is given, the box width is that width. Local font resolution (`crates/font-files/tests/`, a copy of the built-in fonts in a temporary directory and a two-face font collection assembled in the test): choosing the face by weight matches the CSS matching of the layout engine; family names are found case-insensitively or by PostScript name; when the second face in a collection is chosen, the extracted font contains only that face, and the bytes assembled by interval equal those extracted directly; bad file headers and out-of-bounds tables are rejected; over the limit it is not loaded; unreadable directories are skipped; `CUCCUT_FONT_DIRS` replaces the system directories. The unit tests of `crates/engine-host` verify that the bytes of `fonts.resolve` assembled from the file by the extraction method it gives equal those extracted directly, that the request has an upper limit, that the first font scan answers on a separate thread, that every response is a single line, and that after a scan, a font installed later is rescanned when it is not found next time. The unit tests of `export-worker` verify that frozen fonts are loaded only once after digest checking, and that a changed or missing file is `FONT_MISSING`. `crates/frame-render/tests/census.rs` verifies the faces recorded during typesetting (including captions and layers that appear later; built-in families are not counted). On the preview side: `bindings/preview-wasm/tests/entry.rs` runs through the linear memory, injects fonts, and after the picture and transcript emits a frame, and the measured text box matches the result of the native renderer with the same fonts; `packages/ui/src/components/editor/thumb-scenes.test.ts` draws thumbnails with the built WASM; `entry.rs` additionally verifies that families beyond the built-in fonts are reported missing on every frame, and after the host sends them via `add_font` they are no longer reported and are reflowed. `packages/ui/src/components/editor/preview-engine.test.ts` “local fonts” verifies that a face named among the reported missing families is requested once from the host (built-in families are not, and a later bold of the same family is still requested), that it is not reported while being fetched, that it is drawn after injection, and that a face that cannot be fetched is reported again; `packages/ui/src/render/local-fonts.test.ts` verifies that the table assembled from interval-fetched faces is concatenated, that several queries landing on the same face ask only once, that at most 32 are asked at a time, and that when the whole file is returned (200) it is not read and fails; `render-planner.test.ts` additionally uses the built WASM to verify that a local font sent in also reaches the instance that was split off first, and that later-split instances request it again; with a small module that traps, it verifies that on reload it is requested again per `load` (requests made during the wait are also requested, and those that cannot be fetched are skipped), and that it counts as ready only after all have been requested back; `packages/ui/src/components/editor/text-measure.test.ts` verifies that the box of new text is measured only after the kernel has loaded, that when the kernel traps halfway through measuring, it waits for it to reload and then re-measures the whole group (with a retry limit), and that the text is not created if the kernel fails to load; `packages/ui/src/render/render-planner.test.ts` uses a small module that traps to verify that after reload `recovered()` is honored and `onRecovered` is still called, and that when reload fails, both the one waiting and those who come to wait later are rejected. The desktop production build (`electron-vite build`) fails when the preview fonts are not all included in the renderer process output; `npm run check:file-fonts` opens the production renderer build in Electron via `file://`, verifies that the render kernel injected every font in the output and measured text boxes through the kernel, and fails if any font cannot be read. It builds first and needs Electron to be able to start, and it is not part of `npm test`.
- Preview and export share the same frame rendering implementation (`frame-render`, architecture design §9.1); the only difference is the source of the picture (§9.11). Parity check: `crates/frame-render/tests/parity.rs` renders, along the export path, a scene covering every kind of picture instance, every transition, `fx`, masks, tiling, element animation, keyframes, template layers, captions, waveforms and the three output switches, and records each frame's SHA-256 and the input in a fixture; `packages/ui/src/render/parity.test.ts` feeds the same input into the compiled preview WASM and compares the bytes frame by frame. When the kernel's drawing changes, rewrite the fixture with `CUCCUT_UPDATE_PARITY=1`.

Desktop export destination confirmation: for a single file, clicking the final export button opens the system save dialog, using the default name in the summary and the selected directory; the name and path are passed into the task. Cancelling or a dialog failure creates no task; repeated clicks while waiting for a selection do not open a second dialog. For multiple files, the directory is selected only once. The web does not call the local save dialog. The Windows path branch covers drive letters, UNC, extended paths, mixed separators, spaces and non-ASCII names; real interaction with the system dialog still needs verification on the target platform.

Automated checks for portable packages and project export (the portable enhancement of OUT-02, architecture design §5.8, §9.13):

- End to end (`packages/runtime-core/src/exports/portable.test.ts`, real Engine Host and ffmpeg; the test uses only temporary directories and freshly made small material): export then open — the new video's document body, instances and material digests are the same as the original video, all material is gathered into the new video, and after opening there is no missing material; nothing in the package's manifest, snapshot or document looks like an absolute path, and none contains the home directory, temporary directories or the project directory; in Space it is a `package` entry with a file size. Preflight — unreadable material is rejected item by item and no task is created; with `skip`, the manifest marks it `missing` and after opening it is a missing linked asset; if the target already exists, it is rejected. Cancellation (AT-26) — no package is left, and no hidden temporary files are left. Project — clips, frame rate and path-based references in xmeml; what it cannot express is warned about item by item; rejected when there are no clips.
- Archive (`packages/runtime-core/src/exports/package-reader.test.ts`): the system `tar` can list the written package; path traversal, absolute paths and files outside the layout, symbolic and hard link entries, bad checksums, a higher packaging version, modified content, and manifest entries that do not correspond one-to-one with the archive are all rejected; a pre-check for insufficient space (injected `statfs`).
- Engine (`crates/video-engine/tests/package.rs`): an unpacked package builds into a new video with the same content and version; a modified or higher-version package is rejected and leaves no directory.
- Entry points: opening through the Web service only accepts files in the project (real paths, including symbolic links pointing outside), and the export directory is restricted in the same way (`services/web-service.test.ts`); the two kinds and risk levels of the agent export tools (`agent-tools/export-tools.test.ts`, the approval summary writes out dimensions when width and height are both given); CLI arguments (`apps/cli/src/export-args.test.ts`, including only `--width` and both width and height given); the aspect ratio in the export panel (`packages/ui/src/model/export-settings.test.ts`: presets with the same ratio as the canvas are not listed, the short side is set by the resolution preset, the long side is derived from the aspect ratio and rounded to an even number, and width and height both given); end to end for `cuccut import-package` (`portable.test.ts`: the CLI connects to the test-started Runtime via `runtime.json` in the test directory and creates a new video with the same content in the project specified by `--project`; a bad package exits non-zero, the error code is on stderr, and no directory is created). Filling the disk during export (`EXPORT_INSUFFICIENT_SPACE` while running) has no automated check.
- Leftover cleanup: `exports/leftover-files.test.ts` verifies item by item that only export temporary files named by the app, old enough, and not used by a running task are deleted, as are the staging directories for opening portable packages; user files, names that do not match, directories or symbolic links, items in subdirectories, and recently written or in-progress items are all kept; `portable.test.ts` simulates the two kinds of leftovers from a forced kill, which are deleted after restart, while recently written items and items with non-matching names remain.

### 6.2 Home and Space acceptance UI-01–UI-13

| ID | Level and scenario | Required observable result | Related requirement |
| --- | --- | --- | --- |
| UI-01 | P0: Open the app, switch between Home, Space and tools, enter model settings and background tasks, adjust the three column widths, and collapse the sidebar and feature area; after the sidebar is collapsed, hover the Rail entries and the sidebar toggle in the title bar | Primary entries in order: Home, Space, tools; after the divider, secondary entries in order: services, background tasks, and background tasks keep a running-count badge; Settings is fixed at the bottom, model configuration is moved under Settings, and old model links still open the matching config page; the icon for the Space entry is unified as S2 Asset; Home has three columns: sidebar, conversation area and feature area; with the sidebar collapsed, hovering a Rail entry or the sidebar toggle for 100 ms floats that area's sidebar out, and “固定侧边栏” (pin sidebar) restores it as a permanent sidebar; it closes on Esc, clicking outside, a route change, or clicking the current location inside the overlay; Settings does not float out; while the desktop overlay is shown, the embedded web view gives way and is restored after it closes; each work entry remembers its last position, and Home and Space each keep their own layout; switching entries does not interrupt running tasks and does not change the selection or unsubmitted drafts | UX-06 |
| UI-02 | P0: One project has two videos and three conversations, plus two conversations with no project; one task is running and one is waiting for approval | The project is shown as a folder; when expanded, conversations are sorted by recent activity; conversations with no project appear under “最近” (Recent); status badges match the real status of each task, and the project row summarises the statuses of its conversations; from a conversation you can open any video in that folder; switching conversations keeps tasks running; archiving or deleting a conversation does not cancel tasks and does not delete the project, videos, artifacts or committed changes | UX-06 |
| UI-03 | P0: On the start page's project tray choose “不用项目” (No project); in the new conversation, drag in a video (or paste a video link) and ask for subtitles; then ask the agent to “建个项目” (create a project) and force-quit the app between creating the project and binding the conversation; in another conversation with no project, make a video and then delete the conversation | The video is created in the conversation's own folder (under the app's data directory); no project is created automatically; the conversation still appears under “最近” and the video appears in Space; after the user explicitly asks, the conversation and its video are moved into a new project named after the video, the conversation content is kept, and after recovery there is exactly one project and one video; later, a new conversation that continues this project does not need the materials uploaded again; deleting a no-project conversation that created a video moves the video into a project named after the video, and the video is not deleted with the conversation; the next time the tray opens it still shows the last chosen project or “不用项目” (No project) | UX-01, UX-06 |
| UI-04 | P0: When there is nothing to show in a conversation; open a video from a conversation; click the objects, candidates and artifacts on a task card; switch between conversation, split and full views, and narrow the workspace; open a tab in a draft before the first message is sent, then send; the task keeps producing results after the user adjusts the layout | With no content, the feature area stays collapsed and the conversation area fills the screen; after a video is opened, the conversation is on the left and the full editor on the right; the title states the object and version; when previewing candidate plans it is labelled “候选方案” (candidate plan), and when viewing the current working draft no extra label is added; closing the feature area returns to conversation only; after the user adjusts the layout, the agent does not take the interface back automatically; the tab button states in order: “打开新标签页” (Open new tab) (no tabs; opens a new web tab and shows the split), “显示标签页” (Show tabs) with a count (split collapsed; above 9 it shows “9+”; hover or the Down arrow key lists the open tabs), “隐藏标签页” (Hide tabs) (split visible; no count or list), “进入分屏视图” (Enter split view, i.e. full view); the full-view button appears only when there are tabs; entering full view keeps the on-screen content, and exiting returns to the conversation on the left and the last tab on the right; closing the last tab exits full view; in full view and in narrow windows there is only one tab strip, the conversation is the fixed first tab and cannot be dragged or closed, the conversation header moves to the top of the conversation panel, and the input and current preview stay usable; switching tabs does not lose drafts, selection or playback position; the conversation's artifacts are listed in the conversation summary popover; the “+” on the tab strip opens the start page directly, while “新建网页” (New web page) and “浏览项目文件” (Browse project files) replace the start tab in place; tabs opened in a draft are kept after the conversation is established | UX-07 |
| UI-05 | P0: Open a video from a Home conversation and change one line of subtitles; then open the same video from Space, manually move a clip, and send a request; send requests using a video in a bound project and a video in an unbound project | Both entries use the same editor components and layout: the Home conversation is on the left, and the Space new-conversation input is at the bottom right; on the left of the input you can choose the access mode, and on the right the agent provider and model; no empty conversation is created before sending; after sending, the app jumps straight to the new Home conversation, the chosen settings and attachments are kept, the prompt is the first user message, and the current video appears as a card; a conversation bound to a project is filed under that project, otherwise it appears under “最近” (Recent); opening the video from Space again can start another conversation; the two kinds of change give the same receipt and undo, switching entries keeps the selection, playback position and unsubmitted drafts, and manual changes made in Space are visible to the agent on its next action | UX-07, SPC-03 |
| UI-06 | P0: One task generates a video, a final cut, images, audio, a subtitle file and a document; one of them is still generating, and one is an unapplied candidate; then delete Space's index and rebuild it | All results appear as entries: in the by-type view they are listed one by one; under “全部” (All) and “视频” (Video) they are grouped under their owning video, and each video appears only once; proxy files, thumbnails, caches and check screenshots do not appear; entries still generating are shown as placeholders and turn into results in place when complete; a candidate is not shown as a final cut, and an unpublished export is not shown as completed; each entry shows its source (video and version, conversation, task) and status; after rebuilding, the entries are the same, and favorites and organisation are kept | SPC-01, SPC-02 |
| UI-07 | P0: After exporting a final cut, keep editing the video, then enter a second edit from the final cut; separately, do a second edit on a video file that has no source video; edit an exported subtitle file | The final cut is marked “来源已变” (source changed) and offers re-export from the current version; going from the final cut back to the source video shows the version difference, and you can open the current working draft or create a checkpoint from the version the final cut corresponds to; a video with no source video is created as a new video from the material, and no fake layer appears; a change to an artifact produces a new version or a new artifact, and the original entry is kept | SPC-02, SPC-03 |
| UI-08 | P0: Rename, favorite, move to trash and restore; delete the only source artifact that is still referenced by a video; delete a video whose material is referenced by another video; delete a conversation | Organisation actions take effect and are kept after restart; a sole source that is still referenced is not physically deleted, and the interface explains the reason and impact; deleting a video moves it to the trash and lists the entries it exported or generated (they stay in place); linked original material files still exist after deletion and after physical deletion; a video that is open elsewhere, has a task or export running, or is locked by another program is refused with the reason explained; when the video folder itself is opened as a project (it is the source root), deletion is refused before anything is touched, with the reason explained (`VIDEO_TRASH_SOURCE_ROOT`), and the folder, the trash and the open state are all unchanged; a video in the trash can be undone and restored (if the original location is taken, it is renamed); only videos with no references after the retention period (default 30 days) are physically deleted; deleting a conversation does not delete videos or artifacts; deleting an entry, deleting a video, clearing the cache and deleting a conversation are distinct operations in the interface | SPC-04 |
| UI-09 | P0: From Space, start “在会话中继续” (continue in conversation) separately from a subtitle file in a project, an image generated by a no-project conversation, and an item in the trash; then bring a project item into a no-project conversation | The project item starts a new conversation in that project, and the image returns to the conversation that generated it; a reference tag appears in the input, and after sending, the agent receives the item's name, location and source, but not the file content; the tag is recorded in the conversation with the message; a trash item requires restoring first; when bringing an item into a conversation that cannot see it, the reason is explained and nothing is added silently; bringing in a reference alone does not start a task | SPC-03 |
| UI-10 | P0: In a conversation, ask the agent to make a slide deck and open it from the card; in the editor, change a word, open annotation without waiting for save, mark one spot on each of two pages and send; then click one annotation from the sent message; repeat all of this in the Web client | After validation passes, a slide card (title, page count) appears in the thread, and clicking it shows the deck in the feature area's slide tab; changes are written back to the deck directory, and the agent then reads the modified version; the annotation box follows the interface language; after adding, a numbered marker appears in the editor, and above the input is “幻灯片标注 · 2 条” (Slide annotations · 2), each of which can be removed one by one; after sending, the markers and draft are cleared, and the same tags appear under the message; the agent receives one passage per deck with consecutive numbering; if the editor is unsaved, sending is blocked and the input and annotations are kept; clicking a sent annotation opens (or switches to) that slide deck and jumps to that page; the Web and desktop behave the same | UX-07, UX-02 |
| UI-11 | P0: In the input, select the “设计稿” (design) skill; have the agent make a landing page with three artboards and open it from the card; in the editor, drag an element, open annotation without waiting for save, mark one spot on each of two artboards and send; then click one annotation from the sent message; repeat in the Web client, and put a script into an artboard that reads `document.cookie` and sends a request to the Runtime | After `design_check` passes, a design card (title, artboard count) appears in the thread, and clicking it shows the design in the feature area's design tab; changes are written back to the design directory, and the agent then reads the modified version; the annotation box follows the interface language; after adding, a numbered marker appears in the editor, and above the input is “设计稿标注 · 2 条” (Design annotations · 2), with slide annotations numbered separately; after sending, the markers and draft are cleared, the same tags appear under the message, and the agent receives one passage per design; if the editor is unsaved, sending is blocked and the input and annotations are kept; clicking a sent annotation opens (or switches to) that design and locates that artboard; in the Web client, the artboard script cannot read the conversation cookie and cannot call Runtime methods ([architecture design §4.8](../architecture/architecture-design.md#48-external-services)); the rest of the Web and desktop behaviour is the same | UX-07, UX-02 |
| UI-12 | P0: In a conversation, ask the agent to make a design system (or open one from Space), and open it from the card; press C to open annotation, then write annotations on the cover, on a button in the component preview and on a colour token, press Esc to exit, then click into the editable README and press C once; then send; after switching to another section, click one annotation from the sent message; repeat in the Web client | In annotation mode, clicking a button in the component preview does not trigger the button; instead it opens the annotation box for that component; the location in the annotation box is “Design system “name” › section › kind “name”” and follows the interface language; after adding, a numbered marker appears at the top right of the target, and above the input is “设计系统标注 · 3 条” (Design system annotations · 3), with slide and design annotations numbered separately; when only annotations are attached, the body is “请按这些设计系统标注修改。” (Please revise according to these design system annotations.); the agent receives one `<cuccut-design-system-annotations>` passage per design system, and each entry's location states the file it is in (`tokens.json`, `components/<名字>/`, etc.); after sending, the markers and draft are cleared, and the same tags appear under the message; clicking a sent annotation opens (or switches to) that design system, goes to that chapter first, then scrolls to the target; while focus is in editable text, C and Esc do not toggle annotation mode; the Web and desktop behave the same ([product design §3.2.3](../product/product-design.md#323-input-area)) | UX-07, UX-02 |
| UI-13 | P0: Open a design with several artboards (one of which x-imports a JSX component); from the tab header's “导出” (Export), export the whole design as HTML and as PDF separately; then from one artboard's own download menu, export PNG and an HTML zip; cancel once in the save dialog; repeat in the Web client; finally open the exported HTML alone in a browser without CucCut | The menu lists “HTML（单个文件）” (HTML, single file) and “PDF”, following the interface language; with several artboards, the editor first lets the user pick an artboard; the desktop shows a system save dialog (titled “导出设计稿” (Export design), filtered by extension), writes to the chosen path and then shows the path, and on cancel no file is written and nothing is shown; the Web hands the file to the browser download, with the file type matching the extension; a file whose extension is not allowed is not saved, and the reason is explained; the exported whole-design HTML opens offline, every artboard renders, and no scripts are requested from the network (JSX artboards use the Babel embedded in the file, embedded only once); a design with large images, over 16 MB, can still be exported as whole-design HTML (limit 256 MB); the design-system tab has no “导出” (Export) ([product design §3.3](../product/product-design.md#33-feature-area-ux-07)) | UX-07 |

### 6.3 Editor acceptance T01–T40

| ID | Scenario | Pass criterion | Basis |
| --- | --- | --- | --- |
| T01 | Mapping at 30 fps, 60 fps and 1.5× | Lands exactly on the expected source time | Video format spec §2.5 |
| T02 | Long take at 30000/1001 fps | Accumulated time shows no drift from per-segment rounding | Video format spec §2.6 |
| T03 | Variable-frame-rate phone footage | Frames fetched by PTS; audio and video lengths match | Video format spec §2.6 |
| T04 | Split, then concatenate | Mapping stays continuous, with no duplicated or missing source frames; the actual encoding strategy is verified separately | Video format spec §2.7 |
| T05 | Same asset appears three times | Editing the second instance does not affect the first or third | Video format spec §1.3 |
| T06 | Same transaction retried because of network failure | Does not add a second set of subtitles or clips | Command and protocol spec §2.4 |
| T07 | UI and agent edit the same title at the same time | Explicit conflict; no silent overwrite by the last write | Command and protocol spec §3.2 |
| T08 | UI undo, after the agent has added objects | New objects are not wiped out by the old snapshot | Command and protocol spec §8.3 |
| T09 | Speech recognition finishes after the clip was deleted | Artifact saved; video is not wrongly applied | Architecture design §7.3 |
| T10 | Re-typesetting after manual line breaks | User's pins are kept; automatic line breaks may update | Video format spec §5.5 |
| T11 | Source language and translation differ in word order and Cue count | Semantic blocks are correct; no forced line-by-line pairing | Video format spec §5.1, §5.3 |
| T12 | SRT without word-level timing | Ordinary subtitles succeed; word-level highlighting requires alignment, or degrades | Video format spec §5.2 |
| T13 | Natural translation sentence edited | Only the corresponding alignment and dubbing are invalidated | Video format spec §5.3; Architecture design §10 |
| T14 | Deleting the [4, 6) s example | [8.2, 9.0) projects to [6.2, 7.0) | Video format spec §6.6 |
| T15 | In-sentence deletion of a negation or unit word | Semantic warning is given; the target translation must not still be marked ready | Video format spec §6.5, §5.7 |
| T16 | Supplementary picture covers narration | Main audio stays continuous; supplementary picture is muted by default | Product design S06 |
| T17 | New speech synthesis is longer than the time window | Marked `needs-fit`; not truncated, and the picture is not silently changed | Video format spec §7.3 |
| T18 | Time-stretch applied to audio | Target subtitles go through the same mapping | Video format spec §7.2 |
| T19 | Original sound is a mixed track | Background handling choice matches the actual routing | Video format spec §7.5 |
| T20 | Only the English third sentence changed | Only related units are rebuilt; Chinese version unchanged | Video format spec §7.4, §7.6 |
| T21 | Code instance that depends only on local time is moved | Code-internal cache is not rebuilt | Code package spec §5.2 |
| T22 | Global font or shared function changes | Cache of all related code snippets is invalidated | Architecture design §10.4 |
| T23 | p5 sequential changes the state of an earlier segment | Downstream dependent frames are invalidated and correctly replayed | Code package spec §5.3 |
| T24 | Random seek; sequential and parallel frame fetch | Meets the declared environment determinism and tolerance | Code package spec §4.2, §6.2 |
| T25 | Canvas internal layers are not exposed | No pseudo-editable DOM children appear | Code package spec §4.5 |
| T26 | Remotion frame-range conversion | Half-open range passed to a third-party interface has neither one frame too many nor one too few | Code package spec §4.6 |
| T27 | Code composition has both internal and external audio | Audio ownership is clear; no double playback | Code package spec §4.8 |
| T28 | Semi-transparent text, shadows and transitions | Alpha mode is correct; no black or white edges | Architecture design §9.3 |
| T29 | Code composition depends on background | No independent layering that would change the result | Architecture design §9.2 |
| T30 | Drag-to-position requests return out of order | Old frames do not overwrite the picture of the newest request | Architecture design §4.5 |
| T31 | Video modified during export | Output always corresponds to the frozen version | Architecture design §9.11 |
| T32 | Worker crashes during export | Task can recover, or fail explicitly; no half-written file is published | Architecture design §9.11 |
| T33 | Source media path has the same name but the content was replaced | New asset version is proposed; frozen input unchanged | Architecture design §5.6 |
| T34 | Video reopened after the cache is deleted | Rebuilt from the frozen source, rather than losing the only source | Architecture design §5.5 |
| T35 | Missing font or texture | Strict export is blocked, or a substitute is explicitly allowed; no silent dropping of visuals. Families in the font directory are downloaded first; if a family was not downloaded, or the download failed, render directly with the fallback font and give a `FONT_NOT_DOWNLOADED` warning (family, fallback family and reason). Do not block export and do not require choosing a substitute first. Cancelling an export does not cancel downloads started elsewhere | Architecture design §9.1, §9.11 |
| T36 | Malicious code reads files or sends requests | The permission boundary actually blocks it, not just a UI hint | Architecture design §12.4 |
| T37 | Cloud task submission response is lost | Query or reconcile; do not automatically charge again | Architecture design §7.5 |
| T38 | Multilingual landscape and portrait versions | Natural translation reused; layouts recalculated separately | Video format spec §7.6, §7.7 |
| T39 | Export subtitle file | Does not start video encoding | Video format spec §5.6 |
| T40 | Unsupported effect or codec | Diagnosable rejection, or an explicit substitute; no silent quality loss | Video format spec §1.4 |

Automated checks for translation dubbing and the user library (Architecture design §5.9, §7.9; tests use only temporary directories, the local fake provider services and freshly made small assets, and do not call real cloud interfaces):

- End-to-end (`packages/runtime-core/src/models/dub.test.ts`, real Engine Host and ffmpeg, fake OpenAI and ElevenLabs services): without a `transcript` grant, startup is refused, no task is created and no request is sent; the refusal `remedy` gives the `cuccut grants create … --data transcript` command to run; the default grants when a provider is enabled do not include `transcript`. Voices are chosen per speaker: the provider voice bound in the video and the voice in the parameters are each used for the sentences of the matching speaker. When the bound library voice has no clone for a speaker, that speaker's sentences are not synthesized, no request is sent, and each is reported one by one: the plan shows `failed`, and `speakerBindingId` is the speaker ID. When the translation uses a glossary from the library and then one term's rendering is changed, only sentences containing that term become stale (`glossary-changed`). Export of the finished cut's sound source (original sound only, or one set of dubbing only) changes only the voice and not the video version.
- Translation pipeline (`packages/jobs/src/pipelines/translate.test.ts`, `translation-glossary.test.ts`): the glossary passed at call time is merged with the video's enabled glossary, fixed during execution and released at the end; the translation records `glossaryRef`, and the summary lists which glossaries were used and which were skipped. With many terms, each batch carries only the relevant ones, up to a cap. A mismatched glossary and an externally served client are rejected at startup, with no task created. Covered: language match, the judgement of term occurrence, dedup order, and which sentences become stale after a glossary change.
- Enabled entries in a video (`packages/runtime-core/src/library/library-service.test.ts`): a new video adopts the default-enabled glossary and does not enter the undo stack. Changing an enabled entry validates kind, speaker and library voice, and is an undoable edit. When the transcript gives no glossary, the video's enabled glossary is used.
- Finished cut's sound plan (tests in `crates/engine-host/src/host.rs`): `audioItems` accepts only audio and the finished cut; the finished cut only swaps the voice, and the picture plan is unchanged. The agent export tool's `source` and risk grading (`agent-tools/export-tools.test.ts`); CLI parameters and output (`apps/cli/src/export-args.test.ts`, `pipelines-output.test.ts`, `library-output.test.ts`).
- Not automated: during synthesis, a bound voice only becomes invalid for that speaker's remaining sentences (which are no longer sent). The reminder for `mute` when unsynthesized sentences and voiced sentences are in the same instance (`DUB_MUTED_UNVOICED`) appears only in end-to-end, with no separate check of the mute scope. Glossary version is re-pinned in retries after a Runtime restart.

### 6.4 Architecture acceptance A01–A12

| ID | Scenario | Must satisfy |
| --- | --- | --- |
| A01 | Two windows open the same video | See the same committed version; do not each write their own state |
| A02 | Agent and human edit in parallel | Do not overwrite human edits that were not included in the agent's input version |
| A03 | Command resent after disconnect | No duplicate cut; no duplicate asset insertion |
| A04 | UI reload or disconnect | Long-running task is not implicitly cancelled |
| A05 | Runtime crash | Unfinished task is not reported as successful; reconciliation possible after recovery |
| A06 | Model result returns after the video has changed | Becomes a candidate or a conflict; does not overwrite directly |
| A07 | Stop the current conversation turn | Independent export is not wrongly cancelled; prompt is not automatically resent |
| A08 | Editing continues during export | Export uses the frozen version; result has a clear source |
| A09 | Insufficient GPU resources | Queueing, degradation or failure each has a clear reason; no runaway repeated loading |
| A10 | Permission or provider capability not supported | Reported explicitly; no faking it through the prompt |
| A11 | Preview and export | Video semantics and time mapping are consistent; visual differences have a test standard |
| A12 | Application upgrade | Active tasks and the old executor are handled first, then the runtime is switched |

### 6.5 Consistency acceptance C01–C12

| ID | Scenario | Required observed outcome |
| --- | --- | --- |
| C01 | Video committed, but Runtime crashes before marking the apply as complete | Original receipt found by querying the same `commandId`; asset not added twice, nothing purchased again |
| C02 | Runtime lost contact, but the old engine process is still alive | New host does not write concurrently; the old write capability must actually be terminated or revoked, and the video lock acquired |
| C03 | Two Runtime Homes open the same video | Only one side holds the write lock; the other is read-only or explicitly rejected |
| C04 | Main stop button clicked just as a child Job completes and is about to auto-apply | The stop barrier blocks new commits; operations committed within the boundary have accurate receipts |
| C05 | Same idempotency key with a different payload; broadcast lost after commit | The former is rejected; the latter is recovered from the durable outbox and snapshot, and is not shown twice |
| C06 | Client forges `actor=system`, or uses an expired grant | Overridden by the authenticated identity, or rejected; permissions cannot be expanded |
| C07 | Only a candidate preview, only a working-draft change, only a finished cut each requested | Each is judged complete against its own task contract; a candidate does not pass as applied, and an unpublished result does not pass as a finished cut |
| C08 | Only one complete agent Driver; the rest have partial capabilities | The P0 dual loop can be verified; no missing capability is claimed to the UI as implemented |
| C09 | After converting an old-format video, writes continue from the old writer | Dual writes are blocked; backup and new video are independent of each other; regression of preview and editing required after conversion |
| C10 | Speech recognition is local, but the dialogue Driver is in the cloud, and the user chose local-only | Both paths perform network admission; script and picture are not sent out; available manual capabilities retained |
| C11 | Close the conversation, exit the UI, stop the Runtime, shut down the machine | Results of local and remote tasks are each stated accurately; no unconditional background-running promise is made |
| C12 | Multiple paid Jobs admitted in parallel, with unknown price | Budget reserved atomically; an unknown amount is not disguised as a guaranteed hard cap; refusal is not bypassed |

Automated checks for restart recovery and reconciliation (Architecture design §7.3–§7.5):

- End-to-end (`packages/runtime-core/src/models/job-recovery.test.ts`, real Engine Host, fake Model Worker and local fake provider, restarting the Runtime on the same `CUCCUT_HOME`): C01 and A05 are each tested once at three crash points: after the artifact is published, after the ledger records the command, and after commit but before the receipt is recorded. The video has only one `system:jobs` write, and one speech document or one imported asset; there is no re-inference and no re-request to the provider. C04 covers only the Node-side barrier: after a stop, nothing is auto-applied, the result is kept as a candidate, and it is applied via `jobs.reconcile apply`; the engine-side barrier is not yet implemented. AT-22 and T37: an online call still pending when stop is pressed is `needs-reconciliation` and is not automatically resent; `retry` and `discard` both go through the gateway.
- Unit (`packages/jobs/src/job-recovery.test.ts`, fake engine recording receipts by `commandId`): the same three crash points; when a receipt cannot be queried, the command is not rewritten under a new one; a missing video directory is `stale-input`; queued tasks are re-validated and then re-queued, and interruption of agent submission; budget is settled only once; three outcomes for queryable remote tasks; each reconciliation decision and its invalid states.

### 6.6 Runtime Mechanism Acceptance M01–M25

| ID | Scenario | Pass criteria | Basis (architecture design) |
| --- | --- | --- | --- |
| M01 | Capability refresh, authorization revocation and read-only queries | Contract fingerprint changes with the contract; declaration, validation and authorization are not conflated; queries do not create fake Jobs | §3.6 |
| M02 | Batch pre-check succeeds, then another window submits; one item in the batch is invalid | The former returns a conflict, no blind write; the latter writes nothing for the whole batch; same key with same payload returns the original receipt | Command and protocol spec §7 |
| M03 | Video with existing voiceover only has its title changed; README in the material contains execution instructions | Only relevant guidance is loaded; speech is not re-synthesized, permissions are not expanded; the guidance version is recorded | §3.8 |
| M04 | Screenshots of source material, and checks on the final composite containing subtitles and masks | Screenshot kinds match real pixels; hash, length and format are verified; source frames cannot pass off as composite results | §9.8 |
| M05 | Video has moved on by the time of the check; evidence is only three frames | Old evidence is bound to the old snapshot; do not claim the current version passes, nor that the full film's dynamics or audio were checked | §9.8 |
| M06 | Question asked right after a subtitle edit, before its receipt; save fails; during IME composition | Wait for the associated commit, or explicitly reject or exclude; do not send old context that assumes it was saved | §4.6 |
| M07 | Nine scenes capture frames in sequence, session capacity is two, with a transition between two scenes | Completed within peak working set, or explicitly choose the intermediate-segment scheme; no requirement to open nine sessions at once, no deadlock | §7.7 |
| M08 | Lease expires but browser still running; multiple background tasks contend with foreground | Occupancy held until the process actually exits; stop new allocations; queue has fair waiting and cancellation | §7.7 |
| M09 | Adjacent frames at high frame rate; source gets shorter; out-of-bounds at end | Adjacent frames distinguished by timebase; not misidentified by fixed tolerance; no silent clamp or hold | §8.4 |
| M10 | Texture or video ready late; concurrent seek on the same page | Presentation handshake and page queue work; results from an old execution generation do not overwrite newer ones; export drops no frames | §8.4 |
| M11 | Plain text changed to an effect that depends on background; switching between DOM and Canvas paths | Execution plan records the reason when switching paths and hands over within the same frame; no loss of filters, alpha or sound | §9.9 |
| M12 | Scrolling and zooming a large timeline and long script; selection and input off-screen | Mounted nodes and update volume controlled by window budget; focus, selection and gestures not lost | §11.4, §11.5 |
| M13 | Replacing a scene's code package; parameter Schema changes | Keep stable `itemId`, lineage and pin; only change the selected reference; explicitly reject if incompatible | §8.6; code package spec §3.3 |
| M14 | Scenes depending on `local-only` and on `placement` each translated | The former is reused when its dependencies are unchanged; the latter counts the new context into the cache key and re-evaluates | Code package spec §5.2 |
| M15 | Catalog preview does not match the new code package version; license or capability unknown | No old preview with new code; reject selection when a capability is missing; do not claim commercial use when the license is unknown | §8.7 |
| M16 | After reusing one sound effect, manually drag one of them, then recompile the sound event table | Material not repurchased or duplicated; manual pin preserved; routing does not double-play; anchor can be tracked | Video format spec §7.9 |
| M17 | External media file's size and inode unchanged but content overwritten in place | Not treated as frozen-unchanged; strict tasks use the frozen bytes, or fail safely | §5.6 |
| M18 | Resource URL expired; cross-video request; authorization revoked | Refresh only within valid authorization; cross-scope requests rejected; no temporary URLs or keys in the persistent format | §5.6 |
| M19 | Nine scenes plus independent subtitles and sound, three consecutive rounds of editing | Without background dependencies, editing subtitles does not re-render code; swapping a scene and restoring it does not harm sound or IDs | §9.5, §10 |
| M20 | Fast-path eligibility check fails; final file corrupted; disk full | Switch to the baseline path of the same contract, or reject; staging does not publish half a file; keep the old successful export | §9.9, §9.11 |
| M21 | Task sent without a contract; afterward the user changes the contract, switches access mode, modifies based on an old revision, and reopens Runtime | Default contract generated by the system, visible in the task entry and task center; each change produces a new revision, recording who changed what, old revisions queryable; switching mode records one revision; modifications based on an old revision rejected; after reopening, revisions and check results all present, and tasks that earlier had no contract get the default contract | §3.2 |
| M22 | User protects an object, a range or the whole video; the agent in the task modifies or revokes it while touching it; generation and started flows submitted in the task write results to the same place; user changes the same place themselves | Agent's transaction rejected as a whole, nothing written, error carries `TASK_PROTECTED`, the touched object and the protection; Job application under the task recorded as rejected (`TASK_PROTECTED`), output kept as candidate, written only when the user runs `jobs.reconcile apply`; flow stops at the step that writes the video; agent cannot remove protection; user's changes and user-submitted tasks write as normal; whole-video protection does not affect other videos | §3.2, §7.3 |
| M23 | Task budget limits count, task calls across two Providers until exceeded; changed to an amount cap while the model has no price; crash with reserved calls in flight | On exceed, `TASK_BUDGET_EXCEEDED`, no Job created, no approval; when an amount in the same currency cannot be estimated, `TASK_BUDGET_UNVERIFIABLE`; after restart the reservation is settled only once; flows started in the task and their sub-steps count likewise; interface-submitted ones unrestricted; agent cannot loosen the budget | §7.8, §12.5 |
| M24 | Goal changed mid-task, choosing to stop versus keep old work; view or modify the contract from CLI, Web read-only and non-read-only, and MCP | Both create a new task; the contract is derived from the old contract and points to the old task; on stop, Jobs of the old task not yet finished are cancelled, on keep they complete as normal; CLI and Web read-only only view, Web non-read-only can modify, MCP does not expose contracts | §3.2 |
| M25 | Built-in and user layers each have skills, including non-compliant and same-id directories; disable one, select a disabled one to send; add from a local folder, import from GitHub (with subdirectory, over limit, missing `SKILL.md`, target exists), remove built-in and added; Web session calls add, import and remove; agent reads a skill given a `../` path | Bad directories skipped with reason, built-in takes precedence; toggles store only deltas and persist across restart; only enabled ones enter a new session's index, none mentioned when none are enabled; selected body attached after the message, message carries skill marker; non-compliant, over-limit and conflicting cases rejected before writing, no overwrite, no staging files left, error carries target directory and source; import downloads by commit and records address, ref and commit; built-in cannot be removed; Web session `WEB_METHOD_NOT_ALLOWED`; path traversal rejected | §3.8, §12.9 |

Automated checks for task contracts (tests use only temp directories and a fake Driver, and never call a real cloud service):

- M21, M24: `packages/harness/src/task-contracts.test.ts` (default contract, revisions and persistence, the agent's read-only fields, stop versus keep when the goal changes, old records backfilled with the default contract); `apps/cli/src/tasks-output.test.ts`; `packages/runtime-core/src/services/web-service.test.ts` and `services.test.ts` (boundary between Web read-only and MCP).
- M22: `crates/video-engine/tests/task_protection.rs` and the tests in `crates/engine-host/src/host.rs` (four kinds of protection, revocation, system writes with tasks are also checked, users unrestricted); end-to-end `packages/runtime-core/src/agent-tools/task-tools.test.ts` (real Engine Host); `packages/runtime-core/src/agent-tools/task-protection-jobs.test.ts` (real engine, local fake provider and fake yt-dlp: a generation result in a task touches whole-video protection, the application is recorded as rejected, the output is kept, `jobs.reconcile apply` writes it without calling the provider again, user-submitted ones write normally; an agent-started import from a link stops at the import step, the downloaded file is kept, user-started imports proceed normally).
- M23: `packages/runtime-storage/src/grant-store.test.ts` (cross-Provider totals, amount and currency, settlement and recording once after a crash); `packages/runtime-core/src/grants/grant-flow.test.ts` (exceeding creates no Job and no approval, flow sub-steps find their task, interface submissions unrestricted); `packages/runtime-core/src/grants/pipeline-budget.test.ts` (fake agent starts an import from a link via MCP: fake yt-dlp, real engine, transcription through the local fake provider; transcription counts toward the task budget, and on exceed the flow stops at the transcription step and reports `TASK_BUDGET_EXCEEDED`, with the provider receiving no request; interface-started flows unrestricted; after transcription output is written to the artifact library and then a crash occurs, restart completes the application, the budget is settled only once, and it is unchanged after another restart).

Automated checks for resource scheduling (the local task part of M08; browser sessions are not yet wired into scheduling, and leases have no TTL):

- Unit (`packages/jobs/src/resource-scheduler.test.ts`, injected fake capacity): when demand does not fit, queue and state which dimension is missing; beyond capacity, reject directly with `RESOURCE_ADMISSION_UNSATISFIABLE`; no queue-jumping, strict ordering within the same queue; background work does not use interactive reservations, and interactive ones go first; unified memory counts GPU demand as memory; a shared process is counted once, returned only after it exits, and evicted for waiters when idle; disk is computed from `statfs` and the amount leased later.
- End-to-end against a fake Model Worker (`packages/jobs/src/job-resources.test.ts`): the two causes of `JobRecord.wait`; cancelling while queued withdraws the request; on cancel with a Worker that hangs and does not exit, a Worker crash, or cancel during a slow load, the lease is returned only once the process actually exits, with no leak and no early return; when the task ends but the Worker is still alive, it is still counted; returned after unload; Runtime stop waits for execution to finish.
- Export process group (`packages/runtime-core/src/exports/export-worker-lease.test.ts`, with a fake Render Worker and a fake ffmpeg it starts that ignores SIGTERM, no real rendering): the Worker is force-killed, or after cancel the Worker exits itself but leaves ffmpeg behind; in both cases Runtime kills the whole process group; when the group probe is blocked and pretends the group still has processes, the task does not end and the lease is held; after release, the lease is returned once the group has no processes, and returned only once.

Automated checks for Agent skills (M25; tests use only temp directories, a fake Driver and an injected fake `fetch`, and do not access GitHub):

- Directory and toggles: `packages/runtime-core/src/skills/skill-catalog.test.ts` (id rules, skip reasons, built-in precedence, delta persistence, `readFile` boundaries, index and selection segment), `skill-frontmatter.test.ts`; `packages/runtime-storage/src/skill-prefs.test.ts`.
- Add, import and remove: `packages/runtime-core/src/skills/skill-installer.test.ts` (copy and source recording, rejecting overwrite, missing `SKILL.md`, over limit, GitHub subdirectories, truncation, symbolic links, rate limiting, strict offline, `commandId` retry, built-in cannot be removed).
- End-to-end: `packages/runtime-core/src/skills/skill-runtime.test.ts` (manage skills via the gateway; index at session start, selected body and message marker, `skills_read`); `packages/runtime-core/src/services/web-service.test.ts` (Web session rejected); `apps/cli/src/skills-output.test.ts`.

M19 uses original, licensed or procedurally synthesized fixtures. M12's scale tiers and visible window were already measured on one development machine (the M12 baseline in §4); the P95 threshold is frozen on fixed hardware.

### 6.7 Time-model acceptance TM01–TM20

Sections cited in each row refer to the video format specification unless noted otherwise.

| ID | Scenario | Must satisfy | Basis |
| --- | --- | --- | --- |
| TM01 | 30 fps: 12.5 seconds and frame 375, two forms of the command | Yield the same `fromFrame` and actual time; do not store a second writable seconds field | §2.8, §2.9 |
| TM02 | At 30000/1001 fps, request 10 seconds, `nearest-frame` | Frame 300; actual time 1001/100 seconds; deviation 1/100 second | §2.6, §2.9 |
| TM03 | Same request with `exact-frame`; also test 0.05 seconds at 30 fps (exactly midway between two frames) | `exact-frame` is rejected; `nearest-frame` at the exact midpoint picks the earlier boundary, i.e. frame 1 | §2.6 |
| TM04 | Frame input lacks a sequence; source frames or output frames mixed into a video command | Reject, or require an explicit time-domain conversion; do not guess the frame rate | §2.4; Command and Protocol Spec §6.1 |
| TM05 | Exact parse of 0.1 seconds, and equivalent time values | Yields 1/10; 1500/1000 and 3/2 are equal in value and in cache key | §2.3, §2.13 |
| TM06 | NaN, Infinity, exponential-form decimals, out-of-range integers, zero denominator | Type validation fails; no floating-point fallback, overflow or silent truncation | §2.3, §2.8 |
| TM07 | Shared boundary of adjacent clips; several relative second-based moves | The shared boundary is quantized only once; compute the absolute target first, do not accumulate rounding drift | §2.6 |
| TM08 | 10 ms fade at 48 kHz; short sound effect | 480 samples; allowed to be shorter than one frame; does not change visual length | §2.10, §7.11 |
| TM09 | Import and export of words and subtitles not on video frame boundaries | Original times and quality markers preserved; conversion for display and external subtitle files does not write back to the source | §2.10, §5.6 |
| TM10 | 30 fps, 300-frame video exported at 60 fps | 600 frames, 10 seconds; video version unchanged; audio speed and sample count unchanged | §2.11 |
| TM11 | Continuous native curve going from 0 to 100 in 1 second, 30 → 60 fps | First output frame at t = 1/60 s, x = 5/3; not snapped to a video frame first | §2.11; Architecture Design §9.10 |
| TM12 | 30 fps parent, 24 fps nested sequence, 60 fps output | Continuous objects pass exact times; discrete frame sampling happens only at source boundaries | §2.5; Architecture Design §8.5 |
| TM13 | Frame-driven code package; `fixedStep` of sequential | Frame rate follows the author's contract; step rate does not change with export frame rate; returns actual samples | Code Package Spec §5.3, §5.4 |
| TM14 | Variable frame rate presentation timestamps 0 / 40 / 100 / 130 ms, request 75 ms | Select the sample in [40, 100); do not pick frames by average frame rate or DTS | §2.6 |
| TM15 | Microsecond timestamps for one million output frames at 30000/1001 fps | Each frame computed from the absolute value; the end equals direct conversion; error does not accumulate frame by frame | §2.13 |
| TM16 | Exact 10 seconds exported at 30000/1001 fps | `cover-range` yields 300 frames, 10.010 seconds; `exact-grid` is rejected; no hidden audio stretching | §2.11 |
| TM17 | Change sequence from 30 fps to 60 fps, `preserve=time` | Frame coordinates transformed proportionally; real duration and audio positions unchanged; committed as a single transaction | §2.12 |
| TM18 | 30 → 25 fps; locked track; zero length; `preserve=frames` unsupported | Give a report of impact and quantification; reject when hard constraints or capabilities are not met; do not partially modify the frame rate | §2.12; Command and Protocol Spec §6.5 |
| TM19 | Frame sampling with same `frameIndex` but different output frame rates, cache and evidence | Request identities differ; local samples are reused only when all dependencies are the same | §2.13; Architecture Design §8.4 |
| TM20 | Frame rate changed after preflight; frame rate changed after export is frozen | New commit returns a version conflict; an already-started export keeps the old snapshot; retry returns the original receipt | Command and Protocol Spec §6.3; Architecture Design §9.11 |

Independent scripts can verify some of the expected values for rational numbers. But behaviour in this table involving the app, audio, Adapter, cache, concurrency and UI must be tested by a real implementation.

---

## 7. Items for review

| Item | Status | What needs deciding |
| --- | --- | --- |
| Numeric performance targets (§4) | Scale tiers and visible window for M12 have been measured on one development machine and listed (M12 baseline in §4); other metrics await benchmark calibration | Target device matrix; thresholds for each scale tier |
| Stage item lists (§3.3) | Draft | Minimum must-pass set for R0 and R1 |
| UI-01–UI-10 | New items | Whether to split them finer; whether accessibility gets its own item |
| Grades of technical items | Not annotated item by item | Whether T, A, C, M, TM are annotated item by item with P0 / P1 / G |
| Pixel-consistency tolerance | Undecided | Allowed differences between backends and devices, and how to measure them |
| Location of execution-status records | Undecided | Format and storage location of test records |
| Fixed task set and fixtures | Not produced | Source of material, licensing and scale |
| User research | Not started | Baseline tasks and sample |
