/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installEditorChromeInspectorSheet(
  runtime: RuntimeBindings,
): () => void {
  var jsxChromeInspectorSheet: Dynamic;
  var ChromeInspectorSheetMediaQuery: Dynamic;
  var ChromeInspectorSheetConstant: Dynamic;
  var ChromeInspectorSheetConstant_2: Dynamic;
  var reactChromeInspectorSheet: Dynamic;
  function clampInspectorSheetTop(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    return Math.max(0, Math.min(input, context - options - 12));
  }
  function inspectorKeyboardHeightState(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
    extra?: Dynamic,
  ): Dynamic {
    return input <= 0 && options > 0
      ? context == null
        ? {
            heldPx: clampInspectorSheetHeight(extra.snapPx, extra),
            storedPreKeyboardPx: "auto",
          }
        : {
            heldPx: clampInspectorSheetHeight(context, extra),
            storedPreKeyboardPx: context,
          }
      : context == null
        ? {
            heldPx: context,
            storedPreKeyboardPx: value,
          }
        : input > 0 && options <= 0
          ? value === "auto"
            ? {
                heldPx: null,
                storedPreKeyboardPx: null,
              }
            : {
                heldPx: clampInspectorSheetHeight(value ?? context, extra),
                storedPreKeyboardPx: null,
              }
          : {
              heldPx: clampInspectorSheetHeight(context, extra),
              storedPreKeyboardPx: value,
            };
  }
  function inspectorSheetHeightLimits(
    input?: Dynamic,
    options: Dynamic = 0,
    context: Dynamic = 0,
  ): Dynamic {
    let value: Dynamic = Math.round(input * 0.47);
    return {
      snapPx: value,
      floorPx: Math.max(90, Math.min(90 + context, value)),
      ceilingPx: Math.max(
        options > 0 ? 90 : Math.round(input * 0.47),
        input - options - 12,
      ),
    };
  }
  function clampInspectorSheetHeight(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    return Math.min(options.ceilingPx, Math.max(options.floorPx, input));
  }
  function inspectorSheetTop(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
  ): Dynamic {
    return Math.max(0, Math.round(input - (options * value + context)));
  }
  function useInspectorSheetHeight(input?: Dynamic): Dynamic {
    let [value, value2]: Dynamic = (0,
      runtime.reactCodeInspectorCodePanel.useState)(undefined),
      [value3, value4]: Dynamic = (0,
      runtime.reactCodeInspectorCodePanel.useState)(false),
      [value5, value6]: Dynamic = (0,
      runtime.reactCodeInspectorCodePanel.useState)(0),
      value7: Dynamic = (0, runtime.reactCodeInspectorCodePanel.useRef)(null),
      value8: Dynamic = (0, runtime.reactCodeInspectorCodePanel.useRef)(0),
      value9: Dynamic = (0, runtime.reactCodeInspectorCodePanel.useRef)(0),
      value10: Dynamic = (0, runtime.reactCodeInspectorCodePanel.useRef)(null),
      value11: Dynamic = (0, runtime.reactCodeInspectorCodePanel.useRef)(0),
      value12: Dynamic = (0,
      runtime.reactCodeInspectorCodePanel.useCallback)((): Dynamic => {
        let value17: Dynamic =
          value7.current?.closest("[data-posture]")?.offsetParent
            ?.clientHeight ?? 0;
        value17 > 0 && (value8.current = value17);
        return value8.current || (window as Dynamic).innerHeight;
      }, []),
      value13: Dynamic = (0,
      runtime.reactCodeInspectorCodePanel.useCallback)((): Dynamic => {
        let value17: Dynamic = value7.current?.closest("[data-posture]"),
          value18: Dynamic = Math.round(
            parseFloat(
              value17?.ownerDocument.defaultView?.getComputedStyle(value17)
                .paddingBottom ?? "",
            ) || 0,
          );
        return inspectorSheetHeightLimits(value12(), value11.current, value18);
      }, [value12]);
    (0, runtime.reactCodeInspectorCodePanel.useEffect)((): Dynamic => {
      input ||
        (value2(undefined), (value10.current = null), (value9.current = 0));
    }, [input]);
    (0, runtime.reactCodeInspectorCodePanel.useEffect)((): Dynamic => {
      if (!input) return;
      let callback: Dynamic = (): Dynamic => {
        let value17: Dynamic = value13();
        value2(
          (input2?: Dynamic): Dynamic =>
            input2 == null
              ? input2
              : clampInspectorSheetHeight(input2, value17),
        );
      };
      (window as Dynamic).addEventListener("resize", callback);
      return (): Dynamic =>
        (window as Dynamic).removeEventListener("resize", callback);
    }, [input, value13]);
    (0, runtime.reactCodeInspectorCodePanel.useEffect)((): Dynamic => {
      if (!input) return;
      let current: Dynamic = value9.current;
      value9.current = value5;
      if (current === value5) return;
      let value17: Dynamic = inspectorKeyboardHeightState(
        current,
        value5,
        value ?? null,
        value10.current,
        value13(),
      );
      value10.current = value17.storedPreKeyboardPx;
      value2(value17.heldPx ?? undefined);
    }, [input, value5, value13]);
    (0, runtime.reactCodeInspectorCodePanel.useEffect)((): Dynamic => {
      if (!input) return;
      let visualViewport: Dynamic = (window as Dynamic).visualViewport;
      if (!visualViewport) return;
      let callback: Dynamic = (): Dynamic => {
        let value17: Dynamic = inspectorSheetTop(
          (window as Dynamic).innerHeight,
          visualViewport.height,
          visualViewport.offsetTop,
          visualViewport.scale,
        );
        value11.current = value17;
        value6(value17);
      };
      callback();
      visualViewport.addEventListener("resize", callback);
      visualViewport.addEventListener("scroll", callback);
      return (): Dynamic => {
        visualViewport.removeEventListener("resize", callback);
        visualViewport.removeEventListener("scroll", callback);
        value6(0);
      };
    }, [input]);
    let value14: Dynamic = (0, runtime.reactCodeInspectorCodePanel.useRef)(
        null,
      ),
      value15: Dynamic = (0, runtime.reactCodeInspectorCodePanel.useCallback)(
        (input2?: Dynamic): Dynamic => {
          if (!input) return;
          let value17: Dynamic = value13(),
            value18: Dynamic = value ?? value17.snapPx;
          value14.current = {
            startY: input2.clientY,
            startH: value18,
          };
          value4(true);
          let currentTarget: Dynamic = input2.currentTarget;
          currentTarget.setPointerCapture(input2.pointerId);
          let callback: Dynamic = (input3?: Dynamic): Dynamic => {
              let current: Dynamic = value14.current;
              if (!current) return;
              let value19: Dynamic = clampInspectorSheetHeight(
                current.startH + (current.startY - input3.clientY),
                value13(),
              );
              current.lastH = value19;
              value2(value19);
            },
            callback2: Dynamic = (input3?: Dynamic): Dynamic => {
              let current: Dynamic = value14.current;
              value14.current = null;
              value4(false);
              currentTarget.removeEventListener("pointermove", callback);
              currentTarget.removeEventListener("pointerup", callback2);
              currentTarget.removeEventListener("pointercancel", callback2);
              if (!current) return;
              let value19: Dynamic = value13(),
                value20: Dynamic = clampInspectorSheetHeight(
                  current.lastH ?? current.startH,
                  value19,
                );
              value11.current > 0 && (value10.current = value20);
              value2(value20);
            };
          currentTarget.addEventListener("pointermove", callback);
          currentTarget.addEventListener("pointerup", callback2);
          currentTarget.addEventListener("pointercancel", callback2);
        },
        [input, value13, value],
      ),
      value16: Dynamic = (0, runtime.reactCodeInspectorCodePanel.useCallback)(
        (input2?: Dynamic): Dynamic => {
          value7.current = input2;
        },
        [],
      );
    return (0, runtime.reactCodeInspectorCodePanel.useMemo)(
      (): Dynamic => ({
        heightPx: input ? value : undefined,
        dragging: value3,
        keyboardInset: ((): Dynamic => {
          if (!input) return 0;
          let value17: Dynamic = value12();
          return clampInspectorSheetTop(
            value5,
            value ?? inspectorSheetHeightLimits(value17, value5).ceilingPx,
            value17,
          );
        })(),
        handleProps: {
          onPointerDown: value15,
          style: {
            touchAction: "none",
          },
        },
        contentProps: {
          ref: value16,
        },
      }),
      [input, value3, value, value5, value15, value16],
    );
  }
  function useInspectorPosture(): Dynamic {
    return (0, runtime.npm_useMediaQuery_Wpt)(ChromeInspectorSheetMediaQuery)
      ? "sheet"
      : "wide";
  }
  function inspectorShellStyle(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    return input === "wide"
      ? {
          container: (0, runtime.cn)(
            "absolute z-20 flex flex-col overflow-hidden rounded-xl",
            "border bg-surface-2 shadow-lg",
          ),
          style: {
            top: ChromeInspectorSheetConstant_2,
            right: ChromeInspectorSheetConstant_2,
            width: ChromeInspectorSheetConstant,
            maxHeight: `calc(100% - ${ChromeInspectorSheetConstant_2 * 2}px)`,
          },
          contentClass: (0, runtime.cn)(
            "min-h-0 overflow-y-auto border-t",
            runtime.ChromeScrollbarLabel,
          ),
          showHandle: false,
        }
      : {
          container: (0, runtime.cn)(
            "relative z-20 flex w-full flex-col",
            "border-t bg-surface-panel",
            "pb-[var(--mc-foot-inset,0px)]",
          ),
          style: {
            height: options
              ? context != null
                ? `${context}px`
                : `calc((100dvh - 68px) * ${0.47})`
              : undefined,
          },
          contentClass: (0, runtime.cn)(
            "flex min-h-0 flex-1 flex-col overflow-y-auto",
            runtime.ChromeScrollbarLabel,
          ),
          showHandle: options,
        };
  }
  function InspectorPanelShell({
    posture: posture,
    filled: filled,
    headerRow: headerRow,
    headerAt = "bottom",
    children: children,
    "data-testid": dataTestid,
  }: Dynamic): Dynamic {
    let value: Dynamic = useInspectorSheetHeight(posture === "sheet" && filled),
      value2: Dynamic = inspectorShellStyle(posture, filled, value.heightPx),
      value3: Dynamic =
        posture === "sheet" && !value.dragging
          ? "transition-[height,transform] duration-200 ease-out motion-reduce:transition-none"
          : undefined,
      value4: Dynamic = filled ? (
        <div
          data-testid={"dc-anchored-content"}
          ref={posture === "sheet" ? value.contentProps.ref : undefined}
          className={(0, runtime.cn)(
            value2.contentClass,
            "pb-3 select-none [&_input]:select-text [&_textarea]:select-text [--pp-label-w:88px]",
          )}
        >
          {children}
          <runtime.FloatingScrollbar />
        </div>
      ) : null;
    return (
      <div
        data-testid={dataTestid}
        data-posture={posture}
        className={(0, runtime.cn)(value2.container, value3)}
        style={{
          ...value2.style,
          ...(value.keyboardInset > 0
            ? {
                transform: `translateY(-${value.keyboardInset}px)`,
                paddingBottom: `max(0px, calc(var(--mc-foot-inset, 0px) - ${value.keyboardInset}px))`,
              }
            : null),
        }}
      >
        {posture === "wide" ? (
          <jsxChromeInspectorSheet.Fragment>
            {headerRow && <div className={"shrink-0"}>{headerRow}</div>}
            {value4}
          </jsxChromeInspectorSheet.Fragment>
        ) : (
          <jsxChromeInspectorSheet.Fragment>
            {value2.showHandle && (
              <div
                data-testid={"dc-sheet-handle"}
                className={
                  "absolute inset-x-0 -top-1.5 z-10 h-3 cursor-row-resize touch-none"
                }
                onPointerDown={value.handleProps.onPointerDown}
                style={value.handleProps.style}
              >
                <span
                  aria-hidden={"true"}
                  className={
                    "absolute top-0 left-1/2 hidden h-10 w-24 -translate-x-1/2 pointer-coarse:block"
                  }
                />
              </div>
            )}
            {headerRow != null && headerAt === "top" && (
              <div className={"shrink-0 border-b"}>{headerRow}</div>
            )}
            {value4}
            {headerRow && headerAt === "bottom" && (
              <div
                className={(0, runtime.cn)("shrink-0", filled && "border-t")}
              >
                {headerRow}
              </div>
            )}
          </jsxChromeInspectorSheet.Fragment>
        )}
      </div>
    );
  }
  bindRuntimeValue(
    runtime,
    "clampInspectorSheetTop",
    () => clampInspectorSheetTop,
  );
  bindRuntimeValue(
    runtime,
    "inspectorKeyboardHeightState",
    () => inspectorKeyboardHeightState,
  );
  bindRuntimeValue(
    runtime,
    "inspectorSheetHeightLimits",
    () => inspectorSheetHeightLimits,
  );
  bindRuntimeValue(
    runtime,
    "clampInspectorSheetHeight",
    () => clampInspectorSheetHeight,
  );
  bindRuntimeValue(runtime, "inspectorSheetTop", () => inspectorSheetTop);
  bindRuntimeValue(
    runtime,
    "useInspectorSheetHeight",
    () => useInspectorSheetHeight,
  );
  bindRuntimeValue(
    runtime,
    "jsxChromeInspectorSheet",
    () => jsxChromeInspectorSheet,
    (value) => {
      jsxChromeInspectorSheet = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ChromeInspectorSheetMediaQuery",
    () => ChromeInspectorSheetMediaQuery,
    (value) => {
      ChromeInspectorSheetMediaQuery = value;
    },
  );
  bindRuntimeValue(runtime, "useInspectorPosture", () => useInspectorPosture);
  bindRuntimeValue(
    runtime,
    "ChromeInspectorSheetConstant",
    () => ChromeInspectorSheetConstant,
    (value) => {
      ChromeInspectorSheetConstant = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ChromeInspectorSheetConstant_2",
    () => ChromeInspectorSheetConstant_2,
    (value) => {
      ChromeInspectorSheetConstant_2 = value;
    },
  );
  bindRuntimeValue(runtime, "inspectorShellStyle", () => inspectorShellStyle);
  bindRuntimeValue(runtime, "InspectorPanelShell", () => InspectorPanelShell);
  bindRuntimeValue(
    runtime,
    "reactChromeInspectorSheet",
    () => reactChromeInspectorSheet,
    (value) => {
      reactChromeInspectorSheet = value;
    },
  );
  return () => {
    jsxChromeInspectorSheet = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
    ChromeInspectorSheetMediaQuery = "(max-width: 599px)";
    ChromeInspectorSheetConstant = 257;
    ChromeInspectorSheetConstant_2 = 12;
    reactChromeInspectorSheet = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react)(),
      1,
    );
    (0, runtime.initializeCdsIndex)();
  };
}
