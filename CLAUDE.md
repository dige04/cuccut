# CucCut

CucCut is an agentic video editor for the desktop: an Electron shell, a local Runtime (Node) that owns projects,
jobs and agents, a Rust/WASM video engine with native workers, an agent harness (Claude Code, Codex, Copilot,
OpenCode, Pi, ACP engines), model providers, a CLI, an MCP server and a browser client. Its UI follows agentcut's
Liquid Glass design (dark only, Figtree, one yellow tint per view). Plan and status: [docs/cuccut/PLAN.md](docs/cuccut/PLAN.md).
[AGENTS.md](AGENTS.md) holds the older engineering rules (in Chinese); the rules below take precedence where they
differ.

## Where things are

- UI: `packages/ui/src`, shared by the desktop renderer (`apps/desktop`) and the web client (`apps/web`).
  - Many panels are built on React Spectrum 2 (S2) components and `style()` macros. Their palette is remapped at
    build time by `tools/cuccut-theme.ts` (dark only, agentcut neutrals, blue accent → yellow). Never hard-code
    Spectrum blue.
  - `import { … } from '@react-spectrum/s2'` resolves to `packages/ui/src/theme/s2.tsx` (Button/ActionButton
    wrappers that add `cc-*` class hooks); their look lives in `packages/ui/src/theme/cuccut.css`.
  - CucCut's own surfaces use agentcut's primitives in `packages/ui/src/cc/ui/*` (Glass, Button, Card, Tabs, Dialog,
    Popover, Select, Switch, …) and `packages/ui/src/cc/components/*` (Ambient, CucCutMark, harness marks), styled
    with Tailwind v4 (`@source` scans `packages/ui/src`). Anything built with them must sit under an element with
    the `data-cc` attribute (scoped preflight).
- Design rules to follow: `docs/cuccut/AGENTCUT-DESIGN.md`; reference screenshots: `docs/cuccut/reference/*.png`.
- Read-only reference material (gitignored): `.reference/agentcut` (the agentcut source, for porting UI and
  modules), `.reference/notes/agentcut-map.md` (its screens, components and modules) and
  `.reference/notes/base-inventory.md` (CucCut's own feature/module map, written before the UI work).

## Rules

1. **Look and behaviour follow agentcut** (`docs/cuccut/AGENTCUT-DESIGN.md`): glass only on the navigation layer,
   never glass on glass, one tinted (yellow) primary action per view, capsules for buttons, 24px cards, 20px
   dialogs, recessed fields, destructive actions act and offer Undo, a disabled control says why.
2. **Keep the engine and data flow.** Keep the Runtime protocol, stores (`packages/ui/src/state`), view-models
   (`packages/ui/src/model`) and commands (`packages/ui/src/runtime`); restructure JSX, do not fork logic. Human UI
   and agent tools keep parity (one command gateway).
3. **Copy is product copy.** User-visible strings go through the copy catalogs (`*-copy.ts` with 15 locales;
   English is the source and Vietnamese `*.vi.ts` must be filled for every new string; other locales may fall back
   to English where the catalog type allows). The product name is "CucCut".
4. Verify UI in pixels: `npm run build:web`, then `node tools/qc-shot.mjs --out <dir> /home /settings/general …`
   (use a distinct `--home` and `--port` per worktree). Read the screenshots and compare with
   `docs/cuccut/reference`.
5. Gates before committing: `npx tsc -p tsconfig.json --noEmit`, `npx vitest run <touched areas>` (full `npm test`
   takes long; run it before merging), and the screenshots above for UI work.
6. Commit messages in English, `type(scope): summary`, ending with the Co-Authored-By line given by the session.
   The repository is CucCut's own; do not describe it as a fork in code, copy or docs. Attribution lives only in
   `LICENSE` and `NOTICE`, which must stay as they are.
