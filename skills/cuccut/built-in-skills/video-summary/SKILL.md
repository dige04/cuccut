---
name: video-summary
description: Use to summarize a video, distill key points, or write a digest or minutes-style recap: the two or three things most worth taking away, explained fully, plus key points with video times. Any video with a transcript (interviews, talks, tutorials, meetings...). Not for non-video text or blog posts.
version: 2.0.0
---

# Video summary

Readers come to a summary because they have no time to watch the original video. They want to know only one thing: what in this episode is worth taking away for me. So a summary is not an abridged version of the original; it need not cover every topic or keep the original order. Its job is to pick out the two or three most valuable things, start from the questions readers care about, explain them fully, and say little or nothing about the rest.

The easiest way to get it wrong is a blow-by-blow recap: open with the guest's resume, then summarize chapter by chapter, each block about the same length. All the information is there, but readers have to read it front to back to find which sentences matter, which hands the sifting right back to them.

Before writing, use `skills_read` to read this skill's `references/writing-baseline.md`: the material, the baseline (stay faithful to the transcript, do not invent, report without embellishing, fill in the background), the two kinds of reader, and the length and style levels are all there and are not repeated below.

## 1. Gather the material

1. Look at the video's documents with videos_inspect. If there is no transcript (a document of kind speech), transcribe first and tell the user the transcription is running. An unpolished transcript may misspell names and terms; check them against the video info.
2. Timestamped transcript: export (kind `transcript`, format `md`, timestamps `true`; when there are several transcripts, pick one by documentId from the candidates it lists), wait with jobs_inspect until completed, and read the file in outputs. The times here are on the edited timeline, and cut words are not in it; take key-point times from it, and do not estimate them yourself.
3. Video info: the video name and chapters from videos_inspect; use only the source title, author, description, links etc. found in the video info or provided by the user.
4. No video (for example only downloaded from a link and transcribed): the SRT in jobs_inspect's outputs has timestamps; read it directly.
5. **Look at the picture when needed.** Where the transcript talks while pointing at the screen (demos, slides, code, charts, "this", "here", "look at this") and the text alone does not tell you what is meant, use videos_frames to take a few frames at those timestamps (`at` lists moments, or `range` with `count` samples evenly, at most 24 frames per call; read each frame's `file`). Not every video needs frames: skip pure conversation and anything the transcript alone makes clear. Use the frames only to work out what the speaker is pointing at and to write it clearly; what you see in the picture is background you added, not something the speaker said, and readers must be able to tell when it goes in. Frames show the footage only, without subtitles, text or overlaid elements.

## 2. Language

For the output language, take the first of the following that exists:

1. The language named in this request; if none is named, the language of the user's message to you this time.
2. The interface language: when the session context gives the user's interface language, use it.
3. The transcript's language.

Skip item 1 when the user's message is only a few words and its language cannot be told. When unsure, go by the order above and mention on delivery that a version in another language is also possible. The writing baseline holds for any language; the wording on this page is only illustrative, so in another language use that language's equivalent phrasing.

## 3. Who it is written for

The default reader is curious about the topic but not in the field: follows the news, has used related products, can name the big companies, but has never worked in the industry and does not know the jargon. When the user names another reader, go with the user's.

This reader is smart, just not trained in this field. Do not talk down to them or explain everything from scratch; the job is to keep them from getting stuck on jargon. This setting decides three things: what to pick as the highlights, how to handle terms, and how finely to explain a point.

## 4. What the output is

Two parts:

- **Summary body**: a piece of writing organized around the highlights. The first few sentences point out what is most worth taking away, the body explains those things fully, and minor content is passed over in the last few sentences or left out.
- **Key points**: a set of short sentences, each a conclusion, method or number worth remembering, noting the time in the video of the passage it rests on, so readers can jump from it back to that passage.

The body gives the full story; the key points are a guide: a glance at them tells readers which passage to revisit. The number of key points depends on the content; do not pad. Places in the body worth revisiting may also note their time.

## 5. Before writing

First work out the following from the transcript; none of it goes into the deliverable. When the user gave a focus or attached their own thoughts in this request, steps 2 and 3 revolve around it.

1. **Who is speaking.** Identify the host and guests: who each speaker is and in what capacity they speak. Rely only on self-introductions in the transcript, introductions by others, experience mentioned in passing ("back when we were building X") and the video info. When the transcript has only speaker numbers and there is no way to confirm, use roles such as "the host" and "the guest"; do not guess names.
2. **Pick the highlights.** This is the most important step; every later choice rests on it. After reading it through, ask yourself: if I could tell a friend only two or three things from this episode, which would they be?

   What counts as a highlight is usually a novel or counterintuitive judgment, inside stories and details only someone who was there could tell, practices readers can use directly, and the strong cases and numbers behind these. Common knowledge, pleasantries, vague outlooks and views worn out elsewhere do not count, even if they take up a long stretch of the video. How much time something takes in the video has nothing to do with whether it is worth writing.

   Pick from the target reader's position, not an insider's. From the same episode, practitioners and laypeople want to take away different things; content only insiders care about goes further back, however brilliant, or is passed over in the last few sentences. There are usually two or three highlights, never more than four. If you cannot pick any and every topic seems about equally important, you have not thought it through yet; read it again.

   When the user named a focus, that focus is the highlight of the whole piece: the opening cuts in from it, it gets the longest and most complete treatment, and everything else is compressed accordingly.
3. **Work out why readers would care.** For each highlight, find which of the reader's questions it answers: what were readers curious about, torn over, assuming by default? For example, readers have always assumed A, and the speaker shows from experience that it is actually B; or readers are worried about something and the speaker happens to offer a way through. That connection is the way into the opening and the lead-in when each section unfolds.
4. **Work out why the speaker is worth listening to.** Readers most likely do not know them. The question is not "what is their resume" but which experience gives them, on this topic, a perspective others lack. With several speakers, tell apart how their perspectives differ (practitioner, researcher, investor; complementing each other or opposed). Work out the host too: who they are decides the nature of the conversation - peers swapping practices, a layperson consulting an expert, or questioning with skepticism; a host who only links segments and whose identity has nothing to do with the topic needs no introduction. The result of this step is held in reserve: where a claim needs weight, or readers need to know "who is asking and who is answering", point it out in one sentence.
5. **Sort the remaining content.** Content outside the highlights falls into three kinds: what supports a highlight (argument, cases, background) is folded into that highlight; what is unrelated to the highlights but readers may want to know is passed over in the last few sentences; the rest is left out. The test is to ask: if I delete it, what does the reader lose? If you cannot say, delete it.
6. **Mark where readers will get stuck.** Look only at what will go into the summary. Speakers are all insiders, and they mention many companies, events, analogies and terms in passing. Ask of each: does the target reader know what is meant here? For those they do not, handle them as in section 7.
7. **Check the background.** Names of people, companies, products and events that will go into the summary follow the transcript and video info; transcripts are mostly machine-generated and often misspell names, so check them against the video info. When you can search the web, you may; use what you find only to introduce people and fill in background, never as the speaker's views; when what you find does not match the transcript, the transcript wins, with a note if needed. When you cannot search or find nothing, write only what the transcript and video info support; do not fill in from memory.

## 6. Writing the body

### The opening

Readers decide after the first few sentences whether to read on. The opening must do two things: draw readers in to keep reading, and let them quickly understand what this episode covers and what it has to do with them. Put the most valuable thing first. A reader who reads only the opening and leaves should already have taken away the core of the episode.

How to cut in depends on the best material this episode has; there is no fixed order:

- The video has a concrete scene or story that by itself shows the core of the episode. Tell that story directly.
- The speaker has a judgment that runs against what most people think. Put the common assumption and their judgment side by side.
- A question readers are torn over or curious about, which this episode happens to answer.
- A surprising number or fact.

"What it has to do with the reader" must land on the reader's own life and work: what the things they use will become, whether what they are working hard to learn now is still worth it, whether they should do something. Be concrete; do not say things like "this matters to everyone". If the episode genuinely has no direct bearing on ordinary readers, it is enough to say plainly what it covers and why it is worth knowing; do not force a connection.

The opening must read easily: two or three short paragraphs, no more than three hundred words; if it cannot fit, you are trying to cram in too many points, so keep only the most important one and its one or two most direct supports. The relations between the highlights must show (because, so, but); do not pile them into a string of unrelated points. Avoid terms that need explaining as far as possible.

Compare (illustrative only; do not copy the formula):

Bad: This episode's guest leads the coding tools team at a company and has previously built developer tools at several companies. In this episode, he talks about how the product came about, technical choices, changes in code review, and his views on the future of programming.

Good: AI writes code faster and faster, yet teams are not shipping any faster - what is going wrong? The person in charge of this tool says what holds them back is code review: code output has grown several times over, and people cannot keep up reading it. Their fix is to have AI review first and people look only at what the AI is unsure about, and that in turn forced them to change something else: the way engineers write requirements.

After the first opening, readers only know "there is an episode like this"; after the second, they already have the conclusion and know what is worth reading on for.

Two boundaries: no teasing - after raising a question or telling a story, give the answer within two or three sentences; no exaggeration - write exactly as much as the speaker said. Do not open with "In this video..." or "This episode features...". Check after writing: with the names of people and products swapped out, could this paragraph go on another episode unchanged? If so, it uses nothing unique to this episode; rewrite it.

### Introducing the people

Who each speaker is, why they are worth listening to and what kind of conversation this is must be made clear, but where and how is not fixed: a phrase in the opening, a short paragraph right after the opening, or a word when they first appear. Do not write a resume. When a judgment comes from their own experience, note the source in passing ("in the first two weeks after they launched internally", "on the team he leads"); this shows the weight of the statement better than a job title. Keep only the one detail relevant to the claim at hand; do not reintroduce them in every paragraph.

### Developing the highlights

The body develops the highlights one by one, one section per highlight. Order them by value, most important first, regardless of the order in the original video. Merge what the video says about the same topic at different points in time.

Each section explains its highlight fully: what the speaker concludes, on what grounds (argument, personal experience, cases, numbers), and what readers can take away at the level of practice. Length follows value: the most important section may run four or five paragraphs, a minor one two is enough; sections need not be the same length.

Give each section a **bold one-sentence** heading that states the section's conclusion or point directly, so readers who only skim the headings still get something - for example "The bottleneck moved from writing code to reviewing it", not a label like "About code review" that names only the topic. When the content is very short, the heading may be left out.

Within a section, use natural paragraphs, not lists: a list cannot hold "because ..., so ...". Content that is itself a list (steps, checklists, comparisons) is the exception.

The body is reporting, with no evaluation mixed in. Readers must be able to tell which sentences the speaker said and which the author said. Doubts raised, numbers given and analogies made by the host are stated as the host's, not blended into the guest's views. Report important views in indirect speech with neutral verbs like "he says", "he thinks", "in his view", not words that add an attitude on someone's behalf; quote directly only short phrases that lose their flavor when reworded, matching the transcript, with filler words removed.

### Making it readable for non-specialists

Specialist videos are dense with terms; carried over as they are, readers stop at every sentence, while bracketing an explanation for each one fragments the piece. For every term and proper noun, first ask whether it is necessary for the reader to understand the point, then choose one of three treatments:

- **Not necessary: leave it out.** Specific tools, frameworks, commands and technical details the speaker mentions in passing mostly belong here. What readers should take away is "she built the assistant a checking tool that can open the program itself and click through it like a user"; which library sits underneath only trips them up if written out.
- **Say what it means in plain words, without the term itself.** For example, instead of "constrained the codebase with static analysis rules", write "set up many automatic checks for the codebase, so code that breaks the rules cannot be committed".
- **Keep it only if necessary, and explain it on first appearance.** Core concepts that cannot be avoided, words readers will keep running into, and words the whole piece revolves around belong here. Explain with one sentence readers can picture, saying what it is and why it matters here; do not explain it with another term.

If a paragraph needs more than two or three new words explained, it sticks too close to the original wording: step back, first make clear what the thing is and why it matters, then decide which details are worth keeping. The speaker's own analogies are usually the best explanatory tool, since that is the speaker explaining to laypeople; when you meet a good one, use it in the body to help readers grasp the corresponding point, not as a tidbit at the end.

The same goes for companies, products, people and events: ones readers do not know and whose names do not matter become generic descriptions; important ones get one sentence on first appearance saying what they are. Fill in background only as far as readers need to understand the point: one sentence for a company name is enough; if a story takes several paragraphs to make clear and it really is part of a highlight, write several paragraphs. Do not expand into a primer.

### Minor content and the ending

Content in the video unrelated to the highlights but possibly of interest to readers is passed over in three or four sentences at the end of the body, with no heading and no evaluation of the video itself ("the rest of it rambles a bit"). If you want to write more than three or four sentences, sift again; if there is nothing, write nothing.

In the default (plain) style, the body stops at the last topic or at the sentences passing over minor content, with no added "in short" or "to sum up" summary, outlook or call to action.

When the user gave their own thoughts this time (impressions after listening, experiences, points they want to stress or rebut), they are the most valuable input: the opening preferably cuts in around them, and after the body write an "author's note" in the author's voice, keeping the concrete details and tone of the user's own words, only polishing and completing them, not replacing them with safer phrasing. This passage is kept apart from the reporting, so readers see at once that the author is speaking. The author's experiences, numbers and positions can only be ones the user gave, never drafted by you; where a personal experience is really needed to make a point stand and you have none, leave an obvious placeholder (such as "[TODO: when did you first run into this problem yourself]") and tell the user on delivery which places await them. When the user chose a style with commentary (see baseline section 5), the commentary is likewise written as the author's words, kept apart from the reporting and grounded in the transcript.

## 7. Key points

- One sentence each, understandable on its own: subject, object and conclusion are all in the sentence; do not write "he then went on to discuss this issue".
- Pick conclusions, methods, numbers and new things; skip opening pleasantries, transitions and what everyone knows.
- Each notes the time it rests on, pointing to where the topic starts, taken from the transcript's timestamps, not estimated.
- Order them as they appear in the video; merge two that say the same thing.
- Key points agree with the body and contain no facts the body lacks; no commentary - they are a guide, and accurate reporting is enough.

## 8. Different videos, different emphasis

| Video | Emphasis |
| --- | --- |
| Interviews, podcasts, panels | The guests' views and their grounds; keep the host's questions only when they help understanding |
| Talks, lectures | The main line of argument: problem, claim, evidence, conclusion |
| Tutorials, demos | What was achieved, prerequisites, steps, common mistakes; write steps as an ordered list; take frames when on-screen actions are unclear |
| Reviews, comparisons | What is compared, under what conditions, conclusions and reservations |
| Narrative, documentary, vlog | What happened, where the turns are; do not spoil suspense the user wants to keep |
| Meetings, discussions | What was decided, who owns it, what is still open |

## 9. Length and style

Length is decided by the weight of the highlights, not the length of the video: write until it is clear, keep the same content as short as it can be, and every extra paragraph readers read should give them something. Making a point clear to non-specialist readers takes a few more words; that length comes out of the specialist detail you cut. What the levels mean is in baseline section 4; for summaries specifically:

| Length | Body | Key points |
| --- | --- | --- |
| Short | A few paragraphs: the single most important highlight and its grounds; the rest left out or passed over in one sentence at the end. No headings | Only the few most important |
| Medium (default) | As in section 6: an opening, one section per highlight written so it can be restated, minor content passed over in a few sentences | Every highlight is covered; one for every place worth revisiting |
| Long | Every highlight in full: every step of the argument, examples, numbers, quotes worth citing, causes and consequences all kept, and the relations between highlights made clear; minor content also gets a short section each. No need to watch the video after reading | One for every place worth revisiting |

When the transcript is long and the long version is wanted, write the second half as fully as the first; do not let the later parts thin out because the transcript is long.

Style shows in the author's own narration and commentary; what the video said does not change with style (baseline section 5). Key points carry no commentary, whatever the style.

## 10. What to avoid

- Do not summarize in the original video's order and chapters, do not aim to cover every topic, do not give every topic about the same length.
- Do not open with the guest introduction, do not write the introduction of people as a resume, do not begin every paragraph with a name.
- Do not carry over every tool name, framework name and technical detail the speaker mentions.
- Do not use bullet points in the body or number the sections.
- Do not use empty phrases like "renowned expert", "industry heavyweight", "years of deep experience", "unique insights"; use concrete things they have done instead.
- Do not add phrases like "in short", "to sum up", "this episode is packed with content".
- Do not invent anything the transcript lacks; above all, do not fill in speakers' positions, education, experience or achievements by guessing.
- Do not mix evaluation into reporting; connectives like "even better" or "ironically" are evaluation too.
- Do not use figurative verbs to sound vivid ("grew out of", "scraped together", "chewed through"); use the plainest wording ("worked out", "iterated on", "finished").
- Do not clickbait, tease or exaggerate what the speaker said to draw readers in.
- Do not let the "author's note" contain experiences, numbers or positions the user did not give.

## 11. Delivery

- Write a Markdown file in the working directory (such as `<video name>.summary.md`; for several languages, add a language tag before the extension, such as `<video name>.summary.en.md`). Save versions of different length or style separately, named by version; before a major rewrite, save the previous version under another name, and make small fixes in place. When the session does not belong to a project, the user cannot see the working directory: also put the file in the downloads directory with downloads_save and tell the user the path it returns. When the user only wants to read it in the conversation, reply with the body and key points directly.
- Apart from bold headings, use little other Markdown formatting in the body; the key points form a group of their own.
- Tell the user: the file's real path; which language the output uses and by which rule it was chosen; what background was added beyond the transcript (including what was seen in the picture); which information was not verified; preferences not followed or content cut; list separately any placeholders awaiting their input.

## 12. Self-check

- Reading only the opening, can readers name the two or three things most worth taking away from this episode and know what it has to do with them? Is the opening under three hundred words, with no terms needing explanation? Does it cut in with who the guest is or what the show talked about?
- With names of people and products swapped out, could the opening go on another episode unchanged? If so, rewrite it.
- Are the chosen highlights what the target reader most wants to know, or what insiders most want to know? Is the most important highlight the most fully written part of the piece? When the user named a focus, is it the opening's way in and the longest section?
- Are the sections ordered by value, or have they slipped back into the original video's order? Ask of each section: if I delete it, what does the reader lose? If you cannot say, delete it or fold it into the paragraph that passes over minor content.
- Skimming only the bold headings, can you see each section's conclusion?
- Every fact, number and name can be traced to the transcript, the video info or material the user gave; nowhere is a speaker's identity guessed; nothing the speakers said is stated more strongly than they said it.
- No evaluation is mixed into the reporting; with an "author's note" or a commentary style, readers can tell which sentences the speaker said and which the author said.
- Read it from the top as a reader outside the field: is there any sentence where you have to stop and look something up? Any paragraph after which you cannot say what it was about? Is every remaining term, company, name and event necessary, and explained on first appearance? Can every story be restated as "because ... so ..." after reading?
- Can readers tell that what was seen in the picture is added background?
- Every key point is understandable on its own, and the time it notes really is where this is said.
- The output language follows the order in section 2; length and style are the level and style asked for this time; there are no padded paragraphs, and no key facts were dropped to make it shorter.
