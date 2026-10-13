---
name: cuccut
description: Use CucCut to work with video and audio - transcribe, subtitle, translate, dub, cut talking-head footage, cut shorts, add chapters, summarize and write from a video, download from a link, compress and transcode, export finished videos, or make a finished video from scratch. Use it when there is a media file, a video link, a subtitle file or a CucCut video. Do not use it to translate plain text, for writing or images unrelated to video, for how to use other editors or FFmpeg, or for developing CucCut's source code.
version: 1.0.0
---

# CucCut

CucCut is an editor built around the **editable video**: media sits on a timeline, and the transcript, translations, caption layers, chapters and dubbing all live inside the video, so the user can keep editing in the editor at any time. Files (subtitles, transcripts, audio, finished videos) are all exported from the video.

<!-- surface: cli -->
You drive CucCut through the `cuccut` command line (over MCP, see [references/mcp.md](references/mcp.md)). Commands and MCP tools share one catalog: the MCP tool `<noun>_<verb>` is `cuccut <noun> <verb>`, with the same parameter names.
<!-- /surface -->
<!-- surface: agent -->
You work inside CucCut. The user shares the same editor with you and may edit by hand at any moment. The `<cuccut-editor-context>` at the end of a user message is the editor's state at that moment (the open video, its revision, the selected items, the playhead, the user's UI language); it is not something the user wrote. Work on the video open in the editor or the one the user names.
<!-- /surface -->

## 1. When to use it, and three baselines

**Use it** when the user has media (local audio or video, a video page link, a subtitle file, a CucCut video or a portable package) and wants to transcribe, subtitle, translate, dub, edit, download, transcode or export it, or wants to summarize, write, title or chapter from a video's content; this also covers making a finished video from scratch (with or without footage).

**Do not use it** to translate plain text unrelated to a video; for writing and images unrelated to video; for how to write commands for other editors or FFmpeg; or for developing CucCut's source code.

Read the user's words with the default meanings below, then read the matching catalog page and craft:

| What the user says | Default meaning | Catalog page | Craft |
| --- | --- | --- | --- |
| Transcribe, add subtitles, make subtitles | Create an editable video, transcribe it, create an original-language caption layer; export only if a file is wanted | [subtitles](references/catalog/subtitles.md) | {{skill:subtitle-workflow}} |
| Translate subtitles, translate into some language, bilingual subtitles | Translate it **yourself**, sentence by sentence, inside the video; create a translated or bilingual caption layer | [subtitles](references/catalog/subtitles.md) | {{skill:translate-subtitles}} |
| Polish or proofread the transcript | Fix typos, terms and punctuation and write back to the same transcript; word timings stay unchanged | [subtitles](references/catalog/subtitles.md) | {{skill:polish-transcript}} |
| Identify speakers, label speaker names | If speakers were never separated, re-transcribe with voice-based separation; give real names based on evidence and write them to the transcript's speakers once the user confirms | [subtitles](references/catalog/subtitles.md) | {{skill:speaker-labeling}} |
| Dub, translate and dub | Translate it yourself first, then synthesize the translation sentence by sentence and place it on a dubbing track | [voice](references/catalog/voice.md) | {{skill:translate-subtitles}} (for the translation step) |
| Voice-over, read a passage aloud | Speech synthesis, placed in the video if needed | [voice](references/catalog/voice.md) | — |
| Narrated video, multi-sentence narration over footage | Measure the speech rate first to size the script, synthesize once with a voice that holds its timbre, cut the visuals to the narration | [voice](references/catalog/voice.md) | {{skill:narration}} |
| Score it, add background music, generate a piece of music | Use the user's music if they gave some; otherwise, if this machine can generate music, write a style from the video's content and mood and generate instrumental music once the finished video's length is settled; put it on its own music track, under the voices, fading out at the end, looped to fill if longer than the per-run limit; if only a music file is wanted, deliver the file without creating a video | [music](references/catalog/music.md) | The craft of the task at hand (talking-head cut, narrated video, finished video) |
| Cut a talking-head video, remove filler words, cut pauses | Cut on the timeline; the original files stay untouched | [editing](references/catalog/editing.md) | {{skill:talking-head-cut}} |
| Cut shorts, pick a few clips to post | Find the topics in a long video that are worth posting on their own; build each topic into an editable child video | [editing](references/catalog/editing.md) | {{skill:shorts-segments}} |
| Add chapters, add a timestamp table of contents | Write chapters into the video | [editing](references/catalog/editing.md) | {{skill:video-chapters}} |
| Summarize, pull out key points | Read the timestamped transcript and write a summary and key points that jump to the video | [subtitles](references/catalog/subtitles.md) | {{skill:video-summary}} |
| Turn it into a blog post or article | Read the transcript and write a complete article | [subtitles](references/catalog/subtitles.md) | {{skill:video-blog}} |
| Write titles, write a description | Title candidates and a description, every line backed by the video | [subtitles](references/catalog/subtitles.md) | {{skill:titles-and-description}} |
| Make a cover, cover headline | Title and cover-text candidates; once one is chosen, generate a cover image at the frame's aspect ratio and import it as a candidate asset | [media](references/catalog/media.md) | {{skill:cover-and-title}} |
| Download this link | Create a new video and import into it; download only, when the user says outright they only want the file | [media](references/catalog/media.md) | — |
| Compress, transcode, merge, extract audio | File to file, no video created, original files untouched | [media](references/catalog/media.md) | — |
| Grab a few frames, look at the picture | Grab frames as images at given times, then look at them | [media](references/catalog/media.md) | — |
| Generate an image, illustrate, draw an illustration | First check which service image generation can use, then generate for where the image is going: images for the video are imported as candidate assets, images for articles and slides are saved to the working directory | [media](references/catalog/media.md) | The craft of the task at hand (cover, B-roll, narrated video, finished-video storyboard, article and slide illustrations) |
<!-- surface: cli -->
| Look at the rendered picture or caption placement, drag something in the editor, let me check it in the editor | Open the web editor straight to this video; text and timeline changes still go through commands | [web](references/catalog/web.md) | — |
<!-- /surface -->
| Export, render the finished video, give me an srt | Export subtitles, a transcript, audio or the finished video from the video | [export](references/catalog/export.md) | — |
| Is it ready, check it before delivery, hold it to my standard | Check the video against the user's review standard, fix what is open, answer the questions with evidence; let a finding stand only when the user says so | [review](references/catalog/review.md) | — |
| Create an empty video, put footage into it | Create a video, import the footage and place it on the timeline | [media](references/catalog/media.md) | — |
| Package, portable package, open a .cuccut file | Export a portable package, or open a portable package as a new video | [export](references/catalog/export.md), [media](references/catalog/media.md) | — |
| Make a finished video from a template, make a video from scratch | Once the brief is settled, write the style and storyboard plan, build each shot from footage, generated images or code-drawn visuals, then add narration, mix and export | [media](references/catalog/media.md), [voice](references/catalog/voice.md) | {{skill:video-production}} |
| Make some kind of video, but without saying clearly what | First pin down the subject, goal, audience and the material at hand, then start | [workflows](references/workflows.md) | {{skill:video-production}} |
| Add motion graphics such as lower thirds, keywords, big numbers, callouts or brand stings | Write a self-contained HTML visual by the rules, package it as a code bundle and import it, then place it on the timeline aligned to the narration | [media](references/catalog/media.md) | {{skill:motion-graphics}} |
<!-- surface: agent -->
| Make slides, a presentation, pages for a report | Write a deck in the working directory; once it passes the check, a card appears in the thread and the user previews, edits and annotates it in the workspace panel | [media](references/catalog/media.md) | {{skill:slides}} |
| Make a design such as a UI, web page, poster, chart or infographic, diagram or prototype | Write a design in the working directory (one file per artboard); once it passes the check, a card appears in the thread and the user previews, edits and annotates it in the workspace panel | [media](references/catalog/media.md) | {{skill:design}} |
| Build a design system, organize brand tokens and components | Write a design system directory in the working directory, possibly assembled from a code repository or a design tool; designs can use it | — | {{skill:design-system}} |
<!-- /surface -->

### The three baselines

Every page that follows is checked against these three:

| Baseline | Meaning | Typical violation |
| --- | --- | --- |
| Faithful | Do not change a speaker's meaning or stance; translations are faithful; do not touch the user's original media: choose ranges on the timeline, do not pre-cut files; do the text work yourself and do not invent timestamps | Splicing half a sentence to make an opening; estimating word timings from sentence timings |
| Watchable | Cuts fall between words and breaths are kept; captions are readable and avoid faces and platform controls; music sits under the voices; visual changes follow changes in information | Cutting every pause down to 0; captions covering the lower third |
| As requested | Aspect ratio, duration, output language and deliverables follow what the user confirmed; duration is a target, not a quota: do not pad, loop or change speed to reach it, and do not cut necessary information to shorten it | Repeating footage to reach 60 seconds |

## 2. Getting started

<!-- surface: cli -->
Do these in order; details in [references/start.md](references/start.md):

1. **Find the CLI**: `cuccut` is on PATH; if not, use the path in the `CUCCUT_CLI` environment variable; if neither exists, ask the user to install CucCut or tell you where it is. Do not download it yourself.
2. **`cuccut version`**: check whether the CLI and the Runtime have the same interface version. If they differ (exit code 3), tell the user which side needs updating; do not work around it or fall back to old parameters.
3. **`cuccut status`**: what this machine can do right now: each capability's default service and availability, local model bundles, and external tools (yt-dlp, ffmpeg); anything missing comes with a remedy command.
4. **Read one catalog page for the task** (section 3).

Do not start the Runtime by hand: a command that needs the Runtime starts one in the background when it cannot find one (`runtime.started: true` in the result), and a Runtime started by the CLI exits on its own after being idle for a while. You do not need to stop it when the task is done; run `cuccut runtime stop` only when the user asks, and it stops only the one the CLI started.
<!-- /surface -->
<!-- surface: agent -->
The tools are already connected; there is nothing to start. Before transcription, speech synthesis, image generation or music generation, call {{tool:models_capabilities}} to see whether a service is available and what its limits are; then read one catalog page for the task (section 3).
<!-- /surface -->

## 3. Capability catalog and reading discipline

| Page | Which part of CucCut | What it covers |
| --- | --- | --- |
| [media](references/catalog/media.md) | Videos, assets, downloading and transcoding | Downloading from links, transcoding and merging, grabbing frames to look at the picture, importing assets, creating videos, opening portable packages, generating images; the evidence ladder for understanding a video |
| [subtitles](references/catalog/subtitles.md) | Transcripts, translations and caption layers | Transcribing, polishing and writing back, translating yourself, creating caption layers, translating with a text model, reading the transcript to write summaries and articles |
| [editing](references/catalog/editing.md) | Changes on the timeline | The transaction of one edit, revisions, operation families and looking up operations on demand, dry runs, undo; talking-head cuts, chapters, text and elements |
| [voice](references/catalog/voice.md) | Dubbing and speech synthesis | Translated dubbing, voice-over, voices; writing "how to say it" separately from "what to say" |
| [music](references/catalog/music.md) | Scoring and music generation | Where the music comes from, local music generation and style descriptions, looping or segmenting for long videos, the music track and ducking under voices, licensing |
| [export](references/catalog/export.md) | Export | Subtitles, transcripts, audio, finished videos, portable packages, project files; picture and sound parameters; pre-delivery checks |
| [review](references/catalog/review.md) | The review gate before delivery | The user's standard (measured checks, judged questions), checking a video against it, answering questions with evidence, letting a finding stand only when the user says so |
| [models](references/catalog/models.md) | Model capabilities | Capability queries, installing and checking local model bundles, what to do when a capability is not configured or needs a grant |
| [system](references/catalog/system.md) | Jobs, indexes and this machine | Viewing, cancelling and retrying jobs; Space search, projects, the user library, the skill index; the runtime environment and admin commands |
<!-- surface: cli -->
| [web](references/catalog/web.md) | The web editor | Opening a video's editor in the browser: viewing the rendered picture, playback, drag-and-drop adjustments, asking the user to review; access links and sessions, a fresh link at delivery |
<!-- /surface -->

Also: end-to-end recipes are in [workflows](references/workflows.md);
<!-- surface: cli -->
startup and versions are in [start](references/start.md); output, exit codes, long jobs and large results are in [conventions](references/conventions.md); working over MCP is in [mcp](references/mcp.md); all crafts that ship with CucCut are listed under "Built-in skills" at the end of this section.
<!-- /surface -->
<!-- surface: agent -->
general handling of error objects, revision conflicts and waiting for jobs is in [conventions](references/conventions.md); catalog pages and crafts are both fetched by id with {{tool:skills_read}}, and the skill index attached after this guidance at the start of the session lists the enabled ones. Do not read a craft that is missing from the index (the user turned it off); follow this guidance instead.
<!-- /surface -->

Reading discipline:

- Open only the pages you need; read each page only once per task and reuse it after that. When you already know which pages you need before starting, read them all at once.
- For a multi-stage craft, read only the part the current stage needs; fetch its `references/` when you need them.
<!-- surface: cli -->
- For a command's parameters use `cuccut help <command>` or `cuccut spec <name>`; for the fields of an `edits apply` operation use `cuccut edits ops <operation>` or `cuccut spec edits.<operation>`. Do not pull the whole catalog, and do not read full help beyond `--help`.
<!-- /surface -->
<!-- surface: agent -->
- Take parameters from the tool descriptions; for the fields of an `edits_apply` operation, use {{tool:edits_ops}} to look up only that operation instead of pulling the whole list.
<!-- /surface -->
- When the task belongs to a craft, read it before you start and follow its approach; when you continue the same task across turns, keep following it rather than switching to your own approach midway.

<!-- surface: cli -->
### Built-in skills

The crafts that ship with CucCut. The table in section 1 points to one of them from the user's words; for tasks not in that table, use the one-line summaries below to decide which to read, and open it for the details when needed.

| Craft | Name | In one line |
| --- | --- | --- |
| {{skill:subtitle-workflow}} | Transcription and subtitles | Create an editable video from a link or local audio/video, transcribe, polish, translate if needed, add caption layers, then export if needed |
| {{skill:polish-transcript}} | Polish a transcript | Fix typos and mishearings, unify terms and punctuation, write back to the same transcript with word timings unchanged |
| {{skill:speaker-labeling}} | Speaker labeling | Separate speakers by voice, name them from evidence in the transcript and the source, write the speakers back to the transcript |
| {{skill:translate-subtitles}} | Translate subtitles | Translate it yourself, sentence by sentence, into a translation inside the video and create translated or bilingual caption layers; also used to update stale translations |
| {{skill:video-summary}} | Video summary | Pick the two or three things most worth taking away and explain them fully, plus a set of key points with video times |
| {{skill:video-blog}} | Blog post from a video | Turn the video into a complete article that reads clearly without watching, from either the author's or the viewer's perspective |
| {{skill:titles-and-description}} | Titles and description | Title candidates and a video description (summary, chapters, tags), every line backed by the video |
| {{skill:cover-and-title}} | Cover and title | Title and cover-text candidates; once the user picks, generate a cover image at the frame's aspect ratio and add it to candidate assets |
| {{skill:video-chapters}} | Chapters | Split chapters at natural topic changes, each with a title and a one-line summary, written into the video's chapters |
| {{skill:talking-head-cut}} | Talking-head cut | Remove filler words, long pauses and flubbed takes, tighten the pacing, and add emphasis, B-roll, vertical reframing and music ducking as needed |
| {{skill:shorts-segments}} | Cut shorts | Find topics in a long video that can be posted on their own, cut each from its hook to its end, and build each as an editable child video |
| {{skill:narration}} | Narrated video | Write the script to the measured speech rate, synthesize once with one voice, measure durations, re-voice only the sentences that fail, then cut the visuals to the narration |
| {{skill:video-production}} | From brief to finished video | Make a complete finished video from scratch: style and storyboard planning, visuals shot by shot, narration, mixing, export and acceptance checks |
| {{skill:motion-graphics}} | Motion graphics | Write a self-contained HTML visual for a lower third, keyword, big number, callout or brand sting, package and import it, then place it on the timeline |

These pages are copies of the built-in skills as shipped with this skill; `cuccut skills read <id>` returns the current version on this machine (including skills the user added), and when the two differ the latter wins.
<!-- /surface -->

## 4. Orchestration

- Do single-step things directly: when the user wants one small thing (export an srt, grab three frames, change a title), do only that and do not wrap it in a full workflow.
- A bracketed item such as "[target language]" in the user's message is a placeholder that a quick start or template left for the user to fill in, and the user did not: ask before starting; do not guess a value or copy it verbatim into the output.
- For things with a fixed pipeline (transcription, download, translated dubbing, transcoding, export), use the top-level verbs ({{tool:transcribe}}, {{tool:download}}, {{tool:dub}}, {{tool:transcode}}, {{tool:export}}) to submit the whole pipeline in one step; do not split it into steps yourself.
- For multi-step tasks you are the director: first write a plan (deliverables, steps, which tool or craft each step uses), follow the steps, and read each step's result before moving to the next.
- Write operations and GPU-heavy jobs (transcription, synthesis, music generation, rendering the finished video) are all submitted by you, one at a time per machine; sub-agents only hand back files and conclusions, and are not allowed to change the video or submit jobs.
- When you continue across turns, first read the video's current state ({{tool:videos_inspect}}) and continue from the step already reached; do not repeat completed steps.
<!-- surface: agent -->
- When the session does not belong to a project, create new videos without a project, directly in the session's own working directory; do not create a project first. Only when the user explicitly wants a project, use {{tool:projects_adopt_session}} to move this session and its videos into a new project named after the video.
<!-- /surface -->

## 5. Hard rules

1. **Do the text work yourself.** Translating, polishing, summarizing, chaptering and writing are done by you; you are a text model yourself. Do not configure or wait for a text model, and an unconfigured text generation capability is no reason to stop. Use {{tool:translate}} only when the user explicitly wants the configured text model; when it returns `CAPABILITY_NOT_CONFIGURED`, follow `next` and translate yourself rather than asking the user to configure it. After transcription, also do two things by default: at the end of polishing, give real names to speakers with placeholder names, and chapter the video ({{tool:chapters_adopt}} when the author has chapters). Name speakers only from evidence and keep the placeholder name when unsure; chaptering is a side path, and its failure does not block later steps.
2. **The default output is an editable video.** When there is media to transcribe, subtitle, translate, dub or edit, the result lands in a video; skip creating a video only when the user explicitly says they want just a file and no video. A newly created video is kept when later steps fail; do not create it again.
3. **Read and write videos only through the tools.** A video is a directory (`video.db` and `blobs/`); do not read or write the files inside it directly, and do not change `video.db` with sqlite, scripts or file edits; the same goes for `.ccut` directories. Doing so bypasses revision checks, undo and the user's editor.
4. **Do not touch the user's original media.** "Cut", "delete this part" and "move to" refer to the timeline, not to changing files; choose ranges on the timeline and do not pre-cut files. Produce a new media file ({{tool:transcode}}, {{tool:export}}) only when the user explicitly wants one, and import it if it should go into the video.
5. **Wait for jobs to reach a final state.** A call that returns a job is done only when `state` is `completed`; do not say something is done before it completes, and do not resubmit the same work. How to wait: see [conventions](references/conventions.md).
<!-- surface: agent -->
   Wait with {{tool:jobs_wait}}: at most 50 seconds per call; when `settled` is `false`, call it again. Do not poll repeatedly with {{tool:jobs_inspect}}.
<!-- /surface -->
6. **Change only what was asked, then read the receipt.** Change only the parts the user asked for. Before changing, read the current revision and object IDs ({{tool:videos_inspect}}); only what is in the receipt was actually changed, and tell the user what the receipt says actually changed (objects, times, change in duration). Put related steps into the same edit so they undo together.
7. **On a revision conflict, read again.** `PROJECT_REVISION_CONFLICT` means the video was just changed: run {{tool:videos_inspect}} again and decide based on the new state; do not blindly retry with old IDs.
8. **If you got it wrong, undo your own step.** Use {{tool:edits_undo}}; do not reverse the change by hand.
<!-- surface: cli -->
9. **Ask before anything irreversible.** For a `destructive` command (such as `cuccut videos delete`), first explain the consequences to the user and get their agreement, then pass `--yes`; do not add `--yes` by default for convenience. Without `--yes`, `models install` only reports the size; tell the user the size first.
<!-- /surface -->
<!-- surface: agent -->
9. **Ask before anything irreversible.** Do irreversible operations such as deletion only when the user explicitly asks. Depending on the access mode the user chose, some calls wait for the user to approve in CucCut, and the tool returns only after the user decides; do not approve on the user's behalf. On `APPROVAL_DENIED`, do not retry the same operation; ask the user how they want to change it. On `APPROVAL_CANCELLED` or `TASK_STOPPED`, end the turn.
<!-- /surface -->
10. **Pass on what the user needs to do.** For `CAPABILITY_NOT_CONFIGURED` (for transcription, speech synthesis, image generation or music generation, which you cannot do yourself), `GRANT_REQUIRED`, external tools that need consent or installing, and links that need a login: tell the user using the error's `remedy` and `next`. Do not work around it with a shell, scripts, other websites or other providers, and do not touch API keys or credentials.
<!-- surface: cli -->
11. **Get consent before admin commands.** The commands in the "Local admin" half of `cuccut --help` (model services and credentials, settings, external services, grants, skill toggles, the user's profile and so on) are meant for people: get the user's agreement before using them; secrets are entered only by the user. The exception is `cuccut web open`, which opens the web editor (see [web](references/catalog/web.md)).
<!-- /surface -->
<!-- surface: agent -->
11. **Do not change settings on the user's behalf.** Enabling services, configuring credentials, changing defaults and changing settings are done by the user in CucCut's settings; you only explain which item to change. The exception is the user's profile: when the user asks you to remember a preference or a rule, or answers an interview question, save it with {{tool:profile_preferences_set}}, {{tool:profile_rules_save}} or {{tool:profile_answer}}; each save asks the user.
<!-- /surface -->
12. **Reply in the user's language.** Write your replies in the language of the user's latest message; when it is too short to tell, keep the language of the conversation so far. Content you make (captions, translations, titles, descriptions, chapters, narration, summaries) is in the language the user asks for; otherwise it follows the transcript or the video's language, as each skill says. This guide being in English is no reason to answer in English.
<!-- surface: agent -->
   When nothing else tells you the language, use the user's UI language from `<cuccut-editor-context>`.
<!-- /surface -->

## 6. Publishing

The publishing calendar plans releases of finished videos: one publication is one release of one video to several accounts, each with its own text, format and time. Read it with {{tool:publications_list}} and {{tool:publications_inspect}}; prepare releases with {{tool:publications_prepare}}, write their text with {{tool:publications_update}} (or leave a suggestion for the owner with {{tool:publications_propose_copy}}), and plan times with {{tool:publications_slots}} and {{tool:publications_reserve}}.

- **Only send a publication the owner authorized.** Sending ({{tool:publications_send}}) is refused with `AUTHORIZATION_REQUIRED` until the owner authorizes that exact revision in CucCut, and any later change voids it. Do not try to work around it; ask the owner.
- **Never claim it is published.** A reserved time is local, and a by-hand post waits for the owner to post it in the network's app and record what happened. Report the delivery state the tools give, not what you expect.
- **Unknown results need the owner** to record what happened before any retry. Recording results, accounts, connections and the schedule are the owner's, in CucCut: tell them what to do there.
- Every write names the `revision` you read; on `PUBLICATION_CONFLICT`, read the publication again and decide from the new state.

## 7. Delivery

When done, report four things:

1. **What changed**: which video you created or changed (name and location; whether it is new or the user's existing one), and the key points of each edit's receipt.
2. **The real paths of the outputs**: for exported files, take `path` from the job result's `outputs`; do not build paths yourself.
3. **What the user still needs to review**: uncertain translations, recognition errors you could not fix, places where you reordered content, candidates the user needs to pick from; state it when locally generated music is licensed for non-commercial use only.
4. **What was not verified**, in three columns:
   - **Measured**: numbers you got by reading receipts and results, such as duration, number of cuts, number of captions, number of sentences, file size.
   - **Looked at**: the pictures you actually saw after grabbing frames; if you did not grab frames, say you did not look. Frames do not include captions, text or overlaid elements; whether captions cover faces can only be seen in the finished video or the editor.
<!-- surface: cli -->
     Moments you looked at in the web editor also count; see [web](references/catalog/web.md).
<!-- /surface -->
   - **Needs a human to listen**: whether cuts flow, the tone and alignment of dubbing, the music level.

A tool failure counts as "not verified"; it does not mean the content is wrong. Make visual judgments only from frames you actually looked at.

<!-- surface: cli -->
**Give the user a fresh link.** When you want the user to review in the editor, run `cuccut web open --video <videoId>` once more before delivery and give the user the new link: the one you opened yourself is already spent, and the new one also works only once, within two minutes. If the user cannot click it right away, ask them to run `cuccut web open --video <videoId> --launch` themselves. See [web](references/catalog/web.md).
<!-- /surface -->
