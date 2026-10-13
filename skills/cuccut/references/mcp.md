# Over MCP: connecting, tool names and differences

<!-- surface: agent -->
You do not need this page inside a session: the tools you use are CucCut's tool catalog.
<!-- /surface -->
<!-- surface: cli -->
CucCut's MCP service and the CLI share one tool catalog. Once MCP is connected in the host, you can call tools directly without spawning a subprocess; the recipes, crafts and hard rules stay the same. When the CLI is available, use either path, but do not mix them within one task.

## 1. Connecting

One command sets it up (it needs the user's agreement, because it changes the host's MCP configuration):

```text
cuccut mcp install --agent <claude-code|codex|cursor|gemini> [--level ask|auto] [--name <client name>] [--yes]
```

It turns on the MCP service (and sets it to start with CucCut's Runtime), creates a client for this host in CucCut, writes the address and token into the host's MCP configuration, and then prompts you to restart the host. Where the token goes: for Claude Code it goes into its environment variable section and the configuration only holds a reference; Codex, Cursor and Gemini CLI store it in plain text in the configuration file. Make this clear when you ask the user. If the host configuration already has a `cuccut` entry, it is not overwritten; add `--yes` to replace it (again, ask first). Check `cuccut help mcp` to see whether the version on this machine supports it; if not, use the manual setup below.

Manual setup (all local admin commands; ask the user before each one):

1. `cuccut services start mcp` turns on the MCP service; `cuccut services configure mcp --level ask` sets the access level (`read` is read-only; `ask`, the default, has the user confirm each write and job in CucCut; `auto` runs them directly), and `--videos` limits which videos are exposed.
2. `cuccut services mcp add-client <name>` creates a token for this host (shown only once; let the user save it).
3. `cuccut services mcp connection <clientId>` prints the address and a snippet that can be pasted into the host's MCP configuration (the token is a placeholder); ask the user to fill in the token and restart the host.

The service listens only on the local loopback address; there is one token per host, and each can be revoked separately.

## 2. Tool names are `a_b`

The MCP tool `<noun>_<verb>` is the CLI's `cuccut <noun> <verb>`, with the same parameter names (MCP uses the field name itself, `documentId`; the CLI uses `--document-id`). Top-level verbs have the same name on both sides. For commands written as `cuccut …` in this skill, switch to the tool name by this rule on MCP; `next` in errors is already written as a tool name.

Tool name mapping (generated from the catalog):

<!-- generated: tool-map -->
| MCP tool | CLI command | Effect |
| --- | --- | --- |
| `assets_import` | `cuccut assets import` | mutation |
| `assets_prune` | `cuccut assets prune` | mutation |
| `captions_create` | `cuccut captions create` | mutation |
| `chapters_adopt` | `cuccut chapters adopt` | mutation |
| `compositions_import` | `cuccut compositions import` | mutation |
| `compositions_preview` | `cuccut compositions preview` | mutation |
| `documents_put` | `cuccut documents put` | mutation |
| `documents_read` | `cuccut documents read` | query |
| `download` | `cuccut download` | job |
| `dub` | `cuccut dub` | job |
| `edits_apply` | `cuccut edits apply` | mutation |
| `edits_ops` | `cuccut edits ops` | query |
| `edits_undo` | `cuccut edits undo` | mutation |
| `export` | `cuccut export` | job |
| `image` | `cuccut image` | job |
| `jobs_cancel` | `cuccut jobs cancel` | mutation |
| `jobs_inspect` | `cuccut jobs inspect` | query |
| `jobs_list` | `cuccut jobs list` | query |
| `jobs_retry` | `cuccut jobs retry` | job |
| `jobs_wait` | `cuccut jobs wait` | query |
| `library_list` | `cuccut library list` | query |
| `library_show` | `cuccut library show` | query |
| `models_capabilities` | `cuccut models capabilities` | query |
| `models_list` | `cuccut models list` | query |
| `music` | `cuccut music` | job |
| `projects_list` | `cuccut projects list` | query |
| `publications_inspect` | `cuccut publications inspect` | query |
| `publications_list` | `cuccut publications list` | query |
| `publications_prepare` | `cuccut publications prepare` | mutation |
| `publications_propose_copy` | `cuccut publications propose-copy` | mutation |
| `publications_reschedule` | `cuccut publications reschedule` | mutation |
| `publications_reserve` | `cuccut publications reserve` | mutation |
| `publications_slots` | `cuccut publications slots` | query |
| `publications_update` | `cuccut publications update` | mutation |
| `skills_list` | `cuccut skills list` | query |
| `skills_read` | `cuccut skills read` | query |
| `space_list` | `cuccut space list` | query |
| `space_search` | `cuccut space search` | query |
| `speak` | `cuccut speak` | job |
| `transcribe` | `cuccut transcribe` | job |
| `translate` | `cuccut translate` | job |
| `videos_create` | `cuccut videos create` | mutation |
| `videos_derive` | `cuccut videos derive` | mutation |
| `videos_frames` | `cuccut videos frames` | mutation |
| `videos_history` | `cuccut videos history` | query |
| `videos_inspect` | `cuccut videos inspect` | query |
| `videos_list` | `cuccut videos list` | query |
| `videos_shots` | `cuccut videos shots` | query |

Only in the CLI, not on MCP: `cuccut artifacts save`, `cuccut models install`, `cuccut models test`, `cuccut projects create`, `cuccut publications approve`, `cuccut publications archive`, `cuccut publications export-calendar`, `cuccut publications import-calendar`, `cuccut publications pin`, `cuccut publications send`, `cuccut publications withdraw`, `cuccut transcode`, `cuccut videos delete`, `cuccut videos import-package`.
<!-- /generated -->

## 3. Waiting for jobs: loop on `jobs_wait`

Tools that return a job (`transcribe`, `export`, `download`, `dub` and so on) return a `jobId` immediately; they do not wait:

- Call `jobs_wait { jobId }`: it blocks until a final state or a timeout, with `timeoutSec` at most 50 seconds (to stay under the common 60-second client request timeout).
- `settled` being `false` is not an error: follow `next` and call `jobs_wait` again, until `state` is final.
- Do not poll repeatedly with `jobs_inspect`.

## 4. Tools not on MCP

These exist only in the CLI and in CucCut's own sessions; the MCP service does not expose them:

| Tool | Use instead |
| --- | --- |
| `transcode` | The CLI's `cuccut transcode` |
| `videos_import_package` | The CLI, or ask the user to open the portable package in CucCut |
| `videos_delete` | Ask the user to delete it in CucCut |
| `projects_create` | The CLI, or ask the user to create the project in CucCut |
| `artifacts_save` | To put an artifact into a video, pass the `artifactId` to `assets_import` directly; for a file, use `export` |
| `models_install`, `models_test` | The CLI, or ask the user to install it in CucCut's settings |

None of the admin commands (settings, services, credentials, grants) are on MCP.

The web editor is not on MCP either: to view the rendered picture, make drag-and-drop adjustments or ask the user to review in the editor, use the CLI's `cuccut web open --video <videoId>` (see [web](catalog/web.md)).

## 5. Differences from the CLI

| | CLI | MCP service |
| --- | --- | --- |
| Identity | The user themselves | An external client, bound by its access level and video scope |
| Confirmation | Handled by the host's permission prompts; `destructive` needs `--yes` | At the `ask` level the user confirms each one in CucCut; it times out after 50 seconds without confirmation |
| Paths | Relative to the current directory; all of the user's files | Relative to the project the video belongs to; exports and artifacts are written only into the project's `exports/` |
| Creating videos | Without a project, found from the current directory | `videos_create` and `download`'s `newVideo` must both be given a `project` (from `projects_list`); the created video joins your scope automatically |
| Transcription input | A link, a local file or a video | A video, or a link plus `project`; local files (`file`, `outDir`) are not allowed |
| Where downloads land | The downloads directory when not given | A `video` (within scope) or `project` is required; giving only `url` is refused |
| Long jobs | Waits for completion by default | `jobId` + a `jobs_wait` loop |
| Large results | Written to `.cuccut-out/` | Byte budgets and cursors: fetch in parts as the result explains |
| Visible jobs | All | Those you submitted |

## 6. When refused

- An approval came back denied or timed out: the user did not agree; do not retry with different wording, ask the user first.
- Videos outside the access scope are invisible to you: ask the user to add them to the scope in CucCut; do not look for another way to read them.
- At the `read` level, writes and jobs are all refused: ask the user to raise the level, or switch to the CLI.
<!-- /surface -->
