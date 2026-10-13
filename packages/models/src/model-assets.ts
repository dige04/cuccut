import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RpcError } from '@cuccut/protocol';
import { ModelsModelAssets as M } from '@cuccut/protocol/messages/models/model-assets.ts';
import type { ModelText } from './model-text.ts';

/**
 * Model data shipped with the app and read by path (`packages/models/assets/`: self-test samples, reference recordings for built-in voices). The path is handed to the Model Worker to read, so it must be a real file on disk, not inside asar.
 *
 * Do not use `new URL('../assets/…', import.meta.url)`: after the Runtime is bundled into the desktop app's `out/main/runtime.js`, `import.meta.url` is the bundle, so the relative path points to `out/assets/`. Use the same approach as the built-in templates (`resolveBuiltinTemplatesDir`), searching in this order:
 * 1. the `CUCCUT_MODEL_ASSETS_DIR` environment variable (in a packaged app the main process provides `<resources>/model-assets`);
 * 2. the packaged resource directory `<resources>/model-assets`;
 * 3. walk up from this module to find `packages/models/assets` in the repository (running from source, tests, the CLI, and development desktop builds).
 */
export const MODEL_ASSETS_ENV = 'CUCCUT_MODEL_ASSETS_DIR';

const RESOURCES_DIR = 'model-assets';
const IN_REPO = path.join('packages', 'models', 'assets');

/** Model data directory; null if none is found. Searches again on every call (the environment variable is read at call time). */
export function resolveModelAssetsDir(env: NodeJS.ProcessEnv = process.env): string | null {
  if (env[MODEL_ASSETS_ENV]) return env[MODEL_ASSETS_ENV];
  const resources = (process as { resourcesPath?: string }).resourcesPath;
  if (resources) {
    const bundled = path.join(resources, RESOURCES_DIR);
    if (isDirectory(bundled)) return bundled;
  }
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (;;) {
    const candidate = path.join(dir, IN_REPO);
    if (isDirectory(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/**
 * Absolute path of a file shipped with the app (`asset` is a path relative to the model data directory, separated by `/`); null when the directory cannot be found. Does not check whether the file exists: where it is read, a read failure is reported as `appFileMissing`.
 */
export function modelAssetPath(asset: string, env: NodeJS.ProcessEnv = process.env): string | null {
  const dir = resolveModelAssetsDir(env);
  return dir ? path.join(dir, ...asset.split('/')) : null;
}

function isDirectory(dir: string): boolean {
  try {
    return fs.statSync(dir).isDirectory();
  } catch {
    return false;
  }
}

/** Error code for a file shipped with the app that is missing or cannot be read (command and protocol spec §11.3). */
export const APP_FILE_MISSING = 'APP_FILE_MISSING';

/**
 * A file shipped with the app is missing or cannot be read: this is an installation problem, not user input, nor a model problem. `what` is the name shown to people (“识别检查的样本”, the recognition check sample). The sentence does not include the path: `details.asset` is the relative path within the model data directory (null if unknown), and the expected location is in `details.file` (null if the model data directory cannot be found). `RpcError.code` is `conflict`, and the error code is in `details.code`.
 */
export function appFileMissing(what: ModelText, asset: string | null, file: string | null): RpcError {
  return new RpcError('conflict', M.appFileMissing({ what }), {
    code: APP_FILE_MISSING,
    asset,
    file,
  });
}
