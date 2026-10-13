import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { patchPptxgenjs, pptxgenjsDistFile } from '@cuccut/slides-runtime/pptxgenjs-patch';
import { bundledPackageDirs, thirdPartyLicenses } from './licenses.mjs';

/** The PptxGenJS application extension is applied at build time to the distribution file as it is read; node_modules is not changed (packages/slides-runtime/patches). */
function pptxgenjsExtensions(): Plugin {
  return {
    name: 'cuccut-pptxgenjs-extensions',
    load(id) {
      const file = pptxgenjsDistFile(id);
      return file ? patchPptxgenjs(readFileSync(id.replace(/\?.*$/, ''), 'utf8'), file) : null;
    },
  };
}

/** The original licenses of the third-party code bundled into the page, placed at the output root as third-party-licenses.txt. */
function editorLicenses(): Plugin {
  return {
    name: 'cuccut-slides-editor-licenses',
    apply: 'build',
    generateBundle() {
      const source = thirdPartyLicenses(bundledPackageDirs(this.getModuleIds()));
      this.emitFile({ type: 'asset', fileName: 'third-party-licenses.txt', source });
    },
  };
}

/**
 * The slides editor page (docs/design/slides §3): served by the Runtime under `/slides/<grant>/`, so its assets use relative URLs.
 * The runtime is @cuccut/slides-runtime in the workspace; the page template is index.html in this directory.
 */
export default defineConfig({
  root: import.meta.dirname,
  base: './',
  plugins: [pptxgenjsExtensions(), editorLicenses()],
  build: {
    target: 'es2022',
    outDir: resolve(import.meta.dirname, 'dist'),
    emptyOutDir: true,
    // The runtime is itself one large bundle (React, the editor, PPTX export)
    chunkSizeWarningLimit: 8000,
    rollupOptions: {
      // Dependencies such as @base-ui carry "use client" directives; when bundled into one package, Rollup warns about each one, which is meaningless here.
      onwarn(warning, warn) {
        if (warning.code === 'MODULE_LEVEL_DIRECTIVE') return;
        warn(warning);
      },
    },
  },
});
