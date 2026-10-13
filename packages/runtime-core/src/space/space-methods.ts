import { RpcError, type Id, type SpaceEntry } from '@cuccut/protocol';
import type { Harness } from '@cuccut/harness';
import type { TrustedPrincipal } from '../gateway.ts';
import type { RpcHandlers } from '../handlers.ts';
import type { SpaceCatalog } from '../space-catalog.ts';
import type { VideoTrash } from '../videos/video-trash.ts';
import type { SpaceThumbnails } from './space-thumbnails.ts';
import { continueInConversation } from './space-continue.ts';
import { USER_VIEWER, listEntries, searchContent, visibleEntry, type SpaceViewer } from './space-queries.ts';
import { RcSpace } from '@cuccut/protocol/messages/runtime-core';

type SpaceMethod =
  | 'space.list'
  | 'space.get'
  | 'space.search'
  | 'space.import'
  | 'space.rename'
  | 'space.setFavorite'
  | 'space.trash'
  | 'space.restore'
  | 'space.purge'
  | 'space.openForEdit'
  | 'space.thumbnail'
  | 'space.continueInConversation'
  | 'space.rebuildIndex';

export interface SpaceMethodDeps {
  harness: Harness;
  /** Deleting and restoring videos: video entries moving into and out of the trash are handled here. */
  trash: VideoTrash;
  /** Thumbnail of an entry (`space.thumbnail`). */
  thumbnails: SpaceThumbnails;
}

/**
 * Changes user markers (`space.update`, `space.trash`, `space.restore`). Moving a video entry into or out of the trash is not writing a marker; it moves the video directory (§5.5). Moving into the trash becomes `videos.delete`, and restoring a deleted video becomes `videos.restore`, with the same preconditions and errors. Other fields are written as markers as usual.
 */
export async function updateEntry(
  space: SpaceCatalog,
  trash: VideoTrash,
  params: { entryId: Id; favorite?: boolean; displayName?: string | null; trashed?: boolean },
  principal: TrustedPrincipal,
): Promise<SpaceEntry> {
  const { trashed, ...marks } = params;
  const hasMarks = marks.favorite !== undefined || marks.displayName !== undefined;
  if (trashed === true && isLiveVideo(space, params.entryId)) {
    if (hasMarks) await space.update(marks);
    const deleted = await trash.delete({ entryId: params.entryId }, principal);
    return space.get(deleted.entryId);
  }
  if (trashed === false && space.trashedVideo(params.entryId)) {
    const { entry } = await trash.restore(params.entryId);
    return hasMarks ? space.update({ ...marks, entryId: entry.id }) : entry;
  }
  // A video that is already deleted is moved into the trash again (repeated request): it still answers with the trash entry.
  const trashedVideo = trashed === true ? space.trashedVideo(params.entryId) : null;
  if (trashedVideo) return hasMarks ? space.update({ ...marks, entryId: trashedVideo.entryId }) : space.get(trashedVideo.entryId);
  return space.update(params);
}

function isLiveVideo(space: SpaceCatalog, entryId: Id): boolean {
  try {
    space.videoEntry(entryId);
    return true;
  } catch {
    return false;
  }
}

/** Scope of Space for principals on the gateway (shared by `space.*` and the tool candidate input `tools.candidates`). External services do not go through here. */
export function viewerOf(principal: TrustedPrincipal): SpaceViewer {
  if (principal.kind === 'service') throw new RpcError('forbidden', RcSpace.serviceUsesMcp());
  return USER_VIEWER;
}

/**
 * Handlers for `space.*` (architecture design §5.7, §5.11), merged into the method table by `handlers.ts`. Principals on the gateway (the UI, CLI, Web) are the user themselves and see all entries. External services do not go through the gateway; their scope is applied at the tool layer (`space_list` / `space_search`). The Web allowlist and the path constraints of `space.import` are in `services/web-handlers.ts`.
 */
export function spaceMethods(space: SpaceCatalog, deps: SpaceMethodDeps): Pick<RpcHandlers['methods'], SpaceMethod> {
  const { harness, trash, thumbnails } = deps;
  return {
    'space.list': (p, principal) => listEntries(space, viewerOf(principal), p),
    'space.get': (p, principal) => ({ entry: visibleEntry(space, viewerOf(principal), p.entryId) }),
    'space.search': (p, principal) => searchContent(space, viewerOf(principal), p),
    'space.import': (p, principal) => {
      viewerOf(principal);
      return space.importFile({ projectId: p.projectId, file: p.path, ...(p.name ? { name: p.name } : {}) });
    },
    'space.rename': async (p) => ({ entry: await space.update({ entryId: p.entryId, displayName: p.name }) }),
    'space.setFavorite': async (p) => ({ entry: await space.update({ entryId: p.entryId, favorite: p.favorite }) }),
    'space.trash': async (p, principal) => ({ entry: await updateEntry(space, trash, { entryId: p.entryId, trashed: true }, principal) }),
    'space.restore': async (p, principal) => ({
      entry: await updateEntry(space, trash, { entryId: p.entryId, trashed: false }, principal),
    }),
    'space.purge': (p) => space.purge(p.entryId),
    'space.openForEdit': (p) => space.openForEdit(p.entryId),
    'space.thumbnail': (p, principal) => thumbnails.of(visibleEntry(space, viewerOf(principal), p.entryId)),
    'space.continueInConversation': (p, principal) => {
      viewerOf(principal);
      return continueInConversation(space, harness, p);
    },
    'space.rebuildIndex': () => space.rebuild(),
  };
}
