import fs from 'node:fs';
import path from 'node:path';

/** Reads the `target-dir` in the `[build]` section of `.cargo/<file>` (only a single-line string is accepted; that is enough, and no TOML dependency is added). */
function readConfiguredTargetDir(cargoDir: string): string | null {
  for (const file of ['config.local.toml', 'config.toml']) {
    let text: string;
    try {
      text = fs.readFileSync(path.join(cargoDir, file), 'utf8');
    } catch {
      continue;
    }
    let inBuild = false;
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      const section = /^\[([^\]]+)\]$/.exec(line);
      if (section) inBuild = section[1]?.trim() === 'build';
      else if (inBuild) {
        const match = /^target-dir\s*=\s*(["'])(.*?)\1/.exec(line);
        if (match?.[2] !== undefined) return match[2];
      }
    }
  }
  return null;
}

/**
 * Walking up from `startDir`, lists the directories where cargo output may be: `CARGO_TARGET_DIR`, the `build.target-dir` in each level's `.cargo/config*.toml` (on this machine it can be moved to an external drive through the uncommitted `config.local.toml`), and the default `<dir>/target`.
 */
export function* cargoTargetDirs(startDir: string, env: NodeJS.ProcessEnv = process.env): Generator<string> {
  if (env.CARGO_TARGET_DIR) yield path.resolve(env.CARGO_TARGET_DIR);
  let dir = startDir;
  for (;;) {
    const configured = readConfiguredTargetDir(path.join(dir, '.cargo'));
    if (configured) yield path.resolve(dir, configured);
    yield path.join(dir, 'target');
    const parent = path.dirname(dir);
    if (parent === dir) return;
    dir = parent;
  }
}

/** Finds `{release,debug}/<exe>` in the cargo output directories. */
export function findCargoBinary(startDir: string, exe: string, env: NodeJS.ProcessEnv = process.env): string | null {
  for (const targetDir of cargoTargetDirs(startDir, env)) {
    for (const profile of ['release', 'debug']) {
      const candidate = path.join(targetDir, profile, exe);
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return null;
}
