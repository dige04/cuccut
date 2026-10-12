/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorModelPendingProps(
  runtime: RuntimeBindings,
): () => void {
  function getPendingPropKeys(input?: Dynamic, options?: Dynamic): Dynamic {
    let value: Dynamic = (0, runtime.getDcPropsJson)(input);
    if (value == null) return null;
    let value2: Dynamic;
    try {
      value2 = JSON.parse(value);
    } catch {
      return null;
    }
    if (value2 == null || typeof value2 != "object" || Array.isArray(value2))
      return null;
    let value3: Dynamic = value2;
    for (let [value4, value5] of Object.entries(options) as Dynamic) {
      let value6: Dynamic = value3[value4],
        value7: Dynamic =
          value6 && typeof value6 == "object" && !Array.isArray(value6)
            ? value6
            : {};
      value3[value4] = {
        ...value7,
        default: value5,
      };
    }
    return (0, runtime.setDcPropsJson)(input, JSON.stringify(value3));
  }
  function getSavedPendingProps(input?: Dynamic, options?: Dynamic): Dynamic {
    if (options === undefined) return;
    let value: Dynamic = (0, runtime.getDcPropsJson)(input);
    if (value == null) return;
    let value2: Dynamic;
    try {
      value2 = JSON.parse(value);
    } catch {
      return;
    }
    if (value2 == null || typeof value2 != "object" || Array.isArray(value2))
      return;
    let value3: Dynamic = value2,
      state: Dynamic = {};
    for (let value4 of Object.keys(options) as Dynamic) {
      let value5: Dynamic = Object.hasOwn(value3, value4)
          ? value3[value4]
          : undefined,
        value6: Dynamic =
          value5 != null && typeof value5 == "object" && !Array.isArray(value5)
            ? value5.default
            : undefined;
      typeof value6 == "string" && (state[value4] = value6);
    }
    return Object.keys(state).length > 0 ? state : undefined;
  }
  function clearSavedPendingProps(input?: Dynamic): Dynamic {
    let pendingProps: Dynamic = input.pendingProps,
      value: Dynamic = getSavedPendingProps(input.src, pendingProps);
    if (pendingProps === undefined || value === undefined) return;
    let value2: Dynamic = Object.fromEntries(
        Object.entries(pendingProps).filter(
          ([input2, input3]: Dynamic): Dynamic =>
            !(Object.hasOwn(value, input2) && value[input2] === input3),
        ),
      ),
      length: Dynamic = Object.keys(value2).length;
    if (length === 0) {
      input.pendingProps = undefined;
      input.pendingPropsBase = undefined;
      return;
    }
    length < Object.keys(pendingProps).length && (input.pendingProps = value2);
    input.pendingPropsBase =
      (0, runtime.getDcPropsJson)(input.src) ?? input.pendingPropsBase;
  }
  bindRuntimeValue(runtime, "getPendingPropKeys", () => getPendingPropKeys);
  bindRuntimeValue(runtime, "getSavedPendingProps", () => getSavedPendingProps);
  bindRuntimeValue(
    runtime,
    "clearSavedPendingProps",
    () => clearSavedPendingProps,
  );
  return () => {};
}
