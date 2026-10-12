/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type JsxNamespace,
  type ReactNamespace,
} from "../bindings";

/** Agent surfaces the "hand off" action can open. */
export type HandoffTarget = "cowork" | "code" | "coworker";

declare module "../bindings" {
  interface RuntimeBindings {
    reactLH0: ReactNamespace;
    jsxzd: JsxNamespace;
    HANDOFF_TARGETS: readonly HandoffTarget[];
    HANDOFF_TARGET_STORAGE_KEY: string;
    /** The remembered hand-off target, or null when none (or an unknown one) is stored. */
    preferredHandoffTarget: HandoffTarget | null;
  }
}

export function installHostHandoffPreference(
  runtime: RuntimeBindings,
): () => void {
  var reactLH0: ReactNamespace;
  var jsxzd: JsxNamespace;
  var HANDOFF_TARGETS: readonly HandoffTarget[];
  var HANDOFF_TARGET_STORAGE_KEY: string;
  var preferredHandoffTarget: HandoffTarget | null;

  bindRuntimeValue(
    runtime,
    "reactLH0",
    () => reactLH0,
    (value) => {
      reactLH0 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxzd",
    () => jsxzd,
    (value) => {
      jsxzd = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "HANDOFF_TARGETS",
    () => HANDOFF_TARGETS,
    (value) => {
      HANDOFF_TARGETS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "HANDOFF_TARGET_STORAGE_KEY",
    () => HANDOFF_TARGET_STORAGE_KEY,
    (value) => {
      HANDOFF_TARGET_STORAGE_KEY = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "preferredHandoffTarget",
    () => preferredHandoffTarget,
    (value) => {
      preferredHandoffTarget = value;
    },
  );
  return () => {
    reactLH0 = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    jsxzd = (0, runtime.toModuleNamespace)((0, runtime.loadJsxNamespace)(), 1);
    HANDOFF_TARGETS = ["cowork", "code", "coworker"];
    HANDOFF_TARGET_STORAGE_KEY = "appifact.handOff.target";
    preferredHandoffTarget = null;
    try {
      let value = localStorage.getItem(HANDOFF_TARGET_STORAGE_KEY);
      preferredHandoffTarget =
        HANDOFF_TARGETS.find((input: HandoffTarget): boolean => input === value) ??
        null;
    } catch {
      preferredHandoffTarget = null;
    }
  };
}
