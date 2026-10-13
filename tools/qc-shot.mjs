#!/usr/bin/env node
// CucCut visual QC: screenshot UI routes through the Runtime's web client (no Electron window needed).
//
//   node tools/qc-shot.mjs --out /tmp/shots /home /settings/general [--build] [--home .dev/qc-home] [--port 47701]
//                          [--size 1600x1000] [--video <videoId>] [--wait 2500] [--dist <dir>]
//                          [@video --click <selector> … @here --click <selector> …]
//
// Each route is an in-app href (`hrefFor` shape: /home, /space/all, /settings/general, /tasks, /tools …), `@video`
// (the editor of --video) or `@here` (no navigation: another shot of the page as the clicks before it left it). The
// `--click` options after a route are done in order, each followed by --wait/4 ms, before that route's screenshot: a
// dialog or a popover is shot by opening it (`@video --click 'role=button[name="Video"]' --click 'text=What correct
// looks like'`). Selectors are Playwright's (`role=…`, `text=…`, CSS); the first match is clicked. A name used twice
// gets a numbered file. `--build` rebuilds apps/web first. Different worktrees should pass different --home/--port.
// Uses system Chrome through playwright-core.
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { chromium } from 'playwright-core';

const repo = path.resolve(import.meta.dirname, '..');
const { values, positionals, tokens } = parseArgs({
  allowPositionals: true,
  tokens: true,
  options: {
    out: { type: 'string', default: path.join(repo, '.dev/qc-shots') },
    home: { type: 'string', default: path.join(repo, '.dev/qc-home') },
    port: { type: 'string', default: '47701' },
    size: { type: 'string', default: '1600x1000' },
    video: { type: 'string' },
    wait: { type: 'string', default: '2500' },
    build: { type: 'boolean', default: false },
    // Build the web client into this folder and serve it from there (parallel worktrees/agents each pass their own).
    dist: { type: 'string' },
    // Clicks before the screenshot of the route they follow (repeatable).
    click: { type: 'string', multiple: true },
  },
});
const env = { ...process.env, CUCCUT_HOME: path.resolve(values.home), ...(values.dist ? { CUCCUT_WEB_DIST: path.resolve(values.dist) } : {}) };
const cli = (...args) =>
  execFileSync(process.execPath, ['--experimental-strip-types', path.join(repo, 'apps/cli/src/main.ts'), ...args], {
    env,
    cwd: repo,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });

if (values.build && values.dist) {
  execFileSync('npx', ['vite', 'build', '--outDir', path.resolve(values.dist), '--emptyOutDir'], { cwd: path.join(repo, 'apps/web'), stdio: 'inherit' });
} else if (values.build) execFileSync('npm', ['run', 'build:web'], { cwd: repo, stdio: 'inherit' });
mkdirSync(values.out, { recursive: true });
mkdirSync(env.CUCCUT_HOME, { recursive: true });
// A runtime already running for this home keeps serving the web client it started with: restart it so --dist applies.
if (values.dist) {
  try {
    cli('runtime', 'stop', '--json');
  } catch {}
}
cli('runtime', 'ensure', '--json');
try {
  cli('services', 'configure', 'web', '--port', values.port, '--json');
} catch {}
const opened = JSON.parse(cli('web', 'open', '--json', ...(values.video ? ['--video', values.video] : [])));
const link = opened.result.link.url;
const origin = new URL(link).origin;
const [w, h] = values.size.split('x').map(Number);

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: w, height: h } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(link, { waitUntil: 'load' });
await page.waitForTimeout(Number(values.wait));
// Routes in order, each with the clicks that follow it on the command line.
const steps = [];
for (const token of tokens) {
  if (token.kind === 'positional') steps.push({ route: token.value, clicks: [] });
  else if (token.kind === 'option' && token.name === 'click') {
    if (!steps.length) throw new Error('--click must follow a route');
    steps.at(-1).clicks.push(token.value);
  }
}
if (!positionals.length) steps.push({ route: '/home', clicks: [] });
const used = new Map();
for (const { route, clicks } of steps) {
  if (route !== '@video' && route !== '@here') {
    await page.goto(origin + route, { waitUntil: 'load' });
    await page.waitForTimeout(Number(values.wait));
  }
  for (const selector of clicks) {
    await page.locator(selector).first().click({ timeout: 10_000 });
    await page.waitForTimeout(Math.round(Number(values.wait) / 4));
  }
  if (clicks.length) await page.waitForTimeout(Math.round(Number(values.wait) / 2));
  const base = route.replace(/^\//, '').replace(/[/?=&@]+/g, '_') || 'root';
  const n = (used.get(base) ?? 0) + 1;
  used.set(base, n);
  const file = path.join(values.out, `${n > 1 ? `${base}-${n}` : base}.png`);
  await page.screenshot({ path: file });
  console.log(`${route}${clicks.length ? ` (${clicks.length} clicks)` : ''} -> ${file} (${page.url()})`);
}
if (errors.length) console.log(`page errors:\n${errors.join('\n')}`);
await browser.close();
