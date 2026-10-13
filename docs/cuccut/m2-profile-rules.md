# M2 — Profile, onboarding interview and rules

Design for the first M2 module (see [PLAN.md](PLAN.md)). The behaviour and look follow agentcut's "You", `/welcome`,
reminder, in-chat interview and Rules screens (`.reference/agentcut`, notes in `.reference/notes/agentcut-map.md`
§A3, §B3, §B7). The engine and data flow follow CucCut: a Runtime store, protocol methods plus a topic, one command
gateway shared by the UI, the agent tools and the CLI, and text that reaches agents through
`AgentGrants.sessionInstructions`. The pixel target for "You" is `docs/cuccut/reference/settings.png`.

## 1. Goal and scope

**Goal.** The agent knows who the user is and how they like their videos done, without the user repeating it. The
user can say this once in an interview, edit it in their own words, and add standing rules ("when X, do Y"). Every
new agent session reads all of it.

**Built now**

- **Interview.** Five questions (`who`, `record`, `platforms`, `annoys`, `names`; only `who` is required). Status is
  `pending | skipped | done`, with a home reminder that can be dismissed. Answers are saved a step at a time and
  survive a skip.
- **Writing preferences from the answers.** A one-shot, confined run of the user's default coding agent turns the
  answers into 6–12 preference lines and a list of names. With no agent, or bad output, the answers are kept as
  typed.
- **Preferences** at two levels: workspace (the user's own text plus the section the interview wrote, stored
  apart) and project (one text).
- **Rules** at two levels: an ordered list of `{name, when, instruction, stage, template?, enabled}`. The agent
  judges the condition and follows the instruction.
- **Names** from the interview go into one default-enabled `TranscriptionGlossary` in the user library. This is not
  a second glossary store.
- A **`<cuccut-profile>` block** in the session instructions of every new native session: preferences, rules and
  names to spell, plus a one-question interview nudge while the interview is pending.
- **Screens.** Settings → You, Settings → Rules (with the rule form), a full-screen `/welcome`, the home reminder
  line, the in-chat interview card, and a project "Rules and preferences" dialog.
- **Parity.** Agent tools (`profile_*`), a `cuccut profile` admin command, and read-only web access.

**Left out, and why**

| Left out | Why |
|---|---|
| `rules.evaluate` / `rules.apply` (deterministic template overrides, slots, `RuleEffects` from template fields) | CucCut has no `VideoTemplate` field-patch model: its templates (`templates/<id>`) are prompt briefs. A rule acts through its instruction and an optional template id that the agent uses. |
| Observations ("Corrections", `observations.review`) | Needs the engine to tag human vs. generated edits on commit. That is not tracked today, and the "Nothing corrected yet" panel would describe a feature that does not exist. Next milestone. |
| Packs as a rule source ("From the X pack") | Packs are a separate M2 module. `ProfileRule.source` is reserved for them. |
| Profile text in direct model calls (`ai-tools/ai-tool-prompt.ts`, `providers/src/agent/agent-image-generator.ts`) | Those calls can go to cloud providers under data grants (`GrantDataKind`). Adding personal text changes what is sent. See Open questions. |
| Auto-redirect from home to `/welcome` on first launch | `docs/product/product-design.md` (setup is guided when a task needs it, and first launch is never blocked by a full page). Home shows the reminder line instead. See Open questions. |
| Anything that needs a cloud account | Nothing here does. Everything is local files, and the only optional dependency is an installed agent CLI. |
| Rule drafting with the agent ("Create with the agent") | Step 13, optional. It reuses the confined runner from step 5. The manual form ships first. |

## 2. User flows and screens

All new strings go into two UI catalogs, `packages/ui/src/components/profile/profile-copy.ts` (`PROFILE_COPY`) and
`packages/ui/src/components/profile/rules-copy.ts` (`RULES_COPY`). English is the source, `*.vi.ts` is filled, and the
other 13 locales are typed files that may reuse English. Runtime messages go into
`packages/protocol/src/messages/runtime-core/rc-profile.ts` (`RcProfile`). The English texts below come from agentcut
unless marked *new*.

### 2.1 Settings → You (`/settings/you`)

Layout as in `settings.png`. `SectionHeader`: title "You", blurb "What you make, who it is for, and how you like it
done. Every agent reads this before it decides anything." Under it, solid `Panel`s (24px):

1. **About you**
   - `PanelHeading` (icon `MessageSquareText`) with a status line from `interviewLine(status, hasSection)`:
     - `interview.line.pending`, `line.skipped`, `line.doneWithSection`, `line.doneRemoved` (agentcut texts).
   - Action: a capsule "Take the interview" (`interview.take`), or "Redo the interview" (`interview.redo`) when done.
     It routes to `/welcome`, and "Redo" first calls `profile.reopenInterview`.
   - Five recessed textareas in a two-column grid; `who` spans both columns. Labels are `question.<id>.label`,
     placeholders are `question.<id>.placeholder`, and optional ones carry `question.optional` "(optional)".
   - Footer:
     - "Save answers" (`answers.save`): secondary, enabled when dirty.
     - "Rewrite my preferences" (`answers.rewrite`, wand icon): secondary.
     - A hint, `answers.count(n)` "N answers of 5. Rewriting turns them into the section below." It changes with
       the state:
       - while writing: `answers.writing` "The agent is reading your answers. This takes a moment.", plus the last
         progress line;
       - disabled: `answers.needWho` "Answer the first question to rewrite." *(new; a disabled control says why)*;
       - no agent: `answers.noAgent` "No agent is connected, so your answers will be kept as typed." *(new)*.
2. **In your words**
   - Icon `NotebookPen`. Blurb: "Markdown, one preference a line reads best. The agent follows them unless what you
     ask for in the moment says otherwise."
   - A monospace textarea holding only `preferences.own`. Placeholder: the four agentcut lines (`own.placeholder`).
   - "Save preferences" (`own.save`) is **the one tinted action of the view, and only while dirty**. "Discard"
     (`own.discard`) is ghost.
3. **What the interview wrote** (only when `preferences.interview` is non-empty)
   - A read-only, focusable `<pre>` with `role="region"` and aria-label `interviewSection.title`.
   - "Remove this section" (`interviewSection.remove`) acts at once, then shows a toast `interviewSection.removed`
     with **Undo** (`common.undo`). Undo restores the previous text. This replaces agentcut's act-without-Undo.
4. **Footnote** *(new)*: `note.sessions` "Agents read this when a session starts. Sessions already open keep what they
   had." (as with the skills toggle)

**States**

- Loading: skeleton rows, before the `profile` snapshot arrives.
- Error: an `ErrorLine` (`role=alert`) under the panel that failed. The form keeps its draft.
- Web: every control is disabled with `common.desktopOnly` "Change this in the desktop app." *(new)*.

**Rail summary**

- `rail.you`: "preferences written, N answers", "N answers", or "no preferences yet".
- `rail.rules`: "none yet" or "N rules, M off".

### 2.2 Settings → Rules (`/settings/rules`)

Workspace rules only.

- **Header.** "Rules" with the blurb `rules.blurb`: "Tell the agent what to repeat in your videos. Each rule has a
  condition and an instruction. These rules apply across projects; saving one does not change existing videos."
  The action "Create a rule" (`rules.create`) appears only when the list is non-empty.
- **Empty state** (`rules.empty.title` / `rules.empty.body`): "No rules yet — A rule is how you stop repeating
  yourself: 'when the clip is gameplay, never cover the game with pictures.' The agent judges the sentence." The
  `Empty` card carries the single "Create a rule" button (tinted, the view's primary).
- **Each row** (solid card list):
  - Ordinal, name, a stage badge (`stage.clip` "Choosing clips", `stage.edit` "Editing", `stage.any` "Choosing and
    editing"), and "When …" (`rule.when`).
  - Effects bullets from `ruleEffects()`: `effect.template` "Use <template name>" (with `effect.templateMissing`
    "(not installed)") and `effect.instruction` "Agent instruction: …".
  - Controls: up/down (`rule.moveUp` / `rule.moveDown`, disabled at the ends with a tooltip saying why), an On/Off
    switch (`rule.enabled`), "Edit", and a trash button.
- **Delete** acts, then shows a toast `rule.deleted(name)` with Undo, which re-puts the same rule at the same order.
  This replaces agentcut's confirmation dialog, per CLAUDE.md rule 1.
- **Reorder** calls `profile.reorderRules` once (orders renumbered 10, 20, 30…).
- **Footnote** `rules.footnote` *(adapted)*: "Rules are read in this order. When two disagree, the later one wins."

**Rule form** (inline; replaces the list):

- "← Back to rules", the title `form.createTitle` / `form.editTitle`, and the lede `form.lede`.
- A card "Review your rule" (`form.review`) shows When, the effects bullets, and the scope sentences:
  - `form.scopeAll` / `form.scopeProject`;
  - `form.enabled` / `form.paused`;
  - `form.existing` "Existing videos keep their current edits."
- **Fields:**
  - "When should it apply?" (`form.when`, required);
  - "Rule name" (`form.name`, required);
  - "Use this rule when" stage select (`form.stage`);
  - "Where it applies" (`form.level`), only in a project context and only for new rules;
  - "Instruction for the agent" (`form.instruction`), with the help text `form.instructionHelp` "The agent follows
    this when the condition holds. It does not change videos on its own.";
  - "Template" select (`form.template`, options from `templates.list`, first option `form.noTemplate` "No template");
  - "More options" disclosure: "Note to yourself" (`form.note`) and "Order (lower numbers run first)" (`form.order`);
  - "Enable rule" switch.
- **Buttons:** "Save rule" (tinted, the view's one primary) and "Cancel".
  - "Save rule" is disabled until name, when and (instruction or template) are set. It says why in
    `form.needAction` *(new)*.
- **Saving:**
  - Warnings (for example, a template that is not installed) show "Saved with notes" (`form.savedWithNotes`). The
    button becomes "Save changes" and Cancel becomes "Done".
  - On error the form stays, and the message is shown in an `ErrorLine` and focused.

### 2.3 `/welcome` (full screen, its own route)

- **Route.** `Route {tab:'welcome'}`, href `/welcome`. There is no sidebar and no rail. The background is the
  ambient frame, and there is **no glass**.
- **Header.** "CucCut · setup" (`welcome.brand`) and a ghost "Skip for now" (`welcome.skip`).
- **Asking**:
  - A five-segment step bar (no percentage), "Question N of 5" (`welcome.step`), and the large label.
  - Helper line: `welcome.required` "The one answer worth giving. Everything else can stay empty." or
    `welcome.optional` "Optional. Enter to continue, or leave it blank."
  - Textarea with the placeholder. Enter continues; Shift+Enter adds a line.
  - Buttons: "Continue →" (`welcome.continue`, tinted) and "Back" (`welcome.back`). On the last step the tinted
    button becomes "Write my preferences" (`welcome.write`, sparkles icon).
  - When the required question is empty, the button is disabled and the hint reads `welcome.needWho` "Answer this,
    or skip the whole thing."
  - Each step calls `profile.saveAnswers`. Esc skips: save, then `profile.skipInterview`, then home.
- **Writing.** `welcome.writingTitle` "Writing your preferences", `welcome.writingBody`, and the last three progress
  lines from `writing.lines` (`aria-live="polite"`).
- **Review**:
  - `welcome.reviewTitle` "Preferences written" and `welcome.reviewBody`.
  - A monospace textarea holding **only the interview section**, which fixes agentcut's quirk 1 (markers exposed).
  - Fallback note `welcome.keptAsTyped` *(new)*: "No agent was available, so your answers were kept as typed. You
    can rewrite them later in Settings → You."
  - `welcome.namesAdded(list)` "Names added to the glossary: …".
  - "Save and start" (tinted) calls `profile.setPreferences {interview}`, then home. "Change an answer" returns to
    step 0.
- **Footer.** `welcome.footer` "Skipping is fine. The interview stays in settings, and the agent can ask you at any
  time."
- Rendering the page writes nothing.

### 2.4 Home reminder (landing page)

- **When it shows:** `!hasPreferences && interview.reminder && interview.status !== 'done'`.
- It is a single line above the start composer: a sparkles icon, `reminder.text` "The agent does not know who you
  are yet.", a link `reminder.link` "Tell it, in two minutes" (to `/welcome`), and a ghost "Not now"
  (`reminder.dismiss`).
- "Not now" hides the line optimistically and calls `profile.dismissReminder`.

### 2.5 In-chat interview card (conversation view)

- **When it shows:** a solid card at the top of the thread, when `status === 'pending' && !hasPreferences`. It never
  blocks the composer.
- **Asking.** One question at a time, with the lead line `chat.lead` "So I edit the way you want — answer whenever,
  it does not hold anything up." Buttons:
  - "Save" (`chat.save`) calls `profile.saveAnswers`;
  - "Ask me later" (`chat.later`) skips the question for this session only, held in React state;
  - "Not now" (`chat.notNow`) calls `profile.skipInterview`;
  - "Answer all of them" (`chat.all`) goes to `/welcome`.
- **After the last question:**
  - `chat.answered(n)` "N of 5 answered.", with "Write my preferences" and "Not now";
  - when nothing was answered: `chat.noRush` "No rush. I will ask again another time.".
- **After writing:** `chat.written` "Preferences written from your answers. They are in Settings → You." This fixes
  agentcut's stale "Library" copy.

### 2.6 Project "Rules and preferences" dialog

- **Entry points.** "Rules and preferences…" (`project.menu`) in the project row menu (`home-sidebar.tsx`
  `onProjectAction`) and in `SessionMenu` (`conversation-header.tsx`) when the session has a project.
- **Layout.** A cc `Dialog` (20px, about 38rem) with two tabs:
  - **Rules:** that project's rules, plus the workspace rules read-only with the badge `badge.everyProject` and a link
    to Settings → Rules. "Create a rule" uses the shared form with level = project.
  - **Preferences:** "For this project" (`project.prefs`) textarea and Save, with the general preferences shown
    read-only above it, linked to Settings → You. Unlike agentcut quirk 2, this never edits the raw workspace text.
- **Note** `project.note`: "Project rules and preferences apply on top of the general ones, in new sessions of this
  project."

## 3. Data model and storage

Types live in `packages/protocol/src/profile.ts` (zod-free, so they can ship in the UI bundle):

```ts
export const INTERVIEW_QUESTIONS = ['who', 'record', 'platforms', 'annoys', 'names'] as const;
export type InterviewQuestionId = (typeof INTERVIEW_QUESTIONS)[number];
export type InterviewStatus = 'pending' | 'skipped' | 'done';
export interface InterviewState {
  status: InterviewStatus;
  reminder: boolean;
  answers: Partial<Record<InterviewQuestionId, string>>; // trimmed, blanks dropped
  remaining: InterviewQuestionId[];                       // computed
  writtenAt: string | null;
  usedAgent: boolean | null;                              // last write: agent or kept as typed
  namesGlossaryId: Id | null;                             // library entry the names went into
}
export const RULE_STAGES = ['any', 'clip', 'edit'] as const;
export interface ProfileRule {
  id: string;            // ^[a-z0-9][a-z0-9-]{0,63}$ : slug(name, 55) + '-' + 8 hex
  name: string;
  when: string;          // plain-language condition
  instruction: string;   // '' allowed only when templateId is set
  templateId: string | null;
  stage: RuleStage;      // default 'any'
  order: number;         // int; lower first, ties by id
  enabled: boolean;
  note: string;          // "Note to yourself"; never sent to the agent
  source: null;          // reserved: { pack: string } when packs land
}
export interface ProfilePreferences { own: string; interview: string }
export interface ProfileSnapshot {
  interview: InterviewState;
  preferences: ProfilePreferences;
  hasPreferences: boolean;         // own or interview non-empty
  rules: ProfileRule[];            // workspace, sorted
  writing: ProfileWriteState | null;
  readOnly: boolean;               // the file is from a newer version
}
export interface ProfileWriteState { startedAt: string; lines: string[] /* last 3, ≤ 400 chars each */ }
export interface ProjectProfile { projectId: Id; preferences: string; rules: ProfileRule[]; readOnly: boolean }
export const PROFILE_LIMITS = { answer: 2000, preferences: 8000, name: 120, when: 500, instruction: 2000, note: 500, rules: 200, block: 6000 };
```

The English question labels for agents (`INTERVIEW_QUESTION_TEXT`) sit in the same file; they are agent-facing,
`i18n-ignore`. The UI labels are product copy in `PROFILE_COPY`.

**Files**

| Level | Path | Shape |
|---|---|---|
| Workspace | `<home>/store/profile.json` (`RuntimeHome.profileFile`; default `~/.cuccut/store/profile.json`) | `{schemaVersion: 1, interview: {status, reminder, answers, writtenAt, usedAgent, namesGlossaryId}, preferences: {own, interview}, rules: ProfileRule[]}` |
| Project | `<project>/.ccut/profile.json` (next to the marker, `PROJECT_MARKER_DIR`) | `{schemaVersion: 1, preferences: string, rules: ProfileRule[]}` |
| Names | the user library, `glossaries` (`<home>/library`) | one `TranscriptionGlossary` `{name: RcProfile.namesGlossaryName(), kind: 'transcription', language: null, defaultEnabled: true, terms: [{canonical, misheard}]}` |
| Writer scratch | `<home>/staging/profile-runs/<uuid>/` | `answers.json` → `profile.json`; removed in a `finally`, which fixes agentcut quirk 5 |

**Storage rules** (as in `skill-prefs.ts` / `settings-store.ts`):

- A `JsonStoreFile` with `tolerateReadErrors`. Corrupt JSON is renamed and the store starts empty.
- A file with a newer `schemaVersion` is read where possible, never rewritten, and writes are refused with
  `PROFILE_READ_ONLY`.
- Writes are serialised through a `#saving` chain. `normalize()` drops unknown keys, bad ids, duplicate ids (the
  first one is kept), over-long text (clipped to `PROFILE_LIMITS`) and rules past 200.
- The interview text and the user's own text are **separate fields**, so there are no `<!-- … -->` markers.
  agentcut's quirks 1–3 cannot happen.
- **Project file:** read on demand (session start, `profile.getProject`) with no cache, and written through one
  `JsonStoreFile` per path held in a `Map` so writes stay serialised. A project directory that is missing or not
  writable gives `PROFILE_PROJECT_UNAVAILABLE`.
- **Migration:** none (new files). Missing file = defaults:
  `{status: 'pending', reminder: true, answers: {}, preferences: {own: '', interview: ''}, rules: []}`. No import
  from agentcut.

**Status semantics** (ported from agentcut):

- Saving answers never changes the status.
- Skip keeps the answers.
- Reopen sets `pending` and `reminder: true`.
- Dismiss sets `reminder: false`.
- A successful write sets `done`.

## 4. Runtime and protocol

**Service**: `packages/runtime-core/src/profile/profile-service.ts`, class `ProfileService`.

- `open({home, library, log})` loads the store. `topic: TopicLog<ProfileSnapshot, ProfileEvent>`, as in
  `settings-topic.ts`.
- Methods that change data:
  - `saveAnswers`, `skip`, `reopen`, `dismissReminder`;
  - `setPreferences`, `putRule`, `removeRule`, `reorderRules`;
  - `writeFromAnswers` (through `ProfileWriter`).
- `project(projectId)` resolves the project path through `harness.listProjects()`.
- `sessionBlock(projectPath | null)` is the text appended to session instructions (§5).
- `rulesFor(stage, projectPath)` gives enabled rules for `stage ∈ {stage, 'any'}`, project rules first by id
  shadowing. This is the hook for the clipping module.
- **Rule validation** (`profile/profile-rules.ts`, pure):
  - required fields;
  - the id pattern (generated when missing);
  - instruction or template required;
  - `templateId` must match the template id pattern; a template that is not installed is a **warning**, not an error
    (`RcProfile.templateMissing`);
  - errors are readable, as "Field: message".
- **Names sync** (`profile/profile-names.ts`):
  - Get `namesGlossaryId`. If it is missing or was removed by the user, create the entry with `library.put`.
    Otherwise put the merged terms with `expectedVersion`, retrying once on `LIBRARY_VERSION_CONFLICT`.
  - Only new canonical terms are added (case-insensitive). Terms the user edited are never overwritten.

**Writer**: `packages/runtime-core/src/profile/profile-writer.ts`.

- **Agent resolution.** The agent is `agent.defaultDriver`, or else the first available driver from
  `harness.agents()`. If none is installed and signed in, the writer goes straight to the fallback.
- **Run.**
  - It uses `runConfinedTurn` (extracted from `agent-image-generator.ts` into
    `packages/providers/src/agent/confined-turn.ts`): `confinement: 'cwd-write-only'`, no MCP tools, approvals
    declined, a 3-minute timeout.
  - The prompt is agentcut's (English, `i18n-ignore`) with "reply in no language other than the answers' language"
    added.
  - The output `profile.json` must match the zod schema `{preferences: string(1..4000), names: [{term, misheard[]}] ≤ 60}`.
  - The output file is deleted before the run, so a stale answer cannot pass.
- **Fallback.** On failure the section becomes `- <question>: <answer>` lines (English labels, user answers).
- **Progress.** `profile.writing` events carry agent message and tool lines (≤ 400 characters, the last 3 kept).
- **Concurrency.** One write at a time. A second call gets `conflict` (`PROFILE_WRITE_BUSY`).
- **Result:** `{preferences, names: string[], usedAgent, fallbackReason?: 'no-agent' | 'agent-failed' | 'bad-output'}`.

**Methods** (`RpcMethods` in `protocol/src/methods.ts`; zod in `protocol/src/profile-schemas.ts` exporting
`PROFILE_PARAM_SCHEMAS`, spread into `schemas.ts`; table in `runtime-core/src/profile/profile-methods.ts`, spread
into `handlers.ts`)

| Method | Params | Result | Notes |
|---|---|---|---|
| `profile.get` | `{}` | `ProfileSnapshot` | |
| `profile.getProject` | `{projectId}` | `ProjectProfile` | `not-found` `PROFILE_PROJECT_NOT_FOUND` |
| `profile.saveAnswers` | `{answers, commandId?}` | `InterviewState` | merges; unknown ids are rejected by zod |
| `profile.skipInterview` | `{}` | `InterviewState` | |
| `profile.reopenInterview` | `{}` | `InterviewState` | |
| `profile.dismissReminder` | `{}` | `InterviewState` | UI only, not an agent tool (as in agentcut) |
| `profile.writeFromAnswers` | `{answers?}` | write result | `invalid-request` `PROFILE_NO_ANSWERS` "Answer at least one question, or skip."; the client calls it with `timeoutMs: 240_000` |
| `profile.setPreferences` | `{projectId?, own?, interview?}` | `ProfileSnapshot` or `ProjectProfile` | with `projectId`, only `own` is allowed (`PROFILE_PROJECT_TEXT_ONLY`) |
| `profile.putRule` | `{rule, projectId?}` | `{rule, warnings: LocalizedText[]}` | creates or replaces by id; `invalid-request` `PROFILE_RULE_INVALID` |
| `profile.removeRule` | `{id, projectId?}` | `{removed: ProfileRule}` | `not-found` `PROFILE_RULE_NOT_FOUND`; the UI's Undo re-puts `removed` |
| `profile.reorderRules` | `{ids, projectId?}` | `{rules}` | `ids` must be a permutation of the level's ids (`PROFILE_RULE_ORDER`); one write |
| `profile.draftRule` (step 13) | `{text, current?, history ≤ 20}` | `{rule \| null, message}` | saves nothing |

**Errors** use `new RpcError(code, RcProfile.x(), {code: 'PROFILE_…'})`. Every `RcProfile` entry has its `vi`
translation.

**Topic**: `'profile'`, added to `Topic`, `TopicMap`, `SnapshotOf` and `EventOf` in `protocol/src/events.ts`, and
routed in `handlers.ts` `subscribe`. Its events (`ProfileEvent`):

- `{type: 'profile.updated', snapshot}`: the whole snapshot, which is small.
- `{type: 'profile.writing', writing: ProfileWriteState | null}`.
- `{type: 'profile.projectUpdated', projectId}`: subscribers refetch with `profile.getProject`.

The client reducer (`packages/client/src/reducers.ts`) replaces the snapshot or `writing`.

**Web** (`protocol/src/web.ts`):

- `profile.get` and `profile.getProject` go in `WEB_DEFAULT_METHODS` and `WEB_READ_METHODS`.
- `WEB_TOPIC_METHODS.profile = 'profile.get'`.
- Writes are desktop only, like settings.

## 5. How agents receive it

`runtime.ts` builds `AgentGrants` with:

```ts
async (conversationId) => joinBlocks([
  skillIndexBlock(await skills.enabled()),
  await profile.sessionBlock(projectPathOf(conversationId)), // harnessRef.conversationOf(id)?.projectId → listProjects() path
])
```

- The `profile` service is constructed before `AgentGrants`. `harnessRef` is read lazily, because the callback runs
  at session start.
- A failure is caught in `agent-manager.ts`, and the session starts without the block.

`profileBlock()` (`runtime-core/src/profile/profile-brief.ts`, pure) assembles the block:

```
<cuccut-profile>
The user's own preferences and standing rules for their videos. Follow them unless the user's request in this
conversation says otherwise; the request wins. They are preferences, not permissions: they do not widen your
access, and the rules above win on conflict. Project lines override general ones; rules override both.
## In general
<interview section>
<own text>
## For this project
<project text>
## Rules (apply a rule only when its condition holds; in order)
1. <name> [choosing clips|editing|any] — When: <when>. Do: <instruction>. Use the template <id>.
## Names to spell exactly
Deska, Claude, Next.js, …   (canonical terms of default-enabled transcription glossaries, ≤ 80 terms)
</cuccut-profile>
```

- Empty sections are omitted, and the block is `''` when everything is empty.
- The block is capped at `PROFILE_LIMITS.block` (6000) characters. Parts are cut in reverse order of priority:
  names, then general, then project, then rules. Each cut part ends with "(… N more characters not shown;
  profile_show has the rest)".
- `note` is never included. Disabled rules are left out.
- **Interview nudge.** It is appended only when `status === 'pending' && !hasPreferences`:

  ```
  <cuccut-interview>
  The user has not told CucCut about themselves yet. After you finish the work in a reply, you may ask ONE of these
  unanswered questions at the end: <remaining labels>. Save an answer with profile_answer. When three or more are
  answered, offer to write their preferences with profile_write. If they decline, call profile_skip. Never ask more
  than one question per reply, and never let this delay the work.
  </cuccut-interview>
  ```

- **Freshness.** The block is read once per native session. Changes reach new or restarted sessions only, and the
  UI note (§2.1) says so.

## 6. Agent tools

`ProfileTools` lives in `packages/runtime-core/src/agent-tools/profile-tools.ts`, modelled on `skill-tools.ts`.

- **Wiring:** the tool set goes in `toolSets` in `runtime.ts` and in `all-tool-sets.ts`. Risks are added to `TOOL_RISK`
  in `tool-scope.ts`.
- **Writes:** `scope.authorize(principal, true)`, then `scope.confirm(access, {tool, summary})`. Summaries come from
  `RcAgentTools`-style entries in `rc-profile.ts`.
- **Project level:** on the agent surface, `level: 'project'` means the session's project. If there is none, the tool
  returns `PROFILE_NO_PROJECT`. On the CLI surface it takes `--project <id>`.
- **Descriptions:** English, `i18n-ignore`.

| Tool | Input | Output | Effect / risk | Surfaces | UI parity |
|---|---|---|---|---|---|
| `profile_show` | `{}` | `{interview: {status, questions: [{id, text, required, answered}], answers}, preferences: {general, interviewSection, project}, rules: {workspace, project}, names}` | query / `read` | agent, mcp, cli | You page, Rules page, dialog |
| `profile_answer` | `{answers: {who?, record?, platforms?, annoys?, names?}}` | `InterviewState` | mutation / `edit` | agent, cli | Save answers, chat card |
| `profile_skip` | `{}` | `InterviewState` | mutation / `edit` | agent, cli | Skip, Not now |
| `profile_write` | `{}` | write result | mutation / `high` | agent, cli | Write / Rewrite my preferences |
| `profile_preferences_set` | `{level: 'workspace' \| 'project', text, mode: 'append' \| 'replace'}` | `{text}` | mutation / `high` | agent, cli | In your words, project Preferences |
| `profile_rules_save` | `{level, rule: {id?, name, when, instruction?, templateId?, stage?, order?, enabled?}}` | `{rule, warnings}` | mutation / `high` | agent, cli | Rule form |
| `profile_rules_remove` | `{level, id}` | `{removed}` | destructive / `high` | agent, cli | Delete (Undo) |

Notes on the tools:

- `profile_preferences_set` writes only the user's own text, never the interview section. With `append`, it adds the
  lines after a newline.
- `profile_rules_save` returns `warnings` that tell the agent a template is missing.
- Why `high`: profile writes land outside the project directory (the `high` definition in `protocol/src/access.ts`),
  and `high` is never "always allowed", so the user sees every preference or rule the agent saves. Interview answers
  are the user's own words given in the conversation, so they get `edit`.
- **MCP:** add `profile_show` to `MCP_SERVICE_TOOL_NAMES` (`protocol/src/services.ts`). Writes are not exposed to
  external services.
- **SKILL.md** (`skills/cuccut/SKILL.md`). The hard-rule count stays the same on both surfaces:
  - Agent surface, rule 11: add "The exception is the user's profile: when the user asks you to remember a
    preference or a rule, or answers an interview question, save it with {{tool:profile_preferences_set}},
    {{tool:profile_rules_save}} or {{tool:profile_answer}}; each save asks the user."
  - CLI surface, rule 11: add "profile" to the list of admin commands.
  - `references/catalog/system.md` gets a short "Profile" entry using `{{tool:profile_show}}` and the rest.

## 7. UI

**State and commands**

- `packages/ui/src/state/profile-store.ts`: a zustand mirror of the `profile` topic (`ready`, `snapshot`, `writing`).
  It is fed from `runtime/session.ts`, which subscribes next to `settings` and `library`.
- `packages/ui/src/runtime/profile-commands.ts`:
  - `saveAnswers`, `skipInterview`, `reopenInterview`, `dismissReminder`;
  - `writeFromAnswers` (`timeoutMs` 240 s), `setPreferences`, `putRule`, `removeRule` (returns the Undo thunk),
    `reorderRules`;
  - `loadProjectProfile` (dedupes in-flight requests, like `loadSkills`).
- `packages/ui/src/model/profile.ts` (pure, tested):
  - `interviewLine(status, hasSection)` and `railSummary`;
  - `ruleEffects(rule, templates)`, `stageLabel`, `renumber(ids)`;
  - `newRuleId(name)` (slug ≤ 55 + 8 hex) and `ruleDraftErrors(draft)` (returns the "why disabled" reason);
  - `nextQuestion(state, skippedThisSession)` and `answerCount`.

**Components** (all cc primitives under `data-cc`; the S2 `Switch` / `Picker` are fine inside panels)

- `components/settings/profile-settings.tsx` (You), `components/settings/rules-settings.tsx`, and
  `components/profile/rule-form.tsx` (shared with the project dialog).
- `components/profile/welcome-page.tsx` (route), `components/landing/interview-reminder.tsx` (mounted in
  `home-landing.tsx` above `StartPage`), `components/thread/interview-card.tsx` (mounted in `conversation-view.tsx`
  above `<Thread>`), and `components/profile/project-profile-dialog.tsx`.

**Hooks into existing screens**

- `model/settings-nav.ts`: `SETTINGS_SECTIONS` gains `'you'` and `'rules'`, and `SETTINGS_GROUPS.preferences` becomes
  `['you', 'rules', 'general', 'shortcuts', 'fonts']`. Group ids stay distinct from the keys.
- `model/settings-nav-copy.ts` (+ locales): `section.you` "You" and `section.rules` "Rules".
- `components/settings-page.tsx`:
  - `SECTION_ICON` gets `you: UserRound` and `rules: Scale`;
  - add two `section === …` branches;
  - `useRailSummaries` gets `you` and `rules`, using `components/settings/workspace-copy.ts` `W`.
- `state/shell-store.ts`:
  - `Tab` gains `'welcome'` and `Route` gains `{tab: 'welcome'}`;
  - `hrefFor` / `parseHref` handle `/welcome`, `hasSidebar` is false for it, and `railTabOf` maps it to `'home'`;
  - add `defaultRoute('welcome')`.
- `components/app-shell.tsx`: the `route.tab === 'welcome'` branch renders `WelcomePage`.
- `home-sidebar.tsx` (project menu key `'profile'`) and `conversation-header.tsx` `SessionMenu` open the project
  dialog.

**Look**

- Agentcut's "You" is the pixel reference.
- Panels are solid at 24px, the dialog is 20px, buttons are capsules, and fields are recessed.
- There is one tinted action per view: "Save preferences" (when dirty), "Create a rule" (empty state), "Save rule",
  "Continue" / "Write my preferences" / "Save and start".
- Never hard-code Spectrum blue.

## 8. Tests

**Storage** (`runtime-storage/src/profile-store.test.ts`):

- defaults; reopen persistence; a corrupt file is renamed;
- a newer schema is read-only and not rewritten;
- concurrent writes are serialised;
- `normalize` drops bad rules and duplicate ids and clips text;
- the project file is round-tripped next to `.ccut/project.json`.

**Pure Runtime logic**:

- `profile-rules.test.ts`: validation messages, the instruction-or-template requirement, the missing-template
  warning, id generation and dedupe.
- `profile-brief.test.ts`: section order, omission of empty parts, the 6000 cap with its overflow line, `note`
  excluded, disabled rules excluded, the nudge only when pending with no preferences.
- `profile-names.test.ts`: create, merge (case-insensitive, user terms kept), a removed entry is recreated, retry on
  version conflict.

**Service and methods** (`profile/profile-service.test.ts`):

- Status semantics: an answer after a skip keeps the status skipped; skip keeps the answers; reopen restores them.
- `PROFILE_NO_ANSWERS`.
- Reorder is a permutation, written once.
- Project-level errors.
- Topic events are published once per write.

**Writer** (`profile/profile-writer.test.ts`, fake `AgentDriver`):

- Agent output parsed.
- The output file is deleted before the run.
- Bad JSON, a timeout and no agent each fall back to the answers as typed, with `fallbackReason`.
- The scratch directory is removed.
- `PROFILE_WRITE_BUSY`.
- Progress events are capped.
- Plus a regression test that `agent-image-generator.ts` behaves the same after the extraction (its existing tests
  still pass).

**End to end** (`profile/profile-runtime.test.ts`, modelled on `skills/skill-runtime.test.ts`):

- `startRuntime` with a fake driver; save preferences and a rule; a new session's
  `options.developerInstructions` contains `<cuccut-profile>` with both.
- A project session gets its project lines.
- An empty profile adds nothing.
- A pending interview adds `<cuccut-interview>`.
- A session started before an edit keeps the old text.

**Tools**:

- `agent-tools/registry-tools.test.ts`: `profile_show` and `profile_answer` through the real client; writes ask for
  approval with risk `high`.
- `catalog-metadata.test.ts` and the `tools/catalog-snapshot.ts` regeneration.
- `services/mcp-tools.test.ts`: `profile_show` exposed, writes not.

**Protocol**:

- `protocol/src/profile.test.ts`: schemas accept the documented examples and reject unknown question ids and
  over-long text.
- Add an assertion next to the existing `WEB_DEFAULT_METHODS` checks (`protocol/src/drivers.test.ts`) that `profile.get` is readable and the writes are not.

**UI**:

- `model/profile.test.ts`.
- `runtime/profile-commands.test.ts` (fake client; Undo re-puts the rule).
- `model/settings-nav.test.ts` (updated group list).
- `state/shell-store.test.ts` (the `/welcome` round-trip).
- `components/settings/settings-copy.test.ts` and `copy.test.ts`.
- The `tools/i18n-scan.mjs` gate, with tests under `CUCCUT_LOCALE=zh-Hans`.

**CLI**: `apps/cli/src/admin/profile-output.test.ts`.

**QC screenshots**:

- Run `npm run build:web`, then
  `node tools/qc-shot.mjs --out <dir> /settings/you /settings/rules /welcome /home`, with a distinct `--home` and
  `--port`.
- Seed one home with the interview skipped and a few answers to match `settings.png`, and a second home with rules
  and an interview section.
- Compare with `docs/cuccut/reference/settings.png`. Also check the empty Rules state, the rule form, the welcome
  asking and review phases, and the reminder line on home, at narrow width (the rail wraps into chips).

## 9. Implementation steps

Each step is one agent's work. The gates for every step are `npx tsc -p tsconfig.json --noEmit` and
`npx vitest run <touched areas>`; UI steps also take screenshots.

1. **Protocol.**
   - New `packages/protocol/src/profile.ts`, `profile-schemas.ts` and `profile.test.ts`.
   - Edit `methods.ts` (methods), `schemas.ts` (spread `PROFILE_PARAM_SCHEMAS`), `events.ts` (topic `profile`),
     `web.ts`, `index.ts` (exports).
   - New `messages/runtime-core/rc-profile.ts` + 14 locales (vi filled), registered in
     `messages/runtime-core/index.ts`.
   - `packages/client/src/reducers.ts` (+ `reducers.test.ts`).
2. **Storage.**
   - New `packages/runtime-storage/src/profile-store.ts` (workspace) and `project-profile-file.ts` (project), with
     tests.
   - Edit `home.ts` (`profileFile`) and `index.ts`.
3. **Service and methods.**
   - New `packages/runtime-core/src/profile/profile-service.ts`, `profile-rules.ts`, `profile-names.ts` and
     `profile-methods.ts`, with tests.
   - Edit `handlers.ts` (`HandlerDeps`, the method spread, `subscribe`) and `runtime.ts` (construct and stop).
4. **Session block.**
   - New `profile/profile-brief.ts` (+ test).
   - Edit `runtime.ts` (`AgentGrants` callback and `projectPathOf`).
   - New `profile/profile-runtime.test.ts`.
5. **Writer.**
   - Extract `packages/providers/src/agent/confined-turn.ts` from `agent-image-generator.ts` and export it.
   - New `runtime-core/src/profile/profile-writer.ts` (+ test).
   - Wire `profile.writeFromAnswers` and the `profile.writing` events.
6. **Agent tools.**
   - New `runtime-core/src/agent-tools/profile-tools.ts`.
   - Edit `tool-scope.ts` (`TOOL_RISK`), `runtime.ts` (`toolSets`), `all-tool-sets.ts`, `protocol/src/services.ts`
     (`MCP_SERVICE_TOOL_NAMES`), `skills/cuccut/SKILL.md` (both rule 11s) and
     `skills/cuccut/references/catalog/system.md`.
   - Regenerate the catalog snapshot (`tools/catalog-snapshot.ts`, `npm run build:agent-skill`).
   - Update `registry-tools.test.ts`, `catalog-metadata.test.ts` and `services/mcp-tools.test.ts`.
7. **CLI.**
   - New `apps/cli/src/admin/profile.ts`, `profile-copy.ts` + 14 locales, `profile-output.ts` (+ test).
   - Edit `admin/index.ts`.
   - Subcommands: `show`, `answers set <id> <text>`, `interview skip|reopen|write`,
     `preferences [--project] --file <md>`, `rules list|enable|disable|remove|move`.
8. **UI data layer.**
   - New `ui/src/state/profile-store.ts`, `ui/src/runtime/profile-commands.ts` (+ test) and `ui/src/model/profile.ts`
     (+ test).
   - Edit `ui/src/runtime/session.ts` (subscribe).
9. **Settings → You.**
   - New `ui/src/components/profile/profile-copy.ts` + 14 locales and `components/settings/profile-settings.tsx`.
   - Edit `model/settings-nav.ts`, `settings-nav-copy.ts` + locales, `components/settings-page.tsx`,
     `components/settings/workspace-copy.ts` + locales, and `model/settings-nav.test.ts`.
   - Screenshot `/settings/you` against `settings.png`.
10. **Settings → Rules.**
    - New `components/profile/rules-copy.ts` + 14 locales, `components/settings/rules-settings.tsx` and
      `components/profile/rule-form.tsx`.
    - Edit `settings-page.tsx` (branch, icon, summary).
    - Screenshots: empty, list and form.
11. **Welcome, reminder and chat card.**
    - New `components/profile/welcome-page.tsx`, `components/landing/interview-reminder.tsx` and
      `components/thread/interview-card.tsx`.
    - Edit `state/shell-store.ts` (+ test), `components/app-shell.tsx`, `components/home-landing.tsx` and
      `components/conversation-view.tsx`.
    - Screenshots of `/welcome` (all three phases) and of home.
12. **Project dialog.**
    - New `components/profile/project-profile-dialog.tsx`.
    - Edit `components/home-sidebar.tsx`, `components/conversation-header.tsx` and the `shell-copy.ts` menu label (+
      locales).
13. **Optional: rule drafting with the agent.**
    - `profile.draftRule` in `profile-writer.ts` (shared runner, a `proposal.json`, the id kept for an existing draft,
      `validateRule`, nothing saved), plus the "Create with the agent" disclosure in `rule-form.tsx` and its copy.
14. **QC and docs.**
    - Full `npm test`; screenshots of every screen above at desktop and narrow widths.
    - Update `docs/cuccut/PLAN.md` (M2 progress, decisions: separate fields instead of markers, Undo instead of
      confirm, no first-run redirect).

## 10. Open questions

1. **First-run redirect.** agentcut sends `/` to `/welcome` while the interview is pending with no preferences;
   CucCut's product design says never block first launch. This design shows the reminder line only. Should first
   launch redirect once?
2. **Default settings section.** agentcut opens `/settings` on "You"; CucCut opens "General". Should "You" become the
   default?
3. **Direct model calls.** Should general preferences also go into AI-tool prompts (`ai-tool-prompt.ts`) and scene
   template briefs, given grants and cloud providers? (SKILL.md rule 12 and `SCENE_BRIEF_PREAMBLE` point 5 already
   mention "recorded preferences" for the output language.)
4. **Writer agent choice.** Should the writer always use the default agent, or follow the agent of the conversation
   that asked (`profile_write`)? And should it honour an explicit setting such as `profile.writerDriver`?
5. **Risk of agent writes.** Is `high` (asks in every mode except full access) too noisy for "remember this"
   requests? `edit` would let "always allow" cover it.
6. **Observations.** Should CucCut tag human vs. agent edits in the engine's edit log so the "Corrections" panel and
   `observations.review` can come next milestone?
7. **Web writes.** Should a paired browser be allowed to edit preferences and rules, or stay read-only like settings?
8. **Rule `stage`.** Is `any | clip | edit` enough once the clipping and packs modules land, or do templates need a
   stage of their own ("creating")?
