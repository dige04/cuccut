/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorUndoHistory(runtime: RuntimeBindings): () => void {
  function trimUndoHistory(input?: Dynamic, options?: Dynamic): Dynamic {
    let length: Dynamic = input.undo.splice(0, Math.max(0, options)).length;
    input.undoFloor = (input.undoFloor ?? 0) + length;
  }
  function resetUndoHistory(input?: Dynamic): Dynamic {
    input.undoFloor = (input.undoFloor ?? 0) + input.undo.length;
    input.undo = [];
    input.redo = [];
  }
  function dcPropValue(input?: Dynamic, options?: Dynamic): Dynamic {
    let value: Dynamic = (0, runtime.getDcPropsJson)(input);
    if (value != null)
      try {
        let value2: Dynamic = JSON.parse(value);
        if (
          value2 == null ||
          typeof value2 != "object" ||
          Array.isArray(value2)
        )
          return;
        let value3: Dynamic = Object.hasOwn(value2, options)
          ? value2[options]
          : undefined;
        if (value3 == null || typeof value3 != "object") return;
        let value_default: Dynamic = value3.default;
        return typeof value_default == "string" ? value_default : undefined;
      } catch {
        return;
      }
  }
  function applyPendingUndoEntry(
    input?: Dynamic,
    source?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
  ): Dynamic {
    return source.kind === "prop"
      ? applyPendingPropUndo(input, source, context, value)
      : applyPendingScriptUndo(input, source, context);
  }
  function applyPendingPropUndo(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
  ): Dynamic {
    let pendingProps: Dynamic = input.pendingProps,
      value2: Dynamic =
        pendingProps !== undefined && Object.hasOwn(pendingProps, options.prop),
      value3: Dynamic = options.before ?? options.display;
    if (value2) {
      let value7: Dynamic = pendingProps[options.prop];
      if (context === "undo") {
        if (value7 !== options.after) return null;
        if (options.before !== undefined) {
          input.pendingProps = {
            ...pendingProps,
            [options.prop]: options.before,
          };
          return {
            result: {
              kind: "prop",
              prop: options.prop,
              liveValue: options.before,
              episode: null,
            },
            twin: options,
          };
        }
        if (options.base !== input.pendingPropsBase) {
          input.pendingProps = {
            ...pendingProps,
            [options.prop]: options.display,
          };
          return {
            result: {
              kind: "prop",
              prop: options.prop,
              liveValue: options.display,
              episode: null,
            },
            twin: {
              kind: "prop",
              prop: options.prop,
              before: options.display,
              after: options.after,
              base: input.pendingPropsBase ?? options.base,
              display: options.display,
            },
          };
        }
        let state: Dynamic = {
          ...pendingProps,
        };
        delete state[options.prop];
        Object.keys(state).length === 0
          ? ((input.pendingProps = undefined),
            (input.pendingPropsBase = undefined))
          : (input.pendingProps = state);
        let value8: Dynamic = options.liveBefore ?? {
          had: false,
        };
        return {
          result: {
            kind: "prop",
            prop: options.prop,
            liveValue: value8.had ? value8.value : undefined,
            episode: "closed",
          },
          twin: options,
        };
      }
      return options.before === undefined
        ? value7 !== options.display
          ? null
          : ((input.pendingProps = {
              ...pendingProps,
              [options.prop]: options.after,
            }),
            {
              result: {
                kind: "prop",
                prop: options.prop,
                liveValue: options.after,
                episode: null,
              },
              twin: {
                kind: "prop",
                prop: options.prop,
                before: options.display,
                after: options.after,
                base: input.pendingPropsBase ?? options.base,
                display: options.display,
              },
            })
        : value7 !== options.before
          ? null
          : ((input.pendingProps = {
              ...pendingProps,
              [options.prop]: options.after,
            }),
            {
              result: {
                kind: "prop",
                prop: options.prop,
                liveValue: options.after,
                episode: null,
              },
              twin: options,
            });
    }
    if (context === "redo" && options.before === undefined) {
      let value7: Dynamic = value?.overrides;
      if (
        value7 !== undefined &&
        Object.hasOwn(value7, options.prop) &&
        value7[options.prop] !== options.display &&
        value7[options.prop] !==
          (options.liveBefore?.had === true
            ? options.liveBefore.value
            : undefined)
      )
        return null;
      if (dcPropValue(input.src, options.prop) !== options.after) {
        input.pendingPropsBase ??=
          (0, runtime.getDcPropsJson)(input.src) ?? options.base;
        input.pendingProps = {
          ...pendingProps,
          [options.prop]: options.after,
        };
        return {
          result: {
            kind: "prop",
            prop: options.prop,
            liveValue: options.after,
            episode: "reopened",
          },
          twin: options,
        };
      }
    }
    let value4: Dynamic = dcPropValue(input.src, options.prop),
      value5: Dynamic = context === "undo" ? options.after : value3;
    if (value4 === undefined || value4 !== value5) return null;
    {
      let value7: Dynamic = value?.overrides;
      if (
        value7 !== undefined &&
        Object.hasOwn(value7, options.prop) &&
        value7[options.prop] !== value5
      )
        return null;
    }
    let value6: Dynamic = context === "undo" ? value3 : options.after;
    input.pendingPropsBase ??= (0, runtime.getDcPropsJson)(input.src) ?? "";
    input.pendingProps = {
      ...pendingProps,
      [options.prop]: value6,
    };
    return {
      result: {
        kind: "prop",
        prop: options.prop,
        liveValue: value6,
        episode: "reopened",
      },
      twin: {
        kind: "prop",
        prop: options.prop,
        before: value3,
        after: options.after,
        base: input.pendingPropsBase,
        display: value3,
      },
    };
  }
  function applyPendingScriptUndo(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    let value: Dynamic = options.before ?? options.base;
    if (input.pendingScript !== undefined)
      return context === "undo"
        ? input.pendingScript !== options.after
          ? null
          : options.before === undefined &&
              options.base !== input.pendingScriptBase
            ? ((input.pendingScript = options.base),
              {
                result: {
                  kind: "script",
                  js: options.base,
                },
                twin: {
                  kind: "script",
                  before: options.base,
                  after: options.after,
                  base: input.pendingScriptBase ?? options.base,
                },
              })
            : ((input.pendingScript = options.before),
              options.before === undefined &&
                (input.pendingScriptBase = undefined),
              {
                result: {
                  kind: "script",
                  js: value,
                },
                twin: options,
              })
        : options.before === undefined && input.pendingScript === options.base
          ? ((input.pendingScript = options.after),
            {
              result: {
                kind: "script",
                js: options.after,
              },
              twin: {
                kind: "script",
                before: options.base,
                after: options.after,
                base: input.pendingScriptBase ?? options.base,
              },
            })
          : input.pendingScript !== options.before
            ? null
            : ((input.pendingScript = options.after),
              {
                result: {
                  kind: "script",
                  js: options.after,
                },
                twin: options,
              });
    let value2: Dynamic = (0, runtime.parseDcHtmlDocument)(input.src)?.js;
    if (
      context === "redo" &&
      options.before === undefined &&
      value2 !== options.after
    )
      return value2 !== options.base
        ? null
        : ((input.pendingScriptBase ??= options.base),
          (input.pendingScript = options.after),
          {
            result: {
              kind: "script",
              js: options.after,
            },
            twin: options,
          });
    if (value2 === undefined) return null;
    let value3: Dynamic = context === "undo" ? options.after : value;
    if (value2 !== value3) return null;
    let value4: Dynamic = context === "undo" ? value : options.after;
    input.pendingScriptBase ??= value2;
    input.pendingScript = value4;
    return {
      result: {
        kind: "script",
        js: value4,
      },
      twin: {
        kind: "script",
        before: value,
        after: options.after,
        base: input.pendingScriptBase,
      },
    };
  }
  function canContinueUndoEdit(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
    extra?: Dynamic,
    detail?: Dynamic,
  ): Dynamic {
    return (
      input !== null &&
      input.name === options &&
      input.key === context &&
      value - input.at < extra &&
      typeof detail == "string"
    );
  }
  function combineUndoEntry(
    input?: Dynamic,
    source?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    let value: Dynamic = input.undo[input.undo.length - 1];
    return context.continues &&
      value !== undefined &&
      typeof value != "string" &&
      value.kind === source.kind &&
      (source.kind !== "prop" || value.prop === source.prop) &&
      value.after === source.before
      ? ((value.after = source.after), "coalesced")
      : (input.undo.push(source),
        trimUndoHistory(input, input.undo.length - context.limit),
        (input.redo = []),
        "pushed");
  }
  function removePropUndoEntries(input?: Dynamic, options?: Dynamic): Dynamic {
    let callback: Dynamic = (source?: Dynamic): Dynamic =>
        typeof source != "string" &&
        source.kind === "prop" &&
        options.includes(source.prop),
      value: Dynamic = input.undo.filter(
        (input2?: Dynamic): Dynamic => !callback(input2),
      ),
      value2: Dynamic = input.redo.filter(
        (input2?: Dynamic): Dynamic => !callback(input2),
      ),
      value3: Dynamic =
        value.length !== input.undo.length ||
        value2.length !== input.redo.length;
    value3 && ((input.undo = value), (input.redo = value2));
    return value3;
  }
  function countPendingUndoEntries(input?: Dynamic): Dynamic {
    let index: Dynamic = 0;
    !input.undo.some(
      (source?: Dynamic): Dynamic =>
        typeof source != "string" && source.kind === "script",
    ) &&
      input.pendingScript !== undefined &&
      input.pendingScript !== input.pendingScriptBase &&
      (index += 1);
    for (let value of Object.keys(input.pendingProps ?? {}) as Dynamic)
      input.undo.some(
        (source?: Dynamic): Dynamic =>
          typeof source != "string" &&
          source.kind === "prop" &&
          source.prop === value,
      ) || (index += 1);
    return index;
  }
  bindRuntimeValue(runtime, "trimUndoHistory", () => trimUndoHistory);
  bindRuntimeValue(runtime, "resetUndoHistory", () => resetUndoHistory);
  bindRuntimeValue(runtime, "dcPropValue", () => dcPropValue);
  bindRuntimeValue(
    runtime,
    "applyPendingUndoEntry",
    () => applyPendingUndoEntry,
  );
  bindRuntimeValue(runtime, "applyPendingPropUndo", () => applyPendingPropUndo);
  bindRuntimeValue(
    runtime,
    "applyPendingScriptUndo",
    () => applyPendingScriptUndo,
  );
  bindRuntimeValue(runtime, "canContinueUndoEdit", () => canContinueUndoEdit);
  bindRuntimeValue(runtime, "combineUndoEntry", () => combineUndoEntry);
  bindRuntimeValue(
    runtime,
    "removePropUndoEntries",
    () => removePropUndoEntries,
  );
  bindRuntimeValue(
    runtime,
    "countPendingUndoEntries",
    () => countPendingUndoEntries,
  );
  return () => {};
}
