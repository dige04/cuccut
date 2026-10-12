/** Restored application module; prepare first, initialize in original order. */
import type * as React from "react";
import type * as C from "../contracts/controls";
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";

export function installUiCollaboratorTints(
  runtime: RuntimeBindings,
): () => void {
  var COLLABORATOR_TINTS: C.CollaboratorTint[];
  var COLLABORATOR_TINTS_WITH_MUTED: (C.CollaboratorTint | "muted")[];
  var jsxCollaboratorTints: typeof import("react/jsx-runtime");

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
    "jsxCollaboratorTints",
    () => jsxCollaboratorTints,
    (value) => {
      jsxCollaboratorTints = value;
    },
  );
  return () => {
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
    jsxCollaboratorTints = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
  };
}
