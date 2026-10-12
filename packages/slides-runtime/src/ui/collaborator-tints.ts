/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type JsxNamespace,
} from "../bindings";

/** Categorical chart tokens a collaborator can be tinted with, in assignment order. */
export type CollaboratorTint =
  | "categorical-1"
  | "categorical-2"
  | "categorical-3"
  | "categorical-4"
  | "categorical-5"
  | "categorical-6"
  | "categorical-7"
  | "categorical-8";

declare module "../bindings" {
  interface RuntimeBindings {
    jsxMc0: JsxNamespace;
    COLLABORATOR_TINTS: readonly CollaboratorTint[];
    COLLABORATOR_TINTS_WITH_MUTED: readonly (CollaboratorTint | "muted")[];
  }
}

export function installUiCollaboratorTints(
  runtime: RuntimeBindings,
): () => void {
  var COLLABORATOR_TINTS: readonly CollaboratorTint[];
  var COLLABORATOR_TINTS_WITH_MUTED: readonly (CollaboratorTint | "muted")[];
  var jsxMc0: JsxNamespace;

  bindRuntimeValue(
    runtime,
    "COLLABORATOR_TINTS",
    () => COLLABORATOR_TINTS,
    (value) => {
      COLLABORATOR_TINTS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COLLABORATOR_TINTS_WITH_MUTED",
    () => COLLABORATOR_TINTS_WITH_MUTED,
    (value) => {
      COLLABORATOR_TINTS_WITH_MUTED = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxMc0",
    () => jsxMc0,
    (value) => {
      jsxMc0 = value;
    },
  );
  return () => {
    (0, runtime.initializeUiPropertyIcons)();
    COLLABORATOR_TINTS = [
      "categorical-1",
      "categorical-2",
      "categorical-3",
      "categorical-4",
      "categorical-5",
      "categorical-6",
      "categorical-7",
      "categorical-8",
    ];
    COLLABORATOR_TINTS_WITH_MUTED = [...COLLABORATOR_TINTS, "muted"];
    jsxMc0 = (0, runtime.toModuleNamespace)((0, runtime.loadJsxNamespace)(), 1);
  };
}
