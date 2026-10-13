// Entry point for `npm run dev`: runs `electron-vite dev` under the supervision of dev-process-group.mjs (command-line arguments are passed through unchanged). When the terminal is closed, Ctrl+C is pressed, or the upper layer stops it by pid, electron-vite, Electron and the Runtime shut down together, and anything stuck is force-killed.

import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { superviseDevProcess } from './dev-process-group.mjs';

const desktopDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Runs electron-vite's entry point directly with the current Node: it does not go through `node_modules/.bin` (on Windows that is a .cmd file, which would need a shell).
const require = createRequire(import.meta.url);
const manifestPath = require.resolve('electron-vite/package.json');
const entry = path.join(path.dirname(manifestPath), require(manifestPath).bin['electron-vite']);

superviseDevProcess(process.execPath, [entry, 'dev', ...process.argv.slice(2)], { cwd: desktopDir });
