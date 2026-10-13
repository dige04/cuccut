import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  RpcError,
  nowIso,
  refOf,
  type FileTarget,
  type Id,
  type JobRecord,
  type VideoDeleteResult,
  type VideoRestoreResult,
} from '@cuccut/protocol';
import type { Logger } from '@cuccut/harness';
import type { TrashedVideo } from '@cuccut/runtime-storage';
import type { TrustedPrincipal } from '../gateway.ts';
import { TRASH_DIR, type SpaceCatalog, type VideoEntryInfo } from '../space-catalog.ts';
import type { VideoService } from './video-service.ts';
import { RcVideo } from '@cuccut/protocol/messages/runtime-core';

/**
 * Delete and restore videos (architecture design §5.5, §5.7). Deleting moves the whole video directory into the trash inside the same source directory, at `.ccut-trash/<trashId>/<directory name>`:
 * a rename on the same volume, copying and deleting nothing, so it can be restored. Physical deletion goes through Space's `space.purge` and the trash's retention period, where references are checked.
 *
 * - The original files of linked media are not in the video directory, so deletion and physical deletion do not touch them; physical deletion only deletes files the video manages (`SpaceCatalog.#purgeVideo`).
 * - If the video directory is a source directory itself (the project directory, a session's working directory) or contains one, it is refused with `VIDEO_TRASH_SOURCE_ROOT` before anything is touched.
 * - Before deleting: refuse when another connection has the video open (`VIDEO_IN_USE`), or when it has internal leases or running jobs and exports (`VIDEO_BUSY`); only if the caller itself has it open, close it first
 *   (`video.closed`, `reason: 'deleted'`). The video's write lock is held during the move; if another process holds the lock, it is the engine's `VIDEO_LOCKED`.
 * - Record the deletion in `space.json` first (the record and the trash marker), then move the directory; if the move fails, remove the record. A crash midway is reconciled by Space at startup, by checking where the directory actually is.
 * - The entry id in the trash is determined by the source and its position in the trash (another video may later be placed at the original position); ids from before the deletion can still be used to undo and restore.
 */

export interface VideoTrashDeps {
  space: SpaceCatalog;
  videos: VideoService;
  jobs: { list(): JobRecord[] };
  /** File target to source directory and file (same resolution as `videos.open`). */
  resolve: (target: FileTarget) => { root: string; file: string };
  log: Logger;
}

export type VideoDeleteTarget = FileTarget | { videoId: Id };

export class VideoTrash {
  readonly #deps: VideoTrashDeps;
  readonly #log: Logger;
  /** Deleting and restoring run one at a time: two moves never interleave. */
  #queue: Promise<unknown> = Promise.resolve();

  constructor(deps: VideoTrashDeps) {
    this.#deps = deps;
    this.#log = deps.log.child('video-trash');
  }

  delete(target: VideoDeleteTarget, principal: TrustedPrincipal): Promise<VideoDeleteResult> {
    return this.#serial(() => this.#delete(target, principal));
  }

  restore(entryId: Id): Promise<VideoRestoreResult> {
    return this.#serial(() => this.#restore(entryId));
  }

  #serial<T>(run: () => Promise<T>): Promise<T> {
    const next = this.#queue.then(run, run);
    this.#queue = next.catch(() => {});
    return next;
  }

  async #delete(target: VideoDeleteTarget, principal: TrustedPrincipal): Promise<VideoDeleteResult> {
    const { space, videos } = this.#deps;
    // Already deleted (a repeated request, or a second click before undo): still answer with the same result.
    if ('entryId' in target) {
      const trashed = space.trashedVideo(target.entryId);
      if (trashed) return this.#result(trashed.entryId, trashed.record);
    }
    const info = await this.#locate(target);
    const dir = await fs.realpath(info.dir);
    const rootReal = await fs.realpath(info.root);
    // The video directory is a source directory itself (or contains one): renaming would move the whole project or session directory away, and it cannot be moved into its own subdirectory. Refuse before touching anything.
    if (await this.#holdsSourceRoot(dir, rootReal)) throw sourceRootError();
    const indexed = info.entry.ref && 'videoId' in info.entry.ref ? info.entry.ref.videoId : null;
    const videoId =
      indexed ??
      (await videos
        .peek(dir)
        .then((v) => v.videoId)
        .catch(() => null));

    if (videoId) {
      const usage = videos.usage(videoId);
      const others = usage?.openers.filter((id) => id !== principal.connectionId) ?? [];
      if (others.length > 0) {
        throw new RpcError('conflict', RcVideo.openElsewhere(), { code: 'VIDEO_IN_USE', videoId });
      }
      const running = this.#deps.jobs
        .list()
        .filter((job) => job.videoId === videoId && (job.state === 'queued' || job.state === 'running'));
      if ((usage?.leases ?? 0) > 0 || running.length > 0) {
        throw new RpcError('conflict', RcVideo.videoBusy(), {
          code: 'VIDEO_BUSY',
          videoId,
          jobIds: running.map((job) => job.jobId),
        });
      }
      if (usage) await videos.closeDeleted(videoId);
    }

    const trashId = `${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`;
    const trashRelPath = `${TRASH_DIR}/${trashId}/${path.basename(dir)}`;
    const trashDir = path.join(rootReal, ...trashRelPath.split('/'));
    const entryId = space.trashEntryId(info.sourceKey, trashRelPath);
    const record: TrashedVideo = {
      formerEntryId: info.entry.id,
      sourceKey: info.sourceKey,
      projectId: 'projectId' in info.scope ? info.scope.projectId : null,
      conversationId: 'conversationId' in info.scope ? info.scope.conversationId : null,
      relPath: info.relPath,
      trashRelPath,
      videoId,
      name: info.entry.name,
      size: info.entry.size,
      trashedAt: nowIso(),
    };
    await videos.withWriteLock(dir, async () => {
      await space.recordTrashedVideo(entryId, record);
      try {
        await fs.mkdir(path.dirname(trashDir), { recursive: true });
        await fs.rename(dir, trashDir);
      } catch (error) {
        await space.releaseTrashedVideo(entryId, record, record.relPath);
        await fs.rmdir(path.dirname(trashDir)).catch(() => {});
        if ((error as NodeJS.ErrnoException).code === 'EXDEV') {
          throw new RpcError('conflict', RcVideo.crossDevice(), { code: 'VIDEO_TRASH_CROSS_DEVICE' });
        }
        throw error;
      }
    });
    this.#log.info('Video deleted (moved to trash)', { entryId, videoId });
    await space.refreshSource(info.sourceKey);
    return this.#result(entryId, record);
  }

  #result(entryId: Id, record: TrashedVideo): VideoDeleteResult {
    const related = record.videoId
      ? this.#deps.space
          .entries()
          // A derived child video (its origin also points to the parent video) is an independent video, and does not count as an entry it generated or exported.
          .filter((e) => e.id !== entryId && e.kind !== 'video' && e.origin?.videoId === record.videoId)
          .map((e) => e.id)
      : [];
    return { status: 'trashed', entryId, videoId: record.videoId, name: record.name, trashedAt: record.trashedAt, related };
  }

  async #locate(target: VideoDeleteTarget): Promise<VideoEntryInfo> {
    const { space, videos } = this.#deps;
    if ('entryId' in target) return space.videoEntry(target.entryId);
    let dir: string | null = null;
    if ('videoId' in target) {
      const known = space.videos().find((v) => v.videoId === target.videoId);
      if (known) return space.videoEntry(known.entryId);
      dir = videos.ref(target.videoId)?.path ?? null;
    } else {
      const { root, file } = this.#deps.resolve(target);
      dir = path.resolve(root, file);
      if (/^(video|movie)\.db$/.test(path.basename(dir))) dir = path.dirname(dir);
      // The path is only looked up in the given project or session directory: do not use one source's name to delete a video in another source.
      const rel = path.relative(root, dir);
      if (rel === '' && (await isVideoDir(dir))) throw sourceRootError();
      if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) dir = null;
    }
    const info = dir ? await space.videoEntryAt(dir) : null;
    if (!info) throw new RpcError('not-found', RcVideo.videoEntryNotFound());
    return info;
  }

  /** Whether `dir` is a source directory itself, or contains a source directory (both compared by real path). */
  async #holdsSourceRoot(dir: string, rootReal: string): Promise<boolean> {
    const roots = [rootReal, ...(await Promise.all(this.#deps.space.sourceRoots().map((root) => fs.realpath(root).catch(() => null))))];
    return roots.some((root) => {
      if (!root) return false;
      const rel = path.relative(dir, root);
      return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
    });
  }

  async #restore(entryId: Id): Promise<VideoRestoreResult> {
    const { space } = this.#deps;
    const trashed = space.trashedVideo(entryId);
    if (!trashed) {
      const entry = space.get(entryId);
      if (entry.kind === 'video' && entry.user.trashedAt === null) return { entry, relPath: entry.relPath, renamed: false };
      throw new RpcError('invalid-request', RcVideo.notDeletedVideo(), { code: 'VIDEO_NOT_TRASHED' });
    }
    const { record, root } = trashed;
    if (!root) throw new RpcError('not-found', RcVideo.restoreRootGone());
    const rootReal = await fs.realpath(root);
    const from = path.join(rootReal, ...record.trashRelPath.split('/'));
    await fs.access(path.join(from, 'video.db')).catch(async () => {
      await fs.access(path.join(from, 'movie.db')).catch(() => {
        throw new RpcError('not-found', RcVideo.trashDirGone());
      });
    });
    const wanted = path.join(rootReal, ...record.relPath.split('/'));
    await fs.mkdir(path.dirname(wanted), { recursive: true });
    let to = wanted;
    for (let n = 2; await exists(to); n++) to = `${wanted} ${n}`;
    await fs.rename(from, to);
    await fs.rmdir(path.dirname(from)).catch(() => {});
    await fs.rmdir(path.join(rootReal, TRASH_DIR)).catch(() => {});
    const relPath = path.relative(rootReal, to).split(path.sep).join('/');
    const restored = await space.releaseTrashedVideo(trashed.entryId, record, relPath);
    this.#log.info('Video restored', { entryId: restored, videoId: record.videoId });
    return { entry: space.get(restored), relPath, renamed: to !== wanted };
  }
}

function sourceRootError(): RpcError {
  const remedy = RcVideo.sourceRootRemedy();
  return new RpcError('conflict', RcVideo.sourceRootInTrash(), {
    code: 'VIDEO_TRASH_SOURCE_ROOT',
    remedy: remedy.text,
    remedyRef: refOf(remedy),
  });
}

async function isVideoDir(dir: string): Promise<boolean> {
  for (const name of ['video.db', 'movie.db']) if (await exists(path.join(dir, name))) return true;
  return false;
}

async function exists(file: string): Promise<boolean> {
  return fs.access(file).then(
    () => true,
    () => false,
  );
}
