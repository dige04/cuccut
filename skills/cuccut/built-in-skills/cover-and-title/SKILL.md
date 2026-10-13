---
name: cover-and-title
description: Use when the user wants a video cover (thumbnail), big cover text, or title and cover together - find the selling point in the transcript, offer title and cover-text sets, then generate covers at the video's aspect ratio as candidate assets. Titles or descriptions alone - titles-and-description.
version: 2.1.0
---

# Cover and title

In a list, viewers see the cover and the title together, for less than a second in all. The cover is a small image plus a few big words; the title is one line of text. The title says what this is; the cover gives the picture and the hook. They complement each other and do not copy each other. Written for the person publishing the video: compelling, and every line delivered by the video.

The easiest ways to get it wrong: the big cover text copies the title again, so the two together still say one thing; or the big text is too long and cannot be read once shrunk to a thumbnail; or the cover promises something the video does not have, and viewers who click find it is not what they were told.

## 1. Gather the material

1. Look at the video with videos_inspect: name, aspect ratio (width and height), chapters, documents. If there is no transcript (a document of kind speech), transcribe first and tell the user the transcription is running.
2. Read the transcript: export (kind `transcript`, format `md`, timestamps `true`), wait with jobs_inspect until completed, and read the file in outputs.
3. What the user asks for this time: how many sets, a limit on cover text length, style, language, publishing platform, a title already picked - find all of these in this conversation. When no language is given, use the transcript's language.

## 2. Write titles and cover text

1. First say in one sentence what this video gives the viewer: what problem it solves, what conclusion it reaches or what they get to see. Both the title and the big text start from this sentence, not from a formula.
2. Offer several candidate sets (5 if the user did not say), each from a different angle: straight statement, question, number, contrast, quote and so on. Each set is one title plus one line of big cover text.
3. Keep the big text short (when the user did not say, within a few words by the conventions of that writing system; for Chinese and Japanese, about 8 characters at most) so it reads at a glance even as a thumbnail, and do not repeat the title's words: the title says "what it is" and the big text gives "the hook", or the other way round.
4. Every number, conclusion and name in the title and cover must be traceable to the transcript; no exaggerated claims, no promises of what the video does not give.
5. Give each set a one-sentence reason, mark the recommended set, and ask the user to pick one, or to ask for another batch or a few more like one of them.

A comparison (illustrative only):

Bad: title "Sharing our AI code review practice" + big text "AI code review practice" (the big text copies the title, and neither says what is worth watching)

Good: title "AI-written code tripled - here's how we changed code review" + big text "Humans only check what AI isn't sure of" (the title says what it is, the big text gives the hook of the method, short, and the video really covers it)

## 3. Generate the cover

Do this only after the user has picked a set; do not generate all the sets up front: generation costs time and money, and the sets not picked are wasted work.

1. **Where the picture comes from**: first use videos_frames to grab a few frames at chapter starts and at places with clear emotion or action, and look for a frame where the person or subject is clear and the expression or action has tension. Frames are source-asset pictures and contain no captions or overlaid elements.
2. **Generate**: check capabilities first; use `skills_read` to read `cuccut-catalog-media`, section "Generating images" - the differences between services, the order of the prompt and what to do when it cannot draw are all there. Use image with a `prompt` and a `size` matching the video's aspect ratio (an aspect ratio such as `16:9`, `9:16`, `1:1`; a ratio the user names takes priority; when the model does not support that ratio, take the closest one it supports and tell the user; when the model takes no size, omit `size` and state landscape or portrait in the prompt), pass `video`, and the results are imported as candidate assets of this video, not placed on the timeline. image does not accept reference images: describe the subject, composition and style clearly in the prompt (person or subject on one side, a clean area on the other side for the big text), and describe the picked frame's picture in it; when the user wants a cover with a real photo of the person, tell the user they can use that frame directly and add the big text themselves on the platform or in an editor.
3. **Big text**: text in generated images is often misspelled. Ask in the prompt for a clean area for the big text; when the user wants the text in the image, read the image after generating, and if the text is wrong, regenerate or tell the user.
4. When the user did not say how many images, generate 2 with `count` 2; when the model makes only one image per run (`maxCount` is 1), submit twice.

## 4. What to avoid

- Do not copy the title into the big text, and do not make it longer than can be read at a glance.
- Do not promise what the video does not give; numbers, conclusions and names must be in the transcript.
- Do not generate every set before the user has picked one.
- Do not ignore misspelled text in generated images.

## 5. Delivery

- In the reply, give the title and big cover text the user picked, plus the other candidates so they can switch later.
- Cover images: every `artifactId` that image returns and the imported assets; say which frame or what description you used, and why.
- Which information was not verified; when a platform was named, remind the user to check against that platform's current cover size and text rules.
