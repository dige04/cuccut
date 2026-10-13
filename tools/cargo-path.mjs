// Make sure the build scripts can find cargo. If it is not on PATH, look in CARGO_HOME/bin (default ~/.cargo/bin), then in the directory where rustup itself lives:
// Homebrew's rustup is keg-only: the cargo and rustc proxies exist only in its own bin directory and are not linked into Homebrew's bin;
// with rustup-init, processes started from the GUI often also lack ~/.cargo/bin.
// When found, prepend it to this process's PATH, so later cargo, rustc and rustup runs, and the tools cargo starts, all come from there.

import { existsSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';

const suffix = process.platform === 'win32' ? '.exe' : '';

function find(name, dirs) {
  return dirs.map((dir) => join(dir, name + suffix)).find((file) => existsSync(file));
}

/** Make sure cargo is on PATH. With required=false, return false when it is missing; by default, prompt to install Rust and exit with a non-zero code. */
export function ensureCargo(required = true) {
  const dirs = (process.env.PATH ?? '').split(delimiter).filter(Boolean);
  if (find('cargo', dirs)) return true;
  const rustup = find('rustup', dirs);
  const candidates = [join(process.env.CARGO_HOME || join(homedir(), '.cargo'), 'bin')];
  if (rustup) candidates.push(dirname(realpathSync(rustup)));
  const cargo = find('cargo', candidates);
  if (!cargo) {
    if (!required) return false;
    console.error('Cargo not found. Install Rust: https://rustup.rs. See README.md#run-from-source or run npm run dev:lite.');
    process.exit(1);
  }
  console.log(`PATH 里没有 cargo，改用 ${cargo}`);
  process.env.PATH = [dirname(cargo), ...dirs].join(delimiter);
  return true;
}
