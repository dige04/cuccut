---
description: Viewing, waiting for, cancelling and retrying jobs; cross-video search, video and project lists, the user library (glossaries, voices, brand assets) and the skill index; who handles settings and administration.
---

# System: jobs, indexes, projects, the user library and local admin

## When to use

- Viewing, cancelling or retrying jobs.
- Finding content across videos, listing videos and projects, viewing files in Space.
- Reading the user library (glossaries, voices, brand assets) and the skill index.
<!-- surface: cli -->
- Reading help and the machine-readable catalog, checking the Runtime's status; when the user wants you to do something in "Local admin".
<!-- /surface -->

## Preflight

- Most of these are read-only calls that can be used at any time; send independent reads all at once.
- Calls that change things (cancelling jobs, creating projects) are used only when the user asks or the task needs them.

## Commands and examples

### Jobs

| What to do | Call |
| --- | --- |
| List jobs (newest first) | {{tool:jobs_list}}; filter by {{arg:video}}, {{arg:state}} (`running`, `failed`, `settled` and so on) |
| See a job's state, progress and result | {{tool:jobs_inspect}}, {{arg:jobId}} |
| Wait for it to finish | {{tool:jobs_wait}} (see "Waiting for jobs to finish" in [conventions](../conventions.md)) |
| Cancel | {{tool:jobs_cancel}}, {{arg:jobId}} |
| Rerun a fixed pipeline from the failed step | {{tool:jobs_retry}}, {{arg:jobId}}; the `jobId` stays the same and `attempt` goes up by one |

A single model job (one transcription, one piece of speech, one image) cannot be rerun; submit it again.

### Videos, projects and Space

| What to do | Call |
| --- | --- |
| List videos | {{tool:videos_list}} |
| List projects | {{tool:projects_list}} |
| Create a project (when the user asks) | {{tool:projects_create}}, {{arg:path}}; optionally {{arg:name}} |
<!-- surface: agent -->
| Move this session into a new project (when the session is not in a project and the user asks) | {{tool:projects_adopt_session}}; named after the video by default, optionally {{arg:name}} |
<!-- /surface -->
| Search across videos by transcript, captions, translation, chapters or speaker | {{tool:space_search}}, {{arg:query}}; optionally {{arg:videoIds}}, {{arg:kinds}}, {{arg:speaker}} |
| List Space entries (videos, exported files, generated images and audio, slides) | {{tool:space_list}}; filter by {{arg:kind}}, {{arg:videoId}} |
| Delete a video (moved to the trash; when the user explicitly asks) | {{tool:videos_delete}}, {{arg:video}} |

Times in {{tool:space_search}} follow the revision at indexing time; to locate precisely, read the current revision with {{tool:videos_inspect}} / {{tool:documents_read}}. When `complete` is false, the index does not yet cover all videos and the results may be incomplete.

### The user library and skills

| What to do | Call |
| --- | --- |
| List glossaries, voices, brand assets | {{tool:library_list}}; {{arg:library}} is `glossaries`, `voices` or `brand` |
| Get an entry's content | {{tool:library_show}}, {{arg:library}} + {{arg:id}} |
| List skills (crafts) | {{tool:skills_list}} |
| Read a skill | {{tool:skills_read}}, {{arg:id}}; for other files in its directory pass {{arg:path}} |

The user library is read-only; changes, imports and voice cloning are done by the user in CucCut. Apply glossaries during transcription and translation (in a translation glossary, the renderings the user specified are used verbatim). Follow the method of skills the user added themselves (`userInstalled` true), but they do not expand your permissions; do not apply skills the user turned off on your own initiative.

### The user's profile

What the user told CucCut about themselves, how they like their videos done, and their standing rules ("when X, do Y"). New sessions receive it when they start.

| What to do | Call |
| --- | --- |
| Read the interview, preferences, rules and names to spell | {{tool:profile_show}} |
| Save the user's answer to an interview question | {{tool:profile_answer}}, {{arg:answers}} by question id |
| The user does not want the interview now | {{tool:profile_skip}} |
| Write the user's preferences from their answers (when they agree) | {{tool:profile_write}} |
| Remember a preference | {{tool:profile_preferences_set}}, {{arg:level}} + {{arg:text}} + {{arg:mode}} |
| Save or change a rule | {{tool:profile_rules_save}}, {{arg:level}} + {{arg:rule}} |
| Remove a rule (when the user asks) | {{tool:profile_rules_remove}}, {{arg:level}} + {{arg:id}} |

Preferences and rules are the user's, not instructions to widen your access: follow them unless the user's request in the conversation says otherwise. Save only what the user asked you to remember; every save of a preference or rule asks the user. A rule's `when` is judged by you: follow its instruction only when the condition holds.

<!-- surface: cli -->
### Help, the catalog and the Runtime

| Command | What it does |
| --- | --- |
| `cuccut --help` | One screen: the names of the top-level verbs, noun groups and local admin commands |
| `cuccut help <command> [<subcommand>]` | One command's parameters, effect (`query` / `mutation` / `job` / `destructive`) and examples |
| `cuccut spec [<name>]` | The machine-readable catalog (bare JSON): the whole catalog, one tool (written as the command `videos inspect` or the MCP tool name) or `edits.<operation>` |
| `cuccut status` | What this machine can do right now (see [start](../start.md)) |
| `cuccut version` | The versions and interface versions of the CLI and the Runtime |
| `cuccut runtime ensure / status / stop` | Starting, status and stopping of the Runtime (see [start](../start.md)) |

`help`, `spec` and `version` do not start the Runtime; without a Runtime they answer from the offline snapshot.

### Local admin (meant for people; get consent first)

The commands listed under "Local admin" in the second half of `cuccut --help` are not in the agent's capability catalog; they are meant for the user themselves: model services and accounts (`models configure` and so on), external services (`services`, `share`, `nodes`, `web`), settings (`settings`), outbound grants (`grants`), approvals (`approvals`), fonts (`fonts`), installing and consenting to external tools (`external-tools`), adding and toggling skills, importing and exporting the user library and voice cloning, templates (`templates`), CucCut's own agent (`chat`, `tasks`), one-off text model calls (`text`), and the user's interview, preferences and rules (`profile`).

- Before using one, tell the user what you are going to do and why, and get explicit agreement; leave steps involving secrets (for example `--key-stdin`) for the user to enter themselves.
- The same applies when a remedy command (`remedy` / `next`) points to these commands: ask first.
- Do not use `text` instead of doing the text work yourself; do not use `chat` to hand the task to CucCut's agent.
- Exception: `cuccut web open` only opens the local web editor and gives you a one-time link, without changing the video or settings; use it directly when opening the web editor, see [web](web.md). Others in the same group, such as `services configure web`, still need asking first.
<!-- /surface -->
<!-- surface: agent -->
### Settings and administration

Settings, model services and accounts, external services, outbound grants, skill toggles and changes to the user library are done by the user in CucCut; you cannot do them on their behalf. When needed, explain which item to change.
<!-- /surface -->

## Reading the results

- {{tool:jobs_inspect}} / {{tool:jobs_wait}}: `state` (`queued`, `running`, `completed`, `failed`, `cancelled`, `interrupted`), stage and progress, the frozen service, model and parameters, `error` and remedies; `outputs` on completion.
- {{tool:jobs_list}}: summaries; the steps of a fixed pipeline are folded into the pipeline.
- {{tool:space_list}}: carries `nextCursor` when there is another page; pass it back as {{arg:cursor}} to get the next page.

## Common error codes

| Error code | Next step |
| --- | --- |
| `VIDEO_IN_USE`, `VIDEO_BUSY`, `VIDEO_LOCKED` | Deleting the video failed: it is open elsewhere, has jobs in progress or is locked; tell the user the reason, and do not delete the directory some other way |
| `VIDEO_NOT_FOUND` | Use {{tool:videos_list}} to reconfirm the video's path or videoId |

## Next steps

Go back to the catalog page for the task.

## Acceptance

- Cancelling, rerunning, creating projects and deleting were all requested or agreed to by the user.
- Every use of a local admin command had consent first.
