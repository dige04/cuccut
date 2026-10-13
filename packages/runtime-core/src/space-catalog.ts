import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import {
  RpcError,
  newId,
  nowIso,
  type Conversation,
  type DirectoryEvent,
  type DirectorySnapshot,
  type Id,
  type JobRecord,
  type JobSubmitter,
  type Project,
  type SpaceEntry,
  type SpaceEntryKind,
  type SpaceEvent,
  type SpaceOpenForEditResult,
  type SpacePurgeResult,
  type SpaceReference,
  type SpaceScanIssue,
  type SpaceSnapshot,
} from '@cuccut/protocol';
import { TopicLog, type Harness, type Logger, type TopicSubscription } from '@cuccut/harness';
import { inspectDeck } from '@cuccut/slides';
import { inspectCanvas, readCanvasInfo } from '@cuccut/design';
import { inspectDesignSystem, readDesignSystemInfo } from '@cuccut/design-system';
import {
  EMPTY_MARK,
  artifactIdsOf,
  artifactRefsOf,
  spaceJobFacts,
  type SpaceArtifactStore,
  type SpaceJobFacts,
  type SpaceMarkStore,
  type TrashedVideo,
} from '@cuccut/runtime-storage';
import type { ContentIndex } from './space/content-index.ts';
import { mimeTypeOf } from './media.ts';
import {
  deriveEntries,
  type DeriveSource,
  type DerivedEntry,
  type FileStat,
  type ScannedFile,
  type ScannedItem,
} from './space/space-derive.ts';
import { RcSpace } from '@cuccut/protocol/messages/runtime-core';

export type { ScannedFile } from './space/space-derive.ts';

/**
 * The Space catalog (architecture design §5.7). It is a derived index that can be rebuilt if lost; only user marks (favorites, display names, trash, cleared placeholders)
 * and `space.import` registrations are kept in the Runtime Store. For the sources of entries and the derivation rules, see `space/space-derive.ts`:
 *
 * - Source directories: registered project directories, and the working directories of sessions that do not belong to a project. Only media and document files of recognized types are collected; hidden and dependency directories are skipped.
 *   A directory containing `video.db` is a video (video format spec §1), a directory containing a valid `deck.json` is a slide deck (docs/design/slides §7.3),
 *   a directory containing a valid `canvas.json` is a design canvas (docs/design/canvas §7.3), and a directory containing a valid `design-system.json` (v is 3, `layout` is “files”)
 *   is a design system (§10.6). The whole directory counts as one entry; it is not descended into.
 *   The design goal of indexing only registered files, not scanning the whole project directory (§5.7), is not yet achieved: the file lists in the UI and sessions depend on scanning, see §14.
 * - Job Ledger (`jobs`): generated and exported artifacts, and placeholders for jobs in progress and failed ones. Recomputed incrementally when job events arrive. Jobs that produce artifacts also record a separate derived fact
 *   (`artifacts`, `space-artifacts.json` in the Runtime Store): after the Ledger prunes old jobs, the artifact entries still remain.
 * - Deleted videos (`videos.delete`): the video directory is in the source directory's `.ccut-trash/`, recorded in `space.json`; these are the video entries in the trash.
 * - Content index (`index`): the video's videoId, current version, and the material used on the timeline, which determine the video entry's `ref`, `applied` and `source-changed`.
 *
 * Every change recomputes everything from these inputs (a pure function), then compares with the previous result and emits only the entries that changed, so incremental and rebuilt results are the same.
 */

const KIND_BY_EXT: Record<string, SpaceEntryKind> = {};
for (const [kind, exts] of Object.entries({
  'video-file': ['mp4', 'mov', 'm4v', 'webm', 'mkv', 'avi'],
  image: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'heic', 'svg', 'bmp', 'avif'],
  audio: ['mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg', 'opus'],
  subtitle: ['srt', 'vtt', 'ass', 'ssa'],
  document: ['md', 'markdown', 'txt', 'pdf', 'doc', 'docx', 'rtf', 'html', 'htm', 'csv', 'tsv', 'json'],
  // Portable packages (video format spec §8): packages exported elsewhere are recognized when they are brought in as well.
  package: ['cuccut'],
}) as [SpaceEntryKind, string[]][]) {
  for (const ext of exts) KIND_BY_EXT[ext] = kind;
}

export function classifyFile(fileName: string): SpaceEntryKind | null {
  const ext = path.extname(fileName).slice(1).toLowerCase();
  return KIND_BY_EXT[ext] ?? null;
}

const IGNORED_DIRS = new Set(['node_modules', '__pycache__', 'Pods', 'DerivedData']);

/** Hidden files and directories (including `.git` and the project marker directory `.ccut`) and dependency directories are not part of Space, and are not descended into. */
export function isIgnoredName(name: string): boolean {
  return name.startsWith('.') || IGNORED_DIRS.has(name);
}

export interface ScanLimits {
  /** Maximum depth for descending into subdirectories; the source directory itself is 0. */
  maxDepth: number;
  /** Maximum number of files collected per source. */
  maxFiles: number;
  /** Maximum number of directory entries examined per source, so that scanning does not go on forever when a very large directory was registered as a project by mistake. */
  maxVisited: number;
}

export const DEFAULT_SCAN_LIMITS: ScanLimits = { maxDepth: 6, maxFiles: 2000, maxVisited: 50_000 };

export interface ScanResult {
  files: ScannedFile[];
  issue: { kind: SpaceScanIssue['kind']; detail: string } | null;
}

/** Scans one source directory. A missing directory counts as empty; failing to read the root directory counts as a problem; subdirectories that cannot be read are skipped. Symbolic links are not followed. */
export async function scanDirectory(root: string, limits: ScanLimits = DEFAULT_SCAN_LIMITS): Promise<ScanResult> {
  const files: ScannedFile[] = [];
  const queue: { dir: string; rel: string; depth: number }[] = [{ dir: root, rel: '', depth: 0 }];
  let visited = 0;
  while (queue.length > 0) {
    const { dir, rel, depth } = queue.shift()!;
    let dirents: fs.Dirent[];
    try {
      dirents = await fsp.readdir(dir, { withFileTypes: true });
    } catch (error) {
      if (depth > 0) continue;
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') return { files, issue: null };
      return { files, issue: { kind: 'unreadable', detail: RcSpace.dirUnreadable({ code: code ?? 'error' }).text } };
    }
    dirents.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const dirent of dirents) {
      if (++visited > limits.maxVisited) {
        return { files, issue: { kind: 'truncated', detail: RcSpace.tooManyDirEntries({ max: limits.maxVisited }).text } };
      }
      if (isIgnoredName(dirent.name)) continue;
      const relPath = rel ? `${rel}/${dirent.name}` : dirent.name;
      const full = path.join(dir, dirent.name);
      if (dirent.isDirectory()) {
        const video = await inspectVideoDir(full);
        const deck = video ? null : await inspectDeck(full);
        const canvas = video || deck ? null : await inspectCanvas(full);
        const system = video || deck || canvas ? null : await inspectDesignSystem(full);
        if (video || deck || canvas || system) {
          if (files.length >= limits.maxFiles) {
            return { files, issue: { kind: 'truncated', detail: RcSpace.tooManyFiles({ max: limits.maxFiles }).text } };
          }
          if (video) files.push({ relPath, kind: 'video', ...video });
          else if (deck) {
            const { title, slideCount, ...stat } = deck;
            files.push({ relPath, kind: 'slides', ...stat, deck: { title, slideCount } });
          } else if (canvas) {
            const { title, boardCount, ...stat } = canvas;
            files.push({ relPath, kind: 'design', ...stat, canvas: { title, boardCount } });
          } else if (system) {
            const { title, namespace: _namespace, ...stat } = system;
            files.push({ relPath, kind: 'design-system', ...stat, designSystem: { title } });
          }
        } else if (depth < limits.maxDepth) queue.push({ dir: full, rel: relPath, depth: depth + 1 });
        continue;
      }
      if (!dirent.isFile()) continue;
      const kind = classifyFile(dirent.name);
      if (!kind) continue;
      if (files.length >= limits.maxFiles) {
        return { files, issue: { kind: 'truncated', detail: RcSpace.tooManyFiles({ max: limits.maxFiles }).text } };
      }
      try {
        const stat = await fsp.stat(full);
        files.push({ relPath, kind, size: stat.size, mtimeMs: stat.mtimeMs, birthtimeMs: stat.birthtimeMs });
      } catch {
        // Deleted during the scan.
      }
    }
  }
  return { files, issue: null };
}

/**
 * The size and recent activity of a video directory: `video.db` plus the managed media; writes not yet merged in the WAL also count as activity.
 * Returns null when it is not a video directory. Does not open the database and does not touch the write lock.
 */
async function inspectVideoDir(dir: string): Promise<{ size: number; mtimeMs: number; birthtimeMs: number } | null> {
  // A directory from before the rename has only `movie.db`: it is still listed, and the engine upgrades it in place to `video.db` when it opens it.
  const current = await fsp.stat(path.join(dir, 'video.db')).catch(() => null);
  const dbFile = current ? 'video.db' : 'movie.db';
  const db = current ?? (await fsp.stat(path.join(dir, dbFile)).catch(() => null));
  if (!db?.isFile()) return null;
  let size = db.size;
  let mtimeMs = db.mtimeMs;
  const wal = await fsp.stat(path.join(dir, `${dbFile}-wal`)).catch(() => null);
  if (wal) {
    size += wal.size;
    mtimeMs = Math.max(mtimeMs, wal.mtimeMs);
  }
  const blobs = await fsp.readdir(path.join(dir, 'blobs'), { withFileTypes: true }).catch(() => []);
  for (const blob of blobs) {
    if (!blob.isFile() || blob.name.startsWith('.')) continue;
    const stat = await fsp.stat(path.join(dir, 'blobs', blob.name)).catch(() => null);
    if (stat) size += stat.size;
  }
  return { size, mtimeMs, birthtimeMs: db.birthtimeMs };
}

/** The part of the Job Ledger that the Space catalog reads (`JobManager`). */
export interface SpaceJobsSource {
  list(): JobRecord[];
  onChange(listener: (job: JobRecord) => void): () => void;
  artifacts: { locate(artifactId: string): Promise<string | null> };
}

/** Version changes of open videos (`VideoService.onChange`). */
export interface SpaceVideoEvents {
  onChange(listener: (change: { videoId: Id; path: string; revision: string }) => void): () => void;
}

export interface SpaceCatalogOptions {
  harness: Harness;
  marks: SpaceMarkStore;
  log: Logger;
  /** Watches source directories for changes. Turned off in tests, where `rescan()` is used instead. */
  watch?: boolean;
  debounceMs?: number;
  limits?: ScanLimits;
  jobs?: SpaceJobsSource;
  /** Derived facts for jobs that produce artifacts; not lost when the Job Ledger is pruned. When absent, only the Ledger is consulted. */
  artifacts?: SpaceArtifactStore;
  videos?: SpaceVideoEvents;
  index?: ContentIndex;
  /**
   * Where the working directories of sessions without a project are placed (`RuntimeHome.scratchDir`, and the older `legacyScratchDir`). Exports published before a session was moved into a project, in `<directory>/<session id>/`,
   * are recognized by their location after the move into the project (`DeriveSource.formerRoots`).
   */
  scratchDirs?: readonly string[];
}

/** Trash directory: inside the source directory (on the same volume as the video directories, so moving is a rename). Hidden directories are not scanned into Space. */
export const TRASH_DIR = '.ccut-trash';

/** Files in a video directory that the video manages: physical deletion removes only these (video format spec §1). */
const VIDEO_OWNED = /^(video|movie)\.(db|db-wal|db-shm|db-journal|lock)$|^blobs$|^\.DS_Store$/;

/** A deleted video: its entry id in the trash, its record, and its source. */
export interface TrashedVideoInfo {
  entryId: Id;
  record: TrashedVideo;
  /** The source directory; null when the source is gone (the project was removed). */
  root: string | null;
}

/** The location of a video entry inside a source directory (used for deleting videos). */
export interface VideoEntryInfo {
  entry: SpaceEntry;
  dir: string;
  root: string;
  sourceKey: string;
  relPath: string;
  scope: { projectId: Id } | { conversationId: Id };
}

/** A video entry and its record in the content index. */
export interface SpaceVideo {
  entryId: Id;
  dir: string;
  projectId: Id | null;
  conversationId: Id | null;
  lastActivityAt: string;
  videoId: Id | null;
}

export class SpaceCatalog {
  readonly #harness: Harness;
  readonly #marks: SpaceMarkStore;
  readonly #log: Logger;
  readonly #watch: boolean;
  readonly #debounceMs: number;
  readonly #limits: ScanLimits;
  readonly #jobs: SpaceJobsSource | null;
  readonly #artifacts: SpaceArtifactStore | null;
  readonly #index: ContentIndex | null;
  readonly #topic: TopicLog<SpaceSnapshot, SpaceEvent>;
  readonly #sources = new Map<string, DeriveSource>();
  /** Which project a session belongs to: artifacts generated in the session are attributed to that project. */
  readonly #conversationProjects = new Map<Id, Id | null>();
  /** The parent directory of the working directories of sessions without a project; replaced with the real path before the first scan (the publish paths recorded by exports are real paths). */
  #scratchDirs: readonly string[];
  readonly #files = new Map<Id, ScannedItem>();
  #derived = new Map<Id, DerivedEntry>();
  /** File-state cache used during derivation: artifact files and publish paths outside source directories. */
  #artifactStats = new Map<string, FileStat | null>();
  #pathStats = new Map<string, FileStat | null>();
  readonly #issues = new Map<string, SpaceScanIssue>();
  readonly #watchers = new Map<string, fs.FSWatcher>();
  readonly #timers = new Map<string, ReturnType<typeof setTimeout>>();
  readonly #unsubscribe: (() => void)[] = [];
  #directory: TopicSubscription<unknown, unknown> | null = null;
  #recomputeTimer: ReturnType<typeof setTimeout> | null = null;
  #queue: Promise<void> = Promise.resolve();
  #scanning = true;
  #closed = false;
  /** The first scan has completed. */
  readonly ready: Promise<void>;
  #markReady!: () => void;

  constructor(options: SpaceCatalogOptions) {
    this.#harness = options.harness;
    this.#marks = options.marks;
    this.#log = options.log.child('space');
    this.#watch = options.watch ?? true;
    this.#debounceMs = options.debounceMs ?? 400;
    this.#limits = options.limits ?? DEFAULT_SCAN_LIMITS;
    this.#jobs = options.jobs ?? null;
    this.#artifacts = options.artifacts ?? null;
    this.#index = options.index ?? null;
    this.#scratchDirs = options.scratchDirs ?? [];
    this.#topic = new TopicLog(() => this.snapshot(), '0');
    this.ready = new Promise((resolve) => (this.#markReady = resolve));
    if (this.#jobs) {
      this.#unsubscribe.push(
        this.#jobs.onChange((job) => {
          this.#retain([job]);
          this.#scheduleRecompute();
        }),
      );
    }
    // A video in the content index was updated: recompute the derived state (`ref`, `applied`, `source-changed`).
    if (this.#index) this.#unsubscribe.push(this.#index.listen(() => this.#scheduleRecompute()));
    if (options.videos && this.#index) {
      const index = this.#index;
      this.#unsubscribe.push(options.videos.onChange((change) => index.touched(change.path, change.revision)));
    }
  }

  /** Registers the sources and subscribes to the directory topic, then does the first scan. Returns without waiting for the scan to finish. */
  start(): void {
    this.#directory = this.#harness.subscribe('directory', undefined, (event) => this.#onDirectory(event.event as DirectoryEvent));
    const initial = this.#directory.result;
    if (initial.mode === 'snapshot') {
      const snapshot = initial.snapshot as DirectorySnapshot;
      for (const project of snapshot.projects) this.#addProject(project, false);
      for (const conversation of snapshot.conversations) this.#addConversation(conversation, false);
    }
    // First add the artifact jobs still in the Ledger to the artifact records, and check deleted videos against where they actually are on disk, then do the first scan: entries do not vanish and then reappear.
    void this.#enqueue(async () => {
      const dirs = await Promise.all(this.#scratchDirs.map(async (dir) => [dir, await fsp.realpath(dir).catch(() => dir)]));
      this.#scratchDirs = [...new Set(dirs.flat())];
      if (this.#jobs) this.#retain(this.#jobs.list());
      await this.#reconcileTrash();
      await this.#scanAll();
    }).finally(() => {
      this.#scanning = false;
      this.#topic.publish({ type: 'catalog.replaced', snapshot: this.snapshot() });
      this.#markReady();
    });
  }

  async close(): Promise<void> {
    this.#closed = true;
    this.#directory?.unsubscribe();
    for (const unsubscribe of this.#unsubscribe) unsubscribe();
    for (const timer of this.#timers.values()) clearTimeout(timer);
    this.#timers.clear();
    if (this.#recomputeTimer) clearTimeout(this.#recomputeTimer);
    for (const watcher of this.#watchers.values()) watcher.close();
    this.#watchers.clear();
    await this.#queue.catch(() => {});
    await this.#index?.close();
    await this.#marks.flush().catch(() => {});
    await this.#artifacts?.flush().catch(() => {});
  }

  /** Waits until queued scans, recomputations and the content index have all finished (for tests). */
  async idle(): Promise<void> {
    for (;;) {
      await this.#index?.idle();
      await this.#queue;
      if (!this.#recomputeTimer && !this.#index?.busy) return;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }

  snapshot(): SpaceSnapshot {
    return { entries: this.entries(), issues: [...this.#issues.values()], scanning: this.#scanning };
  }

  /** All entries, from most recent activity to oldest; ties broken by id. */
  entries(): SpaceEntry[] {
    const entries = [...this.#derived.values()].map((d) => d.entry);
    entries.sort((a, b) => (a.lastActivityAt < b.lastActivityAt ? 1 : a.lastActivityAt > b.lastActivityAt ? -1 : a.id < b.id ? -1 : 1));
    return entries;
  }

  issues(): SpaceScanIssue[] {
    return [...this.#issues.values()];
  }

  get scanning(): boolean {
    return this.#scanning;
  }

  get(entryId: Id): SpaceEntry {
    const derived = this.#derived.get(entryId);
    if (!derived) throw new RpcError('not-found', RcSpace.entryGone());
    return derived.entry;
  }

  /** All video entries in source directories (the scope of content search), from most recent activity to oldest. */
  videos(): SpaceVideo[] {
    const videos: SpaceVideo[] = [];
    for (const derived of this.#derived.values()) {
      if (!derived.videoDir) continue;
      const { entry } = derived;
      videos.push({
        entryId: entry.id,
        dir: derived.videoDir,
        projectId: entry.source.projectId,
        conversationId: entry.source.conversationId,
        lastActivityAt: entry.lastActivityAt,
        videoId: entry.ref && 'videoId' in entry.ref ? entry.ref.videoId : null,
      });
    }
    videos.sort((a, b) => (a.lastActivityAt < b.lastActivityAt ? 1 : a.lastActivityAt > b.lastActivityAt ? -1 : 0));
    return videos;
  }

  /** All source directories (project directories, and the working directories of sessions without a project). */
  sourceRoots(): string[] {
    return [...this.#sources.values()].map((source) => source.root);
  }

  get index(): ContentIndex | null {
    return this.#index;
  }

  subscribe(afterSeq: string | undefined, listener: Parameters<TopicLog<SpaceSnapshot, SpaceEvent>['subscribe']>[1]) {
    return this.#topic.subscribe(afterSeq, listener);
  }

  /** Rescans all sources immediately; when done, emits one `catalog.replaced`. */
  rescan(): Promise<void> {
    return this.#enqueue(async () => {
      await this.#scanAll();
      this.#topic.publish({ type: 'catalog.replaced', snapshot: this.snapshot() });
    });
  }

  /**
   * Discards all derived data (scan results, file-state cache, content index) and rebuilds it from the authoritative sources (§5.7 “rebuildable”). User marks and registrations are left alone.
   * The catalog is fully rebuilt before returning: rescans and rechecks compute the new state first and then swap it in as a whole, and queries in the meantime still see the old catalog. After the content index cache is deleted it is rebuilt in the background,
   * and during that time search results are marked as incomplete.
   */
  rebuild(): Promise<{ entries: number; pendingVideos: number }> {
    let pendingVideos = 0;
    return this.#enqueue(async () => {
      if (this.#index) await this.#index.rebuild();
      await this.#scanAll();
      pendingVideos = this.#index?.pendingCount() ?? 0;
      this.#topic.publish({ type: 'catalog.replaced', snapshot: this.snapshot() });
    }).then(() => ({ entries: this.#derived.size, pendingVideos }));
  }

  /** User marks: favorites, display names, trash. Only writes marks; does not touch files. */
  async update(params: { entryId: Id; favorite?: boolean; displayName?: string | null; trashed?: boolean }): Promise<SpaceEntry> {
    const derived = this.#derived.get(params.entryId);
    if (!derived) throw new RpcError('not-found', RcSpace.entryGone());
    // Moving videos into and out of the trash is moving directories (`videos.delete` / `videos.restore`); the method layer already routes them there, so this only guards against direct calls.
    if (params.trashed === true && derived.videoDir && !derived.entry.user.trashedAt) {
      throw new RpcError('invalid-request', RcSpace.trashVideoUseDelete(), { code: 'SPACE_TRASH_VIDEO' });
    }
    if (params.trashed === false && derived.location.kind === 'trash') {
      throw new RpcError('invalid-request', RcSpace.restoreVideoUseRestore(), { code: 'SPACE_TRASH_VIDEO' });
    }
    const mark = { ...this.#marks.get(params.entryId) };
    if (params.favorite !== undefined) mark.favorite = params.favorite;
    if (params.displayName !== undefined) mark.displayName = params.displayName?.trim() || null;
    if (params.trashed !== undefined) mark.trashedAt = params.trashed ? (mark.trashedAt ?? nowIso()) : null;
    await this.#marks.put(params.entryId, mark);
    // While waiting for the disk write, the entry may have been removed by a rescan.
    this.#recompute(true);
    return this.get(params.entryId);
  }

  /** For the media channel and for opening videos: the source directory and file corresponding to an entry in a source directory, and the source (project or session). */
  locate(entryId: Id): { root: string; file: string; scope: { projectId: Id } | { conversationId: Id } } {
    const derived = this.#derived.get(entryId);
    if (!derived) throw new RpcError('not-found', RcSpace.entryGone());
    const location = derived.location;
    if (location.kind === 'trash') throw new RpcError('conflict', RcSpace.videoDeletedRestoreFirst(), { code: 'VIDEO_TRASHED' });
    const source = location.kind === 'source' ? this.#sources.get(location.sourceKey) : undefined;
    if (location.kind !== 'source' || !source) throw new RpcError('not-found', RcSpace.notInSourceDir());
    const scope = source.projectId ? { projectId: source.projectId } : { conversationId: source.conversationId! };
    return { root: source.root, file: path.join(source.root, ...location.relPath.split('/')), scope };
  }

  /**
   * For the media channel: the location of an entry's bytes, given only as a restricted handle (§5.6). For entries in source directories it is restricted to that source directory; for artifacts and exports outside source directories,
   * it is restricted to the directory containing that one file (the handle allows only that file). Entries without bytes (placeholders, missing) are `not-found`.
   */
  locateBytes(entryId: Id): { root: string; file: string } {
    const derived = this.#derived.get(entryId);
    if (!derived) throw new RpcError('not-found', RcSpace.entryGone());
    const location = derived.location;
    if (location.kind === 'source' || location.kind === 'trash') return this.locate(entryId);
    if (location.kind === 'artifact' || location.kind === 'file') return { root: path.dirname(location.path), file: location.path };
    throw new RpcError('not-found', derived.entry.status === 'generating' ? RcSpace.stillGeneratingNoFile() : RcSpace.noReadableFile());
  }

  /**
   * Input for a tool's Space entry (architecture design §7.9): the readable file for the entry. If the entry does not exist, `not-found`; if it is in the trash, `conflict` (`SPACE_ENTRY_TRASHED`);
   * if its kind is not in `kinds` (including video entries), `invalid-request` (`SPACE_ENTRY_UNSUPPORTED`); if there is no readable file (placeholder, missing, source gone), `conflict` (`SPACE_ENTRY_NO_FILE`).
   * The kind is checked before the file: the kind does not change, while the file may be restored.
   */
  resolveFile(entryId: Id, kinds: readonly SpaceEntryKind[]): { entry: SpaceEntry; file: string } {
    const derived = this.#derived.get(entryId);
    if (!derived) throw new RpcError('not-found', RcSpace.entryGone(), { entryId });
    const { entry, location } = derived;
    if (location.kind === 'trash' || entry.user.trashedAt) {
      throw new RpcError('conflict', RcSpace.entryInTrash(), { code: 'SPACE_ENTRY_TRASHED', entryId });
    }
    if (derived.videoDir || !kinds.includes(entry.kind)) {
      throw new RpcError('invalid-request', RcSpace.entryKindNotAccepted({ kind: entry.kind }), {
        code: 'SPACE_ENTRY_UNSUPPORTED',
        entryId,
        kind: entry.kind,
        accepted: [...kinds],
      });
    }
    const noFile = () =>
      new RpcError('conflict', entry.status === 'generating' ? RcSpace.entryStillGeneratingNoFile() : RcSpace.noReadableFile(), {
        code: 'SPACE_ENTRY_NO_FILE',
        entryId,
      });
    if (entry.status === 'missing' || entry.status === 'generating' || entry.status === 'failed') throw noFile();
    let file: string;
    try {
      file = this.locateBytes(entryId).file;
    } catch (error) {
      if (error instanceof RpcError && error.code === 'not-found') throw noFile();
      throw error;
    }
    if (!fs.statSync(file, { throwIfNoEntry: false })?.isFile()) throw noFile();
    return { entry, file };
  }

  /**
   * Registers a file as project material (§5.7 “files in the project that are not video”), not placed in any video. A file inside the project directory is registered in place;
   * a file outside the project is copied into the project's `imports/` (with a sequence number added on name clash). `file` is an absolute path given by the caller.
   */
  async importFile(params: { projectId: Id; file: string; name?: string }): Promise<{ entry: SpaceEntry; copied: boolean }> {
    const key = `project:${params.projectId}`;
    const source = this.#sources.get(key);
    if (!source) throw new RpcError('not-found', RcSpace.projectNotFound());
    if (!path.isAbsolute(params.file)) throw new RpcError('invalid-request', RcSpace.needAbsolutePath());
    const real = await fsp.realpath(params.file).catch(() => null);
    const stat = real ? await fsp.stat(real).catch(() => null) : null;
    if (!real || !stat?.isFile()) throw new RpcError('not-found', RcSpace.fileNotFound());
    const kind = classifyFile(real);
    if (!kind)
      throw new RpcError('invalid-request', RcSpace.unrecognizedFileType(), {
        code: 'SPACE_IMPORT_UNSUPPORTED',
      });
    const rootReal = await fsp.realpath(source.root).catch(() => null);
    if (!rootReal) throw new RpcError('not-found', RcSpace.projectDirNotFound());
    let relPath: string;
    let copied = false;
    const inside = path.relative(rootReal, real);
    if (inside && !inside.startsWith('..') && !path.isAbsolute(inside)) {
      const parts = inside.split(path.sep);
      if (parts.some(isIgnoredName)) {
        throw new RpcError('invalid-request', RcSpace.hiddenDirFile(), { code: 'SPACE_IMPORT_UNSUPPORTED' });
      }
      for (let i = 1; i < parts.length; i++) {
        const dir = path.join(rootReal, ...parts.slice(0, i));
        if (await inspectVideoDir(dir)) {
          throw new RpcError('invalid-request', RcSpace.videoDirFile(), { code: 'SPACE_IMPORT_UNSUPPORTED' });
        }
        if (await inspectDeck(dir)) {
          throw new RpcError('invalid-request', RcSpace.slidesDirFile(), { code: 'SPACE_IMPORT_UNSUPPORTED' });
        }
        if (await readCanvasInfo(dir)) {
          throw new RpcError('invalid-request', RcSpace.designDirFile(), { code: 'SPACE_IMPORT_UNSUPPORTED' });
        }
        if (await readDesignSystemInfo(dir)) {
          throw new RpcError('invalid-request', RcSpace.designSystemDirFile(), { code: 'SPACE_IMPORT_UNSUPPORTED' });
        }
      }
      relPath = parts.join('/');
    } else {
      const dir = path.join(rootReal, 'imports');
      await fsp.mkdir(dir, { recursive: true });
      relPath = await copyUnique(real, dir);
      relPath = `imports/${relPath}`;
      copied = true;
    }
    const id = entryIdOf(key, relPath);
    await this.#marks.putImport(id, {
      projectId: params.projectId,
      relPath,
      importedAt: nowIso(),
      copiedFrom: copied ? path.basename(real) : null,
    });
    if (params.name) await this.#marks.put(id, { ...this.#marks.get(id), displayName: params.name.trim() });
    await this.#enqueue(() => this.#rescanSource(key));
    return { entry: this.get(id), copied };
  }

  /**
   * Physical deletion (§5.5, §5.7). Video entries in source directories are rejected (call `videos.delete` first); deleted videos are covered by `#purgeVideo`; placeholders for jobs in progress are rejected;
   * failed placeholders can simply be cleared. Otherwise only entries in the trash are deleted, after checking references first: video materials linking to this file, and in-progress jobs using this artifact. When a video cannot be read at the moment,
   * this cannot be confirmed, so it is treated as referenced (fail closed). When something is referenced, nothing is deleted and the references are returned.
   */
  async purge(entryId: Id): Promise<SpacePurgeResult> {
    const derived = this.#derived.get(entryId);
    if (!derived) throw new RpcError('not-found', RcSpace.entryGone());
    const { entry, location } = derived;
    if (location.kind === 'trash') return this.#purgeVideo(entryId, location);
    if (entry.kind === 'video' && derived.videoDir) {
      throw new RpcError('invalid-request', RcSpace.purgeVideoDeleteFirst(), {
        code: 'SPACE_PURGE_VIDEO',
      });
    }
    if (entry.status === 'generating') {
      throw new RpcError('conflict', RcSpace.purgeTaskRunning(), { code: 'SPACE_PURGE_RUNNING', jobId: entryId });
    }
    if (entry.status === 'failed' && entry.ref && 'jobId' in entry.ref) {
      await this.#marks.put(entryId, { ...this.#marks.get(entryId), dismissedAt: nowIso() });
      this.#recompute(true);
      return { status: 'purged', entryId };
    }
    if (!entry.user.trashedAt) {
      throw new RpcError('conflict', RcSpace.purgeNotTrashed(), { code: 'SPACE_NOT_TRASHED' });
    }
    const file = location.kind === 'source' ? this.locate(entryId).file : location.kind === 'none' ? null : location.path;
    const references = file ? await this.#references(entry, file) : [];
    if (references.length > 0) return { status: 'blocked', entryId, references };
    // Slide deck, design canvas and design system entries are the whole deck / design canvas / design system directory (for design systems, together with `_blobs/`).
    if (file) await fsp.rm(file, { force: true, recursive: entry.kind === 'slides' || entry.kind === 'design' || entry.kind === 'design-system' });
    await this.#marks.remove(entryId);
    // Exports and scanned files are merged into one entry: once the file is deleted, it must not reappear as a “missing” artifact.
    const artifactId = entry.ref && 'artifactId' in entry.ref ? entry.ref.artifactId : null;
    if (artifactId) {
      await this.#marks.put(artifactId, { ...EMPTY_MARK, dismissedAt: nowIso() });
      await this.#pruneRetained();
    }
    await this.#enqueue(async () => {
      if (location.kind === 'source') await this.#rescanSource(location.sourceKey);
      await this.#refreshStats(true);
      this.#recompute(true);
    });
    return { status: 'purged', entryId };
  }

  /** Goes from an entry back to the editable video (§5.7 “from the final cut back to the video”). Only answers where to go; does not open the video. */
  openForEdit(entryId: Id): SpaceOpenForEditResult {
    const derived = this.#derived.get(entryId);
    if (!derived) throw new RpcError('not-found', RcSpace.entryGone());
    if (derived.location.kind === 'trash') throw new RpcError('conflict', RcSpace.videoDeletedRestoreFirst(), { code: 'VIDEO_TRASHED' });
    const { entry } = derived;
    if (derived.videoDir) {
      return { mode: 'video', videoId: entry.ref && 'videoId' in entry.ref ? entry.ref.videoId : null, target: { entryId } };
    }
    const videoId = entry.origin?.videoId;
    if (videoId) {
      const video = this.videos().find((v) => v.videoId === videoId) ?? null;
      const current = video && this.#index ? (this.#index.at(video.dir)?.revision ?? null) : null;
      const frozen = entry.origin?.videoRevision ?? null;
      return {
        mode: 'source-video',
        videoId,
        target: video ? { entryId: video.entryId } : null,
        frozenRevision: frozen,
        currentRevision: current,
        changed: frozen !== null && current !== null && frozen !== current,
      };
    }
    return { mode: 'new-video', source: { entryId }, projectId: entry.source.projectId ?? entry.origin?.projectId ?? null };
  }

  // ---- Deleted videos (§5.5, §5.7) ----

  /** The video entry in a source directory and its location. Throws if it is not a video, has already been deleted, or is not in a source directory. */
  videoEntry(entryId: Id): VideoEntryInfo {
    const derived = this.#derived.get(entryId);
    if (!derived) throw new RpcError('not-found', RcSpace.entryGone());
    if (derived.location.kind === 'trash') throw new RpcError('conflict', RcSpace.videoDeleted(), { code: 'VIDEO_TRASHED' });
    if (!derived.videoDir || derived.location.kind !== 'source') {
      throw new RpcError('invalid-request', RcSpace.notVideo(), { code: 'SPACE_ENTRY_NOT_VIDEO' });
    }
    const location = this.locate(entryId);
    return {
      entry: derived.entry,
      dir: derived.videoDir,
      root: location.root,
      sourceKey: derived.location.sourceKey,
      relPath: derived.location.relPath,
      scope: location.scope,
    };
  }

  /** The video entry in a source directory whose real path is `dir`; null when none. A video that was just created may not have been scanned yet: rescan its source first, then look again. */
  async videoEntryAt(dir: string): Promise<VideoEntryInfo | null> {
    const real = await fsp.realpath(dir).catch(() => null);
    if (!real) return null;
    const find = async () => {
      for (const video of this.videos()) {
        if (video.dir === real || (await fsp.realpath(video.dir).catch(() => null)) === real) return this.videoEntry(video.entryId);
      }
      return null;
    };
    const found = await find();
    if (found || !(await isVideoDir(real))) return found;
    const within = [...this.#sources.values()].filter((s) => real.startsWith(s.realRoot + path.sep) || real.startsWith(s.root + path.sep));
    if (within.length === 0) return null;
    for (const source of within) await this.refreshSource(source.key);
    return find();
  }

  /** A deleted video, looked up by its entry id in the trash, or by its entry id from before the deletion (for undo). null when none. */
  trashedVideo(entryId: Id): TrashedVideoInfo | null {
    const trashed = this.#marks.trashedVideos();
    let id: Id | null = trashed.has(entryId) ? entryId : null;
    if (!id && !this.#derived.has(entryId)) {
      for (const [key, record] of trashed) if (record.formerEntryId === entryId) id = key;
    }
    if (!id) return null;
    const record = trashed.get(id)!;
    return { entryId: id, record, root: this.#sources.get(record.sourceKey)?.root ?? null };
  }

  /** The entry id in the trash, determined by the source key and the relative path inside the trash. */
  trashEntryId(sourceKey: string, trashRelPath: string): Id {
    return entryIdOf(sourceKey, trashRelPath);
  }

  /** Records the video to be deleted (before its directory is moved). */
  recordTrashedVideo(entryId: Id, record: TrashedVideo): Promise<void> {
    return this.#marks.putTrashedVideo(entryId, record);
  }

  /** The video is back in its source directory (restored, or deletion did not finish): removes the record, moves the mark to the entry at `relPath`, and rescans the source. Returns the new entry id. */
  async releaseTrashedVideo(entryId: Id, record: TrashedVideo, relPath: string): Promise<Id> {
    const to = entryIdOf(record.sourceKey, relPath);
    await this.#marks.dropTrashedVideo(entryId, to);
    await this.refreshSource(record.sourceKey);
    return to;
  }

  /** Rescans one source and recomputes (after a video directory has been moved). */
  refreshSource(sourceKey: string): Promise<void> {
    return this.#enqueue(async () => {
      await this.#rescanSource(sourceKey);
      this.#recompute(true);
    });
  }

  /**
   * Retention period for the trash (§5.7): entries that have been in the trash for more than `days` days are physically deleted one by one, through the same path as `space.purge`. Those with references are kept,
   * and videos in source directories (older versions only wrote a trash mark) are skipped. Returns how many were deleted and how many were kept.
   */
  async sweepTrash(days: number, now = Date.now()): Promise<{ purged: number; kept: number }> {
    const cutoff = now - days * 86_400_000;
    const result = { purged: 0, kept: 0 };
    const due = this.entries().filter((e) => e.user.trashedAt !== null && Date.parse(e.user.trashedAt) <= cutoff);
    for (const entry of due) {
      if (this.#closed) break;
      const derived = this.#derived.get(entry.id);
      if (!derived || (derived.videoDir && derived.location.kind === 'source') || entry.status === 'generating') {
        result.kept++;
        continue;
      }
      try {
        const purged = await this.purge(entry.id);
        if (purged.status === 'purged') result.purged++;
        else {
          result.kept++;
          this.#log.info('Expired trash item still has references; kept', { entryId: entry.id, references: purged.references.length });
        }
      } catch (error) {
        result.kept++;
        this.#log.warn('Expired trash item was not deleted', { entryId: entry.id, error: String(error) });
      }
    }
    if (result.purged > 0 || result.kept > 0) this.#log.info('Trash retention cleanup', { days, ...result });
    return result;
  }

  /**
   * Physically deletes a deleted video: checks references first (other videos linking to files in its directory, in-progress jobs using it, videos that cannot be read at the moment), then checks whether the directory contains
   * files not managed by the video. Only when neither applies does it delete the files the video manages (database, lock, `blobs/`), then removes the directory if it is empty. Original files of linked materials are not in the video directory and are not touched.
   */
  async #purgeVideo(entryId: Id, location: { sourceKey: string; relPath: string }): Promise<SpacePurgeResult> {
    const record = this.#marks.trashedVideos().get(entryId);
    const source = this.#sources.get(location.sourceKey);
    if (!record || !source) throw new RpcError('not-found', RcSpace.videoSourceGone());
    const dir = path.join(source.root, ...location.relPath.split('/'));
    const original = path.join(source.root, ...record.relPath.split('/'));
    const roots = new Set([
      dir,
      original,
      path.join(source.realRoot, ...location.relPath.split('/')),
      path.join(source.realRoot, ...record.relPath.split('/')),
    ]);
    const inside = (file: string) => [...roots].some((d) => file.startsWith(d + path.sep));
    const references = await this.#linkReferences(
      async (linked) => inside(linked) || inside(await fsp.realpath(linked).catch(() => linked)),
    );
    if (record.videoId && this.#jobs) {
      for (const job of this.#jobs.list()) {
        if (job.videoId !== record.videoId) continue;
        if (job.state === 'queued' || job.state === 'running') {
          references.push({ kind: 'job', jobId: job.jobId, videoId: record.videoId, detail: RcSpace.refRunningTaskUsesVideo({ jobId: job.jobId }).text });
        } else if (job.state === 'needs-reconciliation') {
          // The result still awaits the user's decision (`jobs.reconcile apply` would write into this video): deletion can be undone, physical deletion cannot.
          references.push({
            kind: 'job',
            jobId: job.jobId,
            videoId: record.videoId,
            detail: RcSpace.refTaskAwaitsDecision({ jobId: job.jobId }).text,
          });
        }
      }
    }
    const names = await fsp.readdir(dir).catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return null;
      throw error;
    });
    const strays = (names ?? []).filter((name) => !VIDEO_OWNED.test(name));
    if (strays.length > 0) {
      references.push({
        kind: 'user-file',
        detail: RcSpace.refStrayFiles({ names: strays.slice(0, 3).join('/'), total: strays.length }).text,
      });
    }
    if (references.length > 0) return { status: 'blocked', entryId, references };
    for (const name of names ?? []) await fsp.rm(path.join(dir, name), { recursive: true, force: true });
    await fsp.rmdir(dir).catch(() => {});
    await fsp.rmdir(path.dirname(dir)).catch(() => {});
    await fsp.rmdir(path.join(source.root, TRASH_DIR)).catch(() => {});
    await this.#marks.remove(entryId);
    this.#log.info('Video permanently deleted', { entryId, videoId: record.videoId });
    await this.#enqueue(async () => this.#recompute(true));
    return { status: 'purged', entryId };
  }

  /**
   * Reconciles deleted videos at startup (§5.7). If a record was written but the directory was not moved over (crash during deletion), or it was already moved back but the record was not removed (crash during restore), the record is removed.
   * If neither place has it (removed externally), it is removed together with its mark. If the source is not registered yet, leave it until next time.
   */
  async #reconcileTrash(): Promise<void> {
    for (const [entryId, record] of [...this.#marks.trashedVideos()]) {
      const source = this.#sources.get(record.sourceKey);
      if (!source) continue;
      const inTrash = await isVideoDir(path.join(source.root, ...record.trashRelPath.split('/')));
      if (inTrash) continue;
      const atOriginal = await isVideoDir(path.join(source.root, ...record.relPath.split('/')));
      if (atOriginal) await this.#marks.dropTrashedVideo(entryId, entryIdOf(record.sourceKey, record.relPath));
      else await this.#marks.remove(entryId);
      this.#log.info('Deleted video record did not match its folder; followed the folder', { entryId, atOriginal });
    }
  }

  // ---- Artifact records (§14 “Retention of Space and the Job Ledger”) ----

  /**
   * A file handed over by the agent with `downloads_save` is registered as a deliverable (architecture design §3.5, §5.7). It takes the same path as files downloaded from a link: a file record of kind `downloads-save` is written into the artifact record
   * (not via the Job Ledger) and derived into an entry (`id` is the content digest; entries outside the source directory stand alone). Links in the reply open the entry. It is recomputed once after writing, so the directory already contains it when this returns. Nothing is registered when there is no artifact record.
   */
  async recordHandover(handover: { path: string; bytes: number; artifactId: string; submitter: JobSubmitter; at: string }): Promise<void> {
    if (!this.#artifacts) return;
    const facts: SpaceJobFacts = {
      jobId: newId('job'),
      kind: 'pipeline',
      state: 'completed',
      videoId: null,
      providerId: 'local',
      modelId: 'downloads-save',
      inputHash: handover.artifactId,
      submitter: handover.submitter,
      createdAt: handover.at,
      updatedAt: handover.at,
      endedAt: handover.at,
      error: null,
      progress: null,
      result: {
        artifactId: handover.artifactId,
        outputs: [
          {
            artifactId: handover.artifactId,
            mediaType: mimeTypeOf(handover.path).split(';')[0]!,
            byteLength: handover.bytes,
            assetId: null,
            media: { kind: 'file' },
            path: handover.path,
          },
        ],
      },
      pipeline: { name: 'downloads-save' },
    };
    await this.#artifacts.put([facts]);
    // Publish paths outside source directories are derived from cached file state: first forget this path (a file of the same name may have been recorded as absent earlier), then recompute.
    this.#pathStats.delete(handover.path);
    await this.#enqueue(async () => {
      await this.#refreshStats(false);
      this.#recompute(true);
    });
  }

  /** Job input: the jobs in the Ledger, plus those the Ledger has already pruned but that are still in the artifact records. */
  #jobFacts(): SpaceJobFacts[] {
    const live = this.#jobs?.list() ?? [];
    if (!this.#artifacts) return live;
    const seen = new Set(live.map((job) => job.jobId));
    return [...live, ...this.#artifacts.list().filter((facts) => !seen.has(facts.jobId))];
  }

  /** Finished jobs that have artifacts are recorded in the artifact records (jobs that have been fully cleared are no longer recorded). */
  #retain(jobs: readonly JobRecord[]): void {
    if (!this.#artifacts) return;
    const records = jobs.flatMap((job) => {
      const facts = spaceJobFacts(job);
      if (!facts) return [];
      const ids = artifactIdsOf(facts);
      return ids.length > 0 && ids.every((id) => this.#marks.get(id).dismissedAt) ? [] : [facts];
    });
    if (records.length > 0) void this.#artifacts.put(records).catch((error) => this.#log.warn('Writing output records failed', { error: String(error) }));
    // References kept only for the artifact library sweep (§7.3): any job that left artifacts (dubbing, translation, speaker, transcription written into the video, their steps...),
    // regardless of whether the derived facts above are kept. Not in the catalog; after the Job Ledger prunes it, the artifacts are still referenced.
    const refs = jobs.flatMap((job) => artifactRefsOf(job) ?? []);
    if (refs.length > 0)
      void this.#artifacts.putReferences(refs).catch((error) => this.#log.warn('Writing output references failed', { error: String(error) }));
  }

  /** Removes records whose artifacts have all been physically deleted or cleared; when the job is also no longer in the Ledger, the clear mark is not needed either. */
  async #pruneRetained(): Promise<void> {
    if (!this.#artifacts) return;
    const live = new Set((this.#jobs?.list() ?? []).map((job) => job.jobId));
    const done: Id[] = [];
    for (const facts of this.#artifacts.list()) {
      const ids = artifactIdsOf(facts);
      if (ids.length === 0 || !ids.every((id) => this.#marks.get(id).dismissedAt)) continue;
      done.push(facts.jobId);
      if (!live.has(facts.jobId)) for (const id of ids) await this.#marks.remove(id);
    }
    await this.#artifacts.remove(done);
  }

  // ---- References ----

  async #references(entry: SpaceEntry, file: string): Promise<SpaceReference[]> {
    const real = await fsp.realpath(file).catch(() => file);
    const references = await this.#linkReferences(async (linked) => {
      if (path.basename(linked) !== path.basename(file) && path.basename(linked) !== path.basename(real)) return false;
      return linked === file || (await fsp.realpath(linked).catch(() => linked)) === real;
    });
    const artifactId = entry.ref && 'artifactId' in entry.ref ? entry.ref.artifactId : null;
    if (artifactId && this.#jobs) {
      for (const job of this.#jobs.list()) {
        if (job.state !== 'queued' && job.state !== 'running') continue;
        if (!JSON.stringify(job).includes(artifactId)) continue;
        references.push({ kind: 'job', jobId: job.jobId, detail: RcSpace.refRunningTaskUsesOutput({ jobId: job.jobId }).text });
      }
    }
    return references;
  }

  /** Among the linked materials of videos in source directories, those that `matches`; when a video cannot be read at the moment or the index has not caught up, records `unverified`. */
  async #linkReferences(matches: (linkedPath: string) => Promise<boolean>): Promise<SpaceReference[]> {
    const references: SpaceReference[] = [];
    const index = this.#index;
    for (const video of this.videos()) {
      const indexed = index?.at(video.dir) ?? null;
      if (!indexed || (index && index.pendingCount([video.dir]) > 0)) {
        references.push({
          kind: 'unverified',
          ...(video.videoId ? { videoId: video.videoId } : {}),
          detail: RcSpace.refVideoUnreadable({ dir: path.basename(video.dir) }).text,
        });
        continue;
      }
      for (const linked of indexed.facts.linkedFiles) {
        if (!(await matches(linked.path))) continue;
        references.push({
          kind: 'video-asset',
          videoId: indexed.videoId,
          videoName: indexed.name,
          assetId: linked.assetId,
          detail: RcSpace.refVideoAssetLinks({ video: indexed.name, asset: linked.name }).text,
        });
      }
    }
    return references;
  }

  // ---- Sources ----

  #onDirectory(event: DirectoryEvent): void {
    if (this.#closed) return;
    if (event.type === 'project.upsert') {
      this.#addProject(event.project, true);
    } else if (event.type === 'conversation.upsert') {
      // After a turn ends and activity changes, rescan its working directory once, so nothing is missed when watching has failed (the directory was just created, or the platform does not support it).
      if (!this.#addConversation(event.conversation, true)) this.#schedule(sourceKeyOf(event.conversation));
      // Moving a session into a project changes the attribution of its artifacts.
      this.#scheduleRecompute();
    } else if (event.type === 'conversation.removed') {
      this.#removeSource(`conv:${event.conversationId}`);
    }
  }

  #addProject(project: Project, scan: boolean): boolean {
    const key = `project:${project.id}`;
    // The project directory was moved or renamed (architecture design §5.1): the source switches to the new path. Entry ids are determined only by the source key and the relative path, so user marks carry over.
    const existing = this.#sources.get(key);
    if (existing && existing.root !== project.path) this.#removeSource(key);
    return this.#addSource({ key, root: project.path, realRoot: project.path, projectId: project.id, conversationId: null }, scan);
  }

  #addConversation(conversation: Conversation, scan: boolean): boolean {
    this.#conversationProjects.set(conversation.id, conversation.projectId ?? null);
    if (conversation.projectId) {
      // A session without a project was bound to a project (§3.10): its working directory is no longer a source, its contents have been moved into the project, and the project source lists them. Entry ids change with the source key,
      // so user marks under the old source (favorites, display names) do not carry over.
      this.#removeSource(`conv:${conversation.id}`);
      return false;
    }
    // A session sharing another session's working directory: that session's source already lists this directory.
    if (conversation.folderOf) return false;
    return this.#addSource(
      {
        key: `conv:${conversation.id}`,
        root: conversation.cwd,
        realRoot: conversation.cwd,
        projectId: null,
        conversationId: conversation.id,
      },
      scan,
    );
  }

  /** `formerRoots` of a project source: the original working directories of the sessions moved into this project (sessions created directly in the project count too; that directory never existed, so it recognizes nothing). */
  #syncFormerRoots(): void {
    if (!this.#scratchDirs.length) return;
    const former = new Map<Id, string[]>();
    for (const [conversationId, projectId] of this.#conversationProjects) {
      if (!projectId) continue;
      const roots = former.get(projectId) ?? [];
      for (const dir of this.#scratchDirs) roots.push(path.join(dir, conversationId));
      former.set(projectId, roots);
    }
    for (const source of this.#sources.values()) if (source.projectId) source.formerRoots = former.get(source.projectId) ?? [];
  }

  #addSource(source: DeriveSource, scan: boolean): boolean {
    if (this.#sources.has(source.key)) return false;
    this.#sources.set(source.key, source);
    this.#startWatch(source);
    if (scan) this.#schedule(source.key, 0);
    return true;
  }

  #removeSource(key: string): void {
    if (!this.#sources.delete(key)) return;
    this.#watchers.get(key)?.close();
    this.#watchers.delete(key);
    clearTimeout(this.#timers.get(key));
    this.#timers.delete(key);
    this.#issues.delete(key);
    for (const [id, item] of this.#files) if (item.sourceKey === key) this.#files.delete(id);
    this.#recompute(true);
    void this.#enqueue(() => this.#syncIndex());
  }

  #startWatch(source: DeriveSource): void {
    if (!this.#watch) return;
    try {
      const watcher = fs.watch(source.root, { recursive: true, persistent: false }, (_event, filename) => {
        if (filename && String(filename).split(/[\\/]/).some(isIgnoredName)) return;
        this.#schedule(source.key);
      });
      watcher.on('error', () => {
        watcher.close();
        if (this.#watchers.get(source.key) === watcher) this.#watchers.delete(source.key);
      });
      this.#watchers.set(source.key, watcher);
    } catch {
      // The directory does not exist yet or is unreadable: covered by the rescan triggered by session activity.
    }
  }

  #schedule(key: string, delay = this.#debounceMs): void {
    if (this.#closed || !this.#sources.has(key)) return;
    clearTimeout(this.#timers.get(key));
    this.#timers.set(
      key,
      setTimeout(() => {
        this.#timers.delete(key);
        void this.#enqueue(() => this.#rescanSource(key));
      }, delay),
    );
  }

  /** Job events (progress fires several times a second) are merged into a single recomputation. */
  #scheduleRecompute(): void {
    if (this.#closed || this.#recomputeTimer) return;
    this.#recomputeTimer = setTimeout(() => {
      this.#recomputeTimer = null;
      void this.#enqueue(async () => {
        await this.#refreshStats(false);
        this.#recompute(true);
      });
    }, 50);
  }

  // ---- Scanning and derivation ----

  #enqueue(job: () => Promise<void>): Promise<void> {
    const run = this.#queue.then(() => (this.#closed ? undefined : job()));
    this.#queue = run.catch((error) => this.#log.error('Space scan failed', { error: String(error) }));
    return run;
  }

  async #scanAll(): Promise<void> {
    const results = await Promise.all(
      [...this.#sources.values()].map(async (source) => {
        const result = await scanDirectory(source.root, this.#limits);
        await this.#resolveRoot(source);
        return [source, result] as const;
      }),
    );
    // Clearing and refilling happen in the same synchronous block: recomputations arriving in between (user marks, job events) never see a half-empty catalog.
    this.#files.clear();
    this.#issues.clear();
    for (const [source, result] of results) {
      if (this.#sources.get(source.key) !== source) continue;
      this.#apply(source, result);
      for (const file of result.files) this.#files.set(entryIdOf(source.key, file.relPath), { sourceKey: source.key, file });
    }
    await this.#refreshStats(true);
    this.#recompute(false);
    await this.#syncIndex();
    this.#log.info('Space scan finished', { sources: results.length, entries: this.#derived.size });
  }

  async #rescanSource(key: string): Promise<void> {
    const source = this.#sources.get(key);
    if (!source) return;
    const result = await scanDirectory(source.root, this.#limits);
    await this.#resolveRoot(source);
    if (this.#sources.get(key) !== source) return;
    this.#apply(source, result);
    for (const [id, item] of this.#files) if (item.sourceKey === key) this.#files.delete(id);
    for (const file of result.files) this.#files.set(entryIdOf(key, file.relPath), { sourceKey: key, file });
    await this.#refreshStats(false);
    this.#recompute(true);
    await this.#syncIndex();
  }

  async #resolveRoot(source: DeriveSource): Promise<void> {
    source.realRoot = await fsp.realpath(source.root).catch(() => source.root);
  }

  /** Records scan problems for a source. The problem list is only delivered with `catalog.replaced` and in snapshots. */
  #apply(source: DeriveSource, result: ScanResult): void {
    if (result.issue) this.#issues.set(source.key, { sourceKey: source.key, ...result.issue });
    else this.#issues.delete(source.key);
  }

  /** Hands the video directories in source directories to the content index. */
  async #syncIndex(): Promise<void> {
    if (!this.#index || this.#closed) return;
    const locations: { dir: string; mtimeMs: number }[] = [];
    for (const item of this.#files.values()) {
      if (item.file.kind !== 'video') continue;
      const source = this.#sources.get(item.sourceKey);
      if (source) locations.push({ dir: path.join(source.root, ...item.file.relPath.split('/')), mtimeMs: item.file.mtimeMs });
    }
    await this.#index.sync(locations);
  }

  /** Checks whether artifact files and publish paths outside source directories exist: newly appearing ones are checked once; with `all`, everything is rechecked (rescans, rebuilds). */
  async #refreshStats(all: boolean): Promise<void> {
    if (!this.#jobs) return;
    // When rechecking everything, first check into a new table and swap it in afterwards: recomputations arriving during the check still use the old one.
    const artifactStats = all ? new Map<string, FileStat | null>() : this.#artifactStats;
    const pathStats = all ? new Map<string, FileStat | null>() : this.#pathStats;
    const artifacts = new Set<string>();
    const paths = new Set<string>();
    for (const job of this.#jobFacts()) {
      if (!job.result) continue;
      if (job.kind === 'generateText') artifacts.add(job.result.artifactId);
      for (const output of job.result.outputs ?? []) {
        // Published files, and copies that direct jobs saved to the save location (§7.9).
        if (output.path) paths.add(output.path);
        if (job.kind === 'generateImage' || job.kind === 'synthesizeSpeech' || job.kind === 'generateMusic') artifacts.add(output.artifactId);
      }
    }
    for (const artifactId of artifacts) {
      if (artifactStats.has(artifactId)) continue;
      const file = await this.#jobs.artifacts.locate(artifactId).catch(() => null);
      artifactStats.set(artifactId, file ? await statOf(file) : null);
    }
    for (const file of paths) {
      if (pathStats.has(file)) continue;
      pathStats.set(file, await statOf(file));
    }
    if (all) {
      this.#artifactStats = artifactStats;
      this.#pathStats = pathStats;
    }
  }

  /** Recomputes entries from all inputs; with `publish`, emits each changed entry one by one (the first scan and rebuilds emit only one `catalog.replaced`). */
  #recompute(publish: boolean): void {
    if (this.#closed) return;
    this.#syncFormerRoots();
    const next = deriveEntries({
      sources: this.#sources,
      files: this.#files,
      mark: (id) => this.#marks.get(id),
      imports: this.#marks.imports(),
      trashedVideos: this.#marks.trashedVideos(),
      jobs: this.#jobFacts(),
      videoAt: (dir) => {
        const indexed = this.#index?.at(dir);
        return indexed ? { videoId: indexed.videoId, name: indexed.name, revision: indexed.revision, facts: indexed.facts } : null;
      },
      projectOfConversation: (conversationId) => this.#conversationProjects.get(conversationId) ?? null,
      artifactFile: (artifactId) => this.#artifactStats.get(artifactId),
      pathStat: (file) => this.#pathStats.get(file),
      entryIdOf,
      classify: classifyFile,
    });
    const previous = this.#derived;
    this.#derived = next;
    if (!publish) return;
    for (const [id, derived] of next) {
      const before = previous.get(id);
      if (before && JSON.stringify(before.entry) === JSON.stringify(derived.entry)) continue;
      this.#topic.publish({ type: 'entry.upsert', entry: derived.entry });
    }
    for (const id of previous.keys()) {
      if (!next.has(id)) this.#topic.publish({ type: 'entry.removed', entryId: id });
    }
  }
}

async function isVideoDir(dir: string): Promise<boolean> {
  return (await inspectVideoDir(dir)) !== null;
}

async function statOf(file: string): Promise<FileStat | null> {
  const stat = await fsp.stat(file).catch(() => null);
  return stat?.isFile() ? { path: file, size: stat.size, mtimeMs: stat.mtimeMs, birthtimeMs: stat.birthtimeMs } : null;
}

/** Copies into the directory, adding a sequence number on name clash; returns the file name in the directory. */
async function copyUnique(file: string, dir: string): Promise<string> {
  const ext = path.extname(file);
  const base = path.basename(file, ext);
  for (let n = 1; n < 1000; n++) {
    const name = n === 1 ? `${base}${ext}` : `${base} (${n})${ext}`;
    try {
      await fsp.copyFile(file, path.join(dir, name), fs.constants.COPYFILE_EXCL);
      return name;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    }
  }
  throw new RpcError('conflict', RcSpace.tooManySameName());
}

function sourceKeyOf(conversation: Conversation): string {
  return conversation.projectId ? `project:${conversation.projectId}` : `conv:${conversation.folderOf ?? conversation.id}`;
}

/** Entry ids are determined by the source and the relative path: they do not change on rescan or restart, so user marks can keep up. */
export function entryIdOf(sourceKey: string, relPath: string): Id {
  return `sp_${crypto.createHash('sha256').update(`${sourceKey}\0${relPath}`).digest('base64url').slice(0, 22)}`;
}
