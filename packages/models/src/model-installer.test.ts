import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { BundleDefinition, ComponentRelease } from './bundle-registry.ts';
import { readInstallRecord } from './install-record.ts';
import { ModelCatalog } from './model-catalog.ts';
import { DownloadError } from './model-downloader.ts';
import { ModelInstaller, type InstallProgress } from './model-installer.ts';
import { stagingDirOf } from './model-staging.ts';
import {
  serveRepo,
  sharedVadBundles,
  startFakeModelSource,
  syntheticBytes,
  syntheticManifest,
  type FakeModelSource,
  type SyntheticRepo,
} from './testing/fake-model-source.ts';

const asrA: SyntheticRepo = {
  repo: 'acme/asr-a',
  revision: 'a'.repeat(40),
  files: { 'config.json': Buffer.from('{"a":1}'), 'model.safetensors': syntheticBytes(200_000, 1) },
};
const asrB: SyntheticRepo = {
  repo: 'acme/asr-b',
  revision: 'b'.repeat(40),
  files: { 'config.json': Buffer.from('{"b":1}'), 'model.safetensors': syntheticBytes(150_000, 2) },
};
const vad: SyntheticRepo = {
  repo: 'acme/vad',
  revision: 'c'.repeat(40),
  files: { 'config.json': Buffer.from('{}'), 'model.safetensors': syntheticBytes(40_000, 3) },
};
const bytesOf = (repo: SyntheticRepo) => Object.values(repo.files).reduce((sum, b) => sum + b.length, 0);

describe('ModelInstaller', () => {
  let root: string;
  let source: FakeModelSource;
  let free: number | null;
  const mac = { platform: 'darwin' as const, arch: 'arm64' };
  const bundles = sharedVadBundles(asrA, asrB, vad);

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-install-'));
    source = await startFakeModelSource();
    for (const repo of [asrA, asrB, vad]) serveRepo(source, repo);
    free = 10 * 1024 * 1024 * 1024;
  });

  afterEach(async () => {
    await source.close();
    await fs.rm(root, { recursive: true, force: true });
  });

  function setup(options: { sizes?: boolean; probeSizes?: boolean } = {}) {
    const manifests = [asrA, asrB, vad].map((r) => syntheticManifest(r, { sizes: options.sizes ?? true, estimatedBytes: 1_000_000 }));
    const catalog = new ModelCatalog({ root, ...mac, bundles, manifests });
    const installer = new ModelInstaller({
      catalog,
      endpoint: () => source.endpoint,
      manifests,
      freeBytes: async () => free,
      backoffMs: () => 5,
      ...(options.probeSizes !== undefined ? { probeSizes: options.probeSizes } : {}),
    });
    return { catalog, installer };
  }

  const run = (installer: ModelInstaller, bundleId: string, onProgress?: (p: InstallProgress) => void, repair = false) =>
    installer
      .plan(bundleId, { repair })
      .then((detail) => installer.install(detail, { signal: new AbortController().signal, ...(onProgress ? { onProgress } : {}) }));

  it('the plan gives size and source; after install it is installed and recorded in the install log, and progress only increases and is measured in bytes', async () => {
    const { catalog, installer } = setup();
    const detail = await installer.plan('test-a@mlx');
    expect(detail.plan).toMatchObject({
      bundleId: 'test-a@mlx',
      downloadBytes: bytesOf(asrA) + bytesOf(vad),
      confirmBytes: bytesOf(asrA) + bytesOf(vad),
      resumedBytes: 0,
      availableBytes: free,
      source: source.endpoint,
      upToDate: false,
    });
    expect(detail.plan.components.map((c) => [c.component, c.action, c.files])).toEqual([
      ['asr', 'download', ['config.json', 'model.safetensors']],
      ['vad', 'download', ['config.json', 'model.safetensors']],
    ]);
    const progress: InstallProgress[] = [];
    const outcome = await installer.install(detail, { signal: new AbortController().signal, onProgress: (p) => progress.push(p) });
    expect(outcome.downloadedBytes).toBe(bytesOf(asrA) + bytesOf(vad));
    expect(outcome.published.map((m) => m.repo)).toEqual([asrA.repo, vad.repo]);
    expect(progress.at(-1)).toMatchObject({ phase: 'publishing', receivedBytes: bytesOf(asrA) + bytesOf(vad) });
    expect(progress.every((p) => p.totalBytes === bytesOf(asrA) + bytesOf(vad))).toBe(true);
    const received = progress.map((p) => p.receivedBytes);
    expect(received).toEqual([...received].sort((a, b) => a - b));

    const status = await catalog.status('test-a@mlx');
    expect(status).toMatchObject({ state: 'installed' });
    expect(status!.components!.find((c) => c.component === 'vad')).toMatchObject({ state: 'installed', sharedWith: ['test-b@mlx'] });
    expect(Object.keys((await readInstallRecord(root)).bundles)).toEqual(['test-a@mlx']);
    expect((await installer.plan('test-a@mlx')).plan).toMatchObject({ upToDate: true, downloadBytes: 0 });
  });

  it('shared components are installed once: a second bundle downloads only the components it is missing', async () => {
    const { catalog, installer } = setup();
    await run(installer, 'test-a@mlx');
    const before = source.requests.length;
    const detail = await installer.plan('test-b@mlx');
    expect(detail.plan.components.map((c) => [c.component, c.action])).toEqual([
      ['asr', 'download'],
      ['vad', 'keep'],
    ]);
    expect(detail.plan.downloadBytes).toBe(bytesOf(asrB));
    // Another model package is only partly missing a component: report incomplete and name the missing component.
    const status = await catalog.status('test-b@mlx');
    expect(status).toMatchObject({ state: 'not-installed', reason: 'incomplete' });
    expect(status!.detail).toContain('asr');
    await installer.install(detail, { signal: new AbortController().signal });
    expect(new Set(source.requests.slice(before).map((r) => r.repo))).toEqual(new Set([asrB.repo]));
  });

  it('reference counting: deleting one bundle keeps components other bundles use; the last removal reclaims them', async () => {
    const { catalog, installer } = setup();
    await run(installer, 'test-a@mlx');
    await run(installer, 'test-b@mlx');
    const first = await installer.remove('test-a@mlx');
    expect(first.removed).toEqual([asrA.repo]);
    expect(first.kept).toEqual([{ repo: vad.repo, usedBy: ['test-b@mlx'] }]);
    expect(await catalog.status('test-a@mlx')).toMatchObject({ state: 'not-installed', reason: 'incomplete' });
    expect(await catalog.status('test-b@mlx')).toMatchObject({ state: 'installed' });

    const last = await installer.remove('test-b@mlx');
    expect(last.removed.sort()).toEqual([asrB.repo, vad.repo].sort());
    expect(last.kept).toEqual([]);
    expect(await fs.readdir(root)).toEqual(['.ccut-installs.json']);
    expect((await readInstallRecord(root)).bundles).toEqual({});
  });

  it('a bundle with all files present but no record also counts as a holder', async () => {
    const { installer } = setup();
    await run(installer, 'test-a@mlx');
    await run(installer, 'test-b@mlx');
    await fs.rm(path.join(root, '.ccut-installs.json'));
    const result = await installer.remove('test-a@mlx');
    expect(result.kept).toEqual([{ repo: vad.repo, usedBy: ['test-b@mlx'] }]);
  });

  it('a repository directory holding another version is not deleted', async () => {
    const { installer } = setup();
    const other = { ...vad, revision: 'd'.repeat(40) };
    serveRepo(source, other);
    const manifests = [syntheticManifest(other)];
    const catalog2 = new ModelCatalog({
      root,
      ...mac,
      bundles: [
        {
          ...bundles[0]!,
          bundleId: 'other@mlx',
          components: { vad: { family: 'silero-vad', repo: other.repo, revision: other.revision } },
        },
      ],
      manifests,
    });
    const otherInstaller = new ModelInstaller({
      catalog: catalog2,
      endpoint: () => source.endpoint,
      manifests,
      freeBytes: async () => free,
    });
    await run(otherInstaller, 'other@mlx');
    const result = await installer.remove('test-a@mlx');
    expect(result.kept).toEqual([{ repo: vad.repo, usedBy: [] }]);
    expect(await fs.stat(path.join(root, 'acme', 'vad')).catch(() => null)).not.toBeNull();
  });

  it('repair re-downloads only the bad and missing files and reuses good files as they are', async () => {
    const { catalog, installer } = setup();
    await run(installer, 'test-a@mlx');
    const asrDir = catalog.repoDir(asrA.repo);
    // Same size, corrupted content: only the sha256 check during repair can detect it.
    const weights = path.join(asrDir, 'model.safetensors');
    const bad = Buffer.from(asrA.files['model.safetensors']!);
    bad[10] = bad[10]! ^ 0xff;
    await fs.writeFile(weights, bad);
    expect(await catalog.status('test-a@mlx')).toMatchObject({ state: 'installed' });
    expect((await installer.plan('test-a@mlx')).plan.upToDate).toBe(true);

    const before = source.requests.length;
    const detail = await installer.plan('test-a@mlx', { repair: true });
    expect(detail.plan.components.map((c) => [c.component, c.action, c.files])).toEqual([
      ['asr', 'download', ['model.safetensors']],
      ['vad', 'keep', []],
    ]);
    expect(detail.plan.downloadBytes).toBe(asrA.files['model.safetensors']!.length);
    await installer.install(detail, { signal: new AbortController().signal });
    const fetched = source.requests.slice(before).filter((r) => r.method === 'GET');
    expect(fetched.map((r) => `${r.repo}:${r.file}`)).toEqual([`${asrA.repo}:model.safetensors`]);
    expect(await fs.readFile(weights)).toEqual(asrA.files['model.safetensors']);
    expect(await fs.readFile(path.join(asrDir, 'config.json'))).toEqual(asrA.files['config.json']);
    expect((await catalog.verify('test-a@mlx')).ok).toBe(true);
    expect((await installer.plan('test-a@mlx', { repair: true })).plan.upToDate).toBe(true);
  });

  it('components with missing files: only the missing files are fetched, not the whole component', async () => {
    const { catalog, installer } = setup();
    await run(installer, 'test-a@mlx');
    await fs.rm(path.join(catalog.repoDir(vad.repo), 'config.json'));
    expect(await catalog.status('test-a@mlx')).toMatchObject({ state: 'not-installed', reason: 'incomplete' });
    const detail = await installer.plan('test-a@mlx');
    expect(detail.plan.components.map((c) => [c.component, c.action, c.files])).toEqual([
      ['asr', 'keep', []],
      ['vad', 'download', ['config.json']],
    ]);
    expect(detail.plan.downloadBytes).toBe(vad.files['config.json']!.length);
    const before = source.requests.length;
    await installer.install(detail, { signal: new AbortController().signal });
    expect(source.requests.slice(before).map((r) => r.file)).toEqual(['config.json']);
    expect(await catalog.status('test-a@mlx')).toMatchObject({ state: 'installed' });
  });

  it('insufficient free space: MODEL_DOWNLOAD_NO_SPACE with the needed and available bytes, and no request is sent', async () => {
    const { installer } = setup();
    free = 1000;
    const detail = await installer.plan('test-a@mlx');
    expect(detail.plan.availableBytes).toBe(1000);
    const error = await installer.install(detail, { signal: new AbortController().signal }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DownloadError);
    expect((error as DownloadError).code).toBe('MODEL_DOWNLOAD_NO_SPACE');
    expect((error as DownloadError).details).toEqual({ requiredBytes: bytesOf(asrA) + bytesOf(vad), availableBytes: 1000 });
    // The remedy is a one-line message for people: no field names appear (how much is needed and how much is left are spoken by the UI and CLI from `details`).
    expect((error as DownloadError).remedy).toBe(
      '模型目录所在的磁盘空间不足：清理出足够的空间（或在设置里把模型目录换到别的磁盘）后再安装',
    );
    expect(source.requests.filter((r) => r.method === 'GET')).toEqual([]);
  });

  it('after cancel, staging is kept: the bundle reports a paused install; planning again counts only the remaining bytes and resumes', async () => {
    const { catalog, installer } = setup();
    source.throttle(8 * 1024, 10);
    const controller = new AbortController();
    const detail = await installer.plan('test-a@mlx');
    const running = installer.install(detail, {
      signal: controller.signal,
      onProgress: (p) => {
        if (p.receivedBytes > 50_000) controller.abort(new Error('cancelled'));
      },
    });
    await expect(running).rejects.toThrow('cancelled');
    const status = await catalog.status('test-a@mlx');
    expect(status).toMatchObject({
      state: 'not-installed',
      install: { state: 'paused', jobId: null, totalBytes: bytesOf(asrA) + bytesOf(vad) },
    });
    const staged = status!.install!.receivedBytes;
    expect(staged).toBeGreaterThan(50_000);

    source.throttle(64 * 1024, 0);
    const again = await installer.plan('test-a@mlx');
    expect(again.plan.resumedBytes).toBe(staged);
    expect(again.plan.downloadBytes).toBe(bytesOf(asrA) + bytesOf(vad) - staged);
    expect(again.totalBytes).toBe(bytesOf(asrA) + bytesOf(vad));
    const before = source.requests.length;
    const outcome = await installer.install(again, { signal: new AbortController().signal });
    expect(outcome.downloadedBytes).toBe(bytesOf(asrA) + bytesOf(vad) - staged);
    expect(source.requests.slice(before).some((r) => r.range !== null)).toBe(true);
    expect(await catalog.status('test-a@mlx')).toMatchObject({ state: 'installed' });
  });

  it('discarding a paused install deletes staging', async () => {
    const { catalog, installer } = setup();
    const stage = stagingDirOf(root, asrA.repo, asrA.revision);
    await fs.mkdir(stage, { recursive: true });
    await fs.writeFile(path.join(stage, 'model.safetensors.part'), Buffer.alloc(500));
    expect((await catalog.status('test-a@mlx'))!.install).toMatchObject({ state: 'paused', receivedBytes: 500 });
    await installer.discard('test-a@mlx');
    expect((await catalog.status('test-a@mlx'))!.install).toBeUndefined();
    expect(await fs.readdir(root)).toEqual([]);
  });

  it('unknown size: planning sends HEAD to the source for the size; when unavailable the total is unknown and is confirmed with an estimate', async () => {
    const { installer } = setup({ sizes: false });
    const detail = await installer.plan('test-a@mlx');
    expect(detail.plan.downloadBytes).toBe(bytesOf(asrA) + bytesOf(vad));
    expect(source.requests.filter((r) => r.method === 'HEAD')).toHaveLength(4);

    const { installer: blind } = setup({ sizes: false, probeSizes: false });
    const unknown = await blind.plan('test-a@mlx');
    expect(unknown.plan).toMatchObject({ downloadBytes: null, estimatedBytes: 2_000_000, confirmBytes: 2_000_000 });
    expect(unknown.totalBytes).toBeNull();
    const progress: InstallProgress[] = [];
    await blind.install(unknown, { signal: new AbortController().signal, onProgress: (p) => progress.push(p) });
    expect(progress.every((p) => p.totalBytes === null)).toBe(true);
    expect(progress.at(-1)!.receivedBytes).toBe(bytesOf(asrA) + bytesOf(vad));
  });

  it('HEAD gives no size (ModelScope): a GET for only the first byte is sent instead, reading the total length from Content-Range', async () => {
    const manifests = [asrA, asrB, vad].map((r) => syntheticManifest(r, { sizes: false, estimatedBytes: 1_000_000 }));
    const catalog = new ModelCatalog({ root, ...mac, bundles, manifests });
    const sizeless: typeof fetch = async (input, init) => {
      const response = await fetch(input, init);
      return init?.method === 'HEAD' ? new Response(null, { status: response.status }) : response;
    };
    const installer = new ModelInstaller({ catalog, endpoint: () => source.endpoint, manifests, freeBytes: async () => free, fetch: sizeless });
    const detail = await installer.plan('test-a@mlx');
    expect(detail.plan.downloadBytes).toBe(bytesOf(asrA) + bytesOf(vad));
    const ranged = source.requests.filter((r) => r.method === 'GET');
    expect(ranged).toHaveLength(4);
    expect(ranged.every((r) => r.range === 'bytes=0-0')).toBe(true);

    // ModelScope's small files: return 200 with a `Content-Length` of 1, but with a `Content-Range`.
    const quirky: typeof fetch = async (input, init) => {
      const response = await sizeless(input, init);
      return response.status === 206 ? new Response(await response.arrayBuffer(), { status: 200, headers: response.headers }) : response;
    };
    const quirk = new ModelInstaller({ catalog, endpoint: () => source.endpoint, manifests, freeBytes: async () => free, fetch: quirky });
    expect((await quirk.plan('test-a@mlx')).plan.downloadBytes).toBe(bytesOf(asrA) + bytesOf(vad));
  });

  it('planned source: when ModelScope is selected, repositories it lacks are downloaded from the public model repository, and both base URLs are written out', async () => {
    const whisper: SyntheticRepo = { repo: 'ggerganov/whisper.cpp', revision: 'e'.repeat(40), files: { 'ggml.bin': Buffer.from('w') } };
    const manifests = [syntheticManifest(vad), syntheticManifest(whisper)];
    const def = {
      ...bundles[0]!,
      bundleId: 'ggml@cpu',
      backend: 'ggml' as const,
      device: 'cpu',
      components: { ...bundles[0]!.components, asr: { family: 'whisper-ggml' as const, repo: whisper.repo, revision: whisper.revision } },
    };
    const catalog = new ModelCatalog({ root, platform: 'win32', arch: 'x64', bundles: [def], manifests });
    const plan = async (endpoint: string) =>
      (await new ModelInstaller({ catalog, endpoint: () => endpoint, manifests, freeBytes: async () => free, probeSizes: false }).plan(def.bundleId))
        .plan.source;
    expect(await plan('https://www.modelscope.cn')).toBe('https://www.modelscope.cn + https://huggingface.co');
    expect(await plan('https://mirror.example')).toBe('https://mirror.example');
  });

  it('built-in manifest lacks a trusted hash: installation is refused (it does not download and then compute one)', async () => {
    const manifests = [asrA, vad].map((r) => syntheticManifest(r));
    manifests[1]!.files[0]!.sha256 = null;
    const catalog = new ModelCatalog({ root, ...mac, bundles, manifests });
    const installer = new ModelInstaller({ catalog, endpoint: () => source.endpoint, manifests, freeBytes: async () => free });
    const error = await installer.plan('test-a@mlx').catch((e: unknown) => e);
    expect((error as DownloadError).code).toBe('MODEL_MANIFEST_INCOMPLETE');
    expect((error as DownloadError).details).toEqual({ repo: vad.repo, files: ['config.json'] });
    expect(source.requests).toEqual([]);
  });

  it('self-test results are recorded in the install log, the bundle status carries selfTest, and status changes notify listeners', async () => {
    const { catalog, installer } = setup();
    await run(installer, 'test-a@mlx');
    const changed: string[] = [];
    catalog.onChange((id) => changed.push(id));
    await installer.recordSelfTest('test-a@mlx', { state: 'passed', jobId: 'job-1', at: '2026-10-03T00:00:00.000Z' });
    expect((await catalog.status('test-a@mlx'))!.selfTest).toEqual({ state: 'passed', jobId: 'job-1', at: '2026-10-03T00:00:00.000Z' });
    catalog.setInstallState('test-b@mlx', { jobId: 'job-2', state: 'downloading', receivedBytes: 10, totalBytes: 100 });
    expect(await catalog.status('test-b@mlx')).toMatchObject({
      state: 'downloading',
      install: { jobId: 'job-2', state: 'downloading', receivedBytes: 10, totalBytes: 100 },
    });
    catalog.setInstallState('test-b@mlx', null);
    expect(changed).toEqual(['test-a@mlx', 'test-b@mlx', 'test-b@mlx']);
  });

  it('a manifest\'s sourceRepo: size and files are requested from the upstream repository and installed into the registered sibling directory', async () => {
    const upstream: SyntheticRepo = { repo: 'acme/whisper', revision: 'd'.repeat(40), files: { 'big.bin': syntheticBytes(120_000, 4) } };
    serveRepo(source, upstream);
    const sibling = { ...syntheticManifest(upstream, { sizes: false }), repo: 'acme/whisper-big', sourceRepo: upstream.repo };
    const manifests = [syntheticManifest(vad), sibling];
    const def = {
      ...bundles[0]!,
      bundleId: 'big@ggml',
      backend: 'ggml' as const,
      device: 'cpu',
      components: { ...bundles[0]!.components, asr: { family: 'whisper-ggml' as const, repo: sibling.repo, revision: upstream.revision } },
    };
    const catalog = new ModelCatalog({ root, platform: 'win32', arch: 'x64', bundles: [def], manifests });
    const installer = new ModelInstaller({ catalog, endpoint: () => source.endpoint, manifests, freeBytes: async () => free });
    const detail = await installer.plan(def.bundleId);
    expect(detail.plan.downloadBytes).toBe(bytesOf(upstream) + bytesOf(vad));
    const heads = source.requests.filter((r) => r.method === 'HEAD');
    expect(heads.map((r) => [r.repo, r.file])).toEqual([[upstream.repo, 'big.bin']]);
    await installer.install(detail, { signal: new AbortController().signal });
    const gets = source.requests.filter((r) => r.method === 'GET' && r.file === 'big.bin');
    expect(gets.map((r) => r.repo)).toEqual([upstream.repo]);
    expect(await fs.readFile(path.join(root, 'acme', 'whisper-big', 'big.bin'))).toEqual(upstream.files['big.bin']);
    await expect(fs.stat(path.join(root, 'acme', 'whisper'))).rejects.toThrow();
    expect(await catalog.status(def.bundleId)).toMatchObject({ state: 'installed', backend: 'ggml', device: 'cpu' });
  });
});

/**
 * Release-page component (audio.cpp engine, architecture design §6.3): downloads the archive for the host platform, checks size and sha256, unpacks it, writes the manifest, and publishes atomically to the tools directory;
 * a bad archive leaves no half-directory; it is reclaimed when the last holder deletes it; an old install without a manifest is not downloaded again. The archive is served by a small server on the local loopback address.
 */
describe('ModelInstaller release-page component', () => {
  let root: string;
  let work: string;
  let source: FakeModelSource;
  let server: http.Server;
  let base: string;
  let assets: Map<string, Buffer>;
  let requests: string[];
  const mac = { platform: 'darwin' as const, arch: 'arm64' };

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-install-release-'));
    work = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-install-pack-'));
    source = await startFakeModelSource();
    for (const repo of [asrA, asrB]) serveRepo(source, repo);
    assets = new Map();
    requests = [];
    server = http.createServer((req, res) => {
      requests.push(req.url ?? '');
      const body = assets.get(req.url ?? '');
      if (!body) {
        res.writeHead(404).end();
        return;
      }
      const range = /^bytes=(\d+)-$/.exec(req.headers.range ?? '');
      const start = range ? Number(range[1]) : 0;
      res.writeHead(range ? 206 : 200, {
        'content-length': String(body.length - start),
        ...(range ? { 'content-range': `bytes ${start}-${body.length - 1}/${body.length}` } : {}),
      });
      res.end(req.method === 'HEAD' ? undefined : body.subarray(start));
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await source.close();
    await fs.rm(root, { recursive: true, force: true });
    await fs.rm(work, { recursive: true, force: true });
  });

  /** Build a tar.gz that looks like an upstream release package: the engine, other tools in the same package, a library, a license, and a subdirectory. */
  function packRelease(script: string): Buffer {
    const dir = path.join(work, `pack-${crypto.randomUUID()}`);
    fsSync.mkdirSync(path.join(dir, 'tools'), { recursive: true });
    fsSync.writeFileSync(path.join(dir, 'audiocpp_cli'), script, { mode: 0o755 });
    fsSync.writeFileSync(path.join(dir, 'audiocpp_server'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
    fsSync.writeFileSync(path.join(dir, 'libggml.so'), 'lib');
    fsSync.writeFileSync(path.join(dir, 'LICENSE'), 'Apache-2.0');
    fsSync.writeFileSync(path.join(dir, 'tools', 'notes.txt'), 'notes');
    const archive = path.join(work, `${crypto.randomUUID()}.tar.gz`);
    execFileSync('tar', ['-czf', archive, '-C', dir, '.']);
    return fsSync.readFileSync(archive);
  }

  function release(body: Buffer, fileName = 'audio-test-bin.tar.gz'): ComponentRelease {
    assets.set(`/download/v0.9.1/${fileName}`, body);
    return {
      name: 'audiocpp',
      version: '0.9.1',
      urlTemplate: `${base}/download/v{version}/{file}`,
      assets: {
        'darwin-arm64': {
          fileName,
          size: body.length,
          sha256: crypto.createHash('sha256').update(body).digest('hex'),
          archive: { format: 'tar.gz', skip: ['audiocpp_server'] },
          executable: 'audiocpp_cli',
        },
      },
    };
  }

  function setup(rel: ComponentRelease, options: { probe?: (exe: string) => Promise<void>; toolsEndpoint?: string } = {}) {
    const engine = { family: 'audio-cpp-engine' as const, repo: '0xShug0/audio.cpp', revision: 'v0.9.1', release: rel };
    const bundle = (bundleId: string, repo: SyntheticRepo): BundleDefinition => ({
      bundleId,
      capability: 'music',
      backend: 'audio-cpp',
      device: 'auto',
      label: bundleId,
      components: { music: { family: 'yue2', repo: repo.repo, revision: repo.revision }, 'audiocpp-engine': engine },
    });
    const bundles = [bundle('music-a@audio-cpp', asrA), bundle('music-b@audio-cpp', asrB)];
    const manifests = [asrA, asrB].map((r) => syntheticManifest(r, { sizes: true, estimatedBytes: 1_000_000 }));
    const catalog = new ModelCatalog({ root, ...mac, bundles, manifests });
    const installer = new ModelInstaller({
      catalog,
      endpoint: () => source.endpoint,
      manifests,
      freeBytes: async () => 10 * 1024 * 1024 * 1024,
      backoffMs: () => 5,
      retries: 0,
      ...(options.probe ? { probeExecutable: options.probe } : {}),
      ...(options.toolsEndpoint ? { toolsEndpoint: options.toolsEndpoint } : {}),
    });
    return { catalog, installer, engineDir: path.join(root, '.ccut-tools', 'audiocpp', '0.9.1') };
  }

  const run = (installer: ModelInstaller, bundleId: string, repair = false) =>
    installer.plan(bundleId, { repair }).then((detail) => installer.install(detail, { signal: new AbortController().signal }));

  it('downloaded together with the model: planning uses the registered size (no HEAD), extracts root-level files, skips same-bundle tools, writes the manifest, and probes the executable', async () => {
    const body = packRelease('#!/bin/sh\necho "audio.cpp 0.9.1"\n');
    const { catalog, installer, engineDir } = setup(release(body), {
      probe: async (exe) => {
        probed.push(exe);
      },
    });
    const probed: string[] = [];
    const detail = await installer.plan('music-a@audio-cpp');
    expect(detail.plan.components.map((c) => [c.component, c.action, c.origin ?? null, c.files])).toEqual([
      ['music', 'download', null, ['config.json', 'model.safetensors']],
      ['audiocpp-engine', 'download', 'github-release', ['audio-test-bin.tar.gz']],
    ]);
    expect(detail.plan.downloadBytes).toBe(bytesOf(asrA) + body.length);
    expect(detail.plan.confirmBytes).toBe(bytesOf(asrA) + body.length);
    // The source for the official address is the part before `/download/` (the release page).
    expect(detail.plan.source).toBe(`${source.endpoint} + ${base}`);
    expect(requests).toEqual([]);
    const outcome = await installer.install(detail, { signal: new AbortController().signal });
    expect(outcome.downloadedBytes).toBe(bytesOf(asrA) + body.length);
    expect(requests).toEqual(['/download/v0.9.1/audio-test-bin.tar.gz']);
    expect((await fs.readdir(engineDir)).sort()).toEqual(['.ccut-manifest.json', 'LICENSE', 'audiocpp_cli', 'libggml.so']);
    const manifest = JSON.parse(await fs.readFile(path.join(engineDir, '.ccut-manifest.json'), 'utf8'));
    expect(manifest).toMatchObject({ format_version: 1, repo: '0xShug0/audio.cpp', revision: 'v0.9.1', source: `${base}/download/v0.9.1/audio-test-bin.tar.gz` });
    expect(manifest.files.map((f: { path: string }) => f.path)).toEqual(['LICENSE', 'audiocpp_cli', 'libggml.so']);
    expect((await fs.stat(path.join(engineDir, 'audiocpp_cli'))).mode & 0o111).not.toBe(0);
    expect(probed).toEqual([path.join(engineDir, 'audiocpp_cli')]);
    expect(await catalog.status('music-a@audio-cpp')).toMatchObject({ state: 'installed' });
    expect(catalog.engineExecutable('music-a@audio-cpp')).toBe(path.join(engineDir, 'audiocpp_cli'));
    expect((await catalog.verify('music-a@audio-cpp')).ok).toBe(true);
    // Clean up the staging area.
    expect(await fs.readdir(path.join(root, '.ccut-tools'))).toEqual(['audiocpp']);
    // A second model package shares this engine: download only its own weights.
    const second = await installer.plan('music-b@audio-cpp');
    expect(second.plan.components.map((c) => [c.component, c.action])).toEqual([
      ['music', 'download'],
      ['audiocpp-engine', 'keep'],
    ]);
  });

  it('tool download mirror: the URL is <base>/<name>/<version>/<filename>, and the planned source is the mirror', async () => {
    const body = packRelease('#!/bin/sh\nexit 0\n');
    const rel = release(body);
    assets.set('/mirror/audiocpp/0.9.1/audio-test-bin.tar.gz', body);
    const { installer, engineDir } = setup(rel, { toolsEndpoint: `${base}/mirror/` });
    const detail = await installer.plan('music-a@audio-cpp');
    expect(detail.plan.source).toBe(`${source.endpoint} + ${base}/mirror`);
    await installer.install(detail, { signal: new AbortController().signal });
    expect(requests).toEqual(['/mirror/audiocpp/0.9.1/audio-test-bin.tar.gz']);
    expect(await fs.stat(path.join(engineDir, 'audiocpp_cli'))).toBeTruthy();
  });

  it('digest mismatch: MODEL_DOWNLOAD_INTEGRITY, the downloaded file is deleted, and no component directory is left', async () => {
    const body = packRelease('#!/bin/sh\nexit 0\n');
    const rel = release(body);
    assets.set('/download/v0.9.1/audio-test-bin.tar.gz', Buffer.concat([body.subarray(0, body.length - 1), Buffer.from([body.at(-1)! ^ 1])]));
    const { installer, engineDir } = setup(rel);
    await expect(run(installer, 'music-a@audio-cpp')).rejects.toMatchObject({ code: 'MODEL_DOWNLOAD_INTEGRITY' });
    expect(await fs.stat(engineDir).catch(() => null)).toBeNull();
    const stage = path.join(root, '.ccut-tools', '.ccut-staging', 'audiocpp@0.9.1');
    const left = await fs.readdir(stage).catch(() => [] as string[]);
    expect(left.filter((f) => f.startsWith('audio-test-bin'))).toEqual([]);
  });

  it('bad archive and missing executable: MODEL_DOWNLOAD_INTEGRITY, staging is deleted, and no half-finished directory is left', async () => {
    const garbage = Buffer.from('this is not a gzip archive at all');
    const { installer, engineDir } = setup(release(garbage));
    await expect(run(installer, 'music-a@audio-cpp')).rejects.toMatchObject({ code: 'MODEL_DOWNLOAD_INTEGRITY' });
    expect(await fs.stat(engineDir).catch(() => null)).toBeNull();
    expect(await fs.stat(path.join(root, '.ccut-tools', '.ccut-staging')).catch(() => null)).toBeNull();

    const dir = path.join(work, 'no-exe');
    fsSync.mkdirSync(dir);
    fsSync.writeFileSync(path.join(dir, 'LICENSE'), 'x');
    const archive = path.join(work, 'no-exe.tar.gz');
    execFileSync('tar', ['-czf', archive, '-C', dir, '.']);
    const noExe = setup(release(fsSync.readFileSync(archive), 'no-exe.tar.gz'));
    const error = await run(noExe.installer, 'music-a@audio-cpp').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DownloadError);
    expect(error).toMatchObject({ code: 'MODEL_DOWNLOAD_INTEGRITY' });
    expect((error as Error).message).toContain('audiocpp_cli');
    expect(await fs.stat(engineDir).catch(() => null)).toBeNull();
    expect(await fs.stat(path.join(root, '.ccut-tools', '.ccut-staging')).catch(() => null)).toBeNull();
  });

  it('probe failure: the just-published component directory is deleted, MODEL_DOWNLOAD_INTEGRITY', async () => {
    const { installer, engineDir } = setup(release(packRelease('#!/bin/sh\nexit 1\n')), {
      probe: async () => {
        throw new Error('exit code 1');
      },
    });
    await expect(run(installer, 'music-a@audio-cpp')).rejects.toMatchObject({ code: 'MODEL_DOWNLOAD_INTEGRITY' });
    expect(await fs.stat(engineDir).catch(() => null)).toBeNull();
  });

  it('reference counting: deleting one bundle keeps the shared engine; the last removal reclaims the engine in the tool directory', async () => {
    const { catalog, installer, engineDir } = setup(release(packRelease('#!/bin/sh\nexit 0\n')));
    await run(installer, 'music-a@audio-cpp');
    await run(installer, 'music-b@audio-cpp');
    const first = await installer.remove('music-a@audio-cpp');
    expect(first.removed).toEqual([asrA.repo]);
    expect(first.kept).toEqual([{ repo: '0xShug0/audio.cpp', usedBy: ['music-b@audio-cpp'] }]);
    expect(await fs.stat(path.join(engineDir, 'audiocpp_cli'))).toBeTruthy();
    const last = await installer.remove('music-b@audio-cpp');
    expect(last.removed).toEqual([asrB.repo, '0xShug0/audio.cpp']);
    expect(await fs.stat(engineDir).catch(() => null)).toBeNull();
    expect(await fs.stat(path.join(root, '.ccut-tools', 'audiocpp')).catch(() => null)).toBeNull();
    expect(await catalog.status('music-b@audio-cpp')).toMatchObject({ state: 'not-installed' });
  });

  it('an engine from an older install (executable only, no manifest): planning does not download it and verification passes; repair re-downloads it and writes the manifest', async () => {
    const body = packRelease('#!/bin/sh\nexit 0\n');
    const { catalog, installer, engineDir } = setup(release(body));
    await fs.mkdir(engineDir, { recursive: true });
    await fs.writeFile(path.join(engineDir, 'audiocpp_cli'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
    await run(installer, 'music-a@audio-cpp');
    expect(requests).toEqual([]);
    expect(await catalog.status('music-a@audio-cpp')).toMatchObject({ state: 'installed' });
    expect((await catalog.verify('music-a@audio-cpp')).ok).toBe(true);
    const plan = await installer.plan('music-a@audio-cpp');
    expect(plan.plan.upToDate).toBe(true);
    expect(plan.plan.downloadBytes).toBe(0);

    const repair = await installer.plan('music-a@audio-cpp', { repair: true });
    expect(repair.plan.components.map((c) => [c.component, c.action])).toEqual([
      ['music', 'keep'],
      ['audiocpp-engine', 'download'],
    ]);
    await installer.install(repair, { signal: new AbortController().signal });
    expect(requests).toEqual(['/download/v0.9.1/audio-test-bin.tar.gz']);
    expect(await fs.stat(path.join(engineDir, '.ccut-manifest.json'))).toBeTruthy();
    // With a manifest, repair verifies against the manifest; intact files are not downloaded again.
    const again = await installer.plan('music-a@audio-cpp', { repair: true });
    expect(again.plan.components.map((c) => c.action)).toEqual(['keep', 'keep']);
  });

  it('an engine satisfied by engineOverride: the plan is keep, nothing is downloaded, and platforms without an engine bundle can still install', async () => {
    const exe = path.join(work, 'my-audiocpp_cli');
    await fs.writeFile(exe, '#!/bin/sh\nexit 0\n', { mode: 0o755 });
    const rel = release(packRelease('#!/bin/sh\nexit 0\n'));
    const bundles: BundleDefinition[] = [
      {
        bundleId: 'music-a@audio-cpp',
        capability: 'music',
        backend: 'audio-cpp',
        device: 'auto',
        label: 'a',
        components: {
          music: { family: 'yue2', repo: asrA.repo, revision: asrA.revision },
          'audiocpp-engine': { family: 'audio-cpp-engine', repo: '0xShug0/audio.cpp', revision: 'v0.9.1', release: rel },
        },
      },
    ];
    const manifests = [syntheticManifest(asrA, { sizes: true, estimatedBytes: 1_000_000 })];
    const catalog = new ModelCatalog({ root, platform: 'linux', arch: 'arm64', bundles, manifests, engineOverride: exe });
    const installer = new ModelInstaller({ catalog, endpoint: () => source.endpoint, manifests, freeBytes: async () => null });
    const detail = await installer.plan('music-a@audio-cpp');
    expect(detail.plan.components.map((c) => [c.component, c.action])).toEqual([
      ['music', 'download'],
      ['audiocpp-engine', 'keep'],
    ]);
    await installer.install(detail, { signal: new AbortController().signal });
    expect(requests).toEqual([]);
    expect(await catalog.status('music-a@audio-cpp')).toMatchObject({ state: 'installed' });
    // Without an override, this platform has no engine package: reject the plan.
    const plain = new ModelCatalog({ root, platform: 'linux', arch: 'arm64', bundles, manifests });
    await expect(new ModelInstaller({ catalog: plain, endpoint: () => source.endpoint, manifests }).plan('music-a@audio-cpp', { repair: true })).rejects.toMatchObject({
      code: 'MODEL_DOWNLOAD_SOURCE',
    });
  });
});
