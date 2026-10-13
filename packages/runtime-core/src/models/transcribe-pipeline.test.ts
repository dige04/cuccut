import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CucCutClient } from '@cuccut/client';
import { existingCaptionLayer, fakeSpeechAnswer, resolveSpeechWorkerCommand } from '@cuccut/jobs';
import {
  chatCompletionReply,
  openAiTranscriptionReply,
  startFakeProviderServer,
  type FakeHandler,
  type FakeProviderServer,
} from '@cuccut/providers/testing';
import {
  grantCreateParamsFor,
  newId,
  type CaptionItem,
  type GrantRequestItem,
  type Id,
  type JobRecord,
  type Project,
  type TranscribeSummary,
  type TranslateSummary,
  type VideoSnapshot,
} from '@cuccut/protocol';
import { resolveRuntimeHome } from '@cuccut/runtime-storage';
import { until } from '../agent-tools/testing/fake-agent.ts';
import { startRuntime, type RunningRuntime } from '../runtime.ts';
import { resolveEngineHostCommand } from '../videos/engine-host.ts';
import { pipelineTargets } from '../videos/pipeline-targets.ts';

/**
 * The transcription pipeline and the subtitle layer of translation (architecture design §7.9) end to end through the gateway, with a real engine and a fake online transcription and text model (a fake OpenAI on a loopback address):
 *
 * - `target.create.media`: a small locally generated audio file → a new video created in the project, the material placed on the timeline, one transcript, one caption layer. Space records the source.
 * - `entryId` points to a video that is not open, and this material already has a transcript: by default, a new video is created in the same project (linked to the same material file); the original video is untouched.
 * - `destination: 'replace'`: one transaction swaps in a new version of the transcript; translations carry over and captions are re-split. Undoing that transaction returns to the old transcript; it is rejected if the transcript has been edited.
 * - Translation (real Speech Worker): with `captions: true` it is created, and the caption cues are the ones the Worker split. Only the translation is shown (the paired source caption layer is removed). Undoing that transaction removes the caption layer while the translation stays. In bilingual mode the layers share a style and the source comes back. Pipeline parameter defaults do not create it.
 *
 * The keys are made-up strings in the test. Skipped when engine-host, speech-worker or ffmpeg is missing.
 */

const engine = resolveEngineHostCommand();
const speechWorker = resolveSpeechWorkerCommand(engine);
const hasFfmpeg = (() => {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
    execFileSync('ffprobe', ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();
if (!engine) console.warn('跳过转录流程的端到端测试：没有构建 engine-host（npm run build:engine）');

const OPENAI_KEY = 'sk-test-ONLY-FOR-TESTS-transcribe-0123456789';

/** Fake OpenAI: transcription returns “hello world.”; translation answers according to the Speech Worker's request (`fakeSpeechAnswer`). */
function fakeOpenAi(): FakeHandler {
  return (request) => {
    if (request.method === 'GET' && request.path.endsWith('/models')) return { status: 200, json: { object: 'list', data: [] } };
    if (request.method === 'POST' && request.path.endsWith('/audio/transcriptions'))
      return openAiTranscriptionReply(request, 'hello world.');
    if (request.method === 'POST' && request.path.endsWith('/chat/completions')) {
      const messages = (request.json as { messages: Array<{ role: string; content: string }> }).messages;
      const user = messages.find((m) => m.role === 'user')!.content;
      return chatCompletionReply(
        request,
        fakeSpeechAnswer(user, () => '你好世界'),
      );
    }
    return { status: 404, json: { error: { message: 'not found' } } };
  };
}

describe.skipIf(!engine || !speechWorker || !hasFfmpeg)('转录流程与字幕层（真实引擎）', () => {
  let dir: string;
  let runtime: RunningRuntime;
  let client: CucCutClient;
  let project: Project;
  let openai: FakeProviderServer;
  let media: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-transcribe-pipeline-'));
    media = path.join(dir, 'media', '采访 片段.wav');
    await fs.mkdir(path.dirname(media));
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2', '-ar', '16000', '-ac', '1', media]);
    openai = await startFakeProviderServer(fakeOpenAi());
    runtime = await startRuntime({
      home: resolveRuntimeHome({ CUCCUT_HOME: path.join(dir, 'home') }),
      drivers: () => [],
      watchSpace: false,
      engineHost: engine,
      videoGraceMs: 100,
      modelWorker: null,
      jobIdleMs: 60_000,
      initiator: { discoverer: null },
      nodes: { host: '127.0.0.1', advertiser: null },
      online: { baseUrls: { openai: `${openai.origin}/v1` }, http: { backoffMs: () => 10 } },
    });
    const { endpoint, token } = runtime.discovery;
    client = new CucCutClient({
      resolve: async () => ({ endpoint, token }),
      client: { kind: 'desktop', name: 'test', version: '0' },
      reconnect: false,
    });
    await client.connect();
    ({ project } = await client.request('projects.create', { name: '转录' }));
    await client.request('models.configure', { providerId: 'openai', enabled: true, credential: OPENAI_KEY });
    await client.request('models.setDefault', { capability: 'transcribe', providerId: 'openai' });
    await client.request('models.setDefault', { capability: 'generateText', providerId: 'openai' });
  });

  afterEach(async () => {
    client.close();
    await runtime.close();
    await openai.close();
    await fs.rm(dir, { recursive: true, force: true });
  });

  async function settled(jobId: string): Promise<JobRecord> {
    await runtime.models.jobs.settled(jobId);
    await runtime.models.pipelines.idle();
    return runtime.models.jobs.inspect(jobId);
  }

  const start = (pipeline: string, params: Record<string, unknown>) => client.request('pipelines.start', { pipeline, params });

  /** Opens the video (attaches if it is already open), and reads the snapshot. */
  async function snapshot(videoId: Id, relPath: string): Promise<VideoSnapshot> {
    const opened = await client.request('videos.open', { projectId: project.id, path: relPath });
    expect(opened.ref.videoId).toBe(videoId);
    return opened.snapshot.video;
  }

  const captions = (video: VideoSnapshot) =>
    video.sequences[video.rootSequenceId]!.items.filter((item): item is CaptionItem => item.type === 'caption');

  it('从本机媒体新建视频：导入、放上时间线、转写、建字幕层；再转写另建视频；翻译建目标语言字幕层；取代文稿结转译文', async () => {
    // 1. Create a new video.
    const created = await start('transcribe', { target: { create: { projectId: project.id, media } } });
    const first = await settled(created.jobId);
    expect(first).toMatchObject({ state: 'completed', providerId: 'openai', pipeline: { stoppedAt: null } });
    expect(first.pipeline!.steps.map((s) => [s.name, s.status])).toEqual([
      ['target', 'skipped'],
      ['create', 'completed'],
      ['transcribe', 'completed'],
      ['captions', 'completed'],
    ]);
    const summary = first.pipeline!.summary as unknown as TranscribeSummary;
    expect(summary).toMatchObject({
      createdVideo: true,
      target: 'first',
      providerId: 'openai',
      captions: { status: 'created', enabled: true, cueCount: 1 },
    });
    const videoId = summary.videoId;
    // Transcription is a transcribe Job submitted by the pipeline.
    expect(runtime.models.jobs.inspect(summary.transcribeJobId)).toMatchObject({
      kind: 'transcribe',
      state: 'completed',
      submitter: { kind: 'pipeline', id: created.jobId },
    });
    await until(() => runtime.videos.ref(videoId) === null);
    const dirs = (await fs.readdir(project.path)).filter((n) => !n.startsWith('.'));
    expect(dirs).toEqual(['采访 片段']);

    let video = await snapshot(videoId, '采访 片段');
    const asset = video.assets[summary.assetId]!;
    expect(asset.revisions[asset.currentRevision]).toMatchObject({ storage: { mode: 'linked', locator: { path: media } } });
    expect(JSON.stringify(asset)).toContain('file-import');
    const root = video.sequences[video.rootSequenceId]!;
    expect(root.items.find((i) => i.type === 'audio')).toMatchObject({ assetRef: { id: summary.assetId }, fromFrame: 0 });
    const speech = video.documents[summary.documentId]!;
    expect(speech).toMatchObject({ kind: 'speech', sourceAssetId: summary.assetId });
    const [layer] = captions(video);
    expect(layer).toMatchObject({ documentId: summary.captions.documentId, enabled: true });
    const captionDoc = video.documents[layer!.documentId]!;
    expect(captionDoc).toMatchObject({ kind: 'caption', sourceDocumentId: summary.documentId, sourceAssetId: summary.assetId });
    expect(captionDoc.extensions).toMatchObject({ pipeline: { name: 'transcribe', jobId: created.jobId, actor: 'system:pipeline' } });
    // The same transcript already has a caption layer: rerunning this step is skipped (the same check `when` uses).
    expect(existingCaptionLayer(root, video.documents, summary.documentId)).toMatchObject({ documentId: layer!.documentId });
    const history = await client.request('videos.history', { videoId });
    expect(history.entries[0]).toMatchObject({ actor: { kind: 'system', id: 'system:pipeline' } });
    // The summary carries the transaction that created the caption layer (the editor's “undo” undoes it).
    expect(history.entries.find((e) => e.transactionId === summary.captions.transactionId)).toMatchObject({
      label: '建立字幕层',
      actor: { kind: 'system', id: 'system:pipeline' },
      undoAvailable: true,
    });
    await client.request('videos.close', { videoId });
    await until(() => runtime.videos.ref(videoId) === null);

    // Space: the video entry's source is this run.
    await client.request('space.rescan', {});
    await runtime.space.idle();
    const entry = (await client.request('space.list', { videoId, kind: 'video' })).entries[0]!;
    expect(entry.origin).toMatchObject({
      source: 'imported',
      projectId: project.id,
      videoId,
      jobId: created.jobId,
      capability: 'transcribe',
    });

    // 2. Transcribe again by entry (video not open): this material already has a transcript, so by default a new video is created that links the same material file. The original video is untouched.
    const again = await start('transcribe', { target: { entryId: entry.id } });
    const second = await settled(again.jobId);
    expect(second.state, JSON.stringify(second.error)).toBe('completed');
    const secondSummary = second.pipeline!.summary as unknown as TranscribeSummary;
    expect(secondSummary).toMatchObject({
      createdVideo: true,
      target: 'new-video',
      replaced: null,
      captions: { status: 'created', enabled: true },
    });
    expect(secondSummary.videoId).not.toBe(videoId);
    expect(secondSummary.newVideo).toMatchObject({ videoId: secondSummary.videoId, name: expect.stringContaining('采访 片段') });
    await until(() => runtime.videos.ref(secondSummary.videoId) === null);
    expect((await fs.readdir(project.path)).filter((n) => !n.startsWith('.'))).toHaveLength(2);
    video = await snapshot(videoId, '采访 片段');
    expect(Object.values(video.documents).filter((d) => d.kind === 'speech')).toHaveLength(1);
    expect(captions(video)).toHaveLength(1);

    // 3. Translate the first transcript: by default only the translation is shown, and the paired source caption layer is removed (not deleted).
    const translated = await settled(
      (await start('translate', { videoId, documentId: summary.documentId, targetLanguage: 'zh-Hans', captions: true })).jobId,
    );
    expect(translated).toMatchObject({ state: 'completed' });
    expect(translated.pipeline!.steps.at(-1)).toMatchObject({ name: 'captions', status: 'completed' });
    const tr = translated.pipeline!.summary as unknown as TranslateSummary;
    expect(tr.captions).toMatchObject({ status: 'created', enabled: true, bilingual: false });
    video = (await client.request('videos.open', { projectId: project.id, path: '采访 片段' })).snapshot.video;
    const afterTranslate = captions(video);
    const trLayer = afterTranslate.find((c) => video.documents[c.documentId]!.sourceDocumentId === tr.documentId)!;
    expect(trLayer.enabled).toBe(true);
    expect(video.documents[trLayer.documentId]).toMatchObject({ kind: 'caption', language: 'zh-Hans' });
    expect(afterTranslate.find((c) => c.id === layer!.id)!.enabled).toBe(false);
    const trTrack = video.sequences[video.rootSequenceId]!.tracks.find((t) => t.id === trLayer.trackId)!;
    expect(trTrack).toMatchObject({ kind: 'subtitle' });
    // The caption cues are the ones the Speech Worker split: the transcription's timing, with the ID q-<translation unit>.
    const trCaption = await client.request('documents.read', { videoId, documentId: trLayer.documentId });
    const trBody = trCaption.body as { timescale: number; cues: Array<{ id: string; text: string; start: number; end: number }> };
    const speechBody = (await client.request('documents.read', { videoId, documentId: summary.documentId })).body as { timescale: number };
    expect(trBody.timescale).toBe(speechBody.timescale);
    expect(trBody.cues.length).toBeGreaterThan(0);
    expect(trBody.cues.every((cue) => cue.id.startsWith('q-t-s-') && cue.text === '你好世界' && Number.isInteger(cue.start))).toBe(true);

    // Undo the transaction that created the caption layer: the caption layer is gone, the paired source caption layer comes back, and the translation document remains.
    const trHistory = await client.request('videos.history', { videoId });
    expect(trHistory.entries.find((e) => e.transactionId === tr.captions!.transactionId)).toMatchObject({
      label: '建立字幕层',
      actor: { kind: 'system', id: 'system:pipeline' },
      undoAvailable: true,
    });
    await client.request('edits.undo', { videoId, commandId: newId('cmd'), target: { transaction: tr.captions!.transactionId! } });
    video = (await client.request('videos.open', { projectId: project.id, path: '采访 片段' })).snapshot.video;
    expect(captions(video).some((c) => c.documentId === trLayer.documentId)).toBe(false);
    expect(captions(video).find((c) => c.id === layer!.id)!.enabled).toBe(true);
    expect(video.documents[tr.documentId]).toMatchObject({ kind: 'translation' });

    // 4. Bilingual: the new translation layer shares one style with the source, and the source comes back.
    const bilingual = await settled(
      (await start('translate', { videoId, documentId: summary.documentId, targetLanguage: 'zh-Hans', captions: true, bilingual: true }))
        .jobId,
    );
    const bi = bilingual.pipeline!.summary as unknown as TranslateSummary;
    expect(bi.captions).toMatchObject({ status: 'created', bilingual: true });
    video = (await client.request('videos.open', { projectId: project.id, path: '采访 片段' })).snapshot.video;
    const original = captions(video).find((c) => c.id === layer!.id)!;
    const biLayer = captions(video).find((c) => video.documents[c.documentId]!.sourceDocumentId === bi.documentId)!;
    expect(original.enabled).toBe(true);
    expect(original.styleDocumentId).toBeDefined();
    expect(biLayer.styleDocumentId).toBe(original.styleDocumentId);

    // 5. No captions (the pipeline parameter default): only the translation is written; no caption layer is created.
    const before = captions(video).length;
    const plain = await settled((await start('translate', { videoId, documentId: summary.documentId, targetLanguage: 'zh-Hans' })).jobId);
    expect(plain.pipeline!.steps.at(-1)).toMatchObject({ name: 'captions', status: 'skipped' });
    expect((plain.pipeline!.summary as unknown as TranslateSummary).captions).toMatchObject({ status: 'disabled' });
    video = (await client.request('videos.open', { projectId: project.id, path: '采访 片段' })).snapshot.video;
    expect(captions(video)).toHaveLength(before);

    // 6. Replace the current transcript: one transaction writes a new version of the same transcript. The three translations carry over (the source is unchanged and their state is kept), and the derived captions are re-split.
    const oldSpeech = (await client.request('documents.read', { videoId, documentId: summary.documentId })) as {
      revision: string;
      body: { words: Array<{ id: string }>; stages?: { asr?: string } };
    };
    expect(oldSpeech.body.stages?.asr).toMatch(/^\d+:/);
    const replaced = await settled((await start('transcribe', { videoId, destination: 'replace' })).jobId);
    expect(replaced.state, JSON.stringify(replaced.error)).toBe('completed');
    const rs = replaced.pipeline!.summary as unknown as TranscribeSummary;
    expect(rs).toMatchObject({
      videoId,
      createdVideo: false,
      documentId: summary.documentId,
      target: 'replace',
      newVideo: null,
      replaced: { documentId: summary.documentId, previousVersion: oldSpeech.revision },
      captionPins: { reanchored: 0, orphaned: 0 },
      dubs: [],
    });
    expect(rs.replaced!.transactionId).toEqual(expect.any(String));
    const translationIds = Object.values(video.documents)
      .filter((d) => d.kind === 'translation')
      .map((d) => d.id)
      .sort();
    expect(rs.translations.map((t) => t.documentId).sort()).toEqual(translationIds);
    expect(rs.translations.every((t) => t.kept === 1 && t.stale === 0 && t.unmatched === 0)).toBe(true);
    video = (await client.request('videos.open', { projectId: project.id, path: '采访 片段' })).snapshot.video;
    expect(Object.values(video.documents).filter((d) => d.kind === 'speech')).toHaveLength(1);
    const newSpeech = (await client.request('documents.read', { videoId, documentId: summary.documentId })) as typeof oldSpeech;
    expect(newSpeech.revision).not.toBe(oldSpeech.revision);
    expect(newSpeech.body.words.map((w) => w.id)).not.toEqual(oldSpeech.body.words.map((w) => w.id));
    for (const id of translationIds) {
      const tr = (await client.request('documents.read', { videoId, documentId: id })).body as {
        sourceBasis: { speechRef: { revision: string } };
        units: Array<{ sourceSentenceId: string; status: string }>;
      };
      expect(tr.sourceBasis.speechRef.revision).toBe(newSpeech.revision);
      expect(tr.units.map((u) => u.sourceSentenceId)).toEqual([`s-${newSpeech.body.words[0]!.id}`]);
    }
    const replacedHistory = await client.request('videos.history', { videoId });
    expect(replacedHistory.entries.find((e) => e.transactionId === rs.replaced!.transactionId)).toMatchObject({ undoAvailable: true });

    // Undo that transaction: the transcript goes back to the old version.
    await client.request('edits.undo', { videoId, commandId: newId('cmd'), target: { transaction: rs.replaced!.transactionId! } });
    const undone = (await client.request('documents.read', { videoId, documentId: summary.documentId })) as typeof oldSpeech;
    expect(undone.body.words.map((w) => w.id)).toEqual(oldSpeech.body.words.map((w) => w.id));

    // 7. Edited transcript (the full-text fingerprint no longer matches stages.asr): replace is rejected with TRANSCRIPT_EDITED and no job is created. With acceptEdited, it proceeds.
    const editedBody = structuredClone(undone.body) as { words: Array<{ id: string; text: string }> };
    editedBody.words[0]!.text = 'Howdy';
    video = (await client.request('videos.open', { projectId: project.id, path: '采访 片段' })).snapshot.video;
    await client.request('edits.apply', {
      videoId,
      commandId: newId('cmd'),
      expectedRevision: video.revision,
      operations: [{ type: 'putDocument', documentId: summary.documentId, kind: 'speech', body: editedBody }],
    });
    const jobsBefore = (await client.request('jobs.list', { children: true })).jobs.length;
    const refused = (await start('transcribe', { videoId, destination: 'replace' }).catch((e: unknown) => e)) as {
      code: string;
      details: Record<string, unknown>;
    };
    expect(refused).toMatchObject({ code: 'conflict', details: { code: 'TRANSCRIPT_EDITED', documentId: summary.documentId } });
    expect((await client.request('jobs.list', { children: true })).jobs).toHaveLength(jobsBefore);
    const accepted = await settled((await start('transcribe', { videoId, destination: 'replace', acceptEdited: true })).jobId);
    expect(accepted.state, JSON.stringify(accepted.error)).toBe('completed');
    expect(accepted.pipeline!.summary).toMatchObject({ target: 'replace' });
    const afterAccept = (await client.request('documents.read', { videoId, documentId: summary.documentId })) as typeof oldSpeech;
    for (const id of translationIds) {
      const tr = (await client.request('documents.read', { videoId, documentId: id })).body as {
        sourceBasis: { speechRef: { revision: string } };
      };
      expect(tr.sourceBasis.speechRef.revision).toBe(afterAccept.revision);
    }
    await client.request('videos.close', { videoId });

    // The key does not go into the job record.
    expect(JSON.stringify(await client.request('jobs.list', { children: true }))).not.toContain(OPENAI_KEY);
  });

  it('新建在「建好、还没记下」之间中断：按占下的位置再新建时认回那个视频，不多建', async () => {
    const targets = pipelineTargets(runtime.videos, {
      entry: () => {
        throw new Error('不按条目');
      },
      projectRoot: () => project.path,
    });
    const place = await targets.reserve({ projectId: project.id, name: '访谈' });
    expect(place).toMatchObject({ file: '访谈', scope: { projectId: project.id } });
    // The reserved directory makes other creations skip it.
    const other = await client.request('videos.create', { projectId: project.id, name: '访谈' });
    expect(other.ref.relPath).toBe('访谈 2');
    await client.request('videos.close', { videoId: other.ref.videoId });

    const first = await targets.create({ projectId: project.id, name: '访谈', commandId: 'job_x:create', place });
    first.release();
    await until(() => runtime.videos.ref(first.videoId) === null);
    // Retry (the command record is gone in the new process): a video already exists at the same location, so claim it.
    const again = await targets.create({ projectId: project.id, name: '访谈', commandId: 'job_x:create:again', place });
    expect(again.videoId).toBe(first.videoId);
    again.release();
    expect((await fs.readdir(project.path)).filter((n) => !n.startsWith('.')).sort()).toEqual(['访谈', '访谈 2']);
    // A location belonging to another project is rejected.
    await expect(targets.create({ projectId: 'prj_other', name: 'x', commandId: 'c', place })).rejects.toMatchObject({
      code: 'invalid-request',
    });
  });

  it('媒体不在、不是绝对路径时拒绝，不新建视频、不建任务', async () => {
    const missing = await start('transcribe', {
      target: { create: { projectId: project.id, media: path.join(dir, 'nope.wav') } },
    }).catch((error: { details?: { code?: string } }) => error.details?.code);
    expect(missing).toBe('INPUT_NOT_FOUND');
    const relative = await start('transcribe', { target: { create: { projectId: project.id, media: 'a.wav' } } }).catch(
      (error: { code?: string }) => error.code,
    );
    expect(relative).toBe('invalid-request');
    expect((await fs.readdir(project.path)).filter((n) => !n.startsWith('.'))).toEqual([]);
    expect(await client.request('jobs.list', { children: true })).toEqual({ jobs: [] });
  });

  it('视频里启用的转写术语表：新建的视频采用库里默认启用的那份，转写 Job 冻结它的版本', async () => {
    const { entry: glossary } = await client.request('library.put', {
      library: 'glossaries',
      content: {
        name: '术语',
        kind: 'transcription',
        language: null,
        defaultEnabled: true,
        terms: [{ canonical: 'CucCut', misheard: [] }],
      },
    });
    const { jobId } = await start('transcribe', { target: { create: { projectId: project.id, media } } });
    const job = await settled(jobId);
    expect(job.state, JSON.stringify(job.error)).toBe('completed');
    const summary = job.pipeline!.summary as unknown as TranscribeSummary;
    expect(runtime.models.jobs.inspect(summary.transcribeJobId).library?.entries).toEqual([
      expect.objectContaining({ library: 'glossaries', id: glossary.id, version: glossary.version }),
    ]);
  });

  it('音频按 audio 授权：撤销默认授权后启动即拒绝，不新建视频；桌面界面带待批准项，批准之后同一个 commandId 重新提交', async () => {
    const byDefault = (await client.request('grants.list', { recipient: 'openai' })).grants.find((g) => g.origin === 'provider-enable')!;
    expect(byDefault.dataKinds).toContain('audio');
    await client.request('grants.revoke', { grantId: byDefault.grantId });
    const before = (await client.request('grants.list', { includeEnded: true })).grants.length;

    const commandId = newId('cmd');
    const begin = () =>
      client.request('pipelines.start', {
        pipeline: 'transcribe',
        params: { target: { create: { projectId: project.id, media } } },
        commandId,
      });
    const refused = (await begin().catch((e: unknown) => e)) as { code: string; details: Record<string, unknown> };
    expect(refused).toMatchObject({
      code: 'forbidden',
      details: { code: 'GRANT_REVOKED', recipient: 'openai', dataKinds: ['audio'], remedy: { action: 'create-grant' } },
    });
    const pending = refused.details.pendingGrants as GrantRequestItem[];
    expect(pending).toEqual([
      expect.objectContaining({
        capability: 'transcribe',
        recipient: 'openai',
        dataKinds: ['audio'],
        videoId: null,
        // The purpose is written by the Runtime with a reference; the UI regenerates it in its own language.
        purposeRef: expect.objectContaining({ key: 'rcGrants.pipelinePurpose' }),
      }),
    ]);
    // A rejection grants no authorization, creates no video, and creates no job.
    expect((await client.request('grants.list', { includeEnded: true })).grants).toHaveLength(before);
    expect((await fs.readdir(project.path)).filter((n) => !n.startsWith('.'))).toEqual([]);
    expect(await client.request('jobs.list', { children: true })).toEqual({ jobs: [] });

    for (const item of pending) await client.request('grants.create', grantCreateParamsFor(item));
    const { jobId } = await begin();
    const job = await settled(jobId);
    expect(job.state, JSON.stringify(job.error)).toBe('completed');
    expect((job.pipeline!.summary as unknown as TranscribeSummary).createdVideo).toBe(true);
  });
});
