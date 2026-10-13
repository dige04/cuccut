# M2 — Publishing calendar and connections

Design for CucCut's publishing module. Behaviour and look follow agentcut's publishing module
(`.reference/agentcut/packages/core/src/modules/publishing`, `apps/studio/src/modules/publishing`); engine, storage
and data flow follow CucCut (Runtime store + service + `publishing` topic, RPC methods for the UI, `ToolSet` for agents,
MCP and CLI). Paths below are repo-relative; agentcut paths are relative to `.reference/agentcut`.

## 1. Goal and scope

**Goal.** Turn a finished video into planned releases: one *publication* per video, sent to N accounts, each with its
own text, format and time; see all of them on a calendar; move them with Undo; let an agent prepare and (when the owner
authorizes the exact revision) send them; record what actually happened on each network.

### Build now (phase 1: local only, no cloud account needed)

- Publications: prepare from a video (one or a batch), shared copy + per-destination overrides, formats, options,
  priority and expiry, archive with Undo, repeat release.
- Pinned exports: pin a finished `export` job's MP4 (or "Render and pin"), sha256-verified, immutable copy under
  `~/.cuccut/publishing/exports/`. Approval of that exact export.
- Scheduling: workspace timezone (system zone by default), weekly slots, spacing, lead time; deterministic
  `planSlots`; reservations with collision checks per real account identity; DST gap/fold refusal.
- Calendar page (Month/Week/Agenda, filters, Unscheduled inbox, drag-and-drop move with Undo, move dialog), the
  shared Publication dialog, batch prepare/review, Settings → Publishing (Accounts/Schedule/Advanced).
- Delivery through one built-in route, **"By hand"** (`manual` provider): accounts are added by name and handle; Send
  freezes the payload and puts the destination in *Waiting for you*; the delivery tab gives a posting kit (reveal
  file, copy caption, open the network's upload page); the owner records the observed result
  (Published / Scheduled in the app / Cancelled / Not sent). This is agentcut's iPhone route without the automation,
  and it uses the same states, authorization and reconcile rules as the API routes will.
- Calendar transfer (export/import JSON, `cuccut-calendar` v1), copy proposals (text model job), agent tools,
  CLI and MCP exposure.
- Human authorization of the exact revision before any send, by human or agent (§5.3).

### Designed now, built later

- **Phase 2 — API providers and the runner.** In-Runtime delivery runner with an attempts journal, provider adapter
  interface, credential keys `publish:<connectionId>`. First adapters: Postbridge and Postgun (port of agentcut's
  `server/providers/registry.ts`), each behind an explicit "Add connection". Left out of phase 1 because they are
  paid third-party SaaS needing the user's API key, agentcut never ran a live post through them ("No real social post
  has been submitted"), and Postgun was checked only against a private sibling source.
- **Phase 3 — attended iPhone Mirroring.** macOS only; needs `swiftc` (Xcode), Accessibility + Screen Recording TCC
  grants to the Electron app (restart after the grant), a nearby iPhone and a vision-capable harness. Large surface
  with no automated proof.

### Left out, and why

- **Direct YouTube / Instagram / TikTok OAuth.** Each needs a developer app registered by us or the user, a
  redirect handler (CucCut has no OAuth, PKCE, loopback callback or custom URL scheme today), and platform review:
  unaudited/unverified API clients are limited (YouTube restricts uploads from unverified projects to private;
  TikTok's Content Posting API keeps unaudited clients' posts private; Instagram's Graph API needs a Business/Creator
  account and fetches media from a public URL, which a local app does not have). Revisit after phase 2.
- **Cadence import** (agentcut `server/import-cadence.ts`): one-off migration for agentcut's owner.
- **External calendar sync** (`providers/occupancy.ts`): only meaningful with API providers; phase 2.
- **Background posting while the app is closed.** Nothing runs while the Mac is off or the Runtime is down. By-hand
  posts are reminders; API posts (phase 2) are handed to the provider right after Send with the scheduled time, so
  only the seconds between Send and the first runner tick depend on CucCut running. A queued API post whose time
  passes before it reached the provider fails instead of posting late.

### Principles (kept from agentcut)

1. One Publication = one release of one video (`videoId` + `sequenceId`) to N destinations (one per account). No
   campaign entity; a batch is a selection. A repeat release gets a new ID.
2. Publishing never edits the video or its timeline; its metadata lives in the publishing store.
3. Delivery is never automatic. A human sends, or a human authorizes the exact revision for an agent to send; any
   revision change voids the authorization.
4. Never claim "Published" or "Scheduled on {network}" without confirmation (provider response or the owner's
   recorded observation). A local reservation reads "Reserved locally".
5. One service behind every surface: UI (RPC), agent tools (session bridge), MCP, CLI (`catalog.call`).

## 2. User flows and screens

All new surfaces sit under `data-cc` and use `packages/ui/src/cc/ui/*` primitives (Glass, Button, Card, Tabs, Dialog,
Popover, Select, Checkbox, Disclosure, Calendar, DatePicker) with Tailwind v4. One tinted (yellow) primary per view,
capsule buttons, 24px cards, 20px dialogs, recessed fields, no raw `<select>`/`<details>`/native date popups.
Network icons are lucide (`SquarePlay`, `Camera`, `Music2`), never brand logos. Status never relies on colour alone.

### 2.1 Flows

1. **Prepare from the editor.** Video menu (`components/editor/video-bar.tsx`, `onVideoMenu`) gets "Publish…". It
   opens the Publication dialog for the latest non-archived publication of this video, or prepares one
   (`publishing.prepare`) seeded from the video name and the default accounts.
2. **Pin and approve.** In the dialog's Video column: "Render and pin export" submits an `exports.create`
   (`kind:'video', format:'mp4'`) for the publication's sequence; on completion the service pins the output. Or pick a
   finished export of this video. "Approve export" records approval of that exact pinned file.
3. **Tailor text.** Shared text tab, then one tab per destination (format, overrides, options, own time).
   "Propose text" runs a text-model job; the proposal card offers "Use title / description / hashtags / all".
4. **Plan time.** Default publication time, or "Reserve next free slot" (weekly slots, spacing, lead time).
5. **Send.** Footer checkbox "I reviewed this export, the text, selected accounts and times." enables the primary
   button ("Schedule publication" when every destination has a time, "Send now" when none has, "Send" when mixed),
   or "Approve for agent delivery". By-hand destinations move to *Waiting for you*.
6. **Post by hand and record.** When a by-hand destination is due, the calendar shows it in the attention bar and
   the Runtime emits a `due` event (in-app toast "Time to post "{label}" on {account}." with "Open"). Delivery tab:
   "Reveal export", "Copy caption", "Open {network} upload page", then "Record a result checked in the app".
7. **Calendar.** Navigate month/week/agenda, filter by account/status, drag to another day (keeps wall-clock time),
   Undo, open an entry, multi-select Unscheduled and "Find publishing times".
8. **Batch.** From the shorts result page (`components/editor/ai-tools-shorts-result.tsx`) "Prepare publications"
   for the cut shorts, and from Calendar's Unscheduled selection: pager dialog "Prepare N publications" with
   per-item "Reviewed this publication", "Reserve slots", "Send N publications" / "Approve for agent".
9. **Connections.** Settings → Publishing → Accounts: "Add connection" (phase 1 offers only "By hand"), add accounts
   (network, name, exact handle or channel ID), link equivalent routes, disable.

### 2.2 Routes

| Route | Href | Notes |
|---|---|---|
| `{ tab: 'calendar'; projectId?: Id; view?: 'month'\|'week'\|'agenda'; day?: string; publicationId?: Id }` | `/calendar?projectId=&view=&day=&publication=` | `publication=` opens the dialog (deep link, QC). Unknown `projectId` shows the project-not-found state, not a crash. |
| `{ tab: 'settings'; section: 'publishing' }` | `/settings/publishing` | new settings section; `?tab=accounts\|schedule\|advanced` is local UI state. |

### 2.3 Calendar page (`/calendar`) — agentcut `calendar-view.tsx`

```
┌ Glass nav (NavBar): ← Back (project / Home) · CucCut mark · "Calendar" ……… Library · Publishing ┐
 h1 "Publication calendar"  subtitle  [Export calendar] [Import calendar]  (All times in {city})
 [hint / Undo bar / attention bar]
┌──────────────────────────────────────────────────────────┬──────────────┐ lg: minmax(0,1fr) 288px
│ ‹ October 2026 › [Today]  [Month|Week|Agenda]  [All accounts▾] [All statuses▾] [Go to] │ Selected day │
│ Mo Tu We Th Fr Sa Su   (Monday first, headers in workspace tz)                         │ Unscheduled  │
│ day cells: number button (today = yellow circle, selected = tinted ring), entries      │ (checkboxes) │
│ footer: "Select a day…"  "{n} publications on the calendar"  [Previous|More]           │ By hand due  │
└──────────────────────────────────────────────────────────┴──────────────┘
```

- Built with `RailPage`-less full-width layout: `NavBar` + `PageScroll` from `cc/components/page-chrome.tsx`; the nav
  bar is the only glass; grid and aside are solid cards (`bg-card`, `rounded-3xl`).
- States: loading skeleton (`cc/ui/skeleton.tsx`); empty month ("No publications this week" / "…match these filters"
  with Clear filters or Open Library); disconnected Runtime (existing `ConnectionBanner`); project scope ("Plan
  releases for {name}." + "All projects"); video missing on this computer (entry shows Film icon, dialog read-only for
  video, text and dates editable).
- Entry card (`calendar-entry.tsx`): thumbnail (pinned export poster via media handle, or Film icon), label, status
  badge, one row per destination (network icon, account name, HH:MM). Draggable as a group when every visible
  destination is `not_sent`/`failed`; otherwise per-row move buttons. Drag MIME `application/x-cuccut-publication`.
  Keyboard path: "Move" button → move dialog.
- Move: drop keeps each destination's wall-clock time on the new day; no time → move dialog; confirmed remote
  schedules move one destination at a time with no Undo (phase 2); by-hand confirmed schedules are disabled with
  "This time is confirmed in the {network} app. Cancel it there, record the result, then prepare a new release."
- Undo bar after a local move: "Moved "{label}"." + "Undo move"; Undo calls `publishing.reschedule` with the previous
  placements and the new revision (fails safely on conflict).
- Filters are applied before pagination (server-side `publishing.calendar` for agents; the UI filters its full
  mirror, so no post-pagination filtering). Any period/view/filter change clears selection.
- Mobile (< sm): grid shows counts only; the selected day's cards render in the aside below.

### 2.4 Publication dialog (shared `PublicationForm`) — agentcut `publication-panel.tsx`

`cc/ui/dialog.tsx`, ≤ 70rem × 92dvh, 20px corners. Title = label; description "Review your video, tailor the text and
choose when it goes live." Cannot close while dirty or busy (close button hidden then; Escape refused with the
footer hint). Two columns ≥ lg, stacked below.

- Header: status badge, "Publishing connections" link (to `/settings/publishing`).
- Conflict banner (`conflict` + `PUBLICATION_CONFLICT`): "This publication changed elsewhere. Your draft is still here.
  Reload the saved version before applying it." + "Reload saved version".
- Left "Video": player on the pinned export (media handle), "Pinned export · W × H · N seconds", "Reveal export";
  "A newer edit exists. This publication keeps the pinned export until you replace it."; "Render and pin export" /
  "Render and replace export" / "Pin a finished export" (menu of this video's finished MP4 exports); "Approve export".
  Placeholders: "Render your video to preview it here." / "This calendar record's video is on another computer. Its
  text and dates are available here." Disabled controls say why (rule 1).
- Right: Accounts tiles (checkbox, network icon, "name · connection", "· reconnect needed"); empty "Connect an account
  in Publishing settings to choose a destination."; Tabs: "Shared text", one per destination, "Delivery".
  - Shared text: YouTube title, Description, Hashtags (space-separated, leading `#` stripped), "Propose text".
  - Destination: Format select, Title (YouTube), Description, Hashtags, "Reset to shared text", Disclosure "Audience,
    visibility and more" (own time, Made for kids, YouTube tags, Visibility, Disclose synthetic media, TikTok
    interaction toggles), composed caption preview with count "{n} / {limit}".
  - Delivery: per destination result card (delivery badge, confirmed time, error, "Open published post",
    "Withdraw" for waiting destinations), by-hand posting kit, Disclosure "Record a result checked in the app"
    (Observed result, Observed time, Post link, "What you verified" ≥ 10 chars, "Record verified result"); when locked,
    "Prepare a new release".
  - "Publication time" card: timezone (searchable select of `Intl.supportedValuesOf('timeZone')`, not free text),
    `PublicationTimeField` "Default publication time", summary line, "Account times" list, "Clear default
    reservation", "Reserve next free slot", Disclosure "Priority and expiration".
- Sticky footer (solid popover background): "Save changes" / "Discard changes" (dirty only), "Check publication
  readiness" (issue list or "Ready for review and delivery."), review checkbox, primary send button, "Approve for agent
  delivery" (→ "This exact publication is approved for the agent to send. Any edit requires a new approval."). The
  review checkbox resets on any revision or pinned-export change.

### 2.5 Settings → Publishing — agentcut `connections-view.tsx`

`SectionHeader` "Publishing" / "Your accounts, your schedule. Ready for the next release." + "Open calendar"; Tabs:

- **Accounts.** "Publishing connections" panel with "Add connection" (inline: "Publish through" select — phase 1 only
  "By hand" — and "Connection name"). Empty: Cable icon, "Where will your videos go?" / "Add a connection, then choose
  the accounts you want to publish to." + "Add your first connection" (the view's one tinted action). Per connection:
  name, provider, state; accounts list ("name · Network", "· disabled"), Disclosure "Link another publishing route"
  (Independent / canonical account on the same network), Disclosure "Add an account" (Network, Account name, "Exact
  account handle or channel ID", "Add account"). Remove connection/account acts and offers Undo (refused while a
  non-terminal destination uses it, with the reason).
- **Schedule.** Timezone select; Weekly times (Day select Monday-first, time input, Remove; "Add weekly time" =
  Monday 18:00; empty "Add a time to start reserving slots automatically."); Disclosure "Spacing and preparation time"
  ("Between posts (minutes)", "Prepare ahead (minutes)"); "Start new clips ready to publish" (checkbox "Prepare text
  and reserve times for generated clips", Default accounts tiles, Writing guidance textarea); "Save publishing
  schedule" → "Schedule saved".
- **Advanced.** "Remove unused pinned exports" (archived publications older than N days), "Keep archived
  publications (days)". Phase 3 adds the phone tool path here.

Rail summary (`useRailSummaries` in `components/settings-page.tsx`): "{n} accounts" or "Not set up".

### 2.6 Copy catalogs

New catalog `packages/ui/src/components/publishing/publishing-copy.ts` (`defineMessages`, all 14 locale files;
`publishing-copy.vi.ts` filled for every key, others may fall back to English where the type allows). Keys, grouped:

- `calendar.*`: `title` "Publication calendar", `nav` "Calendar", `subtitle` "Plan your releases. See what's ready,
  scheduled and live.", `subtitleProject(name)` "Plan releases for {name}.", `allProjects` "All projects",
  `export` "Export calendar", `import` "Import calendar", `transferScope` "Import and export include all projects.",
  `timezone(city)` "All times in {city}", `hint` "Drag a publication to another day to keep its time, or choose
  Move.", `moved(label)`, `undoMove` "Undo move", `attention(n)`, `today`, `month`, `week`, `agenda`, `allAccounts`,
  `allStatuses`, `clearFilters`, `goTo`, `noneWeek`, `noneFiltered`, `noneBody`, `noneFilteredBody`, `openLibrary`,
  `selectDay`, `count(n)`, `previousPage`, `nextPage`, `selectedDay`, `nothingScheduled`, `nothingScheduledBody`,
  `unscheduled`, `startWithVideo`, `startWithVideoBody`, `noMatching`, `noMatchingBody`, `selected(n)`, `findTimes`
  "Find publishing times", `clearSelection`, `dueByHand` "Post by hand", `dueByHandBody`, `dueToast(label, account)`.
- `move.*`: `title` "Move publication", `day`, `time`, `keepTimes` "Leave empty to keep each account's time.",
  `confirmedByHand`, `submit` "Move publication", `moving` "Moving…", `oneAtATime` "Move confirmed schedules one
  account at a time.".
- `status.*` (publication): Draft, Approved, Pending publication, Publishing, Scheduled, Published, Partially
  published, Needs attention, Cancelled.
- `delivery.*` (destination): `notScheduled` "Not scheduled", `reserved` "Reserved locally", `waitingForYou`
  "Waiting for you", `waiting` "Waiting to publish", `sending` "Publishing", `scheduledOn(network)` "Scheduled on
  {network}", `published` "Published", `failed` "Failed — review needed", `unknown` "Result unconfirmed",
  `cancelling` "Cancelling", `cancelled` "Cancelled".
- `form.*`: lead, conflict, reload, video/preview/pin/approve/newer-edit/missing strings, accounts, tabs, field labels,
  options, caption preview, time card, footer, review checkbox, primary labels (`schedule`, `sendNow`, `send`),
  `approveAgent`, `approvedAgent`, `readiness`, `ready`, `saveOrDiscard`, `newRelease`.
- `handover.*`: `reveal` "Reveal export", `copyCaption` "Copy caption", `copied` "Caption copied.", `openUpload(network)`
  "Open {network} upload page", `record`, `observed`, `observedAt`, `postLink`, `verified` "What you verified",
  `recordSubmit` "Record verified result", `withdraw` "Withdraw", `withdrawn` "Withdrawn. Send it again when ready.".
- `batch.*`: `prepare(n)`, `title(n)`, `lead`, `preparing`, `retry`, `timing(n)`, `timingLead`, `reserve`,
  `reserved(n)`, `pager(i, n)`, `reviewed`, `reviewedCount(x, n)`, `send(n)`, `approveAgent`, `accepted`.
- `settings.*`: section label/blurb (also in `model/settings-nav-copy.ts`), tabs, connections, accounts, schedule,
  advanced, `railAccounts(n)`, `railNotSet`.
- `time.*` (`PublicationTimeField`): `choose` "Choose date and time", `apply` "Apply time", `clear`, `exact` "Enter an
  exact timestamp", `applyExact` "Apply timestamp", `tzInvalid` "Enter a valid timezone before choosing a time.",
  `allTimesIn(tz)`.
- `network.*` / `format.*`: YouTube, Instagram, TikTok; YouTube video, YouTube Short, Instagram Reel, TikTok video;
  `provider.manual` "By hand".

Runtime-side text (validation issues, errors, due events) goes through `defineCatalog` so the UI renders it in its own
language: `packages/protocol/src/messages/protocol/publishing-issues.ts` (pure validation, shared by UI and Runtime)
and `packages/protocol/src/messages/runtime-core/rc-publishing.ts` (service errors), each with 14 locale files.
Product copy rules: second person, outcome first, errors name the problem and the next step, no internal IDs in
chrome, "CucCut" is the product name.

## 3. Data model and storage

### 3.1 Types (port of agentcut `types.ts`, `data.ts`)

Location: `packages/protocol/src/publishing.ts` (types + zod schemas, browser-safe). Changes from agentcut:

| agentcut | CucCut | Why |
|---|---|---|
| `projectId + sequenceId` | `videoId + sequenceId`, plus `projectId: Id \| null` and `videoName` captured at prepare | CucCut's unit is the video (`VideoRef`, `ExportCreateRequest.videoId`); projects are directories and may be null. |
| `ProviderId = iphone\|postgun\|postbridge` | `manual\|postbridge\|postgun\|iphone` (phase 1 accepts only `manual`) | By-hand route first. |
| `revision: number` on artifact (project revision) | `PinnedExport {id, videoId, sequenceId, videoRevision, sequenceRevision, jobId, sha256, bytes, width, height, durationSec, fps, codec, createdAt}` | From `JobRecord.export` (`ExportJobInfo.videoRevision`, `sequenceId`) and `GeneratedOutput.media`. |
| video review status (`approved\|rendered`) | `Publication.approval: {exportId, by: 'human'\|'agent', actor, at} \| null` | CucCut has no video review status yet (see open question 1). Approved ⇔ `approval.exportId === exportId`. |
| `phoneSource` | dropped (phase 3 re-adds) | |
| `approval` kind document (agent grant) | `Publication.authorization: {revision, at} \| null` | Same rule: valid only while `authorization.revision === revision`. |
| `PublishingSettings.timezone = "America/Mexico_City"` | default = Runtime's `Intl.DateTimeFormat().resolvedOptions().timeZone` at first write | Owner-specific default. |
| `evidenceRetentionDays`, `phoneBinary` | `archivedRetentionDays` (default 90); phone fields in phase 3 | |
| `CalendarArchive.format "agentcut-calendar"` | `"cuccut-calendar"`, version 1 | Own identity. |
| `ValidationIssue.message: string` | `{destinationId, field, code, params?}` + `message: MessageRef` | Localized in the UI. |

Unchanged: `Network`, `Format` (and default-format rule), `DeliveryState`, `PublicationStatus`, `Copy`/`Overrides`
(null inherits, empty clears), `DestinationOptions`, `Account` (with `equivalentTo`), `Connection`
(`baseUrl`, `configured`, `checkedAt`, `error`; never a key), `Destination` (`payload`, `payloadHash`, remote fields,
`evidence: string[]` kept for phase 3), `ResolvedPayload` (`exportId` instead of `artifactId`), `Publication`
(label, copy, scheduledAt, timezone, priority, expiresAt, destinations, revision, createdAt, updatedAt, origin,
archived) + `proposal: {revision, copy, reason, jobId, at} | null` + `proposalError: {jobId, error, errorRef, at} | null`
(the last "Propose text" answer that could not be used; cleared by the next proposal; like `proposal`, it keeps the revision).

`PublicationDetail = Publication & {status, approved, videoAvailable, currentVideoRevision: string | null, newerEdit,
export: PinnedExport | null, issues: ValidationIssue[]}`. `PublicationRow` (topic index) = `{id, videoId, projectId,
label, status, archived, revision, scheduledAt, timezone, priority, expiresAt, exportPosterId?, destinations: [{id,
accountId, format, state, at (calendarInstant)}], proposalAt?}`; `proposalAt` is when the latest proposal or proposal
failure was stored, so an open dialog refetches on it although the revision did not change.

Pure logic in `packages/protocol/src/publishing/` (ported nearly verbatim, browser-safe, no Node APIs):
`resolve.ts` (status derivation in agentcut order, `caption()`, `calendarInstant`), `schedule.ts` (`localInstant`
±14 h / 15 min, gap + fold refusal; `planSlots`), `calendar.ts` (month/week/agenda ranges Monday-first in the workspace
timezone; fixes agentcut's local-Date weekday headers), `validate.ts` + `capabilities.ts` (rules in agentcut §5,
including route option contract, caption limits in code points, Shorts classification), `time-field.ts`
(`resolveTimeField` keeps saved instant), `transfer.ts` (archive parse/inspect).

### 3.2 Files on disk (`~/.cuccut`, `RuntimeHome`)

| Path | Field in `RuntimeHome` (`packages/runtime-storage/src/home.ts`) | Content |
|---|---|---|
| `store/publishing.json` | `publishingFile` | the store document, 0600 |
| `publishing/exports/<sha256>.mp4` | `publishingDir` (+ `exports/`) | pinned exports, immutable (0444), hard-linked from `artifacts/` when on the same volume, else copied to `.tmp` and renamed after hashing |
| `publishing/backups/<iso>.json` | — | store copy written before a calendar import |
| `store/publishing-attempts.jsonl` (phase 2) | `publishingAttemptsFile` | delivery attempt journal |

Pinned exports live outside `artifacts/`, so `StorageGc` never removes them; the publishing service removes a pinned
file only when no non-archived publication and no publication younger than `archivedRetentionDays` references it
("Remove unused pinned exports").

### 3.3 Store document and schema

```ts
interface PublishingFileV1 {
  schemaVersion: 1;
  settings: PublishingSettings;          // includes its own `revision`
  connections: Connection[];
  accounts: Account[];
  publications: Publication[];           // archived ones included
  exports: PinnedExport[];
  history: Array<{ publicationId: Id; destinationId: Id; payload: ResolvedPayload; replacedAt: string }>; // capped 2000
  imports: Array<{ id: Id; at: string; added: Id[]; backup: string }>;
}
```

`packages/runtime-storage/src/publishing-store.ts`, modelled on `grant-store.ts`:

- Read with `readJsonOrQuarantine` (`version: {key:'schemaVersion', known:1}`, `quarantine: false`: an unrecognized
  file is left in place and the service starts degraded with "Publishing data could not be read…"; a newer version is
  read-only).
- In-memory state; every mutation is `change(publicationId | 'settings', expectedRevision, fn)`: synchronous check
  and apply in one event-loop turn (no interleaving), revision +1, then a serialized `writeJsonAtomic`; the call
  resolves after the write is on disk. Mismatch throws `PublishingConflict {current}`.
- No SQLite: one Runtime per home (`runtime.lock`) means no cross-process leases, and the data is small (hundreds to a
  few thousand publications). The attempts journal (phase 2) is append-only JSONL (`jsonl-file.ts`).
- Migrations: `schemaVersion` bumps with a pure `migrate(vN) → vN+1` in the store file, covered by fixture tests.
  Phase 2 does not need a bump (new optional fields + new file).

## 4. Runtime and protocol

### 4.1 Service

`packages/runtime-core/src/publishing/publishing-service.ts` — `class PublishingService` with
`readonly topic: TopicLog<PublishingSnapshot, PublishingEvent>` (as `grants/grant-service.ts`). Dependencies:
`PublishingStore`, `ExportService` (create/get), `JobManager` (`onChange`, `models.generateText`), `SpaceCatalog`
(`videos()` for videoId → dir/projectId; video change events for `newerEdit`), media handle issuer
(`media.issue(dir, name)` as in `library/library-service.ts`), `now()`, `log`.

Split for size:

- `publishing-service.ts`: prepare, update, reschedule, slots/reserve, approve, authorize, send, withdraw, cancel,
  reconcile, archive/unarchive, settings, connections, accounts, detail/rows/calendar queries, topic.
- `publishing-exports.ts`: pin from job, render-and-pin (submits export, listens with `jobs.onChange`, pins on
  success, records failure on the publication), `verify(exportId)` re-hash before send, poster frame, open handle,
  cleanup.
- `publishing-copy.ts`: propose (builds prompt from publication, video name, transcript excerpt if present, writing
  guidance, instruction; submits `generateText`; parses JSON `{title, description, hashtags, reason}` with zod on job
  completion; stores `proposal`), apply.
- `publishing-transfer.ts`: export / preview / apply (append-only; existing IDs skipped; new accounts
  `needsReconnect: true`; in-flight destinations become `unknown` with "Imported while delivery was in progress…";
  backup first).
- `publishing-due.ts`: one `setInterval(…, 30_000).unref()` that emits `due` events for by-hand destinations whose
  time arrived (once per destination per revision). Registered with `stops.add('publishing', …)`.

Wiring in `packages/runtime-core/src/runtime.ts`: construct after `ExportService` (~line 609) and after the Space
catalog exists (pass a getter, as `space: () => space` elsewhere); `stops.add('publishing', () => publishing.close(),
'Stopping publishing failed')`; add to `handlerDeps` (~line 884) and `HandlerDeps` (`handlers.ts:87`); add
`PublishingTools` to `toolSets` (~line 704).

Phase 2 adds `publishing-runner.ts` (tick every 5 s while API work exists; claim → send outside the store turn →
record; 429 backoff; uncertain → `unknown`; deadline passed → `failed`; startup recovery: `sending` older than 90 s →
`unknown`), and `RuntimeActivity` gets `activeDeliveries()` in `ActivitySources` so an `--idle-exit` Runtime does not
exit with `queued`/`sending` API destinations.

### 4.2 Actor rules

| Caller | Actor | May |
|---|---|---|
| RPC from `desktop` principal | human | everything |
| RPC from `web` principal | human (remote) | read + edit; not `authorize`, `send`, `reconcile`, connections/accounts, transfer (open question 4) |
| `AgentPrincipal`, `ServicePrincipal` (tools) | agent | read, prepare, update, reschedule, reserve, pin, propose copy, approve (risk `high`), send only with a valid authorization, withdraw |
| `LocalPrincipal` (CLI `catalog.call`) | cli | as agent, plus transfer export/import; **not** authorize or reconcile (fixes agentcut's CLI-as-human quirk) |

Visibility for tools: a publication is visible only if its `videoId` is visible to the scope (resolved through the
scope's video listing / `scope.open`), so a session agent sees its project's publications only. Refusals answer like
missing ones (`PUBLICATION_NOT_FOUND`).

### 4.3 RPC methods (`packages/protocol/src/methods.ts` `RpcMethods`, strict zod in `schemas.ts` `methodParamSchemas`)

| Method | Params → Result |
|---|---|
| `publishing.get` | `{publicationId}` → `PublicationDetail` |
| `publishing.calendar` | `{from, to, projectId?, accountIds?, statuses?, includeUnscheduled?, offset?, limit≤200}` (range ≤ 93 days; filters before pagination) → `{publications: PublicationRow[], nextOffset}` |
| `publishing.prepare` | `{videoIds: Id[1..50], sequenceId?, accountIds?, repeat?}` → `{publications: PublicationDetail[]}` (reuses latest non-archived unless `repeat`) |
| `publishing.update` | `{publicationId, revision, patch: {label?, copy?, scheduledAt?, timezone?, priority?, expiresAt?}, destinations?: DestinationInput[]}` → detail |
| `publishing.reschedule` | `{publicationId, revision, placements: [{destinationId, at\|null}]}` → detail (atomic; `not_sent`/`failed` only) |
| `publishing.slots` | `{publicationIds, from, days≤90, reserve, revisions}` → `SlotPlan` (+ details when reserved) |
| `publishing.pin` | `{publicationId, revision, source: {jobId} \| {render: true}}` → `{publication, jobId?}` |
| `publishing.exports` | `{videoId}` → finished MP4 exports of the video that can be pinned |
| `publishing.approve` | `{publicationId, revision}` → detail |
| `publishing.validate` | `{publicationId}` → `{issues}` |
| `publishing.authorize` | `{publicationId, revision}` → detail (human desktop only) |
| `publishing.send` | `{publicationId, revision, confirmed: true}` → detail |
| `publishing.batch` | `{action: 'authorize'\|'send', items: [{publicationId, revision}], confirmed: true}` → `[{publicationId, ok, error?}]` |
| `publishing.withdraw` | `{publicationId, revision, destinationId}` → detail (`queued` by-hand → `not_sent`, payload cleared) |
| `publishing.cancel` | `{publicationId, revision, destinationId}` → detail (phase 2 remote cancel; phase 1 = local `not_sent`/`failed` → `cancelled`) |
| `publishing.reconcile` | `{publicationId, revision, destinationId, state, remoteUrl\|null, at\|null, note≥10}` → detail (human only) |
| `publishing.archive` / `publishing.unarchive` | `{publicationId, revision}` → detail (Undo pair) |
| `publishing.copy.propose` / `publishing.copy.apply` | `{publicationId, instruction?}` → `{jobId}`; `{publicationId, revision, copy}` → detail |
| `publishing.openHandle` | `{publicationId}` → `MediaHandle` of the pinned export |
| `publishing.settings.save` | `{settings}` (revision inside) → settings |
| `publishing.connections.save` / `.remove` | `{id?, provider, name}` / `{connectionId}` |
| `publishing.accounts.save` / `.remove` / `.link` | `{id?, connectionId, network, name, remoteId, disabled?}` / `{accountId}` / `{accountId, equivalentTo\|null}` |
| `publishing.transfer.export` / `.preview` / `.apply` | `{}` → `{archive, fileName}`; `{archive}` → `CalendarImportPreview`; `{archive}` → `{added}` |
| `publishing.cleanup` | `{dryRun?}` → `{publications, files, bytes}`: deletes archived publications older than `archivedRetentionDays` and pinned export files no publication uses (files pinned in the last few minutes are kept); `dryRun` only counts (human desktop only) |

Errors (`RpcError` code + `details.code`): `conflict`/`PUBLICATION_CONFLICT` (`details.current`), `not-found`/
`PUBLICATION_NOT_FOUND`, `invalid-request`/`PUBLICATION_INVALID` (`details.issues`), `conflict`/`PUBLICATION_LOCKED`
("Submitted destinations keep their shared content…"), `conflict`/`SLOT_TAKEN` ("This slot conflicts with another
publication for {account}"), `forbidden`/`AUTHORIZATION_REQUIRED`, `conflict`/`EXPORT_CHANGED` ("Approved export
changed. Pin a verified export before publishing."), `invalid-request`/`LOCAL_TIME_GAP`|`LOCAL_TIME_FOLD`,
`conflict`/`EXPORT_STALE` ("Export the current revision before pinning it, or choose Render and pin."),
`unsupported`/`PROVIDER_UNSUPPORTED` (phase 1, for any provider other than `manual`).

Validation and rules: agentcut §5 (validate), §6 (scheduling: `checkReservations` on update/reschedule/send with
`minGapMinutes` per real identity through `equivalentTo`), §7 (pin refused once destinations are submitted; pin/patch
clear payloads; replacing a payload snapshots it into `history`) are ported unchanged except the field renames above.

### 4.4 Topic

`packages/protocol/src/events.ts`: add `'publishing'` to `Topic`, `SnapshotOf`/`EventOf`;
route in `handlers.ts` `subscribe`.

```ts
interface PublishingSnapshot { settings; connections; accounts; publications: PublicationRow[] /* non-archived + archived < 30 days */; degraded: MessageRef | null }
type PublishingEvent =
  | { type: 'publication.upserted'; row: PublicationRow }
  | { type: 'publication.removed'; publicationId: Id }      // archive beyond window
  | { type: 'settings.updated'; settings: PublishingSettings }
  | { type: 'connections.updated'; connections: Connection[]; accounts: Account[] }
  | { type: 'due'; publicationId: Id; destinationId: Id; at: string };
```

Detail is fetched with `publishing.get` (the dialog refetches on `publication.upserted` for its ID; stale responses are
ignored by revision).

### 4.5 Web exposure (`packages/protocol/src/web.ts`)

`WEB_DEFAULT_METHODS` gains read and edit methods (`publishing.get`, `.calendar`, `.prepare`, `.update`,
`.reschedule`, `.slots`, `.pin`, `.exports`, `.approve`, `.validate`, `.withdraw`, `.archive`, `.unarchive`,
`.copy.*`, `.openHandle`, `.settings.save`); `WEB_READ_METHODS` gains `.get`, `.calendar`, `.exports`, `.validate`,
`.openHandle`; `WEB_TOPIC_METHODS` maps `publishing` → `publishing.calendar`. Left out: `authorize`, `send`, `batch`,
`reconcile`, `cancel`, `connections.*`, `accounts.*`, `transfer.*`. The handler also checks the principal kind, so the
allowlist is not the only guard.

## 5. Agent tools

`packages/runtime-core/src/agent-tools/publishing-tools.ts` — `class PublishingTools implements ToolSet`, calling the
same `PublishingService` methods as the RPC handlers (one gateway). Every field `.describe()`d; 1–3 examples each;
first description sentence is the summary. Approval summaries in `rc-agent-tools.ts`.

| Tool | Effect | Risk | Surfaces | Input → output |
|---|---|---|---|---|
| `publications_list` | query | read | agent, mcp, cli | `{from?, to?, video?, accounts?, statuses?, unscheduled?, offset?, limit?}` → rows + accounts + settings summary + `next` |
| `publications_inspect` | query | read | agent, mcp, cli | `{publication}` → detail + issues + writing guidance + caption limits |
| `publications_prepare` | mutation | edit | agent, mcp, cli | `{videos: string[], sequence?, accounts?, repeat?}` → details |
| `publications_update` | mutation | edit | agent, mcp, cli | `{publication, revision, label?, copy?, scheduledAt?, timezone?, priority?, expiresAt?, destinations?}` → detail |
| `publications_reschedule` | mutation | edit | agent, mcp, cli | `{publication, revision, placements}` → detail |
| `publications_slots` | query | read | agent, mcp, cli | `{publications, from?, days?}` → plan (no write) |
| `publications_reserve` | mutation | edit | agent, mcp, cli | `{publications, revisions, from?, days?}` → plan + details |
| `publications_pin` | job | edit | agent, cli | `{publication, revision, job?}` (no `job` = render and pin) → `{jobId?, publication}` |
| `publications_propose_copy` | mutation | edit | agent, mcp, cli | `{publication, revision, copy, reason}` → stores a proposal for the owner (not applied) |
| `publications_approve` | mutation | high | agent, cli | `{publication, revision}` → detail (approval attributed to the agent) |
| `publications_send` | mutation | high | agent, cli | `{publication, revision, confirmed: true}` → detail; refused with `AUTHORIZATION_REQUIRED` ("The owner must authorize this exact publication in CucCut before an agent can send it.") |
| `publications_withdraw` | mutation | edit | agent, cli | `{publication, revision, destination}` → detail |
| `publications_archive` | destructive | edit | agent, cli | `{publication, revision}` → detail (+ `next`: "publications_update … archived:false restores it") |
| `publications_export_calendar` / `publications_import_calendar` | query / mutation | read / high | cli | file in/out relative to cwd |

Add fixed risks to `TOOL_RISK` (`tool-scope.ts:123`). Register in `toolSets` (runtime.ts) and `allToolSets()`
(`agent-tools/all-tool-sets.ts`); MCP-surface tools appended to `MCP_SERVICE_TOOL_NAMES`
(`packages/protocol/src/services.ts:63`) with `MCP_INTERFACE_VERSION` bumped; regenerate the CLI snapshot
(`tools/catalog-snapshot.ts`). Guidance: a "Publishing" section in `skills/cuccut/SKILL.md` with `{{tool:…}}`
references ("Only send a publication the owner authorized; unknown results need the owner to record what happened
before any retry.").

**Parity with the UI.** Every UI action maps to a service method, and every service method except the human-only ones
has a tool. Human-only by design: `authorize`, `reconcile` (an agent cannot observe the network in phase 1 and must
not certify results), connections/accounts (identity and future credentials), timezone/schedule settings
(workspace preferences, like other settings writes). The agent sees them in `publications_inspect` output and is told
to ask the owner.

## 6. UI

### 6.1 Store, commands, view-models (`packages/ui/src`)

- `state/publishing-store.ts`: zustand mirror (`replace(snapshot)`, `apply(event)`), plus `due` queue; subscribed in
  `runtime/session.ts` next to `grants` (`this.client.subscribe<PublishingSnapshot, PublishingEvent>('publishing', …)`).
- `runtime/publishing-commands.ts`: thin `session.client.request('publishing.*')` wrappers; single-flight per
  publication (a second call while one runs returns the running promise); surfaces `RpcError` messages; returns the
  new detail so callers keep the revision.
- `model/publishing-calendar.ts`: pure VM — period ranges (month/week/agenda) in the workspace timezone, grid cells,
  entries per day by `calendarInstant`, filter + paginate, counts, unscheduled list, drag eligibility, move planning
  (`planMove` → placements or "needs dialog"), undo record.
- `model/publication-form.ts`: draft reducer (dirty flag, conflict state holding the draft, review checkbox bound to
  revision + exportId, primary label from all destinations' times, tab list with account names when two accounts share
  a network), composed caption + counts via the protocol `caption()`.
- `model/publishing-labels.ts`: status/delivery/network/format → copy + lucide icon.

### 6.2 Components (`packages/ui/src/components/publishing/`)

`calendar-page.tsx`, `calendar-toolbar.tsx`, `calendar-grid.tsx`, `calendar-entry.tsx`, `calendar-aside.tsx`,
`calendar-move-dialog.tsx`, `calendar-transfer.tsx`, `publication-dialog.tsx`, `publication-form.tsx`,
`publication-video.tsx`, `publication-accounts.tsx`, `publication-text.tsx`, `publication-destination.tsx`,
`publication-delivery.tsx`, `publication-time-card.tsx`, `publication-footer.tsx`, `publication-time-field.tsx`
(DatePicker + time input + Apply, exact timestamp disclosure), `timezone-select.tsx`, `status-badge.tsx`,
`network-icon.tsx`, `batch-publications-dialog.tsx`, `publishing-copy*.ts`. Settings body:
`components/settings/publishing-settings.tsx` (+ `publishing-accounts.tsx`, `publishing-schedule.tsx`).

### 6.3 Hooks into existing screens

- `state/shell-store.ts`: `Tab` += `'calendar'`; `Route` += calendar variant; `hrefFor`/`parseHref` cases;
  `railTabOf`, `defaultRoute`, `hasSidebar` (no sidebar). `SETTINGS_SECTIONS` += `'publishing'`
  (`model/settings-nav.ts`, `SETTINGS_GROUPS` group `app`, or a new `publishing` group), label in `model/settings-nav-copy.ts`.
- `components/app-shell.tsx`: `route.tab === 'calendar'` → `<CalendarPage …/>`.
- `cc/components/page-chrome.tsx` `NAV`: `{tab:'calendar', label: () => CHROME_COPY.calendar, Icon: CalendarDays}`
  after Library; `chrome-copy.ts` (+ locales) `calendar`.
- `components/settings-page.tsx`: `SECTION_ICON.publishing = Send`, section switch, rail summary.
- `components/editor/video-bar.tsx`: Video menu item "Publish…" (opens `PublicationDialog` for the open video).
- `components/space/space-list.tsx` row menu: "Prepare publication" for video entries.
- `components/editor/ai-tools-shorts-result.tsx`: "Prepare publications" for the result's videos → batch dialog.
- App-level `PublishingDueHost` mounted in `app-shell.tsx` next to `AppUpdateHost`: toast for `due` events with
  "Open" (`ToastQueue` with `actionLabel`, timing per `toast-timing.ts`).

## 7. Tests

- **Protocol (pure)** `packages/protocol/src/publishing/*.test.ts`: status derivation table; `caption()` dedupe and
  code-point limits; `localInstant` gap/fold in e.g. `America/New_York` 2026-03-08 02:30 / 2026-11-01 01:30;
  `resolveTimeField` keeps seconds and fold offset; `planSlots` determinism (priority, expiry, id order; minGap across
  `equivalentTo`; batch placements occupy); every validation rule (one case each, incl. Shorts classification and route
  options); calendar ranges across month/year, Monday-first in a non-local timezone; transfer parse rejects duplicates,
  missing connections, bad timezones; schema round trips.
- **Storage** `packages/runtime-storage/src/publishing-store.test.ts`: missing/empty/unrecognized (not renamed)/newer
  version read-only; revision conflict; serialized writes survive concurrent changes; 0600 mode.
- **Service** `packages/runtime-core/src/publishing/*.test.ts`: prepare reuse vs repeat; update locks after submission;
  reschedule atomic + expiry; reserve writes default time and clears destination times in one change; slot collision
  error; pin from job (hash, hard link or copy, refuse stale revision), render-and-pin via fake `ExportService` +
  `onChange`; `EXPORT_CHANGED` after tampering the pinned file; approve; authorize voided by any revision change; send
  by agent without authorization refused; by-hand send → `queued`, due event fires once; withdraw; reconcile refused for
  agent/cli, accepted for human, history-only states refuse reset; archive/unarchive; transfer export strips
  payload/evidence/export IDs, import is append-only and in-flight → `unknown`; copy propose parses fake text-job output.
- **Handlers/runtime**: `publishing-methods.test.ts` (param schemas strict, principal-kind gating for web/cli),
  `runtime.test.ts` (service constructed, stop registered), `services/web-service.test.ts` (allowlist),
  `runtime-messages.test.ts` (new catalogs complete).
- **Tools**: `agent-tools/publishing-tools.test.ts` with a fake `ToolScope` recording `confirm` (risk per tool,
  visibility by video scope, `AUTHORIZATION_REQUIRED`), `catalog-metadata.test.ts` and `tools/catalog-snapshot.test.ts`
  pass with the new tools and `MCP_SERVICE_TOOL_NAMES`.
- **UI**: `state/publishing-store.test.ts` (mirror); `runtime/publishing-commands.test.ts` (single-flight, conflict
  surfaces `current`); `model/publishing-calendar.test.ts` (grid, filters before pagination, drag eligibility, move
  planning, undo placements); `model/publication-form.test.ts` (dirty, conflict keeps draft, review reset, primary
  label); `state/shell-store.test.ts` (calendar and `/settings/publishing` round-trip); `copy.test.ts` and
  `tools/i18n-scan.test.ts` (no hard-coded strings; vi filled).
- **QC screenshots** (`npm run build:web`, then `node tools/qc-shot.mjs --home .dev/qc-publishing --port 47731 --out
  <dir> /calendar /calendar?view=week /calendar?view=agenda /settings/publishing /calendar?publication=<id>`), with a
  seed script `tools/qc-seed-publishing.mjs` that calls the CLI tools (`publications_prepare`, `…_update`,
  `…_reserve`) on a fixture video so the grid, Unscheduled inbox, attention bar and dialog states are populated. Compare
  with `docs/cuccut/reference/*.png`. Note: `docs/cuccut/reference/publishing.png` is currently a 404 capture of
  agentcut; recapture agentcut's `/calendar` and `/settings/publishing` (and save them as `calendar.png`,
  `publishing.png`) before the UI steps.

## 8. Implementation steps

Each step is one agent's work, lands with its tests, and passes `npx tsc -p tsconfig.json --noEmit` and
`npx vitest run <touched dirs>`. Vietnamese fills for copy catalogs can go to a Haiku translation agent once the
English keys exist.

1. **Protocol types and schemas.** `packages/protocol/src/publishing.ts` (types + zod), `packages/protocol/src/index.ts`
   (re-export), `packages/protocol/src/publishing.test.ts`.
2. **Pure scheduling and status logic.** `packages/protocol/src/publishing/{resolve,schedule,calendar,time-field}.ts`
   + tests (port of agentcut `lib/resolve.ts`, `lib/schedule.ts`, `lib/calendar.ts`, `lib/time-field.ts`).
3. **Validation and transfer logic + issue catalog.** `packages/protocol/src/publishing/{validate,capabilities,transfer}.ts`
   + tests; `packages/protocol/src/messages/protocol/publishing-issues.ts` + 14 locale files; register in
   `packages/protocol/src/messages/protocol/index.ts`.
4. **Store.** `packages/runtime-storage/src/publishing-store.ts` + test; `home.ts` (`publishingFile`,
   `publishingDir`) + `home.test.ts`; `index.ts`; `packages/protocol/src/messages/runtime-storage/runtime-storage-publishing.ts`
   + locales + messages index.
5. **Service core.** `packages/runtime-core/src/publishing/publishing-service.ts` (prepare, update, reschedule,
   slots/reserve, validate, approve, authorize, send/withdraw/cancel/reconcile for `manual`, archive, settings,
   connections, accounts, topic) + `publishing-service.test.ts`;
   `packages/protocol/src/messages/runtime-core/rc-publishing.ts` + locales + index.
6. **Pinned exports.** `packages/runtime-core/src/publishing/publishing-exports.ts` (+ test): pin from job,
   render-and-pin, verify, open handle, cleanup; uses `ExportService`, `JobManager.onChange`, jobs `artifact-store`
   `locate`, media issuer.
7. **Methods, topic, wiring.** `packages/protocol/src/methods.ts`, `schemas.ts`, `events.ts`, `web.ts`;
   `packages/runtime-core/src/publishing/publishing-methods.ts` (+ test); `handlers.ts` (`HandlerDeps`, spread
   methods, `subscribe` route); `runtime.ts` (construct, `stops.add`, `handlerDeps`, due timer);
   `services/web-service.test.ts`, `runtime.test.ts`.
8. **Copy proposals and transfer.** `packages/runtime-core/src/publishing/publishing-copy.ts`,
   `publishing-transfer.ts` + tests; methods added in `publishing-methods.ts`.
9. **Agent tools.** `packages/runtime-core/src/agent-tools/publishing-tools.ts` (+ test); `all-tool-sets.ts`;
   `runtime.ts` `toolSets`; `tool-scope.ts` `TOOL_RISK`; `packages/protocol/src/messages/runtime-core/rc-agent-tools.ts`
   (+ locales); `packages/protocol/src/services.ts` (`MCP_SERVICE_TOOL_NAMES`, interface version);
   `skills/cuccut/SKILL.md`; regenerate `tools/catalog-snapshot.ts` output.
10. **UI store, commands, view-models.** `packages/ui/src/state/publishing-store.ts`,
    `runtime/session.ts`, `runtime/publishing-commands.ts`, `model/publishing-calendar.ts`,
    `model/publication-form.ts`, `model/publishing-labels.ts` + tests.
11. **UI copy and shared parts.** `packages/ui/src/components/publishing/publishing-copy.ts` + 14 locales (vi
    filled), `status-badge.tsx`, `network-icon.tsx`, `publication-time-field.tsx`, `timezone-select.tsx`.
12. **Route and calendar page.** `state/shell-store.ts` (+ test), `components/app-shell.tsx`,
    `cc/components/page-chrome.tsx`, `cc/components/chrome-copy*.ts`, `components/publishing/calendar-{page,toolbar,grid,entry,aside,move-dialog}.tsx`.
13. **Publication dialog.** `components/publishing/publication-{dialog,form,video,accounts,text,destination,delivery,time-card,footer}.tsx`.
14. **Settings → Publishing.** `model/settings-nav.ts`, `model/settings-nav-copy*.ts`, `components/settings-page.tsx`,
    `components/settings/publishing-{settings,accounts,schedule}.tsx`.
15. **Entry points, batch, due toasts, transfer UI.** `components/editor/video-bar.tsx`,
    `components/space/space-list.tsx`, `components/editor/ai-tools-shorts-result.tsx`,
    `components/publishing/batch-publications-dialog.tsx`, `components/publishing/calendar-transfer.tsx`,
    `PublishingDueHost` in `components/app-shell.tsx`.
16. **QC and docs.** `tools/qc-seed-publishing.mjs`; screenshots compared with recaptured references
    (`docs/cuccut/reference/calendar.png`, `publishing.png`); `docs/cuccut/AGENTCUT-DESIGN.md` (publishing notes if
    behaviour diverged), `docs/cuccut/PLAN.md` M2 status. Full `npm test` before merging.

Phase 2 (separate plan when started): 17. `credential-store.ts` `KEY_PATTERN` += `publish:` and
`publishingCredentialKey()`; 18. provider adapter interface + Postbridge/Postgun adapters
(`packages/runtime-core/src/publishing/providers/*`), connection save/check/sync with "set/missing" credential view
like `components/models/`; 19. `publishing-runner.ts` + attempts journal + `RuntimeActivity.activeDeliveries`;
20. remote cancel/move/refresh UI. Phase 3: phone route.

## 9. Open questions

1. **Approval source.** M2 also plans a "review gate before delivery". Should publication approval read a video-level
   review status from that module once it exists (agentcut's model), or stay per pinned export (this design)? The
   design keeps `approval` on the publication so it works today; switching later changes only `approved` derivation.
2. **Copy proposals without a text model.** "Propose text" needs a configured LLM in Models (outbound grant for
   `context`). Alternative: hand the request to the current conversation's agent, which answers through
   `publications_propose_copy`. Which should be the default when both exist?
3. **System notifications for by-hand reminders.** The desktop main process has no `Notification` use today. Add one
   (`cuccut:notify` IPC) so reminders show when the window is hidden, or keep in-app toasts only?
4. **Web client authority.** Should a browser session (web service, access code) be allowed to authorize and send?
   This design says no (desktop only).
5. **MCP surface.** External MCP clients get read/prepare/update/reserve but not send/approve/pin. Confirm, or keep
   publishing off MCP entirely in phase 1?
6. **Phase 2 provider choice.** Postbridge/Postgun (user brings a paid API key) versus a direct YouTube Data API
   integration with the user's own OAuth client and a loopback callback on the Gateway `http` chain. Which first?
7. **Where publications live.** Home store (this design; survives project moves, matches agentcut's workspace db)
   versus next to each project (travels with the project folder). Export/import covers moving machines either way.
8. **Timezone select.** Does `cc/ui/select.tsx` need a filterable combobox variant for ~400 IANA zones, or is a
   grouped select acceptable?
