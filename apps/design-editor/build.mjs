// 构建设计稿编辑器（docs/design/canvas §3），产物都在 dist/：
//   index.html、assets/**              编辑器页面，Runtime 在 /design/<grant>/ 下提供
//   artifact-type/dc-runtime.js        画板运行时（内含 React 18.3.1）；画板不能用 blob: 脚本时从这里加载
//   artifact-type/babel.min.js         Babel standalone 原文件（与原版 CDN 上的逐字节相同）：画板 x-import 了 JSX 时才加载，导出时内嵌
//   artifact-type/fast-edit-worker.js  快速编辑的 Worker。CucCut 不提供 sample，快速编辑关着，照原样产出
//   third-party-licenses.txt           打进去的第三方代码的原始许可
//
// 1. esbuild 把画板运行时、注入脚本与 Worker 打成脚本文本，连同 React 18 的 UMD 文件与 Babel standalone 放进
//    packages/design-runtime/src/generated/（不进 git；dependencies.tsx 以 `?raw` 导入其中一部分）。
//    选项与原工程的 tools/build-assets.mjs 相同；原工程用 runtime/ 下单独安装的 React 18，这里用 npm 别名 react-18 / react-dom-18。
// 2. Vite 打编辑器页面，并把 dc-runtime.js、babel.min.js 与 fast-edit-worker.js 放到页面模板的 meta 指向的位置（vite.config.ts）。
// 输入没变时跳过，--force 强制重建。

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

/** 按 Node 的查找方式，从本目录往上找一个包装在哪（npm 别名包没有可解析的入口，不能用 require.resolve）。 */
function packageDir(name) {
  for (let dir = appDir; ; dir = dirname(dir)) {
    const candidate = join(dir, 'node_modules', name);
    if (existsSync(join(candidate, 'package.json'))) return candidate;
    if (dirname(dir) === dir) throw new Error(`Cannot find ${name}; run npm install`);
  }
}

// 1. 画板运行时、注入脚本与 Worker
rmSync(generated, { recursive: true, force: true });
mkdirSync(generated, { recursive: true });
const esbuild = await import('esbuild');
/** 打进脚本文本里的源文件，Vite 的许可插件据此找出第三方包（licenses.mjs）。 */
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
  // 画板运行时按需加载，不打进去（docs/design/canvas §3）
  ['babel.min', join(packageDir('@babel/standalone'), 'babel.min.js')],
]) {
  copyFileSync(file, join(generated, `${name}.js`));
  bundled.add(file);
}
// 画板运行时自带 React 18：编辑器界面用工作区的 React 19，两者不混用（docs/design/canvas §3）
await bundle('runtime/index.tsx', 'dc-runtime.js', {
  alias: { react: packageDir('react-18'), 'react-dom': packageDir('react-dom-18') },
});
await bundle('worker/sandbox.ts', 'fast-edit-worker.js', { plugins: [workerBrowserPlugin()] });
writeFileSync(join(generated, 'bundled-inputs.json'), JSON.stringify([...bundled].sort(), null, 2) + '\n');

// 2. 编辑器页面
const { build } = await import('vite');
await build({ configFile: join(appDir, 'vite.config.ts'), logLevel: 'warn' });
console.log(`Design editor built: ${dist}`);
