# External Agent-Facing Surface: CLI, MCP, and the CucCut Skill

> Design draft, 2026-10-06, not implemented. Goal: let other agents (Claude Code, Codex, Cursor, Gemini CLI, etc.) use CucCut's capabilities for transcription, subtitle translation, dubbing, editing, downloading, transcoding, and export without going through CucCut's own agent. Three things are designed together: the `cuccut` command-line tool, the outward-facing MCP service, and the `cuccut` skill that teaches external agents to use them.
>
> This document is a design, not a reference manual: the exact parameters of commands and tools follow the output of `cuccut spec` after implementation; here we only fix names, layers, conventions, and boundaries. Compatibility with v2 (`ccut`) or the current v3 CLI is not considered; the v2 CLI design and skill are for reference only.

## Contents

1. [Problem and goals](#1-problem-and-goals)
2. [One catalog, three consumers](#2-one-catalog-three-consumers)
3. [Principals and permissions](#3-principals-and-permissions)
4. [The agent-facing capability catalog](#4-agent-facing-capability-catalog)
5. [CLI conventions](#5-cli-conventions)
6. [MCP conventions](#6-mcp-conventions)
7. [Where the existing CLI commands go](#7-where-existing-cli-commands-go)
8. [The CucCut skill](#8-cuccut-skill)
9. [Spec entries to revise](#9-spec-entries-to-revise)
10. [Implementation order and acceptance](#10-implementation-order-and-acceptance)
11. [Settled decisions and open questions](#11-settled-decisions-and-open-questions)

---

## 1. Problem and Goals

### 1.1 Current State

v3 already has three program-facing entry points, but only two share an implementation:

| Entry point | Implementation | Consumers |
| --- | --- | --- |
| Tool bridge (in-session agent) | `ToolCatalog` + `ToolSet` (zod schema, descriptions, dispatch by principal) + `McpEndpoint`, `packages/runtime-core/src/agent-tools/` | Native sessions such as Codex and Claude |
| Outward MCP service | The same `ToolCatalog`, plus the views from `ServiceScope` and `MCP_SERVICE_TOOLS` | Agents inside other applications |
| CLI | `apps/cli/src/main.ts`, hand-written: 2800 lines, a 400-line `USAGE`, each command calls gateway methods directly | People, scripts, and agents making do with it |

The architecture design §3.6 says "tool definitions, interface controls, and CLI help are derived from the same registration source", but the CLI has never fulfilled this. The consequences for agents are three points of friction:

- **One thing, three names.** Transcription is `models_transcribe` in the tool bridge, but `cuccut transcribe <videoId> <assetId>` and `cuccut transcribe --file` in the CLI, with different parameter names. The term an agent learned in the skill does not match when it enters through another entry point.
- **Help is long text written for people.** `cuccut --help` prints 400 lines at once, with no machine-readable self-description. An agent that wants one flag must read the whole block into its context.
- **"tools" collides in four places.** The protocol's `tools.*` is the tools page catalog, `cuccut tools` is yt-dlp / ffmpeg, `cuccut toolbox` is again the tools page catalog, and the agent's `ToolCatalog` is called the tool catalog.

In addition, the outward MCP service, per §4.8, does not open creating new videos, creating subtitle layers, cancelling tasks, or importing from links. External agents therefore cannot complete the most common chain, "“link → transcribe → translate → subtitles → export”". The existing CLI also defaults to connecting to the Runtime launched by the desktop app, so when the App is not open it cannot do anything.

### 1.2 Goals

- **One catalog.** The CLI becomes the third consumer of `ToolCatalog`: command names, parameters, help, and errors are all derived from the catalog, and the hand-written `USAGE` block disappears entirely. A new capability is registered once in the catalog and appears on all three surfaces at once.
- **One mapping rule.** MCP tool `a_b` is CLI `cuccut a b`, with parameters of the same name. Skills and the `next` field in errors only need to state this rule once, so an agent can follow it at any entry point.
- **Agents find instructions quickly within limited context.** A one-screen `--help`, on-demand `help <command>`, a machine-readable `spec`, errors that carry `next`, and a skill directory page organized by task. Depth is reached by expanding on demand, not by reading everything at once.
- **Usable without opening the App.** The CLI can start the Runtime itself and shut it down afterward according to the ownership rules.
- **Scope.** Local model capabilities (transcription, speech synthesis, local model packs), video rendering and export, video download, video editing and cutting, and transcoding; reading and writing scripts and translations (agents do their own text work). Sessions, templates, external service management, credentials, and so on remain in the CLI for people, but do not enter the agent surface.

---

## 2. One Catalog, Three Consumers

```text
                    ┌────────────────────────────────────────────┐
                    │ ToolCatalog（Runtime 进程内）              │
                    │  ToolSet × n：schema · 说明 · 风险 · dispatch │
                    │  ToolCatalogView：按主体过滤与改写说明      │
                    └──────┬───────────────┬──────────────┬──────┘
                           │               │              │
   AgentPrincipal          │ ServicePrincipal             │ LocalPrincipal（新）
   AgentScope              │ ServiceScope                 │ LocalScope（新）
                           │               │              │
                 McpEndpoint（工具桥）  McpEndpoint（MCP 服务）   网关方法 catalog.list / catalog.call
                           │               │              │
                   会话里的智能体     其他应用里的 Agent      cuccut CLI（终端里的 Agent 与人）
```

### 2.1 No New Shared Layer

The shared layer is the existing `ToolCatalog`. Rather than introducing a further "operation registry" shared by the CLI and MCP, this design fills in three things:

1. **CLI principal and scope**: `LocalPrincipal` and `LocalScope` (§3).
2. **Gateway methods** `catalog.list` and `catalog.call`: list the catalog (including JSON Schema, descriptions, risk, and annotations); call by name, with JSON parameters. Both go through the existing WebSocket gateway and the local token. The existing `CucCutClient` used by the CLI calls them directly, and task progress is subscribed through the `jobs` topic on the same connection.
3. **The CLI derivation layer**: derive the command tree, flag parsing, `--help`, `spec`, and output rendering from the catalog (§5).

We do not choose "the CLI as a client of the local `McpEndpoint`": that endpoint's token is bound to a session (`AgentGrants`), and the CLI has no session. Moreover, the CLI must also subscribe to progress and call local management methods, so it needs a gateway connection anyway.

### 2.2 Shape of a Catalog Entry

Each catalog entry (tool) adds the following fields on top of the existing `ToolDefinition`, and all three surfaces use them:

| Field | Purpose |
| --- | --- |
| `name` | `<noun>_<verb>` or a top-level verb (§4.1). This is a public contract; renaming it requires an interface version bump |
| `title`, `description` | The first sentence of `description` is a one-line summary (`--help` and the MCP list take only this); the details follow after it |
| `inputSchema` | zod → JSON Schema. Every field has a `description`, enum values are listed in full, and CLI flags are derived from it |
| `annotations` | MCP-standard `readOnlyHint`, `destructiveHint`, `idempotentHint` |
| `risk` | The level from `TOOL_RISK` (`read` / `command` / `high` …). Each of the three principals decides from it whether to ask for confirmation |
| `effect` | `query` (read-only), `mutation` (enters the undo stack), `job` (returns a `jobId`), `destructive` (irreversible). The skill's hard rules are stated in these terms: `job` must be waited on, `mutation` requires reading the receipt, `destructive` requires `--yes` |
| `examples` | One to three minimal call examples (JSON parameters), shown by `help <command>` and `spec` |
| `surfaces` | Which surfaces it appears on: `agent` (tool bridge), `mcp`, `cli`. All three by default; tools meant only for the in-session agent (`tasks_*`, `grants_request`, `downloads_save`, `slides_*`) are marked `agent` |

`effect` and `examples` are new fields; the rest already exist. The existing `read` / `write` of `MCP_SERVICE_TOOLS` are derived from `annotations.readOnlyHint` and are no longer maintained as a separate table.

### 2.3 Generation and Snapshots

- **Runtime**: `catalog.list` is the source of truth. After the CLI connects to the Runtime, it parses arguments according to it, so help changes along with the Runtime version.
- **Offline**: `cuccut --help`, `cuccut help <command>`, and `cuccut spec` must work without a Runtime, since agents often look at help before deciding whether to start one. At build time the catalog is exported to `apps/cli/src/generated/catalog.json` (a generated artifact, written by a script under `tools/`, not committed to git), and a test asserts that it matches the current output of `ToolCatalog`.
- **Consistency tests**: each catalog entry must have a first-sentence `description`, every field must have a `description`, and `examples` must pass their own schema. The command tree derived for the CLI must not contain any agent-surface command that is outside the catalog.

---

## 3. Principals and Permissions

### 3.1 Three Principals

| | In-session agent | MCP service client | CLI |
| --- | --- | --- | --- |
| Principal | `AgentPrincipal { conversationId }` | `ServicePrincipal { serviceId, clientId }` | `LocalPrincipal { client: 'cli', cwd, projectDir? }` (new) |
| Scope | The session's source directory and TaskContract | Access policy: video allowlist + `read` / `ask` / `auto` | Everything the user can access: relative paths resolved against `cwd` or `--project`; videos by `videoId` or directory |
| Actor on writes | `agent` | `agent`, `external:<serviceId>` | `user_local`: the same as the desktop UI, sharing its undo stack |
| Confirmation | Asked of the user in-session, according to access mode and risk | Under `ask`, a service approval is generated, with a 50-second timeout | **Does not go through CucCut's approval.** The CLI is the user operating in their own terminal, or a terminal agent the user has authorized; confirmation is handled by the agent host (Claude Code, Codex's own permission prompts). `destructive` calls require `--yes` |
| Outbound data | Covered by a Grant; otherwise approval | Covered by a Grant; under `auto`, no Grant means denial | The same as the desktop UI: an online Provider already enabled by the user is enough (enabling is a continuing authorization, Architecture Design §6.4) |
| Task submitter | `{ kind: 'agent', id: session, taskId }` | `{ kind: 'service', id, clientId }` | The same as submission from the desktop UI connection; the audit records `client: 'cli'` |
| Tasks visible | Those submitted by this session and those on videos already open in the source directory | Those it submitted itself | All (the same as the task center) |

### 3.2 LocalScope Rules

- **Paths.** Media import, export targets, and transcode output resolve relative paths against `cwd`; absolute paths are accepted as-is. Video directories (containing `video.db`) and `.ccut` remain unwritable (this is the engine's protection, not a scope restriction). There is no directory constraint such as `PATH_OUTSIDE_PROJECT`: a user at a terminal can already read and write their own files.
- **Referring to a video.** The `video` parameter accepts a `videoId`, the path of a video directory (absolute or relative to `cwd`), or a Space entry id. The resolution order is directory → `videoId` → entry. A video that is not open is opened by the Runtime for the duration of the call and is not forcibly closed afterward (the same as the tools page).
- **Project.** Given explicitly with `--project <directory>`. If not given, search upward from `cwd` for `.ccut/project.json`. If none is found, treat it as "no project", and a new video goes to `CUCCUT_PROJECTS_DIR`, with the result stating so.
- **What it cannot do.** The CLI's agent surface likewise provides no settings, credentials, service management, or arbitrary command execution. These sit in the CLI's admin bucket (§7), are not in the catalog, and the skill states that the user's consent must be obtained first.

### 3.3 Responsibilities of the Terminal Agent

The CLI does not distinguish between commands typed by a person and those typed by an agent. For the agent host's permission prompts to be effective, the CLI does three things:

- Every command with side effects marks its effect in the first line of `--help` and in `spec.effect`, so the host's prompt rules (for example, Claude Code allowing by command prefix) can classify them.
- A `destructive` command without `--yes` prints what it would do and rejects with exit code 4. It does not enter interactive confirmation, since an agent without a TTY would wait forever.
- `edits apply` accepts `--dry-run` (it goes through `prepareBatch` and returns only the impact), so an agent can look before it submits.

---

## 4. Agent-Facing Capability Catalog

### 4.1 Naming Rules

- **MCP tool names are `<noun>_<verb>`; CLI is `cuccut <noun> <verb>`**. Top-level verbs have no noun, and both surfaces use the same name. Multi-word verbs use `_` in MCP and `-` in the CLI: `captions_create` ↔ `cuccut captions create`, `import_package` ↔ `import-package`.
- **Nouns use the plural form of the protocol namespace** (`videos`, `documents`, `edits`, `captions`, `assets`, `jobs`, `models`, `space`, `projects`, `artifacts`, `skills`), so they map mechanically onto the gateway methods `videos.*`, `jobs.*`, and so on, without inventing a third naming scheme. `space` is itself a singular proper name.
- **Parameter names follow one scheme**: catalog field names become CLI flags directly, in kebab-case: `video` → `--video`, `documentId` → `--document-id`, `layoutProfileId` → `--layout-profile-id`. The MCP surface uses the field name as is. Each tool takes at most one positional argument, specified by the catalog entry's `positional` field (usually `video`, `url`, or `file`).
- Names always use the glossary's terms: the editable entity is `video`, the directory is `project`, what sits on the timeline is `item`, and a media file is `asset`.

### 4.2 Top-Level Verbs: Fixed Pipelines and Generation

All are `effect: 'job'` and return a `jobId`. The CLI waits by default (§5.4); MCP pairs them with `jobs_wait` (§6.2). Parameters follow the existing fixed pipelines and model tools; only the entry points and key options are listed here.

| Name | What it does | Key parameters |
| --- | --- | --- |
| `transcribe` | Transcription pipeline (architecture design §7.9): create a video if needed → transcribe into a new document → build a caption layer | Input is one of three: `file` (local media), `url` (a link, including download), or `video` (an existing video, optionally with `asset`); `project`; `no-video` (writes only `.txt` and `.srt` files, no video); `language`, `provider`, `model`, `diarize`, `glossary`; `no-captions` |
| `translate` | Uses the **configured text model** to translate a transcript or subtitle file, writing a new translation and building a caption layer | `video` + `to`, optionally `document`, `style`, `glossary`, `bilingual`, `no-captions`; or `file` (SRT / VTT) + `to`. Without a text model it is refused with `CAPABILITY_NOT_CONFIGURED`, and `next` points to the agent self-translation path (§4.4) |
| `dub` | Translated dubbing: if no translation exists, translate first; synthesize line by line, align, and add a dub track | `video`, `to`, `voice`, `translation`, `original`, `separate-background`, `provider`, `model` |
| `download` | Download media from a link (yt-dlp); can import into an existing video, or create a new video and transcribe (currently `import-link`) | `url`; destination is one of three: `project` (download only), `video` (import into an existing video; if the timeline is still empty, also place it on the main track), `new-video` (create and place on the timeline); `transcribe`, `subs`, `audio-only`, `name` |
| `export` | Export subtitles, documents, audio, the final cut, a portable package, or a project | `video`, `kind`, `format`, `out`, `range`, `document`, `bilingual`, and for the final cut `codec` / `width` / `height` / `fps` / `crf` / `burn-captions`, etc. (currently all `export` options) |
| `transcode` | File-to-file: compress, merge in order, or extract an audio track (no video is created); the only input is a local file, so it is not on the MCP surface | `files`, `merge`, `extract-audio`, `codec`, `max-height`, `crf`, `out-dir` |
| `speak` | Synthesize speech | `text` / `text-file`, `voice`, `provider`, `model`, `video` (imported as a candidate asset), `out` |
| `image` | Generate images | `prompt`, `size`, `count`, `provider`, `model`, `video`, `out` |
| `music` | Generate music (a song or background score): only the local music model bundle (including the audio.cpp engine component), and it is very slow | `mode` (`song` / `instrumental`), `style`, `lyrics` (only for `song`), `target-duration-sec`, `max-duration-sec`, `planning`, `seed`, `provider`, `model`, `video`, `out` |

`text` (call a text model once) is not on the Agent surface: the agent is itself a text model. It stays in the CLI for humans (§7).

### 4.3 Noun Groups: Reading and Writing Objects

| Noun | Verb | Effect | Notes |
| --- | --- | --- | --- |
| `videos` | `list` | query | Videos in scope: `videoId`, name, project, path |
| | `inspect` | query | Current version, sequences, tracks, instances, assets, document inventory; field selection, time range, and byte budget (architecture design §3.7) |
| | `create` | mutation | Create an empty video (currently `videos_create`) |
| | `frames` | mutation | **New**: take frames at a moment or over an interval and write them as PNG, returning paths (`previews.capture` in the §3.5 catalog never had a tool). Each frame carries locally detected face boxes `faces`, with a top-level `detector`. Without seeing the picture, the agent cannot cut |
| | `history` | query | Version history and checkpoints |
| | `delete` | destructive | Move to trash (currently `videos_delete`); requires `--yes` |
| | `import-package` | mutation | Open a portable package and build it as a new video (synchronous, not a job); only on the tool bridge and CLI |
| | `derive` | mutation | **New**: duplicate the parent video and cut away everything outside the range; the cut can be restored in the child video (`video`, `start`, `end`, with optional name, canvas, `fit` / `crop`, whether to keep the caption layer, translation, and chapters). Created next to the parent video; the same parameters resolve to the same child video. The first version records cut points only for one main asset; for a parent with multiple assets, `warnings` explains this (architecture design §3.5, “derived child videos”) |
| `documents` | `read` | query | Read transcript, translation, chapters, etc.: `video`, `documentId`, optional `revision`. Speech transcripts also carry `translationBasis` (`sourceBasis` and the split sentences, each with `start` and `end` in seconds on the media clock). When translating in-session with `translateTo` (target language), the UI shows “正在翻译” (“translating”), which ends when the translation is written (architecture design §3.5). Over budget, output is written to a file (§5.5) |
| | `put` | mutation | **New sugar**: write a document (create or replace), compiled into one `putDocument` of `edits_apply`. This is where the agent's own translation, polishing, and chaptering land |
| `edits` | `apply` | mutation | One transaction: `ops` (JSON array, `@file`, or stdin) + `revision`; `dry-run` runs the pre-check |
| | `undo` | mutation | Undo the most recent transaction |
| | `ops` | query | List operation families and each operation's schema and examples (command protocol §4.2); `spec edits.<op>` comes from the same source |
| `captions` | `create` | mutation | Make a caption layer from a transcript or translation (currently `captions_create`); `bilingual`, `layout-profile` |
| `assets` | `import` | mutation | **New sugar**: import a file or `artifactId`, optionally with `place` (in the same transaction, `addItem` at the end of the main track or at a given time). Compiles to `importAsset` [+ `addItem`] |
| `jobs` | `list` / `inspect` / `wait` / `cancel` / `retry` | query / query / query / mutation / job | `wait` blocks until a terminal state or a timeout; `retry` is the current `pipelines retry` |
| `models` | `capabilities` | query | For each capability: the available providers, models, defaults, limits, and reasons unavailable. `settingsHref` is the settings path for that capability; when prompting the user to configure it, write it as a Markdown link (product design §3.2.2) |
| | `list` | query | Local model bundles and their status (currently `models bundles`) |
| | `install` / `test` | job | Install a local model bundle (reports size first; `--yes` skips confirmation); run sample checks. Both are only on the tool bridge and CLI, not exposed to MCP |
| `space` | `list` / `search` | query | Entries and cross-video search (read-only) |
| `projects` | `list` / `create` | query / mutation | Project registration and creation |
| `artifacts` | `save` | mutation | Copy task outputs to files (paths under `cwd`) |
| `skills` | `list` / `read` | query | Index and body of built-in and user-level craft skills (the “fetch on demand” path in §8.3) |
| `library` | `list` / `show` | query | Glossary, voices, brand assets (read-only) |

**Rules for sugar**: `documents_put` and `assets_import` are convenience tools compiled down to core operations. They are implemented in the shared layer and present on all three surfaces. The MCP surface may hide them by default to keep the tool count down, but they must not be implemented only in the CLI. The first version adds only these two, and no clip-editing verbs such as `clips` / `cuts`: first check whether the Agent is self-descriptive enough using `edits apply` + `edits ops`; if so, add nothing.

### 4.4 The Agent Does the Text Work Itself

This is the established practice for in-session agents in v3 (the handbook's hard rule 1, §8.6), and also a hard rule of the v2 skill: translation, polishing, summarizing, and chaptering are done by the agent itself, without configuring a text model. The catalog and the skill both treat this as the default path:

```text
documents read --video V --document-id D                    → transcript body + translationBasis (sourceBasis and the split sentences: id, fingerprint, text, words, start/end seconds on the media clock)
(Agent translates sentence by sentence)
documents put --video V --kind translation --language zh-CN --source-document D --body @zh.json
captions create --video V --document-id <new translation id> --bilingual
export --video V --kind subtitles --format srt --bilingual
```

- Polishing writes back to the same speech document (`documents put --document D`). Afterward, **re-run** `documents read` before translating again: polishing changes the sentence splits and fingerprints.
- Chaptering uses `setChapters` via `edits apply`. Summaries, blogs, titles, and descriptions are plain text: use `export --kind transcript --format txt` for plain text, or `documents read` to read the sentences.
- The `translate` top-level verb is only for when the user explicitly wants the configured text model. The skill writes this into its hard rules.

### 4.5 Meta Commands

| Command | What it does |
| --- | --- |
| `cuccut` / `cuccut --help` | One screen: lists top-level verbs and noun groups by task, one summary line each, ending with a line that says `help <command>` and `spec` |
| `cuccut help <command> [<subcommand>]` | Arguments, effects, and examples for that command (derived from the catalog) |
| `cuccut spec [<name>]` | Machine-readable: JSON for the whole catalog or one entry (schema, `effect`, `risk`, `examples`, interface version). `spec edits.<op>` gives the operation's schema |
| `cuccut status` | Whether the Runtime is running, its version, and what it can do right now: the default provider and availability for each capability, local model bundles, external tools (yt-dlp, ffmpeg). Unavailable items come with remedy commands. Capabilities and model bundles default to a summary (which provider each capability uses now, which providers are available, and the status of each bundle). With `--full`, it returns the complete results of `models_capabilities` and `models_list` (models, parameters, and limits for each provider). Replaces v2's `doctor --quick` |
| `cuccut runtime ensure|status|stop` | §5.6 |
| `cuccut version` | CLI, Runtime, and interface versions |

`spec` and `version` output bare JSON; other commands follow the envelope in §5.1.

---

## 5. CLI Conventions

### 5.1 Output

- `--json`: structured result to stdout. It is turned on by default when stdout is not a TTY, so the agent never has to remember to add it. Human-readable rendering is just another formatting of the JSON.
- Success: a thin envelope `{ ok: true, result, next? }`. `result` is the tool's result object (the same JSON as an MCP tool result). `next` is the suggested next command (for example, after `transcribe`, `captions create` or `export`).
- Failure: `{ ok: false, error: { code, message, retryability?, recovery?, remedy?, next? } }`, exactly the same as `ToolCatalog.errorBody`. `code` is a closed error code (command protocol §11). `next` is written in CLI form (`cuccut models install …`); on the MCP surface the same `next` is written as a tool name. The shared layer renders the two forms according to the consumer; they are not hand-written twice.
- `CAPABILITY_NOT_CONFIGURED`'s `remedy.settingsHref` gives the settings path for that capability. The agent uses it to write a clickable settings link from `next`, without guessing the address.
- Progress goes to stderr. With `--progress jsonl`, each line is one event (`progress` / `artifact` / `warning` / `done`, with `jobId`, `stage`, `pct`); by default it refreshes a single human-readable line on a TTY.

### 5.2 Exit codes

| Code | Meaning |
| --- | --- |
| 0 | Success (including a job that completed while `--wait` was blocking) |
| 1 | Failure or cancellation (the job's terminal state is `failed` / `cancelled`, or the engine rejected the request) |
| 2 | User action required before continuing: `CAPABILITY_NOT_CONFIGURED`, `GRANT_REQUIRED`, an external tool not yet approved, etc.; the output includes `remedy` and `next` |
| 3 | Runtime unavailable or version-incompatible (different interface version, `runtime ensure` failed) |
| 4 | Invalid arguments (`INVALID_ARGUMENTS`), or a `destructive` command without `--yes` |

### 5.3 Arguments

- Flags are derived from catalog fields: `camelCase` → `--kebab-case`. Booleans are switches, and `false` is written as `--no-x`. Arrays are repeatable (`--glossary a --glossary b`) or comma-separated (when the schema marks them `csv`). Nested objects and operand arrays use JSON literals, `@file`, or `-` (stdin).
- There is one positional argument (`positional`); everything else is a flag. A positional argument and a flag of the same name are mutually exclusive.
- Times are decimal-second strings (`"12.5"`) and ranges use `a:b`. The engine snaps to frames and reports this in `timeResolution` in the receipt.
- Large text (`speak --text`, `documents put --body`) accepts `@file` and stdin. It is not recommended on the command line.
- Secrets are read only from stdin (`models configure --key-stdin` in the admin bucket is unchanged). The Agent surface has no command that reads or writes credentials.

### 5.4 Long-running jobs

- Commands that return a `jobId` default to `--wait`: they block until a terminal state, the exit code follows the terminal state, and the result includes `outputs` (file paths, `documentId`, `assetId`, `artifactId`) and the terminal job record `job`. The `state` in the submission receipt is replaced with the terminal state, matching `job.state`. `--no-wait` returns the `jobId` immediately. `--timeout <seconds>` prints the `jobId` and recent progress when the time runs out, returns exit code 1, and the job keeps running.
- Ctrl-C cancels the job (existing behaviour). After `--no-wait`, use `jobs cancel`.
- Progress goes to stderr, so stdout JSON stays clean.

### 5.5 Spilling large results to disk

The full text from `documents read`, the complete timeline from `videos inspect`, and a large number of hits from `space search` can exceed how much the Agent is willing to read into its context. Both surfaces follow the same rule:

- When a result exceeds the budget (default 64 KiB; change with `--max-bytes`), the CLI writes it to `.cuccut-out/<tool>-<time>.json` under `cwd` (or to `--result-file <file>`). Stdout gives only a summary, the path, and `truncated: true`. The MCP surface keeps the byte budget and cursor from architecture design §3.7.
- A truncated result must not be treated as a complete video. The summary states the covered range and the parameters for reading further.

### 5.6 Runtime ownership

- Every command that connects to the Runtime first looks for a running Runtime through the discovery file under `CUCCUT_HOME`. If none is found, it **starts one automatically by default** (in the background, detached from the terminal), and the result includes `runtime: { started: true }`. `--no-start` turns off auto-start (for CI, or when you only want to check status).
- `cuccut runtime ensure` does the same thing explicitly and prints `started` / `reused`. `runtime status` prints the process, port, version, and whether a desktop client is connected. `runtime stop` stops only the one the CLI itself started, and refuses with an explanation while a desktop client is connected.
- A CLI-started Runtime that is idle (no connections in use, no jobs) exits automatically after `runtime.idleExitMinutes` (default 10), so an Agent that forgets to stop it does not leave a background process behind. `cuccut runtime status` only reports state and does not count as activity: the query does not postpone exit, and the reported `idleSince` is the value from before the query.
- Version gate: when the CLI and Runtime interface versions differ, the CLI refuses with exit code 3 and says which side needs updating. It does not silently interpret arguments under the old version.

### 5.7 Help format

All of `cuccut --help` must fit on one screen (about 40 lines), in this form:

```text
cuccut — Transcribe, translate, edit, dub and export video with CucCut. Start with `cuccut status` to see what this machine can do.

Workflows (return a job; wait for completion by default)
  transcribe   Transcribe: file, link or video → transcript + caption track      translate   Translate a transcript or caption file with the configured text model
  dub          Translated dubbing                                                download    Download from a link; import into or create a video
  export       Export captions / transcript / audio / final cut / portable package / project   transcode   Compress, merge, extract audio tracks (file to file)
  speak        Synthesize speech                                                 image       Generate an image
  music        Generate music (local model, slow)
Objects
  videos       list · inspect · create · frames · history · delete · import-package
  documents    read · put            edits     apply · undo · ops        captions  create
  assets       import                jobs      list · inspect · wait · cancel · retry
  models       capabilities · list · install · test              space   list · search
  projects     list · create         artifacts save               skills  list · read      library  list · show
Local administration (for humans; the Agent must get consent first)
  models configure|accounts|default|…   services   share   nodes   settings   grants   approvals   fonts   external-tools
  skills add|import|enable|disable|remove   library import|export|remove|voice-clone   templates   chat   text   web
More
  help <command>    Parameters, effects and examples        spec [<name>]    Machine-readable catalog        status / runtime / version
```

---

## 6. MCP conventions

### 6.1 Unchanged parts

Streamable HTTP, loopback listening, per-client token issuance, `Host` and `Origin` checks, the access policy (scope + level), service approval with a 50-second timeout, and `initialize` reporting the interface version: all carried over from architecture design §4.8 and §12.8.

### 6.2 Changes

- **The open tool list is now derived from each catalog entry's `surfaces` and `annotations`**, and is no longer maintained by hand as `MCP_SERVICE_TOOLS`. The `read` level exposes only tools with `readOnlyHint`.
- **Added to the public catalog**: `videos_create`, `captions_create`, `download` (currently `link_import_start`), `transcribe` (the workflow), `jobs_cancel`, `jobs_wait`, `videos_frames`, `documents_put`, `assets_import`, `projects_list`, `skills_list` / `skills_read`, `jobs_list` / `jobs_retry`, `models_list`, `library_list` / `library_show`, `videos_history`, `edits_ops`. `projects_create`, `videos_import_package`, `models_install` / `models_test`, `transcode`, `artifacts_save` and `videos_delete` are not exposed. Without these, external Agents cannot complete the most common chains. `artifacts_save` and exported files are still written only to the `exports/` folder of the project that owns the video (`ServiceScope.exportBase`).
- **`jobs_wait { jobId, timeoutSec ≤ 50 }`**: blocks until a terminal state or a timeout, and returns the same record as `jobs_inspect`. The cap stays under the 60-second request timeout common in MCP clients. If it has not finished, call it again.
- **Tool count**: 37 in the public catalog (`ask` and `auto` levels). This includes the code-scene tools `compositions_import` / `compositions_preview` added later, `assets_prune` (for cleaning up old versions that have been replaced), and `chapters_adopt` (for the chapter that adopts source material). `compositions_import` with `replace: { itemId }` swaps an existing code-scene instance on the timeline in place for the new version (see [code bundle spec §3.3](../../spec/code-bundle-spec.md#33-replacing-a-version)). Of these, 17 read-only tools are exposed at the `read` level. The list is the protocol constant `MCP_SERVICE_TOOL_NAMES`; a test checks that it matches what the catalog derives. The admin surface is not included at all.
- **Interface version raised to `2`**: the tool renames (the workflow form of `models_transcribe` is now called `transcribe`, `link_import_start` → `download`, `exports_create` → `export`) and the parameter unification are breaking changes. The tool bridge is not exposed externally and is not bound by the version constraint, but its names change too.
- **`cuccut mcp install --agent <claude-code|codex|cursor|gemini> [--level ask|auto] [--name <client name>] [--yes]`** (also `cuccut mcp status`): creates a new client and writes the address and token into that Agent host's MCP config, then prompts a restart of the host. When the host has its own environment-variable section, the token goes there and the config holds only a reference (Claude Code's `env` in `settings.json`). Otherwise it is written in plaintext (Codex, Cursor, Gemini CLI), and `--help` and the result state the risk and recommend the `ask` level. When no project is registered in CucCut yet (fresh install, App never opened), it also registers a `CLI` project in the default project directory (the same one the terminal uses when there is no project). The result's `defaultProject` states that the external service must be given a registered project to create new videos and cannot create projects itself, so without it external Agents have nowhere to create videos. Details are in architecture design §4.8 and §12.8. This corresponds to the v2 skill's `bin/connect`. `mcp` is an admin-bucket command of the CLI and is not in the catalog.

### 6.3 Only these differences remain between CLI and MCP

| | CLI | MCP service |
| --- | --- | --- |
| Subject | Local user | External client + access policy |
| Confirmation | Host handles it; `destructive` requires `--yes` | Service approval under `ask` |
| Paths | Relative to `cwd`, the user's full set of files | Relative to the video's project, within `exports/` |
| Long jobs | `--wait` by default | `jobId` + `jobs_wait` |
| Large results | Spilled to `.cuccut-out/` | Budget + cursor |
| Admin surface | Yes (admin bucket) | None |

---

## 7. Where existing CLI commands go

There are about 30 top-level commands today, and each is assigned to a bucket. **Agent surface** commands go into the catalog and are mirrored to MCP. **Admin bucket** commands stay only in the CLI, are hand-implemented but reorganized by noun group, and are not in the first half of `--help`. **Removed** commands are deleted.

| Now | Destination | Notes |
| --- | --- | --- |
| `transcribe <videoId> <assetId>` (direct submit) | Merged into `transcribe --video V --asset A` | One entry point, the two forms merged |
| `transcribe --video|--entry|--file` (workflow) | Agent surface `transcribe` | |
| `translate`, `dub`, `export`, `transcode`, `speak`, `image`, `music` | Agent surface, same names | |
| `import-link` | Agent surface `download` | The glossary has no term "import-link" |
| `import-package` | Agent surface `videos import-package` | |
| `pipelines`, `pipelines retry` | `pipelines` removed; `retry` → `jobs retry` | "Fixed pipeline" is an implementation concept; the Agent recognizes only jobs |
| `jobs`, `jobs resources`, `jobs reconcile` | `jobs list/inspect/wait/cancel/retry` enter the Agent surface; `resources` and `reconcile` go to the admin bucket | |
| `models`, `models bundles`, `install`, `cancel`, `repair`, `test` | `capabilities`, `list`, `install`, `test` enter the Agent surface; `cancel` and `repair` go to the admin bucket | |
| `models configure|accounts|usage|default|remove|refresh|parameters|dir` | Admin bucket | Credentials and defaults are changed only by the user |
| `space list|search` | Agent surface | |
| `space rescan|rebuild|trash|restore|purge|delete-video|continue` | Admin bucket | |
| `library glossaries|voices|brand|show` | Agent surface `library list|show` | |
| `library import|export|remove|voice-clone*|video-selection` | Admin bucket | |
| `skills list|show` | Agent surface `skills list|read` | External Agents fetch craft guidance from here (§8.3) |
| `skills add|import|enable|disable|remove` | Admin bucket | |
| `toolbox` | Removed | The toolbox catalog page is a UI matter; self-description is handled by `spec` and `status` |
| `tools …` (yt-dlp, ffmpeg) | Admin bucket, renamed `external-tools` | Corresponds to the protocol's `externalTools.*`; `status` reports their availability |
| `fonts` | Admin bucket | When a font is missing at export, the job reports an error with a remedy; the Agent does not download fonts on its own |
| `text` | Admin bucket (for humans) | The Agent is itself a text model |
| `chat`, `approvals`, `grants`, `tasks` | Admin bucket | These belong to CucCut's own agents |
| `templates` | Admin bucket | Templates are briefs for CucCut's own agents; external Agents use the skill |
| `settings`, `services`, `share`, `nodes`, `web` | Admin bucket | `web open [--video <videoId>]` is the exception: it is the door through which external Agents enter the web editor. It only starts a local service and gives a one-time link, does not change videos or settings, and the instructions allow the Agent to use it without asking first (§8.8, `catalog/web.md`). Changing the port with `services configure web` and similar commands still requires asking first |
| `status` | Meta-command, expanded to the form in §4.5 | |
| Legacy forms `--bundle`, `--node`, `--autonomy` | Removed | No backward compatibility |

The admin bucket is implemented by keeping the existing `*-output.ts` files and hand-written parsing, but reorganizing them into one file per noun, sharing the §5.1 envelope and the §5.2 exit codes. The second half of `--help` lists only names; details are under `help <command>`. The admin bucket is not derived from the catalog and does not need to be, because it is not the Agent surface.

---

## 8. CucCut skill

### 8.1 Positioning

The skill is the instruction manual for external agents: when to use CucCut, how to start it, which command to use for each kind of task, prompts and best practices, hard rules, and how to deliver results. It does not copy parameters (parameters follow `spec`), and it does not describe CucCut's internals.

It is not the same thing as the built-in craft skills:

| | `skills/cuccut/built-in-skills/<id>/` (built-in craft skill) | CucCut skill |
| --- | --- | --- |
| Reader | CucCut's own in-session agent | Other agents (Claude Code, Codex, Cursor…) |
| Content | One method (polishing, translation, chaptering, cutting talking-head footage…), referencing tool-bridge tool names | How to operate CucCut with the CLI / MCP, plus craft |
| Loading | The Runtime reads the directory; the index is attached after the session guidance | The host's skills directory, written by `cuccut skill install` |

### 8.2 Where it lives

**The manual is the entry point; built-in craft sits beneath it** (since 2026-10-10; previously the manual was at the top level, `agent-skills/cuccut/`, and craft at top-level `skills/<id>/`): the repo-root `skills/cuccut/` is the manual, built-in craft lives in `skills/cuccut/built-in-skills/<id>/`, and the `README.md` there is the index. The Runtime loads only `built-in-skills/` as the built-in skill directory (`builtin-skills.test.ts` checks the list). The manual itself is not read as craft by the in-session agent. A skill that teaches the CLI is wrong for that agent, since it should use the tool bridge and not spawn a subprocess to run `cuccut`. The renderer also skips `built-in-skills/` when it reads the manual, so it does not appear in either side's render output.

It ships with CucCut. The desktop app packages the whole `skills/` directory into `<resources>/skills/`; the CLI does not carry a separate copy and gets the rendered result from the Runtime's `catalog.agentSkill`. `cuccut skill install --agent <host> [--dir <directory>]` copies it into the host's skills directory (Claude Code `~/.claude/skills/cuccut/`, Codex `~/.codex/skills/cuccut/`, Cursor `~/.cursor/skills/cuccut/`, Gemini CLI `~/.gemini/skills/cuccut/`). What gets copied is the rendered CLI-side result, not the source directory. With `--link`, the rendered result is written to `<Runtime Home>/agent-skills/cuccut/` and the host gets a link pointing to it, so installing again for any host later updates all of them together. `skill install` is a management-bucket command.

### 8.3 Content structure

```text
skills/cuccut/
  SKILL.md                      entry point (see 8.4)
  references/
    start.md                    finding the CLI, runtime ensure, version gate, status preflight, what to do without a Runtime
    conventions.md              JSON envelope, exit codes, --wait and jobs wait, error code → next step, large results, time and IDs, CLI↔MCP mapping
    catalog/
      media.md                  download, transcode, frame extraction, importing media, creating video, portable packages; the evidence ladder for one video (§8.7)
      subtitles.md              transcribe → polish → translate → subtitle layer → export; agent self-translation is the default path
      editing.md                the edits apply operation family, talking-head cutting, chapters, text and elements, undo and read receipts; generated blocks for common operations (§8.7)
      voice.md                  dubbing, speech synthesis, voices; "how it's said" and "what is said" are written separately (§8.7)
      export.md                 export types, picture and sound parameters, pre-delivery checks
      models.md                 capability queries, installing local model packs, handling CAPABILITY_NOT_CONFIGURED and GRANT_REQUIRED
      system.md                 runtime, spec, status, and management-bucket commands (these need user consent)
      web.md                    web editor: web open --video, links and sessions, the browser for viewing and dragging, new links at delivery (CLI side only, §8.8)
    workflows.md                end-to-end recipes: link → transcribe → bilingual subtitles → final cut; polish then translate; translate then dub; talking-head cutting; cutting short videos; summaries and scripting; each one follows the skeleton in §8.7
    craft/                      craft synced from built-in-skills/<id>/ (prompts, steps, best practices), used by the CLI side
    mcp.md                      how to connect over MCP, tool name mapping, how to use jobs_wait
  built-in-skills/              source of built-in craft, one skill per directory, README.md is the index; not a page of the manual, and not installed into hosts by skill install
```

**Craft is not forked.** `built-in-skills/<id>/SKILL.md` and their `references/` are the prompts, workflows and best practices the user wants, and their single source remains `built-in-skills/<id>/`. There are two ways to hand them to external agents:

1. **Synced copies**: the build script `tools/sync-agent-skill.ts` (`npm run build:agent-skill`, with `--check` to verify) copies each built-in skill to `references/craft/<id>.md` (merging its `references/`), and rewrites the tool-bridge tool names inside it into CLI commands under the §4.1 rules (`documents_read` → `cuccut documents read`, first-level verb `speak` → `cuccut speak`). Literals attached to `-`, `/`, `.`, or followed by `:` are filenames or fields and are not rewritten. When craft references a shared catalog page, `用 skills_read 读 cuccut-catalog-<页>` is rewritten to a relative link to that catalog page, and the reference table is not expanded into the appendix. The target page must exist. Tools that exist only in the session and have no terminal command (`downloads_save`) are replaced with a fallback phrasing that does not name the tool (in the terminal, tell the user the file path directly). Tests assert that the copies match the source.
2. **Live fetch**: `cuccut skills read <id>` returns the version currently in the Runtime at any time (including skills the user added themselves). SKILL.md explains the relationship: a copy is the version at the time the skill was published, and a live fetch is the version on this machine.

The "Built-in skills" table at the end of section 3 of SKILL.md (CLI side only) gives each built-in craft a name and one sentence, with `{{skill:<id>}}` linking to the copy. When a task is not covered by the routing in section 1, the agent uses this table to decide which one to read. In-session agents see the skill index at the start of the session and do not repeat this table. Craft meant only for the in-session agent (`slides`) is not listed.

### 8.4 Outline of SKILL.md

Following the v2 shape, the entry point does only six things, and the body stays under 300 lines:

1. **When to use and not use, plus three bottom lines.** Use it when media (files, links, subtitle files, `.ccut` projects) needs transcription, subtitles, translation, dubbing, editing, downloading, exporting, or summarizing and scripting. Do not use it for translating plain text, writing and images unrelated to video, usage of other editors or FFmpeg, or development of CucCut's source code. Include a table of "what the user says → default meaning → catalog page → matching craft." Right after it come the three bottom lines (§8.7): faithful, viewable, meets requirements. Every later page's acceptance is checked against them.
2. **Startup.** In order: locate the CLI (`cuccut` on PATH, or `CUCCUT_CLI`); `cuccut version` (version gate: on exit code 3, ask the user to update and do not work around it); `cuccut status` (what this machine can do, and how to fill in what is missing); then read one catalog page for the task. Do not start the Runtime by hand, since the CLI does that itself. When the task ends, decide whether to stop it according to the ownership rules for `runtime`.
3. **Capability catalog and reading discipline.** A nine-row table (`catalog/*.md`; the `web` row is CLI side only, §8.8) lists what each area of CucCut is, what it covers, and which page to read. Read only the page you need. Within one task, read each page only once and reuse it afterward. Before acting, read all the pages you already know you need in one go. For multi-stage craft, read only the current stage. For the fields of an operation, use `edits ops <op>` or `spec <name>`, and do not pull the whole list.
4. **Orchestration.** Do single steps directly. For multi-step tasks, the agent is the director: it writes the plan, issues all write commands and GPU-occupying commands itself (one at a time on the machine), and subagents return only files and conclusions.
5. **Hard rules.** Do text work yourself and do not configure a text model. Ground-truth files are written only through commands (do not touch `video.db` or video directories). Do not alter the user's original media. A `job` must reach a terminal state, a `mutation` requires reading its receipt, and a `destructive` action must ask the user before passing `--yes`. On `CAPABILITY_NOT_CONFIGURED` / `GRANT_REQUIRED`, tell the user to follow `next`; do not bypass it with shell, scripts, or other providers, and do not touch API keys. On a version conflict, run `inspect` again before editing. Management-bucket commands require consent first.
6. **Delivery.** Report four things: what was changed, the real paths of the outputs, what the user still needs to review, and what was not verified. Sort "not verified" into three columns: what was measured (duration, number of cuts, subtitle count, and so on, from read receipts); what was looked at (frames actually viewed with frame extraction; if not looked at, say so); and what a human must hear (whether the cut points sound right, dubbing tone, music volume). A tool failure counts as "not verified," not as a content problem. Visual judgments are made only from frames actually seen.

Parameters are always written as "see `cuccut help <command>` / `spec`" and never copied as flags. When the CLI changes, the skill does not need to change.

### 8.5 When to write it

The body of SKILL.md and of `references/` is written after phase 2 of §10 (the CLI switches to catalogs) lands; otherwise it would describe commands that do not exist. Phase 1 defines only the structure and outline of this section.

### 8.6 One manual, two readers

The user's additional requirement (2026-10-06): CucCut's own in-session agent should use this same set as well. Give it a task, and it should complete it using the same skill's wording and the same tool catalog. The CucCut agent and Codex / Claude Code read the same skills, backed by the same tools.

Mechanically, this is already half true: the tool bridge, MCP, and the CLI are one `ToolCatalog`, and the tool names the in-session agent calls are of the form `a_b`, differing from the CLI only by the mapping in §4.1. What differs is the manual layer. Originally, the in-session guidance was handwritten in `guidance.ts` plus a built-in skill index, while external agents used the manual in §8.3, so the two would inevitably drift apart. The decision is to unify them into **one source with two renderings**:

| | External agents (CLI side) | CucCut's in-session agent (tool-bridge side) |
| --- | --- | --- |
| Source | `skills/cuccut/` (SKILL.md + `references/`) | the same |
| Form | One skill, installed whole into the host's skills directory | The body of SKILL.md is rendered into the "working method" section of the system prompt (replacing the content handwritten in `guidance.ts`); `references/catalog/*.md`, `workflows.md` and `conventions.md` become built-in manual pages (`cuccut-catalog-<page>`, `cuccut-workflows`, `cuccut-conventions`; except for catalog pages whose tool-bridge side body is empty, §8.8). Craft stays as it is, as built-in skills. The index is attached after the guidance and read on demand with `skills_read` |
| Tool notation | `cuccut documents read` | `documents_read` |
| Sections that do not apply | — | Finding the CLI, `runtime ensure`, version gate, `--yes`, exit codes, writing to `.cuccut-out/`, how to connect MCP, the web editor (§8.8) |
| Craft | `references/craft/<id>.md` (synced from `built-in-skills/<id>/`, §8.3) | `built-in-skills/<id>/` itself |

The writing uses two markers, and there is not a separate manuscript for each side:

- **Side-specific selection**: a paragraph that belongs to only one side is wrapped in `<!-- surface: cli -->` … `<!-- /surface -->` (or `agent`). Unmarked content appears on both sides.
- **Tool name placeholders**: write tools in the body as `{{tool:documents_read}}`; at render time this outputs `cuccut documents read` or `documents_read`, depending on the side. Parameter names work the same way, using the field name, and on the CLI side they render as `--kebab-case`. The craft sync script (§8.3) and this section share the same rendering function.
- **Craft placeholders**: to reference a craft, write `{{skill:polish-transcript}}`. On the CLI side this renders as a link to `references/craft/polish-transcript.md`; on the tool-bridge side it renders as "`polish-transcript` (read with `skills_read`)". When it follows "读" directly, it renders as "用 `skills_read` 读 `polish-transcript`", so "读" is not said twice. The entry point and workflows use it to point to methods, without hard-coding either side's path.

Implementation: add a renderer under `packages/runtime-core/src/skills/`. The Runtime reads `skills/cuccut/` (shipped with the app at `<resources>/skills/cuccut/`; in development it reads the repository, with the same resolution order as the built-in skill directory). It renders the guidance and built-in skills for the tool-bridge side. `guidance.ts` is reduced to a caller of the renderer and no longer contains handwritten content. Tool names are checked against the Runtime's real tool-bridge catalog. If the manual cannot be found or cannot be rendered, the Runtime fails to start. Manual pages are given only to the in-session agent (`skills_read` in the terminal and over MCP cannot reach them; there, the installed CLI side is read instead). They always appear in the session's skill index, ahead of craft. They are not listed in the skill list in settings and cannot be toggled off, since they are the mechanism the entry guidance references; turning them off would make the guidance point to pages that cannot be read. When a user or a built-in skill uses the same id, that one is not loaded, and `builtin-conflict` is logged. The `skills/` directory now contains only craft (methods). All general guidance on "how to use CucCut" goes into `agent-skills/cuccut/`. Tests: the CLI-side rendering must not contain tool names of the form `a_b` or tool-bridge terms other than the "live fetch" wording of `skills_read`; the tool-bridge rendering must not contain `cuccut ` commands, `--yes`, or exit codes; the two renderings must have the same number of hard-rule items; and a catalog page whose tool-bridge body is empty (the whole page inside a `cli` block) must not be registered as a manual page, and rendering fails if the guidance or another page links to it outside a `cli` block.

Things not done: do not let the in-session agent spawn a subprocess to run `cuccut` (it has the tool bridge); do not fork craft; do not write a separate set of hard rules for each side.

Order: when phase 3 of §10 writes `agent-skills/cuccut/`, write it with the markers already in place. After that, a separate task switches `guidance.ts` to the renderer (phase 3, item 4), and during the switch each section of the old guidance is compared line by line to confirm no rules were lost. Completed (2026-10-06): the rules that applied only to the session side in the old guidance (the editor context is not the user's words; the video open in the editor; how `jobs_wait` waits; approvals wait for the user's decision; do not read craft that is not in the index) were added to the `agent` block of SKILL.md. Fixed-procedure tasks are committed in one step with first-level verbs and written into the orchestration section shared by both sides. The remaining rules already have counterparts in the manual. The rendered guidance is about 108 lines and 6.5K characters (the old handwritten version was about 50 lines and 4K characters); the extra content is mainly the entry routing table and the "read with `skills_read`" phrasing.

### 8.7 How the manual is written

A few conventions run through every page of the manual (`skills/cuccut/`). §10 stage 3 writes to them, and review checks against them:

**Method and mechanism are separated.** The craft pages (`built-in-skills/<id>/`, synced to `references/craft/`) and `workflows.md` cover only judgment and steps: when to cut, which line to keep, how long to pause, when to speak before showing. They name which tool or operation to use (via `{{tool:…}}`), but do not copy flags or parameter fields and do not explain mechanism. `conventions.md` and `catalog/*.md` cover only mechanism: commands, how to read receipts, what to do after an error code, limits. They do not make creative judgments on the Agent's behalf. The two sides point to each other with `{{tool:…}}` / `{{skill:…}}` and do not duplicate each other's content. If one page contains both "why we cut this way" and "how to pass this flag", the content is in the wrong place.

**Three bottom lines.** Stated at the top of the entry point, and used as the acceptance checklist:

| Bottom line | Meaning | Typical violation |
| --- | --- | --- |
| Faithful | Do not change the speaker's meaning or position; translation stays faithful; do not touch the user's original media, select the range on the timeline, and do not pre-cut files; text work is done by us, and timestamps are not fabricated | Stitching half a sentence to make an opening; estimating word-level timing from clause-level timing |
| Watchable | Cut points fall between words and breaths are kept; subtitles are readable and avoid faces and platform controls; background music sits below the voice; visual changes follow changes in information | Cutting every pause down to 0; subtitles covering the lower third |
| Meets requirements | Frame ratio, duration, output language and deliverables follow what the user confirmed; duration is a target, not a quota, and is not met by padding, looping or speed changes, nor by deleting necessary information to shorten | Repeating footage to reach 60 seconds |

**Page skeletons.** Each of the two page types has a fixed skeleton, so a reader knows where to look on any page:

- Each `catalog/*.md` page: when to use → preflight checks (is the capability present, how long is the material, does it need `inspect` first) → commands and examples → how to read the result (which receipt fields decide the next step) → common error codes → next step → acceptance.
- Each recipe in `workflows.md` and each craft page: what it applies to, and when not to take this route (if the user asks for one small thing, just do that thing) → judgment table (signal → handling → reason) → full steps (numbered, each pointing to a `{{tool:…}}` or `{{skill:…}}`) → completion criteria.

**Generated blocks.** In `catalog/editing.md`, the seven or eight most-used `edits apply` operations (add material, crop, move, delete, add captions, add text, adjust volume, split) each get one sentence of description and one example. They sit between `<!-- generated: common-ops -->` and `<!-- /generated -->`, and the craft sync script (§8.3) generates them from the `edits_ops` schema and the `examples` in the catalog entries. A consistency test checks that they are not stale. For the other operations, the Agent uses `edits ops <op>` to look them up. The rule that hand-written text does not copy parameters (§8.4) still applies: a generated block is not a hand copy. The same generated block may also appear in `conventions.md` (the JSON envelope and error code table) and `mcp.md` (the tool name mapping table).

**Evidence ladder for watching a video.** `catalog/media.md` and `workflows.md` use the same order: first import the original in full and reuse any existing transcript; transcribe in batch whatever is missing; locate segments by their text in the transcript; then pull frames in batches by time and assemble them into a timestamped contact sheet to check composition and shot distribution; sample densely in doubtful intervals and inspect single frames closely; only run shot-change detection if the cut point is still unknown; a video understanding model (if configured) comes last, asked specific questions, with timestamps requested and verified against the original. Stop once the evidence is sufficient, and send independent reads together in one batch. For edits, do one representative piece first, read it back to verify, then apply in batch; after a major change, verify again; reuse results for anything that was not touched.

**Prompts for voice and generation.** For `speak`, `instructions` and `text` are two different things: `instructions` says only how to deliver (tone, pace, scene, role), `text` says only what to say, and the two must point the same way (a tense instruction goes with tense lines). Do not over-specify instructions; the model fills in naturally. Do not use real brands or real people as style references. Use the same voice and the same baseline for one character throughout the film. The language of `instructions` follows the model documentation or existing trial-listening evidence: use English when the model requires it or English works better, otherwise use the user's language. The language of the instructions does not change the target language of the lines. Performance may ask for slow or rapid delivery; capability and effect are judged by the model, and no exact duration is promised, nor is speed-up used to squeeze into a budget. The voice reference table is split into `catalog/voice-<model family>.md` by model family, stating the conditions it applies to, and is referenced from the voice catalog page. The language and speaking-rate table is maintained only in `catalog/voice-language-rates.md`; craft and catalog pages reference it and no longer embed a copy of the data. For `image`, the prompt is written in a fixed order: subject → appearance or material → scene → light → camera position and composition → style and quality → one fidelity clamp (what not to change). For `music`, the style description is written as one English phrase per line (genre → tempo and groove → key and brightness → mood → core instruments → density → space and audio quality → optional direction). Duration and whether there are vocals are handled by parameters; do not write timestamped segment scripts or negative sentences. Where the music comes from, generating it after the final duration is set, looping it to fill long videos or splitting it by emotional arc, and ducking the music track under vocals are all covered in `catalog/music.md`. General prompt rules live in the "How to fill this field" section of `catalog/voice.md`, `catalog/media.md` and `catalog/music.md`, and do not get a separate craft page. Only when the content is too long to fit on one screen does it become its own `skills/cuccut/built-in-skills/<id>/`.

**How templates relate to the manual.** The brief guidance of scene templates (template package spec §5.2) already says "first ask clearly about topic, goal, audience and materials, then start". The manual does not rewrite it. The entry point only points to it on the line "the user wants to make a certain kind of finished video but has not said clearly": when a template catalog is available, choose a scene template and follow its brief; when there is none, ask the same four items. The template body is user-facing text and contains no tool names from either side, so the two sides do not need rendering.

**One author language.** The manual and craft pages are both written in Chinese and distributed directly, with no second-language sync copy maintained. This approach applies to videos in any language and to target languages (AGENTS.md). If rendering in another language is needed later, the renderer in §8.6 will produce it with `--lang`, and there remains one source.

### 8.8 Viewing and editing: the web editor for external Agents

Supplementary requirement from the user (2026-10-06): external Agents also need to be able to use the editor when they need to look at the picture, look at the finished video, make what-you-see-is-what-you-get adjustments, or ask the user to review the cut.

**The two kinds of readers differ only here.** In-session agents share the desktop editor with the user, and the editor is already in front of the user, so for looking at the picture they use `videos_frames` and do not open a web page. External Agents have only the skill and the CLI and no editor. They run `cuccut web open` to start the local web service (architecture design §4.8), and open the web editor in the host's browser tool. So the manual's `catalog/web.md` page is wrapped entirely in `<!-- surface: cli -->`. The renderer skips catalog pages whose tool-bridge body is empty, and does not register them as manual pages (§8.6). The line for this capability in the capability catalog is also inside the `cli` block.

**Command.** `cuccut web open --video <videoId>` starts the web service (if it is not running) and prints one access link that goes straight to that video's editor. Without `--video`, it lands on the home page. Resolving videoId to a file target happens on the Runtime side (`services.web.createAccessLink { video? }`, command protocol spec §4.1). The path and query in the link are constructed by `webVideoHref` in `@cuccut/protocol`, and the interface routing (`paneQuery` / `parseHref`) uses the same function, so neither the CLI nor the Runtime builds URLs by hand. There is no `web status`: `cuccut services status` already gives the web service's `endpoint`.

**Link lifecycle.** The one-time code sits in the URL fragment, is valid for two minutes, and can be used only once. The login page exchanges it for a browser session (12 hours, cookie bound to the port), then returns to the original path and query, and the interface uses that to open the video. While the session is still alive, an address without a code can be opened again. After a service restart, old sessions become invalid. Within one task, run `web open` once and reuse the same tab; send a new link only when you see the login page, a 401, or a refused connection.

**CLI first; the browser is for viewing and dragging.** Text and determinate timeline changes (changing words, translating, cut points, moving to a given second, chapters) go through commands. The web page is for playback, viewing the composited picture and subtitle positions (frames are not the composited picture), what-you-see-is-what-you-get dragging, and asking the user to review. Changes made on the web page and commands write to the same source of truth and the same change history, so after editing on the web page, run `videos inspect` again before the next write command. Do not operate CucCut's own in-app agent conversation or settings on the web page. If the host has a built-in browser, open the link there; otherwise, hand the link to the user. The manual makes no claim about any particular host.

**Handing the link to the user.** A link the Agent itself has opened is already invalid. At delivery time, run `web open` once more and give the new link to the user, explaining that it can be used only once and is valid for two minutes. When the user cannot click right away, ask the user to run `cuccut web open --video <videoId> --launch` themselves: it opens the login page in the system browser (keeping the path and query), and the code is pasted in from the terminal.

**Failure handling.** Login page or 401 → run `web open` again. Connection refused → run `web open` again (it starts the service; if the port in `services status` has changed, use the new one). Port already in use → the service reports an error and does not switch ports; the Agent does not change the port itself or end the process occupying it, and tells the user. Web client not built → tell the user, and fall back to pulling frames and exporting a short clip of the finished video. `VIDEO_NOT_FOUND` → `videos list`.

**Relationship to the hard rules.** `web` is in the management bucket (§7), but `web open` only starts a service on the local loopback address and gives a one-time link; it does not change videos or settings. The manual lists it as an exception to "management commands require consent first", written in hard rule 11, `catalog/system.md` and `catalog/web.md`. Other Web service commands, including changing the port, still require asking first. No new hard rule is added. The MCP has no entry point for the Web service, and `mcp.md` points back to the CLI.

---

## 9. Spec entries to revise

When implementing, follow the AGENTS.md rule: in the same task, sync the spec, implementation and tests. This plan touches:

| Document | Entry | What to change |
| --- | --- | --- |
| Architecture design §3.5 | Tool catalog | Add `LocalPrincipal`; add `effect`, `examples`, `surfaces` to catalog entries; rewrite sentences such as `captions_create`, `downloads_save`, `skill_read` that say "only for in-session agents" according to `surfaces`; update the tool name table |
| Architecture design §3.6 | Capability snapshot | Add the CLI derivation and offline snapshot to "derived from the same registry source" |
| Architecture design §4.1 | Public SDK | Add the `catalog` namespace (`list`, `call`) |
| Architecture design §4.8 | External service | The MCP exposure list changes to be derived according to `surfaces`, and lists the newly exposed tools; add `jobs_wait`; interface version `2`; `mcp install` |
| Architecture design §12.8 | External service security | Path constraints for newly exposed write tools (still inside the project `exports/`); token handling for `mcp install` writing the config file |
| Architecture design §2.2 | Startup and ownership | Ownership and idle exit of the Runtime launched by the CLI |
| Command and protocol spec §4.1 | Methods | `catalog.list` / `catalog.call`; `jobs.wait` |
| Command and protocol spec §11 | Error contract | Exit code table; `next` rendered per principal |
| Product design §2.7, §6.9 | Tools, skills | Change "external service cannot see skills" to read-only visibility; CLI surface description |
| Repository conventions §1 | Top-level directories | Add `agent-skills/` |
| `skills/README.md` | | Explain the relationship with `agent-skills/` and the sync script |
| Root README | Command table | Change to point to `cuccut --help` and this design, and stop listing flags one by one |
| Glossary | | Four terms: "tool catalog", "Agent surface", "management bucket", "CucCut skill" |

---

## 10. Implementation Order and Acceptance

### Phase 1: Catalog and Core (Runtime side) — done (2026-10-06)

1. Add `effect`, `examples`, `surfaces` and `positional` to `ToolDefinition`; backfill each existing tool, and tests assert the full shape.
2. New tools: `jobs_wait`, `videos_frames`, `documents_put`, `assets_import`, `jobs_retry`, `projects_list` / `projects_create`, `skills_list`, `library_list` / `library_show`, and the catalog shapes of `models_list` / `models_install` / `models_test`. `transcribe` / `translate` / `dub` / `download` / `export` / `transcode` / `speak` / `image` are registered as first-level verbs (internally they still call the fixed flows and model tools).
3. `LocalPrincipal` + `LocalScope`; gateway `catalog.list` / `catalog.call`.
4. The MCP service exposes the catalog by `surfaces`; interface version `2`; tools renamed.
5. Spec sync (the architecture design and command protocol entries in §9).

### Phase 2: CLI switches to the catalog — done (2026-10-06)

Revisions from review were landed together: `jobs wait` uses subscription-based waiting; `models install` without `--yes` only reports the size; the flag for writing results to disk is changed to `--result-file`; on idle exit, the discovery file is withdrawn first; `runtime.stop` is refused while someone is using it. The inline copy i18n for the admin bucket `admin/` and the download-directory environment variable used when the CLI launches the Runtime are left for later.

1. Add a catalog snapshot generator under `tools/`; CLI derived layer: command tree, flag parsing, `--help`, `help`, `spec`, envelope, exit codes, `--wait`, writing to disk, and auto-launching the Runtime.
2. Organize the admin bucket according to §7; remove `USAGE` and the old syntax.
3. Root README, and CLI tests (the derived layer is tested against the snapshot; the admin bucket stays as is).

### Phase 3: skill and install — done (2026-10-06)

Items 1–3 were landed together: first-level verbs in the craft copy (`speak`, `export`) are also rewritten to CLI commands per §4.1; a literal followed by `-`, `/`, `.` or `:` is not treated as a tool name. `mcp install --yes` automatically revokes the old client token (when an existing entry is replaced but the client it used cannot be identified, nothing is revoked; the result carries `previousClientUnknown: true` and explains how to check and revoke it). `AGENT_SKILL_NOT_FOUND` / `AGENT_SKILL_INVALID` exit with code 1.

1. Write `agent-skills/cuccut/` following the markup conventions in §8.3 and §8.6; the craft sync script and a consistency test.
2. `cuccut skill install`, `cuccut mcp install`.
3. Spec sync (the remaining entries in §9).
4. The in-session agent guidance switches to the §8.6 renderer; `guidance.ts` no longer hand-writes content; `skills/` keeps only craft. Done (2026-10-06).
5. The web editor for external agents (§8.8): `services.web.createAccessLink` gains `video`; `cuccut web open --video`; the link returns through login to the original path and query; `catalog/web.md` and the renderer skip pages whose tool bridge surface is empty. Done (2026-10-06).

### Acceptance

End-to-end run: on a machine that has CucCut installed, has no App open, and has only the skill installed, use Claude Code (an agent not connected to CucCut) to complete "link → transcribe → agent self-translation → bilingual subtitle layer → export mp4 and srt". During the run:

- The agent does not read any help text beyond `cuccut --help`; it uses `help <command>` or `spec` only as needed;
- The Runtime is not started by hand, and at the end it exits or stays according to the ownership rules;
- Each write command's receipt is read back and appears in the delivery report;
- The same flow works over MCP (`mcp install` into Claude Code), and tool names and arguments do not need rewriting.
- When an external agent needs the user to review a cut, the link produced by `cuccut web open --video <videoId>` opens that video's editor directly after login in the browser (§8.8); this page does not appear in the in-session agent's manual.

---

## 11. Settled Decisions and Open Questions

Settled:

- The shared layer is the existing `ToolCatalog`. The CLI consumes it through gateway methods; no MCP client and no extra layer is added.
- First-level verb + noun group + meta commands; nouns use the plural of the protocol namespace; MCP `a_b` ↔ CLI `a b`.
- The CLI does not go through CucCut approval; `destructive` requires `--yes`; responsibility for confirmation lies with the agent host.
- The first version of sugar covers only `documents_put` and `assets_import`.
- Agent self-translation is the default path; `translate` is an explicit choice.
- External skills live in `skills/cuccut/` (before 2026-10-10 they were at the top-level `agent-skills/`); craft syncs from `built-in-skills/<id>/` beneath it as the single source, with no fork.
- No compatibility with v2 or the current v3 CLI is considered; the interface version is raised to `2`.
- The manual has one source and two renderings (§8.6): CucCut's own agent and external agents read the same `skills/cuccut/`; craft still takes `built-in-skills/<id>/` as its source.
- How the manual is written (§8.7): separate method from mechanism, three bottom lines, a fixed page skeleton, common-operation blocks generated from the catalog, an evidence ladder for watching video, voiceover directions kept apart from script lines, and a three-column delivery report; the manual is authored in Chinese as its single author language.
- Decisions made during Phase 1 implementation: `models_install` / `models_test`, `projects_create`, `videos_import_package`, `transcode`, `artifacts_save` and `videos_delete` are not exposed to MCP; `videos_frames` and `videos_import_package` complete synchronously and count as `mutation`; `LocalScope` rejects outbound sends without a covering grant with `GRANT_REQUIRED`, and does not send on the grant's behalf; when there is no project, a new video lands in the `CLI` project under the default project directory; `jobs_retry` reuses the same `jobId` (`attempt` increments by one).
- Narrated video (decided 2026-10-06 after reviewing voiceover for a quick AI news take): the method goes into craft `narration`; in-session, the routing table in SKILL.md §1 points to it (both faces share the same table); for the external face, item 8 of `workflows.md` points to it. The mechanics (the engine splits the script into blocks of about 60 units and synthesizes each block; `speed` is accepted only by models whose `speedRange` is not null; `seed` is the knob for re-voicing) are written in `catalog/voice.md`. The template adds only one sentence to the example request of `ai-news-take`: "same voice, normal pace, cut words if too long, do not speed up to fit the duration". The other 15 templates that contain narration are not changed one by one; craft routing covers them.
- MCP on an empty project registry (found in the 2026-10-06 end-to-end acceptance; see the [acceptance record](../../acceptance/agent-surface-e2e.md)): for `videos_create` and `download`, a new video's external service must still be given a registered project; `projects_create` is still not exposed to MCP; `cuccut mcp install` fills the gap by registering the `CLI` project under the default project directory when no project exists. The other option that was not chosen is to let the external service fall back to the default project when `project` is omitted (same as `LocalScope`); that would require changing §6.3 and the "project is required" rule in the manual `mcp.md`.
- Downloading into an existing empty video (found in the same acceptance run): at the time, the external service did not accept `newVideo` (this has since been opened up), so a new video could only be created by calling `videos_create` first and then `download` with `video`. Importing an existing video only imported the material and did not place it on the timeline, so the following `transcribe` failed with `TRANSCRIBE_ASSET_NOT_FOUND`, and export produced an empty cut. The change: when the imported video's timeline is still empty (no clips on the root sequence), the import places the material on the main track in the same transaction, as `newVideo` does (architecture design §7.9); if clips already exist, it still only imports the material. `download --video` in the terminal and in-session behaves the same way.
- External service `download newVideo` (second round of the 2026-10-06 end-to-end acceptance): opened up, on the condition that a registered `project` is given at the same time (same as `videos_create`); a request without a destination is still refused. A video created by the flow is registered in the service's scope when the parent task records its `videoId` (when the access policy is a video allowlist, it is written into the allowlist, as with `videos_create`), so that `videos_list` and `videos_inspect` can see it afterwards. `transcribe` given a `url` follows the same rule. The basis is architecture design §12.9: "the destination is limited to an existing video within scope or a registered project": a new video is created inside a registered project and does not go outside the scope. The earlier two-step flow of "`videos_create` first, then download into it" still works.
- `transcribe` given a `url` (same round): `language`, `hint`, `provider` / `model`, `diarize`, `name` and `noCaptions` are all passed through to the `link-import` flow; after transcription lands in the video, the subtitle layer is created by default, the same as when `video` or `file` is given (§4.2). `download --transcribe` still uses the defaults and does not create a subtitle layer.
- When the host has no environment-variable section, `mcp install` writes the token in plain text. `--help` and the result state this risk and recommend the `ask` level. In practice only Claude Code can place the token in the `env` of `settings.json` and reference it; Codex's `bearer_token_env_var` must be exported in the shell that starts it; Gemini CLI filters out environment variables whose names look like tokens; Cursor's configuration has no environment-variable section that a request header can reference. For these three (Codex, Cursor, Gemini CLI) the token is written in plain text; their integrations have not been verified as actually connected.
- First-level verbs are also exposed in the tool bridge (2026-10-06): the tool bridge catalog contains first-level verbs such as `transcribe`, `download`, `dub`, `transcode` and `export`. The originally proposed `models_transcribe` and `link_import_start` appear in neither surface's catalog. The manual states, in the section common to both surfaces on orchestration, that when a task has a fixed flow it is submitted as one whole flow in a single step with a first-level verb, and is not split by the agent into several steps.
- Videos in a session with no project (2026-10-08): a video created in a session no longer first creates and binds a project; the video is created in the session's own working directory (architecture design §3.10). The only addition is `projects_adopt_session { name? }` in the tool bridge. It is used only when the user explicitly asks to create a project: the session and its videos are then moved into a new project named after the video, confirmed with `edit`. Manual §4 states: when the session does not belong to a project, a new video is not given `project`; if a placeholder such as "[target language]" in the user's message has not been filled in, ask first before acting.
- `documents read` takes only `video`, `documentId` and an optional `revision` (2026-10-06): transcripts additionally take `translationBasis`, and there is no `for` / `format`; for plain text use `export --kind transcript --format txt`. §4.3 / §4.4 were corrected to match the implementation; the implementation was not changed.
- External agents view and edit through the web editor (2026-10-06, §8.8): the in-session agent does not open the web; `catalog/web.md` is given only to the CLI face as a whole page, and the renderer skips catalog pages whose tool bridge body is empty. `web open --video` opens the video's editor directly; the URL is built by `webVideoHref` in `@cuccut/protocol`, and the videoId is resolved on the Runtime side. No `web status` is added. Open once per task and reuse the tab; resend only on a login page, a 401, or a refused connection. When delivering, give the user the new link; `--launch` is left to the user. CLI first; the web is for playback, viewing the composited picture, dragging and reviewing the cut. After a web edit, run `videos inspect` again. `web open` is the exception to "management commands ask first"; if the port is occupied, do not switch ports.
- The in-session agent's guidance is rendered from the manual (2026-10-06, §8.6): if rendering fails, the Runtime fails to start. The catalog page, `workflows.md` and `conventions.md` are built-in manual pages that are always in the index and are given only to the in-session agent (`skills_read` in the terminal and MCP cannot read them; those sides read the installed CLI face). They do not appear in the skill list in settings and cannot be toggled.
- `videos_frames` marks faces (2026-10-10): each frame that has a `file` carries `faces: [{x, y, w, h, score}]` (the top-left corner and width/height are normalized to 0–1 against that frame's width and height; score is 0–1; sorted by score from high to low). The top-level `detector` is `"yunet"`; when the detector is unavailable it is `null`, `faces` is an empty array, and no error is raised. A frame whose `file` is null has no `faces`. The model is YuNet (OpenCV Zoo, MIT) shipped with the app, at `packages/models/assets/face-detection/`; inference runs in the pure-Rust `face-detect` process (tract, the same implementation on Windows and macOS, without native runtime libraries); each call starts one process that loads the model once; it is not downloaded on demand. Coordinates refer to the material's picture, consistent with `composited: false`. The purpose is automatic framing for "cut into a short video" (defining a 9:16 crop box around the face).

Open (implementation-phase decisions; the defaults are in parentheses):

- Which Node and which Runtime entry the CLI uses when it auto-launches the Runtime: in a packaged build, it comes from the desktop app's resources; in development, it is `apps/runtime`. Search in this order: `CUCCUT_RUNTIME_ENTRY` → packaged resources → the repository, following the same resolution method as the data files shipped with the app.
- Writing large MCP results to disk: can the external service write the full text of `documents_read` into the project's `exports/`? (Yes, under the same constraint as export. The first version only does the budget and cursor.)
- The output location and size limit for `videos_frames` (`.cuccut-out/frames/` under `cwd`; at most 24 frames per call, long edge 1280).
- Whether templates are exposed to CLI / MCP: wrap the existing `templates.list` / `templates.get` as `templates_list` / `templates_show` (query), so external agents can also start from a scene template brief (exposed; placed in the noun group in §4.3; done in phase 3 together with the skill).
- Whether `template.json` needs an optional `skills: [id]` hint pointing to the craft this kind of video should read. (Not added for now. This would change the template package spec; decide once the manual is written and we see whether the entry table is enough.)
