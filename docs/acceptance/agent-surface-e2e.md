# Agent Surface End-to-End Acceptance Record (2026-10-06)

> An execution record of [Agent surface design §10 “Acceptance”](../design/agent-surface/agent-surface-design.md#acceptance): an external agent installed only the CucCut skill and completed “link → transcribe → agent self-translation → bilingual subtitle layer → export mp4 and srt”, then switched to MCP and walked the same path.

This document is an execution record, not the pass criteria; the criteria are in design §10 and the [acceptance and test spec](acceptance-spec.md). Evidence is not committed to the repo. Below it is referred to as `<E>`: one retained copy on this machine at `.dev/acceptance-evidence/agent-surface-e2e-2026-10-06/` (the stream-json and walkthrough records for the CLI and MCP legs are in `evidence/`, the web editor screenshots in `web-editor/`, and the frames before and after burning in the subtitles in `caption-render/`). The token exists only in `<E>/mcp-config.json` (0600) and is not included in this document.

## 1. Conclusion

| # | Acceptance item | Result | Evidence |
| --- | --- | --- | --- |
| 1 | Beyond `cuccut --help`, only reads `help <command>` or `spec` on demand; does not read the full help text | Passed | `<E>/evidence/cli-leg.stream.jsonl` |
| 2 | Runtime was not started manually; at the end it exits or stays running according to the ownership rules | Passed | `<E>/evidence/cli-leg.stream.jsonl`, `<E>/home/logs/runtime.log`, `<E>/evidence/cli-leg.runtime-exited-at` |
| 3 | The receipt of every write command was read back and appears in the delivery report | Passed | `<E>/evidence/cli-leg.stream.jsonl`, `<E>/evidence/cli-leg.final-report.md`, `<E>/home/projects/CLI/NASA Zero Gravity Research/video.db` |
| 4 | Switching to MCP also works end to end, with tool names and parameters unchanged | Not passed in this run. Two blocking defects were fixed; after the fixes the full chain passed with a script client. Still needs one re-run with Claude Code | `<E>/evidence/mcp-leg.stream.jsonl`, `<E>/evidence/mcp-walk-1-before-placement-fix.jsonl`, `<E>/evidence/mcp-walk.jsonl` |
| 5 | The external agent's `web open --video` goes through login straight to the video's editor (design §8.8, back-filled the evening of 2026-10-06) | Passed | `<E>/web-editor/shot-4-fresh-login-editor.jpg`, `shot-6-editor-expanded-at-2s.jpg` and `frame-cli-at-2000ms.png` |

## 2. Environment

- Repository: branch `agent/e2e-acceptance` (worktree). The CLI used the worktree's `apps/cli/src/main.ts`, invoked through the `cuccut` wrapper script on PATH. No packaged App was installed, so `resolveRuntimeLaunch` fell through to the repo's `apps/runtime/src/main.ts`.
- Runtime: isolated `CUCCUT_HOME`, CLI leg at `<E>/home`, MCP leg at `<E>/home-mcp` (each copied the yt-dlp consent record). `CUCCUT_MODELS_DIR` pointed at the weights already on this machine. engine-host and model-worker reused the already-built binaries read-only; nothing was built. Download directories `<E>/downloads` and `<E>/downloads-mcp`.
- External agent: Claude Code 2.1.292, `claude -p … --output-format stream-json --verbose --setting-sources project --no-session-persistence`, with cwd set to a project directory where only the CucCut skill was installed (`cuccut skill install --dir <project>/.claude/skills`). The models recorded in the stream-json init: CLI leg claude-fable-5-1, MCP leg claude-opus-5-5. The two legs used different models; the reason was not determined.
- Video: “How Do We Do Research in Zero Gravity? We Asked a NASA Expert” by NASA Langley, a public-domain webm on Wikimedia Commons, 132 seconds, 1920×1080 (`https://upload.wikimedia.org/wikipedia/commons/c/ce/How_Do_We_Do_Research_in_Zero_Gravity_-_We_Asked_a_NASA_Expert.webm`).
- Task text (same for both legs; the MCP leg had one extra sentence up front, “CucCut is already connected to you as an MCP server (cuccut)”): transcribe the English audio; you translate the subtitles into Simplified Chinese yourself; create a bilingual Chinese–English subtitle layer in the video; export an mp4 final cut with bilingual subtitles, plus a bilingual srt subtitle file; deliver a delivery report when done.

### Deviations from “no App open, only the skill installed”

- The desktop App was actually running (dev-mode Electron, using a different `CUCCUT_HOME`). The Runtimes for both legs were independent of it; the local ASR shared the GPU with it.
- `claude -p` used the user's own Claude Code login. A `CLAUDE_CONFIG_DIR` set to a temp directory cannot read the login stored in the Keychain, so only `cuccut mcp install` wrote to the temp config directory; the agent run itself did not switch config directories. The MCP leg therefore connected with `--mcp-config <E>/mcp-config.json --strict-mcp-config` and left the user's MCP settings untouched. The user's `~/.claude/skills` held another copy of the `cuccut` skill, which was not loaded under `--setting-sources project` (the init in stream-json listed only the project copy and Claude Code's built-in skills).
- `--no-session-persistence` was added, but Claude Code still saved one oversized tool result (the 52 KB output of `cuccut status`) to the user's `~/.claude/projects/<cwd-encoded>/tool-results/`. No MCP config was written to `~/.claude.json` (`<E>/evidence/user-config-shasum.before.txt` and `.after.txt`: `~/.claude/settings.json`, `~/.codex/config.toml` and `~/.gemini/settings.json` were identical before and after; the digest of `~/.claude.json` changed because a parallel Claude Code session was writing it, and it contains no `cuccut` MCP entry).
- The MCP leg used a separate home, with `cuccut mcp install --agent claude-code --level auto` (auto level; no approval prompts during acceptance).

## 3. Item by Item

### 3.1 Read help on demand only (passed)

Of the 25 Bash calls in the CLI leg, help was requested only for `help transcribe`, `help download`, `help documents put`, `help documents read`, `help captions create`, and `help export | head -60`. `cuccut --help`, a bare `help`, and `spec` were never run. The skill pages were read on demand: `start.md`, `conventions.md`, `catalog/media.md`, `catalog/subtitles.md`, `catalog/export.md`, and three craft pages.

### 3.2 Runtime ownership (passed)

- The agent's first command was `cuccut version; cuccut status --json`. The answer showed `runtime.started: true` and `launchedBy: cli`: the CLI launched it automatically (`--launched-by cli --idle-exit`); neither the agent nor I started it manually.
- Exit: the agent's last connection dropped at 22:25:55 (UTC). My own two `runtime status` calls afterwards dropped at 22:27:25. At 22:37:32 the Runtime logged “received stop signal” `signal: idle` and stopped (`<E>/home/logs/runtime.log`); the discovery file was deleted with it. The CLI had launched it, with no connections, no jobs and no open services, so it exited after 10 idle minutes, as architecture design §2.2 specifies.
- The MCP leg's Runtime was also launched by the CLI (during `mcp install`). The MCP service was running, so it was kept per the rule (`runningServices: ["mcp"]` in `runtime status`). Afterward, to load the fixed code for the script re-check, I restarted it with `cuccut runtime stop` / `runtime ensure`, then stopped it again after the re-check. All of this happened outside the two Claude Code runs.

### 3.3 Receipts read back into the report (passed)

| Write command | Receipt | Corresponding line in the report |
| --- | --- | --- |
| `download --new-video` | Video and asset, 1920×1080, 132.37 seconds | Downloaded and imported to the timeline |
| `transcribe <video> --asset …` | Document, 416 words, 1 speaker | English transcript |
| `documents put` (polish) | Version 2→3, `updatedIds` | Polished transcript, 21 words changed |
| `documents put --kind translation` | Version 3→4, `filledAlignments: 22` | Simplified Chinese translation written, 22 sentences |
| `captions create --bilingual` | Version 4→5, `cueCount: 50`, `pairedOriginal` | Bilingual subtitle layer created |
| `export --kind video` / `--kind subtitles` | The job's `outputs` paths | Exported files (paths taken from the job result) and ffprobe verification |

The five transactions in `video.db` (download 0→1, transcription 1→2, polish 2→3, translation 3→4, subtitle layer 4→5) match the report. The three failed writes (`transcribe --url` rejected with an argument, polish with a wrong `--revision` conflict, and an ambiguous source when exporting srt) made no changes; the agent read the corrected `next` and retried. Outputs: `<E>/project/exports/NASA_Zero_Gravity_Research.bilingual.mp4` (93 MB, 1920×1080, 3971 frames) and `.en-zh.srt` (22 cues). The report's “4 changes in total” does not match the 5 rows in the table (a minor error).

### 3.4 MCP path (not passed in this run → fixed → passed on script re-check)

1. **Claude Code leg** (36 seconds): 33 `mcp__cuccut__*` tools were connected. `projects_list` was empty, `download` did not accept `newVideo`, `videos_create` given a directory path answered `PROJECT_NOT_FOUND`, and `projects_create` was not exposed over MCP. The agent stopped and reported as instructed. Cause: the project registry in the new home was empty, while the external service must serve only registered projects. **Fix 1**: `cuccut mcp install` now registers the `CLI` project under the default project directory when no projects exist (the result carries `defaultProject`); see design §6.2, §11 and architecture design §4.8.
2. **Script re-check after fix 1** (`<E>/mcp-walk.mjs`; the official MCP SDK connected directly to the same endpoint and token, with tool names and parameters written as in the Claude Code leg): `projects_list` now showed `CLI`. Following the error's `next` hint, it called `videos_create {name, project}` and then `download {url, video}`. The download succeeded, but the asset was only imported and not placed on the timeline, so `transcribe {video}` failed with `TRANSCRIBE_ASSET_NOT_FOUND` (`<E>/evidence/mcp-walk-1-before-placement-fix.jsonl`). Even when `assetId` was supplied, the export was an empty timeline. **Fix 2**: when importing from a link into an existing video whose timeline is still empty, the asset is now placed on the main track in the same transaction, as `newVideo` already does (architecture design §7.9).
3. **Script re-check after fix 2** (restarted the MCP leg's Runtime to load the new code): `projects_list` → `videos_create` → `download {url, video}` → `jobs_wait` → `transcribe {video, language, hint, noCaptions}` → `jobs_wait` → `videos_inspect` → `documents_read` (45 KB, within MCP's budget, with `translationBasis`, 22 sentences) → `documents_put` (translation; `alignment: null` filled in by the Runtime) → `captions_create {bilingual: true}` (50 cues) → `export` mp4 → `export` srt. All succeeded. Final cut: `<E>/home-mcp/projects/CLI/exports/NASA Zero Gravity Research (MCP).mp4` (h264 + aac, 1920×1080, 3971 frames, 132.37 seconds; frame grabs show both the Chinese and English subtitle layers). Subtitle file: `.en-zh-Hans.srt` (22 cues, English above, Chinese below). The export paths were taken from the job's `outputs` (`<E>/evidence/mcp-walk.jsonl`, `<E>/evidence/mcp-walk-frame-20s.png`).
4. **Remaining step**: after the fixes, the MCP leg was not re-run with Claude Code (each leg was run only once). Recommend that the orchestrator re-run it after merge to confirm the agent can follow the instructions end to end.

“Tool names and parameters need not be rewritten” holds only in part. Tool names map one-to-one to the CLI, but the external service's `download` does not accept `newVideo` (a video created by the flow cannot enter the service's video list), so a new video must first be created with `videos_create` and then downloaded into. The steps differ from the CLI's `download --new-video`. This difference is a deliberate one set in the design (architecture design §4.8) and was not changed here. Whether the external service should also accept `newVideo` when `project` is given was left for a design decision. It has since been decided to allow it (see the last item in §4).

### 3.5 Web editor (passed, back-filled)

After design §8.8 landed, I re-checked on an isolated Runtime (its own `CUCCUT_HOME`, web port 47652, stopped after verification). First the web service was stopped to clear the session. The link from `cuccut web open --video <videoId>` was opened in the app's built-in browser and, through the login page, landed in that video's editor (`<E>/web-editor/shot-4-fresh-login-editor.jpg`). With the playhead at 00:02.0, the picture matched the frame extracted by `videos frames --at 2` (`shot-6-editor-expanded-at-2s.jpg`, `frame-cli-at-2000ms.png`). At 1024 and 800 px width, and after clearing localStorage and logging in again, it landed on the video tab (`shot-7`, `shot-8`, `shot-9`). With a session still active, an address without `#code` did not require logging in again (`shot-3-session-reuse.jpg`). `--video video_nope` answered `VIDEO_NOT_FOUND` with exit code 1.

Observation: the first time the browser panel opened, it stopped once on the session tab (`shot-1-narrow-800.jpg`). Three later re-tests did not reproduce it. The suspected cause: the panel went from wide to narrow while loading, and a Home key press with focus in the input selected the session tab. The manual `web.md` says to “click the video tab when it is not selected”.

Not yet tested: `--launch` returning to the original path and query, which has only unit tests; and the Runtime's idle exit while a browser is connected.

## 4. Findings (non-blocking) and dispositions

Each disposition is written at the end of its item: “Fixed” with the commit, “spec changed” where the spec did not say it or differed from the decision and was changed along with it, or “recorded, not changed” with the reason.

- `cuccut status` stdout is 52 KB, 48 KB of which is `capabilities`; agents had to write their own script to filter it, and Claude Code saved the result to a file as a result. — Fixed, spec changed (e71d9909): by default it gives only each capability's default value, the available services and their count, and the status of model packs; `--full` includes the complete content. The command protocol and the Agent-surface design were updated to match.

- `transcribe --url` (the same on both surfaces) does not accept `language`, `hint`, `noCaptions`, or `name`; passing them is rejected, and agents on both legs first hit this and then changed to a two-step process. — Fixed (c07f41c7): design §4.2 already listed these parameters and the implementation contradicted it. Now `provider`, `model`, and `diarize` are also passed through to the `link-import` flow, and after transcription places the video, a captions layer is built by default. The flow spec (command protocol, architecture design §7.9) now lists the new parameters and the `captions` step.

- The skill text “include the `--revision` you read back” is easily read as the document version returned by `documents read`, whereas `documents put --revision` takes the video version; an agent therefore hit one `PROJECT_REVISION_CONFLICT`. — Fixed (93f3eb64): the instructions and the `documents_put` description now state that it is the video's revision (from `videos inspect` and write-command receipts), not the document version.

- The top-level `state` in the `export --wait` answer is the snapshot at submission (`queued`/`running`), while `job.state` is `completed`; readers easily misjudge. — Fixed (c787878b): design §5.4 already requires `--wait` to wait for a terminal state. For every command that returns a `jobId` with `--wait`, the top-level `state` is now the terminal state.

- Bilingual SRT exported from a transcript has one cue per sentence, up to about 10.5 seconds and 6 lines long. — Recorded, not changed: the spec does not limit this (the reading budget in the video format spec §5.6 gives no per-cue duration or line cap).

- The candidates in `EXPORT_SOURCE_AMBIGUOUS` list only caption documents, not transcripts. — Fixed (7b3df2bc): candidates now list both the visible caption documents and the transcript documents.

- `idleExit.idleSince` in `runtime status` is always null: the status query is itself a connection, which resets the idle timer, so each check also postpones the exit. — Fixed, spec changed (963f07a3): a CLI connection that makes no request other than `runtime.status` or `runtime.info` does not count as in use, and `idleSince` reports the value from before the query. Architecture design §2.2 originally said “no CLI connection,” which was changed per the decision.

- On a new home, when `projects_list` is empty, `next` still says “use the projectId as the `project` for videos_create,” which leads nowhere (no longer occurs after fix 1, but still happens outside `cuccut mcp install`). — Fixed (ceb8551e): when empty, a way forward is given per surface (for external services, ask the user to register a project or run `mcp install`; for the local surface, explain the default location).

- The `next` on download completion says “the new video has been placed on the timeline,” and it says so as well when downloading into an existing video (`createdVideo: false`). — Fixed (d3439f20): now split by `createdVideo`.

- Burned-in Chinese subtitles render punctuation as spaces (the punctuation in the SRT is complete). At second 88, a Chinese caption breaks at “国际空间” (“international space”) and “站” (“station”) falls into the next cue.
  - Handled (punctuation): not a glyph or typesetting defect. The style document created by the caption layer has body `style: {}`, and Studio's `punct` style is true when unset. The kernel uses this switch to turn commas and full stops into spaces (the “标点” (punctuation) item on the property page; test `video_plan_projects_punctuation_in_every_language_and_honors_the_style_switch` pins it). The change is to the default: the default preset writes `punct: false` (video format spec §5.6, “Default preset”). Captions without a style document, and newly created caption styles, now draw punctuation as written. `frame-render`'s `unstyled_captions_draw_the_default_preset` checks this with a sentence containing only the marks “，” “。” “，。？！” and “其实，宇航员。” (sample text, “Actually, astronaut.”). Rendering of existing projects' `style: {}` is unchanged.
  - Recorded, not changed (cue break): this translation was written by an agent and is split by sentence-level alignment and display width (`translationCues`, architecture design §3.5, §7.9). The sample line “我们就把栖息舱搬到国际空间站上本来就可能有风扇的地方，” (sample subtitle, roughly “we would move the habitat pod to the ISS, a place that might have fans anyway,”) has a display width of 54 (CJK characters and full-width punctuation count as 2 each), above the limit of 42 per cue, so it is cut by width into two roughly equal blocks (26 and 28), exactly at “空间｜站”. §3.8 allows CJK word-by-word splitting, and the cue-splitting rules have no “do not split inside a word” convention (Chinese has no word dictionary, and the Worker alignment's judgment of intra-word gaps was not connected here). This is therefore a line-break quality issue, not a violation. Changing it requires first defining the cue rules.

- Burned-in captions are hard to read on light frames: at second 20 white text sits on a white band and several characters almost disappear (`<E>/evidence/mcp-walk-frame-20s.png`); the default style has no outline or backing. — Handled: the default preset is the “Classic” livery (white text, black outline (`textOutline.width` 14, scaled with font size), black drop shadow, background box off). Captions without a style document are drawn with it, and the editor, agents, and fixed flows create this one when they make a new caption style (video format spec §5.6). Preview and export use the same kernel. Captions with a style document are drawn as the document says; existing `style: {}` is unchanged, so to see the effect in an old project, apply “Classic” once or rebuild the caption layer.

- The design says the external catalog has about 35 tools; 33 are actually exposed. — Fixed (afca44f8): design §6.2 now states the actual 33.

- (§3.4, last paragraph) The external service's `download` does not accept `newVideo`. — Spec changed (c07f41c7): architecture design §4.8 and Agent-surface design §11 originally said explicitly that it is not accepted. Per the decision, it is now allowed: to give a registered `project` as well, the video created by the flow is registered in the service's scope. Giving no destination is still rejected. `transcribe` with `url` is handled the same way.
