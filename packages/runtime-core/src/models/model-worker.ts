import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { findBundledBinary } from '@cuccut/process-host';

/** Command that starts the Model Worker. The Runtime appends `--parent-pid <pid>` after `args`. */
export interface ModelWorkerCommand {
  command: string;
  args?: string[];
}

/**
 * Finds the Model Worker executable: the `CUCCUT_MODEL_WORKER` environment variable; the native program directory shipped with the app (`CUCCUT_BIN_DIR`, packaged `<resources>/bin`);
 * or, from this module, walks up to find `{release,debug}/model-worker` in the cargo output directory (development builds use cargo; the directory follows `build.target-dir` in `.cargo/config*.toml`).
 * Returns null when none is found: local inference is unavailable.
 */
export function resolveModelWorkerCommand(env: NodeJS.ProcessEnv = process.env): ModelWorkerCommand | null {
  if (env.CUCCUT_MODEL_WORKER) return { command: env.CUCCUT_MODEL_WORKER };
  const found = findBundledBinary('model-worker', path.dirname(fileURLToPath(import.meta.url)), env);
  return found ? { command: found } : null;
}
