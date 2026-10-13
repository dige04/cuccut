// The original licenses of the third-party code bundled into the editor page and the compiler (THIRD_PARTY_NOTICES.md, “Slides editor”).
// npm packages are collected from the modules the build actually bundles, not listed by hand; mediabunny, which the runtime embeds as a string, is added separately.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const runtimeDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../packages/slides-runtime');

/** Packages modified at build time: the notice is written out together with the license. */
const MODIFIED = {
  pptxgenjs: 'Modified at build time by CucCut: 25 extensions from packages/slides-runtime/patches/pptxgenjs-3.12.0.json.',
};

/** Packages whose distribution file already inlines their dependencies: what is bundled is jszip's browser build dist/jszip.min.js, and its dependencies no longer appear as separate modules. */
const INLINED = {
  jszip: ['pako', 'lie', 'immediate', 'setimmediate'],
};

/** Code embedded as text in the runtime, not resolved through npm. */
const EMBEDDED = [
  {
    title: 'mediabunny@1.27.3 (MPL-2.0)',
    note:
      'Copyright (c) 2025-present, Vanilagy and contributors. Embedded unmodified, as the text of the Worker in\n' +
      'packages/slides-runtime/src/media/video-worker.ts; complete source at https://github.com/Vanilagy/mediabunny.',
    file: path.join(runtimeDir, 'licenses', 'MPL-2.0.txt'),
  },
];

/** Finds the npm package directory a module belongs to from its path in the bundle (for nested node_modules, the innermost one). */
export function bundledPackageDirs(moduleIds) {
  const dirs = new Set();
  for (const id of moduleIds) {
    const file = id.replace(/^\0/, '').replace(/\?.*$/, '');
    const match = /^(.*[\\/]node_modules[\\/](?:@[^\\/]+[\\/])?[^\\/]+)[\\/]/.exec(file);
    if (match) dirs.add(match[1]);
  }
  for (const dir of [...dirs]) {
    for (const name of INLINED[path.basename(dir)] ?? []) dirs.add(installedPackageDir(dir, name));
  }
  return [...dirs].sort();
}

/** Following Node's lookup rules, walks up from a package directory to find where its dependency packages are installed. */
function installedPackageDir(fromDir, name) {
  for (let dir = fromDir; ; dir = path.dirname(dir)) {
    const candidate = path.join(dir, 'node_modules', name);
    if (existsSync(path.join(candidate, 'package.json'))) return candidate;
    if (path.dirname(dir) === dir) throw new Error(`Cannot find ${name} installed for ${fromDir}`);
  }
}

/** Package directory → license text: the package's own license file verbatim; if the package has no license file, only the license identifier from package.json. */
export function thirdPartyLicenses(packageDirs) {
  const sections = [];
  for (const dir of packageDirs) {
    const pkg = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8'));
    const license = typeof pkg.license === 'string' ? pkg.license : 'see package';
    const file = readdirSync(dir).find((name) => /^(licen[cs]e|copying)(\.|-|$)/i.test(name));
    const text = file ? readFileSync(path.join(dir, file), 'utf8').trim() : `(no license file in the package; package.json declares ${license})`;
    const note = MODIFIED[pkg.name] ? `${MODIFIED[pkg.name]}\n\n` : '';
    sections.push(`${pkg.name}@${pkg.version} (${license})\n\n${note}${text}`);
  }
  for (const { title, note, file } of EMBEDDED) sections.push(`${title}\n\n${note}\n\n${readFileSync(file, 'utf8').trim()}`);
  return sections.join(`\n\n${'-'.repeat(72)}\n\n`) + '\n';
}
