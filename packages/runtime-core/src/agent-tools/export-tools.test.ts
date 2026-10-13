import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { CucCutClient } from '@cuccut/client';
import { JobLedger } from '@cuccut/jobs';
import { newId, type AgentMode, type Autonomy, type Id, type Project } from '@cuccut/protocol';
import { resolveRuntimeHome } from '@cuccut/runtime-storage';
import { resolveEngineHostCommand } from '../videos/engine-host.ts';
import { startRuntime, type RunningRuntime } from '../runtime.ts';
import { ToolDriver, tool, until, type Loose, type ToolSession } from './testing/fake-agent.ts';

/**
 * `export` end to end: a fake agent exports subtitles through the real MCP endpoint. Covers permissions (plan mode is read-only), the constraints on the target directory (it must not leave the working directory or enter the video directory), and the shape of pre-check errors (error code + next). Needs engine-host and ffmpeg; skipped if missing.
 */

const engine = resolveEngineHostCommand();
const ffmpeg = (() => {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();
if (!engine || !ffmpeg) console.warn('跳过导出工具测试：没有 engine-host 或 ffmpeg');

describe.skipIf(!engine || !ffmpeg)('export tools (real engine)', () => {
  let fixtures: string;
  let audio: string;
  let dir: string;
  let runtime: RunningRuntime;
  let client: CucCutClient;
  let driver: ToolDriver;
  let project: Project;
  let conversationId: Id;
  let videoId: Id;
  let videoPath: string;
  let assetId: Id;

  beforeAll(async () => {
    fixtures = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-export-tools-fixtures-'));
    audio = path.join(fixtures, 'voice.wav');
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=3', '-ac', '1', audio]);
  });

  afterAll(async () => {
    await fs.rm(fixtures, { recursive: true, force: true });
  });

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-export-tools-'));
    driver = new ToolDriver();
    runtime = await startRuntime({
      home: resolveRuntimeHome({ CUCCUT_HOME: dir }),
      drivers: () => [driver],
      watchSpace: false,
      engineHost: engine,
      videoGraceMs: 100,
      modelWorker: null,
    });
    const { endpoint, token } = runtime.discovery;
    client = new CucCutClient({
      resolve: async () => ({ endpoint, token }),
      client: { kind: 'desktop', name: 'test', version: '0' },
      reconnect: false,
    });
    await client.connect();
    ({ project } = await client.request('projects.create', { name: '导出工具' }));
    ({
      conversation: { id: conversationId },
    } = await client.request('conversations.create', { projectId: project.id }));
    const opened = await client.request('videos.create', { projectId: project.id, name: '样片' });
    videoId = opened.ref.videoId;
    videoPath = opened.ref.relPath;
    const words = [
      { id: 'w1', start: 0, end: 500, text: 'Hello' },
      { id: 'w2', start: 500, end: 1000, text: 'there.' },
    ];
    await client.request('edits.apply', {
      videoId,
      commandId: newId('cmd'),
      expectedRevision: opened.snapshot.video.revision,
      operations: [
        { type: 'importAsset', path: audio, ref: 'a' },
        { type: 'addItem', sequenceId: opened.snapshot.video.rootSequenceId, asset: { ref: 'a' }, alignment: 'nearest-frame' },
        {
          type: 'putDocument',
          kind: 'speech',
          language: 'en',
          sourceAsset: { ref: 'a' },
          body: { schema: 'cuccut.speech/1', clock: 'source-asset', timescale: 1000, speakers: [], words, sentences: null, chapters: [] },
        },
      ],
    });
    assetId = Object.keys(runtime.videos.mirror(videoId)!.video.assets)[0]!;
  });

  afterEach(async () => {
    client?.close();
    await runtime?.close();
    await fs.rm(dir, { recursive: true, force: true });
  });

  async function send(autonomy?: Autonomy | AgentMode): Promise<ToolSession> {
    await client.request('conversations.send', {
      conversationId,
      text: '导出',
      commandId: newId('cmd'),
      ...(autonomy ? { autonomy } : {}),
    });
    // A turn that changed the autonomy level may be a new native session: take the one currently in the turn.
    const session = await until(() => driver.sessions.find((s) => s.turnId));
    await until(() => runtime.harness.agentRun(conversationId).taskId);
    return session;
  }

  async function settle(session: ToolSession, jobId: string): Promise<Loose> {
    return until(async () => {
      const { isError, body } = await tool(session, 'jobs_inspect', { jobId });
      expect(isError).toBe(false);
      return ['completed', 'failed', 'cancelled', 'interrupted'].includes(body.state) ? body : null;
    }, 15_000);
  }

  it('rejected in plan mode; when modification is allowed, exports to exports/ in the working directory, jobs_inspect gives the path and validation', async () => {
    const plan = await send('plan');
    const refused = await tool(plan, 'export', { video: videoPath, kind: 'subtitles', format: 'srt' });
    expect(refused.body.error.code).toBe('PLAN_ONLY');
    plan.finish();
    await until(() => runtime.harness.agentRun(conversationId).taskId === null);

    // The mode given at send time switched the session's mode: it must be switched back to auto before it can modify anything.
    const session = await send('auto');
    const submitted = await tool(session, 'export', { video: videoPath, kind: 'subtitles', format: 'srt' });
    expect(submitted.isError).toBe(false);
    expect(submitted.body).toMatchObject({
      kind: 'export',
      videoId,
      files: ['样片.en.srt'],
      approval: { mode: 'auto', risk: 'edit', decidedBy: 'auto' },
    });
    const job = await settle(session, submitted.body.jobId);
    expect(job.state).toBe('completed');
    expect(job.submittedBy).toBe('agent');
    expect(job.outputs).toEqual([
      expect.objectContaining({ path: path.join(project.path, 'exports', '样片.en.srt'), format: 'srt', validation: expect.any(Object) }),
    ]);
    expect(job.next).toContain('Export completed');
    expect(await fs.readFile(job.outputs[0].path, 'utf8')).toContain('Hello there.');

    // Existing directories and file names in the working directory.
    await fs.mkdir(path.join(project.path, 'out'));
    const named = await tool(session, 'export', {
      video: videoId,
      kind: 'transcript',
      format: 'txt',
      dir: 'out',
      fileName: '稿子',
    });
    expect(named.isError).toBe(false);
    const namedJob = await settle(session, named.body.jobId);
    expect(namedJob.outputs[0].path).toBe(path.join(await fs.realpath(project.path), 'out', '稿子.txt'));

    // Allowing an existing file to be overwritten is high risk: it asks even in the default auto mode, and on refusal nothing is committed.
    const overwriting = tool(session, 'export', {
      video: videoId,
      kind: 'transcript',
      format: 'txt',
      dir: 'out',
      fileName: '稿子',
      overwrite: true,
    });
    const pending = await until(() => runtime.harness.approvals.pending()[0]);
    expect(pending).toMatchObject({ action: { name: 'export' }, risk: 'high', basis: { kind: 'mode', mode: 'auto' } });
    await client.request('approvals.respond', { approvalId: pending.approvalId, decision: 'deny' });
    expect((await overwriting).body.error).toMatchObject({ code: 'APPROVAL_DENIED', mode: 'auto', risk: 'high' });

    // The same rule applies to the finished video: on overwrite it is high, and the confirmation summary states that it is the finished video.
    // The audio source and the output width and height do not change the risk: even when the output is original audio and landscape is letterboxed to 9:16, overwriting is still high, and the summary states the size and the source.
    const overwritingVideo = tool(session, 'export', {
      video: videoId,
      kind: 'video',
      format: 'mp4',
      width: 1080,
      height: 1920,
      source: 'original',
      overwrite: true,
    });
    const pendingVideo = await until(() => runtime.harness.approvals.pending()[0]);
    expect(pendingVideo).toMatchObject({ action: { name: 'export' }, risk: 'high' });
    expect(JSON.stringify(pendingVideo)).toContain('导出成片（mp4，1080×1920，只要原声）');
    await client.request('approvals.respond', { approvalId: pendingVideo.approvalId, decision: 'deny' });
    expect((await overwritingVideo).body.error).toMatchObject({ code: 'APPROVAL_DENIED', risk: 'high' });
  });

  it('internal-check purpose frozen into the export record via the tool; file and background task complete as usual', async () => {
    const session = await send('auto');
    const submitted = await tool(session, 'export', { video: videoPath, kind: 'subtitles', format: 'srt', purpose: 'preview' });
    expect(submitted.isError).toBe(false);
    expect(submitted.body.purpose).toBe('preview');
    const job = await settle(session, submitted.body.jobId);
    expect(job.state).toBe('completed');
    const record = await client.request('exports.get', { jobId: submitted.body.jobId });
    expect(record.export?.settings.purpose).toBe('preview');
    expect(await fs.readFile(job.outputs[0].path, 'utf8')).toContain('Hello there.');
    const stored = { jobs: (await new JobLedger(path.join(dir, 'store', 'jobs.jsonl')).load()) as Loose[] };
    expect(stored.jobs.find((j: Loose) => j.record.jobId === record.jobId).record.export.settings.purpose).toBe('preview');
  });

  it('agent translates itself: documents_read\'s transcript carries translationBasis, and a translation written according to it can be written into the video', async () => {
    const session = await send('auto');
    const speechId = Object.values(runtime.videos.mirror(videoId)!.video.documents).find((d) => d.kind === 'speech')!.id;
    const read = await tool(session, 'documents_read', { video: videoPath, documentId: speechId });
    expect(read.isError).toBe(false);
    const basis = read.body.translationBasis;
    expect(basis.sourceBasis).toMatchObject({ speechRef: { id: speechId, revision: read.body.revision }, scopeLineage: [] });
    expect(basis.sentences).toEqual([{ id: 's-w1', fingerprint: expect.any(String), text: 'Hello there.', wordIds: ['w1', 'w2'], start: expect.any(Number), end: expect.any(Number) }]);
    expect(basis.sentences[0].end).toBeGreaterThan(basis.sentences[0].start);

    const inspected = await tool(session, 'videos_inspect', { video: videoPath });
    const put = await tool(session, 'edits_apply', {
      video: videoPath,
      expectedRevision: inspected.body.revision,
      label: '写入中文译文',
      operations: [
        {
          type: 'putDocument',
          kind: 'translation',
          language: 'zh-Hans',
          sourceDocument: { documentId: speechId },
          body: {
            schema: 'cuccut.translation/2',
            language: 'zh-Hans',
            sourceBasis: basis.sourceBasis,
            units: basis.sentences.map((s: Loose) => ({
              id: `t-${s.id}`,
              sourceSentenceId: s.id,
              sourceFingerprint: s.fingerprint,
              naturalText: '你好。',
              alignment: null,
              status: 'draft',
            })),
          },
        },
      ],
    });
    expect(put.isError).toBe(false);
    // Units whose alignment is null are given sentence-level alignment by the Runtime (bilingual export and captions_create use it to get members and timing).
    expect(put.body.filledAlignments).toBe(1);
    const after = await tool(session, 'videos_inspect', { video: videoPath });
    expect(after.body.documents).toContainEqual(
      expect.objectContaining({ kind: 'translation', language: 'zh-Hans', sourceDocumentId: speechId }),
    );
  });

  it('target directory cannot leave the working directory or enter the video directory; format and kind must match; preflight errors carry an error code and next', async () => {
    const session = await send();
    const codeOf = async (args: Record<string, unknown>) =>
      (await tool(session, 'export', { video: videoPath, kind: 'subtitles', format: 'srt', ...args })).body.error;

    expect((await codeOf({ dir: '../' })).code).toBe('PATH_OUTSIDE_WORKSPACE');
    expect((await codeOf({ dir: '/tmp' })).code).toBe('PATH_OUTSIDE_WORKSPACE');
    expect((await codeOf({ dir: videoPath })).code).toBe('PATH_INSIDE_VIDEO');
    expect((await codeOf({ dir: 'missing' })).code).toBe('INVALID_PATH');
    expect((await codeOf({ fileName: '../x.srt' })).code).toBe('INVALID_PATH');
    expect((await codeOf({ format: 'wav' })).code).toBe('INVALID_ARGUMENTS');
    expect((await codeOf({ kind: 'audio', format: 'srt' })).code).toBe('INVALID_ARGUMENTS');
    expect((await codeOf({ source: 'original' })).code).toBe('INVALID_ARGUMENTS');
    // Options that exist only for the script were given together with subtitles: rejected, not silently dropped.
    expect((await codeOf({ chapters: true })).code).toBe('INVALID_ARGUMENTS');
    expect((await codeOf({ skipCut: false })).code).toBe('INVALID_ARGUMENTS');
    expect((await codeOf({ kind: 'video', format: 'mp4', width: 9000 })).code).toBe('INVALID_ARGUMENTS');

    const notFound = await codeOf({ language: 'fr' });
    expect(notFound).toMatchObject({ code: 'EXPORT_SOURCE_NOT_FOUND', next: expect.any(String) });

    // Two transcripts: list the candidates.
    const mirror = runtime.videos.mirror(videoId)!;
    await client.request('edits.apply', {
      videoId,
      commandId: newId('cmd'),
      expectedRevision: mirror.video.revision,
      operations: [
        {
          type: 'putDocument',
          kind: 'speech',
          language: 'en',
          sourceAsset: { assetId },
          body: {
            schema: 'cuccut.speech/1',
            clock: 'source-asset',
            timescale: 1000,
            speakers: [],
            words: [],
            sentences: null,
            chapters: [],
          },
        },
      ],
    });
    const ambiguous = await codeOf({});
    expect(ambiguous).toMatchObject({
      code: 'EXPORT_SOURCE_AMBIGUOUS',
      candidates: expect.any(Array),
      next: expect.stringContaining('documentId'),
    });
    expect(await client.request('exports.list', { videoId })).toEqual({ jobs: [] });
  });

  it('portable package and project: both are edit (high when overwriting); missing media listed item by item, without local paths', async () => {
    const session = await send('auto');
    const submitted = await tool(session, 'export', { video: videoPath, kind: 'portable', format: 'cuccut' });
    expect(submitted.isError).toBe(false);
    expect(submitted.body).toMatchObject({ files: ['样片.cuccut'], approval: { risk: 'edit', decidedBy: 'auto' } });
    const job = await settle(session, submitted.body.jobId);
    expect(job.state).toBe('completed');
    expect(job.outputs[0]).toMatchObject({ format: 'cuccut', path: path.join(project.path, 'exports', '样片.cuccut') });

    const xml = await tool(session, 'export', { video: videoPath, kind: 'project', format: 'xmeml' });
    expect(xml.isError).toBe(false);
    expect((await settle(session, xml.body.jobId)).state).toBe('completed');

    expect((await tool(session, 'export', { video: videoPath, kind: 'portable', format: 'srt' })).body.error.code).toBe(
      'INVALID_ARGUMENTS',
    );
    expect(
      (await tool(session, 'export', { video: videoPath, kind: 'portable', format: 'cuccut', range: { start: 0, end: 1 } })).body.error
        .code,
    ).toBe('INVALID_ARGUMENTS');

    const overwriting = tool(session, 'export', { video: videoId, kind: 'portable', format: 'cuccut', overwrite: true });
    const pending = await until(() => runtime.harness.approvals.pending()[0]);
    expect(pending).toMatchObject({ action: { name: 'export' }, risk: 'high' });
    expect(JSON.stringify(pending)).toContain('导出便携包（cuccut）');
    await client.request('approvals.respond', { approvalId: pending.approvalId, decision: 'deny' });
    expect((await overwriting).body.error).toMatchObject({ code: 'APPROVAL_DENIED', risk: 'high' });

    // The linked recording is missing: rejected. items contain the reason and the name, with no absolute path.
    await fs.rename(audio, `${audio}.gone`);
    try {
      const missing = (await tool(session, 'export', { video: videoPath, kind: 'portable', format: 'cuccut' })).body.error;
      expect(missing).toMatchObject({ code: 'ASSET_MISSING', items: [{ reason: 'missing', name: 'voice.wav' }], next: expect.any(String) });
      expect(JSON.stringify(missing)).not.toContain(fixtures);
    } finally {
      await fs.rename(`${audio}.gone`, audio);
    }
  });
});
