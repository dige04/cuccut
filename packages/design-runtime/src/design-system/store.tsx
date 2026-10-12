/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installDesignSystemStore(runtime: RuntimeBindings): () => void {
  var reactDesignSystemStore: Dynamic;
  var DesignSystemStoreItems: Dynamic;
  var DesignSystemStoreResolvedValue: Dynamic;
  var DesignSystemStoreAlias: Dynamic;
  var DesignSystemStoreAlias_2: Dynamic;
  var DesignSystemStoreSubscribers: Dynamic;
  var DesignSystemStoreResolvedValueAlias: Dynamic;
  var DesignSystemStoreSubscribers_2: Dynamic;
  function setDesignSystems(input?: Dynamic): Dynamic {
    if (input === DesignSystemStoreAlias) return;
    DesignSystemStoreAlias = input;
    let value: Dynamic = (0, runtime.parseDesignSystems)(input),
      value2: Dynamic = JSON.stringify(value);
    if (value2 !== DesignSystemStoreAlias_2) {
      DesignSystemStoreAlias_2 = value2;
      DesignSystemStoreResolvedValue =
        value.length === 0 ? DesignSystemStoreItems : value;
      for (let value3 of DesignSystemStoreSubscribers as Dynamic) value3();
    }
  }
  function getDesignSystems(): Dynamic {
    return DesignSystemStoreResolvedValue;
  }
  function getDesignSystemColorVariables(): Dynamic {
    DesignSystemStoreResolvedValueAlias !== DesignSystemStoreResolvedValue &&
      ((DesignSystemStoreResolvedValueAlias = DesignSystemStoreResolvedValue),
      (DesignSystemStoreSubscribers_2 = new Set(
        DesignSystemStoreResolvedValue.flatMap(
          (input?: Dynamic): Dynamic =>
            input.colors.map((input2?: Dynamic): Dynamic => "--" + input2.name),
        ),
      )));
    return DesignSystemStoreSubscribers_2;
  }
  function subscribeDesignSystems(input?: Dynamic): Dynamic {
    DesignSystemStoreSubscribers.add(input);
    return (): Dynamic => {
      DesignSystemStoreSubscribers.delete(input);
    };
  }
  function useDesignSystems(): Dynamic {
    return (0, reactDesignSystemStore.useSyncExternalStore)(
      subscribeDesignSystems,
      getDesignSystems,
      getDesignSystems,
    );
  }
  function hasDesignSystems(items?: Dynamic): Dynamic {
    return items.length > 0;
  }
  function designSystemColorOptions(input?: Dynamic): Dynamic {
    return input.flatMap(
      (input2?: Dynamic): Dynamic =>
        input2.colors.map(
          (input3?: Dynamic): Dynamic => ({
            name: input3.name,
            value: input3.value,
            label: input3.name,
            ...(0, runtime.colorTokenGroupLabels)(input2, input3),
          }),
        ),
    );
  }
  function designSystemTypographyOptions(input?: Dynamic): Dynamic {
    return input.flatMap(
      (input2?: Dynamic, options?: Dynamic): Dynamic =>
        (input2.type ?? []).map(
          (input3?: Dynamic): Dynamic => ({
            id: "ds-" + String(options) + "-" + input3.name,
            system: options,
            style: input3,
            subtitle: (0, runtime.typographyStyleSubtitle)(input3),
            ...(0, runtime.typographyGroupLabels)(input2, input3),
          }),
        ),
    );
  }
  bindRuntimeValue(
    runtime,
    "reactDesignSystemStore",
    () => reactDesignSystemStore,
    (value) => {
      reactDesignSystemStore = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DesignSystemStoreItems",
    () => DesignSystemStoreItems,
    (value) => {
      DesignSystemStoreItems = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DesignSystemStoreResolvedValue",
    () => DesignSystemStoreResolvedValue,
    (value) => {
      DesignSystemStoreResolvedValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DesignSystemStoreAlias",
    () => DesignSystemStoreAlias,
    (value) => {
      DesignSystemStoreAlias = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DesignSystemStoreAlias_2",
    () => DesignSystemStoreAlias_2,
    (value) => {
      DesignSystemStoreAlias_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DesignSystemStoreSubscribers",
    () => DesignSystemStoreSubscribers,
    (value) => {
      DesignSystemStoreSubscribers = value;
    },
  );
  bindRuntimeValue(runtime, "setDesignSystems", () => setDesignSystems);
  bindRuntimeValue(runtime, "getDesignSystems", () => getDesignSystems);
  bindRuntimeValue(
    runtime,
    "DesignSystemStoreResolvedValueAlias",
    () => DesignSystemStoreResolvedValueAlias,
    (value) => {
      DesignSystemStoreResolvedValueAlias = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DesignSystemStoreSubscribers_2",
    () => DesignSystemStoreSubscribers_2,
    (value) => {
      DesignSystemStoreSubscribers_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "getDesignSystemColorVariables",
    () => getDesignSystemColorVariables,
  );
  bindRuntimeValue(
    runtime,
    "subscribeDesignSystems",
    () => subscribeDesignSystems,
  );
  bindRuntimeValue(runtime, "useDesignSystems", () => useDesignSystems);
  bindRuntimeValue(runtime, "hasDesignSystems", () => hasDesignSystems);
  bindRuntimeValue(
    runtime,
    "designSystemColorOptions",
    () => designSystemColorOptions,
  );
  bindRuntimeValue(
    runtime,
    "designSystemTypographyOptions",
    () => designSystemTypographyOptions,
  );
  return () => {
    reactDesignSystemStore = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react)(),
      1,
    );
    DesignSystemStoreItems = [];
    DesignSystemStoreResolvedValue = DesignSystemStoreItems;
    DesignSystemStoreAlias_2 = "[]";
    DesignSystemStoreSubscribers = new Set();
    DesignSystemStoreSubscribers_2 = new Set();
  };
}
