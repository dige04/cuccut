---
description: Media mechanics - downloading links, transcoding and merging, grabbing frames, importing assets (link or copy), creating videos, opening portable packages, generating images, and the evidence ladder for understanding a video. Read before downloading, importing, grabbing frames or generating images.
---

# Media: downloading, transcoding, frames, assets and new videos

## When to use

- The user gives a video page link and wants to download it, import it or work on it.
- Local files need compressing, transcoding, merging in order or audio-track extraction (file to file, no video created).
- You need to see the picture: composition, shot distribution, whether captions would cover content, what is on either side of a cut.
- You need to create an empty video, import assets into a video and place them on the timeline, or open a portable package (a `.cuccut` file).
- You need to generate images to put into a video.
<!-- surface: agent -->
- Making slides: importing images into a deck and checking the whole deck.
- Making a design: importing images and fonts into a design and checking the whole design.
<!-- /surface -->

For links and local files that need transcribing, use {{tool:transcribe}} directly (see [subtitles](subtitles.md)): in one step it creates the video, downloads or imports, places it on the timeline and transcribes.

## Preflight

- Downloading needs yt-dlp; transcoding and export need ffmpeg. If missing, the call returns an error with a remedy (see the error codes below).
<!-- surface: cli -->
  `cuccut status` shows both at a glance.
<!-- /surface -->
- For existing videos, first {{tool:videos_list}} / {{tool:videos_inspect}}: whether the asset was already imported and whether there is a transcript; reuse what exists and do not import it again.
- Before generating images, call {{tool:models_capabilities}} (capability `generateImage`) to see whether a model is available and the allowed range of sizes and counts.

## Commands and examples

### Downloading from a link

| What to do | Call |
| --- | --- |
| Download and create a video (default) | {{tool:download}}, {{arg:url}} with the link, {{arg:newVideo}}; optionally {{arg:name}}, {{arg:project}} |
| Create a video and transcribe | As above plus {{arg:transcribe}} (or {{tool:transcribe}} directly with {{arg:url}}) |
| Import into an existing video | {{tool:download}}, {{arg:url}} + {{arg:video}} |
| Download into a project only | {{tool:download}}, {{arg:url}} + {{arg:project}} |
| Just the file (the user says so outright) | {{tool:download}} with only {{arg:url}}: lands in the downloads directory |
| Also fetch the platform's subtitles | Add {{arg:subs}} (a list of languages); subtitle files go next to the media and are not imported into the video |
| Audio only | Add {{arg:audioOnly}} |

Give exactly one of {{arg:video}}, {{arg:newVideo}}, {{arg:project}}. Only single videos are fetched, not playlists.

When transcription is wanted and you know the language or have names and terms, use {{tool:transcribe}} directly with {{arg:url}}, passing {{arg:language}} and {{arg:hint}} (optionally {{arg:provider}}, {{arg:diarize}}): it downloads, creates the video, transcribes and creates caption layers; {{tool:download}}'s {{arg:transcribe}} transcribes with default settings only and does not create caption layers.

### Transcoding, merging, extracting audio

{{tool:transcode}} takes only local files and outputs new files; the original files are untouched and no video is created:

| What to do | Key parameters |
| --- | --- |
| Compress (one by one by default) | {{arg:files}}; {{arg:maxHeight}} (e.g. 1080), {{arg:crf}} (lower is sharper and larger), {{arg:codec}} (h264 or hevc) |
| Merge into one, in order | {{arg:files}} in the order you want, {{arg:merge}} |
| Extract the audio track of each file | {{arg:extractAudio}} (no re-encoding when stream copy is possible) |
| Choose the output directory | {{arg:outDir}}; the downloads directory when not given |

### Grabbing frames to look at the picture

{{tool:videos_frames}}: {{arg:at}} lists moments on the timeline, or {{arg:range}} (`start:end`) plus {{arg:count}} samples at even intervals; at most 24 frames per call; {{arg:maxWidth}} scales down and {{arg:format}} picks png or jpeg.

- A frame is the source picture of the topmost video item at that moment, **not the rendered finished video**: captions, text, stickers and overlaid elements are not in it, and picture-in-picture position, cropping and effects are not applied. To check caption placement or overlays, export a short piece of the finished video ({{tool:export}} with a range) and look at that.
- Each frame also gets face detection (local, with the YuNet model bundled with the app): `faces` are face boxes, with coordinates normalized to 0–1 by the frame's width and height, matching the source picture. When composing around people (for example, a vertical crop that follows the speaker), read `faces` rather than estimating positions by eye; when `detector` is null, detection is unavailable and an empty `faces` does not mean nobody is there, so look at the image.
<!-- surface: cli -->
  You can also view the rendered picture and drag things into place in the web editor; see [web](web.md).
<!-- /surface -->
- When there is no video item at that moment, `file` is null; this is not an error.

### Creating videos, importing assets, opening portable packages

| What to do | Call |
| --- | --- |
| Create an empty video | {{tool:videos_create}}, {{arg:name}}; for vertical footage give vertical dimensions (e.g. 1080×1920), and match the footage's frame rate |
| Import and place on the timeline | {{tool:assets_import}}, {{arg:path}} + {{arg:place}} (without place it is only registered as an asset) |
| Import a generated artifact (speech, images, music WAV, etc.) | {{tool:assets_import}}, {{arg:artifactId}} (no regeneration) |
| Copy into the video | {{tool:assets_import}} with {{arg:storage}} `managed` |
| Combine with other changes in one edit | `importAsset` + `addItem` in {{tool:edits_apply}}, connected with `ref` (see [editing](editing.md)) |
| Open a portable package | {{tool:videos_import_package}}, {{arg:file}}; optionally {{arg:name}} |
| Create a project | {{tool:projects_create}}, {{arg:path}} (only when the user asks) |

Imports **link** to the original file by default rather than copying it: if that file is later moved or deleted, the asset goes missing. When the user asks for it to be copied into the video, or the file is a temporary file you generated and will clean up, use `managed`; to pull already-linked assets into the video, use `collectAssets` in {{tool:edits_apply}}.

### Generating images

{{tool:image}}: {{arg:prompt}}; optionally {{arg:size}}, {{arg:count}}, {{arg:seed}}, {{arg:provider}}, {{arg:model}}, {{arg:video}} (results are imported as that video's candidate assets, not placed on the timeline). Reference images are not accepted. When to draw and what to draw are decided by each craft (covers, B-roll, narrated-video visuals, storyboards, illustrations for articles and slides); this section only covers how to draw.

**Check capabilities first**: {{tool:models_capabilities}} with {{arg:capability}} `generateImage`. `effective` is what is used when no service is specified (when null, calls that do not specify a service are refused), and `usableProviders` are the services that can be used; then look at the chosen model's `sizes`, `aspectRatios`, `maxCount`, `maxPromptChars`, `acceptsSeed`, `cost` and `notes`. Services differ a lot:

- Local (`local`) never becomes the default automatically: when `effective` is not local, submit with {{arg:provider}} `local` and {{arg:model}}. A local model's prompt limit may be only around a thousand characters; it makes one image at a time, and each takes from a few minutes to over ten.
- Agent services (such as `agent:codex`) may not accept size or seed: for a model whose `sizes` and `aspectRatios` are both empty, do not pass {{arg:size}} or {{arg:seed}}; state orientation and composition in the prompt and crop when you use it.
- For a model with `maxCount` 1, submit as many times as images you need; services that run one job at a time queue them. When there are many images or the model is slow, tell the user roughly how long it will take first.

**Size**: choose the aspect ratio for where the image is going: video visuals by the frame's aspect ratio (`16:9`, `9:16`, `1:1`), slides and articles by the image frame. Use a ratio from the model's `aspectRatios` or a size from `sizes` for {{arg:size}}; if none fits exactly, take the closest and crop the excess when placing it.

**How to write the prompt**, in this order: subject → appearance or material → setting → light → camera position and composition → style and quality → one fidelity clause (what not to change, what must not appear).

- Write concrete things that can be drawn ("a desk lamp shining on an open notebook"), not abstract words ("efficiency", "growth").
- For a series of images (the same video, the same slide deck), first write a two-to-three-sentence style note: type of picture, color (include values when there is a palette), line and light, density of detail. Include it verbatim in every prompt rather than rephrasing it each time; when the model `acceptsSeed`, use the same {{arg:seed}} across the series. Keep the whole prompt within `maxPromptChars`.
- Do not have the model write text in the image: generated text is often wrong. State in the fidelity clause that there must be no text, letters, watermarks or logos; when text is needed, overlay it with captions, motion graphics or text on the page, and leave a clean side in the composition for it.
- Do not use real brands, works, artists or real people as style references. A generated image only ever "looks like" something: do not draw it as, or present it as, the user's real product, interface, people, places or data; when the real thing is needed, use the user's footage, screenshots or frames.

**Where results go**: a submission is a job; wait for it with {{tool:jobs_wait}} before reading the result. With {{arg:video}}, each image is imported as a candidate asset of that video (the result has an `assetId`); place it on the timeline when you use it. Without it you get only artifacts (each image's `artifactId` in `outputs`); for a file, save it to the working directory with {{tool:artifacts_save}} (pick another name if a file with that name exists), and to put it into a video, use {{arg:artifactId}} in {{tool:assets_import}} rather than generating again.

**Look before using it**: when you can view images, save it as a file with {{tool:artifacts_save}} and look at it: subject and composition, the space that should stay empty, colors, and any stray text, watermarks, or distorted hands and faces. If it fails, revise the prompt and draw once more; if it still fails, do not use it and switch to another source of visuals. Anything you did not look at, say so at delivery.

**When you cannot draw**: there is no usable service, or you get `CAPABILITY_NOT_CONFIGURED`, `GRANT_REQUIRED` or `BUDGET_EXCEEDED`. When images are only part of this delivery, only the drawing step stops: finish the rest using the fallback of the craft at hand (no image, another source of visuals, leave space), and at delivery say in one sentence that image generation was not available and where images were meant to go, with the settings link from `settingsHref`; when images are what the user came for, pass it on to the user as [models](models.md) describes.

**Cost and delivery**: generation takes time, and with online services it also costs money (see `cost`): draw only what will be used, do not draw one after another to experiment, and do not redraw repeatedly. At delivery, say which images were generated, which service and model were used, and where they were saved or which video's assets they went into.
<!-- surface: agent -->

### Slides

A slide deck is a deck directory in the working directory (`deck.json` plus `slides/<id>.html`), whose pages you write directly with file tools; how to make one and its format are in {{skill:slides}}. Only two steps need tools:

| What to do | Call |
| --- | --- |
| Put an image or font from the working directory into the deck | {{tool:slides_import_asset}}, {{arg:deck}} + {{arg:path}}; identical files are stored once |
| Check the whole deck; once it passes, a card appears in the thread | {{tool:slides_check}}, {{arg:path}} is the deck directory; check again after changing pages |

When pages need illustrations, generate them with {{tool:image}} (without {{arg:video}}), save them to the working directory with {{tool:artifacts_save}}, then import them into the deck as in the table above; which pages to illustrate, prompts and sizes are in {{skill:slides}}.

### Designs

A design is a directory in the working directory (`canvas.json` plus one `.dc.html` per artboard), whose files you write directly with file tools; how to make one and its format are in {{skill:design}}, and design systems are in {{skill:design-system}} (files only, no tools). Only two steps need tools:

| What to do | Call |
| --- | --- |
| Put an image or font from the working directory into the design | {{tool:design_import_asset}}, {{arg:canvas}} + {{arg:path}}; the design directory must already have `canvas.json`; identical files are stored once |
| Check the whole design; once it passes, a card appears in the thread | {{tool:design_check}}, {{arg:path}} is the design directory; check again after changing files |

Supporting files such as css, js and json are not imported; write them directly into the design directory and reference them by relative path.
<!-- /surface -->

### Finding shot changes

{{tool:videos_shots}}: where the picture changes within {{arg:range}} (`start:end`, seconds on the edited timeline, at most 20 minutes). Where the item changes and the picture does not continue is an `edit`; sudden picture changes within an item are detected by scene score and are a `scene`. For misses lower {{arg:threshold}} (default 0.3); for false hits raise it; shots shorter than {{arg:minShot}} (default 0.8 seconds) are merged into the previous one.

- It only sees sudden picture changes and does not recognize people: dissolves and push-ins/pull-outs get missed, and flashes may give false hits. For an uncertain change point, look at the frame before it and the frame itself with {{tool:videos_frames}}.
- Each shot's `sampleAt` is 3 moments; pass them straight to {{tool:videos_frames}}'s {{arg:at}}; at most 24 frames per call, so 8 shots.

## Reading the results

- {{tool:download}} / {{tool:transcribe}}: `pipeline.summary.videoId` is the new video and `assetId` the asset; `outputs` holds the `path` of the downloaded file and the transcript. With a link, the summary also has `description` (the truncated description) and `sourceChapters` (the number of author chapters).
- Assets imported from a link: `assets[].source` in {{tool:videos_inspect}} is the source metadata: `platform`, `webpageUrl`, `uploader`, `uploadDate`, `title`, `description` (at most 1200 characters; `descriptionTruncated` is true when truncated), `chapters` (the author's chapters `[{ at, title }]`, given by the platform or parsed from a timestamp outline in the description; `[]` when there are none). It is background reference, not transcript content: when polishing, correct the spelling of names and terms only where the speaker is clearly saying them; when naming speakers, it counts as evidence only when it uniquely identifies one person (see [subtitles](subtitles.md)); write the author's chapters into the video with {{tool:chapters_adopt}} (see [editing](editing.md)).
- {{tool:transcode}}: the `path` in `outputs` (`pipeline.summary.files`) is the output file; tell the user where it is.
- {{tool:videos_frames}}: each entry of `frames` has `at`, `file`, `width`, `height`, `faces`, and which item (`item`) and asset (`asset`) it came from. Read the image at `file`. `faces` is `[{x, y, w, h, score}]`: the box's top-left corner and size, normalized to 0–1 by the frame's width and height, `score` 0–1, sorted by score from high to low; the top-level `detector` is `yunet`, or null when the detector is unavailable (then every `faces` is an empty array). Frames whose `file` is null have no `faces`.
- {{tool:videos_shots}}: each entry of `cuts` has `at` (the second of the new shot's first frame), `score` (null for `edit`) and `kind`; each entry of `shots` has `start`, `end` and `sampleAt`.
- {{tool:assets_import}}: the receipt has `assetId`, `itemId` (null when not placed on the timeline) and the new revision.
- {{tool:videos_create}} / {{tool:videos_import_package}}: return the same summary as {{tool:videos_inspect}}, including `videoId`.
- {{tool:image}}: each image's `artifactId` in `outputs`; with video, also `assetId`.
- {{tool:music}} (see [music](music.md)): `outputs` holds one WAV's `artifactId`; with video, also `assetId`; when the duration budget was reached, `warnings` contains `output-truncated`.
<!-- surface: agent -->
- {{tool:slides_import_asset}}: `src` looks like `/_blob/<id>`; write it as-is into `<img src>` for images, and for fonts into the `src` of that entry in `faces` in `deck.json`; there are also `bytes` and `contentType`.
- {{tool:slides_check}}: `problems` is the total number of problems; at 0, a slide card is recorded in the thread; otherwise `slides` lists each page's `problems`, `deckProblems` are problems in `deck.json` (including font and design system records) and in `ds/`, and `orphans` are page files not in `order`. Each page's `notes` do not count as problems; those starting with `layout` flag content that does not fit or overlaps, and should be fixed where possible.
- {{tool:design_import_asset}}: `src` looks like `/_blob/<id>`; write it as-is into `<img src>`, `url(…)` inside `<helmet><style>`, or `@font-face`; there are also `bytes` and `contentType`.
- {{tool:design_check}}: `problems` is the total number of problems; at 0, a design card is recorded in the thread; otherwise each entry of `issues` has `file` (relative to the design directory; `.` is the whole directory) and `message`, and when they do not all fit, `more` says how many more there are. `notChecked` describes what was not checked: whether artboard scripts run, layout and visual effect.
<!-- /surface -->

## The evidence ladder for understanding a video

To understand a video (what to cut, where the key points are, what is in the picture), go in this order and stop when the evidence is enough:

1. **Import the full original first, and reuse existing transcripts.** Batch-transcribe whatever lacks a transcript ({{tool:transcribe}}).
2. **Locate passages by text in the transcript.** Read the transcript with {{tool:documents_read}}; search across videos with {{tool:space_search}}.
3. **Then grab frames in batches by time**, laid out as a timestamped contact sheet to see composition and shot distribution ({{tool:videos_frames}} with range and count); sample suspicious spans more densely and examine single frames.
4. If you still do not know where the cut points are, find shot changes ({{tool:videos_shots}}) and grab frames per shot to examine.
5. A video understanding model (if configured) comes last: ask specific questions, ask for timestamps, and verify against the original.

Send independent reads all at once; do not ask one frame at a time. Make a change on a representative passage first, read it back to check, then apply it in bulk; after large changes, check again, and reuse results for what did not change.

## Common error codes

| Error code | Next step |
| --- | --- |
| `LINK_LOGIN_REQUIRED`, `LINK_COOKIES_UNAVAILABLE` | The video needs a login: ask the user to handle it using `remedy`; do not look for cookies yourself |
| `LINK_UNSUPPORTED` | The site is not supported: tell the user and ask for another link or a local file |
| `LINK_NETWORK_ERROR` | Network problem: you can retry once; if it still fails, tell the user |
| `LINK_DISK_FULL` | Disk full: tell the user; do not delete files yourself |
| `TOOL_CONSENT_REQUIRED`, `LINK_TOOL_UPDATE_REQUIRED` | yt-dlp needs the user to consent to downloading or updating it: pass it on to the user and follow `next` |
| `EXPORT_TOOL_MISSING`, `MEDIA_TOOL_UNAVAILABLE` | ffmpeg is missing: pass `remedy` on to the user |
| `ASSET_MISSING` | The linked original file was moved or deleted: ask the user to put it back or give its new location |
| `INPUT_TOO_LONG` | The image prompt is too long: shorten it and resubmit |
| `CAPABILITY_NOT_CONFIGURED` | No usable image model: see [models](models.md) |
<!-- surface: agent -->
| `DECK_NOT_FOUND`, `NOT_A_DECK` | The path is not a deck directory (no `deck.json`, or it is not a slide index): check the path |
| `SLIDES_COMPILER_UNAVAILABLE` | CucCut on this machine does not include the slide editor: write the deck files anyway, and tell the user they cannot be checked or opened in CucCut; do not look for a compiler yourself |
| `CANVAS_NOT_FOUND`, `NOT_A_CANVAS` | The path is not a design directory (no `canvas.json`, or it is malformed): check the path; write `canvas.json` before importing assets |
| `UNSUPPORTED_ASSET_TYPE` | Only png, jpg, gif, webp, avif and svg images can be imported; designs also accept woff2, woff, ttf and otf fonts |
<!-- /surface -->

<!-- surface: cli -->
Do not run yt-dlp or ffmpeg yourself to get around these errors.
<!-- /surface -->
<!-- surface: agent -->
Do not use a shell to run a downloader or ffmpeg yourself to get around these errors.
<!-- /surface -->

## Next steps

- Created a video and transcribed it: go to [subtitles](subtitles.md) to polish, translate and create caption layers.
- Assets are on the timeline: go to [editing](editing.md) to edit.
- Files are wanted: go to [export](export.md).

## Acceptance

- State clearly whether the video is new or the user's existing one, with its name and location; no duplicate videos and no duplicate asset imports.
- Output files from transcoding and merging really exist (take `path` from the result), and the original files are untouched.
- Make visual judgments only from frames actually grabbed and looked at; state in the delivery report that frames do not include captions or overlaid elements.
