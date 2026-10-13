#!/usr/bin/env node
// Packs a self-contained HTML written on the motion-graphics scaffold into a CucCut code bundle (HyperFrames contract), after a static lint.
//
//   node build-bundle.mjs --html <index.html> --out <dir> [--bundle-id <id>] [--revision <r>]
//                         [--alpha true|false] [--lint-only] [--verify]
//
// Writes <out>/<revision>/: index.html, files.manifest.json, bundle.manifest.json, dependency.lock, build.recipe.json;
// --verify then seeks each moment in an offscreen Electron window, screenshots and checks it, and writes <out>/<revision>/verification.json; screenshots go outside the bundle in <out>/<revision>-preview/<t>.png.
// Prints the result as JSON to stdout; exit code 1 when lint or verification fails. No npm dependencies; --verify needs a resolvable electron package.
// Can also be imported: exports lintHtml(html) and buildBundle(opts).

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const TOOL = 'motion-graphics/build-bundle';
export const TOOL_VERSION = '1.0.0';
export const MAX_HTML_BYTES = 512 * 1024;

const REQUIRED_ROOT_ATTRS = [
  'data-composition-id',
  'data-start',
  'data-width',
  'data-height',
  'data-duration',
  'data-fps',
  'data-aspect-ratio',
  'data-structure',
  'data-layout',
  'data-motion',
];
const POSITIVE_ROOT_ATTRS = ['data-width', 'data-height', 'data-fps', 'data-duration'];
const TOKENS = ['--ink', '--panel', '--accent'];

// Exit window: starts no earlier than duration−0.8, ends no later than duration−0.05; hold: at least 1.2 s from the last entrance to the exit start.
const EXIT_EARLIEST_START = 0.8;
const EXIT_LATEST_END = 0.05;
const MIN_HOLD = 1.2;
const MIN_FIRST_START = 0.02;
const MIN_WINDOW = 0.2;
const MAX_WINDOW = 2.0;

const sha256 = (data) => crypto.createHash('sha256').update(data).digest('hex');

/** Character offset → 1-based line number. */
function lineAt(src, index) {
  let line = 1;
  for (let i = 0; i < index && i < src.length; i++) if (src.charCodeAt(i) === 10) line++;
  return line;
}

/** Finds the matching closing bracket from open (pointing at '(' or '{') and returns its index, or -1 if none. Brackets inside strings are not handled; enough for scaffold code. */
function matchBracket(src, open) {
  const pair = { '(': ')', '{': '}', '[': ']' };
  const close = pair[src[open]];
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === src[open]) depth++;
    else if (src[i] === close && --depth === 0) return i;
  }
  return -1;
}

/** Splits an argument string on top-level commas. */
function splitArgs(src) {
  const out = [];
  let depth = 0;
  let cur = '';
  for (const ch of src) {
    if ('([{'.includes(ch)) depth++;
    else if (')]}'.includes(ch)) depth--;
    if (ch === ',' && depth === 0) {
      out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

/** Accepts only expressions of numbers, DURATION and arithmetic; anything else (loop variables etc.) returns null, meaning it cannot be evaluated statically. */
function evalTime(expr, duration) {
  const replaced = expr.replace(/\bDURATION\b/g, `(${duration})`);
  if (!/^[\d.\s+\-*/()]+$/.test(replaced)) return null;
  try {
    const v = Function(`"use strict";return (${replaced});`)();
    return Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

/** Inside a Math.sin/Math.cos argument: periodic continuous motion (pulse etc.), not counted as an entrance window. */
function insidePeriodic(src, index) {
  const lineStart = src.lastIndexOf('\n', index) + 1;
  const before = src.slice(lineStart, index);
  const re = /Math\.(?:sin|cos)\(/g;
  let m;
  while ((m = re.exec(before))) {
    const open = lineStart + m.index + m[0].length - 1;
    const close = matchBracket(src, open);
    if (close === -1 || close > index) return true;
  }
  return false;
}

function parseAttrs(tag) {
  const attrs = {};
  const re = /([\w:-]+)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  let m;
  while ((m = re.exec(tag))) attrs[m[1].toLowerCase()] = m[3] ?? m[4] ?? m[5] ?? '';
  return attrs;
}

/**
 * Statically checks an HTML file. Returns { ok, issues: [{code, message, line?}], warnings, meta }.
 * meta carries width/height/fps/duration/compositionId and the time envelope (firstStart, entranceEnd, exitStart, exitEnd) for build and verify.
 */
export function lintHtml(html) {
  const issues = [];
  const warnings = [];
  const add = (code, message, index) => issues.push(index === undefined ? { code, message } : { code, message, line: lineAt(html, index) });
  const meta = { compositionId: null, width: null, height: null, fps: null, duration: null, continuous: false, windows: [] };

  const bytes = Buffer.byteLength(html, 'utf8');
  if (bytes > MAX_HTML_BYTES) add('FILE_TOO_LARGE', `HTML is ${bytes} bytes, over the limit of ${MAX_HTML_BYTES}`);

  // Root element
  const rootMatch = /<([a-z][\w-]*)\b[^>]*(?<![\w-])id\s*=\s*["']root["'][^>]*>/i.exec(html);
  if (!rootMatch) {
    add('ROOT_MISSING', 'No root element with id="root"');
  } else {
    const attrs = parseAttrs(rootMatch[0].slice(rootMatch[1].length + 1, -1));
    for (const name of REQUIRED_ROOT_ATTRS) {
      if (!(name in attrs) || attrs[name].trim() === '') add('ROOT_ATTR_MISSING', `Root element is missing ${name}`, rootMatch.index);
    }
    for (const name of POSITIVE_ROOT_ATTRS) {
      if (!(name in attrs)) continue;
      const v = Number(attrs[name]);
      if (!Number.isFinite(v) || v <= 0) add('ROOT_ATTR_INVALID', `${name}="${attrs[name]}" is not a positive number`, rootMatch.index);
    }
    if ('data-start' in attrs && Number(attrs['data-start']) !== 0) add('ROOT_ATTR_INVALID', 'data-start must be 0', rootMatch.index);
    meta.compositionId = attrs['data-composition-id'] || null;
    meta.width = Number(attrs['data-width']) || null;
    meta.height = Number(attrs['data-height']) || null;
    meta.fps = Number(attrs['data-fps']) || null;
    meta.duration = Number(attrs['data-duration']) || null;
    meta.continuous = attrs['data-motion-continuous'] === 'true';
  }

  // viewport matches the root size
  const viewport = /<meta\b[^>]*name\s*=\s*["']viewport["'][^>]*>/i.exec(html);
  if (!viewport) add('VIEWPORT_MISSING', 'Missing <meta name="viewport" content="width=W,height=H">');
  else if (meta.width && meta.height) {
    const content = parseAttrs(viewport[0]).content || '';
    const w = /width\s*=\s*(\d+)/.exec(content)?.[1];
    const h = /height\s*=\s*(\d+)/.exec(content)?.[1];
    if (Number(w) !== meta.width || Number(h) !== meta.height)
      add('VIEWPORT_MISMATCH', `viewport (${content}) does not match the root element ${meta.width}×${meta.height}`, viewport.index);
  }

  // Timeline registration
  const registry = /window\.__timelines\s*=\s*\{([^}]*)\}/.exec(html);
  if (!registry) add('TIMELINE_REGISTRY_MISSING', 'Missing window.__timelines = { [compositionId]: timeline }');
  else {
    const body = registry[1];
    const id = meta.compositionId ?? 'main';
    const literal = new RegExp(`(^|[\\s,{])(["'\`]?)${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\2\\s*:`).test(body);
    const computed =
      /\[\s*(COMPOSITION_ID|[\w.]*compositionId)\s*\]\s*:/.test(body) && /dataset\.compositionId|data-composition-id/.test(html);
    if (!literal && !computed) add('TIMELINE_REGISTRY_MISSING', `window.__timelines does not register composition "${id}"`, registry.index);
  }

  // Unified exit
  const exitRe =
    /const\s+exit\s*=\s*1\s*-\s*easeInOut\(\s*range\(\s*time\s*,([^,]+),([^)]+)\)\s*\)\s*;\s*scene\.style\.opacity\s*=\s*String\(\s*exit\s*\)/;
  const exitMatch = exitRe.exec(html);
  let exitIndex = -1;
  if (!exitMatch)
    add(
      'EXIT_MISSING',
      'Missing the unified exit: const exit = 1 - easeInOut(range(time, DURATION - a, DURATION - b)); scene.style.opacity = String(exit);',
    );
  else if (meta.duration) {
    exitIndex = exitMatch.index + exitMatch[0].indexOf('range(');
    const start = evalTime(exitMatch[1].trim(), meta.duration);
    const end = evalTime(exitMatch[2].trim(), meta.duration);
    if (start === null || end === null) add('EXIT_WINDOW', 'The unified exit window cannot be evaluated statically', exitMatch.index);
    else {
      meta.exitStart = start;
      meta.exitEnd = end;
      if (end > meta.duration - EXIT_LATEST_END + 1e-9)
        add('EXIT_WINDOW', `Exit ends at ${end} s, later than duration−${EXIT_LATEST_END}`, exitMatch.index);
      if (start < meta.duration - EXIT_EARLIEST_START - 1e-9)
        add('EXIT_WINDOW', `Exit starts at ${start} s, earlier than duration−${EXIT_EARLIEST_START}`, exitMatch.index);
      if (end <= start) add('EXIT_WINDOW', 'The exit window does not end after it starts', exitMatch.index);
    }
  }

  // All range(time, a, b) windows
  if (meta.duration) {
    const re = /\brange\(\s*time\s*,/g;
    let m;
    while ((m = re.exec(html))) {
      const open = m.index + m[0].indexOf('(');
      const close = matchBracket(html, open);
      if (close === -1) continue;
      if (m.index === exitIndex) continue;
      const args = splitArgs(html.slice(open + 1, close));
      const line = lineAt(html, m.index);
      const a = evalTime(args[1] ?? '', meta.duration);
      const b = evalTime(args[2] ?? '', meta.duration);
      if (a === null || b === null) {
        warnings.push({ code: 'WINDOW_NOT_STATIC', message: `range(time, ${args[1]}, ${args[2]}) cannot be evaluated statically and was left out of the envelope check`, line });
        continue;
      }
      const periodic = insidePeriodic(html, m.index);
      meta.windows.push({ start: a, end: b, line, periodic });
      const len = b - a;
      if (len < MIN_WINDOW - 1e-9 || len > MAX_WINDOW + 1e-9)
        add('WINDOW_LENGTH', `Window ${a}–${b} s is ${len.toFixed(2)} s long; it should be ${MIN_WINDOW}–${MAX_WINDOW} s`, m.index);
      if (a < 0 || b > meta.duration + 1e-9) add('WINDOW_OUT_OF_RANGE', `Window ${a}–${b} s falls outside 0–${meta.duration} s`, m.index);
    }
    const entrances = meta.windows.filter((w) => !w.periodic);
    if (entrances.length) {
      meta.firstStart = Math.min(...entrances.map((w) => w.start));
      meta.entranceEnd = Math.max(...entrances.map((w) => w.end));
      const first = entrances.find((w) => w.start === meta.firstStart);
      if (meta.firstStart < MIN_FIRST_START - 1e-9)
        issues.push({
          code: 'FIRST_ENTRY_TOO_EARLY',
          message: `The first entrance starts at ${meta.firstStart} s; it should start no earlier than ${MIN_FIRST_START} s`,
          line: first.line,
        });
      if (meta.exitStart !== undefined && !meta.continuous && meta.entranceEnd > meta.exitStart - MIN_HOLD + 1e-9) {
        const last = entrances.find((w) => w.end === meta.entranceEnd);
        issues.push({
          code: 'HOLD_TOO_SHORT',
          message: `The last entrance ends at ${meta.entranceEnd} s, less than ${MIN_HOLD} s before the exit starts at ${meta.exitStart} s (for continuous motion, add data-motion-continuous="true" to the root element)`,
          line: last.line,
        });
      }
    }
  }

  // Network and external resources
  const banned = [
    [/https?:\/\//g, 'EXTERNAL_URL', 'external URL'],
    [/(["'`(=]\s*)\/\/[\w.-]/g, 'EXTERNAL_URL', 'protocol-relative // URL'],
    [/<script\b[^>]*\bsrc\s*=/gi, 'EXTERNAL_SCRIPT', '<script src>'],
    [/<link\s/gi, 'EXTERNAL_LINK', '<link>'],
    [/@import\b/g, 'CSS_IMPORT', '@import'],
    [/\bfetch\s*\(/g, 'NETWORK_API', 'fetch('],
    [/\bXMLHttpRequest\b/g, 'NETWORK_API', 'XMLHttpRequest'],
    [/\bnew\s+(?:WebSocket|EventSource)\b/g, 'NETWORK_API', 'WebSocket / EventSource'],
    [/\bimport\s*\(/g, 'NETWORK_API', 'dynamic import('],
    [/\bDate\.now\b/g, 'NONDETERMINISTIC', 'Date.now'],
    [/\bperformance\.now\b/g, 'NONDETERMINISTIC', 'performance.now'],
    [/\bMath\.random\b/g, 'NONDETERMINISTIC', 'Math.random'],
    [/\bnew\s+Date\s*\(/g, 'NONDETERMINISTIC', 'new Date('],
  ];
  for (const [re, code, what] of banned) {
    let m;
    while ((m = re.exec(html))) add(code, `${what} is not allowed: rendering must be offline and determined by time alone`, m.index);
  }

  // requestAnimationFrame may appear only in the timeline's play()
  const playBodies = [];
  const playRe = /\bplay\s*\(\s*\)\s*\{/g;
  let pm;
  while ((pm = playRe.exec(html))) {
    const open = pm.index + pm[0].length - 1;
    const close = matchBracket(html, open);
    if (close !== -1) playBodies.push([open, close]);
  }
  const rafRe = /\brequestAnimationFrame\b/g;
  let rm;
  while ((rm = rafRe.exec(html))) {
    if (!playBodies.some(([o, c]) => rm.index > o && rm.index < c))
      add('RAF_OUTSIDE_PLAY', 'requestAnimationFrame may be used only in the timeline\'s play() (preview); the frame must be determined by seek', rm.index);
  }

  // Color tokens
  const rootRule = /#root\s*\{([^}]*)\}/.exec(html);
  if (!rootRule) add('TOKEN_MISSING', 'Missing the #root{…} rule with --ink --panel --accent');
  else for (const t of TOKENS) if (!new RegExp(`${t}\\s*:`).test(rootRule[1])) add('TOKEN_MISSING', `#root does not define ${t}`, rootRule.index);

  // Copy
  if (!/\bdata-copy-primary\b/.test(html.replace(/<script[\s\S]*?<\/script>/gi, '')))
    add('COPY_PRIMARY_MISSING', 'At least one copy element with data-copy-primary is required');
  if (!/(^|[\s,}])\.copy\s*[{,]/m.test(html))
    add('COPY_RULE_MISSING', 'Missing the .copy{max-width:100%;overflow:hidden;text-overflow:ellipsis} rule');

  return { ok: issues.length === 0, issues, warnings, meta };
}

/** Frame rate → reduced integer ratio. */
export function toRate(fps) {
  for (const den of [1, 1001, 1000]) {
    const num = Math.round(fps * den);
    if (Math.abs(num / den - fps) < 1e-6) {
      const gcd = (a, b) => (b ? gcd(b, a % b) : a);
      const g = gcd(num, den);
      return { num: num / g, den: den / g };
    }
  }
  return { num: Math.round(fps * 1000), den: 1000 };
}

function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
}

/**
 * Writes the code bundle once lint passes. opts: { html (file path), out, bundleId?, revision?, alpha?, lintOnly? }.
 * Returns { ok, lint, dir?, manifest? }; writes no files when lint fails.
 */
export function buildBundle(opts) {
  const htmlPath = path.resolve(opts.html);
  const html = fs.readFileSync(htmlPath, 'utf8');
  const lint = lintHtml(html);
  if (!lint.ok || opts.lintOnly) return { ok: lint.ok, lint };

  const { meta } = lint;
  const bundleId = opts.bundleId || path.basename(path.dirname(htmlPath));
  const revision = opts.revision || '1';
  const alpha = opts.alpha ?? true;
  const dir = path.join(path.resolve(opts.out), revision);
  fs.mkdirSync(dir, { recursive: true });

  fs.writeFileSync(path.join(dir, 'index.html'), html);
  fs.writeFileSync(path.join(dir, 'dependency.lock'), '');
  // The recipe records only deterministic inputs (no absolute paths or times), so the same inputs give the same contentHash.
  writeJson(path.join(dir, 'build.recipe.json'), {
    tool: TOOL,
    version: TOOL_VERSION,
    inputs: { html: path.basename(htmlPath), sha256: sha256(html), bundleId, revision, alpha },
  });

  // contentHash covers these three files; the excluded bundle.manifest.json, files.manifest.json and verification.json
  // match CODE_BUNDLE_UNHASHED_FILES in @cuccut/protocol.
  const listed = ['build.recipe.json', 'dependency.lock', 'index.html'];
  const files = listed
    .map((p) => {
      const data = fs.readFileSync(path.join(dir, p));
      return { path: p, size: data.length, sha256: sha256(data) };
    })
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  writeJson(path.join(dir, 'files.manifest.json'), files);

  const manifest = {
    format: 'cuccut.code-bundle',
    schemaVersion: 1,
    bundleId,
    revision,
    contentHash: 'sha256-' + sha256(JSON.stringify(files)),
    runtime: { engine: 'browser', contract: 'hyperframes/1', entry: 'index.html', frameworkHints: [] },
    source: { filesManifest: 'files.manifest.json', dependencyLock: 'dependency.lock', buildRecipe: 'build.recipe.json' },
    intrinsic: { width: meta.width, height: meta.height, fps: toRate(meta.fps), durationFrames: Math.round(meta.duration * meta.fps) },
    output: { alpha, colorSpace: 'srgb', audio: 'none' },
    timing: { access: 'random' },
    timeDependencies: [{ kind: 'local-only' }],
    permissions: { network: 'deny', assetIds: [] },
  };
  writeJson(path.join(dir, 'bundle.manifest.json'), manifest);
  return { ok: true, lint, dir, manifest };
}

/** verify sample times: 0, entrance end, hold midpoint, duration−0.3, duration. */
export function sampleTimes(meta) {
  const d = meta.duration;
  const end = meta.entranceEnd ?? Math.min(d / 2, 2);
  const exitStart = meta.exitStart ?? d - 0.62;
  const round = (v) => Math.round(v * 1000) / 1000;
  return {
    start: 0,
    entranceEnd: round(end),
    holdMid: round((end + exitStart) / 2),
    beforeEnd: round(Math.max(0, d - 0.3)),
    end: round(d),
  };
}

function parseArgs(argv) {
  const opts = { alpha: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '--html') opts.html = next();
    else if (a === '--out') opts.out = next();
    else if (a === '--bundle-id') opts.bundleId = next();
    else if (a === '--revision') opts.revision = next();
    else if (a === '--alpha') opts.alpha = next() !== 'false';
    else if (a === '--lint-only') opts.lintOnly = true;
    else if (a === '--verify') opts.verify = true;
    else if (a === '--electron-verify') opts.electronVerify = next();
    else throw new Error(`Unknown argument: ${a}`);
  }
  return opts;
}

function runVerifyInElectron(dir) {
  const require = createRequire(import.meta.url);
  let electron;
  try {
    electron = require('electron');
  } catch {
    return { ok: false, error: '--verify needs the electron package (run inside the CucCut repository, or install electron)' };
  }
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const r = spawnSync(electron, [fileURLToPath(import.meta.url), '--electron-verify', dir], {
    stdio: ['ignore', 'ignore', 'inherit'],
    env,
  });
  const report = path.join(dir, 'verification.json');
  if (!fs.existsSync(report)) return { ok: false, error: `Electron verification wrote no report (exit code ${r.status})` };
  return JSON.parse(fs.readFileSync(report, 'utf8'));
}

// ---- Electron side: opens the bundle entry offscreen, seeks each moment, screenshots and checks ----
async function electronVerify(dir) {
  const require = createRequire(import.meta.url);
  const { app, BrowserWindow, session } = require('electron');
  app.commandLine.appendSwitch('force-device-scale-factor', '1');
  app.disableHardwareAcceleration();
  app.dock?.hide();

  const main = async () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'bundle.manifest.json'), 'utf8'));
    const html = fs.readFileSync(path.join(dir, manifest.runtime.entry), 'utf8');
    const { meta } = lintHtml(html);
    const { width, height } = manifest.intrinsic;
    const checks = [];
    const check = (name, ok, detail) => checks.push(detail === undefined ? { name, ok: !!ok } : { name, ok: !!ok, detail });

    const blocked = [];
    const ses = session.fromPartition('motion-graphics-verify');
    ses.webRequest.onBeforeRequest((details, cb) => {
      const ok = /^(file|data|devtools|chrome-extension):/.test(details.url);
      if (!ok) blocked.push(details.url);
      cb({ cancel: !ok });
    });

    const win = new BrowserWindow({
      width,
      height,
      useContentSize: true,
      show: false,
      transparent: true,
      frame: false,
      enableLargerThanScreen: true,
      backgroundColor: '#00000000',
      webPreferences: { offscreen: true, session: ses, backgroundThrottling: false, contextIsolation: true },
    });
    win.webContents.setFrameRate(60);
    await win.loadURL(pathToFileURL(path.join(dir, manifest.runtime.entry)).href);
    const js = (code) => win.webContents.executeJavaScript(code, true);
    await js('document.fonts ? document.fonts.ready.then(() => true) : true');

    const id = JSON.stringify(meta.compositionId ?? 'main');
    check('timeline', await js(`!!(window.__timelines && window.__timelines[${id}])`));
    check('qa', await js('!!window.__GRAPHICS_QA__'));

    // After seeking, wait for the page to actually repaint a frame before the screenshot.
    const paint = () =>
      new Promise((resolve) => {
        const timer = setTimeout(resolve, 500);
        win.webContents.once('paint', () => {
          clearTimeout(timer);
          resolve();
        });
        win.webContents.invalidate();
      });
    const capture = async (t) => {
      await js(
        `window.__timelines[${id}].seek(${t}); new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(true))))`,
      );
      await paint();
      await paint();
      return win.webContents.capturePage();
    };

    const times = sampleTimes(meta);
    // Screenshots go outside the bundle directory: the bundle keeps only the files covered by contentHash plus verification.json.
    const previewDir = `${dir}-preview`;
    fs.mkdirSync(previewDir, { recursive: true });
    const frames = {};
    for (const [key, t] of Object.entries(times)) {
      const img = await capture(t);
      const png = img.toPNG();
      const size = img.getSize();
      const file = path.join(previewDir, `${t}.png`);
      fs.writeFileSync(file, png);
      frames[key] = { t, file, size, hash: sha256(png), image: img };
    }
    for (const f of Object.values(frames))
      check(`size@${f.t}`, f.size.width === width && f.size.height === height, `${f.size.width}×${f.size.height}`);

    // Determinism: capture again in shuffled order; the PNG bytes for the same moment must match.
    for (const key of Object.keys(times).reverse()) {
      const again = sha256((await capture(times[key])).toPNG());
      check(`deterministic@${times[key]}`, again === frames[key].hash);
    }

    const mid = frames.holdMid;
    check('distinct-start-vs-hold', frames.start.hash !== mid.hash);
    check('distinct-end-vs-hold', frames.end.hash !== mid.hash);

    if (manifest.output.alpha) {
      const bmp = mid.image.toBitmap();
      const { width: w, height: h } = mid.size;
      const alphaAt = (x, y) => bmp[(y * w + x) * 4 + 3];
      const corners = [alphaAt(0, 0), alphaAt(w - 1, 0), alphaAt(0, h - 1), alphaAt(w - 1, h - 1)];
      check(
        'alpha-corners',
        corners.every((a) => a === 0),
        corners,
      );
      const opaque = bmp.some((_, i) => i % 4 === 3 && bmp[i] > 0);
      check('alpha-has-content', opaque);
    }

    await js(`window.__GRAPHICS_QA__.seek(${mid.t})`);
    const inspect = await js('window.__GRAPHICS_QA__.inspect()');
    check('inspect.copyCount', inspect.copyCount > 0, inspect.copyCount);
    check('inspect.insideRoot', inspect.insideRoot);
    check('inspect.insideSafeArea', inspect.insideSafeArea, inspect.outsideSafe);
    if (manifest.output.alpha) check('inspect.transparentRoot', inspect.transparentRoot);

    for (const mode of ['long', 'cjk']) {
      const at = await js(`window.__GRAPHICS_QA__.setCopy(${JSON.stringify(mode)})`);
      const r = await js('window.__GRAPHICS_QA__.inspect()');
      check(`setCopy(${mode}).insideRoot`, r.insideRoot);
      check(`setCopy(${mode}).insideSafeArea`, r.insideSafeArea, r.outsideSafe);
      const img = await capture(at);
      fs.writeFileSync(path.join(previewDir, `copy-${mode}.png`), img.toPNG());
    }
    await js(`window.__GRAPHICS_QA__.setCopy('original')`);

    check('network', blocked.length === 0, blocked);
    win.destroy();

    const report = {
      ok: checks.every((c) => c.ok),
      bundleId: manifest.bundleId,
      revision: manifest.revision,
      contentHash: manifest.contentHash,
      tool: { name: TOOL, version: TOOL_VERSION, electron: process.versions.electron },
      times,
      frames: Object.fromEntries(Object.entries(frames).map(([k, f]) => [k, { t: f.t, file: path.relative(dir, f.file), sha256: f.hash }])),
      inspect,
      checks,
    };
    writeJson(path.join(dir, 'verification.json'), report);
  };

  // An ESM main process cannot top-level await app.whenReady(): ready fires only after module evaluation finishes.
  app
    .whenReady()
    .then(main)
    .then(
      () => app.exit(0),
      (err) => {
        console.error(err);
        app.exit(1);
      },
    );
}

function cli(argv) {
  let opts;
  try {
    opts = parseArgs(argv);
  } catch (err) {
    console.log(JSON.stringify({ ok: false, error: String(err.message) }, null, 2));
    return 1;
  }
  if (opts.electronVerify) {
    electronVerify(path.resolve(opts.electronVerify));
    return null;
  }
  if (!opts.html || (!opts.out && !opts.lintOnly)) {
    console.log(
      JSON.stringify(
        {
          ok: false,
          error:
            'Usage: node build-bundle.mjs --html <index.html> --out <dir> [--bundle-id <id>] [--revision <r>] [--alpha true|false] [--lint-only] [--verify]',
        },
        null,
        2,
      ),
    );
    return 1;
  }
  const built = buildBundle(opts);
  const result = { ok: built.ok, issues: built.lint.issues, warnings: built.lint.warnings };
  if (built.dir) Object.assign(result, { dir: built.dir, manifest: built.manifest });
  if (built.ok && opts.verify && !opts.lintOnly) {
    const v = runVerifyInElectron(built.dir);
    result.verification = v.error ? { ok: false, error: v.error } : { ok: v.ok, failed: v.checks.filter((c) => !c.ok), frames: v.frames };
    result.ok = !!v.ok;
  }
  console.log(JSON.stringify(result, null, 2));
  return result.ok ? 0 : 1;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  const code = cli(process.argv.slice(2));
  if (code !== null) process.exitCode = code;
}
