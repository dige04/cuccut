import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CodeBundleError, inspectBundle, type InspectedBundle } from './bundle-inspect.ts';
import { CompositionHost, frameTicketAt, hostSpawnArgs, resolveElectronBinary } from './composition-host.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.join(here, 'fixtures');
const repo = path.resolve(here, '../../..');
const electron = resolveElectronBinary();

const tmpDirs: string[] = [];
const inspect = async (name: string, options: Parameters<typeof inspectBundle>[1] = {}) => {
  const bundle = await inspectBundle(path.join(fixtures, name), options);
  if (bundle.synthesized) tmpDirs.push(bundle.root);
  return bundle;
};

describe('resolveElectronBinary', () => {
  it('CUCCUT_ELECTRON takes precedence', () => {
    expect(resolveElectronBinary({ CUCCUT_ELECTRON: '/opt/electron' })).toBe('/opt/electron');
  });

  it('host is launched with `--composition-host <script>` as two separate arguments (the packaged main-process entry relies on this to recognize the host)', () => {
    expect(hostSpawnArgs('/c/cuccut-composition-host/host-0.cjs')).toEqual(['--composition-host', '/c/cuccut-composition-host/host-0.cjs']);
  });

  it('start throws COMPOSITION_HOST_UNAVAILABLE without Electron', async () => {
    const error = await CompositionHost.start({ electron: null }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(CodeBundleError);
    expect((error as CodeBundleError).code).toBe('COMPOSITION_HOST_UNAVAILABLE');
  });
});

describe.skipIf(!electron)('CompositionHost (Electron offscreen)', { timeout: 120_000 }, () => {
  let host: CompositionHost;
  const logs: string[] = [];

  beforeAll(async () => {
    host = await CompositionHost.start({ log: (line) => logs.push(line) });
  }, 60_000);

  afterAll(async () => {
    await host?.close();
    expect(host?.alive).toBe(false);
    for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
  });

  const at = (bundle: InspectedBundle, seconds: number) => frameTicketAt(bundle, { seconds });

  it('hyperframes/1: two frame fetches at the same time are identical, different at different times, out-of-range is clamped to the end', async () => {
    const bundle = await inspect('hyperframes-basic', { manifest: { alpha: true } });
    const session = await host.open(bundle);
    try {
      expect(session.page).toEqual({ width: 1280, height: 720, fps: { num: 30, den: 1 }, durationSeconds: 2, compositionId: 'main' });
      const a = await session.frame(at(bundle, 0.5));
      const zero = await session.frame(at(bundle, 0));
      const b = await session.frame(at(bundle, 0.5));
      expect(a.receipt.sha256).toBe(b.receipt.sha256);
      expect(zero.receipt.sha256).not.toBe(a.receipt.sha256);
      expect(a.receipt).toMatchObject({ width: 1280, height: 720, pixelFormat: 'png', alphaMode: 'straight', clampedToDuration: false });
      expect(a.receipt.sampledSeconds).toBeCloseTo(0.5, 6);
      expect(a.png.subarray(1, 4).toString('latin1')).toBe('PNG');
      expect(a.captureMode).toBe('capturePage');
      // Transparent window: outside the box is transparent.
      expect(a.transparentPixels).toBeGreaterThan(1280 * 720 * 0.9);
      const past = await session.frame(at(bundle, 2.5));
      expect(past.receipt.clampedToDuration).toBe(true);
      expect(past.receipt.sampledSeconds).toBeCloseTo(2, 6);
      expect(session.blockedRequests).toEqual([]);
    } finally {
      await session.dispose();
    }
  });

  it('exact frame-index ticket: localTime = k × den / num', async () => {
    const bundle = await inspect('hyperframes-basic');
    const session = await host.open(bundle);
    try {
      const ticket = frameTicketAt(bundle, { frameIndex: 15, fps: { num: 30000, den: 1001 } });
      expect(ticket.localTime).toEqual({ ticks: String(15 * 1001), timescale: 30000 });
      const frame = await session.frame(ticket);
      expect(frame.receipt.requestedSeconds).toBeCloseTo((15 * 1001) / 30000, 9);
      // An opaque window does not count transparent pixels.
      expect(frame.receipt.alphaMode).toBe('opaque');
      expect(frame.transparentPixels).toBe(0);
    } finally {
      await session.dispose();
    }
  });

  it('no root element → COMPOSITION_ROOT_MISSING', async () => {
    const bundle = await inspect('root-missing', { manifest: { width: 1280, height: 720, fps: 30, durationFrames: 60 } });
    const error = await host.open(bundle).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(CodeBundleError);
    expect((error as CodeBundleError).code).toBe('COMPOSITION_ROOT_MISSING');
  });

  it('manifest and page mismatch → COMPOSITION_INTRINSIC_MISMATCH', async () => {
    const bundle = await inspect('hyperframes-basic', { manifest: { width: 640, height: 360 } });
    const error = await host.open(bundle).catch((e: unknown) => e);
    expect((error as CodeBundleError).code).toBe('COMPOSITION_INTRINSIC_MISMATCH');
    expect((error as CodeBundleError).details).toEqual([
      { field: 'width', manifest: 640, page: 1280 },
      { field: 'height', manifest: 360, page: 720 },
    ]);
  });

  it('cuccut/1: native contract can fetch frames', async () => {
    const bundle = await inspect('cuccut-native', { manifest: { alpha: true } });
    expect(bundle.manifest.runtime).toMatchObject({ contract: 'cuccut/1' });
    const session = await host.open(bundle);
    try {
      const a = await session.frame(at(bundle, 1));
      const b = await session.frame(at(bundle, 1));
      const c = await session.frame(at(bundle, 0.25));
      expect(a.receipt.sha256).toBe(b.receipt.sha256);
      expect(c.receipt.sha256).not.toBe(a.receipt.sha256);
      expect(a.receipt.sampledSeconds).toBeCloseTo(1, 6);
    } finally {
      await session.dispose();
    }
  });

  it('runtime network requests are blocked and recorded', async () => {
    const bundle = await inspect('network-runtime');
    const session = await host.open(bundle);
    try {
      await session.frame(at(bundle, 0));
      expect(session.blockedRequests).toEqual(['https://example.invalid/x']);
    } finally {
      await session.dispose();
    }
  });

  it('opens a bundle produced by motion-graphics\' build-bundle.mjs and fetches frames', async () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'cuccut-mg-host-'));
    tmpDirs.push(out);
    const html = path.join(repo, 'skills/cuccut/built-in-skills/motion-graphics/exemplars/lower-third/16x9.html');
    const run = spawnSync(
      process.execPath,
      [path.join(repo, 'skills/cuccut/built-in-skills/motion-graphics/scripts/build-bundle.mjs'), '--html', html, '--out', out],
      {
        encoding: 'utf8',
      },
    );
    expect(run.status, run.stderr).toBe(0);
    const bundle = await inspectBundle(path.join(out, '1'));
    const session = await host.open(bundle);
    try {
      expect(session.page).toMatchObject({ width: 1920, height: 1080, durationSeconds: 4 });
      const frame = await session.frame(at(bundle, 2));
      expect(frame.receipt).toMatchObject({ width: 1920, height: 1080, alphaMode: 'straight' });
      expect(frame.transparentPixels).toBeGreaterThan(0);
      expect(frame.transparentPixels).toBeLessThan(1920 * 1080);
    } finally {
      await session.dispose();
    }
  });
});
