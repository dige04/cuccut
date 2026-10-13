---
description: General mechanics - how to use error objects, revision conflicts, waiting for jobs to finish, large results, the two clocks for time, IDs and references. Read when you hit an error, need to wait for a job, or are unsure about times and IDs.
---

# Conventions: output, errors, long jobs and references

This page covers mechanics only. How to judge, cut and translate is in the crafts and in [workflows](workflows.md).

<!-- surface: cli -->
## 1. Commands and tools share names

Every tool in the catalog is a command in the CLI: the MCP tool `<noun>_<verb>` is `cuccut <noun> <verb>`, with `_` in multi-word verbs turned into `-` (`import_package` ↔ `import-package`); top-level verbs have the same name on both sides (`transcribe`, `export`). Parameters share names: the field `documentId` is the flag `--document-id`. The full mapping is in [mcp](mcp.md).

## 2. Output is a JSON envelope

When stdout is not a terminal, output is JSON by default (same as `--json`); do not parse the human-readable text.

- Success: `{ "ok": true, "result": …, "next"?: "…", "runtime"?: { "started": true } }`. `result` is the tool's result object; `next` is the suggested next command and appears only at the top level of the envelope.
- Failure: `{ "ok": false, "error": { "code", "message", "retryability"?, "recovery"?, "remedy"?, "next"? } }`. Problems the CLI finds itself (bad arguments, missing `--yes`, Runtime unavailable) have the same shape.
- `cuccut spec` and `cuccut version` print bare JSON, with no envelope.
- Progress goes to stderr and does not mix into the JSON on stdout; with `--progress jsonl`, each line is one event (`progress` / `artifact` / `warning` / `done`, with `jobId`).

## 3. Exit codes

| Code | Meaning | What you should do |
| --- | --- | --- |
| 0 | Success, including jobs waited on to completion | Read `result` and follow `next` |
| 1 | Failure or cancellation: the engine or a tool refused, a job ended as `failed` / `cancelled` / `interrupted`, or `--timeout` ran out (`WAIT_TIMEOUT`; the job is still running) | Look at `error.code` and handle it per section 5 |
| 2 | The user has to do something first: configure a capability, grant access, consent to or install an external tool, log in, authorize a voice | Pass `remedy` and `next` on to the user, then stop and wait for the user; do not work around it yourself |
| 3 | Runtime unavailable or version mismatch | See [start](start.md) |
| 4 | Bad arguments (`INVALID_ARGUMENTS`, `UNKNOWN_COMMAND`), or a command that needs confirmation is missing `--yes` (`CONFIRMATION_REQUIRED`) | For bad arguments, check `cuccut help <command>` and fix them; for a missing `--yes`, ask the user first |

Ctrl-C first cancels the job being waited on; a second Ctrl-C exits immediately (130).
<!-- /surface -->

## 4. How to use the error object

The `error` on failure is the same on both surfaces:

- `code`: a closed set of error codes; decide the next step from it, not by guessing from the `message` text.
- `message`: an explanation for people; you can quote it when passing it on to the user.
- `remedy`: what the user needs to do (for example, which service to enable, which model bundle to install, where to consent). An error with a `remedy` usually means stopping to pass it on to the user.
- `next`: the suggested next call, already written in your surface's form; just follow it.
- `retryability` / `recovery`: whether it can be retried as-is, and how to recover. Retry only when it says a retry is possible; when retrying, pass the same {{arg:commandId}} as the first time ({{tool:edits_apply}} and every top-level verb have this field) to avoid submitting twice.
- `details`: specifics, such as candidate documents, how many frames are missing, which item cannot be rendered; take them from here when the next step needs them.

Common error codes and next steps (generated from the catalog):

<!-- generated: error-codes -->
<!-- surface: cli -->
| Error code | Exit code | Next step |
| --- | --- | --- |
| `CAPABILITY_NOT_CONFIGURED` `DUB_SEPARATION_NOT_CONFIGURED` `MODELS_DIR_MISSING` `CREDENTIAL_UNAVAILABLE` `AUTHENTICATION_REQUIRED` `OFFLINE_STRICT` `GRANT_REQUIRED` `GRANT_REVOKED` `BUDGET_EXCEEDED` `BUDGET_UNVERIFIABLE` `TASK_BUDGET_EXCEEDED` `TASK_BUDGET_UNVERIFIABLE` `TOOL_UNAVAILABLE` `TOOL_CONSENT_REQUIRED` `TOOL_UPDATE_CONFIRM_REQUIRED` `TOOL_UPDATE_MANUAL` `MEDIA_TOOL_UNAVAILABLE` `EXPORT_TOOL_MISSING` `LINK_LOGIN_REQUIRED` `LINK_COOKIES_UNAVAILABLE` `LINK_TOOL_UPDATE_REQUIRED` `VOICE_CONSENT_REQUIRED` `VOICE_CLONE_REQUIRED` | 2 | The user has to do something first: configure a capability, grant access or budget, agree to or install an external tool, sign in, authorize a voice. Pass `remedy` on to the user as is, and retry as `next` says once they are done; do not work around it with scripts, other providers or hand-edited configuration |
| `RUNTIME_UNAVAILABLE` `RUNTIME_START_FAILED` `PROTOCOL_MISMATCH` `INTERFACE_VERSION_MISMATCH` `CATALOG_UNAVAILABLE` | 3 | The Runtime is unavailable or a different version. Run `cuccut runtime ensure` first; when the interface version differs, ask the user to update CucCut or the CLI, and do not work around it |
| `INVALID_ARGUMENTS` `UNKNOWN_COMMAND` `UNKNOWN_TOOL` `CONFIRMATION_REQUIRED` | 4 | Wrong arguments: fix them against `cuccut help <command>` or `cuccut spec <name>`; when `--yes` is missing, ask the user first and add it only once they agree |
| `RUNTIME_NOT_OWNED` `RUNTIME_IN_USE` | 1 | The Runtime is not this CLI's to stop, or someone is still using it: do not stop it, leave it running |
| `AGENT_SKILL_NOT_FOUND` `AGENT_SKILL_INVALID` | 1 | The agent guide cannot be installed: the CucCut installation is incomplete or the guide is broken. Pass `message` on to the user as is and ask them to reinstall or update CucCut; do not assemble the guide yourself |
| Other error codes | 1 | Failed or cancelled. Look at `retryability`: `after-refresh` - read again before submitting (on a revision conflict, `PROJECT_REVISION_CONFLICT`, run {{tool:videos_inspect}} again); `after-user-action` - pass it on to the user; `never` - change approach. On a wait timeout (`WAIT_TIMEOUT`) the job is still running: keep waiting with {{tool:jobs_wait}} |
<!-- /surface -->
<!-- surface: agent -->
| Error code | Next step |
| --- | --- |
| `CAPABILITY_NOT_CONFIGURED` `DUB_SEPARATION_NOT_CONFIGURED` `MODELS_DIR_MISSING` `CREDENTIAL_UNAVAILABLE` `AUTHENTICATION_REQUIRED` `OFFLINE_STRICT` `GRANT_REQUIRED` `GRANT_REVOKED` `BUDGET_EXCEEDED` `BUDGET_UNVERIFIABLE` `TASK_BUDGET_EXCEEDED` `TASK_BUDGET_UNVERIFIABLE` `TOOL_UNAVAILABLE` `TOOL_CONSENT_REQUIRED` `TOOL_UPDATE_CONFIRM_REQUIRED` `TOOL_UPDATE_MANUAL` `MEDIA_TOOL_UNAVAILABLE` `EXPORT_TOOL_MISSING` `LINK_LOGIN_REQUIRED` `LINK_COOKIES_UNAVAILABLE` `LINK_TOOL_UPDATE_REQUIRED` `VOICE_CONSENT_REQUIRED` `VOICE_CLONE_REQUIRED` | The user has to do something first: configure a capability, grant access or budget, agree to or install an external tool, sign in, authorize a voice. Pass `remedy` on to the user as is, and retry as `next` says once they are done; do not work around it |
| `INVALID_ARGUMENTS` `UNKNOWN_TOOL` | Wrong arguments or tool name: fix them against the tool's schema; get the operation fields of `edits_apply` from {{tool:edits_ops}} |
| Other error codes | Failed or cancelled. Look at `retryability`: `after-refresh` - read again before submitting (on a revision conflict, `PROJECT_REVISION_CONFLICT`, run {{tool:videos_inspect}} again); `after-user-action` - pass it on to the user; `never` - change approach |
<!-- /surface -->
<!-- /generated -->

## 5. Revision conflicts

A video has a revision number (`revision`, a decimal digit string) that goes up by one with every edit. Write operations carry the revision you read: {{arg:expectedRevision}} for {{tool:edits_apply}} and {{tool:edits_undo}}, {{arg:revision}} for {{tool:documents_put}}.

`PROJECT_REVISION_CONFLICT` means the user (or another program) just changed the video:

1. Run {{tool:videos_inspect}} again to read the current revision and object IDs; if you were changing a document, run {{tool:documents_read}} again.
2. Decide again, based on the new state, whether and how to change it. Do not overwrite what the user just changed.
3. Submit with the new revision. Do not blindly retry with the old IDs and the old body.

## 6. Waiting for jobs to finish

The top-level verbs ({{tool:transcribe}}, {{tool:translate}}, {{tool:dub}}, {{tool:download}}, {{tool:export}}, {{tool:transcode}}, {{tool:speak}}, {{tool:image}}) as well as {{tool:jobs_retry}}, {{tool:models_install}} and {{tool:models_test}} return a job (`jobId`). It is done only when `state` is `completed`; the results are in `outputs` (a file's `path`, `documentId`, `assetId`, `artifactId`) and in the pipeline's `pipeline.summary`.

<!-- surface: cli -->
- **Waiting is the default.** Commands that return a job block until a final state by default, the exit code follows that final state, and the result directly carries `outputs` and the final job record `job` (the top-level `state` is also final). `cuccut jobs wait <jobId>` also waits until a final state.
- **Put a limit on waiting.** Many agent hosts give a command a limit of a few minutes; for long jobs (transcribing a long video, rendering the finished video, downloading a large file, installing a model bundle), either add `--timeout <seconds>` set shorter than the host's limit, or use `--no-wait` to get the `jobId` first. When `--timeout` runs out it prints the `jobId` and the latest progress and returns with exit code 1 (`WAIT_TIMEOUT`) while the job keeps running; then continue waiting with `cuccut jobs wait <jobId> --timeout <seconds>`, following `next` in a loop until a final state.
- **Do not let the host cut you off.** An interrupt signal (Ctrl-C) while waiting cancels the job; return on your own via `--timeout` rather than being killed by the host's timeout.
- Do not poll repeatedly with `cuccut jobs inspect`; to cancel a job you started with `--no-wait`, use `cuccut jobs cancel <jobId>`.
<!-- /surface -->
<!-- surface: agent -->
- Wait with {{tool:jobs_wait}}: at most 50 seconds per call; when `settled` is `false`, call it again to keep waiting. Do not poll repeatedly with {{tool:jobs_inspect}}.
- To see progress or details use {{tool:jobs_inspect}}; to cancel use {{tool:jobs_cancel}}.
<!-- /surface -->
- A failed fixed pipeline (multi-step jobs such as transcription, translation, dubbing, download) can be rerun from the failed step with {{tool:jobs_retry}}, reusing the steps already completed; a single model job cannot be rerun, so submit it again.
- Do not submit the same work twice. When you need to resubmit the same call (for example after a network drop), pass the same {{arg:commandId}} as the first time and no second job is created.

<!-- surface: cli -->
## 7. Large results go to files

The full text from {{tool:documents_read}}, the full timeline from {{tool:videos_inspect}} and many hits from {{tool:space_search}} can be large:

- When a result exceeds `--max-bytes` (default 64 KiB), the full result is written to `.cuccut-out/<tool name>-<time>.json` under `cwd`, and stdout gives only `truncated: true`, `path`, the range covered (`coverage`) and the parameters to continue reading (`continueWith`).
- `--result-file <file>`: writes to the given file regardless of size.
- A truncated result is not the complete video: read that file, or follow `continueWith` and raise `--max-bytes` to fetch again, or narrow the range ({{tool:videos_inspect}} takes {{arg:fromSeconds}} / {{arg:toSeconds}} / {{arg:limit}}). Do not draw conclusions from the summary alone.
- `.cuccut-out/` is temporary output; files delivered to the user are written to a proper location with export or {{tool:artifacts_save}}.

## 8. How to write arguments

- Flags are derived from fields: `camelCase` → `--kebab-case`. Booleans are switches; `false` is written `--no-x`. Arrays can repeat the flag (`--at 1 --at 12.5`).
- Each command takes at most one positional argument (usually a video, link, file or `jobId`), as an alternative to the flag of the same name.
- Nested objects and operation arrays are written as JSON literals, or `@file`, or `-` (read from stdin). Put large text (the body for {{tool:documents_put}}, the operations for {{tool:edits_apply}}, the text for {{tool:speak}}) in a file and pass `@file`; do not cram it into the command line.
- Which fields exist: `cuccut help <command>`, or `cuccut spec <name>` for the JSON Schema.
- `--yes`: without it, `destructive` commands ({{tool:videos_delete}}) and {{tool:models_install}} (which needs the size confirmed) print what they would do and refuse with exit code 4; they do not wait for interactive confirmation. Ask the user first and pass it once they agree.
<!-- /surface -->
<!-- surface: agent -->
## 7. Large results

When {{tool:videos_inspect}} has many items, read a span with {{arg:fromSeconds}} / {{arg:toSeconds}} and cap the count with {{arg:limit}}; do not read the whole timeline at once. Narrow {{tool:space_search}} with {{arg:videoIds}}.
<!-- /surface -->

## 9. Time

- Always write times as **decimal seconds** (`"12.5"`) and ranges as `start:end` (`"10:20"`), or as objects as the tool description says. The engine snaps times to frames, and the receipt's `timeResolution` reports which frame it actually landed on; go by the receipt, and do not call a snapped 10.010 seconds "10 seconds".
- Do not mix up the two clocks:
  - **Timeline seconds**: used for moving, trimming, splitting, ripple deletes, chapters, grabbing frames and export ranges.
  - **The asset's own seconds**: used for word `start` / `end` in the transcript (in `timescale` ticks; seconds = ticks ÷ timescale) and for cuts (`addCuts`).
  - Conversion: a moment t in the asset is at the item's `startSeconds` + (t − `sourceInSeconds`) on the timeline, divided by the rate for items with changed speed. When unsure, read the item again with {{tool:videos_inspect}}; do not estimate by feel.
- Times in exports and in timestamped transcripts are times on the edited timeline; words that were cut are not in them.

## 10. IDs and references

| Thing | Form | Where it comes from |
| --- | --- | --- |
| Video | `videoId`, or the path to the video directory | {{tool:videos_list}}; the result of creating a video |
| Document (transcript, translation, captions, proposal, cut set) | `documentId` | The document list from {{tool:videos_inspect}}; `pipeline.summary.documentId` in the {{tool:transcribe}} result |
| Asset | `assetId` | The asset library from {{tool:videos_inspect}}; the import receipt |
| Item on the timeline | `itemId` | The items from {{tool:videos_inspect}}; newly created objects in a receipt |
| Job | `jobId` | Returned by the top-level verbs |
| Artifact (generated audio, image, transcript JSON) | `artifactId` (`sha256:…`) | `outputs` in the job result |
| Revision | `revision` (a decimal digit string) | {{tool:videos_inspect}} or the previous receipt |

Take IDs only from tool results; do not make them up, and do not reuse them across videos.

<!-- surface: cli -->
### Videos, projects and paths

- Each tool's {{arg:video}} ({{tool:videos_inspect}}, {{tool:edits_apply}} and so on) accepts a `videoId`, the path to a video directory (absolute or relative to the current directory) or a Space entry id, resolved in the order "directory → `videoId` → entry". A video that is not open is opened for the duration of the call.
- Relative paths (assets, export directories, transcode output) are all resolved against the **current directory**; absolute paths are accepted as-is. Video directories and `.ccut` are not writable.
- Projects: pass `--project <dir>` explicitly; otherwise `.ccut/project.json` is searched for upward from the current directory; if neither exists, new videos land in the `CLI` project under the default projects directory, and the result says so. When the user is working in a project directory, simply run commands in that directory.
- Exports without a directory are written to `exports/` under the current directory.
<!-- /surface -->
<!-- surface: agent -->
### Videos and paths

- Each tool's {{arg:video}} ({{tool:videos_inspect}}, {{tool:edits_apply}} and so on) accepts the `path` or `videoId` given by {{tool:videos_list}}. Work on the video open in the editor or the one the user names.
- Relative paths are resolved against the session's working directory; exports without a directory are written to `exports/` under the working directory.
<!-- /surface -->
