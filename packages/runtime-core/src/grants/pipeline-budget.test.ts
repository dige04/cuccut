import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CucCutClient } from '@cuccut/client';
import { writeFakeYtDlp, type FakeYtDlp, type JobFaultPoint } from '@cuccut/jobs';
import { fakeOpenAiHandler, startFakeProviderServer, type FakeProviderServer } from '@cuccut/providers/testing';
import { newId, type Id, type JobRecord } from '@cuccut/protocol';
import { resolveRuntimeHome, type RuntimeHome } from '@cuccut/runtime-storage';
import { startRuntime, type RunningRuntime } from '../runtime.ts';
import { resolveEngineHostCommand } from '../videos/engine-host.ts';
import { ToolDriver, tool, until, type ToolSession } from '../agent-tools/testing/fake-agent.ts';

/**
 * Pipelines started by an agent count toward the task budget (architecture design §3.2, §7.8). A fake agent calls `download` through the real MCP endpoint (a fake yt-dlp, no network). The pipeline imports the downloaded media into a video in the real engine, then submits transcription. Transcription goes to a fake OpenAI on the local loopback address. The pipeline and its subtasks find the agent task through the submitter, and outbound calls are charged to that task's budget. When the budget is exceeded, the pipeline stops at the transcription step with error code `TASK_BUDGET_EXCEEDED`, and the provider receives no request.
 * After a crash and restart, the transcription reservation is settled only once, and stays that way after another restart. Skipped when there is no engine-host or ffprobe.
 */

const engine = resolveEngineHostCommand();
const ffprobe = (() => {
  try {
    execFileSync('ffprobe', ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();
if (!engine || !ffprobe) console.warn('跳过流程的任务预算端到端测试：没有 engine-host 或 ffprobe');

const OPENAI_KEY = 'sk-test-ONLY-FOR-TESTS-pipeline-budget-0123456789';
const TERMINAL = new Set(['completed', 'failed', 'cancelled', 'interrupted', 'needs-reconciliation']);

/** The lifetime of one Runtime process. The same home can be shut down and started again (simulating a restart after a crash). */
class Life {
  readonly dir: string;
  readonly home: RuntimeHome;
  readonly openai: FakeProviderServer;
  readonly fake: FakeYtDlp;
  readonly emptyPath: string;
  runtime!: RunningRuntime;
  client!: CucCutClient;
  driver!: ToolDriver;
  /** Simulate a crash at this point in the transcription task (cleared once triggered). */
  crashAt: JobFaultPoint | null = null;
  crashed = false;

  constructor(dir: string, openai: FakeProviderServer, fake: FakeYtDlp, emptyPath: string) {
    this.dir = dir;
    this.home = resolveRuntimeHome({ CUCCUT_HOME: path.join(dir, 'home') });
    this.openai = openai;
    this.fake = fake;
    this.emptyPath = emptyPath;
  }

  async start(): Promise<void> {
    this.driver = new ToolDriver();
    this.runtime = await startRuntime({
      home: this.home,
      drivers: () => [this.driver],
      watchSpace: false,
      engineHost: engine,
      videoGraceMs: 100,
      modelWorker: null,
      jobIdleMs: 60_000,
      online: { baseUrls: { openai: `${this.openai.origin}/v1` }, http: { backoffMs: () => 10 } },
      // PATH holds only an empty directory and does not read overrides from the real environment, so the yt-dlp in use is only the fake tool the test provides.
      externalTools: { env: async () => ({ PATH: this.emptyPath }), overrides: {}, lookup: async () => ['93.184.216.34'] },
      jobFaults: (point, context) => {
        if (this.crashAt !== point || this.runtime.models.jobs.inspect(context.jobId).kind !== 'transcribe') return;
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

  async restart(): Promise<void> {
    await this.stop();
    await this.start();
    await this.runtime.models.jobs.recover();
  }

  async stop(): Promise<void> {
    this.client.close();
    await this.runtime.close();
  }

  /** The pipeline (and the transcription it submitted) has finished. */
  async settled(jobId: Id): Promise<JobRecord> {
    return until(async () => {
      const job = this.runtime.models.jobs.inspect(jobId);
      if (!TERMINAL.has(job.state)) return null;
      await this.runtime.models.pipelines.idle();
      return this.runtime.models.jobs.inspect(jobId);
    }, 30_000);
  }

  /** The transcription task submitted by the pipeline. */
  transcribeOf(pipelineJobId: Id): JobRecord | undefined {
    return this.runtime.models.jobs
      .list()
      .find((job) => job.kind === 'transcribe' && job.submitter.kind === 'pipeline' && job.submitter.id === pipelineJobId);
  }

  async usage(taskId: Id): Promise<{ calls: number; reservedCalls: number }> {
    const view = await this.client.request('tasks.getContract', { taskId });
    return { calls: view.budget!.usage.calls, reservedCalls: view.budget!.usage.reservedCalls };
  }

  transcriptions(): number {
    return this.openai.requests.filter((r) => r.method === 'POST' && r.path.endsWith('/audio/transcriptions')).length;
  }
}

describe.skipIf(!engine || !ffprobe)('智能体启动的流程计入任务预算（假 yt-dlp + 真实引擎 + 假供应商）', () => {
  let life: Life;
  let videoId: Id;
  let conversationId: Id;

  beforeEach(async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-pipeline-budget-'));
    const openai = await startFakeProviderServer(fakeOpenAiHandler());
    const fake = await writeFakeYtDlp(path.join(dir, 'bin'));
    const emptyPath = path.join(dir, 'empty-path');
    await fs.mkdir(emptyPath);
    life = new Life(dir, openai, fake, emptyPath);
    await life.start();
    const { client } = life;
    await client.request('externalTools.setPath', { name: 'yt-dlp', path: fake.command });
    await client.request('externalTools.consent', { name: 'yt-dlp', grant: true });
    await client.request('models.configure', { providerId: 'openai', enabled: true, credential: OPENAI_KEY });
    await client.request('models.setDefault', { capability: 'transcribe', providerId: 'openai' });
    const { project } = await client.request('projects.create', { name: '流程预算' });
    videoId = (await client.request('videos.create', { projectId: project.id, name: '下载' })).ref.videoId;
    ({
      conversation: { id: conversationId },
    } = await client.request('conversations.create', { projectId: project.id }));
  });

  afterEach(async () => {
    await life.stop();
    await life.openai.close();
    await fs.rm(life.dir, { recursive: true, force: true });
  });

  /** Create an agent task with a cap on call count, and wait for the fake agent's turn to start. */
  async function agentTask(maxCalls: number): Promise<{ taskId: Id; session: ToolSession }> {
    const { taskId } = await life.client.request('tasks.create', {
      conversationId,
      goal: '下载并转写',
      commandId: newId('cmd'),
      accessMode: 'auto',
      contract: { budget: { maxCalls, cap: null } },
    });
    const session = await until(() => life.driver.sessions[0]);
    await until(() => session.turnId);
    return { taskId, session };
  }

  async function startImport(session: ToolSession, v: string): Promise<Id> {
    const started = await tool(session, 'download', {
      url: `https://video.example.com/watch?v=${v}`,
      video: videoId,
      transcribe: true,
    });
    expect(started.isError, JSON.stringify(started.body)).toBe(false);
    return started.body.jobId as Id;
  }

  it('流程与它提交的转写算进任务预算；超出时停在转写一步并报告，供应商没有收到请求；用户启动的流程不受限', async () => {
    const { taskId, session } = await agentTask(1);

    const first = await life.settled(await startImport(session, 'one'));
    expect(first.state, JSON.stringify(first.error)).toBe('completed');
    expect(first.submitter).toMatchObject({ kind: 'agent', taskId });
    const transcribed = life.transcribeOf(first.jobId)!;
    expect(transcribed).toMatchObject({ state: 'completed', providerId: 'openai', grant: { settled: { calls: 1 } } });
    expect(life.runtime.models.grants.taskOfJob(transcribed.jobId)).toBe(taskId);
    expect(await life.usage(taskId)).toEqual({ calls: 1, reservedCalls: 0 });
    expect(life.transcriptions()).toBe(1);

    // Second run: download and import proceed as usual (nothing sent out), and transcription is rejected at admission by the task budget. The pipeline fails and stops at the transcription step, which shows the cause is the task budget.
    const second = await life.settled(await startImport(session, 'two'));
    expect(second.state).toBe('failed');
    expect(second.error).toMatchObject({ code: 'TASK_BUDGET_EXCEEDED' });
    // A subtitle-layer build step follows transcription (not enabled this time). Since the pipeline stopped at transcription, it did not run.
    const steps = second.pipeline!.steps.map((s) => [s.name, s.status]);
    const failedAt = steps.findIndex(([name]) => name === 'transcribe');
    expect(steps.slice(0, failedAt).every(([, status]) => status === 'completed' || status === 'skipped')).toBe(true);
    expect(steps[failedAt]).toEqual(['transcribe', 'failed']);
    expect(steps.slice(failedAt + 1).map(([name]) => name)).toEqual(['captions']);
    const step = life.runtime.models.jobs.inspect(second.pipeline!.steps[failedAt]!.jobId!);
    expect(step.error).toMatchObject({ code: 'TASK_BUDGET_EXCEEDED' });
    expect(second.error!.details).toMatchObject({ step: 'transcribe', taskId, measure: 'calls', remedy: { action: 'raise-budget' } });
    expect(life.transcribeOf(second.jobId)).toBeUndefined();
    expect(life.transcriptions()).toBe(1);
    expect(await life.usage(taskId)).toEqual({ calls: 1, reservedCalls: 0 });

    // The agent can read the reason for the failure from the task.
    const inspected = await tool(session, 'jobs_inspect', { jobId: second.jobId });
    expect(JSON.stringify(inspected.body)).toContain('TASK_BUDGET_EXCEEDED');

    // Pipelines started directly from the UI are not part of a task: transcription proceeds as usual and the task's usage does not change.
    const { jobId: userJob } = await life.client.request('pipelines.start', {
      pipeline: 'link-import',
      params: { url: 'https://video.example.com/watch?v=three', videoId, transcribe: true },
    });
    expect((await life.settled(userJob)).state).toBe('completed');
    expect(life.transcriptions()).toBe(2);
    expect(await life.usage(taskId)).toEqual({ calls: 1, reservedCalls: 0 });
  });

  it('转写的产物写进产物库之后崩溃：重启后补做应用，任务预算只结算一次，再重启也不变', async () => {
    const { taskId, session } = await agentTask(2);
    life.crashAt = 'artifact-stored';
    const pipelineJobId = await startImport(session, 'crash');
    await until(() => life.crashed, 30_000);
    expect(life.transcriptions()).toBe(1);

    await life.restart();
    const transcribed = await until(() => {
      const job = life.transcribeOf(pipelineJobId);
      return job && TERMINAL.has(job.state) && job;
    });
    expect(transcribed).toMatchObject({ state: 'completed', applications: [{ state: 'committed' }], grant: { settled: { calls: 1 } } });
    expect(await life.usage(taskId)).toEqual({ calls: 1, reservedCalls: 0 });
    expect(life.transcriptions()).toBe(1);
    // The pipeline itself stops at the transcription step (interrupted) and can be retried.
    expect(life.runtime.models.jobs.inspect(pipelineJobId).state).toBe('interrupted');

    await life.restart();
    expect(await life.usage(taskId)).toEqual({ calls: 1, reservedCalls: 0 });
    expect(life.transcriptions()).toBe(1);
  });
});
