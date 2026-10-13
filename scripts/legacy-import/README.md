# legacy-import

Imports cuccut-app `.ccut` projects and external video project directories into videos (`cuccut.video`). This keeps the manual batch-import entry point. The reusable conversion core has moved to [`@cuccut/legacy-import`](../../packages/legacy-import/README.md) and is also used by Runtime startup migration. It writes videos only through the public protocol of `engine-host` and never touches `video.db` directly.

The output is the instance model of video format version 3 (`schemaVersion: 3`). The field-by-field mapping rules are in [Element model mapping](../../docs/design/timeline/element-model-mapping.md), section 5. The “Mapping” section below is a summary.

For v1/v2 detection at startup, settings and credential migration, and completion markers, see [Architecture design §2.7](../../docs/architecture/architecture-design.md#27-startup-migration-of-historical-versions). The CLI usage below is unchanged.

## Usage

Requires Node 22.18+ (to run `.ts` directly), `ffprobe`, and a built engine:

```bash
cargo build --release -p engine-host
```

Dry run first (writes no videos; produces only a report and a per-video write plan):

```bash
node scripts/legacy-import/import.ts \
  --ccut "$HOME/Library/Application Support/CucCut/projects" \
  --external /path/to/external-project \
  --report /tmp/legacy-import-dry --dry-run
```

Real import into one project folder (one video per legacy project, one subdirectory each):

```bash
node scripts/legacy-import/import.ts \
  --ccut "$HOME/Library/Application Support/CucCut/projects" \
  --external /path/to/external-project \
  --out /Volumes/ExtremeSSD/CucCut/projects/legacy-import
```

Verify after importing: media are still found at their original paths and were not moved into the video directory, document bodies are readable, every instance uses schema-v3 fields, and the body of each cut-point set holds. When `import-report.json` is in the directory, also check that the videos in the report were written and that there are no failed imports or missing media. If these problems exist, or the directory has no videos, the exit code is 1. A batch cannot be reported as complete just because missing media were skipped:

```bash
node scripts/legacy-import/verify.ts /Volumes/ExtremeSSD/CucCut/projects/legacy-import
```

| Parameter            | Meaning                                                                                                                 |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `--ccut <dir>`       | A `.ccut` project directory, or a directory containing them; may be given multiple times                                |
| `--external <dir>`   | An external video project directory (containing `project.json`); may be given multiple times                            |
| `--out <project folder>` | Where the videos are written                                                                                        |
| `--report <dir>`     | Where the report is written; defaults to the same as `--out`                                                            |
| `--only <name fragment>` | Import only projects whose name contains this fragment; may be given multiple times                                 |
| `--dry-run`          | Dry run: does not start the engine; the report is written as `import-report.dry-run.md`, and a write plan per video is left under `plans/` |
| `--replace`          | If the target video already exists, delete it and rebuild (default: resume the previous import)                         |
| `--engine <path>`    | `engine-host` executable; default `target/release/engine-host`                                                          |
| `--ffprobe <path>`   | Defaults to `CUCCUT_FFPROBE` or `ffprobe` on `PATH`                                                                     |

The exit code is 1 when any project import fails. The reports are `import-report.md` (for people) and `import-report.json` (per-project detail).

## What it does and does not do

- **Media is linked, not copied**: all media are registered with `storage: 'linked'` at their original paths, and the video directory's `blobs/` is empty. To collect them into the video directory later, use the engine's `collectAssets`. If a file has been moved, use `relinkAsset`.
- **Safe to re-run**: each step is one transaction. `commandId` is fixed as `legacy-import:<step>`, and the label carries a content digest. The 200-character label limit keeps the digest first, and overly long file-name notes are truncated. On re-run, steps already committed with unchanged content are skipped. If content has changed, the import stops and asks for `--replace` instead of silently stacking a second copy.
- **Writes only through the engine**: every instance, keyframe, transition, ducking rule and cut-point set goes through `engine-host` operations. Engine validation applies as usual, and nothing the engine does not accept is written.
- **Out-of-range values are clamped or dropped, and both are recorded**: the report counts “values clamped into range” (夹到范围里的值) and “not written” (没有写进去的) item by item, and each is explained in the warnings. When the engine rejects an instance, optional fields are removed group by group (`fx`, `mask`, `animate`, envelopes, follow policies, …) and the write is retried. Which groups were removed is also recorded under “not written”. It counts as a failure only if the instance still cannot be written.
- **Import extensions carry only source notes**: `extensions["cuccut.import"]` keeps only the legacy ID (`sourceId`) and the source fields `bcfClip`, `mediaId` and `itemCount`. It does not hold element data. `bcfClip` is the claimed sentence ID, and the correspondence is written separately as an audio-video linked group (see the table below). Values estimated at import (canvas size, audio length without an end point) are counted under “estimated at import” (导入时估算的). Each video has an `import-record` document that records the legacy project path and the import details for that video.
- **Legacy data not imported** (undo history, AI intermediate results, tasks and logs, waveform thumbnail caches, and other regenerable files or files unrelated to the final cut) is listed in the report under “legacy data not imported” (没有导入的旧数据).
- **Subtitle projection compatibility**: a sentence's word members prefer `sourceWordIds`. When a legacy projection has only `cueIds`, the members are restored by subtitle line. If a line is missing, a word reference is empty, or a reference is invalid, that projection is abandoned and reported, and the original transcript is kept. Line breaks, segments, stage fingerprints and word pre-attach markers are written into the formal fields defined in video format §5.2.
- **Long titles**: when a `.ccut` project title exceeds 200 Unicode characters, the video's display name is truncated and counted under `clamped.video-name`. The full original title is kept in the report and in the video's `import-record` document.

## Mapping

| Legacy data                                               | Written as                                                                                                                                        |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Main media and `clips`                                    | `video` (or `audio`) instances split at cuts, `role: 'a-roll'`; default placement writes `mode: 'fullscreen'`, `fit: 'contain'`, `bg` taken from `main.background` or black |
| Element `place`, `fx`, `mask`, `tile`, `animate`, `mode`, `fit`, `bg` | Same-named instance fields, carried over as-is; `opacity` clamped to [0, 1]; unknown `place` keys dropped                                |
| Element `kind`                                            | Same-named instance type; `text` with `counter` is written as `counter`, not `text`; media stickers point to image, video or Lottie assets, with `loop` and `fillOverrides` kept as-is; `srcStart` and `rate` have no counterpart (counted under “not written” (没有写进去的)) |
| Code project (`entry` + `data.json`)                      | `composition` instance; the source is the code package, and the pre-rendered stand-in is the rendered final cut: take the in-project file recorded by `media`; if none is recorded or the file is missing, take the single video under the project root and `out/`, and if there are several, the one whose filename equals the composition ID. A composition with no final cut found is not imported and its code package is not registered; it is counted under “not written” (没有写进去的) as `没有预渲染替身的代码合成` (code composition without a pre-rendered stand-in), and the warning lists each project and composition. A project with only such compositions is still imported as a video |
| Lottie source                                             | Registered as a link like other sources; the engine recognizes it as a `lottie` asset by content; size and duration are read by the rendering core                                |
| Element `keyframes` (`x`, `y`, `scale`, `scaleY`, `rot`, `opacity`, `radius`) | Keyframe bindings on the sequence; seconds fall to frames within the instance (only the first is kept when several land on the same frame); percentages kept; easings not in the easing table become linear |
| Volume `volume` and volume keyframes                      | Linear multiplier clamped to [0, 4]; volume keyframes become the instance's `envelope`; fade in/out clamped to [0, 5] seconds                     |
| Video element `transitions.in` / `out`                    | One-sided transitions: `in` at the start of the instance, `out` at the end; length clamped to [0.1, 2] seconds; if the instance is too short, the engine shortens the effective length, and the report lists each case |
| Audio element `duck`                                      | Ducking rule: `under: 'speech'` triggers from the transcript; `under: <track>` triggers from that track's instances; depth clamped to [0, 60] dB; instances with the same trigger and parameters are merged into one rule |
| Word anchor `~源:词`                                      | `speech-anchor` follow policy, pointing at the current version of the transcript document; the final-cut time is computed across cut points; elements whose time cannot be computed are not imported |
| `cuts` on a source                                        | One cut-set document per source (`cuccut.cut-set/1`, exact timing), applied to that source's audio and video instances; other instances `follow-cuts` |
| Elements with no end point                                | `untilSequenceEnd`                                                                                                                                |
| Hidden, muted and locked elements and tracks              | Instance `enabled: false`; track `visible` / `muted` / `locked`                                                                                   |
| `template`                                                | The sequence's template layer, carried over as-is                                                                                                 |
| External project dB volume                                | Linear multiplier                                                                                                                                 |
| External project code composition (`hyperframes`)         | Not imported: external projects do not record render results, so the composition has no pre-rendered stand-in; counted under “not written” (没有写进去的) as `没有预渲染替身的代码合成`; the code package is not registered, and tracks holding only the composition are not created |
| Narration `bcfClip` (claims a spoken sentence in a code composition) | The composition instance with its stand-in and the narration instance that claims it share the same `linkGroupId` (`narration:<composition ID>`); the composition's sound is turned off and counted under “objects written into the sequence” (写进序列的对象); if the composition was not imported, the narration is imported as plain audio and counted under “not applicable” (不适用). Behaviours that follow the code, such as per-sentence ducking, pinning position or regenerating narration, are not ported |
| External project subtitles                                | One subtitle document (sequence clock), one boxed-caption style document (`cuccut.boxed-caption-style/<N>`) and one subtitle instance; the subtitle animation preset `animationPresetId` is not carried over (the external tool's preset name does not say how per-word animation is drawn, and the final cut has no per-word effect); counted under “not written” (没有写进去的), with one warning per preset |

## Testing

```bash
CUCCUT_ENGINE_HOST=<engine-host> node --test scripts/legacy-import/legacy-import.test.ts
```

The tests build old projects in a temporary directory with `ffmpeg` (every element kind, geometry, effects, transitions and shortening, ducking, keyframes, word anchors, cut-point sets). The group that only checks the plan does not need the engine. The group that goes through the engine imports three times (first run, unchanged re-run, `--replace`), then runs the verification script. Without `CUCCUT_ENGINE_HOST` or `ffmpeg`, the corresponding group is skipped.

## Files

| File                    | Contents                                                                                  |
| ----------------------- | ----------------------------------------------------------------------------------------- |
| `import.ts`             | Command-line entry point: collects the plan, runs it, writes the report                   |
| `ccut-project.ts`       | `.ccut` project → import plan                                                             |
| `external-project.ts`   | External video project → import plan                                                      |
| `video-plan.ts`         | Data structures for the plan and report (pure data, does not touch the engine)            |
| `video-writer.ts`       | Writes the plan to video through `engine-host` (idempotent, step-by-step transaction)     |
| `engine-host.ts`        | stdio JSON-lines client for `engine-host`                                                 |
| `exact-time.ts`         | Float seconds → exact time (frames, MediaTime, rational frame rates)                      |
| `verify.ts`             | Verification after import                                                                 |
| `legacy-import.test.ts` | Import tests on synthesised old projects                                                  |

Type check: `npx tsc -p scripts/legacy-import`.
