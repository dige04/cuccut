import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { CucCutClient } from '@cuccut/client';
import { FAKE_MODEL_WORKER, type JobFaultPoint } from '@cuccut/jobs';
import { BUNDLES, MANIFEST_FILE, defaultTranscribeBundle } from '@cuccut/models';
import { fakeOpenAiHandler, startFakeProviderServer, type FakeProviderServer } from '@cuccut/providers/testing';
import { newId, type JobRecord, type Project, type VideoRef } from '@cuccut/protocol';
import { resolveRuntimeHome, type RuntimeHome } from '@cuccut/runtime-storage';
import { startRuntime, type RunningRuntime } from '../runtime.ts';
import { resolveEngineHostCommand } from '../videos/engine-host.ts';

/**
 * End-to-end restart recovery and reconciliation (architecture design §7.2–§7.5): the real video engine, a fake Model Worker, and fake providers on the loopback address.
 * Fault injection simulates a crash at several points in the publish-and-apply loop; Runtime is shut down and restarted on the same `CUCCUT_HOME`. It asserts that the video gains only one `system:jobs` write, and that nothing is re-inferred or re-requested from the provider; then `jobs.reconcile` is run through the gateway. When stop races with submit, the engine-side stop barrier rejects that submission; when the outgoing request reaches the provider, the reservation in the authorization ledger is already recorded as started.
 */

const engine = resolveEngineHostCommand();
const tool = (name: string) => {
  try {
    execFileSync(name, ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
};
const ffmpeg = tool('ffmpeg');
const ffprobe = tool(process.env.CUCCUT_FFPROBE || 'ffprobe');
/** Default transcription model bundle on this machine: MLX on Apple Silicon, candle on other platforms (same repository). */
const DEFAULT_TRANSCRIBE_BUNDLE = defaultTranscribeBundle(process.platform, process.arch);

if (!engine) console.warn('跳过重启恢复的端到端测试：没有构建 engine-host（npm run build:engine）');

const OPENAI_KEY = 'sk-test-ONLY-FOR-TESTS-0123456789abcdef';

async function until<T>(read: () => T | undefined | null | false | Promise<T | undefined | null | false>, timeoutMs = 15_000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await read();
    if (value) return value;
    if (Date.now() > deadline) throw new Error('等待超时');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

/** Writes a synthetic manifest and files for each repository of the default model bundle (same as model-jobs.test.ts). */
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

/** The lifetime of one Runtime process: it can be shut down and started again on the same home (simulating a restart after a crash). */
class Life {
  readonly dir: string;
  readonly home: RuntimeHome;
  runtime!: RunningRuntime;
  client!: CucCutClient;
  /** Simulates a crash at this point (cleared once triggered); with `action`, it does not crash and only performs something at this point. */
  crashAt: { point: JobFaultPoint; action?: (jobId: string) => void } | null = null;
  crashed = false;
  #openai: FakeProviderServer | null;

  constructor(dir: string, openai: FakeProviderServer | null) {
    this.dir = dir;
    this.home = resolveRuntimeHome({ CUCCUT_HOME: dir });
    this.#openai = openai;
  }

  async start(): Promise<void> {
    this.runtime = await startRuntime({
      home: this.home,
      drivers: () => [],
      watchSpace: false,
      engineHost: engine,
      videoGraceMs: 100,
      modelWorker: { command: process.execPath, args: [FAKE_MODEL_WORKER] },
      jobIdleMs: 60_000,
      ...(this.#openai ? { online: { baseUrls: { openai: `${this.#openai.origin}/v1` }, http: { backoffMs: () => 10 } } } : {}),
      jobFaults: (point, context) => {
        if (this.crashAt?.point !== point) return;
        if (this.crashAt.action) return this.crashAt.action(context.jobId);
        this.crashAt = null;
        this.crashed = true;
        return 'crash';
      },
    });
    const { endpoint, token } = this.runtime.discovery;
    this.client = new CucCutClient({
      resolve: async () => ({ endpoint, token }),
      client: { kind: 'desktop', name: 'test', version: '0' },
      reconnect: false,
    });
    await this.client.connect();
  }

  /** Shuts down Runtime, restarts it on the same home, and waits for recovery to finish. */
  async restart(): Promise<void> {
    await this.stop();
    this.crashAt = null;
    await this.start();
    await this.runtime.models.jobs.recover();
  }

  async stop(): Promise<void> {
    this.client.close();
    await this.runtime.close();
  }

  inspect(jobId: string): Promise<JobRecord> {
    return this.client.request('jobs.inspect', { jobId });
  }

  settled(jobId: string): Promise<JobRecord> {
    return until(async () => {
      const job = await this.inspect(jobId);
      return ['completed', 'failed', 'cancelled', 'interrupted', 'needs-reconciliation'].includes(job.state) ? job : null;
    });
  }

  /** After restart, reopens the video by its location and reads its snapshot and `system:jobs` writes. */
  async video(project: Project, ref: VideoRef) {
    const opened = await this.client.request('videos.open', { projectId: project.id, path: ref.relPath });
    const { entries } = await this.client.request('videos.history', { videoId: ref.videoId });
    return { video: opened.snapshot.video, jobWrites: entries.filter((e) => e.actor.id === 'system:jobs') };
  }
}

describe.skipIf(!engine || !ffmpeg)('崩溃后重启：转写（真实引擎 + 假 Model Worker）', () => {
  let fixtures: string;
  let audio: string;
  let life: Life;

  beforeAll(async () => {
    fixtures = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-fixtures-'));
    audio = path.join(fixtures, 'voice.wav');
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=3', '-ar', '16000', '-ac', '1', audio]);
  });

  afterAll(async () => {
    await fs.rm(fixtures, { recursive: true, force: true });
  });

  beforeEach(async () => {
    life = new Life(await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-recovery-')), null);
    await installSyntheticModels(life.home.modelsDir);
    await life.start();
  });

  afterEach(async () => {
    await life.stop();
    await fs.rm(life.dir, { recursive: true, force: true });
  });

  it.each(['artifact-stored', 'artifact-published', 'application-recorded', 'application-committed'] as const)(
    '%s 之后崩溃：重启后复用转写结果补做应用，只写一份 speech 文档',
    async (point) => {
      const { project } = await life.client.request('projects.create', { name: '恢复测试' });
      const opened = await life.client.request('videos.create', { projectId: project.id });
      const ref = opened.ref;
      const imported = await life.client.request('edits.apply', {
        videoId: ref.videoId,
        commandId: newId('cmd'),
        expectedRevision: opened.snapshot.video.revision,
        operations: [{ type: 'importAsset', path: audio, ref: 'voice' }],
      });
      const assetId = imported.receipt.refs!.voice!;

      life.crashAt = { point };
      const { jobId } = await life.client.request('models.transcribe', { videoId: ref.videoId, assetId });
      await until(() => life.crashed);
      const before = await life.inspect(jobId);
      if (point === 'artifact-stored') {
        // The artifact is written, but the result is not yet recorded on the task: after restart, it is claimed by publish intent.
        expect(before).toMatchObject({ state: 'running', phase: 'publishing', result: null });
      } else {
        expect(before).toMatchObject({ state: 'running', phase: 'applying', result: { artifactId: expect.stringMatching(/^sha256:/) } });
      }
      const writesBefore = (await life.client.request('videos.history', { videoId: ref.videoId })).entries.filter(
        (e) => e.actor.id === 'system:jobs',
      );
      expect(writesBefore).toHaveLength(point === 'application-committed' ? 1 : 0);

      await life.restart();
      const job = await life.inspect(jobId);
      expect(job).toMatchObject({ state: 'completed', attempt: 1, error: null, result: { artifactId: expect.stringMatching(/^sha256:/) } });
      if (before.result) expect(job.result!.artifactId).toBe(before.result.artifactId);
      const [app] = job.applications!;
      expect(app).toMatchObject({ state: 'committed', videoId: ref.videoId, targetRefs: [assetId] });
      if (point === 'application-committed') expect(app!.receipt).toMatchObject({ recovered: true });
      else expect(app!.receipt).not.toHaveProperty('recovered');

      const { video, jobWrites } = await life.video(project, ref);
      expect(jobWrites).toHaveLength(1);
      expect(jobWrites[0]!.commandId).toBe(app!.commandId);
      const speech = Object.values(video.documents).filter((d) => d.kind === 'speech');
      expect(speech.map((d) => d.id)).toEqual([job.result!.documentId]);
      // No re-inference: the artifact library holds only this one original result.
      expect(await fs.readdir(life.home.artifactsDir)).toHaveLength(1);
    },
  );
});

describe.skipIf(!engine || !ffprobe)('崩溃后重启与对账：生成（真实引擎 + 假供应商）', () => {
  let openai: FakeProviderServer;
  let life: Life;
  let project: Project;
  let ref: VideoRef;

  beforeEach(async () => {
    openai = await startFakeProviderServer(fakeOpenAiHandler());
    life = new Life(await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-recovery-')), openai);
    await life.start();
    await life.client.request('models.configure', { providerId: 'openai', enabled: true, credential: OPENAI_KEY });
    ({ project } = await life.client.request('projects.create', { name: '恢复测试' }));
    ({ ref } = await life.client.request('videos.create', { projectId: project.id }));
  });

  afterEach(async () => {
    await life.stop();
    await openai.close();
    await fs.rm(life.dir, { recursive: true, force: true });
  });

  const speechRequests = () => openai.requests.filter((r) => r.method === 'POST' && r.path.endsWith('/audio/speech'));

  it('停止屏障拦下自动应用：结果留作候选，三件事实分开；经网关 jobs.reconcile apply 之后导入，不重新请求', async () => {
    life.crashAt = { point: 'application-recorded', action: (jobId) => void life.runtime.models.jobs.cancel(jobId) };
    const { jobId } = await life.client.request('models.synthesizeSpeech', { text: '旁白', provider: 'openai', videoId: ref.videoId });
    const cancelled = await life.settled(jobId);
    expect(cancelled).toMatchObject({
      state: 'cancelled',
      cancellation: { remote: 'not-applicable', cost: 'charged', localStoppedAt: expect.any(String) },
      applications: [{ state: 'cancelled', error: { code: 'APPLICATION_CANCELLED' } }],
    });
    expect(cancelled.result!.outputs![0]!.assetId).toBeNull();
    life.crashAt = null;

    const applied = await life.client.request('jobs.reconcile', { jobId, decision: 'apply' });
    expect(applied).toMatchObject({ state: 'completed', error: null });
    expect(applied.applications!.map((a) => a.state)).toEqual(['cancelled', 'committed']);
    const assetId = applied.result!.outputs![0]!.assetId!;
    const video = life.runtime.videos.mirror(ref.videoId)!.video;
    expect(Object.keys(video.assets)).toEqual([assetId]);
    expect(speechRequests()).toHaveLength(1);
    // Invalid decision: conflict; details give the current state and the allowed decisions.
    expect(await life.client.request('jobs.reconcile', { jobId, decision: 'apply' }).catch((e: unknown) => e)).toMatchObject({
      code: 'conflict',
      details: { code: 'RECONCILE_NOT_ALLOWED', state: 'completed', allowed: [] },
    });
  });

  it('停止与提交赛跑：Node 侧检查之后才停止，引擎拒绝那一笔（TASK_STOPPED），视频里什么都没写', async () => {
    life.crashAt = { point: 'application-submitting', action: (jobId) => void life.runtime.models.jobs.cancel(jobId) };
    const { jobId } = await life.client.request('models.synthesizeSpeech', { text: '旁白', provider: 'openai', videoId: ref.videoId });
    const cancelled = await life.settled(jobId);
    expect(cancelled).toMatchObject({
      state: 'cancelled',
      cancellation: { remote: 'not-applicable', cost: 'charged' },
      applications: [{ state: 'cancelled', error: { code: 'APPLICATION_CANCELLED', details: { barrier: 'engine' } } }],
    });
    life.crashAt = null;
    const { entries } = await life.client.request('videos.history', { videoId: ref.videoId });
    expect(entries.filter((e) => e.actor.id === 'system:jobs')).toEqual([]);
    expect(life.runtime.videos.mirror(ref.videoId)!.video.assets).toEqual({});
    // The engine did not open a transaction for this command: no receipt can be found by command.
    const commandId = cancelled.applications![0]!.commandId!;
    expect(await life.runtime.videos.receiptFor(ref.videoId, commandId)).toBeNull();
    expect(speechRequests()).toHaveLength(1);
    // An apply the user decided on themselves is not affected by the barrier.
    const applied = await life.client.request('jobs.reconcile', { jobId, decision: 'apply' });
    expect(applied.state).toBe('completed');
    expect(Object.keys(life.runtime.videos.mirror(ref.videoId)!.video.assets)).toHaveLength(1);
  });

  it('产物写进产物库、结果还没记下时崩溃：重启后认领产物补做应用，不重新请求，只导入一个素材', async () => {
    life.crashAt = { point: 'artifact-stored' };
    const { jobId } = await life.client.request('models.synthesizeSpeech', { text: '旁白', provider: 'openai', videoId: ref.videoId });
    await until(() => life.crashed);
    await life.restart();
    const job = await life.inspect(jobId);
    expect(job).toMatchObject({ state: 'completed', error: null, applications: [{ state: 'committed' }] });
    const { video, jobWrites } = await life.video(project, ref);
    expect(jobWrites).toHaveLength(1);
    expect(Object.keys(video.assets)).toEqual([job.result!.outputs![0]!.assetId]);
    expect(speechRequests()).toHaveLength(1);
    expect(await fs.readdir(life.home.artifactsDir)).toHaveLength(1);
    // The budget is settled once: one call, settled as completed, with no reservation left over.
    expect(job.grant?.settled).toMatchObject({ calls: 1 });
    const { grants } = await life.client.request('grants.list', { recipient: 'openai', includeEnded: true });
    expect(grants.map((g) => g.usage)).toEqual([expect.objectContaining({ calls: 1, reservedCalls: 0 })]);
  });

  it('外发请求到达供应商时，授权账本里这笔预留已经在磁盘上记为开始', async () => {
    const seen: Array<boolean | null> = [];
    const reply = fakeOpenAiHandler();
    openai.handler = async (request, server) => {
      if (request.path.endsWith('/audio/speech')) {
        const file = JSON.parse(await fs.readFile(life.home.grantsFile, 'utf8')) as { reservations: Array<{ started: boolean }> };
        seen.push(file.reservations.length === 0 ? null : file.reservations.every((r) => r.started));
      }
      return reply(request, server);
    };
    const { jobId } = await life.client.request('models.synthesizeSpeech', { text: '旁白', provider: 'openai', videoId: ref.videoId });
    expect((await life.settled(jobId)).state).toBe('completed');
    expect(seen).toEqual([true]);
  });

  it('提交后、记回执前崩溃：重启后按命令查到回执补记，视频里只有一个导入的素材', async () => {
    life.crashAt = { point: 'application-committed' };
    const { jobId } = await life.client.request('models.synthesizeSpeech', { text: '旁白', provider: 'openai', videoId: ref.videoId });
    await until(() => life.crashed);
    await life.restart();
    const job = await life.inspect(jobId);
    expect(job).toMatchObject({ state: 'completed', applications: [{ state: 'committed', receipt: { recovered: true } }] });
    const { video, jobWrites } = await life.video(project, ref);
    expect(jobWrites).toHaveLength(1);
    expect(Object.keys(video.assets)).toEqual([job.result!.outputs![0]!.assetId]);
    expect(speechRequests()).toHaveLength(1);
    // The budget (there is no authorization here, and the record has no grant) is not settled again because the apply was redone; a task that has already completed has no reconciliation decision.
    expect(await life.client.request('jobs.reconcile', { jobId, decision: 'retry' }).catch((e: unknown) => e)).toMatchObject({
      details: { code: 'RECONCILE_NOT_ALLOWED', allowed: [] },
    });
  });

  it('停止时请求还没返回：needs-reconciliation，重启后不自动重发；视频打开之后 retry 再请求一次', async () => {
    openai.handler = () => 'hang';
    const { jobId } = await life.client.request('models.synthesizeSpeech', { text: '旁白', provider: 'openai', videoId: ref.videoId });
    await openai.waitForRequests(1);
    await life.restart();
    const job = await life.inspect(jobId);
    expect(job).toMatchObject({ state: 'needs-reconciliation', error: { code: 'JOB_NEEDS_RECONCILIATION' }, result: null });
    expect(speechRequests()).toHaveLength(1);
    expect((await life.client.request('jobs.list', {})).jobs.map((j) => j.state)).toEqual(['needs-reconciliation']);

    openai.handler = fakeOpenAiHandler();
    expect(await life.client.request('jobs.reconcile', { jobId, decision: 'retry' }).catch((e: unknown) => e)).toMatchObject({
      code: 'not-found',
      details: { code: 'VIDEO_NOT_OPEN' },
    });
    await life.client.request('videos.open', { projectId: project.id, path: ref.relPath });
    const retried = await life.client.request('jobs.reconcile', { jobId, decision: 'retry' });
    // Back to queued, attempt incremented by one (it may already be running by the time it returns).
    expect(retried).toMatchObject({ attempt: 2, error: null, result: null });
    expect(['queued', 'running']).toContain(retried.state);
    const done = await life.settled(jobId);
    expect(done).toMatchObject({ state: 'completed', attempt: 2 });
    expect(speechRequests()).toHaveLength(2);
    expect(Object.keys(life.runtime.videos.mirror(ref.videoId)!.video.assets)).toEqual([done.result!.outputs![0]!.assetId]);
  });

  it('discard：放弃结果不明的调用，重启后仍是 cancelled', async () => {
    openai.handler = () => 'hang';
    const { jobId } = await life.client.request('models.synthesizeSpeech', { text: '旁白', provider: 'openai' });
    await openai.waitForRequests(1);
    await life.restart();
    const discarded = await life.client.request('jobs.reconcile', { jobId, decision: 'discard' });
    expect(discarded).toMatchObject({ state: 'cancelled', cancellation: { remote: 'unknown', cost: 'possible' } });
    await life.restart();
    expect(await life.inspect(jobId)).toMatchObject({ state: 'cancelled', cancellation: { remote: 'unknown', cost: 'possible' } });
    expect(speechRequests()).toHaveLength(1);
  });
});
