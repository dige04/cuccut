// Original licenses for the third-party code bundled into the design editor (THIRD_PARTY_NOTICES.md, section “design editor”).
// npm packages are collected from the modules the build actually bundles, not listed by hand: the page built by Vite, the canvas runtime / injected script / Worker built by esbuild in build.mjs,
// and the React 18 UMD files copied in as they are (build.mjs also records their package directories).

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

/** Finds the npm package directory that a bundled module path belongs to (for nested node_modules, the innermost one). */
export function bundledPackageDirs(moduleIds) {
  const dirs = new Set();
  for (const id of moduleIds) {
    const file = id.replace(/^\0/, '').replace(/\?.*$/, '');
    const match = /^(.*[\\/]node_modules[\\/](?:@[^\\/]+[\\/])?[^\\/]+)[\\/]/.exec(file);
    if (match && existsSync(path.join(match[1], 'package.json'))) dirs.add(match[1]);
  }
  return [...dirs].sort();
}

/**
 * Package directory → license text: the package's own license file verbatim; when the package has no license file, only the license identifier from package.json is written.
 * A package with the same name and version (for example the npm alias react-18 and a nested install of react@18.3.1) is written only once.
 */
export function thirdPartyLicenses(packageDirs) {
  const sections = new Map();
  for (const dir of packageDirs) {
    const pkg = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8'));
    const key = `${pkg.name}@${pkg.version}`;
    if (sections.has(key)) continue;
    // Old packages put their license in a licenses array (gradient-parser)
    const license =
      typeof pkg.license === 'string' ? pkg.license : Array.isArray(pkg.licenses) ? pkg.licenses.map((entry) => entry.type).join(' OR ') : 'see package';
    const file = readdirSync(dir).find((name) => /^(licen[cs]e|copying)(\.|-|$)/i.test(name));
    const text = file ? readFileSync(path.join(dir, file), 'utf8').trim() : `(no license file in the package; package.json declares ${license})`;
    sections.set(key, `${key} (${license})\n\n${text}`);
  }
  return [...sections.keys()].sort().map((key) => sections.get(key)).join(`\n\n${'-'.repeat(72)}\n\n`) + '\n';
}
