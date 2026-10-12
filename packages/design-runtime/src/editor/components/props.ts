/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorComponentsProps(
  runtime: RuntimeBindings,
): () => void {
  var ComponentsPropsResolvedValue: Dynamic;
  function parseComponentPropsMetadata(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
  ): Dynamic {
    let value2: Dynamic = null;
    if (options !== undefined)
      try {
        let value3: Dynamic = JSON.parse(options);
        value3 != null &&
          typeof value3 == "object" &&
          !Array.isArray(value3) &&
          (value2 = value3);
      } catch {}
    let flag: Dynamic = false,
      state: Dynamic = {};
    for (let [value3, value4] of Object.entries(input) as Dynamic) {
      let value5: Dynamic = context(value3);
      if (typeof value5 != "string") {
        state[value3] = value4;
        continue;
      }
      let value6: Dynamic =
          value2 && Object.hasOwn(value2, value3) ? value2[value3] : null,
        value7: Dynamic =
          value6 != null && typeof value6 == "object"
            ? value6.default
            : undefined;
      if (value5 === value7 && value?.keepConverged !== true) {
        flag = true;
        continue;
      }
      value5 !== value4 && (flag = true);
      state[value3] = value5;
    }
    return {
      changed: flag,
      next: Object.keys(state).length > 0 ? state : undefined,
    };
  }
  function applyComponentPropDefaults(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    let state: Dynamic = {
      ...input,
    };
    for (let [value, value2] of Object.entries(options) as Dynamic)
      Object.hasOwn(state, value) &&
        (state[value] = {
          ...state[value],
          default: value2,
        });
    return state;
  }
  function normalizeComponentPropEdit(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
  ): Dynamic {
    if (input == null || typeof input != "object")
      return {
        kind: "drop",
      };
    let prop: Dynamic = input.prop,
      value2: Dynamic = input.value;
    if (options != null && typeof options != "string")
      return {
        kind: "drop",
      };
    if (typeof prop != "string" || typeof value2 != "string")
      return {
        kind: "drop",
      };
    let value3: Dynamic = Object.hasOwn(context, prop)
        ? context[prop]
        : undefined,
      value4: Dynamic = Object.hasOwn(value, prop)
        ? value[prop]
        : value3?.default;
    if (!value3 || value3.editor !== "text" || typeof value4 != "string")
      return {
        kind: "refuse",
      };
    if (value4 !== value2)
      return {
        kind: "refuse",
      };
    let value5: Dynamic = options ?? "";
    return value5 === value4
      ? {
          kind: "noop",
        }
      : value5.length > ComponentsPropsResolvedValue
        ? {
            kind: "toolong",
          }
        : {
            kind: "commit",
            prop: prop,
            text: value5,
          };
  }
  bindRuntimeValue(
    runtime,
    "parseComponentPropsMetadata",
    () => parseComponentPropsMetadata,
  );
  bindRuntimeValue(
    runtime,
    "applyComponentPropDefaults",
    () => applyComponentPropDefaults,
  );
  bindRuntimeValue(
    runtime,
    "ComponentsPropsResolvedValue",
    () => ComponentsPropsResolvedValue,
    (value) => {
      ComponentsPropsResolvedValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "normalizeComponentPropEdit",
    () => normalizeComponentPropEdit,
  );
  return () => {
    ComponentsPropsResolvedValue = 16 * 1024;
  };
}
