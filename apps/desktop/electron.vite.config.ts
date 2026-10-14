import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import optimizeLocales from '@react-aria/optimize-locales-plugin';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'electron-vite';
import type { EnvironmentModuleNode, Plugin } from 'vite';
import { LOCALE_TAGS } from '../../packages/protocol/src/i18n.ts';
import { pdfLicenses } from '../../tools/pdf-licenses.ts';
import { thirdPartyNotices } from '../../tools/third-party-notices.ts';
import { s2Styles, s2StylesChunk } from '../../tools/s2-styles.ts';
import tailwindcss from '@tailwindcss/vite';
import { cuccutTheme, s2ShimAlias } from '../../tools/cuccut-theme.ts';

// Workspace packages are TypeScript source (with no build output), so they must be bundled in; third-party dependencies are externalized as usual.
const bundleWorkspace = { exclude: ['@cuccut/runtime', '@cuccut/runtime-storage', '@cuccut/protocol', '@cuccut/ui'] };

/** Modules in the UI that hold state: the Zustand store and the Runtime session. */
const STATEFUL = /\/packages\/ui\/src\/(state|runtime)\//;

/**
 * During development, editing a state module (or a module it depends on, such as the protocol package) triggers a full page reload. Hot replacement would give these modules a fresh, empty copy of their state, while the Runtime session that is still connected keeps writing to the old copy, and the UI would stay stuck in a loading state such as “preparing”.
 */
export function reloadOnStateChange(): Plugin {
  const reachesState = (node: EnvironmentModuleNode, seen: Set<EnvironmentModuleNode>): boolean => {
    if (seen.has(node)) return false;
    seen.add(node);
    if (node.file && STATEFUL.test(node.file)) return true;
    return [...node.importers].some((importer) => reachesState(importer, seen));
  };
  return {
    name: 'cuccut:reload-on-state-change',
    apply: 'serve',
    hotUpdate({ modules }) {
      if (this.environment.name !== 'client') return;
      const seen = new Set<EnvironmentModuleNode>();
      if (!modules.some((node) => reachesState(node, seen))) return;
      this.environment.hot.send({ type: 'full-reload' });
      return [];
    },
  };
}

/**
 * After the Runtime is bundled into `out/main/runtime.js`, it synchronously reads the editing-semantics WASM in Node: `generated/editor.wasm` is copied as is next to the bundle (`out/main/generated/editor.wasm`), and `locateEditorWasm` in `@cuccut/editor-wasm` looks there first. On the UI side, Vite inlines it, so this path is not used.
 * When the WASM has not been built, this only warns: the error `EDITOR_WASM_UNAVAILABLE` is raised only when a flow that uses it is called, which matches the UI side.
 */
export function shipEditorWasm(): Plugin {
  const source = resolve(import.meta.dirname, '../../packages/editor-wasm/src/generated/editor.wasm');
  return {
    name: 'cuccut:ship-editor-wasm',
    apply: 'build',
    generateBundle() {
      if (!existsSync(source)) {
        this.warn(`missing ${source}, run npm run build:wasm first`);
        return;
      }
      this.emitFile({ type: 'asset', fileName: 'generated/editor.wasm', source: readFileSync(source) });
    },
  };
}

/**
 * Preview fonts (copied into `packages/ui/src/render/generated/fonts` by `npm run build:wasm`) are imported with `?url` and are separate files next to the bundle: under file:// the packaged page's `new URL(filename, import.meta.url)` points to the copy in `out/renderer/assets/`, which is then read by XHR (`preview-wasm.ts`). The build checks two things and fails if either is wrong, rather than the preview failing to draw text only when it is opened:
 * - `base` is relative (an absolute `/assets/…` under file:// points to the disk root; electron-vite's production build sets it to `./`, and this guards against that changing);
 * - every file in `generated/fonts` has been emitted into the output as an asset.
 */
export function checkPreviewFonts(source = resolve(import.meta.dirname, '../../packages/ui/src/render/generated/fonts')): Plugin {
  let root = '';
  let base = '';
  return {
    name: 'cuccut:check-preview-fonts',
    apply: 'build',
    configResolved(config) {
      root = config.root;
      base = config.base;
    },
    generateBundle(_options, bundle) {
      if (base !== '' && !base.startsWith('./')) this.error(`the renderer base is ${base}: the packaged file:// page cannot read fonts, use a relative ./`);
      const fonts = existsSync(source) ? readdirSync(source).filter((name) => name.endsWith('.ttf')) : [];
      if (fonts.length === 0) this.error(`no fonts in ${source}, run npm run build:wasm first`);
      const shipped = new Set<string>();
      for (const output of Object.values(bundle)) {
        if (output.type === 'asset') for (const original of output.originalFileNames) shipped.add(resolve(root, original));
      }
      const missing = fonts.filter((name) => !shipped.has(resolve(source, name)));
      if (missing.length > 0) this.error(`preview fonts missing from the output: ${missing.join(', ')}`);
    },
  };
}

export default defineConfig({
  main: {
    plugins: [shipEditorWasm()],
    build: {
      externalizeDeps: bundleWorkspace,
      rollupOptions: {
        input: {
          index: resolve(import.meta.dirname, 'src/main/index.ts'),
          // The Runtime is built together with the main process, and the main process starts it with Electron's bundled Node (ELECTRON_RUN_AS_NODE).
          runtime: resolve(import.meta.dirname, '../runtime/src/main.ts'),
          'legacy-import-worker': resolve(import.meta.dirname, '../../packages/legacy-import/src/worker.ts'),
          // Self-check entry for the output (run by `tools/check-model-assets.mjs` with Electron's Node): where the model data shipped with the app resolves to; the app itself does not load it.
          'model-assets-check': resolve(import.meta.dirname, 'src/main/model-assets-check.ts'),
        },
      },
    },
  },
  preload: {
    build: {
      externalizeDeps: bundleWorkspace,
      rollupOptions: { input: { index: resolve(import.meta.dirname, 'src/preload/index.ts') } },
    },
  },
  renderer: {
    root: resolve(import.meta.dirname, 'src/renderer'),
    // The preview's WASM is imported as a data URL with `?inline` (a packaged file:// page cannot fetch a separate .wasm file).
    // Vite does not treat .wasm as an asset by default, so this must be stated explicitly.
    assetsInclude: ['**/*.wasm', '**/*.bcmap', '**/*.pfb'],
    // CucCut: S2 imports go through the theme shim (agentcut's button language on S2 components).
    resolve: { alias: [s2ShimAlias()] },
    plugins: [
      // The S2 style macro must be processed first (in development, S2 styles are also merged and deduplicated separately; see tools/s2-styles.ts).
      ...s2Styles(),
      tailwindcss(),
      // CucCut: agentcut's palette over every S2 colour (tools/cuccut-theme.ts).
      cuccutTheme(),
      pdfLicenses(resolve(import.meta.dirname, '../..')),
      thirdPartyNotices(resolve(import.meta.dirname, '../..')),
      react(),
      { ...optimizeLocales.vite({ locales: Object.values(LOCALE_TAGS) }), enforce: 'pre' },
      reloadOnStateChange(),
      checkPreviewFonts(),
    ],
    build: {
      target: 'es2022',
      // electron-vite defaults the renderer to minify: false, so the CSS is left uncompressed, and the inline source map that the style macro attaches to each CSS file (which contains the whole source file)
      // ends up in the output as is (over thirty MB). CSS is compressed as in the web client, with comments and the source map removed; JS stays uncompressed as electron-vite's default.
      cssMinify: 'esbuild',
      rollupOptions: {
        input: {
          index: resolve(import.meta.dirname, 'src/renderer/index.html'),
          // Self-check entry for the output (dynamically imported under file:// by `tools/check-file-fonts.mjs`); the app itself does not load it.
          'kernel-check': resolve(import.meta.dirname, 'src/renderer/kernel-check.ts'),
          // End-to-end benchmark for preview playback (likewise dynamically imported by `tools/preview-bench.mjs`); the app itself does not load it.
          'preview-bench': resolve(import.meta.dirname, 'src/renderer/preview-bench.ts'),
        },
        output: {
          // CSS generated by S2, the S2 AI components and the style macro is combined into one file, to avoid cascade-order problems that come from splitting it by chunk.
          manualChunks: s2StylesChunk,
        },
      },
    },
  },
});
