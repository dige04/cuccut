/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorModelModelState(
  runtime: RuntimeBindings,
): () => void {
  var ModelModelStateConstant: Dynamic;
  var ModelModelStateLimit: Dynamic;
  var DcModelKey: Dynamic;
  var ModelModelStateDataDcDraggingDataDcDragParentDataDcDragFollowerValues: Dynamic;
  var ModelModelStateSubscribers: Dynamic;
  function serializeAsyncFileTask(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    let value: Dynamic = (input.get(options) ?? Promise.resolve()).then(
        context,
        context,
      ),
      value2: Dynamic = value.then(
        (): Dynamic => {},
        (): Dynamic => {},
      );
    input.set(options, value2);
    value2.finally((): Dynamic => {
      input.get(options) === value2 && input.delete(options);
    });
    return value;
  }
  function recordModelUndo(
    input?: Dynamic,
    options?: Dynamic,
    context: Dynamic = ModelModelStateConstant,
  ): Dynamic {
    return input.model.serialize() === options
      ? false
      : (input.undo.push(options),
        (0, runtime.trimUndoHistory)(input, input.undo.length - context),
        (input.redo = []),
        true);
  }
  function resetModelBaselines(input?: Dynamic): Dynamic {
    input.each((input2?: Dynamic, options?: Dynamic): Dynamic => {
      !options.dirty &&
      options.pendingScript === undefined &&
      options.pendingProps === undefined
        ? ((options.originalTemplate = options.model.serialize()),
          (options.carriedEditCount = 0))
        : (options.carriedEditCount =
            (options.carriedEditCount ?? 0) +
            options.undo.filter(
              (input3?: Dynamic): Dynamic => typeof input3 == "string",
            ).length);
      (0, runtime.resetUndoHistory)(options);
    });
  }
  function stripDragAttributes(input?: Dynamic): Dynamic {
    return input.replace(
      / data-dc-drag(?:ging|-parent|-follower|-block)="\d+"/g,
      "",
    );
  }
  function getPreDragBaseline(input?: Dynamic): Dynamic {
    return input.previewBaseline !== undefined &&
      / data-dc-dragging="\d+"/.test(input.model.serialize())
      ? input.previewBaseline
      : undefined;
  }
  function serializeStableModel(input?: Dynamic): Dynamic {
    return stripDragAttributes(
      getPreDragBaseline(input) ?? input.model.serialize(),
    );
  }
  function hasUnsavedModelChanges(input?: Dynamic): Dynamic {
    let flag: Dynamic = false;
    input.each((input2?: Dynamic, options?: Dynamic): Dynamic => {
      serializeStableModel(options) !==
        stripDragAttributes(options.originalTemplate) && (flag = true);
      options.pendingScript !== undefined &&
        options.pendingScript !== options.pendingScriptBase &&
        (flag = true);
      options.pendingProps !== undefined &&
        Object.keys(options.pendingProps).length > 0 &&
        (flag = true);
    });
    return flag;
  }
  function rebuildModelTemplate(input?: Dynamic, options?: Dynamic): Dynamic {
    return input.rebuild(options).serialize();
  }
  function adoptModelVersion(input?: Dynamic, options?: Dynamic): Dynamic {
    (input.adoptedVersion === undefined || options > input.adoptedVersion) &&
      (input.adoptedVersion = options);
  }
  function warnUnreadableDcDocument(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    let value: Dynamic =
      input +
      `
` +
      context;
    ModelModelStateSubscribers.has(value) ||
      !/<x-dc[\s/>]/i.test(options) ||
      (ModelModelStateSubscribers.add(value),
      console.warn(
        "[dc-model] " +
          input +
          ": the editor cannot read where the <x-dc> markup ends, so " +
          context +
          ". If this file is an artboard, most likely its '</x-dc>' line is missing or misspelt: put '</x-dc>' on its own line after the markup, before the <script data-dc-script> block.",
      ));
  }
  bindRuntimeValue(
    runtime,
    "serializeAsyncFileTask",
    () => serializeAsyncFileTask,
  );
  bindRuntimeValue(
    runtime,
    "ModelModelStateConstant",
    () => ModelModelStateConstant,
    (value) => {
      ModelModelStateConstant = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ModelModelStateLimit",
    () => ModelModelStateLimit,
    (value) => {
      ModelModelStateLimit = value;
    },
  );
  bindRuntimeValue(runtime, "recordModelUndo", () => recordModelUndo);
  bindRuntimeValue(
    runtime,
    "DcModelKey",
    () => DcModelKey,
    (value) => {
      DcModelKey = value;
    },
  );
  bindRuntimeValue(runtime, "resetModelBaselines", () => resetModelBaselines);
  bindRuntimeValue(
    runtime,
    "ModelModelStateDataDcDraggingDataDcDragParentDataDcDragFollowerValues",
    () => ModelModelStateDataDcDraggingDataDcDragParentDataDcDragFollowerValues,
    (value) => {
      ModelModelStateDataDcDraggingDataDcDragParentDataDcDragFollowerValues =
        value;
    },
  );
  bindRuntimeValue(runtime, "stripDragAttributes", () => stripDragAttributes);
  bindRuntimeValue(runtime, "getPreDragBaseline", () => getPreDragBaseline);
  bindRuntimeValue(runtime, "serializeStableModel", () => serializeStableModel);
  bindRuntimeValue(
    runtime,
    "hasUnsavedModelChanges",
    () => hasUnsavedModelChanges,
  );
  bindRuntimeValue(runtime, "rebuildModelTemplate", () => rebuildModelTemplate);
  bindRuntimeValue(runtime, "adoptModelVersion", () => adoptModelVersion);
  bindRuntimeValue(
    runtime,
    "ModelModelStateSubscribers",
    () => ModelModelStateSubscribers,
    (value) => {
      ModelModelStateSubscribers = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "warnUnreadableDcDocument",
    () => warnUnreadableDcDocument,
  );
  return () => {
    ModelModelStateConstant = 100;
    ModelModelStateLimit = 1200;
    DcModelKey = "dc-model";
    ModelModelStateDataDcDraggingDataDcDragParentDataDcDragFollowerValues = [
      "data-dc-dragging",
      "data-dc-drag-parent",
      "data-dc-drag-follower",
      "data-dc-drag-block",
    ];
    ModelModelStateSubscribers = new Set();
  };
}
