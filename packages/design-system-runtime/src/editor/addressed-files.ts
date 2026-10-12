import type * as React from "react";
import type * as Editor from "../contracts/editor-runtime";
import type * as Model from "../contracts";
import type * as Application from "../contracts/application";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installEditorAddressedFiles(
  runtime: RuntimeBindings,
): () => void {
  var fileVersionResolver: (path: string) => string | undefined;
  var setFileVersionResolver: (
    resolver: (path: string) => string | undefined,
  ) => void;
  var resolveFileVersion: (path: string) => string | undefined;
  var addressedVersionResolver: () => string | undefined;
  var setAddressedVersionResolver: (resolver: () => string | undefined) => void;
  var addressedFileSubscribers: Set<() => void>;
  var subscribeAddressedFiles: (listener: () => void) => () => void;
  var notifyAddressedFiles: () => void;
  var createAddressedFileLoadState: (
    version?: string,
    src?: string,
  ) => Editor.AddressedLoadState;
  var MAX_ADDRESS_REFUSAL_ROUNDS: number;
  function addressedProjectFileUrl(
    path: string,
    baseURI: string | undefined = globalThis.document?.baseURI,
  ): string | undefined {
    let version = addressedVersionResolver();
    if (
      version === undefined ||
      !/^[A-Za-z0-9_-]{1,64}$/.test(version) ||
      baseURI === undefined
    ) {
      return;
    }
    let pathname: string;
    try {
      pathname = new URL(
        (0, runtime.encodeRelativeUrlPath)((0, runtime.projectFilePath)(path)),
        baseURI,
      ).pathname;
    } catch {
      return;
    }
    let match = /^\/_f\/([^/]+)\//.exec(pathname);
    if (match === null || match[1] === version) {
      return undefined;
    } else {
      return "/_f/" + version + "/" + pathname.slice(match[0].length);
    }
  }
  function currentAddressedFileSource(
    state: Editor.AddressedLoadState,
    getSource: Editor.FileSource,
  ): string | undefined {
    if (state.refused !== null) {
      if (
        state.rounds > MAX_ADDRESS_REFUSAL_ROUNDS ||
        getSource() === state.refused.under
      ) {
        return state.src;
      }
      resetAddressedFileLoadState(state);
    }
    if (!state.loaded && !state.stay) {
      state.src = getSource();
    }
    return state.src;
  }
  function refreshAddressedFileVersion(
    state: Editor.AddressedLoadState,
    version: string | undefined,
    getSource?: Editor.FileSource,
  ): number {
    if (
      version !== undefined &&
      state.last !== undefined &&
      version !== state.last
    ) {
      state.last = version;
      state.loads++;
      state.loaded = false;
      state.rounds = 0;
      resetAddressedFileLoadState(state);
      if (getSource !== undefined) {
        state.src = getSource();
      }
    } else if (version !== undefined && state.last === undefined) {
      state.last = version;
    }
    return state.loads;
  }
  function resetAddressedFileLoadState(state: Editor.AddressedLoadState): void {
    state.stay = false;
    state.again = false;
    state.other = false;
    state.gaveUpAt = null;
    state.next = null;
    state.refused = null;
  }
  function refuseAddressedFileSource(
    state: Editor.AddressedLoadState,
    getSource: Editor.FileSource,
  ): void {
    state.refused = {
      under: getSource(),
    };
    state.rounds++;
  }
  function retryAddressedFileSource(
    state: Editor.AddressedLoadState,
    getSource?: Editor.FileSource,
  ): boolean {
    if (state.gaveUpAt === state.last || state.next !== null) {
      return false;
    }
    let nextSource = getSource?.();
    if (state.src === nextSource && !state.again) {
      state.again = true;
      state.next = {
        src: state.src,
      };
    } else if (
      state.src === nextSource &&
      nextSource !== undefined &&
      !state.other
    ) {
      state.other = true;
      state.next = {
        src: undefined,
      };
    } else if (state.src !== nextSource && !state.other) {
      state.other = true;
      state.next = {
        src: nextSource,
      };
    } else {
      state.gaveUpAt = state.last;
      return false;
    }
    state.loaded = false;
    state.stay = true;
    return true;
  }
  function advanceAddressedFileSource(state: Editor.AddressedLoadState): void {
    if (state.next === null) {
      return;
    }
    state.src = state.next.src;
    state.next = null;
    state.loads++;
  }
  bindRuntimeValue(
    runtime,
    "fileVersionResolver",
    () => fileVersionResolver,
    (value) => {
      fileVersionResolver = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "setFileVersionResolver",
    () => setFileVersionResolver,
    (value) => {
      setFileVersionResolver = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "resolveFileVersion",
    () => resolveFileVersion,
    (value) => {
      resolveFileVersion = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "addressedVersionResolver",
    () => addressedVersionResolver,
    (value) => {
      addressedVersionResolver = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "setAddressedVersionResolver",
    () => setAddressedVersionResolver,
    (value) => {
      setAddressedVersionResolver = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "addressedFileSubscribers",
    () => addressedFileSubscribers,
    (value) => {
      addressedFileSubscribers = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "subscribeAddressedFiles",
    () => subscribeAddressedFiles,
    (value) => {
      subscribeAddressedFiles = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "notifyAddressedFiles",
    () => notifyAddressedFiles,
    (value) => {
      notifyAddressedFiles = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "addressedProjectFileUrl",
    () => addressedProjectFileUrl,
  );
  bindRuntimeValue(
    runtime,
    "createAddressedFileLoadState",
    () => createAddressedFileLoadState,
    (value) => {
      createAddressedFileLoadState = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "currentAddressedFileSource",
    () => currentAddressedFileSource,
  );
  bindRuntimeValue(
    runtime,
    "refreshAddressedFileVersion",
    () => refreshAddressedFileVersion,
  );
  bindRuntimeValue(
    runtime,
    "resetAddressedFileLoadState",
    () => resetAddressedFileLoadState,
  );
  bindRuntimeValue(
    runtime,
    "MAX_ADDRESS_REFUSAL_ROUNDS",
    () => MAX_ADDRESS_REFUSAL_ROUNDS,
    (value) => {
      MAX_ADDRESS_REFUSAL_ROUNDS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "refuseAddressedFileSource",
    () => refuseAddressedFileSource,
  );
  bindRuntimeValue(
    runtime,
    "retryAddressedFileSource",
    () => retryAddressedFileSource,
  );
  bindRuntimeValue(
    runtime,
    "advanceAddressedFileSource",
    () => advanceAddressedFileSource,
  );
  return () => {
    fileVersionResolver = (): undefined => {
      return;
    };
    setFileVersionResolver = (
      resolver: (path: string) => string | undefined,
    ): void => {
      fileVersionResolver = resolver;
    };
    resolveFileVersion = (path: string) => fileVersionResolver(path);
    addressedVersionResolver = (): undefined => {
      return;
    };
    setAddressedVersionResolver = (
      resolver: () => string | undefined,
    ): void => {
      addressedVersionResolver = resolver;
    };
    addressedFileSubscribers = new Set();
    subscribeAddressedFiles = (listener: () => void) => {
      addressedFileSubscribers.add(listener);
      return () => void addressedFileSubscribers.delete(listener);
    };
    notifyAddressedFiles = (): void => {
      for (let value of [...addressedFileSubscribers]) {
        try {
          value();
        } catch {}
      }
    };
    createAddressedFileLoadState = (version?: string, src?: string) => ({
      last: version,
      loads: 0,
      src: src,
      loaded: false,
      stay: false,
      again: false,
      other: false,
      gaveUpAt: null,
      next: null,
      refused: null,
      rounds: 0,
    });
    MAX_ADDRESS_REFUSAL_ROUNDS = 3;
  };
}
