# slides-runtime

The runtime for the slide editor: the deck document model, the HTML compiler, the editor UI, presentation mode and PPTX / PDF / HTML export. The implementation is adapted from Claude Slides. `apps/slides-editor` builds it into the editor page and into the compiler used in Node (`slides_check`). Host capabilities are provided by the shim in `packages/slides`. For the design, see [Slides design §3, §4](../../docs/design/slides/slides-design.md#3-runtime-placement-and-build).

## Structure

Modules are installed in two phases. Each module exports `install<Name>(runtime)`, which first registers its functions and mutable bindings with `bindRuntimeValue`. The initializer it returns then runs in a fixed order. Modules reach each other only through `runtime.<name>`. The runtime imports only `"../bindings"` (types from other modules may be imported with `import type`). The install order is set in `index.ts`. `createSlidesRuntime({ boot: false })` installs the modules without mounting the UI, and the compiler uses this path.

Types: no `any`. Each module declares, at the top level of its own file, `declare module "../bindings" { interface RuntimeBindings { … } }` for the bindings it registers, so other modules that read `runtime.<name>` get types. A name that was never declared reads as `unknown` and must be declared before use. `bindRuntimeValue` is generic, and the registry checks that the local variable matches the declaration. Apart from this, no type augmentation is done: the root `tsconfig.json` checks all packages at once, and adding declarations for `react` or for globals would affect other packages. For inline styles with `--variables`, use `CssVariableStyle` from `bindings.ts`. Type fixes may change only types: the JS after type stripping must match the JS from before the change, and the `assets/index-*.js` filenames (with their hashes) produced by the editor page build must not change.

| Path | Contents |
| --- | --- |
| `index.ts`, `bindings.ts`, `module-interop.ts` | Entry point and install order, binding table, CommonJS / ESM interop |
| `deck-contracts.ts`, `globals.d.ts` | Types for documents, nodes and the file protocol; page globals (`slidesHost` etc.) |
| `boot/` | Startup: chooses file mode or legacy mode based on the capabilities the page declares |
| `model/`, `layout/` | Node normalization, styles, geometry, editing operations and snapping |
| `compiler/`, `serialization/` | HTML / CSS subset parsing, diagnostics, serialization and rich text |
| `rendering/`, `media/`, `embeds/`, `fonts/` | React rendering, images and video, embeds, font catalog and loading |
| `editor/`, `ui/`, `design-system/` | Canvas, selection, sidebar, property controls, menus and dialogs; design system |
| `presentation/`, `creation/` | Presentation mode and transitions; the progress screen while the agent generates a deck |
| `files/`, `documents/` | File read/write, save queue, concurrent editing, conflicts and recovery |
| `host/`, `bridge/`, `comments/`, `collaboration/`, `environment/` | Host capabilities, frame protocol, comment anchors, collaboration; runtime environment and links |
| `export/`, `delivery/` | PPTX / PDF / HTML export; export dialog and handing the file to the host to save |
| `third-party/` | Adapters for npm libraries |
| `app.css` | Styles for the editor UI (including the inlined icon font) |
| `patches/` | Application extensions for PptxGenJS 3.12.0, applied at build time (see below) |

## Host and platform

- **Host interface**: the runtime reads host capabilities from `globalThis.slidesHost` (types are in `packages/slides/src/editor/slides-host.ts`). Functions related to host capabilities are named with the `Host*` prefix. The agent cursor, session and activity are named with the `Agent*` prefix.
- **External sources are not trusted**: the origin allowlist for the parent window, the domains and app schemes that links may open, and the allowed hosts for the design system are all empty. The desktop app detects Electron.
- **No reporting**: there is no usage analytics or health-diagnostics reporting.
- **Export**: PPTX, PDF and HTML are only handed to the host to save as files. There is no feature to send them to a cloud document service. The “Google Slides compatible fonts” option in PPTX export only rewrites font names.
- **Fonts**: no brand fonts are bundled. The sans-serif default for the `anthropic` theme is `system-ui`. `theme: "anthropic"` and `font: "anthropic"` are values of the deck format.
- **Copy**: in the UI, the agent is called “the agent”.
- **Page template**: `apps/slides-editor/index.html`.

## CucCut behaviour

Lines marked with a `CucCut:` comment in the code:

- **Slides panel** (`editor/app.ts`): the editor sits in a sidebar tab with adjustable width, which may be narrow when first mounted. Until the user opens or closes the slides panel by hand, it opens and closes with the viewport size.
- **Comment position labels** (`comments/labels.ts`): when building a `label`, the words for page number, text role, element kind and region position are requested from the host's `slidesHost.commentLabels`, so they follow CucCut's UI language. If the host does not provide them, English is used. The `detail` meant for the agent stays in English.
- **Prompt handed to the session** (`host/agent-session.ts`): when `chat.suggestPrompt` succeeds, it reports `"staged"` (the prompt was placed in the session's input box for the user to send). The UI message is 「已加进给智能体的消息」 (“message added for the agent”).

## PptxGenJS extensions

The PptxGenJS build used by the runtime has 25 extensions (gradients, tiled fills, rounded image corners, placeholder inheritance, custom themes and slide masters, and so on), recorded in `patches/pptxgenjs-3.12.0.json`. `patches/pptxgenjs.mjs` rewrites the distribution files it reads (`pptxgen.es.js`, `pptxgen.cjs.js`) at build time. It first checks the version and SHA-256, and raises an error on a mismatch. The Vite and esbuild plugins of `apps/slides-editor` call it. It does not modify `node_modules` and does not rely on install scripts.

## Third-party code and assets shipped with the package

- `media/video-worker.ts` embeds a compiled mediabunny 1.27.3 (MPL-2.0) as a string and keeps its original license header. See [`THIRD_PARTY_NOTICES.md`](../../THIRD_PARTY_NOTICES.md) at the repository root.
- `app.css` is inlined, and the icon font in `fonts/` is not the S2 icons the repository convention specifies ([repository convention §4](../../docs/repo-conventions.md#4-interface-icons)). It will be replaced later.

## Verification

```bash
node apps/slides-editor/build.mjs --force
```

```bash
npm run typecheck
```

```bash
npx vitest run packages/slides
```

After a change, open a deck in the web or desktop app and go through editing, saving, commenting and sending.
