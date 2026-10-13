import type { SpaceEntry, SpaceEntryKind, SpaceThumbnail } from '@cuccut/protocol';

/**
 * Pure functions for Space item thumbnails (product design §4.2–§4.3; `space.thumbnail`): which items are worth fetching, which changes to an item require refetching,
 * and how the Runtime's answer becomes what the UI draws. Fetch queuing and caching are in `runtime/space-thumbnails.ts`.
 */

/** The thumbnail the UI draws: the image is a data URL; documents and subtitles are text excerpts; `none` draws a placeholder for the type. */
export type Thumbnail =
  { kind: 'image'; url: string; width: number; height: number } | { kind: 'text'; excerpt: string } | { kind: 'none' };

export const NO_THUMBNAIL: Thumbnail = { kind: 'none' };

/** Types the Runtime always answers `none` for (audio, portable packages, templates) are not requested. */
const PICTURED: ReadonlySet<SpaceEntryKind> = new Set(['video', 'export', 'video-file', 'image', 'document', 'subtitle']);

/** Worth fetching a thumbnail: the type has a picture or text, and it is not missing, generating, or failed (the Runtime answers `none` for those; missing items get a grey background drawn separately). */
export function wantsThumbnail(entry: SpaceEntry): boolean {
  if (!PICTURED.has(entry.kind)) return false;
  return entry.status !== 'missing' && entry.status !== 'generating' && entry.status !== 'failed';
}

/**
 * The item's version: if any of these changes, refetch (when `entry.upsert` brings a new item). When a video's timeline changes, the recent activity is refreshed; when a file's content changes, its size or recent activity changes;
 * and when the status returns from missing or generating, or the video or path it points to changes, refetch as well.
 */
export function thumbnailVersion(entry: SpaceEntry): string {
  const ref = entry.ref && 'videoId' in entry.ref ? entry.ref.videoId : '';
  return [entry.lastActivityAt, entry.size, entry.status ?? '', ref, entry.relPath].join('|');
}

export function toThumbnail(result: SpaceThumbnail): Thumbnail {
  if (result.kind === 'image') {
    return {
      kind: 'image',
      url: `data:${result.mimeType};base64,${result.data}`,
      width: result.width,
      height: result.height,
    };
  }
  if (result.kind === 'text') return result.excerpt ? { kind: 'text', excerpt: result.excerpt } : NO_THUMBNAIL;
  return NO_THUMBNAIL;
}
