# CucCut Code Bundle Specification

> Code composition lets authors and agents make animations with p5.js, Three.js, Canvas, Remotion and similar technologies, and take part in the composition as an instance on the timeline. This spec defines the bundle manifest, the instance fields, the author contract that authors must follow, the declaration of time dependencies, and Bake.

Format identifier: `cuccut.code-bundle`, `schemaVersion: 1` (that is, `bundleSchemaVersion`).

This spec defines **the bundle format and the author contract**. The runtime mechanics such as the Adapter, frame-fetch tickets and the build ledger are in [System Architecture Design](../architecture/architecture-design.md) §8; other data in the video is in [Video Format Spec](video-format-spec.md); commands that modify instances are in [Command and Protocol Spec](command-protocol-spec.md). For terminology conventions see [Document Conventions](../README.md#conventions-for-this-document), and for terms see the [Glossary](../glossary.md).

## Contents

- [1. Scope and Conventions](#1-scope-and-conventions)
- [2. Manifest](#2-manifest)
- [3. Instances and Three-Layer Editing](#3-instances-and-three-layer-editing)
- [4. Author Contract](#4-author-contract)
- [5. Time Dependencies](#5-time-dependencies)
- [6. Verification and Publishing](#6-verification-and-publishing)
- [7. Bake and Degradation](#7-bake-and-degradation)
- [8. Open Scope](#8-open-scope)
- [9. Items Pending Review](#9-items-pending-review)

---

## 1. Scope and Conventions

### 1.1 Two Kinds of Composition

| Type | What it references | How far CucCut understands |
| --- | --- | --- |
| Nested sequence | CucCut's own structured sequence | Everything: each element can still be edited one by one (instance types not yet in the video, Video Format Spec §3.4) |
| Code composition | An author environment and its code bundle | Instance properties, public parameters, execution contract |

This spec covers only code compositions: the source is a composition instance of a code bundle (`type: 'composition'`, `source.kind: 'bundle'`, Video Format Spec §3.7). The code bundle itself is a directory asset in the video (`kind: 'bundle'`, Video Format Spec §4.3). Its version, storage location and content digest follow the rules for assets; this spec defines only the manifest and the execution contract.

### 1.2 No Type per Library

Within the video's set of instance types, the only type for pictures drawn by code is `composition`. Browser code uniformly declares `engine: 'browser'` and uses `contract` to distinguish the different author contracts; `frameworkHints` is only for development hints. Remotion uses its own `engine`. Adding a new graphics library does not require a video format upgrade.

### 1.3 Status of the Types

Types are written in TypeScript notation and express a DTO outline. Types marked "supplemented by this spec" have only a name or a usage in the original design; this spec gives their fields, and they are listed in §9. The base types `Id`, `Revision`, `VersionRef`, `JsonValue`, `Rate` and `MediaTime` are in Video Format Spec §1.2 and §2.3.

### 1.4 Three Principles That Run Throughout

1. **Code bundles are immutable.** A published version is never modified in place. Changing the source produces a new version, and references are then explicitly replaced.
2. **A declaration is not a capability.** Random access, transparency, audio and time dependencies declared in the manifest are enabled only after they are verified by measurement (§6).
3. **Instance, parameters and source are kept separate.** In the interface, in commands and in receipts, these are always three different kinds of change (§3.4).

---

## 2. Manifest

### 2.1 CodeBundleManifest

```ts
interface CodeBundleManifest {
  format: 'cuccut.code-bundle';
  schemaVersion: 1;
  bundleId: Id;
  revision: Revision;
  contentHash: string;
  runtime:
    | { engine: 'browser'; contract: string; entry: string; frameworkHints: string[] }
    | { engine: 'remotion'; entry: string; compositionId: string };
  source: { filesManifest: string; dependencyLock: string; buildRecipe: string };
  intrinsic: { width: number; height: number; fps: Rate; durationFrames: number };
  output: { alpha: boolean; colorSpace: string; audio: 'none' | 'stems' | 'mixed' };
  timing: { access: 'random' | 'sequential' | 'checkpointed'; fixedStep?: Rate };
  timeDependencies?: Array<
    | { kind: 'local-only' }
    | { kind: 'placement' }
    | { kind: 'cue-track'; ref: VersionRef }
    | { kind: 'sequence-clock' }
  >;                                   // Omitted means unknown, not local-only
  parametersSchemaRef?: string;
  exposedLayers?: Array<{ id: Id; isolation: 'independent' | 'requires-backdrop' }>;
  permissions: { network: 'deny'; assetIds: Id[] };
}
```

### 2.2 Fields

| Field | Meaning | Rule |
| --- | --- | --- |
| `bundleId` | Identity of the code bundle | Stable across versions |
| `revision` | Human-readable version number | Used for association; cannot be modified in place after publishing |
| `contentHash` | Digest of the actual bytes | Used for verification; together with `revision` it forms the identity for caching and freezing; algorithm at the end of this section |
| `runtime.engine` | Execution engine | `browser` or `remotion` |
| `runtime.contract` | Identifier and version of the browser author contract | Format `<contract name>/<major version>`; incompatible changes bump the major version; `adapterContractVersion` takes the same value. The first release provides `cuccut/1` (§4.1) and `hyperframes/1` (§4.7) |
| `runtime.entry` | Entry file | Relative path within the bundle |
| `runtime.frameworkHints` | Libraries used | Hints only; they do not take part in execution decisions |
| `source.filesManifest` | Source file manifest | Lists the path and digest of each file |
| `source.dependencyLock` | Dependency lock | Pins versions only; does not provide offline bytes (§2.4) |
| `source.buildRecipe` | Build recipe | Toolchain version, commands and inputs |
| `intrinsic` | Size, frame rate and duration set by the author | `fps` is the bundle's local frame rate, not the frame rate of the sequence or the export (§5.4) |
| `output.alpha` | Whether output is transparent | Must be actually implemented by the code (§4.5) |
| `output.colorSpace` | Output color space | The first release supports SDR only |
| `output.audio` | Whether there is sound, and in what form | `stems` are handed to the main mix; `mixed` is an explicit mixed audio track (§4.8) |
| `timing.access` | How frames are fetched | §5.3 |
| `timing.fixedStep` | Simulation step rate | Required for `sequential` / `checkpointed`; does not change with the output frame rate |
| `timeDependencies` | Which external times the picture depends on | §5 |
| `parametersSchemaRef` | Schema for public parameters | §3.2 |
| `exposedLayers` | Layers that can be output independently | Layers with `requires-backdrop` cannot be cached separately from the background |
| `permissions.network` | Network permission | Always `deny` in the first release |
| `permissions.assetIds` | Assets that may be read | Only listed assets can be resolved |

**Algorithm for `contentHash`** (supplemented by this spec). `contentHash = 'sha256-' + sha256(JSON.stringify(entries))`. `entries` is the array of files in the bundle, sorted by `path`, where each item is `{ path, size, sha256 }`: keys in this order, compact JSON. `path` is a `/`-separated relative path, `size` is the byte count, and `sha256` is lowercase hex. `bundle.manifest.json`, `files.manifest.json` and `verification.json` are not counted: the manifest contains its own digest, the files manifest lists exactly this set of entries (counting it would require listing its own digest), and the report is written only after the digest, so counting any of the three would create a cycle. The content of `files.manifest.json` (`source.filesManifest`) is `entries`. This value is a field of the manifest. Its algorithm differs from the tree digest of directory asset versions (Video Format Spec §4.3), so it is not the same value (§9).

### 2.3 Identity and Immutability

- After publishing, a version cannot be modified in place. Any change produces a new `revision` and a new `contentHash`.
- Old versions are kept for history, undo and frozen tasks in progress, and can be reclaimed only once no references remain.
- Cache keys, frozen snapshots and export records use `bundleId + revision + contentHash`, not the file modification time.
- On import and verification, `contentHash` is recomputed per §2.2; if it does not match the manifest, the import is rejected (`BUNDLE_HASH_MISMATCH`, §6.3).

### 2.4 Source and Offline

- Source, build inputs, the dependency lock, fonts and static assets must be locatable. **A single MP4 cannot be called an editable code bundle.**
- The dependency lock pins versions only and does not automatically provide offline bytes. An offline bundle must also contain build outputs or vendored dependencies that may be lawfully distributed, or reference a runtime dependency repository whose existence has been verified.
- When offline bytes are missing, offline rebuild is blocked. Do not fetch the missing parts online on the sly while still claiming the render was offline.
- Remote fonts, scripts and assets are fixed to bytes at publish time and registered in the manifest; rendering no longer accesses the network.

### 2.5 Bundle Layout

```text
<bundle>/<revision>/
  bundle.manifest.json      # this chapter's manifest
  src/                      # author source
  dist/                     # build output (the entry is here or as the manifest specifies)
  vendor/                   # bytes of offline dependencies
  assets/                   # static assets and fonts in the bundle
  parameters.schema.json    # Schema for public parameters (if any)
  files.manifest.json       # path and digest of each file
  dependency.lock           # dependency lock
  build.recipe.json         # build recipe
  verification.json         # verification report of §6
```

The file names `bundle.manifest.json`, `files.manifest.json` and `verification.json` are fixed in the first release and placed at the bundle root. The other directory and file names are suggested defaults; the path fields in the manifest have the final say. This section is supplemented by this spec.

### 2.6 Permissions

- A code bundle runs in an isolated execution environment. By default it has no network, no file access outside the video directory, and no host capabilities (Architecture Design §12).
- A bundle can read only the assets listed in `permissions.assetIds`, through a controlled resolver. It receives read-only bytes or controlled handles, not machine paths.
- A manifest cannot grant itself extra permissions. Access beyond what the manifest declares is denied and recorded as a verification failure.

---

## 3. Instances and Three-Layer Editing

### 3.1 Composition Instance

The definition of an instance is in Video Format Spec §3.7. Only the fields related to code bundles are listed here:

```ts
interface CompositionItem extends VisualItemBase {
  type: 'composition';
  source: { kind: 'bundle'; assetRef: VersionRef };   // points to one fixed code bundle version
  parameterValues: JsonValue;          // the instance's parameter values
  timeMap: TimeMap;                    // instance time → local time of the composition
  prerender?: VersionRef;              // pre-rendered stand-in: the rendered video asset
  audio?: EmbeddedAudio;               // routing of the sound the composition itself emits
}
```

`span`, `transform`, `opacity` and so on come from `VisualItemBase`; `TimeMap` and `Transform` are in Video Format Spec §2.5 and §3.5.

The relationship between the pre-render stand-in and Bake (§7): the stand-in is the fact that "this composition already has a rendered video". When the runtime environment is unavailable, preview and export use it in place of the composition. Bake is the controlled process that produces such a video, carrying input fingerprints and verification records. The voice (part) mode of `audioRoute`, `qualityPolicy` and `BakeRecord` have not yet entered the instance fields (§9). In the first release, `BakeRecord` is recorded in the source of the baked asset (§7).

### 3.2 Parameters

- Parameters are **the instance's values**. Two instances of the same bundle can use different titles and colors.
- Changing a parameter does not produce a new source version, but it does change the render cache key.
- Parameters are described by the JSON Schema that `parametersSchemaRef` points to. The interface shows only the controls the Schema allows. A non-public internal object cannot pretend to be draggable.
- Parameter values must pass Schema validation before they can be committed. Parameters that fail validation are not written to the video.

The Schema should suggest providing, for each parameter: type, default value, value range or enum, display name, group, and whether it affects duration or layout. A change to a parameter that affects duration must trigger a duration re-check (§3.3).

### 3.3 Replacing a version

- When replacing a code bundle, a **parameter schema compatibility check** is mandatory. If a parameter has been renamed, it must not silently fall back to its default; either provide a mapping, or list the lost parameters and wait for confirmation.
- When one bundle is referenced in several places, only the instance the user selected is replaced by default. “Update all instances” is an explicit bulk operation.
- When the new version is shorter, or old instances now extend past the available range, this must be handled explicitly and the last frame must not be silently stretched. The options are: trim the instance, hold the last frame, or re-arrange the composition. In the first release, `replaceCodeBundle` defaults to trimming and states this in the receipt (see below); the other options wait for a `fit` option.
- Swapping a scene keeps `itemId`, lineage, external subtitle anchors and the user's pins by default.
- Publishing source code, applying the video and invalidating caches are three separate events (architecture design §8.2).

In the first release, replacement is the edit operation `replaceCodeBundle` ([command and protocol spec §12.6](command-protocol-spec.md#126-replacing-a-code-picture-in-place)), which replaces one instance at a time. The agent calls it through the `replace` option of `compositions_import` (after the package has been re-bundled, verified and baked; for a second change, it replaces the instance rather than adding a new one):

- **Swap source only**: write the new `source.assetRef` and `prerender` (`null` or omitted means no stand-in), and optionally replace `parameterValues` entirely. Instance ID, track, start, geometry and opacity, effects, masks, name, toggles and locks, follow policy, keyframes, audio routing and lineage all stay unchanged. `timeMap` returns to a linear mapping starting at 0 with rate 1: the new version plays from the beginning.
- **Length follows the new version**: if there is a stand-in, use the stand-in's length (rounded down to frames of the sequence the instance sits in); if there is none, take `intrinsic.durationFrames` from the manifest and convert it with `intrinsic.fps` to frames of the sequence the instance sits in. If neither is available, reject. When `compositions_import` replaces, the stand-in is also baked at this sequence's frame rate.
- **If shorter, trim the instance**: this is the default of the three options above; it neither holds the last frame nor re-arranges. The trim is not silent: the receipt's `impact.codeEdits` gives the frame counts before and after. Keyframes follow the shortened window, under the same rule as cropping.
- **If longer, do not push others away**: if the longer instance now overlaps another instance on the same track, it is rejected with `TIMELINE_OVERLAP`, and `recovery` suggests first moving the later instance away with `moveItem` or deleting it with `deleteItems`, then replacing again.
- **Parameter gate**: if the instance's `parameterValues` is not empty, and the new version's manifest has no `parametersSchemaRef` or a different one, and no new `parameterValues` are supplied at the same time, the request is rejected with `INVALID_OPERATION` (`details.rule` is `parameters-incompatible`). The old values are not applied to the new schema. When the schema reference is the same, the old values are kept. Validating parameters against the schema content is still not implemented (§3.2).
- If the instance is not a composition, the asset is not a code bundle, the stand-in is not a video, or the instance or track is locked, the request is rejected. The errors are the same as for `setCodeParameters` and `insertItems`.
- **The receipt labels the layer**: each item in `impact.codeEdits` carries `layer: 'source'` (the source edit in §3.4), along with the code bundle versions before and after, the stand-ins and the frame counts.
- **The old version stays in the video**: replacement does not delete the asset. The receipt's `previousBundleRef` and undo still need the old version, and the engine deduplicates imports by content, so keeping it does not take up space twice. Code bundles and stand-ins that are no longer referenced are removed by the general cleanup: the edit operation `removeAssets` deletes only unreferenced assets, and a code bundle is deleted together with the stand-in baked from it. The agent lists them first with `assets_prune` and deletes them only after confirmation ([command and protocol spec §4.2](command-protocol-spec.md#42-edit-operations), [§12.7](command-protocol-spec.md#127-pruning-superseded-old-versions)).

Open questions: whether to provide a `fit` option (keep the instance length, hold the last frame, or change speed proportionally when the new version is longer or shorter), and bulk replacement for “Update all instances”.

### 3.4 Three layers of editing

| Layer | Example | Where it is written |
| --- | --- | --- |
| **Instance edit** | appear two seconds later, shrink, add opacity, split | `CodeCompositionItem` |
| **Parameter edit** | the Earth's rotation speed, title, theme color, particle count | `item.parameterValues` |
| **Source edit** | add a satellite, change the motion algorithm, restructure the camera | a new code bundle version, then an explicit replacement of the reference |

The three layers always stay separate in the UI, in commands and in receipts. A receipt must state which layer a change belongs to.

For complex changes that parameters cannot express, the UI offers “Hand this composition to the agent for changes”. The context handed to the agent includes: the code bundle version, the selected instance, the time range, the current parameters and a screenshot.

### 3.5 Splitting and speed changes

- Splitting a code composition instance yields two instances that reference the same code bundle version, each with a `timeMap` pointing to its part of the original local time interval. Splitting does not copy the source code.
- Speed changes and trims only change `timeMap`. A `sequential` bundle still simulates with `fixedStep` after a speed change; output sampling only decides which moments are read (§5.3).
- Aspect-ratio versions (video format spec §7.7) adapt responsive bundles through parameter overrides. When a bundle does not declare responsive capability, either explicitly use contain or cover, or propose a refactor. Changing the aspect ratio does not mean the camera re-frames automatically.

---

## 4. Author contract

### 4.1 Browser contract

The author interface of the CucCut Web contract:

```ts
interface AuthoredComposition {
  initialize(ctx: CompositionContext): Promise<void>;
  renderAt(time: MediaTime, params: JsonValue): Promise<void>;
  dispose(): void;
}

// Added by this spec
interface CompositionContext {
  target: HTMLCanvasElement | HTMLElement;     // capturable draw target
  width: number;
  height: number;
  pixelRatio: number;
  intrinsicFps: Rate;
  durationFrames: number;
  seed: string;                                // deterministic random seed
  assets: { resolve(assetId: Id): Promise<{ url: string; mime: string }> };   // read-only, frozen bytes
  fonts: { ready(): Promise<void> };
  placement?: { sequenceStart: MediaTime; sequenceFps: Rate };                // provided only when the placement dependency is declared
  cueTracks?: Record<Id, JsonValue>;                                          // provided only when the cue-track dependency is declared
}
```

**`initialize`** must resolve only after fonts, images, models, textures and any necessary asynchronous initialization have all completed.

The resolution of **`renderAt`** means **the frame at this moment has been committed to the capturable target**. It must not represent only that variables were changed or that a seek was issued. The host is responsible for synchronizing video decoding with presentation, and must not treat every `seeked` event as proof that a new frame is already displayed.

**`dispose`** releases all resources. When a session is cancelled or replaced, the host calls it and waits for the resources to actually be released (architecture design §7.7).

**Discovery.** The identifier of this contract is `cuccut/1`. The entry page exposes `AuthoredComposition` at `window.__cuccutCompositions[<compositionId>]`. The root element carries `data-composition-id`, along with `data-width`, `data-height`, `data-fps` and `data-duration` (in seconds), the same as `hyperframes/1` (§4.7); both contracts use the same rule to find the root element. If the root element is not found, report `COMPOSITION_ROOT_MISSING`. If the root element's size, frame rate or duration does not match the manifest's `intrinsic`, report `COMPOSITION_INTRINSIC_MISMATCH` (§6.3).

The `time` in `renderAt(time, params)` is local time (`MediaTime`), and `params` are the parameter values (§3.2; empty object in the first version). It resolves only after this frame has been committed.

### 4.2 Determinism

The same code bundle version, the same parameters, the same local time and the same output configuration must produce the same picture.

- The picture may be determined only by the `time` and `params` received by `renderAt`, and by the time dependencies already declared (§5).
- Do not read the wall clock (`Date.now()`, `performance.now()`) or real elapsed run time to decide the picture.
- Random numbers must come from a deterministic random source derived from `ctx.seed`. The application must also fix its own noise sources and call order; seeding only `Math.random` does not make everything deterministic.
- Do not depend on the network, user input or the host's window size.
- Time dependencies that are not declared are not provided; code must not obtain its own position on the main timeline by any other route.

### 4.3 p5.js

- New author templates use `noLoop()`, and the Adapter calls controlled drawing with an explicit local time rather than real elapsed run time.
- Use `randomSeed` / `noiseSeed`, and fix your own random source and call order.
- Existing stateful sketches may declare `sequential`: replay from the initial state to the target frame with a fixed step (§5.3).

### 4.4 Three.js

- Use local time to compute the state of objects directly, then render the scene.
- Animation clips may be driven through `AnimationMixer.setTime`. However, this does not mean that all physics, particles and asynchronous resources are naturally random-access; stateful parts must either be rewritten as pure functions of time, or declare `sequential`.

### 4.5 Canvas and transparency

- Pixels inside a canvas are not DOM objects. A title and a chart inside one canvas cannot be split into two editable elements just by CSS selectors. Editable content must either be exposed as parameters, be implemented deliberately as independent layer output (`exposedLayers`), or be kept as a whole.
- Transparent output requires the code to actually clear the background to transparent, and to use a target that supports alpha. Setting `alpha: true` in the configuration does not automatically remove a background that has already been painted.
- A bundle that declares `output.alpha: true` has its alpha checked for authenticity during validation (§6.2).

### 4.6 Remotion

- **Recognize, do not produce.** CucCut's built-in templates and authoring guidance do not use Remotion. Code bundles with `engine: 'remotion'` come from user requests or external imports, and must be recognizable, previewable and renderable.
- CucCut does not distribute Remotion. The Adapter uses the Remotion that the code bundle depends on (Player and renderer), with the version set by the bundle's lockfile. If the bundle has no usable Remotion, the composition is reported as unavailable with an explanation; if there is a pre-rendered stand-in, the stand-in is used (§3.1). Remotion's license is the responsibility of the code bundle's author, and the UI shows a notice once at import.
- Preview may use the Remotion Player; parameters map to `inputProps`. Export uses the renderer's batch or range interface, and does not start a render process and browser again for every frame.
- The Player and the renderer are two separately existing integration surfaces. The Adapter must explicitly freeze the same props and build inputs for both.
- Adapting Remotion separately is to preserve its frame / React / audio semantics, not a promise that export is faster. Its internal video and audio processing must be verified in the Adapter's capability tests.
- CucCut's ranges are uniformly right-open. When calling a third-party renderer, convert its `frameRange` endpoint rules at the boundary; dropping the last frame or outputting one extra frame is forbidden.
- When the parent sequence's frame rate differs from Remotion's, sample by mapping source time, and declare a policy such as hold or nearest. Do not round arbitrarily on each UI seek.
- Do not treat a video frame or an output frame directly as a Remotion composition frame, and do not support a new export frame rate by rewriting the `fps` of an already published code bundle.
- The concrete containers and paths for transparent video and audio export are verified against the versions and licenses actually available; not all modes are promised to be available by default.

### 4.7 HyperFrames

The contract identifier is `hyperframes/1`, corresponding to the public contract of HyperFrames (Apache-2.0, https://github.com/hyperframes/hyperframes). This section covers only the parts the Adapter depends on; the contract itself is defined by the upstream project.

- **Discovery.** The root element is the same as in §4.1: `[data-composition-id]`, with `data-width`, `data-height`, `data-fps` and `data-duration`. The Adapter waits for `window.__timelines[<compositionId>]` to appear: a paused, seekable timeline that provides `seek(seconds)`, and either `time()`, or `progress()` and `duration`. If it does not appear, report `COMPOSITION_TIMELINE_MISSING`.
- **Frame capture.** The Adapter first calls `pause()`, then for each frame calls `seek(t)` and reads back the timeline's actual time. If the read-back differs from `t` by more than half a frame at the sampling frame rate, that is 1 / (2 × fps), report `COMPOSITION_SEEK_MISMATCH`. The fps is taken from the `fps` of the capture ticket: for baking, it is the frame rate of the sequence or export (§7); for verification and preview when capturing frames by seconds, the ticket uses the `intrinsic.fps` of the bundle; without a ticket, use the bundle's `intrinsic.fps`. At 30 fps the tolerance is 1/60 s. When the error is less than half a frame, the read-back time and `t` still fall on the same frame. The tolerance tightens with the frame rate and does not use a fixed constant (architecture design §8.4). After seeking, wait two animation frames before capturing; the status of this waiting strategy is described in architecture design §8.4.
- **End of timeline.** When the requested moment reaches or exceeds the duration, clamp to the duration for frame capture, and note the clamp in the receipt. This is the explicit choice this contract makes for the end-of-timeline behaviour in architecture design §8.4: take the available frame and report it, rather than treating it as a successful hold.
- **Audio.** In the first release, this contract does not take sound; `output.audio` must be `none`.

This contract has its own composition and seek contract, and does not additionally drive the media inside it with a second CucCut clock. It distinguishes HTML timing from seekable animation, and the adaptation preserves this division of labour.

### 4.8 Audio

When a composition contains audio internally, choose one of two modes:

- **`stems`**: the Adapter outputs separate tracks, which go into the main mix.
- **`mixed`**: the Adapter outputs one explicit mixed track.

Do not play the audio inside a composition together with the same external narration. Audio inside an Adapter must not also enter the external mix.

Do not play sound effects randomly in `renderAt`. Narration, music and sound effects are organized by the SoundCueSheet and compiled into ordinary audio instances (video format spec §7.9).

---

## 5. Time Dependencies

### 5.1 Why Declare Them

Splitting an animation into several independent packages does not prove that the cache can be fully reused after an instance is moved. Scene code may read its own start point on the main timeline (for example, `start + t` to drive a background), or it may read the global clock or external sound events. Only when we know which times a frame depends on can we tell which frames remain valid after a change.

### 5.2 Four Kinds of Dependency

| `kind` | What the frame depends on | After moving the instance | After changing a cue or script |
| --- | --- | --- | --- |
| `local-only` | Only local time and parameters | Reuse the internally computed frame results | Not affected |
| `placement` | The instance's position in the sequence | Re-evaluate | Not affected |
| `cue-track` | An external cue track (with a versioned reference) | Depends on whether the cue changes with it | Re-evaluate when the referenced version changes |
| `sequence-clock` | The sequence's global clock | Re-evaluate | Re-evaluate when the sequence timing changes |

Rules:

- **Omitting `timeDependencies` means unknown, not `local-only`.** If it is not declared or not verified, invalidate conservatively.
- `local-only` must be mutually exclusive with the other dependencies.
- A frozen composition input must include the values and versions of these dependencies (architecture design §8.6).
- Do not infer local impact from a code file's hash.
- Declarations must be verified (§6.2): a package declared as `local-only`, evaluated at the same local time at different placements, must produce the same frame.

### 5.3 Frame Access Modes

| `timing.access` | Meaning | Local re-render |
| --- | --- | --- |
| `random` | Any local time can be evaluated directly | Only the affected range needs re-rendering |
| `sequential` | Must replay from the initial state with `fixedStep` up to the target frame | Changing the state at one moment may affect all frames after it; must not re-render only locally |
| `checkpointed` | Can resume replay from a saved checkpoint | Start from the nearest checkpoint before the affected moment |

- `fixedStep` is the simulation step rate and does not change with the output frame rate. Output sampling only decides which moments are read.
- Checkpoints are enabled only when the code can fully save the simulation state, the random state and any necessary resource recovery information. Arbitrary JS heap or WebGL state cannot automatically be treated as a saveable checkpoint.
- For a `sequential` package, a distant random seek may first show a cached preview and then compute the correct frame. Old frames must not be marked as precisely evaluated.

### 5.4 Local Frame Rate

- `intrinsic.fps` is the code package's own frame rate. It is independent of `Sequence.fps` and `ExportSettings.fps` (video format spec §2.11).
- Continuous animation is evaluated at exact local times and is not first rounded to a frame grid.
- Frame-driven code uses `intrinsic.fps` to select local frames. The Adapter returns the actual local time, the actual source frame or PTS, and the sampling strategy used.
- Whether interpolation, hold or nearest is supported must be verified by capability. If it is not supported, reject or degrade explicitly.
- When a request exceeds the package's duration, an explicit choice is required: take the available frame, hold, or report out-of-range. Out-of-range requests are not treated as a successful hold by default.

---

## 6. Verification and Publishing

### 6.1 Publishing Flow

```text
Draft in the authoring workspace
  → build (isolated environment, pinned toolchain)
  → static checks (manifest, schema, permissions, dependencies complete)
  → sample verification (§6.2)
  → compute digest, register as an immutable version
  → transactionally switch the selected instances from the old version to the new one
```

- Drafts live in a separate authoring workspace. Saving a draft file does not change the published code package or the content being exported.
- Building a draft is not a video. Published versions are not overwritten automatically by file watching.
- The input hash, toolchain, output code package, verification report and application receipt of each build are recorded in the build ledger (architecture design §8.6).

**Import.** Importing a code package from a directory goes through the same static checks and sample verification (§6.2):

- List files with `lstat` and reject symbolic links.
- Accept only whitelisted extensions: `html` `htm` `js` `mjs` `cjs` `css` `json` `map` `txt` `md` `svg` `png` `jpg` `jpeg` `webp` `gif` `avif` `woff` `woff2` `ttf` `otf` `mp3` `wav` `ogg` `m4a` `mp4` `webm` `mov` `wasm` `lock`, plus manifest files with fixed names (§2.5).
- Limits: 4096 files, 64 MiB per file, 256 MiB in total, and relative paths of no more than 512 characters.
- Statically scan for network references: `src`, `href`, `url()`, `@import`, `http(s)://` and `ws(s)://` inside `fetch` and `new URL`, and protocol-relative URLs (starting with `//`). XML namespace URIs do not count. Reject on any finding.
- A package without `bundle.manifest.json` can have a manifest synthesized by the importer from the `data-*` attributes on the root element of the entry page (§4.1), or from override values supplied by the caller. The synthesized manifest is written to a staging copy, not back to the source directory. `revision` defaults to `1` (`Revision` is a non-negative decimal integer string, video format spec §1.2).
- A package that passes is stored immutably as a managed directory asset under `bundleId/revision` (video format spec §4.3), and the manifest is placed in the `bundle` field of the asset version.

### 6.2 Verification Items

A manifest's declarations take effect only after they have been tested. The verification result is `VerifiedCapabilities` (architecture design §8.3). If it does not match the manifest, reject or downgrade the capabilities.

| Verification item | What it checks |
| --- | --- |
| Ready | After `initialize` completes, fonts, textures and media are actually available; the first frame is not blank or a placeholder |
| Determinism | Evaluating the same local time repeatedly produces the same frame |
| Random access | For packages declaring `random`: out-of-order evaluation matches sequential evaluation |
| Sequential replay | For packages declaring `sequential` / `checkpointed`: replay from the start matches replay from a checkpoint |
| Time dependency | For packages declaring `local-only`: changing the placement produces the same frame at the same local time |
| Last frame | The first frame, last frame and adjacent frames can be told apart; out-of-range behavior matches the declaration |
| Transparency | For packages declaring `alpha`: the background is actually transparent and the edges have no premultiplication errors |
| Audio | For packages declaring audio: length, sample rate and channels match the declaration; nothing is duplicated with the external mix |
| Permissions | No network access or undeclared assets during runtime |
| Parameters | Default parameters pass the schema; boundary values do not crash |

Capabilities that do not pass verification are not enabled. A package that has not passed ready and determinism verification cannot be used for Export-Exact.

The **verification report** is `verification.json` in the package root (completed by this spec):

```ts
interface CodeBundleVerificationReport {
  format: 'cuccut.code-bundle-verification';
  schemaVersion: 1;
  bundleId: Id;
  revision: Revision;
  contentHash: string;
  verifiedAt: string;
  status: 'passed' | 'failed';
  capabilities: VerifiedCapabilities | null;   // architecture design §8.3
  checks: Array<{ id: CodeBundleCheckId; status: 'passed' | 'failed' | 'skipped'; code?: CodeBundleErrorCode; detail?: string }>;
  sampledFrames: Array<{ seconds: number; sha256: string }>;   // frames taken during verification, kept for review
}
```

Checks in the first version (`CodeBundleCheckId`):

| `id` | What it checks |
| --- | --- |
| `manifest` | The manifest conforms to §2.1, or has been synthesized by the importer (§6.1) |
| `files` | Extension whitelist, symbolic links and size limits (§6.1) |
| `content-hash` | The recomputed `contentHash` matches the manifest (§2.2) |
| `network-static` | The static scan finds no network references (§6.1) |
| `network-runtime` | During runtime, requests that are not `file:` within the package directory, and not `data:`, `blob:` or `about:`, are always cancelled and counted; a non-zero count fails |
| `root` | The root element is found, and its `data-*` attributes match the manifest's `intrinsic` (§4.1) |
| `timeline` | The contract's frame-access entry point is present (§4.1, §4.7) |
| `seek` | The time read back after a seek matches the request (§4.7) |
| `determinism` | Rendering the same local time twice yields the same sha256 for both frames |
| `alpha` | For packages declaring `output.alpha`: measure transparent pixels; fails if all sampled frames are fully opaque |
| `duration` | The last frame and out-of-range behavior match the declaration (§5.4) |

The first-version report does not cover the ready, random-access (out-of-order vs. sequential consistency), sequential-replay, time-dependency, audio and parameter items in the table above. Permissions only check the network, not undeclared assets; transparency does not check premultiplied edges. Under the rules of this section, these capabilities are not enabled, and a package without ready verification cannot be used for Export-Exact.

### 6.3 On Failure

- If a build or verification fails, no new version is produced; the published version and the instances referencing it remain unchanged.
- The failure report identifies the specific verification item, the sampled moment and the evidence, and returns them to the author or agent for correction.
- When the sandbox is unavailable, code-composition preview and rendering are turned off and the reason is stated; execution does not continue at the cost of reduced isolation.

Error codes:

| Error code | Meaning |
| --- | --- |
| `BUNDLE_MANIFEST_INVALID` | The manifest cannot be parsed or does not conform to §2.1, and no synthesis was done |
| `BUNDLE_FILE_NOT_ALLOWED` | The package contains a file outside the whitelist |
| `BUNDLE_SYMLINK` | The package contains a symbolic link |
| `BUNDLE_TOO_LARGE` | Exceeds the limits on file count, single file size, total size or path length |
| `BUNDLE_NETWORK_REFERENCE` | The static scan found a network reference |
| `BUNDLE_HASH_MISMATCH` | The recomputed `contentHash` does not match the manifest |
| `BUNDLE_ENTRY_MISSING` | The file that `runtime.entry` points to does not exist |
| `BUNDLE_CONTRACT_UNSUPPORTED` | `runtime.contract` is not a published contract |
| `COMPOSITION_ROOT_MISSING` | The entry page has no `[data-composition-id]` root element |
| `COMPOSITION_TIMELINE_MISSING` | The contract's frame-access entry point never appears |
| `COMPOSITION_SEEK_MISMATCH` | The time read back after a seek is outside tolerance |
| `COMPOSITION_INTRINSIC_MISMATCH` | The root element's size, frame rate or duration does not match the manifest |
| `COMPOSITION_NONDETERMINISTIC` | Two renders of the same local time produce different frames |
| `COMPOSITION_NETWORK_BLOCKED` | A request was blocked during runtime |
| `COMPOSITION_SCRIPT_ERROR` | The page script threw an unhandled error |
| `COMPOSITION_RENDER_TIMEOUT` | Initialization or frame access timed out |
| `COMPOSITION_HOST_UNAVAILABLE` | The execution environment failed to start or has exited |

---

## 7. Bake and Degradation

`bakeCodeItem` renders a code-composition instance into an ordinary media asset.

```ts
// Added by this spec
interface BakeRecord {
  bakedAssetRef: VersionRef;           // the ordinary media produced by rendering
  sourceBundleRef: VersionRef;         // the original code package version
  parameterValuesHash: string;
  timeMapHash: string;
  outputProfileHash: string;
  bakedAt: string;
  status: 'current' | 'stale';         // becomes stale after the source package, parameters or timeMap change
  encoding: { container: 'mov'; codec: string; pixelFormat: string; alpha: boolean; fps: Rate; frames: number };
}
```

- Baking samples frames at the frame rate of the sequence containing the instance or of the export: frame k has local time `t = k / fps`, not the package's `intrinsic.fps` (§5.4). A newly placed instance from `compositions_import` sits on the root sequence and uses the root sequence's frame rate; `replace` uses the frame rate of the sequence containing the instance being replaced.
- **Encoding.** The first version outputs QuickTime `.mov`: ProRes 4444 (`yuva444p10le`) when `output.alpha` is true, otherwise ProRes 422 HQ. The baked result is imported as an ordinary video asset, and `hasAlpha` is recorded truthfully.
- **Where the record lives.** `BakeRecord` is recorded in the source of the baked asset: `provenance` is `{ origin: 'composition-bake', source: BakeRecord }` (video format spec §4.5). Composition instances do not yet have a corresponding field (§3.1, §9). In the first version, `bakedAssetRef` and `sourceBundleRef` initially hold the code package manifest's `bundleId/revision`, because the asset ID is not known until the import transaction's receipt is returned (§9).
- A newly created composition instance uses `prerender` to point at the baked asset, and export goes through the existing pre-rendered stand-in path (video format spec §3.7).
- In the first version, this takes two transactions: first import the code package and the baked asset, then place the composition instance with `insertItems`. Together the two steps are not atomic: if the second step fails, the two imported assets remain in the video and no instance references them. The approach that combines them into one transaction is in §9.

- Bake **keeps** the source code package, parameters, mapping and provenance, and provides “Back to editable source”. Bake does not delete source files.
- After baking, changing parameters or replacing the version marks the baked result as `stale`; the interface prompts a re-bake, or continues using live evaluation.
- When there is only a finished video and no author code, a plain MP4 must not be wrapped as an “editable Remotion composition”.
- Bake and “finished-video-only inputs” are different things: the former keeps a reference back to source code, while the latter must not be disguised as source video.

**Degradation.** When the runtime environment does not meet the package's requirements (for example, missing GPU capability, incompatible Adapter version, or unavailable sandbox):

| Situation | Behavior |
| --- | --- |
| A current baked result exists | Play and export with the baked result, and label its source |
| Only a stale baked result or preview cache exists | May be used for browsing, labeled as stale; must not be used for Export-Exact |
| Neither exists | Show a placeholder and the reason; block strict export that depends on this instance |

Degradation must be visible. A static image or blank frame must not silently stand in for it.

---

## 8. Open Scope

The third-party API names in this document are integration references, not a guarantee of current availability. The implementation must pin the versions of the framework, the browser and the renderer, and only open a feature after its capability has been verified.

| Phase | Scope |
| --- | --- |
| **P0** | Import, validation, frame capture and baking for the controlled Web contract (`cuccut/1`) and the HyperFrames contract (`hyperframes/1`); the execution environment is an Electron off-screen window. p5.js, Three.js and Canvas are integrated according to the subset each one supports |
| **P1** | Importing external Remotion code; richer standalone layer output; checkpoints; an execution environment based on Playwright or headless Chromium |
| **G** | Separation of the three editing layers, immutable versions, conservative invalidation for time dependencies, and Bake keeping source references; applies to every contract that is already open |

The HyperFrames contract enters in the first phase. It is a plan recommendation adopted when the user started implementation on 2026-10-07, not an earlier ruling.

Successful template rendering must not be overstated as support for all existing videos.

---

## 9. Items Pending Review

| Item | Status | What needs to be decided |
| --- | --- | --- |
| `CompositionContext` (§4.1) | Completed by this specification | The form of the drawing target; the interface for asset resolution; whether an audio context is provided |
| Fields of the composition instance (§3.1) | `audioRoute`, `qualityPolicy` and `bake` not yet included | The values for the voice mode and the quality policy; whether the Bake record moves from the source of the baked asset (§7) onto the instance, how this connects with the pre-rendered stand-in, and when the stand-in expires |
| Package directory layout (§2.5) | Partly decided | Decided: the first version fixes three file names, `bundle.manifest.json`, `files.manifest.json` and `verification.json`. Pending: whether the other file names are mandatory; and whether `source.filesManifest` is still needed once the file names are fixed |
| `BakeRecord` (§7) | Decided | The first version encodes to QuickTime `.mov`: ProRes 4444 when there is alpha, otherwise ProRes 422 HQ; the record is placed in the `provenance` of the baked asset (§7). Whether it enters the instance fields is covered by "Fields of the composition instance" above |
| Conventions for the parameter Schema (§3.2) | Principles only | The supported JSON Schema subset; the mapping to interface controls; how to mark parameters that affect duration |
| Naming and versioning of `runtime.contract` | Decided | Format `<contract name>/<major version>`; incompatible changes raise the major version, and `adapterContractVersion` takes the same value (§2.2); the first phase provides both `cuccut/1` and `hyperframes/1` |
| Coverage of `contentHash` (§2.2) | Partly decided | Decided: `files.manifest.json` is not counted in `entries` (if it were, it could not list its own digest). Pending: the `contentHash` of the manifest and the tree digest of directory assets (video format specification §4.3) use different algorithms; either unify them or state how the two relate |
| Atomicity of import (§7) | Two transactions in the first version | Path to atomic import: let the composition instance's `ItemInput` accept `assetImportRef` (the command and protocol specification §4.2 already allows video, image, whiteboard and audio instances to reference a `ref` from `importAsset` in the same transaction). Then import and placement become one transaction. Until then, `bakedAssetRef` and `sourceBundleRef` in `BakeRecord` use the `bundleId/revision` of the code package manifest as placeholders; they are not asset references |
| Data form of `cue-track` | Not decided | The structure of the cue data passed to the code |
| Format of checkpoints | Not decided | How authors declare, and implementations save, state |
| Remotion licensing and transparent export | To be verified | Decided: not distributed with the application; uses the code package's own dependencies (§4.6). For transparent export, confirm which modes work in the actual version |
| First batch of P0 templates | Not decided | Quantity, types and licensing |
