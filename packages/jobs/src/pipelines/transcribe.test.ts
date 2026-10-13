import { DEFAULT_CAPTION_STYLE_BODY } from './caption-layer.ts';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RpcError, type DocumentRecord, type EditOperation, type Id, type JobRecord, type JobState, type Sequence } from '@cuccut/protocol';
import type { VideoPlace } from '../application-ledger.ts';
import type { JobManager } from '../job-manager.ts';
import { testJobManager } from '../testing/pipeline-jobs.ts';
import { PipelineRunner } from './pipeline-runner.ts';
import { contentFingerprint } from '../transcript-switch.ts';
import { TRANSCRIBE_PIPELINE, mainTrackAssets, parseTranscribeParams, transcribePipeline } from './transcribe.ts';
import type { PipelineTranscriber } from './video-create.ts';
import type { PipelineTargets, VideoLease } from './video-target.ts';

/**
 * Steps and retries of the transcription flow (architecture design §7.9), using fake video, transcription and targets: if a new video is interrupted between “created” and “not yet recorded”, a retry does not create another;
 * imports are recognized by command, and transcription is recognized by the Job Ledger. The subtitle layer on the real engine is covered by `transcribe-pipeline.test.ts` in runtime-core.
 */

describe('transcription parameters', () => {
  it('videoId or a new-target with media; media must be an absolute path', () => {
    expect(parseTranscribeParams({ videoId: 'v1', captions: false, language: 'en' })).toEqual({
      videoId: 'v1',
      captions: false,
      language: 'en',
    });
    // Recognition hints are trimmed, the same as `models.transcribe`.
    expect(parseTranscribeParams({ videoId: 'v1', hint: ' 播客 ' })).toEqual({ videoId: 'v1', hint: '播客' });
    expect(parseTranscribeParams({ target: { create: { projectId: 'p1', media: '/a/b.mp4' } } })).toEqual({
      create: { projectId: 'p1', media: '/a/b.mp4' },
    });
    for (const bad of [
      {},
      { videoId: 'v1', captions: 'yes' },
      { videoId: 'v1', language: 'english please' },
      { videoId: 'v1', hint: '' },
      { videoId: 'v1', hint: 'x'.repeat(1201) },
      { videoId: 'v1', unknown: 1 },
      { target: { create: { projectId: 'p1' } } },
      { target: { create: { projectId: 'p1', media: 'relative.mp4' } } },
      { videoId: 'v1', target: { create: { projectId: 'p1', media: '/a.mp4' } } },
      { assetId: 'a1', target: { create: { projectId: 'p1', media: '/a.mp4' } } },
      // The destination is given only for an existing video; the name is given only for a new video, and the translation and edit confirmation are given only for replace.
      { destination: 'replace', target: { create: { projectId: 'p1', media: '/a.mp4' } } },
      { videoId: 'v1', destination: 'elsewhere' },
      { videoId: 'v1', destination: 'replace', name: '新名字' },
      { videoId: 'v1', translations: 'discard' },
      { videoId: 'v1', acceptEdited: true },
      { videoId: 'v1', destination: 'replace', translations: 'keep' },
    ]) {
      expect(() => parseTranscribeParams(bad), JSON.stringify(bad)).toThrow(expect.objectContaining({ code: 'invalid-request' }));
    }
  });

  it('placement parameters: when replacing, translations can be carried over or dropped, dropping edits can be confirmed; a new video can be given a name', () => {
    expect(parseTranscribeParams({ videoId: 'v1', destination: 'replace', translations: 'discard', acceptEdited: true })).toEqual({
      videoId: 'v1',
      destination: 'replace',
      translations: 'discard',
      acceptEdited: true,
    });
    expect(parseTranscribeParams({ videoId: 'v1', name: '第二版' })).toEqual({ videoId: 'v1', name: '第二版' });
    expect(parseTranscribeParams({ videoId: 'v1', destination: 'new-video', name: '第二版' })).toEqual({
      videoId: 'v1',
      destination: 'new-video',
      name: '第二版',
    });
  });

  it('main track: the first picture track with an audio-video instance, otherwise an audio track; media deduplicated', () => {
    const seq = (tracks: Array<[string, 'visual' | 'audio', number]>, items: Array<[string, string, 'video' | 'audio', number]>) =>
      ({
        tracks: tracks.map(([id, kind, order]) => ({ id, kind, order })),
        items: items.map(([trackId, asset, type, from]) =>
          type === 'audio'
            ? { type, trackId, assetRef: { id: asset }, fromFrame: from }
            : { type, trackId, assetRef: { id: asset }, span: { fromFrame: from, durationFrames: 10 } },
        ),
      }) as unknown as Sequence;
    expect(
      mainTrackAssets(
        seq(
          [
            ['V2', 'visual', 1],
            ['V1', 'visual', 0],
          ],
          [
            ['V2', 'b', 'video', 0],
            ['V1', 'a', 'video', 5],
            ['V1', 'a', 'video', 0],
          ],
        ),
      ),
    ).toEqual(['a']);
    expect(
      mainTrackAssets(
        seq(
          [
            ['V1', 'visual', 0],
            ['A1', 'audio', 1],
          ],
          [['A1', 'c', 'audio', 0]],
        ),
      ),
    ).toEqual(['c']);
    expect(
      mainTrackAssets(
        seq(
          [['V1', 'visual', 0]],
          [
            ['V1', 'b', 'video', 9],
            ['V1', 'a', 'video', 0],
          ],
        ),
      ),
    ).toEqual(['a', 'b']);
    expect(mainTrackAssets(seq([['V1', 'visual', 0]], []))).toEqual([]);
  });
});

/** Fake video: a document and an instance on the main track; `apply` records the command, and `receipt` recognizes it by command. */
class FakeVideos {
  videos = new Map<Id, { revision: number; documents: Record<Id, DocumentRecord>; items: Array<{ assetId: Id }> }>();
  applied: Array<{ videoId: Id; commandId: Id; operations: EditOperation[] }> = [];
  /** Throws after the next `apply` writes (simulates a submission whose receipt never arrives, then an interruption). */
  crashAfterApply = false;

  add(videoId: Id, items: Array<{ assetId: Id }> = []): void {
    this.videos.set(videoId, { revision: 1, documents: {}, items });
  }

  state(videoId: Id) {
    const video = this.videos.get(videoId);
    return video ? { revision: String(video.revision), rootSequenceId: 'seq', documents: structuredClone(video.documents) } : null;
  }

  rootSequence(videoId: Id): Sequence | null {
    const video = this.videos.get(videoId);
    if (!video) return null;
    return {
      id: 'seq',
      fps: { num: 30, den: 1 },
      tracks: [{ id: 'V1', kind: 'visual', order: 0, locked: false }],
      items: video.items.map((item, i) => ({
        id: `item_${i}`,
        type: 'video',
        trackId: 'V1',
        assetRef: { id: item.assetId },
        span: { fromFrame: i * 100, durationFrames: 100 },
        timeMap: { kind: 'linear', sourceIn: { value: 0, timescale: 1 }, rate: { num: 1, den: 1 } },
        enabled: true,
      })),
    } as unknown as Sequence;
  }

  /** Document body; when none is supplied, a placeholder that cannot be split into sentences is used. */
  bodies = new Map<Id, unknown>();
  async document(_videoId: Id, documentId: Id) {
    return { revision: 'd1', body: this.bodies.get(documentId) ?? { documentId } };
  }

  async apply(videoId: Id, request: { commandId: Id; operations: EditOperation[] }) {
    const video = this.videos.get(videoId)!;
    this.applied.push({ videoId, commandId: request.commandId, operations: request.operations });
    video.revision++;
    const placed = request.operations.some((op) => op.type === 'addItem');
    if (placed) video.items.push({ assetId: 'asset_media' });
    if (this.crashAfterApply) {
      this.crashAfterApply = false;
      throw new Error('连接断了');
    }
    return { refs: { link: 'asset_media' } };
  }

  async receipt(videoId: Id, commandId: Id) {
    return this.applied.some((a) => a.videoId === videoId && a.commandId === commandId) ? { refs: { link: 'asset_media' } } : null;
  }

  putSpeech(videoId: Id, id: Id, jobId: Id, assetId?: Id, speakerCount?: number): void {
    this.videos.get(videoId)!.documents[id] = {
      id,
      kind: 'speech',
      name: '转写',
      language: 'en',
      ...(assetId ? { sourceAssetId: assetId } : {}),
      currentRevision: 'd1',
      revisions: speakerCount === undefined ? {} : { d1: { revision: 'd1', summary: { wordCount: 7, speakerCount } } },
      extensions: { jobId },
    } as unknown as DocumentRecord;
  }
}

/** Fake transcription: on submission (when complete), writes a speech document into the video, just like a real Job; records the entry in the Ledger. */
class FakeTranscriber implements PipelineTranscriber {
  records: JobRecord[] = [];
  submitted: Array<{ commandId?: Id; assetId: Id; videoId: Id; hint?: string; replace?: unknown }> = [];
  outcome: JobState = 'completed';
  /** The speaker count written into the transcript summary; when not given, the document has no version summary. */
  speakerCount: number | undefined = undefined;
  readonly videos: FakeVideos;
  constructor(videos: FakeVideos) {
    this.videos = videos;
  }

  async check(target?: { provider?: string; model?: string }) {
    if (target?.provider === 'missing') throw new RpcError('conflict', '没有配置', { code: 'CAPABILITY_NOT_CONFIGURED' });
    return { providerId: target?.provider ?? 'local', modelId: target?.model ?? 'fake-asr' };
  }

  async submit(request: { videoId: Id; assetId: Id; commandId?: Id; hint?: string; replace?: unknown }, submitter: JobRecord['submitter']) {
    this.submitted.push({
      videoId: request.videoId,
      assetId: request.assetId,
      ...(request.commandId ? { commandId: request.commandId } : {}),
      ...(request.hint ? { hint: request.hint } : {}),
      ...(request.replace ? { replace: request.replace } : {}),
    });
    const jobId = `job_t${this.records.length + 1}`;
    const documentId = `doc_${jobId}`;
    const ok = this.outcome === 'completed';
    if (ok) this.videos.putSpeech(request.videoId, documentId, jobId, request.assetId, this.speakerCount);
    this.records.push({
      jobId,
      kind: 'transcribe',
      state: this.outcome,
      videoId: request.videoId,
      assetId: request.assetId,
      submitter,
      createdAt: new Date(Date.now() + this.records.length).toISOString(),
      result: ok ? { documentId, artifactId: `art_${jobId}` } : null,
      error: ok ? null : { code: 'PROVIDER_UNAVAILABLE', message: '服务不可用' },
    } as unknown as JobRecord);
    return { jobId };
  }

  /** File-only transcription: puts an ASR result into the artifact store, like a completed Job. */
  artifacts: { put(bytes: Uint8Array, extension: 'json'): Promise<{ artifactId: string }> } | null = null;
  files: Array<{ file: string; language?: string; hint?: string }> = [];
  async submitFile(request: { file: string; language?: string; hint?: string }, submitter: JobRecord['submitter']) {
    this.files.push(request);
    const jobId = `job_f${this.records.length + 1}`;
    const asr = { timescale: 1000, language: { tag: 'en' }, segments: [{ start: 0, end: 1500, text: ' Hello ' }] };
    const { artifactId } = await this.artifacts!.put(Buffer.from(JSON.stringify(asr)), 'json');
    this.records.push({
      jobId,
      kind: 'transcribe',
      state: this.outcome,
      videoId: null,
      submitter,
      createdAt: new Date().toISOString(),
      result: { documentId: null, artifactId },
      error: null,
    } as unknown as JobRecord);
    return { jobId };
  }

  async settled(jobId: Id) {
    return this.inspect(jobId).state;
  }

  async cancel(_jobId: Id): Promise<unknown> {
    return {};
  }

  inspect(jobId: Id): JobRecord {
    return this.records.find((r) => r.jobId === jobId)!;
  }

  list(): JobRecord[] {
    return this.records;
  }
}

/** Fake target: on placeholder, really creates an empty directory; on creation, puts a `video.db` marker in the directory, and recognizes it when the marker already exists (counts how many times each happens). */
class FakeTargets implements Pick<PipelineTargets, 'reserve' | 'create' | 'entry' | 'lease'> {
  created = 0;
  reopened = 0;
  leases = 0;
  readonly root: string;
  readonly videos: FakeVideos;
  constructor(root: string, videos: FakeVideos) {
    this.root = root;
    this.videos = videos;
  }

  async entry(): Promise<VideoPlace> {
    throw new Error('不按条目');
  }

  async lease(place: VideoPlace): Promise<VideoLease> {
    return this.#lease(String(place.file), place);
  }

  async reserve(request: { projectId: Id; name: string }): Promise<VideoPlace> {
    for (let n = 1; ; n++) {
      const file = n === 1 ? request.name : `${request.name} ${n}`;
      const made = await fs.mkdir(path.join(this.root, file)).then(
        () => true,
        () => false,
      );
      if (made) return { root: this.root, file, scope: { projectId: request.projectId } };
    }
  }

  async create(request: { projectId: Id; name: string; commandId: Id; place?: VideoPlace }): Promise<VideoLease> {
    const place = request.place!;
    const marker = path.join(String(place.root), String(place.file), 'video.db');
    const existing = await fs.readFile(marker, 'utf8').catch(() => null);
    if (existing) {
      this.reopened++;
      return this.#lease(existing, place);
    }
    this.created++;
    const videoId = `vid_new_${this.created}`;
    await fs.writeFile(marker, videoId);
    this.videos.add(videoId);
    return this.#lease(videoId, place);
  }

  #lease(videoId: Id, place: VideoPlace): VideoLease {
    this.leases++;
    let held = true;
    return {
      videoId,
      place,
      release: () => {
        if (held) this.leases--;
        held = false;
      },
    };
  }
}

describe('transcription flow', () => {
  let dir: string;
  let jobs: JobManager;
  let runner: PipelineRunner;
  let videos: FakeVideos;
  let transcriber: FakeTranscriber;
  let targets: FakeTargets;
  let media: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-transcribe-'));
    await fs.mkdir(path.join(dir, 'project'));
    media = path.join(dir, 'clip.mp4');
    await fs.writeFile(media, 'fake media');
    videos = new FakeVideos();
    transcriber = new FakeTranscriber(videos);
    targets = new FakeTargets(path.join(dir, 'project'), videos);
    jobs = testJobManager(dir);
    await jobs.open();
    runner = new PipelineRunner({
      jobs,
      stagingDir: path.join(dir, 'staging'),
      definitions: [
        transcribePipeline({
          videos,
          transcriber,
          targets,
          sources: {
            video: (videoId) => (videos.videos.has(videoId) ? { name: '原片', scope: { projectId: 'p1' } } : null),
            assetFile: async () => media,
          },
        }),
      ],
      targets: targets as unknown as PipelineTargets,
    });
    await runner.open();
  });

  afterEach(async () => {
    await runner.idle();
    await jobs.shutdown();
    await fs.rm(dir, { recursive: true, force: true });
  });

  const start = (params: Record<string, unknown>) =>
    runner.start({ pipeline: TRANSCRIBE_PIPELINE, params }, { kind: 'connection', id: 'conn_1' });

  async function finished(jobId: string): Promise<JobRecord> {
    await jobs.settled(jobId);
    await runner.idle();
    return jobs.inspect(jobId);
  }

  it('an open video: transcribes the media on the main track; scripts of other media don\'t count, placement is first', async () => {
    videos.add('vid_1', [{ assetId: 'asset_a' }, { assetId: 'asset_a' }]);
    videos.putSpeech('vid_1', 'doc_old', 'job_old', 'asset_other');
    const { jobId } = await start({ videoId: 'vid_1', captions: false, language: 'en' });
    const record = await finished(jobId);
    expect(record).toMatchObject({ state: 'completed', providerId: 'local', modelId: 'fake-asr' });
    expect(record.pipeline!.steps.map((s) => [s.name, s.status])).toEqual([
      ['target', 'skipped'],
      ['create', 'skipped'],
      ['transcribe', 'completed'],
      ['captions', 'skipped'],
    ]);
    expect(transcriber.submitted).toEqual([{ videoId: 'vid_1', assetId: 'asset_a', commandId: `${jobId}:transcribe` }]);
    expect(transcriber.records[0]!.submitter).toEqual({ kind: 'pipeline', id: jobId });
    expect(record.pipeline!.summary).toEqual({
      videoId: 'vid_1',
      createdVideo: false,
      assetId: 'asset_a',
      transcribeJobId: 'job_t1',
      documentId: 'doc_job_t1',
      language: 'en',
      providerId: 'local',
      modelId: 'fake-asr',
      target: 'first',
      newVideo: null,
      replaced: null,
      translations: [],
      captionPins: null,
      dubs: [],
      speakerCount: null,
      captions: { status: 'disabled', documentId: null, cueCount: null, enabled: null },
    });
    expect(record.result).toEqual({ documentId: 'doc_job_t1', artifactId: 'art_job_t1' });
    // The flow itself does not write the video: the document is written by the transcription Job.
    expect(videos.applied).toEqual([]);
  });

  /** A transcript body that can be split into sentences; `asr` is the full-text fingerprint recorded at transcription time (when not given, there are no `stages`). */
  const speechBody = (text: string[], asr?: (body: unknown) => string) => {
    const body: Record<string, unknown> = {
      schema: 'cuccut.speech/1',
      timescale: 1000,
      words: text.map((t, i) => ({ id: `w${i}`, start: i * 500, end: i * 500 + 400, text: t, speaker: 'a' })),
    };
    if (asr) body.stages = { asr: asr(body) };
    return body;
  };

  it('this media already has a script: by default a new video is created in the same scope, importing the same media file and transcribing it; the name defaults to include the original name', async () => {
    videos.add('vid_1', [{ assetId: 'asset_a' }]);
    videos.putSpeech('vid_1', 'doc_old', 'job_old', 'asset_a');
    const { jobId } = await start({ videoId: 'vid_1', captions: false });
    const record = await finished(jobId);
    expect(record.state, JSON.stringify(record.error)).toBe('completed');
    expect(record.pipeline!.steps.map((s) => [s.name, s.status])).toEqual([
      ['target', 'skipped'],
      ['create', 'completed'],
      ['transcribe', 'completed'],
      ['captions', 'skipped'],
    ]);
    expect(targets.created).toBe(1);
    expect(videos.applied[0]).toMatchObject({
      videoId: 'vid_new_1',
      operations: [{ type: 'importAsset', path: media }, { type: 'addItem' }],
    });
    expect(transcriber.submitted).toEqual([{ videoId: 'vid_new_1', assetId: 'asset_media', commandId: `${jobId}:transcribe` }]);
    const summary = record.pipeline!.summary as Record<string, unknown>;
    expect(summary).toMatchObject({ videoId: 'vid_new_1', createdVideo: true, target: 'new-video', replaced: null, captionPins: null });
    expect((summary.newVideo as { videoId: Id; name: string }).videoId).toBe('vid_new_1');
    expect((summary.newVideo as { name: string }).name).toContain('原片');
    // The original video is left untouched.
    expect(Object.keys(videos.videos.get('vid_1')!.documents)).toEqual(['doc_old']);

    // Use the given name when one is provided.
    const named = await finished((await start({ videoId: 'vid_1', captions: false, name: '第二版' })).jobId);
    expect(named.pipeline!.summary).toMatchObject({ target: 'new-video', newVideo: { videoId: 'vid_new_2', name: '第二版' } });
  });

  it('replace: when the script was edited, submission is rejected with TRANSCRIPT_EDITED; submission with acceptEdited or when unedited, the transcription Job carries the script being replaced and its fingerprint', async () => {
    videos.add('vid_1', [{ assetId: 'asset_a' }]);
    videos.putSpeech('vid_1', 'doc_old', 'job_old', 'asset_a');
    videos.bodies.set(
      'doc_old',
      speechBody(['Hello', ' world.'], () => '2:w0:w1:changed'),
    );
    await expect(start({ videoId: 'vid_1', destination: 'replace' })).rejects.toMatchObject({
      code: 'conflict',
      details: { code: 'TRANSCRIPT_EDITED', documentId: 'doc_old' },
    });
    expect(transcriber.submitted).toEqual([]);

    const fingerprint = contentFingerprint(videos.bodies.get('doc_old'));
    const { jobId } = await start({
      videoId: 'vid_1',
      destination: 'replace',
      acceptEdited: true,
      translations: 'discard',
      captions: false,
    });
    const record = await finished(jobId);
    expect(record.state, JSON.stringify(record.error)).toBe('completed');
    expect(transcriber.submitted).toEqual([
      {
        videoId: 'vid_1',
        assetId: 'asset_a',
        commandId: `${jobId}:transcribe`,
        replace: { documentId: 'doc_old', revision: 'd1', fingerprint, translations: 'discard' },
      },
    ]);
    expect(record.pipeline!.steps.find((s) => s.name === 'create')!.status).toBe('skipped');
    expect(record.pipeline!.summary).toMatchObject({
      createdVideo: false,
      target: 'replace',
      newVideo: null,
      replaced: { documentId: 'doc_old', previousVersion: 'd1', transactionId: null },
      translations: [],
      captionPins: { reanchored: 0, orphaned: 0 },
      dubs: [],
    });

    // Not edited (stages.asr matches the fingerprint of the body): no confirmation needed. Older transcripts without stages.asr are treated as unedited.
    videos.bodies.set('doc_old', speechBody(['Hello', ' world.'], contentFingerprint));
    await expect(start({ videoId: 'vid_1', destination: 'replace', captions: false })).resolves.toMatchObject({
      jobId: expect.any(String),
    });
    videos.bodies.set('doc_old', speechBody(['Hello', ' again.']));
    await expect(start({ videoId: 'vid_1', destination: 'replace', captions: false })).resolves.toMatchObject({
      jobId: expect.any(String),
    });
  });

  it('the summary carries the speaker count distinguished by the new script', async () => {
    videos.add('vid_1', [{ assetId: 'asset_a' }]);
    transcriber.speakerCount = 3;
    const { jobId } = await start({ videoId: 'vid_1', captions: false, diarize: true });
    const record = await finished(jobId);
    expect(record.pipeline!.params).toMatchObject({ diarize: true });
    expect(record.pipeline!.summary).toMatchObject({ documentId: 'doc_job_t1', speakerCount: 3 });
  });

  it('more than one media or no media on the main track: gives the media to transcribe', async () => {
    videos.add('vid_1', [{ assetId: 'asset_a' }, { assetId: 'asset_b' }]);
    const ambiguous = await finished((await start({ videoId: 'vid_1' })).jobId);
    expect(ambiguous).toMatchObject({
      state: 'failed',
      error: { code: 'TRANSCRIBE_ASSET_AMBIGUOUS', details: { assetIds: ['asset_a', 'asset_b'] } },
    });
    videos.add('vid_2');
    const none = await finished((await start({ videoId: 'vid_2' })).jobId);
    expect(none).toMatchObject({ state: 'failed', error: { code: 'TRANSCRIBE_ASSET_NOT_FOUND' } });
    expect(transcriber.submitted).toEqual([]);

    const given = await finished((await start({ videoId: 'vid_1', assetId: 'asset_b', hint: '播客', captions: false })).jobId);
    expect(given.state).toBe('completed');
    expect(transcriber.submitted.map((s) => [s.assetId, s.hint])).toEqual([['asset_b', '播客']]);
  });

  it('pre-start checks: video not open, transcription not configured, media file missing', async () => {
    await expect(start({ videoId: 'vid_x' })).rejects.toMatchObject({ code: 'not-found' });
    videos.add('vid_1', [{ assetId: 'asset_a' }]);
    await expect(start({ videoId: 'vid_1', provider: 'missing' })).rejects.toMatchObject({
      details: { code: 'CAPABILITY_NOT_CONFIGURED' },
    });
    await expect(start({ target: { create: { projectId: 'p1', media: path.join(dir, 'nope.mp4') } } })).rejects.toMatchObject({
      code: 'not-found',
      details: { code: 'INPUT_NOT_FOUND' },
    });
    expect(targets.created).toBe(0);
  });

  it('new video: placeholder, create, import and place on the timeline, transcribe the imported media; source records the file and this run', async () => {
    const { jobId } = await start({ target: { create: { projectId: 'p1', media } }, captions: false });
    const record = await finished(jobId);
    expect(record).toMatchObject({ state: 'completed', videoId: 'vid_new_1' });
    expect(record.pipeline!.steps.find((s) => s.name === 'create')).toMatchObject({
      status: 'completed',
      output: { videoId: 'vid_new_1', assetId: 'asset_media', place: { file: 'clip' } },
    });
    expect(videos.applied).toHaveLength(1);
    expect(videos.applied[0]!.commandId).toBe(`${jobId}:import`);
    expect(videos.applied[0]!.operations).toEqual([
      {
        type: 'importAsset',
        path: media,
        name: 'clip.mp4',
        ref: 'link',
        storage: 'linked',
        provenance: { origin: 'file-import', source: { path: media, jobId } },
      },
      { type: 'addItem', sequenceId: 'seq', asset: { ref: 'link' }, at: { unit: 'frames', value: 0 }, alignment: 'floor-frame' },
    ]);
    expect(transcriber.submitted).toEqual([{ videoId: 'vid_new_1', assetId: 'asset_media', commandId: `${jobId}:transcribe` }]);
    expect(record.pipeline!.summary).toMatchObject({ videoId: 'vid_new_1', createdVideo: true, target: 'first', newVideo: null });
    expect(targets.leases).toBe(0);
  });

  it('interrupted after creation and before recording the output: retry recognizes the video in the reserved directory, the import is recognized by command, no extra creation or extra import', async () => {
    // Creation succeeded, but the import was submitted and no receipt came back: this step fails, and the output is not recorded.
    videos.crashAfterApply = true;
    const { jobId } = await start({ target: { create: { projectId: 'p1', media, name: '我的视频' } }, captions: false });
    const failed = await finished(jobId);
    expect(failed).toMatchObject({ state: 'failed', pipeline: { stoppedAt: 'create' } });
    expect(failed.pipeline!.steps.find((s) => s.name === 'create')!.output).toBeNull();
    expect(targets.created).toBe(1);
    expect(videos.applied).toHaveLength(1);
    // The intent stays in staging (kept on failure).
    const intent = JSON.parse(await fs.readFile(path.join(dir, 'staging', 'pipelines', jobId, 'create-intent.json'), 'utf8'));
    expect(intent).toEqual({ place: { root: path.join(dir, 'project'), file: '我的视频', scope: { projectId: 'p1' } } });

    await runner.retry(jobId);
    const done = await finished(jobId);
    expect(done).toMatchObject({ state: 'completed', videoId: 'vid_new_1' });
    expect(targets.created).toBe(1);
    expect(targets.reopened).toBe(1);
    expect(videos.applied).toHaveLength(1);
    expect(videos.videos.size).toBe(1);
    expect(await fs.readdir(path.join(dir, 'project'))).toEqual(['我的视频']);
    expect(transcriber.submitted).toHaveLength(1);
    expect(targets.leases).toBe(0);
  });

  it('transcription retry after failure: resubmit with a different command; a completed transcription is recognized on retry and not submitted again', async () => {
    videos.add('vid_1', [{ assetId: 'asset_a' }]);
    transcriber.outcome = 'failed';
    const { jobId } = await start({ videoId: 'vid_1', captions: false });
    expect(await finished(jobId)).toMatchObject({ state: 'failed', error: { code: 'PROVIDER_UNAVAILABLE' } });
    transcriber.outcome = 'completed';
    await runner.retry(jobId);
    expect(await finished(jobId)).toMatchObject({ state: 'completed' });
    expect(transcriber.submitted.map((s) => s.commandId)).toEqual([`${jobId}:transcribe`, `${jobId}:transcribe:2`]);

    // The Ledger already has a completed transcription for this run (interrupted after the last completion, before the output was recorded): recognize it, and do not submit again. At submission time this material does not yet have a transcript
    // (otherwise the destination would be a new video); it appears afterwards.
    const documents = videos.videos.get('vid_1')!.documents;
    videos.videos.get('vid_1')!.documents = {};
    const second = await start({ videoId: 'vid_1', captions: false });
    videos.videos.get('vid_1')!.documents = documents;
    const earlier = transcriber.records.length;
    transcriber.records.push({
      ...structuredClone(transcriber.records[earlier - 1]!),
      jobId: 'job_earlier',
      submitter: { kind: 'pipeline', id: second.jobId },
      result: { documentId: 'doc_job_t2', artifactId: 'art_earlier' },
    });
    const reused = await finished(second.jobId);
    expect(reused.pipeline!.summary).toMatchObject({ transcribeJobId: 'job_earlier', documentId: 'doc_job_t2' });
    expect(transcriber.submitted).toHaveLength(2);
  });

  it('the document written by the last transcription was deleted: retry transcribes again', async () => {
    videos.add('vid_1', [{ assetId: 'asset_a' }]);
    // The subtitle layer step cannot read the fake body, so it fails at this step (transcription has already completed).
    const { jobId } = await start({ videoId: 'vid_1' });
    const failed = await finished(jobId);
    expect(failed).toMatchObject({ state: 'failed', pipeline: { stoppedAt: 'captions' }, error: { code: 'INPUT_UNREADABLE' } });
    const doc = (failed.pipeline!.steps.find((s) => s.name === 'transcribe')!.output as { documentId: Id }).documentId;
    delete videos.videos.get('vid_1')!.documents[doc];
    await runner.retry(jobId);
    await finished(jobId);
    expect(transcriber.submitted.map((s) => s.commandId)).toEqual([`${jobId}:transcribe`, `${jobId}:transcribe:2`]);
  });

  it('cancel: the running transcription Job is cancelled too, stops at the transcription step, video unchanged; retry resubmits with a different command', async () => {
    videos.add('vid_1', [{ assetId: 'asset_a' }]);
    transcriber.outcome = 'running';
    const cancelled: Id[] = [];
    const waiting = new Map<Id, (state: JobState) => void>();
    let reached!: () => void;
    const transcribing = new Promise<void>((resolve) => (reached = resolve));
    transcriber.settled = (id) =>
      new Promise<JobState>((resolve) => {
        waiting.set(id, resolve);
        reached();
      });
    transcriber.cancel = async (id) => {
      cancelled.push(id);
      transcriber.inspect(id).state = 'cancelled';
      waiting.get(id)?.('cancelled');
      return {};
    };
    const { jobId } = await start({ videoId: 'vid_1', captions: false });
    await transcribing;
    expect(await jobs.cancel(jobId)).toEqual({ state: 'cancelled' });
    await runner.idle();
    expect(jobs.inspect(jobId)).toMatchObject({ state: 'cancelled', pipeline: { stoppedAt: 'transcribe' } });
    expect(cancelled).toEqual(['job_t1']);
    expect(videos.applied).toEqual([]);
    expect(Object.keys(videos.videos.get('vid_1')!.documents)).toEqual([]);

    // A cancelled transcription is not recognized: a retry submits with a different command and carries on to completion.
    transcriber.outcome = 'completed';
    delete (transcriber as Partial<FakeTranscriber>).settled;
    delete (transcriber as Partial<FakeTranscriber>).cancel;
    await runner.retry(jobId);
    expect(await finished(jobId)).toMatchObject({ state: 'completed', pipeline: { summary: { transcribeJobId: 'job_t2' } } });
    expect(transcriber.submitted.map((s) => s.commandId)).toEqual([`${jobId}:transcribe`, `${jobId}:transcribe:2`]);
  });
});

describe('transcription from file only', () => {
  let dir: string;
  let jobs: JobManager;
  let runner: PipelineRunner;
  let transcriber: FakeTranscriber;
  let media: string;
  let saved: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-transcribe-file-'));
    media = path.join(dir, '访谈 第一集.mp3');
    saved = path.join(dir, 'saved');
    await fs.writeFile(media, 'fake media');
    const videos = new FakeVideos();
    transcriber = new FakeTranscriber(videos);
    jobs = testJobManager(dir);
    await jobs.open();
    transcriber.artifacts = jobs.artifacts;
    runner = new PipelineRunner({
      jobs,
      stagingDir: path.join(dir, 'staging'),
      definitions: [transcribePipeline({ videos, transcriber, saveDirectory: () => saved })],
    });
    await runner.open();
  });

  afterEach(async () => {
    await runner.idle();
    await jobs.shutdown();
    await fs.rm(dir, { recursive: true, force: true });
  });

  const start = (params: Record<string, unknown>) =>
    runner.start({ pipeline: TRANSCRIBE_PIPELINE, params }, { kind: 'connection', id: 'conn_1' });
  async function finished(jobId: string): Promise<JobRecord> {
    await jobs.settled(jobId);
    await runner.idle();
    return jobs.inspect(jobId);
  }

  it('parameters: file is mutually exclusive with target, videoId, captions and so on; relative paths and unresolved Space entries are rejected', () => {
    expect(parseTranscribeParams({ file: '/a/b.mp3', outDir: '/out', language: 'en' })).toEqual({
      file: '/a/b.mp3',
      outDir: '/out',
      language: 'en',
    });
    for (const bad of [
      { file: 'b.mp3' },
      { file: { entryId: 'ent_1' } },
      { file: '/a/b.mp3', outDir: 'out' },
      { file: '/a/b.mp3', videoId: 'v1' },
      { file: '/a/b.mp3', captions: true },
      { file: '/a/b.mp3', diarize: true },
      { file: '/a/b.mp3', target: { create: { projectId: 'p1', media: '/a.mp4' } } },
      { videoId: 'v1', outDir: '/out' },
    ]) {
      expect(() => parseTranscribeParams(bad), JSON.stringify(bad)).toThrow(expect.objectContaining({ code: 'invalid-request' }));
    }
  });

  it('writes <source-file-name>.txt and .srt to the save location; on a name clash both get a number together; no video', async () => {
    await fs.mkdir(saved);
    await fs.writeFile(path.join(saved, '访谈 第一集.srt'), '别人的字幕');
    const { jobId } = await start({ file: media, language: 'en', hint: '播客' });
    const record = await finished(jobId);
    expect(record).toMatchObject({ state: 'completed', videoId: null });
    expect(transcriber.files).toEqual([{ file: media, provider: 'local', model: 'fake-asr', language: 'en', hint: '播客' }]);
    const files = [path.join(saved, '访谈 第一集-2.txt'), path.join(saved, '访谈 第一集-2.srt')];
    expect(record.pipeline!.summary).toMatchObject({ file: media, files, language: 'en' });
    expect(record.result!.outputs!.map((o) => o.path)).toEqual(files);
    expect(await fs.readFile(files[0]!, 'utf8')).toBe('Hello\n');
    expect(await fs.readFile(path.join(saved, '访谈 第一集.srt'), 'utf8')).toBe('别人的字幕');
    expect(await fs.readFile(media, 'utf8')).toBe('fake media');
  });

  it('outDir given: used; created if absent; rejected at submission when it is a file', async () => {
    const out = path.join(dir, 'mine', 'deep');
    const { jobId } = await start({ file: media, outDir: out });
    await finished(jobId);
    expect(await fs.readdir(out)).toEqual(['访谈 第一集.srt', '访谈 第一集.txt']);
    await expect(start({ file: media, outDir: media })).rejects.toMatchObject({ details: { code: 'OUTPUT_DESTINATION_UNAVAILABLE' } });
    await expect(start({ file: path.join(dir, 'nope.mp3') })).rejects.toMatchObject({ details: { code: 'INPUT_NOT_FOUND' } });
  });
});


it('new subtitle style frozen in the parameters; wrong schema and combinations that don\'t create subtitles are rejected', () => {
  const base = { videoId: 'v', captions: true };
  expect(parseTranscribeParams({ ...base, captionStyle: DEFAULT_CAPTION_STYLE_BODY })).toMatchObject({ captionStyle: DEFAULT_CAPTION_STYLE_BODY });
  for (const captionStyle of [null, [], { schema: 'unknown', style: {} }, { ...DEFAULT_CAPTION_STYLE_BODY, style: [] }]) {
    expect(() => parseTranscribeParams({ ...base, captionStyle })).toThrow(expect.objectContaining({ code: 'invalid-request' }));
  }
  expect(() => parseTranscribeParams({ ...base, captions: false, captionStyle: DEFAULT_CAPTION_STYLE_BODY })).toThrow(expect.objectContaining({ code: 'invalid-request' }));
});
