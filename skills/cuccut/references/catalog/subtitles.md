---
description: Transcript and subtitle mechanics - transcribing, polishing and writing back, translating yourself, creating caption layers, translating with the configured text model, reading transcripts to write summaries and articles. Read before transcribing, polishing, translating or creating caption layers.
---

# Transcripts and subtitles: transcription, polishing, translation, caption layers

## When to use

- There is media (a link, a local file, an existing video) to transcribe or subtitle.
- A transcript needs polishing or proofreading.
- Translated or bilingual subtitles are wanted; the translation needs updating after the source changed.
- Summaries, articles, titles and descriptions are to be written from the video's content (by reading the transcript).

How to polish, translate and summarize is the crafts' business: {{skill:subtitle-workflow}}, {{skill:polish-transcript}}, {{skill:translate-subtitles}}, {{skill:video-summary}}, {{skill:video-blog}}, {{skill:titles-and-description}}. This page covers only calls and receipts.

## Preflight

- Which video to work on: look at the document list with {{tool:videos_inspect}}. kind `speech` is a transcript, `translation` is a translation, `caption` is a caption layer's document. Reuse what exists: do not transcribe again when a transcript exists, and edit an existing translation in the same language.
- Before transcribing, call {{tool:models_capabilities}} (capability `transcribe`) to see whether a transcription service is available.
- Source language, names and terms: note them when the user mentions them. Pass the language to {{tool:transcribe}}'s {{arg:language}} when transcribing; pass names and terms as {{arg:hint}} only when the transcription model accepts recognition hints: only when the model you will use in {{tool:models_capabilities}} (the default one when no model is given) has `acceptsHint` true. The default MOSS does not accept them; if passed, it still transcribes normally, but the hint is ignored and the transcription job carries a `hint-ignored` warning. In that case, leave names and terms to polishing; do not switch models just to use hints.
- Source metadata: assets imported from a link have the title, uploader, description and author chapters in `assets[].source` in {{tool:videos_inspect}} (see [media](media.md)). Use it as background reference when polishing, and as one piece of evidence when naming speakers.

## Commands and examples

### Transcription

| Input | Call |
| --- | --- |
| Link | {{tool:transcribe}}, {{arg:url}}: creates the video, downloads, places it on the timeline, transcribes, creates caption layers |
| Local file | {{tool:transcribe}}, {{arg:file}}; optionally {{arg:name}} |
| Existing video | {{tool:transcribe}}, {{arg:video}}; give {{arg:asset}} when there is more than one asset |
| Polish before adding subtitles | Add {{arg:noCaptions}}: caption layers are created after polishing |
| The user says outright they only want transcript files | Add {{arg:noVideo}}: writes only TXT and SRT, no video created; for local files you can give {{arg:outDir}} |

Optional: {{arg:language}} (auto-detected when not given), {{arg:hint}} (names, terms, proper nouns; only for models that accept hints, see Preflight), {{arg:diarize}} (separate speakers). When this asset already has a transcript in the video, a second one is not added to the same video: by default ({{arg:target}} new-video) another video is created that links the same asset; with {{arg:target}} replace, the current transcript is replaced, carrying over translations, captions and dubbing in one undoable transaction (with {{arg:translations}} discard, translations are not carried over). When the user edited the transcript after transcription, replacing is refused with `TRANSCRIPT_EDITED`: ask the user first, and add {{arg:acceptEdited}} once they confirm those edits may be dropped.

Re-transcribe (into another video or by replacing) or switch models only when the user asks or the result is unusable: do not re-transcribe just because you think recognition is not good enough; fix a few typos and misheard names and terms while polishing ({{skill:polish-transcript}}). When the result is unusable (empty, wrong language detected, long stretches of garbage), re-transcribe once without asking first, passing the correct {{arg:language}} if the language was wrong; afterwards, tell the user what was unusable in the first result, what the re-transcription changed and how its result turned out; if it is still unusable, stop and ask the user.

### Polishing and writing back

1. Read the transcript with {{tool:documents_read}} ({{arg:documentId}} for the speech document).
2. Fix the text following {{skill:polish-transcript}}; word timings stay unchanged.
3. Write back to **the same document** with {{tool:documents_put}}: {{arg:document}} is its documentId and {{arg:body}} the complete fixed body. To guard against concurrent changes, pass {{arg:revision}}: this is the **video's** revision ({{tool:videos_inspect}}, or `revision` in the receipt of the previous write command), not the document revision of the same name in the {{tool:documents_read}} result; a wrong one is refused with `PROJECT_REVISION_CONFLICT`.

### Naming speakers

The transcript body has `speakers[]` (each with `id` and `name`), and each word's speaker points to its `id`. The names assigned automatically after speaker separation are placeholder names: "Speaker n" and its equivalents in other UI languages (`说话人 1`, `Sprecher 1` …), the recognition service's numbered labels (`SPEAKER_00`, `S1`, `spk-1`), empty, or equal to the id. When several speakers still have placeholder names, at the end of polishing look for evidence to name them following {{skill:polish-transcript}}; when unsure, keep the placeholder name. Write back with {{tool:documents_put}} to the same transcript, changing only `speakers[].name` and keeping `words` and the other fields exactly as read; overwrite only placeholder names and leave names the user gave alone; when one person was split into several ids, give them the same name but do not merge the ids.

### Translating yourself (the default path)

You do the translation yourself, not {{tool:translate}}:

1. **Read the transcript again after polishing and writing back.** Read the speech document with {{tool:documents_read}}; `translationBasis` in the result gives `sourceBasis` and the split sentences (each with `id`, `fingerprint`, `text`, `wordIds`, and its start and end on the asset clock, `start` and `end`, in seconds). Polishing changes sentence splits and fingerprints, so you must read again after polishing.
2. **Translate sentence by sentence**, following {{skill:translate-subtitles}}: one sentence for one sentence, no merging, splitting or skipping.
3. **Write the translation.** Create it with {{tool:documents_put}}: {{arg:kind}} `translation`, {{arg:language}} the target language (BCP 47), {{arg:sourceDocument}} the transcript's documentId, and {{arg:body}} in the shape described by {{tool:documents_read}} (`cuccut.translation/2`), with the `sourceBasis` from this read. Fill each sentence's `alignment` as described, or write null to let the Runtime fill in sentence-level alignment. When a translation in the same language already exists, update it by passing {{arg:document}}; do not create a second one.
4. **Create caption layers.** {{tool:captions_create}}, {{arg:documentId}} the translation; for bilingual, add {{arg:bilingual}} (translation primary, original secondary; if the transcript has no original caption layer yet, it is created in the same edit).
5. **Export if files are wanted.** {{tool:export}}, {{arg:kind}} `subtitles`, {{arg:format}} `srt` and so on; for bilingual add {{arg:bilingual}} (see [export](export.md)).

<!-- surface: cli -->
The body is large: write it to a file and pass it with `--body @translation.json`; do not cram it into the command line (see "How to write arguments" in [conventions](../conventions.md)).
<!-- /surface -->
<!-- surface: agent -->
Write the whole translation in one {{tool:documents_put}} call, not in several.
<!-- /surface -->

After the source changes (polishing, editing), the translation goes stale: read the transcript again, keep units whose sentence `id` and `fingerprint` both still match, retranslate the rest, and write back to the same translation. Caption layers built from this translation need not be rebuilt: when writing back, the Runtime replaces only the captions of changed sentences in the same edit, keeping their timing (`syncedCaptions` in the receipt).

### Creating caption layers

{{tool:captions_create}}, {{arg:documentId}} the transcript (original-language captions) or a translation (translated captions); for bilingual, pass the translation with {{arg:bilingual}}. CucCut aligns timing by sentence and splits into captions by width; do not write caption documents or assemble caption instances yourself.

Each call on the same document adds another layer rather than overwriting: before calling, check with {{tool:videos_inspect}} whether one was already created; when the user wants it redone, first explain that it adds a layer and ask whether to delete the old one.

### Translating with the configured text model (only when the user explicitly asks)

{{tool:translate}}: {{arg:video}} + {{arg:to}} writes a new translation and creates caption layers; or {{arg:file}} (SRT / VTT) + {{arg:to}} translates into a new file without touching any video. Optional {{arg:style}}, {{arg:glossary}}, {{arg:bilingual}}. Without a configured text model it is refused with `CAPABILITY_NOT_CONFIGURED`: follow `next` and switch to the translate-yourself path above; do not ask the user to configure one.

### Reading the transcript to write summaries, articles and titles

Plain-text outputs are not written back to the video (unless the user wants chapters; see [editing](editing.md)):

- A timestamped transcript: {{tool:export}}, {{arg:kind}} `transcript`, {{arg:format}} `md`, {{arg:timestamps}}; read the file at `path` in the result. These times are times on the edited timeline; take key points' times from it, do not estimate them.
- Just the text: {{tool:export}}, {{arg:kind}} `transcript`, {{arg:format}} `txt`; or read the transcript's sentences with {{tool:documents_read}}.
- With several transcripts, export is refused with `EXPORT_SOURCE_AMBIGUOUS`, listing the candidates; specify one with {{arg:documentId}}.

## Reading the results

- {{tool:transcribe}} completed: `pipeline.summary.documentId` is the new transcript, `summary.captions` the caption layers, and `summary.videoId` the video when one was created. With a url, if there is no documentId, use {{tool:videos_inspect}} to find the speech document whose source asset is this asset; with a url there are also `summary.description` (the truncated description) and `summary.sourceChapters` (the number of author chapters); when greater than 0, chapter with {{tool:chapters_adopt}} (see [editing](editing.md)).
- {{tool:documents_put}}: the same receipt as an edit (new `revision`, `transactionId`), plus the document's `documentId`; `filledAlignments` is how many sentences the Runtime filled alignment for, and `syncedCaptions` is the number of caption documents whose captions were swapped along with an existing translation. A body identical to the previous one produces no new revision.
- {{tool:captions_create}}: `documentId` (the caption document), `trackId`, `itemIds`, `cueCount` (the number of captions), `enabled`; bilingual also has `pairedOriginal` (`created` true means the original layer was created along with it this time). A non-empty `existing` means this document already had caption layers.

## Common error codes

| Error code | Next step |
| --- | --- |
| `CAPABILITY_NOT_CONFIGURED` (transcription) | No usable transcription service: pass it on to the user following `next`, or install a local model bundle per [models](models.md); stop here |
| `CAPABILITY_NOT_CONFIGURED` ({{tool:translate}}) | No text model configured: translate yourself; do not ask the user to configure one |
| `TRANSLATION_UNALIGNED` | The translation has sentences whose `alignment` is null and the Runtime cannot fill: read the transcript again, check sentence `id` and `fingerprint`, then write the translation again |
| `CAPTIONS_NOT_ON_TIMELINE` | The document's source asset is not on the timeline: place it on the timeline first, or use another document |
| `CAPTIONS_EMPTY` | No captions to display: check whether the document is empty |
| `PROJECT_REVISION_CONFLICT` | See "Revision conflicts" in [conventions](../conventions.md) |
| `EXPORT_SOURCE_AMBIGUOUS` | More than one document: specify one with a documentId from `candidates` |

## Next steps

- Caption layers are done and the user wants files: go to [export](export.md).
- Dubbing is wanted: go to [voice](voice.md), with the translation you just wrote.
- A talking-head cut or chapters are wanted: go to [editing](editing.md).

## Acceptance

- The transcript, translations and caption layers are all in the video, with no duplicate transcripts or caption layers; no re-transcription or model switch that the user did not ask for and the result did not need; for any re-transcription because the result was unusable, the user has been told why and how the new result turned out.
- Polishing came before translation, and the translation used the sentences read again after polishing.
- With several speakers, those with enough evidence have real names; placeholder names kept are explained in the report.
- The number of translated sentences equals the number of transcript sentences; terms and proper names are consistent throughout.
- The number of captions (`cueCount`) is reported to the user; where captions sit in the picture has to be seen in the editor or the exported video, not in frames.
