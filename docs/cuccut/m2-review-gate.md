# M2 — Review gate before delivery

Status: design, not built. Behaviour and look follow agentcut's review module
(`.reference/agentcut/packages/core/src/modules/review`, `REVIEW.md`); engine and data flow follow CucCut's Runtime
(videos, documents, `ExportService`, tool catalog, topics). Everything runs locally.

## 1. Goal and scope

A person (or the agent) states what a finished video must be true of. CucCut measures it, says what was found and what
to do, and **refuses a deliverable export while a critical finding is open**. The way past a finding is to fix it,
or to let it stand with a written reason. That reason stays beside the finding and can be undone.

### Built now

| Piece | What |
|---|---|
| Standard | One user-level standard (`~/.cuccut/store/review-criteria.json`): measured **checks** (one metric from a closed catalogue + limit + severity + fix) and judged **questions** (rubric). Built-in checks apply when the user has none for a metric. |
| Project tier | 14 metrics computed purely from `VideoSnapshot` (+ caption/derivation document bodies). No render. |
| Export tier (light) | 5 metrics read from the last finished-video export's `ExportValidation` (duration, size, loudness). No frame sampler. |
| Judged tier | Questions answered by the agent in the video's own conversation through a `review_answer` tool. Evidence is checked against the declared kind. Opt-in, one agent turn per video. |
| Per-video decisions | Waivers and severity changes in a `review-plan` document inside the video. They are revisioned and undoable like any edit. |
| Result | `<source>/.cuccut-out/reviews/<videoId>.json`. Kept outside the edit history, so checking never creates a revision. |
| Gate | In `ExportService.create`, for `kind:'video'` with `purpose !== 'preview'`: the project tier runs, and an unwaived critical finding throws `REVIEW_BLOCKED` before any job is created. It covers the UI, CLI, MCP, agent tools and shorts "Export all" (they all call `exports.create`). |
| Surfaces | Runtime methods `review.*`, topic `review`, 7 agent tools, a review dialog in the editor (Video menu), a review note and remedy in the export popover, a Settings › Review page, and a verdict badge on shorts cards. |

### Left out, and why

- **Pixel metrics** (caption lit vs dark, framing drift, hook band, end-card diff). agentcut samples stills of the
  rendered output with Remotion in a headless browser. CucCut has no composited-frame sampler yet (`videos_frames`
  reads the source picture only). These can be added later as export-tier metrics once the export worker can dump
  frames. The gate does not need them.
- **Packs** (pack `review.json`, `packs.review.get/set`, `scanStyle`). Packs are a separate M2 module. The
  standard is layered (`builtin → user → video`) so that a `pack` layer can slot in between user and video later,
  with no format change.
- **Tags conditions** (`tags[]` on a check). CucCut videos have no tags yet; `aspect` is the only condition.
- **Project-level overrides** (agentcut `ProjectPlan.review`). For now there is the user standard plus per-video
  decisions. A project layer would need a project-scoped store; see Open questions.
- **ReviewDeck (keep/drop swipe).** This is candidate triage, not the gate. It needs an approval status that CucCut
  videos do not have, and it belongs with "clip a long video (scored candidates)". The shorts page gets a verdict
  badge now, and "Export all" already surfaces gate refusals per clip.
- **Task-contract wiring** (`acceptanceChecks kind:'quality'`). Optional follow-up; the service is shaped so a
  `QualityService` can call `check()`.
- **Auto-running the questions after export.** That would cost tokens with no one asking for it; it stays manual
  (agentcut does the same).
- Nothing here needs a cloud account. The judged tier uses whatever coding agent the user already connected.

### agentcut doc-vs-code discrepancies: decisions

| Discrepancy | Decision |
|---|---|
| Lowering a severity "writes the reason into the artifact" (doc), but the code drops it | The reason is required server-side (`REVIEW_REASON_REQUIRED`) and copied into the result as `lowered: {from, reason}`. |
| Evidence "must be of the declared kind" (doc), but the code checks only non-empty | It is validated by kind (§4.4). An invalid answer becomes `cannot-tell` with a note. |
| Stacking user → pack → project → sequence (doc), but the code does project + sequence | `builtin → user → video` now, with `pack` reserved between user and video. |
| One pass vs "two rounds" | One pass. Re-asking is a second click. |
| A bare number in the limit input means "no limit" | The UI parser rejects it and asks for `≤`, `≥` or a range. Lint warns as well. |
| CLI snapshot render skips the gate | No such path exists in CucCut: the CLI `export` tool goes through `exports.create`. |
| `review-runs/` scratch folders are never deleted | Not needed: the agent answers through a tool, so there is no sandbox folder. |
| `stale` uses a project-wide revision | Per video. The project tier is recomputed on every write, and the export and judged tiers each carry their own revision. |

## 2. User flows and screens

All new surfaces are built with `packages/ui/src/cc/ui/*` under a `data-cc` element. Rules from
`docs/cuccut/AGENTCUT-DESIGN.md` apply: dialogs are solid (20px), there is one tinted action per view, capsule buttons,
recessed fields, and a status never wears the accent. Disabled controls say why, and removals act and offer Undo.

### 2.1 Editor: "What correct looks like" dialog

- **Entry.** A new item in the header Video menu (`video-bar.tsx`, section with Settings/Rename/Details) with a
  ShieldCheck icon, labelled "What correct looks like". It is disabled with no sequence (same rule as Settings). The
  export rejection's "Open the review" remedy opens it too. No route; state is in a small zustand store
  (`openReview(videoId)`), mirroring `openVideoSettings()`.
- **Layout.** A cc `Dialog` (M width, scrolls inside), from top to bottom:
  1. Header: title "What correct looks like here"; under it the reason line, e.g. "You haven’t set a standard
     yet, so these are the built-in checks." or "Held to your standard (Settings › Review).", then the count line,
     e.g. "4 checks, and 2 questions an agent answers."
  2. Actions: **Check this video** (the tinted primary, runs `review.run`). **Ask the questions too** (neutral)
     appears only when the standard has questions. It is disabled with a reason when no agent is connected
     ("Connect a coding agent to ask the questions."). The busy button shows a spinner and the others are disabled.
  3. Verdict banner, a neutral card with an icon coloured by verdict (no accent): passed / passed-with-findings /
     failed / not-reviewed. Subline: "Read from the project[, the last export][ and the answers]." Stale notes
     appear per tier.
  4. **To answer for**: one card (24px) per open finding. A severity icon, then `said` ("Placeholder boxes is 2"),
     `detail` ("asks for at most 0"), and the fix sentence. Each card has "Let it stand…", which opens an inline
     recessed textarea ("Why this one is allowed"; Save is disabled until there is text, with a hint), and a
     severity `Select`. Raising saves at once; lowering opens a reason form ("Why this is only a suggestion here").
  5. **Let stand**: waived findings show "Let stand: <reason> — <You|Agent>" and a "Hold it to this again" button
     (Undo2 icon).
  6. `Disclosure` "N it holds to" (green check rows) and `Disclosure` "N not read on this video" (`id — why`).
     These replace agentcut's raw `<details>`, which its design doc calls a bug.
- **States.** Loading ("Reading the standard…"); not checked ("This video hasn’t been checked yet."); checked; stale;
  error (inline alert, `role=alert`); asking (a link "Open the conversation" while the agent answers).
- After any action the store refreshes from the `review` topic. Waive/unwaive/severity are edits, so the editor's
  undo stack holds them and the toast offers Undo.

### 2.2 Export popover (Video tab)

- **Review note** (`ExportReviewNote`, beside `ExportFontNote` in `export-video.tsx`). When the gate is on and
  `review.check` returns blocking findings, a neutral notice reads "2 things would stop this export." with a
  neutral "Open the review" button. The Export button stays the one primary; it is not disabled, because the
  Runtime is authoritative and the rejection explains itself.
- **Rejection** (`REVIEW_BLOCKED`) through `explainExportError`: the title is "This video doesn’t meet your standard
  yet", then one item per finding ("<said>. <fix>"), then the hint "Fix what’s listed, or open the review and let a
  finding stand with a reason." Remedy kind `open-review`, with the button "Open the review".

### 2.3 Settings › Review (`/settings/review`)

- Group `app`, after Glossary. Icon `ShieldCheck`. Status in the side list: "N checks · M questions" or "Built-in".
- **Switch**, "Hold finished videos to this standard" (`review.gate`), described as "Exports for delivery stop on a
  critical finding until it is fixed or let stand. Previews are never stopped."
- Intro: "The part of what you want that can be checked. A check is one measurement CucCut takes and the limit you
  hold it to; a question is one an agent answers with something to point at."
- **Checks**: rows show `measurement ≥ x, ≤ y · aspect`, the severity, the fix, and a remove button (acts, then a
  toast with Undo). Built-in checks are listed as "Built-in" rows with only a severity select; changing it writes a
  user check on the same metric. Add form fields: Measurement (cc `Select` over the catalogue, with hints "Read from
  the project." or "Read from the last export, so it needs an export first."); Limit (number: "≤ 60", "≥ 3", "3–60";
  boolean: Yes/No); "Only for" (Any shape / 9:16 / 1:1 / 16:9); "Worth" (severity); "What to do about it" (fix,
  required for critical, with the reason shown); and **Add this check** (the page's primary). The id defaults to
  the metric with dots turned into dashes, suffixed on collision.
- **Questions**: hint "For what no number catches. An answer has to point at something, or it is recorded as
  “cannot tell”." Fields: question, "Answered with" (a moment / a frame / a part of the video / a quote), Worth,
  fix, and "Add this question" (neutral, since the page already has its one primary).
- Lint warnings are shown as an amber list above the rows. They come from the Runtime as codes and are mapped to copy.
- Web: shown as "Desktop only" like Glossary until `review.criteria.set` is allowed in the browser (§4.5).

### 2.4 Shorts result page

- `ShortCard` (`ai-tools-shorts-result.tsx`) gets a neutral badge from the review store: "Holds", "Worth a look",
  "Blocked" or "Not checked". Clicking it opens that short and its review dialog. Nothing else changes, and "Export
  all…" lists gate refusals in `skipped` as today.

### 2.5 Copy keys to add

`packages/ui/src/components/review/review-copy.ts` (`REVIEW_COPY`, 15 locales):
`menuItem, title, loading, reasonBuiltin, reasonUser, counts(checks, questions), check, ask, askNeedsAgent,
asking, openConversation, notChecked, verdict.{passed,findings,failed,notReviewed}, readFrom(export, answers),
staleProject, staleExport(rev), staleAnswers, groups.{open,waived,holds(n),skipped(n)}, asksFor(limit),
couldNotTell(note), letStand, reasonPlaceholder, reasonNeeded, save, cancel, letStandBy(reason, who), who.{user,agent},
holdAgain, lowerReason(severity), severity.{critical,suggestion,nitpick}, limit.{atLeast,atMost,between,yes,no,any},
skip.{aspect,unknownMetric,notExported,unreadable,notAsked}, badge.{passed,findings,failed,notReviewed},
exportNote(n), openReview, rubricPrompt(videoName)`.

`review-metrics-copy.ts`: `{[metricName]: {label, what}}` for the catalogue (the Runtime's `what` stays English and
agent-facing).

`settings/review-settings-copy.ts`: `gate, gateHelp, intro, checks, checksEmpty, builtin, measurement,
fromProject, fromExport, limit, limitHelp, limitInvalid, onlyFor, aspectAny, worth, fix, fixRequired, addCheck,
removed(name), undo, questions, questionsHint, question, answeredWith, evidence.{timestamp,frame,field,quote},
addQuestion, lint.{unknownMetric,noLimit,limitKind,minOverMax,criticalNoFix,duplicateId,tooLong,tooMany}`.

`model/export-rejection.ts`: `titles.REVIEW_BLOCKED, reviewHint, openReview`. `settings-nav-copy.ts`:
`section.review`. `settings-copy.ts` (protocol): `review.gate`. `editor-layout-copy.ts`: none (the menu label comes
from `REVIEW_COPY.menuItem`). `shorts-copy.ts`: none (the badges come from `REVIEW_COPY.badge`).

Vietnamese is filled by hand for every key. The other 13 locales are filled by a translation agent (Haiku).

## 3. Data model and storage

### 3.1 Types (`packages/protocol/src/review.ts`)

```ts
type ReviewSeverity = 'critical' | 'suggestion' | 'nitpick';
type ReviewEvidence = 'timestamp' | 'frame' | 'field' | 'quote';
type ReviewAspect = '9:16' | '1:1' | '16:9';
interface ReviewCheck { id: string; metric: string; min?: number; max?: number; is?: boolean;
  severity: ReviewSeverity; fix: string; aspect?: ReviewAspect }          // id: /^[a-z0-9][a-z0-9-]{0,47}$/
interface ReviewQuestion { id: string; ask: string; evidence: ReviewEvidence; severity: ReviewSeverity; fix: string }
interface ReviewStandard { schema: 'cuccut.review-criteria/1'; checks: ReviewCheck[]; rubric: ReviewQuestion[] }
interface ReviewMetric { name: string; stage: 'project' | 'export'; kind: 'number' | 'boolean'; unit?: string; what: string }
interface ReviewPlan { schema: 'cuccut.review-plan/1';                    // body of the per-video document
  severities: Record<string, ReviewSeverity>; reasons: Record<string, string>;
  waivers: Array<{ id: string; reason: string; by: 'user' | 'agent'; at: string }> }
interface ReviewCriteria { source: 'builtin' | 'user'; reason: string; checks: ReviewCheck[]; rubric: ReviewQuestion[];
  plan: ReviewPlan; builtinIds: string[] }                                // active for one video
interface CheckResult { id; metric; severity; value: number | boolean; limit: ReviewLimit; ok: boolean; fix;
  waived?: { reason; by }; lowered?: { from: ReviewSeverity; reason: string } }
interface RubricResult { id; ask; severity; fix; evidenceKind; verdict: 'holds' | 'fails' | 'cannot-tell';
  evidence: string; note: string; ok: boolean; waived?; lowered? }
type ReviewVerdict = 'passed' | 'passed-with-findings' | 'failed' | 'not-reviewed';
interface ReviewResult { schema: 'cuccut.review-result/1'; videoId; sequenceId; videoName; at; revision;
  criteriaSource; stages: Array<'project' | 'export' | 'rubric'>; verdict; checks: CheckResult[];
  rubric: RubricResult[]; skipped: Array<{ id; reason: ReviewSkipReason; detail?: string }>;
  measured: { project: MetricBag; export?: { bag: MetricBag; jobId: Id; revision: string } };
  answers?: { revision: string; at: string; by: 'agent' | 'user'; items: RubricAnswer[] } }
interface ReviewBlock { videoId; sequenceId; findings: Array<{ id; metric; value; limit: ReviewLimit; fix }> }
```

`ReviewLimit` is structured (`{min?, max?, is?}`), not a sentence, so both the UI and the Runtime phrase it in their
own language. `ReviewSkipReason` is a code (`aspect | unknown-metric | not-exported | unreadable | not-asked`), with
the copy in the UI. Constants: `REVIEW_PLAN_KIND = 'review-plan'`, `REVIEW_METRICS`, `REVIEW_BUILTIN_CHECKS`,
`REVIEW_LIMITS = {checks: 64, questions: 32, ask: 280, fix: 200, reason: 500}`.

### 3.2 Metric catalogue (closed, host-owned)

Project tier, computed from the export's sequence (`settings.sequenceId ?? rootSequenceId`). "Main" is the visual
track with the lowest `order`.

| Metric | Kind | How |
|---|---|---|
| `video.durationSec` | number s | `sequenceDurationFrames / fps` |
| `video.shortSidePx` | number px | `min(canvas.width, canvas.height)` |
| `video.shots` | number | enabled video/image items on Main |
| `video.cutsPerMin` | number | joints between Main items per minute |
| `video.longestShotSec` | number s | longest Main item span |
| `video.longestBlankSec` | number s | longest span with no enabled visible visual item |
| `captions.on` | boolean | an enabled caption item on a visible subtitle track (same rule as `burnedCaptionLanguages`) |
| `captions.wordsPerSec` | number | words in the drawn caption document(s) inside the span / duration; absent with no captions |
| `hook.present` | boolean | the derivation document's `hook`, else a text item starting in the first 2 s |
| `hook.words` | number | words in that hook; absent when none |
| `text.offCanvas` | boolean | an enabled text item whose box (`x ± w·scale/2`) leaves [0, 100] horizontally |
| `items.placeholders` | number | enabled `placeholder` items with no `assetRef` |
| `transitions.count` | number | `sequence.transitions.length` |
| `layers.max` | number | visual tracks carrying enabled items, minus 1 |

Export tier: the newest completed `export` job of `kind:'video'` for the video (`jobs.list(videoId)`), from
`outputs[0].validation` / `media`. `export.durationSec`, `export.width`, `export.height`, `export.loudnessLufs`
(`validation.loudness.measured.integratedLufs`, absent without normalisation), `export.truePeakDb`. The export's
revision is `extra.export.videoRevision`.

A metric that cannot be read is absent from the bag, and its check is skipped with a reason. It never counts as 0.
Aspect uses `canvas` with a ±0.02 tolerance; other ratios read as `W:H` and never match an aspect condition.

Built-in checks (`REVIEW_BUILTIN_CHECKS`): `placeholders` (`items.placeholders` max 0, **critical**, "Fill or remove
the placeholder boxes before delivering."), `blank` (`video.longestBlankSec` max 0.5, suggestion), `text-edge`
(`text.offCanvas` is false, suggestion). Only the placeholder check blocks by default: it delivers a visibly
unfinished frame.

### 3.3 Storage

| What | Where | Format | Notes |
|---|---|---|---|
| User standard | `~/.cuccut/store/review-criteria.json` (`home.reviewCriteriaFile`) | `{schemaVersion: 1, standard: ReviewStandard, revision: number}` | `JsonStoreFile` like `skill-prefs.ts`: tolerant read, a broken file is renamed and the store starts empty, writes are serialised. Missing file = built-ins only. |
| Per-video decisions | a document `kind:'review-plan'` in the video, body `cuccut.review-plan/1`, at most one per video | `ReviewPlan` | Written with `putDocument` through `videos.apply` (user/agent principal), so it is revisioned, on the undo stack, and copied by the portable package. Not copied by `videos.derive` (`derivationNeeds` copies only speech/cut-set/translation), so a short does not inherit the long video's waivers. |
| Result | `<sourceRoot>/.cuccut-out/reviews/<videoId>.json` | `ReviewResult` | Overwritten by each write, written to a temp file then renamed. Space does not scan dot folders. A half-written or unknown-schema file reads as "not checked". |
| Settings | `review.gate: boolean`, default `true` | settings store | Off = no gate, and reviews still run. |

**Migrations:** none. All files are new, and a missing file or document means defaults. Versioned schemas let a newer
build refuse to rewrite a newer file (`store-file.ts` behaviour).

## 4. Runtime and protocol

### 4.1 Pure core (`packages/runtime-core/src/review/`)

- `review-metrics.ts`: `projectMetrics(snapshot, sequenceId, bodies)` and `exportMetrics(job)`. These are pure, and
  `bodies` holds the caption and derivation document bodies fetched beforehand.
- `review-evaluate.ts`, ported from agentcut `lib/evaluate.ts`: `activeCriteria(builtin, user)`, `stackPlans`,
  `severityOf` (it returns `lowered` with the reason, which is now used), `applies(check, {aspect})`,
  `evaluateChecks`, `evaluateRubric(questions, answers, plan, evidenceOk)`, `verdictOf`, `blocking`.
- `review-lint.ts`, ported from `lib/lint.ts`. Codes: unknown metric (with up to 3 suggestions), no limit,
  `is` on a number / `min|max` on a boolean, min > max, critical with no fix, duplicate id, text too long, too many.
- `review-evidence.ts`: kind checks (§4.4).

### 4.2 `ReviewService` (`review/review-service.ts`)

Its constructor takes `{ videos, jobs, store: ReviewCriteriaStore, settings: () => {gate}, log }`. It is constructed
in `runtime.ts` before `ExportService` and passed into `ExportServiceOptions.review`. `stops.add('review', …)` flushes
the store.

| Method | Does |
|---|---|
| `catalogue()` | `REVIEW_METRICS` |
| `criteria(videoId?)` | the active standard (+ the plan when given a video) |
| `setCriteria(standard, expectedRevision?)` | zod + lint. Errors refuse (`REVIEW_CRITERIA_INVALID`), warnings are returned. Topic event. |
| `check(videoId, sequenceId?)` | project tier only, nothing written → `{ blocks: ReviewBlock \| null, result }`. Used by the gate and the export note. |
| `run(videoId, {sequenceId?, export=true})` | project tier (+ export tier if a finished export exists), and keeps the existing answers re-evaluated against the current plan. Writes the result and emits a topic event. |
| `get(videoId)` | the stored result, or null |
| `waive / unwaive / setSeverity` | read the plan document, change it, and `videos.apply` one `putDocument` (label from rcReview). A missing reason refuses with `REVIEW_REASON_REQUIRED`; an unknown id with `REVIEW_UNKNOWN_FINDING`. Afterwards the service re-runs the project tier and rewrites the result at the new revision, so a waiver never makes the result look stale. |
| `recordAnswers(videoId, answers, principal)` | validates them against the current questions and evidence, stores `answers` with the revision, rewrites the result |

The gate is `gate(videoId, settings)`. It returns null when `review.gate` is off, when `kind !== 'video'`, or when
`purpose === 'preview'`. Otherwise it returns `check()`'s block.

### 4.3 Gate in `ExportService.create`

After the `VIDEO_NOT_OPEN` check and before the kind dispatch:

```ts
const block = await this.#options.review?.gate(request.videoId, settings);
if (block) throw new RpcError('conflict', RcReview.blocked({ count: block.findings.length }),
  { code: 'REVIEW_BLOCKED', findings: block.findings, remedy: RcReview.blockedRemedy().text });
```

No snapshot or job is created, which matches the class contract ("If preflight fails, throws `RpcError` and no
task is created"). There is no bypass field on `ExportCreateRequest`. The ways out are a fix, a waiver with a reason,
a lowered severity with a reason, or switching `review.gate` off in Settings.

### 4.4 Evidence validation (judged tier)

| Kind | Valid when |
|---|---|
| `timestamp` | parses as `ss(.f)s`, `mm:ss` or `hh:mm:ss`, and lies within `[0, duration]` |
| `frame` | a path relative to the video's source root that exists under `.cuccut-out/frames/` (what `videos_frames` writes) |
| `field` | names an id present in the snapshot (item, track, document or marker) |
| `quote` | found (case and whitespace folded) in a speech or caption document body of the video |

`holds` with invalid or empty evidence becomes `cannot-tell` with a note. A missing answer is `cannot-tell` ("The
review did not reach this question."). `cannot-tell` is never ok.

### 4.5 Protocol additions

- `methods.ts`: `review.catalogue`, `review.criteria.get {videoId?}`, `review.criteria.set {standard, expectedRevision?}`,
  `review.check {videoId, sequenceId?}`, `review.run {videoId, sequenceId?}`, `review.get {videoId}`,
  `review.waive {videoId, id, reason, expectedRevision?, commandId?}`, `review.unwaive {videoId, id, expectedRevision?, commandId?}`,
  `review.severity {videoId, id, severity|null, reason?, expectedRevision?, commandId?}`. Answers come only from the
  agent tool; there is no RPC for them.
- `schemas.ts`: zod for each method in `methodParamSchemas`, and `review.gate` in `settingValueSchemas`.
- `events.ts`: topic `'review'`. The snapshot is `{ criteria: {standard, revision}, results: Record<videoId, ReviewSummary> }`
  (the summaries written since start, plus those read through `get`). Events are `{type:'criteria', …}` and
  `{type:'result', videoId, summary}`, where `ReviewSummary = {verdict, revision, at, open: number, stale: boolean}`.
  Waivers also arrive through `video:<id>` because they are document edits.
- `settings.ts`: `review.gate` in `SettingValues`, `SETTING_KEYS` and `SETTING_DEFAULTS`; the description in `settings-copy.ts`.
- `web.ts`: add `review.*` to the default allowlist, and `review.catalogue`, `review.criteria.get`, `review.get`,
  `review.check` to `WEB_READ_METHODS`. Map `review: 'review.get'` in `WEB_TOPIC_METHODS`.
- Messages: `messages/runtime-core/rc-review.ts` (+14) holds `blocked(count)`, `blockedRemedy`, `findingLine`,
  `reasonRequired`, `unknownFinding(id)`, `criteriaInvalid`, `documentName` ("Review decisions"),
  `waiveLabel`, `unwaiveLabel`, `severityLabel`. The `rc-agent-tools.ts` confirm summaries are `reviewWaive(id, reason)`,
  `reviewSeverity(id, from, to)` and `reviewCriteriaSet`.
- Error codes: `REVIEW_BLOCKED`, `REVIEW_REASON_REQUIRED`, `REVIEW_UNKNOWN_FINDING`, `REVIEW_CRITERIA_INVALID`.

## 5. Agent tools (`agent-tools/review-tools.ts`, `ReviewTools`)

| Tool | Input | Output | Effect | Risk | Surfaces |
|---|---|---|---|---|---|
| `review_criteria` | `{video?, catalogue?: boolean}` | active checks, questions, plan, (catalogue) | query | read | agent, mcp, cli |
| `review_run` | `{video, sequenceId?}` | verdict, findings (open/waived), skipped, stale notes | mutation (writes `.cuccut-out` only) | read | agent, mcp, cli |
| `review_answer` | `{video, answers: [{id, verdict, evidence, note?}]}` | rubric results after validation | mutation | read | agent, mcp, cli |
| `review_waive` | `{video, id, reason}` | the plan and the receipt | mutation | **high** | agent, cli |
| `review_unwaive` | `{video, id}` | the plan and the receipt | mutation | edit | agent, cli |
| `review_severity` | `{video, id, severity \| null, reason?}` | the plan and the receipt | mutation | lowering: **high**, otherwise edit (given per call) | agent, cli |
| `review_criteria_set` | `{standard}` | standard and warnings | mutation | **high** | agent, cli |

- Every call goes `scope.authorize`, then `scope.confirm` (for writes), then `scope.open`, then `ReviewService`. These
  are the same service calls the `review.*` handlers make, so the UI and the agent behave the same.
- **Why `high`:** letting a finding stand, lowering a standard and rewriting the standard are the user's call. `high`
  asks in every mode except full access, and never offers "Always allow" (`agent-scope.ts` `rule: null`). The CLI
  (`LocalScope`) is the user. MCP does not carry the loosening tools, so an external `auto` service cannot loosen the
  gate.
- `export-tools.ts` gets
  `EXPORT_NEXT.REVIEW_BLOCKED = "findings lists what the user's standard refuses: fix each (fix says how) and export again. If the user wants one to stand, call review_waive with their reason — it asks them. Do not lower severities or switch the gate off to get past it."`
  `toolErrorOf` passes `findings` through unchanged.
- MCP gets `review_criteria`, `review_run` and `review_answer` in `MCP_SERVICE_TOOL_NAMES`. Adding tools is not a
  breaking change (`MCP_INTERFACE_VERSION` is unchanged; see Open questions).
- Guidance: a new `skills/cuccut/references/catalog/review.md` (when to run, what the verdicts mean, how to answer
  questions with evidence, never waive unasked). `export.md` §Acceptance gets a first bullet: "Run
  {{tool:review_run}} before a deliverable export; a critical finding stops it." `SKILL.md` links the page.
- Step labels in `ui/src/model/agent-tool-steps.ts` (+locales): "Checked the video", "Answered review questions",
  "Let a finding stand", "Changed what a finding is worth", "Changed the review standard".

## 6. UI

| File | Role |
|---|---|
| `runtime/session.ts` | `reviewCatalogue/criteria/setCriteria/check/run/get/waive/unwaive/severity` wrappers, and a `review` topic subscription feeding the store |
| `state/review-store.ts` | zustand: `criteria`, `results: Record<videoId, ReviewSummary>`, `full: Record<videoId, ReviewResult>` (loaded on demand), `busy`, `apply(event)` |
| `model/review.ts` | pure: `groupFindings(result)` → open / waived / holds / skipped; `findingLine` (said/detail from metric copy and `ReviewLimit`); `parseLimit("≤ 60" \| "≥ 3" \| "3–60")`; `defaultCheckId`; `badgeOf(summary)`; `isStale` |
| `model/review-rubric.ts` | builds the handoff message (copy `rubricPrompt`) for `handToAgent` |
| `components/review/review-dialog.tsx` | `ReviewDialog` + `openReview(videoId)`; mounted in `video-editor.tsx` next to `VideoSettingsDialog` |
| `components/review/review-panel.tsx` | header, actions, verdict, groups (cc Card, Disclosure, Button) |
| `components/review/review-finding.tsx` | finding card: Let it stand form, severity Select with the lowering reason form |
| `components/review/review-badge.tsx` | neutral cc Badge for shorts cards |
| `components/editor/video-bar.tsx` | the Video menu item `review` |
| `components/export/export-review.tsx` | `ExportReviewNote` (calls `review.check` when the tab opens and after an edit) |
| `components/export/export-video.tsx` | mounts the note |
| `model/export-rejection.ts` | `REVIEW_BLOCKED` title, items from `details.findings`, remedy `{kind:'open-review'}` |
| `components/export/export-remedy.tsx` | the `open-review` case → `openReview(videoId)` |
| `components/settings/review-settings.tsx` | the standard editor (§2.3) |
| `model/settings-nav.ts`, `components/settings-page.tsx` | `review` section, icon, status, branch |
| `components/editor/ai-tools-shorts-result.tsx` | badge on `ShortCard` |

The judged pass from the UI: "Ask the questions too" calls `handToAgent` (`components/editor/ai-tools-handoff.ts`)
in the video's conversation with the `rubricPrompt` message and the editor context. The agent reads `review_criteria`,
looks (`videos_frames`, `documents_read`, a `purpose:'preview'` export), and calls `review_answer`. The dialog shows
"Asking…" plus "Open the conversation" until a `result` event with `answers` arrives.

## 7. Tests

- **Protocol**: `review.test.ts` (schemas, limits, catalogue names unique, built-ins valid); `settings.test.ts`
  (new key); `i18n.test.ts` / `i18n-en.test.ts` (rc-review complete).
- **Pure core**: `review-metrics.test.ts` (fixture snapshots: placeholder, gap, captions, hook from derivation,
  off-canvas text, unreadable → absent); `review-evaluate.test.ts` (port agentcut `review.test.ts`: skip reasons,
  waiver keeps `ok:false`, verdicts, stacking, lowered reason carried); `review-lint.test.ts`;
  `review-evidence.test.ts`.
- **Storage**: `runtime-storage/src/review-criteria.test.ts` (load, broken file renamed, newer schema not rewritten,
  serialised writes).
- **Runtime**: `review/review-service.test.ts` (real runtime via `startRuntime`; waive writes one `review-plan`
  document and `edits.undo` removes it; a missing reason refuses; the result file is written and rewritten after a
  waive at the new revision; the export tier is read from a finished job; answers validated). Then
  `exports/review-gate.test.ts`: placeholder → `REVIEW_BLOCKED` and `jobs.list` unchanged; `purpose:'preview'`
  passes; waived passes; `review.gate=false` passes; subtitles are not gated. It is skipped without engine-host or
  ffmpeg, like `exports.test.ts`.
- **Agent tools**: `agent-tools/review-tools.test.ts` with `testing/fake-agent.ts`: `review_run` in plan mode;
  `review_waive` asks in every mode except full access and offers no "Always allow"; `export` returns
  `REVIEW_BLOCKED` with `next`; `review_answer` with bad evidence gives `cannot-tell`. `catalog-metadata.test.ts`
  (MCP list) and `tools/catalog-snapshot.test.ts` pass after `npm run build:catalog`.
- **UI**: `model/review.test.ts` (grouping, `parseLimit` incl. bare number rejected, badge, stale);
  `model/export-rejection.test.ts` (`REVIEW_BLOCKED` → items + `open-review`); `model/settings-nav.test.ts`;
  `components/settings/settings-copy.test.ts`; `copy.test.ts` / `tools/i18n-scan.test.ts` (all keys, vi filled).
- **QC screenshots** (`npm run build:web`, then `node tools/qc-shot.mjs --home .dev/qc-review --port 47731 --out
  <dir> /settings/review @video --video <id>`): Settings › Review empty and with checks/questions/lint; the dialog
  not checked / failed / with a waiver / stale; the export popover with the review note and with the rejection; the
  shorts page with badges. The dialog and popover states need `qc-shot.mjs` to accept `--click <selector>` (step 15).
  Compare with `docs/cuccut/reference/editor.png` and `settings.png`.

## 8. Implementation steps

Each step is one agent's worth, leaves the tree green (`npx tsc -p tsconfig.json --noEmit` plus its vitest), and lists
the files it touches.

1. **Protocol types and catalogue.** `packages/protocol/src/review.ts` (new: types, `REVIEW_METRICS`,
   `REVIEW_BUILTIN_CHECKS`, `REVIEW_PLAN_KIND`, `REVIEW_LIMITS`), `packages/protocol/src/review-schemas.ts` (new: zod
   for the standard, plan and answers), `packages/protocol/src/index.ts`, `packages/protocol/src/review.test.ts`.
2. **Pure core.** `packages/runtime-core/src/review/review-metrics.ts`, `review-evaluate.ts`, `review-lint.ts`,
   `review-evidence.ts` + their `*.test.ts`, ported from `.reference/agentcut/packages/core/src/modules/review/lib/*`
   and `__tests__/review.test.ts`.
3. **Criteria store.** `packages/runtime-storage/src/review-criteria.ts` (+test), `packages/runtime-storage/src/home.ts`
   (`reviewCriteriaFile`), `packages/runtime-storage/src/index.ts`.
4. **Runtime messages.** `packages/protocol/src/messages/runtime-core/rc-review.ts` + `rc-review.vi.ts` + 13 locale
   files, `messages/runtime-core/index.ts`; confirm summaries in `rc-agent-tools.ts` (+locales).
5. **ReviewService.** `packages/runtime-core/src/review/review-service.ts`, `review/review-results.ts` (result file
   IO, `TopicLog` from `@cuccut/harness`), `review/review-service.test.ts`.
6. **Protocol surface and wiring.** `packages/protocol/src/methods.ts`, `schemas.ts`, `events.ts`, `settings.ts`,
   `settings-copy.ts` (+14 locales), `web.ts`; `packages/runtime-core/src/review/review-methods.ts` (new,
   `Pick<RpcHandlers['methods'], 'review.…'>`), `handlers.ts` (spread + `subscribe` route), `runtime.ts` (construct,
   `stops.add`, `handlerDeps`).
7. **Export gate.** `packages/runtime-core/src/exports/export-service.ts` (`ExportServiceOptions.review`, the gate in
   `create`), `runtime.ts` (pass `review`), `packages/runtime-core/src/exports/review-gate.test.ts`.
8. **Agent tools.** `packages/runtime-core/src/agent-tools/review-tools.ts` (+test), `tool-scope.ts` (`TOOL_RISK`),
   `export-tools.ts` (`EXPORT_NEXT.REVIEW_BLOCKED`), `all-tool-sets.ts`, `runtime.ts` (`toolSets`),
   `packages/protocol/src/services.ts` (`MCP_SERVICE_TOOL_NAMES`); run `npm run build:catalog`.
9. **Agent guidance and step labels.** `skills/cuccut/references/catalog/review.md` (new), `catalog/export.md`,
   `skills/cuccut/SKILL.md`, `packages/ui/src/model/agent-tool-steps.ts` (+locales); check that `guidance.ts`
   renders the `{{tool:…}}` references.
10. **UI data layer.** `packages/ui/src/runtime/session.ts`, `packages/ui/src/state/review-store.ts`,
    `packages/ui/src/model/review.ts` (+test), `packages/ui/src/model/review-rubric.ts`.
11. **UI copy.** `packages/ui/src/components/review/review-copy.ts`, `review-metrics-copy.ts` (+ `.vi.ts` by hand,
    other 13 locales by a translation agent), `packages/ui/src/components/settings/review-settings-copy.ts` (+locales).
12. **Review dialog.** `packages/ui/src/components/review/review-dialog.tsx`, `review-panel.tsx`,
    `review-finding.tsx`, `review-badge.tsx`; `components/editor/video-bar.tsx` (menu item),
    `components/editor/video-editor.tsx` (mount).
13. **Export integration.** `packages/ui/src/model/export-rejection.ts` (+14 locale files, test),
    `components/export/export-remedy.tsx`, `components/export/export-review.tsx` (new), `components/export/export-video.tsx`.
14. **Settings page.** `packages/ui/src/model/settings-nav.ts`, `model/settings-nav-copy.ts` (+locales),
    `components/settings-page.tsx`, `components/settings/review-settings.tsx` (new), `settings-nav.test.ts`.
15. **Shorts badge and QC.** `components/editor/ai-tools-shorts-result.tsx`; `tools/qc-shot.mjs` (`--click`);
    screenshots per §7; `docs/cuccut/PLAN.md` (M2 row: review gate done, with what was left out). Run the full
    `npm test` before merging.

Steps 1–4 can run in parallel. 5 needs 1–4; 6–8 need 5; 9 needs 8; 10–11 need 6; 12–14 need 10–11; 15 comes last.

## 9. Open questions

1. **What else is gated?** The design gates only the finished video (`kind:'video'`, deliverable). Should
   deliverable `audio`, `subtitles` or `portable` be gated too, and against which metrics?
2. **Questions in the gate.** agentcut never blocks on rubric answers, and the design follows that. Should a
   *critical* question answered `fails` (at the current revision) block as well?
3. **Project layer.** Is a per-project standard needed before packs land, e.g. `<project>/.cuccut/review.json`, or is
   user + per-video enough until then?
4. **Default severity of the placeholder check.** It is critical, so the gate blocks out of the box. Should every
   built-in start at `suggestion`, so nothing changes for existing users until they opt in?
5. **Agent writing the standard.** `review_criteria_set` is `high`, on agent and CLI only. Should it be UI-only
   instead, keeping the agent from editing the standard it is judged by?
6. **MCP versioning.** Does adding three tools need an `MCP_INTERFACE_VERSION` bump? The comment says that renames and
   parameter changes do.
7. **Task contracts.** Should `TaskContract.acceptanceChecks` with `kind:'quality'` map to `ReviewService.check`, so
   that a task's "done" means "the review passes"?
8. **Review plan visibility.** The `review-plan` document will appear in document lists (Space extract, any
   documents UI). Should it be hidden as a system document, like `library-selection`?
