# Picture and sound for talking heads

Do these only after the cuts are settled. Time conversion is in `SKILL.md` section 1; for every step's fields, edits_apply's documentation is authoritative.

## 1. Punch-in emphasis

Enlarge the picture slightly on the sentence to emphasize, and return to the original size on the next sentence. It also covers jump cuts: when two segments from the same camera angle are joined, a change in shot size turns the jump cut into a deliberate edit.

- The amount is a starting point: about 1.1-1.15x is noticeable; beyond about 1.3x most footage starts to look soft and the face easily leaves the frame. Be more conservative with low-resolution footage.
- How: use splitItem to split the main picture item at the start of this sentence and the start of the next one (in timeline seconds), and enlarge **the middle item's own picture**; do not stack another copy of the same asset on top. The picture and sound already live on this item, so lip sync cannot drift, and later cuts and moves carry it along.
- When the item's place.mode is fullscreen (filling the canvas), setTransform's scale has no effect: in the same edits_apply, first use setStyle to change mode to pip, then setTransform with x 50, y 50, the width w needed to fill, and scale (for example 1.12). When the asset and the canvas have the same aspect ratio, w is 100; when the asset is wider than the canvas, w = 100 × (asset aspect ratio / canvas aspect ratio).
- After enlarging, the person must still be in frame: when they are not centered, nudge with setTransform's x and y so the eyes and chin do not leave the frame. The nudge must not reveal the canvas: horizontally |x - 50| must not exceed (w × scale - 100) / 2, and vertically likewise by the picture's height; if it does, enlarge a little more or nudge less.
- Grabbed frames (videos_frames) show the asset picture without the punch-in, so you cannot see the composited result: when done, ask the user to look in the editor at the picture before, during and after this sentence, or export those seconds of the finished video and look; state in the report which things you did not see with your own eyes.
- How many to use depends on the content; enlarging every sentence means nothing is emphasized.

## 2. B-roll

- **The picture follows the words**: B-roll appears at the word that mentions it (addItem's at is that word's moment on the timeline), stays through the sentences about it, and cuts back to the person at a pause between sentences, never in the middle of a sentence. Put it on a visual track above the main picture (addTrack one if there is none); use trimItem to trim its end to that pause; mute B-roll video that has sound with setAudioMix so it does not cover the voice. To fill the frame, change mode to fullscreen with setStyle.
- Sources in this order: provided by the user -> public footage with clear source and license (provided or approved by the user) -> generated images. When the talk mentions something specific that can be screenshotted or screen-recorded, use the real picture.
- **Generated B-roll** only goes with sentences about concepts, metaphors, scenes or emotions: each image draws one concrete, visible thing from that sentence, ratio by the video's aspect ratio, no text in the image, one style description for the whole video. Do not pass it off as a real thing the speaker mentions (a product, a person, an event, a set of data); there, use real footage or nothing. A video usually needs only a few; keep shots of stills short. For how to call it, how to write the prompt and what to do when it cannot draw, use `skills_read` to read `cuccut-catalog-media`, section "Generating images"; pass `video` when generating, so the images go into candidate assets and then onto the timeline.
- Write sources and licenses into the report.

## 3. Vertical framing

Turning a horizontal talking head into a vertical one:

- Change the canvas: edits_apply's updateSequence changes canvas to a vertical size (for example 1080x1920). Item positions are stored as percentages of the frame and follow the canvas; then frame each shot.
- **One framing per shot**: within a shot the person's horizontal position is fixed and does not follow every sway; the framing changes only at cut points.
- **Crop to vertical by position**: set the item to pip with setStyle; setTransform's w is the width needed to fill the canvas height (a 16:9 asset in a 9:16 canvas is about 316; for other ratios, w = 100 × (asset aspect ratio / canvas aspect ratio)), and x decides which part of the asset shows: when the speaker's horizontal position in the asset is f (0 far left, 1 far right), x = 50 + (0.5 - f) × w, keeping |x - 50| no more than (w - 100) / 2. The speaker's position is known only after looking at the picture: use videos_frames to grab a few frames at the start and end of each shot and where the movement is largest (in timeline seconds), see which side of the asset the person is on, and estimate f; when you cannot grab frames or are unsure, center it first and ask the user to check in the editor that nobody leaves the frame. The cropped result is not visible in frames; ask the user to go through it in the editor.
- **Put the whole horizontal picture into vertical** (a sharp copy centered, with a blurred version of the same picture behind it): set the main picture item with setStyle to mode fullscreen, fit contain, bg blur.
- **Two people**: you can keep the full horizontal picture (no canvas change, or the blurred background above). Switching the framing to follow the speaker, or stacking the two people vertically, has no corresponding method here: tell the user and ask them to adjust it themselves in the editor, or keep it horizontal.
- All of these are **fixed framing**; they do not follow a person who walks around.

## 4. Sound

- The voice comes first. When a segment's voice is too quiet or too loud, change that item's own sound: setAudioMix's volume, not another stacked audio track. Talk to the user about volume in decibels, and convert to a linear factor when writing the operation: factor = 10^(dB / 20) (+6 dB is about 2×, -6 dB about 0.5×).
- Music is optional; do not add it unless the user asked, and you can mention at delivery that it could be added. When used, it sits under the voice: the words stay clear while speaking, and the melody does not compete.
- Where music comes from, how to generate it and how to place it: use `skills_read` to read `cuccut-catalog-music` and follow it. The key points: use the user's music if they gave some; when the user wants music and has none, generate instrumental music if this machine can, with a style written from the talking head's content and mood, sparse, with steady dynamics and no prominent lead melody, for example `ambient, soft piano, warm pads, slow tempo, sparse arrangement, steady dynamics, understated`; generate it after cutting, once the duration is settled, submitting once and waiting for completion; when it cannot be generated, tell the user as that page says, and do not search the web for music.
- Placing it: its own audio track, base volume low at first (setAudioMix volume around 0.3), fading in at the start and out over 2-3 seconds at the end; then use setDucking so it lowers automatically while the person speaks: trigger `{"kind":"items","trackIds":[the track the voice is on]}`, target pointing at the music track, depth 10 dB by default (transcript-triggered speech does not duck yet in this version, so trigger by the voice track). When the talking head has cuts, music laid continuously masks the jumps in background noise at the cuts; do not cut it along with the cuts. Write sources and licenses into the report (locally generated music is for non-commercial use only).
