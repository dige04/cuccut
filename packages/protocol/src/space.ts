import type { Conversation, Id, SpaceEntry, SpaceEntryKind, SpaceEntryReference, SpaceEntryStatus, SpaceScanIssue } from './domain.ts';

/**
 * Parameters and results for `space.*` (architecture design §5.7, §5.11). The entry type `SpaceEntry` is in `domain.ts`, and the `space` subscription topic is in `events.ts`.
 */

/** Maximum number of entries per page for `space.list`. */
export const SPACE_LIST_MAX_LIMIT = 500;
/** Maximum number of hits `space.search` returns. */
export const SPACE_SEARCH_MAX_LIMIT = 200;

export interface SpaceListParams {
  /** Only list entries of this project; `null` is an entry that belongs to no project. When not given, no project filter is applied. */
  projectId?: Id | null;
  kind?: SpaceEntryKind | SpaceEntryKind[];
  /** `none` is for entries with no state (plain files, videos). */
  status?: SpaceEntryStatus | 'none' | (SpaceEntryStatus | 'none')[];
  /** Source video: the video itself, entries generated or exported from it, and child videos derived from it (`origin.source` is `derived`, such as a clipped short). */
  videoId?: Id;
  favorite?: boolean;
  /** Trash: default `exclude` (entries in the trash are not listed), `only` lists only the trash, `include` lists everything. */
  trash?: 'exclude' | 'only' | 'include';
  /** `nextCursor` from the previous page's result. */
  cursor?: string;
  /** Default 100, max `SPACE_LIST_MAX_LIMIT`. */
  limit?: number;
}

/** Sorted by most recent activity, newest first; ties broken by `id`. */
export interface SpaceListResult {
  entries: SpaceEntry[];
  /** Total number of entries matching the filter (not just this page). */
  total: number;
  /** Given when there is a next page. If the directory changes between requests, paging may skip or repeat some entries. */
  nextCursor: string | null;
  issues: SpaceScanIssue[];
  /** The first scan has not finished yet. */
  scanning: boolean;
}

/** Document kinds searched by content search: transcripts, subtitles, translations and chapters (chapter titles and summaries). */
export type SpaceSearchDocumentKind = 'speech' | 'caption' | 'translation' | 'chapter';

export interface SpaceSearchParams {
  /** All space-separated words must appear (within the same passage); case-insensitive and full-width/half-width insensitive. May be empty when only `speaker` is given. */
  query: string;
  /** Only search videos of this project; `null` is a video that belongs to no project. */
  projectId?: Id | null;
  videoIds?: Id[];
  kinds?: SpaceSearchDocumentKind[];
  /** The speaker's name contains this text. */
  speaker?: string;
  /** Default 50, max `SPACE_SEARCH_MAX_LIMIT`. */
  limit?: number;
}

export interface SpaceSearchHit {
  videoId: Id;
  videoName: string;
  /** The video's entry in Space; null when the video directory is not currently in any source directory. */
  entryId: Id | null;
  projectId: Id | null;
  /** Chapters have no document. */
  documentId: Id | null;
  documentKind: SpaceSearchDocumentKind;
  language: string | null;
  /**
   * Time position (seconds). `sequence` is the time on the root sequence (the document is projected through the timeline; chapters are on the sequence). `source` is the source time in the material the document corresponds to, used when the material is not on the timeline and cannot be projected. Based on the video version at indexing time; after the video is opened, the client re-locates it against the current version (§5.11).
   */
  time: { clock: 'sequence' | 'source'; start: number; end: number };
  /** The passage of text containing the hit (cut to the area around the hit when too long). */
  snippet: string;
  /** Position of the hit within `snippet`: `[start, end)` as UTF-16 indices. */
  highlights: [number, number][];
  speaker: string | null;
  /** Video version at indexing time. */
  indexedRevision: string;
}

export interface SpaceSearchResult {
  hits: SpaceSearchHit[];
  /** Whether the index covers all videos in range and all are at their current version. False during a rebuild or incremental update: results may be missing videos or be of an old version. */
  complete: boolean;
  /** Number of videos not yet indexed (or being rebuilt). */
  pendingVideos: number;
  /** Hits exceeded `limit`; only the first ones are returned. */
  truncated: boolean;
}

/** One reference that blocks physical deletion (architecture design §5.5). */
export interface SpaceReference {
  /**
   * `video-asset`: a video's material references this file (for a deleted video: another video links to a file in its directory). `job`: a running job uses it. `unverified`: some video cannot be read right now (engine unavailable, library corrupted), so it cannot be confirmed there are no references; treated as “has references”. `user-file`: the deleted video directory contains files not managed by the video (for example, original source files linked by relative path); these are not deleted on the user's behalf.
   */
  kind: 'video-asset' | 'job' | 'unverified' | 'user-file';
  videoId?: Id;
  videoName?: string;
  assetId?: Id;
  jobId?: Id;
  detail: string;
}

export type SpacePurgeResult = { status: 'purged'; entryId: Id } | { status: 'blocked'; entryId: Id; references: SpaceReference[] };

/**
 * `space.openForEdit`: from an entry, go back to the editable video (§5.7 “Back to the video from the finished cut”). It only answers where to go and does not open the video; the client takes `target` and calls `videos.open`.
 *
 * - `video`: the entry itself is a video;
 * - `source-video`: there is a source video. `frozenRevision` is the video revision the finished cut (or generated result) corresponds to, and `currentRevision` is the video's current revision. When they differ (`changed`), the client shows the difference. When the source video is not in any source directory at the moment, `target` is null;
 * - `new-video`: there is no source video (a standalone file, image or audio): it can be used to “create a new video from this material”, and `projectId` is the suggested project to put it in.
 */
export type SpaceOpenForEditResult =
  | { mode: 'video'; videoId: Id | null; target: { entryId: Id } }
  | {
      mode: 'source-video';
      videoId: Id;
      target: { entryId: Id } | null;
      frozenRevision: string | null;
      currentRevision: string | null;
      changed: boolean;
    }
  | { mode: 'new-video'; source: { entryId: Id }; projectId: Id | null };

/** Width of the `space.thumbnail` frame in pixels. The widest video card in the session is 360, which stays sharp on 2x screens; grid cards are narrower. Not enlarged when wider than the original. */
export const SPACE_THUMBNAIL_WIDTH = 720;
/** Maximum bytes of the `space.thumbnail` body summary (UTF-8, cut at a character boundary). */
export const SPACE_EXCERPT_MAX_BYTES = 1536;

/**
 * Thumbnail of a Space entry (`space.thumbnail`, product design §4.2–§4.3). Fetched on demand and cached by the Runtime; does not include local paths.
 *
 * - `image`: a downscaled frame, width not more than `SPACE_THUMBNAIL_WIDTH`, height not more than 3 times the width, aspect ratio kept, not enlarged; `data` is base64.
 *   For a video, the frame of the current working draft's cover (`posterFrame`) is used. For a finished cut and video material, whichever of 1 second and 10% of the duration comes first is used (if the video is shorter, the first frame is used).
 *   Images are downscaled. Images that may have transparency (PNG, GIF, WebP) give PNG; the rest give JPEG.
 * - `text`: the opening body of documents (md, txt) and subtitles (srt, vtt, ass, ssa): UTF-8 (UTF-16 with a BOM is also accepted). For subtitles, the sequence numbers, timecodes, styles and tags are removed, leaving only the dialogue, one line per cue.
 * - `none`: nothing to draw: audio, portable packages, templates, placeholders, files that no longer exist, deleted videos, videos with no visible video segment, and files that cannot be read or decoded (PDF, Word, SVG, HEIC, text that is not UTF-8).
 */
export type SpaceThumbnail =
  | { kind: 'image'; mimeType: 'image/jpeg' | 'image/png'; data: string; width: number; height: number }
  | { kind: 'text'; excerpt: string }
  | { kind: 'none' };

export interface SpaceRebuildResult {
  /** Number of entries after the rebuild. */
  entries: number;
  /** Number of videos whose content index still needs rebuilding (this runs in the background; during this time search results are marked incomplete). */
  pendingVideos: number;
}

/**
 * Result of `videos.delete` (architecture design §5.5, §5.7): the whole video directory is moved into the source directory's trash (`.ccut-trash/`). The entry stays in Space's trash with `entryId` unchanged, and can be restored with `videos.restore`. `related` are the entries generated and exported from it: they are not deleted with the video.
 */
export interface VideoDeleteResult {
  status: 'trashed';
  entryId: Id;
  videoId: Id | null;
  name: string;
  trashedAt: string;
  related: Id[];
}

/** Result of `videos.restore`: the video returns to its original location. If the original location is taken, a different name is used (`renamed`), and in that case the entry id changes along with the relative path. */
export interface VideoRestoreResult {
  entry: SpaceEntry;
  relPath: string;
  renamed: boolean;
}

/**
 * Result of `space.continueInConversation` (architecture design §5.7): the conversation to continue in (a newly created one, or the entry's original conversation) and the attached references.
 * Does not start a task: the references are sent to the agent together with the user's next message.
 */
export interface SpaceContinueResult {
  conversation: Conversation;
  created: boolean;
  reference: SpaceEntryReference;
}
