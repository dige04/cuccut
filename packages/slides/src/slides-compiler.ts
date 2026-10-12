/**
 * 编辑器构建产物与 Node 里用的编译器（docs/design/slides §3、§7.2）。
 *
 * `apps/slides-editor` 的构建（`npm run build:slides-editor`）用工作区的 @cuccut/slides-runtime 打出两样东西，放在同一个目录：
 *   index.html、assets/**   编辑器页面，由 Runtime 的幻灯片路由提供
 *   node/compiler.cjs        只装模块、不挂界面的运行时（createSlidesRuntime({ boot: false })），slides_check 调它的编译器
 * 没构建时这个目录不存在：幻灯片标签显示不可用的说明，slides_check 报错，Runtime 照常启动。
 */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SlidesRuntime } from './compiler-contract.ts';

export type { SlidesRuntime } from './compiler-contract.ts';

/** 编译器在构建目录里的位置。 */
export const COMPILER_FILE = path.join('node', 'compiler.cjs');

/**
 * 找编辑器的构建产物目录（里面有 `index.html`）：`CUCCUT_SLIDES_EDITOR_DIST` 环境变量；打包后的应用里是
 * `<resources>/slides-editor`；开发时从本模块往上找仓库里的 `apps/slides-editor/dist`。都没有时 null。
 * 环境变量指的目录里没有 `index.html` 也是 null。
 */
export function resolveSlidesEditorDist(env: NodeJS.ProcessEnv = process.env): string | null {
  const given = env.CUCCUT_SLIDES_EDITOR_DIST;
  if (given) return fs.existsSync(path.join(given, 'index.html')) ? given : null;
  const resources = (process as { resourcesPath?: string }).resourcesPath;
  if (resources) {
    const bundled = path.join(resources, 'slides-editor');
    if (fs.existsSync(path.join(bundled, 'index.html'))) return bundled;
  }
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (;;) {
    const built = path.join(dir, 'apps', 'slides-editor', 'dist');
    if (fs.existsSync(path.join(built, 'index.html'))) return built;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

const require = createRequire(import.meta.url);
const loaded = new Map<string, SlidesRuntime>();

/** 构建目录里有没有编译器。 */
export function compilerAvailable(dist: string | null = resolveSlidesEditorDist()): dist is string {
  return dist !== null && fs.existsSync(path.join(dist, COMPILER_FILE));
}

/** 加载构建目录里的编译器（同一个目录只加载一次）。没有时抛错，由调用方转成给人或模型看的说明。 */
export function loadSlidesCompiler(dist: string | null = resolveSlidesEditorDist()): SlidesRuntime {
  if (!compilerAvailable(dist)) throw new Error('slides compiler is not built');
  const file = path.join(dist, COMPILER_FILE);
  let runtime = loaded.get(file);
  if (!runtime) {
    runtime = (require(file) as { runtime: SlidesRuntime }).runtime;
    loaded.set(file, runtime);
  }
  return runtime;
}
