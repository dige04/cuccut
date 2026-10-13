---
name: shorts-segments
description: Use when the user wants standalone shorts cut from a long video (interview, lecture, stream replay, talking head) - find the topics most worth posting, cut each from hook to end as editable child videos. Needs a transcript. Not for new shorts from scratch or cleaning up a whole talking head.
version: 3.5.1
---

# Cutting shorts from a long video

The person who scrolls onto this short has not seen the long video and does not know what was said before. If the first three seconds do not grab them, they swipe away; if "the thing I just mentioned" comes up in the middle, they do not know what it refers to. So a short has to stand on its own: the opening is the hook, it covers one thing, and it stops on the conclusion.

The unit you pick is a **topic**: one thing from when it is raised to when it is fully told. A point and its reasons, a question and its answer, a story and its payoff. A short is one complete topic, no more and no less.

The two easiest ways to pick badly:

- Cutting by the long video's chapters. A ten-minute chapter takes three sentences of setup to get to the point, ends on "next, let's look at", and contains two topics. That is a slice of the long video, not a short.
- Hunting only for soundbites. One punchy line, padded with a few seconds on either side to reach the length wanted: the topic is cut off just as it begins or before it lands, and viewers hear a conclusion without knowing why, or only hear half of it.

The deliverable is **editable sub-videos**, not mp4s: each segment is created with videos_derive as a separate video next to the parent video, where the user keeps adjusting the in and out points, picture and subtitles in the editor, and exports when they want a file.

## 1. A transcript first

If there is no transcript (a document of kind speech), transcribe first and tell the user the transcription is running. Picking segments only needs the source words' timings; polish and translate only when the user asks. When the video already has chapters, they help locate topics, but chapter boundaries are not short boundaries.

## 2. Read the transcript, find the topics

Read a timed transcript: export subtitles (kind `subtitles`, format `srt`) or a transcript with timecodes (kind `transcript`, format `md`, timestamps `true`), with purpose `preview` (it is only for your own reading, not for the user), wait with jobs_inspect until completed, and read the file in outputs. These times are on the edited timeline, the same clock as videos_derive's start and end and as frame grabbing.

**Getting sentence boundaries**: you do not need to dump the whole speech document to find sentence starts and ends. When documents_read reads the transcript, each sentence in the returned translationBasis.sentences has start and end (seconds), but those are on the **asset clock**; videos_derive's start and end are on the **timeline clock**. When the parent video plays this asset from 0 seconds, at normal speed and with no cuts, the two are the same, and sentence start and end can define the range directly. Confirm this first: use videos_inspect (or facts) to check that the video item's sourceIn is 0, its speed is 1, and there are no cuts. If any condition fails, use the timeline times in the SRT or transcript exported above, or convert asset times to timeline times before passing them; never pass asset times directly as timeline times.

### Draw a topic map first

Read the whole transcript (or the range the user gave) and divide it by topic: a new question, a new point, a new story starts a new topic. For each topic, note its rough start and end, one sentence on what it is about, and which sentence holds the payoff (conclusion, answer or punchline). A chapter often holds several topics, and a topic can also cross a chapter boundary.

### Pick the best topics

A qualifying topic meets all three conditions; if one is missing, drop it:

- **Has a draw**: at least one of these four: a counterintuitive claim, an emotional high point, dense practical value, a short story with a twist.
- **Stands alone**: understandable without the long video, with no references like "the thing I just mentioned" or "the second point" that need what came before.
- **Has a beginning and an end**: the topic contains a line that can open directly (see "The opening line is the hook" below), and it gets to the payoff.

The transcript is only a lead: for qualifying topics, use videos_frames to grab a few frames in those seconds and look at the picture (whether there is anything worth watching, whether the speaker is in the frame), and judge from context whether it was said seriously or as a joke. Frames are source-asset pictures and contain no captions or overlaid elements. Then rank by strength of draw and how firmly it stands alone, strongest first.

### How many

- **The user gave a number** (the prefilled prompt from the settings page states a count, for example "Make N shorts"): take the N strongest topics. When fewer than N qualify, create only the qualifying ones, do not pad with weak topics, and tell the user why there are fewer.
- **Auto** (the prefilled prompt leaves the count to you by topic, for example "Decide how many shorts from the topics you find", or the user did not say): create as many shorts as there are qualifying topics, with no padding, and do not lower the bar because there are many topics. When there are more than 10, create the strongest 10 first and list the rest in the reply as candidates (in point, out point, one sentence on what it covers) for the user to create later.
- No two shorts share the same stretch of speech: when two candidates overlap, keep only the stronger.

### How long each

- **Auto** (the prefilled prompt leaves the length to you by topic, for example "each as long as its topic needs", or the user did not say): the length is the topic's length. It starts at the first line in the topic that can open directly and ends when the payoff line finishes. Do not include setup or the start of the next topic to pad the length, nor cut the reasons or examples in the middle to shorten it. When a topic has a long digression in the middle and drags on, take the half of the topic that stands alone and has a payoff, or pick a tighter topic.
- **The user gave a range** (could be 15-30, 30-60, 60-90 seconds, 1-3 minutes or custom): find topics that can be fully told within the range; when a topic is longer than the range, take one point inside it that stands alone and has a payoff. A topic that neither fits nor splits is better dropped than cut in half; running a few seconds over the range to stop at the end of a sentence is fine - say so in reason.
- **No platform cap**: when it is over 3 minutes, just mention that YouTube will not treat it as a Short, and go ahead. When an auto length exceeds 3 minutes, first check whether it covers two topics, and split it into two shorts if it can.

### Boundaries

- **One short covers one thing**: when a segment has two topics, split it into two shorts or keep only one.
- **The opening line is the hook**: topics often open with setup ("so let's talk about...", "actually this question..."); move the start to the first line in the topic that grabs directly: a counterintuitive conclusion, a concrete number, a question. After moving it, what follows must still be understandable; if it is not, you moved too far, or this topic has no good opening - pick another.
- **End on the payoff**: stop on the line where the conclusion or punchline finishes, not on a half sentence like "next, let's look at..."; when the ending is "follow and subscribe" talk, move the end up to the previous sentence.
- **Someone speaks in the first 3 seconds**: if not, move the start to the first line; do not add a title card in front.
- **In and out points fall on sentence boundaries**: the in point is the midpoint of the pause between the opening line's first word and the word before it; the out point is the midpoint of the pause between the last word and the next word. Never cut into a word. When a boundary is uncertain, leave it slightly wide: it is easier for the user to tighten in the editor than to add back.
- **When a pause is shorter than one frame (about 40 milliseconds), "the midpoint of the pause" does not hold**: the midpoint does not land on a whole frame, and rounding eats into the next word or swallows the previous one. The runtime now pulls boundaries inside the pause (the end does not eat the next word's start, the start does not swallow the previous word's end), and the returned range is the value actually used, which may differ from what you passed by a few frames. After creating, check the difference between the returned range and what you wanted: if it differs a lot, or the opening or closing word gets clipped as a result, recreate it with a different boundary rather than leaving it.
- **Interviews: prefer one person's uninterrupted stretch.** Starting from the first complete sentence of an answer is allowed. Do not open with sentences that depend on what came before ("another way to put it is", "this is like what I just said"); move on to the sentence that stands on its own. One or two short interjections from the interviewer are acceptable, but state in the reason at which seconds and what was said.
- **Channel logos, borders and watermarks are a go/no-go check**: after grabbing frames, look at the corners and edges for channel logos, sponsor bars, burned-in subtitles and borders. When the crop you will use would cut them in half or leave half a word, follow the logo-avoidance rule in step 4's framing (the crop avoids the logo entirely, borders at top and bottom are cropped off); if it cannot be avoided, switch segments and tell the user what you chose; never deliver half a logo.
- **Do not look again at what was already cut**: when the user mentions it (the prefilled prompt includes "Skip the parts already cut into shorts") or you suspect it was cut before, use space_list (videoId set to the parent video) to see the derived sub-videos (origin.source is `derived`) and their ranges, and keep new candidates clear of those ranges.
- When the video has been edited, the transcript's times are already post-edit; when the user wants to cut by the original pre-edit asset, first confirm with the user which version to use.

A comparison (illustrative only):

Bad: `12:00-14:30`, starting at "OK, so next let's talk about cost" and ending at "we'll get into this later".

Good: `12:41-13:22`, starting at "We ran the numbers - one video actually costs only three yuan" and ending at "so the expensive part was never generation, it's the rework".

The second is a complete topic: the first line is a number, the middle is the reasoning, it stops on the conclusion, and nothing refers back to earlier.

## 3. Create first, or show the user first

- When the user's words mean something like "Create the videos as soon as they're found; no need to ask me first" (the prompt prefilled by the settings page carries this line by default): once found, go straight to step 4 without confirming each segment in the conversation.
- Without that line, or when the user says "show me first": list the candidates first and wait for the user to pick. For each segment, write the in and out points, which topic it covers (one sentence), the original opening line, the highlight, why it stands alone, and problems found (for example burned-in subtitles in the picture, split-screen or side-by-side two-camera shots, a channel logo or sponsor bar in a corner that a vertical crop would cut in half; in an interview, the speaker not in frame while the other person talks). Say which spots you looked at if you grabbed frames; if you did not look at the picture, say so. Rank by confidence, highest first, and create once the user has picked; when the user says "you decide", decide yourself and give your reasons.

There is no need to keep asking about boundaries in the conversation: a sub-video keeps the whole timeline and transcript, and the user can bring back a struck-out sentence by clicking it in the editor. Write titles and reasons in the language the user speaks.

## 4. Create the sub-videos

Call videos_derive for each segment:

- `video` is the parent video, `start` and `end` are seconds on the edited timeline, and `name` is the segment title.
- **Aspect ratio**: when the user wants 9:16, `width` 1080 and `height` 1920; for 1:1, 1080x1080; when keeping the original aspect ratio (or not mentioned), do not pass width, height or fit. Do not upscale small sizes for "HD".
- **Framing**: when an aspect ratio is passed, give `fit: "cover"` (fill, cropping the excess). When the user says "centered": pass neither `crop` nor `crops`, and it is created centered; when they say "I'll adjust it myself": likewise create it centered, and tell the user they can drag the picture on the canvas to adjust the framing. When the user did not say, or says "auto" (the default): follow the per-shot framing flow below. Framing is a static crop that changes at shot changes, not a camera that follows the person: when the user wants "the picture to keep following whoever is speaking", say truthfully that this cannot be done, and ask the user to adjust the position within a shot themselves in the editor.
- **How "auto" framing works** (the prompt says: see where the speaker is in the frame and place the crop on them; if no one is found, center it): split by shot first, and set each shot's crop from face detection results, not by eyeballing images.
  1. **Shots first, then frames**: first use videos_shots with `range` (`start:end`, this segment's timeline seconds) to get this segment's `shots` (each with `start`, `end` and three `sampleAt`) and `cuts`. It only detects picture changes and does not recognize people. Then use videos_frames with `at` set to all the shots' `sampleAt`, 8 shots at a time (24 frames, the per-call limit). Each frame's `faces` are the detected face boxes, with `x`, `y`, `w`, `h` normalized to 0-1 by the frame's width and height, corresponding to the asset picture - exactly the coordinates of `crop`.
  2. **Sort camera angles first**: for each frame, look at the area of the largest face (`w × h`). At least 0.01 means a **close frame**; only smaller faces means a **wide frame** (a long shot with several people); no faces is noted separately. The three frames in one shot are generally the same angle.
  3. **Identify the main speaker**: across all the segment's shots, look only at close frames and group faces into people by the horizontal center (`x + w/2`), treating a difference under 0.1 as the same person. The one in the most frames is the main speaker; when the counts are close, take the one with the larger average area. The other person's close-ups are the interviewer's (or the other party's) shots.
  4. **Check the edges before setting crops**: open a few frame images and see where channel logos, watermarks, subtitle bars and sponsor bars are, and estimate their edges (0-1, the same coordinates as `crop`); then check for borders burned into the picture at the top and bottom (color bars, black bars).
  5. **Set the crop shot by shot**: use this shot's own three frames, never another shot's position in its place. The crop width ratio `cw = (canvas width / canvas height) × (source height × (1 - top - bottom) / source width)`; `left = center - cw/2`, clamped between 0 and `1 - cw`, and `right = 1 - cw - left`. Example: a 16:9 source to 9:16 with nothing cropped top or bottom gives `cw` = 0.316; with the face center at 0.30, left 0.142 and right 0.542. When there are burned-in borders at the top and bottom, set `top` and `bottom` to the borders' height ratios to crop them off (give a little extra, leaving no thin edge); otherwise 0.
     - Main speaker close-up: the center is the median of the main speaker's face center (`x + w/2`) in this shot.
     - Interviewer close-up: center on the interviewer's face, so whoever is speaking is in the picture - that is the point of framing per shot.
     - Wide shot (a few small faces, the picture mostly the room): use the smallest crop that holds everyone. When the outer edges of all faces (from the leftmost `x` to the rightmost `x + w`) fit in a window of width `cw`, center on the middle of the group; when they do not, note it in notes and center on the main speaker.
     - When faces in a long shot are small, crop at most 15% at the top and bottom each (neither `top` nor `bottom` above 0.15) to make the faces bigger, and no more; when there are burned-in borders, their height counts toward this 15%; if a border is taller, the border wins, and explain in notes.
     - When adjacent shots' crops differ by less than 0.02 (difference in `left`, with the same `top` and `bottom`), merge them into one `crops` entry, with `from` the earlier shot's start and `to` the later shot's end.
  6. **Avoid channel logos**: check shot by shot, with the same thresholds as before. When the logo is on the left, `left` is at least the logo's right edge + 0.01; on the right, `left + cw` is at most the logo's left edge - 0.01 (`right` at least 1 - the logo's left edge + 0.01). When after shifting the face in this shot is cropped out of the picture, or the logos on both sides cannot be avoided, changing this shot's crop will not work, so switch segments; never deliver a crop that sits on half a logo.
  7. **Multi-camera**: wide shots and interviewer shots now have their own crops and are no longer a reason by themselves to switch segments. Only two rules remain: a segment **must not open with the other person's reaction shot**; when wide or empty shots together exceed about 40% of the segment, prefer another segment and explain why; if it cannot be switched, go ahead and note it in notes.
  8. **Switch points come from videos_shots**: `crops`' `from` and `to` take `shots`' `start` and `end` directly, which are frame-accurate; no more probing 1 second either side of an estimated switch point. Only when a shot's three frames are clearly two different angles (meaning a switch was missed), lower `threshold` to 0.2 and rerun videos_shots on that short stretch, or grab a few extra frames with `at` around the suspected moment. When creating: pass all the merged entries in `crops` (`{from, to, left, top, right, bottom}`, at most 64 entries, non-overlapping, all in parent-timeline seconds), and also pass the first shot's crop as the plain `crop`, as the fallback for frames not covered.
  9. **No faces**: when every frame's `faces` is empty, center it (pass neither `crop` nor `crops`) and say truthfully that no faces were found. When the result's `detector` is null, the detector is unavailable, which does not mean nobody is there: in that case fall back to looking at the frame images, estimate shot by shot which side of the picture the main speaker is on, give `crops` and `crop` by the algorithm of steps 5 and 6, and say that this time it was estimated by eye.
- **hook, reason, notes**: pass them for every short. `hook` is the first original line of the kept segment, copied verbatim, not rewritten (at most 300 characters); `reason` is one sentence on why it was picked, written for the user (at most 500 characters); `notes` is an array of hint strings with things found in the framing, camera angle and logo checks that the user needs to know; omit it if there are none.
  - Each note is **at most 80 characters**, at most 8 notes; going over rejects the whole creation. One thing per note; split them up rather than packing several things into one.
  - When mentioning time, write "sub-video second X (original Y)", giving both clocks. One note per group of shots, only what the user needs to know, for example "Sub-video 9-24s (original 24:54-25:09) is a wide shot, cropped between the two", "Sub-video 40-43s (original 25:25-25:28) is the interviewer, cropped to them", "Purple borders at top and bottom cropped off". When the opening is the other person's reaction shot, note that too, as "Sub-video 0-3s (original 24:45-24:48) is the other person's reaction shot".
  - The cards on the results page show these three, so there is no need to repeat them in the reply. After creating, check that what was written is what you meant: the `hook`, `reason` and `notes` echoed in the result are the ones in the derivation source document (when an existing sub-video is reused, it is the original one, and what you passed this time does not overwrite it); you can also read the returned `derivationDocumentId` with documents_read.
- `chapters: false`: a 30-second sub-video should not carry the parent video's full chapters.
- `captions` follows the user's subtitle request: `true` when subtitles are wanted (the default), `false` when not. When the user wants only the source or only the translation, choose the caption layers by what they said, and say truthfully what cannot be done (for example, there is no translation).
- **Translations**: by default videos_derive carries the parent video's translations and translation caption layers over to the sub-video; translations in an old format are upgraded automatically before being carried over. When a `translations-skipped` warning appears in the return, tell the user which language was not carried over.
- **Check the return values**: `range` is the boundary actually used; compare it with what you wanted (see the short pauses above); `captions[].cueCount` counts only the cues within the range, not the whole subtitle track; use it to judge whether subtitles were built and whether the count is reasonable.
- After each short is created, a video card appears in the conversation automatically; there is no need to paste paths. Repeating a call with the same range and settings reuses the existing sub-video (`reused` is true) rather than creating another.

What a sub-video is: a full copy of the parent video's timeline and transcript with everything outside the range cut away; the user can bring back a struck-out sentence by clicking it in the editor; the original video is untouched. So do not move any of them to the trash, and do not recreate one to "change the boundaries"; let the user drag in the editor.

Removing verbal tics and tightening pauses changes the whole video and is not done here; when the user wants it, first explain the effect, then handle it on the sub-video following the talking-head cut approach.

### Warnings to pass on truthfully

Tell the user every warning in the creation result, in plain words:

- `multiple-assets`: the parent video has more than one main asset; this version cuts only by the main asset and the other assets move along; ask the user to check in the editor.
- `items-not-restorable`: items on other tracks that fall entirely in a cut-away area will not come back with "restore".
- `range-not-exact`: part outside the range could not be cut away (the main asset does not cover it), so the in and out points will be slightly wider than requested.
- `captions-skipped`: the caption layer was not built; explain why and tell the user they can build it again in the captions panel.
- `crops-adjusted`: a framing range was shortened or dropped (it went beyond the sub-video's range, or nothing was left after trimming to frames); the trimmed frames are framed by the adjacent shot's or the fallback crop; tell the user which seconds and ask them to drag it on the canvas.
- `animation-split`: the picture was split into several items by framing, and looping animations or volume envelopes restart at each boundary; tell the user at which seconds, and ask them to check in the editor if it matters.
- `translations-skipped`: this translation of the parent video could not be carried into the sub-video (the old format could not be converted), so the sub-video has no translation in this language; tell the user which language, and that they can translate again on the sub-video.

State rejection errors truthfully (the parent video has code visuals, the range is empty and so on), and do not work around them.

## 5. Finished files

The default deliverable is sub-videos, not mp4s. When the user explicitly wants files, call export on the sub-video: kind `video`, format `mp4`, wait with jobs_inspect until completed, and tell the user the path in outputs. Captions on the timeline are burned into the finished video by default (burnCaptions); give `false` when subtitles are not wanted. When the user wants to export directly without creating sub-videos, the old way of exporting from the parent video by ranges still works, one `{start, end}` per segment.

## 6. What to avoid

- Do not cut by chapters, and do not let a segment hold two topics.
- Do not pad a single soundbite to a length and cut the topic off before it is told; do not lower the bar or include setup to reach a count or length.
- Do not start from setup, and do not stop on a half sentence or on "follow and subscribe".
- Do not leave references like "what I just said" or "the second point".
- Do not cut into words; do not add a title card in front.
- When the user did not say "show me first", do not stop at each segment to ask about boundaries; when they did, do not decide for them unless they say "you decide".
- Do not call a picture you have not looked at fine; do not swallow warnings.
- Do not promise the picture will keep following the person - per-shot framing is what can be done, and the user can drag any shot's picture on the canvas; do not use one crop for the whole segment; do not set this shot's crop from another shot's face positions; do not estimate switch seconds from a few frames - use what videos_shots returns.
- Do not pass sentence times on the asset clock directly as timeline times; do not leave a returned range that differs a lot from what you wanted unchecked.
- Do not let a segment open with the other person's reaction shot or a sentence that depends on what came before; do not deliver a crop that cuts a logo in half or keeps burned-in borders.
- Do not pack several things into one note, and do not give seconds on only one clock.
- Do not export mp4s and present them as the deliverable, unless a file is what the user wants; do not move sub-videos to the trash.
- Do not leave checking artifacts in the user's files: use videos_frames to look at the picture, not ffmpeg screenshots into exports/; give purpose `preview` to anything exported to read the transcript, listen or check results, and do not export segments as mp4 by ranges to check them.

## 7. Delivery

When wrapping up, list each short, written for the user:

- Title, in and out points in the parent video, duration, aspect ratio and resolution.
- When you decided the count or the length by topic: one sentence on why these shorts (for example, two other topics needed earlier context to make sense, or had no payoff); when there were more than 10 qualifying topics, list the candidates not created.
- The original opening line and why it was picked have already gone to the result cards through hook / reason, so do not repeat them per short in the reply; write one sentence per short only when the user is viewing somewhere without a results page (the web client, the command line).
- What was and was not done: one sentence each for aspect ratio and framing (original aspect ratio / auto per-shot framing / user's own; any shot's picture can be dragged on the canvas) and subtitles (present / not built).
- Warnings from creation; if none, say none.
- Picture problems found (burned-in subtitles, channel logos or sponsor bars, split screens or adjacent pictures, the speaker out of frame during interjections): write them if any; if you looked and found none, write "none seen"; if you did not look at the picture, say you did not look.
- Last line: the sub-videos can be adjusted further in the editor; to bring back a struck-out line, just click it; ask if you want mp4s.
