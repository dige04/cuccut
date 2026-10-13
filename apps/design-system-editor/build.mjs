// Builds the design system editor (docs/design/canvas §10.2). Outputs all go to dist/:
//   index.html, assets/**                    Editor page, served by the Runtime under /design-system/<grant>/
//   artifact-type/run.html                   Runner for component previews (copied as is from public/, same as the original page)
//   artifact-type/vendor/react*.production.min.js  React 18.3.1 UMD for previews (the original runtime loaded it from jsDelivr)
//   third-party-licenses.txt                 Original licenses for the third-party code bundled in
//
// There is one step: Vite builds the editor page (vite.config.ts also puts the React UMD files and the licenses in place). The original project runs vite build directly, with no script text to pre-bundle.
// Skipped when the inputs have not changed; --force rebuilds.

import { existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(appDir, '../..');
const dist = join(appDir, 'dist');
const outputs = [
  'index.html',
  'artifact-type/run.html',
  'artifact-type/vendor/react.production.min.js',
  'artifact-type/vendor/react-dom.production.min.js',
].map(file => join(dist, file));

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
  join(repoRoot, 'packages', 'design-system-runtime'),
  join(appDir, 'src'),
  join(appDir, 'public'),
  join(appDir, 'index.html'),
  join(appDir, 'build.mjs'),
  join(appDir, 'licenses.mjs'),
  join(appDir, 'vite.config.ts'),
  join(appDir, 'package.json'),
  join(repoRoot, 'packages', 'design-system', 'src'),
  join(repoRoot, 'packages', 'slides', 'src'),
];
if (!process.argv.includes('--force') && outputs.every(file => existsSync(file))) {
  const built = Math.min(...outputs.map(file => statSync(file).mtimeMs));
  if (inputs.every(input => newest(input) <= built)) {
    console.log('Design system editor is up to date.');
    process.exit(0);
  }
}

const { build } = await import('vite');
await build({ configFile: join(appDir, 'vite.config.ts'), logLevel: 'warn' });
console.log(`Design system editor built: ${dist}`);
