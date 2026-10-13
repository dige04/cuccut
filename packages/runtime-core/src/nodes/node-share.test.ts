import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { CucCutClient } from '@cuccut/client';
import { FAKE_MODEL_WORKER } from '@cuccut/jobs';
import { BUNDLES, DEFAULT_TRANSCRIBE_BUNDLE, MANIFEST_FILE } from '@cuccut/models';
import { FakeAdvertiser, nodeFetch, pairingCodeOf, readEvents, submitTestJob } from '@cuccut/nodes/testing';
import { NODE_PROTOCOL_HEADER, RpcError, type NodePairResponse } from '@cuccut/protocol';
import { resolveRuntimeHome, type RuntimeHome } from '@cuccut/runtime-storage';
import { startRuntime, type RunningRuntime, type StartRuntimeOptions } from '../runtime.ts';

/**
 * The node service in the Runtime: the gateway's `nodes.share.*`, persistence and permissions of `node-share.json`, recovery after a restart, and a port that is already in use.
 * The node listens only on 127.0.0.1, with a system-assigned port; mDNS is replaced with a fake.
 */

const appleSilicon = process.platform === 'darwin' && process.arch === 'arm64';

/** Writes a synthesized manifest and files for each repository in the default model pack. */
async function installSyntheticModels(modelsDir: string): Promise<void> {
  const bundle = BUNDLES.find((b) => b.bundleId === DEFAULT_TRANSCRIBE_BUNDLE)!;
  for (const source of Object.values(bundle.components)) {
    if (!source) continue;
    const dir = path.join(modelsDir, ...source.repo.split('/'));
    await fs.mkdir(dir, { recursive: true });
    const content = `synthetic ${source.repo}`;
    await fs.writeFile(path.join(dir, 'model.safetensors'), content);
    const sha256 = crypto.createHash('sha256').update(content).digest('hex');
    const manifest = {
      format_version: 1,
      repo: source.repo,
      revision: source.revision,
      files: [{ path: 'model.safetensors', size: content.length, sha256 }],
    };
    await fs.writeFile(path.join(dir, MANIFEST_FILE), JSON.stringify(manifest));
  }
}

describe('Runtime 的节点服务', () => {
  let dir: string;
  let home: RuntimeHome;
  let runtime: RunningRuntime | null = null;
  let client: CucCutClient | null = null;
  let advertiser: FakeAdvertiser;

  afterEach(async () => {
    client?.close();
    client = null;
    await runtime?.close();
    runtime = null;
    await fs.rm(dir, { recursive: true, force: true });
  });

  async function boot(options: Partial<StartRuntimeOptions> = {}) {
    advertiser = new FakeAdvertiser();
    runtime = await startRuntime({
      home,
      drivers: () => [],
      watchSpace: false,
      engineHost: null,
      modelWorker: null,
      ...options,
      nodes: { host: '127.0.0.1', advertiser, ...options.nodes },
    });
    const { endpoint, token } = runtime.discovery;
    client = new CucCutClient({
      resolve: async () => ({ endpoint, token }),
      client: { kind: 'desktop', name: 'test', version: '0' },
      reconnect: false,
    });
    await client.connect();
    return { runtime, client };
  }

  async function reboot(options: Partial<StartRuntimeOptions> = {}) {
    client?.close();
    client = null;
    await runtime?.close();
    runtime = null;
    return boot(options);
  }

  async function newHome() {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-node-share-'));
    home = resolveRuntimeHome({ CUCCUT_HOME: dir });
  }

  const pair = async (port: number, code: string, clientId = 'client-a') => {
    const response = await fetch(`http://127.0.0.1:${port}/v1/pair`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', [NODE_PROTOCOL_HEADER]: '1' },
      body: JSON.stringify({ code, clientId, clientName: 'Laptop' }),
    });
    expect(response.status).toBe(200);
    return (await response.json()) as NodePairResponse;
  };

  it('默认关闭；开启后监听并给出配对码；重启后照样监听、已配对的客户端还在、不重新发配对码；node-share.json 是 0600', async () => {
    await newHome();
    const { client: c1 } = await boot();
    const initial = await c1.request('nodes.share.status', {});
    expect(initial).toMatchObject({ enabled: false, listening: false, error: null, pairing: null, clients: [] });
    await expect(c1.request('nodes.share.pairingCode', {})).rejects.toMatchObject({ code: 'conflict' });
    await expect(c1.request('nodes.share.start', { port: 70_000 })).rejects.toMatchObject({ code: 'invalid-request' });

    const started = await c1.request('nodes.share.start', { port: 0, name: 'Studio' });
    expect(started).toMatchObject({ enabled: true, listening: true, error: null, name: 'Studio', allowAnySource: false });
    expect(started.port).toBeGreaterThan(0);
    expect(advertiser.active).toMatchObject({ name: 'Studio', port: started.port, nodeId: started.nodeId });
    const code = pairingCodeOf(started)!;
    const { token, nodeId } = await pair(started.port, code);
    expect(nodeId).toBe(started.nodeId);

    const refreshed = await c1.request('nodes.share.pairingCode', {});
    expect(pairingCodeOf(refreshed)).toMatch(/^\d{6}$/);
    expect(refreshed.clients).toEqual([expect.objectContaining({ clientId: 'client-a', name: 'Laptop' })]);

    expect((await fs.stat(home.nodeShareFile)).mode & 0o777).toBe(0o600);
    const persisted = await fs.readFile(home.nodeShareFile, 'utf8');
    expect(persisted).not.toContain(token.split('.')[1]);
    expect(persisted).not.toContain(code);

    const { runtime: r2, client: c2 } = await reboot();
    const restored = await c2.request('nodes.share.status', {});
    expect(restored).toMatchObject({ enabled: true, listening: true, error: null, nodeId: started.nodeId, name: 'Studio', pairing: null });
    expect(restored.clients).toEqual([expect.objectContaining({ clientId: 'client-a' })]);
    expect(r2.nodes.port).toBe(restored.port);
    expect(advertiser.active).toMatchObject({ port: restored.port });
    // The old token is still valid: authentication passes, and the job does not exist.
    const probe = await nodeFetch(`http://127.0.0.1:${restored.port}`, token, '/v1/jobs/job_missing');
    expect(probe.status).toBe(404);
    expect((await fs.stat(home.nodeShareFile)).mode & 0o777).toBe(0o600);

    // Revoke: the token is invalid, and it is gone from persistent state too.
    const revoked = await c2.request('nodes.share.revoke', { clientId: 'client-a' });
    expect(revoked.clients).toEqual([]);
    expect((await nodeFetch(`http://127.0.0.1:${restored.port}`, token, '/v1/jobs/job_missing')).status).toBe(401);
    await expect(c2.request('nodes.share.revoke', { clientId: 'client-a' })).rejects.toMatchObject({ code: 'not-found' });
    await expect(c2.request('nodes.share.revoke', { clientId: 'a.b' })).rejects.toMatchObject({ code: 'invalid-request' });

    // Close: stops listening; stays closed after a restart.
    const stopped = await c2.request('nodes.share.stop', {});
    expect(stopped).toMatchObject({ enabled: false, listening: false, pairing: null });
    await expect(fetch(`http://127.0.0.1:${restored.port}/v1/health`)).rejects.toThrow();
    const { client: c3 } = await reboot();
    expect(await c3.request('nodes.share.status', {})).toMatchObject({ enabled: false, listening: false });
  });

  it('端口被占用：Runtime 照常启动，listening 为 false 并说明原因；换端口后恢复', async () => {
    await newHome();
    const blocker = http.createServer();
    await new Promise<void>((resolve) => blocker.listen(0, '127.0.0.1', resolve));
    const taken = (blocker.address() as AddressInfo).port;
    try {
      const { client: c1 } = await boot();
      const blocked = await c1.request('nodes.share.start', { port: taken });
      expect(blocked).toMatchObject({ enabled: true, listening: false, port: taken, error: expect.stringContaining(String(taken)) });

      // Port still taken at restart: the Runtime still starts, and the status is reported accurately.
      const { client: c2 } = await reboot();
      expect(await c2.request('nodes.share.status', {})).toMatchObject({
        enabled: true,
        listening: false,
        error: expect.stringContaining(String(taken)),
      });
      expect(advertiser.started).toEqual([]);

      const moved = await c2.request('nodes.share.start', { port: 0 });
      expect(moved).toMatchObject({ enabled: true, listening: true, error: null });
      expect(moved.port).not.toBe(taken);
    } finally {
      await new Promise((resolve) => blocker.close(resolve));
    }
  });

  it('启动中途失败：已经开始监听的节点服务一并关掉', async () => {
    await newHome();
    const listenOn = (port: number) =>
      new Promise<http.Server>((resolve, reject) => {
        const server = http.createServer();
        server.once('error', reject);
        server.listen(port, '127.0.0.1', () => resolve(server));
      });
    const closeServer = (server: http.Server) => new Promise((resolve) => server.close(resolve));
    // Take a free port first, then release it, so the node can use a fixed port.
    const probe = await listenOn(0);
    const nodePort = (probe.address() as AddressInfo).port;
    await closeServer(probe);
    const { client: c1 } = await boot();
    expect(await c1.request('nodes.share.start', { port: nodePort })).toMatchObject({ listening: true, port: nodePort });
    client?.close();
    client = null;
    await runtime?.close();
    runtime = null;

    // The discovery file cannot be written (a non-empty directory with the same name): startRuntime fails after the node service has started listening, so the node's port must be released too.
    await fs.mkdir(path.join(home.discoveryFile, 'blocker'), { recursive: true });
    await expect(
      startRuntime({
        home,
        drivers: () => [],
        watchSpace: false,
        engineHost: null,
        modelWorker: null,
        nodes: { host: '127.0.0.1', advertiser: new FakeAdvertiser() },
      }),
    ).rejects.toThrow();
    await closeServer(await listenOn(nodePort));
  });

  it('网关方法的错误是 RpcError', async () => {
    await newHome();
    const { client: c1 } = await boot();
    const error = await c1.request('nodes.share.pairingCode', {}).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(RpcError);
  });

  it('nodes.share.setCapability：经网关开关一种能力，健康随即报告，持久并随重启恢复；不认识的能力 invalid-request', async () => {
    await newHome();
    const { client: c1 } = await boot();
    expect((await c1.request('nodes.share.status', {})).capabilities).toEqual({ transcribe: { enabled: true } });
    const started = await c1.request('nodes.share.start', { port: 0 });
    expect(started.capabilities).toEqual({ transcribe: { enabled: true } });

    const off = await c1.request('nodes.share.setCapability', { capability: 'transcribe', enabled: false });
    expect(off).toMatchObject({ enabled: true, listening: true, capabilities: { transcribe: { enabled: false } } });
    const health = await (await fetch(`http://127.0.0.1:${off.port}/v1/health`)).json();
    expect(health.capabilities.transcribe.enabled).toBe(false);
    expect(JSON.parse(await fs.readFile(home.nodeShareFile, 'utf8')).capabilities).toEqual({ transcribe: { enabled: false } });
    expect((await fs.stat(home.nodeShareFile)).mode & 0o777).toBe(0o600);

    for (const params of [
      { capability: 'synthesizeSpeech', enabled: false },
      { capability: 'download', enabled: true },
      { capability: '', enabled: true },
      { capability: 'transcribe' },
      { capability: 'transcribe', enabled: 'no' },
    ]) {
      await expect(c1.request('nodes.share.setCapability', params as never)).rejects.toMatchObject({ code: 'invalid-request' });
    }

    const { client: c2 } = await reboot();
    const restored = await c2.request('nodes.share.status', {});
    expect(restored).toMatchObject({ enabled: true, listening: true, capabilities: { transcribe: { enabled: false } } });
    expect((await (await fetch(`http://127.0.0.1:${restored.port}/v1/health`)).json()).capabilities.transcribe.enabled).toBe(false);
    const on = await c2.request('nodes.share.setCapability', { capability: 'transcribe', enabled: true });
    expect(on.capabilities).toEqual({ transcribe: { enabled: true } });
    expect((await (await fetch(`http://127.0.0.1:${on.port}/v1/health`)).json()).capabilities.transcribe.enabled).toBe(true);
  });

  describe.skipIf(!appleSilicon)('远端任务进 Runtime 的任务列表（默认模型包 + 假 Model Worker）', () => {
    it('jobs.list 里是节点提交、没有视频；日志里没有转写文字与令牌；停止时远端任务一并清理', async () => {
      await newHome();
      await installSyntheticModels(home.modelsDir);
      const { client: c1 } = await boot({ modelWorker: { command: process.execPath, args: [FAKE_MODEL_WORKER] }, jobIdleMs: 60_000 });
      const started = await c1.request('nodes.share.start', { port: 0 });
      const baseUrl = `http://127.0.0.1:${started.port}`;
      const { token } = await pair(started.port, pairingCodeOf(started)!);

      const media = Buffer.from('remote media bytes');
      const { job } = await submitTestJob(baseUrl, token, media, { bundleId: DEFAULT_TRANSCRIBE_BUNDLE });
      const events = await readEvents(await nodeFetch(baseUrl, token, `/v1/jobs/${job.jobId}/events`));
      expect(events.at(-1)).toMatchObject({ type: 'job', job: { state: 'completed' } });
      const result = await (await nodeFetch(baseUrl, token, `/v1/jobs/${job.jobId}/result`)).text();
      expect(result).toContain('testing one two');

      const { jobs } = await c1.request('jobs.list', {});
      expect(jobs).toEqual([
        expect.objectContaining({
          jobId: job.jobId,
          state: 'completed',
          submitter: { kind: 'node', id: 'client-a' },
          videoId: null,
          assetId: null,
          result: null,
        }),
      ]);
      expect(await c1.request('jobs.inspect', { jobId: job.jobId })).toMatchObject({ submitter: { kind: 'node', id: 'client-a' } });

      // A job waiting for an upload: when the Runtime stops, it is cleared along with its directory.
      const waiting = await nodeFetch(baseUrl, token, '/v1/jobs', {
        method: 'POST',
        body: JSON.stringify({
          clientJobId: 'cj_waiting',
          kind: 'transcribe',
          bundleId: DEFAULT_TRANSCRIBE_BUNDLE,
          input: { contentHash: 'sha256:' + 'c'.repeat(64), byteLength: 10, mediaType: 'audio/wav', track: 0, range: null },
          options: { language: { mode: 'prefer', tag: null }, diarize: false, timescale: 1_000_000 },
        }),
      });
      expect(waiting.status).toBe(201);
      client?.close();
      client = null;
      await runtime!.close();
      runtime = null;
      expect(await fs.readdir(home.nodeJobsDir).catch(() => [])).toEqual([]);

      const log = await fs.readFile(path.join(home.logsDir, 'runtime.log'), 'utf8');
      expect(log).toContain(job.jobId);
      for (const phrase of ['testing one two', 'three cuccut is']) expect(log).not.toContain(phrase);
      expect(log).not.toContain(token.split('.')[1]);
      expect(log).not.toContain(pairingCodeOf(started)!);
    });
  });
});
