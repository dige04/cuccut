/**
 * 设计稿编辑器的构建产物（docs/design/canvas §3）：`npm run build:design-editor` 构建到 `apps/design-editor/dist/`。
 * 没构建时这个目录不存在：`design.open` 照常给地址、`editorAvailable` 为 false，页面回 503。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * 找编辑器的构建产物目录（里面有 `index.html`）：`CUCCUT_DESIGN_EDITOR_DIST` 环境变量；打包后的应用里是
 * `<resources>/design-editor`；开发时从本模块往上找仓库里的 `apps/design-editor/dist`。都没有时 null。
 * 环境变量指的目录里没有 `index.html` 也是 null。
 */
export function resolveDesignEditorDist(env: NodeJS.ProcessEnv = process.env): string | null {
  const given = env.CUCCUT_DESIGN_EDITOR_DIST;
  if (given) return fs.existsSync(path.join(given, 'index.html')) ? given : null;
  const resources = (process as { resourcesPath?: string }).resourcesPath;
  if (resources) {
    const bundled = path.join(resources, 'design-editor');
    if (fs.existsSync(path.join(bundled, 'index.html'))) return bundled;
  }
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (;;) {
    const built = path.join(dir, 'apps', 'design-editor', 'dist');
    if (fs.existsSync(path.join(built, 'index.html'))) return built;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}
