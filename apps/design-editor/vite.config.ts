import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { bundledPackageDirs, thirdPartyLicenses } from './licenses.mjs';

/** Output of build.mjs step 1 (packages/design-runtime/src/generated/). */
const generated = resolve(import.meta.dirname, '../../packages/design-runtime/src/generated');

/**
 * The canvas runtime and the fast-edit Worker are placed under artifact-type/ following the original page's layout; the page template's dc-runtime-file / fast-edit-worker-file point here (relative to the page URL). The runtime treats paths under artifact-type/ as the editor's own files, not the design's files.
 * Babel standalone is also placed here (dc-babel-file, added by CucCut): the original loads it on demand from a CDN, and CucCut's CSP does not allow the CDN.
 */
function designRuntimeFiles(): Plugin {
  return {
    name: 'cuccut-design-runtime-files',
    apply: 'build',
    generateBundle() {
      for (const file of ['dc-runtime.js', 'babel.min.js', 'fast-edit-worker.js']) {
        this.emitFile({ type: 'asset', fileName: `artifact-type/${file}`, source: readFileSync(resolve(generated, file)) });
      }
    },
  };
}

/** Original licenses for the third-party code bundled into the page and the two files above, placed in third-party-licenses.txt at the output root. */
function editorLicenses(): Plugin {
  return {
    name: 'cuccut-design-editor-licenses',
    apply: 'build',
    generateBundle() {
      const scripts = JSON.parse(readFileSync(resolve(generated, 'bundled-inputs.json'), 'utf8')) as string[];
      const source = thirdPartyLicenses(bundledPackageDirs([...this.getModuleIds(), ...scripts]));
      this.emitFile({ type: 'asset', fileName: 'third-party-licenses.txt', source });
    },
  };
}

/**
 * Design editor page (docs/design/canvas §3, §5): served by the Runtime under `/design/<grant>/`, so resources use relative URLs.
 * The runtime is @cuccut/design-runtime in the workspace; the page template is index.html in this directory.
 */
export default defineConfig({
  root: import.meta.dirname,
  base: './',
  plugins: [designRuntimeFiles(), editorLicenses()],
  build: {
    target: 'es2022',
    outDir: resolve(import.meta.dirname, 'dist'),
    emptyOutDir: true,
    // The runtime is itself one large bundle (React, the canvas and property editing, export), and it also embeds the canvas runtime and the injected script as text
    chunkSizeWarningLimit: 16000,
    rollupOptions: {
      // Dependencies such as @base-ui carry a "use client" directive, so Rollup warns about each one when bundling into a single package; those warnings are meaningless here.
      onwarn(warning, warn) {
        if (warning.code === 'MODULE_LEVEL_DIRECTIVE') return;
        warn(warning);
      },
    },
  },
});
