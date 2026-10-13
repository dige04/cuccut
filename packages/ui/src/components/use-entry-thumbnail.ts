import { useEffect, useSyncExternalStore } from 'react';
import type { SpaceEntry } from '@cuccut/protocol';
import { thumbnailVersion, wantsThumbnail, type Thumbnail } from '../model/space-thumbnail.ts';
import { useRuntime } from '../runtime/context.tsx';

/** The thumbnail cache shared by Space and session cards; fetched by version on mount, so the video does not need to be opened in the editor. */
export function useEntryThumbnail(entry: SpaceEntry | null): Thumbnail | null {
  const cache = useRuntime().spaceThumbnails;
  const wanted = entry !== null && wantsThumbnail(entry);
  const version = entry ? thumbnailVersion(entry) : '';
  const id = entry?.id;
  const kind = entry?.kind;
  useEffect(() => (wanted && id && kind ? cache.retain(id, kind, version) : undefined), [cache, id, kind, version, wanted]);
  useSyncExternalStore(cache.subscribe, cache.version);
  return wanted && id ? cache.peek(id) : null;
}
