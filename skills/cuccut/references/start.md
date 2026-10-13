# Getting started: finding the CLI, the version gate and preflight

<!-- surface: agent -->
You do not need this page inside a session: the tools are already connected and CucCut manages the Runtime. To see what can be done, use {{tool:models_capabilities}} and {{tool:models_list}}; see [models](catalog/models.md).
<!-- /surface -->
<!-- surface: cli -->
## 1. Find the CLI

1. `command -v cuccut` (on Windows, `where cuccut`). If it is found, use it.
2. If not, check the `CUCCUT_CLI` environment variable: it gives the full path to the executable.
3. Still nothing: ask the user to install CucCut (the desktop app ships with the CLI), or to tell you where `cuccut` is. Do not download an installer yourself, and do not go searching through other directories.

The rest of this skill writes `cuccut`; substitute the actual path you found.

## 2. Version gate

```text
cuccut version
```

Prints bare JSON: the versions of the CLI and (when running) the Runtime, the tool interface version on each side, and whether they match. It does not start the Runtime.

- They match, or the Runtime is not running yet: carry on.
- They differ: from then on, every command that needs the Runtime is refused with exit code 3 (`INTERFACE_VERSION_MISMATCH` / `PROTOCOL_MISMATCH`). Tell the user which side needs updating (usually updating CucCut to the same version) and stop here. Do not switch to old parameters and do not work around it.

## 3. Preflight: what this machine can do

```text
cuccut status
```

Shows at a glance:

| Field | What to look at |
| --- | --- |
| Runtime | Whether it is running, and its version; if not running, it is started automatically (with `--no-start` it only answers `running: false`) |
| Capabilities | For transcription, speech synthesis, image generation, music generation, text generation and voice separation: which service each uses right now and which services are usable; unavailable ones come with a reason and a remedy command. This is a summary: for each service's models, voices and limits, use `cuccut status --full` or `cuccut models capabilities --capability <capability>` |
| Local model bundles | Which are installed, and their status |
| External tools | Whether yt-dlp (downloading links) and ffmpeg (export, transcoding) are present |

For anything missing, tell the user how to fix it using the remedy command. When the remedy command is a "Local admin" command (installing or consenting to model services and external tools), get the user's agreement first, and leave any step involving secrets to the user. A missing local model bundle can be installed following [models](catalog/models.md) (report the size and get agreement first).

Read-only help and the catalog do not need the Runtime: `cuccut --help`, `cuccut help <command>` and `cuccut spec` answer from the offline snapshot that ships with the CLI when there is no Runtime. It is fine to read the help first and then decide whether to start work.

## 4. The Runtime manages itself

- **Do not start it by hand.** Every command that needs the Runtime first looks for a running Runtime in `CUCCUT_HOME` (default `~/.cuccut`); if none is found it starts one in the background, and the result envelope carries `runtime: { started: true }`. When the desktop app is open, its Runtime is used directly.
- `cuccut runtime ensure`: does the same thing explicitly and prints `started` or `reused`. Use it to bring the Runtime up at the start of a long workflow.
- `cuccut runtime status`: process, port, version, who started it, which connections and in-progress jobs it has, and how long until it exits when idle; it never starts one.
- `cuccut runtime stop`: stops only the one the CLI itself started. It refuses one started by the desktop app or someone else (`RUNTIME_NOT_OWNED`), and refuses when someone is using it or jobs are unfinished (`RUNTIME_IN_USE`); both exit with code 1. Do not force-stop it.
- A Runtime started by the CLI exits on its own after the `runtime.idleExitMinutes` setting (default 10 minutes) passes with no connections, no jobs and no open services. So you do **not** need to stop it when the task is done; run `stop` only when the user asks.
- `--no-start`: do not start one automatically; if none is found, return with exit code 3 (`RUNTIME_UNAVAILABLE`). Use it when you only want the status, or when the user does not want a background process started.

## 5. When the Runtime will not start

| Symptom | What to do |
| --- | --- |
| Exit code 3, `RUNTIME_START_FAILED` | Tell the user `error.message` verbatim; ask the user to open the CucCut desktop app once to see whether it works. Do not change files in `CUCCUT_HOME` yourself |
| Exit code 3, `RUNTIME_UNAVAILABLE` | If you did not pass `--no-start`, retry once; if it still fails, handle it as in the row above |
| Exit code 3, `CATALOG_UNAVAILABLE` | Offline with neither a snapshot nor a Runtime: the CLI installation is incomplete; ask the user to reinstall |
| Exit code 3, version mismatch | See section 2 |

## 6. Start work

Read one catalog page for the task (SKILL.md section 3), then call commands following the conventions in [conventions](conventions.md).
<!-- /surface -->
