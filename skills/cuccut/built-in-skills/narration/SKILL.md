---
name: narration
description: Use for a video carried by narration (commentary, explainer, product demo, tutorial) or a multi-line voice-over on footage - size the script from a measured speech rate, synthesize once in one consistent voice, check seams, redo failing lines, cut visuals to it. Not for dubbing or one-line reads.
version: 1.2.0
---

# Narrated videos

In a narrated video, **the script and the voice** decide everything: the script's length sets the video's duration, and the voice's consistency decides whether viewers believe it is one person speaking. Order:

1. Measure the speaking rate first, then compute the length, then write the script (section 1).
2. Write the script one sentence per line, with how to say it kept apart from what to say (section 2).
3. Pick a voice whose timbre can be locked, synthesize once with one set of delivery instructions, and record the seed (section 3).
4. Measure, check the seams, and redo only the sentences that fail; do not change speed to fit the duration (section 4).
5. Cut the visuals to the narration (section 5).
6. Acceptance (section 6).

## 1. Measure the rate first, then compute the length

- When there is no sample of the current configuration yet and you need to draft first, use `skills_read` to read `cuccut-catalog-voice-language-rates`: estimate the first draft's budget from the Unit and Rate of the target language, then revise it with the measurement below. The table has the complete language data, the calibration conditions and the fallback for unlisted languages; do not synthesize audio just to look up the table.
- The length is not a guess: **first have the model and voice you will use read a short, representative piece of the script**, with the same delivery instructions, and compute units per second from the duration in the result. When a sample with the same configuration, the same language and a similar style already exists, reuse it instead of generating another.
- The counting method follows the target language: scripts suited to counting by character (such as Chinese) count characters; languages with a clear word-segmentation convention count words; other or mixed languages use a consistent, reproducible character or word method, the same for the sample and the whole script, and never fall back to English speaking rates. Count numbers and abbreviations as they are actually read; do not count stage directions or punctuation.
- When the average rate is computed from the sample's total duration, **unit budget = seconds available for narration × measured units per second**; pauses are already included, so do not subtract them again. When the voiced rate is measured separately from aligned timings, **unit budget = (seconds available − expected pause seconds) × voiced units per second**; never subtract seconds directly from the unit count. External language-rate tables are only a reference for drafting; recalibrate after changing the model, language or performance.
- When the script runs over, compress it within what may be rewritten; do not speed it up. When the user asks for a verbatim reading, keep the original script, explain its conflict with the time budget, and do not drop sentences on your own.
- Duration is a target, not a quota: if the script reads in 55 seconds, deliver 55 seconds; do not pad, loop or change speed to stretch it to 60.

## 2. How to write the script

- **One sentence per line, one idea per sentence**, closed with a period, question mark or exclamation mark: the synthesis engine splits sentences and places pauses by these marks, and captions break lines by them too. Do not join two sentences into one with a semicolon.
- Write numbers, years and abbreviations as they are read ("October first, twenty twenty-six", "thirty frames per second"); mark the pronunciation of heteronyms and proper names (`<银行|yin2 hang2>` - the text of speak accepts this notation).
- Put jokes and quips after the factual sentence, as sentences of their own; rhythm comes from sentence length and cuts, not from making the voice read faster.
- **Keep how to say it apart from what to say**: delivery instructions describe only the tone, setting and role ("a young news host, bright and natural, with a slight smile in the quips"), not the lines; lines contain no parenthetical notes or stage directions. When the model responds to it, you may ask for a performed pace such as "slow and soothing" or "urgent and excited", but do not use it to promise exact seconds or to rescue an over-long script; settle the performance first, then measure the budget as in section 1. "Fast editing rhythm" does not automatically mean "the voice reads fast".

## 3. Pick the voice, synthesize once

- **For multi-sentence narration, prefer voices anchored by a reference recording**: an authorized cloned voice in the user's library (`library:<id>`), or a built-in voice whose `voices[].source` in models_capabilities is `builtin`. Every chunk of these is generated against the same reference recording, so the timbre holds steady.
- Preset speakers whose `source` is `model` (the kind of local model that accepts delivery instructions) sample each chunk independently, and the pitch drifts 3-5 semitones from chunk to chunk, sounding like a different person: use them only for short narration under 60 characters, or when the user names one - and then state this risk in the report. Online models follow their own documentation.
- One role in the whole video means one voice and one set of delivery instructions; when the model accepts no delivery instructions, rely on the choice of voice alone.
- **Submit the whole text at once** (or by paragraph, a few hundred characters each), not sentence by sentence: the engine splits the chunks by sentence itself and evens out the pauses and loudness between chunks; submitting sentence by sentence does not make the timbre more consistent - it lengthens the total and slows down every character. Sentence by sentence is only for redoing one sentence (section 4).
- When the model accepts a seed, give a fixed seed and record it; when redoing one sentence, change only that sentence's seed and leave the rest alone.
- When the result carries video, it is a candidate asset and not yet on the timeline; after synthesis, measure first (section 4), then place it.

## 4. Measure, check the seams, redo

- **Measure**: take the result's duration from the media facts in the result and compare it with the budget. If it runs over, decide by section 1 whether compression is allowed, then redo that passage; do not change the timeline speed. If it runs short, deliver it as is.
- **Align**: transcribe the narration asset (transcribe with the narration's asset, the language asserted as the script's language, proper names in the hint) to get each word's timing; captions and cuts both use these timings, not estimates.
- **Check the seams** (measured): from the aligned word timings and the counting method of section 1, compute each sentence's units per second and the pauses between sentences. Sentences that deviate from the median by more than 15% and pauses between sentences longer than 0.8 seconds are candidates for redoing or trimming silence.
- **Redo one sentence**: speak only that sentence (same voice, same instructions, a new seed), and use the aligned timings to replace that sentence's range on the timeline; when the new sentence is longer than the old one, handle the text-versus-time conflict by section 1, without changing speed.
- **Listen** (needs a human): export 2-3 five-second clips of the narration (each spanning a sentence boundary) for the user to hear, asking "does it sound like the same person" and "do the pauses sound natural". When you cannot listen yourself, write "not listened to" in the report truthfully; do not write "measured" as "listened".
- **Do not add speed changes to the narration** on the timeline: a speed change keeps the pitch but changes the ratio of speech to pauses, making existing differences in pace more obvious; the small speed changes used for alignment in the translated-dubbing workflow belong to that workflow and are not used here.

## 5. Cut the visuals to the narration

- The narration is one track: place it and measure it first, then lay out the visuals by the start and end of the sentences in it: one shot or one group of shots per sentence, with cut points falling in the pauses between sentences, never in the middle of a word.
- Where the visuals come from: the user's assets first; for sentences about concepts, metaphors or scenes with no assets, you may generate one still per sentence or per group of sentences (ratio by the aspect ratio, no text in the image, one style description for the whole video, pass `video` when generating; for how to call it, use `skills_read` to read `cuccut-catalog-media`, section "Generating images"); text, numbers, steps and charts use code visuals (use `skills_read` to read `motion-graphics`). Stills do not move, so do not hold one too long; add transitions or keep the shot short. When the narration talks about real products, people or data, use real footage; do not pass off generated images as them.
- Music sits low under the narration (setDucking), and sound effects fall between sentences. When music is wanted, use `skills_read` to read `cuccut-catalog-music`: use the user's music if they gave some; otherwise generate instrumental music if this machine can; generate it once the narration is measured, the visuals laid out and the video's duration settled. Music for a narrated video should be sparse, with steady dynamics, never competing with the voice, fading out smoothly over the last 2-3 seconds and never cut off in the middle of the last sentence.
- Captions break lines by the narration script, not by the recognizer's sentence splits; use the aligned word timings.

## 6. Acceptance

- The script is within budget; the video's duration matches the narration's (the difference is the intro and outro).
- The narration has only one voice and one set of delivery instructions, and the seed used is recorded in the report; when a preset speaker was chosen, the risk is stated.
- Each sentence's characters per second and pauses were measured, and abnormal sentences were handled or listed in the report.
- The report has three columns: measured (durations, characters per second, pauses), seen (cut points, caption positions), needs a human ear (consistent voice, natural pauses, breathing with the visuals).
