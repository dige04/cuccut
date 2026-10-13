// Builds the slides editor (docs/design/slides §3); the outputs are all in dist/:
//   index.html, assets/**   the editor page; the Runtime serves it under /slides/<grant>/
//   node/compiler.cjs       a runtime that loads modules without mounting any UI; slides_check calls its compiler in Node
//   third-party-licenses.txt, node/third-party-licenses.txt   the original licenses of the third-party code bundled into both
//
// The runtime is @cuccut/slides-runtime in the workspace; the page template is index.html in this directory. If the inputs have not changed, the build is skipped; --force forces a rebuild.

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { patchPptxgenjs, pptxgenjsDistFile } from '@cuccut/slides-runtime/pptxgenjs-patch';
import { bundledPackageDirs, thirdPartyLicenses } from './licenses.mjs';

const appDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(appDir, '../..');
const runtimeDir = join(repoRoot, 'packages', 'slides-runtime');
const dist = join(appDir, 'dist');
const compilerFile = join(dist, 'node', 'compiler.cjs');

/** The latest modification time in the directory (skips node_modules, dist, and dot-prefixed entries). */
function newest(target) {
  if (!existsSync(target)) return 0;
  const info = statSync(target);
  if (!info.isDirectory()) return info.mtimeMs;
  let latest = 0;
  for (const entry of readdirSync(target, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) continue;
    latest = Math.max(latest, newest(join(target, entry.name)));
  }
  return latest;
}

const inputs = [
  runtimeDir,
  join(appDir, 'src'),
  join(appDir, 'index.html'),
  join(appDir, 'build.mjs'),
  join(appDir, 'licenses.mjs'),
  join(appDir, 'vite.config.ts'),
  join(repoRoot, 'packages', 'slides', 'src'),
];
if (!process.argv.includes('--force') && existsSync(join(dist, 'index.html')) && existsSync(compilerFile)) {
  const built = statSync(compilerFile).mtimeMs;
  if (inputs.every(input => newest(input) <= built)) {
    console.log('Slides editor is up to date.');
    process.exit(0);
  }
}

// 1. Editor page
const { build } = await import('vite');
await build({ configFile: join(appDir, 'vite.config.ts'), logLevel: 'warn' });

// 2. The compiler for Node (the vite build empties dist, so this runs after it)
const esbuild = await import('esbuild');
const compiled = await esbuild.build({
  stdin: {
    contents: "import { createSlidesRuntime } from '@cuccut/slides-runtime';\nexport const runtime = createSlidesRuntime({ boot: false });\n",
    resolveDir: appDir,
    sourcefile: 'slides-compiler-entry.ts',
    loader: 'ts',
  },
  bundle: true,
  outfile: compilerFile,
  platform: 'node',
  format: 'cjs',
  target: 'es2022',
  // The editor UI's styles and fonts are not needed in Node
  loader: { '.css': 'empty', '.woff2': 'empty' },
  logLevel: 'error',
  absWorkingDir: repoRoot,
  metafile: true,
  define: { 'process.env.NODE_ENV': '"production"' },
  plugins: [
    {
      // PptxGenJS application extension, the same one as in vite.config.ts
      name: 'cuccut-pptxgenjs-extensions',
      setup(build) {
        build.onLoad({ filter: /[\\/]pptxgenjs[\\/]dist[\\/][^\\/]+\.js$/ }, args => {
          const file = pptxgenjsDistFile(args.path);
          return file ? { contents: patchPptxgenjs(readFileSync(args.path, 'utf8'), file), loader: 'js' } : undefined;
        });
      },
    },
  ],
});
const compiledInputs = Object.keys(compiled.metafile.inputs).map((input) => resolve(repoRoot, input));
writeFileSync(join(dist, 'node', 'third-party-licenses.txt'), thirdPartyLicenses(bundledPackageDirs(compiledInputs)));
console.log(`Slides editor built: ${dist}`);
