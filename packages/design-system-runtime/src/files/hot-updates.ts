/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
import type {
  FilesHotOptions,
  FilesHotController,
  FilesHotStats,
  FilesHotEvent,
  FilesHotChange,
  HotIdleOptions,
  FileRetryError,
  FilesHotCapability,
} from "../contracts/files-core";
import type * as Files from "../contracts";
import type * as Host from "../contracts/platform-host";
export function installFilesHotUpdates(runtime: RuntimeBindings): () => void {
  var BOOT_FILE_READ_RETRY_DELAYS_MS: number[];
  var MAX_HOT_FETCH_RETRIES: number;
  var getHotWindowName: () => string;
  var HOT_UPDATE_MAX_DEFER_MS: number;
  var HOT_RESTARTS_PER_WINDOW: number;
  var HOT_EVENT_HISTORY_LIMIT: number;
  var hotChangedPathSha: (change: FilesHotChange) => string | null;
  var shortHotErrorMessage: (error: unknown) => string;
  var hotListingDescriptor: (version: Host.HotVersion) => Files.FileVersion;
  var describeHotChangedPaths: (
    changes: Host.HotFileChange[] | null,
    isCode: (path: string) => boolean,
  ) => { path: string; kind: string; klass: string }[] | null;
  var hotAdoptMethodKind: (update: Host.HotUpdate) => string;
  var HOT_INDEX_RECHECK_DELAY_MS: number;
  function getHotCapability(): FilesHotCapability | null {
    let value = (0, runtime.getClaudeCapability)("hot");
    if (
      (typeof value === "object" || typeof value === "function") &&
      value !== null
    ) {
      return value as FilesHotCapability;
    } else {
      return null;
    }
  }
  function hasHotRestartKey(windowName: string = getHotWindowName()) {
    try {
      let value: unknown = JSON.parse(windowName)?.hot?.k;
      return typeof value === "string" && value !== "";
    } catch {
      return false;
    }
  }
  function canRestartArtifact(
    hot: FilesHotCapability | null = getHotCapability(),
    windowName?: string,
  ) {
    return typeof hot?.restart === "function" && hasHotRestartKey(windowName);
  }
  function waitForHotUpdateIdle(
    input: PromiseLike<unknown> | unknown,
    options: HotIdleOptions = {},
  ) {
    let value = options.timers ?? {
        setTimeout: (input2: () => void, options2: number) =>
          setTimeout(input2, options2),
        clearTimeout: (input2: ReturnType<typeof setTimeout>) =>
          clearTimeout(input2),
      },
      callback = () => value.now?.() ?? Date.now(),
      value2 = callback();
    return new Promise<void>((input2): void => {
      let flag: boolean = false,
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
        value3 = value.setTimeout(
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
    options: FilesHotOptions,
  ): FilesHotController {
    let hot: FilesHotCapability | null =
        options.hot !== undefined ? options.hot : getHotCapability(),
      counters: FilesHotStats = {
        updates: 0,
        applied: 0,
        deferred: 0,
        restarts: 0,
        fetchRetries: 0,
      },
      events: FilesHotEvent[] = [];
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
        stats: () => ({
          ...counters,
        }),
        events: events,
      };
    }
    let { port: port } = options,
      portExtensions = (0, runtime.filesPortExtensions)(port),
      isCodePath = options.isCode ?? runtime.isRuntimeInternalFilePath,
      retryDelays = options.retryMs ?? BOOT_FILE_READ_RETRY_DELAYS_MS,
      timers = options.timers ?? {
        setTimeout: (input: () => void, options2: number) =>
          setTimeout(input, options2),
        clearTimeout: (input: ReturnType<typeof setTimeout>) =>
          clearTimeout(input),
        now: (): number => Date.now(),
      },
      now = () => timers.now?.() ?? Date.now(),
      disposed: boolean = false,
      restartTimer: ReturnType<typeof setTimeout> | undefined,
      restartNote: string | undefined,
      recentRestartTimes: number[] = [],
      fallbackListing: Map<string, string> | undefined;
    if (portExtensions.knownListing === undefined) {
      port.list().then(
        (input): void => {
          fallbackListing ??= new Map(
            input.map((input2) => [input2.path, input2.sha256]),
          );
        },
        (): void => {
          return;
        },
      );
    }
    function emitEvent(input: FilesHotEvent): void {
      events.push(input);
      if (events.length > HOT_EVENT_HISTORY_LIMIT) {
        events.shift();
      }
      try {
        if (options.onEvent) {
          options.onEvent(input);
        } else {
          globalThis.console?.debug?.("[hot]", JSON.stringify(input));
        }
      } catch {}
    }
    let beforeRestart = (input: string): void => {
      try {
        options.onBeforeRestart?.(input);
      } catch {}
    };
    function scheduleRestart(input: string, options2: number = 0): void {
      restartNote ??= input;
      if (restartTimer !== undefined || disposed) {
        return;
      }
      let callback = (): void => {
        restartTimer = undefined;
        if (disposed || restartNote === undefined) {
          return;
        }
        if (options.isBusy?.() === true) {
          restartTimer = timers.setTimeout(callback, options.busyPollMs ?? 250);
          return;
        }
        let value = now();
        while (
          recentRestartTimes.length > 0 &&
          value - recentRestartTimes[0] > HOT_UPDATE_MAX_DEFER_MS
        ) {
          recentRestartTimes.shift();
        }
        if (recentRestartTimes.length >= HOT_RESTARTS_PER_WINDOW) {
          restartTimer = timers.setTimeout(
            callback,
            HOT_UPDATE_MAX_DEFER_MS - (value - recentRestartTimes[0]) + 1,
          );
          return;
        }
        recentRestartTimes.push(value);
        let value2 = restartNote;
        restartNote = undefined;
        counters.restarts += 1;
        beforeRestart(value2);
        try {
          hot!.restart?.({
            note: value2,
          });
        } catch {}
      };
      restartTimer = timers.setTimeout(callback, options2);
    }
    async function diffListing(): Promise<Files.ChangedFileRow[]> {
      let entries = new Map(
          portExtensions.knownListing?.() ?? fallbackListing ?? [],
        ),
        entries2 = new Map(
          (await (0, runtime.listWritableFiles)(port)).map((input) => [
            input.path,
            input.sha256,
          ]),
        );
      fallbackListing = entries2;
      let items: Files.ChangedFileRow[] = [];
      for (let [value, value2] of entries2) {
        if (entries.get(value) !== value2) {
          items.push({
            path: value,
            sha256: value2,
          });
        }
      }
      for (let value of entries.keys()) {
        if (!entries2.has(value)) {
          items.push({
            path: value,
            sha256: null,
          });
        }
      }
      return items.sort((input, options2): number =>
        input.path < options2.path ? -1 : 1,
      );
    }
    function acceptUpdate(
      input: Host.HotUpdate,
    ): void | "deferred" | Promise<"applied"> {
      if (disposed) {
        return void input.restart?.();
      }
      counters.updates += 1;
      let value = hotListingDescriptor(input.from),
        value2 = hotListingDescriptor(input.to),
        value3: boolean = options.isBusy?.() === true,
        value4: string | string | undefined =
          input.required !== "none"
            ? "required"
            : input.changed !== null &&
                input.changed.some((input2) => isCodePath(input2.path))
              ? "code"
              : undefined,
        state: FilesHotEvent = {
          type: "update",
          from: value.version,
          to: value2.version,
          ...(value.seq !== undefined
            ? {
                fromSeq: value.seq,
              }
            : {}),
          ...(value2.seq !== undefined
            ? {
                toSeq: value2.seq,
              }
            : {}),
          required: String(input.required),
          shape: hotAdoptMethodKind(input),
          changed: describeHotChangedPaths(input.changed, isCodePath),
          busy: value3,
        };
      if (value4 !== undefined) {
        let value6: string =
            value4 === "code"
              ? "a changed path is the page’s own code: " +
                (input.changed ?? [])
                  .filter((input2) => isCodePath(input2.path))
                  .map((input2) => input2.path)
                  .join(", ")
              : "required is " + String(input.required),
          value7 =
            value4 === "code" && input.changed !== null
              ? input.changed.filter(
                  (input2): boolean => !isCodePath(input2.path),
                )
              : [];
        if (
          value3 &&
          options.contentWhileBusy !== false &&
          value7.length > 0 &&
          typeof input.adopt === "function"
        ) {
          try {
            input.adopt();
          } catch (value9: unknown) {
            emitEvent({
              ...state,
              decision: "restart",
              why: "u.adopt() threw: " + shortHotErrorMessage(value9),
            });
            beforeRestart("adopt failed");
            return void input.restart?.();
          }
          emitEvent({
            ...state,
            decision: "adopt",
            why:
              value6 +
              "; the person is busy, so the " +
              String(value7.length) +
              " content row(s) are applied in place now and the restart waits",
          });
          emitEvent({
            type: "deferred",
            from: value.version,
            to: value2.version,
            reason: "code",
          });
          counters.deferred += 1;
          let value8 = now();
          try {
            portExtensions.noteAdopted?.(value2, value);
          } catch {}
          scheduleRestart("deferred-update", options.busyPollMs ?? 250);
          return applyUpdateRows(value7, value, value2, value8, false).catch(
            (input2: unknown): "applied" => {
              emitEvent({
                type: "restart",
                from: value.version,
                to: value2.version,
                reason: "apply-failed",
                asked: true,
                error: shortHotErrorMessage(input2),
              });
              scheduleRestart("apply-failed");
              return "applied";
            },
          );
        }
        if (value3 && typeof input.defer === "function") {
          input.defer();
          counters.deferred += 1;
          emitEvent({
            ...state,
            decision: "defer",
            why:
              value6 +
              "; the person is mid-gesture or typing, so the restart waits",
          });
          emitEvent({
            type: "deferred",
            from: value.version,
            to: value2.version,
            reason: value4,
          });
          scheduleRestart("deferred-update", options.busyPollMs ?? 250);
          return "deferred";
        }
        counters.restarts += 1;
        emitEvent({
          ...state,
          decision: "restart",
          why: value6,
        });
        emitEvent({
          type: "restart",
          from: value.version,
          to: value2.version,
          reason: value4,
          asked: true,
        });
        beforeRestart(
          value4 === "code"
            ? "code changed"
            : "required: " + String(input.required),
        );
        return void input.restart?.();
      }
      try {
        input.adopt?.();
      } catch (value6: unknown) {
        emitEvent({
          ...state,
          decision: "restart",
          why: "u.adopt() threw: " + shortHotErrorMessage(value6),
        });
        beforeRestart("adopt failed");
        return void input.restart?.();
      }
      emitEvent({
        ...state,
        decision: "adopt",
        why:
          input.changed === null
            ? "the shell sent no diff (changed: null); the listing is diffed after adopt"
            : "content only",
      });
      let value5 = now();
      try {
        portExtensions.noteAdopted?.(value2, value);
      } catch {}
      return applyUpdateRows(input.changed, value, value2, value5, false).catch(
        (input2: unknown): "applied" => {
          emitEvent({
            type: "restart",
            from: value.version,
            to: value2.version,
            reason: "apply-failed",
            asked: true,
            error: shortHotErrorMessage(input2),
          });
          scheduleRestart("apply-failed");
          return "applied";
        },
      );
    }
    async function applyUpdateRows(
      input: Host.HotFileChange[] | null,
      options2: Files.FileVersion,
      context: Files.FileVersion,
      value: number,
      extra: boolean,
    ): Promise<"applied"> {
      let index = 0,
        flag: boolean = false,
        callback = (input2: string, options3?: unknown): "applied" => {
          emitEvent({
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
          scheduleRestart(input2);
          return "applied";
        },
        callback2 = (input2: unknown) => {
          let value9: unknown = (input2 as FileRetryError | null)?.status;
          if (typeof value9 === "number") {
            return value9;
          } else {
            return undefined;
          }
        },
        callback3 = <Result>(
          input2: string,
          options3: () => Promise<Result>,
        ): Promise<Result> => {
          let index2 = 0;
          return (0, runtime.retryFileRead)(
            () => {
              index2 += 1;
              return options3();
            },
            timers,
            (input3, options4): void => {
              index += 1;
              counters.fetchRetries += 1;
              let value9 = callback2(options4),
                value10: unknown = (
                  options4 as
                    | (FileRetryError & { redirectedTo?: unknown })
                    | null
                )?.redirectedTo;
              emitEvent({
                type: "fetch",
                to: context.version,
                path: input2,
                attempt: input3,
                ok: false,
                ...(value9 !== undefined
                  ? {
                      status: value9,
                    }
                  : {}),
                msAfterAdopt: now() - value,
                ...(typeof value10 === "string"
                  ? {
                      redirectedTo: value10,
                    }
                  : {}),
              });
              if (input3 >= MAX_HOT_FETCH_RETRIES && !flag) {
                flag = true;
                emitEvent({
                  type: "pending",
                  from: options2.version,
                  to: context.version,
                  paths: [input2],
                  msAfterAdopt: now() - value,
                });
              }
            },
            retryDelays,
          ).then((input3) => {
            emitEvent({
              type: "fetch",
              to: context.version,
              path: input2,
              attempt: index2,
              ok: true,
              msAfterAdopt: now() - value,
            });
            return input3;
          });
        },
        value2: Files.ChangedFileRow[];
      try {
        value2 =
          input === null
            ? await callback3("_files.json", diffListing)
            : input.map((input2) => ({
                path: input2.path,
                sha256: hotChangedPathSha(input2),
              }));
      } catch (value9: unknown) {
        return callback("fetch-exhausted", value9);
      }
      if (input === null && value2.some((input2) => isCodePath(input2.path))) {
        if (
          options.contentWhileBusy !== false &&
          options.isBusy?.() === true &&
          value2.some((input2): boolean => !isCodePath(input2.path))
        ) {
          emitEvent({
            type: "restart",
            from: options2.version,
            to: context.version,
            reason: "code-after-adopt",
            asked: true,
          });
          scheduleRestart("code-after-adopt");
          value2 = value2.filter((input2): boolean => !isCodePath(input2.path));
        } else {
          return callback("code-after-adopt");
        }
      }
      if (fallbackListing !== undefined && input !== null) {
        for (let value9 of value2) {
          if (value9.sha256 === null) {
            fallbackListing.delete(value9.path);
          } else {
            fallbackListing.set(value9.path, value9.sha256);
          }
        }
      }
      value2 = value2.filter(
        (input2): boolean =>
          portExtensions.olderThanMyWrite?.(context.version, input2.path) !==
          true,
      );
      let value3 = extra
        ? value2.slice()
        : value2.filter((input2) => {
            let value9 = portExtensions.heldSha?.(input2.path);
            if (value9 === undefined || value9 !== input2.sha256) {
              return true;
            }
            let value10 = portExtensions.liveSha?.(input2.path);
            return value10 !== undefined && value10 !== input2.sha256;
          });
      try {
        portExtensions.noteIncoming?.(value2);
      } catch {}
      let callback4 = (input2: string): boolean | undefined => {
          try {
            return portExtensions.answersByReference?.(input2) === true;
          } catch {
            return false;
          }
        },
        value4 = value3.filter((input2): boolean => input2.sha256 !== null),
        value5 = value4.filter((input2): boolean => !callback4(input2.path)),
        entries: Map<string, Files.FileBytesRead> = new Map(),
        value6: number | undefined,
        value7: unknown;
      if (value5.length === 0 && value4.length > 0 && input !== null) {
        try {
          await callback3("_files.json", () =>
            (0, runtime.listWritableFiles)(port),
          );
          value6 = now() - value;
        } catch (value9: unknown) {
          return callback("fetch-exhausted", value9);
        }
      }
      let value8 = await Promise.all(
        value5.map((input2) =>
          callback3<Files.FileBytesRead>(input2.path, () =>
            port.readBytes(input2.path),
          ).then(
            (input3): boolean => {
              value6 ??= now() - value;
              let state2 = {
                ...input3,
                sha256: input2.sha256 ?? input3.sha256,
              };
              entries.set(input2.path, state2);
              try {
                portExtensions.primeRead?.(input2.path, state2);
              } catch {}
              return true;
            },
            (input3: unknown): boolean => {
              value7 = input3;
              return false;
            },
          ),
        ),
      );
      if (value6 !== undefined) {
        counters.lastGrantLagMs = value6;
        counters.maxGrantLagMs = Math.max(counters.maxGrantLagMs ?? 0, value6);
      }
      if (value8.includes(false)) {
        return callback("fetch-exhausted", value7);
      }
      let state: Files.FileRemoteChange = {
        from: options2,
        to: context,
        changed: value3,
      };
      try {
        if (value3.length > 0) {
          await options.applyRemote(state, entries);
        }
      } catch (value9: unknown) {
        return callback("apply-failed", value9);
      }
      try {
        portExtensions.noteRemote?.(state);
      } catch {}
      counters.applied += 1;
      emitEvent({
        type: "applied",
        from: options2.version,
        to: context.version,
        rows: value2.length,
        applied: value3.length,
        fetched: entries.size,
        ...(value4.length > value5.length
          ? {
              skipped: value4.length - value5.length,
            }
          : {}),
        retries: index,
        ...(value6 !== undefined
          ? {
              grantLagMs: value6,
            }
          : {}),
        ms: now() - value,
        paths: value3.map((input2) => input2.path),
        ...(extra
          ? {
              early: true,
            }
          : {}),
      });
      return "applied";
    }
    let earlyUpdates =
      options.early ?? (0, runtime.currentHotReloadBridge)(hot);
    if (options.snapshot !== undefined && typeof hot.snapshot === "function") {
      hot.snapshot((input: unknown) =>
        disposed ? undefined : options.snapshot!(input),
      );
    }
    if (
      earlyUpdates?.attach === undefined &&
      (options.restore !== undefined || options.reveal !== undefined) &&
      typeof hot.ready === "function"
    ) {
      hot.ready((input: unknown) => {
        if (disposed) {
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
            timers: timers,
            carried: input !== undefined && input !== null,
            onEvent: emitEvent,
          });
        }
      });
    }
    hot.accept(acceptUpdate);
    if (earlyUpdates !== undefined) {
      earlyUpdates.attach?.({
        ...(options.snapshot !== undefined
          ? {
              snapshot: (input: unknown) =>
                disposed ? undefined : options.snapshot!(input),
            }
          : {}),
        ...(options.restore !== undefined
          ? {
              restore: (input: unknown): void => {
                if (!disposed) {
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
        onEvent: emitEvent,
        onBeforeRestart: beforeRestart,
      });
      earlyUpdates.release();
      let value = earlyUpdates.takeOwed?.();
      if (value !== undefined) {
        emitEvent({
          type: "restart",
          from: value.from.version,
          to: value.to.version,
          reason: "deferred-update",
          asked: true,
        });
        scheduleRestart("deferred-update", options.busyPollMs ?? 250);
      }
      let value2 = earlyUpdates.queued.splice(0);
      if (value2.length > 0) {
        let value3 = value2.some((input): boolean => input.changed === null),
          entries: Map<string, Host.HotFileChange> = new Map();
        if (!value3) {
          for (let value6 of value2) {
            for (let value7 of value6.changed!) {
              entries.set(value7.path, value7);
            }
          }
        }
        let value4 = value2[0],
          value5 = value2[value2.length - 1];
        counters.updates += value2.length;
        try {
          portExtensions.noteAdopted?.(value5.to, value4.from);
        } catch {}
        applyUpdateRows(
          value3 ? null : [...entries.values()],
          value4.from,
          value5.to,
          value4.at,
          true,
        ).catch((input: unknown): void => {
          emitEvent({
            type: "restart",
            from: value4.from.version,
            to: value5.to.version,
            reason: "apply-failed",
            asked: true,
            error: shortHotErrorMessage(input),
          });
          scheduleRestart("apply-failed");
        });
      }
    }
    return {
      get active(): boolean {
        return !disposed;
      },
      stats: () => ({
        ...counters,
      }),
      events: events,
      dispose(): void {
        disposed = true;
        if (restartTimer !== undefined) {
          timers.clearTimeout(restartTimer);
          restartTimer = undefined;
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
  bindRuntimeValue(runtime, "hasHotRestartKey", () => hasHotRestartKey);
  bindRuntimeValue(
    runtime,
    "getHotWindowName",
    () => getHotWindowName,
    (value) => {
      getHotWindowName = value;
    },
  );
  bindRuntimeValue(runtime, "canRestartArtifact", () => canRestartArtifact);
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
    "HOT_RESTARTS_PER_WINDOW",
    () => HOT_RESTARTS_PER_WINDOW,
    (value) => {
      HOT_RESTARTS_PER_WINDOW = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "HOT_EVENT_HISTORY_LIMIT",
    () => HOT_EVENT_HISTORY_LIMIT,
    (value) => {
      HOT_EVENT_HISTORY_LIMIT = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "hotChangedPathSha",
    () => hotChangedPathSha,
    (value) => {
      hotChangedPathSha = value;
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
    getHotWindowName = (): string => {
      try {
        if (typeof window === "undefined") {
          return "";
        } else {
          return String(window.name ?? "");
        }
      } catch {
        return "";
      }
    };
    HOT_UPDATE_MAX_DEFER_MS = 60000;
    HOT_RESTARTS_PER_WINDOW = 1;
    HOT_EVENT_HISTORY_LIMIT = 50;
    hotChangedPathSha = (source: FilesHotChange) =>
      source.kind === "removed"
        ? null
        : typeof source.to === "string"
          ? source.to
          : null;
    shortHotErrorMessage = (input: unknown) =>
      (input instanceof Error
        ? input.message
        : String((input as FileRetryError | null)?.message ?? input)
      ).slice(0, 120);
    hotListingDescriptor = (input: Host.HotVersion) => ({
      version: input.ver,
      ...(input.seq !== undefined
        ? {
            seq: input.seq,
          }
        : {}),
    });
    describeHotChangedPaths = (
      input: Host.HotFileChange[] | null,
      options: (path: string) => boolean,
    ) =>
      input === null
        ? null
        : input.map((source: Host.HotFileChange) => ({
            path: source.path,
            kind: String(source.kind),
            klass: options(source.path) ? "code" : "content",
          }));
    hotAdoptMethodKind = (input: Host.HotUpdate): string =>
      typeof input.adopt === "function" ? "calls" : "string";
    HOT_INDEX_RECHECK_DELAY_MS = 4500;
  };
}
