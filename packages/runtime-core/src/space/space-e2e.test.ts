import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CucCutClient } from '@cuccut/client';
import { RpcError, newId, type Project } from '@cuccut/protocol';
import { silentLogger } from '@cuccut/harness';
import { resolveRuntimeHome } from '@cuccut/runtime-storage';
import { EngineHost, resolveEngineHostCommand } from '../videos/engine-host.ts';
import { startRuntime, type RunningRuntime } from '../runtime.ts';

/**
 * End-to-end, with a real engine-host. The content index reads videos only through the engine's read-only queries (`videos.readContent`, `videos.inspect`). An open video that is edited is incrementally updated afterwards; a video that is not open can still be indexed and does not hold the write lock. During a rebuild, the result is marked as incomplete.
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
if (!engine) console.warn('跳过 Space 端到端测试：没有构建 engine-host（npm run build:engine）');

const caption = (text: string) => ({
  schema: 'cuccut.caption/1',
  clock: 'sequence',
  timescale: 1_000_000,
  cues: [{ id: 'c1', start: 1_000_000, end: 2_500_000, text, speaker: '宝玉' }],
});

describe.skipIf(!engine)('Space（真实引擎）', () => {
  let dir: string;
  let runtime: RunningRuntime;
  let client: CucCutClient;
  let project: Project;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-space-'));
    runtime = await startRuntime({
      home: resolveRuntimeHome({ CUCCUT_HOME: dir }),
      drivers: () => [],
      watchSpace: false,
      engineHost: engine,
      videoGraceMs: 100,
      modelWorker: null,
      initiator: { discoverer: null },
      nodes: { host: '127.0.0.1', advertiser: null },
    });
    const { endpoint, token } = runtime.discovery;
    client = new CucCutClient({
      resolve: async () => ({ endpoint, token }),
      client: { kind: 'desktop', name: 'test', version: '0' },
      reconnect: false,
    });
    await client.connect();
    ({ project } = await client.request('projects.create', { name: '检索测试' }));
  });

  afterEach(async () => {
    client.close();
    await runtime.close();
    await fs.rm(dir, { recursive: true, force: true });
  });

  async function videoWithCaption(name: string, text: string) {
    const created = await client.request('videos.create', { projectId: project.id, name });
    await client.request('edits.apply', {
      videoId: created.ref.videoId,
      commandId: newId('cmd'),
      expectedRevision: created.snapshot.video.revision,
      operations: [{ type: 'putDocument', kind: 'caption', name: '字幕', language: 'zh', body: caption(text) }],
    });
    return created.ref;
  }

  async function settle() {
    await client.request('space.rescan', {});
    await runtime.space.idle();
  }

  it('视频内部标题不同于迁移目录名时，列表、改名和重建使用真实标题', async () => {
    const legacyName = 'legacy-title-fixture';
    const video = await videoWithCaption(legacyName, 'Interview transcript');
    await settle();
    const entry = (await client.request('space.list', { videoId: video.videoId, kind: 'video' })).entries[0]!;
    const name = 'Khan Academy CEO | Sal Khan';
    await client.request('edits.apply', {
      videoId: video.videoId,
      commandId: newId('cmd'),
      expectedRevision: runtime.videos.mirror(video.videoId)!.video.revision,
      operations: [{ type: 'renameVideo', name }],
    });
    await runtime.space.idle();
    const listed = () => client.request('space.list', { videoId: video.videoId, kind: 'video' });
    expect((await listed()).entries).toEqual([
      expect.objectContaining({ id: entry.id, name, fileName: legacyName, relPath: video.relPath }),
    ]);

    await client.request('videos.close', { videoId: video.videoId });
    await client.request('space.rebuildIndex', {});
    await runtime.space.idle();
    expect((await listed()).entries[0]).toMatchObject({ id: entry.id, name, fileName: legacyName });
    const reopened = await client.request('videos.open', { projectId: project.id, path: video.relPath });
    expect(reopened.snapshot.video.name).toBe(name);
  });

  it('打开的与没打开的视频都能检索；编辑之后增量更新；重建期间不完整', async () => {
    const open = await videoWithCaption('访谈', '今天讲剪辑技巧');
    const closed = await videoWithCaption('Vlog', '周末去爬山，顺便剪辑');
    await client.request('videos.close', { videoId: closed.videoId });
    await settle();

    const found = await client.request('space.search', { query: '剪辑' });
    expect(found).toMatchObject({ complete: true, pendingVideos: 0, truncated: false });
    expect(found.hits.map((h) => h.videoId).sort()).toEqual([open.videoId, closed.videoId].sort());
    const hit = found.hits.find((h) => h.videoId === open.videoId)!;
    expect(hit).toMatchObject({
      videoName: '访谈',
      projectId: project.id,
      documentKind: 'caption',
      language: 'zh',
      snippet: '今天讲剪辑技巧',
      highlights: [[3, 5]],
      speaker: '宝玉',
    });
    expect(hit.time.end - hit.time.start).toBeCloseTo(1.5, 3);
    expect(hit.entryId).toBe((await client.request('space.list', { videoId: open.videoId, kind: 'video' })).entries[0]!.id);

    // A video that is not open, once read by indexing, can still be opened for editing afterwards (a read-only open does not take the write lock).
    const reopened = await client.request('videos.open', { projectId: project.id, path: closed.relPath });
    expect(reopened.ref.videoId).toBe(closed.videoId);
    await client.request('videos.close', { videoId: closed.videoId });

    // An open video submits a new version: no rescan is needed, the change notification triggers re-indexing.
    const before = await client.request('space.search', { query: '调色' });
    expect(before.hits).toEqual([]);
    const mirror = runtime.videos.mirror(open.videoId)!;
    await client.request('edits.apply', {
      videoId: open.videoId,
      commandId: newId('cmd'),
      expectedRevision: mirror.video.revision,
      operations: [{ type: 'putDocument', kind: 'caption', name: '第二份', language: 'zh', body: caption('接着讲调色') }],
    });
    await runtime.space.idle();
    const after = await client.request('space.search', { query: '调色' });
    expect(after).toMatchObject({
      complete: true,
      hits: [{ videoId: open.videoId, indexedRevision: runtime.videos.mirror(open.videoId)!.video.revision }],
    });

    // Rebuild: on return, the content index is still re-reading in the background; it is complete afterwards.
    const rebuilt = await client.request('space.rebuildIndex', {});
    expect(rebuilt.entries).toBeGreaterThanOrEqual(2);
    await runtime.space.idle();
    expect(await client.request('space.search', { query: '剪辑' })).toMatchObject({ complete: true, hits: [{}, {}] });

    // Moving a video entry into the trash is deleting the video (moving its directory). Restoring it with the id from before deletion puts it back in place, with the original id.
    const video = (await client.request('space.list', { videoId: closed.videoId })).entries[0]!;
    const trashed = await client.request('space.trash', { entryId: video.id });
    expect(trashed.entry.id).not.toBe(video.id);
    expect(trashed.entry.user.trashedAt).not.toBeNull();
    expect((await client.request('space.restore', { entryId: video.id })).entry).toMatchObject({ id: video.id, user: { trashedAt: null } });
  });

  async function connect(): Promise<CucCutClient> {
    const { endpoint, token } = runtime.discovery;
    const next = new CucCutClient({
      resolve: async () => ({ endpoint, token }),
      client: { kind: 'desktop', name: 'second', version: '0' },
      reconnect: false,
    });
    await next.connect();
    return next;
  }

  async function refusal(promise: Promise<unknown>): Promise<string | undefined> {
    const error = await promise.then(
      () => null,
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(RpcError);
    return ((error as RpcError).details as { code?: string } | undefined)?.code;
  }

  it.skipIf(!ffmpeg)(
    '删除视频：移进回收站、撤销与恢复、物理删除；别的连接开着、有内部租约、被别的进程锁着时拒绝；链接素材的原文件不动',
    async () => {
      const ref = await videoWithCaption('访谈', '今天讲剪辑技巧');
      const original = path.join(project.path, ref.relPath);
      // A linked-in-place asset: a file in the project (not in the video directory).
      const linked = path.join(project.path, 'raw', 'tone.wav');
      await fs.mkdir(path.dirname(linked), { recursive: true });
      execFileSync('ffmpeg', [
        '-v',
        'error',
        '-y',
        '-f',
        'lavfi',
        '-i',
        'sine=frequency=440:duration=1',
        '-ar',
        '16000',
        '-ac',
        '1',
        linked,
      ]);
      const linkedBytes = await fs.readFile(linked);
      const opened = await client.request('videos.open', { projectId: project.id, path: ref.relPath });
      await client.request('edits.apply', {
        videoId: ref.videoId,
        commandId: newId('cmd'),
        expectedRevision: opened.snapshot.video.revision,
        operations: [{ type: 'importAsset', path: linked, storage: 'linked' }],
      });
      await settle();
      const live = (await client.request('space.list', { videoId: ref.videoId, kind: 'video' })).entries[0]!;

      // A video in a source directory is not physically deleted directly in Space.
      expect(await refusal(client.request('space.purge', { entryId: live.id }))).toBe('SPACE_PURGE_VIDEO');

      // Another connection has it open: refused.
      const second = await connect();
      await second.request('videos.open', { projectId: project.id, path: ref.relPath });
      expect(await refusal(client.request('videos.delete', { entryId: live.id }))).toBe('VIDEO_IN_USE');
      await second.request('videos.close', { videoId: ref.videoId });
      second.close();

      // Still in use inside the Runtime (job and export leases): refused.
      runtime.videos.retain(ref.videoId);
      expect(await refusal(client.request('videos.delete', { videoId: ref.videoId }))).toBe('VIDEO_BUSY');
      runtime.videos.release(ref.videoId);

      // Only this app has it open: it is closed on its behalf (video.closed, reason deleted), and the whole directory is moved into the trash.
      const closed: string[] = [];
      client.subscribeVideo(ref.videoId, {
        snapshot: () => {},
        event: (event) => {
          if (event.type === 'video.closed') closed.push(event.reason);
        },
      });
      const removed: string[] = [];
      client.subscribeSpace({
        snapshot: () => {},
        event: (event) => {
          if (event.type === 'entry.removed') removed.push(event.entryId);
        },
      });
      const deleted = await client.request('videos.delete', { projectId: project.id, path: ref.relPath });
      expect(deleted).toMatchObject({ status: 'trashed', videoId: ref.videoId, name: '访谈' });
      expect(deleted.entryId).not.toBe(live.id);
      await expect.poll(() => closed).toEqual(['deleted']);
      await expect.poll(() => removed).toContain(live.id);
      await expect(fs.stat(original)).rejects.toThrow();
      expect((await fs.readFile(linked)).equals(linkedBytes)).toBe(true);
      const trashed = await client.request('space.get', { entryId: deleted.entryId });
      expect(trashed.entry).toMatchObject({ kind: 'video', relPath: ref.relPath, ref: { videoId: ref.videoId } });
      expect(trashed.entry.user.trashedAt).not.toBeNull();
      expect((await client.request('space.list', { kind: 'video' })).entries).toEqual([]);
      expect((await client.request('space.list', { trash: 'only' })).entries.map((e) => e.id)).toEqual([deleted.entryId]);
      expect(runtime.space.videos()).toEqual([]);
      // A video in the trash cannot be opened; repeated deletion returns the same result.
      const trashPath = runtime.space.trashedVideo(deleted.entryId)!.record.trashRelPath;
      await fs.access(path.join(project.path, trashPath, 'video.db'));
      expect(await refusal(client.request('videos.open', { projectId: project.id, path: trashPath }))).toBe('VIDEO_TRASHED');
      expect((await client.request('videos.delete', { entryId: live.id })).entryId).toBe(deleted.entryId);

      // Undo: the UI uses the pre-deletion id to change the trash marker back.
      const undone = await client.request('space.update', { entryId: live.id, trashed: false });
      expect(undone.entry).toMatchObject({ id: live.id, relPath: ref.relPath, user: { trashedAt: null } });
      await fs.access(path.join(original, 'video.db'));
      await expect(fs.stat(path.join(project.path, '.ccut-trash'))).rejects.toThrow();
      const reopened = await client.request('videos.open', { projectId: project.id, path: ref.relPath });
      expect(reopened.ref.videoId).toBe(ref.videoId);
      await client.request('videos.close', { videoId: ref.videoId });

      // Locked by another process: the engine's VIDEO_LOCKED; the directory is left untouched.
      const other = await EngineHost.start({ command: engine!, log: silentLogger, onEvent: () => {}, onExit: () => {} });
      try {
        await other.request('videos.open', { path: original });
        expect(await refusal(client.request('videos.delete', { entryId: live.id }))).toBe('VIDEO_LOCKED');
        await fs.access(path.join(original, 'video.db'));
        expect((await client.request('space.list', { trash: 'only' })).entries).toEqual([]);
      } finally {
        await other.close();
      }

      // Deleted again while the original location is now occupied: a different name is used on restore.
      const again = await client.request('space.trash', { entryId: live.id });
      await fs.mkdir(original);
      const restored = await client.request('videos.restore', { entryId: again.entry.id });
      expect(restored).toMatchObject({ renamed: true, relPath: `${ref.relPath} 2`, entry: { kind: 'video', relPath: `${ref.relPath} 2` } });
      // The video id is filled in after the content index reads it.
      await runtime.space.idle();
      expect((await client.request('space.get', { entryId: restored.entry.id })).entry.ref).toEqual({ videoId: ref.videoId });
      await fs.rmdir(original);

      // Physical deletion after deleting: only the video directory is removed; the original file of a linked asset remains.
      const last = await client.request('videos.delete', { entryId: restored.entry.id });
      expect(await client.request('space.purge', { entryId: last.entryId })).toEqual({ status: 'purged', entryId: last.entryId });
      await expect(fs.stat(path.join(project.path, `${ref.relPath} 2`))).rejects.toThrow();
      await expect(fs.stat(path.join(project.path, '.ccut-trash'))).rejects.toThrow();
      expect((await fs.readFile(linked)).equals(linkedBytes)).toBe(true);
      await expect(client.request('space.get', { entryId: last.entryId })).rejects.toThrow();
    },
  );

  it('视频目录就是另一个项目的目录：删除在动任何东西之前以 VIDEO_TRASH_SOURCE_ROOT 拒绝', async () => {
    const ref = await videoWithCaption('整个项目', '根目录就是视频');
    const videoDir = path.join(project.path, ref.relPath);
    // The user opened this video directory itself as a project: it is that project's source directory.
    const { project: inner } = await client.request('projects.open', { path: videoDir });
    await settle();
    const live = (await client.request('space.list', { videoId: ref.videoId, kind: 'video' })).entries[0]!;
    const closed: string[] = [];
    client.subscribeVideo(ref.videoId, {
      snapshot: () => {},
      event: (event) => {
        if (event.type === 'video.closed') closed.push(event.reason);
      },
    });
    for (const target of [
      { entryId: live.id },
      { videoId: ref.videoId },
      { projectId: inner.id, path: '.' },
      { projectId: inner.id, path: 'video.db' },
    ]) {
      expect(await refusal(client.request('videos.delete', target)), JSON.stringify(target)).toBe('VIDEO_TRASH_SOURCE_ROOT');
    }
    // Nothing was touched: the directory is still in place, there is no trash record, and the video is still open.
    await fs.access(path.join(videoDir, 'video.db'));
    await expect(fs.stat(path.join(project.path, '.ccut-trash'))).rejects.toThrow();
    expect((await client.request('space.list', { trash: 'only' })).entries).toEqual([]);
    expect(closed).toEqual([]);
    expect(runtime.videos.usage(ref.videoId)?.openers.length).toBe(1);
  });
});
