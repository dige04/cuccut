/**
 * The editor build output and the compiler used in Node (docs/design/slides §3, §7.2).
 *
 * Building `apps/slides-editor` (`npm run build:slides-editor`) uses the workspace's @cuccut/slides-runtime to produce two things in the same directory:
 *   index.html, assets/**   the editor page, served by the runtime's slide routes
 *   node/compiler.cjs        a runtime that only loads modules and mounts no UI (createSlidesRuntime({ boot: false })); slides_check calls its compiler
 * When it has not been built, this directory does not exist: the slides tab shows a note that it is unavailable, slides_check reports an error, and the runtime still starts as usual.
 */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SlidesRuntime } from './compiler-contract.ts';

export type { SlidesRuntime } from './compiler-contract.ts';

/** Location of the compiler within the build directory. */
export const COMPILER_FILE = path.join('node', 'compiler.cjs');

/**
 * Finds the editor build output directory (containing `index.html`): the `CUCCUT_SLIDES_EDITOR_DIST` environment variable; in a packaged app it is
 * `<resources>/slides-editor`; in development, it walks up from this module to find `apps/slides-editor/dist` in the repo. Null if none of these exist.
 * A directory that the environment variable points to without `index.html` is also null.
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

/** Whether the build directory has a compiler. */
export function compilerAvailable(dist: string | null = resolveSlidesEditorDist()): dist is string {
  return dist !== null && fs.existsSync(path.join(dist, COMPILER_FILE));
}

/** Loads the compiler from the build directory (each directory is loaded only once). Throws when it is missing; the caller turns this into a message for people or models to read. */
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
