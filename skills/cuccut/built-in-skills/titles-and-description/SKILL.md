---
name: titles-and-description
description: Use when the user wants titles for a video they will publish (candidates, another batch, more like one) or a video description (text under the title, chapter list, tags). Compelling, and every line delivered by the video. Needs the transcript. Not for writing unrelated to a video.
version: 2.0.0
---

# Titles and descriptions

The user's video is done and about to go out. The title decides whether anyone in a list clicks; the description decides whether those who click keep watching, and whether those who finish can find the things the video mentioned. Both are written for the person publishing the video: compelling, and every line delivered by the video. Titles and descriptions work together: offer title candidates first, let the user pick one, and use it when writing the description.

The easiest way to get them wrong: start from a formula. "Shocking!", "You won't believe", "X explained in one video" would fit any other video just as well, which means they use nothing unique to this one. Or the opposite: the title restates the video's name and the description is a blow-by-blow recap that makes no one want to click.

Before writing, use `skills_read` to read this skill's `references/writing-baseline.md` (material, baseline, the two kinds of reader and perspective, length and style, defaults). For titles also read `references/titles.md`; for descriptions also read `references/description.md`.

## 1. Gather the material

1. Look at the video with videos_inspect: its name, chapters (the chapters' atSeconds and title), documents. If there is no transcript (a document of kind speech), transcribe first and tell the user the transcription is running. An unpolished transcript may misspell names and terms; check them against the video info.
2. Read the transcript: export (kind `transcript`, format `md`, timestamps `true`; when there are several transcripts, pick one by documentId from the candidates it lists), wait with jobs_inspect until completed, and read the file in outputs. When there is no video, only the result of downloading and transcribing from a link, read the TXT or SRT in jobs_inspect's outputs.
3. Video info: use only the source title, author, original video link and publishing platform found in the video info or provided by the user.
4. What the user asks for this time: language, length, style, number of candidates, publishing platform, perspective; the title already chosen; candidates offered earlier and the one the user wants to follow - find all of these in this conversation. When the user says the title and description go on the same platform, write both for that platform.

## 2. Before writing

Get these two things clear first; they do not go into the deliverable:

1. **What is most worth watching in this video.** Write it down in one sentence: a surprising conclusion, a concrete result, a question people care about but cannot answer, an unusual experience, a method usable right away. The title starts from it, and so does the opening of the description. A video often has several points worth watching; they are the starting points of different candidates.
2. **Why the viewer would click.** What were they looking for, curious about, assuming? What does this video save them, help them avoid, give them? Make that connection concrete.

## 3. Delivery

- Titles: give the candidates directly in the reply, each with its angle and a one-sentence reason, and mark the recommended one; ask the user to pick one, or to ask for another batch or a few more like one of them.
- Description: give the full text directly in the reply (tags on a line of their own). When the user wants a file, write a Markdown file in the working directory (such as `<video name>.description.md`; for several languages, add a language tag before the extension); when the session does not belong to a project, also put it in the downloads directory with downloads_save and tell the user the path it returns.
- Also state: which perspective you used and why; the title the user has already picked (or that the user still has to pick); which information was not verified and which links the user needs to fill in; when a platform was named, remind the user to check against that platform's current rules.

## 4. What to avoid

- Do not start from a formula; rewrite any title that still works with the video name and people's names swapped out.
- Do not promise what the video does not give: numbers, "best"/"first", open questions - the video must contain them.
- Do not pass off rewordings of the same sentence as different candidates.
- Do not invent links, chapter times or platform rules.
- Do not open the description with links, tags or a byline, and do not write it as a blow-by-blow recap.
