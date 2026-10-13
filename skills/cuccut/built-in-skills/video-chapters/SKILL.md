---
name: video-chapters
description: Use when the user wants a video split into chapters, a timestamp table of contents, chapters from the author's outline, or a different chapter granularity - chapter at topic changes, title and summarize each, and write them into the video. Needs a transcript. Not for chapters in a description.
version: 2.0.0
---

# Chapters

Chapters are for viewers who skip around: someone dragging the progress bar glances at the chapter names and knows where to go; someone who has watched it and wants to find a spot again relies on them too. So a chapter title must say what that stretch is about, its start must land where the topic really begins, and one chapter corresponds to one topic.

There are two easy ways to get it wrong. One is cutting evenly by time: a chapter every five minutes, starts landing mid-sentence, titles like "Part one" and "Continued discussion" that tell viewers nothing. The other is titles that read like summaries: a long sentence per chapter, so the chapter list becomes hard to read. A chapter name is a signpost, not a summary; the summary has its own one-sentence slot.

## 1. Gather the material

1. Look at the video with videos_inspect: duration, existing chapters (chapters), documents. If there is no transcript (a document of kind speech), transcribe first and tell the user the transcription is running. Assets imported from a link also have `assets[].source`: `chapters` is the author's chapters (structured chapters given by the platform, or parsed from a timestamp outline in the description), `[]` when there are none; `description` is the truncated description.
2. A transcript with timecodes: export (kind `transcript`, format `md`, timestamps `true`; when there are several transcripts, pick one by documentId from the candidates it lists), wait with jobs_inspect until completed, and read the file in outputs. It gives the time on the edited timeline for each paragraph; take chapter times from these paragraph-start timecodes and do not estimate them yourself.
3. When the video already has chapters, first ask the user whether to replace, adjust or keep them; when the user only says "add chapters" and the existing chapters are recent, do not overwrite them.

## 2. When there are author chapters or the user gave an outline

Chapters the author made are usually closer to their intent than yours; follow them rather than chaptering yourself, and do not align times by hand. When the source asset has its own chapters (`assets[].source.chapters` is not empty), or the user pastes a timestamped outline (such as `0:00 Intro`, `1:02:03 Q&A`), use chapters_adopt:

- Author chapters: give `video` (also `asset` when there is more than one asset, and `document` when there are several transcripts). An outline the user pasted: give `outline`, either as `[{ at, title }]` or as the pasted text. When unsure, first pass `dryRun` and look at the receipt, then write for real.
- It snaps each entry to the nearest paragraph or sentence start in the transcript (paragraphs first, then sentences, caption cues, words), cleans up the titles, and writes the whole set into the video's chapters (replacing existing ones; existing chapters require asking the user first, as in step 1).
- Read `sourceChapters` in the receipt: `entries` is the total count; `matched` snapped to a start; `ambiguous` had several starts nearby and took the one closest to the author's time (the later one on a tie); `snapped` had its time moved; `unanchored` could not be matched and kept the original time. `rows` gives each entry's title, the written time `at`, the original time `sourceAt` and the status; entries with `offTimeline` correspond to places not on the timeline (for example, cut out). At delivery, say how many matched, and list the ambiguous, unanchored and offTimeline entries one by one for the user: these are the places they need to look at themselves.
- `NO_SOURCE_CHAPTERS` returned: the asset has no author chapters; chapter it yourself as below. `ASSET_NOT_PLACED` returned: the asset is not on the timeline; place it first.
- Only when the user wants chapters you write yourself, or a granularity different from the author's outline, chapter it yourself as below, using the author's outline as reference: where the transcript agrees with it, keep its boundaries and titles (keeping the author's language and wording), and add, merge or remove chapters only where the transcript clearly differs; the outline's times are approximate, and chapter starts still come from the paragraph timecodes in the transcript.

## 3. How many chapters

Set a rough target chapter count by granularity, without forcing it:

| Granularity | Roughly how long per chapter |
| --- | --- |
| Coarse | about 10 minutes |
| Medium (default) | about 5 minutes |
| Fine | about 2.5 minutes |

Target chapter count = duration / length per chapter, rounded; at least 2, at most 20, with the cap scaled up at 20 chapters per hour for recordings over an hour. When the author's outline is the reference and the user did not set a granularity, the target count is the number of entries in the outline. When there are fewer real topic changes than this, having fewer chapters is fine: the target count is a rough guide, not a quota.

## 4. How to divide

Before starting, read the whole transcript and list where the topic changes: the speaker switches subject, moves from the problem to the method, from one case to the next. Chapters land on these spots.

- Each chapter starts at the beginning of a paragraph; take the time from that paragraph's timecode in the transcript. Do not invent times, and do not put a chapter in the middle of a sentence.
- The first chapter usually starts at 0 seconds.
- Each chapter gets a title and a one-sentence summary (at most about 20 words, saying what this chapter discusses). The title is a signpost viewers understand at a glance, made of this stretch's own content, never empty words like "Part one", "Continued" or "Other"; the summary adds a sentence on what this chapter specifically covers.
- Titles and summaries must not be empty, must differ from each other, and must be consistent in style; write them in the transcript's language, and switch only when the user wants another language.
- Read a very long recording in parts: for each part, first list the topic units (each with its starting paragraph, title and summary), then combine them into the final chapters. When there are more units than the target count, merge adjacent units belonging to the same larger topic into one chapter, with the start taken from the first merged unit and the title and summary covering the whole merged stretch; merge especially at the seams between parts, where a topic is often split artificially. When it is not the first part, its opening may continue the previous part's topic, so do not force a chapter at the first paragraph of that part.

A comparison (illustrative only):

Bad: `05:00 Part two` / `10:00 More on the model` / `15:00 Other`

Good: `04:37 Why quality dropped so much after distillation` / `11:02 How to configure the hybrid approach` / `16:48 Three pitfalls after launch`

In the second, every start lands on the paragraph where the topic begins, and one glance at the title tells you whether to skip there.

## 5. Write into the video

Write the whole chapter list at once with edits_apply's setChapters (at is the seconds obtained above, strictly increasing; title and summary as written). To change only one or two chapters, use upsertChapter or removeChapter. Chapters are pinned to moments on the timeline: talking-head cutting (addCuts, accepting cut suggestions, restoring cuts) makes chapters follow the content, but other edits (moving or deleting items, ripple delete) do not; when such edits change the duration, remind the user the chapters may need realigning.

## 6. What to avoid

- Do not cut evenly by time, do not put a start in the middle of a sentence, do not estimate times yourself.
- Do not write titles like "Part one", "Continued" or "Other", nor as a whole-sentence summary.
- Do not rechapter yourself when the asset has author chapters; do not overwrite the user's existing chapters without asking.
- Do not force the target chapter count.

## 7. Delivery

- List the chapters written: time (h:mm:ss, or m:ss under an hour), title, summary.
- Say whether the author's outline was used or you chaptered it yourself, and the granularity and chapter count. When the author's outline was used, report the snapping stats: how many entries in total and how many matched; list the ambiguous, unanchored and offTimeline entries one by one.
- A chapter failure does not affect the transcript or other results: state the reason truthfully, retry at most once, and do not retry repeatedly.
