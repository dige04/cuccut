---
name: cuccut
description: A guide for tests - transcribe, translate, edit and export videos with CucCut.
---

# CucCut

Use it when there is media to transcribe, translate, edit or export.

## Start

<!-- surface: cli -->
1. Find the CLI: `cuccut` on PATH, or `CUCCUT_CLI`. Details in [start](references/start.md); for MCP see [mcp](references/mcp.md).
2. `cuccut version`; on exit code 3 ask the user to update, and do not work around it.
3. `cuccut status` shows what this machine can do.
<!-- /surface -->
<!-- surface: agent -->
The tools are already connected: read one catalog page for the task.
<!-- /surface -->

## Catalog

| Page | What it covers |
| --- | --- |
| [editing](references/catalog/editing.md) | Changes on the timeline |
| [media](references/catalog/media.md) | Assets and frames |

End-to-end recipes are in [workflows](references/workflows.md), how to handle errors is in [conventions](references/conventions.md#what-to-do-after-an-error-code), and start-up details are in [start](references/start.md).

## Hard rules

- Do text work yourself: first {{tool:documents_read}}, then write the translation back with {{tool:documents_put}}; do not configure a text model.
- Write truth files only through commands; never touch `video.db`.
<!-- surface: cli -->
- Ask the user before an irreversible command, and add `--yes` only once they agree.
<!-- /surface -->
<!-- surface: agent -->
- Ask the user before an irreversible operation, and do it only once they agree.
<!-- /surface -->
- On a revision conflict, run {{tool:videos_inspect}} again, then submit with the new {{arg:revision}} (the field is written `{{arg:expectedRevision}}`).
- For how to polish, see {{skill:demo-polish}}.

What a call looks like:

```text
{{tool:edits_apply}} {{arg:expectedRevision}} 12
```

## Delivery

Report what changed, the real paths of the outputs, what the user still has to review and what was not verified.
