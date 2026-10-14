// Model-data check for the main-process output (`npm run check:model-assets`): model data that ships with the app and is read by path (self-test samples, reference recordings for built-in voices)
// must actually exist at the locations resolved inside the built `out/main`. For the rules see repository conventions §2; for what the check depends on see development process §2.
//
// It runs the output's self-check entry `out/main/model-assets-check.js` with Electron's bundled Node (`ELECTRON_RUN_AS_NODE`, the same way the desktop app starts the Runtime). That entry calls the same resolver function the Runtime uses and prints one line of JSON; here each file is checked one by one. It runs twice:
// 1. In place: a development build (`npm run dev`, `npm start`) finds `packages/models/assets` in the repository;
// 2. Simulated packaging: copies `out/main` to a temporary directory outside the repository, copies the model data to `<temp>/resources/model-assets`, and provides `CUCCUT_MODEL_ASSETS_DIR` the way the main process does after packaging; every file must resolve there. With the same copy but no environment variable, nothing should be found (proving that it is not being covered by the repository).
// It does not start the Runtime, does not touch the app data directory, and does not use the network. Exit codes: 0 pass, 1 fail, 2 failed to start.

import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_MAIN = resolve(HERE, '../out/main');
const SOURCE_ASSETS = resolve(HERE, '../../../packages/models/assets');
const ENTRY = 'model-assets-check.js';
const TIMEOUT_MS = 30_000;

if (!existsSync(join(OUT_MAIN, ENTRY))) {
  console.error(`Missing ${join(OUT_MAIN, ENTRY)}: run npm run build first`);
  process.exit(2);
}
const { default: electron } = await import('electron');

/** Runs the self-check entry once with Electron's Node; when `assetsDir` is null, `CUCCUT_MODEL_ASSETS_DIR` is not provided. */
function resolveIn(mainDir, assetsDir) {
  const env = { ...process.env, ELECTRON_RUN_AS_NODE: '1' };
  delete env.CUCCUT_MODEL_ASSETS_DIR;
  if (assetsDir) env.CUCCUT_MODEL_ASSETS_DIR = assetsDir;
  const run = spawnSync(electron, [join(mainDir, ENTRY)], { env, encoding: 'utf8', timeout: TIMEOUT_MS });
  if (run.error || run.status !== 0) {
    console.error(`Self-check entry failed to run (${run.error?.message ?? `exit code ${run.status}`})\n${run.stderr ?? ''}`);
    process.exit(2);
  }
  return JSON.parse(run.stdout.trim().split('\n').at(-1));
}

function isFile(file) {
  try {
    const stat = statSync(file);
    return stat.isFile() && stat.size > 0;
  } catch {
    return false;
  }
}

function inside(dir, file) {
  const rel = relative(dir, file);
  return rel !== '' && !rel.startsWith('..') && !rel.startsWith(sep);
}

const problems = [];
const report = [];

// 1. In place.
const local = resolveIn(OUT_MAIN, null);
if (local.files.length < 2) problems.push(`In place: resolved only ${local.files.length} files, expected a self-test sample and the built-in voices`);
if (local.dir !== SOURCE_ASSETS) problems.push(`In place: model data directory is ${local.dir}, expected the repository's ${SOURCE_ASSETS}`);
for (const { asset, file } of local.files) {
  if (!file || !isFile(file)) problems.push(`In place: ${asset} resolved to ${file ?? '(directory not found)'}, but no file is there`);
}
report.push(`In place: ${local.files.length} files, all in ${local.dir}`);

// 2. Simulated packaging.
const temp = mkdtempSync(join(tmpdir(), 'cuccut-model-assets-'));
try {
  const main = join(temp, 'app', 'out', 'main');
  const assets = join(temp, 'resources', 'model-assets');
  cpSync(OUT_MAIN, main, { recursive: true });
  cpSync(SOURCE_ASSETS, assets, { recursive: true });
  const packaged = resolveIn(main, assets);
  if (packaged.files.length !== local.files.length)
    problems.push(`Simulated packaging: resolved ${packaged.files.length} files, in place there were ${local.files.length}`);
  for (const { asset, file } of packaged.files) {
    if (!file || !inside(assets, file) || !isFile(file))
      problems.push(`Simulated packaging: ${asset} resolved to ${file ?? '(directory not found)'}, not a file in ${assets}`);
  }
  report.push(`Simulated packaging: ${packaged.files.length} files, all in <resources>/model-assets`);
  const bare = resolveIn(main, null);
  if (bare.dir !== null) problems.push(`Simulated packaging: still found ${bare.dir} without CUCCUT_MODEL_ASSETS_DIR (should not be found)`);
} finally {
  rmSync(temp, { recursive: true, force: true });
}

if (problems.length > 0) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(`Model data check passed:\n  ${report.join('\n  ')}`);
