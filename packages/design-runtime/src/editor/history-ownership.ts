/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installEditorHistoryOwnership(
  runtime: RuntimeBindings,
): () => void {
  var editorOwnsUndoProbe: Dynamic;
  var undoGestureObserver: Dynamic;
  function setEditorOwnsUndoProbe(probe?: Dynamic): Dynamic {
    editorOwnsUndoProbe = probe;
  }
  function editorOwnsUndo(): Dynamic {
    try {
      return editorOwnsUndoProbe();
    } catch {
      return false;
    }
  }
  function compareDesignSourceScripts(
    currentSource?: Dynamic,
    previousSource?: Dynamic,
  ): Dynamic {
    if (previousSource === undefined || currentSource === undefined)
      return {
        ok: false,
        why: "no earlier source to compare with",
      };
    let value: Dynamic = (0, runtime.parseDcHtmlDocument)(currentSource),
      value2: Dynamic = (0, runtime.parseDcHtmlDocument)(previousSource);
    return !value || !value2
      ? {
          ok: false,
          why: "not a parseable .dc.html",
        }
      : value.js !== value2.js
        ? {
            ok: false,
            why: "the logic script changed",
          }
        : (0, runtime.replaceDcTemplate)(
              currentSource,
              value,
              value2.template,
            ) !== previousSource
          ? {
              ok: false,
              why: "something outside the template changed (props, head)",
            }
          : {
              ok: true,
              template: value2.template,
            };
  }
  function setUndoGestureObserver(observer?: Dynamic): Dynamic {
    undoGestureObserver = observer;
  }
  function notifyUndoGesture(phase?: Dynamic, scope?: Dynamic): Dynamic {
    try {
      undoGestureObserver?.(phase, scope);
    } catch {}
  }
  bindRuntimeValue(
    runtime,
    "editorOwnsUndoProbe",
    () => editorOwnsUndoProbe,
    (value) => {
      editorOwnsUndoProbe = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "setEditorOwnsUndoProbe",
    () => setEditorOwnsUndoProbe,
  );
  bindRuntimeValue(runtime, "editorOwnsUndo", () => editorOwnsUndo);
  bindRuntimeValue(
    runtime,
    "compareDesignSourceScripts",
    () => compareDesignSourceScripts,
  );
  bindRuntimeValue(
    runtime,
    "undoGestureObserver",
    () => undoGestureObserver,
    (value) => {
      undoGestureObserver = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "setUndoGestureObserver",
    () => setUndoGestureObserver,
  );
  bindRuntimeValue(runtime, "notifyUndoGesture", () => notifyUndoGesture);
  return () => {
    editorOwnsUndoProbe = (): Dynamic => false;
  };
}
