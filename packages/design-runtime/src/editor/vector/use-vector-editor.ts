/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorVectorUseVectorEditor(
  runtime: RuntimeBindings,
): () => void {
  function useVectorEditor(request?: Dynamic): Dynamic {
    let [value, value2]: Dynamic = (0,
      runtime.reactHooksLatestCallback_4.useState)([]),
      value3: Dynamic = (0, runtime.reactHooksLatestCallback_4.useRef)([]),
      value4: Dynamic = (0, runtime.reactHooksLatestCallback_4.useCallback)(
        (input?: Dynamic): Dynamic => {
          value3.current = input;
          value2(input);
        },
        [],
      ),
      [value5, value6]: Dynamic = (0,
      runtime.reactHooksLatestCallback_4.useState)(undefined),
      value7: Dynamic = (0, runtime.reactHooksLatestCallback_4.useRef)(
        undefined,
      ),
      value8: Dynamic = (0, runtime.reactHooksLatestCallback_4.useRef)("mouse"),
      value9: Dynamic = (0, runtime.reactHooksLatestCallback_4.useRef)(
        undefined,
      ),
      value10: Dynamic = (0, runtime.reactHooksLatestCallback_4.useRef)(false),
      value11: Dynamic = (0, runtime.reactHooksLatestCallback_4.useRef)(
        request.path,
      );
    value11.current = request.path;
    let value12: Dynamic = (0, runtime.reactHooksLatestCallback_4.useRef)(
      request.view,
    );
    value12.current = request.view;
    let value13: Dynamic = (0, runtime.reactHooksLatestCallback_4.useRef)(
        undefined,
      ),
      value14: Dynamic = (0, runtime.reactHooksLatestCallback_4.useRef)(
        undefined,
      ),
      value15: Dynamic = (0, runtime.reactHooksLatestCallback_4.useRef)(null),
      value16: Dynamic = (0, runtime.vectorUsesCoarsePointer)()
        ? runtime.VectorPathEditingConstant_2
        : runtime.VectorPathEditingConstant,
      value17: Dynamic = (0, runtime.reactHooksLatestCallback_4.useCallback)(
        (input?: Dynamic, options?: Dynamic): Dynamic => {
          let value28: Dynamic = options / request.view.scale,
            value29: Dynamic = value28 * value28,
            value30: Dynamic,
            value31: Dynamic = value29,
            callback: Dynamic = (
              input2?: Dynamic,
              options2?: Dynamic,
            ): Dynamic => {
              let value32: Dynamic = input2.x - input.x,
                value33: Dynamic = input2.y - input.y,
                value34: Dynamic = value32 * value32 + value33 * value33;
              value34 <= value31 && ((value31 = value34), (value30 = options2));
            };
          request.path.contours.forEach(
            (input2?: Dynamic, options2?: Dynamic): Dynamic => {
              input2.anchors.forEach(
                (input3?: Dynamic, options3?: Dynamic): Dynamic => {
                  callback(input3, {
                    contour: options2,
                    anchor: options3,
                    part: "anchor",
                  });
                  if (!(options3 > 0 || input2.closed)) return;
                  let callback2: Dynamic = (input4?: Dynamic): Dynamic =>
                    (0, runtime.showVectorControls)(
                      request.controls,
                      input2,
                      options2,
                      options3,
                      input4,
                      request.selected,
                    );
                  input3.seg.kind === "quad"
                    ? callback2("c") &&
                      callback(input3.seg.c, {
                        contour: options2,
                        anchor: options3,
                        part: "c",
                      })
                    : input3.seg.kind === "cubic" &&
                      (callback2("c") &&
                        callback(input3.seg.c1, {
                          contour: options2,
                          anchor: options3,
                          part: "c",
                        }),
                      callback2("c2") &&
                        callback(input3.seg.c2, {
                          contour: options2,
                          anchor: options3,
                          part: "c2",
                        }));
                },
              );
            },
          );
          return value30;
        },
        [request.path, request.view.scale, request.controls, request.selected],
      ),
      value18: Dynamic = (0, runtime.reactHooksLatestCallback_4.useCallback)(
        (input?: Dynamic): Dynamic => {
          let value28: Dynamic = request.path.contours[input.contour];
          if (!value28) return;
          let value29: Dynamic = value28.anchors[input.anchor];
          if (!value29) return;
          if (input.part === "c" && value29.seg.kind === "cubic") {
            let value31: Dynamic = (0, runtime.previousContourAnchor)(
              value28,
              input.anchor,
            );
            return value31
              ? {
                  x: value31.x,
                  y: value31.y,
                }
              : {
                  x: value29.x,
                  y: value29.y,
                };
          }
          if (input.part !== "anchor")
            return {
              x: value29.x,
              y: value29.y,
            };
          let value30: Dynamic = (0, runtime.previousContourAnchor)(
            value28,
            input.anchor,
          );
          return value30
            ? {
                x: value30.x,
                y: value30.y,
              }
            : undefined;
        },
        [request.path],
      ),
      value19: Dynamic = (0, runtime.reactHooksLatestCallback_4.useCallback)(
        (event?: Dynamic): Dynamic => {
          if (event.button !== 0) return;
          let value28: Dynamic = request.view.toModel(
            event.clientX,
            event.clientY,
          );
          if (request.readOnly) {
            request.tool !== "pen"
              ? request.onPanStart?.(event)
              : (0, runtime.captureVectorPointer)(
                  event.currentTarget,
                  event.pointerId,
                );
            return;
          }
          if (request.tool === "pen") {
            event.preventDefault();
            if (value9.current !== undefined) return;
            (0, runtime.blurVectorInput)();
            let current: Dynamic = value3.current,
              value31: Dynamic =
                event.shiftKey && current.length > 0
                  ? (0, runtime.constrainVectorPointAngle)(
                      current[current.length - 1],
                      value28,
                    )
                  : value28;
            if (current.length >= 3) {
              let value32: Dynamic = current[0],
                value33: Dynamic =
                  (0, runtime.vectorHitRadius)(event) / request.view.scale;
              if (
                Math.hypot(value32.x - value31.x, value32.y - value31.y) <=
                value33
              ) {
                value9.current = event.pointerId;
                value13.current = "close";
                (0, runtime.captureVectorPointer)(
                  event.currentTarget,
                  event.pointerId,
                );
                return;
              }
            }
            value4([...current, value31]);
            value13.current = "append";
            value6(value31);
            (0, runtime.captureVectorPointer)(
              event.currentTarget,
              event.pointerId,
            );
            return;
          }
          if (value14.current) return;
          let value29: Dynamic = value17(
            value28,
            Math.max((0, runtime.vectorHitRadius)(event), value16),
          );
          request.onSelect(value29);
          if (!value29) {
            request.onPanStart?.(event);
            return;
          }
          (0, runtime.blurVectorInput)();
          event.preventDefault();
          (0, runtime.captureVectorPointer)(
            event.currentTarget,
            event.pointerId,
          );
          let value30: Dynamic = (0, runtime.vectorPartPoint)(
            request.path,
            value29,
          );
          value14.current = {
            sel: value29,
            before: request.path,
            chordOrigin: value18(value29),
            startModel: value28,
            grabOffset: value30
              ? {
                  x: value30.x - value28.x,
                  y: value30.y - value28.y,
                }
              : {
                  x: 0,
                  y: 0,
                },
            startScreen: {
              x: event.clientX,
              y: event.clientY,
            },
            pointerId: event.pointerId,
            moved: false,
          };
          value15.current = null;
        },
        [
          request.readOnly,
          request.tool,
          request.view,
          request.path,
          value,
          value17,
          value18,
        ],
      ),
      value20: Dynamic = (0, runtime.reactHooksLatestCallback_4.useCallback)(
        (input?: Dynamic): Dynamic => {
          let value28: Dynamic = request.view.toModel(
            input.clientX,
            input.clientY,
          );
          if (request.tool === "pen") {
            let current2: Dynamic = value3.current;
            value8.current = input.pointerType;
            input.buttons === 0 && (value7.current = value28);
            value6(
              input.shiftKey && current2.length > 0
                ? (0, runtime.constrainVectorPointAngle)(
                    current2[current2.length - 1],
                    value28,
                  )
                : value28,
            );
            return;
          }
          let current: Dynamic = value14.current;
          if (!current || input.pointerId !== current.pointerId) return;
          if (!current.moved) {
            let value31: Dynamic = input.clientX - current.startScreen.x,
              value32: Dynamic = input.clientY - current.startScreen.y;
            if (Math.hypot(value31, value32) < runtime.VectorPathEditingLimit)
              return;
            current.moved = true;
            current.before = value11.current;
            let value33: Dynamic = (0, runtime.vectorPartPoint)(
              current.before,
              current.sel,
            );
            value33 &&
              (current.grabOffset = {
                x: value33.x - current.startModel.x,
                y: value33.y - current.startModel.y,
              });
            current.chordOrigin = value18(current.sel);
          }
          let state: Dynamic = {
              x: value28.x + current.grabOffset.x,
              y: value28.y + current.grabOffset.y,
            },
            value29: Dynamic = input.shiftKey
              ? (0, runtime.constrainVectorPointAngle)(
                  current.chordOrigin ?? {
                    x: current.startModel.x + current.grabOffset.x,
                    y: current.startModel.y + current.grabOffset.y,
                  },
                  state,
                )
              : state;
          current.lastRaw = state;
          let value30: Dynamic = (0, runtime.moveVectorPart)(
            current.before,
            current.sel,
            value29,
          );
          value15.current = value30;
          request.onLive(value30);
        },
        [request.tool, request.view, request.onLive, value, value18],
      ),
      value21: Dynamic = (0, runtime.reactHooksLatestCallback_4.useCallback)(
        (input?: Dynamic): Dynamic => {
          if (value9.current === input.pointerId) {
            value9.current = undefined;
            value13.current = undefined;
            let current3: Dynamic = value3.current,
              value28: Dynamic = current3[0];
            if (value28) {
              let current4: Dynamic = value12.current,
                value29: Dynamic = current4.toModel(
                  input.clientX,
                  input.clientY,
                ),
                value30: Dynamic = current3[current3.length - 1],
                value31: Dynamic =
                  input.shiftKey && current3.length > 0 && value30
                    ? (0, runtime.constrainVectorPointAngle)(value30, value29)
                    : value29,
                value32: Dynamic =
                  (0, runtime.vectorHitRadius)(input) / current4.scale;
              Math.hypot(value28.x - value31.x, value28.y - value31.y) <=
                value32 && value26.current();
            }
            return;
          }
          let current: Dynamic = value14.current;
          if (
            !current ||
            input.pointerId !== current.pointerId ||
            ((value14.current = undefined), !current.moved)
          )
            return;
          let current2: Dynamic = value15.current;
          value15.current = null;
          current2 &&
            !(0, runtime.sameVectorPath)(current2, current.before) &&
            request.onCommit(current.before, current2);
        },
        [request.onCommit],
      ),
      value22: Dynamic = (0,
      runtime.reactHooksLatestCallback_4.useCallback)((): Dynamic => {
        value9.current = undefined;
        let current: Dynamic = value14.current;
        value14.current = undefined;
        current &&
          ((value15.current = null),
          current.moved && request.onLive(current.before));
      }, [request.onLive]);
    (0, runtime.reactHooksLatestCallback_4.useEffect)((): Dynamic => {
      let callback: Dynamic = (input?: Dynamic): Dynamic => {
        if (input.key !== "Shift") return;
        let value28: Dynamic = input.type === "keydown";
        value10.current = value28;
        let current: Dynamic = value14.current;
        if (current && current.moved && current.lastRaw) {
          let value29: Dynamic = value28
              ? (0, runtime.constrainVectorPointAngle)(
                  current.chordOrigin ?? {
                    x: current.startModel.x + current.grabOffset.x,
                    y: current.startModel.y + current.grabOffset.y,
                  },
                  current.lastRaw,
                )
              : current.lastRaw,
            value30: Dynamic = (0, runtime.moveVectorPart)(
              current.before,
              current.sel,
              value29,
            );
          value15.current = value30;
          request.onLive(value30);
        }
        if (request.tool === "pen" && value7.current) {
          let current2: Dynamic = value3.current;
          value6(
            value28 && current2.length > 0
              ? (0, runtime.constrainVectorPointAngle)(
                  current2[current2.length - 1],
                  value7.current,
                )
              : value7.current,
          );
        }
      };
      (window as Dynamic).addEventListener("keydown", callback);
      (window as Dynamic).addEventListener("keyup", callback);
      return (): Dynamic => {
        (window as Dynamic).removeEventListener("keydown", callback);
        (window as Dynamic).removeEventListener("keyup", callback);
      };
    }, [request.tool, request.onLive]);
    (0, runtime.reactHooksLatestCallback_4.useEffect)((): Dynamic => {
      request.tool !== "pen" &&
        ((value9.current = undefined),
        value3.current.length > 0 && value4([]),
        value23());
    }, [request.tool]);
    function value23(): Dynamic {
      value6(undefined);
      value7.current = undefined;
    }
    function value24(items?: Dynamic, options?: Dynamic): Dynamic {
      let current: Dynamic = value7.current;
      if (!current || items.length === 0) {
        value23();
        return;
      }
      let value28: Dynamic = items[items.length - 1];
      value6(
        options && value28
          ? (0, runtime.constrainVectorPointAngle)(value28, current)
          : current,
      );
    }
    function value25(): Dynamic {
      let current: Dynamic = value3.current;
      if (current.length < 3) return;
      value9.current = undefined;
      let value28: Dynamic = current.map(
          (input?: Dynamic): Dynamic => ({
            x: input.x,
            y: input.y,
            seg: {
              kind: "line",
            },
          }),
        ),
        path: Dynamic = request.path;
      request.onCommit(path, {
        contours: [
          ...path.contours,
          {
            anchors: value28,
            closed: true,
          },
        ],
      });
      value4([]);
      value23();
      request.onToolDone?.();
    }
    let value26: Dynamic = (0, runtime.reactHooksLatestCallback_4.useRef)(
      value25,
    );
    value26.current = value25;
    let value27: Dynamic = (0, runtime.reactHooksLatestCallback_4.useCallback)(
      (event?: Dynamic): Dynamic => {
        if (request.tool === "pen") {
          if (
            event.key === "Enter" &&
            !request.readOnly &&
            value3.current.length >= 3
          ) {
            event.preventDefault();
            value25();
            return true;
          }
          if (event.key === "Escape") {
            event.preventDefault();
            value9.current = undefined;
            value4([]);
            value23();
            request.onToolDone?.();
            return true;
          }
          if (event.key === "Backspace" && value3.current.length > 0) {
            event.preventDefault();
            let value28: Dynamic = value3.current.slice(0, -1);
            value4(value28);
            value13.current = undefined;
            value24(value28, event.shiftKey === true);
            return true;
          }
          if (event.key !== "Delete" && event.key !== "Backspace") return false;
        }
        if (
          (event.key === "Delete" || event.key === "Backspace") &&
          request.selected &&
          !request.readOnly
        ) {
          event.preventDefault();
          let current: Dynamic = value14.current;
          value22();
          let value28: Dynamic = current?.moved ? current.before : request.path,
            value29: Dynamic =
              request.selected.part === "anchor"
                ? (0, runtime.deleteVectorAnchor)(value28, request.selected)
                : (0, runtime.resetVectorControl)(value28, request.selected);
          value29 !== value28 &&
            (request.onCommit(value28, value29), request.onSelect(undefined));
          return true;
        }
        return false;
      },
      [request.tool, request.selected, request.readOnly, request.path],
    );
    return {
      handles: {
        onPointerDown: value19,
        onPointerMove: value20,
        onPointerLeave: (input?: Dynamic): Dynamic => {
          input.pointerType === "touch"
            ? value8.current === "touch" && value6(undefined)
            : value23();
        },
        onPointerUp: value21,
        onPointerCancel: (input?: Dynamic): Dynamic => {
          if (value9.current === input.pointerId) {
            value9.current = undefined;
            value13.current = undefined;
            return;
          }
          let current: Dynamic = value14.current;
          if (current && input.pointerId === current.pointerId) {
            value22();
            return;
          }
        },
        handleKey: value27,
      },
      draft: value,
      hover: value5,
      hitRadiusPx: value16,
      cancelSession: value22,
      closeDraft: value25,
      discardDraft: (): Dynamic => {
        value9.current = undefined;
        value4([]);
        value23();
        request.onToolDone?.();
      },
      cancelPenDown: (): Dynamic => {
        if (value13.current === "append") {
          let value28: Dynamic = value3.current.slice(0, -1);
          value4(value28);
          value24(value28, value10.current);
        } else value13.current === "close" && (value9.current = undefined);
        value13.current = undefined;
      },
    };
  }
  bindRuntimeValue(runtime, "useVectorEditor", () => useVectorEditor);
  return () => {};
}
