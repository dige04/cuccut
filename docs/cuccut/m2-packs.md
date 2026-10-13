# M2 — Packs

Status: design, not started. Behaviour and look follow agentcut's Packs (`.reference/agentcut/PACKS.md`,
`apps/studio/src/modules/settings/{packs-settings-view,pack-view}.tsx`); storage, protocol, tools and UI follow
CucCut's own architecture: the skills installer pattern (`packages/runtime-core/src/skills/skill-installer.ts`), the
file catalogs for templates and skills, the user library, one command gateway.

## 1. Goal and scope

A pack is a folder that carries a way of making videos to another machine: scene templates, skills, library items
(glossaries, brand colours, caption styles, images, fonts, stickers), a style guide with reference videos, and
quick actions. Installing copies the content into the places CucCut already reads (`<home>/templates`,
`<home>/skills`, the user library) and records what came from which pack. Agents read the active pack's style guide
at session start. Nothing is installed until a person has read what the pack carries.

**Built in M2**

- The pack format (`pack.json`, schema 1, `format: "cuccut.pack"`) and its spec `docs/spec/pack-spec.md`.
- Inspect, install, remove (with Undo), and restore. Sources: a local folder, a GitHub address (reusing
  `skill-github.ts`), or a plain `https://` base URL that serves `pack.json` with a `files` index (a static host
  needs no account).
- Export of the user's own templates, skills, library items, quick actions and an installed pack's style guide into
  a folder.
- Style guide: per-project choice, automatic resolution with a stated reason, a block in the agent's session
  guidance, editing the guide and its reference videos on the pack page.
- Quick actions as chips above the chat composer.
- Settings → Packs (list, import, export, pack page); editor Video menu → Style guide; read-only agent tools
  `packs_list` / `packs_read` and the edit tool `packs_choose_style`; CLI `cuccut packs …`.

**Left out, and why**

| Item | Why |
|---|---|
| Marketplace, search, `name@version` install, publish, sign-in | They need agentcut's hosted service (Workers, D1, R2, device login). A folder, a GitHub address or a static URL covers sharing without an account. |
| Recipes (sandboxed pack code) | They need a Node with `--permission` in the packaged Electron app, IPC, ffmpeg and a mapping of agentcut's EDL operations onto CucCut's command gateway; showcase's recipes are written against agentcut's EDL and would not run. Packs carry no code in M2: `recipes` in a manifest is refused with `PACK_UNSUPPORTED_FIELD`. |
| Motion, text, transition and sticker presets | They are compiled into Rust (`crates/motion/src/preset_registry/mod.rs`, `include_str!`) and the UI; no run-time loader exists. Caption styles travel as library `captionStyle` entries. |
| Rules and the review standard (`rules/`, `review.json`) | The Rules and Review-gate modules are separate M2 items that do not exist yet. Schema 1 reserves both fields; the installer keeps the files in the pack folder and shows them read-only. The owning modules install from there when they land (step 20). |
| Voices | A voice needs the owner's consent declaration (`VoiceConsent`); consent cannot travel. `.bcvoice` files in a pack are refused. |
| agentcut packs | Their templates are agentcut EDL templates, not CucCut prompt templates. Inspect recognises an agentcut manifest (no `format`, `templates` as a string list) and refuses it with `PACK_FOREIGN_FORMAT`. Importing only its portable parts is an open question (§9). |
| Web client install | Install, remove and export write to the Runtime Home from arbitrary folders or the network; like `skills.add`, they stay off the Web allowlist. The web pages show the list and pack pages read-only and say why the actions are missing. |

## 2. User flows and screens

All pages sit in the settings shell (`components/settings-page.tsx`, `RailPage`), built from `settings-ui.tsx`
panels (solid, 24px) and `cc/ui/*` primitives under `data-cc`. One tinted action per view. Text that an agent will
follow is shown in full in a red-tinted recessed box (`bg-destructive/8 ring-destructive/20`), never summarised.

### 2.1 Routes

| Route | View |
|---|---|
| `/settings/packs` | List |
| `/settings/packs/import` | Import (source, then preview) |
| `/settings/packs/export` | Export |
| `/settings/packs/<id>` | Pack page |

`import` and `export` are reserved ids (`PACK_RESERVED_IDS`). The settings route gains `sub?: string`
(`{ tab: 'settings'; section: 'packs'; sub?: string }`), parsed and printed in `state/shell-store.ts`
(`parseHref` / `hrefFor`) and linked from `model/settings-link.ts`. `packs` joins the `agents` group after `skills`
in `model/settings-nav.ts`; rail icon `Package` (lucide).

### 2.2 List (`/settings/packs`)

- Section title "Packs", blurb `packs.lede`: "A way of making videos that travels: templates, skills, library items
  and a style guide in one folder. Import one from a folder, GitHub or a web address, or export yours to send."
- Actions (when the list is not empty, desktop only): "Export a pack" (neutral), "Import a pack" (tinted).
- Rows: link cards (`PANEL_HOVER`), package icon, name, `v1.0.0 · author`, contents line
  (`packs.contents`: "1 template · 2 skills · 3 library items · a style guide · 3 quick actions", or "Nothing of its
  own"), origin line with folder/GitHub/globe icon and a `~`-shortened source, chevron.
- States: loading (`Skeleton` rows, `packs.loading` for screen readers); empty (`packs.emptyTitle` "No packs
  installed", `packs.emptyBody`, the same two buttons); web (`packs.webNote`: "Packs are installed and removed in the
  desktop app or with `cuccut packs`."); diagnostics panel for unreadable records (`packs.diagnostics`).
- Notice line (`role="status"`) after install or export: `packs.installed(name)`, `packs.exported(dir)`.

### 2.3 Import (`/settings/packs/import`)

- Back link "← Packs"; title `import.title` "Import a pack"; lede `import.lede`: "From a folder on this computer, a
  GitHub address, or a web address that serves a pack. Nothing is installed until you have seen what it carries."
- Source panel: a recessed `Input` "Folder, GitHub or web address" (monospace placeholder), "Choose folder…"
  (neutral, `host.pickDirectory`), "Read it" (tinted until a preview exists; spinner `import.reading`).
- Preview panels (`PackPreview`):
  - Header: name, version, author, badge "Not installed: read it first", description, counts.
  - Already installed: `import.installedVersion(v)` "Version v is installed. Installing again updates what the pack
    owns and keeps what you changed."
  - **Templates**: title, kind, category; `import.templateExists` "You already have a template with this id; yours
    is kept unless you replace it."; `import.templateBuiltin` "A built-in template has this id, so this one is not
    installed."; `import.templateMissingSkill(id)` "It recommends the skill “id”, which is neither on this computer
    nor in the pack."; the full `prompt.md` in a red box (`import.agentReads` "Text an agent will follow. Read it.").
  - **Skills**: name, description, the full `SKILL.md` in a red box, file count; exists / built-in notes as above.
  - **Style guide**: `import.styleLede` "Agents read this before choosing and editing."; full text in a scrolling red
    box; reference list; blocked: `import.blocked(line, why)` "This pack will not install: line N tells the agent to
    ignore its instructions (“…”)."
  - **Quick actions**: `import.quickLede` "Messages sent to the agent with one click."; each in a red box.
  - **Library**: one line per item (kind icon, name, size); duplicates: "Already in your library; not added again."
  - **Rules / Standard** (reserved): `import.reservedLede` "Kept with the pack. CucCut does not use them yet."
  - Warnings (non-blocking, triangle icon): scan hits in template prompts or skills, missing skills.
- Buttons: "Install" (tinted; disabled with the reason when blocked), "Install and replace mine" (neutral; only when
  an id clash exists with the user's own item), "Cancel". Install takes the preview token, so what is installed is
  exactly what was read. An expired token (`PACK_PREVIEW_EXPIRED`) says "This preview is more than 30 minutes old.
  Read it again."

### 2.4 Export (`/settings/packs/export`)

- Title "Export a pack"; lede: "Choose what travels. The folder can be sent as it is, pushed to GitHub, or served
  from any static host."
- Fields: Name, ID (slugged from the name until edited; hint "Lowercase letters, digits and dashes."), Version,
  Author (optional), "What it is for" (optional), Folder (path + "Choose folder…"; default
  `<projectsDir>/Packs/<id>`).
- Checkbox groups (`cc/ui/checkbox.tsx`): **Templates** (user templates only; "Built-in templates are on every
  computer already."), **Skills** (personal and pack skills, not built-in, not third-party unless ticked under
  "Imported from GitHub"), **Library** grouped Glossaries / Colours and caption styles / Images, video, stickers,
  fonts ("Voices stay: a voice needs its owner's consent."), **Quick actions** from installed packs ("· from X").
- Select "Style guide" (None, or an installed pack): "Copied from an installed pack: its guide and its reference
  videos."
- "Write the pack" (tinted). Enter in a field does not submit. Target not empty and not an earlier export of the
  same id: `PACK_EXPORT_TARGET_NOT_EMPTY` "That folder has other files in it. Choose an empty folder."

### 2.5 Pack page (`/settings/packs/<id>`)

- Not found: "No such pack" / "Nothing installed is called “id”. The list has what is here now." + "Back to packs".
- Header: name, description (or "A pack with no description."), action "Delete pack" (neutral, trash icon).
- **Delete** acts at once (no confirm): the pack is moved to the trash and a toast says
  `pack.deleted(name, n, m)` "Deleted X: n templates and m skills went with it. Library items stay." with **Undo**
  (`packs.restore`). Items changed since install stay: `pack.deletedKept(k)` "k you changed stay."
- **Where it came from**: "Version x, by y. Installed <date>. Updates are manual: import it again from the same
  place." + full source (monospace, Reveal for folders).
- **What it brought**: groups Templates, Skills, Library, each item a capsule link (templates → Home template
  gallery filtered by id, skills → `/settings/skills` detail, library → Library / Glossary). States per item:
  present, "(changed since)", "(deleted since)". Empty: "Nothing but its guide."
- **Quick actions**: list; "Offered above the chat in every project. They belong to the pack; change them in its
  folder and import it again."
- **Style guide** (style editor): lede "Who these videos are for, what a good one is, and the videos that show it.
  Agents read it before your own instructions, which win."; recessed monospace `Textarea`, counter `n / 4000` (red
  over the limit), "Save guide" (tinted only when changed; otherwise the view has no tinted action). Refusal shows the
  scan line. Reference videos: still, Title, "What to take from it", Save, Remove (acts, Undo); add form: file
  (picker), title, note, "Add reference".
- **Rules / Standard** (only when present): read-only text, "Kept with the pack. CucCut does not use them yet."

### 2.6 Editor and chat hooks

- **Video menu → Style guide…** (`components/editor/video-bar.tsx`): a 20px dialog with a `Select` "Decide on its
  own" / "None" / each pack with a guide, and the caption `style.using(name, reason)` "Using X. <reason>" or
  `style.none(reason)`. A video outside a project: the select is disabled, `style.noProject` "This video is not in a
  project, so the style is decided on its own." Footer: `style.nextSession` "Takes effect from the next session."
- **Quick actions**: a row of neutral capsule chips above the composer while the draft is empty, in the
  conversation view (`components/conversation-view.tsx`) and the editor chat (`components/editor/video-quick-chat.tsx`).
  One click sends the text; `{selection}` becomes `“<item name>”` for a selected timeline item, otherwise
  `quick.thisVideo` "this video". Tooltip `quick.from(name)` "From the pack X". Hidden when no pack has any.
- **Skills page**: pack skills show the origin label `origin.pack(name)` "From the pack X" (`model/agent-skills.ts`).
- **Home templates**: pack templates show the same label in the template detail (`model/home-templates.ts`).

### 2.7 Copy catalogs to add

`packages/ui/src/components/settings/packs-copy.ts` (+ 14 locale files; `vi` translated, others may be English),
keys grouped `list`, `import`, `export`, `pack`, `style`, `quick`, `errors` (one per `details.code`, §4.4);
`settings-nav-copy*.ts` `section.packs` "Packs"; `workspace-copy*.ts` `packsBlurb` and `packCount(n)`;
`editor-layout-copy*.ts` `styleGuide` "Style guide…"; `model/agent-skills*.ts` `origin.pack`;
`model/services-mcp-copy*.ts` `tools.packs_list`, `tools.packs_read`; CLI `apps/cli/src/admin/packs-copy*.ts`;
Runtime errors `packages/protocol/src/messages/runtime-core/rc-packs*.ts`.

## 3. Data model and storage

### 3.1 The pack folder (source)

```text
<pack>/
  pack.json
  templates/<templateId>/        CucCut template directories (docs/spec/template-spec.md), validated by loadTemplate
  skills/<skillId>/SKILL.md      skill directories, validated by loadSkill
  library/<file>                 anything library.import accepts except voices
  STYLE.md                       optional style guide
  examples/<file>                reference images and videos (+ optional <file>.jpg still)
  rules/, review.json            reserved (kept, not applied)
```

### 3.2 `pack.json` (`packages/protocol/src/pack.ts`, zod in `pack-schemas.ts`, strict)

| Field | Type | Notes |
|---|---|---|
| `format` | `"cuccut.pack"` | |
| `schema` | `1` | Other values: `PACK_UNSUPPORTED_SCHEMA`. |
| `id` | `/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/`, ≤ 64 | Not `import` / `export`. |
| `name` ≤ 80, `version` ≤ 32 (default `1.0.0`), `description` ≤ 400, `author` ≤ 80, `license` ≤ 60 | strings | |
| `templates` | `string[]` ≤ 32 | each `templates/<id>/` |
| `skills` | `string[]` ≤ 32 | each `skills/<id>/`, id per `SKILL_ID_PATTERN` |
| `library` | `{ file, name? }[]` ≤ 64 | `file` under `library/` |
| `style` | path or `""` | ≤ 4000 characters (`PACK_STYLE_MAX_CHARS`) |
| `examples` | `{ file, kind: image\|video, title ≤ 80, note ≤ 300, still? }[]` ≤ 12 | |
| `quickActions` | `{ label ≤ 40, text ≤ 2000 }[]` ≤ 12 | `{selection}` placeholder |
| `rules`, `review` | reserved, accepted as written | |
| `files` | `{ path, size, sha256 }[]` | optional for folders and GitHub, required for `https://`; written by export. When present every listed file must match. |

Limits `PACK_LIMITS`: 500 files, 200 MiB total, no symlinks or special files, no absolute paths or `..`, every file
must be named by the manifest (as an item or inside an item directory), as template-spec §6 does.

### 3.3 Installed state under the Runtime Home

```text
<home>/packs/<id>/                 the pack's own folder (rewritten on each install)
  .cuccut-pack.json                InstalledPack record (dot file, like .cuccut-skill.json)
  pack.json  STYLE.md  examples/  rules/  review.json
<home>/packs/.staging/<token>/     previews and installs in progress; previews expire after 30 min
<home>/packs/.trash/<trashId>/     removed packs, kept 24 h for Undo, purged at startup
<home>/templates/<templateId>/     installed templates (existing user dir; becomes home.templatesDir)
<home>/skills/<skillId>/           installed skills; .cuccut-skill.json = { kind: 'pack', ... }
<home>/library/...                 library entries created through LibraryService.import
<home>/store/pack-choices.json     per-project style choice
```

`InstalledPack` (`.cuccut-pack.json`, `schemaVersion: 1`):

```ts
{ id, name, version, description, author, license,
  source: { kind: 'local', path } | { kind: 'github', url, owner, repo, ref, commit, path } | { kind: 'url', url },
  manifestHash,                   // sha256 of pack.json bytes
  installedAt, updatedAt,
  provides: { templates: string[]; skills: string[] },        // everything the manifest names
  installed: {                     // only what this pack wrote, with a digest to tell edits apart
    templates: { id, dirHash }[]; skills: { id, dirHash }[];
    library: { file, library, entryId, contentHash }[] },
  style: boolean, examples: PackExample[], quickActions: PackQuickAction[],
  reserved: { rules: number; review: boolean } }
```

`dirHash` = sha256 over the sorted `(relative path, \0, bytes, \0)` of the directory, dot files excluded. An item
whose current hash differs is "changed since"; a missing one is "deleted since".

`pack-choices.json` (`PackChoicesStore`, `JsonStoreFile`, `packages/runtime-storage/src/pack-choices.ts`):
`{ schemaVersion: 1, projects: { [projectId]: string /* pack id */ | 'none' } }`. An absent key means "decide on its
own". Choices that name a removed pack stay and resolve to none with a reason.

`RuntimeHome` (`packages/runtime-storage/src/home.ts`) gains `packsDir`, `templatesDir` (the existing
`<home>/templates`, so no files move) and `packChoicesFile`. **No migration**: all files are new; `runtime.ts:911`
switches from `path.join(home.root, 'templates')` to `home.templatesDir`.

### 3.4 Provenance in the existing catalogs

- `SkillSource` (`packages/protocol/src/skill.ts`) gains `{ kind: 'pack'; packId; packName; packVersion;
  installedAt }`; `readSkillSource` parses it; `SKILL_ORIGINS` gains `'pack'` with `SKILL_DEFAULT_ENABLED.pack =
  true` (the person read the full `SKILL.md` before installing). The skill index still marks it user-installed.
- `TemplateSummary` (`packages/protocol/src/template.ts`) gains `pack: { id: string; name: string } | null`, filled by
  `TemplateCatalog` through a new `packOwner(kind, id)` option backed by the pack registry. `TEMPLATE_ORIGINS` stays
  `builtin | user`; built-in still wins on an id clash (spec §6).
- `TemplateMessageRef` gains optional `packId`, so the style resolver can see which pack a conversation used.

## 4. Runtime and protocol

### 4.1 Services (`packages/runtime-core/src/packs/`)

| File | Responsibility |
|---|---|
| `pack-source.ts` | Read a source into a staging dir: local folder (copy with limits, `COPYFILE_EXCL`), GitHub (`fetchGithubTree`, extracted from `skill-github.ts` with the limits as a parameter), `https://` (fetch `pack.json`, then each `files[]` entry, verify size and sha256; 2-minute timeout; byte caps). Refuses under `offline.strict` before any network access. |
| `pack-inspect.ts` | Validate the staged pack and build `PackPreview`: manifest, each template via `loadTemplate`, each skill via `loadSkill`, library items via `readLibraryImport` (`runtime-storage/src/library/library-exchange.ts`), style + examples + quick actions through `scanPackText`, clash state against the template and skill catalogs and the registry, warnings. |
| `pack-previews.ts` | Preview tokens → staged dir, 30-minute expiry, swept on access and at startup. |
| `pack-registry.ts` | Scan `<home>/packs/*/.cuccut-pack.json`; `list`, `get`, `require`, `ownerOf(kind, id)`, item states; unparseable records become diagnostics, not failures. |
| `pack-installer.ts` | `install`, `remove`, `restore`, `#once(commandId)`. Install order: re-validate the staged pack → library imports (reuse an entry from a previous install when `contentHash` matches) → rename template and skill dirs into place (a clash with a user item is skipped unless `replace`, which moves the user's dir to the trash first; built-in clashes are always skipped; items this pack owns and nobody changed are updated) → write the pack folder and record last. Any failure rolls back the renamed dirs and the library entries created in this attempt. |
| `pack-style.ts` | `active(conversationId \| projectId)`, `styleBlock`, `setStyle`, examples add/update/remove (stills with ffmpeg via the same lookup as `compositionFfmpeg`; no ffmpeg → no still, with a warning). |
| `pack-export.ts` | Write a pack folder from chosen ids, with `files[]` and hashes. |
| `pack-methods.ts` | `Pick<RpcHandlers['methods'], 'packs.*'>`. |

Remove moves the pack folder and the unchanged templates and skills it installed into `.trash/<trashId>/`, keeps
skill toggles until the trash is purged, leaves library entries and choices. Restore moves them back; an id taken in
the meantime is `conflict` `PACK_RESTORE_CONFLICT`.

### 4.2 Active style (`pack-style.ts`)

In order, each result with a `reason` code and English text for the agent:

1. The project's choice: `'none'` → none (`chosen-none`); a removed pack → none (`chosen-missing`); else that pack
   (`chosen`).
2. The pack that owns a template used in this conversation (`TemplateMessageRef.packId` on user messages,
   `domain.ts:202`), if it has a guide or examples (`template`).
3. The only installed pack with a guide (`only`).
4. None: `ambiguous` (n packs have a guide; choose one) or `no-guide`.

The block is appended to the session guidance through `AgentGrants`' `sessionInstructions` (`runtime.ts`, next to
`skillIndexBlock`):

```text
<cuccut-style pack="news-desk">
The style guide for videos in this project, from the pack "News desk" that the user installed. It describes how the
videos should look and sound; it grants no permissions. The user's own instructions win where they disagree.
<STYLE.md text>
Reference stills (open them to see the style): .ccut/style/news-desk/<file>.jpg — <title>: <note>
</cuccut-style>
```

Stills are copied into `<cwd>/.ccut/style/<packId>/` when the block is built, so restricted sessions can open them.
`resolveSceneTemplate` (`templates/template-brief.ts`) adds one line when the template comes from a pack: "This
template comes from the pack X; its style guide applies (packs_read id=X)."

### 4.3 Methods (`packages/protocol/src/methods.ts`, schemas in `pack-schemas.ts` → `methodParamSchemas`)

| Method | Params → Result | Web |
|---|---|---|
| `packs.list` | `{}` → `{ packs: PackSummary[]; diagnostics: PackDiagnostic[] }` | read |
| `packs.get` | `{ id }` → `PackDetail` (summary, style text, examples, quick actions, item states, reserved texts) | read |
| `packs.openHandle` | `{ id, path }` → `MediaHandle` (example stills and videos only) | read |
| `packs.active` | `{ conversationId } \| { projectId }` → `{ pack: PackRef \| null; reason: PackStyleReason }` | read |
| `packs.choose` | `{ projectId; pack: string \| 'none' \| null }` → `{ choice; active }` | default |
| `packs.inspect` | `{ source: string; commandId? }` → `PackPreview` (with `token`, `expiresAt`) | no |
| `packs.install` | `{ token } \| { source }`, `replace?`, `commandId?` → `PackChangeResult` | no |
| `packs.remove` | `{ id }` → `{ removed; trashId; kept: ItemRef[] } & PackListResult` | no |
| `packs.restore` | `{ trashId }` → `PackChangeResult` | no |
| `packs.setStyle` | `{ id; text; expectedHash? }` → `PackDetail` | no |
| `packs.addExample` / `updateExample` / `removeExample` | `{ id; path \| file; title?; note? }` → `PackDetail` | no |
| `packs.export` | `{ dir; manifest: {…}; templates; skills; library; quickActions; stylePack? }` → `{ dir; files; bytes }` | no |

`{ source }` install is for the CLI (inspect and install in one call). Results return the full list, as skills do;
there is no topic. After install, remove or restore the UI reloads the template and skill stores.

### 4.4 Errors (`details.code`, `rc-packs.ts`)

`PACK_NOT_FOUND` (not-found), `PACK_SOURCE_NOT_FOUND` (not-found), `PACK_URL_INVALID`, `PACK_INVALID` (with
`issues[]`), `PACK_UNSUPPORTED_SCHEMA`, `PACK_FOREIGN_FORMAT`, `PACK_UNSUPPORTED_FIELD`, `PACK_TOO_LARGE`,
`PACK_ID_RESERVED`, `PACK_BLOCKED` (scan hits with `{ file, line, why }`), `PACK_STYLE_TOO_LONG`
(invalid-request); `PACK_PREVIEW_EXPIRED`, `PACK_RESTORE_CONFLICT`, `PACK_TRASH_EXPIRED`,
`PACK_EXPORT_TARGET_NOT_EMPTY`, `PACK_STYLE_CHANGED`, `OFFLINE_STRICT` (conflict); `PACK_NETWORK` (unavailable).
Each goes in `docs/spec/command-protocol-spec.md` §4.1 (rows) and §11.3 (codes).

### 4.5 Validation and the text scan

`packages/protocol/src/pack-scan.ts` (dependency-free, shared by Runtime and UI): agentcut's `scanStyle` patterns
(`.reference/agentcut/packages/core/src/modules/packs/lib/style.ts`) plus Vietnamese ones ("bỏ qua … hướng dẫn /
chỉ dẫn", "tiết lộ … mật khẩu / khoá"). Blocking for the style guide, example titles and notes, and quick actions
(at install and on `setStyle`); warning only for template prompts and `SKILL.md` bodies, which are instructions by
nature.

## 5. Agent tools (`packages/runtime-core/src/agent-tools/pack-tools.ts`)

| Tool | Input | Output | Risk / effect | Surfaces |
|---|---|---|---|---|
| `packs_list` | `{}` | packs with id, name, version, description, counts, `hasStyle`, quick actions, provided template and skill ids; `active: { packId, reason }` for the session's project | `read` / query | agent, mcp, cli |
| `packs_read` | `{ id, path? }` | default: STYLE.md text + examples (title, note, still path); `path`: a text file in the pack folder (≤ 256 KiB), or for an image its absolute path and media type | `read` / query | agent, mcp, cli |
| `packs_choose_style` | `{ pack: id \| 'none' \| null, projectId? }` | `{ choice, active }`; refuses a session without a project and an unknown id | `edit` / mutation | agent, cli |

Parity: `packs_choose_style` = the Video menu's Style guide select (both call `packs.choose`); `packs_list` /
`packs_read` = the list and pack page. Inspect, install, remove, restore, export and style editing have no agent tool:
installing decides what text every later agent follows, so a person does it in the desktop UI or the CLI, as with
`skills.add`. Registered in `toolSets()` (`runtime.ts`), `all-tool-sets.ts`, the risk table in `tool-scope.ts`,
`MCP_SERVICE_TOOL_NAMES` (`packages/protocol/src/services.ts`), `services-mcp-copy*.ts`, and as `{{tool:…}}` rows in
`skills/cuccut/references/catalog/system.md`; then `npm run build:catalog` and `npm run build:agent-skill`.

## 6. UI

| Piece | File |
|---|---|
| Store (`status`, `loaded`, `packs`, `diagnostics`, `error`, `begin/succeed/fail`, `preview`) | `packages/ui/src/state/packs-store.ts` |
| Commands (one path for list, get, inspect, install, remove + restore, choose, setStyle, examples, export; reload templates and skills after changes) | `packages/ui/src/runtime/pack-commands.ts` |
| View-models: contents line, source line, item states, reason → copy, error code → copy, quick-action text expansion | `packages/ui/src/model/packs.ts` |
| List | `packages/ui/src/components/settings/packs/packs-list.tsx` |
| Import + preview panels | `…/packs/pack-import.tsx`, `…/packs/pack-preview.tsx` |
| Export | `…/packs/pack-export.tsx` |
| Pack page, style editor, references | `…/packs/pack-page.tsx`, `…/packs/style-editor.tsx`, `…/packs/pack-examples.tsx` |
| Section branch (switch on `sub`) | `packages/ui/src/components/settings-page.tsx` |
| Video menu item + dialog | `components/editor/video-bar.tsx`, `components/editor/style-choice-dialog.tsx` |
| Quick-action chips | `components/pack-quick-actions.tsx`, used by `conversation-view.tsx` and `editor/video-quick-chat.tsx` |
| Origin labels | `model/agent-skills.ts`, `model/home-templates.ts` |

Rules kept: no raw `<select>`/checkbox (primitives only), the delete acts and offers Undo (`ToastQueue` with an
action), disabled controls carry their reason, no Spectrum blue, monospace only for ids, paths and agent text.

## 7. Tests

- **Protocol**: `pack.test.ts` (manifest schema, ids, reserved ids, limits, agentcut manifest → foreign,
  `recipes` → unsupported; the sample pack `packs/news-desk` parses), `pack-scan.test.ts` (each pattern, English and
  Vietnamese, line numbers, length), `skill.test.ts` (pack source/origin).
- **Storage**: `pack-choices.test.ts` (delta, broken file kept aside, newer schema not rewritten), `home.test.ts`
  for the new paths.
- **Runtime unit**: `pack-source.test.ts` (folder limits, symlink refusal, GitHub fake via `apiBase`/`rawBase`,
  https index with wrong size/hash, offline-strict), `pack-inspect.test.ts` (clash states, builtin clash, missing
  skill, blocked style), `pack-installer.test.ts` (atomic install, rollback on a failing step, replace moves the
  user's dir to trash, reinstall updates owned items and keeps changed ones, library dedupe, `commandId` retry,
  remove keeps changed items, restore, restore conflict, trash purge), `pack-style.test.ts` (resolution order and
  every reason, block text, stills copy), `template-catalog.test.ts` / `skill-catalog.test.ts` (pack provenance).
- **Runtime end-to-end**: `packs/pack-runtime.test.ts` through `startRuntime` with a temp home and a `CucCutClient`:
  inspect → install → templates.list / skills.list show the pack → session guidance contains `<cuccut-style>` (fake
  `ToolDriver`) → remove → restore. Fixtures in `packs/testing/pack-fixtures.ts`.
- **Tools**: `registry-tools.test.ts` (packs tools across session, MCP and CLI principals), `catalog-metadata.test.ts`,
  `local-catalog.test.ts`, `tools/catalog-snapshot.test.ts`, `tools/sync-agent-skill.test.ts`.
- **Web**: `services/web-service.test.ts` — install/remove/restore/inspect/export/setStyle refused, read methods
  and `packs.choose` allowed.
- **UI**: `runtime/pack-commands.test.ts`, `model/packs.test.ts`, `model/settings-link.test.ts`, shell route
  round-trip for `/settings/packs/<sub>`, `components/settings/settings-copy.test.ts`, `copy.test.ts`,
  `tools/i18n-scan.test.ts`.
- **CLI**: `apps/cli` noun test (usage, install from folder, remove prints the Undo command).
- **QC screenshots**: seed a QC home with `cuccut packs install packs/news-desk` against `--home`, then
  `npm run build:web` and `node tools/qc-shot.mjs --home <dir> --port <port> --out <dir> /settings/packs
  /settings/packs/news-desk /settings/packs/import /settings/packs/export /settings/skills`, plus an empty home for
  the empty state. The web client shows import/export disabled; the import preview and the delete-Undo toast are
  shot from the desktop dev build (CDP), since `packs.inspect` is not a web method. Compare with
  `docs/cuccut/reference/settings.png`.

## 8. Implementation steps

Each step ends with `npx tsc -p tsconfig.json --noEmit` and `npx vitest run` on the touched areas.

1. **Spec and protocol types.** Write `docs/spec/pack-spec.md` (format, limits, install rules, reasons). Add
   `packages/protocol/src/pack.ts` (types, constants, `PACK_ID_PATTERN`, `PACK_LIMITS`, `PACK_RESERVED_IDS`),
   `pack-scan.ts`, `pack-schemas.ts` (`PACK_PARAM_SCHEMAS`, manifest schema), method entries in `methods.ts`, spread
   into `schemas.ts`, exports in `index.ts`, `messages/runtime-core/rc-packs*.ts` + `index.ts`. Tests
   `pack.test.ts`, `pack-scan.test.ts`.
2. **Sample pack.** `packs/news-desk/` in CucCut format (one scene template, one skill, a glossary and a colour
   under `library/`, STYLE.md, one example image, three quick actions; English copy) and
   `packages/runtime-core/src/packs/testing/pack-fixtures.ts`. Extend `pack.test.ts` to parse it.
3. **Home and choices store.** `packages/runtime-storage/src/home.ts` (`packsDir`, `templatesDir`,
   `packChoicesFile`), `pack-choices.ts` + test, `runtime-storage/src/index.ts`; switch `runtime.ts:911` to
   `home.templatesDir`.
4. **Sources.** Extract `fetchGithubTree` in `skills/skill-github.ts` (skills keep their behaviour and tests), add
   `packs/pack-source.ts` + `pack-source.test.ts`.
5. **Inspect and previews.** `packs/pack-inspect.ts`, `packs/pack-previews.ts` + tests.
6. **Provenance in catalogs.** `skill.ts` (`SkillSource` pack, origin `pack`), `skill-catalog.ts`
   (`readSkillSource`, origin), `template.ts` (`TemplateSummary.pack`, `TemplateMessageRef.packId`),
   `template-catalog.ts` (`packOwner` option), `template-methods.ts` (set `packId` on the marker),
   `model/agent-skills*.ts` (origin label, 15 files), `model/home-templates.ts`. Tests in both catalogs and
   `agent-skills.test.ts`.
7. **Registry and installer.** `packs/pack-registry.ts`, `packs/pack-installer.ts` (install, remove, restore, trash,
   rollback, `#once`) + `pack-installer.test.ts`.
8. **Methods and wiring.** `packs/pack-methods.ts`, `handlers.ts` (spread + deps), `runtime.ts` (construct registry,
   installer, previews, choices; startup sweep), `runtime-core/src/index.ts`, `web.ts` + `web-service.test.ts`,
   `docs/spec/command-protocol-spec.md` (§4.1 rows, §11.3 codes). `pack-runtime.test.ts` up to install/remove/restore.
9. **Style resolution and guidance.** `packs/pack-style.ts` (active, block, stills, `setStyle`), `packs.active` /
   `packs.choose` / `packs.setStyle` handlers, `AgentGrants` composition in `runtime.ts`, the pack line in
   `templates/template-brief.ts`. `pack-style.test.ts`; extend `pack-runtime.test.ts` with the guidance check.
10. **Agent tools.** `agent-tools/pack-tools.ts`, `runtime.ts` `toolSets()`, `all-tool-sets.ts`, `tool-scope.ts`,
    `protocol/src/services.ts`, `model/services-mcp-copy*.ts` (15), `skills/cuccut/references/catalog/system.md`;
    run `npm run build:catalog` and `npm run build:agent-skill`; registry and catalog tests.
11. **CLI.** `apps/cli/src/admin/packs.ts` (`inspect|install [--replace]|remove|restore|export|style`),
    `packs-copy*.ts` (15), `packs-output.ts`, register in `apps/cli/src/admin/index.ts`; test.
12. **UI data layer.** `state/packs-store.ts`, `runtime/pack-commands.ts`, `model/packs.ts`, copy
    `components/settings/packs-copy*.ts` (15, `vi` translated); tests.
13. **Settings route and nav.** `model/settings-nav.ts`, `settings-nav-copy*.ts` (15), `state/shell-store.ts`
    (`sub`), `model/settings-link.ts`, `components/settings-page.tsx` (branch, icon), `workspace-copy*.ts`; tests.
14. **List page.** `components/settings/packs/packs-list.tsx` (states, notice, web note). QC shots: list, empty.
15. **Pack page.** `components/settings/packs/pack-page.tsx` (sources, items with states, quick actions, delete +
    Undo toast, reserved texts) and `style-editor.tsx`. QC shot `/settings/packs/news-desk`.
16. **Import page.** `components/settings/packs/pack-import.tsx`, `pack-preview.tsx`. Desktop QC of the preview.
17. **Export.** `packs/pack-export.ts` + test, `packs.export` handler, `components/settings/packs/pack-export.tsx`,
    CLI `export`. Round-trip test: export → inspect → install into a second home.
18. **Reference videos.** `packs.addExample/updateExample/removeExample/openHandle`, stills via ffmpeg,
    `components/settings/packs/pack-examples.tsx`; tests with and without ffmpeg.
19. **Editor and chat hooks.** `components/editor/style-choice-dialog.tsx`, `video-bar.tsx`, `editor-layout-copy*.ts`,
    `components/pack-quick-actions.tsx`, `conversation-view.tsx`, `editor/video-quick-chat.tsx`. QC the editor with
    `@video`.
20. **Later, with the Rules and Review modules:** install `rules/` and `review.json` from the pack folder into those
    modules, show them in the preview as agent text, and resolve the review standard from the same active pack.
21. **Close-out.** Full `npm test`, the screenshot set in §7, `docs/cuccut/PLAN.md` M2 row, `templates/README.md`
    and `skills/README.md` notes on pack provenance.

## 9. Open questions

1. **Own style guide without a pack.** agentcut edits guides only inside installed packs. Should CucCut offer "New
   pack" (an empty local pack to hold the owner's guide), or is the owner's guide the Profile module's job?
2. **agentcut packs.** Import their portable parts (STYLE.md, examples, glossary → transcription glossary, quick
   actions, review.json) and mark templates/rules/recipes "not usable here", or refuse them outright (current design)?
3. **Pack skills on by default.** Current design: yes, because the person read them. Alternative: follow
   third-party (off until picked).
4. **Quick actions scope.** All installed packs (agentcut) or only the active pack for the project?
5. **Stills in the project folder.** Copying into `<cwd>/.ccut/style/` writes into the user's project. Alternative:
   an image-returning `packs_read`, which the tool bridge does not support today.
6. **Web preview.** Allow `packs.inspect` for a loopback web client so qc-shot can capture the preview, or keep the
   desktop-only rule?
7. **Recipes later.** If wanted, they need a separate design: a Node with `--permission` shipped with the app,
   recipe tools mapped onto CucCut's command gateway, and human-only trust by hash.
8. **Agent style editing.** agentcut gives agents `packs.style.set`; CucCut keeps it human-only for now. Revisit with
   the Profile module.
