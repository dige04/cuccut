/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";

/** One file of a listing (`_files.json` row plus the path it is keyed by). */
export interface FileListingEntry {
  path: string;
  /** Lower-case hex SHA-256 of the file. */
  sha256: string;
  size: number;
  contentType: string;
  /** Set while the entry only exists because of a local, not yet confirmed, change. */
  provisional?: boolean;
}

/** A listing of the deck's files; `narrowed` marks a listing the host trimmed to what this person may read. */
export type FileListing = FileListingEntry[] & { readonly narrowed?: boolean };

/** A version of the deck's files, as the host reports it. */
export interface FilesVersion {
  version: string;
  /** Position in the host's change sequence, when it reports one. */
  seq?: number;
}

/** One text file as read from the files port. */
export interface FileTextRead {
  text: string;
  /** Lower-case hex SHA-256 of the file. */
  sha256: string;
}

/** One file's bytes as read from the files port. */
export interface FileBytesRead {
  bytes: Uint8Array;
  /** Lower-case hex SHA-256 of the file. */
  sha256: string;
  contentType: string;
}

/** The part of a files port that listing a writable deck needs. */
export interface WritableListingPort {
  mayWrite?: boolean;
  narrowed?: boolean;
  list(): Promise<FileListing>;
  listUnlessNarrowed?(): Promise<FileListing>;
}

/** The part of the timers `retryFileRead` waits with. */
export interface RetryTimers {
  setTimeout(callback: () => void, delay?: number): unknown;
}

declare module "../bindings" {
  interface RuntimeBindings {
    /** Delays (ms) between attempts to re-read a file whose access was refused. */
    FILE_FETCH_RETRY_DELAYS_MS: number[];
    isRetryableFileReadAccessError: (error: unknown) => boolean;
    listWritableFiles: (port: WritableListingPort) => Promise<FileListing>;
    retryFileRead: <T>(
      operation: () => Promise<T>,
      timers?: RetryTimers,
      onRetry?: (attempt: number, error: unknown) => void,
      retryDelays?: readonly number[],
    ) => Promise<T>;
  }
}

export function installFilesReadRetries(runtime: RuntimeBindings): () => void {
  var FILE_FETCH_RETRY_DELAYS_MS: number[];
  function isRetryableFileReadAccessError(input: unknown): boolean {
    let value = (input as { status?: unknown } | null | undefined)?.status;
    return value === 401 || value === 403 || value === 404;
  }
  async function listWritableFiles(
    port: WritableListingPort,
  ): Promise<FileListing> {
    if (
      port.mayWrite === true &&
      typeof port.listUnlessNarrowed === "function"
    ) {
      return await port.listUnlessNarrowed();
    }
    let listing = await port.list();
    if (
      port.mayWrite === true &&
      (0, runtime.fileListingIsNarrowed)(listing, port)
    ) {
      throw {
        code: "http",
        status: 403,
        narrowed: true,
        message: "_files.json: marked as narrowed",
      };
    }
    return listing;
  }
  async function retryFileRead<T>(
    operation: () => Promise<T>,
    timers?: RetryTimers,
    onRetry?: (attempt: number, error: unknown) => void,
    retryDelays: readonly number[] = FILE_FETCH_RETRY_DELAYS_MS,
  ): Promise<T> {
    let clock: RetryTimers = timers ?? {
      setTimeout: (input, options) => setTimeout(input, options),
    };
    for (let index = 0; ; index++)
      try {
        return await operation();
      } catch (value: unknown) {
        if (
          index >= retryDelays.length ||
          !isRetryableFileReadAccessError(value)
        ) {
          throw value;
        }
        onRetry?.(index + 1, value);
        await new Promise<void>(
          (input) => void clock.setTimeout(input, retryDelays[index]),
        );
      }
  }
  bindRuntimeValue(
    runtime,
    "FILE_FETCH_RETRY_DELAYS_MS",
    () => FILE_FETCH_RETRY_DELAYS_MS,
    (value) => {
      FILE_FETCH_RETRY_DELAYS_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isRetryableFileReadAccessError",
    () => isRetryableFileReadAccessError,
  );
  bindRuntimeValue(runtime, "listWritableFiles", () => listWritableFiles);
  bindRuntimeValue(runtime, "retryFileRead", () => retryFileRead);
  return () => {
    FILE_FETCH_RETRY_DELAYS_MS = [50, 100, 200, 400, 800];
  };
}
