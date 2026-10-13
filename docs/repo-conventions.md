# Repository conventions

Where code lives and how files are named. Module responsibilities and dependency direction are in [Architecture design §13.1](architecture/architecture-design.md#131-target-directory-layout); this document covers only the rules that apply inside the repository.

## Contents

- [1. Top-level directories](#1-top-level-directories)
- [2. Placement rules](#2-placement-rules)
- [3. Naming](#3-naming)
- [4. Interface icons](#4-interface-icons)
- [5. Copy and multilingual support](#5-copy-and-multilingual-support)

## 1. Top-level directories

Organize by responsibility, not by language or frontend/backend: do not create directories such as `frontend/`, `backend/`, or `rust/`.

| Directory | Contents |
| --- | --- |
| `apps/` | Runnable programs: `desktop` (Electron), `runtime` (Runtime process), `cli` |
| `packages/` | TypeScript packages, split by domain |
| `crates/` | Rust crates, split by domain; Worker processes (such as `engine-host`) are also binary crates here |
| `bindings/` | TS ↔ Rust boundary entry points, such as the editor preview WASM (`preview-wasm`) and the editing-semantics WASM shared by the UI and Node (`editor-wasm`) |
| `tools/` | Build and code-generation scripts, invoked from the scripts in the root `package.json` |
| `scripts/` | Archived one-off scripts (data migrations, imports), one subdirectory per task, each with its own `README.md` and `tsconfig.json`; not referenced by product code, and not part of the workspace or release artifacts |
| `docs/` | Product, architecture and specification docs; see [docs/README.md](README.md) |
| `designs/` | UI prototypes, self-contained, with their own `AGENTS.md` |
| `templates/` | Built-in creation templates shipped with the app, one directory per template; format in the [template package spec](spec/template-spec.md) |
| `skills/` | The “how to use CucCut” guide (`cuccut/`, the CucCut skill) is the entry point and ships with the CLI and the desktop app; one source renders to both the CLI surface and the tool-bridge surface. The built-in Agent skills shipped with the app (craft, i.e. method) live under it in `cuccut/built-in-skills/`, one directory per skill, loaded by the Runtime as a built-in catalog; the index is in [there](../skills/cuccut/built-in-skills/README.md). The craft copy in the guide (`cuccut/references/craft/`) is synced from it by `tools/sync-agent-skill.ts` and must not be edited by hand. See [`skills/README.md`](../skills/README.md), [Architecture design §3.8](architecture/architecture-design.md) and [Agent surface design §8](design/agent-surface/agent-surface-design.md#8-cuccut-skill) |

Two workspaces coexist, each managing its own dependencies:

- npm workspaces (root `package.json`) include `apps/*` and `packages/*`;
- the Cargo workspace (root `Cargo.toml`) includes `crates/*` and `bindings/*`; build output defaults to `target/` at the root. On your machine you can set `build.target-dir` in the uncommitted `.cargo/config.local.toml` to move it to an external drive (template: `.cargo/config.local.toml.example`).

## 2. Placement rules

- **Keep apps thin**: `apps/` handles only process lifecycle, windows, wiring and argument parsing; business logic goes into `packages/` or `crates/`.
- **Split by domain, not by code type**: do not create packages or directories such as `utils`, `common` or `helpers`; files inside a package are also named after their domain (`seek.ts`, `video-store.ts`), not `utils.ts`, `types.ts` or `manager.rs`.
- **Reference only through public entry points**: a package's public interface is declared by the `exports` field in its `package.json`, with the entry at `src/index.ts`. Other packages may import only `@cuccut/<name>` or subpaths declared in `exports` (such as `@cuccut/protocol/schemas`); they must not import `@cuccut/<name>/src/...`, and they must not use relative paths to import across packages.
- **TypeScript does not touch Rust internals directly**: it goes only through the `bindings/` entry points (WASM), or through the Worker process's IPC (such as the stdio JSON lines of `engine-host`).
- **No dependency cycles**; the direction follows Architecture design §13.1.
- **Keep tests next to the code**: TypeScript unit tests sit in the same directory as the file under test (`seek.test.ts` beside `seek.ts`); Rust integration tests go in the crate's `tests/`, and fixtures go in `tests/fixtures/`.
- **Generated files stay out of git**: build output (such as `packages/ui/src/render/generated/`) goes in `.gitignore` and is produced by scripts in `tools/`. The update manifest for verified release artifacts is a version pin; the exception is committed to `apps/desktop/releases/` and updated only after public archive acceptance. Release skills used by development agents go in `.agents/skills/`, not in `skills/` (which the Runtime loads) or in app resources.
- **Data files shipped with the app are not located by module-relative paths**: the Runtime and the main process are bundled into `apps/desktop/out/main/`, so `new URL('../x', import.meta.url)` and `__dirname` point to the bundle's location; in the packaged app that location is inside the asar archive (child processes cannot read it by path). Data read by path needs a single resolver function that checks, in order: an environment variable, the packaged `<resources>/<dir>`, and walking up from the module to the source directory in the repository. The main process tells the Runtime the packaged location through environment variables. The existing ones are: built-in templates (`CUCCUT_TEMPLATES_DIR`), built-in Agent skills (`CUCCUT_SKILLS_DIR`), the web client (`CUCCUT_WEB_DIST`), the slides editor (`CUCCUT_SLIDES_EDITOR_DIST`), and model data `packages/models/assets` (`CUCCUT_MODEL_ASSETS_DIR`; packaged as `<resources>/model-assets`). Native programs shipped with the app (the Worker and the credential helper) work the same way, located via `findBundledBinary` in `process-host`: `CUCCUT_BIN_DIR` (packaged as `<resources>/bin`, with `.exe` on Windows); in development it falls back to the cargo output directory. The layout under `<resources>` is defined only in `apps/desktop/src/main/packaged-resources.ts` and is shared by the main process, the packaging scripts and the artifact self-check. When adding such a file, put it in an existing directory or add a new one the same way, and make sure a build-artifact check such as `npm run check:model-assets` covers it. Data that can be `import`ed (JSON) is bundled directly.

Adding a module:

- TypeScript package: `packages/<name>/`, package name `@cuccut/<name>`, entry `src/index.ts`. The root `tsconfig.json` and `vitest.config.ts` already include `packages/*/src`.
- Rust crate: `crates/<name>/`; `version`, `edition`, `license-file` and `publish` inherit with `workspace = true`. When other crates depend on it, register its path in `[workspace.dependencies]` in the root `Cargo.toml`. The workspace members are a wildcard, so nothing else needs changing.

## 3. Naming

- **Files and directories are always lowercase-dashed**: all lowercase, with words separated by `-`. React component files follow the same rule: `media-panel.tsx` exports `MediaPanel`. CSS, Markdown docs and scripts follow the same rule.
- **Names correspond one to one**: a directory name is the package name or crate name. `packages/runtime-core` is `@cuccut/runtime-core`; `crates/render-graph` is the crate `render-graph` (written `render_graph` in Rust code).
- **Test files**: TypeScript uses `<tested-file-name>.test.ts`; Rust integration tests are named after the behaviour they test (`tests/time_model.rs`).
- **Code identifiers** follow each language's conventions: TypeScript types and components use PascalCase, functions and variables use camelCase; Rust follows the default style of rustfmt and clippy.
- **Internal names are in English**: variables, functions, types, object keys, and the enum values, category values, statuses, error codes and benchmark result keys that code refers to must use stable English identifiers. Human-facing names and descriptions are stored separately and handled per §5. Control logic branches on identifiers or structured error types, never on matching Chinese or other localized text. Language-processing word lists, parsing keywords, language self-names, user content and third-party raw data stay as they are.
- **Terms**: use one word per concept; see the [glossary](glossary.md).

Exceptions:

- Rust module files and test files use snake_case (`time_model.rs`); this is a language rule. Crate directories and crate names still use dashes.
- File names mandated by tooling stay as they are: `README.md`, `AGENTS.md`, `Cargo.toml`, `Cargo.lock`, `package.json`, `tsconfig.json`, `*.config.ts`, `*.d.ts`.
- `designs/` contains prototypes and follows its own conventions.

## 4. Interface icons

Visual rules follow [Product design §2.1](product/product-design.md#icon-sizes-and-semantics). The prototype and Electron are implemented in sync: only the app Rail (and icon blocks) uses 20px; workflow icons in body text, page sidebars (including New session), menus and popovers outside the Rail are always 16px. Title-bar shell icons (sidebar toggle, tabs, full view, session summary) take the original S2 icon per Product design §2.1, or are drawn by hand on S2's 20-grid (1.5px stroke; the expanding-panel icon uses a square outer frame). They are displayed at 16px and centred in a 32px square button. The prototype's graphics are in `designs/cuccut/assets/shell/` (sources recorded in `provenance.json` in the same directory). Electron and the web client use a byte-identical copy in `packages/ui/src/components/shell-icons/` (checked by the prototype's `icon-sync.test.js`), rendered as CSS masks by `shell-icons.tsx`. New session uses S2 `AddCircle`; the Space entry uses `Asset`.

- Electron's shared UI lives in `packages/ui`. `src/app.css` normalises workflow icons outside the Rail to 16px by their traits (`role="img"`, 20 × 20 viewBox), without per-container declarations. The Rail and icon blocks are marked on their container with `data-bc-icons="primary"` (20px). UI graphics that must keep their own size, large graphics and type previews are marked `data-bc-icons="own"` on the icon or container. When a popover is rendered through a portal, the marker goes on the actual content container.
- The prototype uses tokens with the same names (source: `designs/cuccut/_ds/adobe-spectrum-2/tokens/artboard-tokens.css`); component scope is centralised in `app/spectrum.css`. After updating, rebuild the prototype's generated output.
- Do not depend on S2's hashed class names, do not derive workflow icon sizes from text font size, and do not add new size steps such as 18px or 21px page by page. Workspace tab type icons are also fixed at 16px.
- Keep the icon canvas and the button hit area separate. UI arrows, check marks, illustrations, thumbnails and video content do not take workflow sizes; keep their original paths and viewBox.
- After changing sizes, check the prototype and Electron's Home, Space and Settings together. Measure the SVG's actual width and height, and check the New entry, menus, lists, popovers and keyboard focus.

## 5. Copy and multilingual support

Human-facing text (UI, errors and task descriptions emitted by the Runtime, CLI output, desktop menus and dialogs) is not hard-coded; it is fetched for the current language. The shipping languages are in `LOCALES` from `@cuccut/protocol` (the order is the order of the language list in Settings › General); English is the default and the fallback. The system language maps by primary language to a shipping language: Chinese is split into Simplified and Traditional by script and region (`Hant`, Taiwan, Hong Kong and Macau map to Traditional), and all Portuguese maps to `pt-BR`. For where language preference is stored, see [Architecture design §5.10](architecture/architecture-design.md#510-preferences); for terminology, see the [glossary](glossary.md#english-ui-terms).

- **UI copy catalogs**: one `<module>-copy.ts` per module. English is written inside it and exported via `defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, … })`. Translations go in a sibling `<module>-copy.<language>.ts`; the export name is the camelCase form of the language code (`zhHans`, `zhHant`, `ja`, `ptBR`). Use `import type` to type-annotate against the English catalog; a missing key, an extra key, or a missing shipping language is a type error. Adding a language means adding `*.<language>.ts` to every catalog, wiring it into `defineMessages` / `defineCatalog`, and registering it in `LOCALES`. Temporary catalogs in tests use `partialTranslations({ 'zh-Hans': … })`; languages that are missing fall back to English at runtime. Reference: `packages/ui/src/components/settings/general-settings-copy.ts`.
- **Read at the point of use**: each property read on a catalog object returns the current language, so read it while rendering or calling (`M.title`, `M.count(n)`). Do not read it at module top level into a constant, a default parameter or a store. To keep an old named export, use `live(() => M.x)`; to reference another catalog from an object literal, use a getter.
- **Word order and plurals**: sentences with variables are written as function entries, and each language assembles them itself; callers do not concatenate fragments. For languages with several plural forms, use `pluralForm('<language>', n, { one, few, many, other })` (which picks the word form per `Intl.PluralRules`). Numbers, dates and sorting use `Intl.*` and `localeCompare(…, intlLocale())`.
- **Runtime text**: text the Runtime emits, writes to disk or sends over the wire is produced with `defineCatalog('<area>', en, { 'zh-Hans': zh })` as `Localized` (text plus reference). This includes UI text that commands write into the video, such as the edit-transaction label `EditLabel`, whose catalog is in `messages/ui/`. Catalogs go in `packages/protocol/src/messages/<package>/` and must be registered in that directory's `index.ts`, so that the UI and CLI can regenerate. Next to a text-bearing field `foo`, put `fooRef?: MessageRef`; it is stored and sent over the wire with the text. The UI displays it with `localizeText(foo, fooRef)`. Errors use `new RpcError(code, M.x({...}))`; the reference travels over the wire as `messageRef`. Third-party quotes and file names are passed unchanged as string parameters.
- **Rust text**: human-facing text from the Worker and engine uses `msg!("<area>.<name>", "English template {param}", param…)` from the `message-ref` crate, producing English default text and a reference (`Text`); error bodies carry `messageRef`. Translations live only in `packages/protocol/src/messages/<crate>/`, and the English entries match the Rust templates exactly. `node tools/rust-messages.mjs` lists all keys; `tools/rust-messages.test.ts` checks registration, English text and parameters. Language-processing rules (punctuation, line breaking) and developer logs do not go through catalogs.
- **Not translated**: prompts and tool descriptions for models, parsing keywords, language self-names, and content written by users and models. Mark these lines with `// i18n-ignore: <reason>` (applies to that line and the next); mark a block with `i18n-ignore-start` / `i18n-ignore-end`; for a whole file, write `i18n-ignore-file` in the first 20 lines.
- **Check**: `node tools/i18n-scan.mjs [paths…]` lists Chinese in code, strings and JSX that is not yet in a catalog (comments, regexes, tests and translation files are excluded); the test suite has the same gate. Tests run by default under `CUCCUT_LOCALE=zh-Hans` (`vitest.config.ts`), so existing Chinese assertions stay as they are. To test English, use `vi.stubEnv('CUCCUT_LOCALE', 'en')` and then `setLocale`.
