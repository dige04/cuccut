// Builds the design editor (docs/design/canvas §3). Outputs all go to dist/:
//   index.html, assets/**              Editor page, served by the Runtime under /design/<grant>/
//   artifact-type/dc-runtime.js        Canvas runtime (bundles React 18.3.1); loaded from here when the canvas cannot use blob: scripts
//   artifact-type/babel.min.js         Original Babel standalone file (byte-identical to the original CDN copy): loaded only when a canvas x-imports JSX, and embedded on export
//   artifact-type/fast-edit-worker.js  Worker for fast edit. CucCut does not provide a sample, so fast edit stays off; output is produced as is
//   third-party-licenses.txt           Original licenses for the third-party code bundled in
//
// 1. esbuild bundles the canvas runtime, the injected script and the Worker into script text, and puts them in packages/design-runtime/src/generated/ together with React 18's UMD files and Babel standalone (not committed to git; dependencies.tsx imports some of them with `?raw`).
//    The options are the same as the original project's tools/build-assets.mjs; the original project uses React 18 installed separately under runtime/, here npm aliases react-18 / react-dom-18 are used.
// 2. Vite builds the editor page and puts dc-runtime.js, babel.min.js and fast-edit-worker.js where the page template's meta tags point (vite.config.ts).
// Skipped when the inputs have not changed; --force rebuilds.

import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { workerBrowserPlugin } from '@cuccut/design-runtime/worker-browser-plugin';

const appDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(appDir, '../..');
const runtimeDir = join(repoRoot, 'packages', 'design-runtime');
const srcDir = join(runtimeDir, 'src');
const generated = join(srcDir, 'generated');
const dist = join(appDir, 'dist');
const outputs = ['index.html', 'artifact-type/dc-runtime.js', 'artifact-type/babel.min.js', 'artifact-type/fast-edit-worker.js'].map(file => join(dist, file));

/** The latest modification time in the directory (skipping node_modules, dist, generated and dot-prefixed entries). */
function newest(target) {
  if (!existsSync(target)) return 0;
  const info = statSync(target);
  if (!info.isDirectory()) return info.mtimeMs;
  let latest = 0;
  for (const entry of readdirSync(target, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'generated' || entry.name.startsWith('.')) continue;
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
  join(appDir, 'package.json'),
  join(repoRoot, 'packages', 'design', 'src'),
  join(repoRoot, 'packages', 'slides', 'src'),
];
if (!process.argv.includes('--force') && outputs.every(file => existsSync(file))) {
  const built = Math.min(...outputs.map(file => statSync(file).mtimeMs));
  if (inputs.every(input => newest(input) <= built)) {
    console.log('Design editor is up to date.');
    process.exit(0);
  }
}

/** Finds where a package is installed by walking up from this directory the way Node looks things up (npm alias packages have no resolvable entry, so require.resolve cannot be used). */
function packageDir(name) {
  for (let dir = appDir; ; dir = dirname(dir)) {
    const candidate = join(dir, 'node_modules', name);
    if (existsSync(join(candidate, 'package.json'))) return candidate;
    if (dirname(dir) === dir) throw new Error(`Cannot find ${name}; run npm install`);
  }
}

// 1. Canvas runtime, injected script and Worker
rmSync(generated, { recursive: true, force: true });
mkdirSync(generated, { recursive: true });
const esbuild = await import('esbuild');
/** Source files bundled into the script text; Vite's license plugin uses them to find the third-party packages (licenses.mjs). */
const bundled = new Set();
async function bundle(entry, filename, options = {}) {
  const result = await esbuild.build({
    entryPoints: [join(srcDir, entry)],
    outfile: join(generated, filename),
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'es2022',
    minify: false,
    legalComments: 'inline',
    absWorkingDir: repoRoot,
    metafile: true,
    logLevel: 'error',
    ...options,
  });
  for (const input of Object.keys(result.metafile.inputs)) bundled.add(resolve(repoRoot, input));
}

for (const file of readdirSync(join(srcDir, 'scripts')).filter(name => /\.tsx?$/.test(name)).sort()) {
  await bundle(`scripts/${file}`, file.replace(/\.tsx?$/, '.js'));
}
await bundle('runtime/support-entry.ts', 'support.js');
for (const [name, file] of [
  ['react', join(packageDir('react-18'), 'umd', 'react.production.min.js')],
  ['react-dom', join(packageDir('react-dom-18'), 'umd', 'react-dom.production.min.js')],
  // The canvas runtime is loaded on demand and not bundled in (docs/design/canvas §3)
  ['babel.min', join(packageDir('@babel/standalone'), 'babel.min.js')],
]) {
  copyFileSync(file, join(generated, `${name}.js`));
  bundled.add(file);
}
// The canvas runtime ships its own React 18: the editor UI uses the workspace's React 19, and the two are not mixed (docs/design/canvas §3)
await bundle('runtime/index.tsx', 'dc-runtime.js', {
  alias: { react: packageDir('react-18'), 'react-dom': packageDir('react-dom-18') },
});
await bundle('worker/sandbox.ts', 'fast-edit-worker.js', { plugins: [workerBrowserPlugin()] });
writeFileSync(join(generated, 'bundled-inputs.json'), JSON.stringify([...bundled].sort(), null, 2) + '\n');

// 2. Editor page
const { build } = await import('vite');
await build({ configFile: join(appDir, 'vite.config.ts'), logLevel: 'warn' });
console.log(`Design editor built: ${dist}`);
