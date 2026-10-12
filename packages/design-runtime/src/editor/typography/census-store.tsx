/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorTypographyCensusStore(
  runtime: RuntimeBindings,
): () => void {
  var reactTypographyCensusStore: Dynamic;
  var TypographyCensusStoreSizesSizeRolesSizeFamiliesConfig: Dynamic;
  var TypographyCensusStoreResolvedValue: Dynamic;
  var TypographyCensusStoreAlias: Dynamic;
  var TypographyCensusStoreSubscribers: Dynamic;
  function updateTypographyCensus(input?: Dynamic): Dynamic {
    let value: Dynamic = JSON.stringify(input);
    if (value !== TypographyCensusStoreAlias) {
      TypographyCensusStoreAlias = value;
      TypographyCensusStoreResolvedValue =
        input.sizes.length === 0 &&
        Object.keys(input.sizeRoles).length === 0 &&
        Object.keys(input.sizeFamilies).length === 0
          ? TypographyCensusStoreSizesSizeRolesSizeFamiliesConfig
          : input;
      for (let value2 of TypographyCensusStoreSubscribers as Dynamic) value2();
    }
  }
  function getTypographyCensus(): Dynamic {
    return TypographyCensusStoreResolvedValue;
  }
  function subscribeTypographyCensus(input?: Dynamic): Dynamic {
    TypographyCensusStoreSubscribers.add(input);
    return (): Dynamic => {
      TypographyCensusStoreSubscribers.delete(input);
    };
  }
  function useTypographyCensus(): Dynamic {
    return (0, reactTypographyCensusStore.useSyncExternalStore)(
      subscribeTypographyCensus,
      getTypographyCensus,
      getTypographyCensus,
    );
  }
  bindRuntimeValue(
    runtime,
    "reactTypographyCensusStore",
    () => reactTypographyCensusStore,
    (value) => {
      reactTypographyCensusStore = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TypographyCensusStoreSizesSizeRolesSizeFamiliesConfig",
    () => TypographyCensusStoreSizesSizeRolesSizeFamiliesConfig,
    (value) => {
      TypographyCensusStoreSizesSizeRolesSizeFamiliesConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TypographyCensusStoreResolvedValue",
    () => TypographyCensusStoreResolvedValue,
    (value) => {
      TypographyCensusStoreResolvedValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TypographyCensusStoreAlias",
    () => TypographyCensusStoreAlias,
    (value) => {
      TypographyCensusStoreAlias = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TypographyCensusStoreSubscribers",
    () => TypographyCensusStoreSubscribers,
    (value) => {
      TypographyCensusStoreSubscribers = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "updateTypographyCensus",
    () => updateTypographyCensus,
  );
  bindRuntimeValue(runtime, "getTypographyCensus", () => getTypographyCensus);
  bindRuntimeValue(
    runtime,
    "subscribeTypographyCensus",
    () => subscribeTypographyCensus,
  );
  bindRuntimeValue(runtime, "useTypographyCensus", () => useTypographyCensus);
  return () => {
    reactTypographyCensusStore = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react)(),
      1,
    );
    TypographyCensusStoreSizesSizeRolesSizeFamiliesConfig = {
      sizes: [],
      sizeRoles: {},
      sizeFamilies: {},
    };
    TypographyCensusStoreResolvedValue =
      TypographyCensusStoreSizesSizeRolesSizeFamiliesConfig;
    TypographyCensusStoreAlias = JSON.stringify(
      TypographyCensusStoreSizesSizeRolesSizeFamiliesConfig,
    );
    TypographyCensusStoreSubscribers = new Set();
  };
}
