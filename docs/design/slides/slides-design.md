# Slides in the session

**Status: in progress (2026-10-10).** Four decisions in section 0: D1 changed to check the runtime source into the repo, and the rest confirmed on their default approach. Phase 1 (prototype) is confirmed; phases 2 to 5 are implemented (runtime package and build, Runtime slides service, host shim, skill and tools, panel tab, annotation). Annotation was verified end to end on the web; Electron has not been tested. Where the implementation differs from the design draft, this is noted inline.

## 0. Decisions

| # | Decision | Default approach | Impact |
| --- | --- | --- | --- |
| D1 | How the Slides runtime enters the repo | Source goes into `packages/slides-runtime/` and is checked into the repo; the implementation is adapted from Claude Slides. Directory layout, type conventions and CucCut's changes are described in the package README (revised 2026-10-10; originally placed in the ignored `vendor/`). The skill body is written by hand for CucCut's tools (7.1) | Section 3; release |
| D2 | Whether annotation attachments include a screenshot | P0 has no screenshot, only structured text (which page, which element, element text, comment). The screenshot moves to P1, attached as an ordinary image attachment | Changes to the attachment protocol and the composer |
| D3 | Scope of the web client | Built together with desktop. The web service's UI uses the same package, and sessions work there (architecture design §4.8, and the "Web service" row in §14). So the right-hand slides tab and annotation are both in P0; the web service mounts a separate set of routes that look up the session cookie | Effort for phases 4 and 5 |
| D4 | Asset addresses in the editor | Keep the runtime format `/_blob/<id>`, which the gateway's root-level route resolves against the "open deck". `*.localhost` subdomains are not used, because the web client cannot support them | Section 6.4 |

## 1. Goals and scope

Make, view and revise a slide deck inside a session:

1. **Create**: following the user's request, the agent writes a deck (section 2) in the session's working directory, calls `slides_check` to validate it after writing, and a slide card appears in the session thread.
2. **Open**: click the card (or the entry in Space) to open a new "Slides" tab in the panel, containing the full Slides editor. You can preview, present and edit directly; changes are written back to the deck files.
3. **Annotate**: enter annotation mode in the editor, click an element or drag a box over a region, and write a comment. The comment enters the current session's composer as a "slide annotation" attachment. Several can accumulate, and the user adds one sentence and sends them together.
4. **Revise from annotations**: the agent receives structured annotations (which deck, which page, which element, the element's original text, the comment) and changes the corresponding slide file. The picture in the editor updates accordingly.

| Scope | Content |
| --- | --- |
| P0 | The four steps above, on desktop and web (D3); single user; interface languages other than Chinese and English follow the existing multi-language support |
| P1 | Annotations with screenshots (D2); download export to PPTX and PDF; import of a single-file HTML exported from Slides as a deck |
| Not in scope | Multi-user collaboration and presence (room); share links; persistence of comment threads (annotations are one-off attachments only); sending to Google Drive / Google Slides (this part was removed from the runtime) |

## 2. Deck files

### 2.1 On-disk format

A deck is a subdirectory of the working directory (the scratch directory of a session without a project, or the project directory):

```text
<deck>/
  deck.json              index: title, order, sections, cover, faces, designSystems (Slides format v4)
  slides/<id>.html       one file per page, exactly one <section id="<id>">, inline styles, 1920×1080
  assets/<id>.<ext>      assets (images and fonts); <id> is the first 32 hex digits of the content sha256
  assets/index.json      <id> → Content-Type (optional; defaults from the file extension)
  ds/<folder>/tokens.json  copy of the tokens of an imported design system (optional; paired with the designSystems record in deck.json)
```

- The directory name is chosen by the agent from the title and does not begin with a dot (Space does not scan dot-prefixed directories).
- A directory counts as a deck when it contains `deck.json` with `v` equal to 4 and `order` as an array. Like a video directory (recognized by `video.db`), it is one entry and is not descended into further.
- The slide format, the `deck.json` fields and their limits follow the rules of the runtime compiler (`compileSlideHtml`, `normalizeDeckMetadata`). The spec is written into the skill's `references/format.md`.
- Design systems: following the skill's `references/design-system.md`, the agent installs a design system from the working directory into the deck. `tokens.json` is copied as-is to `ds/<folder>/`, and `designSystems` records one `{title, namespace, artifact, version, copiedAt}` entry (`namespace` is the same as `<folder>`). Fonts and logos are imported via `slides_import_asset`, and fonts are registered in `faces` with `src`. The editor offers that design system's colors and text styles only when both are present (runtime `files/design-systems.ts`).

### 2.2 Mapping to runtime URLs

| Runtime request | Disk |
| --- | --- |
| `GET _files.json` | Lists `deck.json`, `slides/*.html` and `ds/**`, with keys prefixed by `project/`, plus sha256, size and contentType |
| `GET project/deck.json`, `project/slides/<id>.html`, `project/ds/**` | The same-named file with the `project/` prefix removed |
| `GET /_blob/<id>` (root level) | `assets/<id>.<ext>` |
| Publish `project/<path>` | Writes back the file with the prefix removed; paths outside `project/` are rejected as `read_only_path` |
| Upload asset | Written into `assets/`; returns `{ id, url: "/_blob/<id>" }` |

The agent writes the disk format (2.1) directly and does not go through this mapping layer. The skill body uses disk paths.

## 3. Runtime placement and build

| Location | Contents |
| --- | --- |
| `packages/slides-runtime` (`@cuccut/slides-runtime`) | Runtime source, checked into git: document model, HTML compiler, editor UI, presentation and export. Directory layout, type conventions and CucCut's changes are described in the package [README](../../../packages/slides-runtime/README.md) |
| `packages/slides` (`@cuccut/slides`) | Source only: file-protocol types, deck storage (publish, assets, external changes), HTTP routes `SlidesServer`, and loading of the compiler. `./editor` is the host shim; `./editor-messages` is the postMessage protocol with the parent window (the UI imports it too) |
| `apps/slides-editor` (`@cuccut/slides-editor`) | Vite builds the editor page. Entry `src/main.ts` installs the host shim before calling `createSlidesRuntime()`. A separate esbuild bundle without UI, `dist/node/compiler.cjs`, is used by `slides_check` in Node |

- The runtime is an ordinary workspace package, added to the root lockfile, and it shares one copy of React with the workspace. PptxGenJS is pinned to 3.12.0: the 25 extensions the runtime needs are recorded in `packages/slides-runtime/patches/`, and at build time the Vite and esbuild plugins rewrite the distribution files as they are read (checking version and SHA-256). `node_modules` is not modified, and no install scripts are relied on.
- `npm run build:slides-editor` builds into `apps/slides-editor/dist/` (not in git). The page template is `apps/slides-editor/index.html` (in git); it declares file mode (`db`) and capabilities with `appifact-capabilities`. The build is skipped when the inputs have not changed (`node apps/slides-editor/build.mjs --force` forces a rebuild).
- The build output is served by the Runtime's slides route (6.2). The lookup order matches the web client: `CUCCUT_SLIDES_EDITOR_DIST`, then the packaged resources `<resources>/slides-editor/`, then the repository's `apps/slides-editor/dist/`. A directory counts only if it contains `index.html`. `startRuntime`'s `slidesEditorDist` can override this (for tests). When the build output is missing, `slides.open` still returns the address with `editorAvailable` set to false, and the page returns 503, without affecting Runtime startup. `npm run setup` and the `package:*` scripts build it first; packaging fails outright if the output is missing (`apps/desktop/README.md`).

## 4. Mapping of host capabilities

At startup the runtime reads capabilities from `globalThis.slidesHost` (types in `packages/slides/src/editor/slides-host.ts`). The capabilities the runtime uses, and their CucCut counterparts:

| Capability | What the runtime uses it for | In CucCut |
| --- | --- | --- |
| `artifact` / `self.publish(batch)` | Save: batch-writes files, each carrying `ifMatch` (the sha256 last read); a conflict rejects the whole batch | The slides route's `POST __deck/publish`, which atomically writes back to the deck directory (6.3) |
| `assets.upload(blob)` | Paste and drag-in of images | `POST __deck/assets`, written into `assets/` content-addressed |
| `user` | Current user, whether editable, display name | Fixed `user_local`; editable on desktop; not editable when the web service is configured read-only; the display name is the interface language's word for “you” |
| `comments.customAnchors` / `openComposer` | Annotation: the runtime computes the anchors and the description shown to the model, and hands them to the host to open the comment box | Section 8: the iframe passes the request to the parent window, which opens the comment box; the result goes into the composer |
| `hot.accept` | When a file changes externally, re-reads only the changed files and applies them in place | The route pushes external changes in the deck directory (6.5). Prefer `hot`; fall back to reloading the iframe if the contract proves unworkable |
| `db` | Only for decks in the old "database storage" mode; not read in file mode | **Not needed**. Speaker notes live in the slide's `<aside>`, and annotations are not persisted. `db` is not provided, and the runtime works in file mode |
| `room` | Multi-user presence, cursors, selections | Not provided (single user); the runtime skips the collaboration layer |
| `downloads` | Hands exported PPTX and PDF to the user to save | P1: on desktop, saved through the main process's download handling; on the web, saved by the browser's download |
| `chat.suggestPrompt` | Puts prompts such as "have the agent fix this page" straight into the session | Passed to the parent window via `editor:suggest-prompt`, which places it in this session's input box (appended after any existing input, for the user to send). If the tab does not belong to the session, or the parent window does not respond within 5 seconds, the runtime falls back to copying the prompt to the clipboard |
| `commentLabels` | Words in annotation position labels (`label`): page number, text role, element kind and shape, region orientation, number of elements covered by a box selection | Added by CucCut. Words are chosen by `?lang=` on the editor address (the interface language when the tab was opened); if absent, the runtime uses its own English. `detail` does not pass through here and stays English (8.2) |

## 5. Editor page and host shim

- The editor page is served by the slides route: `<base>/index.html` and static assets, plus a host shim (built into the entry, executed before `createSlidesRuntime()`).
- Files, assets and external changes go over same-origin HTTP (the shim requests the route directly, not via the parent window).
- Annotation and "open in session", which need the CucCut UI, go through `postMessage`:
  - On desktop the parent page is `file://`, with origin `null`. iframe → parent can only use `targetOrigin: "*"`. The parent must check `event.source === iframe.contentWindow` when receiving messages, and messages carry nothing beyond the content. parent → iframe targets the route's origin.
  - Message types follow `packages/slides/src/editor-messages.ts`. Both sides validate every field on receipt, and unknown messages are dropped:
    - iframe → parent: `editor:ready { canEdit }`, `editor:mode { on }`, `editor:compose` (anchor, coordinates in the iframe viewport, `label`, `detail`, `area`), `editor:flushed { requestId, saved }`, `editor:external-change { paths }`, `editor:suggest-prompt { requestId, prompt }` (§4 `chat.suggestPrompt`), `editor:save-file { requestId, filename, data }` (only the design-draft editor sends this: the file exported by the runtime is handed to the parent window to save; `data` is an `ArrayBuffer` or `Blob`).
    - parent → iframe: `editor:threads` (unsent annotations `{ id, anchor, n }`; the iframe draws numbered markers), `editor:compose-result { opened }`, `editor:composer-closed`, `editor:reveal`, `editor:set-mode { on }` (the annotation toggle on the tab bar), `editor:flush` (before sending, 6.5), `editor:suggest-prompt-result { requestId, ok }` (whether the prompt was placed in the input box), `editor:save-file-result { requestId, outcome }` (`saved`, `declined` when the user cancels, `failed`).
    - Compared with the design draft, there are additional `mode`/`set-mode` (annotation mode can be toggled from both sides), `flush`/`flushed`, `external-change`, and `suggest-prompt`/`suggest-prompt-result`. The numbered markers are drawn by the shim inside the iframe (without intercepting the pointer), with positions via the runtime's `placed` callback.
- Whether editing is allowed is determined by the shim reading `__deck/session` at startup, and is passed to the runtime as `user.canEdit`.

## 6. Runtime: Slides Service and Routes

### 6.1 Open

New method `slides.open(FileTarget) → { url, deck: { title, slideCount }, editorAvailable }` (the argument is `FileTarget` itself, same as `videos.open`):

- The target points at the deck directory (the session working directory or a relative path in the project, or a Space entry). Guard against escaping the boundary by real path (reject symlinks that point outside), do not enter hidden or dependency directories, and the directory must be recognizable as a deck (2.1), otherwise `SLIDES_NOT_A_DECK`.
- Issue an unguessable grant (24 random bytes) and register `grant → deck directory`. The same directory reuses the same grant. The desktop UI and the CLI receive `<gateway HTTP base URL>/slides/<grant>/`; the Web service gives the same-origin relative address `/slides/<grant>/`. The grant lives only in memory; after a Runtime restart, the UI calls `slides.open` again.
- Both the Web default set and the read-only set include `slides.open`. In read-only mode it can still be opened, the editor is read-only, and publish and upload are rejected with 403 `not_writer` (an error code the runtime recognizes; the plan draft's `WEB_READ_ONLY` is the error code of a gateway method, whereas here it is an HTTP route).

### 6.2 Routes

The gateway and the Web service share one `SlidesServer` (one storage per deck; publishes are serialized). The gateway sits after `media.handle` in the HTTP chain in `runtime.ts`. The Web service is inserted in `web-service.ts` before the "only GET/HEAD allowed" check, and requires a session cookie, same origin, and `slides.open` in the allowlist.

| Path | Method | Content |
| --- | --- | --- |
| `/slides/<grant>/`, `/slides/<grant>/assets/*` | GET | Editor page and static assets |
| `/slides/<grant>/_files.json`, `/slides/<grant>/project/*` | GET | The mapping from 2.2 |
| `/slides/<grant>/__deck/publish` | POST | 6.3 |
| `/slides/<grant>/__deck/assets` | POST | Upload assets |
| `/slides/<grant>/__deck/events` | GET (SSE) | 6.5 |
| `/slides/<grant>/__deck/session` | GET | `{ canEdit }` (added during implementation) |
| `/_blob/<id>`, `/slides/<grant>/_blob/<id>` | GET | Looks up the `assets/` of an opened deck (the latter is a synonymous address added during implementation) |

- When `/slides/<grant>` lacks the trailing `/`, respond with a 308 redirect. The editor's static files do not serve `node/` (the compiler), dot-prefixed files, or files reached through symlinks.
- **Write requests**: if `Origin` and `Host` are not same-origin, reject with 403 `not_writer`. Publish requires `application/json` (otherwise 415). Body limits are 64 MB for publish and 256 MB for assets (413 `too_large`).
- **Response headers**: the editor page must run scripts, load Google Fonts (`faces.href`), and display `/_blob/` and `data:` images, so it cannot reuse `/media/*`'s `sandbox; default-src 'none'`. It has its own CSP: `default-src 'self'`; `script-src 'self'` plus the sha256 of the inline scripts in the page (computed when the page is served); `style-src`, `font-src`, and `connect-src` allow Google Fonts; images, media, and workers allow `blob:`. Deck files and assets are data and still use `sandbox; default-src 'none'`.
- **Embedding**: the `X-Frame-Options: DENY` that the Web service adds to all responses is removed on this group of routes and replaced with `frame-ancestors 'self'`. **Differs from the plan draft**: the gateway does not set `frame-ancestors`, because the desktop UI is a `file://` page and CSP cannot express "allow only it". The gateway listens only on loopback, and the grant itself is the credential (same as `/media/`).

**Desktop CSP**: the renderer's `index.html` `frame-src 'self' blob:` adds the gateway loopback address.

### 6.3 Publish

- Request: `{ files: { "project/<path>": { base64, contentType, ifMatch? } | { delete: true, ifMatch? } | null } }`.
- A write's `ifMatch` may be `null`, meaning the file must not exist yet (the editor sends this when creating a new file). A delete's `ifMatch` may only be a sha256 or be omitted.
- Publishes to the same deck run serially. First check each `ifMatch` against the sha256 on disk, one file at a time (a nonexistent file compares as `null`). If any mismatch, return 409 `{ code: "conflict", live, paths }` for the whole batch and write no files. If all pass, write each file atomically (temp file plus rename, reusing the approach of `writeJsonAtomic`).
- Error codes reuse the 13 the runtime recognizes (`PublishErrorCode` in `packages/slides/src/file-protocol.ts`). The runtime uses them to prompt the user to refresh or retry.
- Each write records the sha256 it wrote itself, to distinguish external changes (6.5).

### 6.4 Assets

- Uploads are written to `<deck>/assets/<id>.<ext>`, where `<id>` is the first 32 hex characters of the content sha256. `assets/index.json` records the Content-Type.
- Symbolic links in the deck directory are treated as nonexistent: not listed, not read, not written (publishing to such a path is rejected as `read_only_path`).
- `/_blob/<id>` is a root-level route, because slides write `<img src="/_blob/<id>">`, which under `/slides/<grant>/` would still resolve to the site root. The lookup is limited to decks that are currently open (have a grant). Not found returns 404.
- Security: the id is a content hash, so it cannot be guessed without the content. The gateway listens only on loopback, and the Web side additionally requires a session cookie.
- Not using the Artifact Store: its handles expire after one hour, unreferenced files are swept, and svg and gif are not in its extension allowlist.

### 6.5 External changes

- The agent edits deck files directly with the Driver's file tools. The route uses a non-recursive `fs.watch` on the deck root, `slides/`, and each level of regular directories under `ds/` (symlinks are not followed; debounce 300 ms). It watches directories only, to avoid Linux's recursive file watching losing later changes after an atomic save replaces an inode. After a change is received, it rebuilds the watches for added or removed directories and compares digests over the full manifest (including files that existed last time and are deleted now). Only content whose sha256 differs from both "written by us" and the content on disk when watching started (and content already reported) counts as an external change, and it is pushed to the editor via `__deck/events`. macOS FSEvents re-reports writes from shortly before watching began (a newly created deck). Comparing only against "written by us" would produce false positives, and the editor would reload needlessly.
- On receipt, the editor: the shim first notifies the parent window (`editor:external-change`), publishes its own unsaved changes, and then reloads the page. **Differs from the plan draft**: P0 does not hook the runtime's `hot` (the contract was not understood; see section 12), at the cost of losing the current selection and scroll position.
- Before sending a message (ContextBarrier, architecture design §4.6), the UI waits for the editor to publish its unsaved changes (the parent window sends `editor:flush`, the shim replies `editor:flushed`), then sends the message, so the agent reads the version the user last saw. The runtime publishes immediately only on `beforeunload`. The shim sends a cancelable `beforeunload` probe to detect unsaved changes; if there are any, it waits for this publish round to finish before asking, for at most 8 seconds.

## 7. Agents

### 7.1 skill `slides`

- Create `skills/cuccut/built-in-skills/slides/SKILL.md`: when to use it (making slides, presentations, decks; not for title cards and motion inside video frames), the on-disk format of decks, creation steps, modifying existing decks, and design principles.
- `references/`: `format.md` (the closed subset of slide tags and styles, how to write `faces`, limits), `design.md` (layouts, type-size scale, color, charts), `images.md` (where images come from, which pages get images, drawing illustrations with an image-generation model, placeholder image frames), and `design-system.md` (find, read, and install design systems, and write pages to match them). Each is kept within `SKILL_LIMITS`.
- Illustrations add no new tool: the agent generates with the model tool `image` (without `video`), saves with `artifacts_save` into the deck directory's `images/`, then imports with `slides_import_asset`. If image generation is not configured, proceed fully without illustrations and state that at delivery.
- Sync: the table in `skills/cuccut/built-in-skills/README.md`, `EXPECTED_IDS` in `builtin-skills.test.ts`, the routing table in §1 of `skills/cuccut/SKILL.md` and its media directory page (both agent-facing only), and the "Source" entry in product design §6.9. Then run `npm run build:agent-skill`.
- The two tools exist only in the session; the CLI-side craft copy does not have them. `SESSION_ONLY_TOOLS` replaces three phrasings in that copy, through end of line, with terminal phrasings: "calling `slides_check`", "calling `slides_import_asset` once per image", and "importing with `slides_import_asset` one by one" (for fonts). The terminal phrasings are: self-check the format; do not add images yet; copy the design system's fonts into `ds/<folder>/fonts/` and use `project/ds/…` as `src`. So the skill and references use only these three phrasings for these two tool names.

### 7.2 Tools

| Tool | Purpose |
| --- | --- |
| `slides_check { path }` | Checks the deck page by page with the runtime compiler. Rules match what the editor applies when reading pages: tags outside the format, CSS that would be discarded, `<title>`/`<link>`/`<style>` in page files, relative or web-hosted image paths, missing assets, inconsistent references, and unstable serialization round-trips; fonts in `faces` that the editor does not recognize or font files that are missing; what `designSystems` records (the form, duplicates, and count); and whether `ds/<folder>/` is unrecorded. Returns the list of problems. Each page also carries hints that are not counted as problems: compiler warnings, plus layout warnings beginning with "排版" (layout; text that does not fit or overlaps), with false positives for mid-word breaks ("断词") in CJK full sentences filtered out. When there are no problems, it creates or updates a slide card in the session thread (7.3). The agent must call it once after writing or modifying a deck. |
| `slides_import_asset { deck, path }` | Copies an image or font (woff2, woff, ttf, otf) from the working directory into the deck's `assets/` and returns `/_blob/<id>`. Images go into `<img src>`; fonts go into the `src` of that item in `faces`. |

- Writing the deck file itself uses the Driver's built-in file tools (the same as `video-blog` writing articles).
- The two tools are added to the tool catalog (`agent-tools/all-tool-sets.ts`). Sync the catalog page in the manual (`skills/cuccut/`) and run `npm run build:catalog`.
- The compiler runs in Node. The runtime package additionally exports a compile entry with no UI, which the Runtime imports directly, so the whole editor is not bundled.

### 7.3 Thread cards and Space

- Add a new timeline entry `slides-created { target: FileTarget, title, slideCount }`, modeled on `video-created`. The same deck is registered only once; later `slides_check` calls update the title, page count, and `taskId`.
- The thread card and the session header's "Artifacts" share one source: one item per deck, attached under the last reply of the most recent task whose check passed (if there is no reply, it is listed only under "Artifacts"). The card is one row: icon, title, and "“幻灯片 · N 页” (Chinese-locale label, "Slides · N pages")". Clicking it opens the slides tab in the function area. P0 has no first-page thumbnail (D2).
- `SpaceEntryKind` gains `slides`: the deck directory is one entry, no longer split into 1+N `document` entries. The UI's type name and icon are added to match.

## 8. UI

### 8.1 Slides tab in the function area

- `WorkspaceItem` gains `{ kind: 'slides', target: FileTarget }`. `itemKey`, the title, the icon, and `paneQuery`/`parsePane` are updated in sync.
- The content is an iframe whose address comes from `slides.open`, plus the UI language at open time as `?lang=<Locale>` (used to write the annotation-position labels, 8.2). Changing the UI language later does not reload, to avoid losing unsaved changes; it catches up the next time the deck is opened. Actions on the right of the tab bar: the annotation toggle and "Show in Space".
- On every connection to the runtime (when the connection number changes, including quick reconnects that the UI did not show as disconnected), `slides.open` is called again. After a runtime restart, the grant and address both change, so the iframe reloads. Without a restart the address is unchanged and nothing reloads.
- When the tab is not in front, or the whole right area is collapsed, the slides tab does not use `display: none`. Instead it keeps its original size, stacked, invisible, and not receiving pointer events: the editor would compute scale as very small at zero size, and on showing again it would shrink first and then spring back. Other tabs are hidden as before.
- Entry points: the slide card in the thread, the Space entry, and "Open with the slides editor" when opening `deck.json` from a file tab.

### 8.2 Annotations

1. The user turns on annotation mode in the editor (the “标注” (annotate) switch in the tab header, or the button and shortcut C built into the runtime; all three sync through `editor:mode` / `editor:set-mode`), then clicks an element or drags a box over an area.
2. The runtime calls the host's `compose(anchor, point, { label, detail, area? })`. The shim converts this into `editor:compose` and sends it to the parent window.
3. The parent window opens a comment box at the matching position in the iframe (S2 Popover, following the UI language) and replies with `editor:compose-result`. At the top is the `label` supplied by the runtime (generated by the runtime, wording follows the UI language, taken from `commentLabels` in §4, e.g. `第 3 页 › 三级标题 "AI 时代该学什么"` (page 3 › Heading 3 "What to learn in the AI era")); the `detail` for agent positioning stays in English. Below it are one input box, the buttons “取消” (Cancel) and “添加到对话” (Add to conversation), and ⌘/Ctrl+Enter adds. When the comment box closes (added, cancelled, switched tab, or exited annotation mode), it sends `editor:composer-closed`.
4. After adding, the annotation enters the current conversation's draft (per conversation, only in this window, not persisted). The parent window passes the draft's annotations that belong to this deck to the editor via `editor:threads`, and the editor draws numbered markers at the corresponding positions. If there is no conversation yet at the slide tab's position, the annotation is not collected, and a prompt asks the user to start the conversation with a message first.
5. Above the composer, a reference tag “幻灯片标注 · N 条” (slide annotations · N items) is shown. Clicking it lists each item (number, position, comment); items can be removed one by one or all at once, and their markers disappear at the same time. Clicking an item opens (or switches to) that slide deck and jumps to that page.
6. Send:
   - When only annotations are attached and nothing is written, the message body is a fixed sentence: “请按这些幻灯片标注修改。” (Please revise according to these slide annotations.), following the UI language.
   - Before sending, for each deck with annotations, the open editor is asked to publish its unsaved changes (`editor:flush` / `editor:flushed`, waiting up to 10 seconds), so the agent reads the version the user sees. If saving does not succeed, nothing is sent: the input and annotations are kept, and the prompt names the slide deck that failed to save and asks the user to send again or remove the annotations first (product design §3.2.4: do not submit with stale context). While waiting, the send button shows an in-progress state, and the text in the input box is not cleared.
   - When the conversation is busy, the message is queued together with its annotations. A queued message's “立即发送” (Send now) uses `steer`, also carrying the annotations.
   - After sending (or queuing), these items are removed from the draft, and their markers in the editor disappear. Annotations added during sending are kept.
7. Under a sent message, a line “幻灯片标注 · N 条” (slide annotations · N items) is shown. Clicking it reveals each item, and clicking an item opens that slide deck and jumps to that page (`editor:reveal`). The runtime only recognizes annotations it holds, so an item that is no longer in the draft is first handed to the editor as a temporary annotation (numbered 0, no marker drawn). After the editor renders, it jumps to the page, and then the temporary annotation is removed.

Numbers are sequence numbers across the whole draft (after sending, across the whole message): the composer list, the numbered markers in the editor, and the text given to the agent are consistent. Annotation numbers within the same deck may be non-contiguous.

## 9. Protocol for annotation attachments

Research conclusion: the existing `AttachmentRef` is a store for uploaded bytes, with a MIME allowlist and a 24-hour expiry, so it is not suitable for structured content. Following how `skills` and `references` are handled, annotations are attached to the message and, on sending, assembled into a block of text handed to the agent.

```ts
interface SlideAnnotation {
  /** Deck directory, same as the target of slides.open. */
  deck: FileTarget;
  /** Runtime anchor string, used to relocate the annotation in the editor and redraw its marker; the agent does not need to parse it. */
  anchor: string;
  /** Slide id; filled in when it can be parsed from the runtime's detail (`Slide 3 #s03 …`). */
  slideId?: string;
  /** Location for humans, generated by the runtime, e.g. `Slide 3 › Heading 3 "…"`. */
  label: string;
  /** Runtime-generated location description for the model: slide number, slide id, element path and original text. */
  detail?: string;
  /** True for area annotations. */
  area?: boolean;
  /** The comment written by the user. */
  text: string;
}
```

- Annotations in the protocol have no id. Each item in the draft additionally carries an id used only in the UI (for deletion, numbered markers, and jumping), which is stripped on sending. For items already sent, the jump id is composed from “message id + sequence number”.
- `conversations.send` and `steer` gain an optional parameter `slideAnnotations?: SlideAnnotation[]` (at most 20 per message; each comment, after trimming leading and trailing whitespace, is 1 to 2000 characters, `SLIDE_ANNOTATION_LIMITS`; no other fields are accepted). The user-message gains a field of the same name that records the request's annotations as they were. Old records lack this field, and replay is unaffected.
- The runtime uses the conversation's working directory and `locateMedia` to find each deck's directory. If it is not found, the whole item is `not-found` and no task is created.
- The harness adds `withSlideAnnotations()`, alongside `withSpaceReferences()`. It appends to the end of the text given to the agent, one section per deck, in the order each deck first appears. Numbers are sequence numbers across the whole message:

  ```text
  <cuccut-slide-annotations deck="talk/">
  1. Slide 3 › Heading 3 "AI 时代该学什么"
     定位：Slide 3 #s03: …
     批注：标题太长，拆成两行
  3. …（框选的区域：运行时给的位置说明 — area selected by the user: location text from the runtime）
     定位：Area on slide 5 #s05 … (…)
     批注：这里换成一张图
  </cuccut-slide-annotations>
  <cuccut-slide-annotations deck="decks/intro/">
  2. Slide 1 › Heading 1 "开场"
     批注：多行批注
          第二行缩进对齐
  </cuccut-slide-annotations>
  ```

  `deck` is the path relative to the conversation's working directory, ending with `/` (when the working directory itself is the deck location, it is `./`); outside the working directory it is an absolute path.
- Queued messages (`QueuedMessage`), task recovery (retries resend unchanged), and conversation replay all carry this field.
- Documentation backfill: `docs/spec/command-protocol-spec.md` now covers `attachments.prepare` and `conversations.steer`.

## 10. Specs and documents to revise

- Product design: add a “幻灯片” (Slides) section (creation in the conversation, the ribbon tab, annotations); §3.2.3 composer attachments and reference tags; §6.9 skill sources.
- Architecture design: §3.5 tool catalog, §3.10 decks in the working directory, §4.6 pre-send sync (editor flush), §4.8 new web service routes, §5.7 Space entry types.
- Command and protocol spec: `slides.open`, new parameters of `conversations.send`, `attachments` backfill.
- Acceptance and testing: add acceptance items for slides.
- Prototype `designs/cuccut/`: change the prototype first, and only after confirmation change Electron and Web (`AGENTS.md`).

## 11. Phases

| 阶段 | 内容 | 验证 |
| --- | --- | --- |
| 1 | 原型：线程里的幻灯片卡片、功能区幻灯片标签（编辑器用静态画面占位）、批注框、composer 的标注引用标签、已发送消息里的标注行；App 入口（Web 入口按 `BC_SURFACE` 规则） | `npm --prefix designs/cuccut run build`、`node --test`、两个入口过一遍预览；截图给你确认 |
| 2 | 运行时包与构建；Runtime 幻灯片服务（`slides.open`、路由、发布、素材、外部改动）；宿主 shim | 协议与存储测试；HTTP 往返测试；Electron 里打开示例 deck |
| 3 | skill、`slides_check`、`slides_import_asset`、时间线条目、Space 条目类型 | `builtin-skills.test.ts`；工具测试；在开发态用真实 Driver 让智能体做一份 deck |
| 4 | 功能区幻灯片标签（桌面与 Web）、CSP 与响应头 | 组件测试；桌面与 Web 实际页面 |
| 5 | 标注：shim 的 `comments`、批注框、composer 引用标签、协议与 Harness、回放 | 协议与 Harness 测试；端到端：标注 → 发送 → 智能体改 slide → 编辑器更新 |

## 12. Risks

- **Runtime maintenance**: the runtime is about 250k lines, so problems require reading the runtime code to investigate. The source already has complete types and no `any`; change types only in the types, not in the generated JS (package README, “结构” (Structure)). CucCut's behaviour changes are marked in code with `CucCut:` comments, and the README lists them one by one.
- **Icons**: the editor's icons come from an icon font bundled with the package, not the repo-standard S2 icons ([repo conventions §4](../../repo-conventions.md#4-interface-icons)); this will be changed later.
- **`hot` contract**: applying external changes in place depends on the callback format of `slidesHost.hot.accept`, which is not yet fully understood. P0 uses the fallback of reloading the iframe (6.5), at the cost of losing the current selection and scroll position.
- **Cross-origin iframe**: on desktop the parent page is `file://`, so the message source can only be verified via `event.source`. The shim sends no file contents to the parent window, and the parent window does not execute instructions from the iframe; it accepts only the message types listed in section 5.
- **Size**: the editor bundle is about 4 MB (about 1.3 MB gzipped). It loads only when the slide tab is opened and is not part of the main UI bundle.
