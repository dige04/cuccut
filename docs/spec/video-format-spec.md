# CucCut Video Format Specification

> The video is the authoritative editable object; neither the exported final cut nor the imported video files are it. This specification defines its data model: time, sequences and instances, assets and documents, speech and subtitles, talking-head editing, dubbing and versions, and the portable package.

Format identifier: `cuccut.video`, `schemaVersion: 3`.

This specification defines the **data and numeric rules**. For the commands that modify a video, see [Command and Protocol Specification](command-protocol-spec.md); for the code composition package, see [Code Bundle Specification](code-bundle-spec.md); for the mechanisms of storage, rendering and dependency invalidation, see [System Architecture Design](../architecture/architecture-design.md). This specification is a draft. The kinds and parameters of picture elements adopt the v2 element model (`crates/timeline`); the item-by-item comparison and rulings are in [Element Model Mapping](../design/timeline/element-model-mapping.md). For terms of use see [Documentation Conventions](../README.md#conventions-for-this-document), and for terminology see the [Glossary](../glossary.md).

## Contents

- [1. Scope and Conventions](#1-scope-and-conventions)
- [2. Time Model](#2-time-model)
- [3. Video](#3-video)
- [4. Assets and Documents](#4-assets-and-documents)
- [5. Speech, Subtitles and Translation Documents](#5-speech-captions-and-translation-documents)
- [6. Talking-Head Editing](#6-talking-head-editing)
- [7. Dubbing, Versions and Sound Events](#7-dubbing-versions-and-sound-events)
- [8. Portable Package](#8-portable-package)
- [9. Items to Be Completed](#9-items-to-complete)

---

## 1. Scope and Conventions

### 1.1 Status of Types

The types in this document are written in TypeScript notation and serve as a summary of the DTOs used for exchange.

- Semantics and validation are defined once in Rust; the TypeScript DTOs and the JSON Schema are generated from it (Architecture Design §13.2).
- The DTOs do not prescribe the database's entity layout. Asset versions and document versions reference immutable content; a single video response does not need to carry tens of thousands of words or all the source code (§4.4).
- Types marked "added by this specification" have only a name or a usage in the original design; their fields are given by this specification and are listed in §9 for review.

### 1.2 Basic Types

```ts
type Id = string;
type Revision = string;                          // non-negative decimal integer string
interface VersionRef { id: Id; revision: Revision }
type JsonValue = null | boolean | number | string | JsonValue[] | { [k: string]: JsonValue };
```

`Revision` and event sequence numbers use decimal strings, so that 64-bit integers do not lose precision in JSON. Comparison is by numeric value, not by string.

The time types `Rate`, `MediaTime` and `FrameSpan` are described in §2.3.

### 1.3 Identity Rules

- All entities use stable IDs.
- An asset ID identifies the identity of a resource; an asset version identifies one definite set of bytes and metadata.
- An instance ID identifies one use on the timeline. The same asset appearing three times on the timeline is three instances, not three positions of one instance.
- Multiple uses of the same asset, multiple parameter instances of the same code bundle, nested sequences and language overrides must each have their own stable ID.
- ID and content fingerprint are different things: an unchanged ID does not mean the content is unchanged (§5.2).
- The video's `id` (`videoId`) lives in its `video.db`; no separate marker is placed elsewhere. The `video.db` metadata records two further items separately, and they are not part of the video's revision content: writing them does not produce a new version, does not enter the undo history, and does not appear in `VideoSnapshot`.
  - `projectId`: the project the video belongs to. If it is not recorded (videos from before the upgrade, and videos not belonging to a project), it is written by the first project that claims the video; `id` does not change.
  - `previousVideoIds`: the `id`s this video has used before, as a JSON array, oldest first. When the video is claimed by a project different from the recorded one (the project directory was copied, or the video was moved to another project), it is replaced with a new `id` and the old one is appended; content, revision number and history are unchanged. Changing the `id` is one database transaction: the video `id` in all tables, the id of the video's own entity, and every place that references it in receipts, events and undo records are changed together.
- A project is a directory. Its identity is in the project directory's `.ccut/project.json`, separate from the video (Architecture Design §5.1):

  ```ts
  interface ProjectMarker {
    format: 'cuccut.project';
    schemaVersion: 1;            // reject opening when higher than the known version; do not rewrite
    projectId: Id;
    createdAt: string;           // RFC 3339
  }
  ```

### 1.4 Unknown Fields and Extensions

- On encountering an unknown **required** field or capability: open read-only, or reject. Do not ignore it and write back.
- Optional vendor extensions are kept in their own namespace; when an unrecognized optional extension is read, write-back must not drop it.
- The capability matrix determines which instance types and effects can currently be edited. Types not yet implemented must not be silently treated as an ordinary image or as blank.
- The video's `schemaVersion` (§3.1) is the format version (`videoSchemaVersion` in Architecture Design §13.3), currently 3. Increase the version by one when a new object changes the rendering result so that an older program reading it would draw incorrectly (for example, drawing a transition as a hard cut); when only ignorable fields are added, do not increase it. Reject opening when the version is higher than the known version; do not rewrite.
- Version 3's picture elements adopt the v2 element model (§3.4–§3.9, §3.15–§3.17). Per Architecture Design §13.4, it does not keep compatibility for version 1–2 videos: reading accepts only 3; version 1–2 videos are refused on open with a note that the version is no longer supported, and are not rewritten; their content is re-imported from the original legacy project. This item is the compatibility check for this upgrade (Architecture Design §13.3).

---

## 2. Time Model

**In one sentence: user intent uses seconds or semantic anchors; the visual editing grid uses frames; precise arithmetic uses `MediaTime`; assets follow PTS; audio follows samples; export computes sample instants directly from output frames.**

Each position has only one writable authoritative value. Other units are only input forms, display projections or receipts, and must not each modify it independently.

### 2.1 Rule Overview

| ID | Rule | Details |
| --- | --- | --- |
| TIME-01 | Seconds are a unit, not floating-point storage. `MediaTime` uses integer ratios; the time domain is bound separately | §2.3, §2.4 |
| TIME-02 | Commands accept decimal second strings or explicit video frames; word and sentence editing prefers stable semantic anchors | §2.8 |
| TIME-03 | A request is quantized only once; the rounding policy is explicit; receipts report the requested value, the actual value and the deviation; writing seconds and frames at the same time is forbidden | §2.6, §2.9 |
| TIME-04 | Audio and raw speech time are not quantized to video frames early; visual projection and sample-level duration each have their own authority | §2.10 |
| TIME-05 | Edit frame rate, asset time base, code frame rate and output frame rate are managed separately; output frames directly derive exact video instants | §2.11 |
| TIME-06 | Changing `Sequence.fps` is a video transaction with an impact report; it is not an export setting change, nor a bare field edit | §2.12 |
| TIME-07 | Time types, quantization, mapping and sampling rules are implemented by shared Rust semantics; they are converted to host numeric values only at boundaries | §2.13 |
| TIME-08 | The time contract is versioned independently (`timeContractVersion`); changing rounding or sampling rules must bump the version and be accepted by TM01–TM20 | §2.13, Acceptance and Testing §6 |

### 2.2 Choosing Units by Layer

Not everything uses frames, and not everything uses floating-point seconds.

| Location | Representation | Authority and limits |
| --- | --- | --- |
| User and agent commands | decimal seconds, video frames, word / sentence / object anchors | Input may vary; after normalization there is only one set of video facts |
| Visual clips, visual keyframes, transitions | integer frames, bound to `Sequence.fps`; keyframes may also be written as a percentage of the instance length (§3.15) | Video frames must not be treated as source frames or code frames |
| Source video samples | source PTS + timebase | For variable frame rate, the actual presentation position is not inferred from the average frame rate |
| Transcription, word anchors, raw subtitle timing | precise source time + `timingQuality` | Not rounded early to video frames; low-precision evidence must not pass as accurate |
| Audio cuts, mixing, fades | sample position and exact duration | Not limited by the video's shortest frame |
| Code composition and nested composition | precise local time | The Adapter converts to seconds, frames or simulation steps based on verified capabilities |
| Final export | output frame index + `ExportSettings.fps` | Does not change `Sequence.fps`, nor the speed of the source content |

A bare `frame: 300` has no complete meaning: at 30 fps it is 10 seconds, and at 60 fps it is 5 seconds. Both the time domain and the frame rate must be known. The same goes for seconds: the 10th second of the source, the 10th second after editing and the 10th second inside an animation cannot be compared directly.

### 2.3 Basic Types and the Single Authority

```ts
interface Rate { num: number; den: number }               // positive rational, reduced
interface MediaTime { ticks: string; timescale: number }  // ticks / timescale seconds
interface FrameSpan { fromFrame: number; durationFrames: number }
```

**`MediaTime`**. `ticks` is a signed decimal integer string; `timescale` is a safe integer greater than 0. The same value may have different time bases (1.5 seconds can be written as 1500/1000); comparison is by the rational value, not by the JSON string. When used for content keys, normalize to the reduced canonical value; the original media's PTS and timebase are stored as-is in the asset metadata for traceability.

**`Rate`**. `num` and `den` are safe integers greater than 0; both reads and writes validate the upper bound. Video frame rates use the exact `Rate`, for example 30000/1001. The UI may display "29.97", but only selecting an explicit frame-rate preset maps to 30000/1001; when the API receives the exact decimal 29.97, it must not silently treat it as a different rational. Export frame rates use the same type.

**Arithmetic**. Internally Rust uses overflow-checked integer and rational arithmetic; overflow returns an error and does not degrade to floating point. Before multiplying or dividing rationals with different denominators, reduce them and check the intermediate values.

**`FrameSpan`** only specifies the position and length of visual grid objects; it does not force audio, words and Cues to inherit integer frames.

- Frame numbers start at 0. `fromFrame` is non-negative and `durationFrames` is positive; both of them, and their sum, must be within the safe integer range.
- For a sequence of N frames, the displayable frame indices are [0, N) and the boundary indices are [0, N]. The N-th boundary is the end point, not another displayable frame.

**Single authority**. A visual position stores only `fromFrame`; its seconds value is derived from the owning `Sequence.fps`. A separate writable `startSeconds` is not stored. `MediaTime` is a value and does not carry its own origin: each field's coordinate system is specified by the owning entity or by an explicit `TimeDomain`. Position, Duration and Offset are distinguished by purpose in the schema and types; a duration must not be treated as an absolute instant.

### 2.4 Time Domains

```ts
type TimeDomain =
  | { kind: 'sequence'; sequenceId: Id }
  | { kind: 'source'; assetRef: VersionRef }
  | { kind: 'composition'; itemId: Id; bundleRef: VersionRef }
  | { kind: 'audio'; assetRef: VersionRef; sampleRate: number };

interface TimePoint { domain: TimeDomain; time: MediaTime }
```

- Sequence time is fixed by the context's video version and sequence version; source time is fixed by the asset version; composition time is additionally bound to the selected instance, code bundle and timeMap.
- Only points in the same time domain may be subtracted directly. Crossing domains requires an explicit mapping; you cannot compare or overwrite values merely because their `timescale` is the same.
- All intervals are uniformly **left-closed, right-open [start, end)**.
- Logical positions in a video are not negative. An asset's raw PTS may have a negative origin; on import, the raw origin and edit list are saved and a normalized display time is established, without discarding the original information.
- Relative movement amounts may be negative, but compute the target first and then validate the range. Internal handles and pre-roll instants do not permit saving a negative visual clip position.

### 2.5 Mapping and Non-Integer Frame Evaluation

Each instance stores only one `timeMap`; it does not simultaneously keep four possibly contradictory sets of in / out / speed / duration facts.

```ts
type TimeMap =
  | { kind: 'linear'; sourceIn: MediaTime; rate: Rate }
  | { kind: 'hold'; sourceAt: MediaTime };
```

For any exact video instant t (not required to fall on an integer frame):

```text
itemStart  = item.fromFrame × sequence.fps.den / sequence.fps.num
localTime  = t − itemStart
sourceTime = sourceIn + localTime × rate.num / rate.den
```

This is a rational-number relation, not a requirement to compute step by step with JS numbers. Evaluating a visual frame on the grid is just a special case: t = sequenceFrame × fps.den / fps.num. Keyframes interpolate between exact local instants (§3.15).

- `sourceOut` is derived from the mapping and the playback duration; it is not a separately editable piece of data.
- The first version's `linear` supports only positive rates; `hold` does not repeat audio by default.
- Reverse playback and speed curves are rejected uniformly until they are implemented; an unknown mapping must not be treated as 1x speed.
- Nested sequences pass exact time through each layer and do not snap to the frame grid once at each layer's entry. Only a source or Adapter boundary that is actually frame-driven takes discrete samples, according to its declared sampling policy.

**Example**. A 30 fps video with a visual clip `fromFrame=90`, `durationFrames=60`, `sourceIn`=2 seconds, `rate`=3/2. The video playback interval is [3, 5) seconds, and the source interval is [2, 5) seconds. The video instant 4 seconds (frame 120) maps to source 3.5 seconds. When export samples at 4 + 1/60 seconds, that is also computed directly, without first rounding back to frame 120.

### 2.6 Quantization, intervals and variable-frame-rate sampling

**Edit quantization** determines how the seconds a user requests land on the visual edit grid. **Media sampling** determines which real source image is used at a given exact source moment. The two differ: after choosing the nearest source sample, you must not quietly modify a committed cut point.

```ts
type FrameAlignment = 'exact-frame' | 'nearest-frame' | 'floor-frame' | 'ceil-frame';
```

| Policy | Rule | Use for |
| --- | --- | --- |
| `exact-frame` | Must land exactly on the target grid, otherwise reject | Exact positions or strict scripts |
| `nearest-frame` | Take the nearest boundary; on an exact tie, take the **earlier** boundary | Default for ordinary visual moves |
| `floor-frame` | Take the boundary no later than the requested one | Explicit request for forward alignment |
| `ceil-frame` | Take the boundary no earlier than the requested one | Explicit request for backward alignment |

Rules:

- The alignment policy is set by the command. There is no global default of “round to nearest”.
- For speech cuts, first generate safe candidates from trusted word anchors and acoustic boundaries, then quantize, and verify that no adjacent word is swallowed.
- Range operations declare their boundary policy explicitly. A shared splice boundary is quantized only once. Do not round each segment's length separately and then add them up, and do not silently widen the deletion range.
- If quantization yields zero length or goes out of range, reject. Do not automatically add a frame.
- Relative moves: first add the exact offset to the current authoritative position to get the absolute target, then quantize. Do not round each increment and accumulate.
- One transaction produces the final `FrameSpan` and a quantization receipt. Downstream code must not convert a display seconds value back into frames.

**Variable frame rate.** Material is indexed by PTS, and frames are fetched by the real presentation interval [pts_i, pts_next). The end of the last sample comes from an explicit sample duration or the end of the material; do not assume a next PTS always exists. Gaps, overlaps or discontinuities are handled explicitly by the import and sampling contract. Do not substitute DTS, the average frame rate or the nearest keyframe for the correct presentation sample. Exact non-keyframe edits require decoding and re-encoding, or an explicit rejection of the fast path. Never silently move a video cut point.

### 2.7 Splitting, trimming and motion phase

- A visual split point satisfies 0 < `splitLocalFrame` < `durationFrames`. The right segment's `sourceIn` is evaluated from the old timeMap at the exact split moment, not rebuilt from a formatted seconds string.
- Audio splits follow the audio's sample and time contract, not the video's integer-frame limit.
- A trim must be explicitly one of trim, slip, ripple or rateStretch.
- Moves preserve local animation. Left trims and splits preserve the original phase and the real sub-curve; do not restart the same easing.
- rateStretch must explicitly choose whether to scale keyframes, audio, subtitles and semantic anchors, and must return the dependency impact. “Extending the shell” is not the same as “slowing down the content”.

### 2.8 Time input: seconds first, frames optional, anchors preferred

```ts
type TimelineTimeInput =
  | { unit: 'seconds'; value: string }
  | { unit: 'frames'; value: number };

interface MoveItemInput {
  itemId: Id;
  sequenceId: Id;
  at: TimelineTimeInput;
  alignment: FrameAlignment;
}
```

- `frames` only means video frames of the sequence the command belongs to. Raw source frames or code frames are not accepted. Other time domains use their own schema and `VersionRef`.
- `seconds` is a decimal string, parsed exactly. NaN, Infinity and scientific notation are not accepted, and a JS number may not pass as exact input directly. The UI may use floats for interaction, but on submit it calls the shared formatting and parsing contract.
- The absolute position `at` is non-negative. Relative offsets use a separate field and may be negative.
- Displayed decimal places do not change the saved precision.
- “Two seconds later” does not require the agent to compute a frame number. “Follow this sentence” should send a sentence, word or occurrence anchor first, and let the engine resolve the current video relationship. Dividing time evenly across words by count is forbidden, because it produces false precision.

```json
{
  "type": "moveItem",
  "itemId": "scene-2",
  "sequenceId": "main",
  "at": { "unit": "seconds", "value": "12.5" },
  "alignment": "nearest-frame"
}
```

In the 30 fps `main` sequence, the example above normalizes to `fromFrame=375`. Passing `frames=375` directly gives the same result. The command does not write `startSeconds=12.5` and `startFrame=375` at the same time.

### 2.9 Quantization receipt

```ts
interface TimeQuantizationReceipt {
  domain: { kind: 'sequence'; sequenceId: Id };
  sequenceRevision: Revision;
  editFps: Rate;
  requested: TimelineTimeInput;
  requestedTime: MediaTime;
  actualFrame: number;
  actualTime: MediaTime;
  delta: MediaTime;             // actual − requested; may be negative
  policy: FrameAlignment;
}
```

**Example**. In 30000/1001 fps video, requesting 10.000 seconds with `nearest-frame` gives frame 300. The actual time is 1001/100 seconds, i.e. 10.010 seconds, and the deviation is +1/100 second, i.e. +10 ms. This is quantization to the frame grid, not an error from numerical computation. Using `exact-frame` for the same request returns `TIME_NOT_ON_FRAME_GRID`, with the nearest legal boundary given, and does not commit automatically.

- Retrying the same intent with the same `commandId` returns the original receipt. The same key with a different payload is rejected.
- The UI may show both the requested value and the actual landing point. Later reads must use `actualFrame` or the authoritative time, and must not infer back from formatted text.

### 2.10 Audio, transcription and subtitles keep sub-frame precision

At 48 kHz, a 10 ms fade is 480 samples. One frame at 30 fps is 1600 samples. The minimum audio duration, sample points and fades are not constrained by the video's minimum one-frame limit.

**Audio instances**

- An exact start position is represented as `fromFrame` + `subframeOffset`. The former is the coarse-grid position on the owning sequence; the latter is a `MediaTime` in the range [0, one frame's duration).
- Playback length is represented by an explicit `playDuration: MediaTime`. The integer `durationFrames` is not the authority for sample-level length.
- The frame width of an audio clip in the UI is only a derived projection.
- Pure audio clips do not need an artificial frame pad. Pure audio export follows the explicit exact audio range and does not inherit the visual tail padding of the sequence. The routing and visual boundaries of audio embedded in video are governed by the linkage contract.
- `actualSamples` / `sampleRate` represent the real source length of generated audio. `playDuration` represents the playback length of this instance in the video after trimming and speed change. The two are linked through the timeMap; they are not two independently editable copies of data.
- When changing the edit frame rate, keep the exact audio start and length, then rebuild the “coarse frames + remainder” representation.

**Speech and subtitles**

- `SpeechWord.sourceSpan`, alignment results and source subtitle timing use exact source time and `timingQuality`.
- Subtitle visibility is evaluated at the output moment against the exact projected interval. Dragging a subtitle on the UI's frame grid may produce an explicit override, but it does not write back to the original word times.
- Target-language subtitles that depend on new dubbing use the actual target samples and alignment results.
- Changing the output frame rate does not re-recognize, re-translate or re-buy speech synthesis.
- Time input is numerically exact, which does not mean the evidence is accurate. The quality markers `estimated` / `provider` / `aligned` / `missing` are always kept.
- The conversion between decimal float seconds and integer tick scales (microseconds from legacy project import, and `TranscriptDoc` for subtitles and the translation core, §5.2) uses a single rule. Ticks → seconds: the nearest f64 of `ticks / timescale` (when both numbers are at most 2^53 − 1, this is the correct rounding of the true quotient). Seconds → ticks: take the shortest decimal representation of this f64 (the fewest digits that read back the same number), multiply exactly by `timescale`, take the nearest integer, and at exactly half round away from zero. Non-finite numbers and results beyond the safe integer range raise an error. This rule differs from the pts rounding in §2.13 (half to even) and from edit snapping, and applies only to these two boundaries. Hence when |ticks| < 2^51, ticks → seconds → ticks returns the original value. Seconds → ticks → seconds returns the original value when the decimal value multiplied by `timescale` is an integer; otherwise the deviation is at most half a tick, and the side that writes back reports the number of values that were rounded and the maximum deviation.

**External subtitle formats.** When exporting formats such as SRT and VTT, convert according to the precision that format allows and its fixed endpoint rules, and report any quantization or overlap repairs made. Do not modify the original times in the video. Boundaries shared by two adjacent cues are converted uniformly, to prevent gaps caused by separate rounding.

### 2.11 Edit frame rate and output frame rate are strictly separate

```ts
interface ExportSettings {
  fps: Rate;                                   // output sampling grid, not Sequence.fps
  frameCountPolicy: 'exact-grid' | 'cover-range';
  // resolution, codec, audio and other fields: see the export contract
}
```

The output frame rate defaults to inheriting the root sequence's `Sequence.fps`, but once it is saved into a frozen export snapshot it exists independently. In a 30 fps video, a 300-frame clip is 10 seconds. Exported at 60 fps, it yields 600 output frames; the video remains 30 fps / 300 frames, and the sound is not speed-changed.

```text
t0 = exact start of the export range
D  = exact duration of the export range
N  = D × outputFps, computed per frameCountPolicy
outputTime(n)   = n × outputFps.den / outputFps.num
sequenceTime(n) = t0 + outputTime(n),   0 ≤ n < N
contentTime(n)  = mapToContentTime(sequenceTime(n))
```

Output frames take the exact video moment directly, then map to each layer. Do not first floor or round to a video frame and then interpolate a continuous native animation. For 30 → 60 fps, continuously evaluable native curves should be evaluated at the half-video-frame point. Source video and frame-driven code instead repeat or select their discrete frames according to a verified policy. Merely raising the export frame rate does not create real source motion.

**Frame count policy**

| Policy | Rule |
| --- | --- |
| `exact-grid` | Requires D × outputFps to be an integer, otherwise returns `EXPORT_RANGE_NOT_ON_OUTPUT_GRID` |
| `cover-range` | N is rounded up. The start of the last output frame is still less than the logical end, but in a constant-frame-rate container the visual display tail may extend by less than one output frame |

When using `cover-range`, the preflight and delivery record must state `requestedDuration`, `frameCount`, `encodedVideoDuration` and `audioDuration`. The logical audio range is not sped up or trimmed to force the tail to align. If the output contract additionally requires equal length, it may only pad with silence-safe fill under explicit authorization, or reject; existing speech content is not altered.

**Example**. An exact 10 seconds exported at 30000/1001 fps: `cover-range` yields 300 frames, the picture displays for 10.010 seconds, and the audio can still be 10 seconds. `exact-grid` rejects. Extending the final frame's display does not request an out-of-bounds frame from the source, and it does not authorize changing the main video's duration.

Interactive scenarios default to the visible `cover-range`; strict machine tasks may specify `exact-grid`. The policy must never be switched silently.

### 2.12 Changing `Sequence.fps` is an explicit video transaction

Changing the output frame rate does not modify the video. Changing the edit frame rate must use `changeSequenceFrameRate`, carrying `expectedRevision`, the old and new `Rate`, the `preserve` policy, the alignment policy, the scope of impact, lock handling and the necessary confirmation. Directly calling `setProperty(fps)` and letting all frame numbers take on a different meaning is forbidden.

| `preserve` | Meaning | Must handle |
| --- | --- | --- |
| `time` (default) | Keep real time; resample frame coordinates to the new edit grid | Report the impact on quantization deviation, zero-length segments, transitions, keyframes, anchors and nesting |
| `frames` (explicit advanced operation) | Keep the visual frame count; real duration changes with the new grid | Must plan timeMap, audio and subtitles together; reject if the full retime is not implemented |

- P0 may implement only `preserve=time`. `preserve=frames` must be gated by a capability, and must not be degraded into a bare fps change.
- 30 → 60 fps, `preserve=time`: the visual `fromFrame` and `durationFrames` are multiplied by 2 when the ratio is an integer. The absolute sample times of audio do not change.
- Non-integer ratios such as 30 → 25: shared boundaries are uniformly quantized, which may affect the shortest segments and locked ranges. The transaction must first provide a difference report, and it rejects when hard constraints cannot be met.
- Native visual keyframes first compute exact times from the old grid, then convert to the new grid, preserving the semantics of the original curve. When quantization causes keyframes to merge or prevents the shape from being kept, it must be reported or rejected. No lossless guarantee is made for arbitrary frame-rate changes.
- Exact audio, speech evidence and source material frame rates are not rewritten.
- `CodeBundle.intrinsic.fps` is an immutable author contract and is not modified in place with the video settings.
- Nested sequences' fps is not changed recursively by default. The caller explicitly selects the set of target sequences.
- Old snapshots used during export continue to use all of their original `Rate` values.

### 2.13 Boundary Values, Host Conversion and Caching

Exact time is converted to floating-point seconds, microseconds or integer samples only at boundaries that require native numeric values: browser draw, media APIs and encoders.

When generating encoding timestamps from the output frame rate, use absolute indices:

```text
pts(n)      = round(n × outputFps.den / outputFps.num × 1_000_000)
duration(n) = pts(n+1) − pts(n)
```

- The tie rule for `round` here is **nearest-ties-to-even**, fixed in `timeContractVersion`. It and the edit-snapping `nearest-frame` (which takes the earlier boundary) are two different rules for two different interfaces, and they must not be mixed.
- The duration of each frame may differ by 1 microsecond. Do not accumulate rounded per-frame durations repeatedly.
- Audio sample boundaries are likewise derived from absolute rational instants; the actual sample quantization deviation is written into the result contract.

**Shared implementation.** The Rust and WASM exports share the same semantics for `parseDecimalSeconds`, `compareTime`, `mapTime`, `quantizeFrame`, `timestampAt` and `sampleAt`. JS does not hand-write a separate `Math.round` conversion. A JS number can only carry a range-checked host approximation; it is not used as an exact ID, hash or database de-duplication value.

**Cache.** Cache keys must distinguish the edit frame rate, the output frame rate, the time base of the code package and of the material, the sampling policy, the actual local sample points and the frame-count policy. Source samples whose parameters, dependencies and actual local instant are fully identical may be reused; encoded output at different output frame rates is not the same artifact. For equivalent times such as 1500/1000 and 3/2, the cache uses the canonical rational value; the source field of the original PTS is kept separately.

### 2.14 Hard Invariants

1. Visual `FrameSpan`, exact audio duration and speech source timing each have a single authority.
2. Unit conversion, edit quantization and source sampling are each separately traceable.
3. The export frame rate changes neither video time nor audio speed.
4. Objects that can be evaluated continuously are not snapped repeatedly in intermediate layers.
5. A variable frame rate does not fabricate an average frame number.
6. The frame rate of a code package is not the frame rate of the main timeline.
7. A receipt reflects the actual landing point, not just an echo of the request.

This specification does not include full speed-change curves, reverse playback, optical-flow frame interpolation, or retime that keeps an arbitrary number of frames. Whether they are opened is decided by capability gates and tests.

---

## 3. Video

### 3.1 VideoSnapshot

```ts
interface VideoSnapshot {
  format: 'cuccut.video';
  schemaVersion: 3;                   // §1.4
  timeContractVersion: number;
  id: Id;
  name: string;
  revision: Revision;
  rootSequenceId: Id;

  sequences: Record<Id, Sequence>;
  assets: Record<Id, AssetRecord>;            // files and directories: media, fonts, code packages (§4.1–§4.3)
  documents: Record<Id, DocumentRecord>;      // document headers for text-type content (§4.4); the body is not in the snapshot

  fonts: Record<Id, FontRecord>;
  localizationSets: Record<Id, LocalizationSet>;
  canvasVariants: Record<Id, CanvasVariant>;
  syncGroups: Record<Id, SyncGroup>;

  protections: Record<Id, ProtectionRecord>;
  checkpoints: Record<Id, Checkpoint>;
  links: DependencyLink[];
}
```

`VideoSnapshot` is the interchangeable snapshot of authoritative state. The working state is held by VideoStore; the snapshot is not a second write endpoint. The video `name`, after trimming leading and trailing whitespace, must be 1–200 Unicode scalar values (counted neither by UTF-8 bytes nor by UTF-16 code units); creating, renaming and portable-package import use the same limit.

A video's content has only two tables:

- **Assets** are bytes: one file or one directory. A code package does not get a table of its own; it is an asset with `kind: 'bundle'` (§4.3).
- **Documents** are structured texts: transcripts, translations, subtitles, subtitle styles, edit proposals, dubbing plans, sound-event tables and so on. They share one table and are distinguished by an open `kind` (§4.4, §4.6). Adding a new kind of document does not require upgrading the video format.

### 3.2 Sequence

```ts
interface Sequence {
  id: Id;
  revision: Revision;
  name: string;
  nameRef?: MessageRef;              // message reference while name is the engine's default name; gone after a rename
  fps: Rate;                         // edit grid. Output frame rate: see ExportSettings.fps
  canvas: {
    width: number;
    height: number;
    workingSpace: 'linear-rec709';
    background: string;              // canvas background colour, '#RRGGBB', default '#000000'
  };
  durationPolicy: { kind: 'derived' } | { kind: 'fixed'; frames: number };
  tracks: Track[];
  items: SequenceItem[];                // §3.4
  animationBindings: AnimationBinding[];
  transitions: Transition[];         // §3.9, sorted by ID
  markers: Marker[];                 // §3.13, sorted by frame, ties by ID
  ducking: DuckingRule[];            // ducking rules (§3.9), sorted by ID
  template?: TemplateLayers;         // template layers (§3.17); omitted when absent
}
```

- Name: when a new video is created, the root sequence's default name is set by the engine and stored as the English `name: 'Main sequence'` with `nameRef: { key: 'engine.mainSequence' }` (a message reference per the command and protocol specification §11.1). If `updateSequence` is given a `name`, that is a name the user chose, and `nameRef` is removed. For display, `localizeText(name, nameRef)` shows it in the reader's language; a user-chosen name is shown as is (`sequenceDisplayName` in `@cuccut/protocol`). Videos created before `nameRef` existed store `name: '主序列'` with no reference: the engine neither fills it in on read nor on write, and keeps the stored literal as is (undo compares against the stored original); display also treats this literal as the default name. Only ignorable fields are added; no format version is bumped (§1.4).
- `derived`: first compute the exact end points of all timeable objects, then project upward to an integer frame length for the sequence. Audio may have a sub-frame tail; its true length is not overridden backward by this visual boundary.
- `fixed`: allows blank space at the end; content beyond the end must be explicitly cropped, or the sequence must be extended.
- The tail-frame policy for constant-frame-rate output is in §2.11; the video duration must never be silently changed for encoding convenience.
- The canvas width and height must be positive integers. Encoder constraints on dimensions are handled in export validation.
- `canvas.background` is a solid, opaque colour that fills the canvas and is drawn beneath all tracks; wherever the picture does not cover the canvas, it shows through. On read, case is not significant; on write, it is always uppercase. An instance's own letterbox fill colour is `bg` (§3.5), not the canvas background.

### 3.3 Track

```ts
interface Track {
  id: Id;
  order: number;
  kind: 'visual' | 'audio' | 'subtitle';
  name?: string;
  locked: boolean;
  visible: boolean;
  muted: boolean;
  solo: { enabled: boolean; group: 'audio' | 'visual' };
}
```

- A larger `order` composites later (appears higher on screen). Visual and subtitle tracks are sorted together by `order` in the same stack; subtitles are not automatically on top, so a visual track moved above a subtitle track covers the subtitles. The `order` of audio tracks only orders audio tracks among themselves. The stacking order of pictures is the up/down position of their tracks: when the user on the canvas chooses “前移一层 / 后移一层 / 移到最前 / 移到最后” (bring forward one layer / send back one layer / bring to front / send to back), what changes is the track the instance is on (command protocol specification §4.2 `arrangeItem`: an instance sharing its track is split onto newly created adjacent tracks; an instance with a track to itself moves that whole track). Dragging a track on the timeline changes its `order` (`moveTrack`). `order` is unique within a sequence and may have gaps; deleting a track does not renumber.
- Items on the same track must not overlap in time (§3.4). `paintOrder` is set by the engine at write time to the track's maximum plus one, and is used only to give a deterministic order to items whose boundaries exactly touch or that overlap because of old data. Do not change it directly, and never rely on database return order.
- Locking blocks modification; it is not the same as hiding.
- Muting is not the same as deleting the source audio.
- Solo must declare whether it acts on the audio group or the visual group.

### 3.4 Item

An item is one use of an asset or document on a sequence. Picture elements use the v2 element model: the kinds correspond one-to-one to `ElementKind` in `crates/timeline`, and the field names, values and ranges of their parameters follow it. An item's identity, its track and its time belong to the v3 container (§2, §3.2, §3.3).

```ts
type ItemType =
  | 'text' | 'image' | 'video' | 'audio' | 'shape' | 'sticker'
  | 'visualizer' | 'progress' | 'draw' | 'placeholder' | 'confetti' | 'whiteboard'   // v2 element kinds
  | 'composition' | 'caption';                                                       // code composition, subtitles

// fields shared by all items
interface ItemBase {
  id: Id;
  type: ItemType;
  trackId: Id;
  name?: string;
  enabled: boolean;                    // a disabled item shows neither picture nor sound
  locked: boolean;
  paintOrder: number;
  followPolicy: FollowPolicy;          // §3.16
  lineage?: ItemLineage;               // source relationship after split or crop
  linkGroupId?: Id;                    // audio-picture link group
  role?: string;                       // the item's role in the video, see below
  ai?: JsonValue;                      // description of the generation source; not interpreted by the engine, kept as is
  untilSequenceEnd?: true;             // end follows the end of the sequence (§3.16); omitted when not in use
  extensions?: Record<string, JsonValue>;   // extensions under a namespace (§1.4)
}

interface ItemLineage {
  originItemId: Id;                    // the original item
  parentItemId?: Id;                   // direct source
  viaTransactionId: Id;
}

// picture items: position and length on the frame grid
interface VisualItemBase extends ItemBase {
  span: FrameSpan;
  place: Place;                        // geometry (§3.5)
  animate?: Animation;                 // three slots of element animation (§3.15)
}

// common fields of visual media: video, image, placeholder frame, whiteboard, media sticker
interface MediaFields {
  mode?: 'fullscreen' | 'pip';         // §3.5, default 'pip'
  fit?: 'cover' | 'contain';           // §3.5, default 'cover'
  bg?: Background;                     // §3.5, default 'black'
  mask?: Mask;                         // §3.9
  fx?: Fx;                             // §3.9
}

interface VideoItem extends VisualItemBase, MediaFields {
  type: 'video';
  assetRef: VersionRef;
  timeMap: TimeMap;
  crop?: Crop;                         // §3.5
  embeddedAudio: EmbeddedAudio;        // routing of embedded audio (§3.9)
}

interface ImageItem extends VisualItemBase, MediaFields {
  type: 'image';
  assetRef: VersionRef;
  crop?: Crop;
  tile?: Tile;                         // §3.5
  source?: 'file' | 'html';            // editing source of the image; rendering uses only assetRef
  html?: string;                       // original fragment kept when source is 'html'
}

// audio items: sample-level position and length (§2.10)
interface AudioItem extends ItemBase {
  type: 'audio';
  assetRef: VersionRef;
  fromFrame: number;
  subframeOffset: MediaTime;           // [0, one frame duration)
  playDuration: MediaTime;
  timeMap: TimeMap;
  mix: AudioMix;                       // §3.9
}

type SequenceItem =
  | VideoItem | ImageItem | AudioItem
  | TextItem | ShapeItem                                     // §3.6
  | StickerItem | VisualizerItem | ProgressItem | DrawItem
  | PlaceholderItem | ConfettiItem | WhiteboardItem          // §3.7
  | CompositionItem                                          // §3.7
  | CaptionItem;                                             // §3.8
```

| Type | Track | Content | Editing semantics |
| --- | --- | --- | --- |
| `video` | visual | Asset version, timeMap, geometry, routing of embedded audio | Crop, move, split, constant speed, audio–picture linking |
| `image` | visual | Asset version, geometry, display length | Move, scale, rotate, tile |
| `audio` | audio | Asset version, timeMap, `fromFrame` + `subframeOffset`, `playDuration`, mix | Sample-level crop and length, volume, fades, envelopes; the frame width of the bar is only a projection |
| `text` | visual | A piece of text or a timing readout, plus text style (§3.6) | Edit text, style |
| `shape` | visual | One entry from the shape catalogue, plus fill, stroke and endpoints (§3.6) | Basic shapes |
| `sticker`, `visualizer`, `progress`, `draw`, `placeholder`, `confetti`, `whiteboard` | visual | Sticker, sound wave, progress bar, freehand strokes, placeholder frame, confetti, whiteboard freehand (§3.7) | Parameter editing; a placeholder frame can be replaced with media |
| `composition` | visual | Picture drawn from a code package by local time, plus parameters (§3.7) | Item editing, parameter editing, source version swap |
| `caption` | subtitle | Display of a subtitle document over a span of sequence time (§3.8) | Content, language, line breaks, layered style editing |

- **Closed set of kinds.** A `type` that is not recognised is handled per §1.4; it must not be silently drawn as blank.
- **Scope of fields.** Fields that do not apply are rejected on write:
  - `place`, `animate`: all picture items. Audio items and caption items have neither. Audio items also cannot have `animate`.
  - `mode`, `fit`, `bg`: video, image, placeholder frame, whiteboard, and stickers whose `sticker.source` is `'asset'` (hereafter visual media). `mask` and `fx` apply to visual media and composition items.
  - `tile`: text and images.
  - `crop`: video and images.
  - `source`, `html`: images only; when `html` is present, `source` must be `'html'`.
- **`role`** states an item's function, for grouping in the interface and for agents to understand; it does not change rendering. The vocabulary is open, and unrecognised values are kept as they are. Five of its values are validated on write against the kinds they pair with: `broll` (image, video), `watermark` (text, image, video, sticker), `screentext` (text), `overlay` and `frame` (image, video, sticker). Other common values: `a-roll`, `narration`, `dub`, `music`, `sfx`; caption items use `source` and `translation`.
- **`extensions`** keys are namespaces (for example `cuccut.import`). The engine does not interpret their contents and preserves them as is on write-back. Parameters of picture elements always go in the formal fields, not here (architecture design §13.4); this is only for data describing provenance, such as the original ID at import.
- **Time.** The `span` of a picture item sits on the sequence's frame grid. Instants given in seconds (element time in v2, seconds in commands) are read as exact rationals in their shortest decimal form, snapped to the nearest frame, with ties going to the earlier frame (§2.6). The length is at least 1 frame, and a quantization receipt is given (§2.9). The position and length of audio items follow §2.10 and are not quantized. A start or end attached to a word is written as `followPolicy` `speech-anchor`; an item with no end is written as `untilSequenceEnd` (§3.16). The `span` of these two kinds of item is computed by the engine from the current timeline and likewise quantized to frames.
- Items on the same track must not overlap in time; items that need to be layered go on different tracks. When import or an editor write meets an overlap, the later item is placed on an adjacent track (a new track is created if there is no room), and its time is not changed.
- Nested sequences (`nested-sequence`) and adjustment layers (`adjustment`) are not in the current set of types; they will be added when there is a real need.

Field source: `Element`, `ElementKind`, `ElementRole` and `Element::validate` in `crates/timeline/src/schema.rs`.

### 3.5 Visual coordinates

An instance's geometry on the frame is stored as percentages of the frame. When the frame changes size, elements are re-laid out proportionally; they do not keep their pixel positions.

```ts
interface Place {
  x?: number;                          // Horizontal center of the box, percent of canvas width, 0 at left; default 50
  y?: number;                          // Vertical center of the box, percent of canvas height, 0 at top; default depends on kind, see below
  w?: number;                          // Box width, percent of the width basis; default depends on kind, see below
  scale?: number;                      // Overall scale multiplier, default 1
  scaleY?: number;                     // Extra vertical multiplier, default 1
  rot?: number;                        // Degrees, clockwise around the box center, default 0
  opacity?: number;                    // [0, 1], default 1
  radius?: number;                     // Uniform corner radius, pixels at a 540 short side, ≥ 0, default 0
  cornerRadii?: { topLeft: number; topRight: number; bottomRight: number; bottomLeft: number };   // Per-corner radii, same unit as radius, ≥ 0
  flipX?: boolean; flipY?: boolean;    // Content mirrored inside the box; omitted when false
}

type Background = 'blur' | 'black' | string;   // string is '#RRGGBB'

interface Tile {
  on: true;                            // When not tiled, the whole tile is omitted; do not write on: false
  angle?: number;                      // Rotation of the whole grid, degrees, clockwise positive; default -30
  gapX?: number;                       // Horizontal gap, percent of canvas width, default 8; below 2 is treated as 2
  gapY?: number;                       // Vertical gap, percent of canvas height, default 10; below 2 is treated as 2
  stagger?: boolean;                   // Alternate rows offset by half a cell, default true
}

interface Crop { left: number; top: number; right: number; bottom: number }   // Ratio trimmed from each of the four edges
```

- All numeric values must be finite numbers. `x` and `y` may fall outside the canvas.
- **Box width** is `width basis × w% × scale`. The width basis is generally the canvas width. Kinds in square variants measure the canvas short side instead: sound waves, progress bars, hand-drawn and placeholder boxes that have no explicit height.
- **Box height** is the kind's natural height multiplied by `scaleY`. Natural height: for a shape with `shape.h`, it is canvas height × `h`% × `scale`; without it, it equals box width. Template stickers `box` are box width × 0.62; other stickers equal box width. Sound waves, progress bars, hand-drawn strokes, placeholder boxes and confetti take the height given by their default placement (horizontal bars, full-frame or square). Visual media is derived from the material's display aspect ratio. Text is determined by its layout.
- **Default placement** (`x` is 50 for all): text, shapes and stickers have `w` 20 and `y` 50; video and image have `w` 34; horizontal sound wave bars have `w` 100, height 20% and `y` 85, square variants have `w` 30; horizontal progress bars have `w` 80 and height 5%, square variants have `w` 30, bordered variants 100 × 100; hand-drawn and confetti 100 × 100; placeholder boxes 42 × 24. A new instance is written with these values as its `place`, and “Restore default” (恢复默认) also uses them.
- **Visual media.** With `mode: 'fullscreen'`, the box is the whole canvas and `x`, `y` and `w` do not apply; with `'pip'`, the rules above apply. `fit` determines how the material fits the box: `cover` fills it and crops the excess, `contain` fits it entirely inside the box. `bg` only takes effect with `fullscreen` plus `contain`; it fills the whole canvas and is drawn beneath the material: `black` is black, `'#RRGGBB'` is that color, and `blur` is the same picture enlarged and blurred. On read, color case is not significant; on write, colors are always uppercase.
- **Corner radius.** `radius` and `cornerRadii` are in pixels at a canvas short side of 540; rendering multiplies them by `short side / 540`. When both are present, `cornerRadii` takes precedence. Corner radius clips only visual media, and only applies with `pip` or when tiled. A shape's own corner radius is `shape.cornerRadius` (§3.6); that is a separate thing from the clipping here.
- **Tiling.** The instance's picture repeats across a grid that fills the canvas. The grid is centered on the canvas center; after the points are placed, the whole grid is rotated by `angle`. The horizontal step is one cell's width plus `gapX`% of canvas width, and the vertical step works the same way. Point positions are given by `timeline::geometry::tile_stamp_points`, which preview and export share.
- The vertical anchor of text is `TextItem.verticalAlign` (§3.6), not part of `place`.
- **Crop** (`crop`) trims a ratio from each edge of the source's displayed picture (already upright per its rotation metadata). Each side is in [0, 1), and the left+right sum and the top+bottom sum are each less than 1. All four sides at 0 equals no crop and is not stored. Cropping happens before `fit`: the remaining area is treated as the source picture, and its aspect ratio takes part in the box height and in `fit`.
- Selection, hit-testing and background-exposure checks read the static `place`; keyframes and element animation are layered on top of it (§3.15).

Field sources: `schema.rs`'s `Place`, `CornerRadii`, `VisualMode`, `Fit`, `Background` and `Tile`; `geometry.rs`'s `default_place`, `width_basis`, `static_box`, `media_box` and `tile_stamp_points`.

### 3.6 Text and shapes

```ts
interface TextItem extends VisualItemBase {
  type: 'text';
  text?: string;                       // Choose one of text or counter; one must be present
  counter?: CounterProps;              // Timed readout (§3.7)
  style?: TextStyle;                   // Text style, see below
  stylePresetId?: string;              // Style library entry or text preset the style is taken from
  verticalAlign?: 'top' | 'center' | 'bottom';   // Which point of the text block place.y pins, default 'center'
  tile?: Tile;                         // §3.5
}

type TextStyle = Record<string, JsonValue>;

interface ShapeItem extends VisualItemBase {
  type: 'shape';
  shape: ShapeProps;
}

interface ShapeProps {
  shape: string;                       // One entry in the shape catalog, non-empty
  fill?: string;                       // '#RRGGBB' or '#RRGGBBAA'
  stroke?: string;                     // Same as fill
  strokeWidth?: number;                // ≥ 0, pixels at a 540 short side, default 2
  cornerRadius?: [number, number, number, number];   // Top-left, top-right, bottom-right, bottom-left; ≥ 0, same unit as strokeWidth, default all 0
  h?: number;                          // Natural height of the box, percent of canvas height; when omitted the box is square
  x1?: number; y1?: number; x2?: number; y2?: number;   // Endpoints of lines and arrows, percent within the box; default (0, 50) → (100, 50)
  head?: 'arrow' | 'none';             // Arrowhead
}
```

- **Text style.** `style` is the v2 text style object, without the `schema` wrapper. Its keys and values are defined by the rendering core's text style type, which will be written into this section (§9) when the rendering core is ported. Keys used by text preset data are `fontFamily`, `fontSize`, `fontWeight`, `fontStyle`, `italic`, `underline`, `fontColor`, `lineHeight`, `letterSpacing`, `textAlign`, `textTransform`, `backgroundColor`, `backgroundPadding`, `backgroundStyle`, `borderRadius`, `textOutline`, `dropShadow`. Until then the engine stores the object as-is without interpreting it. Keys the renderer does not recognize must be reported, not silently skipped.
- Text outline, shadow and background color live in `style`; `fx` and `mask` are not used for text.
- `stylePresetId` only records where the style came from; rendering reads only `style`. If the entry it points to does not exist, rendering is not affected.
- Fonts used by text are referenced per §3.14: `style.fontFamily` is resolved by family name against the video's font records; if it cannot be resolved, it is treated as a missing font.
- `text` and `counter` are mutually exclusive, and one of them must be present. Timed readouts are in §3.7.
- **Shapes.** `shape` is an id from the shape catalog of the preset registry (the first batch is `rect`, `ellipse`, `line` and `arrow`; the rest are outlines in the catalog). Writing only requires a non-empty value. If the name is not in the catalog, rendering reports `preset-unknown`, and the instance cannot be drawn; it must not be drawn as blank. Parameters a given shape does not use (for example, fill on a line) are not read. Endpoints and `head` are meaningful only for `line` and `arrow`.
- `strokeWidth` and `cornerRadius` are multiplied by `short side / 540` when rendered, then clamped to within half the box's side length. `shape.cornerRadius` is the shape's own outline and is not merged with the corner clipping of `place` (§3.5).
- The legacy forms `cuccut.legacy-text-style/0` and `cuccut.legacy-shape/0` have been withdrawn. Text and shapes imported from v2 write the fields of this section directly.

Field sources: `schema.rs`'s `Element` (`text`, `style`, `stylePresetId`, `verticalAlign`), `ShapeProps` and `SHAPE_STROKE_WIDTH_DEFAULT`; for units, see v2 `ccut-timeline-render/src/draw.rs`.

### 3.7 Generated elements and code composition

The picture of a generated element is computed by the rendering core from the instance's local time. Parameter objects share the name of their kind, one to one: a parameter object for a different kind, or a missing one for its own kind, is rejected on write (`element-props-mismatch`).

```ts
interface CounterProps {               // TextItem.counter
  mode: 'countdown' | 'countup';
  format?: 's' | 'mm:ss' | 'hh:mm:ss';   // Default 's'
}

interface StickerItem extends VisualItemBase, MediaFields {   // MediaFields only applies to asset stickers
  type: 'sticker';
  assetRef?: VersionRef;               // Required for asset stickers: an image, video or Lottie asset (§4.1)
  sticker: StickerProps;
}
interface StickerProps {
  source: 'template' | 'asset';
  templateId?: string;                 // Template sticker: one entry in the sticker catalog
  path?: string;                       // v2 field, kept as-is; not read by rendering
  loop?: 'loop' | 'once' | 'hold';     // Frame-sampling mode for dynamic assets, default 'loop'
  fillOverrides?: Record<string, string>;   // Original color → target color; keys and values are both colors
}

interface VisualizerItem extends VisualItemBase {
  type: 'visualizer';
  visualizer: VisualizerProps;
}
interface VisualizerProps {
  style: string;                       // One entry in the sound wave catalog
  mainColor?: string; secondaryColor?: string;   // Default taken from this entry's palette
  fftSize?: 256 | 512 | 1024 | 2048;   // Default 1024
  minDb?: number; maxDb?: number;      // dB, default taken from this entry; minDb < maxDb (an unwritten end is compared as -80 or 40)
  smoothing?: number;                  // [0, 1), default 0.8
  gain?: number;                       // ≥ 0, default 1
  audio?: string;                      // 'project' (default: the mixed sound of this sequence) or the ID of an audio or video asset
  speaker?: string;                    // Moves only while this speaker is talking; non-empty
  alwaysShow?: boolean;                // When there is no sound or the speaker is absent, still draw the still look; default true; when false, nothing is drawn after 0.5 seconds of silence
}

interface ProgressItem extends VisualItemBase {
  type: 'progress';
  progress: ProgressProps;
}
interface ProgressProps {
  style: string;                       // One entry in the progress bar catalog
  mainColor?: string; secondaryColor?: string;
  startProgress?: number;              // [0, 1], default 0
  endProgress?: number;                // [0, 1], default 1; may be less than startProgress (runs backward)
}

interface DrawItem extends VisualItemBase {
  type: 'draw';
  draw: DrawProps;
}
interface DrawProps {
  brush: 'round' | 'sliced';
  color: string;
  size: number;                        // Stroke width, pixels at a 540 short side, [1, 40]
  alpha?: number;                      // [0, 1]
  strokes?: Array<{ points: Array<[number, number]> }>;   // Each point is a percent within the box, each axis [0, 100]
}

interface PlaceholderItem extends VisualItemBase, MediaFields {
  type: 'placeholder';
  assetRef?: VersionRef;               // Swapped-in media; when absent, the placeholder appearance is drawn
  placeholder: { variant: 'camera' | 'media' | 'screen'; notes?: string };   // notes must not exceed 2048 bytes
}

interface ConfettiItem extends VisualItemBase {
  type: 'confetti';
  confetti: ConfettiProps;
}
interface ConfettiProps {
  style: string;                       // One recipe from the confetti catalog; omitted fields take the recipe's values
  seed?: number;                       // Non-negative integer, default 0; a random value is written on creation
  colors?: string[];                   // 1–8 colors
  shapes?: string[];                   // 1–12, taken from rect strip circle ellipse triangle diamond star starlet sparkle heart petal ribbon
  size?: number; speed?: number;       // Multipliers on the recipe, [0.25, 4]
  gravity?: number;                    // Multiplier, [-2, 4]
  drift?: number; spin?: number;       // Multipliers, [0, 3]
  wind?: number;                       // Horizontal acceleration, pixels per second² at a 540 short side, [-600, 600]
  opacity?: number;                    // [0, 1]
  emit?: {
    mode?: 'continuous' | 'burst';
    rate?: number;                     // continuous: particles per second, [1, 400]
    count?: number;                    // burst: particles per burst, [1, 500]
    interval?: number;                 // burst: interval in seconds, [0, 60]; 0 fires only once
    settle?: boolean;                  // Before the instance ends, leave time for particle lifetimes; no more emission
  };
  origin?: { x: number; y: number };   // Emit point, percent within the box, each axis [-20, 120]; when given, it replaces the recipe's emitter
  angle?: number;                      // Emit direction in degrees, [-180, 180]; 0 is right, -90 is up, 90 is down
  spread?: number;                     // Fan spread in degrees, [0, 360]
}

interface WhiteboardItem extends VisualItemBase, MediaFields {
  type: 'whiteboard';
  assetRef: VersionRef;                // An image asset
  whiteboard: WhiteboardProps;
}
interface WhiteboardProps {
  hand?: 'marker' | 'pen' | 'none';    // Default 'marker'
  paper?: string;                      // Paper color; default transparent, showing the picture below
  draw?: number;                       // Seconds to finish the full drawing, > 0; default min(0.8 × instance length, natural duration); beyond the instance length, it is capped to the instance length
  inkFirst?: boolean;                  // Ink lines before color blocks, default true
  pace?: 'stretch' | 'natural';        // Default 'stretch'
  strict?: boolean;                    // box is a hard mask, default false
  beats?: WhiteboardBeat[];            // Up to 64 beats
}
interface WhiteboardBeat {
  at: MediaTime | string;              // Beat start: instance local time, or a word anchor (§3.16)
  end?: MediaTime | string;            // Default is the next beat's at; the last beat uses draw
  box: [number, number, number, number];   // [x, y, width, height], percent of canvas; x and y in [-100, 200], width and height in (0, 300]
  label?: string;                      // At most 80 characters; display only, not used in rendering
}

type CompositionSource = { kind: 'bundle'; assetRef: VersionRef };   // One version of a code bundle asset (§4.3, code bundle spec)

interface CompositionItem extends VisualItemBase {
  type: 'composition';
  source: CompositionSource;
  parameterValues: JsonValue;          // Parameter values of the instance
  timeMap: TimeMap;                    // Instance time → composition local time
  prerender?: VersionRef;              // Pre-rendered stand-in: one video asset version
  audio?: EmbeddedAudio;               // Routing for the composition's own sound; omitted for compositions with no sound
  mask?: Mask;                         // §3.9
  fx?: Fx;                             // §3.9
}
```

- **Style references.** `shape`, `templateId`, `visualizer.style`, `progress.style` and `confetti.style` are all ids into the corresponding catalog of the preset registry. Presets are data; their contents live under `crates/motion/presets/builtin/`. This spec only defines the references. Writing only requires a non-empty value. At render time, if the catalog has no such entry, rendering reports `preset-unknown` and the instance cannot be drawn; it must be reported, not drawn as blank. Defaults given by a style (colors, aspect ratio, recipe parameters) apply only when the instance does not write that field.
- Colors are always `#RRGGBB` or `#RRGGBBAA`.
- **Timed readouts.** Readouts are evaluated on the millisecond grid, in seconds. A countdown is ⌈instance end − t⌉; a count-up is ⌊t − instance start⌋; both are displayed per `format`. Instances are half-open intervals, so at the end moment the instance is no longer visible. Timed text keeps the ordinary text `style`, `place` and `animate`, but cannot use `typewriter` or `riseWords`.
- **Stickers.** `source: 'template'` draws vectors from the sticker catalog; `'asset'` draws the image, video or Lottie asset that `assetRef` points to. `loop` applies only to video, Lottie and GIF assets: `loop` repeats, `once` plays once and holds on the last frame, and `hold` holds on the first frame. `fillOverrides` replaces the original colors in an SVG or Lottie with the target colors before drawing (Lottie gradients are not affected; bitmap and video assets are not recolored). A GIF is an image asset, played with its per-frame delays, and has no separate kind. A GIF inside an image instance loops over its own total duration.
- **Sound waves.** The picture is driven by the sound's spectrum. `audio` selects which sound track to use; sequence time is mapped to that track's source time for sampling. `speaker` moves only within that speaker's word spans.
  - `'project'` is the sequence's mixed sound. At each moment, every sound playing then (using the same sound plan as the export mix, with volume, fades, crossfades and ducking all included) contributes the spectrum at its source time; the spectra are added by power in the frequency domain. Ducking triggered by the script is not included; preview and export are the same.
  - A material ID listens only to that material: it takes the source time of the segment currently playing it (where two segments meet, the later one), without applying volume. If the material is not playing at this moment, it is silent.
  - When the sequence has no sound, it is drawn in its still look and not reported. When the listened material cannot yield sound, it is also drawn still, and this is reported.
  - `speaker`: the speaking spans come from the effective word stream that the video's transcript projects onto this sequence (the same one used for script-triggered ducking in §3.9), taking this speaker's words. Two words from the same speaker no more than 0.5 seconds apart count as continuous speech. Outside these spans it is drawn silent. When the video has no transcript, or the transcript has no speech from this speaker on this sequence, the whole element is drawn silent and this is reported.
  - `alwaysShow: false`: at a moment when it and the 0.5 seconds before it are silent (a `speaker` who is not talking also counts as silent), nothing is drawn; it is drawn as soon as sound starts. With no spectrum, nothing is drawn either. The default is to always draw.
- **Progress bar.** Progress p = clamp((t − instance start) / (instance end − instance start), 0, 1), and the displayed value is `startProgress + p × (endProgress − startProgress)`. It depends only on the playhead and does not read media.
- **Hand-drawn.** An instance holds at most 256 strokes and at most 16384 points in total.
- **Placeholder box.** Without `assetRef`, it draws the appearance for `variant`; with one, it is drawn as visual media in the same box. It can only be replaced by a video or image asset.
- **Confetti.** Particles are determined deterministically by `seed`. At any moment, only living particles are computed, independent of the instance's total length, so the instance can be stretched or shortened freely.
- **Whiteboard.** The reveal order is derived from the source image (ink lines before color blocks, in reading order). The drawing finishes at `draw` seconds, after which the full image stays still until the end. The derived reveal order is not stored. `beats` splits the picture into several beats revealed over time: strokes falling within `box` belong to that beat and are drawn from `at` to `end`. Numeric `at` values are non-decreasing; `end` is later than `at` and not later than the next beat's `at`; the last beat's `end` is not later than `draw`. A word anchor is resolved to a sequence time and then has the instance start subtracted. If an anchor cannot be resolved, that beat falls back to geometric order and this is reported. `pace: 'stretch'` has each beat fill its own window; `'natural'` draws at natural speed and then stops. With `strict`, `box` is a hard mask, and in overlapping pixels the later beat wins.
- **Seconds in generated elements** (`draw`, `interval`, beat times, and seconds in `wind`) are all instance-local time. They are read as exact rationals from their shortest decimal form, are not quantized, and rendering samples at the exact local moment (§2.5).
- **Code composition.** `bundle` points to a fixed code bundle version; the execution contract is in the code bundle spec. The original built-in generators (`cuccut.counter`, `cuccut.sticker`, `cuccut.lottie`, `cuccut.audio-visualizer`, `cuccut.progress`) have been replaced by the kinds above and are no longer sources of composition. A code bundle whose runtime is unavailable must not be drawn as blank and then treated as success. If there is a pre-rendered stand-in, use the stand-in; if not, report that the instance cannot be drawn.
- **Pre-rendered stand-in.** `prerender` is a video of this composition, rendered in advance. It shares `timeMap` with the composition: the composition's local time is the stand-in video's source time. When the composition's runtime is unavailable, or real-time rendering cannot keep up, preview and export substitute the stand-in; when the code can run, the code is authoritative. The stand-in is not a source. If parameters change or the bundle version changes, the stand-in is stale.
- **Sound.** The sound the composition emits (when a stand-in is used, the stand-in video's audio track) is routed by `audio`. When the timeline has a separate audio instance of the same sound (for example, the render already has the voiceover mixed in and the voiceover is also placed on an audio track), `audio.enabled` must be turned off; the same sound must not play in two places at once. When the composition and these audio instances are written into the same audio-video link group (`linkGroupId`, §3.4), the audio in the group is a separately placed copy of the composition's sound. The engine checks this on write: if the same sequence has audio instances in the group, the composition's `audio` in that group must be omitted or set to `enabled: false`. A stand-in is a finished mixed cut, and removing only a few lines from it is not possible, so it is turned off entirely.

Field sources: `schema.rs`'s `CounterProps`, `StickerProps`, `VisualizerProps`, `ProgressProps`, `DrawProps`, `PlaceholderProps`, `ConfettiProps`, `WhiteboardProps`, `WhiteboardBeat` and their `validate`; default placement is in `geometry.rs`.

### 3.8 Caption instances

```ts
interface CaptionItem extends ItemBase {
  type: 'caption';
  span: FrameSpan;
  documentId: Id;                      // document of kind caption (§4.6)
  styleDocumentId?: Id;                // document of kind caption-style
  scopeItemIds?: Id[];
}
```

- Caption instances exist only on caption tracks. They have no `place`: a caption's position and layout are set by its style document (§5.6).
- It references a document by **ID**, not by version: the caption follows the document's current version, so editing the text does not require changing the timeline.
- **Clock.** Times in a caption document are either on the source media's clock or already sequence time; the document declares which. `scopeItemIds` lists the instances that project the captions onto the sequence: a caption line whose source time falls within the source range taken by one of those instances is mapped to sequence time through that instance's `timeMap`; lines that fall outside all instances (cut away) are not shown. If `scopeItemIds` is omitted, the times in the document are already sequence time.
- `span` limits the displayed range: after projection, lines that fall outside `span` are not shown.
- One caption instance displays one document. Bilingual captions are two instances on two caption tracks, each enabled or disabled independently; source and translation lines need not correspond one-to-one (§5.1).
- **Words in a sentence.** A sentence in a caption document (`cuccut.caption/1`) can use `words` (`{ first, last }` or `{ wordIds }`) to point at words in the transcript (`kind: speech`) of the document that the header's `sourceDocumentId` names; these are written when the caption is generated. Word-by-word animation, word-by-word highlighting and the design emphasis of a caption (`captionEmphasis` in the style, keyed by word ID) advance by these words, taken from the effective word stream (§5.7). Hidden words and cut words are not drawn. If words in a sentence are removed as a result, the text is reassembled from the remaining words (following the “贴前” (attach-to-previous) mark on the word); a sentence with no words left is not drawn. Multi-character CJK words are split character by character using the rules the transcript follows when saved to disk, time is apportioned by character weight, and sub-IDs are `<word ID>~<k>` (the first character keeps the word ID). Emphasis written on a whole word lands on each character it splits into. Per-sentence styles (`cueStyles` in the style) are looked up by sentence ID in the caption document. For captions on the source clock, words use their own source times; for captions on the sequence clock, words use the sequence positions they project to, at the place that overlaps this sentence. A sentence without `words` takes the words whose times fall within the sentence; its text is unchanged. Translated captions, imported captions and captions not derived from a transcript have no words; word-by-word animation then infers splits from whitespace and does not pass off guessed times as word times (§5.6).

### 3.9 Mixing, transitions and effects

```ts
interface AudioMix {
  volume: number;                      // linear multiplier, [0, 4], default 1
  muted?: boolean;                     // omitted when false
  fadeIn?: MediaTime;                  // [0, 5] seconds
  fadeOut?: MediaTime;                 // [0, 5] seconds
  envelope?: EnvelopePoint[];          // volume keyframes; when present, replaces volume
}

interface EnvelopePoint {
  at?: MediaTime;                      // exact time local to the instance
  percent?: number;                    // percent of instance length, [0, 100]; mutually exclusive with at
  volume: number;                      // linear multiplier, [0, 4]
  ease?: EaseName;                     // easing of the segment entering this point (§3.15), default 'linear'
}

// Embedded audio of a video instance; a compound instance's own sound
interface EmbeddedAudio {
  enabled: boolean;
  volume: number;                      // same as AudioMix
  fadeIn?: MediaTime;
  fadeOut?: MediaTime;
  envelope?: EnvelopePoint[];
}

interface Transition {
  id: Id;
  leftItemId?: Id;                     // outgoing side: the picture leaves from it
  rightItemId?: Id;                    // incoming side: the picture enters it. At least one of the two
  kind: TransitionKind | string;       // unrecognized kinds are kept as-is
  params?: Record<string, JsonValue>;  // per kind; omitted when empty
  durationFrames: number;              // per side 0.1–2 seconds (v2's range), snapped to the nearest frame, at least 1 frame; both sides 1 frame to 10 seconds
  easing: Easing;
  placement: 'center' | 'start-at-cut' | 'end-at-cut';
  audioCrossfade?: boolean;            // both sides' own sound crossfaded at equal power; omitted when false
}

type TransitionKind = 'dissolve' | 'wipe' | 'slide' | 'zoom' | 'iris' | 'dip-to-color' | 'push';
type Easing = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';

interface Fx {
  filterPreset?: FilterPreset;         // default 'none'
  effectPreset?: EffectPreset;         // default 'none'
  effectIntensity?: number;            // [0, 1], default 1
  grayscale?: number;                  // [0, 1]
  brightness?: number;                 // [-1, 1]
  exposure?: number;                   // [-1, 1]
  contrast?: number;                   // [-1, 1]
  saturation?: number;                 // [-1, 1]
  hue?: number;                        // [-1, 1], times 180 degrees
  temperature?: number;                // [-1, 1]
  blur?: number;                       // [0, 100], pixels at 540 short edge
  sharpen?: number;                    // [0, 1]
  noise?: number;                      // [0, 1]
  vignette?: number;                   // [0, 1]
  shadow?: { offsetX: number; offsetY: number; blur: number; color: string; opacity: number };   // lengths are pixels at 540 short edge
  stroke?: { width: number; color: string };                                                     // same as above
}

type FilterPreset = 'none' | 'calm1' | 'calm2' | 'calm3' | 'clean1' | 'clean2' | 'clean3'
  | 'cottage1' | 'cottage2' | 'cottage3' | 'peckham1' | 'peckham2' | 'peckham3';
type EffectPreset = 'none' | 'invert' | 'night_vision' | 'thermal_vision' | 'old' | 'polaroid'
  | 'filmic' | 'snowy' | 'box_blur' | 'bokeh_blur';

interface Mask {
  shape: 'ellipse';                    // ellipse mask, inscribed in the frame
  feather?: number;                    // feather, pixels at 540 short edge, ≥ 0, default 0
}

interface DuckingRule {
  id: Id;
  name?: string;
  enabled: boolean;
  trigger: { kind: 'speech' } | ({ kind: 'items' } & DuckingGroup);   // when someone is speaking, or when these instances sound
  target: DuckingGroup;                // the ones being ducked
  depth: number;                       // dB to duck, [0, 60], default 10
  attack: MediaTime;                   // how long before triggering starts the ramp down, [0, 5] seconds, default 0.02
  release: MediaTime;                  // how long after triggering ends before recovery, [0, 5] seconds, default 0.35
}

interface DuckingGroup { trackIds?: Id[]; itemIds?: Id[] }   // all instances on the tracks, plus named instances
```

**Mixing**

- Volume is a linear multiplier: 1 is the original sound, 0 is silence. The UI and commands may display and accept dB; the conversion is `dB = 20·log10(volume)`, with 0 corresponding to −∞. What is stored is always the multiplier.
- The only gain stored on an instance is `volume`. The `gainDb` in §7.6 and §7.9 is an offset on the sound plan (the v3 container), not a field of the instance: when mixing it multiplies by `10^(gainDb / 20)` and is not written back to the instance.
- Fade-in, fade-out and envelope times are exact instance-local times, read as rationals from their shortest decimal form, not quantized to frames. A fade-in rises linearly from 0 to 1 over `fadeIn` from the instance start; a fade-out falls linearly to 0 over `fadeOut` before the end.
- **Envelope.** Point times are strictly increasing; one envelope uses only one time form (`at` or `percent`), with at most 256 points. Before the first point, its value is used; after the last point, the last point's value is used. Points whose `at` lies past the instance end have no effect. Between two adjacent points, interpolation on the linear multiplier follows the later point's `ease`; eased segments are baked into a polyline at 0.02 s steps (the same as the ducking ramps). Percent points stretch with the instance's trimming.
- The instance's gain = volume (the sampled `envelope` value, or `volume` when there is no envelope) × fade-in/fade-out × ducking (below). Export and preview use the same evaluation function.
- Audio micro-fades and visual dissolves are different things. Do not change the total video length just to eliminate clicks.

Field sources: `volume`, `audioFadeIn`, `audioFadeOut` and `AUDIO_FADE_RANGE` in `schema.rs`; `VOLUME_RANGE` and `volume_at` in `keyframes.rs`; `volume_curve` and `element_gain_envelopes` in `duck.rs`.

**Transitions**

- Two-sided transitions join two visual instances that are adjacent on the same track: the left one's end equals the right one's start, and this frame is the cut point `cut`. A transition with only `rightItemId` is the instance's in-transition; one with only `leftItemId` is its out-transition. An instance has at most one transition at its head and at most one at its tail: setting a new transition replaces the existing one on the same edge; the same pair keeps its original ID.
- Kinds: `dissolve`, `wipe`, `slide`, `zoom` and `iris` can be one-sided or two-sided; `dip-to-color` and `push` are two-sided only.
- **One-sided transitions** act on the instance's own frame. An in-transition window starts at the instance's start, and an out-transition window ends at the instance's end. They can only be `center` and cannot use `audioCrossfade`. `durationFrames` defaults to 0.5 s, snapped to the nearest frame. The effective length is min(D, ⌊L / 2⌋), where L is the instance's frame count: when an instance gets shorter, its transition shortens with it rather than being deleted, and shortened transitions are listed in the receipt's `impact.shortenedTransitions` (ID, written length, effective length). When ⌊L / 2⌋ is 0, that edge is drawn as a hard cut.
- The window of a two-sided transition is `[start, start + D)`, with `D = durationFrames`: for `center`, `start = cut − ⌊D/2⌋`; for `start-at-cut`, `start = cut`; for `end-at-cut`, `start = cut − D`. The window must not extend beyond the combined range of the two instances.
- Within the window, both sides are drawn: the left side keeps taking source through its own timeMap past the cut point (tail handles), and the right side does the same before the cut point (head handles). Only video instances with linear timeMaps and compounds with pre-rendered stand-ins are limited by source length: the head frames available are the source time mapped from the instance's start, divided by the rate; the tail frames are the source duration minus the source time mapped from the instance's end, divided by the rate; both are rounded down to whole frames. Images, text, graphics, generated elements, freezes, compounds without a pre-rendered stand-in, and instances whose source duration is unknown are not limited.
- **Insufficient handles are rejected** (`TRANSITION_HANDLES_INSUFFICIENT`, stating which instance and which edge is missing how many frames). The engine does not shorten the two-sided transition automatically, nor move any instance.
- After all operations in a transaction have run, the engine checks every transition, removes those that no longer hold, and gives the reason in the receipt's `impact.removedTransitions`: `item-deleted` (the instance is gone, or is no longer a visual instance), `not-adjacent` (the two sides are no longer on the same track or no longer touch), `too-long` (the transition's window extends beyond an instance), `handles-insufficient`, and `overlap` (two transitions on one instance have overlapping windows: sorted by window start and then by ID, the one that starts first is kept). Moving, trimming and deleting are all handled this way.
- When an instance is split, a transition for which it is the left side is reattached to the right half; one for which it is the right side stays on the left half.
- When an undo would leave an invalid transition, the undo is rejected (command and protocol spec §8.3).
- Progress: `p = (t − start) / (end − start)` is the linear progress, and `e` is the progress after `easing` is applied: `ease-in` gives p², `ease-out` gives 1 − (1 − p)², and `ease-in-out` gives p²(3 − 2p). The picture uses `e`; the sound uses `p`.
- **In-transition rendering**, applied to the entering instance B; the frame, rotation and mirroring are B's own:
  - `dissolve`: B's opacity × e.
  - `wipe`: only the part of B's frame that is revealed from the left as e grows is shown (in the frame's own coordinates, following rotation and mirroring).
  - `slide`: B moves in from the left along its own frame's horizontal axis, with displacement (e − 1) × frame width, and opacity × e.
  - `zoom`: B scales about the frame's centre by 0.75 + 0.25 × e, and opacity × e.
  - `iris`: only the part inside a circle centred on the frame's centre, with radius e × half the frame's diagonal, is shown.
- A one-sided out-transition applies the same rendering to the leaving instance, but the progress is p′ = (end − t) / (end − start), which goes from 1 to 0, and then `easing` is applied. The missing side is transparent, exposing the track below. For a two-sided transition, A is drawn first as usual, then B is drawn over it with the in-transition rendering. Kinds that are two-sided only:
  - `dip-to-color` (`params.color` is `#RRGGBB`): when e < 0.5, it blends from A toward this colour (ratio 2e); after that, it blends from the colour toward B (ratio 2e − 1).
  - `push` (`params.direction` is `left`, `right`, `up` or `down`, the direction of motion): B pushes in from off the canvas along this direction while A is pushed out along the same direction. B's remaining displacement is (1 − e) canvas widths or heights; A's displacement so far is e.
- When a transition does not hold, the other side is disabled, the track it is on is hidden, or it cannot be drawn, that moment is drawn as a hard cut. Unrecognized kinds are kept in the video; rendering falls back to a hard cut and reports them as unsupported.
- `audioCrossfade` is used only for transitions between two video instances, with both sides enabled. The two sides' own sound is crossfaded at equal power within the window: the left is multiplied by cos(p·π/2) and the right by sin(p·π/2). A side outside its own interval takes sound from its handles through its timeMap and does not apply its own fades. If one side is disabled, the transition is a hard cut. Hiding a track does not affect sound; only mute and Solo do.

Field sources: `PRESETS`, `DURATION_RANGE` and `DURATION_DEFAULT` in `video_transitions.rs`, and the one-sided sampling and rendering.

**Effects**

- `fx` applies to visual media and compound instances (§3.4), not to text, graphics or the other generated elements: text stroke and shadow live in `style` (§3.6), and a graphic's are in `shape`.
- The fields are fixed. A write is rejected if any field is out of range. An omitted field, or one equal to its identity value, produces no effect. Rendering applies the following fixed order to the result already drawn at this layer, regardless of the order in which the fields are written in the object. Then `place.opacity` is multiplied in, and the layer is blended with the layers below:
  1. `filterPreset`: the filter preset, expanded into a fixed chain of colour adjustments.
  2. `effectPreset`: the effect preset, with its strength multiplied by `effectIntensity`.
  3. `grayscale` and `brightness` (`filter.colorAdjust@1`).
  4. `exposure` (`filter.brightness`, with amount exposure × 2/3).
  5. `contrast` (`filter.contrast`).
  6. `saturation` (`filter.saturation`, with amount 1 + saturation).
  7. `hue` (`filter.hueRotate`, hue × 180 degrees).
  8. `temperature`: red × (1 + 0.2 × temperature), blue × (1 − 0.2 × temperature), clamped to [0, 1].
  9. `blur` (`filter.blur@1`, radius blur / 540 × short edge).
  10. `sharpen`, `noise`, `vignette` (`filter.sharpen`, `filter.noise`, `filter.vignette`).
  11. Rounded-corner or ellipse mask (`mask.shape@1`): the `place` corner radius (§3.5) or `mask`; applies only in `pip` or tiling.
  12. Animated reveal (`mask.progress@1`, §3.15).
  13. `stroke`: a ring drawn along the outside of the alpha contour, with `width` in (0, 100].
  14. `shadow`: the alpha contour offset, blurred and filled, drawn beneath the picture; `blur` in [0, 200], `opacity` in [0, 1], with positive values going right and down.
- Where each step applies: 1–10 act on the source picture (after cropping, before it is fitted into the `place` frame); 11–12 act within the element's drawing; 13–14 act on the result drawn at this layer, along its alpha contour. The stroke hugs the contour after it has been rotated, and the shadow's `offsetX` and `offsetY` follow the canvas's right and down, not `place.rot` (for an instance rotated 90 degrees, a shadow with positive `offsetX` still falls to the right of the frame).
- Each step's formula follows the recipe (the `filter.*` and `mask.*` recipes in `render-raster`, and the filter preset table in `effects.rs`); this spec does not restate them.
- Lengths are always stored as pixels for a 540 canvas short edge; rendering multiplies them by `short edge / 540`.
- Effects with backward dependencies, such as masks, adjustment layers and blend modes, go into the RenderGraph. They cannot be rendered element by element and then assumed to recombine losslessly. Both `mask` and rounded-corner masks are bound by this rule.

Field sources: `Fx`, `FX_AMOUNT_RANGE`, `FX_ADJUST_RANGE`, `FX_BLUR_RANGE`, `FilterPreset`, `EffectPreset` and `Mask` in `schema.rs`; `lower_element_effects` and `REFERENCE_SHORT_EDGE` in `effects.rs`. `temperature`, `shadow` and `stroke` are the three effects from v3 that were folded into the fields of `fx`.

**Ducking**

- Ducking rules live on the sequence. When triggered, the instances in the target group are lowered by `depth` dB. Ducking is computed from intervals on the timeline, not from signal level: the result depends only on the timeline, is determined frame by frame, and preview and export match.
- **Triggered by script** (`kind: 'speech'`): the trigger intervals are each word's interval on the sequence in the current effective word stream (§5.7). A word with no word-level timing uses the interval of the sentence or cue it belongs to. If the video has no script, or the effective word stream is empty, nothing is lowered and `duck-no-speech` is reported (in export warnings it is `DUCK_NO_SPEECH`). The effective word stream takes the words of each transcript document in the video, projected onto the sequence: cut words, frozen words and words not on the timeline do not count.
- **Triggered by instances** (`kind: 'items'`): the trigger intervals are the sequence intervals of these instances in the group (audio at sample precision, §2.10). The instance must be enabled, on a track that is sounding (not muted, consistent with Solo), and itself sounding: an audio instance that is not muted, a video instance whose embedded audio is enabled and whose source has an audio track, or a compound with a pre-rendered stand-in and sound enabled. If a track referenced by the group does not exist, `duck-track-missing` is reported.
- Trigger intervals are merged first: adjacent intervals whose gap does not exceed max(0.5 s, attack + release) are merged into one segment. Each segment `[s, e]` expands into four points on the gain curve: (s − attack, 1), (s, g), (e, g) and (e + release, 1), with g = 10^(−depth / 20). Between points the interpolation is linear in gain; outside the segments the value is 1. `attack` and `release` below 0.001 s are treated as 0.001 s.
- The ducking gain is multiplied with the instance's volume and fades. When an instance falls within the target groups of several rules, their gains multiply. The per-frame plan and the export read the same ducking dB breakpoints: beyond the four points of each segment, the ramps are sampled evenly every 0.02 s (`ENVELOPE_BAKE_STEP`), with linear interpolation in dB between breakpoints.
- Ranges: `depth` is in [0, 60]; `attack` and `release` are in [0, 5] s, are exact times, and are not quantized. The target group cannot be empty; when triggering by instances, the trigger group cannot be empty either; each group holds at most 256 items. Tracks must be visual or audio tracks, and instances must be audio, video or compound instances. The same track or instance cannot be in both groups. If the target group contains a locked track or instance, the rule cannot be set or deleted.
- When a named instance in a group is split, the right half joins the group. When items are joined (`joinItems`), the half that is absorbed is replaced in the group by the one that remains. After a track or instance referenced by a group is deleted, that entry stays and matches no instance. When a rule is modified, only the groups given in that edit are validated.

Field sources: `Duck`, `DUCK_DEPTH_DEFAULT`, `DUCK_DEPTH_RANGE`, `DUCK_TIME_RANGE`, `DUCK_MERGE_GAP`, `DUCK_MIN_RAMP`, `duck_curve`, `speech_intervals` and `track_intervals` in `duck.rs`; the default attack and release come from `scene_primitives::audio_mix`.

### 3.10 Protection and Locks (supplement to this spec)

```ts
interface ProtectionRecord {
  id: Id;
  level: 'confirmed' | 'locked';
  target:
    | { kind: 'video' }
    | { kind: 'entity'; entityId: Id; propertyPaths?: string[] }
    | { kind: 'interval'; sequenceId: Id; span: FrameSpan; trackIds?: Id[] };
  origin: { by: 'user' | 'task'; taskId?: Id; conversationId?: Id; at: string };
  note?: string;
}
```

- `locked`: enforced at commit time; a transaction that touches it is rejected and the lock must be explicitly removed.
- `confirmed`: marks an agreed direction; automated flows must not redo it without reason, and touching it requires a proposal.
- Persistent protection is stored in the video. A protection scoped to a single task (“leave the rest alone this time”, i.e. “这次其他别动”) belongs to TaskContract. The Runtime hands it to the engine together with the authorization context and checks it at commit time; it is not written into the video.
- The `locked` field on tracks and items is a shorthand for protection; its semantics are the same as a `locked` protection on that entity.

### 3.11 Checkpoint (supplement to this spec)

```ts
interface Checkpoint {
  id: Id;
  name: string;
  videoRevision: Revision;
  createdAt: string;
  origin: { by: 'user' | 'task' | 'system'; taskId?: Id };
  note?: string;
}
```

A checkpoint is a named reference to a committed version. It does not copy media. The versions referenced by a checkpoint, and the asset versions they reference, are not garbage-collected.

### 3.12 Dependency Links

```ts
interface DependencyLink {
  from: VersionRef;                    // derived artifact
  to: VersionRef;                      // input
  kind: 'derived-from' | 'aligned-to' | 'translated-from' | 'rendered-from' | 'anchored-to';
  inputFingerprint: string;
}
```

Every derived artifact records a fingerprint of its inputs. For invalidation rules, see architecture design §10.

### 3.13 Marker

```ts
interface Marker {
  id: Id;
  frame: number;                       // frame of the sequence
  durationFrames?: number;
  label: string;                       // chapter title
  kind?: 'chapter' | 'note' | 'todo';
  summary?: string;                    // chapter summary
  thumbnail?: VersionRef;              // chapter thumbnail: one image asset version
}
```

- A chapter is a marker with `kind: 'chapter'`; there is no separate object. A sequence's chapter table is its chapter markers sorted by frame.
- Chapters are fixed to sequence time: moving, trimming or deleting items, and ripple delete (`removeRange`), do not change their frame. The exception is cut points: when cuts are applied and restored, chapters move with the content (§6.7).
- A chapter's frame is ≥ 0 and strictly increasing (two chapters cannot share a frame). The title is 1–200 characters (after trimming surrounding whitespace), the summary is at most 2000 characters, and a sequence holds at most 1000 chapters. The thumbnail is the current version of the image asset that was written.
- Replacing the chapter table as a whole leaves markers of other kinds untouched. Chapters are not affected by track and item locks.
- Chapters are not part of the frame plan and do not affect picture or sound.

### 3.14 Fonts

Fonts are referenced through video assets and exact style identifiers, not only by the font name on the machine.

```ts
interface FontRecord {
  id: Id;
  assetRef: VersionRef;               // font file bytes
  family: string;
  style: { weight: number; italic: boolean; stretch?: number };
  postscriptName?: string;
  license?: LicenseState;
}
```

When a font is missing, preview may warn and use a substitute font. Strict export must require the user to explicitly accept the substitute, or the font must be supplied.

Current status: the video does not yet have a `FontRecord`. Text styles and caption styles only write the font family name (`fontFamily`). At render time, the renderer first looks for fonts shipped with the render kernel. A family not found there is looked up by family name among the local machine's fonts (family names are case-insensitive, or matched exactly by PostScript name). Preview and export use the same resolution, so one family name resolves to the same set of files (architecture design §9.1). A family found nowhere is drawn with a substitute font, and text elements and captions show the same notice in both preview and export. Export does not refuse and does not require explicit acceptance. Local fonts are not stored in the video, so the result may look different on another machine.

### 3.15 Keyframes and Element Animation

The motion of a visual instance has three layers, stacked bottom to top: the static `place` (§3.5), the base pose after keyframe sampling, element animation (`animate`), and one-sided transitions (§3.9).

**Keyframes**

```ts
interface AnimationBinding {
  id: Id;
  targetId: Id;                        // one visual instance
  propertyPath: 'x' | 'y' | 'scale' | 'scaleY' | 'rot' | 'opacity' | 'radius';
  keyframes: Keyframe[];               // 1–256 items
}

interface Keyframe {
  localFrame?: number;                 // frame local to the instance, on the sequence edit grid, ≥ 0
  percent?: number;                    // percent of the instance length, [0, 100]; mutually exclusive with localFrame
  value: number;
  ease?: EaseName;                     // easing of the segment entering this frame; default 'linear'
}

type EaseName =
  | 'linear'
  | 'easeInQuad' | 'easeOutQuad' | 'easeInOutQuad'
  | 'easeInCubic' | 'easeOutCubic' | 'easeInOutCubic'
  | 'easeInQuart' | 'easeOutQuart' | 'easeInOutQuart'
  | 'easeInExpo' | 'easeOutExpo' | 'easeInOutExpo'
  | 'easeInSine' | 'easeOutSine' | 'easeInOutSine'
  | 'easeInBack' | 'easeOutBack' | 'easeInOutBack'
  | 'easeOutElastic';
```

- Property names map one-to-one to the same-named fields of `place`, with the same units: `x` and `y` are canvas percentages, `scale` and `scaleY` are multipliers, `rot` is degrees, `opacity` is in [0, 1], and `radius` is ≥ 0 (pixels at a 540 short side). Out-of-range values are rejected on write. Volume keyframes are the mix envelope (§3.9) and are not covered here.
- Scope: `radius` applies only to visual media; the other properties apply to all visual instances. An instance may have at most one binding per property.
- The frames in one binding use only one time notation, and their times are strictly increasing. `localFrame` follows the content. `percent` scales with the instance length, so after a trim it still lands at the same proportion.
- **Sampling.** Sample at the exact moment local to the instance, without quantizing to frames first (§2.5). Before the first frame, the first frame's value is used; after the last frame, the last frame's value is used. A frame whose `localFrame` is beyond the instance length has no effect. Between frame i − 1 and frame i, interpolate with frame i's `ease`; easing functions follow the easing table in `motion`.
- Sampled values **replace** the same-named static value of `place` and become the base pose. A sampled `radius` replaces all four corner radii (including `cornerRadii`). Element animation and one-sided transitions layer on top of the base pose.
- **Uncover check.** When a static video or image that covers the whole canvas has visual keyframes, the engine samples on the frame grid and at each keyframe time. If the canvas shows through by more than 0.5 px during motion, the receipt warns, but the edit is not rejected.
- **Split, merge and trim.** On a split, each half keeps the frames that fall inside its own window and adds one sampled value at the seam, so the visible animation is unchanged. Merge is the inverse of split: it merges when the pieces can be restored to the same frame series, and is rejected otherwise. When a trim or a cut-following change alters an instance's window, `localFrame` is converted by the content's displacement. Frames that fall outside the window are removed, and a sampled value is added at the new boundary. `percent` is kept as is. Results of these conversions are quantized to frames per §2.6.
- Keyframe times given in seconds (v2's `t`, seconds in commands) are converted to `localFrame` by taking the nearest frame, and a quantization receipt is issued. Percentages are stored as they are. When `Sequence.fps` changes, the conversion follows the transaction rules in §2.12.
- Unrecognized property or easing names are rejected on write. When dragging an object that has keyframes, the command must state whether it changes the base pose (“改基础姿态”) or adds a keyframe at the current frame (“在当前帧加关键帧”).
- Keyframes inside code composition are managed by the code package itself and are not covered here.

Field sources: `keyframes.rs` (`KEYFRAME_PROPS`, `KEYFRAMES_MAX_PER_PROP`, `KeyTime`, `Keyframe`, `KeyframeCaps`, `sample`, `place_at`, `keyframes_uncover`, `UNCOVERED_TOLERANCE_PX`, `rewindow`, `split_keyframes`, `join_keyframes`); easing names are in `EASE_NAMES` in `crates/motion/src/curve.rs`.

**Element animation**

```ts
interface Animation {
  enter?: AnimationSlot;               // enter
  exit?: AnimationSlot;                // exit
  loop?: AnimationSlot;                // loop
}

interface AnimationSlot {
  preset: string;                      // preset name for this slot, see below
  presetVersion?: number;              // preset version, currently 1
  dur?: number;                        // seconds, [0.1, 2]; only for enter and exit; default from the preset
  delay?: number;                      // seconds, ≥ 0; default 0
  intensity?: number;                  // [0, 1]; default 1
  ease?: EaseName;                     // default: the preset's curve
  stagger?: number;                    // seconds between per-character or per-word offsets, > 0; only for enter and exit
  staggerFrom?: 'start' | 'end' | 'center';   // only for enter and exit
  period?: number;                     // seconds, [0.2, 6]; only for loop; default from the preset
  phase?: number;                      // seconds, finite number; only for loop; default 0
  seed?: number;                       // non-negative integer; only for loop; default from the preset
}
```

- The three slots are formal fields of the instance. They are stored as written and are not expanded into keyframes. At render time, `motion` samples them at the exact moment local to the instance (`timeline::motion::compile_animation`), and all three ends get the same result.
- `preset` is a closed list of names, validated on write. Enter takes `ENTER_PRESETS`, exit takes `EXIT_PRESETS` (legacy names in `EXIT_LEGACY_PRESETS` may be read), and loop takes `LOOP_PRESETS`. Preset recipes are data under `crates/motion/presets/builtin/motion/`. This spec only defines referencing by `preset` and `presetVersion`. If the recipe for a given pair cannot be found at render time, that slot is skipped and reported, and the rest of the instance renders as usual.
- Fields that do not apply to a slot are rejected on write.
- When no exit slot is written, exit is derived as the mirror of the enter preset, with a duration equal to the effective enter duration × 0.75. Write exit with `preset: 'none'` to turn this derivation off. Writing `'none'` for enter or loop removes that slot.
- `typewriter` and `riseWords` apply only to text, not to timer or counter readouts. Audio instances have no `animate`.
- All seconds are exact times local to the instance and are not quantized.

Field sources: `schema.rs` (`Animation`, `AnimationSlot`, `ENTER_PRESETS`, `EXIT_PRESETS`, `EXIT_LEGACY_PRESETS`, `LOOP_PRESETS`); `animations.rs` (`ANIMATION_PRESET_VERSION` and the interval constants); the derivation of exit is in `effective_exit` in `crates/motion/src/lower_timeline.rs`.

### 3.16 FollowPolicy and Semantic Anchors

Each attached element declares what it moves with:

```ts
type FollowPolicy =
  | { kind: 'sequence-fixed' }                         // fixed to sequence time, e.g. an opening logo
  | { kind: 'follow-cuts' }                            // moves and shortens with cut points, see below
  | { kind: 'item-local'; itemId: Id }                 // moves with the specified item, see below
  | { kind: 'speech-anchor'; start?: SemanticAnchor; end?: SemanticAnchor }   // start and end anchored to words or sentences; at least one
  | { kind: 'explicit-link-group'; groupId: Id };      // audio and picture grouped; linked by rules

// supplement to this spec
type SemanticAnchor =
  | { kind: 'word'; speechRef: VersionRef; wordId: Id; occurrenceId?: Id; edge: 'start' | 'end'; offset?: MediaTime }
  | { kind: 'sentence'; speechRef: VersionRef; sentenceId: Id; occurrenceId?: Id; edge: 'start' | 'end' }
  | { kind: 'item'; itemId: Id; localOffset: MediaTime }
  | { kind: 'sequence'; sequenceId: Id; frame: number };
```

- **To the end of the sequence.** An instance with `ItemBase.untilSequenceEnd` set to true has no end of its own. Its end is the latest end of the other objects in the sequence. When `durationPolicy` is `fixed`, its length is fixed. It can be combined with any `FollowPolicy`, but it cannot be used when a `speech-anchor` has an `end`.
  - At the end of each edit transaction, the engine computes the end from the final timeline and writes it back to `span`. A length given on write, or a direct trim of its end, has no effect.
  - The other objects are the other instances on the sequence (including disabled ones). The maximum of their exact ends is rounded up to a frame. Instances that run to the sequence end do not count toward each other.
  - If another instance follows on the same track, the end is clipped to that instance's start. The length is at least 1 frame. Instances with a linear `timeMap` do not exceed their source material.
  - The end is computed, not an edit to the instance, so it is updated even when the instance or track is locked. Task protection is checked against changes (command and protocol spec §3.4), and a transaction that changes a protected instance of this kind is rejected as a whole.
  - Keyframes are converted with a window whose start stays fixed (§3.15).
- **`speech-anchor`.** Decided: at the end of each edit transaction (before the end-to-sequence-end is computed), the engine recomputes every anchor from the final timeline and places the instance. The start and end are each evaluated separately. For an end without an anchor: if there is only a start, the length is kept; if there is only an end, the start stays fixed. The computed times are quantized to frames by `nearest-frame` (§2.6). Placement moves the start first, then trims the end (keyframes converted per §3.15).
  - Word projection is the same as caption dodging (§3.9). The acting instances are the video and audio instances of the transcript asset on the sequence, sorted by start and then by ID; at any given moment only the first is taken. Hidden words and words without text do not project. Projection decides where the word appears; the time is computed exactly from that instance's linear mapping and the word's timing.
  - If the midpoint of a word falls inside a cut in the material (§6.7), the word counts as cut. If an endpoint falls inside a cut, it snaps toward the part that is kept: the start is pushed to after the cut, and the end is pulled to before the cut. If an endpoint is trimmed away, it snaps to the edge of the instance that contains the midpoint. A word anchor's `offset` is a signed exact duration, added after mapping to sequence time. If the result is negative, the anchor is invalid.
  - Occurrences: if a midpoint maps to more than one place, it is ambiguous. `occurrenceId` is the ID of the acting instance, or the one from before the split (`lineage.originItemId`); using it selects only that occurrence.
  - Sentence anchors use the stored `sentences` (§5.2). The start is the beginning of the first computable member word, and the end is the end of the last computable member word. If the document has no stored sentences, the anchor cannot be computed. An `item` anchor is that instance's start plus `localOffset`. A `sequence` anchor is that frame; it cannot be computed when the sequence is not the one the instance is on.
- When an anchor cannot be computed (decided):
  - If the word was cut, the word or sentence does not exist, the word does not appear on the current timeline, the offset makes the time negative, the computed end is not later than the start, or the computed position cannot be placed (it overlaps another instance on the same track or exceeds the source), the instance stays at its previous position and enters the `orphaned` state. It must not silently attach to a neighbouring sentence, nor jump to 0 seconds. Later transactions recompute it as usual, and it returns to the anchor once the anchor can be computed and the position fits.
  - `orphaned` is not stored; it is computed from the current timeline. Each transaction's receipt lists the instances that are `orphaned` at that point in `impact.orphanedAnchors`. `videos.inspect` lists the instances and the reasons (reason codes as in `anchors.rs`: `word-anchor-missing`, `-cut`, `-unmapped`, `-ambiguous`, `-invalid`, plus `sentence-anchor-missing`, `item-anchor-missing`, `sequence-anchor-mismatch`, `anchor-range-empty`, `anchor-blocked`). Rendering ignores this state, and the instance renders as usual.
  - If an anchor written in this transaction (newly created, or a changed follow policy) is ambiguous, or points to a transcript document version that does not exist, the whole transaction is rejected (`INVALID_OPERATION`, with `details.rule` set to the reason code). A malformed anchor is likewise rejected on write. If an anchor written earlier later becomes ambiguous, it only enters `orphaned`, and that edit is not rejected.
  - If an instance or track is locked and an anchor would move it, the whole transaction is rejected (`TARGET_LOCKED`), the same as for `follow-cuts`.
- **`item-local`.** Decided: the instance keeps its position relative to the start of the target instance. At the end of each edit transaction it is recomputed from how the target changed in that transaction. It only moves and does not change length. The anchor time is the follower's start.
  - When the target has a linear `timeMap`, the anchor becomes a source time on the target. It is found again on the target after the transaction and on the pieces split from it (lineage). It follows the piece the time falls in, and `itemId` is redirected to that piece. If the source time was trimmed or cut, it moves to the start of the nearest following piece. If it lies after all pieces, it is extrapolated from the last piece. After a merge (`joinItems`), it is redirected to the surviving item.
  - For a target without `timeMap`: a whole-target move is followed. A start-only change leaves it in place; if the start passes the anchor, it moves to the target's new start. On a split, it follows the piece that contains the anchor.
  - When the follower is before the target's start, it keeps its distance to the target's new start.
  - When the target is deleted (no piece remains), the follower is deleted in the same transaction and listed in the receipt as `impact.removedWithTarget`. Instances following the follower are deleted with it.
  - If the follower itself was moved or trimmed in this transaction, or its follow policy was written in this transaction, it is not recomputed. When written, the target must be on the same sequence, otherwise the write is rejected (`INVALID_OPERATION`, `details.rule: 'item-local-target'`). If the follower is locked and would be moved or deleted, the whole transaction is rejected (`TARGET_LOCKED`). If it overlaps an instance on the same track after moving, it is rejected per §3.10.
- **`explicit-link-group`.** Decided: this version does not implement linking. Only the shape is stored and validated, and it does not move on edit.
- **`follow-cuts`.** In transactions that apply or restore cut points (§6.7), such instances move according to the timeline before and after the cut:
  - The start and the end are each first mapped back from the old sequence time to the source time in the cut material, then mapped to the new sequence time.
  - If a point falls inside a deleted range, the start is pushed to the next kept time and the end is pulled to the previous kept time. If the end is then not later than the start, the instance is deleted and listed in the receipt.
  - When the start is pushed later, the source start of an instance with timeMap also moves later (pushed length × rate).
  - An instance that crosses a cut only shortens. It is not split, and no gap is opened in the middle.
  - An instance that lies after all instances of the cut material keeps its distance to the end of the sequence.
  - When a cut is restored: a start at or after the seam moves back by the restored length. An instance crossing the seam is extended by that length (instances with timeMap do not exceed their source). An end exactly at the seam does not move.
  - Results are quantized to frames per §2.6, and keyframes are converted per §3.15.
  - Instances on a cut track (§6.7) move with ripple delete and reinsertion, regardless of their own `FollowPolicy`.
- **Default.** Decided: instances placed on the timeline default to `follow-cuts` from creation, whether or not the video has a cut set. This covers text, shapes, stickers, picture-in-picture images and videos, captions, generated instances, and audio taken from another asset. `sequence-fixed` must be chosen explicitly (stated in `insertItems` or `updateItem`). Instances that play the cut material itself are rearranged with the cuts as before, regardless of policy. Instances from earlier versions that did not write `followPolicy` are read as the default `follow-cuts`, with no separate migration. Instances that were explicitly written as `sequence-fixed` under the old default cannot be told apart from ones the user chose, so they are left unchanged. When the user says “跟着这句话” (follow this sentence), use `speech-anchor`.
- “Global ripple” must name in the command the set of affected tracks and how locked tracks are handled. It must not shift all tracks left, nor change only the main video while leaving captions and narration at their old times.

Field sources: `anchors.rs` (anchor grammar, `start`/`end` boundaries, offsets, the snap-to-edge rule for cut points, `word-anchor-invalid`, `-missing`, `-cut`, `-unmapped`, `-ambiguous`); `follow.rs` (numeric element rules and `COMPOSE_EPS`); for the open end, see the branch in `motion.rs` that takes the value at the end of the project.

### 3.17 Template layers

A template layer is a fixed set of layouts on the sequence: chapter bar, progress line, logo, and text. It is drawn above all tracks. Coordinates are percentages of the frame; time is the sequence clock.

```ts
interface TemplateLayers {
  id: string;
  name: string;                        // non-empty
  hue: string;                         // hue of the catalog card: purple cyan orange yellow magenta blue gray red green pink; default 'gray'
  group?: string;                      // catalog group
  canvas: '16:9' | '9:16';             // aspect ratio the layout is drawn for; default '16:9'
  ratio?: string;                      // aspect ratio the sequence canvas is changed to when applied: 'original' or 'W:H'
  lockRatio?: boolean;                 // given together with ratio, locks the sequence's aspect ratio; omitted when false
  builtin?: boolean;                   // true for definitions in the built-in catalog; omitted when false
  tag?: string;                        // 'watermark' marks watermark-type templates
  imported?: string;                   // 'watermark' means imported from a legacy watermark preset
  desc?: string;
  font?: string;                       // font family for the whole set; when omitted, follows the subtitle style font
  from?: string;                       // id of the definition the instance comes from
  subsAvoid?: boolean;                 // subtitles avoid the bottom bar; default true
  layers: TemplateLayer[];             // array order is stacking order; later entries are on top
}

type TemplateLayer = {
  id: string;                          // unique within this template set
  on?: boolean;                        // default true
  box: { x: number; y: number; w: number; h: number };   // percent of the frame, origin at top-left
} & (
  | { kind: 'chapters'; fill?: 'bar' | 'dim'; bg: string; color: string; accent: string; colorDone?: string; divider?: boolean; size?: number }
  | { kind: 'progress'; accent: string; track: string }
  | { kind: 'logo'; src?: 'text' | { brandLogo: string } | { file: string }; text?: string; bg?: string; color: string;
      shape?: 'badge' | 'plain'; align?: 'left' | 'center' | 'right'; size?: number; pad?: number; tile?: boolean; opacity?: number }
  | { kind: 'text'; text: string; color: string; bg?: string; align?: 'left' | 'center' | 'right'; size?: number;
      pad?: number; mono?: boolean; weight?: number }
);
```

- Colours are always `#RRGGBB` or `#RRGGBBAA`. `size` and `pad` are percentages of the frame height: chapter bar default `size` 2.6, logo 3.0, text 2.8; `pad` defaults from the font size. The text `weight` is in [100, 900], default 700. The chapter bar `fill` defaults to `bar`, and `divider` defaults to true. The logo `src` defaults to `'text'`, `shape` to `badge`, `align` to `center`, and `opacity` is clamped to [0.05, 1] on read, default 1; the text `align` defaults to `left`.
- Box: `x` and `y` ≥ 0, `w` ≥ 4, `h` ≥ 0.6, `x + w` ≤ 100, `y + h` ≤ 100, tolerance 0.051.
- The logo `file` is a path relative to the project; `brandLogo` is the id of an image in the brand library. When used, register it as an asset (§4.1).
- **Time.** The chapter bar is split into segments by the `kind: 'chapter'` markers on the sequence (§3.13), and the current segment is highlighted; with no chapters, the whole bar is one segment. Progress on the progress line is clamp(t / sequence length, 0, 1).
- **Text variables.** In text layers, `{chapter}`, `{n}`, `{count}`, `{time}`, `{remain}`, `{total}`, `{percent}` and `{title}` are replaced according to the current moment with: current chapter name, chapter index, chapter count, elapsed time, remaining time, total length, percentage, and video title. Unrecognised variables are shown as written.
- **Subtitle avoidance.** When `subsAvoid` is true, an open full-width bar (chapter bar or progress line) with `y` ≥ 50 raises the subtitles: the subtitle anchor line (the style's `y`, a percentage of frame height) is not lower than `y − 2`; when several bars apply, the highest one wins. Only the position moves; font size, width and background do not change. For bilingual subtitles the two lines move together; subtitles placed at the centre do not move.
- **Aspect ratio.** `ratio` changes the sequence canvas only once, when the template is applied. While `lockRatio` is in effect, commands that change the sequence's aspect ratio accept only the same ratio as `ratio`; unlock first to change it.
- Template layers are parameters of the sequence, not instances: they are not on a track, have no `span`, and do not take part in `durationPolicy`.

Source of the fields: `TemplateDoc`, `TemplateLayer`, `LayerBox`, `LayerKind`, `MIN_W`, `MIN_H`, `VAR_NAMES`, `HUES`, `MIN_OPACITY`, `validate` and `ratio_lock` in `crates/timeline/src/protocol/template.rs`; derivation rules are in `progress`, `segments`, `vars`, `fill` and `subs_bottom` in `crates/timeline/src/template.rs`.

---

## 4. Assets and documents

### 4.1 AssetRecord

An asset is the bytes a video uses: one file, or one directory.

```ts
interface AssetRecord {
  id: Id;
  kind: 'video' | 'audio' | 'image' | 'lottie' | 'font' | 'caption' | 'document' | 'bundle' | 'other';
  name: string;
  currentRevision: Revision;
  revisions: Record<Revision, AssetRevision>;
}

interface AssetRevision {
  revision: Revision;
  contentHash: string;                // SHA-256 of the file; tree digest for a directory (§4.3)
  byteLength: number;
  mediaType: string;                  // directories are inode/directory
  storage: AssetStorage;              // §4.2
  duration?: MediaTime;
  timebase?: Rate;
  video?: {
    displayWidth: number;
    displayHeight: number;
    rotation: 0 | 90 | 180 | 270;
    pixelAspectRatio: Rate;
    frameRate: { kind: 'cfr'; rate: Rate } | { kind: 'vfr'; nominal?: Rate };
    ptsOrigin: MediaTime;             // original origin; may be negative
    hasAlpha: boolean;
  };
  audio?: { sampleRate: number; channels: number; layout?: string };
  tree?: { fileCount: number; include?: string[] };   // when the asset is a directory (§4.3)
  bundle?: JsonValue;                 // manifest of the code package (code package spec §2)
  provenance: Provenance;             // §4.5
}
```

- The asset ID identifies the resource's identity; an asset revision identifies a definite set of bytes and metadata. Once written, a revision is never modified.
- `contentHash` is required and is computed at registration. There is no asset revision with a "digest pending" state.
- `kind: 'lottie'` is a Lottie animation file that can only be referenced by an asset sticker (§3.7); it has no audio track, and its display size is the width and height the animation declares. The asset is either a bodymovin JSON (`mediaType` is `application/json`), or a `.lottie` archive (`application/zip`, which plays the current animation in its manifest, or the first animation if there is no manifest). On import, `.lottie` files, and `.json` files that read as Lottie (top-level version `v`, numeric `fr`, `ip`, `op`, and a layers array), are recorded as `lottie`; other JSON stays `other`. The revision records `video` (the animation's declared width and height, frame rate, pixel aspect ratio 1, `hasAlpha`) and `duration` (frame range divided by frame rate, rounded to milliseconds). Both are read by the same implementation the render kernel uses to read Lottie. Files that cannot be opened, use features the kernel does not support, or have an empty frame range are rejected (`MEDIA_PROBE_FAILED`); files over 32 MiB are rejected (`INVALID_OPERATION`). Image sub-resources may be PNG, JPEG, GIF (first frame), WebP, or SVG (rasterised at the resource's declared width and height; `<text>` is not drawn). They must either be embedded as data URIs or be in the same archive. An external image that is only referenced by path and is not in the archive cannot be read; the instance cannot be drawn and reports `lottie-asset-missing`.
- `kind: 'caption'` and `kind: 'document'` are **files** (an SRT, a PDF), not the documents of §4.4. When a subtitle file is imported, the file is the asset, and the subtitle lines parsed from it are documents; a document points back to its file through `sourceAssetId`.
- Variable-frame-rate indexes, proxies, thumbnails, waveforms and reverse conform are derived products, not part of an asset revision.
- Colour information (`ColorInfo`) and licence state (`LicenseState`) are not yet included (§9).

### 4.2 Storage location

Where the bytes live is a property of the asset revision, not part of the revision's identity.

```ts
type AssetStorage =
  | { mode: 'managed' }                                      // in the video directory's blobs/, content-addressed
  | { mode: 'linked'; locator: FileLocator; frozen: boolean };   // stays in place; the video only records where to find it

interface FileLocator {
  path: string;                       // when the file is inside the project directory, a path relative to the video directory (`/`-separated); otherwise an absolute path
  modifiedAt?: string;                // file modification time at link time, used to cheaply detect "the file may have changed"
  volume?: string;                    // name of the volume it is on; used to prompt "please connect drive X" when the file cannot be found
}
```

- Import defaults to `linked` (stays in place). When the user chooses "copy into video", it is `managed`. Content with no original file to point to (model-generated results, and recorded or pasted content) is always `managed`; directories (code packages) are also `managed` when unspecified. When `importAsset` is given no `storage`, it decides as follows: files are `linked`, directories are `managed`. A `managed` import must give an absolute path; `linked` may give either an absolute path or a path relative to the video directory. **Any asset can be linked, and any linked asset can be collected at any time**: `collectAssets` copies a linked asset's bytes into `blobs/` and changes its `storage` from `linked` to `managed`.
- **Location follows the project.** When linking (`importAsset` and `relinkAsset`), the engine normalises the path the caller gave literally (removes `.`, resolves `..`, and does not resolve symbolic links). It then checks whether the path is inside the video's **project directory**. If it is, the engine records a path relative to the video directory, which may contain `..` but must not leave the project directory. If it is not, the engine records the absolute path. After the whole project directory is moved or renamed, links inside the project still work. The project directory is the nearest level on the video directory's parent chain that contains `.ccut/project.json` (the engine only checks whether this file exists); if there is none, it is the parent directory of the video directory. When the path is written differently (for example through a symlinked parent directory), the two sides are compared once more by the real paths of their directories. A file that is itself a symbolic link is not resolved; the link inside the project follows the project.
- **Relative locations do not leave the project directory.** On resolution, relative paths are evaluated against the video directory. If the result leaves the project directory, the file is not read (`ASSET_MISSING`, `reason: 'outside-project'`). Collection (`collectAssets`) behaves the same way, so that a video brought in from elsewhere cannot use `../../..` to read files outside the project. If only the video directory is copied without the project, links inside the project will be missing or out of bounds and must be relinked. Linked assets with absolute paths are checked by the preview-type gate described below.
- Linked assets already registered by absolute path that are in fact inside the project (imported before this rule) are not migrated in bulk, and their new locations are not guessed from old paths. After the project is moved, they are reported as missing; re-point them with `relinkAsset`, which changes their location to a relative path.
- When a file has been moved, use `relinkAsset`. It checks that the content at the new location matches the registered `contentHash`, then updates the location.
- Collecting and relinking **do not create a new revision**; instances that reference this revision are unaffected.
- Different bytes appearing at the same path are a **new revision**, not a relink. They must go through an explicit replacement of the asset revision, which affects the chosen instances (architecture design §5.3). `relinkAsset` refuses when the content does not match.
- When a linked file cannot be found, the video still opens as normal and the asset is marked missing. An instance that uses it must not be drawn as blank and then treated as a success. Missing assets are reported through `videos.assetStatus` (command and protocol spec §4.1): for each asset's current revision and for the revisions referenced by instances, every one that cannot be read at this moment is listed. The reason is `missing` (gone), `changed` (no longer the file that was registered), or `outside-project` (the relative location left the project directory). These match the `details.reason` of `ASSET_MISSING` when the asset is accessed. This check only looks at whether the file exists and whether its length matches; it does not recompute the digest.
- A `linked` asset with `frozen = false` cannot be used for strict frozen export (architecture design §5.6).
- Locating an asset only looks at the local path in `storage.locator`. When a video is created from local media, the source also records the original file's path (§4.5). Both are facts about this machine and do not enter the portable package (§8).
- When the app hands a linked asset to the interface for preview, it allows only the one file the video registered, not other things in its directory. It also allows only the types useful for preview: images, audio and video, fonts, JSON confirmed to be Lottie, and `.lottie` archives whose central directory actually contains an animation. The registered media type must match the file's actual extension. Subtitle files and directories are not served through this path.
- Exported finished videos can be written to any location. The video does not require the export to be inside the video directory; it only records where the export went (`export-record` document, §4.6).
- The only entries in `blobs/` that the video manages are `<sha256-hex>.<ext>` (file assets) and `<sha256-hex>/` (directory assets). `blobs/.staging/` is the temporary area used before publishing; leftovers there whose modification time is older than the grace period (1 hour) are removed by the engine's blob GC (architecture design §5.2). Entries that do not match this shape are not managed by the video, and neither GC nor physical deletion touches them.

### 4.3 Directory Assets and Code Bundles

An asset can be a directory. A code bundle is a directory asset: `kind: 'bundle'`, with the manifest stored in the version's `bundle` field.

- **Tree digest.** The directory's `contentHash` is computed as follows: each file contributes one line `<sha256> <byte count> <relative path>`, the lines are sorted by path, and the whole is hashed again with sha256. `byteLength` is the sum of the byte counts of all files, and `tree.fileCount` is the number of files.
- **Partial inclusion.** `tree.include` lists the files and subdirectories (relative paths) that are included; omitting it means the whole directory is included. The tree digest covers only the included files. Source directories often contain dependency caches, render output and working files, and these do not belong to the code bundle.
- Directory assets can likewise be `managed` or `linked`, and can likewise be collected in or relinked.
- Each version of a code bundle is immutable. Changing the source produces a new version, and the composition instance's reference is then explicitly replaced (code bundle spec §3).
- The manifest's fields, the author contract and validation are defined in the code bundle spec. The video format only guarantees that the manifest is stored unchanged with the version.

### 4.4 Documents

A document is a structured text. Transcripts, translations, captions, styles, proposals and plans are all documents.

```ts
interface DocumentRecord {
  id: Id;
  kind: string;                       // open vocabulary (§4.6)
  name: string;
  language?: string;                  // BCP 47
  sourceAssetId?: Id;                 // the asset this document describes, e.g. the recording a transcript corresponds to
  sourceDocumentId?: Id;              // the document this one derives from, e.g. the transcript a translation corresponds to
  currentRevision: Revision;
  revisions: Record<Revision, DocumentRevision>;
  extensions?: Record<string, JsonValue>;
}

interface DocumentRevision {
  revision: Revision;
  contentHash: string;
  byteLength: number;
  createdAt: string;
  createdBy: Id;                      // the transaction that wrote this revision
  summary?: JsonValue;                // summary of the body: word count, sentence count, line count, etc.
}
```

- **The body is not in the snapshot.** The snapshot carries only the document header. The body is a JSON value stored per revision in the video's storage, and it is read on demand by `(document ID, revision)`. A six-hour video has tens of thousands of words; opening the video, listing documents and showing the summary to an agent should not read the entire body into memory.
- `summary` lets lists and agents know how large a document is and what it contains without reading the body.
- Each write produces a new revision. Older revisions are kept for history, undo and frozen tasks. The current revision is the basis for later computation.
- The body carries a `schema` field that states its format and version (§4.6).
- Derivation relations between documents, and between documents and assets, are expressed with `sourceDocumentId` and `sourceAssetId`. Dependencies that carry a version and a fingerprint use the dependency links of §3.12.
- An instance references a document by its ID (caption instances, §3.8), and follows the document's current revision.

### 4.5 Provenance

```ts
interface Provenance {
  origin: string;                     // open vocabulary: user-import, file-import, generated, derived, baked, template, library...
  importedFrom?: { originalName: string; importedAt: string };
  source?: JsonValue;                 // known origin: source URL, metadata from the original platform, generation record
}
```

- Provenance may record a local path. For a video newly created from local media (the transcription flow, `origin: 'file-import'`, architecture design §7.9), `source.path` is the absolute path of the original file and `source.jobId` is this run. It only says where the asset came from and is not used for locating it: reading an asset looks only at `storage.locator` (§4.2). If the file is later moved, renamed or relinked, the provenance does not change with it. When packed into a portable package, this path is replaced with a placeholder (§8).
- For an asset downloaded from a link, `origin` is `link-import` (architecture design §7.9), and `source` records: `url` (sanitized link), `webpageUrl`, `platform`, `mediaId`, `title`, `uploader`, `uploadDate`, `durationSec`, `description` (the page description, trimmed of leading and trailing whitespace, up to 20000 characters), `chapters` (the chapters supplied by the platform, `[{ start, end?, title }]`, in source-time seconds: entries whose start is not a finite non-negative number and entries with an empty title are dropped; titles have whitespace collapsed and are capped at 160 characters; the list is sorted by start, and only the first entry is kept for a given start; up to 400 entries; `end` is written only when it is greater than `start`), `tool` (`{ name, version, source }`), `downloadedAt` and the flow's `jobId`. When the platform gives no description or chapters, these two fields are omitted, and assets imported by earlier versions do not have them either. The description and chapters are reference material written by the author: the video summary reading lists them, and `chapters_adopt` snaps the chapters onto the chapters of the sequence written after transcription (§3.13). The asset itself is not changed by them.
- An asset copied in from the user's library has `origin` set to `library`, and `source.library` records the library, the entry ID, the version, the content digest, the name and the kind of the entry (architecture design §5.9). Later changes to or deletion of the entry in the library do not change this asset.
- User-uploaded media records only its known provenance. Uploading does not mean owning all rights to third-party assets.
- Temporary URLs, blob URLs, signed addresses, browser objects and GPU handles must not enter the video format.
- A generated asset should record in `source` the task, the provider, the model, a digest of the inputs and outputs, and the cost. When the cost is unknown, write `unknown`; do not fabricate an amount actually paid from an estimate. The structure of these fields, and the derivation, authorization and license status, will be settled when the generation and licensing features are added (§9).

### 4.6 Document Kinds

`kind` is open. The table below lists the kinds already in use, and the kinds that later sections of this spec plan.

| `kind` | Content | `schema` of the body | Definition |
| --- | --- | --- | --- |
| `speech` | A transcript of one recording: words, speakers, sentences, chapters | `cuccut.speech/1` | §5.2 |
| `translation` | Translation units for one target language | `cuccut.translation/2` (per §5.3; all new writes use this); `cuccut.translation/1` (old project imports, read-only compatibility) | §5.3 |
| `caption` | Caption lines for one language | `cuccut.caption/1` | §5.4 |
| `caption-style` | Caption style and layout | `cuccut.legacy-studio-style/0.1` (Studio style); `cuccut.boxed-caption-style/<N>` (positioned-box style, imported from external projects; `<N>` is the version number of the source format) | §5.6 |
| `library-selection` | Entries of the user library enabled in the video: glossaries for each step, speaker voices | `cuccut.library-selection/1` | see below |
| `export-record` | Where exported renders and subtitle files are | `cuccut.export-record/1` | — |
| `import-record` | Details when this video was imported from another format | `cuccut.import-record/1` | — |
| `editorial-proposal` | Spoken-content editing proposal | implemented | §6.2 |
| `cut-set` | Intervals on one source asset that were removed by spoken-content editing | `cuccut.cut-set/1` | §6.7 |
| `derivation` | Source of a derived child video: parent video, revision, interval and cut points outside the interval | `cuccut.derivation/1` | see below |
| `dubbing-plan` | Dubbing plan | plan | §7.2 |
| `sound-cue-sheet`, `narration-cue-sheet` | Sound event sheet, narration event sheet | plan | §7.9, §7.10 |

- Times in the body are integers, and the time base and clock are stated: `timescale` (ticks per second) and `clock` (`source-asset`: the clock of the asset that the `sourceAssetId` of this document or its source document points to; `sequence`: sequence time). Floating-point seconds are not used.
- The engine checks only the fields that §5.2 and §5.3 add to `cuccut.speech/1` and `cuccut.translation/2`: when present, their shape must be correct (types, enum values and value ranges). Whether referenced words exist is not checked. `cuccut.cut-set/1` is checked in full against the constraints of §6.7. Other bodies are not validated. The `/1` formats were fixed when old projects were imported, and they are simpler than the model described in §5. How the two are unified is listed in §9.
- `export-record` and `import-record` are records for this machine: their bodies contain local paths (where the rendered output was written, where the old project originally lived). They take no part in rendering and are not inputs to any instance. When packed into a portable package, they are either left out or carried only after their paths are removed (§8). Neither record is implemented yet, so for now any document whose body contains local paths is rejected outright when a portable package is exported (§8.2, architecture design §14).
- On reading an unknown `kind` or `schema`, the document header is still shown, the body is not interpreted, and the body is kept as it is when written back.
- `derivation` records which video this video was derived from, and which segment (`videos.derive`, architecture design §3.5 "derived child video"). One is written at derivation time. Its body and the header's `summary` are the same (the Space content index reads only `summary`), and it is named "Derivation source" (in the current language). It is not updated later as the parent or child video changes; it records only the moment of derivation. Body:

  ```ts
  interface DerivationBody {
    schema: 'cuccut.derivation/1';
    parentVideoId: Id;
    parentRevision: string;            // parent video's revision at derivation time
    range: { start: number; end: number };  // seconds on the parent video's edited timeline, aligned to frames
    primaryAssetId: Id | null;         // the primary asset where cuts are recorded (its ID in the parent video); null when there is no cuttable media
    cuts: Array<{ assetId: Id; from: number; to: number }>;  // cut points outside the interval: seconds on the primary asset's source clock
    settings: { width: number; height: number; fit: 'cover' | 'contain' | null; crop: Crop | null;
                captions: boolean; translations: boolean; chapters: boolean;
                crops?: Array<{ from: number; to: number } & Crop> };  // segmented framing: seconds on the parent video's edited timeline, aligned to frames and clipped to the interval
    framing?: {                        // how segmented framing falls on the primary asset's source clock: present only when crops are given and a primary asset exists
      assetId: Id;                     // primary asset (its ID in the parent video)
      shots: Array<{ from: number; to: number; crop: Crop | null }>;  // each segment of the primary asset within the interval: seconds on the source clock and the crop it uses
    };
    key: string;                       // idempotency key: first 12 characters of the sha256 of the parent video, revision, interval and settings (settings.crops is included only when present)
    hook?: string;                     // opening line: present only when the caller supplied it at derivation time
    reason?: string;                   // why this segment was picked
    notes?: string[];                  // signage: a few short reminders
  }
  ```

  `settings.crops` and `framing` are also optional fields added later. They are written only when segmented framing was given at derivation. Older documents without them are read normally and are understood as having only one framing, `crop`. `framing` is reserved for re-splitting clips by shot when cut points are later restored. The `crop` of each clip in the child video is the current state.

  `hook`, `reason` and `notes` are optional fields added later. They are written only when the caller supplied them at derivation, and they are not part of the idempotency key. Older documents without them are still read normally. When there is no `hook`, the interface takes the first sentence of the child video's retained segment. When there is no `reason` or `notes`, nothing is shown.

  The child video copies the parent's timeline and script. The parts outside the interval are cut points recorded in the primary asset's cut-set (`cut-set`, §6.7), and restoring them returns the parent video's form. `cuts` holds only the few cut points recorded at derivation time. The cut-set is the current state.

- `library-selection` records which entries of the user library the video has enabled (architecture design §5.9). Each video has at most one. If there are several, only the one with the smallest ID is used. Its name is "enabled library entries". It records entry IDs, not content. Entry content is frozen when it is used, and is recorded on the document or task that uses it (for example the translation's `glossaryRef`, §5.3). Body:

  ```ts
  interface LibrarySelectionBody {
    schema: 'cuccut.library-selection/1';
    glossaries: {
      transcribe: Id[];   // glossaries for transcription, in order; earlier ones take priority; at most 20
      translate: Id[];    // glossaries for translation, same as above
    };
    speakerVoices: Array<{  // at most 200 entries; each speaker in the same transcript has only one entry
      documentId: Id;       // which transcript (kind: 'speech')
      speakerId: string;    // the speaker's ID in the transcript
      voice: string;        // 'library:<voice id>', or the provider's voice ID
      providerId?: string;  // a provider's voice ID is used only with that provider; not given for library: voices
    }>;
  }
  ```

  On reading, if `schema` does not match, the selection is treated as though nothing is enabled, and mismatched items are dropped. If an entry has been deleted from the library, this does not change the document; the entry is skipped when used and reported. The document is rewritten as a whole only through `library.setVideoSelection` (command and protocol spec §4.1). Newly created videos get the default-enabled glossaries written by the Runtime. It takes no part in rendering, and it is carried along when packing. Entry IDs in a portable package may not exist in the library on another machine, and they are likewise skipped when used.

---

## 5. Speech, Captions and Translation Documents

The documents in this chapter are all stored per §4.4: one `kind` per script, with the body stored per version, and the snapshot holds only the document header. The `SpeechDocumentVersion`, `TranslationDocumentVersion` and similar types below describe the target model of the body. On the timeline, captions are shown by caption instances (§3.8).

### 5.1 Five layers

Captions are not an array of chunks. They have five layers, and the natural translated sentence is stored separately from the display rewrite:

```text
SpeechDocument.words                 word-level text and source times
          ├─ Sentence               semantic unit of translation
          │    └─ naturalTranslation the complete natural translated sentence
          │          ├─ AlignmentBlocks semantic correspondence
          │          ├─ displayRewrite  caption display rewrite, when needed
          │          └─ DubbingScript   dubbing script adapted for spoken delivery and duration
          └─ Source Cue             display time unit in the source language
Target Cue                          derived independently from the target language and block boundaries
Line                                lines laid out by font, frame size and style; render projection
```

The source and target cue counts are not required to match. One source sentence may map to several target cues. The bilingual picture is two independent time streams. The UI may show sentence-level or block-level correspondence, but it must not fabricate a line-by-line one-to-one correspondence.

### 5.2 SpeechDocument

```ts
interface SpeechWord {
  id: Id;
  text: string;
  sourceSpan: { start: MediaTime; end: MediaTime } | null;
  timingQuality: 'aligned' | 'provider' | 'estimated' | 'missing';
  speakerId?: Id;
}

interface SpeechDocumentVersion {
  id: Id;
  revision: Revision;
  language: string;
  sourceAssetRef: VersionRef;
  words: SpeechWord[];
  structure: { paragraphBreaks: Id[]; chapters: unknown[] };
  userBreaks: Record<Id, 'break' | 'no-break'>;
  autoBreaks: Record<string, Record<Id, 'break' | 'no-break'>>;
  derivationVersion: string;
  rawResultArtifactId: Id;
}
```

- Must keep traceable word IDs, speaker IDs, text, source time spans, timing quality and word provenance.
- The raw recognition result is archived as an immutable artifact (`rawResultArtifactId`). Manual corrections produce a new SpeechDocument version; the current version is the text and timing basis for later computation. Do not edit the archive while keeping a different copy of the source text hidden in cues.
- Sentences are derived from stable word anchors and structural rules. A sentence's **ID is separate from its content fingerprint**: whenever a sentence's text, word membership or semantic boundary changes, the linked translation must be checked for invalidation. An unchanged ID does not mean it is still valid.
- Manually added titles do not need a SpeechDocument.

**Body of `cuccut.speech/1`.** The persisted transcript body has the shape below (differences from the target model are listed in §9). Times are integers in units of `timescale`, and the clock is the media referenced by `sourceAssetId` (§4.6):

```ts
interface SpeechBody {
  schema: 'cuccut.speech/1';
  clock: 'source-asset';
  timescale: number;                    // when absent on read, defaults to 1 000 000
  engine: JsonValue | null;             // description of the recognition engine; open-ended
  createdAt?: string | null;
  speakers: Array<{ id: Id; name: string; hue?: number | null }>;
  words: Array<{
    id: Id;
    start: number;
    end: number;
    text: string;
    speaker?: Id;
    hidden?: true;
    timingQuality?: 'estimated' | 'missing';   // absent means the timing is trustworthy
    glue?: true;                                // no space before the previous word
  }>;
  sentences: Array<{ id: Id; first: Id; last: Id; paragraphStart?: true } | { id: Id; wordIds: Id[]; paragraphStart?: true }> | null;
  chapters: Array<{ id: Id; title: string; start: number; end: number }>;
  // The following fields are read and written by the caption and translation core; empty when absent
  userBreaks?: Record<Id, 'break' | 'no-break'>;
  autoBreaks?: Record<Id, Record<Id, 'break' | 'no-break'>>;   // keys are LayoutProfile IDs (§5.6)
  layoutProfileId?: Id;                                          // defaults to 'default' when absent
  paragraphBreaks?: Id[];
  stages?: {
    asr?: string;
    asrLayout?: string;
    polish?: string;
    segment?: string;
    chapters?: string;
    aligned?: { mode: 'script'; coverage: number; lowConfidence?: Id[] };
  };
}
```

- Words do not store the spaces between them. Spacing is computed at concatenation time by each script's rules: none for Chinese and Japanese, spaces between Latin letters, and per word for Hangul. `glue` records the cases the rules get wrong; concatenation, width measurement and line breaking all respect it. Words written by the transcription pipeline may carry a leading space; readers handle it as-is and do not rewrite it.
- The keys of `userBreaks` are words: `break` forces a line break before that word, and `no-break` suppresses the default break point here (§5.5). A word listed in `paragraphBreaks` starts a new paragraph, and paragraph boundaries are also sentence boundaries. If the word referenced by either is deleted, the entry is kept but has no effect.
- A word with `hidden: true` is excluded from the text, sentences and captions, but its word and timing are kept.
- When `sentences` is not null, it holds the saved sentences, and the bilingual export uses it to pair sentences (§5.3). The translation's sentence fingerprints do not read it; they are always derived from the words by the rules in §5.3. A writer that changes word IDs, order, hiding or paragraphing sets it to null, so no stale sentences remain.
- When there is no speaker, the word does not write `speaker`; a speaker ID must not be an empty string. `hue` of null is the same as the field being absent.
- The meaning of `stages` is in §5.5. `engine` is open-ended: the transcription pipeline writes the provider and model, legacy project imports write the old-format engine object, or null. When you need to know whether word timing is truly aligned, check `engine.alignedWords` first; if it is absent, check whether any words are `estimated` or `missing`.

**Mapping to the caption and translation core.** The caption and translation core (`speech-doc`, architecture design §7.9) uses the v2 `TranscriptDoc` in memory: times are floating-point seconds, and speakers, line breaks, paragraphs, hidden flags and translations are ID-keyed tables. The mapping between the two is lossless, with these rules:

- Conversion between ticks and seconds follows the rules in §2.10. On write-back, a word or chapter whose tick, converted to seconds, equals the new value exactly keeps the base document's tick.
- Source-asset facts (ID, local path, content digest, duration, sample rate) are taken from `AssetRecord` (§4.1). They are read in only and not written back. The document header's `language` maps to `lang`; when absent it is `und`. Language tags are copied verbatim on both sides.
- Words without a speaker are assigned to the reserved speaker `""` in `TranscriptDoc` and removed on write-back. `userBreaks` `no-break` maps to v2 `nobreak`. `paragraphBreaks` and `hidden` map to v2's ID-keyed tables. Entries in v2 whose value is false, and entries hiding words that do not exist, have no counterpart; they are dropped on write-back and reported.
- `engine` is read as its name (`name`, or `provider` when absent), its version and `alignedWords`. On write-back, if these three are unchanged, the base document's `engine` is kept as is; if any changed, it is written as `{ name, version?, alignedWords }`. For newly written words and words whose timing changed, `timingQuality: 'estimated'` is set when `alignedWords` is false, and not set otherwise. Words whose timing is unchanged keep the base document's mark.
- Fields that are in the base document but not in `TranscriptDoc` (unknown fields, `legacy`, `sentences`, `clock`) are carried back from the base by ID. v2's `readOnlyNote` and the format version number are not written into the body.

**Imported captions.** When importing SRT or VTT, only cue-level timing exists, so use `ImportedCaptionDocument` and do not fabricate word-level timing:

```ts
// Completed in this spec
interface ImportedCaptionDocumentVersion {
  id: Id;
  revision: Revision;
  language: string;
  sourceAssetRef?: VersionRef;         // the matching media asset, if known
  cues: Array<{ id: Id; text: string; span: { start: MediaTime; end: MediaTime } }>;
  originalFormat: 'srt' | 'vtt' | 'ass' | 'other';
  rawArtifactId: Id;
}
```

When word-by-word highlighting is needed, add an alignment task. Without a trustworthy word-level result, degrade to ordinary whole-sentence captions.

### 5.3 TranslationDocument

Each target language has its own document version, which stores: the version of the source SpeechDocument, sentence IDs, source content fingerprints, the complete natural translated sentences, the glossary version, review status, alignment blocks, and optional display rewrites.

```ts
interface TranslationDocumentVersion {
  id: Id;
  revision: Revision;
  language: string;
  sourceBasis: {                        // §5.7
    speechRef: VersionRef;
    sequenceId: Id;
    scopeLineage: Id[];
    editViewHash: string;
  };
  glossaryRef?: GlossaryRef;
  units: TranslationUnit[];
}

// Glossary used during translation (architecture design §7.9). Absent when no glossary was passed at call time and none is enabled in the video.
interface GlossaryRef {
  entries: Array<{                    // translation glossaries from the library that were used, with frozen versions
    library: 'glossaries';
    id: Id;
    version: number;
    contentHash: string;              // 'sha256:<hex>'
    name: string;
  }>;
  inline: { contentHash: string; count: number } | null;   // digest and count of the terms passed directly at call time
  terms: Array<{                      // terms that appeared in the source and their translations at translation time; entryId null means passed directly at call time
    entryId: Id | null;
    source: string;
    target: string;
  }>;
  termsTruncated?: true;              // more than 2000 terms appeared; not all were recorded
}

interface TranslationUnit {
  id: Id;
  sourceSentenceId: Id;
  sourceFingerprint: string;
  naturalText: string;
  displayRewrite?: {
    text: string;
    reason: string;
    reviewed: boolean;
    naturalFingerprint?: string;        // fingerprint of the natural translation the rewrite is based on
  };
  alignment: {
    basis: 'natural' | 'display-rewrite';
    correspondence: 'block' | 'sentence';
    blocks: AlignmentBlock[];
    sourceWordIds: Id[];
    textHash: string;
    split?: AlignmentSplit;             // display split on captions
  } | null;
  status: 'draft' | 'reviewed' | 'stale';
}

// Completed in this spec
interface AlignmentBlock {
  id: Id;
  sourceWordRange: { firstWordId: Id; lastWordId: Id };   // contiguous word range
  targetTextRange: { start: number; end: number };        // Unicode code point index, half-open
  confidence?: number;                  // 0–1: minimum weight of the alignment edges supporting the boundaries on both sides; unknown or deterministically constructed when absent
  flags?: string[];                     // 'local-reorder' (crossings within the block), 'anchor' (contains a hard anchor), 'weak' (soft edges only), etc.
}

interface AlignmentSplit {
  mode: 'independent' | 'many-to-one' | 'one-to-one';
  wordAnchored: boolean;
  correspondence?: 'block' | 'sentence';   // granularity explicitly stated by the writer; derived from mode when absent
  aligner?: string;                        // source of the alignment edges, e.g. 'deterministic/1'
  pieces: Array<{ text: string; from?: number; to?: number }>;   // non-empty; from ≤ to
  legacy?: { crossing?: true; cueIds?: Id[] };                  // left by legacy projects; saved only for lossless import
}
```

- On the source side, an alignment block covers a contiguous word range; on the target side, it covers a contiguous text range. Blocks are monotonic with respect to each other, and many-to-many mappings are allowed within a block.
- A display split may only fall on block boundaries. When word order crosses, prefer merging blocks. A `displayRewrite` is proposed only when there is a real display-budget problem, and it must not override `naturalText`.
- When alignment is missing, an explicit sentence-level degradation is allowed (`correspondence: 'sentence'`). Outputting fake word-level sync is not allowed. A sentence-level alignment without blocks is written as `{ basis: 'natural', correspondence: 'sentence', blocks: [], sourceWordIds: <the visible words of the source sentence>, textHash }`. When an agent writes a unit through `edits_apply` and its `alignment` is null, the Runtime fills it in this way from the source sentence (architecture design §3.5).
- Character ranges use Unicode code point indices, and splitting inside a grapheme cluster is forbidden. UTF-16 offsets in the UI must be converted.
- For Chinese, do not assume that spaces equal word boundaries. The normalization rules for punctuation and spaces must be versioned and shared by the engine.
- Alignment blocks express semantic correspondence; they are not the actual pronunciation times of the target language.
- `textHash` is `'sha256:' +` the lowercase hexadecimal SHA-256 of the UTF-8 bytes of the natural translation. When `split` is present, `targetTextRange` refers to the pieces' text concatenated in order; when absent, it refers to the text that `basis` points to (the natural translation or the display rewrite). The concatenation of pieces must match its normalized form, not be identical character by character. Block IDs are unique within a unit; blocks newly created by a writer are numbered in order as `b1`, `b2`, and so on.
- `split` records how the translation is cut into display pieces on captions. `independent`: the translation is cut by the target language's own conventions and is not mapped to source words. `many-to-one`: each piece corresponds to a contiguous run of source words, and `from` and `to` are inclusive indices. `one-to-one` appears only in legacy projects and is read as whole-sentence correspondence. When `wordAnchored` is true, piece indices and the source side of blocks refer to `sourceWordIds`, the visible words of the sentence at alignment time (after timeline cuts, this is the remaining subsequence). When false, piece indices refer to the sentence's currently visible words. When `correspondence` is not stated explicitly, `legacy.crossing`, `independent`, and pieces without word anchors map at whole-sentence level only; everything else maps by block. The derived value becomes `alignment.correspondence`. When the concatenation of pieces differs from the normalized text that `basis` refers to, or when a piece boundary does not fall on a block boundary, the split is stale and the display degrades to whole-sentence.
- `sourceFingerprint` is the content fingerprint of the caption and translation core, `<word count>:<first word ID>:<last word ID>:<digest>`. The word count and first and last words count only visible words. The digest is the FNV-1a of the visible word text in the sentence, in base 36. An empty string means no fingerprint was recorded, and it is not treated as stale. Any other form is treated as the original sentence having been edited.
- `displayRewrite.naturalFingerprint` is the fingerprint of the natural translation at the time the rewrite was written. If the fingerprint of the natural translation no longer matches, the rewrite is stale (delete the rewrite and the split for this sentence). When this field is absent, it is treated as stale.
- Mapping to the caption and translation core (§5.2): one translation document corresponds to one language of `TranscriptDoc`. `naturalText`, `displayRewrite` (`reason` maps to v2's `basis`), `split` together with its blocks, and `sourceFingerprint` correspond respectively to v2's per-sentence-ID `trans`, `transDisplay`, `transAlign` and `transSrc`. `/1` translations cannot be converted. `status: 'stale'` is written in v2 as `stale:<sourceFingerprint>` in `transSrc`; this does not equal any real fingerprint, so the core treats the sentence as edited source. On write-back, the prefix is removed and `stale` is restored. On write-back, a unit's ID, `reviewed`, `status` and extension fields are carried back from the base by sentence ID: units whose translation and rewrite are both unchanged keep the base's status, and changed ones become `draft`. For sentences without a split in v2, the base's alignment is used as-is when it has no `split` (if the translation changed, only `textHash` is updated). When the base is null, it stays null. Otherwise it is written as a sentence-level degradation record, with `sourceWordIds` taken from the base; without a base, the visible words of the source sentence derived by the core are used. The ID of a new unit is `t-<sentence ID>`, inserted between existing units by the position of its first word. The `sourceBasis` of a new language is supplied by the caller.
- When the `schema` of the body is `cuccut.translation/2`, the fields are strictly those of `TranslationDocumentVersion` above, with no more and no fewer fields than the optional ones listed there. `id` and `revision` are given by the document record and are not repeated in the body. When the whole transcript is translated together, `sourceBasis.scopeLineage` is empty. The sentences of the source SpeechDocument are derived from words by the caption and translation core's rules (`speech-doc/sentences`; the saved `sentences` are not read): break sentences after sentence-final punctuation; semicolons do not end a sentence; also break sentences at pauses of at least 1.8 seconds, at speaker changes, when a sentence holds 80 words, and at paragraph and chapter boundaries. Hidden words are not part of any sentence. A sentence ID is `s-<first word ID>`. `sourceFingerprint` is as above, and `editViewHash` is `'sha256:' +` the digest of the name of the derivation rule together with the IDs and fingerprints of all sentences. The worker that writes translations, the Runtime that checks them, and the UI use the same implementation (architecture design §7.9). When there are no alignment blocks, use sentence-level degradation.
- **Carry-over when the source document changes version.** When a video switches to a document made from a new transcription (switching the document, architecture design §6.6), all words in the new document have new IDs. Sentence IDs (`s-<first word ID>`) and fingerprints are therefore all replaced, and the old units' IDs, `sourceFingerprint`, alignment blocks and `sourceWordIds` all become invalid. For each language, a new TranslationDocumentVersion is written in the same transaction as the switch: the same document with a new version, `sourceBasis.speechRef` pointing to the new document version, `editViewHash` recomputed from the new sentences, and `glossaryRef` carried over unchanged. Units are produced by the following rules:
  - **Pairing.** Pairing is done on the media clock. A sentence's time span runs from the start of its first visible word to the end of its last visible word; for an old sentence, the same span is used. A new sentence that overlaps an old sentence's span is a candidate for it. Among all candidate pairs, first pair the one with the longest overlap; the two sentences paired this way no longer take part, and the process continues in order. This means each old sentence pairs with at most one new sentence, and each new sentence with at most one old sentence. An overlap shorter than half the duration of the shorter of the two sentences does not count as a pair. When carrying over a chapter or a range locally, pairing happens only within that range: word IDs outside the range are unchanged, and sentences and units are carried to the new version as they are.
  - **Normalized text.** When comparing source text, take the text formed by the sentence's visible words, remove punctuation and whitespace, apply NFKC, then apply case folding.
  - **Paired, normalized source identical.** Keep `naturalText`, `displayRewrite` and `status` (`reviewed` stays `reviewed`, `draft` stays `draft`). The alignment is downgraded to sentence level as `{ basis, correspondence: 'sentence', blocks: [], sourceWordIds: <visible words of the new sentence>, textHash }`; `basis` is kept, and `split` is removed. `sourceSentenceId` and `sourceFingerprint` are replaced with those of the new sentence, and the unit ID is `t-<new sentence ID>` per the rules above.
  - **Paired, source changed.** Keep `naturalText` for human reference, remove `displayRewrite` and `split`, and set `status: 'stale'`. The alignment is likewise downgraded to sentence level, and its ID and fingerprint are replaced with those of the new sentence.
  - **New sentence not paired.** A new unit `t-<new sentence ID>` with `naturalText` set to an empty string and `status: 'stale'`. The alignment is downgraded to sentence level.
  - **Old sentence not paired.** Not carried over. It remains in the old version, and undoing the switch brings it back.
  - Carry-over does not call the model. Stale units are retranslated by "refresh stale translations" (product design §5.10).
- A translation imported from a legacy project is `cuccut.translation/1`: `{ schema, sourceLanguage, units: [{ id, text, display?, source?, alignment? }] }`. The unit's `id` is the source SpeechDocument's sentence ID; `display` is the rewrite used for captions; `source` and `alignment` are kept as-is with the legacy project's fingerprint and alignment. Their format differs from §5.3's fingerprints and alignment blocks and cannot be converted. It is read only for videos that have already been imported. The bilingual export accepts it (paired by sentence ID, with members taken from the SpeechDocument's sentences). Newly written translations are always `/2`. Derived child videos (architecture design §3.5) upgrade it to `/2` when copying. The old fingerprints and alignment are not converted; only the translation sentence is taken. It is paired with sentences derived by the rules in this section, using the unit's words (the sentence with the same ID stored in the SpeechDocument, or when absent, the first and last words of `source`). The pairing uses shared words, requiring at least half of the shorter sentence's words to be shared, and pairs the pair with the most shared words first. A unit whose words are the same becomes `draft`; one whose words changed becomes `stale` (the translation is kept). The alignment is written as a sentence-level degradation record. `display` is not carried over (it has no fingerprint on which the rewrite is based). Old units that cannot be paired are not carried over, and sentences with no old translation do not get a unit.
- The bilingual export, when reading `/2`, pairs units to the master document's sentences by `sourceSentenceId`. The translation text is `displayRewrite.text`, or `naturalText` when there is no rewrite. The sentence's members are taken from `alignment.sourceWordIds`. If these are not exactly the same as the remaining words after cuts, the unit is not paired. For a unit whose `alignment` is null, the members are the visible words of the sentence with ID `sourceSentenceId`, derived from the source SpeechDocument's words by the rules above. When `sourceFingerprint` is non-empty and differs from that sentence's fingerprint, the unit is treated as stale and not exported (deriving sentences requires `editor-wasm`; without a build, the export fails rather than silently dropping translations). When the source SpeechDocument has no sentences, the export splits sentences from these members (the same sentences as at translation time). Units with `status: 'stale'` are not exported. When building a caption layer for translations that have no Worker caption entries, the times of the original sentence's member words are taken from `alignment.sourceWordIds`, the same way; units whose `alignment` is null are not used for this.
- Staleness after the glossary changes: `glossaryRef.terms` records the translation each term had at the time. For a term that appears in a unit's source, if, under the current version of its table in the library in `entries`, the translation has changed or the term was deleted, or a term newly added to that table appears in this sentence, the unit is stale due to the glossary (`glossary-changed`). When an entire table is deleted, every unit containing one of its terms is stale. Only units where terms appear are affected; other units are unaffected. `inline` terms are not affected by the library. Staleness is computed at read time (when the dubbing pipeline checks translations, §7.2) and does not rewrite this document's `status`.
- The document header's `sourceDocumentId` points to the source SpeechDocument. When written by a fixed pipeline, the document's `extensions.engine` records the provider, model, model version and prompt version, and `extensions.pipeline` records the pipeline, task and executing principal.

### 5.4 CaptionProgram

CaptionProgram is a display rule, not a second copy of the source text.

```ts
interface CaptionProgram {
  id: Id;
  revision: Revision;
  sequenceId: Id;
  source: {
    speechRef?: VersionRef;
    translationRef?: VersionRef;
    importedCaptionRef?: VersionRef;
  };
  language: string;
  scope: { itemIds: Id[] };              // the exact media instances this applies to; never guessed from same-named files
  timingBasis: 'source-speech' | 'dubbing-audio' | 'imported-cues';
  layoutProfileId: Id;
  styleRef: VersionRef;
  userOverrides: CaptionOverride[];
}
```

**Projection.** The caption parser projects "source word time → the timeMap of the given media instance → sequence time" into `ResolvedCaptionCue[]`. The result is a derived cache and cannot be edited independently of the source words. Document edits, instance splits, trims and speed changes all update references through a transaction, and the result is then re-projected.

**Occurrence.** When the same media is used more than once, one word can produce several display occurrences. Each occurrence is identified by `sourceWordId + itemLineage + occurrenceId`, not by `wordId` alone. After a split, the lineage mapping must be maintained. Captions must never be attached automatically to another clip that happens to reference the same media.

**Display sampling.** The parser first obtains the exact sequence interval, then decides whether a Cue is visible at the actual sample time of the current preview or export. Changing the export frame rate only changes display sampling; it does not create a new speech or translation version.

### 5.5 Manual edits and display overrides

| What the user does | Where it is written |
| --- | --- |
| Fixes a typo | A new version of the SpeechDocument |
| Edits a natural translation sentence | TranslationDocument |
| Changes a line break | User pin (`userBreaks` or `CaptionOverride`) |
| Drags a caption's time | A timing override with a range |

```ts
// Added in this spec
interface CaptionOverride {
  id: Id;
  kind: 'line-break' | 'timing' | 'text-display' | 'hide';
  anchor:
    | { kind: 'source-word'; wordId: Id; occurrenceId?: Id }
    | { kind: 'item-local'; itemId: Id; localOffset: MediaTime }
    | { kind: 'sequence-fixed'; sequenceId: Id; span: FrameSpan };
  value: JsonValue;
  pinned: true;
}
```

- A user pin takes priority over automatic layout. Automatic optimisation must never overwrite boundaries set by hand.
- Every override must declare its anchor. When the source word is cut, the override shows as `orphaned` and is no longer output by default; it must never silently jump to 0 s.
- Captions with `sequence-fixed` do not ripple when the voiceover moves; the UI marks them with a "fixed time" badge.
- When the script is replaced (§5.3, "carry-over when the source script changes version"), pins are re-anchored by time in the same transaction as the replacement. A `source-word` anchor on an old word takes the midpoint of that word's source-time interval. If the midpoint falls inside a new word's interval and the two words have the same normalised text (§5.3), the anchor moves to that new word; otherwise the override becomes `orphaned`. An old word without source time cannot be re-anchored. The words referenced by the transcript body's `userBreaks` and `paragraphBreaks` are mapped to new words by the same rule; entries that cannot be mapped are kept but have no effect (§5.2). The anchors of `item-local` and `sequence-fixed` do not depend on the script and are left unchanged.
- The `stages` of the transcript body (§5.2) record a fingerprint of each automatic step at the moment it was committed. They are the basis for deciding whether a person has edited the content afterwards. `asr`, `polish` and `chapters` are content fingerprints of the full text at transcription completion, polish commit and chapters commit respectively. `asrLayout` is the fingerprint of line breaks, paragraphs and hidden words at transcription completion. `segment` is the fingerprint of the word-ID sequence at segment commit. If the current fingerprint differs, someone has edited it afterwards, and the automatic step does not overwrite that part. `aligned` means the word times come from forced alignment of the script (`coverage` is the proportion of script characters covered by the alignment, and `lowConfidence` marks words whose duration collapsed to 0 and need review); it is removed when recognition is run again. The fingerprint format is decided by the party that writes it; the reader only compares for equality.

### 5.6 LayoutProfile, styles and export

```ts
// Added in this spec
interface LayoutProfile {
  id: Id;
  language: string;
  maxLines: number;
  readingBudget: { soft: number; hard: number; unit: 'cps' | 'cpl' | 'wpm' };
  minDuration: MediaTime;
  maxDuration: MediaTime;
  safeArea: { left: number; top: number; right: number; bottom: number };   // normalised
  breakRules: string[];
}

interface CaptionStyleBody {
  // Target contract `cuccut.caption-style/1`: each of seven independent dimensions takes one value; a preset is just a set of values.
  // Dimension definitions, the current word mode (including KTV colour sweep), the inverted-pyramid `layout.sequence`,
  // and the compilation to Studio style are in docs/design/subtitle/caption-style-model-design.md.
  schema: 'cuccut.caption-style/1';
  typography: Typography;          // font, weight, size (as a proportion of the short edge), line height, letter spacing, case, alignment
  surface: Surface;                // text colour, outline, shadow, glow, background plate, per-word background block
  layout: Layout;                  // mode 'line' | 'sequence' (inverted pyramid), anchor, y, width, line count
  activeWord: ActiveWord;          // required: none | color | box | scale | lift | underline | sweep,
                                   // plus three states for spoken / not-yet-spoken words; tracks without word times are always none
  motion?: Motion;                 // enter / exit / loop, trigger 'enter' | 'spoken'
  emphasis?: EmphasisLook;         // look of emphasised words; which words are emphasised is recorded on the instance (§3.8)
  preset?: { id: Id; revision: Revision };
}
```

- The numbers in LayoutProfile are product presets. They do not claim to be the currently mandated standard of any platform. Preview, caption list, checks and export all use the same profile.
- The automatic layout result for source captions is stored per profile: `autoBreaks[<profile ID>]` in the transcript body (§5.2). Switching profile does not overwrite the result of another. The profile in use is recorded in `layoutProfileId`; if absent, it is `default`. For a word, the user's `userBreaks` take priority over automatic pins.
- Style is kept separate from text content. Changing the style does not re-recognise anything. Changing a source-language line break does not trigger a full re-translation. Changing the display text of one English sentence does not automatically queue a speech synthesis of the whole film.
- Output supports burn-in, SRT and VTT. ASS is implemented in P1 as a mapping of format capabilities. Exporting only a caption file does not trigger a video re-encode.
- Burning in captions is necessarily a composite over the picture. It must not be described as "does not change the video bitstream".
- Captions already burned into the source footage live in the source pixels. Turning off the new caption layer does not make them disappear. Covering, reconstructing or repairing them must declare the nature of the new operation.
- Imported captions without trustworthy word times can be used as ordinary captions, but no pseudo-precise per-word animation is output for them.

**Persisted style body.** `CaptionStyleBody` is not yet persisted. At persistence time, a deterministic compilation layer folds it into Studio style (design doc §8); the kernel does not change. Today, the body of a caption style document is one of the two forms below, and the render kernel reads both:

- Studio style (`cuccut.legacy-studio-style/0.1`): `style` is the v2 caption style. Per-word animation is written in `style.wordAnimation` (or `style.anim`), and `catalogId` refers to one cell of the per-word animation catalogue.
- Boxed-caption style (`cuccut.boxed-caption-style/<N>`): `canvas` is the pixel size of the canvas the style belongs to, `box` is the caption box (in pixels relative to the canvas centre), and `style` holds font size, colour, alignment, background plate and other appearance settings. At render time it is converted into an equivalent Studio style. `style.animationPresetId` selects the per-word animation; its value is a catalogue id, and it is drawn with that cell, the same as when the same cell is selected in Studio style. Omitting it means no animation.
- The per-word animation catalogue has 19 cells: `none`, `boxHighlight`, `flipClock`, `highlight`, `karaoke`, `impact`, `reveal`, `floatInTop`, `floatInBottom`, `scaleIn`, `dropIn`, `impactPop`, `colourHighlight`, `rotateFlipClock`, `rotateHighlight`, `stack`, `stomp`, `bounce`, `paint`. `reveal` shows text word by word: words not yet spoken are not drawn, and once one is spoken, the whole of it is shown. When a sentence has no word times, display spacing is applied first, then the sentence is split by the whitespace rules of §3.8. A sentence that still has no spaces after spacing is treated as one word, and the whole sentence appears from the start.
- When the engine writes a boxed-caption style, it checks that `style` is an object, and that `style.animationPresetId`, when present, is an id in the catalogue. Otherwise the entire document is rejected (`INVALID_OPERATION`). The body of a Studio style is not checked; when the kernel meets an unrecognised `catalogId`, it draws the animation by its name.

**Display spacing.** Preview and burn-in insert one half-width space where Chinese characters, kana and ASCII letters or digits are directly adjacent (for example `让Claude创建Artifact` → `让 Claude 创建 Artifact`). The original, the translation and imported captions share this rule, which does not depend on the language tag, the style kind or the `punct` switch. Existing spaces and line breaks are kept, and no extra space is added next to punctuation. Text is split by space, LF and CR. Fragments containing Hangul, as well as paths and URLs, keep the v2 protection rules and their spacing is kept as is (for example `AI가`, `2박`, `600원`); other fragments are spaced as usual. This projection does not modify the caption text, transcript word IDs, word times, translation alignment ranges, or the exported SRT and VTT.

**Default preset.** Captions without a style document are drawn with the default preset. The Studio style that is seeded when a new caption layer is created (the first time a style is edited in the editor, when a gallery card is applied, or when a bilingual caption is put on screen; agents and fixed flows creating bilingual caption layers also use this one) is also this one. It is the "Classic" livery of a new project plus one switch, and it does not depend on language:

- White text, `fontWeight` 700, black outline `textOutline: { on: true, color: '#000000', width: 14 }` (`width` is converted to stroke width as a proportion of the font size, so the outline scales with the font), black drop shadow `dropShadow: { on: true, distance: 0.08, rotation: 45, blur: 0.12, opacity: 0.9 }`; background plate off (`background: false`). On light footage it stays legible through the outline and shadow. Current-word colour change `wordAnimation: { animationId: 'magic-wbw', animationName: 'Color', catalogId: 'colourHighlight', active: { color: '#18E1D6' } }` (the current-word style that comes with the "Classic" card in the gallery; see [subtitle style model design](../design/subtitle/caption-style-model-design.md) §4). A line without word times is still drawn as a whole line.
- `punct: true`: ordinary commas and full stops are replaced by one space in burn-in and preview (not in ASCII notations such as numbers and URLs). A sentence consisting only of punctuation is not drawn. The `punct` default in Studio style (when not written) is also true. When the user switches it to false in the "Punctuation" setting of the properties page, the text is drawn as written. This projection does not modify the transcript body or the exported SRT and VTT. When a caption is created in the interface, the user's remembered properties can override the preset (product design §5.9).
- When a style document exists, it is drawn as written. Keys it omits fall back to the kernel's defaults (no outline, `punct` true); the default preset is not used to fill them. Therefore, in existing projects, a style document whose body is empty (`style: {}`) keeps its current appearance.

**Result validation.** When a translation task returns missing sentences, duplicate IDs, dropped numbers or terminology conflicts, only the parts that pass the contract validation are accepted; nothing is overwritten unconditionally. Terminology is resolved in the order "task override → video settings → explicitly shared settings", and the source of each term is shown.

### 5.7 EditedSpeechView

The original SpeechDocument describes the complete source recording. Removing a clip from the timeline does not erase the words in it.

`EditedSpeechView` is the effective word stream derived from the sequence's kept ranges, timeMap and occurrences. It is not another transcript whose times can be changed freely.

| Case | Result |
| --- | --- |
| The source sentence is kept whole and only moved | The natural translation can be reused; caption times are re-projected |
| Only part of the source sentence is kept, the sentence order changes, or the clip is used more than once | A new semantic fingerprint is computed for the valid sentences and occurrences |

`TranslationUnit.sourceFingerprint` binds to this **valid sentence**, not merely to the version of the original document. The document header records `sourceBasis`: `speechRef`, `sequenceId`, scope lineage and `editViewHash`.

Existing whole-sentence translations may be kept for other instances, but they must not be used unchecked for an output that has been trimmed to half a sentence. Words without usable time (zero duration, or no text) could never enter captions or exports anyway, so their absence does not count as trimming a sentence in half, and does not prevent a whole-sentence translation from being used. Hidden words do count as cut. Anchors for the dubbing script and semantic diagrams likewise bind to the effective view. Pure time shifts and actual content changes trigger different invalidation scopes (architecture design §10).

---

## 6. Talking-head editing

### 6.1 Constraints

- Suggestions can be accepted or ignored one by one. Choices in the script map to the timeline. Deletions can be restored, and every step can be undone.
- The agent judges semantics. Cut points, breath padding, quantization and audio-video sync are computed by the engine.
- Tasks for subtitle translation and semantic-cut suggestions receive word and sentence IDs and text first. Do not let the model invent exact timestamps.

### 6.2 EditorialProposal

An editorial proposal is a document with `kind: 'editorial-proposal'`. `sourceAssetId` points to the source asset being cut, and each source asset has at most one proposal. Body:

```ts
interface EditorialProposalBody {
  schema: 'cuccut.editorial-proposal/1';
  timescale: number;                      // ticks per second
  clock: 'source-asset';                  // moments are on the clock of the source asset being cut
  speechRef: VersionRef;                  // transcript version the detector read
  suggestions: Array<{                    // sorted by t0; may overlap
    id: Id;
    kind: 'filler' | 'pause';
    t0: string;                           // source interval [t0, t1) proposed for removal; integer ticks written as decimal strings
    t1: string;
    wordIds?: Id[];                       // filler: words in the interval
    afterWordId?: Id;                     // pause: word before the pause
    text: string;                         // text inside the interval; empty for a pause
    reason: string;                       // short sentence written by the detector, shown as-is
    detail?: string;
    confidence?: number;                  // 0–1; absent when the detector cannot give one
    status: 'pending' | 'accepted';
  }>;
}
```

- Decided: a proposal records only the source intervals suggested for removal, their categories, the matching text and the confidence. This is the minimal shape here. When `putDocument` writes it, it checks the ticks, `0 ≤ t0 < t1`, the ordering, the range of `confidence`, and that IDs are not duplicated.
- Decided: `proposeCuts` detects filler words and long pauses from the source asset's transcript, reusing v2's detection (`timeline::detect`) and default parameters. Pauses of 0.8 s or more and under 3 s are compressed to 0.3 s (keeping an extra 0.1 s at sentence end, at most 0.5 s). Pauses across chapters are left alone by default. Filler words follow a table of Chinese and English words, including soft fillers that count only at sentence breaks. Hidden words and words without time do not take part. Anything already fully inside a cut, or beyond the asset's duration, is not proposed. A suggestion's ID is determined by the word it belongs to and does not change when re-proposed. Re-proposing replaces the whole proposal and does not change the timeline. v2 has no detection for duplicated takes or misspoken-then-redone takes, so those two kinds are not proposed.
- Decided: `acceptCutSuggestions` compiles accepted suggestions into cuts (same as `addCuts`, §6.7; a cut's `ref` is the suggestion's ID) and marks them `accepted`, **committed in one transaction**, so undo reverts them together. Cuts whose gap to an existing cut is no more than 0.02 s are merged into one per §6.7, keeping the earlier one's ID and origin. So a suggestion merged in does not appear in the cut's `ref`.
- Decided: if the transcript has changed after the suggestions were proposed (the current version is not `speechRef`), the suggestions are stale. Accepting rejects the whole batch (`details.rule: 'proposal-stale'`), and they must be proposed again. Restoring a cut does not change the status in the proposal. The cut set is the basis for what has been removed.
- A cut suggestion is not the video's timeline. When a suggestion is accepted, the result is a definite set of cuts plus ordinary video and audio instance changes, **committed in one transaction**.
- EDL is for exchange and review, and can be exported from the current instances. The first version does not allow maintaining a long-lived, writable EDL that automatically overwrites the timeline on screen.
- Suggestion records keep the reason and the affected interval. If a clip is edited by hand later, the old suggestions must be re-validated against the latest instances and readSet.
- Restoring cut material is a new transaction. An old timeline snapshot must not overwrite elements added later.

### 6.3 Cut points

After the model points out “delete this filler word”, the engine chooses cut points from trusted word times, VAD and energy analysis, context and the available silent regions. When adjacent words are run together and there is no safe boundary, the suggestion is marked “not recommended for auto-cut” rather than cut hard.

- Video cuts are hard by default. Audio may use short fade-outs and fade-ins inside the kept intervals.
- When an overlapping crossfade is needed, handles must be declared explicitly, and it must be checked that deleted words have not been pulled back in.
- Do not assume that a visual dissolve, an audio crossfade and the kept duration in an EDL are naturally equivalent.
- De-click fades on audio do not implicitly change the visual total length.

### 6.4 Ripple and semantic attachment

Attached elements decide whether they move with a cut according to `FollowPolicy` in §3.16. Attached instances placed at a moment default to `follow-cuts`. Cut commands must declare the set of affected tracks and how locked tracks are handled.

### 6.5 Risk grading

Obvious silence removal and edits to a speaker's viewpoint carry different risks. Connected-speech boundaries, negations, unit words and preconditions must be reviewed, and must not be deleted automatically just because a string matched. Batch acceptance shows the category, count, range, how locked tracks are handled, and the semantic impact.

The script panel's mode (product design §5.7) determines what the delete key means. Only the “Cut audio and video” mode proposes or executes cuts for word anchors. Switching modes never silently changes the meaning of an old selection.

### 6.6 Worked recalculation

A 12-second clip at 30 fps, deleting source [4, 6) seconds.

- The remaining [0, 4) and [6, 12) join into 10 seconds. Source [0, 4) sits at video [0, 4), and source [6, 12) sits at video [4, 10).
- A subtitle occurrence at source [8.2, 9.0) projects to video [6.2, 7.0), which is frames [186, 210).
- Restoring a cut creates a new transaction, and does not wipe supplementary footage added later out of an old snapshot.

### 6.7 Cut set

The intervals removed by spoken-word cutting are recorded in a cut set, for per-cut restore and re-validation. On the timeline, instances remain ordinary. The cut set says which source intervals were removed, and the layout of the instances is its result.

```ts
// Document kind: 'cut-set' (§4.6). The document header's sourceAssetId points to the source asset being cut.
interface CutSetBody {
  schema: 'cuccut.cut-set/1';
  timescale: number;                   // ticks per second
  clock: 'source-asset';               // moments are on the clock of the source asset being cut
  scopeItemIds: Id[];                  // instances laid out by this cut set: the source asset's video and audio instances on the sequence
  cuts: Cut[];                         // sorted by t0; non-overlapping
}

interface Cut {
  id: Id;
  t0: string;                          // source interval [t0, t1) removed; integer ticks; 0 ≤ t0 < t1 ≤ asset duration
  t1: string;
  ref?: Id;                            // origin: ID of a suggestion in the EditorialProposal (§6.2)
}
```

- One source asset has at most one cut set.
- **Adding a cut.** When a new cut is no more than 0.02 s from an existing cut, they merge into one, keeping the earlier one's ID and origin. Dragging a cut's boundary does not merge. It only requires that the cut not overlap other cuts (touching edges is allowed).
- **Applying and restoring** are both VideoEngine transactions. The same transaction changes the cut set and rearranges the instances in `scopeItemIds` according to the new kept intervals. Attached instances move according to their own `FollowPolicy` (§3.16; attached instances placed at a moment default to `follow-cuts`). Restoring a cut is a new transaction, and does not overwrite later changes from an old snapshot.
- **Scope.** The cut set's instances are those in `scopeItemIds` plus the instances whose lineage points back to them (the right-hand segment from a split). If none of them is on the sequence, take all video and audio instances on the sequence that play this asset. Their source clocks must be a linear mapping with positive rate, otherwise the whole batch is rejected. On write-back, `scopeItemIds` holds the rearranged instances, sorted by sequence start and then by ID.
- **Rearrangement.** The newly removed source intervals are mapped through each instance onto the sequence. Start and end are each quantized to the nearest frame, and anything under one frame does not move. Overlapping ranges on the same track are merged into one segment. The tracks where such a segment arises are **the cut tracks**. On them, ripple delete per §6.4 applies (an interval covered by an instance is split and the middle removed, and later content moves forward). Instances on other tracks move according to `FollowPolicy`. Video and audio placed in sync map to the same interval. If intervals on different tracks partly overlap, the whole batch is rejected (`INVALID_OPERATION`, `details.rule: 'scope-misaligned'`). Instances removed along with cuts are listed in the receipt's `impact.removedByCuts`.
- **Chapters follow cuts.** Decided: when a cut is applied, the sequence's chapters move according to the segments just removed (positions before rearrangement, in frames). A chapter after a removed segment moves earlier by the removed length. A chapter that falls inside a segment goes back to the segment's start. If several chapters land on the same frame, only the one with the latest original start is kept and the others are deleted, since they were entirely cut. When a cut is restored, chapters after the seam move later by the length put back. A chapter sitting exactly on the seam does not move. It may be the chapter at the start that was cut away, or a chapter moved onto the seam after the cut, and the engine cannot tell which. Leaving it in place avoids an empty stretch at the start of the sequence with no chapter. If no seam is found, chapters do not move. Chapters are not affected by locks (§3.13).
- **Seam on restore.** When the source end of the left instance meets the cut start, and the source start of the right instance immediately following on the same track meets the cut end (each within a tolerance of one frame, converted to the source clock), the source interval between them is put back at the seam. On the cut tracks, instances starting at the seam move later, and the left instance is extended. If the two segments can be merged under the `joinItems` rules, they are rejoined into one; otherwise they stay as two. With only a left instance, it extends to the cut end. With only a right instance, it extends back to the cut start. If the same seam needs different lengths put back on different tracks, the whole batch is rejected (`scope-misaligned`). If no seam is found, only the cut set changes, the cut is listed in the receipt's `impact.cutsNotRelaid`, and instances stay put.
- If a track or an instance to be moved is locked, the whole batch is rejected (`TARGET_LOCKED`). Nothing is skipped.
- **Re-validation.** When an instance is edited by hand outside a cut (trimmed, moved, or asset swapped), the parts inconsistent with the cut set are listed in the receipt. The user or agent decides whether to re-apply or delete the corresponding cuts. The engine does not silently change them back.
- A cut written when accepting an editorial suggestion (§6.2) carries `ref`. When a suggestion is ignored or restored, the corresponding cut is found by `ref`.
- Seconds-form inputs (v2's `t0` and `t1`) are read as exact rationals in their shortest decimal form, then converted to `timescale`. `timescale` is chosen so that it represents all cuts exactly, with no rounding.

Field sources: `Cut` in `schema.rs`; `CutSet`, `CUT_MERGE_GAP`, `insert_cut`, `restore_cut` and `retime_cut` in `cuts.rs`. For chapter movement, see `close_spans` and `open_gap` in `crates/video-engine/src/chapters.rs`.

---

## 7. Dubbing, versions and sound events

### 7.1 Store the three texts separately

| Text | Responsible for |
| --- | --- |
| `naturalTranslation` | Semantic completeness |
| `subtitleDisplayRewrite` | On-screen display |
| `dubbingScript` | What is spoken, tone and duration |

All three point to the same source sentence and do not overwrite each other. Editing the English subtitle does not unconditionally require buying another round of speech synthesis. A task proposal is produced only when the user explicitly asks for “synced dubbing”.

### 7.2 DubbingPlan

```ts
interface DubbingUnit {
  id: Id;
  sourceSentenceIds: Id[];
  sourceFingerprint: string;
  script: { text: string; revision: Revision; reviewed: boolean };
  speakerBindingId: Id | null;
  targetAnchor: SemanticAnchor;
  timingPolicy: 'fit-fixed-slot' | 'ripple-visuals' | 'manual';
  voiceAssetRef?: VersionRef;
  alignmentRef?: VersionRef;
  actualSamples?: string;
  sampleRate?: number;
  status: 'draft' | 'generating' | 'ready' | 'needs-fit' | 'stale' | 'failed';
}

interface DubbingPlan {
  id: Id;
  revision: Revision;
  sequenceId: Id;
  language: string;
  translationRef: VersionRef;
  units: DubbingUnit[];
  originalDialoguePolicy: 'mute' | 'duck' | 'keep';
  backgroundPolicy: 'existing-stems' | 'separate-stems' | 'replace' | 'none';
}
```

- The **real sample length** returned by speech synthesis is the basis for audio duration.
- Per-word subtitle timing comes from the time markers in the generated audio, or from one more forced alignment run on the generated audio. The source language's word timings must not be reused.
- When dubbing is time-stretched, subtitle alignment must go through the same mapping.

**The dubbing plan written when translating for dubbing** (architecture design §7.9). Document kind `dubbing-plan`; the body's `schema` is `cuccut.dubbing-plan/1`. `id` and `revision` are recorded by the document and are not in the body. Compared with the interface above:

- The plan has two extra fields. `groupId` is the ID of this dubbing group, the same as on its instances. `extensions['cuccut.dub']` includes `voice { providerId, modelId, voice }` used for synthesis (the parameter's or the model's default voice, used for speakers without a binding); the voice for each speaker, `speakers[] { speakerId, voice, voiceSource, available, units }` (`speakerId` null means a sentence with no speaker; `voiceSource` is `video` for a binding in the video, `params` for parameters, `default` for the model default); and `mutedItemIds`, the instances muted in this step (the original-sentence instances when the original audio is muted, or the original-sentence instances replaced by two tracks after separation; those already muted before do not count). `translationRef` is the translation version used. `backgroundPolicy` is `separate-stems` (if separated) or `none`.
- One dubbing unit per translation unit, with `id` `d-<translation unit ID>`. `sourceSentenceIds` has exactly one sentence. `script` is the translation and its version, with `reviewed: false`; for a stale unit, `script: null`. `speakerBindingId` is the ID of the speaker whose video binding (`library-selection`'s `speakerVoices`, §4.6) this sentence uses. For sentences using a parameter or default voice, and for stale units, it is `null`. `targetAnchor` is the start of the original sentence (`kind: 'sentence'`, `edge: 'start'`). `timingPolicy` is always `fit-fixed-slot`.
- When translation is carried over from the script (§5.3) by switching to a script, the dubbing plan writes a new version in the same transaction, and `translationRef` points to the carried-over translation version. Units whose source is unchanged and whose translated sentence is unchanged move to the new ID `d-<new translation unit ID>`. `sourceSentenceIds`, `sourceFingerprint`, `targetAnchor`, `extensions['cuccut.dub'].translationUnitId`, and the `unitId` in the dubbing instance's extensions are replaced with those of the new sentence and new unit. Audio, instances and other fields are kept. `script.revision` remains the translation version used at synthesis, which differs from the plan's `translationRef`. The UI uses this to show a possible mismatch (the same kind of hint as when a translation is edited, product design §5.7), and does not re-synthesize automatically. Units whose source changed, so their translation became stale, get `status: 'stale'`, `script: null` and `staleReason: 'source-changed'`. Audio instances already placed stay on the timeline. Units whose old sentence was not dubbed are not carried over, same as the translation.
- `actualSamples` and `sampleRate` are written only on units placed on the timeline, as the measured values of the first audio segment. `voiceAssetRef` and `alignmentRef` are not written. Audio is found from the instance, and synthesis product IDs are in the unit's extensions.
- `status` uses only five values. `ready` means placed on the timeline. `needs-fit` means sped up to the limit, but the silence after it still cannot fit. `draft` means the original sentence is not on the timeline. `stale` means the translation is stale: either not synthesized, or synthesized before a script switch, so the audio no longer represents the current translation. `failed` means the speaker binding's voice is unavailable; nothing was synthesized, and it was not switched to another voice.
- A unit's `extensions['cuccut.dub']` holds `translationUnitId`. Non-stale units have `voice` (the voice used for this sentence: `library:<id>` or the Provider's voice ID) and `voiceSource`. When placed, they have `fit` (`fit`, `tempo`, `extended`), `tempo` and `artifactId`. When it does not fit, `overflowSeconds`. When not on the timeline, `offTimeline: true`. When the voice is unavailable, `voiceUnavailable { speakerId, voice, code, reason }` (`code` such as `VOICE_CLONE_REQUIRED`, `VOICE_CONSENT_REQUIRED`, `VOICE_NOT_FOUND`; `reason` such as `missing`, `stale`, `no-consent`, `removed`). When stale, `staleReason` (`marked-stale`, `sentence-gone`, `source-changed`, `glossary-changed`, `empty`).
- A dubbing instance is an `audio` instance on a new audio track named “配音（<语言>）” (“Dub (<language>)”), with `role: 'dub'` and `extensions['cuccut.dub']` set to `{ groupId, language, unitId }`. When separated, the separated background sound sits on another audio track named “背景声（<语言>）” (“Background (<language>)”), with `role: 'music'` and extensions `{ groupId, stem: 'background' }`. When the original is ducked, the vocals also get their own track, “人声（<语言>）” (“Vocals (<language>)”), with `role: 'a-roll'` and extensions `{ groupId, stem: 'vocals' }`, and ducking targets it. The instances on the two tracks sit at the same position and the same source interval as the original-sentence instances they replace. Tracks have no language field. The language is written in the track name, the instance extensions and the plan. Export selects the sound source by these markers (command and protocol spec §4.4).

### 7.3 Length fitting

The default is `fit-fixed-slot`, which keeps the duration of the original picture. Flow:

```text
Rewrite the spoken script under term and meaning constraints → speech synthesis → measure
  → bounded speaking-rate adjustment or time stretch → re-align → quality check
```

The bounds of the adjustment are set by user or video policy (for example, “adjust by at most N percent”). This threshold is only a product rule; it does not guarantee how the result sounds.

If it still does not fit, return `needs-fit` with a clear proposal: rewrite the script, extend the static or code frames that are allowed to be extended, or create a language version with a different pacing. Do not speed up the whole narrated picture by default, and do not cut off the last few words.

### 7.4 Generation and local maintenance

- The given audio file is the default timing basis. Speech is not re-synthesized automatically.
- For text tasks, confirm the script and the voice first. You may audition a representative short segment before generating within an explicit scope.
- Old audio may be kept as a candidate, but it must not be labeled as in sync with the new script.
- Speech synthesis for changed dubbing text happens only when the user explicitly asks to “sync the voice,” or when the original task contract already includes this step.
- Changing the provider does not silently change the voice identity.
- After cutting narration: a complete sentence may only be re-projected when it is moved. Deleting words inside a sentence requires checking the effective meaning. Never cut the target-language pronunciation directly with source-language cut points.
- While automatic repair is not yet available, the `stale` and `needs-fit` hints remain constraints for all stages.

### 7.5 Real limits of audio

- When the source video has only a mixed track of “voice + music + ambience,” muting it removes all three. To keep the background, use existing separate stems, or add a separation task and check the separation artifacts. Do not claim that flipping one switch perfectly removes the original speech.
- Dubbed voice and original audio do not play at equal volume by default.
- Speaker diarization, voice identity, and the people on screen are three different inferences. Without evidence, keep the identity unknown and let the user bind the voice.
- Voice cloning and uploading to external services are separate approval items. A request to “translate subtitles” does not implicitly authorize them.

### 7.6 LocalizationSet

One picture sequence can have several language versions. Each version selects its caption streams, dubbing plan, text overrides and audio routing.

```ts
// Completed by this spec
interface LocalizationSet {
  id: Id;
  revision: Revision;
  sequenceId: Id;
  language: string;
  captionProgramIds: Id[];
  dubbingPlanId?: Id;
  textOverrides: Array<{ itemId: Id; propertyPath: string; value: JsonValue }>;   // allowlisted fields only
  audioRouting: { originalDialogue: 'mute' | 'duck' | 'keep'; trackOverrides?: Record<Id, { muted: boolean; gainDb?: number }> };
}
```

- Overrides are allowed only on allowlisted fields: language text, captions, dubbing and audio routing.
- When structural differences are large, fork a new sequence (`forkSequence`) and keep the parent version and the source relation. Do not maintain an endlessly complex set of override languages.
- One version may use source-language captions, while another uses translated text plus dubbing. Switching versions must not delete the resources of other languages.
- Changes that only involve picture transforms take effect in every shared version. Operations that change timing must provide a dependency invalidation summary for all languages.

### 7.7 CanvasVariant

```ts
// Completed by this spec
interface CanvasVariant {
  id: Id;
  revision: Revision;
  baseSequenceRef: VersionRef;
  canvas: { width: number; height: number };
  layoutOverrides: Array<{ itemId: Id; place?: Place; crop?: Crop; mode?: 'fullscreen' | 'pip'; fit?: 'cover' | 'contain'; hidden?: boolean }>;   // §3.5
  parameterOverrides: Array<{ itemId: Id; parameters: JsonValue }>;      // responsive parameters of code composition
  captionLayoutProfileId?: Id;
}
```

- An aspect-ratio variant references a base sequence, plus explicit canvas, layout, crop and parameter overrides. At compile time it produces a derived snapshot, not another main timeline that can be written freely.
- When structural differences are large, fork the sequence and keep the parent version.
- When the user says “only change the English vertical version,” the command must carry `variantId` and the override scope.
- When a shared font or a natural translated sentence changes, the related projections re-lay out. Speech recognition is not redone. Changes that affect timing must list the dependencies of all languages.
- When the code package does not declare responsive capability, explicitly use contain or cover, or propose a refactor. Changing the aspect ratio does not mean the camera will automatically recompose the shot.

### 7.8 SyncGroup

```ts
// Completed by this spec. P1
interface SyncGroup {
  id: Id;
  masterClock: { assetRef: VersionRef } | { kind: 'sequence'; sequenceId: Id };
  members: Array<{
    assetRef: VersionRef;
    offset: MediaTime;                 // relative to master clock
    timeMap?: TimeMap;
    confidence?: number;
    source: 'auto-audio' | 'timecode' | 'manual';
  }>;
}
```

- Automatic sync is an analysis artifact that can be corrected.
- Switching the visual camera angle does not switch the master microphone. Picture-in-picture is two layers.
- When deleting a speech segment, handle the whole sync group according to the explicit linked scope.
- Mixed-frame-rate and variable-frame-rate footage is mapped by PTS, each on its own.
- Unknown person or voice identities are bound by the user. They are not guessed.

### 7.9 SoundCueSheet

Narration, music and sound effects are organized separately. SoundCueSheet is a sound-event plan that can be edited under control. Sound effects are not played at random inside the code-composition `renderAt`.

```ts
interface SoundCue {
  id: Id;
  role: 'narration' | 'music' | 'sfx';
  assetRef: VersionRef;
  anchor: SemanticAnchor;
  offset: MediaTime;
  gainDb: number;
  followPolicy: FollowPolicy;
  userPinned: boolean;
}

interface SoundCueSheet {
  id: Id;
  revision: Revision;
  sequenceId: Id;
  cues: SoundCue[];
  compiled: Record<Id /* cueId */, { itemId: Id; viaTransactionId: Id }>;
}
```

- SoundCueSheet is a record of author intent and build output. It is not a second main audio track that can evolve on its own.
- After compilation, each cue maps to an ordinary `AudioItem` with a deterministic ID, written through the same transaction. The receipt keeps the cue → item mapping and lineage.
- A repeated sound effect references the same asset version. It creates only more audio instances, with no repeated download or purchase.
- After the user moves, replaces or mutes a sound effect on the timeline, record the corresponding pin or override. On later recompilation, keep it, raise a conflict, or let the user reset it explicitly. Do not overwrite everything from the old plan.
- When the voice anchor disappears, the cue enters `orphaned`. A pinned sound effect does not follow unrelated ripple edits.
- Narration, music and sound effects are routed separately. Audio inside an adapter must not also enter the external mix.
- `gainDb` is not a loudness measurement. Whether something is too loud must be judged through a real mix, peak and loudness checks, and audition.
- Generating new music or sound effects is a separate capability and cost authorization.
- Reusing native `AudioItem` belongs to P0. Richer automatic sound design opens up step by step, as its scope is validated.

### 7.10 NarrationCueSheet

When the picture is driven by narration (product design S04), the narration timing sheet records sentences, word anchors, shot intent and actual times.

```ts
// Completed by this spec
interface NarrationCueSheet {
  id: Id;
  revision: Revision;
  sequenceId: Id;
  audioRef: VersionRef;                 // narration audio given or confirmed
  speechRef?: VersionRef;               // speech document produced by alignment
  cues: Array<{
    id: Id;
    sentenceId?: Id;
    wordIds?: Id[];
    span: { start: MediaTime; end: MediaTime };     // exact time in the audio domain
    shotIntent?: string;
    sceneRef?: Id;                                  // corresponding scene or instance
  }>;
}
```

- It is a controlled input and a derived artifact. It is not another playback clock that drifts on its own.
- Keep the real audio and word-anchor timing. Quantize only when generating `fromFrame` / `durationFrames` for visual scenes, and record the deviation.
- Replacing the audio creates a new version. Alignment results and bound scenes are marked stale according to their dependencies.

### 7.11 Audio events and the video grid are independent

`SoundCue`, speech synthesis `actualSamples`, alignment results and fades all use samples or exact time. Audio instances use the exact start position and `playDuration` from §2.10. The frame width on the timeline is only a UI projection. A 10 ms fade is 480 samples at 48 kHz, and it is not rounded up to a video frame.

Changing `ExportSettings.fps` does not change the script, the audio length, the sample rate or the voice identity. Changing `Sequence.fps` requires keeping the exact absolute audio positions and rebuilding their “frame + remainder” representation.

---

## 8. Portable package

A video can be exported as a `.cuccut` file: an uncompressed POSIX ustar archive that contains only regular files (architecture design §5.8). The folder form is not supported.

```text
video.snapshot.json              # exchangeable snapshot of authoritative state (§3.1); not a second writer. All assets are managed
documents/<id>/<revision>.json   # versions of document bodies, stored as the original text (digests are computed over the original text)
assets/<sha256>.<ext>            # imported asset: file; extension determined by mediaType, bin when there is no match
assets/<sha256>/<relative path>  # imported asset: directory (code package source, manifest, dependency lock and static resources), file by file
video.manifest.json              # package version and content manifest, the last file in the archive
```

Provenance and generation notes are in `provenance` inside the snapshot, with no separate directory. Paths are `/`-separated relative paths and may only take the forms above.

### 8.1 Manifest

```ts
// Completed by this spec
interface PackageManifest {
  format: 'cuccut.package';
  packageVersion: 1;
  videoSchemaVersion: number;
  timeContractVersion: number;
  videoId: Id;                           // video at export time; a video opened from a package gets a new videoId
  videoName: string;
  videoRevision: Revision;
  createdAt: string;
  entries: Array<{
    ref: VersionRef;
    kind: 'asset' | 'document';
    path?: string;                       // relative path inside the package
    contentHash: string;
    byteLength: number;
    inclusion: 'included' | 'linked' | 'missing' | 'excluded-license';   // currently only included and missing are written
    note?: string;
  }>;
  files: Array<{                         // every file in the package (except the manifest itself)
    path: string;
    byteLength: number;
    sha256: string;                      // 'sha256:<hex>'
  }>;
}
```

`entries` has one item for each asset version and each document version. For a single file collected into the package, its sha256 in `files` is the version's `contentHash`. For a directory asset, the `contentHash` is the directory digest computed by the rule in §4.2, which the engine recomputes when the package is opened. `files` corresponds one-to-one with the files in the archive.

### 8.2 Rules

- Packaging uses a consistent snapshot. Do not copy a working database that has a WAL which has not been checkpointed, and treat it as a finished video.
- Linked assets are copied into the package and marked `managed` in the snapshot. Assets that cannot be read are rejected for export by default. If the user chooses to skip them, the manifest marks them `missing`, and the snapshot holds a linked asset with only its filename and `frozen: false`, which the receiver recovers with `relinkAsset`. “Linked” packages (`linked` / `excluded-license`, with assets left outside) will come later.
- Local absolute paths (§4.2) are not included in the package. A string in the snapshot that contains the local root directory is replaced with a placeholder and a warning is issued. If it appears in a document body, export is rejected.
- On open, every item is checked. Any mismatch rejects the package and creates no video: `format` must be `cuccut.package`; `packageVersion` must not be higher than the version the reader supports (a higher one is rejected with `PACKAGE_VERSION_UNSUPPORTED`); the archive may contain only regular files, the paths must follow the layout above, and there may be no `..`, absolute paths or backslashes; symlink and hard-link entries are rejected (`PACKAGE_PATH_UNSAFE`); the manifest's `files` must correspond one-to-one with the archive, with no duplicates; each file's length and sha256 must match, and for each single file collected into the package the digest must equal the version's `contentHash` (`PACKAGE_DIGEST_MISMATCH`). When the engine creates the video, it recomputes the `contentHash` of documents and assets again, and checks the snapshot against the rules applied at commit time.
- Only pre-rendered MP4 is playable media, not editable source.
- A code package that contains source pins its dependency lock and includes bytes that work offline. A lock file without bytes does not allow a claim of offline rebuild.
- The package does not include keys, protected machine paths, or files the task is not authorized to include.
- Temporary URLs, blob URLs, browser objects and GPU handles must not enter the exchange format.
- When a package is opened, its manifest is verified, and missing resources are listed explicitly. A proxy or pre-rendered preview may let the user browse first, but it must not be treated as having restored editable source.

Compression, signing, pax extensions (paths longer than 255 bytes, single files of 8 GiB or more) and the folder form come later (architecture design §14).

---

## 9. Items to complete

The following types or rules are completed by this spec, or still have gaps, and need review before implementation.

| Item | Status | What needs to be decided |
| --- | --- | --- |
| Text style and graphics model (§3.6) | Decided: graphics take v2's `shape` parameter and shape catalog; text styles take v2's style object, with fonts referenced per §3.14; the key table for text styles is not yet written into this spec | The keys, units and values for writing text styles when porting the render core; whether the text box is fixed or grows with its content |
| Keyframes and element animation (§3.15) | Decided: the keyframe property allowlist, percentage timing, and the easing table for `motion`; the entrance, exit and loop slots are saved as formal fields, sampled by `motion`, and not expanded into keyframes; `animationBindings` and `animate` are not implemented | Whether caption animation reuses the same slots |
| Corner radius unit (§3.5) | Decided: pixels at the 540 short edge, with a value per corner, `cornerRadii` | — |
| Margin fill color and canvas background (§3.2, §3.5) | Decided: the instance `bg` fills the canvas when full-screen with `contain`; the canvas background is a solid color | — |
| `Crop` (§3.5) | Decided: the proportion cut from each of the four edges, applied before `fit`, used only for video and images | — |
| Generated elements (§3.7) | Decided: built-in generators are removed; timers, stickers, sound waves, progress bars, hand-drawn, placeholder frames, confetti and whiteboards are each an instance kind or parameter; Lottie is one kind of asset (§4.1) | — |
| Invalidation of pre-rendered stand-ins (§3.7) | Not tracked | How a stand-in is marked stale after a parameter or code package version changes |
| Nested sequences, adjustment layers (§3.4) | Not included | Whether and when to add them |
| Asset version replacement (§4.2) | Operation not implemented | How a new version is recorded, and which selected instances it affects, when the code package is replaced or the source file is re-exported |
| Source clock of derived media (§4.5, §4.6) | Under review: after a derived product such as a reconstructed shot replaces the original asset, a source note alone is not enough to automatically project the transcript on the original asset onto the new asset instance | Whether to add a derived time mapping bound to the asset version, and an explicit declaration of the identity mapping; without a mapping, two assets must not be considered to share a clock based only on filename or similar duration |
| Failure detection for linked assets (§4.2) | Only the modification time is recorded; reporting for missing assets is decided: `videos.assetStatus` lists the asset versions that cannot be read and the reason, and the video still opens | When to re-check content; the exact meaning of `frozen`; how missing assets appear in export |
| Validation of document body (§4.4, §4.6) | The engine only checks the shape of the supplementary fields of `cuccut.speech/1` and `cuccut.translation/2`, and the per-word animation of box-positioned caption styles (§5.6) | Which `kind`s the engine fully validates; the registry for `kind` and `schema` |
| The §5 model and the body format already on disk (§4.6) | Inconsistent. Per §5.3, translations are `cuccut.translation/2`; `/1` from old projects is read-only compatible (§5.3) and not migrated. `cuccut.speech/1` adds the fields that the subtitle and translation core read and write, and is losslessly interchangeable with `TranscriptDoc` (§5.2) | Whether sentences and subtitle lines are stored as results, or as the version of the derivation algorithm plus a manual pin; how staleness is detected. Decided: the sentence derivation and source-text fingerprint for translation exist only in the subtitle and translation core (§5.3); the original translation-flow `cuccut.sentences/1` and `sha256:` fingerprint are deleted |
| `caption-style` (§5.6) | Already on disk are two body types, Studio style and box-positioned style; the engine only checks the per-word animation of box-positioned style. `CaptionStyleBody` (a target contract composed by dimension, [design draft](../design/subtitle/caption-style-model-design.md)) has landed in the editor and prototype (compiled to Studio style) but is not yet saved to disk as a body. The default preset is on disk (§5.6 "Default preset"): one language-neutral Studio style | The relationship with `LayoutProfile` and `CaptionStyle`; the unit of the reading budget; whether default presets are split by language |
| Export records and import records (§4.6) | Borrows the document | Whether artifact records become a first-class concept; how they connect with dependency links |
| Structured fields of `Provenance`, `LicenseState`, `ColorInfo` (§4) | Not included | Fields for generation records, derivation relations, license and permission state; fields for color metadata |
| Video-level `extensions` (§1.4) | Only instances and documents have them | Whether they are needed |
| `ItemBase` (§3.4) | Completed by this spec | Combination rules for `paintOrder` and `Track.order` |
| `Sequence.canvas.workingSpace` (§3.2) | The engine does not restrict values | Working spaces supported in the first version |
| `SemanticAnchor`, `FollowPolicy` (§3.16) | Decided: separate anchors for start and end, an offset for word anchors, to the end of the sequence, `follow-cuts` and its default (instances placed by time default to it from creation). Decided: `speech-anchor` is re-solved against the timeline on every transaction; occurrences and ambiguity follow the v2 rules; anchors that cannot be solved stay in place, and `orphaned` is computed on the fly and not saved. Decided: `item-local` follows the source time of its target, is split along the segment that contains the anchor, moves to the new start when trimming the start crosses the anchor, and is deleted together with the target. Implemented: `sequence-fixed`, `follow-cuts` (within the cut transaction), `speech-anchor`, `item-local` and to-end-of-sequence. `explicit-link-group` is outside this version's scope: only its shape is saved and validated, and it does not move | Linkage rules for `explicit-link-group` |
| `ProtectionRecord` (§3.10) | Completed by this spec | The boundary between persistent protection and task-level protection; how strictly `confirmed` is enforced |
| `Checkpoint` (§3.11) | Completed by this spec | Whether checkpoints may have branches |
| `DependencyLink.kind` (§3.12) | Completed by this spec | The enumeration of dependency kinds |
| `ImportedCaptionDocument`, `AlignmentBlock`, `CaptionOverride` (§5) | Completed by this spec | The kinds and values of override |
| `LocalizationSet`, `CanvasVariant`, `SyncGroup` (§7) | Completed by this spec | The allowlist of override fields |
| `NarrationCueSheet` (§7.10) | Completed by this spec | Whether to merge it with the narration role of `SoundCueSheet` |
| `PackageManifest` (§8.1) | Decided: the container is ustar, with the length and sha256 of each file | Signing; compression and pax extensions |
| Chapters (§3.13) | Decided: a `kind: 'chapter'` marker, fixed on sequence time | — |
| Allowlist of effects, transitions and easing (§3.9) | Decided: transitions `dissolve`, `wipe`, `slide`, `zoom`, `iris`, `dip-to-color` and `push`, with one-sided rendering per v2; effects are fixed fields of `fx` in a fixed order, plus filter and effect presets; transition easing is `linear`, `ease-in`, `ease-out` and `ease-in-out`. Decided not to merge: transition easing stays at these four, and the `motion` easing table is used only for keyframes and element animation | Recipes for `temperature`, `shadow` and `stroke`; keyframes for effect and transition parameters |
| Ducking (§3.9) | Decided: triggered per script or per instance, with v2's curve and merge rules | — |
| Cut set (§6.7) | Decided: add, merge, restore and reorder are implemented (`addCuts`, `restoreCut`) | How to prompt when manual edits are inconsistent with cuts |
| Template layer (§3.17) | Decided, not implemented | How `ratio` coexists with the aspect-ratio lock and aspect-ratio versions (§7.7) |
| v2 `bcfClip` (audio element) | Decided: claims the spoken sentences in the code composition for dubbing, forming an audio-video linked group of composition and dubbing (§3.7 "Sound"); claimed sentence IDs are not part of the format | When the composition can run in real time, whether to subtract only the claimed sound per sentence |
| Variable frame rate (§2.11) | Rules decided, not implemented | Currently treated as the nominal frame rate |
| HDR | The first version only supports strict SDR export | Tone-mapping strategy for HDR input |
| Variable speed curves, reverse playback, `preserve=frames` | Not included | Whether and when to open them |
