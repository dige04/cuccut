// Self-check of the packaged output: runs `out/main/runtime.js --self-check --probe` inside the asar using the app's own executable in Node mode (`ELECTRON_RUN_AS_NODE`, the same way the main process starts the Runtime), with environment variables provided the way the main process does (`src/main/packaged-resources.ts`). Using the same resolver functions the Runtime uses to find things, it reports where each Worker, credential helper, built-in template and skill, model data, the web client and editor.wasm resolve to, and it starts each native program once and runs it through the handshake (missing DLLs and wrong architectures show up here). The code package's off-screen host is also started once (the app's executable is given `--composition-host`, which takes the host branch of the main-process entry).
// It can only run on the package's target platform (CI's Windows runner).
//
//   node apps/desktop/tools/check-packaged-app.mjs <app directory>   the app directory is the one containing CucCut.exe (win-unpacked or the install directory)
//   node apps/desktop/tools/check-packaged-app.mjs --dev             runs against the development build (out/main, using Electron from node_modules), without a resources directory
//
// It does not start the Runtime, does not touch the app data directory, and does not use the network. Exit codes: 0 pass, 1 fail, 2 failed to start.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { packagedResourceEnv, packagedResources } from '../src/main/packaged-resources.ts';
import { DISTRIBUTED_NOTICES } from '../../../tools/third-party-notices.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TIMEOUT_MS = 120_000;

const arg = process.argv[2];
if (!arg) {
  console.error('usage: check-packaged-app.mjs <app directory> | --dev');
  process.exit(2);
}

const env = { ...process.env, ELECTRON_RUN_AS_NODE: '1' };
// Do not let outside overrides replace the resolution being checked.
for (const name of [
  'CUCCUT_ENGINE_HOST',
  'CUCCUT_MODEL_WORKER',
  'CUCCUT_EXPORT_WORKER',
  'CUCCUT_SPEECH_WORKER',
  'CUCCUT_CREDENTIAL_HELPER',
  'CUCCUT_BIN_DIR',
  'CUCCUT_TEMPLATES_DIR',
  'CUCCUT_SKILLS_DIR',
  'CUCCUT_AGENT_SKILLS_DIR',
  'CUCCUT_MODEL_ASSETS_DIR',
  'CUCCUT_WEB_DIST',
  'CUCCUT_ELECTRON',
  'PMETAL_METALLIB_PATH',
]) {
  delete env[name];
}

let command;
let script;
if (arg === '--dev') {
  command = (await import('electron')).default;
  script = path.resolve(HERE, '../out/main/runtime.js');
} else {
  const appDir = path.resolve(arg);
  command = path.join(appDir, process.platform === 'darwin' ? 'Contents/MacOS/CucCut' : process.platform === 'win32' ? 'CucCut.exe' : 'CucCut');
  const resources = path.join(appDir, process.platform === 'darwin' ? 'Contents/Resources' : 'resources');
  for (const { source, fileName } of DISTRIBUTED_NOTICES) {
    const file = path.join(resources, fileName);
    if (!existsSync(file) || !readFileSync(file).equals(readFileSync(path.resolve(HERE, '../../..', source)))) {
      console.error(`third-party notice missing or differs from source: resources/${fileName}`);
      process.exit(1);
    }
  }
  script = path.join(resources, 'app.asar', 'out', 'main', 'runtime.js');
  Object.assign(env, packagedResourceEnv(packagedResources(resources)));
}
if (!existsSync(command)) {
  console.error(`${command} not found`);
  process.exit(2);
}

const run = spawnSync(command, [script, '--self-check', '--probe'], { env, encoding: 'utf8', timeout: TIMEOUT_MS, windowsHide: true });
if (run.error || run.stdout.trim() === '') {
  console.error(`self-check did not run (${run.error?.message ?? `exit code ${run.status}`})\n${run.stderr ?? ''}`);
  process.exit(2);
}
const report = JSON.parse(run.stdout.trim().split('\n').at(-1));
console.log(JSON.stringify(report, null, 2));
if (report.problems.length > 0) {
  console.error(`failed:\n- ${report.problems.join('\n- ')}`);
  process.exit(1);
}
console.log('passed');
