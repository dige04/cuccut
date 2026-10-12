/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";
import type { FileSha } from "../deck-contracts";
import type { IndexDirtyListener } from "./index-store";
import type {
  FilePublishEntries,
  FilePublishInput,
  FilePublishRejection,
  FilePublishWrapper,
} from "./publish-inputs";
import type { WritableListingPort } from "./read-retries";
import type { CrashStashEdit } from "./unsaved-slides";

/** How long saves wait: the least gap between two publishes and the longest a change may sit unsaved. */
export interface SavePacing {
  gapMs: number;
  maxWaitMs: number;
}

/** Pacing for a person editing alone and for a shared deck, plus how long a peer's activity counts as recent. */
export interface SaveDebouncePolicy {
  solo: SavePacing;
  shared: SavePacing;
  recentMs: number;
}

/** A file and the sha the remote holds for it (`null` once deleted). */
export interface SaveQueueRemoteFile {
  path: string;
  sha256: string | null;
}

/** A change another party (or the host) made to the deck's files. */
export interface SaveQueueRemoteChange {
  changed: SaveQueueRemoteFile[];
  to: { version: string };
}

/** A path the server refused because its precondition no longer held. */
export interface SaveQueueConflictPath {
  path: string;
  liveSha: FileSha;
  expected?: FileSha;
}

/** A publish the server accepted. */
export interface SaveQueuePublishSuccess {
  ok: true;
  version: string;
  /** The publish changed nothing the server did not already have. */
  unchanged?: boolean;
  /** Every path carried its `ifMatch` precondition and all of them held. */
  preconditionsChecked?: boolean;
  changed?: SaveQueueRemoteFile[];
  /** Sha of every path that was sent, by path. */
  shas?: Record<string, string | null>;
  /** Paths whose sha the server computed after rewriting their content. */
  computed?: string[];
}

/** A publish that did not go through. */
export interface SaveQueuePublishFailure {
  ok: false;
  code: string;
  /** Version the server is at. */
  live?: string;
  retryAfterMs?: number;
  paths?: SaveQueueConflictPath[];
  changed?: SaveQueueRemoteFile[];
}

export type SaveQueuePublishResult =
  | SaveQueuePublishSuccess
  | SaveQueuePublishFailure;

/** What the save queue needs from the files port. */
export interface SaveQueuePort extends WritableListingPort {
  version(): { version: string };
  onRemoteChange(listener: (change: SaveQueueRemoteChange) => void): () => void;
  publish(
    entries: FilePublishEntries,
    options?: { ifMatch?: Record<string, FileSha> },
  ): Promise<SaveQueuePublishResult>;
  /** Sha the listing holds for a path now (`null`: absent), `undefined` when unknown. */
  liveSha?(path: string): string | null | undefined;
  /** Sha of the version the editor started from, when it holds one back from the listing. */
  heldSha?(path: string): FileSha | undefined;
  entryProblem?(path: string, input: FilePublishInput): string | undefined;
  entryProblemDetail?(
    path: string,
    input: FilePublishInput,
  ): FilePublishRejection | undefined;
}

/** The part of the index store the save queue works with. */
export interface SaveQueueIndexStore {
  readonly path: string;
  baseSha(): FileSha;
  bind(listener: IndexDirtyListener | undefined): void;
  markSaved(text: string, sha: FileSha): void;
  reloadAndMerge(): Promise<string[]>;
}

/** Timers and clock; tests substitute fakes. The handle is opaque. */
export interface FilesSaveTimers {
  setTimeout(callback: () => void, delay?: number): unknown;
  clearTimeout(handle: unknown): void;
  now(): number;
  random?(): number;
}

/** Where unsaved edits are parked so a crash does not lose them. */
export interface SaveQueueStash {
  put(edits: CrashStashEdit[], version: string): Promise<boolean>;
  clear(): Promise<unknown>;
  clearOffered(): Promise<unknown>;
}

/** Someone else in the room. */
export interface SaveQueuePeer {
  sameTab: boolean;
}

export interface SaveQueuePeerStore {
  getSnapshot(): readonly SaveQueuePeer[];
  subscribe(listener: () => void): () => void;
}

/** A path whose local edit and the remote version both moved on from the common base. */
export interface FilesSaveConflict {
  path: string;
  base: FileSha;
  /** The local content; `null` when it could not be read (`unreadable`). */
  mine: FilePublishInput;
  /** Sha the remote holds now. */
  theirsSha: string | null;
  unreadable?: true;
}

export interface FilesSaveQueueOptions {
  port: SaveQueuePort;
  index?: SaveQueueIndexStore;
  timers?: FilesSaveTimers;
  /** Space publishes out (alone: rarely; shared: promptly). */
  paced?: boolean;
  peers?: SaveQueuePeerStore;
  stash?: SaveQueueStash;
  tokens?: { advance?(path: string, sha: string): void };
  retryBudgetMs?: number;
  stuckRetryMs?: number;
  minGapMs?: number;
  onState?(state: FilesSaveQueueState): void;
  /** Pacing switched from solo to shared. */
  onShared?(): void;
  onConflict(conflict: FilesSaveConflict): void;
  onUnsendable?(path: string, why: string): void;
  onIndexMerged?(conflicts: string[]): void;
}

export interface FilesSaveCounters {
  publishes: number;
  pathsSent: number;
  conflicts: number;
  retries: number;
  rateLimited: number;
  bytesSent: number;
  lastPublishMs: number;
  surfaced: number;
}

/** The queue gave up retrying on its own. */
export interface FilesSaveStuckState {
  code: string;
  since: number;
  attempts: number;
  paths: string[];
  retryable: boolean;
  stashed: boolean;
  nextRetryAt?: number;
  /** The file the failure is about. */
  file?: string;
}

export interface FilesSaveUnsendable {
  path: string;
  why: string;
  cause: FilePublishRejection["cause"];
}

export interface FilesSaveQueueState {
  /** Paths waiting to be saved. */
  dirty: number;
  inFlight: boolean;
  lastError?: string;
  backoffUntil?: number;
  stuck?: FilesSaveStuckState;
  unsendable?: FilesSaveUnsendable[];
  unsendableStashed?: true;
}

export interface FilesSaveQueue {
  markDirty(path: string, value: () => FilePublishInput, base?: FileSha): void;
  commit(): void;
  /** Resolves once nothing is waiting or in flight (or the queue is stuck for good). */
  settle(): Promise<void>;
  dispose(): Promise<void>;
  counters: FilesSaveCounters;
  state(): FilesSaveQueueState;
  conflicted(): Map<string, FilesSaveConflict>;
  /** Why each path that cannot be sent was left out. */
  unsendable(): Map<string, string>;
  resolveConflict(path: string, choice: "mine" | "theirs"): void;
  pending(): boolean;
  isOwnEcho(change: SaveQueueRemoteFile): boolean;
  solo(): boolean;
  withdraw(path: string): void;
  withdrawn(): Set<string>;
  retryNow(): void;
  flushNow(): void;
  stashRestored(): void;
  stashHandedOff(): void;
}

/** One path waiting to be published. */
interface DirtyEntry {
  value: () => FilePublishInput;
  base: FileSha;
  gen: number;
}

/** A path that cannot be published as it is. */
interface UnsendableEntry {
  value: () => FilePublishInput;
  base: FileSha;
  why: string;
  cause: FilePublishRejection["cause"];
}

/** The retry attempts of the current stretch of refusals. */
interface RetryWindow {
  since: number;
  refusals: number;
  budgetMs: number;
}

/** What the index merge ended with. */
type IndexMergeOutcome =
  | "merged"
  | "unread"
  | "index_newer_build"
  | "index_damaged";

declare module "../bindings" {
  interface RuntimeBindings {
    FILE_SAVE_DEBOUNCE_POLICY: SaveDebouncePolicy;
    FILE_SAVE_RETRY_MIN_MS: number;
    FILE_SAVE_RETRY_MAX_MS: number;
    FILE_SAVE_BACKPRESSURE_DELAY_MS: number;
    FILE_SAVE_STUCK_TIMEOUT_MS: number;
    FILE_SAVE_SHARED_ACTIVITY_TIMEOUT_MS: number;
    FILE_SAVE_QUICK_RETRY_MS: number;
    FILE_SAVE_LONG_REQUEST_MS: number;
    FILE_SAVE_CONFLICT_RETRY_MS: number;
    FILE_SAVE_MAX_TRANSIENT_RETRIES: number;
    FILE_SAVE_TOTAL_RETRY_WINDOW_MS: number;
    FILE_SAVE_RECENT_PEER_WINDOW_MS: number;
    FILE_SAVE_MAX_CONFLICT_PATHS: number;
    FILE_SAVE_RECENT_ACTIVITY_WINDOW_MS: number;
    FILE_SAVE_MAX_CONFLICT_RETRIES: number;
    FILE_SAVE_MAX_BATCH_CONFLICTS: number;
    FILE_SAVE_RETRY_JITTER_MS: number;
    FILE_SAVE_CONFLICT_BACKOFF_MS: [number, number];
    FILE_SAVE_READ_RETRY_DELAYS_MS: number[];
    FILE_SAVE_TERMINAL_ERROR_CODES: Set<string>;
    /** Whether a save failure code means the index file itself is unusable. */
    isIndexFileSaveError: (code: string | undefined) => boolean;
    defaultFilesSaveTimers: () => FilesSaveTimers;
    createFilesSaveQueue: (options: FilesSaveQueueOptions) => FilesSaveQueue;
  }
}

export function installFilesSaveQueue(runtime: RuntimeBindings): () => void {
  var FILE_SAVE_DEBOUNCE_POLICY: RuntimeBindings["FILE_SAVE_DEBOUNCE_POLICY"];
  var FILE_SAVE_RETRY_MIN_MS: RuntimeBindings["FILE_SAVE_RETRY_MIN_MS"];
  var FILE_SAVE_RETRY_MAX_MS: RuntimeBindings["FILE_SAVE_RETRY_MAX_MS"];
  var FILE_SAVE_BACKPRESSURE_DELAY_MS: RuntimeBindings["FILE_SAVE_BACKPRESSURE_DELAY_MS"];
  var FILE_SAVE_STUCK_TIMEOUT_MS: RuntimeBindings["FILE_SAVE_STUCK_TIMEOUT_MS"];
  var FILE_SAVE_SHARED_ACTIVITY_TIMEOUT_MS: RuntimeBindings["FILE_SAVE_SHARED_ACTIVITY_TIMEOUT_MS"];
  var FILE_SAVE_QUICK_RETRY_MS: RuntimeBindings["FILE_SAVE_QUICK_RETRY_MS"];
  var FILE_SAVE_LONG_REQUEST_MS: RuntimeBindings["FILE_SAVE_LONG_REQUEST_MS"];
  var FILE_SAVE_CONFLICT_RETRY_MS: RuntimeBindings["FILE_SAVE_CONFLICT_RETRY_MS"];
  var FILE_SAVE_MAX_TRANSIENT_RETRIES: RuntimeBindings["FILE_SAVE_MAX_TRANSIENT_RETRIES"];
  var FILE_SAVE_TOTAL_RETRY_WINDOW_MS: RuntimeBindings["FILE_SAVE_TOTAL_RETRY_WINDOW_MS"];
  var FILE_SAVE_RECENT_PEER_WINDOW_MS: RuntimeBindings["FILE_SAVE_RECENT_PEER_WINDOW_MS"];
  var FILE_SAVE_MAX_CONFLICT_PATHS: RuntimeBindings["FILE_SAVE_MAX_CONFLICT_PATHS"];
  var FILE_SAVE_RECENT_ACTIVITY_WINDOW_MS: RuntimeBindings["FILE_SAVE_RECENT_ACTIVITY_WINDOW_MS"];
  var FILE_SAVE_MAX_CONFLICT_RETRIES: RuntimeBindings["FILE_SAVE_MAX_CONFLICT_RETRIES"];
  var FILE_SAVE_MAX_BATCH_CONFLICTS: RuntimeBindings["FILE_SAVE_MAX_BATCH_CONFLICTS"];
  var FILE_SAVE_RETRY_JITTER_MS: RuntimeBindings["FILE_SAVE_RETRY_JITTER_MS"];
  var FILE_SAVE_CONFLICT_BACKOFF_MS: RuntimeBindings["FILE_SAVE_CONFLICT_BACKOFF_MS"];
  var FILE_SAVE_READ_RETRY_DELAYS_MS: RuntimeBindings["FILE_SAVE_READ_RETRY_DELAYS_MS"];
  var FILE_SAVE_TERMINAL_ERROR_CODES: RuntimeBindings["FILE_SAVE_TERMINAL_ERROR_CODES"];
  var isIndexFileSaveError: RuntimeBindings["isIndexFileSaveError"];
  function defaultFilesSaveTimers(): FilesSaveTimers {
    return {
      setTimeout: (input, options) => setTimeout(input, options),
      clearTimeout: (input) => clearTimeout(input as number),
      now: () => Date.now(),
      random: () => Math.random(),
    };
  }
  function createFilesSaveQueue(options: FilesSaveQueueOptions): FilesSaveQueue {
    let { port: port } = options,
      normalizedPort = (0, runtime.normalizeFilesPort)(port),
      timers: FilesSaveTimers = options.timers ?? defaultFilesSaveTimers(),
      indexStore: SaveQueueIndexStore | undefined = options.index,
      indexPath: string | undefined = indexStore?.path,
      isIndexPath = (input: string): boolean =>
        indexPath !== undefined
          ? input === indexPath
          : (0, runtime.isProjectIndexFilePath)(input),
      dirtyEntries = new Map<string, DirtyEntry>(),
      conflictedEntries = new Map<string, FilesSaveConflict>(),
      recentConflictTimes = new Map<string, number[]>(),
      conflictSurfacedAt = new Map<string, number>(),
      conflictBudgetExceeded = new Set<string>(),
      withdrawnPaths = new Set<string>(),
      remoteShas = new Map<string, string | null>(),
      unsendableReasons = new Map<string, string>(),
      unsendableEntries = new Map<string, UnsendableEntry>(),
      unsendableStashed = false,
      ownPublishedShas = new Map<string, FileSha>(),
      awaitingComputedShas = new Set<string>(),
      lastRemoteVersion: string | undefined,
      isPublishVersionCurrent = (): boolean =>
        lastRemoteVersion === port.version().version ||
        port.version().version === lastPublishVersion,
      lastPublishVersion: string | undefined,
      ownPublishedVersions = new Set<string>(),
      counters: FilesSaveCounters = {
        publishes: 0,
        pathsSent: 0,
        conflicts: 0,
        retries: 0,
        rateLimited: 0,
        bytesSent: 0,
        lastPublishMs: 0,
        surfaced: 0,
      },
      dirtyGeneration = 0,
      inFlight = false,
      commitRequested = false,
      disposed = false,
      lastError: string | undefined,
      backoffUntil: number | undefined,
      rateLimitBackoff = FILE_SAVE_BACKPRESSURE_DELAY_MS,
      commitTimer: unknown,
      lastPublishStartedAt = -1 / 0,
      settleWaiters: (() => void)[] = [],
      conflictRetryUsed = false,
      retryOnRemoteChange = false,
      remoteChangeGeneration = 0,
      retryWindow: RetryWindow | undefined,
      retryBudgetMs =
        options.retryBudgetMs ?? FILE_SAVE_SHARED_ACTIVITY_TIMEOUT_MS,
      refusalHistory: { since: number; attempts: number } | undefined,
      stuckState: FilesSaveStuckState | undefined,
      retryTimer: unknown,
      stuckRetryBackoff =
        options.stuckRetryMs ?? FILE_SAVE_CONFLICT_RETRY_MS,
      hasStashedEntries = false,
      clearOfferedStashOnSave = false,
      rateLimitUntil = 0,
      serverRateLimit = false,
      firstDirtyAt: number | undefined,
      maxWaitTimer: unknown,
      ignorePacingOnce = false,
      indexNeedsMerge = false,
      lastStuckRetryAt = -1 / 0,
      wakeRetryWait: (() => void) | undefined,
      retryWaitProtected = false,
      random = (): number => timers.random?.() ?? Math.random(),
      jitterDelay = (input: number): number =>
        Math.round(input / 2 + random() * (input / 2)),
      currentRetryBudget = (): number =>
        options.retryBudgetMs ?? FILE_SAVE_SHARED_ACTIVITY_TIMEOUT_MS;
    function waitForRetryOrWake(
      input: number,
      options2: boolean = false,
    ): Promise<boolean> {
      return new Promise<boolean>((input2) => {
        let value = timers.setTimeout(() => {
          wakeRetryWait = undefined;
          input2(false);
        }, input);
        retryWaitProtected = options2;
        wakeRetryWait = () => {
          timers.clearTimeout(value);
          wakeRetryWait = undefined;
          input2(true);
        };
      });
    }
    let liveSha = (input: string): string | null | undefined =>
        remoteShas.has(input)
          ? remoteShas.get(input)
          : normalizedPort.liveSha?.(input),
      getQueueState = (): FilesSaveQueueState => ({
        dirty: dirtyEntries.size,
        inFlight: inFlight,
        ...(lastError !== undefined
          ? {
              lastError: lastError,
            }
          : {}),
        ...(backoffUntil !== undefined
          ? {
              backoffUntil: backoffUntil,
            }
          : {}),
        ...(stuckState !== undefined
          ? {
              stuck: {
                ...stuckState,
                paths: [...stuckState.paths],
              },
            }
          : {}),
        ...(unsendableEntries.size > 0
          ? {
              unsendable: [...unsendableEntries].map(
                ([input, input2]): FilesSaveUnsendable => ({
                  path: input,
                  why: input2.why,
                  cause: input2.cause,
                }),
              ),
              ...(unsendableStashed
                ? {
                    unsendableStashed: true,
                  }
                : {}),
            }
          : {}),
      }),
      notifyState = (): void => {
        try {
          options.onState?.(getQueueState());
        } catch {}
        if (
          !inFlight &&
          commitTimer === undefined &&
          (dirtyEntries.size === 0 || hasTerminalError())
        ) {
          let value = settleWaiters;
          settleWaiters = [];
          for (let value2 of value) value2();
        }
      },
      hasTerminalError = (): boolean =>
        lastError !== undefined &&
        backoffUntil === undefined &&
        !commitRequested,
      isOwnPublishEcho = (input: SaveQueueRemoteFile): boolean =>
        ownPublishedShas.has(input.path) &&
        ownPublishedShas.get(input.path) === input.sha256,
      lastSharedActivityAt = -1 / 0,
      peerStore: SaveQueuePeerStore = options.peers ?? runtime.roomPeerStore,
      hasOtherPeers = (): boolean =>
        peerStore.getSnapshot().some((input) => !input.sameTab),
      hasRecentSharedActivity = (): boolean =>
        timers.now() - lastSharedActivityAt <
        FILE_SAVE_DEBOUNCE_POLICY.recentMs,
      isSoloPacing = (): boolean =>
        options.paced === true &&
        !hasOtherPeers() &&
        !hasRecentSharedActivity(),
      getPacingPolicy = (): SavePacing | undefined =>
        options.paced !== true
          ? undefined
          : isSoloPacing()
            ? FILE_SAVE_DEBOUNCE_POLICY.solo
            : FILE_SAVE_DEBOUNCE_POLICY.shared;
    function switchToSharedPacing(): void {
      if (disposed) {
        return;
      }
      scheduleMaxWaitCommit();
      if (commitTimer !== undefined) {
        timers.clearTimeout(commitTimer);
        commitTimer = undefined;
      }
      tryStartCommit();
      try {
        options.onShared?.();
      } catch {}
    }
    function recordSharedActivity(): void {
      let value = isSoloPacing();
      lastSharedActivityAt = timers.now();
      if (value) {
        switchToSharedPacing();
      }
    }
    let hadOtherPeers = options.paced === true && hasOtherPeers(),
      unsubscribePeers: (() => void) | undefined =
        options.paced !== true
          ? undefined
          : peerStore.subscribe(() => {
              let value = hasOtherPeers(),
                value2 = value && !hadOtherPeers;
              hadOtherPeers = value;
              if (value2 && !hasRecentSharedActivity()) {
                switchToSharedPacing();
              }
            });
    function scheduleMaxWaitCommit(): void {
      if (maxWaitTimer !== undefined) {
        timers.clearTimeout(maxWaitTimer);
        maxWaitTimer = undefined;
      }
      let value = getPacingPolicy();
      if (value === undefined || firstDirtyAt === undefined || disposed) {
        return;
      }
      maxWaitTimer = timers.setTimeout(
        () => {
          maxWaitTimer = undefined;
          if (dirtyEntries.size === 0) {
            firstDirtyAt = undefined;
            return;
          }
          if (stuckState === undefined) {
            commitRequested = true;
            tryStartCommit();
          }
        },
        Math.max(0, firstDirtyAt + value.maxWaitMs - timers.now()),
      );
    }
    let unsubscribeRemoteChange = port.onRemoteChange((input) =>
      handleRemoteChange(input),
    );
    function handleRemoteChange(input: SaveQueueRemoteChange): void {
      remoteChangeGeneration += 1;
      let callback = (input2: SaveQueueRemoteFile): boolean =>
          isOwnPublishEcho(input2) ||
          (awaitingComputedShas.has(input2.path) &&
            input2.sha256 !== null &&
            ownPublishedVersions.has(input.to.version)),
        value = input.changed.some((input2) => !callback(input2));
      for (let value4 of input.changed)
        if (
          (remoteShas.set(value4.path, value4.sha256),
          awaitingComputedShas.delete(value4.path),
          ownPublishedShas.has(value4.path) &&
            ownPublishedShas.get(value4.path) !== value4.sha256)
        ) {
          ownPublishedShas.delete(value4.path);
        }
      lastRemoteVersion = input.to.version;
      if (value) {
        recordSharedActivity();
      }
      let value2 =
          isIndexFileSaveError(stuckState?.code) &&
          indexPath !== undefined &&
          input.changed.some((input2) => input2.path === indexPath),
        value3 =
          value2 && !retryOnRemoteChange
            ? runtime.FILES_BOOT_PERMANENT_RETRY_MS -
              (timers.now() - lastStuckRetryAt)
            : 0;
      if (value3 > 0) {
        if (retryTimer === undefined && !disposed) {
          retryTimer = timers.setTimeout(() => {
            retryTimer = undefined;
            restartRetryWindow(currentRetryBudget());
          }, value3);
        }
        return;
      }
      if ((retryOnRemoteChange || value2) && !inFlight && !disposed) {
        restartRetryWindow(currentRetryBudget());
      }
    }
    indexStore?.bind?.((input, options2, context) =>
      markDirty(input, options2, context),
    );
    function recordConflictAttempt(input: string): void {
      let value = timers.now();
      recentConflictTimes.set(input, [
        ...(recentConflictTimes.get(input) ?? []).filter(
          (input2) => value - input2 < FILE_SAVE_TOTAL_RETRY_WINDOW_MS,
        ),
        value,
      ]);
    }
    function markDirty(
      input: string,
      options2: () => FilePublishInput,
      context?: FileSha,
    ): void {
      if (disposed) {
        return;
      }
      let entry = dirtyEntries.get(input);
      dirtyGeneration += 1;
      let value =
          ownPublishedShas.has(input) &&
          (liveSha(input) === undefined ||
            liveSha(input) === ownPublishedShas.get(input)),
        value2: FileSha =
          context !== undefined
            ? context
            : entry !== undefined
              ? entry.base
              : value
                ? (ownPublishedShas.get(input) as FileSha)
                : (normalizedPort.heldSha?.(input) ?? liveSha(input) ?? null);
      unsendableReasons.delete(input);
      unsendableEntries.delete(input);
      dirtyEntries.set(input, {
        value: options2,
        base: value2,
        gen: dirtyGeneration,
      });
      if (firstDirtyAt === undefined) {
        firstDirtyAt = timers.now();
        scheduleMaxWaitCommit();
      }
      withdrawnPaths.delete(input);
      if (context !== undefined) {
        let entry2 = conflictSurfacedAt.get(input);
        if (
          entry2 !== undefined &&
          timers.now() - entry2 < FILE_SAVE_TOTAL_RETRY_WINDOW_MS
        ) {
          recordConflictAttempt(input);
        }
        conflictSurfacedAt.delete(input);
        conflictedEntries.delete(input);
      }
      if (stuckState !== undefined) {
        stuckState = {
          ...stuckState,
          paths: [...dirtyEntries.keys()],
        };
      }
      stashWritePaused = false;
      scheduleStashWrite();
      notifyState();
    }
    function commit(): void {
      if (disposed && dirtyEntries.size === 0) {
        return;
      }
      if (dirtyEntries.size === 0) {
        return;
      }
      if (stuckState !== undefined) {
        if (inFlight) {
          commitRequested = true;
        } else {
          restartRetryWindow(currentRetryBudget());
        }
        return;
      }
      commitRequested = true;
      tryStartCommit();
    }
    function restartRetryWindow(
      input: number,
      options2: boolean = false,
    ): void {
      if (disposed || inFlight) {
        return;
      }
      let value = rateLimitUntil - timers.now();
      if (value > 0 && (serverRateLimit || !options2)) {
        if (retryTimer === undefined) {
          retryTimer = timers.setTimeout(() => {
            retryTimer = undefined;
            restartRetryWindow(input);
          }, value);
        }
        return;
      }
      if (retryTimer !== undefined) {
        timers.clearTimeout(retryTimer);
        retryTimer = undefined;
      }
      ignorePacingOnce = true;
      if (commitTimer !== undefined) {
        timers.clearTimeout(commitTimer);
        commitTimer = undefined;
      }
      retryWindow = undefined;
      retryBudgetMs = input;
      retryOnRemoteChange = false;
      lastError = undefined;
      if (dirtyEntries.size === 0) {
        notifyState();
        return;
      }
      commitRequested = true;
      tryStartCommit();
    }
    function tryStartCommit(): void {
      if (inFlight || !commitRequested) {
        return;
      }
      if (commitTimer !== undefined) {
        scheduleStashWrite(0);
        return;
      }
      if (dirtyEntries.size === 0) {
        commitRequested = false;
        notifyState();
        return;
      }
      let value =
        Math.max(
          options.minGapMs ?? 0,
          ignorePacingOnce ? 0 : (getPacingPolicy()?.gapMs ?? 0),
        ) -
        (timers.now() - lastPublishStartedAt);
      if (value > 0) {
        commitTimer = timers.setTimeout(() => {
          commitTimer = undefined;
          tryStartCommit();
        }, value);
        scheduleStashWrite(0);
        return;
      }
      commitRequested = false;
      ignorePacingOnce = false;
      publishDirtyEntries();
    }
    function detectChangedFileBases(): void {
      conflictBudgetExceeded.clear();
      for (let [value, value2] of [...dirtyEntries]) {
        if (isIndexPath(value)) {
          continue;
        }
        let value3 = liveSha(value);
        if (value3 === undefined || value3 === value2.base) {
          continue;
        }
        if (
          ownPublishedShas.has(value) &&
          ownPublishedShas.get(value) === value3
        ) {
          value2.base = value3;
          continue;
        }
        if (
          awaitingComputedShas.has(value) &&
          typeof value3 === "string" &&
          isPublishVersionCurrent()
        ) {
          awaitingComputedShas.delete(value);
          ownPublishedShas.set(value, value3);
          value2.base = value3;
          continue;
        }
        let value4 = timers.now();
        if (
          (recentConflictTimes.get(value) ?? []).filter(
            (input) => value4 - input < FILE_SAVE_TOTAL_RETRY_WINDOW_MS,
          ).length >= FILE_SAVE_MAX_TRANSIENT_RETRIES
        ) {
          conflictBudgetExceeded.add(value);
          continue;
        }
        let value5: FilePublishInput,
          flag = false;
        try {
          value5 = value2.value();
        } catch {
          value5 = null;
          flag = true;
        }
        let state: FilesSaveConflict = {
          path: value,
          base: value2.base,
          mine: value5,
          theirsSha: value3,
          ...(flag
            ? {
                unreadable: true,
              }
            : {}),
        };
        dirtyEntries.delete(value);
        conflictedEntries.set(value, state);
        conflictSurfacedAt.set(value, value4);
        counters.surfaced += 1;
        if (options.stash !== undefined) {
          hasStashedEntries = true;
          stashWritePaused = false;
        }
        try {
          options.onConflict(state);
        } catch {}
      }
    }
    function beginRetryAttempt(): RetryWindow {
      let value = timers.now();
      retryWindow ??= {
        since: value,
        refusals: 0,
        budgetMs: retryBudgetMs,
      };
      retryWindow.refusals += 1;
      refusalHistory ??= {
        since: value,
        attempts: 0,
      };
      refusalHistory.attempts += 1;
      return retryWindow;
    }
    async function publishDirtyEntries(): Promise<void> {
      inFlight = true;
      lastPublishStartedAt = timers.now();
      let value = remoteChangeGeneration;
      detectChangedFileBases();
      if (
        indexStore &&
        indexPath !== undefined &&
        dirtyEntries.has(indexPath)
      ) {
        let value4 = liveSha(indexPath),
          value5: IndexMergeOutcome =
            (value4 !== undefined &&
              value4 !== null &&
              value4 !== indexStore.baseSha() &&
              ownPublishedShas.get(indexPath) !== value4) ||
            indexNeedsMerge
              ? await mergeRemoteIndex()
              : "merged";
        if (value5 !== "merged" && value5 !== "unread") {
          beginRetryAttempt();
          return markStuck(value5, false, undefined, indexPath);
        }
        if (value5 === "unread") {
          lastError = "conflict";
          beginRetryAttempt();
          notifyState();
          return retryFailure("conflict", true);
        }
      }
      let state: FilePublishEntries = {},
        entries = new Map<string, number>(),
        state2: Record<string, FileSha> = {};
      for (let [value4, value5] of [...dirtyEntries]) {
        if (conflictBudgetExceeded.has(value4)) {
          continue;
        }
        let value6: FilePublishInput;
        try {
          value6 = value5.value();
        } catch {
          continue;
        }
        let value7: FilePublishRejection | undefined;
        try {
          if (normalizedPort.entryProblemDetail !== undefined) {
            value7 = normalizedPort.entryProblemDetail(value4, value6);
          } else if (normalizedPort.entryProblem !== undefined) {
            let value8 = normalizedPort.entryProblem(value4, value6);
            value7 =
              value8 === undefined
                ? undefined
                : {
                    why: value8,
                    cause: "other",
                  };
          } else {
            value7 = (0, runtime.filePublishRejection)(value4, value6);
          }
        } catch {
          value7 = (0, runtime.filePublishRejection)(value4, value6);
        }
        if (value7 === undefined) {
          let value8 = (0, runtime.filePublishSizeRejection)(value6);
          if (value8 !== undefined) {
            value7 = {
              why: value8,
              cause: "size",
            };
          }
        }
        if (value7 !== undefined && value6 === null) {
          dirtyEntries.delete(value4);
          unsendableReasons.delete(value4);
          unsendableEntries.delete(value4);
          continue;
        }
        if (value7 !== undefined) {
          dirtyEntries.delete(value4);
          unsendableReasons.set(value4, value7.why);
          unsendableEntries.set(value4, {
            value: value5.value,
            base: value5.base,
            why: value7.why,
            cause: value7.cause,
          });
          unsendableStashed = false;
          if (options.stash !== undefined) {
            hasStashedEntries = true;
            stashWritePaused = false;
          }
          try {
            options.onUnsendable?.(value4, value7.why);
          } catch {}
          continue;
        }
        state[value4] = value6;
        entries.set(value4, value5.gen);
        state2[value4] = value5.base;
      }
      if (entries.size === 0) {
        if (dirtyEntries.size === 0) {
          finishPublish();
          return;
        }
        if (
          [...dirtyEntries.keys()].every((input) =>
            conflictBudgetExceeded.has(input),
          )
        ) {
          return markStuck("conflict", false, FILE_SAVE_RECENT_PEER_WINDOW_MS);
        }
        beginRetryAttempt();
        return markStuck("invalid_content", false);
      }
      notifyState();
      let value2 = (0, runtime.splitFilePublishBatches)(state, isIndexPath),
        value3: SaveQueuePublishFailure | undefined;
      for (let value4 of value2) {
        let value5 = timers.now(),
          value6: SaveQueuePublishResult,
          value7: Record<string, FileSha> = Object.fromEntries(
            Object.keys(value4)
              .filter(
                (input) =>
                  !(
                    awaitingComputedShas.has(input) &&
                    state2[input] === ownPublishedShas.get(input)
                  ),
              )
              .map((input): [string, FileSha] => [input, state2[input] ?? null]),
          ),
          version = port.version().version;
        try {
          value6 = await port.publish(value4, {
            ifMatch: value7,
          });
        } catch {
          value6 = {
            ok: false,
            code: "upstream_error",
          };
        }
        if (
          value6.ok &&
          value6.unchanged !== true &&
          value6.version === version
        ) {
          value6 = {
            ...value6,
            unchanged: true,
          };
        }
        if (!value6.ok) {
          value3 = value6;
          break;
        }
        if (value6.changed) {
          for (let value10 of value6.changed)
            if (!(value10.path in value4)) {
              remoteShas.set(value10.path, value10.sha256);
              awaitingComputedShas.delete(value10.path);
            }
        }
        let value8 =
          value6.preconditionsChecked === true &&
          Object.keys(value4).every((input) => Object.hasOwn(value7, input));
        if (
          !(
            value6.unchanged === true ||
            (value8 && value6.changed === undefined)
          )
        ) {
          lastPublishVersion = value6.version;
          ownPublishedVersions.add(value6.version);
          if (ownPublishedVersions.size > FILE_SAVE_MAX_BATCH_CONFLICTS) {
            ownPublishedVersions.delete(
              ownPublishedVersions.values().next().value as string,
            );
          }
        }
        counters.publishes += 1;
        counters.pathsSent += Object.keys(value4).length;
        counters.lastPublishMs = timers.now() - value5;
        let value9 =
          value6.shas ?? (await (0, runtime.hashFilePublishEntries)(value4));
        for (let [value10, value11] of Object.entries(value4)) {
          let value12 =
            value11 === null ? null : (value9[value10] ?? null);
          counters.bytesSent += (0, runtime.filePublishRawBytes)(value11);
          ownPublishedShas.set(value10, value12);
          remoteShas.set(value10, value12);
          if (
            !(
              value6.shas?.[value10] !== undefined &&
              value6.computed?.includes(value10) !== true
            ) &&
            value12 !== null &&
            (0, runtime.fileContentContainsRuntimeMarkers)(value11)
          ) {
            awaitingComputedShas.add(value10);
          } else {
            awaitingComputedShas.delete(value10);
          }
          if (value12 !== null && value6.unchanged !== true) {
            options.tokens?.advance?.(value10, value12);
          }
          let entry = dirtyEntries.get(value10);
          if (entry !== undefined && entry.gen === entries.get(value10)) {
            dirtyEntries.delete(value10);
            conflictSurfacedAt.delete(value10);
          } else if (entry !== undefined) {
            entry.base = value12;
          }
          if (indexStore && value10 === indexPath && value12 !== null) {
            indexStore.markSaved(
              (0, runtime.fileInputDebugText)(value11),
              value12,
            );
          }
        }
      }
      if (value3 === undefined) {
        let value4 = [...conflictBudgetExceeded].some((input) =>
          dirtyEntries.has(input),
        );
        finishPublish(!value4, !value4);
        let value5 = [...dirtyEntries.keys()].some(
          (input) => !conflictBudgetExceeded.has(input),
        );
        if (value4) {
          markStuck(
            "conflict",
            false,
            value5 ? 0 : FILE_SAVE_RECENT_PEER_WINDOW_MS,
            undefined,
            value5 ? currentRetryBudget() : 0,
          );
        }
        return;
      }
      await handlePublishFailure(value3, value);
    }
    function finishPublish(input: boolean = true, options2: boolean = true): void {
      conflictRetryUsed = false;
      retryOnRemoteChange = false;
      lastError = undefined;
      backoffUntil = undefined;
      rateLimitBackoff = FILE_SAVE_BACKPRESSURE_DELAY_MS;
      retryWindow = undefined;
      refusalHistory = undefined;
      retryBudgetMs = currentRetryBudget();
      stuckState = undefined;
      stuckRetryBackoff = options.stuckRetryMs ?? FILE_SAVE_CONFLICT_RETRY_MS;
      rateLimitUntil = 0;
      serverRateLimit = false;
      if (retryTimer !== undefined) {
        timers.clearTimeout(retryTimer);
        retryTimer = undefined;
      }
      clearSavedStash();
      firstDirtyAt = dirtyEntries.size === 0 ? undefined : timers.now();
      scheduleMaxWaitCommit();
      inFlight = false;
      if (options2) {
        notifyState();
      }
      if (input) {
        tryStartCommit();
      }
    }
    async function handlePublishFailure(
      input: SaveQueuePublishFailure,
      options2: number,
    ): Promise<void> {
      lastError = input.code;
      if (input.code === "conflict") {
        counters.conflicts += 1;
        if (input.changed) {
          for (let value2 of input.changed) {
            remoteShas.set(value2.path, value2.sha256);
            awaitingComputedShas.delete(value2.path);
          }
        }
        if (input.paths) {
          for (let value2 of input.paths) {
            remoteShas.set(value2.path, value2.liveSha);
            awaitingComputedShas.delete(value2.path);
          }
        }
        let value = beginRetryAttempt();
        if (
          indexStore &&
          indexPath !== undefined &&
          dirtyEntries.has(indexPath)
        ) {
          indexNeedsMerge = true;
        }
        notifyState();
        for (;;) {
          let value2 =
            remoteChangeGeneration !== options2 ||
            (input.live !== undefined && port.version().version === input.live)
              ? true
              : await waitForRemoteVersion();
          for (
            let index = 0;
            value2 &&
            awaitingComputedShas.size > 0 &&
            !isPublishVersionCurrent() &&
            index < FILE_SAVE_MAX_CONFLICT_RETRIES &&
            !disposed;
            index++
          )
            await waitForRemoteVersion();
          let value3 = await refreshLiveFileShas();
          if (disposed) {
            inFlight = false;
            notifyState();
            return;
          }
          if (value2 && !value3 && remoteChangeGeneration === options2) {
            if (timers.now() - value.since >= value.budgetMs) {
              return markStuck("conflict", false);
            }
            let value4 = Math.min(
              jitterDelay(FILE_SAVE_QUICK_RETRY_MS * 2),
              Math.max(1, value.budgetMs - (timers.now() - value.since)),
            );
            backoffUntil = timers.now() + value4;
            notifyState();
            await waitForRetryOrWake(value4);
            backoffUntil = undefined;
            continue;
          }
          detectChangedFileBases();
          if (
            indexStore &&
            indexPath !== undefined &&
            dirtyEntries.has(indexPath)
          ) {
            let value4 = await mergeRemoteIndex();
            if (value4 !== "merged" && value4 !== "unread") {
              return markStuck(value4, false, undefined, indexPath);
            }
          }
          if (dirtyEntries.size === 0) {
            finishPublish();
            return;
          }
          if (!value2) {
            if (conflictRetryUsed) {
              return markStuck("conflict", true);
            }
            conflictRetryUsed = true;
          }
          return retryFailure("conflict", value2);
        }
      }
      if (input.code === "rate_limited") {
        counters.rateLimited += 1;
        let value = beginRetryAttempt(),
          value2 =
            input.retryAfterMs !== undefined &&
            Number.isFinite(input.retryAfterMs) &&
            input.retryAfterMs >= 0
              ? Math.min(
                  Math.max(input.retryAfterMs, FILE_SAVE_RETRY_JITTER_MS),
                  FILE_SAVE_RECENT_ACTIVITY_WINDOW_MS,
                )
              : undefined,
          value3 = value2 ?? rateLimitBackoff;
        rateLimitBackoff = Math.min(
          FILE_SAVE_STUCK_TIMEOUT_MS,
          rateLimitBackoff * 2,
        );
        rateLimitUntil = timers.now() + value3;
        serverRateLimit = value2 !== undefined;
        backoffUntil = rateLimitUntil;
        notifyState();
        let value4 = value.budgetMs - (timers.now() - value.since),
          value5 = await waitForRetryOrWake(
            Math.max(0, Math.min(value3, value4)),
            serverRateLimit,
          );
        if (disposed) {
          inFlight = false;
          notifyState();
          return;
        }
        if (
          !value5 &&
          (timers.now() < rateLimitUntil ||
            timers.now() - value.since >= value.budgetMs)
        ) {
          return markStuck(
            "rate_limited",
            false,
            Math.max(rateLimitUntil - timers.now(), FILE_SAVE_RETRY_JITTER_MS),
          );
        }
        rateLimitUntil = 0;
        backoffUntil = undefined;
        counters.retries += 1;
        lastError = undefined;
        return publishDirtyEntries();
      }
      if (input.code === "upstream_error") {
        beginRetryAttempt();
        notifyState();
        return retryFailure("upstream_error", true);
      }
      beginRetryAttempt();
      markStuck(input.code, false);
    }
    async function retryFailure(
      input: string,
      options2: boolean,
    ): Promise<void> {
      let value = retryWindow!,
        value2 = timers.now() - value.since;
      if (value2 >= value.budgetMs) {
        return markStuck(input, !options2);
      }
      let refusals = value.refusals,
        value3: number;
      if (refusals <= 1) {
        value3 =
          input === "upstream_error"
            ? FILE_SAVE_CONFLICT_BACKOFF_MS[0] +
              Math.floor(
                random() *
                  (FILE_SAVE_CONFLICT_BACKOFF_MS[1] -
                    FILE_SAVE_CONFLICT_BACKOFF_MS[0]),
              )
            : 0;
      } else {
        value3 = jitterDelay(
          Math.min(
            FILE_SAVE_LONG_REQUEST_MS,
            FILE_SAVE_QUICK_RETRY_MS * 2 ** (refusals - 2),
          ),
        );
      }
      value3 = Math.min(value3, value.budgetMs - value2);
      counters.retries += 1;
      if (value3 > 0) {
        backoffUntil = timers.now() + value3;
        notifyState();
        await waitForRetryOrWake(value3);
        backoffUntil = undefined;
      }
      if (disposed) {
        inFlight = false;
        notifyState();
        return;
      }
      lastError = undefined;
      return publishDirtyEntries();
    }
    function markStuck(
      input: string,
      options2: boolean,
      context?: number,
      value?: string,
      extra: number = 0,
    ): void {
      let value2 = timers.now();
      lastError = input;
      let value3 =
        input === "conflict" &&
        (refusalHistory?.attempts ?? 0) >= FILE_SAVE_MAX_CONFLICT_PATHS;
      retryOnRemoteChange = options2 || value3;
      backoffUntil = undefined;
      commitRequested = false;
      inFlight = false;
      retryWindow = undefined;
      let value4 = !FILE_SAVE_TERMINAL_ERROR_CODES.has(input),
        value5: number | undefined,
        value6 = options.stuckRetryMs ?? FILE_SAVE_CONFLICT_RETRY_MS;
      if (
        value4 &&
        !options2 &&
        !value3 &&
        (value6 > 0 || context !== undefined)
      ) {
        let value7 = context ?? jitterDelay(stuckRetryBackoff);
        if (context === undefined) {
          stuckRetryBackoff = Math.min(
            FILE_SAVE_STUCK_TIMEOUT_MS,
            stuckRetryBackoff * 2,
          );
        }
        value5 = value2 + value7;
        if (retryTimer !== undefined) {
          timers.clearTimeout(retryTimer);
        }
        retryTimer = timers.setTimeout(() => {
          retryTimer = undefined;
          restartRetryWindow(extra);
        }, value7);
      }
      stuckState = {
        code: input,
        since: refusalHistory?.since ?? value2,
        attempts: refusalHistory?.attempts ?? 1,
        paths: [...dirtyEntries.keys()],
        retryable: value4,
        stashed: stuckState?.stashed ?? false,
        ...(value5 !== undefined
          ? {
              nextRetryAt: value5,
            }
          : {}),
        ...(value !== undefined
          ? {
              file: value,
            }
          : {}),
      };
      stashWritePaused = false;
      writePendingStash();
      notifyState();
    }
    let stashGeneration = 0,
      stashWriteChain: Promise<unknown> = Promise.resolve();
    function serializeStashWrite<T>(input: () => Promise<T>): Promise<T> {
      let value = stashWriteChain.then(input);
      stashWriteChain = value.catch(() => {
        return;
      });
      return value;
    }
    let stashWriteInFlight = false,
      stashWriteOwed = false;
    function writePendingStash(): void {
      if (options.stash === undefined || stashWritePaused) {
        return;
      }
      if (stashWriteInFlight) {
        stashWriteOwed = true;
        return;
      }
      let items: CrashStashEdit[] = [],
        flag = true,
        value: [string, () => FilePublishInput, FileSha][] = [
          ...dirtyEntries,
        ].map(([input, input2]): [string, () => FilePublishInput, FileSha] => [
          input,
          input2.value,
          input2.base,
        ]);
      for (let [value3, value4] of conflictedEntries) {
        if (dirtyEntries.has(value3)) {
          continue;
        }
        if (value4.unreadable === true) {
          flag = false;
          continue;
        }
        value.push([value3, () => value4.mine, value4.base]);
      }
      for (let [value3, value4] of unsendableEntries)
        if (!dirtyEntries.has(value3) && !conflictedEntries.has(value3)) {
          value.push([value3, value4.value, value4.base]);
        }
      if (value.length === 0) {
        return;
      }
      for (let [value3, value4, value5] of value) {
        let value6: FilePublishInput;
        try {
          value6 = value4();
        } catch {
          flag = false;
          continue;
        }
        let value7: string | Blob | null =
          value6 === null
            ? null
            : typeof value6 === "object" &&
                !(typeof Blob !== "undefined" && value6 instanceof Blob)
              ? (value6 as FilePublishWrapper).content
              : value6;
        if (value7 !== null && typeof value7 !== "string") {
          flag = false;
          continue;
        }
        items.push({
          path: value3,
          text: value7,
          base: value5,
        });
      }
      hasStashedEntries = true;
      stashWriteInFlight = true;
      let value2 = ++stashGeneration,
        stash = options.stash,
        version = port.version().version;
      serializeStashWrite(() => stash.put(items, version))
        .finally(() => {
          stashWriteInFlight = false;
          if (stashWriteOwed) {
            stashWriteOwed = false;
            writePendingStash();
          }
        })
        .then((input) => {
          if (
            value2 !== stashGeneration ||
            disposed ||
            (stuckState === undefined && unsendableEntries.size === 0)
          ) {
            return;
          }
          if (stuckState !== undefined) {
            stuckState = {
              ...stuckState,
              stashed: input && flag,
            };
          }
          unsendableStashed = unsendableEntries.size > 0 && input && flag;
          notifyState();
        });
    }
    function clearSavedStash(): void {
      if (!hasStashedEntries) {
        return;
      }
      if (
        dirtyEntries.size > 0 ||
        conflictedEntries.size > 0 ||
        unsendableEntries.size > 0
      ) {
        scheduleStashWrite(0);
        return;
      }
      hasStashedEntries = false;
      let stash = options.stash,
        value = clearOfferedStashOnSave;
      clearOfferedStashOnSave = false;
      if (stash !== undefined) {
        serializeStashWrite(async () => {
          await stash.clear();
          if (value) {
            await stash.clearOffered();
          }
        });
      }
    }
    let stashWritePaused = false,
      stashResumeTimer: unknown,
      stashWriteTimer: unknown;
    function scheduleStashWrite(input: number = 1000): void {
      if (options.stash === undefined || disposed) {
        return;
      }
      if (stashWriteTimer !== undefined) {
        if (input > 0) {
          return;
        }
        timers.clearTimeout(stashWriteTimer);
      }
      stashWriteTimer = timers.setTimeout(() => {
        stashWriteTimer = undefined;
        if (
          !disposed &&
          (dirtyEntries.size > 0 ||
            conflictedEntries.size > 0 ||
            unsendableEntries.size > 0)
        ) {
          writePendingStash();
        }
      }, input);
    }
    function clearStuckIfClean(): void {
      if (dirtyEntries.size > 0 || stuckState === undefined || inFlight) {
        return;
      }
      finishPublish();
    }
    function waitForRemoteVersion(): Promise<boolean> {
      return new Promise<boolean>((input) => {
        let flag = false,
          callback = (input2: boolean): void => {
            if (flag) {
              return;
            }
            flag = true;
            value();
            timers.clearTimeout(value2);
            input(input2);
          },
          value = port.onRemoteChange(() => callback(true)),
          value2 = timers.setTimeout(
            () => callback(false),
            FILE_SAVE_RETRY_MIN_MS,
          );
      });
    }
    async function refreshLiveFileShas(): Promise<boolean> {
      try {
        let value = await (0, runtime.retryFileRead)(
          () => (0, runtime.listWritableFiles)(port),
          timers,
          undefined,
          FILE_SAVE_READ_RETRY_DELAYS_MS,
        );
        if ((0, runtime.fileListingIsNarrowed)(value, port)) {
          return false;
        }
        let entries = new Map(
          value.map((input): [string, string] => [input.path, input.sha256]),
        );
        for (let value2 of dirtyEntries.keys())
          remoteShas.set(value2, entries.get(value2) ?? null);
        if (indexPath !== undefined) {
          remoteShas.set(indexPath, entries.get(indexPath) ?? null);
        }
        return true;
      } catch {
        return false;
      }
    }
    async function mergeRemoteIndex(): Promise<IndexMergeOutcome> {
      if (!indexStore) {
        return "merged";
      }
      try {
        let value = await (0, runtime.retryFileRead)(
          () => indexStore.reloadAndMerge(),
          timers,
          undefined,
          FILE_SAVE_READ_RETRY_DELAYS_MS,
        );
        indexNeedsMerge = false;
        if (value.length > 0) {
          try {
            options.onIndexMerged?.(value);
          } catch {}
        }
        let entry = dirtyEntries.get(indexStore.path);
        if (entry !== undefined) {
          entry.base = indexStore.baseSha();
        }
        return "merged";
      } catch (value: unknown) {
        if (
          value instanceof runtime.IndexFileError &&
          value.code !== "not_found"
        ) {
          lastStuckRetryAt = timers.now();
          if (value.code === "newer_version") {
            return "index_newer_build";
          } else {
            return "index_damaged";
          }
        }
        if (
          (value as { status?: unknown } | null | undefined)?.status === 404 &&
          liveSha(indexStore.path) === null
        ) {
          indexNeedsMerge = false;
          let entry = dirtyEntries.get(indexStore.path);
          if (entry !== undefined) {
            entry.base = null;
          }
          return "merged";
        }
        return "unread";
      }
    }
    function flushNow(): void {
      if (dirtyEntries.size === 0) {
        return;
      }
      if (stuckState !== undefined) {
        restartRetryWindow(currentRetryBudget());
        return;
      }
      ignorePacingOnce = true;
      commitRequested = true;
      if (commitTimer !== undefined) {
        timers.clearTimeout(commitTimer);
        commitTimer = undefined;
      }
      tryStartCommit();
    }
    function settle(): Promise<void> {
      if (dirtyEntries.size > 0 && !inFlight && !hasTerminalError()) {
        flushNow();
      }
      if (
        !inFlight &&
        commitTimer === undefined &&
        (dirtyEntries.size === 0 || hasTerminalError())
      ) {
        return Promise.resolve();
      }
      return new Promise<void>((input) => settleWaiters.push(input));
    }
    return {
      markDirty: markDirty,
      commit: commit,
      settle: settle,
      async dispose(): Promise<void> {
        flushNow();
        await settle();
        disposed = true;
        unsubscribeRemoteChange();
        unsubscribePeers?.();
        if (maxWaitTimer !== undefined) {
          timers.clearTimeout(maxWaitTimer);
          maxWaitTimer = undefined;
        }
        if (commitTimer !== undefined) {
          timers.clearTimeout(commitTimer);
          commitTimer = undefined;
        }
        if (retryTimer !== undefined) {
          timers.clearTimeout(retryTimer);
          retryTimer = undefined;
        }
        if (stashResumeTimer !== undefined) {
          timers.clearTimeout(stashResumeTimer);
          stashResumeTimer = undefined;
        }
        if (stashWriteTimer !== undefined) {
          timers.clearTimeout(stashWriteTimer);
          stashWriteTimer = undefined;
          writePendingStash();
        }
        wakeRetryWait?.();
      },
      counters: counters,
      state: getQueueState,
      conflicted: () => conflictedEntries,
      unsendable: () => unsendableReasons,
      resolveConflict(input, options2) {
        let entry = conflictedEntries.get(input);
        if (entry === undefined) {
          return;
        }
        if (options2 === "mine" && entry.unreadable === true) {
          return;
        }
        conflictedEntries.delete(input);
        if (options2 === "mine") {
          markDirty(input, () => entry.mine, entry.theirsSha);
        } else {
          clearSavedStash();
        }
      },
      pending: () =>
        dirtyEntries.size > 0 ||
        inFlight ||
        conflictedEntries.size > 0 ||
        unsendableReasons.size > 0,
      isOwnEcho: isOwnPublishEcho,
      solo: isSoloPacing,
      withdraw(input) {
        let value = dirtyEntries.delete(input),
          value2 = conflictedEntries.delete(input),
          value3 = unsendableReasons.delete(input);
        unsendableEntries.delete(input);
        if (value || value2) {
          withdrawnPaths.add(input);
        }
        if (dirtyEntries.size === 0) {
          firstDirtyAt = undefined;
          scheduleMaxWaitCommit();
        }
        if (value || value2 || value3) {
          notifyState();
        }
        clearStuckIfClean();
        clearSavedStash();
      },
      withdrawn: () => withdrawnPaths,
      retryNow() {
        if (disposed || dirtyEntries.size === 0) {
          return;
        }
        recentConflictTimes.clear();
        if (wakeRetryWait !== undefined) {
          if (!retryWaitProtected) {
            wakeRetryWait();
          }
          return;
        }
        if (inFlight) {
          return;
        }
        restartRetryWindow(currentRetryBudget(), true);
      },
      flushNow: flushNow,
      stashRestored() {
        if (options.stash !== undefined) {
          hasStashedEntries = true;
          clearOfferedStashOnSave = true;
        }
      },
      stashHandedOff() {
        if (options.stash === undefined) {
          return;
        }
        stashWritePaused = true;
        if (stashWriteTimer !== undefined) {
          timers.clearTimeout(stashWriteTimer);
          stashWriteTimer = undefined;
        }
        if (stashResumeTimer !== undefined) {
          timers.clearTimeout(stashResumeTimer);
        }
        stashResumeTimer = timers.setTimeout(() => {
          stashResumeTimer = undefined;
          if (!stashWritePaused || disposed) {
            return;
          }
          stashWritePaused = false;
          if (
            dirtyEntries.size > 0 ||
            conflictedEntries.size > 0 ||
            unsendableEntries.size > 0
          ) {
            writePendingStash();
          }
        }, FILE_SAVE_RETRY_MAX_MS);
        if (!hasStashedEntries) {
          return;
        }
        hasStashedEntries = false;
        let stash = options.stash,
          value = clearOfferedStashOnSave;
        clearOfferedStashOnSave = false;
        serializeStashWrite(async () => {
          await stash.clear();
          if (value) {
            await stash.clearOffered();
          }
        });
      },
    };
  }
  bindRuntimeValue(
    runtime,
    "FILE_SAVE_DEBOUNCE_POLICY",
    () => FILE_SAVE_DEBOUNCE_POLICY,
    (value) => {
      FILE_SAVE_DEBOUNCE_POLICY = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILE_SAVE_RETRY_MIN_MS",
    () => FILE_SAVE_RETRY_MIN_MS,
    (value) => {
      FILE_SAVE_RETRY_MIN_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILE_SAVE_RETRY_MAX_MS",
    () => FILE_SAVE_RETRY_MAX_MS,
    (value) => {
      FILE_SAVE_RETRY_MAX_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILE_SAVE_BACKPRESSURE_DELAY_MS",
    () => FILE_SAVE_BACKPRESSURE_DELAY_MS,
    (value) => {
      FILE_SAVE_BACKPRESSURE_DELAY_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILE_SAVE_STUCK_TIMEOUT_MS",
    () => FILE_SAVE_STUCK_TIMEOUT_MS,
    (value) => {
      FILE_SAVE_STUCK_TIMEOUT_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILE_SAVE_SHARED_ACTIVITY_TIMEOUT_MS",
    () => FILE_SAVE_SHARED_ACTIVITY_TIMEOUT_MS,
    (value) => {
      FILE_SAVE_SHARED_ACTIVITY_TIMEOUT_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILE_SAVE_QUICK_RETRY_MS",
    () => FILE_SAVE_QUICK_RETRY_MS,
    (value) => {
      FILE_SAVE_QUICK_RETRY_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILE_SAVE_LONG_REQUEST_MS",
    () => FILE_SAVE_LONG_REQUEST_MS,
    (value) => {
      FILE_SAVE_LONG_REQUEST_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILE_SAVE_CONFLICT_RETRY_MS",
    () => FILE_SAVE_CONFLICT_RETRY_MS,
    (value) => {
      FILE_SAVE_CONFLICT_RETRY_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILE_SAVE_MAX_TRANSIENT_RETRIES",
    () => FILE_SAVE_MAX_TRANSIENT_RETRIES,
    (value) => {
      FILE_SAVE_MAX_TRANSIENT_RETRIES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILE_SAVE_TOTAL_RETRY_WINDOW_MS",
    () => FILE_SAVE_TOTAL_RETRY_WINDOW_MS,
    (value) => {
      FILE_SAVE_TOTAL_RETRY_WINDOW_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILE_SAVE_RECENT_PEER_WINDOW_MS",
    () => FILE_SAVE_RECENT_PEER_WINDOW_MS,
    (value) => {
      FILE_SAVE_RECENT_PEER_WINDOW_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILE_SAVE_MAX_CONFLICT_PATHS",
    () => FILE_SAVE_MAX_CONFLICT_PATHS,
    (value) => {
      FILE_SAVE_MAX_CONFLICT_PATHS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILE_SAVE_RECENT_ACTIVITY_WINDOW_MS",
    () => FILE_SAVE_RECENT_ACTIVITY_WINDOW_MS,
    (value) => {
      FILE_SAVE_RECENT_ACTIVITY_WINDOW_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILE_SAVE_MAX_CONFLICT_RETRIES",
    () => FILE_SAVE_MAX_CONFLICT_RETRIES,
    (value) => {
      FILE_SAVE_MAX_CONFLICT_RETRIES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILE_SAVE_MAX_BATCH_CONFLICTS",
    () => FILE_SAVE_MAX_BATCH_CONFLICTS,
    (value) => {
      FILE_SAVE_MAX_BATCH_CONFLICTS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILE_SAVE_RETRY_JITTER_MS",
    () => FILE_SAVE_RETRY_JITTER_MS,
    (value) => {
      FILE_SAVE_RETRY_JITTER_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILE_SAVE_CONFLICT_BACKOFF_MS",
    () => FILE_SAVE_CONFLICT_BACKOFF_MS,
    (value) => {
      FILE_SAVE_CONFLICT_BACKOFF_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILE_SAVE_READ_RETRY_DELAYS_MS",
    () => FILE_SAVE_READ_RETRY_DELAYS_MS,
    (value) => {
      FILE_SAVE_READ_RETRY_DELAYS_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILE_SAVE_TERMINAL_ERROR_CODES",
    () => FILE_SAVE_TERMINAL_ERROR_CODES,
    (value) => {
      FILE_SAVE_TERMINAL_ERROR_CODES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isIndexFileSaveError",
    () => isIndexFileSaveError,
    (value) => {
      isIndexFileSaveError = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "defaultFilesSaveTimers",
    () => defaultFilesSaveTimers,
  );
  bindRuntimeValue(runtime, "createFilesSaveQueue", () => createFilesSaveQueue);
  return () => {
    FILE_SAVE_DEBOUNCE_POLICY = {
      solo: {
        gapMs: 1e4,
        maxWaitMs: 1e4,
      },
      shared: {
        gapMs: 0,
        maxWaitMs: 1500,
      },
      recentMs: 300000,
    };
    FILE_SAVE_RETRY_MIN_MS = 5000;
    FILE_SAVE_RETRY_MAX_MS = 15000;
    FILE_SAVE_BACKPRESSURE_DELAY_MS = 2000;
    FILE_SAVE_STUCK_TIMEOUT_MS = 30000;
    FILE_SAVE_SHARED_ACTIVITY_TIMEOUT_MS = 1e4;
    FILE_SAVE_QUICK_RETRY_MS = 200;
    FILE_SAVE_LONG_REQUEST_MS = 3000;
    FILE_SAVE_CONFLICT_RETRY_MS = 2000;
    FILE_SAVE_MAX_TRANSIENT_RETRIES = 3;
    FILE_SAVE_TOTAL_RETRY_WINDOW_MS = 60000;
    FILE_SAVE_RECENT_PEER_WINDOW_MS = 20000;
    FILE_SAVE_MAX_CONFLICT_PATHS = 20;
    FILE_SAVE_RECENT_ACTIVITY_WINDOW_MS = 300000;
    FILE_SAVE_MAX_CONFLICT_RETRIES = 4;
    FILE_SAVE_MAX_BATCH_CONFLICTS = 64;
    FILE_SAVE_RETRY_JITTER_MS = 1000;
    FILE_SAVE_CONFLICT_BACKOFF_MS = [300, 800];
    FILE_SAVE_READ_RETRY_DELAYS_MS = [150, 300, 600, 1000, 2000];
    FILE_SAVE_TERMINAL_ERROR_CODES = new Set([
      "not_writer",
      "not_declared",
      "capability_disabled",
      "too_large",
      "invalid_content",
      "read_only_path",
      "index_newer_build",
      "index_damaged",
    ]);
    isIndexFileSaveError = (input) =>
      input === "index_newer_build" || input === "index_damaged";
  };
}
