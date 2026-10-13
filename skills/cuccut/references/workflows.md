---
description: End-to-end recipes - link to a bilingual-subtitled video, polish then translate, translated dubbing, talking-head cuts, cutting shorts, summaries and writing, transcoding local files, narrated videos. Read the matching recipe before starting a multi-step task.
---

# End-to-end recipes

Each recipe covers only judgment calls and steps: each step names the tool or craft to use; look up parameters and receipts on the matching catalog page. When the user asks for one small thing, just do that thing; do not wrap it in a full recipe.

Before starting any recipe:

- **Ask about what is unclear.** When the user wants some kind of finished video but has not said clearly what, first pin down four things: the subject, the goal (where it will be posted, who it is for, what it should achieve), the audience, and the material at hand; also confirm the deliverables, aspect ratio, duration and language.
<!-- surface: cli -->
  When CucCut has scene templates installed (listed by `cuccut templates`, a local admin command, so ask the user before looking), you can ask the user to pick a template and ask questions following its brief.
<!-- /surface -->
- **Look at what already exists.** For a video the user names or is already working on, first run {{tool:videos_inspect}} to see which step it has reached, and continue from there.
- **Stop when the evidence is enough.** To understand a video, follow the evidence ladder in [media](catalog/media.md): transcript first, then locate by text, then grab frames; send independent reads all at once.

## 1. Link → transcription → bilingual subtitles → finished video

**Applies when**: the user gives a video link and wants subtitles (original, translated or bilingual), possibly also a finished video with subtitles or a subtitle file. **Not this recipe**: the user says outright they only want a subtitle file and no video (see the last row of the decision table); the link is just text to translate.

| Signal | Action | Reason |
| --- | --- | --- |
| The user stated the source language or gave names and terms | First {{tool:download}} to create the video (without transcription), then {{tool:transcribe}} the video with the language and hints | A one-step transcription has no chance to carry these, and recognition quality suffers |
| Polishing or translation is wanted | Do not create caption layers during transcription; create them after polishing and translating | Caption layers created before polishing have to be deleted and rebuilt |
| The user only says "transcribe" or "add subtitles" | Original-language subtitles, no translation | Default meaning |
| The user says "bilingual" | Two caption layers, the translation primary and the original secondary | Default meaning |
| The video needs a login, or the site is not supported | Tell the user using the error's `remedy`, then stop | Download restrictions must not be bypassed |
| The user says outright they only want subtitle files | Do not create a video during transcription, output only TXT and SRT; for translation, follow the files section of {{skill:translate-subtitles}} | The user's explicit request takes priority |

Steps:

1. Confirm the deliverables (which subtitles, whether files are wanted, whether a finished video is wanted) and the target language, following {{skill:subtitle-workflow}}.
2. {{tool:transcribe}} with the link: creates the video, downloads, places it on the timeline and transcribes; do not create caption layers when polishing or translation is wanted. Wait for completion and note the video and transcript IDs.
3. Polish: following {{skill:polish-transcript}}, read with {{tool:documents_read}} and write back to the same transcript with {{tool:documents_put}}. Use the asset's `source` in {{tool:videos_inspect}} (title, uploader, description) as background reference: correct the spelling of names and terms only where the speaker is clearly saying them, and do not add anything to the transcript. After writing back, give real names to speakers with placeholder names, changing only `speakers[].name`, and only with evidence.
4. Chapters (side path): when the author has chapters, snap them to the transcript with {{tool:chapters_adopt}}; otherwise split them yourself following {{skill:video-chapters}}; skip when the user says not to. This does not block later steps; failure is not fatal, retry at most once, and report it truthfully.
5. Read the polished transcript again with {{tool:documents_read}} (pass the target language as translateTo; CucCut shows "Translating"), translate sentence by sentence following {{skill:translate-subtitles}}, and write the translation with {{tool:documents_put}}.
6. {{tool:captions_create}} with the translation and bilingual: the original layer and the translated layer are created together.
7. If the user wants files: {{tool:export}} the bilingual subtitle file; for a finished video, {{tool:export}} an mp4 as well (subtitles burned into the picture).
<!-- surface: cli -->
   To check where the subtitles sit in the picture and whether they cover faces, or to ask the user to review in the editor: open the web editor ([web](catalog/web.md)) and give the user a fresh link at delivery.
<!-- /surface -->
8. Deliver: write the report following the "Delivery" section of SKILL.md.

**Done when**: the video has a polished transcript, a translation in the target language and a set of bilingual caption layers; with several speakers, those with enough evidence have real names and the reason is given for any placeholder names kept; chapters were written into the video, or the report says why they were not done or failed and which author chapters did not match; exported file paths come from the results; the number of captions and translated sentences is reported to the user; any finished-video picture you did not look at is stated truthfully.

## 2. Existing video: polish, then translate

**Applies when**: the video already has a transcript and the user wants translated or bilingual subtitles. **Not this recipe**: only polishing is wanted (stop after step 2); there is no transcript (do the transcription steps of recipe 1 first).

| Signal | Action | Reason |
| --- | --- | --- |
| The transcript still looks raw from recognition (typos, inconsistent terms, messy punctuation) | Polish first | The translation inherits the source's errors; polishing changes sentence splits |
| The user says not to polish | Skip polishing | The user's explicit request |
| A translation in the same language already exists | Edit it, retranslating only the sentences that changed | Do not create a second translation |
| There are several transcripts | Match the one the user means by its source asset; if it does not match, ask | Do not guess |
| The user explicitly wants the configured text model to translate | Use {{tool:translate}} | Only in this case |

Steps:

1. {{tool:videos_inspect}} to find the transcript and any existing translations and caption layers.
2. Polish following {{skill:polish-transcript}} (including real speaker names) and write back to the same transcript with {{tool:documents_put}}.
3. Run {{tool:documents_read}} again (pass the target language as translateTo), translate this read's sentences following {{skill:translate-subtitles}}, and write the translation with {{tool:documents_put}}.
4. {{tool:captions_create}} to create the caption layer (first confirm this translation has no caption layer yet).
5. {{tool:export}} if the user wants files.

**Done when**: polishing came before translation; the number of translated sentences equals the number of transcript sentences; there are no duplicate translations or caption layers; the delivery report lists the terms used as given and the sentences you were unsure about.

## 3. Translated dubbing

**Applies when**: the user wants the video dubbed into another language. **Not this recipe**: only a single line of voice-over is wanted ({{tool:speak}} directly, see [voice](catalog/voice.md)); a finished video driven by narration (recipe 8).

| Signal | Action | Reason |
| --- | --- | --- |
| There is no translation in the target language yet | Write the translation via recipe 2 first | You translate it yourself; dubbing synthesizes the translation sentence by sentence |
| Background music or ambient sound should be kept | Separate the background, and only lower or mute the voice | Muting the original audio outright removes the background too |
| The user wants the original audio fully replaced | Mute the original audio | The user's explicit request |
| Not stated | Lower the original audio | Default; keeps the original's atmosphere |
| The user named a voice, or the user library has an authorized voice | Use it | Same character, same voice throughout |

Steps:

1. {{tool:models_capabilities}} to see whether speech synthesis is usable and which voices exist; for user library voices use {{tool:library_list}}.
2. If there is no translation, translate and write it via recipe 2.
3. {{tool:dub}} with the translation's documentId, the voice and how to treat the original audio. Wait for completion.
4. Read how each sentence was synthesized in the result; report sentences that were not synthesized to the user.
5. {{tool:export}} the finished video or audio if the user wants files.

**Done when**: the dubbing track is in the video, and its sentence count matches the translation or the difference is explained; the original audio is treated as the user confirmed; tone, alignment and volume are listed under "needs a human to listen".

## 4. Talking-head cut

**Applies when**: a recording of one or two people talking to camera needs to be cut into a publishable video. **Not this recipe**: you only want to pick a few shorts from a long video (recipe 5); only one slip needs removing (just cut that spot).

| Signal | Action | Reason |
| --- | --- | --- |
| There is no transcript | Transcribe first | Cut points in talking-head footage are decided by the words; without a transcript it is guesswork |
| The same passage was said several times | Pick the most complete, most natural take; when unsure, keep them all and ask the user to listen | The proposal does not detect repeated sentences |
| You want to move a line to the opening | Move only original lines that stand on their own, taking their qualifiers with them; first ask whether to keep the original position | Reordering changes the argument |
| Zoom-ins, B-roll or text are wanted | Add them after the cuts are settled | Until the words are settled, you cannot settle where the visuals land |

Steps:

1. Read {{skill:talking-head-cut}}.
2. If there is no transcript, {{tool:transcribe}}; read the transcript with {{tool:documents_read}} and list what to keep / cut by argument.
3. {{tool:edits_apply}} to generate a cut proposal for filler words and pauses; read the proposal with {{tool:documents_read}} and decide on each item.
4. Submit the list as one edit ({{tool:edits_apply}}, with a dry run first to see the impact): accept the suggestions that should go and cut the flubbed parts.
5. Settle the opening; once the cuts are settled, add visual elements and sound treatment (the craft's `references/` has the methods; read them when you need them).
6. Read back: {{tool:videos_inspect}} to check duration and items against the list; export a short segment for the user to listen to ({{tool:export}} with a range).
<!-- surface: cli -->
   When the user wants to listen and drag cut points in the editor themselves, give a fresh web editor link at delivery ([web](catalog/web.md)); after the user changes things on the web, run {{tool:videos_inspect}} again before the next edit.
<!-- /surface -->
7. If there are translations, retranslate only the changed sentences via recipe 2.

**Done when**: everything on the list to cut is cut and everything to keep is still there; cut points fall between words; the report has the three columns, with the number of cuts and change in duration as measured, and whether it flows as needing a human to listen.

## 5. Cutting shorts

**Applies when**: picking a few clips that can be posted on their own from one long video (an interview, a lecture, a livestream replay). **Not this recipe**: making a new short from scratch; cleaning up a whole talking-head recording (recipe 4).

| Signal | Action | Reason |
| --- | --- | --- |
| The user gave a target platform | Confirm the aspect ratio and duration for that platform | As requested |
| A candidate clip's opening does not stand on its own (it needs the preceding context) | Pick another clip, or take one more sentence before it | Each clip must stand on its own |
| A clip is shorter than the target duration | Deliver it as is; do not pad, loop or change speed to reach it | Duration is a target, not a quota |
| The user has not picked yet | Deliver only candidates, do not export | Let the user pick before producing files |

Steps:

1. Read {{skill:shorts-segments}}.
2. {{tool:export}} a timestamped transcript (or subtitles), read it and pick candidates by topic: each clip is one topic from its hook to its end; how many and how long follow what the user said, or if not said, as many topics as qualify; hand them to the user to pick.
<!-- surface: cli -->
   When the user wants to watch and pick in the editor, give a fresh web editor link ([web](catalog/web.md)); still write the candidates' start and end times in text for the user.
<!-- /surface -->
3. Once the user has picked, {{tool:export}} the finished clips, one range per clip and one file each.
4. When vertical output with reframing is needed, first adjust the picture in the video ([editing](catalog/editing.md)), then export.

**Done when**: each clip's start, end, duration and a one-line reason have been given to the user; exported files are one per clip with paths taken from the results; the aspect ratio matches what the user confirmed.

## 6. Summaries and writing

**Applies when**: summarizing, pulling out key points, writing a blog post or article, writing titles and descriptions, chaptering. **Not this recipe**: writing unrelated to the video.

| Signal | Action | Reason |
| --- | --- | --- |
| A summary or key points are wanted | {{skill:video-summary}} | Key points carry video times, so readers can jump back |
| A complete article is wanted | {{skill:video-blog}}; first ask whether it is from the author's or the viewer's perspective | The two are written differently |
| Titles or a description are wanted | {{skill:titles-and-description}} | Every line has to be backed by the video |
| Chapters should be written into the video | If the author has chapters or the user gave an outline: {{tool:chapters_adopt}}; otherwise split them yourself following {{skill:video-chapters}} | Chapters are part of the video; the author's split takes priority |
| There is no transcript | Transcribe first | Do not write from the title and impressions |

Steps:

1. Read the matching craft.
2. Get a timestamped transcript: {{tool:export}} a timestamped md transcript and read the file in the result; take times from it, do not estimate them.
3. Write it yourself. Summaries, articles, titles and descriptions are plain text; give them to the user directly (write them to a file if the user wants a file).
4. Chapters: write the author's chapters with {{tool:chapters_adopt}}, which snaps them to the transcript, and read the snapping stats in the receipt; write chapters you split yourself with `setChapters` in {{tool:edits_apply}} and check the receipt.

**Done when**: the times of every key point and every chapter come from the transcript; what you wrote is backed by the video, with nothing invented; chapters were written into the video and checked by reading back.

## 7. Local files: compress, merge, extract audio

**Applies when**: the user wants local files made smaller, converted to another codec, joined in order into one, or their audio tracks extracted, with no editable video needed. **Not this recipe**: the user wants to keep editing or add subtitles on the joined video (create a video and place the clips on the timeline in order; see [media](catalog/media.md)).

| Signal | Action | Reason |
| --- | --- | --- |
| "Make it smaller" with no number | First ask for the target (a resolution cap or a rough size), or default to a height of 1080 and say so | As requested |
| The clips to merge have different parameters | Merge anyway; it re-encodes and takes longer | Stream copy only works when parameters match |
| Audio extraction is wanted | Extract the audio track of each file | No re-encoding when stream copy is possible |
| The user's original files | Leave them untouched; write output to a new location | Do not touch the user's original media |

Steps:

1. Confirm the input files, their order and the output location.
2. {{tool:transcode}}: compress, merge or extract audio tracks, and wait for completion.
3. Tell the user the output file paths from the result, and report the change in size and duration.

**Done when**: the output files exist with paths taken from the result; the original files are untouched; measured numbers such as size, duration and resolution are reported to the user.

## 8. Narrated video

**Applies when**: the user wants a finished video driven by narration (a news commentary, an explainer, a product introduction, a step-by-step tutorial), or a multi-sentence voice-over for existing footage. **Not this recipe**: dubbing a video into another language (recipe 3); reading just one line ({{tool:speak}} directly, see [voice](catalog/voice.md)).

| Signal | Action | Reason |
| --- | --- | --- |
| The user gave a target duration | First have this model read one sentence to measure units per second (characters or words, per the language), then size the script from it | Length sets duration; if the script runs long, cut sentences rather than speeding up |
| The narration is longer than 60 units | Choose a cloned voice from the user library or a built-in voice whose `source` is `builtin` | Preset speakers drift 3–5 semitones in pitch between chunks and sound like a different person |
| The user named a preset speaker | Use it as named, and state the risk in the report | The user's explicit request takes priority |
| The read is longer than the target | Cut words and re-voice that part | Changing speed on the timeline amplifies existing pace differences |
| One sentence sounds unnatural | Re-voice only that sentence (same voice, same instructions, a different seed) | Re-voicing the whole passage replaces the other sentences too |
| The script has numbers or proper names | Write them as they are read, or annotate the pronunciation | Misreading hurts more than reading slowly |

Steps:

1. Read {{skill:narration}}.
2. {{tool:models_capabilities}} to see whether speech synthesis is usable and which voices are `builtin` / `library`; measure units per second with a one-sentence test read via {{tool:speak}}.
3. Write the script to budget, one sentence per line; the delivery instructions say only how to speak.
4. {{tool:speak}} submits the whole passage (same voice, same instructions, a fixed seed, with {{arg:video}}); wait for completion and note the duration and seed.
5. {{tool:transcribe}} this narration asset to get word timings; compute units per second and pauses per sentence, find the sentences that need re-voicing and re-voice them.
6. {{tool:edits_apply}} to place the narration on a track and lay out visuals and captions by each sentence's start and end. If music is wanted, generate or place it now (the finished video's length is settled), on its own track as described in [music](catalog/music.md), ducked under the narration with `setDucking`.
7. {{tool:export}} 2–3 five-second clips spanning sentence boundaries for the user to listen to; once the user approves, export the finished video.
<!-- surface: cli -->
   When the user needs to see the layout of visuals and captions, ask them to review in the web editor ([web](catalog/web.md)) and give a fresh link at delivery.
<!-- /surface -->

**Done when**: the script length is within budget and the finished video's duration matches the narration's; one voice, one set of instructions and the seed are recorded in the report; units per second and pauses were measured for every sentence, and outliers were fixed or listed; the seams **need a human to listen**, and if nobody listened, say so truthfully.
