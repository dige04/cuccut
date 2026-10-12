/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";
import type {
  FileListing,
  FileListingEntry,
  FileTextRead,
  FilesVersion,
  RetryTimers,
} from "./read-retries";

/** Why the files-backed deck could not be booted. */
export type BootReadErrorCode = "no_index" | "access_revoked" | "unreadable";

/** An error raised while reading the deck's files at boot. */
export interface BootReadErrorInstance extends Error {
  name: "BootReadError";
  code: BootReadErrorCode;
  /** The file that could not be read. */
  path: string;
  /** HTTP status of the refused read, when there was one. */
  status: number | undefined;
  /** True when the listing was trimmed to what this person may read. */
  narrowed: boolean | undefined;
}

export interface BootReadErrorConstructor {
  new (
    code: BootReadErrorCode,
    path: string,
    message: string,
    status?: number,
    narrowed?: boolean,
  ): BootReadErrorInstance;
}

/** What the boot reader needs from a files port. */
export interface BootReaderPort {
  readonly narrowed?: boolean;
  version(): FilesVersion;
  list(): Promise<FileListing>;
  readText(path: string): Promise<FileTextRead>;
  /** Reads past a redirect the checked read refused. */
  readTextUnchecked?(path: string): Promise<FileTextRead>;
  /** Tells the port that the editor moved to a newer version while booting. */
  noteAdopted?(to: FilesVersion, from?: FilesVersion): void;
  /** Drops the listing the port kept from boot. */
  forgetBootListing?(): void;
}

/** Hot updates queued while the editor boots. */
export interface EarlyHotSource {
  readonly queued?: readonly {
    readonly from: FilesVersion;
    readonly to: FilesVersion;
  }[];
}

/** Progress events of the boot reader. */
export type FilesBootEvent =
  | {
      type: "boot-retry";
      path: string;
      attempt: number;
      status?: number;
      reason?: "narrowed";
      waitMs: number;
    }
  | { type: "boot-removed"; path: string }
  | { type: "boot-took-redirected"; path: string }
  | { type: "boot-moved"; from: string; to: string };

export interface ReadFilesBootStateOptions {
  port: BootReaderPort;
  indexPath: string;
  /** Delays (ms) between retries of a refused read. */
  waits?: readonly number[];
  /** Whether a listing entry is a slide worth reading early. */
  wants?: (entry: FileListingEntry) => boolean;
  timers?: RetryTimers;
  early?: EarlyHotSource;
  maxPasses?: number;
  onEvent?: (event: FilesBootEvent) => void;
  mayWrite?: boolean;
}

/** The deck's files as read at boot. */
export interface FilesBootState {
  version: FilesVersion;
  listing: FileListing;
  /** The index file. */
  index: FileTextRead;
  /** The early slide files that were read, by path. */
  files: Map<string, FileTextRead>;
  retries: number;
  passes: number;
  narrowed?: boolean;
}

declare module "../bindings" {
  interface RuntimeBindings {
    BootReadError: BootReadErrorConstructor;
    MAX_BOOT_EARLY_SLIDE_READS: number;
    errorHttpStatus: (error: unknown) => number | undefined;
    errorMessage: (error: unknown) => string;
    readFilesBootState: (
      options: ReadFilesBootStateOptions,
    ) => Promise<FilesBootState>;
  }
}

export function installFilesBootReader(runtime: RuntimeBindings): () => void {
  var BootReadError: BootReadErrorConstructor;
  var MAX_BOOT_EARLY_SLIDE_READS: number;
  var errorHttpStatus: (error: unknown) => number | undefined;
  var errorMessage: (error: unknown) => string;
  async function readFilesBootState(
    options: ReadFilesBootStateOptions,
  ): Promise<FilesBootState> {
    let { port: port, indexPath: indexPath } = options,
      normalizedPort = (0, runtime.normalizeFilesPort)(port),
      retryDelays: readonly number[] =
        options.waits ?? runtime.BOOT_FILE_READ_RETRY_DELAYS_MS,
      wantsEarlySlide = options.wants ?? ((): boolean => false),
      timers: RetryTimers = options.timers ?? {
        setTimeout: (input: () => void, options2?: number): unknown =>
          setTimeout(input, options2),
      },
      earlyHotSource: EarlyHotSource | undefined =
        options.early ?? (0, runtime.currentHotReloadBridge)(),
      value = Math.max(1, options.maxPasses ?? MAX_BOOT_EARLY_SLIDE_READS),
      index = 0,
      callback = (input: FilesBootEvent): void => {
        try {
          options.onEvent?.(input);
        } catch {}
      },
      callback2 = (input: number): Promise<void> =>
        new Promise((input2): void => void timers.setTimeout(input2, input));
    function value2(): void {
      let value9 = earlyHotSource?.queued;
      if (value9 === undefined || value9.length === 0) {
        return;
      }
      let value10 = value9[value9.length - 1]!;
      if (port.version().version === value10.to.version) {
        return;
      }
      try {
        normalizedPort.noteAdopted?.(value10.to, value9[0]!.from);
      } catch {}
    }
    function value3(input: unknown, options2: string): BootReadErrorInstance {
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
    ): Promise<FileTextRead | undefined> {
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
    function value5<T>(input: string, options2: () => Promise<T>): Promise<T>;
    function value5<T>(
      input: string,
      options2: () => Promise<T>,
      context: () => Promise<boolean>,
      value9?: (error: unknown) => Promise<T | undefined>,
    ): Promise<T | null>;
    async function value5<T>(
      input: string,
      options2: () => Promise<T>,
      context?: () => Promise<boolean>,
      value9?: (error: unknown) => Promise<T | undefined>,
    ): Promise<T | null> {
      for (let index3 = 0; ; index3++)
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
            waitMs: retryDelays[index3]!,
          });
          await callback2(retryDelays[index3]!);
        }
    }
    async function value6(): Promise<FileTextRead> {
      let callback4 = (): BootReadErrorInstance =>
          new BootReadError(
            "no_index",
            indexPath,
            indexPath + " is not in this artifact",
            undefined,
            true,
          ),
        value9: readonly number[] =
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
    async function value7(): Promise<FileListing> {
      for (;;) {
        let value9 = await value5("_files.json", () => port.list());
        if (
          options.mayWrite !== true ||
          !(0, runtime.fileListingIsNarrowed)(value9, port) ||
          index2 >= retryDelays.length
        ) {
          return value9;
        }
        let value10 = retryDelays[index2]!;
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
    let callback3 =
        (input: string) =>
        async (): Promise<boolean> => {
          value2();
          let value9 = await port.list().catch((): undefined => {
            return;
          });
          return (
            value9 !== undefined &&
            !(0, runtime.fileListingIsNarrowed)(value9, port) &&
            !value9.some((input2) => input2.path === input)
          );
        },
      value8: FileTextRead | undefined,
      entries = new Map<string, FileTextRead>(),
      entries2 = new Map<string, string>();
    for (let count = 1; ; count++) {
      value2();
      let version = port.version().version,
        value9 = await value7(),
        value10 = (0, runtime.fileListingIsNarrowed)(value9, port),
        entries3 = new Map<string, FileListingEntry>(
          value9.map((input): [string, FileListingEntry] => [
            input.path,
            input,
          ]),
        ),
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
      ].filter((input) => entries2.get(input.path) !== input.sha256);
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
    "MAX_BOOT_EARLY_SLIDE_READS",
    () => MAX_BOOT_EARLY_SLIDE_READS,
    (value) => {
      MAX_BOOT_EARLY_SLIDE_READS = value;
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
  return () => {
    BootReadError = class BootReadError extends Error {
      declare name: "BootReadError";
      code: BootReadErrorCode;
      path: string;
      status: number | undefined;
      narrowed: boolean | undefined;
      constructor(
        input: BootReadErrorCode,
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
    MAX_BOOT_EARLY_SLIDE_READS = 6;
    errorHttpStatus = (input: unknown): number | undefined => {
      let value = (input as { status?: unknown } | null | undefined)?.status;
      if (typeof value === "number") {
        return value;
      } else {
        return undefined;
      }
    };
    errorMessage = (input: unknown): string =>
      input instanceof Error
        ? input.message
        : String(
            (input as { message?: unknown } | null | undefined)?.message ??
              input,
          );
  };
}
