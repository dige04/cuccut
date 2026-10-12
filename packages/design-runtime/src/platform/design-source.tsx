/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installPlatformDesignSource(
  runtime: RuntimeBindings,
): () => void {
  var reactPlatformDesignSource: Dynamic;
  var PlatformDesignSourceItems: Dynamic;
  var getTrustedHostOriginsValue: Dynamic;
  var PlatformDesignSourceAlias: Dynamic;
  var PlatformDesignSourceAlias_2: Dynamic;
  var PlatformDesignSourceSubscribers: Dynamic;
  function getTrustedHostOrigins(
    input: Dynamic = typeof window == "object" ? window : undefined,
  ): Dynamic {
    try {
      let value: Dynamic = input?.__FRAME_PREAMBLE?.origins;
      if (Array.isArray(value))
        return value.filter(
          (input2?: Dynamic): Dynamic => typeof input2 == "string",
        );
    } catch {}
    return PlatformDesignSourceItems;
  }
  function setDesignSource(input?: Dynamic): Dynamic {
    if (
      !(
        input === PlatformDesignSourceAlias ||
        (input !== null &&
          PlatformDesignSourceAlias !== null &&
          input.url === PlatformDesignSourceAlias.url &&
          input.projectId === PlatformDesignSourceAlias.projectId &&
          input.exportedAt === PlatformDesignSourceAlias.exportedAt)
      )
    ) {
      PlatformDesignSourceAlias = input;
      for (let value of PlatformDesignSourceSubscribers as Dynamic) value();
    }
  }
  function updateDesignSourceFile(input?: Dynamic): Dynamic {
    input !== PlatformDesignSourceAlias_2 &&
      ((PlatformDesignSourceAlias_2 = input), setDesignSource(null));
  }
  function getDesignSource(): Dynamic {
    return PlatformDesignSourceAlias;
  }
  function subscribeDesignSource(input?: Dynamic): Dynamic {
    PlatformDesignSourceSubscribers.add(input);
    return (): Dynamic => {
      PlatformDesignSourceSubscribers.delete(input);
    };
  }
  function useDesignSource(): Dynamic {
    return (0, reactPlatformDesignSource.useSyncExternalStore)(
      subscribeDesignSource,
      getDesignSource,
      getDesignSource,
    );
  }
  bindRuntimeValue(
    runtime,
    "reactPlatformDesignSource",
    () => reactPlatformDesignSource,
    (value) => {
      reactPlatformDesignSource = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformDesignSourceItems",
    () => PlatformDesignSourceItems,
    (value) => {
      PlatformDesignSourceItems = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "getTrustedHostOrigins",
    () => getTrustedHostOrigins,
  );
  bindRuntimeValue(
    runtime,
    "getTrustedHostOriginsValue",
    () => getTrustedHostOriginsValue,
    (value) => {
      getTrustedHostOriginsValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformDesignSourceAlias",
    () => PlatformDesignSourceAlias,
    (value) => {
      PlatformDesignSourceAlias = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformDesignSourceAlias_2",
    () => PlatformDesignSourceAlias_2,
    (value) => {
      PlatformDesignSourceAlias_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformDesignSourceSubscribers",
    () => PlatformDesignSourceSubscribers,
    (value) => {
      PlatformDesignSourceSubscribers = value;
    },
  );
  bindRuntimeValue(runtime, "setDesignSource", () => setDesignSource);
  bindRuntimeValue(
    runtime,
    "updateDesignSourceFile",
    () => updateDesignSourceFile,
  );
  bindRuntimeValue(runtime, "getDesignSource", () => getDesignSource);
  bindRuntimeValue(
    runtime,
    "subscribeDesignSource",
    () => subscribeDesignSource,
  );
  bindRuntimeValue(runtime, "useDesignSource", () => useDesignSource);
  return () => {
    reactPlatformDesignSource = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react)(),
      1,
    );
    // CucCut: no host frame is trusted by default; a page that needs one declares origins in __FRAME_PREAMBLE.
    PlatformDesignSourceItems = [];
    getTrustedHostOriginsValue = getTrustedHostOrigins();
    PlatformDesignSourceAlias = null;
    PlatformDesignSourceSubscribers = new Set();
  };
}
