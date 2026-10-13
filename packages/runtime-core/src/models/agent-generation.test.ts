import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CodexDriver } from '@cuccut/agent-drivers';
import { createFakeCodex, type FakeCodex, type FakeCodexScenario } from '@cuccut/agent-drivers/testing';
import { CucCutClient, applyJobsEvent } from '@cuccut/client';
import { corruptPngFixture, pngFixture } from '@cuccut/providers/testing';
import {
  RpcError,
  capabilityRemedyCommands,
  type CapabilityNotConfiguredDetails,
  type ImageModelInfo,
  type JobRecord,
  type JobsSnapshot,
} from '@cuccut/protocol';
import { resolveRuntimeHome, type RuntimeHome } from '@cuccut/runtime-storage';
import { resolveEngineHostCommand } from '../videos/engine-host.ts';
import { startRuntime, type RunningRuntime } from '../runtime.ts';

/**
 * End-to-end, through the gateway, for an agent as an image Provider (`agent:codex`, architecture design §6.9): the Codex Driver runs against a fake codex (`@cuccut/agent-drivers/testing`, a node script that writes a real small PNG into the session's working directory per scenario), then JobManager → ffprobe decode check → artifact. When a video is given, it is imported as a candidate asset through the real engine. The real codex on this machine is never started, there is no network access, and no account file is read.
 */

const engine = resolveEngineHostCommand();
const ffprobe = (() => {
  try {
    execFileSync(process.env.CUCCUT_FFPROBE || 'ffprobe', ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();
if (!ffprobe) console.warn('跳过智能体图片 Provider 的执行测试：没有 ffprobe');
if (!engine) console.warn('跳过智能体图片导入视频的测试：没有构建 engine-host');

const PROVIDER = 'agent:codex';
const b64 = (bytes: Buffer) => bytes.toString('base64');
/** A real 1×1 GIF: its file header is not PNG. */
const GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

async function until<T>(read: () => T | undefined | null | false | Promise<T | undefined | null | false>, timeoutMs = 15_000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await read();
    if (value) return value;
    if (Date.now() > deadline) throw new Error('等待超时');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

interface Side {
  dir: string;
  home: RuntimeHome;
  fake: FakeCodex;
  runtime: RunningRuntime;
  client: CucCutClient;
  jobs(): JobsSnapshot | null;
}

async function startSide(scenario: Partial<FakeCodexScenario> = {}, withEngine = false): Promise<Side> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-agent-provider-'));
  const home = resolveRuntimeHome({ CUCCUT_HOME: path.join(dir, 'home') });
  const fake = await createFakeCodex(path.join(dir, 'fake-codex'), scenario);
  const runtime = await startRuntime({
    home,
    drivers: (log) => [new CodexDriver(log, { locate: fake.locate })],
    watchSpace: false,
    engineHost: withEngine ? engine : null,
    videoGraceMs: 100,
    modelWorker: null,
    jobIdleMs: 60_000,
    agentProviders: { probeMaxAgeMs: 0, turnTimeoutMs: 20_000 },
  });
  const { endpoint, token } = runtime.discovery;
  const client = new CucCutClient({
    resolve: async () => ({ endpoint, token }),
    client: { kind: 'desktop', name: 'test', version: '0' },
    reconnect: false,
  });
  await client.connect();
  let jobs: JobsSnapshot | null = null;
  client.subscribeJobs({
    snapshot: (snapshot) => {
      jobs = snapshot;
    },
    event: (event) => {
      jobs = applyJobsEvent(jobs!, event);
    },
  });
  await until(() => jobs);
  return { dir, home, fake, runtime, client, jobs: () => jobs };
}

async function stopSide(side: Side | undefined): Promise<void> {
  if (!side) return;
  side.client.close();
  await side.runtime.close();
  await fs.rm(side.dir, { recursive: true, force: true });
}

function settled(side: Side, jobId: string): Promise<JobRecord> {
  return until(() => side.jobs()!.jobs.find((j) => j.jobId === jobId && ['completed', 'failed', 'cancelled'].includes(j.state)));
}

async function agentEntry(side: Side) {
  const { capabilities } = await side.client.request('models.capabilities', {});
  return capabilities.generateImage.providers.find((p) => p.providerId === PROVIDER);
}

async function rejection(promise: Promise<unknown>): Promise<RpcError> {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(RpcError);
  return error as RpcError;
}

/** The fake codex has started several app-servers (one dedicated session per generation). */
const sessions = (fake: FakeCodex) => fake.log().filter((e) => e.kind === 'start');

describe('agent image provider: listing, availability and configuration (does not need ffprobe)', () => {
  let side: Side | undefined;

  afterEach(async () => {
    await stopSide(side);
    side = undefined;
  });

  it('honest description: one image at a time, PNG only, size and seed not specifiable, subscription quota unknown; appears only in generateImage', async () => {
    side = await startSide();
    const { capabilities } = await side.client.request('models.capabilities', {});
    expect(capabilities.transcribe.providers.some((p) => p.providerId === PROVIDER)).toBe(false);
    expect(capabilities.synthesizeSpeech.providers.some((p) => p.providerId === PROVIDER)).toBe(false);
    const entry = capabilities.generateImage.providers.find((p) => p.providerId === PROVIDER)!;
    expect(entry).toMatchObject({
      kind: 'agent',
      label: 'Codex',
      available: false,
      unavailableReason: 'not-configured',
      config: { enabled: false, enabledAt: null, credential: 'none' },
    });
    const [model] = entry.models as ImageModelInfo[];
    expect(model).toMatchObject({
      modelId: 'image-gen',
      default: true,
      sizes: [],
      aspectRatios: [],
      defaultSize: null,
      maxCount: 1,
      formats: ['png'],
      defaultFormat: 'png',
      acceptsSeed: false,
      referenceImages: null,
      cost: 'subscription',
    });
    expect(model!.notes).toMatch(/一张/);
    expect(model!.notes).toMatch(/同一时间只跑一个/);
    expect(model!.notes).toMatch(/额度未知/);
    // Not the factory default.
    expect(capabilities.generateImage).toMatchObject({ default: null, effective: null });
  });

  it('reasons for unavailability and remedies: not installed, not signed in, version too old, not enabled', async () => {
    side = await startSide({ installed: false });
    const cases: Array<[Partial<FakeCodexScenario>, string, string, string]> = [
      [{ installed: false }, 'not-installed', 'not-installed', 'setup-agent'],
      [{ installed: true, loggedIn: false }, 'signed-out', 'signed-out', 'setup-agent'],
      [{ loggedIn: true, version: '0.120.0' }, 'outdated', 'outdated', 'setup-agent'],
      [{ version: '0.160.0' }, 'not-configured', 'disabled', 'enable-provider'],
    ];
    for (const [scenario, reason, selectionReason, action] of cases) {
      side.fake.scenario(scenario);
      const entry = (await agentEntry(side))!;
      expect(entry, reason).toMatchObject({ available: false, unavailableReason: reason });
      expect(entry.detail, reason).toMatch(/./);
      // The description written here carries a reference (the UI regenerates it in the current language); the description from Driver probing carries the probe's own reference.
      if (reason === 'outdated') expect(entry.detailRef, reason).toMatchObject({ key: 'providersConfig.versionTooOld' });
      if (reason === 'not-configured') expect(entry.detailRef, reason).toEqual({ key: 'providersConfig.notEnabled' });
      const error = await rejection(side.client.request('models.generateImage', { prompt: 'a cat', provider: PROVIDER }));
      expect(error, reason).toMatchObject({
        code: 'conflict',
        details: {
          code: 'CAPABILITY_NOT_CONFIGURED',
          capability: 'generateImage',
          reason: selectionReason,
          providerId: PROVIDER,
          remedy: { action, providerId: PROVIDER },
        },
      });
      const details = error.details as CapabilityNotConfiguredDetails;
      if (reason === 'signed-out') expect(details.remedy.hint).toContain('codex login');
      if (reason === 'outdated') expect(details.remedy.hint).toContain('0.158.0');
      if (reason === 'not-configured') expect(capabilityRemedyCommands(details)).toEqual([`cuccut models configure ${PROVIDER} --enable`]);
    }
    expect(await side.client.request('jobs.list', {})).toEqual({ jobs: [] });
    // Probed only; no session has been opened.
    expect(sessions(side.fake)).toHaveLength(0);
  });

  it('configuration is only a switch: keys, endpoints, models and verification are all rejected; available once enabled, unavailable again once disabled', async () => {
    side = await startSide();
    for (const extra of [{ credential: 'sk-x' }, { endpoint: 'http://127.0.0.1:1' }, { models: [{ modelId: 'm' }] }, { verify: true }]) {
      const error = await rejection(side.client.request('models.configure', { providerId: PROVIDER, enabled: true, ...extra }));
      expect(error.code).toBe('invalid-request');
    }
    expect((await rejection(side.client.request('models.configure', { providerId: PROVIDER }))).code).toBe('invalid-request');
    expect((await rejection(side.client.request('models.configure', { providerId: 'agent:other', enabled: true }))).code).toBe('not-found');

    const { provider } = await side.client.request('models.configure', { providerId: PROVIDER, enabled: true });
    expect(provider).toMatchObject({
      providerId: PROVIDER,
      kind: 'agent',
      config: { enabled: true, credential: 'none', enabledAt: expect.any(String) },
      capabilities: { generateImage: { available: true } },
    });
    expect(await agentEntry(side)).toMatchObject({ available: true });
    // The config file contains no keys or similar secrets.
    expect(JSON.parse(await fs.readFile(side.home.modelServicesFile, 'utf8')).providers[PROVIDER]).toEqual({
      enabled: true,
      enabledAt: expect.any(String),
    });

    // Enabled, but not the factory default: when no provider is specified, prompt to set a default.
    const error = await rejection(side.client.request('models.generateImage', { prompt: 'a cat' }));
    expect(error.details).toMatchObject({ reason: 'no-default', remedy: { action: 'set-default', providerId: PROVIDER } });

    await side.client.request('models.configure', { providerId: PROVIDER, enabled: false });
    expect(await agentEntry(side)).toMatchObject({ available: false, unavailableReason: 'not-configured' });
  });

  it('unsupported parameters are rejected at submission (not silently ignored): size, aspect ratio, seed, multiple images, other formats, overlong prompts', async () => {
    side = await startSide();
    await side.client.request('models.configure', { providerId: PROVIDER, enabled: true });
    for (const extra of [
      { size: '1024x1024' },
      { size: '16:9' },
      { seed: 7 },
      { count: 2 },
      { format: 'jpeg' as const },
      { prompt: 'x'.repeat(4001) },
    ]) {
      const error = await rejection(side.client.request('models.generateImage', { prompt: 'a cat', provider: PROVIDER, ...extra }));
      expect(error.code, JSON.stringify(extra).slice(0, 40)).toBe('invalid-request');
    }
    expect(await side.client.request('jobs.list', {})).toEqual({ jobs: [] });
    expect(sessions(side.fake)).toHaveLength(0);
  });
});

describe.skipIf(!ffprobe)('agent image provider: execution (fake codex + ffprobe)', () => {
  let side: Side;

  beforeEach(async () => {
    side = await startSide({ turn: { files: { 'output.png': b64(pngFixture(24, 16, 3)) }, reply: 'Saved output.png' } });
    await side.client.request('models.configure', { providerId: PROVIDER, enabled: true });
  });

  afterEach(async () => {
    await stopSide(side);
  });

  it('explicitly specified: a dedicated session (working directory is staging, no MCP servers, writes only to the working directory); the output is the PNG the session writes, with actual dimensions recorded', async () => {
    const { jobId } = await side.client.request('models.generateImage', { prompt: 'a red fox, watercolor', provider: PROVIDER });
    const job = await settled(side, jobId);
    expect(job).toMatchObject({
      kind: 'generateImage',
      state: 'completed',
      providerId: PROVIDER,
      modelId: 'image-gen',
      videoId: null,
      error: null,
      generation: { capability: 'generateImage', prompt: 'a red fox, watercolor', size: null, count: 1, format: 'png', seed: null },
    });
    const [output] = job.result!.outputs!;
    expect(output).toMatchObject({ mediaType: 'image/png', assetId: null, media: { kind: 'image', width: 24, height: 16 } });
    const handle = await side.client.request('artifacts.openHandle', { artifactId: output!.artifactId });
    const bytes = Buffer.from(await (await fetch(handle.url)).arrayBuffer());
    expect(bytes.equals(pngFixture(24, 16, 3))).toBe(true);

    // Session: the working directory is this task's staging; there are no MCP servers (no CucCut tools); it writes only to the working directory and never approves anything.
    const [start] = side.fake.requests('thread/start');
    const staging = path.join(side.home.stagingDir, 'jobs', jobId);
    expect(start!.params.cwd).toBe(staging);
    expect(start!.params).toMatchObject({ approvalPolicy: 'never', sandbox: 'workspace-write' });
    expect(start!.params.config).toEqual({
      sandbox_workspace_write: { writable_roots: [], network_access: false, exclude_tmpdir_env_var: true, exclude_slash_tmp: true },
    });
    expect(JSON.stringify(start!.params)).not.toContain('mcp_servers');
    expect(start!.params.developerInstructions).toMatch(/output\.png/);
    // No session history or video context: a new thread, one turn, and the only input is the prompt.
    expect(side.fake.requests('thread/resume')).toHaveLength(0);
    const turns = side.fake.requests('turn/start');
    expect(turns).toHaveLength(1);
    expect(JSON.stringify(turns[0]!.params.input)).toContain('a red fox, watercolor');
    // The session closes when the call ends; staging is deleted when the task ends.
    await until(() => side.fake.log().some((e) => e.kind === 'exit'));
    expect(sessions(side.fake)).toHaveLength(1);
    expect(await fs.stat(staging).catch(() => null)).toBeNull();
  });

  it('once set as default, it is used even without specifying a provider', async () => {
    await side.client.request('models.setDefault', { capability: 'generateImage', providerId: PROVIDER });
    const { capabilities } = await side.client.request('models.capabilities', {});
    expect(capabilities.generateImage).toMatchObject({
      default: { providerId: PROVIDER, modelId: 'image-gen' },
      effective: { providerId: PROVIDER, modelId: 'image-gen', source: 'user-default' },
    });
    const { jobId } = await side.client.request('models.generateImage', { prompt: 'a lighthouse' });
    expect(await settled(side, jobId)).toMatchObject({ state: 'completed', providerId: PROVIDER });
  });

  it('text-only reply with no image: task fails (PROVIDER_REJECTED, no-image); the reply is not output, and the provider is not switched', async () => {
    side.fake.scenario({ turn: { reply: 'I am unable to generate images in this environment.' } });
    const { jobId } = await side.client.request('models.generateImage', { prompt: 'a cat', provider: PROVIDER });
    const job = await settled(side, jobId);
    expect(job).toMatchObject({
      state: 'failed',
      providerId: PROVIDER,
      result: null,
      error: { code: 'PROVIDER_REJECTED', details: { reason: 'no-image', providerId: PROVIDER } },
    });
    expect(job.error!.message).toContain('unable to generate');
    expect(sessions(side.fake)).toHaveLength(1);
  });

  it('turn fails: PROVIDER_REJECTED with the reason given by the agent', async () => {
    side.fake.scenario({ turn: { status: 'failed', error: 'usage limit reached for image_gen' } });
    const { jobId } = await side.client.request('models.generateImage', { prompt: 'a cat', provider: PROVIDER });
    const job = await settled(side, jobId);
    expect(job).toMatchObject({ state: 'failed', error: { code: 'PROVIDER_REJECTED', details: { reason: 'turn-failed' } } });
    expect(job.error!.message).toContain('usage limit');
  });

  it('wrongly written files: an undecodable PNG, a GIF with a png extension, two images neither named output.png; all are MODEL_OUTPUT_INVALID', async () => {
    const cases: Array<Record<string, string>> = [
      { 'output.png': b64(corruptPngFixture()) },
      { 'output.png': b64(GIF) },
      { 'a.png': b64(pngFixture()), 'b.png': b64(pngFixture(8, 8)) },
    ];
    for (const files of cases) {
      side.fake.scenario({ turn: { files, reply: 'done' } });
      const { jobId } = await side.client.request('models.generateImage', { prompt: 'a cat', provider: PROVIDER });
      const job = await settled(side, jobId);
      expect(job, Object.keys(files).join(',')).toMatchObject({ state: 'failed', result: null, error: { code: 'MODEL_OUTPUT_INVALID' } });
    }
  });

  it('not under the agreed name but only one image: still accepted (subdirectories are also searched)', async () => {
    side.fake.scenario({ turn: { files: { 'images/fox.png': b64(pngFixture(10, 20)) }, reply: 'done' } });
    const { jobId } = await side.client.request('models.generateImage', { prompt: 'a fox', provider: PROVIDER });
    const job = await settled(side, jobId);
    expect(job.result!.outputs![0]).toMatchObject({ media: { kind: 'image', width: 10, height: 20 } });
  });

  it('session requests approval: always rejected (no one is there to approve), and the turn ends as usual', async () => {
    side.fake.scenario({ turn: { askApproval: true, files: { 'output.png': b64(pngFixture()) }, reply: 'done' } });
    const { jobId } = await side.client.request('models.generateImage', { prompt: 'a cat', provider: PROVIDER });
    expect(await settled(side, jobId)).toMatchObject({ state: 'completed' });
    const answer = side.fake.log().find((e) => e.kind === 'in' && e.msg?.id === 1000 && e.msg.method === undefined);
    expect(answer!.msg!.result).toEqual({ decision: 'decline' });
  });

  it('cancel a running task: interrupts the turn and closes the session; the task ends as cancelled', async () => {
    side.fake.scenario({ turn: { status: 'hang' } });
    const { jobId } = await side.client.request('models.generateImage', { prompt: 'a slow cat', provider: PROVIDER });
    await until(() => side.fake.requests('turn/start').length === 1);
    await until(() => side.jobs()!.jobs.find((j) => j.jobId === jobId && j.phase === 'generating'));
    await side.client.request('jobs.cancel', { jobId });
    expect(await settled(side, jobId)).toMatchObject({ state: 'cancelled', result: null });
    expect(side.fake.requests('turn/interrupt')).toHaveLength(1);
    await until(() => side.fake.log().some((e) => e.kind === 'exit'));
  });

  it('serial: two tasks queued on the same queue; the second session starts only after the first closes', async () => {
    side.fake.scenario({ turn: { delayMs: 300, files: { 'output.png': b64(pngFixture()) }, reply: 'done' } });
    const first = await side.client.request('models.generateImage', { prompt: 'one', provider: PROVIDER });
    const second = await side.client.request('models.generateImage', { prompt: 'two', provider: PROVIDER });
    const queued = await until(() => side.jobs()!.jobs.find((j) => j.jobId === second.jobId && j.state === 'queued'));
    expect(queued.state).toBe('queued');
    expect(await settled(side, first.jobId)).toMatchObject({ state: 'completed' });
    expect(await settled(side, second.jobId)).toMatchObject({ state: 'completed' });
    const log = side.fake.log();
    const starts = log.filter((e) => e.kind === 'start');
    expect(starts).toHaveLength(2);
    const firstExit = log.find((e) => e.kind === 'exit' && e.pid === starts[0]!.pid)!;
    expect(firstExit.t).toBeLessThanOrEqual(starts[1]!.t);
  });

  it('disabled while queued: no session is opened, and the task fails (MODEL_LOAD_FAILED)', async () => {
    side.fake.scenario({ turn: { delayMs: 300, files: { 'output.png': b64(pngFixture()) }, reply: 'done' } });
    const first = await side.client.request('models.generateImage', { prompt: 'one', provider: PROVIDER });
    const second = await side.client.request('models.generateImage', { prompt: 'two', provider: PROVIDER });
    await until(() => side.fake.requests('turn/start').length === 1);
    await side.client.request('models.configure', { providerId: PROVIDER, enabled: false });
    expect(await settled(side, first.jobId)).toMatchObject({ state: 'completed' });
    expect(await settled(side, second.jobId)).toMatchObject({ state: 'failed', error: { code: 'MODEL_LOAD_FAILED' } });
    expect(sessions(side.fake)).toHaveLength(1);
  });

  it('grant revoked while queued (§12.5): running ones finish as usual and are counted; queued ones fail with GRANT_REVOKED before starting, the reservation is released, and no session is opened', async () => {
    side.fake.scenario({ turn: { delayMs: 300, files: { 'output.png': b64(pngFixture()) }, reply: 'done' } });
    const first = await side.client.request('models.generateImage', { prompt: 'one', provider: PROVIDER });
    const second = await side.client.request('models.generateImage', { prompt: 'two', provider: PROVIDER });
    await until(() => side.fake.requests('turn/start').length === 1);
    const [byDefault] = (await side.client.request('grants.list', { recipient: PROVIDER })).grants;
    expect(byDefault).toMatchObject({ origin: 'provider-enable' });
    const revoked = await side.client.request('grants.revoke', { grantId: byDefault!.grantId });
    expect(revoked.runningJobs).toEqual([first.jobId]);
    expect(await settled(side, first.jobId)).toMatchObject({
      state: 'completed',
      grant: { grantId: byDefault!.grantId, settled: { calls: 1, basis: 'unknown' } },
    });
    expect(await settled(side, second.jobId)).toMatchObject({
      state: 'failed',
      error: { code: 'GRANT_REVOKED' },
      grant: { grantId: byDefault!.grantId, settled: { calls: 0, basis: 'released' } },
    });
    expect(sessions(side.fake)).toHaveLength(1);
    expect((await side.client.request('grants.usage', { grantId: byDefault!.grantId })).grant.usage).toMatchObject({
      calls: 1,
      reservedCalls: 0,
    });
  });
});

describe.skipIf(!ffprobe || !engine)('agent image import into video (real engine)', () => {
  let side: Side;

  beforeEach(async () => {
    side = await startSide({ turn: { files: { 'output.png': b64(pngFixture(32, 18)) }, reply: 'done' } }, true);
    await side.client.request('models.configure', { providerId: PROVIDER, enabled: true });
  });

  afterEach(async () => {
    await stopSide(side);
  });

  it('video given: imported as a candidate media item like other providers, with source recorded as generated and agent:codex; timeline unchanged', async () => {
    const { project } = await side.client.request('projects.create', { name: '智能体生成' });
    const opened = await side.client.request('videos.create', { projectId: project.id });
    const videoId = opened.ref.videoId;
    const before = opened.snapshot.video;
    const { jobId } = await side.client.request('models.generateImage', {
      prompt: 'a lighthouse',
      provider: PROVIDER,
      videoId,
      name: '灯塔',
    });
    const job = await settled(side, jobId);
    expect(job).toMatchObject({ state: 'completed', videoId });
    const video = side.runtime.videos.mirror(videoId)!.video;
    const asset = video.assets[job.result!.outputs![0]!.assetId!]!;
    expect(asset.name).toBe('灯塔');
    const revision = asset.revisions[asset.currentRevision]!;
    expect(revision.mediaType).toBe('image/png');
    expect(revision.provenance).toMatchObject({
      origin: 'generated',
      source: { jobId, capability: 'generateImage', providerId: PROVIDER, modelId: 'image-gen' },
    });
    expect(JSON.stringify(video.sequences)).toBe(JSON.stringify(before.sequences));
  });
});
