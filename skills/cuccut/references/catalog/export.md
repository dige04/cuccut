---
description: Export mechanics - the kinds and parameters of subtitles, transcripts, audio, finished videos, portable packages and project files, ranges and output locations, pre-delivery checks. Read before exporting files.
---

# Export: subtitles, transcripts, audio, finished videos and portable packages

## When to use

- The user wants files: subtitle files, transcripts, audio, finished videos (mp4, webm).
- Several cut shorts, one file each.
- Packing the whole video into a portable package for someone else, or exporting a project file for Premiere / Resolve.

## Preflight

- {{tool:videos_inspect}}: whether the documents to export (transcript, translations, caption layers) exist; for a subtitle file of the translation only, the picture must already have a caption layer in that language (create it first with {{tool:captions_create}}).
- The finished video needs ffmpeg and an encoder; if missing, it is refused before submission (`EXPORT_TOOL_MISSING`).
- All assets are present: if a linked original file was moved, deleted or changed, it is refused before submission (`ASSET_MISSING` / `ASSET_CHANGED`).
- Aspect ratio, duration and language follow what the user confirmed; when a horizontal video needs vertical output, first ask whether to letterbox or reframe (reframing is editing; see [editing](editing.md)).

## Commands and examples

{{tool:export}}: {{arg:video}} + {{arg:kind}} + {{arg:format}}.

| File wanted | Key parameters |
| --- | --- |
| Original-language subtitles | {{arg:kind}} `subtitles`, {{arg:format}} `srt` / `vtt` / `ass` / `json` (with word timings) |
| Bilingual subtitles | As above plus {{arg:bilingual}} (the primary document is the transcript, the secondary the translation, one cue per sentence) |
| Subtitles of the translation only | {{arg:kind}} `subtitles`, {{arg:language}} the translation's language |
| Transcript | {{arg:kind}} `transcript`, {{arg:format}} `md` / `txt` / `json`; timecodes at paragraph ends {{arg:timestamps}}, chapter subheadings {{arg:chapters}}, Markdown front matter {{arg:frontmatter}}; speakers are written by default ({{arg:speakers}} `false` to omit); cut parts are skipped by default, pass {{arg:skipCut}} `false` for the whole original |
| Audio | {{arg:kind}} `audio`, {{arg:format}} `wav` / `mp3` / `m4a`; mixed per the timeline |
| Finished video | {{arg:kind}} `video`, {{arg:format}} `mp4` / `webm` |
| Portable package | {{arg:kind}} `portable`, {{arg:format}} `cuccut`: the whole video with its assets in one file, which CucCut elsewhere can open |
| Project file | {{arg:kind}} `project`, {{arg:format}} `xmeml`: assets are referenced by local path; anything that cannot be expressed is recorded item by item as a warning |

General options:

- Purpose: when exporting only for internal frame grabs, checking caption layout or a test listen, you must pass {{arg:purpose}} `preview`; such files stay in the background job and do not go into the session's video card, "Outputs" or Space, and without a directory they are written to `.cuccut-out/exports/` under the working directory. Files for the user (including previews, shorts and segments the user asked for) use `deliverable`, which is also the default when omitted. Do not guess the purpose from duration or file name.
- Range: {{arg:range}} exports only one span of the timeline; {{arg:ranges}} gives several spans, one file each (use it for cutting shorts). Times are seconds on the edited timeline.
- Document: when there are several to choose from, {{arg:documentId}} specifies the primary document, or {{arg:language}} picks by language.
- Location: {{arg:dir}} is the output directory (must already exist), {{arg:fileName}} the file name (only when producing one file); an existing file with the same name is refused by default, and pass {{arg:overwrite}} only when the user agrees to replace it. Without them, files are written to `exports/` under the working directory (`preview` as above), named "video name.kind.extension", with a number added on a name clash.
- Subtitle line width: {{arg:maxCharsPerLine}} (full-width characters count as 2; default 42).

Picture and sound of the finished video:

- Size: {{arg:width}} / {{arg:height}}; giving only one side derives the other from the canvas aspect ratio. Giving both with an aspect ratio different from the canvas **letterboxes** it, without cropping or relayout.
- Encoding and quality: {{arg:codec}} (mp4 defaults to h264, hevc is optional; webm is vp9), either {{arg:crf}} or {{arg:videoBitrateKbps}}, and {{arg:fps}} to change the frame rate.
- Captions: {{arg:burnCaptions}} burns the timeline's captions into the finished video by default; when the user wants "clean picture + sidecar subtitles", turn it off and export the subtitle file separately.
- Sound: {{arg:loudness}} applies loudness normalization (recommended before publishing to a platform); {{arg:source}} takes only the original audio or only one dubbing group (affects only this export, not the video).
- Content that cannot be rendered: {{arg:onUnsupported}} defaults to `fail` (refuse and list each item); `skip` leaves whole layers undrawn, effects unapplied and transitions as hard cuts, **use it only after the user agrees**. The same goes for {{arg:missingAssets}} for portable packages with missing assets.

## Reading the results

- Submission freezes the video's current revision: later changes do not affect this export; re-export after changing.
- When done, each file in `outputs` has a `path` and a verification result. Give `path` to the user exactly as is; do not build paths yourself.
- Internal check files are not deliverables, and are not listed in the completion reply; report problems the check found as they actually are.
- Progress for finished videos is counted in frames (`progress.unit` is `frames`).
- Pass job warnings (skipped content, elements a project file cannot express) on to the user.

## Common error codes

Export runs a preflight before submission; the following errors create no job:

| Error code | Next step |
| --- | --- |
| `EXPORT_SOURCE_AMBIGUOUS` | More than one document: specify one with a documentId from `candidates` |
| `EXPORT_NOTHING_TO_EXPORT`, `EXPORT_SOURCE_NOT_FOUND` | No document to export: transcribe or create caption layers first |
| `EXPORT_RANGE_EMPTY` | Nothing in the range: check the timeline seconds |
| `EXPORT_DESTINATION_EXISTS` | The target file already exists: change the name, or ask the user and then add {{arg:overwrite}} to {{tool:export}} |
| `EXPORT_DESTINATION_UNWRITABLE`, `EXPORT_INSUFFICIENT_SPACE` | The directory is not writable or space is short: tell the user |
| `ASSET_MISSING`, `ASSET_CHANGED` | Assets are missing or changed: ask the user to put the original files back; do not swap assets on your own |
| `EXPORT_TOOL_MISSING` | ffmpeg or an encoder is missing: pass `remedy` on to the user |
| `EXPORT_UNSUPPORTED_CONTENT` | The finished video has content that cannot be rendered: tell the user the `items` and ask whether to use `skip` |
| `REVIEW_BLOCKED` | The user's review standard refuses the finished video: fix each of `findings` as its `fix` says and export again; let one stand only when the user asks (see [review](review.md)) |

## Next steps

- The finished video is exported: check it against the acceptance list below, then deliver.
- To let someone else continue editing: export a portable package; they open it as a new video (see [media](media.md)).

## Acceptance (pre-delivery checks)

- Run {{tool:review_run}} before a deliverable export; a critical finding stops it. See [review](review.md).
- The files really exist, with paths taken from `outputs`.
- Measured: duration, resolution, frame rate, file size and number of captions match the user's requirements (read the job result and the files' media facts).
- Looked at: grabbing frames ({{tool:videos_frames}}) can only check the source picture on the timeline, without captions, text or overlaid elements; caption placement and whether faces are covered have to be checked in the finished video; if you cannot look yourself, ask the user to look, and state in the report that you did not.
- Needs a human to listen: the balance of dubbing, music and voices, and whether cuts flow.
- Aspect ratio, duration, language and deliverables match what the user confirmed; no repeated footage or speed changes to reach a duration.
