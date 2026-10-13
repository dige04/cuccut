# design-system-runtime

The runtime for the design system editor: Overview (README document), Colors, Typography, Spacing, Corner radius, Shadows, Border width, Components (component preview), Assets, the Files table, search, and the storage layer that reads and writes a design system directory under `layout: "files"`. The source is a 1:1 port of the TypeScript reconstruction of the original Design System type (`src/design-system-type`). The on-disk format (`design-system.json`, the `_files.json` index, `tokens.json` / `tokens.css`, `components/`, `assets/`, `/_blob/<id>` assets), the interface, the behaviour and the module structure are unchanged. Only the parts CucCut hosting requires are changed, and each change is marked with a `CucCut:` comment (see below). `apps/design-system-editor` packages it as the editor page; host capabilities are provided by the shim in `packages/design-system/src/editor`.

## Structure

The modules are installed in two phases: each module exports `install<Name>(runtime)`, which first registers its functions and mutable bindings with `bindRuntimeValue`; the initialisation functions it returns then run in a fixed order. Modules reach each other only through `runtime.<name>`. The installation order is in `runtime.ts`. After `createDesignSystemRuntime()` has installed the modules, `bootstrap.tsx` mounts the interface.

| Path | Contents |
| --- | --- |
| `runtime.ts`, `bootstrap.tsx`, `dependencies.ts`, `module-helpers.ts` | Entry point and installation order; mounting the interface; registration of npm dependencies; CommonJS / ESM interop |
| `runtime-api.ts`, `runtime-types.ts`, `reviewed-runtime-types.ts`, `inferred-runtime-types.ts`, `npm-runtime-types.ts`, `types.ts`, `contracts.ts`, `contracts/`, `reconstruction/` | The binding table and the protocol types between modules (including the host global `ProtocolGlobal`, `contracts/platform-host.ts`) |
| `files/`, `files/ui/` | Per-file storage: startup and reads, index encoding and decoding, lazy reads, the save queue, external changes, migration (the old single-page storage); the app shell, navigation and search, the file table, the welcome page |
| `editor/` | The editors for each section: the colour palette and contrast, fonts, spacing and corner radius, shadows, component preview (`run.html` runner, swatch runtime), asset groups and uploads, Markdown documents, requests to the agent (`claude-delivery.tsx`, `claude-prompts.ts`), the migration banner |
| `model/` | The design system model: tokens, file policy and classification, component inference, documentation generation (`documentation.ts`, `remote-text.ts`), the library catalogue used for preview (`libraries.ts`), publishing |
| `documents/`, `media/` | Storage for page documents, autosave, self-publishing, write permission; the asset upload capability |
| `host/`, `platform/` | Reading host capabilities, the user, external changes (hot reload), the frame protocol (`frame-bridge.tsx`, `frame-chrome.tsx`) |
| `telemetry/` | Health reporting: the page does not install `__appifact_health`, so nothing is reported when it cannot be read |
| `ui/` | The component library from the original platform (theme, overlays, forms, menus, toasts, icons) |
| `app.css` | Styles for the editor interface (including the inlined icon font) |

The original project's `tests/`, `tools/`, the notes and evidence in `reconstruction/`, `dist/`, the page template and `main.ts` are not moved. The page template and entry point live in `apps/design-system-editor`.

## Types

This reconstruction is fully typed under strict mode (unlike the design-draft runtime, it does not keep `Dynamic`). It is written with the compiler options of the original project, which are incompatible with the options in the root `tsconfig.json` (the root enables `noUncheckedIndexedAccess`, which would report several hundred errors). So it is checked separately: this directory's `tsconfig.json` extends the root config, turns off `noUncheckedIndexedAccess`, and includes `vite/client` (the page entry imports `app.css` as a side effect) and `node`, as the original project did, together with `apps/design-system-editor/src`. The root `tsconfig.json` excludes these two directories, and `npm run typecheck` checks both in turn. `browser.d.ts` is the original project's global declaration (`EyeDropper`) and only appears in this check.

The shim (`packages/design-system/src/editor`) does not declare `designSystemHost` with `declare global`. The runtime's `ProtocolGlobal` already declares it (with the runtime's `ClaudeBridge` type), and two declarations in the same check would conflict. The shim assigns it through `DesignSystemHostWindow`.

## Host and platform

Changes are marked with `CucCut:` comments in the code. Changes to the page template `apps/design-system-editor/index.html` are written in the comment at the top of that file.

- **Host interface**: the runtime reads host capabilities from `globalThis.designSystemHost`; the original runtime read `globalThis.claude`. Apart from the unified entry point `host/claude-capabilities.ts`, there were other places that read it directly, and all of them were changed: `contracts/platform-host.ts`, `contracts/model-core.ts`, `contracts/editor-runtime.ts`, `reviewed-runtime-types.ts`, `host/hot-reload.ts`, `media/assets.ts`, `model/asset-store.ts`, `model/derive-system.ts`, `files/reopen.ts`, `editor/claude-delivery.tsx` (5 places), `documents/storage.ts`, `documents/self-publish.ts`, `files/debug-panel.ts`. Error messages that mention it were also changed. The host object is installed by `installDesignSystemEditorHost()`, which reuses `connectEditorHost` from `@cuccut/slides/editor`. Which capabilities are provided (`artifact`, `self`, `user` (also giving `name()`), `assets`, and `chat` in the session tab) and which are not (`use`, `comments`, `room`, `hot`, `db`, `downloads`, `commentLabels`; the runtime never calls `comments` in any case, and the annotation bridge is handed to the shim's own target layer, `comment-targets.ts`) are described in `packages/design-system/src/editor/design-system-host.ts`.
- **Annotation**: the original does not draw an annotation layer. It only marks targets in the DOM, and the annotation layer belongs to the host. CucCut's parent window cannot read the DOM across origins, so this layer lives in the shim (`packages/design-system/src/editor/comment-targets.ts`). On the runtime side only two things changed. `commentTargetProps` also sets the original name as `data-comment-name` (`editor/comment-anchors.ts`, with the types in `reviewed-runtime-types.ts`), so when a name is shortened and a hash is added, the position label can still show the original name. `files/ui/design-system-app.tsx` listens for `cuccut:reveal-comment-target`; jumping to a target takes the same path as choosing an entry in search (`navigationSearch.onPick`). If the index has no such target, it waits for the given section to show it.
- **Frame protocol**: the parent window's origin allowlist is empty (`DEFAULT_HOST_ORIGINS` in `host/frame-bridge.tsx`). The editor draws its own save status and read-only marker, and does not leave export, save or read-only to the host to draw.
- **Fixed feature flags**: the page template installs `__appifact_flags` with fixed values and does not ask the host for them. `design_system_clean_up_button` takes the original `true`; the others are the defaults the runtime uses when it reads a flag. `__appifact_health` is not installed.
- **Capability declaration**: the page's `appifact-capabilities` drops `room`. The runtime reads only `db` (to decide how storage works) and `downloads` (whether downloads are declared).
- **No reporting**: the usage analytics in the migration banner are not sent (`editor/migration-banners.tsx` does not send `__frame_cap` to the parent window).
- **Prompts**: the original refers to this design system by its page address (`artifactPageAddress()`). CucCut's page address carries a grant, which is useless to the agent, so it is replaced by the design system directory path given by the page's `path` parameter (wrapped in backticks, with control characters and backticks replaced by `?`; when there is none, it says “this design system”). The function signature is unchanged (`editor/claude-prompts.ts`). Wording that refers to the original platform's skills, the `artifact-type/` files and the Artifact tool is changed to CucCut's skill `design-system` (`SKILL.md` and `references/`) and to files in the working directory. This applies to `editor/claude-prompts.ts` (from-code, the empty-system Build from connectors / Sync from GitHub, the contrast fix, drafting after upload, token changes), `editor/migration-banners.tsx` (the cleanup prompt for Finish the migration, with the address as above; `isArtifactAddress` now recognises a path wrapped in backticks), `model/documentation.ts` (assets and fonts are in `_blobs/`, how consumers reference them, the writing guidance is the skill), and `model/remote-text.ts` (3 places, no Artifact tool).
- **Delivery status**: CucCut does not provide `room` or `comments.sendToClaude`. Requests such as “Ask Claude” always go through `chat.suggestPrompt`, which puts them in the session's input box. So the status text for `suggested` is changed to “The request is in your chat box — send it to the agent.” (the original was a fallback for when no session was found). When not in a session it falls back to copying, with the same text (`claudeDeliveryStatusMessage` in `editor/claude-prompts.ts`).
- **Copy**: in the interface the assistant is called “the agent”, not Claude (the welcome page, empty states, uploads, the palette, shadows, components, asset groups, save and startup prompts, write permission, migration and so on; each is marked separately).
- **React for preview**: the React 18.3.1 UMD used by component preview is not loaded from jsDelivr. It takes the page's own `artifact-type/vendor/react*.production.min.js` (`pageVendorUrl` in `model/libraries.ts`, a root-relative address; the file is byte-identical to the one on jsDelivr, so the integrity value is unchanged). `SWATCH_RUNTIME_TAG_URL_PATTERN` in `editor/swatch-runtime.tsx` accepts only this path accordingly.
- **Links**: the original platform's app schemes (claude, claude-cli, claude-nest), editor extensions and domains are not allowed through. Only VS Code settings links are followed. The desktop app is detected as Electron (`ui/overlays.tsx`).
- **Fonts**: Anthropic Sans is not bundled. The `anthropic` font falls back to the system UI font (`app.css`).
- **Page template**: the README comment written for the hosting platform and the meta tags are not included. Styles and scripts are bundled by Vite into `assets/`; `artifact-type/` contains only the unchanged `run.html` and `vendor/`.

Parts inherited unchanged from the original project that have no effect in CucCut:

- `ADMITTED_PREVIEW_CDN_PREFIXES` in `editor/swatch-runtime.tsx` still allows previews to reference scripts from jsDelivr. CucCut's CSP does not allow external addresses, so such previews do not load.
- `delete window.claude` in `run.html` is kept as it is. It is harmless.
- The console note when a link is refused in `ui/overlays.tsx` still mentions the original platform's apps and extensions. `trustedAnthropicDomains` is empty.
- The font token name `anthropic` (`contracts/dom.ts`, `contracts/layers.ts`, `ui/foundation.tsx`) and the `--font-anthropic-*` variable names in `app.css` are unchanged.
- The migration code (converting old single-page storage to `layout: "files"`) is kept in full. CucCut does not test this path.

## Third-party code and assets bundled

- The npm packages bundled into the page, and the React 18.3.1 UMD used for preview, have their licences collected according to the modules actually bundled. See the “Design system editor” section of the root [`THIRD_PARTY_NOTICES.md`](../../THIRD_PARTY_NOTICES.md) and `apps/design-system-editor/licenses.mjs`.
- The icon font inlined in `app.css` (Anthropicons) came over with the original styles. It is not the S2 icon set that the repository convention prescribes ([repository convention §4](../../docs/repo-conventions.md#4-interface-icons)), and it will be replaced later. Its distribution licence is also still to be confirmed.
- Dependency versions are aligned with the original project: Base UI 1.6.0, TanStack Virtual 3.14.9 / virtual-core 3.17.7, class-variance-authority 0.7.1, clsx 2.1.1, tailwind-merge 3.6.0. React 19 uses the workspace version.

## Verification

```bash
node apps/design-system-editor/build.mjs --force
```

```bash
npm run typecheck
```

```bash
npx vitest run packages/design-system/src/editor apps/desktop/src/main/packaged-resources.test.ts apps/cli/src/runtime/connection.test.ts tools/third-party-notices.test.ts
```

After making changes, open a `layout: "files"` design system and an empty system that has only `design-system.json` in the Web or desktop app. Go through Overview, Colors, Components (the preview loads), Assets (asset thumbnails), edit, save and reload, open read-only, and the three cards on the empty-system welcome page (they put the request into the session's input box).
