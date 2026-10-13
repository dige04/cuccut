import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

/**
 * Codex's config directory: `CODEX_HOME`, or `~/.codex` when unset. The environment given to the codex child process is checked first (including what the login shell sets), then this process's.
 */
export function codexHome(env: NodeJS.ProcessEnv): string {
  return env.CODEX_HOME || process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
}

/**
 * Which model codex uses when no model is passed: the top-level `model = "..."` in `config.toml`. Null when it cannot be read or is not set.
 * Only this one key is read, and credentials are not; no TOML dependency is introduced, and only `model = "..."` or `'...'` before the first table header (`[...]`) is recognized.
 * It does not follow `profile = "..."` to find overrides in `[profiles.<name>]`: under this kind of config, the model reported may not be the one actually used.
 */
export async function readCodexConfigModel(env: NodeJS.ProcessEnv): Promise<string | null> {
  let text: string;
  try {
    text = await fs.readFile(path.join(codexHome(env), 'config.toml'), 'utf8');
  } catch {
    return null;
  }
  return parseTopLevelModel(text);
}

export function parseTopLevelModel(toml: string): string | null {
  for (const raw of toml.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith('[')) return null;
    const match = /^model\s*=\s*(?:"((?:[^"\\]|\\.)*)"|'([^']*)')\s*(?:#.*)?$/.exec(line);
    if (match) {
      const value = match[1] !== undefined ? match[1].replace(/\\(.)/g, '$1') : (match[2] ?? '');
      return value.trim() || null;
    }
  }
  return null;
}
