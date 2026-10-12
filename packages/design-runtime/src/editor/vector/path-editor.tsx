/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installEditorVectorPathEditor(
  runtime: RuntimeBindings,
): () => void {
  var jsxVectorPathEditor: Dynamic;
  var VectorPathEditorConstant: Dynamic;
  var VectorPathEditorConstant_2: Dynamic;
  var AppifactPenAnchorClaimKey: Dynamic;
  function VectorPathEditor({
    path: path,
    scale: scale,
    origin: origin,
    onLive: onLive,
    onCommit: onCommit,
    onCancel: onCancel,
    onGesture: onGesture,
    testId: testId,
  }: Dynamic): Dynamic {
    let [value, value2]: Dynamic = (0,
      runtime.reactHooksLatestCallback_3.useState)(undefined),
      value3: Dynamic = (0, runtime.reactHooksLatestCallback_3.useRef)(null),
      value4: Dynamic = (0, runtime.reactHooksLatestCallback_3.useRef)(path);
    value4.current = path;
    let value5: Dynamic = (0, runtime.reactHooksLatestCallback_3.useRef)(null),
      value6: Dynamic = (0, runtime.reactHooksLatestCallback_3.useRef)(null),
      value7: Dynamic = (0, runtime.reactHooksLatestCallback_3.useRef)(null),
      value8: Dynamic = value,
      value9: Dynamic = value8
        ? path.contours[value8.contour]?.anchors[value8.anchor]
        : undefined;
    if (value8 && path !== value6.current && path !== value5.current) {
      let current: Dynamic = value7.current;
      if (
        current &&
        (!value9 ||
          Math.abs(value9.x - current.x) > 0.25 ||
          Math.abs(value9.y - current.y) > 0.25)
      ) {
        let part: Dynamic = value8.part;
        value8 = undefined;
        path.contours.forEach(
          (input?: Dynamic, options?: Dynamic): Dynamic =>
            input.anchors.forEach(
              (input2?: Dynamic, options2?: Dynamic): Dynamic => {
                Math.abs(input2.x - current.x) <= 0.25 &&
                  Math.abs(input2.y - current.y) <= 0.25 &&
                  (value8 = {
                    contour: options,
                    anchor: options2,
                    part:
                      part !== "anchor" && input2.seg.kind !== "cubic"
                        ? "anchor"
                        : part,
                  });
              },
            ),
        );
      } else value9 || (value8 = undefined);
      let value21: Dynamic = value8;
      value21
        ? (value21.contour !== value.contour ||
            value21.anchor !== value.anchor ||
            value21.part !== value.part) &&
          value2(value21)
        : value2(undefined);
    }
    let value10: Dynamic = value8,
      value11: Dynamic = value10
        ? path.contours[value10.contour]?.anchors[value10.anchor]
        : undefined;
    value7.current = value11
      ? {
          x: value11.x,
          y: value11.y,
        }
      : null;
    value6.current = path;
    let value12: Dynamic = (0, runtime.reactHooksLatestCallback_3.useRef)({
        left: 0,
        top: 0,
      }),
      value13: Dynamic = (0, runtime.reactHooksLatestCallback_3.useMemo)(
        (): Dynamic => ({
          scale: scale,
          toScreen: (input?: Dynamic): Dynamic => ({
            x: (input.x - origin.x) * scale,
            y: (input.y - origin.y) * scale,
          }),
          toModel: (input?: Dynamic, options?: Dynamic): Dynamic => {
            let value21: Dynamic = value3.current?.getBoundingClientRect();
            return {
              x:
                origin.x +
                (input - (value21?.left ?? 0) + value12.current.left) / scale,
              y:
                origin.y +
                (options - (value21?.top ?? 0) + value12.current.top) / scale,
            };
          },
        }),
        [scale, origin.x, origin.y],
      ),
      value14: Dynamic = (0, runtime.reactHooksLatestCallback_3.useRef)({});
    (0, runtime.reactHooksLatestCallback_3.useEffect)((): Dynamic => {
      let callback4: Dynamic = (input?: Dynamic): Dynamic => {
        input.detail !== value14.current && value2(undefined);
      };
      (window as Dynamic).addEventListener(
        AppifactPenAnchorClaimKey,
        callback4,
      );
      return (): Dynamic =>
        (window as Dynamic).removeEventListener(
          AppifactPenAnchorClaimKey,
          callback4,
        );
    }, []);
    let value15: Dynamic = (0, runtime.useVectorEditor)({
        path: path,
        onLive: (input?: Dynamic): Dynamic => {
          value5.current = input;
          onLive(input);
        },
        onCommit: (input?: Dynamic, options?: Dynamic): Dynamic => {
          value5.current = options;
          onCommit(input, options);
        },
        tool: "select",
        selected: value10,
        onSelect: (input?: Dynamic): Dynamic => {
          input &&
            (window as Dynamic).dispatchEvent(
              new CustomEvent(AppifactPenAnchorClaimKey, {
                detail: value14.current,
              }),
            );
          value2(input);
        },
        view: value13,
        controls: "selected",
      }),
      { handles: value16 }: Dynamic = value15,
      value17: Dynamic = (0, runtime.reactHooksLatestCallback_3.useRef)(null),
      value18: Dynamic = (0, runtime.reactHooksLatestCallback_3.useRef)({
        onCancel: onCancel,
        onGesture: onGesture,
      });
    value18.current = {
      onCancel: onCancel,
      onGesture: onGesture,
    };
    (0, runtime.reactHooksLatestCallback_3.useEffect)(
      (): Dynamic => (): Dynamic => value17.current?.end("cancel"),
      [],
    );
    (0, runtime.reactHooksLatestCallback_3.useEffect)((): Dynamic => {
      let value21: Dynamic = value10;
      if (!value21) return;
      let callback4: Dynamic = (event?: Dynamic): Dynamic => {
        if (event.key !== "Delete" && event.key !== "Backspace") return;
        let target: Dynamic = event.target;
        if (
          (target &&
            (target.tagName === "INPUT" ||
              target.tagName === "TEXTAREA" ||
              target.isContentEditable)) ||
          (0, runtime.hasBlockingEditorOverlay)()
        )
          return;
        let value22: Dynamic =
          value21.part === "anchor"
            ? (0, runtime.deleteVectorAnchorKeepingCurve)(
                value4.current,
                value21,
              )
            : value4.current;
        value22 &&
          (event.preventDefault(),
          event.stopImmediatePropagation(),
          value21.part === "anchor" &&
            (value17.current?.end("cancel"),
            value15.cancelSession(),
            value2(undefined),
            (value5.current = value22),
            onCommit(value4.current, value22, true)));
      };
      (window as Dynamic).addEventListener("keydown", callback4, true);
      return (): Dynamic =>
        (window as Dynamic).removeEventListener("keydown", callback4, true);
    }, [value10?.contour, value10?.anchor, value10?.part, onCommit]);
    let callback: Dynamic = (input?: Dynamic): Dynamic => {
        if (input.button !== 0 || value17.current) return;
        input.stopPropagation();
        let activeElement: Dynamic = (document as Dynamic).activeElement;
        activeElement &&
          activeElement.tagName === "IFRAME" &&
          activeElement.blur();
        (0, runtime.focusCanvasDocument)();
        value16.onPointerDown(input);
        let pointerId: Dynamic = input.pointerId,
          callback4: Dynamic = (input2?: Dynamic): Dynamic => {
            input2.pointerId === pointerId && value17.current?.end("cancel");
          };
        value17.current = {
          end: (input2?: Dynamic): Dynamic => {
            value17.current = null;
            (window as Dynamic).removeEventListener("pointerup", callback4);
            (window as Dynamic).removeEventListener("pointercancel", callback4);
            input2 === "cancel" &&
              (value15.cancelSession(), value18.current.onCancel());
            value18.current.onGesture?.(false);
          },
        };
        (window as Dynamic).addEventListener("pointerup", callback4);
        (window as Dynamic).addEventListener("pointercancel", callback4);
        onGesture?.(true);
      },
      callback2: Dynamic = (input?: Dynamic): Dynamic => {
        value16.onPointerUp(input);
        value17.current?.end("up");
      },
      callback3: Dynamic = (input?: Dynamic): Dynamic => {
        value16.onPointerCancel(input);
        value17.current?.end("cancel");
      },
      state: Dynamic = {
        onPointerDown: callback,
        onPointerMove: value16.onPointerMove,
        onPointerUp: callback2,
        onPointerCancel: callback3,
      },
      value19: Dynamic =
        value15.hitRadiusPx === VectorPathEditorConstant_2
          ? VectorPathEditorConstant_2
          : VectorPathEditorConstant,
      items: Dynamic = [],
      [items2, items3, items4, items5]: Dynamic = [
        1 / 0,
        1 / 0,
        -1 / 0,
        -1 / 0,
      ];
    path.contours.forEach(
      (input?: Dynamic, options?: Dynamic): Dynamic =>
        input.anchors.forEach(
          (input2?: Dynamic, options2?: Dynamic): Dynamic => {
            let callback4: Dynamic = (
              input3?: Dynamic,
              options3?: Dynamic,
              context?: Dynamic,
            ): Dynamic => {
              let value21: Dynamic = value13.toScreen(options3);
              [items2, items3, items4, items5] = [
                Math.min(items2, value21.x),
                Math.min(items3, value21.y),
                Math.max(items4, value21.x),
                Math.max(items5, value21.y),
              ];
              items.push({
                key: input3,
                s: value21,
                cursor: context,
              });
            };
            options2 > 0 &&
              input2.seg.kind === "cubic" &&
              ((0, runtime.showVectorControls)(
                "selected",
                input,
                options,
                options2,
                "c",
                value10,
              ) &&
                callback4(
                  `c1${String(options)}:${String(options2)}`,
                  input2.seg.c1,
                  "crosshair",
                ),
              (0, runtime.showVectorControls)(
                "selected",
                input,
                options,
                options2,
                "c2",
                value10,
              ) &&
                callback4(
                  `c2${String(options)}:${String(options2)}`,
                  input2.seg.c2,
                  "crosshair",
                ));
            callback4(
              `a${String(options)}:${String(options2)}`,
              input2,
              "move",
            );
          },
        ),
    );
    let value20: Dynamic = items.length
      ? {
          left: items2 - value19 - 2,
          top: items3 - value19 - 2,
          w: items4 - items2 + 2 * value19 + 4,
          h: items5 - items3 + 2 * value19 + 4,
        }
      : {
          left: 0,
          top: 0,
          w: 1,
          h: 1,
        };
    value12.current = value20;
    return (
      <svg
        ref={value3}
        data-mega-chrome={"pen-anchors"}
        data-testid={testId}
        className={"pointer-events-none absolute select-none"}
        width={value20.w}
        height={value20.h}
        style={{
          ...runtime.VectorAnnotationPenEditorOverflowTouchActionConfig,
          left: value20.left,
          top: value20.top,
        }}
      >
        <g
          transform={`translate(${String(-value20.left)} ${String(-value20.top)})`}
        >
          <runtime.VectorPathControls
            path={path}
            selected={value10}
            draft={value15.draft}
            hover={undefined}
            view={value13}
            hitRadiusPx={value15.hitRadiusPx}
            controls={"selected"}
          />
          {items.map(
            ({ key: key, s: s, cursor: cursor }: Dynamic): Dynamic => (
              <circle
                key={key}
                data-pen-part={key}
                cx={s.x}
                cy={s.y}
                r={value19}
                fill={"transparent"}
                style={{
                  pointerEvents: "auto",
                  cursor: cursor,
                  touchAction: "none",
                }}
                {...state}
              />
            ),
          )}
        </g>
      </svg>
    );
  }
  bindRuntimeValue(
    runtime,
    "jsxVectorPathEditor",
    () => jsxVectorPathEditor,
    (value) => {
      jsxVectorPathEditor = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "VectorPathEditorConstant",
    () => VectorPathEditorConstant,
    (value) => {
      VectorPathEditorConstant = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "VectorPathEditorConstant_2",
    () => VectorPathEditorConstant_2,
    (value) => {
      VectorPathEditorConstant_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "AppifactPenAnchorClaimKey",
    () => AppifactPenAnchorClaimKey,
    (value) => {
      AppifactPenAnchorClaimKey = value;
    },
  );
  bindRuntimeValue(runtime, "VectorPathEditor", () => VectorPathEditor);
  return () => {
    jsxVectorPathEditor = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
    VectorPathEditorConstant = 10;
    VectorPathEditorConstant_2 = 20;
    AppifactPenAnchorClaimKey = "appifact-pen-anchor-claim";
  };
}
