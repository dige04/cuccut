/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";

/** What went wrong while booting the files-backed deck, as far as recovery policy is concerned. */
export type FilesBootFailureKind =
  | "newer_build"
  | "damaged_index"
  | "no_index"
  | "access_revoked"
  | "transient";

/** Index-store and boot-reader errors carry a machine-readable `code` next to the usual `Error` fields. */
interface CodedBootError {
  code?: string;
}

/** A remote change notification: the paths that changed (the port reports `null` entries never; the list is what matters). */
export interface FilesBootRemoteChange {
  changed: readonly { path: string }[];
}

declare module "../bindings" {
  interface RuntimeBindings {
    classifyFilesBootFailure: (error: unknown) => FilesBootFailureKind;
    isPermanentFilesBootFailure: (error: unknown) => boolean;
    /** Back-off schedule for automatically retrying a transient boot failure. */
    FILES_BOOT_RECOVERY_DELAYS_MS: [number, ...number[]];
    FILES_BOOT_PERMANENT_RETRY_MS: number;
    filesBootRetryDelayForHotUpdate: (
      error: unknown,
      change: FilesBootRemoteChange,
      indexPath: string,
      elapsedMs: number,
    ) => number | undefined;
  }
}

export function installFilesBootRecovery(runtime: RuntimeBindings): () => void {
  var isPermanentFilesBootFailure: (error: unknown) => boolean;
  var FILES_BOOT_RECOVERY_DELAYS_MS: [number, ...number[]];
  var FILES_BOOT_PERMANENT_RETRY_MS: number;
  function classifyFilesBootFailure(error: unknown): FilesBootFailureKind {
    if (error instanceof runtime.IndexFileError) {
      if ((error as CodedBootError).code === "newer_version") {
        return "newer_build";
      } else {
        if ((error as CodedBootError).code === "unreadable") {
          return "damaged_index";
        } else {
          return "transient";
        }
      }
    }
    if (error instanceof runtime.BootReadError) {
      if (error.code === "no_index" || error.code === "access_revoked") {
        return error.code;
      } else {
        return "transient";
      }
    }
    return "transient";
  }
  function filesBootRetryDelayForHotUpdate(
    error: unknown,
    change: FilesBootRemoteChange,
    indexPath: string,
    elapsedMs: number,
  ): number | undefined {
    let classification = classifyFilesBootFailure(error);
    if (classification === "transient") {
      return Math.max(0, FILES_BOOT_RECOVERY_DELAYS_MS[0] - elapsedMs);
    }
    if (
      classification !== "access_revoked" &&
      !change.changed.some((input) => input.path === indexPath)
    ) {
      return;
    }
    return Math.max(0, FILES_BOOT_PERMANENT_RETRY_MS - elapsedMs);
  }
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
    "filesBootRetryDelayForHotUpdate",
    () => filesBootRetryDelayForHotUpdate,
  );
  return () => {
    isPermanentFilesBootFailure = (input: unknown): boolean =>
      classifyFilesBootFailure(input) !== "transient";
    FILES_BOOT_RECOVERY_DELAYS_MS = [
      2000, 4000, 8000, 15000, 30000, 60000, 120000, 300000,
    ];
    FILES_BOOT_PERMANENT_RETRY_MS = 60000;
  };
}
