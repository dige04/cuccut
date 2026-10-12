import type * as React from "react";
import type * as Editor from "../contracts/editor-runtime";
import type * as Model from "../contracts";
import type * as Application from "../contracts/application";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installEditorEditDispatch(
  runtime: RuntimeBindings,
): () => void {
  var reactAssetGroupEditor: typeof import("react");
  var summarizeChangedFileNames: (names: string[]) => string;
  function performDesignSystemEdit(
    document2: Editor.DesignSystemEditPreparation,
    edit: Application.ContentMutation,
    ready: (options?: { withoutBytes: string[] }) => boolean | void,
    options: Editor.EditPreparationOptions,
    verb: string = "change",
  ): boolean | void {
    let value = options.say ?? runtime.showEditorNotification;
    if (document2.busy()) {
      value("Still working on your previous change. Try again in a moment.");
      return false;
    }
    if (document2.needs(edit).length === 0) {
      return ready();
    }
    document2
      .prepare(edit)
      .then((input): void => {
        if (input.ok) {
          ready();
          return;
        }
        if (input.tooMany) {
          value(
            "That is too much to change at once (more than 64 files, or about 48 MB). Select fewer files, or move some out of the group first, then try again.",
          );
          return;
        }
        let value2 = summarizeChangedFileNames(
            input.failed.map(options.nameOf),
          ),
          value3: string = input.failed.length === 1 ? "it" : "them";
        if (verb === "removal" && options.ask !== undefined) {
          options.ask({
            title: "Remove anyway?",
            body:
              value2 +
              " could not be loaded, so removing " +
              value3 +
              " cannot be undone.",
            run: (): void => {
              ready({
                withoutBytes: input.failed,
              });
            },
          });
          return;
        }
        value(
          value2 +
            " could not be loaded, so nothing was changed. Try again, or reload the page if it keeps happening.",
        );
      })
      .catch(() => value("That change could not be made. Try again."));
    return true;
  }
  bindRuntimeValue(
    runtime,
    "reactAssetGroupEditor",
    () => reactAssetGroupEditor,
    (value) => {
      reactAssetGroupEditor = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "summarizeChangedFileNames",
    () => summarizeChangedFileNames,
    (value) => {
      summarizeChangedFileNames = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "performDesignSystemEdit",
    () => performDesignSystemEdit,
  );
  return () => {
    reactAssetGroupEditor = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    summarizeChangedFileNames = (names: string[]) =>
      names.length <= 3
        ? names.join(", ")
        : names.slice(0, 3).join(", ") +
          " and " +
          String(names.length - 3) +
          " more";
  };
}
