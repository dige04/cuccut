import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CucCutClient } from '@cuccut/client';
import { writeFakeYtDlp, type FakeYtDlp } from '@cuccut/jobs';
import { fakeOpenAiHandler, startFakeProviderServer, type FakeProviderServer } from '@cuccut/providers/testing';
import { newId, type Id, type JobRecord } from '@cuccut/protocol';
import { resolveRuntimeHome } from '@cuccut/runtime-storage';
import { startRuntime, type RunningRuntime } from '../runtime.ts';
import { resolveEngineHostCommand } from '../videos/engine-host.ts';
import { ToolDriver, tool, until, type ToolSession } from './testing/fake-agent.ts';

/**
 * Background writes under a task are protected by the task (architecture §3.2, §7.3). A fake agent, through the real MCP endpoint, submits a generation (a fake OpenAI on a loopback address) and an import from a link (a fake yt-dlp) inside a task that protects the whole video. The results, applied to the video, carry the task contract's protection, and the real engine rejects the whole transaction:
 * the generation job's application is recorded as `rejected` (`TASK_PROTECTED`), the artifact is kept as a candidate, and the user decides for themselves to apply it with `jobs.reconcile apply`;
 * the flow stops at the import step (`TASK_PROTECTED`), and the downloaded file is kept. Jobs of the same kind that the user submits directly are written as normal. Skipped without engine-host or ffprobe.
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
if (!engine || !ffprobe) console.warn('跳过任务保护的后台写入测试：没有 engine-host 或 ffprobe');

const OPENAI_KEY = 'sk-test-ONLY-FOR-TESTS-task-protection-0123456789';
const TERMINAL = new Set(['completed', 'failed', 'cancelled', 'interrupted', 'needs-reconciliation']);

describe.skipIf(!engine || !ffprobe)('任务下的后台写入带着任务保护（真实引擎 + 假供应商 + 假 yt-dlp）', () => {
  let dir: string;
  let openai: FakeProviderServer;
  let fake: FakeYtDlp;
  let runtime: RunningRuntime;
  let client: CucCutClient;
  let driver: ToolDriver;
  let videoId: Id;
  let conversationId: Id;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-task-protection-'));
    openai = await startFakeProviderServer(fakeOpenAiHandler());
    fake = await writeFakeYtDlp(path.join(dir, 'bin'));
    const emptyPath = path.join(dir, 'empty-path');
    await fs.mkdir(emptyPath);
    driver = new ToolDriver();
    runtime = await startRuntime({
      home: resolveRuntimeHome({ CUCCUT_HOME: path.join(dir, 'home') }),
      drivers: () => [driver],
      watchSpace: false,
      engineHost: engine,
      videoGraceMs: 100,
      modelWorker: null,
      jobIdleMs: 60_000,
      online: { baseUrls: { openai: `${openai.origin}/v1` }, http: { backoffMs: () => 10 } },
      // PATH holds only an empty directory and does not read overrides from the real environment: the yt-dlp used is only the fake tool the test specifies.
      externalTools: { env: async () => ({ PATH: emptyPath }), overrides: {}, lookup: async () => ['93.184.216.34'] },
    });
    const { endpoint, token } = runtime.discovery;
    client = new CucCutClient({
      resolve: async () => ({ endpoint, token }),
      client: { kind: 'desktop', name: 'test', version: '0' },
      reconnect: false,
    });
    await client.connect();
    await client.request('models.configure', { providerId: 'openai', enabled: true, credential: OPENAI_KEY });
    await client.request('externalTools.setPath', { name: 'yt-dlp', path: fake.command });
    await client.request('externalTools.consent', { name: 'yt-dlp', grant: true });
    const { project } = await client.request('projects.create', { name: '任务保护' });
    videoId = (await client.request('videos.create', { projectId: project.id, name: '受保护' })).ref.videoId;
    ({
      conversation: { id: conversationId },
    } = await client.request('conversations.create', { projectId: project.id }));
  });

  afterEach(async () => {
    client.close();
    await runtime.close();
    await openai.close();
    await fs.rm(dir, { recursive: true, force: true });
  });

  /** Create an agent task that protects the whole video, and wait for the fake agent's turn to start. */
  async function protectedTask(): Promise<{ taskId: Id; session: ToolSession }> {
    const { taskId } = await client.request('tasks.create', {
      conversationId,
      goal: '生成旁白，下载素材',
      commandId: newId('cmd'),
      accessMode: 'auto',
      contract: { protectedRefs: [{ protectionId: 'prot_video', videoId, target: { kind: 'video' } }] },
    });
    const session = await until(() => driver.sessions[0]);
    await until(() => session.turnId);
    return { taskId, session };
  }

  async function settled(jobId: Id): Promise<JobRecord> {
    return until(async () => {
      const job = runtime.models.jobs.inspect(jobId);
      if (!TERMINAL.has(job.state)) return null;
      await runtime.models.pipelines.idle();
      return runtime.models.jobs.inspect(jobId);
    }, 30_000);
  }

  const video = () => runtime.videos.mirror(videoId)!.video;

  it('生成任务的结果触碰保护：应用记为被拒、产物留作候选；用户 jobs.reconcile apply 照常写入；用户提交的不受限制', async () => {
    const { session } = await protectedTask();
    const before = video();

    const submitted = await tool(session, 'speak', { text: '受保护的旁白', provider: 'openai', video: videoId });
    expect(submitted.isError, JSON.stringify(submitted.body)).toBe(false);
    const jobId = submitted.body.jobId as Id;
    const job = await settled(jobId);
    expect(job.state).toBe('failed');
    expect(job.error).toMatchObject({
      code: 'APPLY_FAILED',
      details: { reason: 'TASK_PROTECTED', protections: [{ protectionId: 'prot_video' }] },
    });
    expect(job.applications).toEqual([
      expect.objectContaining({
        state: 'rejected',
        videoId,
        error: expect.objectContaining({
          code: 'TASK_PROTECTED',
          details: { protections: [expect.objectContaining({ protectionId: 'prot_video' })] },
        }),
      }),
    ]);
    // Nothing is written; the artifact is still there (it is a candidate).
    expect(video().revision).toBe(before.revision);
    expect(Object.keys(video().assets)).toEqual(Object.keys(before.assets));
    const artifactId = job.result!.outputs![0]!.artifactId;
    expect(await runtime.models.jobs.artifacts.locate(artifactId)).toBeTruthy();
    expect(openai.requests.filter((r) => r.path.endsWith('/audio/speech'))).toHaveLength(1);

    // The agent sees the reason and is told not to work around it.
    const inspected = await tool(session, 'jobs_inspect', { jobId });
    expect(inspected.body).toMatchObject({ state: 'failed', applications: [{ state: 'rejected', videoId }] });
    expect(inspected.body.next).toContain('Do not import it again with edits_apply');

    // The user decides to apply it: not subject to the task protection, and the provider is not called again.
    const applied = await client.request('jobs.reconcile', { jobId, decision: 'apply' });
    expect(applied).toMatchObject({ state: 'completed', error: null });
    expect(applied.applications!.map((a) => a.state)).toEqual(['rejected', 'committed']);
    const assetId = applied.result!.outputs![0]!.assetId!;
    expect(video().assets[assetId]).toBeTruthy();
    expect(openai.requests.filter((r) => r.path.endsWith('/audio/speech'))).toHaveLength(1);

    // A generation the user submits from the UI to the same video is not in the task, so it is written as normal.
    const { jobId: userJob } = await client.request('models.synthesizeSpeech', { text: '用户的旁白', provider: 'openai', videoId });
    const done = await settled(userJob);
    expect(done.state, JSON.stringify(done.error)).toBe('completed');
    expect(done.applications!.map((a) => a.state)).toEqual(['committed']);
  });

  it('智能体启动的从链接导入：导入一步触碰保护，流程停在那一步，下载的文件留着；用户启动的照常导入', async () => {
    const { session } = await protectedTask();
    const before = video();

    const started = await tool(session, 'download', { url: 'https://video.example.com/watch?v=guarded', video: videoId });
    expect(started.isError, JSON.stringify(started.body)).toBe(false);
    const job = await settled(started.body.jobId as Id);
    expect(job.state).toBe('failed');
    expect(job.error).toMatchObject({ code: 'TASK_PROTECTED', details: { step: 'import' } });
    const steps = job.pipeline!.steps;
    expect(steps.find((s) => s.name === 'import')!.status).toBe('failed');
    const published = steps.find((s) => s.name === 'publish')!;
    expect(published.status).toBe('completed');
    const media = (published.output as { media: string }).media;
    expect((await fs.stat(media)).isFile()).toBe(true);
    expect(video().revision).toBe(before.revision);
    expect(Object.keys(video().assets)).toEqual(Object.keys(before.assets));
    const inspected = await tool(session, 'jobs_inspect', { jobId: job.jobId });
    expect(inspected.body.next).toContain('do not change');

    // The same flow the user starts in the UI is not in a task: it is imported as normal.
    const { jobId: userJob } = await client.request('pipelines.start', {
      pipeline: 'link-import',
      params: { url: 'https://video.example.com/watch?v=user', videoId },
    });
    const done = await settled(userJob);
    expect(done.state, JSON.stringify(done.error)).toBe('completed');
    expect(Object.keys(video().assets)).toHaveLength(Object.keys(before.assets).length + 1);
  });
});
