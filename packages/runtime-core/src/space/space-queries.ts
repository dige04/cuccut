import {
  RpcError,
  type Id,
  type JobRecord,
  type SpaceEntry,
  type SpaceListParams,
  type SpaceListResult,
  type SpaceSearchParams,
  type SpaceSearchResult,
} from '@cuccut/protocol';
import type { SpaceCatalog } from '../space-catalog.ts';
import type { SearchableVideo } from './content-search.ts';
import { RcSpace } from '@cuccut/protocol/messages/runtime-core';

/**
 * Queries for Space (`space.list`, `space.search`, and the agent tools `space_list` and `space_search`) and filtering by principal (architecture design §4.8).
 *
 * - `user`: the UI, CLI and Web (the user themselves): all entries.
 * - `source`: the agent in a session: entries in the session's source directory (its project, or the session's own work directory), plus artifacts belonging to the same source.
 * - `service`: external service clients: only videos within scope (in a registered project, on the videoId allowlist), and entries generated or exported from those videos. Artifacts and placeholders of tasks are visible only to the submitter. Files without a source video (images and documents in the project) are invisible. Things that are not visible are answered the same as things that do not exist.
 */
export type SpaceViewer =
  | { kind: 'user' }
  | { kind: 'source'; projectId: Id | null; conversationId: Id }
  | { kind: 'service'; videos: 'all' | ReadonlySet<Id>; owns: (record: JobRecord) => boolean; jobs: (jobId: Id) => JobRecord | null };

export const USER_VIEWER: SpaceViewer = { kind: 'user' };

const DEFAULT_LIST_LIMIT = 100;
const DEFAULT_SEARCH_LIMIT = 50;

export function projectOf(entry: SpaceEntry): Id | null {
  return (entry.origin?.capability === 'link-import' ? entry.origin.projectId : entry.source.projectId ?? entry.origin?.projectId) ?? null;
}

/** Entries' related video: the video itself, or the video that generated or exported it. */
export function videoOf(entry: SpaceEntry): Id | null {
  if (entry.ref && 'videoId' in entry.ref) return entry.ref.videoId;
  return entry.origin?.videoId ?? null;
}

/** Filter by video (`videoId` of `space.list`): the video itself, the entries it generated or exported, and the sub-videos derived from it (short clips). */
function relatedTo(entry: SpaceEntry, videoId: Id): boolean {
  return videoOf(entry) === videoId || (entry.origin?.source === 'derived' && entry.origin.videoId === videoId);
}

export function visibleTo(viewer: SpaceViewer, entry: SpaceEntry): boolean {
  switch (viewer.kind) {
    case 'user':
      return true;
    case 'source':
      if (viewer.projectId) return projectOf(entry) === viewer.projectId;
      return (
        entry.source.conversationId === viewer.conversationId ||
        (!projectOf(entry) && entry.origin?.conversationId === viewer.conversationId)
      );
    case 'service': {
      const videoId = videoOf(entry);
      if (!videoId || !projectOf(entry)) return false;
      if (viewer.videos !== 'all' && !viewer.videos.has(videoId)) return false;
      const jobId = entry.origin?.jobId;
      if (!jobId) return true;
      const record = viewer.jobs(jobId);
      return record !== null && viewer.owns(record);
    }
  }
}

/** Things that are not visible are answered the same as things that do not exist. */
export function visibleEntry(catalog: SpaceCatalog, viewer: SpaceViewer, entryId: Id): SpaceEntry {
  const entry = catalog.get(entryId);
  if (!visibleTo(viewer, entry)) throw new RpcError('not-found', RcSpace.entryGone());
  return entry;
}

export function listEntries(catalog: SpaceCatalog, viewer: SpaceViewer, params: SpaceListParams): SpaceListResult {
  const kinds = params.kind === undefined ? null : new Set(Array.isArray(params.kind) ? params.kind : [params.kind]);
  const statuses = params.status === undefined ? null : new Set(Array.isArray(params.status) ? params.status : [params.status]);
  const trash = params.trash ?? 'exclude';
  const matched = catalog.entries().filter((entry) => {
    if (!visibleTo(viewer, entry)) return false;
    if (params.projectId !== undefined && projectOf(entry) !== params.projectId) return false;
    if (kinds && !kinds.has(entry.kind)) return false;
    if (statuses && !statuses.has(entry.status ?? 'none')) return false;
    if (params.videoId !== undefined && !relatedTo(entry, params.videoId)) return false;
    if (params.favorite !== undefined && entry.user.favorite !== params.favorite) return false;
    const trashed = entry.user.trashedAt !== null;
    if (trash === 'exclude' && trashed) return false;
    if (trash === 'only' && !trashed) return false;
    return true;
  });
  const offset = params.cursor ? Number(params.cursor) : 0;
  const limit = params.limit ?? DEFAULT_LIST_LIMIT;
  const page = matched.slice(offset, offset + limit);
  const next = offset + page.length;
  return {
    entries: page,
    total: matched.length,
    nextCursor: next < matched.length ? String(next) : null,
    // Scan problems of a source directory name the directory, so they are given only to the user themselves.
    issues: viewer.kind === 'user' ? catalog.issues() : [],
    scanning: catalog.scanning,
  };
}

/**
 * Cross-video search (§5.11). Scope is the videos in the source directory, after filtering by principal. Videos that are not yet indexed, are being rebuilt, or whose index lags the current version count into `pendingVideos`; when there are any, `complete` is false. Lagging videos are still searched using the old index.
 */
export function searchContent(catalog: SpaceCatalog, viewer: SpaceViewer, params: SpaceSearchParams): SpaceSearchResult {
  const index = catalog.index;
  const wanted = params.videoIds ? new Set(params.videoIds) : null;
  const searchable: SearchableVideo[] = [];
  let pending = 0;
  for (const video of catalog.videos()) {
    if (params.projectId !== undefined && video.projectId !== params.projectId) continue;
    if (!visibleVideo(viewer, video)) continue;
    const indexed = index?.at(video.dir) ?? null;
    if (!indexed) {
      // Its videoId is not yet known: when filtering by videoId it also counts as pending indexing (it cannot be judged, so the result is better marked incomplete). For external services this counts only when the scope is all videos.
      // Videos outside the allowlist must not show up in the count.
      if (viewer.kind !== 'service' || viewer.videos === 'all') pending++;
      continue;
    }
    if (wanted && !wanted.has(indexed.videoId)) continue;
    if (viewer.kind === 'service' && viewer.videos !== 'all' && !viewer.videos.has(indexed.videoId)) continue;
    if (index!.pendingCount([video.dir]) > 0) pending++;
    searchable.push({
      dir: indexed.dir,
      videoId: indexed.videoId,
      videoName: indexed.name,
      entryId: video.entryId,
      projectId: video.projectId,
      revision: indexed.revision,
    });
  }
  const { hits, truncated } = (index?.search(searchable, {
    query: params.query,
    ...(params.kinds ? { kinds: params.kinds } : {}),
    ...(params.speaker ? { speaker: params.speaker } : {}),
    limit: params.limit ?? DEFAULT_SEARCH_LIMIT,
  }) ?? { hits: [], truncated: false });
  return { hits, complete: pending === 0 && !catalog.scanning && index !== null, pendingVideos: pending, truncated };
}

/** Initial filter of videos by principal (shared by search and the tool candidate input). For external services, the videoId allowlist is checked only after the videoIds are obtained. */
export function visibleVideo(viewer: SpaceViewer, video: { projectId: Id | null; conversationId: Id | null }): boolean {
  switch (viewer.kind) {
    case 'user':
      return true;
    case 'source':
      return viewer.projectId ? video.projectId === viewer.projectId : video.conversationId === viewer.conversationId;
    case 'service':
      // Only videos in registered projects; the allowlist is checked after the videoIds are obtained.
      return video.projectId !== null;
  }
}
