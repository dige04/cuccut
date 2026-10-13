// End-to-end benchmark for preview playback (`npm run bench:preview`, an optional check in development flow §2): the real UI (the renderer's production build, `file://`)
// connects in an Electron hidden window to an isolated Runtime, opens a video, drags the playhead a few times while stopped, then presses Play and plays a stretch, reporting the displayed frame rate, dropped frames, long tasks, main-thread time per tick, the deviation of the media elements from the schedule, and the response time of first play and of scrubbing.
//
// The same file has two roles. Run with node, it prepares the temp directories (Home, projects, downloads, Electron data), starts the isolated Runtime
// (`preview-bench-runtime.mts`: no agents registered, no keychain access, no LAN node discovery), launches Electron and enforces an overall time limit. When Electron runs it as the main process, it opens the hidden window and runs the benchmark. The page only allows file:, data:, blob: and the Runtime on loopback addresses; all other requests are blocked (no network).
//
// Scenarios: by default, ffmpeg-generated synthetic media (1080p 30 fps, 1080p 60 fps, portrait 9:16, each with Chinese and English captions);
// `--video <video directory>` (repeatable) measures local videos: it copies one into a temp project directory before opening it; linked media is read-only.
// Usage: node apps/desktop/tools/preview-bench.mjs [--video <dir>]... [--at <seconds>] [--seconds 10] [--window 1440x900]
//        [--dpr 2] [--json <output file>] [--screenshots <dir>] (screenshots the window after each scenario to check the preview's size and picture)
// Environment: CUCCUT_ENGINE_HOST (defaults to CARGO_TARGET_DIR, or debug/engine-host under the repo's target), CUCCUT_FFMPEG / CUCCUT_FFPROBE.
// Exit codes: 0 finished, 1 a scenario failed, 2 timed out or failed to start.

import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { cpus, loadavg, tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '../out');
const ROOT = resolve(HERE, '../../..');
/** The time limit for each scenario (open, scrub, play) in Electron; the outer limit allows some extra time on top of the number of scenarios. */
const SCENE_TIMEOUT_MS = 120_000;
const OPEN_TIMEOUT_MS = 60_000;

// No top-level await: Electron does not emit ready until the ESM main-process module has finished evaluating, so waiting for ready at the top level would deadlock.
(process.versions.electron ? bench() : launch()).catch((error) => {
  console.error(error);
  process.exit(2);
});

function parseOptions(argv) {
  const options = { videos: [], at: null, seconds: 10, window: { width: 1440, height: 900 }, dpr: 2, json: null, screenshots: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--video') options.videos.push(resolve(argv[++i]));
    else if (arg === '--at') options.at = Number(argv[++i]);
    else if (arg === '--seconds') options.seconds = Number(argv[++i]);
    else if (arg === '--window') {
      const [width, height] = argv[++i].split('x').map(Number);
      options.window = { width, height };
    } else if (arg === '--dpr') options.dpr = Number(argv[++i]);
    else if (arg === '--json') options.json = resolve(argv[++i]);
    else if (arg === '--screenshots') options.screenshots = resolve(argv[++i]);
    else throw new Error(`不认识的参数 ${arg}`);
  }
  return options;
}

/** Synthetic media: a test pattern plus a sine tone, 12 seconds. */
const SYNTHETIC = [
  { name: '合成 1080p30 + 双语字幕', width: 1920, height: 1080, fps: 30 },
  { name: '合成 1080p60 + 双语字幕', width: 1920, height: 1080, fps: 60 },
  { name: '合成 9比16 + 双语字幕', width: 1080, height: 1920, fps: 30 },
];

/** Node side: the temp directories, the media, and the isolated Runtime; starts Electron, kills it on timeout, and after finishing stops the Runtime and deletes the temp directories. */
async function launch() {
  const options = parseOptions(process.argv.slice(2));
  for (const file of ['renderer/index.html', 'preload/index.js']) {
    if (!existsSync(join(OUT, file))) {
      console.error(`没有 ${join(OUT, file)}：先运行 npm run build`);
      process.exit(2);
    }
  }
  const engineHost = process.env.CUCCUT_ENGINE_HOST || join(process.env.CARGO_TARGET_DIR || join(ROOT, 'target'), 'debug/engine-host');
  if (!existsSync(engineHost)) {
    console.error(`没有 ${engineHost}：先 cargo build -p engine-host`);
    process.exit(2);
  }
  const { spawn, spawnSync } = await import('node:child_process');
  const { createInterface } = await import('node:readline');
  const ffmpeg = process.env.CUCCUT_FFMPEG || 'ffmpeg';
  const temp = mkdtempSync(join(tmpdir(), 'cuccut-preview-bench-'));
  const dirs = {
    home: join(temp, 'home'),
    projects: join(temp, 'projects'),
    downloads: join(temp, 'downloads'),
    media: join(temp, 'media'),
  };
  for (const dir of Object.values(dirs)) mkdirSync(dir);
  const project = join(dirs.projects, 'bench');
  mkdirSync(project);

  // A local video is copied once into the project directory (the video directory holds only a database and small files; linked media is read-only and is not copied).
  const copied = options.videos.map((dir) => {
    cpSync(dir, join(project, basename(dir)), { recursive: true });
    return { name: basename(dir), path: basename(dir) };
  });
  const synthetic = [];
  if (options.videos.length === 0) {
    for (const scene of SYNTHETIC) {
      const file = join(dirs.media, `${scene.width}x${scene.height}-${scene.fps}.mp4`);
      const made = spawnSync(ffmpeg, [
        ...['-v', 'error', '-f', 'lavfi', '-i', `testsrc2=size=${scene.width}x${scene.height}:rate=${scene.fps}:duration=12`],
        ...['-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=12'],
        ...['-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-g', String(scene.fps), '-c:a', 'aac', '-shortest', file],
      ]);
      if (made.status !== 0) throw new Error(`ffmpeg 生成合成素材失败：${made.stderr}`);
      synthetic.push({ ...scene, file });
    }
  }

  const env = {
    ...process.env,
    CUCCUT_HOME: dirs.home,
    CUCCUT_PROJECTS_DIR: dirs.projects,
    CUCCUT_DOWNLOADS_DIR: dirs.downloads,
    CUCCUT_ENGINE_HOST: engineHost,
    // Find PATH without a login shell (shell config is not run): ffprobe / ffmpeg use the current PATH or CUCCUT_FFPROBE / CUCCUT_FFMPEG.
    SHELL: '/usr/bin/false',
  };
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.ELECTRON_RENDERER_URL;

  const runtime = spawn(
    process.execPath,
    [join(HERE, 'preview-bench-runtime.mts'), '--project', project, '--synthetic', JSON.stringify(synthetic)],
    { env, stdio: ['ignore', 'pipe', 'inherit'] },
  );
  const ready = await new Promise((done) => {
    const timer = setTimeout(() => done(null), 120_000);
    runtime.on('exit', () => done(null));
    createInterface({ input: runtime.stdout }).on('line', (line) => {
      try {
        const message = JSON.parse(line);
        if (message.type === 'ready') {
          clearTimeout(timer);
          done(message);
        }
      } catch {
        // Not the ready message; ignore it.
      }
    });
  });
  const cleanup = () => {
    runtime.kill('SIGTERM');
    // The Runtime still writes a few more things after receiving a signal: the directory is not empty yet after deleting, so delete it again a little later.
    rmSync(temp, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  };
  if (!ready) {
    console.error('隔离的 Runtime 没有起来');
    cleanup();
    process.exit(2);
  }

  const scenes = [...ready.videos, ...copied];
  const { default: electron } = await import('electron');
  const job = {
    temp,
    home: dirs.home,
    projectId: ready.projectId,
    scenes,
    ...options,
    load: `${loadavg()[0].toFixed(1)}/${cpus().length}`,
  };
  writeFileSync(join(temp, 'job.json'), JSON.stringify(job));
  const child = spawn(electron, [fileURLToPath(import.meta.url), `--cuccut-temp=${temp}`, `--force-device-scale-factor=${options.dpr}`], {
    env,
    stdio: ['ignore', 'inherit', 'inherit'],
  });
  const limit = SCENE_TIMEOUT_MS * scenes.length + 30_000;
  const timer = setTimeout(() => {
    console.error(`Electron ${limit / 1000} 秒没有结束，杀掉`);
    child.kill('SIGKILL');
  }, limit);
  const code = await new Promise((done) => {
    child.on('error', (error) => {
      console.error('Electron 起不来', error);
      done(2);
    });
    child.on('exit', (exitCode, signal) => done(exitCode ?? (signal ? 2 : 1)));
  });
  clearTimeout(timer);
  const results = existsSync(join(temp, 'results.json')) ? JSON.parse(readFileSync(join(temp, 'results.json'), 'utf8')) : [];
  if (options.json) writeFileSync(options.json, JSON.stringify({ load: job.load, results }, null, 1));
  cleanup();
  process.exit(code);
}

/** Electron side: the hidden window opens the build output via file://, answers the Runtime's connection, and calls the benchmark entry for each scenario in turn. */
async function bench() {
  const { app, BrowserWindow, ipcMain, session } = await import('electron');
  const temp = process.argv.find((arg) => arg.startsWith('--cuccut-temp='))?.slice('--cuccut-temp='.length);
  if (!temp) throw new Error('缺少 --cuccut-temp：用 node 运行这个脚本');
  const job = JSON.parse(readFileSync(join(temp, 'job.json'), 'utf8'));
  for (const name of ['userData', 'sessionData', 'logs', 'crashDumps']) app.setPath(name, join(temp, 'electron', name));
  app.dock?.hide();

  const notes = [];
  const results = [];
  const finish = (code, message) => {
    writeFileSync(join(temp, 'results.json'), JSON.stringify(results));
    if (code !== 0) for (const note of notes.slice(-40)) console.error(note);
    if (message) (code === 0 ? console.log : console.error)(message);
    app.exit(code);
  };
  setTimeout(
    () => finish(2, `基准 ${(SCENE_TIMEOUT_MS * job.scenes.length) / 1000} 秒没有结束`),
    SCENE_TIMEOUT_MS * job.scenes.length,
  ).unref();
  app.on('window-all-closed', () => {});

  await app.whenReady();
  const blocked = [];
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const local = /^(file|data|blob|devtools):/.test(details.url) || /^(ws|http):\/\/127\.0\.0\.1:\d+\//.test(details.url);
    if (!local) blocked.push(details.url);
    callback({ cancel: !local });
  });
  // The Runtime connection is read from the discovery file in the isolated Home (the same source as the desktop main process); updates are not checked.
  ipcMain.handle('cuccut:connection', () => {
    const discovery = JSON.parse(readFileSync(join(job.home, 'runtime.json'), 'utf8'));
    return { endpoint: discovery.endpoint, token: discovery.token };
  });
  ipcMain.handle('cuccut:updates-get', () => new Promise(() => {}));

  const win = new BrowserWindow({
    show: false,
    width: job.window.width,
    height: job.window.height,
    paintWhenInitiallyHidden: true,
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
  win.webContents.on('render-process-gone', (_event, details) => finish(1, `渲染进程退出：${details.reason}`));

  const { readdirSync } = await import('node:fs');
  const assets = join(OUT, 'renderer/assets');
  const entry = readdirSync(assets).find((name) => /^preview-bench-.*\.js$/.test(name));
  if (!entry) return finish(1, `${assets} 里没有基准入口 preview-bench-*.js：渲染进程的构建没有带上它`);

  await win.loadFile(join(OUT, 'renderer/index.html'));
  await win.webContents.executeJavaScript(`import(${JSON.stringify(pathToFileURL(join(assets, entry)).href)}).then(() => true)`, true);
  console.log(`负载 ${job.load}，窗口 ${job.window.width}×${job.window.height}，像素比 ${job.dpr}，每段放 ${job.seconds} 秒`);
  let failed = 0;
  for (const scene of job.scenes) {
    const input = { projectId: job.projectId, path: scene.path, at: job.at ?? 0, seconds: job.seconds, openTimeoutMs: OPEN_TIMEOUT_MS };
    try {
      const result = await win.webContents.executeJavaScript(`globalThis.cuccutPreviewBench(${JSON.stringify(input)})`, true);
      results.push({ scene: scene.name, ...result });
      print(scene.name, result);
      if (job.screenshots) {
        mkdirSync(job.screenshots, { recursive: true });
        const image = await win.webContents.capturePage();
        writeFileSync(join(job.screenshots, `${results.length}.png`), image.toPNG());
      }
    } catch (error) {
      failed++;
      results.push({ scene: scene.name, error: error instanceof Error ? error.message : String(error) });
      console.error(`${scene.name}：${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (blocked.length > 0) console.log(`拦下的网络请求 ${blocked.length} 个：${[...new Set(blocked)].slice(0, 5).join('、')}`);
  finish(failed > 0 ? 1 : 0, null);
}

function print(name, r) {
  const q = (value) => `${value.p50}/${value.p95}/${value.max}`;
  console.log(
    `${name}：${r.canvas.width}×${r.canvas.height} 画成 ${r.size ? `${r.size.width}×${r.size.height}` : '—'}（${r.visibility}）` +
      ` · 画上去 ${r.presentedFps} fps（视频 ${r.sourceFps} fps，掉 ${r.droppedFrames}/${r.spannedFrames} 帧，留旧帧 ${r.stats.held} 次）` +
      ` · 首帧 ${r.firstFrameMs ?? '—'} ms · 打开 ${r.openMs} ms（精确帧 ${r.openExactMs ?? '—'} ms）`,
  );
  console.log(
    `  tick ms p50/p95/max ${q(r.tickMs)} · 送画面 ${q(r.uploadMs)} · 画 ${q(r.renderMs)} · rAF 间隔 ${q(r.rafIntervalMs)}` +
      ` · 长任务 ${r.longTasks.count} 个（第一秒 ${r.longTasks.firstSecond}，最长 ${r.longTasks.maxMs} ms）` +
      ` · 偏差 ms ${q(r.driftMs)} · 重新定位 ${r.stats.resyncs} · waiting ${r.waiting} · 拖动 ms ${q(r.scrubMs)}` +
      `（停下到精确帧 ${r.scrubSettleMs ?? '—'}）· 跳转 ms 首帧/精确帧 ${r.jumpMs.first ?? '—'}/${r.jumpMs.exact ?? '—'}`,
  );
}
