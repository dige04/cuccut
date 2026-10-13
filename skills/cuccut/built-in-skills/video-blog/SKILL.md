---
name: video-blog
description: Use to turn a video into a blog post, newsletter/column article or illustrated write-up: a complete article readable without the video, from the author perspective (the user's own video) or viewer perspective (someone else's, with sources). Needs the transcript. Not for key-point summaries.
version: 2.2.0
---

# Turning a video into a blog post

The person reading this article has not seen the video and most likely does not plan to. They want a complete article: after reading it, they understand the ideas the video explained, remember its examples, and can follow its steps. So it is neither a tidied-up transcript nor a summary: a summary tells readers what the episode covered, while the article retells the episode's content in full, in a form people can read through.

The two easiest ways to get it wrong: one is to strip the filler words from the transcript, split it into a few paragraphs, add a few headings and hand it in - it still reads like a record of someone talking, jumping back and forth, with unclear references and nothing explained that needs explaining; the other is to drift into a summary, each topic passed over in two sentences, with the examples, numbers and steps gone. Readers cannot get through the first, and take nothing away from the second.

Before writing, use `skills_read` to read this skill's `references/writing-baseline.md`: the material, the baseline (stay faithful to the transcript, do not invent, report without embellishing, fill in the background), the two kinds of reader and perspective, the length and style levels, and the defaults are all there and are not repeated below.

## 1. Gather the material

1. Look at the video's documents with videos_inspect. If there is no transcript (a document of kind speech), transcribe first and tell the user the transcription is running. An unpolished transcript may misspell names and terms; check them against the video info.
2. Timestamped transcript: export (kind `transcript`, format `md`, timestamps `true`; when there are several transcripts, pick one by documentId from the candidates it lists), wait with jobs_inspect until completed, and read the file in outputs. The times are on the edited timeline; take them when marking points in time, and do not estimate them yourself.
3. Video info: the video name and chapters from videos_inspect; use only the source title, author, publishing platform and links found in the video info or provided by the user.
4. No video (for example only downloaded from a link and transcribed): jobs_inspect's outputs have SRT and TXT; read them directly.
5. Read a long transcript in parts first (by chapter or time); for each part note the topic blocks, quotes to use and their timestamps, then combine them into the final piece. Do not write the final piece after reading only part of it.
6. **Look at the picture when needed.** Where the transcript talks while pointing at the screen (demos, slides, code, charts, "this", "here", "look at this") and the text alone does not tell you what is meant, use videos_frames to take a few frames at those timestamps (`at` lists moments, or `range` with `count` samples evenly, at most 24 frames per call; read each frame's `file`). Skip pure conversation and anything the transcript alone makes clear. A frame is the footage at that moment, without subtitles, text or overlaid elements; what you see in the picture is background you added, and readers must be able to tell when it goes in.

## 2. Language

For the output language, take the first of the following that exists:

1. The language named in this request; if none is named, the language of the user's message to you this time.
2. The interface language: when the session context gives the user's interface language, use it.
3. The transcript's language.

Skip item 1 when the user's message is only a few words and its language cannot be told. When unsure, go by the order above and mention on delivery that a version in another language is also possible. The writing baseline holds for any language; the wording on this page is only illustrative.

## 3. Before writing

First get the following clear; none of it goes into the deliverable:

1. **Which perspective.** Follow the user if they said; if not, judge by the baseline's "Perspective" section: when the user's preferences state their identity and the video is clearly the user's own, use the author perspective; when it was clearly published by someone else, use the viewer perspective; when neither is clear, use the viewer perspective, and you may briefly ask when unsure. Presenting someone else's words as the user's own is worse than writing the user's words as reporting.

   | | Author perspective | Viewer perspective |
   | --- | --- | --- |
   | When | The video is the user's own | The video is someone else's |
   | Written for | The user's readers: people who follow the user, people who find this post by search | People who have not seen the video and want to know what is in it |
   | Goal | An article publishable under the user's name that makes people want to read on | An article that can replace watching the video: complete and faithful |
   | Voice | The user themself; first person is fine | Third-person reporting, views attributed to whoever voiced them |
   | Opening | Gripping (section 4) | State the source, then what this piece covers and who it is useful for |
   | Recurring sections | Add the byline, closing follow line etc. from the user's preferences | No byline or promotion for the user |

2. **What is most worth reading in this article.** Write it down in one sentence: a conclusion, a result, a question, an experience. The opening starts from it, and so does the title.
3. **Why readers would care.** What were they curious about, torn over, assuming by default? Where does this land in their own work and life? "What it has to do with the reader" must be concrete; do not say things like "this matters to everyone".
4. **The article's skeleton.** Gather what the video says about the same topic in scattered places into one section; conclusions may come earlier; when the same idea is said several times, keep the clearest. Order follows what readers need to understand, not the video's sequence. Cause and effect must not change in the reordering.
5. **Where readers will get stuck.** For every name, company, term, metaphor and skipped step the speaker passes over in a word, ask: would someone who has not seen the video know what is meant? For those they would not, add a sentence in the body, say what it means in plain words, or leave it out.
6. **Where images are needed.** Slides, demos, charts, physical objects, the results of an action - anything words alone cannot make clear: note the timestamp (section 6).

## 4. The opening

Readers decide after the first few sentences whether to read on.

**Author perspective**: the first few sentences tell readers what they get by reading on, starting from the one thing most worth reading. No small talk, no opening with "Today I want to talk about" or "Lately a lot of people have asked me". Whatever grips must be delivered in the body. For tone, follow this time's style first, then the user's preferences, and when there are neither, the way the user talks in the video; the user's views and reservations in the video do not change with tone.

**Viewer perspective**: the first paragraph says whose video this is, which episode and where it was published (per the video info), who the speaker is and why they are worth listening to on this topic, then what this piece covers and who it is useful for. Be specific about the source without writing a resume: say the thing they did that bears directly on this topic, not a pile of job titles.

Compare (illustrative only; do not copy the formula):

Bad: Today I want to talk about code review. As AI tools become more and more widespread, many teams have run into new problems. Below, drawing on my own experience, I'll discuss it from a few angles.

Good: In the first two weeks after our team brought in AI to write code, we shipped no faster - we got slower. Code output tripled and piled up at review: nobody could keep up reading it. This post covers how we fixed our review process, and the second thing we were forced to change once we had.

After the first opening, readers only know "this is going to be about code review"; after the second, they already know what the piece covers and what it has to do with them, and want to read on.

**Multi-person conversations** can occur in either perspective: either write them as reporting (grouped by topic, views attributed to people) or keep the Q&A form; a Q&A must also be edited, not a pasted transcript.

## 5. From speech to writing

- Remove filler words, restarts, half-finished sentences and off-topic chatter; when a point is made several times, keep the clearest.
- Write out what speech conveyed through tone, gestures and the picture: what "this" and "over there" refer to, what was being demonstrated on screen at the time. If you looked at frames, write clearly what you saw.
- Keep the examples, numbers, steps and the key wording of the original. They are the most valuable part of the article, and the part most easily lost in "tidying up".
- Positions do not change. Where the speaker hedged ("I guess", "maybe", "in a situation like ours"), the article hedges too; do not turn "sometimes works" into "works".
- Terms: for tool names, framework names and technical details the speaker mentions in passing, first ask whether they are necessary for readers to understand this section. Leave out the unnecessary ones; for ones plain words can make clear, do not use the term itself; explain unavoidable core concepts on first appearance with one sentence readers can picture, not with another term. The speaker's own analogies are usually the best explanation; use them in the body.
- Report without mixing in evaluation. Readers must be able to tell which sentences the speaker said and which the author said. This matters most in the viewer perspective: report what the other person said as it was; commentary is the author's and is written separately.
- Background follows baseline item 4. What you add are facts that help readers understand the video's content, not your own extended discussion of the topic; add no views the video did not express.

## 6. Structure and images

- The **title** is decided by the content and starts from the one thing most worth reading; an author-perspective title must also be compelling, and likewise says only what the video delivers.
- **Split the body into sections**, each heading stating the section's conclusion or what it covers ("The bottleneck moved from writing code to reviewing it", not "About code review", let alone "Part one"). The video's chapters can be a starting point for sections, but chapters exist for viewers to jump around; the article's sections follow what reading needs.
- Within a section, use natural paragraphs, not lists: a list cannot hold "because ..., so ...". Content that is itself a list (steps, checklists, comparisons) is the exception.
- The **ending** stops where the content ends, with no "in short" or "hope this helps"; in the author perspective, add the recurring closing section if there is one.
- **Images**: some content needs an image to be clear: slides, demos, charts, physical objects, the results of an action. At those places, state what picture is needed and which point in the video it corresponds to (taken from the transcript's timestamps), with a one-sentence caption below. Images support the text and do not replace it: with the image removed, the passage still makes sense; add images only where a picture is needed, not one per section for looks. Frames taken with videos_frames can be handed to the user directly as material (they are footage, without subtitles or overlays); for a picture with subtitles or overlay effects, ask the user to capture it in the editor. Mark illustrations that are not in the video and must be drawn separately as added. When the user agrees to generated illustrations, you may generate them with image (without `video`): draw only diagrams and concept images (a metaphor, a scene, a relationship), never posing as the video's picture, a product UI, real people or data; use one style description throughout, and an aspect ratio suited to the image's place in the article (usually landscape `16:9` or `4:3`), with no text in the picture. Save them with artifacts_save in the same directory as the article, with equally flat file names (such as `<video name>.blog.fig-1.png`), and state in the caption that they are generated. For how to call it and what to do when it cannot draw, use `skills_read` to read `cuccut-catalog-media`, section "Generating images".
- **When the user asked for keyframe illustrations** (the tool page has "Add keyframe illustrations" checked, or they asked for images in the conversation): take frames only at the places described above that need a picture, giving those moments to videos_frames (`at`, seconds on the timeline), one frame per place; when the picture changes during the speech, take two or three more and pick the clearest. Frame files are in `.cuccut-out/frames/<videoId>/` in the working directory; copy the ones used into the article's directory, with file names carrying the article name and no subdirectories (such as `<video name>.blog.at-12500ms.png`; subdirectories do not survive delivery, while flat file names hold anywhere), and write them in the article as Markdown images with relative paths, `![caption](<video name>.blog.at-12500ms.png)`, with a one-sentence caption below saying what the image shows and which point in the video it corresponds to. When it is not checked and no images were asked for, insert no images; only state what picture is needed as in the previous item. When delivering the article per section 9, deliver the images one by one in the same way, still in the same directory as the article, and tell the user how many there are and where.

## 7. Length and style

An article has no fixed length: write until it is clear, and every extra paragraph readers read should give them something. Making a point clear to non-specialist readers takes a few more words; that length comes out of the specialist detail you cut. What the levels mean is in baseline section 4; for articles specifically:

| Length | What the article is like |
| --- | --- |
| Short | A short piece: only the one or two things in this video most worth telling, made clear |
| Medium (default) | The video's main content is all covered; key examples and steps are kept |
| Long | A full retelling of the video's content: every argument, example, step and number is there, background filled in, and every place needing a picture has its image stated |

| Style | In the article |
| --- | --- |
| Plain (default) | Make the content clear, no commentary. The author perspective defaults to the way the user talks in the video |
| Popular science | Reorganized for laypeople: start from what readers already know, explain terms one by one, use more examples and analogies |
| Roast | The author tells it with attitude: commentary and teasing. In the viewer perspective, report what the other person said as it was; the commentary is the author's |
| Other | Write as the user describes; when given a model piece, learn its tone and structure without copying its sentences |

When the transcript is long and the long version is wanted, write the second half as fully as the first.

## 8. What to avoid

- Do not hand in the transcript minus its filler words as an article; do not drift into a summary either.
- Do not open with "Today I want to talk about" or "With the development of ..."; in the viewer perspective, do not write the introduction of people as a resume.
- Do not carry over every tool name, framework name and technical detail the speaker mentions.
- Do not use bullet points in the body, and do not write headings like "Part one" or "About X".
- Do not invent anything the transcript lacks; above all, do not fill in speakers' titles, experience or data by guessing.
- Do not mix evaluation into reporting; connectives like "even better" or "ironically" are evaluation too.
- Do not add "in short", "to sum up" or "hope this post helps", and do not force an uplifting conclusion.
- In the author perspective, do not make promises on the user's behalf that the video did not make, nor announce plans the user did not state.

## 9. Delivery

- Write a Markdown file in the working directory (such as `<video name>.blog.md`; for several languages, add a language tag before the extension, such as `<video name>.blog.en.md`). Save versions of different length or style separately; before a major rewrite, save the previous version under another name, and make small fixes in place. When the session does not belong to a project, the user cannot see the working directory: also put the file in the downloads directory with downloads_save and tell the user the path it returns; when keyframes were inserted, handle the image files one by one the same way.
- Tell the user: the file's real path; which perspective was used and why; which language the output uses and by which rule it was chosen; what background was added beyond the transcript (including what was seen in the picture); which information was not verified and which links the user needs to fill in; which images the user needs to capture; when keyframes were inserted, where the image files are and how many there are.

## 10. Self-check

- The perspective is right: the author perspective uses the user's voice; the viewer perspective states the source and does not present others' views as the user's.
- Reading only the opening, do readers know what the piece covers, what it has to do with them, and do they want to read on? In the author perspective, does the body deliver what the opening used to grip?
- It makes sense without watching the video; every "this" and "there" refers to something; every remaining term, name and company is necessary and explained on first appearance.
- Every fact, number and name is in the transcript or video info; added background is distinguishable and certain; readers can tell that what was seen in the picture is added.
- The speakers' positions and reservations are all there; no evaluation is mixed into the reporting.
- The examples, numbers and steps are still there, not lost in "tidying up".
- No passage is copied wholesale from the transcript, and it has not turned into a summary.
- Skimming only the headings, you can see what each section covers.
- Places needing a picture state what picture is needed; it still makes sense with the images removed. When the user asked for keyframe illustrations, every image has a caption, paths are relative to the article's directory, and the image files sit with the article.
- The output language follows the order in section 2; length and style are the level and style asked for this time.
