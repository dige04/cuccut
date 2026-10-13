# CucCut Product Design

> Built around AI agents as the subject of the task and editable video as the center of collaboration. The user states the result they want; the agent makes and delivers a video that can keep being revised.

This document defines CucCut's product scope, interface, and user-visible behavior. For how the system is implemented, see the [System Architecture Design](../architecture/architecture-design.md); for persistent formats and numeric rules, see [`spec/`](../spec/video-format-spec.md); for acceptance criteria, see [Acceptance and Testing](../acceptance/acceptance-spec.md). For terminology and scope markers (P0 / P1 / P2 / G), see [Document Conventions](../README.md#conventions-for-this-document); for terms, see the [Glossary](../glossary.md).

## Contents

- [1. Product Positioning](#1-product-positioning)
- [2. Interface Overview](#2-interface-overview)
- [3. Home](#3-home)
- [4. Space](#4-space)
- [5. Editor](#5-editor)
- [6. Tasks and Conversation](#6-tasks-and-conversation)
- [7. Autonomous Execution, Permissions, and Privacy](#7-autonomous-execution-permissions-and-privacy)
- [8. Quality and Delivery](#8-quality-and-delivery)
- [9. End-to-End Workflows](#9-end-to-end-workflows)
- [10. Requirements Checklist](#10-requirements-checklist)
- [11. Release Roadmap and Success Metrics](#11-release-roadmap-and-success-metrics)
- [12. Items Pending Review](#12-items-pending-review)

---

## 1. Product Positioning

### 1.1 What CucCut Is

CucCut is an AI agent that can create, edit, and keep revising video, and it is also a video editor that can be used on its own. Video is not an attached cache of a chat, and delivery does not end with generating one MP4.

Five constraints are not to be relaxed:

- **Task first:** the user delegates a result, not a series of tool calls.
- **Video first:** all changes land in the authoritative, editable video.
- **Local changes first:** changing one place changes only that place; the whole film is not redone.
- **Bounded autonomous execution:** the agent acts within a clear scope, permissions, and budget.
- **Editable delivery:** the deliverable includes a video that can be reopened and revised further, not only the finished cut.

### 1.2 Two Equally Important Loops

**Loop A: existing material → understanding → subtitle / narration / diagram edits → three consecutive local revisions → finished cut and a reopenable video.**

**Loop B: text or a supplied voiceover → actual sound → scenes and visuals → three consecutive revisions to parameters / source code / timing → finished cut and an editable video.**

P0 may limit duration, templates, devices, and the controlled code contract. Implementing only Loop A does not count as completing the creative agent, and producing one template-based short that cannot be changed in a second round does not count either.

### 1.3 Users and Value Assumptions

The initial users are assumed to be: creators of knowledge, courses, and talking-head content; product and technical content producers; bilingual content producers; and creators who need to maintain code-driven animation. What they share is that they have content and material, need to revise repeatedly, and do not want to organize a lot of low-level operations themselves. This priority is an assumption and has not yet been confirmed by market research (see §12).

Value validation focuses on four things: accurate expression, local maintainability, reduced repetitive work, and reliable delivery. What is observed is the mis-edits, correction cost, and final usability across three rounds of revision; response speed, call volume, and lines of generated code cannot substitute for them.

### 1.4 Usage Surfaces

| Surface | Purpose |
| --- | --- |
| Desktop app | The main interface. Home is for collaborating with the agent; Space is for viewing and secondarily editing all results |
| CLI | A thin client for scripting and automation |
| External agents | Other agents call the same capabilities of CucCut through the tool protocol |
| Web | A client in the local browser, available once the user turns on the web service; its capabilities are a subset of the desktop interface. Use `cuccut web open` to get a one-time access link to sign in. Querying, sessions, editing, transcription and generation, and export are available. Settings, configuration of model services, management of external services and nodes are only in the desktop app; in the browser you can only view model service status and usage. Controls that cannot be changed on the settings page are greyed out, with a note that they must be changed in the desktop app. Data outbound-sharing authorization and the glossary are not visible in the browser, and this is stated explicitly rather than showing a perpetual loading state. The browser cannot access local file paths: in the first release you cannot pick a directory, import, or drag in local files in the browser; you can only open a registered project or create a new one. Changes made in the browser count as made by the user themselves and can be undone in the desktop app |

These surfaces connect to the same Runtime and operate on the same video; no surface owns a separate set of business logic.

### 1.5 Humans and Agents Share the Editor

```text
Manual interaction → video command entry point → video engine → transaction receipt
Natural language → agent → tools → the same video command entry point
Model output → application action → the same video command entry point
```

Manual dragging, text editing, and volume adjustment do not have to go through a model; the agent also does not need to simulate a mouse to perform native edits. The interface is a workbench for preview, review, approval, and refinement, not a terminal log. Users can take over the current video at any time.

### 1.6 Non-Goals

The first release does not provide:

- native layer recovery for arbitrary MP4 files;
- visual editing of arbitrary objects inside a Canvas;
- native redrawing of arbitrary HTML / CSS;
- automatic merging of arbitrary concurrent edits;
- fully GPU zero-copy;
- pixel-identical output on all devices;
- lossless fitting of translations of arbitrary length into the original time window;
- full real-time team collaboration;
- automatic publishing by default.

New requirements must not use these long-term capabilities to crowd out the two loops.

---

## 2. Interface Overview

### 2.1 Structure

The leftmost part of the window is an icon bar (Rail). The primary entries at the top are, in order, **Home, Space, Tools**. The secondary entries below the divider are, in order, **Services and Background Tasks**; Settings is fixed at the bottom, separated from the work entries by empty space. The Rail is app-level navigation; the page sidebar that appears after entering an area only organizes the content inside that area.

#### Entry Placement and Hierarchy Principles

Distinguish by user purpose: doing work, managing runtime, and configuring the app; then decide the hierarchy by product value. A sidebar entry represents a stable work area that users return to repeatedly; a single button or action does not get its own slot.

| Position | Criterion | CucCut examples |
| --- | --- | --- |
| Rail primary | Directly advances core work and has an independent, complete workflow; does not require going through the agent | Home: delegation and review; Space: browsing and organizing results; Tools: directly calling a model or fixed flow to complete a task |
| Rail secondary | Supports core work across sessions or projects; responsible for connecting, controlling, monitoring, and troubleshooting | Services, Background Tasks |
| Rail bottom | Unrelated to the current work; a global app entry that must be easy to find at any time | Settings; help is currently inside Settings; accounts and similar items are added as actually needed |
| Inside Settings | Mainly changes how the app works going forward, including preferences, defaults, and model and capability configuration | Model installation, keys, default model, Agent configuration, shortcuts, privacy |
| Inside a page | Depends on the context of the current video, task, or session | Export, subtitle style, task cancellation, session access mode |

Primary and secondary levels are distinguished by core value and supporting role, not only by frequency of use. Tools are first-class capabilities even when they do not go through an Agent; Background Tasks are a supporting entry even though they are viewed often, so they keep the running count and abnormal-state alerts. Services come before Background Tasks: first manage the available capabilities, then view execution. The secondary level expresses functional hierarchy, the bottom expresses the position of global entries, and low-frequency functions do not all have to go to the bottom.

Work that uses a model to complete transcription, generation, translation, and similar tasks goes under Tools or the corresponding editing page; installation, connection, and selection of the default model go under Settings (§7.6), with no separate model entry in the Rail. The checks (local models) and tests (online services) in Settings verify whether the configuration is usable. The Services page is responsible for service running and connection status; configuration such as keys and defaults goes into Settings. The “Models” group in Settings is organized by API provider and capability: “API Providers” manages connections and accounts, “Usage” shows calls and spending, and each capability has its own page, with local and cloud models on the same page (§7.6). “API Providers” and the Rail’s “Services” are different things: Services are the entry points through which CucCut is exposed to the outside, while API Providers are the online model services that CucCut calls (formerly called “service providers”).

When adding a new feature, ask in order: Does it depend on the current object? Is it mainly changing configuration? Does it directly complete core work? Does it support or monitor work? Accordingly it goes inside a page, into Settings, into a primary entry, or into a secondary entry. Single actions of the same kind should preferentially go into an existing area.

#### Icon Sizes and Semantics

The desktop and the browser prototype use the same set of Spectrum 2 workflow icons. Sizes refer to the **SVG canvas**: the primary tier is 20 × 20 CSS px (graphic about 18px), and the compact tier is 16 × 16 CSS px (graphic about 14px). 18px is the reference footprint of the graphic and no separate 18px canvas is defined; icons of the same kind do not become 21px because the control font size or line height changes. The app Rail and the page sidebar use the 20 / 16 hierarchy.

| Scenario | Canvas | Examples |
| --- | --- | --- |
| App Rail | 20px | Home, Space, Tools, Services, Background Tasks, Settings |
| Title bar shell icons | 16px (S2 20-grid drawing), buttons are 32px squares | Sidebar toggle, tab button, full view, session summary, hide tabs / enter split view; “pin sidebar” in the sidebar overlay; the trailing button on each row of the open-tabs list (24px square button) |
| Workflow icons in body text and page sidebars | 16px | New session, project folder, Space categories, settings categories; Home input toolbar and quick start, Space new and search, grid/list toggle, menu items, model tabs, viewer actions; type icons for list files, favorites, row-end menus, session status, workspace tags; buttons in the title bar other than the shell icons, such as the session menu ··· |
| Icon blocks | 20px | The identifying graphic within the 32–48px base block of tool cards, service cards, and session output |
| UI graphics inside components | Component’s native size | Collapse arrows, checkmarks, clear buttons, tab close; the workflow size rules do not apply |
| Thumbnails, empty-state illustrations, and on-screen content | Per content specification | Template illustrations, material previews, Space type previews; not enlarged or shrunk as navigation icons |

Only the app Rail uses 20px for workflow icons; workflow icons in body text outside the Rail, page sidebars, menus, popups, and dialogs are always 16px, with no separate size tiers set by page, control font size, or action priority. The shell icons in the title bar listed above are likewise displayed at 16px, centered in the 32 × 32 square button, at the same height and size as the session menu ···; they are not in the S2 icon library and are drawn on a 20-grid canvas following the drawing method in Spectrum 2 *Icon fundamentals*: 1.5px stroke width, outer corner radius 2.25, round line caps. The window-type graphics share the square frame (2–18) of the S2 expand-right panel icon: the sidebar toggle is a panel bar at x 5, y 5–15 inside the frame, with width 1.5 when the sidebar is hidden (that is, the icon as-is) and widened to 4 when shown; the tab frame is the frame itself, and hide tabs / enter split view adds a divider at the center. The full-view icon is two diagonal corner folds (upper right and lower left) drawn with the sharp corners of S2 `FullScreen` / `FullScreenExit`, with outer corner radius 1.25 and inner sharp corners; on entering they point outward, and on exiting inward; the arm length, spacing, and ratio of stroke width for the two folds keep the proportions of the old shell icon (entering: span 11, arm length 5.75, the two corner projections overlap by 0.5; exiting: span 13, arm length 5.75, gap 1.5). Where S2 already has a corresponding meaning, the original is used directly: session summary uses `ListBulleted`. The plus sign in the tab frame is drawn at the same stroke width on the 20-grid, and the tab count uses 10px, the smallest step on the font-size ladder; both are stacked with the frame in the same 16px render box. Shell icons are used only for the shell controls listed above and follow the text color to express hover, pressed, and disabled states. The icon canvas and the click area are kept separate; buttons continue to use S2 control heights, focus rings, and keyboard behavior. Keep each icon’s original viewBox, paths, strokes, and safe margins; do not stretch paths or apply transforms to chase visual uniformity.

Implementation uses `--bc-icon-primary` (20px) and `--bc-icon-compact` (16px). The canvas of fixed workflow icons is pinned and does not follow the text em size: the Rail uses the primary tier, and everything else uses the compact tier according to the characteristics of workflow icons (`role="img"`, 20 × 20 viewBox), except UI graphics, icon blocks, thumbnails, and on-screen content. Shell icons are not S2 components; they are a set of SVG files, shown as a CSS mask at 16px and filled with the text color, and do not go through this matching rule. Acceptance is judged by the SVG bounding box at 100% browser zoom, while also checking alignment, focus, and click area within the same row.

“New session” uniformly uses `import AddCircle from '@react-spectrum/s2/icons/AddCircle';`; editing and renaming still use Edit. The specification is based on the user-supplied Spectrum 2 *Icon fundamentals* and *Using icons*: on Desktop/Web the primary canvas is 20px and the secondary canvas is 16px, and UI icons are determined by the component.

#### Space icon

All icons that represent the Space entry or jump to Space use React Spectrum S2's `Asset` uniformly: `import Asset from '@react-spectrum/s2/icons/Asset';`. They cover the Rail, menus and quick entries. The text keeps saying Space, and the icon size follows the spec of the control it sits in. Icons for folders, asset types, grid view and content collections keep their own meanings and are not replaced with Asset just because they appear on a Space page.

#### Workspace layout

```text
Home
+------+------------------+--------------------------+------------------------+
| Rail | Sidebar          | Session area            | Function area          |
|      | Projects and     | Current session          | After a video opens:   |
| Home | sessions         | Messages, task cards,    | full editor            |
| Space|                  | input box                | (opened on demand)     |
| Tools|                  |                          |                        |
+------+------------------+--------------------------+------------------------+

Space
+------+------------------+---------------------------------------------------+
| Rail | Category sidebar | Item list                                         |
|      | All / Videos /   | Videos, assets and other outputs                  |
| Home | Final cuts /     |                                                   |
| Space| Images …         |                                                   |
| Tools|                  |                                                   |
+------+------------------+---------------------------------------------------+

After a video is opened (from Home or Space; same layout)
+------+--------------------------+----------------------------------------+
| Rail | Session                  | Full editor                            |
|      | Messages, task cards, input box | Preview, inspector, timeline, content panels |
+------+--------------------------+----------------------------------------+
```

The Home title bar lines up with the columns below it. At the far left is the sidebar toggle. Above the session area is the session header (title, status, session menu ···). Above the function area is the tab strip. At the far right is a button group, from left to right: session summary, full view and the tabs button. Where each control appears in the three views is in §3.3.

### 2.2 Home and Space: roles

| | Home | Space |
| --- | --- | --- |
| Organized by | Session: what I asked it to do and where it is now | Output: which videos, assets and products I have |
| Main actions | Delegate, add to, review, approve, stop, modify | Browse, view, re-edit, organize, export |
| After opening a video | Session on the left, full editor on the right (function area) | Full editor fills the content area; the session is a floating session in the bottom-right corner (§5.1) |
| Typical entry | Start a new task, or continue a session in progress | Find something made earlier and keep editing or export it |

The two are not two separate products. The same video, session, task and output is the same object in both places, and opening a video uses the same components and the same layout:

- Changes made by hand in Space are visible to the Home agent on its next action. Changes the agent makes also appear live in the editor open in Space.
- Changes from either side go through the same command entry point and follow the same version checks, protection scope and permissions.
- A natural-language request from either side first completes pre-send sync (§3.2.4).

### 2.3 Projects, videos and sessions

- A **project** (Project) is a directory, not a video. It is also the agent's working directory. A project can contain one or more videos, along with the assets and outputs they use.
- A **video** (Video) is a subdirectory of a project: one editable, exportable editing object. An exported file is a final cut (成片). An imported or generated media file is a video asset. A video has its own asset references, sequences, script, language and aspect-ratio versions, and history.
- A **session** is a record of collaboration with the agent. A session belongs to at most one project. A project can have several sessions. From a session you can open the videos in that project.
- A session can belong to no project. Use these for quick tasks that need no video, such as transcribing a file, generating a cover or writing a script. Their outputs also appear in Space.
- When a no-project session needs an editable timeline (for example, the user drags in a video or pastes a link and asks for subtitles), the video is created in the session's own folder. No project is created, and the session still belongs to no project. These videos also appear in Space. Only when the user explicitly asks for a project does the agent move the session, together with its videos, into a new project. The project is named after the video by default, and the session content is kept. When you delete a no-project session that still has videos, the videos are first moved into a project named after the video. They are not deleted with the session.
- A new session started from such a video (the floating session in Space, or an AI tool handing work to the agent) shares the folder of the session the video lives in. It can open and modify these videos in the same way, and still belongs to no project. No new project is created. When the folder moves into a project, all sessions sharing it move together. Deleting a session that was opened later does not touch the folder. If a video in the folder is still open (in the editor, a task or another connection), the folder is not moved into a project and no session is deleted. The message says which videos are open, so you can close them and try again ([Architecture design §3.10](../architecture/architecture-design.md#310-binding-sessions-to-projects)).
- A new session can continue an old project. The agent reads the current facts of its videos and the confirmed constraints, so the user does not need to re-upload material.
- Closing or archiving a session does not cancel its tasks. It does not delete projects, videos or outputs.
- A **sub-video** (子视频) is an ordinary video derived from a segment of another video. It is the result of cutting a short video (§5.10). It is created next to the parent video in the same project. It copies the parent's tracks, clips, script and translations in full, references the same assets, and keeps the portions outside its range as cut points, so the trimmed parts can still be restored in the sub-video. It carries a derivation record (the parent video, the parent's version and the range), and does not copy chapters. After that, the two videos are edited independently. Deleting the parent does not delete the sub-video. For the mechanism, see [Architecture design §3.5 "Derived sub-videos"](../architecture/architecture-design.md#35-tool-catalog) and [Video format spec §4.6](../spec/video-format-spec.md#46-document-kinds).

Do not mix up the three terms: a project is a directory, a video is editable, and a final cut is an exported file.

### 2.4 Navigation between entries

- Home → Space: any video or output in the function area has "Show in Space". Files exported from a video card can also jump to Space.
- Space → Home: every item has "Continue in session" (create a new session or return to one, bringing the item into the input as a reference) and "View source session".
- Each of the two entries remembers its last position and layout. Switching entries does not interrupt tasks or change any selection or draft.
- Several windows connected to the same Runtime see the same committed version.

### 2.5 Windows and layout

- The widths of the three columns can be dragged. The sidebar and function area can be collapsed. The initial proportions are layout suggestions and need prototype validation (see §12).
- **Sidebar flyout.** When the page sidebar is hidden, if the pointer rests for 100 ms on an entry in the Rail or on the sidebar toggle in the title bar, that area's sidebar flies out. The overlay is inset 6 px from the top, bottom and left edges of the app panel. Its corner radius is concentric with the app panel (panel 16 px − inset 6 px = 10 px). It sits over the content without changing the layout beneath. The overlay has "Pin sidebar"; clicking it restores the persistent sidebar. If the flyout is for a different area, the pointer also enters that area. Choosing an item in the overlay jumps there and closes the overlay, and it also closes when the chosen item is the current location. The overlay closes on Esc, on a click outside the overlay and the Rail, or on a route change. It closes 100 ms after the pointer leaves both the overlay and the trigger. It does not close while focus is inside the overlay or while a menu or dialog is open. After the sidebar is collapsed with the toggle, it does not fly out again immediately while the pointer stays on the toggle. Settings has no page sidebar, so nothing flies out. While the desktop flyout is showing, web views embedded in the function area are temporarily hidden, as they are when a menu or dialog is open. They return after the flyout closes.
- In a small window, the session's input box and the current preview take priority. The panels are not squeezed into narrow columns. Home's workspace (session area + function area) has three views: **Session** (function area collapsed, session fills the space), **Split** (session on the left, function area tabs on the right) and **Full view** (one tab strip only, with the session as its fixed first tab). The workspace judges narrow mode by its own width, not the window width. When the width is insufficient, it likewise switches to this single-column tab strip. Details are in §3.3.
- After the user adjusts the layout by hand, the agent must not keep pulling the interface back. An agent can offer "Open preview" or "Go to this" on a card. The function area changes only after the user clicks.

### 2.6 State display and accessibility〔UX-05〕

- Core operations support the keyboard, and focus state is clear.
- Problems are not distinguished by color alone. Time, cost and permissions are explained in text.
- Loading, queued, waiting for GPU, needs authorization, remote state unknown and failed are different states. They must not share one spinning icon.
- "Connected" does not mean "data is caught up". While data is not caught up, the interface does not allow submitting changes.
- The script editing mode (§5.7) always shows a visible label.
- A toast disappears automatically after a few seconds (about 5 seconds). This also applies to toasts with buttons (undo, view). It does not disappear while the pointer is over it or focus is inside it. A toast is not the only record: items the user must act on also remain on the task page or the relevant page.
- UI text goes through the internationalization mechanism. The layout does not assume text length or direction.

### 2.7 Tools

Tools are first-level entries in the Rail, placed below Space. They do one defined thing directly, without going through a session: transcribe, translate subtitles, translate dubbing, generate speech, text generation, generate images, generate music, download video, compress, merge videos and extract audio. Tools only call models and fixed flows. They do not start an agent. A tool that uses a model lets you pick a model configured locally or in the cloud on the page. Tools that need a text model (translation, text generation) call the configured text model directly.

**A tool's result is an item in Space that can be processed further, not a one-off file.** By default a result belongs to no project. It is saved to the default save location (§2.7 "Page"), appears as a Space item, and can then be processed by another tool, used to create a new video, added to a video, or handed to an agent to continue. Tools fall into four groups by the object they process:

| Group | Tools | Result |
| --- | --- | --- |
| Speech and subtitles | Transcribe, translate subtitles, translate dubbing, generate speech | Document and subtitle items, or the script, translation, subtitle layer and dubbing written into a video; audio items |
| Text and images | Text generation, generate images | Document items, image items |
| Music | Generate music | Audio items (generated locally, no network) |
| Video files | Download video, compress video, merge videos, extract audio | Video file items, audio items |

Inputs and destinations:

| Tool | Where the input comes from | Result |
| --- | --- | --- |
| Transcribe | A local video or audio file; a video file, final cut or audio in Space; a link; an editable video in Space | Files, and media and links in Space: by default no video is created. It produces one transcript (TXT) and one subtitle file (SRT), saved to the save location as document and subtitle items. A linked video is saved to the download folder together with the downloaded video (see "Download video"; the page has no save-location row). With "New video" selected instead, the content goes into a project, with the asset on the timeline, a voice document and an editable subtitle layer (S01). Editable videos: if the video already has a script, a new video is created by default (same project, linked to the same asset; the original video and its translation are unchanged). Selecting "Replace this video's script" instead switches to the transcript (§5.11). A video with no script has the transcript written directly into it |
| Translate subtitles | Videos in Space that have a script (the picker lists only transcribed videos and marks the languages already present); one SRT or VTT file, either local or a subtitle item in Space | Video: adds a translated script document and a subtitle layer in the target language. Bilingual display can be chosen (S02). The original is unchanged. Subtitle file: one translated subtitle item, which can be paired with media to "Create video from this" |
| Translate dubbing | Videos in Space that have a script; an existing translation can be selected directly | Written into this video: a new set of dubbing (S07) |
| Generate speech | Typed text; a document or subtitle in Space (its text is used) | One audio item |
| Text generation | The request; a document or subtitle in Space can be attached as material | One document item |
| Generate images | One line of description | Image item |
| Generate music | One line of style description; for a song, lyrics are given separately; optional target duration and arrangement. Only local music models are available (Settings › Music generation). When there is no model, the "Model" row gives an entry to settings. Generation takes several to more than ten minutes, which the page states | One audio item (WAV). If the model is licensed for non-commercial use only, this is stated on the page and in the result. Music started from the editor's "Generate score" is added to that video's music track. If the video is longer than the single-generation limit, it loops to fill the length (see "Generate score" below) |
| Download video | A video page or a direct media link | Video file item downloaded with yt-dlp. You can tick the option to transcribe after downloading, which also yields document and subtitle items |
| Compress video, merge videos, extract audio | Local video files; video files or final cuts in Space (extract audio also takes local and Space audio) | Video file items (compress, merge) or audio items (extract audio). The three tools share one page and can be switched within it. Each is still a separate tool in the directory |

#### Generate score

The "Generate score" entry point (§5.10) in the editor's AI tools opens this page with that video attached. A card at the top of the page states which video the score is for. The target duration is prefilled from the video's length. When the score is done, it is added directly to that video's music track and also stays in Space. On the card you can switch to "Generate only, don't add to video".

- **Video no longer than the model's single-run limit** (`maxDurationSec`, 300 seconds for YuE2 3B): the target duration is prefilled from the video length, rounded up to the next 5 seconds. The music is never shorter than the video. When added to the music track, only one segment is placed, cut at the end, with a fade-out at the tail. The card says "Duration prefilled to N seconds for this video."
- **Video longer than the limit**: the duration is not silently cut to the limit. The card states "The video is X seconds, over the single-run limit of 300 seconds. 300 seconds will be generated and looped to fill the video, with a fade-out at the end." The target duration is prefilled to the limit. After generation, the result is **looped to fill** the video, based on the actual generated length: the same segment is repeated from its start, back to back, to the end of the video. Each seam is cross-faded on both sides (2 seconds). The last segment is cut at the video's end, with a fade-out at the tail (3 seconds). It is not stretched, sped up or slowed down, and its rhythm is unchanged. The generation record and notes describe the fill, for example "Added to music track · looped 6 segments to fill 1740 seconds · 2-second cross-fade at seams · 3-second tail fade-out." If the music is longer than the video, only one segment is placed, cut at the end, with a tail fade-out.
- For a result that reaches the limit, the usual reminder that the ending may feel rushed still applies. When the limit is already the single-run maximum, the UI does not suggest making it longer. Looped results note separately that the seams are cross-faded.
- The UI offers only this one fill method, loop. Generating separate segments that follow a mood-arc table and joining them at shot changes is an option the agent may choose when an arc table exists (the music page of the manual, `skills/cuccut/references/catalog/music.md`, which skills such as video production refer to). It does not appear in the UI.
- Adding to the music track is this entry point's own edit (one audio instance per segment, each with a fade-in and fade-out; see architecture design §7.9), not a step of the generation task. When the generation task was given a video, it only imports the result as a candidate asset.

#### Download video

- The tool card and the sidebar both use the S2 `Download` icon. The page shows, in order: the video link, the download folder, a summary of download settings, and post-download transcription. The summary line gives yt-dlp's status and version and which browsers are used for website login. When the tool is not ready, "Prepare download tool" appears in place, and "Change download settings" opens Settings › Video Download.
- yt-dlp status and maintenance, and website login (browser cookies), are in a separate Settings section, "Video Download" (in the Preferences group, at `/settings/downloader`). Settings › General no longer lists the download tool. The download-video tool, transcription from a link, and agent downloads all follow the settings in this section.
- By default, downloads go to `~/Downloads` on the host that runs the download. Changing the folder opens the system folder picker, saves to `downloads.directory`, and is used next time.
- Remove the "After download" option and the new-video entry point. A download only produces a media file; it does not create an edit video or timeline.
- "Transcribe after download" is off by default. When on, it uses the default speech recognition model and auto-detects the language, producing a TXT and an SRT. "Put transcript in project" is optional and unchecked by default. Project membership and save folder are independent: the video, transcript and subtitles are all saved to the chosen download folder. Choosing a project only links the transcript results and moves no files. The option reads "Don't put in project" and adds no save-folder note.
- The download tool status in this section shows the detected version, source and install method. You can re-detect, update yt-dlp, or specify a local executable. A managed install is only available when the trusted release manifest is complete. Re-detecting is not called updating.
- Updates use the original install method (on macOS and Linux: Homebrew, pipx, pip or the official standalone program; on Windows: winget, Scoop, pip, pipx or the official standalone program). CucCut runs them on this machine. The tool card states the install method and shows the full command that will run as a one-line code block, written for the Runtime host's shell (PowerShell on Windows, POSIX shell elsewhere). To the right are two icon buttons: run (triangle) and copy. Clicking run starts the update immediately, with no confirmation dialog. If the install method has changed by the time run is clicked, nothing runs and the new command is shown instead. While the command runs, the run button becomes stop, and its output appears line by line below the command. When it finishes, detection runs again automatically and the page says "Updated to …" or "Already up to date …", based on the versions before and after. If winget has no upgradable version and exits without code 0, this also counts as already up to date. On failure, the page states the exit code and keeps the output. Updates run as background tasks, so leaving the page does not interrupt them. A new download cannot start while an update is in progress.
- When the install method cannot be determined, the page lists the common commands for the Runtime host. On macOS and Linux there are three: Homebrew, pip, and the official standalone program. On Windows there are four: winget, Scoop, pip (`py -m pip`), and the official standalone program. When changing the install requires administrator rights, CucCut does not run it and does not elevate. This covers Windows installs under system folders such as Program Files and ProgramData, and installs made by Chocolatey. In these cases CucCut only shows the command for the user to run in a terminal. On macOS and Linux the command includes `sudo`. On Windows it does not, and the page says to open the terminal as administrator. Both cases show the command block with a copy button only, and the page asks the user to come back and click "Re-detect" when done.
- Website login uses cookies by default, taken from all detected browsers. If the user ticks "save as setting", the saved value is "All browsers" when every browser is ticked, so browsers detected later are included as well. CucCut detects which browsers are on this computer. Following yt-dlp's lookup rules, it checks whether each browser's cookie database exists and when it was last modified, without reading the contents. Only detected browsers are listed, with recently used ones first. Detection runs when the page opens, and "Re-detect browsers" is also available. If no browser is found, the page says so and shows no options. Browsers appear as a row of checkboxes that wraps onto new lines when there is not enough room, with "All browsers" first. Ticking it selects every detected browser; when only some are ticked, it shows a partial state. Ticking none means anonymous download. At the start of each download, the browser list is expanded from the detection results at that moment and frozen into that download.
- When several browsers are ticked, they are tried one by one in the listed order. If a browser's cookies cannot be read, or the site still requires login, the next browser is tried. Once one works, it stops, and the result states which browser was used. Below the checkboxes, the page states clearly: only the ticked browsers are read; yt-dlp reads them on this machine and uses them only for the target site; CucCut records only browser names and never stores cookie contents. When the Runtime host is macOS, the first read of each Chromium-based browser (Chrome, Edge and others) triggers a Keychain authorization prompt, and Safari requires CucCut to have Full Disk Access. When the host is Windows, ticking a Chromium-based browser shows a warning that its cookie database is locked while the browser is open, so it must be fully quit, including background processes. Ticking Chrome, Edge or Brave also shows a warning that these browsers usually protect cookies with app-bound encryption, which yt-dlp may currently be unable to read, and that quitting the browser does not help. If Firefox is not ticked, the page suggests using Firefox instead. On other systems these warnings are not shown.
- Failures are explained with a remedy for each category: login or verification, cookies unreadable, tool needs updating, unsupported or unavailable, network, and disk space. For unreadable cookies, the page suggests quitting the browsers that hold the database open, checking system keychain permissions, or switching browsers. When the Runtime is on Windows, the keychain is not mentioned. Instead, for Chromium-based browsers the page says to fully quit them, including background processes; for Chrome, Edge and Brave it adds that app-bound encryption means the cookies may be unreadable, so Firefox should be used. The next browser is tried only when cookies cannot be read or login is required. Cookies are not rotated for network, disk or outdated-tool errors. When none of the ticked browsers succeeds, the result explains each browser's outcome at once.
- Retrying with the original parameters continues from the failed step. Changing the link or the website-login checkboxes starts a new download. When a site requires login, or none of the ticked browsers' cookies can be read, both the failure message and the agent's reply include a link to Settings › Video Download (§3.2.2). If transcription fails, the downloaded files are kept and a retry does not download again. The result gives the file locations of the video, transcript and subtitles.
- Online transcription goes through the existing outbound-data authorization before it starts. Downloading does not enter the agent loop.

#### Pages

Every tool page follows the same layout from top to bottom. Each tool fills in only its own rows:

1. **Input.** The source switch lists the sources each tool declares: local file, Space, link, or text. Choosing Space opens the Space picker. It lists only the kinds this tool accepts, with thumbnails, source and status. Items in the trash are not listed. When entering from "Process with tool…" in the Space viewer, the input is already selected. Tools that take a video list only transcribed videos, marking the languages and translations each one already has.
2. **Model.** Tools that use a model list the local and cloud models configured for that capability. The default is the capability's default model from settings. A changed choice is remembered per tool. When no model is available, this row links to settings, and the start button explains why, instead of a full-width warning card blocking the parameters.
3. **Options.** The tool's own parameters, such as language, speaker identification, aspect ratio, and bitrate.
4. **Save location.** Shows the folder where this result will be saved. The default is the default save location from settings. "Change…" opens the system folder picker and applies to this run only. Runs that write into an existing video do not have this row.
5. **Start.**

The default save location is in Settings › General. Tool results, downloaded videos, and files handed over by agents are all saved there. It defaults to the system Downloads folder (`~/Downloads`) of the computer running the Runtime. File names in the save location are readable (taken from the title or the source file name). Existing files are not overwritten; duplicates get a number suffix.

#### Results and next steps

When a run finishes, the result page lists each output with its name, kind, duration and spec. Types with a duration show it. The spec is written the same way as Space's "Spec" (§4.3). Each output also has this set of actions:

- **View in Space** (opens that item's viewer) and **Show in folder** (opens the file in the save location). Show in folder does not appear on the web, because a browser cannot open folders on the Runtime's computer.
- **Use in another tool**: the tools that can continue from this result, with the previous result already selected. After a transcript or subtitle file: translate subtitles (accepts subtitles only), generate speech, and create a new video from it. After a translation: translate dubbing. After audio, image or video files: create a new video from it, and add to video (§4.6). Results written into a video offer "Open in editor". For "Create new video from" with audio, image or video files, the user first chooses a project. The files stay where they are, and the new video only links to them. In this version, "Create new video from" for transcripts and subtitles is greyed out, with the reason stated: the Runtime does not yet provide a way to create a media-based video from text. "Add to video" is not built yet.
- **Hand to Agent**: brings the result into a session as a reference (§4.7). The input is pre-filled with an editable sentence, such as "Translate this subtitle into English". The user sends it; nothing is sent automatically. If the result does not belong to a project, the session has no project.

Rules:

- **Pick existing items; no need to open them first.** The input picker reads Space's catalog: for each video, whether it has a transcript, what language it is in, and which translations and dubs exist. The selected video does not need to be open in the editor. The Runtime opens it while the tool runs and closes it afterwards.
- **Results need not belong to a project.** Only "Create new video" asks for a project, defaulting to the last one used. The material stays in place by default and is only linked. The new video is an ordinary video entry in Space, with its source recorded as this tool run. Other results are saved to the save location and do not ask for a project.
- **Transcription can identify speakers.** Under "More options", folded below the speech model, is "Identify speakers". Its current status appears in the heading. Models that diarize on their own (MOSS Transcribe) always have it on. Other local models need the "speaker diarization" model pack: if the pack is installed, the option is on by default; if not, it is off by default, and turning it on downloads the pack in place. The run cannot start until that download finishes. Cloud services that do not diarize keep it off and cannot turn it on. A choice the user has made is kept when switching models. When a model pack does the diarization, the run gains one extra step, "Identify speakers", and the result states how many speakers were found.
- **Writing into an existing video is an ordinary edit.** The result is committed as one edit, subject to the same version checks and protections as a manual edit, and it can be undone. Translations and dubs do not overwrite: translating the same language again adds another translation, and dubbing again adds another set of dubs. The user decides in the editor which one to use. Transcripts do not coexist as two copies: transcribing again either creates a new video or replaces the current transcript, and translations, subtitles and dubs carry over according to the rules (§5.11). A tool never silently rewrites content the user has edited by hand. Replacing an edited transcript requires accepting a warning first (§5.11).
- **Same-named operations in the editor.** Actions such as "Transcribe" or "Translate" inside an open video are handed to the agent by default (§5.10). When the user switches to "Call the model directly", it runs the same flow and creates the same task record as selecting this video from the tool entry point.
- **Authorization is handled on the spot.** When a tool needs to send data to an online service and the existing authorization is not enough, the tool page states what will be sent, to whom, and the estimated cost. Once the user agrees, the tool continues. The user is not sent elsewhere to add authorization and then come back to retry.
- **Progress and failure.** Each run, including direct tasks such as speech generation, image generation and text generation, is one task in the task center, with progress shown per step. A failure stops at that step, and the run can be retried from that step. Videos already created and completed steps are kept. Direct tasks and file transcoding have no steps. The failure reason is written above "Retry". "Retry" (for finished runs, "Run again") returns to the tool page with the parameters already filled in, and whether to change them is up to the user. After a failed transcription, entering from the Space item's "Retry transcription…" (§4.4) works the same way: the tool page is pre-filled with the failed run's model, language, speaker identification and other parameters, and the top shows the failure reason and "Last run · model · how long ago". The task details show the same output list, save location and result actions, so the user can return to the work after leaving the tool page.
- **Relationship with the agent.** Tool results are visible to the agent. When the video is opened in a session later, its transcript, translations and dubs are there. Results in Space are brought into a session with "Hand to Agent" or "Continue in session". Tool entry points (the Rail's tool pages and the matching CLI commands) follow a fixed flow only and do not start an agent. Entry points in the editor hand off to the agent by default, and take the fixed flow only when the user explicitly switches (§5.10). Once a run has started, the two do not hand off to each other (architecture design §7.9).

#### Command line and external agents

Besides the commands that match the tool pages, the `cuccut` command line gives the user in the terminal, and the agents the user runs there (Claude Code, Codex, and so on), a set of commands for operating CucCut. These cover one-step actions such as transcribe, translate, dub, download and export, plus reading and writing videos, documents, assets, subtitles and jobs. This is the [agent surface](../glossary.md#runtime).

- **Same names as MCP.** The agent surface is derived from the same tool catalog in the Runtime. The agent in a session, external agents connected through the MCP server, and the command line all use the same capabilities. Command names map one-to-one to MCP tool names: MCP's `a_b` is `cuccut a b` (`videos_frames` ↔ `cuccut videos frames`). Top-level verbs such as `transcribe` and `export` have the same name on both sides (`transcribe` ↔ `cuccut transcribe`). Use `cuccut help <command>` to see each command's arguments, effects and examples.
- **Confirmation is handled by the terminal.** The command line is operated by the user in person, or by an agent the user has authorized. It does not go through CucCut's approval step. Confirmation is left to the user in the terminal or to the agent host's own permission prompts. Commands that delete something irreversibly require `--yes`; without it, the command only says what it would do and is refused. Changes made from the command line count as the user's own and can be undone in the desktop app. Sending data out follows the same authorization as the desktop app (§7.2).
- **Long jobs run to completion.** Time-consuming commands such as transcribe and export wait until the job finishes by default. They show progress while running and report where the result is when they finish.
- **No need to open the App first.** When the App is open, the command line uses its Runtime. When it is not, the command line starts its own Runtime, which exits automatically after a period of inactivity and leaves no process running in the background.
- **Admin bucket is listed separately.** Local administration, such as settings, model services and credentials, external services, and adding or toggling skills, is the command line's [admin bucket](../glossary.md#runtime). These are management commands for people and are not part of the agent surface.

---

## 3. Home

Home is where you collaborate with the agent. It has three columns: the sidebar, the session area and the feature area. The top of the session area lists the videos in the current project, and you can open them from there.

### 3.1 Sidebar: project and session list〔UX-06〕

From top to bottom:

| Area | Content |
| --- | --- |
| Top | New session, search, notifications |
| Pinned | Projects or sessions the user has pinned |
| Projects | Project list, shown as directories (folders). Video thumbnails are not shown. Expanding a project shows its sessions, sorted by most recent activity. You can create a project or open an existing directory |
| Recent | Sessions that do not belong to any project |

Rules:

- Each session shows its title and a status badge: in progress, waiting for approval, has results to review, completed and unread, or failed. A project row summarizes the status of the sessions under it.
- Switching sessions only switches the view. Running tasks keep running.
- Project menu: new session, rename, show in Space, archive. Session menu: rename, pin, move into a project (P1), archive, delete.
- Archiving only affects the list display. Deleting a session does not delete the project, its videos, its outputs or changes already made. Deleting a video is a separate action and follows the deletion rules in §4.9.
- Titles are generated by the system from the task and can be changed by the user.

### 3.2 Session area

#### 3.2.1 Starting state〔UX-01〕

When no session is selected, the main entry point is the input box and drag-and-drop: “描述要做的视频，或把已有视频拖进来” (Describe the video to make, or drag in an existing one). It may show three starting points, “从内容创作” (Create from content), “修改已有视频” (Edit an existing video) and “继续项目” (Continue a project). These are not required wizards, and they are not split into mutually exclusive product entries by style, such as hand-drawn, math or whiteboard. The input box has no separate frame-size or duration fields: the agent infers them from what the user says and the materials, and anything unspecified is decided by the content.

**Project tray.** Below the input box is the project tray: “这台电脑” (This computer), the project menu and the project path. The first item in the menu is “不用项目” (No project). The rest are projects (sorted by recent activity, as in the sidebar) and “新建项目…” (New project…). The current one is marked “当前” (Current). With “不用项目”, the path area states that videos and files are kept in the session's own folder (§2.3). When you enter from a project's “新建会话” (New session), that project is selected. Otherwise the last choice made in the tray is reused (stored on this computer; it applies only if the project still exists and is not archived), and if there is none, “不用项目” is used. When the editor has a video from a project open, a new session can only be created in that project, because the session must be able to modify that video, so “不用项目” cannot be selected.

**Quick starts.** Below the input box is a row of quick starts: add subtitles, transcribe and translate, cut a talking-head video, audio to video, and new blank video. Clicking one only fills the input box with a prompt. The prompt says to drag in or paste the video (audio) next. Local files, YouTube, X, and links to any site supported by the download tool are all accepted (§2.7 “Download video”). The target language of “转录并翻译” (Transcribe and translate) is a field to fill in, with no language preset. Once the user has filled it in, the last value is reused (stored on this computer). If it is left blank, it is handed to the agent as a blank field, and the agent asks before it acts.

After materials are dragged in, the app first shows the detected type, the available audio tracks, accessibility status and any necessary warnings. New users can first explore examples or open an existing video. When a model is needed, the app guides the user through the matching setup and does not block first launch with a full-page key form.

**Templates.** Below the input box on the starting page is a set of creative template cards (for format and usage semantics, see the [template package spec](../spec/template-spec.md)). “全部模板” (All templates) opens the template library with filtering and details. Templates come in two kinds. **Scene templates**, once selected, attach to the input box and fill it with their one or two sentence brief. When sent, the Runtime prepends the brief's guiding preamble, the template's default frame size and duration, and the template body. **Example works** only put a request in the user's voice into the input box, and from then on behave like any normal message. Fields left in the filled text (audience, product, output language and so on) appear as clickable markers. Clicking one replaces it in place, and Tab / Shift+Tab move forward and back. A line below the input box shows how many fields remain and offers “填下一处” (Fill next). Sending is not blocked: unfilled fields are passed to the agent as “[label]”, and the agent asks about them together as missing brief items. Template details list what each field needs and give one example, and also state which skill the template suggests the agent read first (§6.9). Choosing a different scene template replaces the text in the input box and offers undo. Clicking an already attached template again only removes it, and the text is left unchanged.

#### 3.2.2 Message stream

A session is made of three kinds of content:

- **User messages**: text, attachments and reference tags.
- **Agent replies**: text explanations.
- **Task cards**: structured cards driven by real events, task records and submission receipts (§6.5). They carry the goal, the video and the work done on it, downloads, candidates, changes and authorizations.

Execution steps are collapsed by default. The steps and change receipts between two replies are folded into a single line of grey text with an expand arrow, without an icon. They are summarized in the order each kind first appears. Reads and edits count deduplicated files, and video edits count receipts as edit counts. For example: “读取了 2 个文件、运行了命令” (read 2 files, ran a command) or “调用了工具、提交了 1 笔视频修改” (called a tool, submitted 1 video edit). A failure also appears as grey text, with “N 项失败” (N failed) at the end. When expanded, a bordered box appears. Each step gets one line, and each change receipt gets one line (§6.5), with dividers between lines. Each line in the box can be expanded again to see its input, output and errors. Step lines use fixed category names (run command, read file, edit file, search, other tool), followed by a secondary summary (the command, relative path or query term). On the right are the non-zero exit code and the duration. CucCut's own tools are not labeled “其他工具” (other tool). They use the tool's own name for that category, and the summary only takes fields already present in the call arguments, for example “转录 · large-v3” (transcribe · large-v3), “翻译 · en” (translate · en), “剪辑 · 3 处” (edit · 3 places), “导出 · 成片 · MP4” (export · final cut · MP4), “生成图片 · 4 张” (generate image · 4), and “下载视频 · youtube.com” (download video · youtube.com). Durations and sentence counts that are not in the arguments are not written. While the session is running and a step in this group is in progress, the summary line changes to the step in progress. It starts with a pixel loading animation that rotates through several images related to the step category (for transcription, a microphone or dialogue; for editing, a timeline or crop, and so on). The category name shows a shimmer sweep, and after it is the elapsed time. When several steps run at once, no time is written and “等 N 项” (waiting on N items) is shown instead. This line is also collapsed by default. When expanded, the in-progress step in the box uses a static category icon, with only the shimmer kept (no motion when the system requests reduced motion). An in-progress step that has no output yet shows a skeleton placeholder. If a completed step still has no output, “没有输出” (no output) is written. When the output is a unified diff, added and removed lines are colored. A failed step is replaced by a warning icon, and when expanded it gains an “错误” (Error) section. Once a failure appears, later updates do not change it back. The default view presents task status, not low-level logs, and does not depend on the model service exposing internal reasoning.

Reply text is shown character by character at a steady pace. The number of characters released each frame is proportional to the backlog not yet shown, and cut points never fall in the middle of a character. When a reply finishes (including when it is stopped), the full text appears immediately. A reply that was already fully written when the session is opened is shown in full. Body text is rendered as Markdown, and single line breaks within a paragraph are kept as line breaks. While streaming, only the last paragraph is processed. Unfinished bold, italic, strikethrough and inline code are completed first. An unfinished link shows only its text. An unfinished image is not shown yet. Unclosed code blocks are not processed, so markup symbols never flash on screen. Code blocks can be copied on hover. Inline code that looks like a project file path (with a directory prefix, or a multi-part path with a known extension, optionally with a line number or line range) is clickable. It opens the file in the feature area, and the tooltip shows the relative path and line range. A bare file name is not linked.

Anything the user needs to change in Settings (installing or enabling a model service, replacing a key, adjusting the agent or permissions, or the browser where website login must be ticked) is written in the reply as a settings link, not just as “去设置里改” (change it in Settings). The link points to the specific section. Model settings go to the capability page for that kind of capability, the provider page, or the “我的声音” (My voice) page (§7.6). The addresses are the same as the in-app links (`/settings/<section>`, `/settings/models/<kind>[/<page>]`). Old addresses for local models and the cloud model page resolve to the capability page for that kind of capability. A settings link has a settings icon in front. The tooltip shows its location in Settings. Clicking it opens that page in the current window, and going back returns to the session. Addresses are provided by tool results and by the instructions given to the agent. The agent does not guess them. Addresses that are not recognized show only as text. In the browser there are no settings, so settings links show only as text.

A turn runs from one user message to the next user message. Below the last line of a turn is a footer. While in progress, it reads “正在工作 · 0:42” (Working · 0:42) and updates every second, with a pixel loading animation in front that rotates through all the shapes. When waiting for the user's permission, it reads “等你允许 · 0:42” (Waiting for your permission · 0:42), without animation. When complete, it reads “已工作 1:03” (Worked 1:03). On hover, it changes to show the end time. Stopping and failure are stated as the task events report them. On the right side of the footer, “复制” (Copy) copies the full body text of all replies in this turn (Markdown source, excluding steps and reasoning). Replies do not each carry their own copy button. A turn that has only a user message and no reply yet shows no footer, unless the turn has been stopped or has failed. The end of the thread has no separate placeholder such as “正在回复” (Replying). Progress is expressed by the footer. No more than two loading animations play at the same time in a session (the summary line of the step in progress and the footer). Completed summary lines, avatars and the input box do not animate. Pixel images use only pattern-type shapes, not letters or third-party marks.

The spacing between lines is determined by the kinds of the two adjacent lines: 4 between consecutive user messages, 0 from a user message to a reply, 0 between adjacent steps, 16 from a user message to a step, 4 between a reply and a step, 12 between blocks within the same reply, 4 from any line to the footer, and 16 otherwise.

Card status is not inferred from natural language such as “已经完成” (already completed). Objects on a card are clickable: open a preview in the feature area, jump to a timestamp, compare before and after, or listen to a candidate.

**Video card.** When the agent creates or modifies a video, or submits transcription, translation, export or import from a link on it, a video card for that video appears in the session. The first message of a session is sent with the open video attached (from the floating session in Space, or the starting page with a video open, §5.1). That video also gets a card alongside that message, and later messages do not move the card even if the editor state changes. As soon as a video exists, its card appears, and “打开编辑器” (Open editor) is always available. If the location of the video is not yet known (the fixed flow has just created it and Space has not scanned it yet), the card is greyed out until it is known. A session has only one card per video, and it sits at the later of two positions. The first is after the last block that references it: within a step group, this is the step that submitted a job pointing at it, a change receipt, or the step that created it, or the block that carries the first message sent with it. The second applies when a job on the card has not finished at the start of a later turn (still running or queued). Then it sits after the last block of the last turn that started before that job finished (if still running, this is the latest turn). Ordering compares only the job's finish time with the send time of that turn's user message. When the card moves, earlier turns no longer show it. Once the job finishes, the card does not move back.

The card header shows the picture, the name, the status word and the duration. The picture does not show a play button by default. If the video can be played in the card (it has a picture, is available in Space, and its source file exists), a play button appears in the middle of the picture when the pointer moves over it or the keyboard focuses it. On devices without hover, it is always shown. Clicking the picture plays the video in place within the card. The player takes the picture's position and has playback controls (play/pause, progress, volume, speed, fullscreen), without leaving the session. It plays the original source of the video, not an edited version. For a video that cannot be played in the card, clicking the picture still opens the editor.

Status words come only from task records and from the transcript of an open video. While transcription is running, the card shows “转录中” (Transcribing) with a percentage. When queued, it shows “排队中” (Queued). When no transcription is running or queued, but a translation is running, it shows “翻译中” (Translating). A percentage is added only when a fixed-flow translation is the only one running and it already has step progress (translations the agent does sentence by sentence show no percentage). When a transcription result exists, it shows “已转录” (Transcribed). If a transcription has failed before, it shows “失败” (Failed). When nothing is known, nothing is shown. The card does not infer “未转录” (Not transcribed) from “no record”. Below are this session's jobs on this video (transcribe, re-transcribe, translate, export, import from a link). The card only expands the parts that need attention. If jobs are in progress (running or queued), all in-progress jobs are expanded, one per line. If all have finished, only the most recently finished one is expanded (ordered by submission). The rest are collapsed into one line, “之前的 N 项” (N earlier items). It is collapsed by default. When expanded, they are listed newest first, and each keeps only its name, status word, exported file name, failure reason and buttons. If a collapsed job has a failure with a remedy or retry button, a warning icon and “N 项待处理” (N items pending) appear on the right of this line. The content of each line:

- In progress: the stage, a fine progress bar (no percentage when there is no total), unit-based counts (“已识别 1:02 / 3:26” (recognized 1:02 / 3:26), “已识别 12 / 40 段” (recognized 12 / 40 segments), “已译 120 / 300 句” (translated 120 / 300 sentences), “已下载 12 MB / 45 MB” (downloaded 12 MB / 45 MB)), the elapsed duration, and “取消” (Cancel).
- Sentence-by-sentence translation done by the agent itself (not handed to the translation flow, and written into the video once when finished) is also one line on the card. Its name reads “翻译 · 目标语言” (Translate · target language). While in progress it reads “Agent 逐句翻译 · 共 N 句” (Agent sentence-by-sentence translation · N sentences in total) with an indeterminate progress bar and no percentage. There is no “取消” (Cancel). This job follows the agent's turn, so to stop it, stop that session. If the turn ends before the result is written into the video, it is recorded as interrupted. If the user stopped it, it is recorded as cancelled.
- Transcription and re-transcription have a separate line showing the model and parameters used: model name · local or cloud · language. If speaker identification is on, “识别说话人” (Speaker identification) is added. This line is read-only.
- Completed: result facts (transcript written into the video, translation language, warnings). An export lists the file name, dimensions, duration and size. Final cuts and audio can be played, and files can be shown in the folder.
- Failed: the reason. When there is a definite place to go, a remedy button is given (the settings page for the relevant capability, the API provider, or agent settings). Only jobs that can be reconciled and retried (interrupted, result unknown) get a “重试” (Retry) button. A cancelled job shows “已取消” (Cancelled).
- While an export is rendering, the estimated remaining time follows the elapsed time (“已用 0:41 · 剩余 0:52” (Elapsed 0:41 · Remaining 0:52)). It uses the same projection as the export window (§8.3). Other jobs do not show estimated remaining time. Do not invent sentence counts or speaker counts, and do not place buttons that have no action.

**Download card.** When the agent imports from a link and the video has not been created yet, a download card appears. It shows the title (the site name if the title is not yet known), the redacted link, the downloaded amount and total, the percentage, the elapsed duration and “取消” (Cancel). A failure shows the reason and an explanation. Once the video is created, the video card replaces the same position, and the transcription after download continues as a line on the card. For a download that does not create a video, the card stays a download card after completion, listing the files saved, which can be shown in the folder.

The video card in the session summary (§3.3) is the same card as in the thread. Its content and the rules for expanding and collapsing are the same.

Exports generated only for the agent's internal use, such as extracting frames, checking subtitle layout or listening to a preview, are marked `purpose: preview`. They do not trigger a video card, do not enter the export line on the card, the “之前的 N 项” (N earlier items) list, the artifact list and count in the session summary, and do not appear in Space. If no location is given, they are written to a hidden directory in the working directory, so they are not mixed with delivered files. Background jobs keep the full record, progress, failures and files. A preview, short clip or segment the user asked for is still a deliverable and is displayed according to `deliverable`. Old records that omit the purpose are also treated as deliverables, and their purpose is not guessed from the file name or duration.

#### 3.2.3 Input area

- **Attachments and drag-and-drop**: video, audio, images, subtitles, documents. The "+" menu in the input box has a heading "Add", and its first item is "Files and folders" with a paperclip icon. It selects local attachments in one place and is not split into separate entries for images, video or documents. On desktop, the system picker accepts files and folders: on macOS, both can be mixed in the same picker; on Windows / Linux, the user first picks files or folders, then the matching system picker opens. Images use the attached-image upload channel. Other local files and folders are passed to the agent with the message as removable path references, and selecting them does not widen the agent's permission scope. The web client supports uploading images and ordinary files through the same-origin authenticated channel; each message allows at most 8 attachments, and each file must be non-empty and no larger than 20 MiB. The browser does not obtain local paths and does not upload folders recursively. References to existing content enter through `@` completion or through the reference chips in the feature area; there is no separate file-reference menu item.
- **Reference chips** [UX-02]: the object, sentence, time range or version selected in the feature area or in Space appears above the input box, for example "English subtitles / Sentence 3 / 00:18–00:22 / Current working draft". The user can remove the chip, or change the range to the whole film.
- **Slide annotations**: when the user annotates an element or area in the slide tab and clicks "Add to conversation", "Slide annotations · N" appears above the input box. Opening it lists each annotation's position and comment; the user can remove them one by one or all at once, and clicking one jumps back to that page. A message with annotations only, and no text, can still be sent; its body is the fixed sentence "Please revise according to these slide annotations." After sending, the annotations are shown with the message and can likewise be opened and jumped to (slide design §8.2).
- **Design annotations**: the same approach, using the design tab to annotate elements or areas on the artboard. Above the input box there is a separate "Design annotations · N"; clicking one opens that design and locates that artboard. With annotations only, the body is "Please revise according to these design annotations." One message can carry both slide and design annotations at once, and each numbers from 1.
- **Design system annotations**: the same approach. In the design system tab, the user opens "Annotate" (or presses C), then clicks a token, text style, component, asset, usage note, section heading or cover to write a comment. Above the input box there is a separate "Design system annotations · N"; clicking one opens that design system and locates that target. With annotations only, the body is "Please revise according to these design system annotations." Like slide and design annotations, it numbers from 1 on its own.
- **Access mode**: Supervised, Auto-accept edits, Auto (default), Full access (§7.1). Each session sets its own mode and can switch at any time.
- **Skill**: choose one skill for this message (§6.9).
- **Execution engine**: lists only agent engines and models that have been verified to work. When switching engines, the session's goal, constraints, video state and latest receipts are handed over as a summary; the app does not claim that the native session carries over verbatim.
- **Icons and narrow input area**: the collapse button of the execution engine picker, and every engine in its menu, shows the provider's icon; custom engines added by the user show the first letter of their name. When the input area's own content width is under 520px (the home page and session input area are the same; judged by the input area's width, not the window width), access mode shows only its icon (the hover hint and accessibility label still carry the full name), and the execution engine shows only its icon plus the model tier (such as "Sonnet", without the version number). When following the engine's default model, it shows "Default". Names that consist only of vendor and version show the vendor name (for example "GPT-5.5" shows "GPT"). Unrecognised model names (for example a fully lowercase model id) are shown as-is and truncated if they do not fit.
- **Send and stop**: while a task is running, the send button becomes Stop (§3.2.6).

#### 3.2.4 Sync before sending

When the user submits a request, the local changes that this request's references depend on must be written to disk before the agent starts reading the context.

- While waiting, the input box shows "Saving changes for this request's references".
- If saving fails, the specific object and how to continue are shown. Text the user has already typed is not discarded, and the request is not submitted with stale context.
- For a gesture or IME composition that is in progress and cannot end safely: show a wait prompt, cancel the send, or explicitly exclude it. Do not silently commit half a drag just to send the message.
- Only changes related to this request are waited for; unrelated background tasks keep running.
- After sync completes, the bound version is shown. Afterwards, moving the playhead does not change the task goal [AT-11].
- Reference chips for working drafts, candidates and history versions must be distinguishable. A candidate must be referenced explicitly and is never treated as an applied working draft.
- On receiving "Input expired" or "Version conflict", keep the candidate and the user's input, re-locate, and do not automatically switch to a neighbouring clip.

For the mechanism, see architecture design §4.6.

#### 3.2.5 Additions, queueing and redirection during a long task [CON-03]

- Input can continue while a task is running. If the agent engine supports mid-run interjection, the message is delivered directly; if not, it is queued until the current turn ends, or the user can choose to interrupt and then run it.
- When the user changes the goal, they choose "Stop the old work" or "Keep the old output as a candidate", and then a new execution attempt is started.
- Steps whose inputs are already frozen do not change content mid-execution; new constraints apply to steps that have not yet started.
- Local manual operations do not interrupt unrelated tasks.

#### 3.2.6 Stop [CON-04]

The main stop button stops the **task**, not just the reply:

1. Immediately forbid new tool calls and automatic application;
2. then request cancellation of the steps and model turns in progress.

The stop confirmation must honestly list: changes already submitted (they do not disappear automatically), steps that may still be running or billing on the remote side, and results kept as candidates. A stop being accepted does not mean the remote side has been cancelled.

The detail menu offers two secondary actions: "Stop reply" stops only the current model output; "Cancel this step" cancels only one computation. "Stop and undo" first sets up a stop barrier, then verifies item by item which changes can be safely undone; it does not roll back the whole video. "Pause" is offered only for tasks that truly support safe resumption.

#### 3.2.7 Next steps after delivery [CON-05]

After a task completes, the export row on the video card provides play and "Show in folder", and "Open editor" continues editing. A small number of to-dos found by this check are written in the reply. No new purchase or generation is started automatically.

### 3.3 Feature area [UX-07]

The feature area is the third column of Home, on the right of the session area; each open object gets its own tab. It opens on demand: opening a video from the session, clicking an object on a card, clicking an output, or the user opening it manually. With no content it stays collapsed and the session area fills the space.

| Open object | What the feature area shows | What can be done |
| --- | --- | --- |
| Video | Full editor (§5.1): preview, inspector, timeline, content panel | All editing operations; select objects, drag-select time ranges, select sentences and reference them in the input box; export |
| Candidates and changes | Review view: candidate comparison, list of editing suggestions, before/after changes | Apply, keep as an alternative, discard; accept or ignore each item; undo a particular change |
| Output | Same viewer as Space: images, audio, subtitle files, documents, final cut | View, preview audio, save as, re-edit, show in Space |
| Task | Current task's stages, steps, cost, check report | Expand details, cancel a particular step |
| Project files | File list and search for the project directory; choose a viewer by type; entered from "Browse project files" on the new-tab start page | Read-only browsing of the various files produced by the agent; show in folder |
| Slides | Slide editor: page list, canvas, speaker notes; opened from a slide card in the thread, a Space entry, or the file tab for `deck.json` | Preview and present; edit text, drag elements, add or remove pages, with changes written back to the deck directory; after opening "Annotate", click an element or box area to write a comment, which is added to the input box as "Slide annotations" (§3.2.3, slide design §8) |
| Design | Design editor: the canvas lays out the artboards, with a property panel, preview and export; opened from a design card in the thread, a Space entry, or the file tab for `canvas.json` | Preview artboards, change styles and text, arrange artboards, with changes written back to the design directory; after opening "Annotate", click an element or box area to write a comment, which is added to the input box as "Design annotations" (§3.2.3); "Export" in the tab header saves the whole design as a single HTML or PDF file: on desktop a save dialog opens and then shows the path, and on web the browser downloads it. The web editor runs on a separate loopback hostname; when the page is not on `127.0.0.1` or `localhost`, the tab shows that the feature is unavailable |
| Web page | In-app web tab, http and https only; a new one shows the start page first | View links and materials given by the agent; open in the system browser; from the start page, create a new web page or browse project files |

The feature area can have several tabs open at once. In-app web pages are isolated from the app's own interface and have no access to local services (architecture design §12.10).

File links in a reply open a file tab in the feature area, without navigating or refreshing the main interface. Relative paths resolve against the session's working directory; registered deliverables are located by their output records, including files in the downloads directory; files handed over by the agent with `downloads_save` are also registered as deliverables. On desktop, a document or media copy outside the working directory that has no output record is still opened in a file tab as a read-only preview (the Runtime grants restricted handles to the desktop client only, based on each file's own directory). The tab keeps "Open with default app" and "Show in folder". Only types the viewer does not support are handed directly to the system default app. The browser does not have this capability: the viewer reports it as unavailable according to the Runtime's access scope, without widening local file permissions. Markdown images and audio/video in the reply body follow the same locating rules: on desktop, local images outside the working directory with no output record are shown directly in the body; the browser reports them as unavailable.

File types are identified first by sampling restricted content; the extension is used only for choosing a text view and for compatibility with old Runtimes. Readable text with unknown or no extension is shown as source; images, PDFs and audio/video use the existing viewer matching the detected type; unsupported binaries or archives show only basic information and a "Show in folder" entry, without forced decoding or launching a program. Missing files, read failures and files over the preview limit each use their own error message. When a link outside the working directory cannot be opened safely with the default app, desktop falls back to locating it in the file manager; web has no local file manager capability.

Read-only previews of common documents: PDF with page turning and zoom; HTML page preview with a switch to source (isolating scripts, network, forms and parent-page navigation); CSV / TSV tables with a switch to source (preserving separators and line breaks inside quotes); JSON formatted with a switch to source; code text viewed with line numbers. Markdown keeps reading and source views. When preview or parsing is not possible, the reason is stated, and the original text or the system app entry is kept. Electron and web share the viewer. PDF limit is 100 MiB, text limit is 1 MiB, and tables over 2000 rows or 200 columns show source. PDFs support text selection; encrypted or unparseable files report failure, and on desktop can be handed to the default app. Inline preview of DOCX / XLSX is outside the scope of this batch.

Image files and generated images enter a dedicated file tab: candidates in the same group switch via thumbnails, and switching syncs the tab name and the current file information; standalone images are not mixed into other groups. Provides fit-to-window, proportional zoom, drag to pan, download, and a system default app entry. Image annotation supports selecting or box-selecting areas, editing and deleting; coordinates are normalised relative to the original image, so marks do not drift when zoomed, and switching images keeps saved annotations and unfinished annotation drafts. Annotations and aspect-ratio adjustments (1:1, 3:4, 9:16, 4:3, 16:9) append the original image and the request to the session draft; they do not overwrite existing text or attachments, do not send automatically, and do not overwrite the original image. Images in chat can be enlarged for viewing and opened in a tab from the viewer; video can play in the body and enter a standalone file tab. Video provides play, progress, volume, playback speed and fullscreen based on the real media state; opening another media item or hiding its tab pauses it. The media panel is shared by Electron and web. Candidates are grouped by the same reply or the same generation task. Adding image requests is limited by the host's current attachment capability and the Agent's image capability; when not supported, viewing and annotation are kept and the reason is stated.

Media viewer: image zoom covers 10%–400%, supporting zoom around the pointer or the center of a two-finger gesture. Generated images in the same session support single-image and canvas views, multi-select and cross-image annotation; standalone images stay independent. Brush, rectangle, arrow and text marks generate a second reference image; erasing generates a black-and-white mask for removal; background removal and aspect-ratio adjustment generate explicit requests. All editing requests are appended to the session draft together with the required original, marked image or mask; attachments are de-duplicated and checked against the count limit. On failure the edits are kept; nothing is sent automatically and the original is not overwritten. GIF supports frame-by-frame viewing, pause and speed change, a frame grid, per-frame annotation, copy or download of the current frame, and download of the speed-changed or original GIF. Frame splitting is limited to 64 MiB, 256 frames and 64 Mi pixels cumulative; when the environment does not support it or the limit is exceeded, the original can still be viewed and downloaded. When the user explicitly chooses equirectangular panorama viewing, the image can enter 360° viewing, with drag-to-look, zoom, reset and fullscreen; on failure it can return to a normal image. Video body, tab and expanded overlay share the same player and playback state (time, pause, volume, mute, speed). Dragging the progress bar pauses playback, and after it ends the previous state is restored. Speed is 0.25×–2×. Fullscreen, picture-in-picture (subject to environment capability), and save-as are provided. An explicit handoff from the body to a tab or overlay keeps playback going, while an ordinary tab switch still pauses it; closing the overlay returns the latest state. The audio body card has two rows: on top, a file icon, file name and format, the play button and the more menu; below, progress and time. The more menu offers copy path and save a copy. Under the video picture, only a single row remains: play, progress, time, volume, more and fullscreen icons. The volume slider is inside the overlay; save-as, speed and picture-in-picture are in the more menu, with the current speed marked as selected. The existing expand-preview and tab entries are also moved into the menu. Narrow sessions do not fold controls into multiple rows, and the fullscreen menu is shown inside the fullscreen container. The image body uses a large image up to 480px with a 56px-wide vertical thumbnail strip on the right; switching within a group keeps session routing, and thumbnails provide a selected state and arrow-key and Home/End navigation. A single image does not show an empty thumbnail bar. Clicking the large image opens a full-window viewer with a blurred background, where the left thumbnails, top view / zoom / open / download / close controls, bottom editing tools and the image-change input area are layered separately. Esc or the close button returns to the original session and original focus; the selected image is synced back to the body. Change requests are kept as a draft per image, and the image and request are attached only after the user explicitly adds them to the conversation draft; nothing is sent directly. Existing file links still open the right-hand tab directly, and the viewer's open menu also provides that entry. The prototype, Electron and web share these interactions; the App and web use the shared UI implementation, and the default app and system folder operations are provided according to host capabilities.

Attachments in the Composer and attachments in sent messages can both be opened by click or Enter, with preview actions separated from the delete button. Image attachments use the same immersive viewer and can switch within the current attachment group; reference images added to the Composer from image edits also remain openable. User-uploaded files keep their actual content and type. PDF, HTML, tables, code text, audio and video in a session enter the corresponding right-hand file tab; before a session is established, the attachment popover is used. Attachment preview is independent of Space outputs: sending, removing a draft attachment, or switching tabs does not destroy file content still referenced in advance. Old attachments without content prompt the user to choose the file again; unknown binaries keep a download entry. The above attachment interactions are synced between Electron and web. On desktop, ordinary local path references preview first in a restricted file tab; files outside the working directory also preview in a file tab, with a default-app entry in the tab. Uploaded attachments are always read through the restricted handle of their owning session.

Web page tabs keep their own page, history and zoom state; switching tabs does not reload them. The address bar supports URLs and search, back, forward, stop, reload, and reload ignoring cache; the address can be copied, or opened in a new tab or the system browser. In-page find shows current item / total, with previous, next, Enter / Shift+Enter and Escape. Device preview supports phone, tablet, laptop, custom width and height, and rotation between portrait and landscape. When loading is slow, fails, a popup is blocked, or a download is handed to the system browser, a clear status and a recovery entry are shown; download and permission boundaries still follow architecture design §12.10. On Electron, both the web content and the toolbar support Cmd/Ctrl+L, Cmd/Ctrl+F, Cmd/Ctrl+R and Cmd/Ctrl+Shift+R; HTTP/HTTPS links in a web page opened from a session go into a web tab. The device viewport width and height are each 240–4096 CSS px and are scaled down proportionally to fit the panel space. The web client has no embedded web host, so web page tabs follow the entry capability: the start page and tool cards display as usual, and external web pages open in a new browser tab; the prototype presents host behaviour as a demo page.

**New-tab start page**. A newly opened web tab with no address yet shows the start page. The address bar is kept as usual. The body has the prompt "Search or open a web page" and an "Enter URL" button (which moves focus to the address bar), and below it a group of "Tools" cards. "New web page" creates an HTML file in the session's project (if there is no project, in the session's working directory; it does not clash with existing file names in that directory) and previews it in this tab. "Browse project files" views the project directory in this tab. A blank draft with no session and no project does not show the "New web page" card. Both actions replace the start page in place with the corresponding file or project-file tab, keeping its position, and no empty start page is left behind.

Rules:

- After a video is opened, the session stays on the left and the full editor is on the right. This is the same component set and the same layout as opening the same video from Space; there is no separate slimmed-down editor.
- The feature area can be closed, returning to a session-only state; selection, playhead position and uncommitted drafts are kept.
- **Three views**. Each session remembers its own view and tabs; a draft workspace that has not yet sent its first message also has its own tabs and view, and these travel with the session once the first message is sent and the session is created.
  - **Session**: the feature area is collapsed and the session fills the space; open tabs are kept.
  - **Split**: the session is on the left and the feature area on the right; on the title bar, the session header and tab strip are separated by the divider between the two columns.
  - **Full view**: a single-column tab strip (see below), with the session as the fixed first tab. On entry, the content on screen is kept: if the split was visible, it stays on the current tab; otherwise the session tab is selected. Exiting returns to split: the session on the left and the last tab on the right. Closing the last tab exits full view and returns to the session.
- **Title bar button group**. From left to right at the far right of the title bar: session summary, full-view button and tab button. In a narrow window only the session summary is kept.
  - The tab button changes with state: with no tabs, it is a tab-frame icon with a plus sign, and "Open new tab" opens a new web tab and shows the split. With tabs and the split collapsed, the tab-frame icon shows the number of tabs (over 9 shows "9+"); "Show tabs" restores the split and the last tab. Hovering for 300 ms, or pressing the down arrow key, lists the open tabs; clicking a row opens it in the split, and the button at the end of the row opens it in full view. When the split is visible, the button becomes "Hide tabs", which collapses the feature area and shows no count and no list. In full view, the same icon means "Enter split view".
  - The full-view button appears only when there are tabs; in full view it shows a pressed state, and its hint changes to "Exit full view".
  - Session summary: when the split is visible, it sits after the session header's ··· button, on the left of the divider between session and feature area; in other cases it is the first item of the button group. A draft with no session does not show it. The popover is 360 wide and lists the session title, status (in progress, awaiting permission), "Outputs · N", and the session-wide output cards (video cards in §3.2.2). With no outputs it reads "This session has no outputs yet." The session header has no separate output entry.
- **Tab strip**. The "+" at the right end of the tab strip opens a new web tab (start page) directly, without a menu. The list of open tabs is provided by the tab button; the tab strip has no separate list. Hovering over a tab for 500 ms shows a thumbnail card of that tab's content: thumbnail, title and path (a web page shows its address, a file shows its project path, and a session tab shows "Session"). Pressing or dragging a tab cancels it, and while the thumbnail card is shown the tab's own hint does not appear. When a native web view cannot be captured, the thumbnail is left blank. On desktop, while the thumbnail card is shown, the web view is temporarily hidden (as with menus and dialogs) and restored after the card disappears.
- **Drag to collapse**. In split view, the divider between session and feature area is not limited by the session's 560px / 45% width cap. The minimum normal display width for each side is 320px. Once the feature area reaches its minimum width, it keeps tracking the pointer; when the remaining space on the right drops below 160px, the feature area is hidden and the session fills the space. Dragging back to the left in the same gesture can re-expand it. Collapsing does not close tabs, change the route or clear the draft; "Show tabs" from the tab button restores the last usable split width. When the workspace itself narrows, the narrow-window rules below still apply. The prototype, Electron and web use the same interaction.
- **Single-column tab strip**. Full view and narrow windows share the same tab strip, and only one of the session or one tab is shown at a time:
  - The session is the fixed first tab in the strip and shows the session title. It cannot be dragged, closed, or moved in front of other tabs by them. Visually it must be distinguishable from resource tabs (an accent-coloured background and outline, a separator from draggable tabs, with no added icon), and its hint says it cannot be dragged or closed. When the session is in progress or awaiting permission, the tab carries a status marker that does not rely on colour alone.
  - The session header (title, status, menu) moves from the title bar to the top of the session panel.
  - Switching happens only when the user clicks a tab, card or "Open editor"; route changes caused by the agent must not switch away from the session.
  - The hidden side is not unmounted: session drafts, editor selection and playhead position are all kept.
- **Narrow window**. When the workspace is too narrow to fit the session area and the feature area side by side (session minimum width 320px plus editor minimum width 695px, that is a container width of 1015px; the prototype approximates with a container width of 960px; neither changes with the session width during dragging), the single-column tab strip is used. In this case:
  - At the moment of switching from side-by-side to single column, the tab is chosen by focus: if focus is inside the session area (including the input box), or the feature area was already collapsed, the session tab is shown; otherwise it stays on the tab in use.
  - Switching from single column back to side-by-side restores the session area and the last tab; only if the user manually collapsed the feature area while side-by-side and stayed on the session tab for the entire single-column period does it remain collapsed.
- When the preview is showing a candidate plan, the top must state "Candidate plan"; when showing the current working draft, no extra flag is added. The title of an open object states its name and version.
- Manual edits made from Home and from Space are equivalent: the same command entry point, with the same receipts and undo.
- Region selection on the canvas only indicates pixel position and does not automatically become an editable object.
- P0 supports selecting objects, dragging to select time, and referencing sentences. Free-form painting on the canvas, voice feedback and multi-region annotation are P1.

---

## 4. Space

### 4.1 Positioning〔SPC-01〕

Space is the unified view of videos, assets and other outputs: every generated result and every video can be seen, opened and continued here. It is organized by outcome, not by session.

Space is a derived view, not a second store. Its entries come from the authoritative video, output and task records in each project; the index can be rebuilt if it is corrupted, and rebuilding does not lose the user's favorites or organization.

### 4.2 Entries

| Type | What it is | Opens to |
| --- | --- | --- |
| Video | An editable, exportable video with a full timeline. The cover uses the current working draft | Full editor, with the session on the left (same as opening from Home) |
| Final cut | An exported video that has been verified and published, bound to a fixed video version | Player |
| Video asset | A generated or imported video file | Player |
| Image | Covers, illustrations, generated images | Image viewer |
| Audio | Voiceover, music, sound effects | Audio player |
| Subtitles | Exported subtitle files | Script viewer |
| Document | Scripts, storyboards, articles, summaries | Text viewer |
| Portable package | An exported video package | Package contents list |
| Template〔P1〕 | A reusable native structure or code package | Template preview and parameters |

A project is not an entry: it is the source of entries, used for filtering and grouping (§4.3).

Only results that the user can recognize enter Space. Derived artifacts such as proxy files, thumbnails, waveforms, caches and check screenshots are not shown as entries.

Generations in progress appear as placeholder entries showing their task and progress, and turn into the result in place when complete.

### 4.3 Browsing

- **Category sidebar**: All, Videos, Final cuts, Images, Audio, Subtitles, Documents, Slides, Design files, Templates (P1); Favorites; Trash. Slides and design files are each a directory, one entry per file; clicking one opens it in the matching tab in the function area.
- **List area**: search; sort by recent activity, creation time, update time, name, type; creation and update times default to descending (newest first), entries with unknown times go last, and entries with the same time keep their original order; filter by project and status; grid and list views.
- **List columns**: name, duration, type, source, specs, status, recent activity. Duration is a primary fact for videos, final cuts and audio and must be shown: in the list, “Duration” follows the name directly, and grid cards carry a duration badge at the bottom-right corner of the thumbnail; secondary facts such as resolution, file size, sentence count and row count belong under “Specs”, and the card's description line reads “Type · Specs”.
- **Thumbnails**: grid cards and the list's name column both show thumbnails: for a video, the cover frame; for a final cut, video file or image, one of its frames; for documents and subtitles, the opening text; everything else shows a type icon. The list view therefore uses generous row height.
- Videos, final cuts and outputs that belong to the same project can be viewed grouped by project.
- **A video appears only once**: files exported from a video, or generated or downloaded for it (final cuts, subtitles, scripts, images, audio, source files), are folded into that video under “All” and “Videos”, and do not get their own cards or rows; the counts for these two categories in the sidebar are counted per video. The card reads “N files”; the list writes the count and a per-type breakdown under the name. When a video has no status of its own, its status is taken from the file under it that most needs attention, in this order: generating, failed, missing, source changed. Search and status filters also look at the files under a video: a video matched only through its files is still listed, and states which file it matched; “No status” looks only at the video itself. “Recent activity” sorts by the most recent time among the video and its files. Browsing by type, Favorites and Trash still list files one by one; templates are not folded; files in Trash are not folded; when a video is missing or in Trash, its files appear individually (§4.9).
- **Each cut-out short video is its own video**: sub-videos (§2.3) are independent video entries and are not folded into the parent video's card. The parent video's card and list row read “N short videos”; clicking it filters the list to the short videos cut from that parent, and the filter shows as a removable tag; the “Cut-out short videos” section in the parent video's viewer, with its “View in list” (§4.5), filters the same way.

### 4.4 Status and Source〔SPC-02〕

Every entry can answer three questions: where it came from, what state it is in, and which version it corresponds to.

| Status | Meaning |
| --- | --- |
| Generating | The owning step is still running |
| Candidate | Generated, not yet applied to the video |
| Applied | Entered the video's working draft through a transaction |
| Published | A final cut or file that has been verified and published |
| Source changed | The inputs this result was based on have been modified since. The result is still usable but no longer represents the current video |
| Missing | The file or an external dependency is currently unavailable |

- Source information includes: project, video and version, session, task, generation service and model (if any), and cost status (estimated, reported or unknown).
- The source of a sub-video is “Derived”; the “Source” column reads “From "[parent video name]"” ([Architecture Design §5.7](../architecture/architecture-design.md#57-space-directory)).
- A candidate is not shown as a final cut; an unpublished export is not shown as completed.
- A final cut is bound to the video version frozen at export time. When the video is changed afterward, the final cut is marked “Source changed” and offers “Re-export from current version”.
- Failure and redo are reached from the entry's menu: a video that has been transcribed offers “Re-transcribe…”; one whose transcription failed offers “Retry transcription…” and is listed first; one with footage but no transcription yet offers “Transcribe…”. All three open the transcription tool page with this video preselected; “Retry transcription…” additionally carries the failed run's task, prefilling its parameters and showing the failure reason (§2.7, “Progress and failure”). Videos that are being transcribed, queued, or whose source file is missing do not offer these. Entries that are generating offer “View task”.

### 4.5 Opening and Viewing

- Videos and audio use the player; images, subtitles and documents use their respective viewers. The top of a viewer shows source and status.
- Viewers provide: save as or show in file manager; continue in a session; process with a tool… (lists the tools that accept this entry; selecting one goes to the tool page with the input already chosen, §2.7); secondary edit; view the source session or task (for entries generated by a tool, it records which tool made them and which directory they landed in, and offers “Do again”: direct tasks and file transcodes return to the tool page with parameters pre-filled, and video tools open that particular run); favorite.
- A video's viewer lists the files under it; clicking one swaps to that file's viewer. The viewer of a file that is folded into a video provides “View video” to return to that video.
- A video that has had short videos cut from it shows “Cut-out short videos N” in its viewer, before the files under it: the ones not moved to Trash, with the newest first; each row shows a thumbnail, name, its range in the original (“Original 10:12–10:58”), duration and status; clicking one swaps to that short video's viewer. At most 6 are shown; if there are more, it reads “N more, view all in list”, and the “View in list” at the top right of the section filters the list to that parent video (§4.3). The viewer of a short video provides “View source video”, which switches back to the parent video's viewer if the parent still exists and is not in Trash.
- Video entries go directly into the full editor (§5): the editor opens the same video exactly as it does from a session on Home; the only difference is where the session sits. When entering from Space, the session is the floating session at the bottom right (§5.1), starting as a new empty session.

### 4.6 Secondary Editing〔SPC-03〕

| Opened entry | How secondary editing works |
| --- | --- |
| Video | Full editor, modify the working draft directly |
| Final cut, with a source video | Return to the source video's full editor. If it is no longer the version the final cut corresponds to, show the differences first; you may open the current working draft, or create a checkpoint from the version the final cut corresponds to and continue from there |
| Final cut or video asset, without a source video | Create a new video using it as material. It is a flat video: subtitles, overlays and cuts can be added, but internal layers cannot be restored (§5.6) |
| Image | Manual changes such as cropping and annotation; model-dependent changes such as matting and erasing are offered as capabilities allow. Can also be handed to an agent for modification |
| Audio | Trimming and preview; regeneration is handed to an agent, or redone with the tool that generated it |
| Subtitles, documents | Edit the text directly; can also be translated or voiced with tools; subtitles can be paired with media to create a new video (§2.7) |

Rules:

- Outputs are immutable. Secondary editing of an output produces a new version or a new output and does not overwrite the original entry; the original remains in history.
- Secondary editing of a video is an ordinary video transaction, with a receipt, and can be undone.
- Secondary editing that depends on a model, uploads, or costs money follows the authorization rules in §7 and is no different from initiating it in a session.
- The session on the left of the editor belongs to the project the video is in, and also appears in Home's sidebar.

P0 provides secondary editing for videos, final cuts, subtitles and documents; model-assisted modification of images and audio is P1.

### 4.7 Continuing in a Session

From any entry, a session can be started or resumed, and the entry is brought into the input box as a reference tag. If the entry belongs to a project, the session is filed under that project; otherwise it is a session with no project. “Hand to agent” from a tool result page or task details follows the same path, and additionally prefills one editable sentence of instructions in the input box (§2.7).

- What is brought in is a reference to the entry: its name, location, kind, source and status, not the file contents. The reference is sent to the agent with the user's next message; the agent reads the content itself when it needs it. It can be removed from the input box before sending.
- When no session is specified: for an entry in a project, a new session for that project is created (sessions within a project each have their own topics, so it does not guess which one to continue); an entry not in a project returns to the session that produced it, and if that session no longer exists, a new one is created.
- When an existing session is specified, that session must be able to see the entry (same project, or the same session working directory); otherwise the reason is stated.
- Entries in Trash must be restored before they can be brought in.

### 4.8 New and Import

Space's “New” offers: create an empty video, create a video from a file, import footage. When creating, choose which project to put it in, or create a new project. Importing footage and placing footage on the timeline are two separate actions (§5.9).

### 4.9 Organization and Deletion〔SPC-04〕

- Rename, favorite, move to Trash, restore from Trash.
- Deleting an entry, deleting a video, deleting a project, clearing cache, deleting a session and deleting a model are distinct operations, and the interface expresses each separately.
- Before deleting an output entry, check whether it is still referenced by a video, history, a frozen task or a template. If it is still referenced, the sole source is not physically deleted; the interface explains the reason and impact.
- Deleting a video moves the whole video to the project's Trash, where it can be undone and restored. Linked original source files stay where they are; deleting and later physical deletion never touch them. Entries exported or generated from this video remain in Space, and deletion lists them. Sub-videos cut from it (§2.3) are not deleted with it: the confirmation has an extra line stating how many derived videos there are and that each is kept; afterward the sub-videos' banner is rewritten to “Source video is no longer in the video library” and no longer offers “Back to original” (§5.10). A video cannot be deleted while it is open in another window, while a task or export is running, or while it is held by another program; the interface explains the reason.
- Content in Trash can be restored within the retention period. The retention period is a preference, 30 days by default; after it expires, only entries with no references are physically deleted, and entries still referenced stay in Trash with an explanation. When a video's directory contains files that are not part of the video, that video is not physically deleted.
- Local deletion does not claim to be able to recall copies already sent to external services.

---

## 5. Editor

### 5.1 One editor, two entry points

The editor is made up of the preview, timeline, script, inspector and content panel, and it opens one video. Home's ribbon and Space use the same components, the same layout, the same video data and the same command entry point: both are the full editor, and both carry a session for this video. The two entry points differ only in where you come from, where you return to, and where the session sits: when opened from a Home session, the session is on the left; when opened from Space, it is a floating session in the lower right corner.

Division of areas in the editor:

| Area | Responsibility | Core actions |
| --- | --- | --- |
| Video bar | Video name, current version, save and task status | View history, switch versions, export |
| Preview | View the working script and candidates | Play, seek, before/after comparison, click to select objects |
| Inspector | What can be edited for the current selection | Edit text, style, parameters, position, sound |
| Timeline | Precise positioning and direct editing | Select, trim, move, link, keyframes |
| Content panel | Assets, script, subtitles, AI tools, translation, voice-over | Search, review, audition, proofread, cite; launch tools (§5.10) |
| Session (left, or floating in the lower right) | The session for the project this video belongs to | Start tasks, add constraints, approve, stop; can be collapsed |

When switching between Home and Space, or collapsing or expanding the session, the selection, playhead position and unsubmitted drafts are kept.

**Stacking order.** Which picture covers which is determined by track position: on the timeline, picture tracks higher up are in front, and clips on the same track do not overlap in time and are arranged in sequence. Users do not need to know this rule to change front and back. Select any picture element on the canvas, and the “层级” (Layer) menu in the toolbar offers four actions: Bring Forward One Layer (⌘↑), Send Backward One Layer (⌘↓), Bring to Front (F), Send to Back (B). If the element shares a track with other clips, it is split onto a newly created adjacent track, and the other clips stay put. If it occupies a track alone, the whole track (together with the clips on it at other time spans) swaps with the adjacent track, or moves to the very top or bottom. When already at the front or back, the menu items are greyed out. On the timeline, you can also drag a track header directly above or below another track, and the picture stacking changes accordingly. Picture tracks and subtitle tracks form one stack and can be interleaved (drag a waveform or sticker above a subtitle, and the picture covers the subtitle); subtitles are not automatically kept on top. Audio tracks form a separate stack and are ordered only among audio tracks. Both approaches are a single undo step (command protocol spec §4.2 `arrangeItem`, `moveTrack`).

**Audio row.** The video's own sound follows the video row and does not get its own row. The audio track the engine creates by default for each video is empty until audio is placed on it, and the timeline does not draw it: audio tracks with no name and no clips are not drawn, while named ones (ones you create yourself, or ones voice-over creates) are drawn. Audio still lands on it when placed, and the row appears once it contains something.

**Row height and headers.** Picture rows that show video need a filmstrip and original-audio waveform, so they are taller. Other rows (image, text, audio, voice-over, subtitles) show no thumbnails and are as short as subtitle rows. Subtitle and voice-over row headers carry language labels (ZH, EN, PT-BR), which fit in any interface language. Source subtitles use the subtitle icon and translations use the translate icon; the full name and source or translation are given in the hover tooltip. When several rows of the same kind share a label, they are numbered in order (EN 1, EN 2); rows with no language keep their full name.

**Deleting and closing gaps.** After deleting selected clips (Delete, the delete button on the transport, the inspector, the context menu, or the canvas toolbar), the parts of the removed span where all tracks are empty are closed: later content moves forward and the total length shortens. If other tracks still occupy the span (for example a text clip, a self-placed audio clip or voice-over), a gap is left. Subtitles that follow their video only count as occupying where the video they follow still exists: if the video is deleted, the stretch of subtitles goes with it; subtitles that do not follow video (for example imported subtitle files) count as a whole span. Background sound and vocals separated from voice-over follow the picture and do not count as occupying; when closing, they are removed along with that span. Box-selecting on the timeline does not select an entire subtitle layer (dragging across a subtitle row only selects clips on other tracks); to delete a whole subtitle layer, click the subtitle row. The context menu item “从所有轨道删除这一段” (Delete This Span From All Tracks, ⇧Delete) removes the time covered by the selected clips from every track: clips straddling the edge are trimmed where they fall inside the span, and later content moves forward, the same as box-selecting all tracks and deleting. It is unavailable when only subtitles are selected, because subtitles fill the whole track. In both approaches, chapters move forward as they do for “剪掉一章” (Cut a Chapter): a chapter that falls inside the removed span moves to the start of the span, and a chapter wholly inside the span is deleted. Deleting and closing gaps is one transaction with one undo step. If there are locked tracks or clips after the span being closed, the gap is not closed; the deletion still happens, and a notice explains this. ⇧Delete does nothing at all if locked items are involved, and a notice asks you to unlock them first (command protocol spec §4.2 `removeRange`).

**Preview loading and stalls.** When the preview has no picture yet, do not leave a bare black frame:

- **Loading:** until a picture appears (the render kernel is still loading, or the media to be drawn at this moment is still arriving; if loading has failed, it no longer waits and draws what it can, with a notice explaining what is missing), an opaque dark panel covers the picture so the black frame shown while waiting for media does not show through. A spinner and “正在载入预览” (Loading preview) appear only if it is still not ready after 0.5 seconds, so quickly opened videos do not flicker. After a retry or after switching to another video, timing restarts from zero. When a dedicated notice card for unplayable main media is already showing, the panel no longer covers it.
- **Converting:** media the browser cannot play (for example, WebM that this machine cannot decode) must first be converted by the Runtime into a playable copy. During this, the panel shows “正在准备预览 · N%” (Preparing preview · N%) with a progress bar, names the media being converted, and explains that conversion happens only on first open, after which it plays directly, and the original file is not changed. The percentage is rounded down and shows at most 99% until conversion finishes; if the Runtime does not yet know the progress, only the title appears and the progress bar is indeterminate. The first 0.5 seconds stay quiet, as in loading, so short clips that convert quickly do not flash a progress bar. While progress is moving, it does not count as stuck; it counts as stuck in conversion only if progress has not changed for 10 seconds. While progress is unknown, it does not count as stuck (conversion has its own timeout, and failure goes to the unplayable-main-media card).
- **Stuck:** if the same step stalls for 10 seconds (the same threshold as the preview engine's stall diagnostics), a card appears in the center of the picture saying the preview is stuck, which step it is stuck on (the preview engine is still loading, still preparing this video, waiting on a media item (named asset), conversion of a media item has no progress (named asset), waiting on subtitles, waiting on fonts, or the picture has not updated), how many seconds it has been waiting (updated every second), and a “重试” (Retry) button. Retry only reloads the preview (render kernel, video, media addresses and elements) and does not change the video. When a dedicated notice card for unplayable main media is already showing, this card does not appear. The timer does not run and nothing is shown while the page is hidden. Development details (element states, unexpected errors) go only to the development log.
- The panel and cards take the pointer: clicking on them does not pause playback, and does not select or box-select picture elements underneath that you cannot see. The “重试” (Retry) button on the card remains clickable.

**Floating session.** Videos opened from Space have no left session bar; the session floats in the lower right corner of the editor:

- **By default it is an input box, not an icon.** Users can see that they can chat here without clicking anything. The input box does not take keyboard focus, so editor shortcuts keep working.
- **Minimizing is the user's choice.** It collapses to a floating icon only when the user clicks minimize, and this choice is remembered across videos. The icon shows a status dot when a task is running or awaiting approval.
- **Input footer bar.** On the left, choose the access mode; on the right, choose the agent provider and model, following the same pickers and settings semantics as the Home session. Leave enough margin on the left, right and above; the bottom sits tight against the toolbar with no extra space.
- **Sending opens a new session.** The typed prompt is sent as the first user message, and the app immediately jumps to the session area on Home to start the conversation. The session is filed under the project bound to the current video. If the video has no bound project, the session belongs to no project, shares the folder with the session of the video's location (§2.3), and appears under “最近” (Recent). The current video is carried in with the first message as a card; clicking the card reopens the editor. No empty session is created before sending; the selected provider, model, reasoning effort, access mode and attachments are all kept. When the video is opened from Space again, it still starts from a new session input box.
- When expanded, it does not cover the right-hand panel switch bar. Where it covers the bottom of the content panel, the user clears the space by minimizing.

### 5.2 Task layouts

Creating, reviewing and refining are three layouts of the same editor, sharing the same video and session; they are not three apps:

- **Create:** prioritize expanding the script and storyboard views.
- **Review:** prioritize expanding the script, candidates and suggestion list.
- **Refine:** prioritize expanding the inspector and timeline.

The system gives an initial layout by task type: when making a video, the script and storyboard are expanded; when cutting talking-head footage, the script is expanded; when making local visual edits, the inspector is expanded. Once the user adjusts the layout manually, the user's choice prevails.

### 5.3 Preview and context selection 〔UX-02〕

Canvas selection, timeline range selection and script sentence selection can all be sent directly to “让 CucCut 修改” (Let CucCut Edit). The selection becomes a reference tag above the input box (§3.2.3).

- A reference tag binds to a stable object, sentence or time range, along with the version at that time, not to a screen position.
- A phrase such as “第三句” (the third sentence) is resolved to a specific sentence at submission; later reordering of the list does not change the target of a task already submitted.
- Region selection on the video picture only indicates a pixel location and does not automatically create an editable object.

The strip along the bottom of the stage is a toolbar (prototype `designs/cuccut/app/stage.jsx`, `StageBar`). On the left are aspect ratio and playback speed, each shown as an icon plus its current value. On the right are subtitle visibility, volume and fullscreen, icons only.

- Aspect ratio: lists Original (same ratio as the video file; not selectable when there is no video file) and 16:9, 9:16, 1:1, 4:3, 3:4, 2:1, 2.35:1, 1.85:1, plus “自定义…” (Custom…), which accepts any `w:h`. Changing the aspect ratio changes the video's canvas: the short side stays the same and the long side is rounded to an even number, the same method as the inspector's aspect ratio, as a single undo step. A custom ratio whose long side exceeds 16384 pixels cannot be applied, and read-only videos cannot change ratio. The “平台安全区” (Platform Safe Zone) menu item is only available on portrait canvases and marks the area that platform buttons and text would cover on the picture.
- Playback speed and the fullscreen player share one setting, and changing it only changes how fast this window plays.
- Subtitle visibility only determines whether subtitles are visible on the stage (including temporary subtitles during transcription). It does not change subtitle tracks and does not affect export.
- Volume is only monitoring volume. It is the same as ↑ / ↓, M and the fullscreen player, and does not change the video's mix. Switching between voice-over and original sound is in the voice-over track header menu, not here.
- Safe zone, subtitle visibility and playback speed are all viewing states of this window: they do not enter the video, do not enter undo, do not affect export, and reset when switching to another video.

The preview can enter fullscreen playback (F, or the fullscreen button at the right end of the stage toolbar; prototype `designs/cuccut/app/player.jsx`). Fullscreen is only a way to view within this window. It does not enter the video, does not enter undo, and does not affect export:

- The picture is the preview itself, centered at the canvas aspect ratio and flush to the edges, with pure black outside it. No stage pick layer is drawn; a single click on the picture plays or pauses, and a double click exits.
- Control bar: progress bar (chapter ticks; hovering shows one frame at that point, its timecode and chapter), play, previous and next chapter, volume, timecode, subtitles, playback speed, shortcut list and exit. During playback, if the pointer stays still for 3 seconds, the controls fade out along with the pointer. The controls do not fade while the pointer rests on the control bar, while dragging the progress bar or volume, or while a menu or the shortcut list is open.
- Subtitles offer Off / Source / Translation / Bilingual steps, based on the subtitles actually on the picture, and show all by default. If subtitles are hidden on the stage, it starts from Off. The step applies only to this fullscreen session; on exit, subtitle visibility returns to the stage setting. Playback speed is shared with the stage toolbar and persists after exit.
- In fullscreen, the keyboard belongs to the player, and editor shortcuts (including undo and delete) must not take effect. Keys: Space / K play, Esc / F exit, ← / → skip 5 seconds, J / L skip 10 seconds, ⇧← / ⇧→ skip chapter, ↑ / ↓ volume ±10, M mute, C cycle subtitle step, Home / End to start and end, 0–9 jump to 0%–90%, ? open the shortcut list. When the browser allows locking Esc, pressing Esc with the shortcut list open closes the list first; when it does not, Esc exits fullscreen directly through the browser.

### 5.4 Working drafts, candidates and comparison〔UX-03〕

- When the preview shows a candidate, a clear “Candidate” badge must appear at the top. When it shows the current working draft (the default), no extra badge is added, since the title already states the name and version.
- When comparing versions, support synchronized playback from the same point in time, audio switching where needed, and jumping between edited ranges.
- When an edit changes the total duration, compare by corresponding content and anchors. Do not pretend that the same absolute second on both sides is still the same sentence.
- “Apply”, “Keep as alternative” and “Discard candidate” are three different actions. After applying, show the real commit result. If applying fails or the version conflicts, the candidate can still be viewed, but must not be marked as written to the video.
- A checkpoint is a named historical state. Returning to a checkpoint, or branching a new direction from one, are both explicit actions and do not overwrite history after the current working draft〔COL-03〕.

### 5.5 Fine editing and natural-language collaboration〔UX-04〕

The timeline is neither a hidden implementation detail nor an entry point that forces every user to learn it. Users can move clips, edit subtitles and adjust volume directly at any time; the agent gets these edits the next time it acts. Shortcuts, undo and established gestures should follow common conventions where possible, rather than reinventing every editing operation just to highlight the conversation.

Every edit comes with a receipt: which objects were actually changed, the impact on timing, the content affected as a result, and which changes can safely be undone〔COL-02〕. Undo can target a single edit, not only “undo the last step”. Before undoing, check whether any later edits depend on this one; if there is a conflict, state it and do not silently overwrite.

### 5.6 Editability levels〔EDT-01〕

Different inputs can be edited to different depths. After receiving an input, the system first produces an editability report; the interface shows only operations that have been verified.

| Input | What it can do | What it cannot do |
| --- | --- | --- |
| Native video objects (text, subtitles, shapes, clips) | Edit properties, position and timing directly | — |
| Code compositions with public parameters | Move and scale as a whole; change public parameters | No public internal details |
| Code compositions with source | All of the above, plus edit the source and publish a new version | Drag internal elements the way native objects are dragged |
| Flat video (final cut, screen recording, clips without source) | Cut, change speed, crop, overlay new elements | Modify existing text or layers in the frame |
| Audio or subtitles only | Serve as a time and text reference | Restore the corresponding picture |

Code compositions show three capability levels in the inspector: “Whole”, “Adjustable parameters” and “Author source”. When there are no public parameters, no ineffective sliders appear; when the source is unavailable, no button that pretends to restore the source appears.

Existing text in a flat video must not be treated as native text and edited directly. Visual changes can be achieved through overlays, replacing the original material, or a dedicated image-inpainting task, but this source and its limitation must be kept honestly.

### 5.7 Script editing modes

The transcript panel distinguishes at least four modes; the mode label is always visible.

| Mode | What it changes | Effect |
| --- | --- | --- |
| Edit source text | Transcribed text | Subtitle text and the translations that depend on it; does not change audio or picture |
| Edit translation / display | Translated or displayed subtitle text | Subtitles for that language; linked voiceover is marked as possibly out of sync |
| Edit voiceover script | The script to be spoken | The corresponding voiceover units must be regenerated |
| Edit audio and picture | Which content is kept on the timeline | Video, audio, subtitles and attached objects change together |

The same delete key means different things in different modes and must not take effect across modes without the user knowing. In “Edit source text” mode, deleting text does not cut the video. When re-transcription replaces the entire source text, see §5.11 for how translations, subtitles and voiceover follow.

Edits to narration cuts — in “Edit audio and picture” mode, cutting a segment, accepting a cut suggestion, restoring a cut point, or dragging the seam on the timeline to change a range — all make chapters follow their content, consistent with “cutting a chapter” and deletion on the timeline (§5.1): chapters after a cut segment move forward; chapters that fall inside a cut segment move back to the cut point; chapters that are cut entirely are deleted. On restore, chapters after the cut point move back; a chapter exactly on the cut point stays put (it may be the chapter whose opening was cut, and leaving it in place also keeps the opening from having a stretch with no chapter). Moving and cutting chapters are one transaction, undone in one step (video format spec §6.7).

During playback the transcript follows the playhead: the word being spoken is highlighted, words already spoken are greyed, and the current word stays at the vertical middle of the list. When paused, it does not scroll automatically. During playback, if the user scrolls away manually, following stops; it resumes when the user jumps within the transcript or restarts playback. Text without per-word timing (such as translations) follows only at paragraph level; per-word timing is not estimated from character counts. The subtitle list and the translation list highlight the sentence under the playhead; when paused, the highlight stays on that sentence; when the playhead falls between two sentences, nothing is highlighted. During playback, only that sentence is scrolled into view, not centered. When paused, there is no automatic scrolling. After manual scrolling away, following stops, and it resumes when jumping in the list or restarting playback, the same as the transcript.

The copy controls in the transcript panel header are two adjacent buttons. Clicking the copy button copies the full text with the remembered shortcut combination, and the tooltip states that combination; if nothing has been changed, the default is Markdown with all five switches on. The dropdown beside it opens “Copy settings”: format (Markdown / plain text), the same five switches as the “Transcript” page of export (metadata at the top of the file, chapter titles, paragraph timestamps, speaker, skip cut segments), a body preview and a copy button. The chosen format and checkboxes are remembered (stored on this machine, not in the project), so the next time you click the copy button or open “Copy settings”, you see the last choices. After copying, the notice states clearly what was included and its length, and includes a “Copy settings” link back to the dropdown. The full text is byte-for-byte identical to a transcript exported with the same settings (when there are several transcriptions, each is laid out in panel order and joined together, with the metadata at the top written only in the first one); the language follows the panel's current view (original, translation, or bilingual side-by-side). When only viewing translations, export cannot produce this (the transcript's main document only recognizes transcription and subtitles), so the panel lays it out with the same format: no metadata at the top, and cut portions do not appear. The paragraph and chapter menus include “By copy settings” and “Copy text only”; if both produce the same output, only one item, “Copy text”, is kept. This paragraph or chapter is written without title or metadata at the top; the body contains only the parts remaining on the timeline; times are moments on the sequence; this paragraph does not write a chapter title.

While transcription is in progress, the transcript panel switches to a read-only live transcript: recognized paragraphs appear one by one in arrival order, with no speakers yet. Clicking a paragraph jumps there; they cannot be edited and do not enter undo. As new paragraphs arrive, the view follows the latest; if the user scrolls up, it stops and offers “Back to latest”. When no paragraph exists yet, a placeholder is shown, with no promise that content will appear within a few seconds (some services only return everything at completion). During the first transcription no subtitle track exists yet, so the timeline draws a temporary row at the subtitle row's position: recognized paragraphs are drawn as usual, and the portion not yet transcribed is a “Transcribing” pending band; clicking it only moves the playhead. The temporary row collapses once the subtitle track is generated. Also only during the first transcription, the picture shows the already-recognized portion with the default subtitle style: when the playhead falls within a recognized paragraph, that paragraph is shown; the portion not yet transcribed shows no subtitles, and this does not enter undo or export. The subtitle panel, below the transcription progress, lists recognized paragraphs in arrival order, one read-only card per paragraph; clicking jumps there; following the latest and “Back to latest” work as in the transcript panel. When re-transcribing, only the transcript panel switches to the live state; existing subtitle tracks are unaffected. The live transcript is a projection of the task event stream, not project content; after transcription ends, the transcript written into the video is authoritative.

For a video that has been transcribed but has no subtitle track at all (transcription did not create a subtitle layer, e.g. importing from a link does not create one by default; or all subtitle tracks have been deleted), the timeline draws a read-only “Transcript” row at the subtitle row's position, so that you can see where speech occurs on a transcribed video. The transcript is split into sentences using the same segmentation as subtitles, one block per sentence, in neutral grey, distinct from subtitle colors; cut portions do not appear. It is not a track: it has no toggle, does not appear on the picture, does not enter export, and cannot be selected. Clicking a sentence only moves the playhead to the sentence start. The hint at the row header explains that it is read-only and says to generate subtitles from the Subtitles tab. Each transcribed asset on the timeline gets one row; after a subtitle track is generated, the row collapses, and an asset currently showing the temporary row from its first transcription does not get a duplicate row.

While the subtitle panel's translation is running, the panel header shows the language being translated and the progress. The same applies when the agent translates sentence by sentence (§3.2.2): it shows “N sentences in total” and “Agent translating sentence by sentence; written into the video once translation completes”. The progress bar is indeterminate, with no percentage shown. There is no “Cancel”; instead, it explains that this work is being done by one agent session, that stopping it means stopping that session, and it offers an “Open session” button.

### 5.8 Time display and input

- By default, seconds and readable timecodes are shown; during fine editing, video frames can be shown. Both displays read the same authoritative position.
- Input boxes and change cards show the owning sequence, the edit frame rate, the requested time and the actual landing point. When quantization occurs, the deviation can be expanded to view. A user seeing “10.000 seconds” should not be hidden the fact that the result actually landed at 10.010 seconds.
- The export window shows “Video edit frame rate” and “Output frame rate” separately. The default is inherited, but they can be chosen independently.
- Frame stepping indicates whether it is on the video grid or the output grid.
- Display truncation and zero-padding affect only presentation; copy and commit use exact values, and do not overwrite the original time with the three decimal places shown on screen.
- For sub-videos (§2.3), the transcript panel lists the full text of the parent video. Paragraph times follow this rule (tentative, §12): paragraphs within kept segments show the output-timeline time, consistent with the timeline; paragraphs entirely outside the clip show the source time, greyed out, labelled “Outside clip · source time”; paragraphs crossing a clip boundary show the output time of their first kept moment. The parent video's transcript is unaffected.

The time model is in video format spec §2.

### 5.9 Assets, styles and templates

**Assets**〔AST-01〕. Importing an asset and adding it to the timeline are two separate actions. The asset panel shows category, provenance, license or unknown status, availability and where it is used. When a file with the same name has changed content, it must be replaced as a new version; do not arbitrarily pick a similar asset to fix a missing item.

**Search and generation**〔AST-02〕. A searched candidate is not the same as imported, and even less the same as having a usage license. P0 accepts assets the user provides manually and generation capabilities that are already connected; external search and multiple asset libraries are P1.

**Subtitle properties**. A newly created subtitle by default replaces ordinary commas and full stops with spaces (for the display projection, see video format spec §5.6). After the user changes position, anchor line, horizontal position, width, bilingual top-bottom order, line spacing, early and late display times, punctuation or text appearance, these options are remembered, so newly created subtitles still use the last choices after a restart. Original and translation appearance are remembered separately, without carrying over language, subtitle text or per-sentence overrides. When opening an existing video, its saved style takes precedence. Subtitle clip start and end times and track membership belong to video content and are not treated as a preference for next time.

**Styles**〔AST-03〕. A style consists of theme, font, colour palette, layout, motion, sound, content elements and rhythm. Styles can be combined (for example hand-drawn, whiteboard, math, presentation) and do not form mutually exclusive workflows.

**Fonts**. There are three sources for selectable fonts: those shipped with the app, those installed on this machine, and those from the Google Fonts catalog (about 1,900 families, open-source licensed, downloaded on demand). Selecting a family not yet downloaded takes effect immediately: it is displayed with the fallback font first, and switches automatically to this font once downloaded. When a video is opened, or a preview or export uses families from the catalog, they are likewise downloaded automatically (this can be turned off in settings). Downloaded fonts are stored in app data, not in the project; their sizes can be viewed, and they can be deleted one by one or cleared all at once. Each family's license is visible when choosing the font. When a download fails (offline, auto-download turned off, service error), the fallback font is displayed and exported, and the panel states which family and why, without silently replacing it. Export is not blocked by this, and it does not require first choosing a substitute font (§8.1). The interaction of the font picker follows the prototype (architecture design §9.1).

**Templates**〔AST-04, P1〕. Templates save native structures or code packages and their public parameters. New instances do not modify the template's original version, and do not carry keys, private machine paths or unlicensed materials.

### 5.10 Tools and conversation

Polishing, chaptering, translating, dubbing, trimming and writing are **tools**. Each tool is defined once (parameters, scope, receipt, undo, review UI) and is reached from four places. By default, all of them hand the work to the agent. The editor's right rail has an “AI tools” tab, the third slot after the script and subtitle tabs. It is the catalog and host for tools, and every other entry point leads to it.

| Entry point | Behaviour |
| --- | --- |
| AI tools tab | The list page groups tools. Each row has a one-sentence description and this video's status: a running job's progress, the number of items waiting, and when it last ran. Opening a row goes to that tool's parameters page; “Back” returns to the list. A card at the top hands work that is not in the list to the agent in one sentence, opening a new conversation. When no agent is available, this card becomes a setup prompt. |
| Conversation | Type `/` at the start of the input box, or click “Use tool” in the input box, to list every tool this video can use. Selecting one sends an ordinary message: the agent takes over, and before it writes, the approval card lets you change the model and scope (§6.5). You can also describe the task in a sentence without naming a tool, and the agent picks one. |
| Panel where the work sits | Entry points with a scope stay beside the object they act on: the chapter and paragraph menus in the script panel (polish this chapter, re-transcribe this paragraph); the translation of a cut source sentence in the subtitle panel AI menu (“Process”); and trimming and dubbing from the media and timeline. Opening one switches to the AI tools tab and opens that page, with the scope already filled in. The per-sentence retranslate and the “Retranslate” action for stale translations in the subtitle panel do not switch away: they call the model directly or send to the current conversation in place (see “Per-sentence and stale translations” below). The script panel no longer has a whole-text tidy-up menu at the top; the tool list lives in one place only. |
| Agent | The agent calls the same tool itself during a task. When a result needs human review, it points to the matching review UI when it finishes. |

**Batches.** The first batch on the list page lists only the three groups that start from the script: tidy up the script (polish, generate chapters, identify speakers, re-transcribe, find cuttable pauses); writing (write a summary, write a blog post); and publishing (suggest a title, write a description, make a cover). It also adds “cut into short videos” from the “Visuals” group, which is agent-only and always opens a new conversation. When it finds clips, it creates child videos that reference the source footage directly. The original video and its timeline stay untouched. Its parameters page has no “Use” or “Conversation” rows. The “Sound” group adds music generation. It does not start from the script, so it can be clicked without one. Clicking it goes to Tools › Generate music, with the target duration pre-filled from this video's length. The finished audio is added to this video's music track. If the video is longer than the model's single-generation limit, the page pre-fills the maximum and says so. When added to the music track, the audio loops to fill the video, cross-fades at the seams, and fades out at the end (§2.7 “Generate music”). If no local music model is installed, the tool page's “Model” row links to settings (§2.7 “Page”). Translate subtitles, translate dubbing and smart trim are still entered from their own panels. The list footnote explains where they are, and they will move here later. For a video with no script, a note card at the top of the list explains that these tools all start from the script and need transcription first, and it gives a transcription entry point. Tool rows are greyed out and unclickable, but still visible so people can see which tools exist.

**Parameters page.** From top to bottom, the page always has four sections:

1. A card with the tool name, a one-sentence description, and a line stating whether it changes the video. Possible values: changes the script (applied on completion, undoable in one step); only writes a suggestion; does not change the video, and the result is for you to read or copy. New users need to know immediately what happens when they press the button.
2. Settings rows: “Use” (hand to the agent, or call the model directly; remembered per tool), “Scope” (whole text, one chapter, or the paragraphs brought in when the tool was launched), and, when handing to the agent, an extra “Conversation” row. The tool's own checkboxes and numbers follow (polish once first, correct using the glossary, number of candidates, where to send, aspect ratio, add keyframe illustrations). For the blog post's “Add keyframe illustrations”, the default is off. When it is on, the agent pulls frames from the video and inserts them into the article where an illustration is needed. A direct model call cannot access the picture, so this option is greyed out with the reason stated. Language, style, length and point of view are no longer dropdowns; they are written in the prompt.
3. Prompt box. It is pre-filled with a template. The first line is the intent sentence, with scope, checked options and any selected title folded in. Below it are fixed constraints. For writing tools these are: write in Markdown, which language to use, length and structure. For polishing: do not reword the expression, and do not delete content. This text is exactly what gets sent, and the user may edit it directly. A “Restore default” button appears only after an edit. The box is the same control as the conversation input: the `+` menu attaches files and Skills, `@` references chapters, speakers and translations, and images can be dragged, dropped or pasted. There is no separate “Anything else?” field, so the same text never appears twice. Each tool has a built-in Skill (the group in §6.9). When the parameters page opens, the Skill is already attached to the box, labelled “This tool's method”. Removing it sends only the prompt text in the box. A line under the box says “No Skill attached” and gives a way to add it back. The `+` menu can also attach other Skills you have added, even when they are off. They go after the attached ones, and all are sent in order. When a direct model call has a Skill attached, the Skill is sent as the system prompt. Only `SKILL.md` and the `references/` it uses are sent, not other files. A line under the box reminds the user of this.
4. Primary button and a one-line note on where the result goes. The button states the action (Hand to agent / Polish / Write summary). The line below says who does the work, where the result lands, and whether it costs money.

**Hand to the agent.** By default, this opens a new conversation and uses this video as context. One task per conversation is easier to find, and it avoids resending the whole history. (In a long conversation, the prompt cache expires, so every turn costs extra.) The “Conversation” row can be changed to continue the video's current conversation. The option states how many messages it already has. The prompt box's footer works like the conversation input: an access mode plus a “Home · model” chip. It shares state with the “Use” row, so changing one updates the other. When you press the button, the prompt text and attachments are sent. The parameters page returns to the list, and that conversation (new or continued) opens in front of you. Generation runs in the conversation, and the result appears in the matching panel or tool page when it finishes. Progress is shown in the top bar capsule and on the background tasks page. Finding cuttable pauses and refreshing stale translations stay in place and show progress there. The conversation is still created or continued, and the message is still sent, but the view does not switch. If you return to the list or reopen the page, or restart the app, and the job is still running, progress continues to show. Jobs that have finished go back to the parameters page.

**Back.** “Back” on the result page and the receipt page (including the candidates and confirmation pages) returns to the parameters page, and the settings and prompt are kept. “Back” on the parameters page returns to the list.

**Call the model directly.** Polish, generate chapters, write a summary, write a blog post, suggest a title, and write a description can skip the conversation and call a text model directly (the Runtime's `ai-tool` flow, command protocol `pipelines`). Refreshing stale translations can also call the model directly, using the in-place refresh of the `translate` flow (see “Per-sentence and stale translations” below). This path carries no prompt, attachments or Skill. The parameters page has no prompt box. The settings row changes to choose which translation to use (when opened from the subtitle panel, the default is that translation) and states how many sentences to retranslate (stale, untranslated). A further line explains that sentences whose source was cut must be retranslated from the cut source, which only the agent can do. Below that is the text model selector (the same as the translation tool, and it needs structured output), the primary button “Retranslate N sentences”, and a destination line. When there are no sentences to retranslate, the button is greyed out. When pressed, the parameters page is replaced in place with progress (cancellable; the same refresh started from the subtitle panel is also shown here). When it finishes, the page returns to the parameters page, and the message offers undo. Re-transcription (which needs a speech model; the transcription flow adds a whole separate transcript and does not replace by scope), finding cuttable pauses (each one needs judgment), and making a cover (which needs image generation and compositing) are greyed out, with a line below each stating why. Identifying speakers has its own local flow. When direct model calls are selected: the access mode and “Home · model” chip are replaced by a text model selector (cloud and local models, grouped by provider). Polish and chapters need structured output, so unsupported models are marked with the reason and cannot be used. The “Conversation” row is not shown. When a Skill is attached, a line under the box says it is sent as the system prompt, with only `SKILL.md` and the `references/` it uses. Another line states what context goes with the prompt: “Sent to the model: prompt + N script paragraphs · chapters N · attachments N · Skills …”. Script paragraphs are counted by the chosen scope and carry timecodes, speakers and chapters. Polish sends only the script with per-word numbering and no chapters. If nothing else is sent, it says “Only the prompt above”. If images are attached, a note says the images are not sent to the model and are skipped. The primary button states the tool's own action (polish, generate chapters, write summary, write blog post, suggest title, write description). The line below reads “Direct call to <model>, no conversation; applied on completion, undoable in one step / result for you to read or copy, not written into the video. Cloud models are billed by usage / local models, nothing leaves this machine.” When pressed, the parameters page is replaced in place with progress (cancellable; for polish in batches, it states which part is running). The job also appears on the background tasks page. On completion, polish and chapters are written into the video and leave a receipt (how many changes, one-click undo). Writing and publishing tools show the body text the model wrote, unchanged, which can be copied. It is not written into the video and has no receipt. “Done” returns to the parameters page. If a job fails, an issue card appears with the cause, a link to model settings, and a retry from the step where it stopped. Chapters always cover the whole text (there is no “Scope” row and no “Polish once first” option). Polish done by direct call only fixes typos word by word and adds punctuation. It does not split paragraphs, and the “Use” row says so. If the selected model cannot be used (no key connected, or not installed), a gate card and a connection link appear under the box. The primary button is not greyed out. When pressed, it explains what is missing and brings the gate card into view. The “Use” choice and the selected model are remembered on this machine, per tool.

**Per-sentence and stale translations.** In the subtitle panel's translation list (bilingual view and translation-only view), each sentence's ⋯ menu has: “Retranslate this sentence with the model API”, “Retranslate this sentence with the agent”, and “Mark as stale”, or “Remove stale mark” if it is already stale. Manual translation means clicking into the translation and editing it directly. The stats bar takes one line. On the left are the sentence count and the counts needing attention (“N untranslated”, “N stale”, “N cut”, “N glued”; full names are in the tooltip). On the right are only two icon buttons: search, and an AI button. The first group of the AI button's menu is retranslation. It only appears when there are stale, untranslated or source-cut sentences: “Retranslate these N sentences with the model API”, “Retranslate these N sentences with the agent”, and, when there are cut sentences, “Handle the N cut source sentences” (opens the tool page for refreshing stale translations). The next group is “Translation tool” and “Have the agent translate or proofread”. The web version has only search. The rules:

- The two routes must be easy to tell apart. The model API item has a second line: “Direct call to <model> · billed by usage” (for local models: “nothing leaves this machine”). It skips the conversation and applies on completion. The agent item says “Runs in the current conversation · uses the agent subscription”, and it asks for confirmation before writing.
- “Stale” and “to be translated” are the same mark (the translation unit `status: stale`). When the source is edited, or half a sentence is cut, the Runtime marks it automatically. Users can also add or remove the mark by hand. Hand-editing a sentence's translation counts as reviewing that sentence, so the stale mark is removed along with that edit. Adding and removing the mark both go into the undo history. The web version has both actions too (it only edits the document and does not call a model).
- A direct retranslation refreshes this translation in place through the Runtime's `translate` flow (`translationId`, with `sentences` when it is one sentence; command protocol `pipelines`). It retranslates only the named sentences. If none are named, it retranslates the sentences marked stale, whose source changed, and those with no translation yet. The result is written as a new version of the same translation document. In the subtitle layer built from it, only those sentences' caption entries are replaced. Their timing still comes from the original sentence's word timing, and other entries and the caption style are unchanged. This is one transaction, so undo reverts both sides at once. The model is the one remembered for the translation tool, and no parameters page opens. Progress appears in the stats bar and on the background tasks page. When it finishes, a notice with “Undo” appears.
- Handing to the agent sends the work to this video's current conversation (the one on the left of Home, or the floating conversation in Space). If there is none, a new one is opened. The panel stays where it is and does not switch away. The message sent states the language and scope (this sentence's timecode and the opening words of its source, or the number of stale sentences). It changes only the translations of those sentences. The timeline, caption style and other sentences are not touched at all. When the agent edits existing translations, the caption layer is also updated in the same editing transaction (`documents_put` returns `syncedCaptions` in its receipt).
- All of these entry points need a model or a conversation. The web version only shows the sentence counts and a note: “Start from the agent or the CucCut app”.

**Cut into short videos.** This is agent-only and always opens a new conversation (see “Batches” above). If the video is not yet in a project, it also opens a new conversation. It shares a folder with the conversation the video is in (§2.3), and does not create a project. The second section of the parameters page has these settings, in order:

- What to cut: how many clips (“Auto”, the default: as many as there are strong topics, never padding with weak ones, up to 10; or 1–10).
- How long each clip is (“Auto”, the default: each clip runs from an attention-grabbing opening line to the end of its topic, without stretching or trimming to hit a duration; or 15–30 seconds, 30–60 seconds, 60–90 seconds, 1–3 minutes, or custom minimum and maximum). There is no platform-specific cap. Only if a clip exceeds a common platform limit is there a one-line note, for example YouTube Shorts' 3 minutes. When either of the two settings is “Auto”, a small line below explains how Auto decides.
- Aspect ratio (9:16, 1:1, or keep the original).
- Framing (“Auto”, the default: the agent samples several frames evenly across the clip, sees which side of the frame the speaker is on, and places the crop on them; if no person is found, it centres the crop. “I'll set it myself” means you drag the picture on the child video's canvas to position it afterward; there is no separate framing control. “Follow the speaker” is greyed out, with the reason stated: this version has no person or speaker model yet).
- Subtitles: which tracks to include (source + translation, source only, or translation only; with no translation, only the source is available), and style (the short-video subtitle preset, or the video's current style).
- Scope: the whole text, one chapter, or, when a paragraph is selected in the script, “Current selection”.
- “Don't search areas already cut” (on by default, which skips ranges used by earlier clips).

These choices are folded into one line each in the prompt box. The `shorts-segments` Skill (§6.9) is pre-attached to the box. The agent picks units by topic. It first reads the script to find topics worth posting on their own. Each clip runs from a hook at its start to the end of its topic. It is not cut evenly by chapter, and it is not built by padding around a single quotable line. When the number of clips or the length is set to Auto, the agent decides by topic. When a number or duration is given, it picks the strongest within that, and it would rather give fewer than pad. The final line is “Create the video directly once found, no need to ask me first”, which can be edited or deleted on its own. If you keep it, the agent creates the videos as soon as it has picked the clips. If you delete it, the agent first lists its candidates in the conversation and asks you before creating. Each short video is a child video (§2.3). The original video and its timeline stay untouched. In the conversation, each clip gets one video card, and the parent video gets its own card (§3.2.2).

**Short-video result page** (desktop only, in the AI tools tab). When the run finishes and this round created child videos, the view switches automatically from the parameters page to the result page. The header says “N created” and “k/N ‹ ›”. Each clip has a card with: the title (click to edit); its range on the parent video and its duration; the opening line (the one the agent supplied if any, otherwise the first sentence of the kept segment for this clip); “Why this one” and a label (only if the agent provided them); when framing is done per shot, a line “Framing: per N shots · open and drag a segment on the canvas to change” (omitted when there is only one framing position); the clip currently being viewed is marked “Viewing” and gets an extra “Adjust start/end” (the same action as the banner's “Adjust in script”, see “Editing a short video” below); “Open” (switches to this clip in the same editor); and “Don't keep this one” (moves it to the trash; the notice offers undo). At the bottom are three destinations: “Cut more” (back to the parameters page, with already cut areas excluded), “See these in Space” (filtered by source, §4.3), and “Export all…” (each clip not moved to the trash is exported with default settings as a finished video, each as its own export job whose progress is shown in the job list. On desktop, you first choose a folder once. Any clip that is open or cannot be opened is skipped, and the notice says so). “Back” returns to the parameters page. The result page state is remembered per round (conversation). You can switch back and forth between the parent video and its child clips, and returning to the AI tools tab keeps this page.

**Child-video section on the parent.** Above the parent video's video panel, there is a group called “Cut short videos”. It works the same on desktop and web. It lists child videos cut from this parent that have not been moved to the trash. The newest ones appear first, in reverse creation order. Six rows show by default. Any more are collapsed into one “N more” button. Clicking it lists them all, and clicking “Collapse” hides them again. Each row shows the name, its range on the parent video, and its duration. Clicking a row opens that clip in the same editor. The group can be collapsed.

**Editing a short video.** A child video opens in the same editor, with no separate interface. The canvas follows the chosen aspect ratio, and the timeline shows only the kept segment. Deleting content is just a normal cut (§5.7 “Cut audio and picture”). A banner at the top reads “Short video cut from ‘<parent video name>’”. On the right is a cell with a button to adjust the start and end in the script, plus “Back to source”. If the parent video has been deleted, the banner instead reads “Short video cut from a video no longer in the library”, and “Back to source” is not shown. On desktop, “Back to source” opens the parent video and lands on this result page in the AI tools tab. On web, it only opens the parent video. The start and end are adjusted in the script. When a child video is opened without a designated panel (from Space, from a video card in a conversation, from the parent's “Cut short videos” list, or opened directly), it lands on the script, with the cut-audio-and-picture view open. When it is opened by clicking a card on the result page, it stays on the result page. The cell in the banner depends on which panel is showing on the right. When the script is not showing, the cell reads “Adjust in script” (the “Adjust start/end” action on the “Viewing” card of the result page is the same action). This switches to the script, opens the cut-audio-and-picture view, scrolls to the seam row just before the clip, or, if there is no seam row, to the paragraph containing the clip's first sentence, and records where it came from. Once you are in, the cell changes to a way back. From the result page, it reads “Back to result page”. From another panel, it reads “Back to <that panel>”. If the script was not opened this way (it opened directly on the script, or the panel or video was switched after arriving), the cell reads “See result page” on desktop when a result page exists, and is not shown when there is none. The child video script's cut hint has one more sentence: “Sentences outside the clip are struck through; click one to bring it back.” The script panel lists the full text of the parent video. Sentences outside the clip are shown struck through. A few sentences are shown at each end of the clip (tentatively 3, §12). Further out, it collapses into a seam row, “X sentences before / after cut · Expand”. Each click expands a few more (tentatively 10 sentences), and the expansion can be collapsed again. Clicking a struck-through sentence brings back everything from it to the clip edge, so no gaps are left in the middle. There is no one-click button to restore the entire outside of the clip. For how paragraph times are displayed, see §5.8.

**How the picture is framed.** The child video's source footage fills the frame and is framed by its crop. When framing is done per shot, the source is split into several segments by shot, each with its own crop (the timeline does not show shot numbers; the segments are simply separated). When you select the source on the canvas and drag the picture, you pan only that segment's framing. Dragging left and right moves the crop window. If the window is shorter than the source, it can also move up and down. The window size stays fixed, and it never drags outside the source. Releasing the drag records one undo step. When the source is split into more than one segment, selecting one of them shows a small tag hanging at the bottom-left of the picture: “This segment · seconds X–Y” (in seconds on the child video's timeline), which says which segment you are dragging. The tag's “Apply to whole clip” button (hover tooltip: “Use this segment's current position for every segment of this video”) writes this segment's framing to every segment of the clip, as one undo step. The notice also offers undo. Desktop and web work the same way.

Rules:

- **`/` is an action, `@` is an object.** `/` names a tool and is recognised only at the start of the input. `@` references chapters, speakers, translations or other videos, and can appear anywhere. The two are not mixed into one list.
- **Default is to hand to the agent.** “Use” defaults to the current agent, and the primary button is “Hand to agent”. Users can switch to “Call the model directly”, and the choice is remembered per tool.
- **When no agent is available, say where to go.** The card at the top of the list page and the input box explain the reason and link to settings. On the parameters page, “Use” points to a configured model. If there is none, that row shows a connection link. Do not block the parameters with a full warning card, and do not grey out the button.
- **Tools that need human review keep their review UI.** Smart trim's per-shot framing, the short-video candidates, speaker identification confirmation, speech-cut suggestions, the dubbing duration comparison, and cover candidates are all completed in their own interfaces. The conversation starts the work and reports back, but does not reduce the review to a line of text.
- **Every tool with its own interface has a fixed entry point.** The entry point sits next to the thing it acts on and does not depend on the conversation. Smart trim lives in the video panel's menu for each video, and selected clips have a scoped entry too. When an unfinished trim exists, the entry point returns to that place.
- **Results land on the interface, not only in speech.** When the agent finishes something that should be seen in the interface (reviewing framing, choosing candidates, reading a finished draft), and this video is open, the view switches to the AI tools tab and opens that interface, stopping on the result rather than the parameters page. A floating conversation collapses to an icon to make room on the right, and clicking it again brings back the full conversation. Below the closing message is a button with the same name. When no video is open (a Home conversation), this button opens the video along with it. It also lets you return here later.
- **Writing and publishing tools are read-only.** Summary, blog, titles, description and cover do not change the video. They have no approval card and no undo. The results are read, chosen and copied in their own interface.
- **Tools not yet connected to an agent keep “Call the model directly” on the parameters page.** The conversation must not list them under `/` (documented convention “scope marker”).
- The web surface has no AI tools tab (§1.4: the web is a subset of the desktop, with no AI entry point). When it is reached there, it falls back to the script.

### 5.11 Translations, subtitles and voiceover when switching the transcript

Re-transcribing a video that already has a transcript (from the Transcription tool page, the “Re-transcribe…” entry on a Space item, or “Re-transcribe” in the editor, §2.7, §4.4) produces a result with two destinations, chosen by a single selection on the tool page:

- **New video** (default): creates a new video in the same project, linking the same media without copying files, with the new transcript and one editable subtitle layer. The default name is “<original name> · Re-transcribed”, which can be changed. The original video and its translations, subtitles and voiceover stay untouched.
- **Replace this video's transcript**: the new transcript replaces the current one, and this video's translations, subtitles and voiceover carry over to the new transcript under the rules below. This is called switching the transcript.

A video with no transcript (never transcribed, or the last attempt failed) has no destination row; the result is written straight into it.

**Edited transcripts trigger a warning first.** When the user has edited the original text after transcription (fixing typos, polishing, re-segmenting), the tool page shows “You have edited this video's transcript”, explaining that replacing will discard those edits (Undo can bring them back), and the destination falls back to New video by default. The user can still choose Replace, which accepts this warning (architecture design §10.3). The consent applies only to the transcript as it was at that time; if the transcript is edited again after the operation starts, the warning is raised again. The command line and agents must explicitly pass `--accept-edited` (`acceptEdited`) to replace an edited transcript.

**Carry-over results.**

- Translations: sentences whose source text is unchanged keep their translation and review status, and alignment is downgraded to sentence level. Sentences whose source changed or that no longer fit are marked stale; the old translation is kept for reference, and “Retranslate” in the subtitle panel retranslates only those sentences (§5.10 “Sentence-level and stale translations”).
- Subtitles: the subtitle layer derived from this transcript and its translations is re-cut against the new transcript, with style and layout presets unchanged. Pins such as manual line breaks and times fixed to a word are re-anchored to the new words by time; pins that cannot be anchored are marked orphaned and are no longer output. Pins anchored to a clip or to the timeline do not move.
- Voiceover: audio for sentences whose translation is unchanged is kept and marked as possibly inconsistent (the same hint used when editing a translation, §5.7); it is not regenerated automatically. Voiceover whose translation is stale is marked stale.

For the pairing and carry-over rules, see §5.3 of the video format specification; for subtitle pins, see §5.5 of the same document; for voiceover, see §7.2.

**Impact preview and result.** When Replace is selected, the tool page shows an impact card: one row per translation language, giving the sentence count and the reviewed count (e.g. “English · 62 sentences · 40 reviewed”); one sentence explaining that unchanged sentences keep their translation and review status with alignment downgraded to sentence level, and that changed or unmatched sentences are marked stale and can be retranslated with “Refresh stale translations” after completion. Before the operation starts, the number of sentences that will go stale cannot be computed; the exact count is reported in the result. The card also shows the number of subtitle pins to be re-anchored by time, with a note that pins which cannot be anchored are marked orphaned; for each language, the number of voiceover groups and the note “sentences whose translation is unchanged are kept and marked possibly inconsistent”; and “one transaction, can be undone”. When transcription completes, the result page and task summary report, for each language, how many sentences were kept (and how many of those were reviewed) and how many went stale; how many subtitle pins were re-anchored and how many became orphaned; how many voiceover sentences were kept and how many went stale. They also offer “Refresh stale translations” and “Undo”.

**One undoable transaction.** The new transcript, the switch and all carry-overs form a single edit; undoing it returns to the transcript, translations, subtitles and voiceover from before the replacement.

**Partial re-runs.** When re-transcribing by chapter or by range in the editor, only sentences within the range take part in pairing; words, sentences, translations and pins outside the range do not move.

---

## 6. Tasks and conversation

### 6.1 Objects

| Object | Definition | Relationship |
| --- | --- | --- |
| Project | A directory containing one or more videos | A project can have multiple sessions |
| Video / version | The authoritative editable timeline and its committed versions | Belongs to a project; is a subdirectory under it |
| Session | The collaboration record between the user and the agent | Switching the execution engine does not automatically migrate native history |
| Task / task contract | One delegation and its result agreement | Can span multiple turns; contains multiple execution attempts |
| Execution attempt | One budgeted execution of a task | Stopping targets the current execution attempt and its sub-work |
| Step | One computation such as recognition, generation, build or render | Produces one or more artifacts |
| Application | The action of applying a result to the video | Has its own idempotency guarantee and receipt |
| Candidate / artifact | A candidate option / an immutable result | An unapplied candidate is not a working draft |
| Checkpoint / variant | A named historical state / an explicit derived output configuration | Does not automatically copy and rewrite all media |

In the interface, “task” means one delegated result; a single computation appears under its concrete step name, e.g. “Voiceover generation”. A finished generation step does not mean the whole task is complete.

Internal names of objects (Task, Run, Job, Application, etc.) and their state machines are in the architecture design, §3 and §7.

### 6.2 Task contract

Each task has a result agreement, organized by the system from natural language; the user does not need to fill in a form:

| Item | Example |
| --- | --- |
| Goal | “Add bilingual Chinese–English subtitles to this video” |
| Scope | The whole video, or an object, a sentence or a time span |
| Constraints | Content, style, pacing, duration, aspect ratio, language, sound |
| Protection scope | “Don't touch anything else”, “keep the original sound unchanged” |
| Delivery stage | Watch a preview / apply to the working draft / export the finished video / export a subtitle file |
| Autonomy level | The session's access mode (§7.1); not a separate setting |
| Permissions and budget | Data and services allowed to be used (authorization, §7.2); the total number of calls this task may make and how much it may spend (task budget, summed across providers) |
| Acceptance checks | Checks that must pass before completion |

- The default values the system adopts are visible on the goal card and can be changed.
- For an existing video, the aspect ratio and sound are kept by default.
- The delivery stages requested by “Make a preview” and “Export the finished video” differ (§6.8).
- Changing the contract creates a new version. New constraints apply to steps that have not started; steps whose inputs are already frozen do not switch content mid-execution.
- Each version records who changed it (user, agent or system default), why, and what changed; old versions can be viewed. Switching the session's access mode also records a version.
- The user can change all of the contract. The agent can read its own contract and refine the scope, constraints, delivery and acceptance checks; the changes are visible to the user. Access mode, budget and protection scope are decided only by the user; the agent cannot change them.
- When the task budget runs out, no new outbound calls are made; the agent tells the user, who decides whether to raise it. If the monetary limit cannot be guaranteed in the same currency, it is likewise not enforced (§7.4).
- **Changing the goal**: when the user switches goals, they choose what happens to the old work — stop (cancel background tasks not yet finished), or keep (background tasks already submitted finish as usual, and their outputs are kept as candidates). Either way, a new task starts with the new goal, carrying over the old contract's scope, constraints, protection and budget cap.
- **Acceptance checks**: in the first version, the user or agent records the result of each check (passed, failed, skipped), kept by time. Automatic check execution is not in the first version.
- The contract is viewed and edited on the task card in the desktop app; the CLI can only view it (`cuccut tasks contract`). The Web service can view and edit when not read-only, and only view when read-only. The external service (MCP) does not involve task contracts.

### 6.3 Protection scope

- **Confirmed**: should not be redone later without reason.
- **Locked**: the current task must not modify it; it must be explicitly unlocked.
- **“Leave everything else alone”**: forms a set of inspectable protected objects and attributes.

Protection scope is fine-grained down to video, object, attribute and time range, and records its authorization source and effective scope. It is part of the video state and is enforced by the engine at commit time; it does not rely on the model to comply voluntarily. Quality checks also compare before-and-after differences for unauthorized attributes.

Protection scope constrains the agent in this task: if its edits or undos touch protected scope, the whole transaction does not take effect. The agent receives the touched objects and protections, and when a change is needed, it asks the user to adjust. The user's own edits are not restricted.

Unavoidable knock-on effects (e.g. cutting causes later content to shift forward as a whole) are first presented as a minimal change proposal. Re-rendering frames because the render cache was invalidated does not mean permission to redesign content.

### 6.4 Video memory [AG-05]

The video remembers confirmed direction, terminology, reference samples, voice choices and protection scope, and links them to stable objects.

- Facts in the video take precedence over old chat. A title the user has just hand-edited must not be overwritten by a previously generated result.
- Memory can be viewed and deleted, and can be overridden per task.
- Reusing a brand, voice or terminology across videos requires explicit user selection.

### 6.5 Task cards [CON-01]

The conversation carries operations, not only text.

| Card | Key content | User actions |
| --- | --- | --- |
| Goal card | Result, scope, constraints, inherited defaults | Edit goal and protection scope |
| Video card | Frame (hover shows a play button; plays the original in place on the card), name, status word; this session's work on this video (one session, one video, one card; position in §3.2.2): expands the in-progress or most recent item (stage, progress and counts, the model and parameters used for transcription, completed results and files, failure reason), with the rest collapsed under “N earlier items” | Open editor, cancel, remediate, retry, play, show in folder |
| Download card | Source, downloaded and total amount; failure reason; files landed when download-only | Cancel, show in folder |
| Selection reference card | Object, sentence, time, version | Locate, replace range |
| Candidate card | Image, sound, short animation and their sources | Preview, audition, select |
| Clip suggestion card | Reason, original clip segment, surrounding content | Accept, ignore, restore |
| Change card | Objects actually modified, time and dependency impact | Compare, locate, safely undo |
| Authorization card | Data, services, cost, scope, validity period | Allow, adjust, deny |

Stages, issues and deliverables no longer each get their own card: in-progress stages and failure reasons are written on the corresponding line of the video card, delivered files hang on the export line, and to-dos found by checks are written in the reply (§3.2.2, §3.2.7). Change cards also do not take a line of their own: each is a line inside the box when the step group is expanded, ordered by sequence with the step that committed it, and undo and redo are on that line (§3.2.2).

### 6.6 Questions and defaults [CON-02]

- Ask only when missing information affects correctness, irreversible risk, budget, privacy or how the subject is represented.
- Read information that can be read from the current video and files first; do not ask repeatedly.
- Low-risk defaults can be adopted directly, but must be visible on the goal card.
- When a creative direction must be chosen, prefer a few visible candidates or representative samples, rather than asking the user to understand abstract technical parameters.
- After the user says “use your own judgment”, do not ask shot by shot. But this does not expand permission for payment, upload, voice cloning or publishing.

### 6.7 How the agent works

**Context understanding** [AG-01]. The agent receives: the video version, the sequence, the selected objects and words or sentences, the currently valid transcript, the time position, the user's interface language, necessary frames and relevant constraints. It uses summaries and retrieval first, expanding on demand, and does not by default send out the full video file or full text. When it has only read a filename, it cannot claim to understand the content; the scope and method actually read are recorded.

**Planning and proactive decisions** [AG-02]. To the user, there is only one execution subject responsible for the result. Plans are organized by production stage and do not require the user to understand internal frameworks or multiple agents. Internal analysis and material generation may run in parallel; submissions to the video proceed in order.

**Capability selection and real execution** [AG-03]. Prefer existing material, native objects and models currently verified as usable; do not buy a new generation to change one title. When a capability is unavailable, say so honestly; do not substitute a text description for execution.

**Look at the result, then correct** [AG-04]. The work loop is: understand → review materials → plan → make or edit → look and listen → correct → deliver. Changing one title can shorten this loop; animation driven by voiceover must first obtain real audio. Automatic quality repairs default to at most two rounds, after which they are handed to the user; this is an adjustable product default, not a model guarantee. Paid retries are additionally limited by budget. Repairs cannot cross protection scope, and subjective style preferences must not be treated as hard errors.

**Continuous editing** [AG-05, EDT-04]. Change one place, change only that place. Later rounds are based on the video's current facts, not on the previous round's chat content.

**Meaningful ending** [AG-06]. Judge completion per §6.8, not by the model's output ending.

### 6.8 Definition of done [OUT-03]

The delivery stage in the task contract determines what counts as done:

| Requirement | Condition for completion |
| --- | --- |
| Preview | A real, openable candidate exists |
| Edit working copy | A commit receipt for the target version exists |
| Final video | A verified and published file exists |
| Subtitle file | The file is generated; no video encoding is required |

- A task can only be completed after known blocking issues are resolved; videos left for human review are listed explicitly.
- When only part of the work succeeds, the task ends as “部分完成” (partially complete), and the usable outputs are kept.
- Export cannot be reported as successful without a file.

### 6.9 Skill [AG-07]

A skill is an instruction file that teaches the built-in agent how to do something a particular way: a folder containing a `SKILL.md`, for example a subtitle typesetting standard or a chaptering method. It is guidance, not authorization, and not a new tool.

- **Sources.** There are three kinds: bundled with the app (built-in), added by the user from a local folder (personal), and imported from GitHub (third-party). The app ships with these skills: transcription and subtitles, transcript polishing, chaptering, speaker labeling, translated subtitles, video content summary, writing blog posts, titles and intros, covers and headlines, talking-head cutting, short-video cutting, voiceover-to-video, brief-to-video, motion graphics, slides, and design drafts. Each tool on the AI Tools tab corresponds to one of these, and the parameters page has it attached by default (§5.10). There is also a “怎么用 CucCut” (How to use CucCut) manual page covering the mechanism of each capability, end-to-end workflows, and common conventions. These pages are part of the agent's guidance: they are always available in the session for the agent to consult as needed, they are not in the settings list, and they cannot be turned off. They are the same content as the CucCut skill installed for external agents (§2.7, “Command line and external agents”).
- **Toggles.** Each skill can be turned on or off individually. Built-in and personal skills are on by default; third-party skills are off by default, and the user turns them on after reviewing the content. An enabled skill is used by the agent on its own when relevant to the task, and is not read when irrelevant.
- **Picking.** In the input area, the user can pick one or more skills for a single message, including disabled ones, and that message's agent follows their methods. “+ › 使用 Skill” (Use Skill) adds one marker to the input box for each pick, appended after the existing markers; picking an already attached skill does not duplicate it; each marker can be removed individually. On send, the skills are handed to the agent in the order they were attached (one passage per skill), and the message in the session shows the selected skills' markers in the same order. The prompt box on the AI Tools page comes with that tool's built-in skill pre-attached, labeled “这个工具的做法” (how this tool works); it can be removed, and another skill can be attached. Re-adding a removed skill also appends it at the end (§5.10).
- **Effective time.** Turning a skill on or off, or adding or removing one, takes effect from the next agent session started after the change; sessions already in progress are unaffected. Picks always use the current content.
- **Management.** Settings lists every skill with its name, description, source, and toggle, and lets the user view the full `SKILL.md` text and file list. Before adding or importing, the source is stated; after completion, the app shows where the skill was placed. If a skill with the same name already exists, it is not overwritten; the user either gives the new one a different name or removes the old one first. Imports have size and file-count limits. When a limit is exceeded, when `SKILL.md` is missing, when the address is wrong, or when the network or access rate is limited, the reason is stated honestly. Built-in skills cannot be removed, but they can be turned off. In strict offline mode, GitHub import is not possible.
- **Browser and external agents.** The browser can view and toggle skills, but cannot add, import, or remove them. The agent in a session, external agents connected through MCP servers, and the command-line agent surface (§2.7, “Command line and external agents”) can all list the skill index and read skill bodies read-only (`skills_list` / `skills_read`), but cannot add, import, toggle, or remove. That management exists only in the UI and in the CLI's management bucket.
- **Trust.** Skills that the user adds or imports, like other user-supplied material, cannot expand permissions (§7.5). Access modes, approvals, and protection scopes apply as usual. CucCut does not execute any file inside a skill.

The layout and interaction follow the prototype; the mechanisms are in the architecture design §3.8 and §12.9.

---

## 7. Autonomous execution, permissions and privacy

### 7.1 Access modes [AUT-01]

An access mode is the agent's permission setting. It is chosen in the session's input area and determines when the agent's actions require the user's confirmation.

| Mode | Behavior | Suited for |
| --- | --- | --- |
| Supervised | Asks for permission before running commands or modifying files or videos | First exploration, uncertain large changes |
| Auto-accept edits | Edits are approved automatically; other actions ask first | Subtitles and local edits |
| Auto (default) | Routine actions are approved automatically; high-risk actions still ask | Everyday creation |
| Full access | No per-action confirmation | Batch steps in a direction the user has already confirmed |

All modes are bound by the same permission floor. Wider modes do not grant unlimited spending, data export, voice cloning, or public publishing. Those remain authorized item by item, and the effective scope of each authorization stays visible. The mechanism is in the architecture design §3.12.

### 7.2 Permission and approval matrix [AUT-02]

| Behavior | Default policy | Cases that require reconfirmation |
| --- | --- | --- |
| Reading user-selected material, previews, analysis | Runs within the currently authorized data scope | Reading a new directory, sensitive material, or other videos |
| Local, reversible edits the user explicitly requested | Runs directly and gives a change receipt | Going beyond the selection, touching locked objects, or changing meaning |
| Batch removal of viewpoints, changing the core script | Gives a comparable plan | The user has not explicitly authorized this kind of structural change |
| Sending out transcripts, screenshots, audio, original videos | First obtains authorization for the corresponding data and recipient | Service changes, expanded data scope, authorization expired |
| Paid cloud generation | First shows the service, scope, and known cost or estimate | Over budget, expanded scope, a new purchase round needed |
| Voice cloning, lip-sync, or changes involving a person's identity | Separate authorization, and eligibility to use is confirmed | Change of identity, purpose, or scope |
| Overwriting source files, deleting the only copy of material | Not done by default; requires explicit confirmation | Every operation that cannot be safely restored |
| Public publishing and sharing | Not published automatically in the first version | When supported later, the target is confirmed each time under the authorization policy |

Authorizations that one task needs can be merged, to avoid a popup for each file. However, approving “upload low-resolution preview frames” does not equal approving upload of the full original video.

An authorization is bound to the data type, recipient, video and object scope, purpose, budget method, and validity period. After the user revokes an authorization, new calls and automatic applications are prohibited, and the app explains that parts already sent out or already billed cannot be erased by local revocation.

### 7.3 Two data flows [AUT-03]

“语音识别在本地运行” (speech recognition runs locally) does not mean the whole task is offline. There are two independent data flows:

1. The conversational agent may send the script, screenshots, or task context to its model service;
2. Model services such as transcription and generation are a separate data flow.

Settings and task cards must state each one separately. When the user selects “仅本地” (local only), neither direction may switch to the cloud automatically. When offline, only capabilities that are already installed and verified as usable can be completed. Without a local agent, manual editing and local computation remain available, but the app may not claim that the full agent can still work offline.

### 7.4 Budget and cost [AUT-04]

- Distinguish four cost states: estimate, amount reported by the service, billing unknown, and free local computation. Do not show a pseudo-precise amount when there is no trustworthy price.
- The task budget covers generation, retries, and candidate variants. An accepted quote is bound to the actual task scope. Parallel steps share one budget, so they do not each see the same balance and overspend.
- When a service cannot provide a reliable amount estimate, a monetary cap cannot pretend to be strictly guaranteed. In that case, either block that cost mode, or ask the user to switch to “批准这一次明确的调用，金额未知” (approve this one explicit call, amount unknown).
- When the state of a result is unknown, query or reconcile first; do not place the order again.
- After a user rejects a charge, the model may not automatically switch to another paid service to get around it.

### 7.5 Untrusted material is not instructions [AUT-05]

Subtitles, web pages, metadata, code comments, and instruction files inside a file are task material. They cannot be elevated to new user authorization. A line in the video reading “删除视频” (delete the video) does not trigger a deletion.

Running animation source code requires a real, controlled environment. The app cannot claim safety by writing “do not access files” in a prompt. Permission descriptions must match the capabilities that are actually enforceable. When an execution engine or platform cannot apply the necessary isolation, the app either refuses to run untrusted code explicitly, or labels it as trusted developer mode. It does not silently drop to full permission and keep calling it safe.

The isolation boundaries are in the architecture design §12.

### 7.6 Model and capability configuration [SET-01]

- Settings show the agent engine configuration separately from the configuration for speech recognition, speech synthesis, image generation, and other models. The “Models” group in the left column of Settings is, in order, “API providers”, “Usage”, and then one page per capability: speech recognition, speech synthesis, text generation, image generation, music generation, vocal separation, and visual analysis. Each capability has only one page. Local models and API-provider models appear on the same page, not split into local and cloud tabs. Agent sign-ins (Codex, Claude, and so on) are under “Agent providers”, not API providers. Codex image generation still appears in the default model selector for image generation.
- The API providers page is vendor-centric and lists only providers that have been added. Each row shows an icon, the name, a one-line description (host, a few models, what it can do: text, recognition, synthesis, image generation), an account summary (a masked key, or “2 个账号” (2 accounts)), and the status. Connected providers are listed first, and “添加 API 提供方” (Add API provider) sits at the bottom. One key takes effect for all of that provider's capabilities. Adding an OpenAI key once makes text generation, speech recognition, speech synthesis, and image generation all usable, without filling it in again for each capability. Capabilities in the catalog that CucCut has not yet integrated (those marked P1 in architecture design §6.4) are listed in the API provider detail with the label “尚未接入” (not yet integrated). They cannot be tested or set as default, and they do not appear in the default model selector on capability pages.
- The API provider detail has, at the top, the icon, name, official-site link, and an enable switch. Providers that have both an international and a China address can switch region. Under “Accounts”, one provider can have several accounts (several keys). Each row has a switch, a name (the mask is shown when no name was given), the mask, a status (normal, invalid key, rate-limited with the time it recovers, quota exhausted), “设为首选” (Set as preferred), and remove. When an account has its own endpoint, the secondary line shows that endpoint's hostname. Clicking the name enters edit mode, where the name and endpoint address are changed in the same place. Accounts have an order: calls always use the first enabled account that has a key. When that account errors, the app does not automatically switch to the next one; the user adjusts the order. “添加账号” (Add account) expands inside the detail, with a name (optional), a key, a region (for providers with two addresses), and a collapsed “端点（高级）” (Endpoint, advanced) section. The endpoint is one address input whose placeholder is the default address of the selected region. If it is left empty, the provider's default address for the selected region is used. If filled in, it must start with http:// or https://. Endpoints are stored per account (the account `endpoint` in architecture design §6.8), and the interface no longer offers a separate provider-level endpoint override. “验证并保存” (Verify and save) first verifies once with the provider. If verification fails, nothing is saved, and a one-sentence reason is shown. Deleting the last account leaves the provider in place, but with no usable key. “能力与模型” (Capabilities and models) lists this provider's models grouped by capability, with a default badge, test, refresh list, and add model id. The “用量” (Usage) card shows this month's and today's call counts, estimated spend, and the number of calls whose cost is unknown. “查看用量” (View usage) jumps to the usage page filtered to this provider only. Providers that can query balance (P1) also have “查余额” (Check balance). At the bottom, “移除 API 提供方” (Remove API provider) requires a second confirmation, and it explains that the default model pointing to this provider will become unavailable and must be re-chosen.
- Adding an API provider: a search box at the top, with results in three groups: model vendors, relay platforms, and self-hosted endpoints (OpenAI-compatible). Providers that are not in the catalog all go through self-hosted endpoints. The end of the model-vendor cards has a card reading “自建端点 · OpenAI 兼容” (Self-hosted endpoint · OpenAI-compatible). Tapping it jumps to the form below and focuses the name field. Searching “OpenAI”, “兼容”, “自建”, or “custom” also lists this card. A self-hosted endpoint takes a name, an address, a protocol (OpenAI-compatible), the first model id, and its capabilities. If the address matches an already added provider, the app prompts to add the account to that provider instead. Vendors with both an international and a China address have only one card; the region is switched in the detail. Selecting a card opens its detail and directly expands “添加账号” (Add account).
- A capability page, from top to bottom: the default model (one selector, grouped into local models, each API provider (added providers only), and agents; unavailable items are greyed out with the reason stated); the parameters for this capability (concurrency; text generation also has reasoning intensity); local models (the model catalog, installed and installable models, check, repair and trial, and the download source, see the three sections “本地模型由用户安装” (Local models are installed by the user), “模型目录” (Model catalog), and “模型下载来源” (Model download source) below); and API providers. The API providers section has the subtitle “有这种能力的提供方；添加密钥后它的模型可选” (providers with this capability; once a key is added, their models become selectable), and “管理 API 提供方” (Manage API providers) goes to the API providers page (see the next item). The speech synthesis page also has a “我的声音” (My voice) tab. Music generation, vocal separation, and visual analysis have only local models, with no “API providers” section. The music generation page explains that the model generates on the local machine, that it is very slow, and shows the model's license (YuE2 is for non-commercial use only). The music model runs on the audio.cpp engine. The engine is a component of this model, and the download size already includes it. In the model's own component list it appears as “audio.cpp 引擎” (audio.cpp engine), with a description, the source “GitHub 发布 0xShug0/audio.cpp v0.9.1” (GitHub release 0xShug0/audio.cpp v0.9.1), its size, and its license (Apache-2.0). On Windows and Linux a Vulkan GPU driver is also required. When the weights are present but the engine is missing, the generic “缺 audio.cpp 引擎” (missing audio.cpp engine) label appears with the action “补齐 <大小>” (complete <size>).
- The “API providers” section of a capability page lists every provider in the catalog that has this capability (catalog entries marked P1 for this capability are not listed, and agents are not listed), plus any self-hosted endpoint that declares this capability. Connected providers come first, then providers that were added but have no account, and finally providers not yet added. Within each tier, catalog order applies, and self-hosted endpoints come last. Each provider is a group. Its header shows the icon, the name, and a type label (relay or self-hosted). Connected providers show the account summary and “N 个模型” (N models) on the right, are expanded by default, and can be collapsed. Providers that are not added or have no account show “配置” (Configure). Tapping it enters the provider's detail and directly expands “添加账号” (Add account), adding the provider too if it was not yet added. These groups are collapsed by default. A search box is always shown at the top. It filters by provider name and model id, and when there is a query, matching groups expand automatically. Once expanded, each model takes one row, arranged compactly. For connected providers, each row can be tested and shows the default badge. Unconnected providers only list model ids, read-only; they cannot be tested or set as default. At the end of the list is a line reading “没有你用的提供方？添加 OpenAI 兼容端点” (No provider you use? Add an OpenAI-compatible endpoint). It goes to the API providers page, opens “添加 API 提供方” (Add API provider), and focuses the name field of the self-hosted endpoint. When no provider in the catalog has this capability, this section says so in one sentence and offers “添加 API 提供方” (Add API provider). The default model selector still lists only added API providers. It does not include providers from this section that have not been added.
- Keys show only a mask: the first 3 and last 4 characters (`sk-…ab12`). Keys of 8 characters or fewer are shown entirely as dots. After saving, the original key is never shown anywhere, including when editing an account.
- Usage page: a time range (today, 7 days, 30 days, all). The top right shows spend, for example “≈ $12.34 · 按标价估算” (≈ $12.34 · estimated at list price), with a note of how many calls have unknown cost if there are any. The stat cells are call counts (including failures), text tokens (input and output), audio minutes, character counts, and image counts. A daily bar chart is stacked and colored by capability. Breakdown lists are by API provider, by capability, by model, and by account (calls, share, usage, spend). Providers that can query balance (P1) show their balance at the top. When there are no calls yet, the page says so. Only API-provider and agent calls are counted. Local models are not billed and do not enter usage.
- Costs are shown honestly (§7.4). Amounts reported by the provider, amounts estimated at list price, and unknown amounts are displayed separately and are never merged into one figure. An estimate states that it is at list price, and that list prices may be out of date. Different currencies are displayed separately and not converted.
- In the browser (Web), you can view API providers, account status, and usage, but you cannot add, modify, or remove API providers and accounts, and you cannot check balances. You can test models. The controls for the default model, parameters, keys, refreshing the model or voice catalog, and adding models are greyed out, and the page header says this must be done in the desktop app. The voice library behind “我的声音” (My voice) is not exposed to the browser. On that page, the browser states that it cannot be seen, instead of showing loading indefinitely.
- Configuration is guided by task need. Not everything is required on first launch.
- The user can pin a service and model, or choose a strategy such as local-first or cost-limited. A retry does not silently switch the model or voice. Moving from free to paid, or from local to cloud, requires fresh authorization each time.
- When a capability is unavailable, the app shows the exact reason: not installed, not connected, insufficient permission, or unsupported. Manual editing and other local capabilities stay available.
- Local models are installed by the user. The app first shows the size to download and the source, and downloads only after confirmation. Downloads can be paused and resumed, and show the bytes received. When the size is unknown, no percentage is shown. A model missing some components downloads only the missing ones, and components shared by several models are installed once. After installation, the user can run “检查” (Check), which runs the bundled sample to confirm that the model works. Check and trial are different things. Trial is the “试听” (preview) for speech synthesis and music generation. For music generation, the preview always generates a few seconds of pure music and lets the user pick only the style; it proves that this model and engine can produce sound. For models that have a trial, trial is the primary action on the row, and check and “修复…” (Repair…) are in the more menu. Models without a trial have a separate check button on the row. Whether a model is usable is shown only in one status line on that row: a check in progress (with stage and progress, cancellable, returning to the previous line after cancel), a check passed a few minutes ago, or a failure. A failure gets one sentence saying what is wrong and what to do; “修复…” (Repair…) is offered only when repair can help. The row also offers re-check and copyable technical details. If a check could not start, that is also written on this line, without a popup. Repair re-downloads only the broken files, and re-checks automatically once it is fixed. When the last check failed, the trial panel opens by explaining this. Once a trial succeeds after that check, the note is removed; the check result on the row stays until a new check replaces it. Trial failures are written in the panel, and when the user's recording cannot be read, the file name is stated. An agent may propose downloading a missing model, again stating the size first and requiring the user's confirmation. The browser and external services cannot install or delete local models. In the browser, you can only view status and run trials. Download, check, repair, delete, and default-model selection are all greyed out, and a note at the top says these must be done in the desktop app.
- Model catalog: the top of the “本机模型” (Local models) section on each capability page shows the catalog, which is shared by all capabilities. It shows which folder models are stored in, how much space they use, how much space remains on that disk, and how many models were recognized. The folder can be opened in the system. Users can move it to an external drive or to a folder shared with other programs. After a folder is chosen, the app first says how many models are already in it and how much disk space is available. When the current location has models, the user chooses between “把现有模型移过去” (Move existing models there), which shows the size to move and is disabled if it will not fit, and “只切换位置” (Only switch location), in which the original files stay and only models already in the new location are usable. Moves run in the background and show progress; on failure, everything returns to its original state. Local models cannot be used while a move is in progress. The location cannot be changed while a task is using local models. The app states the reason and offers a link to that task. If the folder is missing (for example, the external drive is not connected) or cannot be written to, the app says so honestly. The default location can be restored. When the location is set by an environment variable, it is shown read-only and cannot be changed. Remind the user that when the folder is shared with other programs, deleting a model here deletes the files in that folder. This item is not shown in the browser, and external services cannot change it.
- Model download source: at the bottom of the “本机模型” (Local models) section on each capability page is a collapsed “下载与存储” (Download and storage) section. The current download source is written beside its title. When expanded, the user can choose Hugging Face (default), ModelScope (usually faster in mainland China), or a custom mirror (enter the base URL of the mirror). An invalid address is explained on the spot, and the change takes effect only after saving. The same selector appears in Settings › General › Download source and offline. Both places change the same setting, which applies to all local models. When ModelScope is chosen, the few files it lacks are still downloaded from Hugging Face, and every file is verified against built-in checksums. The environment variable `CUCCUT_MODELS_ENDPOINT` takes precedence over the choice here, and the interface says so. In the browser, the setting is only displayed and cannot be changed.
- There are nine built-in agent engines. Claude Code, Codex CLI, GitHub Copilot CLI, Pi, and OpenCode stay in the agent list in Settings. Uninstalled ones are listed too, with install instructions. Gemini CLI, Cursor Agent, Grok, and Kimi Code connect through ACP (Agent Client Protocol), and when they are not detected they are collected under “更多” (More) below the list. Each entry in the list has its provider's icon in front (the same icon as the execution-engine selector in §3.2.3). User-added agents show the initial letter of their name. Availability is shown by the color of the icon's base block and by a status label; the icon itself does not change color with status. Built-in agents can be disabled but not removed. When an installed version is below the minimum version CucCut can drive, the app states the minimum version needed and gives the upgrade command. When the distribution package was changed, and an in-place upgrade cannot reach a usable version, the app states which package to install instead. For example, for OpenCode only the npm package @opencode/cli at 2.x is usable; the official script and the opencode-ai package, which wrap 1.x, cannot be driven. In the browser, you can only view agents and copy commands. Start and stop, re-detect, sign in, install and upgrade inside the app, the default model, and manual location are all greyed out, and the page says these must be done in the desktop app.
- Verification level: Codex and Claude Code have been verified end to end. Several agents that connect through the same ACP implementation can be used once that implementation runs on real hardware. Those not run through personally are marked “未在 CucCut 实测” (not tested in CucCut). Engines without a per-action approval channel (such as Pi) can only use full access. When another mode is selected, the reason is stated, and the mode is not changed on the user's behalf.
- Other command-line agents that support ACP are added by the user in one of two ways. The first is from a searchable directory, where each entry has a name, a one-sentence introduction, and a launch command, pinned to a version that is fetched and run on demand through npx or another package manager. The second is a custom command. It takes an id (starts with a lowercase letter, uses only lowercase letters, digits, and hyphens, and must not duplicate a built-in, added, or directory entry), a name, and one launch command. The command is split on spaces into a program and its arguments, and quoted text counts as one argument. It is launched directly, not through a terminal, so pipes and redirects do not work. Environment variables can be attached, one `KEY=VALUE` per line. Values stay on this machine, and the interface shows only the names. A field that is wrong is explained in place, and nothing is added until it is corrected. The interface notes that added agents have not been individually verified by CucCut. The browser and external services cannot add or remove them.
- Added agents are detected, signed in to, and have their model table read in the same way as built-in agents. The model table exists only after detection. When an agent is not detected, it stays in the main list and is not collapsed into “更多” (More). It also does not appear in the agent selectors of sessions and tools. Once detected, it is treated the same as a built-in agent. Added agents can be removed, after confirmation. Removal also clears their enabled state and default-model preference. If the removed agent was the default, one of the remaining available agents takes over, and any task using it ends with an explanation.
- Font downloads (§5.9): in settings the user can turn off automatic download, enter a mirror address (https only), view the downloaded fonts and their total size, and delete them one by one or clear them all. Downloads send only the family name and weight, and need no account or key. In strict offline mode, nothing is downloaded. The browser and external services cannot download or delete fonts.
- The video download tool (yt-dlp) is not bundled with the app. When importing from a link for the first time, the app first shows the tool's name, source, version, size, and license, and downloads it only after the user agrees. The user can also point to their own installed copy. Consent can be withdrawn, after which importing from links is disabled. Settings lists the status of external tools (not installed; installed, with version and source; needs update; unavailable) along with remedies. yt-dlp is under Settings › Video download. When an agent needs to download the tool, the user confirms first, in the same way. The browser and external services cannot install tools, and the browser cannot import from links. External services can download from links only after the user has installed yt-dlp and agreed to its use, and only into videos or projects within their scope (§2.7).

### 7.7 Logs, Diagnostics and Deletion〔NFR-03〕

- By default, original video, audio, full subtitles, prompts or keys are not collected.
- Product analytics are limited to necessary events and performance summaries; non-essential collection can be turned off.
- Before exporting diagnostic information, the user can preview it and redact it, and the scope is shown.
- For the semantics of deletion, see §4.9.

### 7.8 Reopening, Quitting and Background Running〔COL-05〕

- Closing the window only stops observing; task and service state is kept.
- When the desktop app is quit while tasks are active, the user chooses “继续在后台运行” (continue running in the background) or “停止服务及相关的本地执行” (stop the service and related local execution). The interface also lists steps that may still be running or billing on the remote side.
- Background running depends on the service process and the device staying on. It does not guarantee that local rendering continues after shutdown, sleep, or service stop.
- After a crash and reopen: all committed changes are kept; unfinished steps are shown by their type as resumable, needing reconciliation, or needing to be restarted, rather than uniformly as “继续” (continue). The recovery matrix is in the architecture design §7.

---

## 8. Quality and Delivery

### 8.1 Quality Is Part of the Process〔QUA-01〕

Quality issues fall into three categories:

| Category | Examples | Handling |
| --- | --- | --- |
| Hard program errors | Missing structure, undecodable data, unauthorized outbound transfer, use of a required effect not yet supported, script and audio mismatch | Must be resolved; cannot be bypassed with a generic “仍然导出” (export anyway) |
| Content issues that can be found with assistance | Subtitle occlusion, inconsistent terminology, lost numbers, voiceover that does not fit the time window | List them and suggest fixes; the user can review and accept |
| Creative judgment | Pacing, style, narrative | Left to the user |

If a frozen font is missing or changed at export time, an acceptable replacement must first be explicitly chosen by the user, and then the frozen inputs are regenerated and checked. Fonts downloaded on demand that were not downloaded, or whose download failed, are not in this category: export directly with the fallback font and give a warning (which family, what it is replaced with, and why). Do not block the export or require a replacement to be chosen first (§5.9). Intentional black frames, silence and pauses are not automatically treated as faults.

### 8.2 Quality Reports Must Be Honest〔QUA-02〕

A check report records: which version was checked, by what method, what scope was covered, which scope was not covered, what was found, the severity, and which warnings the user accepted.

- Spot-checking key frames is not a frame-by-frame check of the whole film; reading the script is not listening to the audio.
- Screenshots taken from proxy-quality footage cannot be used to prove export quality.
- Semantic and style judgments remain for human review.

### 8.3 Preview and Final File Are Two Kinds of Delivery〔OUT-01〕

- Previews are for judging direction; they may use proxy quality and must be labeled as such.
- Export freezes one definite video version and all inputs. The user can keep editing during export; this export does not read the new state.
- Pre-export checks: missing media or fonts, stale translations or voiceovers, orphaned anchors, clips beyond boundaries, unauthorized network access, effects not yet implemented, incompatible output settings.
- Export writes to a temporary location first, and publishes only after verifying frame count, duration, audio tracks and decodability. A failure never overwrites an existing successful file.
- 100% encoding progress does not mean the file is usable. A file check and a sampled visual check are two different coverage scopes and do not stand in for each other.
- Exporting only a subtitle file does not require rendering video.
- When the output frame rate differs from the video editing frame rate, the export window explains the rule for frame count and trailing duration (video format spec §2).
- In the desktop app, after clicking the final “导出” (Export) button on the export settings page, for a single file the system save dialog opens first. The user chooses a path and confirms or edits the file name; the task is created only after confirmation. Cancelling or a dialog failure does not start the export. The default file name follows the export summary. A folder already selected is used as the dialog's initial location; otherwise the finished video goes to the folder of the source video (the material that appears earliest on the timeline). When exporting several files at once, the output folder is chosen first, each file keeps its own name, and no two settings are given the same file name. When an existing file is selected, the system dialog confirms replacement, and replacing that file is allowed only after that confirmation.
- Browsers without a system save dialog, and CLI / agent exports, continue to save according to the export destination contract. If no location is chosen for the finished video, the desktop app exports to the folder of the source video (the material that appears earliest on the timeline); if the source video is inside the videos folder, or when exporting from a browser, it goes to the project's `exports/`. Audio, subtitles, transcripts and project files with no chosen location go to the project's `exports/`. The default file name of the finished video carries the language of the burned-in subtitles on screen (`访谈.zh-Hans.mp4`). Unless replacement is explicitly confirmed, a same name gets a sequence number and existing files are not overwritten.
- The export window and background tasks show speed (fps) and estimated remaining time (`m:ss`, or `h:mm:ss` beyond one hour) while rendering. The export row of the video card in the session shows the remaining time (§3.2.2). Both are estimated from progress over the last few seconds; when speed cannot yet be calculated, nothing is shown. Nothing is made up.

The contract for frozen export is in the architecture design §9.

### 8.4 Editable Delivery〔OUT-02〕

- **P0**: keep the local video that can be reopened, references to the original material, sound, and the author's source code.
- **P1**: a portable package that collects referenced media, fonts, code and a dependency manifest. The manifest lists missing assets, assets that are link-only, and assets not included because of license restrictions.
- A pre-rendered MP4 is playable media, but it is not the same as an editable source.
- A package that includes source code pins dependency versions and includes what is needed to work offline; it cannot claim it can be rebuilt offline just because it has a lock file.
- Packaging does not include keys, protected machine paths, or files the task is not authorized to include.
- Proxy files or pre-rendered previews let the user browse first, but they cannot be treated as having restored an editable source.

The portable package format is in the video format spec §8.

### 8.5 Input Compatibility〔SET-02〕

- Accepts common video, audio, image and subtitle formats. Inputs that cannot be decoded or can only be partly used are explained honestly, with the reason and the usable scope (for example, only audio is usable, variable frame rate, no word-level timing).
- When user-provided subtitles or transcripts have no word-level timing, keep an explicit low-precision status and do not fabricate word-level timing.
- Importing a legacy project is a one-way conversion: it generates a new video and does not modify the original files; content that cannot be converted is listed in a report. Imported videos keep their recent activity from the legacy project (last opened or last edited), and in Space they stay in their original order and are not moved to the top because of the import. Whether legacy project import is part of P0 is in §12.
- Before importing a legacy project, ask once: whether to import, and where to import to (default: the `CucCut` folder under Documents (文稿 / 文档)). The user may choose not to be reminded again. The import runs in the background; the task page has a single “导入旧版项目” (Import legacy projects) task, and a bar at the top of Home reports progress. When the run finishes with projects not imported, the task card and that Home bar state the reason and what to do. The task details group the unimported projects by reason; each group explains the reason and the remedy (reconnect the drive, put the files back where they were, view the import record in the folder). Each project can be retried or skipped. A skipped project is not imported automatically again, but it can be changed to import later. Anything unhandled is retried automatically on the next launch. The implementation is in the architecture design §2.7.

### 8.6 Performance and Reliability〔NFR-01, NFR-02〕

- Operations are confirmed quickly and show the scope they are bound to; stop takes effect quickly; common native content positioning is smooth. Target values and measurement methods are in acceptance and testing §4.
- A video containing only native content does not start the code rendering environment. When exporting again after only changing subtitles, code animations that have not changed are not recomputed.
- Confirmed videos are not lost; a crash does not produce a half-committed change; a retry does not produce duplicate changes or duplicate charges.
- Complex scenes that cannot meet performance targets have their supported scope reduced, or use a labeled proxy preview; averages are not used to hide devices on which something is unusable.

---

## 9. End-to-End Workflows

All workflows follow the same closed loop:

```text
Understand and bind the selection → read frozen inputs → generate proposal or artifact → validate → apply as transaction → preview and quality check → export
```

Each workflow below describes user intent, what the system does, how it can be changed afterwards, where the boundaries are, and what counts as passing. The data objects involved are described in the video format spec; the mechanisms are in the architecture design.

### S01: Add Subtitles to a Video

**User intent**: “给这个视频加中文字幕，修正错字，原视频声音不变。” (Add Chinese subtitles to this video, fix typos, keep the original video audio unchanged.)

**Process**: Import the video, create a video instance and route the original audio. Run speech recognition, or accept a transcript provided by the user. If there is word-level timing, build a speech document; if not, keep an explicit low-precision status. Derive sentences and source subtitles from the edited speech view, and apply typesetting rules. Typo corrections may be proposed, but the actual meaning of what is spoken must not be changed under the pretext of “polishing subtitles”.

Subtitles are an editable subtitle layer, not a video burned into a new MP4 and then placed back. Style is separate from text content: afterwards, changing font size, shadow or background color only updates the style and does not re-run recognition.

```text
Video material → speech recognition → speech document
                                          ↓
                          subtitle rules + subtitle instances
                                          ↓
                    native subtitle rendering / subtitle file export
```

**Later changes**: Correcting a typo only affects the related words, sentences and dependent items. Manual line breaks are fixed; re-running automatic typesetting does not overwrite fixed line breaks.

**Boundaries**: If there is no audio track, report that there is no speech to transcribe. Low-confidence words caused by background noise are marked for review. Subtitles already burned into the picture may duplicate the new subtitles; flag this in the preview and do not erase the text in the original picture on your own.

**Pass criteria**: With the subtitle layer turned off, the unchanged original video is visible; the original audio is unchanged; applying the same result again does not produce a second subtitle track; exporting only SRT does not start video rendering.

### S02: Translate Subtitles, Output Bilingual or Multiple Language Versions

**User intent**: “翻译成英文，保留中文，显示双语；专有名词按术语表。” (Translate into English, keep the Chinese, show bilingual; proper nouns follow the glossary.)

**Process**: Submit translation sentence by sentence, with stable IDs, text, necessary context and the glossary. Do not translate isolated screen lines one by one. After getting natural translated sentences, generate semantic alignment blocks separately, then derive target-language subtitles at the block boundaries. Chinese and English may have different numbers of subtitle entries and different line breaks.

On apply, create a new translation document and target-language subtitle rules; do not overwrite the Chinese speech document. The bilingual layout specifies two language streams, their positions, safe areas and display policy. Translating subtitles does not generate new audio. Display timing is aligned to the source speech's semantic blocks; this is not the actual word-level timing of the English as spoken.

**Later changes**: Editing an English sentence only invalidates the target alignment, display layout and linked voiceover for that sentence. Changing the line breaks of the source subtitles does not invalidate the translation. If the source sentence's content changes, check whether the translation still corresponds. When a returned result has missing sentences, duplicate IDs, lost numbers or terminology conflicts, do not accept the whole batch as an unconditional overwrite.

**Degradation**: If blocks cannot be split reliably, display the whole sentence and state that the alignment is sentence-level. Do not split into a fabricated “exact word timing” by averaging English word counts.

**Pass criteria**: Source sentences, translated sentences and display rewrites can each be viewed separately; the number of subtitle entries in the source and target languages does not need to correspond one-to-one; Chinese SRT, English SRT and the bilingual picture can each be exported separately.

### S03: Cut Spoken Content — Remove Filler Words, Long Pauses, Re-recorded and Abandoned Starts

**User intent**: “删掉明显的『嗯啊』、重复起句和过长的停顿，保留自然的呼吸。” (Remove obvious filler words “嗯啊” (um-ah), repeated sentence starts and overly long pauses; keep natural breaths.)

**Process**: Semantic detection gives the positions of words and sentences along with reasons; acoustic analysis gives measurable cut-point candidates. The interface shows pending suggestions, and the user can accept or ignore them one by one. Selecting and deleting directly in the script must be in “剪辑音画” (edit audio and picture) mode; the ordinary subtitle text-editing mode will not accidentally delete video.

The edit computes the safe boundaries, frame quantization and linked scope on the video version that was explicitly read and bound for this operation, and updates the video and audio instances, source relations, speech view, subtitles and anchors of linked elements in one pass. The original video file and the complete original transcript are not deleted.

**A reproducible example**: A 12-second source video at 30 fps, with source time [4, 6) seconds deleted. The result is two segments: source [0, 4) sits at video [0, 4), and source [6, 12) sits at video [4, 10). A subtitle originally at source [8.2, 9.0) should now appear at video [6.2, 7.0), i.e. frame range [186, 210), and not still at frame 246.

**Later changes**: The script keeps the cut regions and a restore entry; restore is a transaction with conflict checks. When an edit leaves only half a sentence, re-evaluate the translation; do not simply trim the English by the number of Chinese characters removed.

**Jump-cut wrapping**: A push-in shot is an explicit transform or crop proposal; a cutaway is a separate upper-layer video instance, muted by default, while the main speaker's audio track continues to play. A slight audio fade does not implicitly shorten the timeline.

**Pass criteria**: Can be undone and redone; subtitles do not drift; multiple instances of the same material do not mis-cut each other; locked tracks are handled according to the policy declared in advance; no source content that was finally cut is removed from the asset library.

### S04: Animation or whiteboard video from given narration, or from "text + speech synthesis"

**User intent**: "Make a whiteboard animation from this MP3 and SRT, with the camera following the narration."

**Process**: When an MP3 already exists, use that audio as the timing basis. The SRT the user provides is a timing reference; speech is not re-synthesized automatically. When there is only text, first generate the narration and get it confirmed, then obtain the real audio duration and alignment result. Then build a narration timing table that records sentences, word positions, shot intent and actual times. It is a controlled input and derived artifact, not a second clock that can drift independently.

The agent decides shots, assets and style. Simple titles, arrows and captions should use native elements where possible; complex hand-drawn paths or canvas simulations are built as code compositions. Each composition receives a local event table and parameters. At render time it does not call speech synthesis, image generation or online search.

```text
Existing audio, or a confirmed speech synthesis result
              ↓ real duration / alignment
         Narration timing table
              ↓ scene planning + asset generation
     Native instances + code composition
              ↓ shared video clock
     Picture + separate narration track
```

**Later changes**: Replacing the MP3 produces a new version; the alignment result and the scenes bound to it are marked stale according to their dependencies. Do not speed up all the picture uniformly. Changing caption styling does not regenerate images. Image generation may use external services, but its outputs must be frozen before final render.

**Quality check**: A picture may deliberately hold, but key actions must not all finish before the narration starts. Check that each narration segment's entry, emphasis, hold and exit cover the planned events. Audio-picture verification relies on the actual timing, not on "three seconds per sentence".

### S05: Agent makes an animation with p5.js / Three.js / Remotion

**User intent**: "Make an 8-second rotating Earth animation and insert it at second 12 of the video."

**Process**: Choose a suitable runtime, set up a constrained authoring workspace, and generate source, assets and a manifest. Reasonable parameters must be exposed, for example rotation speed, camera distance, title and accent color. Support for random access, audio and transparency is verified by the adapter; it is not supported merely because the agent ticks a box.

After building, check frame 0, key actions, the last frame and several random moments, and compare sequential rendering with out-of-order sampling. Once it passes, publish an immutable code package version and add a new code-composition instance. If the requested second 12 is beyond the current length of the sequence, the sequence must be extended explicitly; no hidden out-of-range object is created.

**Three modification examples**:

- "Appear two seconds later": update only the instance's start position; the original composition's cache can usually be reused.
- "Halve the rotation speed": update the instance parameter and re-evaluate this composition only, without touching other instances.
- "Add a satellite orbiting it": change the source, publish a new version, verify that the parameters are compatible, then replace the reference on the selected instance.

**Runtime differences**: p5's sequential sketches replay first and then capture frames; Three.js is evaluated according to its scene, animation and simulation contracts; Remotion uses its own player and batch renderer. The main timeline only composes their outputs and does not require arbitrary code to be converted into native shapes.

**Pass criteria**: The deliverable includes reproducible source, not just an MP4. A published package still renders with the network off. Changing native captions does not re-render an unchanged Earth. Content that cannot truly be transparent must not claim to have an alpha channel.

### S06: Add titles, arrows, logos, supplementary footage, charts or animation to an existing video

**User intent**: "When they say this sentence, add a data chart, and also put in a piece of supplementary footage."

**Process**: First distinguish whether the user's video is editable or flat. An editable video is bound directly to instances and words or sentences. A flat video is first treated as media and a video instance; screen regions identified in it are only suggestions and do not mean that its internal layers have been recovered.

Text, markers and shapes suited to manual editing are built as native instances. Complex charts can be built as code compositions, with data, title, theme and other parameters exposed. Supplementary footage is placed independently on a higher visual layer, with its audio track off by default. When the user says "along with this sentence", use a speech anchor; when they say "at second 10", pin it to sequence time by default and allow the strategy to be changed manually.

**Later changes**: If the narration later cuts the first two seconds, a speech-following chart moves with its corresponding sentence, while a fixed-position logo stays put. Changing chart data invalidates only that chart's cache.

**Boundary**: Original text in a flat video cannot be treated as native text to edit (§5.6).

**Pass criteria**: Turning off the added tracks restores the original picture; the main sound is not interrupted; new information does not land on the wrong sentence after later edits; the video's other elements are not overwritten by regeneration.

### S07: Translate and re-voice

**User intent**: "Translate this Chinese video into English dubbing, keep the picture, and sync the English subtitles to the new voice."

**Process**: First freeze the accepted narration cut version. Generate natural sentence-level translation, then separately generate a dubbing script suitable for speaking, bind speakers and voices, and present the user with the needed confirmations for uploads, payment and voice use. "Translate the subtitles" does not authorize all of these operations.

Speech synthesis generates real audio per semantic unit and registers the sampled length. The default strategy is to keep the original picture duration: if the audio exceeds the window, go to script compression or bounded stretching; units that still do not fit enter a "pending adaptation" state. After each final audio is settled, re-align, and generate subtitles timed to the new audio.

Handling of the original audio needs an explicit choice: if there is already a separate background track, keep it; if there is only a mixed track, one can propose separating it, muting it entirely and swapping in a new background, or keeping the original speech at low volume. It cannot be assumed that the speaking voice can be removed losslessly. By default the new dubbing and the original speech are not layered at equal volume.

**Application**: register voice assets and alignment → update the dubbing plan → create target-language audio instances → set target-language subtitles → set the original-audio routing for that language version. The original Chinese version stays optional and is not replaced or deleted.

**Boundary**: If one sentence fails to generate, the audio of completed sentences is not discarded; regeneration applies only to stale or failed units. If the user edits the text while generation is running, the result may be saved, but it must not be applied automatically to a script that has changed.

**Pass criteria**: Subtitles are synced to the actual English pronunciation; proper nouns, numbers and negations have been reviewed; there is no truncation, no accidental double-audio overlap, no out-of-bounds placement, and no unreasonable overlap between sentences. When the length is insufficient, stop at an explicit pending state rather than exporting a truncated result.

### S08: Local updates after changing a translation, subtitles or voice

**User intent**: "Change only the third English sentence to this wording, and keep the voice the same person."

**Process**: Locate the specific translation unit or dubbing unit; do not guess which sentence is meant from the "third subtitle" on screen. If only the on-screen subtitle text is changed, first mark the related dubbing as possibly inconsistent, and do not immediately buy new speech synthesis. When the user explicitly asks to sync the speech, update the script, generate this one unit, and redo its alignment and time adaptation.

**Scope of impact**: The voice and alignment of this one unit change; the related subtitles and any animation that responds to the voice or beats become stale; unchanged visual compositions and other dubbing units continue to be reused. If the new speech runs longer, it is still constrained by that unit's timing policy.

**Pass criteria**: The task scope, actual cost and stale markers are accurate; other languages and other sentences remain unchanged; when subtitles and dubbing are inconsistent, the interface must not still show "all synced".

### S09: Cutting the narration after subtitles, translation and dubbing have already been added

This is a scenario that must be specifically supported; the user must not be asked to "do it all again".

**Process**: The new cut first generates an edited speech view: source words still come from the original speech document, but their order, retained ranges and number of occurrences are determined by the current timeline. When only whole sentences are moved forward, the content of the natural translation remains valid, and only the display timing needs to be re-projected. When an in-sentence edit changes the effective sentence text, the translation and dubbing units are marked stale; another language's pronunciation must not be trimmed directly according to the source language's timing.

The cut reports dependency impact: which subtitles only need re-timing, which translated sentences need review, which dubbing needs regeneration, and which chart anchors no longer exist. The user may commit the cut first and keep the markers for repair; strict export requires resolving blocking items that would cause inconsistent content.

**Pass criteria**: Simple moves do not waste re-translation and re-dubbing; after deleting words within a sentence, no other language is left still speaking the deleted content; chart anchors that have disappeared are not silently attached to neighboring sentences.

### S10: Multiple languages, landscape and portrait, and release versions

**User intent**: "Output the same video as a Chinese landscape version, an English landscape version and an English portrait version."

**Process**: Language differences are handled by language versions, which select subtitles, dubbing, localizable text parameters and audio routing. Aspect-ratio differences create aspect-ratio versions or fork a new sequence; references to the source media and code packages are kept, and large media files are not copied.

The portrait version is relaid out for its display target. Speaker focus can use frozen face and speaking-analysis results to generate crop keyframes; when detection fails, keep an editable default crop, and do not claim that the speaker was identified accurately. Subtitles are re-set according to portrait typesetting rules; natural translated sentences are not re-translated.

A code package may declare responsive parameters or multi-size support; if it does not, it is placed by cover or contain, and cropped content is checked in advance. Do not assume that a 16:9 3D camera converted to 9:16 will still have correct composition.

**Pass criteria**: Each output is bound to an explicit version; font and safe areas are checked separately for landscape and portrait; changing a shared natural translation sentence affects only the corresponding language, and each aspect ratio is relaid out rather than re-running speech recognition.

### S11: Multi-camera, screen recording and the master audio

**User intent**: "Cut my camera and screen recording, and keep the sound always on the microphone track."

**Process**: Set up a sync group and make explicit the offset, time mapping, confidence and source of each media item relative to the master clock. Automatic alignment is the result of one analysis; the user can manually correct sync points.

Switching the picture modifies only the camera and screen video instances; the master audio track stays independent and continuous. Picture-in-picture means two layers exist at the same time. When a main speech segment is deleted, a linked cut is applied to the selected range across the whole sync group. Mixed and variable frame rates are resolved by each item's own timestamp mapping; the assembly does not pretend that they were all shot at the same frame rate.

**Pass criteria**: Changing the shot does not change the audio; when external music is locked, a linked-edit proposal must state its impact; after the sync offset changes, the related subtitle and speaker-tracking results are re-verified.

### S12: Reusing a template, handing off a video, reopening it to keep editing

**User intent**: "Use this opening for the next video, swap the title and colors; I want to keep editing it later."

**Process**: Publish reusable code compositions as code packages with parameter definitions, and publish native opening titles as nested sequence templates. A new instance overrides only parameters and media bindings and does not modify the template's original version. Old instances in the original video can still be reproduced.

When packaging a video, collect the referenced media, fonts, code and dependency manifest; do not package keys, machine paths or unauthorized user files. On opening, verify the manifest, and clearly list any missing resources.

**Pass criteria**: A frozen video with no external dependencies can be re-rendered offline; it can still be rebuilt from source after the cache is deleted; a failed parameter upgrade does not silently drop old values; fragments without source are clearly shown as media assets.

### 9.13 Two consecutive three-round demos

**Demo A: existing video.**

1. Remove obvious repetitions and long pauses, add Chinese and English subtitles, keep the original audio unchanged.
2. Select one sentence, add an explanatory diagram placed so subtitles do not cover it, leave everything else unchanged.
3. Restore the second opening sentence removed earlier, and keep the explanatory diagram following its matching meaning.

The original material and the content added in round two must be kept; the receipt must be able to locate each round's changes.

**Demo B: creation from a script or voiceover.**

1. Make a light hand-drawn style explainer short, keeping the full narration.
2. Change the act-two chart into three steps, enlarge the native title at the end, leave other scenes and sound unchanged.
3. Make act two appear a little later, but keep the total length unchanged. If the available hold time is not enough and “Keep the voice complete” and “Keep the total length unchanged” cannot both be met, state the conflict explicitly and the minimal adjustment, without truncating the voice.

Both demos must produce a real preview, an editable structure and the required final cut, and must be reopenable after three consecutive rounds. Automated regression may use fixed model artifacts or a simulated model service, but such tests must not be described as proof that real model results have passed.

---

## 10. Requirements Checklist

61 items in total. “Location” refers to the sections of this document; implementation mechanisms and data formats are reached through cross-references from those sections. “Acceptance” refers to entries in acceptance and testing §6; one entry may cover several requirements, and listing an entry does not mean it has passed.

### Agent (AG)

| ID | Requirement | Level | Location | Acceptance |
| --- | --- | --- | --- | --- |
| AG-01 | Context understanding and reference | P0 | §3.2、§6.7 | AT-11、AT-29、T09 |
| AG-02 | Planning and proactive decisions | P0 | §6.2、§6.7 | AT-03、AT-36 |
| AG-03 | Capability selection and real execution | P0 | §6.7、§7.6 | AT-34、C08 |
| AG-04 | Look at the result, then correct | P0 | §6.7、§8.1 | AT-29、AT-32 |
| AG-05 | Continuous modification and video memory | P0 | §6.4、§6.7 | AT-18、AT-33 |
| AG-06 | Meaningful ending | P0 | §6.8 | AT-01、AT-32、C07 |
| AG-07 | Agent skill: source, toggle, selection and installation | P1 | §3.2.3、§6.9 | M25 |

### Interface (UX)

| ID | Requirement | Level | Location | Acceptance |
| --- | --- | --- | --- | --- |
| UX-01 | Starting state and starting a task | P0 | §3.2.1 | AT-01、AT-34 |
| UX-02 | Preview and context selection | P0 | §3.2.3、§5.3 | AT-11、UI-10 |
| UX-03 | Working draft, candidates and comparison | P0 | §5.4 | AT-18、AT-19 |
| UX-04 | Refinement and natural-language collaboration | P0 | §5.5、§5.6 | AT-15、AT-16、AT-18 |
| UX-05 | Accessibility and state expression | P0 | §2.6 | AT-09、T30 |
| UX-06 | Home three columns and session organization | P0 | §2、§3.1 | UI-01、UI-02、UI-03 |
| UX-07 | Feature area: open the full editor and viewer on demand | P0 | §3.3、§5.1 | UI-04、UI-05、UI-10 |

### Finished Library (SPC)

| ID | Requirement | Level | Location | Acceptance |
| --- | --- | --- | --- | --- |
| SPC-01 | Finished library: all results and videos visible in one place | P0 | §4.1–§4.3 | UI-06 |
| SPC-02 | Source, status and version of items are traceable | P0 | §4.4 | UI-06、UI-07 |
| SPC-03 | Secondary editing | P0 basic / P1 model-assisted editing of images and audio | §4.6、§4.7 | UI-05、UI-07、UI-09 |
| SPC-04 | Organization, deletion and recycling | P0 | §4.9 | UI-08、AT-27 |

### Conversation (CON)

| ID | Requirement | Level | Location | Acceptance |
| --- | --- | --- | --- | --- |
| CON-01 | Conversation carries operations, not only text | P0 | §3.2.2、§6.5 | AT-19、AT-32、C07 |
| CON-02 | Question-asking rules | P0 | §6.6 | AT-03、AT-34 |
| CON-03 | Additions, queuing and redirection during long tasks | P0 | §3.2.5 | AT-19、AT-20、AT-25 |
| CON-04 | Stop, pause and undo | G | §3.2.6 | AT-20、C04 |
| CON-05 | Next steps after delivery | P0 | §3.2.7 | AT-32、AT-33 |

### Creation (CRE)

| ID | Requirement | Level | Location | Acceptance |
| --- | --- | --- | --- | --- |
| CRE-01 | Make video from text or a script | P0 | §1.2、S04、§9.13 | AT-01、AT-36 |
| CRE-02 | Make explainer or whiteboard animation from an existing voiceover | P0 | S04 | AT-02 |
| CRE-03 | Combine materials into a product demo or narrative short | P0 basic / P1 extended | §5.9、S06、S11 | AT-10、AT-31 |
| CRE-04 | Generate code animation and keep modifying it | P0 controlled templates / P1 external code | S05 | AT-03、AT-15–17、T21–29 |

### Editing (EDT)

| ID | Requirement | Level | Location | Acceptance |
| --- | --- | --- | --- | --- |
| EDT-01 | First identify which layer the input can be edited at | P0 | §5.6 | AT-17、T25 |
| EDT-02 | Text-driven voiceover editing | P0 | §5.7、S03、S09 | AT-08、AT-09、T14–16 |
| EDT-03 | Add titles, diagrams, supplementary footage and animation | P0 | S06 | AT-10、T16 |
| EDT-04 | Change one place, not remake the whole film | P0 | §6.3、§6.7 | AT-12、AT-16、AT-31 |
| EDT-05 | Long-video fine editing, aspect-ratio adaptation and multi-camera | P1 | S10、S11 | AT-28、T03、T38 |

### Language and Voice (LNG)

| ID | Requirement | Level | Location | Acceptance |
| --- | --- | --- | --- | --- |
| LNG-01 | Add and maintain subtitles | P0 | S01 | AT-04、AT-05、AT-07、AT-30、T10、T12、T39 |
| LNG-02 | Translate subtitles and review terminology | P0 | S02 | AT-06、AT-12、T11、T13 |
| LNG-03 | Text-to-speech and local audition | P0 | S04、S08 | AT-02、AT-12、T17–20 |
| LNG-04 | Translated dubbing and timing-window adaptation | P1; prioritize integrating existing stable capabilities | S07 | AT-13、T17–19 |
| LNG-05 | Edit after dubbing is complete | P1; basic invalidation notice is G | S09 | AT-14、T15 |
| LNG-06 | Language and aspect-ratio versions | P1 | S10 | AT-28、T38 |

### Assets (AST)

| ID | Requirement | Level | Location | Acceptance |
| --- | --- | --- | --- | --- |
| AST-01 | Asset status and references | P0 | §5.9 | AT-27、T05、T33、T34 |
| AST-02 | External search and generation | P1; P0 accepts manually provided assets | §5.9、§7 | AT-21–23、C10 |
| AST-03 | Styles are composable rules, not fixed workflows | P0 basic | §5.9、S04 | AT-02、AT-03、AT-31 |
| AST-04 | Save satisfying results as reusable templates | P1 | §5.9、S12 | AT-35、T34 |

### Collaboration and Versions (COL)

| ID | Requirement | Level | Location | Acceptance |
| --- | --- | --- | --- | --- |
| COL-01 | Manual operations and conversation share the video | G | §1.5、§2.2 | AT-18、T07、A01、A02 |
| COL-02 | Modification receipts and selective undo | P0 | §5.5 | AT-08、T08 |
| COL-03 | Versions and direction exploration | P0 checkpoints / P1 full branches | §5.4 | AT-28、AT-36 |
| COL-04 | Long-task results do not overwrite a newer video state | G | §3.2.4、§3.2.5 | AT-19、T09、A06 |
| COL-05 | Reopening, crash and device runtime state | P0 | §7.8 | AT-24、A04、A05、A12、C11 |

### Autonomy and Permissions (AUT)

| ID | Requirement | Level | Location | Acceptance |
| --- | --- | --- | --- | --- |
| AUT-01 | Three autonomous execution modes | P0 | §7.1 | AT-20、AT-21、AT-31 |
| AUT-02 | Permission and approval matrix | G | §7.2 | AT-21、AT-23、AT-31、C06 |
| AUT-03 | Both data flows must be explained together | G | §7.3 | AT-21、C10 |
| AUT-04 | Budget and cost display | P0 | §7.4 | AT-22、T37、C12 |
| AUT-05 | Untrusted material is not instructions | G | §7.5 | AT-23、T36 |

### Quality and Delivery (QUA, OUT)

| ID | Requirement | Level | Location | Acceptance |
| --- | --- | --- | --- | --- |
| QUA-01 | Quality is part of the process | P0 | §8.1 | AT-29、T35、T40 |
| QUA-02 | Quality reports must be honest | G | §8.2 | AT-29、C07 |
| OUT-01 | Preview and final file are different deliveries | P0 | §8.3 | AT-25、AT-26、T31、T32 |
| OUT-02 | Delivery package and long-term maintainability | P0 basic / P1 portability enhancements | §8.4 | AT-27、T34 |
| OUT-03 | Definition of task completion | G | §6.8 | AT-01、AT-32、C07 |

### Configuration and Non-functional (SET, NFR)

| ID | Requirement | Level | Location | Acceptance |
| --- | --- | --- | --- | --- |
| SET-01 | Configure capabilities per task; API provider, account and usage | P0 | §7.6 | AT-34、AT-37、C08 |
| SET-02 | Input compatibility and import of legacy projects | P0 | §8.5 | T33、T35、T40、C09 |
| NFR-01 | Responsiveness and performance targets | P0 | §8.6 | T21–24、T30、A09 |
| NFR-02 | Reliability and data integrity | G | §8.6 | AT-26、T06、T30–33、C01、C05 |
| NFR-03 | Privacy, logging and diagnostics | P0 | §7.7 | AT-21、AT-23、AT-27、T36 |

---

## 11. Release Roadmap and Success Metrics

### 11.1 Release Stages

| Stage | Main deliverables | Exit criteria |
| --- | --- | --- |
| R0 Experience and contract baseline | Home / Space UI prototype, capability list, service process, protocol, single-writer video engine, permissions, fixed test samples | No gaps in snapshots and events; command retries and commit safety on crash |
| R1 Delegable editing | Import, native subtitles and elements, manual editing, one real agent engine, tasks and receipts, Space list and video reopening | Text editing, adding elements, undo, preview and export work; no wrong objects modified |
| R2 P0 dual loops | Voiceover-based editing, bilingual subtitles, text- or voice-driven creation, controlled code animation, local maintenance, Space secondary editing | Both loops pass three consecutive rounds (§9.13); all open G constraints |
| R3 Full version | Translated dubbing and timing-window adaptation, language and aspect-ratio versions, external code import, templates, multiple agent engines | Original versions not harmed; source code maintainable; input expiry and cost reconciliation complete |
| R4 Hardening and scale | Long-form films, device matrix, performance, recovery | Measured reports exist; unverified fast paths stay disabled |

R1 is an intermediate form of the editing assistant and must not be promoted as a complete creation loop. The P0 exit is at R2.

**Starting versions.** The first half of R0 and R1 is split into four versions, delivered in order, each able to run independently:

| Version | Main deliverables | Exit criteria | Not included |
| --- | --- | --- | --- |
| 0.1 Most basic agent | Runtime process, business protocol and client SDK, Agent Harness, session storage; the agent engine connects only to Codex; a project is a directory and is the agent's working directory; entry is the command line or a minimal session page | One turn completes a full round trip through the Driver; interruption and approval go through the Harness; a closed session can be reopened and continued; the event stream has no gaps | Shell, video engine, model routing, task scheduling |
| 0.2 Shell | Desktop app: leftmost primary entries Home / Space / Tools, secondary entries Services / Background tasks, Settings at the bottom; Home's sidebar, session area and feature area; Space lists files in the project directory | Entry switching and project and session lists work; a UI reload or disconnect does not cancel a running turn | Playback and editing |
| 0.3 Player | Read-only player in the feature area: plays video files in the project directory, overlays subtitle files; subtitle list stays in sync with the picture, clicking a line jumps to its position; can be opened from both sessions and Space | Picture, sound and subtitles in sync; while scrubbing, an old frame never overwrites a newer request; no files modified | Video formats, any writes |
| 0.4 Editor | Video format and video engine land: video subdirectory, single writer, transactions, receipts, undo; timeline and manual editing; the player becomes the editor's preview | R0 exit: no gaps in snapshots and events; command retries and commit safety on crash | Agent modifying the timeline, export |

- The 0.1 architecture is built in its full shape (processes, protocol, Harness, Driver contract, session storage), but implements only the shortest path. It provides no video-domain tools: Codex works in the project directory using its own file and command capabilities.
- 0.3 plays files, not videos. The video format appears in 0.4, together with the first write.
- 0.4 has only manual editing. Two steps follow: 0.5 lets the agent modify the timeline through the same video engine, and the shared editor in §1.5 is established from here; 0.6 adds export and Space entries. R1 is complete at 0.6.

### 11.2 Scope

| Capability | P0: first closed loop | P1: full version | P2: extensions |
| --- | --- | --- | --- |
| Home and sessions | Three-pane layout, project and session lists, task cards, function area | Move sessions into projects, finer redirection and parallel collaboration | Complex batch task templates |
| Space | List, filters, viewer, secondary editing of videos and finished cuts, trash | Model-assisted editing of images and audio, template categories | Team-shared finished-asset library |
| Conversation tasks and selection | Goal card, selection binding, execution and stop, result receipt | Brush painting on frames, voice feedback, multi-region annotation | — |
| Subtitles and translation | Recognition or import, proofreading, styling, bilingual, terminology | More typesetting and format mapping | Large-scale localization production |
| Talking-head editing | Suggestions, review, restore, subtitle linkage | Long-form fine editing and sync groups | More complex multi-camera programs |
| Creation from scratch | Short video driven by text or audio | Richer narrative and long-form content | Ongoing serial content production |
| Graphics and animation | Native elements + validated Web code contract + external HyperFrames code import (`hyperframes/1`) | External Remotion code import | More runtimes and advanced control |
| Dubbing | Single-language speech synthesis, audition, local redo | Translated dubbing, speaker binding, time-window adaptation | Lip-sync and other specialized capabilities |
| Secondary editing | Local scope, before/after comparison, protected range | Complex version comparison | Team review |
| Versions and languages | Checkpoints, candidates, reliable history | Language and aspect-ratio branches and their associations | Cross-person collaboration and batch versions |
| Assets | Local import, generated candidates, source records | Search, multiple asset libraries and template reuse | Team asset library |
| Delivery | MP4, SRT / VTT, reopenable video | Portable package, more audio and formats | Publishing integration |
| Agent engine and models | One fully validated integration (Codex), with fixed selection allowed | Multiple engines and continuation handoff | More flexible capability routing |
| Permissions and reliability | All G constraints | All G constraints | All G constraints |

### 11.3 Phased rollout does not relax full-stage constraints

Safety, honest errors, correct goals, version conflicts, human protection, cost reconciliation and source-material retention are established from R0 onward and cannot later be bypassed on the grounds that "this is a P1 feature". In the starting version, agent-related constraints (honest errors, stop, permissions, untrusted material) take effect from 0.1; 0.1–0.3 do not write video, and video-related constraints take effect together with the video engine at 0.4.

Any capability that enters a product entry point inherits its full correctness and permission requirements. For example, when the existing translated-dubbing capability is brought in early, even though the new dubbing experience as a whole belongs to P1, it must still perform real audio alignment and stale-state prompts without skipping them. Capabilities not yet open are first rejected by a capability check, rather than half-opened.

Development proceeds in short loops: first get one agent engine running a session through the Harness, then build the shell, read-only playback and the video engine (the starting version in §11.1); first let manual commands write through the video engine and show receipts in the UI, then let the agent call the same set of commands; first build native subtitles that need no browser, then add code synthesis; first separate computation from the app, then expand parallelism and recovery.

### 11.4 North-star metric

**Number of videos per week that users confirm as usable and that remain editable.**

- A series of small changes to the same video is not counted repeatedly as multiple new videos within one statistics period.
- Language and aspect-ratio versions are recorded separately, but batch-exporting the same content does not inflate the primary metric.
- "Exported" is a behavioral signal and does not equal user approval. Only an explicit click on "Usable / Final" counts toward the confirmed basis. Plays, downloads or exports without confirmation are proxy metrics and must be shown separately.

### 11.5 Core metrics

| Metric | Definition | Purpose |
| --- | --- | --- |
| Dual-loop completion rate | Tasks reaching the agreed result / same-type tasks started | Look at creation and editing of existing videos separately |
| Secondary-edit correct completion rate | Local changes the user accepted with no out-of-scope changes / local changes executed | Identify "generates but cannot edit" |
| Manual correction burden | Time, operation count and reasons spent by the user correcting errors | Do not treat the user's deliberate creative choices as system errors |
| Time to first reviewable result | From the start of an executable task to a real candidate appearing | Do not substitute a first text reply for a picture |
| Retention of uninvolved content | Object and attribute checks for unauthorized changes | Tests for locked scope must have zero collateral damage |
| Recovery success rate | Interrupted tasks recovered as promised / interruptions of this type that are recoverable | Classify by local, remote and unknown state |
| Duplicate cost and duplicate submission | Number of duplicate side effects caused by system retries | Release blocking and runtime alerts |
| Subsequent continued-editing rate | Share of delivered videos effectively modified again within the observation window | Verifies maintainability; not equivalent to forced retention |
| Space secondary-edit rate | Entries opened from Space that produced effective changes / entries opened | Verifies that the finished-asset library is not just a download folder |

Tasks the user actively cancels still count in the overall started-task total and are not silently removed from the denominator. They are further broken down into: changed mind, waited too long, result unsatisfactory, budget, and technical failure. The amount of text the model returns, the number of tool calls, lines of code and the number of generated assets are not used as success metrics.

The formal target for the completion rate is set after user research establishes a baseline. This document does not invent current conversion rates or industry comparisons.

---

## 12. Items pending review

| Item | What needs deciding | Current document's assumption |
| --- | --- | --- |
| First-batch user priority | Which of the four user types in §1.3 to serve first | Not yet confirmed by market research; treated as equal |
| Where projects land in the architecture | Where artifacts of sessions without a project go | Decided: a project is a directory, identified by a marker file inside it; a video is its subdirectory, and sessions hang under the project (§2.3). Assets stay in place by default and are copied into the video only when the user chooses to (architecture design §5.1) |
| Timing of automatic creation | When a session without a project automatically creates a project and video, and whether to ask first | Decided: do not auto-create projects. The video is created in the session's own folder; it is moved into a new project named after the video only when the user explicitly asks (§2.3) |
| Initial ratio of the three panes | Default widths of the sidebar, session area and function area | Layout suggestion, needs prototype validation; narrow-window breakpoints and the single-column tab bar see §3.3 |
| Space P0 type scope | Whether manual editing of images and audio enters P0 | Secondary editing of video, finished cuts, subtitles and documents is P0; model-assisted editing of images and audio is P1 |
| Trash retention period | After how long before physical deletion | Decided: a preference, default 30 days; only items with no references are physically deleted after expiry (§4.9, architecture design §5.7) |
| Semantics of the main stop button | Whether the main button stops the whole task | Yes. Stopping the reply and cancelling steps are secondary actions. |
| First agent engine release | When the other engines are integrated; whether local models enter P0 | Decided: Claude Code and Codex CLI have been tested in practice; GitHub Copilot CLI, Pi, OpenCode, and Gemini CLI, Cursor Agent, Grok and Kimi Code connected via ACP are built in; other ACP-capable agents are added by the user (§7.6). Local models do not enter the starting version |
| Directory row on the download page | The "Change directory" on the download-video page: write back to `downloads.directory`, or change only this once, like other tool pages | §2.7 "Page" decides change-only-once, with the default save location changed in settings; the download-video block still says "Saved to `downloads.directory`, used next time", to be unified after the download tool's parallel changes land |
| Length of generated speech sent to a Space document | When text exceeds the model's single-call limit: reject, truncate or synthesize in segments | Reject first, reporting the character count and the limit; do not truncate |
| Strict offline mode | Feature boundaries and prompting method under "local only" | Per §7.3 |
| What to do with fonts that fail to download at export | When on-demand fonts are not downloaded or fail to download, whether export should stop and let the user choose a substitute | Decided: on download failure, export directly with the fallback font and show a warning (§8.1). The export panel warns before export about families still downloading, failed, or not downloaded; during export it reads "Downloading font · family percentage", and on completion it lists family → fallback font · reason. Export is not blocked and the user is not required to pick a substitute first |
| Scope of downloaded videos | Download, transcription, project and website login | Decided: the tool only downloads media files; transcription is optional, project is optional, default download is to ~/Downloads. Website login: under Settings › Video download, tick the browser cookies detected on this machine (default: all browsers, tried in order one by one; none ticked means anonymous download), plus error classification and tool update guidance. The Agent's legacy target parameter is kept for compatibility (§2.7) |
| Background policy on exit | Default to keep running or to stop | Ask each time; the choice can be remembered |
| Retention of diagnostic data | How long local diagnostic logs are kept and what they contain | Follow the minimal set in §7.7; period not yet decided |
| Legacy project import | Whether it enters P0; which source versions are supported | One-way importer; phase not yet decided |
| Fold parameters for the sub-video script | How many struck-through sentences show at each end of a clip, and how many sentences each seam line expands per click | Tentative: 3 sentences shown at each end, 10 sentences expanded per click (§5.10) |
| Paragraph timing for the sub-video script | Which clock is shown for paragraphs outside the clip and for paragraphs crossing a boundary | Tentative: kept segments show finished-cut time; a whole paragraph outside the clip shows source time, greyed out and labelled "outside clip · source time"; a paragraph crossing a boundary takes the finished-cut time of its first kept moment (§5.8) |
| Success metric targets | Baselines and targets for each metric | Pending user research |
