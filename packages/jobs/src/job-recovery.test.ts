import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  RpcError,
  type EditOperation,
  type JobGrantSettlementBasis,
  type JobGrantUse,
  type JobRecord,
  type JobState,
  type JobSubmitter,
  type SpeechModelInfo,
} from '@cuccut/protocol';
import {
  ModelCatalog,
  type GenerationAttempt,
  type GenerationCapability,
  type GenerationProvider,
  type GenerationRun,
  type GenerationSelection,
  type GenerationSink,
} from '@cuccut/models';
import { JobManager, type JobVideos, type TranscribeRouter } from './job-manager.ts';
import type { JobAdmission } from './job-admission.ts';
import type { AppliedReceipt, ApplicationRun, JobFaultPoint } from './job-application.ts';
import { ApplicationLedger } from './application-ledger.ts';
import { JobLedger, type StoredJob } from './job-ledger.ts';
import { cancellationFacts, recoveryAction, type RemoteTaskQuery, type RemoteTaskStatus } from './job-recovery.ts';
import { reconcileChoices } from './job-reconcile.ts';

/**
 * Restart recovery and reconciliation (architecture design §7.2–§7.5): fault injection simulates crashes at several points (the output has been written to the asset library but the result is not yet recorded; after the output is published but before it is applied; after the ledger records the command but before commit; after commit but before the receipt is recorded). The old JobManager is dropped and a new one is created on the same directory (as a process restart would). The tests assert that nothing is written twice, nothing is regenerated, budget is settled only once, and the state is correct; then every decision of `jobs.reconcile` is run through. The video engine is fake (it records receipts for committed commands); end-to-end tests with the real engine are in runtime-core.
 */

const MODEL: SpeechModelInfo = {
  modelId: 'tts',
  label: 'tts',
  default: true,
  voices: [{ voiceId: 'alloy', label: 'Alloy' }],
  defaultVoice: 'alloy',
  voiceModes: ['preset'],
  languages: 'any',
  maxInputChars: 100,
  formats: ['mp3'],
  defaultFormat: 'mp3',
  acceptsInstructions: false,
  speedRange: null,
  acceptsSeed: false,
  cost: 'unknown',
};

const CONNECTION: JobSubmitter = { kind: 'connection', id: 'conn_1' };
const AGENT: JobSubmitter = { kind: 'agent', id: 'run_1', taskId: 'task_1' };

/** Fake online (outbound) generator: by default writes an "mp3"; calls after `hold()` never return (simulating a call still running at the moment of a crash). */
class FakeGenerator implements GenerationProvider {
  readonly id = 'fake';
  readonly runs: GenerationRun[] = [];
  #hold = false;

  hold(): void {
    this.#hold = true;
  }

  release(): void {
    this.#hold = false;
  }

  async generate(run: GenerationRun, sink: GenerationSink): Promise<GenerationAttempt> {
    this.runs.push(run);
    if (this.#hold) return new Promise(() => {});
    sink.generating();
    const bytes = Buffer.concat([Buffer.from('ID3'), Buffer.from(run.jobId)]);
    await fs.writeFile(path.join(run.staging, 'output-1.mp3'), bytes);
    const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
    return {
      outcome: 'completed',
      workerVersion: 'fake@1',
      outputs: [{ path: 'output-1.mp3', sha256, byteLength: bytes.length, mediaType: 'audio/mpeg' }],
    };
  }

  async close(): Promise<void> {}
}

const PLACE = { root: '/fake/videos/mov_1', file: '.', scope: 'project' };

/** Fake video and engine: the engine records receipts by `commandId` (kept across "restarts"); after a Runtime restart the video is not open and is reopened by position. */
class FakeVideos implements JobVideos {
  open = true;
  /** Directory is gone: `missing` on reopen. */
  gone = false;
  revision = 1;
  leases = 0;
  /** The commit that actually landed (a transaction in the engine). */
  committed: Array<{ commandId: string; operations: EditOperation[] }> = [];
  receipts = new Map<string, AppliedReceipt>();
  receiptQueries: string[] = [];
  receiptFails = false;
  reopened = 0;
  /** Engine-side stop barrier: runId → the generation up to which it was invalidated. */
  invalidated = new Map<string, number>();
  /** Commits that arrive carrying a run (to check whether the commit carries the execution). */
  runs: Array<ApplicationRun | undefined> = [];

  retain(): void {
    this.leases++;
  }

  release(): void {
    this.leases--;
  }

  async source(): Promise<never> {
    throw new RpcError('not-found', '没有素材');
  }

  current() {
    return null;
  }

  videoRevision(videoId: string) {
    return videoId === 'mov_1' && this.open ? String(this.revision) : null;
  }

  place(videoId: string) {
    return this.videoRevision(videoId) === null ? null : PLACE;
  }

  async reopen(videoId: string, place: Record<string, unknown>): Promise<'opened' | 'missing' | 'mismatch'> {
    expect(place).toEqual(PLACE);
    if (videoId !== 'mov_1') return 'mismatch';
    if (this.gone) return 'missing';
    this.reopened++;
    this.open = true;
    this.leases++;
    return 'opened';
  }

  async invalidateRun(_videoId: string, run: ApplicationRun): Promise<boolean> {
    this.invalidated.set(run.runId, Math.max(this.invalidated.get(run.runId) ?? 0, Number(run.runGeneration)));
    return true;
  }

  async apply(
    _videoId: string,
    request: { commandId: string; expectedRevision: string; operations: EditOperation[]; run?: ApplicationRun },
  ) {
    this.runs.push(request.run);
    // Idempotent: the same command arriving again only returns the original receipt.
    const existing = this.receipts.get(request.commandId);
    if (existing) return existing;
    const stopped = request.run && this.invalidated.get(request.run.runId);
    if (stopped !== undefined && stopped >= Number(request.run!.runGeneration)) {
      throw new RpcError('forbidden', '这次执行已被停止，修改没有提交', { code: 'TASK_STOPPED' });
    }
    if (request.expectedRevision !== String(this.revision)) throw new RpcError('conflict', '版本冲突');
    this.revision++;
    this.committed.push({ commandId: request.commandId, operations: request.operations });
    const n = this.committed.length;
    const receipt: AppliedReceipt = {
      transactionId: `txn_${n}`,
      videoRevision: String(this.revision),
      refs: Object.fromEntries(request.operations.map((op, i) => [(op as { ref: string }).ref, `ast_${n}_${i + 1}`])),
    };
    this.receipts.set(request.commandId, receipt);
    return receipt;
  }

  async receipt(_videoId: string, commandId: string): Promise<AppliedReceipt | null> {
    this.receiptQueries.push(commandId);
    if (this.receiptFails) throw new RpcError('engine-unavailable', '引擎不可用');
    return this.receipts.get(commandId) ?? null;
  }
}

/** Fake authorization service: reservations whose execution has started are settled under the conservative rule (consistent with grant-store); each reservation can be settled only once. */
class FakeAdmission implements JobAdmission {
  admitted = 0;
  started = new Set<string>();
  settles: Array<{ reservationId: string; basis: JobGrantSettlementBasis }> = [];

  admit(): JobGrantUse {
    this.admitted++;
    return {
      grantId: 'grt_1',
      generation: 1,
      reservationId: `rsv_${this.admitted}`,
      budgetMode: 'per-call-unknown-cost',
      dataKinds: ['transcript'],
      reserved: { calls: 1, amount: null },
      settled: null,
    };
  }

  /** When set, the process is gone right after “started” is persisted (start never completes). */
  crashAfterStart = false;

  async start(use: JobGrantUse) {
    this.started.add(use.reservationId);
    if (this.crashAfterStart) return new Promise<null>(() => {});
    return null;
  }

  begun(use: JobGrantUse): boolean {
    return this.started.has(use.reservationId);
  }

  retry(use: JobGrantUse): JobGrantUse {
    return use;
  }

  settle(use: JobGrantUse, outcome: { state: JobState }): JobGrantUse {
    if (this.settles.some((s) => s.reservationId === use.reservationId)) throw new Error(`重复结算 ${use.reservationId}`);
    const basis: JobGrantSettlementBasis =
      outcome.state === 'completed' ? 'unknown' : this.started.has(use.reservationId) ? 'conservative' : 'released';
    this.settles.push({ reservationId: use.reservationId, basis });
    return { ...use, settled: { calls: basis === 'released' ? 0 : 1, amount: null, basis, at: new Date().toISOString() } };
  }
}

async function until<T>(read: () => T | undefined | null | false | Promise<T | undefined | null | false>, timeoutMs = 5000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await read();
    if (value) return value;
    if (Date.now() > deadline) throw new Error('等待超时');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

describe('重启恢复与对账（JobManager）', () => {
  let dir: string;
  let paths: { jobsFile: string; stagingDir: string; artifactsDir: string; diagnosticsDir: string };
  let generator: FakeGenerator;
  let videos: FakeVideos;
  let admission: FakeAdmission;
  let manager: JobManager;
  let crashAt: { point: JobFaultPoint; action?: (jobId: string) => void } | null;
  let remoteTasks: RemoteTaskQuery | undefined;

  function create(): JobManager {
    const router: TranscribeRouter = {
      selectTranscribe: async () => {
        throw new Error('不用');
      },
      transcriber: () => null,
      executors: () => [],
      selectGeneration: async <C extends GenerationCapability>(capability: C) =>
        ({
          capability,
          providerId: 'fake',
          modelId: 'tts',
          kind: 'online',
          label: 'Fake',
          source: 'user-default',
          model: MODEL,
          generator,
          queue: { key: 'fake', concurrency: 1 },
        }) as unknown as GenerationSelection<C>,
      generators: () => [generator],
    };
    return new JobManager({
      paths,
      catalog: new ModelCatalog({ root: path.join(dir, 'models'), bundles: [] }),
      router,
      videos,
      admission,
      ...(remoteTasks ? { remoteTasks } : {}),
      probe: async () => ({ ok: true, media: { kind: 'audio', durationSec: 1, sampleRate: 24_000, channels: 1 } }),
      faults: (point, context) => {
        if (crashAt?.point !== point) return;
        if (crashAt.action) return crashAt.action(context.jobId);
        crashAt = null;
        return 'crash';
      },
    });
  }

  /** Drops the old JobManager (not a clean stop) and creates a new one on the same directory; after a Runtime restart the video is not open. */
  async function restart(): Promise<JobManager> {
    videos.open = false;
    videos.leases = 0;
    crashAt = null;
    manager = create();
    await manager.open();
    await manager.recover();
    return manager;
  }

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-job-recovery-'));
    paths = {
      jobsFile: path.join(dir, 'store', 'jobs.jsonl'),
      stagingDir: path.join(dir, 'staging'),
      artifactsDir: path.join(dir, 'artifacts'),
      diagnosticsDir: path.join(dir, 'logs', 'diagnostics'),
    };
    generator = new FakeGenerator();
    videos = new FakeVideos();
    admission = new FakeAdmission();
    crashAt = null;
    remoteTasks = undefined;
    manager = create();
    await manager.open();
  });

  afterEach(async () => {
    await manager.shutdown();
    await fs.rm(dir, { recursive: true, force: true });
  });

  async function speak(submitter: JobSubmitter = CONNECTION): Promise<JobRecord> {
    const { jobId } = await manager.submitSynthesizeSpeech({ text: '你好', videoId: 'mov_1', name: '旁白' }, submitter);
    await manager.settled(jobId);
    return manager.inspect(jobId);
  }

  async function stored(jobId: string): Promise<JobRecord | undefined> {
    const jobs = await new JobLedger(paths.jobsFile).load();
    return jobs.find((job) => job.record.jobId === jobId)?.record;
  }

  /** This job's apply in the apply ledger (authoritative): after a crash the in-memory projection no longer updates, so read from disk. */
  async function ledgerApps(jobId: string): Promise<NonNullable<JobRecord['applications']>> {
    const ledger = new ApplicationLedger(path.join(dir, 'store', 'applications.jsonl'));
    await ledger.load();
    return ledger.forJob(jobId).map((item) => item.record);
  }

  /** Settled at publish time on completion; after that, no further settlement regardless of how the apply goes. */
  function expectSettledOnce(job: JobRecord): void {
    expect(job.grant?.settled).toMatchObject({ basis: 'unknown', calls: 1 });
    expect(admission.settles).toEqual([{ reservationId: job.grant!.reservationId, basis: 'unknown' }]);
  }

  it('产物发布后、应用前崩溃：重启后复用产物补做应用，不重新生成、只写一次', async () => {
    crashAt = { point: 'artifact-published' };
    const before = await speak();
    expect(before).toMatchObject({ state: 'running', phase: 'applying', result: { artifactId: expect.any(String) } });
    expect(before.applications).toEqual([expect.objectContaining({ state: 'pending', commandId: null, targetRefs: ['output1'] })]);
    expect(videos.committed).toHaveLength(0);

    await restart();
    const job = manager.inspect(before.jobId);
    expect(job.state).toBe('completed');
    expect(generator.runs).toHaveLength(1);
    expect(videos.reopened).toBe(1);
    expect(videos.committed).toHaveLength(1);
    const [app] = job.applications!;
    expect(app).toMatchObject({ state: 'committed', commandId: `cmd_${app!.applicationId}_1`, receipt: { transactionId: 'txn_1' } });
    expect(app!.receipt).not.toHaveProperty('recovered');
    expect(job.result).toMatchObject({ outputs: [{ assetId: 'ast_1_1' }] });
    expect(job.result!.artifactId).toBe(before.result!.artifactId);
    expectSettledOnce(job);
    // The video's lease is returned at the end.
    expect(videos.leases).toBe(0);
    expect(await stored(before.jobId)).toMatchObject({ state: 'completed' });
  });

  it('账本记下命令后、提交前崩溃：按旧命令查回执（没有），换新命令提交一次', async () => {
    crashAt = { point: 'application-recorded' };
    const before = await speak();
    const [pending] = await ledgerApps(before.jobId);
    expect(pending).toMatchObject({ state: 'validating', commandId: `cmd_${pending!.applicationId}_1`, baseVideoRevision: '1' });
    expect(videos.committed).toHaveLength(0);

    await restart();
    const job = manager.inspect(before.jobId);
    expect(job.state).toBe('completed');
    expect(videos.receiptQueries).toEqual([`cmd_${pending!.applicationId}_1`]);
    expect(videos.committed.map((c) => c.commandId)).toEqual([`cmd_${pending!.applicationId}_2`]);
    expect(job.applications).toEqual([expect.objectContaining({ applicationId: pending!.applicationId, state: 'committed' })]);
    expect(generator.runs).toHaveLength(1);
    expectSettledOnce(job);
  });

  it('提交后、记回执前崩溃：重启后按同一个命令查到回执，补记，不再写', async () => {
    crashAt = { point: 'application-committed' };
    const before = await speak();
    expect((await ledgerApps(before.jobId)).map((a) => a.state)).toEqual(['validating']);
    expect(videos.committed).toHaveLength(1);

    await restart();
    const job = manager.inspect(before.jobId);
    expect(job.state).toBe('completed');
    expect(videos.committed).toHaveLength(1);
    const [app] = job.applications!;
    expect(app).toMatchObject({ state: 'committed', receipt: { transactionId: 'txn_1', recovered: true, refs: { output1: 'ast_1_1' } } });
    expect(job.result).toMatchObject({ outputs: [{ assetId: 'ast_1_1' }] });
    expect(generator.runs).toHaveLength(1);
    expectSettledOnce(job);
  });

  it('重启后查不了回执：不换命令重写，应用记为 rejected（RECEIPT_UNKNOWN）；查得到之前 apply 也拒绝', async () => {
    crashAt = { point: 'application-committed' };
    const before = await speak();
    videos.receiptFails = true;
    await restart();
    const job = manager.inspect(before.jobId);
    expect(job).toMatchObject({ state: 'failed', error: { code: 'APPLY_FAILED', details: { reason: 'RECEIPT_UNKNOWN' } } });
    expect(job.result).not.toBeNull();
    expect(videos.committed).toHaveLength(1);
    expect(videos.leases).toBe(0);
    // The video was reopened and is still open at reconciliation.
    expect(await manager.reconcile(before.jobId, 'apply').catch((e: unknown) => e)).toMatchObject({
      code: 'busy',
      details: { code: 'RECEIPT_UNKNOWN' },
    });
    expect(videos.committed).toHaveLength(1);
    // Engine recovery: found that the last commit had in fact landed; backfill the receipt, and there is still only one.
    videos.receiptFails = false;
    const applied = await manager.reconcile(before.jobId, 'apply');
    expect(applied.state).toBe('completed');
    expect(applied.applications!.at(-1)).toMatchObject({ state: 'committed', receipt: { recovered: true } });
    expect(videos.committed).toHaveLength(1);
    expect(videos.leases).toBe(0);
  });

  it('目标没了：应用 stale-input，产物留作候选，不猜相邻对象；视频打开之前 apply 拒绝', async () => {
    crashAt = { point: 'artifact-published' };
    const before = await speak();
    videos.gone = true;
    await restart();
    const job = manager.inspect(before.jobId);
    expect(job).toMatchObject({
      state: 'failed',
      error: {
        code: 'STALE_JOB_INPUT',
        details: { artifactIds: [before.result!.artifactId], applicationId: before.applications![0]!.applicationId },
      },
    });
    expect(job.error!.message).toContain('生成的结果已保留');
    expect(job.applications![0]).toMatchObject({ state: 'stale-input', error: { code: 'STALE_JOB_INPUT' } });
    expect(job.result).toMatchObject({ outputs: [{ assetId: null }] });
    expect(videos.committed).toHaveLength(0);
    expect(videos.leases).toBe(0);
    expect(await manager.reconcile(before.jobId, 'apply').catch((e: unknown) => e)).toMatchObject({
      code: 'not-found',
      details: { code: 'VIDEO_NOT_OPEN' },
    });
    // After the user reopens the video, apply is allowed: create a new apply.
    videos.open = true;
    const applied = await manager.reconcile(before.jobId, 'apply');
    expect(applied).toMatchObject({ state: 'completed', error: null });
    expect(applied.applications!.map((a) => a.state)).toEqual(['stale-input', 'committed']);
    expect(videos.committed).toHaveLength(1);
    expect(generator.runs).toHaveLength(1);
    expectSettledOnce(applied);
  });

  it('停止屏障：账本写下命令之后被取消，不再提交；结果留作候选，三件事实分开记；apply 之后应用', async () => {
    crashAt = { point: 'application-recorded', action: (jobId) => void manager.cancel(jobId) };
    const job = await speak();
    expect(job).toMatchObject({
      state: 'cancelled',
      cancellation: { remote: 'not-applicable', cost: 'charged', localStoppedAt: expect.any(String) },
    });
    expect(job.result).not.toBeNull();
    expect(job.applications![0]).toMatchObject({ state: 'cancelled', error: { code: 'APPLICATION_CANCELLED' } });
    expect(videos.committed).toHaveLength(0);
    expect(videos.leases).toBe(0);

    crashAt = null;
    const applied = await manager.reconcile(job.jobId, 'apply');
    expect(applied.state).toBe('completed');
    expect(applied).not.toHaveProperty('cancellation');
    // First look up the receipt by the blocked command (nothing was committed), then create a new apply.
    expect(videos.receiptQueries).toEqual([job.applications![0]!.commandId]);
    expect(applied.applications!.map((a) => a.state)).toEqual(['cancelled', 'committed']);
    expect(videos.committed).toHaveLength(1);
    expectSettledOnce(applied);
    // Already applied: cannot apply again.
    expect(await manager.reconcile(job.jobId, 'apply').catch((e: unknown) => e)).toMatchObject({
      code: 'conflict',
      details: { code: 'RECONCILE_NOT_ALLOWED', state: 'completed', allowed: [] },
    });
  });

  it('引擎侧的停止屏障：Node 侧检查之后才取消，交给引擎的那一笔被拒（TASK_STOPPED），应用记 cancelled，不查回执', async () => {
    crashAt = { point: 'application-submitting', action: (jobId) => void manager.cancel(jobId) };
    const job = await speak();
    expect(job).toMatchObject({ state: 'cancelled', cancellation: { remote: 'not-applicable', cost: 'charged' } });
    expect(job.applications![0]).toMatchObject({
      state: 'cancelled',
      error: { code: 'APPLICATION_CANCELLED', details: { barrier: 'engine' } },
    });
    // The commit carries this execution; the engine rejects it, with no transaction and no receipt lookup for it.
    expect(videos.runs).toEqual([{ runId: job.jobId, runGeneration: '1' }]);
    expect(videos.invalidated.get(job.jobId)).toBe(1);
    expect(videos.committed).toHaveLength(0);
    expect(videos.receiptQueries).toEqual([]);
    expectSettledOnce(job);
    // An apply the user decides on by themselves carries no execution and is not affected by the barrier.
    crashAt = null;
    const applied = await manager.reconcile(job.jobId, 'apply');
    expect(applied.state).toBe('completed');
    expect(videos.runs.at(-1)).toBeUndefined();
    expect(videos.committed).toHaveLength(1);
  });

  it('产物写进产物库、结果还没记下时崩溃：重启后按发布意图认领产物补做应用，不重新生成、预算只结算一次', async () => {
    crashAt = { point: 'artifact-stored' };
    const before = await speak();
    expect(before).toMatchObject({ state: 'running', phase: 'publishing', result: null });
    expect(before).not.toHaveProperty('applications');
    const ledger = { jobs: await new JobLedger(paths.jobsFile).load() };
    const intent = ledger.jobs.find((j) => j.record.jobId === before.jobId)!.publishing!;
    expect(intent).toMatchObject({ artifactIds: [expect.stringMatching(/^sha256:/)], targetRefs: ['output1'] });

    await restart();
    const job = manager.inspect(before.jobId);
    expect(job.state).toBe('completed');
    expect(generator.runs).toHaveLength(1);
    expect(videos.committed).toHaveLength(1);
    expect(job.result!.artifactId).toBe(intent.artifactIds[0]);
    expect(job.result).toMatchObject({ outputs: [{ assetId: 'ast_1_1' }] });
    expect(job.applications).toEqual([expect.objectContaining({ state: 'committed', artifactIds: intent.artifactIds })]);
    expectSettledOnce(job);
    expect(videos.leases).toBe(0);
    // The intent is cleared after the result and the apply are recorded.
    const after = { jobs: await new JobLedger(paths.jobsFile).load() };
    expect(after.jobs.find((j) => j.record.jobId === before.jobId)).not.toHaveProperty('publishing');
  });

  it('发布意图记下了、产物却不全：丢掉意图，按原来的矩阵处理（外发调用等对账，不重发）', async () => {
    crashAt = { point: 'artifact-stored' };
    const before = await speak();
    await fs.rm(paths.artifactsDir, { recursive: true, force: true });
    await restart();
    expect(manager.inspect(before.jobId)).toMatchObject({
      state: 'needs-reconciliation',
      result: null,
      grant: { settled: { basis: 'conservative' } },
    });
    expect(generator.runs).toHaveLength(1);
    expect(videos.committed).toHaveLength(0);
  });

  it('「已开始」落盘之后、记下 running 之前崩溃：重启时不当成没开始重新排队，等对账，预算保守扣一次', async () => {
    admission.crashAfterStart = true;
    const { jobId } = await manager.submitSynthesizeSpeech({ text: '一', videoId: 'mov_1' }, CONNECTION);
    await until(async () => admission.started.has('rsv_1') && (await stored(jobId))?.state === 'queued');
    // Process gone: the old JobManager is dropped (it stopped after “started”); the ledger still shows queued.
    admission.crashAfterStart = false;

    await restart();
    expect(manager.inspect(jobId)).toMatchObject({
      state: 'needs-reconciliation',
      grant: { reservationId: 'rsv_1', settled: { basis: 'conservative', calls: 1 } },
    });
    expect(admission.admitted).toBe(1);
    expect(admission.settles).toEqual([{ reservationId: 'rsv_1', basis: 'conservative' }]);
  });

  it.each(['artifact-stored', 'artifact-published'] as const)(
    '智能体提交的任务在 %s 之后崩溃：重启后先查回执，没有提交过就不自动应用（它的 Run 已经结束），留给用户 apply',
    async (point) => {
      crashAt = { point };
      const before = await speak(AGENT);
      await restart();
      const job = manager.inspect(before.jobId);
      expect(job).toMatchObject({ state: 'cancelled', cancellation: { remote: 'not-applicable', cost: 'charged' } });
      expect(job.applications![0]!.state).toBe('cancelled');
      expect(videos.committed).toHaveLength(0);
      expect((await manager.reconcile(before.jobId, 'apply')).state).toBe('completed');
      expect(videos.committed).toHaveLength(1);
      expect(generator.runs).toHaveLength(1);
    },
  );

  it('智能体提交的任务提交后崩溃：查到回执照样补记（已经写了的就是写了）', async () => {
    crashAt = { point: 'application-committed' };
    const before = await speak(AGENT);
    await restart();
    expect(manager.inspect(before.jobId)).toMatchObject({ state: 'completed', applications: [{ receipt: { recovered: true } }] });
    expect(videos.committed).toHaveLength(1);
  });

  it('崩溃时在跑的外发调用 needs-reconciliation（预算保守扣），排队的重新校验后排队；retry', async () => {
    generator.hold();
    const running = await manager.submitSynthesizeSpeech({ text: '一', videoId: 'mov_1' }, CONNECTION);
    const queued = await manager.submitSynthesizeSpeech({ text: '二', videoId: 'mov_1' }, CONNECTION);
    const agent = await manager.submitSynthesizeSpeech({ text: '三', videoId: 'mov_1' }, AGENT);
    await until(async () => (await stored(running.jobId))?.state === 'running' && (await stored(agent.jobId))?.state === 'queued');
    // Process gone: the old JobManager is dropped (its generation never returns).
    generator.release();
    // Only the first one started; the queued one only reserved.
    expect([...admission.started]).toEqual(['rsv_1']);

    await restart();
    expect(manager.inspect(running.jobId)).toMatchObject({
      state: 'needs-reconciliation',
      error: { code: 'JOB_NEEDS_RECONCILIATION' },
      grant: { reservationId: 'rsv_1', settled: { basis: 'conservative', calls: 1 } },
    });
    // Queued agent-submitted job: interrupted; an old Run that has already stopped is not executed.
    expect(manager.inspect(agent.jobId)).toMatchObject({ state: 'interrupted', error: { code: 'JOB_INTERRUPTED' } });
    // The queued job is admitted again (the old reservation released), same attempt; it runs and is applied.
    expect(await manager.settled(queued.jobId)).toBe('completed');
    const requeued = manager.inspect(queued.jobId);
    expect(requeued).toMatchObject({ attempt: 1, grant: { reservationId: 'rsv_4', settled: { basis: 'unknown' } } });
    expect(admission.settles).toEqual([
      { reservationId: 'rsv_1', basis: 'conservative' },
      { reservationId: 'rsv_2', basis: 'released' },
      { reservationId: 'rsv_3', basis: 'released' },
      { reservationId: 'rsv_4', basis: 'unknown' },
    ]);
    // Only the re-queued one ran generation; needs-reconciliation is never automatically re-sent.
    expect(generator.runs.map((r) => r.jobId)).toEqual([running.jobId, queued.jobId]);
    expect(videos.committed).toHaveLength(1);

    // Invalid decision: a call with an unknown result has no output, so it cannot be applied.
    expect(await manager.reconcile(running.jobId, 'apply').catch((e: unknown) => e)).toMatchObject({
      code: 'conflict',
      details: { code: 'RECONCILE_NOT_ALLOWED', state: 'needs-reconciliation', decision: 'apply', allowed: ['retry', 'discard'] },
    });
    // retry: the same job returns to the queue, attempt increments by one, with a new reservation; the conservative settlement from before stays in history.
    const retried = await manager.reconcile(running.jobId, 'retry');
    expect(retried).toMatchObject({ state: 'queued', attempt: 2, error: null, result: null, grant: { reservationId: 'rsv_5' } });
    expect(retried.grant!.retries).toEqual([expect.objectContaining({ basis: 'conservative' })]);
    expect(await manager.settled(running.jobId)).toBe('completed');
    expect(generator.runs).toHaveLength(3);
    // Agent job in interrupted: the user can retry it, but cannot discard it.
    expect(await manager.reconcile(agent.jobId, 'discard').catch((e: unknown) => e)).toMatchObject({
      details: { code: 'RECONCILE_NOT_ALLOWED', allowed: ['retry'] },
    });
    expect(await manager.reconcile(agent.jobId, 'retry')).toMatchObject({ state: 'queued', attempt: 2 });
    expect(await manager.settled(agent.jobId)).toBe('completed');
    expect(videos.committed).toHaveLength(3);
    expect(videos.leases).toBe(0);
  });

  it('discard：放弃结果不明的调用，记下三件事实，保守扣下的预算不退；视频没打开时 retry 拒绝', async () => {
    generator.hold();
    const { jobId } = await manager.submitSynthesizeSpeech({ text: '一', videoId: 'mov_1' }, CONNECTION);
    await until(async () => (await stored(jobId))?.state === 'running');
    generator.release();
    await restart();
    expect(await manager.reconcile(jobId, 'retry').catch((e: unknown) => e)).toMatchObject({
      code: 'not-found',
      details: { code: 'VIDEO_NOT_OPEN' },
    });
    const discarded = await manager.reconcile(jobId, 'discard');
    expect(discarded).toMatchObject({
      state: 'cancelled',
      error: null,
      cancellation: { remote: 'unknown', cost: 'possible' },
      grant: { settled: { basis: 'conservative' } },
    });
    expect(await manager.reconcile(jobId, 'discard').catch((e: unknown) => e)).toMatchObject({
      code: 'conflict',
      details: { code: 'RECONCILE_NOT_ALLOWED', allowed: [] },
    });
    expect(await manager.reconcile('job_none', 'discard').catch((e: unknown) => e)).toMatchObject({ code: 'not-found' });
    expect(generator.runs).toHaveLength(1);
    // Still the same result after restart.
    await manager.shutdown();
    await restart();
    expect(manager.inspect(jobId)).toMatchObject({ state: 'cancelled', cancellation: { remote: 'unknown' } });
    expect(admission.settles).toHaveLength(1);
  });

  it('排队任务重启时视频目录不见了：失败（STALE_JOB_INPUT），不执行', async () => {
    generator.hold();
    const first = await manager.submitSynthesizeSpeech({ text: '一', videoId: 'mov_1' }, CONNECTION);
    const queued = await manager.submitSynthesizeSpeech({ text: '二', videoId: 'mov_1' }, CONNECTION);
    await until(async () => (await stored(first.jobId))?.state === 'running' && (await stored(queued.jobId))?.state === 'queued');
    generator.release();
    videos.gone = true;
    await restart();
    expect(manager.inspect(queued.jobId)).toMatchObject({ state: 'failed', error: { code: 'STALE_JOB_INPUT' } });
    expect(generator.runs).toHaveLength(1);
    expect(admission.settles).toContainEqual({ reservationId: 'rsv_2', basis: 'released' });
  });

  it('可查询的远端任务：失败的 failed、没到达的 interrupted、还在跑的等对账，从不重新提交', async () => {
    generator.hold();
    const ids: string[] = [];
    for (const text of ['一', '二', '三']) {
      const { jobId } = await manager.submitSynthesizeSpeech({ text }, CONNECTION);
      ids.push(jobId);
      await until(async () => (await stored(jobId))?.state === 'running');
      // Leave this “running at crash” record in the ledger, and create the next one with a new JobManager.
      manager = create();
      await manager.open();
    }
    generator.release();
    // Backfill the record with a remote task ID (none of the existing adapters has one; here we simulate a Provider that supports querying), restoring it to the state it had at crash.
    const edit = new JobLedger(paths.jobsFile);
    const data = { jobs: await edit.load() };
    expect(data.jobs.map((j) => j.record.state)).toEqual(['needs-reconciliation', 'needs-reconciliation', 'needs-reconciliation']);
    for (const job of data.jobs) {
      Object.assign(job.record, { state: 'running', error: null, endedAt: null });
      job.remoteTaskId = `remote_${ids.indexOf(job.record.jobId)}`;
    }
    await edit.save(data.jobs);
    const statuses: RemoteTaskStatus[] = [{ status: 'failed', message: '远端失败' }, { status: 'not-found' }, { status: 'running' }];
    const queried: string[] = [];
    remoteTasks = {
      supports: (providerId) => providerId === 'fake',
      query: async ({ remoteTaskId }) => {
        queried.push(remoteTaskId);
        return statuses[Number(remoteTaskId.split('_')[1])]!;
      },
    };
    await restart();
    expect(queried.sort()).toEqual(['remote_0', 'remote_1', 'remote_2']);
    expect(manager.inspect(ids[0]!)).toMatchObject({
      state: 'failed',
      error: { code: 'PROVIDER_REJECTED', details: { remoteTaskId: 'remote_0' } },
    });
    expect(manager.inspect(ids[1]!)).toMatchObject({ state: 'interrupted', error: { code: 'JOB_INTERRUPTED' } });
    expect(manager.inspect(ids[2]!)).toMatchObject({
      state: 'needs-reconciliation',
      error: { code: 'JOB_NEEDS_RECONCILIATION', details: { remoteTaskId: 'remote_2', remote: 'running' } },
    });
    expect(generator.runs).toHaveLength(3);
  });
});

describe('恢复矩阵与对账的规则', () => {
  const job = (patch: Partial<JobRecord>, spec: unknown = { capability: 'synthesizeSpeech' }): StoredJob => ({
    record: {
      jobId: 'job_1',
      kind: 'synthesizeSpeech',
      state: 'running',
      providerId: 'fake',
      submitter: CONNECTION,
      videoId: 'mov_1',
      parentJobId: null,
      result: null,
      ...patch,
    } as JobRecord,
    spec: spec as StoredJob['spec'],
    workerVersion: null,
  });
  const app = (state: string) => ({ state }) as NonNullable<JobRecord['applications']>[number];

  it('按停在哪里决定', () => {
    expect(recoveryAction(job({ state: 'completed' }), undefined, undefined)).toEqual({ kind: 'keep' });
    expect(recoveryAction(job({ state: 'queued' }), undefined, undefined)).toEqual({ kind: 'requeue' });
    expect(recoveryAction(job({ state: 'queued', submitter: AGENT }), undefined, undefined)).toEqual({ kind: 'interrupt' });
    expect(recoveryAction(job({ state: 'queued', submitter: { kind: 'node', id: 'nod_1' } }), undefined, undefined)).toEqual({
      kind: 'interrupt',
    });
    expect(recoveryAction(job({ providerId: 'local' }), undefined, undefined)).toEqual({ kind: 'interrupt' });
    expect(recoveryAction(job({ providerId: 'node:nod_1' }), undefined, undefined)).toEqual({ kind: 'interrupt' });
    expect(recoveryAction(job({}), undefined, undefined)).toEqual({ kind: 'reconcile' });
    // Online calls the user cannot retry are only interrupted: fixed-pipeline steps, transcription without video, and tasks that do not go through a model.
    expect(recoveryAction(job({ parentJobId: 'job_p' }), undefined, undefined)).toEqual({ kind: 'interrupt' });
    expect(recoveryAction(job({ kind: 'transcribe', videoId: null }, { track: 0 }), undefined, undefined)).toEqual({ kind: 'interrupt' });
    expect(recoveryAction(job({ kind: 'export' }, { task: 'export' }), undefined, undefined)).toEqual({ kind: 'interrupt' });
    expect(recoveryAction(job({}, { hosted: { kind: 'export' } }), undefined, undefined)).toEqual({ kind: 'interrupt' });
    const remote: RemoteTaskQuery = { supports: (id) => id === 'fake', query: async () => ({ status: 'running' }) };
    expect(recoveryAction({ ...job({}), remoteTaskId: 'r1' }, undefined, remote)).toEqual({ kind: 'query-remote', remoteTaskId: 'r1' });
    expect(recoveryAction({ ...job({ providerId: 'other' }), remoteTaskId: 'r1' }, undefined, remote)).toEqual({ kind: 'reconcile' });
    // Apply not finished: complete the apply first.
    expect(recoveryAction(job({}), app('validating'), undefined)).toEqual({ kind: 'resume-application' });
    expect(recoveryAction(job({ state: 'completed' }), app('committed'), undefined)).toEqual({ kind: 'keep' });
  });

  it('取消的三件事实', () => {
    const at = '2026-01-01T00:00:00.000Z';
    expect(cancellationFacts({ providerId: 'fake' }, 'queued', at, { now: at })).toEqual({
      requestedAt: at,
      localStoppedAt: at,
      remote: 'not-submitted',
      cost: 'none',
    });
    expect(cancellationFacts({ providerId: 'local' }, 'queued', at)).toMatchObject({ remote: 'not-applicable', cost: 'none' });
    expect(cancellationFacts({ providerId: 'fake' }, 'running', at)).toMatchObject({ remote: 'cancel-unsupported', cost: 'possible' });
    expect(cancellationFacts({ providerId: 'node:nod_1' }, 'running', at)).toMatchObject({ remote: 'unknown', cost: 'none' });
    expect(cancellationFacts({ providerId: 'node:nod_1' }, 'running', at, { confirmed: true })).toMatchObject({ remote: 'cancelled' });
    expect(cancellationFacts({ providerId: 'fake' }, 'after-result', at)).toMatchObject({ remote: 'not-applicable', cost: 'charged' });
    expect(cancellationFacts({ providerId: 'local' }, 'after-result', at)).toMatchObject({ cost: 'none' });
    expect(cancellationFacts({ providerId: 'fake' }, 'unknown', at)).toMatchObject({ remote: 'unknown', cost: 'possible' });
  });

  it('对账决定只在合法的状态下可用', () => {
    expect(reconcileChoices(job({ state: 'needs-reconciliation' }), undefined)).toEqual(['retry', 'discard']);
    expect(reconcileChoices(job({ state: 'interrupted' }), undefined)).toEqual(['retry']);
    expect(reconcileChoices(job({ state: 'interrupted', submitter: { kind: 'pipeline', id: 'job_p' } }), undefined)).toEqual([]);
    expect(reconcileChoices(job({ state: 'needs-reconciliation', parentJobId: 'job_p' }), undefined)).toEqual(['discard']);
    expect(reconcileChoices(job({ state: 'completed' }), undefined)).toEqual([]);
    const result = { artifactId: 'sha256:x' } as unknown as JobRecord['result'];
    expect(reconcileChoices(job({ state: 'failed', result }), app('stale-input'))).toEqual(['apply']);
    expect(reconcileChoices(job({ state: 'failed', result }), app('rejected'))).toEqual(['apply']);
    expect(reconcileChoices(job({ state: 'cancelled', result }), app('cancelled'))).toEqual(['apply']);
    expect(reconcileChoices(job({ state: 'completed', result }), app('committed'))).toEqual([]);
    expect(reconcileChoices(job({ state: 'failed', result: null }), app('stale-input'))).toEqual([]);
    expect(reconcileChoices(job({ state: 'failed', result, videoId: null }), app('stale-input'))).toEqual([]);
    // Transcription: with video it can be retried; without video (transcription served by the model-interface service) it cannot.
    const transcribe = { track: 0 };
    expect(reconcileChoices(job({ state: 'interrupted', kind: 'transcribe' }, transcribe), undefined)).toEqual(['retry']);
    expect(reconcileChoices(job({ state: 'interrupted', kind: 'transcribe', videoId: null }, transcribe), undefined)).toEqual([]);
  });
});
