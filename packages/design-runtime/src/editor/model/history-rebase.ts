/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorModelHistoryRebase(
  runtime: RuntimeBindings,
): () => void {
  var ModelHistoryRebaseAlias: Dynamic;
  var ModelHistoryRebaseAlias_2: Dynamic;
  var ModelHistoryRebaseHandler: Dynamic;
  var ModelHistoryRebaseHandler_2: Dynamic;
  var ModelHistoryRebaseUndo: Dynamic;
  var ModelHistoryRebaseCache: Dynamic;
  var ModelHistoryRebaseLimit: Dynamic;
  var ModelHistoryRebaseNow: Dynamic;
  var ModelHistoryRebaseSet: Dynamic;
  var ModelHistoryRebaseDelete: Dynamic;
  var ModelHistoryRebaseNowValue: Dynamic;
  var ModelHistoryRebaseHandler_3: Dynamic;
  var ModelHistoryRebaseHandler_4: Dynamic;
  function isRecentlyEditedFile(
    input?: Dynamic,
    options: Dynamic = ModelHistoryRebaseNow(),
  ): Dynamic {
    let entry: Dynamic = ModelHistoryRebaseCache.get(input);
    entry !== undefined &&
      options - entry > ModelHistoryRebaseLimit &&
      ModelHistoryRebaseCache.delete(input);
    return ModelHistoryRebaseCache.has(input);
  }
  function rebaseUndoEntries(
    items?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    if (items.length === 0 || options === context)
      return {
        kept: [...items],
        dropped: 0,
      };
    let items2: Dynamic = [],
      value: Dynamic;
    for (let value2: Dynamic = items.length - 1; value2 >= 0; value2--) {
      let value3: Dynamic = items[value2];
      if (typeof value3 != "string") {
        value =
          "an inline " +
          value3.kind +
          " entry does not outlive a reset of the base";
        break;
      }
      let value4: Dynamic = (0, runtime.mergeDcTemplates)(
        options,
        value3,
        context,
      );
      if (!value4.ok || value4.merged === undefined) {
        value = value4.guard.baseTheirs
          ? (value4.why ?? "not mergeable")
          : "the change altered the element tree";
        break;
      }
      items2.unshift(value4.merged);
    }
    return {
      kept: items2,
      dropped: items.length - items2.length,
      ...(value !== undefined
        ? {
            why: value,
          }
        : {}),
    };
  }
  function rebaseModelHistory(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    if (!ModelHistoryRebaseAlias) {
      let value4: Dynamic = input.undo.length + input.redo.length;
      (0, runtime.resetUndoHistory)(input);
      return {
        undo: 0,
        redo: 0,
        dropped: value4,
      };
    }
    let value: Dynamic = rebaseUndoEntries(input.undo, options, context),
      value2: Dynamic = rebaseUndoEntries(input.redo, options, context);
    input.undoFloor = (input.undoFloor ?? 0) + value.dropped;
    input.undo = value.kept;
    input.redo = value2.kept;
    let value3: Dynamic = value.why ?? value2.why;
    return {
      undo: value.kept.length,
      redo: value2.kept.length,
      dropped: value.dropped + value2.dropped,
      ...(value3 !== undefined
        ? {
            why: value3,
          }
        : {}),
    };
  }
  bindRuntimeValue(
    runtime,
    "ModelHistoryRebaseAlias",
    () => ModelHistoryRebaseAlias,
    (value) => {
      ModelHistoryRebaseAlias = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ModelHistoryRebaseAlias_2",
    () => ModelHistoryRebaseAlias_2,
    (value) => {
      ModelHistoryRebaseAlias_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ModelHistoryRebaseHandler",
    () => ModelHistoryRebaseHandler,
    (value) => {
      ModelHistoryRebaseHandler = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ModelHistoryRebaseHandler_2",
    () => ModelHistoryRebaseHandler_2,
    (value) => {
      ModelHistoryRebaseHandler_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ModelHistoryRebaseUndo",
    () => ModelHistoryRebaseUndo,
    (value) => {
      ModelHistoryRebaseUndo = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ModelHistoryRebaseCache",
    () => ModelHistoryRebaseCache,
    (value) => {
      ModelHistoryRebaseCache = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ModelHistoryRebaseLimit",
    () => ModelHistoryRebaseLimit,
    (value) => {
      ModelHistoryRebaseLimit = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ModelHistoryRebaseNow",
    () => ModelHistoryRebaseNow,
    (value) => {
      ModelHistoryRebaseNow = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ModelHistoryRebaseSet",
    () => ModelHistoryRebaseSet,
    (value) => {
      ModelHistoryRebaseSet = value;
    },
  );
  bindRuntimeValue(runtime, "isRecentlyEditedFile", () => isRecentlyEditedFile);
  bindRuntimeValue(
    runtime,
    "ModelHistoryRebaseDelete",
    () => ModelHistoryRebaseDelete,
    (value) => {
      ModelHistoryRebaseDelete = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ModelHistoryRebaseNowValue",
    () => ModelHistoryRebaseNowValue,
    (value) => {
      ModelHistoryRebaseNowValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ModelHistoryRebaseHandler_3",
    () => ModelHistoryRebaseHandler_3,
    (value) => {
      ModelHistoryRebaseHandler_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ModelHistoryRebaseHandler_4",
    () => ModelHistoryRebaseHandler_4,
    (value) => {
      ModelHistoryRebaseHandler_4 = value;
    },
  );
  bindRuntimeValue(runtime, "rebaseUndoEntries", () => rebaseUndoEntries);
  bindRuntimeValue(runtime, "rebaseModelHistory", () => rebaseModelHistory);
  return () => {
    ModelHistoryRebaseAlias = false;
    ModelHistoryRebaseHandler = (
      input?: Dynamic,
      options?: Dynamic,
    ): Dynamic => {
      ModelHistoryRebaseAlias = input;
      ModelHistoryRebaseAlias_2 = options;
    };
    ModelHistoryRebaseHandler_2 = (): Dynamic => ModelHistoryRebaseAlias;
    ModelHistoryRebaseUndo = (input?: Dynamic, options?: Dynamic): Dynamic => {
      if (options.undo + options.redo + options.dropped !== 0)
        try {
          ModelHistoryRebaseAlias_2?.(input, options);
        } catch {}
    };
    ModelHistoryRebaseCache = new Map();
    ModelHistoryRebaseLimit = 1e4;
    ModelHistoryRebaseNow = (): Dynamic =>
      typeof performance === "undefined" ? Date.now() : performance.now();
    ModelHistoryRebaseSet = (
      input?: Dynamic,
      options: Dynamic = ModelHistoryRebaseNow(),
    ): Dynamic => {
      ModelHistoryRebaseCache.set(input, options);
    };
    ModelHistoryRebaseDelete = (
      input?: Dynamic,
      options: Dynamic = ModelHistoryRebaseNow(),
    ): Dynamic =>
      isRecentlyEditedFile(input, options) &&
      ModelHistoryRebaseCache.delete(input);
    ModelHistoryRebaseNowValue = -1 / 0;
    ModelHistoryRebaseHandler_3 = (): Dynamic => {
      ModelHistoryRebaseNowValue = ModelHistoryRebaseNow();
    };
    ModelHistoryRebaseHandler_4 = (): Dynamic => ModelHistoryRebaseNowValue;
  };
}
