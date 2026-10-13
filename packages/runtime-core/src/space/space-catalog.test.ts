import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  RpcError,
  type DirectoryEvent,
  type DirectorySnapshot,
  type JobRecord,
  type Project,
  type SpaceEvent,
  type VideoSnapshot,
} from '@cuccut/protocol';
import { TopicLog, silentLogger, type Harness } from '@cuccut/harness';
import { SpaceArtifactStore, SpaceMarkStore } from '@cuccut/runtime-storage';
import { ArtifactStore, artifactIdOf, toolDefinition } from '@cuccut/jobs';
import { SpaceCatalog, type SpaceJobsSource } from '../space-catalog.ts';
import { toolCandidates } from '../tool-catalogue/tool-candidates.ts';
import { spaceDerivedFinder } from '../videos/video-derive.ts';
import { ContentIndex, type ContentReader } from './content-index.ts';
import type { ReadContentResult } from './content-extract.ts';
import { materialText, resolvePipelineEntryInputs, withSpeechMaterial, withTextMaterial } from './space-inputs.ts';
import { USER_VIEWER, projectOf, listEntries, searchContent, visibleEntry, type SpaceViewer } from './space-queries.ts';

/**
 * Space catalog: derivation, incremental updates, filtering, the trash and physical deletion, completeness of content search, and filtering by principal. The source directory is a temporary directory. The Job Ledger and the read-only video queries are replaced with fakes (the end-to-end test with the real engine is in `space-e2e.test.ts`).
 */

class FakeJobs implements SpaceJobsSource {
  records: JobRecord[] = [];
  readonly files = new Map<string, string>();
  readonly #listeners = new Set<(job: JobRecord) => void>();
  readonly artifacts = { locate: async (id: string) => this.files.get(id) ?? null };

  list(): JobRecord[] {
    return structuredClone(this.records).reverse();
  }

  onChange(listener: (job: JobRecord) => void) {
    this.#listeners.add(listener);
    return () => void this.#listeners.delete(listener);
  }

  put(record: JobRecord): void {
    this.records = [...this.records.filter((r) => r.jobId !== record.jobId), record];
    for (const listener of this.#listeners) listener(record);
  }
}

/** Fake read-only query: video catalog (real path) → content. */
class FakeReader implements ContentReader {
  readonly videos = new Map<string, ReadContentResult>();
  readonly failing = new Set<string>();
  reads = 0;

  async peek(dir: string) {
    const found = this.#get(dir);
    return { videoId: found.videoId, name: found.name, revision: found.revision };
  }

  /** When set, reads wait for its release (simulates a slow engine). */
  hold: Promise<void> | null = null;

  async readContent(dir: string) {
    this.reads++;
    await this.hold;
    return structuredClone(this.#get(dir));
  }

  #get(dir: string): ReadContentResult {
    if (this.failing.has(dir)) throw new Error('UNKNOWN_METHOD');
    const found = this.videos.get(dir);
    if (!found) throw new Error('不是视频');
    return found;
  }
}

let seq = 0;
function job(partial: Partial<JobRecord> & Pick<JobRecord, 'kind' | 'state'>): JobRecord {
  const at = new Date(Date.UTC(2026, 0, 1, 0, 0, ++seq)).toISOString();
  return {
    jobId: `job_${seq}`,
    phase: 'done',
    progress: null,
    videoId: null,
    assetId: null,
    assetRevision: null,
    contentHash: 'sha256:c',
    providerId: 'local',
    modelId: 'm',
    bundleId: null,
    inputHash: `sha256:in${seq}`,
    submitter: { kind: 'connection', id: 'c1' },
    attempt: 1,
    createdAt: at,
    updatedAt: at,
    startedAt: at,
    endedAt: partial.state === 'completed' || partial.state === 'failed' ? at : null,
    error: null,
    result: null,
    warnings: [],
    ...partial,
  } as JobRecord;
}

function imageOutput(artifactId: string, assetId: string | null) {
  return { artifactId, mediaType: 'image/png', byteLength: 4, assetId, media: { kind: 'image' as const, width: 2, height: 2 } };
}

function videoContent(
  videoId: string,
  revision: string,
  opts: { used?: string[]; linked?: string; text?: string; timeline?: { width: number; height: number; frames: number } } = {},
): ReadContentResult {
  // When `timeline` is given, the root sequence is complete (canvas, tracks, clip ranges); otherwise only the fields needed for content are included.
  const span = opts.timeline ? { span: { fromFrame: 0, durationFrames: opts.timeline.frames } } : {};
  return {
    videoId,
    name: `视频 ${videoId}`,
    revision,
    snapshot: {
      rootSequenceId: 'seq',
      sequences: {
        seq: {
          id: 'seq',
          fps: { num: 30, den: 1 },
          items: (opts.used ?? []).map((id, i) => ({ id: `i${i}`, type: 'image', assetRef: { id, revision: 'r' }, ...span })),
          markers: [],
          ...(opts.timeline
            ? {
                canvas: { width: opts.timeline.width, height: opts.timeline.height, workingSpace: 'srgb', background: '#000000' },
                tracks: [],
              }
            : {}),
        },
      },
      assets: opts.linked
        ? { linked: { id: 'linked', name: '链接素材', revisions: { r: { storage: { mode: 'linked', locator: { path: opts.linked } } } } } }
        : {},
    } as unknown as VideoSnapshot,
    documents: [
      {
        documentId: 'cap',
        kind: 'caption',
        name: '字幕',
        language: 'zh',
        revision: revision,
        schema: 'cuccut.caption/1',
        body: { timescale: 1000, cues: [{ id: 'c1', start: 2000, end: 3000, text: opts.text ?? '今天讲剪辑', speaker: '宝玉' }] },
        plan: null,
      },
    ],
  };
}

/** Video content with a transcript (and an optional translation): the script facts that tool candidate inputs need. */
function speechContent(videoId: string, revision: string, translationLanguage?: string): ReadContentResult {
  const base = videoContent(videoId, revision);
  const words = [
    { id: 'w1', text: '今天', start: 0, end: 400 },
    { id: 'w2', text: '剪辑。', start: 400, end: 800 },
  ];
  return {
    ...base,
    documents: [
      ...base.documents,
      {
        documentId: `speech-${videoId}`,
        kind: 'speech',
        name: '转写',
        language: 'zh',
        revision,
        schema: 'cuccut.speech/1',
        body: { schema: 'cuccut.speech/1', timescale: 1000, words, sentences: null },
        plan: null,
      },
      ...(translationLanguage
        ? [
            {
              documentId: `tr-${videoId}`,
              kind: 'translation',
              name: '译文',
              language: translationLanguage,
              revision,
              schema: 'cuccut.translation/2',
              sourceDocumentId: `speech-${videoId}`,
              body: { units: [{ id: 'u1', sourceSentenceId: 's-w1', sourceFingerprint: 'sha256:old', naturalText: 'Editing today.' }] },
              plan: null,
            },
          ]
        : []),
    ],
  };
}

describe('Space catalog', () => {
  let tmp: string;
  let projectDir: string;
  let otherDir: string;
  let videoDir: string;
  let project: Project;
  let directory: TopicLog<DirectorySnapshot, DirectoryEvent>;
  let jobs: FakeJobs;
  let reader: FakeReader;
  let marks: SpaceMarkStore;
  let catalogs: SpaceCatalog[];

  const harness = () =>
    ({ subscribe: (_topic: string, after: string | undefined, l: never) => directory.subscribe(after, l) }) as unknown as Harness;

  async function open(
    indexDir = path.join(tmp, 'cache', 'content-index'),
    artifacts?: SpaceArtifactStore,
  ): Promise<{ catalog: SpaceCatalog; index: ContentIndex }> {
    const index = new ContentIndex({ dir: indexDir, reader, log: silentLogger });
    await index.load();
    const catalog = new SpaceCatalog({
      harness: harness(),
      marks,
      log: silentLogger,
      watch: false,
      jobs,
      index,
      scratchDirs: [path.join(tmp, 'scratch')],
      ...(artifacts ? { artifacts } : {}),
    });
    catalogs.push(catalog);
    catalog.start();
    await catalog.ready;
    await catalog.idle();
    return { catalog, index };
  }

  const byName = (catalog: SpaceCatalog, name: string) => catalog.entries().find((e) => e.fileName === name || e.name === name)!;

  /** Number of videos recorded in the content index database. */
  const storedVideos = (indexDir: string): number => {
    const db = new DatabaseSync(path.join(indexDir, 'index.db'), { readOnly: true });
    try {
      return (db.prepare('SELECT count(*) AS n FROM videos').get() as { n: number }).n;
    } finally {
      db.close();
    }
  };

  beforeEach(async () => {
    tmp = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'space-catalog-')));
    projectDir = path.join(tmp, 'proj');
    otherDir = path.join(tmp, 'elsewhere');
    videoDir = path.join(projectDir, '访谈');
    await fs.mkdir(path.join(projectDir, 'raw'), { recursive: true });
    await fs.mkdir(path.join(projectDir, 'exports'), { recursive: true });
    await fs.mkdir(videoDir, { recursive: true });
    await fs.mkdir(otherDir, { recursive: true });
    await fs.writeFile(path.join(videoDir, 'video.db'), 'db');
    await fs.writeFile(path.join(projectDir, 'raw', 'clip.mp4'), 'mp4');
    await fs.writeFile(path.join(projectDir, 'cover.png'), 'png');
    project = { id: 'p1', name: '项目', path: projectDir, createdAt: '', lastActiveAt: '', pinned: false, archived: false };
    directory = new TopicLog<DirectorySnapshot, DirectoryEvent>(() => ({ projects: [project], conversations: [] }), '0');
    jobs = new FakeJobs();
    reader = new FakeReader();
    reader.videos.set(videoDir, videoContent('v1', 'rev-1', { used: ['asset-applied'], linked: '../raw/clip.mp4' }));
    marks = new SpaceMarkStore(path.join(tmp, 'space.json'));
    await marks.load();
    catalogs = [];
  });

  afterEach(async () => {
    for (const catalog of catalogs) await catalog.close();
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it('migrated videos show the internal title; title updates and rebuilds keep the priority of custom names', async () => {
    const legacyName = 'legacy-36f5c7c183fd6724';
    const legacyDir = path.join(projectDir, legacyName);
    const content = { ...videoContent('legacy-video', 'rev-1'), name: 'Khan Academy CEO: The Real AI Opportunity | Sal Khan' };
    await fs.mkdir(legacyDir);
    await fs.writeFile(path.join(legacyDir, 'video.db'), 'db');
    reader.videos.set(legacyDir, content);
    const { catalog, index } = await open();
    const entry = byName(catalog, legacyName);
    expect(entry).toMatchObject({ name: content.name, fileName: legacyName, relPath: legacyName, ref: { videoId: content.videoId } });
    expect(byName(catalog, 'clip.mp4').name).toBe('clip.mp4');

    const events: SpaceEvent[] = [];
    catalog.subscribe(undefined, (event) => events.push(event.event));
    const renamed = { ...content, name: '可汗学院访谈', revision: 'rev-2' };
    reader.videos.set(legacyDir, renamed);
    index.touched(legacyDir, renamed.revision);
    await catalog.idle();
    expect(catalog.get(entry.id)?.name).toBe(renamed.name);
    expect(events).toContainEqual(expect.objectContaining({ type: 'entry.upsert', entry: expect.objectContaining({ id: entry.id, name: renamed.name }) }));

    await catalog.update({ entryId: entry.id, displayName: 'My interview' });
    reader.videos.set(legacyDir, { ...renamed, name: 'インタビュー', revision: 'rev-3' });
    index.touched(legacyDir, 'rev-3');
    await catalog.idle();
    expect(catalog.get(entry.id)?.name).toBe('My interview');
    await catalog.rebuild();
    await catalog.idle();
    expect(catalog.get(entry.id)?.name).toBe('My interview');
    await catalog.update({ entryId: entry.id, displayName: null });
    expect(catalog.get(entry.id)).toMatchObject({ name: 'インタビュー', fileName: legacyName });
  });

  it.each(['', '  '])('falls back to the directory name when the video title is empty (%j)', async (name) => {
    reader.videos.set(videoDir, { ...videoContent('v1', 'rev-1'), name });
    const { catalog } = await open();
    expect(byName(catalog, '访谈')).toMatchObject({ name: '访谈', ref: { videoId: 'v1' } });
  });

  it('unindexed videos are still listed by directory name', async () => {
    reader.failing.add(videoDir);
    const { catalog } = await open();
    expect(byName(catalog, '访谈')).toMatchObject({ name: '访谈', fileName: '访谈', kind: 'video' });
  });

  it('file and video creation times are independent of update time; WAL writes to the video count toward update time', async () => {
    const imagePath = path.join(projectDir, 'cover.png');
    const dbPath = path.join(videoDir, 'video.db');
    const updated = new Date('2026-01-01T10:00:00Z');
    const walUpdated = new Date('2026-01-01T11:00:00Z');
    await fs.utimes(imagePath, updated, updated);
    await fs.utimes(dbPath, updated, updated);
    await fs.writeFile(`${dbPath}-wal`, 'wal');
    await fs.utimes(`${dbPath}-wal`, walUpdated, walUpdated);
    const { catalog } = await open();
    const image = byName(catalog, 'cover.png');
    const video = byName(catalog, '访谈');
    const birth = (stat: { birthtimeMs: number }) => stat.birthtimeMs > 0 ? new Date(stat.birthtimeMs).toISOString() : null;
    expect(image.createdAt).toBe(birth(await fs.stat(imagePath)));
    expect(image.updatedAt).toBe(updated.toISOString());
    expect(video.createdAt).toBe(birth(await fs.stat(dbPath)));
    expect(video.updatedAt).toBe(walUpdated.toISOString());
    const created = image.createdAt;
    await fs.utimes(imagePath, walUpdated, walUpdated);
    await catalog.rescan();
    expect(byName(catalog, 'cover.png').createdAt).toBe(created);
    expect(byName(catalog, 'cover.png').updatedAt).toBe(walUpdated.toISOString());
  });

  it('generation placeholders and artifacts provide creation and update times; file modification of an artifact does not pass as creation time', async () => {
    const createdAt = '2026-01-01T09:00:00.000Z';
    const updatedAt = '2026-01-01T10:00:00.000Z';
    const running = job({ kind: 'generateImage', state: 'running', createdAt, updatedAt });
    jobs.records = [running];
    const { catalog } = await open();
    expect(catalog.entries().find((e) => e.id === running.jobId)).toMatchObject({ createdAt, updatedAt });
    const file = path.join(otherDir, 'generated.png');
    await fs.writeFile(file, 'png');
    const editedAt = '2026-01-01T12:00:00.000Z';
    await fs.utimes(file, new Date(editedAt), new Date(editedAt));
    const artifactId = 'sha256:timestamps';
    jobs.files.set(artifactId, file);
    jobs.put({ ...running, state: 'completed', endedAt: updatedAt, result: {
      artifactId, outputs: [imageOutput(artifactId, null)], documentId: null,
    } } as JobRecord);
    await catalog.idle();
    expect(catalog.entries().find((e) => e.id === artifactId)).toMatchObject({ createdAt: updatedAt, updatedAt: editedAt });
  });

  /** A set of jobs covering each derived state. */
  async function seedJobs(): Promise<{ applied: string; candidate: string; exported: string }> {
    const art = path.join(tmp, 'artifacts');
    await fs.mkdir(art, { recursive: true });
    for (const id of ['sha256:aa', 'sha256:bb']) {
      const file = path.join(art, `${id.slice(7)}.png`);
      await fs.writeFile(file, 'png!');
      jobs.files.set(id, file);
    }
    const srt = path.join(projectDir, 'exports', '访谈.srt');
    await fs.writeFile(srt, '1\n');
    jobs.put(
      job({
        kind: 'generateImage',
        state: 'completed',
        videoId: 'v1',
        result: {
          documentId: null,
          artifactId: 'sha256:aa',
          outputs: [imageOutput('sha256:aa', 'asset-applied'), imageOutput('sha256:bb', 'asset-other')],
        },
      }),
    );
    jobs.put(
      job({
        kind: 'export',
        state: 'completed',
        videoId: 'v1',
        export: {
          settings: { kind: 'subtitles', format: 'srt' } as never,
          snapshotArtifactId: 'sha256:snap',
          videoRevision: 'rev-1',
          sequenceId: 'seq',
          destination: { dir: path.join(projectDir, 'exports'), files: ['访谈.srt'], overwrite: false },
        },
        result: {
          documentId: null,
          artifactId: 'sha256:srt',
          outputs: [
            {
              artifactId: 'sha256:srt',
              mediaType: 'application/x-subrip',
              byteLength: 2,
              assetId: null,
              media: { kind: 'text', entries: 1, durationSec: 3 },
              path: srt,
            },
          ],
        },
      }),
    );
    jobs.put(job({ kind: 'synthesizeSpeech', state: 'running', videoId: 'v1', progress: { done: 1, total: 3 } as never }));
    jobs.put(job({ kind: 'generateImage', state: 'failed', error: { code: 'MODEL_OUTPUT_INVALID', message: '模型没有给出图片' } }));
    jobs.put(job({ kind: 'transcribe', state: 'completed', videoId: 'v1', result: { documentId: 'd', artifactId: 'sha256:raw' } }));
    return { applied: 'sha256:aa', candidate: 'sha256:bb', exported: srt };
  }

  it('final export: derived as an export entry, with the duration and size read by ffprobe', async () => {
    const mp4 = path.join(projectDir, 'exports', '访谈.mp4');
    await fs.writeFile(mp4, 'mp4!');
    jobs.put(
      job({
        kind: 'export',
        state: 'completed',
        videoId: 'v1',
        export: {
          settings: { kind: 'video', format: 'mp4' } as never,
          snapshotArtifactId: 'sha256:snap',
          videoRevision: 'rev-1',
          sequenceId: 'seq',
          destination: { dir: path.join(projectDir, 'exports'), files: ['访谈.mp4'], overwrite: false },
        },
        result: {
          documentId: null,
          artifactId: 'sha256:mp4',
          outputs: [
            {
              artifactId: 'sha256:mp4',
              mediaType: 'video/mp4',
              byteLength: 4,
              assetId: null,
              media: {
                kind: 'video',
                durationSec: 4,
                width: 320,
                height: 180,
                videoCodec: 'h264',
                audioCodec: 'aac',
                frames: 120,
                fps: '30/1',
              },
              path: mp4,
            },
          ],
        },
      }),
    );
    const { catalog } = await open();
    expect(byName(catalog, '访谈.mp4')).toMatchObject({
      kind: 'export',
      status: 'published',
      relPath: 'exports/访谈.mp4',
      ref: { artifactId: 'sha256:mp4' },
      origin: { source: 'exported', videoId: 'v1' },
      media: { mediaType: 'video/mp4', durationSec: 4, width: 320, height: 180 },
    });
  });

  /** One completed export: settings, published file (path) and artifact id. */
  function exportJob(settings: object, file: string, artifactId: string, state: JobRecord['state'] = 'completed'): JobRecord {
    return job({
      kind: 'export',
      state,
      videoId: 'v1',
      export: {
        settings: settings as never,
        snapshotArtifactId: 'sha256:snap',
        videoRevision: 'rev-1',
        sequenceId: 'seq',
        destination: { dir: path.dirname(file), files: [path.basename(file)], overwrite: false },
      },
      result:
        state === 'completed'
          ? {
              documentId: null,
              artifactId,
              outputs: [{ artifactId, mediaType: 'text/plain', byteLength: 2, assetId: null, media: { kind: 'text', entries: 1, durationSec: 3 }, path: file }],
            }
          : null,
      ...(state === 'failed' ? { error: { code: 'EXPORT_FAILED', message: '失败' } } : {}),
    });
  }

  it('internal check exports (purpose: preview): queued, failed and completed ones do not become entries, and published files are not listed; the same path later delivered is listed as usual', async () => {
    const srt = path.join(projectDir, 'exports', '访谈.srt');
    await fs.writeFile(srt, '1\n');
    jobs.put(exportJob({ kind: 'subtitles', format: 'srt', purpose: 'preview' }, srt, 'sha256:check'));
    jobs.put(exportJob({ kind: 'transcript', format: 'md', purpose: 'preview' }, path.join(projectDir, 'exports', '访谈.md'), 'sha256:md', 'running'));
    jobs.put(exportJob({ kind: 'audio', format: 'wav', purpose: 'preview' }, path.join(projectDir, 'exports', '访谈.wav'), 'sha256:wav', 'failed'));
    const { catalog } = await open();
    const names = catalog.entries().map((e) => e.fileName);
    expect(names).not.toContain('访谈.srt');
    expect(() => catalog.get('sha256:check')).toThrow(RpcError);
    expect(catalog.entries().filter((e) => e.status === 'generating' || e.status === 'failed')).toEqual([]);
    expect(listEntries(catalog, USER_VIEWER, { videoId: 'v1' }).entries.map((e) => e.fileName)).toEqual(['访谈']);

    // The user later asked for the same subtitles: the delivered export claims this file.
    jobs.put(exportJob({ kind: 'subtitles', format: 'srt' }, srt, 'sha256:deliver'));
    await catalog.idle();
    expect(byName(catalog, '访谈.srt')).toMatchObject({ kind: 'subtitle', status: 'published', ref: { artifactId: 'sha256:deliver' } });
  });

  it('exports published to a session\'s working directory before the session was moved into a project: recognized by their position after moving into the project, and are one entry with the scanned file', async () => {
    const before = path.join(tmp, 'scratch', 'c5', 'exports', '短片.mp4');
    const after = path.join(projectDir, 'exports', '短片.mp4');
    await fs.writeFile(after, 'mp4!');
    const conversation = { id: 'c5', projectId: 'p1', cwd: projectDir } as never;
    directory = new TopicLog<DirectorySnapshot, DirectoryEvent>(() => ({ projects: [project], conversations: [conversation] }), '0');
    jobs.put(exportJob({ kind: 'video', format: 'mp4' }, before, 'sha256:short'));
    const { catalog } = await open();
    const entries = catalog.entries().filter((e) => e.fileName === '短片.mp4');
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      kind: 'export',
      status: 'published',
      relPath: 'exports/短片.mp4',
      source: { projectId: 'p1' },
      ref: { artifactId: 'sha256:short' },
      file: { path: after },
    });
    expect(() => catalog.get('sha256:short')).toThrow(RpcError);
  });

  it('derivation: states of scan, artifacts, exports and placeholders; rebuild matches a build from scratch, user marks are kept', async () => {
    await seedJobs();
    const { catalog } = await open();
    const video = byName(catalog, '访谈');
    expect(video).toMatchObject({ kind: 'video', ref: { videoId: 'v1' }, status: null, source: { projectId: 'p1' } });
    expect(catalog.get('sha256:aa')).toMatchObject({
      kind: 'image',
      status: 'applied',
      origin: { source: 'generated', projectId: 'p1', videoId: 'v1' },
    });
    expect(catalog.get('sha256:bb')).toMatchObject({ status: 'candidate', source: { projectId: null, conversationId: null } });
    const srt = byName(catalog, '访谈.srt');
    expect(srt).toMatchObject({ kind: 'subtitle', status: 'published', relPath: 'exports/访谈.srt', ref: { artifactId: 'sha256:srt' } });
    expect(catalog.entries().filter((e) => e.status === 'generating')).toEqual([
      expect.objectContaining({ kind: 'audio', statusDetail: { progress: { done: 1, total: 3 } } }),
    ]);
    expect(catalog.entries().filter((e) => e.status === 'failed')).toEqual([
      expect.objectContaining({ statusDetail: { reason: '模型没有给出图片', code: 'MODEL_OUTPUT_INVALID' } }),
    ]);
    // The raw result of a transcription is not a deliverable artifact.
    expect(catalog.entries().some((e) => JSON.stringify(e).includes('sha256:raw'))).toBe(false);

    await catalog.update({ entryId: 'sha256:aa', favorite: true, displayName: '封面图' });
    const before = catalog.entries();
    const events: SpaceEvent[] = [];
    catalog.subscribe(undefined, (e) => events.push(e.event));
    const rebuilt = await catalog.rebuild();
    expect(rebuilt.entries).toBe(before.length);
    await catalog.idle();
    expect(catalog.entries()).toEqual(before);
    expect(catalog.get('sha256:aa')).toMatchObject({ name: '封面图', user: { favorite: true } });
    expect(events.filter((e) => e.type === 'catalog.replaced')).toHaveLength(1);
    expect(events.filter((e) => e.type === 'entry.removed')).toEqual([]);
    expect(reader.reads).toBeGreaterThanOrEqual(2);

    // Discard the content index cache and rebuild from a new, empty directory: same result.
    const { catalog: fresh } = await open(path.join(tmp, 'cache', 'other-index'));
    expect(fresh.entries()).toEqual(before);
  });

  it('incremental: Job events and video version changes update entries one by one', async () => {
    const { catalog, index } = await open();
    const events: SpaceEvent[] = [];
    catalog.subscribe(undefined, (e) => events.push(e.event));
    const running = job({ kind: 'generateImage', state: 'running', videoId: 'v1' });
    jobs.put(running);
    await catalog.idle();
    expect(events).toEqual([{ type: 'entry.upsert', entry: expect.objectContaining({ id: running.jobId, status: 'generating' }) }]);

    events.length = 0;
    const file = path.join(tmp, 'img.png');
    await fs.writeFile(file, 'png');
    jobs.files.set('sha256:new', file);
    jobs.put({
      ...running,
      state: 'completed',
      result: { documentId: null, artifactId: 'sha256:new', outputs: [imageOutput('sha256:new', 'asset-new')] },
    });
    await catalog.idle();
    expect(events).toEqual(
      expect.arrayContaining([
        { type: 'entry.upsert', entry: expect.objectContaining({ id: 'sha256:new', status: 'candidate' }) },
        { type: 'entry.removed', entryId: running.jobId },
      ]),
    );

    // The video submitted a new version and the timeline uses this image: after re-indexing it becomes `applied`.
    events.length = 0;
    reader.videos.set(videoDir, videoContent('v1', 'rev-2', { used: ['asset-new'] }));
    index.touched(videoDir, 'rev-2');
    await catalog.idle();
    expect(catalog.get('sha256:new').status).toBe('applied');
    expect(events).toContainEqual({ type: 'entry.upsert', entry: expect.objectContaining({ id: 'sha256:new', status: 'applied' }) });

    // Failed placeholder: no longer shown once the same input succeeds later.
    const failed = job({ kind: 'synthesizeSpeech', state: 'failed', inputHash: 'sha256:same' });
    jobs.put(failed);
    await catalog.idle();
    expect(catalog.get(failed.jobId).status).toBe('failed');
    jobs.put(
      job({
        kind: 'synthesizeSpeech',
        state: 'completed',
        inputHash: 'sha256:same',
        result: { documentId: null, artifactId: 'sha256:gone', outputs: [] },
      }),
    );
    await catalog.idle();
    expect(() => catalog.get(failed.jobId)).toThrow(RpcError);
  });

  it('video changed after export is source-changed; exported file gone is missing', async () => {
    const { exported } = await seedJobs();
    const { catalog, index } = await open();
    reader.videos.set(videoDir, videoContent('v1', 'rev-9', { used: ['asset-applied'] }));
    index.touched(videoDir, 'rev-9');
    await catalog.idle();
    expect(byName(catalog, '访谈.srt')).toMatchObject({ status: 'source-changed', statusDetail: { currentRevision: 'rev-9' } });
    expect(catalog.openForEdit(byName(catalog, '访谈.srt').id)).toMatchObject({
      mode: 'source-video',
      videoId: 'v1',
      target: { entryId: byName(catalog, '访谈').id },
      frozenRevision: 'rev-1',
      currentRevision: 'rev-9',
      changed: true,
    });
    expect(catalog.openForEdit(byName(catalog, '访谈').id)).toMatchObject({ mode: 'video', videoId: 'v1' });
    expect(catalog.openForEdit(byName(catalog, 'cover.png').id)).toMatchObject({ mode: 'new-video', projectId: 'p1' });

    await fs.rm(exported);
    await catalog.rescan();
    expect(catalog.get('sha256:srt')).toMatchObject({ status: 'missing', kind: 'subtitle' });
  });

  it('list filtering and pagination', async () => {
    await seedJobs();
    const { catalog } = await open();
    await catalog.update({ entryId: byName(catalog, 'cover.png').id, trashed: true });
    await catalog.update({ entryId: 'sha256:bb', favorite: true });
    const all = listEntries(catalog, USER_VIEWER, { trash: 'include' });
    expect(all.total).toBe(catalog.entries().length);

    const kinds = (p: Parameters<typeof listEntries>[2]) => listEntries(catalog, USER_VIEWER, p).entries.map((e) => e.name ?? e.fileName);
    expect(kinds({ trash: 'only' })).toEqual(['cover.png']);
    expect(listEntries(catalog, USER_VIEWER, {}).entries.some((e) => e.fileName === 'cover.png')).toBe(false);
    expect(
      listEntries(catalog, USER_VIEWER, { kind: 'image', status: ['applied', 'candidate'] })
        .entries.map((e) => e.id)
        .sort(),
    ).toEqual(['sha256:aa', 'sha256:bb']);
    expect(listEntries(catalog, USER_VIEWER, { kind: 'image' }).total).toBe(3);
    expect(listEntries(catalog, USER_VIEWER, { status: ['applied', 'candidate'] }).total).toBe(2);
    expect(listEntries(catalog, USER_VIEWER, { status: 'none' }).entries.every((e) => e.status === null)).toBe(true);
    expect(listEntries(catalog, USER_VIEWER, { favorite: true }).entries.map((e) => e.id)).toEqual(['sha256:bb']);
    // Source video: the video itself, and the entries generated and exported from it.
    const fromVideo = listEntries(catalog, USER_VIEWER, { videoId: 'v1' }).entries.map((e) => e.fileName);
    expect(fromVideo).toEqual(expect.arrayContaining(['访谈', '访谈.srt']));
    expect(fromVideo).toHaveLength(5);
    // Not part of the project: failed placeholders (no video, and not submitted in the session).
    expect(listEntries(catalog, USER_VIEWER, { projectId: null }).entries.map((e) => e.status)).toEqual(['failed']);
    expect(listEntries(catalog, USER_VIEWER, { projectId: 'p1' }).total).toBe(all.total - 2);

    const pages: string[] = [];
    let cursor: string | undefined;
    do {
      const page = listEntries(catalog, USER_VIEWER, { trash: 'include', limit: 2, ...(cursor ? { cursor } : {}) });
      pages.push(...page.entries.map((e) => e.id));
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    expect(pages).toEqual(all.entries.map((e) => e.id));
  });

  it('permanent delete: videos are rejected, in-progress rejected, moved to trash first; when still referenced, not deleted and the references are listed', async () => {
    await seedJobs();
    const { catalog } = await open();
    const code = async (fn: () => Promise<unknown>) => {
      try {
        await fn();
      } catch (error) {
        return (error as RpcError).details as { code: string };
      }
      throw new Error('应该拒绝');
    };
    expect(await code(() => catalog.purge(byName(catalog, '访谈').id))).toMatchObject({ code: 'SPACE_PURGE_VIDEO' });
    const running = catalog.entries().find((e) => e.status === 'generating')!;
    expect(await code(() => catalog.purge(running.id))).toMatchObject({ code: 'SPACE_PURGE_RUNNING' });
    const clip = byName(catalog, 'clip.mp4');
    expect(await code(() => catalog.purge(clip.id))).toMatchObject({ code: 'SPACE_NOT_TRASHED' });

    // The video links this file: do not delete; return the reference.
    await catalog.update({ entryId: clip.id, trashed: true });
    const blocked = await catalog.purge(clip.id);
    expect(blocked).toEqual({
      status: 'blocked',
      entryId: clip.id,
      references: [expect.objectContaining({ kind: 'video-asset', videoId: 'v1', assetId: 'linked' })],
    });
    await expect(fs.stat(path.join(projectDir, 'raw', 'clip.mp4'))).resolves.toBeTruthy();

    // The video cannot be read right now: cannot confirm, so treat it as referenced.
    const cover = byName(catalog, 'cover.png');
    await catalog.update({ entryId: cover.id, trashed: true });
    reader.failing.add(videoDir);
    const { index } = { index: catalog.index! };
    index.touched(videoDir, 'rev-x');
    await catalog.idle();
    expect(await catalog.purge(cover.id)).toMatchObject({ status: 'blocked', references: [{ kind: 'unverified' }] });
    reader.failing.delete(videoDir);
    index.touched(videoDir, 'rev-y');
    await catalog.idle();
    expect(await catalog.purge(cover.id)).toEqual({ status: 'purged', entryId: cover.id });
    await expect(fs.stat(path.join(projectDir, 'cover.png'))).rejects.toThrow();
    expect(() => catalog.get(cover.id)).toThrow(RpcError);

    // Artifact: deleting the file in the artifact store means it no longer appears as "missing".
    await catalog.update({ entryId: 'sha256:bb', trashed: true });
    expect(await catalog.purge('sha256:bb')).toMatchObject({ status: 'purged' });
    await expect(fs.stat(jobs.files.get('sha256:bb')!)).rejects.toThrow();
    await catalog.rescan();
    expect(() => catalog.get('sha256:bb')).toThrow(RpcError);

    // Export published as a file in the project: after deleting it, the export also no longer appears as "missing".
    const srt = byName(catalog, '访谈.srt');
    await catalog.update({ entryId: srt.id, trashed: true });
    expect(await catalog.purge(srt.id)).toMatchObject({ status: 'purged' });
    await catalog.rescan();
    expect(() => catalog.get('sha256:srt')).toThrow(RpcError);

    // Failed placeholders are cleared directly.
    const failed = catalog.entries().find((e) => e.status === 'failed')!;
    expect(await catalog.purge(failed.id)).toMatchObject({ status: 'purged' });
    expect(() => catalog.get(failed.id)).toThrow(RpcError);
  });

  it('slides: a directory containing a valid deck.json is one slides entry, named by its title, with page count; files inside are not listed separately or registered individually; permanent delete removes the whole directory', async () => {
    const deckDir = path.join(projectDir, 'talk');
    await fs.mkdir(path.join(deckDir, 'slides'), { recursive: true });
    await fs.mkdir(path.join(deckDir, 'assets'), { recursive: true });
    await fs.writeFile(path.join(deckDir, 'deck.json'), JSON.stringify({ v: 4, title: ' 季度回顾 ', order: ['s01', 's02', 's03'] }));
    await fs.writeFile(path.join(deckDir, 'slides', 's01.html'), '<slide></slide>');
    await fs.writeFile(path.join(deckDir, 'assets', 'logo.png'), 'png');
    await fs.writeFile(path.join(deckDir, 'notes.md'), '# 讲稿');
    // A directory whose deck.json is malformed is still traversed.
    await fs.mkdir(path.join(projectDir, 'draft'), { recursive: true });
    await fs.writeFile(path.join(projectDir, 'draft', 'deck.json'), JSON.stringify({ v: 3, order: [] }));
    const { catalog } = await open();

    const deck = catalog.entries().find((e) => e.kind === 'slides')!;
    expect(deck).toMatchObject({ relPath: 'talk', fileName: 'talk', name: '季度回顾', deck: { slideCount: 3 } });
    expect(deck.size).toBeGreaterThan(0);
    expect(catalog.entries().filter((e) => e.relPath.startsWith('talk/'))).toEqual([]);
    expect(byName(catalog, 'deck.json')).toMatchObject({ relPath: 'draft/deck.json', kind: 'document' });

    await expect(catalog.importFile({ projectId: 'p1', file: path.join(deckDir, 'notes.md') })).rejects.toMatchObject({
      details: { code: 'SPACE_IMPORT_UNSUPPORTED' },
    });

    await catalog.update({ entryId: deck.id, trashed: true });
    expect(await catalog.purge(deck.id)).toEqual({ status: 'purged', entryId: deck.id });
    await expect(fs.stat(deckDir)).rejects.toThrow();
  });

  it('design: a directory containing a valid canvas.json is one design entry, named by its title, with artboard count; files inside are not listed separately or registered individually; permanent delete removes the whole directory', async () => {
    const canvasDir = path.join(projectDir, 'poster');
    await fs.mkdir(path.join(canvasDir, 'screens'), { recursive: true });
    await fs.mkdir(path.join(canvasDir, 'assets'), { recursive: true });
    const boards = { 'Main.dc.html': { x: 0, y: 0, w: 880, h: 560 }, 'screens/Cart.dc.html': { x: 960, y: 0, w: 390, h: 844 } };
    await fs.writeFile(path.join(canvasDir, 'canvas.json'), JSON.stringify({ v: 3, title: ' 春季海报 ', boards, order: Object.keys(boards) }));
    await fs.writeFile(path.join(canvasDir, 'Main.dc.html'), '<x-dc></x-dc>');
    await fs.writeFile(path.join(canvasDir, 'screens', 'Cart.dc.html'), '<x-dc></x-dc>');
    await fs.writeFile(path.join(canvasDir, 'assets', 'logo.png'), 'png');
    await fs.writeFile(path.join(canvasDir, 'brief.md'), '# 需求');
    // A directory whose canvas.json is malformed is still traversed.
    await fs.mkdir(path.join(projectDir, 'sketch'), { recursive: true });
    await fs.writeFile(path.join(projectDir, 'sketch', 'canvas.json'), JSON.stringify({ v: 2, boards: [] }));
    const { catalog } = await open();

    const design = catalog.entries().find((e) => e.kind === 'design')!;
    expect(design).toMatchObject({ relPath: 'poster', fileName: 'poster', name: '春季海报', canvas: { boardCount: 2 } });
    expect(design.size).toBeGreaterThan(0);
    expect(catalog.entries().filter((e) => e.relPath.startsWith('poster/'))).toEqual([]);
    expect(byName(catalog, 'canvas.json')).toMatchObject({ relPath: 'sketch/canvas.json', kind: 'document' });

    await expect(catalog.importFile({ projectId: 'p1', file: path.join(canvasDir, 'brief.md') })).rejects.toMatchObject({
      details: { code: 'SPACE_IMPORT_UNSUPPORTED' },
    });

    await catalog.update({ entryId: design.id, trashed: true });
    expect(await catalog.purge(design.id)).toEqual({ status: 'purged', entryId: design.id });
    await expect(fs.stat(canvasDir)).rejects.toThrow();
  });

  it('design system: a directory containing a valid design-system.json is one design-system entry, named by its title; files inside are not listed separately or registered individually; permanent delete removes the whole directory, including _blobs/', async () => {
    const systemDir = path.join(projectDir, 'brand');
    await fs.mkdir(path.join(systemDir, 'assets', 'Logos'), { recursive: true });
    await fs.mkdir(path.join(systemDir, '_blobs'), { recursive: true });
    await fs.writeFile(
      path.join(systemDir, 'design-system.json'),
      JSON.stringify({ v: 3, layout: 'files', createdOnFiles: { v: 1, at: '2026-10-11T00:00:00Z' }, title: ' 品牌规范 ', namespace: 'Brand' }),
    );
    await fs.writeFile(path.join(systemDir, 'README.md'), '# 品牌');
    await fs.writeFile(path.join(systemDir, 'assets', 'Logos', 'mark.svg'), '<svg/>');
    await fs.writeFile(path.join(systemDir, '_blobs', `${'ab'.repeat(16)}.png`), 'png');
    // A design-system.json that is not v3 files (the old single-file envelope) does not count as a design system; the directory is still traversed.
    await fs.mkdir(path.join(projectDir, 'legacy'), { recursive: true });
    await fs.writeFile(path.join(projectDir, 'legacy', 'design-system.json'), JSON.stringify({ v: 2, content: { files: {} } }));
    const { catalog } = await open();

    const system = catalog.entries().find((e) => e.kind === 'design-system')!;
    expect(system).toMatchObject({ relPath: 'brand', fileName: 'brand', name: '品牌规范' });
    expect(system.size).toBeGreaterThan(0);
    expect(catalog.entries().filter((e) => e.relPath.startsWith('brand/'))).toEqual([]);
    expect(byName(catalog, 'design-system.json')).toMatchObject({ relPath: 'legacy/design-system.json', kind: 'document' });

    for (const file of [path.join(systemDir, 'README.md'), path.join(systemDir, 'assets', 'Logos', 'mark.svg')]) {
      await expect(catalog.importFile({ projectId: 'p1', file })).rejects.toMatchObject({ details: { code: 'SPACE_IMPORT_UNSUPPORTED' } });
    }

    await catalog.update({ entryId: system.id, trashed: true });
    expect(await catalog.purge(system.id)).toEqual({ status: 'purged', entryId: system.id });
    await expect(fs.stat(systemDir)).rejects.toThrow();
  });

  it('registers project media: registered in place when inside the project, copied into imports/ when outside', async () => {
    const { catalog } = await open();
    await fs.writeFile(path.join(projectDir, 'raw', 'note.md'), '# 笔记');
    const inside = await catalog.importFile({ projectId: 'p1', file: path.join(projectDir, 'raw', 'note.md'), name: '拍摄笔记' });
    expect(inside).toMatchObject({
      copied: false,
      entry: { relPath: 'raw/note.md', name: '拍摄笔记', origin: { source: 'imported', projectId: 'p1' } },
    });

    const outside = path.join(otherDir, 'logo.png');
    await fs.writeFile(outside, 'png');
    const first = await catalog.importFile({ projectId: 'p1', file: outside });
    const second = await catalog.importFile({ projectId: 'p1', file: outside });
    expect(first).toMatchObject({ copied: true, entry: { relPath: 'imports/logo.png', kind: 'image' } });
    expect(second.entry.relPath).toBe('imports/logo (2).png');

    await expect(catalog.importFile({ projectId: 'p1', file: path.join(videoDir, 'video.db') })).rejects.toThrow(RpcError);
    await fs.writeFile(path.join(otherDir, 'x.exe'), '');
    await expect(catalog.importFile({ projectId: 'p1', file: path.join(otherDir, 'x.exe') })).rejects.toMatchObject({
      details: { code: 'SPACE_IMPORT_UNSUPPORTED' },
    });
    await expect(catalog.importFile({ projectId: 'nope', file: outside })).rejects.toMatchObject({ code: 'not-found' });

    // Registered file is gone: the entry is kept, with status `missing`.
    await fs.rm(path.join(projectDir, 'raw', 'note.md'));
    await catalog.rescan();
    expect(catalog.get(inside.entry.id)).toMatchObject({ status: 'missing', name: '拍摄笔记' });
  });

  it('search: marks results as incomplete when the index is behind; old results are still searchable during a rebuild', async () => {
    const second = path.join(projectDir, 'Vlog');
    await fs.mkdir(second);
    await fs.writeFile(path.join(second, 'video.db'), 'db');
    reader.videos.set(second, videoContent('v2', 'r1', { text: '周末去爬山' }));
    reader.failing.add(second);
    const { catalog, index } = await open();
    let result = searchContent(catalog, USER_VIEWER, { query: '剪辑' });
    expect(result).toMatchObject({ complete: false, pendingVideos: 1, truncated: false });
    expect(result.hits).toEqual([
      expect.objectContaining({
        videoId: 'v1',
        videoName: '视频 v1',
        entryId: byName(catalog, '访谈').id,
        documentKind: 'caption',
        time: { clock: 'source', start: 2, end: 3 },
        snippet: '今天讲剪辑',
        highlights: [[3, 5]],
        indexedRevision: 'rev-1',
      }),
    ]);

    reader.failing.delete(second);
    index.touched(second, 'r1');
    await catalog.idle();
    result = searchContent(catalog, USER_VIEWER, { query: '爬山' });
    expect(result).toMatchObject({ complete: true, pendingVideos: 0, hits: [{ videoId: 'v2' }] });
    expect(searchContent(catalog, USER_VIEWER, { query: '', speaker: '宝玉', videoIds: ['v1'] }).hits.map((h) => h.videoId)).toEqual([
      'v1',
    ]);

    // The video submitted a new version: until the re-read finishes, the old results can still be queried, but they are incomplete.
    reader.failing.add(videoDir);
    index.touched(videoDir, 'rev-2');
    await catalog.idle();
    result = searchContent(catalog, USER_VIEWER, { query: '剪辑' });
    expect(result).toMatchObject({ complete: false, pendingVideos: 1, hits: [{ indexedRevision: 'rev-1' }] });

    // Rebuild: everything is re-read; incomplete until the re-read finishes.
    reader.failing.delete(videoDir);
    const reads = reader.reads;
    let release!: () => void;
    reader.hold = new Promise((resolve) => (release = resolve));
    const rebuilt = await catalog.rebuild();
    expect(rebuilt.pendingVideos).toBe(2);
    expect(searchContent(catalog, USER_VIEWER, { query: '爬山' })).toMatchObject({
      complete: false,
      pendingVideos: 2,
      hits: [{ videoId: 'v2' }],
    });
    release();
    await catalog.idle();
    expect(reader.reads).toBe(reads + 2);
    expect(searchContent(catalog, USER_VIEWER, { query: '剪辑' })).toMatchObject({ complete: true });
    expect(storedVideos(path.join(tmp, 'cache', 'content-index'))).toBe(2);
  });

  it('filter by subject: the session\'s source directory, the video scope of the external service, and its own tasks', async () => {
    await seedJobs();
    const second = path.join(otherDir, '别的视频');
    await fs.mkdir(second);
    await fs.writeFile(path.join(second, 'video.db'), 'db');
    reader.videos.set(second, videoContent('v9', 'r1', { text: '剪辑别的' }));
    const conversation = { id: 'c9', projectId: null, cwd: otherDir } as never;
    directory = new TopicLog<DirectorySnapshot, DirectoryEvent>(() => ({ projects: [project], conversations: [conversation] }), '0');
    const mine = job({
      kind: 'generateImage',
      state: 'completed',
      videoId: 'v1',
      submitter: { kind: 'service', id: 'mcp', clientId: 'me' },
      result: { documentId: null, artifactId: 'sha256:mine', outputs: [imageOutput('sha256:mine', null)] },
    });
    jobs.put(mine);
    const { catalog } = await open();

    const agent: SpaceViewer = { kind: 'source', projectId: null, conversationId: 'c9' };
    expect(listEntries(catalog, agent, {}).entries.map((e) => e.fileName)).toEqual(['别的视频']);
    expect(searchContent(catalog, agent, { query: '剪辑' }).hits.map((h) => h.videoId)).toEqual(['v9']);
    expect(() => visibleEntry(catalog, agent, 'sha256:aa')).toThrow(RpcError);

    const service = (videos: 'all' | Set<string>): SpaceViewer => ({
      kind: 'service',
      videos,
      owns: (r) => r.submitter.kind === 'service' && r.submitter.clientId === 'me',
      jobs: (id) => jobs.records.find((r) => r.jobId === id) ?? null,
    });
    // Scope is v1: the video itself and the artifacts of the jobs it submitted. Other people's artifacts and exports, and ordinary files in the project, are not visible.
    const scoped = listEntries(catalog, service(new Set(['v1'])), { trash: 'include' }).entries;
    expect(scoped.map((e) => e.fileName)).toEqual(expect.arrayContaining([expect.stringMatching(/^生成图片-/), '访谈']));
    expect(scoped).toHaveLength(2);
    expect(scoped.find((e) => e.id === 'sha256:mine')).toBeTruthy();
    expect(listEntries(catalog, service(new Set(['v1'])), {}).issues).toEqual([]);
    // Videos that do not belong to the project (those in the session directory) are invisible to external services. Videos outside the allowlist do not appear in hits and are not counted as pending indexing.
    const outOfScope = searchContent(catalog, service(new Set(['v1'])), { query: '剪辑' });
    expect(outOfScope.hits.map((h) => h.videoId)).toEqual(['v1']);
    expect(searchContent(catalog, service(new Set(['v2'])), { query: '剪辑' })).toMatchObject({ hits: [], pendingVideos: 0 });
    expect(searchContent(catalog, service('all'), { query: '剪辑' }).hits.map((h) => h.videoId)).toEqual(['v1']);
  });
  it('library format version mismatch: delete and rebuild; before the reread completes it counts as unindexed, after that the script facts are present; the earlier JSON cache is deleted', async () => {
    reader.videos.set(videoDir, speechContent('v1', 'rev-1'));
    const opened = await open();
    const indexDir = path.join(tmp, 'cache', 'content-index');
    await opened.catalog.close();
    // Modification time and version both unchanged: when the database's format version is wrong, the entry cannot be filled in without a re-read.
    const raw = new DatabaseSync(path.join(indexDir, 'index.db'));
    raw.exec('PRAGMA user_version = 999');
    raw.close();
    const legacy = path.join(indexDir, '0123456789abcdef0123456789abcdef.json');
    await fs.writeFile(legacy, JSON.stringify({ schemaVersion: 4, dir: videoDir, segments: [] }));

    const reads = reader.reads;
    let release!: () => void;
    reader.hold = new Promise((resolve) => (release = resolve));
    const index = new ContentIndex({ dir: indexDir, reader, log: silentLogger });
    await index.load();
    expect(index.at(videoDir)).toBeNull();
    await expect(fs.stat(legacy)).rejects.toThrow();
    const catalog = new SpaceCatalog({ harness: harness(), marks, log: silentLogger, watch: false, jobs, index });
    catalogs.push(catalog);
    catalog.start();
    await catalog.ready;
    const dub = toolDefinition('dub')!;
    // Before the re-read: the videoId is not yet known, so it cannot be concluded that there is no script. The video is still listed, marked as not indexed.
    expect(toolCandidates(catalog, USER_VIEWER, dub, {})).toMatchObject({
      complete: false,
      pendingVideos: 1,
      candidates: [{ videoId: null, indexed: false, documents: [] }],
    });
    expect(searchContent(catalog, USER_VIEWER, { query: '剪辑' })).toMatchObject({ complete: false, hits: [] });
    release();
    await catalog.idle();
    expect(reader.reads).toBe(reads + 1);
    expect(index.at(videoDir)).toMatchObject({ facts: { transcripts: [{ documentId: 'speech-v1', language: 'zh' }] } });
    expect(toolCandidates(catalog, USER_VIEWER, dub, {})).toMatchObject({
      complete: true,
      candidates: [{ videoId: 'v1', indexed: true, documents: [{ documentId: 'speech-v1' }] }],
    });
    expect(storedVideos(indexDir)).toBe(1);
  });

  it('a video entry\'s media is the root sequence\'s duration and canvas size; none when the snapshot is incomplete; restored by rereading after the library is deleted', async () => {
    const { catalog, index } = await open();
    expect(byName(catalog, '访谈')).toMatchObject({ kind: 'video', ref: { videoId: 'v1' } });
    expect(byName(catalog, '访谈').media).toBeUndefined();

    reader.videos.set(
      videoDir,
      videoContent('v1', 'rev-2', { used: ['asset-applied'], timeline: { width: 1920, height: 1080, frames: 450 } }),
    );
    index.touched(videoDir, 'rev-2');
    await catalog.idle();
    expect(byName(catalog, '访谈').media).toEqual({ durationSec: 15, width: 1920, height: 1080 });
    await catalog.close();

    // Unchanged while closed: reopening does not re-read; the facts are read back from the database.
    const indexDir = path.join(tmp, 'cache', 'content-index');
    let reads = reader.reads;
    const { catalog: same } = await open(indexDir);
    expect(reader.reads).toBe(reads);
    expect(byName(same, '访谈').media).toEqual({ durationSec: 15, width: 1920, height: 1080 });
    await same.close();

    // The database is deleted entirely (it is a cache): on reopen, everything is re-read.
    for (const name of await fs.readdir(indexDir)) await fs.rm(path.join(indexDir, name));
    reads = reader.reads;
    const { catalog: reopened, index: reloaded } = await open(indexDir);
    expect(reader.reads).toBe(reads + 1);
    expect(reloaded.at(videoDir)).toMatchObject({ revision: 'rev-2', facts: { timeline: { durationSec: 15 } } });
    expect(byName(reopened, '访谈').media).toEqual({ durationSec: 15, width: 1920, height: 1080 });
  });

  it('derived child video: the entry\'s origin points to the parent video, the version and range at derivation, recognized again by idempotency key', async () => {
    const { catalog, index } = await open();
    expect(byName(catalog, '访谈').origin).toBeUndefined();
    const content = videoContent('v1', 'rev-2');
    const summary = { schema: 'cuccut.derivation/1', parentVideoId: 'v_parent', parentRevision: '7', key: 'abc123def456', range: { start: 1, end: 2 } };
    (content.snapshot as unknown as { documents: unknown }).documents = {
      doc_d: { id: 'doc_d', kind: 'derivation', name: '派生来源', currentRevision: '1', revisions: { '1': { summary } } },
    };
    reader.videos.set(videoDir, content);
    index.touched(videoDir, 'rev-2');
    await catalog.idle();
    expect(byName(catalog, '访谈').origin).toEqual({
      source: 'derived',
      projectId: byName(catalog, '访谈').source.projectId,
      videoId: 'v_parent',
      videoRevision: '7',
      range: { start: 1, end: 2 },
      capability: 'videos-derive',
    });
    const find = spaceDerivedFinder(catalog);
    expect(await find('v_parent', 'abc123def456')).toBe(videoDir);
    expect(await find('v_parent', 'other')).toBeNull();
  });

  it('list by video (videoId): the video itself, its exported entries and the child videos derived from it', async () => {
    const childDir = path.join(projectDir, '短片一');
    await fs.mkdir(childDir);
    await fs.writeFile(path.join(childDir, 'video.db'), 'db');
    const child = videoContent('v_child', 'rev-1');
    const summary = { schema: 'cuccut.derivation/1', parentVideoId: 'v1', parentRevision: 'rev-1', key: 'k1', range: { start: 1, end: 2 } };
    (child.snapshot as unknown as { documents: unknown }).documents = {
      doc_d: { id: 'doc_d', kind: 'derivation', name: '派生来源', currentRevision: '1', revisions: { '1': { summary } } },
    };
    reader.videos.set(childDir, child);
    await seedJobs();
    const { catalog } = await open();
    const names = listEntries(catalog, USER_VIEWER, { videoId: 'v1' }).entries.map((e) => e.fileName);
    expect(names).toEqual(expect.arrayContaining(['访谈', '访谈.srt', '短片一']));
    expect(listEntries(catalog, USER_VIEWER, { videoId: 'v1', kind: 'video' }).entries.map((e) => e.fileName).sort()).toEqual(['短片一', '访谈']);
    // A sub-video's own filter applies only to itself.
    expect(listEntries(catalog, USER_VIEWER, { videoId: 'v_child' }).entries.map((e) => e.fileName)).toEqual(['短片一']);
  });

  it('ensure: unindexed videos are moved to the front of the queue and read first, returning once read; for videos not in the catalog or timed out, answer with what is at hand', async () => {
    const dirs = ['甲', '乙', '丙'].map((name) => path.join(projectDir, name));
    for (const [i, dir] of dirs.entries()) {
      await fs.mkdir(dir, { recursive: true });
      reader.videos.set(dir, videoContent(`v${i}`, 'rev-1'));
    }
    const order: string[] = [];
    const read = reader.readContent.bind(reader);
    reader.readContent = async (dir: string) => {
      order.push(path.basename(dir));
      return read(dir);
    };
    let release!: () => void;
    reader.hold = new Promise((resolve) => (release = resolve));
    const index = new ContentIndex({ dir: path.join(tmp, 'cache', 'ensure'), reader, log: silentLogger });
    await index.sync(dirs.map((dir) => ({ dir, mtimeMs: 1 })));
    // A is reading (blocked): wait for B to time out, then answer with what is on hand (nothing yet). Afterwards C is placed ahead of B.
    expect(await index.ensure(dirs[1]!, 10)).toBeNull();
    expect(await index.ensure(path.join(projectDir, '不在目录里'))).toBeNull();
    const third = index.ensure(dirs[2]!);
    release();
    expect(await third).toMatchObject({ videoId: 'v2', facts: { poster: null } });
    await index.idle();
    expect(order).toEqual(['甲', '丙', '乙']);
    // Those that already have a current index do not wait.
    reader.hold = new Promise(() => {});
    expect(await index.ensure(dirs[0]!, 10_000)).toMatchObject({ videoId: 'v0' });
    await index.close();
  });

  it('tool candidate input: filters videos by the tool\'s rules, including scripts and existing translations; unindexed ones are still listed; pagination, project, trash and subject', async () => {
    reader.videos.set(videoDir, { ...speechContent('v1', 'rev-1', 'en'), name: '访谈' });
    const plain = path.join(projectDir, '没有转写');
    const broken = path.join(projectDir, '读不了');
    for (const dir of [plain, broken]) {
      await fs.mkdir(dir);
      await fs.writeFile(path.join(dir, 'video.db'), 'db');
    }
    reader.videos.set(plain, { ...videoContent('v2', 'r1'), name: '没有转写' });
    reader.videos.set(broken, videoContent('v3', 'r1'));
    reader.failing.add(broken);
    const { catalog } = await open();
    const transcribe = toolDefinition('transcribe')!;
    const dub = toolDefinition('dub')!;
    const names = (result: { candidates: { name: string }[] }) => result.candidates.map((c) => c.name).sort();

    const all = toolCandidates(catalog, USER_VIEWER, transcribe, {});
    expect(names(all)).toEqual(['没有转写', '访谈', '读不了']);
    expect(all).toMatchObject({ toolId: 'transcribe', total: 3, complete: false, pendingVideos: 1, nextCursor: null });
    expect(all.candidates.find((c) => c.name === '读不了')).toMatchObject({ indexed: false, documents: [] });
    // Transcription does not need a script, so no documents are listed.
    expect(all.candidates.find((c) => c.name === '访谈')).toMatchObject({
      videoId: 'v1',
      indexed: true,
      indexedRevision: 'rev-1',
      documents: [],
    });

    // Translation dubbing lists only videos that have a script (videos that cannot be read cannot be judged, so they are still listed). The script carries its language, per-word timing and existing translations.
    const dubbing = toolCandidates(catalog, USER_VIEWER, dub, {});
    expect(names(dubbing)).toEqual(['访谈', '读不了']);
    expect(dubbing.candidates.find((c) => c.name === '访谈')!.documents).toEqual([
      {
        kind: 'speech',
        documentId: 'speech-v1',
        name: '转写',
        language: 'zh',
        wordTiming: true,
        onTimeline: false,
        translations: [{ documentId: 'tr-v1', language: 'en', units: 1, staleUnits: 1 }],
        dubs: [],
      },
    ]);

    // Pagination and projects.
    const first = toolCandidates(catalog, USER_VIEWER, transcribe, { limit: 2 });
    expect(first).toMatchObject({ total: 3, nextCursor: '2' });
    expect(toolCandidates(catalog, USER_VIEWER, transcribe, { limit: 2, cursor: '2' }).candidates).toHaveLength(1);
    expect(toolCandidates(catalog, USER_VIEWER, transcribe, { projectId: 'nope' })).toMatchObject({ total: 0, candidates: [] });
    expect(toolCandidates(catalog, USER_VIEWER, transcribe, { projectId: 'p1' }).total).toBe(3);

    // Principal: a session sees only its own source directory. External services follow the video allowlist; videos outside it, and videos whose videoId is unknown, are not listed.
    const agent: SpaceViewer = { kind: 'source', projectId: null, conversationId: 'c9' };
    expect(toolCandidates(catalog, agent, transcribe, {}).total).toBe(0);
    const service: SpaceViewer = { kind: 'service', videos: new Set(['v2']), owns: () => false, jobs: () => null };
    expect(names(toolCandidates(catalog, service, transcribe, {}))).toEqual(['没有转写']);
    expect(toolCandidates(catalog, service, transcribe, {})).toMatchObject({ pendingVideos: 0 });

    // Videos in the trash are not listed.
    await trashVideo(catalog);
    await catalog.idle();
    expect(names(toolCandidates(catalog, USER_VIEWER, transcribe, {}))).toEqual(['没有转写', '读不了']);
  });
  /** Deletes a video in the order of `VideoTrash`: record it first, then move the directory into the trash, then rescan the source. */
  async function trashVideo(catalog: SpaceCatalog, trashedAt = new Date().toISOString()) {
    const info = (await catalog.videoEntryAt(videoDir))!;
    const trashRelPath = `.ccut-trash/t1/${path.basename(videoDir)}`;
    const entryId = catalog.trashEntryId(info.sourceKey, trashRelPath);
    await catalog.recordTrashedVideo(entryId, {
      formerEntryId: info.entry.id,
      sourceKey: info.sourceKey,
      projectId: 'p1',
      conversationId: null,
      relPath: info.relPath,
      trashRelPath,
      videoId: 'v1',
      name: info.entry.name,
      size: info.entry.size,
      trashedAt,
    });
    const to = path.join(projectDir, ...trashRelPath.split('/'));
    await fs.mkdir(path.dirname(to), { recursive: true });
    await fs.rename(videoDir, to);
    await catalog.refreshSource(info.sourceKey);
    return { entryId, formerId: info.entry.id, to };
  }

  const detailCode = async (fn: () => unknown) => {
    try {
      await fn();
    } catch (error) {
      return ((error as RpcError).details as { code?: string } | undefined)?.code;
    }
    throw new Error('应该拒绝');
  };

  it('deleted videos: trash entries and old ids can be found; permanent delete checks references, deletes only files managed by the video, linked media originals are not touched', async () => {
    const { catalog } = await open();
    const former = byName(catalog, '访谈');
    await catalog.update({ entryId: former.id, favorite: true });
    await fs.mkdir(path.join(videoDir, 'blobs'));
    await fs.writeFile(path.join(videoDir, 'blobs', 'b1'), 'blob');
    await fs.writeFile(path.join(videoDir, 'video.db-wal'), 'wal');
    await fs.writeFile(path.join(videoDir, '笔记.txt'), '用户放进来的');

    // Directly changing the marker cannot move a video into the trash (the method layer hands it to `videos.delete`).
    expect(await detailCode(() => catalog.update({ entryId: former.id, trashed: true }))).toBe('SPACE_TRASH_VIDEO');

    const { entryId, formerId, to } = await trashVideo(catalog);
    expect(entryId).not.toBe(formerId);
    expect(catalog.get(entryId)).toMatchObject({
      kind: 'video',
      name: former.name,
      relPath: '访谈',
      source: { projectId: 'p1' },
      ref: { videoId: 'v1' },
      user: { favorite: true },
    });
    expect(catalog.get(entryId).user.trashedAt).not.toBeNull();
    expect(() => catalog.get(formerId)).toThrow(RpcError);
    // The trash directory is not scanned in as a video from the source directory.
    expect(catalog.videos()).toEqual([]);
    expect(listEntries(catalog, USER_VIEWER, { kind: 'video' }).entries).toEqual([]);
    expect(listEntries(catalog, USER_VIEWER, { trash: 'only' }).entries.map((e) => e.id)).toEqual([entryId]);
    expect(catalog.trashedVideo(formerId)?.entryId).toBe(entryId);
    expect(catalog.trashedVideo(entryId)?.record.trashRelPath).toBe('.ccut-trash/t1/访谈');
    expect(await detailCode(() => catalog.openForEdit(entryId))).toBe('VIDEO_TRASHED');
    expect(await detailCode(() => catalog.locate(entryId))).toBe('VIDEO_TRASHED');
    expect(await detailCode(() => catalog.update({ entryId, trashed: false }))).toBe('SPACE_TRASH_VIDEO');

    // Files in the directory that are not managed by the video: not deleted, but listed.
    expect(await catalog.purge(entryId)).toEqual({
      status: 'blocked',
      entryId,
      references: [expect.objectContaining({ kind: 'user-file', detail: expect.stringContaining('笔记.txt') })],
    });
    await fs.rm(path.join(to, '笔记.txt'));

    // Jobs whose results are waiting for the user to decide whether to write them into this video, and jobs in progress: not deleted.
    const pending = job({ kind: 'generateImage', state: 'needs-reconciliation', videoId: 'v1' });
    jobs.put(pending);
    expect(await catalog.purge(entryId)).toMatchObject({ status: 'blocked', references: [{ kind: 'job', jobId: pending.jobId }] });
    jobs.put({ ...pending, state: 'cancelled' });

    expect(await catalog.purge(entryId)).toEqual({ status: 'purged', entryId });
    await expect(fs.stat(to)).rejects.toThrow();
    await expect(fs.stat(path.join(projectDir, '.ccut-trash'))).rejects.toThrow();
    // The original file of a linked asset is outside the video directory: not touched.
    await expect(fs.readFile(path.join(projectDir, 'raw', 'clip.mp4'), 'utf8')).resolves.toBe('mp4');
    expect(() => catalog.get(entryId)).toThrow(RpcError);
    expect(marks.trashedVideos().size).toBe(0);
  });

  it('deleted videos: at startup, records are checked against where the directory actually is; permanent delete happens only after the trash retention period, and referenced ones are kept', async () => {
    const first = await open();
    const info = (await first.catalog.videoEntryAt(videoDir))!;
    // Recorded, but the directory was not moved (crash during deletion): after restart the record is removed, the video stays in place, and the marker goes back to the original entry.
    await first.catalog.update({ entryId: info.entry.id, favorite: true });
    await first.catalog.recordTrashedVideo(first.catalog.trashEntryId(info.sourceKey, '.ccut-trash/t0/访谈'), {
      formerEntryId: info.entry.id,
      sourceKey: info.sourceKey,
      projectId: 'p1',
      conversationId: null,
      relPath: info.relPath,
      trashRelPath: '.ccut-trash/t0/访谈',
      videoId: 'v1',
      name: info.entry.name,
      size: info.entry.size,
      trashedAt: new Date().toISOString(),
    });
    await first.catalog.close();
    const second = await open();
    expect(marks.trashedVideos().size).toBe(0);
    expect(second.catalog.get(info.entry.id)).toMatchObject({ kind: 'video', user: { favorite: true, trashedAt: null } });

    // Actually moved in: still in the trash after restart.
    const now = Date.now();
    const { entryId } = await trashVideo(second.catalog, new Date(now - 31 * 86_400_000).toISOString());
    const cover = byName(second.catalog, 'cover.png');
    await second.catalog.update({ entryId: cover.id, trashed: true });
    const clip = byName(second.catalog, 'clip.mp4');
    await second.catalog.update({ entryId: clip.id, trashed: true });
    await second.catalog.close();
    const { catalog } = await open();
    expect(catalog.get(entryId).user.trashedAt).not.toBeNull();

    // Retention period is 30 days: a video just moved in is not deleted; a video deleted 31 days ago is deleted.
    expect(await catalog.sweepTrash(30, now)).toEqual({ purged: 1, kept: 0 });
    expect(() => catalog.get(entryId)).toThrow(RpcError);
    // After expiry: those with no references are deleted.
    expect(await catalog.sweepTrash(30, now + 31 * 86_400_000)).toEqual({ purged: 2, kept: 0 });
    await expect(fs.stat(path.join(projectDir, 'cover.png'))).rejects.toThrow();
    await expect(fs.stat(path.join(projectDir, 'raw', 'clip.mp4'))).rejects.toThrow();
  });

  it('trash retention: files still linked by a video are kept even after expiry', async () => {
    const { catalog } = await open();
    const clip = byName(catalog, 'clip.mp4');
    await catalog.update({ entryId: clip.id, trashed: true });
    expect(await catalog.sweepTrash(30, Date.now() + 31 * 86_400_000)).toEqual({ purged: 0, kept: 1 });
    await expect(fs.readFile(path.join(projectDir, 'raw', 'clip.mp4'), 'utf8')).resolves.toBe('mp4');
    expect(catalog.get(clip.id).user.trashedAt).not.toBeNull();
  });

  it('internal artifacts of the voiceover pipeline: keep only references, not in the catalog; still referenced after Ledger pruning, not deleted by artifact store sweep', async () => {
    const audio = artifactIdOf(Buffer.from('dub audio'));
    const plan = `sha256:${'e'.repeat(64)}`;
    const dub = job({
      kind: 'pipeline',
      state: 'completed',
      videoId: 'v1',
      inputHash: `sha256:${'f'.repeat(64)}`,
      pipeline: {
        name: 'dub',
        label: '配音',
        stoppedAt: null,
        summary: null,
        steps: [
          { name: 'synthesize', label: '合成', status: 'completed', jobId: 'job_synth', attempts: 1, output: { artifactId: plan, units: { u1: { artifactId: audio } } } },
        ],
      } as unknown as JobRecord['pipeline'],
    });
    jobs.put(dub);
    const file = path.join(tmp, 'store', 'space-artifacts.json');
    const artifacts = new SpaceArtifactStore(file);
    await artifacts.load();
    const baseline = (await open()).catalog.entries().length;
    const first = await open(undefined, artifacts);
    // Does not derive new directory entries, and does not keep the facts used for derivation.
    expect(first.catalog.entries()).toHaveLength(baseline);
    expect(first.catalog.entries().some((e) => e.id === audio || e.id === plan)).toBe(false);
    expect(artifacts.list()).toEqual([]);
    expect(artifacts.references()).toEqual([{ jobId: dub.jobId, kind: 'pipeline', videoId: 'v1', endedAt: dub.endedAt, artifactIds: [audio, plan].sort() }]);
    await first.catalog.close();
    await artifacts.flush();

    // The Ledger pruned this dubbing job: after restart the reference still exists, and the artifact store sweep does not delete its audio.
    jobs.records = [];
    const reloaded = new SpaceArtifactStore(file);
    await reloaded.load();
    const refs = await reloaded.referencedArtifactIds();
    expect(refs.has(audio) && refs.has(plan)).toBe(true);
    expect(refs.has(dub.inputHash)).toBe(false);
    const store = new ArtifactStore(path.join(tmp, 'artifacts'));
    const kept = await store.put(Buffer.from('dub audio'), 'wav');
    const orphan = await store.put(Buffer.from('orphan'), 'wav');
    const old = new Date(Date.now() - 2 * 60 * 60 * 1000);
    for (const f of [kept.path, orphan.path]) await fs.utimes(f, old, old);
    expect(kept.artifactId).toBe(audio);
    const result = await store.sweep(refs);
    expect(result).toMatchObject({ removed: 1 });
    await expect(fs.stat(kept.path)).resolves.toBeTruthy();
    await expect(fs.stat(orphan.path)).rejects.toThrow();
  });

  it('video created by a pipeline: after the Job Ledger prunes this run, the video entry\'s source is still present', async () => {
    const created = job({
      kind: 'pipeline',
      state: 'completed',
      videoId: 'v1',
      pipeline: {
        name: 'transcribe',
        label: '转录',
        stoppedAt: null,
        summary: null,
        steps: [
          { name: 'target', label: '解析目标', status: 'skipped', jobId: null, attempts: 0, output: null },
          { name: 'create', label: '新建视频', status: 'completed', jobId: 'job_step', attempts: 1, output: { videoId: 'v1', place: {} } },
        ],
      } as unknown as JobRecord['pipeline'],
    });
    jobs.put(created);
    const file = path.join(tmp, 'store', 'space-artifacts.json');
    const artifacts = new SpaceArtifactStore(file);
    await artifacts.load();
    const first = await open(undefined, artifacts);
    const origin = { source: 'imported', projectId: 'p1', videoId: 'v1', jobId: created.jobId, capability: 'transcribe' };
    expect(byName(first.catalog, '访谈')).toMatchObject({ kind: 'video', origin });
    await first.catalog.close();

    // The Ledger pruned this run: after restart the source still exists (the record has no artifacts, so it is not removed as if clearing had completed).
    jobs.records = [];
    const reloaded = new SpaceArtifactStore(file);
    await reloaded.load();
    const { catalog } = await open(undefined, reloaded);
    expect(byName(catalog, '访谈')).toMatchObject({ kind: 'video', origin });
    await catalog.purge('sha256:none').catch(() => {});
    expect(reloaded.list().map((f) => f.jobId)).toEqual([created.jobId]);
  });

  it('artifact records: artifact entries remain after the Job Ledger prunes the task; records are removed after all artifacts are permanently deleted', async () => {
    await seedJobs();
    const file = path.join(tmp, 'store', 'space-artifacts.json');
    const artifacts = new SpaceArtifactStore(file);
    await artifacts.load();
    const first = await open(undefined, artifacts);
    const before = first.catalog.get('sha256:aa');
    expect(before).toMatchObject({ status: 'applied', origin: { source: 'generated', videoId: 'v1' } });
    await first.catalog.close();
    // The record holds only the facts used for derivation, not the rest of the Ledger's content.
    const saved = JSON.parse(await fs.readFile(file, 'utf8')) as { jobs: Record<string, unknown>[] };
    expect(saved.jobs.map((j) => j.kind).sort()).toEqual(['export', 'generateImage']);
    expect(saved.jobs.every((j) => !('warnings' in j) && !('contentHash' in j))).toBe(true);

    // The Ledger pruned all jobs (no event sent): after restart the artifacts and exports still exist, and the placeholders do not.
    jobs.records = [];
    const reloaded = new SpaceArtifactStore(file);
    await reloaded.load();
    const { catalog } = await open(undefined, reloaded);
    expect(catalog.get('sha256:aa')).toEqual(before);
    expect(catalog.get('sha256:bb')).toMatchObject({ status: 'candidate' });
    expect(byName(catalog, '访谈.srt')).toMatchObject({ kind: 'subtitle', status: 'published', ref: { artifactId: 'sha256:srt' } });
    expect(catalog.entries().some((e) => e.status === 'generating' || e.status === 'failed')).toBe(false);

    // Some artifacts of one job are deleted and the record is kept; it is removed once all are deleted, and the purge marker is no longer needed.
    for (const id of ['sha256:bb', 'sha256:aa']) {
      await catalog.update({ entryId: id, trashed: true });
      expect(await catalog.purge(id)).toMatchObject({ status: 'purged' });
      expect(reloaded.list().some((f) => f.kind === 'generateImage')).toBe(id === 'sha256:bb');
    }
    expect(marks.get('sha256:aa')).toEqual(marks.get('sha256:never'));
    expect(reloaded.list().map((f) => f.kind)).toEqual(['export']);
  });

  it('file-to-file pipeline: published subtitle files are merged into the scanned file or listed separately, source is generated, with pipeline name and executor; still present after Ledger pruning', async () => {
    const inside = path.join(projectDir, 'raw', 'clip.zh-CN.srt');
    const outside = path.join(otherDir, 'talk.zh-CN.vtt');
    await fs.writeFile(inside, '1\n00:00:01,000 --> 00:00:02,000\n你好\n');
    await fs.writeFile(outside, 'WEBVTT\n');
    const output = (artifactId: string, file: string, format: 'srt' | 'vtt') => ({
      artifactId,
      mediaType: format === 'srt' ? 'application/x-subrip' : 'text/vtt',
      byteLength: 10,
      assetId: null,
      media: { kind: 'text' as const, entries: 1, durationSec: 2 },
      path: file,
      format,
    });
    const translated = (artifactId: string, file: string, format: 'srt' | 'vtt') =>
      job({
        kind: 'pipeline',
        state: 'completed',
        providerId: 'openai',
        modelId: 'gpt',
        pipeline: { name: 'translate-subtitles', steps: [] } as never,
        result: { documentId: null, artifactId, outputs: [output(artifactId, file, format)] },
      });
    jobs.put(translated('sha256:in', inside, 'srt'));
    jobs.put(translated('sha256:out', outside, 'vtt'));
    // A download is also a file artifact; project ownership and the file's physical directory are independent.
    jobs.put(
      job({
        kind: 'pipeline',
        state: 'completed',
        pipeline: { name: 'link-import', params: { projectId: 'assigned-project' }, steps: [] } as never,
        result: { documentId: null, artifactId: 'sha256:dl', outputs: [output('sha256:dl', path.join(projectDir, 'cover.png'), 'srt')] },
      }),
    );
    const file = path.join(tmp, 'store', 'space-artifacts.json');
    const artifacts = new SpaceArtifactStore(file);
    await artifacts.load();
    const first = await open(undefined, artifacts);
    const origin = { source: 'generated', capability: 'translate-subtitles', provider: { providerId: 'openai', modelId: 'gpt' } };
    expect(byName(first.catalog, 'clip.zh-CN.srt')).toMatchObject({
      kind: 'subtitle',
      relPath: 'raw/clip.zh-CN.srt',
      status: 'published',
      ref: { artifactId: 'sha256:in' },
      origin,
      media: { mediaType: 'application/x-subrip', durationSec: 2 },
    });
    const standalone = first.catalog.get('sha256:out');
    expect(standalone).toMatchObject({ kind: 'subtitle', fileName: 'talk.zh-CN.vtt', status: 'published', origin });
    expect(byName(first.catalog, 'cover.png').origin).toMatchObject({ capability: 'link-import', projectId: 'assigned-project' });
    expect(projectOf(byName(first.catalog, 'cover.png'))).toBe('assigned-project');
    await first.catalog.close();

    // The artifact record keeps only the workflow name; after the Ledger is pruned and the app restarts, the entry still exists.
    const saved = JSON.parse(await fs.readFile(file, 'utf8')) as { jobs: Array<{ kind: string; pipeline?: unknown }> };
    expect(saved.jobs.map((j) => j.pipeline)).toEqual(expect.arrayContaining([{ name: 'translate-subtitles' }, { name: 'link-import', params: { projectId: 'assigned-project' } }]));
    expect(saved.jobs).toHaveLength(3);
    jobs.records = [];
    const reloaded = new SpaceArtifactStore(file);
    await reloaded.load();
    const { catalog } = await open(undefined, reloaded);
    expect(catalog.get('sha256:out')).toEqual(standalone);
    expect(projectOf(byName(catalog, 'cover.png'))).toBe('assigned-project');
    expect(byName(catalog, 'clip.zh-CN.srt')).toMatchObject({ ref: { artifactId: 'sha256:in' }, origin });
  });
  it('files handed over by downloads_save: registered as deliverables, listed separately outside the source directory, with session and pipeline name, without provider; still present after restart', async () => {
    const downloads = path.join(tmp, 'Downloads');
    await fs.mkdir(downloads);
    const delivered = path.join(downloads, 'talk.blog.zh-CN.md');
    await fs.writeFile(delivered, '# 标题\n');
    const file = path.join(tmp, 'store', 'space-artifacts.json');
    const artifacts = new SpaceArtifactStore(file);
    await artifacts.load();
    const first = await open(undefined, artifacts);
    const artifactId = `sha256:${'a'.repeat(64)}`;
    await first.catalog.recordHandover({
      path: delivered,
      bytes: 9,
      artifactId,
      submitter: { kind: 'agent', id: 'conv_1', taskId: 'task_1' },
      at: '2026-10-10T00:00:00.000Z',
    });
    const entry = first.catalog.get(artifactId);
    expect(entry).toMatchObject({
      kind: 'document',
      fileName: 'talk.blog.zh-CN.md',
      source: { projectId: null, conversationId: null },
      status: 'published',
      file: { path: delivered },
      ref: { artifactId },
      origin: { source: 'generated', capability: 'downloads-save', conversationId: 'conv_1', taskId: 'task_1' },
      media: { mediaType: 'text/markdown' },
    });
    expect(entry.origin?.provider).toBeUndefined();
    expect(first.catalog.locateBytes(artifactId)).toEqual({ root: downloads, file: delivered });
    await first.catalog.close();

    // Not via the Job Ledger: this entry in the artifact record reads back and is recognized; after restart the entry still exists.
    const reloaded = new SpaceArtifactStore(file);
    await reloaded.load();
    expect(reloaded.list().map((facts) => facts.pipeline)).toEqual([{ name: 'downloads-save' }]);
    const { catalog } = await open(undefined, reloaded);
    expect(catalog.get(artifactId)).toEqual(entry);
  });

  it('tool\'s Space entry input: replaced with a file path or text; trash, wrong kind, or missing file are rejected at submit; results in the save location carry file', async () => {
    const subtitle = path.join(projectDir, 'raw', 'talk.srt');
    await fs.writeFile(subtitle, '1\n00:00:01,000 --> 00:00:02,000\n<i>Hello</i>\n\n2\n00:00:03,000 --> 00:00:04,000\nworld\n');
    await fs.writeFile(path.join(projectDir, 'notes.md'), '# 标题\n正文\n');
    await fs.writeFile(path.join(projectDir, 'brief.pdf'), '%PDF');
    // The transcription output is written only to the save location (outside the source directory); speech synthesis saved an extra copy elsewhere.
    const saved = path.join(otherDir, 'clip.txt');
    await fs.writeFile(saved, 'Hello\n');
    const audioCopy = path.join(otherDir, 'Hello.mp3');
    await fs.writeFile(audioCopy, 'mp3');
    const art = path.join(tmp, 'artifacts');
    await fs.mkdir(art, { recursive: true });
    jobs.files.set('sha256:mp3', path.join(art, 'mp3.mp3'));
    await fs.writeFile(path.join(art, 'mp3.mp3'), 'mp3');
    const text = (artifactId: string, file: string) => ({
      artifactId,
      mediaType: 'text/plain',
      byteLength: 6,
      assetId: null,
      media: { kind: 'text' as const, entries: 1, durationSec: 1 },
      path: file,
    });
    jobs.put(
      job({
        kind: 'pipeline',
        state: 'completed',
        pipeline: { name: 'transcribe', steps: [] } as never,
        result: { documentId: null, artifactId: 'sha256:txt', outputs: [text('sha256:txt', saved), text('sha256:gone', path.join(otherDir, 'gone.srt'))] },
      }),
    );
    jobs.put(
      job({
        kind: 'synthesizeSpeech',
        state: 'completed',
        result: {
          documentId: null,
          artifactId: 'sha256:mp3',
          outputs: [
            { artifactId: 'sha256:mp3', mediaType: 'audio/mpeg', byteLength: 3, assetId: null, media: { kind: 'audio', durationSec: 1, sampleRate: 48000, channels: 1 }, path: audioCopy },
          ],
        },
      }),
    );
    const { catalog } = await open();
    const transcript = catalog.get('sha256:txt');
    expect(transcript).toMatchObject({ kind: 'document', file: { path: saved }, origin: { capability: 'transcribe' } });
    expect(catalog.get('sha256:gone')).toMatchObject({ status: 'missing' });
    expect(catalog.get('sha256:gone').file).toBeUndefined();
    expect(catalog.get('sha256:mp3')).toMatchObject({ kind: 'audio', file: { path: audioCopy } });

    const srt = byName(catalog, 'talk.srt');
    const clip = byName(catalog, 'clip.mp4');
    expect(catalog.resolveFile(srt.id, ['subtitle']).file).toBe(subtitle);
    expect(catalog.resolveFile('sha256:mp3', ['audio']).file).toBe(path.join(art, 'mp3.mp3'));
    const code = (fn: () => unknown) => {
      try {
        fn();
      } catch (error) {
        return [(error as { code: string }).code, (error as { details?: { code?: string } }).details?.code];
      }
      return null;
    };
    expect(code(() => catalog.resolveFile('nope', ['subtitle']))).toEqual(['not-found', undefined]);
    expect(code(() => catalog.resolveFile(byName(catalog, '访谈').id, ['video-file']))).toEqual(['invalid-request', 'SPACE_ENTRY_UNSUPPORTED']);
    expect(code(() => catalog.resolveFile(clip.id, ['subtitle']))).toEqual(['invalid-request', 'SPACE_ENTRY_UNSUPPORTED']);
    expect(code(() => catalog.resolveFile('sha256:gone', ['document', 'subtitle']))).toEqual(['conflict', 'SPACE_ENTRY_NO_FILE']);

    // Workflow parameters: only `{ entryId }` is replaced; the path and other fields are kept as they are.
    expect(resolvePipelineEntryInputs(catalog, 'transcribe', { file: { entryId: clip.id }, language: 'en' })).toEqual({
      file: path.join(projectDir, 'raw', 'clip.mp4'),
      language: 'en',
    });
    expect(resolvePipelineEntryInputs(catalog, 'transcode', { action: 'compress', inputs: ['/a.mp4', { entryId: clip.id }] })).toEqual({
      action: 'compress',
      inputs: ['/a.mp4', path.join(projectDir, 'raw', 'clip.mp4')],
    });
    expect(resolvePipelineEntryInputs(catalog, 'translate-subtitles', { input: { entryId: srt.id }, targetLanguage: 'zh' })).toEqual({
      input: subtitle,
      targetLanguage: 'zh',
    });
    expect(code(() => resolvePipelineEntryInputs(catalog, 'translate-subtitles', { input: { entryId: clip.id } }))).toEqual([
      'invalid-request',
      'SPACE_ENTRY_UNSUPPORTED',
    ]);
    const untouched = { videoId: 'v1', target: { entryId: 'x' } };
    expect(resolvePipelineEntryInputs(catalog, 'translate', untouched)).toBe(untouched);

    // Material: subtitles have timecodes and markup stripped, documents are kept as they are; PDF is not text.
    expect(await materialText(catalog, srt.id)).toEqual({ text: 'Hello\nworld', fileName: 'talk.srt' });
    expect((await materialText(catalog, byName(catalog, 'notes.md').id)).text).toBe('# 标题\n正文\n');
    await expect(materialText(catalog, byName(catalog, 'brief.pdf').id)).rejects.toMatchObject({
      details: { code: 'SPACE_ENTRY_UNSUPPORTED' },
    });
    await expect(materialText(catalog, clip.id)).rejects.toMatchObject({ details: { code: 'SPACE_ENTRY_UNSUPPORTED' } });
    expect(await withSpeechMaterial(catalog, { text: '', material: { entryId: srt.id }, voice: 'alloy' })).toEqual({
      text: 'Hello\nworld',
      voice: 'alloy',
    });
    expect(await withSpeechMaterial(catalog, { text: '你好' })).toEqual({ text: '你好' });
    expect(
      await withTextMaterial(catalog, {
        messages: [
          { role: 'system', content: '简洁' },
          { role: 'user', content: '总结一下 ' },
        ],
        material: { entryId: srt.id },
      }),
    ).toEqual({
      messages: [
        { role: 'system', content: '简洁' },
        { role: 'user', content: '总结一下\n\ntalk.srt\n\nHello\nworld' },
      ],
    });

    // Entry in the trash.
    await catalog.update({ entryId: srt.id, trashed: true });
    expect(code(() => catalog.resolveFile(srt.id, ['subtitle']))).toEqual(['conflict', 'SPACE_ENTRY_TRASHED']);
  });
});
