/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";
import type {
  ArtifactPageParts,
  StorageSlot,
} from "../documents/artifact-document";

/** Where loading the state file failed: `fetch` (network or HTTP) or `read` (unparseable content). */
export type StateLoadErrorAt = "fetch" | "read";
/** Presentation state as handed to the artifact document: a title plus the (still opaque) content. */
export interface StateEnvelope {
  title?: string;
  content?: unknown;
}
/** A parsed state file: its envelope and an optional note for the user. */
export interface StateFileContents {
  envelope: StateEnvelope;
  note?: string | undefined;
}
/** Turns the fetched text into state, or into an error message. */
export type StateFileParser = (text: string) => string | StateFileContents;
/** The slice of `Response` the state-file reader uses. */
export type StateFileResponse = Pick<Response, "ok" | "status" | "text">;
export type FetchStateFile = (path: string) => Promise<StateFileResponse>;
/** Why a state file could not be used. */
export interface StateFileReadFailure {
  /** Human-readable failure. */
  fail: string;
  at: StateLoadErrorAt;
  /** True for HTTP 404 (the file does not exist). */
  missing: boolean;
}
export type StateFileReadFailureConstructor = new (
  fail: string,
  at: StateLoadErrorAt,
  missing?: boolean,
) => StateFileReadFailure;
export interface LoadStateOptions {
  fetch?: FetchStateFile;
  stateFile: string;
  demoFile: string;
  read: StateFileParser;
}
/** Where the booted presentation came from, and what went wrong on the way. */
export interface LoadedStateOutcome {
  origin: "instance" | "demo" | "failed";
  stateFileFound?: boolean;
  errorAt?: StateLoadErrorAt;
  state: StateEnvelope;
  error?: string | undefined;
  note?: string | undefined;
}

declare module "../bindings" {
  interface RuntimeBindings {
    StateFileReadFailure: StateFileReadFailureConstructor;
    EMPTY_FILE_STATE_PAGE_PARTS: ArtifactPageParts;
    unavailableStateStorageSlot: StorageSlot<string>;
    readStateFile: (
      fetchFile: FetchStateFile,
      path: string,
      parseFile: StateFileParser,
    ) => Promise<StateFileContents | StateFileReadFailure>;
    loadInstanceOrDemoState: (
      options: LoadStateOptions,
    ) => Promise<LoadedStateOutcome>;
    stateEnvelopeTitle: (envelope: StateEnvelope) => string | undefined;
    readableStateStorageSlot: (text: string) => StorageSlot<string>;
  }
}

export function installBootStateFile(runtime: RuntimeBindings): () => void {
  var StateFileReadFailure: StateFileReadFailureConstructor;
  var EMPTY_FILE_STATE_PAGE_PARTS: ArtifactPageParts;
  var unavailableStateStorageSlot: StorageSlot<string>;
  async function readStateFile(
    fetchFile: FetchStateFile,
    path: string,
    parseFile: StateFileParser,
  ): Promise<StateFileContents | StateFileReadFailure> {
    try {
      let value = await fetchFile(path);
      if (!value.ok) {
        return new StateFileReadFailure(
          path + ": HTTP " + String(value.status),
          "fetch",
          value.status === 404,
        );
      }
      let value2 = await value.text(),
        value3: string | StateFileContents;
      try {
        value3 = parseFile(value2);
      } catch {
        return new StateFileReadFailure(path + ": unreadable", "read");
      }
      if (typeof value3 === "string") {
        return new StateFileReadFailure(path + ": " + value3, "read");
      } else {
        return value3;
      }
    } catch (value) {
      return new StateFileReadFailure(
        path + ": " + (value instanceof Error ? value.message : String(value)),
        "fetch",
      );
    }
  }
  async function loadInstanceOrDemoState(
    options: LoadStateOptions,
  ): Promise<LoadedStateOutcome> {
    let fetchFile =
        options.fetch ?? ((input: string) => fetch(input)),
      instanceOutcome = await readStateFile(
        fetchFile,
        options.stateFile,
        options.read,
      );
    if (!(instanceOutcome instanceof StateFileReadFailure)) {
      return {
        state: instanceOutcome.envelope,
        origin: "instance",
        note: instanceOutcome.note,
      };
    }
    let value = await readStateFile(
        fetchFile,
        options.demoFile,
        options.read,
      ),
      value2 = !instanceOutcome.missing;
    if (!(value instanceof StateFileReadFailure)) {
      return {
        state: value.envelope,
        origin: "demo",
        error: instanceOutcome.fail,
        stateFileFound: value2,
        errorAt: instanceOutcome.at,
        note: value.note,
      };
    }
    let value3 = instanceOutcome.missing
      ? value.at
      : instanceOutcome.at;
    return {
      state: {},
      origin: "failed",
      error: instanceOutcome.fail + "; " + value.fail,
      stateFileFound: value2,
      errorAt: value3,
    };
  }
  function stateEnvelopeTitle(envelope: StateEnvelope): string | undefined {
    let title = envelope.title;
    if (typeof title === "string" && title.length > 0) {
      return (0, runtime.truncateUtf16Safely)(title, 200);
    } else {
      return undefined;
    }
  }
  function readableStateStorageSlot(text: string): StorageSlot<string> {
    return {
      read: () => text,
      write: () => true,
      clear() {},
    };
  }
  bindRuntimeValue(
    runtime,
    "StateFileReadFailure",
    () => StateFileReadFailure,
    (value) => {
      StateFileReadFailure = value;
    },
  );
  bindRuntimeValue(runtime, "readStateFile", () => readStateFile);
  bindRuntimeValue(
    runtime,
    "loadInstanceOrDemoState",
    () => loadInstanceOrDemoState,
  );
  bindRuntimeValue(runtime, "stateEnvelopeTitle", () => stateEnvelopeTitle);
  bindRuntimeValue(
    runtime,
    "EMPTY_FILE_STATE_PAGE_PARTS",
    () => EMPTY_FILE_STATE_PAGE_PARTS,
    (value) => {
      EMPTY_FILE_STATE_PAGE_PARTS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "readableStateStorageSlot",
    () => readableStateStorageSlot,
  );
  bindRuntimeValue(
    runtime,
    "unavailableStateStorageSlot",
    () => unavailableStateStorageSlot,
    (value) => {
      unavailableStateStorageSlot = value;
    },
  );
  return () => {
    (0, runtime.initializeUiInputs210)();
    StateFileReadFailure = class StateFileReadFailure {
      fail: string;
      at: StateLoadErrorAt;
      missing: boolean;
      constructor(
        input: string,
        options: StateLoadErrorAt,
        context: boolean = false,
      ) {
        this.fail = input;
        this.at = options;
        this.missing = context;
      }
    };
    EMPTY_FILE_STATE_PAGE_PARTS = {
      title: "",
      readme: "",
      readmeMeta: "",
      css: "",
      js: "",
      emulator: false,
    };
    unavailableStateStorageSlot = {
      read: () => null,
      write: () => false,
      clear() {},
    };
  };
}
