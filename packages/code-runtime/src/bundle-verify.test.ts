import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { inspectBundle } from './bundle-inspect.ts';
import { verifyBundle } from './bundle-verify.ts';
import { CompositionHost, resolveElectronBinary } from './composition-host.ts';

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');
const tmpDirs: string[] = [];
const inspect = async (name: string, options: Parameters<typeof inspectBundle>[1] = {}) => {
  const bundle = await inspectBundle(path.resolve(fixtures, name), options);
  if (bundle.synthesized) tmpDirs.push(bundle.root);
  return bundle;
};
const check = (report: Awaited<ReturnType<typeof verifyBundle>>, id: string) => report.checks.find((c) => c.id === id);

describe.skipIf(!resolveElectronBinary())('verifyBundle', { timeout: 120_000 }, () => {
  let host: CompositionHost;
  beforeAll(async () => {
    host = await CompositionHost.start();
  }, 60_000);
  afterAll(async () => {
    await host?.close();
    for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
  });

  it('hyperframes-basic: all pass, measured transparent', async () => {
    const bundle = await inspect('hyperframes-basic', { manifest: { alpha: true } });
    const report = await verifyBundle(host, bundle);
    expect(report.checks.filter((c) => c.status === 'failed')).toEqual([]);
    expect(report.status).toBe('passed');
    expect(report).toMatchObject({ format: 'cuccut.code-bundle-verification', schemaVersion: 1, bundleId: bundle.manifest.bundleId });
    expect(report.capabilities).toMatchObject({
      contract: 'hyperframes/1',
      randomAccess: true,
      alpha: true,
      width: 1280,
      height: 720,
      fps: { num: 30, den: 1 },
      durationFrames: 60,
      host: 'electron-offscreen',
      networkIsolated: true,
    });
    expect(report.checks.map((c) => c.id)).toEqual([
      'manifest',
      'files',
      'content-hash',
      'network-static',
      'timeline',
      'root',
      'duration',
      'seek',
      'determinism',
      'alpha',
      'network-runtime',
    ]);
    // 0, the middle, the last frame, an out-of-range frame, plus one more middle frame.
    expect(report.sampledFrames.map((f) => f.seconds)).toEqual([0, 1, 59 / 30, 2 + 1 / 30, 1]);
  });

  it('declared transparent but frames fully opaque → alpha fails; declared opaque → alpha is skipped', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cuccut-verify-opaque-'));
    tmpDirs.push(dir);
    const html = fs.readFileSync(path.join(fixtures, 'hyperframes-basic/index.html'), 'utf8');
    fs.writeFileSync(path.join(dir, 'index.html'), html.replace('html, body { margin: 0;', 'html, body { background: #1d3557; margin: 0;'));
    const declared = await verifyBundle(host, await inspect(dir, { manifest: { alpha: true } }));
    expect(check(declared, 'alpha')).toMatchObject({ status: 'failed' });
    expect(declared.capabilities?.alpha).toBe(false);
    expect(declared.status).toBe('failed');
    const opaque = await verifyBundle(host, await inspect('hyperframes-basic'));
    expect(check(opaque, 'alpha')?.status).toBe('skipped');
    expect(opaque.capabilities?.alpha).toBe(false);
    expect(opaque.status).toBe('passed');
  });

  it('nondeterministic: determinism fails (COMPOSITION_NONDETERMINISTIC)', async () => {
    const report = await verifyBundle(host, await inspect('nondeterministic'));
    expect(check(report, 'determinism')).toMatchObject({ status: 'failed', code: 'COMPOSITION_NONDETERMINISTIC' });
    expect(report.status).toBe('failed');
    expect(report.capabilities?.randomAccess).toBe(false);
  });

  it('network-runtime: runtime request is blocked (COMPOSITION_NETWORK_BLOCKED)', async () => {
    const report = await verifyBundle(host, await inspect('network-runtime'));
    expect(check(report, 'network-static')?.status).toBe('passed');
    expect(check(report, 'network-runtime')).toMatchObject({
      status: 'failed',
      code: 'COMPOSITION_NETWORK_BLOCKED',
      detail: 'https://example.invalid/x',
    });
    expect(report.status).toBe('failed');
  });

  it('root-missing: root fails, the remaining execution items are skipped', async () => {
    const bundle = await inspect('root-missing', { manifest: { width: 1280, height: 720, fps: 30, durationFrames: 60 } });
    const report = await verifyBundle(host, bundle);
    expect(check(report, 'timeline')?.status).toBe('passed');
    expect(check(report, 'root')).toMatchObject({ status: 'failed', code: 'COMPOSITION_ROOT_MISSING' });
    expect(check(report, 'seek')?.status).toBe('skipped');
    expect(report.capabilities).toBeNull();
    expect(report.status).toBe('failed');
  });
});
