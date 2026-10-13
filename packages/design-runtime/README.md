# design-runtime

The runtime of the design (canvas) editor: canvas and artboards, property editing, preview document building, the artboard runtime, injected scripts, the fast-edit Worker, and export. The source is a 1:1 port of the TypeScript rebuild of the Claude Design type (`src/design-type`). The file formats (`canvas.json` v3, `*.dc.html`, `support.js` / `dc-runtime.js`, the fast-edit Worker, the `/_blob/<id>` assets), the UI, the behaviour and the module structure are all unchanged. Only the parts CucCut's hosting requires are changed, and each change is marked with a `CucCut:` comment (see below). `apps/design-editor` packages it as the editor page, and the host capabilities are provided by the shim in `packages/design`. For user-visible behaviour, see [product design §3.3](../../docs/product/product-design.md#33-feature-area-ux-07).

## Structure

Modules are installed in two phases: each module exports `install<Name>(runtime)`, which first registers its functions and mutable bindings, and the initialisation function it returns is then run in a fixed order. Modules reach each other only through `runtime.<name>`. The install order is in `app-runtime.ts`, and `createDesignRuntime()` mounts the UI after all modules are installed.

Types: the original project's `Dynamic` (that is, `any`) is kept, and types are not added across the whole codebase. The root `tsconfig.json` checks all packages at once, so no global or `react` type augmentations are added. The original project's `react-css.d.ts` (which adds `--variable` to `CSSProperties`) was not carried over; the inline styles in the runtime are already `Dynamic`, so it is not needed. `env.d.ts` is added by CucCut and pulls in `vite/client` for the `?raw` imports (the original wrote this in its own tsconfig). `application/design-bootstrap.tsx` has one `@ts-expect-error`: TS judges the original expression `x ?? null` to be always nullish (TS2871), so the expression is kept as it was.

| Path | Contents |
| --- | --- |
| `app-runtime.ts`, `dependencies.tsx`, `module-helpers.ts` | Entry point and install order; registration of npm dependencies and of the `generated/` script text; CommonJS / ESM interop |
| `runtime-types.ts`, `runtime-contracts.ts`, `ui-runtime-contracts.ts`, `types.ts`, `globals.d.ts`, `contracts/` | Binding table and the protocol types between modules; page globals |
| `application/`, `bootstrap/` | Startup, the design root node and the cover; follows the system light/dark mode |
| `canvas/`, `editor/`, `properties/`, `geometry/`, `find/` | Canvas, artboards, selection, sidebar, property panel, snapping and transforms, find |
| `preview/`, `scripts/` | The artboard's preview document (dependency graph, module cache, CSS and asset rewriting); the scripts injected into artboards (preview bridge, storage, XHR / fetch, screenshots, property dragging, etc.) |
| `runtime/` | The artboard runtime, built into `dc-runtime.js`, and `support.js` for exported files (React 18; Babel is loaded on demand and not bundled) |
| `fast-edit/`, `worker/` | Fast edit: controller, drafts, logs; the happy-dom Worker (`fast-edit-worker.js`) |
| `platform/` | Host capabilities, file reading and writing and publishing, external changes, the frame protocol, permissions, reporting (switched off) |
| `comments/`, `collaboration/` | Comment anchors and regions; online multi-user cursors and selections (these do not appear with a single user) |
| `design-system/` | The design systems referenced by a design: the installed list, tokens and font resolution |
| `export/`, `assets/`, `thumbnail/` | HTML / PDF / image / archive export; image placement; thumbnails |
| `cds/` | The original platform's component library (theme, popovers, forms, icons) |
| `app.css` | Styles for the editor UI (including the inlined icon font) |
| `generated/` | Build output, not in git: the script text that `apps/design-editor/build.mjs` builds with esbuild; `dependencies.tsx` imports it with `?raw` |
| `tools/worker-browser-plugin.mjs` | When the Worker is built, swaps Node built-in modules for browser adapters (the original project's plugin of the same name) |

## Host and platform

The code marks these changes with `CucCut:` comments. Changes to the page template `apps/design-editor/index.html` are described in the comment at its top.

- **Host interface**: the runtime reads host capabilities from `globalThis.designHost`; the original runtime read `globalThis.claude`. Every read site and the error messages that mention it have been changed. The host object is installed by `installDesignEditorHost()` in `packages/design/src/editor`, which reuses `connectEditorHost` from `@cuccut/slides/editor`. For which capabilities are provided, and how the runtime falls back when one is missing, see `packages/design/src/editor/design-host.ts`.
- **Fixed feature flags**: the page template installs `__appifact_flags` with fixed values and does not ask the host. Fast edit is off (no `sample` is provided), confirmation before pasting across canvases is on, and everything else is the default the runtime uses when it reads a flag. The health reporter `__appifact_health` is not installed.
- **Capability declarations**: the page's `appifact-capabilities` has `room`, `sample` and `flags` removed; the runtime reads only `db` and `downloads` from it.
- **Untrusted external sources**: the parent window's origin allowlist is empty (`platform/design-source.tsx`, `platform/frame-host-bridge.tsx`). The frame protocol also accepts `__FRAME_PREAMBLE.trustParent`, which trusts only `window.parent` itself and replies with `"*"` (on the desktop the parent page is `file://`, whose origin is `null`). The `packages/design` shim declares it inside CucCut's iframe, and CucCut uses it to drive the whole export (see [product design §3.3](../../docs/product/product-design.md#33-feature-area-ux-07)). Links do not allow the original platform's app schemes, editor extensions or domains (`cds/links.tsx`), and designs systems are not installed from hosted addresses (`design-system/install-identifiers.ts`). The desktop detects Electron (`cds/platform/runtime.ts`).
- **No reporting**: there is no usage analytics (`platform/health-and-analytics.ts`).
- **Fonts**: no brand fonts are bundled. Anthropic Sans falls back to the system font (`app.css`), and the page does not preload fonts from `/_runtime/`.
- **Copy**: in the UI the agent is called “the agent”.
- **Page template**: it omits the README comment addressed to the hosting platform, the meta tags and `mega-build-stamp`.
- **Source of Babel**: the runtime loads Babel standalone only when an artboard x-imports JSX. The original fetched it from a CDN, but the editor's CSP does not allow the CDN. The preview document uses `window.__resources` to map the CDN address to the `artifact-type/babel.min.js` bundled with the editor (the page meta `dc-babel-file`, `getBabelFileUrl` in `preview/runtime-loading.ts`, and `preview/build-document.ts`). When a full HTML export needs to inline Babel, it also takes it from this file (`export/asset-resolver.ts`). It is byte-for-byte identical to the file on the CDN, so it passes the export's integrity check.
- **Export size limit**: the runtime hands the host a single export file. The original limit was 16 MB; CucCut raised it to 256 MB, the same as the total file size limit for one design (`export/downloads.tsx`; the save bridge separately caps at 512 MB). The number in the over-limit message follows the limit (`export/html-producer.ts`, `canvas/design-canvas.tsx`).

One point inherited unchanged from `src/design-type`, and different from the live original page:

- The artboard runtime's React 18.3.1 uses the npm aliases `react-18` and `react-dom-18` (declared in `apps/design-editor/package.json`). `dc-runtime.js` bundles their CommonJS builds, the two UMD files are inlined as-is in the page, and on export they are written as `vendor/react.js` and `vendor/react-dom.js`. The editor UI uses the workspace's React 19; the two are not mixed.

## Fixes to the rebuilt code

Several identifiers in the rebuilt code were bound wrongly when restored from the minified code. They were changed back by comparing with the original script, and are marked `CucCut: restorer fix`:

- `scripts/preview-viewport.ts`: calls the saved native `focus` (the original script's `native.call`). The rebuilt code called the wrapper function itself, so focusing an element inside an artboard recursed without end.
- `scripts/preview-storage.ts`: reads the scoped storage `n` (the original script's `real`). The rebuilt code read `length.length` / `length.key` as the loop bound, and listing the keys of artboard storage threw an error.
- `scripts/preview-xhr.ts`: branches on the request's `responseType` (the original script's `rt`). The rebuilt code checked the response text instead, so arraybuffer / blob / json / document were all returned as text. Six places.
- `fast-edit/element-targets.ts`: the click position uses the outer `x` (`click.x`). The rebuilt code compared an element entry against a rectangle, so horizontal child elements inside an artboard never matched.

Two other cases were not wrong bindings and are marked `CucCut: restored from the shipped dc-runtime`. In the rebuilt code, `ensureReactAvailable` in `runtime/boot.ts` was an empty function (on the reasoning that React is bundled from npm). The preview and `dc-runtime.js` in the editor do bundle React, but the exported full HTML inlines React under its CDN address in `window.__resources`, and only this function looks there, so artboards came up blank. It has been restored to the live original: if React is already on the page it is skipped, otherwise the inlined copy is found through `resolveScriptResource` and loaded.

`ensureBabel` in `runtime/resources.tsx` was also restored to the live original. The rebuilt code bundled npm's `@babel/standalone` 7.29.0 into the artboard runtime (`dc-runtime.js` about 7.2 MB, `support.js` about 6.1 MB, and the exported full HTML carried one copy per artboard, so about 7 artboards exceeded 16 MB). The original loads it only when an artboard x-imports JSX: if Babel is already on the page it is skipped, otherwise the mapped copy is found through `resolveScriptResource` (and if there is no mapping, the CDN address is used). After the restoration, `dc-runtime.js` is about 1.2 MB and `support.js` about 0.1 MB, and Babel becomes a separate `artifact-type/babel.min.js` (about 3.1 MB). A full HTML export embeds one copy only when an artboard x-imports JSX.

How this was checked: `noUnusedLocals` was used to find unused local variables (a lost binding often leaves one behind). Then Babel was used to compute a structural fingerprint of each function in the live original page's `app.js` and in our bundled output (local variables numbered in order of appearance, free variables folded into one class), to find pairs of functions that are structurally identical and differ only in their bindings. The main page originally had 20463 functions, of which 19111 matched exactly. The rest that differ only in bindings all fall within the dependencies (Base UI, and the ReactDOM versions differ from the live site). The differences in the injected scripts, `dc-runtime.js` and the Worker are only in how they are bundled. The 1019 innermost functions whose structure differs were not reviewed one by one, and the internal property names in `scripts/property-scrubber.ts` were renamed during the rebuild. Both are residual risks.

## Bundled third-party code and assets

- The npm packages bundled into the page, the artboard runtime, the injected scripts and the Worker (including React 18, happy-dom, jQuery and dom-to-svg), and Babel standalone, which is shipped as-is, have their licences collected according to the modules actually bundled. See the “Design editor” section of the root [`THIRD_PARTY_NOTICES.md`](../../THIRD_PARTY_NOTICES.md) and `apps/design-editor/licenses.mjs`.
- The icon font inlined in `app.css` (Anthropicons) was carried over with the styles as-is. It is not the S2 icon set that the repository convention uses ([repository conventions §4](../../docs/repo-conventions.md#4-interface-icons)), and it will be replaced later. Its distribution licence is also still to be confirmed.
- Dependency versions are aligned with the original project or with the workspace: Base UI 1.6.0 and `@babel/standalone` 7.29.0 are the same as in the original project; React 19 and TanStack Virtual use the workspace versions; postcss is 8.5.28 (the original project has 8.5.29), so the screenshot script `svg-capture.js` differs byte-for-byte from the original.
- The editor sends `__frame_claude_activity_ask` to the parent window (`platform/claude-activity.tsx`). CucCut does not handle it, and it is harmless.

## Verification

```bash
node apps/design-editor/build.mjs --force
```

```bash
npm run typecheck
```

```bash
npx vitest run tools/third-party-notices.test.ts apps/desktop/src/main/packaged-resources.test.ts apps/cli/src/runtime/connection.test.ts
```

After a change, open a design in the Web or desktop app and go through selection, text editing, save and reload, pasting an image, annotations and export.
