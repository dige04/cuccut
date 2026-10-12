/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type ReactNamespace,
} from "../bindings";
import type {
  DesignSystem,
  DesignTokenGrouping,
  DesignTypeToken,
} from "./tokens";

/** One colour row of the design systems panel. */
export interface DesignSystemColorRow extends DesignTokenGrouping {
  name: string;
  value: string;
  label: string;
}
/** One typography row of the design systems panel; `system` is the index of the owning design system. */
export interface DesignSystemTypeRow extends DesignTokenGrouping {
  id: string;
  system: number;
  style: DesignTypeToken;
  subtitle: string;
}

declare module "../bindings" {
  interface RuntimeBindings {
    DesignSystemsReact: ReactNamespace;
    emptyDesignSystems: DesignSystem[];
    designSystemsSnapshot: DesignSystem[];
    lastDesignSystemsPayload: unknown;
    lastDesignSystemsJson: string;
    designSystemsSubscribers: Set<() => void>;
    initializeDesignSystemsStore: () => void;
    publishDesignSystems: (payload?: unknown) => void;
    getDesignSystemsSnapshot: () => DesignSystem[];
    subscribeDesignSystems: (subscriber: () => void) => () => void;
    useDesignSystems: () => DesignSystem[];
    hasDesignSystems: (systems: DesignSystem[]) => boolean;
    designSystemColorRows: (systems: DesignSystem[]) => DesignSystemColorRow[];
    designSystemTypeRows: (systems: DesignSystem[]) => DesignSystemTypeRow[];
  }
}

export function installDesignSystemStore(runtime: RuntimeBindings): () => void {
  var DesignSystemsReact: ReactNamespace;
  var emptyDesignSystems: RuntimeBindings["emptyDesignSystems"];
  var designSystemsSnapshot: RuntimeBindings["designSystemsSnapshot"];
  var lastDesignSystemsPayload: RuntimeBindings["lastDesignSystemsPayload"];
  var lastDesignSystemsJson: RuntimeBindings["lastDesignSystemsJson"];
  var designSystemsSubscribers: RuntimeBindings["designSystemsSubscribers"];
  var initializeDesignSystemsStore: RuntimeBindings["initializeDesignSystemsStore"];
  function publishDesignSystems(payload?: unknown): void {
    if (payload === lastDesignSystemsPayload) {
      return;
    }
    lastDesignSystemsPayload = payload;
    let value = (0, runtime.normalizeDesignSystems)(payload),
      value2 = JSON.stringify(value);
    if (value2 === lastDesignSystemsJson) {
      return;
    }
    lastDesignSystemsJson = value2;
    designSystemsSnapshot = value.length === 0 ? emptyDesignSystems : value;
    for (let value3 of designSystemsSubscribers) value3();
  }
  function getDesignSystemsSnapshot(): DesignSystem[] {
    return designSystemsSnapshot;
  }
  function subscribeDesignSystems(subscriber: () => void): () => void {
    designSystemsSubscribers.add(subscriber);
    return (): void => void designSystemsSubscribers.delete(subscriber);
  }
  function useDesignSystems(): DesignSystem[] {
    return DesignSystemsReact.useSyncExternalStore(
      subscribeDesignSystems,
      getDesignSystemsSnapshot,
      getDesignSystemsSnapshot,
    );
  }
  function hasDesignSystems(systems: DesignSystem[]): boolean {
    return systems.length > 0;
  }
  function designSystemColorRows(
    systems: DesignSystem[],
  ): DesignSystemColorRow[] {
    return systems.flatMap((input) =>
      input.colors.map(
        (input2): DesignSystemColorRow => ({
          name: input2.name,
          value: input2.value,
          label: input2.name,
          ...(0, runtime.designSystemColorGrouping)(input, input2),
        }),
      ),
    );
  }
  function designSystemTypeRows(
    systems: DesignSystem[],
  ): DesignSystemTypeRow[] {
    return systems.flatMap(
      (input, options) =>
        (input.type ?? []).map(
          (input2): DesignSystemTypeRow => ({
            id: "ds-" + String(options) + "-" + input2.name,
            system: options,
            style: input2,
            subtitle: (0, runtime.typographyTokenSubtitle)(input2),
            ...(0, runtime.designSystemTypeGrouping)(input, input2),
          }),
        ),
    );
  }
  bindRuntimeValue(runtime, "publishDesignSystems", () => publishDesignSystems);
  bindRuntimeValue(
    runtime,
    "getDesignSystemsSnapshot",
    () => getDesignSystemsSnapshot,
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
    "designSystemColorRows",
    () => designSystemColorRows,
  );
  bindRuntimeValue(runtime, "designSystemTypeRows", () => designSystemTypeRows);
  bindRuntimeValue(
    runtime,
    "DesignSystemsReact",
    () => DesignSystemsReact,
    (value) => {
      DesignSystemsReact = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "emptyDesignSystems",
    () => emptyDesignSystems,
    (value) => {
      emptyDesignSystems = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "designSystemsSnapshot",
    () => designSystemsSnapshot,
    (value) => {
      designSystemsSnapshot = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "lastDesignSystemsPayload",
    () => lastDesignSystemsPayload,
    (value) => {
      lastDesignSystemsPayload = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "lastDesignSystemsJson",
    () => lastDesignSystemsJson,
    (value) => {
      lastDesignSystemsJson = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "designSystemsSubscribers",
    () => designSystemsSubscribers,
    (value) => {
      designSystemsSubscribers = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeDesignSystemsStore",
    () => initializeDesignSystemsStore,
    (value) => {
      initializeDesignSystemsStore = value;
    },
  );
  return () => {
    lastDesignSystemsPayload = undefined;
    lastDesignSystemsJson = "[]";
    initializeDesignSystemsStore = (0, runtime.initializeOnce)((): void => {
      (0, runtime.initializeDesignTokenParser)();
      DesignSystemsReact = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      emptyDesignSystems = [];
      designSystemsSnapshot = emptyDesignSystems;
      designSystemsSubscribers = new Set();
    });
  };
}
