---
description: Model capability mechanics - the services, models and limits available for each capability, installing and checking local model bundles, and what to do when a capability is not configured or needs a grant. Read when you hit such an error or need to install a model bundle.
---

# Model capabilities: queries, local model bundles and handling "not configured"

## When to use

- Before starting, confirm whether transcription, speech synthesis, image generation and music generation are usable and what their limits are.
- A local model is not installed, and a local model bundle needs installing or checking.
- You received an error that needs the user to act, such as `CAPABILITY_NOT_CONFIGURED` or `GRANT_REQUIRED`.

## Preflight

There are six capabilities: transcription (`transcribe`), speech synthesis (`synthesizeSpeech`), image generation (`generateImage`), music generation (`generateMusic`), text generation (`generateText`), and voice and background separation (`separateAudio`).

- **Text generation is not for you.** It is the text model used by tool pages and fixed pipelines (such as {{tool:translate}}); you do translation, polishing and summarizing yourself, so it being unconfigured does not affect you, and it cannot be used to call other models.
- Voice separation is local only, and is used only for translated dubbing's "separate background".
- Music generation is local only (an installed music model bundle plus the audio.cpp engine), with no online service; for capabilities and installation see "Music generation" below, and for usage see [music](music.md).

## Commands and examples

| What to do | Call |
| --- | --- |
| See each capability's usable services, models, limits and defaults | {{tool:models_capabilities}}; for just one, pass {{arg:capability}} |
| See whether local model bundles are installed, and their status | {{tool:models_list}} |
| Install a local model bundle | {{tool:models_install}}; without {{arg:bundleId}} it installs this machine's default transcription bundle; local speech synthesis, image generation and music generation must pass one |
| Check whether an installed bundle works | {{tool:models_test}}, {{arg:bundleId}} |

{{tool:models_install}} downloads from hundreds of MB to several GB:

<!-- surface: cli -->
- Without `--yes`, it only reports the bundle and its size, downloads nothing, and returns with exit code 4. Tell the user the size first, and pass `--yes` once they agree.
- Downloading may take a long time: put a limit on waiting per "Waiting for jobs to finish" in [conventions](../conventions.md).
<!-- /surface -->
<!-- surface: agent -->
- Before submission, CucCut tells the user the size and confirms according to the access mode; do not agree on the user's behalf.
<!-- /surface -->
- When already installed, nothing is downloaded (`jobId` is null); a previously unfinished download resumes. Do not submit twice.

## Reading the results

For each capability in {{tool:models_capabilities}}:

- `effective`: what is actually used when no service is specified; when null, calls that do not specify a service are refused with `CAPABILITY_NOT_CONFIGURED`.
- Each service and model: whether it is usable and why, its limits (text length `maxInputChars`, prompt length, sizes, counts, voices, formats, speed range, whether delivery instructions are accepted `acceptsInstructions`, music's duration limit `maxDurationSec` and planning options `local.planning`), and defaults.
- A local service's "models" are the local model bundles: transcription under `transcribe`, synthesis under `synthesizeSpeech`, image generation under `generateImage`, music generation under `generateMusic`.

Each model bundle in {{tool:models_list}}: `bundleId`, capability, status (`not-installed`, `downloading`, `installed`, `ready` and so on) with a reason, an estimated download size, and the latest check (`selfTest`).

{{tool:models_install}}: returns a `jobId` and the size (`downloadBytes`; when unknown, see `estimatedBytes`); it is installed only when it reaches `completed`. Then submit transcription again; local synthesis, image generation and music generation have no factory default, so when submitting {{tool:speak}}, {{tool:image}} or {{tool:music}}, pass {{arg:provider}} `local` and {{arg:model}} (this bundle).

{{tool:models_test}}: `completed` means it passed; on `failed`, `error.details.check` is the reason.

## Music generation (`generateMusic`)

Local service only: the model is an installed music model bundle (currently `yue2-3b@audio-cpp-q8`, YuE2 3B, about 4.6 GB to download), run locally by the audio.cpp engine (`audiocpp_cli`), offline, with no online service and no factory default. First check {{tool:models_capabilities}} (capability `generateMusic`) for a usable model, the duration limit (`maxDurationSec`, 300 seconds for YuE2), the default budget (`defaultDurationSec`), planning options (`local.planning.options` and the default) and the character limits for style and lyrics (`maxStyleChars`, `maxLyricsChars`).

How to submit when scoring a video or making a piece of music, how to write the style, how to fill long videos and how to place it on the music track are in [music](music.md). Only the facts about the capability itself stay here:

- **It is slow**: one run takes from a few minutes to over ten (slower on CPU); submit once, wait with {{tool:jobs_wait}}, and do not resubmit.
- **License**: YuE2 is CC-BY-NC-4.0, for non-commercial use only (`license.commercialUse: false`). When the user wants commercial use, tell them this first and let them decide.
- When the model bundle is not installed, call {{tool:models_install}} with {{arg:bundleId}} `yue2-3b@audio-cpp-q8` (tell the user the size first); when it is installed but the engine cannot be found, the capability reports `unsupported`; see the next section for handling.

## Handling "not configured" and "needs a grant"

| Situation | What to do |
| --- | --- |
| {{tool:translate}} reports `CAPABILITY_NOT_CONFIGURED` | Translate yourself (the translate-yourself path in [subtitles](subtitles.md)); do **not** ask the user to configure anything |
| Transcription, speech synthesis, image generation or music generation reports `CAPABILITY_NOT_CONFIGURED` with `remedy.action` `install-model` | The local model bundle is not installed: tell the user which one and how big it is, run {{tool:models_install}} once they agree, then resubmit after installation |
| The `generateMusic` bundle is installed but the capability still has `unavailableReason: 'unsupported'`, and `detail` says the audio.cpp engine cannot be found | The engine (`audiocpp_cli`) is not on this machine: first tell the user the engine needs downloading (about 30–70 MB, Apache-2.0, from audio.cpp's releases page); once they agree, call {{tool:models_install}} with {{arg:bundleId}} `yue2-3b@audio-cpp-q8`, which installs the engine after confirmation, and wait with {{tool:jobs_wait}} on the result's `engine.jobId`; when `engine` has no `jobId` but a `reason` (the engine given by `CUCCUT_AUDIOCPP_CLI` cannot run, offline, no package for this machine), pass `reason` and `remedy` on to the user |
| As above, with another `remedy` | The user needs to enable an online service or configure an account: tell the user where to enable what, following `remedy` and `next`, and stop here (when images are only part of the delivery, only the drawing step stops; see "Generating images" in [media](media.md)) |
| `GRANT_REQUIRED`, `GRANT_REVOKED` | Data would be sent to an online service, but the user has not granted it: pass `remedy` on to the user |
| `BUDGET_EXCEEDED`, `TASK_BUDGET_EXCEEDED` | Over budget: pass it on to the user and let them decide |
| `MODELS_DIR_MISSING` | The models directory is missing (for example, an external drive is not connected): ask the user to connect it or change the setting |
| `MODEL_FILES_DAMAGED` | Model files are damaged: ask the user to repair them in CucCut |
| `OFFLINE_STRICT` | The user turned on strict offline mode: only local services can be used; tell the user |

In every case, do **not** work around it with a shell, scripts, other websites or other providers, do not touch API keys or credentials, and do not change settings on the user's behalf.
<!-- surface: cli -->
Enabling services, configuring accounts and setting defaults are "Local admin" commands (`cuccut models configure` and so on), meant for people: either ask the user to do it themselves, or, with the user's explicit agreement, run them following `next`; secrets are entered only by the user.
<!-- /surface -->
<!-- surface: agent -->
Enabling services, configuring accounts and setting defaults are done by the user in CucCut's settings; you only explain which item to change.
<!-- /surface -->

## Common error codes

See the table in the previous section; for anything else, see "How to use the error object" in [conventions](../conventions.md).

## Next steps

- The capability is ready: go back to the original task page ([subtitles](subtitles.md), [voice](voice.md), [media](media.md), [music](music.md)) and resubmit.
- The user will not configure it for now: tell the user which step cannot be done, and finish everything else that can be done.

## Acceptance

- You did not configure, consent or enter secrets on the user's behalf.
- Before installing a model bundle, you told the user the size and got agreement; after installing, you confirmed its status with {{tool:models_list}} or {{tool:models_test}}.
