# v2 Element Model vs. v3 Video Format

This document is the porting input for the `crates/timeline` wiring batches. It records, item by item, the differences between v2 `timeline.json` 0.12 and the v3 video format, and where each one ends up. The rules are defined by the [architecture design](../../architecture/architecture-design.md) (§13.4, §13.6) and the [video format spec](../../spec/video-format-spec.md). If either of them disagrees with this document, this document is updated.

## 1. Scope

`crates/timeline` is a verbatim port of v2 `ccut-timeline` (for the v2 spec, see [`ccut-timeline-json-spec.md`](ccut-timeline-json-spec.md)). It splits into two halves with different destinations:

| Half | Modules | Destination after wiring |
| --- | --- | --- |
| Timeline semantics | `cuts`, `arrange`, `map`, `follow`, `anchors`, `words`, `match_text`, `detect`, `rules`, `patch`, `keyframes` (sampling, splitting, joining, rewindowing), `duck` (intervals and curves) | `editor-semantics` and VideoEngine calls: cut points, semantic follow, keyframe editing, speech-based ducking |
| Element model | `schema`, `elements`, `geometry`, `effects`, `animations`, `motion`, `video_elements`, `video_transitions`, `template`, `svg_fill`, `lottie_fill`, `protocol`; `screentext` (on-screen text, not wired for now) | Fields go into the video format and `video-model`; validation, geometry and effect conversion go to the render adapter layer and the editor |

Meaning of the marks:

- **Same**: v3 has the same concept; fields can be matched one by one, at most with a unit change.
- **v3 missing**: v2 has it; neither the v3 format nor `video-model` has it.
- **v3 only**: the field already exists in v3; v2 has no counterpart.
- **Different semantics**: both sides have it, but the meaning, values or scope differ, and a decision is needed (see section 7).

`video-model` refers to the existing types in `crates/video-model/src/`. "spec §x" refers to a section of the video format spec.

## 2. Element kinds

v2's `ElementKind` is a closed enum, and props correspond one-to-one with kinds (`schema.rs`). v3 types instances by what the user sees; generated visuals are unified as built-in generators of composition instances (spec §3.4, §3.7).

| v2 `kind` | v3 instance | Mark | Notes |
| --- | --- | --- | --- |
| `video` | `VideoItem` (`TimelineItem::Video`) | Same | A source imported with only sound becomes an `AudioItem` |
| `image` | `ImageItem` | Same | |
| `audio` | `AudioItem` | Same | Sample-level position (spec §2.10) |
| `text` | `TextItem` | Different semantics | `style` is an untyped object on both sides; v2 keys are by convention in the renderer, v3 now stores `cuccut.legacy-text-style/0` (section 5) |
| `text` + `counter` | `CompositionItem`, built-in `cuccut.counter` | Different semantics | In v2 this is one way of writing a text element and is mutually exclusive with `text`; in v3 it is a generator whose parameter contract is undefined (spec §9) |
| `shape` | `ShapeItem` | Different semantics | `shape` is untyped on both sides; v3 now stores `cuccut.legacy-shape/0` |
| `sticker` | `StickerItem`: template stickers draw vectors from the template sticker catalog; material stickers point to an image, video or `lottie` asset | Different semantics | In v2 one element has three sources; in v3 Lottie is one kind of asset (§7.1 item 10) |
| `visualizer` | `CompositionItem`, built-in `cuccut.audio-visualizer` | Different semantics | Parameter contract undefined |
| `progress` | `CompositionItem`, built-in `cuccut.progress` | Different semantics | Same as above |
| `draw` | — | v3 missing | Import writes `cuccut.legacy.draw`; the renderer cannot draw it |
| `placeholder` | — | v3 missing | Same as above |
| `confetti` | — | v3 missing | The spec does not list this generator; the UI already uses `cuccut.confetti` |
| `whiteboard` | — | v3 missing | Same as above; not in the spec |
| — | `CaptionItem` | v3 only | v2 captions are not timeline elements; they live in the script and Studio data |
| — | `CompositionItem` (`bundle` source) | v3 only | Code package; the v2 counterpart is BCF |

Generator names already in use but not listed in spec §3.7: the UI's `cuccut.confetti` (drawn by the confetti routine in `render-raster`), and the `cuccut.animated-sticker` written by import (an animated sticker asset that is not Lottie).

## 3. Field-by-field comparison

### 3.1 Common instance fields (spec §3.4)

| v2 | v3 | Mark | Notes |
| --- | --- | --- | --- |
| `id` | `ItemBase.id` | Same | |
| `name` | `ItemBase.name` | Same | |
| `role` (`broll`, `watermark`, `screentext`, `overlay`, `frame`; closed) | `ItemBase.role` (open vocabulary) | Different semantics | In v2 the role takes part in follow and claiming (`follow.rs` rule 1 excludes `broll` and `watermark`); in v3 the role "does not change rendering" and does not take part in editing. Import writes `broll` as `b-roll` |
| `hidden` | `ItemBase.enabled` (inverted) | Same | |
| — | `locked`, `paintOrder`, `lineage`, `linkGroupId` | v3 only | In v2 the stacking order is the array order |
| `start`, `end` (`TimeValue`: seconds of the output, or a word anchor) | `span` (`FrameSpan`); audio uses `fromFrame` + `subframeOffset` + `playDuration` | Different semantics | See section 4. In v2 `end` may be omitted (to the end of the timeline); in v3 the span must be fixed |
| `ai` (untyped) | — | v3 missing | Source note for AI generation; can go into `extensions` or the asset's `provenance` |
| — | `extensions` | v3 only | v2 elements are `deny_unknown_fields` |

### 3.2 Geometry and appearance (spec §3.5)

| v2 | v3 | Mark | Notes |
| --- | --- | --- | --- |
| `place.x`, `place.y`: center, as a percentage of the canvas | `transform.x`, `transform.y`: pixel offset of the anchor from the canvas center | Different semantics | Units and origin both differ; conversion needs the canvas size |
| `place.w`: percentage of frame width (square-like elements use the short edge, `geometry::width_basis`); height is derived from the natural aspect ratio (`geometry.rs`) | `transform.width`, `transform.height`: pixels, both explicit | Different semantics | In v2 elements re-flow automatically when the frame changes; in v3 the pixel box does not follow |
| `place.scale`, `place.scaleY` | — | Different semantics | v3 has no scale, only box size; so keyframe `scale` has no destination |
| `place.rot` (degrees) | `transform.rotation` (degrees, clockwise around the anchor) | Same | Rotation center: v2 is the element center, v3 is `anchor` (import fixes it at `[0.5, 0.5]`) |
| `place.opacity` | `VisualItemBase.opacity` | Same | |
| `place.flipX`, `place.flipY` | `transform.flipX`, `transform.flipY` | Same | |
| `place.radius` (pixels at a 540 short edge, `effects::REFERENCE_SHORT_EDGE`), `place.cornerRadii` (four corners) | `cornerRadius` (single value, unit TBD) | Different semantics | In v2 it only takes effect for picture-in-picture or tiling; v3 applies only to video and images. Independent four-corner radii are v3 missing |
| `verticalAlign` (which edge of the text block is pinned at `place.y`) | vertical component of `transform.anchor` | Different semantics | Convertible, but v2's is text-specific and kept separate from style |
| `mode` (`fullscreen`, `pip`) | — | Different semantics | v3 expresses full screen with a `transform` that covers the canvas |
| `fit` (`cover`, `contain`) | `fit` (`contain`, `cover`, `stretch`) | Same | `stretch` is v3 only |
| `bg` (`blur`, `black`, `#RRGGBB`) | `backdrop` (`black`, `blur`) | Different semantics | Solid color is v3 missing; v2 `bg` fills the canvas, while v3 `backdrop` is only inside the instance's layout box (spec §9) |
| `tile` (tiling: angle, spacing, staggered rows) | — | v3 missing | |
| `mask` (`ellipse` + `feather`) | — | v3 missing | In the spec, a mask is only one kind of RenderGraph dependency |
| — | `crop` | v3 only | |

### 3.3 Effects (spec §3.9)

v2's `fx` is a structure with fixed fields, which is mapped in a fixed order into an effect stack (`effects::lower_element_effects`: color, blur, shape mask, progress mask). v3 is an ordered array of effects whose order is set by the user.

| v2 `fx` | v3 `Effect` | Mark | Notes |
| --- | --- | --- | --- |
| `brightness`, `contrast`, `saturation` ([−1, 1]) | same-named parameters of `color-adjust` ([−1, 1]) | Different semantics | Same range, but the formulas must be checked one by one: v2 saturation is `1 + s`, and brightness lives in `filter.colorAdjust` |
| `hue` ([−1, 1]) | `color-adjust.hue` ([−180, 180] degrees) | Same | v2 is multiplied by 180 when converted |
| `blur` (0–100, pixels at a 540 short edge) | `gaussian-blur.radius` (standard deviation, canvas pixels, [0, 200]) | Different semantics | Different baselines; whether both are standard deviations must be checked against the render core |
| `grayscale`, `exposure`, `sharpen`, `noise`, `vignette` | — | v3 missing | |
| `filterPreset` (`calm1`–`peckham3`, 12 in total) | — | v3 missing | Presets are expanded by `motion` recipes |
| `effectPreset` + `effectIntensity` (`invert`, `night_vision`, `old`, `bokeh_blur`, etc.; 9 in total) | — | v3 missing | Same as above |
| — | `temperature`, `drop-shadow`, `stroke` | v3 only | In v2, shadow and stroke live in the text style |
| — | effect `id`, `enabled` | v3 only | |

### 3.4 Transitions (spec §3.9)

| v2 `transitions` | v3 `Transition` | Mark | Notes |
| --- | --- | --- | --- |
| `in` and `out` on a video element, each one side | objects on the sequence, `rightItemId` / `leftItemId` | Different semantics | v2 has only one side and samples within the element's own span; v3's one-sided transition corresponds to it, and there are also two-sided transitions |
| `k`: `dissolve`, `wipe`, `slide`, `zoom`, `iris` | `crossfade`, `dip-to-color`, `slide`, `push`, `wipe`, `zoom` | Different semantics | `iris` is v3 missing; `dip-to-color` and `push` are v3 only. v2 `slide` fades in at the same time with a fixed direction; v3 `slide` has a direction and does not fade. `zoom` is 0.75 → 1 with a fade-in on both sides |
| `dur` (0.1–2 seconds, default 0.5; when sampled, not more than half the element's length) | `durationFrames` (≥ 1, ≤ 10 seconds) | Different semantics | v2 shortens it automatically; v3 rejects or deletes the transition when out of range |
| linear | `easing` (4 kinds), `placement`, `audioCrossfade` | v3 only | |

### 3.5 Keyframes and element animation (spec §3.15)

| v2 | v3 | Mark | Notes |
| --- | --- | --- | --- |
| `keyframes`: property → `[{t, v, ease?}]`; closed property set `x`, `y`, `scale`, `scaleY`, `rot`, `opacity`, `radius`, `volume`; up to 256 frames each | `Sequence.animationBindings`: `{targetId, propertyPath, keyframes[{localFrame, value, easing}], interpolation}` | Different semantics | In `video-model` it is only `Vec<Value>`; the engine writes an empty array and it is not implemented; the allowlist for `propertyPath` is undefined |
| `t`: element-local seconds, or `"N%"` (a percentage of the element's duration; follows trims) | `localFrame`: a frame on the sequence's edit grid | Different semantics | The percentage form is v3 missing |
| Easing is written on the target frame; names come from the easing table in `motion` | `easing: string` (unknown values are rejected) | Different semantics | The set of easing names must be defined |
| Sampled values replace static values; enter, exit and loop are layered on top | undefined | v3 missing | |
| `volume` keyframes (linear multiplier, 0–4) | `AudioMix.envelope` (`at` exact time, `gainDb`) | Different semantics | Convertible; external project import (`external-project.ts`) already writes it this way |
| Window reopening on split, join and trim (`keyframes::split_keyframes`, `join_keyframes`, `rewindow`); uncovered-base check (`keyframes_uncover`) | — | v3 missing | Edit operations must call these functions |
| `animate`: three slots `enter`, `exit`, `loop`, each `{preset, presetVersion, dur, delay, intensity, ease, stagger, staggerFrom, period, phase, seed}`; `typewriter` and `riseWords` are for text only | — | v3 missing | Spec §9 lists "whether presets become built-in generators or expand into keyframes"; import keeps it in `extensions` |
| `stylePresetId` | — | v3 missing | Source of text style presets |

### 3.6 Following, anchors and cut points (spec §3.16, §6)

| v2 | v3 | Flag | Notes |
| --- | --- | --- | --- |
| Clock: `clips[]` plus `sources.<id>.cuts` is the only source of truth; elements sit on the export clock | The instance `span` and `timeMap` are the timeline; there is no derived clock | Different semantics | See section 4 |
| `Source.cuts[]`: `{id, t0, t1, ref?}`, cuts on the source clock, restorable | — | Different semantics | v3 turns cuts into instance splits and moves; restoring is a new transaction (spec §6.2); the cut set itself has no persistent position |
| The four rules of `follow_clock`: a clip's picture follows its segment; elements placed by number are remapped through "old export time → source time → new export time"; word anchors and anchors with no end stay put | `FollowPolicy`: `sequence-fixed`, `item-local`, `speech-anchor`, `explicit-link-group` | Different semantics | `video-model` implements only `sequence-fixed`. In v2, elements placed by number **follow cuts by default**; in v3, "the 10th second" defaults to `sequence-fixed` (does not move) |
| Word anchor `~<source>:<word id>[:start\|:end][+offset]` | `SemanticAnchor.word`: `{speechRef, wordId, occurrenceId?, edge}` | Different semantics | v3 has no offset; only `item` anchors carry `localOffset`. v2's source is `srcId`; v3 points at a transcript version |
| Anchor errors: `word-anchor-invalid`, `-missing`, `-cut`, `-unmapped`, `-ambiguous` | Entries cut away become `orphaned` | Different semantics | v3 defines only the cut-away case |
| `CutProposal`: `{id, kind: filler \| silence, t0, t1, wordIds, afterWord, reason, detail}` | `EditorialProposal.suggestions[]`: `kind` is `filler`, `pause`, `false-start`, `repeat` or `manual-range`, anchored on word IDs, with `status` | Different semantics | `silence` maps to `pause`; v2 has no detection of `false-start` or `repeat`; v3 suggestions carry no times, the engine computes the cut points |
| Detection parameters: `DEFAULT_WORD_PAD` 0.05, `CUT_MERGE_GAP` 0.02, `MIN_AUDIBLE_FILLER_SEC` 0.05; pause compression `threshold` 0.8, `compressTo` 0.3, `sentenceCompressTo` 0.4, `maxGap` 3.0 | "Breath padding; quantization computed by the engine" (spec §6.1, §6.3) | Missing in v3 | Constants come over unchanged with the crate; use them as-is when wiring |

### 3.7 Ducking (spec §3.9)

| v2 `duck` (attached to the audio or video element being lowered) | v3 `DuckingRule` (on the sequence) | Flag | Notes |
| --- | --- | --- | --- |
| `under: "speech"`: words in the script (projected onto the export clock) | — | Missing in v3 | In v3 the trigger can only be tracks and instances |
| `under: <track id>` | `trigger.trackIds` | Consistent | Opposite direction: v2 writes it on the target, v3 has one rule linking two groups |
| `depth` (dB, 0–60, default 10) | `reductionDb` ((0, 60], default 10) | Consistent | 0 is not valid in v3 |
| `attack`, `release` (0–5 s, defaults 0.02, 0.35) | `attack`, `release` (`MediaTime`, 0–10 s, same defaults) | Consistent | |
| Adjacent intervals merged when the gap is no more than `max(0.5, attack + release)` | Merges only overlapping or touching intervals | Different semantics | |
| Ramp drops from 1 to `10^(−depth/20)` in linear gain | Ramp is linear in dB | Different semantics | The two curves differ in shape, so the exported sound differs |
| Gain = volume (or `volume` keyframes) × fade × ducking | Reduction subtracted from instance gain (including fades and envelope) | Consistent | |

### 3.8 Props per class (spec §3.6, §3.7)

| v2 | v3 | Flag | Notes |
| --- | --- | --- | --- |
| `style` (text style, not fixed in shape; keys come from the v2 renderer: `fontFamily`, `fontSize`, `fontColor`, `fontWeight`, `textOutline`, `dropShadow`, `background*`, `textMotion`, `lineHeight`, `letterSpacing`, etc.) | `TextItem.style` | Different semantics | Type is defined in v2's renderers (`ccut-timeline-render`, `ccut-subtitle-render`, `ccut-editor-core`) and is ported with the render core. Fonts must be referenced per spec §3.14, not stored as a font name only |
| `ShapeProps`: `shape` (`rect`, `ellipse`, `line`, `arrow` and outlines in the registry), `fill`, `stroke`, `strokeWidth`, `cornerRadius[4]`, `h`, `x1`–`y2`, `head` | `ShapeItem.shape` | Different semantics | `h` is a percentage of frame height and sets the layout box height |
| `StickerProps`: `source` (`template`, `asset`), `templateId`, `path`, `loop` (`loop`, `once`, `hold`), `fillOverrides` | Composition parameters | Different semantics | Asset reference lives in the parameters; the engine does not track it (spec §9) |
| `VisualizerProps`: `style`, two colors, `fftSize`, `minDb`, `maxDb`, `smoothing`, `gain`, `audio`, `speaker`, `alwaysShow` | Composition parameters | Different semantics | `audio` (which sound to take) points at v2's project mix |
| `ProgressProps`: `style`, two colors, `startProgress`, `endProgress` | Composition parameters | Different semantics | |
| `CounterProps`: `mode` (countdown, count-up), `format` (`s`, `mm:ss`, `hh:mm:ss`) | Composition parameters | Different semantics | |
| `DrawProps`, `PlaceholderProps`, `ConfettiProps`, `WhiteboardProps` | — | Missing in v3 | Whiteboard `beats[].at` and `end` can be word anchors |
| `source` (`file`, `html`), `html` (HTML snippet for an image watermark) | — | Missing in v3 | |
| `srcId`, `srcStart`, `rate` | `assetRef`, `timeMap.linear {sourceIn, rate}` | Consistent | Rate changes from float to rational |
| `muted`, `volume` (linear multiplier), `audioFadeIn`, `audioFadeOut` (0–5 s) | `AudioMix` / `EmbeddedAudio`: `muted`, `gainDb`, `fadeIn`, `fadeOut` | Consistent | Volume becomes dB |
| `bcfClip` (BCF audio clip claimed when narration is imported as a track) | `linkGroupId`: the audio-picture link group of a composition and its voiceover | Different semantics | v3 has no BCF; it keeps only the composition-to-voiceover relation, and the composition's sound stays off as a whole (§5) |

### 3.9 Document-level objects

| v2 | v3 | Flag | Notes |
| --- | --- | --- | --- |
| `ccutTimeline` version (reads 0.1–0.11, writes 0.12, upgraded in place on read) | `VideoSnapshot.schemaVersion` | Different semantics | v3 does not keep compatibility with old v3 videos (§13.4) |
| `sources{}`: `path`, `hash`, `kind` (`video`, `image`, `audio`, `lottie`), `duration`, `naturalW/H`, `hasAudio`, `poster`, `origin`, `provenance` | `AssetRecord` and its revisions | Consistent | v3 lacks the `lottie` kind; duration and size come from probing, and v2's values are used only to cross-check |
| `clips[]`: `{id, srcId, in, out, rate}` | `VideoItem` on the main track | Different semantics | See section 4 |
| `tracks[]`: `{id, kind: overlay \| audio, name, hidden, locked, muted, elements}` | `Track`: `{id, order, kind: visual \| audio \| subtitle, name, locked, visible, muted, solo}` | Consistent | In v2, elements on one track may overlap; in v3 they may not (split onto several tracks on import) |
| `main`: `{detached, place, muted, background, sourceDuration}` | — | Different semantics | v3 has no "main video": the main track is a set of video instances with `role: 'a-roll'`. `background` maps to `canvas.background` (color only) |
| `template`: `TemplateDoc`, a template layer (chapters, progress, logo, text) placed by frame percentage | — | Missing in v3 | Spec §9, "template frame lock and subtitle avoidance" |
| — | `markers` (chapters) | In v3, not in v2 | v2 chapters live in the script and Studio data |

## 4. Container and time

v2's export clock is derived: the `cuts` on the source clock are removed first, then `clips` arranges the segments in order (`arrange.rs`), and element `start` and `end` sit on this export clock. v3 has no derived clock: the main track is a chain of end-to-end video instances, each using `timeMap` to point back to its source. All times are rationals, and visual positions sit on the frame grid (spec §2).

**Conversion rule**: at the crate boundary, floating-point seconds become rationals. Quantization is done uniformly by VideoEngine, which returns a quantization receipt (spec §2.9, architecture §13.6). Floating-point seconds are read as rationals from their shortest decimal form (`editor-semantics::parse_decimal_seconds`), not via floating-point multiplication. Quantization uses `quantize_frame` and `FrameAlignment`.

| v2 field | Clock | v3 field | Conversion | Quantization |
| --- | --- | --- | --- | --- |
| `Source.duration` | Source | `AssetRevision.duration` | No conversion; probing is authoritative | Not quantized |
| `Cut.t0`, `t1` | Source | No direct field: the retained source interval becomes the instance's `timeMap.sourceIn` and length | Seconds → exact rational | `sourceIn` not quantized; the instance position on the sequence is quantized to frames (see next row) |
| `Clip.in`, `out`, `rate` | Source | `VideoItem.timeMap.linear {sourceIn, rate}`, `span` | `rate` written as a rational from its decimal form (1.19 → 119/100); export length = source length ÷ rate, end to end | Start and end each snap to the nearest frame (ties go early), at least 1 frame; if the start moves, `sourceIn` moves in sync at the rate; the source interval does not pass the end of the asset (rounded down) |
| `Element.start`, `end` (numbers) | Export | Visual: `span.fromFrame`, `durationFrames`; audio: `fromFrame` + `subframeOffset`, `playDuration` | Seconds → exact rational | Visual snaps to the nearest frame; audio start takes the previous frame plus the exact subframe offset, length kept exact |
| `Element.start`, `end` (word anchors) | Script | `followPolicy: speech-anchor` plus the resolved `span` | `anchors::resolve_time_value` gives the export time | As above; the anchor itself is not quantized and is evaluated against the current timeline each time |
| `Element.end` omitted (to the end) | Export | `untilSequenceEnd: true` plus `span` | `span` takes the end of the sequence at write time | As above; audio with no end takes the sequence end and is counted as "estimated" |
| `srcStart`, `rate` | Source | `timeMap.linear {sourceIn, rate}` | As `Clip` | `sourceIn` not quantized |
| `audioFadeIn`, `audioFadeOut` | Element-local | `fadeIn`, `fadeOut` (`MediaTime`) | Seconds → exact rational | Not quantized |
| `volume` | — | `volume` (linear multiplier, [0, 4]) | No conversion | — |
| `keyframes.*[].t` (seconds or percent) | Element-local | `AnimationBinding.keyframes[].localFrame`; `volume` goes into `envelope[].at` | Percent converted to seconds using the length at that time | Visual properties quantized to the nearest frame; envelope `at` not quantized |
| `transitions.in/out.dur` | Element-local | `Transition.durationFrames` | Seconds × frame rate | Nearest frame, at least 1 frame |
| `duck.attack`, `release` | — | `DuckingRule.attack`, `release` | Seconds → exact rational | Not quantized |
| `animate.*.dur`, `delay`, `period` | Element-local | Undecided (section 7) | — | As preset parameters, not quantized (sampled at exact local times); quantized to frames when expanded into keyframes |
| `whiteboard.beats[].at`, `end` | Element-local or word anchor | Composition parameters | No conversion | Not quantized: the generator samples by local time |
| `CutProposal.t0`, `t1` | Source | `EditorialProposal` carries no times, only anchors `wordIds` | Cut points recomputed by the engine | When a suggestion is accepted, quantized by the instance rules above |

**Current state versus the rules**: VideoEngine's `insertItems` accepts a `span` already on the frame grid and an exact `MediaTime`; it neither quantizes nor returns a receipt. So legacy project import still converts and quantizes in TypeScript (`scripts/legacy-import/exact-time.ts`) by the rules above. The maximum snap error and truncated tails (`maxSnapMs`, `clampedTails`) are recorded in the `import-record` document. Export-clock times of word anchors are also computed by the import from the cuts (`ccut-project.ts`), not through `anchors::resolve_time_value`. Per §13.2, second parsing and frame quantization have Rust as the single source. Once the engine has write operations that accept seconds and return quantization receipts, import will use them, and `exact-time.ts` is kept only for dry runs.

## 5. Where the legacy data goes

Architecture §13.4 is settled: v2 element data enters the video format as formal fields. It is not stored as `cuccut.legacy-*` and is not put into `extensions`. Legacy project import (`scripts/legacy-import`) writes video format version 3 (`schemaVersion: 3`) by the rules below. Instances, keyframes, transitions, ducking rules, cut sets and template layers are all written through VideoEngine operations; validation applies as usual, and no video the engine does not accept is written.

**Elements** (`timeline.json` of `.ccut`):

| v2 | v3 | Rule |
| --- | --- | --- |
| `kind` | Instance type of the same name | `text` with `counter` is written as `counter`, not `text`; template stickers are written as `template`; asset stickers point at image, video or Lottie assets; `loop` and `fillOverrides` of `sticker` are kept as-is. The `srcStart` and `rate` of stickers have no counterpart (stickers take their source from the start at original speed); they count as "not written" unless they are 0 and 1. Unknown kinds are not imported |
| `place` | `place` | Known keys kept as-is; `opacity` clamped to [0, 1]; `flipX`, `flipY` written only when `true`; unknown keys dropped |
| `mode`, `fit`, `bg`, `mask`, `fx`, `tile`, `animate` | Fields of the same name | As-is |
| `style`, `stylePresetId`, `verticalAlign`, `source`, `html`, `ai` | Fields of the same name | As-is |
| `role` | `role` | v2 value kept (e.g. `broll`); audio with no role takes the track's `dub` or `music`; video elements on the main media default to `a-roll` |
| `hidden` | `enabled: false` | — |
| `start`, `end` (numbers) | `span`; audio is `fromFrame`, `subframeOffset`, `playDuration` | Section 4. When a cut set exists, instances outside its scope are written with `followPolicy: follow-cuts` (§7.1 item 12; the engine also reads a missing value as `follow-cuts`); instances with no end are written `sequence-fixed` (in v2 they do not follow cuts) |
| `start`, `end` (word anchor `~source:word[:start\|:end][±n]`) | `followPolicy: speech-anchor`, with `speechRef` pointing at the current version of the transcript document | Default edge is the word start; offset written as `offset`; `span` is the export time solved across cuts. Elements whose time cannot be solved (word missing, or lying inside a cut) are not imported, and the count is reported |
| `end` omitted | `untilSequenceEnd: true` | `span` runs to the sequence end at write time; audio with no end takes the sequence end and is counted as "estimated" |
| `keyframes` `x`, `y`, `scale`, `scaleY`, `rot`, `opacity`, `radius` | Sequence keyframe bindings | Seconds land on the frame within the instance; keyframes landing on the same frame keep only the first; percentages kept; `opacity` clamped to [0, 1], `radius` not below 0; easings not in the `motion` easing table become linear; at most 256 per property; these keyframes are dropped on audio |
| `keyframes.volume` | `mix.envelope`, `embeddedAudio.envelope` | Values clamped to [0, 4] |
| `volume`, `muted`, `audioFadeIn`, `audioFadeOut` | `volume` (linear multiplier), `muted`, `fadeIn`, `fadeOut` of `mix` and `embeddedAudio` | `volume` clamped to [0, 4]; fades clamped to [0, 5] s |
| `transitions.in`, `out` (video elements) | One-sided transitions: `in` at the start of the instance (`rightItemId`), `out` at the end (`leftItemId`) | Kinds `dissolve`, `wipe`, `slide`, `zoom`, `iris`; others dropped; length clamped to [0.1, 2] s; when an instance is shorter than twice the transition, the engine shortens the effective length, and `shortenedTransitions` in the receipt goes into the report item by item; transitions on other elements are dropped |
| `duck` | Sequence ducking rule | `under: 'speech'` triggers from the script; `under: <track>` triggers from that track after import; `depth` clamped to [0, 60] dB, `attack`, `release` clamped to [0, 5] s; instances with the same trigger and parameters are merged into one; dropped on non-audio elements |
| `srcStart`, `rate` | `timeMap` | Section 4 |
| `bcfClip` | Audio-picture link group of composition and voiceover, `linkGroupId` (spec §3.7 "sound") | In projects with a claim, the composition instance with its stand-in and the voiceover instance that claims its narration share the same `narration:<composition ID>`, and the composition's sound is turned off. Claimed sentence IDs are kept in `extensions["cuccut.import"].bcfClip` as source notes. If the composition was not imported (no stand-in), the voiceover is imported as ordinary audio and counted as "not applicable". v2's follow-the-claim behaviour is not ported: the composition's sound would be reduced by the claimed sentences (the stand-in is a mixed render and cannot lose single sentences, so the whole track is turned off); claimed voiceover is pinned to the position the code compiles to and cannot be dragged; deletion becomes mute; copy-paste drops the claim; after a code revision it is re-laid out from the compile result; regenerating from a seed and restoring voiceover versions are likewise not carried over. All of this needs the code to run in v3, and v3 compositions have only pre-rendered stand-ins |

**Containers**:

| v2 | v3 | Rule |
| --- | --- | --- |
| Project `title` | Video `name` | Trim leading and trailing whitespace; empty value takes the directory name; over 200 Unicode scalar values, keep the first 200 and count `clamped.video-name`; the full original title is kept in the report and in `name` of `import-record` |
| Main media and `clips` | `video` instances split by cuts (`audio` when there is only sound), `role: 'a-roll'` | Default position written as `mode: 'fullscreen'`, `fit: 'contain'`, `bg` taken from `main.background` (default `black`); moved positions written as `pip`, with the `main.background` color going into the canvas background; with `main.detached`, no main track is built |
| `main.background` (when no main-track instance carries it) | Canvas background (`updateSequence.background`) | Only `#RRGGBB` accepted; black is not written |
| `sources.*.cuts` | One cut-set document per source that has cuts and is registered as an asset (`cuccut.cut-set/1`, `clock: source-asset`) | Ticks are exact decimal seconds; `timescale` is the largest denominator (falls back to microseconds beyond 10⁹, counted as "clamped"); cuts beyond the asset are clamped into it; empty and overlapping ones dropped; `scopeItemIds` are the audio and video instances of this source; `ref` kept as-is |
| `tracks[]` | Tracks | Overlapping elements on one track are split onto adjacent tracks; `hidden`, `muted`, `locked` become the track's `visible: false`, `muted`, `locked`; lock is written last |
| `template` | Sequence template layer (`setTemplate`) | As-is; the logo layer's `src.file` has no asset reference, so the report warns |
| Transcript and subtitle lines | Transcript document, subtitle document and subtitle instances | Word members of a sentence prefer `sourceWordIds`; if missing or empty, recovered from the subtitle lines referenced by `cueIds`. When a referenced subtitle line is missing, its word list is empty, or the words no longer exist, the corresponding sentence or subtitle projection is not imported and is reported; the original transcript is still imported. Consecutive word members are written as `first` / `last`, others as `wordIds`. `breaks`, `autoBreaks`, `paraBreaks`, `stages` and the words' `glue` are written as formal fields per video format spec §5.2 (`nobreak` → `no-break`; only words whose paragraph value is `true` count as breaks), and no longer go into `legacy`; the subtitle style is still a `cuccut.legacy-studio-style/0.1` document |
| Code project (`entry`, `data.json`, `out/doc.json`) | `composition` instance, `source` is the code-package asset, `prerender` is the rendered output | The output is taken from the in-project file recorded by `media` (`provenance.origin: 'render'`); if none is recorded or the file is missing, take the single video file under the project root and `out/` that does not start with `.`; if there are several, take the one whose file name equals the composition ID (`meta.id` of `out/doc.json`), and if still ambiguous, treat it as absent. New-format code compositions need a pre-rendered stand-in: a composition without an output is not imported, its code package is not registered, and it is counted as "not written" (`没有预渲染替身的代码合成`, "code composition without a pre-rendered stand-in"), with the project and composition ID written in the warning. A project containing only such compositions still imports as a video (it may be empty) |
| Lottie source (`kind: 'lottie'`) | `lottie` asset | Registered like any other source; the engine identifies it as Lottie by content, and size and duration are read with the render kernel (spec §4.1); assets not used by any element are also registered |

**External video projects**:

| External project | v3 | Rule |
| --- | --- | --- |
| `hyperframes` instance (code composition) | — | Not imported. External projects do not record code-package render results, and their compositions have no pre-rendered stand-ins, so they are counted as "not written" (`没有预渲染替身的代码合成`) by the same rule as code projects, with the project, composition and code package written in the warning. No code-package version is registered (versions counted under "not imported"); only the composition's track is kept, no track is built. External projects have no field for voiceover claiming a composition, so all audio is imported as ordinary audio |
| `transform` (pixel box) | Positioning box of the subtitle style document | Pixels kept |
| `volume` (dB) and volume keyframes | `volume` (linear multiplier) and `envelope` | Clamped to [0, 4]; with an envelope, static volume is 1. Keyframe frame numbers are instance-local. An external project's easing is recorded at the start of a segment (the left keyframe governs up to the next), and the envelope records it at the end: point i takes the easing of frame i−1, and the easing of the last frame is dropped; easings not in the easing table (`ease-in`, `ease-out`, `ease-in-out`, `hold`, etc.) become linear and are reported only when they govern a segment |
| Track `visible`, `muted`, `locked` | Same-named track fields | `solo` and track volume have no counterpart, dropped |
| Subtitles (one instance per sentence, each with its own style) | One subtitle document (`clock: sequence`), one positioned-box style document (`cuccut.boxed-caption-style/<N>`, spec §5.6), one subtitle instance | The style of the first sentence is used; a single sentence's style differing from it is kept in that sentence's extension and counted as "no counterpart field" (`没有对应字段`). `animationPresetId` is not carried over: an external tool's preset name does not describe how per-word animation is drawn, and the output has no per-word effect; it is imported without animation and counted as "not written" (`外部项目的字幕动画预设（成片里没有逐词效果）`, "external-project subtitle animation preset; no per-word effect in output"), with one warning per preset. Differing presets do not count as a single sentence's own style |
| Position keyframes, transitions, markers | — | Dropped; counts reported |

**Import extensions**: `extensions["cuccut.import"]` holds only source notes: `sourceId` (the `scopeItemIds` of subtitle instances, the scope instances of cut sets, and transitions and ducking all use it to link back), `bcfClip`, `mediaId`, `itemCount`. No element data. Other extensions such as `cuccut.dub` and `pipeline` are unaffected.

**Out of range and not writable**: values beyond the version 3 range are clamped into range and counted under "clamped values in range" (`夹到范围里的值`) in the report; fields the new format does not accept are dropped and counted under "not written" (`没有写进去的`), with each item explained in the warnings. When the engine rejects an instance, optional fields are removed group by group and retried; removed groups are also counted as "not written"; the import fails only if it still cannot be written after removing everything. `verify.ts` checks the import result: version is 3, instance types are recognized, no styles or shapes in a `cuccut.legacy` wrapper, import extensions hold only source notes, the document a word anchor points to exists, and the cut-set body is valid.

**Not yet supported** (engine semantics are not changed; left for later batches):

- Second quantization and word-anchor evaluation still live in the import (section 4, "Current state versus the rules").
- Sticker `srcStart`, `rate`: v3 stickers take their source by how long since the instance started; there is no source start or speed.
- The template-layer logo's `src.file` has no asset reference counterpart.
- Only the main media is split into instances by cuts; elements on other sources with cuts are not split, and cuts are recorded only in the cut set.
- When the original main media is replaced by a derived file such as a reconstructed image, and the original asset is no longer used on the timeline, the script still belongs to the original asset. Without a reliable source-clock mapping, only the subtitle document is kept and is not attached to the derived asset automatically. The format for source mapping is among the open review items in video format spec §9.
- The `cuccut.legacy-studio-style/0.1` and `cuccut.translation/1` documents for subtitle styles are kept as-is: rendering, UI, runtime-core and jobs all read them, and they are outside the element model.
- Position keyframes, transitions and markers from external projects in pixel units are not imported.

## 6. Affected modules and batches

Size is the number of relevant lines, not the total file length; the figures are rough counts as of 2026-10-04.

| Module | Files | Size | What changes |
| --- | --- | --- | --- |
| `crates/video-model` | `lib.rs`, `effect.rs`, `transition.rs`, `ducking.rs`, `marker.rs` | about 1100 lines | Types for instance content: text styles, shapes, generated elements, geometry, effects, transitions, keyframes, animation, follow policies |
| `crates/video-engine` | `ops.rs` (`InsertItems`, `SetStyle`, `SetText`, `SetCodeParameters`, `SetTransition`, `SetEffects`, ducking), `effects.rs`, `transitions.rs`, `ducking.rs`, `task_guard.rs` (property paths), `state.rs`, `store.rs` and `package.rs` (version gate) | Source about 1300 lines, tests about 1500 lines (`properties.rs`, `materials.rs`, `effects_chapters_ducking.rs`, `transitions.rs`, `task_protection.rs`) | Validation and writes; cut, follow and keyframe edits call `timeline`; `schemaVersion` upgrade |
| `crates/render-graph` | `lib.rs` (`LayerContent`, instance-to-layer mapping), `text_plan.rs`, `audio_plan.rs`, `ducking.rs` | Source about 450 lines, tests about 400 lines, fixture `tests/fixtures/video.json` | Layer content moves to formal fields; ducking curve |
| `crates/render-core` | `text.rs`, `shape.rs`, `shape_outlines.rs`, `support.rs`, `compositor.rs`, `effects.rs`, `transition.rs` | about 1000 lines | Removed; replaced by `crates/frame-render` wired to the ported `render-raster` (v2 `ccut-render`) (architecture §9.1) |
| `export-worker`, `engine-host`, `bindings/preview-wasm` | `preflight.rs`, `exports.rs` | Under 60 lines | Recompiled with upstream; `preview-wasm` gains frame rasterization with the render adapter layer |
| `packages/protocol` | `src/video.ts` (instance types, edit operations, `applyVideoEvent`) | about 350 lines | Kept in sync with the Rust types (§13.2 requires them to be generated from Rust) |
| `packages/ui` | Rendering: the Canvas drawing code under `render/` (`content-painter.ts`, `compositor.ts`, `generators.ts`, `lottie.ts`, `effects.ts`, `transitions.ts`, etc.) has been removed with the render adapter layer; preview and thumbnails now draw through `preview-wasm`. Kept: `elements.ts`, `text-style.ts`, `confetti.ts`, `progress.ts`, `visualizer.ts`, used only by the property panel and stage (text boxes are measured by the core; the UI-side approximate typesetting has been removed). Models: `property-values.ts`, `text-presets.ts`, `text-preset-data.ts`, `element-catalog.ts`, `item-draft.ts`, `new-items.ts`, `stage-pose.ts`, `stage-toolbar.ts`, `effects-panel.ts`, `transition-panel.ts`, `ducking-panel.ts`, `transcript-cut.ts`. Components: `inspector-*.tsx`, `stage-*.tsx`, `text-panel.tsx` | about 40 files, 4000 lines of logic plus 2041 lines of preset data; about 12 tests | Property panel, stage and presets move to formal fields. Stage boxes, engine value ranges and defaults, sound waves, progress bars and the confetti catalog call the same Rust code through WASM (architecture §13.2). Transcript cut and restore send `addCuts` and `restoreCut`, which the engine applies against the set of cut points. Text presets remain UI-side (architecture §14, “Open items in edit semantics”) |
| `packages/runtime-core` | `exports/project-export.ts`, `agent-tools/video-tools.ts`, `agent-tools/video-digest.ts` | about 150 lines; tests `portable.test.ts`, `video-export.test.ts` | Operation notes and digests for agent tools |
| `packages/jobs` | `pipelines/caption-layer.ts`, `pipelines/dub.ts` | about 40 lines, touches only `extensions` | Not affected; the `cuccut.dub`, `pipeline` and other extensions must be kept when `cuccut.import` is removed |
| `scripts/legacy-import` | `ccut-project.ts`, `external-project.ts`, `video-plan.ts`, `video-writer.ts`, `verify.ts` | about 250 lines | Section 5 (done) |
| `crates/editor-semantics` | — | 0 | No change; when wiring, it or VideoEngine calls `timeline` |

**Suggested batches**, aligned with the two architecture §13.6 tracks “Rendering and export” and “Edit semantics”:

1. **Format decision** (done): the questions in section 7 were settled per §7.1, and the formal fields were written into spec §1.4, §3.2, §3.4–§3.9, §3.15–§3.17, §4.1, §4.6 and §6.7. Documentation only.
2. **Element model into the video format** (done): `video-model`, `packages/protocol`, VideoEngine validation and writes, and the version gate. Validation calls the `schema` and `elements` of `timeline`. Existing old drawing code temporarily reads the new fields, so previews and exports do not regress after this batch. In this batch the version gate changes to accept only 3, and test fixtures are rewritten to version 3. Version 2 videos already imported on this machine must be re-imported after batch 3 and cannot be opened in the meantime. The `setEffects`, `setStyle` and transition-kind entries in the command and protocol specs change with this batch. Architecture §14, “Element model”, already places it before the element layer of the render core.
3. **Legacy project import rewrite** (done): write version 3 videos per section 5; videos already imported are re-imported with `--replace`. Fields that do not yet have a counterpart are listed at the end of section 5.
4. **Render adapter layer** (done; current state and open items in architecture §9.1): `render-graph` consumes the formal fields, `crates/frame-render` is wired to `render-raster`, export links it directly, and preview uses the same code through `preview-wasm`. The old drawing code in `render-core` and the UI has been removed.
5. **Edit semantics** (done; remaining items in architecture §14, “Open items in edit semantics”): manual cuts and cut restore (`addCuts`, `restoreCut`), `follow-cuts` and running to the end of the sequence, keyframes trimmed and converted on split and merged on `joinItems`, and script-based ducking are handled by VideoEngine calling `timeline`. Moves of `item-local` and `speech-anchor` are recomputed at the end of each transaction. Detection and acceptance of cut suggestions (`proposeCuts`, `acceptCutSuggestions`) read and write the cut-proposal document (spec §6.2).
6. **UI** (done; remaining items in architecture §14, “Open items in edit semantics”): calls the same Rust code through WASM (`bindings/editor-wasm`) in place of the hand-written copy; the property panel and stage use the formal fields; script-based cut, restore and cut-band range changes send `addCuts` and `restoreCut`.

Batches 4 and 5 do not depend on each other and can run in parallel.

## 7. Questions to be decided

1. **Ducking model.** v2 is written on the element being lowered, so it can “sit under speech” (matched by script words, not by analyzing audio). v3 is a sequence-level rule that can only trigger by track and instance; its curve is linear in dB, does not merge within 0.5 seconds, and `depth` cannot be 0. Which side to choose: add script triggers to the v3 rule and use v2's curve, or use v2's shape written on the element? The two export different audio.
2. **Transitions.** v2 has only one-sided transitions attached to video elements (in seconds; `iris`; `slide` with a fade-in; automatically shrunk to half the element's length). v3 has one-sided and two-sided transitions on the sequence (in frames; out-of-range values are rejected). Should v2's `in` and `out` become v3 one-sided transitions? How should `iris` and the two kinds of `slide` be handled?
3. **Keyframes.** Is the `propertyPath` whitelist the same as v2's 8 properties? v3 geometry has no `scale` or `scaleY`; where do these two properties go? Are percentage times (which follow trims) kept? Do easing names use the easing table of `motion` or v3's 4 kinds?
4. **Element animation.** Are the three `animate` slots stored as formal fields and sampled at render time by `motion`, or expanded into keyframes at write time (spec §9)? §13.4 requires keeping v2's element model, which leans toward the former.
5. **How geometry is stored.** v2 stores canvas-percentage values (changing the canvas re-lays out automatically; square-type elements measure the short edge, and height is derived from the aspect ratio); v3 stores pixel boxes. §13.4 says element parameters stay as in v2, and only the container changes: does `place` compute the parameters or the container?
6. **Corner radius units.** v2's `place.radius` is in pixels at a 540 short edge (`REFERENCE_SHORT_EDGE`), and there are separate `cornerRadii` for each corner. This can directly answer the open question on `cornerRadius` units in spec §9. Should it be adopted, and do the four separate corners go into the format?
7. **Background colour.** `bg: #RRGGBB` and the solid colour of `main.background`: add a colour to `Backdrop`, or use the canvas background? The difference between `bg` filling the canvas and `backdrop` only within the layout box (spec §9) is decided together with this.
8. **Effect stack.** v2's `fx` has fixed fields in a fixed order; v3 is a freely ordered array. How do v2's greyscale, exposure, sharpen, noise, vignette, 12 filter presets and 9 effect presets fit: as new v3 effect kinds, or by replacing everything with v2's `fx`? Which side sets the `blur` basis (pixels at a 540 short edge / standard deviation in canvas pixels)?
9. **Masks and tiles.** Where `mask` (ellipse with feathering) and `tile` go in the format; masks carry a backward-dependency constraint in the spec (end of §3.9).
10. **Generated elements.** `draw`, `placeholder`, `confetti`, `whiteboard`, and `counter`, `visualizer`, `progress`, `sticker`: should they be v3 built-in generators (spec §3.7, with a parameter contract and version), or each become an instance kind? The `cuccut.confetti` (UI) and `cuccut.animated-sticker` (import), which the spec does not list, must also be registered or renamed. Does Lottie become an `AssetKind`?
11. **Where cut points live.** v2's cut points are a persistent set on the source; the clock is derived from it, and they can be restored one by one. v3 turns cut points into instance splits, and restore is a new transaction. Should the cut-point set (including the `manual-range` from manual cuts) be stored in a separate document for restore and re-validation? Which item of `EditorialProposal` does the suggestion referenced by v2 `Cut.ref` correspond to?
12. **Follow defaults.** In v2, overlay elements placed by number follow cuts by default (converted via source time); v3 says “the 10th second” defaults to `sequence-fixed` (does not move), and only this one is implemented. Which policy should overlay elements use by default in spoken-word editing? What does v2's “clip picture” claim rule (`follow.rs` rule 1) correspond to in v3? In v3, the main-track instance itself is the picture.
13. **Word-anchor offsets and open endpoints.** `SemanticAnchor.word` has no offset; where does v2's `+offset` go? Do elements with no endpoint (to the end of the film) need a “to sequence end” follow in v3? Where does the relation for a dubbing clip's claimed sentence, such as `bcfClip`, go in the composition code?
14. **Template layer.** Is `template` (chapters, progress, logo, text layers, positioned by canvas percentage) an object on the sequence in v3, or a group of ordinary instances?
15. **Overlap within a track.** v2 allows elements on the same track to overlap; v3 does not. Is splitting into several tracks on import the settled rule, and does the editor split the same way when writing?

### 7.1 Decisions

The basis is architecture §13.4: element kinds and parameters follow v2, and only the container changes. Element's own parameters follow v2; containers (sequence, track, instance, document, time) follow v3. Numbers match the questions above.

1. Ducking takes v2's semantics and curve: it can trigger by script words, gain is linear, and merges happen within 0.5 seconds. The shape stays in the v3 sequence rule, with a “by script” trigger added; triggering by track and instance is kept.
2. v2's `in` and `out` become v3 one-sided transitions, with `iris` added and `slide` drawn as in v2; v3's two-sided transitions are kept. Time is in frames; out-of-range values are shrunk to half the element's length as in v2 and explained in the receipt.
3. The keyframe property whitelist is v2's 8; geometry adds `scale` and `scaleY`; percentage times are kept; easing names use the `motion` easing table.
4. The three `animate` slots are stored as formal fields, sampled at render time by `motion`, and not expanded into keyframes.
5. Geometry stores canvas percentages as in v2, and `place` computes the element's parameters.
6. Corner radii use v2's unit (pixels at a 540 short edge), and the independent per-corner values go into the format.
7. Background colour follows v2: the canvas background is a solid colour, and `bg` fills the canvas.
8. Effects follow v2's `fx` as a whole (fixed fields, fixed order, filter and effect presets), and the `blur` basis follows v2; the four effects that v3 already has are merged into it.
9. `mask` and `tile` go into the format as instance fields, and masks observe the backward-dependency constraint in spec §3.9.
10. Each generated element is an instance kind, one-to-one with v2's `ElementKind`; Lottie is a kind of asset.
11. The timeline remains v3 instances. The cut-point set is stored in a separate document for restoring one by one and re-validation; applying and restoring are both VideoEngine transactions.
12. In spoken-word editing, overlay elements placed by number follow cuts by default (v2's default); v3's `sequence-fixed` is kept as an option.
13. Word anchors gain an offset and a “to sequence end” endpoint. The `bcfClip` claim is recorded as a composition-and-dubbing audio-visual link group, with the composition's sound off (spec §3.7, “Sound”); the sentence ID is kept only as a source note.
14. The template layer is an object on the sequence.
15. Non-overlap within a track is a container rule and is kept; import and editor writes split into adjacent tracks.
