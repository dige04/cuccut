# skills

The manual for “How to use CucCut” (the CucCut skill): it teaches the agent when to use CucCut, how to start it, which tool to use for each kind of task, the hard rules, and how to deliver. It is the entry point. CucCut's built-in approaches (craft) sit beneath it in [`cuccut/built-in-skills/`](cuccut/built-in-skills/README.md), whose README indexes all built-in skills. Design: [Agent capability surface design §8](../docs/design/agent-surface/agent-surface-design.md#8-cuccut-skill).

```text
skills/
  cuccut/
    SKILL.md              entry: when to use it and the three bottom lines, startup, capability catalog and reading discipline (including a one-line index of built-in skills), orchestration, hard rules, delivery
    references/
      start.md            finding the CLI, version gate, status preflight, where the Runtime belongs
      conventions.md      output and exit codes, error objects, version conflicts, waiting for tasks, large results, time and IDs
      catalog/*.md        task-based catalog pages: media, subtitles, editing, voice, music, export, models, system, web (web gives the CLI surface only)
                          voice reference is split into voice-language-rates.md and voice-<model-family>.md, referenced by voice and craft
      workflows.md        end-to-end approaches
      mcp.md              how to connect via MCP, tool-name mapping, differences
      craft/              approaches synced from built-in-skills/<id>/, for the CLI surface (generated, not handwritten)
    built-in-skills/      source of built-in skills (craft): one skill per directory, README.md is the index; the Runtime loads from here
```

## Manual and built-in skills

| | `cuccut/built-in-skills/<id>/` | `cuccut/` (excluding `built-in-skills/`) |
| --- | --- | --- |
| What it is | craft: one approach (polishing, translation, chaptering, cutting spoken narration…) | How to use CucCut: mechanics, catalog, hard rules, delivery |
| Single source | Yes | Yes; craft only references it and does not copy the body |
| For whom | Agents in the session load it directly; external agents read synced copies | Two kinds of readers; the same text is rendered per surface |

The Runtime loads only `cuccut/built-in-skills/` as the built-in skill directory, so the manual itself is never read as a craft. When the renderer reads the manual it skips `built-in-skills/`; that directory does not enter either surface's output and is not installed into a host by `cuccut skill install` (external agents read the copies in `cuccut/references/craft/`). The routing in SKILL.md section 1 and the “built-in skills” table at the end of section 3 use `{{skill:<id>}}` to point at these crafts. After packaging, the whole `skills/` directory is placed unchanged at `<resources>/skills/`.

## One text, two surfaces

The same body is rendered into two surfaces ([§8.6](../docs/design/agent-surface/agent-surface-design.md#86-one-manual-two-readers)):

- **CLI surface**: external agents (Claude Code, Codex, Cursor, Gemini CLI, etc.) use it through the command line or MCP. `cuccut/` (except `built-in-skills/`) ships with the CLI and the desktop app, and the CLI's install command renders it and copies it into the host's skills directory.
- **Tool-bridge surface**: CucCut's own in-session agent. The Runtime renders it at startup. The body of SKILL.md becomes the “working method” of the session guidance; the catalog pages, workflows and conventions become built-in manual pages (`cuccut-catalog-<page>`, `cuccut-workflows`, `cuccut-conventions`). Pages that sit entirely in a `cli` block and so have an empty tool-bridge body, such as `web`, are not registered. The pages are always in the session's skill index and are read on demand with `skills_read`. If rendering fails, the Runtime fails to start.

## How to edit: markup quick reference

- Do not hard-code any surface's command or tool name; use placeholders:

  | Syntax | CLI surface | Tool-bridge surface |
  | --- | --- | --- |
  | `{{tool:documents_read}}` | `cuccut documents read` | `documents_read` |
  | `{{tool:transcribe}}` (top-level verb) | `cuccut transcribe` | `transcribe` |
  | `{{arg:expectedRevision}}` | `--expected-revision` | `expectedRevision` |
  | `{{skill:polish-transcript}}` | link to `references/craft/polish-transcript.md` | “`polish-transcript` (read with `skills_read`)”; when it directly follows the word “读” (read), it becomes “用 `skills_read` 读 `polish-transcript`” (“read `polish-transcript` with `skills_read`”) |

  Tool names must exist in the catalog (the tool list in `spec`); parameters must be fields of a tool that appears in the same subsection; craft ids must be directory names under `cuccut/built-in-skills/`. Tools that exist only in the session (`downloads_save`) are replaced on the CLI surface with a fallback phrasing that does not name the tool (the renderer's `SESSION_ONLY_TOOLS`).
- A passage that belongs to only one surface is wrapped in `<!-- surface: cli -->` … `<!-- /surface -->` (or `agent`), each on its own line. It may wrap paragraphs, list items, table rows or code blocks, and it does not nest. Unmarked content appears on both surfaces. CLI-specific content (finding the CLI, `runtime`, the version gate, `--yes`, exit codes, `--result-file` and `.cuccut-out/`, the MCP setup), as well as meta commands (`status`, `help`, `spec`, `version`), is written as `cuccut …` directly, only inside `cli` blocks. In-session approval and editor context are written only inside `agent` blocks.
- When adding, removing, renaming or changing the purpose of a built-in skill, sync the routing in SKILL.md section 1, the “built-in skills” table at the end of section 3, and the index in [`cuccut/built-in-skills/README.md`](cuccut/built-in-skills/README.md). `builtin-skills.test.ts` checks the skill ids in the last two tables.
- The hard rules (SKILL.md section 5) must have the same number of entries on both surfaces. When a rule applies to only one surface, write an equivalent entry in each of the `cli` and `agent` blocks.
- The content of generated blocks `<!-- generated: <name> -->` … `<!-- /generated -->` is produced from the catalog by the sync script and is not edited by hand: `common-ops` (editing.md), `error-codes` (conventions.md), `tool-map` (mcp.md).
- Pages link to each other with relative links (`catalog/subtitles.md`, `../conventions.md`), which the renderer rewrites per surface.
- Shared reference tables are maintained in one copy, on the catalog pages only. craft reads `cuccut-catalog-<page>` with `skills_read`; when synced to the CLI surface it becomes a link to that page, and the data is not expanded into the craft appendix. Other catalog pages use relative links directly. Model-specific voice tables use one file per model family, registered as an entry in `voice.md`.
- Writing style follows [§8.7](../docs/design/agent-surface/agent-surface-design.md#87-how-the-manual-is-written): methods (craft, workflows) are layered apart from mechanisms (conventions, catalog). Catalog pages follow: when to use → preflight checks → commands and examples → how to read results → common error codes → next steps → acceptance. Each workflow entry follows: when it applies and when it does not → decision table → steps → completion criteria. Parameters do not repeat flag descriptions; they point to help or the tool description.
- The body of SKILL.md is at most 300 lines, and the `description` in its front matter is at most 300 characters. Catalog pages, `workflows.md` and `conventions.md` also carry front matter with only a `description` (one sentence: what the page covers and when to read it), which serves as that page's description in the session's skill index.
- Write everything in Chinese; the approaches apply to videos in any language and to any target language.
