import fs from 'node:fs';
import path from 'node:path';
import { findCargoBinary } from './cargo-target.ts';

/** Environment variable for the directory of native executables distributed with the app: after the desktop app is packaged, the main process provides `<resources>/bin`. */
export const BIN_DIR_ENV = 'CUCCUT_BIN_DIR';

/** Subdirectory of the packaged resources directory that holds native executables (the Workers, the credential helper, and the DLLs they need). */
export const RESOURCES_BIN_DIR = 'bin';

/** Executable name: `.exe` is appended on Windows. */
export function executableName(name: string, platform: NodeJS.Platform = process.platform): string {
  return platform === 'win32' ? `${name}.exe` : name;
}

/**
 * Finds the native executables built with CucCut (the `engine-host` and `model-worker` Workers, and `credential-helper`); `name` has no suffix.
 * The caller first checks each tool's own environment variable (`CUCCUT_ENGINE_HOST` and so on); here the search order is:
 * 1. `CUCCUT_BIN_DIR`: if it is set, search only there; if nothing is found, there is nothing, and no other source is tried;
 * 2. the packaged `<resources>/bin` (`process.resourcesPath`; the Runtime, when run as Node, may not have it, so the main process passes it through 1);
 * 3. walking up from `startDir`, `{release,debug}/<name>` in the cargo output directory (in development, built by `npm run build:engine`).
 */
export function findBundledBinary(
  name: string,
  startDir: string,
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): string | null {
  const exe = executableName(name, platform);
  if (env[BIN_DIR_ENV]) {
    const candidate = path.join(env[BIN_DIR_ENV], exe);
    return isFile(candidate) ? candidate : null;
  }
  const resources = (process as { resourcesPath?: string }).resourcesPath;
  if (resources) {
    const bundled = path.join(resources, RESOURCES_BIN_DIR, exe);
    if (isFile(bundled)) return bundled;
  }
  return findCargoBinary(startDir, exe, env);
}

function isFile(file: string): boolean {
  try {
    return fs.statSync(file).isFile();
  } catch {
    return false;
  }
}
