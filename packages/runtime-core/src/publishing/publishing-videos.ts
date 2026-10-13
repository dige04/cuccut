import { RcPublishing } from '@cuccut/protocol/messages/runtime-core';
import { RpcError, type Id } from '@cuccut/protocol';
import type { TrustedPrincipal } from '../gateway.ts';
import type { SpaceCatalog } from '../space-catalog.ts';
import { extractContent, type ReadContentResult } from '../space/content-extract.ts';
import type { VideoService } from '../videos/video-service.ts';

/**
 * What publishing needs to know about videos (design `docs/cuccut/m2-publishing.md` §4.1). Publishing never edits a video: it reads facts (name,
 * project, main sequence, current revision), opens a video only to submit a "Render and pin" export, and reads a transcript excerpt for copy proposals.
 * The Runtime implementation reads open videos from `VideoService` and the others from the Space catalog without opening them.
 */
export interface PublishingVideoFacts {
  videoId: Id;
  name: string;
  projectId: Id | null;
  /** The main sequence, when known. */
  rootSequenceId: Id | null;
  revision: string | null;
}

export interface PublishingVideos {
  /** Facts of a video on this computer, or null when it is not here. */
  facts(videoId: Id): Promise<PublishingVideoFacts | null>;
  /** Whether the video is on this computer (open, or known to the Space catalog). Synchronous: used for every detail. */
  available(videoId: Id): boolean;
  /** The video's current revision when it is known without reading the video (open, or in the content index). */
  revision(videoId: Id): string | null;
  /** Opens the video for an export and returns the function that lets it go again. */
  open(videoId: Id): Promise<() => Promise<void>>;
  /** A plain-text excerpt of the video's transcript (at most `maxChars`), or null when it has none. */
  transcript(videoId: Id, maxChars: number): Promise<string | null>;
}

/** The subject that opens a video for a "Render and pin" export (only while the export is submitted). */
function publishingPrincipal(): TrustedPrincipal {
  return { connectionId: 'system:publishing', kind: 'cli', name: RcPublishing.principalName().text };
}

export interface RuntimePublishingVideosDeps {
  videos: VideoService;
  /** The Space catalog is built after the publishing service, so it is fetched at call time. */
  space: () => SpaceCatalog | null;
}

/** `PublishingVideos` over the Runtime's video service and Space catalog. */
export function runtimePublishingVideos({ videos, space }: RuntimePublishingVideosDeps): PublishingVideos {
  const known = (videoId: Id) => space()?.videos().find((video) => video.videoId === videoId) ?? null;
  const read = async (videoId: Id): Promise<{ result: ReadContentResult; dir: string; projectId: Id | null } | null> => {
    const entry = known(videoId);
    if (!entry) return null;
    try {
      return { result: await videos.readContent<ReadContentResult>(entry.dir), dir: entry.dir, projectId: entry.projectId };
    } catch {
      return null;
    }
  };
  return {
    async facts(videoId) {
      const ref = videos.ref(videoId);
      const mirror = videos.mirror(videoId);
      if (ref && mirror) {
        return {
          videoId,
          name: ref.name,
          projectId: ref.source.projectId,
          rootSequenceId: mirror.video.rootSequenceId,
          revision: mirror.video.revision,
        };
      }
      const content = await read(videoId);
      if (!content || content.result.videoId !== videoId) return null;
      return {
        videoId,
        name: content.result.name,
        projectId: content.projectId,
        rootSequenceId: content.result.snapshot.rootSequenceId ?? null,
        revision: content.result.revision,
      };
    },
    available(videoId) {
      return videos.ref(videoId) !== null || known(videoId) !== null;
    },
    revision(videoId) {
      const open = videos.mirror(videoId)?.video.revision;
      if (open) return open;
      const entry = known(videoId);
      return entry ? (space()?.index?.at(entry.dir)?.revision ?? null) : null;
    },
    async open(videoId) {
      if (videos.ref(videoId)) {
        videos.retain(videoId);
        return async () => videos.release(videoId);
      }
      const entry = known(videoId);
      const catalog = space();
      if (!entry || !catalog) throw new RpcError('not-found', RcPublishing.videoNotFound(), { code: 'VIDEO_NOT_FOUND' });
      const principal = publishingPrincipal();
      const opened = await videos.open(catalog.locate(entry.entryId), principal);
      if (opened.ref.videoId !== videoId) {
        await videos.close(opened.ref.videoId, principal);
        throw new RpcError('not-found', RcPublishing.videoNotFound(), { code: 'VIDEO_NOT_FOUND' });
      }
      return async () => {
        await videos.close(videoId, principal);
      };
    },
    async transcript(videoId, maxChars) {
      const content = await read(videoId);
      if (!content) return null;
      let extracted;
      try {
        extracted = extractContent(content.result, content.dir);
      } catch {
        return null;
      }
      const text = extracted.segments
        .filter((segment) => segment.kind === 'speech')
        .map((segment) => segment.text.trim())
        .filter(Boolean)
        .join(' ');
      if (!text) return null;
      return [...text].length > maxChars ? [...text].slice(0, maxChars).join('') : text;
    },
  };
}
