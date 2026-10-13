import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const env = vi.hoisted(() => ({ paths: new Map<string, string>() }));
vi.mock('electron', () => ({ app: { setPath: (name: string, value: string) => env.paths.set(name, value) } }));
import { compositionHostProfileDir, compositionHostScript, runCompositionHost } from './composition-host-entry.ts';

const temps: string[] = [];
afterEach(() => {
  for (const dir of temps.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
  env.paths.clear();
});

describe('compositionHostScript', () => {
  it('is null without the switch: runs the desktop app', () => {
    expect(compositionHostScript(['/app/CucCut', '.'])).toBeNull();
    expect(compositionHostScript(['/app/CucCut', '--composition-host=/tmp/host.cjs'])).toBeNull();
  });

  it('the argument after the switch is the script', () => {
    expect(compositionHostScript(['/app/CucCut', '--composition-host', '/c/host-1.cjs'])).toBe('/c/host-1.cjs');
    // In dev mode, default_app puts the app files first. Chromium may also insert switches in front.
    expect(compositionHostScript(['/e/Electron', '/repo/out/main/index.js', '--no-sandbox', '--composition-host', 'C:\\c\\host.cjs'])).toBe(
      'C:\\c\\host.cjs',
    );
  });

  it('is an empty string when no script follows the switch', () => {
    expect(compositionHostScript(['/app/CucCut', '--composition-host'])).toBe('');
    expect(compositionHostScript(['/app/CucCut', '--composition-host', '--inspect'])).toBe('');
  });
});

describe('runCompositionHost', () => {
  it('sets the Electron data directory to profile/ beside the script, then loads the script synchronously', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cuccut-host-entry-'));
    temps.push(dir);
    const script = path.join(dir, 'host-test.cjs');
    const marker = `__cuccutHostEntry${process.pid}`;
    fs.writeFileSync(script, `globalThis[${JSON.stringify(marker)}] = true;\n`);

    runCompositionHost(script);

    expect((globalThis as Record<string, unknown>)[marker]).toBe(true);
    const profile = compositionHostProfileDir(script);
    expect(profile).toBe(path.join(dir, 'profile'));
    expect(fs.statSync(profile).isDirectory()).toBe(true);
    expect(Object.fromEntries(env.paths)).toEqual({
      userData: path.join(profile, 'userData'),
      sessionData: path.join(profile, 'sessionData'),
      logs: path.join(profile, 'logs'),
      crashDumps: path.join(profile, 'crashDumps'),
    });
  });
});
