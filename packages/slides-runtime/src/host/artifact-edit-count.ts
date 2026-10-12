/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";

/** Called with the new edit count after each counted edit. */
export type ArtifactEditListener = (count: number) => void;

declare module "../bindings" {
  interface RuntimeBindings {
    /** Matches the stored count, `<edits>` or `<edits>/<other>`; group 1 is the edit count. */
    EDIT_COUNT_STORAGE_PATTERN: RegExp;
    /** Edits counted this session; undefined until first read from session storage. */
    artifactEditCount: number | undefined;
    lastArtifactEditTime: number;
    artifactEditNow: () => number;
    artifactEditSubscribers: Set<ArtifactEditListener>;
    /** Replaces the session id in an `/_f/<id>/` path with `_` so reloads of the same artifact share a key. */
    normalizeArtifactSessionPath: (path: string) => string;
    artifactEditStorageKey: () => string | null;
    readArtifactEditCount: () => number;
    writeArtifactEditCount: (count: number) => void;
    getArtifactEditCount: () => number;
    /** Counts one edit; edits closer than 500 ms to the previous one are merged into it. */
    recordArtifactEdit: () => void;
    /** Subscribes to edit counts; returns the unsubscribe function. */
    subscribeArtifactEdits: (listener: ArtifactEditListener) => () => void;
  }
}

export function installHostArtifactEditCount(
  runtime: RuntimeBindings,
): () => void {
  var EDIT_COUNT_STORAGE_PATTERN: RegExp;
  var artifactEditCount: number | undefined;
  var lastArtifactEditTime: number;
  var artifactEditNow: () => number;
  var artifactEditSubscribers: Set<ArtifactEditListener>;
  function normalizeArtifactSessionPath(path: string): string {
    return path.replace(/\/_f\/[^/]+(\/|$)/, "/_f/_$1");
  }
  function artifactEditStorageKey(): string | null {
    if (typeof location === "undefined") {
      return null;
    } else {
      return (
        "appifact:edits:" + normalizeArtifactSessionPath(location.pathname)
      );
    }
  }
  function readArtifactEditCount(): number {
    try {
      let value = artifactEditStorageKey(),
        value2 = EDIT_COUNT_STORAGE_PATTERN.exec(
          value === null ? "" : (sessionStorage.getItem(value) ?? ""),
        );
      if (value2 === null) {
        return 0;
      } else {
        return Number(value2[1]);
      }
    } catch {
      return 0;
    }
  }
  function writeArtifactEditCount(count: number): void {
    try {
      let value = artifactEditStorageKey();
      if (value !== null) {
        sessionStorage.setItem(value, String(count));
      }
    } catch {}
  }
  function getArtifactEditCount(): number {
    artifactEditCount ??= readArtifactEditCount();
    return artifactEditCount;
  }
  function recordArtifactEdit(): void {
    let value = artifactEditNow(),
      value2 = value - lastArtifactEditTime < 500;
    lastArtifactEditTime = value;
    if (value2) {
      return;
    }
    let value3 = Math.min(getArtifactEditCount() + 1, 999999999);
    if (value3 === artifactEditCount) {
      return;
    }
    artifactEditCount = value3;
    writeArtifactEditCount(value3);
    for (let value4 of [...artifactEditSubscribers]) value4(value3);
  }
  function subscribeArtifactEdits(
    listener: ArtifactEditListener,
  ): () => void {
    artifactEditSubscribers.add(listener);
    return (): void => {
      artifactEditSubscribers.delete(listener);
    };
  }
  bindRuntimeValue(
    runtime,
    "EDIT_COUNT_STORAGE_PATTERN",
    () => EDIT_COUNT_STORAGE_PATTERN,
    (value) => {
      EDIT_COUNT_STORAGE_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "artifactEditCount",
    () => artifactEditCount,
    (value) => {
      artifactEditCount = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "lastArtifactEditTime",
    () => lastArtifactEditTime,
    (value) => {
      lastArtifactEditTime = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "artifactEditNow",
    () => artifactEditNow,
    (value) => {
      artifactEditNow = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "artifactEditSubscribers",
    () => artifactEditSubscribers,
    (value) => {
      artifactEditSubscribers = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "normalizeArtifactSessionPath",
    () => normalizeArtifactSessionPath,
  );
  bindRuntimeValue(
    runtime,
    "artifactEditStorageKey",
    () => artifactEditStorageKey,
  );
  bindRuntimeValue(
    runtime,
    "readArtifactEditCount",
    () => readArtifactEditCount,
  );
  bindRuntimeValue(
    runtime,
    "writeArtifactEditCount",
    () => writeArtifactEditCount,
  );
  bindRuntimeValue(runtime, "getArtifactEditCount", () => getArtifactEditCount);
  bindRuntimeValue(runtime, "recordArtifactEdit", () => recordArtifactEdit);
  bindRuntimeValue(
    runtime,
    "subscribeArtifactEdits",
    () => subscribeArtifactEdits,
  );
  return () => {
    EDIT_COUNT_STORAGE_PATTERN = /^([0-9]{1,9})(?:\/[0-9]{1,9})?$/;
    lastArtifactEditTime = -1 / 0;
    artifactEditNow = (): number => Date.now();
    artifactEditSubscribers = new Set();
  };
}
