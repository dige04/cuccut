import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { CucCutClient } from '@cuccut/client';
import { RpcError, newId, type LibraryEvent, type LibrarySnapshot, type Project, type TranscriptionGlossary } from '@cuccut/protocol';
import { resolveRuntimeHome, type RuntimeHome } from '@cuccut/runtime-storage';
import { startRuntime, type RunningRuntime } from '../runtime.ts';
import { resolveEngineHostCommand } from '../videos/engine-host.ts';

/**
 * The user library through the Runtime (architecture design §5.9): the `library.*` methods, the `library` topic, data after a restart, and that it does not enter Space.
 * Voice packs use a wav generated on the spot by ffmpeg (skipped without ffmpeg). Copying into a video uses the real engine (skipped without a build).
 */

const engine = resolveEngineHostCommand();
const ffmpeg = (() => {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
    execFileSync('ffprobe', ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();
if (!ffmpeg) console.warn('跳过音色包与拷进视频的测试：没有 ffmpeg / ffprobe');
if (!engine) console.warn('跳过拷进视频的测试：没有构建 engine-host（npm run build:engine）');

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6J1sAAAAASUVORK5CYII=', 'base64');

async function until<T>(read: () => T | undefined | null | false, timeoutMs = 5000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = read();
    if (value) return value;
    if (Date.now() > deadline) throw new Error('等待超时');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

async function rejection(promise: Promise<unknown>): Promise<RpcError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof RpcError) return error;
    throw error;
  }
  throw new Error('应该被拒绝');
}

describe('user library (Runtime)', () => {
  let dir: string;
  let home: RuntimeHome;
  let runtime: RunningRuntime;
  let client: CucCutClient;
  let files: string;

  const start = async () => {
    runtime = await startRuntime({ home, drivers: () => [], watchSpace: false, engineHost: engine, videoGraceMs: 100, modelWorker: null });
    const { endpoint, token } = runtime.discovery;
    client = new CucCutClient({
      resolve: async () => ({ endpoint, token }),
      client: { kind: 'desktop', name: 'test', version: '0' },
      reconnect: false,
    });
    await client.connect();
  };

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-library-rt-'));
    files = path.join(dir, 'files');
    await fs.mkdir(files);
    home = resolveRuntimeHome({ CUCCUT_HOME: path.join(dir, 'home') });
    await start();
  });

  afterEach(async () => {
    client.close();
    await runtime.close();
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('topic: the snapshot is each library\'s entry summary, adds, deletes and edits deliver events; data persists after restart', async () => {
    let snapshot: LibrarySnapshot | null = null;
    const events: LibraryEvent[] = [];
    client.subscribe<LibrarySnapshot, LibraryEvent>('library', { snapshot: (s) => (snapshot = s), event: (e) => events.push(e) });
    await until(() => snapshot);
    expect(snapshot!.entries).toEqual([]);

    const { entry: g, created } = await client.request('library.put', {
      library: 'glossaries',
      content: {
        name: '术语',
        kind: 'transcription',
        language: null,
        defaultEnabled: true,
        terms: [{ canonical: 'CucCut', misheard: [] }],
      },
    });
    expect(created).toBe(true);
    const logo = path.join(files, 'logo.png');
    await fs.writeFile(logo, PNG);
    const { entry: image } = await client.request('library.put', {
      library: 'brand',
      content: { name: '标志', kind: 'image' },
      source: { path: logo },
    });
    await client.request('library.put', {
      library: 'glossaries',
      id: g.id,
      expectedVersion: 1,
      content: { ...(g.content as TranscriptionGlossary), name: '术语 2' },
    });
    await client.request('library.remove', { library: 'brand', id: image.id });
    await until(() => events.length === 4);
    expect(events.map((e) => e.type)).toEqual(['entry.upsert', 'entry.upsert', 'entry.upsert', 'entry.removed']);
    expect(events[2]).toMatchObject({ type: 'entry.upsert', entry: { id: g.id, version: 2, name: '术语 2', termCount: 1 } });
    expect(events[3]).toEqual({ type: 'entry.removed', library: 'brand', id: image.id });

    // Inbound validation: unknown library, bad color
    expect((await rejection(client.request('library.list', { library: 'fonts' as never }))).code).toBe('invalid-request');
    expect(
      (await rejection(client.request('library.put', { library: 'brand', content: { name: 'x', kind: 'color', value: 'red' } }))).code,
    ).toBe('invalid-request');
    // An overlay template keeps only its kind
    const reserved = await rejection(
      client.request('library.put', { library: 'brand', content: { name: '片头', kind: 'overlayTemplate' } }),
    );
    expect(reserved.details).toMatchObject({ code: 'LIBRARY_KIND_RESERVED' });

    client.close();
    await runtime.close();
    await start();
    const { entries } = await client.request('library.list', {});
    expect(entries).toEqual([expect.objectContaining({ library: 'glossaries', id: g.id, version: 2, name: '术语 2' })]);
    expect((await client.request('library.get', { library: 'glossaries', id: g.id })).entry.content).toMatchObject({ name: '术语 2' });
  });

  it('does not enter Space; artifacts can serve as file sources; short-lived handles', async () => {
    const { project } = await client.request('projects.create', { name: '库测试' });
    const logo = path.join(files, 'logo.png');
    await fs.writeFile(logo, PNG);
    const { entry } = await client.request('library.import', { path: logo });
    expect(entry).toMatchObject({ library: 'brand', content: { kind: 'image' } });
    await runtime.space.rescan();
    const space = JSON.stringify(runtime.space.snapshot());
    expect(space).not.toContain(entry.id);
    expect(space).not.toContain(path.join(home.root, 'library'));
    expect(runtime.space.snapshot().entries.every((e) => e.source.projectId === project.id || e.source.projectId === null)).toBe(true);

    // A file in the output library as a source (for example, a generated image).
    const artifact = await runtime.models.jobs.artifacts.put(PNG, 'png');
    const fromArtifact = await client.request('library.put', {
      library: 'brand',
      content: { name: '生成的图', kind: 'sticker' },
      source: { artifactId: artifact.artifactId },
    });
    expect(fromArtifact.entry.content).toMatchObject({ kind: 'sticker', file: { mediaType: 'image/png', sha256: artifact.artifactId } });

    const handle = await client.request('library.openHandle', { library: 'brand', id: entry.id });
    expect(handle).toMatchObject({ mimeType: 'image/png', size: PNG.length, fileName: 'logo.png' });
    const response = await fetch(handle.url);
    expect(Buffer.from(await response.arrayBuffer())).toEqual(PNG);
    expect((await rejection(client.request('library.openHandle', { library: 'glossaries', id: 'gls_none' }))).code).toBe('not-found');
  });

  describe.skipIf(!ffmpeg)('voice pack (wav generated by ffmpeg, decode-verified by ffprobe)', () => {
    let wav: string;

    beforeAll(async () => {
      wav = path.join(os.tmpdir(), `cuccut-voice-${process.pid}-${Date.now()}.wav`);
      execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=330:duration=1', '-ac', '1', '-ar', '16000', wav]);
    });

    afterAll(async () => {
      await fs.rm(wav, { force: true });
    });

    it('export then import yields identical content; a recording that cannot be decoded is rejected', async () => {
      const content = {
        name: '我的声音',
        language: 'zh-CN',
        transcript: '一段测试录音',
        origin: 'recorded' as const,
        consent: { declared: true, statement: '本人录制' },
      };
      const { entry: voice } = await client.request('library.put', { library: 'voices', content, source: { path: wav } });
      expect(voice.content).toMatchObject({ reference: { mediaType: 'audio/wav' }, consent: { declared: true } });

      const out = path.join(files, 'voice.bcvoice');
      const exported = await client.request('library.export', { entry: { library: 'voices', id: voice.id }, path: out });
      expect(exported).toMatchObject({ format: 'voice-package', entry: { id: voice.id, version: 1, contentHash: voice.contentHash } });
      // Extension does not matter: import under a different name
      const renamed = path.join(files, 'voice.txt');
      await fs.rename(out, renamed);
      const { entry: back } = await client.request('library.import', { path: renamed });
      expect(back.library).toBe('voices');
      expect(back.id).not.toBe(voice.id);
      expect(back.contentHash).toBe(voice.contentHash);

      // The file header is WAV, but the content cannot be decoded
      const broken = path.join(files, 'broken.wav');
      await fs.writeFile(broken, Buffer.concat([Buffer.from('RIFF\0\0\0\0WAVEfmt ', 'latin1'), Buffer.alloc(200, 7)]));
      const error = await rejection(client.request('library.put', { library: 'voices', content, source: { path: broken } }));
      expect(error.details).toMatchObject({ code: 'LIBRARY_FORMAT_INVALID' });
      // A bad recording leaves no entry behind
      expect((await client.request('library.list', { library: 'voices' })).entries).toHaveLength(2);
    });
  });

  describe.skipIf(!engine || !ffmpeg)('copy into video (real engine)', () => {
    let project: Project;
    let image: string;

    beforeAll(async () => {
      image = path.join(os.tmpdir(), `cuccut-library-image-${process.pid}-${Date.now()}.png`);
      execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=size=64x64:rate=1:duration=1', '-frames:v', '1', image]);
    });

    afterAll(async () => {
      await fs.rm(image, { force: true });
    });

    beforeEach(async () => {
      ({ project } = await client.request('projects.create', { name: '拷进视频' }));
    });

    it('an image becomes managed media, with the source recording the library entry and version; deleting the entry does not affect the video', async () => {
      const opened = await client.request('videos.create', { projectId: project.id, name: '片子' });
      const videoId = opened.ref.videoId;
      const { entry } = await client.request('library.put', {
        library: 'brand',
        content: { name: '标志', kind: 'image' },
        source: { path: image },
      });
      const result = await client.request('library.applyToVideo', {
        videoId,
        entry: { library: 'brand', id: entry.id },
        commandId: newId('cmd'),
      });
      expect(result.entry).toEqual({ library: 'brand', id: entry.id, version: 1, contentHash: entry.contentHash });
      expect(result.receipt.actor).toEqual({ kind: 'user', id: 'user_local' });
      const assetId = result.assetId!;
      const asset = runtime.videos.mirror(videoId)!.video.assets[assetId]!;
      const revision = asset.revisions[asset.currentRevision]!;
      expect(asset.name).toBe('标志');
      expect(revision.storage).toEqual({ mode: 'managed' });
      expect(revision.provenance).toMatchObject({
        origin: 'library',
        source: {
          library: { library: 'brand', entryId: entry.id, version: 1, contentHash: entry.contentHash, kind: 'image', name: '标志' },
        },
      });
      const original = await fs.readFile(image);

      // Delete the entry from the library: the material in the video remains, and its bytes are in the video directory.
      await client.request('library.remove', { library: 'brand', id: entry.id });
      await expect(fs.stat(path.join(home.root, 'library', 'brand', entry.id))).rejects.toThrow();
      const located = await runtime.videos.assetFile(videoId, assetId);
      expect(path.resolve(located.root, located.file).startsWith(opened.ref.path)).toBe(true);
      expect(await fs.readFile(path.resolve(located.root, located.file))).toEqual(original);
      expect(runtime.videos.mirror(videoId)!.video.assets[assetId]).toBeTruthy();
    });

    it('subtitle style is written as a caption-style document; a glossary cannot be copied into a video', async () => {
      const opened = await client.request('videos.create', { projectId: project.id, name: '样式' });
      const videoId = opened.ref.videoId;
      const style = { schema: 'cuccut.studio-style/1', style: { fontSize: 64, color: '#FFFFFF' } };
      const { entry } = await client.request('library.put', { library: 'brand', content: { name: '大字幕', kind: 'captionStyle', style } });
      const result = await client.request('library.applyToVideo', {
        videoId,
        entry: { library: 'brand', id: entry.id },
        commandId: newId('cmd'),
      });
      const documentId = result.documentId!;
      const document = runtime.videos.mirror(videoId)!.video.documents[documentId]!;
      expect(document).toMatchObject({ kind: 'caption-style', name: '大字幕' });
      const content = await client.request('documents.read', { videoId, documentId });
      expect(content.body).toEqual(style);

      // Later changes to the styles in the library do not change the document in the video.
      await client.request('library.put', {
        library: 'brand',
        id: entry.id,
        content: { name: '大字幕', kind: 'captionStyle', style: { schema: 'x/1' } },
      });
      expect((await client.request('documents.read', { videoId, documentId })).body).toEqual(style);

      const { entry: glossary } = await client.request('library.put', {
        library: 'glossaries',
        content: { name: '术语', kind: 'transcription', language: null, defaultEnabled: true, terms: [] },
      });
      const error = await rejection(
        client.request('library.applyToVideo', { videoId, entry: { library: 'glossaries', id: glossary.id }, commandId: newId('cmd') }),
      );
      expect(error.details).toMatchObject({ code: 'LIBRARY_ENTRY_NOT_APPLICABLE' });
    });
  });

  describe.skipIf(!engine)('entries enabled in the video (real engine)', () => {
    let project: Project;

    beforeEach(async () => {
      ({ project } = await client.request('projects.create', { name: '启用' }));
    });

    const glossary = async (name: string, kind: 'transcription' | 'translation', defaultEnabled: boolean) =>
      (
        await client.request('library.put', {
          library: 'glossaries',
          content:
            kind === 'transcription'
              ? { name, kind, language: null, defaultEnabled, terms: [{ canonical: name, misheard: [] }] }
              : {
                  name,
                  kind,
                  sourceLanguage: null,
                  targetLanguage: 'en',
                  defaultEnabled,
                  terms: [{ source: name, target: `${name}-en`, note: null }],
                },
        })
      ).entry;

    it('a new video adopts the glossary enabled by default; the write does not enter the user\'s undo stack; nothing is written when there is no default entry', async () => {
      const bare = await client.request('videos.create', { projectId: project.id, name: '没有默认' });
      expect(await client.request('library.getVideoSelection', { videoId: bare.ref.videoId })).toEqual({
        videoId: bare.ref.videoId,
        documentId: null,
        revision: null,
        selection: { glossaries: { transcribe: [], translate: [] }, speakerVoices: [] },
      });

      const t = await glossary('转写默认', 'transcription', true);
      await glossary('转写不默认', 'transcription', false);
      const x = await glossary('翻译默认', 'translation', true);
      const opened = await client.request('videos.create', { projectId: project.id, name: '有默认' });
      const videoId = opened.ref.videoId;
      const read = await client.request('library.getVideoSelection', { videoId });
      expect(read.selection.glossaries).toEqual({ transcribe: [t.id], translate: [x.id] });
      expect(runtime.videos.mirror(videoId)!.video.documents[read.documentId!]).toMatchObject({ kind: 'library-selection' });
      // The snapshot in the create result already carries this document
      expect(opened.snapshot.video.documents[read.documentId!]).toBeTruthy();
      expect((await client.request('edits.undoState', { videoId })).undo).toBeUndefined();
    });

    it('changing enabled entries: validates kind, speaker and the voice in the library; it is an undoable edit; when transcription provides no glossary, the enabled one is used', async () => {
      const opened = await client.request('videos.create', { projectId: project.id, name: '改' });
      const videoId = opened.ref.videoId;
      const t = await glossary('CucCut', 'transcription', false);
      const x = await glossary('剪辑', 'translation', false);
      const speech = await client.request('edits.apply', {
        videoId,
        commandId: newId('cmd'),
        expectedRevision: opened.snapshot.video.revision,
        operations: [
          {
            type: 'putDocument',
            ref: 'speech',
            kind: 'speech',
            name: '转写',
            body: {
              schema: 'cuccut.speech/1',
              timescale: 1000,
              speakers: [{ id: 'spk_a', name: 'A' }],
              words: [
                { id: 'w1', start: 0, end: 100, text: '你好', speaker: 'spk_a' },
                { id: 'w2', start: 100, end: 200, text: '世界', speaker: 'spk_b' },
              ],
              sentences: null,
            },
          },
        ],
      });
      const speechId = speech.receipt.refs!.speech!;

      const wrongKind = await rejection(
        client.request('library.setVideoSelection', { videoId, commandId: newId('cmd'), glossaries: { transcribe: [x.id] } }),
      );
      expect(wrongKind.details).toMatchObject({ code: 'LIBRARY_ENTRY_NOT_APPLICABLE' });
      const missing = await rejection(
        client.request('library.setVideoSelection', { videoId, commandId: newId('cmd'), glossaries: { translate: ['glo_missing'] } }),
      );
      expect(missing.code).toBe('not-found');
      const noSpeaker = await rejection(
        client.request('library.setVideoSelection', {
          videoId,
          commandId: newId('cmd'),
          speakerVoices: [{ documentId: speechId, speakerId: 'spk_x', voice: 'voice_1' }],
        }),
      );
      expect(noSpeaker.code).toBe('invalid-request');
      const noVoice = await rejection(
        client.request('library.setVideoSelection', {
          videoId,
          commandId: newId('cmd'),
          speakerVoices: [{ documentId: speechId, speakerId: 'spk_a', voice: 'library:voc_missing' }],
        }),
      );
      expect(noVoice.code).toBe('not-found');

      const set = await client.request('library.setVideoSelection', {
        videoId,
        commandId: newId('cmd'),
        glossaries: { transcribe: [t.id], translate: [x.id] },
        speakerVoices: [
          { documentId: speechId, speakerId: 'spk_a', voice: 'voice_a' },
          { documentId: speechId, speakerId: 'spk_b', voice: 'voice_b', providerId: 'elevenlabs' },
        ],
      });
      expect(set.receipt.actor).toEqual({ kind: 'user', id: 'user_local' });
      // When only one step is given, the others stay as they were
      await client.request('library.setVideoSelection', { videoId, commandId: newId('cmd'), glossaries: { translate: [] } });
      const read = await client.request('library.getVideoSelection', { videoId });
      expect(read.documentId).toBe(set.documentId);
      expect(read.selection).toEqual({
        glossaries: { transcribe: [t.id], translate: [] },
        speakerVoices: [
          { documentId: speechId, speakerId: 'spk_a', voice: 'voice_a' },
          { documentId: speechId, speakerId: 'spk_b', voice: 'voice_b', providerId: 'elevenlabs' },
        ],
      });
      await client.request('edits.undo', { videoId, commandId: newId('cmd'), target: 'undo' });
      expect((await client.request('library.getVideoSelection', { videoId })).selection.glossaries.translate).toEqual([x.id]);

      // Delete the entry from the library: the enable record stays, and when enabled glossaries are read, it is skipped
      await client.request('library.remove', { library: 'glossaries', id: t.id });
      expect((await client.request('library.getVideoSelection', { videoId })).selection.glossaries.transcribe).toEqual([t.id]);
      expect(await runtime.library.enabledGlossaries(videoId, 'transcribe')).toEqual({ ids: [], skipped: [t.id] });
      expect(await runtime.library.enabledGlossaries(videoId, 'translate')).toEqual({ ids: [x.id], skipped: [] });
    });
  });
});
