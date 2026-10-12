// 编辑器页面与编译器打进去的第三方代码的原始许可（THIRD_PARTY_NOTICES.md「幻灯片编辑器」）。
// npm 包按构建实际打进的模块收集，不手列；另加运行时以字符串内嵌的 mediabunny。

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const runtimeDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../packages/slides-runtime');

/** 构建时改过的包：说明随许可一起写出。 */
const MODIFIED = {
  pptxgenjs: 'Modified at build time by CucCut: 25 extensions from packages/slides-runtime/patches/pptxgenjs-3.12.0.json.',
};

/** 发行文件里已经内联了依赖的包：打进的是 jszip 的浏览器版 dist/jszip.min.js，依赖不再作为单独模块出现。 */
const INLINED = {
  jszip: ['pako', 'lie', 'immediate', 'setimmediate'],
};

/** 运行时里以文本内嵌、不经 npm 解析的代码。 */
const EMBEDDED = [
  {
    title: 'mediabunny@1.27.3 (MPL-2.0)',
    note:
      'Copyright (c) 2025-present, Vanilagy and contributors. Embedded unmodified, as the text of the Worker in\n' +
      'packages/slides-runtime/src/media/video-worker.ts; complete source at https://github.com/Vanilagy/mediabunny.',
    file: path.join(runtimeDir, 'licenses', 'MPL-2.0.txt'),
  },
];

/** 从打进包里的模块路径找出所属的 npm 包目录（嵌套的 node_modules 取最里层）。 */
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

/** 按 Node 的查找方式，从一个包目录往上找它依赖的包装在哪。 */
function installedPackageDir(fromDir, name) {
  for (let dir = fromDir; ; dir = path.dirname(dir)) {
    const candidate = path.join(dir, 'node_modules', name);
    if (existsSync(path.join(candidate, 'package.json'))) return candidate;
    if (path.dirname(dir) === dir) throw new Error(`Cannot find ${name} installed for ${fromDir}`);
  }
}

/** 包目录 → 许可文本：包自带的许可文件原文；包里没有许可文件时只写 package.json 的许可标识。 */
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
