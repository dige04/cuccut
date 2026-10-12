// 构建设计系统编辑器（docs/design/canvas §10.2），产物都在 dist/：
//   index.html、assets/**                    编辑器页面，Runtime 在 /design-system/<grant>/ 下提供
//   artifact-type/run.html                   组件预览的 runner（public/ 原样拷来，与原页面相同）
//   artifact-type/vendor/react*.production.min.js  预览用的 React 18.3.1 UMD（原运行时从 jsDelivr 加载）
//   third-party-licenses.txt                 打进去的第三方代码的原始许可
//
// 只有一步：Vite 打编辑器页面（vite.config.ts 顺带放好 React UMD 与许可）。原工程直接 vite build，没有要预先打的脚本文本。
// 输入没变时跳过，--force 强制重建。

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

/** 目录里最新的修改时间（跳过 node_modules、dist、generated 与以点开头的）。 */
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
