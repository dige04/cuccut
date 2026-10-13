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
| M1 | Shell and screens in agentcut's layout: page chrome (glass nav bar, back headers, ambient background), home landing, session/editor layout, settings shell, library/tasks/tools pages, S2 control styling, chat thread | done (follow-ups done: one yellow action per view, "Library" wording in all locales, Recent-row actions, inspector placement) |
| M2 | Modules: profile + onboarding interview + rules in agent instructions (`m2-profile-rules.md`), packs (`m2-packs.md`), review gate before delivery (`m2-review-gate.md`), publishing calendar and connections (`m2-publishing.md`); each built in its own branch, QC'd in the browser client, reviewed and fixed, then merged. Clip a long video (scored candidates) shipped with M1 | done |
| M3 | Vietnamese: filler words and pauses for `vi`, Vietnamese copy QA, agent-facing text, code comments, engine messages, docs, fixture READMEs, test titles (6,360 in 554 files) and Rust test messages in English; `tools/i18n-scan.mjs` finds no untranslated user-facing Chinese. Chinese data stays (filler words, Chinese captions and transcripts in tests, fixture notes written into goldens); the speech/text crates (`speech-doc`, `model-runtime` text front-ends) were only checked for comments and test messages, since most of their Chinese is data | done |
| M4 | QC: typecheck, tests, packaged app (`npm run package:mac -- --local`) installed and exercised in a clean macOS VM (tart on the SSD) | first pass done (see below) |

## QC record

- 2026-10-13, local package `CucCut-3.4.1-aarch64-apple-darwin-local` (zip + DMG, ad-hoc signed) built from
  756187b. Installed from the DMG into a clean macOS 26.3 VM (tart `cuccut-qc`, fresh user data) and driven through
  CDP: landing, Settings, Library, Tools, Background tasks, Services and "Clip a long video" render with no console
  errors. The runtime starts from the bundle. A fresh install asks to connect a coding agent before clipping. Switching to
  Vietnamese works without a restart.
- 2026-10-14, M2 modules, each on its branch with `npm run build:web` + `tools/qc-shot.mjs` and a seeded Runtime Home
  (`tools/qc-seed-publishing.mjs` for the calendar): Settings › You/Rules/Packs/Review/Publishing, the welcome
  interview, the pack page and import/export, the review dialog, the publication calendar and its dialogs, in English
  and Vietnamese. Then a code review per module (profile 3, review gate 11, packs 9, publishing 10 findings, all
  fixed). After the merges: `tsc` clean, full `vitest` 636 files passing.
- Not covered yet: the editor-side M2 surfaces in pixels (no `engine-host` binary was built for the QC runs),
  native window chrome in pixels (macOS blocks screen capture over SSH without Screen Recording
  permission), agent sessions (no signed-in agent in the VM), exporting a real video in the packaged app.

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
