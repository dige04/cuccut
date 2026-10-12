/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installPlatformEditCount(runtime: RuntimeBindings): () => void {
  var editCountStoragePrefix: Dynamic;
  var PlatformEditCountPattern: Dynamic;
  var PlatformEditCountAlias: Dynamic;
  var PlatformEditCountAlias_2: Dynamic;
  var PlatformEditCountNow: Dynamic;
  var PlatformEditCountSubscribers: Dynamic;
  function normalizeArtifactPath(input?: Dynamic): Dynamic {
    return input.replace(/\/_f\/[^/]+(\/|$)/, "/_f/_$1");
  }
  function getEditCountStorageKey(): Dynamic {
    return typeof location === "undefined"
      ? null
      : editCountStoragePrefix + normalizeArtifactPath(location.pathname);
  }
  function readEditCount(): Dynamic {
    try {
      let value: Dynamic = getEditCountStorageKey(),
        value2: Dynamic = PlatformEditCountPattern.exec(
          value === null ? "" : (sessionStorage.getItem(value) ?? ""),
        );
      return value2 === null ? 0 : Number(value2[1]);
    } catch {
      return 0;
    }
  }
  function writeEditCount(input?: Dynamic): Dynamic {
    try {
      let value: Dynamic = getEditCountStorageKey();
      value !== null && sessionStorage.setItem(value, String(input));
    } catch {}
  }
  function getEditCount(): Dynamic {
    PlatformEditCountAlias ??= readEditCount();
    return PlatformEditCountAlias;
  }
  function recordEdit(): Dynamic {
    let value: Dynamic = PlatformEditCountNow(),
      value2: Dynamic = value - PlatformEditCountAlias_2 < 500;
    PlatformEditCountAlias_2 = value;
    if (value2) return;
    let value3: Dynamic = Math.min(getEditCount() + 1, 999999999);
    if (value3 !== PlatformEditCountAlias) {
      PlatformEditCountAlias = value3;
      writeEditCount(value3);
      for (let value4 of [...PlatformEditCountSubscribers] as Dynamic)
        value4(value3);
    }
  }
  function subscribeEditCount(input?: Dynamic): Dynamic {
    PlatformEditCountSubscribers.add(input);
    return (): Dynamic => {
      PlatformEditCountSubscribers.delete(input);
    };
  }
  bindRuntimeValue(
    runtime,
    "editCountStoragePrefix",
    () => editCountStoragePrefix,
    (value) => {
      editCountStoragePrefix = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformEditCountPattern",
    () => PlatformEditCountPattern,
    (value) => {
      PlatformEditCountPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformEditCountAlias",
    () => PlatformEditCountAlias,
    (value) => {
      PlatformEditCountAlias = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformEditCountAlias_2",
    () => PlatformEditCountAlias_2,
    (value) => {
      PlatformEditCountAlias_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformEditCountNow",
    () => PlatformEditCountNow,
    (value) => {
      PlatformEditCountNow = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformEditCountSubscribers",
    () => PlatformEditCountSubscribers,
    (value) => {
      PlatformEditCountSubscribers = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "normalizeArtifactPath",
    () => normalizeArtifactPath,
  );
  bindRuntimeValue(
    runtime,
    "getEditCountStorageKey",
    () => getEditCountStorageKey,
  );
  bindRuntimeValue(runtime, "readEditCount", () => readEditCount);
  bindRuntimeValue(runtime, "writeEditCount", () => writeEditCount);
  bindRuntimeValue(runtime, "getEditCount", () => getEditCount);
  bindRuntimeValue(runtime, "recordEdit", () => recordEdit);
  bindRuntimeValue(runtime, "subscribeEditCount", () => subscribeEditCount);
  return () => {
    editCountStoragePrefix = "appifact:edits:";
    PlatformEditCountPattern = /^([0-9]{1,9})(?:\/[0-9]{1,9})?$/;
    PlatformEditCountAlias_2 = -1 / 0;
    PlatformEditCountNow = (): Dynamic => Date.now();
    PlatformEditCountSubscribers = new Set();
  };
}
