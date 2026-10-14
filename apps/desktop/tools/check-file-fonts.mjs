// Font check for the packaged output (`npm run check:file-fonts`): opens the renderer's production build (`out/renderer/index.html`) under file:// in Electron,
// goes through the output's self-check entry (`src/renderer/kernel-check.ts`) on the same loading path as the preview, verifies that the rendering kernel got every font shipped with the output,
// and measures one text box through the kernel. For the rules see architecture design §9.1; for what the check depends on see development process §2.
//
// One file with two roles: run by node, it prepares a temporary directory, starts Electron and enforces an overall time limit; when Electron runs it as its main process, it performs the check.
// The check's own main process opens only one hidden window: it does not start the Runtime (so it does not touch the keychain or start any agent), does not read or write the real app data directory,
// and blocks every request except file:, data: and blob: (no network). Exit codes: 0 pass, 1 fail, 2 timeout or failed to start.

import { mkdirSync, mkdtempSync, readdirSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// --out=<Resources/app.asar/out> also checks the final packaged font layout.
const OUT = resolve(process.argv.find((arg) => arg.startsWith('--out='))?.slice(6) ?? resolve(dirname(fileURLToPath(import.meta.url)), '../out'));
/** The check's own time limit inside Electron; the outer limit is set somewhat longer, so that even if Electron fails to start or hangs, it is still stopped. */
const CHECK_TIMEOUT_MS = 60_000;
const LAUNCH_TIMEOUT_MS = 90_000;
/** Font file names in the output are `<original name>-<8-character hash>.ttf`. */
const HASHED_FONT = /^(.+)-[A-Za-z0-9_-]{8}\.ttf$/;

// No top-level await: Electron does not emit ready until the ESM main-process module has finished evaluating, so awaiting ready at the top level would hang.
(process.versions.electron ? check() : launch()).catch((error) => {
  console.error(error);
  process.exit(2);
});

/** Node side: creates temporary Home, project, downloads and Electron data directories, starts Electron, kills it on timeout, and deletes the temporary directories when done. */
async function launch() {
  for (const file of ['renderer/index.html', 'preload/index.js']) {
    // Plain Node cannot read ASAR paths; the Electron child validates them.
    if (!OUT.includes('app.asar') && !existsSync(join(OUT, file))) {
      console.error(`Missing ${join(OUT, file)}: run npm run build first`);
      process.exit(2);
    }
  }
  const { default: electron } = await import('electron');
  const temp = mkdtempSync(join(tmpdir(), 'cuccut-file-fonts-'));
  const dirs = { home: join(temp, 'home'), projects: join(temp, 'projects'), downloads: join(temp, 'downloads') };
  for (const dir of Object.values(dirs)) mkdirSync(dir);
  const env = { ...process.env, CUCCUT_HOME: dirs.home, CUCCUT_PROJECTS_DIR: dirs.projects, CUCCUT_DOWNLOADS_DIR: dirs.downloads };
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.ELECTRON_RENDERER_URL;
  const { spawn } = await import('node:child_process');
  const child = spawn(electron, [fileURLToPath(import.meta.url), `--cuccut-temp=${temp}`, `--out=${OUT}`], {
    env,
    stdio: ['ignore', 'inherit', 'inherit'],
  });
  const timer = setTimeout(() => {
    console.error(`Electron did not exit within ${LAUNCH_TIMEOUT_MS / 1000} s, killing it`);
    child.kill('SIGKILL');
  }, LAUNCH_TIMEOUT_MS);
  const code = await new Promise((done) => {
    child.on('error', (error) => {
      console.error('Electron failed to start', error);
      done(2);
    });
    child.on('exit', (exitCode, signal) => done(exitCode ?? (signal ? 2 : 1)));
  });
  clearTimeout(timer);
  rmSync(temp, { recursive: true, force: true });
  process.exit(code);
}

/** Electron side: the hidden window opens the output under file://, calls the self-check entry, and verifies the fonts and the measured box. */
async function check() {
  const { app, BrowserWindow, ipcMain, session } = await import('electron');
  const temp = process.argv.find((arg) => arg.startsWith('--cuccut-temp='))?.slice('--cuccut-temp='.length);
  if (!temp) throw new Error('Missing --cuccut-temp: run this script with node');
  // Electron's own data (cache, cookies, logs, crash dumps) also goes into the temporary directory.
  for (const name of ['userData', 'sessionData', 'logs', 'crashDumps']) app.setPath(name, join(temp, 'electron', name));
  app.dock?.hide();

  const notes = [];
  const finish = (code, message) => {
    if (code !== 0) for (const note of notes) console.error(note);
    (code === 0 ? console.log : console.error)(message);
    app.exit(code);
  };
  setTimeout(() => finish(2, `Check did not finish within ${CHECK_TIMEOUT_MS / 1000} s`), CHECK_TIMEOUT_MS).unref();
  app.on('window-all-closed', () => {});

  await app.whenReady();
  const blocked = [];
  const fontLoads = new Map();
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const local = /^(file|data|blob|devtools):/.test(details.url);
    if (!local) blocked.push(details.url);
    callback({ cancel: !local });
  });
  session.defaultSession.webRequest.onCompleted({ urls: ['file://*/*'] }, (details) => {
    if (details.url.endsWith('.ttf')) fontLoads.set(basename(fileURLToPath(details.url)), details.statusCode);
  });
  // The page still asks the main process for the Runtime connection and update status as usual: here the Runtime is not started and updates are not checked, so it never answers (the page stays at “connecting”).
  for (const channel of ['cuccut:connection', 'cuccut:updates-get']) ipcMain.handle(channel, () => new Promise(() => {}));

  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: join(OUT, 'preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
      backgroundThrottling: false,
    },
  });
  win.webContents.on('console-message', ({ level, message }) => notes.push(`[renderer:${level}] ${message}`));
  win.webContents.on('render-process-gone', (_event, details) => finish(1, `Renderer process exited: ${details.reason}`));

  const assets = join(OUT, 'renderer/assets');
  let shipped = readdirSync(assets).flatMap((name) => {
    const match = HASHED_FONT.exec(name);
    return match ? [{ file: name, font: `${match[1]}.ttf` }] : [];
  });
  if (shipped.length === 0) {
    const manifest = JSON.parse(readFileSync(resolve(OUT, '../../web/assets/bundled-fonts.json'), 'utf8'));
    shipped = Object.entries(manifest).map(([font, file]) => ({ font, file }));
  }
  const entry = readdirSync(assets).find((name) => /^kernel-check-.*\.js$/.test(name));
  if (!entry) return finish(1, `${assets} has no self-check entry kernel-check-*.js: the renderer build did not include it`);

  try {
    await win.loadFile(join(OUT, 'renderer/index.html'));
    const page = win.webContents.getURL();
    if (!page.startsWith('file:')) return finish(1, `Page is not under file://: ${page}`);
    const result = await win.webContents.executeJavaScript(
      `import(${JSON.stringify(pathToFileURL(join(assets, entry)).href)}).then(() => globalThis.cuccutKernelCheck())`,
      true,
    );
    const injected = [...result.fonts].sort();
    const expected = shipped.map((item) => item.font).sort();
    const problems = [];
    if (expected.length === 0) problems.push('No fonts in the output');
    if (JSON.stringify(injected) !== JSON.stringify(expected)) {
      const missing = expected.filter((name) => !injected.includes(name));
      const extra = injected.filter((name) => !expected.includes(name));
      problems.push(
        `Fonts injected by the kernel differ from the output: in the output but not the kernel ${missing.join(', ') || 'none'}; kernel wants but not in the output ${extra.join(', ') || 'none'}`,
      );
    }
    // Font-reading XHRs under file:// have no HTTP status (0) or 200; each request has to be seen individually.
    const unread = shipped.filter((item) => ![0, 200].includes(fontLoads.get(item.file)));
    if (unread.length > 0) problems.push(`These fonts were not seen loading successfully via file://: ${unread.map((item) => item.file).join(', ')}`);
    if (!(result.box.width > 0 && result.box.height > 0)) problems.push(`Kernel measured an invalid box: ${JSON.stringify(result.box)}`);
    if (problems.length > 0) return finish(1, problems.join('\n'));
    finish(
      0,
      `file:// font check passed: ${page}\n` +
        `  ${injected.length} font(s) read via file:// and injected into the rendering kernel; box measured by the kernel ${result.box.width}×${result.box.height}; ` +
        `blocked network requests: ${blocked.length}`,
    );
  } catch (error) {
    finish(1, `Rendering kernel failed to load: ${error instanceof Error ? error.message : String(error)}`);
  }
}
