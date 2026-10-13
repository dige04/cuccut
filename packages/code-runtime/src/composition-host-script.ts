/**
 * The main-process script for the Electron off-screen host (CommonJS source, distributed as a string with the bundle).
 *
 * `composition-host.ts` writes it, together with `COMPOSITION_ADAPTER_SCRIPT`, into the cache directory as `host-<digest>.cjs`, and starts it with `<Electron> --composition-host <script>` (`hostSpawnArgs`).
 * The protocol is the same as `JsonLineWorker`: stdin receives one request `{id, method, params}` per line, and stdout emits one response or event per line. Logs go to stderr.
 *
 * - After startup (after `app.whenReady()`) it emits the event `ready`. It exits when stdin closes. There is no top-level await: `ready` is emitted only after the script has finished evaluating.
 * - `open`: one non-persistent partition and one hidden off-screen window per session. It intercepts `file:` requests outside the root directory, and all requests other than `data:` / `blob:` / `about:` / `devtools:` (event `networkBlocked`). It denies all permission requests, navigation and pop-ups.
 * - `frame`: serial within the same session. seek → read-back check → `invalidate()` and wait for one `paint` (up to 500 ms) → `capturePage()` screenshot.
 *   The read-back tolerance is half a frame at the sampling frame rate. The frame rate comes from the request's `fps` (the frame-fetch ticket), and when absent, from the `fps` given to `open` (the bundle's intrinsic rate).
 *   It does not use the image carried by `paint` events directly: measured, it can be a stale frame from the previous commit. `capturePage()` reliably reflects the picture after the seek.
 * - Uncaught exceptions in the page (console messages at error level, `Uncaught …`), renderer process exit, and main-frame load failure all fail in-flight requests with `COMPOSITION_SCRIPT_ERROR`.
 */

/** The placeholder in the host script that is replaced by `JSON.stringify(COMPOSITION_ADAPTER_SCRIPT)`. */
export const ADAPTER_PLACEHOLDER = '/*__CUCCUT_ADAPTER_SOURCE__*/null';

// i18n-ignore-start: child-process script source, not user-facing text
export const COMPOSITION_HOST_SCRIPT = String.raw`'use strict';
const { app, BrowserWindow, session } = require('electron');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { fileURLToPath } = require('url');

const ADAPTER_SOURCE = /*__CUCCUT_ADAPTER_SOURCE__*/null;
const PAINT_WAIT_MS = 500;

app.disableHardwareAcceleration();
app.commandLine.appendSwitch('force-device-scale-factor', '1');
if (app.dock && typeof app.dock.hide === 'function') app.dock.hide();
// 所有窗口关掉也不退出：会话结束不等于宿主结束。
app.on('window-all-closed', () => {});

const send = (message) => {
  try {
    process.stdout.write(JSON.stringify(message) + '\n');
  } catch (error) {
    process.stderr.write('[composition-host] stdout write failed: ' + error + '\n');
  }
};
const log = (line) => process.stderr.write('[composition-host] ' + line + '\n');
const fail = (code, message, details) => Object.assign(new Error(message), { code, details });

const sessions = new Map();
let nextSession = 1;
let quitting = false;

function quit() {
  if (quitting) return;
  quitting = true;
  for (const state of sessions.values()) destroy(state);
  sessions.clear();
  setImmediate(() => app.exit(0));
}

function destroy(state) {
  state.dead = true;
  if (state.win && !state.win.isDestroyed()) state.win.destroy();
}

function realOrResolved(p) {
  try {
    return fs.realpathSync(p);
  } catch {
    return path.resolve(p);
  }
}

function allowedUrl(url, rootReal) {
  if (/^(data|blob|about|devtools):/i.test(url)) return true;
  if (!/^file:/i.test(url)) return false;
  let file;
  try {
    file = realOrResolved(fileURLToPath(url));
  } catch {
    return false;
  }
  return file === rootReal || file.startsWith(rootReal + path.sep);
}

/** 在途请求遇到页面错误时立即失败；没有在途请求时记下来，下一次请求报告。 */
function pageError(state, message) {
  log('session ' + state.id + ' page error: ' + message);
  const error = fail('COMPOSITION_SCRIPT_ERROR', message);
  if (state.inflight) state.inflight(error);
  else state.pendingErrors.push(message);
}

/** 让 promise 与页面错误赛跑。 */
function guarded(state, promise) {
  if (state.pendingErrors.length > 0) {
    const messages = state.pendingErrors.splice(0);
    return Promise.reject(fail('COMPOSITION_SCRIPT_ERROR', messages.join('\n')));
  }
  if (state.dead) return Promise.reject(fail('COMPOSITION_SCRIPT_ERROR', 'The composition page is gone'));
  return new Promise((resolve, reject) => {
    state.inflight = reject;
    promise.then(resolve, reject).finally(() => {
      if (state.inflight === reject) state.inflight = null;
    });
  });
}

async function adapterCall(state, expression) {
  const envelope = await state.win.webContents.executeJavaScript(expression, true);
  if (!envelope || typeof envelope !== 'object') throw fail('COMPOSITION_SCRIPT_ERROR', 'The adapter returned no result');
  if (!envelope.ok) throw fail(envelope.code || 'COMPOSITION_SCRIPT_ERROR', envelope.message || 'Adapter call failed');
  return envelope.value;
}

async function open(p) {
  const id = 's' + nextSession++;
  const rootReal = realOrResolved(p.root);
  const entryPath = path.join(rootReal, ...String(p.entry).split('/'));
  const partition = 'composition-' + id;
  const ses = session.fromPartition(partition, { cache: false });
  const state = { id, win: null, blocked: [], pendingErrors: [], inflight: null, chain: Promise.resolve(), dead: false, alpha: !!p.alpha, width: p.width, height: p.height, fps: p.fps };
  ses.webRequest.onBeforeRequest((details, callback) => {
    if (allowedUrl(details.url, rootReal)) return callback({});
    state.blocked.push(details.url);
    send({ event: 'networkBlocked', params: { sessionId: id, url: details.url } });
    callback({ cancel: true });
  });
  ses.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  ses.setPermissionCheckHandler(() => false);

  const win = new BrowserWindow({
    show: false,
    width: p.width,
    height: p.height,
    useContentSize: true,
    frame: false,
    enableLargerThanScreen: true,
    transparent: !!p.alpha,
    backgroundColor: p.alpha ? '#00000000' : '#000000',
    webPreferences: {
      offscreen: true,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      backgroundThrottling: false,
      partition,
    },
  });
  state.win = win;
  sessions.set(id, state);
  const wc = win.webContents;
  wc.setWindowOpenHandler(() => ({ action: 'deny' }));
  wc.on('will-navigate', (event) => event.preventDefault());
  wc.on('console-message', (...args) => {
    // Electron 新版是事件对象（level 为字符串），旧版是 (event, level 数字, message)。
    const event = args[0] || {};
    const level = typeof event.level === 'string' ? event.level : args[1] === 3 ? 'error' : String(args[1]);
    const message = typeof event.message === 'string' ? event.message : String(args[2]);
    if (level !== 'error') return;
    if (/^Uncaught\b/.test(message)) pageError(state, message);
    else log('session ' + id + ' console.error: ' + message);
  });
  wc.on('render-process-gone', (_event, details) => {
    state.dead = true;
    pageError(state, 'Render process gone: ' + (details && details.reason));
  });
  wc.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (!isMainFrame || errorCode === -3) return;
    pageError(state, 'Failed to load ' + validatedURL + ': ' + errorDescription + ' (' + errorCode + ')');
  });

  try {
    await guarded(state, win.loadFile(entryPath));
    await guarded(state, wc.executeJavaScript(ADAPTER_SOURCE, true));
    const ctx = { width: p.width, height: p.height, fps: p.fps, durationFrames: p.durationFrames };
    const expression =
      'window.__cuccutAdapter.ready(' +
      [JSON.stringify(p.contract), JSON.stringify(p.compositionId), JSON.stringify(p.readyTimeoutMs), JSON.stringify(ctx)].join(',') +
      ')';
    const page = await guarded(state, adapterCall(state, expression));
    return { sessionId: id, page, blockedRequests: state.blocked.slice() };
  } catch (error) {
    sessions.delete(id);
    destroy(state);
    throw error;
  }
}

function nextPaint(wc) {
  return new Promise((resolve) => {
    const onPaint = () => {
      clearTimeout(timer);
      resolve(true);
    };
    const timer = setTimeout(() => {
      wc.removeListener('paint', onPaint);
      resolve(false);
    }, PAINT_WAIT_MS);
    wc.once('paint', onPaint);
    wc.invalidate();
  });
}

/** 与 @cuccut/protocol 的 seekToleranceSeconds 相同：采样帧率下的半帧，1 / (2 × fps)。 */
function seekTolerance(fps) {
  const num = Number(fps && fps.num);
  const den = Number(fps && fps.den);
  if (!(num > 0) || !(den > 0)) throw fail('COMPOSITION_SEEK_MISMATCH', 'Frame request has no valid fps');
  return den / (2 * num);
}

async function renderFrame(state, p) {
  const seconds = Number(p.seconds);
  if (!Number.isFinite(seconds)) throw fail('COMPOSITION_SEEK_MISMATCH', 'Requested time is not a finite number');
  const expression = 'window.__cuccutAdapter.seek(' + JSON.stringify(seconds) + ')';
  const tolerance = seekTolerance(p.fps || state.fps);
  const seek = await guarded(state, adapterCall(state, expression));
  if (!(Math.abs(seek.sampledSeconds - seek.targetSeconds) <= tolerance)) {
    throw fail('COMPOSITION_SEEK_MISMATCH', 'Seek to ' + seconds + ' s sampled ' + seek.sampledSeconds + ' s (target ' + seek.targetSeconds + ' s)', seek);
  }
  const wc = state.win.webContents;
  const painted = await nextPaint(wc);
  const image = await guarded(state, wc.capturePage());
  const size = image.getSize();
  if (size.width !== state.width || size.height !== state.height) {
    throw fail('COMPOSITION_INTRINSIC_MISMATCH', 'Captured ' + size.width + 'x' + size.height + ', expected ' + state.width + 'x' + state.height, size);
  }
  let transparentPixels = 0;
  let translucentPixels = 0;
  if (state.alpha) {
    const bitmap = image.toBitmap();
    for (let i = 3; i < bitmap.length; i += 4) {
      const a = bitmap[i];
      if (a === 0) transparentPixels++;
      else if (a < 255) translucentPixels++;
    }
  }
  return {
    png: image.toPNG().toString('base64'),
    width: size.width,
    height: size.height,
    sampledSeconds: seek.sampledSeconds,
    targetSeconds: seek.targetSeconds,
    clamped: seek.clamped,
    captureMode: 'capturePage',
    paintObserved: painted,
    transparentPixels,
    translucentPixels,
    blockedRequests: state.blocked.slice(),
  };
}

function sessionOf(p) {
  const state = sessions.get(p && p.sessionId);
  if (!state) throw fail('COMPOSITION_SCRIPT_ERROR', 'Unknown composition session ' + (p && p.sessionId));
  return state;
}

async function handle(method, p) {
  switch (method) {
    case 'open':
      return open(p);
    case 'frame': {
      const state = sessionOf(p);
      const run = state.chain.then(() => renderFrame(state, p));
      state.chain = run.catch(() => {});
      return run;
    }
    case 'close': {
      const state = sessions.get(p && p.sessionId);
      if (!state) return { closed: false };
      sessions.delete(state.id);
      try {
        if (!state.dead) await state.win.webContents.executeJavaScript('window.__cuccutAdapter && window.__cuccutAdapter.dispose()', true);
      } catch {}
      destroy(state);
      return { closed: true, blockedRequests: state.blocked.slice() };
    }
    case 'ping':
      return { electron: process.versions.electron, sessions: sessions.size };
    case 'shutdown':
      setImmediate(quit);
      return { ok: true };
    default:
      throw fail('COMPOSITION_SCRIPT_ERROR', 'Unknown method ' + method);
  }
}

function main() {
  const lines = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
  lines.on('line', (line) => {
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      return;
    }
    if (!message || typeof message.id !== 'number') return;
    Promise.resolve()
      .then(() => handle(message.method, message.params || {}))
      .then(
        (result) => send({ id: message.id, result: result === undefined ? null : result }),
        (error) =>
          send({
            id: message.id,
            error: {
              code: (error && error.code) || 'COMPOSITION_SCRIPT_ERROR',
              message: String((error && error.message) || error),
              ...(error && error.details !== undefined ? { details: error.details } : {}),
            },
          }),
      );
  });
  lines.on('close', quit);
  send({ event: 'ready', params: { electron: process.versions.electron, chrome: process.versions.chrome } });
}

app.whenReady().then(main, (error) => {
  log('startup failed: ' + (error && error.stack ? error.stack : error));
  app.exit(1);
});
`;
// i18n-ignore-end
