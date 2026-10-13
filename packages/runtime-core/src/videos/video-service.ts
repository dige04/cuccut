import fs from 'node:fs/promises';
import path from 'node:path';
import {
  RpcError,
  applyVideoEvent,
  type Actor,
  type AssetRevision,
  type DocumentContent,
  type EditResult,
  type FontFaceLayout,
  type FontFaceQuery,
  type FontsResolveResult,
  type HistoryEntry,
  type Id,
  type MissingAsset,
  type ProtectionRef,
  type VideoEvent,
  type VideoOpenResult,
  type VideoRef,
  type VideoSnapshot,
  type VideoTopicEvent,
  type VideoTopicSnapshot,
  type RpcParams,
  type Seq,
  type SequencedEvent,
  type TransactionReceipt,
  type UndoState,
  type UnusedAsset,
} from '@cuccut/protocol';
import { TopicLog, type Logger, type TopicSubscription } from '@cuccut/harness';
import { isDotLottie } from '@cuccut/runtime-storage/library';
import type { TrustedPrincipal } from '../gateway.ts';
import { TRASH_DIR, scanDirectory } from '../space-catalog.ts';
import { EngineHost } from './engine-host.ts';
import { hostPath } from './host-path.ts';
import { RcCommon, RcVideo } from '@cuccut/protocol/messages/runtime-core';

/**
 * A session for an opened video (architecture design §2.3, §4.4). On the Runtime side it does only routing, mirroring and lifecycle; the semantics of the video all live in the engine.
 *
 * - A video is opened only once in the Runtime. Each connection that opened it is counted once; after the last one leaves, it is closed and the write lock is released.
 *   After a connection drops, a grace period is kept so that the UI can reconnect and reopen to pick up the session.
 * - The mirror is updated only by events pushed from the engine (the shared `applyVideoEvent`), deduplicated by the video's own event sequence number. When the sequence does not line up, the snapshot replaces everything.
 * - Each video has one topic for its whole lifetime in the Runtime. Closing and reopening keeps it, so a client's cursor never lands on another log.
 * - If the engine process exits unexpectedly, it is restarted, the video is reopened, and `video.replaced` is published on the topic.
 */

/** Task protection handed to the engine (the engine checks it before submission, `TASK_PROTECTED`). */
/** The result of the engine's `fonts.resolve`: a face found carries the absolute path of its file (the Runtime turns it into a read handle for the UI; recorded when export is frozen). */
export interface LocalFontFaces {
  faces: (FontFaceQuery & FontFaceLayout & { source: 'local' | 'downloaded'; path: string })[];
  missing: FontsResolveResult['missing'];
}

/** The result of the engine's `fonts.inspect`: the faces in a font file. */
export interface InspectedFontFace {
  index: number;
  families: string[];
  postScriptName: string;
  weight: number;
  italic: boolean;
}

export type EngineProtection = Pick<ProtectionRef, 'protectionId' | 'target'>;

/** The execution that task and pipeline writes belong to (architecture design §7.4): `runGeneration` is a decimal integer string, incremented when a retry starts a new generation. */
export interface EngineRun {
  runId: Id;
  runGeneration: string;
}

export interface VideoLocation {
  /** The source directory (project directory or session working directory). The video directory must be inside it. */
  root: string;
  /** The video directory, or the `video.db` inside it; an absolute path, or relative to `root`. */
  file: string;
  scope: { projectId: Id } | { conversationId: Id };
}

export interface VideoServiceOptions {
  log: Logger;
  /** Finds the engine executable; returns null if there is none (the UI tells the user to build the engine first). */
  resolveCommand: () => string | null;
  /** Environment variables for the engine process (ffprobe must be findable on PATH). */
  env: () => Promise<NodeJS.ProcessEnv>;
  /** How long after a connection drops before the videos it opened are closed. */
  graceMs?: number;
  /** The directory of downloaded fonts (`<home>/fonts/files`): families not present on this machine are picked from here by the engine (architecture design §9.1). */
  fontCacheDir?: string;
}

interface Session {
  ref: VideoRef;
  openers: Set<string>;
  /** Runtime-internal leases (e.g. a transcription task in progress): while a lease exists, the video is not closed just because its openers have left. */
  leases: number;
  closeTimer: ReturnType<typeof setTimeout> | null;
}

interface Channel {
  log: TopicLog<VideoTopicSnapshot, VideoTopicEvent>;
  mirror: VideoTopicSnapshot;
  session: Session | null;
  /** A snapshot catch-up is in progress: events that arrive meanwhile wait until the snapshot is in. */
  resyncing: boolean;
}

/** The result of `assets.blobPath`: where one version of an asset is right now. */
interface ResolvedAsset {
  path: string;
  storage: 'managed' | 'linked';
  mediaType: string;
  byteLength: number;
  name: string;
}

interface HostOpened {
  videoId: Id;
  path: string;
  eventSeq: Seq;
  snapshot: VideoSnapshot;
}

const DEFAULT_GRACE_MS = 15_000;
const MAX_RESTARTS = 3;
const RESTART_WINDOW_MS = 60_000;
const DB_FILE = 'video.db';
/** The database file name before the rename: the engine upgrades it in place to `video.db` when it opens. */
const LEGACY_DB_FILE = 'movie.db';

/**
 * Public requests carry no operator; the operator is built from the connection identity (architecture design §4.2). Requests from external services are recorded as `external:<serviceId>` (§4.8).
 * The engine's operator kinds are only user, agent and system, so external agents fall under `agent` and are told apart by ID.
 * The Web service's browser session is the user acting in person, recorded as `user_local` as the desktop UI records it (the undo stack is also shared with the desktop).
 */
export function actorOf(principal: TrustedPrincipal): Actor {
  if (principal.kind === 'service') return { kind: 'agent', id: `external:${principal.name}` };
  if (principal.kind === 'web') return { kind: 'user', id: 'user_local' };
  return principal.kind === 'agent' ? { kind: 'agent', id: `agent:${principal.name}` } : { kind: 'user', id: 'user_local' };
}

/** Video directory name: characters that cannot be used in paths are removed. */
export function videoDirName(name: string): string {
  const cleaned = name
    .replace(/[\\/:*?"<>|\p{Cc}]/gu, '-')
    .replace(/^[.\s]+|[.\s]+$/g, '')
    .slice(0, 80)
    .trim();
  return cleaned || RcVideo.defaultDirName().text;
}

/**
 * Reserves a directory for a new video in the source directory (picks a name that does not exist yet, as `VideoService.create` does, and creates it as an empty directory), and returns its name relative to the source directory. Once reserved, `create` skips it when picking a directory.
 */
export async function reserveVideoDir(root: string, name: string): Promise<string> {
  const rootReal = await fs.realpath(root).catch(() => {
    throw new RpcError('not-found', RcVideo.sourceDirNotFound());
  });
  const base = videoDirName(name.trim() || RcVideo.untitledVideo().text);
  for (let n = 1; ; n++) {
    const file = n === 1 ? base : `${base} ${n}`;
    // Not created recursively: if it already exists (reserved or created elsewhere at the same time), take the next name.
    const made = await fs.mkdir(path.join(rootReal, file)).then(
      () => true,
      (error: NodeJS.ErrnoException) => {
        if (error.code === 'EEXIST') return false;
        throw error;
      },
    );
    if (made) return file;
  }
}

/** A directory containing a video database (including one from before the rename). */
export async function hasVideoDb(dir: string): Promise<boolean> {
  return (await exists(path.join(dir, DB_FILE))) || (await exists(path.join(dir, LEGACY_DB_FILE)));
}

export class VideoService {
  readonly #log: Logger;
  readonly #options: VideoServiceOptions;
  readonly #graceMs: number;
  readonly #channels = new Map<Id, Channel>();
  readonly #creates = new Map<Id, Promise<VideoOpenResult>>();
  readonly #claims = new Map<Id, Promise<{ reassigned: number; skipped: number }>>();
  readonly #changeListeners = new Set<(change: { videoId: Id; path: string; revision: string }) => void>();
  #host: EngineHost | null = null;
  #starting: Promise<EngineHost> | null = null;
  #afterCreate: ((videoId: Id, principal: TrustedPrincipal) => Promise<void>) | null = null;
  #restarts: number[] = [];
  #closed = false;

  constructor(options: VideoServiceOptions) {
    this.#options = options;
    this.#log = options.log.child('videos');
    this.#graceMs = options.graceMs ?? DEFAULT_GRACE_MS;
  }

  // ---- Open and close ----

  /**
   * Creates a new video: in the source directory, picks a directory name that does not exist yet. `reserved` is the empty directory that `reserveVideoDir` reserved beforehand (creation in a fixed flow, `pipeline-targets.ts`): it is created there, and no name is picked.
   */
  async create(
    params: RpcParams<'videos.create'>,
    root: VideoLocation['root'],
    scope: VideoLocation['scope'],
    principal: TrustedPrincipal,
    reserved?: string,
  ) {
    if (params.commandId) {
      const existing = this.#creates.get(params.commandId);
      if (existing) return existing;
    }
    const run = (async (): Promise<VideoOpenResult> => {
      const name = params.name?.trim() || RcVideo.untitledVideo().text;
      const rootReal = await fs.realpath(root).catch(() => {
        throw new RpcError('not-found', RcVideo.sourceDirNotFound());
      });
      let dir: string;
      if (reserved !== undefined) {
        dir = path.join(rootReal, reserved);
        if (path.relative(rootReal, dir).startsWith('..')) throw new RpcError('invalid-request', RcVideo.reservedDirOutsideSource());
      } else {
        const base = videoDirName(name);
        dir = path.join(rootReal, base);
        for (let n = 2; await exists(dir); n++) dir = path.join(rootReal, `${base} ${n}`);
      }
      const host = await this.#ensureHost();
      const opened = await host.request<HostOpened>('videos.create', {
        path: dir,
        name,
        fps: params.fps ?? { num: 30, den: 1 },
        width: params.width ?? 1920,
        height: params.height ?? 1080,
        ...projectOf(scope),
      });
      this.#log.info('Video created', { videoId: opened.videoId });
      const result = this.#register(opened, rootReal, scope, principal);
      if (!this.#afterCreate) return result;
      // The new video's initial content (adopting the entries enabled by default in the user library, §5.9). A failure does not affect creation; it is only logged.
      await this.#afterCreate(opened.videoId, principal).catch((error: unknown) =>
        this.#log.warn('Setup after creating the video did not finish', { videoId: opened.videoId, error: String(error) }),
      );
      return { ...result, snapshot: this.mirror(opened.videoId) ?? result.snapshot };
    })();
    if (params.commandId) {
      const key = params.commandId;
      this.#creates.set(key, run);
      run.catch(() => this.#creates.delete(key));
    }
    return run;
  }

  /**
   * Work done after a new video is created (`create`, not including opening a portable package) and before returning: writes the initial content into the new video, connected by the Runtime (the user library's default-enabled entries).
   * The returned snapshot is taken after this work is done.
   */
  onCreated(fn: (videoId: Id, principal: TrustedPrincipal) => Promise<void>): void {
    this.#afterCreate = fn;
  }

  async open(location: VideoLocation, principal: TrustedPrincipal): Promise<VideoOpenResult> {
    const { rootReal, dir } = await locateVideoDir(location);
    const host = await this.#ensureHost();
    // Passes the owning project. When the video records a different project (a copy), the engine first swaps the identity, so one videoId does not point to two directories (architecture design §5.1).
    const opened = await host.request<HostOpened>('videos.open', { path: dir, ...projectOf(location.scope) });
    if (hostPath(opened.path) !== dir) {
      // The same videoId appears in two directories (copies that cannot be told apart and do not belong to a project, or a video moved while open): the one opened first is kept.
      this.#log.warn('Two folders hold the same video; kept the open one', { videoId: opened.videoId });
    }
    return this.#register(opened, rootReal, location.scope, principal);
  }

  /**
   * Pre-processing when a project is opened (architecture design §5.1): when a video in the project records an owning project different from this one (a copy), or records none (a video from before the upgrade), the engine first swaps or adopts its identity, and only then is it opened. Only videos in this registered project directory are handled; a video being opened is skipped (it was already claimed when opened); one locked elsewhere is left for next time (opening will claim it again). Each video takes the write lock only briefly, once. The engine is not started when there are no videos.
   */
  claimProjectVideos(project: { id: Id; path: string }): Promise<{ reassigned: number; skipped: number }> {
    // Only one pass of pre-processing for the same project runs at a time: when the project is opened again, it attaches to the pass in progress.
    const running = this.#claims.get(project.id);
    if (running) return running;
    const run = this.#claimProjectVideos(project).finally(() => this.#claims.delete(project.id));
    this.#claims.set(project.id, run);
    return run;
  }

  async #claimProjectVideos(project: { id: Id; path: string }): Promise<{ reassigned: number; skipped: number }> {
    const result = { reassigned: 0, skipped: 0 };
    if (this.#closed || !this.#options.resolveCommand()) return result;
    const rootReal = await fs.realpath(project.path).catch(() => null);
    if (!rootReal) return result;
    const scan = await scanDirectory(rootReal);
    const dirs = scan.files.filter((file) => file.kind === 'video').map((file) => path.join(rootReal, ...file.relPath.split('/')));
    if (dirs.length === 0) return result;
    const open = new Set(this.openRefs().map((ref) => ref.path));
    const host = await this.#ensureHost();
    for (const dir of dirs) {
      if (open.has(dir)) continue;
      try {
        const claim = await host.request<{ outcome: string; videoId: Id }>('videos.claimProject', { path: dir, projectId: project.id });
        if (claim.outcome === 'reassigned') result.reassigned++;
      } catch (error) {
        result.skipped++;
        this.#log.info('Skipped this video while opening the project; deferred until it is opened', { projectId: project.id, error: String(error) });
      }
    }
    if (result.reassigned > 0) this.#log.info('Videos in the project were copies; gave them new IDs', { projectId: project.id, count: result.reassigned });
    return result;
  }

  /** This connection no longer needs this video. Closes immediately if there are no other openers. */
  async close(videoId: Id, principal: TrustedPrincipal): Promise<{ closed: boolean }> {
    const channel = this.#channels.get(videoId);
    const session = channel?.session;
    if (!session) return { closed: false };
    session.openers.delete(principal.connectionId);
    if (session.openers.size > 0 || session.leases > 0) return { closed: false };
    await this.#closeSession(videoId, 'closed');
    return { closed: true };
  }

  /** How the video is being used in the Runtime right now (checked before a video is deleted): the connections that opened it and internal leases. null if it is not open. */
  usage(videoId: Id): { openers: string[]; leases: number } | null {
    const session = this.#channels.get(videoId)?.session;
    return session ? { openers: [...session.openers], leases: session.leases } : null;
  }

  /** The video was deleted: closes it; subscribed clients receive `video.closed` (`reason: 'deleted'`). */
  async closeDeleted(videoId: Id): Promise<void> {
    await this.#closeSession(videoId, 'deleted');
  }

  /**
   * Takes the write lock on a video directory that is not open, runs `fn` while holding it (used to move the directory when a video is deleted), then releases it (§5.5). The lock follows the open file, so renaming the directory does not affect it. When another process holds the lock it is rejected with `VIDEO_LOCKED`; when the same video is open in another directory it is rejected with `VIDEO_IN_USE`.
   */
  async withWriteLock<T>(dir: string, fn: () => Promise<T>): Promise<T> {
    const host = await this.#ensureHost();
    const opened = await host.request<HostOpened>('videos.open', { path: dir });
    // A video already open in the engine (in a session, or the same video open in another directory) is not the lock taken this time, so it cannot be released on its behalf.
    const owned = !this.#channels.get(opened.videoId)?.session && hostPath(opened.path) === dir;
    try {
      if (!owned) throw new RpcError('conflict', RcVideo.videoInUse(), { code: 'VIDEO_IN_USE', videoId: opened.videoId });
      return await fn();
    } finally {
      if (owned && host.alive) {
        await host
          .request('videos.close', { videoId: opened.videoId })
          .catch((error) => this.#log.warn('Releasing the write lock failed', { error: String(error) }));
      }
    }
  }

  /** The Runtime holds an open video internally (for background tasks) until `release`. Reports not-found if the video is not open. */
  retain(videoId: Id): void {
    const session = this.#channels.get(videoId)?.session;
    if (!session) throw new RpcError('not-found', RcCommon.videoNotOpen());
    session.leases++;
    if (session.closeTimer) {
      clearTimeout(session.closeTimer);
      session.closeTimer = null;
    }
  }

  /** Releases a `retain` lease. When the last lease is released and there are no openers, the video is closed after the grace period. */
  release(videoId: Id): void {
    const channel = this.#channels.get(videoId);
    const session = channel?.session;
    if (!channel || !session || session.leases === 0) return;
    session.leases--;
    this.#scheduleIdleClose(videoId, channel);
  }

  /** Connection dropped: the videos it opened are closed after the grace period (reopening during that time cancels the close). */
  connectionClosed(connectionId: string): void {
    for (const [videoId, channel] of this.#channels) {
      if (!channel.session?.openers.delete(connectionId)) continue;
      this.#scheduleIdleClose(videoId, channel);
    }
  }

  /**
   * Closes now any video in directory `dir` that has no openers and no leases and is only waiting out its grace period. Used before moving a video directory (when a session without a project is moved into a project, or a session is deleted, architecture design §3.10): a video its session's agent has just released does not need to wait out the grace period.
   */
  async closeIdleIn(dir: string): Promise<void> {
    const root = path.resolve(dir);
    for (const [videoId, channel] of this.#channels) {
      const session = channel.session;
      if (!session || session.openers.size > 0 || session.leases > 0) continue;
      const rel = path.relative(root, path.resolve(session.ref.path));
      if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) continue;
      await this.#closeSession(videoId, 'idle');
    }
  }

  #scheduleIdleClose(videoId: Id, channel: Channel): void {
    const session = channel.session;
    if (!session || session.openers.size > 0 || session.leases > 0 || session.closeTimer) return;
    session.closeTimer = setTimeout(() => {
      session.closeTimer = null;
      if (channel.session === session && session.openers.size === 0 && session.leases === 0) void this.#closeSession(videoId, 'idle');
    }, this.#graceMs);
    session.closeTimer.unref?.();
  }

  // ---- Editing ----

  /**
   * `provenance.taskId` is filled in by the Runtime from the caller's current task; public requests cannot declare it themselves (command and protocol spec §2.2). `provenance.protections` is the protection scope of this task's contract (architecture design §3.2): submissions from agents working under a task are checked against it by the engine.
   */
  async apply(
    params: RpcParams<'edits.apply'>,
    principal: TrustedPrincipal,
    provenance: { taskId?: Id; protections?: EngineProtection[] } = {},
  ): Promise<EditResult> {
    return this.applyAs(params, actorOf(principal), provenance);
  }

  /**
   * Edits as the given actor. The Runtime's own writes (e.g. transcription results, `{ kind: 'system' }`) go through here.
   * `provenance.run` is the execution that task and pipeline writes belong to (architecture design §7.4): the engine applies the stop barrier based on it. Only the Runtime fills it in; public requests cannot pass it in.
   */
  async applyAs(
    params: RpcParams<'edits.apply'>,
    actor: Actor,
    provenance: { taskId?: Id; run?: EngineRun; protections?: EngineProtection[] } = {},
  ): Promise<EditResult> {
    const host = await this.#hostFor(params.videoId);
    return host.request<EditResult>('edits.apply', {
      videoId: params.videoId,
      commandId: params.commandId,
      expectedRevision: params.expectedRevision,
      operations: params.operations,
      ...(params.label !== undefined ? { label: params.label } : {}),
      ...(params.labelRef ? { labelRef: params.labelRef } : {}),
      actor,
      ...(provenance.taskId ? { taskId: provenance.taskId } : {}),
      ...(provenance.run ? { run: { runId: provenance.run.runId, runGeneration: provenance.run.runGeneration } } : {}),
      ...(provenance.protections?.length ? { protections: provenance.protections } : {}),
    });
  }

  /**
   * Stop barrier (architecture design §7.4): has the engine reject submissions from this execution's current generation and earlier ones. The request is written to the engine synchronously at call time, so later submissions from the same execution are guaranteed to queue behind it and be rejected. On resolve, submissions written to the engine before it have all received results. Resolves false when the video is not open, the engine is absent, or it is restarting; then only the Node-side barrier applies.
   */
  invalidateRun(videoId: Id, run: EngineRun): Promise<boolean> {
    const host = this.#host;
    if (!this.#channels.get(videoId)?.session || !host?.alive) return Promise.resolve(false);
    return host.request<{ recorded: boolean }>('runs.invalidate', { videoId, runId: run.runId, runGeneration: run.runGeneration }).then(
      (result) => result.recorded,
      (error) => {
        this.#log.warn('Stop barrier did not reach the engine', { videoId, runId: run.runId, error: String(error) });
        return false;
      },
    );
  }

  /**
   * Looks up the receipt of an already-committed transaction by `commandId` (after a crash, or when the receipt response was lost, architecture design §7.3); null if there is none. The video must already be open.
   */
  async receiptFor(videoId: Id, commandId: Id): Promise<TransactionReceipt | null> {
    const host = await this.#hostFor(videoId);
    const { receipt } = await host.request<{ receipt: TransactionReceipt | null }>('receipts.byCommand', { videoId, commandId });
    return receipt;
  }

  /** `guard.protections`: an agent's undo likewise must not touch its task's protection scope (§3.2). */
  async undo(
    params: RpcParams<'edits.undo'>,
    principal: TrustedPrincipal,
    guard: { protections?: EngineProtection[] } = {},
  ): Promise<EditResult> {
    const host = await this.#hostFor(params.videoId);
    return host.request<EditResult>('edits.undo', {
      ...params,
      actor: actorOf(principal),
      ...(guard.protections?.length ? { protections: guard.protections } : {}),
    });
  }

  async undoState(videoId: Id, principal: TrustedPrincipal): Promise<UndoState> {
    const host = await this.#hostFor(videoId);
    return host.request<UndoState>('edits.undoState', { videoId, actor: actorOf(principal) });
  }

  async history(videoId: Id, limit?: number): Promise<{ entries: HistoryEntry[] }> {
    const host = await this.#hostFor(videoId);
    return host.request<{ entries: HistoryEntry[] }>('history.list', { videoId, ...(limit ? { limit } : {}) });
  }

  /** Asset versions that cannot be read right now: the engine checks file by file whether each exists and has the right length (`videos.assetStatus`). */
  async assetStatus(videoId: Id): Promise<{ missing: MissingAsset[] }> {
    const host = await this.#hostFor(videoId);
    return host.request<{ missing: MissingAsset[] }>('videos.assetStatus', { videoId });
  }

  /**
   * Assets with no references at all (the engine checks against instances and proxies, chapter thumbnails and document sources, across all sequences): the preflight list for `assets_prune`, that is, what `removeAssets` can delete. Read-only.
   */
  async unusedAssets(videoId: Id): Promise<{ unused: UnusedAsset[] }> {
    const host = await this.#hostFor(videoId);
    return host.request<{ unused: UnusedAsset[] }>('videos.unusedAssets', { videoId });
  }

  async document(videoId: Id, documentId: Id, revision?: string): Promise<DocumentContent> {
    const host = await this.#hostFor(videoId);
    return host.request<DocumentContent>('documents.read', { videoId, documentId, ...(revision ? { revision } : {}) });
  }

  /**
   * Reads the identity and summary of a video directory without opening it or taking the write lock (the engine opens it read-only; an already-open video is used directly). The external service uses this to judge scope by videoId, so videos outside the scope are not opened by the check. `dir` is the absolute path of the video directory.
   */
  async peek(dir: string): Promise<{ videoId: Id; name: string; revision: string }> {
    const host = await this.#ensureHost();
    return host.request<{ videoId: Id; name: string; revision: string }>('videos.inspect', { path: dir });
  }

  /**
   * Local fonts (architecture design §9.1): the engine picks a face by family name, weight and italic (using the same matching as the typesetting engine), and gives the path of the file it lives in, its face index within that file, and whether it is extracted as a standalone font. Preview and export freezing both use this same result. It does not involve any particular video. The first call scans the name table of the local fonts.
   * Families not present locally are then looked up in the download cache (`source: 'downloaded'`).
   */
  async fontFaces(faces: FontFaceQuery[]): Promise<LocalFontFaces> {
    const host = await this.#ensureHost();
    const cacheDir = this.#options.fontCacheDir;
    return host.request('fonts.resolve', { faces, ...(cacheDir ? { cacheDir } : {}) });
  }

  /** The family names of locally installed fonts (the set the engine scanned; names only). */
  async fontFamilies(): Promise<string[]> {
    const host = await this.#ensureHost();
    const { families } = await host.request<{ families: string[] }>('fonts.families', {});
    return families;
  }

  /** Checks a font file (after download): reads the face with the same parsing used for rendering. The engine rejects it with `FONT_INVALID` if it is not a usable font. */
  async inspectFont(file: string): Promise<InspectedFontFace[]> {
    const host = await this.#ensureHost();
    const { faces } = await host.request<{ faces: InspectedFontFace[] }>('fonts.inspect', { path: file });
    return faces;
  }

  /**
   * Freezing for export (architecture design §9.11): in one request, the engine computes for the same video version the interval plan of the audio, or the projection of a document onto the timeline, together with the asset locations and document versions (`exports.plan`). Later edits do not affect this result.
   */
  async exportPlan<T>(videoId: Id, params: Record<string, unknown>): Promise<T> {
    const host = await this.#hostFor(videoId);
    return host.request<T>('exports.plan', { ...params, videoId });
  }

  /**
   * Freezing a portable package (video format spec §8): in one request, the engine gives the current snapshot, the original body text stored for each document version, and the location of each asset version (`exports.package`). Later edits do not affect this result.
   */
  async freezePackage<T>(videoId: Id): Promise<T> {
    const host = await this.#hostFor(videoId);
    return host.request<T>('exports.package', { videoId });
  }

  /**
   * Portable package import (`package-import.ts`): the engine builds the unpacked and validated package into a new video in `dir` (`videos.importPackage`), and here it is registered as an open video. `dir` is inside `rootReal` and does not exist yet.
   */
  async createFromPackage(
    dir: string,
    packageDir: string,
    rootReal: string,
    scope: VideoLocation['scope'],
    principal: TrustedPrincipal,
  ): Promise<VideoOpenResult> {
    const host = await this.#ensureHost();
    const opened = await host.request<HostOpened>('videos.importPackage', { path: dir, packageDir, ...projectOf(scope) });
    this.#log.info('Video created from portable package', { videoId: opened.videoId });
    return this.#register(opened, rootReal, scope, principal);
  }

  /**
   * The location of asset bytes, handed to the media channel to issue a handle. Collected assets are in the video directory. Linked assets (the default for imports) stay where they originally were. Only the one file the video registered is allowed (the path comes from the asset record in the engine, not from the caller), not other things in its directory.
   * Only the types needed for preview are allowed (see `servableLinked`), so that a video brought in from elsewhere cannot register an arbitrary local file as an “asset” and read it back out.
   */
  async assetFile(videoId: Id, assetId: Id, revision?: string): Promise<{ root: string; file: string; name: string }> {
    const host = await this.#hostFor(videoId);
    const blob = await host.request<ResolvedAsset>('assets.blobPath', {
      videoId,
      assetId,
      ...(revision ? { revision } : {}),
    });
    // While waiting for the engine to reply, the video may have been closed (idle close when no one has it open, or closed elsewhere). Reject it as not open, and do not go on to read the session that was already cleared.
    const session = this.#channels.get(videoId)?.session;
    if (!session) throw new RpcError('not-found', RcVideo.videoNotOpenOpenFirst(), { code: 'VIDEO_NOT_OPEN' });
    return servableAsset(blob, session.ref.path);
  }

  /**
   * Same as `assetFile`, but finds the file by video directory and does not require the video to be open (the engine's read-only query `videos.resolveAsset` takes no write lock; an open video uses the open copy).
   * Used for Space's video covers (architecture design §5.7). `dir` is the absolute path of the video directory, taken from the Space directory, not from the caller.
   */
  async assetFileAt(dir: string, assetId: Id, revision?: string): Promise<{ root: string; file: string; name: string }> {
    const host = await this.#ensureHost();
    const blob = await host.request<ResolvedAsset>('videos.resolveAsset', { path: dir, assetId, ...(revision ? { revision } : {}) });
    return servableAsset(blob, dir);
  }

  /**
   * Input for media analysis (waveforms, thumbnails): the record of an asset version (content digest, media type, probed streams) and the file location. The record is taken from the mirror; the file is allowed by the same rules as `assetFile`. Whether it can be analyzed is decided by media analysis per media type.
   */
  async mediaSource(videoId: Id, assetId: Id, revision?: string): Promise<{ root: string; file: string; record: AssetRevision }> {
    await this.#hostFor(videoId);
    const asset = this.#channels.get(videoId)?.mirror.video.assets[assetId];
    const record = asset?.revisions[revision ?? asset.currentRevision];
    if (!record) throw new RpcError('not-found', RcVideo.assetVersionNotFound());
    const { root, file } = await this.assetFile(videoId, assetId, record.revision);
    return { root, file, record };
  }

  // ---- Topic ----

  subscribe(
    videoId: Id,
    afterSeq: Seq | undefined,
    listener: (event: SequencedEvent<unknown>) => void,
  ): TopicSubscription<unknown, unknown> {
    const channel = this.#channels.get(videoId);
    if (!channel?.session) throw new RpcError('not-found', RcCommon.videoNotOpen());
    return channel.log.subscribe(afterSeq, listener as (event: SequencedEvent<VideoTopicEvent>) => void) as TopicSubscription<
      unknown,
      unknown
    >;
  }

  /** The location and identity of open videos; empty when none is open. */
  ref(videoId: Id): VideoRef | null {
    const channel = this.#channels.get(videoId);
    return channel?.session ? { ...channel.session.ref, name: channel.mirror.video.name } : null;
  }

  /** All videos currently open. */
  openRefs(): VideoRef[] {
    return [...this.#channels.keys()].flatMap((videoId) => this.ref(videoId) ?? []);
  }

  /** For tests and diagnostics: the engine process ID. */
  get enginePid(): number | null {
    return this.#host?.pid ?? null;
  }

  /** For tests and diagnostics: the mirror in the Runtime. */
  mirror(videoId: Id): VideoTopicSnapshot | null {
    return this.#channels.get(videoId)?.session ? this.#channels.get(videoId)!.mirror : null;
  }

  async shutdown(): Promise<void> {
    this.#closed = true;
    for (const channel of this.#channels.values()) {
      if (channel.session?.closeTimer) clearTimeout(channel.session.closeTimer);
      channel.session = null;
      channel.log.clear();
    }
    const host = this.#host ?? (await this.#starting?.catch(() => null)) ?? null;
    this.#host = null;
    await host?.close();
  }

  // ---- Internal ----

  #register(opened: HostOpened, rootReal: string, scope: VideoLocation['scope'], principal: TrustedPrincipal): VideoOpenResult {
    opened = { ...opened, path: hostPath(opened.path) };
    let channel = this.#channels.get(opened.videoId);
    if (!channel) {
      const holder: Channel = {
        log: new TopicLog<VideoTopicSnapshot, VideoTopicEvent>(() => holder.mirror, '0'),
        mirror: { video: opened.snapshot, eventSeq: opened.eventSeq },
        session: null,
        resyncing: false,
      };
      channel = holder;
      this.#channels.set(opened.videoId, channel);
    } else if (!channel.session) {
      // After closing and reopening, keep the same topic and publish one whole-replacement.
      channel.mirror = { video: opened.snapshot, eventSeq: opened.eventSeq };
      channel.log.publish({ type: 'video.replaced', snapshot: channel.mirror });
    }
    if (!channel.session) {
      const relPath = path.relative(rootReal, opened.path).split(path.sep).join('/');
      channel.session = {
        ref: {
          videoId: opened.videoId,
          name: channel.mirror.video.name,
          path: opened.path,
          source: {
            projectId: 'projectId' in scope ? scope.projectId : null,
            conversationId: 'conversationId' in scope ? scope.conversationId : null,
          },
          relPath,
        },
        openers: new Set(),
        leases: 0,
        closeTimer: null,
      };
    }
    const session = channel.session;
    session.openers.add(principal.connectionId);
    if (session.closeTimer) {
      clearTimeout(session.closeTimer);
      session.closeTimer = null;
    }
    return { ref: { ...session.ref, name: channel.mirror.video.name }, snapshot: channel.mirror };
  }

  async #closeSession(videoId: Id, reason: string): Promise<void> {
    const channel = this.#channels.get(videoId);
    if (!channel?.session) return;
    if (channel.session.closeTimer) clearTimeout(channel.session.closeTimer);
    const { ref: { path }, leases } = channel.session;
    channel.session = null;
    channel.log.publish({ type: 'video.closed', reason });
    this.#log.info('Video closed', { videoId, reason });
    const host = this.#host;
    if (!host?.alive) return;
    // Before releasing the write lock, clean up `blobs/` (architecture design §5.2, §5.5). This is done only on a normal close (openers all left, or idle) with no task lease. It is not done for a deleted video that is being moved away, or when the engine has errored. Portable package import completes before the session is registered, so it never reaches here. Failures are only logged; the close proceeds as usual.
    if ((reason === 'closed' || reason === 'idle') && leases === 0)
      await host.request('videos.gcBlobs', { path }).catch((error) => this.#log.warn('Cleaning up video blobs failed', { error: String(error) }));
    await host.request('videos.close', { videoId }).catch((error) => this.#log.warn('Closing the video failed', { error: String(error) }));
  }

  async #hostFor(videoId: Id): Promise<EngineHost> {
    if (!this.#channels.get(videoId)?.session) throw new RpcError('not-found', RcVideo.videoNotOpenOpenFirst(), { code: 'VIDEO_NOT_OPEN' });
    const host = this.#host ?? (await this.#starting);
    if (!host?.alive) throw new RpcError('engine-unavailable', RcVideo.engineRestarting());
    return host;
  }

  #ensureHost(): Promise<EngineHost> {
    if (this.#closed) return Promise.reject(new RpcError('engine-unavailable', RcVideo.runtimeStopping()));
    if (this.#host?.alive) return Promise.resolve(this.#host);
    this.#starting ??= (async () => {
      const command = this.#options.resolveCommand();
      if (!command) throw new RpcError('engine-unavailable', RcVideo.engineNotFound());
      const host = await EngineHost.start({
        command,
        env: await this.#options.env(),
        log: this.#log.child('engine'),
        onEvent: (event) => this.#onEvent(event),
        onExit: () => this.#onHostExit(),
      });
      this.#host = host;
      return host;
    })().finally(() => {
      this.#starting = null;
    });
    return this.#starting;
  }

  #onEvent(event: VideoEvent): void {
    const channel = this.#channels.get(event.videoId);
    if (!channel?.session || channel.resyncing) return;
    const current = BigInt(channel.mirror.eventSeq);
    const seq = BigInt(event.eventSeq);
    if (seq <= current) return;
    if (seq !== current + 1n) {
      void this.#resync(event.videoId);
      return;
    }
    channel.mirror = applyVideoEvent(channel.mirror, event);
    channel.log.publish({ type: 'video.event', event });
    this.#notifyChange(event.videoId);
  }

  /**
   * Version changes of an open video (after commits and catch-ups). Space's derived index (architecture design §5.7, §5.11) updates incrementally from them; videos that are not open are discovered by Space through directory changes. Returns a function that unsubscribes.
   */
  onChange(listener: (change: { videoId: Id; path: string; revision: string }) => void): () => void {
    this.#changeListeners.add(listener);
    return () => this.#changeListeners.delete(listener);
  }

  #notifyChange(videoId: Id): void {
    const channel = this.#channels.get(videoId);
    if (!channel?.session) return;
    const change = { videoId, path: channel.session.ref.path, revision: channel.mirror.video.revision };
    for (const listener of this.#changeListeners) {
      try {
        listener(change);
      } catch (error) {
        this.#log.error('Video change listener failed', { videoId, error: String(error) });
      }
    }
  }

  /**
   * Read-only query for the content index (architecture design §5.11, the engine's `videos.readContent`): the snapshot, and the body text and timeline projection of text-type documents. Like `peek`, it does not open the video or take the write lock; an already-open video uses the open copy. `dir` is the absolute path of the video directory.
   */
  async readContent<T>(dir: string): Promise<T> {
    const host = await this.#ensureHost();
    return host.request<T>('videos.readContent', { path: dir });
  }

  async #resync(videoId: Id): Promise<void> {
    const channel = this.#channels.get(videoId);
    if (!channel || channel.resyncing) return;
    channel.resyncing = true;
    try {
      const host = await this.#ensureHost();
      const fresh = await host.request<{ eventSeq: Seq; snapshot: VideoSnapshot }>('videos.snapshot', { videoId });
      if (!channel.session) return;
      channel.mirror = { video: fresh.snapshot, eventSeq: fresh.eventSeq };
      channel.log.publish({ type: 'video.replaced', snapshot: channel.mirror });
      this.#notifyChange(videoId);
    } catch (error) {
      this.#log.error('Catching up the video mirror failed', { videoId, error: String(error) });
    } finally {
      channel.resyncing = false;
    }
  }

  #onHostExit(): void {
    this.#host = null;
    if (this.#closed) return;
    const open = [...this.#channels.entries()].filter(([, channel]) => channel.session);
    if (open.length === 0) return;
    const now = Date.now();
    this.#restarts = this.#restarts.filter((t) => now - t < RESTART_WINDOW_MS);
    if (this.#restarts.length >= MAX_RESTARTS) {
      this.#log.error('Video engine keeps exiting; no more automatic restarts');
      for (const [videoId] of open) void this.#closeSession(videoId, 'engine-failed');
      return;
    }
    this.#restarts.push(now);
    void (async () => {
      for (const [videoId, channel] of open) {
        const session = channel.session;
        if (!session) continue;
        try {
          const host = await this.#ensureHost();
          const opened = await host.request<HostOpened>('videos.open', {
            path: session.ref.path,
            ...(session.ref.source.projectId ? { projectId: session.ref.source.projectId } : {}),
          });
          if (opened.videoId !== videoId) throw new Error('The video identity changed');
          channel.mirror = { video: opened.snapshot, eventSeq: opened.eventSeq };
          channel.log.publish({ type: 'video.replaced', snapshot: channel.mirror });
          this.#log.info('Reopened video after engine restart', { videoId });
        } catch (error) {
          this.#log.error("Couldn't reopen video after engine restart", { videoId, error: String(error) });
          channel.session = null;
          channel.log.publish({ type: 'video.closed', reason: 'engine-failed' });
        }
      }
    })();
  }
}

/** The project a video belongs to: a video in the project directory carries the project's id; one in a session working directory does not. */
function projectOf(scope: VideoLocation['scope']): { projectId?: Id } {
  return 'projectId' in scope ? { projectId: scope.projectId } : {};
}

async function exists(file: string): Promise<boolean> {
  return fs.access(file).then(
    () => true,
    () => false,
  );
}

/** Gets the real path of the video directory, and confirms that it is inside the source directory and contains `video.db`. */
async function locateVideoDir(location: VideoLocation): Promise<{ rootReal: string; dir: string }> {
  let rootReal: string;
  let real: string;
  try {
    rootReal = await fs.realpath(location.root);
    real = await fs.realpath(path.resolve(location.root, location.file));
  } catch {
    throw new RpcError('not-found', RcVideo.videoNotFound());
  }
  if (path.basename(real) === DB_FILE || path.basename(real) === LEGACY_DB_FILE) real = path.dirname(real);
  const prefix = rootReal.endsWith(path.sep) ? rootReal : rootReal + path.sep;
  if (real !== rootReal && !real.startsWith(prefix)) throw new RpcError('forbidden', RcVideo.onlyWorkspaceVideos());
  // A deleted video sits in the source directory's trash (§5.7): restore it before opening.
  if (path.relative(rootReal, real).split(path.sep).includes(TRASH_DIR)) {
    throw new RpcError('conflict', RcVideo.videoDeletedRestoreFromTrash(), { code: 'VIDEO_TRASHED' });
  }
  if (!(await exists(path.join(real, DB_FILE))) && !(await exists(path.join(real, LEGACY_DB_FILE)))) {
    throw new RpcError('not-found', RcVideo.dirNotVideo());
  }
  return { rootReal, dir: real };
}

/** The size limit for Lottie files: any bigger and it is no longer a sticker animation. */
const LOTTIE_MAX_BYTES = 32 * 2 ** 20;

/**
 * The extensions of linked assets that may be handed out through the media channel, and the major category of media type each should have (consistent with the engine's table that identifies media types by extension).
 * In a video container that holds only sound, the engine treats it as audio, so audio and video count as one category.
 */
type ServableGroup = 'av' | 'image' | 'font' | 'json' | 'dotlottie';
const LINKED_SERVABLE: Record<string, ServableGroup> = {};
for (const [group, exts] of Object.entries({
  av: ['mp4', 'm4v', 'mov', 'webm', 'mkv', 'mp3', 'm4a', 'aac', 'wav', 'flac', 'ogg', 'oga', 'opus'],
  image: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'],
  font: ['ttf', 'otf', 'woff2'],
  json: ['json'],
  dotlottie: ['lottie'],
}) as [ServableGroup, string[]][]) {
  for (const ext of exts) LINKED_SERVABLE[ext] = group;
}

function servableGroup(mediaType: string): ServableGroup | null {
  if (/^(video|audio)\//.test(mediaType)) return 'av';
  if (mediaType.startsWith('image/')) return 'image';
  if (mediaType.startsWith('font/')) return 'font';
  if (mediaType === 'application/json') return 'json';
  if (mediaType === 'application/zip') return 'dotlottie';
  return null;
}

/**
 * The asset location given by the engine → the source directory and file the media channel allows. Collected assets are in the video directory (`videoDir`). For linked assets, only the one registered file is allowed,
 * and only types needed for preview (`servableLinked`).
 */
async function servableAsset(blob: ResolvedAsset, videoDir: string): Promise<{ root: string; file: string; name: string }> {
  if (blob.storage === 'linked') {
    // The registered path may be a symbolic link: it is judged and allowed by the real file it points to. The type is judged by the real file's extension, so a symlink named clip.mp4 cannot be used to read another file. The media channel also then does not treat it as a file outside its directory.
    const real = await fs.realpath(blob.path).catch(() => blob.path);
    if (!(await servableLinked({ ...blob, path: real }))) {
      throw new RpcError('forbidden', RcVideo.linkedPreviewUnsupported());
    }
    return { root: path.dirname(real), file: path.basename(real), name: blob.name };
  }
  return { root: videoDir, file: blob.path, name: blob.name };
}

/**
 * Whether a linked asset may be handed out through the media channel. What the UI and preview ask for are images, audio and video (playback, waveforms, thumbnails, transcription), fonts and Lottie animations:
 *
 * - The registered media type and the file's actual extension must be the same major category. The media type comes from the record in the video, and a video from elsewhere can write anything. Requiring the file itself to be named `*.mp4`, `*.png`, `*.ttf` and so on means that a `~/.ssh/id_rsa` registered as an “image” cannot be read.
 * - JSON is allowed only if it actually reads as a Lottie animation (has a version, size, frame rate, frame range and layers), so other JSON on this machine (config, credentials) registered as an asset cannot be read either.
 *   `.lottie` is allowed only for archives whose zip central directory really contains `animations/*.json`.
 * - Subtitle files (`srt`, `vtt`, `ass`) are not allowed: their content is arbitrary text, which cannot be confirmed by type the way media can, and preview does not read them through the media channel either (subtitles are documents inside the video). Directories are not allowed (code packages): the media channel gives out only single files, and previews of code-package compositions use pre-rendered video.
 */
async function servableLinked(blob: ResolvedAsset): Promise<boolean> {
  const group = servableGroup(blob.mediaType);
  if (!group || LINKED_SERVABLE[path.extname(blob.path).slice(1).toLowerCase()] !== group) return false;
  if (group !== 'json' && group !== 'dotlottie') return true;
  try {
    const stat = await fs.stat(blob.path);
    if (!stat.isFile() || stat.size > LOTTIE_MAX_BYTES) return false;
    if (group === 'dotlottie') return isDotLottie(await fs.readFile(blob.path));
    const data: unknown = JSON.parse(await fs.readFile(blob.path, 'utf8'));
    if (typeof data !== 'object' || data === null) return false;
    const lottie = data as Record<string, unknown>;
    return (
      typeof lottie.v === 'string' &&
      ['w', 'h', 'fr', 'ip', 'op'].every((key) => Number.isFinite(lottie[key])) &&
      Array.isArray(lottie.layers)
    );
  } catch {
    return false;
  }
}
