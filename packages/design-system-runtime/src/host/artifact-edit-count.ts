import type * as Host from "../contracts/platform-host";
import type * as React from "react";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installHostArtifactEditCount(
  runtime: RuntimeBindings,
): () => void {
  var EDIT_COUNT_STORAGE_PATTERN: RegExp;
  var artifactEditCount: number | undefined;
  var lastArtifactEditTime: number;
  var artifactEditNow: () => number;
  var artifactEditSubscribers: Set<(count: number) => void>;
  function normalizeArtifactSessionPath(path: string): string {
    return path.replace(/\/_f\/[^/]+(\/|$)/, "/_f/_$1");
  }
  function artifactEditStorageKey(): null | string {
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
      value2: boolean = value - lastArtifactEditTime < 500;
    lastArtifactEditTime = value;
    if (value2) {
      return;
    }
    let value3: number = Math.min(getArtifactEditCount() + 1, 999999999);
    if (value3 === artifactEditCount) {
      return;
    }
    artifactEditCount = value3;
    writeArtifactEditCount(value3);
    for (let value4 of [...artifactEditSubscribers]) {
      value4(value3);
    }
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
  return () => {
    EDIT_COUNT_STORAGE_PATTERN = /^([0-9]{1,9})(?:\/[0-9]{1,9})?$/;
    lastArtifactEditTime = -1 / 0;
    artifactEditNow = (): number => Date.now();
    artifactEditSubscribers = new Set();
  };
}
