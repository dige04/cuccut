#!/usr/bin/env node
// CucCut visual QC: screenshot UI routes through the Runtime's web client (no Electron window needed).
//
//   node tools/qc-shot.mjs --out /tmp/shots /home /settings/general [--build] [--home .dev/qc-home] [--port 47701]
//                          [--size 1600x1000] [--video <videoId>] [--wait 2500]
//
// Each route is an in-app href (`hrefFor` shape: /home, /space/all, /settings/general, /tasks, /tools …) or `@video`
// (the editor of --video). `--build` rebuilds apps/web first. Different worktrees should pass different --home/--port.
// Uses system Chrome through playwright-core.
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { chromium } from 'playwright-core';

const repo = path.resolve(import.meta.dirname, '..');
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    out: { type: 'string', default: path.join(repo, '.dev/qc-shots') },
    home: { type: 'string', default: path.join(repo, '.dev/qc-home') },
    port: { type: 'string', default: '47701' },
    size: { type: 'string', default: '1600x1000' },
    video: { type: 'string' },
    wait: { type: 'string', default: '2500' },
    build: { type: 'boolean', default: false },
  },
});
const env = { ...process.env, CUCCUT_HOME: path.resolve(values.home) };
const cli = (...args) =>
  execFileSync(process.execPath, ['--experimental-strip-types', path.join(repo, 'apps/cli/src/main.ts'), ...args], {
    env,
    cwd: repo,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });

if (values.build) execFileSync('npm', ['run', 'build:web'], { cwd: repo, stdio: 'inherit' });
mkdirSync(values.out, { recursive: true });
mkdirSync(env.CUCCUT_HOME, { recursive: true });
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
const routes = positionals.length ? positionals : ['/home'];
for (const route of routes) {
  if (route !== '@video') {
    await page.goto(origin + route, { waitUntil: 'load' });
    await page.waitForTimeout(Number(values.wait));
  }
  const file = path.join(values.out, `${route.replace(/^\//, '').replace(/[/?=&@]+/g, '_') || 'root'}.png`);
  await page.screenshot({ path: file });
  console.log(`${route} -> ${file} (${page.url()})`);
}
if (errors.length) console.log(`page errors:\n${errors.join('\n')}`);
await browser.close();
