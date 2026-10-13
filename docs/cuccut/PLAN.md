# CucCut — plan and status

CucCut is an agentic video editor: a desktop app (Electron) over a local Runtime with a Rust/WASM video engine, an
agent harness for the coding agents people already use (Claude Code, Codex, Copilot, OpenCode, Pi, ACP), model
providers, a CLI, an MCP server and a browser client. Its UI follows agentcut's Liquid Glass design: dark only,
Figtree, a yellow accent, glass navigation; a home composer with *Create a video* / *Clip a long video*; an editor
with assets on the left, preview and timeline in the centre, the selection inspector and the chat on the right; and
a workspace settings shell.

## Milestones

| # | Milestone | Status |
|---|---|---|
| M0 | Foundation: theme pipeline (palette remap, dark only, Figtree, S2 shim), Tailwind + agentcut-style primitives in `packages/ui/src/cc`, product identity (`@cuccut/*` packages, `CUCCUT_*` env, `~/.cuccut`, `com.cuccut.app`), QC screenshot tool | done |
| M1 | Shell and screens in agentcut's layout: page chrome (glass nav bar, back headers, ambient background), home landing, session/editor layout, settings shell, library/tasks/tools pages, S2 control styling, chat thread | done (follow-ups: one yellow primary per view, "Space" → "Library" in remaining copy, recent-row actions) |
| M2 | Modules: profile + onboarding interview + rules in agent instructions, clip a long video (scored candidates), packs, review gate before delivery, publishing calendar | planned |
| M3 | Vietnamese: filler words and pauses for `vi` (done), agent-facing text in English (done), copy QA, remaining Chinese code comments | in progress |
| M4 | QC: typecheck, tests, packaged app (`npm run package:mac -- --local`) installed and exercised in a clean macOS VM (tart on the SSD) | planned |

## Decisions

- **Restyle S2 rather than rewrite it**: `tools/cuccut-theme.ts` rewrites every colour S2 and the style macros emit
  (dark branch only, neutrals → agentcut ramp, blue → yellow); S2 accent buttons become agentcut's tinted primary
  through `theme/s2.tsx` + `theme/cuccut.css`.
- **Build the shell with agentcut-style primitives** (Tailwind v4, Base UI, cva, lucide) so the first things people
  see match agentcut; feature panels keep S2 inside those shells.
- **Own identity**: data in `~/.cuccut`, projects in `~/CucCut`, bundle id `com.cuccut.app`, CLI `cuccut`, MCP
  server `cuccut`, package scope `@cuccut/*`.
- Licensing and attributions: `LICENSE` and `NOTICE` (kept verbatim; CucCut is a personal/internal build, not for
  commercial distribution).
