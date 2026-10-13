---
description: The web editor - open a video's editor in the browser to see the rendered picture and caption placement, adjust by eye and ask the user to review; one-time access links and browser sessions, a fresh link at delivery, connection problems. Read to see the finished picture or have the user review.
---

# Web editor: viewing the picture, drag-and-drop adjustments, asking the user to review

<!-- surface: cli -->
## When to use

You only have the command line, not CucCut's editor. For the things below, which need the editor, open the web editor through the local Web service:

- **Viewing the rendered picture**: {{tool:videos_frames}} grabs the source picture (`composited: false`), without captions, text, stickers or overlaid elements; the editor's preview is rendered, so check here whether captions cover faces and whether overlays sit in the right place.
- **Playback**: watch a stretch continuously from some moment, to see either side of a cut and the visual pacing.
- **WYSIWYG adjustments**: dragging caption position, dragging or scaling elements in the picture, dragging items on the timeline, the kind of thing where position is set by eye.
- **Asking the user to review**: handing the editor to the user to look at and change themselves.

When not to use it: definite text and timeline changes (fixing words, translating, cuts, moving an item to a given second, adding chapters) always go through commands; see [editing](editing.md), [subtitles](subtitles.md). If you only want to know what is in the picture at some moment, grab frames first ([media](media.md)); if that is enough, do not open the web editor.

## Preflight

- **One Web service per machine.** It listens only on the local loopback address; its port is set in CucCut's settings, so do not hard-code it or guess it. Get the address from the Web service's `endpoint` in `cuccut services status` (present only when it is running).
- **`cuccut web open` needs no asking.** It is a local admin command, but it only starts the service locally and gives you a single-use link, without changing the video or settings; use it directly when opening the web editor. Other commands in the same group still follow the hard rule of asking the user first, especially `cuccut services configure web`, which changes the port: when the port is taken, do not change it yourself; tell the user (see "Common errors" below).
- **You need a videoId.** From `cuccut videos list` or `videoId` in a previous receipt; you can also omit the video, and the link lands on the home page.
- **If the host has a built-in browser, open it there; otherwise hand the link to the user.** Do not use system commands to open a browser for the user; to open it in the user's browser, have the user run `cuccut web open --launch` themselves (see "Delivery").

## Commands and examples

```bash
# Open the web editor straight to this video (starts the service first if needed)
cuccut web open --video <videoId>

# Open the home page only
cuccut web open
```

Open it only once per task: after getting the link, open it in the browser tool and keep reusing the same tab. Run `web open` again only when you see the login page, a 401 or a refused connection (see "Common errors").

## Reading the results

When stdout is not a terminal, it is a JSON envelope: `result.link.url` is the link, `result.link.expiresAt` is when the code expires, and `result.video` is the video you gave. In a terminal it is three lines of text: the link, which video it lands on, and the expiry time.

- The link looks like `http://127.0.0.1:<port>/home?video=…#code=…`: what follows `#code=` is a **one-time code**, valid for two minutes and usable only once. Once opened, the page exchanges it for a browser session and the code is removed from the address bar.
- **The browser session lasts 12 hours** and is bound to this port. While the session lasts, opening the address without `#code=` (for example, the part of the link above before `#`) in the same browser does not need a new login.
- It lands on this video's editor: the tab shows the video name, and under the title are the duration, aspect ratio and frame rate. In a narrow window the session is pinned as the first tab and the video is the second tab; click it if it is not selected.

## What to do and not do on the web

- **Changes are written into the same video immediately.** Dragging and edits on the web write to the same source of truth and the same edit history as commands; there is no "save" or "sync" step. So after you change something on the web, and before the next write command, read the current revision with {{tool:videos_inspect}} first; do not continue writing with the old revision number and object IDs. The same goes when the user changed something on the web.
- If something went wrong on the web, use the editor's undo or {{tool:edits_undo}}; do not reverse it by hand.
- **Do not touch the session or settings.** The web editor also has CucCut's own agent conversation and settings; do not send messages, change settings or approve anything there; those belong to the user.
- Make visual judgments only from what you actually saw; list the moments you looked at under "Looked at" in the delivery report.

## Common errors

| Symptom | Next step |
| --- | --- |
| The page is CucCut's login page, or requests return 401 | The code was used or expired, the session expired, or the service restarted: run `cuccut web open --video <videoId>` again and open the new link in the same tab |
| Connection refused, nothing listening | The service stopped or the Runtime exited: run `cuccut web open` again, which starts the service; if the port in `cuccut services status` changed, use the new address |
| `The web service didn't start: Port … is already in use` | Another program (or another copy of CucCut) holds the port from the settings. Do not change the port yourself, and do not kill the process holding it: tell the user the port is taken, and ask them to decide whether to change the port (`cuccut services configure web --port <port>`, an admin command) or close the program holding it |
| `The web client isn't built yet` | CucCut on this machine does not include the web editor (a development build that was not built): tell the user, and use frame grabs and a short export of the finished video instead |
| `VIDEO_NOT_FOUND` | Reconfirm the `videoId` with `cuccut videos list` |
| The page opened but the video did not | First check whether the video tab in a narrow window is simply not selected; if that is not it, confirm with `cuccut videos list` that the video still exists |

## Next steps

- Back to commands after looking: make changes with commands such as {{tool:edits_apply}} based on what you saw, running {{tool:videos_inspect}} before changing.
- When the user only needs to confirm the picture at a few moments, exporting a short piece of the finished video ({{tool:export}} with a range) is also a form of delivery; see [export](export.md).

### Delivery: give the user a fresh link

The link you opened yourself is already spent. At delivery, run `cuccut web open --video <videoId>` once more, give the user the new link, and explain:

- It works only once and within two minutes, so give it when the user will click right away; if the user cannot click in time, ask them to run `cuccut web open --video <videoId> --launch` in their own terminal: it opens the login page in the user's browser, and they paste the code from the terminal.
- Do not send the link anywhere else (group chats, documents); it only opens on this machine.
- Changes made on the web are written straight into the video; to undo them, use the editor's undo.

## Acceptance

- Within a task, `web open` was run only at the start, on a login page / 401 / refused connection, and at delivery, and the browser tab was reused.
- It landed on the editor of the video the user wanted (video name and aspect ratio match).
- Definite text and timeline changes all went through commands; after changes on the web, the current revision was read before the next write command.
- No port was changed, no other process was killed, and the session panel and settings were not touched.
- The user was given a fresh link, with the explanation that it works once and for two minutes.
<!-- /surface -->
