import path from 'node:path';
import type { PipelineTargets, VideoLease, VideoPlace } from '@cuccut/jobs';
import { RpcError, newId, type Id, type PipelineCreateScope } from '@cuccut/protocol';
import type { TrustedPrincipal } from '../gateway.ts';
import type { SpaceCatalog } from '../space-catalog.ts';
import { hasVideoDb, reserveVideoDir, type VideoLocation, type VideoService } from './video-service.ts';
import { RcVideo } from '@cuccut/protocol/messages/runtime-core';

/**
 * Runtime implementation of the fixed-flow video target (architecture design §7.9):
 *
 * - Place (`VideoPlace`), the same shape used for restart recovery: source directory, video directory, source (project or session).
 * - Opened with a lease: opened with a subject that exists only at the moment of opening (when another connection already has it open, that one is attached to), then immediately exchanged for the Runtime's lease and left. When another process holds the lock, the engine's `VIDEO_LOCKED` is thrown unchanged. After the lease is released with no other openers, it is closed after the grace period.
 * - Creation: the same path as `videos.create` (project directory, directory naming, the new video's initial content), after which it is likewise exchanged for a lease. When given a session, it is placed as the agent's `videos_create` places it: if the session belongs to a project, it goes in the project (scope is the project); otherwise in the session's working directory (scope is the session). The flow first reserves the directory (`reserve`, creating an empty directory) and then creates into it. If a video is already there (the flow was interrupted after creation but before it recorded the output), that video is opened instead of creating a new one.
 */

/** The place of an opened video; null when it was not opened from a project or session (no source). */
export function videoPlace(videos: VideoService, videoId: Id): VideoPlace | null {
  const ref = videos.ref(videoId);
  if (!ref) return null;
  const scope = ref.source.projectId
    ? { projectId: ref.source.projectId }
    : ref.source.conversationId
      ? { conversationId: ref.source.conversationId }
      : null;
  if (!scope) return null;
  // Source directory: the video directory with the relative path removed.
  const depth = ref.relPath ? ref.relPath.split('/').length : 0;
  const root = path.resolve(ref.path, ...Array<string>(depth).fill('..'));
  return { root, file: ref.relPath || '.', scope };
}

/** Converts the place into the form used to open the video; null if the shape is wrong. */
export function placeLocation(place: VideoPlace): VideoLocation | null {
  const { root, file, scope } = place as { root?: unknown; file?: unknown; scope?: unknown };
  if (typeof root !== 'string' || typeof file !== 'string' || !scope || typeof scope !== 'object') return null;
  const s = scope as { projectId?: unknown; conversationId?: unknown };
  if (typeof s.projectId === 'string') return { root, file, scope: { projectId: s.projectId } };
  if (typeof s.conversationId === 'string') return { root, file, scope: { conversationId: s.conversationId } };
  return null;
}

/**
 * The place of a video entry in Space, without opening the video. In the trash (including the entry ID from before deletion): `SPACE_ENTRY_TRASHED`; not a video: `SPACE_ENTRY_NOT_VIDEO`; gone: `not-found`.
 */
export function entryPlace(space: SpaceCatalog, entryId: Id): VideoPlace {
  if (space.trashedVideo(entryId)) {
    throw new RpcError('conflict', RcVideo.videoInTrash(), { code: 'SPACE_ENTRY_TRASHED', entryId });
  }
  const info = space.videoEntry(entryId);
  return { root: info.root, file: info.dir, scope: info.scope };
}

export interface PipelineTargetsOptions {
  /** The place of a Space entry (`entryPlace`). Space only exists after Runtime startup finishes, so it is fetched at call time. */
  entry(entryId: Id): VideoPlace;
  /** The project directory; `not-found` if it does not exist. */
  projectRoot(projectId: Id): string;
  /**
   * The place when creating from a session (same as the agent's `videos_create`): the directory of the project the session belongs to, with project scope; a session that does not belong to a project uses its working directory and session scope (architecture design §3.10). `not-found` if the session does not exist. Creating from a session is not accepted when none is given.
   */
  conversationSource?(
    conversationId: Id,
  ): Promise<{ root: string; scope: { projectId: Id } | { conversationId: Id } }> | { root: string; scope: { projectId: Id } | { conversationId: Id } };
}

export function pipelineTargets(videos: VideoService, options: PipelineTargetsOptions): PipelineTargets {
  /** Exchanges the opener for a lease: the subject used to open leaves at once, and the lease keeps the video open. */
  const toLease = async (videoId: Id, principal: TrustedPrincipal, fallback: VideoPlace | null): Promise<VideoLease> => {
    videos.retain(videoId);
    await videos.close(videoId, principal);
    const place = videoPlace(videos, videoId) ?? fallback;
    if (!place) {
      videos.release(videoId);
      throw new RpcError('not-found', RcVideo.videoNotInSourceDir());
    }
    let held = true;
    return {
      videoId,
      place,
      release: () => {
        if (!held) return;
        held = false;
        videos.release(videoId);
      },
    };
  };

  /** The source directory and scope for a newly created video: a project, or the session's source (a session that belongs to a project is that project). */
  const source = async (request: PipelineCreateScope): Promise<{ root: string; scope: { projectId: Id } | { conversationId: Id } }> => {
    if (request.projectId !== undefined) return { root: options.projectRoot(request.projectId), scope: { projectId: request.projectId } };
    if (!options.conversationSource) {
      throw new RpcError('invalid-request', RcVideo.cantCreateInSession(), { code: 'PIPELINE_TARGET_UNSUPPORTED' });
    }
    return options.conversationSource(request.conversationId);
  };

  return {
    entry: async (entryId) => options.entry(entryId),
    async lease(place) {
      const location = placeLocation(place);
      if (!location) throw new RpcError('not-found', RcVideo.targetLocationIncomplete());
      const principal = targetPrincipal();
      const opened = await videos.open(location, principal);
      return toLease(opened.ref.videoId, principal, place);
    },
    async reserve(request) {
      const { root, scope } = await source(request);
      const file = await reserveVideoDir(root, request.name);
      return { root: path.resolve(root), file, scope };
    },
    async create(request) {
      const { name, commandId, place } = request;
      const { root, scope } = await source(request);
      const principal = targetPrincipal();
      if (place) {
        const location = placeLocation(place);
        if (!location || !sameScope(location.scope, scope) || path.resolve(location.root) !== path.resolve(root)) {
          throw new RpcError('invalid-request', RcVideo.reservedDirOutsideProject());
        }
        if (await hasVideoDb(path.join(location.root, location.file))) {
          const opened = await videos.open(location, principal);
          return toLease(opened.ref.videoId, principal, place);
        }
        const opened = await videos.create({ name, commandId }, root, scope, principal, location.file);
        return toLease(opened.ref.videoId, principal, place);
      }
      const opened = await videos.create({ name, commandId }, root, scope, principal);
      return toLease(opened.ref.videoId, principal, null);
    },
  };
}

function sameScope(a: { projectId: Id } | { conversationId: Id }, b: { projectId: Id } | { conversationId: Id }): boolean {
  return 'projectId' in a
    ? 'projectId' in b && a.projectId === b.projectId
    : 'conversationId' in b && a.conversationId === b.conversationId;
}

/** The subject with which the flow opens a video: one at a time, used only at the moment of opening, then immediately exchanged for a lease. */
function targetPrincipal(): TrustedPrincipal {
  return { connectionId: newId('system:pipeline-target'), kind: 'cli', name: RcVideo.pipelinePrincipalName().text };
}
