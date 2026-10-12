// 构建幻灯片编辑器（docs/design/slides §3），产物都在 dist/：
//   index.html、assets/**   编辑器页面，Runtime 在 /slides/<grant>/ 下提供
//   node/compiler.cjs        只装模块、不挂界面的运行时，slides_check 在 Node 里调它的编译器
//   third-party-licenses.txt、node/third-party-licenses.txt   两者打进去的第三方代码的原始许可
//
// 运行时是工作区里的 @cuccut/slides-runtime，页面模板是本目录的 index.html。输入没变时跳过，--force 强制重建。

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

/** 目录里最新的修改时间（跳过 node_modules、dist 与以点开头的）。 */
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

// 1. 编辑器页面
const { build } = await import('vite');
await build({ configFile: join(appDir, 'vite.config.ts'), logLevel: 'warn' });

// 2. Node 用的编译器（vite 构建会清空 dist，所以放在后面）
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
  // 编辑器界面的样式与字体在 Node 里用不上
  loader: { '.css': 'empty', '.woff2': 'empty' },
  logLevel: 'error',
  absWorkingDir: repoRoot,
  metafile: true,
  define: { 'process.env.NODE_ENV': '"production"' },
  plugins: [
    {
      // PptxGenJS 的应用扩展，与 vite.config.ts 里的同一份
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
