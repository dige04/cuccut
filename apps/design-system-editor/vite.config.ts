import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { bundledPackageDirs, thirdPartyLicenses } from './licenses.mjs';

/** Finds where a package is installed by walking up from this directory the way Node looks things up (npm alias packages have no resolvable entry, so require.resolve cannot be used). */
function packageDir(name: string): string {
  for (let dir = import.meta.dirname; ; dir = dirname(dir)) {
    const candidate = join(dir, 'node_modules', name);
    if (existsSync(join(candidate, 'package.json'))) return candidate;
    if (dirname(dir) === dir) throw new Error(`Cannot find ${name}; run npm install`);
  }
}

/**
 * React 18.3.1 UMD for component previews (the original files of the npm aliases react-18 / react-dom-18). The runtime originally loaded them from jsDelivr; CucCut instead uses these two files bundled with the page (packages/design-system-runtime/src/model/libraries.ts), placed in artifact-type/vendor/.
 */
const VENDOR_FILES = [
  { fileName: 'artifact-type/vendor/react.production.min.js', source: () => join(packageDir('react-18'), 'umd', 'react.production.min.js') },
  { fileName: 'artifact-type/vendor/react-dom.production.min.js', source: () => join(packageDir('react-dom-18'), 'umd', 'react-dom.production.min.js') },
];

function previewVendorFiles(): Plugin {
  return {
    name: 'cuccut-design-system-vendor-files',
    apply: 'build',
    generateBundle() {
      for (const file of VENDOR_FILES) this.emitFile({ type: 'asset', fileName: file.fileName, source: readFileSync(file.source()) });
    },
  };
}

/** Original licenses for the third-party code bundled into the page and the two files above, placed in third-party-licenses.txt at the output root. */
function editorLicenses(): Plugin {
  return {
    name: 'cuccut-design-system-editor-licenses',
    apply: 'build',
    generateBundle() {
      const source = thirdPartyLicenses(bundledPackageDirs([...this.getModuleIds(), ...VENDOR_FILES.map(file => file.source())]));
      this.emitFile({ type: 'asset', fileName: 'third-party-licenses.txt', source });
    },
  };
}

/**
 * Design system editor page (docs/design/canvas §10.2): served by the Runtime under `/design-system/<grant>/`, so resources use relative URLs.
 * The runtime is @cuccut/design-system-runtime in the workspace; the page template is index.html in this directory; public/artifact-type/run.html is the preview runner, copied into the output as is.
 */
export default defineConfig({
  root: import.meta.dirname,
  base: './',
  plugins: [previewVendorFiles(), editorLicenses()],
  build: {
    target: 'es2022',
    outDir: resolve(import.meta.dirname, 'dist'),
    emptyOutDir: true,
    // The runtime is itself one large bundle (React, the editors for each section, the preview and the file table)
    chunkSizeWarningLimit: 4000,
    rollupOptions: {
      // Dependencies such as @base-ui carry a "use client" directive, so Rollup warns about each one when bundling into a single package; those warnings are meaningless here.
      onwarn(warning, warn) {
        if (warning.code === 'MODULE_LEVEL_DIRECTIVE') return;
        warn(warning);
      },
    },
  },
});
