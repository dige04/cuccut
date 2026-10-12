/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installPlatformBootReader(
  runtime: RuntimeBindings,
): () => void {
  var BootReadError: Dynamic;
  var BOOT_READ_MAX_PASSES: Dynamic;
  var getErrorHttpStatus: Dynamic;
  var getErrorMessage: Dynamic;
  var isPermanentBootstrapFailure: Dynamic;
  var BOOT_RETRY_BACKOFF_MS: Dynamic;
  var DAMAGED_INDEX_RETRY_DELAY_MS: Dynamic;
  async function readBootFiles(options?: Dynamic): Promise<Dynamic> {
    let { port: port, indexPath: indexPath }: Dynamic = options,
      readPort: Dynamic = port,
      retryWaits: Dynamic =
        options.waits ?? runtime.PlatformFilesHotReloadItems,
      wantsFile: Dynamic = options.wants ?? ((): Dynamic => false),
      timers: Dynamic = options.timers ?? {
        setTimeout: (input?: Dynamic, options2?: Dynamic): Dynamic =>
          setTimeout(input, options2),
      },
      earlyUpdates: Dynamic =
        options.early ?? (0, runtime.getHotReloadController)(),
      maxPasses: Dynamic = Math.max(
        1,
        options.maxPasses ?? BOOT_READ_MAX_PASSES,
      ),
      passes: Dynamic = 0,
      reportEvent: Dynamic = (input?: Dynamic): Dynamic => {
        try {
          options.onEvent?.(input);
        } catch {}
      },
      sleep: Dynamic = (input?: Dynamic): Dynamic =>
        new Promise((input2?: Dynamic): Dynamic => {
          timers.setTimeout(input2, input);
        });
    function adoptQueuedVersion(): Dynamic {
      let value6: Dynamic = earlyUpdates?.queued;
      if (value6 === undefined || value6.length === 0) return;
      let value7: Dynamic = value6[value6.length - 1];
      if (port.version().version !== value7.to.version)
        try {
          readPort.noteAdopted?.(value7.to, value6[0].from);
        } catch {}
    }
    function wrapReadError(input?: Dynamic, options2?: Dynamic): Dynamic {
      if (input instanceof BootReadError) return input;
      let value6: Dynamic = getErrorHttpStatus(input);
      return input?.code === "redirected"
        ? new BootReadError(
            "unreadable",
            options2,
            options2 + ": " + getErrorMessage(input),
          )
        : new BootReadError(
            value6 === 401 || value6 === 403 ? "access_revoked" : "unreadable",
            options2,
            options2 + ": " + getErrorMessage(input),
            value6,
          );
    }
    async function value(
      input?: Dynamic,
      options2?: Dynamic,
    ): Promise<Dynamic> {
      if (
        !(
          input?.code !== "redirected" ||
          readPort.readTextUnchecked === undefined
        )
      )
        try {
          let value6: Dynamic = await readPort.readTextUnchecked(options2);
          reportEvent({
            type: "boot-took-redirected",
            path: options2,
          });
          return value6;
        } catch {
          return;
        }
    }
    async function value2(
      input?: Dynamic,
      options2?: Dynamic,
      context?: Dynamic,
      value6?: Dynamic,
    ): Promise<Dynamic> {
      for (let index2: Dynamic = 0; ; index2++)
        try {
          return await options2();
        } catch (value7: Dynamic) {
          if (!(0, runtime.isRetryableAccessFailure)(value7))
            throw wrapReadError(value7, input);
          if (
            context !== undefined &&
            getErrorHttpStatus(value7) === 404 &&
            (await context())
          )
            return null;
          if (index2 >= retryWaits.length) {
            let value9: Dynamic = await value6?.(value7);
            if (value9 !== undefined) return value9;
            throw wrapReadError(value7, input);
          }
          passes += 1;
          let value8: Dynamic = getErrorHttpStatus(value7);
          reportEvent({
            type: "boot-retry",
            path: input,
            attempt: index2 + 1,
            ...(value8 !== undefined
              ? {
                  status: value8,
                }
              : {}),
            waitMs: retryWaits[index2],
          });
          await sleep(retryWaits[index2]);
        }
    }
    async function value3(): Promise<Dynamic> {
      let callback2: Dynamic = (): Dynamic =>
          new BootReadError(
            "no_index",
            indexPath,
            indexPath + " is not in this artifact",
            undefined,
            true,
          ),
        value6: Dynamic =
          options.mayWrite === true
            ? retryWaits
            : runtime.PlatformAccessRetryItems;
      try {
        return await (0, runtime.retryAccessFailure)(
          (): Dynamic => port.readText(indexPath),
          timers,
          (input?: Dynamic, options2?: Dynamic): Dynamic => {
            passes += 1;
            reportEvent({
              type: "boot-retry",
              path: indexPath,
              attempt: input,
              ...(getErrorHttpStatus(options2) !== undefined
                ? {
                    status: getErrorHttpStatus(options2),
                  }
                : {}),
              waitMs: value6[input - 1] ?? 0,
            });
          },
          value6,
        );
      } catch (value7: Dynamic) {
        let value8: Dynamic = await value(value7, indexPath);
        if (value8 !== undefined) return value8;
        throw options.mayWrite !== true || getErrorHttpStatus(value7) === 404
          ? callback2()
          : new BootReadError(
              "unreadable",
              indexPath,
              indexPath + ": " + getErrorMessage(value7),
              getErrorHttpStatus(value7),
            );
      }
    }
    let index: Dynamic = 0;
    async function value4(): Promise<Dynamic> {
      for (;;) {
        let value6: Dynamic = await value2(
          "_files.json",
          (): Dynamic => port.list(),
        );
        if (
          options.mayWrite !== true ||
          !(0, runtime.isNarrowedFileContext)(value6, port) ||
          index >= retryWaits.length
        )
          return value6;
        let value7: Dynamic = retryWaits[index];
        index += 1;
        passes += 1;
        reportEvent({
          type: "boot-retry",
          path: "_files.json",
          attempt: index,
          reason: "narrowed",
          waitMs: value7,
        });
        await sleep(value7);
        try {
          readPort.forgetBootListing?.();
        } catch {}
      }
    }
    let callback: Dynamic =
        (input?: Dynamic): Dynamic =>
        async (): Promise<Dynamic> => {
          adoptQueuedVersion();
          let value6: Dynamic = await port.list().catch((): Dynamic => {});
          return (
            value6 !== undefined &&
            !(0, runtime.isNarrowedFileContext)(value6, port) &&
            !value6.some((input2?: Dynamic): Dynamic => input2.path === input)
          );
        },
      value5: Dynamic,
      entries: Dynamic = new Map(),
      entries2: Dynamic = new Map();
    for (let count: Dynamic = 1; ; count++) {
      adoptQueuedVersion();
      let version: Dynamic = port.version().version,
        value6: Dynamic = await value4(),
        value7: Dynamic = (0, runtime.isNarrowedFileContext)(value6, port),
        entries3: Dynamic = new Map(
          value6.map((input?: Dynamic): Dynamic => [input.path, input]),
        ),
        entry: Dynamic = entries3.get(indexPath);
      if (entry === undefined) {
        if (!value7)
          throw new BootReadError(
            "no_index",
            indexPath,
            indexPath + " is not in this artifact",
            undefined,
            false,
          );
        value5 = await value3();
      }
      for (let value9 of [...entries.keys()] as Dynamic) {
        let entry2: Dynamic = entries3.get(value9);
        (entry2 === undefined || !wantsFile(entry2)) &&
          (entries.delete(value9), entries2.delete(value9));
      }
      let value8: Dynamic = [
        ...(entry !== undefined ? [entry] : []),
        ...value6.filter(
          (input?: Dynamic): Dynamic =>
            input.path !== indexPath && wantsFile(input),
        ),
      ].filter(
        (input?: Dynamic): Dynamic => entries2.get(input.path) !== input.sha256,
      );
      await Promise.all(
        value8.map(async (input?: Dynamic): Promise<Dynamic> => {
          let value9: Dynamic = await value2(
            input.path,
            (): Dynamic => port.readText(input.path),
            callback(input.path),
            (input2?: Dynamic): Dynamic => value(input2, input.path),
          );
          if (value9 === null) {
            reportEvent({
              type: "boot-removed",
              path: input.path,
            });
            entries.delete(input.path);
            entries2.delete(input.path);
            input.path === indexPath && (value5 = undefined);
            return;
          }
          input.path === indexPath
            ? (value5 = value9)
            : entries.set(input.path, value9);
          entries2.set(input.path, input.sha256);
        }),
      );
      adoptQueuedVersion();
      let version2: Dynamic = port.version().version;
      if (version2 === version || count >= maxPasses) {
        if (value5 === undefined)
          throw new BootReadError(
            "no_index",
            indexPath,
            indexPath + " was removed while the editor booted",
          );
        return {
          version: port.version(),
          listing: value6,
          index: value5,
          files: entries,
          retries: passes,
          passes: count,
          ...(value7
            ? {
                narrowed: true,
              }
            : {}),
        };
      }
      reportEvent({
        type: "boot-moved",
        from: version,
        to: version2,
      });
    }
  }
  function classifyBootstrapFailure(error?: Dynamic): Dynamic {
    return error instanceof runtime.IndexFileError
      ? error.code === "newer_version"
        ? "newer_build"
        : error.code === "unreadable"
          ? "damaged_index"
          : "transient"
      : error instanceof BootReadError &&
          (error.code === "no_index" || error.code === "access_revoked")
        ? error.code
        : "transient";
  }
  function getBootstrapRetryDelay(error?: Dynamic, attempt?: Dynamic): Dynamic {
    let retryIndex: Dynamic = Number.isFinite(attempt)
      ? Math.floor(attempt)
      : 0;
    return isPermanentBootstrapFailure(error)
      ? undefined
      : BOOT_RETRY_BACKOFF_MS[
          Math.min(Math.max(0, retryIndex), BOOT_RETRY_BACKOFF_MS.length - 1)
        ];
  }
  function getRestartDelay(
    error?: Dynamic,
    update?: Dynamic,
    indexPath?: Dynamic,
    elapsedMs?: Dynamic,
  ): Dynamic {
    let failureCategory: Dynamic = classifyBootstrapFailure(error);
    if (failureCategory === "transient")
      return Math.max(0, BOOT_RETRY_BACKOFF_MS[0] - elapsedMs);
    if (
      !(
        failureCategory !== "access_revoked" &&
        !update.changed.some(
          (input?: Dynamic): Dynamic => input.path === indexPath,
        )
      )
    )
      return Math.max(0, DAMAGED_INDEX_RETRY_DELAY_MS - elapsedMs);
  }
  bindRuntimeValue(
    runtime,
    "BootReadError",
    () => BootReadError,
    (value) => {
      BootReadError = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "BOOT_READ_MAX_PASSES",
    () => BOOT_READ_MAX_PASSES,
    (value) => {
      BOOT_READ_MAX_PASSES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "getErrorHttpStatus",
    () => getErrorHttpStatus,
    (value) => {
      getErrorHttpStatus = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "getErrorMessage",
    () => getErrorMessage,
    (value) => {
      getErrorMessage = value;
    },
  );
  bindRuntimeValue(runtime, "readBootFiles", () => readBootFiles);
  bindRuntimeValue(
    runtime,
    "classifyBootstrapFailure",
    () => classifyBootstrapFailure,
  );
  bindRuntimeValue(
    runtime,
    "isPermanentBootstrapFailure",
    () => isPermanentBootstrapFailure,
    (value) => {
      isPermanentBootstrapFailure = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "BOOT_RETRY_BACKOFF_MS",
    () => BOOT_RETRY_BACKOFF_MS,
    (value) => {
      BOOT_RETRY_BACKOFF_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DAMAGED_INDEX_RETRY_DELAY_MS",
    () => DAMAGED_INDEX_RETRY_DELAY_MS,
    (value) => {
      DAMAGED_INDEX_RETRY_DELAY_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "getBootstrapRetryDelay",
    () => getBootstrapRetryDelay,
  );
  bindRuntimeValue(runtime, "getRestartDelay", () => getRestartDelay);
  return () => {
    BootReadError = class extends Error {
      declare name: Dynamic;
      code: Dynamic;
      path: Dynamic;
      status: Dynamic;
      narrowed: Dynamic;
      constructor(
        input: Dynamic,
        options: Dynamic,
        context: Dynamic,
        value: Dynamic,
        extra: Dynamic,
      ) {
        super(context);
        this.name = "BootReadError";
        this.code = input;
        this.path = options;
        this.status = value;
        this.narrowed = extra;
      }
    };
    BOOT_READ_MAX_PASSES = 6;
    getErrorHttpStatus = (input?: Dynamic): Dynamic => {
      let value: Dynamic = input?.status;
      return typeof value == "number" ? value : undefined;
    };
    getErrorMessage = (input?: Dynamic): Dynamic =>
      input instanceof Error ? input.message : String(input?.message ?? input);
    isPermanentBootstrapFailure = (input?: Dynamic): Dynamic =>
      classifyBootstrapFailure(input) !== "transient";
    BOOT_RETRY_BACKOFF_MS = [2e3, 4e3, 8e3, 15e3, 3e4, 6e4, 12e4, 3e5];
    DAMAGED_INDEX_RETRY_DELAY_MS = 6e4;
  };
}
