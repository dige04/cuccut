import type * as FilesCore from "../contracts/files-core";
import type * as Docs from "../contracts/design-system-document";
import type * as Boot from "../contracts/boot";
import type * as Model from "../contracts";
import type * as Storage from "../contracts/model-storage";
import type * as Dom from "../contracts/dom";
import type * as Host from "../contracts/platform-host";
import type * as React from "react";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installFilesBootReader(runtime: RuntimeBindings): () => void {
  var BootReadError: Boot.BootReadConstructor;
  var MAX_BOOT_EARLY_FILE_READ_PASSES: number;
  var errorHttpStatus: (input: unknown) => number | undefined;
  var errorMessage: (input: unknown) => string;
  var isPermanentFilesBootFailure: (input: unknown) => boolean;
  var FILES_BOOT_RECOVERY_DELAYS_MS: number[];
  var FILES_BOOT_PERMANENT_RETRY_MS: number;
  async function readFilesBootState(
    options: Boot.BootReaderOptions,
  ): Promise<Boot.BootReadResult> {
    let { port: port, indexPath: indexPath } = options,
      normalizedPort = (0, runtime.filesPortExtensions)(port),
      retryDelays = options.waits ?? runtime.BOOT_FILE_READ_RETRY_DELAYS_MS,
      wantsEarlySlide = options.wants ?? ((): boolean => false),
      timers = options.timers ?? {
        setTimeout: (input, options2) => setTimeout(input, options2),
      },
      earlyHotSource = options.early ?? (0, runtime.currentHotReloadBridge)(),
      value: number = Math.max(
        1,
        options.maxPasses ?? MAX_BOOT_EARLY_FILE_READ_PASSES,
      ),
      index = 0,
      callback = (input: Boot.BootReadEvent): void => {
        try {
          options.onEvent?.(input);
        } catch {}
      },
      callback2 = (input: number) =>
        new Promise<void>((input2) => void timers.setTimeout(input2, input));
    function value2(): void {
      let value9 = earlyHotSource?.queued;
      if (value9 === undefined || value9.length === 0) {
        return;
      }
      let value10 = value9[value9.length - 1];
      if (port.version().version === value10.to.version) {
        return;
      }
      try {
        normalizedPort.noteAdopted?.(value10.to, value9[0].from);
      } catch {}
    }
    function value3(input: unknown, options2: string): Boot.BootReadException {
      if (input instanceof BootReadError) {
        return input;
      }
      let value9 = errorHttpStatus(input);
      if (
        (input as { code?: unknown } | null | undefined)?.code === "redirected"
      ) {
        return new BootReadError(
          "unreadable",
          options2,
          options2 + ": " + errorMessage(input),
        );
      }
      return new BootReadError(
        value9 === 401 || value9 === 403 ? "access_revoked" : "unreadable",
        options2,
        options2 + ": " + errorMessage(input),
        value9,
      );
    }
    async function value4(
      input: unknown,
      options2: string,
    ): Promise<Model.FileTextRead | undefined> {
      if (
        (input as { code?: unknown } | null | undefined)?.code !==
          "redirected" ||
        normalizedPort.readTextUnchecked === undefined
      ) {
        return;
      }
      try {
        let value9 = await normalizedPort.readTextUnchecked(options2);
        callback({
          type: "boot-took-redirected",
          path: options2,
        });
        return value9;
      } catch {
        return;
      }
    }
    async function value5<Value>(
      input: string,
      options2: () => Promise<Value>,
      context?: () => Promise<boolean>,
      value9?: (error: unknown) => Promise<Value | undefined>,
    ): Promise<Value | null> {
      for (let index3: number = 0; ; index3++) {
        try {
          return await options2();
        } catch (value10: unknown) {
          if (!(0, runtime.isRetryableFileReadAccessError)(value10)) {
            throw value3(value10, input);
          }
          if (
            context !== undefined &&
            errorHttpStatus(value10) === 404 &&
            (await context())
          ) {
            return null;
          }
          if (index3 >= retryDelays.length) {
            let value12 = await value9?.(value10);
            if (value12 !== undefined) {
              return value12;
            }
            throw value3(value10, input);
          }
          index += 1;
          let value11 = errorHttpStatus(value10);
          callback({
            type: "boot-retry",
            path: input,
            attempt: index3 + 1,
            ...(value11 !== undefined
              ? {
                  status: value11,
                }
              : {}),
            waitMs: retryDelays[index3],
          });
          await callback2(retryDelays[index3]);
        }
      }
    }
    async function value6(): Promise<Model.FileTextRead> {
      let callback4 = () =>
          new BootReadError(
            "no_index",
            indexPath,
            indexPath + " is not in this artifact",
            undefined,
            true,
          ),
        value9 =
          options.mayWrite === true
            ? retryDelays
            : runtime.FILE_FETCH_RETRY_DELAYS_MS;
      try {
        return await (0, runtime.retryFileRead)(
          () => port.readText(indexPath),
          timers,
          (input, options2): void => {
            index += 1;
            callback({
              type: "boot-retry",
              path: indexPath,
              attempt: input,
              ...(errorHttpStatus(options2) !== undefined
                ? {
                    status: errorHttpStatus(options2),
                  }
                : {}),
              waitMs: value9[input - 1] ?? 0,
            });
          },
          value9,
        );
      } catch (value10: unknown) {
        let value11 = await value4(value10, indexPath);
        if (value11 !== undefined) {
          return value11;
        }
        if (options.mayWrite !== true || errorHttpStatus(value10) === 404) {
          throw callback4();
        }
        throw new BootReadError(
          "unreadable",
          indexPath,
          indexPath + ": " + errorMessage(value10),
          errorHttpStatus(value10),
        );
      }
    }
    let index2 = 0;
    async function value7(): Promise<Model.FileListing> {
      for (;;) {
        let value9 = (await value5("_files.json", () =>
          port.list(),
        )) as Model.FileListing;
        if (
          options.mayWrite !== true ||
          !(0, runtime.fileListingIsNarrowed)(value9, port) ||
          index2 >= retryDelays.length
        ) {
          return value9;
        }
        let value10 = retryDelays[index2];
        index2 += 1;
        index += 1;
        callback({
          type: "boot-retry",
          path: "_files.json",
          attempt: index2,
          reason: "narrowed",
          waitMs: value10,
        });
        await callback2(value10);
        try {
          normalizedPort.forgetBootListing?.();
        } catch {}
      }
    }
    let callback3 = (input: string) => async () => {
        value2();
        let value9 = await port.list().catch((): void => {
          return;
        });
        return (
          value9 !== undefined &&
          !(0, runtime.fileListingIsNarrowed)(value9, port) &&
          !value9.some((input2): boolean => input2.path === input)
        );
      },
      value8: Model.FileTextRead | undefined,
      entries = new Map<string, Model.FileTextRead>(),
      entries2 = new Map<string, string>();
    for (let count: number = 1; ; count++) {
      value2();
      let version = port.version().version,
        value9 = await value7(),
        value10 = (0, runtime.fileListingIsNarrowed)(value9, port),
        entries3 = new Map(value9.map((input) => [input.path, input])),
        entry = entries3.get(indexPath);
      if (entry === undefined) {
        if (!value10) {
          throw new BootReadError(
            "no_index",
            indexPath,
            indexPath + " is not in this artifact",
            undefined,
            false,
          );
        }
        value8 = await value6();
      }
      for (let value12 of [...entries.keys()]) {
        let entry2 = entries3.get(value12);
        if (entry2 === undefined || !wantsEarlySlide(entry2)) {
          entries.delete(value12);
          entries2.delete(value12);
        }
      }
      let value11 = [
        ...(entry !== undefined ? [entry] : []),
        ...value9.filter(
          (input) => input.path !== indexPath && wantsEarlySlide(input),
        ),
      ].filter((input): boolean => entries2.get(input.path) !== input.sha256);
      await Promise.all(
        value11.map(async (input): Promise<void> => {
          let value12 = await value5(
            input.path,
            () => port.readText(input.path),
            callback3(input.path),
            (input2) => value4(input2, input.path),
          );
          if (value12 === null) {
            callback({
              type: "boot-removed",
              path: input.path,
            });
            entries.delete(input.path);
            entries2.delete(input.path);
            if (input.path === indexPath) {
              value8 = undefined;
            }
            return;
          }
          if (input.path === indexPath) {
            value8 = value12;
          } else {
            entries.set(input.path, value12);
          }
          entries2.set(input.path, input.sha256);
        }),
      );
      value2();
      let version2 = port.version().version;
      if (version2 === version || count >= value) {
        if (value8 === undefined) {
          throw new BootReadError(
            "no_index",
            indexPath,
            indexPath + " was removed while the editor booted",
          );
        }
        return {
          version: port.version(),
          listing: value9,
          index: value8,
          files: entries,
          retries: index,
          passes: count,
          ...(value10
            ? {
                narrowed: true,
              }
            : {}),
        };
      }
      callback({
        type: "boot-moved",
        from: version,
        to: version2,
      });
    }
  }
  function classifyFilesBootFailure(error: unknown): Boot.BootFailureClass {
    if (error instanceof runtime.IndexFileError) {
      if (error.code === "newer_version") {
        return "newer_build";
      } else {
        if (error.code === "unreadable") {
          return "damaged_index";
        } else {
          return "transient";
        }
      }
    }
    if (error instanceof BootReadError) {
      if (error.code === "no_index" || error.code === "access_revoked") {
        return error.code;
      } else {
        return "transient";
      }
    }
    return "transient";
  }
  function getBootstrapRetryDelay(
    input: unknown,
    options: number,
  ): number | undefined {
    let value: number = Number.isFinite(options) ? Math.floor(options) : 0;
    if (isPermanentFilesBootFailure(input)) {
      return undefined;
    } else {
      return FILES_BOOT_RECOVERY_DELAYS_MS[
        Math.min(Math.max(0, value), FILES_BOOT_RECOVERY_DELAYS_MS.length - 1)
      ];
    }
  }
  function filesBootRetryDelayForHotUpdate(
    error: unknown,
    change: Model.FileRemoteChange,
    indexPath: string,
    elapsedMs: number,
  ): number | undefined {
    let classification = classifyFilesBootFailure(error);
    if (classification === "transient") {
      return Math.max(0, FILES_BOOT_RECOVERY_DELAYS_MS[0] - elapsedMs);
    }
    if (
      classification !== "access_revoked" &&
      !change.changed.some((input): boolean => input.path === indexPath)
    ) {
      return;
    }
    return Math.max(0, FILES_BOOT_PERMANENT_RETRY_MS - elapsedMs);
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
    "MAX_BOOT_EARLY_FILE_READ_PASSES",
    () => MAX_BOOT_EARLY_FILE_READ_PASSES,
    (value) => {
      MAX_BOOT_EARLY_FILE_READ_PASSES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "errorHttpStatus",
    () => errorHttpStatus,
    (value) => {
      errorHttpStatus = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "errorMessage",
    () => errorMessage,
    (value) => {
      errorMessage = value;
    },
  );
  bindRuntimeValue(runtime, "readFilesBootState", () => readFilesBootState);
  bindRuntimeValue(
    runtime,
    "classifyFilesBootFailure",
    () => classifyFilesBootFailure,
  );
  bindRuntimeValue(
    runtime,
    "isPermanentFilesBootFailure",
    () => isPermanentFilesBootFailure,
    (value) => {
      isPermanentFilesBootFailure = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILES_BOOT_RECOVERY_DELAYS_MS",
    () => FILES_BOOT_RECOVERY_DELAYS_MS,
    (value) => {
      FILES_BOOT_RECOVERY_DELAYS_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILES_BOOT_PERMANENT_RETRY_MS",
    () => FILES_BOOT_PERMANENT_RETRY_MS,
    (value) => {
      FILES_BOOT_PERMANENT_RETRY_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "getBootstrapRetryDelay",
    () => getBootstrapRetryDelay,
  );
  bindRuntimeValue(
    runtime,
    "filesBootRetryDelayForHotUpdate",
    () => filesBootRetryDelayForHotUpdate,
  );
  return () => {
    BootReadError = class BootReadError extends Error {
      declare name: string;
      code: Boot.BootReadException["code"];
      path: string;
      status: number | undefined;
      narrowed: boolean | undefined;
      constructor(
        input: Boot.BootReadException["code"],
        options: string,
        context: string,
        value?: number,
        extra?: boolean,
      ) {
        super(context);
        this.name = "BootReadError";
        this.code = input;
        this.path = options;
        this.status = value;
        this.narrowed = extra;
      }
    };
    MAX_BOOT_EARLY_FILE_READ_PASSES = 6;
    errorHttpStatus = (input) => {
      let value = (input as { status?: unknown } | null | undefined)?.status;
      if (typeof value === "number") {
        return value;
      } else {
        return undefined;
      }
    };
    errorMessage = (input) =>
      input instanceof Error
        ? input.message
        : String(
            (input as { message?: unknown } | null | undefined)?.message ??
              input,
          );
    isPermanentFilesBootFailure = (input): boolean =>
      classifyFilesBootFailure(input) !== "transient";
    FILES_BOOT_RECOVERY_DELAYS_MS = [
      2000, 4000, 8000, 15000, 30000, 60000, 120000, 300000,
    ];
    FILES_BOOT_PERMANENT_RETRY_MS = 60000;
  };
}
