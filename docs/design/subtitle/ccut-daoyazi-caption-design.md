> Ported from CucCut v2. The data model names in this text (TranscriptDoc, etc.) refer to the v2 models. For their correspondence to the v3 document model, see [Architecture design §14](../../architecture/architecture-design.md#14-items-pending-review).

# CucCut “倒鸭子” (Daoyazi) Caption Style Design (Review-Revised Version)

Status: **the core (Phase A) and App v2 (Phase B: native rendering, gallery card and launch panel) landed on 2026-09-17** (core `ccut-subtitle-render/src/caption_sequence.rs`, descriptor `caption-daoyazi`, the App gallery's "Dynamic layout" group and the "Daoyazi" section of the properties page; differences and unfinished items are in the ledger [2026-09-17-214000](../../changelog/prototype-ledger/2026-09-17-214000.md)). The Web client is not implemented. The interactive prototype has been wired into the editor prototype `designs/cuccut` (2026-09-17). On the same day, a second round recalibrated the camera, entrance, layout direction and inter-segment continuation against MonkeyCam from TypeMonkey (an AE script, the origin of this family of styles) (§0 R2 / R6 / R8, §7.2, §8.3–§8.6). **On 2026-09-18 a third round reworked the layout and framing against typeMonkey.js (the web port, the most faithful version in this family)**: a row is the smallest unit; rows within a segment stack downward, left-aligned; a segment pivots 90° at the lower-left or lower-right corner of the previous row; the camera normalizes the current row to the same screen width; rows spring in from 0.3× on the left-center origin; and the stop-and-go camera and the spring-in use CSS `ease` (§0 R16, §6.3, §7.2, §8.2, §8.3, §8.5). The prototype and the kernel have been landed in sync. This document is a **review-revised version** of the original 2026-09-17 proposal (`cuccut-daoyazi-subtitle-design.md`, baseline `f22da874`): §0 lists the review findings and the fixes, and §1 onward is the full revised scheme, which can serve directly as the implementation basis. Fields, modules, capability names and default parameters are still to be developed and accepted.

Code verification baseline: `main@17e329814` (2026-09-17). This pass was read-only; no build was run. The example payload is in [`ccut-daoyazi-caption-style.example.json`](ccut-daoyazi-caption-style.example.json). The interactive prototype is integrated in the "Subtitles → Style → Dynamic layout" section of [`designs/cuccut/CucCut.html`](../../../designs/cuccut/CucCut.html) (gallery card, the "Daoyazi" section of the properties page, the stage canvas; product behavior is in [product-design §16.5](../product/product-design/16.md#165-倒鸭子动态排版样式2026-09-17)). The reference implementations of the solver and camera sampling are in [`designs/cuccut/app/model-daoyazi.js`](../../../designs/cuccut/app/model-daoyazi.js), the `node --test` cases are in [`model-daoyazi.test.js`](../../../designs/cuccut/app/model-daoyazi.test.js), and the stage and panel views are in [`daoyazi-stage.jsx`](../../../designs/cuccut/app/daoyazi-stage.jsx) / [`panel-daoyazi.jsx`](../../../designs/cuccut/app/panel-daoyazi.jsx).

## 0. Review Conclusions

The original proposal's direction is correct: Daoyazi is a **cross-sentence, orchestrated Designed Caption**. It goes into the shared Rust caption kernel, does not copy text or timing, and does not introduce a second animation runtime. Below, in order of impact, are the places that need revision. Each row gives how the original wrote it, the problem, and the revision. The body from §1 onward is already written to the revised version.

| # | Topic | Original proposal | Problem | Revision |
|---|---|---|---|---|
| R1 | Scope of the first-release format | §5 fixes at once `captionSequences`, instance-level `caption` replacement, fixed `blocks` layout, `emphasisOverrides`, style `0.2`, caption schema 2, and a protocol capability | This pulls in persistence that only Phase C/D need and locks it in early. The first release would have to span five layers: kernel, protocol, TS generation, and validation. Raising the style file to `0.2` would make the **whole project** unreadable in older versions, just for one caption style | The first release writes only `wordAnimation.caption` (schema 1 unchanged), adding `seed` and `options.daoyazi`; existing code already round-trips unknown `options` [R5]. `captionSequences` is deferred to Phase C, with its own schema; readers treat it as "absent means none". The capability gate sits on the **recipe descriptor's** `execution` field, not on the file version number (§5.1, §5.6) |
| R2 | Camera timing | §8.4 "start the camera at the speech of the new focus" | The first 320 ms of the new block are half off-screen, so readers lose the start of every block, which contradicts "the current block must be fully visible". The prototype's first version used a 320 ms short jump; even with lead correction it was still awkward: every block produced one "abrupt stop, pause, sudden jump", as harsh as TypeMonkey's Stop and Go Fast mode | Camera motion has two modes (§8.4). **Smooth** (default, MonkeyCam Smooth): the camera flies across the whole interval between adjacent focuses, `[onset − travel, onset]`, and speech starts on arrival, with `travel = clamp((1 − dwell) × interval, minTravel, maxTravel / speed)`. **Stop and Go** (MonkeyCam Stop and Go): `[onset − lead, onset − lead + travel]`, with `lead = anticipation × travel`. In both modes the text begins to enter at `onset − pre`, and the camera flies toward empty space, so future text is not exposed |
| R3 | Word-by-word entrance | Phase D "optional word-by-word entrance" | Word-by-word appearance is the defining trait of Daoyazi, and the block layout is fully solved at compile time, so word reveal is only a visibility change with zero relayout cost. Putting it in Phase D would make the first release look like "a whole-sentence subtitle that moves" | `reveal: "word"` is the default for the first release; it degrades to `"block"` only when timing is sentence-level (SRT) or translation-driven (§8.5) |
| R4 | Viewport clipping | §2.2 / §9.4 require a new generic `ClipRectGroup` threaded through CPU / GPU / BCS / Web to provide "below / local region" | Checking `scene.rs`: `GlyphRunUniform.clip` is already a "canvas-coordinate clip rectangle applied before the run transform", which follows the pose and changes only a uniform [R7]. The Daoyazi overlay mode has no per-block backing plate; a solid backdrop is the viewport rectangle itself, and translation text that is fixed in place and outside the viewport takes the ordinary path. So the first release needs no new scene instruction | The first release uses the run clip. `ClipRectGroup` is deferred until per-block plates or shadow blur overflowing the viewport appear (§9.4) |
| R5 | Visual mapping of emphasis words | Only says to reuse the normal / emphasis / hero three tiers | The three tiers' appearance in this style is not defined, nor is which tier affects layout | `emphasis` = color change, no relayout; `hero` = separate visual block + 1.5× font size + a second emphasis color, included in the shaping / layout fingerprint (§6.4) |
| R6 | Layout solving | §7.2 scoring formula `a…e` with an undefined candidate set, weights and tie rules | Cannot be turned into a deterministic implementation. It also has no term preventing folding back into already-seen regions, so the world would tangle | A fixed candidate set (4 edges × 3 alignments × allowed angles), fixed initial weights, ties broken by the smallest index, **a bonus for continuing in the same direction** (TypeMonkey: words that don't turn stack downward, words that turn 90° stack leftward), a penalty for folding back, and turn-rate throttling. Under orthogonal layout, collisions degrade to AABB (§7.2) |
| R7 | Determinism | §7.3 "stableHash", "randomization algorithm versioned" | No hash or RNG is specified, and nothing says how floating point stays consistent across native and wasm | FNV-1a 64 + SplitMix64, sampling in the integer domain; world coordinates quantized to 1/64 of a reference unit; angles restricted to {0, 90, 180, 270}, with no trigonometry at compile time (§7.3) |
| R8 | Inter-segment transition | Not defined | The original does not say how the next segment starts after the "hold" at the end of a segment, so each implementation would invent its own. The prototype's first version used a "hard cut + 200 ms fade-out"; since the demo project has nearly one segment per sentence, it looked like every sentence flickered | A segment is not a cut point. Each segment's world sits beside the previous segment's world (on the same canvas, continuing the previous segment's last direction, about 0.6 viewports away, overlapping no existing world). The camera **flies over** from the previous segment's end pose, and once it arrives the previous segment fades out within `fadeMs` (default 200). Fading-out blocks count toward the node budget (§8.6) |
| R9 | Zoom bounds | "Set a positive lower and upper bound on zoom" | Abstract numbers cannot be tuned | Expressed as readability: the on-screen font size of the current block's body text is between 3.2% and 20% of the reference canvas height, and a single block's height is ≤ 85% of the viewport height; the zoom range is derived from these (§8.2) |
| R10 | Portrait aspect ratio | Viewport fixed at `{0.06, 0.08, 0.88, 0.72}` | At 9:16 and 1:1, fit, line wrapping and density all differ. The existing recipe already has a `layoutTokens.wide / square / vertical` mechanism [R3] | Viewport and density are taken from `layoutTokens` per aspect-ratio tier; user overrides store only the difference (§5.3) |
| R11 | Properties panel in the first release | The top of the panel is "Scope: whole track / current animation segment / current selection" plus "Pin this segment's layout" | These depend on Phase C instance records. In the first release they would be empty controls | First-release panel = motion, color, "Another version" (whole track), and a collapsible "Camera and layout" section. Scope and fixed layout appear with Phase C (§3.3) |
| R12 | Registry placement | "Add `caption-daoyazi-v1` to the existing caption asset registry" | There are two registries: core's `CAPTION_RECIPE_FILES` (embedded at compile time, the rendering contract) and the App's `assets/captions/registry.json` (gallery), plus a copy in Web. Adding it only to the gallery would list a style that cannot be rendered | Add the same entry in all three places. Descriptors with an `execution` field are **not listed** in clients that do not support them, and saved projects that use them show as ordinary captions with a diagnostic (§5.2) |
| R13 | Current state of `seed` | "Keep the existing seed semantics" | The current `caption_registry::payload` writes only schema / content / palette / intensity / speed / style. `seed` does not exist, and the descriptor has only a `seeded` boolean marker [R5] | `seed` is a **new** field in this proposal. By default it is derived once from the document revision and saved to disk; it is preserved when the recipe is changed (§5.3) |
| R14 | Segment length budget | "8 cues, 12 seconds" | Counting cues alone makes long-cue segments too heavy and short-cue segments too fragmented | Three budgets, whichever is reached first: 12 s, 16 lines (since 2026-09-18 a block = a line; previously 10 visual blocks), and 48 words. The line count is the primary budget (§6.2) |
| R16 | Shape of layout and framing (2026-09-18) | §7.2 candidate-scoring solver, §8.2 whole-block framing | Checked against typeMonkey.js: its rows (`tm-row`) are the smallest unit; rows stack downward, left-aligned, within a segment (`tm-block`); a segment pivots 90° at one lower corner of the previous row (`rotate: 'lb' | 'rb'`); and the camera makes the **current row** the same screen width (`scale = conWidth / rowWidth`, at least two character widths). The candidate-scored world looked like floor tiles, and in-block wrapping plus whole-block framing made the on-screen font size vary from block to block. Neither looks like Daoyazi | A row is a block: no wrapping, words left-aligned, framing width = max(text width, 2 em), line height 1.2. Column layout: stack downward along the current segment; a turn is a pivot of ±90° around the lower-left or lower-right corner of the previous row. If it hits an existing row, switch sides or jump outside the world and start a new segment. Per-row framing: `zoom = viewport width × fit / row framing width`, with the on-screen font size cap raised to 30%. Entrance from 0.3×, origin left-center, CSS `ease`. The stop-and-go camera also uses CSS `ease`. History keeps 8 rows, at 50% (§6.3, §7.2, §8.2, §8.3, §8.5) |
| R15 | Stage picking | "Clicking text selects only the corresponding caption" | Historical blocks are also on screen, and it was not stated what is selected when one of them is clicked | Only the **visible words** of the current block and of historical blocks can be picked, using the inverse camera matrix. Clicking a historical block = select that cue and seek to its onset (§3.4) |

Core decisions kept unchanged (§1): no embedding of HTML, FFCreator or a second player; no new `ElementKind`; `CaptionSequencePlan` reuses `MotionProgram`; text and timing are read-only projections; the three surfaces share one compiled result.

## 1. Core Decisions

Make Daoyazi a **cross-sentence, orchestrated Designed Caption**. Users still choose it from "Subtitles → Style", and still edit the original captions, timing and emphasis words. Internally, a new compile plan considers several captions at once, instead of attaching separate rotation effects to each caption.

Picture model: several text blocks are placed in a persistent two-dimensional world. Words appear one at a time as the speech proceeds, and the camera pans, rotates and zooms between blocks as the speech moves on. The current block stays readable, and older blocks remain in space as background. The camera acts only on the subtitle world, not on the main video, stickers, picture-in-picture, watermarks, or another fixed caption track.

1. **Do not embed HTML, FFCreator or a second video player.** The prototype (the Daoyazi card in `designs/cuccut` and `app/model-daoyazi.js`) is the visual and interaction reference, and also the executable specification of the solver. The production implementation goes into `ccut-subtitle-render`.
2. **Do not add a new `ElementKind`, a subtitle media type, or a persisted per-frame keyframe file.** It is a way of presenting subtitles.
3. **Add `CaptionSequencePlan` and reuse `MotionProgram`.** The former handles cross-sentence layout, focus and lifecycle; the latter remains the single kernel for curves and sampling.
4. **Text and timing are read-only projections of the Transcript / Timeline.** What is saved is the style, the seed, and (from Phase C) manual constraints.
5. **App, Web and CLI export share the same compiled result and sampling rules.** The UI only produces editing intent.
6. **Persist in phases.** The first release touches only `wordAnimation.caption`. Instance records, fixed layout and instance emphasis are independent schemas for Phase C (R1).

## 2. What the project already has

| Existing entry | Verified capability | How this feature uses it |
|---|---|---|
| `ccut-subtitle-render` | Shared caption layout, per-word state, Designed Caption, `OverlayRenderPlan`, CPU/GPU scene output, per-cue overrides via `cueStyles` | Add a sequence compile branch; the ordinary caption path stays unchanged |
| `wordAnimation.caption` | `schema / content / style / palette / intensity / speed`; unknown `options` are kept when the recipe changes [R5] | Still the entry point; add `seed` and `options.daoyazi` |
| `captionEmphasis` | Document-level per-word `normal / emphasis / hero` | Reuse; this style defines a visual mapping for the three tiers (§6.4) |
| `caption_recipe.rs` | 16 recipe descriptors; `layoutTokens.wide/square/vertical`, `visibility`, `seeded`, `fonts` | Add `execution` to the descriptor; reuse `layoutTokens` per aspect-ratio tier |
| `ccut-motion` | Deterministic curves with no I/O, `PropertyTrack` (segments on the same track must not overlap [R10]), `InterpolatorSpec::{Linear, Step, Angle, Color}` | The camera's four channels and the per-word channels lower to it; logarithmic scaling needs a new interpolator (§8.3) |
| `ccut-timeline` and shared projection | source / clip / cuts / rate, word anchors and output time mapping | First derive the caption instances in the exported video, then arrange them |
| `ccut-timeline-render::scene` | glyph / vector nodes, `ScenePose`, `SceneMotion` (six components interpolated directly), `GlyphRunUniform.clip`, `next_change` / `active_until`, budget of 1024 runs / 4096 nodes [R7] | Reuse the pose and run clip; add a decomposed transform without changing the old `SceneMotion` |
| `ccut-compositor` | Shared wgpu compositing | No new runtime |
| `ccut-editor-core`, `ccut-protocol` | Shared App/Web editing semantics; protocol generates TS | Style operations are written once |

### 2.1 It is not "just add one recipe JSON"

`caption_recipe.rs` is centred on cues and words; it returns per-word offset, scale, rotation, colour and opacity. Daoyazi additionally needs grouping across cues, a static layout for all blocks, a shared camera, and visibility of historical blocks. This is an orchestration layer; a registry plus a name cannot provide it.

### 2.2 Two low-level facts that must be stated explicitly

**Camera interpolation cannot go through `SceneMotion`.** `SceneMotion::sample()` interpolates the six affine components directly [R7]: an intermediate frame from 0° to 180° degenerates to a zero matrix, and 0° to 90° shrinks unexpectedly. The camera must sample position, angle and positive scale separately, then compose the matrix. The semantics of the old `SceneMotion` are not changed.

**Viewport clipping needs no new instruction for launch (R4).** `GlyphRunUniform.clip` is a clip rectangle in canvas coordinates; it moves with the pose and only changes the uniform [R7]. In overlay mode the picture contains only glyphs; the solid background is the viewport rectangle itself, and fixed translations outside the viewport take the ordinary path. The generic `ClipRectGroup` is deferred until per-block backplates or blur overflow appear.

## 3. Product interaction

### 3.1 Default workflow

After transcribing or importing captions, go to “字幕 → 样式 → 动态排版” (Captions → Style → Dynamic layout) and choose “倒鸭子” (Daoyazi). Hovering a gallery card plays a continuous preview of **the current sentence and several sentences around it** (a temporary try-on, not written to disk). Clicking Apply keeps you in the caption workflow.

The first application does not open a wizard. The first screen of the properties page has three main entries: **Motion, Colours, Reroll**, followed by a collapsible “Camera & layout” section. With no captions, prompt the user to recognise or import first. With only one sentence it still works, with a hint: “Two or more consecutive sentences are needed to see the camera travel through.”

Default appearance “倒鸭子·叠加” (Daoyazi · Overlay): transparent background; it does not change video visibility or audio. The other appearance, “倒鸭子·纯文字舞台” (Daoyazi · Text-only stage), draws an opaque background colour inside the caption layer and explicitly states “覆盖此范围内的视频画面” (Covers the video picture within this range). It does not delete footage or change the main track's mute state.

Launch has only one style family, with two motion presets, “标准 / 轻动感” (Standard / Light motion). Black background, colours and caption region are options of this style, not a dozen differently named presets.

### 3.2 Application scope (phase C)

| Scope | User expectation | Persistence behaviour |
|---|---|---|
| Whole caption track (only option at launch) | The target track uses Daoyazi uniformly | Changes `wordAnimation.caption` on the target row |
| Current animation segment | Adjusts only the continuous sequence currently arranged | Materialises the segment's word-anchor range as instance records and saves explicit overrides |
| Current selection | Affects only the selected exported content | Splits into several bindings by source / clip instance and cut points, saved in one transaction |
| This one only | Does not affect neighbouring sentences | Single-sentence scope; uses the appearance capability of `cueStyles` and does not quietly expand to the whole segment |

Non-contiguous selections generate separate segments; the camera never flies over unselected, cut, or other-speaker captions. When bindings overlap, the editor splits, replaces or merges them into non-overlapping partitions; the low-level validator rejects non-normalised overlaps. `cueStyles` is an override at sourceItemId level. When the same source appears repeatedly, one cannot assume it only affects one particular clip, so new segments and selections are bounded by exported-timeline instances.

### 3.3 Property panel

Launch (phases A–B):

```text
字幕 / 倒鸭子                         [标准 | 轻动感]
[当前 6 句的连续预览]

动感        轻柔 ─────●──── 强烈
配色        文字色 / 强调色 / 第二强调色
布局        [换一版]   种子 137

镜头与排版 ▾
  旋转        不旋转 / 直角转向
  镜头运动    平滑 / 停走              （camera.motion；the hint line below changes with it）
  镜头速度    慢 ───●─── 快
  镜头停留    0 ───●─── 60%           （smooth preset: camera.dwell）
  镜头提前量  0 ───●─── 满            （stop-and-go preset: camera.anticipation; only one of the two lines appears）
  文字占屏    小 ───●─── 大          （camera.fit）
  文字密度    疏 ───●─── 密
  逐词出现    开
  历史文字    保留 6 块 · 32%
  字幕区域    居中 / 下方 / 全画面
  背景        透明 / 纯色
  段落结束    停住 / 有空余时间时拉远
```

Phase C adds, to the top of the panel, “应用范围：整轨 | 当前动画段 | 当前选区” (Apply to: Whole track | Current animation segment | Current selection); in the layout row, “调整布局” (Adjust layout) and “固定这一段版式” (Fix this segment's layout); and a per-segment “换一版” (Reroll).

The `designs/cuccut` prototypes draw all of these phase-C items together: Reroll with “换给：整轨 / 当前动画段” (Apply to: Whole track / Current animation segment), the hero-word chip and “在这一条前另起一段” (Start a new segment before this one), and the edit state of Adjust layout (drag / rotate / pin / unpin / restore auto). They serve as references for interaction and copy. App v2 landed on 2026-09-18 (`stylepane/daoyazi.rs`): “换给：整轨 / 当前动画段” (Apply to: Whole track / Current animation segment; segment-level seeds are written to `captionSequences.seeds`), the “在这一条前另起一段” (Start a new segment before this one) toggle (`sequenceBreakBefore`), per-word appearance, history row count, background, segment end, and the “调整布局” (Adjust layout) edit state (drag to pin a row / rotate 90° / pin / unpin / restore auto). In the App, the hero word is not selected in this segment. It reuses the emphasis-word chip of the caption panel (`captionEmphasis`, `hero` role), and this segment only keeps one hint line.

Control semantics:

- “镜头速度” (Camera speed) only scales the camera motion window. It does not change speech, cue times, video rate, or total duration.
- “换一版” (Reroll) only updates this scope's seed, undoable in one step. It does not change the script or the emphasis words. At launch the only scope is the whole track.
- “文字占屏” (Text fills the screen) maps to `camera.fit`. Auto-framing cancels the screen effect of enlarging the whole block's font size, so **a plain font-size slider is not kept**. The ordinary `fontSize` is retained as a base metric or compatibility value, and only local emphasis uses relative font size.
- The ordinary caption's x / y / rotation, its entrance animation, and Daoyazi's viewport / camera are not in the same coordinate layer. When Daoyazi is active, the old whole-sentence entrance is not stacked on top; original values are kept and restored on exit.
- Changing font, relative font size, line width or density re-lays out. Changing only the solid fill colour does not re-lay out.
- Rotation, spacing and camera parameters belong to the animation segment. The “仅这一条” (This one only) appearance page must not silently change the whole segment.

### 3.4 Stage

By default, clicking text selects the corresponding cue and enters the existing script editing. Only **the displayed words of the current and historical blocks** can be picked. Future words, which are not visible, cannot be picked. Picking uses the inverse of the camera matrix. Clicking a historical block selects that cue and moves the playhead to its onset (R15).

Layout edit state (phase C): entered by double-clicking the text or clicking “调整布局” (Adjust layout). It pauses the camera and shows all blocks of this segment on a scalable **text map**. Drag blocks, pin positions, rotate 90°, restore auto. On exit, the playhead is restored; each drag is one undo item. The “animation segment bracket” on the timeline is a derived display. It adds no track and does not persist a second timing set.

App v2 landed shape (2026-09-18): the row layer of the stage comes from `LayoutFrame.sequence` (`SequenceLayout` / `SequenceRow`) of the `ccut-editor-core` geometry sidecar (frame four corners plus segment-local centre). The sidecar is requested only while **paused**, so R15 row-click jump and picking are unavailable during playback. The edit state is entered from the “调整布局” (Adjust layout) button in the properties page; the App does not wire double-click. Entering pauses playback. Dragging goes through the engine's `SequenceEdit` channel, `CaptionSequenceEdit { seq, drag: (key, segment-local centre) }`, for live preview. On release, the centre, rounded to 1/64, is written into `captionSequences.pins`. One Blob write-back is one undo item. Rotate, pin, unpin and restore auto use the same write path. The text map has no zoom: the edit state stays at the current segment's overall framing (`edit_mode` derives the camera from core's `caption_sequence.rs`).

### 3.5 Preview, undo and concurrency

Keep the gallery's temporary-document try-on. Hover and keyboard focus do not write to disk, do not enter undo, and do not affect export. Leaving, changing scope, or a document revision change clears it [R11].

Re-layout may run on a worker thread, and compile inputs must be frozen. The task key contains at least the project, document revision, style digest, and aspect-ratio and font fingerprint. Old results must not overwrite new ones. Undo and redo restore the seed and manual constraints and do not redraw random numbers.

**Seek is sampling.** When the playhead jumps to t, the picture = `sample(t)`. It does not transition from the previous frame's pose. Playing forward, seeking, and reverse playback to the same t are bit-identical.

### 3.6 Bilingual and reduced motion

Launch: original-text Daoyazi, with the translation shown fixed. The fixed translation is outside the camera and uses the existing translation projection. The caption world's viewport avoids translation rows; the viewport height is derived from the translation track's `y` / `verticalAlign`.

Translation-driven reveal is the next phase and must use real translation cues or aligned block timing. With only sentence-level translation, `reveal` degrades to `block`. Missing translations display as empty per the existing missing-translation policy.

“不旋转” (No rotation) and “轻动感” (Light motion) are style options that can be saved and carried into export. The system “减少动态效果” (Reduce motion) setting only affects the editor's automatic try-on. Two tracks crossing simultaneously is out of scope for launch.

## 4. Domain objects

- `CaptionSequenceBinding` (phase C): the user-saved scope, overrides and manual constraints. It is author intent.
- `CaptionSequencePlan`: the world layout, focus and animation tracks compiled from the current projection. It is a derived product.
- `CaptionSequenceFrame`: the visible blocks, transforms, colour, clip and picking geometry at a given exported moment. It is the sampling result.

One binding (at launch, the whole track) may compile into several continuous sequences because of cuts, pauses or the budget. A text block's display period differs from a caption's speaking period: after a word finishes being spoken, its block may still appear as historical text. Do not change `cue.end`, and do not use the set of currently active cues as the full rendering input.

## 5. Format design

### 5.1 Sole persistence location

Keep `studio/style.json`. Do not change Transcript text or timing, and do not add anything at the top level of `timeline.json`. **Launch does not change the `ccutStudioStyle` version or the caption schema** (R1).

| Information | Storage | Phase | Author truth |
|---|---|---|---|
| Text, word ids, word times | Transcript | Existing | Yes, not copied |
| Cut points, clip, speed change, order | Timeline | Existing | Yes, not copied |
| Style reference, palette, intensity, speed | `wordAnimation.caption` | Existing | Yes |
| `seed`, `options.daoyazi` | `wordAnimation.caption` | **A** | Yes |
| Per-cue font, stroke, etc. | `cueStyles` | Existing | Yes |
| Global emphasis words | `captionEmphasis` | Existing | Yes |
| Scope / manual layout / instance-level overrides | `captionSequences` | **C** | Yes, sparse |
| World coordinates, camera track, glyph layout | `CaptionSequencePlan` / deletable cache | — | No |

### 5.2 Recipe descriptor

Add the same task `caption-daoyazi-v1` in three places (R12): core `CAPTION_RECIPE_FILES` (render contract), the App `assets/captions/registry.json` + `styles/` (gallery), and the Web asset copy. On top of the existing `cuccut-caption-style/1`, the descriptor adds:

```json
{
  "schema": "cuccut-caption-style/1",
  "id": "caption-daoyazi-v1",
  "version": 1,
  "title": "倒鸭子",
  "family": "kinetic",
  "cjk": "good",
  "seeded": true,
  "layers": ["glyphs"],
  "layoutTokens": {
    "wide":     { "viewport": [0.06, 0.08, 0.88, 0.72], "density": 0.65, "fit": 0.60 },
    "square":   { "viewport": [0.06, 0.10, 0.88, 0.70], "density": 0.60, "fit": 0.62 },
    "vertical": { "viewport": [0.06, 0.14, 0.88, 0.62], "density": 0.55, "fit": 0.66 }
  },
  "execution": { "scope": "sequence", "compiler": "typography-world", "version": 1 }
}
```

- An older descriptor without `execution` continues to follow cue-level logic. A descriptor declaring `sequence` must match a registered compiler.
- **The capability gate lives in the descriptor, not in the file version**: a client that does not recognize `execution.compiler` does not list this style. When a saved project is opened, it renders as a regular caption and shows the diagnostic “此版本不支持倒鸭子，已按普通字幕显示” (“This version does not support Daoyazi; shown as a regular caption”), without rewriting the file. `caption_recipe_design_descriptor` currently returns `None` for an unknown id; when implementing, confirm that this fallback path lands on "regular caption + diagnostic" and not on a blank result.
- `cjk: good` may only ship after real CJK font and line-break tests pass.
- `family` is the gallery grouping and `execution.scope` is the execution capability; do not let the UI category string implicitly decide the algorithm.
- `layoutTokens` reuses the existing wide / square / vertical three-tier mechanism [R3]; the values are starting points for the first version.

### 5.3 Style payload (Phase A)

```json
{
  "schema": 1,
  "content": "orig",
  "style": { "id": "caption-daoyazi", "version": 1 },
  "palette": { "primary": "#FFFFFF", "accent": "#FF9B42", "secondary": "#59BAF2" },
  "intensity": 60,
  "speed": 1.0,
  "seed": 137,
  "options": [{ "kind": "object", "key": "daoyazi", "value": {
      "preset": "standard",
      "sequence": { "maxDurationMs": 12000, "maxBlocks": 16, "maxWords": 48,
                    "pauseThresholdMs": 800, "breakOnSourceCut": true, "breakOnSpeakerChange": true,
                    "fadeMs": 200 },
      "layout":   { "mode": "column", "density": null, "turnEvery": 2 },
      "camera":   { "motion": "smooth", "dwell": 0.25, "minTravelMs": 120, "maxTravelMs": 1600,
                    "travelMs": 300, "anticipation": 0.5, "maxTurnDeg": 90, "fit": null, "zoomLog": true },
      "entrance": { "durMs": 300, "pre": 0.5 },
      "reveal":   "block",
      "presentation": { "mode": "overlay", "viewport": null, "background": "#00000000",
                        "history": { "maxBlocks": 8, "opacity": 1 },
                        "ending": "hold", "translation": "fixed" }
  } }]
}
```

- Revision landed 2026-09-17: `options` **keeps the existing array shape** (each entry `{ kind, key, … }`, using the same read/write path as recipes such as `caption-texture`). The Daoyazi parameter block is one such entry, `{ "kind": "object", "key": "daoyazi", "value": {…} }`, and is not split out into an object-shaped `options.daoyazi`. In `value`, write only the keys the user has changed; omitted keys take the recipe and frame-tier defaults. The descriptor id is `caption-daoyazi` (no `-v1`, as with the other recipes; the file name is still `caption-daoyazi-v1.json`).

- `seed` is a field added by this plan [R13]: on first application it is derived once from the document revision and saved to disk, as a fixed-width unsigned 32-bit integer. It is kept when the recipe is switched; “换一版” (“another version”, the shuffle action) changes only it.
- `null` means take the current frame tier's `layoutTokens`; a concrete value is written only after the user changes it in the panel [R10].
- `intensity` only adjusts the local entrance magnitude and turn probability; the parameter mapping is fixed in the versioned recipe and does not change word timing or the seed.
- `camera.motion` has two modes [R2, §8.4]: `smooth` (default) uses `dwell` (the proportion of an interval spent on the old block), `minTravelMs`, and `maxTravelMs`, and `speed` scales `maxTravelMs`. `stopAndGo` uses `travelMs` (preferred duration, shortened to fit the available window, scaled by `speed`) and `anticipation ∈ [0, 1]` (lead time as a proportion of travel). The constants are matched to TypeMonkey: Stop and Go has pre 0.167 s / dur 0.334 s, i.e. `travelMs` × `anticipation: 0.5`. From 2026-09-18, `travelMs` defaults to 300 (typeMonkey.js `.tm-wrap transition: all .3s`), and the three channels of the stop-and-go mode use CSS `ease` (§8.3).
- `entrance` is the entrance of a word (or block): `durMs` is the duration of the scale and opacity change (scaled by `speed`), and `pre` is the proportion of it that falls **before** the onset (TypeMonkey entrances all start `pre` before the marker; Fast Scale is 0.167 / 0.333).
- `layout.turnEvery`: after a turn, at least this many **lines** must pass before another turn is allowed (default 2; TypeMonkey `rotationThrottle`). `layout.mode` has only `column` (from 2026-09-18 on); the legacy `orthogonal`, `maxLines`, and `gapEm` are ignored when read.
- `presentation.history.maxBlocks` is counted in **lines** (lines already read by typeMonkey.js all stay on screen; here the default keeps 8 lines, at 50%).
- `sequence.maxBlocks` is also counted in lines, default 16. Lines are shorter than the old visual blocks, so with the same 48-word budget there are roughly 70% more lines.
- `maxTurnDeg` limits the angle change between **adjacent shots**; it does not limit the absolute angle of the world.
- The “Light motion” preset (「轻动感」预设) = `maxTurnDeg: 0`, `dwell: 0.35`, `anticipation: 0.3`, `intensity ≤ 40`. These are the values saved into the file, not temporarily hidden UI. There is no “overshoot” (超调) option: the position, angle and scale channels share one ease (§8.3).

### 5.4 Sparse project-level record (Phase C)

```json
{
  "captionSequences": {
    "schema": 1,
    "instances": [
      {
        "id": "cseq-01",
        "target": { "context": "sub", "role": "source" },
        "binding": { "sourceId": "main", "clipId": "clip-01", "firstWordId": "w41", "lastWordId": "w80" },
        "seed": 9021,
        "sequenceBreakBefore": ["w58"],
        "blocks": [
          { "id": "cblock-01", "firstWordId": "w49", "lastWordId": "w56", "lineBreaksAfter": ["w52"],
            "placement": { "mode": "pinned", "center": [620.0, 240.0], "rotationDeg": 90.0 } }
        ],
        "emphasisOverrides": { "w51": { "role": "hero" } },
        "caption": null
      }
    ]
  }
}
```

- **The slimmed shape that App v2 actually shipped on 2026-09-18** (read by core `caption_sequence.rs`, written by App `stylepane/daoyazi.rs`) lives in the studio style root (`style.captionSequences`) and is not in the style library:

```json
{ "captionSequences": { "schema": 1, "sequenceBreakBefore": ["w58"], "seeds": { "<seq key>": 3 }, "pins": { "<row key>": { "center": [620.0, 240.0], "rotationDeg": 90.0 } } } }
```

  Segment keys and row keys are derived by core from the word range (`SequenceIntent`). The segment-level seed is an offset added on top of the track seed. The full shapes of `instances[]` / `blocks[]` / `emphasisOverrides` / `caption` are deferred until selection-level binding and local style replacement are needed; at that point they will be migrated under the rules below.

- It does not contain caption text, output seconds, or layout bounding boxes. The first and last words of `binding` form a closed interval on the source word order; rendering takes the output projection of that range that is still visible in the specified clip. Repeated playback must carry `clipId`.
- `blocks` records only manual chunking, manual line breaks, or fixed layout; automatic blocks are not written. Fixed coordinates use the 540-short-side world reference unit, not output pixels.
- `emphasisOverrides` reuses the existing emphasis value type: instance override > disambiguated document emphasis > automatic suggestion. An explicit `normal` overrides the layers above it, and deleting an entry restores inheritance.
- `caption`: missing = inherit the track style; object = full local replacement; `null` = turn off the sequence effect for that range. The same operation must not write both `cueStyles` and `instance.caption`.
- A change in camera, viewport, seed, or execution version cuts the sequence; pure color and local font-size changes do not cut it.

### 5.5 Units, versions and validation

- World positions use the 540 short-side reference frame, quantized to 1/64 units; the final canvas scaling is done only once.
- Viewports use a [0, 1] normalized rectangle, with the field name `viewport`. The sequence runtime uses output seconds; JSON tuning uses `Ms`; authored angles use `Deg`.
- `opacity`, `fit`, `density`, and `anticipation` have explicit ranges; floats must be finite; zoom must be strictly greater than zero.
- Phase A changes no file version and adds no protocol capability. The `captionSequences` in Phase C carries its own `schema`, and the protocol capability is named `captionSequenceV1`, updated in the same task along with the protocol version, the generated TS, and the reference docs. **2026-09-18 status**: App v2 writes the whole style back via the existing `StyleAction::Blob`, without adding a protocol capability or any `ccut-protocol` field. `captionSequenceV1` is deferred until Web / `ccut serve` needs field-level reads and writes.
- Validation covers at least: overlapping instance ranges, missing anchors, bindings across assets, overlapping manual-block word ranges, manual blocks crossing forced segment boundaries, illegal colors or floats, block-count and node budgets, unknown compiler or version, zero zoom, and duplicate instance ids. The read stage returns diagnostics and does not write “repairs” to disk.

### 5.6 Style sync and templates

`style_sync` must preserve the full round trip of `wordAnimation.caption.seed` and `options.daoyazi`. `captionSequences` stays at the root and is not copied into `voiceInkContexts`. New style application must update the existing allowlist and snapshot code [R6].

“My caption styles” (「我的字幕样式」) saves only the recipe reference, font, general parameters, color scheme and `options.daoyazi`. It excludes `seed`, `cueStyles`, `captionSequences`, `captionEmphasis`, word anchors and world coordinates.

## 6. Compile pipeline

```text
Transcript + Timeline + current style (+ Phase C sparse instance intent)
        ↓ existing shared projection: deletions, cuts, speed changes, ordering, repeated instances → output timeline
        ↓ resolve effective style, target track, range, emphasis words, frame-tier layoutTokens
        ↓ Sequence partitioning → visual blocks (hero blocks stand alone)
        ↓ same TextEngine shaping → line layout within blocks and real boundaries
        ↓ bounded world layout (deterministic candidate scoring) → camera focus and motion window
        ↓ CaptionSequencePlan (quantized static geometry + MotionProgram + resources / diagnostics)
        ↓ sample(outputTime) → CaptionSequenceFrame
        ↓ existing SceneFrame / DrawOp + glyph run clip
        ↓ App / Web-WASM / CLI export
```

### 6.1 Project first, then orchestrate

The input is the output timeline, not source-file time. The shared projection already handles source / clip / cuts / rate, so do not write a separate `(sourceTime − in) / rate` [R9]. The compile input carries these explicitly:

```rust
struct CaptionOccurrence {
    source_id: SourceId,
    clip_id: ClipId,
    source_item_id: SourceItemId,
    occurrence_key: OccurrenceKey,   // sourceId + clipId + original word id (add the clip identity when spanning visible clips)
    output_window: TimeRange,
    words: Arc<[ProjectedWord]>,
    effective_style: EffectiveCaptionStyle,
}
```

Do not write the derived instance id back into `word.id`. A missing or unresolvable anchor returns a diagnostic and does not fall back to second 0.

### 6.2 Sequence boundaries

Hard boundaries: a change of target track or language, a change of effect type, an explicit “restart from here” (「从这里重新开始」), the end of an instance range, a change of clip instance, and source cuts. By default, also split on a pause ≥ `pauseThresholdMs` and on a speaker change.

Soft budgets, where the first one reached applies (R14): `maxDurationMs` 12 s, `maxBlocks` 16 (lines), `maxWords` 48. There are also hard node and glyph budgets. When over budget, split deterministically or return a diagnostic. Local changes to color or regular font size do not split a sequence; differences in camera, viewport, seed, or execution version do split it.

### 6.3 Visual Chunking Is Not Editing the Captions

A long cue may derive several visual blocks, and a group of tightly spaced short cues may share one focal point. Keep the cue / word mapping and each word's real timing; do not perform transcript split / merge.

Chunking order (since 2026-09-18, block = **row**, `tm-row` in typeMonkey.js): first split into independent rows at each hero word; then split rows by punctuation, word boundaries and a character budget. The budget is `2.5 + 5 × density` CJK units (density 0.65 → 5.75, i.e. four or five Chinese characters or one or two English words). At a clause break, the row breaks once it has reached 40% of the budget. Rows **do not wrap**: words are left-aligned and laid out in sequence from 0; the row's framing width = max(text width, 2 em) (`minWidthNum` in typeMonkey.js), and row height = 1.2 × font size. Row boxes are quantized to 1/32 of a reference unit, and the half-width, half-height and cumulative in-paragraph height all fall on a 1/64 grid. Do not mechanically cut English words, emoji, ligatures or numeric units at a character count.

Manual block boundaries fall on word anchors; line wrapping within a single word shares the timing of that original word. Only when there is sentence timing or sentence-level translation does the whole block enter by sentence (`reveal: "block"`); fake word timings are not synthesized.

### 6.4 Emphasis Words (R5)

Priority: explicit per-instance override > document `captionEmphasis` > user-accepted automatic suggestion > normal.

| Role | Color | Font size | Layout impact |
|---|---|---|---|
| `normal` | `primary` | 1× | None |
| `emphasis` | `accent` | 1× | None; only changes the frame key |
| `hero` | `secondary` | Grows to fill the column width, capped at 2.75× (fixed at 1.5× before algorithm v3) | Forces a separate visual block; enters the shaping / layout fingerprint |

The currently spoken word is highlighted in `accent` for every role (`emphasis` words do not change color while spoken; they are distinguished by their entrance scale). The first version of automatic suggestions uses only explainable rules such as numbers and user word selection; if AI is introduced, the model only returns restricted word IDs and role suggestions, which are written through a normal editing transaction.

## 7. Text Measurement and World Layout

### 7.1 Keep Only One Shaping

Reuse TextEngine / cosmic-text: the "measure block" and "draw glyphs" steps are built on the same set of shaped runs. Do not run a `measureText()` layout pass in the Web layer and then have Rust re-lay out [R1][R2]. Layout keeps the mapping word → text range → cluster / glyph range (ligatures, combining marks, RTL) [W2]. The cache key includes text, face fingerprint, fallback set, weight / axes, direction / language, font size, letter spacing and `density`. While fonts are not ready, only a temporary preview with a clearly marked status may be shown.

### 7.2 Static World Layout (R6, changed to columns + pivot on 2026-09-18)

Only orthogonal layout: row angle ∈ {0, 90, 180, 270}. All rows are axis-aligned rectangles in the world (width and height swap at 90 / 270), and collision reduces to an AABB intersection test; no OBB / SAT is needed. The shape of the world matches typeMonkey.js:

- **Paragraph (`tm-block` in typeMonkey.js)**: several rows, left-aligned, stacked downward into one column, with one angle for the whole paragraph. The paragraph has a local origin (the world position of the top-left corner of its first row), an angle, and the accumulated stacked height. The center of row k = origin + R(angle)·(w/2, stacked height + h/2), where `R` is a right-angle rotation (clockwise positive, y downward); no trigonometric functions are used at compile time.
- **Going straight**: normally rows stack one after another downward (`top = −rowHeight × n` in typeMonkey.js). The first paragraph starts at the origin; its angle continues from the final angle of the previous animated paragraph (column continuation across paragraphs).
- **Turning = pivot** (`rotate: 'lb' | 'rb'` in typeMonkey.js): the new paragraph rotates 90° around a bottom corner of the previous row. `lb` pivots around the **bottom-left corner**: the new paragraph turns +90° clockwise, and the bottom-left corner of its new first row is that pivot point (`transform-origin: left bottom` plus the inverse of the previous paragraph's `rotate(−90deg)`). `rb` pivots around the **bottom-right corner**: the new paragraph turns −90° counterclockwise, and the bottom-right corner of its new first row is that pivot point (`originX × 100% bottom` plus the inverse of `rotate(90deg)`). The corner is taken from the row's **framing width** (consistent with positioning by `cur.width` after clamping with `minWidthNum`).
- **When to turn**: at least `layout.turnEvery` rows (default 2) must pass after the last turn. A row seed decides once whether to turn: at a cue boundary, or where the previous row ends with a clause break, the probability is `0.55 × min(intensity / 60, 1.6)`; mid-row it is `0.2 × …` (if `maxTurnDeg < 90`, never). With the default intensity this turns roughly every 4 rows. TypeMonkey's `rotatePct` of 25% is computed per word, and the typeMonkey.js author marks lb / rb without regard to clause breaks either. When first shipped in the third round, it rolled 25% only at clause breaks and at least 3 rows apart, so 35 rows turned only two or three times, and users reported "too few vertical flips" (raised on 2026-09-18). When it turns, the direction is rolled first: 50/50 the first time, and afterwards 70% opposite to the previous turn (the typeMonkey.js author also alternates lb / rb). If the rolled direction collides with existing rows, the other side is used.
- **If it collides**: when stacking straight would hit another paragraph (turning the same way three times in a row curls inward), turn if throttling allows (both directions are tried). If not, **jump** the new paragraph to the side of the world bounding box in the direction it was heading (0.6 viewport heights away, converted using the zoom for this row's framing), keep the angle unchanged, and record a `layout-jump` diagnostic. Overlap is never accepted.

Seeds enter the layout solver only at the two points "turn or not" and "which way to turn". From algorithm v3 there is a third point that sets row colors: each row's `blockSeed` draws seedHex / turnRoll / dirRoll / toneRoll in turn (same order in the prototype and the kernel). "Shuffle to another version" changes the layout only through the first two entry points, and also swaps in a new sentence-by-sentence color set. Historical rows are not re-laid out when a new row appears; once a position is fixed in the plan, later cameras only change framing. The upper bound of the world bounding box = 6 × 6 times the reference canvas; exceeding it records a diagnostic. Pinned rows (stage C) are registered in the collision table first, and automatic rows route around them; when their turn comes, they start a new paragraph in their fixed pose.

The candidate-scoring solver of the second round (4 edges × 3 alignments × angle, bonus for going straight, penalty for doubling back) has been abandoned. It arranged the world like floor tiles, with new blocks at a turn sitting against the sides of old blocks, instead of the 倒鸭子 (daoyazi) reference style of "one column read through, turn at the corner, then read another column".

### 7.3 Stable Randomness (R7)

```text
blockSeed = fnv1a64(recipeVersion ‖ algorithmVersion ‖ userSeed ‖ sourceId ‖ clipId ‖ blockAnchorWordId)
rng       = SplitMix64(blockSeed)          // sample only in the integer domain: rng.next() % n
coordinate = round(x × 64) / 64            // world reference units, quantized before writing to the plan
angle     ∈ {0, 90, 180, 270}              // no sin / cos calls at compile time
```

Array indices, time, memory addresses and HashMap order are never used as seeds or tie-breaking rules. Automatic blocks are identified by their stable first word; manual blocks use their saved ID. The same caption instantiated in different clips gets an independent but deterministic layout, because `clipId` differs.

Edits usually affect only the current paragraph, but this is not guaranteed: changing pauses, deleting boundary words, swapping fonts, or changing the paragraphing threshold may recompute up to the next forced boundary. The UI shows the real scope of impact. For paragraphs that must be absolutely stable, users save manual boundaries and layout constraints in stage C.

### 7.2.1 Equal-Width Columns and Per-Sentence Color (2026-09-18, algorithm version 3)

User feedback: "the animation effect isn't great." Working from a reference video (one whole sentence per row, one column, rows justified on both the left and right edges, color changing sentence by sentence, read rows not fading), three things were changed. The prototype and the kernel use the same definitions:

- **Equal-width columns**: column width = `base font size × (2.5 + 5 × density)`, i.e. the per-row character budget used when splitting. Each row first measures its natural width at the base font size, then multiplies that row's font size by `rowScale = clamp(column width / natural width, 0.75, 2)` (the hero row is capped at 2.75, quantized to 1/64). Short sentences get larger type and long sentences smaller type, so both edges of a column are justified. Line spacing is reduced to 1.12× font size so rows sit tight and read as one block. Hero rows no longer use a fixed 1.5×.
- **Per-sentence color**: after `dirRoll`, each row draws `toneRoll` once more (same order on all three surfaces). When a new cue begins, its color is set: `< 0.5` primary color, `< 0.78` accent color, otherwise the secondary accent color. If the drawn accent tier matches the previous sentence's, it reverts to the primary color, so the two accent colors never appear back to back. All rows of one sentence share one color. Emphasized words and hero words within a row take "the other tier", and if that collides with the row color, they shift to the remaining tier.
- **Whole-row entrance, no fading history**: `reveal` now defaults to `"block"`, and `history.opacity` now defaults to 1. Chinese transcripts often have one character or word per timing, so entering word by word while recoloring word by word looks like a flicker of fragments on screen. Whole-row entrance starts at 0.7× (the per-word tier is still 0.3×), and the whole-row tier does not mark "currently speaking". The per-word tier is kept, and the switch on the properties page is unchanged.

The three `fit` preset tokens are also lowered (0.60 / 0.62 / 0.66). With equal-width columns every row fills the full column width, so 0.78 would push the whole column to the edge of the viewport, and after the previous column turns away nothing would remain visible.

### 7.2.2 Preventing "Flash" Captions: Merging Blocks and Wrapping Within Blocks (2026-09-18, algorithm version 4)

User feedback: some text stays on screen too briefly. It appears and the camera moves on immediately, like a flash. Wrapping is fine. Splitting rows by budget leaves tails of only one or two characters, and in fast speech each row lasts only about half a second. A one-character sentence ("哦", "oh") flashes past even faster.

- **Merging blocks**: after segmenting, measure each block's dwell time (first-word onset of the next block − first-word onset of this block; for the final block, last-word end − first-word onset). Blocks shorter than **0.7 s** are merged into an adjacent block. Merging always keeps the earlier entry time: characters may appear earlier, but must never appear only after they have already been spoken. The neighbor chosen is the one with fewer characters; on a tie, the earlier block is taken, so a run of short blocks pairs off two by two rather than rolling into one large block. Merging may cross cues (the block's `cueId` is taken from the cue containing its first word). Hero blocks do not take part, merging does not cross a speaker change, and the merged result may not exceed 3 lines' worth of characters. Word order and word timings are not changed at all.
- **Wrapping within a block**: when a block's character count exceeds "budget ÷ 0.75" (it would not fit in one row even with the font shrunk to its lower limit), its characters are divided evenly into `ceil(characters / budget)` lines. Each line is stretched to the column width on its own (§7.2.1), and line heights accumulate. Visually this looks like several single-line blocks, except that they enter together and the camera stops only once. `SeqBlock.lines` records the line count. `font` takes the smallest line font size in the block, and the readability range for framing is calculated from it (it is no longer derived back from block height).
- Fixed blocks (§7.4) are recorded by their first word ID. After merging, if a pinned block's first word has changed, the pin no longer matches and reverts to automatic under the existing rules.

### 7.4 Manual Constraints (stage C)

Fixed blocks take precedence over automatic solving, and other blocks route around them. After a font change, if a fixed block collides, a prompt "Fixed layout conflicts with new text" appears. The user may allow unfixed blocks to be re-laid out or lift the constraint, but locked blocks are never moved silently. Reading, compiling or cache invalidation must never silently delete manual constraints.

## 8. Camera and Animation Evaluation

### 8.1 Transform Conventions

Column vectors. In world and screen coordinates x points right and y points down; angles are positive clockwise. Full transform:

```text
Mscreen = MoutputScale × T(viewportCenter) × S(zoom) × R(−cameraAngle) × T(−cameraCenter) × Mblock × MwordLocal
Mblock  = T(blockCenter) × R(blockAngle) × T(−blockWidth/2, −blockHeight/2)
```

`MoutputScale` converts the reference canvas (short side 540) to output pixels, and is applied only once. When a block's angle equals the camera angle, the block appears upright on screen. The background color and fixed translations are in screen space and are not part of the camera matrix. When calling `post_concat_mat6`, mind its order convention ("first" is applied before "second") [R7].

### 8.2 Focus and Framing (R9, changed to per-row normalization on 2026-09-18)

The camera aims at the **current row** (`scale = conWidth / rowWidth` in typeMonkey.js, `conPercent` 0.8):

```text
zoom = viewportW × fit / rowW          rowW = max(text width, 2 em), i.e. the row's framing width
```

Short rows appear large and long rows small, so every row fills the same screen width. The row box is centered in the viewport, and the camera angle = the row's angle. Since algorithm v3, rows are already equal-width per column (§7.2.1), so within one column the camera almost never zooms; it only changes on rows that hit the font-size limits. The readability range is calculated from **that row's own font size** (`row height / 1.12`), no longer from the base font size. Zoom is clamped to the readability range. The lower bound ensures the current row's on-screen font size is ≥ 3.2% of the reference canvas height (about 35 px at 1080p). The upper bound is the smaller of two limits: single-row height ≤ viewport height × fit, and on-screen font size ≤ **30%** of the reference canvas height (so even a two-character row can fill the screen width; the 20% of round two was set for framing whole blocks, and with per-row framing it made short rows too small). In the reading state, the four corners of the current row are inside the viewport; during movement, earlier rows may leave the frame. Local bounce and outline expansion count against the safety budget; it is not only the end frame that is checked.

### 8.3 Camera Channels

The camera has four independent channels: x, y, rotation, zoom. Local text uses the existing opacity / dx / dy / scale / rotation. Everything is lowered uniformly to `ccut-motion`.

- The three channels **share one ease**. The smooth preset is `ease(u) = u²(3 − 2u)` (a Hermite with zero velocity at both ends; this is the AE expression `ease()`, which TypeMonkey uses for position / X / Y / Z rotation / dolly). The stop-and-go preset uses CSS `ease` = cubic-bezier(0.25, 0.1, 0.25, 1) (the `transition` in typeMonkey.js: fast start, soft landing; `x(t)` is solved by 8 Newton iterations, and the prototype and kernel use the same constants and step count). Position, angle and scale start together and stop together. No “overshoot” bounce is stacked on top. The first version stacked a mid-way bump on the position channel alone, out of sync with the angle / scale curves, and that was one direct source of the “not smooth” feel.
- Position: `lerp(from, to, ease(u))`.
- Angle: the turn direction is chosen at compile time (cw / ccw is written into the plan). Interpolation runs only over [from, from + Δ] and does not compute the shortest path at runtime. A 180° tie always takes cw.
- Scale: when `zoomLog: true`, `zoom(u) = exp(lerp(log z0, log z1, ease(u)))`. This requires adding and testing a `LogPositive` interpolator in `ccut-motion`; the existing `InterpolatorSpec` does not have it [R10]. The first closed loop can start with linear positive scaling.

Do not tween the composed Mat6.

### 8.4 Motion Windows and Speech (R2)

For the i-th focus (block), `onset_i` = the start time in the final cut of the block's first word, and `prevEnd` = the moment the previous shot came to rest (the `t1` of the previous camera segment; for the first block of this segment, the `t1` of the last segment of the previous animation):

```text
Smooth (camera.motion = "smooth", default; MonkeyCam Smooth)
  travel_i  = clamp((1 − dwell) × (onset_i − onset_{i−1}), minTravelMs, maxTravelMs / speed)
  travel_i  = min(travel_i, onset_i − prevEnd)
  segment_i = [onset_i − travel_i, onset_i]                 (opens on arrival)

Stop-and-go (camera.motion = "stopAndGo"; MonkeyCam Stop and Go)
  travel_i  = min(travelMs / speed, 0.45 × (onset_{i+1} − onset_i))
  lead_i    = min(anticipation × travel_i, 0.3 × (onset_i − onset_{i−1}))
  segment_i = [onset_i − lead_i, onset_i − lead_i + travel_i], not before prevEnd
```

In smooth mode the camera is in flight between the two focuses the whole time, moving over the entire gap with `1 − dwell` (TypeMonkey does the whole gap), and arrival lands exactly on the new block's opening. When the gap is long, travel is capped at `maxTravelMs / speed` (default 1.6 s), so the camera does not crawl for two or three seconds. Stop-and-go keeps the short hop of the first version (default 0.3 s, lead by half), which matches TypeMonkey's Fast preset and the 0.3 s transition in typeMonkey.js. In both modes the new block's text only starts entering at `onset_i − pre` (§8.5), so the camera flies toward an empty spot. When the window is shorter than `minTravelMs`, drop the rotation (an abrupt angle change is the most jarring); do not delay word timing.

All camera segments are sorted by output time and overlaps are removed (`PropertyTrack` requires [R10]): `segment_i.start ≥ segment_{i−1}.end`. Smooth mode shrinks `travel_i`; stop-and-go shrinks `lead_i` first, then `travel_i`. The `from` of a new segment is the `to` of the previous one, so camera pose is continuous across segment boundaries. Rest segments have an explicit hold. Do not use spring integration that depends on the previous frame's state.

### 8.5 Text Lifecycle (R3)

Each block has: its first-visible time (= first-word onset − pre), its focus window, its history-visible window, and the end time of the sequence it belongs to.

With `reveal: "word"`, each word in a block starts entering at its own `onset − pre` (`pre = entrance.pre × entrance.durMs / speed`, default 0.15 s). The entrance takes `durMs` (default 300 ms): the word scales from `popFrom` up to 1 while fading in, with the origin at the **left middle**. For per-word reveal that is the word's left edge; for whole-block reveal it is the line's left edge (typeMonkey.js `zoomIn` + `transform-origin: left center`). The curve is CSS `ease`. `popFrom = 1 − 0.7 × min(intensity / 60, 1)`: intensity 60 starts at 0.3×, intensity 0 does not scale. By onset the word is already mostly settled. All of TypeMonkey's entrance presets start before the marker, so words do not lag “half a beat behind”. With `"block"`, the whole block is timed from its first word. The “在念” (being read) highlight is still strictly `[start, end)` and is handled separately from the entrance.

By default the most recent `history.maxBlocks` lines of history are kept (default 8 lines; since transparency algorithm v3 the default is 100%, previously 50%), fading down to `history.opacity` by a stable rule. Older lines are not drawn. Future blocks are not drawn even if already compiled. History blocks use their own final local pose and style, and are not overridden by the current cue's color or entrance timers.

### 8.6 Segment Endings and Transitions (R8)

By default the camera stops on the last focus. `ending: "overviewIfRoom"` only uses the existing non-speech slack within the range (at ≥ 1.2 s, pull back to the segment's world bounding box, up to 1.5 s). With no slack it holds still, without compressing the final word's reading time or extending the project duration.

Segments sit on the **same canvas**. Each segment's world is first laid out in its own local coordinates, then attached beside the previous segment's world: continuing in the direction the previous segment ended (§7.2 “below”), separated by 0.6 viewports (converted from the zoom used to frame the first block), and not overlapping any existing world. If that fails, switch sides and double the gap; as a last resort, place it far to the right. A block's `center` is a global value, while `localCenter` and pins are local values (re-laying out the previous segment must not move this segment's fixed blocks). The first camera segment of the next segment is an `enter` segment departing from the previous segment's end pose (including the overview). Its window follows the rules in §8.4 and opens on arrival, and `cutAt` is its takeoff time. During the flight the previous segment is still drawn on screen with the **same camera**; from takeoff until arrival, and then over `fadeMs`, it fades out along an ease curve. Blocks that are fading out count toward the node budget. The first segment is a hard cut to the first block. TypeMonkey has a single infinite canvas with the camera flying throughout; here a “segment” is only a unit of layout locality, not a cut point. When the user explicitly chooses “add end overview”, that is a deliberate editing operation: the Timeline / export layer is responsible for adding the tail segment, and the subtitle renderer does not fill in frames for it. It can be deferred.

## 9. Shared Rendering Implementation

### 9.1 Internal Interfaces

Add a module `core/crates/ccut-subtitle-render/src/caption_sequence/` (`model / resolve / segment / layout / camera / sample`). Do not create a new crate, and do not put it in `apps/cuccut`.

```rust
pub struct CaptionSequencePlan {
    pub identity: PlanIdentity,
    pub groups: Vec<SequenceGroup>,
    pub resources: ResourceRequirements,
    pub diagnostics: Vec<CaptionDiagnostic>,
}
pub fn compile_sequence(input: &ProjectedCaptionInput, style: &ResolvedSequenceStyle,
                        metrics: &PreparedTextMetrics) -> Result<CaptionSequencePlan, CaptionError>;
pub fn sample_sequence(plan: &CaptionSequencePlan, output_time: f64) -> CaptionSequenceFrame;
```

`sample_sequence` does not read files, probe fonts, touch the network, or generate random numbers.

### 9.2 OverlayRenderPlan Integration

At compile time, build two kinds of plan, a plain cue plan and a sequence plan, according to the effective style. At render time, cues owned by a sequence are no longer drawn as plain subtitles; fixed translations still take the plain path. The CPU image, GPU scene, picking geometry, font requirements, visible bounds, and diagnostics are all derived from the same `CaptionSequenceFrame`.

### 9.3 GPU Path and Minimum Viable Approach

First closed loop: compile the shaped geometry once. At each sample time, compute one matrix from the camera channels, combine it with the visible block / word poses, and write the result into the existing glyph pose and per-word uniforms (including `clip`). Dynamic frames run a **lightweight sample**, not a recompile. `next_change` points to the next time a sample is needed (while moving = next frame; at rest = next word onset / segment boundary).

Later, split static scene updates from dynamic pose updates, and rebuild the scene only at structural boundaries. At that point, use `active_until` to express continuous motion, and add a general **decomposed-transform** motion to the retained scene (a new type / new encoding capability, leaving the old `SceneMotion` unchanged). The native and Web compositors do not each implement their own camera.

### 9.3.1 Clarity: Rasterize at Screen Size + Automatic Stroke (2026-09-18)

User feedback: “The text is a bit blurry; the burned-in subtitles in the video were clearer.” The root cause is in the GPU path: glyph masks in the atlas are rasterized at the **world font size** (about 30 px), then sampled after the camera zoom magnifies them two to three times. The CPU path uses contour filling, which was already clear.

- **Rasterize at screen size**: for each word, take the actual scale of “line transform ∘ camera”, quantized up to steps of 2^(1/4) so the mask is not regenerated every frame during zoom. Shape and take the mask at `font size × scale factor`, then multiply by `1 / scale factor` in the instance transform to shrink back to line coordinates. The raster font size is capped at 144 px (a frame's glyphs must fit in a 2048² atlas), with a floor of 0.25×.
- **No glyphs outside the region**: lines whose transformed line-box bounding box (the four corners, padded by one line height on each side) does not intersect the subtitle region are skipped entirely, saving atlas space on GPU and fill work on CPU.
- **Automatic outline**: when overlaid on video (as opposed to “stage mode + opaque background”), the sequence layer draws a dark outline around each glyph, 0.045 em on each side. On GPU it is a separate glyph run placed before the fill run, using the stroke mask from `glyph_stroke_atlas_render` (width quantized to 0.5 px). On CPU, the whole layer is first `stroke_path`-ed (round joins), then the whole layer is filled, in two separate passes, so one glyph's outline never sits on top of the previous glyph. The outline's opacity is the square of the word's opacity, so it appears slightly later than the fill during entrance. Stroke and shadow from the paint styling are still not read (§3.4); this outline is not a user-adjustable option.

### 9.4 Viewport Clipping (R4)

Initial release: write the viewport rectangle (screen space, quantized at compile time to integer output pixels) into each glyph run's `clip`. GPU intersects it with the current scissor. CPU applies the same bounds to the entire subtitle sub-scene. The existing scissor is saved and restored correctly. `ClipRectGroup` is needed when per-block backing plates / decorative vectors appear, or when shadows / blur overflow the viewport. At that point, update the BCS encoder/decoder, the Web reader and the fallback preflight together.

### 9.5 Layering and Exclusion Switches

Drawing order inside the subtitle layer: optional screen background → history blocks → current block → fixed translation. The whole layer still sits at the existing compositing position of subtitles and timeline elements. `--no-subs` excludes all caption-sequence content; `--no-texts` does not delete it as a text element; track hiding matches burn-in mode [R2].

### 9.6 Cache Identity and Scheduling

Four layers: text shaping cache; world layout cache (block size, seed, constraints, frame aspect, algorithm version); timing plan cache (output projection, segmentation, camera windows); frame identity (camera matrix, visible block / word state, color, clip). `subtitle_key` must not look only at the current cue id. `draw_op_fingerprint` represents the whole overlay. Keep `next_change` and `active_until` distinct [R2][R7]. Do not use PNGs as cache; the Web CPU fallback handles straight alpha. A caption sequence may cover the entire canvas, so do not carry over the assumption that “subtitles only occupy a narrow strip at the bottom”.

### 9.7 Performance Boundaries

The first version does not do motion blur, 3D perspective, physics collision, or a dynamic weight axis. Cull history blocks outside the visible area (AABB expanded by the effect's extent). Respect the 1024-run / 4096-node budget [R7]; when the limit is reached, split the segment, shrink history, or take the declared fallback. Record performance metrics separately: plan compile time, per-frame sample, glyph upload volume, fallback count, and peak memory at 1080p / 4K.

## 10. Edit Linkage and Invalidation Rules

| Operation | Preserved | Recompute / diagnose |
|---|---|---|
| Change text color only | World position, camera, shaping | Frame key |
| Edit subtitle text | Stable word identity, seeds of other segments | Current block shaping; this segment's layout and camera |
| Change font size / typeface / tracking / density | Script, seed, manual intent | Metrics, collision, fit; conflict warning for fixed blocks |
| Change `hero` role | Script, seed | Visual chunking, this segment's layout and camera (R5) |
| Change `emphasis` role | All geometry | Frame key |
| Split / merge cues | Original word IDs | Visual blocks and scope; do not bind by cue array index |
| Hide subtitle words | Audio/video edits | Visible set and focus; hidden words are not kept as history |
| Cut a media clip | Intent of the uncut parts | New output projection; sequences before and after the cut are independent |
| Change clip speed | Static geometry | Camera windows, word-level animation timing, segmentation |
| Move clip | Content and instance ID | Output time offset; do not track by absolute seconds |
| Duplicate clip | Source script | New instance identity; explicitly copy or not copy constraints |
| Change frame aspect | Script, seed, relative viewport | Aspect-tier tokens, line wrapping, collision, camera |
| Re-recognize, generating new word IDs | Do not guess pairings | Explicitly rebind if an edit mapping exists; otherwise mark as orphaned |
| Undo / redo | Seed, scope, constraints | Deterministic recompile |

Word-anchor migration reuses the existing edit mapping as part of the shared transaction. Never silently rebind on read based on time or similar text. Cleaning up orphans is an explicit, undoable operation.

### 10.1 Transaction entry points

Stage A: `ApplySequenceStyle(scope = track, preset)`, `ReseedSequenceStyle(scope = track)`, and the existing `SetCaptionEmphasis`. Stage C adds: `SetSequenceCaption(instanceId, caption)`, `SetSequenceBoundary(wordAnchor)`, `PinTypographyBlock(blockSpan, placement)`, `SetInstanceEmphasis(wordAnchor, role)`, `ClearSequenceOverride(scope, section)`.

Persist through the existing Kernel / workspace style transactions; protocol extensions generate TS from the Rust definitions. `style/apply` and Transcript use the studio document revision; Timeline has its own revision [R12]. Splitting overlapping ranges for a selection, generating instance ids, and saving styles and constraints must be committed in one go. New ids are allocated inside the transaction, never generated in `sample(t)`.

## 11. Output and compatibility

- **MP4 / local video**: reuse `OverlayRenderPlan` and the existing assembly, compositing, and encoding pipeline. Sample by `t = n / fps`; do not accumulate wall-clock time. The total frame count follows the unified duration policy.
- **SRT / VTT / ASS**: a semantic projection of the subtitles in the finished cut. No historical leftovers are output and no coordinates are written. A repeated clip is repeated according to how many times it appears in the finished cut. For the first ASS release, show the explicit notice 「文本与时间可导出，倒鸭子效果不保留」 (“Text and timing can be exported; the daoyazi effect is not preserved”) [R4].
- **Editable NLE project**: hook into the `ccut-editable` preflight and offer three choices: keep ordinary editable subtitles / bake the subtitle layer for that range if the target format supports it / cancel. Unverified transparent-video export is not recorded as an existing capability.
- **BCF author layer**: do not rework it into a special BCF node. In the future, provide an explicit “Freeze / Bake” that projects and plans the subtitles into author-format text, transform, and timing tracks. The copy is detached from the original subtitles, and the UI explains this.

## 12. Concrete change list

| Type | Location | Change | Stage |
|---|---|---|---|
| Added | `ccut-subtitle-render/src/caption_sequence.rs` (when landed, merged into one file, flattened via `include!` in `lib.rs`) | Cross-sentence input, segmentation, visual chunking, world typesetting, camera and sampling | A (done 2026-09-17) |
| Added | `ccut-subtitle-render/src/caption_sequence_demo.rs` | Gallery sample: three fixed sentences run through the same sequence compile / sample / real glyphs; the App's `stylepane/sequence_thumb.rs` lays out frames at 30 fps in the background | C (done 2026-09-18) |
| Extended | `ccut-subtitle-render/src/{document,caption_recipe,render_plan,transition}.rs` | Dispatch by `execution.scope`; scene / CPU share the sequence frame; dynamic keys and fallback; run clip writes the viewport | A–B (done 2026-09-17; picking not yet wired) |
| Extended | `ccut-subtitle-render/src/style_sync.rs` | Lossless round-trip of `seed` and `options.daoyazi` | A |
| Added | core `CAPTION_RECIPE_FILES`, `apps/cuccut/assets/captions/`, Web asset copies | `caption-daoyazi` descriptor and `execution` (core and App copies done 2026-09-17; Web not done) | A |
| Extended | `ccut-motion/src/{program,interpolate,sample}` | `LogPositive` interpolator and tests; old curves unchanged | A (can be deferred) |
| Extended | `ccut-editor-core/src/style_library.rs`, `apps/cuccut/src/host/style_library.rs`, `apps/cuccut/src/app/editor/stylepane/daoyazi.rs` | Register / save / “Re-roll” (换一版, whole track); gallery groups by registry `family == "kinetic"` (done 2026-09-17); scope and segment-level re-roll, segment breaks, per-word / history line count / background / paragraph end, layout edit state (done 2026-09-18; `captionSequences` added to the style library exclusion keys). “Apply to” (换给) has two levels: whole track and current segment | A, C (done) |
| Extended | `ccut-compositor` / CPU scene executor | Per-frame pose sampling, run clip intersected with scissor, budget and fallback | B |
| Extended | `ccut-wasm-subtitle`, `ccut-wasm-editor` | wasm export for plans / intents | B |
| Extended | `apps/web` subtitle rendering and property page, `apps/cuccut` subtitle style / stage | Only pass data and control the preview; same-named operations; layout edit state (App done 2026-09-18: `stage/sequence.rs` row layer + `StageGesture::SequenceRow`, geometry sidecar `LayoutFrame.sequence`; Web not done) | B–C |
| Extended | `ccut-timeline-render/src/scene.rs` and encode/decode | Decompose transform motion (when retained optimization is used); `ClipRectGroup` (as needed) | D |
| Extended | `ccut-protocol`, Kernel write path | `captionSequences`, `captionSequenceV1`, validation, regeneration of TS / docs | C (not done: App writes the whole Blob back, see §5.5) |
| Extended | `ccut-editable` and export preflight | Explicit choice when an effect is unsupported (done 2026-09-18: preflight code `caption-sequence` warning; the original-text track goes through `tr-subs` as ordinary lines, determined by the kernel from the original-line recipe) | B (done) |
| Extended | `designs/cuccut` | Gallery “Dynamic typography” section's daoyazi card, property page's 「倒鸭子」 section, stage canvas and layout edit state (wired 2026-09-17, including stage C controls) | Done (prototype) |
| Extended | Docs and fixtures | Style contract, protocol changes, product behavior, golden | Per stage |

Do not introduce `ffcreator`, a React animation engine, browser screen-recording APIs, or a new server-side rendering service.

## 13. Staged implementation and acceptance

### Stage A: format and pure compile loop

Landed 2026-09-17 (core `caption_sequence.rs` + `render_plan.rs`; `caption_sequence_tests` and `daoyazi_sequence_takes_over_the_original_track_on_both_render_paths` in `cargo test -p ccut-subtitle-render` pin determinism, seek consistency, viewport clipping, and both GPU / CPU paths). Byte-identical native / wasm output is not yet verified on the wasm side.

Deliverables: descriptor `execution`, lossless round-trip of `seed` / `options.daoyazi`, source + clip instance projection, segmentation, real font metrics, deterministic world layout, camera track (including lead time), per-word lifecycle. First use a full canvas, single language, plain fill, and finite right-angle motion, verified with existing CPU / Scene output.

Exit criteria: for a fixed input, sampling during forward playback, seek, and reverse playback is bit-identical; changing color does not reflow; changing one segment does not randomly change unrelated segments; cut / speed change / repeated clip neither misplaces words nor mixes groups; the same seed yields the same quantized plan on native and wasm. Before any UI exists, write these invariants as tests.

### Stage B: native and Web rendering

Native side landed 2026-09-17 (App v2 stage goes through the shared `OverlayRenderPlan`; gallery “Dynamic typography” group and property page 「倒鸭子」 section). Web rendering and export preflight not done.

Deliverables: GPU glyph pose path, run clip viewport, CPU fallback, dynamic cache / `next_change`, gallery gating, export preflight.

Exit criteria: native preview, Web, and formal export use the same layout / camera / lifecycle at the same moment; unsupported GPU conditions fall back explicitly without dropping layers; a local viewport neither drops glyphs nor wrongly clips other layers.

### Stage C: style interaction and editing

App v2 landed 2026-09-18: the gallery card runs the sample for real (after selection, frames are laid out by the user's palette / seed); whole-track / current-segment two-level “Apply to” (换给); `captionSequences` (compact shape, see §5.4); segment breaks; per-word appearance / history line count / background / paragraph end controls; layout edit state (drag to pin rows / rotate / fix / restore auto; one Blob write-back per drag is one undo step); click-a-row-to-jump on the stage (R15, only when paused); export preflight warning. Not done: current-selection / “this one only” two-level scope, double-click to enter edit state, gallery hover try-on (selection runs for real, with no hover temporary document), Web, protocol capability. “Subtitle edit linkage” (「字幕修改联动」: after editing words, the pins key mismatches and reverts to auto) and “keep layout when reopening a project” (「复开项目保持布局」) have only unit tests and are not verified end-to-end on a real project.

Deliverables: continuous gallery preview; whole-track / this-segment / selection scope; `captionSequences`; fixed layout and layout edit state; per-segment re-roll; undo / redo; subtitle-edit linkage. Bilingual “original dynamic, translation fixed” (「原文动态、译文固定」).

Exit criteria: each operation only affects its declared scope; try-on does not pollute export; cancel, undo, and reopening a project keep the same layout; App and Web share identical operation results.

### Stage D: quality and advanced features

Deliverables: sample parameter tuning, logarithmic scaling, segment-end overview, translation-driven motion, instance migration, retained scene / atlas optimization, `ClipRectGroup`. Translation-driven motion, AI keyword suggestions, manual camera keyframes, 3D, motion blur, and simultaneous multi-track traversal do not block the initial release.

## 14. Test matrix

### 14.1 Determinism and geometry

- Same input, font, algorithm version, seed, and sampling time rendered repeatedly are identical; native / wasm quantized plans are byte-identical.
- Forward playback to 7.2 s, direct seek to 7.2 s, and reverse from 10 s back to 7.2 s are consistent.
- 0 → 90 → 180 turns without matrix collapse; the turn direction matches the recorded plan; with `maxTurnDeg: 0`, the angle is 0 throughout.
- A line is the minimal unit: each block is a single line; words are left-aligned starting at 0 and never go back; viewport width ≥ 2 em and ≥ text width; line height = 1.2 × font size; line boxes fall on a 1/32 grid. The viewport width of a one-character line is exactly 2 em.
- Per-line framing: in reading state, `zoom × line viewport width = viewport width × fit` (unless the 30% font-size cap is hit); camera center = line center.
- Pivot geometry: after `lb`, the new segment's angle is +90 and the new first line's bottom-left corner coincides with the previous line's bottom-left corner; after `rb`, −90 and the bottom-right corners coincide; adjacent lines in the same segment sit tightly and are left-aligned; the angle difference between adjacent segments is only ±90 or 0 (segment skip).
- CSS `ease`: `cssEase(0.5) ≈ 0.802`, `cssEase(0.25) ≈ 0.409`, monotonic, endpoints zero and normalized; in the stop-and-go profile, the motion midpoint reaches `cssEase(0.5)`; pop-in start = `popFrom`, origin = the word's left edge (the line's left edge for a whole block).
- Zoom stays within the readability range throughout; very short sentences, single characters, punctuation, and empty blocks produce no NaN / Inf.
- In reading state, the four corners of the current block are within the viewport. In smooth mode, at the new block's first-word onset the camera has already arrived (`t1 = onset`); in stop-and-go mode the lead time is ≤ 0.6 × travel.
- Position / angle / zoom share one ease: in smooth mode, at the midpoint all three have covered exactly half; position does not pass the endpoints (no overshoot).
- Segment to segment: the world bounding boxes of segments do not overlap each other; `center = localCenter + origin`; the `enter` segment's start equals the previous segment's end pose and is not earlier than that segment's stop time; the camera pose is continuous for an instant around `cutAt`.
- Typesetting flows forward: most lines (≥ 60%) fall “below” in the previous line's coordinate system; at least `turnEvery` lines separate two turns.
- Turn frequency: under default dynamics, turns are no fewer than 15% of lines, and turns also occur mid-line (not only at punctuation, within the same cue). This is the lower bound after raising the turn probability on 2026-09-18.
- Layout: no two block AABBs intersect; pinned block positions are unchanged; hero words form their own block.
- Pixel golden is only done under a fixed software backend and font; CPU / GPU use tolerances on boundary position, opacity, and threshold.

### 14.2 Time and content

- 24 / 25 / 30 / 60 / 30000⁄1001 fps; the frame before a boundary / the boundary frame / the frame after.
- Trimmed at either end mid-sentence, consecutive very short cues, long pauses, multiple speakers cutting in, an original word crossing a cut point.
- Multiple clips from the same source, the same word appearing twice, `sourceItemId` identical but `sourceId` different.
- SRT without word timing (`reveal` degrades), sentence-level translation, missing translation, hidden original or translation, translation only.
- Historical leftovers do not change SRT; future blocks are not exposed before `onset − pre`, and a block already entering before onset is not counted as “being read aloud” (在念); the overview does not extend output; the previous segment finishes fading within `fadeMs` after the `enter` segment arrives.
- Combinations of `--no-subs` / `--no-texts` / `--no-audio` / export window.

### 14.3 Text and format

- Mixed Chinese and English, CJK punctuation, combining characters, emoji, RTL, ligatures, numbers with units, very long words.
- Font fallback, missing / supplemented fonts, cache invalidation after changing the font.
- Results for old style / caption reads are unchanged; readers that do not recognize `execution` do not list it, render it as an ordinary subtitle, and report a diagnostic; style / context round-trip does not drop `seed` or `options.daoyazi`.
- Templates do not contain `seed` or project word anchors; for stage C, `instance.caption` missing / null / object each behave correctly.

### 14.4 Performance and scheduling

- During pure camera motion with unchanged cues, redraw continuously; once motion ends with no changes, stop idling.
- After a cache hit, do not reshape again or re-upload identical glyph masks.
- 1080p / 4K, landscape and portrait, CPU fallback, no GPU, budget overflow.
- Long-script compilation must not keep all world and history glyphs resident in VRAM permanently; ordinary captions show no performance or pixel regression.

Suggested new `core/fixtures/caption-sequence/`: one each of a short clip, a long script, bilingual, repeated segments, fast speech, hero-dense, and a fixed-layout conflict. Record the normalized plan, the geometry at selected moments, and reference images for each. The prototype's `designs/cuccut/app/model-daoyazi.test.js` already covers four invariants (determinism, no overlap, consistent seek, and zoom intervals) and can serve as the reference for the Rust tests.

## 15. How the prototype migrates

| Prototype part | Reusable | Production replacement |
|---|---|---|
| Segmentation / chunking / candidate scoring / camera window in `designs/cuccut/app/model-daoyazi.js` | Algorithm and initial weight values, invariant tests | Rust implementation, wired to the shared projection and TextEngine metrics |
| Canvas `measureText` | Reference for tuning visual density | Shaping and caching in the same TextEngine |
| FNV-1a + SplitMix64 | Direct comparison | Same algorithms, integer domain |
| Attribute panel, try-on, layout edit state | Interaction and copy | Existing App / Web caption-style workflow and shared editing intent |
| Plan inspection (plan JSON) | Debugging and test snapshots | Does not become the source of truth for authoring |

## 16. Recommended first-release boundary

First-release path: **select an existing caption → apply the Daoyazi (倒鸭子) preset → adjust motion and color → edit the script and it still follows automatically → native / Web preview → final video export**.

Required capabilities: cross-sentence worlds, per-word appearance, correct lead-in camera shots, output time projection, stable randomness, run clip viewport, font consistency, undo, and shared export. Can be deferred: per-instance scope and fixed layout, 3D, free camera, AI choreography, simultaneous motion on two tracks, and transparent-video export in all formats.

The one line to hold to: the user changes “the way captions are presented,” not switches into a different app for generating videos.

---

## Source verification

Repository source pinned at `17e329814`; reference numbers keep the original proposal's numbering.

- [R1] `core/README.md`; `core/crates/ccut-subtitle-render/src/lib.rs`.
- [R2] `core/crates/ccut-subtitle-render/src/{document,render_plan,transition}.rs`.
- [R3] `core/crates/ccut-subtitle-render/src/caption_recipe.rs`: `CaptionRecipeDescriptor`, `layoutTokens`, and `caption_recipe_design_descriptor` returns `None` for unknown ids.
- [R4] `docs/changelog/core/2026-09-15-070821.md`: `cueStyles` and ASS sidecar limitations.
- [R5] `core/crates/ccut-editor-core/src/caption_registry.rs`: `payload()` writes only schema / content / palette / intensity / speed / style, and a recipe change keeps the other keys; `captionEmphasis` reads and writes.
- [R6] `core/crates/ccut-editor-core/src/{style_library,stylepane}.rs`; `ccut-subtitle-render/src/style_sync.rs`.
- [R7] `core/crates/ccut-timeline-render/src/scene.rs`: `SceneMotion::sample` six-component interpolation, `post_concat_mat6`, `GlyphRunUniform.clip`, `GLYPH_RUN_UNIFORM_LIMIT = 1024`, `SCENE_NODE_LIMIT = 4096`.
- [R8] `core/crates/ccut-render/src/drawop.rs`: `ClipPath` / `PopClip` (v3).
- [R9] `core/crates/ccut-timeline/src/schema.rs`; `ccut-subtitle-render/src/host_support.rs`.
- [R10] `core/crates/ccut-motion/src/{lib,program,value,interpolate}.rs`: `PropertyTrack` segments do not overlap; `InterpolatorSpec::{Linear, Step, Angle, Color}`.
- [R11] `apps/web/docs/subtitle-tab-redesign.md`.
- [R12] `core/crates/ccut-editor-core/src/edits.rs`; `AGENTS.md`.
- [R13] `apps/cuccut/src/assets.rs`: `CAPTION_REGISTRY` / `CAPTION_STYLES` embedded gallery resources.
- [W1] TypeMonkey product page `https://aescripts.com/typemonkey/`: visual-style reference.
- [W2] HarfBuzz clusters documentation `https://harfbuzz.github.io/clusters.html`.
