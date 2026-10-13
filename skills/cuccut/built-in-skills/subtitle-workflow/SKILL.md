---
name: subtitle-workflow
description: Use when the user gives a video link or local media to transcribe, caption, or subtitle in another language or bilingually - create an editable video, transcribe, polish, translate if needed, add the caption layer, then export subtitles or the video. Not for translating text unrelated to a video.
version: 2.0.0
---

# Transcription and subtitles

The user drops in a link or a file and says "add subtitles". The deliverable they want is an editable video: the asset on the timeline, the transcript polished, a translation when needed, the caption layer on the picture; afterwards they can change a word, move a cue or switch languages in the editor, and export files from the video when they want them. Do not hand over only a subtitle file that was downloaded and edited: they cannot edit that, nor put it back on the video.

The easiest way to get it wrong: steps out of order. Build the caption layer right after transcribing and then polish, and the caption layer has to be deleted and rebuilt; translate before polishing, and the whole translation is stale; start over when continuing across turns, and the user waits twice. So always follow this order: confirm -> create the video and import -> transcribe -> polish (including naming speakers) -> chapters (side path) -> translate -> build the caption layer -> export -> delivery notes. Wait for each step's tool receipt or job completion before moving on; when continuing across turns, first use videos_inspect to see which step has been reached, continue from there, and do not repeat completed steps.

## 1. Confirm first

Before starting, get these things clear; ask once about what is unclear rather than guessing as you go:

- **Deliverable**: source-language subtitles, translated subtitles or bilingual subtitles; whether files are wanted (subtitle files, a finished video with subtitles). "Translate into some language" means translated subtitles; "bilingual" means bilingual subtitles; plain "transcribe" or "add subtitles" means source-language subtitles.
- **Target language**: a BCP 47 tag (such as `zh-Hans`, `en`, `ja`, `es`). When translation is wanted and the user did not say into what, ask once.
- **Source language, names and terms**: note them when the user gives them. The language goes to transcription; names and terms go to transcription as the hint when the transcription model accepts recognition hints (see step 3), and are otherwise used only in polishing. When no language is given, let transcription detect it.
- **Source metadata**: for assets imported from a link, videos_inspect's `assets[].source` has the title, uploader, description (`description`, at most 1200 characters) and the author's chapters (`chapters`); when transcription or download completes, `pipeline.summary.description` and `pipeline.summary.sourceChapters` also give the description and the number of author chapters. Polishing, speaker naming and chapters all use it.
- **Which video to work on**: work on the video open in the editor or the one the user names; use videos_inspect to see the existing assets, transcripts, translations and caption layers, and reuse what exists.
- When the user explicitly wants only a subtitle file and no video or project, do not use this workflow; follow the file section of `translate-subtitles` (when only transcription is wanted, deliver the transcript in the downloads directory).

## 2. Create the video and import

- **Link**: transcribe with `url` (language, hint, name and noCaptions are optional); it creates the video, downloads and imports, places it on the timeline, transcribes and builds the caption layer. Pass language when the user gave the source language, and hint when they gave names and terms and the transcription model accepts hints (see step 3). download with `newVideo: true` and `transcribe: true` also creates a video and transcribes, but only with default settings and without building a caption layer. Wait with jobs_inspect until completed: `pipeline.summary.videoId` is the new video and `pipeline.summary.assetId` the asset. A newly created video is kept if a later step fails; do not create it again.
- **Local file**: transcribe with `file` (language, hint and name are optional); it creates the video, imports, places it on the timeline and transcribes; step 3's transcription happens within this step. When you only want a video and no transcription, create one with videos_create (name it after the file; give portrait width and height for portrait footage), and import and place it on the timeline with assets_import (pass place).
- When a link download fails, tell the user how to remedy it per error.details.remedy; do not download it another way.

## 3. Transcribe

- When step 2 used transcribe, or download with `transcribe: true`, transcription is already running; to transcribe an existing video, or to pass language or hint, use transcribe with video (asset is optional; first check models_capabilities for an available transcription service).
- When polishing is planned, add `noCaptions: true` to transcribe: the caption layer is built in step 7 after polishing (by default transcribe builds a layer as soon as it finishes, and one built before polishing has to be deleted and rebuilt).
- **The hint depends on the model**: before passing a hint, check `acceptsHint` in models_capabilities for the transcription model you will use (the default one when no model is given). The default MOSS accepts no hints: transcription runs as usual with a hint passed, but the hint is ignored and the transcription job carries a `hint-ignored` notice. In that case pass no hint and leave names and terms to polishing in step 4; do not switch to a model that accepts hints just to use one.
- **Transcribe once and use it**: do not switch models or re-transcribe (transcribe with `target: replace`) just because you feel recognition is not good enough. A few typos and misheard names and terms are normal, and polishing in step 4 fixes them. Re-transcribe only when the user asks to switch models or re-transcribe, or when the result is unusable (empty, wrong language detected, long stretches of garbage). When the result is unusable, do not ask first: re-transcribe once directly, passing the correct language when the language was misdetected (without it, auto-detection will most likely get it wrong again); then tell the user what was unusable in the first result, what the re-transcription changed and how the new result looks, and if it is still unusable, stop and ask the user. A re-transcription takes minutes, and the user is waiting.
- Wait with jobs_inspect until completed: `pipeline.summary.documentId` is the new transcript (also in `pipeline.summary.documentId` when transcribe was given a url or download had `transcribe: true`).
- When CAPABILITY_NOT_CONFIGURED is returned, tell the user which service to enable per its next, and stop there.

## 4. Polish

Polish the transcript following `polish-transcript` and write back to the same transcript. By default only typos, terms and punctuation change, word for word, with word timings untouched; skip it when the user says not to polish. Polishing must come before translation: it changes the sentence splits.

As that approach says, source metadata is background reference (exact spellings of names and terms are applied only when the speaker is clearly saying them, and nothing is added to the transcript); after polishing and writing back, give real names to placeholder speakers (write a name only with evidence; when unsure, keep the placeholder). When the user says not to polish, still name the speakers.

## 5. Chapters (side path)

Every transcription chapters the video by default, unless the user says not to, or videos_inspect shows the video already has chapters (do not overwrite; when the user wants them redone, follow `video-chapters` and first ask whether to replace or adjust). Chapters are a side path: they do not block translation, caption layers or export; a failure is not fatal - retry at most once, and if it still fails, state the reason truthfully in the delivery notes and carry on with the later steps.

- **Author chapters exist** (`assets[].source.chapters` is not empty, or `pipeline.summary.sourceChapters` is greater than 0, or the description has a timestamp outline such as `0:00 Intro`): use chapters_adopt with video to snap the author's chapters to the starts of the transcript's paragraphs or sentences and write them to the video, rather than chaptering yourself; when `chapters` is empty but a timestamp outline is visible in the description, pass that outline as `outline`. Read `sourceChapters` in the receipt: how many are matched, ambiguous and unanchored, and report them at delivery.
- **No author chapters** (chapters_adopt returning `NO_SOURCE_CHAPTERS` is also this case, not a failure): chapter it yourself following `video-chapters`.
- When the user wants chapters you write yourself, or a different granularity from the author's outline, also chapter it yourself following `video-chapters`, using the author's outline as reference.
- When `ASSET_NOT_PLACED` is returned, the asset is not on the timeline yet: place it on the timeline first.

## 6. Translate

When a translation or bilingual subtitles are needed, translate following `translate-subtitles`. After polishing and writing back, documents_read the transcript again and translate from the translationBasis at that point; when a translation in the same language already exists, update it rather than creating a second one.

## 7. Build the caption layer

Use captions_create to put the subtitles on the picture; CucCut aligns the timing by sentence and splits the text into cues by width:

- Source-language subtitles: documentId is the transcript document.
- Translated subtitles: documentId is the translation document.
- Bilingual subtitles: give the translation document with `bilingual: true`.

Each call on the same document builds another layer; it does not overwrite. Before calling, use videos_inspect to see whether this document already has a caption layer: if it does, do not build another; when the user wants it redone, first explain that an extra layer will appear and ask whether to delete the old one. The receipt gives a transactionId and the cue count; tell the user.

## 8. Export

When the user wants files, use export, wait with jobs_inspect until completed, and tell the user the path in outputs:

- Bilingual subtitle file: kind `subtitles`, `bilingual: true` (the primary document is the transcript, the secondary the translation, one cue per sentence).
- Translation-only subtitle file: kind `subtitles` with language; requires a caption layer in that language already on the picture (step 7).
- Source-language subtitle file: kind `subtitles`, with the transcript as the primary document.
- Finished video with subtitles: export mp4 or webm; caption layers on the picture are burned in.

## 9. What to avoid

- Do not hand over only a subtitle file, unless the user explicitly wants only a file.
- Do not build caption layers before polishing, and do not translate before polishing.
- Do not re-transcribe just because you feel recognition is not good enough; do not switch models just to use a hint.
- Do not build duplicate caption layers on the same document; do not recreate a video that was already created.
- Do not start over across turns: first use videos_inspect to see how far it got.
- Do not retry failed chapters again and again, and do not let them block the later steps.

## 10. Delivery notes

Written for the user: say clearly what they got and where they need to take a look themselves:

- Where the video is: its name and location; whether it was newly created or the user's own.
- Caption layers: which layers were built (source, translation, bilingual), and how many cues each.
- Files: the exported paths.
- What polishing changed and which terms were unified; the translation's target language and sentence count.
- Speakers: who was named; who has no evidence and still has a placeholder name.
- Chapters: how many; whether the author's chapters were used or you chaptered it yourself; author chapter entries that did not match (ambiguous, unanchored); when not done or failed, the reason.
- What is uncertain: transcription errors not fixed, uncertain translations, passages with poor recognition quality.
