import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { FAKE_MODEL_WORKER, JobManager, LocalTranscribeProvider, type JobVideos } from '@cuccut/jobs';
import { LocalProviderSource, MANIFEST_FILE, ModelCatalog, ModelServiceStore, ModelServices, type BundleDefinition } from '@cuccut/models';
import {
  NODE_PROTOCOL_HEADER,
  NODE_PROTOCOL_VERSION,
  RpcError,
  type NodeJob,
  type NodeJobEvent,
  type NodeJobRequest,
  type ShareStartParams,
  type ShareStatus,
} from '@cuccut/protocol';
import { FileCredentialStore, resolveRuntimeHome, type RuntimeHome } from '@cuccut/runtime-storage';
import type { AdvertiseInfo, Advertiser } from '../advertiser.ts';
import type { NodeLimits } from '../node-jobs.ts';
import { NodeService, type NodeServiceOptions } from '../node-service.ts';
import type { Clock, PairingLimits } from '../pairing.ts';

/**
 * Test utility: starts a node in a temporary directory that listens only on the loopback address, backed by a real JobManager and a fake Model Worker.
 * Both the node-side and the initiator-side tests use it; it does not touch real mDNS, and the port is assigned by the system.
 */

const COMPONENTS: BundleDefinition['components'] = {
  asr: { family: 'qwen3-asr', repo: 'test/asr', revision: 'r-asr' },
  vad: { family: 'silero-vad', repo: 'test/vad', revision: 'r-vad' },
};

/** Fault suffixes recognized by the fake Model Worker (see `testing/fake-model-worker.ts` in `@cuccut/jobs`). */
export const TEST_NODE_FAULTS = [
  '',
  '#crash-once',
  '#crash-on-run',
  '#hang-on-cancel,slow',
  '#slow',
  '#slow-load',
  '#invalid-output',
  '#no-speech',
] as const;

/** Model package available by default. */
export const TEST_NODE_BUNDLE = 'fake@cpu';
/** Model package not installed in the repository: `models.status` is `not-installed`. */
export const TEST_NODE_MISSING_BUNDLE = 'fake@cpu#missing';

export const TEST_NODE_BUNDLES: BundleDefinition[] = [
  ...TEST_NODE_FAULTS.map((suffix): BundleDefinition => ({
    bundleId: `${TEST_NODE_BUNDLE}${suffix}`,
    capability: 'transcribe',
    backend: 'candle',
    device: 'cpu',
    label: 'Fake',
    components: COMPONENTS,
  })),
  {
    bundleId: TEST_NODE_MISSING_BUNDLE,
    capability: 'transcribe',
    backend: 'candle',
    device: 'cpu',
    label: 'Fake (missing)',
    components: { asr: { family: 'qwen3-asr', repo: 'test/missing', revision: 'r-missing' } },
  },
];

/** Writes a manifest and small files into the repository of the synthetic model package. */
export async function installTestModels(modelsDir: string): Promise<void> {
  for (const [repo, revision] of [
    ['test/asr', 'r-asr'],
    ['test/vad', 'r-vad'],
  ] as const) {
    const dir = path.join(modelsDir, ...repo.split('/'));
    await fs.mkdir(dir, { recursive: true });
    const content = `weights of ${repo}`;
    await fs.writeFile(path.join(dir, 'model.safetensors'), content);
    const sha256 = crypto.createHash('sha256').update(content).digest('hex');
    await fs.writeFile(
      path.join(dir, MANIFEST_FILE),
      JSON.stringify({ format_version: 1, repo, revision, files: [{ path: 'model.safetensors', size: content.length, sha256 }] }),
    );
  }
}

/** Records registrations and revocations, without touching real mDNS. */
export class FakeAdvertiser implements Advertiser {
  readonly started: AdvertiseInfo[] = [];
  stops = 0;
  active: AdvertiseInfo | null = null;

  start(info: AdvertiseInfo): void {
    this.started.push(info);
    this.active = info;
  }

  async stop(): Promise<void> {
    this.stops++;
    this.active = null;
  }
}

/** Manually advanced clock (for pairing code expiry and lockout). */
export class ManualClock implements Clock {
  #now: number;

  constructor(start = Date.parse('2026-01-01T00:00:00Z')) {
    this.#now = start;
  }

  now(): number {
    return this.#now;
  }

  advance(ms: number): void {
    this.#now += ms;
  }
}

/** No video is opened: the node's tasks should not touch video, and if they do, they throw. */
export const noVideos: JobVideos = {
  retain() {
    throw new Error('节点任务不应该租用视频');
  },
  release() {
    throw new Error('节点任务不应该租用视频');
  },
  async source() {
    throw new RpcError('not-found', '视频没有打开');
  },
  current() {
    return null;
  },
  videoRevision() {
    return null;
  },
  async apply() {
    throw new Error('节点任务不应该修改视频');
  },
};

/** The pairing code in `ShareStatus.pairing`; null if there is none (or it is locked). */
export function pairingCodeOf(status: ShareStatus): string | null {
  const pairing = status.pairing;
  return pairing && 'code' in pairing ? pairing.code : null;
}

export interface TestNodeOptions {
  /** Replaces the default empty video (the shared-queue tests need a local video task). */
  videos?: JobVideos;
  clock?: Clock;
  limits?: Partial<NodeLimits>;
  pairing?: Partial<PairingLimits>;
  freeBytes?: (dir: string) => Promise<number>;
  /** Capability switches set through `setCapability` after sharing is turned on (the same path as the gateway). */
  capabilities?: Record<string, boolean>;
  /** Model capabilities that support sharing (simulates capabilities added in the future). */
  shareableCapabilities?: readonly string[];
  heartbeatMs?: number;
  /** Passed to `nodes.share.start`; default `{ port: 0 }`. null means do not start sharing. */
  share?: ShareStartParams | null;
  /** Reuses an existing temporary directory (for restart tests). */
  dir?: string;
}

export interface TestNode {
  dir: string;
  home: RuntimeHome;
  service: NodeService;
  manager: JobManager;
  catalog: ModelCatalog;
  provider: LocalTranscribeProvider;
  advertiser: FakeAdvertiser;
  /** `http://127.0.0.1:<port>` (follows the port currently listening). */
  readonly baseUrl: string;
  /** Pairs using the current pairing code (issues a new one if there is none), and returns the token. */
  pair(clientId?: string, clientName?: string): Promise<string>;
  /** Stops the service and the JobManager; when `keepDir` is true, leaves the temporary directory in place. */
  close(options?: { keepDir?: boolean }): Promise<void>;
}

/** Starts a test node that listens only on 127.0.0.1, with sharing on by default (port assigned by the system). */
export async function startTestNode(options: TestNodeOptions = {}): Promise<TestNode> {
  const dir = options.dir ?? (await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-node-')));
  const home = resolveRuntimeHome({ CUCCUT_HOME: dir });
  await installTestModels(home.modelsDir);
  const catalog = new ModelCatalog({ root: home.modelsDir, bundles: TEST_NODE_BUNDLES });
  const provider = new LocalTranscribeProvider({
    catalog,
    command: () => ({ command: process.execPath, args: [FAKE_MODEL_WORKER] }),
    env: async () => process.env,
    idleMs: 60_000,
    cancelGraceMs: 5_000,
  });
  const manager = new JobManager({
    paths: {
      jobsFile: home.jobsFile,
      stagingDir: home.stagingDir,
      artifactsDir: home.artifactsDir,
      diagnosticsDir: path.join(home.logsDir, 'diagnostics'),
    },
    catalog,
    router: new ModelServices({
      store: await ModelServiceStore.open(home, new FileCredentialStore(home.modelCredentialsFile)),
      sources: [new LocalProviderSource({ catalog, transcriber: provider })],
    }),
    videos: options.videos ?? noVideos,
  });
  await manager.open();
  const advertiser = new FakeAdvertiser();
  const serviceOptions: NodeServiceOptions = {
    shareFile: home.nodeShareFile,
    jobsDir: home.nodeJobsDir,
    runner: manager,
    models: catalog,
    host: '127.0.0.1',
    advertiser,
    hostname: () => 'test-node',
    // Only used when listening on all interfaces; the test node listens only on 127.0.0.1, so status should show only that, not the address used in this document.
    addresses: () => ['192.0.2.1'],
    ...(options.clock ? { clock: options.clock } : {}),
    ...(options.limits ? { limits: options.limits } : {}),
    ...(options.pairing ? { pairing: options.pairing } : {}),
    ...(options.freeBytes ? { freeBytes: options.freeBytes } : {}),
    ...(options.shareableCapabilities ? { shareableCapabilities: options.shareableCapabilities } : {}),
    ...(options.heartbeatMs !== undefined ? { heartbeatMs: options.heartbeatMs } : {}),
  };
  const service = await NodeService.open(serviceOptions);
  if (options.share !== null) await service.start(options.share ?? { port: 0 });
  for (const [capability, enabled] of Object.entries(options.capabilities ?? {})) await service.setCapability(capability, enabled);
  const baseUrl = () => `http://127.0.0.1:${service.port}`;

  return {
    dir,
    home,
    service,
    manager,
    catalog,
    provider,
    advertiser,
    get baseUrl() {
      return baseUrl();
    },
    async pair(clientId = 'client-a', clientName = 'Test Client') {
      const code = pairingCodeOf(service.status()) ?? pairingCodeOf(service.pairingCode());
      if (!code) throw new Error('没有可用的配对码');
      const response = await fetch(`${baseUrl()}/v1/pair`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', [NODE_PROTOCOL_HEADER]: String(NODE_PROTOCOL_VERSION) },
        body: JSON.stringify({ code, clientId, clientName }),
      });
      if (!response.ok) throw new Error(`配对失败：${response.status} ${await response.text()}`);
      return ((await response.json()) as { token: string }).token;
    },
    async close({ keepDir = false } = {}) {
      await service.close();
      await manager.shutdown();
      if (!keepDir) await fs.rm(dir, { recursive: true, force: true });
    },
  };
}

/** fetch with the protocol version header and the token. */
export function nodeFetch(baseUrl: string, token: string | null, pathname: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (!headers.has(NODE_PROTOCOL_HEADER)) headers.set(NODE_PROTOCOL_HEADER, String(NODE_PROTOCOL_VERSION));
  if (token) headers.set('authorization', `Bearer ${token}`);
  return fetch(`${baseUrl}${pathname}`, { ...init, headers });
}

/** A compliant create request; the digest and length are computed from `media`. */
export function testJobRequest(media: Buffer, overrides: Partial<NodeJobRequest> = {}): NodeJobRequest {
  return {
    clientJobId: overrides.clientJobId ?? `cj_${crypto.randomUUID()}`,
    kind: 'transcribe',
    bundleId: overrides.bundleId ?? TEST_NODE_BUNDLE,
    input: overrides.input ?? {
      contentHash: `sha256:${crypto.createHash('sha256').update(media).digest('hex')}`,
      byteLength: media.length,
      mediaType: 'audio/wav',
      track: 0,
      range: null,
    },
    options: overrides.options ?? { language: { mode: 'prefer', tag: null }, diarize: false, timescale: 1_000_000 },
  };
}

/** Reads a whole NDJSON event stream (the node closes it after the terminal state), dropping heartbeats. */
export async function readEvents(response: Response): Promise<Exclude<NodeJobEvent, { type: 'heartbeat' }>[]> {
  const text = await response.text();
  return text
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => JSON.parse(line) as NodeJobEvent)
    .filter((event): event is Exclude<NodeJobEvent, { type: 'heartbeat' }> => event.type !== 'heartbeat');
}

/** Creates a job and uploads the media; returns the job and the request as they were when created. */
export async function submitTestJob(
  baseUrl: string,
  token: string,
  media: Buffer,
  overrides: Partial<NodeJobRequest> = {},
): Promise<{ job: NodeJob; request: NodeJobRequest }> {
  const request = testJobRequest(media, overrides);
  const created = await nodeFetch(baseUrl, token, '/v1/jobs', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!created.ok) throw new Error(`创建失败：${created.status} ${await created.text()}`);
  const job = (await created.json()) as NodeJob;
  const uploaded = await nodeFetch(baseUrl, token, `/v1/jobs/${job.jobId}/input`, {
    method: 'PUT',
    headers: { 'content-type': 'application/octet-stream' },
    body: new Uint8Array(media),
  });
  if (!uploaded.ok) throw new Error(`上传失败：${uploaded.status} ${await uploaded.text()}`);
  await uploaded.arrayBuffer();
  return { job, request };
}

export { startTcpProxy, type TcpProxy } from './tcp-proxy.ts';
