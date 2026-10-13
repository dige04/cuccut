---
name: talking-head-cut
description: Use to cut a recording of one or two people talking to camera into a publishable video - remove tics, long pauses, botched retakes and digressions, tighten pauses, open with the strongest line, add emphasis, B-roll and music. Needs a transcript. For shorts from a long video, use shorts-segments.
version: 2.2.0
---

# Talking-head cut

The user recorded themselves talking to the camera, with verbal tics, pauses and a few botched takes said again. What they want is a video they can publish as is: smooth, not dragging, an opening that holds people - and not one thing they meant changed. It is cut well only when viewers cannot tell it was cut.

There are two easy ways to get it wrong. One is cutting while listening: deleting a sentence the moment it seems redundant, only to find further on that it was the premise for what follows, and having to go back and restore it. The other is cutting too hard: removing every breath and squeezing every pause to the minimum, so it sounds like a machine talking; or lifting a sentence out from the middle for a grabby opening, which changes its meaning.

In a talking-head video, the **words** decide the cut points, not the picture: make the speech flow first, then deal with the picture. Order:

1. Transcribe. Without a transcript, every step below is guesswork. When there is no document of kind speech, transcribe first and tell the user the transcription is running.
2. List keep / cut by argument, and cut it all in one go (section 2).
3. Tighten the pauses between sentences (section 3).
4. Settle the opening (section 4).
5. Add visuals **only after the cuts are settled**: punch-in emphasis, B-roll, text; then framing and sound. How to do these is in `references/picture-and-sound.md`; when you do these, fetch it with `skills_read`.
6. Acceptance (section 5).

Visual elements follow the cuts, but cutting the words first and adding visuals afterwards is still easier: until the words are settled, you cannot decide which sentence the punch-in lands on or how many seconds the B-roll gets.

## 1. Time and cutting

There are two clocks here; mix them up and the cut points land in the wrong place:

- In the transcript (the speech document read with documents_read), words' start and end are on the asset's own clock, converted to seconds by timescale: seconds = ticks / timescale. addCuts and proposeCuts use seconds on the asset clock.
- splitItem, moveItem, removeRange, export ranges and videos_frames' `at` use seconds on the timeline. The position on the timeline of moment t in the asset = that item's startSeconds + (t - sourceInSeconds) (both values are in videos_inspect's items; for items with a speed change, divide further by the rate). Do not convert by feel; when unsure, read the items again with videos_inspect.
- Talking-head removals use cuts (addCuts): they can be restored (restoreCut), and the cut set is the video's document of kind cut-set. The original file is untouched.

## 2. Keep / cut list

Read the whole text; do not cut sentence by sentence while listening:

- **List by argument**: which arguments does this recording make, and which sentences does each argument keep? Write a keep / cut list (sentence, keep or cut, reason) and cut it all in one go; cutting as you read, you often find later that a sentence you deleted earlier was the premise of what follows.
- **What to cut**: preparation before the take starts, the botched takes said again, noise between the end of the take and stopping the recording, digressions unrelated to the main line.
- **Verbal tics and long pauses**: generate a cut proposal with edits_apply's proposeCuts (fillers and pauses in detect), read the proposal with documents_read, review every item, then use acceptCutSuggestions to accept only those that should go; to change a range, use addCuts directly and put the suggestion ID in ref. The proposal does not detect repeated sentences: for botched retakes and things said twice, cut them yourself with addCuts using the word timings in the transcript.
- **Which retake to pick**: look at completeness (the idea fully said), naturalness (does not sound recited) and pace (neither dragging nor rushed). The later take is usually smoother, but that is not a rule; when unsure, keep them all and ask the user to listen and decide.
- **Keep the original order by default.** Reordering changes the argument; apart from the opening in section 4, ask the user before any move.
- Cut whole sentences: cut boundaries fall in the gaps between words, from the start of the sentence's first word to the end of its last word, never cutting into a word.
- **Once the list is settled, submit it as one edit**: one cut per sentence to remove, all in the same edits_apply. The whole edit is one undo step: when the user says "not that batch", one edits_undo takes it back.

## 3. Pauses between sentences

The length of the pauses is the video's tone of voice: too short sounds rushed, too long sounds draggy.

- A starting point (not a rule; adjust by ear): about 0.2 seconds between sentences; fast-paced promotional talking heads can go to 0.1-0.15 seconds, reasoning or reflective ones 0.3-0.5 seconds. Allow more for languages and speakers with a slow pace and long sentences.
- Express it through proposeCuts' detect: turn pauses on, set compressTo to the target above, and leave minPause and maxGap at their defaults. Read the proposal first to see how many places it changes, then accept. After applying one number to the whole video, go back and look at the spots after turns, punchlines and questions: the pauses there are content, and squeezing them loses it.
- **Keep the breaths**: removing every breath sounds like a machine. Cut the dead waiting, not the breathing.
- **Keep words whole**: cut points fall in the gaps between words, never eating the first syllable or the trailing sound at the end. When the transcript's word boundaries are tight, leave a little margin at the cut point.
- You cannot hear the finished video. Pause lengths can be read from the cuts and items, but **whether it flows needs a human ear**: use export to export a short stretch (range in timeline seconds) for the user to listen to, and say in the report which things were only measured.

## 4. The opening

The first few seconds decide whether viewers stay.

- The first few seconds need a line that makes people stay. The strongest **original line** in the whole video can move to the opening: use splitItem to cut at the start and end of the line (in timeline seconds), then a single moveItems to move it to the front and shift the items that were before it back in order (items on the same track cannot overlap).
- Move the original line; do not re-record it or splice half sentences. Take the qualifiers it carried along with it (for example "in this case" or "for beginners", in any language); when removing the qualifier would change the meaning, do not move it.

  A comparison (illustrative only): the original line is "For beginners, this method shows results in the first week." Moving "this method shows results in the first week" to the opening changes the meaning from "for beginners" to "for everyone", so it cannot be moved that way; if you move it, move the whole sentence.
- Decide whether the line appears once or twice in the video, and tell the user: a move is a **reorder**, so the line is no longer in its original place; if it is a teaser and the original place should keep it too, do not move it - instead put another copy of the same asset at the opening (addItem with the same asset, then trimItem to the line's range), and make room for it.
- When items move, things on other tracks do not necessarily follow. So settle the opening first, then add punch-ins and text; if they were already added, re-read with videos_inspect after the move and check each one.
- When no original line can stand on its own, move nothing; start in the original order and cut the opening small talk.

## 5. Acceptance

- Read back: videos_inspect for the items and duration, documents_read for the cut set, and check them against the keep / cut list item by item: what should go is gone and what should stay is still there.
- To look at the picture, use videos_frames to grab frames at timeline moments: it gives the asset picture at that moment, without punch-ins, captions or overlaid elements; to check the composited result, export a short stretch of the finished video for the user to look at.
- Translations go stale after cutting: when there is a translation, follow the subtitle translation approach and retranslate only the sentences that changed.
- The report has three columns: **measured** (duration, number of cuts, what the pauses were changed to), **seen** (where frames were grabbed, which spots were looked at and what was seen; what was not looked at is stated truthfully), **needs a human ear** (whether the cut points flow, the music volume). Whether the opening line was moved, and how its original place was handled, gets a sentence of its own.

## 6. What to avoid

- Do not cut while listening, and do not cut in several scattered edits.
- Do not remove every breath, and do not squeeze out the pauses after turns and punchlines.
- Do not cut into words; do not splice half sentences or drop qualifiers for the opening.
- Do not reorder without asking (except the opening line); do not force a choice among retakes for the user.
- Do not mix the asset clock with the timeline clock.
- Do not call what you have not heard "smooth", or what you have not seen "fine".
