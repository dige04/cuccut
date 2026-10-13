import { intlLocale, live, type FileTarget, type Id, type SpaceEntry, type SpaceEntryKind, type SpaceEntryStatus } from '@cuccut/protocol';
import { documentPreview } from './file-preview.ts';
import { formatClock } from './format.ts';
import { DESIGN } from './design-copy.ts';
import { SLIDES } from './slides-copy.ts';
import { M } from './space-copy.ts';

/**
 * Pure functions for the Space list area (product design §4.3–§4.4): categories, counts, filters, search, sorting, and the text of each column.
 * Items come from the Runtime's Space catalog; this only decides how they are viewed.
 */

export const KIND_LABEL: Record<SpaceEntryKind, string> = live(() => M.kind);

/** The order of the category sidebar. Videos are subdirectories that have a video.db (since 0.4); video files in project directories are listed separately as “video material”. */
const KIND_ORDER: SpaceEntryKind[] = ['video', 'export', 'video-file', 'image', 'audio', 'subtitle', 'document', 'slides', 'design', 'design-system', 'template', 'package'];

export type SpaceCategory = 'all' | SpaceEntryKind | 'favorite' | 'trash';

export const SPACE_CATEGORIES: { key: SpaceCategory; label: string; group: 'kinds' | 'mine' }[] = [
  {
    key: 'all',
    get label() {
      return M.categoryAll;
    },
    group: 'kinds',
  },
  ...KIND_ORDER.map((kind) => ({
    key: kind,
    get label() {
      return KIND_LABEL[kind];
    },
    group: 'kinds' as const,
  })),
  {
    key: 'favorite',
    get label() {
      return M.favorite;
    },
    group: 'mine',
  },
  {
    key: 'trash',
    get label() {
      return M.trash;
    },
    group: 'mine',
  },
];

export type SpaceSort = 'recent' | 'created' | 'updated' | 'name' | 'kind';

export const SPACE_SORTS: readonly { readonly key: SpaceSort; readonly label: string }[] = (['recent', 'created', 'updated', 'name', 'kind'] as const).map((key) => ({
  key,
  get label() {
    return M.sort[key];
  },
}));

/*
 * A video appears only once (product design §4.3): files exported from a video, or generated or downloaded for it (`origin.videoId`), are folded into that video's card under “All” and “Video”; the card says how many files it has, and the view box lists each one. By type, favorites, and trash, files are still listed one by one — that is for finding a certain kind of file, or the ones you marked yourself. Templates are not folded in: they are for applying to other videos, so a template is a thing in its own right. When the video is gone or in the trash, its files each appear on their own (§4.9).
 */
const FOLDED: readonly SpaceCategory[] = ['all', 'video'];
/** The order of files folded into a video (prototype FILE_ORDER): the finished cut first, then source files, subtitles, documents, images, and audio. */
const FILE_ORDER: readonly SpaceEntryKind[] = ['export', 'video-file', 'subtitle', 'document', 'image', 'audio', 'package'];

/** One row in the list area. A video with files folded in has extra `files` and `activityAt`; when a search or status filter matches only through the files under it, `hits` are the matching files. */
export type SpaceRow = SpaceEntry & {
  /** The files folded into this video: sorted first by type, then by recent activity (newest first). */
  files?: SpaceEntry[];
  /** The most recent activity among the video and these files: the “Recent activity” sort and this row's relative time use it. */
  activityAt?: string;
  hits?: Id[];
};

/** The video an item came from (exported by it, or generated or downloaded for it); null for the video itself and for items in the trash. Deleting a video lists these too (§4.9). */
export function fromVideoId(entry: Pick<SpaceEntry, 'kind' | 'origin' | 'user'>): Id | null {
  return entry.kind !== 'video' && !entry.user.trashedAt ? (entry.origin?.videoId ?? null) : null;
}

/**
 * The videoId of the parent video of a derived sub-video (`videos_derive`, `origin.source` is `derived`); null when not derived. A sub-video is an independent video,
 * and is not folded into the parent's card (`fromVideoId` is always null for videos).
 */
export function derivedFrom(entry: Pick<SpaceEntry, 'kind' | 'origin'>): Id | null {
  return entry.kind === 'video' && entry.origin?.source === 'derived' ? (entry.origin.videoId ?? null) : null;
}

/** How many sub-videos have been derived from this video (those in the trash are not counted). */
export function derivedCount(entries: readonly Pick<SpaceEntry, 'kind' | 'origin' | 'user'>[], videoId: Id): number {
  return entries.filter((entry) => !entry.user.trashedAt && derivedFrom(entry) === videoId).length;
}

/** Video entries that can take files: not in the trash, with a known videoId. When the same videoId appears in two places (the video directory was copied), files go into the one listed first. */
function hostIds(entries: readonly SpaceEntry[]): Map<Id, Id> {
  const hosts = new Map<Id, Id>();
  for (const entry of entries) {
    if (entry.kind !== 'video' || entry.user.trashedAt || !entry.ref || !('videoId' in entry.ref)) continue;
    if (!hosts.has(entry.ref.videoId)) hosts.set(entry.ref.videoId, entry.id);
  }
  return hosts;
}

const newestFirst = (a: Pick<SpaceEntry, 'lastActivityAt'>, b: Pick<SpaceEntry, 'lastActivityAt'>) => b.lastActivityAt.localeCompare(a.lastActivityAt);

/** Folds the files that belong to videos into their video: returns the top-level rows; a video that has files is a copy with `files`; the original entry is untouched. */
export function groupEntries(entries: readonly SpaceEntry[]): SpaceRow[] {
  const hosts = hostIds(entries);
  const files = new Map<Id, SpaceEntry[]>();
  const top: SpaceEntry[] = [];
  for (const entry of entries) {
    const videoId = entry.kind === 'template' ? null : fromVideoId(entry);
    const host = videoId ? hosts.get(videoId) : undefined;
    if (host) files.set(host, [...(files.get(host) ?? []), entry]);
    else top.push(entry);
  }
  return top.map((entry) => {
    const own = files.get(entry.id);
    if (!own) return entry;
    own.sort((a, b) => FILE_ORDER.indexOf(a.kind) - FILE_ORDER.indexOf(b.kind) || newestFirst(a, b));
    const activityAt = own.reduce((at, f) => (f.lastActivityAt > at ? f.lastActivityAt : at), entry.lastActivityAt);
    return { ...entry, files: own, activityAt };
  });
}

/** The files under a video entry (the same batch folded into its card); empty when it is not a video, the video is in the trash, or it has no files. */
export function filesOf(entries: readonly SpaceEntry[], entryId: Id): SpaceEntry[] {
  return groupEntries(entries).find((row) => row.id === entryId)?.files ?? [];
}

/** The video a file is folded into (the view box's “View video” goes back to it); null when it is not folded into a video. */
export function hostVideoOf(entries: readonly SpaceEntry[], entry: SpaceEntry): SpaceEntry | null {
  const videoId = entry.kind === 'template' ? null : fromVideoId(entry);
  const host = videoId ? hostIds(entries).get(videoId) : undefined;
  return host ? (entries.find((e) => e.id === host) ?? null) : null;
}

/** The parent video of a cut short video (the view box's “View source video” goes back to it): the one that is not in the trash; null when it is not derived or the parent is missing. */
export function parentVideoOf(entries: readonly SpaceEntry[], entry: SpaceEntry): SpaceEntry | null {
  const videoId = derivedFrom(entry);
  const parent = videoId ? hostIds(entries).get(videoId) : undefined;
  return parent ? (entries.find((e) => e.id === parent) ?? null) : null;
}

/** When a search or filter matches only through the files under a video, the row's note says which file (“Found English subtitles.srt”); null when the row is not of that kind. */
export function hitsText(row: SpaceRow): string | null {
  const first = row.hits?.length ? row.files?.find((f) => f.id === row.hits![0]) : undefined;
  return first ? M.foundFiles(first.name, row.hits!.length) : null;
}

/** Details of “N files”: “Finished cut 2 · Subtitles 1”, in the order of the category sidebar. */
export function filesSummary(row: SpaceRow): string {
  const counts = new Map<SpaceEntryKind, number>();
  for (const file of row.files ?? []) counts.set(file.kind, (counts.get(file.kind) ?? 0) + 1);
  return KIND_ORDER.filter((kind) => counts.has(kind))
    .map((kind) => M.kindCount(KIND_LABEL[kind], counts.get(kind)!))
    .join(' · ');
}

/*
 * When the video has no status of its own, the card's status light speaks for the files under it: generating, failed, missing, or source changed must be visible (§4.4);
 * candidate, applied, and published are the normal state and do not take the spot.
 */
const ATTENTION: readonly SpaceEntryStatus[] = ['generating', 'failed', 'missing', 'source-changed'];

/** The status most worth seeing among the files under it: {status, text} (“Finished cut source changed”, “2 files missing”); null when the video has its own status or there is nothing to say. */
export function filesAttention(row: SpaceRow): { status: SpaceEntryStatus; text: string } | null {
  if (row.status) return null;
  for (const status of ATTENTION) {
    const hit = (row.files ?? []).filter((f) => f.status === status);
    if (hit.length === 1) return { status, text: M.fileStatus(KIND_LABEL[hit[0]!.kind], statusText(hit[0]!)!) };
    if (hit.length > 1) return { status, text: M.filesStatus(hit.length, SPACE_STATUS[status].label) };
  }
  return null;
}

/** The trash only holds items that were moved there; other categories exclude items in the trash. */
export function inCategory(entry: SpaceEntry, category: SpaceCategory): boolean {
  if (category === 'trash') return entry.user.trashedAt !== null;
  if (entry.user.trashedAt !== null) return false;
  if (category === 'all') return true;
  if (category === 'favorite') return entry.user.favorite;
  return entry.kind === category;
}

/** The item count of each category (at the end of the sidebar row). “All” and “Video” count cards: a video with its files folded in counts as one (`groupEntries`). */
export function countByCategory(entries: readonly SpaceEntry[]): Record<SpaceCategory, number> {
  const counts = Object.fromEntries(SPACE_CATEGORIES.map((c) => [c.key, 0])) as Record<SpaceCategory, number>;
  for (const entry of entries) {
    for (const { key } of SPACE_CATEGORIES) if (!FOLDED.includes(key) && inCategory(entry, key)) counts[key]++;
  }
  for (const row of groupEntries(entries)) {
    for (const key of FOLDED) if (inCategory(row, key)) counts[key]++;
  }
  return counts;
}

/** Only categories that have items appear in the sidebar; All, Favorites, and Trash always appear. */
export function visibleCategories(counts: Record<SpaceCategory, number>) {
  return SPACE_CATEGORIES.filter((c) => c.group === 'mine' || c.key === 'all' || counts[c.key] > 0);
}

/** Status (product design §4.4, prototype model-space.js STATUS): the text and the tone of the StatusLight. */
type StatusTone = 'informative' | 'notice' | 'positive' | 'negative';
const status = (key: SpaceEntryStatus, tone: StatusTone) => ({
  get label() {
    return M.status[key];
  },
  tone,
});
export const SPACE_STATUS: Record<SpaceEntryStatus, { label: string; tone: StatusTone }> = {
  generating: status('generating', 'informative'),
  candidate: status('candidate', 'notice'),
  applied: status('applied', 'positive'),
  published: status('published', 'positive'),
  'source-changed': status('source-changed', 'notice'),
  missing: status('missing', 'negative'),
  failed: status('failed', 'negative'),
};

/** The “Status” filter (prototype page-space.jsx): all statuses, each status, and no status. */
export type SpaceStatusFilter = 'any' | SpaceEntryStatus | 'none';
export const SPACE_STATUS_FILTERS: { key: SpaceStatusFilter; label: string }[] = [
  {
    key: 'any',
    get label() {
      return M.statusAny;
    },
  },
  ...(Object.keys(SPACE_STATUS) as SpaceEntryStatus[]).map((key) => ({
    key,
    get label() {
      return SPACE_STATUS[key].label;
    },
  })),
  {
    key: 'none',
    get label() {
      return M.statusNone;
    },
  },
];

/** The text in the status column and on the card's corner: generating shows progress (prototype statusText); null when there is no status. */
export function statusText(entry: Pick<SpaceEntry, 'status' | 'statusDetail'>): string | null {
  if (!entry.status) return null;
  const label = SPACE_STATUS[entry.status].label;
  const progress = entry.status === 'generating' ? entry.statusDetail?.progress : undefined;
  if (progress && progress.total) return `${label} · ${Math.min(100, Math.round((progress.done / progress.total) * 100))}%`;
  return label;
}

/**
 * Which project an item belongs to: a downloaded transcript follows its explicit project ownership, independent of the save path. Other bytes in a project directory look at their source; products and placeholders not in a source directory (both source fields null) look at `origin.projectId`
 * (architecture design §5.7; the `projectId` filter of `space.list` also checks both places). null when it belongs to no project.
 */
export function entryProjectId(entry: Pick<SpaceEntry, 'source' | 'origin'>): Id | null {
  return (entry.origin?.capability === 'link-import' ? entry.origin.projectId : entry.source.projectId ?? entry.origin?.projectId) ?? null;
}

export interface SpaceQuery {
  category: SpaceCategory;
  /** Project id; 'none' means it belongs to no project. */
  projectId: Id | 'none' | null;
  search: string;
  sort: SpaceSort;
  /** Status filter; when not given, no filtering by status. */
  status?: SpaceStatusFilter;
  /** Show only the videos derived from this video (`derivedFrom`); when not given, no filtering by source. */
  from?: Id | null;
}

/**
 * The list area: category → source (`from`) → project → status → search → sort. “All” and “Video” first fold files into their videos (`groupEntries`); if the video itself, or any of its files,
 * matches the status and search, the row stays; a row matched only through files records which files in `hits`. “No status” looks only at the video itself: a file having no status says nothing.
 */
export function viewEntries(entries: readonly SpaceEntry[], query: SpaceQuery): SpaceRow[] {
  const q = query.search.trim().toLowerCase();
  const status = query.status ?? 'any';
  const matches = (entry: SpaceEntry, self: boolean) =>
    (status === 'any' || (status === 'none' ? self && entry.status === null : entry.status === status)) &&
    (!q || entry.name.toLowerCase().includes(q) || entry.relPath.toLowerCase().includes(q));
  const base: readonly SpaceRow[] = FOLDED.includes(query.category) ? groupEntries(entries) : entries;
  const rows = base.flatMap((row): SpaceRow[] => {
    const project = entryProjectId(row);
    if (!inCategory(row, query.category)) return [];
    if (query.from && derivedFrom(row) !== query.from) return [];
    if (query.projectId !== null && (query.projectId === 'none' ? project !== null : project !== query.projectId)) return [];
    if (matches(row, true)) return [row];
    const hits = (row.files ?? []).filter((file) => matches(file, false));
    return hits.length ? [{ ...row, hits: hits.map((file) => file.id) }] : [];
  });
  const recent = (a: SpaceRow, b: SpaceRow) => (b.activityAt ?? b.lastActivityAt).localeCompare(a.activityAt ?? a.lastActivityAt);
  return rows.sort((a, b) => {
    if (query.sort === 'created' || query.sort === 'updated') {
      const key = query.sort === 'created' ? 'createdAt' : 'updatedAt';
      const at = (entry: SpaceEntry) => {
        const time = entry[key] ? Date.parse(entry[key]!) : NaN;
        return Number.isFinite(time) ? time : -Infinity;
      };
      return at(b) - at(a) || 0;
    }
    if (query.sort === 'name') return a.name.localeCompare(b.name, intlLocale()) || recent(a, b);
    if (query.sort === 'kind') return KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || recent(a, b);
    return recent(a, b);
  });
}

/** The options of the “Project” filter: the projects that appear among the items (by name), with one more entry at the end when there are items that belong to no project. */
export function projectOptions(entries: readonly SpaceEntry[], projects: readonly { id: Id; name: string }[]) {
  const seen = new Set(entries.map(entryProjectId));
  const options = projects
    .filter((p) => seen.has(p.id))
    .map((p) => ({ key: p.id as string, label: p.name }))
    .sort((a, b) => a.label.localeCompare(b.label, intlLocale()));
  if (seen.has(null)) options.push({ key: 'none', label: M.noProject });
  return options;
}

/**
 * The “duration or size” column (prototype sizeText): video shows duration and frame size, audio shows duration, images show size, slides show page count, and design mocks show artboard count. null when the Runtime gives no media info;
 * the UI then falls back to writing the file size.
 */
export function measureText(entry: Pick<SpaceEntry, 'kind' | 'media'> & Partial<Pick<SpaceEntry, 'deck' | 'canvas'>>): string | null {
  if (entry.kind === 'slides') return entry.deck ? SLIDES.pages(entry.deck.slideCount) : null;
  if (entry.kind === 'design') return entry.canvas ? DESIGN.boards(entry.canvas.boardCount) : null;
  const media = entry.media;
  if (!media) return null;
  const duration = media.durationSec && media.durationSec > 0 ? formatClock(media.durationSec) : null;
  const frame = media.width && media.height ? `${media.width}×${media.height}` : null;
  const parts = entry.kind === 'audio' ? [duration] : entry.kind === 'image' ? [frame] : [duration, frame];
  const text = parts.filter(Boolean).join(' · ');
  return text || null;
}

/** File size: “512 B”, “1.2 MB”. */
export function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = size / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}

/** Preview method: a media element, plain text, or not yet previewable in CucCut. */
export function previewKind(entry: Pick<SpaceEntry, 'kind' | 'fileName'>): 'image' | 'video' | 'audio' | 'text' | 'markdown' | 'pdf' | 'html' | 'table' | 'json' | null {
  const ext = entry.fileName.slice(entry.fileName.lastIndexOf('.') + 1).toLowerCase();
  if (entry.kind === 'image') return ext === 'heic' ? null : 'image';
  if (entry.kind === 'video-file') return ext === 'mkv' || ext === 'avi' ? null : 'video';
  if (entry.kind === 'audio') return 'audio';
  if (entry.kind === 'subtitle') return 'text';
  if (entry.kind === 'document') return documentPreview(entry.fileName) ?? (isPlainText(entry.fileName) || ext === 'txt' ? 'text' : null);
  return null;
}

/** Files opened with the player: video and audio. AVI cannot be played in the browser; whether MKV plays depends on its codec, and when it does not, the player says so. */
export function isPlayable(fileName: string): boolean {
  const kind = kindOfFileName(fileName);
  return kind === 'audio' || (kind === 'video-file' && !/\.avi$/i.test(fileName));
}

const KIND_BY_EXT: Record<string, SpaceEntryKind> = {};
for (const [kind, exts] of [
  ['video-file', ['mp4', 'mov', 'm4v', 'webm', 'mkv', 'avi']],
  ['image', ['png', 'jpg', 'jpeg', 'gif', 'webp', 'heic', 'svg', 'bmp', 'avif']],
  ['audio', ['mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg', 'opus']],
  ['subtitle', ['srt', 'vtt', 'ass', 'ssa']],
  ['document', ['md', 'markdown', 'txt', 'pdf', 'doc', 'docx', 'rtf', 'html', 'htm', 'csv', 'tsv', 'json']],
] as [SpaceEntryKind, string[]][]) {
  for (const ext of exts) KIND_BY_EXT[ext] = kind;
}

/** The same table as the Runtime's Space categories; files changed in a session also use it to decide how to preview. */
/** The preview method judged from the file name alone (judged before the file viewer loads; types that cannot be opened go to the system default app); null when not recognized. */
export function previewModeOfFileName(fileName: string): ReturnType<typeof previewKind> {
  const kind = kindOfFileName(fileName);
  return documentPreview(fileName) ?? (kind ? previewKind({ kind, fileName }) : isPlainText(fileName) ? 'text' : null);
}

export function kindOfFileName(fileName: string): SpaceEntryKind | null {
  const dot = fileName.lastIndexOf('.');
  return dot < 0 ? null : (KIND_BY_EXT[fileName.slice(dot + 1).toLowerCase()] ?? null);
}

/** Text files that are not Space categories (code, config) are shown as plain text in the session's file viewer. */
const TEXT_EXTS = new Set([
  'json',
  'txt', 'md', 'markdown', 'tsv', 'htm', 'c', 'h', 'cpp', 'hpp', 'java', 'kt', 'swift', 'sql', 'ini', 'conf', 'scss', 'vue', 'svelte', 'rb', 'php', 'ipynb',
  'js',
  'ts',
  'tsx',
  'jsx',
  'css',
  'html',
  'py',
  'sh',
  'yml',
  'yaml',
  'toml',
  'csv',
  'xml',
  'log',
  'rs',
  'go',
]);
export function isPlainText(fileName: string): boolean {
  const dot = fileName.lastIndexOf('.');
  return dot >= 0 && TEXT_EXTS.has(fileName.slice(dot + 1).toLowerCase());
}

type SourceDirs = {
  projects: readonly { id: Id; name: string; path: string }[];
  conversations: readonly { id: Id; title: string; cwd: string }[];
};

/**
 * The item's location on disk: the source directory (project directory or session working directory) plus the relative path; when it is not in a source directory, it is the file the result was written to (`entry.file`,
 * the published file and copies in the save location). null when neither applies.
 */
export function entryPath(entry: SpaceEntry, dirs: SourceDirs): string | null {
  const { projectId, conversationId } = entry.source;
  const root = projectId
    ? dirs.projects.find((p) => p.id === projectId)?.path
    : conversationId
      ? dirs.conversations.find((c) => c.id === conversationId)?.cwd
      : undefined;
  return root ? `${root.replace(/\/+$/, '')}/${entry.relPath}` : (entry.file?.path ?? null);
}

/**
 * The “Source” column (prototype sourceText: project · video): the project name, or the session that belongs to no project; when the file is not at the top level of the source directory, its subdirectory is included.
 * Products and placeholders not in a source directory are written from `origin`: the project they belong to (or the session that produced them), and the video that produced them (when present in `videoNames`).
 * A derived sub-video is written later as “from parent name”.
 */
export function sourceLabel(entry: SpaceEntry, dirs: SourceDirs, untitled: string, videoNames?: ReadonlyMap<Id, string>): string {
  const { projectId, conversationId } = entry.source;
  const projectName = (id: Id) => dirs.projects.find((p) => p.id === id)?.name ?? M.removedProject;
  const conversationName = (id: Id | null | undefined) => M.conversation(dirs.conversations.find((c) => c.id === id)?.title || untitled);
  if (!projectId && !conversationId) {
    const origin = entry.origin;
    const owner = origin?.projectId
      ? projectName(origin.projectId)
      : origin?.conversationId
        ? conversationName(origin.conversationId)
        : M.noProject;
    const video = origin?.videoId ? videoNames?.get(origin.videoId) : undefined;
    return video ? `${owner} · ${video}` : owner;
  }
  const owner = projectId ? projectName(projectId) : conversationName(conversationId);
  const slash = entry.relPath.lastIndexOf('/');
  const place = slash > 0 ? `${owner} · ${entry.relPath.slice(0, slash)}` : owner;
  // Derived sub-video: include the parent video (when present in `videoNames`).
  const parent = derivedFrom(entry);
  const parentName = parent ? videoNames?.get(parent) : undefined;
  return parentName ? `${place} · ${M.derivedFrom(parentName)}` : place;
}

/** The name of a video entry, looked up by videoId (the “Source” column writes which video a product came from). */
export function videoNamesOf(entries: readonly SpaceEntry[]): Map<Id, string> {
  const names = new Map<Id, string>();
  for (const entry of entries) if (entry.ref && 'videoId' in entry.ref) names.set(entry.ref.videoId, entry.name);
  return names;
}

/** The locator a Space video entry uses to open it: its relative path in the source directory it is in (consistent with the location after creating a new video). */
export function videoTargetOf(entry: SpaceEntry): FileTarget {
  return entry.source.projectId
    ? { projectId: entry.source.projectId, path: entry.relPath }
    : { conversationId: entry.source.conversationId!, path: entry.relPath };
}

/**
 * The start page “+ › Recent videos” (prototype composer-insert-menu.jsx, BC_SPACE.recentMovies): the few most recently active videos, newest first.
 * Only lists videos stored in project directories (the session is built in that project, so the agent can read and write it); videos in the trash and missing ones are not listed. `projects` are the projects that can still be chosen.
 */
export function recentVideos(entries: readonly SpaceEntry[], projects: readonly Id[], max = 8): SpaceEntry[] {
  const open = new Set(projects);
  return entries
    .filter(
      (e) =>
        e.kind === 'video' &&
        !e.user.trashedAt &&
        e.status !== 'missing' &&
        !!e.ref &&
        'videoId' in e.ref &&
        !!e.source.projectId &&
        open.has(e.source.projectId),
    )
    .sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt))
    .slice(0, max);
}
