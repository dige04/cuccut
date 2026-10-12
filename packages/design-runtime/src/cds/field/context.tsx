import type { FieldState } from "../../contracts/ui";
import type * as React from "react";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../../runtime-types";
export function installCdsFieldContext(runtime: RuntimeBindings): () => void {
  var reactFieldContext: typeof React;
  var FieldStateContext: React.Context<FieldState | null>;
  var initializeFieldContext: () => void;
  function useFieldInvalid(): boolean {
    return (
      (0, reactFieldContext.useContext)(FieldStateContext)?.invalid ?? false
    );
  }
  function useFieldDisabled(): boolean {
    return (
      (0, reactFieldContext.useContext)(FieldStateContext)?.disabled ?? false
    );
  }
  function isInsideField(): boolean {
    return (0, reactFieldContext.useContext)(FieldStateContext) !== null;
  }
  bindRuntimeValue(runtime, "useFieldInvalid", () => useFieldInvalid);
  bindRuntimeValue(runtime, "useFieldDisabled", () => useFieldDisabled);
  bindRuntimeValue(runtime, "isInsideField", () => isInsideField);
  bindRuntimeValue(
    runtime,
    "reactFieldContext",
    () => reactFieldContext,
    (value) => {
      reactFieldContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FieldStateContext",
    () => FieldStateContext,
    (value) => {
      FieldStateContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeFieldContext",
    () => initializeFieldContext,
    (value) => {
      initializeFieldContext = value;
    },
  );
  return () => {
    initializeFieldContext = (0, runtime.initializeOnce)(() => {
      "use client";

      reactFieldContext = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react)(),
      );
      FieldStateContext = (0,
      reactFieldContext.createContext)<FieldState | null>(null);
    });
  };
}
