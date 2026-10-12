import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CucCutClient } from '@cuccut/client';
import {
  AUDIO_CPP_CLI_ENV,
  AUDIO_CPP_ENGINE_COMPONENT,
  AUDIO_CPP_RELEASE,
  MODELS_ENDPOINT_ENV,
  ModelCatalog,
  hostPlatformKey,
  platformBundles,
  type BundleDefinition,
} from '@cuccut/models';
import { serveRepo, startFakeModelSource, syntheticBytes, syntheticManifest, type FakeModelSource, type SyntheticRepo } from '@cuccut/models/testing';
import type { ModelBundleStatus } from '@cuccut/protocol';
import { resolveRuntimeHome } from '@cuccut/runtime-storage';
import { ToolDriver } from '../agent-tools/testing/fake-agent.ts';
import { startRuntime, type RunningRuntime } from '../runtime.ts';
import { resolveAudioCppCli } from './model-jobs.ts';

/**
 * 音乐模型包与它的引擎组件经网关端到端（架构设计 §6.3、§6.5；Model Worker 协议规范 §4.4）：`models.install` 一份计划里既有
 * YuE2 的权重（本机回环地址上的假模型来源），也有 audio.cpp 引擎（`audiocpp-engine`，来自 GitHub 发布页的组件；这里由假的工具
 * 下载镜像 `CUCCUT_TOOLS_ENDPOINT` 提供）。
 *
 * - 「发布文件」是测试里打的 `.tar.gz`，结构照上游（`./` 前缀、根目录的可执行文件与库、同包的其他工具、子目录）；里面的
 *   `audiocpp_cli` 是打印 `audio.cpp 0.9.1` 的 shell 脚本。模型包登记里引擎的压缩包换成它（大小与 sha256 现算）；不访问真实网络。
 * - 安装后引擎在 `<home>/tools/audiocpp/<版本>/`，只有根目录里该解开的文件和清单；模型包 `installed`，能力视图看到引擎；删除后回收。
 * - 坏包、探测不过：任务以 `MODEL_DOWNLOAD_INTEGRITY` 失败，不留半个目录。
 * - 旧版作为受管外部工具装下的引擎（有可执行文件、没有清单）直接算装好，计划不再下载它。
 */

const MUSIC_BUNDLE = 'yue2-3b@audio-cpp-q8';
const ENGINE = 'audiocpp-engine';
const VERSION = AUDIO_CPP_RELEASE.version;

interface Release {
  bytes: Buffer;
  fileName: string;
}

async function packRelease(dir: string, script: string): Promise<Release> {
  const root = path.join(dir, 'pack');
  await fs.rm(root, { recursive: true, force: true });
  await fs.mkdir(path.join(root, 'tools'), { recursive: true });
  await fs.writeFile(path.join(root, 'audiocpp_cli'), script, { mode: 0o755 });
  await fs.writeFile(path.join(root, 'audiocpp_server'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
  await fs.writeFile(path.join(root, 'libggml.so'), 'lib');
  await fs.writeFile(path.join(root, 'LICENSE'), 'Apache-2.0');
  await fs.writeFile(path.join(root, 'tools', 'notes.txt'), 'not extracted');
  const fileName = 'audio-test-bin.tar.gz';
  const archive = path.join(dir, fileName);
  execFileSync('tar', ['-czf', archive, '-C', root, '.']);
  return { bytes: await fs.readFile(archive), fileName };
}

/** 这台主机的模型包，音乐模型包的引擎压缩包换成测试打的那一个。 */
function bundlesWith(release: Release): BundleDefinition[] {
  const sha256 = createHash('sha256').update(release.bytes).digest('hex');
  const engine = {
    ...AUDIO_CPP_ENGINE_COMPONENT,
    release: {
      ...AUDIO_CPP_RELEASE,
      assets: {
        [hostPlatformKey()]: {
          fileName: release.fileName,
          size: release.bytes.length,
          sha256,
          archive: { format: 'tar.gz' as const, skip: ['audiocpp_server'] },
          executable: 'audiocpp_cli',
        },
      },
    },
  };
  return platformBundles(process.platform, process.arch).map((def) =>
    def.bundleId === MUSIC_BUNDLE ? { ...def, components: { ...def.components, [ENGINE]: engine } } : def,
  );
}

const musicDef = platformBundles(process.platform, process.arch).find((b) => b.bundleId === MUSIC_BUNDLE)!;
const musicRepo: SyntheticRepo = {
  repo: musicDef.components.music!.repo,
  revision: musicDef.components.music!.revision,
  files: {
    'config.json': Buffer.from('{"synthetic":"yue2"}'),
    [musicDef.music!.files.model]: syntheticBytes(60_000, 21),
    [musicDef.music!.files.vae]: syntheticBytes(20_000, 22),
  },
};
const MUSIC_BYTES = Object.values(musicRepo.files).reduce((sum, b) => sum + b.length, 0);

interface Side {
  dir: string;
  runtime: RunningRuntime;
  client: CucCutClient;
  toolsDir: string;
  requests: string[];
  close(): Promise<void>;
}

async function startSide(source: FakeModelSource, release: Release, prepare?: (toolsDir: string) => Promise<void>): Promise<Side> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-music-engine-'));
  const home = resolveRuntimeHome({ CUCCUT_HOME: path.join(dir, 'home') });
  const toolsDir = path.join(home.root, 'tools');
  await prepare?.(toolsDir);
  const requests: string[] = [];
  const server = http.createServer((request, response) => {
    requests.push(request.url ?? '');
    if (request.url !== `/mirror/audiocpp/${VERSION}/${release.fileName}`) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { 'Content-Length': String(release.bytes.length) }).end(release.bytes);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  const emptyPath = path.join(dir, 'empty-path');
  await fs.mkdir(emptyPath);
  const runtime = await startRuntime({
    home,
    drivers: () => [new ToolDriver()],
    watchSpace: false,
    engineHost: null,
    modelWorker: null,
    externalTools: {
      env: async () => ({ PATH: emptyPath }),
      // 不读真实环境：没有 CUCCUT_AUDIOCPP_CLI，PATH 是空目录，工具下载镜像指向假服务。
      overrides: { PATH: emptyPath, CUCCUT_TOOLS_ENDPOINT: `http://127.0.0.1:${port}/mirror` },
      lookup: async () => ['93.184.216.34'],
    },
    modelInstall: {
      env: { [MODELS_ENDPOINT_ENV]: source.endpoint },
      installer: { manifests: [syntheticManifest(musicRepo)], freeBytes: async () => 10 * 1024 ** 3, backoffMs: () => 5, retries: 1 },
      bundles: bundlesWith(release),
    },
  });
  const { endpoint, token } = runtime.discovery;
  const client = new CucCutClient({ resolve: async () => ({ endpoint, token }), client: { kind: 'desktop', name: 'test', version: '0' }, reconnect: false });
  await client.connect();
  return {
    dir,
    runtime,
    client,
    toolsDir,
    requests,
    close: async () => {
      client.close();
      await runtime.close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await fs.rm(dir, { recursive: true, force: true });
    },
  };
}

async function bundleOf(client: CucCutClient): Promise<ModelBundleStatus> {
  return (await client.request('models.list', {})).bundles.find((b) => b.bundleId === MUSIC_BUNDLE)!;
}

/** 能力视图里本地音乐模型的引擎：`local.engine.executable`。 */
async function musicEngineInCapabilities(client: CucCutClient): Promise<string | null | undefined> {
  const { capabilities } = await client.request('models.capabilities', {});
  let found: string | null | undefined;
  const visit = (value: unknown): void => {
    if (found !== undefined || !value || typeof value !== 'object') return;
    const record = value as Record<string, unknown>;
    if (record.modelId === MUSIC_BUNDLE && record.local && typeof record.local === 'object') {
      found = ((record.local as { engine?: { executable?: string | null } }).engine?.executable ?? null) as string | null;
      return;
    }
    for (const child of Object.values(record)) visit(child);
  };
  visit(capabilities);
  return found;
}

/** 两步安装（先拿计划，再按计划的字节确认），等任务结束。 */
async function install(side: Side) {
  const first = await side.client.request('models.install', { bundleId: MUSIC_BUNDLE });
  expect(first.jobId).toBeNull();
  const submitted = await side.client.request('models.install', { bundleId: MUSIC_BUNDLE, confirmBytes: first.plan.confirmBytes });
  await side.runtime.models.jobs.settled(submitted.jobId!);
  return { plan: first.plan, job: side.runtime.models.jobs.inspect(submitted.jobId!) };
}

describe.skipIf(process.platform === 'win32')('音乐模型包与引擎组件的安装（假模型来源 + 假工具镜像 + 假 audiocpp_cli）', () => {
  let source: FakeModelSource;
  let side: Side | undefined;
  let scratch: string;

  beforeEach(async () => {
    source = await startFakeModelSource();
    serveRepo(source, musicRepo);
    scratch = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-music-engine-pack-'));
  });

  afterEach(async () => {
    await side?.close();
    side = undefined;
    await source.close();
    await fs.rm(scratch, { recursive: true, force: true });
  });

  it('一份计划装权重与引擎：引擎解开到 tools/audiocpp/<版本>/，模型包 installed，能力视图看到引擎；删除后回收', async () => {
    const release = await packRelease(scratch, '#!/bin/sh\necho "audio.cpp 0.9.1"\necho "backends: cpu"\n');
    side = await startSide(source, release);
    const s = side;

    const before = await bundleOf(s.client);
    expect(before.state).toBe('not-installed');
    expect(before.components).toContainEqual(expect.objectContaining({ component: ENGINE, origin: 'github-release', state: 'missing' }));
    expect(await musicEngineInCapabilities(s.client)).toBeNull();

    const { plan, job } = await install(s);
    expect(plan.components).toContainEqual(
      expect.objectContaining({ component: ENGINE, origin: 'github-release', action: 'download', bytes: release.bytes.length, files: [release.fileName] }),
    );
    expect(plan.downloadBytes).toBe(MUSIC_BYTES + release.bytes.length);
    expect(plan.source).toContain(source.endpoint);
    expect(plan.source).toContain('/mirror');
    expect(job).toMatchObject({ state: 'completed', kind: 'modelInstall' });
    expect(s.requests).toEqual([`/mirror/audiocpp/${VERSION}/${release.fileName}`]);

    const dir = path.join(s.toolsDir, 'audiocpp', VERSION);
    expect((await fs.readdir(dir)).sort()).toEqual(['.ccut-manifest.json', 'LICENSE', 'audiocpp_cli', 'libggml.so']);
    expect((await fs.stat(path.join(dir, 'audiocpp_cli'))).mode & 0o111).not.toBe(0);
    // 暂存区不留压缩包与解开的目录。
    expect(await fs.readdir(s.toolsDir)).toEqual(['audiocpp']);

    const after = await bundleOf(s.client);
    expect(after.state).toBe('installed');
    expect(after.components).toContainEqual(expect.objectContaining({ component: ENGINE, origin: 'github-release', state: 'installed' }));
    expect(await musicEngineInCapabilities(s.client)).toBe(path.join(dir, 'audiocpp_cli'));

    // 再装：已是最新，不下载。
    expect((await s.client.request('models.install', { bundleId: MUSIC_BUNDLE })).plan).toMatchObject({ upToDate: true, downloadBytes: 0 });

    await s.client.request('models.remove', { bundleId: MUSIC_BUNDLE });
    expect(await fs.stat(dir).catch(() => null)).toBeNull();
    expect((await bundleOf(s.client)).state).toBe('not-installed');
    expect(await musicEngineInCapabilities(s.client)).toBeNull();
  });

  it('坏包（摘要对得上但解不开）：MODEL_DOWNLOAD_INTEGRITY，不留引擎目录与暂存', async () => {
    const broken: Release = { bytes: Buffer.from('not an archive'), fileName: 'audio-test-bin.tar.gz' };
    side = await startSide(source, broken);
    const { job } = await install(side);
    expect(job).toMatchObject({ state: 'failed', error: { code: 'MODEL_DOWNLOAD_INTEGRITY' } });
    expect(await fs.readdir(side.toolsDir).catch(() => [])).toEqual([]);
    expect((await bundleOf(side.client)).components).toContainEqual(expect.objectContaining({ component: ENGINE, state: 'missing' }));
  });

  it('探测认不出是 audio.cpp：MODEL_DOWNLOAD_INTEGRITY，删掉刚发布的引擎目录', async () => {
    const release = await packRelease(scratch, '#!/bin/sh\necho "something else"\n');
    side = await startSide(source, release);
    const { job } = await install(side);
    expect(job).toMatchObject({ state: 'failed', error: { code: 'MODEL_DOWNLOAD_INTEGRITY' } });
    expect(await fs.stat(path.join(side.toolsDir, 'audiocpp', VERSION)).catch(() => null)).toBeNull();
  });

  it('迁移：旧版作为受管外部工具装下的引擎（没有清单）直接算装好，只下载权重；装好后计划为 0 字节', async () => {
    const release = await packRelease(scratch, '#!/bin/sh\necho "audio.cpp 0.9.1"\n');
    const legacy = (toolsDir: string) => path.join(toolsDir, 'audiocpp', VERSION, 'audiocpp_cli');
    side = await startSide(source, release, async (toolsDir) => {
      await fs.mkdir(path.dirname(legacy(toolsDir)), { recursive: true });
      await fs.writeFile(legacy(toolsDir), '#!/bin/sh\necho "audio.cpp 0.9.1"\n', { mode: 0o755 });
    });
    const s = side;
    expect((await bundleOf(s.client)).components).toContainEqual(expect.objectContaining({ component: ENGINE, state: 'installed' }));

    const { plan, job } = await install(s);
    expect(plan.components).toContainEqual(expect.objectContaining({ component: ENGINE, action: 'keep', bytes: 0 }));
    expect(plan.downloadBytes).toBe(MUSIC_BYTES);
    expect(job).toMatchObject({ state: 'completed' });
    expect(s.requests).toEqual([]);
    // 旧的目录原样留着（没有补写清单）。
    expect(await fs.readdir(path.dirname(legacy(s.toolsDir)))).toEqual(['audiocpp_cli']);

    expect((await bundleOf(s.client)).state).toBe('installed');
    expect((await s.client.request('models.install', { bundleId: MUSIC_BUNDLE })).plan).toMatchObject({ upToDate: true, downloadBytes: 0 });
    expect(await musicEngineInCapabilities(s.client)).toBe(legacy(s.toolsDir));
  });
});

describe('resolveAudioCppCli 的查找顺序', () => {
  it('环境变量（给了就只用它）→ 装好的引擎组件 → PATH', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-resolve-engine-'));
    try {
      const exe = process.platform === 'win32' ? 'audiocpp_cli.exe' : 'audiocpp_cli';
      const write = async (file: string) => {
        await fs.mkdir(path.dirname(file), { recursive: true });
        await fs.writeFile(file, '', { mode: 0o755 });
        return file;
      };
      const toolsDir = path.join(dir, 'tools');
      // 目录按 darwin-arm64 取压缩包：可执行文件是 `audiocpp_cli`。
      const catalog = new ModelCatalog({ root: path.join(dir, 'models'), toolsDir, platform: 'darwin', arch: 'arm64' });
      const installed = () => catalog.engineExecutable(MUSIC_BUNDLE);

      const onPath = await write(path.join(dir, 'path', exe));
      const env = { PATH: path.join(dir, 'path') };
      expect(resolveAudioCppCli(env, installed)).toBe(onPath);

      const component = await write(path.join(toolsDir, 'audiocpp', VERSION, 'audiocpp_cli'));
      expect(resolveAudioCppCli(env, installed)).toBe(component);

      const explicit = await write(path.join(dir, 'env', exe));
      expect(resolveAudioCppCli({ ...env, [AUDIO_CPP_CLI_ENV]: explicit }, installed)).toBe(explicit);
      // 环境变量指向不存在的文件：找不到，不换别的来源。
      expect(resolveAudioCppCli({ ...env, [AUDIO_CPP_CLI_ENV]: path.join(dir, 'gone', exe) }, installed)).toBeNull();
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});
