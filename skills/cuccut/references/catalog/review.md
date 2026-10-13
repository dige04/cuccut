---
description: The review gate before delivery - the user's standard (measured checks and judged questions), checking a video against it, answering questions with evidence, what the verdicts mean, and why findings are let stand only when the user says so.
---

# Review: holding a finished video to the user's standard

## When to use

- Before a deliverable export of a finished video: a critical finding stops the export (`REVIEW_BLOCKED`).
- The user asks whether the video is ready, what is still wrong with it, or to check it against their standard.
- The user asks you to answer the review questions, to let a finding stand, or to change their standard.

## What the standard is

- **Checks** are measured by CucCut: one metric from a closed catalogue, a limit (`min`, `max` or `is`), a severity and a fix sentence. The user's check on a metric replaces the built-in one; with no standard of their own, the built-in checks apply (placeholder boxes left in the video is critical; a blank stretch and text past the frame edge are suggestions).
- Metrics of stage `project` are read from the video itself, with no render. Metrics of stage `export` are read from the last finished-video export of the sequence, so they need an export first.
- **Questions** are what no number catches. An agent answers them, and every answer has to point at evidence of the declared kind, or it is recorded as `cannot-tell`.
- Per-video decisions (a finding let stand with a reason, a severity changed on this video) are part of the video: ordinary edits, undone like any other.
- {{tool:review_criteria}} shows the standard for a video and its decisions; with {{arg:catalogue}} it also lists the metrics.

## Checking

{{tool:review_run}}: {{arg:video}}. It measures the project tier, the export tier when the sequence has a finished-video export, and re-evaluates answers already given. It writes only the result file under `.cuccut-out/reviews/`; the video is not changed, so it is fine in plan mode and can be run as often as needed.

| Field | Meaning |
| --- | --- |
| `verdict` | `passed`: nothing open. `passed-with-findings`: only suggestions or nitpicks are open. `failed`: a critical finding is open. |
| `open` | Findings to answer for: what was measured (`value`), the `limit`, and the `fix`. |
| `waived` | Findings the user let stand, with their reason. They no longer stop an export but stay listed. |
| `skipped` | What could not be decided and why: `aspect` (the check is for another canvas shape), `not-exported` (no export yet), `unreadable`, `unknown-metric`, `not-asked` (questions not answered yet). A skipped check is never a pass or a fail. |
| `stale` | The export tier or the answers are older than the video: export again or answer again to refresh them. |

Report open findings to the user in plain words with what `fix` says; do not reword the measurements.

## Answering the questions

1. Read the questions with {{tool:review_criteria}} (each has an `evidence` kind).
2. Look: {{tool:videos_frames}} for the picture, {{tool:documents_read}} for what is said, a {{arg:purpose}} `preview` export for the composited picture and captions.
3. Answer every question in one {{tool:review_answer}} call: `holds`, `fails` or `cannot-tell`, with evidence of the declared kind.

| Evidence kind | Valid answer |
| --- | --- |
| `timestamp` | A time inside the video: `12.5s`, `01:02` or `00:01:02` |
| `frame` | A frame file that {{tool:videos_frames}} wrote under `.cuccut-out/frames/` |
| `field` | An id in the video: an item, track, document or marker |
| `quote` | Words that appear in a transcript or caption document of the video |

`holds` with empty evidence, or evidence of the wrong kind, is recorded as `cannot-tell` with a note. Do not answer `holds` to get a pass: say `cannot-tell` when you could not see it.

## Letting a finding stand, changing what it is worth

- Fix first. A finding is let stand only when the **user** says it may stand, with their reason: {{tool:review_waive}} with {{arg:reason}}. CucCut asks the user every time, in every mode but full access.
- {{tool:review_severity}} raises a finding freely; lowering it below the standard's severity needs the user's reason and asks the user. {{tool:review_unwaive}} holds a finding to the standard again.
- These are edits of the video: {{tool:edits_undo}} takes them back.
- Never waive, lower a severity, rewrite the standard or ask to switch the gate off just to get an export through.

## Changing the standard

{{tool:review_criteria_set}} replaces the user's whole standard, and only when they ask: read it with {{tool:review_criteria}} ({{arg:catalogue}} `true` for metric names), change it, send it all back. CucCut asks the user every time. A refusal comes back as `REVIEW_CRITERIA_INVALID` with `issues` by code (unknown metric, no limit, a limit of the wrong kind, min over max, critical with no fix, duplicate id, too long, too many); `warnings` come back with a saved standard.

## Common error codes

| Error code | Next step |
| --- | --- |
| `REVIEW_BLOCKED` (from {{tool:export}}) | `findings` lists what stops the export: fix each as `fix` says and export again; if the user wants one to stand, {{tool:review_waive}} with their reason |
| `REVIEW_REASON_REQUIRED` | Letting a finding stand or lowering it needs the user's reason |
| `REVIEW_UNKNOWN_FINDING` | Use an id that {{tool:review_run}} or {{tool:review_criteria}} lists |
| `REVIEW_CRITERIA_INVALID` | Fix what `issues` lists and send the standard again |

## Acceptance

- The verdict you report is from a {{tool:review_run}} at the video's current revision, after your last edit.
- Every critical finding is fixed, or the user let it stand with a reason you did not supply for them.
- Questions are answered with evidence you actually looked at.
