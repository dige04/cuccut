/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";
import type { FileSha } from "../deck-contracts";
import type {
  FileBytesRead,
  FilesVersion,
  WritableListingPort,
} from "./read-retries";

/** Why a hot update ended in a full restart (the `reason` of a `restart` event). */
export type HotRestartReason =
  | "fetch-exhausted"
  | "apply-failed"
  | "required"
  | "code"
  | "code-after-adopt"
  | "deferred-update";

/** Handle returned by the platform timer (a number in browsers, an object in Node). */
export type HotTimerHandle = ReturnType<typeof setTimeout>;

/** The timers `waitForHotUpdateIdle` waits with; tests inject fakes. */
export interface HotIdleTimers {
  setTimeout(callback: () => void, delay?: number): HotTimerHandle;
  clearTimeout?(handle: HotTimerHandle): void;
  now?(): number;
}

/** The timers the hot-update controller schedules with. */
export interface HotTimers extends HotIdleTimers {
  clearTimeout(handle: HotTimerHandle): void;
}

/** A version of the deck's files as the shell names it in a hot update. */
export interface HotListingRef {
  ver: string;
  seq?: number;
}

/** One path the shell reports as changed; `to` is the new content hash. */
export interface HotShellChange {
  path: string;
  kind: string;
  to?: string | null;
}

/** One row of a listing diff: `sha256` is null when the file is gone. */
export interface HotListingRow {
  path: string;
  sha256: string | null;
}

/** A hot update the shell hands to the accept handler. */
export interface HotUpdate {
  from: HotListingRef;
  to: HotListingRef;
  /** `"none"` when the update may be adopted in place. */
  required: string;
  /** The changed paths, or null when the shell sent no diff. */
  changed: HotShellChange[] | null;
  adopt?(): void;
  defer?(): void;
  restart?(): void;
}

/** What the accept handler answers the shell with. */
export type HotAcceptResult =
  | "applied"
  | "deferred"
  | "restart"
  | Promise<"applied">
  | undefined;

/** What the shell records about why it restarted this page. */
export interface HotRestartOrigin {
  /** The note the previous page passed to `restart`. */
  note?: string;
}

/** The `hot` capability the shell exposes on `slidesHost`. */
export interface HotCapability {
  /** Set when the shell restarted this page; absent on a plain load. */
  readonly from?: HotRestartOrigin | null;
  accept(handler: (update: HotUpdate) => HotAcceptResult): void;
  restart?(info?: { note: string }): void;
  /** Registers what to carry across a restart. */
  snapshot?(provider: (carried?: unknown) => unknown): void;
  /** Registers what to run once the restarted page is up. */
  ready?(handler: (carried?: unknown) => Promise<void> | undefined): void;
}

/** An update the early bridge queued while the editor was still booting. */
export interface HotQueuedUpdate {
  from: FilesVersion;
  to: FilesVersion;
  changed: HotShellChange[] | null;
  /** When the bridge accepted it (ms). */
  at: number;
}

/** What the controller hands the early bridge once the editor is up. */
export interface HotEarlyAttachment {
  snapshot?(carried?: unknown): unknown;
  restore?(carried?: unknown): void;
  reveal?: PromiseLike<unknown>;
  onEvent(event: HotUpdateEvent): void;
  onBeforeRestart(reason: string): void;
}

/** The hot-update listener that was registered at module start, before the editor existed. */
export interface HotEarlyBridge {
  readonly queued: HotQueuedUpdate[];
  attach?(attachment: HotEarlyAttachment): void;
  release(): void;
  takeOwed?(): { from: FilesVersion; to: FilesVersion } | undefined;
}

/** A listing diff handed to the port once an update is applied. */
export interface HotRemoteState {
  from: FilesVersion;
  to: FilesVersion;
  changed: HotListingRow[];
}

/** The part of the files port the hot-update controller uses. */
export interface HotFilesPort extends WritableListingPort {
  readBytes(path: string): Promise<FileBytesRead>;
  knownListing?(): Map<string, string>;
  olderThanMyWrite?(version: string, path: string): boolean;
  heldSha?(path: string): FileSha | undefined;
  liveSha?(path: string): string | null | undefined;
  noteIncoming?(rows: readonly HotListingRow[]): void;
  answersByReference?(path: string): boolean;
  primeRead?(path: string, read: FileBytesRead): void;
  noteAdopted?(to: FilesVersion, from?: FilesVersion): void;
  noteRemote?(state: HotRemoteState): void;
}

/** One changed path as the `update` event describes it. */
export interface HotChangedDescription {
  path: string;
  kind: string;
  /** Whether the path is the page's own code or deck content. */
  klass: "code" | "content";
}

/** The facts of an update, before the controller decides what to do with it. */
export interface HotUpdateRecord {
  type: "update";
  from: string;
  to: string;
  fromSeq?: number;
  toSeq?: number;
  required: string;
  shape: "calls" | "string";
  changed: HotChangedDescription[] | null;
  busy: boolean;
  /** Set by the early bridge for updates it took before the editor attached. */
  early?: boolean;
}

/** An update together with the decision made about it. */
export interface HotUpdateDecisionEvent extends HotUpdateRecord {
  decision: "restart" | "adopt" | "defer";
  why: string;
}

export interface HotDeferredEvent {
  type: "deferred";
  from: string;
  to: string;
  reason: "required" | "code";
}

export interface HotRestartEvent {
  type: "restart";
  from: string;
  to: string;
  reason: HotRestartReason;
  asked: boolean;
  error?: string;
}

export interface HotFetchEvent {
  type: "fetch";
  to: string;
  path: string;
  attempt: number;
  ok: boolean;
  status?: number;
  msAfterAdopt: number;
  redirectedTo?: string;
}

export interface HotPendingEvent {
  type: "pending";
  from: string;
  to: string;
  paths: string[];
  msAfterAdopt: number;
}

export interface HotAppliedEvent {
  type: "applied";
  from: string;
  to: string;
  rows: number;
  applied: number;
  fetched: number;
  skipped?: number;
  retries: number;
  grantLagMs?: number;
  ms: number;
  paths: string[];
  early?: boolean;
}

export interface HotRevealEvent {
  type: "reveal";
  heldMs: number;
  timedOut: boolean;
  carried: boolean;
}

/** Everything the controller reports through `onEvent`. */
export type HotUpdateEvent =
  | HotUpdateDecisionEvent
  | HotDeferredEvent
  | HotRestartEvent
  | HotFetchEvent
  | HotPendingEvent
  | HotAppliedEvent
  | HotRevealEvent;

/** Running totals of what the controller has done. */
export interface HotUpdateStats {
  updates: number;
  applied: number;
  deferred: number;
  restarts: number;
  fetchRetries: number;
  lastGrantLagMs?: number;
  maxGrantLagMs?: number;
}

export interface WaitForHotUpdateIdleOptions {
  timers?: HotIdleTimers;
  /** How long to hold the reveal at most (ms). */
  holdMs?: number;
  onEvent?: (event: HotRevealEvent) => void;
  /** Whether the page carries state over from before a restart. */
  carried?: boolean;
}

export interface FilesHotUpdateControllerOptions {
  /** The shell's hot capability; defaults to `slidesHost.hot`. */
  hot?: HotCapability | null;
  embedded?: boolean;
  port: HotFilesPort;
  /** Whether a path is the page's own code. */
  isCode?: (path: string) => boolean;
  retryMs?: readonly number[];
  timers?: HotTimers;
  isBusy?: () => boolean;
  busyPollMs?: number;
  contentWhileBusy?: boolean;
  snapshot?: (carried?: unknown) => unknown;
  restore?: (carried?: unknown) => void;
  reveal?: PromiseLike<unknown>;
  revealHoldMs?: number;
  /** Applies fetched rows to the open deck. */
  applyRemote: (
    state: HotRemoteState,
    entries: Map<string, FileBytesRead>,
  ) => unknown;
  onEvent?: (event: HotUpdateEvent) => void;
  onBeforeRestart?: (reason: string) => void;
  early?: HotEarlyBridge;
}

export interface FilesHotUpdateController {
  /** False when there is no hot capability (plain reloads). */
  readonly active: boolean;
  stats(): HotUpdateStats;
  /** The most recent events. */
  readonly events: HotUpdateEvent[];
  dispose(): void;
}

/** What a failed file read may carry: an HTTP status and a redirect target. */
interface HotFetchFailure {
  status?: unknown;
  redirectedTo?: unknown;
}

declare module "../bindings" {
  interface RuntimeBindings {
    /** Delays (ms) between attempts to re-read a file during boot. */
    BOOT_FILE_READ_RETRY_DELAYS_MS: number[];
    MAX_HOT_FETCH_RETRIES: number;
    HOT_UPDATE_MAX_DEFER_MS: number;
    HOT_RESTART_GRACE_MS: number;
    HOT_UPDATE_SETTLE_MS: number;
    HOT_INDEX_RECHECK_DELAY_MS: number;
    hotChangedPath: (source: HotShellChange) => string | null;
    shortHotErrorMessage: (input: unknown) => string;
    hotListingDescriptor: (input: HotListingRef) => FilesVersion;
    describeHotChangedPaths: (
      input: HotShellChange[] | null,
      isCode: (path: string) => boolean,
    ) => HotChangedDescription[] | null;
    hotAdoptMethodKind: (input: HotUpdate) => "calls" | "string";
    getHotCapability: () => HotCapability | null;
    waitForHotUpdateIdle: (
      reveal?: PromiseLike<unknown>,
      options?: WaitForHotUpdateIdleOptions,
    ) => Promise<void>;
    createFilesHotUpdateController: (
      options: FilesHotUpdateControllerOptions,
    ) => FilesHotUpdateController;
  }
}

export function installFilesHotUpdates(runtime: RuntimeBindings): () => void {
  var BOOT_FILE_READ_RETRY_DELAYS_MS: RuntimeBindings["BOOT_FILE_READ_RETRY_DELAYS_MS"];
  var MAX_HOT_FETCH_RETRIES: RuntimeBindings["MAX_HOT_FETCH_RETRIES"];
  var HOT_UPDATE_MAX_DEFER_MS: RuntimeBindings["HOT_UPDATE_MAX_DEFER_MS"];
  var HOT_RESTART_GRACE_MS: RuntimeBindings["HOT_RESTART_GRACE_MS"];
  var HOT_UPDATE_SETTLE_MS: RuntimeBindings["HOT_UPDATE_SETTLE_MS"];
  var hotChangedPath: RuntimeBindings["hotChangedPath"];
  var shortHotErrorMessage: RuntimeBindings["shortHotErrorMessage"];
  var hotListingDescriptor: RuntimeBindings["hotListingDescriptor"];
  var describeHotChangedPaths: RuntimeBindings["describeHotChangedPaths"];
  var hotAdoptMethodKind: RuntimeBindings["hotAdoptMethodKind"];
  var HOT_INDEX_RECHECK_DELAY_MS: RuntimeBindings["HOT_INDEX_RECHECK_DELAY_MS"];
  function getHotCapability(): HotCapability | null {
    let value: unknown = (0, runtime.getHostCapability)("hot");
    if (
      (typeof value === "object" || typeof value === "function") &&
      value !== null
    ) {
      return value as HotCapability;
    } else {
      return null;
    }
  }
  function waitForHotUpdateIdle(
    input?: PromiseLike<unknown>,
    options: WaitForHotUpdateIdleOptions = {},
  ): Promise<void> {
    let value: HotIdleTimers = options.timers ?? {
        setTimeout: (input2, options2) => setTimeout(input2, options2),
        clearTimeout: (input2) => clearTimeout(input2),
      },
      callback = (): number => value.now?.() ?? Date.now(),
      value2 = callback();
    return new Promise<void>((input2) => {
      let flag = false,
        callback2 = (input3: boolean): void => {
          if (flag) {
            return;
          }
          flag = true;
          if (!input3) {
            value.clearTimeout?.(value3);
          }
          try {
            options.onEvent?.({
              type: "reveal",
              heldMs: callback() - value2,
              timedOut: input3,
              carried: options.carried === true,
            });
          } catch {}
          input2();
        },
        value3: HotTimerHandle = value.setTimeout(
          () => callback2(true),
          options.holdMs ?? HOT_INDEX_RECHECK_DELAY_MS,
        );
      Promise.resolve(input).then(
        () => callback2(false),
        () => callback2(false),
      );
    });
  }
  function createFilesHotUpdateController(
    options: FilesHotUpdateControllerOptions,
  ): FilesHotUpdateController {
    let hot: HotCapability | null =
        options.hot !== undefined ? options.hot : getHotCapability(),
      counters: HotUpdateStats = {
        updates: 0,
        applied: 0,
        deferred: 0,
        restarts: 0,
        fetchRetries: 0,
      },
      cleanups: HotUpdateEvent[] = [];
    if (
      options.embedded === true ||
      hot === null ||
      typeof hot.accept !== "function"
    ) {
      return {
        dispose: (): void => {
          return;
        },
        active: false,
        stats: (): HotUpdateStats => ({
          ...counters,
        }),
        events: cleanups,
      };
    }
    let { port: port }: FilesHotUpdateControllerOptions = options,
      value: HotFilesPort = (0, runtime.normalizeFilesPort)(port),
      value2: (path: string) => boolean =
        options.isCode ?? runtime.isRuntimeInternalFilePath,
      value3: readonly number[] =
        options.retryMs ?? BOOT_FILE_READ_RETRY_DELAYS_MS,
      value4: HotTimers = options.timers ?? {
        setTimeout: (input, options2) => setTimeout(input, options2),
        clearTimeout: (input) => clearTimeout(input),
        now: () => Date.now(),
      },
      callback = (): number => value4.now?.() ?? Date.now(),
      flag = false,
      value5: HotTimerHandle | undefined,
      value6: string | undefined,
      items: number[] = [],
      value7: Map<string, string> | undefined;
    if (value.knownListing === undefined) {
      port.list().then(
        (input) => {
          value7 ??= new Map(
            input.map((input2): [string, string] => [
              input2.path,
              input2.sha256,
            ]),
          );
        },
        () => {
          return;
        },
      );
    }
    function value8(input: HotUpdateEvent): void {
      cleanups.push(input);
      if (cleanups.length > HOT_UPDATE_SETTLE_MS) {
        cleanups.shift();
      }
      try {
        if (options.onEvent) {
          options.onEvent(input);
        } else {
          globalThis.console?.debug?.("[hot]", JSON.stringify(input));
        }
      } catch {}
    }
    let callback2 = (input: string): void => {
      try {
        options.onBeforeRestart?.(input);
      } catch {}
    };
    function value9(input: string, options2: number = 0): void {
      value6 ??= input;
      if (value5 !== undefined || flag) {
        return;
      }
      let callback3 = (): void => {
        value5 = undefined;
        if (flag || value6 === undefined) {
          return;
        }
        if (options.isBusy?.() === true) {
          value5 = value4.setTimeout(callback3, options.busyPollMs ?? 250);
          return;
        }
        let value14 = callback();
        while (
          items.length > 0 &&
          value14 - items[0]! > HOT_UPDATE_MAX_DEFER_MS
        )
          items.shift();
        if (items.length >= HOT_RESTART_GRACE_MS) {
          value5 = value4.setTimeout(
            callback3,
            HOT_UPDATE_MAX_DEFER_MS - (value14 - items[0]!) + 1,
          );
          return;
        }
        items.push(value14);
        let value15: string = value6;
        value6 = undefined;
        counters.restarts += 1;
        callback2(value15);
        try {
          hot!.restart?.({
            note: value15,
          });
        } catch {}
      };
      value5 = value4.setTimeout(callback3, options2);
    }
    async function value10(): Promise<HotListingRow[]> {
      let entries: Map<string, string> = new Map(
          value.knownListing?.() ?? value7 ?? [],
        ),
        entries2: Map<string, string> = new Map(
          (await (0, runtime.listWritableFiles)(port)).map(
            (input): [string, string] => [input.path, input.sha256],
          ),
        );
      value7 = entries2;
      let items2: HotListingRow[] = [];
      for (let [value14, value15] of entries2)
        if (entries.get(value14) !== value15) {
          items2.push({
            path: value14,
            sha256: value15,
          });
        }
      for (let value14 of entries.keys())
        if (!entries2.has(value14)) {
          items2.push({
            path: value14,
            sha256: null,
          });
        }
      return items2.sort((input, options2) =>
        input.path < options2.path ? -1 : 1,
      );
    }
    function value11(
      input: HotUpdate,
    ): "deferred" | Promise<"applied"> | undefined {
      if (flag) {
        return void input.restart?.();
      }
      counters.updates += 1;
      let value14 = hotListingDescriptor(input.from),
        value15 = hotListingDescriptor(input.to),
        value16 = options.isBusy?.() === true,
        value17: "required" | "code" | undefined =
          input.required !== "none"
            ? "required"
            : input.changed !== null &&
                input.changed.some((input2) => value2(input2.path))
              ? "code"
              : undefined,
        state: HotUpdateRecord = {
          type: "update",
          from: value14.version,
          to: value15.version,
          ...(value14.seq !== undefined
            ? {
                fromSeq: value14.seq,
              }
            : {}),
          ...(value15.seq !== undefined
            ? {
                toSeq: value15.seq,
              }
            : {}),
          required: String(input.required),
          shape: hotAdoptMethodKind(input),
          changed: describeHotChangedPaths(input.changed, value2),
          busy: value16,
        };
      if (value17 !== undefined) {
        let value19: string =
            value17 === "code"
              ? "a changed path is the page’s own code: " +
                (input.changed ?? [])
                  .filter((input2) => value2(input2.path))
                  .map((input2) => input2.path)
                  .join(", ")
              : "required is " + String(input.required),
          value20: HotShellChange[] =
            value17 === "code" && input.changed !== null
              ? input.changed.filter((input2) => !value2(input2.path))
              : [];
        if (
          value16 &&
          options.contentWhileBusy !== false &&
          value20.length > 0 &&
          typeof input.adopt === "function"
        ) {
          try {
            input.adopt();
          } catch (value22: unknown) {
            value8({
              ...state,
              decision: "restart",
              why: "u.adopt() threw: " + shortHotErrorMessage(value22),
            });
            callback2("adopt failed");
            return void input.restart?.();
          }
          value8({
            ...state,
            decision: "adopt",
            why:
              value19 +
              "; the person is busy, so the " +
              String(value20.length) +
              " content row(s) are applied in place now and the restart waits",
          });
          value8({
            type: "deferred",
            from: value14.version,
            to: value15.version,
            reason: "code",
          });
          counters.deferred += 1;
          let value21 = callback();
          try {
            value.noteAdopted?.(value15, value14);
          } catch {}
          value9("deferred-update", options.busyPollMs ?? 250);
          return value12(value20, value14, value15, value21, false).catch(
            (input2: unknown): "applied" => {
              value8({
                type: "restart",
                from: value14.version,
                to: value15.version,
                reason: "apply-failed",
                asked: true,
                error: shortHotErrorMessage(input2),
              });
              value9("apply-failed");
              return "applied";
            },
          );
        }
        if (value16 && typeof input.defer === "function") {
          input.defer();
          counters.deferred += 1;
          value8({
            ...state,
            decision: "defer",
            why:
              value19 +
              "; the person is mid-gesture or typing, so the restart waits",
          });
          value8({
            type: "deferred",
            from: value14.version,
            to: value15.version,
            reason: value17,
          });
          value9("deferred-update", options.busyPollMs ?? 250);
          return "deferred";
        }
        counters.restarts += 1;
        value8({
          ...state,
          decision: "restart",
          why: value19,
        });
        value8({
          type: "restart",
          from: value14.version,
          to: value15.version,
          reason: value17,
          asked: true,
        });
        callback2(
          value17 === "code"
            ? "code changed"
            : "required: " + String(input.required),
        );
        return void input.restart?.();
      }
      try {
        input.adopt?.();
      } catch (value19: unknown) {
        value8({
          ...state,
          decision: "restart",
          why: "u.adopt() threw: " + shortHotErrorMessage(value19),
        });
        callback2("adopt failed");
        return void input.restart?.();
      }
      value8({
        ...state,
        decision: "adopt",
        why:
          input.changed === null
            ? "the shell sent no diff (changed: null); the listing is diffed after adopt"
            : "content only",
      });
      let value18 = callback();
      try {
        value.noteAdopted?.(value15, value14);
      } catch {}
      return value12(input.changed, value14, value15, value18, false).catch(
        (input2: unknown): "applied" => {
          value8({
            type: "restart",
            from: value14.version,
            to: value15.version,
            reason: "apply-failed",
            asked: true,
            error: shortHotErrorMessage(input2),
          });
          value9("apply-failed");
          return "applied";
        },
      );
    }
    async function value12(
      input: HotShellChange[] | null,
      options2: FilesVersion,
      context: FilesVersion,
      value14: number,
      extra: boolean,
    ): Promise<"applied"> {
      let index = 0,
        flag2 = false,
        callback3 = (input2: HotRestartReason, options3?: unknown): "applied" => {
          value8({
            type: "restart",
            from: options2.version,
            to: context.version,
            reason: input2,
            asked: true,
            ...(options3 !== undefined
              ? {
                  error: shortHotErrorMessage(options3),
                }
              : {}),
          });
          value9(input2);
          return "applied";
        },
        callback4 = (input2: HotFetchFailure | null | undefined) => {
          let value22 = input2?.status;
          if (typeof value22 === "number") {
            return value22;
          } else {
            return undefined;
          }
        },
        callback5 = <T>(
          input2: string,
          options3: () => Promise<T>,
        ): Promise<T> => {
          let index2 = 0;
          return (0, runtime.retryFileRead)(
            () => {
              index2 += 1;
              return options3();
            },
            value4,
            (input3, options4) => {
              index += 1;
              counters.fetchRetries += 1;
              let value22 = callback4(
                  options4 as HotFetchFailure | null | undefined,
                ),
                value23 = (options4 as HotFetchFailure | null | undefined)
                  ?.redirectedTo;
              value8({
                type: "fetch",
                to: context.version,
                path: input2,
                attempt: input3,
                ok: false,
                ...(value22 !== undefined
                  ? {
                      status: value22,
                    }
                  : {}),
                msAfterAdopt: callback() - value14,
                ...(typeof value23 === "string"
                  ? {
                      redirectedTo: value23,
                    }
                  : {}),
              });
              if (input3 >= MAX_HOT_FETCH_RETRIES && !flag2) {
                flag2 = true;
                value8({
                  type: "pending",
                  from: options2.version,
                  to: context.version,
                  paths: [input2],
                  msAfterAdopt: callback() - value14,
                });
              }
            },
            value3,
          ).then((input3) => {
            value8({
              type: "fetch",
              to: context.version,
              path: input2,
              attempt: index2,
              ok: true,
              msAfterAdopt: callback() - value14,
            });
            return input3;
          });
        },
        value15: HotListingRow[];
      try {
        value15 =
          input === null
            ? await callback5("_files.json", value10)
            : input.map(
                (input2): HotListingRow => ({
                  path: input2.path,
                  sha256: hotChangedPath(input2),
                }),
              );
      } catch (value22: unknown) {
        return callback3("fetch-exhausted", value22);
      }
      if (input === null && value15.some((input2) => value2(input2.path))) {
        if (
          options.contentWhileBusy !== false &&
          options.isBusy?.() === true &&
          value15.some((input2) => !value2(input2.path))
        ) {
          value8({
            type: "restart",
            from: options2.version,
            to: context.version,
            reason: "code-after-adopt",
            asked: true,
          });
          value9("code-after-adopt");
          value15 = value15.filter((input2) => !value2(input2.path));
        } else {
          return callback3("code-after-adopt");
        }
      }
      if (value7 !== undefined && input !== null) {
        for (let value22 of value15)
          if (value22.sha256 === null) {
            value7.delete(value22.path);
          } else {
            value7.set(value22.path, value22.sha256);
          }
      }
      value15 = value15.filter(
        (input2) =>
          value.olderThanMyWrite?.(context.version, input2.path) !== true,
      );
      let value16: HotListingRow[] = extra
        ? value15.slice()
        : value15.filter((input2) => {
            let value22 = value.heldSha?.(input2.path);
            if (value22 === undefined || value22 !== input2.sha256) {
              return true;
            }
            let value23 = value.liveSha?.(input2.path);
            return value23 !== undefined && value23 !== input2.sha256;
          });
      try {
        value.noteIncoming?.(value15);
      } catch {}
      let callback6 = (input2: string): boolean => {
          try {
            return value.answersByReference?.(input2) === true;
          } catch {
            return false;
          }
        },
        value17 = value16.filter((input2) => input2.sha256 !== null),
        value18 = value17.filter((input2) => !callback6(input2.path)),
        entries = new Map<string, FileBytesRead>(),
        value19: number | undefined,
        value20: unknown;
      if (value18.length === 0 && value17.length > 0 && input !== null) {
        try {
          await callback5("_files.json", () =>
            (0, runtime.listWritableFiles)(port),
          );
          value19 = callback() - value14;
        } catch (value22: unknown) {
          return callback3("fetch-exhausted", value22);
        }
      }
      let value21: boolean[] = await Promise.all(
        value18.map((input2) =>
          callback5(input2.path, () => port.readBytes(input2.path)).then(
            (input3) => {
              value19 ??= callback() - value14;
              let state2: FileBytesRead = {
                ...input3,
                sha256: input2.sha256 ?? input3.sha256,
              };
              entries.set(input2.path, state2);
              try {
                value.primeRead?.(input2.path, state2);
              } catch {}
              return true;
            },
            (input3: unknown) => {
              value20 = input3;
              return false;
            },
          ),
        ),
      );
      if (value19 !== undefined) {
        counters.lastGrantLagMs = value19;
        counters.maxGrantLagMs = Math.max(counters.maxGrantLagMs ?? 0, value19);
      }
      if (value21.includes(false)) {
        return callback3("fetch-exhausted", value20);
      }
      let state: HotRemoteState = {
        from: options2,
        to: context,
        changed: value16,
      };
      try {
        if (value16.length > 0) {
          await options.applyRemote(state, entries);
        }
      } catch (value22: unknown) {
        return callback3("apply-failed", value22);
      }
      try {
        value.noteRemote?.(state);
      } catch {}
      counters.applied += 1;
      value8({
        type: "applied",
        from: options2.version,
        to: context.version,
        rows: value15.length,
        applied: value16.length,
        fetched: entries.size,
        ...(value17.length > value18.length
          ? {
              skipped: value17.length - value18.length,
            }
          : {}),
        retries: index,
        ...(value19 !== undefined
          ? {
              grantLagMs: value19,
            }
          : {}),
        ms: callback() - value14,
        paths: value16.map((input2) => input2.path),
        ...(extra
          ? {
              early: true,
            }
          : {}),
      });
      return "applied";
    }
    let value13: HotEarlyBridge | undefined =
      options.early ?? (0, runtime.currentHotReloadBridge)(hot);
    if (options.snapshot !== undefined && typeof hot.snapshot === "function") {
      hot.snapshot((input) => (flag ? undefined : options.snapshot!(input)));
    }
    if (
      value13?.attach === undefined &&
      (options.restore !== undefined || options.reveal !== undefined) &&
      typeof hot.ready === "function"
    ) {
      hot.ready((input) => {
        if (flag) {
          return;
        }
        try {
          options.restore?.(input);
        } catch {}
        if (options.reveal === undefined) {
          return undefined;
        } else {
          return waitForHotUpdateIdle(options.reveal, {
            holdMs: options.revealHoldMs,
            timers: value4,
            carried: input !== undefined && input !== null,
            onEvent: value8,
          });
        }
      });
    }
    hot.accept(value11);
    if (value13 !== undefined) {
      value13.attach?.({
        ...(options.snapshot !== undefined
          ? {
              snapshot: (input?: unknown): unknown =>
                flag ? undefined : options.snapshot!(input),
            }
          : {}),
        ...(options.restore !== undefined
          ? {
              restore: (input?: unknown): void => {
                if (!flag) {
                  options.restore!(input);
                }
              },
            }
          : {}),
        ...(options.reveal !== undefined
          ? {
              reveal: options.reveal,
            }
          : {}),
        onEvent: value8,
        onBeforeRestart: callback2,
      });
      value13.release();
      let value14 = value13.takeOwed?.();
      if (value14 !== undefined) {
        value8({
          type: "restart",
          from: value14.from.version,
          to: value14.to.version,
          reason: "deferred-update",
          asked: true,
        });
        value9("deferred-update", options.busyPollMs ?? 250);
      }
      let value15 = value13.queued.splice(0);
      if (value15.length > 0) {
        let value16 = value15.some((input) => input.changed === null),
          entries = new Map<string, HotShellChange>();
        if (!value16) {
          for (let value19 of value15)
            for (let value20 of value19.changed!)
              entries.set(value20.path, value20);
        }
        let value17 = value15[0]!,
          value18 = value15[value15.length - 1]!;
        counters.updates += value15.length;
        try {
          value.noteAdopted?.(value18.to, value17.from);
        } catch {}
        value12(
          value16 ? null : [...entries.values()],
          value17.from,
          value18.to,
          value17.at,
          true,
        ).catch((input: unknown) => {
          value8({
            type: "restart",
            from: value17.from.version,
            to: value18.to.version,
            reason: "apply-failed",
            asked: true,
            error: shortHotErrorMessage(input),
          });
          value9("apply-failed");
        });
      }
    }
    return {
      get active(): boolean {
        return !flag;
      },
      stats: (): HotUpdateStats => ({
        ...counters,
      }),
      events: cleanups,
      dispose(): void {
        flag = true;
        if (value5 !== undefined) {
          value4.clearTimeout(value5);
          value5 = undefined;
        }
      },
    };
  }
  bindRuntimeValue(
    runtime,
    "BOOT_FILE_READ_RETRY_DELAYS_MS",
    () => BOOT_FILE_READ_RETRY_DELAYS_MS,
    (value) => {
      BOOT_FILE_READ_RETRY_DELAYS_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_HOT_FETCH_RETRIES",
    () => MAX_HOT_FETCH_RETRIES,
    (value) => {
      MAX_HOT_FETCH_RETRIES = value;
    },
  );
  bindRuntimeValue(runtime, "getHotCapability", () => getHotCapability);
  bindRuntimeValue(
    runtime,
    "HOT_UPDATE_MAX_DEFER_MS",
    () => HOT_UPDATE_MAX_DEFER_MS,
    (value) => {
      HOT_UPDATE_MAX_DEFER_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "HOT_RESTART_GRACE_MS",
    () => HOT_RESTART_GRACE_MS,
    (value) => {
      HOT_RESTART_GRACE_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "HOT_UPDATE_SETTLE_MS",
    () => HOT_UPDATE_SETTLE_MS,
    (value) => {
      HOT_UPDATE_SETTLE_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "hotChangedPath",
    () => hotChangedPath,
    (value) => {
      hotChangedPath = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "shortHotErrorMessage",
    () => shortHotErrorMessage,
    (value) => {
      shortHotErrorMessage = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "hotListingDescriptor",
    () => hotListingDescriptor,
    (value) => {
      hotListingDescriptor = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "describeHotChangedPaths",
    () => describeHotChangedPaths,
    (value) => {
      describeHotChangedPaths = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "hotAdoptMethodKind",
    () => hotAdoptMethodKind,
    (value) => {
      hotAdoptMethodKind = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "HOT_INDEX_RECHECK_DELAY_MS",
    () => HOT_INDEX_RECHECK_DELAY_MS,
    (value) => {
      HOT_INDEX_RECHECK_DELAY_MS = value;
    },
  );
  bindRuntimeValue(runtime, "waitForHotUpdateIdle", () => waitForHotUpdateIdle);
  bindRuntimeValue(
    runtime,
    "createFilesHotUpdateController",
    () => createFilesHotUpdateController,
  );
  return () => {
    BOOT_FILE_READ_RETRY_DELAYS_MS = [
      150, 300, 600, 1000, 2000, 2000, 2000, 2000, 2000, 2000, 2000, 2000,
    ];
    MAX_HOT_FETCH_RETRIES = 4;
    HOT_UPDATE_MAX_DEFER_MS = 60000;
    HOT_RESTART_GRACE_MS = 1;
    HOT_UPDATE_SETTLE_MS = 50;
    hotChangedPath = (source) =>
      source.kind === "removed"
        ? null
        : typeof source.to === "string"
          ? source.to
          : null;
    shortHotErrorMessage = (input) =>
      (input instanceof Error
        ? input.message
        : String(
            (input as { message?: unknown } | null | undefined)?.message ??
              input,
          )
      ).slice(0, 120);
    hotListingDescriptor = (input) => ({
      version: input.ver,
      ...(input.seq !== undefined
        ? {
            seq: input.seq,
          }
        : {}),
    });
    describeHotChangedPaths = (input, options) =>
      input === null
        ? null
        : input.map(
            (source): HotChangedDescription => ({
              path: source.path,
              kind: String(source.kind),
              klass: options(source.path) ? "code" : "content",
            }),
          );
    hotAdoptMethodKind = (input) =>
      typeof input.adopt === "function" ? "calls" : "string";
    HOT_INDEX_RECHECK_DELAY_MS = 4500;
  };
}
