/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";

/** The flag service the embedding page may publish as `globalThis.__appifact_flags`. */
export interface FeatureFlagApi {
  /** Resolves once flag values have loaded (or failed to). */
  ready(): Promise<unknown>;
  /** The flag's value, or `fallback` when it is unset; the value's type is not guaranteed. */
  get(key: string, fallback: unknown): unknown;
  all(): unknown;
}
/** `globalThis` with the page-provided flag service, which is not validated until `resolveFeatureFlagApi`. */
type FeatureFlagGlobal = typeof globalThis & {
  __appifact_flags?: Partial<FeatureFlagApi> | null;
};

declare module "../bindings" {
  interface RuntimeBindings {
    /** The page's flag service when it has `ready`, `get` and `all`, else undefined. */
    resolveFeatureFlagApi: () => FeatureFlagApi | undefined;
    /** Whether `value` has the same JSON kind as `fallback` (null accepts anything; arrays and objects are told apart). */
    sameFlagValueType: <T>(value: unknown, fallback: T) => value is T;
    /** Waits for the flags to load, then reads one; falls back on any problem or type mismatch. */
    getFeatureFlagAsync: <T>(key: string, fallback: T) => Promise<T>;
    /** Reads a flag already loaded; falls back on any problem or type mismatch. */
    getFeatureFlag: <T>(key: string, fallback: T) => T;
    CREATION_SEQUENCE_FLAG: string;
    creationSequenceFlagRequested: boolean;
    creationSequenceFlagSnapshot: boolean | undefined;
    requestCreationSequenceFlag: () => void;
    wasCreationSequenceFlagRequested: () => boolean;
    creationSequenceEnabled: () => boolean;
  }
}

export function installHostFeatureFlags(runtime: RuntimeBindings): () => void {
  var CREATION_SEQUENCE_FLAG: string;
  var creationSequenceFlagRequested: boolean;
  var creationSequenceFlagSnapshot: boolean | undefined;
  function resolveFeatureFlagApi(): FeatureFlagApi | undefined {
    let __appifact_flags = (globalThis as FeatureFlagGlobal).__appifact_flags;
    if (typeof __appifact_flags !== "object" || __appifact_flags === null) {
      return;
    }
    let value = __appifact_flags;
    if (
      typeof value.ready === "function" &&
      typeof value.get === "function" &&
      typeof value.all === "function"
    ) {
      return __appifact_flags as FeatureFlagApi;
    } else {
      return undefined;
    }
  }
  function sameFlagValueType<T>(value: unknown, fallback: T): value is T {
    if (fallback === null) {
      return true;
    }
    if (Array.isArray(fallback)) {
      return Array.isArray(value);
    }
    if (typeof fallback === "object") {
      return (
        typeof value === "object" && value !== null && !Array.isArray(value)
      );
    }
    return typeof value === typeof fallback;
  }
  async function getFeatureFlagAsync<T>(
    key: string,
    fallback: T,
  ): Promise<T> {
    try {
      let value = resolveFeatureFlagApi();
      if (value === undefined) {
        return fallback;
      }
      try {
        await value.ready();
      } catch {}
      let entry = value.get(key, fallback);
      if (sameFlagValueType(entry, fallback)) {
        return entry;
      } else {
        return fallback;
      }
    } catch {
      return fallback;
    }
  }
  function getFeatureFlag<T>(key: string, fallback: T): T {
    try {
      let value = resolveFeatureFlagApi()?.get(key, fallback);
      if (value !== undefined && sameFlagValueType(value, fallback)) {
        return value;
      } else {
        return fallback;
      }
    } catch {
      return fallback;
    }
  }
  function requestCreationSequenceFlag(): void {
    if (creationSequenceFlagRequested) {
      return;
    }
    creationSequenceFlagRequested = true;
    let value = Date.now();
    getFeatureFlagAsync(CREATION_SEQUENCE_FLAG, false).then(
      (input: boolean): void => {
        if (input && creationSequenceFlagSnapshot === false) {
          console.debug(
            "slides: the " +
              CREATION_SEQUENCE_FLAG +
              " flag came back on " +
              String(Date.now() - value) +
              " ms after the page asked, too late for this load, which does not show the creation sequence",
          );
        }
      },
    );
  }
  function wasCreationSequenceFlagRequested(): boolean {
    return creationSequenceFlagRequested;
  }
  function creationSequenceEnabled(): boolean {
    creationSequenceFlagSnapshot ??=
      creationSequenceFlagRequested &&
      getFeatureFlag(CREATION_SEQUENCE_FLAG, false);
    return creationSequenceFlagSnapshot;
  }
  bindRuntimeValue(
    runtime,
    "resolveFeatureFlagApi",
    () => resolveFeatureFlagApi,
  );
  bindRuntimeValue(runtime, "sameFlagValueType", () => sameFlagValueType);
  bindRuntimeValue(runtime, "getFeatureFlagAsync", () => getFeatureFlagAsync);
  bindRuntimeValue(runtime, "getFeatureFlag", () => getFeatureFlag);
  bindRuntimeValue(
    runtime,
    "CREATION_SEQUENCE_FLAG",
    () => CREATION_SEQUENCE_FLAG,
    (value) => {
      CREATION_SEQUENCE_FLAG = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "creationSequenceFlagRequested",
    () => creationSequenceFlagRequested,
    (value) => {
      creationSequenceFlagRequested = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "creationSequenceFlagSnapshot",
    () => creationSequenceFlagSnapshot,
    (value) => {
      creationSequenceFlagSnapshot = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "requestCreationSequenceFlag",
    () => requestCreationSequenceFlag,
  );
  bindRuntimeValue(
    runtime,
    "wasCreationSequenceFlagRequested",
    () => wasCreationSequenceFlagRequested,
  );
  bindRuntimeValue(
    runtime,
    "creationSequenceEnabled",
    () => creationSequenceEnabled,
  );
  return () => {
    CREATION_SEQUENCE_FLAG = "appifact_creation_sequence";
    creationSequenceFlagRequested = false;
  };
}
