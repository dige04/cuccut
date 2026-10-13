/**
 * Build output of the design canvas editor (docs/design/canvas §3): `npm run build:design-editor` builds into `apps/design-editor/dist/`.
 * When not built, this directory does not exist: `design.open` still gives the address, `editorAvailable` is false, and the page returns 503.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Finds the editor's build output directory (it contains `index.html`): the `CUCCUT_DESIGN_EDITOR_DIST` environment variable. In the packaged app it is
 * `<resources>/design-editor`; in development it walks up from this module to find `apps/design-editor/dist` in the repo. null if none.
 * A directory given by the environment variable that has no `index.html` is also null.
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
