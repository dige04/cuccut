import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CucCutClient, applyJobsEvent } from '@cuccut/client';
import { speechSentences } from '@cuccut/editor-wasm';
import { FAKE_MODEL_WORKER } from '@cuccut/jobs';
import { BUNDLES, MODELS_ENDPOINT_ENV } from '@cuccut/models';
import { serveRepo, startFakeModelSource, syntheticBytes, syntheticManifest, type FakeModelSource } from '@cuccut/models/testing';
import { newId, type Id, type JobRecord, type JobsSnapshot, type SpeakersSummary } from '@cuccut/protocol';
import { resolveRuntimeHome } from '@cuccut/runtime-storage';
import { resolveEngineHostCommand } from '../videos/engine-host.ts';
import { startRuntime, type RunningRuntime } from '../runtime.ts';

/**
 * Speaker identification (architecture design §6.6) end to end through the gateway: a video in a real engine; the speaker-diarization model pack is installed from a fake model source, and diarization runs in a fake Model Worker (the first half of the words belongs to one person, the second half to another). The pipeline only gives a proposal and does not change the video. `edits.applySpeakers` writes the transcript and the re-split translation in one transaction; `edits.undo` restores them. Applying is rejected if the transcript was edited after identification.
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
if (!engine || !ffmpeg) console.warn('跳过识别说话人的端到端测试：没有构建 engine-host 或没有 ffmpeg');

const appleSilicon = process.platform === 'darwin' && process.arch === 'arm64';
const PACK = BUNDLES.find((b) => b.capability === 'diarize' && b.backend === (appleSilicon ? 'mlx' : 'candle'))!;
const repos = [PACK.components.segmentation!, PACK.components.speaker!].map((source, index) => ({
  repo: source.repo,
  revision: source.revision,
  files: { 'config.json': Buffer.from(`{"synthetic":${index}}`), 'model.safetensors': syntheticBytes(20_000, 7 + index) },
}));

async function until<T>(read: () => T | undefined | null | false | Promise<T | undefined | null | false>, timeoutMs = 30_000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await read();
    if (value) return value;
    if (Date.now() > deadline) throw new Error('等待超时');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

/** Two sentences (“Hello there, how are you?” “Fine.”), both by speaker a. The fake Worker gives the last three words to someone else (the first three words are long enough to stay with a), so the first sentence gets split. */
const TEXTS = ['Hello', 'there,', 'how', 'are', 'you?', 'Fine.'];
const speech = {
  schema: 'cuccut.speech/1',
  clock: 'source-asset',
  timescale: 1000,
  engine: null,
  createdAt: null,
  speakers: [{ id: 'a', name: '说话人 1' }],
  words: TEXTS.map((text, i) => ({ id: `w${i}`, text, start: i * 500, end: i * 500 + (i < 3 ? 450 : 300), speaker: 'a' })),
  sentences: null,
  chapters: [],
};

function translationBody(speechId: Id, sequenceId: Id) {
  const { sentences, editViewHash } = speechSentences(speech);
  return {
    schema: 'cuccut.translation/2',
    language: 'zh-Hans',
    sourceBasis: { speechRef: { id: speechId, revision: '1' }, sequenceId, scopeLineage: [], editViewHash },
    units: sentences.map((s, i) => ({
      id: `t-${s.id}`,
      sourceSentenceId: s.id,
      sourceFingerprint: s.fingerprint,
      naturalText: ['你好，你最近怎么样？', '还好。'][i],
      alignment: null,
      status: 'reviewed',
    })),
  };
}

describe.skipIf(!engine || !ffmpeg)('识别说话人（真实引擎 + 假 Model Worker）', () => {
  let dir: string;
  let runtime: RunningRuntime;
  let client: CucCutClient;
  let models: FakeModelSource;
  let jobs: JobsSnapshot | null;

  beforeEach(async () => {
    models = await startFakeModelSource();
    for (const repo of repos) serveRepo(models, repo);
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-speakers-e2e-'));
    const control = path.join(dir, 'fake-worker-control.json');
    await fs.writeFile(control, JSON.stringify({ capabilities: ['diarize'] }));
    runtime = await startRuntime({
      home: resolveRuntimeHome({ CUCCUT_HOME: dir }),
      drivers: () => [],
      watchSpace: false,
      engineHost: engine,
      videoGraceMs: 100,
      modelWorker: { command: process.execPath, args: [FAKE_MODEL_WORKER, '--control', control] },
      jobIdleMs: 60_000,
      modelInstall: {
        env: { [MODELS_ENDPOINT_ENV]: models.endpoint },
        installer: { manifests: repos.map((r) => syntheticManifest(r)), freeBytes: async () => null, backoffMs: () => 5 },
      },
    });
    const { endpoint, token } = runtime.discovery;
    client = new CucCutClient({
      resolve: async () => ({ endpoint, token }),
      client: { kind: 'desktop', name: 'test', version: '0' },
      reconnect: false,
    });
    await client.connect();
    jobs = null;
    client.subscribeJobs({
      snapshot: (snapshot) => {
        jobs = snapshot;
      },
      event: (event) => {
        jobs = applyJobsEvent(jobs!, event);
      },
    });
    await until(() => jobs);
  });

  afterEach(async () => {
    client.close();
    await runtime.close();
    await models.close();
    await fs.rm(dir, { recursive: true, force: true });
  });

  async function settled(jobId: string): Promise<JobRecord> {
    return until(() => jobs!.jobs.find((j) => j.jobId === jobId && ['completed', 'failed', 'cancelled', 'interrupted'].includes(j.state)));
  }

  async function videoWithSpeech() {
    const { project } = await client.request('projects.create', { name: '说话人' });
    const audio = path.join(project.path, 'media', 'a.wav');
    await fs.mkdir(path.dirname(audio), { recursive: true });
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=4', '-ar', '16000', '-ac', '1', audio]);
    const opened = await client.request('videos.create', { projectId: project.id, name: '说话人' });
    const videoId = opened.ref.videoId;
    const sequenceId = opened.snapshot.video.rootSequenceId;
    const first = await client.request('edits.apply', {
      videoId,
      commandId: newId('cmd'),
      expectedRevision: opened.snapshot.video.revision,
      operations: [
        { type: 'importAsset', path: audio, ref: 'a' },
        { type: 'addItem', sequenceId, asset: { ref: 'a' }, at: { unit: 'seconds', value: '0' }, alignment: 'nearest-frame' },
        { type: 'putDocument', ref: 'speech', kind: 'speech', name: '转写', language: 'en', sourceAsset: { ref: 'a' }, body: speech },
      ],
    });
    const speechId = first.receipt.refs!.speech!;
    const second = await client.request('edits.apply', {
      videoId,
      commandId: newId('cmd'),
      expectedRevision: first.receipt.videoRevision,
      operations: [
        {
          type: 'putDocument',
          ref: 'tr',
          kind: 'translation',
          name: '中文',
          language: 'zh-Hans',
          sourceDocument: { documentId: speechId },
          body: translationBody(speechId, sequenceId),
          summary: { unitCount: 2, sourceRevision: '1' },
        },
      ],
    });
    return { videoId, speechId, translationId: second.receipt.refs!.tr! };
  }

  async function installPack(): Promise<void> {
    const { plan } = await client.request('models.install', { bundleId: PACK.bundleId });
    const { jobId } = await client.request('models.install', { bundleId: PACK.bundleId, confirmBytes: plan.confirmBytes });
    expect((await settled(jobId!)).state).toBe('completed');
  }

  const docOf = async (videoId: Id, documentId: Id) =>
    (await client.request('documents.read', { videoId, documentId })) as { revision: string; body: any };

  it('没装模型包时启动即拒绝（MODEL_UNAVAILABLE，带模型包状态），不建任务', async () => {
    const { videoId } = await videoWithSpeech();
    const error = await client.request('pipelines.start', { pipeline: 'speakers', params: { videoId } }).catch((e: unknown) => e);
    expect(error).toMatchObject({ code: 'conflict', details: { code: 'MODEL_UNAVAILABLE', bundle: { bundleId: PACK.bundleId } } });
    const listed = await client.request('models.list', {});
    expect(listed.bundles.find((b) => b.bundleId === PACK.bundleId)?.estimatedBytes).toBeGreaterThan(0);
  });

  it('识别给出提案、不改视频；应用一笔事务写转写与重切的译文（改过的名字），撤销还原；识别之后改过转写时拒绝应用', async () => {
    const { videoId, speechId, translationId } = await videoWithSpeech();
    await installPack();
    const before = await client.request('videos.history', { videoId });
    const { jobId } = await client.request('pipelines.start', { pipeline: 'speakers', params: { videoId } });
    const job = await settled(jobId);
    expect(job.state, JSON.stringify(job.error)).toBe('completed');
    const summary = job.pipeline!.summary as unknown as SpeakersSummary;
    expect(summary).toMatchObject({
      videoId,
      source: { documentId: speechId, revision: '1' },
      relabeled: 3,
      translationsSplit: 1,
      skippedTranslations: 0,
      bundleId: PACK.bundleId,
    });
    expect(summary.speakers.map((s) => [s.id, s.name, s.isNew])).toEqual([
      ['a', '说话人 1', false],
      ['spk-2', '说话人 2', true],
    ]);
    // Identification itself does not write to the video.
    expect((await client.request('videos.history', { videoId })).entries.length).toBe(before.entries.length);

    const { receipt } = await client.request('edits.applySpeakers', {
      videoId,
      jobId,
      commandId: newId('cmd'),
      names: { 'spk-2': '嘉宾' },
    });
    expect(receipt.undo.available).toBe(true);
    const applied = await docOf(videoId, speechId);
    expect(applied.revision).toBe('2');
    expect(applied.body.speakers).toEqual([
      { id: 'a', name: '说话人 1' },
      { id: 'spk-2', name: '嘉宾' },
    ]);
    expect(applied.body.words.map((w: { speaker: string }) => w.speaker)).toEqual(['a', 'a', 'a', 'spk-2', 'spk-2', 'spk-2']);
    const translated = await docOf(videoId, translationId);
    expect(translated.revision).toBe('2');
    expect(translated.body.units).toHaveLength(3);

    // Already applied once: the transcript is a new version, so applying the same proposal again is rejected with STALE_JOB_INPUT.
    const stale = await client.request('edits.applySpeakers', { videoId, jobId, commandId: newId('cmd') }).catch((e: unknown) => e);
    expect(stale).toMatchObject({ code: 'conflict', details: { code: 'STALE_JOB_INPUT' } });

    const undone = await client.request('edits.undo', { videoId, commandId: newId('cmd'), target: { transaction: receipt.transactionId } });
    expect((await docOf(videoId, speechId)).revision).toBe('1');
    expect((await docOf(videoId, translationId)).revision).toBe('1');

    // Undo the undo (redo): both documents go back to the post-apply content.
    await client.request('edits.undo', { videoId, commandId: newId('cmd'), target: { transaction: undone.receipt.transactionId } });
    const redone = await docOf(videoId, speechId);
    expect(redone.body.words.map((w: { speaker: string }) => w.speaker)).toEqual(['a', 'a', 'a', 'spk-2', 'spk-2', 'spk-2']);
    expect((await docOf(videoId, translationId)).body.units).toHaveLength(3);
  });

  it('不是识别说话人的任务、或不属于这个视频时 invalid-request', async () => {
    const { videoId } = await videoWithSpeech();
    await installPack();
    const install = jobs!.jobs.find((j) => j.kind !== 'pipeline')!;
    const error = await client
      .request('edits.applySpeakers', { videoId, jobId: install.jobId, commandId: newId('cmd') })
      .catch((e: unknown) => e);
    expect(error).toMatchObject({ code: 'invalid-request' });
  });
});
