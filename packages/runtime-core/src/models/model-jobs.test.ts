import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { CucCutClient, applyJobsEvent } from '@cuccut/client';
import { FAKE_MODEL_WORKER } from '@cuccut/jobs';
import { BUNDLES, MANIFEST_FILE, defaultTranscribeBundle } from '@cuccut/models';
import { RpcError, newId, type JobsSnapshot, type Project } from '@cuccut/protocol';
import { resolveRuntimeHome } from '@cuccut/runtime-storage';
import { startRuntime, type RunningRuntime } from '../runtime.ts';
import { resolveEngineHostCommand } from '../videos/engine-host.ts';

/**
 * End-to-end: gateway → JobManager → local Provider → fake Model Worker (a Node script) → the real video engine writes the speech document.
 * The model directory holds a synthetic manifest and small files; it needs engine-host and ffmpeg, and the default model bundle needs macOS on Apple Silicon; the test is skipped if these are missing.
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
/** Default transcription model bundle on this machine: MLX on Apple Silicon, candle on other platforms (same repository). */
const DEFAULT_TRANSCRIBE_BUNDLE = defaultTranscribeBundle(process.platform, process.arch);

if (!engine) console.warn('跳过转写端到端测试：没有构建 engine-host（npm run build:engine）');
if (!ffmpeg) console.warn('跳过转写端到端测试：没有 ffmpeg');

async function until<T>(read: () => T | undefined | null | false | Promise<T | undefined | null | false>, timeoutMs = 10_000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await read();
    if (value) return value;
    if (Date.now() > deadline) throw new Error('等待超时');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

/** Writes a synthetic manifest and files for each repository of the default model bundle. */
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

describe('model and task methods (no engine needed)', () => {
  let dir: string;
  let runtime: RunningRuntime;
  let client: CucCutClient;

  afterEach(async () => {
    client?.close();
    await runtime?.close();
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('without a Model Worker the model pack shows unavailable, submitting transcription is rejected', async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-models-'));
    const home = resolveRuntimeHome({ CUCCUT_HOME: dir });
    await installSyntheticModels(home.modelsDir);
    runtime = await startRuntime({ home, drivers: () => [], watchSpace: false, engineHost: null, modelWorker: null });
    const { endpoint, token } = runtime.discovery;
    client = new CucCutClient({
      resolve: async () => ({ endpoint, token }),
      client: { kind: 'desktop', name: 'test', version: '0' },
      reconnect: false,
    });
    await client.connect();

    for (const dir of [home.stagingDir, home.artifactsDir, home.modelsDir]) expect((await fs.stat(dir)).isDirectory()).toBe(true);
    const { bundles } = await client.request('models.list', {});
    expect(bundles.find((b) => b.bundleId === DEFAULT_TRANSCRIBE_BUNDLE)).toEqual(
      expect.objectContaining({
        capability: 'transcribe',
        state: 'error',
        reason: 'worker-missing',
      }),
    );
    // The local speech synthesis model bundle is also listed; if not installed it shows as not-installed.
    expect(bundles.filter((b) => b.capability === 'synthesize').every((b) => b.state === 'not-installed')).toBe(true);
    expect(await client.request('jobs.list', {})).toEqual({ jobs: [] });
    const missing = await client.request('jobs.inspect', { jobId: 'job_nope' }).catch((e: unknown) => e);
    expect(missing).toBeInstanceOf(RpcError);
    expect(missing).toMatchObject({ code: 'not-found' });
    const invalid = await client.request('models.transcribe', { videoId: 'mov_1', assetId: 'ast_1', track: -1 }).catch((e: unknown) => e);
    expect(invalid).toMatchObject({ code: 'invalid-request' });
  });
});

describe.skipIf(!engine || !ffmpeg)('transcription (real engine + fake Model Worker)', () => {
  let fixtures: string;
  let audio: string;
  let dir: string;
  let runtime: RunningRuntime;
  let client: CucCutClient;
  let project: Project;

  beforeAll(async () => {
    fixtures = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-fixtures-'));
    audio = path.join(fixtures, 'voice.wav');
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=3', '-ar', '16000', '-ac', '1', audio]);
  });

  afterAll(async () => {
    await fs.rm(fixtures, { recursive: true, force: true });
  });

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-test-'));
    const home = resolveRuntimeHome({ CUCCUT_HOME: dir });
    await installSyntheticModels(home.modelsDir);
    runtime = await startRuntime({
      home,
      drivers: () => [],
      watchSpace: false,
      engineHost: engine,
      videoGraceMs: 100,
      modelWorker: { command: process.execPath, args: [FAKE_MODEL_WORKER] },
      jobIdleMs: 60_000,
    });
    const { endpoint, token } = runtime.discovery;
    client = new CucCutClient({
      resolve: async () => ({ endpoint, token }),
      client: { kind: 'desktop', name: 'test', version: '0' },
      reconnect: false,
    });
    await client.connect();
    ({ project } = await client.request('projects.create', { name: '转写测试' }));
  });

  afterEach(async () => {
    client.close();
    await runtime.close();
    await fs.rm(dir, { recursive: true, force: true });
  });

  async function videoWithAudio() {
    const opened = await client.request('videos.create', { projectId: project.id });
    const videoId = opened.ref.videoId;
    const imported = await client.request('edits.apply', {
      videoId,
      commandId: newId('cmd'),
      expectedRevision: opened.snapshot.video.revision,
      operations: [{ type: 'importAsset', path: audio, ref: 'voice' }],
    });
    return { videoId, assetId: imported.receipt.refs!.voice! };
  }

  it('transcribe a recording: task topic goes from queued to done, the video gains one speech document written by system', async () => {
    let jobs: JobsSnapshot | null = null;
    const live: Array<{ from: number; texts: string[] }> = [];
    client.subscribeJobs({
      snapshot: (snapshot) => (jobs = snapshot),
      event: (event) => {
        if (event.type === 'job.segments') live.push({ from: event.from, texts: event.segments.map((s) => s.text) });
        jobs = applyJobsEvent(jobs!, event);
      },
    });
    await until(() => jobs);
    expect(jobs!.jobs).toEqual([]);

    const bundleOf = async () => (await client.request('models.list', {})).bundles.find((b) => b.bundleId === DEFAULT_TRANSCRIBE_BUNDLE);
    expect(await bundleOf()).toMatchObject({ state: 'installed' });
    const { videoId, assetId } = await videoWithAudio();
    const { jobId } = await client.request('models.transcribe', { videoId, assetId, commandId: 'cmd_transcribe_1' });
    expect(await client.request('models.transcribe', { videoId, assetId, commandId: 'cmd_transcribe_1' })).toEqual({ jobId });

    const done = await until(() => jobs!.jobs.find((j) => j.jobId === jobId && j.state === 'completed'));
    expect(done).toMatchObject({
      kind: 'transcribe',
      videoId,
      assetId,
      bundleId: DEFAULT_TRANSCRIBE_BUNDLE,
      providerId: 'local',
      attempt: 1,
      error: null,
      submitter: { kind: 'connection' },
      result: { documentId: expect.any(String), artifactId: expect.stringMatching(/^sha256:/) },
    });
    expect(await client.request('jobs.inspect', { jobId })).toEqual(done);
    // Segments recognized midway arrive through `job.segments`; after the task ends they are no longer in the mirror.
    expect(live).toEqual([
      { from: 0, texts: ['testing one two'] },
      { from: 1, texts: ['three cuccut is'] },
      { from: 2, texts: ['ready'] },
    ]);
    expect(jobs!).not.toHaveProperty('liveSegments');
    expect((await client.request('jobs.list', { videoId })).jobs.map((j) => j.jobId)).toEqual([jobId]);
    expect(await client.request('jobs.cancel', { jobId })).toEqual({ state: 'completed' });

    const content = await client.request('documents.read', { videoId, documentId: done.result!.documentId! });
    expect(content.document).toMatchObject({ kind: 'speech', name: '转写', language: 'en', sourceAssetId: assetId });
    expect(content.document.extensions).toMatchObject({ jobId, asrOutcome: 'transcribed', inputHash: done.inputHash });
    const body = content.body as { schema: string; words: Array<{ text: string }>; engine: Record<string, unknown> };
    expect(body.schema).toBe('cuccut.speech/1');
    expect(body.engine).toMatchObject({
      provider: 'local',
      bundleId: DEFAULT_TRANSCRIBE_BUNDLE,
      backend: 'mlx',
      workerVersion: '0.0.0-fake',
    });
    expect(body.words.map((w) => w.text).join(' ')).toBe('testing one two three cuccut is ready');

    const { entries } = await client.request('videos.history', { videoId });
    expect(entries[0]).toMatchObject({ actor: { kind: 'system', id: 'system:jobs' } });
    expect((await bundleOf())!.state).toBe('ready');

    // Submitting the same input again creates a new task (the previous one has already ended). P0 does not replace an existing speech document (it may have manual edits, architecture design §7.3); it adds a new one instead.
    const again = await client.request('models.transcribe', { videoId, assetId });
    expect(again.jobId).not.toBe(jobId);
    const second = await until(() => jobs!.jobs.find((j) => j.jobId === again.jobId && j.state === 'completed'));
    expect(second.result!.documentId).not.toBe(done.result!.documentId);
    const content2 = await client.request('documents.read', { videoId, documentId: second.result!.documentId! });
    expect(content2.document).toMatchObject({ kind: 'speech', sourceAssetId: assetId });
  });

  it('closing the video while a task is running: the task holds the video, it only truly closes after completion', async () => {
    const { videoId, assetId } = await videoWithAudio();
    const { jobId } = await client.request('models.transcribe', { videoId, assetId });
    expect(await client.request('videos.close', { videoId })).toEqual({ closed: false });
    const job = await until(async () => {
      const record = await client.request('jobs.inspect', { jobId });
      return record.state === 'completed' ? record : null;
    });
    expect(job.result!.documentId).toEqual(expect.any(String));
    await until(() => !runtime.videos.ref(videoId), 2000);
  });
});
