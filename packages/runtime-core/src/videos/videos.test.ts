import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { CucCutClient, applyVideoTopicEvent } from '@cuccut/client';
import { RpcError, newId, type EngineErrorBody, type VideoTopicEvent, type VideoTopicSnapshot, type Project } from '@cuccut/protocol';
import { resolveRuntimeHome } from '@cuccut/runtime-storage';
import { storedZip } from '@cuccut/runtime-storage/testing';
import { startRuntime, type RunningRuntime } from '../runtime.ts';
import { resolveEngineHostCommand } from './engine-host.ts';

/**
 * End to end: the real Runtime, gateway, client, and Rust video engine process.
 * Requires `npm run build:engine` first. Media is generated on the spot with ffmpeg; if either is missing, skip (and say so in the output).
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
if (!engine) console.warn('跳过视频端到端测试：没有构建 engine-host（npm run build:engine）');
if (!ffmpeg) console.warn('跳过视频端到端测试：没有 ffmpeg');

/** Reads the video library's meta table directly (read-only): the owning project and previously used videoId are not in the public protocol. When another reader (Space's scan, the engine) holds the lock, wait for it to be released. */
function videoMeta(videoDir: string): Record<string, string | undefined> {
  const db = new DatabaseSync(path.join(videoDir, 'video.db'), { readOnly: true, timeout: 5000 });
  try {
    const rows = db.prepare('SELECT key, value FROM meta').all() as { key: string; value: string }[];
    return Object.fromEntries(rows.map((row) => [row.key, row.value]));
  } finally {
    db.close();
  }
}

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

describe.skipIf(!engine || !ffmpeg)('videos (real engine)', () => {
  let fixtures: string;
  let clip: string;
  let dir: string;
  let runtime: RunningRuntime;
  let client: CucCutClient;
  let project: Project;

  beforeAll(async () => {
    fixtures = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-fixtures-'));
    clip = path.join(fixtures, 'clip.mp4');
    execFileSync('ffmpeg', [
      '-v',
      'error',
      '-y',
      '-f',
      'lavfi',
      '-i',
      'testsrc=size=320x180:rate=30:duration=2',
      '-f',
      'lavfi',
      '-i',
      'sine=frequency=440:duration=2',
      '-c:v',
      'mpeg4',
      '-c:a',
      'aac',
      '-shortest',
      clip,
    ]);
  });

  afterAll(async () => {
    await fs.rm(fixtures, { recursive: true, force: true });
  });

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-test-'));
    runtime = await startRuntime({
      home: resolveRuntimeHome({ CUCCUT_HOME: dir }),
      drivers: () => [],
      watchSpace: false,
      engineHost: engine,
      videoGraceMs: 100,
    });
    client = await connect();
    ({ project } = await client.request('projects.create', { name: '视频测试' }));
  });

  afterEach(async () => {
    client.close();
    await runtime.close();
    await fs.rm(dir, { recursive: true, force: true });
  });

  async function connect(): Promise<CucCutClient> {
    const { endpoint, token } = runtime.discovery;
    const next = new CucCutClient({
      resolve: async () => ({ endpoint, token }),
      client: { kind: 'desktop', name: 'test', version: '0' },
      reconnect: false,
    });
    await next.connect();
    return next;
  }

  /** A mirror kept up to date by subscription, consistent with what the UI gets. */
  function watch(target: CucCutClient, videoId: string) {
    let current: VideoTopicSnapshot | null = null;
    const events: VideoTopicEvent['type'][] = [];
    target.subscribeVideo(videoId, {
      snapshot: (snapshot) => {
        current = snapshot;
      },
      event: (event) => {
        events.push(event.type);
        current = current && applyVideoTopicEvent(current, event);
      },
    });
    return { get: () => current, events, ready: until(() => current) };
  }

  const sequences = new Map<string, string>();

  async function importClip(videoId: string, revision: string, commandId = newId('cmd')) {
    return client.request('edits.apply', {
      videoId,
      commandId,
      expectedRevision: revision,
      operations: [
        { type: 'importAsset', path: clip, ref: 'clip' },
        { type: 'addItem', sequenceId: sequences.get(videoId)!, asset: { ref: 'clip' }, alignment: 'nearest-frame' },
      ],
    });
  }

  async function create(target: CucCutClient = client, name?: string) {
    const opened = await target.request('videos.create', { projectId: project.id, ...(name ? { name } : {}) });
    sequences.set(opened.ref.videoId, opened.snapshot.video.rootSequenceId);
    return opened;
  }

  it('closing a video cleans blobs/: unreferenced blobs are deleted, referenced ones and fresh staging are kept; with a lease still held, neither closes nor cleans', async () => {
    const { ref, snapshot } = await create(client, 'GC');
    await client.request('edits.apply', {
      videoId: ref.videoId,
      commandId: newId('cmd'),
      expectedRevision: snapshot.video.revision,
      operations: [{ type: 'importAsset', path: clip, storage: 'managed' }],
    });
    const blobs = path.join(ref.path, 'blobs');
    const [managed] = await fs.readdir(blobs).then((names) => names.filter((name) => name !== '.staging'));
    const orphan = path.join(blobs, `${'a'.repeat(64)}.mp4`);
    const fresh = path.join(blobs, '.staging', 'import_fresh');
    await fs.writeFile(orphan, 'orphan');
    await fs.writeFile(fresh, 'being written');

    // With a lease: the opener leaving does not close it, and it is not cleaned up.
    runtime.videos.retain(ref.videoId);
    await client.request('videos.close', { videoId: ref.videoId });
    expect(runtime.videos.mirror(ref.videoId)).not.toBeNull();
    await expect(fs.stat(orphan)).resolves.toBeTruthy();

    // Once the lease is released, close after the grace period, cleaning up before closing.
    runtime.videos.release(ref.videoId);
    await until(() => runtime.videos.mirror(ref.videoId) === null);
    await until(() => !existsSync(orphan));
    expect(existsSync(path.join(blobs, managed!))).toBe(true);
    expect(existsSync(fresh)).toBe(true);
  });

  it('create, import and add; when the receipt arrives the mirror has already applied the event and matches the snapshot the engine rereads', async () => {
    const { ref, snapshot } = await create(client, '第一部');
    expect(ref.relPath).toBe('第一部');
    expect(ref.source.projectId).toBe(project.id);
    const root = snapshot.video.sequences[snapshot.video.rootSequenceId]!;
    expect(root.tracks.map((t) => t.kind)).toEqual(['visual', 'audio']);

    const view = watch(client, ref.videoId);
    await view.ready;
    const { receipt, replayed } = await importClip(ref.videoId, snapshot.video.revision);
    expect(replayed).toBe(false);
    // The rename the engine makes is in English with a reference; the UI shows it in the reader's language (commands and protocol spec §3.1).
    expect([receipt.label, receipt.labelRef]).toEqual(['Add clip', { key: 'engine.labelAddClip' }]);
    expect(receipt.actor).toEqual({ kind: 'user', id: 'user_local' });
    // Events come before the response: when the receipt arrives, the mirror is already at the new version (product design: “Saved” is not shown before the receipt arrives).
    expect(view.get()!.video.revision).toBe(receipt.videoRevision);
    expect(view.get()!.eventSeq).toBe(receipt.eventSeq);
    expect(runtime.videos.mirror(ref.videoId)).toEqual(view.get());

    // Close and reopen: the snapshot the engine reads from disk matches the mirror.
    const before = view.get()!;
    await client.request('videos.close', { videoId: ref.videoId });
    expect(runtime.videos.mirror(ref.videoId)).toBeNull();
    const reopened = await client.request('videos.open', { projectId: project.id, path: '第一部' });
    expect(reopened.ref.videoId).toBe(ref.videoId);
    expect(reopened.ref.relPath).toBe('第一部');
    expect(reopened.ref.path).toBe(ref.path);
    expect(reopened.snapshot).toEqual(before);

    // Space lists the video directory as one entry.
    await runtime.space.rescan();
    const entries = runtime.space.snapshot().entries.filter((e) => e.source.projectId === project.id);
    expect(entries.map((e) => [e.kind, e.relPath])).toEqual([['video', '第一部']]);
    const fromSpace = await client.request('videos.open', { entryId: entries[0]!.id });
    expect(fromSpace.ref.videoId).toBe(ref.videoId);
    expect(fromSpace.ref.relPath).toBe('第一部');
  });

  it('creating with a duplicate name adds a number; creating with the same commandId creates only once', async () => {
    const commandId = newId('cmd');
    const a = await client.request('videos.create', { projectId: project.id, name: '同名', commandId });
    const again = await client.request('videos.create', { projectId: project.id, name: '同名', commandId });
    const b = await client.request('videos.create', { projectId: project.id, name: '同名' });
    expect(again.ref.videoId).toBe(a.ref.videoId);
    expect(b.ref.relPath).toBe('同名 2');
  });

  it('retry and conflict: the same command returns the same receipt, no new event is sent; an old version number is rejected', async () => {
    const { ref, snapshot } = await create();
    const view = watch(client, ref.videoId);
    await view.ready;
    const commandId = newId('cmd');
    const first = await importClip(ref.videoId, snapshot.video.revision, commandId);
    const again = await importClip(ref.videoId, snapshot.video.revision, commandId);
    expect(again.replayed).toBe(true);
    expect(again.receipt).toEqual(first.receipt);
    expect(view.events).toEqual(['video.event']);

    const stale = await rejection(importClip(ref.videoId, snapshot.video.revision));
    expect(stale.code).toBe('conflict');
    expect((stale.details as EngineErrorBody).code).toBe('PROJECT_REVISION_CONFLICT');

    const bad = await rejection(
      client.request('edits.apply', {
        videoId: ref.videoId,
        commandId: newId('cmd'),
        expectedRevision: first.receipt.videoRevision,
        operations: [
          {
            type: 'moveItem',
            sequenceId: snapshot.video.rootSequenceId,
            itemId: 'item_nope',
            at: { unit: 'seconds', value: 1 },
            alignment: 'nearest-frame',
          } as never,
        ],
      }),
    );
    expect(bad.code).toBe('invalid-request');
    expect((bad.details as EngineErrorBody).code).toBe('INVALID_TIME_VALUE');
  });

  it('undo and redo: one undoable step counted per actor, synced through the topic', async () => {
    const { ref, snapshot } = await create();
    const view = watch(client, ref.videoId);
    await view.ready;
    const added = await importClip(ref.videoId, snapshot.video.revision);
    const itemId = added.receipt.createdIds.find((id) => id.startsWith('item'))!;
    const moved = await client.request('edits.apply', {
      videoId: ref.videoId,
      commandId: newId('cmd'),
      expectedRevision: added.receipt.videoRevision,
      operations: [
        {
          type: 'moveItem',
          sequenceId: snapshot.video.rootSequenceId,
          itemId,
          at: { unit: 'seconds', value: '1' },
          alignment: 'nearest-frame',
        },
      ],
    });
    expect((await client.request('edits.undoState', { videoId: ref.videoId })).undo).toMatchObject({
      label: 'Move clips',
      labelRef: { key: 'engine.labelMoveClips' },
    });

    const undone = await client.request('edits.undo', { videoId: ref.videoId, commandId: newId('cmd'), target: 'undo' });
    expect(undone.receipt.undoOf).toBe(moved.receipt.transactionId);
    const item = view.get()!.video.sequences[snapshot.video.rootSequenceId]!.items.find((i) => i.id === itemId)!;
    expect(item.type === 'video' && item.span.fromFrame).toBe(0);

    const state = await client.request('edits.undoState', { videoId: ref.videoId });
    expect(state.redo?.label).toBe('Move clips');
    await client.request('edits.undo', { videoId: ref.videoId, commandId: newId('cmd'), target: 'redo' });
    const redone = view.get()!.video.sequences[snapshot.video.rootSequenceId]!.items.find((i) => i.id === itemId)!;
    expect(redone.type === 'video' && redone.span.fromFrame).toBe(30);

    const { entries } = await client.request('videos.history', { videoId: ref.videoId });
    expect(entries.map((e) => e.label)).toEqual(['Redo: Move clips', 'Undo: Move clips', 'Move clips', 'Add clip']);
    expect(entries[1]!.labelRef).toEqual({
      key: 'engine.labelUndo',
      params: { label: { key: 'engine.labelMoveClips', text: 'Move clips' } },
    });
  });

  it('a modification name supplied by the caller is stored through the gateway with its reference (command and protocol spec §3.1)', async () => {
    const { ref, snapshot } = await create();
    const labelRef = { key: 'editLabel.renameVideo' };
    const renamed = await client.request('edits.apply', {
      videoId: ref.videoId,
      commandId: newId('cmd'),
      expectedRevision: snapshot.video.revision,
      operations: [{ type: 'renameVideo', name: '改名' }],
      label: 'Rename video',
      labelRef,
    });
    expect([renamed.receipt.label, renamed.receipt.labelRef]).toEqual(['Rename video', labelRef]);
    const { entries } = await client.request('videos.history', { videoId: ref.videoId });
    expect(entries[0]!.labelRef).toEqual(labelRef);

    const bad = await rejection(
      client.request('edits.apply', {
        videoId: ref.videoId,
        commandId: newId('cmd'),
        expectedRevision: renamed.receipt.videoRevision,
        operations: [{ type: 'renameVideo', name: '再改' }],
        label: 'Rename video',
        labelRef: { key: 'no-area' },
      }),
    );
    expect(bad.code).toBe('invalid-request');
  });

  it('document body is not in the snapshot, read on demand; without a version, reads the current version', async () => {
    const { ref, snapshot } = await create();
    const body = {
      schema: 'cuccut.caption/1',
      clock: 'sequence',
      timescale: 1_000_000,
      cues: [{ id: 'c1', start: 0, end: 1, text: '你好' }],
    };
    const put = await client.request('edits.apply', {
      videoId: ref.videoId,
      commandId: newId('cmd'),
      expectedRevision: snapshot.video.revision,
      operations: [{ type: 'putDocument', kind: 'caption', name: '字幕', body }],
    });
    const documentId = put.receipt.createdIds.find((id) => id.startsWith('doc'))!;
    const read = await client.request('documents.read', { videoId: ref.videoId, documentId });
    expect(read.body).toEqual(body);
    expect(read.document.kind).toBe('caption');
    expect(read.revision).toBe(read.document.currentRevision);
    await expect(client.request('documents.read', { videoId: ref.videoId, documentId: 'doc_missing' })).rejects.toThrow();
  });

  /** Bytes copied in under the video directory's `blobs/` (excluding `.staging`). */
  async function collectedBlobs(videoDir: string): Promise<string[]> {
    const names = await fs.readdir(path.join(videoDir, 'blobs')).catch(() => [] as string[]);
    return names.filter((name) => name !== '.staging');
  }

  it('importing a link by default keeps the original file: no new bytes under blobs/, media is fetched through the media channel, supports Range', async () => {
    const { ref, snapshot } = await create();
    const added = await importClip(ref.videoId, snapshot.video.revision);
    const assetId = added.receipt.createdIds.find((id) => id.startsWith('asset'))!;
    const asset = runtime.videos.mirror(ref.videoId)!.video.assets[assetId]!;
    expect(asset.revisions[asset.currentRevision]!.storage).toMatchObject({ mode: 'linked', locator: { path: clip } });
    expect(await collectedBlobs(ref.path)).toEqual([]);
    const handle = await client.request('media.resolve', { videoId: ref.videoId, assetId });
    expect(handle.fileName).toBe('clip.mp4');
    expect(handle.mimeType).toBe('video/mp4');
    const response = await fetch(handle.url, { headers: { Range: 'bytes=0-9' } });
    expect(response.status).toBe(206);
    expect((await response.arrayBuffer()).byteLength).toBe(10);
  });

  it('video closed while fetching media location: replies "video is not open", does not throw an internal error', async () => {
    const { ref, snapshot } = await create();
    const added = await importClip(ref.videoId, snapshot.video.revision);
    const assetId = added.receipt.createdIds.find((id) => id.startsWith('asset'))!;
    const [opener] = runtime.videos.usage(ref.videoId)!.openers;
    // A request reached the engine and the video is closed before it replies (this is how idle close lands in the middle of a batch of media.resolve): wait one event-loop turn so it is sent out first.
    const refused = rejection(runtime.videos.assetFile(ref.videoId, assetId));
    await new Promise((resolve) => setImmediate(resolve));
    await runtime.videos.close(ref.videoId, { connectionId: opener!, kind: 'desktop', name: 'test' });
    const error = await refused;
    expect(error.code).toBe('not-found');
    expect(error.details).toMatchObject({ code: 'VIDEO_NOT_OPEN' });
  });

  it('only an explicit managed copies into the video directory; media is still retrievable after the original is deleted', async () => {
    const { ref, snapshot } = await create();
    const copy = path.join(fixtures, 'managed-copy.mp4');
    await fs.copyFile(clip, copy);
    const imported = await client.request('edits.apply', {
      videoId: ref.videoId,
      commandId: newId('cmd'),
      expectedRevision: snapshot.video.revision,
      operations: [{ type: 'importAsset', path: copy, storage: 'managed', ref: 'clip' }],
    });
    const assetId = imported.receipt.refs!.clip!;
    const asset = runtime.videos.mirror(ref.videoId)!.video.assets[assetId]!;
    const revision = asset.revisions[asset.currentRevision]!;
    expect(revision.storage).toEqual({ mode: 'managed' });
    expect(await collectedBlobs(ref.path)).toEqual([`${revision.contentHash.replace('sha256:', '')}.mp4`]);
    await fs.rm(copy);
    const handle = await client.request('media.resolve', { videoId: ref.videoId, assetId });
    expect((await fetch(handle.url)).status).toBe(200);

    // An explicit managed path requires an absolute path.
    const relative = await rejection(
      client.request('edits.apply', {
        videoId: ref.videoId,
        commandId: newId('cmd'),
        expectedRevision: imported.receipt.videoRevision,
        operations: [{ type: 'importAsset', path: '../clip.mp4', storage: 'managed' }],
      }),
    );
    expect((relative.details as EngineErrorBody).code).toBe('INVALID_OPERATION');
  });

  it('linked media is allowed by type: images, audio/video, fonts and Lottie can be previewed; subtitles and other files are not allowed', async () => {
    const { ref, snapshot } = await create();
    const image = path.join(fixtures, 'still.png');
    const tone = path.join(fixtures, 'tone.wav');
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=red:s=16x16', '-frames:v', '1', image]);
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1', tone]);
    const files = {
      image,
      tone,
      logo: path.join(fixtures, 'logo.svg'),
      font: path.join(fixtures, 'title.otf'),
      captions: path.join(fixtures, 'captions.vtt'),
      note: path.join(fixtures, 'note.json'),
    };
    await fs.writeFile(files.logo, "<svg xmlns='http://www.w3.org/2000/svg'/>");
    await fs.writeFile(files.font, Buffer.concat([Buffer.from('OTTO'), Buffer.alloc(60)]));
    await fs.writeFile(files.captions, 'WEBVTT\n\n00:00.000 --> 00:01.000\n你好\n');
    await fs.writeFile(files.note, '{"secret":true}');
    const linked = await client.request('edits.apply', {
      videoId: ref.videoId,
      commandId: newId('cmd'),
      expectedRevision: snapshot.video.revision,
      operations: [
        { type: 'importAsset', path: clip, ref: 'clip' },
        ...Object.entries(files).map(([key, file]) => ({ type: 'importAsset' as const, path: file, ref: key })),
      ],
    });
    const refs = linked.receipt.refs!;
    const video = runtime.videos.mirror(ref.videoId)!.video;
    for (const id of Object.values(refs)) {
      const asset = video.assets[id]!;
      expect(asset.revisions[asset.currentRevision]!.storage.mode, asset.name).toBe('linked');
    }
    expect(await collectedBlobs(ref.path)).toEqual([]);

    const served: Record<string, string> = {
      clip: 'video/mp4',
      image: 'image/png',
      tone: 'audio/wav',
      logo: 'image/svg+xml',
      font: 'font/otf',
    };
    for (const [key, mimeType] of Object.entries(served)) {
      const handle = await client.request('media.resolve', { videoId: ref.videoId, assetId: refs[key]! });
      expect(handle.mimeType, key).toBe(mimeType);
      expect((await fetch(handle.url)).status, key).toBe(200);
    }
    for (const key of ['captions', 'note']) {
      const refused = await rejection(client.request('media.resolve', { videoId: ref.videoId, assetId: refs[key]! }));
      expect(refused.code, key).toBe('forbidden');
    }
  });

  it('a linked symbolic link is allowed by the real file it points to: pointing at another file, even of the same length, is not allowed', async (context) => {
    const { ref, snapshot } = await create();
    const alias = path.join(fixtures, 'alias.mp4');
    await fs.rm(alias, { force: true });
    try {
      await fs.symlink(clip, alias);
    } catch (error) {
      if (process.platform === 'win32' && (error as NodeJS.ErrnoException).code === 'EPERM') {
        context.skip('Windows does not grant this process permission to create file symlinks');
      }
      throw error;
    }
    const linked = await client.request('edits.apply', {
      videoId: ref.videoId,
      commandId: newId('cmd'),
      expectedRevision: snapshot.video.revision,
      operations: [{ type: 'importAsset', path: alias, ref: 'alias' }],
    });
    const assetId = linked.receipt.refs!.alias!;
    const handle = await client.request('media.resolve', { videoId: ref.videoId, assetId });
    expect([handle.fileName, handle.mimeType]).toEqual(['alias.mp4', 'video/mp4']);
    expect((await fetch(handle.url)).status).toBe(200);

    // Swapped for a file of the same length that is not media: the engine's length check cannot catch it, and a wrong extension is not allowed through.
    const secret = path.join(fixtures, 'secret.txt');
    await fs.writeFile(secret, Buffer.alloc((await fs.stat(clip)).size, 0x61));
    await fs.rm(alias);
    await fs.symlink(secret, alias);
    const refused = await rejection(client.request('media.resolve', { videoId: ref.videoId, assetId }));
    expect(refused.code).toBe('forbidden');
  });

  it('linked file missing: the video still opens, the media is marked missing, other media are unaffected', async () => {
    const { ref, snapshot } = await create();
    const away = path.join(fixtures, 'away.mp4');
    await fs.copyFile(clip, away);
    const kept = path.join(fixtures, 'kept.svg');
    await fs.writeFile(kept, "<svg xmlns='http://www.w3.org/2000/svg' width='1'/>");
    const imported = await client.request('edits.apply', {
      videoId: ref.videoId,
      commandId: newId('cmd'),
      expectedRevision: snapshot.video.revision,
      operations: [
        { type: 'importAsset', path: away, ref: 'away' },
        { type: 'addItem', sequenceId: snapshot.video.rootSequenceId, asset: { ref: 'away' }, alignment: 'nearest-frame' },
        { type: 'importAsset', path: kept, storage: 'managed', ref: 'kept' },
      ],
    });
    const before = runtime.videos.mirror(ref.videoId)!;
    await client.request('videos.close', { videoId: ref.videoId });
    await fs.rm(away);

    const reopened = await client.request('videos.open', { projectId: project.id, path: ref.relPath });
    expect(reopened.snapshot).toEqual(before);
    const missing = await rejection(client.request('media.resolve', { videoId: ref.videoId, assetId: imported.receipt.refs!.away! }));
    const body = missing.details as EngineErrorBody;
    expect(body.code).toBe('ASSET_MISSING');
    expect(body.details).toMatchObject({ reason: 'missing', path: away });
    // No need to wait until fetching fails: the asset status lists the missing versions directly; the ones collected into the video are not among them.
    expect(await client.request('videos.assetStatus', { videoId: ref.videoId })).toEqual({
      missing: [{ assetId: imported.receipt.refs!.away!, revision: '1', reason: 'missing', path: away }],
    });
    const handle = await client.request('media.resolve', { videoId: ref.videoId, assetId: imported.receipt.refs!.kept! });
    expect((await fetch(handle.url)).status).toBe(200);
    // Still editable.
    await client.request('edits.apply', {
      videoId: ref.videoId,
      commandId: newId('cmd'),
      expectedRevision: imported.receipt.videoRevision,
      operations: [{ type: 'renameVideo', name: '缺了素材也能改' }],
    });
  });

  it('project media is registered relative to the video directory: after the whole project is moved, the video still opens and media is still retrievable', async () => {
    const { ref, snapshot } = await create(client, '搬家');
    const inside = path.join(project.path, '素材', 'logo.svg');
    await fs.mkdir(path.dirname(inside), { recursive: true });
    await fs.writeFile(inside, "<svg xmlns='http://www.w3.org/2000/svg' width='2'/>");
    const imported = await client.request('edits.apply', {
      videoId: ref.videoId,
      commandId: newId('cmd'),
      expectedRevision: snapshot.video.revision,
      operations: [
        { type: 'importAsset', path: inside, ref: 'inside' },
        { type: 'importAsset', path: clip, ref: 'outside' },
      ],
    });
    const insideId = imported.receipt.refs!.inside!;
    const outsideId = imported.receipt.refs!.outside!;
    const assets = runtime.videos.mirror(ref.videoId)!.video.assets;
    const storageOf = (id: string) => assets[id]!.revisions[assets[id]!.currentRevision]!.storage;
    expect(storageOf(insideId)).toMatchObject({ mode: 'linked', locator: { path: '../素材/logo.svg' } });
    // Files outside the project still record absolute paths.
    expect(storageOf(outsideId)).toMatchObject({ mode: 'linked', locator: { path: clip } });
    await client.request('videos.close', { videoId: ref.videoId });

    const movedDir = path.join(dir, '搬走的项目');
    await fs.rename(project.path, movedDir);
    const { project: moved } = await client.request('projects.open', { path: movedDir });
    expect(moved.id).toBe(project.id);
    await runtime.videos.claimProjectVideos(moved);
    const reopened = await client.request('videos.open', { projectId: moved.id, path: '搬家' });
    expect(reopened.ref.videoId).toBe(ref.videoId);
    expect(await client.request('videos.assetStatus', { videoId: ref.videoId })).toEqual({ missing: [] });
    for (const assetId of [insideId, outsideId]) {
      const handle = await client.request('media.resolve', { videoId: ref.videoId, assetId });
      expect((await fetch(handle.url)).status).toBe(200);
    }
  });

  it('linked JSON only allows Lottie animations', async () => {
    const { ref, snapshot } = await create();
    const sticker = path.join(fixtures, 'sticker.json');
    await fs.writeFile(sticker, JSON.stringify({ v: '5.8.1', w: 64, h: 64, fr: 30, ip: 0, op: 30, layers: [] }));
    const linked = await client.request('edits.apply', {
      videoId: ref.videoId,
      commandId: newId('cmd'),
      expectedRevision: snapshot.video.revision,
      operations: [{ type: 'importAsset', path: sticker, storage: 'linked', ref: 'sticker' }],
    });
    const handle = await client.request('media.resolve', { videoId: ref.videoId, assetId: linked.receipt.refs!.sticker! });
    const response = await fetch(handle.url);
    expect((await response.json()) as unknown).toMatchObject({ v: '5.8.1', op: 30 });
    expect(runtime.videos.mirror(ref.videoId)!.video.assets[linked.receipt.refs!.sticker!]!.kind).toBe('lottie');
  });

  it('`.lottie` archives are treated as Lottie: when linked, only those actually containing an animation are allowed', async () => {
    const { ref, snapshot } = await create();
    const animation = JSON.stringify({ v: '5.8.1', w: 64, h: 48, fr: 30, ip: 0, op: 45, layers: [] });
    const archive = path.join(fixtures, 'wave.lottie');
    await fs.writeFile(
      archive,
      storedZip([
        ['manifest.json', '{"animations":[{"id":"wave"}]}'],
        ['animations/wave.json', animation],
      ]),
    );
    const linked = await client.request('edits.apply', {
      videoId: ref.videoId,
      commandId: newId('cmd'),
      expectedRevision: snapshot.video.revision,
      operations: [{ type: 'importAsset', path: archive, storage: 'linked', ref: 'wave' }],
    });
    const assetId = linked.receipt.refs!.wave!;
    const asset = runtime.videos.mirror(ref.videoId)!.video.assets[assetId]!;
    const revision = asset.revisions[asset.currentRevision]!;
    expect([asset.kind, revision.mediaType, revision.video?.displayWidth, revision.video?.displayHeight]).toEqual([
      'lottie',
      'application/zip',
      64,
      48,
    ]);
    expect(revision.duration).toEqual({ ticks: '3', timescale: 2 });
    const handle = await client.request('media.resolve', { videoId: ref.videoId, assetId });
    expect(handle.mimeType).toBe('application/zip');
    expect((await fetch(handle.url)).status).toBe(200);

    // Replaced in place with a zip of the same length that is not Lottie: not allowed through.
    const bytes = await fs.readFile(archive);
    const other = storedZip([
      ['manifest.json', '{"animations":[{"id":"wave"}]}'],
      ['xnimations/wave.json', animation],
    ]);
    expect(other.length).toBe(bytes.length);
    await fs.writeFile(archive, other);
    const refused = await rejection(client.request('media.resolve', { videoId: ref.videoId, assetId }));
    expect(refused.code).toBe('forbidden');

    // A `.lottie` that cannot be opened is not collected.
    const broken = path.join(fixtures, 'broken.lottie');
    await fs.writeFile(broken, storedZip([['manifest.json', '{}']]));
    const failed = await rejection(
      client.request('edits.apply', {
        videoId: ref.videoId,
        commandId: newId('cmd'),
        expectedRevision: linked.receipt.videoRevision,
        operations: [{ type: 'importAsset', path: broken, storage: 'linked' }],
      }),
    );
    expect((failed.details as EngineErrorBody).code).toBe('MEDIA_PROBE_FAILED');
  });

  it('media analysis: waveform peaks and thumbnails are computed by the Runtime, cached by content digest; only audio and video are analyzed', async () => {
    const { ref, snapshot } = await create();
    const added = await importClip(ref.videoId, snapshot.video.revision);
    const assetId = added.receipt.createdIds.find((id) => id.startsWith('asset'))!;
    let peaks = await client.request('media.peaks', { videoId: ref.videoId, assetId });
    for (let i = 0; peaks.status === 'pending' && i < 100; i++) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      peaks = await client.request('media.peaks', { videoId: ref.videoId, assetId });
    }
    if (peaks.status !== 'ready') throw new Error(`峰值没有算好：${peaks.status}`);
    expect(peaks.binsPerSecond).toBe(50);
    expect(Math.abs(Buffer.from(peaks.peaks, 'base64').length - 100)).toBeLessThanOrEqual(3);

    const thumbnail = await client.request('media.thumbnail', { videoId: ref.videoId, assetId, at: 1.04 });
    expect(thumbnail.at).toBe(1);
    expect([...Buffer.from(thumbnail.data, 'base64').subarray(0, 2)]).toEqual([0xff, 0xd8]);

    const asset = runtime.videos.mirror(ref.videoId)!.video.assets[assetId]!;
    const hex = asset.revisions[asset.currentRevision]!.contentHash.replace('sha256:', '');
    const cached = await fs.readdir(path.join(dir, 'cache', 'media', hex));
    expect(cached.sort()).toEqual(['peaks-v1.json', 'thumb-1000.jpg']);

    const sticker = path.join(fixtures, 'analysis-sticker.json');
    await fs.writeFile(sticker, JSON.stringify({ v: '5.8.1', w: 64, h: 64, fr: 30, ip: 0, op: 30, layers: [] }));
    const linked = await client.request('edits.apply', {
      videoId: ref.videoId,
      commandId: newId('cmd'),
      expectedRevision: added.receipt.videoRevision,
      operations: [{ type: 'importAsset', path: sticker, storage: 'linked', ref: 'sticker' }],
    });
    const refused = await rejection(client.request('media.peaks', { videoId: ref.videoId, assetId: linked.receipt.refs!.sticker! }));
    expect(refused.code).toBe('forbidden');
    const missing = await rejection(client.request('media.thumbnail', { videoId: ref.videoId, assetId: 'asset_missing', at: 0 }));
    expect(missing.code).toBe('not-found');
  });

  it('after the connection drops, the video closes after the grace period; an unopened video cannot be edited or subscribed to', async () => {
    const other = await connect();
    const { ref, snapshot } = await create(other);
    other.close();
    await until(() => runtime.videos.mirror(ref.videoId) === null);
    const closed = await rejection(importClip(ref.videoId, snapshot.video.revision));
    expect(closed.code).toBe('not-found');
    // The lock is released: it can be reopened and edited.
    await client.request('videos.open', { projectId: project.id, path: ref.relPath });
    await importClip(ref.videoId, snapshot.video.revision);
  });

  it('duplicated project: the video in the copy gets a new videoId, content, revisions and history unchanged, original video unchanged', async () => {
    const { ref } = await create(client, '样片');
    await client.request('edits.apply', {
      videoId: ref.videoId,
      commandId: newId('cmd'),
      expectedRevision: '0',
      operations: [{ type: 'renameVideo', name: '改过的' }],
    });
    const history = await client.request('videos.history', { videoId: ref.videoId });
    expect(videoMeta(path.join(project.path, '样片')).projectId).toBe(project.id);
    await client.request('videos.close', { videoId: ref.videoId });

    const copyDir = path.join(dir, '副本');
    await fs.cp(project.path, copyDir, { recursive: true });
    const { project: copy } = await client.request('projects.open', { path: copyDir });
    expect(copy.id).not.toBe(project.id);
    // Preprocessing runs in the background when the project is opened; after that pass (or another pass) finishes, the library has a new identifier.
    await runtime.videos.claimProjectVideos(copy);
    const meta = videoMeta(path.join(copy.path, '样片'));
    expect(meta.projectId).toBe(copy.id);
    expect(JSON.parse(meta.previousVideoIds!)).toEqual([ref.videoId]);

    const copied = await client.request('videos.open', { projectId: copy.id, path: '样片' });
    expect(copied.ref.videoId).not.toBe(ref.videoId);
    expect(copied.ref.source.projectId).toBe(copy.id);
    expect(copied.snapshot.video).toMatchObject({ name: '改过的', revision: '1' });
    expect((await client.request('videos.history', { videoId: copied.ref.videoId })).entries).toEqual(history.entries);

    // The original video's id does not change; two that are open at the same time do not interfere with each other.
    const original = await client.request('videos.open', { projectId: project.id, path: '样片' });
    expect(original.ref.videoId).toBe(ref.videoId);
    expect(original.ref.path).not.toBe(copied.ref.path);
    expect(videoMeta(path.join(project.path, '样片')).previousVideoIds).toBeUndefined();
  });

  it('old video with no recorded project: adopts the current project when opened, videoId not changed', async () => {
    const { ref } = await create(client, '旧片');
    await client.request('videos.close', { videoId: ref.videoId });
    const file = path.join(project.path, '旧片', 'video.db');
    const db = new DatabaseSync(file);
    db.exec(`DELETE FROM meta WHERE key = 'projectId'`);
    db.close();
    expect(videoMeta(path.dirname(file)).projectId).toBeUndefined();

    const reopened = await client.request('videos.open', { projectId: project.id, path: '旧片' });
    expect(reopened.ref.videoId).toBe(ref.videoId);
    await client.request('videos.close', { videoId: ref.videoId });
    expect(videoMeta(path.dirname(file)).projectId).toBe(project.id);
  });

  it('after the engine process crashes and restarts and reopens the video, the topic sends a full replacement, and editing can continue afterward', async () => {
    const { ref, snapshot } = await create();
    const view = watch(client, ref.videoId);
    await view.ready;
    const added = await importClip(ref.videoId, snapshot.video.revision);
    const pid = runtime.videos.enginePid!;
    process.kill(pid, 'SIGKILL');
    await until(() => view.events.includes('video.replaced'));
    expect(runtime.videos.enginePid).not.toBe(pid);
    expect(view.get()!.video.revision).toBe(added.receipt.videoRevision);
    const itemId = added.receipt.createdIds.find((id) => id.startsWith('item'))!;
    const deleted = await client.request('edits.apply', {
      videoId: ref.videoId,
      commandId: newId('cmd'),
      expectedRevision: added.receipt.videoRevision,
      operations: [{ type: 'deleteItems', itemIds: [itemId] }],
    });
    expect(view.get()!.video.revision).toBe(deleted.receipt.videoRevision);
  });
});
